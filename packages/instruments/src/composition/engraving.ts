import { componentSeed } from "./core.js";
import { frequencyModulation } from "./image-structure.js";
import { STATION, engravingCarriers } from "./engraving-carriers.js";
import type { Carrier, CarrierOptions } from "./engraving-carriers.js";
import { toneField } from "./engraving-tone.js";
import type { FitMode, ToneEncoding, ToneField, ToneSource } from "./engraving-tone.js";
import type { Path, Point } from "./types.js";

/**
 * Frequency-modulated engraving: scan carriers sampled over an image's tone, modulated in amplitude and
 * frequency with a phase that never jumps, cut into visible runs, and published as paths with their sampled signal.
 *
 * Pipeline (every stage a pure function of its inputs; nothing reads a clock, canvas or shared random stream):
 *
 * 1. `toneField` (engraving-tone.ts): the image as a smoothed tone in [0, 1] over the footprint.
 * 2. `engravingCarriers` (engraving-carriers.ts): the unmodulated lines of one family, optionally crowded by tone.
 * 3. Here, per carrier. Stations every `STATION` = 1.5 units of arc length read the tone `v` there and form the
 *    signal `t = clamp((v - threshold) / (1 - threshold), 0, 1)` and `tau = t ** curve` (0 at and below the
 *    threshold, 1 at full tone). `frequencyModulation` (image-structure.ts) then gives the exact integral phase
 *    `phi(s) = phi0 + 2 pi integral f ds` with `f = fMin + (fMax - fMin) tau` and amplitude `A = aMin + (aMax - aMin) tau`,
 *    so a line never jumps where its frequency changes. The point at `s` is the carrier point plus
 *    `A(s) sin phi(s)` along the carrier's right-hand normal (screen right of the direction of travel). Normals come from
 *    tangents interpolated between carrier vertices, so a curved carrier has no kinks.
 * 4. Negative space and clipping. A vertex is drawn where the tone margin `v - threshold >= 0` and its point lies inside
 *    the clip region (the footprint rectangle or ellipse, intersected with the image rectangle when `clip` is
 *    `image`). Both conditions are convex along a segment, so every segment contributes one exact interval; a run
 *    starts and ends ON the boundary (linear interpolation of every signal at the crossing). Runs shorter than
 *    `minLength` are dropped. The phase keeps running through gaps, so a wave that resumes after a highlight
 *    continues the same wave.
 * 5. Placement: local points rotate by `rotation` degrees (clockwise on screen) and move to the footprint centre.
 *
 * Units. Canvas units for lengths; `baseFrequency` and `frequencyGain` are waves per 100 canvas units (so 5 is a
 * 20-unit wavelength); amplitudes are in line spacings; angles in degrees at the boundary, phases in radians.
 * `phi0 = 2 pi phaseSpread u(seed, carrier id)`: with `phaseSpread` 0 every line starts at phase 0 where its carrier
 * enters the clip bounds; the seed matters only when `phaseSpread > 0` or the family is `flow`.
 *
 * Closed carriers (rings). A ring's total phase is rounded to a whole number of cycles by adding `c * s / L` to the phase
 * (|c| <= pi, applied as a uniform frequency shift), so the wave meets itself at the seam; the sampling limit is
 * reduced by pi * STATION / L to pay for it. A ring wholly inside the clip is published as one closed path (last vertex
 * dropped); a ring cut by the clip is published as open runs, and a run that crosses the seam is emitted as two
 * runs that meet there.
 *
 * Sampling limit (declared, measured in `stats`). Every vertex advances the phase by at most `MAX_PHASE_STEP` = pi / 8
 * (at least sixteen vertices per cycle), and `baseFrequency + frequencyGain` is at most 50 waves per 100 units
 * (a 2-unit wavelength); the tone is sampled every 1.5 units, so a tone feature finer than about 3 units cannot be
 * resolved and is smoothed instead of aliased (`smoothing`). `stats.largestPhaseStep` and `stats.maxFrequency` report
 * what was reached.
 *
 * Ownership. The published lines, signals and carriers are deeply frozen and cached (last 4 results) by CONSTRUCTION
 * only: source, footprint, image fit, tone, scan and wave settings, clip, placement and (when it matters) seed.
 * Line weight, colour, material and every drawing choice never enter a key or an id. Ids are `carrier id/r:n` where n
 * counts the carrier's visible runs from its start BEFORE the minimum length is applied, so raising `minLength` never renames.
 *
 * Failure. Invalid numbers name the control. Work over a bound throws naming the control to change: `MAX_VERTICES`
 * modulated vertices in all (spacing, frequency or footprint), the carrier bounds in engraving-carriers.ts, the
 * flow bounds. Empty results (a fully transparent image, a threshold above every tone) are valid.
 */
