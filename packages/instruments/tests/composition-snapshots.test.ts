import assert from "node:assert/strict";
import test from "node:test";
import {
  PointGrid, SeededStream, SimulationCancelledError, angleWalkStep, canPrepareInstrument, checkSimulation, cloneState, countValues, createInstrument,
  createCompositionRun, createSimulationCache, drawInstrument, elementId, finalState, latticeWalkStep, prepareInstrument, prepareSimulation, projectionAt, resumeSimulation,
  runSimulation, stateAt, LATTICE_DIRECTIONS, MAX_GRID_CELLS,
  type DrawingContext, type Simulation, type Snapshots,
} from "../dist/index.js";
import { buildProximityReplay, cachedProximityReplay, proximityReplayInstrumentDefinitions } from "../dist/adapters/proximity-replay-instruments.js";

/* ---------------------------------------------------------------- fixtures */

type Doubling = { value: number };
type DoublingParams = { start: number };
/** v(k) = 2v(k-1) + 1, so v(k) = 2^k (start + 1) - 1: a closed form the runner cannot know. */
const doubling: Simulation<Doubling, DoublingParams, { value: number }> = {
  id: "test-doubling",
  limits: () => ({ stepLimit: 60, workPerStep: 1 }),
  initial: (ctx) => { ctx.charge(1); return { value: ctx.params.start }; },
  step: (state, ctx) => { ctx.charge(1); return { value: state.value * 2 + 1 }; },
  project: (state) => ({ value: state.value }),
};
const closedForm = (start: number, k: number) => 2 ** k * (start + 1) - 1;

/** The same simulation with a counter that sees every call of `step`. */
function counting<S, P, Pr>(sim: Simulation<S, P, Pr>): { sim: Simulation<S, P, Pr>; steps: () => number } {
  let calls = 0;
  return { sim: { ...sim, step: (state, ctx) => { calls++; return sim.step(state, ctx); } }, steps: () => calls };
}

type Walker = { id: string; x: number; y: number };
type Walkers = { walkers: Walker[]; born: number };
type WalkParams = { ids: string[]; spawnEvery: number };
/** Walkers move in place, each with its own stream keyed by its id; births take ids from a counter in the state. */
const walkers: Simulation<Walkers, WalkParams, { id: string; x: number; y: number }[]> = {
  id: "test-walkers",
  limits: (p) => ({ stepLimit: 500, workPerStep: 100 + p.ids.length }),
  initial: (ctx) => ({ walkers: ctx.params.ids.map((id) => ({ id, x: 0, y: 0 })), born: 0 }),
  step(state, ctx) {
    for (const walker of state.walkers) {
      const stream = ctx.stream(walker.id);
      walker.x += stream.normal();
      walker.y += stream.normal();
    }
    ctx.charge(state.walkers.length);
    if (ctx.params.spawnEvery > 0 && ctx.step % ctx.params.spawnEvery === 0)
      state.walkers.push({ id: elementId("born", state.born++), x: 0, y: 0 });
    return state;
  },
  project: (state) => state.walkers.map((w) => ({ id: w.id, x: w.x, y: w.y })),
};
const at = (list: readonly { id: string; x: number; y: number }[], id: string) => list.find((item) => item.id === id);

/* ---------------------------------------------------------------- construction and structure */

test("steps, checkpoints and history follow the model's closed form", () => {
  const snaps = runSimulation(doubling, { start: 3 }, 1, { steps: 18, checkpointEvery: 4 });
  assert.equal(snaps.steps, 18);
  assert.deepEqual([...snaps.checkpointSteps], [0, 4, 8, 12, 16, 18]);
  assert.deepEqual(snaps.history.map((entry) => entry.step), Array.from({ length: 19 }, (_, k) => k));
  for (let k = 0; k <= 18; k++) {
    assert.equal(snaps.history[k].value.value, closedForm(3, k), `history ${k}`);
    assert.equal(stateAt(snaps, k).value, closedForm(3, k), `stateAt ${k}`);
  }
  assert.equal(snaps.final.value, closedForm(3, 18));
  assert.equal(snaps.work, 19, "one unit for the initial state and one per step");
});

test("stateAt replays from the nearest earlier checkpoint and nothing earlier", () => {
  const counted = counting(doubling);
  const snaps = runSimulation(counted.sim, { start: 1 }, 1, { steps: 60, checkpointEvery: 10 });
  const before = counted.steps();
  assert.equal(stateAt(snaps, 47).value, closedForm(1, 47));
  assert.equal(counted.steps() - before, 7, "checkpoint 40 plus seven steps");
  const mid = counted.steps();
  assert.equal(stateAt(snaps, 50).value, closedForm(1, 50));
  assert.equal(counted.steps(), mid, "an exact checkpoint needs no steps");
  assert.throws(() => stateAt(snaps, 61), /step must be an integer from 0 to 60/);
  assert.throws(() => stateAt(snaps, 1.5), /step must be an integer/);
});

test("published values are frozen and states are read back as copies", () => {
  const params = { ids: ["a", "b"], spawnEvery: 0 };
  const snaps = runSimulation(walkers, params, 5, { steps: 12 });
  assert.ok(Object.isFrozen(snaps) && Object.isFrozen(snaps.history) && Object.isFrozen(snaps.checkpointSteps) && Object.isFrozen(snaps.history[3]));
  assert.ok(Object.isFrozen(snaps.final) && Object.isFrozen(snaps.final[0]));
  assert.throws(() => { (snaps.final[0] as { x: number }).x = 1; }, TypeError);
  params.ids.push("c");
  assert.deepEqual(snaps.params, { ids: ["a", "b"], spawnEvery: 0 }, "the caller's later edits never reach the snapshots");
  assert.ok(Object.isFrozen(snaps.params));
  const copy = stateAt(snaps, 12);
  copy.walkers[0].x = 1e9;
  copy.walkers.length = 0;
  assert.notEqual(stateAt(snaps, 12).walkers[0].x, 1e9, "mutating a read copy cannot corrupt a checkpoint");
  assert.equal(stateAt(snaps, 12).walkers.length, 2);
  assert.deepEqual(projectionAt(snaps, 12), snaps.final);
  assert.deepEqual(projectionAt(snaps, 7), snaps.history[7].value);
});

