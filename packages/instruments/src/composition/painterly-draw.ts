import { painterlySourceDefinition, PAINT_IMAGE_SIZE } from "../adapters/painterly-source-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { atEach, createCompositionRun, strokeWith } from "./core.js";
import { motif, pathMaterial } from "./materials.js";
import { paintPlan, preparePaintPlan } from "./painterly.js";
import type { PaintFamily, PaintFrame, PaintLayer, PaintPlan, PaintPlanOptions, PaintSubject } from "./painterly.js";
import { checkPaintMaterial, isPathMaterial, keepsMark, paintLayerMaterial, paintPalette } from "./painterly-style.js";
import type { PaintColorSpec, PaintMaterialKind, PaintMaterialSpec } from "./painterly-style.js";
import { createRaster } from "./raster.js";
import type { Raster, RasterData } from "./raster.js";
import { bundledRaster } from "./raster-samples.js";
import type { BundledRasterId } from "./raster-samples.js";
import type { CompositionRun, CompositionSurface, Mark, PathMaterial, Site } from "./types.js";

/**
 * Painterly Source as a typed, JSON-compatible composition: one producer (`paintPlan`) and one
 * consumer that draws the plan through the existing `pathMaterial` / `motif`.
 *
 * - `source` is a bundled subject (`{kind: "bundled", id, variant, size}`; deterministic, generated,
 *   never fetched) or caller-resolved pixels (`{kind: "data", data}`, validated by `createRaster`).
 *   A host's own image goes through the second form; persisted instruments name bundled subjects only.
 *   Direct callers may also pass any `Raster` to `paintPlan`.
 * - `plan` and `frame` are the construction (see `painterly.ts`); `retention`, `material` and `color`
 *   are appearance. Changing an appearance field reuses the cached plan object; nothing in it moves.
 * - `drawPainterly(surface, recipe, consumers)` draws layer by layer, coarse first. `consumers.path`
 *   or `consumers.mark` replace the stock material with an ordinary callback per layer; the plan's
 *   sites and paths are the same cached objects either way. Work is charged to the run (default
 *   1,000,000 callback units) and checked exactly before anything is drawn.
 */
export type PaintSource =
  | { kind: "bundled"; id: BundledRasterId; variant: number; size: number }
  | { kind: "data"; data: RasterData };

export type PaintShape = Omit<PaintPlanOptions, "seed" | "source" | "frame">;

export interface PainterlyComposition {
  kind: "painterly-source";
  seed: number;
  palette: readonly number[];
  source: PaintSource;
  frame: PaintFrame;
  plan: PaintShape;
  /** Stable omission of marks, 0..1 (appearance: applies to every material identically). */
  retention: number;
  material: PaintMaterialSpec;
  color: PaintColorSpec;
}

/** Replace the stock consumer with your own; called once per layer with the drawing palette. */
export interface PaintConsumers {
  path?: (layer: PaintLayer, palette: readonly number[]) => PathMaterial;
  mark?: (layer: PaintLayer, palette: readonly number[]) => Mark;
}

/** The drawing budget: callback units (one per mark, plus a stitch or bead material's own steps). */
export const PAINT_DRAW_WORK = 1_000_000;

type Scalar = number | string | boolean;
const definition = painterlySourceDefinition;

const dataRasters = new WeakMap<RasterData, Raster>();
/** The raster a recipe reads; bundled ones are cached by the library, supplied data is validated once. */
export function resolvePaintSource(source: PaintSource): Raster {
  if (source.kind === "bundled") return bundledRaster(source.id, source.variant, source.size);
  if (source.kind === "data") {
    let made = dataRasters.get(source.data);
    if (!made) { made = createRaster(source.data); dataRasters.set(source.data, made); }
    return made;
  }
  throw new Error(`Unknown painterly source: ${(source as { kind: string }).kind}`);
}

/** Resolve stored scalar controls to the public composition value. */
export function painterlyComposition(input: InstrumentInput): PainterlyComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((color) =>
    !Number.isSafeInteger(color) || color < 0 || color > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const subject: PaintSubject | null = q.subject === "window"
    ? { centerX: q.subjectX as number, centerY: q.subjectY as number, width: q.subjectWidth as number, height: q.subjectHeight as number, feather: q.feather as number }
    : null;
  return {
    kind: "painterly-source", seed: input.seed, palette: [...input.palette],
    source: { kind: "bundled", id: q.image as BundledRasterId, variant: q.imageVariant as number, size: PAINT_IMAGE_SIZE },
    frame: { centerX: q.centerX as number, centerY: q.centerY as number, width: q.size as number, height: q.size as number },
    plan: { layers: q.layers as number, brush: q.brush as number, ratio: q.ratio as number, coverage: q.coverage as number,
      family: q.family as PaintFamily, threshold: q.threshold as number, jitter: q.jitter as number, coherence: q.coherence as number,
      baseAngle: q.baseAngle as number, smoothing: q.smoothing as number, scatter: q.scatter as number, paper: q.paper as number, subject },
    retention: q.retention as number,
    material: { kind: q.material as PaintMaterialKind, fill: q.fill as number, lineWeight: q.lineWeight as number, petals: q.petals as number },
    color: { mode: q.colorMode as PaintColorSpec["mode"], colors: q.colors as number, saturation: q.saturation as number },
  };
}

