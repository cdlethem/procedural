import { componentSeed } from "./core.js";
import { resolveFrameTime } from "./frame-stack.js";
import type { EndBehaviour, FrameStack, Interpolation } from "./frame-stack.js";
import { sinTurns } from "./frame-samples.js";
import { gestureTrack } from "./recording.js";
import { bundledRecording, bundledRecordingIds } from "./recording-samples.js";
import type { BundledRecordingId } from "./recording-samples.js";

/**
 * The slice-to-source mapping shared by the single-image slicer and the temporal slit-scan.
 *
 * One mechanism, two honest labels. The output is a row of `count x repeats` parallel BANDS across
 * one axis (the across axis). Band number `slot` shows SOURCE SLICE `s`, and source slice `s` is the
 * parameter interval `[s / count, (s + 1) / count]`, midpoint `u = (s + 0.5) / count`.
 *
 * - `space` (one image): `u` is a position across the image, so slice `s` is the image strip at that
 *   position. Reordering the slices recomposes the picture.
 * - `time` (a frame sequence): `u` goes through a TIME CURVE to a progress `theta` in the stack's
 *   time, and band `slot` reads the frame(s) at that instant. Reordering the slices reorders time.
 *
 * Everything the artist edits about correspondence lives here: which source slice each band shows
 * (`order`, `phase`, `repeats`), how each band is offset and scaled along its own length, and, for
 * time, the curve, window, interpolation and end behaviour. All of it is a frozen table:
 *
 * `SliceTable.rows` is in output order. Each row records its stable id, its source slice, its
 * output band (fractions of the across axis), its source interval, its time source (`null` for one
 * image), and its offset and scale. This is the output-band -> source (frame, position) table.
 *
 * Identity and chance. A slice's id is `slice:NNN` from its SOURCE index; a repeated band adds
 * `:rK`. Ordering never renames a slice: reversing, shuffling or shifting moves rows, not ids.
 * Every random draw derives from `componentSeed(seed, sliceId, purpose)`, so nothing depends on
 * traversal order and a repeat of a slice draws exactly what its first appearance drew. Changing
 * `count` changes what the ids mean, so it intentionally replaces the table.
 *
 * Orders (`slicePermutation`): `sequence`; `reverse`; `comb` (k groups dealt out, so slices
 * 0, k, 2k, ... come first, then 1, k+1, ...; the picture appears k times, each copy thinned to
 * every k-th strip); `interleave` (k equal groups riffled: one from each group in turn; the groups
 * are `ceil(count / k)` long, the last may be shorter); `shuffle` (a `disorder` fraction of the
 * slices, chosen by their own ids, trade places among themselves in an order given by their ids). A
 * group count above `count` is capped to `count`. `phase` then rotates whatever order results by
 * `round(phase x count)` places to the left, cyclically. With `repeats > 1` the whole order is
 * repeated across the output; `alternate` plays odd repeats reversed.
 *
 * Offset and scale act along a band's own length in fractions of that length. A band's content at
 * source position `p` lands at `l = 0.5 + (p - 0.5) scale + offset`, so a positive offset moves the
 * content toward larger l (down for columns, right for rows) and scale enlarges about the middle.
 * Modulation modes give `f` in [-1, 1]: `ramp` (linear across the output slots), `wave` (a sine of
 * period `period` slots), `alternate` (+1 on even slots, -1 on odd) all act by OUTPUT slot, so the
 * pattern stays put when the order changes; `random` acts by slice id, so the value travels with
 * the slice. Offset = `amount x f`; scale = `2 ^ (amount x f)` (`amount` in octaves).
 *
 * Bounds: 1..600 slices, 1..64 repeats and at most 1,200 bands in all; messages name the control.
 */
export const SLICE_LIMITS = Object.freeze({ maxSlices: 600, maxRepeats: 64, maxBands: 1200 });