test("history projections that hold typed arrays keep one private copy per step", () => {
  type Field = { field: Float64Array };
  const sim: Simulation<Field, { n: number }, { field: Float64Array }> = {
    id: "test-field",
    limits: () => ({ stepLimit: 100, workPerStep: 8 }),
    initial: (ctx) => ({ field: new Float64Array(ctx.params.n) }),
    step(state) { state.field[0] += 1; state.field[state.field.length - 1] += 0.5; return state; },
    project: (state) => ({ field: state.field }),
  };
  const snaps = runSimulation(sim, { n: 5 }, 1, { steps: 20, checkpointEvery: 6, historyEvery: 5 });
  assert.deepEqual(snaps.history.map((entry) => entry.step), [0, 5, 10, 15, 20]);
  for (const entry of snaps.history) {
    assert.equal(entry.value.field[0], entry.step);
    assert.equal(entry.value.field[4], entry.step / 2, "a later step never rewrites an earlier retained field");
  }
  assert.notEqual(snaps.history[1].value.field, snaps.history[2].value.field);
  assert.equal(stateAt(snaps, 13).field[0], 13);
  assert.equal(projectionAt(snaps, 13).field[0], 13, "an unretained step is replayed and projected");
  const bad: Simulation<{ v: number }, {}, { m: Map<number, number> }> = {
    id: "test-bad-projection", limits: () => ({ stepLimit: 1, workPerStep: 1 }), initial: () => ({ v: 0 }), step: (s) => s,
    project: () => ({ m: new Map([[1, 2]]) }),
  };
  assert.throws(() => runSimulation(bad, {}, 1, { steps: 1 }), /Projection at .*\.m is a Map/);
});

/* ---------------------------------------------------------------- structure-preserving guarantees */

test("more steps only appends: a shorter run is a prefix of a longer one", () => {
  const params = { ids: ["a", "b", "c"], spawnEvery: 4 };
  const long = runSimulation(walkers, params, 99, { steps: 60 });
  const short = runSimulation(walkers, params, 99, { steps: 37 });
  for (const entry of short.history) assert.deepEqual(long.history[entry.step].value, entry.value, `step ${entry.step}`);
  assert.deepEqual(finalState(short), stateAt(long, 37));
  assert.deepEqual(long.history.slice(0, 38).map((entry) => entry.value), short.history.map((entry) => entry.value));
});

test("checkpoint spacing changes retention and nothing else", () => {
  const params = { ids: ["a", "b"], spawnEvery: 5 };
  const runs = [1, 3, 7, 50, 0, 1000].map((checkpointEvery) => runSimulation(walkers, params, 12, { steps: 45, checkpointEvery }));
  for (const other of runs.slice(1)) {
    assert.deepEqual(finalState(other), finalState(runs[0]));
    assert.deepEqual(other.history, runs[0].history);
    assert.equal(other.work, runs[0].work);
    for (let step = 0; step <= 45; step += 4) assert.deepEqual(stateAt(other, step), stateAt(runs[0], step));
  }
  assert.deepEqual([...runs[4].checkpointSteps], [0, 45], "spacing 0 keeps only the start and the end");
  assert.deepEqual([...runs[5].checkpointSteps], [0, 45]);
  assert.notEqual(runs[0].key, runs[1].key, "retention is part of what was built, so it is part of the key");
});

test("resuming equals a run from scratch and never repeats earlier steps", () => {
  const params = { ids: ["a", "b", "c"], spawnEvery: 6 };
  const counted = counting(walkers);
  const first = runSimulation(counted.sim, params, 8, { steps: 30, checkpointEvery: 10 });
  assert.equal(counted.steps(), 30);
  const resumed = resumeSimulation(first, 25);
  assert.equal(counted.steps(), 55, "only the 25 new steps ran");
  const scratch = runSimulation(walkers, params, 8, { steps: 55, checkpointEvery: 10 });
  assert.deepEqual(finalState(resumed), finalState(scratch));
  assert.deepEqual(resumed.history, scratch.history);
  assert.deepEqual([...resumed.checkpointSteps], [...scratch.checkpointSteps]);
  assert.equal(resumed.work, scratch.work);
  assert.equal(resumed.key, scratch.key, "the content key is the one a run from scratch has");
  assert.equal(first.steps, 30, "the earlier snapshots are untouched");
  assert.deepEqual([...first.checkpointSteps], [0, 10, 20, 30]);
  assert.strictEqual(resumeSimulation(resumed, 0), resumed);
  // The earlier run's last step is kept only when the new schedule keeps it.
  const odd = resumeSimulation(runSimulation(walkers, params, 8, { steps: 33, checkpointEvery: 10 }), 20);
  const oddScratch = runSimulation(walkers, params, 8, { steps: 53, checkpointEvery: 10 });
  assert.deepEqual([...odd.checkpointSteps], [0, 10, 20, 30, 40, 50, 53], "step 33 is not scheduled, so it is gone");
  assert.deepEqual([...odd.checkpointSteps], [...oddScratch.checkpointSteps]);
  assert.deepEqual(odd.history, oddScratch.history);
  assert.deepEqual(finalState(odd), finalState(oddScratch));
});

test("fewer steps than a retained run replay from its nearest earlier checkpoint", () => {
  const params = { ids: ["a", "b"], spawnEvery: 4 };
  const counted = counting(walkers);
  const cache = createSimulationCache();
  const long = cache.get(counted.sim, params, 5, { steps: 50, checkpointEvery: 10 });
  assert.equal(counted.steps(), 50);
  const short = cache.get(counted.sim, params, 5, { steps: 37, checkpointEvery: 10 });
  assert.equal(counted.steps(), 57, "checkpoint 30 plus seven steps");
  const scratch = runSimulation(walkers, params, 5, { steps: 37, checkpointEvery: 10 });
  assert.deepEqual(finalState(short), finalState(scratch));
  assert.deepEqual(short.history, scratch.history);
  assert.deepEqual([...short.checkpointSteps], [0, 10, 20, 30, 37]);
  assert.equal(short.work, scratch.work, "work counts the steps that make this result, not the longer run's");
  assert.strictEqual(short.history[12], long.history[12], "frames before the checkpoint are shared, not recomputed");
  assert.strictEqual(cache.get(counted.sim, params, 5, { steps: 50, checkpointEvery: 10 }), long);
  const exact = cache.get(counted.sim, params, 5, { steps: 30, checkpointEvery: 10 });
  assert.equal(counted.steps(), 57, "an exact checkpoint needs no step at all");
  assert.deepEqual(finalState(exact), stateAt(long, 30));
  assert.deepEqual(exact.history, scratch.history.slice(0, 31));
});

