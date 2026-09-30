import { adoptLabelGrid, adoptScalarGrid, gridStorage, linearToSrgb, rasterMapping, resizeRaster, sampleInto, valueField } from "./raster.js";
import type { LabelGrid, Raster, SampleFilter, ScalarGrid } from "./raster.js";
import type { WarpOptions } from "./types.js";
import { warpMapper } from "./warp.js";

/**
 * Two raster consumers of the Fold Atlas coordinate maps (`warp.ts`), and the semantics that separate them.
 *
 * **Forward mapping with collisions** (`foldSamples` -> `foldMapped` -> `foldDensity` -> `tonemapDensity`).
 * A set of source samples is pushed through the chained maps. Each sample lands in one output cell and adds 1 to it:
 * where a fold sends several source regions onto the same place, their samples SUM (many-to-one accumulate). A cell
 * no sample reached stays 0: a hole is a hole, never filled from neighbours and never interpolated. Every sample is
 * accounted for: `total + excluded + outside = samples` (`excluded`: the map sent it to a singularity or past the
 * bound, exactly the `warpPoint` rule; `outside`: it landed outside the frame). Exposure and tone response are a
 * separate stage that reads the finished counts, so they can never move a mapped sample.
 *
 * **Inverse raster sampling** (`foldPreimages` -> `foldColors`). For every output cell centre `c` the map is inverted
 * numerically (`invertMap`) and the source raster is read at the preimage. There is no accumulation: each cell shows
 * ONE source point, so where a fold puts two source regions over the same place only one sheet is visible, chosen by
 * `sheet` (`front`: the orientation-preserving sheet, positive Jacobian determinant, wins; `back`: the mirrored one).
 * A cell is excluded (drawn as nothing, never interpolated) when no start converges to an in-domain preimage.
 *
 * | | forward | inverse |
 * |---|---|---|
 * | loops over | source samples | output cells |
 * | many-to-one (fold) | counts add: density is the sum over all sheets | one sheet is chosen; the others are hidden |
 * | one-to-many (stretch) | cells between sparse samples stay holes | every cell inside the image gets a sample: no holes |
 * | singularity | sample dropped (counted) | cell excluded when it has no reachable preimage |
 *
 * Inversion method: damped Newton on F(p) = c with a forward-difference Jacobian (step `1e-5` radius), residual tolerance
 * `1e-6` radius, at most 24 iterations, each step halved up to five times until the residual falls; a step that hits a
 * point the maps exclude, a singular Jacobian (|det| < 1e-9) or an unimproved residual ends that start as not converged.
 * `search: "nearest"` uses one start, the cell centre itself. `search: "sheets"` also starts at the centres of a
 * `starts` x `starts` lattice of the source rectangle and keeps, among the converged in-domain preimages, the one on
 * the preferred sheet, then the one nearest the cell centre, then the first found. Only when all of those find nothing
 * does a cell also try, as starts, the preimages of the cell to its left and the cell above (a continuation that reaches
 * cells hugging a fold line). Exclusion rule: a cell is excluded exactly when no start converges to a preimage inside
 * the source rectangle (status `outside` if some start converged out of it, `unconverged` if none converged).
 *
 * Sampling reads the source through `sampleInto` with the stated filter, the `clamp` edge rule (a preimage is inside the
 * source rectangle, so the rule only shapes the outermost half pixel) and interpolation in LINEAR light; the result is
 * encoded back to sRGB. Rasters must have no alpha channel.
 *
 * Stages are cached by construction (12 entries each): a stage's key holds only what it reads, so palette, exposure,
 * levels, shade and display edits reuse the very same objects. Every result is deeply frozen (grids keep their storage
 * private); nothing here draws.
 */

export interface FoldRect { x: number; y: number; width: number; height: number }

export const FOLD_LIMITS = Object.freeze({
  /** Output cells per frame. */
  cells: 40_000,
  /** Source samples. */
  samples: 400_000,
  /** Forward-mapped seed points for the inverse sheet search. */
  seeds: 300_000,
  /** Newton iterations per start. */
  iterations: 24,
});

const NEWTON_TOLERANCE = 1e-6, DIFFERENCE_STEP = 1e-5, MIN_DETERMINANT = 1e-9, HALVINGS = 5, DUPLICATE_DISTANCE = 1e-3;

// --- cell grid -----------------------------------------------------------------------------------------------

/** Output cells tiling a frame exactly: `columns` x `rows` cells of `cellWidth` x `cellHeight` (at most the requested `cell`). */
export interface FoldGrid {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number;
  readonly columns: number; readonly rows: number; readonly cellWidth: number; readonly cellHeight: number;
}

