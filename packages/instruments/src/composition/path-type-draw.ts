import { pathTypographyDefinition } from "../adapters/path-typography-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { prepareBranchTree } from "./branch-tree.js";
import { atEach, createCompositionRun, strokeWith } from "./core.js";
import { color, pathMaterial } from "./materials.js";
import { disruptFrames, layoutPaths, readableSpans } from "./path-type.js";
import type { Crowding, CurvaturePolicy, PathFrame, PathLayout, PathsLayoutOptions, ReadingDirection, RepeatPolicy } from "./path-type.js";
import { bundledBranchTree, gestureNaturalExtent, supplyPaths } from "./path-type-supply.js";
import type { PathSelection, PathSupply } from "./path-type-supply.js";
import { memoized } from "./sources.js";
import { bundledRecordingInfo } from "./recording-samples.js";
import type { BundledRecordingId } from "./recording-samples.js";
import { bundledPathTexts, shapeRun } from "./type-glyphs.js";
import type { GlyphItem, GlyphRun, PathText, ShapeOptions } from "./type-glyphs.js";
import { CAP_HEIGHT } from "./type-text.js";
import type { CompositionRun, CompositionSurface, Path, PathMaterial } from "./types.js";

/**
 * Path Typography as a typed, JSON-compatible composition and its consumers.
 *
 * PRODUCERS (all cached, frozen, appearance-independent):
 *   supply   `supplyPaths` (contour, branch lineage or gesture stroke; `path-type-supply.ts`)
 *   shaping  `shapeRun(text, {kerning, tracking})`: glyph advances and outlines (`type-glyphs.ts`)
 *   layout   `layoutAlongPath(path, run.items, options)`: frames with ids `<path id>/r<repeat>/g<index>`
 *            (`path-type.ts`); `disruptFrames` moves them afterwards
 *   `pathTypographyProducts(recipe)` runs all four and returns every value a consumer reads.
 *
 * CONSUMERS. The glyph consumer is a `GlyphMark`, an ordinary callback `(surface, frame, run)`:
 * `atEach` has already translated to the frame, turned by its angle and scaled by its `scale` (canvas
 * units per font unit), so the callback draws the glyph in font units with its origin on the
 * baseline at the middle of its advance, y down; the frame's `condense` (compress policy) narrows
 * it horizontally and is applied to the points, not to the surface, so stroke widths stay round.
 * `glyphFill` fills the frame's keyholed polygons, `glyphOutline` strokes its rings. Either is
 * replaceable per call (`consumers.glyph`), and `frame.item` carries the glyph, so a custom mark can
 * draw anything. The guide stroke (the supplied path or the offset baselines) is a `PathMaterial`.
 * Drawing order: guide, then letters. Colours are palette entries chosen from structure by
 * `glyphTone`, never per-glyph random. The layer is transparent; nothing paints the canvas.
 *
 * WORK. Producers bound their own geometry; the drawing charges one run unit per guide path and per
 * letter (default 100,000). At most `MAX_TYPE_FRAMES` letters are drawn per composition; more
 * throws naming the controls that raise the count.
 */
export const MAX_TYPE_FRAMES = 20_000;
/** A letter whose chord is shorter than this share of its arc length is dropped, whatever the curve policy (about 130° of turn on a circle). */
export const MIN_STRAIGHTNESS = 0.8;
/** Arc length between the vertices of a gesture supply, canvas units. */
export const GESTURE_SPACING = 3;
/** Shortest run, in cap heights, that upright reading treats as an arm of its own (see `readableSpans`). */
export const SPAN_CAPS = 5;

export type ColorBy = "ink" | "repeat" | "word" | "adapted";
export interface PathTypographyComposition {
  kind: "path-typography";
  seed: number;
  palette: readonly number[];
  supply: PathSupply;
  selection: PathSelection;
  text: PathText;
  shape: ShapeOptions;
  /** Cap height, canvas units. */
  size: number;
  layout: {
    /** Fraction of each path's length at which the text begins, in the reading direction. */
    start: number;
    direction: ReadingDirection;
    /** Canvas units toward the reader's up. */
    baseline: number;
    /** Cap heights between repeats. */
    gap: number;
    repeat: RepeatPolicy;
    policy: CurvaturePolicy;
    crowding: Crowding;
    /** Cap heights kept clear around type already set, when crowding is avoided. */
    clearance: number;
  };
  /** Null keeps every letter on its path. Lengths in cap heights, tilt in degrees. */
  disruption: { length: number; shift: number; tilt: number; grow: number; dropout: number } | null;
  ink: { style: "fill" | "outline"; weight: number; colorBy: ColorBy };
  guide: { show: "none" | "path" | "baseline"; weight: number };
}

/** A glyph drawing callback: see the module comment for its frame. */
export type GlyphMark = (surface: CompositionSurface, frame: PathFrame<GlyphItem>, run: CompositionRun) => void;
export interface PathTypographyConsumers {
  glyph?: GlyphMark;
  guide?: PathMaterial;
}

