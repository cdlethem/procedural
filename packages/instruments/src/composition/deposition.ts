import { sandDepositionDefinitions } from "../adapters/sand-deposition-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { cachedBy, componentSeed, createCompositionRun, strokeWith } from "./core.js";
import { createControlSequence } from "./control-sequence.js";
import type { ControlSequence, ControlSequenceData } from "./control-sequence.js";
import { bundledControlSequence, bundledControlSequenceInfo } from "./control-sequence-samples.js";
import type { BundledControlSequenceId } from "./control-sequence-samples.js";
import { accumulateDensity, densityContours, depositGrains, fallVelocity, landGrain, smoothDensity } from "./grains.js";
import type { DensityField, DepositGrain, Emitter, FallModel } from "./grains.js";
import { motif, pathMaterial } from "./materials.js";
import { DEFAULT_FLATNESS } from "./patterns.js";
import type { GestureFrame, TimeWindow } from "./recording.js";
import { CurveCursor, curveAtTime, curveFamily, lengthIntegral } from "./spline-family.js";
import type { CurveFamily } from "./spline-family.js";
import { clipToSupport, MAX_CLIP_WORK, resolveSupport, supportContains } from "./support.js";
import type { Support } from "./support.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, Path, PathMaterial, PathMaterialSpec, Point } from "./types.js";

/**
 * Moving-spline sand deposition (brief 11): a supplied evolving control sequence -> the spline sampled over
 * curve and time (`spline-family.ts`) -> grains released from it with a mass each, which fall and land
 * (`landGrain`, shared with Gesture Scores) -> density accumulation -> an exposure/material consumer.
 * Producers and consumers are separate values: exposure, mark, isolines and the overlay never enter
 * a producer or a cache key of one, so no consumer can move a grain.
 *
 * DEPOSITION IS A MEASURE, NOT A COUNT. `deposit` is mass per canvas unit of curve length per second, so the
 * mass released in a window is `deposit * lengthIntegral(window)` (canvas-unit seconds; `Deposit.mass`).
 * A grain is only a sample of that measure: `grainMass` is the requested MEAN mass per grain, and the
 * grains of the window carry masses that sum EXACTLY to `Deposit.mass` (the rescaling constant is reported
 * by the difference, never hidden). Halving `grainMass` doubles the grains and keeps the mass, and with the
 * exposure law of `grains.ts` the tone. Mass is in area units: one unit is the paper a grain covers.
 *
 * SAMPLING. Over the whole sequence `N = ceil(deposit * lengthIntegral(0, duration) / grainMass)` grain
 * indices `j` exist. Grain `j` leaves at time `T * frac(radical2(j) + shift)` (a base-2 van der Corput
 * sequence: a prefix of the indices is always evenly spread over the sequence, so raising `deposit` or
 * lowering `grainMass` only ADDS grains), at the arc fraction `u` of an independent seeded draw, from the
 * material point `u` of the curve at that time (velocity: that point's own). The window keeps the indices
 * whose time falls inside it, so narrowing it removes grains and never moves the survivors; their masses
 * are rescaled to the window's mass, weighted by the curve's length at the release time (equal mass per
 * unit of curve, whatever the length was). Identity and seeds: id `<sequence id>/grain:<j>`, streams
 * `componentSeed(seed, id, purpose)` for `arc`, `lag`, `radius`, `around`; the seed also chooses the shift
 * and, for bundled sequences, the take. Limits: 60,000 grains in the window (checked from the time
 * draws before any grain is built), 2,000,000 indices over the sequence; over a limit the message names
 * the control to change and nothing is thinned.
 *
 * PROTECTED SPACE is an ellipse, a rectangle or the outline of a word from the licensed font (the shapes
 * `support.ts` already resolves). A grain whose LANDING point is inside is rejected: it is reported
 * (`KeptDeposit.rejected`, `rejectedMass`), never redeposited, and the accepted plus the rejected mass is
 * exactly `Deposit.mass`. The fall between release and landing is not tested.
 *
 * FIELD. `depositionDensity` is `accumulateDensity` of the KEPT grains over the 640-unit canvas at a
 * chosen cell size, optionally smoothed (mass per canvas unit squared; its sum times the cell area is the
 * kept mass inside the canvas whatever the cell size). Isolines are `densityContours` at the densities where
 * the exposure law reaches given tones.
 *
 * Units: canvas units, milliseconds (times, lag), speeds per second, option angles in degrees, published
 * angles in radians, mass in area units.
 */

