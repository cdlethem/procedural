import { convolve2DSigned } from "@procedurals/javascript";
import { componentSeed } from "./core.js";
import { mapPressure } from "./bristle.js";
import type { PressureMap } from "./bristle.js";
import { fillableRings, IsoField } from "./iso-rings.js";
import { depositionOrder } from "./strokes.js";
import type { Point } from "./types.js";
import type { DepositionOrder, ReliefStroke, StrokeSet } from "./strokes.js";

/**
 * Stroke relief: paths with width and load become a HEIGHT field, and the height field becomes a
 * lit, transparent PATCH. Three producers, each a frozen value cached by its construction:
 *
 * 1. `depositHeight(set, options)` -> `StrokeRelief`: `height` (canvas units) and `owner` (the
 *    stroke on top) per cell of a regular grid.
 * 2. `reliefNormals(relief)` -> `ReliefNormals`: the surface slopes by signed convolution.
 * 3. `shadeRelief(normals, light, material)` -> `ShadedPatch`: quantized light/shadow rectangles.
 *
 * A light edit re-runs only step 3: the height, owner and normals objects stay identical. A
 * palette edit re-runs nothing here. Not a paint rheology solver: nothing flows, dries or
 * conserves volume, and no physical claim is made.
 *
 * GRID. Cell `(i, j)` covers `[left + i c, left + (i+1) c) x [top + j c, top + (j+1) c)` and is
 * SAMPLED at its centre. The requested cell size is reduced (never enlarged) so that the columns
 * fit `bounds` exactly: `c = width / ceil(width / cell)`. At most 262,144 cells. A stroke thinner
 * than about two cells is undersampled (aliased): the documented resolving limit is
 * `width >= 2c`, and grooves need `pitch >= 3c`. Sampling is the only resolution dependence:
 * the volume of a straight stroke changes by less than 1% between cell sizes 1.25 and 4 for
 * strokes 20 units wide (tested).
 *
 * DEPOSITION. Each stroke is evaluated on its own: for a cell centre `q` the nearest point of the
 * polyline (round caps) gives the lateral distance `d`, the interpolated half width `hw`, the
 * lateral position `u = d / hw` in [0, 1] (signed `us` by side), the arc position `s` and load
 * `p`. The stroke's own height there is
 *
 *     h = H * A(p) * P(u) * (1 - G(us, s))
 *
 * `H` peak height (canvas units), `A(p) = floor + (1 - floor) p^curve` (`mapPressure`), `P` the
 * cross-section and `G` the furrow term, zero unless the section is `furrowed`. Where several
 * segments of one stroke reach a cell (tight bends, self-crossing loops) the stroke's own value is
 * that of the NEAREST centerline point whose footprint holds the cell (`d < hw`; ties keep the
 * earlier segment): a stroke never adds to itself, and subdividing a straight run does not change
 * a value. Coverage `c = clamp((hw - d) / cell + 0.5, 0, 1)` is a one-cell antialiased footprint; a cell is OWNED by a stroke when `c >= 0.5`,
 * that is `d <= hw`, exactly the footprint of the round-capped ribbon the flat layer draws.
 *
 * Cross-sections (u in [0, 1], `edgeRidge` r in [0, 3] adds a levee near each edge):
 *   round     `(1 - u^2)^1.25`
 *   flat      `smoothstep(0, 0.32, 1 - u)` (a plateau with rounded shoulders)
 *   furrowed  `smoothstep(0, 0.45, 1 - u)` cut by `furrows - 1` grooves across the stroke
 *   ridge     `r exp(-((u - 0.8) / 0.13)^2) smoothstep(0, 0.12, 1 - u)`, added to any of them
 * Furrow `k` (k = 0..furrows-2) sits at `u_k = -1 + 2 (k + 1 + j_k) / furrows`, `j_k` a stable
 * jitter in +-0.18 (of a pitch, so neighbours never merge) from `componentSeed(strokeSeed, "groove:k", ...)`, is `sigma = 0.64 / furrows` wide
 * in u units, but never less than `GROOVE_MIN_CELLS` cells (`1.6 c / hw` in u): thinner grooves
 * would alias, so too many furrows for the cell size fuse instead. It runs dry along the stroke:
 * its depth is `furrowDepth (0.3 + 0.7 streak(s))`, `streak` a sine of the stroke's ARC LENGTH
 * (wavelength 50-200 units), so it does not depend on the vertex spacing. `G` is the sum of the
 * grooves' Gaussians `exp(-((us - u_k) / sigma)^2)`, at most 1.
 *
 * OVERLAP (how strokes combine, chosen by the caller, in deposition order, cell by cell, with
 * `v` the stroke's own height and `c` its coverage):
 *   add       `h <- h + v`                 paint stacks; crossings are higher than either stroke
 *   max       `h <- max(h, v)`             the surface is the envelope; crossings equal the taller
 *   displace  `h <- (1 - c) h + c v`       the later stroke replaces what is under it (over-compositing)
 * OWNERSHIP is the same for all three: the owner of a cell is the LAST stroke in deposition order
 * that owns it (`c >= 0.5`), the paint on top. It never depends on which mode combines heights,
 * and it is exactly what the flat layer shows when it paints the ribbons in that order.
 *
 * NORMALS. Slopes `dh/dx, dh/dy` (dimensionless: canvas units of height per canvas unit) come
 * from the existing signed 3x3 convolution (`convolve2DSigned`, Sobel kernels, clamped edges) divided by
 * `8c`; the surface normal is `(-sx, -sy, 1) / |.|`. Clamping halves the slope of the outermost
 * cells only. A stroke that reaches the grid border therefore has no artificial wall there.
 *
 * SHADING. `azimuth` (degrees, clockwise on screen from up, the direction the light comes FROM) and
 * `elevation` (degrees above the page) give the unit vector to the light `L`
 * `(cos el sin az, -cos el cos az, sin el)` in canvas axes (x right, y down, z toward the viewer).
 * With `n` the normal and `H = (L + (0, 0, 1)) / |.|` the Blinn half vector, the signed shading is
 *
 *     s = contrast (n.L - L_z) + gloss max(0, (n.H)^shininess - H_z^shininess)
 *
 * so a flat surface has `s = 0` exactly (nothing is drawn where the height is constant), slopes
 * facing the light are positive (highlight) and slopes facing away negative (shadow). The shading
 * is weighted by the FOOTPRINT `w = clamp(2 (c - 1/2), 0, 1)` of the union coverage `c`: zero at the
 * footprint edge `d = hw` (where the flat layer ends), one half a cell inside it. `|s w|` is
 * banded into `SHADE_LEVELS` nested regions: level `k` is the region where `|s w| >= (k - 1/2) /
 * SHADE_LEVELS`, as filled polygons, so each cell-sized step is a contour at sub-cell accuracy
 * (`iso-rings.ts`: crossings are linear along grid edges) and no pixel grid shows. Nested
 * regions of one side are painted shallow to deep and each is filled at the alpha that compounds
 * with the shallower ones to `k / SHADE_LEVELS * PATCH_ALPHA`, so a point in level `k` and no
 * deeper has exactly that alpha. Holes are merged into their outer ring with one out-and-back
 * cut (`fillableRings`). The patch is transparent outside the strokes and where the surface is flat.
 * The existing chain assembler was not used for the contours: it is quadratic and capped at 2,200
 * segments per level, and these levels have thousands.
 *
 * FAILURE AND LIMITS. Invalid numbers throw naming the option. More than 262,144 cells, more than
 * 60 million cell-segment tests (measured, roughly one second) or more than 800,000 shading polygon
 * vertices throw with the control to change; nothing is truncated. Cancellation is checked between
 * strokes and every 64 segments and throws "Composition cancelled". Units: canvas units, degrees
 * for option angles, dimensionless slopes.
 */
