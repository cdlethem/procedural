/**
 * Recorded gesture channels and the values derived from them.
 *
 * Input contract (host-owned capture). A `Recording` is a resolved, immutable, deeply frozen value:
 * ordered samples with explicit timestamps (milliseconds, strictly increasing), x and y in canvas
 * units, and an OPTIONAL pressure channel in [0, 1]. The library never captures pointer events,
 * fetches, or decodes anything; a host (or a bundled generator, see `recording-samples.ts`) hands
 * over `RecordingData` and `createRecording` validates it. Pressure is explicit in both states:
 * `pressure: null` means the device delivered no pressure, which is never read as 0 or 1. Callers
 * decide what an absent channel means through a `PressurePolicy` (`resolvePressure`); the derived
 * values say which source actually supplied their pressure.
 *
 * Raw samples are never changed. `Recording` keeps exactly what was given (validated, copied and
 * frozen); reconstruction, smoothing, framing and resampling are derived values (`GestureTrack`,
 * stations) computed from it, so any of them can be edited without touching the recording.
 *
 * Reconstruction. Every channel becomes a continuous function of time by piecewise-cubic Hermite
 * interpolation on the actual, possibly irregular, timestamps: exact at every sample. Positions use
 * second-order three-point slopes (a real curve may pass beyond its sampled extremes, and so may
 * this), with zero slope wherever a neighbouring secant is exactly zero, so an exact rest stays still
 * instead of swinging out and back. Pressure uses Fritsch-Butland monotone slopes and never leaves the
 * range of its data. The result is sampled on one canonical uniform time grid per recording
 * (`step = duration / (N - 1)` with `step <= TRACK_STEP` ms), which does not depend on how often the
 * device reported. Replay therefore depends on the curve and its timing, not on the event frequency:
 * for a smooth curve sampled at 30 Hz with 45% timestamp jitter and again at 240 Hz, the derived
 * positions at the same moments agree within 0.04 canvas units on a 400-unit extent (0.01% of it).
 *
 * Smoothing. `smoothing` is a Gaussian standard deviation in MILLISECONDS applied to that grid
 * (0 leaves the reconstruction untouched). Positions use odd reflection about the end samples and
 * pressure even reflection, so the end points stay exactly where they were recorded, a constant
 * velocity run is unchanged, and smoothed pressure stays inside [0, 1]. The kernel radius is
 * limited to the recording's own span.
 *
 * Frame. The smoothed curve is placed on the canvas by a similarity transform about the centre of
 * the unsmoothed reconstruction's bounding box: uniform `scale`, `rotation` (degrees, positive turns clockwise on
 * screen because y points down) and translation of that centre to (`centerX`, `centerY`).
 * Speed, arc length and stations are measured after the frame, in canvas units.
 *
 * Stations. A station rule picks moments of the derived track: by TIME (`k * interval` ms from the
 * recording start; dense where the hand was slow, repeated where it rested) or by ARC LENGTH
 * (`k * spacing` canvas units from the start; even along the path, a pause collapses to one
 * station). Grids are anchored at the recording start, never at a window edge, so narrowing the
 * time window keeps every station that remains exactly where it was.
 *
 * Units. Time ms; lengths canvas units; speed canvas units per second; angles radians in
 * published values, degrees in options. Growth of cost is bounded: at most 200,000 samples, 10
 * minutes, 150,000 grid points, and 80 million kernel multiplications. Over a bound the function
 * throws a message naming the input to change; nothing is truncated.
 */

export const RECORDING_LIMITS = Object.freeze({ minSamples: 2, maxSamples: 200_000, maxDuration: 600_000, maxCoordinate: 1e6 });
/** Upper bound (ms) of the canonical grid step; the actual step divides the duration evenly. */
export const TRACK_STEP = 4;
export const MAX_TRACK_POINTS = 150_000;
export const MAX_SMOOTHING = 5_000;
const MAX_KERNEL_WORK = 80_000_000;
const EPS = 1e-9;

