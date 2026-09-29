import { gradientNoise2D01, offsetPolyline2D } from "@procedurals/javascript";
import { componentSeed } from "./core.js";
import { arcPointAt, arcSpan, arcTable, arcTurn, closedRing } from "./path-arc.js";
import type { ArcTable } from "./path-arc.js";
import { memoized } from "./sources.js";
import type { Ring } from "./support.js";
import type { Path, Point, Site } from "./types.js";

/**
 * Arc-length layout of a sequence of advances along a supplied path: the producer behind Path
 * Typography, separate from the shaping that supplies text advances and from any consumer that draws
 * a glyph. A text-free motif sequence uses exactly the same function: supply items with advances (and
 * optionally an outline) and a `scale` of 1.
 *
 * INPUTS. `path` is any `Path` (a contour, a branch lineage, a gesture stroke): at least two finite
 * points, canvas units, open or closed. Consecutive duplicate points are dropped and a repeated
 * closing point of a closed path is removed; fewer than two distinct points, or a closed path of
 * fewer than three, is an error. `items` are laid end to end: `advance` is the arc length one item
 * occupies before `scale` (positive, finite); an item may carry `ink` (closed rings in item units,
 * centred on the middle of its advance on the baseline, y down, nonzero winding) used only by the
 * curvature-collision policy; `spacer` items reserve room and never produce a frame.
 *
 * LAYOUT. Reading runs along the path (`forward`), against it (`reverse`) or in whichever direction
 * makes the first repeat's chord point rightward on the canvas (`upright`; a vertical chord reads
 * downward). `start` is the arc length, along the reading direction, at which the run begins; on an
 * open path it lies in [0, length], on a closed one it wraps and the run may never pass its own
 * start (a closed path is one lap). Item `i` of repeat `r` occupies arc `[a, b]` with
 * `a = start + r·(run + gap) + scale·Σ advance` of the items before it and `b = a + scale·advance`.
 * `repeat` is `once`; `whole` (further repeats only while a whole run fits, the first is always
 * started) or `fill` (repeat until the path or lap is used up). An item whose interval does not fit
 * before the end of an open path, or before one lap on a closed one, is dropped as `overflow`.
 *
 * FRAMES. The frame of an item sits on the path at the middle of its interval, moved `baseline`
 * canvas units toward the reader's up (heading turned by −90°: canvas +y is down, so up for a path
 * running left to right is screen-up). Its `angle` is the direction of the CHORD between the path
 * positions at both ends of the interval, not the tangent at its middle: the item's baseline runs
 * through the two end points (they sit off the path only by the sagitta of the arc), so a polyline
 * corner inside one item turns it by half the corner, not all at once. `turn` is the signed sum of
 * exterior angles inside the interval (positive clockwise on screen). An item whose chord is shorter
 * than `minStraightness` times its arc length (the path folds back inside it: a hairpin, a cusp, a
 * zigzag as tall as the type) is dropped as `fold` under every policy, so a letter is never flipped
 * or laid across a sharp turn. For a circular bend the ratio is sin(θ/2)/(θ/2) for a turn θ inside
 * the interval: 0.90 at 90°, 0.74 at 150°, 0.64 at 180°. `seam` is true when the
 * interval crosses arc length 0 of the reading direction (only a closed path can have one; the
 * geometry is continuous there).
 *
 * CURVATURE POLICY. On the inside of a tight bend neighbouring outlines converge and overlap. With
 * `ink` present, each placed item is tested against the previous placed item's transformed rings
 * (segment crossings, or one ring inside the other's ink; touching does not count): `ignore` leaves
 * the overlap; `skip` drops the item as `curvature`; `compress` narrows it horizontally about its
 * centre (`condense` down to `MIN_CONDENSE`, by bisection to the widest width that clears) and drops
 * it when even that overlaps; `rotate` turns it toward the previous item's orientation, keeping its
 * position, by the smallest turn that clears (bisection on the fraction of the way to the tangent
 * direction; fraction 0 is the previous orientation) and drops it when even that overlaps. The
 * result of a bisection is always a configuration that was tested clear. Only consecutive placed
 * items are compared: items two apart may still touch on a spiral tighter than the type is tall.
 *
 * CROWDING. `layoutPaths` sets the same items on several paths in order (earlier paths, and earlier
 * repeats, have priority). Each repeat is built whole. With `crowding: "avoid"`: a repeat any of whose
 * final outlines overlaps, or comes within `clearance` canvas units of, an outline already committed
 * by another path or another repeat is dropped
 * WHOLE, every letter reported as `crowded` (half a phrase is unreadable, so it is all or nothing) and
 * the curvature history rewinds to before it; and a repeat that would run into itself (a hairpin's
 * other arm: a letter within `clearance` of an earlier one of the same repeat other than its two neighbours,
 * which the curvature policy owns) stops there, that letter and the rest of the repeat reported
 * `crowded`, like text ending where it meets itself. `allow` places everything. Disruption, applied
 * later, is not tested at all. A repeat cut off by the end of the path keeps its placed letters.
 *
 * OUTPUT (`PathLayout`, frozen, cached by path, items and options). `frames` are the placed items in
 * order; `dropped` lists every item that was not placed and why; `baselines` are the reading path
 * of each repeat's placed extent, offset by `baseline`, split at cusps (a turn beyond 150°, which the
 * core offset refuses) and stroked by any path material; `report` counts what happened. Ids are
 * `<path id>/r<repeat>/<item id>`: they do not depend on size, policy, disruption, tracking or
 * colour choices, and seeds are `componentSeed(path.seed, id, "glyph")`.
 *
 * WORK. At most `MAX_LAYOUT_ITEMS` items are considered and `MAX_COLLISION_WORK` segment pairs tested;
 * exceeding either throws an error naming the settings to change. Nothing is truncated silently.
 */
