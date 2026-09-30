/**
 * The raster half of the packing search (see shape-packing-layout.ts): a conservative occupancy bitset and the
 * bit-parallel "where does this rasterised piece fit" query. Nothing here decides validity: every placement it
 * proposes is re-checked with the exact domain predicates.
 *
 * CELLS. Cell (i, j) is the closed square [i, i+1] × [j, j+1] in grid units (one unit = one cell = `cell` canvas
 * units). A shape TOUCHES a cell when the closed cell meets the closed shape. `rasterize` marks, for a set of rings,
 * bit 1 = a boundary edge touches the cell (a conservative super-cover with a 1e-9 margin) and bit 2 = the cell
 * centre is inside by even-odd. A cell touched by no boundary edge lies wholly on one side of the boundary, so
 * "centre inside and no edge touches" means the cell is entirely inside the shape, and "any mark" is a superset of
 * the cells the closed shape meets. Placing a piece on cells no other piece touches therefore cannot overlap.
 *
 * BITSETS. A row is `W` 32-bit words, bit p of the row is cell p. `buildLevels` derives, for every power of two 2^j,
 * the row set "cells p .. p+2^j-1 are all free"; a run of L free cells is the AND of two overlapping level-j windows.
 * A piece is a list of row runs (dy, x0, x1); the anchors where it fits are the AND over its runs of shifted level
 * rows, so one query costs (rows × runs × W) word operations, not (positions × cells).
 */

/** Marks for `rasterize`. */
export const BOUNDARY = 1, CENTER = 2;
const EPS = 1e-9;

export type Pt2 = readonly [number, number];

/**
 * Rasterise rings given in cell units into a `w × h` mark buffer covering cells [x0, x0 + w) × [y0, y0 + h).
 * Boundary marks are a conservative super-cover; centre marks use the even-odd rule over all rings.
 */
export function rasterize(rings: readonly (readonly Pt2[])[], x0: number, y0: number, w: number, h: number): Uint8Array {
  const marks = new Uint8Array(w * h);
  const crossings: number[][] = Array.from({ length: h }, () => []);
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = ring[j][0], ay = ring[j][1], bx = ring[i][0], by = ring[i][1];
      const minY = Math.min(ay, by), maxY = Math.max(ay, by);
      const rowLo = Math.max(y0, Math.ceil(minY - EPS) - 1), rowHi = Math.min(y0 + h - 1, Math.floor(maxY + EPS));
      for (let row = rowLo; row <= rowHi; row++) {
        let xa = Math.min(ax, bx), xb = Math.max(ax, bx);
        if (ay !== by) {
          const ta = (row - ay) / (by - ay), tb = (row + 1 - ay) / (by - ay);
          const lo = Math.max(0, Math.min(ta, tb)), hi = Math.min(1, Math.max(ta, tb));
          if (lo > hi) continue;
          const p = ax + (bx - ax) * lo, q = ax + (bx - ax) * hi;
          xa = Math.min(p, q); xb = Math.max(p, q);
        }
        const colLo = Math.max(x0, Math.ceil(xa - EPS) - 1), colHi = Math.min(x0 + w - 1, Math.floor(xb + EPS));
        for (let col = colLo; col <= colHi; col++) marks[(row - y0) * w + (col - x0)] |= BOUNDARY;
      }
      // Even-odd crossings of the row-centre scan lines (half-open in y so a vertex is never counted twice).
      const cLo = Math.max(y0, Math.ceil(minY - 0.5)), cHi = Math.min(y0 + h - 1, Math.ceil(maxY - 0.5) - 1);
      if (ay !== by) for (let row = cLo; row <= cHi; row++) {
        const yc = row + 0.5;
        if ((ay <= yc) !== (by <= yc)) crossings[row - y0].push(ax + (yc - ay) * (bx - ax) / (by - ay));
      }
    }
  }
  for (let r = 0; r < h; r++) {
    const xs = crossings[r];
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(x0, Math.ceil(xs[k] - 0.5)), to = Math.min(x0 + w - 1, Math.ceil(xs[k + 1] - 0.5) - 1);
      for (let c = from; c <= to; c++) marks[r * w + (c - x0)] |= CENTER;
    }
  }
  return marks;
}

/** Row runs (dy, x0, x1) of every touched cell of a mark buffer, in cell offsets from the buffer's own origin (x0, y0). */
export function touchedRuns(marks: Uint8Array, x0: number, y0: number, w: number, h: number): Int32Array {
  const out: number[] = [];
  for (let r = 0; r < h; r++) {
    let start = -1;
    for (let c = 0; c <= w; c++) {
      const on = c < w && marks[r * w + c] !== 0;
      if (on && start < 0) start = c;
      else if (!on && start >= 0) { out.push(y0 + r, x0 + start, x0 + c - 1); start = -1; }
    }
  }
  return Int32Array.from(out);
}

/** A grid of `gw × gh` cells stored as `gh` rows of `W` words. */
export class BitGrid {
  readonly W: number;
  readonly rows: Uint32Array;
  constructor(readonly gw: number, readonly gh: number) {
    this.W = Math.ceil(gw / 32);
    this.rows = new Uint32Array(this.W * gh);
  }
  set(x: number, y: number): void { this.rows[y * this.W + (x >> 5)] |= 1 << (x & 31); }
  clear(x: number, y: number): void { this.rows[y * this.W + (x >> 5)] &= ~(1 << (x & 31)); }
  get(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.gw && y < this.gh && (this.rows[y * this.W + (x >> 5)] >>> (x & 31) & 1) === 1; }
}

