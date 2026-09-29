/**
 * Stateful snapshots (roadmap foundation F7): bounded, deterministic, stepped simulations whose
 * published results are frozen values that a drawing only reads. See `docs/composition-snapshots.md`.
 *
 * A `Simulation` states its initial condition, one fixed-order step, and its declared bounds. Running it
 * yields `Snapshots`: retained checkpoints (private copies, read back by copy), a frozen history of a
 * chosen projection, and a content key made only from construction (simulation id, parameters, seed,
 * steps, retention). Appearance never enters the key, so recolouring reuses the same object.
 *
 * Guarantees, all covered by tests and checkable for a new simulation with `checkSimulation`:
 * the same construction gives bit-identical snapshots; checkpoint spacing and cancellation timing change
 * nothing; more steps only append; a resumed run equals a run from scratch.
 */
import { componentSeed } from "./core.js";
import type { CompositionRun } from "./types.js";
import { canonicalKey, cloneState, countValues, freezeCopy, identical, SeededStream, type Frozen } from "./snapshot-values.js";

export { SeededStream, cloneState, countValues, freezeCopy, identical, canonicalKey };
export type { Frozen };

/** Limits a simulation declares for one parameter set. Both are enforced, not advisory. */
export interface SimulationLimits {
  /** Most steps this construction may run (a hard bound of the model, e.g. cells or ticks it can afford). */
  readonly stepLimit: number;
  /** Most work units one step may charge with `ctx.charge`; the runner multiplies it by `steps` up front. */
  readonly workPerStep: number;
  /** Work units `initial` may charge (default `workPerStep`). */
  readonly initialWork?: number;
}

/** What `initial` and `step` receive. Everything a step may depend on is here or in the state. */
export interface SimulationContext<Params> {
  readonly params: Readonly<Params>;
  readonly seed: number;
  /** 0 while building the initial state; k (1-based) while computing the state after k steps. */
  readonly step: number;
  /**
   * Independent stream for one element and purpose at this step (or the initial state). Derived from
   * (seed, step, element id, purpose) only, so it does not depend on iteration order, on which other
   * elements exist, or on how many draws any other element made. Needs a uint32 seed.
   */
  stream(elementId: string, purpose?: string): SeededStream;
  /** Declare work done; throws when the step exceeds `limits().workPerStep`. */
  charge(units: number): void;
}

/**
 * A bounded deterministic stepped model.
 *
 * `step` may mutate its input and return it, or return a new state; the runner never hands the live state
 * to anyone (checkpoints and projections are copies). It must not read clocks, `Math.random`, module
 * mutable state or anything not in `params`, `seed`, its state and `ctx`; it must visit elements in a
 * fixed order, and elements must carry ids allocated from a counter stored in the state (see
 * `elementId`), never derived from array position.
 */
export interface Simulation<State, Params, Projection = undefined> {
  /** Stable name; part of every key and of every stream derivation. */
  readonly id: string;
  limits(params: Readonly<Params>): SimulationLimits;
  initial(ctx: SimulationContext<Params>): State;
  step(state: State, ctx: SimulationContext<Params>): State;
  /**
   * What to retain per step (plain arrays, objects, typed arrays; copied and frozen). A pure function of
   * `(state, step)`, never of anything about the run. Omit for a simulation with no history.
   */
  project?(state: State, step: number): Projection;
  /** Checkpoint copy. Default `cloneState`, which handles plain data, typed arrays, Map/Set and `clone()`. */
  copy?(state: State): State;
  /** Stored-value count of a state, for the memory bounds. Default `countValues`. */
  size?(state: State): number;
}

export interface HistoryEntry<Projection> { readonly step: number; readonly value: Frozen<Projection> }

