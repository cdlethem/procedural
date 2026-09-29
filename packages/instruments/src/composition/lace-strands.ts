import { componentSeed } from "./core.js";
import { strandRoles } from "./crossing-order.js";
import type { CrossingOrder } from "./crossing-order.js";
import type { CrossingSet } from "./crossings.js";
import { crossingHalfGap, cumulativeLengths, cutPath } from "./strands.js";
import type { Path, Point, Site } from "./types.js";

/**
 * Strand pieces: every path cut open where it passes UNDER another, so strands read as woven.
 *
 * INPUT: a `CrossingSet`, its `CrossingOrder` and the drawn widths. `widths[i]` is the full stroke
 * width of path `i` (the outer width when a material draws a casing); a width of 0 means the path
 * is not drawn, so it neither opens gaps in others nor receives any. `reach[i]`, when given, is
 * used instead of `widths[i]` where path `i` is the UNDER strand: how far its marks extend past the
 * end of a piece across the stroke direction plus along it (a stitch dash reaches farther than its
 * weight), so a gap is always wide enough for the marks the material really draws.
 *
 * GAPS. At each crossing the under strand loses `crossingHalfGap(upper, lower, sine, clearance)`
 * of travel distance on each side of the crossing: the shared thread rule of Woven Strands
 * (`strands.ts`), which projects both strokes and the lower strand's round cap onto the lower path
 * and adds `clearance`. The gap therefore depends on widths, and pieces are cached by widths,
 * clearance and trim as well as by the order; the crossing table and order never depend on them.
 * Nothing overlaps: a stroke of the over strand crosses only a gap.
 *
 * FLAT CROSSINGS. A crossing shallower than `minAngle` degrees (|sin| below sin(minAngle)) would need
 * a gap of (w₁ + w₂) / (2·sin) on each side, which eats the whole strand as the paths approach
 * tangency. Such crossings are not woven: they stay in the crossing table and the order, cut no
 * gap and are listed in `Strands.flat`; the two strokes simply overlap there.
 *
 * CONFLICTS (reported, never hidden): when two gaps on one strand overlap because the widths or
 * clearance are too large for the crossing spacing they merge into one longer gap
 * (`merged`), a gap running past the end of an open strand shortens it (`end`), and a closed
 * strand with no piece left is `consumed`. Only the widths' own invalid values are errors.
 *
 * TRIM removes that much from both free ends of every open path (terminal treatment).
 *
 * IDS. A piece is `<pathId>#<u>` with `u` the number of under-crossings of that path before the
 * piece begins; widths, clearance and trim never rename a surviving piece. A closed path that is
 * never under anything is one closed piece `<pathId>#0`. Piece seeds are
 * `componentSeed(path.seed, id, "piece")`. Each piece keeps its path's `tone`, `level` and
 * `levelFraction`, so a material colors it by strand family.
 */
export interface StrandOptions {
  widths: readonly number[];
  /** Per path: extent of the under strand's marks past a piece end; defaults to `widths`. */
  reach?: readonly number[];
  clearance: number;
  /** Crossings shallower than this angle, in degrees, cut no gap. Default 0: weave everything. */
  minAngle?: number;
  /** Length removed from both ends of each open path. */
  trim?: number;
}
export interface StrandPiece extends Path {
  /** Index of the source path in `CrossingSet.paths`. */
  readonly source: number;
  /** Arc length along the source path at which the piece begins. */
  readonly start: number;
}
export interface StrandGap {
  readonly crossing: string;
  readonly path: number;
  readonly pathId: string;
  /** Arc-length interval removed from the under strand (may extend past the path's ends). */
  readonly from: number;
  readonly to: number;
}
export interface StrandConflict {
  readonly kind: "merged" | "end" | "consumed";
  readonly path: number;
  readonly pathId: string;
  readonly crossings: readonly string[];
}
export interface Strands {
  readonly pieces: readonly StrandPiece[];
  readonly gaps: readonly StrandGap[];
  readonly conflicts: readonly StrandConflict[];
  /** Ids of the crossings left unwoven because they are shallower than `minAngle`. */
  readonly flat: readonly string[];
}

const cache = new WeakMap<CrossingOrder, Map<string, Strands>>();

