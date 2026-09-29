import { marchingSquares2D } from "@procedurals/javascript";
import { atEach, cachedBy, componentSeed } from "./core.js";
import { DOT_ALPHA } from "./materials.js";
import { contourChains } from "./sources.js";
import type { CompositionRun, CompositionSurface, Mark, Path, Point, Site } from "./types.js";

/**
 * Grains: the release-fall-land kinematics, the density accumulation and the exposure consumer shared
 * by every technique that lets material fall from something that moves. Gesture Scores drops sand
 * from a hand's track; Sand Deposition drops it from a moving spline. Both call the functions here.
 *
 * KINEMATICS. `landGrain` is the whole fall model: a grain released from an `Emitter` (position,
 * speed in canvas units per second, unit direction of that velocity) lands after a delay
 * `lag * uLag` seconds at `P + (inherit * V + F) * delay + scatter`, `F` the fall velocity
 * (`fall` units per second toward `fallAngle` degrees, 90 is down the canvas) and scatter an isotropic
 * normal of standard deviation `spread`. Uniform draws are supplied by the caller so identity and
 * seeding stay with the producer. It reports the landing point and the frame angle along
 * `inherit * V + F` (the emitter's `heading` when both vanish).
 *
 * DENSITY. `accumulateDensity` splats each grain's MASS onto a regular grid of cell centres with
 * bilinear weights (cloud in cell). The field value is mass per canvas unit squared, the sum over
 * cells of `value * cell^2` is the mass of the grains inside the grid (mass is conserved exactly up to
 * rounding, whatever the cell size), and grains outside the grid are reported, never redistributed.
 * `smoothDensity` is a Gaussian that scatters each cell's mass to its neighbours and mirrors what
 * would leave the grid back into it, so smoothing conserves mass as well.
 *
 * EXPOSURE. A grain of mass `m` whose mark covers `footprint` canvas units squared is drawn with
 * `alpha = 1 - exp(-gain * m / footprint)` and `gain = 2^stops`. Overlapping grains composite as
 * `1 - prod(1 - alpha)`, so where `D` is the local density the picture approaches `1 - exp(-gain * D)`
 * whatever the number of grains: splitting the same mass over more, smaller grains keeps the tone.
 * A stock dot cannot exceed `DOT_ALPHA`; the excess is clipped. A grain fainter than `MIN_GRAIN_ALPHA`
 * is drawn at that alpha with probability `alpha / MIN_GRAIN_ALPHA` (a stable per-grain draw), so the
 * expected coverage is kept without alphas the canvas cannot store. Exposure never moves a grain, and
 * raising it only adds grains or strengthens them.
 *
 * Every value is frozen; caches are keyed by the identity of the frozen input and the construction
 * numbers. Units: canvas units, seconds for velocities and delays, degrees for option angles,
 * radians for published angles.
 */

const TAU = Math.PI * 2;
const U32 = 0x1_0000_0000;

/** Where a grain leaves: canvas position, speed (units per second) and the unit direction of that velocity. */
export interface Emitter { x: number; y: number; speed: number; tx: number; ty: number }
export interface FallModel {
  /** Longest fall delay in milliseconds; each grain draws a stable fraction of it. */
  lag: number;
  /** Fall speed, canvas units per second, in direction `fallAngle`. */
  fall: number;
  /** Degrees; 90 falls toward the bottom of the canvas. */
  fallAngle: number;
  /** Share of the emitter's velocity a grain keeps while it falls. */
  inherit: number;
  /** Standard deviation of the isotropic landing scatter, canvas units. */
  spread: number;
}
/** Uniform draws in [0, 1) the model consumes. */
export interface FallDraws { lag: number; radius: number; around: number }
export interface Landing { x: number; y: number; angle: number }