/** Published result. Frozen; states are held privately and read back by copy (`stateAt`). */
export interface Snapshots<State, Params, Projection = undefined> {
  /** Construction identity: simulation id, parameters, seed, steps and retention (never appearance). */
  readonly key: string;
  /** `key` without the step count: runs with equal construction and different steps share it. */
  readonly construction: string;
  readonly simulation: Simulation<State, Params, Projection>;
  readonly params: Frozen<Params>;
  readonly seed: number;
  readonly steps: number;
  readonly checkpointEvery: number;
  readonly historyEvery: number;
  /** Steps whose state is retained, ascending: 0, multiples of `checkpointEvery`, and `steps`. */
  readonly checkpointSteps: readonly number[];
  /** Retained projections, ascending by step: 0, multiples of `historyEvery`, and `steps`. */
  readonly history: readonly HistoryEntry<Projection>[];
  /** The projection at `steps`; undefined when the simulation has no `project`. */
  readonly final: Frozen<Projection>;
  /** Work units charged in total (initial state and every step). */
  readonly work: number;
  /** Values held by checkpoints and history, which the cache uses as its memory measure. */
  readonly storedValues: number;
}

/** Thrown when `cancelled()` (or a composition run) says stop; nothing is published or cached. */
export class SimulationCancelledError extends Error {
  constructor() { super("simulation cancelled"); this.name = "SimulationCancelledError"; }
}

export const SNAPSHOT_LIMITS = Object.freeze({
  /** Hard cap on `steps` regardless of the simulation's own `stepLimit`. */
  maxSteps: 1_000_000,
  defaultCheckpointEvery: 50,
  defaultMaxWork: 50_000_000,
  defaultMaxStateValues: 1_000_000,
  defaultMaxCheckpointValues: 4_000_000,
  defaultMaxHistoryValues: 4_000_000,
  defaultCacheEntries: 8,
  defaultCacheValues: 8_000_000,
  defaultTimeSliceMs: 8,
});

export interface RunOptions {
  /** Steps to run from the initial state. */
  steps: number;
  /** Retain a state every this many steps (plus 0 and the last); 0 keeps only those two. Default 50. */
  checkpointEvery?: number;
  /** Retain a projection every this many steps (plus 0 and the last); 0 keeps only those two. Default 1. */
  historyEvery?: number;
  maxWork?: number;
  maxStateValues?: number;
  maxCheckpointValues?: number;
  maxHistoryValues?: number;
  /** Checked before every step (and before the initial state); true stops with `SimulationCancelledError`. */
  cancelled?: () => boolean;
  /** Shared composition run: cancellation is honoured and `steps` (one per step, at least 1) is charged to it. */
  run?: CompositionRun;
  /** An earlier result of the same construction: extended when it has fewer steps, otherwise replayed from its nearest retained checkpoint. */
  from?: Snapshots<any, any, any>;
}

export interface AsyncRunOptions extends RunOptions {
  /** Longest stretch of steps between yields to the host. Default 8 ms. */
  timeSliceMs?: number;
  /** Clock and yield are injectable so cancellation tests need no real timers. */
  now?: () => number;
  yieldToHost?: () => Promise<void>;
}

/** Element id from a birth-order serial kept in the state, e.g. `elementId("agent", 12)` → `agent:12`. */
export function elementId(kind: string, serial: number): string {
  if (kind.length === 0 || kind.includes(":")) throw new Error("Element kind must be a non-empty string without ':'");
  if (!Number.isSafeInteger(serial) || serial < 0) throw new Error("Element serial must be a nonnegative safe integer");
  return `${kind}:${serial}`;
}

/* ---------------------------------------------------------------------------------------- store */

/** A retained state and the work charged to reach it (a resumed run continues the count). */
interface Retained<State> { readonly step: number; readonly state: State; readonly work: number }
interface Store<State, Params, Projection> {
  readonly sim: Simulation<State, Params, Projection>;
  readonly params: Params;
  readonly checkpoints: readonly Retained<State>[];
}
const stores = new WeakMap<object, Store<any, any, any>>();