export const MAX_RELIEF_CELLS = 262_144;
export const MAX_DEPOSIT_PAIRS = 60_000_000;
export const MAX_PATCH_VERTICES = 800_000;
export const SHADE_LEVELS = 16;
/** A groove is never narrower than this many cells (its sigma, in cells): thinner ones would alias. */
export const GROOVE_MIN_CELLS = 1.6;
export const PATCH_ALPHA = 0.85;

export type CrossSection = "round" | "flat" | "furrowed";
export type Overlap = "add" | "max" | "displace";
export const crossSections: readonly CrossSection[] = Object.freeze(["round", "flat", "furrowed"]);
export const overlaps: readonly Overlap[] = Object.freeze(["add", "max", "displace"]);

export interface ReliefGrid {
  readonly left: number;
  readonly top: number;
  /** Effective cell size in canvas units (never larger than requested). */
  readonly cell: number;
  readonly columns: number;
  readonly rows: number;
}

export interface DepositOptions {
  /** [left, top, right, bottom] in canvas units. */
  bounds: readonly [number, number, number, number];
  cell: number;
  /** Peak height of a full-load stroke in canvas units. */
  height: number;
  section: CrossSection;
  edgeRidge: number;
  /** Hairs across a furrowed stroke (`furrows - 1` grooves). */
  furrows: number;
  furrowDepth: number;
  /** Height factor of a load: `floor + (1 - floor) load^curve`. */
  loadMap: PressureMap;
  overlap: Overlap;
  order: DepositionOrder;
}