test("elements own their streams: order and neighbours never move a walker", () => {
  const all = runSimulation(walkers, { ids: ["a", "b", "c"], spawnEvery: 0 }, 21, { steps: 30 });
  const reversed = runSimulation(walkers, { ids: ["c", "b", "a"], spawnEvery: 0 }, 21, { steps: 30 });
  const alone = runSimulation(walkers, { ids: ["b"], spawnEvery: 0 }, 21, { steps: 30 });
  for (let step = 0; step <= 30; step++) {
    assert.deepEqual(at(all.history[step].value, "b"), at(reversed.history[step].value, "b"));
    assert.deepEqual(at(all.history[step].value, "b"), at(alone.history[step].value, "b"));
  }
  const where = (list: readonly { id: string; x: number; y: number }[], id: string) => [at(list, id)!.x, at(list, id)!.y];
  assert.notDeepEqual(where(all.final, "a"), where(all.final, "b"), "different elements really do draw differently");
  assert.notDeepEqual(where(all.final, "b"), where(all.final, "c"));
  const other = runSimulation(walkers, { ids: ["b"], spawnEvery: 0 }, 22, { steps: 30 });
  assert.notDeepEqual(where(other.final, "b"), where(alone.final, "b"), "the seed matters");
  // Births take ids from the state's counter, not from position, and are stable across resume.
  const born = runSimulation(walkers, { ids: ["a"], spawnEvery: 3 }, 4, { steps: 10 });
  assert.deepEqual(born.final.map((w) => w.id), ["a", "born:0", "born:1", "born:2"]);
  assert.throws(() => elementId("a:b", 1), /without ':'/);
});

test("the checker passes correct simulations and names the property a broken one violates", () => {
  checkSimulation(doubling, { start: 2 }, 3, 25);
  checkSimulation(walkers, { ids: ["a", "b"], spawnEvery: 4 }, 3, 33);
  let hidden = 0;
  const clocked: Simulation<Doubling, DoublingParams> = { ...doubling, step: (state) => ({ value: state.value + ++hidden }) };
  assert.throws(() => checkSimulation(clocked, { start: 0 }, 1, 10), /two runs of one construction differ/);
  const randomized: Simulation<Doubling, DoublingParams> = { ...doubling, step: (state) => ({ value: state.value + Math.random() }) };
  assert.throws(() => checkSimulation(randomized, { start: 0 }, 1, 10), /differ/);
  const aliased: Simulation<Walkers, WalkParams, { id: string; x: number; y: number }[]> = { ...walkers, copy: (state) => state };
  assert.throws(() => checkSimulation(aliased, { ids: ["a"], spawnEvery: 0 }, 1, 20), /prefix property|differs|changes/);
  // Depending on the step index is legitimate; only hidden state is not.
  const indexed: Simulation<Doubling, DoublingParams> = { ...doubling, step: (state, ctx) => ({ value: state.value + (ctx.step % 3) }) };
  checkSimulation(indexed, { start: 0 }, 1, 12);
});

/* ---------------------------------------------------------------- cancellation and cooperative preparation */

test("cancellation stops between steps, publishes nothing and cannot change a later result", () => {
  const params = { ids: ["a", "b"], spawnEvery: 5 };
  const baseline = runSimulation(walkers, params, 3, { steps: 40 });
  for (const limit of [0, 1, 2, 17, 40]) {
    let polls = 0;
    assert.throws(() => runSimulation(walkers, params, 3, { steps: 40, cancelled: () => ++polls > limit }), SimulationCancelledError, `after ${limit} polls`);
    assert.equal(polls, limit + 1, "polled once before the initial state and once before each step");
    const again = runSimulation(walkers, params, 3, { steps: 40 });
    assert.deepEqual(finalState(again), finalState(baseline));
    assert.deepEqual(again.history, baseline.history);
  }
  let polls = 0;
  const done = runSimulation(walkers, params, 3, { steps: 40, cancelled: () => { polls++; return false; } });
  assert.equal(polls, 41);
  assert.deepEqual(done.history, baseline.history);
});

test("a composition run supplies cancellation and is charged per step", () => {
  let stop = false;
  const runOptions = { maxWork: 50, maxDepth: 2, cancelled: () => stop };
  const run = createCompositionRun(runOptions);
  const snaps = runSimulation(doubling, { start: 1 }, 1, { steps: 30, run });
  assert.equal(run.workUsed, 30);
  assert.equal(run.depth, 0, "the run is left even though it was entered");
  assert.throws(() => runSimulation(doubling, { start: 1 }, 1, { steps: 30, run }), /Composition work budget exceeded/);
  assert.equal(run.depth, 0);
  stop = true;
  assert.throws(() => runSimulation(doubling, { start: 1 }, 1, { steps: 3, run: createCompositionRun({ cancelled: () => stop }) }), SimulationCancelledError);
  assert.equal(snaps.steps, 30);
});
test("cooperative preparation yields between time slices and matches the synchronous result", async () => {
  const params = { ids: ["a", "b"], spawnEvery: 7 };
  const sync = runSimulation(walkers, params, 6, { steps: 50, checkpointEvery: 9 });
  let yields = 0, clock = 0;
  const every = await prepareSimulation(walkers, params, 6, {
    steps: 50, checkpointEvery: 9, timeSliceMs: 0, now: () => clock++, yieldToHost: async () => { yields++; },
  });
  assert.equal(yields, 49, "a yield between every pair of steps when the slice is zero");
  assert.deepEqual(every!.history, sync.history);
  assert.deepEqual(finalState(every!), finalState(sync));
  yields = 0;
  const never = await prepareSimulation(walkers, params, 6, { steps: 50, timeSliceMs: 1e9, yieldToHost: async () => { yields++; } });
  assert.equal(yields, 0);
  assert.deepEqual(never!.final, runSimulation(walkers, params, 6, { steps: 50 }).final);
  // A tick clock of 1 with a 5 ms slice yields once per 5 steps.
  yields = 0; clock = 0;
  await prepareSimulation(walkers, params, 6, { steps: 50, timeSliceMs: 5, now: () => clock++, yieldToHost: async () => { yields++; } });
  assert.equal(yields, 9);
});

