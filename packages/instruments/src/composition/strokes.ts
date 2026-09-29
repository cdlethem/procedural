import { componentSeed } from "./core.js";
import { mapPressure } from "./gesture.js";
import type { GesturePath, PressureMap } from "./gesture.js";
import type { Path, Point } from "./types.js";

/**
 * Strokes with width and load: the typed, RESOLVED input of stroke relief (`relief.ts`).
 *
 * INPUT CONTRACT. A `ReliefStroke` is a `Path` (so any path material can stroke its centerline)
 * that also carries, for every vertex, a full brush WIDTH in canvas units and a paint LOAD in
 * [0, 1] (pressure: 0 barely touches, 1 is a fully loaded brush). Widths and loads are
 * interpolated linearly between vertices; a stroke ends in a round cap of its end width. A
 * `StrokeSet` is a deeply frozen, id-unique list of strokes with a seed and a content
 * fingerprint. Nothing here fetches, decodes or captures: the bundled sets
 * (`stroke-samples.ts`), the dry-brush composition (`stroke-relief.ts`) and a host's own resolved
 * strokes all pass through `strokeSet`, which validates and copies its input. Binding a user's
 * captured stroke to a saved instrument is future host work; the direct function API and the
 * typed descriptor accept any set a caller resolved.
 *
 * Limits (each failure names the field): 0–600 strokes (a set with none is a valid empty
 * drawing), 2–50,000 vertices per stroke and 400,000 in all, coordinates within ±1e5, widths in
 * [0, 2000], loads in [0, 1], stroke ids 1–96 printable characters without spaces and unique.
 *
 * IDS AND SEEDS. A stroke's seed is `componentSeed(set.seed, stroke.id, "stroke")`; every later
 * random choice (groove streaks, the shuffled deposition order) is derived from a stroke's id,
 * never from its position, so filtering or reordering the set never changes a surviving stroke.
 * Appearance (palette, colour assignment, light) never enters a set or a cache key.
 *
 * DEPOSITION ORDER (`depositionOrder`). The order in which strokes are put down decides which
 * stroke is on top; it is a rule over the set, not draw order alone:
 * `drawn` (list order), `reversed`, `shuffled` (ascending `componentSeed(seed, id, "order")`,
 * so a survivor keeps its relative place when others are removed) and `heaviest-last`
 * (ascending paint mass ∫ width·load ds, ties in list order: the loaded strokes finish on top).
 */
export const STROKE_LIMITS = Object.freeze({ maxStrokes: 600, minPoints: 2, maxStrokePoints: 50_000, maxPoints: 400_000,
  maxCoordinate: 1e5, maxWidth: 2000 });

export interface StrokeData {
  id: string;
  points: readonly (readonly [number, number])[];
  /** Full width in canvas units, one per vertex or one number for all. */
  widths: number | readonly number[];
  /** Load in [0, 1], one per vertex or one number for all. */
  loads: number | readonly number[];
  /** Optional structural palette index (default pigment of this stroke). */
  tone?: number;
}

export interface ReliefStroke extends Path {
  readonly widths: readonly number[];
  readonly loads: readonly number[];
  /** Arc length of the centerline at each vertex, from the first vertex. */
  readonly arcs: readonly number[];
  readonly length: number;
}

export interface StrokeSet {
  readonly id: string;
  readonly seed: number;
  readonly strokes: readonly ReliefStroke[];
  /** Content hash (64 bits, hex) of every stroke's numbers and ids. Cache keys use it. */
  readonly fingerprint: string;
  /** Bounding box of the centerlines, [left, top, right, bottom]; null for an empty set. */
  readonly bounds: readonly [number, number, number, number] | null;
}

function range(label: string, value: unknown, low: number, high: number): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high)
    throw new Error(`${label} must be a finite number in [${low}, ${high}]`);
}
const printable = /^[\x21-\x7E]{1,96}$/;

function channel(label: string, value: number | readonly number[], count: number, low: number, high: number): readonly number[] {
  if (typeof value === "number") { range(label, value, low, high); return Object.freeze(new Array<number>(count).fill(value)); }
  if (!Array.isArray(value) || value.length !== count) throw new Error(`${label} needs one value per vertex (${count}) or a single number`);
  return Object.freeze(value.map((entry, index) => { range(`${label}[${index}]`, entry, low, high); return entry; }));
}

