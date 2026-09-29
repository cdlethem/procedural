import { glyphPackingDefinition } from "../adapters/glyph-packing-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { atEach, createCompositionRun } from "./core.js";
import { bundledContainerIds, negativeSpace, packingField, placeContainer } from "./glyph-containers.js";
import type { BundledContainerId, ContainerPlacement, NegativeKind, PackingField } from "./glyph-containers.js";
import { packGlyphs } from "./glyph-pack.js";
import type { GlyphInstance, GlyphPacking, Orientation, OrientationRule } from "./glyph-pack.js";
import { bundledVocabulary, bundledVocabularyIds } from "./glyph-sources.js";
import type { BundledVocabularyId, CounterPolicy, GlyphVocabulary } from "./glyph-sources.js";
import { keyholeRing } from "./domains.js";
import { color } from "./materials.js";
import type { CompositionRun, CompositionSurface } from "./types.js";

/**
 * Glyph Packing as a typed, JSON-compatible composition and its consumers.
 *
 * PRODUCERS (cached, frozen, appearance-independent; see `glyph-pack.ts` for the algorithm):
 *   container  `placeContainer(silhouette, placement)`: the bundled silhouette as a planar domain (holes kept)
 *   field      `packingField(container, negativeSpace(...), margin)`: container − protected region, inset by the margin
 *   packing    `packGlyphs(field, options)`: instances with ids `d<j>`, the unplaced set and the rejection statistics
 *   `glyphPackingProducts(recipe)` runs all three; palette, ink style, colour rule and how the container is shown are not inputs.
 *
 * CONSUMERS. A `GlyphMark` is an ordinary callback `(surface, instance, run)`: `atEach` has translated to the instance's position,
 * turned by its angle and scaled by its `scale` (canvas units per glyph unit), so the callback draws the glyph in glyph units, y down, origin at
 * the middle of its ink box; `instance.glyph` carries the outlines, so a custom mark can draw anything (a stock `motif`, for instance, sized in
 * glyph units). `glyphFill` fills the instance's keyholed polygons, `glyphOutline` strokes every ring `weight` canvas units wide whatever the
 * glyph's scale. Order: the container (nothing, an outline or a wash), then the glyphs from largest to smallest. Colours are palette entries
 * chosen from structure (size tier, vocabulary rank, word or symbol), never per-glyph random. The layer is transparent.
 *
 * WORK. Producers bound their own work (`GLYPH_PACKING_LIMITS`); drawing charges one run unit per instance (default 100,000).
 */
export type GlyphColorBy = "ink" | "size" | "rank" | "kind";
export type ContainerShown = "none" | "outline" | "wash";

export interface GlyphPackingComposition {
  kind: "glyph-packing";
  seed: number;
  palette: readonly number[];
  container: { silhouette: BundledContainerId; placement: ContainerPlacement };
  negative: { kind: NegativeKind; size: number; x: number; y: number };
  /** Canvas units kept between a glyph and the container's boundary, holes and negative space. */
  margin: number;
  vocabulary: GlyphVocabulary;
  pack: {
    coverage: number; largest: number; smallest: number; falloff: number; gap: number; counters: CounterPolicy;
    hierarchy: number; retries: number; orientation: Orientation;
  };
  ink: { style: "fill" | "outline"; weight: number; colorBy: GlyphColorBy; container: ContainerShown };
}

/** A glyph drawing callback: see the module comment for its frame. */
export type GlyphMark = (surface: CompositionSurface, instance: GlyphInstance, run: CompositionRun) => void;
export interface GlyphPackingConsumers { glyph?: GlyphMark }

export interface GlyphPackingProducts {
  readonly field: PackingField;
  readonly packing: GlyphPacking;
}

type Scalar = number | string | boolean;

