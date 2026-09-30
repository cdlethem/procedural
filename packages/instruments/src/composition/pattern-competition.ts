import { marchingSquares2D } from "@procedurals/javascript";
import { cachedBy, componentSeed } from "./core.js";
import { clipPaths } from "./domains-paths.js";
import { labelDomains } from "./domains-raster.js";
import { rectangleDomain, type PlanarDomain } from "./domains.js";
import { nonBranching } from "./nodal-plate.js";
import { contourChains } from "./sources.js";
import { PointGrid } from "./spatial-index.js";
import { createSimulationCache, elementId, type Simulation, type Snapshots } from "./snapshots.js";
import type { CompositionRun, Path, Point, Site } from "./types.js";

/*
 * Multiscale pattern competition: a bounded, seeded, deterministic multiscale activator-inhibitor model, run through the
 * stateful-snapshot foundation (`snapshots.ts`), publishing one state that three treatments read.
 *
 * MODEL (a McCabe-style multiscale Turing rule; an original statement of the rule, not his code or exact equations).
 *   State   u[c] in [-1, 1] on a square grid of `resolution` x `resolution` cells (cell ids `cell:<row * resolution + column>`),
 *           plus the dominant scale label[c] and its sign[c] (+1 activator ahead, -1 inhibitor ahead).
 *   Scales  S >= 2 pairs (activator radius a_i, inhibitor radius b_i), i = 0 (finest) ... S - 1 (coarsest), each with an
 *           increment d_i. Radii are box half-widths in cells: a_0 = smallest, a_i = max(a_{i-1} + 1, ceil(smallest * ratio^i)),
 *           b_i = max(a_i + 1, round(a_i * inhibitor)). Increments d_i = increment * 2^(tilt * (2 t_i - 1)), t_i = i / (S - 1)
 *           (tilt > 0 weights coarse scales, < 0 fine ones, 0 equal weights).
 *   Blur    A_i, I_i are the mean of u over a (2r + 1) x (2r + 1) box (a separable running sum) of half-width a_i, b_i. The box is
 *           applied `BLUR_PASSES` times in each axis. Outside the grid: `wrap` (torus), `mirror` (reflect about the edge, the edge
 *           cell repeated) or `void` (u = 0 beyond the edge).
 *   Variation  V_i[c] = A_i[c] - I_i[c]. The DOMINANT scale of a cell is the i with the smallest |V_i[c]| (ties: the smaller i);
 *           its sign is +1 when V_i >= 0 and -1 otherwise. |V| <= 1e-12 is rounding of an exact zero and counts as 0, so a flat
 *           region (where every blur agrees) takes the finest scale and +1 whatever the rounding. A state's labels and signs
 *           are a function of its field alone.
 *   Step k  (synchronous; every cell reads the state after step k - 1)
 *           1. u[c] += sign[c] * d_label[c]
 *           2. symmetrise u over the chosen group inside each tile (mean over the orbit, copied to every member)
 *           3. normalise: u = 2 (u - min) / (max - min) - 1, so a non-constant field spans exactly [-1, 1]; a constant field
 *              becomes 0 everywhere
 *           4. recompute label and sign from the new field; copy the orbit representative's label and sign to every member
 *           Step 0 is the initial field (step 2, 3, 4 applied to it). No random draw occurs after step 0.
 *   Inert   A constant field carries no pattern: blurs of a constant are equal, every variation is (numerically) zero and the sign
 *           would be decided by rounding. Such a state is FROZEN: every later step returns it unchanged, `inert` is published,
 *           consumers draw nothing at a positive threshold, and no work beyond a scan is charged. It is the model's explicit
 *           termination (an empty start, a disc of radius 0 with no noise).
 *   Initial `noise` (u ~ uniform [-1, 1] per cell, from `ctx.stream("cell:<i>", "noise")`), `spots` (`startCount` Gaussian bumps of
 *           random sign at seeded positions, sigma = startSize * resolution / 4), `disc` (+1 inside a centred disc of radius
 *           startSize * resolution / 2, -1 outside), `ring` (+1 in an annulus of that mean radius and half-thickness
 *           max(1.5, 0.15 radius)); the last three add `noise` * uniform [-1, 1] per cell.
 *   Symmetry (exact on the lattice; applied in every square tile of side resolution / tiles) `mirror` (left-right), `turn2`
 *           (half turn), `quad` (both mirrors), `turn4` (quarter turns), `dihedral` (quarter turns and mirrors, 8-fold).
 *
 * This is a 2D pattern-formation model, not a physical or chemical simulation, and is not any published model's exact equations.
 *
 * OWNERSHIP AND CACHING. The run is cached by construction only (`patternSnapshots`): the model, the seed and the step count;
 * palette, thresholds, marks, materials never enter the key, so an appearance edit receives the same `Snapshots` object.
 * `patternView` and the three producers below are frozen, cached on the snapshot object (weakly) and keyed by their own options.
 *
 * BOUNDS (all name the control to change): resolution 24-192, scales 2-8, steps <= 2000, inhibitor half-width <= 2 * resolution,
 * total work <= `PATTERN_LIMITS.maxWork` cell-visits (one unit is one cell read in one blur pass; measured about 2.5 ns each).
 */

