import { engravingFromValues, fmEngravingDefinition } from "../adapters/fm-engraving-instrument.js";
import type { EngravingComposition, EngravingLineSpec } from "../adapters/fm-engraving-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { createCompositionRun, strokeWith } from "./core.js";
import { engravedLines, engravingTone } from "./engraving.js";
import type { EngravedLine, EngravingLines } from "./engraving.js";
import { pathMaterial } from "./materials.js";
import type { CompositionRun, CompositionSurface, Path, PathMaterial, PathMaterialSpec } from "./types.js";

/**
 * FM Engraving as a typed, JSON-compatible composition: one producer (`engravedLines`: tone field, carriers,
 * modulated runs with their sampled signal) and one replaceable consumer, a `PathMaterial`.
 *
 * - `source` is a bundled sample (`{kind: "bundled", id, variant}`, the only form a saved instrument can name) or a
 *   caller-resolved `Raster` (optionally with a region mask, e.g. `valueRegionMask`). Binding a user's own image to a
 *   saved instrument needs a host asset field; the library never fetches or decodes.
 * - The remaining fields are `EngravingOptions` (see engraving.ts for every unit and rule) plus `line`, the material.
 * - `line.kind` `ink` draws each run as continuous ink; `stitch` draws tangent stitches at `stitchSpacing`. Both are the
 *   ordinary `pathMaterial`. With `ink` and `widthGain > 0`, or with `colorBy: "tone"`, a run is split at the boundaries
 *   of ten tone bins into pieces (`<run id>/b:n`, sharing their end vertices) so each piece takes the weight
 *   `lineWeight * (1 + widthGain * (2 tau - 1))` (zero weight draws nothing) and, for `colorBy: "tone"`, the palette entry
 *   `floor(tau * palette length)` (the palette then runs from the lightest tone to the darkest). Splitting happens here, in the
 *   consumer, so no producer id or point depends on the weight or colour. `colorBy: "ink"` uses palette 0 and `"line"` alternates
 *   palette entries with the carrier index.
 * - `drawEngraving(surface, recipe, {line})` replaces the material with any callback that receives whole runs.
 *
 * Nothing here clears or fills the canvas; the layer is transparent paper.
 */
export type { ColorBy, EngravingComposition, EngravingLineSpec, LineKind } from "../adapters/fm-engraving-instrument.js";

export interface EngravingConsumers { line?: PathMaterial }

type Scalar = number | string | boolean;
const definition = fmEngravingDefinition;
export const TONE_BINS = 10;

/** Resolve stored scalar controls to the public composition value. */
export function engravingComposition(input: InstrumentInput): EngravingComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((color) =>
    !Number.isSafeInteger(color) || color < 0 || color > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  return engravingFromValues(q, input.seed, input.palette);
}

/** The producer results the consumer reads. */
export function engravingProducts(recipe: EngravingComposition): EngravingLines {
  return engravedLines(recipe);
}

interface Piece extends Path { readonly bin: number }
const pieceCache = new WeakMap<readonly EngravedLine[], readonly Piece[]>();

/** Runs split at the boundaries of `TONE_BINS` shaped-tone bins; consecutive pieces share their joining vertex. */
export function tonePieces(lines: readonly EngravedLine[]): readonly Piece[] {
  const hit = pieceCache.get(lines);
  if (hit) return hit;
  const out: Piece[] = [];
  const binOf = (tau: number): number => Math.min(TONE_BINS - 1, Math.floor(tau * TONE_BINS));
  for (const line of lines) {
    const tone = line.signal.tone, count = line.points.length;
    const ranges: [number, number][] = [];
    let start = 0;
    for (let i = 1; i < count; i++) if (binOf(tone[i]) !== binOf(tone[start])) { ranges.push([start, i]); start = i; }
    if (count - 1 > start) ranges.push([start, count - 1]);
    if (ranges.length === 1 && line.closed) { out.push(Object.freeze({ ...line, id: `${line.id}/b:0`, bin: binOf(tone[0]) })); continue; }
    ranges.forEach(([from, to], n) => out.push(Object.freeze({ id: `${line.id}/b:${n}`, seed: line.seed, points: line.points.slice(from, to + 1), closed: false,
      level: line.level, levelFraction: line.levelFraction, bin: binOf(tone[from]) })));
  }
  pieceCache.set(lines, Object.freeze(out));
  return out;
}

const toned = (material: PathMaterial, tone: (path: Path) => number): PathMaterial => (surface, path, run) => material(surface, { ...path, tone: tone(path) }, run);

function materialSpec(line: EngravingLineSpec, weight: number): PathMaterialSpec {
  const mark = { kind: "dot" as const, size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 };
  return line.kind === "ink"
    ? { kind: "ink", weight, spacing: 4, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark }
    : { kind: "stitch", weight, spacing: line.stitchSpacing, phase: line.stitchPhase, phaseSpread: 0, levelRamp: 0, retention: 1, mark };
}

/** Palette index for a tone bin: the palette runs from the lightest tone to the darkest. */
export const binColor = (bin: number, palette: readonly number[]): number => Math.min(palette.length - 1, Math.floor(((bin + 0.5) / TONE_BINS) * palette.length));
const lineColor = (level: number, palette: readonly number[]): number => ((level % palette.length) + palette.length) % palette.length;

/** Draw the recipe into a caller-owned surface. */
export function drawEngraving(surface: CompositionSurface, recipe: EngravingComposition, consumers: EngravingConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 1_000_000 })): void {
  run.check();
  const { lines } = engravingProducts(recipe), { line, palette } = recipe;
  if (consumers.line) { strokeWith(surface, lines, consumers.line, run); return; }
  const binned = line.colorBy === "tone" || (line.kind === "ink" && line.widthGain > 0);
  if (!binned) {
    if (line.weight === 0) return;
    const material = pathMaterial(materialSpec(line, line.weight), palette);
    strokeWith(surface, lines, toned(material, (path) => (line.colorBy === "line" ? lineColor(path.level, palette) : 0)), run);
    return;
  }
  const pieces = tonePieces(lines);
  for (let bin = 0; bin < TONE_BINS; bin++) {
    const tau = (bin + 0.5) / TONE_BINS;
    const weight = line.kind === "ink" ? line.weight * (1 + line.widthGain * (2 * tau - 1)) : line.weight;
    if (weight <= 0) continue;
    const material = pathMaterial(materialSpec(line, weight), palette);
    const color = line.colorBy === "tone" ? binColor(bin, palette) : -1;
    strokeWith(surface, pieces.filter((piece) => piece.bin === bin),
      toned(material, (path) => (color >= 0 ? color : line.colorBy === "line" ? lineColor(path.level, palette) : 0)), run);
  }
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the producers stage by stage, yielding between them; false if cancelled. */
export async function prepareEngraving(recipe: EngravingComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  engravingTone(recipe);
  await yieldToHost();
  if (cancelled()) return false;
  const { lines } = engravingProducts(recipe);
  if (recipe.line.colorBy === "tone" || (recipe.line.kind === "ink" && recipe.line.widthGain > 0)) tonePieces(lines);
  return !cancelled();
}