/** Fall velocity `F` in canvas units per second. */
export function fallVelocity(model: Pick<FallModel, "fall" | "fallAngle">): readonly [number, number] {
  return [model.fall * Math.cos(model.fallAngle * Math.PI / 180), model.fall * Math.sin(model.fallAngle * Math.PI / 180)];
}

export function landGrain(from: Emitter, heading: number, model: FallModel, fall: readonly [number, number], draws: FallDraws): Landing {
  const delay = model.lag * draws.lag / 1000;
  const vx = model.inherit * from.speed * from.tx + fall[0], vy = model.inherit * from.speed * from.ty + fall[1];
  const radius = model.spread * Math.sqrt(-2 * Math.log(1 - draws.radius)), around = TAU * draws.around;
  return { x: from.x + vx * delay + radius * Math.cos(around), y: from.y + vy * delay + radius * Math.sin(around),
    angle: Math.hypot(vx, vy) > 1e-9 ? Math.atan2(vy, vx) : heading };
}

/** A site that carries mass (one grain of a deposit). */
export interface DepositGrain extends Site {
  /** Mass in area units: the paper one grain covers at gain 1 and alpha 1 - 1/e. */
  readonly mass: number;
  /** Milliseconds from the start of the sequence at which the grain left. */
  readonly time: number;
  /** Where the grain left the emitter (its landing site is `position`). */
  readonly origin: Point;
}

const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
function finite(label: string, value: number, low: number, high: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high)
    throw new Error(`${label} must be a finite number in [${low}, ${high}]`);
}
/* ---------------------------------------------------------------- exposure */

export interface ExposureSpec {
  /** Photographic stops: gain is `2^stops`. */
  stops: number;
  /** Canvas units squared one grain's mark covers (`pi * (size / 2)^2` for a dot). */
  footprint: number;
}
export const MIN_GRAIN_ALPHA = 1 / 16;
export const EXPOSURE_LIMITS = Object.freeze({ minStops: -10, maxStops: 10, minFootprint: 1e-6 });

function checkExposure(spec: ExposureSpec): void {
  finite("Exposure stops", spec.stops, EXPOSURE_LIMITS.minStops, EXPOSURE_LIMITS.maxStops);
  finite("Grain footprint", spec.footprint, EXPOSURE_LIMITS.minFootprint, 1e9);
}

/** Alpha (out of 1) a grain of this mass is drawn with before the mark's own ceiling. */
export function grainAlpha(mass: number, spec: ExposureSpec): number {
  return 1 - Math.exp(-(2 ** spec.stops) * mass / spec.footprint);
}

const exposureCache = new WeakMap<readonly DepositGrain[], Map<string, readonly Site[]>>();

/**
 * The grains a consumer draws at this exposure: each kept grain as a `Site` with `opacity` set so that
 * a stock dot's alpha equals `grainAlpha` (clipped to the dot's own alpha). Positions, frames, ids and
 * seeds are the producer's own objects. Cached by grains, stops and footprint.
 */
export function exposeGrains(grains: readonly DepositGrain[], spec: ExposureSpec): readonly Site[] {
  checkExposure(spec);
  return cachedBy(exposureCache, grains, `${spec.stops}|${spec.footprint}`, () => {
    const kept: Site[] = [];
    for (const grain of grains) {
      if (typeof grain.mass !== "number" || !(grain.mass >= 0)) throw new Error(`Grain ${grain.id} has no valid mass; exposure needs mass`);
      const alpha = grainAlpha(grain.mass, spec);
      if (alpha < MIN_GRAIN_ALPHA && unit(grain.seed, grain.id, "expose") >= alpha / MIN_GRAIN_ALPHA) continue;
      kept.push(Object.freeze({ ...grain, opacity: Math.min(1, Math.max(alpha, MIN_GRAIN_ALPHA) / DOT_ALPHA) }));
    }
    return Object.freeze(kept);
  });
}

export interface GrainConsumer {
  /** The mark drawn at each grain (any `Mark`; the stock `motif` dot, rings or arrow). */
  mark: Mark;
  /** Absent: every grain is drawn by the mark alone, at the mark's own alpha (Gesture Scores' sand). */
  exposure?: ExposureSpec;
}

