/**
 * Image structure: pure functions over an owned `Raster` (or a `ScalarGrid` of values) that return
 * deeply immutable typed results. Segmentation, adaptive error subdivision, orientation fields,
 * scan-run extraction with stable sorting, and phase-preserving frequency modulation.
 *
 * Conventions shared by every function here (see `raster.ts` for the raster contract):
 * - Coordinates are raster pixels, origin at the top-left CORNER of the top-left pixel, x right, y down;
 *   a pixel's centre is (i + 0.5, j + 0.5). Use `rasterMapping` to reach canvas units.
 * - Angles are radians measured from +x toward +y (clockwise on screen). Orientations are unsigned and
 *   live in [0, π).
 * - Values are one scalar per pixel in [0, 1] chosen by a `ValueKind` (default `lightness`, CIE L* over 100)
 *   with transparent pixels composited over `background` (default white) in linear light; a
 *   `ScalarGrid` source is used as is. Nothing here reads a canvas, the clock or a random source, so a
 *   result is a pure function of its input content and options (deterministic, order-stable ties).
 * - Work bounds: at most 4,194,304 pixels (2048 x 2048) per analysis, plus the specific bounds below.
 *   Over a bound the function throws naming the argument to change; nothing is truncated.
 *
 * Segmentation (`segmentValueBands`). Pixels are quantised into value bands (equal widths, or
 * explicit strictly increasing thresholds; a value EQUAL to a threshold belongs to the upper band and
 * the value 1 to the last band). Connected components of equal band under an explicit 4 or 8
 * connectivity are labelled `0..n-1` in raster order of each region's first pixel. Pixels excluded by
 * the mask or by alpha (`alpha <= minAlpha`) get label -1 and belong to no region. Regions smaller than
 * `minArea` are merged, smallest first (ties: smaller id), each into the neighbouring region it shares
 * the LONGEST border with (policy `longest-border`; ties: nearest mean value, then smaller id) or the
 * one with the NEAREST mean value (policy `nearest-value`; ties: longest border, then smaller id).
 * Neighbours are 4-adjacent regardless of connectivity; a region with no neighbour (isolated by
 * excluded pixels) stays undersized and is counted. A merged region keeps the band and identity of the
 * region that absorbed it; ids are recomputed compactly after merging. Region attributes are exact:
 * area, mean value, bounding box (x1/y1 exclusive), centroid of pixel centres.
 * Bounds: 1,000,000 regions before merging, 250,000 after (throws naming `minArea` / `bands`).
 *
 * Subdivision (`subdivideImage`). A rectangle is split while its error `> threshold` (or while a side exceeds
 * `maxCell`), never below `minCell` pixels per side, and never past `maxCells` leaves (throws). Errors
 * come from float64 summed-area tables (`variance`, `stddev` and `sse` = area * variance, exact for
 * constant regions) or a scan (`range`). Halves are `floor(n/2)` then the rest, so children differ by
 * at most one pixel; policies `quad` (both axes when both can split, else the one that can), `longest`
 * (the longer side) and `best` (the axis minimising the children's summed SSE; ties split x). Cell ids
 * are paths (`r`, `r.0`, `r.0.3`): raising the threshold adds descendants and never renames a cell.
 *
 * Orientation (`orientationField`). Gradient by the 3x3 Scharr operator (exact for linear ramps, edge
 * pixels replicate), structure tensor `J = G_σ * [gx², gx·gy, gy²]` with a Gaussian of standard
 * deviation `smoothing` pixels (radius ceil(3σ), renormalised over the in-image part so a uniform
 * tensor stays uniform to the border; σ = 0 keeps the pixel tensor). The dominant gradient angle is
 * `θg = ½·atan2(2·Jxy, Jxx − Jyy)`; `direction = θg + π/2` (mod π) is the tangent of the level lines,
 * i.e. along stripes and edges. `coherence = (λ1 − λ2)/(λ1 + λ2)` in [0, 1] and `energy = λ1 + λ2` (mean
 * squared gradient, value² per pixel²). Flat places (`energy <= flatEnergy`, default 1e-10) and exactly
 * isotropic tensors have no direction: they report the stated `fallback` direction, coherence 0, and
 * `defined: false`. Sampling at arbitrary points interpolates the TENSOR bilinearly (never the angle),
 * so unsigned orientations cannot cancel or flip: perpendicular stripes average to coherence 0.
 * `orientationVector` chooses the sign of a trajectory step against a hint so integration never flips.
 * Work: about pixels · (6 · (2⌈3σ⌉ + 1) + 30) operations, at most 1,000 million (about 1.5 s; throws naming `smoothing`).
 *
 * Scan runs (`scanRuns`, `sortScanRuns`, `applyPixelMoves`, `pixelSort`). Eight straight directions partition the
 * pixels into scan lines (a line starts at each pixel whose predecessor is off the image; lines are
 * ordered by their start pixel in raster order). A pixel is selected when it passes the mask (`>= 0.5`),
 * has alpha `> minAlpha` and its value lies in `[min, max]` inclusive. A run is a maximal consecutive
 * selected stretch of at least `minRun` pixels. Sorting is STABLE: pixels are ordered by key with ties
 * kept in scan order (also when descending), and written back to the run's slots in scan order. Moves
 * only permute pixels inside a run, so unselected pixels never change; with `alpha: "stay"` the color
 * moves and each slot keeps its own alpha. Curved paths are out of scope (visitation and overlap
 * semantics would be new decisions). Bound: 1,000,000 runs (throws naming `minRun`, `min`, `max`).
 *
 * Frequency modulation (`frequencyModulation`). Along a line parameter `s` in `[0, length]` the tone
 * `τ(s)` in [0, 1] (raised to `curve`) sets a piecewise-linear frequency `f(s)` (cycles per length unit,
 * linear between `frequency.min` at tone 0 and `frequency.max` at tone 1) and amplitude `A(s)`. The phase
 * is the exact integral `φ(s) = φ0 + 2π ∫ f`, quadratic inside each interval, so it is continuous by
 * construction and lines never jump where frequency changes; offset is `A(s)·sin φ(s)`. Every vertex step
 * advances the phase by at most `maxPhaseStep` (default π/8, at most π/2: at least four vertices per
 * cycle, so the polyline never aliases its own carrier). Tone 0 with `amplitude.min = 0` is a straight
 * line whose phase still advances, so a later dark area continues the same wave. Bound: 1,000,000
 * vertices (throws naming `frequency.max`, `maxPhaseStep` or `length`).
 */

import { adoptLabelGrid, adoptScalarGrid, createRaster, gridStorage, rasterStorage, valueField } from "./raster.js";
import type { LabelGrid, Raster, ScalarGrid, ValueKind } from "./raster.js";

const MAX_STRUCTURE_PIXELS = 4_194_304;
const MAX_REGIONS_BEFORE_MERGE = 1_000_000;
const MAX_REGIONS = 250_000;
const MAX_SUBDIVISION_CELLS = 250_000;
const MAX_ORIENTATION_WORK = 1_000_000_000;
const MAX_RUNS = 1_000_000;
const MAX_MODULATION_POINTS = 1_000_000;

/** Every explicit work bound of this module. */
export const IMAGE_STRUCTURE_LIMITS = Object.freeze({
  pixels: MAX_STRUCTURE_PIXELS, regionsBeforeMerge: MAX_REGIONS_BEFORE_MERGE, regions: MAX_REGIONS, subdivisionCells: MAX_SUBDIVISION_CELLS,
  orientationWork: MAX_ORIENTATION_WORK, runs: MAX_RUNS, modulationVertices: MAX_MODULATION_POINTS,
});

const TAU = Math.PI * 2;