export interface AdvanceItem {
  readonly id: string;
  /** Arc length before `scale`; positive and finite. */
  readonly advance: number;
  readonly spacer?: boolean;
  readonly ink?: readonly Ring[];
}

export type CurvaturePolicy = "ignore" | "skip" | "compress" | "rotate";
export type RepeatPolicy = "once" | "whole" | "fill";
export type ReadingDirection = "forward" | "reverse" | "upright";
export type DropReason = "overflow" | "fold" | "curvature" | "crowded";
export type Adaptation = "none" | "compress" | "rotate";

export interface PathLayoutOptions {
  /** Canvas units per item unit. */
  scale: number;
  /** Arc length, in reading direction, where the first item begins. */
  start: number;
  direction: ReadingDirection;
  /** Canvas units toward the reader's up; negative puts the baseline below the path. */
  baseline: number;
  /** Canvas units between the end of one repeat and the start of the next. */
  gap: number;
  repeat: RepeatPolicy;
  policy: CurvaturePolicy;
  /** The least chord-to-arc ratio an item's interval may have, in (0, 1]: below it the path folds back within one item. */
  minStraightness: number;
  /** Canvas units of empty space the crowding rule keeps around type already set; unused without it. */
  clearance: number;
}

export interface PathFrame<T extends AdvanceItem = AdvanceItem> extends Site {
  readonly item: T;
  readonly repeat: number;
  /** Position of the item in `items`. */
  readonly index: number;
  /** Arc length of the middle of the interval, reading direction, unwrapped. */
  readonly arc: number;
  readonly span: readonly [number, number];
  /** Horizontal narrowing about the item's centre; 1 unless the compress policy acted. */
  readonly condense: number;
  /** Signed turning inside the interval, radians; positive is clockwise on screen. */
  readonly turn: number;
  readonly seam: boolean;
  readonly adapted: Adaptation;
}
export interface DroppedItem { readonly id: string; readonly repeat: number; readonly index: number; readonly reason: DropReason }
export interface LayoutReport {
  readonly pathLength: number;
  readonly closed: boolean;
  /** Length of one run of items, canvas units. */
  readonly runLength: number;
  readonly direction: "forward" | "reverse";
  /** Repeats started. */
  readonly repeats: number;
  readonly placed: number;
  readonly dropped: Readonly<Record<DropReason, number>>;
  readonly adapted: Readonly<Record<"compress" | "rotate", number>>;
}
export interface PathLayout<T extends AdvanceItem = AdvanceItem> {
  readonly id: string;
  readonly pathId: string;
  readonly frames: readonly PathFrame<T>[];
  readonly dropped: readonly DroppedItem[];
  readonly baselines: readonly Path[];
  readonly report: LayoutReport;
}

export const MAX_LAYOUT_ITEMS = 6000;
export const MAX_PATH_POINTS = 200_000;
export const MAX_COLLISION_WORK = 40_000_000;
/** The narrowest an item may be compressed. */
export const MIN_CONDENSE = 0.4;
const BISECTIONS = 14;
const CUSP = (150 * Math.PI) / 180;
const EPS = 1e-9;

function finite(label: string, value: number, min: number, max: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}
const wrapPi = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

interface Cleaned { readonly points: readonly Point[]; readonly closed: boolean }
const cleaned = new WeakMap<Path, Cleaned>();
/** The supplied path without duplicate consecutive points or a repeated closing point. */
export function cleanPath(path: Path): Cleaned {
  const hit = cleaned.get(path);
  if (hit) return hit;
  if (!Array.isArray(path.points) || path.points.length > MAX_PATH_POINTS)
    throw new Error(`A path for type needs at most ${MAX_PATH_POINTS} points`);
  let points: Point[] = [];
  for (const point of path.points) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) throw new Error(`Path ${path.id} has a non-finite point`);
    const last = points[points.length - 1];
    if (!last || last[0] !== point[0] || last[1] !== point[1]) points.push(point);
  }
  if (path.closed) points = [...closedRing(points)];
  if (points.length < (path.closed ? 3 : 2)) throw new Error(`Path ${path.id} has too few distinct points to carry type`);
  const value = Object.freeze({ points: Object.freeze(points), closed: path.closed });
  cleaned.set(path, value);
  return value;
}

