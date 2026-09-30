import type { Point } from "./types.js";

/**
 * Exact-predicate planar arrangement kernel behind `domains.ts`. Internal: nothing here is exported
 * from the package index; the documented contract is `docs/composition-domains.md`.
 *
 * NUMERIC POLICY. Input coordinates are binary64 values and are never perturbed. Every orientation
 * question ("is c left of a→b?") is decided exactly: a floating-point filter, then an
 * error-free-transformation check, then BigInt arithmetic on the exact dyadic values. There is no
 * epsilon anywhere in a topological decision. The only rounding is the position of a *computed*
 * vertex (a proper crossing of two segments), which is rounded to the nearest binary64 point
 * inside both segments' bounding boxes. Because that moves the vertex off the exact line by at
 * most a few ulps, the arrangement is then re-examined with the exact predicates, and any crossing
 * or vertex-on-edge contact the rounding created is split again, until the rounded segment set is
 * exactly planar (`MAX_PASSES`; failing to converge throws instead of returning a bad result).
 */
export type Pt = Point;
export type PlanarErrorCode = "INVALID_INPUT" | "SELF_INTERSECTION" | "INVALID_REGION" | "WORK_LIMIT" | "NOT_CONVERGED" | "CANCELLED";

export class PlanarError extends Error {
  readonly code: PlanarErrorCode;
  constructor(code: PlanarErrorCode, message: string) {
    super(message);
    this.name = "PlanarError";
    this.code = code;
  }
}

/** Largest coordinate magnitude admitted. Products of two coordinates stay far from overflow. */
export const MAX_COORDINATE = 1e100;
/** Nonzero coordinates below this magnitude are rejected: their products could underflow, breaking exactness. */
export const MIN_COORDINATE = 1e-100;
export const MAX_PASSES = 32;

// ---------------------------------------------------------------------------------------------
// Exact orientation
// ---------------------------------------------------------------------------------------------
const SPLITTER = 134217729;
function productError(a: number, b: number, p: number): number {
  let c = SPLITTER * a;
  const ahi = c - (c - a), alo = a - ahi;
  c = SPLITTER * b;
  const bhi = c - (c - b), blo = b - bhi;
  return alo * blo - (((p - ahi * bhi) - alo * bhi) - ahi * blo);
}
function sumError(a: number, b: number, s: number): number {
  const bv = s - a;
  return (a - (s - bv)) + (b - bv);
}
const f64 = new Float64Array(1), u64 = new BigUint64Array(f64.buffer);
function decompose(x: number): [bigint, number] {
  if (x === 0) return [0n, 0];
  f64[0] = x;
  const bits = u64[0], exponent = Number((bits >> 52n) & 0x7ffn);
  let mantissa = bits & 0xfffffffffffffn, power: number;
  if (exponent === 0) power = -1074; else { mantissa |= 1n << 52n; power = exponent - 1075; }
  return [bits >> 63n ? -mantissa : mantissa, power];
}
function orientBig(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const parts = [ax, ay, bx, by, cx, cy].map(decompose);
  let low = Infinity;
  for (const [m, e] of parts) if (m !== 0n && e < low) low = e;
  const [a, b, c, d, e, f] = parts.map(([m, p]) => m === 0n ? 0n : m << BigInt(p - low));
  const det = (a - e) * (d - f) - (b - f) * (c - e);
  return det > 0n ? 1 : det < 0n ? -1 : 0;
}
function orientExact(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const acx = ax - cx, bcx = bx - cx, acy = ay - cy, bcy = by - cy;
  if (sumError(ax, -cx, acx) === 0 && sumError(bx, -cx, bcx) === 0 && sumError(ay, -cy, acy) === 0 && sumError(by, -cy, bcy) === 0) {
    const l = acx * bcy, r = acy * bcx;
    if (productError(acx, bcy, l) === 0 && productError(acy, bcx, r) === 0) {
      const d = l - r;
      if (sumError(l, -r, d) === 0) return d;
    }
  }
  return orientBig(ax, ay, bx, by, cx, cy);
}
const ORIENT_BOUND = 3.3306690738754716e-16;
/** Exact sign of the orientation determinant: positive when c is left of the directed line a→b (counter-clockwise). */
export function orient(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const l = (ax - cx) * (by - cy), r = (ay - cy) * (bx - cx), det = l - r;
  let sum: number;
  if (l > 0) { if (r <= 0) return det; sum = l + r; }
  else if (l < 0) { if (r >= 0) return det; sum = -l - r; }
  else return det;
  const bound = ORIENT_BOUND * sum;
  if (det >= bound || -det >= bound) return det;
  return orientExact(ax, ay, bx, by, cx, cy);
}

