import type { Point } from "./types.js";

/**
 * Arc-length lookup on an explicit polyline: the one place that turns "a distance along a path" into
 * a position and direction. Branch Ornament's flank marks and Path Typography's glyph frames both
 * read it, so a frame at arc length `s` means the same thing in both.
 *
 * INPUT. A polyline (`points`, at least two, finite) and whether it is closed. A closed polyline has
 * one more segment, from the last vertex back to the first; a repeated closing vertex is not
 * expected (`arcTable` throws on it rather than guess, use `closedRing` to drop it first).
 * Zero-length segments are allowed in the table; they are never selected except as the final segment
 * of an open path, where the position is that vertex and the direction is `atan2(0, 0) = 0`.
 *
 * OUTPUT. `arcTable` returns a frozen table: per-segment lengths and headings (radians, canvas axes:
 * +x right, +y down, so positive turns are clockwise on screen) and cumulative arc length at each
 * vertex (`cumulative[k]` is the arc length at vertex `k`; a closed table has an extra entry equal to
 * the total). `arcPointAt(table, s)` gives the position and segment heading at arc length `s`. Open
 * paths clamp `s` to `[0, length]`; closed paths wrap it modulo the length. `arcTurn(table, a, b)`
 * sums the exterior angles at the vertices strictly between `a` and `b`, the signed sum (positive is
 * clockwise on screen) and the total variation, so an S-bend has small signed and large total turn.
 *
 * Ownership: tables are cached by point array and closure; results are frozen and never mutated.
 * Cost: `arcTable` is linear in the vertices, every lookup logarithmic. No randomness, no work
 * budget (callers bound the vertex count they pass).
 */
export interface ArcTable {
  readonly points: readonly Point[];
  readonly closed: boolean;
  /** Segment `k` runs from vertex `k` to vertex `k + 1` (wrapping when closed). */
  readonly lengths: readonly number[];
  readonly headings: readonly number[];
  /** Arc length at each vertex, plus the total at the end of a closed table. */
  readonly cumulative: readonly number[];
  readonly length: number;
}

export interface ArcPoint {
  readonly x: number;
  readonly y: number;
  /** Direction of the segment the position lies on, radians. */
  readonly heading: number;
  readonly segment: number;
}

const tables = new WeakMap<readonly Point[], { open?: ArcTable; closed?: ArcTable }>();

export function arcTable(points: readonly Point[], closed: boolean): ArcTable {
  const cached = tables.get(points)?.[closed ? "closed" : "open"];
  if (cached) return cached;
  if (!Array.isArray(points) || points.length < 2) throw new Error("A path needs at least two points");
  for (const point of points)
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) throw new Error("Path points must be finite");
  const count = points.length, segments = closed ? count : count - 1;
  if (closed && count < 3) throw new Error("A closed path needs at least three points");
  if (closed && points[0][0] === points[count - 1][0] && points[0][1] === points[count - 1][1])
    throw new Error("A closed path must not repeat its first point at the end");
  const lengths: number[] = [], headings: number[] = [], cumulative: number[] = [0];
  let walked = 0;
  for (let k = 0; k < segments; k++) {
    const a = points[k], b = points[(k + 1) % count];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lengths.push(length);
    headings.push(Math.atan2(b[1] - a[1], b[0] - a[0]));
    walked += length;
    cumulative.push(walked);
  }
  const table: ArcTable = Object.freeze({ points, closed, lengths: Object.freeze(lengths), headings: Object.freeze(headings),
    cumulative: Object.freeze(cumulative), length: walked });
  const entry = tables.get(points) ?? {};
  entry[closed ? "closed" : "open"] = table;
  tables.set(points, entry);
  return table;
}

/** A closed ring without a repeated closing vertex (the form `arcTable` takes). */
export function closedRing(points: readonly Point[]): readonly Point[] {
  const last = points[points.length - 1], first = points[0];
  return points.length > 1 && first[0] === last[0] && first[1] === last[1] ? points.slice(0, -1) : points;
}

