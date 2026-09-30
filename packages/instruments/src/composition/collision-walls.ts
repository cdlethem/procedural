/**
 * Static obstacles for disc bodies (Collision Scores): the boundary of a planar container, reflex corners,
 * and free round posts, with the exact time-of-impact of a moving disc against each.
 *
 * Elements, in the order they are indexed everywhere (`wallId`, the collision log's second body field):
 * - **segments** `0 … S−1`, one per ring edge, each with its inward normal. The container is the region
 *   on the LEFT of every ring's direction of travel (the orientation `planarRegion` normalises to), so the
 *   inward normal of the edge `a → b` is `(−dy, dx) / length`. A hole's edges point into the domain too.
 * - **rounds** `S … S+R−1`: a circle of radius `R`. Reflex corners of the domain (the boundary turns
 *   away from the interior) are rounds with radius 0, so a disc can strike a corner point; free posts are
 *   rounds with their own radius. A convex corner needs none: the disc always meets an adjoining edge first.
 *
 * A disc of radius `r` at `p` with velocity `v` touches a segment when its centre is at distance `r` from the
 * edge's line, with its contact point inside the edge, and a round when its centre is at distance `R + r`.
 * Every function solves that exactly (a linear or quadratic equation), so there is no tunnelling at any speed.
 * A contact only counts while the disc approaches faster than `APPROACH_EPS`; a disc at rest against a wall
 * or leaving it is not a collision.
 */
export const APPROACH_EPS = 1e-9;
const EDGE_TOLERANCE = 1e-9;
const MAX_WALL_CELLS = 40_000;

export interface WallSet {
  /** Stride 7 per segment: ax, ay, bx, by, inward nx, ny, length. */
  readonly segments: Float64Array;
  /** Stride 3 per round: cx, cy, radius. */
  readonly rounds: Float64Array;
  readonly segmentCount: number;
  readonly roundCount: number;
  /** Ids of every element: `wall:<edge>`, `corner:<n>`, `post:<n>`. */
  readonly ids: readonly string[];
  /** `[minX, minY, maxX, maxY]` of everything. */
  readonly bounds: readonly [number, number, number, number];
  readonly cell: number;
  readonly columns: number;
  readonly rows: number;
  /** Element indices per grid cell. */
  readonly cells: readonly (readonly number[])[];
}

export type Ring = readonly (readonly number[])[];

/** Build the wall set of oriented rings (region on the left of travel) and posts `[x, y, radius]`. */
export function buildWalls(rings: readonly Ring[], posts: readonly (readonly number[])[]): WallSet {
  const segments: number[] = [], rounds: number[] = [], ids: string[] = [];
  let corners = 0;
  for (const ring of rings) {
    const n = ring.length;
    if (n < 3) throw new Error("A container ring needs at least three vertices");
    for (let i = 0; i < n; i++) {
      const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % n];
      const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
      if (!(length > 0)) throw new Error("A container ring has a zero-length edge");
      segments.push(ax, ay, bx, by, -dy / length, dx / length, length);
      ids.push(`wall:${ids.length}`);
    }
  }
  for (const ring of rings) {
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const [px, py] = ring[(i + n - 1) % n], [vx, vy] = ring[i], [nx, ny] = ring[(i + 1) % n];
      // Region on the left: a right turn is a reflex corner, which pokes into the interior.
      if ((vx - px) * (ny - vy) - (vy - py) * (nx - vx) < 0) { rounds.push(vx, vy, 0); ids.push(`corner:${corners++}`); }
    }
  }
  posts.forEach(([x, y, radius], k) => { rounds.push(x, y, radius); ids.push(`post:${k}`); });
  const segmentCount = segments.length / 7, roundCount = rounds.length / 3;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let s = 0; s < segmentCount; s++) for (const [x, y] of [[segments[s * 7], segments[s * 7 + 1]], [segments[s * 7 + 2], segments[s * 7 + 3]]]) {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  for (let q = 0; q < roundCount; q++) {
    const x = rounds[q * 3], y = rounds[q * 3 + 1], r = rounds[q * 3 + 2];
    minX = Math.min(minX, x - r); minY = Math.min(minY, y - r); maxX = Math.max(maxX, x + r); maxY = Math.max(maxY, y + r);
  }
  if (!Number.isFinite(minX)) throw new Error("A container needs at least one ring");
  const span = Math.max(maxX - minX, maxY - minY, 1);
  let cell = Math.max(span / 24, 1);
  while (Math.ceil((maxX - minX) / cell) * Math.ceil((maxY - minY) / cell) > MAX_WALL_CELLS) cell *= 2;
  const columns = Math.max(1, Math.ceil((maxX - minX) / cell)), rows = Math.max(1, Math.ceil((maxY - minY) / cell));
  const cells: number[][] = Array.from({ length: columns * rows }, () => []);
  const put = (element: number, x0: number, y0: number, x1: number, y1: number) => {
    const c0 = Math.max(0, Math.min(columns - 1, Math.floor((x0 - minX) / cell))), c1 = Math.max(0, Math.min(columns - 1, Math.floor((x1 - minX) / cell)));
    const r0 = Math.max(0, Math.min(rows - 1, Math.floor((y0 - minY) / cell))), r1 = Math.max(0, Math.min(rows - 1, Math.floor((y1 - minY) / cell)));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cells[r * columns + c].push(element);
  };
  for (let s = 0; s < segmentCount; s++) {
    const o = s * 7;
    put(s, Math.min(segments[o], segments[o + 2]), Math.min(segments[o + 1], segments[o + 3]), Math.max(segments[o], segments[o + 2]), Math.max(segments[o + 1], segments[o + 3]));
  }
  for (let q = 0; q < roundCount; q++) {
    const x = rounds[q * 3], y = rounds[q * 3 + 1], r = rounds[q * 3 + 2];
    put(segmentCount + q, x - r, y - r, x + r, y + r);
  }
  return Object.freeze({
    segments: new Float64Array(segments), rounds: new Float64Array(rounds), segmentCount, roundCount, ids: Object.freeze(ids),
    bounds: Object.freeze([minX, minY, maxX, maxY] as const), cell, columns, rows, cells: Object.freeze(cells.map((list) => Object.freeze(list))),
  });
}