const storeOf = <S, P, Pr>(snaps: Snapshots<S, P, Pr>): Store<S, P, Pr> => {
  const store = stores.get(snaps);
  if (!store) throw new Error("Not a Snapshots value produced by runSimulation");
  return store;
};

function integerOption(name: string, value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max} (got ${String(value)})`);
  return value;
}

interface Resolved {
  steps: number; checkpointEvery: number; historyEvery: number;
  maxWork: number; maxStateValues: number; maxCheckpointValues: number; maxHistoryValues: number;
}
function resolveOptions(options: RunOptions): Resolved {
  const number = (name: string, value: number | undefined, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER) =>
    integerOption(name, value ?? fallback, min, max);
  return {
    steps: integerOption("steps", options.steps, 0, SNAPSHOT_LIMITS.maxSteps),
    checkpointEvery: number("checkpointEvery", options.checkpointEvery, SNAPSHOT_LIMITS.defaultCheckpointEvery, 0),
    historyEvery: number("historyEvery", options.historyEvery, 1, 0),
    maxWork: number("maxWork", options.maxWork, SNAPSHOT_LIMITS.defaultMaxWork, 0),
    maxStateValues: number("maxStateValues", options.maxStateValues, SNAPSHOT_LIMITS.defaultMaxStateValues, 1),
    maxCheckpointValues: number("maxCheckpointValues", options.maxCheckpointValues, SNAPSHOT_LIMITS.defaultMaxCheckpointValues, 1),
    maxHistoryValues: number("maxHistoryValues", options.maxHistoryValues, SNAPSHOT_LIMITS.defaultMaxHistoryValues, 1),
  };
}

const retainedAt = (step: number, every: number, last: number): boolean => step === 0 || step === last || (every > 0 && step % every === 0);

function contextFor<Params>(sim: { id: string }, params: Params, seed: number, step: number, budget: number, used: { units: number }): SimulationContext<Params> {
  return {
    params: params as Readonly<Params>, seed, step,
    stream: (elementId, purpose = "") => new SeededStream(componentSeed(seed, elementId, `${sim.id}|${step}|${purpose}`)),
    charge(units) {
      if (!Number.isFinite(units) || units < 0) throw new Error(`${sim.id}: charge() needs a nonnegative finite number`);
      used.units += units;
      if (used.units > budget)
        throw new Error(`${sim.id}: ${step === 0 ? "the initial state" : `step ${step}`} charged ${used.units} work units, above the declared ${step === 0 ? "initialWork" : "workPerStep"} (${budget}); raise it in limits() or bound the work`);
    },
  };
}

/** The stepping machine the sync and async entry points share. */
class Runner<State, Params, Projection> {
  private state!: State;
  private at!: number;
  private work!: number;
  private readonly checkpoints: Retained<State>[] = [];
  private readonly history: HistoryEntry<Projection>[] = [];
  private checkpointValues = 0;
  private historyValues = 0;
  private entered = false;
  private readonly limits: SimulationLimits;
  private readonly copy: (state: State) => State;
  private readonly size: (state: State) => number;

  constructor(
    private readonly sim: Simulation<State, Params, Projection>,
    private readonly params: Params,
    private readonly seed: number,
    private readonly o: Resolved,
    private readonly cancelled: (() => boolean) | undefined,
    private readonly run: CompositionRun | undefined,
    from: Snapshots<State, Params, Projection> | undefined,
    readonly construction: string,
  ) {
    this.limits = sim.limits(params);
    const stepLimit = integerOption(`${sim.id} limits().stepLimit`, this.limits.stepLimit, 0, SNAPSHOT_LIMITS.maxSteps);
    if (!Number.isFinite(this.limits.workPerStep) || this.limits.workPerStep < 0) throw new Error(`${sim.id} limits().workPerStep must be a nonnegative finite number`);
    if (o.steps > stepLimit) throw new Error(`steps (${o.steps}) exceeds the ${sim.id} stepLimit (${stepLimit}) for these parameters; lower steps`);
    const initialWork = this.limits.initialWork ?? this.limits.workPerStep;
    const bound = initialWork + o.steps * this.limits.workPerStep;
    if (bound > o.maxWork)
      throw new Error(`steps × workPerStep + initialWork = ${bound} for ${sim.id} exceeds maxWork (${o.maxWork}); lower steps or the model's size, or raise maxWork`);
    this.copy = sim.copy ?? ((state) => cloneState(state));
    this.size = sim.size ?? ((state) => countValues(state));
    this.check();
    if (run) { run.enter(Math.max(1, o.steps)); this.entered = true; }
    try {
      if (from) {
        const store = storeOf(from);
        // Continue from the latest retained state not beyond the target: the earlier last step when this
        // extends it, or an earlier checkpoint when the earlier run went further. Keep what the new schedule
        // retains up to there (an earlier last step is dropped unless scheduled, so the result equals a run
        // from scratch); everything after is recomputed.
        let last = store.checkpoints[0];
        for (const kept of store.checkpoints) if (kept.step <= o.steps) last = kept;
        for (const kept of store.checkpoints) if (kept.step <= last.step && retainedAt(kept.step, o.checkpointEvery, o.steps)) this.checkpoints.push(kept);
        for (const entry of from.history) if (entry.step <= last.step && retainedAt(entry.step, o.historyEvery, o.steps)) this.history.push(entry);
        this.checkpointValues = this.checkpoints.reduce((sum, kept) => sum + this.size(kept.state), 0);
        this.historyValues = this.history.reduce((sum, entry) => sum + countValues(entry.value), 0);
        this.state = this.copy(last.state);
        this.at = last.step;
        this.work = last.work;
        this.capture(this.at, true);
      } else {
        const used = { units: 0 };
        this.state = sim.initial(contextFor(sim, params, seed, 0, initialWork, used));
        this.at = 0;
        this.work = used.units;
        this.boundState(this.state, "initial state");
        this.capture(0, true);
      }
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  get done(): boolean { return this.at >= this.o.steps; }

  private check(): void {
    if (this.cancelled?.()) throw new SimulationCancelledError();
    if (this.run) {
      try { this.run.check(); } catch { throw new SimulationCancelledError(); }
    }
  }

  private boundState(state: State, what: string): number {
    const size = this.size(state);
    if (size > this.o.maxStateValues)
      throw new Error(`${this.sim.id} ${what} holds ${size} values, above maxStateValues (${this.o.maxStateValues}); shrink the model or raise maxStateValues`);
    return size;
  }

  /** Retain state and/or projection at `step` when the schedule (or a forced final) says so. */
  private capture(step: number, keep: boolean): void {
    const wantsState = keep && retainedAt(step, this.o.checkpointEvery, this.o.steps);
    const wantsHistory = keep && this.sim.project !== undefined && retainedAt(step, this.o.historyEvery, this.o.steps);
    if (wantsState && !(this.checkpoints.length > 0 && this.checkpoints[this.checkpoints.length - 1].step >= step)) {
      const size = this.boundState(this.state, `state at step ${step}`);
      this.checkpointValues += size;
      if (this.checkpointValues > this.o.maxCheckpointValues)
        throw new Error(`${this.sim.id} checkpoints hold ${this.checkpointValues} values by step ${step}, above maxCheckpointValues (${this.o.maxCheckpointValues}); raise checkpointEvery (now ${this.o.checkpointEvery}), lower steps, or raise maxCheckpointValues`);
      this.checkpoints.push({ step, state: this.copy(this.state), work: this.work });
    }
    if (wantsHistory && !(this.history.length > 0 && this.history[this.history.length - 1].step >= step)) {
      const value = freezeCopy(this.sim.project!(this.state, step), `${this.sim.id} projection at step ${step}`) as Frozen<Projection>;
      this.historyValues += countValues(value);
      if (this.historyValues > this.o.maxHistoryValues)
        throw new Error(`${this.sim.id} history holds ${this.historyValues} values by step ${step}, above maxHistoryValues (${this.o.maxHistoryValues}); raise historyEvery (now ${this.o.historyEvery}), lower steps, or raise maxHistoryValues`);
      this.history.push(Object.freeze({ step, value }));
    }
  }

  advance(): void {
    this.check();
    const step = this.at + 1;
    const used = { units: 0 };
    this.state = this.sim.step(this.state, contextFor(this.sim, this.params, this.seed, step, this.limits.workPerStep, used));
    this.at = step;
    this.work += used.units;
    this.capture(step, true);
  }

  finish(): Snapshots<State, Params, Projection> {
    if (!this.done) throw new Error("finish() before the last step");
    this.dispose();
    const { sim, o, checkpoints, history } = this;
    const key = `${this.construction}|steps:${o.steps}`;
    const snapshots: Snapshots<State, Params, Projection> = Object.freeze({
      key, construction: this.construction, simulation: sim,
      params: freezeCopy(this.params) as Frozen<Params>, seed: this.seed, steps: o.steps,
      checkpointEvery: o.checkpointEvery, historyEvery: o.historyEvery,
      checkpointSteps: Object.freeze(checkpoints.map((kept) => kept.step)),
      history: Object.freeze(history.slice()),
      final: (history.length > 0 ? history[history.length - 1].value : undefined) as Frozen<Projection>,
      work: this.work, storedValues: this.checkpointValues + this.historyValues,
    });
    stores.set(snapshots, { sim, params: this.params, checkpoints: Object.freeze(checkpoints.slice()) });
    return snapshots;
  }

  dispose(): void {
    if (this.entered) { this.entered = false; this.run!.leave(); }
  }
}

