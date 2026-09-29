import type { Point } from "./types.js";

/**
 * Replaceable pattern functions for optical plates, Registered Screens and Interference Lace.
 *
 * A pattern is exact geometry, never a sampled image. Lines, rings and spokes are emitted as
 * polylines whose vertices lie on the ideal curve; dot lattices are emitted as sites. The only
 * approximation is the flattening of a curved element, governed by one stated rule:
 *
 *   SAMPLING RULE — every vertex lies on the ideal curve and no chord deviates from it by more
 *   than `flatness` canvas units (default 0.02). Vertex spacing is derived from that bound and
 *   the curve's own curvature (`r(1 − cos(π/n)) ≤ flatness` for a ring of radius r; step
 *   `√(8·flatness/κmax)` along a sinusoidal line). No sample lattice is ever tied to a preview
 *   or export pixel grid, so nothing here can beat against the device raster. Straight
 *   elements have exactly two vertices.
 *
 * What the drawing device does with the strokes (its own antialiasing) is outside this rule.
 * `MIN_PERIOD` keeps every local element spacing at three canvas units or more: at least three
 * device pixels per period at 1:1 and proportionally more at export scale, above the two-pixel
 * Nyquist limit at which a raster starts to alias a periodic screen. Sampling a screen at a
 * grid coarser than its period is exactly what invents moiré; rendering strokes at any
 * resolution does not.
 *
 * Inputs: canvas-unit frames (angles in radians), periods, phases in cycles. Output: frozen
 * plain values with ids derived from the pattern's own lattice indices (a line's id is its
 * integer index counted from the frame origin), never from draw order or support. Failure:
 * every invalid argument or exceeded bound throws an `Error` naming it; nothing is thinned,
 * clamped or silently omitted. Randomness: none; patterns are fully determined by their inputs.
 */
export const MIN_PERIOD = 3;
export const DEFAULT_FLATNESS = 0.02;
export const MAX_PATTERN_LINES = 4_000;
export const MAX_PATTERN_VERTICES = 400_000;
export const MAX_PATTERN_DOTS = 40_000;
export const MAX_SPOKES = 720;
const TAU = 2 * Math.PI;

export type PatternSpec =
  | { kind: "grating"; period: number; chirp: number }
  | { kind: "rings"; period: number; chirp: number }
  | { kind: "dots"; period: number; lattice: "square" | "hex" }
  | { kind: "waves"; period: number; chirp: number; amplitude: number; wavelength: number }
  | { kind: "spokes"; count: number; hub: number };

/** Where and how a pattern must be produced. Every point that will be used lies within `reach` of (x, y). */
export interface PatternRequest {
  readonly x: number;
  readonly y: number;
  /** Radians; the pattern's own x axis in canvas coordinates. */
  readonly angle: number;
  readonly reach: number;
  /** Cycles. A shift by `phase × period` along the pattern's primary coordinate (see each pattern). */
  readonly phase: number;
  readonly flatness: number;
}
export interface PatternStroke {
  /** Unique within one pattern output; derived from lattice indices only. */
  readonly id: string;
  readonly points: readonly Point[];
  readonly closed: boolean;
}
export interface PatternDot {
  readonly id: string;
  readonly position: Point;
  readonly angle: number;
}
export interface PatternElements {
  readonly strokes: readonly PatternStroke[];
  readonly dots: readonly PatternDot[];
  /** Smallest local center-to-center or line-to-line distance, in canvas units. */
  readonly minPeriod: number;
}
/** The replacement point: any function of this type can stand in for a stock pattern. */
export type PatternFunction = (request: PatternRequest) => PatternElements;

function finite(label: string, value: number, min: number, max: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}
function checkRequest(request: PatternRequest): void {
  finite("Pattern origin x", request.x, -1e6, 1e6); finite("Pattern origin y", request.y, -1e6, 1e6);
  finite("Pattern angle", request.angle, -1e4, 1e4); finite("Pattern reach", request.reach, 0, 1e5);
  finite("Pattern phase", request.phase, -1e6, 1e6); finite("Pattern flatness", request.flatness, 0.001, 10);
}