/**
 * Draw grains through a mark at their landing sites, one isolated callback each (charged to the run).
 * With an exposure the grains must carry mass and are first passed through `exposeGrains`.
 */
export function depositGrains<S extends CompositionSurface>(surface: S, grains: readonly Site[], consumer: GrainConsumer, run: CompositionRun): void {
  const sites = consumer.exposure ? exposeGrains(grains as readonly DepositGrain[], consumer.exposure) : grains;
  atEach(surface, sites, consumer.mark, run);
}

/* ----------------------------------------------------------------- density */

export const MAX_FIELD_CELLS = 250_000;
const MAX_SMOOTH_CELLS = 60;

export interface DensityField {
  /** Left and top edge of the grid, canvas units. */
  readonly left: number;
  readonly top: number;
  /** Edge of one square cell, canvas units. */
  readonly cell: number;
  readonly columns: number;
  readonly rows: number;
  /** Row-major mass per canvas unit squared at the cell centres `(left + (i + .5) cell, top + (j + .5) cell)`. */
  readonly values: readonly number[];
  /** Mass inside the grid: the sum of `value * cell^2`. */
  readonly mass: number;
  /** Mass of the grains that landed outside the grid. */
  readonly outside: number;
  /** Grains that landed inside. */
  readonly grains: number;
}

const fieldCache = new WeakMap<readonly { readonly position: Point; readonly mass: number }[], Map<string, DensityField>>();

/**
 * Accumulate grain mass on a grid over `[left, top, right, bottom]` (the grid covers whole cells, so it
 * may extend past `right` and `bottom` by less than one cell). Work is `columns * rows`, limited by
 * `MAX_FIELD_CELLS`.
 */
export function accumulateDensity(grains: readonly { readonly position: Point; readonly mass: number }[],
  bounds: readonly [number, number, number, number], cell: number): DensityField {
  const [left, top, right, bottom] = bounds;
  for (const [label, value] of [["left", left], ["top", top], ["right", right], ["bottom", bottom]] as const) finite(`Field ${label}`, value, -1e6, 1e6);
  if (!(right > left) || !(bottom > top)) throw new Error("Field bounds must have positive width and height");
  finite("Field cell", cell, 1e-3, 1e5);
  const columns = Math.ceil((right - left) / cell), rows = Math.ceil((bottom - top) / cell);
  if (columns * rows > MAX_FIELD_CELLS)
    throw new Error(`Density field would need ${columns * rows} cells; the limit is ${MAX_FIELD_CELLS}. Raise the field cell size`);
  return cachedBy(fieldCache, grains, [left, top, right, bottom, cell].join("|"), () => {
    const values = new Float64Array(columns * rows), area = cell * cell;
    let outside = 0, inside = 0;
    for (const grain of grains) {
      const gx = (grain.position[0] - left) / cell - 0.5, gy = (grain.position[1] - top) / cell - 0.5;
      if (!(gx > -0.5 && gx < columns - 0.5 && gy > -0.5 && gy < rows - 0.5)) { outside += grain.mass; continue; }
      inside++;
      const i0 = Math.floor(gx), j0 = Math.floor(gy), fx = gx - i0, fy = gy - j0;
      // Cells past the grid edge take the edge cell's share, so a grain in the outer half cell keeps all its mass.
      const ia = Math.min(columns - 1, Math.max(0, i0)), ib = Math.min(columns - 1, Math.max(0, i0 + 1));
      const ja = Math.min(rows - 1, Math.max(0, j0)), jb = Math.min(rows - 1, Math.max(0, j0 + 1));
      const m = grain.mass / area;
      values[ja * columns + ia] += m * (1 - fx) * (1 - fy);
      values[ja * columns + ib] += m * fx * (1 - fy);
      values[jb * columns + ia] += m * (1 - fx) * fy;
      values[jb * columns + ib] += m * fx * fy;
    }
    let total = 0;
    for (const v of values) total += v;
    return Object.freeze({ left, top, cell, columns, rows, values: Object.freeze(Array.from(values)), mass: total * area, outside, grains: inside });
  });
}

