import { sequenceFingerprint } from "./control-sequence.js";
import type { ControlSequence } from "./control-sequence.js";
import { reconstruct } from "./recording.js";
import type { GestureFrame } from "./recording.js";
import type { Point } from "./types.js";

/**
 * The curve family of a control sequence: the spline through the moving control points sampled over
 * curve AND time. This is the producer every deposition consumer reads (grain release, isolines, a crisp
 * overlay of the generating curve); none of them stores palette, mark, exposure or material.
 *
 * Construction. (1) Each control point's keyframes are reconstructed on ONE canonical uniform time
 * grid (`step = duration / (frames - 1)`, `step <= FAMILY_STEP` ms up to about 48 s, the grid caps at
 * `MAX_FAMILY_FRAMES` beyond) by the same piecewise-cubic Hermite reconstruction as recordings, so the
 * family depends on the curve and its timing, not on how densely the keyframes were given. (2) MOTION
 * scales every control point's excursion about its own time-average: `p = mean + motion * (p - mean)`.
 * Motion 0 freezes the sequence at its average shape, 1 is the sequence as supplied, above 1
 * exaggerates it. (3) The FRAME is a similarity (uniform scale, rotation in degrees, positive turning
 * clockwise on screen) about the centre of the bounding box of the UNSCALED reconstructed control points
 * over all time, sending that centre to (`centerX`, `centerY`); motion therefore never moves the
 * placement. (4) At each grid time the controls define a uniform Catmull-Rom curve (open: reflected ends,
 * closed: wrapped), flattened at 10 chords per span and resampled at `FAMILY_SAMPLES + 1` points of
 * equal arc length, so parameter `u` in [0, 1] is the fraction of the curve's length at every time.
 *
 * Published: `x`, `y` (`frames * (samples + 1)` values, row-major, row = time), the length of the curve
 * at each grid time, and the cumulative integral of length over time. Typed arrays cannot be frozen; the
 * builder never touches them after publishing and the type is read-only. Everything is cached (12
 * entries) by sequence content, motion and frame.
 *
 * Reading. `CurveCursor.at(time, u)` interpolates bilinearly (time, arc parameter) and reports the
 * position, the velocity OF THE MATERIAL POINT at fixed `u` (canvas units per second, by the difference
 * of the two enclosing frames), the tangent and the length. `lengthIntegral(a, b)` is exact for the
 * piecewise-linear length, in canvas units times seconds. `curveAtTime` publishes one curve's points.
 *
 * Units: canvas units, milliseconds for times, speeds per second. Work: `frames * (10 * spans +
 * samples)`, at most about 6,000 * 1,300 operations.
 */

export const FAMILY_STEP = 8;
export const MAX_FAMILY_FRAMES = 6_000;
export const FAMILY_SAMPLES = 512;
const CHORDS = 10;

export interface FamilyOptions {
  /** Excursion multiplier about each control's time-average, in [0, 4]. */
  motion: number;
  frame: GestureFrame;
}
export interface CurveFamily {
  readonly id: string;
  readonly closed: boolean;
  /** Milliseconds between grid times. */
  readonly step: number;
  readonly frames: number;
  /** Milliseconds; the family covers [0, duration]. */
  readonly duration: number;
  /** Arc-length intervals per curve; each curve has `samples + 1` points. */
  readonly samples: number;
  readonly x: Readonly<Float64Array>;
  readonly y: Readonly<Float64Array>;
  /** Length of the curve at each grid time, canvas units. */
  readonly length: readonly number[];
  /** Integral of `length` over time from 0 to each grid time, canvas units times milliseconds. */
  readonly cumulative: readonly number[];
}

function finite(label: string, value: number, low: number, high: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high)
    throw new Error(`${label} must be a finite number in [${low}, ${high}]`);
}

const cache = new Map<string, CurveFamily>();
const CACHE_SIZE = 12;