test("a preparation cancelled while yielded resolves null, stores nothing and is repeatable", async () => {
  const params = { ids: ["a"], spawnEvery: 0 };
  const cache = createSimulationCache();
  let cancelledNow = false, yields = 0;
  const result = await cache.prepare(walkers, params, 2, {
    steps: 100, timeSliceMs: 0, cancelled: () => cancelledNow,
    yieldToHost: async () => { if (++yields === 10) cancelledNow = true; },
  });
  assert.equal(result, null);
  assert.equal(yields, 10);
  assert.equal(cache.size, 0, "nothing cancelled is ever cached");
  assert.equal(cache.has(walkers, params, 2, { steps: 100 }), false);
  const complete = await cache.prepare(walkers, params, 2, { steps: 100, yieldToHost: async () => {} });
  assert.deepEqual(complete!.final, runSimulation(walkers, params, 2, { steps: 100 }).final);
  assert.equal(await prepareSimulation(walkers, params, 2, { steps: 5, cancelled: () => true }), null, "cancelled before the initial state");
  await assert.rejects(prepareSimulation(walkers, params, 2, { steps: 5000 }), /stepLimit/, "real errors are not swallowed as cancellation");
});

/* ---------------------------------------------------------------- content-keyed cache */

test("the cache is keyed by construction only: appearance edits reuse the same snapshots", () => {
  const counted = counting(walkers);
  const cache = createSimulationCache();
  const construction = { ids: ["a", "b"], spawnEvery: 5 };
  const options = { steps: 40 };
  const first = cache.get(counted.sim, construction, 7, options);
  const ran = counted.steps();
  // A study's drawing asks the cache with its construction, then paints with whatever palette it has.
  const paint = (palette: readonly number[]) => {
    const snaps = cache.get(counted.sim, { ids: ["a", "b"], spawnEvery: 5 }, 7, options);
    return { snaps, ink: snaps.final.map((w, i) => `${palette[i % palette.length]}@${w.x}`).join() };
  };
  const red = paint([0xff0000, 0x00ff00]), blue = paint([0x123456, 0xabcdef, 0x777777]);
  assert.notEqual(red.ink, blue.ink, "the drawings differ");
  assert.strictEqual(red.snaps, first);
  assert.strictEqual(blue.snaps, first);
  assert.equal(counted.steps(), ran, "no step ran again");
  assert.strictEqual(cache.get(counted.sim, { spawnEvery: 5, ids: ["a", "b"] }, 7, options), first, "key order is irrelevant");
  assert.notStrictEqual(cache.get(counted.sim, { ...construction, spawnEvery: 6 }, 7, options), first, "a construction edit recomputes");
  assert.notStrictEqual(cache.get(counted.sim, construction, 8, options), first, "the seed is construction");
  assert.throws(() => cache.get(counted.sim, { ids: [undefined as unknown as string], spawnEvery: 0 }, 1, options), /params/);
  assert.throws(() => cache.get(counted.sim, { ids: ["a"], spawnEvery: NaN }, 1, options), /finite/);
  assert.equal(new Set([first.key, cache.get(counted.sim, construction, 7, { steps: 41 }).key]).size, 2);
});

test("asking for more steps extends the cached shorter run instead of starting over", () => {
  const counted = counting(walkers);
  const cache = createSimulationCache();
  const params = { ids: ["a", "b"], spawnEvery: 5 };
  const short = cache.get(counted.sim, params, 3, { steps: 20 });
  assert.equal(counted.steps(), 20);
  const long = cache.get(counted.sim, params, 3, { steps: 35 });
  assert.equal(counted.steps(), 35, "fifteen new steps only");
  assert.deepEqual(finalState(long), finalState(runSimulation(walkers, params, 3, { steps: 35 })));
  assert.strictEqual(cache.get(counted.sim, params, 3, { steps: 20 }), short, "the shorter result stays cached");
  assert.strictEqual(long.history[7], short.history[7], "resumed history shares the earlier frozen entries");
});

test("the cache is bounded by entries and by stored values, least recently used first", () => {
  const cache = createSimulationCache({ capacity: 2 });
  const get = (start: number) => cache.get(doubling, { start }, 1, { steps: 10 });
  const a = get(1), b = get(2);
  assert.strictEqual(get(1), a, "touch a so b is the oldest");
  get(3);
  assert.equal(cache.size, 2);
  assert.equal(cache.has(doubling, { start: 2 }, 1, { steps: 10 }), false, "b was evicted");
  assert.equal(cache.has(doubling, { start: 1 }, 1, { steps: 10 }), true);
  assert.notStrictEqual(get(2), b);
  const small = createSimulationCache({ maxStoredValues: a.storedValues + 1 });
  small.get(doubling, { start: 1 }, 1, { steps: 10 });
  small.get(doubling, { start: 2 }, 1, { steps: 10 });
  assert.equal(small.size, 1, "two entries would exceed the value bound");
  assert.ok(small.storedValues <= a.storedValues + 1);
  const tiny = createSimulationCache({ maxStoredValues: 1 });
  assert.equal(tiny.get(doubling, { start: 1 }, 1, { steps: 10 }).steps, 10, "the newest entry is always kept");
  assert.equal(tiny.size, 1);
});

/* ---------------------------------------------------------------- bounds name their argument */