export function foldGrid(frame: FoldRect, cell: number): FoldGrid {
  for (const [name, v] of [["x", frame.x], ["y", frame.y]] as const)
    if (!Number.isFinite(v)) throw new Error(`Fold raster: frame ${name} must be finite`);
  for (const [name, v] of [["width", frame.width], ["height", frame.height]] as const)
    if (!Number.isFinite(v) || v <= 0) throw new Error(`Fold raster: frame ${name} must be a positive number`);
  if (!Number.isFinite(cell) || cell <= 0) throw new Error("Fold raster: Cell size must be a positive number");
  const columns = Math.max(1, Math.ceil(frame.width / cell)), rows = Math.max(1, Math.ceil(frame.height / cell));
  if (columns * rows > FOLD_LIMITS.cells)
    throw new Error(`Fold raster: a ${frame.width} x ${frame.height} frame with cells of ${cell} needs ${columns * rows} cells; the limit is ${FOLD_LIMITS.cells}. Raise Cell size or shrink the frame`);
  return Object.freeze({ x: frame.x, y: frame.y, width: frame.width, height: frame.height, columns, rows,
    cellWidth: frame.width / columns, cellHeight: frame.height / rows });
}

// --- staged cache --------------------------------------------------------------------------------------------

class Lru<V> {
  private readonly items = new Map<string, V>();
  constructor(private readonly size: number) {}
  get(key: string): V | undefined {
    const hit = this.items.get(key);
    if (hit !== undefined) { this.items.delete(key); this.items.set(key, hit); }
    return hit;
  }
  set(key: string, value: V): V {
    this.items.set(key, value);
    if (this.items.size > this.size) this.items.delete(this.items.keys().next().value!);
    return value;
  }
}
type Steps<T> = Generator<void, T, void>;
let serial = 0;
const nextId = (): number => ++serial;

function finish<T>(steps: Steps<T>): T {
  for (;;) { const step = steps.next(); if (step.done) return step.value; }
}
/** Run `steps`, yielding to the host about every 16 ms; undefined when cancelled. */
export async function finishCooperatively<T>(steps: Steps<T>, cancelled: () => boolean): Promise<T | undefined> {
  let last = Date.now();
  for (;;) {
    if (cancelled()) return undefined;
    const step = steps.next();
    if (step.done) return step.value;
    if (Date.now() - last > 16) { await new Promise<void>((resolve) => setTimeout(resolve, 0)); last = Date.now(); }
  }
}
const CACHE_SIZE = 12;
function rectKey(rect: FoldRect): string { return `${rect.x},${rect.y},${rect.width},${rect.height}`; }
function mapKey(map: WarpOptions): string {
  return JSON.stringify([map.centerX, map.centerY, map.radius, map.iterations, map.bound, map.stages.map((s) => [s.map, s.amount, s.frequency])]);
}

// --- inverse: numeric inversion of the chained maps ----------------------------------------------------------

export type SheetRule = "front" | "back";
export type InverseStatus = "ok" | "unconverged" | "outside";
/** The inverse of one output point. `x`, `y`, `determinant` are NaN unless `status` is `ok`. */
export interface Preimage {
  readonly status: InverseStatus;
  readonly x: number; readonly y: number;
  /** Jacobian determinant of the map at the preimage: negative where the map has mirrored (folded) the source. */
  readonly determinant: number;
  /** Distinct in-domain preimages found: more than one means a fold put several source regions here. */
  readonly candidates: number;
}
export interface InverseOptions {
  /** Which sheet wins where a fold puts two source regions over one point: `front` prefers a positive Jacobian determinant. */
  sheet: SheetRule;
  /** Extra start points (canvas units) tried after the point itself; each can find a different sheet. */
  starts?: readonly (readonly [number, number])[];
}
/** Raster search: `nearest` starts Newton at each cell centre only; `sheets` also starts from forward-mapped seeds (see `foldPreimages`). */
export interface InverseRules {
  search: "nearest" | "sheets";
  /** Seed lattice points per cell side (1 to 4) for `sheets`: source points are spaced `cell / seeds` apart. Ignored by `nearest`. */
  seeds: number;
  sheet: SheetRule;
}

const STATUS_OK = 0, STATUS_UNCONVERGED = 1, STATUS_OUTSIDE = 2;
const STATUS_NAMES: readonly InverseStatus[] = ["ok", "unconverged", "outside"];

function checkRules(rules: InverseRules): void {
  if (rules.search !== "nearest" && rules.search !== "sheets") throw new Error(`Fold raster: search must be "nearest" or "sheets"`);
  if (rules.sheet !== "front" && rules.sheet !== "back") throw new Error(`Fold raster: sheet must be "front" or "back"`);
  if (!Number.isInteger(rules.seeds) || rules.seeds < 1 || rules.seeds > 4) throw new Error("Fold raster: seeds must be an integer in [1, 4]");
}
function checkSource(source: FoldRect): void {
  for (const [name, v] of [["x", source.x], ["y", source.y]] as const)
    if (!Number.isFinite(v)) throw new Error(`Fold raster: source ${name} must be finite`);
  for (const [name, v] of [["width", source.width], ["height", source.height]] as const)
    if (!Number.isFinite(v) || v <= 0) throw new Error(`Fold raster: source ${name} must be a positive number`);
}

type PointMap = (x: number, y: number) => readonly [number, number] | null;