/** Everything the consumers read. */
export interface TypographyProducts {
  readonly paths: readonly Path[];
  /** What the layouts ride: `paths`, or under upright reading their readable spans (`readableSpans`). */
  readonly spans: readonly Path[];
  /** Paths the supply has, of which `paths` are the selected ones. */
  readonly available: number;
  readonly run: GlyphRun;
  readonly layouts: readonly PathLayout<GlyphItem>[];
  /** Frames to draw per path, after disruption. */
  readonly frames: readonly (readonly PathFrame<GlyphItem>[])[];
  /** Ids of frames disruption omitted. */
  readonly omitted: readonly string[];
}

type Scalar = number | string | boolean;

/** Resolve stored scalar controls to the public composition value. */
export function pathTypographyComposition(input: InstrumentInput): PathTypographyComposition {
  if (input.technique !== pathTypographyDefinition.id) throw new Error(`Not a ${pathTypographyDefinition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((rgb) =>
    !Number.isSafeInteger(rgb) || rgb < 0 || rgb > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(pathTypographyDefinition, input.params) as Record<string, Scalar>;
  const seed = input.seed, centerX = q.centerX as number, centerY = q.centerY as number, extent = q.extent as number;
  let supply: PathSupply;
  if (q.supply === "contour") {
    supply = { kind: "contour", source: { seed, source: q.field as "noise" | "hills" | "waves" | "saddle", width: extent, height: extent, centerX, centerY,
      resolution: 60, frequency: q.field === "noise" || q.field === "waves" ? q.frequency as number : 1.6, aspect: 1.5, hillCount: 5, hillRadius: 0.23,
      levelBase: q.level as number, levelStep: q.levelStep as number, levels: q.levels as number, rotation: q.rotation as number } };
  } else if (q.supply === "branch") {
    supply = { kind: "branch", tree: bundledBranchTree({ seed, centerX, centerY, extent, attractors: q.sourceCount as number, ticks: q.ticks as number,
      branches: q.branches as number, spread: q.branchSpread as number, routing: q.routing as "grown" | "smooth" | "straight" | "octilinear" }) };
  } else {
    const recording = q.recording as BundledRecordingId;
    if (!bundledRecordingInfo[recording]) throw new Error(`Unknown bundled recording: ${String(recording)}`);
    supply = { kind: "gesture", recording, seed, smoothing: q.gestureSmoothing as number, spacing: GESTURE_SPACING,
      frame: { centerX, centerY, scale: extent / gestureNaturalExtent(recording, seed), rotation: q.rotation as number } };
  }
  const text = bundledPathTexts[q.phrase as string];
  if (!text) throw new Error(`Unknown bundled phrase: ${String(q.phrase)}`);
  return {
    kind: "path-typography", seed, palette: [...input.palette], supply,
    selection: { pick: q.pick as number, count: q.supply === "gesture" ? 1 : q.count as number, smooth: q.smooth as number },
    text, shape: { kerning: q.kerning as ShapeOptions["kerning"], tracking: q.tracking as number }, size: q.size as number,
    layout: { start: q.start as number, direction: q.direction as ReadingDirection, baseline: q.baseline as number, gap: q.gap as number,
      repeat: q.repeat as RepeatPolicy, policy: q.curves as CurvaturePolicy, crowding: q.crowding as Crowding, clearance: q.clearance as number },
    disruption: q.disruption === "off" ? null : { length: q.disruptLength as number, shift: q.disruptShift as number, tilt: q.disruptTilt as number,
      grow: q.disruptGrow as number, dropout: q.disruptDropout as number },
    ink: { style: q.style as "fill" | "outline", weight: q.weight as number, colorBy: q.colorBy as ColorBy },
    guide: { show: q.guide as "none" | "path" | "baseline", weight: q.guideWeight as number },
  };
}

/** The layout options every selected path gets; `start` stays a fraction of each path's own length. */
function layoutOptions(recipe: PathTypographyComposition): PathsLayoutOptions {
  const { layout, size } = recipe;
  return { scale: size / CAP_HEIGHT, start: layout.start, direction: layout.direction, baseline: layout.baseline,
    gap: layout.gap * size, repeat: layout.repeat, policy: layout.policy, minStraightness: MIN_STRAIGHTNESS, clearance: layout.clearance * size };
}

const productCache = new Map<string, TypographyProducts>();
/** Producer results: the cached values `drawPathTypography` consumes. Palette and ink choices are not inputs. */
export function pathTypographyProducts(recipe: PathTypographyComposition): TypographyProducts {
  const { supply, selection, text, shape, size, layout, disruption, seed } = recipe;
  return memoized(productCache, JSON.stringify([seed, supply, selection, text, shape, size, layout, disruption]), () => buildProducts(recipe));
}

function buildProducts(recipe: PathTypographyComposition): TypographyProducts {
  const { paths, available } = supplyPaths(recipe.supply, recipe.selection);
  const run = shapeRun(recipe.text, recipe.shape);
  // Upright reading cuts each path where it turns from running rightward to leftward, so no arm is upside down.
  const spans = recipe.layout.direction === "upright" ? Object.freeze(paths.flatMap((path) => readableSpans(path, SPAN_CAPS * recipe.size))) : paths;
  const layouts = layoutPaths(spans, run.items, layoutOptions(recipe), recipe.layout.crowding);
  const frames: (readonly PathFrame<GlyphItem>[])[] = [], omitted: string[] = [];
  let total = 0;
  for (const layout of layouts) {
    const moved = recipe.disruption
      ? disruptFrames(layout, { seed: recipe.seed, length: recipe.disruption.length * recipe.size, shift: recipe.disruption.shift * recipe.size,
        tilt: recipe.disruption.tilt * Math.PI / 180, grow: recipe.disruption.grow, dropout: recipe.disruption.dropout })
      : { frames: layout.frames, omitted: [] as readonly string[] };
    frames.push(moved.frames); omitted.push(...moved.omitted);
    total += moved.frames.length;
    if (total > MAX_TYPE_FRAMES)
      throw new Error(`Path type would draw more than ${MAX_TYPE_FRAMES} letters. Lower Paths lettered, set Repeat to once, or raise Type size`);
  }
  return Object.freeze({ paths, spans, available, run, layouts: Object.freeze(layouts), frames: Object.freeze(frames), omitted: Object.freeze(omitted) });
}

/** Palette index of a letter under a colour rule; only structure decides it. */
export function glyphTone(frame: PathFrame<GlyphItem>, colorBy: ColorBy): number {
  if (colorBy === "repeat") return frame.repeat;
  if (colorBy === "word") return frame.item.word;
  if (colorBy === "adapted") return frame.adapted === "none" ? 0 : frame.adapted === "compress" ? 1 : 2;
  return 0;
}

const condensed = (ring: readonly (readonly [number, number])[], factor: number, surface: CompositionSurface) => {
  for (const [x, y] of ring) surface.vertex(x * factor, y);
};

/** Solid letters: the frame's keyholed polygons, one shape each. */
export function glyphFill(palette: readonly number[], colorBy: ColorBy): GlyphMark {
  return (surface, frame) => {
    surface.noStroke();
    color(surface, palette, glyphTone(frame, colorBy), 255, true);
    for (const polygon of frame.item.fill ?? []) {
      surface.beginShape();
      condensed(polygon, frame.condense, surface);
      surface.endShape(surface.CLOSE);
    }
  };
}

/** Outlined letters: every ring stroked closed, `weight` canvas units wide whatever the letter's scale. */
export function glyphOutline(palette: readonly number[], colorBy: ColorBy, weight: number): GlyphMark {
  return (surface, frame) => {
    surface.noFill();
    color(surface, palette, glyphTone(frame, colorBy), 255, false);
    surface.strokeWeight(weight / frame.scale);
    for (const ring of frame.item.ink ?? []) {
      surface.beginShape();
      condensed(ring, frame.condense, surface);
      surface.endShape(surface.CLOSE);
    }
  };
}

const noMark = { kind: "dot" as const, size: 0, petals: 1, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 };
/** Thin ink stroke in the palette's fourth colour for the guide line. */
function guideMaterial(weight: number, palette: readonly number[]): PathMaterial {
  const material = pathMaterial({ kind: "ink", weight, spacing: 8, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark: noMark }, palette);
  return (surface, path, run) => material(surface, { ...path, tone: 3 }, run);
}

/** Draw the recipe into a caller-owned surface: the guide, then the letters. */
export function drawPathTypography(surface: CompositionSurface, recipe: PathTypographyComposition,
  consumers: PathTypographyConsumers = {}, run: CompositionRun = createCompositionRun()): void {
  run.check();
  const products = pathTypographyProducts(recipe);
  if (recipe.guide.show !== "none") {
    const lines = recipe.guide.show === "path" ? products.paths : products.layouts.flatMap((layout) => layout.baselines);
    strokeWith(surface, lines, consumers.guide ?? guideMaterial(recipe.guide.weight, recipe.palette), run);
  }
  const mark = consumers.glyph ?? (recipe.ink.style === "fill" ? glyphFill(recipe.palette, recipe.ink.colorBy)
    : glyphOutline(recipe.palette, recipe.ink.colorBy, recipe.ink.weight));
  for (const frames of products.frames) atEach(surface, frames, mark, run);
}

/** Grow a branch supply cooperatively, then warm the producers; false when cancelled. */
export async function preparePathTypography(recipe: PathTypographyComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  if (recipe.supply.kind === "branch" && !(await prepareBranchTree(recipe.supply.tree, cancelled))) return false;
  pathTypographyProducts(recipe);
  return !cancelled();
}
