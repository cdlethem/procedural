import type { Path, Point } from "./types.js";

/**
 * Crossings of a set of paths, found exactly, and the degenerate cases named rather than guessed.
 *
 * INPUT: `Path` values (`points`, `closed`; `id` must be unique). Nothing is mutated and the input
 * arrays are read once; the result is cached on the identity of the input array, so pass the
 * frozen array a producer returned (do not mutate it afterwards).
 *
 * RESOLVED GEOMETRY. Coordinates must be finite and within ±8192. Every vertex is snapped to a
 * 1/256-unit grid, consecutive duplicate vertices (and a closing vertex equal to the first) are
 * dropped, and all tests run on those integers, so every orientation test is exact: no epsilon,
 * no order-dependent answer. `CrossingSet.paths` are the resolved paths (same ids, seeds, closure,
 * levels, tones); crossing parameters refer to them. A path left with fewer than two distinct
 * points (three when closed) is an error naming the path.
 *
 * WHAT COUNTS. Segments of every pair of paths, and of one path with itself (non-adjacent
 * segments), are tested. Adjacent segments of one path share a vertex and are never a crossing.
 *  - `transversal`: the open segments cross at one interior point of both.
 *  - `vertex`: paths meet at a vertex of at least one of them (a path passing exactly through the
 *    other's vertex, or two vertices coinciding) AND the four rays leaving the meeting point
 *    alternate in angular order, i.e. one path really passes from one side of the other to the
 *    other. Each physical meeting is reported once, not once per segment pair.
 *  - Not crossings, published in `contacts`: `tangent` (the paths touch but the rays do not
 *    alternate), `terminal` (an open path ends on the other: a T-junction), and `overlap`
 *    (some pair of rays leaves the point in the same direction: the paths share a stretch).
 *    A shared stretch is reported at each vertex on it and is never woven: separate the paths if
 *    it must be. Overlaps therefore also cannot change which side a strand ends up on.
 *  - `nearMisses` (only when `nearMiss > 0`): non-intersecting stretches of two paths (or of one
 *    path with a part at least 4 × `nearMiss` further along it) whose distance is below
 *    `nearMiss`. Connected runs of close segment pairs are one entry; a run that contains or
 *    touches an intersecting pair is part of that crossing, not a near miss.
 * Crossing ids are `<pathId>@<s>~<pathId>@<s>` with `s` the arc length in canvas units (3
 * decimals) of the two sides, path order first; they depend on the geometry only.
 *
 * UNITS. Canvas units; angles in radians; `s` is arc length from the path's first vertex (a closed
 * path's length includes its closing edge). Tangents are unit vectors in the direction of travel.
 *
 * WORK. Broad phase is a uniform grid. Above `CROSSING_LIMITS` the call throws before allocating
 * further, naming the quantity and what to lower. Nothing is truncated.
 */
export const CROSSING_LIMITS = Object.freeze({
  paths: 2_000, segments: 60_000, gridEntries: 3_000_000, pairTests: 40_000_000, crossings: 30_000, nearMiss: 400,
});
const SCALE = 256, EXTENT = 8192;