/** Damped Newton on F(p) = c from (x0, y0). On success writes the preimage and its Jacobian determinant to `out`. */
function newton(f: PointMap, cx: number, cy: number, x0: number, y0: number, tolerance: number, step: number, out: Float64Array): boolean {
  let x = x0, y = y0, at = f(x, y);
  if (!at) return false;
  let rx = at[0] - cx, ry = at[1] - cy, residual = Math.hypot(rx, ry);
  for (let iteration = 0; ; iteration++) {
    const fx = f(x + step, y), fy = f(x, y + step);
    if (!fx || !fy) return false;
    const a = (fx[0] - at[0]) / step, b = (fy[0] - at[0]) / step, c = (fx[1] - at[1]) / step, d = (fy[1] - at[1]) / step;
    const det = a * d - b * c;
    if (residual <= tolerance) { out[0] = x; out[1] = y; out[2] = det; return true; }
    if (iteration >= FOLD_LIMITS.iterations || !Number.isFinite(det) || Math.abs(det) < MIN_DETERMINANT) return false;
    const dx = (d * rx - b * ry) / det, dy = (a * ry - c * rx) / det;
    let t = 1, moved = false;
    for (let halving = 0; halving <= HALVINGS && !moved; halving++, t /= 2) {
      const nx = x - t * dx, ny = y - t * dy, g = f(nx, ny);
      if (!g) continue;
      const gr = Math.hypot(g[0] - cx, g[1] - cy);
      if (gr < residual) { x = nx; y = ny; at = g; rx = g[0] - cx; ry = g[1] - cy; residual = gr; moved = true; }
    }
    if (!moved) return false;
  }
}

/**
 * A reusable inverter for one map and source. `solve(cx, cy, out, starts, hints)` returns a status code and fills
 * `out` = [x, y, determinant, candidates]. Newton always starts at the point itself, then at every finite (x, y) pair of
 * `starts`; `hints` (pairs, e.g. the preimages of solved neighbours) are tried only when those found no in-domain preimage.
 * Preimages closer than 1e-3 radius count as one candidate.
 */
function inverter(map: WarpOptions, source: FoldRect, sheet: SheetRule): (cx: number, cy: number, out: Float64Array, starts?: ArrayLike<number>, hints?: ArrayLike<number>) => number {
  checkSource(source);
  if (sheet !== "front" && sheet !== "back") throw new Error(`Fold raster: sheet must be "front" or "back"`);
  const f = warpMapper(map), tolerance = NEWTON_TOLERANCE * map.radius, step = DIFFERENCE_STEP * map.radius, same = DUPLICATE_DISTANCE * map.radius;
  const x1 = source.x + source.width, y1 = source.y + source.height, wantFront = sheet === "front";
  const found = new Float64Array(3);
  return (cx, cy, out, starts = [], hints = []) => {
    let converged = 0, candidates = 0, bestClass = 2, bestDistance = Infinity;
    const seen: number[] = [];
    const consider = (x0: number, y0: number): void => {
      if (!newton(f, cx, cy, x0, y0, tolerance, step, found)) return;
      converged++;
      const x = found[0], y = found[1], det = found[2];
      if (!(x >= source.x && x <= x1 && y >= source.y && y <= y1)) return;
      for (let s = 0; s < seen.length; s += 2) if (Math.hypot(seen[s] - x, seen[s + 1] - y) < same) return;
      seen.push(x, y);
      candidates++;
      const sheetClass = (det > 0) === wantFront ? 0 : 1, distance = Math.hypot(x - cx, y - cy);
      if (sheetClass < bestClass || sheetClass === bestClass && distance < bestDistance) {
        bestClass = sheetClass; bestDistance = distance; out[0] = x; out[1] = y; out[2] = det;
      }
    };
    consider(cx, cy);
    for (let s = 0; s + 1 < starts.length; s += 2) if (starts[s] === starts[s]) consider(starts[s], starts[s + 1]);
    if (candidates === 0)
      for (let s = 0; s + 1 < hints.length; s += 2) if (hints[s] === hints[s]) consider(hints[s], hints[s + 1]);
    out[3] = candidates;
    if (candidates > 0) return STATUS_OK;
    out[0] = out[1] = out[2] = NaN;
    return converged > 0 ? STATUS_OUTSIDE : STATUS_UNCONVERGED;
  };
}

/**
 * Invert the chained maps at one output point: see the module header for the method and the exclusion rule. The point
 * itself is always the first start; `options.starts` adds more (for example `latticeStarts`).
 */
export function invertMap(map: WarpOptions, source: FoldRect, x: number, y: number, options: InverseOptions): Preimage {
  const solve = inverter(map, source, options.sheet), out = new Float64Array(4);
  const status = solve(x, y, out, (options.starts ?? []).flatMap(([a, b]) => [a, b]));
  return Object.freeze({ status: STATUS_NAMES[status], x: out[0], y: out[1], determinant: out[2], candidates: out[3] });
}

/** Start points at the centres of a `side` x `side` lattice over a rectangle. */
export function latticeStarts(source: FoldRect, side: number): readonly (readonly [number, number])[] {
  checkSource(source);
  if (!Number.isInteger(side) || side < 1 || side > 64) throw new Error("Fold raster: lattice side must be an integer in [1, 64]");
  const out: [number, number][] = [];
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) out.push([source.x + (i + .5) / side * source.width, source.y + (j + .5) / side * source.height]);
  return out;
}

