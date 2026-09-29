import { atEach, createCompositionRun, inside, strokeWith } from "./core.js";
import { color, pathMaterial } from "./materials.js";
import { moduleLined, moduleOutline, moduleScreen, moduleType, typeAnchor, typeContent, typeField, typeRhythmLayout,
  MAX_TYPE_VERTICES } from "./type-rhythm.js";
import type { TypeFieldOptions, TypeLayoutOptions, TypeScreenSpec } from "./type-rhythm.js";
import { fillRings } from "./type-text.js";
import type { TextSource } from "./type-text.js";
import type { CompositionRun, CompositionSurface, PathMaterial, RegionFiller, Site } from "./types.js";

/**
 * Consumers and the named descriptor for typographic rhythm.
 *
 * Drawing walks the non-blank modules with the existing `inside` consumer, so every module's
 * geometry is already in its clip rectangle's local frame and stays inside [0,w]×[0,h]:
 *   flat    one rectangle of its tone;
 *   screen  its clipped grating lines through the stock ink `pathMaterial` inside `strokeWith`;
 *   text    `solid`: the clipped glyph rings as one nonzero fill; `outline`: the glyph outlines
 *           clipped as polylines; `lined`: the module's screen lines clipped to the glyph interiors.
 * Then the anchor is drawn once through `atEach`, unclipped and unstretched. Colours are palette
 * entries chosen by module `tone`, so colour marks structure, never a random hue. Strokes are
 * clipped as centre lines; a stroke of weight w reaches w/2 past the clip edge (round caps).
 * Nothing is drawn behind the modules: the layer is transparent and blank modules leave paper.
 *
 * Each `inside` callback and each `strokeWith` path is charged to the shared composition run
 * (default 100,000 units); a solid fill is one callback. Producers own the geometric bounds.
 */
export interface TypeInk {
  style: "solid" | "outline" | "lined";
  /** Stroke weight of outline and lined type. */
  weight: number;
}
export interface TypeScreenInk extends TypeScreenSpec {
  weight: number;
}

/** Named, JSON-compatible descriptor: the text is a resolved `TextSource` value, never a URL. */
export interface TypeRhythmComposition {
  layout: TypeLayoutOptions;
  text: TextSource;
  field: TypeFieldOptions;
  ink: TypeInk;
  screen: TypeScreenInk;
  palette: readonly number[];
}

const noMark = { kind: "dot" as const, size: 0, petals: 1, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 };
function stroke(weight: number, palette: readonly number[]): PathMaterial {
  return pathMaterial({ kind: "ink", weight, spacing: 8, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark: noMark }, palette);
}

/** Draw a descriptor into a host surface; no clearing, transparent layer. */
export function drawTypeRhythm(surface: CompositionSurface, recipe: TypeRhythmComposition, run: CompositionRun = createCompositionRun()): void {
  run.check();
  const { palette } = recipe;
  const layout = typeRhythmLayout(recipe.layout), field = typeField(recipe.text, recipe.field);
  const modules = new Map(layout.modules.map((module) => [module.id, module]));
  const types = new Map(typeContent(layout, field).modules.map((type) => [type.id, type]));
  const inkStroke = stroke(recipe.ink.weight, palette), screenStroke = stroke(recipe.screen.weight, palette);
  const filler: RegionFiller = (s, region, r) => {
    const module = modules.get(region.id)!;
    if (module.kind === "flat") {
      s.noStroke(); color(s, palette, module.tone, 255, true);
      s.rect(0, 0, region.bounds[2] - region.bounds[0], region.bounds[3] - region.bounds[1]);
    } else if (module.kind === "screen") {
      strokeWith(s, moduleScreen(module, recipe.screen), screenStroke, r);
    } else {
      const type = types.get(module.id)!;
      if (recipe.ink.style === "solid") { s.noStroke(); color(s, palette, module.tone, 255, true); fillRings(s, type.fill); }
      else if (recipe.ink.style === "outline") strokeWith(s, moduleOutline(module, type), inkStroke, r);
      else strokeWith(s, moduleLined(module, type, recipe.screen), inkStroke, r);
    }
  };
  inside(surface, layout.modules.filter((module) => module.kind !== "blank").map((module) => module.clip), filler, run);
  const anchor = typeAnchor(layout, recipe.text, recipe.layout.seed);
  if (anchor) atEach(surface, [anchor.site as Site], (s) => {
    s.noStroke(); color(s, palette, 0, 255, true);
    s.translate(-anchor.center[0], -anchor.center[1]);
    fillRings(s, anchor.rings);
  }, run);
}

/** Warm every cache the drawing will use, yielding between modules; false when cancelled. */
export async function prepareTypeRhythm(recipe: TypeRhythmComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const layout = typeRhythmLayout(recipe.layout), field = typeField(recipe.text, recipe.field);
  let vertices = 0, sliceStart = performance.now();
  for (let index = 0; index < layout.modules.length; index++) {
    if (cancelled()) return false;
    const module = layout.modules[index];
    if (module.kind === "screen") moduleScreen(module, recipe.screen);
    else if (module.kind === "text") {
      const type = moduleType(layout, field, module);
      vertices += type.vertices;
      if (vertices > MAX_TYPE_VERTICES) throw new Error(`Type needs more than ${MAX_TYPE_VERTICES} vertices across modules. Increase the type size or use fewer modules`);
      if (recipe.ink.style === "outline") moduleOutline(module, type);
      else if (recipe.ink.style === "lined") moduleLined(module, type, recipe.screen);
    }
    // Yield only after a slice of real work, so a warm cache costs nothing.
    if (performance.now() - sliceStart > 8) { await new Promise<void>((resolve) => setTimeout(resolve, 0)); sliceStart = performance.now(); }
  }
  if (cancelled()) return false;
  typeContent(layout, field);
  return !cancelled();
}