export type ImageSource = Raster | ScalarGrid;

interface Values { width: number; height: number; values: Float64Array; alpha: Float64Array | null }

function isRaster(source: ImageSource): source is Raster {
  return "channels" in source;
}

/** Dimensions of a source after the shared pixel bound; no pixels are read. */
function sourceSize(fn: string, source: ImageSource): { width: number; height: number } {
  if (source === null || typeof source !== "object") throw new Error(`${fn}: source must be a Raster or a ScalarGrid`);
  const { width, height } = source;
  if (width * height > MAX_STRUCTURE_PIXELS) throw new Error(`${fn}: ${width} x ${height} exceeds ${MAX_STRUCTURE_PIXELS} pixels; crop or shrink the source raster`);
  return { width, height };
}

function resolve(fn: string, source: ImageSource, value: ValueKind | undefined, background: number | undefined): Values {
  const { width, height } = sourceSize(fn, source);
  if (isRaster(source)) {
    rasterStorage(source);
    const opts = background === undefined ? {} : { background };
    const values = gridStorage(valueField(source, value ?? "lightness", opts));
    const alpha = source.alpha === "none" ? null : gridStorage(valueField(source, "alpha"));
    return { width, height, values, alpha };
  }
  if (value !== undefined) throw new Error(`${fn}: value applies to rasters; a ScalarGrid source is used as is`);
  return { width, height, values: gridStorage(source), alpha: null };
}

function checkMask(fn: string, mask: ScalarGrid | undefined, width: number, height: number): Float64Array | null {
  if (mask === undefined) return null;
  if (mask.kind !== "scalar" || mask.width !== width || mask.height !== height)
    throw new Error(`${fn}: mask must be a ScalarGrid of ${width} x ${height}, the source's size`);
  return gridStorage(mask);
}

function checkInteger(fn: string, name: string, v: unknown, low: number, high: number): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < low || v > high) throw new Error(`${fn}: ${name} must be an integer in [${low}, ${high}] (got ${String(v)})`);
  return v;
}
function checkNumber(fn: string, name: string, v: unknown, low: number, high: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < low || v > high) throw new Error(`${fn}: ${name} must be a finite number in [${low}, ${high}] (got ${String(v)})`);
  return v;
}

const frozen = <T>(list: readonly T[]): readonly T[] => Object.freeze(list.slice());

// ---------------------------------------------------------------------------------------------
// Segmentation

export interface SegmentOptions {
  /** Value used for rasters (default `lightness`). */
  value?: ValueKind;
  background?: number;
  /** Equal-width band count, integer 2..256. Exactly one of `bands` and `thresholds`. */
  bands?: number;
  /** Strictly increasing thresholds in (0, 1); n thresholds give n + 1 bands. */
  thresholds?: readonly number[];
  /** REQUIRED: 4 (edge-adjacent) or 8 (edge or corner adjacent) connectivity of same-band pixels. */
  connectivity: 4 | 8;
  /** Regions with fewer pixels are merged away. Integer >= 1; 1 (default) merges nothing. */
  minArea?: number;
  merge?: "longest-border" | "nearest-value";
  /** Pixels where the mask is < 0.5 belong to no region. */
  mask?: ScalarGrid;
  /** Pixels with alpha <= minAlpha belong to no region (default 0: only fully transparent pixels). */
  minAlpha?: number;
}

export interface ValueRegion {
  readonly id: number;
  /** Band of the original region that absorbed the others. */
  readonly band: number;
  readonly area: number;
  /** Mean of the source values over the region. */
  readonly mean: number;
  /** Half-open pixel rectangle. */
  readonly bbox: Readonly<{ x0: number; y0: number; x1: number; y1: number }>;
  /** Mean of the pixel centres, raster space. */
  readonly centroid: readonly [number, number];
}

/** Two regions (a < b) and the number of unit pixel edges they share (4-adjacent pixel pairs). */
export interface RegionAdjacency { readonly a: number; readonly b: number; readonly length: number }

export interface Segmentation {
  readonly width: number;
  readonly height: number;
  readonly connectivity: 4 | 8;
  readonly thresholds: readonly number[];
  readonly labels: LabelGrid;
  readonly regions: readonly ValueRegion[];
  readonly adjacency: readonly RegionAdjacency[];
  /** Pixels with label -1. */
  readonly excluded: number;
  /** Regions absorbed by merging. */
  readonly merged: number;
  /** Final regions still smaller than `minArea` (no neighbour to merge into). */
  readonly undersized: number;
}

const bandOf = (v: number, thresholds: readonly number[]): number => {
  let lo = 0, hi = thresholds.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (thresholds[mid] <= v) lo = mid + 1; else hi = mid; }
  return lo;
};

/** Sorted unique 4-adjacent label pairs (a < b) and their counts. */
function borderCounts(labels: Int32Array, width: number, height: number, regions: number): { a: Int32Array; b: Int32Array; count: Int32Array } {
  let n = 0;
  const scan = (fill: Float64Array | null): void => {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const p = y * width + x, l = labels[p];
      if (l < 0) continue;
      if (x + 1 < width) { const r = labels[p + 1]; if (r >= 0 && r !== l) { if (fill) fill[n] = Math.min(l, r) * regions + Math.max(l, r); n++; } }
      if (y + 1 < height) { const r = labels[p + width]; if (r >= 0 && r !== l) { if (fill) fill[n] = Math.min(l, r) * regions + Math.max(l, r); n++; } }
    }
  };
  scan(null);
  const keys = new Float64Array(n);
  n = 0;
  scan(keys);
  keys.sort();
  let unique = 0;
  for (let i = 0; i < keys.length; i++) if (i === 0 || keys[i] !== keys[i - 1]) unique++;
  const a = new Int32Array(unique), b = new Int32Array(unique), count = new Int32Array(unique);
  let u = -1;
  for (let i = 0; i < keys.length; i++) {
    if (i === 0 || keys[i] !== keys[i - 1]) {
      u++;
      const hi = Math.floor(keys[i] / regions);
      a[u] = hi; b[u] = keys[i] - hi * regions;
    }
    count[u]++;
  }
  return { a, b, count };
}

/** Binary min-heap of numbers. */
class MinHeap {
  #items: number[] = [];
  get size(): number { return this.#items.length; }
  push(value: number): void {
    const items = this.#items;
    let i = items.length;
    items.push(value);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent] <= value) break;
      items[i] = items[parent]; i = parent;
    }
    items[i] = value;
  }
  pop(): number {
    const items = this.#items, top = items[0], last = items.pop()!;
    if (items.length > 0) {
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= items.length) break;
        if (child + 1 < items.length && items[child + 1] < items[child]) child++;
        if (items[child] >= last) break;
        items[i] = items[child]; i = child;
      }
      items[i] = last;
    }
    return top;
  }
}

