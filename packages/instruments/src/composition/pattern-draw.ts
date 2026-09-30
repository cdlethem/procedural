import { patternCompetitionDefinition } from "../adapters/pattern-competition-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { atEach, cachedBy, createCompositionRun, strokeWith } from "./core.js";
import { keyholeRing } from "./domains.js";
import { color, motif, pathMaterial } from "./materials.js";
import {
  patternBands, patternContours, patternFrame, patternSites, patternSnapshots, patternView, preparePatternSnapshots, scaleTone,
  type PatternBand, type PatternModel, type PatternPath, type PatternSite, type PatternSnapshots,
} from "./pattern-competition.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, PathMaterial, PathMaterialSpec } from "./types.js";

/*
 * Pattern Competition as a composition: one stateful model (`pattern-competition.ts`), three consumers of its final state.
 *
 * Construction (`model`, `steps`, `seed`) is the only thing that reaches the simulation; everything below `frame` is drawing.
 * Palette roles: index 0 is ink (contours and marks in "Ink" colour), scales cycle over the remaining colours (`scaleTone`).
 * Draw order is fixed: bands, contours, marks. `consumers` replaces any of them with an ordinary callback that receives the same
 * frozen values (bands as planar domains with their scale, contours as paths carrying `scale`, marks as sites carrying
 * `scaleIndex`, `value` and a contour-following `angle`).
 */
export interface PatternCompetitionComposition {
  kind: "pattern-competition";
  seed: number;
  palette: readonly number[];
  model: PatternModel;
  steps: number;
  frame: { centerX: number; centerY: number; size: number };
  bands: { level: number; smoothing: number; minArea: number; opacity: number } | null;
  contours: { levels: readonly number[]; minLength: number; colorBy: "single" | "scale" | "level"; material: PathMaterialSpec } | null;
  marks: { level: number; size: number; gap: number; colorBy: "scale" | "single"; align: boolean; mark: MotifSpec } | null;
}

export interface PatternConsumers {
  /** Draws one scale's band (a planar domain in canvas units) in place of the stock flat fill. */
  band?: (surface: CompositionSurface, band: PatternBand, run: CompositionRun) => void;
  line?: PathMaterial;
  mark?: Mark;
}

type Scalar = number | string | boolean;
const definition = patternCompetitionDefinition;

/** Resolve stored scalar controls to the public recipe. Hidden controls (start shape values off a noise start, tiles without symmetry, ...) are not read. */
export function patternCompetitionComposition(input: InstrumentInput): PatternCompetitionComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const start = q.start as PatternModel["start"], shaped = start !== "noise", symmetry = q.symmetry as PatternModel["symmetry"];
  const model: PatternModel = {
    resolution: q.resolution as number, scales: q.scales as number, smallest: q.smallest as number, ratio: q.ratio as number, inhibitor: q.inhibitor as number,
    increment: q.increment as number, tilt: q.tilt as number, boundary: q.boundary as PatternModel["boundary"], symmetry,
    tiles: symmetry === "none" ? 1 : q.tiles as number, start,
    startSize: shaped ? q.startSize as number : 0, startCount: start === "spots" ? q.startCount as number : 0, noise: shaped ? q.noise as number : 0,
  };
  const count = q.levelCount as number;
  const levels = Array.from({ length: count }, (_, k) => (q.levelCenter as number) + (q.levelSpread as number) * (2 * (k + 1) / (count + 1) - 1));
  const dot: MotifSpec = { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 };
  const markKind = q.markKind as MotifSpec["kind"];
  return {
    kind: "pattern-competition", seed: patternCompetitionUsesSeed(q) ? input.seed : 0, palette: [...input.palette], model, steps: q.steps as number,
    frame: { centerX: q.centerX as number, centerY: q.centerY as number, size: q.size as number },
    bands: q.bands ? { level: q.bandLevel as number, smoothing: q.bandSmoothing as number, minArea: q.bandMinArea as number, opacity: q.bandOpacity as number } : null,
    contours: q.contours ? {
      levels, minLength: q.contourMin as number, colorBy: q.contourColor as "single" | "scale" | "level",
      material: { kind: q.lineKind as PathMaterialSpec["kind"], weight: q.lineWeight as number, spacing: q.lineSpacing as number, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
        mark: { ...dot, size: q.lineBead as number } },
    } : null,
    marks: q.marks ? {
      level: q.markLevel as number, size: q.markSize as number, gap: q.markGap as number, colorBy: q.markColor as "scale" | "single",
      align: markKind === "rosette" || markKind === "arrow" ? q.markAlign as boolean : false,
      mark: { kind: markKind, size: q.markSize as number, petals: q.markPetals as number, opening: q.markOpening as number, weight: q.markWeight as number, rotation: 0,
        variation: q.markVariation as number, retention: q.markRetention as number },
    } : null,
  };
}

