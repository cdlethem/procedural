import { cellColumn, cellRow, edgeIndex, locateIndexed } from "./domains-index.js";
import { domainDifference, domainIntersection, planarDomain, resolveShape, workFor } from "./domains.js";
import type { PlanarDomain, PlanarRegion, PlanarRegionData, PlanarShape, Ring } from "./domains.js";
import { locateInRing, orient } from "./planar-kernel.js";
import type { Pt } from "./planar-kernel.js";

/**
 * Exact "do these shapes overlap" and "is this shape inside that one" predicates for consumers that
 * ask the question thousands of times (packing, collision, placement). Contract: docs/composition-domains.md.
 *
 * SEMANTICS (the closed-set rule of the domains): `shapesOverlap(a, b)` is true iff the INTERIORS share
 * positive area, exactly `domainIntersection(a, b).regions.length > 0`; regions that only touch (a point,
 * an edge, a shared boundary run) do not overlap. `shapeCovers(outer, inner)` is true iff `inner` lies in
 * the CLOSED `outer` (touching its boundary is allowed), exactly `domainDifference(inner, outer)` being
 * empty. Both are decided by exact orientation predicates, with no tolerance.
 *
 * FAST PATH. A Boolean per query is far too slow for a search, so the answer is settled by cheaper exact
 * facts and the Boolean is only the arbiter of degenerate contact:
 *   1. boxes that do not overlap in area -> disjoint interiors;
 *   2. two edges that cross properly (each strictly on both sides of the other) -> the interiors overlap;
 *   3. a vertex of one region strictly inside the other -> the interiors overlap (the region's interior
 *      comes arbitrarily close to its own boundary vertex, which lies in the other's open interior);
 *   4. NO edge contact of any kind and no such vertex -> the boundaries are disjoint and neither region
 *      contains the other, so the interiors are disjoint;
 *   5. otherwise (edges only touch or run collinear, as when two footprints are placed exactly against
 *      each other) the Boolean decides.
 * Only the region-level primitives take unvalidated ring data: they are correct for any pair of valid
 * regions (simple rings, holes inside the outer ring), and the caller owns that validity. The shape-level
 * wrappers validate as the Booleans do.
 *
 * WORK. The ring predicates cost O(edges of each region inside the boxes' common window squared) plus a
 * point location per window vertex; the covering predicate uses the container's cached edge grid. No
 * randomness, no allocation beyond small scratch arrays, no seeds.
 */

/** What the region-level predicates read: a `PlanarRegion` satisfies it; so does raw transformed ring data. */
export interface RingRegion {
  readonly outer: Ring;
  readonly holes: readonly Ring[];
  /** [left, top, right, bottom] of the outer ring. */
  readonly bounds: readonly [number, number, number, number];
}

/** 0: disjoint; 1: touching (a shared point, or a collinear run); 2: a proper crossing. */
function contact(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): 0 | 1 | 2 {
  const o1 = orient(ax, ay, bx, by, cx, cy), o2 = orient(ax, ay, bx, by, dx, dy);
  if ((o1 > 0 && o2 > 0) || (o1 < 0 && o2 < 0)) return 0;
  const o3 = orient(cx, cy, dx, dy, ax, ay), o4 = orient(cx, cy, dx, dy, bx, by);
  if ((o3 > 0 && o4 > 0) || (o3 < 0 && o4 < 0)) return 0;
  if (o1 === 0 && o2 === 0) {
    // Collinear (then o3 = o4 = 0 too): they meet iff their extents overlap on both axes.
    if (Math.max(Math.min(ax, bx), Math.min(cx, dx)) > Math.min(Math.max(ax, bx), Math.max(cx, dx))) return 0;
    if (Math.max(Math.min(ay, by), Math.min(cy, dy)) > Math.min(Math.max(ay, by), Math.max(cy, dy))) return 0;
    return 1;
  }
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 ? 2 : 1;
}

/** Strictly inside the region: inside the outer ring and outside every hole ring (a point on any ring is not strictly inside). */
function strictlyInside(region: RingRegion, x: number, y: number): boolean {
  const [l, t, r, b] = region.bounds;
  if (x <= l || x >= r || y <= t || y >= b) return false;
  if (locateInRing(region.outer as readonly Pt[], x, y) <= 0) return false;
  for (const hole of region.holes) if (locateInRing(hole as readonly Pt[], x, y) >= 0) return false;
  return true;
}

function asData(region: RingRegion): PlanarRegionData {
  return { outer: region.outer as readonly (readonly [number, number])[], holes: region.holes as readonly (readonly (readonly [number, number])[])[] };
}
const fallbackDomain = (region: RingRegion, id: string): PlanarDomain => planarDomain(asData(region), { id, repair: "nonzero" });

/** Edges (ring, index) of the region whose box meets the window, as flat [ax, ay, bx, by] quadruples. */
function edgesIn(region: RingRegion, l: number, t: number, r: number, b: number): number[] {
  const out: number[] = [];
  for (const ring of [region.outer, ...region.holes]) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = ring[j][0], ay = ring[j][1], bx = ring[i][0], by = ring[i][1];
      if ((ax < l && bx < l) || (ax > r && bx > r) || (ay < t && by < t) || (ay > b && by > b)) continue;
      out.push(ax, ay, bx, by);
    }
  }
  return out;
}

/**
 * Whether two regions (each one outer ring with its holes) have interiors that share positive area.
 * Equal to `domainIntersection(a, b).regions.length > 0`; see the header for how it is decided.
 */