/** Connected value-band regions with attributes, adjacency and optional small-region merging. See the module header. */
export function segmentValueBands(source: ImageSource, options: SegmentOptions): Segmentation {
  const fn = "segmentValueBands";
  if (options === null || typeof options !== "object") throw new Error(`${fn}: options are required`);
  const { connectivity } = options;
  if (connectivity !== 4 && connectivity !== 8) throw new Error(`${fn}: connectivity must be 4 or 8`);
  if ((options.bands === undefined) === (options.thresholds === undefined)) throw new Error(`${fn}: give exactly one of bands and thresholds`);
  let thresholds: number[];
  if (options.bands !== undefined) {
    const n = checkInteger(fn, "bands", options.bands, 2, 256);
    thresholds = Array.from({ length: n - 1 }, (_, k) => (k + 1) / n);
  } else {
    thresholds = Array.from(options.thresholds!);
    if (thresholds.length < 1 || thresholds.length > 255) throw new Error(`${fn}: thresholds must list 1 to 255 values`);
    thresholds.forEach((t, k) => {
      checkNumber(fn, `thresholds[${k}]`, t, 0, 1);
      if (k > 0 && !(t > thresholds[k - 1])) throw new Error(`${fn}: thresholds must be strictly increasing (thresholds[${k}] = ${t})`);
    });
  }
  const minArea = options.minArea === undefined ? 1 : checkInteger(fn, "minArea", options.minArea, 1, MAX_STRUCTURE_PIXELS);
  const merge = options.merge ?? "longest-border";
  if (merge !== "longest-border" && merge !== "nearest-value") throw new Error(`${fn}: merge must be "longest-border" or "nearest-value"`);
  const minAlpha = options.minAlpha === undefined ? 0 : checkNumber(fn, "minAlpha", options.minAlpha, 0, 1);
  const { width, height, values, alpha } = resolve(fn, source, options.value, options.background);
  const mask = checkMask(fn, options.mask, width, height);
  const P = width * height;

  // 1. band per pixel; -1 excluded
  const band = new Int32Array(P);
  let excluded = 0;
  for (let p = 0; p < P; p++) {
    if ((mask && !(mask[p] >= 0.5)) || (alpha && !(alpha[p] > minAlpha))) { band[p] = -1; excluded++; }
    else band[p] = bandOf(values[p], thresholds);
  }

  // 2. connected components: two-pass union-find, ids in raster order of first pixel
  const parent = new Int32Array(P + 1), provisional = new Int32Array(P).fill(-1);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  let next = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x, b = band[p];
    if (b < 0) continue;
    let mine = -1;
    const join = (q: number): void => {
      if (band[q] !== b) return;
      const r = find(provisional[q]);
      if (mine < 0) mine = r;
      else if (r !== mine) { if (r < mine) { parent[mine] = r; mine = r; } else parent[r] = mine; }
    };
    if (x > 0) join(p - 1);
    if (y > 0) {
      join(p - width);
      if (connectivity === 8) { if (x > 0) join(p - width - 1); if (x + 1 < width) join(p - width + 1); }
    }
    if (mine < 0) { mine = next; parent[next] = next; next++; }
    provisional[p] = mine;
  }
  const rootId = new Int32Array(next).fill(-1);
  const component = new Int32Array(P).fill(-1);
  let regionCount = 0;
  for (let p = 0; p < P; p++) {
    if (band[p] < 0) continue;
    const r = find(provisional[p]);
    if (rootId[r] < 0) {
      if (regionCount >= MAX_REGIONS_BEFORE_MERGE) throw new Error(`${fn}: more than ${MAX_REGIONS_BEFORE_MERGE} regions before merging; use fewer bands or a smoother or smaller source`);
      rootId[r] = regionCount++;
    }
    component[p] = rootId[r];
  }

  // 3. per-region sums
  const area = new Int32Array(regionCount), sum = new Float64Array(regionCount), regionBand = new Int32Array(regionCount);
  for (let p = 0; p < P; p++) {
    const c = component[p];
    if (c < 0) continue;
    area[c]++; sum[c] += values[p]; regionBand[c] = band[p];
  }

  // 4. merge undersized regions
  const root = new Int32Array(regionCount);
  for (let i = 0; i < regionCount; i++) root[i] = i;
  const top = (i: number): number => { while (root[i] !== i) { root[i] = root[root[i]]; i = root[i]; } return i; };
  let merged = 0;
  if (minArea > 1 && regionCount > 0) {
    const heap = new MinHeap(), SCALE = 4_194_304;
    for (let i = 0; i < regionCount; i++) if (area[i] < minArea) heap.push(area[i] * SCALE + i);
    if (heap.size > 0) {
      const edges = borderCounts(component, width, height, regionCount);
      const offset = new Int32Array(regionCount + 1);
      for (let e = 0; e < edges.a.length; e++) { offset[edges.a[e] + 1]++; offset[edges.b[e] + 1]++; }
      for (let i = 0; i < regionCount; i++) offset[i + 1] += offset[i];
      const fillAt = offset.slice(0, regionCount), neighbour = new Int32Array(offset[regionCount]), shared = new Int32Array(offset[regionCount]);
      for (let e = 0; e < edges.a.length; e++) {
        const a = edges.a[e], b = edges.b[e];
        neighbour[fillAt[a]] = b; shared[fillAt[a]++] = edges.count[e];
        neighbour[fillAt[b]] = a; shared[fillAt[b]++] = edges.count[e];
      }
      const maps: (Map<number, number> | undefined)[] = new Array(regionCount);
      const adjacent = (r: number): Map<number, number> => {
        let m = maps[r];
        if (!m) {
          m = new Map();
          for (let k = offset[r]; k < offset[r + 1]; k++) { const n = top(neighbour[k]); if (n !== r) m.set(n, (m.get(n) ?? 0) + shared[k]); }
          maps[r] = m;
        }
        return m;
      };
      while (heap.size > 0) {
        const key = heap.pop(), id = key % SCALE, was = (key - id) / SCALE;
        if (top(id) !== id || area[id] >= minArea) continue;
        if (area[id] !== was) { heap.push(area[id] * SCALE + id); continue; }
        const near = adjacent(id);
        if (near.size === 0) continue;
        const mean = sum[id] / area[id];
        let best = -1, bestBorder = -1, bestGap = Infinity;
        for (const [n, border] of near) {
          const gap = Math.abs(sum[n] / area[n] - mean);
          const better = best < 0 || (merge === "longest-border"
            ? border > bestBorder || (border === bestBorder && (gap < bestGap || (gap === bestGap && n < best)))
            : gap < bestGap || (gap === bestGap && (border > bestBorder || (border === bestBorder && n < best))));
          if (better) { best = n; bestBorder = border; bestGap = gap; }
        }
        const target = adjacent(best);
        target.delete(id);
        for (const [n, border] of near) {
          if (n === best) continue;
          target.set(n, (target.get(n) ?? 0) + border);
          const other = maps[n];
          if (other) { other.delete(id); other.set(best, (other.get(best) ?? 0) + border); }
        }
        root[id] = best; area[best] += area[id]; sum[best] += sum[id]; merged++;
        maps[id] = undefined;
      }
    }
  }

  // 5. final compact labels and exact attributes
  const finalId = new Int32Array(regionCount).fill(-1), labels = new Int32Array(P).fill(-1);
  let finalCount = 0;
  for (let p = 0; p < P; p++) {
    const c = component[p];
    if (c < 0) continue;
    const r = top(c);
    if (finalId[r] < 0) {
      if (finalCount >= MAX_REGIONS) throw new Error(`${fn}: more than ${MAX_REGIONS} regions remain; raise minArea or use fewer bands`);
      finalId[r] = finalCount++;
    }
    labels[p] = finalId[r];
  }
  const fArea = new Int32Array(finalCount), fSum = new Float64Array(finalCount), sx = new Float64Array(finalCount), sy = new Float64Array(finalCount);
  const x0 = new Int32Array(finalCount).fill(width), y0 = new Int32Array(finalCount).fill(height), x1 = new Int32Array(finalCount), y1 = new Int32Array(finalCount);
  const fBand = new Int32Array(finalCount);
  for (let r = 0; r < regionCount; r++) if (finalId[r] >= 0) fBand[finalId[r]] = regionBand[r];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const l = labels[y * width + x];
    if (l < 0) continue;
    fArea[l]++; fSum[l] += values[y * width + x]; sx[l] += x + 0.5; sy[l] += y + 0.5;
    if (x < x0[l]) x0[l] = x;
    if (x + 1 > x1[l]) x1[l] = x + 1;
    if (y < y0[l]) y0[l] = y;
    if (y + 1 > y1[l]) y1[l] = y + 1;
  }
  const regions: ValueRegion[] = [];
  let undersized = 0;
  for (let l = 0; l < finalCount; l++) {
    if (fArea[l] < minArea) undersized++;
    regions.push(Object.freeze({
      id: l, band: fBand[l], area: fArea[l], mean: fSum[l] / fArea[l],
      bbox: Object.freeze({ x0: x0[l], y0: y0[l], x1: x1[l], y1: y1[l] }),
      centroid: Object.freeze([sx[l] / fArea[l], sy[l] / fArea[l]] as const),
    }));
  }
  const borders = borderCounts(labels, width, height, Math.max(finalCount, 1));
  const adjacency: RegionAdjacency[] = [];
  for (let e = 0; e < borders.a.length; e++) adjacency.push(Object.freeze({ a: borders.a[e], b: borders.b[e], length: borders.count[e] }));
  return Object.freeze({
    width, height, connectivity, thresholds: frozen(thresholds), labels: adoptLabelGrid(width, height, labels), regions: Object.freeze(regions),
    adjacency: Object.freeze(adjacency), excluded, merged, undersized,
  });
}