export const PATTERN_LIMITS = Object.freeze({
  minResolution: 24, maxResolution: 192, minScales: 2, maxScales: 8, maxSteps: 2000, maxSmallest: 24,
  maxWork: 1_500_000_000, maxSites: 40_000, maxSegmentsPerPiece: 2200, maxLevels: 12,
});

export const PATTERN_BOUNDARIES = ["wrap", "mirror", "void"] as const;
export const PATTERN_SYMMETRIES = ["none", "mirror", "turn2", "quad", "turn4", "dihedral"] as const;
export const PATTERN_STARTS = ["noise", "spots", "disc", "ring"] as const;
export type PatternBoundary = (typeof PATTERN_BOUNDARIES)[number];
export type PatternSymmetry = (typeof PATTERN_SYMMETRIES)[number];
export type PatternStart = (typeof PATTERN_STARTS)[number];

/** Construction of the model: everything the state depends on except the seed and the number of steps. */
export interface PatternModel {
  /** Cells per side (24-192). */
  resolution: number;
  /** Scale pairs (2-8). */
  scales: number;
  /** Activator half-width of the finest scale, in cells. */
  smallest: number;
  /** Growth of the activator radius per scale (radius_i ~ smallest * ratio^i). */
  ratio: number;
  /** Inhibitor radius as a multiple of the activator radius. */
  inhibitor: number;
  /** Base increment of one update (field units; the field spans 2). */
  increment: number;
  /** Increment weighting: the coarsest scale's increment over the finest's is 4^tilt (tilt 0: equal; 1: four times). */
  tilt: number;
  boundary: PatternBoundary;
  symmetry: PatternSymmetry;
  /** Square symmetry tiles per side (1-4; must divide `resolution`). */
  tiles: number;
  start: PatternStart;
  /** Size of the seeded shapes as a fraction of half the grid side (spots, disc, ring). */
  startSize: number;
  /** Bumps of `spots`. */
  startCount: number;
  /** Noise amplitude added to spots, disc and ring. */
  noise: number;
}

/** One scale pair of the resolved scale set. */
export interface PatternScale {
  readonly index: number;
  /** Activator box half-width in cells. */
  readonly radius: number;
  /** Inhibitor box half-width in cells. */
  readonly inhibitorRadius: number;
  /** Field units added or removed per step where this scale dominates. */
  readonly increment: number;
}

const BLUR_PASSES = 3;
/** Variations below this are rounding of an exact zero (blurs of a constant differ in the last bits). */
const TIE = 1e-12;
const NONE = 0;

function fail(message: string): never { throw new Error(message); }
function range(label: string, value: number, min: number, max: number, integer = false): void {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    fail(`${label} must be ${integer ? "an integer " : ""}between ${min} and ${max}`);
}

/** The resolved scale set of a model (radii, inhibitor radii, increments); throws naming the control when it cannot exist. */
export function patternScales(model: PatternModel): readonly PatternScale[] {
  range("Scales", model.scales, PATTERN_LIMITS.minScales, PATTERN_LIMITS.maxScales, true);
  range("Smallest scale", model.smallest, 1, PATTERN_LIMITS.maxSmallest, true);
  range("Scale ratio", model.ratio, 1.05, 4);
  range("Inhibitor reach", model.inhibitor, 1.1, 4);
  range("Increment", model.increment, 1e-4, 0.5);
  range("Weight tilt", model.tilt, -3, 3);
  const out: PatternScale[] = [];
  for (let i = 0; i < model.scales; i++) {
    const wanted = Math.ceil(model.smallest * model.ratio ** i - 1e-9);
    const radius = i === 0 ? model.smallest : Math.max(out[i - 1].radius + 1, wanted);
    const inhibitorRadius = Math.max(radius + 1, Math.round(radius * model.inhibitor));
    if (inhibitorRadius > 2 * model.resolution)
      fail(`Scale ${i + 1} needs an inhibitor radius of ${inhibitorRadius} cells, more than twice Resolution ${model.resolution}; lower Scales, Smallest scale, Scale ratio or Inhibitor reach, or raise Resolution`);
    const t = i / (model.scales - 1);
    out.push(Object.freeze({ index: i, radius, inhibitorRadius, increment: model.increment * 2 ** (model.tilt * (2 * t - 1)) }));
  }
  return Object.freeze(out);
}

/** Validate a model completely (the same checks `patternSimulation` applies), throwing an error that names the control. */
export function checkPatternModel(model: PatternModel): void {
  range("Resolution", model.resolution, PATTERN_LIMITS.minResolution, PATTERN_LIMITS.maxResolution, true);
  patternScales(model);
  if (!PATTERN_BOUNDARIES.includes(model.boundary)) fail(`Boundary must be one of ${PATTERN_BOUNDARIES.join(", ")}`);
  if (!PATTERN_SYMMETRIES.includes(model.symmetry)) fail(`Symmetry must be one of ${PATTERN_SYMMETRIES.join(", ")}`);
  if (!PATTERN_STARTS.includes(model.start)) fail(`Start must be one of ${PATTERN_STARTS.join(", ")}`);
  range("Symmetry tiles", model.tiles, 1, 4, true);
  if (model.resolution % model.tiles !== 0) fail(`Symmetry tiles ${model.tiles} must divide Resolution ${model.resolution}; choose a Resolution that is a multiple of ${model.tiles}`);
  range("Start size", model.startSize, 0, 1.5);
  range("Spots", model.startCount, 0, 64, true);
  range("Start noise", model.noise, 0, 2);
}