export const MAX_DEPOSIT_GRAINS = 60_000;
export const MAX_SAMPLED_GRAINS = 2_000_000;
export const MAX_OVERLAY_CURVES = 400;
export const CANVAS = 640;
const U32 = 0x1_0000_0000;

const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
function finite(label: string, value: number, low: number, high: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high)
    throw new Error(`${label} must be a finite number in [${low}, ${high}]`);
}
function seedOf(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Deposition seed must be a uint32 integer");
}

/** Base-2 van der Corput point of index `j`, in [0, 1). */
function radicalInverse(j: number): number {
  let x = j, result = 0, scale = 0.5;
  while (x > 0) { if (x % 2 === 1) result += scale; x = Math.floor(x / 2); scale /= 2; }
  return result;
}

/* ---------------------------------------------------------------- the deposit */

export interface DepositOptions {
  seed: number;
  /** Milliseconds from the sequence start. */
  window: TimeWindow;
  /** Mass per canvas unit of curve length per second. */
  deposit: number;
  /** Requested mean mass per grain (area units). */
  grainMass: number;
  fall: FallModel;
}
export interface Deposit {
  readonly id: string;
  readonly window: TimeWindow;
  /** `deposit * lengthIntegral(window)`; the grains' masses sum to it. */
  readonly mass: number;
  /** Grain indices over the whole sequence (the window keeps some of them). */
  readonly sampled: number;
  /** In index order. */
  readonly grains: readonly DepositGrain[];
}

const depositCache = new WeakMap<CurveFamily, Map<string, Deposit>>();

export function splineDeposit(family: CurveFamily, options: DepositOptions): Deposit {
  seedOf(options.seed);
  const { start, end } = options.window;
  finite("window start", start, 0, family.duration);
  finite("window end", end, 0, family.duration + 1e-6);
  if (!(end > start)) throw new Error(`Window end ${end} must be after its start ${start}`);
  const window = { start, end: Math.min(end, family.duration) };
  const { deposit, grainMass, fall } = options;
  finite("deposit", deposit, 0.001, 1e4); finite("grain mass", grainMass, 0.01, 100);
  finite("fall lag", fall.lag, 0, 60_000); finite("fall speed", fall.fall, 0, 100_000); finite("fall angle", fall.fallAngle, -1e6, 1e6);
  finite("carried motion", fall.inherit, 0, 4); finite("grain spread", fall.spread, 0, 5000);
  const key = JSON.stringify([options.seed, window, deposit, grainMass, fall]);
  return cachedBy(depositCache, family, key, () => {
    const whole = lengthIntegral(family, 0, family.duration);
    if (!(whole > 0)) throw new Error(`Sequence "${family.id}" never has any length; there is nothing to deposit from`);
    const wanted = Math.ceil(deposit * whole / grainMass);
    if (wanted > MAX_SAMPLED_GRAINS)
      throw new Error(`Deposit would sample ${wanted} grains over the sequence; the limit is ${MAX_SAMPLED_GRAINS}. Lower the deposit or raise the grain mass`);
    const shift = unit(options.seed, family.id, "shift");
    // Which indices leave inside the window (times only), before any grain is built.
    const inside: number[] = [], times: number[] = [];
    for (let j = 0; j < wanted; j++) {
      const t = ((radicalInverse(j) + shift) % 1) * family.duration;
      if (t >= window.start && t <= window.end) { inside.push(j); times.push(t); }
    }
    if (inside.length > MAX_DEPOSIT_GRAINS)
      throw new Error(`Deposit would release ${inside.length} grains in the window; the limit is ${MAX_DEPOSIT_GRAINS}. Lower the deposit, raise the grain mass or narrow the window`);
    const mass = deposit * lengthIntegral(family, window.start, window.end);
    if (inside.length === 0 && mass > 0)
      throw new Error("No grain leaves inside the window; raise the deposit, lower the grain mass or widen the window");
    const cursor = new CurveCursor(family), pull = fallVelocity(fall);
    const built: Omit<DepositGrain, "mass">[] = [], lengths: number[] = [];
    inside.forEach((j, index) => {
      const time = times[index], id = `${family.id}/grain:${j}`, seed = componentSeed(options.seed, id, "grain");
      cursor.at(time, unit(seed, id, "arc"));
      const speed = Math.hypot(cursor.vx, cursor.vy), moving = speed > 1e-9;
      const emitter: Emitter = { x: cursor.x, y: cursor.y, speed, tx: moving ? cursor.vx / speed : cursor.tx, ty: moving ? cursor.vy / speed : cursor.ty };
      const land = landGrain(emitter, Math.atan2(cursor.ty, cursor.tx), fall, pull,
        { lag: unit(seed, id, "lag"), radius: unit(seed, id, "radius"), around: unit(seed, id, "around") });
      lengths.push(cursor.length);
      built.push({ id, seed, time, origin: Object.freeze([cursor.x, cursor.y] as const),
        position: Object.freeze([land.x, land.y] as const), angle: land.angle, scale: 1, tone: 0 });
    });
    let weight = 0;
    for (const length of lengths) weight += length;
    const grains = built.map((grain, index) => Object.freeze({ ...grain, mass: weight > 0 ? mass * lengths[index] / weight : 0 }) as DepositGrain);
    return Object.freeze({ id: family.id, window: Object.freeze(window), mass, sampled: wanted, grains: Object.freeze(grains) });
  });
}