/** 1 inside region `id`, 0 elsewhere: the region as a mask for downstream boundary extraction. */
export function valueRegionMask(segmentation: Segmentation, id: number): ScalarGrid {
  if (!Number.isInteger(id) || id < 0 || id >= segmentation.regions.length) throw new Error(`valueRegionMask: id must be an integer in [0, ${segmentation.regions.length - 1}]`);
  const labels = gridStorage(segmentation.labels), out = new Float64Array(labels.length);
  for (let i = 0; i < labels.length; i++) if (labels[i] === id) out[i] = 1;
  return adoptScalarGrid(segmentation.width, segmentation.height, out);
}

// ---------------------------------------------------------------------------------------------
// Adaptive subdivision

export type SubdivisionMetric = "variance" | "stddev" | "range" | "sse";
export type SplitPolicy = "quad" | "longest" | "best";

export interface SubdivideOptions {
  value?: ValueKind;
  background?: number;
  /** REQUIRED: `variance` (value²), `stddev` (value), `range` (max − min) or `sse` (area · variance). */
  metric: SubdivisionMetric;
  /** A cell is split while its metric is greater than this (>= 0). */
  threshold: number;
  /** Minimum side length in pixels (integer >= 1). A cell splits along an axis only if that side is at least twice this. */
  minCell: number;
  /** Cells with a side above this are always split (integer >= 2·minCell − 1). Default: no limit. */
  maxCell?: number;
  /** Default `quad`. */
  split?: SplitPolicy;
  /** Leaf bound, default 4096, at most 250,000; exceeding it throws. */
  maxCells?: number;
}

export interface ImageCell {
  /** Path id: `r`, then `.k` per level (quad: 0 TL, 1 TR, 2 BL, 3 BR; binary: 0 first half, 1 second). */
  readonly id: string;
  readonly parent: string | null;
  readonly depth: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Mean of the source values over the cell. */
  readonly mean: number;
  /** The requested metric over the cell. */
  readonly error: number;
  /** How the cell was split; null for a leaf. */
  readonly split: "quad" | "x" | "y" | null;
  readonly children: readonly string[];
}

export interface Subdivision {
  readonly width: number;
  readonly height: number;
  /** Every cell, parents before children, children in id order. */
  readonly nodes: readonly ImageCell[];
  /** Leaves in traversal order (a Z-order): they tile the image exactly. */
  readonly leaves: readonly ImageCell[];
}

/** Adaptive error subdivision into a region tree of rectangles; see the module header for every rule. */
export function subdivideImage(source: ImageSource, options: SubdivideOptions): Subdivision {
  const fn = "subdivideImage";
  if (options === null || typeof options !== "object") throw new Error(`${fn}: options are required`);
  const { metric } = options;
  if (!["variance", "stddev", "range", "sse"].includes(metric)) throw new Error(`${fn}: metric must be "variance", "stddev", "range" or "sse"`);
  const threshold = checkNumber(fn, "threshold", options.threshold, 0, Infinity);
  const minCell = checkInteger(fn, "minCell", options.minCell, 1, 8192);
  const maxCell = options.maxCell === undefined ? Infinity : checkInteger(fn, "maxCell", options.maxCell, 2 * minCell - 1, 8192);
  const policy = options.split ?? "quad";
  if (policy !== "quad" && policy !== "longest" && policy !== "best") throw new Error(`${fn}: split must be "quad", "longest" or "best"`);
  const maxCells = options.maxCells === undefined ? 4096 : checkInteger(fn, "maxCells", options.maxCells, 1, MAX_SUBDIVISION_CELLS);
  const { width, height, values } = resolve(fn, source, options.value, options.background);
  const W = width + 1, s1 = new Float64Array(W * (height + 1)), s2 = new Float64Array(W * (height + 1)), origin = values[0];
  for (let y = 0; y < height; y++) {
    let r1 = 0, r2 = 0;
    for (let x = 0; x < width; x++) {
      const d = values[y * width + x] - origin;
      r1 += d; r2 += d * d;
      s1[(y + 1) * W + x + 1] = s1[y * W + x + 1] + r1;
      s2[(y + 1) * W + x + 1] = s2[y * W + x + 1] + r2;
    }
  }
  const box = (t: Float64Array, x: number, y: number, w: number, h: number): number => t[(y + h) * W + x + w] - t[y * W + x + w] - t[(y + h) * W + x] + t[y * W + x];
  const stats = (x: number, y: number, w: number, h: number): { mean: number; variance: number } => {
    const n = w * h, m = box(s1, x, y, w, h) / n;
    return { mean: origin + m, variance: Math.max(0, box(s2, x, y, w, h) / n - m * m) };
  };
  const errorOf = (x: number, y: number, w: number, h: number, variance: number): number => {
    switch (metric) {
      case "variance": return variance;
      case "stddev": return Math.sqrt(variance);
      case "sse": return variance * w * h;
      default: {
        let lo = Infinity, hi = -Infinity;
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const v = values[j * width + i]; if (v < lo) lo = v; if (v > hi) hi = v; }
        return hi - lo;
      }
    }
  };
  const sseOf = (x: number, y: number, w: number, h: number): number => stats(x, y, w, h).variance * w * h;
  const nodes: ImageCell[] = [], leaves: ImageCell[] = [];
  let leafCount = 1;
  type Pending = { id: string; parent: string | null; depth: number; x: number; y: number; w: number; h: number };
  const stack: Pending[] = [{ id: "r", parent: null, depth: 0, x: 0, y: 0, w: width, h: height }];
  while (stack.length > 0) {
    const { id, parent, depth, x, y, w, h } = stack.pop()!;
    const { mean, variance } = stats(x, y, w, h), error = errorOf(x, y, w, h, variance);
    const canX = w >= 2 * minCell, canY = h >= 2 * minCell;
    let mode: "quad" | "x" | "y" | null = null;
    if ((canX || canY) && (w > maxCell || h > maxCell || error > threshold)) {
      if (policy === "quad") mode = canX && canY ? "quad" : canX ? "x" : "y";
      else if (policy === "longest") mode = canX && canY ? (w >= h ? "x" : "y") : canX ? "x" : "y";
      else if (canX && canY) {
        const hw = w >> 1, hh = h >> 1;
        const byX = sseOf(x, y, hw, h) + sseOf(x + hw, y, w - hw, h), byY = sseOf(x, y, w, hh) + sseOf(x, y + hh, w, h - hh);
        mode = byY < byX ? "y" : "x";
      } else mode = canX ? "x" : "y";
    }
    const children: Pending[] = [];
    if (mode) {
      const hw = w >> 1, hh = h >> 1;
      const rects = mode === "quad" ? [[x, y, hw, hh], [x + hw, y, w - hw, hh], [x, y + hh, hw, h - hh], [x + hw, y + hh, w - hw, h - hh]]
        : mode === "x" ? [[x, y, hw, h], [x + hw, y, w - hw, h]] : [[x, y, w, hh], [x, y + hh, w, h - hh]];
      leafCount += rects.length - 1;
      if (leafCount > maxCells) throw new Error(`${fn}: more than ${maxCells} cells; raise threshold, raise minCell or raise maxCells`);
      rects.forEach(([cx, cy, cw, ch], k) => children.push({ id: `${id}.${k}`, parent: id, depth: depth + 1, x: cx, y: cy, w: cw, h: ch }));
    }
    const cell: ImageCell = Object.freeze({ id, parent, depth, x, y, width: w, height: h, mean, error, split: mode, children: Object.freeze(children.map(c => c.id)) });
    nodes.push(cell);
    if (!mode) leaves.push(cell);
    for (let k = children.length - 1; k >= 0; k--) stack.push(children[k]);
  }
  return Object.freeze({ width, height, nodes: Object.freeze(nodes), leaves: Object.freeze(leaves) });
}