// ---------------------------------------------------------------------------------------------
// Input hygiene
// ---------------------------------------------------------------------------------------------
export function checkCoordinate(label: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new PlanarError("INVALID_INPUT", `${label} must be a finite number`);
  const magnitude = Math.abs(value);
  if (magnitude > MAX_COORDINATE || (magnitude !== 0 && magnitude < MIN_COORDINATE))
    throw new PlanarError("INVALID_INPUT", `${label} has magnitude ${magnitude}; coordinates must be 0 or within [${MIN_COORDINATE}, ${MAX_COORDINATE}] in magnitude`);
  return value === 0 ? 0 : value; // normalises -0
}

/** Work counter shared by one operation. Every counted unit is one exact segment/segment or segment/edge test. */
export interface Work {
  count: number;
  readonly limit: number;
  readonly label: string;
  readonly cancel?: () => void;
}
export function makeWork(label: string, limit: number, cancel?: () => void): Work {
  return cancel ? { count: 0, limit, label, cancel } : { count: 0, limit, label };
}
export function charge(work: Work, units: number): void {
  work.count += units;
  if (work.count > work.limit)
    throw new PlanarError("WORK_LIMIT", `${work.label} needs more than ${work.limit} elementary geometric tests; simplify the input or raise options.maxWork`);
}

// ---------------------------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------------------------
/**
 * A segment stored low→high in lexicographic (x, then y) order. `net[s]` is, for source `s`, the
 * number of input edges directed high→low minus those directed low→high. That is the amount the
 * winding number of source `s` rises when an upward ray starts below the segment instead of above
 * it: a counter-clockwise ring has +1 on its upper (right-to-left) edges. See `windings`.
 */
export interface Seg {
  ax: number; ay: number; bx: number; by: number;
  miny: number; maxy: number;
  net: number[];
}
export const lexLess = (ax: number, ay: number, bx: number, by: number): boolean => ax < bx || (ax === bx && ay < by);
function seg(ax: number, ay: number, bx: number, by: number, net: number[]): Seg {
  return { ax, ay, bx, by, miny: ay < by ? ay : by, maxy: ay < by ? by : ay, net };
}
/** Add one directed input edge to `out` (lex-normalising it); zero-length edges are skipped. */
export function pushEdge(out: Seg[], sources: number, source: number, px: number, py: number, qx: number, qy: number): void {
  if (px === qx && py === qy) return;
  const net = new Array<number>(sources).fill(0);
  if (lexLess(px, py, qx, qy)) { net[source] = -1; out.push(seg(px, py, qx, qy, net)); }
  else { net[source] = 1; out.push(seg(qx, qy, px, py, net)); }
}
const compareSegs = (a: Seg, b: Seg): number => a.ax - b.ax || a.ay - b.ay || a.bx - b.bx || a.by - b.by;

/** Sort, merge coincident segments (summing nets) and drop segments whose every net is zero. */
export function mergeSegs(segs: Seg[]): Seg[] {
  segs.sort(compareSegs);
  const out: Seg[] = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (last && last.ax === s.ax && last.ay === s.ay && last.bx === s.bx && last.by === s.by) {
      for (let k = 0; k < s.net.length; k++) last.net[k] += s.net[k];
    } else out.push(s);
  }
  return out.filter((s) => s.net.some((n) => n !== 0));
}

const strictlyBetween = (px: number, py: number, ax: number, ay: number, bx: number, by: number): boolean =>
  lexLess(ax, ay, px, py) && lexLess(px, py, bx, by);

function crossPoint(s: Seg, t: Seg): Pt {
  const dx1 = s.bx - s.ax, dy1 = s.by - s.ay, dx2 = t.bx - t.ax, dy2 = t.by - t.ay;
  const den = dx1 * dy2 - dy1 * dx2;
  let u = ((t.ax - s.ax) * dy2 - (t.ay - s.ay) * dx2) / den;
  if (!(u >= 0)) u = 0; else if (u > 1) u = 1;
  let x = s.ax + u * dx1, y = s.ay + u * dy1;
  const lox = Math.max(s.ax, t.ax), hix = Math.min(s.bx, t.bx);
  const loy = Math.max(s.miny, t.miny), hiy = Math.min(s.maxy, t.maxy);
  if (x < lox) x = lox; else if (x > hix) x = hix;
  if (y < loy) y = loy; else if (y > hiy) y = hiy;
  return [x === 0 ? 0 : x, y === 0 ? 0 : y];
}