export interface StrokeRelief {
  readonly set: StrokeSet;
  readonly grid: ReliefGrid;
  readonly options: Readonly<DepositOptions>;
  /** Indices into `set.strokes`, first deposited first (the last is on top). */
  readonly order: readonly number[];
  /** Height in canvas units, row-major, `grid.columns * grid.rows` values, all >= 0. */
  readonly height: readonly number[];
  /** Index into `set.strokes` of the stroke on top of each cell, or -1. */
  readonly owner: readonly number[];
  /** Union antialiased footprint in [0, 1]: the largest coverage `c` any stroke has at the cell (see the header). */
  readonly coverage: readonly number[];
  /** Cells with an owner. */
  readonly owned: number;
  readonly peak: number;
  /** Cell-segment tests spent: the measured work. */
  readonly pairs: number;
}

function range(label: string, value: unknown, low: number, high: number): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high)
    throw new Error(`${label} must be a finite number in [${low}, ${high}]`);
}
function cachedBy<K extends object, V>(cache: WeakMap<K, Map<string, V>>, owner: K, key: string, size: number, make: () => V): V {
  let byKey = cache.get(owner);
  if (!byKey) { byKey = new Map(); cache.set(owner, byKey); }
  const hit = byKey.get(key);
  if (hit !== undefined) { byKey.delete(key); byKey.set(key, hit); return hit; }
  const value = make();
  byKey.set(key, value);
  if (byKey.size > size) byKey.delete(byKey.keys().next().value!);
  return value;
}
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};
const U32 = 0x1_0000_0000;
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
const TAU = Math.PI * 2;

function checkOptions(o: DepositOptions): void {
  const [l, t, r, b] = o.bounds;
  for (const [label, value] of [["bounds left", l], ["bounds top", t], ["bounds right", r], ["bounds bottom", b]] as const) range(label, value, -1e5, 1e5);
  if (!(r > l && b > t)) throw new Error("Relief bounds must have positive width and height");
  range("cell size", o.cell, 0.05, 1e4); range("height", o.height, 0, 1000); range("edge ridge", o.edgeRidge, 0, 3);
  range("furrowDepth", o.furrowDepth, 0, 1);
  if (!Number.isInteger(o.furrows) || o.furrows < 2 || o.furrows > 32) throw new Error("furrows must be an integer in [2, 32]");
  range("load floor", o.loadMap.floor, 0, 1); range("load curve", o.loadMap.curve, 0.05, 20);
  if (!crossSections.includes(o.section)) throw new Error(`Unknown cross-section: ${String(o.section)}`);
  if (!overlaps.includes(o.overlap)) throw new Error(`Unknown overlap rule: ${String(o.overlap)}`);
}