/** Leaf index (into `leaves`) covering each pixel: a label image of the partition. */
export function subdivisionLabels(subdivision: Subdivision): LabelGrid {
  const { width, height } = subdivision, out = new Int32Array(width * height);
  subdivision.leaves.forEach((cell, index) => {
    for (let j = cell.y; j < cell.y + cell.height; j++) out.fill(index, j * width + cell.x, j * width + cell.x + cell.width);
  });
  return adoptLabelGrid(width, height, out);
}

// ---------------------------------------------------------------------------------------------
// Orientation

export interface OrientationOptions {
  value?: ValueKind;
  background?: number;
  /** REQUIRED. Gaussian standard deviation of the tensor smoothing, in pixels, 0..64 (0: none). */
  smoothing: number;
  /** Energy at or below which a place has no direction. Default 1e-10. */
  flatEnergy?: number;
  /** Direction reported where none is defined, radians (any finite value; normalised to [0, π)). Default 0. */
  fallback?: number;
}

export interface OrientationSample {
  /** Tangent of the level lines (along stripes and edges), unsigned, in [0, π). */
  readonly direction: number;
  /** Direction of steepest change, unsigned, in [0, π): `direction + π/2` (mod π). */
  readonly gradientDirection: number;
  /** (λ1 − λ2)/(λ1 + λ2) in [0, 1]; 0 where no direction is defined. */
  readonly coherence: number;
  /** λ1 + λ2: mean squared gradient (value² per pixel²). */
  readonly energy: number;
  /** False where the tensor is flat or exactly isotropic: `direction` is then the fallback. */
  readonly defined: boolean;
}

export interface OrientationField {
  readonly width: number;
  readonly height: number;
  readonly smoothing: number;
  readonly flatEnergy: number;
  readonly fallback: number;
  /** Structure tensor components after smoothing. */
  readonly tensor: Readonly<{ xx: ScalarGrid; xy: ScalarGrid; yy: ScalarGrid }>;
}

const wrapHalfTurn = (a: number): number => {
  const r = a - Math.PI * Math.floor(a / Math.PI);
  return r >= Math.PI ? 0 : r;
};

function decompose(xx: number, xy: number, yy: number, flatEnergy: number, fallback: number): OrientationSample {
  const trace = xx + yy, half = Math.hypot((xx - yy) / 2, xy);
  if (!(trace > flatEnergy) || half === 0)
    return Object.freeze({ direction: fallback, gradientDirection: wrapHalfTurn(fallback + Math.PI / 2), coherence: 0, energy: Math.max(0, trace), defined: false });
  const direction = wrapHalfTurn(0.5 * Math.atan2(2 * xy, xx - yy) + Math.PI / 2);
  return Object.freeze({ direction, gradientDirection: wrapHalfTurn(direction + Math.PI / 2), coherence: Math.min(1, 2 * half / trace), energy: trace, defined: true });
}

/** Structure-tensor orientation field with stated smoothing. See the module header. */
export function orientationField(source: ImageSource, options: OrientationOptions): OrientationField {
  const fn = "orientationField";
  if (options === null || typeof options !== "object") throw new Error(`${fn}: options are required`);
  const smoothing = checkNumber(fn, "smoothing", options.smoothing, 0, 64);
  const flatEnergy = options.flatEnergy === undefined ? 1e-10 : checkNumber(fn, "flatEnergy", options.flatEnergy, 0, Infinity);
  const fallback = wrapHalfTurn(options.fallback === undefined ? 0 : checkNumber(fn, "fallback", options.fallback, -1e6, 1e6));
  const size = sourceSize(fn, source), P = size.width * size.height, radius = smoothing > 0 ? Math.ceil(3 * smoothing) : 0;
  const work = P * (6 * (2 * radius + 1) + 30);
  if (work > MAX_ORIENTATION_WORK) throw new Error(`${fn}: smoothing ${smoothing} on ${size.width} x ${size.height} needs about ${Math.round(work / 1e6)} million operations; the limit is ${MAX_ORIENTATION_WORK / 1e6} million: lower smoothing or shrink the source`);
  const { width, height, values } = resolve(fn, source, options.value, options.background);
  const xx = new Float64Array(P), xy = new Float64Array(P), yy = new Float64Array(P);
  const at = (x: number, y: number): number => values[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const gx = (3 * (at(x + 1, y - 1) - at(x - 1, y - 1)) + 10 * (at(x + 1, y) - at(x - 1, y)) + 3 * (at(x + 1, y + 1) - at(x - 1, y + 1))) / 32;
    const gy = (3 * (at(x - 1, y + 1) - at(x - 1, y - 1)) + 10 * (at(x, y + 1) - at(x, y - 1)) + 3 * (at(x + 1, y + 1) - at(x + 1, y - 1))) / 32;
    const p = y * width + x;
    xx[p] = gx * gx; xy[p] = gx * gy; yy[p] = gy * gy;
  }
  if (radius > 0) {
    const kernel = new Float64Array(radius + 1);
    for (let k = 0; k <= radius; k++) kernel[k] = Math.exp(-(k * k) / (2 * smoothing * smoothing));
    const smooth = (data: Float64Array): void => {
      const tmp = new Float64Array(P);
      const normX = new Float64Array(width), normY = new Float64Array(height);
      for (let x = 0; x < width; x++) { let s = 0; for (let k = Math.max(0, x - radius); k <= Math.min(width - 1, x + radius); k++) s += kernel[Math.abs(k - x)]; normX[x] = s; }
      for (let y = 0; y < height; y++) { let s = 0; for (let k = Math.max(0, y - radius); k <= Math.min(height - 1, y + radius); k++) s += kernel[Math.abs(k - y)]; normY[y] = s; }
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        let s = 0;
        for (let k = Math.max(0, x - radius); k <= Math.min(width - 1, x + radius); k++) s += kernel[Math.abs(k - x)] * data[y * width + k];
        tmp[y * width + x] = s / normX[x];
      }
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        let s = 0;
        for (let k = Math.max(0, y - radius); k <= Math.min(height - 1, y + radius); k++) s += kernel[Math.abs(k - y)] * tmp[k * width + x];
        data[y * width + x] = s / normY[y];
      }
    };
    smooth(xx); smooth(xy); smooth(yy);
  }
  return Object.freeze({
    width, height, smoothing, flatEnergy, fallback,
    tensor: Object.freeze({ xx: adoptScalarGrid(width, height, xx), xy: adoptScalarGrid(width, height, xy), yy: adoptScalarGrid(width, height, yy) }),
  });
}

