import type { ControlGroup, CutEdit, InstrumentDefinition, InstrumentInput, Parameter } from "./types.js";
import { applyControlDependencies } from "./control-dependencies.js";
import { validateVisibility, visibleParameters as visibleControls } from "./visibility.js";
import { inspectorItems as inspectorTree, resolveControlGroups, validateControlGroups, type InspectorItem } from "./control-groups.js";
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
import { branchOrnamentDefinitions } from "./adapters/branch-ornament-instruments.js";
import { branchOrnamentComposition, drawBranchOrnament, prepareBranchOrnament } from "./composition/branch-ornament.js";
import { gestureScoresDefinitions } from "./adapters/gesture-scores-instruments.js";
import { drawGestureScore, gestureScoreComposition, prepareGestureScore } from "./composition/gesture-scores.js";
import { dataScoresDefinition } from "./adapters/data-scores-instrument.js";
import { dataScoresComposition, dataScoresUsesSeed, drawDataScores, prepareDataScores } from "./composition/data-scores.js";
import { crossingLaceDefinition } from "./adapters/crossing-lace-instrument.js";
import { crossingLaceComposition, crossingLaceUsesSeed, drawCrossingLace, prepareCrossingLace } from "./composition/crossing-lace.js";
import type { CompositionSurface } from "./composition/types.js";
import { graphRolesUsesSeed } from "./composition/graph-draw.js";
import { validateParameterValues } from "./parameter-validation.js";
import { typeRhythmUsesSeed } from "./adapters/type-rhythm-instrument.js";

export type { ControlGroup, CutEdit, InstrumentDefinition, InspectorItem, InstrumentInput, Parameter, CutRegion };
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
export { graphFromParts, withDirection, contactGraph, latticeGraph, branchGraph, selectGraph, nearestNode, connectedNodes, graphRoute, planarFaces,
  edgePaths, nodeSites, edgeMarkers, nodeFraction, edgeFraction, MAX_GRAPH_NODES, MAX_GRAPH_EDGES } from "./composition/graph.js";
export type { Graph, GraphNode, GraphEdge, GraphStats, GraphParts, GraphRoleOptions, GraphView, GraphRoute, GraphFace, FaceExtraction,
  RouteMode, RouteMetric, RouteOptions, GraphAttribute, ContactGraphOptions, LatticeGraphOptions, BranchGraphOptions } from "./composition/graph.js";
export { drawGraphComposition, graphStructure, faceFill, edgeToneRole, graphTones } from "./composition/graph-draw.js";
export type { GraphComposition, GraphStructure, GraphSourceOptions, GraphRouteRecipe, FaceFillSpec, EdgeTone } from "./composition/graph-draw.js";
export { patternFunction, gratingLines, planeWave, radialWave, driftPhase, driftPosition, MIN_PERIOD, DEFAULT_FLATNESS } from "./composition/patterns.js";
export type { PatternSpec, PatternFunction, PatternRequest, PatternElements, PatternStroke, PatternDot, WavePattern } from "./composition/patterns.js";
export { resolveSupport, supportContains, clipToSupport } from "./composition/support.js";
export type { FootprintSpec, MaskSource, MaskSpec, SupportSpec, Support, Ring } from "./composition/support.js";
export { opticalPlates, makePlate, plateFrames, drawPlate, drawPlatesRecipe } from "./composition/plates.js";
export type { OpticalPlates, OpticalPlatesOptions, Plate, PlateFrame, PlateOptions, PlateConsumers, PlateInk, PlatesRecipe, Registration } from "./composition/plates.js";
export type { AttachmentOptions, AttachmentRole, AttachmentSite, BranchEdge, BranchNode, BranchRole, BranchRouting, BranchTree, BranchTreeOptions,
  BranchVisibility, FlankSides, GrowthConstruction, OutlineOptions, OutlineShape, RootFit } from "./composition/branch-tree.js";