/** Work units one step charges: every blur is `BLUR_PASSES` running sums in each of two axes, plus the update passes. */
export function patternStepWork(model: PatternModel): number {
  return model.resolution * model.resolution * (model.scales * (4 * BLUR_PASSES + 3) + 12);
}

// ------------------------------------------------------------------------------------------------------------ kernels

/** Index of the cell an out-of-grid position reads, or -1 for the void. */
function source(i: number, n: number, boundary: PatternBoundary): number {
  if (i >= 0 && i < n) return i;
  if (boundary === "wrap") { const m = i % n; return m < 0 ? m + n : m; }
  if (boundary === "mirror") { const p = ((i % (2 * n)) + 2 * n) % (2 * n); return p < n ? p : 2 * n - 1 - p; }
  return -1;
}

/** Box mean of half-width r along each row: `pad` is a scratch line of n + 2r values (edge reads go through the boundary rule). */
function boxRows(from: Float64Array, to: Float64Array, n: number, r: number, boundary: PatternBoundary, pad: Float64Array): void {
  const width = 2 * r + 1, scale = 1 / width;
  for (let row = 0; row < n; row++) {
    const base = row * n;
    for (let k = 0; k < r; k++) { const at = source(k - r, n, boundary); pad[k] = at < 0 ? 0 : from[base + at]; }
    for (let k = 0; k < n; k++) pad[r + k] = from[base + k];
    for (let k = n + r; k < n + 2 * r; k++) { const at = source(k - r, n, boundary); pad[k] = at < 0 ? 0 : from[base + at]; }
    let sum = 0;
    for (let k = 0; k < width; k++) sum += pad[k];
    for (let i = 0; i < n; i++) {
      to[base + i] = sum * scale;
      if (i < n - 1) sum += pad[i + width] - pad[i];
    }
  }
}

/** Box mean of half-width r down each column, sliding whole rows so memory is read in order. `sums` is a scratch line of n values. */
function boxColumns(from: Float64Array, to: Float64Array, n: number, r: number, boundary: PatternBoundary, sums: Float64Array): void {
  const scale = 1 / (2 * r + 1);
  sums.fill(0);
  for (let k = -r; k <= r; k++) {
    const at = source(k, n, boundary);
    if (at >= 0) for (let i = 0; i < n; i++) sums[i] += from[at * n + i];
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) to[j * n + i] = sums[i] * scale;
    if (j === n - 1) break;
    const add = source(j + r + 1, n, boundary), drop = source(j - r, n, boundary);
    if (add >= 0) for (let i = 0; i < n; i++) sums[i] += from[add * n + i];
    if (drop >= 0) for (let i = 0; i < n; i++) sums[i] -= from[drop * n + i];
  }
}

/** The blur of the model: `BLUR_PASSES` box means in each axis. `scratch` is overwritten; the result is in `to`. */
function blur(from: Float64Array, to: Float64Array, scratch: Float64Array, n: number, r: number, boundary: PatternBoundary, pad: Float64Array): void {
  let source_ = from;
  for (let pass = 0; pass < BLUR_PASSES; pass++) {
    boxRows(source_, scratch, n, r, boundary, pad);
    boxColumns(scratch, to, n, r, boundary, pad);
    source_ = to;
  }
}

interface Workspace { a: Float64Array; b: Float64Array; tmp: Float64Array; best: Float64Array; pad: Float64Array }
function workspace(n: number, scales: readonly PatternScale[]): Workspace {
  const cells = n * n, widest = Math.max(...scales.map((s) => s.inhibitorRadius));
  return { a: new Float64Array(cells), b: new Float64Array(cells), tmp: new Float64Array(cells), best: new Float64Array(cells), pad: new Float64Array(n + 2 * widest) };
}

/** Per-cell variations A_i - I_i of a field for scale i, written into `out`. */
function variation(field: Float64Array, out: Float64Array, n: number, scale: PatternScale, boundary: PatternBoundary, w: Workspace): void {
  blur(field, w.a, w.tmp, n, scale.radius, boundary, w.pad);
  blur(field, w.b, w.tmp, n, scale.inhibitorRadius, boundary, w.pad);
  for (let c = 0; c < out.length; c++) out[c] = w.a[c] - w.b[c];
}