test("work, state and memory bounds fail with the argument to change", () => {
  const sized: Simulation<{ cells: number[] }, { cells: number; work: number; limit: number }, { total: number }> = {
    id: "test-sized",
    limits: (p) => ({ stepLimit: p.limit, workPerStep: p.work }),
    initial: (ctx) => ({ cells: new Array(ctx.params.cells).fill(0) }),
    step(state, ctx) { ctx.charge(ctx.params.work + 1); return state; },
    project: (state) => ({ total: state.cells.length }),
  };
  const base = { cells: 10, work: 5, limit: 50 };
  assert.throws(() => runSimulation(sized, base, 1, { steps: 51 }), /steps \(51\) exceeds the test-sized stepLimit \(50\).*lower steps/);
  assert.throws(() => runSimulation(sized, { ...base, work: 10_000_000 }, 1, { steps: 10 }), /exceeds maxWork \(50000000\).*lower steps.*raise maxWork/);
  assert.throws(() => runSimulation(sized, base, 1, { steps: 3 }), /step 1 charged 6 work units, above the declared workPerStep \(5\)/);
  assert.throws(() => runSimulation(sized, { ...base, work: 0 }, 1, { steps: 0, maxStateValues: 5 }), /holds 10 values, above maxStateValues \(5\)/);
  assert.throws(() => runSimulation(sized, base, 1, { steps: 0, maxWork: 4 }), /maxWork/, "even the initial state's declared work is bounded");
  const free = { ...base, work: 100 };
  const noCharge = { ...sized, step: (state: { cells: number[] }) => state };
  assert.throws(() => runSimulation(noCharge, free, 1, { steps: 40, checkpointEvery: 2, maxCheckpointValues: 100 }), /checkpoints hold .*maxCheckpointValues \(100\).*raise checkpointEvery \(now 2\)/);
  assert.equal(runSimulation(noCharge, free, 1, { steps: 40, checkpointEvery: 20, maxCheckpointValues: 100 }).steps, 40);
  assert.throws(() => runSimulation(noCharge, free, 1, { steps: 40, maxHistoryValues: 20 }), /history holds .*maxHistoryValues \(20\).*raise historyEvery \(now 1\)/);
  assert.equal(runSimulation(noCharge, free, 1, { steps: 40, historyEvery: 20, maxHistoryValues: 20 }).history.length, 3);
  for (const bad of [{ steps: -1 }, { steps: 1.5 }, { steps: 2_000_000 }]) assert.throws(() => runSimulation(doubling, { start: 1 }, 1, bad), /steps must be an integer/);
  assert.throws(() => runSimulation(doubling, { start: 1 }, 1, { steps: 3, checkpointEvery: -2 }), /checkpointEvery must be an integer/);
  assert.throws(() => runSimulation(doubling, { start: 1 }, 1, { steps: 3, maxWork: 1.5 }), /maxWork must be an integer/);
  assert.throws(() => runSimulation(doubling, { start: 1 }, 1.5, { steps: 3 }), /seed/);
  const longer = runSimulation(doubling, { start: 1 }, 1, { steps: 10 });
  assert.throws(() => runSimulation(doubling, { start: 2 }, 1, { steps: 20, from: longer }), /not an earlier run of this exact construction/);
  assert.throws(() => resumeSimulation({ ...longer } as Snapshots<Doubling, DoublingParams, { value: number }>, 1), /Not a Snapshots value/);
});

test("state helpers copy what they can and refuse what they cannot", () => {
  const grid = new PointGrid({ bounds: [0, 0, 10, 10], cellSize: 2 });
  grid.insert(1, 3, 3);
  const state = { list: [1, [2, 3]], typed: new Int16Array([1, 2]), map: new Map([[1, { a: 1 }]]), set: new Set([4]), grid };
  const copy = cloneState(state);
  assert.deepEqual(copy.list, state.list);
  assert.notStrictEqual(copy.list[1], state.list[1]);
  assert.notStrictEqual(copy.typed, state.typed);
  assert.notStrictEqual(copy.map.get(1), state.map.get(1));
  assert.notStrictEqual(copy.grid, grid);
  copy.grid.remove(1);
  assert.equal(grid.size, 1, "the copy's grid is independent");
  assert.equal(countValues(state), 1 + 2 + 2 + 2 + 1 + 4, "list 3 leaves, typed 2, map key+value 2, set 1, grid 4");
  assert.throws(() => cloneState({ d: new Date() }), /state\.d is a Date; give it a clone\(\)/);
  assert.throws(() => cloneState({ f: () => 1 }), /state\.f is a function/);
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assert.throws(() => cloneState(cycle), /cycle/);
});

/* ---------------------------------------------------------------- seeded streams */

test("seeded streams are deterministic, distinct per seed and statistically sane", () => {
  const a = new SeededStream(42), b = new SeededStream(42), c = new SeededStream(43);
  const first = Array.from({ length: 8 }, () => a.next());
  assert.deepEqual(first, Array.from({ length: 8 }, () => b.next()));
  assert.notDeepEqual(first, Array.from({ length: 8 }, () => c.next()));
  const stream = new SeededStream(2026);
  const n = 30000;
  let sum = 0, square = 0;
  const bins = new Array(6).fill(0);
  for (let i = 0; i < n; i++) {
    const x = stream.next();
    assert.ok(x >= 0 && x < 1);
    sum += x; square += x * x;
    bins[stream.int(6)]++;
  }
  assert.ok(Math.abs(sum / n - 0.5) < 0.01, `mean ${sum / n}`);
  assert.ok(Math.abs(square / n - sum * sum / n / n - 1 / 12) < 0.005, "variance of a uniform");
  for (const count of bins) assert.ok(Math.abs(count / n - 1 / 6) < 0.012, `bins ${bins}`);
  let m = 0, v = 0;
  for (let i = 0; i < n; i++) { const g = stream.normal(); m += g; v += g * g; }
  assert.ok(Math.abs(m / n) < 0.03 && Math.abs(v / n - 1) < 0.04, `normal ${m / n} ${v / n}`);
  assert.throws(() => new SeededStream(-1), /uint32/);
  assert.throws(() => stream.int(0), /1 ≤ n/);
});

/* ---------------------------------------------------------------- spatial index against brute force */

type Pt = [id: number, x: number, y: number];
const bruteNearest = (points: Pt[], x: number, y: number, options: { maxDistance?: number; exclude?: number } = {}) => {
  let best: { id: number; squared: number } | null = null;
  for (const [id, px, py] of points) {
    if (id === options.exclude) continue;
    const squared = (px - x) ** 2 + (py - y) ** 2;
    if (options.maxDistance !== undefined && Math.sqrt(squared) > options.maxDistance) continue;
    if (!best || squared < best.squared || (squared === best.squared && id < best.id)) best = { id, squared };
  }
  return best && { id: best.id, distance: Math.sqrt(best.squared) };
};
const bruteWithin = (points: Pt[], x: number, y: number, radius: number, exclude?: number) => points
  .filter(([id, px, py]) => id !== exclude && (px - x) ** 2 + (py - y) ** 2 <= radius * radius)
  .map(([id, px, py]) => ({ id, squared: (px - x) ** 2 + (py - y) ** 2 }))
  .sort((p, q) => p.squared - q.squared || p.id - q.id)
  .map((hit) => ({ id: hit.id, distance: Math.sqrt(hit.squared) }));