export function reliefGrid(bounds: readonly [number, number, number, number], cell: number): ReliefGrid {
  const [l, t, r, b] = bounds;
  const columns = Math.max(1, Math.ceil((r - l) / cell - 1e-9)), rows = Math.max(1, Math.ceil((b - t) / cell - 1e-9));
  if (columns * rows > MAX_RELIEF_CELLS)
    throw new Error(`The relief grid would have ${columns * rows} cells (${columns} x ${rows}); the limit is ${MAX_RELIEF_CELLS}. Raise the cell size`);
  return Object.freeze({ left: l, top: t, cell: Math.min((r - l) / columns, (b - t) / rows), columns, rows });
}

const PROFILE_STEPS = 4096;
/** Cross-section `P(u)` plus edge ridge on a table over u in [0, 1]; linear interpolation. */
export function crossSectionProfile(section: CrossSection, edgeRidge: number, u: number): number {
  const x = Math.min(1, Math.max(0, u));
  const base = section === "round" ? (1 - x * x) ** 1.25
    : section === "flat" ? smoothstep(0, 0.32, 1 - x) : smoothstep(0, 0.45, 1 - x);
  return base + edgeRidge * Math.exp(-(((x - 0.8) / 0.13) ** 2)) * smoothstep(0, 0.12, 1 - x);
}
function profileTable(section: CrossSection, edgeRidge: number): Float64Array {
  const table = new Float64Array(PROFILE_STEPS + 2);
  for (let i = 0; i <= PROFILE_STEPS; i++) table[i] = crossSectionProfile(section, edgeRidge, i / PROFILE_STEPS);
  table[PROFILE_STEPS + 1] = table[PROFILE_STEPS];
  return table;
}

interface Grooves { position: Float64Array; wavelength: Float64Array; phase: Float64Array; count: number; sigma: number }
function grooves(stroke: ReliefStroke, furrows: number): Grooves {
  const count = furrows - 1;
  const position = new Float64Array(count), wavelength = new Float64Array(count), phase = new Float64Array(count);
  for (let k = 0; k < count; k++) {
    const jitter = (unit(stroke.seed, `groove:${k}`, "position") * 2 - 1) * 0.18;
    position[k] = -1 + 2 * (k + 1 + jitter) / furrows;
    wavelength[k] = 50 + 150 * unit(stroke.seed, `groove:${k}`, "wavelength");
    phase[k] = TAU * unit(stroke.seed, `groove:${k}`, "phase");
  }
  return { position, wavelength, phase, count, sigma: 0.64 / furrows };
}
/** `G(us, s)`: the summed grooves' cut at signed lateral position `us` and arc position `s`. */
function grooveCut(g: Grooves, depth: number, us: number, s: number, sigma: number): number {
  let cut = 0;
  const near = Math.round((us + 1) / 2 * (g.count + 1) - 1);
  for (let k = Math.max(0, near - 2); k <= Math.min(g.count - 1, near + 2); k++) {
    const x = (us - g.position[k]) / sigma;
    if (x > 4 || x < -4) continue;
    const streak = 0.5 + 0.5 * Math.sin(TAU * s / g.wavelength[k] + g.phase[k]);
    cut += depth * (0.3 + 0.7 * streak) * Math.exp(-x * x);
  }
  return Math.min(1, cut);
}