const reversed = new WeakMap<readonly Point[], readonly Point[]>();
function reversedPoints(points: readonly Point[]): readonly Point[] {
  let hit = reversed.get(points);
  if (!hit) { hit = Object.freeze([...points].reverse()); reversed.set(points, hit); }
  return hit;
}

/**
 * READABLE SPANS: the path cut where it turns from running rightward to running leftward, so that each
 * span can be read left to right (`direction: "upright"` reads each span in the direction that does).
 * A path that doubles back (a U-turn, a loop, a contour) otherwise carries some of its text upside down,
 * because one direction cannot suit both arms. A sample every `SPAN_STEP` canvas units is rightward when
 * its heading is within 80° of +x, leftward within 80° of −x, and neutral (near vertical, readable either
 * way) otherwise; neutral samples join the run before them. A run shorter than `minLength` arc length is
 * merged into the longer of its neighbours, so a small wiggle never cuts a phrase. Cuts fall where a run
 * begins, i.e. at a near-vertical tangent. A path with one run is returned itself; otherwise the spans are
 * open paths with ids `<path id>#<k>` (k in path order) and seeds `componentSeed(path.seed, id, "path")`.
 * A closed path is cut open at its runs' boundaries (its spans wrap through the original start when a
 * run straddles it), so under `upright` a closed contour is read as two or more arcs, not one lap.
 * `forward` and `reverse` never call this: their frames keep `<path id>/r<repeat>/g<index>` ids.
 */
export const SPAN_STEP = 3;
const spanCache = new WeakMap<Path, Map<number, readonly Path[]>>();
export function readableSpans(path: Path, minLength: number): readonly Path[] {
  finite("Span minimum length", minLength, 0, 1e6);
  const byLength = spanCache.get(path) ?? new Map<number, readonly Path[]>();
  spanCache.set(path, byLength);
  const hit = byLength.get(minLength);
  if (hit) return hit;
  const clean = cleanPath(path), table = arcTable(clean.points, clean.closed), length = table.length, closed = clean.closed;
  const count = Math.max(2, Math.ceil(length / SPAN_STEP)), step = length / count, samples = closed ? count : count + 1;
  const sense: number[] = [];
  for (let k = 0; k < samples; k++) {
    const cos = Math.cos(arcPointAt(table, Math.min(length, (k + 0.5) * step)).heading);
    sense.push(cos > 0.17 ? 1 : cos < -0.17 ? -1 : 0);
  }
  const first = sense.findIndex((value) => value !== 0);
  let spans: readonly Path[] = [path];
  if (first >= 0) {
    // A closed path is read from a change of sense, so run boundaries are never split by its start.
    let begin = 0;
    if (closed) {
      let last = sense[first];
      for (let n = 1; n <= samples; n++) {
        const i = (first + n) % samples;
        if (sense[i] !== 0 && sense[i] !== last) { begin = i; break; }
      }
    }
    const at = (n: number) => closed ? (begin + n) % samples : n;
    // Neutral samples take the sense before them (or the first one, at the start of an open path).
    let held = sense[at(0)] || sense[first];
    const runs: Array<{ from: number; sign: number; size: number }> = [];
    for (let n = 0; n < samples; n++) {
      const value = sense[at(n)] || held;
      if (runs.length === 0 || value !== held) runs.push({ from: n, sign: value, size: 0 });
      held = value;
      runs[runs.length - 1].size++;
    }
    // Runs shorter than minLength take the sense of their longer neighbour, shortest first; equal neighbours fuse.
    while (runs.length > 1) {
      let shortest = -1;
      runs.forEach((run, r) => { if (run.size * step < minLength && (shortest < 0 || run.size < runs[shortest].size)) shortest = r; });
      if (shortest < 0) break;
      const before = shortest > 0 ? runs[shortest - 1] : closed ? runs[runs.length - 1] : undefined;
      const after = shortest < runs.length - 1 ? runs[shortest + 1] : closed ? runs[0] : undefined;
      const into = !before ? after! : !after ? before : before.size >= after.size ? before : after;
      runs[shortest].sign = into.sign;
      for (let r = 0; r + 1 < runs.length; r++) if (runs[r].sign === runs[r + 1].sign) { runs[r].size += runs[r + 1].size; runs.splice(r + 1, 1); r--; }
    }
    // A closed path whose last run has the sense of its first has no boundary at its own start.
    const cuts = runs.map((run) => run.from);
    if (closed && runs.length > 1 && runs[0].sign === runs[runs.length - 1].sign) cuts.shift();
    if (cuts.length > 1) {
      spans = Object.freeze(cuts.map((from, k) => {
        const last = k + 1 === cuts.length;
        const toN = last ? (closed ? cuts[0] + samples : samples - 1) : cuts[k + 1];
        const a = closed ? (begin + from) * step : from * step, z = closed ? (begin + toN) * step : Math.min(length, toN * step);
        const id = `${path.id}#${k}`;
        const points = arcSpan(table, a, z).map((point) => Object.freeze([point[0], point[1]] as const));
        return Object.freeze({ id, seed: componentSeed(path.seed, id, "path"), points: Object.freeze(points), closed: false, level: path.level, levelFraction: path.levelFraction });
      }));
    }
  }
  byLength.set(minLength, spans);
  return spans;
}

