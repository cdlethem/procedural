import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregationColoniesComposition, canPrepareInstrument, checkSimulation, colonyCache, colonyDomain, colonyIsCached, colonyLinkPaths, colonyMarkSites, colonyOfRecipe,
  colonyParams, colonyReleasePoint, colonySimulation, colonyTipSites, colonyTone, colonyWorkBound, createInstrument, domainRings, drawAggregationColonies, drawInstrument,
  finalState, growColony, identical, locateInDomain, planarDomain, prepareColony, prepareInstrument, rectangleDomain, runSimulation, shownGrains, stateAt, visibleParameters,
  COLONY_LIMITS, definitions, type Colony, type ColonyOptions, type CompositionSurface, type DrawingContext, type PlanarDomain, type SimulationContext,
} from "../dist/index.js";

class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  ops: string[] = [];
  #note(name: string, args: unknown[]) { this.ops.push(`${name}(${args.map((v) => typeof v === "number" ? Number(v.toFixed(9)) : String(v)).join(",")})`); }
  push() { this.#note("push", []); } pop() { this.#note("pop", []); }
  translate(...a: number[]) { this.#note("translate", a); } rotate(...a: number[]) { this.#note("rotate", a); }
  scale(...a: number[]) { this.#note("scale", a); }
  noFill() { this.#note("noFill", []); } noStroke() { this.#note("noStroke", []); }
  fill(...a: number[]) { this.#note("fill", a); } stroke(...a: number[]) { this.#note("stroke", a); }
  strokeWeight(...a: number[]) { this.#note("strokeWeight", a); } strokeCap(...a: unknown[]) { this.#note("strokeCap", a); }
  circle(...a: number[]) { this.#note("circle", a); } line(...a: number[]) { this.#note("line", a); }
  rect(...a: number[]) { this.#note("rect", a); } beginShape() { this.#note("beginShape", []); }
  vertex(...a: number[]) { this.#note("vertex", a); } endShape(...a: unknown[]) { this.#note("endShape", a); }
  count(name: string) { return this.ops.filter((op) => op.startsWith(`${name}(`)).length; }
}

const near = (actual: number, expected: number, tolerance = 1e-9, note = "") =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);

const options = (over: Partial<ColonyOptions> = {}, seed = 42): ColonyOptions => ({
  seed,
  seeds: { shape: "point", count: 1, x: 320, y: 320, width: 0, height: 0, angle: 0 },
  source: { shape: "ellipse", x: 320, y: 320, width: 620, height: 620, angle: 0 },
  domain: { kind: "none" },
  walker: { radius: 3, stick: 1, bias: 0, biasAngle: 90, pull: 0, turn: 180 },
  growth: { reach: 40, lifetime: 2500, patience: 80, escape: 60 },
  ...over,
});
const withWalker = (walker: Partial<ColonyOptions["walker"]>, over: Partial<ColonyOptions> = {}, seed = 42): ColonyOptions =>
  options({ ...over, walker: { ...options().walker, ...walker } }, seed);
const withGrowth = (growth: Partial<ColonyOptions["growth"]>, over: Partial<ColonyOptions> = {}, seed = 42): ColonyOptions =>
  options({ ...over, growth: { ...options().growth, ...growth } }, seed);

const instrument = (params: Record<string, number | string | boolean> = {}, seed = 42) => {
  const input = createInstrument("aggregation-colonies");
  return { ...input, seed, params: { ...input.params, ...params } };
};
const recipeFor = (params: Record<string, number | string | boolean> = {}, seed = 42) => aggregationColoniesComposition(instrument(params, seed));
const drawn = (params: Record<string, number | string | boolean>, seed = 42): Recorder => {
  const surface = new Recorder();
  drawInstrument(surface as unknown as DrawingContext, instrument(params, seed));
  return surface;
};

/* ------------------------------------------------------------------------------------ brute-force geometry */

type Ring = readonly (readonly [number, number])[];
const pointSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
};
const cross = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
const segmentDistance = (a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[]): number => {
  const o1 = cross(a[0], a[1], b[0], b[1], c[0], c[1]), o2 = cross(a[0], a[1], b[0], b[1], d[0], d[1]);
  const o3 = cross(c[0], c[1], d[0], d[1], a[0], a[1]), o4 = cross(c[0], c[1], d[0], d[1], b[0], b[1]);
  if (o1 * o2 < 0 && o3 * o4 < 0) return 0;
  return Math.min(pointSegment(a[0], a[1], c[0], c[1], d[0], d[1]), pointSegment(b[0], b[1], c[0], c[1], d[0], d[1]),
    pointSegment(c[0], c[1], a[0], a[1], b[0], b[1]), pointSegment(d[0], d[1], a[0], a[1], b[0], b[1]));
};
const wallEdges = (rings: readonly Ring[]) => rings.flatMap((ring) => ring.map((p, i) => [ring[(i + ring.length - 1) % ring.length], p] as const));
const attached = (colony: Colony) => colony.counts.attached;
const positions = (colony: Colony) => colony.sites.map((site) => `${site.position[0]},${site.position[1]},${site.parent},${site.born}`);

/* ------------------------------------------------------------------------------------------- the model */

test("every grain sits exactly one contact from its parent and no two grains are closer than half a contact", () => {
  const configs: [string, ColonyOptions][] = [
    ["point seed", options()],
    ["wind and pull together (the largest drift the model allows per step)", withWalker({ bias: 0.5, pull: 0.4 }, { source: { shape: "ellipse", x: 320, y: 100, width: 300, height: 60, angle: 0 } })],
    ["ring of seeds, sticking chance 0.3", withWalker({ stick: 0.3 }, { seeds: { shape: "ring", count: 9, x: 320, y: 320, width: 160, height: 160, angle: 0 } })],
    ["ballistic walkers", withWalker({ turn: 25 }, {})],
  ];
  for (const seed of [42, 7, 1234567]) for (const [name, config] of configs) {
    const colony = growColony({ ...config, seed }, 700);
    assert.ok(attached(colony) > 40, `${name}: only ${attached(colony)} grains attached`);
    const contact = colony.contact;
    near(contact, 2 * config.walker.radius);
    let previousBorn = 0;
    colony.sites.forEach((site, i) => {
      assert.equal(site.id, `grain:${i}`);
      assert.ok(site.born >= previousBorn, `${name}: birth order`);
      previousBorn = site.born;
      if (site.parent >= 0) {
        assert.ok(site.parent < i, `${name}: parent precedes child`);
        const parent = colony.sites[site.parent];
        near(Math.hypot(site.position[0] - parent.position[0], site.position[1] - parent.position[1]), contact, 1e-9, `${name}: link ${site.id}`);
        assert.ok(site.born >= 1 && site.born <= 700);
      } else assert.equal(site.born, 0);
    });
    let closest = Infinity;
    for (let i = 0; i < colony.sites.length; i++) for (let j = i + 1; j < colony.sites.length; j++)
      closest = Math.min(closest, Math.hypot(colony.sites[i].position[0] - colony.sites[j].position[0], colony.sites[i].position[1] - colony.sites[j].position[1]));
    assert.ok(closest >= contact / 2 - 1e-9, `${name} seed ${seed}: closest pair ${closest} < ${contact / 2}`);
  }
});

test("a step's release counts add up: every walker ends attached, escaped, timed out or unlaunched", () => {
  for (const config of [options(), withGrowth({ lifetime: 60 }), withWalker({ stick: 0.05 }, {}), options({ domain: { kind: "ellipse", x: 320, y: 320, width: 140, height: 140 }, source: { shape: "inside", x: 0, y: 0, width: 0, height: 0, angle: 0 } })]) {
    const colony = growColony(config, 900);
    const { released, escaped, timedOut, unlaunched } = colony.counts;
    assert.equal(released, attached(colony) + escaped + timedOut + unlaunched);
    assert.ok(released <= 900);
    if (colony.status === "growing") assert.equal(released, 900);
    else assert.equal(released, colony.stalledAt, "a stalled colony stops releasing at the step it stalled");
  }
});

test("equidistant contact goes to the lowest id, whichever seed that is", () => {
  // Two seeds 10 apart on the line y = 310, radius 5 (contact 10). A scripted walker comes straight down x = 300, which is exactly
  // equidistant from both seeds whenever it first touches; whichever seed has the lower id must be the parent.
  const sim = colonySimulation(null);
  for (const angle of [0, 180]) {
    const config = options({ seeds: { shape: "line", count: 2, x: 300, y: 310, width: 10, height: 0, angle },
      source: { shape: "inside", x: 0, y: 0, width: 0, height: 0, angle: 0 }, walker: { ...options().walker, radius: 5 } });
    const params = colonyParams(config);
    const scripts: Record<string, number[]> = { "walker:0|launch": [15 / 32, 29 / 64, 0.5], "walker:0|walk": [] };
    for (let k = 0; k < 40; k++) scripts["walker:0|walk"].push(0.5, 0.3);
    const cursor: Record<string, number> = {};
    const context = (step: number): SimulationContext<typeof params> => ({
      params, seed: 42, step, charge() {},
      stream: (id: string, purpose = "") => {
        const key = `${id}|${purpose}`;
        return { next: () => { const at = cursor[key] ?? 0; cursor[key] = at + 1; return scripts[key][at]; } } as never;
      },
    });
    const state = sim.initial(context(0));
    assert.equal(state.x.length, 2);
    const lower = { x: state.x[0], y: state.y[0] }, higher = { x: state.x[1], y: state.y[1] };
    assert.equal(Math.abs(lower.x - 300), 5); assert.ok(Math.abs(lower.x - higher.x) === 10);
    sim.step(state, context(1));
    assert.equal(state.x.length, 3, `angle ${angle}: the scripted walker attached`);
    assert.equal(state.parent[2], 0, `angle ${angle}: parent is the lower id (x = ${lower.x}), not the other seed`);
  }
});

test("release points lie on the source geometry at the stated fractions", () => {
  const ellipse = { shape: "ellipse", x: 200, y: 300, width: 240, height: 100, angle: 30 } as const;
  for (let k = 0; k < 64; k++) {
    const [x, y] = colonyReleasePoint(ellipse, k / 64, 0.123);
    const c = Math.cos(-30 * Math.PI / 180), s = Math.sin(-30 * Math.PI / 180);
    const lx = (x - 200) * c - (y - 300) * s, ly = (x - 200) * s + (y - 300) * c;
    near((lx / 120) ** 2 + (ly / 50) ** 2, 1, 1e-12, "ellipse");
  }
  // Rectangle 200 × 100 (perimeter 600) turned 0°: fractions walk clockwise from the top-left corner.
  const rect = { shape: "rectangle", x: 100, y: 50, width: 200, height: 100, angle: 0 } as const;
  const at = (u: number) => colonyReleasePoint(rect, u, 0);
  assert.deepEqual(at(0), [0, 0]);
  assert.deepEqual(at(0.25), [150, 0]);
  assert.deepEqual(at(200 / 600), [200, 0]);
  assert.deepEqual(at(300 / 600), [200, 100]);
  assert.deepEqual(at(400 / 600), [100, 100]);
  near(at(500 / 600)[0], 0); near(at(500 / 600)[1], 100, 1e-9);
  near(at(550 / 600)[0], 0); near(at(550 / 600)[1], 50, 1e-9);
  // Line of length 300 turned 90°: it runs down the canvas through (x, y).
  const line = { shape: "line", x: 320, y: 320, width: 300, height: 0, angle: 90 } as const;
  const [top, mid, bottom] = [0, 0.5, 1 - 1e-12].map((u) => colonyReleasePoint(line, u, 0));
  near(top[0], 320, 1e-9); near(top[1], 170, 1e-9); near(mid[1], 320, 1e-9); near(bottom[1], 470, 1e-6);
  // Inside draws map the two uniforms onto the box.
  assert.deepEqual(colonyReleasePoint({ shape: "inside", x: 0, y: 0, width: 0, height: 0, angle: 0 }, 0.25, 0.75, { left: 100, top: 200, right: 300, bottom: 400 }), [150, 350]);
});

test("seed shapes place grains where their geometry says, and overlapping seeds are dropped in order", () => {
  const sim = colonySimulation(null);
  const seedsOf = (seeds: ColonyOptions["seeds"], walker = options().walker) => {
    const params = colonyParams(options({ seeds, walker }));
    const state = sim.initial({ params, seed: 9, step: 0, charge() {}, stream: () => { throw new Error("unexpected stream"); } } as SimulationContext<typeof params>);
    return state.x.map((x, i) => [x, state.y[i]] as const);
  };
  const ring = seedsOf({ shape: "ring", count: 8, x: 200, y: 200, width: 100, height: 100, angle: 0 });
  assert.equal(ring.length, 8);
  ring.forEach(([x, y], k) => { near(x, 200 + 50 * Math.cos(2 * Math.PI * k / 8), 1e-9); near(y, 200 + 50 * Math.sin(2 * Math.PI * k / 8), 1e-9); });
  const line = seedsOf({ shape: "line", count: 5, x: 300, y: 300, width: 200, height: 0, angle: 30 });
  line.forEach(([x, y], k) => {
    const along = (k / 4 - 0.5) * 200;
    near(x, 300 + along * Math.cos(Math.PI / 6), 1e-9); near(y, 300 + along * Math.sin(Math.PI / 6), 1e-9);
  });
  assert.deepEqual(seedsOf({ shape: "point", count: 40, x: 12, y: 34, width: 500, height: 500, angle: 45 }), [[12, 34]]);
  // 20 candidates 20/19 apart with radius 3 (half a contact = 3): the greedy rule keeps candidates 0, 3, 6, …, 18.
  assert.equal(seedsOf({ shape: "line", count: 20, x: 300, y: 300, width: 20, height: 0, angle: 0 }, { ...options().walker, radius: 3 }).length, 7);
});

/* ---------------------------------------------------------------------------------- stateful checks */

test("the model is a bounded, replayable simulation: replay, prefix, resume and spacing invariants hold", () => {
  const sim = colonySimulation(null);
  for (const [config, steps] of [[options(), 90], [withWalker({ bias: 0.3, stick: 0.4 }, { seeds: { shape: "scatter", count: 6, x: 320, y: 320, width: 200, height: 200, angle: 0 } }), 90]] as const)
    for (const seed of [3, 42]) checkSimulation(sim, colonyParams({ ...config, seed }), seed, steps);
  const domain = colonyDomain({ kind: "ring", x: 320, y: 320, width: 300, height: 300, hole: 0.4 });
  const walled = options({ domain: { kind: "ring", x: 320, y: 320, width: 300, height: 300, hole: 0.4 }, source: { shape: "inside", x: 0, y: 0, width: 0, height: 0, angle: 0 },
    seeds: { shape: "ring", count: 12, x: 320, y: 320, width: 250, height: 250, angle: 0 } });
  checkSimulation(colonySimulation(domain), colonyParams(walled), 42, 80);
});

test("more steps only append: earlier grains keep their ids, positions, parents and birth steps", () => {
  const short = growColony(options(), 300), long = growColony(options(), 900);
  assert.equal(short.snapshots.construction, long.snapshots.construction);
  const before = positions(short), after = positions(long);
  assert.ok(after.length > before.length + 50);
  assert.deepEqual(after.slice(0, before.length), before);
  assert.ok(short.sites.every((site) => site.born <= 300));
  assert.ok(long.sites.slice(short.sites.length).every((site) => site.born > 0));
  // And the other way round: fewer steps from the cached longer run equals a run from scratch.
  colonyCache.clear();
  const scratch = growColony(options(), 300);
  assert.deepEqual(positions(scratch), before);
});

test("a state replayed from a checkpoint equals a run stopped at that step", () => {
  const colony = growColony(options(), 700);
  const sim = colonySimulation(null), params = colonyParams(options());
  assert.ok(colony.snapshots.checkpointSteps.includes(250) && colony.snapshots.checkpointSteps.includes(500));
  for (const k of [1, 249, 251, 317, 500, 663]) {
    const replayed = stateAt(colony.snapshots, k);
    const scratch = finalState(runSimulation(sim, params, 42, { steps: k, checkpointEvery: 1000, historyEvery: 0 }));
    assert.ok(identical(replayed.x, scratch.x) && identical(replayed.y, scratch.y) && identical(replayed.parent, scratch.parent) && identical(replayed.born, scratch.born), `step ${k}`);
    assert.deepEqual(replayed.grid.entries(), scratch.grid.entries());
    assert.equal(replayed.released, k);
  }
});

test("cancellation leaves nothing cached and the retry equals an uninterrupted run", async () => {
  const config = options({}, 77);
  assert.equal(colonyIsCached(config, 500), false);
  let polls = 0;
  assert.equal(await prepareColony(config, 500, () => ++polls > 120), null);
  assert.ok(polls > 120);
  assert.equal(colonyIsCached(config, 500), false, "a cancelled run publishes nothing");
  const done = await prepareColony(config, 500, () => false);
  assert.ok(done && colonyIsCached(config, 500));
  colonyCache.clear();
  assert.deepEqual(positions(done), positions(growColony(config, 500)));
  // Through the instrument's own preparation.
  const input = instrument({ steps: 400 }, 78);
  assert.equal(canPrepareInstrument("aggregation-colonies"), true);
  const recipe = aggregationColoniesComposition(input);
  assert.equal(await prepareInstrument(input, () => true), false);
  assert.equal(colonyIsCached(recipe.options, recipe.steps), false);
  assert.equal(await prepareInstrument(input, () => false), true);
  assert.equal(colonyIsCached(recipe.options, recipe.steps), true);
  const size = colonyCache.size;
  const before = colonyOfRecipe(recipe);
  drawInstrument(new Recorder() as unknown as DrawingContext, input);
  assert.equal(colonyCache.size, size, "drawing after preparation adds no run");
  assert.equal(colonyOfRecipe(recipe), before);
});

test("appearance edits repaint the same snapshot and colony; construction edits compute a new one", () => {
  const base = recipeFor({ steps: 500 });
  const colony = colonyOfRecipe(base);
  const restyled = recipeFor({ steps: 500, mark: "rings", markSize: 1.6, tipMark: "rosette", halo: true, ink: "beads", inkWeight: 3, colorBy: "limb", bands: 6, taper: 0.1, reveal: 0.5, outline: false });
  assert.equal(colonyOfRecipe({ ...restyled, palette: [1, 2, 3] }), colony);
  assert.equal(colonyOfRecipe(restyled).snapshots, colony.snapshots);
  const view = base.view;
  assert.equal(colonyLinkPaths(colony, view), colonyLinkPaths(colonyOfRecipe(base), view), "derived lists are cached by colony and view");
  // Controls a selection hides never reach the construction: a source angle under "inside", a seed width under "point".
  const inside = recipeFor({ steps: 500, source: "inside" });
  assert.equal(colonyOfRecipe(recipeFor({ steps: 500, source: "inside", sourceAngle: 77, sourceWidth: 90, sourceX: 5 })), colonyOfRecipe(inside));
  assert.equal(colonyOfRecipe(recipeFor({ steps: 500, seedWidth: 300, seedCount: 30, seedAngle: 9 })), colony);
  // Meaningful initial-condition edits recompute (and really change the colony).
  const edits: Record<string, number | string> = { seedX: 300, source: "rectangle", sourceWidth: 500, radius: 3.5, stick: 0.8, bias: 0.05, pull: 0.05, turn: 120, reach: 30,
    lifetime: 2000, patience: 70, escape: 50, seedShape: "ring", domain: "ellipse" };
  for (const [key, value] of Object.entries(edits)) {
    const edited = colonyOfRecipe(recipeFor({ steps: 500, [key]: value }));
    assert.notEqual(edited.snapshots, colony.snapshots, key);
    // A limit that no walker reaches (lifetime, patience) recomputes but draws the same colony; the others reshape it.
    if (key !== "lifetime" && key !== "patience") assert.notDeepEqual(positions(edited), positions(colony), key);
  }
  // Limits show once they bind: short lifetimes time walkers out, and patience is the count of failures that stalls.
  const closeSource = { source: { shape: "ellipse", x: 320, y: 320, width: 200, height: 200, angle: 0 } } as const;
  const short = growColony(withGrowth({ lifetime: 20 }, closeSource), 400), shorter = growColony(withGrowth({ lifetime: 30 }, closeSource), 400);
  assert.notDeepEqual(positions(short), positions(shorter));
  assert.ok(short.counts.timedOut > shorter.counts.timedOut);
  const jam = (patience: number) => growColony(options({ source: { shape: "ellipse", x: 320, y: 320, width: 8, height: 8, angle: 0 }, growth: { reach: 40, lifetime: 500, patience, escape: 60 } }), 100);
  assert.equal(jam(5).stalledAt, 5); assert.equal(jam(6).stalledAt, 6);
  assert.notDeepEqual(positions(colonyOfRecipe(recipeFor({ steps: 500 }, 43))), positions(colony), "a new seed is a new colony");
});

test("equal domain content shares a run and an edited vertex recomputes", () => {
  const square = (right: number): PlanarDomain => planarDomain({ outer: [[200, 200], [right, 200], [right, 440], [200, 440]] });
  const config = (domain: PlanarDomain): ColonyOptions => options({ domain: { kind: "domain", domain }, source: { shape: "inside", x: 0, y: 0, width: 0, height: 0, angle: 0 },
    seeds: { shape: "point", count: 1, x: 300, y: 320, width: 0, height: 0, angle: 0 } });
  const a = growColony(config(square(440)), 300), b = growColony(config(square(440)), 300), c = growColony(config(square(441)), 300);
  assert.equal(a.snapshots, b.snapshots);
  assert.notEqual(a.snapshots, c.snapshots);
});

/* -------------------------------------------------------------------------------------- termination */

test("a full domain stalls explicitly, stays as it is, and holds no more grains than packing allows", () => {
  const box = options({ domain: { kind: "rectangle", x: 320, y: 320, width: 60, height: 60 }, source: { shape: "inside", x: 0, y: 0, width: 0, height: 0, angle: 0 },
    growth: { reach: 40, lifetime: 800, patience: 30, escape: 60 } });
  const first = growColony(box, 2000), later = growColony(box, 4000);
  assert.equal(first.status, "stalled");
  assert.ok(first.stalledAt !== null && first.stalledAt < 2000, `stalled at ${first.stalledAt}`);
  assert.deepEqual(positions(later), positions(first));
  assert.equal(later.stalledAt, first.stalledAt);
  assert.equal(later.counts.released, first.counts.released, "no walker is released after the stall");
  // Disks of radius contact/4 = 3 around the grain centres are disjoint and lie inside the centre square grown by 3: at most (54 + 6)² / (π 3²) grains.
  assert.ok(attached(first) + 1 <= Math.floor(60 * 60 / (Math.PI * 9)), `${attached(first) + 1} grains`);
  assert.ok(attached(first) >= 20, `only ${attached(first)} grains`);
});

test("an empty result is a valid stalled colony, not an error or a fallback picture", () => {
  const empty = growColony(options({ domain: { kind: "ellipse", x: 100, y: 100, width: 60, height: 60 } }), 200);
  assert.equal(empty.sites.length, 0);
  assert.equal(empty.status, "stalled"); assert.equal(empty.stalledAt, 0);
  assert.equal(empty.graph.nodes.length, 0); assert.equal(empty.bounds, null);
  assert.equal(empty.counts.released, 0);
  const surface = new Recorder();
  drawAggregationColonies(surface, { ...recipeFor({ steps: 200 }), options: options({ domain: { kind: "ellipse", x: 100, y: 100, width: 60, height: 60 } }) });
  assert.equal(surface.count("circle"), 0);
  assert.equal(growColony(options(), 0).sites.length, 1, "zero steps is the seeds alone");
});

test("a colony with no live walkers stalls after exactly the patience it was given", () => {
  // A source too small to release anything: every point falls inside the seed's contact circle.
  const jammed = options({ source: { shape: "ellipse", x: 320, y: 320, width: 8, height: 8, angle: 0 }, growth: { reach: 40, lifetime: 500, patience: 17, escape: 60 } });
  const colony = growColony(jammed, 500);
  assert.equal(colony.status, "stalled");
  assert.equal(colony.stalledAt, 17);
  assert.equal(colony.counts.unlaunched, 17);
  assert.equal(attached(colony), 0);
});

test("every limit names the control to change and nothing is truncated", () => {
  assert.throws(() => growColony(options(), COLONY_LIMITS.maxSteps + 1), /Growth steps/);
  assert.throws(() => growColony(withGrowth({ lifetime: 6000 }), 12000), (e: Error) => /Growth steps 12000/.test(e.message) && /Walker lifetime 6000/.test(e.message) && /Lower Growth steps or Walker lifetime/.test(e.message));
  assert.equal(colonyWorkBound(12000, 6000), 12000 * (6000 + COLONY_LIMITS.launchTries + 1));
  assert.throws(() => growColony(withWalker({ stick: 0 }), 10), /Sticking probability/);
  assert.throws(() => growColony(withWalker({ radius: 6 }, { growth: { reach: 2, lifetime: 100, patience: 5, escape: 5 } }), 10), /Step reach/);
  assert.throws(() => growColony(withWalker({ bias: 0.95 }), 10), /Wind/);
  assert.throws(() => growColony(options({ seeds: { ...options().seeds, count: 401 } }), 10), /Seed grains/);
  assert.throws(() => growColony(withGrowth({ patience: 0 }), 10), /Give up after/);
  assert.throws(() => recipeFor({ steps: 12000, lifetime: 6000 }), /Walker lifetime/);
  assert.throws(() => recipeFor({ radius: 8, reach: 2 }), /Step reach/);
  assert.throws(() => recipeFor({ steps: 13000 }), /between 0 and 12000/);
  // The step limit itself runs, within the state bounds, at the maximum (short lifetimes keep the test quick).
  const big = growColony(withGrowth({ lifetime: 30 }, { source: { shape: "ellipse", x: 320, y: 320, width: 200, height: 200, angle: 0 }, seeds: { shape: "ring", count: 400, x: 320, y: 320, width: 500, height: 500, angle: 0 } }), COLONY_LIMITS.maxSteps);
  assert.ok(big.sites.length <= COLONY_LIMITS.maxSteps + COLONY_LIMITS.maxSeeds);
  assert.ok(colonyCache.storedValues <= 8_000_000);
});

/* ---------------------------------------------------------------------------- the structure that grows */

test("wind carries walkers onto the side they arrive from, and stickiness decides how many attach", () => {
  const vertical = (wind: number, angle: number): ColonyOptions => withWalker({ bias: wind, biasAngle: angle }, {
    seeds: { shape: "line", count: 30, x: 420, y: 320, width: 480, height: 0, angle: 90 },
    source: { shape: "line", x: 200, y: 320, width: 480, height: 0, angle: 90 } });
  const toward = growColony(vertical(0.3, 0), 900), none = growColony(vertical(0, 0), 900), away = growColony(vertical(0.3, 180), 900);
  assert.ok(attached(toward) > attached(none) && attached(none) > attached(away), `${attached(toward)} > ${attached(none)} > ${attached(away)}`);
  assert.ok(attached(toward) > 3 * attached(away), "a wind blowing away from the seeds starves them");
  // Grains pile up between the source (x = 200) and the seeds (x = 420).
  const mean = (c: Colony) => c.sites.slice(c.counts.seeds).reduce((s, site) => s + site.position[0], 0) / attached(c);
  assert.ok(mean(toward) < 420 && mean(toward) > 200);
  const sticky = growColony(options(), 1200), slippery = growColony(withWalker({ stick: 0.05 }), 1200);
  assert.ok(attached(slippery) < attached(sticky) * 0.8, `${attached(slippery)} vs ${attached(sticky)}`);
});

test("the parent graph is a directed forest whose weights and ages follow the tree", () => {
  const colony = growColony(options({ seeds: { shape: "ring", count: 5, x: 320, y: 320, width: 120, height: 120, angle: 0 } }), 600);
  const { graph } = colony;
  assert.equal(graph.nodes.length, colony.sites.length);
  assert.equal(graph.edges.length, attached(colony));
  assert.equal(graph.directed, true);
  const incoming = new Map(graph.edges.map((edge) => [edge.to, edge] as const));
  const outgoing = new Map<string, number>();
  for (const edge of graph.edges) outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + edge.weight);
  for (const site of colony.sites) {
    const edge = incoming.get(site.id);
    if (site.parent < 0) { assert.equal(edge, undefined); if (site.children > 0) near(outgoing.get(site.id)!, 1, 1e-12, "a root hands out its whole tree"); continue; }
    assert.equal(edge!.from, `grain:${site.parent}`);
    assert.equal(edge!.id, `e:grain:${site.parent}|${site.id}`);
    assert.equal(edge!.age, 600 - site.born + 1);
    assert.ok(edge!.weight > 0 && edge!.weight <= 1);
    if (site.children > 0) near(outgoing.get(site.id)!, edge!.weight, 1e-12, "weight is conserved through a fork");
    else near(edge!.weight, 1 / [...colony.sites].filter((other) => other.root === site.root && other.tip).length, 1e-12, "a tip carries one share of its tree's tips");
  }
  assert.equal(graph.stats.maxAge, Math.max(...graph.edges.map((edge) => edge.age)));
  // Subtree masses: a grain's mass is one plus its children's.
  const masses = new Map(colony.sites.map((site) => [site.index, site.mass]));
  for (const site of colony.sites) assert.equal(site.mass, 1 + colony.sites.filter((other) => other.parent === site.index).reduce((sum, child) => sum + masses.get(child.index)!, 0));
  assert.equal(colony.maxMass, Math.max(...colony.sites.filter((site) => site.parent < 0).map((site) => site.mass)));
});

/* --------------------------------------------------------------------------------------- the walls */

test("grains stay inside the domain and a radius clear of every wall, holes included", () => {
  const specs = [
    options({ domain: { kind: "ring", x: 320, y: 320, width: 420, height: 420, hole: 0.5 }, source: { shape: "inside", x: 0, y: 0, width: 0, height: 0, angle: 0 },
      seeds: { shape: "ring", count: 10, x: 320, y: 320, width: 320, height: 320, angle: 0 }, growth: { reach: 40, lifetime: 1200, patience: 80, escape: 60 } }),
    options({ domain: { kind: "letters", text: "R", x: 320, y: 320, width: 420, height: 420 }, source: { shape: "inside", x: 0, y: 0, width: 0, height: 0, angle: 0 },
      seeds: { shape: "scatter", count: 8, x: 320, y: 320, width: 260, height: 260, angle: 0 }, growth: { reach: 40, lifetime: 1200, patience: 80, escape: 60 } }),
  ];
  for (const config of specs) {
    const colony = growColony(config, 900);
    assert.ok(attached(colony) > 100);
    const domain = colony.domain!, radius = config.walker.radius;
    const edges = wallEdges(domainRings(domain));
    for (const site of colony.sites) {
      assert.equal(locateInDomain(domain, site.position[0], site.position[1]), "inside", site.id);
      for (const [a, b] of edges) assert.ok(pointSegment(site.position[0], site.position[1], a[0], a[1], b[0], b[1]) >= radius - 1e-9, `${site.id} within a radius of a wall`);
      if (site.parent >= 0) {
        const parent = colony.sites[site.parent];
        for (const [a, b] of edges) assert.ok(segmentDistance(parent.position, site.position, a, b) >= radius - 1e-9, `link into ${site.id} comes within a radius of a wall`);
      }
    }
  }
});

test("a region of the domain that holds no seed stays empty and costs no walkers", () => {
  const left = { id: "left", bounds: [160, 200, 300, 440] as [number, number, number, number] }, right = { id: "right", bounds: [340, 200, 480, 440] as [number, number, number, number] };
  const domain = rectangleDomain([left, right]);
  const config = options({ domain: { kind: "domain", domain }, source: { shape: "inside", x: 0, y: 0, width: 0, height: 0, angle: 0 },
    seeds: { shape: "point", count: 1, x: 230, y: 320, width: 0, height: 0, angle: 0 }, growth: { reach: 40, lifetime: 3000, patience: 200, escape: 60 } });
  const one = growColony(config, 500);
  assert.ok(attached(one) > 60);
  assert.ok(one.sites.every((site) => site.position[0] < 300), "nothing grows across the gap");
  assert.ok(one.counts.timedOut <= 0.05 * one.counts.released, `${one.counts.timedOut} of ${one.counts.released} walkers wandered the seedless region`);
  const both = growColony({ ...config, seeds: { shape: "line", count: 2, x: 320, y: 320, width: 180, height: 0, angle: 0 } }, 500);
  assert.ok(both.sites.some((site) => site.position[0] > 340) && both.sites.some((site) => site.position[0] < 300), "with a seed in each region both grow");
});

/* ----------------------------------------------------------------------------- the treatments */

test("every treatment reads the same colony: links partition the parent edges, marks and tips follow the grains", () => {
  const colony = growColony(options({ seeds: { shape: "ring", count: 4, x: 320, y: 320, width: 100, height: 100, angle: 0 } }), 800);
  for (const view of [{ reveal: 1, colorBy: "age", bands: 4, taper: 0.6 }, { reveal: 0.4, colorBy: "limb", bands: 5, taper: 0 }, { reveal: 0.75, colorBy: "depth", bands: 3, taper: 1 }] as const) {
    const shown = shownGrains(colony, view.reveal);
    assert.equal(shown, colony.sites.filter((site) => site.born <= Math.round(view.reveal * 800)).length);
    assert.ok(colony.sites.slice(0, shown).every((site) => site.born <= Math.round(view.reveal * 800)), "reveal is a birth-order prefix");
    const layers = colonyLinkPaths(colony, view);
    const seen = new Map<string, number>();
    let segments = 0;
    for (const layer of layers) for (const path of layer.paths) {
      assert.equal(path.closed, false); assert.ok(path.points.length >= 2);
      for (let i = 1; i < path.points.length; i++) {
        const key = `${path.points[i - 1]}>${path.points[i]}`;
        seen.set(key, (seen.get(key) ?? 0) + 1); segments++;
      }
    }
    const expected = colony.sites.slice(0, shown).filter((site) => site.parent >= 0);
    assert.equal(segments, expected.length);
    for (const site of expected) assert.equal(seen.get(`${colony.sites[site.parent].position}>${site.position}`), 1, `${site.id} is drawn exactly once`);
    const marks = colonyMarkSites(colony, view);
    assert.equal(marks.length, shown);
    marks.forEach((mark, i) => {
      assert.equal(mark.id, colony.sites[i].id);
      assert.equal(mark.tone, colonyTone(colony, colony.sites[i], view.colorBy, view.bands));
      assert.ok(mark.scale! >= 1 - view.taper - 1e-12 && mark.scale! <= 1 + 1e-12);
    });
    const kids = new Map<number, number>();
    for (const site of colony.sites.slice(0, shown)) if (site.parent >= 0) kids.set(site.parent, (kids.get(site.parent) ?? 0) + 1);
    const tips = colony.sites.slice(0, shown).filter((site) => site.parent >= 0 && !kids.has(site.index));
    assert.deepEqual(colonyTipSites(colony, view).map((site) => site.id), tips.map((site) => site.id));
  }
  // Colour bands: age splits `born / steps` evenly, so the last grain is in the last band and seeds in the first.
  const last = colony.sites[colony.sites.length - 1];
  assert.equal(colonyTone(colony, colony.sites[0], "age", 4), 0);
  assert.equal(colonyTone(colony, last, "age", 4), Math.min(3, Math.floor(last.born / 800 * 4)));
  assert.equal(colonyTone(colony, last, "flat", 4), 0);
});

test("drawing spends one mark per grain, one stroke per link chain and one tip mark per tip, from the one colony", () => {
  const plain = { mark: "dot", markSize: 1, ink: "none", tipMark: "none", halo: false, outline: false, steps: 500 };
  const colony = colonyOfRecipe(recipeFor(plain));
  assert.equal(drawn(plain).count("circle"), colony.sites.length);
  const inked = drawn({ ...plain, mark: "none", ink: "line" });
  const chains = colonyLinkPaths(colony, recipeFor(plain).view).reduce((sum, layer) => sum + layer.paths.length, 0);
  assert.equal(inked.count("endShape"), chains);
  assert.equal(inked.count("vertex"), attached(colony) + chains);
  assert.equal(inked.count("circle"), 0);
  const tips = colonyTipSites(colony, recipeFor(plain).view).length;
  assert.equal(drawn({ ...plain, mark: "none", tipMark: "dot" }).count("circle"), tips);
  assert.ok(tips > 10 && tips < colony.sites.length);
  const halo = drawn({ ...plain, mark: "none", halo: true, haloStrength: 0.08 });
  assert.equal(halo.count("circle"), colony.sites.length);
  assert.ok(halo.ops.some((op) => op.startsWith(`fill(`) && op.endsWith(`,${Number((225 * 0.08).toFixed(9))})`)), "the halo is drawn at strength × the dot alpha");
  // Nothing paints a background or leaves state behind: every push is popped.
  assert.equal(inked.count("push"), inked.count("pop"));
  assert.equal(drawn({ ...plain, mark: "none", ink: "none" }).count("rect"), 0);
});

test("the outline draws the domain's rings once each, and only with a domain", () => {
  const withDomain = { steps: 200, mark: "none", ink: "none", domain: "ring", outline: true, seedShape: "ring", seedCount: 6, seedWidth: 250, seedHeight: 250, source: "inside", domainWidth: 400, domainHeight: 400, domainHole: 0.3 };
  assert.equal(drawn(withDomain).count("endShape"), 2);
  assert.equal(drawn({ ...withDomain, outline: false }).count("endShape"), 0);
  assert.equal(drawn({ steps: 200, mark: "none", ink: "none", outline: true }).count("endShape"), 0);
});

test("swapping any consumer leaves the colony and its lists untouched", () => {
  const recipe = recipeFor({ steps: 400 });
  const colony = colonyOfRecipe(recipe);
  const lists = [colonyMarkSites(colony, recipe.view), colonyTipSites(colony, recipe.view), colonyLinkPaths(colony, recipe.view)];
  const surface = new Recorder();
  const marked: string[] = [];
  drawAggregationColonies(surface, { ...recipe, tips: { ...recipe.marks!, size: 2 } }, {
    mark: (_s, site) => { marked.push(site.id); }, tip: () => {}, link: () => {}, halo: () => {} });
  assert.equal(marked.length, colony.sites.length);
  assert.equal(colonyOfRecipe(recipe), colony);
  assert.deepEqual([colonyMarkSites(colony, recipe.view), colonyTipSites(colony, recipe.view), colonyLinkPaths(colony, recipe.view)], lists);
});

/* ------------------------------------------------------------------------------- the definition */

test("hidden controls never change the drawing", () => {
  const parameters = definitions.find((item) => item.id === "aggregation-colonies")!.parameters;
  const configs: Record<string, number | string | boolean>[] = [
    { steps: 500 },
    { steps: 500, source: "inside", seedShape: "line", mark: "none", ink: "none", colorBy: "flat" },
    { steps: 500, source: "rectangle", seedShape: "scatter", domain: "letters", domainWord: "R", mark: "rings", tipMark: "dot", ink: "stitch", halo: true, colorBy: "limb" },
    { steps: 500, source: "line", seedShape: "ring", domain: "image", domainImage: "geometry", domainThreshold: 0.5, ink: "beads", outline: true, colorBy: "depth" },
    { steps: 500, domain: "ring", source: "inside", seedShape: "ring", seedWidth: 380, seedHeight: 380, outline: false, tipMark: "arrow", ink: "line" },
  ];
  let checked = 0;
  for (const config of configs) {
    const values = { ...instrument(config).params };
    const shown = new Set(visibleParameters("aggregation-colonies", values).map((p) => p.key));
    const base = drawn(values).ops.join("|");
    for (const parameter of parameters.filter((p) => !shown.has(p.key))) {
      const original = values[parameter.key];
      const alternatives: (number | string | boolean)[] = parameter.type === "boolean" ? [!original]
        : parameter.type === "select" ? parameter.options!.map((o) => o.value).filter((v) => v !== original).slice(0, 2)
        : [parameter.min! + (parameter.max! - parameter.min!) * 0.3, parameter.min! + (parameter.max! - parameter.min!) * 0.8]
          .map((v) => (parameter.integer ? Math.round(v) : v)).filter((v) => v !== original);
      for (const value of alternatives) {
        assert.equal(drawn({ ...values, [parameter.key]: value }).ops.join("|"), base, `${parameter.key} changed the drawing while hidden (${JSON.stringify(config)})`);
        checked++;
      }
    }
  }
  assert.ok(checked > 120, `only ${checked} hidden-control changes were exercised`);
});

test("the authored defaults grow a colony that has not yet reached its source", () => {
  const colony = colonyOfRecipe(recipeFor());
  assert.equal(colony.status, "growing");
  assert.ok(colony.sites.length > 800 && colony.sites.length < 2600, `${colony.sites.length} grains at the defaults`);
  assert.ok(colony.maxDepth > 20);
  assert.ok(colonyTipSites(colony, recipeFor().view).length > 100);
});