/* ------------------------------------------------------------ protected space */

export type ProtectedSpec =
  | { shape: "ellipse" | "rectangle"; centerX: number; centerY: number; width: number; height: number }
  | { shape: "text"; text: string; centerX: number; centerY: number; width: number; height: number };
export interface ProtectedSpace {
  /** The resolved description; equal keys are equal spaces. */
  readonly key: string;
  /** Inside: where grains never land. */
  readonly space: Support;
  /** Inside: everything else, for clipping paths. */
  readonly allowed: Support;
}

const spaceCache = new Map<string, ProtectedSpace>();

/** Resolve the reserved shape once (cached by its description). */
export function protectedSpace(spec: ProtectedSpec): ProtectedSpace {
  const key = JSON.stringify(spec);
  const hit = spaceCache.get(key);
  if (hit) return hit;
  const { centerX, centerY, width, height } = spec;
  const space = resolveSupport(spec.shape === "text"
    ? { footprint: { shape: "rectangle", centerX, centerY, width, height },
      mask: { source: { kind: "text", text: spec.text, centerX, centerY, width, height }, invert: false } }
    : { footprint: { shape: spec.shape, centerX, centerY, width, height } }, DEFAULT_FLATNESS * 10);
  const rings = space.mask ? space.mask.rings : [space.footprint];
  const allowed = resolveSupport({ footprint: { shape: "rectangle", centerX: 0, centerY: 0, width: 1e5, height: 1e5 },
    mask: { source: { kind: "paths", rings }, invert: true } }, DEFAULT_FLATNESS * 10);
  const both = Object.freeze({ key, space, allowed });
  spaceCache.set(key, both);
  if (spaceCache.size > 8) spaceCache.delete(spaceCache.keys().next().value!);
  return both;
}

export interface KeptDeposit {
  /** The accepted grains (the deposit's own array when nothing is reserved). */
  readonly grains: readonly DepositGrain[];
  readonly rejected: number;
  readonly rejectedMass: number;
  /** Mass of the accepted grains. */
  readonly mass: number;
}
const keptCache = new WeakMap<Deposit, Map<string, KeptDeposit>>();