export interface CrossingSide {
  /** Index into `CrossingSet.paths`. */
  readonly path: number;
  readonly pathId: string;
  /** Arc length from the path's first vertex to the crossing. */
  readonly s: number;
  /** Resolved segment (vertex `segment` to the next) and fraction along it; 0 at a vertex. */
  readonly segment: number;
  readonly t: number;
  /** Unit direction of travel. */
  readonly tangent: Point;
}
export interface Crossing {
  readonly id: string;
  /** Position in `CrossingSet.crossings`: by first path, then arc length. */
  readonly index: number;
  readonly kind: "transversal" | "vertex";
  readonly point: Point;
  /** The two strands; `first` is the lower path index (for one path, the smaller arc length). */
  readonly first: CrossingSide;
  readonly second: CrossingSide;
  /** |sin| of the angle between the tangents, in (0, 1]; small means a shallow crossing. */
  readonly sine: number;
  /** Both sides are the same path. */
  readonly self: boolean;
}
export interface Contact {
  readonly kind: "tangent" | "terminal" | "overlap";
  readonly point: Point;
  readonly first: { readonly path: number; readonly pathId: string; readonly s: number };
  readonly second: { readonly path: number; readonly pathId: string; readonly s: number };
}
export interface NearMiss {
  /** Midpoint of the closest approach. */
  readonly point: Point;
  readonly distance: number;
  readonly first: { readonly path: number; readonly pathId: string; readonly s: number };
  readonly second: { readonly path: number; readonly pathId: string; readonly s: number };
  /** Segment pairs in the connected run. */
  readonly pairs: number;
}
export interface CrossingSet {
  /** Resolved (snapped) paths every parameter refers to. */
  readonly paths: readonly Path[];
  /** Arc length of each resolved path. */
  readonly lengths: readonly number[];
  readonly crossings: readonly Crossing[];
  readonly contacts: readonly Contact[];
  readonly nearMisses: readonly NearMiss[];
  readonly nearMiss: number;
}
export interface CrossingOptions {
  /** Distance below which non-intersecting strands are reported as near misses; 0 (default) reports none. */
  nearMiss?: number;
}

const cache = new WeakMap<readonly Path[], Map<number, CrossingSet>>();

const orient = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number =>
  Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
const within = (a: number, b: number, v: number) => (a <= b ? a <= v && v <= b : b <= v && v <= a);

/** Is direction d strictly inside the counter-clockwise sector from u to v? (u and v not parallel-same.) */
function strictlyInside(ux: number, uy: number, vx: number, vy: number, dx: number, dy: number): boolean {
  const c = cross(ux, uy, vx, vy);
  if (c > 0) return cross(ux, uy, dx, dy) > 0 && cross(dx, dy, vx, vy) > 0;
  if (c < 0) return !(cross(vx, vy, dx, dy) >= 0 && cross(dx, dy, ux, uy) >= 0);
  return ux * vx + uy * vy < 0 && cross(ux, uy, dx, dy) > 0;
}
const sameDirection = (ax: number, ay: number, bx: number, by: number) => cross(ax, ay, bx, by) === 0 && ax * bx + ay * by > 0;

type Position = { vertex: boolean; index: number };
interface RawContact { pa: number; posA: Position; pb: number; posB: Position; x: number; y: number }

function resolve(paths: readonly Path[]): { paths: Path[]; ix: Float64Array[]; iy: Float64Array[] } {
  if (paths.length > CROSSING_LIMITS.paths)
    throw new Error(`Crossing search was given ${paths.length} paths; the limit is ${CROSSING_LIMITS.paths}. Use fewer paths`);
  const seen = new Set<string>(), resolved: Path[] = [], ix: Float64Array[] = [], iy: Float64Array[] = [];
  let vertices = 0;
  for (const path of paths) {
    if (seen.has(path.id)) throw new Error(`Path id ${path.id} is used twice; crossing ids need unique path ids`);
    seen.add(path.id);
    const xs: number[] = [], ys: number[] = [];
    for (const [x, y] of path.points) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > EXTENT || Math.abs(y) > EXTENT)
        throw new Error(`Path ${path.id} has a coordinate that is not finite or lies outside ±${EXTENT}`);
      const px = Math.round(x * SCALE), py = Math.round(y * SCALE);
      if (xs.length && xs[xs.length - 1] === px && ys[ys.length - 1] === py) continue;
      xs.push(px); ys.push(py);
    }
    while (path.closed && xs.length > 1 && xs[0] === xs[xs.length - 1] && ys[0] === ys[ys.length - 1]) { xs.pop(); ys.pop(); }
    if (xs.length < (path.closed ? 3 : 2))
      throw new Error(`Path ${path.id} has fewer than ${path.closed ? 3 : 2} distinct points after snapping to 1/${SCALE} unit`);
    vertices += xs.length;
    if (vertices > CROSSING_LIMITS.segments)
      throw new Error(`Crossing search was given more than ${CROSSING_LIMITS.segments} vertices; lower the corner cuts or the path density`);
    ix.push(Float64Array.from(xs)); iy.push(Float64Array.from(ys));
    resolved.push(Object.freeze({ ...path, points: Object.freeze(xs.map((x, i) => Object.freeze([x / SCALE, ys[i] / SCALE] as const))) }));
  }
  return { paths: resolved, ix, iy };
}

