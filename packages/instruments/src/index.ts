import type { CutEdit, InstrumentDefinition, InstrumentInput, Parameter } from "./types.js";
import { createCutModel, cutRegions, MAX_CUT_EDITS, validateCutEdits } from "./cut-model.js";
import type { CutRegion } from "./cut-model.js";
import { geometryDefinitions, drawGeometry } from "./adapters/geometry.js";
import { effectsDefinitions, drawEffects } from "./adapters/effects.js";
import { pathsDefinitions, drawPaths } from "./adapters/paths.js";
import { systemsDefinitions, drawSystems } from "./adapters/systems.js";
import { externalExpansionDefinitions, externalExpansionPalette, drawExternalExpansion } from "./adapters/external-expansion.js";
import { externalDynamicsDefinitions, externalDynamicsPalette, drawExternalDynamics, externalDynamicsPreparable, prepareExternalDynamics, PreparationCancelledError } from "./adapters/external-dynamics.js";
import { imageAndControlsPalette } from "./default-palettes.js";
import { creativeDefinitions, creativeDrawers } from "./adapters/creative-instruments.js";
import { reliefDefinitions, drawReliefField } from "./adapters/materials-a-relief.js";
import { interferenceLaceDefinition, drawInterferenceLace } from "./adapters/interference-lace.js";
import { materialsBDefinitions, drawMaterialsB } from "./adapters/materials-b.js";
import { referenceDefinitions, drawReferenceInstrument } from "./adapters/reference-composition-instruments.js";
import { referenceComposition, prepareReferenceComposition } from "./composition/reference.js";
import type { CompositionSurface } from "./composition/types.js";
import { validateParameterValues } from "./parameter-validation.js";

export type { CutEdit, InstrumentDefinition, InstrumentInput, Parameter, CutRegion };
export { createCutModel, cutRegions, MAX_CUT_EDITS, validateCutEdits };
export type {
  CompositionSurface, CompositionRun, Site, LatticeSite, Path, Region, RegionTreeNode, Point, Mark, PathMaterial,
  RegionFiller, PoissonOptions, ContourOptions, PartitionOptions, WallpaperOptions, LatticeOptions, CellTreeOptions,
  WallpaperGroup, MotifSpec, PathMaterialSpec, RegionFillSpec, ReferenceComposition, MapName, MapStage, WarpOptions, WarpedSite, GridOptions,
} from "./composition/types.js";
export { atEach, strokeWith, inside, componentSeed, createCompositionRun } from "./composition/core.js";
export { poissonSites, contourPaths, partitionRegions, wallpaperSites, wallpaperOperations, wallpaperUsesCellHeight, latticeSites, regionTree, gridPaths, gridSites } from "./composition/sources.js";
export { warpPoint, warpSites, warpPaths, mapNames } from "./composition/warp.js";
export { motif, pathMaterial, regionFill } from "./composition/materials.js";
export { referenceComposition, drawReferenceComposition, prepareReferenceComposition } from "./composition/reference.js";

/** A structurally typed caller-owned p5 drawing surface, without a runtime p5 dependency. */
export type DrawingContext = Parameters<(typeof creativeDrawers)[string]>[0]
  & Parameters<typeof drawSystems>[0]
  & Parameters<typeof drawReliefField>[0]
  & Parameters<typeof drawInterferenceLace>[0]
  & CompositionSurface
  & { background?: (...colors: number[] | [string]) => void };

const original = [0x31a151, 0xffa71e, 0x05084c, 0xde4638, 0x3dbdb7];
const latticeOriginal = [0x173f5f, 0xaf5441, 0xe9c46a, 0x347969];
/** Every instrument has exactly one current definition and drawing path. */
export const definitions: readonly InstrumentDefinition[] = [
  ...geometryDefinitions, ...effectsDefinitions,
  ...reliefDefinitions, ...materialsBDefinitions, interferenceLaceDefinition,
  ...externalExpansionDefinitions, ...externalDynamicsDefinitions,
  ...systemsDefinitions, ...pathsDefinitions,
  ...creativeDefinitions, ...referenceDefinitions,
];
const byId = new Map<string, InstrumentDefinition>();
for (const item of definitions) {
  if (byId.has(item.id)) throw new Error(`Duplicate instrument: ${item.id}`);
  const parameterKeys = new Set(item.parameters.map(parameter => parameter.key));
  const defaultKeys = Object.keys(item.defaults);
  if (parameterKeys.size !== item.parameters.length || parameterKeys.size !== defaultKeys.length ||
    defaultKeys.some(key => !parameterKeys.has(key)))
    throw new Error(`Instrument ${item.id} controls must match defaults exactly`);
  byId.set(item.id, item);
}