/** 64-bit content hash over numbers and strings (same mixing as `recordingFingerprint`). */
class Hasher {
  #view = new DataView(new ArrayBuffer(8));
  #a = 0x811c9dc5; #b = 0x9747b28c;
  number(value: number): void {
    this.#view.setFloat64(0, value);
    for (let k = 0; k < 8; k += 4) {
      const w = this.#view.getUint32(k);
      this.#a = Math.imul(this.#a ^ w, 0x01000193) >>> 0; this.#a ^= this.#a >>> 15;
      this.#b = Math.imul(this.#b ^ w, 0x85ebca6b) >>> 0; this.#b ^= this.#b >>> 13;
    }
  }
  text(value: string): void { this.number(value.length); for (let i = 0; i < value.length; i++) this.number(value.charCodeAt(i)); }
  done(): string { return `${this.#a.toString(16).padStart(8, "0")}${this.#b.toString(16).padStart(8, "0")}`; }
}

function build(setSeed: number, data: StrokeData, ids: Set<string>): ReliefStroke {
  if (data === null || typeof data !== "object") throw new Error("A stroke must be an object");
  if (typeof data.id !== "string" || !printable.test(data.id)) throw new Error("Stroke id must be 1–96 printable characters without spaces");
  if (ids.has(data.id)) throw new Error(`Stroke id ${data.id} is repeated`);
  ids.add(data.id);
  const label = `Stroke ${data.id}`;
  if (!Array.isArray(data.points) || data.points.length < STROKE_LIMITS.minPoints || data.points.length > STROKE_LIMITS.maxStrokePoints)
    throw new Error(`${label} needs ${STROKE_LIMITS.minPoints}–${STROKE_LIMITS.maxStrokePoints} points`);
  const count = data.points.length;
  const points = data.points.map((point, index): Point => {
    if (!Array.isArray(point) || point.length !== 2) throw new Error(`${label} point ${index} must be [x, y]`);
    range(`${label} point ${index} x`, point[0], -STROKE_LIMITS.maxCoordinate, STROKE_LIMITS.maxCoordinate);
    range(`${label} point ${index} y`, point[1], -STROKE_LIMITS.maxCoordinate, STROKE_LIMITS.maxCoordinate);
    return Object.freeze([point[0], point[1]] as const);
  });
  const widths = channel(`${label} widths`, data.widths, count, 0, STROKE_LIMITS.maxWidth);
  const loads = channel(`${label} loads`, data.loads, count, 0, 1);
  if (data.tone !== undefined && (!Number.isSafeInteger(data.tone) || data.tone < 0 || data.tone > 1_000_000))
    throw new Error(`${label} tone must be an integer in [0, 1000000]`);
  const arcs = new Array<number>(count).fill(0);
  for (let i = 1; i < count; i++) arcs[i] = arcs[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  const stroke: { -readonly [K in keyof ReliefStroke]: ReliefStroke[K] } = {
    id: data.id, seed: componentSeed(setSeed, data.id, "stroke"), points: Object.freeze(points), closed: false, level: 0, levelFraction: 0,
    widths, loads, arcs: Object.freeze(arcs), length: arcs[count - 1],
  };
  if (data.tone !== undefined) stroke.tone = data.tone;
  return Object.freeze(stroke);
}

/** Validate, copy and freeze a set of strokes. Failures name the stroke and field. */
export function strokeSet(input: { id: string; seed: number; strokes: readonly StrokeData[] }): StrokeSet {
  if (typeof input.id !== "string" || !printable.test(input.id)) throw new Error("Stroke set id must be 1–96 printable characters without spaces");
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Stroke set seed must be a uint32 integer");
  if (!Array.isArray(input.strokes) || input.strokes.length > STROKE_LIMITS.maxStrokes)
    throw new Error(`A stroke set holds 0–${STROKE_LIMITS.maxStrokes} strokes`);
  const ids = new Set<string>();
  const strokes = input.strokes.map((data) => build(input.seed, data, ids));
  const total = strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
  if (total > STROKE_LIMITS.maxPoints) throw new Error(`A stroke set holds at most ${STROKE_LIMITS.maxPoints} points; this one has ${total}`);
  const hash = new Hasher();
  hash.text(input.id); hash.number(input.seed);
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const stroke of strokes) {
    hash.text(stroke.id); hash.number(stroke.points.length); hash.number(stroke.tone ?? -1);
    stroke.points.forEach(([x, y], i) => {
      hash.number(x); hash.number(y); hash.number(stroke.widths[i]); hash.number(stroke.loads[i]);
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    });
  }
  return Object.freeze({ id: input.id, seed: input.seed, strokes: Object.freeze(strokes), fingerprint: hash.done(),
    bounds: strokes.length ? Object.freeze([left, top, right, bottom] as const) : null });
}

