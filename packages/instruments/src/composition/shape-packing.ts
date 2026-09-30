import { shapePackingDefinition } from "../adapters/shape-packing-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { atEach, componentSeed, createCompositionRun } from "./core.js";
import { hatchDomain } from "./domains-paths.js";
import { keyholeRing } from "./domains.js";
import type { PlanarDomain, PlanarRegion } from "./domains.js";
import { PACK_LIMITS, packNegativeSpace, packShapes } from "./shape-packing-layout.js";
import type { PackedInstance, PackRules, ShapePacking } from "./shape-packing-layout.js";
import { CONTAINER_LETTERS, LETTER_SETS, PIECE_FAMILIES, packContainer, packItems } from "./shape-pieces.js";
import type { ContainerKind, LetterSet, PackContainerSpec, PackItem, PieceFamily } from "./shape-pieces.js";
import type { CompositionRun, CompositionSurface, Point, Site } from "./types.js";

/**
 * Non-convex shape packing as a typed composition (brief 47).
 *
 * Pipeline, each stage a pure, cached, frozen producer:
 * `packContainer` (a planar domain: rectangle, ellipse, ring, a letter's ink, a leaf) + `packItems` (a population
 * of non-convex pieces from bundled families, or caller shapes via `customItem`) -> `packShapes` (the placement
 * rule of shape-packing-layout.ts: rotation search, raster no-fit candidates, exact overlap/containment checks,
 * a minimum gap) -> `ShapePacking` (transforms, placed regions, footprints, unplaced items, coverage)
 * -> `packedSites` (a `Site` per placed piece for `atEach` consumers) and `packNegativeSpace` (the container minus
 * the pieces as a domain) -> the stock drawing (fill, outline, both, or hatch, colored by a chosen key).
 *
 * Inputs. The persisted instrument stores its technique id, scalar controls and palette: the piece family, container,
 * sizes and rules are selected from BUNDLED, deterministic sets (letters from the licensed outline font, generated leaves,
 * blobs and polygons; a container chosen from named shapes). A host-supplied silhouette or container binds through future
 * host work; the direct API already accepts any valid planar shape (`customItem`, `packShapes(container, ...)`).
 *
 * Outputs. `shapePackingLayout(recipe)` returns the `ShapePacking`; every published value is frozen. Instance ids are
 * the item ids `p<index>`, stable for the same (seed, family, letter set, size range, skew) whatever the count, palette,
 * colouring, rendering or footprint; placements are a global solve, so changing a rule or the count may move pieces
 * (documented, not promised otherwise).
 *
 * Seeds. Chance is in the population only: which shape and which size each item gets, from
 * `componentSeed(seed, "p<index>", <purpose>)`. Placement is deterministic; `order: "shuffled"` also draws
 * `componentSeed(seed, id, "order")`.
 *
 * Failure and bounds (nothing is truncated; each message names the control to change): at most 600 pieces, 24 angles,
 * search resolution 320, 8 retries, 60,000,000 raster search steps (lower Pieces, Rotations, Retries or Search resolution),
 * and 150,000 hatch strokes. Not fitting every piece is a result (`unplaced`), never an error.
 *
 * Units. Canvas units of the 640-unit reference canvas; angles in degrees in controls, radians in outputs.
 */

export const SHAPE_PACKING_LIMITS = Object.freeze({ ...PACK_LIMITS, hatchStrokes: 150_000, pieces: 600 });

export type PackColorBy = "size" | "order" | "angle" | "family";
export type PackRender = "fill" | "outline" | "fillOutline" | "hatch" | "mixed";

export interface ShapePackingLook {
  readonly render: PackRender;
  readonly colorBy: PackColorBy;
  /** Stroke weight of outlines, hatch lines, the leftover outline and the container outline. */
  readonly weight: number;
  readonly hatchSpacing: number;
  /** Degrees. */
  readonly hatchAngle: number;
  /** Rotate the hatch with each piece and anchor it to the piece. */
  readonly hatchFollow: boolean;
  readonly leftover: "none" | "fill" | "outline";
  readonly frame: boolean;
}

export interface ShapePackingRecipe {
  readonly kind: "shape-packing";
  readonly seed: number;
  readonly palette: readonly number[];
  readonly container: PackContainerSpec;
  readonly pieces: {
    readonly family: PieceFamily; readonly letters: LetterSet; readonly count: number;
    readonly sizeMax: number; readonly sizeMin: number; readonly skew: number;
  };
  readonly rules: PackRules;
  readonly look: ShapePackingLook;
}

