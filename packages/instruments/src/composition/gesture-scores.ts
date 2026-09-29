import { gestureScoresDefinitions } from "../adapters/gesture-scores-instruments.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { atEach, createCompositionRun, strokeWith } from "./core.js";
import { bristleBand, hairMaterial, MAX_HAIR_POINTS } from "./bristle.js";
import type { BristleOptions, PressureMap } from "./bristle.js";
import { gesturePath, gestureSites, sandGrains } from "./gesture.js";
import { depositGrains } from "./grains.js";
import type { GesturePath, GestureSite } from "./gesture.js";
import { motif, pathMaterial, tonedMaterial } from "./materials.js";
import { bundledRecording, bundledRecordingInfo } from "./recording-samples.js";
import type { BundledRecordingId } from "./recording-samples.js";
import { createRecording, echoTrack, gestureTrack } from "./recording.js";
import type { GestureFrame, GestureTrack, PressurePolicy, Recording, RecordingData, StationRule, TimeWindow } from "./recording.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, Path, PathMaterial, PathMaterialSpec } from "./types.js";

/**
 * Gesture Scores as a typed, JSON-compatible composition: one producer (a recording, replayed
 * as a `GestureTrack`) and several consumers of the same replay.
 *
 * - `recording` is a bundled sample (`{kind: "bundled", id}`, resolved with the composition's seed;
 *   only `wander` uses it) or caller-resolved data (`{kind: "data", data}`, validated by
 *   `createRecording`). A host's own captured strokes go through the second form; the library
 *   never captures or fetches, and persisted instruments name only bundled recordings today.
 * - `smoothing`, `frame` and `window` shape the shared replay. Every consumer reads the same
 *   window (milliseconds from the recording start), smoothing and frame; none can edit the
 *   recording or the track.
 * - `echoes` repeat the whole replay: repeat `i` is the track rotated by `i * turn` degrees about the
 *   frame centre and moved by `i * (dx, dy)`. Repeat 0 is the replay itself; repeats have their
 *   own ids (`<recording>~i`) and random streams.
 * - Consumers: `bristles` (hairs from `bristleBand`, drawn as ink at `weight`, palette 0),
 *   `line` (the stroke path through any `pathMaterial`, palette 1), `sand` (`sandGrains` through
 *   `motif`, palette 1) and `glyphs` (`gestureSites` through `motif`, palette 2). Drawing order:
 *   all bristles, then lines, then sand, then glyphs, each across all repeats.
 *
 * `drawGestureScore(surface, recipe, consumers)` replaces any consumer with an ordinary
 * `PathMaterial` or `Mark` while the track, path, hairs and sites stay the same cached objects.
 * The producers are public, so `atEach(surface, sandGrains(track, ...), mark)` needs no
 * descriptor. Work is charged to the run (default 400,000 callback units) per path and site.
 */
export type RecordingSource = { kind: "bundled"; id: BundledRecordingId } | { kind: "data"; data: RecordingData };

export interface GestureScoreComposition {
  kind: "gesture-scores";
  seed: number;
  recording: RecordingSource;
  smoothing: number;
  frame: GestureFrame;
  /** Milliseconds from the recording start. */
  window: TimeWindow;
  /** Stations of the stroke path (and the default for glyph stations). */
  sampling: StationRule;
  pressure: PressurePolicy;
  pressureMap: PressureMap;
  echoes: { count: number; dx: number; dy: number; turn: number };
  bristles: (Omit<BristleOptions, "map"> & { weight: number }) | null;
  line: PathMaterialSpec | null;
  sand: { mark: MotifSpec; rate: number; lag: number; fall: number; fallAngle: number; inherit: number; spread: number; gate: number } | null;
  glyphs: { mark: MotifSpec; sampling: StationRule; follow: number; sizeFollow: number; offset: number } | null;
  palette: readonly number[];
}

/** Replace any consumer of `drawGestureScore` with an ordinary callback. */
export interface GestureConsumers {
  bristle?: PathMaterial;
  line?: PathMaterial;
  sand?: Mark;
  glyph?: Mark;
}

type Scalar = number | string | boolean;
const definition = gestureScoresDefinitions[0];

const dot: MotifSpec = { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 };
const materialSpec = (kind: PathMaterialSpec["kind"], weight: number, spacing: number, phase: number): PathMaterialSpec =>
  ({ kind, weight, spacing, phase, phaseSpread: 0, levelRamp: 0, retention: 1, mark: dot });