function constructionKey<State, Params, Projection>(sim: Simulation<State, Params, Projection>, params: Params, seed: number, o: Resolved): string {
  return `${sim.id}|${canonicalKey(params)}|seed:${seed}|cp:${o.checkpointEvery}|h:${o.historyEvery}`;
}

function resolveRun<State, Params, Projection>(sim: Simulation<State, Params, Projection>, params: Params, seed: number, options: RunOptions) {
  if (!Number.isSafeInteger(seed)) throw new Error("seed must be a safe integer");
  const o = resolveOptions(options);
  const frozenParams = freezeCopy(params) as Params; // also proves the parameters are plain data
  const construction = constructionKey(sim, frozenParams, seed, o);
  const from = options.from as Snapshots<State, Params, Projection> | undefined;
  if (from) {
    if (from.simulation !== sim || from.construction !== construction) throw new Error("from is not an earlier run of this exact construction (simulation, params, seed, checkpointEvery, historyEvery)");
  }
  return { o, frozenParams, construction, from };
}

function begin<State, Params, Projection>(sim: Simulation<State, Params, Projection>, params: Params, seed: number, options: RunOptions) {
  const { o, frozenParams, construction, from } = resolveRun(sim, params, seed, options);
  return new Runner(sim, frozenParams, seed, o, options.cancelled, options.run, from, construction);
}