export { attachmentSites, branchOutline, branchTree, fitRoots, forkAxis, inheritAngle, removeLoops, visibleEdges } from "./composition/branch-tree.js";
export type { BranchConsumers, BranchOrnamentComposition } from "./composition/branch-ornament.js";
export { branchOrnamentComposition, drawBranchOrnament, prepareBranchOrnament } from "./composition/branch-ornament.js";
export type { RecordingData, Recording, GestureFrame, TrackOptions, GestureTrack, EchoOptions, PressureSource, PressurePolicy, ResolvedPressure,
  TimeWindow, StationRule, Stations } from "./composition/recording.js";
export { createRecording, recordingData, recordingFingerprint, gestureTrack, echoTrack, resolvePressure, speedPressure, stations, countStations, RECORDING_LIMITS } from "./composition/recording.js";
export type { BundledRecordingId } from "./composition/recording-samples.js";
export { bundledRecording, bundledRecordingIds, bundledRecordingInfo } from "./composition/recording-samples.js";
export type { PressureMap, GesturePathOptions, GesturePath, BristleOptions, GestureSite, SandOptions, GestureSiteOptions } from "./composition/gesture.js";
export { mapPressure, gesturePath, bristleBand, sandGrains, gestureSites } from "./composition/gesture.js";
export type { RecordingSource, GestureScoreComposition, GestureConsumers, GestureRepeat } from "./composition/gesture-scores.js";
export { gestureScoreComposition, gestureScoreProducts, resolveRecording, drawGestureScore, prepareGestureScore } from "./composition/gesture-scores.js";
export type {
  TilingRuleName, TilingOptions, TilingTile, TilingVertex, TilingEdge, Tiling, TileFiller, TileFillSpec, TileColorMode, TilingView,
} from "./composition/types.js";
export { substitutionTiling, tilingRules, tilingEdgePaths, tileAncestorId, MAX_TILING_DEPTH, MAX_TILING_PIECES } from "./composition/tilings.js";
export { tileFill, tileTone, tonedTiles, tonedEdges, selectedVertices, shownTiles, insetPolygon, drawTiling } from "./composition/tiling-materials.js";
export type { ContinuousColumn, CategoricalColumn, Column, ColumnInput, DataTableInput, DataTable, Curve, Outside, ChannelSpec, MeasureMapping,
  QuantityMapping, ResolvedChannel, Aggregate, MissingPolicy, UnitWindow, UnitOptions, DataUnit, OmitReason, OmittedUnit, ResolveOptions,
  ResolvedUnit, ResolvedMapping, ResolvedData } from "./composition/data-table.js";
export { dataTable, column, continuousColumn, categoricalColumn, measureExtent, resolveChannel, applyMeasure, aggregateValues, buildUnits,
  resolveData, curves, curveNames, outsidePolicies, aggregateNames, missingPolicies, MAX_TABLE_ROWS, MAX_TABLE_COLUMNS, MAX_CATEGORIES } from "./composition/data-table.js";
export { sampleTable, sampleIds, sampleInputs } from "./composition/data-samples.js";
export type { DataSite, DataRegion, OrderMode, OrderOptions, LatticeLayoutOptions, DataLattice, TreemapLayoutOptions, DataTreemap,
  TimelineLayoutOptions, TimelineLane, DataTimeline } from "./composition/data-layouts.js";
export { orderUnits, latticeLayout, treemapLayout, timelineLayout } from "./composition/data-layouts.js";
export type { KeyRow, KeyModel } from "./composition/data-key.js";
export { dataKey, drawDataKey, keyLabel, formatNumber } from "./composition/data-key.js";
export type { DataMarkKind, DataFillKind, DataMarkSpec, DataFillSpec, DataLineSpec, DataFootprint, DataLayoutSpec, DataScoresRecipe,
  DataScoresConsumers, DataScene } from "./composition/data-scores.js";
