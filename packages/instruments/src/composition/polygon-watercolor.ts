import { polygonWatercolorDefinition } from "../adapters/polygon-watercolor-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { componentSeed, createCompositionRun } from "./core.js";
import type { PlanarDomain } from "./domains.js";
import { washParentDomain } from "./wash-shapes.js";
import type { WashParent, WashPlacement, WashWord } from "./wash-shapes.js";
import { prepareWashPasses, washPasses } from "./wash.js";
import type { WashDivergence, WashOptions, WashPass, WashPasses } from "./wash.js";
import type { CompositionRun, CompositionSurface } from "./types.js";

/**
 * Polygon Watercolor as a typed, JSON-compatible composition: one producer (`washPasses`: pass geometry, a
 * `PlanarDomain` per region and pass) and one replaceable consumer (the painting of a pass).
 *
 * - `parent` is a bundled shape (`blob`, `ring`, `letters`, `quilt`, fitted to `placement`) or a caller-resolved
 *   `{ kind: "domain" }` (any `PlanarShape`). Persisted instruments name only bundled shapes; a host binding the user's
 *   own silhouette or type uses the second form.
 * - `wash` is everything structural (`WashOptions`, header of `wash.ts`); `ink` is appearance only. Only `parent`,
 *   `placement` and `wash` reach a producer: pigment, opacity, edge and palette never enter a cache key, so recolouring
 *   or changing opacity returns the very same pass objects.
 * - Draw order: pass 0 of every region, pass 1, ...; each pass is filled (`pass.fills`, keyholed so holes stay open) with palette colour
 *   `tone` at alpha `opacity`, then its paper-facing edges (`pass.edges`: the boundary without the stretches on a reserved mask) are stroked with the darker edge pigment. `tone` is 0 for one pigment; for
 *   two pigments pass `k` (all regions) uses colour 1 when `unit(seed, "pass:k", "pigment") < mix`, else 0; for a pigment
 *   per region colour `componentSeed(seed, region.id, "pigment") % palette.length`.
 *
 * `drawPolygonWatercolor(surface, recipe, { pass })` replaces the painter with any ordinary callback over the same
 * frozen passes. Work is charged to the run (one unit per pass).
 */
export interface WashInk {
  readonly pigment: "one" | "two" | "region";
  readonly mix: number;
  readonly opacity: number;
  readonly edge: number;
  readonly edgeWeight: number;
}
export interface PolygonWatercolorComposition {
  readonly kind: "polygon-watercolor";
  readonly seed: number;
  readonly placement: WashPlacement;
  readonly parent: WashParent;
  readonly wash: WashOptions;
  readonly ink: WashInk;
  readonly palette: readonly number[];
}
/** Paint one pass. It must not clear the canvas or leave style or transform state changed. */
export type WashPainter = (surface: CompositionSurface, pass: WashPass, run: CompositionRun) => void;
export interface PolygonWatercolorConsumers { readonly pass?: WashPainter }

type Scalar = number | string | boolean;
const definition = polygonWatercolorDefinition;
const U32 = 0x1_0000_0000;

/** Resolve stored scalar controls to the public composition value. */
export function polygonWatercolorComposition(input: InstrumentInput): PolygonWatercolorComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) =>
    !Number.isSafeInteger(c) || c < 0 || c > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  let parent: WashParent;
  switch (q.shape) {
    case "blob": parent = { kind: "blob", lobes: q.lobes as number, holes: q.holeCount as number, holeSize: q.holeSize as number }; break;
    case "ring": parent = { kind: "ring", holeSize: q.ringHole as number }; break;
    case "letters": parent = { kind: "letters", word: q.word as WashWord }; break;
    case "quilt": parent = { kind: "quilt", compartments: q.compartments as number, merge: q.merge as number, layout: q.layout as "abutting" | "gapped", gutter: q.gutter as number }; break;
    default: throw new Error(`Unknown shape: ${String(q.shape)}`);
  }
  return {
    kind: "polygon-watercolor", seed: input.seed, palette: [...input.palette], parent,
    placement: { centerX: q.centerX as number, centerY: q.centerY as number, width: q.width as number, height: q.height as number, rotation: q.rotation as number },
    wash: {
      seed: input.seed, passes: q.passes as number,
      boundary: { swell: q.swell as number, octaves: q.detail as number, roughness: q.roughness as number, variance: q.variance as number,
        independence: q.independence as number, divergence: q.divergence as WashDivergence },
      creep: q.creep as number, patches: q.extent === "patches" ? { size: q.patchSize as number, focus: q.focus as number } : null,
      coupling: q.coupling as "one" | "separate", holes: q.holes as "reserved" | "open", margin: q.margin as number,
    },
    ink: { pigment: q.pigment as WashInk["pigment"], mix: q.mix as number, opacity: q.opacity as number, edge: q.edge as number, edgeWeight: q.edgeWeight as number },
  };
}