/**
 * Run a simulation to `options.steps` and publish frozen snapshots, or throw `SimulationCancelledError`.
 * Errors from bounds name the argument to change.
 */
export function runSimulation<State, Params, Projection = undefined>(
  sim: Simulation<State, Params, Projection>, params: Params, seed: number, options: RunOptions,
): Snapshots<State, Params, Projection> {
  const { from, o } = resolveRun(sim, params, seed, options);
  if (from && from.steps === o.steps) return from; // same construction and steps: already the answer
  const runner = begin(sim, params, seed, options);
  try {
    while (!runner.done) runner.advance();
    return runner.finish();
  } finally { runner.dispose(); }
}

/** Extend earlier snapshots by `extraSteps`. Identical to a run from scratch to the total, without re-running earlier steps. */
export function resumeSimulation<State, Params, Projection>(
  snaps: Snapshots<State, Params, Projection>, extraSteps: number, options: Omit<RunOptions, "steps" | "from" | "checkpointEvery" | "historyEvery"> = {},
): Snapshots<State, Params, Projection> {
  integerOption("extraSteps", extraSteps, 0, SNAPSHOT_LIMITS.maxSteps);
  return runSimulation(snaps.simulation, snaps.params as unknown as Params, snaps.seed,
    { ...options, steps: snaps.steps + extraSteps, checkpointEvery: snaps.checkpointEvery, historyEvery: snaps.historyEvery, from: snaps });
}