export const MAX_PHASE_STEP = Math.PI / 8;
export const MAX_FREQUENCY = 0.5;
export const MAX_AMPLITUDE_SPACINGS = 4;
export const MAX_VERTICES = 900_000;
export const ENGRAVING_LIMITS = Object.freeze({
  phaseStep: MAX_PHASE_STEP, frequencyPer100: MAX_FREQUENCY * 100, amplitudeSpacings: MAX_AMPLITUDE_SPACINGS, vertices: MAX_VERTICES, station: STATION,
});

export type FootprintShape = "rectangle" | "ellipse";
export const footprintShapes: readonly FootprintShape[] = Object.freeze(["rectangle", "ellipse"] as const);
export type ClipMode = "image" | "footprint";
export const clipModes: readonly ClipMode[] = Object.freeze(["image", "footprint"] as const);

export interface EngravingOptions {
  seed: number;
  source: ToneSource;
  footprint: { centerX: number; centerY: number; width: number; height: number; rotation: number; shape: FootprintShape };
  image: { fit: FitMode; clip: ClipMode; encode: ToneEncoding; smoothing: number };
  tone: { curve: number; threshold: number };
  scan: Omit<CarrierOptions, "seed">;
  wave: { baseFrequency: number; frequencyGain: number; baseAmplitude: number; amplitudeGain: number; phaseSpread: number };
  /** Runs shorter than this many canvas units are dropped. */
  minLength: number;
}

/** The sampled signal along one published run: one value per vertex. */
export interface EngravingSignal {
  /** Arc length along the carrier (a run never resets it). */
  readonly s: readonly number[];
  /** Shaped tone tau in [0, 1]. */
  readonly tone: readonly number[];
  /** Cycles per canvas unit. */
  readonly frequency: readonly number[];
  /** Peak offset, canvas units. */
  readonly amplitude: readonly number[];
  /** Phase, radians (continuous, non-decreasing before any ring closure shift). */
  readonly phase: readonly number[];
  /** Signed offset from the carrier, canvas units, positive to the right of travel on screen. */
  readonly offset: readonly number[];
}

/** One visible run: a `Path` in canvas coordinates plus its signal. */
export interface EngravedLine extends Path {
  readonly carrier: string;
  readonly signal: EngravingSignal;
}

export interface EngravingStats {
  readonly carriers: number;
  readonly runs: number;
  readonly vertices: number;
  readonly maxFrequency: number;
  readonly largestPhaseStep: number;
}

export interface EngravingLines {
  readonly lines: readonly EngravedLine[];
  readonly stats: EngravingStats;
  readonly tone: ToneField;
}

const TAU = Math.PI * 2;

function check(name: string, v: number, lo: number, hi: number): void {
  if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) throw new Error(`${name} must be a number in [${lo}, ${hi}]`);
}

/** Linear signal t in [0, 1]: 0 at or below the threshold. */
export function toneSignal(v: number, threshold: number): number {
  const m = v - threshold;
  return m > 0 ? Math.min(1, m / (1 - threshold)) : 0;
}
/** tau = t ** curve, with 0 exactly 0. */
export const shapedTone = (t: number, curve: number): number => (t === 0 ? 0 : t ** curve);

/** The tone field this configuration reads. */
export function engravingTone(o: EngravingOptions): ToneField {
  return toneField({ source: o.source, width: o.footprint.width, height: o.footprint.height, fit: o.image.fit, encode: o.image.encode, smoothing: o.image.smoothing });
}

