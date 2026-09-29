import { PlanarError, charge, checkCoordinate, orient, type Pt, type Work } from "./planar-kernel.js";
import { edgeIndex, locateIndexed, type EdgeIndex } from "./domains-index.js";
import { derivedPath, resolveShape, workFor, cleanRing, type PlanarDomain, type PlanarOptions, type PlanarRegion, type PlanarShape } from "./domains.js";
import type { Path, Point } from "./types.js";

/**
 * Clipping of open and closed paths to a region, and scan-line hatching of a region. Both respect
 * holes and every ring of a multi-region domain.
 *
 * CLIPPING. A path segment is cut at every point where it crosses, touches or runs along the
 * boundary, found by exact predicates (only the position of a computed crossing is rounded). Each
 * resulting interval is classified: an interval that runs along a boundary edge is BOUNDARY, other
 * intervals by the location of their midpoint. The region is the closed set, so boundary intervals
 * belong to it: `keep: "inside"` keeps inside and boundary intervals, `keep: "outside"` keeps the rest,
 * and the two results partition the path (only zero-length pieces, the cut points themselves, are lost).
 * Consecutive kept intervals are joined into one polyline, also across path vertices and, for a closed
 * path, across its start.
 *
 * HATCH. Lines run in direction `angle` (degrees, counter-clockwise from +x, y up) at perpendicular
 * offsets `(k + phase) × spacing` from `origin`, for every integer `k`: line indices are anchored
 * to the origin, not to the region, so `id`s are stable when the region changes and equal lines of
 * two different regions align. A line is treated as lying infinitesimally to the left of its
 * direction (the +normal side): an edge is crossed when `min(v) ≤ line < max(v)`, so a line exactly
 * along a horizontal boundary edge is kept iff the region lies on that +normal side, and a line
 * through a vertex is never double counted. Zero-length strokes are dropped.
 */
export interface ClippedPiece {
  /** `<options.id ?? "path">#<n>`, numbered in path order. */
  readonly id: string;
  readonly points: readonly Point[];
  readonly closed: boolean;
  /** Start and end as path parameters: segment index plus fraction along it (closed paths use the closing segment too). */
  readonly from: number;
  readonly to: number;
}
export interface ClipOptions extends PlanarOptions {
  /** Treat the points as a closed ring (an implicit segment joins the last to the first point). Default false. */
  readonly closed?: boolean;
  readonly keep?: "inside" | "outside";
}

/**
 * Cut parameters and boundary-run intervals of one path segment against the whole boundary.
 * Returns a bit set: 1 when the segment's start lies on the boundary, 2 when its end does.
 */
function cutSegment(px: number, py: number, qx: number, qy: number, index: EdgeIndex, work: Work, cuts: number[], runs: number[]): number {
  const { edges, cells, gx, gy, minX, minY, maxX, maxY, cellW, cellH, stamp } = index;
  const dx = qx - px, dy = qy - py, length2 = dx * dx + dy * dy;
  const project = (x: number, y: number): number => Math.min(1, Math.max(0, ((x - px) * dx + (y - py) * dy) / length2));
  const cx = (x: number) => Math.min(gx - 1, Math.max(0, Math.floor((x - minX) / cellW)));
  const cy = (y: number) => Math.min(gy - 1, Math.max(0, Math.floor((y - minY) / cellH)));
  const x0 = cx(Math.min(px, qx)), x1 = cx(Math.max(px, qx)), y0 = cy(Math.min(py, qy)), y1 = cy(Math.max(py, qy));
  const clock = ++index.clock;
  let touch = 0;
  if (Math.max(px, qx) < minX || Math.min(px, qx) > maxX || Math.max(py, qy) < minY || Math.min(py, qy) > maxY) return 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const list = cells[y * gx + x];
    charge(work, list.length + 1);
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (stamp[e] === clock) continue;
      stamp[e] = clock;
      const ax = edges[4 * e], ay = edges[4 * e + 1], bx = edges[4 * e + 2], by = edges[4 * e + 3];
      if (Math.max(ax, bx) < Math.min(px, qx) || Math.min(ax, bx) > Math.max(px, qx) || Math.max(ay, by) < Math.min(py, qy) || Math.min(ay, by) > Math.max(py, qy)) continue;
      const o1 = orient(px, py, qx, qy, ax, ay), o2 = orient(px, py, qx, qy, bx, by);
      if ((o1 > 0 && o2 > 0) || (o1 < 0 && o2 < 0)) continue;
      const o3 = orient(ax, ay, bx, by, px, py), o4 = orient(ax, ay, bx, by, qx, qy);
      if ((o3 > 0 && o4 > 0) || (o3 < 0 && o4 < 0)) continue;
      if (o1 === 0 && o2 === 0) {
        const ta = project(ax, ay), tb = project(bx, by), lo = Math.min(ta, tb), hi = Math.max(ta, tb);
        // Collinear: the shared stretch (if any) runs along the boundary.
        const overlapLo = Math.max(0, lo), overlapHi = Math.min(1, hi);
        if (overlapLo < overlapHi) { runs.push(overlapLo, overlapHi); cuts.push(overlapLo, overlapHi); }
        else if (overlapLo === overlapHi) cuts.push(overlapLo);
        if (overlapLo <= overlapHi) { if (overlapLo === 0) touch |= 1; if (overlapHi === 1) touch |= 2; }
      } else if (o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) {
        const ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex;
        let t = ((ax - px) * ey - (ay - py) * ex) / den;
        if (!(t >= 0)) t = 0; else if (t > 1) t = 1;
        cuts.push(t);
      } else {
        if (o1 === 0) cuts.push(project(ax, ay));
        if (o2 === 0) cuts.push(project(bx, by));
        if (o3 === 0) touch |= 1;
        if (o4 === 0) touch |= 2;
      }
    }
  }
  return touch;
}