/** JSON-compatible recording. `pressure` must be present: an array, or `null` for "no channel". */
export interface RecordingData {
  id: string;
  /** Milliseconds, strictly increasing. */
  t: readonly number[];
  x: readonly number[];
  y: readonly number[];
  pressure: readonly number[] | null;
}
export interface Recording {
  readonly id: string;
  readonly t: readonly number[];
  readonly x: readonly number[];
  readonly y: readonly number[];
  /** `null` is the explicit "no pressure channel" state. */
  readonly pressure: readonly number[] | null;
  readonly length: number;
  /** Milliseconds from the first to the last sample. */
  readonly duration: number;
}

const DATA_KEYS = ["id", "t", "x", "y", "pressure"] as const;

function channel(id: string, name: string, value: unknown, low: number, high: number, expected?: number): number[] {
  const isArray = Array.isArray(value) || (ArrayBuffer.isView(value) && !(value instanceof DataView));
  if (!isArray) throw new Error(`Recording "${id}": ${name} must be an array of numbers`);
  const list = Array.from(value as ArrayLike<unknown>);
  if (expected !== undefined && list.length !== expected)
    throw new Error(`Recording "${id}": ${name} has ${list.length} samples but t has ${expected}`);
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    if (typeof v !== "number" || !Number.isFinite(v) || v < low || v > high)
      throw new Error(`Recording "${id}": ${name}[${i}] must be a finite number in [${low}, ${high}]`);
  }
  return list as number[];
}

/** Validate, copy and freeze a recording. Failures name the channel and index. */
export function createRecording(data: RecordingData): Recording {
  if (data === null || typeof data !== "object" || Array.isArray(data)) throw new Error("Recording must be an object");
  for (const key of Reflect.ownKeys(data))
    if (typeof key !== "string" || !(DATA_KEYS as readonly string[]).includes(key)) throw new Error(`Recording has an unknown field: ${String(key)}`);
  for (const key of DATA_KEYS)
    if (!Object.hasOwn(data, key) || (data as unknown as Record<string, unknown>)[key] === undefined)
      throw new Error(`Recording is missing ${key}${key === "pressure" ? " (use null for a recording without a pressure channel)" : ""}`);
  const { id } = data;
  if (typeof id !== "string" || id.length === 0 || id.length > 120) throw new Error("Recording id must be a nonempty string of at most 120 characters");
  const M = RECORDING_LIMITS.maxCoordinate;
  const t = channel(id, "t", data.t, -1e15, 1e15);
  if (t.length < RECORDING_LIMITS.minSamples || t.length > RECORDING_LIMITS.maxSamples)
    throw new Error(`Recording "${id}" has ${t.length} samples; it needs ${RECORDING_LIMITS.minSamples} to ${RECORDING_LIMITS.maxSamples}`);
  for (let i = 1; i < t.length; i++)
    if (!(t[i] > t[i - 1])) throw new Error(`Recording "${id}": timestamps must strictly increase (t[${i}] = ${t[i]} does not exceed t[${i - 1}] = ${t[i - 1]})`);
  const duration = t[t.length - 1] - t[0];
  if (duration > RECORDING_LIMITS.maxDuration)
    throw new Error(`Recording "${id}" lasts ${duration} ms; the limit is ${RECORDING_LIMITS.maxDuration} ms`);
  const x = channel(id, "x", data.x, -M, M, t.length), y = channel(id, "y", data.y, -M, M, t.length);
  const pressure = data.pressure === null ? null : channel(id, "pressure", data.pressure, 0, 1, t.length);
  return Object.freeze({ id, t: Object.freeze(t), x: Object.freeze(x), y: Object.freeze(y),
    pressure: pressure === null ? null : Object.freeze(pressure), length: t.length, duration });
}

/** The recording as plain JSON-compatible data (a copy). */
export function recordingData(recording: Recording): RecordingData {
  return { id: recording.id, t: [...recording.t], x: [...recording.x], y: [...recording.y],
    pressure: recording.pressure === null ? null : [...recording.pressure] };
}