function dominant(field: Float64Array, label: Uint8Array, sign: Int8Array, n: number, scales: readonly PatternScale[], boundary: PatternBoundary, w: Workspace): void {
  w.best.fill(Infinity);
  const v = new Float64Array(n * n);
  for (const scale of scales) {
    variation(field, v, n, scale, boundary, w);
    for (let c = 0; c < v.length; c++) {
      // Differences within rounding of zero are exact zeros: a flat region has no preferred sign and takes the first scale and +1.
      const magnitude = Math.abs(v[c]) <= TIE ? 0 : Math.abs(v[c]);
      if (magnitude < w.best[c]) { w.best[c] = magnitude; label[c] = scale.index; sign[c] = v[c] >= -TIE ? 1 : -1; }
    }
  }
}

type Transform = (x: number, y: number, w: number) => readonly [number, number];
const IDENTITY: Transform = (x, y) => [x, y];
const MIRROR_X: Transform = (x, y, w) => [w - 1 - x, y];
const TURN2: Transform = (x, y, w) => [w - 1 - x, w - 1 - y];
const TURN_90: Transform = (x, y, w) => [w - 1 - y, x];
const TURN_270: Transform = (x, y, w) => [y, w - 1 - x];
const MIRROR_Y: Transform = (x, y, w) => [x, w - 1 - y];
/** The transposition and anti-transposition complete the eight elements of the square's dihedral group. */
const TRANSPOSE: Transform = (x, y) => [y, x];
const ANTI: Transform = (x, y, w) => [w - 1 - y, w - 1 - x];
const GROUPS: Record<Exclude<PatternSymmetry, "none">, readonly Transform[]> = {
  mirror: [IDENTITY, MIRROR_X],
  turn2: [IDENTITY, TURN2],
  quad: [IDENTITY, MIRROR_X, MIRROR_Y, TURN2],
  turn4: [IDENTITY, TURN_90, TURN2, TURN_270],
  dihedral: [IDENTITY, TURN_90, TURN2, TURN_270, MIRROR_X, MIRROR_Y, TRANSPOSE, ANTI],
};

/** For every cell, the cell that images it under each group element (within its tile), and the lowest cell of its orbit. */
export interface SymmetryOrbits { readonly images: readonly Int32Array[]; readonly representative: Int32Array }
export function symmetryOrbits(n: number, tiles: number, symmetry: PatternSymmetry): SymmetryOrbits | null {
  if (symmetry === "none") return null;
  const w = n / tiles, group = GROUPS[symmetry];
  const images = group.map(() => new Int32Array(n * n));
  const representative = new Int32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const c = y * n + x, tx = Math.floor(x / w) * w, ty = Math.floor(y / w) * w;
    let low = c;
    group.forEach((g, k) => {
      const [gx, gy] = g(x - tx, y - ty, w), image = (ty + gy) * n + tx + gx;
      images[k][c] = image;
      if (image < low) low = image;
    });
    representative[c] = low;
  }
  return { images, representative };
}

function symmetrise(field: Float64Array, orbits: SymmetryOrbits | null): void {
  if (!orbits) return;
  const { images, representative } = orbits, mean = new Float64Array(field.length), count = images.length;
  for (let c = 0; c < field.length; c++) {
    if (representative[c] !== c) continue;
    let sum = 0;
    for (let k = 0; k < count; k++) sum += field[images[k][c]];
    mean[c] = sum / count;
  }
  for (let c = 0; c < field.length; c++) field[c] = mean[representative[c]];
}

function normalise(field: Float64Array): boolean {
  let lo = Infinity, hi = -Infinity;
  for (const v of field) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (!(hi > lo)) { field.fill(0); return false; }
  const span = hi - lo;
  for (let c = 0; c < field.length; c++) field[c] = 2 * (field[c] - lo) / span - 1;
  return true;
}

// ------------------------------------------------------------------------------------------------------ simulation

export interface PatternState {
  field: Float64Array;
  label: Uint8Array;
  sign: Int8Array;
  /** Mean absolute change of the field caused by the last step (0 at step 0 and for an inert state). */
  activity: number;
  /** True for a constant field: frozen, see the header. */
  inert: boolean;
}
/** What history and `final` hold: the field, its dominant scale labels and the diagnostics. */
export interface PatternProjection {
  step: number;
  field: Float64Array;
  label: Uint8Array;
  activity: number;
  inert: boolean;
}

function startField(model: PatternModel, ctx: Parameters<Simulation<PatternState, PatternModel, PatternProjection>["initial"]>[0]): Float64Array {
  const n = model.resolution, field = new Float64Array(n * n), centre = (n - 1) / 2, radius = model.startSize * n / 2;
  const noise = (c: number): number => 2 * ctx.stream(elementId("cell", c), "noise").next() - 1;
  if (model.start === "noise") {
    for (let c = 0; c < field.length; c++) field[c] = noise(c);
    return field;
  }
  if (model.start === "spots") {
    const sigma = Math.max(0.5, radius / 2);
    for (let j = 0; j < model.startCount; j++) {
      const stream = ctx.stream(elementId("spot", j), "place");
      const x = stream.next() * n, y = stream.next() * n, sign = stream.next() < 0.5 ? -1 : 1;
      for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
        let dx = Math.abs(col + 0.5 - x), dy = Math.abs(row + 0.5 - y);
        if (model.boundary === "wrap") { dx = Math.min(dx, n - dx); dy = Math.min(dy, n - dy); }
        field[row * n + col] += sign * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      }
    }
  } else {
    const half = Math.max(1.5, 0.15 * radius);
    for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
      const d = Math.hypot(col - centre, row - centre);
      const inside = model.start === "disc" ? d <= radius : Math.abs(d - radius) <= half;
      field[row * n + col] = inside ? 1 : -1;
    }
  }
  if (model.noise > 0) for (let c = 0; c < field.length; c++) field[c] += model.noise * noise(c);
  return field;
}