type Adder = (index: number, x: number, y: number, computed?: boolean) => void;
/** Exact contact test of two lex-normalised segments; reports the points at which each must be split. */
function contact(i: number, s: Seg, j: number, t: Seg, add: Adder): void {
  const o1 = orient(s.ax, s.ay, s.bx, s.by, t.ax, t.ay), o2 = orient(s.ax, s.ay, s.bx, s.by, t.bx, t.by);
  if ((o1 > 0 && o2 > 0) || (o1 < 0 && o2 < 0)) return;
  const o3 = orient(t.ax, t.ay, t.bx, t.by, s.ax, s.ay), o4 = orient(t.ax, t.ay, t.bx, t.by, s.bx, s.by);
  if ((o3 > 0 && o4 > 0) || (o3 < 0 && o4 < 0)) return;
  if (o1 === 0 && o2 === 0) {
    if (strictlyBetween(t.ax, t.ay, s.ax, s.ay, s.bx, s.by)) add(i, t.ax, t.ay);
    if (strictlyBetween(t.bx, t.by, s.ax, s.ay, s.bx, s.by)) add(i, t.bx, t.by);
    if (strictlyBetween(s.ax, s.ay, t.ax, t.ay, t.bx, t.by)) add(j, s.ax, s.ay);
    if (strictlyBetween(s.bx, s.by, t.ax, t.ay, t.bx, t.by)) add(j, s.bx, s.by);
    return;
  }
  if (o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) {
    const p = crossPoint(s, t);
    add(i, p[0], p[1], true); add(j, p[0], p[1], true);
    return;
  }
  if (o1 === 0 && strictlyBetween(t.ax, t.ay, s.ax, s.ay, s.bx, s.by)) add(i, t.ax, t.ay);
  if (o2 === 0 && strictlyBetween(t.bx, t.by, s.ax, s.ay, s.bx, s.by)) add(i, t.bx, t.by);
  if (o3 === 0 && strictlyBetween(s.ax, s.ay, t.ax, t.ay, t.bx, t.by)) add(j, s.ax, s.ay);
  if (o4 === 0 && strictlyBetween(s.bx, s.by, t.ax, t.ay, t.bx, t.by)) add(j, s.bx, s.by);
}

/** How two lex-normalised segments meet: 0 not at all, 1 at a single point, 2 by a proper crossing, 3 along a collinear stretch of positive length. */
export function classify(s: Seg, t: Seg): 0 | 1 | 2 | 3 {
  const o1 = orient(s.ax, s.ay, s.bx, s.by, t.ax, t.ay), o2 = orient(s.ax, s.ay, s.bx, s.by, t.bx, t.by);
  if ((o1 > 0 && o2 > 0) || (o1 < 0 && o2 < 0)) return 0;
  const o3 = orient(t.ax, t.ay, t.bx, t.by, s.ax, s.ay), o4 = orient(t.ax, t.ay, t.bx, t.by, s.bx, s.by);
  if ((o3 > 0 && o4 > 0) || (o3 < 0 && o4 < 0)) return 0;
  if (o1 === 0 && o2 === 0) {
    const lowX = lexLess(s.ax, s.ay, t.ax, t.ay) ? t.ax : s.ax, lowY = lexLess(s.ax, s.ay, t.ax, t.ay) ? t.ay : s.ay;
    const highX = lexLess(s.bx, s.by, t.bx, t.by) ? s.bx : t.bx, highY = lexLess(s.bx, s.by, t.bx, t.by) ? s.by : t.by;
    if (lexLess(highX, highY, lowX, lowY)) return 0;
    return lowX === highX && lowY === highY ? 1 : 3;
  }
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 ? 2 : 1;
}

/**
 * Visit every pair `(i, j)`, `i < j`, of segments whose bounding boxes overlap (segments sorted by
 * `compareSegs`). The sweep runs along the axis on which the segments extend less in total, so a
 * comb of long parallel bars is not quadratic. Cheap box rejections cost 1/8 of an exact test.
 */