export function strandPieces(set: CrossingSet, order: CrossingOrder, options: StrandOptions): Strands {
  const { widths, clearance, trim = 0, reach = widths, minAngle = 0 } = options;
  if (widths.length !== set.paths.length || reach.length !== widths.length)
    throw new Error(`widths and reach need one entry per path (${set.paths.length}), got ${widths.length} and ${reach.length}`);
  for (const width of [...widths, ...reach]) if (!Number.isFinite(width) || width < 0 || width > 200) throw new Error("Strand widths must be finite and between 0 and 200");
  if (!Number.isFinite(clearance) || clearance < 0 || clearance > 200) throw new Error("Clearance must be finite and between 0 and 200");
  if (!Number.isFinite(trim) || trim < 0 || trim > 2000) throw new Error("Trim must be finite and between 0 and 2000");
  if (!Number.isFinite(minAngle) || minAngle < 0 || minAngle > 89) throw new Error("minAngle must be finite and between 0 and 89 degrees");
  const key = JSON.stringify([widths, reach, clearance, trim, minAngle]);
  let byKey = cache.get(order);
  const hit = byKey?.get(key);
  if (hit) return hit;

  const gaps: StrandGap[] = [], flat: string[] = [], perPath: StrandGap[][] = set.paths.map(() => []);
  const shallowest = Math.sin(minAngle * Math.PI / 180);
  for (const crossing of set.crossings) {
    const { over, under } = strandRoles(order, crossing);
    const upper = widths[over.path], lower = reach[under.path];
    if (upper === 0 || widths[under.path] === 0) continue;
    if (crossing.sine < shallowest) { flat.push(crossing.id); continue; }
    const half = crossingHalfGap(upper, lower, crossing.sine, clearance);
    const gap = Object.freeze({ crossing: crossing.id, path: under.path, pathId: under.pathId, from: under.s - half, to: under.s + half });
    gaps.push(gap); perPath[under.path].push(gap);
  }
  const conflicts: StrandConflict[] = [], pieces: StrandPiece[] = [];
  set.paths.forEach((path, p) => {
    if (widths[p] === 0) return;
    const own = perPath[p].slice().sort((a, b) => a.from + a.to - b.from - b.to);
    const length = set.lengths[p];
    const intervals: [number, number][] = own.map((gap) => [gap.from, gap.to]);
    if (trim > 0 && !path.closed) intervals.push([-1, trim], [length - trim, length + 1]);
    // Report what the widths do to the crossing spacing.
    const byStart = own.slice().sort((a, b) => a.from - b.from);
    let reach = byStart.length ? byStart[0].to : 0, latest = byStart[0];
    for (let i = 1; i < byStart.length; i++) {
      if (byStart[i].from < reach)
        conflicts.push(Object.freeze({ kind: "merged" as const, path: p, pathId: path.id, crossings: Object.freeze([latest.crossing, byStart[i].crossing]) }));
      if (byStart[i].to > reach) { reach = byStart[i].to; latest = byStart[i]; }
    }
    if (!path.closed) for (const gap of own) if (gap.from < 0 || gap.to > length)
      conflicts.push(Object.freeze({ kind: "end" as const, path: p, pathId: path.id, crossings: Object.freeze([gap.crossing]) }));
    const cut = cutPath(path.points, path.closed, intervals);
    if (path.closed && intervals.length && cut.pieces.length === 0)
      conflicts.push(Object.freeze({ kind: "consumed" as const, path: p, pathId: path.id, crossings: Object.freeze(own.map((gap) => gap.crossing)) }));
    const centres = own.map((gap) => (gap.from + gap.to) / 2);
    for (const piece of cut.pieces) {
      let u = 0;
      for (const centre of centres) if (centre < piece.start) u++;
      const id = `${path.id}#${u}`;
      const uncut = path.closed && piece.points.length === path.points.length && intervals.length === 0;
      pieces.push(Object.freeze({
        id, seed: componentSeed(path.seed, id, "piece"), closed: uncut, level: path.level, levelFraction: path.levelFraction,
        ...(path.tone === undefined ? {} : { tone: path.tone }), source: p, start: piece.start,
        points: Object.freeze(piece.points.map(([x, y]) => Object.freeze([x, y] as const))),
      }));
    }
  });
  const result: Strands = Object.freeze({ pieces: Object.freeze(pieces), gaps: Object.freeze(gaps), conflicts: Object.freeze(conflicts), flat: Object.freeze(flat) });
  if (!byKey) cache.set(order, byKey = new Map());
  if (byKey.size >= 6) byKey.delete(byKey.keys().next().value!);
  byKey.set(key, result);
  return result;
}

/** Position and unit direction at arc length `s` of a polyline (open or closed). */
function along(points: readonly Point[], closed: boolean, s: number): { position: Point; direction: Point } {
  const ring = closed ? [...points, points[0]] : points, distance = cumulativeLengths(ring);
  let i = 1;
  while (i < ring.length - 1 && distance[i] < s) i++;
  const [ax, ay] = ring[i - 1], [bx, by] = ring[i], span = distance[i] - distance[i - 1];
  const f = span > 0 ? Math.min(1, Math.max(0, (s - distance[i - 1]) / span)) : 0;
  return { position: [ax + (bx - ax) * f, ay + (by - ay) * f], direction: [(bx - ax) / span, (by - ay) / span] };
}

/**
 * Free ends of the open paths as sites: position `trim` in from the end, `angle` (radians) pointing
 * outward along the strand, `tone` the path's. Ends inside a gap of the given strand pieces are
 * omitted so no mark floats where the strand is interrupted. Ids are `<pathId>:end0|end1`.
 */
export function strandEnds(set: CrossingSet, strands: Strands, trim: number): readonly Site[] {
  const ends: Site[] = [];
  set.paths.forEach((path, p) => {
    if (path.closed) return;
    const length = set.lengths[p];
    if (length <= 2 * trim) return;
    for (const [name, s, sign] of [["end0", trim, -1], ["end1", length - trim, 1]] as const) {
      if (strands.gaps.some((gap) => gap.path === p && gap.from < s && s < gap.to)) continue;
      const { position, direction } = along(path.points, false, s);
      const id = `${path.id}:${name}`;
      ends.push(Object.freeze({
        id, seed: componentSeed(path.seed, id, "end"), position: Object.freeze(position), scale: 1,
        angle: Math.atan2(direction[1] * sign, direction[0] * sign), ...(path.tone === undefined ? {} : { tone: path.tone }),
      }));
    }
  });
  return Object.freeze(ends);
}