/** Whether the seed can change this drawing: the blob and quilt are seeded shapes; otherwise chance enters only through the boundary, the patches or the pigment draws. */
export const polygonWatercolorUsesSeed = (q: Readonly<Record<string, number | string | boolean>>): boolean =>
  q.shape === "blob" || q.shape === "quilt" || Number(q.variance) > 0 || q.extent === "patches" || q.pigment !== "one";

/** The parent domain of a recipe (cached: the same recipe structure returns the same object). */
export const polygonWatercolorParent = (recipe: PolygonWatercolorComposition): PlanarDomain =>
  washParentDomain(recipe.parent, recipe.placement, recipe.seed);

/** The producers' result for a recipe: every pass of every region. */
export const polygonWatercolorPasses = (recipe: PolygonWatercolorComposition, run?: { check(): void }): WashPasses =>
  washPasses(polygonWatercolorParent(recipe), recipe.wash, run);

/** Palette colour index of a pass under the recipe's pigment rule. */
export function washTone(ink: WashInk, palette: readonly number[], seed: number, pass: WashPass): number {
  if (ink.pigment === "one") return 0;
  if (ink.pigment === "two") return componentSeed(seed, `pass:${pass.index}`, "pigment") / U32 < ink.mix ? 1 : 0;
  return componentSeed(seed, pass.region, "pigment") % palette.length;
}

/** The stock painter: keyholed fill at the ink opacity, then a darker boundary line. */
export function washPainter(ink: WashInk, palette: readonly number[], seed: number): WashPainter {
  if (palette.length === 0) throw new Error("Composition palette must have at least one color");
  return (surface, pass, run) => {
    if (pass.domain.regions.length === 0) return;
    const rgb = palette[washTone(ink, palette, seed, pass) % palette.length] >>> 0, r = (rgb >>> 16) & 255, g = (rgb >>> 8) & 255, b = rgb & 255;
    run.enter(1);
    try {
      surface.push();
      if (ink.opacity > 0) {
        surface.noStroke();
        surface.fill(r, g, b, ink.opacity * 255);
        for (const ring of pass.fills) {
          surface.beginShape();
          for (const [x, y] of ring) surface.vertex(x, y);
          surface.endShape(surface.CLOSE);
        }
      }
      if (ink.edge > 0 && ink.edgeWeight > 0) {
        surface.noFill();
        surface.stroke(r * 0.65, g * 0.65, b * 0.65, ink.edge * 255);
        surface.strokeWeight(ink.edgeWeight);
        for (const edge of pass.edges) {
          surface.beginShape();
          for (const [x, y] of edge.points) surface.vertex(x, y);
          if (edge.closed) surface.endShape(surface.CLOSE); else surface.endShape();
        }
      }
    } finally { surface.pop(); run.leave(); }
  };
}

/** Draw the recipe into a caller-owned surface: passes in order, each filled and edged. */
export function drawPolygonWatercolor(surface: CompositionSurface, recipe: PolygonWatercolorComposition, consumers: PolygonWatercolorConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 100_000 })): void {
  run.check();
  const passes = polygonWatercolorPasses(recipe, run);
  const paint = consumers.pass ?? washPainter(recipe.ink, recipe.palette, recipe.seed);
  for (const pass of passes.passes) paint(surface, pass, run);
}

/** Build the parent and every pass, yielding to the host between slices; false if cancelled. */
export async function preparePolygonWatercolor(recipe: PolygonWatercolorComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  return prepareWashPasses(polygonWatercolorParent(recipe), recipe.wash, cancelled);
}