const fingerprints = new WeakMap<Recording, string>();
/** Content hash of every channel (64 bits, hex); cache keys use it, never the id alone. */
export function recordingFingerprint(recording: Recording): string {
  const hit = fingerprints.get(recording);
  if (hit) return hit;
  const buffer = new DataView(new ArrayBuffer(8));
  let a = 0x811c9dc5, b = 0x9747b28c;
  const mix = (v: number) => {
    buffer.setFloat64(0, v);
    for (let k = 0; k < 8; k += 4) {
      const w = buffer.getUint32(k);
      a = Math.imul(a ^ w, 0x01000193) >>> 0; a ^= a >>> 15;
      b = Math.imul(b ^ w, 0x85ebca6b) >>> 0; b ^= b >>> 13;
    }
  };
  for (const list of [recording.t, recording.x, recording.y]) { mix(list.length); for (const v of list) mix(v); }
  mix(recording.pressure === null ? -1 : recording.pressure.length);
  if (recording.pressure) for (const v of recording.pressure) mix(v);
  const value = `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
  fingerprints.set(recording, value);
  return value;
}

/** Placement of the reconstructed gesture on the canvas. */
export interface GestureFrame { centerX: number; centerY: number; scale: number; rotation: number }
export interface TrackOptions { smoothing: number; frame: GestureFrame }

/** The derived, frozen replay of a recording: one canonical uniform time grid in canvas units. */
export interface GestureTrack {
  /** Recording id, suffixed `~n` for repetition n. Every derived id starts with it. */
  readonly id: string;
  readonly recording: Recording;
  readonly step: number;
  readonly count: number;
  readonly duration: number;
  readonly x: readonly number[];
  readonly y: readonly number[];
  /** Unit tangent per grid point (carried through pauses). */
  readonly tx: readonly number[];
  readonly ty: readonly number[];
  /** Canvas units per second. */
  readonly speed: readonly number[];
  /** Cumulative path length from the recording start. */
  readonly arc: readonly number[];
  /** Smoothed recorded pressure, or `null` when the recording has none. */
  readonly pressure: readonly number[] | null;
  readonly length: number;
}

function finite(label: string, value: number, low: number, high: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high)
    throw new Error(`${label} must be a finite number in [${low}, ${high}]`);
}

/**
 * Hermite slopes for irregular knots. `monotone` gives Fritsch-Butland slopes (never leaves the
 * range of the data: used for pressure). Otherwise the second-order three-point slope is used, except
 * where either neighbouring secant is exactly zero (a rest), where the slope is zero so a rest stays
 * still and does not swing out and back.
 */
function slopes(h: number[], v: readonly number[], monotone: boolean): Float64Array {
  const n = v.length, m = new Float64Array(n), s = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) s[i] = (v[i + 1] - v[i]) / h[i];
  if (n === 2) { m[0] = m[1] = s[0]; return m; }
  for (let i = 1; i < n - 1; i++) {
    if (monotone ? s[i - 1] * s[i] <= 0 : s[i - 1] === 0 || s[i] === 0) m[i] = 0;
    else if (monotone) {
      const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i]);
    } else m[i] = (h[i] * s[i - 1] + h[i - 1] * s[i]) / (h[i - 1] + h[i]);
  }
  const end = (h0: number, h1: number, s0: number, s1: number): number => {
    if (s0 === 0) return 0;
    const e = ((2 * h0 + h1) * s0 - h0 * s1) / (h0 + h1);
    if (!monotone) return e;
    if (Math.sign(e) !== Math.sign(s0)) return 0;
    if (Math.sign(s0) !== Math.sign(s1) && Math.abs(e) > 3 * Math.abs(s0)) return 3 * s0;
    return e;
  };
  m[0] = end(h[0], h[1], s[0], s[1]);
  m[n - 1] = end(h[n - 2], h[n - 3], s[n - 2], s[n - 3]);
  return m;
}

/** Sample the monotone Hermite reconstruction of `v(rel)` on the uniform grid `j * step`. */
function reconstruct(rel: number[], v: readonly number[], count: number, step: number, monotone: boolean): Float64Array {
  const n = rel.length, h = new Array<number>(n - 1);
  for (let i = 0; i < n - 1; i++) h[i] = rel[i + 1] - rel[i];
  const m = slopes(h, v, monotone), out = new Float64Array(count), duration = rel[n - 1];
  let i = 0;
  for (let j = 0; j < count; j++) {
    const tau = j === count - 1 ? duration : Math.min(j * step, duration);
    while (i < n - 2 && tau > rel[i + 1]) i++;
    const u = (tau - rel[i]) / h[i], u2 = u * u, u3 = u2 * u;
    out[j] = (2 * u3 - 3 * u2 + 1) * v[i] + (u3 - 2 * u2 + u) * h[i] * m[i] + (-2 * u3 + 3 * u2) * v[i + 1] + (u3 - u2) * h[i] * m[i + 1];
  }
  return out;
}

/** Gaussian smoothing with reflection about the end samples (odd for positions, even for pressure). */
function gaussian(values: Float64Array, sigma: number, odd: boolean): Float64Array {
  const n = values.length, r = Math.min(n - 1, Math.ceil(3 * sigma));
  if (sigma <= 0 || r < 1) return values;
  const w = new Float64Array(r + 1);
  let total = 0;
  for (let k = 0; k <= r; k++) { w[k] = Math.exp(-(k * k) / (2 * sigma * sigma)); total += k === 0 ? w[0] : 2 * w[k]; }
  for (let k = 0; k <= r; k++) w[k] /= total;
  const first = values[0], last = values[n - 1], out = new Float64Array(n);
  const at = (i: number): number => {
    if (i < 0) return odd ? 2 * first - values[-i] : values[-i];
    if (i > n - 1) return odd ? 2 * last - values[2 * (n - 1) - i] : values[2 * (n - 1) - i];
    return values[i];
  };
  for (let i = 0; i < n; i++) {
    let sum = w[0] * values[i];
    if (i >= r && i + r <= n - 1) for (let k = 1; k <= r; k++) sum += w[k] * (values[i - k] + values[i + k]);
    else for (let k = 1; k <= r; k++) sum += w[k] * (at(i - k) + at(i + k));
    out[i] = sum;
  }
  return out;
}

const frozen = (values: ArrayLike<number>): readonly number[] => Object.freeze(Array.from(values));

const trackCache = new Map<string, GestureTrack>();
const TRACK_CACHE = 24;

function lru<T>(cache: Map<string, T>, size: number, key: string, make: () => T): T {
  const hit = cache.get(key);
  if (hit !== undefined) { cache.delete(key); cache.set(key, hit); return hit; }
  const value = make();
  cache.set(key, value);
  if (cache.size > size) cache.delete(cache.keys().next().value!);
  return value;
}

/** Reconstruct, smooth and place a recording. Cached by recording content, smoothing and frame. */
export function gestureTrack(recording: Recording, options: TrackOptions): GestureTrack {
  const { smoothing, frame } = options;
  finite("smoothing", smoothing, 0, MAX_SMOOTHING);
  finite("frame scale", frame.scale, 0.01, 100);
  finite("frame rotation", frame.rotation, -1e6, 1e6);
  finite("frame centerX", frame.centerX, -1e6, 1e6);
  finite("frame centerY", frame.centerY, -1e6, 1e6);
  const key = [recordingFingerprint(recording), smoothing, frame.centerX, frame.centerY, frame.scale, frame.rotation].join("|");
  return lru(trackCache, TRACK_CACHE, key, () => buildTrack(recording, smoothing, frame));
}

function buildTrack(recording: Recording, smoothing: number, frame: GestureFrame): GestureTrack {
  const { duration } = recording;
  const count = Math.max(2, Math.ceil(duration / TRACK_STEP) + 1);
  if (count > MAX_TRACK_POINTS) throw new Error(`Recording "${recording.id}" needs ${count} grid points; the limit is ${MAX_TRACK_POINTS}`);
  const step = duration / (count - 1);
  const sigma = smoothing / step;
  const radius = Math.min(count - 1, Math.ceil(3 * sigma));
  if (sigma > 0 && count * (2 * radius + 1) * (recording.pressure ? 3 : 2) > MAX_KERNEL_WORK)
    throw new Error(`Smoothing ${smoothing} ms over ${count} grid points exceeds the work limit; lower the smoothing or use a shorter recording`);
  const rel = recording.t.map((value) => value - recording.t[0]);
  const qx = reconstruct(rel, recording.x, count, step, false), qy = reconstruct(rel, recording.y, count, step, false);
  const rx = gaussian(qx, sigma, true), ry = gaussian(qy, sigma, true);
  const rp = recording.pressure ? gaussian(reconstruct(rel, recording.pressure, count, step, true), sigma, false) : null;
  // The frame's anchor is the extent of the unsmoothed reconstruction: it does not depend on how often
  // the device reported (sample extremes miss peaks) or on the smoothing.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let j = 0; j < count; j++) {
    minX = Math.min(minX, qx[j]); maxX = Math.max(maxX, qx[j]);
    minY = Math.min(minY, qy[j]); maxY = Math.max(maxY, qy[j]);
  }
  const bx = (minX + maxX) / 2, by = (minY + maxY) / 2;
  const angle = frame.rotation * Math.PI / 180, cos = Math.cos(angle) * frame.scale, sin = Math.sin(angle) * frame.scale;
  const x = new Float64Array(count), y = new Float64Array(count);
  for (let j = 0; j < count; j++) {
    const dx = rx[j] - bx, dy = ry[j] - by;
    x[j] = frame.centerX + dx * cos - dy * sin;
    y[j] = frame.centerY + dx * sin + dy * cos;
  }
  const rateScale = 1000 / step;
  const speed = new Float64Array(count), arc = new Float64Array(count), tx = new Float64Array(count), ty = new Float64Array(count);
  const known = new Uint8Array(count);
  for (let j = 0; j < count; j++) {
    const a = Math.max(0, j - 1), b = Math.min(count - 1, j + 1);
    // Central difference inside; second-order one-sided differences at the two ends (the direction there is otherwise half a step late).
    const end = count > 2 && (j === 0 || j === count - 1), side = j === 0 ? 1 : -1;
    const dx = end ? side * (-3 * x[j] + 4 * x[j + side] - x[j + 2 * side]) : x[b] - x[a];
    const dy = end ? side * (-3 * y[j] + 4 * y[j + side] - y[j + 2 * side]) : y[b] - y[a];
    const len = Math.hypot(dx, dy);
    speed[j] = len * rateScale / (end ? 2 : b - a);
    if (j > 0) arc[j] = arc[j - 1] + Math.hypot(x[j] - x[j - 1], y[j] - y[j - 1]);
    if (len > 1e-9 * frame.scale + 1e-12) { tx[j] = dx / len; ty[j] = dy / len; known[j] = 1; }
  }
  // Pauses have no direction of their own: carry the last one forward, then the first one back.
  let firstKnown = known.indexOf(1);
  if (firstKnown < 0) { tx.fill(1); ty.fill(0); firstKnown = 0; }
  for (let j = 0; j < firstKnown; j++) { tx[j] = tx[firstKnown]; ty[j] = ty[firstKnown]; }
  for (let j = firstKnown + 1; j < count; j++) if (!known[j]) { tx[j] = tx[j - 1]; ty[j] = ty[j - 1]; }
  return Object.freeze({ id: recording.id, recording, step, count, duration, x: frozen(x), y: frozen(y), tx: frozen(tx), ty: frozen(ty),
    speed: frozen(speed), arc: frozen(arc), pressure: rp ? frozen(rp) : null, length: arc[count - 1] });
}

/** Another placement of the same track: rotation about `pivot`, then translation. Shares its scalar channels. */
export interface EchoOptions { index: number; turn: number; dx: number; dy: number; pivotX: number; pivotY: number }
const echoCache = new WeakMap<GestureTrack, Map<string, GestureTrack>>();
export function echoTrack(track: GestureTrack, options: EchoOptions): GestureTrack {
  const { index, turn, dx, dy, pivotX, pivotY } = options;
  if (!Number.isSafeInteger(index) || index < 0) throw new Error("Echo index must be a nonnegative integer");
  for (const [label, value] of [["turn", turn], ["dx", dx], ["dy", dy], ["pivotX", pivotX], ["pivotY", pivotY]] as const) finite(`echo ${label}`, value, -1e6, 1e6);
  if (index === 0) return track;
  let byKey = echoCache.get(track);
  if (!byKey) { byKey = new Map(); echoCache.set(track, byKey); }
  return lru(byKey, 24, [index, turn, dx, dy, pivotX, pivotY].join("|"), () => {
    const a = turn * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const x = new Array<number>(track.count), y = new Array<number>(track.count), tx = new Array<number>(track.count), ty = new Array<number>(track.count);
    for (let j = 0; j < track.count; j++) {
      const ux = track.x[j] - pivotX, uy = track.y[j] - pivotY;
      x[j] = pivotX + ux * c - uy * s + dx; y[j] = pivotY + ux * s + uy * c + dy;
      tx[j] = track.tx[j] * c - track.ty[j] * s; ty[j] = track.tx[j] * s + track.ty[j] * c;
    }
    return Object.freeze({ ...track, id: `${track.id}~${index}`, x: frozen(x), y: frozen(y), tx: frozen(tx), ty: frozen(ty) });
  });
}

export type PressureSource = "recorded" | "speed" | "constant";
/** What supplies pressure. A recording without a channel follows `whenAbsent`; there is no silent default. */
export interface PressurePolicy {
  source: PressureSource;
  /** Used only when `source` is "recorded" and the recording has no pressure channel. */
  whenAbsent: "speed" | "constant" | "reject";
  /** Constant pressure for source "constant" or whenAbsent "constant". */
  level: number;
}
export interface ResolvedPressure {
  /** One value in [0, 1] per grid point of the track. */
  readonly values: readonly number[];
  /** What actually supplied the values. */
  readonly source: PressureSource;
}

const speedCache = new WeakMap<GestureTrack, readonly number[]>();
/**
 * Pressure implied by speed: `1 / (1 + (v / v0)^2)` where `v0` is the median speed of the moving
 * part of the track (speeds above 5% of the maximum). A rest is 1, the typical speed 0.5, a flick
 * near 0. It depends on the whole track, never on a time window, and not on the frame's scale.
 */
export function speedPressure(track: GestureTrack): readonly number[] {
  const hit = speedCache.get(track);
  if (hit) return hit;
  const max = track.speed.reduce((m, v) => Math.max(m, v), 0);
  const moving = track.speed.filter((v) => v > 0.05 * max).sort((a, b) => a - b);
  const reference = moving.length ? moving[Math.floor(moving.length / 2)] : 1;
  const values = frozen(track.speed.map((v) => 1 / (1 + (v / reference) ** 2)));
  speedCache.set(track, values);
  return values;
}

const constantCache = new Map<string, readonly number[]>();
function constantPressure(count: number, level: number): readonly number[] {
  return lru(constantCache, 6, `${count}|${level}`, () => frozen(new Array<number>(count).fill(level)));
}

export function resolvePressure(track: GestureTrack, policy: PressurePolicy): ResolvedPressure {
  if (!["recorded", "speed", "constant"].includes(policy.source)) throw new Error(`Unknown pressure source: ${policy.source}`);
  if (!["speed", "constant", "reject"].includes(policy.whenAbsent)) throw new Error(`Unknown missing-pressure policy: ${policy.whenAbsent}`);
  finite("pressure level", policy.level, 0, 1);
  let source: PressureSource = policy.source;
  if (source === "recorded") {
    if (track.pressure) return { values: track.pressure, source };
    if (policy.whenAbsent === "reject")
      throw new Error(`Recording "${track.recording.id}" has no pressure channel; choose speed or constant pressure`);
    source = policy.whenAbsent;
  }
  return source === "speed" ? { values: speedPressure(track), source } : { values: constantPressure(track.count, policy.level), source };
}

/** Time window in milliseconds from the recording start. */
export interface TimeWindow { start: number; end: number }
export function checkWindow(track: GestureTrack, window: TimeWindow): TimeWindow {
  const { start, end } = window;
  finite("window start", start, 0, track.duration);
  finite("window end", end, 0, track.duration + 1e-6);
  if (!(end > start)) throw new Error(`Window end ${end} must be after its start ${start}`);
  return { start, end: Math.min(end, track.duration) };
}

/** Moments picked from the derived track. */
export type StationRule = { kind: "time"; interval: number } | { kind: "arc"; spacing: number };
export const MAX_STATIONS = 60_000;

/** Value of the track at one moment; the object is reused by `at`. */
export class TrackCursor {
  x = 0; y = 0; tx = 1; ty = 0; speed = 0; arc = 0; pressure = 0;
  constructor(readonly track: GestureTrack, readonly pressureValues: readonly number[]) {
    if (pressureValues.length !== track.count) throw new Error("Pressure must have one value per track grid point");
  }
  at(time: number): this {
    const { track } = this;
    const position = Math.min(Math.max(time, 0), track.duration) / track.step;
    const j = Math.min(track.count - 2, Math.floor(position)), f = position - j, g = 1 - f;
    this.x = g * track.x[j] + f * track.x[j + 1];
    this.y = g * track.y[j] + f * track.y[j + 1];
    let tx = g * track.tx[j] + f * track.tx[j + 1], ty = g * track.ty[j] + f * track.ty[j + 1];
    const len = Math.hypot(tx, ty);
    if (len > 1e-9) { tx /= len; ty /= len; } else { tx = track.tx[j]; ty = track.ty[j]; }
    this.tx = tx; this.ty = ty;
    this.speed = g * track.speed[j] + f * track.speed[j + 1];
    this.arc = g * track.arc[j] + f * track.arc[j + 1];
    this.pressure = g * this.pressureValues[j] + f * this.pressureValues[j + 1];
    return this;
  }
}

/** Arc length reached at a time. */
export function arcAt(track: GestureTrack, time: number): number {
  const position = Math.min(Math.max(time, 0), track.duration) / track.step;
  const j = Math.min(track.count - 2, Math.floor(position)), f = position - j;
  return (1 - f) * track.arc[j] + f * track.arc[j + 1];
}
/** The first time at which the path has travelled `s` (a rest keeps its arc, so it maps to its first moment). */
export function timeAtArc(track: GestureTrack, s: number): number {
  const { arc, count } = track;
  if (s <= 0) return 0;
  if (s >= arc[count - 1]) return track.duration;
  let lo = 0, hi = count - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arc[mid] >= s) hi = mid; else lo = mid + 1; }
  const f = (s - arc[lo - 1]) / (arc[lo] - arc[lo - 1]);
  return (lo - 1 + f) * track.step;
}

function checkRule(rule: StationRule): void {
  if (rule.kind === "time") finite("station interval", rule.interval, 0.5, 1e6);
  else if (rule.kind === "arc") finite("station spacing", rule.spacing, 0.05, 1e6);
  else throw new Error(`Unknown station rule: ${(rule as { kind: string }).kind}`);
}

/** Inclusive index range of the grid points inside `[low, high]` for grid spacing `unit`. */
export function gridRange(low: number, high: number, unit: number): [number, number] {
  const tolerance = 1e-9 * Math.max(1, high / unit);
  return [Math.ceil(low / unit - tolerance), Math.floor(high / unit + tolerance)];
}

/** How many stations the rule places in the window (the work bound checked before building anything). */
export function countStations(track: GestureTrack, rule: StationRule, window: TimeWindow): number {
  checkRule(rule);
  const w = checkWindow(track, window);
  const [a, b] = rule.kind === "time" ? gridRange(w.start, w.end, rule.interval)
    : gridRange(arcAt(track, w.start), arcAt(track, w.end), rule.spacing);
  return Math.max(0, b - a + 1);
}

export interface Stations {
  /** Grid indices from the recording start (`time = k * interval`, or `arc = k * spacing`). */
  readonly indices: readonly number[];
  /** Milliseconds from the recording start. */
  readonly times: readonly number[];
}
/** Stations of the rule inside the window, anchored at the recording start. */
export function stations(track: GestureTrack, rule: StationRule, window: TimeWindow, label = "stations"): Stations {
  const count = countStations(track, rule, window);
  if (count > MAX_STATIONS)
    throw new Error(`${label} would place ${count} stations; the limit is ${MAX_STATIONS}. Raise the ${rule.kind === "time" ? "interval" : "spacing"} or narrow the window`);
  const w = checkWindow(track, window);
  const indices: number[] = [], times: number[] = [];
  if (count === 0) return Object.freeze({ indices: Object.freeze(indices), times: Object.freeze(times) });
  if (rule.kind === "time") {
    const [a] = gridRange(w.start, w.end, rule.interval);
    for (let k = a; k < a + count; k++) { indices.push(k); times.push(Math.min(Math.max(k * rule.interval, w.start), w.end)); }
  } else {
    const [a] = gridRange(arcAt(track, w.start), arcAt(track, w.end), rule.spacing);
    for (let k = a; k < a + count; k++) { indices.push(k); times.push(Math.min(Math.max(timeAtArc(track, k * rule.spacing), w.start), w.end)); }
  }
  return Object.freeze({ indices: Object.freeze(indices), times: Object.freeze(times) });
}