/** Reject the grains that land in the protected space; accepted plus rejected mass is the deposit's mass. */
export function keepOut(deposit: Deposit, protectedFrom: ProtectedSpace | null): KeptDeposit {
  if (!protectedFrom) return Object.freeze({ grains: deposit.grains, rejected: 0, rejectedMass: 0, mass: deposit.mass });
  const { space } = protectedFrom;
  const work = deposit.grains.length * space.edges;
  if (work > MAX_CLIP_WORK) throw new Error(`Testing ${deposit.grains.length} grains against the protected space needs ${work} edge tests; the limit is ${MAX_CLIP_WORK}. Lower the deposit or use a simpler protected shape`);
  return cachedBy(keptCache, deposit, protectedFrom.key, () => {
    const grains: DepositGrain[] = [];
    let rejected = 0, rejectedMass = 0;
    for (const grain of deposit.grains) {
      if (supportContains(space, grain.position[0], grain.position[1])) { rejected++; rejectedMass += grain.mass; } else grains.push(grain);
    }
    return Object.freeze({ grains: Object.freeze(grains), rejected, rejectedMass, mass: deposit.mass - rejectedMass });
  });
}

/* ------------------------------------------------------- trajectory samples */

export interface CurvePathOptions {
  seed: number;
  /** Milliseconds between the sampled curves; they sit at `k * every` from the sequence start. */
  every: number;
  window: TimeWindow;
}
const curveCache = new WeakMap<CurveFamily, Map<string, readonly Path[]>>();

/**
 * The generating curve itself at times `k * every` inside the window (anchored at the sequence start, so a
 * narrower window keeps the survivors): ids `curve:<k>` (`curve:<k>#<n>` for the pieces a protected space
 * cuts), `level` the time in milliseconds, `levelFraction` its position in the window.
 */
export function curvePaths(family: CurveFamily, options: CurvePathOptions, protectedFrom: ProtectedSpace | null = null): readonly Path[] {
  seedOf(options.seed);
  finite("overlay interval", options.every, 1, 1e6);
  const { start, end } = options.window;
  finite("window start", start, 0, family.duration); finite("window end", end, 0, family.duration + 1e-6);
  const first = Math.max(0, Math.ceil(start / options.every - 1e-9)), last = Math.floor(Math.min(end, family.duration) / options.every + 1e-9);
  const count = Math.max(0, last - first + 1);
  if (count > MAX_OVERLAY_CURVES)
    throw new Error(`The overlay would draw ${count} curves; the limit is ${MAX_OVERLAY_CURVES}. Raise the overlay interval or narrow the window`);
  const clipWork = protectedFrom ? count * (family.samples + 1) * protectedFrom.allowed.edges : 0;
  if (clipWork > MAX_CLIP_WORK) throw new Error(`Clipping ${count} curves by the protected space needs ${clipWork} edge tests; the limit is ${MAX_CLIP_WORK}. Raise the overlay interval or use a simpler protected shape`);
  const clip = protectedFrom ? protectedFrom.allowed : null;
  return cachedBy(curveCache, family, JSON.stringify([options.seed, options.every, options.window, protectedFrom?.key ?? null]), () => {
    const paths: Path[] = [];
    for (let k = first; k <= last; k++) {
      const time = k * options.every, points = curveAtTime(family, time), base = `curve:${k}`;
      const fraction = (time - start) / (Math.min(end, family.duration) - start);
      const push = (id: string, part: readonly Point[], closed: boolean) => paths.push(Object.freeze({
        id, seed: componentSeed(options.seed, id, "path"), points: Object.freeze(part), closed, level: time, levelFraction: fraction }));
      if (!clip) { push(base, family.closed ? points.slice(0, -1) : points, family.closed); continue; }
      const clipped = clipToSupport(family.closed ? points.slice(0, -1) : points, family.closed, clip);
      clipped.pieces.forEach((piece, n) => push(clipped.pieces.length === 1 ? base : `${base}#${n}`, piece, clipped.closed && clipped.pieces.length === 1));
    }
    return Object.freeze(paths);
  });
}

/* ---------------------------------------------------------------- the recipe */

export type SequenceSource = { kind: "bundled"; id: BundledControlSequenceId } | { kind: "data"; data: ControlSequenceData };