/** Resolve stored scalar controls to the public composition value. */
export function gestureScoreComposition(input: InstrumentInput): GestureScoreComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((color) =>
    !Number.isSafeInteger(color) || color < 0 || color > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const id = q.recording as BundledRecordingId, { duration } = bundledRecordingInfo[id];
  const start = q.windowStart as number, end = Math.min(1, start + (q.windowLength as number));
  const by = (distance: number, time: number): StationRule => q.sampling === "distance"
    ? { kind: "arc", spacing: distance } : { kind: "time", interval: time };
  const mark = (kind: string, prefix: string, petals: number, opening: number): MotifSpec => ({
    kind: kind as MotifSpec["kind"], size: q[`${prefix}Size`] as number, petals, opening, weight: q[`${prefix}Weight`] as number, rotation: 0,
    variation: q[`${prefix}Variation`] as number, retention: q[`${prefix}Retention`] as number });
  return {
    kind: "gesture-scores", seed: input.seed, palette: [...input.palette],
    recording: { kind: "bundled", id },
    smoothing: q.smoothing as number,
    frame: { centerX: q.centerX as number, centerY: q.centerY as number, scale: q.scale as number, rotation: q.rotation as number },
    window: { start: start * duration, end: end * duration },
    sampling: by(q.pathSpacing as number, q.pathInterval as number),
    pressure: { source: q.pressureSource as PressurePolicy["source"], whenAbsent: "speed", level: q.pressureLevel as number },
    pressureMap: { floor: q.pressureFloor as number, curve: q.pressureCurve as number },
    echoes: { count: q.echoes as number, dx: q.echoX as number, dy: q.echoY as number, turn: q.echoTurn as number },
    bristles: q.bristles ? { hairs: q.hairs as number, width: q.brushWidth as number, dryness: q.dryness as number,
      depletion: q.depletion as number, wander: q.hairWander as number, weight: q.hairWeight as number } : null,
    line: q.line === "none" ? null : { ...materialSpec(q.line === "ink" ? "ink" : "stitch", q.lineWeight as number, q.stitchSpacing as number, q.stitchPhase as number) },
    sand: q.sandMark === "none" ? null : { mark: { ...mark(q.sandMark as string, "sand", 6, 0) }, rate: q.sandRate as number, lag: q.sandLag as number,
      fall: q.sandFall as number, fallAngle: q.sandFallAngle as number, inherit: q.sandInherit as number, spread: q.sandSpread as number, gate: q.sandGate as number },
    glyphs: q.glyphMark === "none" ? null : { mark: mark(q.glyphMark as string, "glyph", q.glyphPetals as number, q.glyphOpening as number),
      sampling: by(q.glyphSpacing as number, q.glyphInterval as number), follow: q.glyphFollow as number,
      sizeFollow: q.glyphSizeFollow as number, offset: q.glyphOffset as number },
  };
}

/** The recording a recipe replays. Bundled ones are cached; supplied data is validated. */
export function resolveRecording(recipe: Pick<GestureScoreComposition, "recording" | "seed">): Recording {
  const { recording } = recipe;
  if (recording.kind === "bundled") return bundledRecording(recording.id, recipe.seed);
  if (recording.kind === "data") return createRecording(recording.data);
  throw new Error(`Unknown recording source: ${(recording as { kind: string }).kind}`);
}

/** Everything the consumers read for one repeat. Absent when its consumer is off. */
export interface GestureRepeat {
  readonly track: GestureTrack;
  readonly path: GesturePath | null;
  readonly hairs: readonly Path[];
  readonly grains: readonly GestureSite[];
  readonly glyphs: readonly GestureSite[];
}

const skipsMark = (mark: MotifSpec) => mark.retention === 0 || mark.size === 0;

