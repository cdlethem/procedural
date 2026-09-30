/**
 * Migrating river ribbons (brief 44): the producer. A centerline with stable node ids migrates by a stated
 * curvature-driven bank erosion rule, is resampled at equal spacing, and cuts off necks into oxbows; it runs
 * through the F7 `Simulation` API and publishes a frozen `RiverScene` that any number of drawing treatments read.
 * See `docs/composition-river-ribbons.md` for the model, units, ownership, bounds and failure modes.
 *
 * Construction (the cache key) is the valley, the initial planform, the channel, the migration rule, the
 * resolution and the step count. Palette, widening, fades and every mark choice are appearance and never enter it.
 */
import { componentSeed, cachedBy } from "./core.js";
import { ANCHOR_WIDTHS, WALL_WIDTHS, applyCuts, arcLengths, confine, dischargeWidths, easeAtWalls, findCuts, kernelTaps, migrationOffsets, resample, signedCurvature,
  smoothCurvature, valleyOf, valleyU, valleyV, MAX_KERNEL_TAPS, SETTLE_TOLERANCE, type Valley } from "./river-model.js";
import { createSimulationCache, finalState, SNAPSHOT_LIMITS, type Simulation, type Snapshots } from "./snapshots.js";
import { freezeCopy } from "./snapshot-values.js";
import type { Path, Point } from "./types.js";

/* ------------------------------------------------------------------------------------ options */

export type RiverPlanform = "wandering" | "sine-generated";

/** Everything that determines a river. Lengths are canvas units except `spacing`, `smoothing` and `cutoff`, which are in channel widths; angles are degrees. */
export interface RiverOptions {
  seed: number;
  /** Migration steps from the initial channel (0 publishes the initial channel). */
  steps: number;
  centerX: number; centerY: number;
  /** Valley length between its end walls; the channel is pinned to the axis 10% of the length inside each end. */
  length: number;
  angle: number;
  /** Distance from the axis to each valley wall. The channel's banks never cross a wall. */
  confinement: number;
  planform: RiverPlanform;
  /** Wandering: highest sine harmonic of the seeded initial offset from the axis. Ignored for `sine-generated`. */
  harmonics: number;
  /** Wandering: peak offset from the axis, as a fraction of the free half-width of the valley. Ignored for `sine-generated`. */
  amplitude: number;
  /** Sine-generated: whole wavelengths along the valley. Ignored for `wandering`. */
  waves: number;
  /** Sine-generated: peak deviation of the channel direction from the axis, degrees. Ignored for `wandering`. */
  turn: number;
  /** Channel width at the inlet. */
  width: number;
  /** Discharge at the outlet relative to the inlet; it grows linearly along the channel and width follows its square root. */
  discharge: number;
  /** Bank mobility: the rate of migration in channel widths per step per unit of `width * curvature`. */
  mobility: number;
  /** Length of the curvature smoothing kernel, in channel widths. */
  smoothing: number;
  /** 0 smooths symmetrically; 1 feels only the curvature upstream, so bends drift downstream. */
  skew: number;
  /** Variation of bank erodibility across the floodplain, 0 (uniform) to below 1. Seeded. */
  heterogeneity: number;
  /** Node spacing in channel widths. */
  spacing: number;
  /** Neck width at which a bend cuts off, in channel widths. */
  cutoff: number;
}

/** Hard limits of every numeric option: `[min, max, integer]`. Slider intervals are narrower and live with the controls. */
export const RIVER_LIMITS: Readonly<Record<string, readonly [number, number, boolean]>> = Object.freeze({
  steps: [0, 600, true], centerX: [-4096, 4096, false], centerY: [-4096, 4096, false], length: [40, 4000, false], angle: [-3600, 3600, false],
  confinement: [8, 4000, false], harmonics: [1, 24, true], amplitude: [0, 1, false], waves: [1, 16, true], turn: [0, 90, false],
  width: [0.5, 60, false], discharge: [0.1, 10, false], mobility: [0, 2, false], smoothing: [0, 20, false], skew: [0, 1, false],
  heterogeneity: [0, 0.95, false], spacing: [0.2, 2, false], cutoff: [0.5, 20, false],
});