export interface SandDepositionComposition {
  kind: "sand-deposition";
  seed: number;
  /** `bundled` is resolved with the composition's seed (the take); `data` is validated by `createControlSequence`. */
  sequence: SequenceSource;
  motion: number;
  frame: GestureFrame;
  /** Milliseconds from the sequence start. */
  window: TimeWindow;
  deposit: number;
  grainMass: number;
  fall: FallModel;
  protect: ProtectedSpec | null;
  /** Photographic stops of the exposure of grains and isolines. */
  exposure: number;
  /** Null: grains are not drawn (the deposit and field still exist). */
  grains: { mark: MotifSpec } | null;
  /** Isolines of the smoothed density at `levels` tones; `cell` and `smooth` in canvas units. */
  isolines: { levels: number; smooth: number; cell: number; weight: number } | null;
  overlay: { every: number; weight: number } | null;
  palette: readonly number[];
}

/** Replace any consumer of `drawSandDeposition` with an ordinary callback. */
export interface SandConsumers { grain?: Mark; isoline?: PathMaterial; curve?: PathMaterial }

type Scalar = number | string | boolean;
const definition = sandDepositionDefinitions[0];

/** Resolve stored scalar controls to the public composition value. */
export function sandDepositionComposition(input: InstrumentInput): SandDepositionComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  seedOf(input.seed);
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((color) =>
    !Number.isSafeInteger(color) || color < 0 || color > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const id = q.sequence as BundledControlSequenceId, { duration } = bundledControlSequenceInfo[id];
  const start = q.windowStart as number, end = Math.min(1, start + (q.windowLength as number));
  const box = { centerX: q.protectX as number, centerY: q.protectY as number, width: q.protectWidth as number, height: q.protectHeight as number };
  const material = q.material as string;
  return {
    kind: "sand-deposition", seed: input.seed, palette: [...input.palette],
    sequence: { kind: "bundled", id },
    motion: q.motion as number,
    frame: { centerX: q.centerX as number, centerY: q.centerY as number, scale: q.scale as number, rotation: q.rotation as number },
    window: { start: start * duration, end: end * duration },
    deposit: q.deposit as number, grainMass: q.grainMass as number,
    fall: { lag: q.lag as number, fall: q.fall as number, fallAngle: q.fallAngle as number, inherit: q.inherit as number, spread: q.spread as number },
    protect: q.protect === "none" ? null : q.protect === "word" ? { shape: "text", text: q.protectWord as string, ...box } : { shape: q.protect as "ellipse" | "rectangle", ...box },
    exposure: q.exposure as number,
    grains: material === "isolines" ? null : { mark: { kind: "dot", size: q.grainSize as number, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } },
    isolines: material === "grains" ? null : { levels: q.isoLevels as number, smooth: q.isoSmooth as number, cell: q.fieldCell as number, weight: q.isoWeight as number },
    overlay: q.overlay ? { every: q.overlayEvery as number, weight: q.overlayWeight as number } : null,
  };
}

/** The sequence a recipe deposits from. Bundled ones are cached; supplied data is validated. */
export function resolveSequence(recipe: Pick<SandDepositionComposition, "sequence" | "seed">): ControlSequence {
  const { sequence } = recipe;
  if (sequence.kind === "bundled") return bundledControlSequence(sequence.id, recipe.seed);
  if (sequence.kind === "data") return createControlSequence(sequence.data);
  throw new Error(`Unknown sequence source: ${(sequence as { kind: string }).kind}`);
}

/** Everything the consumers read. Absent when its consumer is off. */
export interface DepositionProducts {
  readonly family: CurveFamily;
  readonly deposit: Deposit;
  readonly kept: KeptDeposit;
  readonly space: ProtectedSpace | null;
  /** Isolines of the smoothed density; empty when isolines are off. */
  readonly contours: readonly Path[];
  /** The generating curve at sampled times; empty when the overlay is off. */
  readonly curves: readonly Path[];
}

/** The tone (0 to 1) of isoline `k` of `levels`: evenly spaced from 0.15 to 0.9, a single one at 0.5. */
export function isolineTone(k: number, levels: number): number {
  return levels === 1 ? 0.5 : 0.15 + 0.75 * k / (levels - 1);
}

/** Density (mass per canvas unit squared) at which the exposure law reaches `tone`: `-ln(1 - tone) / 2^stops`. */
export function densityAtTone(tone: number, stops: number): number {
  return -Math.log(1 - tone) / 2 ** stops;
}