/** A placed piece as a `Site`: origin at the piece's centroid, `scale` = ±size (negative = mirrored), draw the normal-form shape. */
export interface PackSite extends Site {
  readonly instance: PackedInstance;
  readonly size: number;
}

export interface ShapePackingConsumers {
  /** Replace the stock rendering of every piece. Called through `atEach` in the piece's local frame (x mirrored when negative scale); the piece's normal-form shape is `site.instance.item.shape.domain`. */
  piece?: (surface: CompositionSurface, site: PackSite, run: CompositionRun) => void;
  /** Replace the stock rendering of the leftover negative space; receives the domain in canvas coordinates. */
  leftover?: (surface: CompositionSurface, negative: PlanarDomain, run: CompositionRun) => void;
}

// ------------------------------------------------------------------------------------------------ producers

/** The layout of a recipe: cached by construction (container, population, rules, seed); look and palette never rebuild it. */
export function shapePackingLayout(recipe: ShapePackingRecipe, run?: { check(): void }): ShapePacking {
  checkConstruction(recipe);
  const container = packContainer(recipe.container);
  const p = recipe.pieces;
  const items = packItems({ seed: recipe.seed, family: p.family, letters: p.letters, count: p.count, sizeMax: p.sizeMax, sizeMin: p.sizeMin, skew: p.skew });
  return packShapes(container, items, recipe.rules, recipe.seed, run);
}

const FAMILY_INDEX: Readonly<Record<string, number>> = { letter: 0, leaf: 1, blob: 2, polygon: 3, custom: 4 };

/** Palette entries used by pieces: 1..n-1 (entry 0 is the ink); a single-color palette colors everything alike. */
function toneOf(instance: PackedInstance, packing: ShapePacking, colorBy: PackColorBy, tones: number, range: readonly [number, number]): number {
  if (tones <= 1) return 0;
  let index: number;
  if (colorBy === "order") index = instance.rank;
  else if (colorBy === "family") index = FAMILY_INDEX[instance.item.shape.family];
  else if (colorBy === "angle") index = Math.round(instance.angle / (2 * Math.PI) * packing.rules.rotations);
  else index = range[1] > range[0] ? Math.min(tones - 1, Math.floor((instance.size - range[0]) / (range[1] - range[0]) * tones)) : 0;
  return index % tones;
}

/** One site per placed piece in placement order; `tone` is the palette index the stock rendering uses. */
export function packedSites(packing: ShapePacking, recipe: Pick<ShapePackingRecipe, "seed" | "palette" | "look">): readonly PackSite[] {
  const tones = Math.max(1, recipe.palette.length - 1);
  let lo = Infinity, hi = -Infinity;
  for (const instance of packing.instances) { lo = Math.min(lo, instance.size); hi = Math.max(hi, instance.size); }
  return Object.freeze(packing.instances.map((instance): PackSite => Object.freeze({
    id: instance.id, seed: componentSeed(recipe.seed, instance.id, "site"), position: instance.position, angle: instance.angle,
    scale: instance.mirrored ? -instance.size : instance.size,
    tone: recipe.palette.length > 1 ? 1 + toneOf(instance, packing, recipe.look.colorBy, tones, [lo, hi]) : 0, instance, size: instance.size,
  })));
}

// ------------------------------------------------------------------------------------------------ drawing