/** The orientation at integer pixel (i, j). */
export function orientationPixel(field: OrientationField, i: number, j: number): OrientationSample {
  const p = j * field.width + i;
  if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0 || i >= field.width || j >= field.height) throw new Error(`orientationPixel: pixel (${i}, ${j}) is outside ${field.width} x ${field.height}`);
  return decompose(gridStorage(field.tensor.xx)[p], gridStorage(field.tensor.xy)[p], gridStorage(field.tensor.yy)[p], field.flatEnergy, field.fallback);
}

/**
 * The orientation at any raster point: the tensor is interpolated bilinearly with the pixel-center
 * convention (edges clamp) and then decomposed, so at a pixel centre it equals `orientationPixel`.
 */
export function orientationAt(field: OrientationField, x: number, y: number): OrientationSample {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e9 || Math.abs(y) > 1e9) throw new Error(`orientationAt: point (${x}, ${y}) must be finite with coordinates within ±1e9`);
  const { width, height } = field, u = x - 0.5, v = y - 0.5, i = Math.floor(u), j = Math.floor(v), s = u - i, t = v - j;
  const i0 = Math.min(width - 1, Math.max(0, i)), i1 = Math.min(width - 1, Math.max(0, i + 1)), j0 = Math.min(height - 1, Math.max(0, j)), j1 = Math.min(height - 1, Math.max(0, j + 1));
  const mix = (grid: ScalarGrid): number => {
    const d = gridStorage(grid);
    return (1 - t) * ((1 - s) * d[j0 * width + i0] + s * d[j0 * width + i1]) + t * ((1 - s) * d[j1 * width + i0] + s * d[j1 * width + i1]);
  };
  return decompose(mix(field.tensor.xx), mix(field.tensor.xy), mix(field.tensor.yy), field.flatEnergy, field.fallback);
}

/**
 * The orientation of a whole integer pixel rectangle: the (already smoothed) structure tensor is averaged with
 * equal weight per pixel and THEN decomposed, so opposed strips of equal energy cancel to coherence 0 rather
 * than averaging two angles. Energy is the mean over the rectangle; a flat rectangle reports the field's fallback.
 */
export function orientationInRect(field: OrientationField, rect: { x: number; y: number; width: number; height: number }): OrientationSample {
  const { x, y, width, height } = rect;
  for (const [name, v] of [["x", x], ["y", y], ["width", width], ["height", height]] as const)
    if (!Number.isInteger(v)) throw new Error(`orientationInRect: rect.${name} must be an integer`);
  if (width < 1 || height < 1 || x < 0 || y < 0 || x + width > field.width || y + height > field.height)
    throw new Error(`orientationInRect: rect ${x},${y} ${width} x ${height} is outside ${field.width} x ${field.height}`);
  const xx = gridStorage(field.tensor.xx), xy = gridStorage(field.tensor.xy), yy = gridStorage(field.tensor.yy);
  let sxx = 0, sxy = 0, syy = 0;
  for (let j = y; j < y + height; j++) for (let i = x; i < x + width; i++) { const p = j * field.width + i; sxx += xx[p]; sxy += xy[p]; syy += yy[p]; }
  const n = width * height;
  return decompose(sxx / n, sxy / n, syy / n, field.flatEnergy, field.fallback);
}

/** Per-pixel direction, coherence and energy as grids (`direction` is the fallback where undefined). */
export function orientationGrids(field: OrientationField): Readonly<{ direction: ScalarGrid; coherence: ScalarGrid; energy: ScalarGrid }> {
  const P = field.width * field.height, direction = new Float64Array(P), coherence = new Float64Array(P), energy = new Float64Array(P);
  const xx = gridStorage(field.tensor.xx), xy = gridStorage(field.tensor.xy), yy = gridStorage(field.tensor.yy);
  for (let p = 0; p < P; p++) {
    const o = decompose(xx[p], xy[p], yy[p], field.flatEnergy, field.fallback);
    direction[p] = o.direction; coherence[p] = o.coherence; energy[p] = o.energy;
  }
  return Object.freeze({ direction: adoptScalarGrid(field.width, field.height, direction), coherence: adoptScalarGrid(field.width, field.height, coherence), energy: adoptScalarGrid(field.width, field.height, energy) });
}

export interface OrientationVectorOptions {
  /** Take the across-edge (gradient) direction instead of the along-edge one. */
  across?: boolean;
  /** Previous travel direction; the returned vector never points against it (dot >= 0). */
  hint?: readonly [number, number];
}

/**
 * A unit vector along the sample's direction with a chosen sign. Without a hint the vector is
 * (cos a, sin a) for a in [0, π), i.e. pointing right or down. With a hint the sign is the one with
 * non-negative dot product (an exactly perpendicular hint keeps the default sign), so stepping along a
 * field never flips because an unsigned orientation crossed 0 or π.
 */
export function orientationVector(sample: OrientationSample, options: OrientationVectorOptions = {}): [number, number] {
  const a = options.across ? sample.gradientDirection : sample.direction;
  let dx = Math.cos(a), dy = Math.sin(a);
  if (options.hint) {
    const [hx, hy] = options.hint;
    if (!Number.isFinite(hx) || !Number.isFinite(hy)) throw new Error("orientationVector: hint must be finite");
    if (dx * hx + dy * hy < 0) { dx = -dx; dy = -dy; }
  }
  return [dx, dy];
}

// ---------------------------------------------------------------------------------------------
// Scan runs and stable sorting

export type ScanDirection = "right" | "left" | "down" | "up" | "down-right" | "down-left" | "up-right" | "up-left";
const STEPS: Readonly<Record<ScanDirection, readonly [number, number]>> = Object.freeze({
  right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1], "down-right": [1, 1], "down-left": [-1, 1], "up-right": [1, -1], "up-left": [-1, -1],
});

export interface ScanOptions {
  /** REQUIRED: visiting order along each scan line. */
  direction: ScanDirection;
  /** Value used to select pixels (rasters only; default `lightness`). */
  value?: ValueKind;
  background?: number;
  /** Selected values lie in [min, max], inclusive. Defaults 0 and 1. */
  min?: number;
  max?: number;
  /** Only pixels where the mask is >= 0.5 can be selected. */
  mask?: ScalarGrid;
  /** Pixels with alpha <= minAlpha are never selected (default 0). */
  minAlpha?: number;
  /** Shorter runs are dropped (their pixels stay unselected). Integer >= 1, default 1. */
  minRun?: number;
}

/** `length` selected pixels starting at (x, y), stepping by the set's (dx, dy). */
export interface ScanRun {
  readonly index: number;
  /** Ordinal of the scan line among all lines, in raster order of line starts. */
  readonly line: number;
  readonly x: number;
  readonly y: number;
  readonly length: number;
}

export interface RunSet {
  readonly width: number;
  readonly height: number;
  readonly direction: ScanDirection;
  readonly dx: number;
  readonly dy: number;
  readonly runs: readonly ScanRun[];
  /** Number of scan lines (every pixel is on exactly one). */
  readonly lines: number;
  readonly selectedPixels: number;
}