/** The producer options a recipe stands for (construction only). */
export function paintPlanOptions(recipe: PainterlyComposition): PaintPlanOptions {
  return { ...recipe.plan, seed: recipe.seed, source: resolvePaintSource(recipe.source), frame: recipe.frame };
}

/** The cached plan a recipe draws. */
export function painterlyPlan(recipe: PainterlyComposition): PaintPlan {
  return paintPlan(paintPlanOptions(recipe));
}

/** Callback units drawing would charge: exact, so the budget fails before a mark is painted. */
export function paintDrawWork(plan: PaintPlan, recipe: Pick<PainterlyComposition, "material" | "retention">): number {
  if (!isPathMaterial(recipe.material.kind)) return plan.marks.filter((mark) => keepsMark(mark, recipe.retention)).length;
  let work = 0;
  for (const layer of plan.layers) {
    const built = paintLayerMaterial(layer, plan.options.family, recipe.material);
    if (!("path" in built)) continue;
    const { spacing, kind } = built.path;
    for (let m = layer.first; m < layer.first + layer.count; m++) {
      const mark = plan.marks[m];
      if (!keepsMark(mark, recipe.retention)) continue;
      work += 1;
      if (kind === "ink") continue;
      const points = mark.path.points;
      let length = 0;
      for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      const intervals = Math.max(1, Math.ceil(length / spacing));
      work += points.length + (intervals + 1) + intervals;
    }
  }
  return work;
}

const skips = (recipe: PainterlyComposition): boolean => recipe.retention === 0 || recipe.material.fill === 0;

/** Draw the recipe into a caller-owned surface, coarse layer first; no surface clearing, transparent. */
export function drawPainterly(surface: CompositionSurface, recipe: PainterlyComposition, consumers: PaintConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: PAINT_DRAW_WORK })): void {
  run.check();
  const options = paintPlanOptions(recipe);
  checkPaintMaterial(options.brush, options.ratio, options.layers, options.family, recipe.material);
  const plan = paintPlan(options);
  if (skips(recipe) || plan.marks.length === 0) return;
  const budget = paintDrawWork(plan, recipe);
  if (budget > PAINT_DRAW_WORK)
    throw new Error(`Painterly source: drawing needs ${budget} callback units for ${plan.marks.length} marks; the budget is ${PAINT_DRAW_WORK}. Choose a simpler material, raise threshold or brush, or lower layers or coverage`);
  const palette = paintPalette(plan, recipe.color, recipe.palette);
  const usePath = consumers.path !== undefined || (consumers.mark === undefined && isPathMaterial(recipe.material.kind));
  for (const layer of plan.layers) {
    const kept: number[] = [];
    for (let m = layer.first; m < layer.first + layer.count; m++) if (keepsMark(plan.marks[m], recipe.retention)) kept.push(m);
    if (kept.length === 0) continue;
    const built = paintLayerMaterial(layer, options.family, recipe.material);
    if (usePath) {
      const consumer = consumers.path?.(layer, palette) ?? ("path" in built ? pathMaterial(built.path, palette) : undefined);
      if (!consumer) throw new Error("Painterly source: the chosen material draws at sites; pass consumers.path or choose a stroke material");
      strokeWith(surface, kept.map((m) => plan.paths[m]), consumer, run);
    } else {
      const consumer = consumers.mark?.(layer, palette) ?? ("mark" in built ? motif(built.mark, palette) : undefined);
      if (!consumer) throw new Error("Painterly source: the chosen material draws along paths; pass consumers.mark or choose a point material");
      atEach(surface, kept.map((m): Site => plan.sites[m]), consumer, run);
    }
  }
}

/** Build the plan cooperatively, yielding between layers; false if cancelled. */
export async function preparePainterly(recipe: PainterlyComposition, cancelled: () => boolean): Promise<boolean> {
  return preparePaintPlan(paintPlanOptions(recipe), cancelled);
}