/** Canvas outline of an item under a frame; the frame's own `position`, `angle`, `scale` and `condense`. */
type Outline = { readonly rings: readonly (readonly number[])[]; readonly box: readonly [number, number, number, number] };
function outline(ink: readonly Ring[], x: number, y: number, angle: number, scale: number, condense: number): Outline {
  const c = Math.cos(angle), s = Math.sin(angle);
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  const rings = ink.map((ring) => {
    const flat = new Array<number>(ring.length * 2);
    for (let i = 0; i < ring.length; i++) {
      const px = ring[i][0] * condense * scale, py = ring[i][1] * scale;
      const X = x + px * c - py * s, Y = y + px * s + py * c;
      flat[2 * i] = X; flat[2 * i + 1] = Y;
      if (X < left) left = X; if (X > right) right = X; if (Y < top) top = Y; if (Y > bottom) bottom = Y;
    }
    return flat;
  });
  return { rings, box: [left, top, right, bottom] };
}

const orient = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
function inside(rings: readonly (readonly number[])[], x: number, y: number): boolean {
  let odd = false;
  for (const ring of rings) {
    const n = ring.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = ring[2 * i], yi = ring[2 * i + 1], xj = ring[2 * j], yj = ring[2 * j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) odd = !odd;
    }
  }
  return odd;
}
/** Whether two filled outlines share area: a proper edge crossing, or one lying inside the other's ink. */
function overlap(a: Outline, b: Outline, budget: { work: number }): boolean {
  if (a.box[0] >= b.box[2] || b.box[0] >= a.box[2] || a.box[1] >= b.box[3] || b.box[1] >= a.box[3]) return false;
  for (const ra of a.rings) {
    const na = ra.length / 2;
    for (const rb of b.rings) {
      const nb = rb.length / 2;
      budget.work += na * nb;
      if (budget.work > MAX_COLLISION_WORK)
        throw new Error(`Curvature tests exceed ${MAX_COLLISION_WORK} segment pairs. Use a larger type size, fewer repeats, fewer paths or a shorter phrase, or set Tight curves to ignore and Crowding to allow`);
      for (let i = 0, k = na - 1; i < na; k = i++) {
        const p1x = ra[2 * k], p1y = ra[2 * k + 1], p2x = ra[2 * i], p2y = ra[2 * i + 1];
        for (let j = 0, m = nb - 1; j < nb; m = j++) {
          const q1x = rb[2 * m], q1y = rb[2 * m + 1], q2x = rb[2 * j], q2y = rb[2 * j + 1];
          const d1 = orient(q1x, q1y, q2x, q2y, p1x, p1y), d2 = orient(q1x, q1y, q2x, q2y, p2x, p2y);
          if (d1 * d2 >= 0) continue;
          const d3 = orient(p1x, p1y, p2x, p2y, q1x, q1y), d4 = orient(p1x, p1y, p2x, p2y, q2x, q2y);
          if (d3 * d4 < 0) return true;
        }
      }
    }
  }
  // No edges cross: they overlap only if one outline sits wholly inside the other's ink.
  return inside(b.rings, a.rings[0][0], a.rings[0][1]) || inside(a.rings, b.rings[0][0], b.rings[0][1]);
}

/** Outlines already placed, in a coarse grid so a query touches only its neighbours. */
const CROWD_CELL = 48;
class Occupied {
  readonly #cells = new Map<string, Array<{ outline: Outline; group: string; stamp: number }>>();
  #stamp = 0;
  #keys(box: Outline["box"], reach = 0): string[] {
    const keys: string[] = [];
    for (let x = Math.floor((box[0] - reach) / CROWD_CELL); x <= Math.floor((box[2] + reach) / CROWD_CELL); x++)
      for (let y = Math.floor((box[1] - reach) / CROWD_CELL); y <= Math.floor((box[3] + reach) / CROWD_CELL); y++) keys.push(`${x},${y}`);
    return keys;
  }
  add(outline: Outline, group: string): void {
    const entry = { outline, group, stamp: 0 };
    for (const key of this.#keys(outline.box)) {
      const cell = this.#cells.get(key);
      if (cell) cell.push(entry); else this.#cells.set(key, [entry]);
    }
  }
  /** Whether `outline` overlaps or comes within `distance` of an outline placed by another group. */
  crowds(outline: Outline, group: string, distance: number, budget: { work: number }): boolean {
    const stamp = ++this.#stamp;
    for (const key of this.#keys(outline.box, distance))
      for (const entry of this.#cells.get(key) ?? []) {
        if (entry.group === group || entry.stamp === stamp) continue;
        entry.stamp = stamp;
        if (within(entry.outline, outline, distance, budget)) return true;
      }
    return false;
  }
}