export function definition(id: string): InstrumentDefinition {
  const found = byId.get(id);
  if (!found) throw new Error(`Unknown instrument: ${String(id)}`);
  return found;
}

function paletteFor(id: string): number[] {
  if (referencePalettes[id]) return [...referencePalettes[id]];
  return imageAndControlsPalette(id) ?? externalDynamicsPalette(id) ??
    externalExpansionPalette(id) ?? (id === "lattice-marks" ? [...latticeOriginal] : [...original]);
}

export function createInstrument(id: string): InstrumentInput {
  const item = definition(id);
  return { technique: item.id, seed: 42, palette: paletteFor(id), params: { ...item.defaults }, cutEdits: [] };
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  const actual = Reflect.ownKeys(value);
  for (const key of actual)
    if (typeof key !== "string" || !keys.includes(key))
      throw new Error(`${path} has an unknown key: ${String(key)}`);
  for (const key of keys)
    if (!Object.hasOwn(value, key)) throw new Error(`${path} is missing ${key}`);
}
function finite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${path} must be a finite number`);
  return value;
}
function integer(value: unknown, path: string): number {
  const result = finite(value, path);
  if (!Number.isInteger(result)) throw new Error(`${path} must be an integer`);
  return result;
}

export function validateParameters(id: string, value: unknown): InstrumentInput["params"] {
  return validateParameterValues(definition(id), value);
}

/** Admit exact current instrument data. App layer/document validation is the caller's concern. */
export function validateInstrument(value: unknown): InstrumentInput {
  const input = object(value, "Instrument");
  exact(input, ["technique", "seed", "palette", "params", "cutEdits"], "Instrument");
  if (typeof input.technique !== "string") throw new Error("Instrument technique is not supported");
  const item = definition(input.technique);
  const seed = integer(input.seed, "Instrument seed");
  if (seed < 0 || seed > 0xffffffff) throw new Error("Instrument seed must be a uint32");
  if (!Array.isArray(input.palette) || input.palette.length < 2 || input.palette.length > 12)
    throw new Error("Instrument palette must contain 2 to 12 RGB colours");
  const palette = input.palette.map((color: unknown, index: number) => {
    const rgb = integer(color, `Instrument palette[${index}]`);
    if (rgb < 0 || rgb > 0xffffff) throw new Error(`Instrument palette[${index}] must be an RGB integer`);
    return rgb;
  });
  const params = validateParameters(item.id, input.params);
  const result: InstrumentInput = { technique: item.id, seed, palette, params, cutEdits: input.cutEdits as CutEdit[] };
  validateCutEdits(result);
  result.cutEdits = result.cutEdits.map(edit => ({ ...edit }));
  return result;
}

const geometryIds = new Set(geometryDefinitions.map(item => item.id));
const referenceIds: Record<string, true> = Object.fromEntries(referenceDefinitions.map(item => [item.id, true]));
const referencePalettes: Record<string, readonly number[]> = {
  "motif-ecologies": [0x192b34, 0xcd7052, 0xd5ad68],
  "contour-scores": [0x203949, 0xc26d4f, 0xd2af76],
  "region-quilts": [0x263a43, 0xb0614d, 0xd7ac64],
  "wallpaper-motifs": [0x1b2430, 0xc27a1f, 0x3f7a66, 0xa8452f],
  "ordered-disorder": [0x2a2320, 0xc0452a, 0x2f6f8f],
  "recursive-cells": [0x22301f, 0xb5832a, 0x8a4a35, 0x3f6572],
  "fold-atlas": [0x1f2a33, 0xc0452a, 0x2f6f8f, 0xb8862b],
};
const effectsIds = new Set(effectsDefinitions.map(item => item.id));
const pathsIds = new Set(pathsDefinitions.map(item => item.id));
const systemsIds = new Set(systemsDefinitions.map(item => item.id));
const externalExpansionIds = new Set(externalExpansionDefinitions.map(item => item.id));
const externalDynamicsIds = new Set(externalDynamicsDefinitions.map(item => item.id));
const materialsBIds = new Set(materialsBDefinitions.map(item => item.id));

/** Draw one transparent 640-unit study; the caller owns compositing and transforms.
 *  Standalone SDK drawers may request an opaque background, but no instrument
 *  may paint over its host's paper or erase earlier layers. */
export function drawInstrument(context: DrawingContext, input: InstrumentInput): void {
  const background = context.background;
  if (background) context.background = () => {};
  try {
    drawUncomposited(context, input);
  } finally {
    if (background) context.background = background;
  }
}
function drawUncomposited(context: DrawingContext, input: InstrumentInput): void {
  definition(input.technique);
  if (referenceIds[input.technique]) return drawReferenceInstrument(context, input);
  const drawCurrent = creativeDrawers[input.technique];
  if (drawCurrent) return drawCurrent(context, input);
  if (geometryIds.has(input.technique)) return drawGeometry(context, input);
  if (effectsIds.has(input.technique)) return drawEffects(context, input);
  if (pathsIds.has(input.technique)) return drawPaths(context, input);
  if (systemsIds.has(input.technique)) return drawSystems(context, input);
  if (externalExpansionIds.has(input.technique)) return drawExternalExpansion(context, input);
  if (externalDynamicsIds.has(input.technique)) return drawExternalDynamics(context, input);
  if (input.technique === "embossed-field" || input.technique === "signed-edge-print") return drawReliefField(context, input);
  if (materialsBIds.has(input.technique)) return drawMaterialsB(context, input);
  if (input.technique === "interference-lace") return drawInterferenceLace(context, input);
  throw new Error(`Unknown instrument: ${input.technique}`);
}

export function canPrepareInstrument(id: string): boolean {
  definition(id);
  return referenceIds[id] === true || externalDynamicsPreparable.has(id);
}

/** Cooperative cache warm-up; false means the caller cancelled before drawing. */
export async function prepareInstrument(input: InstrumentInput, cancelled: () => boolean): Promise<boolean> {
  definition(input.technique);
  if (referenceIds[input.technique])
    return prepareReferenceComposition(referenceComposition(input), cancelled);
  if (!externalDynamicsPreparable.has(input.technique)) return !cancelled();
  try {
    await prepareExternalDynamics(input, cancelled);
    return !cancelled();
  } catch (error) {
    if (error instanceof PreparationCancelledError) return false;
    throw error;
  }
}

const fixedGeometry: Record<string, true> = {
  "loop-marks": true, "projection-marks": true, "ramp-marks": true,
  "profile-marks": true, "annular-marks": true, "geometric-panel": true,
  "orbital-brush": true, "contact-network": true, "agent-trails": true,
  "woven-grammar": true, "recursive-tiles": true, "turtle-canopies": true,
  "harmonic-traces": true, "word-echo": true, "escape-contours": true,
  "registered-screens": true, "perceptual-bands": true, "oklab-orbits": true,
  "extruded-seals": true, "stepped-blocks": true,
  "transported-ribbons": true, "twisting-streamers": true,
  "rounded-polyhedra": true, "subdivided-shells": true,
};
/** Whether changing this instrument's seed can change its current construction. */
export function usesSeed(input: InstrumentInput): boolean {
  const q = input.params;
  switch (input.technique) {
    case "quantized-stripes": return q.order === "shuffle";
    case "orbit-beads": return false;
    case "profile-marks": case "depth-marks": case "annular-marks": return q.colorMode === "noise";
    case "ramp-marks": return Number(q.disorder) > 0 || Number(q.retention) > 0 && Number(q.retention) < 1;
    case "spring-marks": return Number(q.initialDisorder) > 0 && Number(q.initialExtent) > 0 ||
      Number(q.velocitySpeed) > 0 && Number(q.velocitySpread) > 0;
    case "cell-mosaic": case "cell-echoes": case "relaxed-stones": case "centroid-trails":
      return Number(q.disorder) > 0;
    case "woven-rows": case "triangle-glyphs":
      return q.initialMode === "random" && Number(q.density) > 0 && Number(q.density) < 1;
    case "phyllotactic-whorls":
      return Number(q.count) > 0 && (Number(q.angularDisorder) > 0 || Number(q.radialDisorder) > 0 ||
        Number(q.retention) > 0 && Number(q.retention) < 1);
    case "stream-ribbons": case "curved-trajectories":
      return Number(q.sourceCount) > 0 && Number(q.sourceDisorder) > 0 && Number(q.sourceExtent) > 0 ||
        Number(q.startDisorder) > 0 && Number(q.startExtent) > 0;
    case "contact-network": case "agent-trails":
      return Number(q.disorder) > 0 && Number(q.extent) > 0 ||
        Number(q.speed) > 0 && Number(q.velocitySpread) > 0;
    case "obstacle-roads": case "arrival-contours":
      return q.costMode === "noise" && (Number(q.density) > 0 || Number(q.contrast) > 0);
    case "contour-terrain": case "contour-blobs": case "contour-relief":
      return q.source === "noise" || q.source === "hills";
  }
  return fixedGeometry[input.technique] !== true &&
    !(input.technique === "placement-marks" && q.radial === true) &&
    !(input.technique === "chord-looms" && q.retainedFraction === 1 && q.endpointDisorder === 0) &&
    !(input.technique === "woven-strands" && q.sequence !== "seeded" && q.warp === 0 && q.disorder === 0);
}