export const sliceOrderKinds = ["sequence", "reverse", "comb", "interleave", "shuffle"] as const;
export type SliceOrderKind = (typeof sliceOrderKinds)[number];
export interface SliceOrder {
  kind: SliceOrderKind;
  /** Groups for `comb` and `interleave` (integer >= 2, capped to the slice count). */
  groups: number;
  /** Fraction of slices that trade places under `shuffle`, in [0, 1]. */
  disorder: number;
  /** Cyclic left rotation as a fraction of the slice count; any real (its fractional part is used). */
  phase: number;
}

export const modulationModes = ["none", "ramp", "wave", "alternate", "random"] as const;
export type ModulationMode = (typeof modulationModes)[number];
export interface Modulation {
  mode: ModulationMode;
  /** Offset: fraction of band length. Scale: octaves (factor 2^(amount f)). Non-negative. */
  amount: number;
  /** Slots per cycle for `wave` (> 0). */
  period: number;
}

export type GestureChannel = "x" | "y" | "distance";
export type TimeCurve =
  | { kind: "linear" }
  | { kind: "power"; power: number }
  | { kind: "swing"; cycles: number }
  | { kind: "gesture"; recording: BundledRecordingId; channel: GestureChannel };

export interface TimeScan {
  kind: "time";
  curve: TimeCurve;
  /** The window of the stack's duration the curve maps onto: `start` and `length` as fractions of the duration (may extend past [0, 1]; then `end` decides). */
  window: { start: number; length: number };
  end: EndBehaviour;
  interpolation: Interpolation;
}

export interface SliceTableOptions {
  seed: number;
  /** Source slices per repeat. */
  count: number;
  repeats: number;
  repeatMode: "same" | "alternate";
  order: SliceOrder;
  offset: Modulation;
  scale: Modulation;
  scan: { kind: "space" } | TimeScan;
}

/** Where a band reads in time. */
export interface SliceTime {
  /** Curve output in [0, 1] (or beyond, for a gesture channel it stays inside). */
  readonly progress: number;
  /** Seconds actually read after the end behaviour. */
  readonly time: number;
  readonly frame: number;
  readonly next: number;
  /** Weight of `next`; 0 unless the interpolation is `linear`. */
  readonly mix: number;
}

export interface SliceRow {
  readonly id: string;
  /** Random stream of this slice (`componentSeed(seed, sliceId, "slice")`), the same in every repeat. */
  readonly seed: number;
  /** Source slice index in [0, count). */
  readonly source: number;
  readonly repeat: number;
  /** Output band index in [0, total). */
  readonly slot: number;
  /** The band's extent across the output, fractions of the across axis. */
  readonly across: readonly [number, number];
  /** The source interval `[s / count, (s + 1) / count]`: across the image (`space`) or along the time parameter (`time`). */
  readonly interval: readonly [number, number];
  readonly time: SliceTime | null;
  /** Along-band offset, fraction of the band length. */
  readonly offset: number;
  /** Along-band scale factor (> 0). */
  readonly scale: number;
}

export interface SliceTable {
  readonly mode: "space" | "time";
  readonly count: number;
  readonly repeats: number;
  readonly total: number;
  readonly rows: readonly SliceRow[];
}

const U32 = 0x1_0000_0000;
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
export const sliceId = (source: number, repeat = 0): string => `slice:${String(source).padStart(3, "0")}${repeat > 0 ? `:r${repeat}` : ""}`;

function integerIn(label: string, value: number, low: number, high: number, control: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < low || value > high)
    throw new Error(`${label} must be an integer in [${low}, ${high}] (got ${String(value)}); change ${control}`);
}
function finiteIn(label: string, value: number, low: number, high: number, control: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high)
    throw new Error(`${label} must be a finite number in [${low}, ${high}] (got ${String(value)}); change ${control}`);
}