export { dataScoresScene, dataMark, dataFill, dataFillSpec, drawDataScores, prepareDataScores, dataScoresComposition, sampleSlots } from "./composition/data-scores.js";
export type { TextSource, TypeLine } from "./composition/type-text.js";
export { textSource, bundledTextSources, typeLine, clipRingToRect, keyholeRings, fillRings, CAP_HEIGHT, MAX_TEXT_LINES, MAX_LINE_CHARS } from "./composition/type-text.js";
export type { TypeModuleKind, ScreenAngles, TypeLayoutOptions, TypeModuleSource, TypeModule, TypeLayout, TypeFieldOptions, TypeField,
  ModuleFrame, TypeInstance, ModuleType, TypeContent, TypeScreenSpec, TypeAnchor } from "./composition/type-rhythm.js";
export { typeRhythmLayout, typeField, rowLine, rowBaseline, repeatLeft, moduleFrame, fieldToLocal, moduleType, typeContent, screenFrame,
  moduleScreen, moduleLined, moduleOutline, typeAnchor, MAX_TYPE_MODULES, MAX_MODULE_INSTANCES, MAX_MODULE_VERTICES, MAX_TYPE_VERTICES } from "./composition/type-rhythm.js";
export type { TypeInk, TypeScreenInk, TypeRhythmComposition } from "./composition/type-rhythm-draw.js";
export { drawTypeRhythm, prepareTypeRhythm } from "./composition/type-rhythm-draw.js";
export type { Crossing, CrossingSide, Contact, NearMiss, CrossingSet, CrossingOptions } from "./composition/crossings.js";
export { findCrossings, CROSSING_LIMITS } from "./composition/crossings.js";
export type { OverRule, CrossingOrderOptions, Occurrence, AlternationBreak, CrossingOrder } from "./composition/crossing-order.js";
export { orderCrossings, strandRoles } from "./composition/crossing-order.js";
export type { StrandOptions, StrandPiece, StrandGap, StrandConflict, Strands } from "./composition/lace-strands.js";
export { strandPieces, strandEnds } from "./composition/lace-strands.js";
export { crossingHalfGap, cumulativeLengths, retainedSegments, cutPath } from "./composition/strands.js";
export type { LaceFrame, LaceShape, LaceOptions } from "./composition/lace-families.js";
export { lacePaths, laceVertexEstimate, MAX_LACE_VERTICES } from "./composition/lace-families.js";
export type { StrandStyle, CrossingLaceComposition, LaceConsumers, CrossingLaceProducts } from "./composition/crossing-lace.js";
export { crossingLaceComposition, crossingLaceProducts, drawCrossingLace, drawCrossingLaceProducts, prepareCrossingLace } from "./composition/crossing-lace.js";

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
const authoredDefinitions: readonly InstrumentDefinition[] = [
  ...geometryDefinitions, ...effectsDefinitions,
  ...reliefDefinitions, ...materialsBDefinitions, interferenceLaceDefinition,
  ...externalExpansionDefinitions, ...externalDynamicsDefinitions,
  ...systemsDefinitions, ...pathsDefinitions,
  ...creativeDefinitions, ...referenceDefinitions, ...branchOrnamentDefinitions,
  ...gestureScoresDefinitions, dataScoresDefinition, crossingLaceDefinition,
];
export const definitions: readonly InstrumentDefinition[] = applyControlDependencies(authoredDefinitions).map(resolveControlGroups);
const byId = new Map<string, InstrumentDefinition>();
for (const item of definitions) {
  if (byId.has(item.id)) throw new Error(`Duplicate instrument: ${item.id}`);
  const parameterKeys = new Set(item.parameters.map(parameter => parameter.key));
  const defaultKeys = Object.keys(item.defaults);
  if (parameterKeys.size !== item.parameters.length || parameterKeys.size !== defaultKeys.length ||
    defaultKeys.some(key => !parameterKeys.has(key)))
    throw new Error(`Instrument ${item.id} controls must match defaults exactly`);
  validateVisibility(item);
  byId.set(item.id, item);
}