/** Whether the seed can change the drawing: a noise start, spots, or noise added to a disc or ring. */
export function patternCompetitionUsesSeed(q: InstrumentInput["params"]): boolean {
  return q.start === "noise" || q.start === "spots" && Number(q.startCount) > 0 || Number(q.noise) > 0;
}

const tonedPaths = new WeakMap<readonly PatternPath[], Map<string, readonly PatternPath[]>>();
const tonedSites = new WeakMap<readonly PatternSite[], Map<string, readonly PatternSite[]>>();

/** The snapshots this recipe draws (cached by construction; an appearance edit returns the same object). */
export function patternRecipeSnapshots(recipe: PatternCompetitionComposition, run?: CompositionRun): PatternSnapshots {
  return patternSnapshots(recipe.model, recipe.seed, recipe.steps, run);
}

/** The frozen values the three consumers read for a recipe, in draw order. */
export interface PatternProducts {
  readonly snapshots: PatternSnapshots;
  readonly bands: readonly PatternBand[];
  readonly paths: readonly PatternPath[];
  readonly sites: readonly PatternSite[];
}
export function patternProducts(recipe: PatternCompetitionComposition, snapshots: PatternSnapshots): PatternProducts {
  const frame = patternFrame(recipe.frame.centerX, recipe.frame.centerY, recipe.frame.size);
  const { bands, contours, marks } = recipe;
  return {
    snapshots,
    bands: bands ? patternBands(snapshots, frame, bands) : [],
    paths: contours ? patternContours(snapshots, frame, contours) : [],
    sites: marks ? patternSites(snapshots, frame, marks) : [],
  };
}

function fillBand(surface: CompositionSurface, band: PatternBand, palette: readonly number[], opacity: number, run: CompositionRun): void {
  run.enter(band.domain.regions.length);
  try {
    surface.push();
    surface.noStroke();
    color(surface, palette, scaleTone(band.scale, palette.length), 255 * opacity, true);
    for (const region of band.domain.regions) {
      surface.beginShape();
      for (const [x, y] of keyholeRing(region)) surface.vertex(x, y);
      surface.endShape(surface.CLOSE);
    }
    surface.pop();
  } finally { run.leave(); }
}

/** Draw the recipe into a caller-owned surface: scale bands, contours, then marks. */
export function drawPatternCompetition(surface: CompositionSurface, recipe: PatternCompetitionComposition, consumers: PatternConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 400_000 })): void {
  run.check();
  const products = patternProducts(recipe, patternRecipeSnapshots(recipe, run));
  const { palette } = recipe;
  if (recipe.bands) for (const band of products.bands) {
    if (consumers.band) consumers.band(surface, band, run);
    else fillBand(surface, band, palette, recipe.bands.opacity, run);
  }
  if (recipe.contours && products.paths.length > 0) {
    const { colorBy, levels, material } = recipe.contours;
    const paths = cachedBy(tonedPaths, products.paths, `${colorBy}|${palette.length}|${levels.length}`, () => products.paths.map((path): PatternPath => Object.freeze({
      ...path, tone: colorBy === "single" ? 0 : colorBy === "scale" ? scaleTone(path.scale, palette.length) : scaleTone(Math.round(path.levelFraction * (levels.length - 1)), palette.length) })));
    strokeWith(surface, paths, consumers.line ?? pathMaterial(material, palette), run);
  }
  if (recipe.marks && products.sites.length > 0) {
    const { colorBy, align, mark } = recipe.marks;
    const sites = cachedBy(tonedSites, products.sites, `${colorBy}|${align}|${palette.length}`, () => products.sites.map((site): PatternSite => Object.freeze({
      ...site, tone: colorBy === "single" ? 0 : scaleTone(site.scaleIndex, palette.length), angle: align ? site.angle : 0 })));
    atEach(surface, sites, consumers.mark ?? motif(mark, palette), run);
  }
}

const tick = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Run the model (cooperatively, in time slices), then build bands, contours and marks one at a time; false if cancelled. Nothing is published on cancellation. */
export async function preparePatternCompetition(recipe: PatternCompetitionComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const snapshots = await preparePatternSnapshots(recipe.model, recipe.seed, recipe.steps, cancelled);
  if (!snapshots || cancelled()) return false;
  const frame = patternFrame(recipe.frame.centerX, recipe.frame.centerY, recipe.frame.size);
  patternView(snapshots);
  if (recipe.bands) { await tick(); if (cancelled()) return false; patternBands(snapshots, frame, recipe.bands); }
  if (recipe.contours) { await tick(); if (cancelled()) return false; patternContours(snapshots, frame, recipe.contours); }
  if (recipe.marks) { await tick(); if (cancelled()) return false; patternSites(snapshots, frame, recipe.marks); }
  return !cancelled();
}