/** Reconstruct, scale, place and sample a sequence. Cached by sequence content, motion and frame. */
export function curveFamily(sequence: ControlSequence, options: FamilyOptions): CurveFamily {
  const { motion, frame } = options;
  finite("motion", motion, 0, 4);
  finite("frame scale", frame.scale, 0.01, 100);
  finite("frame rotation", frame.rotation, -1e6, 1e6);
  finite("frame centerX", frame.centerX, -1e6, 1e6);
  finite("frame centerY", frame.centerY, -1e6, 1e6);
  const key = [sequenceFingerprint(sequence), motion, frame.centerX, frame.centerY, frame.scale, frame.rotation].join("|");
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const built = buildFamily(sequence, motion, frame);
  cache.set(key, built);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return built;
}

/** Catmull-Rom point of the span between `p1` and `p2` (`p0`, `p3` their neighbours) at `u` in [0, 1). */
function spline(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (3 * p1 - p0 - 3 * p2 + p3) * u3);
}

function buildFamily(sequence: ControlSequence, motion: number, frame: GestureFrame): CurveFamily {
  const { duration, count, closed } = sequence;
  const frames = Math.min(MAX_FAMILY_FRAMES, Math.max(2, Math.ceil(duration / FAMILY_STEP) + 1));
  const step = duration / (frames - 1);
  const rel = sequence.t.map((value) => value - sequence.t[0]);
  // Reconstruct each control point on the grid, then scale its excursion about its own average.
  const cx: Float64Array[] = [], cy: Float64Array[] = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    const qx = reconstruct(rel, sequence.controls.map((row) => row[i][0]), frames, step, false);
    const qy = reconstruct(rel, sequence.controls.map((row) => row[i][1]), frames, step, false);
    let mx = 0, my = 0;
    for (let j = 0; j < frames; j++) {
      mx += qx[j]; my += qy[j];
      minX = Math.min(minX, qx[j]); maxX = Math.max(maxX, qx[j]); minY = Math.min(minY, qy[j]); maxY = Math.max(maxY, qy[j]);
    }
    mx /= frames; my /= frames;
    for (let j = 0; j < frames; j++) { qx[j] = mx + motion * (qx[j] - mx); qy[j] = my + motion * (qy[j] - my); }
    cx.push(qx); cy.push(qy);
  }
  const bx = (minX + maxX) / 2, by = (minY + maxY) / 2;
  const angle = frame.rotation * Math.PI / 180, cos = Math.cos(angle) * frame.scale, sin = Math.sin(angle) * frame.scale;
  for (let i = 0; i < count; i++) for (let j = 0; j < frames; j++) {
    const dx = cx[i][j] - bx, dy = cy[i][j] - by;
    cx[i][j] = frame.centerX + dx * cos - dy * sin; cy[i][j] = frame.centerY + dx * sin + dy * cos;
  }
  const samples = FAMILY_SAMPLES, row = samples + 1;
  const x = new Float64Array(frames * row), y = new Float64Array(frames * row);
  const length = new Array<number>(frames), cumulative = new Array<number>(frames);
  const spans = closed ? count : count - 1, chords = spans * CHORDS + 1;
  const px = new Float64Array(chords), py = new Float64Array(chords), arc = new Float64Array(chords);
  // Neighbour lookup: reflected ends for open curves, wrap-around for closed ones.
  const at = (channel: readonly Float64Array[], j: number, index: number): number => {
    if (closed) return channel[(index + count) % count][j];
    if (index < 0) return 2 * channel[0][j] - channel[1][j];
    if (index >= count) return 2 * channel[count - 1][j] - channel[count - 2][j];
    return channel[index][j];
  };
  for (let j = 0; j < frames; j++) {
    let n = 0;
    for (let s = 0; s < spans; s++) for (let m = 0; m < CHORDS; m++, n++) {
      const u = m / CHORDS;
      px[n] = spline(at(cx, j, s - 1), at(cx, j, s), at(cx, j, s + 1), at(cx, j, s + 2), u);
      py[n] = spline(at(cy, j, s - 1), at(cy, j, s), at(cy, j, s + 1), at(cy, j, s + 2), u);
    }
    px[n] = at(cx, j, spans % count); py[n] = at(cy, j, spans % count); n++;
    arc[0] = 0;
    for (let k = 1; k < n; k++) arc[k] = arc[k - 1] + Math.hypot(px[k] - px[k - 1], py[k] - py[k - 1]);
    const total = arc[n - 1];
    length[j] = total;
    let seg = 1;
    for (let k = 0; k <= samples; k++) {
      const target = total * k / samples;
      while (seg < n - 1 && arc[seg] < target) seg++;
      const span = arc[seg] - arc[seg - 1], f = span > 0 ? (target - arc[seg - 1]) / span : 0;
      x[j * row + k] = px[seg - 1] + (px[seg] - px[seg - 1]) * f;
      y[j * row + k] = py[seg - 1] + (py[seg] - py[seg - 1]) * f;
    }
    cumulative[j] = j === 0 ? 0 : cumulative[j - 1] + (length[j - 1] + length[j]) / 2 * step;
  }
  return Object.freeze({ id: sequence.id, closed, step, frames, duration, samples, x, y,
    length: Object.freeze(length), cumulative: Object.freeze(cumulative) });
}

