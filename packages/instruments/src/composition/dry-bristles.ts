import { dryBristlesDefinition } from "../adapters/dry-bristles-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { componentSeed, createCompositionRun, strokeWith } from "./core.js";
import { bristleContact, drawFootprint, hairMaterial, planBristles, unit } from "./bristle.js";
import type { BristleContact, BristleFrame, BristleInk, BristleOptions, BristleTrack, BrushHold, PressureProfile, TipShape } from "./bristle.js";
import { bristleSourcePaths } from "./bristle-sources.js";
import type { BristleSource, SourceFrame, TraceFigure } from "./bristle-sources.js";
import { pathMaterial, tonedMaterial } from "./materials.js";
import type { BundledRecordingId } from "./recording-samples.js";
import type { CompositionRun, CompositionSurface, ContourOptions, Path, PathMaterial, PathMaterialSpec } from "./types.js";

/**
 * Dry Bristles as a typed, JSON-compatible composition: one producer (source paths, read as brush
 * tracks) and two consumers of the same paths (heavy bristle strokes, fine line).
 *
 * - `source` is a bundled source (`traces`, `contours`, `scribble`) or caller-resolved path data
 *   (`{kind: "paths"}`); see `bristle-sources.ts`. Persisted instruments name only bundled sources; a
 *   host binding a user's own paths uses the second form.
 * - `strokes` picks which paths are brushed: a path is heavy when it is at least `minLength` long and
 *   its stable draw `unit(path.seed, path.id, "brush")` is below `share`, so raising `share` adds
 *   strokes and never moves or removes one. `widthVariation` narrows a stroke by a further stable draw
 *   (`width * (1 - variation * u)`), so strokes differ in weight without changing which ones exist.
 * - `frame`, `brush` are the brush's construction (`bristle.ts`); `ink` is its drawing (palette tones:
 *   hairs 0, second pigment 2, footprint wash 3). Only `frame` and `brush` reach a producer.
 * - `line` strokes the paths that are not brushed (every path with `lineOverBrush`) through the
 *   existing `pathMaterial`, palette tone 1, drawn after the strokes.
 *
 * Draw order: every footprint wash, every stroke's hairs, then the line. `drawDryBristles(surface,
 * recipe, {hair, line})` replaces either consumer with an ordinary `PathMaterial` while the paths, tracks
 * and hairs stay the same cached objects. The producers are public: `strokeWith(surface, hairs, material)`
 * needs no descriptor. Work is charged to the run (default 400,000 callback units) per hair path.
 */
export interface DryBristlesComposition {
  kind: "dry-bristles";
  seed: number;
  source: BristleSource;
  strokes: { share: number; minLength: number; widthVariation: number };
  frame: BristleFrame;
  brush: BristleOptions;
  ink: BristleInk;
  line: PathMaterialSpec | null;
  lineOverBrush: boolean;
  palette: readonly number[];
}

/** Replace either consumer of `drawDryBristles` with an ordinary callback. */
export interface DryBristlesConsumers {
  hair?: PathMaterial;
  line?: PathMaterial;
}

type Scalar = number | string | boolean;
const definition = dryBristlesDefinition;

const dot = { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } as const;
const ADVICE = "Lower Hairs, raise Path step, lower Heavy share or raise Shortest heavy path";

/** Resolve stored scalar controls to the public composition value. */
export function dryBristlesComposition(input: InstrumentInput): DryBristlesComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) =>
    !Number.isSafeInteger(c) || c < 0 || c > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const frame: SourceFrame = { centerX: q.centerX as number, centerY: q.centerY as number, scale: q.scale as number, rotation: q.rotation as number };
  let source: BristleSource;
  switch (q.source) {
    case "traces": source = { kind: "traces", figure: q.figure as TraceFigure, count: q.traceCount as number, spread: q.traceSpread as number, frame }; break;
    case "contours": source = { kind: "contours", field: q.contourField as ContourOptions["source"], frequency: q.contourFrequency as number,
      levels: q.contourLevels as number, interval: q.contourInterval as number, frame }; break;
    case "scribble": source = { kind: "scribble", recording: q.recording as BundledRecordingId, strokeLength: q.strokeLength as number, frame }; break;
    default: throw new Error(`Unknown source: ${String(q.source)}`);
  }
  const tip = q.tip as TipShape;
  return {
    kind: "dry-bristles", seed: input.seed, palette: [...input.palette], source,
    strokes: { share: q.brushShare as number, minLength: q.brushMinLength as number, widthVariation: q.widthVariation as number },
    frame: { step: q.step as number, pressure: { profile: q.pressureProfile as PressureProfile, level: q.pressureLevel as number, pulses: q.pulses as number } },
    brush: {
      hairs: q.hairs as number, width: q.brushWidth as number, map: { floor: q.pressureFloor as number, curve: q.pressureCurve as number },
      dryness: q.dryness as number, depletion: q.depletion as number, wander: q.hairWander as number,
      distribution: { bias: q.bias as number, tufts: q.tufts as number, clumping: q.clumping as number, cohesion: q.cohesion as number },
      hold: { mode: q.hold as BrushHold, tilt: q.tilt as number },
      tip: { shape: tip, length: tip === "blunt" ? 0 : q.tipLength as number },
      attack: q.attack as number, release: q.release as number,
      ...(q.paper ? { paper: { seed: componentSeed(input.seed, "paper", "tooth"), strength: q.toothStrength as number, grain: q.toothGrain as number } } : {}),
    },
    ink: { weight: q.hairWeight as number, mix: q.hairMix as number, inkTone: 0, mixTone: 2, wash: q.wash as number, washTone: 3 },
    line: q.line === "none" ? null : { kind: q.line === "ink" ? "ink" : "stitch", weight: q.lineWeight as number, spacing: q.stitchSpacing as number,
      phase: q.stitchPhase as number, phaseSpread: 0, levelRamp: 0, retention: 1, mark: dot },
    lineOverBrush: q.lineOverBrush as boolean,
  };
}