test("the grid index agrees with brute force on seeded data, through removals and moves", () => {
  const rng = new SeededStream(7);
  for (const cellSize of [2.5, 10, 33, 400]) {
    const grid = new PointGrid({ bounds: [0, 0, 100, 100], cellSize });
    const points = new Map<number, Pt>();
    const put = (id: number) => { const p: Pt = [id, Math.round(rng.next() * 400) / 4, Math.round(rng.next() * 400) / 4]; points.set(id, p); grid.insert(id, p[1], p[2]); };
    for (let id = 0; id < 300; id++) put(id);
    const verify = (label: string) => {
      const list = [...points.values()];
      assert.equal(grid.size, list.length);
      for (let q = 0; q < 60; q++) {
        const x = rng.next() * 140 - 20, y = rng.next() * 140 - 20, radius = rng.next() * 30, exclude = rng.int(300);
        assert.deepEqual(grid.nearest(x, y), bruteNearest(list, x, y), `${label} nearest`);
        assert.deepEqual(grid.nearest(x, y, { exclude, maxDistance: radius }), bruteNearest(list, x, y, { exclude, maxDistance: radius }), `${label} nearest limited`);
        assert.deepEqual(grid.within(x, y, radius), bruteWithin(list, x, y, radius), `${label} within`);
        assert.deepEqual(grid.within(x, y, radius, { exclude }), bruteWithin(list, x, y, radius, exclude), `${label} within excluding`);
      }
    };
    verify(`cell ${cellSize} initial`);
    for (let i = 0; i < 120; i++) { const id = rng.int(300); if (points.has(id)) { assert.equal(grid.remove(id), true); points.delete(id); } }
    assert.equal(grid.remove(100000), false);
    verify(`cell ${cellSize} after removals`);
    for (let i = 0; i < 80; i++) {
      const id = rng.int(300);
      if (points.has(id)) { const x = Math.round(rng.next() * 400) / 4, y = Math.round(rng.next() * 400) / 4; points.set(id, [id, x, y]); grid.move(id, x, y); }
      else put(id);
    }
    verify(`cell ${cellSize} after moves`);
    assert.deepEqual(grid.ids(), [...points.keys()].sort((p, q) => p - q));
    assert.deepEqual(PointGrid.from({ bounds: [0, 0, 100, 100], cellSize }, grid.entries()).entries(), grid.entries());
  }
  const empty = new PointGrid({ bounds: [0, 0, 1, 1], cellSize: 1 });
  assert.equal(empty.nearest(0.5, 0.5), null);
  assert.deepEqual(empty.within(0.5, 0.5, 5), []);
});

test("equal distances resolve to the lowest id whatever the insertion order", () => {
  const lattice: Pt[] = [];
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) lattice.push([99 - (y * 10 + x), x, y]);
  for (const order of [lattice, [...lattice].reverse(), [...lattice].sort((p, q) => (p[1] * 7 + p[2] * 13) % 11 - (q[1] * 7 + q[2] * 13) % 11)]) {
    const grid = new PointGrid({ bounds: [0, 0, 9, 9], cellSize: 1.5 });
    for (const [id, x, y] of order) grid.insert(id, x, y);
    // (4.5, 4.5) is exactly between the lattice points (4,4) (5,4) (4,5) (5,5), whose ids are 55, 54, 45, 44.
    assert.deepEqual(grid.nearest(4.5, 4.5), { id: 44, distance: Math.sqrt(0.5) });
    assert.deepEqual(grid.within(4.5, 4.5, Math.sqrt(0.5)).map((hit) => hit.id), [44, 45, 54, 55]);
    assert.deepEqual(grid.within(4, 4, 1).map((hit) => hit.id), [55, 45, 54, 56, 65], "the point itself first, then the four unit neighbours by id");
    assert.equal(grid.nearest(4, 4, { exclude: 55 })!.id, 45, "unit neighbours 54 56 45 65: the lowest id wins");
  }
});

test("queries visit a bounded neighbourhood, not the whole set", () => {
  const rng = new SeededStream(11);
  let visits = 0;
  const grid = new PointGrid({ bounds: [0, 0, 1000, 1000], cellSize: 10, onWork: (units) => { visits = Math.max(visits, units); } });
  for (let id = 0; id < 20000; id++) grid.insert(id, rng.next() * 1000, rng.next() * 1000);
  for (let q = 0; q < 300; q++) { grid.nearest(rng.next() * 1000, rng.next() * 1000); grid.within(rng.next() * 1000, rng.next() * 1000, 15); }
  assert.ok(visits > 0 && visits < 400, `${visits} units against 20000 points`);
  const sparse = new PointGrid({ bounds: [0, 0, 1000, 1000], cellSize: 10, onWork: (units) => { visits = units; } });
  sparse.insert(1, 999, 999);
  assert.equal(sparse.nearest(0, 0)!.id, 1);
  assert.ok(visits <= 100 * 100 * 2, "even a far lone point is found by a bounded ring scan");
});

test("index failures name the argument to change", () => {
  const grid = new PointGrid({ bounds: [0, 0, 10, 10], cellSize: 5, maxPoints: 2 });
  grid.insert(1, 0, 0); grid.insert(2, 10, 10);
  assert.throws(() => grid.insert(3, 5, 5), /maxPoints \(2\)/);
  assert.throws(() => grid.insert(1, 1, 1), /already in the index/);
  grid.remove(2);
  assert.throws(() => grid.insert(4, 10.5, 5), /outside bounds \[0, 0, 10, 10\]; enlarge bounds/);
  assert.throws(() => grid.move(1, -1, 0), /outside bounds/);
  assert.deepEqual(grid.position(1), [0, 0], "a refused move leaves the point where it was");
  assert.throws(() => grid.insert(-1, 1, 1), /nonnegative safe integer/);
  assert.throws(() => grid.nearest(NaN, 0), /finite/);
  assert.throws(() => grid.within(0, 0, -1), /nonnegative/);
  assert.throws(() => new PointGrid({ bounds: [0, 0, 100_000, 100_000], cellSize: 1 }), new RegExp(`exceeds ${MAX_GRID_CELLS}; raise cellSize or shrink bounds`));
  assert.throws(() => new PointGrid({ bounds: [0, 0, 0, 5], cellSize: 1 }), /maxX > minX/);
  assert.throws(() => new PointGrid({ bounds: [0, 0, 5, 5], cellSize: 0 }), /cellSize/);
});