function validate(o: EngravingOptions): void {
  if (!Number.isSafeInteger(o.seed) || o.seed < 0 || o.seed > 0xffffffff) throw new Error("Engraving seed must be a uint32 integer");
  const f = o.footprint;
  check("Center X", f.centerX, -1e5, 1e5); check("Center Y", f.centerY, -1e5, 1e5); check("Width", f.width, 1, 4096); check("Height", f.height, 1, 4096);
  check("Rotation", f.rotation, -3600, 3600);
  if (!footprintShapes.includes(f.shape)) throw new Error(`Footprint shape must be one of ${footprintShapes.join(", ")}`);
  if (!clipModes.includes(o.image.clip)) throw new Error(`Clip must be one of ${clipModes.join(", ")}`);
  check("Tone curve", o.tone.curve, 0.2, 5); check("Threshold", o.tone.threshold, 0, 0.98);
  const w = o.wave;
  check("Base frequency", w.baseFrequency, 0, MAX_FREQUENCY * 100); check("Frequency gain", w.frequencyGain, 0, MAX_FREQUENCY * 100);
  if (w.baseFrequency + w.frequencyGain > MAX_FREQUENCY * 100)
    throw new Error(`Base frequency ${w.baseFrequency} + frequency gain ${w.frequencyGain} exceeds ${MAX_FREQUENCY * 100} waves per 100 units (a 2-unit wavelength); lower either`);
  check("Base amplitude", w.baseAmplitude, 0, 2); check("Amplitude gain", w.amplitudeGain, 0, 3);
  if (w.baseAmplitude + w.amplitudeGain > MAX_AMPLITUDE_SPACINGS)
    throw new Error(`Base amplitude ${w.baseAmplitude} + amplitude gain ${w.amplitudeGain} exceeds ${MAX_AMPLITUDE_SPACINGS} line spacings; lower either`);
  check("Phase spread", w.phaseSpread, 0, 1); check("Minimum line length", o.minLength, 0, 2000);
}

/** The options that reach the carriers, with every option that does not apply to the family normalised away. */
function carrierOptions(o: EngravingOptions): CarrierOptions {
  const s = o.scan, family = s.family;
  return {
    family, spacing: s.spacing, spacingGain: s.spacingGain,
    angle: family === "straight" || family === "curved" || family === "flow" ? s.angle : 0,
    bend: family === "curved" ? s.bend : 0, bendLength: family === "curved" ? s.bendLength : 100,
    radialX: family === "rings" || family === "spiral" ? s.radialX : 0, radialY: family === "rings" || family === "spiral" ? s.radialY : 0,
    follow: family === "flow" ? s.follow : 0, flowSmoothing: family === "flow" && s.follow > 0 ? s.flowSmoothing : 0,
    seed: family === "flow" ? o.seed : 0,
  };
}

const toneDriven = (c: CarrierOptions): boolean => c.spacingGain > 0 || c.family === "flow";
const cacheOf = <T>(size: number) => ({ map: new Map<string, T>(), size });
const carrierCache = cacheOf<readonly Carrier[]>(4);
const lineCache = cacheOf<EngravingLines>(4);
function remember<T>(cache: { map: Map<string, T>; size: number }, key: string, value: T): T {
  cache.map.set(key, value);
  if (cache.map.size > cache.size) cache.map.delete(cache.map.keys().next().value as string);
  return value;
}
function recall<T>(cache: { map: Map<string, T>; size: number }, key: string): T | undefined {
  const hit = cache.map.get(key);
  if (hit !== undefined) { cache.map.delete(key); cache.map.set(key, hit); }
  return hit;
}

/** Carriers for this configuration (cached by scan construction, tone (when it matters) and, for flow, the seed). */
export function carriersFor(o: EngravingOptions, tone: ToneField): readonly Carrier[] {
  const c = carrierOptions(o);
  const shaping = toneDriven(c) ? `${tone.key}|${o.tone.threshold}|${o.tone.curve}` : `${tone.width}x${tone.height}`;
  const key = JSON.stringify([c, shaping]);
  const hit = recall(carrierCache, key);
  if (hit) return hit;
  const tau = (x: number, y: number): number => shapedTone(toneSignal(tone.at(x, y), o.tone.threshold), o.tone.curve);
  return remember(carrierCache, key, engravingCarriers(c, tone, toneDriven(c) ? tau : null));
}

interface Modulated {
  n: number;
  x: Float64Array; y: Float64Array; s: Float64Array; tau: Float64Array; f: Float64Array; a: Float64Array; ph: Float64Array; off: Float64Array; margin: Float64Array;
  largestStep: number;
}