/**
 * Clip a polyline (or closed ring) to a shape. Returns frozen pieces; see the header for the
 * boundary rule and the partition property. Work is charged per candidate boundary edge tested and
 * bounded by `options.maxWork`.
 */
export function clipPath(points: readonly (readonly [number, number])[], shape: PlanarShape, options: ClipOptions = {}): readonly ClippedPiece[] {
  const closed = options.closed ?? false;
  const keep = options.keep ?? "inside";
  if (keep !== "inside" && keep !== "outside") throw new PlanarError("INVALID_INPUT", `options.keep must be "inside" or "outside"`);
  const work = workFor("clipPath", options);
  const ring = cleanRing("points", points, closed ? 3 : 2);
  const domain = resolveShape(shape, 0, work);
  const name = options.id ?? "path";
  const path: Pt[] = closed ? [...ring, ring[0]] : ring;
  const segments = path.length - 1;
  const index = edgeIndex(domain);
  const pieces: { pts: Pt[]; from: number; to: number }[] = [];
  let current: { pts: Pt[]; from: number; to: number } | null = null;
  let dropped = false;
  // Classification of the previous interval's end and whether its end vertex lies on the boundary:
  // a segment that touches no boundary keeps the class of the point before it, so no location query is needed.
  let carried: boolean | null = null, carriedTouch = true;
  for (let s = 0; s < segments; s++) {
    const [px, py] = path[s], [qx, qy] = path[s + 1];
    const cuts: number[] = [0, 1], runs: number[] = [];
    const touch = index.count > 0 ? cutSegment(px, py, qx, qy, index, work, cuts, runs) : 0;
    cuts.sort((a, b) => a - b);
    const free = cuts.length === 2 && touch === 0 && !carriedTouch && carried !== null;
    for (let c = 0; c + 1 < cuts.length; c++) {
      const t0 = cuts[c], t1 = cuts[c + 1];
      if (!(t1 > t0)) continue;
      const tm = (t0 + t1) / 2;
      let inside = false;
      if (free) inside = carried!;
      else {
        for (let r = 0; r < runs.length; r += 2) if (tm >= runs[r] && tm <= runs[r + 1]) { inside = true; break; }
        if (!inside) inside = locateIndexed(index, px + (qx - px) * tm, py + (qy - py) * tm, work) >= 0;
      }
      carried = inside;
      if (inside !== (keep === "inside")) { dropped = true; if (current) { pieces.push(current); current = null; } continue; }
      const start: Pt = t0 === 0 ? [px, py] : [px + (qx - px) * t0, py + (qy - py) * t0];
      const end: Pt = t1 === 1 ? [qx, qy] : [px + (qx - px) * t1, py + (qy - py) * t1];
      const last = current?.pts[current.pts.length - 1];
      if (current && last && last[0] === start[0] && last[1] === start[1]) { current.pts.push(end); current.to = s + t1; }
      else {
        if (current) pieces.push(current);
        current = { pts: [start, end], from: s + t0, to: s + t1 };
      }
    }
    carriedTouch = (touch & 2) !== 0;
  }
  if (current) pieces.push(current);
  if (closed && pieces.length > 1 && pieces[0].from === 0 && pieces[pieces.length - 1].to === segments) {
    const first = pieces.shift()!, last = pieces[pieces.length - 1];
    last.pts.push(...first.pts.slice(1)); last.to = first.to + segments;
  }
  if (closed && !dropped && pieces.length === 1 && pieces[0].from === 0 && pieces[0].to === segments) {
    const only = pieces[0].pts;
    return Object.freeze([Object.freeze({ id: `${name}#0`, points: Object.freeze(only.slice(0, -1).map((p) => Object.freeze([p[0], p[1]] as const))), closed: true, from: 0, to: segments })]);
  }
  const out = pieces.filter((piece) => piece.pts.some((p) => p[0] !== piece.pts[0][0] || p[1] !== piece.pts[0][1]));
  return Object.freeze(out.map((piece, n) => Object.freeze({
    id: `${name}#${n}`, points: Object.freeze(piece.pts.map((p) => Object.freeze([p[0], p[1]] as const))), closed: false, from: piece.from, to: piece.to,
  })));
}