const segmentGap2 = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
};
/** Whether two filled outlines overlap or come within `distance` of each other. */
function within(a: Outline, b: Outline, distance: number, budget: { work: number }): boolean {
  if (distance <= 0) return overlap(a, b, budget);
  if (a.box[0] >= b.box[2] + distance || b.box[0] >= a.box[2] + distance || a.box[1] >= b.box[3] + distance || b.box[1] >= a.box[3] + distance) return false;
  if (overlap(a, b, budget)) return true;
  const limit = distance * distance;
  for (const ra of a.rings) {
    const na = ra.length / 2;
    for (const rb of b.rings) {
      const nb = rb.length / 2;
      budget.work += 4 * na * nb;
      if (budget.work > MAX_COLLISION_WORK)
        throw new Error(`Curvature tests exceed ${MAX_COLLISION_WORK} segment pairs. Use a larger type size, fewer repeats, fewer paths or a shorter phrase, or set Tight curves to ignore and Crowding to allow`);
      // No edges cross here, so the outlines are as close as their nearest vertex is to the other's edges.
      for (let i = 0; i < na; i++) {
        const px = ra[2 * i], py = ra[2 * i + 1];
        for (let j = 0, m = nb - 1; j < nb; m = j++)
          if (segmentGap2(px, py, rb[2 * m], rb[2 * m + 1], rb[2 * j], rb[2 * j + 1]) <= limit) return true;
      }
      for (let j = 0; j < nb; j++) {
        const px = rb[2 * j], py = rb[2 * j + 1];
        for (let i = 0, k = na - 1; i < na; k = i++)
          if (segmentGap2(px, py, ra[2 * k], ra[2 * k + 1], ra[2 * i], ra[2 * i + 1]) <= limit) return true;
      }
    }
  }
  return false;
}

function checkOptions(options: PathLayoutOptions): void {
  finite("Layout scale", options.scale, 1e-6, 1e6);
  finite("Layout start", options.start, -1e9, 1e9);
  finite("Layout baseline", options.baseline, -1e5, 1e5);
  finite("Layout gap", options.gap, 0, 1e6);
  finite("Layout clearance", options.clearance, 0, 1e4);
  finite("Layout minimum straightness", options.minStraightness, 0.05, 1);
  if (!["forward", "reverse", "upright"].includes(options.direction)) throw new Error(`Unknown reading direction: ${String(options.direction)}`);
  if (!["once", "whole", "fill"].includes(options.repeat)) throw new Error(`Unknown repeat policy: ${String(options.repeat)}`);
  if (!["ignore", "skip", "compress", "rotate"].includes(options.policy)) throw new Error(`Unknown curvature policy: ${String(options.policy)}`);
}

function checkItems(items: readonly AdvanceItem[]): void {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Layout needs at least one item");
  const seen = new Set<string>();
  let visible = 0;
  for (const item of items) {
    if (typeof item.id !== "string" || item.id === "" || item.id.includes("/")) throw new Error("Layout item ids must be non-empty and contain no '/'");
    if (seen.has(item.id)) throw new Error(`Layout item id ${item.id} is repeated`);
    seen.add(item.id);
    if (!(item.advance > 0) || !Number.isFinite(item.advance)) throw new Error(`Layout item ${item.id} needs a positive finite advance`);
    if (!item.spacer) visible++;
  }
  if (visible === 0) throw new Error("Layout needs at least one item that is not a spacer");
}

const layoutCache = new WeakMap<Path, WeakMap<readonly AdvanceItem[], Map<string, PathLayout>>>();

/** Set the items along one path; see the module comment. Identical arguments return the same frozen layout. */
export function layoutAlongPath<T extends AdvanceItem>(path: Path, items: readonly T[], options: PathLayoutOptions): PathLayout<T> {
  checkOptions(options);
  checkItems(items);
  const clean = cleanPath(path), forward = arcTable(clean.points, clean.closed);
  if (!(forward.length > 0)) throw new Error(`Path ${path.id} has no length`);
  const byItems = layoutCache.get(path) ?? new WeakMap();
  layoutCache.set(path, byItems);
  const cache = byItems.get(items) ?? new Map<string, PathLayout>();
  byItems.set(items, cache);
  return memoized(cache, JSON.stringify(options), () => build(path, forward, items, options)) as PathLayout<T>;
}

export type Crowding = "allow" | "avoid";
/** `layoutPaths` options: `start` is a fraction (0 to 1) of each path's own length rather than an arc length. */
export type PathsLayoutOptions = Omit<PathLayoutOptions, "start"> & { start: number };
const crowdCache = new WeakMap<readonly Path[], WeakMap<readonly AdvanceItem[], Map<string, readonly PathLayout[]>>>();