export function definition(id: string): InstrumentDefinition {
  const found = byId.get(id);
  if (!found) throw new Error(`Unknown instrument: ${String(id)}`);
  return found;
}

/** The controls the inspector should show for these values; hidden controls keep their values. */
export function visibleParameters(id: string, values: InstrumentInput["params"]): Parameter[] {
  return visibleControls(definition(id), values);
}
export { validateVisibility, validateControlGroups };

/** The inspector tree for these values: declared groups holding their visible controls; empty groups omitted. */
export function inspectorItems(id: string, values: InstrumentInput["params"]): InspectorItem[] {
  return inspectorTree(definition(id), values);
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
  "graph-roles": [0x1f2a33, 0xc4452b, 0x2f6f8f, 0xd9a441, 0x9a3d78],
  "optical-plates": [0x1f2d3a, 0xc0452a, 0x2f6f8f],
  "branch-ornament": [0x23302b, 0xb5452e, 0xd39a3a, 0x4f7a5c],
  "gesture-scores": [0x24262b, 0xc99a3b, 0xb8452f, 0x2f6f7a],
  "data-scores": [0x1f2a33, 0xc4452b, 0x2f6f8f, 0xd9a441, 0x4f7a5c, 0x8a4a86],
  "substitution-tilings": [0x1f2733, 0xc4573b, 0xe3a93f, 0x2f7c78, 0x7d4d8f],
  "typographic-rhythm": [0x1c1d20, 0xc93a2a, 0x2b5d9b, 0xe6ae2c],
  "crossing-lace": [0x1f2a33, 0xc4452b, 0x2f6f8f, 0xd9a441, 0x4f7a5c],
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
  if (input.technique === "branch-ornament") return drawBranchOrnament(context, branchOrnamentComposition(input));
  if (input.technique === "gesture-scores") return drawGestureScore(context, gestureScoreComposition(input));
  if (input.technique === "data-scores") return drawDataScores(context, dataScoresComposition(input));
  if (input.technique === "crossing-lace") return drawCrossingLace(context, crossingLaceComposition(input));
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
  return referenceIds[id] === true || id === "branch-ornament" || id === "gesture-scores" || id === "crossing-lace" || externalDynamicsPreparable.has(id);
  return referenceIds[id] === true || id === "branch-ornament" || id === "data-scores" || externalDynamicsPreparable.has(id);
}

/** Cooperative cache warm-up; false means the caller cancelled before drawing. */
export async function prepareInstrument(input: InstrumentInput, cancelled: () => boolean): Promise<boolean> {
  definition(input.technique);
  if (input.technique === "branch-ornament")
    return prepareBranchOrnament(branchOrnamentComposition(input), cancelled);
  if (input.technique === "gesture-scores") return prepareGestureScore(gestureScoreComposition(input), cancelled);
  if (input.technique === "data-scores")
    return prepareDataScores(dataScoresComposition(input), cancelled);
  if (input.technique === "crossing-lace") return prepareCrossingLace(crossingLaceComposition(input), cancelled);
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
    case "gesture-scores": return q.recording === "wander" || Number(q.hairs) > 0 && q.bristles === true || q.sandMark !== "none" ||
      q.glyphMark !== "none" && (Number(q.glyphVariation) > 0 || Number(q.glyphRetention) < 1);
    case "optical-plates": return q.maskedPlate !== "none" && q.maskShape === "regions";
    case "data-scores": return dataScoresUsesSeed(q);
    case "crossing-lace": return crossingLaceUsesSeed(q);
    case "substitution-tilings":
      return Number(q.retention) > 0 && Number(q.retention) < 1 || q.interior === "wash" && Number(q.bleed) > 0 ||
        q.interior !== "none" && q.colorBy === "supertile";
    case "typographic-rhythm": return typeRhythmUsesSeed(q);
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
    case "graph-roles": return graphRolesUsesSeed(q);
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
