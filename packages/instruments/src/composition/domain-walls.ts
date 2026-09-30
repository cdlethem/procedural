import { cellColumn, cellRow, edgeIndex, locateIndexed, type EdgeIndex } from "./domains-index.js";
import type { PlanarDomain, PlanarRegion } from "./domains.js";

/**
 * A planar domain's (or one region's) boundary as an obstacle for moving points: the queries a walker needs on every
 * step, answered from the domain's cached edge grid so each costs about the boundary edges near the
 * step, never all of them.
 *
 * - `inside(x, y)` is exact (the domain module's predicate) and strict: a point on the boundary is not
 *   inside, so a walker is never released onto a wall.
 * - `gap(x, y, limit)` is the Euclidean distance from a point to the nearest boundary edge, capped at
 *   `limit` (the cap is returned when no edge is nearer). Every boundary counts: holes and the walls
 *   of separate regions are obstacles just like the outer ring.
 * - `clear(a, b, clearance)` is true when the whole segment `a→b` stays at least `clearance` from every
 *   boundary edge. A segment that crosses an edge is at distance 0, so a step can never tunnel through
 *   a wall thinner than the step. Distances are ordinary floating point (no exact predicates): a step
 *   that passes within rounding error of the clearance may be judged either way, which is harmless
 *   for a clearance and never lets a segment across a wall (a crossing is far below any clearance
 *   above zero).
 *
 * The walker starts inside; a `clear` step from an inside start therefore ends inside too. Units are
 * the domain's. Nothing is mutated except the edge grid's visit stamps, which are private scratch.
 */
export class DomainWalls {
  private readonly index: EdgeIndex;

  constructor(readonly shape: PlanarDomain | PlanarRegion) {
    this.index = edgeIndex(shape);
  }

  /** True for a domain with no boundary at all (nothing is inside it). */
  get empty(): boolean { return this.index.count === 0; }

  inside(x: number, y: number): boolean {
    return locateIndexed(this.index, x, y) > 0;
  }

  gap(x: number, y: number, limit: number): number {
    const index = this.index;
    if (index.count === 0) return limit;
    let best = limit * limit;
    this.visit(x - limit, y - limit, x + limit, y + limit, (ax, ay, bx, by) => {
      const d = pointSegment(x, y, ax, ay, bx, by);
      if (d < best) best = d;
    });
    return Math.sqrt(best);
  }

  clear(ax: number, ay: number, bx: number, by: number, clearance: number): boolean {
    const index = this.index;
    if (index.count === 0) return true;
    const limit = clearance * clearance;
    let blocked = false;
    this.visit(Math.min(ax, bx) - clearance, Math.min(ay, by) - clearance, Math.max(ax, bx) + clearance, Math.max(ay, by) + clearance, (cx, cy, dx, dy) => {
      if (!blocked && segmentSegment(ax, ay, bx, by, cx, cy, dx, dy) < limit) blocked = true;
    });
    return !blocked;
  }

  /** Each boundary edge in the cells overlapping the box, once. */
  private visit(minX: number, minY: number, maxX: number, maxY: number, edge: (ax: number, ay: number, bx: number, by: number) => void): void {
    const index = this.index;
    const { edges, cells, gx, stamp } = index;
    const c0 = cellColumn(index, minX), c1 = cellColumn(index, maxX), r0 = cellRow(index, minY), r1 = cellRow(index, maxY);
    const clock = ++index.clock;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const list = cells[r * gx + c];
      for (let k = 0; k < list.length; k++) {
        const e = list[k];
        if (stamp[e] === clock) continue;
        stamp[e] = clock;
        edge(edges[4 * e], edges[4 * e + 1], edges[4 * e + 2], edges[4 * e + 3]);
      }
    }
  }
}

/** Squared distance from a point to a segment. */
function pointSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy;
  let t = length2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / length2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = ax + t * dx - px, ey = ay + t * dy - py;
  return ex * ex + ey * ey;
}

const side = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

/** Squared distance between two segments: 0 when they touch or cross, otherwise the smallest endpoint-to-segment distance. */
function segmentSegment(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  if (ax !== bx || ay !== by) {
    const o1 = side(ax, ay, bx, by, cx, cy), o2 = side(ax, ay, bx, by, dx, dy), o3 = side(cx, cy, dx, dy, ax, ay), o4 = side(cx, cy, dx, dy, bx, by);
    if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return 0;
  }
  return Math.min(pointSegment(ax, ay, cx, cy, dx, dy), pointSegment(bx, by, cx, cy, dx, dy), pointSegment(cx, cy, ax, ay, bx, by), pointSegment(dx, dy, ax, ay, bx, by));
}