export interface FoldPreimages {
  readonly id: number;
  readonly grid: FoldGrid;
  /** Preimage per cell in source (canvas) coordinates; NaN where `status` is not ok. */
  readonly sourceX: ScalarGrid;
  readonly sourceY: ScalarGrid;
  /** Jacobian determinant at the preimage (negative: the visible sheet is mirrored). */
  readonly determinant: ScalarGrid;
  /** 0 ok, 1 unconverged, 2 outside the source rectangle. */
  readonly status: LabelGrid;
  /** Cells per status, plus `mirrored` (ok cells with a negative determinant) and `folded` (ok cells with more than one distinct preimage). */
  readonly counts: Readonly<{ ok: number; unconverged: number; outside: number; mirrored: number; folded: number }>;
}

/** Forward-mapped seed points a `sheets` search needs for this source and cell size (0 for `nearest`). */
export function foldSeedCount(source: FoldRect, cell: number, rules: InverseRules): number {
  if (rules.search !== "sheets") return 0;
  const spacing = cell / rules.seeds;
  return Math.ceil(source.width / spacing) * Math.ceil(source.height / spacing);
}

const preimageCache = new Lru<FoldPreimages>(CACHE_SIZE);

function* buildPreimages(map: WarpOptions, source: FoldRect, grid: FoldGrid, cell: number, rules: InverseRules): Steps<FoldPreimages> {
  checkRules(rules);
  const seedCount = foldSeedCount(source, cell, rules);
  if (seedCount > FOLD_LIMITS.seeds)
    throw new Error(`Fold inverse: a ${source.width} x ${source.height} image with cells of ${cell} and ${rules.seeds} seeds per cell side needs ${seedCount} seed points; the limit is ${FOLD_LIMITS.seeds}. Raise Cell size, lower Search detail, or use the nearest start`);
  const solve = inverter(map, source, rules.sheet), n = grid.columns * grid.rows;
  // Seeds: source points on a fine lattice, pushed forward. Per cell keep, for each orientation of the map there
  // (front: positive determinant, back: negative), the seed whose image is nearest the cell centre, as an extra Newton start.
  const seeds = new Float64Array(4 * n).fill(NaN), nearest = new Float64Array(2 * n).fill(Infinity);
  if (rules.search === "sheets") {
    const f = warpMapper(map), h = DIFFERENCE_STEP * map.radius, spacing = cell / rules.seeds;
    const nx = Math.ceil(source.width / spacing), ny = Math.ceil(source.height / spacing);
    for (let j = 0; j < ny; j++) {
      const y = source.y + (j + .5) * source.height / ny;
      for (let i = 0; i < nx; i++) {
        const x = source.x + (i + .5) * source.width / nx, q = f(x, y);
        if (!q) continue;
        const column = Math.floor((q[0] - grid.x) / grid.cellWidth), row = Math.floor((q[1] - grid.y) / grid.cellHeight);
        if (column < 0 || column >= grid.columns || row < 0 || row >= grid.rows) continue;
        const qx = f(x + h, y), qy = f(x, y + h);
        if (!qx || !qy) continue;
        const orientation = (qx[0] - q[0]) * (qy[1] - q[1]) - (qy[0] - q[0]) * (qx[1] - q[1]) > 0 ? 0 : 1, k = row * grid.columns + column;
        const distance = Math.hypot(q[0] - (grid.x + (column + .5) * grid.cellWidth), q[1] - (grid.y + (row + .5) * grid.cellHeight));
        if (distance < nearest[2 * k + orientation]) { nearest[2 * k + orientation] = distance; seeds[4 * k + 2 * orientation] = x; seeds[4 * k + 2 * orientation + 1] = y; }
      }
      yield;
    }
  }
  const sx = new Float64Array(n), sy = new Float64Array(n), det = new Float64Array(n), status = new Int32Array(n), out = new Float64Array(4), hints = new Float64Array(4);
  const counts = { ok: 0, unconverged: 0, outside: 0, mirrored: 0, folded: 0 };
  const sheets = rules.search === "sheets";
  for (let j = 0; j < grid.rows; j++) {
    const cy = grid.y + (j + .5) * grid.cellHeight;
    for (let i = 0; i < grid.columns; i++) {
      const k = j * grid.columns + i;
      let code: number;
      if (sheets) {
        // Fallback starts: the preimages of the cell to the left and the cell above, when they were solved.
        const left = i > 0 && status[k - 1] === STATUS_OK, up = j > 0 && status[k - grid.columns] === STATUS_OK;
        hints[0] = left ? sx[k - 1] : NaN; hints[1] = left ? sy[k - 1] : NaN;
        hints[2] = up ? sx[k - grid.columns] : NaN; hints[3] = up ? sy[k - grid.columns] : NaN;
        code = solve(grid.x + (i + .5) * grid.cellWidth, cy, out, seeds.subarray(4 * k, 4 * k + 4), hints);
      } else code = solve(grid.x + (i + .5) * grid.cellWidth, cy, out);
      status[k] = code; sx[k] = out[0]; sy[k] = out[1]; det[k] = out[2];
      if (code === STATUS_OK) { counts.ok++; if (out[2] < 0) counts.mirrored++; if (out[3] > 1) counts.folded++; }
      else if (code === STATUS_UNCONVERGED) counts.unconverged++; else counts.outside++;
    }
    yield;
  }
  return Object.freeze({ id: nextId(), grid, sourceX: adoptScalarGrid(grid.columns, grid.rows, sx), sourceY: adoptScalarGrid(grid.columns, grid.rows, sy),
    determinant: adoptScalarGrid(grid.columns, grid.rows, det), status: adoptLabelGrid(grid.columns, grid.rows, status), counts: Object.freeze(counts) });
}
const preimageKey = (map: WarpOptions, source: FoldRect, frame: FoldRect, cell: number, rules: InverseRules): string =>
  `${mapKey(map)}|${rectKey(source)}|${rectKey(frame)}|${cell}|${rules.search}|${rules.search === "sheets" ? `${rules.seeds}|${rules.sheet}` : ""}`;