function modulate(c: Carrier, tone: ToneField, o: EngravingOptions, phase0: number): Modulated {
  const L = c.length, t = o.tone, w = o.wave, spacing = o.scan.spacing;
  const n = Math.max(2, Math.ceil(L / STATION) + 1), ds = L / (n - 1), M = c.x.length;
  const lin = new Array<number>(n), tauStation = new Float64Array(n), marginStation = new Float64Array(n);
  let seg = 0;
  for (let i = 0; i < n; i++) {
    const s = i === n - 1 ? L : i * ds;
    while (seg < M - 2 && c.s[seg + 1] < s) seg++;
    const span = c.s[seg + 1] - c.s[seg], f = span > 0 ? (s - c.s[seg]) / span : 0;
    const v = tone.at(c.x[seg] + (c.x[seg + 1] - c.x[seg]) * f, c.y[seg] + (c.y[seg + 1] - c.y[seg]) * f);
    marginStation[i] = v - t.threshold; lin[i] = toneSignal(v, t.threshold); tauStation[i] = shapedTone(lin[i], t.curve);
  }
  const fMin = w.baseFrequency / 100, fMax = (w.baseFrequency + w.frequencyGain) / 100;
  const aMin = w.baseAmplitude * spacing, aMax = (w.baseAmplitude + w.amplitudeGain) * spacing;
  const step = c.closed ? MAX_PHASE_STEP - (Math.PI * STATION) / L : MAX_PHASE_STEP;
  const fm = frequencyModulation({ length: L, tones: lin, frequency: { min: fMin, max: fMax }, amplitude: { min: aMin, max: aMax }, curve: t.curve, phase: phase0, maxPhaseStep: step });
  const N = fm.count;
  const tx = new Float64Array(M), ty = new Float64Array(M);
  for (let i = 0; i < M; i++) {
    const a = c.closed ? (i === 0 || i === M - 1 ? M - 2 : i - 1) : Math.max(0, i - 1), b = c.closed ? (i === M - 1 ? 1 : i === 0 ? 1 : i + 1) : Math.min(M - 1, i + 1);
    const dx = c.x[b] - c.x[a], dy = c.y[b] - c.y[a], len = Math.hypot(dx, dy);
    tx[i] = len > 0 ? dx / len : 1; ty[i] = len > 0 ? dy / len : 0;
  }
  const out: Modulated = {
    n: N, x: new Float64Array(N), y: new Float64Array(N), s: new Float64Array(N), tau: new Float64Array(N), f: new Float64Array(N), a: new Float64Array(N),
    ph: new Float64Array(N), off: new Float64Array(N), margin: new Float64Array(N), largestStep: 0,
  };
  let correction = 0;
  if (c.closed) {
    const total = fm.endPhase - phase0;
    correction = TAU * Math.round(total / TAU) - total;
  }
  seg = 0;
  for (let k = 0; k < N; k++) {
    const s = fm.s[k];
    while (seg < M - 2 && c.s[seg + 1] < s) seg++;
    const span = c.s[seg + 1] - c.s[seg], u = span > 0 ? Math.min(1, Math.max(0, (s - c.s[seg]) / span)) : 0;
    let dx = tx[seg] + (tx[seg + 1] - tx[seg]) * u, dy = ty[seg] + (ty[seg + 1] - ty[seg]) * u;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const phase = fm.phase[k] + (c.closed ? (correction * s) / L : 0);
    const offset = c.closed ? fm.amplitude[k] * Math.sin(phase) : fm.offset[k];
    const px = c.x[seg] + (c.x[seg + 1] - c.x[seg]) * u, py = c.y[seg] + (c.y[seg + 1] - c.y[seg]) * u;
    out.x[k] = px - offset * dy; out.y[k] = py + offset * dx;
    out.s[k] = s; out.f[k] = fm.frequency[k]; out.a[k] = fm.amplitude[k]; out.ph[k] = phase; out.off[k] = offset;
    const i = Math.min(n - 2, Math.floor(s / ds)), q = Math.min(1, Math.max(0, (s - i * ds) / ds));
    out.tau[k] = tauStation[i] + (tauStation[i + 1] - tauStation[i]) * q;
    out.margin[k] = marginStation[i] + (marginStation[i + 1] - marginStation[i]) * q;
    if (k > 0) out.largestStep = Math.max(out.largestStep, out.ph[k] - out.ph[k - 1]);
  }
  return out;
}

interface Region { x0: number; y0: number; x1: number; y1: number; ellipse: { rx: number; ry: number } | null }