/**
 * Set the same items on each path in turn, `options` applying to every path (`start` is a fraction of
 * that path's own length). With `avoid`, later items yield to earlier ones (see CROWDING above); with
 * `allow` every path is laid out on its own. Cached by the paths array, items and settings.
 */
export function layoutPaths<T extends AdvanceItem>(paths: readonly Path[], items: readonly T[], options: PathsLayoutOptions, crowding: Crowding): readonly PathLayout<T>[] {
  if (crowding !== "allow" && crowding !== "avoid") throw new Error(`Unknown crowding rule: ${String(crowding)}`);
  finite("Layout start fraction", options.start, 0, 1);
  const own = (path: Path): PathLayoutOptions => {
    const clean = cleanPath(path);
    return { ...options, start: options.start * arcTable(clean.points, clean.closed).length };
  };
  checkOptions({ ...options, start: 0 });
  checkItems(items);
  const byItems = crowdCache.get(paths) ?? new WeakMap();
  crowdCache.set(paths, byItems);
  const cache = byItems.get(items) ?? new Map<string, readonly PathLayout[]>();
  byItems.set(items, cache);
  return memoized(cache, JSON.stringify([options, crowding]), () => {
    const occupied = crowding === "avoid" ? new Occupied() : undefined, budget = { work: 0 };
    return Object.freeze(paths.map((path) => {
      const clean = cleanPath(path);
      return build(path, arcTable(clean.points, clean.closed), items, own(path), occupied, budget);
    }));
  }) as readonly PathLayout<T>[];
}