const channels = (rgb: number): [number, number, number] => [(rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255];

function fillRegion(surface: CompositionSurface, region: PlanarRegion): void {
  surface.beginShape();
  for (const [x, y] of keyholeRing(region)) surface.vertex(x, y);
  surface.endShape(surface.CLOSE);
}
function strokeRings(surface: CompositionSurface, region: PlanarRegion): void {
  for (const ring of [region.outer, ...region.holes]) {
    surface.beginShape();
    for (const [x, y] of ring) surface.vertex(x, y);
    surface.endShape(surface.CLOSE);
  }
}

/** `mixed` draws piece tone 0 filled, tone 1 hatched, tone 2 outlined, then repeats. */
const MIXED: readonly Exclude<PackRender, "mixed">[] = ["fill", "hatch", "outline"];

/** The stock look of one placed piece; `tone` is its palette index (0 for the ink when the palette has one color). */
function paintPiece(surface: CompositionSurface, instance: PackedInstance, tone: number, palette: readonly number[], look: ShapePackingLook, run: CompositionRun): void {
  const [r, g, b] = channels(palette[tone]), [ir, ig, ib] = channels(palette[0]);
  const render = look.render === "mixed" ? MIXED[Math.max(0, tone - 1) % MIXED.length] : look.render;
  if (render === "fill" || render === "fillOutline") {
    surface.noStroke(); surface.fill(r, g, b, 255);
    for (const region of instance.region.regions) fillRegion(surface, region);
  }
  if (render === "outline" || render === "fillOutline") {
    surface.noFill(); surface.stroke(...(render === "outline" ? [r, g, b, 255] : [ir, ig, ib, 255])); surface.strokeWeight(look.weight);
    for (const region of instance.region.regions) strokeRings(surface, region);
  }
  if (render === "hatch") {
    const turn = look.hatchFollow ? instance.angle * 180 / Math.PI : 0;
    surface.noFill(); surface.stroke(r, g, b, 255); surface.strokeWeight(look.weight);
    for (const stroke of hatchDomain(instance.region, { spacing: look.hatchSpacing, angle: look.hatchAngle + turn,
      ...(look.hatchFollow ? { origin: instance.position as readonly [number, number] } : {}) })) {
      run.check();
      surface.line(stroke.points[0][0], stroke.points[0][1], stroke.points[1][0], stroke.points[1][1]);
    }
  }
}

function checkHatchWork(packing: ShapePacking, look: ShapePackingLook): void {
  if (look.render !== "hatch" && look.render !== "mixed") return;
  let lines = 0;
  for (const instance of packing.instances) for (const region of instance.region.regions) {
    const [l, t, r, b] = region.bounds;
    lines += Math.ceil(Math.hypot(r - l, b - t) / look.hatchSpacing) + 1;
  }
  if (lines > SHAPE_PACKING_LIMITS.hatchStrokes)
    throw new Error(`Hatching the pieces would need up to ${lines} lines; the limit is ${SHAPE_PACKING_LIMITS.hatchStrokes}: raise Hatch spacing or lower Pieces`);
}

/**
 * Draw into a caller-owned surface, transparent and inside the container: the leftover negative space, the pieces
 * (stock look or a `piece` consumer), then the container outline. Nothing clears the canvas.
 */
export function drawShapePacking(surface: CompositionSurface, recipe: ShapePackingRecipe, consumers: ShapePackingConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 2_000_000 })): void {
  run.check();
  checkAppearance(recipe);
  const packing = shapePackingLayout(recipe, run);
  const ink = recipe.palette[0];
  if (!consumers.piece) checkHatchWork(packing, recipe.look);
  surface.push();
  try {
    if (recipe.look.leftover !== "none" || consumers.leftover) {
      const negative = packNegativeSpace(packing, { run });
      if (consumers.leftover) consumers.leftover(surface, negative, run);
      else if (recipe.look.leftover === "fill") {
        const [r, g, b] = channels(ink);
        surface.noStroke(); surface.fill(r, g, b, 56);
        for (const region of negative.regions) fillRegion(surface, region);
      } else {
        const [r, g, b] = channels(ink);
        surface.noFill(); surface.stroke(r, g, b, 255); surface.strokeWeight(recipe.look.weight);
        for (const region of negative.regions) strokeRings(surface, region);
      }
    }
    const sites = packedSites(packing, recipe);
    if (consumers.piece) atEach(surface, sites, consumers.piece, run);
    else {
      const by = new Map(packing.instances.map((i) => [i.id, i] as const));
      for (const site of sites) {
        run.check();
        surface.push();
        try { paintPiece(surface, by.get(site.id)!, site.tone!, recipe.palette, recipe.look, run); } finally { surface.pop(); }
      }
    }
    if (recipe.look.frame) {
      const container = packContainer(recipe.container), [r, g, b] = channels(ink);
      surface.noFill(); surface.stroke(r, g, b, 255); surface.strokeWeight(recipe.look.weight);
      for (const region of container.regions) strokeRings(surface, region);
    }
  } finally { surface.pop(); }
}

/** Solve the layout (and the leftover, if drawn) and bound-check the drawing, yielding once; false if cancelled. */
export async function prepareShapePacking(recipe: ShapePackingRecipe, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  checkAppearance(recipe);
  const run = createCompositionRun({ cancelled });
  let packing: ShapePacking;
  try { packing = shapePackingLayout(recipe, run); }
  catch (error) { if (cancelled()) return false; throw error; }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  if (cancelled()) return false;
  checkHatchWork(packing, recipe.look);
  if (recipe.look.leftover !== "none") {
    try { packNegativeSpace(packing, { run }); }
    catch (error) { if (cancelled()) return false; throw error; }
  }
  return !cancelled();
}