/** The parameter interval of segment a->b inside the region and with a non-negative tone margin, or null. */
function interval(ax: number, ay: number, bx: number, by: number, ma: number, mb: number, r: Region): [number, number] | null {
  let lo = 0, hi = 1;
  const dx = bx - ax, dy = by - ay;
  const axis = (p: number, d: number, min: number, max: number): boolean => {
    if (d === 0) return p >= min && p <= max;
    let t0 = (min - p) / d, t1 = (max - p) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    lo = Math.max(lo, t0); hi = Math.min(hi, t1);
    return lo <= hi;
  };
  if (!axis(ax, dx, r.x0, r.x1) || !axis(ay, dy, r.y0, r.y1)) return null;
  if (r.ellipse) {
    const { rx, ry } = r.ellipse;
    const A = (dx / rx) ** 2 + (dy / ry) ** 2, B = 2 * ((ax * dx) / (rx * rx) + (ay * dy) / (ry * ry)), C = (ax / rx) ** 2 + (ay / ry) ** 2 - 1;
    if (A === 0) { if (C > 0) return null; } else {
      const disc = B * B - 4 * A * C;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      lo = Math.max(lo, (-B - root) / (2 * A)); hi = Math.min(hi, (-B + root) / (2 * A));
      if (lo > hi) return null;
    }
  }
  if (ma < 0 && mb < 0) return null;
  if (ma < 0 || mb < 0) {
    const t = ma / (ma - mb);
    if (ma < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t);
    if (lo > hi) return null;
  }
  if (lo < 1e-12) lo = 0;
  if (hi > 1 - 1e-12) hi = 1;
  return [lo, hi];
}

interface RunBuffer { x: number[]; y: number[]; s: number[]; tau: number[]; f: number[]; a: number[]; ph: number[]; off: number[] }
const newRun = (): RunBuffer => ({ x: [], y: [], s: [], tau: [], f: [], a: [], ph: [], off: [] });

function extractRuns(m: Modulated, region: Region, closedCarrier: boolean): { runs: RunBuffer[]; whole: boolean } {
  const runs: RunBuffer[] = [];
  let current: RunBuffer | null = null, continuing = false, cuts = 0;
  const emit = (run: RunBuffer, seg: number, t: number): void => {
    const mix = (v: Float64Array): number => (t === 0 ? v[seg] : t === 1 ? v[seg + 1] : v[seg] + (v[seg + 1] - v[seg]) * t);
    run.x.push(mix(m.x)); run.y.push(mix(m.y)); run.s.push(mix(m.s)); run.tau.push(mix(m.tau)); run.f.push(mix(m.f));
    run.a.push(mix(m.a)); run.ph.push(mix(m.ph)); run.off.push(mix(m.off));
  };
  for (let seg = 0; seg < m.n - 1; seg++) {
    const iv = interval(m.x[seg], m.y[seg], m.x[seg + 1], m.y[seg + 1], m.margin[seg], m.margin[seg + 1], region);
    if (!iv) { current = null; continuing = false; cuts++; continue; }
    const [t0, t1] = iv;
    if (!(current && continuing && t0 === 0)) {
      current = newRun(); runs.push(current);
      emit(current, seg, t0);
      if (t0 !== 0) cuts++;
    }
    emit(current, seg, t1);
    continuing = t1 === 1;
    if (!continuing) { current = null; cuts++; }
  }
  return { runs, whole: closedCarrier && cuts === 0 && runs.length === 1 };
}

const freezeAll = (values: number[]): readonly number[] => Object.freeze(values);

function optionsKey(o: EngravingOptions, tone: ToneField): string {
  const s = o.scan, w = o.wave, phaseMatters = w.phaseSpread > 0 || s.family === "flow";
  return JSON.stringify([
    carrierOptions(o), tone.key, o.footprint.centerX, o.footprint.centerY, o.footprint.rotation, o.footprint.shape,
    o.image.fit === "contain" ? o.image.clip : "footprint",
    o.tone.curve, o.tone.threshold, w.baseFrequency, w.frequencyGain, w.baseAmplitude, w.amplitudeGain, w.phaseSpread, o.minLength,
    phaseMatters ? o.seed : 0,
  ]);
}

/**
 * The published engraving: visible runs as canvas-space paths with their sampled signals. Cached by construction.
 */