/** The set as plain JSON-compatible data (copies). */
export function strokeData(set: StrokeSet): { id: string; seed: number; strokes: StrokeData[] } {
  return { id: set.id, seed: set.seed, strokes: set.strokes.map((s): StrokeData => ({ id: s.id,
    points: s.points.map(([x, y]) => [x, y] as const), widths: [...s.widths], loads: [...s.loads], ...(s.tone === undefined ? {} : { tone: s.tone }) })) };
}

export type DepositionOrder = "drawn" | "reversed" | "shuffled" | "heaviest-last";
export const depositionOrders: readonly DepositionOrder[] = Object.freeze(["drawn", "reversed", "shuffled", "heaviest-last"]);

/** Paint mass of a stroke: the integral of width times load along the centerline. */
export function paintMass(stroke: ReliefStroke): number {
  let mass = 0;
  for (let i = 1; i < stroke.points.length; i++)
    mass += (stroke.arcs[i] - stroke.arcs[i - 1]) * (stroke.widths[i - 1] * stroke.loads[i - 1] + stroke.widths[i] * stroke.loads[i]) / 2;
  return mass;
}

const U32 = 0x1_0000_0000;
const orderCache = new WeakMap<StrokeSet, Map<DepositionOrder, readonly number[]>>();
/** Indices into `set.strokes`, first deposited first; the last index is on top. */
export function depositionOrder(set: StrokeSet, rule: DepositionOrder): readonly number[] {
  if (!depositionOrders.includes(rule)) throw new Error(`Unknown deposition order: ${String(rule)}`);
  let byRule = orderCache.get(set);
  if (!byRule) { byRule = new Map(); orderCache.set(set, byRule); }
  const hit = byRule.get(rule);
  if (hit) return hit;
  const indices = set.strokes.map((_, index) => index);
  if (rule === "reversed") indices.reverse();
  else if (rule === "shuffled") {
    const key = set.strokes.map((s) => componentSeed(set.seed, s.id, "order") / U32);
    indices.sort((a, b) => key[a] - key[b] || a - b);
  } else if (rule === "heaviest-last") {
    const mass = set.strokes.map(paintMass);
    indices.sort((a, b) => mass[a] - mass[b] || a - b);
  }
  const order = Object.freeze(indices);
  byRule.set(rule, order);
  return order;
}

/** Placement of a set: the centerline bounding box centre moves to `center`, after a turn and a scale about it. */
export interface StrokeFrame { centerX: number; centerY: number; scale: number; rotation: number }
const placeCache = new WeakMap<StrokeSet, Map<string, StrokeSet>>();

/**
 * A similarity of the whole set: scale (positive) and clockwise-on-screen rotation in degrees about
 * the centre of the centerline bounding box, then that centre moves to `(centerX, centerY)`. Widths
 * scale with the geometry; loads, ids, tones and the seed are kept, so ids and streams do not change.
 */