function repeatProducts(recipe: GestureScoreComposition, base: GestureTrack, index: number): GestureRepeat {
  const { echoes, frame, seed, window, pressure } = recipe;
  const track = echoTrack(base, { index, turn: echoes.turn * index, dx: echoes.dx * index, dy: echoes.dy * index, pivotX: frame.centerX, pivotY: frame.centerY });
  const path = recipe.bristles || recipe.line ? gesturePath(track, { seed, sampling: recipe.sampling, window, pressure }) : null;
  return {
    track, path,
    hairs: recipe.bristles && path ? bristleBand(path, { hairs: recipe.bristles.hairs, width: recipe.bristles.width, map: recipe.pressureMap,
      dryness: recipe.bristles.dryness, depletion: recipe.bristles.depletion, wander: recipe.bristles.wander }) : [],
    grains: recipe.sand && !skipsMark(recipe.sand.mark) ? sandGrains(track, { seed, window, pressure, map: recipe.pressureMap, rate: recipe.sand.rate, lag: recipe.sand.lag,
      fall: recipe.sand.fall, fallAngle: recipe.sand.fallAngle, inherit: recipe.sand.inherit, spread: recipe.sand.spread, gate: recipe.sand.gate }) : [],
    glyphs: recipe.glyphs && !skipsMark(recipe.glyphs.mark) ? gestureSites(track, { seed, window, sampling: recipe.glyphs.sampling, pressure, map: recipe.pressureMap,
      follow: recipe.glyphs.follow, sizeFollow: recipe.glyphs.sizeFollow, offset: recipe.glyphs.offset }) : [],
  };
}
function replay(recipe: GestureScoreComposition): GestureTrack {
  const { count } = recipe.echoes;
  if (!Number.isInteger(count) || count < 1 || count > 16) throw new Error("Repeats must be an integer in [1, 16]");
  return gestureTrack(resolveRecording(recipe), { smoothing: recipe.smoothing, frame: recipe.frame });
}

/** Hair vertices of every repeat together are bounded like a single path: many repeats of a dense brush are one large drawing. */
function chargeHairs(repeats: readonly GestureRepeat[]): void {
  const points = repeats.reduce((sum, repeat) => sum + repeat.hairs.reduce((inner, hair) => inner + hair.points.length, 0), 0);
  if (points > MAX_HAIR_POINTS)
    throw new Error(`Bristles would draw ${points} hair vertices over ${repeats.length} repeats; the limit is ${MAX_HAIR_POINTS}. Lower the hair count or repeats, raise the sampling spacing or narrow the window`);
}

/** Producer results per repeat: the cached values `drawGestureScore` consumes. */
export function gestureScoreProducts(recipe: GestureScoreComposition): readonly GestureRepeat[] {
  const base = replay(recipe);
  const repeats: GestureRepeat[] = [];
  for (let index = 0; index < recipe.echoes.count; index++) { repeats.push(repeatProducts(recipe, base, index)); chargeHairs(repeats); }
  return repeats;
}

/** Draw the recipe into a caller-owned surface: bristles, line, sand, then glyphs. */
export function drawGestureScore(surface: CompositionSurface, recipe: GestureScoreComposition,
  consumers: GestureConsumers = {}, run: CompositionRun = createCompositionRun({ maxWork: 400_000 })): void {
  run.check();
  const repeats = gestureScoreProducts(recipe);
  if (recipe.bristles) {
    const hair = consumers.bristle ?? hairMaterial({ weight: recipe.bristles.weight, mix: 0, inkTone: 0, mixTone: 0 }, recipe.palette);
    for (const repeat of repeats) strokeWith(surface, repeat.hairs, hair, run);
  }
  if (recipe.line) {
    const line = consumers.line ?? tonedMaterial(pathMaterial(recipe.line, recipe.palette), 1);
    for (const repeat of repeats) if (repeat.path) strokeWith(surface, [repeat.path], line, run);
  }
  if (recipe.sand && !skipsMark(recipe.sand.mark)) {
    const mark = consumers.sand ?? motif(recipe.sand.mark, recipe.palette);
    for (const repeat of repeats) depositGrains(surface, repeat.grains, { mark }, run);
  }
  if (recipe.glyphs && !skipsMark(recipe.glyphs.mark)) {
    const glyph = consumers.glyph ?? motif(recipe.glyphs.mark, recipe.palette);
    for (const repeat of repeats) atEach(surface, repeat.glyphs, glyph, run);
  }
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the producers repeat by repeat, yielding between repeats; false if cancelled. */
export async function prepareGestureScore(recipe: GestureScoreComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const base = replay(recipe);
  const repeats: GestureRepeat[] = [];
  for (let index = 0; index < recipe.echoes.count; index++) {
    if (index > 0) { await yieldToHost(); if (cancelled()) return false; }
    repeats.push(repeatProducts(recipe, base, index));
    chargeHairs(repeats);
  }
  return !cancelled();
}