/**
 * The preimage of every output cell centre. `sheets` first pushes a lattice of source seed points forward (spaced
 * `cell / seeds`), keeps per cell the seed nearest its centre for each orientation of the map, and starts Newton from
 * the centre and from those seeds, so a fold's several sheets are found without searching cells no source reaches.
 * Cached by map, source, frame, cell size and (for `sheets`) seeds and sheet only.
 */
export function foldPreimages(map: WarpOptions, source: FoldRect, frame: FoldRect, cell: number, rules: InverseRules): FoldPreimages {
  const key = preimageKey(map, source, frame, cell, rules);
  return preimageCache.get(key) ?? preimageCache.set(key, finish(buildPreimages(map, source, foldGrid(frame, cell), cell, rules)));
}
/** The same result computed in slices; undefined when cancelled (nothing is cached then). */
export async function prepareFoldPreimages(map: WarpOptions, source: FoldRect, frame: FoldRect, cell: number, rules: InverseRules, cancelled: () => boolean): Promise<FoldPreimages | undefined> {
  const key = preimageKey(map, source, frame, cell, rules), hit = preimageCache.get(key);
  if (hit) return hit;
  const built = await finishCooperatively(buildPreimages(map, source, foldGrid(frame, cell), cell, rules), cancelled);
  return built && preimageCache.set(key, built);
}

export interface FoldColors {
  readonly id: number;
  readonly preimages: FoldPreimages;
  /** sRGB-encoded channels in [0, 1] read at each preimage; NaN where the cell is excluded. */
  readonly red: ScalarGrid; readonly green: ScalarGrid; readonly blue: ScalarGrid;
}

const colorCache = new Lru<FoldColors>(CACHE_SIZE), mipCache = new Lru<readonly Raster[]>(4);
/** Coarsest box-averaged copy a cell may read: 2^4 = 16 source pixels across. */
export const MAX_MIP_LEVEL = 4;

/** The raster and its box-averaged halvings (exact area means in linear light, `resizeRaster`), at most `MAX_MIP_LEVEL` of them. */
function mipChain(raster: Raster): readonly Raster[] {
  const hit = mipCache.get(raster.hash);
  if (hit) return hit;
  const chain = [raster];
  while (chain.length <= MAX_MIP_LEVEL && (chain[chain.length - 1].width > 1 || chain[chain.length - 1].height > 1)) {
    const last = chain[chain.length - 1];
    chain.push(resizeRaster(last, Math.max(1, Math.ceil(last.width / 2)), Math.max(1, Math.ceil(last.height / 2)), "box"));
  }
  return mipCache.set(raster.hash, chain);
}

/**
 * Read the source raster at every preimage (`filter`, edge `clamp`, linear-light interpolation); cached by preimages,
 * image, filter and `area`. With `area`, a cell the map shrinks reads the mean of the source it covers instead of one
 * point: its footprint is cell area / |det| canvas units^2 (the map's local area change at the preimage), the sample is
 * taken from the box-averaged copies of the picture at level log2(footprint side in pixels), blended between the two
 * nearest levels (the nearest level for the `nearest` filter), and the level is capped at `MAX_MIP_LEVEL` so a cell
 * hugging a fold line (|det| -> 0) does not smear across the picture. Cells the map does not shrink read level 0, which
 * is exactly the raster.
 */