export function forEachCandidate(segs: readonly Seg[], work: Work, visit: (i: number, j: number) => void): void {
  const n = segs.length;
  let spanX = 0, spanY = 0;
  for (const s of segs) { spanX += s.bx - s.ax; spanY += s.maxy - s.miny; }
  const alongY = spanY < spanX;
  let order: number[] | null = null;
  if (alongY) order = segs.map((_, k) => k).sort((a, b) => segs[a].miny - segs[b].miny || a - b);
  let tick = 0;
  for (let p = 0; p < n; p++) {
    const i = order ? order[p] : p, s = segs[i];
    let rejected = 0, tested = 0;
    for (let q = p + 1; q < n; q++) {
      const j = order ? order[q] : q, t = segs[j];
      if (alongY) {
        if (t.miny > s.maxy) break;
        if (t.bx < s.ax || t.ax > s.bx) { rejected++; continue; }
      } else {
        if (t.ax > s.bx) break;
        if (t.maxy < s.miny || t.miny > s.maxy) { rejected++; continue; }
      }
      tested++;
      if (i < j) visit(i, j); else visit(j, i);
    }
    charge(work, rejected / 8 + tested * 4 + 1);
    if (work.cancel && (++tick & 255) === 0) work.cancel();
  }
}

/**
 * VERTEX REUSE. A computed crossing is rounded to binary64, which puts it a few ulps off both
 * exact lines. Where three or more nearly concurrent segments meet (overlapped, rotated glyph
 * strokes produce them), the exact crossings of the re-split pieces keep landing a few ulps
 * beyond the previous round's vertex, so splitting creeps along a sliver forever. A computed
 * crossing that lies within `SNAP_ULPS` ulps of the largest input coordinate of an existing vertex
 * therefore reuses that vertex (the nearest, ties to the lexicographically smaller). Reuse only ever
 * chooses which binary64 point stands for a computed vertex: input vertices are never moved, no
 * topological decision involves a tolerance, and the exact re-check afterwards still decides
 * whether the rounded set is planar. Because a reused vertex creates no new vertex, computed
 * vertices are at least that far from every other vertex, which bounds the number of rounds.
 */
export const SNAP_ULPS = 16;

class VertexIndex {
  private readonly cells = new Map<string, Pt[]>();
  constructor(segs: readonly Seg[], readonly radius: number) {
    for (const s of segs) { this.add(s.ax, s.ay); this.add(s.bx, s.by); }
  }
  private key(cx: number, cy: number): string { return `${cx},${cy}`; }
  private add(x: number, y: number): void {
    const key = this.key(Math.floor(x / this.radius), Math.floor(y / this.radius));
    const list = this.cells.get(key);
    if (list) list.push([x, y]); else this.cells.set(key, [[x, y]]);
  }
  /** The nearest vertex within `radius` of (x, y), or the point itself. */
  snap(x: number, y: number): Pt {
    const cx = Math.floor(x / this.radius), cy = Math.floor(y / this.radius);
    let best: Pt | null = null, bestD = this.radius * this.radius;
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) {
      const list = this.cells.get(this.key(i, j));
      if (!list) continue;
      for (const v of list) {
        const d = (v[0] - x) ** 2 + (v[1] - y) ** 2;
        if (d < bestD || (d === bestD && best && lexLess(v[0], v[1], best[0], best[1]))) { best = v; bestD = d; }
      }
    }
    return best ?? [x, y];
  }
}

/**
 * Split segments at every contact until the rounded set is exactly planar: no two segments cross
 * and no endpoint lies in another segment's interior. Coincident pieces are merged (nets summed).
 * Computed crossings reuse nearby existing vertices (see `SNAP_ULPS`).
 */