/* ---------------------------------------------------------------- walks */

test("lattice walks stay on free lattice cells, stop honestly, and draw a fixed amount", () => {
  const options = { columns: 12, rows: 9, neighbourhood: 8 as const, persistence: 0.4 };
  const wall = (x: number, y: number) => x === 6 && y !== 4;
  const stream = new SeededStream(5);
  let x = 2, y = 4, previous = -1, crossedGap = false;
  for (let i = 0; i < 4000; i++) {
    const step = latticeWalkStep(x, y, stream, { ...options, previous, blocked: wall });
    assert.equal(step.stuck, false);
    const [dx, dy] = LATTICE_DIRECTIONS[step.direction];
    assert.deepEqual([step.x - x, step.y - y], [dx, dy]);
    assert.ok(step.x >= 0 && step.x < 12 && step.y >= 0 && step.y < 9 && !wall(step.x, step.y));
    if (x < 6 && step.x > 6) assert.fail("a step jumped the wall");
    if (x === 5 && step.x === 6) crossedGap = true;
    ({ x, y, direction: previous } = step);
  }
  assert.ok(crossedGap, "the wall's only gap is used");
  assert.deepEqual(latticeWalkStep(0, 0, new SeededStream(1), { ...options, neighbourhood: 4, blocked: () => true }), { x: 0, y: 0, direction: -1, stuck: true });
  // Two draws per call, blocked or not: the next draw of the stream is the same.
  const s1 = new SeededStream(9), s2 = new SeededStream(9);
  latticeWalkStep(3, 3, s1, { ...options, blocked: () => true });
  latticeWalkStep(3, 3, s2, options);
  assert.equal(s1.next(), s2.next());
  // Persistence 1 keeps a free direction; persistence 0 uses all four directions about equally.
  const keep = new SeededStream(3);
  for (let i = 0; i < 200; i++) assert.equal(latticeWalkStep(5, 4, keep, { ...options, neighbourhood: 4, persistence: 1, previous: 2 }).direction, 2);
  const blockedAhead = latticeWalkStep(5, 4, new SeededStream(3), { ...options, neighbourhood: 4, persistence: 1, previous: 0, blocked: (cx, cy) => cx === 6 && cy === 4 });
  assert.notEqual(blockedAhead.direction, 0, "a blocked previous direction is not kept");
  const counts = [0, 0, 0, 0], free = new SeededStream(8);
  for (let i = 0; i < 8000; i++) counts[latticeWalkStep(5, 4, free, { ...options, neighbourhood: 4, persistence: 0 }).direction]++;
  for (const count of counts) assert.ok(Math.abs(count / 8000 - 0.25) < 0.02, `${counts}`);
  assert.throws(() => latticeWalkStep(12, 0, free, options), /outside the 12 × 9 lattice/);
  assert.throws(() => latticeWalkStep(0, 0, free, { ...options, persistence: 2 }), /persistence/);
  assert.throws(() => latticeWalkStep(0, 0, free, { ...options, previous: 9 }), /direction index/);
});

test("angle walks move exactly one length and turn within their limit", () => {
  const straight = new SeededStream(1);
  let x = 1, y = 2;
  for (let i = 0; i < 5; i++) ({ x, y } = angleWalkStep(x, y, Math.PI / 6, straight, { length: 2, turn: 0 }));
  assert.ok(Math.abs(x - (1 + 10 * Math.cos(Math.PI / 6))) < 1e-9 && Math.abs(y - (2 + 10 * Math.sin(Math.PI / 6))) < 1e-9, "turn 0 is a straight line");
  const stream = new SeededStream(2);
  let heading = 0, px = 0, py = 0, spread = 0;
  for (let i = 0; i < 2000; i++) {
    const step = angleWalkStep(px, py, heading, stream, { length: 1.5, turn: 0.3 });
    assert.ok(Math.abs(Math.hypot(step.x - px, step.y - py) - 1.5) < 1e-9);
    assert.ok(Math.abs(step.heading - heading) <= 0.3);
    spread = Math.max(spread, Math.abs(step.heading - heading));
    ({ x: px, y: py, heading } = step);
  }
  assert.ok(spread > 0.29, "the whole turn range is used");
  assert.throws(() => angleWalkStep(0, 0, 0, stream, { length: 0, turn: 0 }), /length/);
  assert.throws(() => angleWalkStep(0, 0, 0, stream, { length: 1, turn: 4 }), /turn/);
});

/* ---------------------------------------------------------------- a stateful system built on the foundation */

type Grain = { id: number; x: number; y: number; parent: number; born: number };
type Cluster = { grains: Grain[]; grid: PointGrid; thrown: number; lost: number };
type ClusterParams = { radius: number; stick: number; throws: number };
/** A small aggregation: walkers launched on a ring stick to the nearest grain. Ids come from the counter, order from the index. */
const aggregation: Simulation<Cluster, ClusterParams, { grains: number; tip: [number, number]; lost: number }> = {
  id: "test-aggregation",
  limits: (p) => ({ stepLimit: 600, workPerStep: p.throws * 400 }),
  initial(ctx) {
    const grid = new PointGrid({ bounds: [-100, -100, 100, 100], cellSize: 4 });
    grid.insert(0, 0, 0);
    return { grains: [{ id: 0, x: 0, y: 0, parent: -1, born: 0 }], grid, thrown: 0, lost: 0 };
  },
  step(state, ctx) {
    for (let t = 0; t < ctx.params.throws; t++) {
      const serial = state.thrown++;
      const stream = ctx.stream(`walker:${serial}`);
      const angle = stream.next() * 2 * Math.PI;
      let x = Math.cos(angle) * ctx.params.radius, y = Math.sin(angle) * ctx.params.radius, heading = angle + Math.PI, stuck = false;
      for (let micro = 0; micro < 400 && !stuck; micro++) {
        const near = state.grid.nearest(x, y, { maxDistance: ctx.params.stick });
        if (near) {
          const id = state.grains.length;
          state.grains.push({ id, x, y, parent: near.id, born: ctx.step });
          state.grid.insert(id, x, y);
          stuck = true;
        } else {
          ({ x, y, heading } = angleWalkStep(x, y, heading, stream, { length: 1.5, turn: Math.PI }));
          if (Math.hypot(x, y) > ctx.params.radius * 1.4) break;
        }
      }
      if (!stuck) state.lost++;
    }
    ctx.charge(ctx.params.throws * 400);
    return state;
  },
  project: (state) => ({ grains: state.grains.length, tip: [state.grains[state.grains.length - 1].x, state.grains[state.grains.length - 1].y], lost: state.lost }),
};