function build<T extends AdvanceItem>(path: Path, forward: ArcTable, items: readonly T[], options: PathLayoutOptions,
  occupied?: Occupied, shared?: { work: number }): PathLayout<T> {
  const { scale, gap, repeat, policy, baseline, minStraightness, clearance } = options;
  const closed = forward.closed, length = forward.length;
  let runLength = 0;
  for (const item of items) runLength += item.advance * scale;

  // Reading direction. `upright` reads forward unless that makes the first repeat's chord point left.
  const first = (table: ArcTable, start: number) => {
    const from = arcPointAt(table, start), to = arcPointAt(table, start + Math.min(runLength, closed ? length : Math.max(0, length - start)));
    return [to.x - from.x, to.y - from.y] as const;
  };
  const startIn = (table: ArcTable) => closed ? ((options.start % table.length) + table.length) % table.length : options.start;
  if (!closed && (options.start < 0 || options.start > length))
    throw new Error(`Start ${options.start} is outside the path (0 to ${length}); lower the start offset`);
  let reading: "forward" | "reverse" = options.direction === "reverse" ? "reverse" : "forward";
  if (options.direction === "upright") {
    const [dx, dy] = first(forward, startIn(forward));
    reading = dx > EPS || (Math.abs(dx) <= EPS && dy >= 0) ? "forward" : "reverse";
  }
  const table = reading === "forward" ? forward : arcTable(reversedPoints(forward.points), closed);
  const start = startIn(table), limit = closed ? start + length : length;

  // Repeats: planned before anything is built.
  const period = runLength + gap;
  let repeats = 1;
  if (repeat === "fill") repeats = Math.max(1, Math.floor((limit - start) / period - EPS) + 1);
  else if (repeat === "whole") repeats = Math.max(1, Math.floor((limit - start - runLength) / period + EPS) + 1);
  if (repeats * items.length > MAX_LAYOUT_ITEMS)
    throw new Error(`Type would consider ${repeats * items.length} items over ${repeats} repeats; the limit is ${MAX_LAYOUT_ITEMS}. Raise the size or the repeat gap, or set repeat to once`);

  const frames: PathFrame<T>[] = [], dropped: DroppedItem[] = [], budget = shared ?? { work: 0 };
  const droppedCount: Record<DropReason, number> = { overflow: 0, fold: 0, curvature: 0, crowded: 0 };
  const adaptedCount = { compress: 0, rotate: 0 };
  let previous: { frame: PathFrame<T>; outline: Outline } | undefined;
  const extent: Array<{ first: number; last: number; any: boolean }> = [];
  for (let r = 0; r < repeats; r++) {
    // A repeat is built whole, then kept or (with crowding avoidance) discarded whole.
    const group = `${path.id}/${r}`, kept: Array<{ frame: PathFrame<T>; outline?: Outline }> = [], lost: DroppedItem[] = [];
    const before = previous;
    let pen = start + r * period, stopped = false;
    for (let index = 0; index < items.length; index++) {
      const item = items[index], a = pen, b = pen + item.advance * scale;
      pen = b;
      if (item.spacer) continue;
      const id = `${path.id}/r${r}/${item.id}`;
      const drop = (reason: DropReason) => lost.push(Object.freeze({ id, repeat: r, index, reason }));
      if (stopped) { drop("crowded"); continue; }
      if (b > limit + EPS) { drop("overflow"); continue; }
      const start3 = arcPointAt(table, a), end3 = arcPointAt(table, b), mid = arcPointAt(table, (a + b) / 2);
      // The baseline is the chord; when the path folds back inside the interval the chord no longer follows it.
      if (Math.hypot(end3.x - start3.x, end3.y - start3.y) < minStraightness * (b - a)) { drop("fold"); continue; }
      const turn = arcTurn(table, a, b).signed;
      const chord = Math.atan2(end3.y - start3.y, end3.x - start3.x);
      const x = mid.x + Math.sin(chord) * baseline, y = mid.y - Math.cos(chord) * baseline;
      let angle = chord, condense = 1, adapted: Adaptation = "none";
      const tracked = item.ink !== undefined && policy !== "ignore", measured = item.ink !== undefined && (tracked || occupied !== undefined);
      let placed: Outline | undefined = measured ? outline(item.ink!, x, y, angle, scale, 1) : undefined;
      if (placed && previous && overlap(previous.outline, placed, budget)) {
        const clear = (candidateAngle: number, candidateCondense: number) => {
          const shape = outline(item.ink!, x, y, candidateAngle, scale, candidateCondense);
          return overlap(previous!.outline, shape, budget) ? undefined : shape;
        };
        if (policy === "skip") { drop("curvature"); continue; }
        if (policy === "compress") {
          let good = clear(angle, MIN_CONDENSE);
          if (!good) { drop("curvature"); continue; }
          let low = MIN_CONDENSE, high = 1;
          for (let step = 0; step < BISECTIONS; step++) {
            const mid2 = (low + high) / 2, shape = clear(angle, mid2);
            if (shape) { low = mid2; good = shape; } else high = mid2;
          }
          condense = low; placed = good; adapted = "compress";
        } else if (policy === "rotate") {
          const anchor = previous.frame.angle, delta = wrapPi(chord - anchor);
          let good = clear(anchor, 1);
          if (!good) { drop("curvature"); continue; }
          let low = 0, high = 1;
          for (let step = 0; step < BISECTIONS; step++) {
            const mid2 = (low + high) / 2, shape = clear(anchor + mid2 * delta, 1);
            if (shape) { low = mid2; good = shape; } else high = mid2;
          }
          angle = anchor + low * delta; placed = good; adapted = "rotate";
        }
      }
      // Avoiding crowding also stops a run where it would run into itself (a hairpin's other arm): the
      // letter and everything after it in this repeat yield. Its two neighbours are the policy's business.
      if (occupied && placed && kept.slice(0, -2).some(({ outline: shape }) => shape && within(shape, placed!, clearance, budget))) {
        drop("crowded"); stopped = true; continue;
      }
      const frame: PathFrame<T> = Object.freeze({
        id, seed: componentSeed(path.seed, id, "glyph"), position: Object.freeze([x, y] as const),
        angle, scale, condense, item, repeat: r, index, arc: (a + b) / 2, span: Object.freeze([a, b] as const),
        turn, seam: Math.floor(a / length + EPS) !== Math.floor(b / length - EPS), adapted,
      });
      kept.push({ frame, outline: placed });
      if (tracked) previous = { frame, outline: placed! };
    }
    if (occupied && kept.some(({ outline: shape }) => shape && occupied.crowds(shape, group, clearance, budget))) {
      // Crowded out: every letter of this repeat yields, and the curvature history rewinds to before it.
      for (const { frame } of kept) lost.push(Object.freeze({ id: frame.id, repeat: r, index: frame.index, reason: "crowded" as const }));
      kept.length = 0;
      previous = before;
    }
    for (const { frame, outline: shape } of kept) {
      frames.push(frame);
      if (frame.adapted !== "none") adaptedCount[frame.adapted]++;
      if (occupied && shape) occupied.add(shape, group);
    }
    lost.sort((p, q) => p.index - q.index);
    for (const item of lost) { dropped.push(item); droppedCount[item.reason]++; }
    if (kept.length) {
      extent.push({ first: kept[0].frame.span[0], last: kept[kept.length - 1].frame.span[1], any: true });
    } else extent.push({ first: Infinity, last: -Infinity, any: false });
  }

  const baselines: Path[] = [];
  extent.forEach((range, r) => {
    if (!range.any) return;
    const line = arcSpan(table, range.first, range.last);
    // The core offset refuses hairpins; split the run at every cusp and offset each piece.
    const pieces: Point[][] = [[line[0]]];
    for (let k = 1; k < line.length; k++) {
      pieces[pieces.length - 1].push(line[k]);
      if (k < line.length - 1) {
        const a = Math.atan2(line[k][1] - line[k - 1][1], line[k][0] - line[k - 1][0]);
        const b = Math.atan2(line[k + 1][1] - line[k][1], line[k + 1][0] - line[k][0]);
        if (Math.abs(wrapPi(b - a)) > CUSP) pieces.push([line[k]]);
      }
    }
    pieces.forEach((piece, k) => {
      if (piece.length < 2) return;
      // Positive core distance is the canvas-right (down for a rightward path); up is the other way.
      const shifted = baseline === 0 ? piece : offsetPolyline2D({ points: piece, closed: false, distance: -baseline, miterLimit: 2, maxWork: piece.length * 4 + 16 }).points as unknown as Point[];
      const id = `${path.id}/r${r}/baseline${pieces.length > 1 ? `#${k}` : ""}`;
      baselines.push(Object.freeze({ id, seed: componentSeed(path.seed, id, "baseline"), points: Object.freeze(shifted.map((p) => Object.freeze([p[0], p[1]] as const))),
        closed: false, level: 0, levelFraction: 0 }));
    });
  });

  const report: LayoutReport = Object.freeze({ pathLength: length, closed, runLength, direction: reading, repeats, placed: frames.length,
    dropped: Object.freeze(droppedCount), adapted: Object.freeze(adaptedCount) });
  return Object.freeze({ id: `${path.id}/layout`, pathId: path.id, frames: Object.freeze(frames), dropped: Object.freeze(dropped),
    baselines: Object.freeze(baselines), report });
}