/** The pattern-competition model as a `Simulation` (see the header for the rule). Params are the model only. */
export const patternSimulation: Simulation<PatternState, PatternModel, PatternProjection> = {
  id: "pattern-competition",
  limits(model) {
    checkPatternModel(model as PatternModel);
    return { stepLimit: PATTERN_LIMITS.maxSteps, workPerStep: patternStepWork(model as PatternModel), initialWork: patternStepWork(model as PatternModel) + 8 * model.resolution * model.resolution };
  },
  initial(ctx) {
    const model = ctx.params as PatternModel, n = model.resolution, scales = patternScales(model);
    ctx.charge(patternStepWork(model) + 8 * n * n);
    const field = startField(model, ctx), orbits = symmetryOrbits(n, model.tiles, model.symmetry);
    symmetrise(field, orbits);
    const live = normalise(field);
    const label = new Uint8Array(n * n), sign = new Int8Array(n * n);
    if (live) settle(field, label, sign, n, scales, model, orbits);
    return { field, label, sign, activity: 0, inert: !live };
  },
  step(state, ctx) {
    const model = ctx.params as PatternModel, n = model.resolution;
    if (state.inert) { ctx.charge(n * n); return state; }
    const scales = patternScales(model), orbits = symmetryOrbits(n, model.tiles, model.symmetry);
    ctx.charge(patternStepWork(model));
    const before = Float64Array.from(state.field), { field, label, sign } = state;
    for (let c = 0; c < field.length; c++) field[c] += sign[c] * scales[label[c]].increment;
    symmetrise(field, orbits);
    const live = normalise(field);
    if (!live) { label.fill(NONE); sign.fill(0); return { field, label, sign, activity: 0, inert: true }; }
    settle(field, label, sign, n, scales, model, orbits);
    let change = 0;
    for (let c = 0; c < field.length; c++) change += Math.abs(field[c] - before[c]);
    return { field, label, sign, activity: change / field.length, inert: false };
  },
  project: (state, step) => ({ step, field: state.field, label: state.label, activity: state.activity, inert: state.inert }),
};

function settle(field: Float64Array, label: Uint8Array, sign: Int8Array, n: number, scales: readonly PatternScale[], model: PatternModel, orbits: SymmetryOrbits | null): void {
  dominant(field, label, sign, n, scales, model.boundary, workspace(n, scales));
  if (!orbits) return;
  const { representative } = orbits, copyLabel = Uint8Array.from(label), copySign = Int8Array.from(sign);
  for (let c = 0; c < label.length; c++) { label[c] = copyLabel[representative[c]]; sign[c] = copySign[representative[c]]; }
}

// ------------------------------------------------------------------------------------------------- snapshots (cache)

/** Retain a checkpoint often enough that a slider dragged down replays a short way; depends on the model only, never on steps. */
export const patternCheckpointEvery = (model: PatternModel): number => Math.max(25, Math.ceil(model.resolution * model.resolution / 512));

const cache = createSimulationCache({ capacity: 6, maxStoredValues: 6_000_000 });
export type PatternSnapshots = Snapshots<PatternState, PatternModel, PatternProjection>;

function runOptions(model: PatternModel, steps: number) {
  range("Steps", steps, 0, PATTERN_LIMITS.maxSteps, true);
  return { steps, checkpointEvery: patternCheckpointEvery(model), historyEvery: 0, maxWork: PATTERN_LIMITS.maxWork, maxCheckpointValues: 6_000_000 };
}
const ADVICE = " (in the instrument: lower Steps, Resolution or Scales)";
function explain<T>(make: () => T): T {
  try { return make(); } catch (error) {
    if (error instanceof Error && /work|stored|values|limit/i.test(error.message) && !error.message.includes("Steps")) error.message += ADVICE;
    throw error;
  }
}

/** Snapshots of the model after `steps` steps, cached by construction (model, seed, steps): extending or shortening a run reuses checkpoints. */
export function patternSnapshots(model: PatternModel, seed: number, steps: number, run?: CompositionRun): PatternSnapshots {
  checkPatternModel(model);
  return explain(() => cache.get(patternSimulation, model, seed, { ...runOptions(model, steps), ...(run ? { run } : {}) }));
}

/** Cooperative `patternSnapshots`; null when cancelled (nothing is cached). */
export async function preparePatternSnapshots(model: PatternModel, seed: number, steps: number, cancelled: () => boolean): Promise<PatternSnapshots | null> {
  checkPatternModel(model);
  return explain(() => cache.prepare(patternSimulation, model, seed, { ...runOptions(model, steps), cancelled }));
}