test("an aggregation built on the index, streams and snapshots is exact, bounded and replayable", () => {
  const params = { radius: 18, stick: 2, throws: 3 };
  checkSimulation(aggregation, params, 31, 40);
  const snaps = runSimulation(aggregation, params, 31, { steps: 80, checkpointEvery: 16 });
  const end = finalState(snaps);
  assert.ok(end.grains.length > 40, `grew to ${end.grains.length}`);
  assert.equal(end.grains.length - 1 + end.lost, end.thrown, "every thrown walker either stuck or was lost");
  assert.equal(end.thrown, 80 * 3);
  const ids = end.grains.map((grain) => grain.id);
  assert.deepEqual(ids, ids.map((_, i) => i), "ids are the birth serial");
  for (const grain of end.grains.slice(1)) {
    const parent = end.grains[grain.parent];
    assert.ok(grain.parent < grain.id, "a grain's parent was there first");
    assert.ok(Math.hypot(grain.x - parent.x, grain.y - parent.y) <= params.stick, "attached within the sticking distance");
    // The parent is the nearest grain that existed when it stuck (lowest id on ties), against a brute-force scan.
    const earlier = end.grains.slice(0, grain.id);
    let best = earlier[0];
    for (const other of earlier) {
      const d = Math.hypot(grain.x - other.x, grain.y - other.y), b = Math.hypot(grain.x - best.x, grain.y - best.y);
      if (d < b || (d === b && other.id < best.id)) best = other;
    }
    assert.equal(grain.parent, best.id);
  }
  assert.equal(end.grid.size, end.grains.length, "the index carries exactly the grains");
  assert.deepEqual(stateAt(snaps, 47).grains, finalState(runSimulation(aggregation, params, 31, { steps: 47 })).grains, "a replayed state equals a shorter run");
  const grown = resumeSimulation(snaps, 20);
  assert.deepEqual(finalState(grown).grains.slice(0, end.grains.length), end.grains, "growth only appends");
  assert.equal(snaps.history[80].value.grains, end.grains.length);
});

/* ---------------------------------------------------------------- refactored instruments */

const canvas = () => new Proxy({ width: 640, height: 640, CLOSE: "close", background() {}, drawingContext: {} } as Record<string, unknown>, {
  get: (target, key: string) => (key in target ? target[key] : () => undefined),
}) as unknown as DrawingContext;

test("the proximity replay is built from snapshots: appearance reuses it, ticks extend it", () => {
  const base = { ...proximityReplayInstrumentDefinitions[1].defaults, ticks: 12, disorder: 0.06 };
  const first = cachedProximityReplay(base, 42);
  assert.strictEqual(cachedProximityReplay({ ...base, trails: false, nodeSize: 9, linkWeight: 4, dotMarks: true, trailStride: 5, showVelocities: false }, 42), first,
    "appearance controls are not construction");
  const recolored = { ...createInstrument("agent-trails"), seed: 42, params: { ...base }, palette: [0x101010, 0xf0f0f0, 0xff8800, 0x2288ff, 0x00aa55] };
  drawInstrument(canvas(), recolored);
  drawInstrument(canvas(), { ...recolored, palette: [0xffffff, 0x000000, 0x123456, 0x654321, 0xabcdef, 0xfedcba] });
  assert.strictEqual(cachedProximityReplay(base, 42), first, "drawing with two palettes leaves the snapshot alone");
  assert.notStrictEqual(cachedProximityReplay({ ...base, force: 0.0006 }, 42), first);
  assert.notStrictEqual(cachedProximityReplay(base, 43), first, "the seed matters while the start is disordered");
  const ordered = { ...base, disorder: 0, speed: 0 };
  assert.strictEqual(cachedProximityReplay(ordered, 1), cachedProximityReplay(ordered, 2), "and not once nothing draws from it");
  const longer = cachedProximityReplay({ ...base, ticks: 30 }, 42);
  assert.notStrictEqual(longer, first);
  assert.strictEqual(longer.history[5], first.history[5], "the longer run extended the shorter one, reusing its frames");
  const fresh = buildProximityReplay({ ...base, ticks: 30 }, 42);
  assert.deepEqual(longer.history, fresh.history);
  assert.deepEqual(longer.pairHistory, fresh.pairHistory);
  assert.deepEqual(longer.points, fresh.points);
  assert.deepEqual(longer.velocities, fresh.velocities);
  assert.deepEqual(longer.pairs, fresh.pairs);
  assert.equal(longer.history.length, 31);
  assert.deepEqual(longer.pairHistory[30], Int32Array.from(longer.pairs.flat()), "the last pair list is the final pairs");
});

test("motion studies prepare cooperatively, and a cancelled preparation is not painted", async () => {
  for (const id of ["lingering-links", "sensing-trails", "flocking-marks"]) {
    assert.equal(canPrepareInstrument(id), true);
    const input = { ...createInstrument(id), seed: 987654 + id.length };
    assert.equal(await prepareInstrument(input, () => true), false, `${id}: cancelled before the first step`);
    let polls = 0;
    assert.equal(await prepareInstrument(input, () => ++polls > 4), false, `${id}: cancelled between steps`);
    assert.ok(polls >= 5);
    assert.equal(await prepareInstrument(input, () => false), true);
    assert.doesNotThrow(() => drawInstrument(canvas(), input));
  }
});