/** The construction of a river: `RiverOptions` without `steps`, with the options that the chosen planform ignores set to 0. */
export type RiverConstruction = Omit<RiverOptions, "seed" | "steps">;

/** Most cutoff passes in one step (each pass removes at least one node, so this is a guard, not a limit reached in practice). */
const MAX_CUT_PASSES = 12;
/** Work bound of a run: the model's declared per-step bound is pessimistic (it assumes the node limit is reached), so the run gets its own ceiling. */
export const RIVER_MAX_WORK = 150_000_000;

/** Longest sinuosity (channel length over valley length) the node bound allows; beyond it the run fails naming the controls. */
export const MAX_SINUOSITY = 4;
export const MAX_NODES = 2000;

export function riverConstruction(options: RiverOptions): RiverConstruction {
  const { seed: _seed, steps: _steps, ...rest } = options;
  return options.planform === "wandering" ? { ...rest, waves: 0, turn: 0 } : { ...rest, harmonics: 0, amplitude: 0 };
}

/** Whether the seed can change the river: only the wandering planform and the erodibility field draw from it. */
export const riverUsesSeed = (q: Pick<RiverOptions, "planform" | "amplitude" | "heterogeneity">): boolean =>
  (q.planform === "wandering" && q.amplitude > 0) || q.heterogeneity > 0;
const riverSeedOf = (options: RiverOptions): number => riverUsesSeed(options) ? options.seed : 0;

/** Work units per node per step apart from the kernel: curvature, migration, the spatial index and resampling (its cell and point visits are charged as they happen). */
const NODE_WORK = 150;
interface Derived { spacing: number; scale: number; taps: number; wmin: number; wmax: number; nodeLimit: number; workPerStep: number }
function derive(c: RiverConstruction): Derived {
  const spacing = c.spacing * c.width, scale = c.smoothing * c.width, taps = kernelTaps(c.spacing, c.smoothing);
  const wmin = c.width * Math.sqrt(Math.min(1, c.discharge)), wmax = c.width * Math.sqrt(Math.max(1, c.discharge));
  const nodeLimit = Math.min(MAX_NODES, Math.ceil(MAX_SINUOSITY * c.length / spacing) + 2);
  return { spacing, scale, taps, wmin, wmax, nodeLimit, workPerStep: nodeLimit * (2 * taps + NODE_WORK) };
}

