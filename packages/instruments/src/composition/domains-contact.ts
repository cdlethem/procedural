import { orient } from "./planar-kernel.js";
import { cellColumn, cellRow, edgeIndex, locateIndexed } from "./domains-index.js";
import type { PlanarDomain, PlanarRegion, Ring } from "./domains.js";

/**
 * Exact CONTACT predicates for many small tests against one shape (packing, collision rejection).
 *
 * Every decision is made with the kernel's exact orientation predicate on the binary64 coordinates it is
 * given: there is no tolerance, and a point one ulp off a line is off it. "Contact" is the CLOSED-set
 * relation: two rings are in contact when their polylines share any point (a proper crossing, a touch,
 * a vertex on an edge, a collinear overlap). A ring is `ringWithin` a shape only when it lies in the
 * shape's interior with no contact at all. These are deliberately conservative for packing (touching
 * counts as colliding); they are not Booleans and never build geometry.
 *
 * Rings are handled as `FlatRing`s (interleaved coordinates plus a bounding box) so a caller can
 * transform a footprint into a scratch buffer without allocating a point object per vertex.
 * `tally.tests` counts the exact segment/segment tests (box-rejected pairs cost nothing, as in the
 * kernel's own work model) and the edges visited by point location, so a caller can bound work.
 */
export interface FlatRing {
  /** x0, y0, x1, y1, … the closed ring (the closing edge is implicit). */
  readonly xy: Float64Array;
  readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number;
}
export interface Tally { tests: number }

/** A ring's points as a `FlatRing` (copied). */
export function flatRing(points: Ring): FlatRing {
  const xy = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) { xy[2 * i] = points[i][0]; xy[2 * i + 1] = points[i][1]; }
  return boxed(xy);
}
/** A `FlatRing` over coordinates the caller will not change afterwards. */
export function boxed(xy: Float64Array): FlatRing {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < xy.length; i += 2) {
    if (xy[i] < minX) minX = xy[i]; if (xy[i] > maxX) maxX = xy[i];
    if (xy[i + 1] < minY) minY = xy[i + 1]; if (xy[i + 1] > maxY) maxY = xy[i + 1];
  }
  return { xy, minX, minY, maxX, maxY };
}
/** The ring turned by `angle` radians, scaled by `scale`, then moved by (dx, dy): `p ↦ scale·R(angle)·p + d`. */
export function transformRing(ring: FlatRing, cos: number, sin: number, scale: number, dx: number, dy: number): FlatRing {
  const src = ring.xy, out = new Float64Array(src.length);
  for (let i = 0; i < src.length; i += 2) {
    out[i] = scale * (cos * src[i] - sin * src[i + 1]) + dx;
    out[i + 1] = scale * (sin * src[i] + cos * src[i + 1]) + dy;
  }
  return boxed(out);
}

/** Whether the closed segments a–b and c–d share a point, by exact orientation. */
export function segmentsContact(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  if (Math.max(ax, bx) < Math.min(cx, dx) || Math.max(cx, dx) < Math.min(ax, bx) ||
    Math.max(ay, by) < Math.min(cy, dy) || Math.max(cy, dy) < Math.min(ay, by)) return false;
  const o1 = orient(ax, ay, bx, by, cx, cy), o2 = orient(ax, ay, bx, by, dx, dy);
  if ((o1 > 0 && o2 > 0) || (o1 < 0 && o2 < 0)) return false;
  const o3 = orient(cx, cy, dx, dy, ax, ay), o4 = orient(cx, cy, dx, dy, bx, by);
  if ((o3 > 0 && o4 > 0) || (o3 < 0 && o4 < 0)) return false;
  // Proper crossing, endpoint touch, or collinear with overlapping boxes (which on one line means overlap).
  return true;
}

