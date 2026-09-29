import { rasterStorage, sha256Hex } from "./raster.js";
import type { Raster } from "./raster.js";

/**
 * Owned frame sequences (F3, asset inputs; the sequence half of the slit-composition study).
 *
 * Input contract. A `FrameStack` is a resolved, immutable, deeply frozen value: an ordered list of
 * `Raster` frames and one timestamp per frame, in SECONDS, strictly increasing. The library never
 * decodes video, captures a camera or fetches frames; a host (or the bundled generators in
 * `frame-samples.ts`) resolves them and `createFrameStack` validates. Every frame must share
 * width, height, channels, format, color space and alpha mode, so a slit that crosses the stack is
 * one well-defined sampling of one image space. A missing frame is an error naming its index, never a
 * repeated neighbour. Frames are not copied (a `Raster` is already immutable); the arrays are frozen.
 *
 * Time. The stack covers `[start, end]` = first and last timestamp. `resolveFrameTime` turns any real
 * time into (frame, next frame, mix) under two explicit policies:
 *
 * - interpolation: `hold` (a frame stays until the next timestamp, like video), `nearest` (the
 *   closest timestamp; an exact tie takes the later frame) or `linear` (a cross-fade between the two
 *   surrounding frames; the caller mixes in linear light).
 * - end behaviour for times outside `[start, end]`: `clamp` (first/last frame), `loop` (period
 *   `end - start`), `mirror` (period `2 (end - start)`, reflecting) or `fail` (throws, naming the
 *   time and the limits). A stack of one frame, or with zero duration, always resolves to that frame.
 *
 * Content hash: `hash` is SHA-256 of `"procedural-frame-stack/1\n" + count + "\n"` followed, per frame,
 * by the frame's raster hash and its timestamp (shortest round-trip decimal) on separate lines. The
 * `id` is diagnostic and not hashed.
 *
 * Bounds: 1..256 frames and at most 16,777,216 pixels in all (the same total as one raster), checked
 * before anything is read; messages name what to reduce.
 */
export const FRAME_STACK_LIMITS = Object.freeze({ maxFrames: 256, maxPixels: 16_777_216 });

export type Interpolation = "hold" | "nearest" | "linear";
export type EndBehaviour = "clamp" | "loop" | "mirror" | "fail";

export interface FrameStackData {
  /** Diagnostic name for messages; not hashed. */
  id: string;
  /** Seconds, strictly increasing, one per frame. */
  times: readonly number[];
  frames: readonly Raster[];
}

export interface FrameStack {
  readonly id: string;
  readonly times: readonly number[];
  readonly frames: readonly Raster[];
  readonly count: number;
  readonly width: number;
  readonly height: number;
  /** First timestamp, seconds. */
  readonly start: number;
  /** Last timestamp, seconds. */
  readonly end: number;
  /** `end - start`; 0 for one frame. */
  readonly duration: number;
  /** Lowercase hex SHA-256 of the content, see the module header. */
  readonly hash: string;
}