/** Find every crossing of the paths (see the module comment for the exact policy). */
export function findCrossings(paths: readonly Path[], options: CrossingOptions = {}): CrossingSet {
  const nearMiss = options.nearMiss ?? 0;
  if (!Number.isFinite(nearMiss) || nearMiss < 0 || nearMiss > CROSSING_LIMITS.nearMiss)
    throw new Error(`nearMiss must be between 0 and ${CROSSING_LIMITS.nearMiss}`);
  let byTolerance = cache.get(paths);
  const hit = byTolerance?.get(nearMiss);
  if (hit) return hit;
  const result = search(paths, nearMiss);
  if (!byTolerance) cache.set(paths, byTolerance = new Map());
  if (byTolerance.size >= 4) byTolerance.delete(byTolerance.keys().next().value!);
  byTolerance.set(nearMiss, result);
  return result;
}

function search(input: readonly Path[], nearMiss: number): CrossingSet {
  const { paths, ix, iy } = resolve(input);
  const pathCount = paths.length;
  // Segment table.
  const counts = paths.map((path, i) => path.closed ? ix[i].length : ix[i].length - 1);
  const first = new Int32Array(pathCount + 1);
  for (let i = 0; i < pathCount; i++) first[i + 1] = first[i] + counts[i];
  const n = first[pathCount];
  const x0 = new Float64Array(n), y0 = new Float64Array(n), x1 = new Float64Array(n), y1 = new Float64Array(n);
  const owner = new Int32Array(n), local = new Int32Array(n);
  // Cumulative arc length per vertex (canvas units); closed paths carry a final entry for the full loop.
  const cum: Float64Array[] = [];
  let totalLength = 0;
  for (let p = 0; p < pathCount; p++) {
    const xs = ix[p], ys = iy[p], vertexCount = xs.length, c = new Float64Array(vertexCount + 1);
    for (let k = 0; k < counts[p]; k++) {
      const s = first[p] + k, b = (k + 1) % vertexCount;
      x0[s] = xs[k]; y0[s] = ys[k]; x1[s] = xs[b]; y1[s] = ys[b]; owner[s] = p; local[s] = k;
      c[k + 1] = c[k] + Math.hypot(xs[b] - xs[k], ys[b] - ys[k]) / SCALE;
    }
    cum.push(c); totalLength += c[counts[p]];
  }
  const lengths = paths.map((_, p) => cum[p][counts[p]]);

  // Uniform grid over (inflated) segment boxes.
  const inflate = Math.ceil(nearMiss * SCALE / 2);
  const cell = Math.max(8 * SCALE, Math.min(200 * SCALE, Math.ceil(2 * totalLength * SCALE / Math.max(1, n))));
  const lowX = new Int32Array(n), lowY = new Int32Array(n), highX = new Int32Array(n), highY = new Int32Array(n);
  const grid = new Map<number, number[]>();
  let entries = 0;
  const cellKey = (cx: number, cy: number) => (cx + 32768) * 65536 + (cy + 32768);
  for (let s = 0; s < n; s++) {
    lowX[s] = Math.min(x0[s], x1[s]) - inflate; highX[s] = Math.max(x0[s], x1[s]) + inflate;
    lowY[s] = Math.min(y0[s], y1[s]) - inflate; highY[s] = Math.max(y0[s], y1[s]) + inflate;
    const ax = Math.floor(lowX[s] / cell), bx = Math.floor(highX[s] / cell), ay = Math.floor(lowY[s] / cell), by = Math.floor(highY[s] / cell);
    entries += (bx - ax + 1) * (by - ay + 1);
    if (entries > CROSSING_LIMITS.gridEntries)
      throw new Error(`Crossing search grid would need more than ${CROSSING_LIMITS.gridEntries} entries; lower the corner cuts or use shorter, denser-free paths`);
    for (let cx = ax; cx <= bx; cx++) for (let cy = ay; cy <= by; cy++) {
      const key = cellKey(cx, cy), list = grid.get(key);
      if (list) list.push(s); else grid.set(key, [s]);
    }
  }

  const proper: { a: number; b: number; t: number; u: number }[] = [];
  const rawContacts = new Map<string, RawContact>();
  interface Candidate { a: number; b: number; distance: number; ax: number; ay: number; bx: number; by: number; hit: boolean }
  const candidates: Candidate[] = [];
  let tests = 0;
  const adjacent = (a: number, b: number) => {
    const p = owner[a];
    if (p !== owner[b]) return false;
    const d = Math.abs(local[a] - local[b]);
    return d === 1 || (paths[p].closed && d === counts[p] - 1);
  };
  const positionOf = (segment: number, endpointX: number, endpointY: number): Position => {
    if (x0[segment] === endpointX && y0[segment] === endpointY) return { vertex: true, index: local[segment] };
    if (x1[segment] === endpointX && y1[segment] === endpointY) return { vertex: true, index: (local[segment] + 1) % ix[owner[segment]].length };
    return { vertex: false, index: local[segment] };
  };
  const addContact = (a: number, b: number, x: number, y: number) => {
    let pa = owner[a], pb = owner[b], posA = positionOf(a, x, y), posB = positionOf(b, x, y);
    const ka = `${pa}:${posA.vertex ? "v" : "s"}${posA.index}`, kb = `${pb}:${posB.vertex ? "v" : "s"}${posB.index}`;
    if (ka > kb) { [pa, pb, posA, posB] = [pb, pa, posB, posA]; }
    const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    if (!rawContacts.has(key)) rawContacts.set(key, { pa, posA, pb, posB, x, y });
  };
  const pointSegmentDistance = (px: number, py: number, s: number): [number, number, number] => {
    const dx = x1[s] - x0[s], dy = y1[s] - y0[s], len2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((px - x0[s]) * dx + (py - y0[s]) * dy) / len2));
    const qx = x0[s] + t * dx, qy = y0[s] + t * dy;
    return [Math.hypot(px - qx, py - qy) / SCALE, qx, qy];
  };

  for (const [key, list] of grid) {
    const cx = Math.floor(key / 65536) - 32768, cy = (key % 65536) - 32768;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      // Each pair is handled once, in the cell holding the lower-left corner of its box overlap.
      if (Math.floor(Math.max(lowX[a], lowX[b]) / cell) !== cx || Math.floor(Math.max(lowY[a], lowY[b]) / cell) !== cy) continue;
      if (highX[a] < lowX[b] || highX[b] < lowX[a] || highY[a] < lowY[b] || highY[b] < lowY[a]) continue;
      if (adjacent(a, b)) continue;
      if (++tests > CROSSING_LIMITS.pairTests)
        throw new Error(`Crossing search would test more than ${CROSSING_LIMITS.pairTests} segment pairs; lower the corner cuts or the number of strands`);
      const o1 = orient(x0[a], y0[a], x1[a], y1[a], x0[b], y0[b]), o2 = orient(x0[a], y0[a], x1[a], y1[a], x1[b], y1[b]);
      const o3 = orient(x0[b], y0[b], x1[b], y1[b], x0[a], y0[a]), o4 = orient(x0[b], y0[b], x1[b], y1[b], x1[a], y1[a]);
      let hit = false;
      if (o1 * o2 < 0 && o3 * o4 < 0) {
        const dax = x1[a] - x0[a], day = y1[a] - y0[a], dbx = x1[b] - x0[b], dby = y1[b] - y0[b];
        const den = cross(dax, day, dbx, dby), wx = x0[b] - x0[a], wy = y0[b] - y0[a];
        proper.push({ a, b, t: cross(wx, wy, dbx, dby) / den, u: cross(wx, wy, dax, day) / den });
        hit = true;
      } else if (o1 * o2 <= 0 && o3 * o4 <= 0) {
        // Every remaining intersection has an endpoint of one segment on the other.
        if (o1 === 0 && within(x0[a], x1[a], x0[b]) && within(y0[a], y1[a], y0[b])) { addContact(a, b, x0[b], y0[b]); hit = true; }
        if (o2 === 0 && within(x0[a], x1[a], x1[b]) && within(y0[a], y1[a], y1[b])) { addContact(a, b, x1[b], y1[b]); hit = true; }
        if (o3 === 0 && within(x0[b], x1[b], x0[a]) && within(y0[b], y1[b], y0[a])) { addContact(a, b, x0[a], y0[a]); hit = true; }
        if (o4 === 0 && within(x0[b], x1[b], x1[a]) && within(y0[b], y1[b], y1[a])) { addContact(a, b, x1[a], y1[a]); hit = true; }
      }
      if (nearMiss > 0) {
        if (hit) candidates.push({ a, b, distance: 0, ax: 0, ay: 0, bx: 0, by: 0, hit: true });
        else {
          const p = owner[a];
          // A stretch of one path close to a later part of itself is curvature, not a near miss.
          let far = true;
          if (p === owner[b]) {
            const separation = Math.abs(cum[p][local[a]] - cum[p][local[b]]);
            far = Math.min(separation, paths[p].closed ? lengths[p] - separation : Infinity) >= 4 * nearMiss;
          }
          if (far) {
            let best: Candidate | null = null;
            for (const [px, py, on] of [[x0[a], y0[a], b], [x1[a], y1[a], b], [x0[b], y0[b], a], [x1[b], y1[b], a]] as const) {
              const [distance, qx, qy] = pointSegmentDistance(px, py, on);
              if (distance < nearMiss && (!best || distance < best.distance))
                best = on === b ? { a, b, distance, ax: px, ay: py, bx: qx, by: qy, hit: false } : { a, b, distance, ax: qx, ay: qy, bx: px, by: py, hit: false };
            }
            if (best) candidates.push(best);
          }
        }
      }
    }
  }

  // Arc length of a resolved position on a path.
  const arc = (p: number, position: Position, x: number, y: number): { s: number; segment: number; t: number } => {
    const k = position.index;
    if (position.vertex) return { s: cum[p][k], segment: k, t: 0 };
    const s = first[p] + k, dx = x1[s] - x0[s], dy = y1[s] - y0[s];
    const t = ((x - x0[s]) * dx + (y - y0[s]) * dy) / (dx * dx + dy * dy);
    return { s: cum[p][k] + t * (cum[p][k + 1] - cum[p][k]), segment: k, t };
  };
  const unit = (dx: number, dy: number): Point => { const l = Math.hypot(dx, dy); return Object.freeze([dx / l, dy / l] as const); };
  /** Vectors from the meeting point to the previous and next vertex; NaN where an open path has no such neighbour. */
  const rays = (p: number, position: Position, x: number, y: number): [number, number, number, number] => {
    const xs = ix[p], ys = iy[p], count = xs.length, k = position.index;
    if (!position.vertex) { const s = first[p] + k; return [x0[s] - x, y0[s] - y, x1[s] - x, y1[s] - y]; }
    if (!paths[p].closed && k === 0) return [NaN, NaN, xs[1] - x, ys[1] - y];
    if (!paths[p].closed && k === count - 1) return [xs[k - 1] - x, ys[k - 1] - y, NaN, NaN];
    const before = (k + count - 1) % count, after = (k + 1) % count;
    return [xs[before] - x, ys[before] - y, xs[after] - x, ys[after] - y];
  };
  const tangentAt = (p: number, position: Position, x: number, y: number, ray: readonly number[]): Point => {
    if (!position.vertex) { const s = first[p] + position.index; return unit(x1[s] - x0[s], y1[s] - y0[s]); }
    const a = unit(ray[0], ray[1]), b = unit(ray[2], ray[3]);
    return unit(b[0] - a[0], b[1] - a[1]);
  };
  const brief = (p: number, position: Position, x: number, y: number) => Object.freeze({ path: p, pathId: paths[p].id, s: arc(p, position, x, y).s });

  interface Draft { pa: number; sa: number; pb: number; sb: number; build: () => Crossing }
  const drafts: Draft[] = [];
  const order = (pa: number, sa: number, pb: number, sb: number) => pa < pb || (pa === pb && sa <= sb);
  const make = (kind: Crossing["kind"], x: number, y: number, pa: number, ta: Point, sa: { s: number; segment: number; t: number },
    pb: number, tb: Point, sb: { s: number; segment: number; t: number }): Draft => {
    const swap = !order(pa, sa.s, pb, sb.s);
    const [p1, s1, t1, p2, s2, t2] = swap ? [pb, sb, tb, pa, sa, ta] : [pa, sa, ta, pb, sb, tb];
    return { pa: p1, sa: s1.s, pb: p2, sb: s2.s, build: () => {
      const sideOf = (p: number, arcInfo: { s: number; segment: number; t: number }, tangent: Point): CrossingSide =>
        Object.freeze({ path: p, pathId: paths[p].id, s: arcInfo.s, segment: arcInfo.segment, t: arcInfo.t, tangent });
      const firstSide = sideOf(p1, s1, t1), secondSide = sideOf(p2, s2, t2);
      return Object.freeze({
        id: `${firstSide.pathId}@${firstSide.s.toFixed(3)}~${secondSide.pathId}@${secondSide.s.toFixed(3)}`,
        index: -1, kind, point: Object.freeze([x / SCALE, y / SCALE] as const), first: firstSide, second: secondSide,
        sine: Math.min(1, Math.abs(cross(t1[0], t1[1], t2[0], t2[1]))), self: p1 === p2,
      }) as Crossing;
    } };
  };
  for (const { a, b, t, u } of proper) {
    const x = x0[a] + t * (x1[a] - x0[a]), y = y0[a] + t * (y1[a] - y0[a]);
    const pa = owner[a], pb = owner[b];
    const sa = { s: cum[pa][local[a]] + t * (cum[pa][local[a] + 1] - cum[pa][local[a]]), segment: local[a], t };
    const sb = { s: cum[pb][local[b]] + u * (cum[pb][local[b] + 1] - cum[pb][local[b]]), segment: local[b], t: u };
    drafts.push(make("transversal", x, y, pa, unit(x1[a] - x0[a], y1[a] - y0[a]), sa, pb, unit(x1[b] - x0[b], y1[b] - y0[b]), sb));
  }
  const contacts: Contact[] = [];
  for (const raw of rawContacts.values()) {
    const { pa, posA, pb, posB, x, y } = raw;
    const ra = rays(pa, posA, x, y), rb = rays(pb, posB, x, y);
    const pair = { first: brief(pa, posA, x, y), second: brief(pb, posB, x, y) };
    const point = Object.freeze([x / SCALE, y / SCALE] as const);
    const overlap = sameDirection(ra[0], ra[1], rb[0], rb[1]) || sameDirection(ra[0], ra[1], rb[2], rb[3]) ||
      sameDirection(ra[2], ra[3], rb[0], rb[1]) || sameDirection(ra[2], ra[3], rb[2], rb[3]);
    if (overlap) { contacts.push(Object.freeze({ kind: "overlap", point, ...pair })); continue; }
    if (ra.includes(NaN) || rb.includes(NaN)) { contacts.push(Object.freeze({ kind: "terminal", point, ...pair })); continue; }
    const spike = sameDirection(ra[0], ra[1], ra[2], ra[3]) || sameDirection(rb[0], rb[1], rb[2], rb[3]);
    const separated = !spike && strictlyInside(ra[0], ra[1], ra[2], ra[3], rb[0], rb[1]) !== strictlyInside(ra[0], ra[1], ra[2], ra[3], rb[2], rb[3]);
    if (!separated) { contacts.push(Object.freeze({ kind: "tangent", point, ...pair })); continue; }
    drafts.push(make("vertex", x, y, pa, tangentAt(pa, posA, x, y, ra), arc(pa, posA, x, y), pb, tangentAt(pb, posB, x, y, rb), arc(pb, posB, x, y)));
  }
  if (drafts.length > CROSSING_LIMITS.crossings)
    throw new Error(`Found ${drafts.length} crossings; the limit is ${CROSSING_LIMITS.crossings}. Lower the strand count or density`);
  drafts.sort((p, q) => p.pa - q.pa || p.sa - q.sa || p.pb - q.pb || p.sb - q.sb);
  const crossings = drafts.map((draft, index) => Object.freeze({ ...draft.build(), index }) as Crossing);
  contacts.sort((p, q) => p.first.path - q.first.path || p.first.s - q.first.s || p.second.path - q.second.path || p.second.s - q.second.s);

  const misses: NearMiss[] = [];
  if (nearMiss > 0 && candidates.length) {
    const byKey = new Map<string, number>();
    const cluster = Int32Array.from(candidates, (_, i) => i);
    const find = (i: number): number => { while (cluster[i] !== i) { cluster[i] = cluster[cluster[i]]; i = cluster[i]; } return i; };
    const slot = (a: number, b: number) => `${a}|${b}`;
    const wrap = (p: number, s: number, d: number) => {
      const k = local[s] + d, count = counts[p];
      return paths[p].closed ? first[p] + ((k % count) + count) % count : k >= 0 && k < count ? first[p] + k : -1;
    };
    candidates.forEach((c, i) => byKey.set(slot(c.a, c.b), i));
    candidates.forEach((c, i) => {
      const pa = owner[c.a], pb = owner[c.b];
      for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) {
        if (!da && !db) continue;
        const na = wrap(pa, c.a, da), nb = wrap(pb, c.b, db);
        if (na < 0 || nb < 0) continue;
        const other = byKey.get(slot(na, nb)) ?? byKey.get(slot(nb, na));
        if (other !== undefined) cluster[find(i)] = find(other);
      }
    });
    const groups = new Map<number, Candidate[]>();
    candidates.forEach((c, i) => { const root = find(i), list = groups.get(root); if (list) list.push(c); else groups.set(root, [c]); });
    for (const members of groups.values()) {
      if (members.some((member) => member.hit)) continue;
      const best = members.reduce((low, member) => member.distance < low.distance ? member : low);
      const pa = owner[best.a], pb = owner[best.b];
      const sa = arc(pa, { vertex: false, index: local[best.a] }, best.ax, best.ay), sb = arc(pb, { vertex: false, index: local[best.b] }, best.bx, best.by);
      const one = { path: pa, pathId: paths[pa].id, s: sa.s }, two = { path: pb, pathId: paths[pb].id, s: sb.s };
      const swap = !order(pa, sa.s, pb, sb.s);
      misses.push(Object.freeze({ point: Object.freeze([(best.ax + best.bx) / 2 / SCALE, (best.ay + best.by) / 2 / SCALE] as const),
        distance: best.distance, first: Object.freeze(swap ? two : one), second: Object.freeze(swap ? one : two), pairs: members.length }));
    }
    misses.sort((p, q) => p.first.path - q.first.path || p.first.s - q.first.s || p.second.path - q.second.path || p.second.s - q.second.s);
  }
  return Object.freeze({ paths: Object.freeze(paths), lengths: Object.freeze(lengths), crossings: Object.freeze(crossings),
    contacts: Object.freeze(contacts), nearMisses: Object.freeze(misses), nearMiss });
}