let scratchA: Int32Array = new Int32Array(256), scratchB: Int32Array = new Int32Array(256);
function edgesIn(ring: FlatRing, x0: number, y0: number, x1: number, y1: number, out: Int32Array): { list: Int32Array; count: number } {
  const xy = ring.xy, n = xy.length / 2;
  let list = out, count = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = xy[2 * j], ay = xy[2 * j + 1], bx = xy[2 * i], by = xy[2 * i + 1];
    if ((ax < x0 && bx < x0) || (ax > x1 && bx > x1) || (ay < y0 && by < y0) || (ay > y1 && by > y1)) continue;
    if (count === list.length) { const bigger = new Int32Array(list.length * 2); bigger.set(list); list = bigger; }
    list[count++] = i;
  }
  return { list, count };
}

/** Whether two closed rings' polylines share any point (either may lie inside the other without contact). */
export function ringsContact(a: FlatRing, b: FlatRing, tally?: Tally): boolean {
  const x0 = Math.max(a.minX, b.minX), y0 = Math.max(a.minY, b.minY), x1 = Math.min(a.maxX, b.maxX), y1 = Math.min(a.maxY, b.maxY);
  if (x0 > x1 || y0 > y1) return false;
  const ea = edgesIn(a, x0, y0, x1, y1, scratchA); scratchA = ea.list;
  if (ea.count === 0) return false;
  const eb = edgesIn(b, x0, y0, x1, y1, scratchB); scratchB = eb.list;
  const p = a.xy, q = b.xy, na = p.length / 2, nb = q.length / 2;
  for (let s = 0; s < ea.count; s++) {
    const i = ea.list[s], j = i === 0 ? na - 1 : i - 1;
    const ax = p[2 * j], ay = p[2 * j + 1], bx = p[2 * i], by = p[2 * i + 1];
    const lox = Math.min(ax, bx), hix = Math.max(ax, bx), loy = Math.min(ay, by), hiy = Math.max(ay, by);
    for (let t = 0; t < eb.count; t++) {
      const k = eb.list[t], m = k === 0 ? nb - 1 : k - 1;
      const cx = q[2 * m], cy = q[2 * m + 1], dx = q[2 * k], dy = q[2 * k + 1];
      if (hix < Math.min(cx, dx) || Math.max(cx, dx) < lox || hiy < Math.min(cy, dy) || Math.max(cy, dy) < loy) continue;
      if (tally) tally.tests++;
      if (segmentsContact(ax, ay, bx, by, cx, cy, dx, dy)) return true;
    }
  }
  return false;
}

/** Exact location of a point against ONE closed ring: −1 outside, 0 on the ring, +1 inside (nonzero winding). */
export function locateInFlatRing(ring: FlatRing, x: number, y: number, tally?: Tally): number {
  if (x < ring.minX || x > ring.maxX || y < ring.minY || y > ring.maxY) return -1;
  const xy = ring.xy, n = xy.length / 2;
  if (tally) tally.tests += n >> 3;
  let winding = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = xy[2 * j], ay = xy[2 * j + 1], bx = xy[2 * i], by = xy[2 * i + 1];
    if ((ay > y && by > y) || (ay < y && by < y) || (ax < x && bx < x)) continue;
    const o = orient(ax, ay, bx, by, x, y);
    if (o === 0 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx)) return 0;
    if (ay <= y) { if (by > y && o > 0) winding++; }
    else if (by <= y && o < 0) winding--;
  }
  return winding !== 0 ? 1 : -1;
}

/** A connected piece of a shape as flat rings: an outer ring and its holes. */
export interface FlatRegion { readonly outer: FlatRing; readonly holes: readonly FlatRing[] }

function insideRegion(part: FlatRegion, x: number, y: number, tally?: Tally): boolean {
  if (locateInFlatRing(part.outer, x, y, tally) <= 0) return false;
  for (const hole of part.holes) if (locateInFlatRing(hole, x, y, tally) > 0) return false;
  return true;
}