export function foldColors(preimages: FoldPreimages, raster: Raster, source: FoldRect, filter: SampleFilter, area: boolean): FoldColors {
  checkSource(source);
  if (raster.channels === 2 || raster.channels === 4) throw new Error(`Fold raster: image "${raster.label}" has an alpha channel; use an opaque gray or RGB image`);
  const key = `${preimages.id}|${raster.hash}|${rectKey(source)}|${filter}|${area}`, hit = colorCache.get(key);
  if (hit) return hit;
  const { columns, rows } = preimages.grid, n = columns * rows, r = new Float64Array(n), g = new Float64Array(n), b = new Float64Array(n);
  const mapping = rasterMapping(raster, source), px = gridStorage(preimages.sourceX), py = gridStorage(preimages.sourceY), status = gridStorage(preimages.status);
  const det = gridStorage(preimages.determinant), chain = area ? mipChain(raster) : [raster];
  const pixelArea = mapping.scaleX * mapping.scaleY, cellArea = preimages.grid.cellWidth * preimages.grid.cellHeight;
  const sample = new Float64Array(3), fine = new Float64Array(3), options = { filter, edge: "clamp", space: "linear" } as const, gray = raster.channels === 1;
  const read = (level: number, u: number, v: number, out: Float64Array): void => {
    const at = chain[level];
    sampleInto(at, u * at.width / raster.width, v * at.height / raster.height, out, options);
  };
  for (let k = 0; k < n; k++) {
    if (status[k] !== STATUS_OK) { r[k] = g[k] = b[k] = NaN; continue; }
    const [u, v] = mapping.toRaster(px[k], py[k]);
    const wanted = area ? Math.min(chain.length - 1, Math.max(0, .5 * Math.log2(cellArea / (Math.abs(det[k]) * pixelArea)))) : 0, lod = wanted < 1e-6 ? 0 : wanted;
    if (filter === "nearest" || lod === 0) read(Math.round(lod), u, v, sample);
    else {
      const level = Math.min(chain.length - 2, Math.floor(lod)), t = lod - level;
      read(level, u, v, sample); read(level + 1, u, v, fine);
      for (let c = 0; c < 3; c++) sample[c] += (fine[c] - sample[c]) * t;
    }
    r[k] = linearToSrgb(sample[0]); g[k] = linearToSrgb(gray ? sample[0] : sample[1]); b[k] = linearToSrgb(gray ? sample[0] : sample[2]);
  }
  return colorCache.set(key, Object.freeze({ id: nextId(), preimages, red: adoptScalarGrid(columns, rows, r), green: adoptScalarGrid(columns, rows, g), blue: adoptScalarGrid(columns, rows, b) }));
}

// --- forward: samples, mapped samples, density ---------------------------------------------------------------

export type SamplerSpec =
  | { kind: "tone"; seed: number; count: number; weight: "dark" | "light"; curve: number }
  | { kind: "grid"; seed: number; count: number; jitter: number };

export interface FoldSamples {
  readonly id: number;
  readonly source: FoldRect;
  /** Number of samples (for `grid`, columns x rows, which can differ slightly from the requested count). */
  readonly count: number;
  /** Positions in canvas units, `count` x 1. */
  readonly x: ScalarGrid; readonly y: ScalarGrid;
}

const MIX = 0x9e3779b1;
function fmix(h: number): number {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
/** Uniform draw in [0, 1) for sample `index`, purpose `k`: a function of the seed and index only, never of the count. */
export function foldUnit(seed: number, index: number, k: number): number {
  return fmix(fmix((seed ^ Math.imul(index + 1, MIX)) | 0) ^ Math.imul(k + 1, 0x7feb352d)) / 0x1_0000_0000;
}

const cdfCache = new Lru<{ cdf: Float64Array; total: number }>(4);

function toneCdf(raster: Raster, weight: "dark" | "light", curve: number): { cdf: Float64Array; total: number } {
  const key = `${raster.hash}|${weight}|${curve}`, hit = cdfCache.get(key);
  if (hit) return hit;
  const lightness = gridStorage(valueField(raster, "lightness")), cdf = new Float64Array(lightness.length);
  let total = 0;
  for (let i = 0; i < lightness.length; i++) {
    total += (weight === "dark" ? 1 - lightness[i] : lightness[i]) ** curve;
    cdf[i] = total;
  }
  if (!(total > 0)) throw new Error(`Fold density: image "${raster.label}" has no ${weight} tone to sample. Choose the other tone, another image, or grid sampling`);
  return cdfCache.set(key, { cdf, total });
}

const sampleCache = new Lru<FoldSamples>(CACHE_SIZE);

function checkSampler(spec: SamplerSpec): void {
  if (!Number.isInteger(spec.count) || spec.count < 1 || spec.count > FOLD_LIMITS.samples) throw new Error(`Fold density: sample count must be an integer in [1, ${FOLD_LIMITS.samples}]`);
  if (!Number.isSafeInteger(spec.seed) || spec.seed < 0 || spec.seed > 0xffffffff) throw new Error("Fold density: seed must be a uint32 integer");
  if (spec.kind === "tone") {
    if (spec.weight !== "dark" && spec.weight !== "light") throw new Error(`Fold density: weight must be "dark" or "light"`);
    if (!Number.isFinite(spec.curve) || spec.curve <= 0 || spec.curve > 8) throw new Error("Fold density: tone curve must be a number in (0, 8]");
  } else if (spec.kind === "grid") {
    if (!Number.isFinite(spec.jitter) || spec.jitter < 0 || spec.jitter > 1) throw new Error("Fold density: jitter must be a number in [0, 1]");
  } else throw new Error(`Fold density: sampler must be "tone" or "grid"`);
}

/**
 * Source samples in canvas units inside `source`.
 * `tone`: sample i picks a pixel by inverse CDF of its tone weight (dark: (1 - lightness)^curve, light: lightness^curve)
 * and a uniform point inside it, from draws that depend on the seed and i only, so the first N samples of a larger set
 * ARE the N-sample set. `grid`: a `columns` x `rows` grid over the source (aspect kept, about `count` cells), each
 * sample displaced within its own cell by up to `jitter` of the cell; the count follows the grid, so it is not prefix
 * stable. Every sample carries unit mass.
 */
export function foldSamples(raster: Raster, source: FoldRect, spec: SamplerSpec): FoldSamples {
  checkSource(source); checkSampler(spec);
  const key = spec.kind === "tone" ? `${raster.hash}|${rectKey(source)}|tone|${spec.seed}|${spec.count}|${spec.weight}|${spec.curve}`
    : `${rectKey(source)}|grid|${spec.seed}|${spec.count}|${spec.jitter}`;
  const hit = sampleCache.get(key);
  if (hit) return hit;
  let count = spec.count, x: Float64Array, y: Float64Array;
  if (spec.kind === "tone") {
    x = new Float64Array(count); y = new Float64Array(count);
    const { cdf, total } = toneCdf(raster, spec.weight, spec.curve), mapping = rasterMapping(raster, source);
    for (let i = 0; i < count; i++) {
      const target = foldUnit(spec.seed, i, 0) * total;
      let lo = 0, hi = cdf.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] > target) hi = mid; else lo = mid + 1; }
      const [cx, cy] = mapping.toCanvas(lo % raster.width + foldUnit(spec.seed, i, 1), Math.floor(lo / raster.width) + foldUnit(spec.seed, i, 2));
      x[i] = cx; y[i] = cy;
    }
  } else {
    const columns = Math.max(1, Math.round(Math.sqrt(spec.count * source.width / source.height))), rows = Math.max(1, Math.round(spec.count / columns));
    count = columns * rows;
    if (count > FOLD_LIMITS.samples) throw new Error(`Fold density: the ${columns} x ${rows} sample grid exceeds ${FOLD_LIMITS.samples} samples; lower the count`);
    x = new Float64Array(count); y = new Float64Array(count);
    const cw = source.width / columns, ch = source.height / rows;
    for (let k = 0; k < count; k++) {
      x[k] = source.x + (k % columns + .5 + (foldUnit(spec.seed, k, 1) - .5) * spec.jitter) * cw;
      y[k] = source.y + (Math.floor(k / columns) + .5 + (foldUnit(spec.seed, k, 2) - .5) * spec.jitter) * ch;
    }
  }
  return sampleCache.set(key, Object.freeze({ id: nextId(), source: Object.freeze({ ...source }), count, x: adoptScalarGrid(count, 1, x), y: adoptScalarGrid(count, 1, y) }));
}