/** Inclusive cell range a segment can touch (its half width plus half a cell of antialiasing), or null. */
function segmentCells(grid: ReliefGrid, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number): [number, number, number, number] | null {
  const reach = Math.max(w0, w1) / 2 + grid.cell / 2;
  if (!(reach > grid.cell / 2)) return null;
  const i0 = Math.max(0, Math.floor((Math.min(x0, x1) - reach - grid.left) / grid.cell)), i1 = Math.min(grid.columns - 1, Math.floor((Math.max(x0, x1) + reach - grid.left) / grid.cell));
  const j0 = Math.max(0, Math.floor((Math.min(y0, y1) - reach - grid.top) / grid.cell)), j1 = Math.min(grid.rows - 1, Math.floor((Math.max(y0, y1) + reach - grid.top) / grid.cell));
  return i1 < i0 || j1 < j0 ? null : [i0, i1, j0, j1];
}

/** Work a deposition would spend, from the geometry alone (cell-segment tests). */
export function depositWork(set: StrokeSet, grid: ReliefGrid): number {
  let pairs = 0;
  for (const stroke of set.strokes) for (let i = 0; i + 1 < stroke.points.length; i++) {
    const box = segmentCells(grid, stroke.points[i][0], stroke.points[i][1], stroke.points[i + 1][0], stroke.points[i + 1][1], stroke.widths[i], stroke.widths[i + 1]);
    if (box) pairs += (box[1] - box[0] + 1) * (box[3] - box[2] + 1);
  }
  return pairs;
}

const reliefCache = new WeakMap<StrokeSet, Map<string, StrokeRelief>>();
/** Entries kept per owner: a height field, its slopes and a patch are megabytes, and an inspector edits one at a time. */
const RELIEFS_PER_SET = 2, PATCHES_PER_NORMALS = 3;
export interface DepositControl { cancelled?: () => boolean }

/**
 * Deposit the strokes (see the header). The result is frozen and cached by the set object and
 * every option; palette, colour and light never enter it.
 */