/**
 * Whether two closed regions (each an outer ring minus its holes' interiors) share any point: some ring of one touches some ring of the
 * other, or, with no contact between rings, one lies inside the other's ink (a region inside a hole of the other does not count).
 */
export function regionsContact(p: FlatRegion, q: FlatRegion, tally?: Tally): boolean {
  const po = p.outer, qo = q.outer;
  if (po.maxX < qo.minX || qo.maxX < po.minX || po.maxY < qo.minY || qo.maxY < po.minY) return false;
  if (ringsContact(po, qo, tally)) return true;
  for (const h of p.holes) { if (ringsContact(h, qo, tally)) return true; for (const g of q.holes) if (ringsContact(h, g, tally)) return true; }
  for (const g of q.holes) if (ringsContact(po, g, tally)) return true;
  // No contact between any pair of rings: each ring is wholly inside or outside the other region.
  return insideRegion(q, po.xy[0], po.xy[1], tally) || insideRegion(p, qo.xy[0], qo.xy[1], tally);
}

/** Rings of a domain with their boxes, cached per (frozen) domain. */
const ringLists = new WeakMap<object, readonly FlatRing[]>();
function ringsOf(shape: PlanarDomain | PlanarRegion): readonly FlatRing[] {
  let hit = ringLists.get(shape);
  if (!hit) {
    const regions = "regions" in shape ? shape.regions : [shape];
    hit = Object.freeze(regions.flatMap((region) => [region.outer, ...region.holes]).map(flatRing));
    ringLists.set(shape, hit);
  }
  return hit;
}

/**
 * Whether the closed ring lies strictly inside the shape: no contact with any boundary edge, its points in
 * a face of the shape (not in a hole or another region's gap), and no ring of the shape (a hole, or a
 * separate region) enclosed by it. Cost is the edges of the shape in the grid cells under the ring's box.
 */
export function ringWithin(shape: PlanarDomain | PlanarRegion, ring: FlatRing, tally?: Tally): boolean {
  const index = edgeIndex(shape);
  if (index.count === 0) return false;
  if (ring.minX <= index.minX || ring.minY <= index.minY || ring.maxX >= index.maxX || ring.maxY >= index.maxY) return false;
  const { edges, cells, gx, stamp } = index;
  const c0 = cellColumn(index, ring.minX), c1 = cellColumn(index, ring.maxX), r0 = cellRow(index, ring.minY), r1 = cellRow(index, ring.maxY);
  const clock = ++index.clock;
  const xy = ring.xy, n = xy.length / 2;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const list = cells[r * gx + c];
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (stamp[e] === clock) continue;
      stamp[e] = clock;
      const cx = edges[4 * e], cy = edges[4 * e + 1], dx = edges[4 * e + 2], dy = edges[4 * e + 3];
      const lox = Math.min(cx, dx), hix = Math.max(cx, dx), loy = Math.min(cy, dy), hiy = Math.max(cy, dy);
      if (hix < ring.minX || lox > ring.maxX || hiy < ring.minY || loy > ring.maxY) continue;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const ax = xy[2 * j], ay = xy[2 * j + 1], bx = xy[2 * i], by = xy[2 * i + 1];
        if (Math.max(ax, bx) < lox || hix < Math.min(ax, bx) || Math.max(ay, by) < loy || hiy < Math.min(ay, by)) continue;
        if (tally) tally.tests++;
        if (segmentsContact(ax, ay, bx, by, cx, cy, dx, dy)) return false;
      }
    }
  }
  if (tally) tally.tests += 4;
  if (locateIndexed(index, xy[0], xy[1]) <= 0) return false;
  for (const other of ringsOf(shape)) {
    if (other.minX < ring.minX || other.maxX > ring.maxX || other.minY < ring.minY || other.maxY > ring.maxY) continue;
    if (locateInFlatRing(ring, other.xy[0], other.xy[1], tally) > 0) return false;
  }
  return true;
}