/** Selected runs of straight scan lines. See the module header for the selection and ordering rules. */
export function scanRuns(source: ImageSource, options: ScanOptions): RunSet {
  const fn = "scanRuns";
  if (options === null || typeof options !== "object") throw new Error(`${fn}: options are required`);
  const step = STEPS[options.direction as ScanDirection];
  if (!step || !Object.hasOwn(STEPS, options.direction)) throw new Error(`${fn}: direction must be one of ${Object.keys(STEPS).join(", ")}`);
  const min = options.min === undefined ? 0 : checkNumber(fn, "min", options.min, -Infinity, Infinity);
  const max = options.max === undefined ? 1 : checkNumber(fn, "max", options.max, -Infinity, Infinity);
  if (min > max) throw new Error(`${fn}: min must not exceed max`);
  const minAlpha = options.minAlpha === undefined ? 0 : checkNumber(fn, "minAlpha", options.minAlpha, 0, 1);
  const minRun = options.minRun === undefined ? 1 : checkInteger(fn, "minRun", options.minRun, 1, 8192);
  const { width, height, values, alpha } = resolve(fn, source, options.value, options.background);
  const mask = checkMask(fn, options.mask, width, height);
  const [dx, dy] = step, runs: ScanRun[] = [];
  let lines = 0, selectedPixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = x - dx, py = y - dy;
    if (px >= 0 && px < width && py >= 0 && py < height) continue;
    let cx = x, cy = y, runStart = -1, length = 0;
    const close = (): void => {
      if (length >= minRun) {
        if (runs.length >= MAX_RUNS) throw new Error(`${fn}: more than ${MAX_RUNS} runs; raise minRun or narrow min and max or the mask`);
        runs.push(Object.freeze({ index: runs.length, line: lines, x: runStart % width, y: Math.floor(runStart / width), length }));
        selectedPixels += length;
      }
      length = 0;
    };
    while (cx >= 0 && cx < width && cy >= 0 && cy < height) {
      const p = cy * width + cx, v = values[p];
      const selected = v >= min && v <= max && (!mask || mask[p] >= 0.5) && (!alpha || alpha[p] > minAlpha);
      if (selected) { if (length === 0) runStart = p; length++; } else if (length > 0) close();
      cx += dx; cy += dy;
    }
    if (length > 0) close();
    lines++;
  }
  return Object.freeze({ width, height, direction: options.direction, dx, dy, runs: Object.freeze(runs), lines, selectedPixels });
}

/** Pixel index (y * width + x) of the k-th pixel of a run. */
export function scanRunPixel(set: RunSet, run: ScanRun, k: number): number {
  if (!Number.isInteger(k) || k < 0 || k >= run.length) throw new Error(`scanRunPixel: k must be an integer in [0, ${run.length - 1}]`);
  return (run.y + k * set.dy) * set.width + run.x + k * set.dx;
}

/** Centre-line segment of a run from its first to its last pixel centre, in raster space. */
export function scanRunSegment(set: RunSet, run: ScanRun): readonly [[number, number], [number, number]] {
  return Object.freeze([[run.x + 0.5, run.y + 0.5], [run.x + (run.length - 1) * set.dx + 0.5, run.y + (run.length - 1) * set.dy + 0.5]] as [[number, number], [number, number]]);
}

export interface SortRunsOptions {
  /** REQUIRED: what to sort by: a value kind of the raster, or a ScalarGrid of the source's size. */
  key: ValueKind | ScalarGrid;
  background?: number;
  /** REQUIRED. Ties keep scan order in both orders. */
  order: "ascending" | "descending";
}

/** For every selected pixel slot (in run order, scan order inside a run): where it is (`to`) and which source pixel goes there (`from`), as pixel indices. */
export interface PixelMoves {
  readonly count: number;
  to(slot: number): number;
  from(slot: number): number;
}

/** Stable sort of every run by key. Returns the permutation only; `applyPixelMoves` writes pixels. */
export function sortScanRuns(source: ImageSource, set: RunSet, options: SortRunsOptions): PixelMoves {
  const fn = "sortScanRuns";
  if (options === null || typeof options !== "object") throw new Error(`${fn}: options are required`);
  if (options.order !== "ascending" && options.order !== "descending") throw new Error(`${fn}: order must be "ascending" or "descending"`);
  if (source.width !== set.width || source.height !== set.height) throw new Error(`${fn}: the source is ${source.width} x ${source.height} but the runs are for ${set.width} x ${set.height}`);
  let key: Float64Array;
  if (typeof options.key === "string") {
    if (!isRaster(source)) throw new Error(`${fn}: a value-kind key needs a Raster source; pass a ScalarGrid key instead`);
    key = gridStorage(valueField(source, options.key, options.background === undefined ? {} : { background: options.background }));
  } else {
    if (options.key === null || typeof options.key !== "object" || options.key.kind !== "scalar" || options.key.width !== set.width || options.key.height !== set.height)
      throw new Error(`${fn}: key must be a value kind or a ScalarGrid of ${set.width} x ${set.height}`);
    key = gridStorage(options.key);
  }
  const sign = options.order === "ascending" ? 1 : -1;
  const to = new Int32Array(set.selectedPixels), from = new Int32Array(set.selectedPixels);
  let slot = 0;
  for (const run of set.runs) {
    const local = new Int32Array(run.length), slots = new Int32Array(run.length), keys = new Float64Array(run.length);
    for (let k = 0; k < run.length; k++) { local[k] = k; slots[k] = scanRunPixel(set, run, k); keys[k] = key[slots[k]]; }
    if (run.length > 1) local.sort((a, b) => sign * (keys[a] - keys[b]) || a - b);
    for (let k = 0; k < run.length; k++) { to[slot + k] = slots[k]; from[slot + k] = slots[local[k]]; }
    slot += run.length;
  }
  return Object.freeze({
    count: to.length,
    to: (i: number): number => { if (!Number.isInteger(i) || i < 0 || i >= to.length) throw new Error(`PixelMoves slot ${i} is outside 0..${to.length - 1}`); return to[i]; },
    from: (i: number): number => { if (!Number.isInteger(i) || i < 0 || i >= from.length) throw new Error(`PixelMoves slot ${i} is outside 0..${from.length - 1}`); return from[i]; },
  });
}

export interface ApplyMovesOptions {
  /** `move`: whole pixels move. `stay`: color moves, every slot keeps its own alpha (no effect on rasters without alpha). */
  alpha: "move" | "stay";
}

/** A new raster with the moves applied to the source's pixels; every pixel not in a move is copied unchanged. */
export function applyPixelMoves(raster: Raster, moves: PixelMoves, options: ApplyMovesOptions): Raster {
  if (options === null || typeof options !== "object" || (options.alpha !== "move" && options.alpha !== "stay")) throw new Error(`applyPixelMoves: alpha must be "move" or "stay"`);
  const store = rasterStorage(raster), out = store.slice(), { channels } = raster, P = raster.width * raster.height;
  const hasAlpha = channels === 2 || channels === 4, cc = hasAlpha ? channels - 1 : channels;
  for (let i = 0; i < moves.count; i++) {
    const to = moves.to(i), from = moves.from(i);
    if (to >= P || from >= P) throw new Error("applyPixelMoves: the moves address pixels outside this raster");
    if (!hasAlpha || options.alpha === "move") { for (let c = 0; c < channels; c++) out[to * channels + c] = store[from * channels + c]; continue; }
    const aTo = store[to * channels + cc], aFrom = store[from * channels + cc];
    for (let c = 0; c < cc; c++) {
      const v = store[from * channels + c];
      if (raster.alpha === "straight") out[to * channels + c] = v;
      else out[to * channels + c] = aFrom > 0 ? Math.min(aTo, raster.format === "u8" ? Math.round(v / aFrom * aTo) : v / aFrom * aTo) : 0;
    }
    out[to * channels + cc] = aTo;
  }
  return createRaster({ width: raster.width, height: raster.height, channels, format: raster.format, colorSpace: raster.colorSpace, alpha: raster.alpha, data: out, label: raster.label });
}