const defaultYield = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Cooperative variant: steps run in time slices with a yield to the host between them, `cancelled()` is
 * consulted before each step, and the result is the snapshots or `null` if cancelled. Results are exactly
 * those of `runSimulation`; only when the work happens differs.
 */
export async function prepareSimulation<State, Params, Projection = undefined>(
  sim: Simulation<State, Params, Projection>, params: Params, seed: number, options: AsyncRunOptions,
): Promise<Snapshots<State, Params, Projection> | null> {
  const now = options.now ?? (() => performance.now());
  const slice = options.timeSliceMs ?? SNAPSHOT_LIMITS.defaultTimeSliceMs;
  const yieldToHost = options.yieldToHost ?? defaultYield;
  if (!Number.isFinite(slice) || slice < 0) throw new Error("timeSliceMs must be a nonnegative number");
  let runner: Runner<State, Params, Projection> | undefined;
  try {
    const { from, o } = resolveRun(sim, params, seed, options);
    if (from && from.steps === o.steps) return from;
    runner = begin(sim, params, seed, options);
    let sliceStart = now();
    while (!runner.done) {
      runner.advance();
      if (!runner.done && now() - sliceStart >= slice) { await yieldToHost(); sliceStart = now(); }
    }
    return runner.finish();
  } catch (error) {
    if (error instanceof SimulationCancelledError) return null;
    throw error;
  } finally { runner?.dispose(); }
}

/* --------------------------------------------------------------------------------------- reads */

/**
 * A copy of the state after `step` steps, replayed from the nearest earlier checkpoint (at most
 * `checkpointEvery` steps of work). The caller owns the copy; the snapshots are unchanged.
 */
export function stateAt<State, Params, Projection>(
  snaps: Snapshots<State, Params, Projection>, step: number, options: { cancelled?: () => boolean } = {},
): State {
  integerOption("step", step, 0, snaps.steps);
  const { sim, params, checkpoints } = storeOf(snaps);
  let base = checkpoints[0];
  for (const kept of checkpoints) if (kept.step <= step) base = kept; else break;
  const copy = sim.copy ?? ((state: State) => cloneState(state));
  let state = copy(base.state);
  const budget = sim.limits(params).workPerStep;
  for (let k = base.step + 1; k <= step; k++) {
    if (options.cancelled?.()) throw new SimulationCancelledError();
    state = sim.step(state, contextFor(sim, params, snaps.seed, k, budget, { units: 0 }));
  }
  return state;
}

/** The final state as a copy the caller owns. */
export function finalState<State, Params, Projection>(snaps: Snapshots<State, Params, Projection>): State {
  return stateAt(snaps, snaps.steps);
}

/** The projection at `step`: the retained entry if there is one, else replayed and frozen. */
export function projectionAt<State, Params, Projection>(snaps: Snapshots<State, Params, Projection>, step: number): Frozen<Projection> {
  const project = snaps.simulation.project;
  if (!project) throw new Error(`${snaps.simulation.id} has no project(); there is no history to read`);
  const kept = snaps.history.find((entry) => entry.step === step);
  if (kept) return kept.value;
  return freezeCopy(project(stateAt(snaps, step), step), `${snaps.simulation.id} projection at step ${step}`) as Frozen<Projection>;
}