/**
 * Clip composition `Path`s. A path that is not cut at all is returned as the SAME object (stable id);
 * a cut path is replaced by pieces named `<id>#<n>` whose seeds are `componentSeed(path.seed, path.id, "clip")`
 * and which keep `level`, `levelFraction` and `tone`. Work is shared across all paths.
 */
export function clipPaths(paths: readonly Path[], shape: PlanarShape, options: Omit<ClipOptions, "closed" | "id"> = {}): readonly Path[] {
  const work = workFor("clipPaths", options);
  const domain = resolveShape(shape, 0, work);
  const out: Path[] = [];
  for (const path of paths) {
    work.cancel?.();
    const pieces = clipPath(path.points as readonly (readonly [number, number])[], domain, { ...options, closed: path.closed, id: path.id, maxWork: Math.max(1, work.limit - work.count) });
    if (pieces.length === 1 && (pieces[0].closed === path.closed) && pieces[0].points.length === path.points.length && pieces[0].points.every((p, i) => p[0] === path.points[i][0] && p[1] === path.points[i][1])) {
      out.push(path);
      continue;
    }
    pieces.forEach((piece, n) => out.push(derivedPath(path, n, piece.points, piece.closed, "clip")));
    work.count += 1;
  }
  return Object.freeze(out);
}

export interface HatchOptions extends PlanarOptions {
  /** Degrees counter-clockwise from +x (y up). Default 0. */
  readonly angle?: number;
  /** Distance between lines, > 0. */
  readonly spacing: number;
  /** Fractional offset of the line family, in units of `spacing` (default 0.5: lines never start on an axis-aligned boundary). */
  readonly phase?: number;
  /** Point the line family is measured from. Default [0, 0]. */
  readonly origin?: readonly [number, number];
  /** Most lines the family may cross the region's extent with. Default 200,000. */
  readonly maxLines?: number;
}
export interface HatchStroke {
  /** `<id>/h<line>#<n>` with `n` counting strokes along the line from the low-`u` end. */
  readonly id: string;
  /** Integer index of the line in the family: perpendicular offset `(line + phase) × spacing`. */
  readonly line: number;
  readonly points: readonly [Point, Point];
}
const AXIS: Record<number, [number, number]> = { 0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1] };