/** Smallest segment `k <= max` whose end arc length exceeds `s`; `max` when none does. */
function segmentAt(table: ArcTable, s: number, max: number): number {
  const { cumulative } = table;
  let low = 0, high = max;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (cumulative[mid + 1] > s) high = mid; else low = mid + 1;
  }
  return low;
}

export function arcPointAt(table: ArcTable, s: number): ArcPoint {
  const { points, closed, lengths, headings, cumulative } = table;
  const segments = lengths.length;
  if (!Number.isFinite(s)) throw new Error("Arc length must be finite");
  let at = s;
  if (closed) { at = s % table.length; if (at < 0) at += table.length; }
  const segment = segmentAt(table, at, segments - 1);
  const a = points[segment], b = points[(segment + 1) % points.length];
  const run = lengths[segment], t = run > 0 ? Math.min(1, Math.max(0, (at - cumulative[segment]) / run)) : 0;
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, heading: headings[segment], segment };
}

const wrapPi = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Exterior angles at the vertices strictly between arc lengths `a < b`: signed sum and total variation. */
export function arcTurn(table: ArcTable, a: number, b: number): { readonly signed: number; readonly total: number } {
  if (!(b > a)) return { signed: 0, total: 0 };
  const { closed, headings, cumulative } = table, segments = headings.length, length = table.length;
  let signed = 0, total = 0;
  if (!closed) {
    // Interior vertex k (1 .. segments - 1) joins segments k - 1 and k at arc cumulative[k].
    for (let k = segmentAt(table, a, segments - 1) + 1; k < segments && cumulative[k] < b; k++) {
      if (cumulative[k] <= a) continue;
      const turn = wrapPi(headings[k] - headings[k - 1]);
      signed += turn; total += Math.abs(turn);
    }
    return { signed, total };
  }
  // Closed: vertex k joins segments k - 1 (mod n) and k at arc cumulative[k] + m * length.
  const base = Math.floor(a / length);
  for (let lap = base; lap * length < b; lap++) {
    for (let k = 0; k < segments; k++) {
      const at = cumulative[k] + lap * length;
      if (at <= a) continue;
      if (at >= b) break;
      const turn = wrapPi(headings[k] - headings[(k + segments - 1) % segments]);
      signed += turn; total += Math.abs(turn);
    }
  }
  return { signed, total };
}

/**
 * The polyline between arc lengths `a <= b`: the start position, every vertex strictly between, the
 * end position. A closed table wraps, and `b - a` may not exceed one lap. Consecutive duplicates
 * (a span that starts or ends on a vertex) are not repeated.
 */
export function arcSpan(table: ArcTable, a: number, b: number): Point[] {
  if (!(b >= a)) throw new Error("Arc span must run forward");
  if (table.closed && b - a > table.length + 1e-9) throw new Error("A span cannot be longer than one lap of a closed path");
  const start = arcPointAt(table, a), out: Point[] = [[start.x, start.y]];
  const { closed, cumulative } = table, segments = table.lengths.length;
  const push = (x: number, y: number) => {
    const last = out[out.length - 1];
    if (last[0] !== x || last[1] !== y) out.push([x, y]);
  };
  if (!closed) {
    for (let k = segmentAt(table, a, segments - 1) + 1; k <= segments && cumulative[k] < b; k++)
      if (cumulative[k] > a) push(table.points[k][0], table.points[k][1]);
  } else {
    const base = Math.floor(a / table.length);
    for (let lap = base; lap * table.length < b; lap++)
      for (let k = 0; k < segments; k++) {
        const at = cumulative[k] + lap * table.length;
        if (at <= a) continue;
        if (at >= b) break;
        push(table.points[k][0], table.points[k][1]);
      }
  }
  const end = arcPointAt(table, b);
  push(end.x, end.y);
  return out;
}