/** Admit a river or throw naming the control (or the coupled controls) to change. */
export function checkRiver(options: RiverOptions): void {
  if (!Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) throw new Error("seed must be a uint32 integer");
  if (options.planform !== "wandering" && options.planform !== "sine-generated") throw new Error("planform must be wandering or sine-generated");
  for (const [key, [min, max, integer]] of Object.entries(RIVER_LIMITS)) {
    const value = (options as unknown as Record<string, number>)[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
      throw new Error(`${key} must be ${integer ? "an integer" : "a number"} from ${min} to ${max} (got ${String(value)})`);
  }
  const c = riverConstruction(options), d = derive(c);
  const neck = c.cutoff * d.wmin / c.width;
  if (c.spacing > neck / 2)
    throw new Error(`spacing (${c.spacing} widths) must not exceed half the cutoff (${+neck.toFixed(3)} widths of the inlet channel), or a limb could cross another between steps; lower spacing or raise cutoff`);
  if (c.confinement < 2 * d.wmax)
    throw new Error(`confinement (${c.confinement}) must be at least twice the widest channel (${+(2 * d.wmax).toFixed(2)}); raise confinement or lower width or discharge`);
  if (d.taps > MAX_KERNEL_TAPS)
    throw new Error(`smoothing (${c.smoothing} widths) at spacing ${c.spacing} needs ${d.taps} kernel taps, above ${MAX_KERNEL_TAPS}; lower smoothing or raise spacing`);
  const initial = Math.ceil(c.length * (1 - 2 * END_ROOM) / d.spacing) + 1;
  if (initial > d.nodeLimit || initial > MAX_NODES)
    throw new Error(`length ${c.length} at spacing ${+d.spacing.toFixed(2)} needs ${initial} nodes, above the ${Math.min(d.nodeLimit, MAX_NODES)} allowed; lower length or raise spacing or width`);
  const work = d.workPerStep * options.steps + INITIAL_WORK;
  if (work > RIVER_MAX_WORK)
    throw new Error(`steps (${options.steps}) at up to ${d.nodeLimit} nodes and ${d.taps} kernel taps is ${work} work units, above ${RIVER_MAX_WORK}; lower steps, length or smoothing, or raise spacing`);
  const history = options.steps * d.nodeLimit * 3;
  if (history > SNAPSHOT_LIMITS.defaultMaxHistoryValues)
    throw new Error(`steps (${options.steps}) at up to ${d.nodeLimit} nodes would retain ${history} history values, above ${SNAPSHOT_LIMITS.defaultMaxHistoryValues}; lower steps, length or raise spacing`);
}

/* ---------------------------------------------------------------------------------- simulation */

/** An oxbow as the state keeps it: its node ids, positions (`x, y` pairs) and widths at the moment of the cutoff; a crossing cutoff leaves a closed ring. */
export interface OxbowRecord { id: number; born: number; distance: number; closed: boolean; ids: number[]; xy: number[]; width: number[] }

export interface RiverState {
  xy: Float64Array; ids: Int32Array;
  /** Next unused node id and oxbow serial (birth counters; ids are never reused). */
  nextNode: number; nextOxbow: number;
  oxbows: OxbowRecord[];
  /** Erodibility waves: `[kx, ky, phase, weight]` three times. */
  field: number[];
  /** First step that changed nothing (the channel is settled and every later step is identical), or -1. */
  settledAt: number;
}

/** What each retained step publishes: the centerline and its node ids. */
export interface RiverFrameData { xy: Float64Array; ids: Int32Array }

const WAVES = 3, WAVE_WEIGHTS = [1, 0.7, 0.5];
/** The pinned inlet and outlet sit this fraction of the valley length inside its end walls, leaving the channel room to loop around them. */
export const END_ROOM = 0.1;

function erodibility(state: Pick<RiverState, "field">, valley: Valley, heterogeneity: number): (x: number, y: number) => number {
  if (heterogeneity === 0) return () => 1;
  return (x, y) => {
    const u = valleyU(valley, x, y), v = valleyV(valley, x, y);
    let sum = 0;
    for (let m = 0; m < WAVES; m++) sum += state.field[4 * m + 3] * Math.sin(state.field[4 * m] * u + state.field[4 * m + 1] * v + state.field[4 * m + 2]);
    return 1 + heterogeneity * sum;
  };
}

/** Initial centerline before resampling, as `(u, v)` offsets along and across the valley axis at `t` in [0, 1]. */
function initialProfile(c: RiverConstruction, free: number, harmonic: (h: number) => number): (samples: number) => { u: Float64Array; v: Float64Array } {
  return (samples) => {
    const u = new Float64Array(samples + 1), v = new Float64Array(samples + 1);
    if (c.planform === "sine-generated") {
      // Langbein–Leopold sine-generated curve: direction = turn * sin(2 pi waves s / S). Scaled to the valley length and shrunk across the valley to fit its walls.
      const omega = c.turn * Math.PI / 180;
      let x = 0, y = 0, previous = 0;
      const xs = new Float64Array(samples + 1), ys = new Float64Array(samples + 1);
      for (let k = 1; k <= samples; k++) {
        const theta = omega * Math.sin(2 * Math.PI * c.waves * k / samples);
        x += Math.cos((previous + theta) / 2) / samples; y += Math.sin((previous + theta) / 2) / samples;
        xs[k] = x; ys[k] = y; previous = theta;
      }
      const span = c.length * (1 - 2 * END_ROOM), scale = span / xs[samples], shear = ys[samples];
      let peak = 0;
      for (let k = 0; k <= samples; k++) { u[k] = xs[k] * scale - span / 2; v[k] = (ys[k] - shear * k / samples) * scale; peak = Math.max(peak, Math.abs(v[k])); }
      if (peak > free) for (let k = 0; k <= samples; k++) v[k] *= free / peak;
      return { u, v };
    }
    const weights = Array.from({ length: c.harmonics }, (_, h) => harmonic(h + 1));
    let peak = 0;
    for (let k = 0; k <= samples; k++) {
      const t = k / samples;
      u[k] = (t - 0.5) * c.length * (1 - 2 * END_ROOM);
      let offset = 0;
      for (let h = 1; h <= c.harmonics; h++) offset += weights[h - 1] * Math.sin(Math.PI * h * t);
      v[k] = offset; peak = Math.max(peak, Math.abs(offset));
    }
    const gain = peak > 0 ? c.amplitude * free / peak : 0;
    for (let k = 0; k <= samples; k++) v[k] *= gain;
    return { u, v };
  };
}

const PROFILE_SAMPLES = 2400;
const INITIAL_WORK = PROFILE_SAMPLES * 8 + MAX_NODES * 8;

export const riverSimulation: Simulation<RiverState, RiverConstruction, RiverFrameData> = {
  id: "river-ribbons",
  limits: (c) => ({ stepLimit: RIVER_LIMITS.steps[1], workPerStep: derive(c).workPerStep, initialWork: INITIAL_WORK }),
  initial(ctx) {
    const c = ctx.params, d = derive(c), valley = valleyOf(c.centerX, c.centerY, c.length, c.angle);
    const profile = initialProfile(c, c.confinement - d.wmax / 2, (h) => ctx.stream("channel", `harmonic:${h}`).next() * 2 - 1)(PROFILE_SAMPLES);
    const xy = new Float64Array(2 * (PROFILE_SAMPLES + 1));
    for (let k = 0; k <= PROFILE_SAMPLES; k++) {
      xy[2 * k] = valley.cx + profile.u[k] * valley.ax - profile.v[k] * valley.ay;
      xy[2 * k + 1] = valley.cy + profile.u[k] * valley.ay + profile.v[k] * valley.ax;
    }
    const first = resample(xy, new Int32Array(PROFILE_SAMPLES + 1), 0, d.spacing);
    const ids = Int32Array.from({ length: first.ids.length }, (_, i) => i);
    ctx.charge(PROFILE_SAMPLES * 8 + ids.length * 8);
    const field: number[] = [];
    for (let m = 0; m < WAVES; m++) {
      const stream = ctx.stream("floodplain", `wave:${m}`);
      const wavelength = c.length * (0.15 + 0.35 * stream.next()), angle = Math.PI * stream.next(), phase = 2 * Math.PI * stream.next();
      field.push(2 * Math.PI / wavelength * Math.cos(angle), 2 * Math.PI / wavelength * Math.sin(angle), phase, WAVE_WEIGHTS[m] / (WAVE_WEIGHTS[0] + WAVE_WEIGHTS[1] + WAVE_WEIGHTS[2]));
    }
    return { xy: first.xy, ids, nextNode: ids.length, nextOxbow: 0, oxbows: [], field, settledAt: -1 };
  },
  step(state, ctx) {
    if (state.settledAt >= 0) { ctx.charge(1); return state; }
    const c = ctx.params, d = derive(c), n = state.ids.length, valley = valleyOf(c.centerX, c.centerY, c.length, c.angle);
    // 1. Read the old channel everywhere.
    const arc = arcLengths(state.xy), width = dischargeWidths(arc, c.width, c.discharge);
    const smooth = smoothCurvature(signedCurvature(state.xy), arc[n - 1] / (n - 1), d.scale, c.skew);
    const { offsets, maxMove: unwalled } = migrationOffsets(state.xy, arc, smooth, width, c.mobility, ANCHOR_WIDTHS * c.width, erodibility(state, valley, c.heterogeneity));
    if (unwalled > d.spacing / 2)
      throw new Error(`step ${ctx.step}: bank migration would move a node ${+unwalled.toFixed(3)}, more than half the node spacing (${+(d.spacing / 2).toFixed(3)}); lower mobility, raise spacing or raise smoothing`);
    easeAtWalls(offsets, state.xy, width, { valley, half: c.confinement }, WALL_WIDTHS * c.width);
    let maxMove = 0;
    for (let i = 0; i < offsets.length; i += 2) maxMove = Math.max(maxMove, Math.hypot(offsets[i], offsets[i + 1]));
    // 2. Move every node, then hold the banks inside the valley walls.
    const moved = Float64Array.from(state.xy);
    for (let i = 0; i < moved.length; i++) moved[i] += offsets[i];
    confine(moved, width, { valley, half: c.confinement });
    // 3. Resample to equal spacing (ids stay where a node remains nearest to its old place), then cut off until no neck or crossing is left.
    //    A channel that did not move is only checked: if it has no cut either, the step is a no-op and the channel has settled.
    const oxbows = state.oxbows.slice();
    let nextOxbow = state.nextOxbow, xy: Float64Array, ids: Int32Array, nextNode = state.nextNode, visits = 0;
    const settling = maxMove <= SETTLE_TOLERANCE * d.spacing;
    if (settling) { xy = state.xy; ids = state.ids; } else { const first = resample(moved, state.ids, nextNode, d.spacing); xy = first.xy; ids = first.ids; nextNode = first.nextId; }
    for (let pass = 0; ; pass++) {
      const arcs = arcLengths(xy), here = dischargeWidths(arcs, c.width, c.discharge);
      const cuts = findCuts(xy, here, arcs, c.cutoff, (units) => { visits += units; });
      if (cuts.length === 0) break;
      if (pass >= MAX_CUT_PASSES) throw new Error(`step ${ctx.step}: cutoffs did not settle in ${MAX_CUT_PASSES} passes; lower mobility or raise cutoff or spacing`);
      const cut = applyCuts(xy, ids, here, cuts, nextNode);
      for (const loop of cut.loops) oxbows.push({ id: nextOxbow++, born: ctx.step, distance: loop.distance, closed: loop.closed, ids: loop.ids, xy: loop.xy, width: loop.width });
      const next = resample(cut.xy, cut.ids, cut.nextId, d.spacing);
      xy = next.xy; ids = next.ids; nextNode = next.nextId;
    }
    try { ctx.charge(n * (2 * d.taps + 16) + visits); } catch {
      throw new Error(`step ${ctx.step}: ${n} nodes, ${d.taps} kernel taps and ${visits} spatial visits exceed the ${d.workPerStep} work units allowed per step; raise spacing or width, or lower length or smoothing`);
    }
    if (settling && nextOxbow === state.nextOxbow) { state.settledAt = ctx.step; return state; }
    if (ids.length > d.nodeLimit)
      throw new Error(`step ${ctx.step}: the channel reached ${ids.length} nodes (sinuosity above ${MAX_SINUOSITY}), above the ${d.nodeLimit} allowed; lower steps or mobility, raise cutoff or spacing`);
    return { xy, ids, nextNode, nextOxbow, oxbows, field: state.field, settledAt: -1 };
  },
  project: (state) => ({ xy: state.xy, ids: state.ids }),
  size: (state) => state.xy.length + state.ids.length + state.field.length + state.oxbows.reduce((sum, o) => sum + o.xy.length + o.ids.length + o.width.length + 3, 4),
};

/* ------------------------------------------------------------------------------------ scene */

/** The channel's derived fields at its nodes. Arrays are read-only; positions are interleaved `x, y`. */
export interface RiverChannel {
  readonly ids: Readonly<Int32Array>; readonly xy: Readonly<Float64Array>;
  readonly arc: Readonly<Float64Array>; readonly length: number;
  /** Width from discharge: a function of the fraction along the channel only. */
  readonly width: Readonly<Float64Array>;
  /** Curvature smoothed with the migration kernel, the value that drives migration. */
  readonly curvature: Readonly<Float64Array>;
}

export interface RiverOxbow {
  /** `oxbow:<serial>`; serials are birth order and never reused. */
  readonly id: string;
  /** The step whose migration cut it off; its age at step `k` is `k - born`. */
  readonly born: number;
  /** Distance between the two neck nodes when they cut (0 for a crossing cutoff). */
  readonly distance: number;
  /** A crossing cutoff leaves a closed ring whose first node lies on the channel; a neck cutoff leaves an open path between two neck nodes. */
  readonly closed: boolean;
  /** Node ids. Open: first and last are the neck nodes that stayed on the channel. Closed: the first is the new crossing node on the channel. */
  readonly ids: readonly number[];
  readonly points: readonly Point[];
  /** Channel width at each node when it was cut off. */
  readonly width: readonly number[];
}

export interface RiverFrame { readonly step: number; readonly xy: Readonly<Float64Array>; readonly ids: Readonly<Int32Array> }

export interface RiverScene {
  /** Construction identity; palette and appearance never enter it. */
  readonly key: string;
  readonly seed: number;
  /** Steps run; frames cover 0..steps. */
  readonly steps: number;
  readonly options: Readonly<RiverOptions>;
  readonly valley: Valley;
  /** Axis-aligned bounds of the valley corridor, `[minX, minY, maxX, maxY]`. */
  readonly bounds: readonly [number, number, number, number];
  readonly channel: RiverChannel;
  /** The centerline after every step, oldest first: `frames[k].step === k`. */
  readonly frames: readonly RiverFrame[];
  readonly oxbows: readonly RiverOxbow[];
  /** First step that changed nothing, or null while the channel is still moving. */
  readonly settledAt: number | null;
  /** Node ids handed out so far (births), including those that have retired. */
  readonly nodesBorn: number;
}

/** Arc length, width, raw and smoothed curvature of any centerline of this river (older frames use the same rule as the current channel). */
export function riverFields(xy: Readonly<Float64Array>, options: Pick<RiverOptions, "width" | "discharge" | "smoothing" | "skew" | "spacing">): { arc: Float64Array; width: Float64Array; curvature: Float64Array } {
  const n = xy.length / 2, arc = arcLengths(xy);
  return { arc, width: dischargeWidths(arc, options.width, options.discharge),
    curvature: smoothCurvature(signedCurvature(xy), arc[n - 1] / (n - 1), options.smoothing * options.width, options.skew) };
}

const pointsOf = (xy: ArrayLike<number>): Point[] => Array.from({ length: xy.length / 2 }, (_, i) => Object.freeze([xy[2 * i], xy[2 * i + 1]] as const));

const scenes = new WeakMap<object, RiverScene>();

function sceneOf(snaps: Snapshots<RiverState, RiverConstruction, RiverFrameData>): RiverScene {
  const known = scenes.get(snaps);
  if (known) return known;
  const end = finalState(snaps), c = snaps.params as unknown as RiverConstruction;
  const valley = valleyOf(c.centerX, c.centerY, c.length, c.angle);
  const fields = riverFields(end.xy, c);
  const half = { u: c.length / 2, v: c.confinement };
  const xs = [-1, 1].flatMap((su) => [-1, 1].map((sv) => valley.cx + su * half.u * valley.ax - sv * half.v * valley.ay));
  const ys = [-1, 1].flatMap((su) => [-1, 1].map((sv) => valley.cy + su * half.u * valley.ay + sv * half.v * valley.ax));
  const scene: RiverScene = Object.freeze({
    key: snaps.key, seed: snaps.seed, steps: snaps.steps, options: Object.freeze({ ...c, seed: snaps.seed, steps: snaps.steps }), valley: Object.freeze(valley),
    bounds: Object.freeze([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const),
    channel: Object.freeze({ ids: end.ids, xy: end.xy, arc: fields.arc, length: fields.arc[fields.arc.length - 1], width: fields.width, curvature: fields.curvature }),
    frames: Object.freeze(snaps.history.map((entry) => Object.freeze({ step: entry.step, xy: entry.value.xy, ids: entry.value.ids }))),
    oxbows: Object.freeze(end.oxbows.map((o) => Object.freeze({ id: `oxbow:${o.id}`, born: o.born, distance: o.distance, closed: o.closed,
      ids: freezeCopy(o.ids), points: Object.freeze(pointsOf(o.xy)), width: freezeCopy(o.width) }))),
    settledAt: end.settledAt >= 0 ? end.settledAt : null, nodesBorn: end.nextNode,
  });
  scenes.set(snaps, scene);
  return scene;
}

/** Retained runs by construction. Recolouring, or any drawing choice, asks with the same construction and receives the same scene object. */
const runs = createSimulationCache({ capacity: 6 });
const RETENTION = { checkpointEvery: 40, historyEvery: 1 } as const;

export interface RiverControl { cancelled?: () => boolean }

/** The river of these options: frozen, cached by construction, with a stable id for every node and oxbow. Throws naming the control at fault. */
export function riverRibbons(options: RiverOptions, control: RiverControl = {}): RiverScene {
  checkRiver(options);
  const snaps = runs.get(riverSimulation, riverConstruction(options), riverSeedOf(options), { steps: options.steps, ...RETENTION, maxWork: RIVER_MAX_WORK, cancelled: control.cancelled });
  return sceneOf(snaps);
}

/** Cooperative `riverRibbons` in time slices; `null` if cancelled, in which case nothing is cached or published. */
export async function prepareRiverRibbons(options: RiverOptions, cancelled: () => boolean): Promise<RiverScene | null> {
  checkRiver(options);
  const snaps = await runs.prepare(riverSimulation, riverConstruction(options), riverSeedOf(options), { steps: options.steps, ...RETENTION, maxWork: RIVER_MAX_WORK, cancelled });
  return snaps ? sceneOf(snaps) : null;
}

/** The retained snapshots behind a river (for `stateAt`, checkpoints and replay). */
export function riverSnapshots(options: RiverOptions): Snapshots<RiverState, RiverConstruction, RiverFrameData> {
  checkRiver(options);
  return runs.get(riverSimulation, riverConstruction(options), riverSeedOf(options), { steps: options.steps, ...RETENTION, maxWork: RIVER_MAX_WORK });
}

/** Whether this exact construction (steps included) is cached; a cancelled or failed run is never cached. */
export function isRiverCached(options: RiverOptions): boolean {
  checkRiver(options);
  return runs.has(riverSimulation, riverConstruction(options), riverSeedOf(options), { steps: options.steps, ...RETENTION, maxWork: RIVER_MAX_WORK });
}

/** Drop every cached run (tests and hosts that need a cold start). */
export const clearRiverCache = (): void => runs.clear();

/* ------------------------------------------------------------------------------- age and paths */

const traceCache = new WeakMap<RiverScene, Map<string, readonly Path[]>>();

/**
 * The retained centerlines at steps `0, every, 2 every, …` below the current step, as ordinary paths for any
 * path material: `channel@<step>`, `level` = the step, `levelFraction` = step / steps (0 oldest). The set only
 * grows as steps grow. The current channel is not among them.
 */
export function riverTraces(scene: RiverScene, every: number): readonly Path[] {
  if (!Number.isInteger(every) || every < 1) throw new Error("scar interval must be an integer of at least 1");
  return cachedBy(traceCache, scene, `every:${every}`, () => {
    const paths: Path[] = [];
    for (let step = 0; step < scene.steps; step += every) {
      const id = `channel@${step}`;
      paths.push(Object.freeze({ id, seed: componentSeed(scene.seed, id, "trace"), points: Object.freeze(pointsOf(scene.frames[step].xy)),
        closed: false, level: step, levelFraction: step / scene.steps }));
    }
    return Object.freeze(paths);
  });
}

/** Each oxbow as a path: `level` = the step it was cut, `levelFraction` = that step over the steps run. */
export function oxbowPaths(scene: RiverScene): readonly Path[] {
  return cachedBy(traceCache, scene, "oxbows", () => Object.freeze(scene.oxbows.map((oxbow) => Object.freeze({
    id: oxbow.id, seed: componentSeed(scene.seed, oxbow.id, "oxbow"), points: oxbow.points, closed: oxbow.closed, level: oxbow.born,
    levelFraction: scene.steps > 0 ? oxbow.born / scene.steps : 0 }))));
}

/** Most cells an age field may have, and most segment-cell tests one may cost. */
export const MAX_AGE_CELLS = 250_000;
export const MAX_AGE_WORK = 8_000_000;

/** The last step at which the channel occupied each cell of the valley's bounds, or -1 for never. */
export interface RiverAgeField {
  readonly cell: number; readonly columns: number; readonly rows: number;
  readonly bounds: readonly [number, number, number, number];
  readonly steps: number;
  readonly last: Readonly<Int32Array>;
}

const ageCache = new WeakMap<RiverScene, Map<string, RiverAgeField>>();

/**
 * Rasterise every retained frame's ribbon (its width at that step) onto a grid over the valley bounds, later
 * frames over earlier ones: `steps - last` is the age of the cell in steps. A cell is occupied when its center is
 * within half the local width of the centerline, or within the cell's half diagonal of it (so every cell that holds a centerline point is stamped and a thin channel leaves no holes).
 */
export function riverAgeField(scene: RiverScene, cell: number): RiverAgeField {
  if (!Number.isFinite(cell) || cell <= 0) throw new Error("age cell must be a positive number");
  return cachedBy(ageCache, scene, `cell:${cell}`, () => {
    const [x0, y0, x1, y1] = scene.bounds, pad = cell;
    const columns = Math.ceil((x1 - x0 + 2 * pad) / cell), rows = Math.ceil((y1 - y0 + 2 * pad) / cell);
    if (columns * rows > MAX_AGE_CELLS) throw new Error(`Floodplain cell ${cell} gives ${columns * rows} cells, above ${MAX_AGE_CELLS}; raise the floodplain cell size`);
    const left = x0 - pad, top = y0 - pad, last = new Int32Array(columns * rows).fill(-1);
    let work = 0;
    for (const frame of scene.frames) {
      const { width } = riverFields(frame.xy, scene.options), n = width.length;
      for (let k = 0; k < n - 1; k++) {
        const ax = frame.xy[2 * k], ay = frame.xy[2 * k + 1], bx = frame.xy[2 * k + 2], by = frame.xy[2 * k + 3];
        const reach = Math.max((width[k] + width[k + 1]) / 4, cell * Math.SQRT1_2);
        const c0 = Math.max(0, Math.floor((Math.min(ax, bx) - reach - left) / cell)), c1 = Math.min(columns - 1, Math.floor((Math.max(ax, bx) + reach - left) / cell));
        const r0 = Math.max(0, Math.floor((Math.min(ay, by) - reach - top) / cell)), r1 = Math.min(rows - 1, Math.floor((Math.max(ay, by) + reach - top) / cell));
        work += (c1 - c0 + 1) * (r1 - r0 + 1);
        if (work > MAX_AGE_WORK) throw new Error(`Floodplain age field needs more than ${MAX_AGE_WORK} cell tests; raise the floodplain cell size or lower steps`);
        const dx = bx - ax, dy = by - ay, span = dx * dx + dy * dy;
        for (let r = r0; r <= r1; r++) for (let q = c0; q <= c1; q++) {
          const px = left + (q + 0.5) * cell - ax, py = top + (r + 0.5) * cell - ay;
          const t = span > 0 ? Math.min(1, Math.max(0, (px * dx + py * dy) / span)) : 0;
          if (Math.hypot(px - t * dx, py - t * dy) <= reach) last[r * columns + q] = frame.step;
        }
      }
    }
    return Object.freeze({ cell, columns, rows, bounds: Object.freeze([left, top, left + columns * cell, top + rows * cell] as const), steps: scene.steps, last });
  });
}