export function placeStrokes(set: StrokeSet, frame: StrokeFrame): StrokeSet {
  range("frame center x", frame.centerX, -1e5, 1e5); range("frame center y", frame.centerY, -1e5, 1e5);
  range("frame scale", frame.scale, 0.01, 100); range("frame rotation", frame.rotation, -3600, 3600);
  const key = JSON.stringify([frame.centerX, frame.centerY, frame.scale, frame.rotation]);
  let byFrame = placeCache.get(set);
  if (!byFrame) { byFrame = new Map(); placeCache.set(set, byFrame); }
  const hit = byFrame.get(key);
  if (hit) return hit;
  let placed = set;
  if (set.bounds) {
    const [l, t, r, b] = set.bounds, mx = (l + r) / 2, my = (t + b) / 2;
    const angle = frame.rotation * Math.PI / 180, c = Math.cos(angle) * frame.scale, s = Math.sin(angle) * frame.scale;
    placed = strokeSet({ id: set.id, seed: set.seed, strokes: set.strokes.map((stroke): StrokeData => ({ id: stroke.id,
      points: stroke.points.map(([x, y]) => [frame.centerX + (x - mx) * c - (y - my) * s, frame.centerY + (x - mx) * s + (y - my) * c] as const),
      widths: stroke.widths.map((w) => w * frame.scale), loads: stroke.loads, ...(stroke.tone === undefined ? {} : { tone: stroke.tone }) })) });
  }
  byFrame.set(key, placed);
  if (byFrame.size > 6) byFrame.delete(byFrame.keys().next().value!);
  return placed;
}

/**
 * Strokes from any path list (contour chains, dry-brush hairs, a flow trace): constant `width` and
 * `load`, except that `edgeLoad` in [0, 1] lightens paths away from the middle of their family by
 * their `levelFraction` (a hair at the brush edge is lighter): load = `load * (1 - (1 - edgeLoad) * |2 f - 1|)`.
 * Closed paths keep their vertices and are closed by repeating the first one.
 */
export function strokesFromPaths(input: { id: string; seed: number; paths: readonly Path[]; width: number; load: number; edgeLoad?: number }): StrokeSet {
  const { paths, width, load, edgeLoad = 1 } = input;
  range("stroke width", width, 0, STROKE_LIMITS.maxWidth); range("stroke load", load, 0, 1); range("edge load", edgeLoad, 0, 1);
  const strokes: StrokeData[] = [];
  for (const path of paths) {
    const points = path.closed ? [...path.points, path.points[0]] : path.points;
    if (points.length < 2) continue;
    const pathLoad = load * (1 - (1 - edgeLoad) * Math.abs(2 * path.levelFraction - 1));
    strokes.push({ id: path.id, points, widths: width, loads: pathLoad, ...(path.tone === undefined ? {} : { tone: path.tone }) });
  }
  return strokeSet({ id: input.id, seed: input.seed, strokes });
}

/**
 * One stroke from a replayed gesture: the width follows the mapped pressure
 * (`width * mapPressure(p)`, so light touch is narrow) and the load is the pressure itself (clamped to
 * [0, 1]: the replay's interpolation can overshoot by a rounding error).
 */
export function strokeFromGesture(input: { id: string; seed: number; path: GesturePath; width: number; map: PressureMap; tone?: number }): StrokeSet {
  const { path, width, map } = input;
  range("stroke width", width, 0, STROKE_LIMITS.maxWidth);
  return strokeSet({ id: input.id, seed: input.seed, strokes: [{ id: path.id, points: path.points,
    widths: path.pressure.map((p) => width * mapPressure(p, map)), loads: path.pressure.map((p) => Math.min(1, Math.max(0, p))), ...(input.tone === undefined ? {} : { tone: input.tone }) }] });
}

const widthCache = new WeakMap<StrokeSet, Map<number, StrokeSet>>();
/** The same set with every width multiplied by `factor` in (0, 100]; geometry, loads, ids, tones and seed are unchanged. Factor 1 returns the set itself. */
export function scaleWidths(set: StrokeSet, factor: number): StrokeSet {
  range("width factor", factor, 0.001, 100);
  if (factor === 1) return set;
  let byFactor = widthCache.get(set);
  if (!byFactor) { byFactor = new Map(); widthCache.set(set, byFactor); }
  const hit = byFactor.get(factor);
  if (hit) return hit;
  const scaled = strokeSet({ id: set.id, seed: set.seed, strokes: set.strokes.map((stroke): StrokeData => ({ id: stroke.id, points: stroke.points,
    widths: stroke.widths.map((w) => Math.min(STROKE_LIMITS.maxWidth, w * factor)), loads: stroke.loads, ...(stroke.tone === undefined ? {} : { tone: stroke.tone }) })) });
  byFactor.set(factor, scaled);
  if (byFactor.size > 6) byFactor.delete(byFactor.keys().next().value!);
  return scaled;
}