// --- Frequency drift -------------------------------------------------------------------
// Local frequency f(u) = (1 + chirp·u/100)/period at distance u from the frame origin, so the
// counted phase is φ(u) = (u + chirp·u²/200)/period and line m sits where φ(u) = m. The
// closed-form inverse is u = 2P/(1 + √(1 + chirp·P/50)) with P = period·m (stable at chirp 0,
// where it is exactly P). Because 1 + chirp·P/50 = (1 + chirp·u/100)², the root is real
// wherever the local frequency is positive, which `driftLimits` guarantees over the reach.
export function driftPhase(u: number, period: number, chirp: number): number {
  return (u + chirp * u * u / 200) / period;
}
export function driftPosition(cycles: number, period: number, chirp: number): number {
  const p = period * cycles;
  return 2 * p / (1 + Math.sqrt(1 + chirp * p / 50));
}
/** Smallest local period over |u| ≤ reach; throws unless the drift keeps frequency positive and the period ≥ MIN_PERIOD. */
export function driftLimits(period: number, chirp: number, reach: number): number {
  finite("Period", period, MIN_PERIOD, 1e5); finite("Frequency drift", chirp, -1, 1);
  const span = Math.abs(chirp) * reach / 100;
  if (span > 0.8) throw new Error(`Frequency drift ${chirp} over a reach of ${Math.round(reach)} units changes the local frequency by more than 80%; reduce the drift or the plate size`);
  const smallest = period / (1 + span);
  if (smallest < MIN_PERIOD) throw new Error(`Frequency drift shrinks the local period to ${smallest.toFixed(2)} units, below the ${MIN_PERIOD}-unit minimum`);
  return smallest;
}

// --- Exact, index-addressed line primitive (shared by Registered Screens and plates) ----
export interface GratingLineOptions {
  readonly originX: number;
  readonly originY: number;
  /** Radians; direction of the lines. The normal is (−sin, cos). */
  readonly angle: number;
  /** Normal position of each line, in canvas units. */
  readonly offsets: readonly number[];
  /** Half-length along the direction; every line runs from −travel to travel. */
  readonly travel: number;
  /** Equal parameter intervals per line (1 for straight lines). */
  readonly steps: number;
  /** Peak normal displacement of a sinusoidal wave; zero leaves lines straight. */
  readonly curve: number;
  /** `waveCycles` waves per `waveSpan` canvas units of travel. */
  readonly waveCycles: number;
  readonly waveSpan: number;
}
/** One polyline per offset: `origin + d·t + n·(offset + curve·sin(2π·waveCycles·t/waveSpan))`. */
export function gratingLines(options: GratingLineOptions): Point[][] {
  const { originX, originY, angle, offsets, travel, steps, curve, waveCycles, waveSpan } = options;
  const dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx;
  const lines: Point[][] = [];
  for (const shift of offsets) {
    const line: Point[] = [];
    for (let step = 0; step <= steps; step++) {
      const t = -travel + 2 * travel * step / steps;
      const normal = shift + curve * Math.sin(TAU * waveCycles * t / waveSpan);
      line.push([originX + dx * t + nx * normal, originY + dy * t + ny * normal]);
    }
    lines.push(line);
  }
  return lines;
}

const freezePoint = (x: number, y: number): Point => Object.freeze([x, y] as const);
function world(request: PatternRequest): (lx: number, ly: number) => Point {
  const c = Math.cos(request.angle), s = Math.sin(request.angle);
  return (lx, ly) => freezePoint(request.x + c * lx - s * ly, request.y + s * lx + c * ly);
}
/** Lattice indices whose counted phase lands within |u| ≤ bound. */
function indexRange(period: number, chirp: number, phase: number, bound: number): [number, number] {
  return [Math.ceil(driftPhase(-bound, period, chirp) - phase), Math.floor(driftPhase(bound, period, chirp) - phase)];
}
function checkCount(label: string, count: number, limit: number): void {
  if (count > limit) throw new Error(`${label} needs ${Math.ceil(count)} elements; limit ${limit}. Increase the period or reduce the plate.`);
}