/** Whether these snapshots are already cached (does not refresh recency). */
export function patternCached(model: PatternModel, seed: number, steps: number): boolean {
  return cache.has(patternSimulation, model, seed, runOptions(model, steps));
}

// ----------------------------------------------------------------------------------------------------- published view

export interface PatternView {
  readonly key: string;
  readonly columns: number;
  readonly step: number;
  /** Field values in [-1, 1], row-major, row 0 at the top (treat as read-only). */
  readonly values: Readonly<Float64Array>;
  /** Dominant scale index per cell (treat as read-only). */
  readonly labels: Readonly<Uint8Array>;
  readonly scales: readonly PatternScale[];
  /** Fraction of cells each scale dominates. */
  readonly shares: readonly number[];
  readonly activity: number;
  readonly inert: boolean;
  readonly boundary: PatternBoundary;
}

const viewCache = new WeakMap<object, PatternView>();
/** The final state's published field, labels and diagnostics (frozen wrapper over the snapshot's private buffers). */
export function patternView(snaps: PatternSnapshots): PatternView {
  const hit = viewCache.get(snaps);
  if (hit) return hit;
  const model = snaps.params as PatternModel, scales = patternScales(model), counts = new Array<number>(scales.length).fill(0);
  const projection = snaps.final as PatternProjection;
  for (const l of projection.label) counts[l]++;
  const view: PatternView = Object.freeze({
    key: snaps.key, columns: model.resolution, step: snaps.steps, values: projection.field, labels: projection.label, scales,
    shares: Object.freeze(counts.map((c) => c / projection.label.length)), activity: projection.activity, inert: projection.inert, boundary: model.boundary,
  });
  viewCache.set(snaps, view);
  return view;
}

/**
 * The competing fields of the final state: per scale i, V_i = A_i - I_i (the quantity whose smallest magnitude picks the
 * dominant scale). Computed from the final field on demand and cached on the snapshot; treat the arrays as read-only.
 */
export function patternCompetingFields(snaps: PatternSnapshots): readonly Readonly<Float64Array>[] {
  const view = patternView(snaps), pool = fieldCache;
  return cachedBy(pool, snaps, "variations", () => {
    const n = view.columns, w = workspace(n, view.scales);
    return Object.freeze(view.scales.map((scale) => { const out = new Float64Array(n * n); variation(view.values as Float64Array, out, n, scale, view.boundary, w); return out; }));
  });
}
const fieldCache = new WeakMap<object, Map<string, readonly Readonly<Float64Array>[]>>();

// ------------------------------------------------------------------------------------------------------- frame

/** Where the square grid sits on the canvas: `left`, `top` and `size` in canvas units. */
export interface PatternFrame { readonly left: number; readonly top: number; readonly size: number }
export const patternFrame = (centerX: number, centerY: number, size: number): PatternFrame => {
  range("Size", size, 1, 100000);
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) fail("Center X and Center Y must be finite");
  return Object.freeze({ left: centerX - size / 2, top: centerY - size / 2, size });
};

const frameKey = (frame: PatternFrame): string => `${frame.left},${frame.top},${frame.size}`;

/** Palette tone of scale `k`: index 0 is reserved for ink, scales cycle over the remaining colours. */
export const scaleTone = (k: number, paletteLength: number): number => paletteLength > 1 ? 1 + (k % (paletteLength - 1)) : 0;

// ------------------------------------------------------------------------------------------------------- contours

export interface PatternContourOptions {
  /** Field values in (-1, 1), at most `PATTERN_LIMITS.maxLevels`. */
  readonly levels: readonly number[];
  /** Pieces shorter than this many cells of arc length are dropped (they are below the sampling resolution). */
  readonly minLength: number;
}
export interface PatternPath extends Path {
  /** Cell-space number of the scale that dominates most of the path's vertices (ties: the finest). */
  readonly scale: number;
}

const contourCache = new WeakMap<object, Map<string, readonly PatternPath[]>>();
const arcLength = (points: readonly Point[], closed: boolean): number => {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  if (closed && points.length > 1) sum += Math.hypot(points[0][0] - points[points.length - 1][0], points[0][1] - points[points.length - 1][1]);
  return sum;
};

/**
 * Iso-lines of the final field at each level, through the existing marching squares and chain assembler. The grid is padded by one
 * cell using the boundary rule (so lines reach the footprint edge, or continue as the boundary says), traced, cut at the footprint
 * with the exact clipper and returned as frozen paths in canvas units. A sample equal to a level counts as high. Ids `iso:<level>:<k>`
 * in scan order (pieces `#<n>` after clipping); `Path.level` is the field value, `levelFraction` its rank among the levels, `tone`
 * the palette-independent scale index (`PatternPath.scale`). Each connected piece of a level is assembled separately, so a level may hold
 * many loops; a single piece longer than `maxSegmentsPerPiece` segments is refused.
 */
