import { charge, orient, type Work } from "./planar-kernel.js";
import type { PlanarDomain, PlanarRegion } from "./domains.js";

/**
 * A uniform grid over the boundary edges of a shape, cached per (frozen) value. It serves exact
 * point location and path clipping, so both cost about √E edge tests instead of E.
 */
export interface EdgeIndex {
  readonly edges: Float64Array; // ax ay bx by per edge, in ring order (region on the left)
  readonly count: number;
  readonly cells: Int32Array[]; // edge ids per cell
  readonly gx: number; readonly gy: number;
  readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number;
  readonly cellW: number; readonly cellH: number;
  readonly stamp: Int32Array;
  clock: number;
}
const indexes = new WeakMap<object, EdgeIndex>();

export function edgeIndex(domain: PlanarDomain | PlanarRegion): EdgeIndex {
  const hit = indexes.get(domain);
  if (hit) return hit;
  const regions = "regions" in domain ? domain.regions : [domain];
  let count = 0;
  for (const region of regions) count += region.outer.length + region.holes.reduce((s, h) => s + h.length, 0);
  const edges = new Float64Array(count * 4);
  let at = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const region of regions) for (const ring of [region.outer, ...region.holes]) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    edges[at++] = ring[j][0]; edges[at++] = ring[j][1]; edges[at++] = ring[i][0]; edges[at++] = ring[i][1];
    minX = Math.min(minX, ring[i][0]); maxX = Math.max(maxX, ring[i][0]); minY = Math.min(minY, ring[i][1]); maxY = Math.max(maxY, ring[i][1]);
  }
  const side = Math.max(1, Math.min(512, Math.ceil(Math.sqrt(count / 2))));
  const gx = side, gy = side, cellW = (maxX - minX) / gx || 1, cellH = (maxY - minY) / gy || 1;
  const lists: number[][] = Array.from({ length: gx * gy }, () => []);
  const cx = (x: number) => Math.min(gx - 1, Math.max(0, Math.floor((x - minX) / cellW)));
  const cy = (y: number) => Math.min(gy - 1, Math.max(0, Math.floor((y - minY) / cellH)));
  for (let e = 0; e < count; e++) {
    const x0 = cx(Math.min(edges[4 * e], edges[4 * e + 2])), x1 = cx(Math.max(edges[4 * e], edges[4 * e + 2]));
    const y0 = cy(Math.min(edges[4 * e + 1], edges[4 * e + 3])), y1 = cy(Math.max(edges[4 * e + 1], edges[4 * e + 3]));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) lists[y * gx + x].push(e);
  }
  const built: EdgeIndex = { edges, count, cells: lists.map((l) => Int32Array.from(l)), gx, gy, minX, minY, maxX, maxY, cellW, cellH, stamp: new Int32Array(count), clock: 0 };
  indexes.set(domain, built);
  return built;
}

export const cellColumn = (index: EdgeIndex, x: number): number => Math.min(index.gx - 1, Math.max(0, Math.floor((x - index.minX) / index.cellW)));
export const cellRow = (index: EdgeIndex, y: number): number => Math.min(index.gy - 1, Math.max(0, Math.floor((y - index.minY) / index.cellH)));

/**
 * Exact location of a point against the shape the index was built from: −1 outside, 0 on the boundary,
 * +1 inside. Uses only the edges the grid places along the point's row to its right (an edge crossing
 * that ray shares a cell with it), with the half-open upward-crossing winding rule and exact orientation.
 */
export function locateIndexed(index: EdgeIndex, x: number, y: number, work?: Work): number {
  const { edges, cells, gx, stamp } = index;
  if (index.count === 0 || x < index.minX || y < index.minY || x > index.maxX || y > index.maxY) return -1;
  const row = cellRow(index, y);
  const clock = ++index.clock;
  let winding = 0;
  for (let c = cellColumn(index, x); c < gx; c++) {
    const list = cells[row * gx + c];
    if (work) charge(work, list.length + 1);
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (stamp[e] === clock) continue;
      stamp[e] = clock;
      const ax = edges[4 * e], ay = edges[4 * e + 1], bx = edges[4 * e + 2], by = edges[4 * e + 3];
      if (Math.max(ay, by) < y || Math.min(ay, by) > y || Math.max(ax, bx) < x) continue;
      const o = orient(ax, ay, bx, by, x, y);
      if (o === 0 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx)) return 0;
      if (ay <= y) { if (by > y && o > 0) winding++; }
      else if (by <= y && o < 0) winding--;
    }
  }
  return winding !== 0 ? 1 : -1;
}