export function planarize(input: Seg[], work: Work): Seg[] {
  let segs = mergeSegs(input);
  let scale = 0;
  for (const s of segs) scale = Math.max(scale, Math.abs(s.ax), Math.abs(s.ay), Math.abs(s.bx), Math.abs(s.by));
  const radius = Math.max(scale, MIN_COORDINATE) * SNAP_ULPS * Number.EPSILON;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    work.cancel?.();
    const splits: (Pt[] | undefined)[] = new Array(segs.length);
    let found = false, effective = false, vertices: VertexIndex | null = null;
    forEachCandidate(segs, work, (i, j) => contact(i, segs[i], j, segs[j], (index, x, y, computed) => {
      found = true;
      if (computed) { vertices ??= new VertexIndex(segs, radius); [x, y] = vertices.snap(x, y); }
      const s = segs[index];
      if ((x === s.ax && y === s.ay) || (x === s.bx && y === s.by)) return;
      (splits[index] ??= []).push([x, y]);
      effective = true;
    }));
    if (!found) return segs;
    if (!effective) throw new PlanarError("NOT_CONVERGED", "Internal error: a contact could not be resolved by splitting");
    const next: Seg[] = [];
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i], cut = splits[i];
      if (!cut) { next.push(s); continue; }
      const dx = s.bx - s.ax, dy = s.by - s.ay;
      const key = (p: Pt): number => (p[0] - s.ax) * dx + (p[1] - s.ay) * dy;
      const points: Pt[] = [[s.ax, s.ay], ...cut, [s.bx, s.by]];
      const keys = points.map(key);
      const order = points.map((_, k) => k).sort((a, b) => keys[a] - keys[b] || a - b);
      let previous = points[order[0]];
      for (let k = 1; k < order.length; k++) {
        const p = points[order[k]];
        if (p[0] === previous[0] && p[1] === previous[1]) continue;
        if (lexLess(previous[0], previous[1], p[0], p[1])) next.push(seg(previous[0], previous[1], p[0], p[1], s.net.slice()));
        else next.push(seg(p[0], p[1], previous[0], previous[1], s.net.map((v) => -v)));
        previous = p;
      }
    }
    segs = mergeSegs(next);
  }
  throw new PlanarError("NOT_CONVERGED", `The arrangement did not become planar after ${MAX_PASSES} rounds of exact splitting; the input is too nearly degenerate. Snap the coordinates to a coarser grid.`);
}

// ---------------------------------------------------------------------------------------------
// Winding of each side of every segment
// ---------------------------------------------------------------------------------------------
/**
 * For each segment of a planar, merged, lex-sorted set: per-source winding numbers of the region
 * just above it (`above`) and just below it (`below`). "Above" is in the frame sheared by an
 * infinitesimal amount so that a vertical segment's above side is its −x side (the left of its
 * upward direction); winding numbers are counted with an upward ray, so a counter-clockwise
 * ring gives +1 inside.
 *
 * A left-to-right sweep keeps the segments that span the sweep position ordered bottom to top
 * (exact orientation tests decide every comparison; the set is planar, so the order is total).
 * A new segment's region below is the region above its lower neighbour (0 below everything: the
 * unbounded face has winding zero), and `above = below − net`. Cost is O(E log A) comparisons plus
 * O(E·A) array moves for A simultaneously spanning segments.
 */
export function windings(segs: readonly Seg[], sources: number, work: Work): { above: Int32Array; below: Int32Array } {
  const n = segs.length;
  const above = new Int32Array(n * sources), below = new Int32Array(n * sources);
  const status: number[] = [];
  /** Negative when segment `a` lies below `b`; both must span a common sweep position. */
  const compare = (a: number, b: number): number => {
    if (a === b) return 0;
    const s = segs[a], t = segs[b];
    if (s.ax === t.ax && s.ay === t.ay) return orient(s.ax, s.ay, t.bx, t.by, s.bx, s.by) > 0 ? 1 : -1;
    if (lexLess(t.ax, t.ay, s.ax, s.ay)) {
      const o = orient(t.ax, t.ay, t.bx, t.by, s.ax, s.ay);
      if (o === 0) throw new PlanarError("NOT_CONVERGED", "Internal error: a vertex lies inside a segment of a planarised arrangement");
      return o > 0 ? 1 : -1;
    }
    const o = orient(s.ax, s.ay, s.bx, s.by, t.ax, t.ay);
    if (o === 0) throw new PlanarError("NOT_CONVERGED", "Internal error: a vertex lies inside a segment of a planarised arrangement");
    return o > 0 ? -1 : 1;
  };
  const byEnd = segs.map((_, k) => k).sort((a, b) => segs[a].bx - segs[b].bx || segs[a].by - segs[b].by || a - b);
  let retire = 0, i = 0;
  while (i < n) {
    const lx = segs[i].ax, ly = segs[i].ay;
    let end = i;
    while (end < n && segs[end].ax === lx && segs[end].ay === ly) end++;
    while (retire < n && !lexLess(lx, ly, segs[byEnd[retire]].bx, segs[byEnd[retire]].by)) {
      const k = byEnd[retire++];
      let low = 0, high = status.length;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (status[mid] === k) { low = mid; break; }
        if (compare(k, status[mid]) > 0) low = mid + 1; else high = mid;
      }
      if (status[low] !== k) throw new PlanarError("NOT_CONVERGED", "Internal error: sweep status lost a segment");
      status.splice(low, 1);
    }
    // Segments leaving the same point go in bottom to top, so each one's lower neighbour is already valued.
    const starting: number[] = [];
    for (let k = i; k < end; k++) starting.push(k);
    if (starting.length > 1) starting.sort(compare);
    for (const k of starting) {
      let low = 0, high = status.length;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (compare(k, status[mid]) > 0) low = mid + 1; else high = mid;
      }
      const lower = low > 0 ? status[low - 1] : -1;
      for (let q = 0; q < sources; q++) {
        const under = lower < 0 ? 0 : above[lower * sources + q];
        below[k * sources + q] = under;
        above[k * sources + q] = under - segs[k].net[q];
      }
      status.splice(low, 0, k);
      charge(work, 1 + Math.log2(status.length + 1) + status.length / 64);
    }
    work.cancel?.();
    i = end;
  }
  return { above, below };
}

