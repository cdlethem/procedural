import type { Point } from "./types.js";

/**
 * Stitch geometry that has no opinion about regions: cutting a polyline into stitches and routing runs into threads.
 *
 * A STITCH is one straight thread between two needle penetrations; a polyline of penetration points is a thread. Every function
 * here returns penetration points whose consecutive distances are at most the stated bound `limit` (checked by the tests to
 * 1e-9), never longer, and keeps the polyline's own endpoints exactly.
 *
 * - `runningStitches(points, limit, phase)`: penetrations at arc length `phase * limit + k * limit` along the polyline (`phase`
 *   in [0, 1); 0 puts the first cut one full stitch in). The first and last stitches are the remainders (at most `limit`).
 *   Chords of a curved polyline are shorter than the arc, so the bound also holds there.
 * - `spanStitches(points, limit)`: `ceil(length / limit)` EQUAL stitches (one stitch when the polyline is short enough): the
 *   satin rule, where a row is a single stitch across the shape unless that would exceed the bound.
 * - `boundStitches(points, limit)`: every original vertex stays a penetration; each longer segment is divided equally. Used for
 *   outlines and travel, where corners must be penetrations and the thread must stay on the boundary.
 * - `routeRuns(runs, start, options)`: greedy nearest-endpoint routing. From `start` it repeatedly takes the unused run with an
 *   endpoint nearest the current end (ties: lower run index, then the run's first endpoint), entering at that endpoint. A run
 *   joins the current thread only when `join(end, entry)` allows it; otherwise the thread ends (a trim: no stitch is made across
 *   the gap) and a new thread starts. Adjacent parallel rows therefore alternate direction (the boustrophedon) with no rule
 *   about direction at all. Each thread records where each run begins (`rowStarts`, as stitch indices) and the ordinal of its
 *   first run in the whole route (`firstRow`).
 */
export type Pt = Point;

const dist = (a: Pt, b: Pt): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