/** Resolve stored scalar controls to the public composition value. */
export function glyphPackingComposition(input: InstrumentInput): GlyphPackingComposition {
  if (input.technique !== glyphPackingDefinition.id) throw new Error(`Not a ${glyphPackingDefinition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((rgb) =>
    !Number.isSafeInteger(rgb) || rgb < 0 || rgb > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(glyphPackingDefinition, input.params) as Record<string, Scalar>;
  const silhouette = q.container as BundledContainerId;
  if (!(bundledContainerIds as readonly string[]).includes(silhouette)) throw new Error(`Unknown container: ${String(q.container)}`);
  if (!(bundledVocabularyIds as readonly string[]).includes(q.vocabulary as string)) throw new Error(`Unknown vocabulary: ${String(q.vocabulary)}`);
  const largest = q.largest as number;
  return {
    kind: "glyph-packing", seed: input.seed, palette: [...input.palette],
    container: { silhouette, placement: { centerX: q.centerX as number, centerY: q.centerY as number, width: q.width as number, height: q.height as number, rotation: q.rotation as number } },
    negative: { kind: q.negative as NegativeKind, size: q.negativeSize as number, x: q.negativeX as number, y: q.negativeY as number },
    margin: q.margin as number,
    vocabulary: bundledVocabulary(q.vocabulary as BundledVocabularyId),
    pack: {
      coverage: q.coverage as number, largest, smallest: Math.min(q.smallest as number, largest), falloff: q.falloff as number, gap: q.gap as number,
      counters: q.counters as CounterPolicy, hierarchy: q.hierarchy as number, retries: q.retries as number,
      orientation: { rule: q.orientation as OrientationRule, angle: q.angle as number, spread: q.spread as number, upright: q.upright as boolean },
    },
    ink: { style: q.style as "fill" | "outline", weight: q.weight as number, colorBy: q.colorBy as GlyphColorBy, container: q.showContainer as ContainerShown },
  };
}

/** Producer results: cached values the consumers read. Palette, ink and colour choices are not inputs; `check` may cancel. */
export function glyphPackingProducts(recipe: GlyphPackingComposition, check?: () => void): GlyphPackingProducts {
  const container = placeContainer(recipe.container.silhouette, recipe.container.placement);
  const negative = negativeSpace(recipe.negative, recipe.container.placement);
  const field = packingField(container, negative, recipe.margin);
  const packing = packGlyphs(field, { seed: recipe.seed, vocabulary: recipe.vocabulary, ...recipe.pack, ...(check ? { check } : {}) });
  return Object.freeze({ field, packing });
}

/** Palette index of an instance under a colour rule; only structure decides it. */
export function glyphTone(instance: GlyphInstance, colorBy: GlyphColorBy): number {
  if (colorBy === "size") return instance.tier;
  if (colorBy === "rank") return instance.rank;
  if (colorBy === "kind") return instance.glyph.kind === "word" ? 0 : 1;
  return 0;
}

/** Solid glyphs: the keyholed polygons, one shape each. */
export function glyphFill(palette: readonly number[], colorBy: GlyphColorBy): GlyphMark {
  return (surface, instance) => {
    surface.noStroke();
    color(surface, palette, glyphTone(instance, colorBy), 255, true);
    for (const polygon of instance.glyph.fill) {
      surface.beginShape();
      for (const [x, y] of polygon) surface.vertex(x, y);
      surface.endShape(surface.CLOSE);
    }
  };
}

/** Outlined glyphs: every ring stroked closed, `weight` canvas units wide whatever the glyph's scale. */
export function glyphOutline(palette: readonly number[], colorBy: GlyphColorBy, weight: number): GlyphMark {
  return (surface, instance) => {
    surface.noFill();
    color(surface, palette, glyphTone(instance, colorBy), 255, false);
    surface.strokeWeight(weight / instance.scale);
    for (const ring of instance.glyph.ink) {
      surface.beginShape();
      for (const [x, y] of ring) surface.vertex(x, y);
      surface.endShape(surface.CLOSE);
    }
  };
}

function drawContainer(surface: CompositionSurface, field: PackingField, shown: ContainerShown, palette: readonly number[]): void {
  if (shown === "none") return;
  surface.push();
  if (shown === "wash") {
    surface.noStroke();
    color(surface, palette, 3, 70, true);
    for (const region of field.container.regions) {
      surface.beginShape();
      for (const [x, y] of keyholeRing(region)) surface.vertex(x, y);
      surface.endShape(surface.CLOSE);
    }
  } else {
    surface.noFill();
    color(surface, palette, 0, 200, false);
    surface.strokeWeight(1);
    for (const region of field.container.regions) for (const ring of [region.outer, ...region.holes]) {
      surface.beginShape();
      for (const [x, y] of ring) surface.vertex(x, y);
      surface.endShape(surface.CLOSE);
    }
  }
  surface.pop();
}

/** Draw the recipe into a caller-owned surface: the container, then the glyphs. */
export function drawGlyphPacking(surface: CompositionSurface, recipe: GlyphPackingComposition,
  consumers: GlyphPackingConsumers = {}, run: CompositionRun = createCompositionRun()): void {
  run.check();
  const { field, packing } = glyphPackingProducts(recipe);
  drawContainer(surface, field, recipe.ink.container, recipe.palette);
  const mark = consumers.glyph ?? (recipe.ink.style === "fill" ? glyphFill(recipe.palette, recipe.ink.colorBy)
    : glyphOutline(recipe.palette, recipe.ink.colorBy, recipe.ink.weight));
  atEach(surface, packing.instances, mark, run);
}

/** Warm the producers; false when cancelled. The packing checks `cancelled` while it works. */
export async function prepareGlyphPacking(recipe: GlyphPackingComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  await Promise.resolve();
  try {
    glyphPackingProducts(recipe, () => { if (cancelled()) throw CANCEL; });
  } catch (error) {
    if (error === CANCEL) return false;
    throw error;
  }
  return !cancelled();
}
const CANCEL = new Error("Glyph packing cancelled");