export interface FoldMapped {
  readonly id: number;
  readonly samples: FoldSamples;
  /** Where each sample landed, canvas units; NaN where the map excluded it (singularity or bound). */
  readonly x: ScalarGrid; readonly y: ScalarGrid;
  /** Samples the map excluded. */
  readonly excluded: number;
}

const mappedCache = new Lru<FoldMapped>(CACHE_SIZE);
const MAP_SLICE = 16_384;

function* buildMapped(samples: FoldSamples, map: WarpOptions): Steps<FoldMapped> {
  const f = warpMapper(map), sx = gridStorage(samples.x), sy = gridStorage(samples.y), n = samples.count;
  const x = new Float64Array(n), y = new Float64Array(n);
  let excluded = 0;
  for (let i = 0; i < n; i++) {
    const p = f(sx[i], sy[i]);
    if (p) { x[i] = p[0]; y[i] = p[1]; } else { x[i] = y[i] = NaN; excluded++; }
    if ((i + 1) % MAP_SLICE === 0) yield;
  }
  return Object.freeze({ id: nextId(), samples, x: adoptScalarGrid(n, 1, x), y: adoptScalarGrid(n, 1, y), excluded });
}

/** Push every sample through the chained maps (`warpPoint`'s rule: singular or beyond the bound is excluded, never clamped). Cached by samples and map. */
export function foldMapped(samples: FoldSamples, map: WarpOptions): FoldMapped {
  const key = `${samples.id}|${mapKey(map)}`;
  return mappedCache.get(key) ?? mappedCache.set(key, finish(buildMapped(samples, map)));
}
export async function prepareFoldMapped(samples: FoldSamples, map: WarpOptions, cancelled: () => boolean): Promise<FoldMapped | undefined> {
  const key = `${samples.id}|${mapKey(map)}`, hit = mappedCache.get(key);
  if (hit) return hit;
  const built = await finishCooperatively(buildMapped(samples, map), cancelled);
  return built && mappedCache.set(key, built);
}

export interface FoldDensity {
  readonly id: number;
  readonly mapped: FoldMapped;
  readonly grid: FoldGrid;
  /** Samples per cell. Cells no sample reached are exactly 0: holes, never filled. */
  readonly count: ScalarGrid;
  /** Sum of `count`. Always `total + excluded + outside = samples`. */
  readonly total: number;
  readonly excluded: number;
  /** Mapped samples that landed outside the frame. */
  readonly outside: number;
  readonly samples: number;
  readonly max: number;
  /** Cells with no sample. */
  readonly holes: number;
  /** Samples per cell if the same samples were spread uniformly over the source rectangle: the density that exposure 1 calls 1. */
  readonly reference: number;
}