export function regionsOverlap(a: RingRegion, b: RingRegion): boolean {
  const l = Math.max(a.bounds[0], b.bounds[0]), t = Math.max(a.bounds[1], b.bounds[1]);
  const r = Math.min(a.bounds[2], b.bounds[2]), bo = Math.min(a.bounds[3], b.bounds[3]);
  if (!(l < r && t < bo)) return false;
  const ea = edgesIn(a, l, t, r, bo), eb = edgesIn(b, l, t, r, bo);
  let touching = false;
  for (let i = 0; i < ea.length; i += 4) {
    const ax = ea[i], ay = ea[i + 1], bx = ea[i + 2], by = ea[i + 3];
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    for (let k = 0; k < eb.length; k += 4) {
      const cx = eb[k], cy = eb[k + 1], dx = eb[k + 2], dy = eb[k + 3];
      if ((cx < x0 && dx < x0) || (cx > x1 && dx > x1) || (cy < y0 && dy < y0) || (cy > y1 && dy > y1)) continue;
      const kind = contact(ax, ay, bx, by, cx, cy, dx, dy);
      if (kind === 2) return true;
      if (kind === 1) touching = true;
    }
  }
  for (let i = 0; i < ea.length; i += 4) if (strictlyInside(b, ea[i], ea[i + 1])) return true;
  for (let i = 0; i < eb.length; i += 4) if (strictlyInside(a, eb[i], eb[i + 1])) return true;
  if (!touching) return false;
  return domainIntersection(fallbackDomain(a, "a"), fallbackDomain(b, "b")).regions.length > 0;
}

/**
 * Whether `inner` lies in the closed `container` (a validated region or domain, whose cached edge grid
 * is used). Equal to `domainDifference(inner, container)` having no regions.
 */
export function regionInside(container: PlanarDomain | PlanarRegion, inner: RingRegion): boolean {
  const box = container.bounds;
  if (!box) return false;
  const [l, t, r, b] = inner.bounds;
  if (l < box[0] || t < box[1] || r > box[2] || b > box[3]) return false;
  const index = edgeIndex(container);
  // Container edges whose grid cells meet the region's box (each once).
  const c0 = cellColumn(index, l), c1 = cellColumn(index, r), r0 = cellRow(index, t), r1 = cellRow(index, b);
  const clock = ++index.clock, near: number[] = [];
  for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
    const list = index.cells[row * index.gx + col];
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (index.stamp[e] === clock) continue;
      index.stamp[e] = clock;
      const ax = index.edges[4 * e], ay = index.edges[4 * e + 1], bx = index.edges[4 * e + 2], by = index.edges[4 * e + 3];
      if ((ax < l && bx < l) || (ax > r && bx > r) || (ay < t && by < t) || (ay > b && by > b)) continue;
      near.push(ax, ay, bx, by);
    }
  }
  if (near.length === 0) {
    // No boundary of the container passes through the box: the region is wholly on one side of it.
    const p = inner.outer[0];
    return locateIndexed(index, p[0], p[1]) >= 0;
  }
  const own = edgesIn(inner, l, t, r, b);
  let touching = false;
  for (let i = 0; i < own.length; i += 4) {
    const ax = own[i], ay = own[i + 1], bx = own[i + 2], by = own[i + 3];
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    for (let k = 0; k < near.length; k += 4) {
      const cx = near[k], cy = near[k + 1], dx = near[k + 2], dy = near[k + 3];
      if ((cx < x0 && dx < x0) || (cx > x1 && dx > x1) || (cy < y0 && dy < y0) || (cy > y1 && dy > y1)) continue;
      const kind = contact(ax, ay, bx, by, cx, cy, dx, dy);
      if (kind === 2) return false;
      if (kind === 1) touching = true;
    }
  }
  for (const ring of [inner.outer, ...inner.holes]) for (const [x, y] of ring) if (locateIndexed(index, x, y) < 0) return false;
  // A container boundary vertex strictly inside the region means the region holds points outside the container.
  for (let k = 0; k < near.length; k += 4) if (strictlyInside(inner, near[k], near[k + 1]) || strictlyInside(inner, near[k + 2], near[k + 3])) return false;
  if (!touching) return true;
  return domainDifference(fallbackDomain(inner, "inner"), container).regions.length === 0;
}

/** `shapesOverlap` and `shapeCovers` accept any planar shape (validated like the Booleans); `[]` regions never overlap. */
export function shapesOverlap(a: PlanarShape, b: PlanarShape): boolean {
  const work = workFor("shapesOverlap", undefined);
  const ra = regionListOf(resolveShape(a, 0, work)), rb = regionListOf(resolveShape(b, 1, work));
  for (const p of ra) for (const q of rb) if (regionsOverlap(p, q)) return true;
  return false;
}
/** True iff every point of `inner` lies in the closed `outer`. An empty `inner` is covered. */
export function shapeCovers(outer: PlanarShape, inner: PlanarShape): boolean {
  const work = workFor("shapeCovers", undefined);
  const container = resolveShape(outer, 0, work), pieces = regionListOf(resolveShape(inner, 1, work));
  // Regions of one domain may touch each other, which does not matter: each must lie in the closed container.
  return pieces.every((piece) => regionInside(container, piece));
}
function regionListOf(shape: PlanarDomain | PlanarRegion): readonly PlanarRegion[] {
  return "regions" in shape ? shape.regions : [shape];
}