export function depositHeight(set: StrokeSet, options: DepositOptions, control: DepositControl = {}): StrokeRelief {
  checkOptions(options);
  const key = JSON.stringify([options.bounds, options.cell, options.height, options.section, options.edgeRidge, options.furrows, options.furrowDepth, options.loadMap, options.overlap, options.order]);
  return cachedBy(reliefCache, set, key, RELIEFS_PER_SET, () => {
    const grid = reliefGrid(options.bounds, options.cell);
    const pairs = depositWork(set, grid);
    if (pairs > MAX_DEPOSIT_PAIRS)
      throw new Error(`Deposition would test ${pairs} cell-segment pairs; the limit is ${MAX_DEPOSIT_PAIRS}. Raise the cell size, narrow the strokes or lower the number of hairs`);
    const cells = grid.columns * grid.rows, cell = grid.cell;
    const order = depositionOrder(set, options.order);
    const height = new Float64Array(cells), owner = new Int32Array(cells).fill(-1), cover = new Float64Array(cells);
    const sv = new Float64Array(cells), sc = new Float64Array(cells), nearest = new Float64Array(cells).fill(Infinity), touched = new Int32Array(cells), stamp = new Uint8Array(cells);
    const table = profileTable(options.section, options.edgeRidge), furrowed = options.section === "furrowed" && options.furrowDepth > 0;
    const H = options.height;
    let segments = 0;
    for (const index of order) {
      if (control.cancelled?.()) throw new Error("Composition cancelled");
      const stroke = set.strokes[index], pts = stroke.points, n = pts.length;
      const groove = furrowed ? grooves(stroke, options.furrows) : null;
      let touchedCount = 0;
      for (let seg = 0; seg + 1 < n; seg++) {
        if ((++segments & 63) === 0 && control.cancelled?.()) throw new Error("Composition cancelled");
        const x0 = pts[seg][0], y0 = pts[seg][1], x1 = pts[seg + 1][0], y1 = pts[seg + 1][1];
        const w0 = stroke.widths[seg], w1 = stroke.widths[seg + 1];
        const box = segmentCells(grid, x0, y0, x1, y1, w0, w1);
        if (!box) continue;
        const ex = x1 - x0, ey = y1 - y0, len2 = ex * ex + ey * ey, len = Math.sqrt(len2);
        const l0 = stroke.loads[seg], dl = stroke.loads[seg + 1] - l0, dw = w1 - w0, a0 = stroke.arcs[seg];
        for (let cy = box[2]; cy <= box[3]; cy++) {
          const py = grid.top + (cy + 0.5) * cell, dy = py - y0;
          for (let cx = box[0]; cx <= box[1]; cx++) {
            const px = grid.left + (cx + 0.5) * cell, dx = px - x0;
            let t = len2 > 0 ? (dx * ex + dy * ey) / len2 : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const rx = px - (x0 + t * ex), ry = py - (y0 + t * ey);
            const hw = 0.5 * (w0 + dw * t);
            if (!(hw > 0)) continue;
            const d = Math.sqrt(rx * rx + ry * ry), coverage = (hw - d) / cell + 0.5;
            if (coverage <= 0) continue;
            const at = cy * grid.columns + cx;
            if (!stamp[at]) { stamp[at] = 1; touched[touchedCount++] = at; }
            // The stroke's height here is that of the nearest centerline point whose footprint holds the cell.
            if (d < hw && d < nearest[at]) {
              const u = d / hw, position = u * PROFILE_STEPS, i = Math.floor(position);
              let shape = table[i] + (table[i + 1] - table[i]) * (position - i);
              if (groove) shape *= 1 - grooveCut(groove, options.furrowDepth, (ex * ry - ey * rx) < 0 ? -u : u, a0 + t * len, Math.max(groove.sigma, GROOVE_MIN_CELLS * cell / hw));
              nearest[at] = d;
              sv[at] = H * mapPressure(l0 + dl * t, options.loadMap) * shape;
            }
            const c = coverage >= 1 ? 1 : coverage;
            if (c > sc[at]) sc[at] = c;
          }
        }
      }
      for (let k = 0; k < touchedCount; k++) {
        const at = touched[k], v = sv[at], c = sc[at];
        sv[at] = 0; sc[at] = 0; nearest[at] = Infinity; stamp[at] = 0;
        if (options.overlap === "add") height[at] += v;
        else if (options.overlap === "max") { if (v > height[at]) height[at] = v; }
        else height[at] = (1 - c) * height[at] + c * v;
        if (c >= 0.5) owner[at] = index;
        if (c > cover[at]) cover[at] = c;
      }
    }
    let owned = 0, peak = 0;
    for (let i = 0; i < cells; i++) { if (owner[i] >= 0) owned++; if (height[i] > peak) peak = height[i]; }
    return Object.freeze({ set, grid, options: Object.freeze({ ...options, loadMap: Object.freeze({ ...options.loadMap }) }), order,
      height: Object.freeze(Array.from(height)), owner: Object.freeze(Array.from(owner)), coverage: Object.freeze(Array.from(cover)), owned, peak, pairs });
  });
}

const pigmentCache = new WeakMap<StrokeRelief, Map<string, readonly number[]>>();
/** Pigment per cell: `tones[strokeIndex]` of each cell's owner, or -1 where no stroke owns it. Cached on the relief by the tones. */
export function pigmentField(relief: StrokeRelief, tones: readonly number[]): readonly number[] {
  if (tones.length !== relief.set.strokes.length) throw new Error(`Pigment needs one tone per stroke (${relief.set.strokes.length}); got ${tones.length}`);
  return cachedBy(pigmentCache, relief, tones.join(","), 2, () => Object.freeze(relief.owner.map((index) => index < 0 ? -1 : tones[index])));
}

export interface ReliefNormals {
  readonly relief: StrokeRelief;
  /** dh/dx and dh/dy, dimensionless, row-major like the height. */
  readonly slopeX: readonly number[];
  readonly slopeY: readonly number[];
}
// The existing convolution flips its kernel, so these give +8 dh/dx and +8 dh/dy (y grows down the canvas).
const SOBEL_X = Object.freeze([1, 0, -1, 2, 0, -2, 1, 0, -1]);
const SOBEL_Y = Object.freeze([1, 2, 1, 0, 0, 0, -1, -2, -1]);
const normalsCache = new WeakMap<StrokeRelief, ReliefNormals>();