/** The source slice shown by each slot: a permutation of `0..count-1` (`result[slot] = source`). */
export function slicePermutation(count: number, order: SliceOrder, seed: number): readonly number[] {
  integerIn("Slice count", count, 1, SLICE_LIMITS.maxSlices, "Slices");
  if (!(sliceOrderKinds as readonly string[]).includes(order.kind)) throw new Error(`Unknown slice order: ${String(order.kind)}`);
  finiteIn("Shuffle disorder", order.disorder, 0, 1, "Disorder");
  finiteIn("Phase", order.phase, -1e6, 1e6, "Phase");
  let base: number[] = Array.from({ length: count }, (_, i) => i);
  switch (order.kind) {
    case "reverse": base.reverse(); break;
    case "comb": {
      integerIn("Groups", order.groups, 2, 64, "Groups");
      const k = Math.min(order.groups, count);
      base = [];
      for (let g = 0; g < k; g++) for (let s = g; s < count; s += k) base.push(s);
      break;
    }
    case "interleave": {
      integerIn("Groups", order.groups, 2, 64, "Groups");
      const k = Math.min(order.groups, count), size = Math.ceil(count / k);
      base = [];
      for (let j = 0; j < size; j++) for (let g = 0; g < k; g++) { const s = g * size + j; if (s < count) base.push(s); }
      break;
    }
    case "shuffle": {
      const picked: number[] = [];
      for (let s = 0; s < count; s++) if (unit(seed, sliceId(s), "pick") < order.disorder) picked.push(s);
      const traded = picked.map((s) => ({ s, key: componentSeed(seed, sliceId(s), "shuffle") }))
        .sort((a, b) => a.key - b.key || a.s - b.s);
      for (let j = 0; j < picked.length; j++) base[picked[j]] = traded[j].s;
      break;
    }
    default: break;
  }
  const shift = Math.round((order.phase - Math.floor(order.phase)) * count) % count;
  if (shift !== 0) base = base.map((_, i) => base[(i + shift) % count]);
  return Object.freeze(base);
}

const profiles = new Map<string, readonly number[]>();
/** A recorded gesture channel as a time map: the recording's own timing (uniform grid) normalized to [0, 1]. */
function gestureProfile(recording: BundledRecordingId, channel: GestureChannel, seed: number): readonly number[] {
  if (!(bundledRecordingIds as readonly string[]).includes(recording)) throw new Error(`Unknown recording: ${String(recording)}; change Gesture`);
  if (channel !== "x" && channel !== "y" && channel !== "distance") throw new Error(`Unknown gesture channel: ${String(channel)}`);
  const key = `${recording}|${channel}|${recording === "wander" ? seed : 0}`, hit = profiles.get(key);
  if (hit) return hit;
  const track = gestureTrack(bundledRecording(recording, seed), { smoothing: 0, frame: { centerX: 0, centerY: 0, scale: 1, rotation: 0 } });
  const values = channel === "distance" ? track.arc : channel === "x" ? track.x : track.y;
  let low = Infinity, high = -Infinity;
  for (const v of values) { if (v < low) low = v; if (v > high) high = v; }
  if (!(high > low)) throw new Error(`Recording "${recording}" has no extent in channel ${channel}; choose another Gesture channel`);
  const profile = Object.freeze(values.map((v) => (v - low) / (high - low)));
  profiles.set(key, profile);
  return profile;
}

/** Progress `theta` for a parameter `u` in [0, 1] under a curve. `seed` matters only for the `wander` gesture. */
export function timeProgress(curve: TimeCurve, u: number, seed: number): number {
  switch (curve.kind) {
    case "linear": return u;
    case "power":
      finiteIn("Curve power", curve.power, 0.05, 20, "Curve power");
      return u ** curve.power;
    case "swing":
      finiteIn("Swings", curve.cycles, 0, 64, "Swings");
      return 0.5 - 0.5 * sinTurns(curve.cycles * u + 0.25);
    case "gesture": {
      const profile = gestureProfile(curve.recording, curve.channel, seed), position = u * (profile.length - 1);
      const j = Math.min(profile.length - 2, Math.floor(position)), f = position - j;
      return (1 - f) * profile[j] + f * profile[j + 1];
    }
    default: throw new Error(`Unknown time curve: ${String((curve as { kind: unknown }).kind)}`);
  }
}