export function patternContours(snaps: PatternSnapshots, frame: PatternFrame, options: PatternContourOptions): readonly PatternPath[] {
  const { levels, minLength } = options;
  if (levels.length > PATTERN_LIMITS.maxLevels) fail(`Contour levels must be at most ${PATTERN_LIMITS.maxLevels}`);
  for (const level of levels) if (!(level > -1 && level < 1)) fail(`Contour level ${level} must lie strictly between -1 and 1; lower Level spread or Level center`);
  range("Smallest contour", minLength, 0, 1000);
  const view = patternView(snaps);
  return cachedBy(contourCache, snaps, `${frameKey(frame)}|${levels.join(",")}|${minLength}`, () => {
    if (levels.length === 0 || view.inert) return Object.freeze([]);
    const n = view.columns, m = n + 2, h = frame.size / n, padded = new Float64Array(m * m);
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      const ci = source(i - 1, n, view.boundary), cj = source(j - 1, n, view.boundary);
      padded[j * m + i] = ci < 0 || cj < 0 ? 0 : view.values[cj * n + ci];
    }
    const origin: [number, number] = [frame.left - h / 2, frame.top - h / 2], maxWork = m * m + (m - 1) * (m - 1);
    const raw: PatternPath[] = [];
    const advice = ". Lower Resolution, raise Smallest contour or use fewer Contour levels";
    const plain = Array.from(padded);
    levels.forEach((level, levelIndex) => {
      const { segments } = marchingSquares2D({ values: plain, columns: m, rows: m, origin, spacing: [h, h], threshold: level, maxWork });
      for (const piece of nonBranching(segments)) if (piece.length > PATTERN_LIMITS.maxSegmentsPerPiece)
        fail(`One ${level.toFixed(2)} contour has ${piece.length} segments, over the limit of ${PATTERN_LIMITS.maxSegmentsPerPiece}${advice}`);
      const groups = nonBranching(segments);
      const chains = contourChains(groups.map((group) => ({ level, segments: group })), snaps.seed, groups.length, (x, y) => [x, y], advice);
      let ordinal = 0;
      for (const chain of chains) {
        if (arcLength(chain.points, chain.closed) < minLength * h) continue;
        const id = `iso:${levelIndex}:${ordinal++}`;
        const votes = new Array<number>(view.scales.length).fill(0);
        for (const [x, y] of chain.points) {
          const i = Math.min(n - 1, Math.max(0, Math.floor((x - frame.left) / h))), j = Math.min(n - 1, Math.max(0, Math.floor((y - frame.top) / h)));
          votes[view.labels[j * n + i]]++;
        }
        const scale = votes.indexOf(Math.max(...votes));
        raw.push(Object.freeze({ id, seed: componentSeed(snaps.seed, id, "path"), points: chain.points, closed: chain.closed, level,
          levelFraction: levels.length > 1 ? levelIndex / (levels.length - 1) : 0, tone: scale, scale }));
      }
    });
    const footprint = rectangleDomain([{ id: "footprint", bounds: [frame.left, frame.top, frame.left + frame.size, frame.top + frame.size] }]);
    const scaleOf = new Map(raw.map((p) => [p.id, p.scale]));
    const clipped = clipPaths(raw, footprint).map((p): PatternPath => {
      if ((p as PatternPath).scale !== undefined) return p as PatternPath;
      const parent = p.id.slice(0, p.id.lastIndexOf("#"));
      return Object.freeze({ ...p, scale: scaleOf.get(parent)! });
    }).filter((p) => arcLength(p.points, p.closed) >= minLength * h);
    return Object.freeze(clipped);
  });
}

// ---------------------------------------------------------------------------------------------------------- sites

export interface PatternSiteOptions {
  /** Only cells with field value >= level carry a mark. */
  readonly level: number;
  /** Diameter of the coarsest scale's mark, canvas units. Finer scales are proportionally smaller (diameter = size * radius / coarsest radius). */
  readonly size: number;
  /** Least distance between two marks as a multiple of the mean of their diameters (>= 0). */
  readonly gap: number;
}
export interface PatternSite extends Site {
  readonly cell: number;
  readonly scaleIndex: number;
  /** The field value at the cell, in [level, 1]. */
  readonly value: number;
  /** Mark diameter for this site's scale, canvas units (`scale * size`). */
  readonly diameter: number;
}

const siteCache = new WeakMap<object, Map<string, readonly PatternSite[]>>();

/**
 * Marks by dominant scale. Candidates are the cells with u >= level, taken in descending u (ties: lower cell id), so marks sit on the
 * field's peaks. A candidate is accepted unless an accepted mark lies closer than `gap * (d + d') / 2` (d, d' the two scales' diameters).
 * Because a scale's mark is proportional to its radius, coarse lobes hold few large marks and fine texture many small ones: the
 * density follows the field. Sites: id = `cell:<index>`, position = cell centre, `angle` = direction of the level line through the cell
 * (perpendicular to the gradient, central differences under the boundary rule; 0 where the gradient vanishes), `scale` = diameter /
 * size, `tone` = the scale index, `seed` from `componentSeed(seed, id, "site")`. At most `maxSites`.
 */