/** Slopes of the height by signed convolution; cached on the relief object. */
export function reliefNormals(relief: StrokeRelief): ReliefNormals {
  const hit = normalsCache.get(relief);
  if (hit) return hit;
  const { columns, rows, cell } = relief.grid;
  const slopes = (kernel: readonly number[]) => Object.freeze(convolve2DSigned({ values: relief.height, columns, rows, kernel: [...kernel],
    kernelColumns: 3, kernelRows: 3, boundary: "clamp", maxWork: columns * rows * 9 }).values.map((v: number) => v / (8 * cell) + 0));
  const normals: ReliefNormals = Object.freeze({ relief, slopeX: slopes(SOBEL_X), slopeY: slopes(SOBEL_Y) });
  normalsCache.set(relief, normals);
  return normals;
}

/** Unit normal `(-sx, -sy, 1) / |.|` of one cell. */
export function normalAt(normals: ReliefNormals, cell: number): readonly [number, number, number] {
  const sx = normals.slopeX[cell], sy = normals.slopeY[cell], k = 1 / Math.sqrt(1 + sx * sx + sy * sy);
  return [-sx * k, -sy * k, k];
}

export interface Light { azimuth: number; elevation: number }
export interface ShadeMaterial { contrast: number; gloss: number; shininess: number }

/** Unit vector from the surface toward the light in canvas axes (x right, y down, z toward the viewer). */
export function lightVector(light: Light): readonly [number, number, number] {
  range("light azimuth", light.azimuth, -3600, 3600); range("light elevation", light.elevation, 1, 90);
  const az = light.azimuth * Math.PI / 180, el = light.elevation * Math.PI / 180;
  return [Math.cos(el) * Math.sin(az), -Math.cos(el) * Math.cos(az), Math.sin(el)];
}
function checkMaterial(m: ShadeMaterial): void {
  range("shading contrast", m.contrast, 0, 50); range("gloss", m.gloss, 0, 20); range("shininess", m.shininess, 1, 500);
}

/** Signed shading of one surface slope (see the header): positive lit, negative shaded, zero for a flat surface. */
export function shadeSlope(slopeX: number, slopeY: number, light: Light, material: ShadeMaterial): number {
  checkMaterial(material);
  const L = lightVector(light);
  return shading(slopeX, slopeY, L, halfVector(L), material);
}
function halfVector(L: readonly [number, number, number]): readonly [number, number, number] {
  const hz = L[2] + 1, k = 1 / Math.sqrt(L[0] * L[0] + L[1] * L[1] + hz * hz);
  return [L[0] * k, L[1] * k, hz * k];
}
function shading(sx: number, sy: number, L: readonly [number, number, number], H: readonly [number, number, number], m: ShadeMaterial): number {
  const k = 1 / Math.sqrt(1 + sx * sx + sy * sy), nx = -sx * k, ny = -sy * k, nz = k;
  const diffuse = nx * L[0] + ny * L[1] + nz * L[2] - L[2];
  const specular = Math.max(0, (Math.max(0, nx * H[0] + ny * H[1] + nz * H[2])) ** m.shininess - H[2] ** m.shininess);
  return m.contrast * diffuse + m.gloss * specular;
}

/** The signed shading of every cell, unmasked and unquantized. */
export function shadeField(normals: ReliefNormals, light: Light, material: ShadeMaterial): readonly number[] {
  checkMaterial(material);
  const L = lightVector(light), H = halfVector(L), out = new Array<number>(normals.slopeX.length);
  for (let i = 0; i < out.length; i++) out[i] = shading(normals.slopeX[i], normals.slopeY[i], L, H, material);
  return Object.freeze(out);
}