function modulation(mode: Modulation, slot: number, total: number, seed: number, id: string, purpose: string, label: string): number {
  if (!(modulationModes as readonly string[]).includes(mode.mode)) throw new Error(`Unknown ${label} mode: ${String(mode.mode)}`);
  finiteIn(`${label} amount`, mode.amount, 0, 16, label);
  switch (mode.mode) {
    case "none": return 0;
    case "ramp": return total > 1 ? (2 * slot) / (total - 1) - 1 : 0;
    case "wave":
      finiteIn(`${label} period`, mode.period, 0.5, 1e6, `${label} period`);
      return sinTurns(slot / mode.period);
    case "alternate": return slot % 2 === 0 ? 1 : -1;
    default: return 2 * unit(seed, id, purpose) - 1;
  }
}

const tableCache = new Map<string, SliceTable>();
const TABLE_CACHE = 16;

/**
 * The frozen slice table. Cached by construction: the key holds every option and the stack's content
 * hash, never an appearance. `stack` is required for `time` scans and ignored (and not keyed) otherwise.
 */
export function sliceTable(options: SliceTableOptions, stack?: FrameStack): SliceTable {
  const { seed, count, repeats, repeatMode, order, offset, scale, scan } = options;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Slice seed must be a uint32 integer");
  integerIn("Slice count", count, 1, SLICE_LIMITS.maxSlices, "Slices");
  integerIn("Repeats", repeats, 1, SLICE_LIMITS.maxRepeats, "Repeats");
  if (count * repeats > SLICE_LIMITS.maxBands)
    throw new Error(`${count} slices x ${repeats} repeats make ${count * repeats} bands; the limit is ${SLICE_LIMITS.maxBands}. Lower Slices or Repeats`);
  if (repeatMode !== "same" && repeatMode !== "alternate") throw new Error(`Unknown repeat mode: ${String(repeatMode)}`);
  if (scan.kind === "time") {
    if (!stack) throw new Error("A time scan needs a frame stack");
    finiteIn("Window start", scan.window.start, -1e3, 1e3, "Window start");
    finiteIn("Window length", scan.window.length, 0, 1e3, "Window length");
  }
  const key = JSON.stringify([options, scan.kind === "time" ? stack!.hash : null]);
  const hit = tableCache.get(key);
  if (hit) { tableCache.delete(key); tableCache.set(key, hit); return hit; }

  const base = slicePermutation(count, order, seed), total = count * repeats, rows: SliceRow[] = [];
  for (let slot = 0; slot < total; slot++) {
    const repeat = Math.floor(slot / count), i = slot % count;
    const source = base[repeatMode === "alternate" && repeat % 2 === 1 ? count - 1 - i : i];
    const baseId = sliceId(source);
    const sliceSeed = componentSeed(seed, baseId, "slice");
    let time: SliceTime | null = null;
    if (scan.kind === "time") {
      const st = stack!, progress = timeProgress(scan.curve, (source + 0.5) / count, seed);
      let t = st.start + (scan.window.start + progress * scan.window.length) * st.duration;
      const eps = 1e-9 * Math.max(st.duration, 1e-9);
      if (t < st.start && st.start - t <= eps) t = st.start;
      if (t > st.end && t - st.end <= eps) t = st.end;
      const resolved = resolveFrameTime(st, t, scan.interpolation, scan.end,
        "Change Window start, Window length or Time curve so every band's time lies inside the sequence, or choose another End behaviour");
      time = Object.freeze({ progress, time: resolved.time, frame: resolved.frame, next: resolved.next, mix: resolved.mix });
    }
    rows.push(Object.freeze({
      id: sliceId(source, repeat), seed: sliceSeed, source, repeat, slot,
      across: Object.freeze([slot / total, (slot + 1) / total] as const),
      interval: Object.freeze([source / count, (source + 1) / count] as const),
      time,
      offset: offset.mode === "none" ? 0 : offset.amount * modulation(offset, slot, total, seed, baseId, "offset", "Offset"),
      scale: scale.mode === "none" ? 1 : 2 ** (scale.amount * modulation(scale, slot, total, seed, baseId, "scale", "Scale")),
    }));
  }
  const table: SliceTable = Object.freeze({ mode: scan.kind === "time" ? "time" : "space", count, repeats, total, rows: Object.freeze(rows) });
  tableCache.set(key, table);
  if (tableCache.size > TABLE_CACHE) tableCache.delete(tableCache.keys().next().value!);
  return table;
}