const densityCache = new Lru<FoldDensity>(CACHE_SIZE);

/**
 * Accumulate the mapped samples on the frame's cells: sample (x, y) falls in column floor((x - frame.x) / cellWidth) and
 * row floor((y - frame.y) / cellHeight), counted when both indices are inside the grid (so the right and bottom frame
 * edges belong to no cell). Many samples in one cell add; nothing is spread, smoothed or interpolated.
 */
export function foldDensity(mapped: FoldMapped, frame: FoldRect, cell: number): FoldDensity {
  const key = `${mapped.id}|${rectKey(frame)}|${cell}`, hit = densityCache.get(key);
  if (hit) return hit;
  const grid = foldGrid(frame, cell), counts = new Float64Array(grid.columns * grid.rows), mx = gridStorage(mapped.x), my = gridStorage(mapped.y);
  let total = 0, outside = 0;
  for (let i = 0; i < mapped.samples.count; i++) {
    const x = mx[i];
    if (x !== x) continue;
    const column = Math.floor((x - grid.x) / grid.cellWidth), row = Math.floor((my[i] - grid.y) / grid.cellHeight);
    if (column < 0 || column >= grid.columns || row < 0 || row >= grid.rows) { outside++; continue; }
    counts[row * grid.columns + column]++; total++;
  }
  let max = 0, holes = 0;
  for (const c of counts) { if (c > max) max = c; if (c === 0) holes++; }
  const source = mapped.samples.source;
  return densityCache.set(key, Object.freeze({ id: nextId(), mapped, grid, count: adoptScalarGrid(grid.columns, grid.rows, counts), total,
    excluded: mapped.excluded, outside, samples: mapped.samples.count, max, holes,
    reference: mapped.samples.count * grid.cellWidth * grid.cellHeight / (source.width * source.height) }));
}

export type Tonemap = "film" | "log" | "linear";
/** Density ratio at which `log` reaches full tone. */
export const LOG_FULL = 8;
/** Density ratio at which `linear` reaches full tone. */
export const LINEAR_FULL = 4;

/**
 * The tone of every cell in [0, 1], from `x = exposure * count / reference` (1 = as many samples as an unfolded, uniform
 * spread would put there): `film` 1 - exp(-x); `log` log(1 + x) / log(1 + LOG_FULL) capped at 1; `linear` x / LINEAR_FULL
 * capped at 1. A cell with no sample is exactly 0 for every curve. Reads the finished counts only.
 */
export function tonemapDensity(density: FoldDensity, exposure: number, curve: Tonemap): ScalarGrid {
  if (!Number.isFinite(exposure) || exposure <= 0) throw new Error("Fold density: exposure must be a positive number");
  if (curve !== "film" && curve !== "log" && curve !== "linear") throw new Error(`Fold density: tone response must be "film", "log" or "linear"`);
  const counts = gridStorage(density.count), out = new Float64Array(counts.length), scale = exposure / density.reference;
  const full = Math.log1p(LOG_FULL);
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] === 0) continue;
    const x = counts[i] * scale;
    out[i] = curve === "film" ? 1 - Math.exp(-x) : curve === "log" ? Math.min(1, Math.log1p(x) / full) : Math.min(1, x / LINEAR_FULL);
  }
  return adoptScalarGrid(density.grid.columns, density.grid.rows, out);
}

// --- merged runs ---------------------------------------------------------------------------------------------

export interface FoldRun {
  /** Cell coordinates of the top-left cell and the size in cells. */
  readonly column: number; readonly row: number; readonly columns: number; readonly rows: number;
  readonly key: number;
}

/**
 * Merge cells that share a key into rectangles: consecutive equal keys in a row form a run, and a run that has the same
 * column span and key as the run directly above extends that rectangle downward. Keys below 0 are empty. The rectangles
 * tile exactly the non-empty cells, each cell in one rectangle, in row-major order of their top-left cells.
 */
export function mergeRuns(columns: number, rows: number, keys: ArrayLike<number>): readonly FoldRun[] {
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1 || keys.length !== columns * rows) throw new Error("mergeRuns: keys must hold columns x rows entries");
  const out: { column: number; row: number; columns: number; rows: number; key: number }[] = [];
  let open = new Map<string, (typeof out)[number]>();
  for (let r = 0; r < rows; r++) {
    const next = new Map<string, (typeof out)[number]>();
    let c = 0;
    while (c < columns) {
      const key = keys[r * columns + c];
      if (key < 0) { c++; continue; }
      let end = c + 1;
      while (end < columns && keys[r * columns + end] === key) end++;
      const tag = `${c},${end - c},${key}`, above = open.get(tag);
      if (above) { above.rows++; next.set(tag, above); }
      else { const run = { column: c, row: r, columns: end - c, rows: 1, key }; out.push(run); next.set(tag, run); }
      c = end;
    }
    open = next;
  }
  return Object.freeze(out.map((run) => Object.freeze(run)));
}