/* ---------------------------------------------------------------------------------------- cache */

export interface SimulationCacheOptions {
  /** Most retained snapshots (least recently used goes first). Default 8. */
  capacity?: number;
  /** Most stored values across entries; the newest entry is always kept. Default 8,000,000. */
  maxStoredValues?: number;
}

/**
 * Least-recently-used, bounded, content-keyed store. Keys are construction only. A request for more
 * steps than a cached run of the same construction extends that run, and a request for fewer replays
 * from that run's nearest earlier checkpoint, instead of starting over. A cancelled request stores nothing.
 */
export class SimulationCache {
  private readonly entries = new Map<string, Snapshots<any, any, any>>();
  private readonly capacity: number;
  private readonly maxValues: number;
  constructor(options: SimulationCacheOptions = {}) {
    this.capacity = integerOption("capacity", options.capacity ?? SNAPSHOT_LIMITS.defaultCacheEntries, 1, 10_000);
    this.maxValues = integerOption("maxStoredValues", options.maxStoredValues ?? SNAPSHOT_LIMITS.defaultCacheValues, 1, Number.MAX_SAFE_INTEGER);
  }
  get size(): number { return this.entries.size; }
  get storedValues(): number { let sum = 0; for (const entry of this.entries.values()) sum += entry.storedValues; return sum; }
  clear(): void { this.entries.clear(); }

  private lookup<S, P, Pr>(sim: Simulation<S, P, Pr>, params: P, seed: number, options: RunOptions) {
    const o = resolveOptions(options);
    const construction = constructionKey(sim, freezeCopy(params) as P, seed, o);
    const key = `${construction}|steps:${o.steps}`;
    return { construction, key, steps: o.steps };
  }
  /** True when this exact construction is cached (does not refresh its recency). */
  has<S, P, Pr>(sim: Simulation<S, P, Pr>, params: P, seed: number, options: RunOptions): boolean {
    return this.entries.has(this.lookup(sim, params, seed, options).key);
  }
  private touch(key: string): Snapshots<any, any, any> | undefined {
    const hit = this.entries.get(key);
    if (hit) { this.entries.delete(key); this.entries.set(key, hit); }
    return hit;
  }
  /** The cached run of this construction that reaches furthest without passing `steps`: its retained checkpoints decide. */
  private base(construction: string, steps: number): Snapshots<any, any, any> | undefined {
    let best: Snapshots<any, any, any> | undefined, bestReach = 0;
    for (const entry of this.entries.values()) {
      if (entry.construction !== construction) continue;
      let reach = 0;
      for (const step of entry.checkpointSteps) if (step <= steps) reach = step;
      if (reach > bestReach) { best = entry; bestReach = reach; }
    }
    return best;
  }
  private store(snaps: Snapshots<any, any, any>): Snapshots<any, any, any> {
    const existing = this.entries.get(snaps.key);
    if (existing) return existing;
    this.entries.set(snaps.key, snaps);
    let total = this.storedValues;
    for (const key of this.entries.keys()) {
      if (this.entries.size <= 1) break;
      if (this.entries.size <= this.capacity && total <= this.maxValues) break;
      total -= this.entries.get(key)!.storedValues;
      this.entries.delete(key);
    }
    return snaps;
  }

  /** Cached snapshots for this construction, running (or extending a cached shorter run) on a miss. */
  get<S, P, Pr = undefined>(sim: Simulation<S, P, Pr>, params: P, seed: number, options: RunOptions): Snapshots<S, P, Pr> {
    const { construction, key, steps } = this.lookup(sim, params, seed, options);
    const hit = this.touch(key);
    if (hit) return hit;
    const from = options.from ?? this.base(construction, steps);
    return this.store(runSimulation(sim, params, seed, { ...options, from })) as Snapshots<S, P, Pr>;
  }