export interface ShadeBand {
  readonly side: "shadow" | "light";
  /** 1..SHADE_LEVELS: the region where the shading is at least `(level - 1/2) / SHADE_LEVELS`. */
  readonly level: number;
  /** Alpha this region is filled with, so that nested regions compound to `total`. */
  readonly alpha: number;
  /** Alpha at a point inside this level and no deeper one: `level / SHADE_LEVELS * PATCH_ALPHA`. */
  readonly total: number;
  /** Filled polygons (each hole already merged into its outer ring), in canvas units, each as flat x, y, x, y, ... */
  readonly polygons: readonly (readonly number[])[];
}
export interface ShadedPatch {
  readonly grid: ReliefGrid;
  readonly light: Readonly<Light>;
  readonly material: Readonly<ShadeMaterial>;
  /** Shadow levels then light levels, each ascending; nested regions of one side are painted shallow to deep. */
  readonly bands: readonly ShadeBand[];
  readonly polygonCount: number;
  readonly vertexCount: number;
}
const patchCache = new WeakMap<ReliefNormals, Map<string, ShadedPatch>>();

/** The footprint weight of a coverage: 0 at the footprint edge (`c = 1/2`), 1 half a cell inside it. */
export const footprintWeight = (coverage: number): number => Math.min(1, Math.max(0, 2 * (coverage - 0.5)));

/** The lit transparent patch (see the header). Cached on the normals object by light and material. */
export function shadeRelief(normals: ReliefNormals, light: Light, material: ShadeMaterial): ShadedPatch {
  checkMaterial(material); lightVector(light);
  const key = JSON.stringify([light.azimuth, light.elevation, material.contrast, material.gloss, material.shininess]);
  return cachedBy(patchCache, normals, key, PATCHES_PER_NORMALS, () => {
    const { relief } = normals, { grid } = relief, { columns, rows, cell, left, top } = grid;
    const signed = shadeField(normals, light, material);
    const shadow = new Float64Array(columns * rows), lit = new Float64Array(columns * rows);
    for (let i = 0; i < signed.length; i++) {
      const s = signed[i] * footprintWeight(relief.coverage[i]);
      if (s < 0) shadow[i] = -s; else lit[i] = s;
    }
    const bands: ShadeBand[] = [];
    let polygonCount = 0, vertexCount = 0, previous = 0;
    for (const [side, values] of [["shadow", shadow], ["light", lit]] as const) {
      const field = new IsoField({ values, columns, rows, x0: left + cell / 2, y0: top + cell / 2, dx: cell, dy: cell, outside: 0 });
      previous = 0;
      for (let level = 1; level <= SHADE_LEVELS; level++) {
        let rings: Point[][];
        try { rings = field.rings((level - 0.5) / SHADE_LEVELS, MAX_PATCH_VERTICES - vertexCount); }
        catch { throw new Error(`Shading would draw more than ${MAX_PATCH_VERTICES} polygon vertices; raise the cell size or lower the shading depth or the height`); }
        const total = level / SHADE_LEVELS * PATCH_ALPHA;
        if (rings.length === 0) break;
        const polygons = fillableRings(rings).map((ring) => Object.freeze(ring.flatMap(([x, y]) => [x, y])));
        for (const polygon of polygons) vertexCount += polygon.length / 2;
        polygonCount += polygons.length;
        if (vertexCount > MAX_PATCH_VERTICES)
          throw new Error(`Shading would draw more than ${MAX_PATCH_VERTICES} polygon vertices; raise the cell size or lower the shading depth or the height`);
        bands.push(Object.freeze({ side, level, alpha: 1 - (1 - total) / (1 - previous), total, polygons: Object.freeze(polygons) }));
        previous = total;
      }
    }
    return Object.freeze({ grid, light: Object.freeze({ ...light }), material: Object.freeze({ ...material }), bands: Object.freeze(bands), polygonCount, vertexCount });
  });
}

