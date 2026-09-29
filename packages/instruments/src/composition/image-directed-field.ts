import { imageDirectedFieldDefinition } from "../adapters/image-directed-field-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { atEach, createCompositionRun, strokeWith } from "./core.js";
import { fieldLines, fieldSites, imageField } from "./image-field.js";
import type { AmbientKind, FieldGate, FieldImage, FieldLine, FieldMode, FieldSite, FieldValue, ImageField, ImageFieldOptions } from "./image-field.js";
import { motif, pathMaterial } from "./materials.js";
import type { BundledRasterId } from "./raster-samples.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, PathMaterial, PathMaterialSpec } from "./types.js";

/**
 * Image Directed Field as a typed composition: one producer (the image's direction field, its
 * confidence, and what is traced or placed in it) and two consumers (a path material and a mark).
 * See `image-field.ts` for the field, lines and sites, and `streamlines.ts` for the tracer.
 *
 * - `field` holds the image, channel, coherence scale, follow/resist/blend mode, ambient field and
 *   frame; `gate` the confidence threshold and optional tone mask. Nothing else changes geometry.
 * - `lines` (null: none) are the streamline construction; `marks` (null: none) the oriented sites.
 * - `material` draws every line (ink, stitches or beads); `toneWeight` thins it toward light image
 *   areas (weight, and bead size, by `1 - toneWeight * meanValue`, quantised to eighths).
 * - `colorBy` picks each line's or mark's palette index from an attribute read at draw time:
 *   `single` palette 0, `tone` the tone of the image there (dark = first colour), `direction` the drawn
 *   orientation in equal turns of the palette, `random` a stable hash of the id. Recolouring never moves
 *   or renames anything.
 *
 * The image is bundled (named in stored values) or a caller-resolved `Raster` (`FieldImage`); hosts bind
 * their own images through the latter, which is not persisted by the instrument.
 *
 * `drawImageDirectedField(surface, recipe, consumers)` replaces the material or the mark with an
 * ordinary callback while the lines and sites stay the same cached objects. Lines are drawn first,
 * then marks. Drawing is charged to the run (default 600,000 callback units): a drawing that would exceed
 * it throws before painting, naming the controls to change.
 */
export type ColorBy = "single" | "tone" | "direction" | "random";

export interface LineConstruction {
  clip: boolean; separation: number; stopFraction: number; startSpacing: number; startJitter: number;
  fill: boolean; minLength: number; maxLength: number; minRadius: number;
}

export interface ImageDirectedFieldComposition {
  kind: "image-directed-field";
  seed: number;
  field: ImageFieldOptions;
  gate: FieldGate;
  lines: LineConstruction | null;
  marks: { spacing: number; jitter: number; mark: MotifSpec } | null;
  material: PathMaterialSpec;
  toneWeight: number;
  colorBy: ColorBy;
  palette: readonly number[];
}

/** Replace either consumer with an ordinary callback. */
export interface ImageDirectedFieldConsumers {
  line?: PathMaterial;
  mark?: Mark;
}

export interface ImageDirectedFieldProducts {
  readonly field: ImageField;
  readonly lines: readonly FieldLine[];
  readonly sites: readonly FieldSite[];
}

type Scalar = number | string | boolean;
export const MAX_DRAW_UNITS = 600_000;