export function patternSites(snaps: PatternSnapshots, frame: PatternFrame, options: PatternSiteOptions): readonly PatternSite[] {
  range("Mark level", options.level, -1, 1);
  range("Mark size", options.size, 0.01, 2000);
  range("Mark gap", options.gap, 0, 20);
  const view = patternView(snaps);
  return cachedBy(siteCache, snaps, `${frameKey(frame)}|${options.level}|${options.size}|${options.gap}`, () => {
    if (view.inert) return Object.freeze([]);
    const n = view.columns, h = frame.size / n, coarsest = view.scales[view.scales.length - 1].radius;
    const diameters = view.scales.map((s) => options.size * s.radius / coarsest);
    const candidates: number[] = [];
    for (let c = 0; c < view.values.length; c++) if (view.values[c] >= options.level) candidates.push(c);
    candidates.sort((a, b) => view.values[b] - view.values[a] || a - b);
    const reach = options.gap * Math.max(...diameters);
    const grid = new PointGrid({ bounds: [frame.left, frame.top, frame.left + frame.size, frame.top + frame.size], cellSize: Math.max(reach, h), maxPoints: PATTERN_LIMITS.maxSites + 1 });
    const accepted: { cell: number; x: number; y: number }[] = [];
    for (const c of candidates) {
      const x = frame.left + ((c % n) + 0.5) * h, y = frame.top + (Math.floor(c / n) + 0.5) * h, mine = diameters[view.labels[c]];
      let free = true;
      for (const hit of reach > 0 ? grid.within(x, y, reach) : []) {
        const other = accepted[hit.id];
        if (hit.distance < options.gap * (mine + diameters[view.labels[other.cell]]) / 2) { free = false; break; }
      }
      if (!free) continue;
      if (accepted.length >= PATTERN_LIMITS.maxSites) fail(`Marks exceed ${PATTERN_LIMITS.maxSites}; raise Mark size or Mark gap, or raise Mark level`);
      grid.insert(accepted.length, x, y);
      accepted.push({ cell: c, x, y });
    }
    accepted.sort((a, b) => a.cell - b.cell);
    const at = (i: number, j: number): number => { const ci = source(i, n, view.boundary), cj = source(j, n, view.boundary); return ci < 0 || cj < 0 ? 0 : view.values[cj * n + ci]; };
    return Object.freeze(accepted.map(({ cell, x, y }): PatternSite => {
      const i = cell % n, j = Math.floor(cell / n);
      const gx = at(i + 1, j) - at(i - 1, j), gy = at(i, j + 1) - at(i, j - 1);
      const id = elementId("cell", cell), k = view.labels[cell];
      return Object.freeze({ id, seed: componentSeed(snaps.seed, id, "site"), position: Object.freeze([x, y] as const), angle: Math.hypot(gx, gy) < 1e-12 ? 0 : Math.atan2(gy, gx) + Math.PI / 2,
        scale: diameters[k] / options.size, tone: k, cell, scaleIndex: k, value: view.values[cell], diameter: diameters[k] });
    }));
  });
}

// ---------------------------------------------------------------------------------------------------------- bands

export interface PatternBandOptions {
  /** Cells with field value >= level are inside a band. */
  readonly level: number;
  /** Boundary thinning tolerance in cells (topology-preserving; shared boundaries between scales stay shared). */
  readonly smoothing: number;
  /** Bands (and holes) smaller than this many cells are dropped. */
  readonly minArea: number;
}
export interface PatternBand { readonly scale: number; readonly domain: PlanarDomain }

const bandCache = new WeakMap<object, Map<string, readonly PatternBand[]>>();

/**
 * Flat polygon bands by dominant scale: for each scale the cells it dominates with u >= level, as one planar domain (polygons with
 * holes; boundaries follow cell edges, thinned by `smoothing`; scales share identical boundaries). Ascending scale; scales with no
 * cell are omitted. Domain ids `bands:<scale + 1>`.
 */
export function patternBands(snaps: PatternSnapshots, frame: PatternFrame, options: PatternBandOptions): readonly PatternBand[] {
  range("Band level", options.level, -1, 1);
  range("Band smoothing", options.smoothing, 0, 4);
  range("Smallest patch", options.minArea, 0, 10000);
  const view = patternView(snaps);
  return cachedBy(bandCache, snaps, `${frameKey(frame)}|${options.level}|${options.smoothing}|${options.minArea}`, () => {
    if (view.inert) return Object.freeze([]);
    const n = view.columns, h = frame.size / n, data = new Int32Array(n * n);
    for (let c = 0; c < data.length; c++) data[c] = view.values[c] >= options.level ? view.labels[c] + 1 : 0;
    const domains = labelDomains({ width: n, height: n, data }, { background: 0, cell: h, origin: [frame.left, frame.top], simplify: options.smoothing * h, minArea: options.minArea * h * h, id: "bands" });
    return Object.freeze(domains.filter((d) => d.domain.regions.length > 0).map((d) => Object.freeze({ scale: d.label - 1, domain: d.domain })));
  });
}