/** Length of a path's polyline, closing edge included. */
function polylineLength(path: Path): number {
  let length = 0;
  for (let i = 1; i < path.points.length; i++) length += Math.hypot(path.points[i][0] - path.points[i - 1][0], path.points[i][1] - path.points[i - 1][1]);
  if (path.closed && path.points.length > 1) {
    const a = path.points[0], b = path.points[path.points.length - 1];
    length += Math.hypot(a[0] - b[0], a[1] - b[1]);
  }
  return length;
}

/** What the consumers read: the source paths, the brushed subset (as tracks and options) and the fine-line paths. */
export interface DryBristlesPlan {
  readonly paths: readonly Path[];
  readonly brushed: readonly Path[];
  readonly fine: readonly Path[];
  readonly tracks: readonly BristleTrack[];
  readonly options: readonly BristleOptions[];
}

/** The producers' plan for a recipe, after the family work bound and before any hair exists. */
export function dryBristlesPlan(recipe: DryBristlesComposition): DryBristlesPlan {
  const { strokes } = recipe;
  const paths = bristleSourcePaths(recipe.seed, recipe.source);
  // Heavy paths: the eligible ones (long enough) ranked by a stable draw; `ceil(share * eligible)` of them, so a positive share always brushes something and raising it only adds strokes.
  const eligible = paths.filter((path) => polylineLength(path) >= strokes.minLength);
  const ranked = eligible.map((path) => ({ path, draw: unit(path.seed, path.id, "brush") })).sort((a, b) => a.draw - b.draw || (a.path.id < b.path.id ? -1 : 1));
  const count = Math.min(ranked.length, Math.ceil(strokes.share * ranked.length - 1e-9));
  const chosen = new Set(ranked.slice(0, count).map((entry) => entry.path));
  const brushed = paths.filter((path) => chosen.has(path));
  const fine = recipe.line ? paths.filter((path) => recipe.lineOverBrush || !chosen.has(path)) : [];
  const planned = planBristles(brushed, recipe.frame, (path) => ({ ...recipe.brush, width: recipe.brush.width * (1 - strokes.widthVariation * unit(path.seed, path.id, "width")) }), ADVICE);
  return { paths, brushed, fine, options: planned.options, tracks: planned.tracks };
}

/** The frozen strokes of a plan: one `BristleContact` per brushed path, cached by construction. */
export function dryBristlesStrokes(plan: DryBristlesPlan): readonly BristleContact[] {
  return plan.tracks.map((track, index) => bristleContact(track, plan.options[index]));
}

/** Draw the recipe into a caller-owned surface: footprint washes, hairs, then the fine line. */
export function drawDryBristles(surface: CompositionSurface, recipe: DryBristlesComposition, consumers: DryBristlesConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 400_000 })): void {
  run.check();
  const plan = dryBristlesPlan(recipe);
  const strokes = dryBristlesStrokes(plan);
  for (const stroke of strokes) drawFootprint(surface, stroke, recipe.ink, recipe.palette, run);
  const hair = consumers.hair ?? hairMaterial(recipe.ink, recipe.palette);
  for (const stroke of strokes) strokeWith(surface, stroke.hairs, hair, run);
  if (recipe.line && plan.fine.length > 0)
    strokeWith(surface, plan.fine, consumers.line ?? tonedMaterial(pathMaterial(recipe.line, recipe.palette), 1), run);
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the source, the work plan and every stroke's hairs, yielding between strokes; false if cancelled. */
export async function prepareDryBristles(recipe: DryBristlesComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const plan = dryBristlesPlan(recipe);
  let slice = performance.now();
  for (let index = 0; index < plan.tracks.length; index++) {
    bristleContact(plan.tracks[index], plan.options[index]);
    if (performance.now() - slice > 12) { await yieldToHost(); if (cancelled()) return false; slice = performance.now(); }
  }
  return !cancelled();
}