const smoothCache = new WeakMap<DensityField, Map<string, DensityField>>();
const mirror = (index: number, count: number): number => {
  const period = 2 * count;
  const wrapped = ((index % period) + period) % period;
  return wrapped < count ? wrapped : period - 1 - wrapped;
};

/** Gaussian of standard deviation `sigma` canvas units that scatters each cell's mass and mirrors the overflow back. */
export function smoothDensity(field: DensityField, sigma: number): DensityField {
  finite("Smoothing", sigma, 0, 1e4);
  if (sigma === 0) return field;
  const s = sigma / field.cell, radius = Math.max(1, Math.ceil(3 * s));
  if (radius > MAX_SMOOTH_CELLS) throw new Error(`Smoothing ${sigma} spans ${radius} cells; the limit is ${MAX_SMOOTH_CELLS}. Lower the smoothing or raise the field cell size`);
  return cachedBy(smoothCache, field, String(sigma), () => {
    const weights = new Float64Array(2 * radius + 1);
    let sum = 0;
    for (let k = -radius; k <= radius; k++) { weights[k + radius] = Math.exp(-(k * k) / (2 * s * s)); sum += weights[k + radius]; }
    for (let k = 0; k < weights.length; k++) weights[k] /= sum;
    const { columns, rows } = field;
    const across = new Float64Array(columns * rows), out = new Float64Array(columns * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const v = field.values[j * columns + i];
      if (v === 0) continue;
      for (let k = -radius; k <= radius; k++) across[j * columns + mirror(i + k, columns)] += weights[k + radius] * v;
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const v = across[j * columns + i];
      if (v === 0) continue;
      for (let k = -radius; k <= radius; k++) out[mirror(j + k, rows) * columns + i] += weights[k + radius] * v;
    }
    let total = 0;
    for (const v of out) total += v;
    return Object.freeze({ ...field, values: Object.freeze(Array.from(out)), mass: total * field.cell * field.cell });
  });
}

const contourCache = new WeakMap<DensityField, Map<string, readonly Path[]>>();

/**
 * Isolines of the density at the given levels (mass per canvas unit squared, ascending or not), through
 * the same marching squares and chain assembly as Contour Scores. The grid is padded by one empty
 * cell so every line closes around the deposit instead of ending at the grid edge. `Path.level` is the
 * density and `levelFraction` the position in `levels`.
 */
export function densityContours(field: DensityField, levels: readonly number[], seed: number): readonly Path[] {
  if (levels.length > 32) throw new Error("At most 32 isoline levels are supported");
  for (const level of levels) finite("Isoline level", level, 1e-12, 1e12);
  return cachedBy(contourCache, field, `${seed}|${levels.join(",")}`, () => {
    if (levels.length === 0) return Object.freeze([]);
    const columns = field.columns + 2, rows = field.rows + 2, values: number[] = new Array(columns * rows).fill(0);
    for (let j = 0; j < field.rows; j++) for (let i = 0; i < field.columns; i++) values[(j + 1) * columns + i + 1] = field.values[j * field.columns + i];
    const origin: [number, number] = [field.left - field.cell / 2, field.top - field.cell / 2];
    const maxWork = columns * rows + (columns - 1) * (rows - 1);
    const contours = levels.map((level) => ({ level, segments: marchingSquares2D({
      values, columns, rows, origin, spacing: [field.cell, field.cell], threshold: level, maxWork }).segments as number[][] }));
    return contourChains(contours, seed, levels.length, (x, y) => [x, y],
      ". Raise the field cell size or the isoline smoothing, or lower the exposure");
  });
}