export function engravedLines(options: EngravingOptions): EngravingLines {
  validate(options);
  const o = options, tone = engravingTone(o);
  const key = optionsKey(o, tone);
  const hit = recall(lineCache, key);
  if (hit) return hit;
  const carriers = carriersFor(o, tone);
  const { width, height, centerX, centerY, shape } = o.footprint;
  const image = tone.image;
  const clipToImage = o.image.fit === "contain" && o.image.clip === "image";
  const region: Region = {
    x0: clipToImage ? Math.max(-width / 2, image[0]) : -width / 2, x1: clipToImage ? Math.min(width / 2, image[2]) : width / 2,
    y0: clipToImage ? Math.max(-height / 2, image[1]) : -height / 2, y1: clipToImage ? Math.min(height / 2, image[3]) : height / 2,
    ellipse: shape === "ellipse" ? { rx: width / 2, ry: height / 2 } : null,
  };
  const cosR = Math.cos((o.footprint.rotation * Math.PI) / 180), sinR = Math.sin((o.footprint.rotation * Math.PI) / 180);
  const lines: EngravedLine[] = [];
  let vertices = 0, largestPhaseStep = 0, maxFrequency = 0;
  const first = carriers.length ? carriers[0].index : 0, last = carriers.length ? carriers[carriers.length - 1].index : 0;
  for (const c of carriers) {
    const phase0 = o.wave.phaseSpread > 0 ? TAU * o.wave.phaseSpread * (componentSeed(o.seed, c.id, "phase") / 0x1_0000_0000) : 0;
    const m = modulate(c, tone, o, phase0);
    vertices += m.n;
    if (vertices > MAX_VERTICES)
      throw new Error(`Engraving needs more than ${MAX_VERTICES} modulated vertices; raise the line spacing, lower the base frequency and frequency gain, or shrink the footprint`);
    largestPhaseStep = Math.max(largestPhaseStep, m.largestStep);
    for (let k = 0; k < m.n; k++) maxFrequency = Math.max(maxFrequency, m.f[k]);
    const { runs, whole } = extractRuns(m, region, c.closed);
    runs.forEach((run, n) => {
      if (whole) { for (const v of Object.values(run)) (v as number[]).pop(); }
      let length = 0;
      for (let i = 1; i < run.x.length; i++) length += Math.hypot(run.x[i] - run.x[i - 1], run.y[i] - run.y[i - 1]);
      if (run.x.length < 2 || length <= 0 || length < o.minLength) return;
      const id = `${c.id}/r:${n}`;
      const points: Point[] = run.x.map((x, i) => Object.freeze([centerX + x * cosR - run.y[i] * sinR, centerY + x * sinR + run.y[i] * cosR] as const));
      lines.push(Object.freeze({
        id, seed: componentSeed(o.seed, id, "line"), points: Object.freeze(points), closed: whole, level: c.index, levelFraction: last > first ? (c.index - first) / (last - first) : 0,
        carrier: c.id,
        signal: Object.freeze({ s: freezeAll(run.s), tone: freezeAll(run.tau), frequency: freezeAll(run.f), amplitude: freezeAll(run.a), phase: freezeAll(run.ph), offset: freezeAll(run.off) }),
      }));
    });
  }
  const stats: EngravingStats = Object.freeze({ carriers: carriers.length, runs: lines.length, vertices, maxFrequency, largestPhaseStep });
  return remember(lineCache, key, Object.freeze({ lines: Object.freeze(lines), stats, tone }));
}

/** Estimated work from stored values alone, before any stage runs (a bound, not a promise). */
export function estimateEngraving(o: EngravingOptions): { carriers: number; vertices: number } {
  const { width, height } = o.footprint, spacing = o.scan.spacing;
  const diag = Math.hypot(width, height), pad = 2 * (MAX_AMPLITUDE_SPACINGS * spacing);
  let carriers: number, length: number;
  if (o.scan.family === "spiral") { const R = diag / 2 + pad; carriers = 1; length = (Math.PI * R * R) / spacing; }
  else if (o.scan.family === "rings") { const R = diag / 2 + pad; carriers = Math.ceil(R / spacing); length = (Math.PI * R * R) / spacing; }
  else { carriers = Math.ceil((diag + pad) / spacing); length = carriers * (diag + pad); }
  const mean = (o.wave.baseFrequency + 0.5 * o.wave.frequencyGain) / 100;
  const perStation = Math.max(1, Math.ceil((TAU * mean * STATION) / MAX_PHASE_STEP));
  return { carriers, vertices: Math.ceil((length / STATION) * perStation) };
}