/** Word `w` of `row` shifted so that result bit p is source bit p + shift (any integer shift; missing words are zero). */
function shifted(rows: Uint32Array, base: number, W: number, w: number, shift: number): number {
  const q = Math.floor(shift / 32), r = shift - q * 32;
  const i = w + q;
  const lo = i >= 0 && i < W ? rows[base + i] : 0;
  if (r === 0) return lo;
  const hi = i + 1 >= 0 && i + 1 < W ? rows[base + i + 1] : 0;
  return ((lo >>> r) | (hi << (32 - r))) >>> 0;
}

/** levels[j] row bit p is set iff cells p .. p + 2^j - 1 are all set in the grid. */
export function buildLevels(grid: BitGrid): Uint32Array[] {
  const { W, gh, gw } = grid, levels: Uint32Array[] = [grid.rows];
  for (let j = 1; (1 << j) <= gw; j++) {
    const prev = levels[j - 1], next = new Uint32Array(W * gh), half = 1 << (j - 1);
    for (let y = 0; y < gh; y++) for (let w = 0; w < W; w++) next[y * W + w] = (prev[y * W + w] & shifted(prev, y * W, W, w, half)) >>> 0;
    levels.push(next);
  }
  return levels;
}

/** Work counter shared by a search. */
export interface Steps { used: number; readonly limit: number; readonly explain: () => string }
function spend(steps: Steps, n: number): void {
  steps.used += n;
  if (steps.used > steps.limit) throw new Error(steps.explain());
}

/**
 * Anchors (x, y) at which every run (dy, x0, x1) lies in free cells: bit x of row y of `out`. Anchor rows outside
 * [lo, hi] and anchors with a run outside the grid are zero. One unit of work per (row, run) actually combined.
 */
export function feasibleAnchors(levels: readonly Uint32Array[], grid: BitGrid, runs: Int32Array, out: Uint32Array, rowMin: number, rowMax: number, steps: Steps): void {
  const { W, gh } = grid;
  out.fill(0);
  let dyMin = Infinity, dyMax = -Infinity;
  for (let k = 0; k < runs.length; k += 3) { dyMin = Math.min(dyMin, runs[k]); dyMax = Math.max(dyMax, runs[k]); }
  const acc = new Uint32Array(W);
  const yFrom = Math.max(rowMin - dyMin, -dyMin, 0), yTo = Math.min(rowMax - dyMax, gh - 1 - dyMax);
  for (let y = yFrom; y <= yTo; y++) {
    acc.fill(0xffffffff);
    let live = true, combined = 0;
    for (let k = 0; k < runs.length && live; k += 3) {
      const dy = runs[k], x0 = runs[k + 1], length = runs[k + 2] - x0 + 1;
      const level = 31 - Math.clz32(length), rows = levels[level], base = (y + dy) * W, second = x0 + length - (1 << level);
      let any = 0;
      for (let w = 0; w < W; w++) {
        let v = acc[w] & shifted(rows, base, W, w, x0);
        if (second !== x0) v &= shifted(rows, base, W, w, second);
        acc[w] = v >>> 0; any |= v;
      }
      combined++;
      live = any !== 0;
    }
    spend(steps, combined);
    if (live) out.set(acc, y * W);
  }
}

/** The anchors of `feasible` that have an infeasible 4-neighbour (the raster no-fit boundary), into `out`. */
export function noFitBoundary(feasible: Uint32Array, grid: BitGrid, out: Uint32Array): void {
  const { W, gh } = grid;
  for (let y = 0; y < gh; y++) {
    for (let w = 0; w < W; w++) {
      const here = feasible[y * W + w];
      if (here === 0) { out[y * W + w] = 0; continue; }
      const left = ((here << 1) | (w > 0 ? feasible[y * W + w - 1] >>> 31 : 0)) >>> 0;
      const right = ((here >>> 1) | (w + 1 < W ? feasible[y * W + w + 1] << 31 : 0)) >>> 0;
      const up = y > 0 ? feasible[(y - 1) * W + w] : 0, down = y + 1 < gh ? feasible[(y + 1) * W + w] : 0;
      // A bit survives when its left/right/up/down neighbours are ALL feasible: it is interior; boundary = here & ~interior.
      out[y * W + w] = (here & ~(left & right & up & down)) >>> 0;
    }
  }
}

/**
 * Chamfer (3, 4) distance, in cells, from every cell to the nearest cell whose bit is NOT set in `free`
 * (cells outside the grid count as not free through the border row). A heuristic field for ordering, never a decision.
 */
export function distanceToBlocked(free: BitGrid): Float64Array {
  const { gw, gh } = free, d = new Float64Array(gw * gh), BIG = 1e9;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) d[y * gw + x] = free.get(x, y) ? BIG : 0;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    let v = d[y * gw + x];
    if (x > 0) v = Math.min(v, d[y * gw + x - 1] + 3);
    if (y > 0) {
      v = Math.min(v, d[(y - 1) * gw + x] + 3);
      if (x > 0) v = Math.min(v, d[(y - 1) * gw + x - 1] + 4);
      if (x + 1 < gw) v = Math.min(v, d[(y - 1) * gw + x + 1] + 4);
    }
    d[y * gw + x] = v;
  }
  for (let y = gh - 1; y >= 0; y--) for (let x = gw - 1; x >= 0; x--) {
    let v = d[y * gw + x];
    if (x + 1 < gw) v = Math.min(v, d[y * gw + x + 1] + 3);
    if (y + 1 < gh) {
      v = Math.min(v, d[(y + 1) * gw + x] + 3);
      if (x + 1 < gw) v = Math.min(v, d[(y + 1) * gw + x + 1] + 4);
      if (x > 0) v = Math.min(v, d[(y + 1) * gw + x - 1] + 4);
    }
    d[y * gw + x] = v;
  }
  for (let i = 0; i < d.length; i++) d[i] = Math.min(d[i], BIG) / 3;
  return d;
}