export type Fill = "nonzero" | "evenodd" | "positive";
export const isInside = (winding: number, fill: Fill): boolean =>
  fill === "nonzero" ? winding !== 0 : fill === "positive" ? winding > 0 : (Math.abs(winding) & 1) === 1;

// ---------------------------------------------------------------------------------------------
// Boundary tracing
// ---------------------------------------------------------------------------------------------
export interface RawRegion { outer: Pt[]; holes: Pt[][] }

const cmpPoint = (a: Pt, b: Pt): number => a[0] - b[0] || a[1] - b[1];

/** Rotate a ring to start at its lexicographically smallest vertex. */
export function canonicalStart<T extends Pt>(ring: readonly T[]): T[] {
  let best = 0;
  for (let i = 1; i < ring.length; i++) if (cmpPoint(ring[i], ring[best]) < 0) best = i;
  return best === 0 ? ring.slice() : [...ring.slice(best), ...ring.slice(0, best)];
}

/** Exact orientation of a simple ring: +1 counter-clockwise (positive area), −1 clockwise, from its lex-min vertex. */
export function ringOrientation(ring: readonly Pt[]): number {
  const n = ring.length;
  let best = 0;
  for (let i = 1; i < n; i++) if (cmpPoint(ring[i], ring[best]) < 0) best = i;
  const p = ring[(best + n - 1) % n], v = ring[best], q = ring[(best + 1) % n];
  const o = orient(p[0], p[1], v[0], v[1], q[0], q[1]);
  return o > 0 ? 1 : o < 0 ? -1 : 0;
}

/** Location of a point against ONE closed ring by exact predicates: −1 outside, 0 on the boundary, +1 inside (nonzero winding). */
export function locateInRing(ring: readonly Pt[], x: number, y: number): number {
  let winding = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    const o = orient(a[0], a[1], b[0], b[1], x, y);
    if (o === 0 && x >= Math.min(a[0], b[0]) && x <= Math.max(a[0], b[0]) && y >= Math.min(a[1], b[1]) && y <= Math.max(a[1], b[1])) return 0;
    if (a[1] <= y) { if (b[1] > y && o > 0) winding++; }
    else if (b[1] <= y && o < 0) winding--;
  }
  return winding !== 0 ? 1 : -1;
}

interface Directed { from: number; to: number }
/**
 * Trace the directed boundary edges (interior on the left) into rings. At a vertex where several
 * boundary edges leave, the next edge is the first one clockwise from the reversed incoming edge,
 * which keeps each interior wedge together: two regions that touch at a point stay two rings and a
 * ring that would revisit a vertex is split there, so every returned ring is simple.
 */