// ------------------------------------------------------------------------------------------------ checks

function checkConstruction(recipe: ShapePackingRecipe): void {
  if (recipe?.kind !== "shape-packing") throw new Error("Not a shape-packing recipe");
  const p = recipe.pieces;
  if (!PIECE_FAMILIES.includes(p.family)) throw new Error("Piece family is not available");
  if (!(p.letters in LETTER_SETS)) throw new Error("Letters must be upper, lower, digits or mixed");
  if (!Number.isSafeInteger(p.count) || p.count < 1 || p.count > SHAPE_PACKING_LIMITS.pieces) throw new Error(`Pieces must be an integer in [1, ${SHAPE_PACKING_LIMITS.pieces}]`);
  if (!(p.sizeMin > 0) || !(p.sizeMax >= p.sizeMin)) throw new Error("Smallest piece must be > 0 and at most Largest piece");
  if (!(p.skew > 0)) throw new Error("Small-piece bias must be > 0");
}
function checkAppearance(recipe: ShapePackingRecipe): void {
  if (!Array.isArray(recipe.palette) || recipe.palette.length === 0) throw new Error("Shape packing needs at least one palette color");
  const l = recipe.look;
  if (!["fill", "outline", "fillOutline", "hatch", "mixed"].includes(l.render)) throw new Error("Draw must be fill, outline, fillOutline, hatch or mixed");
  if (!["size", "order", "angle", "family"].includes(l.colorBy)) throw new Error("Color by must be size, order, angle or family");
  if (!(l.weight > 0) || !(l.hatchSpacing > 0)) throw new Error("Line weight and Hatch spacing must be > 0");
}

// ------------------------------------------------------------------------------------------------ named-instrument binding

type Scalar = number | string | boolean;

/**
 * Resolve the stored scalar controls to the public recipe. Controls that do not apply to the current choices never
 * reach the recipe, so hidden controls cannot change the drawing.
 */
export function shapePackingComposition(input: InstrumentInput): ShapePackingRecipe {
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((rgb) => !Number.isSafeInteger(rgb) || rgb < 0 || rgb > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(shapePackingDefinition, input.params) as Record<string, Scalar>;
  const family = q.family as PieceFamily, kind = q.container as ContainerKind;
  const hasLetters = family === "letters" || family === "mixed", hasHoles = family === "letters" || family === "polygons" || family === "mixed";
  const hatch = q.render === "hatch" || q.render === "mixed", rule = q.rule as PackRules["rule"];
  return {
    kind: "shape-packing", seed: input.seed, palette: [...input.palette],
    container: { kind, centerX: q.centerX as number, centerY: q.centerY as number, width: q.width as number, height: q.height as number, angle: q.angle as number,
      ...(kind === "ring" ? { hole: q.hole as number } : {}), ...(kind === "letter" ? { letter: q.letter as string } : {}) },
    pieces: { family, letters: hasLetters ? q.letters as LetterSet : "upper", count: q.count as number, sizeMax: q.sizeMax as number, sizeMin: q.sizeMin as number, skew: q.skew as number },
    rules: {
      order: q.order as PackRules["order"], rule, settleAngle: rule === "settle" ? q.settleAngle as number : 0,
      rotations: q.rotations as number, mirror: q.mirror as boolean, gap: q.gap as number, margin: q.margin as number,
      counters: hasHoles ? q.counters as PackRules["counters"] : "open", resolution: q.resolution as number,
      retries: q.retries as number, shrink: q.shrink as number, stop: q.stop === "coverage" ? q.coverage as number : null,
    },
    look: {
      render: q.render as PackRender, colorBy: q.colorBy as PackColorBy, weight: q.weight as number,
      hatchSpacing: hatch ? q.hatchSpacing as number : 4, hatchAngle: hatch ? q.hatchAngle as number : 0, hatchFollow: hatch ? q.hatchFollow as boolean : false,
      leftover: q.leftover as ShapePackingLook["leftover"], frame: q.frame as boolean,
    },
  };
}

/** The seed always matters: it chooses every piece's shape and size (and, for a shuffled order, the order). */
export function shapePackingUsesSeed(_q: InstrumentInput["params"]): boolean {
  return true;
}