/** The density field of a recipe's kept grains over the canvas, smoothed by `smooth` canvas units. */
export function depositionDensity(products: Pick<DepositionProducts, "kept">, cell: number, smooth: number): DensityField {
  return smoothDensity(accumulateDensity(products.kept.grains, [0, 0, CANVAS, CANVAS], cell), smooth);
}

function family(recipe: SandDepositionComposition): CurveFamily {
  return curveFamily(resolveSequence(recipe), { motion: recipe.motion, frame: recipe.frame });
}
function products(recipe: SandDepositionComposition, curves: CurveFamily): DepositionProducts {
  const deposit = splineDeposit(curves, { seed: recipe.seed, window: recipe.window, deposit: recipe.deposit, grainMass: recipe.grainMass, fall: recipe.fall });
  const space = recipe.protect ? protectedSpace(recipe.protect) : null;
  const kept = keepOut(deposit, space);
  const contours = recipe.isolines ? isolines(recipe, { kept }) : [];
  const overlay = recipe.overlay ? curvePaths(curves, { seed: recipe.seed, every: recipe.overlay.every, window: recipe.window }, space) : [];
  return { family: curves, deposit, kept, space, contours, curves: overlay };
}
function isolines(recipe: SandDepositionComposition, source: Pick<DepositionProducts, "kept">): readonly Path[] {
  const { levels, smooth, cell } = recipe.isolines!;
  const field = depositionDensity(source, cell, smooth);
  return densityContours(field, Array.from({ length: levels }, (_, k) => densityAtTone(isolineTone(k, levels), recipe.exposure)), recipe.seed);
}

/** Producer results for a recipe: the cached values `drawSandDeposition` consumes. */
export function sandDepositionProducts(recipe: SandDepositionComposition): DepositionProducts {
  return products(recipe, family(recipe));
}

const ink = (weight: number): PathMaterialSpec => ({ kind: "ink", weight, spacing: 4, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
  mark: { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } });
/** Draw a path with a palette tone (materials use `Path.tone` instead of a per-path random hue). */
function toned(material: PathMaterial, tone: number): PathMaterial {
  return (surface, path, run) => material(surface, { ...path, tone }, run);
}

/** Draw the recipe into a caller-owned surface: isolines, then exposed grains, then the crisp curves. */
export function drawSandDeposition(surface: CompositionSurface, recipe: SandDepositionComposition,
  consumers: SandConsumers = {}, run: CompositionRun = createCompositionRun({ maxWork: 400_000 })): void {
  run.check();
  const made = sandDepositionProducts(recipe);
  if (recipe.isolines && made.contours.length) {
    const line = consumers.isoline ?? toned(pathMaterial(ink(recipe.isolines.weight), recipe.palette), 1);
    strokeWith(surface, made.contours, line, run);
  }
  if (recipe.grains && made.kept.grains.length) {
    const { mark } = recipe.grains;
    depositGrains(surface, made.kept.grains, { mark: consumers.grain ?? motif(mark, recipe.palette),
      exposure: { stops: recipe.exposure, footprint: Math.PI * (mark.size / 2) ** 2 } }, run);
  }
  if (recipe.overlay && made.curves.length) {
    const line = consumers.curve ?? toned(pathMaterial(ink(recipe.overlay.weight), recipe.palette), 2);
    strokeWith(surface, made.curves, line, run);
  }
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the producers stage by stage, yielding between stages; false if cancelled. */
export async function prepareSandDeposition(recipe: SandDepositionComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const curves = family(recipe);
  await yieldToHost();
  if (cancelled()) return false;
  const deposit = splineDeposit(curves, { seed: recipe.seed, window: recipe.window, deposit: recipe.deposit, grainMass: recipe.grainMass, fall: recipe.fall });
  await yieldToHost();
  if (cancelled()) return false;
  const kept = keepOut(deposit, recipe.protect ? protectedSpace(recipe.protect) : null);
  if (recipe.isolines) { await yieldToHost(); if (cancelled()) return false; isolines(recipe, { kept }); }
  if (recipe.overlay) curvePaths(curves, { seed: recipe.seed, every: recipe.overlay.every, window: recipe.window }, recipe.protect ? protectedSpace(recipe.protect) : null);
  return !cancelled();
}