/**
 * Elements whose grid cells meet the box, each once and ascending, appended to `out` (cleared first).
 * `marks` is scratch with one entry per element; `stamp` must differ between calls that share it.
 * Returns the cells and entries visited, for the caller's work account.
 */
export function wallsNear(walls: WallSet, minX: number, minY: number, maxX: number, maxY: number, marks: Int32Array, stamp: number, out: number[]): number {
  out.length = 0;
  const [bx, by] = walls.bounds;
  const c0 = Math.max(0, Math.floor((minX - bx) / walls.cell)), c1 = Math.min(walls.columns - 1, Math.floor((maxX - bx) / walls.cell));
  const r0 = Math.max(0, Math.floor((minY - by) / walls.cell)), r1 = Math.min(walls.rows - 1, Math.floor((maxY - by) / walls.cell));
  let visited = 0;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const list = walls.cells[r * walls.columns + c];
    visited++;
    for (const element of list) { visited++; if (marks[element] !== stamp) { marks[element] = stamp; out.push(element); } }
  }
  out.sort((a, b) => a - b);
  return visited;
}

/** Time in `[0, limit]` at which a disc first touches segment `s` while approaching it, else Infinity. */
export function timeToSegment(walls: WallSet, s: number, px: number, py: number, vx: number, vy: number, r: number, limit: number): number {
  const o = s * 7, g = walls.segments;
  const nx = g[o + 4], ny = g[o + 5];
  const vn = nx * vx + ny * vy;
  if (!(vn < -APPROACH_EPS)) return Infinity;
  const d0 = nx * (px - g[o]) + ny * (py - g[o + 1]);
  let t = (r - d0) / vn;
  // Overlapping the edge (centre still on the room's side) counts as touching now; a centre behind the edge's line has already passed it.
  if (t < 0) { if (d0 < 0) return Infinity; t = 0; }
  if (t > limit) return Infinity;
  const length = g[o + 6];
  const along = ((g[o + 2] - g[o]) * (px + vx * t - g[o]) + (g[o + 3] - g[o + 1]) * (py + vy * t - g[o + 1])) / length;
  return along < -EDGE_TOLERANCE || along > length + EDGE_TOLERANCE ? Infinity : t;
}

/**
 * Time in `[0, limit]` at which a point moving along `(wx, wy)` from offset `(dx, dy)` first reaches distance
 * `reach` of the origin while approaching it at more than `APPROACH_EPS`, else Infinity. It is the time of
 * impact of a disc against a round (offset from the round's centre, `reach = R + r`) and of two discs
 * (offset and velocity of the second relative to the first, `reach = r₁ + r₂`).
 */
export function timeToReach(dx: number, dy: number, wx: number, wy: number, reach: number, limit: number): number {
  const b = dx * wx + dy * wy;
  if (!(b < 0)) return Infinity;
  const a = wx * wx + wy * wy;
  const c = dx * dx + dy * dy - reach * reach;
  let t: number;
  if (c <= 0) t = 0;
  else {
    const discriminant = b * b - a * c;
    if (discriminant < 0) return Infinity;
    t = c / (-b + Math.sqrt(discriminant));
  }
  if (t > limit) return Infinity;
  // Approach speed along the line of centres at contact.
  const cx = dx + wx * t, cy = dy + wy * t, distance = Math.hypot(cx, cy);
  return distance > 0 && -(cx * wx + cy * wy) / distance > APPROACH_EPS ? t : Infinity;
}

/** Even-odd containment against every ring edge (not posts). Points on the boundary are not classified. */
export function insideContainer(walls: WallSet, x: number, y: number): boolean {
  let inside = false;
  const g = walls.segments;
  for (let s = 0; s < walls.segmentCount; s++) {
    const o = s * 7, ay = g[o + 1], by = g[o + 3];
    if ((ay > y) !== (by > y) && x < g[o] + (y - ay) * (g[o + 2] - g[o]) / (by - ay)) inside = !inside;
  }
  return inside;
}

/** Distance from `(x, y)` to the nearest wall surface among the given element list, or Infinity. */
export function distanceToWalls(walls: WallSet, x: number, y: number, elements: readonly number[]): number {
  let best = Infinity;
  for (const e of elements) {
    if (e < walls.segmentCount) {
      const o = e * 7, g = walls.segments;
      const ux = (g[o + 2] - g[o]) / g[o + 6], uy = (g[o + 3] - g[o + 1]) / g[o + 6];
      const along = Math.max(0, Math.min(g[o + 6], ux * (x - g[o]) + uy * (y - g[o + 1])));
      best = Math.min(best, Math.hypot(x - (g[o] + ux * along), y - (g[o + 1] + uy * along)));
    } else {
      const o = (e - walls.segmentCount) * 3;
      best = Math.min(best, Math.hypot(x - walls.rounds[o], y - walls.rounds[o + 1]) - walls.rounds[o + 2]);
    }
  }
  return best;
}