/** Integral of the curve's length over `[from, to]` ms, in canvas units times SECONDS (exact for the piecewise-linear length). */
export function lengthIntegral(family: CurveFamily, from: number, to: number): number {
  const upTo = (time: number): number => {
    const position = Math.min(Math.max(time, 0), family.duration) / family.step;
    const j = Math.min(family.frames - 2, Math.floor(position)), f = position - j;
    const a = family.length[j], b = family.length[j + 1], here = a + (b - a) * f;
    return family.cumulative[j] + (a + here) / 2 * f * family.step;
  };
  return (upTo(to) - upTo(from)) / 1000;
}

/** Value of the family at one time and arc parameter; the object is reused by `at`. */
export class CurveCursor {
  x = 0; y = 0;
  /** Velocity of the material point at this arc parameter, canvas units per second. */
  vx = 0; vy = 0;
  /** Unit tangent of the curve (in the direction of increasing `u`). */
  tx = 1; ty = 0;
  /** Length of the whole curve at this time. */
  length = 0;
  constructor(readonly family: CurveFamily) {}
  at(time: number, u: number): this {
    const { family } = this;
    const row = family.samples + 1;
    const position = Math.min(Math.max(time, 0), family.duration) / family.step;
    const j = Math.min(family.frames - 2, Math.floor(position)), f = position - j;
    const pu = Math.min(Math.max(u, 0), 1) * family.samples, i = Math.min(family.samples - 1, Math.floor(pu)), g = pu - i;
    const a = j * row + i, b = (j + 1) * row + i;
    const ax = family.x[a] + (family.x[a + 1] - family.x[a]) * g, ay = family.y[a] + (family.y[a + 1] - family.y[a]) * g;
    const bx = family.x[b] + (family.x[b + 1] - family.x[b]) * g, by = family.y[b] + (family.y[b + 1] - family.y[b]) * g;
    this.x = ax + (bx - ax) * f; this.y = ay + (by - ay) * f;
    const rate = 1000 / family.step;
    this.vx = (bx - ax) * rate; this.vy = (by - ay) * rate;
    const dx = (1 - f) * (family.x[a + 1] - family.x[a]) + f * (family.x[b + 1] - family.x[b]);
    const dy = (1 - f) * (family.y[a + 1] - family.y[a]) + f * (family.y[b + 1] - family.y[b]);
    const size = Math.hypot(dx, dy);
    if (size > 1e-12) { this.tx = dx / size; this.ty = dy / size; }
    this.length = family.length[j] + (family.length[j + 1] - family.length[j]) * f;
    return this;
  }
}

/** The curve at one time as `samples + 1` points of equal arc length (a fresh frozen array). */
export function curveAtTime(family: CurveFamily, time: number): readonly Point[] {
  const cursor = new CurveCursor(family), points: Point[] = [];
  for (let k = 0; k <= family.samples; k++) { cursor.at(time, k / family.samples); points.push(Object.freeze([cursor.x, cursor.y] as const)); }
  return Object.freeze(points);
}