/** Scan, sort and write in one call. `runs` and `moves` are returned so callers can draw run boundaries or replay the permutation. */
export function pixelSort(raster: Raster, scan: ScanOptions, sort: SortRunsOptions & ApplyMovesOptions): { raster: Raster; runs: RunSet; moves: PixelMoves } {
  const runs = scanRuns(raster, scan), moves = sortScanRuns(raster, runs, sort);
  return { raster: applyPixelMoves(raster, moves, sort), runs, moves };
}

// ---------------------------------------------------------------------------------------------
// Phase-preserving frequency modulation

export interface FrequencyModulationOptions {
  /** Arc length of the line, canvas units (> 0). */
  length: number;
  /** Tone in [0, 1] at evenly spaced stations 0..length inclusive: an array (>= 2 values), or a function of s with `samples`. */
  tones: ArrayLike<number> | ((s: number) => number);
  /** Number of stations (>= 2) when `tones` is a function. */
  samples?: number;
  /** Cycles per length unit at tone 0 and tone 1 (0 <= min, max). */
  frequency: { min: number; max: number };
  /** Peak offset, length units, at tone 0 and tone 1 (>= 0). */
  amplitude: { min: number; max: number };
  /** Exponent applied to the tone first (> 0, default 1). */
  curve?: number;
  /** Phase at s = 0, radians (default 0). */
  phase?: number;
  /** Largest phase advance between vertices, radians, in (0, π/2]. Default π/8. */
  maxPhaseStep?: number;
}

export interface ModulatedLine {
  readonly count: number;
  readonly length: number;
  /** Arc-length parameter of each vertex, strictly increasing from 0 to `length`. */
  readonly s: readonly number[];
  /** Exact phase φ(s), radians, non-decreasing. */
  readonly phase: readonly number[];
  /** Offset A(s)·sin φ(s) from the carrier line (positive is to the right of the direction of travel, on screen). */
  readonly offset: readonly number[];
  /** f(s), cycles per length unit. */
  readonly frequency: readonly number[];
  readonly amplitude: readonly number[];
  /** Phase at s = length: pass it as `phase` to continue the wave on a following line. */
  readonly endPhase: number;
  /** Largest phase advance between consecutive vertices (<= maxPhaseStep). */
  readonly largestPhaseStep: number;
}

/** Continuous-phase frequency-modulated offset along a line. See the module header for the equation. */
export function frequencyModulation(options: FrequencyModulationOptions): ModulatedLine {
  const fn = "frequencyModulation";
  if (options === null || typeof options !== "object") throw new Error(`${fn}: options are required`);
  const length = checkNumber(fn, "length", options.length, Number.MIN_VALUE, 1e9);
  const { frequency, amplitude } = options;
  if (!frequency || !amplitude) throw new Error(`${fn}: frequency and amplitude are required`);
  const fMin = checkNumber(fn, "frequency.min", frequency.min, 0, 1e9), fMax = checkNumber(fn, "frequency.max", frequency.max, 0, 1e9);
  const aMin = checkNumber(fn, "amplitude.min", amplitude.min, 0, 1e9), aMax = checkNumber(fn, "amplitude.max", amplitude.max, 0, 1e9);
  const curve = options.curve === undefined ? 1 : checkNumber(fn, "curve", options.curve, Number.MIN_VALUE, 100);
  const phase0 = options.phase === undefined ? 0 : checkNumber(fn, "phase", options.phase, -1e9, 1e9);
  const maxStep = options.maxPhaseStep === undefined ? Math.PI / 8 : checkNumber(fn, "maxPhaseStep", options.maxPhaseStep, Number.MIN_VALUE, Math.PI / 2);
  let tone: number[];
  if (typeof options.tones === "function") {
    const n = checkInteger(fn, "samples", options.samples, 2, MAX_MODULATION_POINTS);
    tone = Array.from({ length: n }, (_, k) => (options.tones as (s: number) => number)(k === n - 1 ? length : (k * length) / (n - 1)));
  } else {
    if (options.samples !== undefined) throw new Error(`${fn}: samples applies only when tones is a function`);
    const list = options.tones as ArrayLike<number>;
    if (list === null || typeof list !== "object" || typeof list.length !== "number") throw new Error(`${fn}: tones must be an array or a function`);
    if (list.length < 2 || list.length > MAX_MODULATION_POINTS) throw new Error(`${fn}: tones needs 2 to ${MAX_MODULATION_POINTS} values (got ${list.length})`);
    tone = Array.from(list);
  }
  const n = tone.length, f = new Float64Array(n), a = new Float64Array(n);
  tone.forEach((t, k) => {
    checkNumber(fn, `tones[${k}]`, t, 0, 1);
    const tau = t === 0 ? 0 : t ** curve;
    f[k] = fMin + (fMax - fMin) * tau; a[k] = aMin + (aMax - aMin) * tau;
  });
  const ds = length / (n - 1), sub = new Int32Array(n - 1);
  let vertices = 1;
  for (let i = 0; i < n - 1; i++) {
    const m = Math.max(1, Math.ceil((TAU * Math.max(f[i], f[i + 1]) * ds) / maxStep));
    vertices += m;
    if (vertices > MAX_MODULATION_POINTS) throw new Error(`${fn}: more than ${MAX_MODULATION_POINTS} vertices; lower frequency.max, raise maxPhaseStep or shorten length`);
    sub[i] = m;
  }
  const s: number[] = [0], phase: number[] = [phase0], offset: number[] = [a[0] * Math.sin(phase0)], freq: number[] = [f[0]], amp: number[] = [a[0]];
  let largest = 0, before = phase0;
  for (let i = 0; i < n - 1; i++) {
    const m = sub[i], f0 = f[i], slope = (f[i + 1] - f0) / ds;
    for (let j = 1; j <= m; j++) {
      const u = j === m ? ds : (ds * j) / m;
      const value = j === m ? before + TAU * 0.5 * (f0 + f[i + 1]) * ds : before + TAU * (f0 * u + 0.5 * slope * u * u);
      largest = Math.max(largest, value - phase[phase.length - 1]);
      const amplitudeHere = a[i] + (a[i + 1] - a[i]) * (u / ds);
      s.push(i === n - 2 && j === m ? length : i * ds + u); phase.push(value); freq.push(f0 + slope * u); amp.push(amplitudeHere); offset.push(amplitudeHere * Math.sin(value));
    }
    before += TAU * 0.5 * (f0 + f[i + 1]) * ds;
  }
  return Object.freeze({
    count: s.length, length, s: Object.freeze(s), phase: Object.freeze(phase), offset: Object.freeze(offset), frequency: Object.freeze(freq),
    amplitude: Object.freeze(amp), endPhase: phase[phase.length - 1], largestPhaseStep: largest,
  });
}

/** Vertices of the modulated line placed on a straight carrier from (x, y) at `angle` radians: carrier point plus offset along the right-hand normal. */
export function modulatedPolyline(line: ModulatedLine, origin: { x: number; y: number; angle: number }): readonly (readonly [number, number])[] {
  const { x, y, angle } = origin;
  for (const [name, v] of [["x", x], ["y", y], ["angle", angle]] as const) if (!Number.isFinite(v)) throw new Error(`modulatedPolyline: origin.${name} must be finite`);
  const c = Math.cos(angle), sn = Math.sin(angle);
  return Object.freeze(line.s.map((s, k) => Object.freeze([x + s * c - line.offset[k] * sn, y + s * sn + line.offset[k] * c] as const)));
}