/** Scan-line hatch of a shape: one stroke per interval of each line inside the shape, holes excluded. Ordered by line then position. */
export function hatchDomain(shape: PlanarShape, options: HatchOptions): readonly HatchStroke[] {
  const spacing = checkCoordinate("options.spacing", options.spacing);
  if (!(spacing > 0)) throw new PlanarError("INVALID_INPUT", "options.spacing must be > 0");
  const phase = checkCoordinate("options.phase", options.phase ?? 0.5);
  const angle = checkCoordinate("options.angle", options.angle ?? 0);
  const origin = options.origin ?? [0, 0];
  const ox = checkCoordinate("options.origin[0]", origin[0]), oy = checkCoordinate("options.origin[1]", origin[1]);
  const maxLines = options.maxLines ?? 200_000;
  const work = workFor("hatchDomain", options);
  const domain = resolveShape(shape, 0, work);
  const regions = "regions" in domain ? domain.regions : [domain];
  const id = options.id ?? `hatch(${domain.id})`;
  const turn = ((angle % 360) + 360) % 360;
  const axis = AXIS[turn];
  const tx = axis ? axis[0] : Math.cos(turn * Math.PI / 180), ty = axis ? axis[1] : Math.sin(turn * Math.PI / 180);
  const nx = -ty, ny = tx;
  interface E { u1: number; v1: number; u2: number; v2: number; lo: number; hi: number }
  const edges: E[] = [];
  let vmin = Infinity, vmax = -Infinity;
  for (const region of regions) for (const ring of [region.outer, ...region.holes]) {
    const n = ring.length;
    const us = new Float64Array(n), vs = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const dx = ring[i][0] - ox, dy = ring[i][1] - oy;
      us[i] = dx * tx + dy * ty; vs[i] = dx * nx + dy * ny;
      if (vs[i] < vmin) vmin = vs[i];
      if (vs[i] > vmax) vmax = vs[i];
    }
    for (let i = 0, j = n - 1; i < n; j = i++) if (vs[j] !== vs[i]) edges.push({ u1: us[j], v1: vs[j], u2: us[i], v2: vs[i], lo: Math.min(vs[j], vs[i]), hi: Math.max(vs[j], vs[i]) });
  }
  if (edges.length === 0) return Object.freeze([]);
  const first = Math.ceil(vmin / spacing - phase) + 0, last = Math.floor(vmax / spacing - phase);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) throw new PlanarError("INVALID_INPUT", "spacing is too small for the region's extent");
  if (last - first + 1 > maxLines) throw new PlanarError("WORK_LIMIT", `Hatching needs ${last - first + 1} lines; the limit is ${maxLines}. Increase options.spacing or raise options.maxLines`);
  edges.sort((a, b) => a.lo - b.lo);
  const out: HatchStroke[] = [];
  let active: E[] = [], next = 0;
  const crossings: number[] = [];
  for (let k = first; k <= last; k++) {
    const line = (k + phase) * spacing;
    while (next < edges.length && edges[next].lo <= line) active.push(edges[next++]);
    let keep = 0;
    for (let a = 0; a < active.length; a++) if (line < active[a].hi) active[keep++] = active[a];
    active.length = keep;
    charge(work, active.length + 1);
    crossings.length = 0;
    for (const e of active) crossings.push(e.u1 + (line - e.v1) * (e.u2 - e.u1) / (e.v2 - e.v1));
    crossings.sort((a, b) => a - b);
    let n = 0;
    for (let c = 0; c + 1 < crossings.length; c += 2) {
      const a = crossings[c], b = crossings[c + 1];
      if (!(b > a)) continue;
      if (out.length >= 1_000_000) throw new PlanarError("WORK_LIMIT", "Hatching produced more than 1,000,000 strokes; increase options.spacing");
      out.push(Object.freeze({
        id: `${id}/h${k}#${n++}`, line: k,
        points: Object.freeze([
          Object.freeze([ox + a * tx + line * nx, oy + a * ty + line * ny] as const),
          Object.freeze([ox + b * tx + line * nx, oy + b * ty + line * ny] as const),
        ] as const),
      }));
    }
  }
  return Object.freeze(out);
}

/**
 * Winding-preserving clip of ONE ring to the rectangle `[0, width] × [0, height]` (Sutherland–Hodgman),
 * or `null` when fewer than three vertices remain. It keeps the winding number of every point
 * strictly inside the rectangle, so a font's rings clipped one by one still fill correctly under the
 * nonzero rule, and it is cheap and order-preserving. It is NOT a Boolean: the output may contain
 * edges along the rectangle boundary that double back and enclose no area (fill them, never stroke
 * them), overlapping rings stay overlapping, and vertices are neither merged nor deduplicated. Use
 * `domainIntersection` with `rectangleRegion` when a proper polygon result is needed.
 */
export function clipRingToRect(ring: readonly Point[], width: number, height: number): readonly Point[] | null {
  let points: Point[] = ring as Point[];
  const planes: Array<[(p: Point) => number, (a: Point, b: Point) => Point]> = [
    [(p) => p[0], (a, b) => [0, a[1] + (b[1] - a[1]) * (0 - a[0]) / (b[0] - a[0])]],
    [(p) => width - p[0], (a, b) => [width, a[1] + (b[1] - a[1]) * (width - a[0]) / (b[0] - a[0])]],
    [(p) => p[1], (a, b) => [a[0] + (b[0] - a[0]) * (0 - a[1]) / (b[1] - a[1]), 0]],
    [(p) => height - p[1], (a, b) => [a[0] + (b[0] - a[0]) * (height - a[1]) / (b[1] - a[1]), height]],
  ];
  for (const [distance, cut] of planes) {
    if (points.length === 0) return null;
    const next: Point[] = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[j], b = points[i], da = distance(a), db = distance(b);
      if (db >= 0) {
        if (da < 0) next.push(Object.freeze(cut(a, b)) as Point);
        next.push(b);
      } else if (da >= 0) next.push(Object.freeze(cut(a, b)) as Point);
    }
    points = next;
  }
  return points.length >= 3 ? Object.freeze(points) : null;
}