  /** Cooperative `get`; `null` if cancelled (nothing is stored). */
  async prepare<S, P, Pr = undefined>(sim: Simulation<S, P, Pr>, params: P, seed: number, options: AsyncRunOptions): Promise<Snapshots<S, P, Pr> | null> {
    const { construction, key, steps } = this.lookup(sim, params, seed, options);
    const hit = this.touch(key);
    if (hit) return hit;
    const from = options.from ?? this.base(construction, steps);
    const made = await prepareSimulation(sim, params, seed, { ...options, from });
    return made ? this.store(made) as Snapshots<S, P, Pr> : null;
  }
}

export function createSimulationCache(options: SimulationCacheOptions = {}): SimulationCache {
  return new SimulationCache(options);
}

/* --------------------------------------------------------------------------------------- checks */

/**
 * Prove the structure-preserving guarantees for one construction, throwing an Error naming the first
 * violated property. A new simulation should pass this in its tests for a few seeds and sizes; it catches
 * hidden clocks and `Math.random`, state shared between checkpoints, steps that read their own history,
 * and states whose `copy` is not faithful.
 */
export function checkSimulation<State, Params, Projection = undefined>(
  sim: Simulation<State, Params, Projection>, params: Params, seed: number, steps: number,
  options: { checkpointSpacings?: readonly number[] } = {},
): void {
  const spacings = options.checkpointSpacings ?? [1, 3, 0];
  const base = runSimulation(sim, params, seed, { steps, checkpointEvery: 7 });
  const again = runSimulation(sim, params, seed, { steps, checkpointEvery: 7 });
  const same = (left: unknown, right: unknown, what: string) => { if (!identical(left, right)) throw new Error(`${sim.id}: ${what}`); };
  same(finalState(base), finalState(again), "two runs of one construction differ (hidden clock, Math.random or shared state)");
  same(base.history, again.history, "history of two runs of one construction differs");
  for (const spacing of spacings) {
    const other = runSimulation(sim, params, seed, { steps, checkpointEvery: spacing });
    same(finalState(other), finalState(base), `checkpointEvery ${spacing} changes the final state`);
    same(other.history, base.history, `checkpointEvery ${spacing} changes the history`);
  }
  const probes = [...new Set([0, 1, Math.floor(steps / 2), Math.max(0, steps - 1), steps])].filter((step) => step >= 0 && step <= steps).sort((a, b) => a - b);
  for (const probe of probes) {
    const scratch = runSimulation(sim, params, seed, { steps: probe, checkpointEvery: 7 });
    same(stateAt(base, probe), finalState(scratch), `state at step ${probe} of a longer run differs from a run of ${probe} steps (prefix property)`);
    if (probe > 0 && probe < steps) {
      const resumed = resumeSimulation(scratch, steps - probe);
      same(finalState(resumed), finalState(base), `resuming from step ${probe} differs from a run from scratch`);
      same(resumed.history, base.history, `history after resuming from step ${probe} differs from a run from scratch`);
      same(resumed.checkpointSteps, base.checkpointSteps, `checkpoints after resuming from step ${probe} differ from a run from scratch`);
    }
    if (probe < steps) {
      const truncated = runSimulation(sim, params, seed, { steps: probe, checkpointEvery: 7, from: base });
      same(finalState(truncated), finalState(scratch), `replaying to step ${probe} from a longer run's checkpoint differs from a run from scratch`);
      same(truncated.history, scratch.history, `history replayed to step ${probe} from a longer run differs from a run from scratch`);
      same(truncated.work, scratch.work, `work replayed to step ${probe} from a longer run differs from a run from scratch`);
    }
    for (const entry of scratch.history) if (entry.step < probe) {
      const kept = base.history.find((item) => item.step === entry.step);
      if (kept) same(entry.value, kept.value, `history at step ${entry.step} changes when steps grows from ${probe} to ${steps}`);
    }
  }
}