/** Validate and freeze a stack. Failures name the frame or timestamp index. */
export function createFrameStack(data: FrameStackData): FrameStack {
  if (data === null || typeof data !== "object" || Array.isArray(data)) throw new Error("Frame stack data must be an object");
  const { id, times, frames } = data;
  if (typeof id !== "string") throw new Error("Frame stack id must be a string");
  if (!Array.isArray(frames) || !Array.isArray(times)) throw new Error(`Frame stack "${id}": frames and times must be arrays`);
  const count = frames.length;
  if (count < 1 || count > FRAME_STACK_LIMITS.maxFrames)
    throw new Error(`Frame stack "${id}" has ${count} frames; it needs 1 to ${FRAME_STACK_LIMITS.maxFrames}. Reduce the number of frames`);
  if (times.length !== count) throw new Error(`Frame stack "${id}" has ${count} frames but ${times.length} timestamps`);
  for (let k = 0; k < count; k++) {
    const frame = frames[k] as Raster | undefined | null;
    if (frame === undefined || frame === null) throw new Error(`Frame stack "${id}": frame ${k} is missing (frames[${k}] is ${String(frame)})`);
    try { rasterStorage(frame); } catch { throw new Error(`Frame stack "${id}": frame ${k} is not a Raster created by createRaster`); }
    const t = times[k];
    if (typeof t !== "number" || !Number.isFinite(t)) throw new Error(`Frame stack "${id}": timestamp ${k} must be a finite number of seconds`);
    if (k > 0 && !(t > times[k - 1])) throw new Error(`Frame stack "${id}": timestamp ${k} (${t}) must be greater than timestamp ${k - 1} (${times[k - 1]})`);
  }
  const first = frames[0];
  for (let k = 1; k < count; k++) {
    const f = frames[k];
    for (const key of ["width", "height", "channels", "format", "colorSpace", "alpha"] as const)
      if (f[key] !== first[key]) throw new Error(`Frame stack "${id}": frame ${k} has ${key} ${String(f[key])} but frame 0 has ${String(first[key])}`);
  }
  if (count * first.width * first.height > FRAME_STACK_LIMITS.maxPixels)
    throw new Error(`Frame stack "${id}": ${count} frames of ${first.width} x ${first.height} exceed ${FRAME_STACK_LIMITS.maxPixels} pixels; use fewer or smaller frames`);
  const encoder = new TextEncoder();
  const chunks = [encoder.encode(`procedural-frame-stack/1\n${count}\n`)];
  for (let k = 0; k < count; k++) chunks.push(encoder.encode(`${frames[k].hash}\n${times[k]}\n`));
  return Object.freeze({
    id, times: Object.freeze([...times]), frames: Object.freeze([...frames]), count, width: first.width, height: first.height,
    start: times[0], end: times[count - 1], duration: times[count - 1] - times[0], hash: sha256Hex(...chunks),
  });
}

/** A frame pair and the weight of the second. Under `hold` and `nearest` the weight is 0 and both indices are equal. */
export interface ResolvedTime {
  /** The time actually read, after the end behaviour (seconds). */
  readonly time: number;
  readonly frame: number;
  readonly next: number;
  /** Weight of `next` in [0, 1); 0 unless the interpolation is `linear`. */
  readonly mix: number;
}

/** Position of the last timestamp <= t (0 when t precedes the first). */
function lastAtOrBefore(times: readonly number[], t: number): number {
  let low = 0, high = times.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (times[mid] <= t) low = mid; else high = mid - 1;
  }
  return low;
}

/** Apply the end behaviour and interpolation policy to one time. `hint` is appended to the `fail` message. */
export function resolveFrameTime(stack: FrameStack, time: number, interpolation: Interpolation, end: EndBehaviour, hint = ""): ResolvedTime {
  if (typeof time !== "number" || !Number.isFinite(time)) throw new Error(`Frame time must be a finite number of seconds (got ${String(time)})`);
  if (interpolation !== "hold" && interpolation !== "nearest" && interpolation !== "linear") throw new Error(`Unknown interpolation: ${String(interpolation)}`);
  if (end !== "clamp" && end !== "loop" && end !== "mirror" && end !== "fail") throw new Error(`Unknown end behaviour: ${String(end)}`);
  const { times, start, duration, count } = stack;
  let t = time;
  if (count === 1 || duration === 0) t = start;
  else if (t < start || t > stack.end) {
    switch (end) {
      case "clamp": t = t < start ? start : stack.end; break;
      case "loop": { const r = (t - start) % duration; t = start + (r < 0 ? r + duration : r); break; }
      case "mirror": {
        const period = 2 * duration, r = ((t - start) % period + period) % period;
        t = start + (r <= duration ? r : period - r);
        break;
      }
      default:
        throw new Error(`Time ${time} s is outside the frame sequence [${start}, ${stack.end}] s and the end behaviour is fail${hint ? `. ${hint}` : ""}`);
    }
  }
  const k = lastAtOrBefore(times, t);
  if (k === count - 1) return { time: t, frame: k, next: k, mix: 0 };
  const span = times[k + 1] - times[k], f = (t - times[k]) / span;
  if (interpolation === "hold") return { time: t, frame: k, next: k, mix: 0 };
  if (interpolation === "nearest") { const n = f >= 0.5 ? k + 1 : k; return { time: t, frame: n, next: n, mix: 0 }; }
  return { time: t, frame: k, next: k + 1, mix: f };
}