/** Resolve stored scalar controls to the public composition value. */
export function imageDirectedFieldComposition(input: InstrumentInput): ImageDirectedFieldComposition {
  const definition = imageDirectedFieldDefinition;
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((color) =>
    !Number.isSafeInteger(color) || color < 0 || color > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const mark = q.mark as string;
  const material = q.material as PathMaterialSpec["kind"];
  return {
    kind: "image-directed-field", seed: input.seed, palette: [...input.palette],
    field: {
      image: { kind: "bundled", id: q.image as BundledRasterId, variant: q.imageVariant as number, size: q.resolution as number },
      value: q.channel as FieldValue, smoothing: q.smoothing as number, mode: q.mode as FieldMode,
      ambient: { kind: q.ambientKind as AmbientKind, angle: q.ambientAngle as number, weight: q.ambientWeight as number },
      frame: { centerX: q.centerX as number, centerY: q.centerY as number, width: q.width as number, height: q.height as number, rotation: q.rotation as number },
    },
    gate: { minConfidence: q.minConfidence as number, mask: q.maskTones ? { min: q.maskMin as number, max: q.maskMax as number } : null },
    lines: q.lines ? { clip: q.clip as boolean, separation: q.separation as number, stopFraction: q.stopFraction as number, startSpacing: q.startSpacing as number,
      startJitter: q.startJitter as number, fill: q.fill as boolean, minLength: q.minLength as number, maxLength: q.maxLength as number, minRadius: q.minRadius as number } : null,
    marks: mark === "none" ? null : { spacing: q.markSpacing as number, jitter: q.markJitter as number,
      mark: { kind: mark as MotifSpec["kind"], size: q.markSize as number, petals: q.markPetals as number, opening: q.markOpening as number,
        weight: q.markWeight as number, rotation: 0, variation: q.markVariation as number, retention: q.markRetention as number } },
    material: { kind: material, weight: q.weight as number, spacing: q.spacing as number, phase: q.phase as number, phaseSpread: q.phaseSpread as number,
      levelRamp: 0, retention: q.retention as number,
      mark: { kind: q.beadMark as MotifSpec["kind"], size: q.beadSize as number, petals: q.beadPetals as number, opening: q.beadOpening as number,
        weight: q.beadWeight as number, rotation: 0, variation: 0, retention: 1 } },
    toneWeight: q.toneWeight as number, colorBy: q.colorBy as ColorBy,
  };
}

/** The producers of a recipe, cached by construction. Replaces `cancelled` polling inside tracing. */
export function imageDirectedFieldProducts(recipe: ImageDirectedFieldComposition, cancelled?: () => boolean): ImageDirectedFieldProducts {
  const field = imageField(recipe.field);
  const { lines, marks, gate, seed } = recipe;
  return {
    field,
    lines: lines ? fieldLines({ field, gate, seed, ...lines }, cancelled) : [],
    sites: marks && marks.mark.size > 0 && marks.mark.retention > 0 ? fieldSites({ field, gate, seed, spacing: marks.spacing, jitter: marks.jitter }) : [],
  };
}

const LEVELS = 8;

function tone(colorBy: ColorBy, value: number, direction: number, palette: readonly number[]): number | undefined {
  const n = palette.length;
  switch (colorBy) {
    case "single": return 0;
    case "tone": return Math.min(n - 1, Math.floor(value * n));
    case "direction": return Math.min(n - 1, Math.floor(direction / Math.PI * n));
    case "random": return undefined;
  }
}

/** Palette index for a line or site, from attributes read at draw time. */
export function fieldTone(colorBy: ColorBy, palette: readonly number[], item: { value?: number; meanValue?: number; angle?: number; meanDirection?: number }): number | undefined {
  return tone(colorBy, item.meanValue ?? item.value ?? 0, item.meanDirection ?? item.angle ?? 0, palette);
}

/** Line weights are quantised to `LEVELS` steps so that one material serves many lines. */
export function toneLevel(toneWeight: number, meanValue: number): number {
  return Math.max(1, Math.round((1 - toneWeight * meanValue) * LEVELS));
}

function chargeDrawing(recipe: ImageDirectedFieldComposition, products: ImageDirectedFieldProducts): void {
  let units = products.lines.length + products.sites.length;
  const { material } = recipe;
  if (material.kind !== "ink" && material.retention > 0)
    for (const line of products.lines) {
      const stations = Math.max(1, Math.ceil(line.length / material.spacing)) + 1;
      units += line.points.length + 2 * stations;
    }
  if (units > MAX_DRAW_UNITS)
    throw new Error(`The drawing would need ${units} callback units (lines, stations and marks); the limit is ${MAX_DRAW_UNITS}. Raise Station spacing or Line separation, or lower Longest line`);
}

/** Draw the recipe into a caller-owned surface: lines (with the material), then marks. */
export function drawImageDirectedField(surface: CompositionSurface, recipe: ImageDirectedFieldComposition,
  consumers: ImageDirectedFieldConsumers = {}, run: CompositionRun = createCompositionRun({ maxWork: MAX_DRAW_UNITS })): void {
  run.check();
  const products = imageDirectedFieldProducts(recipe, () => { run.check(); return false; });
  chargeDrawing(recipe, products);
  const { palette, colorBy, material } = recipe;
  if (products.lines.length) {
    const levels = new Map<number, PathMaterial>();
    const materialFor = (level: number): PathMaterial => {
      let found = levels.get(level);
      if (!found) {
        const f = level / LEVELS;
        found = pathMaterial(level === LEVELS ? material : { ...material, weight: material.weight * f,
          mark: material.kind === "beads" ? { ...material.mark, size: material.mark.size * f } : material.mark }, palette);
        levels.set(level, found);
      }
      return found;
    };
    const custom = consumers.line;
    strokeWith(surface, products.lines, (p, line, r) => {
      const t = fieldTone(colorBy, palette, line);
      const drawn = t === undefined ? line : { ...line, tone: t };
      (custom ?? materialFor(toneLevel(recipe.toneWeight, line.meanValue)))(p, drawn, r);
    }, run);
  }
  if (recipe.marks && products.sites.length) {
    const draw = consumers.mark ?? motif(recipe.marks.mark, palette);
    atEach(surface, products.sites.map((site) => {
      const t = fieldTone(colorBy, palette, site);
      return t === undefined ? site : { ...site, tone: t };
    }), draw, run);
  }
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the producers stage by stage (image analysis, lines, sites), yielding between them; false if cancelled. */
export async function prepareImageDirectedField(recipe: ImageDirectedFieldComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  try {
    const field = imageField(recipe.field);
    await yieldToHost();
    if (cancelled()) return false;
    if (recipe.lines) fieldLines({ field, gate: recipe.gate, seed: recipe.seed, ...recipe.lines }, cancelled);
    await yieldToHost();
    if (cancelled()) return false;
    const { marks } = recipe;
    if (marks && marks.mark.size > 0 && marks.mark.retention > 0) fieldSites({ field, gate: recipe.gate, seed: recipe.seed, spacing: marks.spacing, jitter: marks.jitter });
    return !cancelled();
  } catch (error) {
    if (error instanceof Error && error.message === "Composition cancelled") return false;
    throw error;
  }
}