/** Parallel lines, counted from the frame origin along the normal. Phase slides the family along its normal. */
function gratingPattern(spec: Extract<PatternSpec, { kind: "grating" }>): PatternFunction {
  finite("Period", spec.period, MIN_PERIOD, 1e5); finite("Frequency drift", spec.chirp, -1, 1);
  return (request) => {
    checkRequest(request);
    const minPeriod = driftLimits(spec.period, spec.chirp, request.reach);
    const [first, last] = indexRange(spec.period, spec.chirp, request.phase, request.reach);
    checkCount("Grating", last - first + 1, MAX_PATTERN_LINES);
    const toWorld = world(request), strokes: PatternStroke[] = [];
    for (let k = first; k <= last; k++) {
      const u = driftPosition(k + request.phase, spec.period, spec.chirp);
      const half = Math.sqrt(Math.max(0, request.reach * request.reach - u * u));
      strokes.push(Object.freeze({ id: `line:${k}`, closed: false,
        points: Object.freeze([toWorld(-half, u), toWorld(half, u)]) }));
    }
    return { strokes, dots: [], minPeriod };
  };
}

/** A grating whose lines are displaced along their normal by a sine of the distance along them. */
function wavesPattern(spec: Extract<PatternSpec, { kind: "waves" }>): PatternFunction {
  finite("Period", spec.period, MIN_PERIOD, 1e5); finite("Frequency drift", spec.chirp, -1, 1);
  finite("Wave amplitude", spec.amplitude, 0, 1e4); finite("Wavelength", spec.wavelength, 4, 1e5);
  return (request) => {
    checkRequest(request);
    const bound = request.reach + spec.amplitude;
    const minPeriod = driftLimits(spec.period, spec.chirp, bound);
    const [first, last] = indexRange(spec.period, spec.chirp, request.phase, bound);
    checkCount("Wave grating", last - first + 1, MAX_PATTERN_LINES);
    // Chord deviation of a sine: κmax = A·(2π/λ)², so a step h keeps it below h²·κmax/8 ≤ flatness.
    const curvature = spec.amplitude * (TAU / spec.wavelength) ** 2;
    const steps = spec.amplitude === 0 ? 1 :
      Math.max(2, Math.ceil(2 * request.reach / Math.sqrt(8 * request.flatness / curvature)));
    checkCount("Wave grating vertices", (last - first + 1) * (steps + 1), MAX_PATTERN_VERTICES);
    const offsets: number[] = [];
    for (let k = first; k <= last; k++) offsets.push(driftPosition(k + request.phase, spec.period, spec.chirp));
    const lines = gratingLines({ originX: request.x, originY: request.y, angle: request.angle, offsets,
      travel: request.reach, steps, curve: spec.amplitude, waveCycles: 1, waveSpan: spec.wavelength });
    const strokes = lines.map((line, index): PatternStroke => Object.freeze({ id: `line:${first + index}`,
      closed: false, points: Object.freeze(line.map(([x, y]) => freezePoint(x, y))) }));
    return { strokes, dots: [], minPeriod };
  };
}

/** Concentric circles about the frame origin; phase grows the rings outward by that fraction of a period. */
function ringsPattern(spec: Extract<PatternSpec, { kind: "rings" }>): PatternFunction {
  finite("Period", spec.period, MIN_PERIOD, 1e5); finite("Frequency drift", spec.chirp, -1, 1);
  return (request) => {
    checkRequest(request);
    const minPeriod = driftLimits(spec.period, spec.chirp, request.reach);
    const first = Math.floor(-request.phase) + 1;
    const last = Math.floor(driftPhase(request.reach, spec.period, spec.chirp) - request.phase);
    checkCount("Rings", last - first + 1, MAX_PATTERN_LINES);
    const strokes: PatternStroke[] = [];
    let vertices = 0;
    for (let k = first; k <= last; k++) {
      const r = driftPosition(k + request.phase, spec.period, spec.chirp);
      if (!(r > 0)) continue;
      // Inscribed regular polygon: sagitta r(1 − cos(π/n)) ≤ flatness.
      const n = r <= request.flatness ? 12 : Math.max(12, Math.ceil(Math.PI / Math.acos(1 - request.flatness / r)));
      vertices += n; checkCount("Ring vertices", vertices, MAX_PATTERN_VERTICES);
      const points: Point[] = [];
      for (let j = 0; j < n; j++) {
        const a = request.angle + TAU * j / n;
        points.push(freezePoint(request.x + r * Math.cos(a), request.y + r * Math.sin(a)));
      }
      strokes.push(Object.freeze({ id: `ring:${k}`, closed: true, points: Object.freeze(points) }));
    }
    return { strokes, dots: [], minPeriod };
  };
}