/**
 * Correlated per-item disruption, applied after layout and the curvature policy (so it may bring
 * back overlaps by design). Every amount is scaled by smoothed noise sampled at the item's arc length
 * divided by `length`, so neighbours move alike over about `length` canvas units, whatever the type
 * size; each channel (shift, tilt, growth, dropout) has its own field. Noise is stretched (×3.2) and
 * clamped to [−1, 1] because raw value noise clusters near its middle.
 *   shift    canvas units along the item's up direction, ± amplitude
 *   tilt     radians added to the angle, ± amplitude
 *   grow     fractional size change, scale × (1 + grow·n), at least 0.2 of the original
 *   dropout  an item is omitted where its dropout field is below this share of its range, so
 *            omissions come in runs; raising it only omits more items, never different ones
 * Amount zero on every channel returns the layout's own frames unchanged. Fields depend on
 * `componentSeed(seed, layout.pathId, "disruption")`, never on colour, item text or draw order.
 */
export interface DisruptionOptions {
  seed: number;
  length: number;
  shift: number;
  tilt: number;
  grow: number;
  dropout: number;
}
export interface DisruptedFrames<T extends AdvanceItem = AdvanceItem> {
  readonly frames: readonly PathFrame<T>[];
  /** Ids of frames the dropout channel omitted. */
  readonly omitted: readonly string[];
}

interface NoiseField { sample(x: number, y: number): number }
const noiseFields = new Map<number, NoiseField>();
const disruptionCache = new WeakMap<PathLayout, Map<string, DisruptedFrames>>();

export function disruptFrames<T extends AdvanceItem>(layout: PathLayout<T>, options: DisruptionOptions): DisruptedFrames<T> {
  if (!Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) throw new Error("Disruption seed must be a uint32 integer");
  finite("Disruption length", options.length, 1, 1e5);
  finite("Disruption shift", options.shift, 0, 1e4);
  finite("Disruption tilt", options.tilt, 0, Math.PI);
  finite("Disruption growth", options.grow, 0, 0.8);
  finite("Disruption dropout", options.dropout, 0, 1);
  const { shift, tilt, grow, dropout } = options;
  if (shift === 0 && tilt === 0 && grow === 0 && dropout === 0) return Object.freeze({ frames: layout.frames, omitted: Object.freeze([]) });
  const cache = disruptionCache.get(layout) ?? new Map<string, DisruptedFrames>();
  disruptionCache.set(layout, cache);
  return memoized(cache, JSON.stringify([options.seed, options.length, shift, tilt, grow, dropout]), () => {
    const fieldSeed = componentSeed(options.seed, layout.pathId, "disruption");
    let field = noiseFields.get(fieldSeed);
    if (!field) {
      field = gradientNoise2D01({ seed: fieldSeed });
      if (noiseFields.size >= 8) noiseFields.delete(noiseFields.keys().next().value!);
      noiseFields.set(fieldSeed, field);
    }
    const sample = (arc: number, channel: number) =>
      Math.max(-1, Math.min(1, (field!.sample(arc / options.length, channel + 0.5) - 0.5) * 3.2));
    const frames: PathFrame<T>[] = [], omitted: string[] = [];
    for (const frame of layout.frames) {
      if (dropout > 0 && (sample(frame.arc, 4000) + 1) / 2 < dropout) { omitted.push(frame.id); continue; }
      const up = frame.angle - Math.PI / 2, lift = shift * sample(frame.arc, 0);
      frames.push(shift === 0 && tilt === 0 && grow === 0 ? frame : Object.freeze({ ...frame,
        position: Object.freeze([frame.position[0] + Math.cos(up) * lift, frame.position[1] + Math.sin(up) * lift] as const),
        angle: frame.angle + tilt * sample(frame.arc, 1000),
        scale: frame.scale * Math.max(0.2, 1 + grow * sample(frame.arc, 2000)) }));
    }
    return Object.freeze({ frames: Object.freeze(frames), omitted: Object.freeze(omitted) });
  }) as DisruptedFrames<T>;
}