export function traceRings(edges: readonly [Pt, Pt][], work: Work): Pt[][] {
  const ids = new Map<string, number>();
  const points: Pt[] = [];
  const idOf = (p: Pt): number => {
    const key = `${p[0]},${p[1]}`;
    let id = ids.get(key);
    if (id === undefined) { id = points.length; ids.set(key, id); points.push(p); }
    return id;
  };
  const directed: Directed[] = edges.map(([a, b]) => ({ from: idOf(a), to: idOf(b) }));
  const outgoing: number[][] = points.map(() => []);
  directed.forEach((e, index) => outgoing[e.from].push(index));
  charge(work, directed.length);

  const pick = (vertex: number, twin: number, candidates: readonly number[]): number => {
    if (candidates.length === 1) return candidates[0];
    const v = points[vertex], r = points[twin];
    const klass = (c: Pt): number => {
      const o = orient(v[0], v[1], r[0], r[1], c[0], c[1]);
      if (o > 0) return 0;
      if (o < 0) return 2;
      return (Math.sign(c[0] - v[0]) === Math.sign(r[0] - v[0]) && Math.sign(c[1] - v[1]) === Math.sign(r[1] - v[1])) ? 3 : 1;
    };
    let best = candidates[0], bestPoint = points[directed[best].to], bestClass = klass(bestPoint);
    for (let k = 1; k < candidates.length; k++) {
      const c = points[directed[candidates[k]].to], kc = klass(c);
      if (kc > bestClass || (kc === bestClass && orient(v[0], v[1], bestPoint[0], bestPoint[1], c[0], c[1]) > 0)) {
        best = candidates[k]; bestPoint = c; bestClass = kc;
      }
    }
    return best;
  };

  const used = new Uint8Array(directed.length);
  const rings: number[][] = [];
  for (let start = 0; start < directed.length; start++) {
    if (used[start]) continue;
    let path: number[] = [];
    const position = new Map<number, number>();
    let current = start;
    for (;;) {
      const edge = directed[current];
      const seen = position.get(edge.from);
      if (seen !== undefined) {
        const loop = path.splice(seen);
        for (const v of loop) position.delete(v);
        if (loop.length >= 3) rings.push(loop);
      }
      position.set(edge.from, path.length);
      path.push(edge.from);
      used[current] = 1;
      const next = pick(edge.to, edge.from, outgoing[edge.to]);
      if (next === start) break;
      if (used[next]) throw new PlanarError("NOT_CONVERGED", "Internal error: boundary tracing revisited an edge");
      current = next;
    }
    if (path.length >= 3) rings.push(path);
  }

  // Straight-through vertices that no other ring touches carry no information; remove them.
  const touches = new Uint8Array(points.length);
  for (const list of outgoing) if (list.length > 1) for (const e of list) touches[directed[e].from] = 1;
  const result: Pt[][] = [];
  for (const unrotated of rings) {
    // Start at the lexicographically smallest vertex, which can never be a straight-through vertex.
    let first = 0;
    for (let k = 1; k < unrotated.length; k++) if (cmpPoint(points[unrotated[k]], points[unrotated[first]]) < 0) first = k;
    const ring = first === 0 ? unrotated : [...unrotated.slice(first), ...unrotated.slice(0, first)];
    const out: number[] = [];
    const n = ring.length;
    for (let k = 0; k < n; k++) {
      const v = ring[k];
      if (out.length > 0 && !touches[v]) {
        const p = points[out[out.length - 1]], c = points[v], q = points[ring[(k + 1) % n]];
        if (orient(p[0], p[1], c[0], c[1], q[0], q[1]) === 0 && (c[0] - p[0]) * (q[0] - c[0]) + (c[1] - p[1]) * (q[1] - c[1]) > 0) continue;
      }
      out.push(v);
    }
    if (out.length >= 3) result.push(out.map((v) => points[v]));
  }
  return result;
}

/** Absolute value and sign-safe compensated area of a ring (shoelace about the first vertex). */
export function ringArea(ring: readonly Pt[]): number {
  const [ox, oy] = ring[0];
  let sum = 0, compensation = 0;
  for (let i = 1; i + 1 < ring.length; i++) {
    const term = (ring[i][0] - ox) * (ring[i + 1][1] - oy) - (ring[i + 1][0] - ox) * (ring[i][1] - oy);
    const t = sum + term;
    compensation += Math.abs(sum) >= Math.abs(term) ? (sum - t) + term : (term - t) + sum;
    sum = t;
  }
  return (sum + compensation) / 2;
}

/**
 * Group traced rings into regions: counter-clockwise rings are outer boundaries, clockwise rings
 * are holes and belong to the smallest outer ring that contains them. Output is canonical: rings
 * start at their lexicographically smallest vertex, holes and regions are ordered by that vertex.
 */