/** Straight rays from a hub to the reach. Phase turns the family by that fraction of one spoke gap. */
function spokesPattern(spec: Extract<PatternSpec, { kind: "spokes" }>): PatternFunction {
  if (!Number.isInteger(spec.count) || spec.count < 2 || spec.count > MAX_SPOKES)
    throw new Error(`Spoke count must be an integer in [2, ${MAX_SPOKES}]`);
  finite("Hub radius", spec.hub, 0, 1e5);
  return (request) => {
    checkRequest(request);
    // Adjacent spokes are 2π·r/count apart at radius r: never start closer than MIN_PERIOD.
    const hub = Math.max(spec.hub, spec.count * MIN_PERIOD / TAU);
    const strokes: PatternStroke[] = [];
    if (hub < request.reach) for (let k = 0; k < spec.count; k++) {
      const a = request.angle + TAU * (k + request.phase) / spec.count, c = Math.cos(a), s = Math.sin(a);
      strokes.push(Object.freeze({ id: `spoke:${k}`, closed: false, points: Object.freeze([
        freezePoint(request.x + hub * c, request.y + hub * s),
        freezePoint(request.x + request.reach * c, request.y + request.reach * s)]) }));
    }
    return { strokes, dots: [], minPeriod: TAU * hub / spec.count };
  };
}

/** Square or hexagonal lattice sites; phase shifts each row by that fraction of the period along the frame's x axis. */
function dotsPattern(spec: Extract<PatternSpec, { kind: "dots" }>): PatternFunction {
  finite("Period", spec.period, MIN_PERIOD, 1e5);
  if (spec.lattice !== "square" && spec.lattice !== "hex") throw new Error("Dot lattice must be square or hex");
  return (request) => {
    checkRequest(request);
    const hex = spec.lattice === "hex", rowStep = hex ? spec.period * Math.sqrt(3) / 2 : spec.period;
    checkCount("Dot lattice", Math.PI * request.reach * request.reach / (spec.period * rowStep), MAX_PATTERN_DOTS * 1.05);
    const toWorld = world(request), dots: PatternDot[] = [], rows = Math.floor(request.reach / rowStep);
    for (let j = -rows; j <= rows; j++) {
      const y = j * rowStep, extent = Math.sqrt(Math.max(0, request.reach * request.reach - y * y));
      const stagger = hex && Math.abs(j) % 2 === 1 ? .5 : 0;
      const low = Math.ceil(-extent / spec.period - request.phase - stagger);
      const high = Math.floor(extent / spec.period - request.phase - stagger);
      for (let i = low; i <= high; i++) {
        const site = toWorld((i + request.phase + stagger) * spec.period, y);
        dots.push(Object.freeze({ id: `dot:${i}:${j}`, position: site, angle: request.angle }));
      }
    }
    checkCount("Dot lattice", dots.length, MAX_PATTERN_DOTS);
    return { strokes: [], dots, minPeriod: spec.period };
  };
}

/** The pattern function for a typed descriptor; ordinary functions of the same type are equally valid. */
export function patternFunction(spec: PatternSpec): PatternFunction {
  switch (spec.kind) {
    case "grating": return gratingPattern(spec);
    case "waves": return wavesPattern(spec);
    case "rings": return ringsPattern(spec);
    case "spokes": return spokesPattern(spec);
    case "dots": return dotsPattern(spec);
    default: throw new Error(`Unknown pattern kind: ${String((spec as { kind?: unknown }).kind)}`);
  }
}

// --- Scalar wave patterns (Interference Lace) ------------------------------------------
/**
 * A scalar pattern for field constructions: cos(2π·frequency·ratio·(u·cosθ + v·sinθ + bend) + phase),
 * u and v in source-width units. `bend` is the caller's domain-warp sample.
 */
export type WavePattern = (u: number, v: number, bend: number) => number;
export function planeWave(wave: { frequency: number; ratio?: number; angle: number; phase: number }): WavePattern {
  const ratio = wave.ratio ?? 1, c = Math.cos(wave.angle), s = Math.sin(wave.angle);
  return (u, v, bend) => Math.cos(TAU * wave.frequency * ratio * (u * c + v * s + bend) + wave.phase);
}
/** cos(2π·frequency·r + phase) about the source center: the scalar counterpart of `rings`. */
export function radialWave(wave: { frequency: number; phase: number }): WavePattern {
  return (u, v, bend) => Math.cos(TAU * wave.frequency * (Math.hypot(u, v) + bend) + wave.phase);
}