export function polylineLength(points: readonly Pt[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

/** Points at ascending arc lengths `positions` (each within [0, length]) along a polyline. */
export function samplePolyline(points: readonly Pt[], positions: readonly number[]): Pt[] {
  const out: Pt[] = [];
  let segment = 0, start = 0, length = points.length > 1 ? dist(points[0], points[1]) : 0;
  for (const position of positions) {
    while (segment < points.length - 2 && position > start + length) { start += length; segment++; length = dist(points[segment], points[segment + 1]); }
    const a = points[segment], b = points[Math.min(segment + 1, points.length - 1)];
    const t = length > 0 ? Math.min(1, Math.max(0, (position - start) / length)) : 0;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

function checkLimit(limit: number): void {
  if (!(typeof limit === "number" && Number.isFinite(limit) && limit > 0)) throw new Error("Stitch length must be a positive finite number");
}

export function runningStitches(points: readonly Pt[], limit: number, phase: number): Pt[] {
  checkLimit(limit);
  if (!(phase >= 0 && phase < 1)) throw new Error("Stitch phase must be in [0, 1)");
  const total = polylineLength(points);
  const first = points[0], last = points[points.length - 1];
  if (!(total > 0)) return [first, last];
  const positions: number[] = [];
  for (let s = phase * limit || limit; s < total - 1e-12; s += limit) positions.push(s);
  return [first, ...samplePolyline(points, positions), last];
}

export function spanStitches(points: readonly Pt[], limit: number): Pt[] {
  checkLimit(limit);
  const total = polylineLength(points);
  const first = points[0], last = points[points.length - 1];
  const parts = Math.max(1, Math.ceil(total / limit - 1e-12));
  if (parts === 1) return [first, last];
  const positions: number[] = [];
  for (let k = 1; k < parts; k++) positions.push((total * k) / parts);
  return [first, ...samplePolyline(points, positions), last];
}

/** Stitches shorter than this (canvas units) are rounding of computed crossings, not stitches: their far end is dropped. */
export const MIN_STITCH = 1e-9;

/** The points with consecutive duplicates (within `MIN_STITCH`) removed: a polyline that touches a boundary can repeat the touching vertex. */
export function distinctPoints(points: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) if (out.length === 0 || dist(out[out.length - 1], p) >= MIN_STITCH) out.push(p);
  return out;
}

export function boundStitches(points: readonly Pt[], limit: number): Pt[] {
  checkLimit(limit);
  const out: Pt[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = out[out.length - 1], b = points[i], d = dist(a, b);
    if (d < MIN_STITCH) continue;
    const parts = Math.max(1, Math.ceil(d / limit - 1e-12));
    for (let k = 1; k < parts; k++) out.push([a[0] + ((b[0] - a[0]) * k) / parts, a[1] + ((b[1] - a[1]) * k) / parts]);
    out.push(b);
  }
  return out;
}

export interface Run { readonly points: readonly Pt[] }
export interface Chain {
  readonly points: Pt[];
  /** Stitch index of the first stitch of each run in this thread (a joining stitch belongs to the run before it). */
  readonly rowStarts: number[];
  /** Ordinal, in the whole route, of this thread's first run. */
  readonly firstRow: number;
}
export interface RouteOptions {
  /** May the next run's entry point continue the current thread from its end? `null`: never (every run is its own thread). */
  readonly join: ((end: Pt, entry: Pt) => boolean) | null;
  /** Grid cell for the endpoint index, canvas units (a few row spacings). */
  readonly cell: number;
  readonly cancelled?: () => boolean;
}

const MAX_RING = 48;
const LINEAR_BELOW = 24;

/** Greedy nearest-endpoint routing of runs into threads; see the module header. */
export function routeRuns(runs: readonly Run[], start: Pt, options: RouteOptions): Chain[] {
  const n = runs.length;
  if (n === 0) return [];
  const cell = Math.max(options.cell, 1e-6);
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const run of runs) for (const p of [run.points[0], run.points[run.points.length - 1]]) {
    left = Math.min(left, p[0]); right = Math.max(right, p[0]); top = Math.min(top, p[1]); bottom = Math.max(bottom, p[1]);
  }
  const nx = Math.floor((right - left) / cell) + 1, ny = Math.floor((bottom - top) / cell) + 1;
  const cellX = (x: number): number => Math.min(nx - 1, Math.max(0, Math.floor((x - left) / cell)));
  const cellY = (y: number): number => Math.min(ny - 1, Math.max(0, Math.floor((y - top) / cell)));
  const buckets = new Map<number, number[]>();
  const endpoint = (id: number): Pt => { const pts = runs[id >> 1].points; return (id & 1) === 0 ? pts[0] : pts[pts.length - 1]; };
  for (let id = 0; id < 2 * n; id++) {
    const p = endpoint(id), key = cellY(p[1]) * nx + cellX(p[0]);
    const list = buckets.get(key);
    if (list) list.push(id); else buckets.set(key, [id]);
  }
  const used = new Uint8Array(n);
  const alive: number[] = Array.from({ length: n }, (_, i) => i);
  const slot = new Int32Array(n).map((_, i) => i);
  let remaining = n;
  const retire = (run: number): void => {
    used[run] = 1; remaining--;
    const at = slot[run], last = alive[remaining];
    alive[at] = last; slot[last] = at;
  };
  const better = (d: number, id: number, bestD: number, bestId: number): boolean => d < bestD || (d === bestD && (id >> 1 < bestId >> 1 || (id >> 1 === bestId >> 1 && id < bestId)));
  const nearestLinear = (x: number, y: number): number => {
    let best = -1, bestD = Infinity;
    for (let k = 0; k < remaining; k++) for (const id of [2 * alive[k], 2 * alive[k] + 1]) {
      const p = endpoint(id), d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
      if (best < 0 || better(d, id, bestD, best)) { best = id; bestD = d; }
    }
    return best;
  };
  const nearest = (x: number, y: number): number => {
    if (remaining <= LINEAR_BELOW) return nearestLinear(x, y);
    const cx = cellX(x), cy = cellY(y);
    let best = -1, bestD = Infinity;
    const scan = (i: number, j: number): void => {
      const key = j * nx + i, list = buckets.get(key);
      if (!list) return;
      for (let k = list.length - 1; k >= 0; k--) {
        const id = list[k];
        if (used[id >> 1]) { list[k] = list[list.length - 1]; list.pop(); continue; }
        const p = endpoint(id), d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
        if (best < 0 || better(d, id, bestD, best)) { best = id; bestD = d; }
      }
      if (list.length === 0) buckets.delete(key);
    };
    for (let r = 0; r <= MAX_RING; r++) {
      if (best >= 0 && r > 1 && bestD <= ((r - 1) * cell) ** 2) break;
      if (r === 0) scan(cx, cy);
      else {
        for (let i = cx - r; i <= cx + r; i++) { if (i < 0 || i >= nx) continue; if (cy - r >= 0) scan(i, cy - r); if (cy + r < ny) scan(i, cy + r); }
        for (let j = cy - r + 1; j <= cy + r - 1; j++) { if (j < 0 || j >= ny) continue; if (cx - r >= 0) scan(cx - r, j); if (cx + r < nx) scan(cx + r, j); }
      }
    }
    return best >= 0 && bestD <= (MAX_RING * cell) ** 2 ? best : nearestLinear(x, y);
  };
  const chains: Chain[] = [];
  let current: Chain | null = null, end: Pt = start, ordinal = 0;
  while (remaining > 0) {
    if ((ordinal & 255) === 0 && options.cancelled?.()) throw new Error("Composition cancelled");
    const id = nearest(end[0], end[1]), run = id >> 1;
    retire(run);
    const forward = runs[run].points, points = (id & 1) === 0 ? forward : [...forward].reverse();
    if (current && options.join && options.join(end, points[0])) {
      current.rowStarts.push(current.points.length);
      for (const p of points) current.points.push(p);
    } else {
      current = { points: [...points], rowStarts: [0], firstRow: ordinal };
      chains.push(current);
    }
    end = current.points[current.points.length - 1];
    ordinal++;
  }
  return chains;
}