export function groupRings(rings: readonly Pt[][], work: Work): RawRegion[] {
  const outers: { ring: Pt[]; area: number; box: [number, number, number, number]; holes: Pt[][] }[] = [];
  const holes: { ring: Pt[]; box: [number, number, number, number] }[] = [];
  for (const raw of rings) {
    const ring = canonicalStart(raw);
    const orientation = ringOrientation(ring);
    if (orientation === 0) continue;
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const [x, y] of ring) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
    if (orientation > 0) outers.push({ ring, area: Math.abs(ringArea(ring)), box: [l, t, r, b], holes: [] });
    else holes.push({ ring, box: [l, t, r, b] });
  }
  outers.sort((a, b) => cmpPoint(a.ring[0], b.ring[0]) || cmpPoint(a.ring[1], b.ring[1]));
  // A hole lies inside its outer ring's box, so the outers registered in the cell holding the hole's
  // top-left corner are the only candidates. A uniform grid keeps this near-linear for many rings.
  let gl = Infinity, gt = Infinity, gr = -Infinity, gb = -Infinity;
  for (const o of outers) { if (o.box[0] < gl) gl = o.box[0]; if (o.box[1] < gt) gt = o.box[1]; if (o.box[2] > gr) gr = o.box[2]; if (o.box[3] > gb) gb = o.box[3]; }
  const side = Math.max(1, Math.min(512, Math.ceil(Math.sqrt(outers.length))));
  const cw = (gr - gl) / side || 1, ch = (gb - gt) / side || 1;
  const cellX = (x: number): number => Math.min(side - 1, Math.max(0, Math.floor((x - gl) / cw)));
  const cellY = (y: number): number => Math.min(side - 1, Math.max(0, Math.floor((y - gt) / ch)));
  const grid: number[][] = holes.length && outers.length ? Array.from({ length: side * side }, () => []) : [];
  if (grid.length) outers.forEach((o, index) => {
    for (let cy = cellY(o.box[1]); cy <= cellY(o.box[3]); cy++) for (let cx = cellX(o.box[0]); cx <= cellX(o.box[2]); cx++) grid[cy * side + cx].push(index);
  });
  for (const hole of holes) {
    let parent: (typeof outers)[number] | undefined;
    for (const index of grid.length ? grid[cellY(hole.box[1]) * side + cellX(hole.box[0])] : []) {
      const outer = outers[index];
      if (outer.box[0] > hole.box[0] || outer.box[2] < hole.box[2] || outer.box[1] > hole.box[1] || outer.box[3] < hole.box[3]) continue;
      if (parent && outer.area >= parent.area) continue;
      charge(work, outer.ring.length + 1);
      // A hole lies inside its outer ring; some hole vertex is off the outer boundary (rings share only vertices).
      let decided = 0;
      for (const [x, y] of hole.ring) {
        const at = locateInRing(outer.ring, x, y);
        if (at !== 0) { decided = at; break; }
      }
      if (decided === 0) {
        const a = hole.ring[0], b = hole.ring[1];
        decided = locateInRing(outer.ring, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
      if (decided > 0) parent = outer;
    }
    parent?.holes.push(hole.ring);
  }
  return outers.map(({ ring, holes: inner }) => ({
    outer: ring,
    holes: inner.sort((a, b) => cmpPoint(a[0], b[0]) || cmpPoint(a[1], b[1])),
  }));
}

/** One source of the overlay: rings pooled under one fill rule. */
export interface Source { readonly rings: readonly (readonly Pt[])[]; readonly fill: Fill }

/**
 * Overlay: pool each source's rings, planarise, and keep the faces for which `keep(inside)` holds,
 * where `inside[s]` says whether the face lies in source `s` under its fill rule.
 */
export function overlay(sources: readonly Source[], keep: (inside: readonly boolean[]) => boolean, work: Work): RawRegion[] {
  const segs: Seg[] = [];
  sources.forEach((source, s) => {
    for (const ring of source.rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) pushEdge(segs, sources.length, s, ring[j][0], ring[j][1], ring[i][0], ring[i][1]);
    }
  });
  charge(work, segs.length);
  const planar = planarize(segs, work);
  const { above, below } = windings(planar, sources.length, work);
  const edges: [Pt, Pt][] = [];
  const upper: boolean[] = new Array(sources.length), lower: boolean[] = new Array(sources.length);
  for (let k = 0; k < planar.length; k++) {
    for (let q = 0; q < sources.length; q++) {
      upper[q] = isInside(above[k * sources.length + q], sources[q].fill);
      lower[q] = isInside(below[k * sources.length + q], sources[q].fill);
    }
    const a = keep(upper), b = keep(lower);
    if (a === b) continue;
    const s = planar[k];
    // Interior on the left: directed low→high when the interior is above, high→low when below.
    edges.push(a ? [[s.ax, s.ay], [s.bx, s.by]] : [[s.bx, s.by], [s.ax, s.ay]]);
  }
  if (edges.length === 0) return [];
  return groupRings(traceRings(edges, work), work);
}
