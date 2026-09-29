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
import { sandDepositionDefinitions } from "./adapters/sand-deposition-instrument.js";
import { drawSandDeposition, prepareSandDeposition, sandDepositionComposition } from "./composition/deposition.js";
import { branchOrnamentComposition, drawBranchOrnament, prepareBranchOrnament } from "./composition/branch-ornament.js";
import { gestureScoresDefinitions } from "./adapters/gesture-scores-instruments.js";
import { drawGestureScore, gestureScoreComposition, prepareGestureScore } from "./composition/gesture-scores.js";
import { dataScoresDefinition } from "./adapters/data-scores-instrument.js";
import { painterlySourceDefinition } from "./adapters/painterly-source-instrument.js";
import { drawPainterly, painterlyComposition, preparePainterly } from "./composition/painterly-draw.js";
import { imageDirectedFieldDefinition } from "./adapters/image-directed-field-instrument.js";
import { drawImageDirectedField, imageDirectedFieldComposition, prepareImageDirectedField } from "./composition/image-directed-field.js";
import { dataScoresComposition, dataScoresUsesSeed, drawDataScores, prepareDataScores } from "./composition/data-scores.js";
import { crossingLaceDefinition } from "./adapters/crossing-lace-instrument.js";
import { crossingLaceComposition, crossingLaceUsesSeed, drawCrossingLace, prepareCrossingLace } from "./composition/crossing-lace.js";
import { quilledPathsDefinition } from "./adapters/quilled-paths-instrument.js";
import { drawQuilled, prepareQuilled, quillComposition, quillUsesSeed } from "./composition/quill-draw.js";
import { bundledRelationsDefinition } from "./adapters/bundled-relations-instrument.js";
import { bundledRelationsComposition, bundledRelationsUsesSeed, drawBundledRelations, prepareBundledRelations } from "./composition/bundled-relations.js";
import { dryBristlesDefinition } from "./adapters/dry-bristles-instrument.js";
import { drawDryBristles, dryBristlesComposition, prepareDryBristles } from "./composition/dry-bristles.js";
import type { CompositionSurface } from "./composition/types.js";
import { graphRolesUsesSeed } from "./composition/graph-draw.js";
import { validateParameterValues } from "./parameter-validation.js";
import { typeRhythmUsesSeed } from "./adapters/type-rhythm-instrument.js";
import { slitCompositionsDefinition } from "./adapters/slit-compositions-instrument.js";
import { drawSlit, prepareSlit, slitComposition } from "./composition/slit-draw.js";
import { pathTypographyDefinition, pathTypographyUsesSeed } from "./adapters/path-typography-instrument.js";
import { drawPathTypography, pathTypographyComposition, preparePathTypography } from "./composition/path-type-draw.js";

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
export { graphFromParts, graphFromBranchTree, withDirection, contactGraph, latticeGraph, branchGraph, selectGraph, nearestNode, connectedNodes, graphRoute, planarFaces,
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
export type { RecordedControlsInput } from "./composition/recording.js";
export { createRecording, recordingControls, recordingData, recordingFingerprint, gestureTrack, echoTrack, resolvePressure, speedPressure, stations, countStations, RECORDING_LIMITS } from "./composition/recording.js";
export type { BundledRecordingId } from "./composition/recording-samples.js";
export { bundledRecording, bundledRecordingIds, bundledRecordingInfo } from "./composition/recording-samples.js";
export type { GesturePathOptions, GesturePath, GestureSite, SandOptions, GestureSiteOptions } from "./composition/gesture.js";
export { gesturePath, sandGrains, gestureSites } from "./composition/gesture.js";
export type { PressureMap, PressureProfile, PressureShape, BristleFrame, BristleTrack, TipShape, BrushHold, BristleOptions, BristleHair, BristleContact,
  BristleInk, BristleMaterialSpec } from "./composition/bristle.js";
export { mapPressure, bristleTrack, bristleBand, bristleContact, bristleStroke, bristleStrokes, planBristles, checkBristleWork, bristleMaterial, hairMaterial,
  drawBristleStroke, drawFootprint, paperTooth, profilePressure, isBristleTrack, pressureProfiles, tipShapes, brushHolds, MAX_HAIR_POINTS, MAX_STATIONS } from "./composition/bristle.js";
export type { DirectionFn, TraceSeed, StreamlineOptions, Streamline, StreamlineResult } from "./composition/streamlines.js";
export { traceStreamlines, SEED_CLEARANCE } from "./composition/streamlines.js";
export type { FieldImage, FieldValue, FieldMode, AmbientKind, FieldFrame, ImageFieldOptions, FieldSample, ImageField, FieldGate, FieldLineOptions, FieldLine,
  FieldSiteOptions, FieldSite } from "./composition/image-field.js";
export { imageStructure, imageField, fieldLines, fieldSites, FIELD_LIMITS } from "./composition/image-field.js";
export type { ColorBy as FieldColorBy, LineConstruction, ImageDirectedFieldComposition, ImageDirectedFieldConsumers, ImageDirectedFieldProducts } from "./composition/image-directed-field.js";
export { imageDirectedFieldComposition, imageDirectedFieldProducts, drawImageDirectedField, prepareImageDirectedField, fieldTone, toneLevel, MAX_DRAW_UNITS } from "./composition/image-directed-field.js";
export type { RecordingSource, GestureScoreComposition, GestureConsumers, GestureRepeat } from "./composition/gesture-scores.js";
export { gestureScoreComposition, gestureScoreProducts, resolveRecording, drawGestureScore, prepareGestureScore } from "./composition/gesture-scores.js";
export type { ControlSequenceData, ControlSequence } from "./composition/control-sequence.js";
export { createControlSequence, controlSequenceData, sequenceFingerprint, SEQUENCE_LIMITS } from "./composition/control-sequence.js";
export type { BundledControlSequenceId, BundledSequenceInfo } from "./composition/control-sequence-samples.js";
export { bundledControlSequence, bundledControlSequenceIds, bundledControlSequenceInfo } from "./composition/control-sequence-samples.js";
export type { FamilyOptions, CurveFamily } from "./composition/spline-family.js";
export { curveFamily, curveAtTime, lengthIntegral, CurveCursor, FAMILY_SAMPLES } from "./composition/spline-family.js";
export type { Emitter, FallModel, FallDraws, Landing, DepositGrain, ExposureSpec, GrainConsumer, DensityField } from "./composition/grains.js";
export { landGrain, fallVelocity, grainAlpha, exposeGrains, depositGrains, accumulateDensity, smoothDensity, densityContours, MIN_GRAIN_ALPHA, MAX_FIELD_CELLS } from "./composition/grains.js";
export type { DepositOptions, Deposit, ProtectedSpec, ProtectedSpace, KeptDeposit, CurvePathOptions, SequenceSource, SandDepositionComposition,
  SandConsumers, DepositionProducts } from "./composition/deposition.js";
export { splineDeposit, protectedSpace, keepOut, curvePaths, sandDepositionComposition, resolveSequence, sandDepositionProducts, depositionDensity,
  isolineTone, densityAtTone, drawSandDeposition, prepareSandDeposition, MAX_DEPOSIT_GRAINS, MAX_SAMPLED_GRAINS, MAX_OVERLAY_CURVES } from "./composition/deposition.js";
export type { Raster, RasterData, RasterChannels, RasterFormat, ColorSpace, AlphaMode, ConvertOptions, SampleFilter, EdgeRule, SampleOptions, ScalarGrid, LabelGrid,
  ValueKind, ValueOptions, RasterMapping, ResizeFilter } from "./composition/raster.js";
export { createRaster, rasterData, rasterPixel, convertRaster, sampleRaster, sampleInto, sampleGrid, createScalarGrid, valueField, rasterMapping, cropRaster,
  resizeRaster, srgbToLinear, linearToSrgb, LUMA, RASTER_LIMITS } from "./composition/raster.js";
export type { BundledRasterId } from "./composition/raster-samples.js";
export { bundledRaster, bundledRasterIds, bundledRasterInfo, BUNDLED_RASTER_SIZE } from "./composition/raster-samples.js";
export type { ImageSource, SegmentOptions, ValueRegion, RegionAdjacency, Segmentation, SubdivisionMetric, SplitPolicy, SubdivideOptions, ImageCell, Subdivision,
  OrientationOptions, OrientationSample, OrientationField, OrientationVectorOptions, ScanDirection, ScanOptions, ScanRun, RunSet, SortRunsOptions, PixelMoves,
  ApplyMovesOptions, FrequencyModulationOptions, ModulatedLine } from "./composition/image-structure.js";
export { segmentValueBands, valueRegionMask, subdivideImage, subdivisionLabels, orientationField, orientationPixel, orientationAt, orientationGrids, orientationVector,
  scanRuns, scanRunPixel, scanRunSegment, sortScanRuns, applyPixelMoves, pixelSort, frequencyModulation, modulatedPolyline, IMAGE_STRUCTURE_LIMITS } from "./composition/image-structure.js";
export type { SourceFrame, TraceFigure, PathData, BristleSource } from "./composition/bristle-sources.js";
export { bristleSourcePaths, pathSet, traceFigures, contourFields, MAX_SOURCE_PATHS, MAX_SOURCE_POINTS } from "./composition/bristle-sources.js";
export type { DryBristlesComposition, DryBristlesConsumers, DryBristlesPlan } from "./composition/dry-bristles.js";
export { dryBristlesComposition, dryBristlesPlan, dryBristlesStrokes, drawDryBristles, prepareDryBristles } from "./composition/dry-bristles.js";
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
export type { RelationSample } from "./composition/bundle-samples.js";
export { relationSample, relationSampleIds, relationColumns } from "./composition/bundle-samples.js";
export type { RelationColumns, GroupAssignment, RelationData, EndpointOrder, SectorBasis, LayoutFrame, EndpointLayoutOptions, GroupPlacement, EndpointLayout, EdgeScope,
  BundleFamilies, BundleOptions, BundledPath, EdgeBundle, BundledEdges, FamilyHighlight } from "./composition/bundling.js";
export { relationsFromTables, layoutEndpoints, selectRelations, bundleEdges, groupBands, pathMarkers, highlightedEdges,
  MAX_BUNDLED_EDGES, MAX_BUNDLE_VERTICES, MAX_BUNDLE_DETAIL } from "./composition/bundling.js";
export type { BundledRelationsRecipe, BundledConsumers, BundledStructure } from "./composition/bundled-relations.js";
export { bundledStructure, drawBundledRelations, prepareBundledRelations, bundledRelationsComposition, WEIGHT_BANDS, MAX_MATERIAL_WORK } from "./composition/bundled-relations.js";
export type { TextSource, TypeLine } from "./composition/type-text.js";
export { textSource, bundledTextSources, typeLine, clipRingToRect, keyholeRings, fillRings, CAP_HEIGHT, MAX_TEXT_LINES, MAX_LINE_CHARS } from "./composition/type-text.js";
export type { TypeModuleKind, ScreenAngles, TypeLayoutOptions, TypeModuleSource, TypeModule, TypeLayout, TypeFieldOptions, TypeField,
  ModuleFrame, TypeInstance, ModuleType, TypeContent, TypeScreenSpec, TypeAnchor } from "./composition/type-rhythm.js";
export { typeRhythmLayout, typeField, rowLine, rowBaseline, repeatLeft, moduleFrame, fieldToLocal, moduleType, typeContent, screenFrame,
  moduleScreen, moduleLined, moduleOutline, typeAnchor, MAX_TYPE_MODULES, MAX_MODULE_INSTANCES, MAX_MODULE_VERTICES, MAX_TYPE_VERTICES } from "./composition/type-rhythm.js";
export type { TypeInk, TypeScreenInk, TypeRhythmComposition } from "./composition/type-rhythm-draw.js";
export { drawTypeRhythm, prepareTypeRhythm } from "./composition/type-rhythm-draw.js";
export type { PaintFamily, PaintFrame, PaintSubject, PaintPlanOptions, PaintMark, PaintLayer, PaintPlan } from "./composition/painterly.js";
export { paintPlan, preparePaintPlan, paintLayerGeometry, paintCandidateCount, PAINT_FAMILIES, MAX_PAINT_LAYERS, MAX_PAINT_CANDIDATES, MAX_PAINT_MARKS,
  MAX_ANALYSIS_SIDE, MIN_PAINT_BRUSH } from "./composition/painterly.js";
export type { PaintMaterialKind, PaintMaterialSpec, PaintColorMode, PaintColorSpec } from "./composition/painterly-style.js";
export { paintLayerMaterial, paintPalette, keepsMark } from "./composition/painterly-style.js";
export type { PaintSource, PaintShape, PainterlyComposition, PaintConsumers } from "./composition/painterly-draw.js";
export { painterlyComposition, painterlyPlan, paintPlanOptions, resolvePaintSource, paintDrawWork, drawPainterly, preparePainterly, PAINT_DRAW_WORK } from "./composition/painterly-draw.js";
export type { EndBehaviour, Interpolation, FrameStackData, FrameStack, ResolvedTime } from "./composition/frame-stack.js";
export { createFrameStack, resolveFrameTime, FRAME_STACK_LIMITS } from "./composition/frame-stack.js";
export type { BundledSequenceId } from "./composition/frame-samples.js";
export { bundledFrameStack, bundledSequenceIds, bundledSequenceInfo, BUNDLED_SEQUENCE_FRAMES, BUNDLED_SEQUENCE_SIZE } from "./composition/frame-samples.js";
export type { SliceOrderKind, SliceOrder, ModulationMode, Modulation, GestureChannel, TimeCurve, TimeScan, SliceTableOptions, SliceTime, SliceRow, SliceTable } from "./composition/slit-map.js";
export { slicePermutation, sliceTable, timeProgress, sliceId, sliceOrderKinds, modulationModes, SLICE_LIMITS } from "./composition/slit-map.js";
export type { SlitDirection, OutsidePolicy, SlitSourceValue, SlitLine, StripOptions, StripSet, FragmentOptions, SlitFragment, FragmentSet, ColorMode, SlitColor,
  SlitCell, SlitRectOptions, SlitRect } from "./composition/slit.js";
export { slitStrips, stripPixel, slitPoint, placePosition, coverScale, slitFragments, slitRects, paletteRamp, SLIT_LIMITS } from "./composition/slit.js";
export type { SlitSource, SlitMask, SlitComposition, SlitConsumers, SlitScene } from "./composition/slit-draw.js";
export { slitComposition, slitSource, slitScene, slitBands, quiltCells, drawSlit, prepareSlit, SLIT_SPILL } from "./composition/slit-draw.js";
export type { ArcTable, ArcPoint } from "./composition/path-arc.js";
export { arcTable, arcPointAt, arcTurn, arcSpan, closedRing } from "./composition/path-arc.js";
export type { AdvanceItem, Crowding, CurvaturePolicy, PathsLayoutOptions, RepeatPolicy, ReadingDirection, DropReason, Adaptation, PathLayoutOptions, PathFrame, DroppedItem, LayoutReport,
  PathLayout, DisruptionOptions, DisruptedFrames } from "./composition/path-type.js";
export { layoutAlongPath, layoutPaths, disruptFrames, cleanPath, MAX_LAYOUT_ITEMS, MAX_COLLISION_WORK, MIN_CONDENSE } from "./composition/path-type.js";
export type { PathText, Glyph, KerningRule, ShapeOptions, GlyphItem, GlyphRun } from "./composition/type-glyphs.js";
export { pathText, bundledPathTexts, glyphOf, opticalKern, shapeRun, MAX_PATH_TEXT, OPTICAL_DEPTH, OPTICAL_CLEARANCE } from "./composition/type-glyphs.js";
export type { ContourSupply, BranchSupply, GestureSupply, PathSupply, PathSelection, SelectedPaths, BundledBranch } from "./composition/path-type-supply.js";
export { branchChains, gestureNaturalExtent, rankedPaths, supplyPaths, smoothPath, bundledBranchTree } from "./composition/path-type-supply.js";
export type { ColorBy as PathTypographyColorBy, PathTypographyComposition, GlyphMark, PathTypographyConsumers, TypographyProducts } from "./composition/path-type-draw.js";
export { pathTypographyComposition, pathTypographyProducts, glyphTone, glyphFill, glyphOutline, drawPathTypography, preparePathTypography,
  MAX_TYPE_FRAMES, MIN_STRAIGHTNESS, GESTURE_SPACING } from "./composition/path-type-draw.js";
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
export type { SpiralFamily, FrameOptions, SpiralOptions, LettersOptions, ScrollOptions, QuillScaffoldSpec } from "./composition/quill-scaffold.js";
export { quillScaffold, letterPaths, spiralPaths, scrollPaths, spiralFamilies, MAX_SCAFFOLD_POINTS } from "./composition/quill-scaffold.js";
export type { QuillTerminals, QuillCurl, QuillNestSide, QuillOverlap, QuillStripOptions, QuillStrip, NestStop, StripClash, QuillDiagnostics, QuillStrips } from "./composition/quill-strips.js";
export { quillStrips, rollPoints, subdivide, tightestBend, MAX_QUILL_VERTICES, MAX_QUILL_STRIPS, MAX_COIL_TURNS, MAX_CLASH_TESTS } from "./composition/quill-strips.js";
export type { QuillFaceKind, QuillGeometryOptions, QuillGeometry, QuillCamera, QuillFootprint, QuillProjection } from "./composition/quill-geometry.js";
export { quillGeometry, quillProjection, projectPoint, stripHeight, stripHeightFactor, stripSides, MAX_QUILL_FACES, MAX_PITCH, MIN_WALL } from "./composition/quill-geometry.js";
export type { QuillTone, QuillMaterialSpec, QuillView, QuilledPathsComposition, QuillFace, QuillFacePainter, QuillConsumers, QuillProducts } from "./composition/quill-draw.js";
export { quillComposition, quillProducts, quillCamera, quillPaper, drawQuilled, prepareQuilled } from "./composition/quill-draw.js";

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
  ...gestureScoresDefinitions, dataScoresDefinition, bundledRelationsDefinition, dryBristlesDefinition, ...sandDepositionDefinitions, crossingLaceDefinition, pathTypographyDefinition, quilledPathsDefinition, imageDirectedFieldDefinition, slitCompositionsDefinition, painterlySourceDefinition,
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
  "sand-deposition": [0x3b2f27, 0xb5522f, 0x1f5f73],
  "quilled-paths": [0xd4563f, 0xe6a23a, 0x2f7f86, 0x6f9a55, 0x8b5190],
  "data-scores": [0x1f2a33, 0xc4452b, 0x2f6f8f, 0xd9a441, 0x4f7a5c, 0x8a4a86],
  "path-typography": [0x1f2226, 0xc24a34, 0x2f6c8f, 0xb8862b],
  "image-directed-field": [0x1d2230, 0x8d3b2a, 0x2f6f7a, 0xc99a3b],
  "bundled-relations": [0x1f2a33, 0xc4452b, 0x2f6f8f, 0xd9a441, 0x4f7a5c, 0x8a4a86, 0x9c5f34],
  "dry-bristles": [0x22252b, 0x2f6f7a, 0xb8452f, 0xc99a3b],
  "substitution-tilings": [0x1f2733, 0xc4573b, 0xe3a93f, 0x2f7c78, 0x7d4d8f],
  "typographic-rhythm": [0x1c1d20, 0xc93a2a, 0x2b5d9b, 0xe6ae2c],
  "painterly-source": [0x2b2a33, 0xb8503a, 0xe0b458, 0x4d7c8a, 0xf0e6d2],
  "slit-compositions": [0x1d2733, 0xb5452e, 0xe0a13a, 0xf1e6cc],
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
  if (input.technique === "path-typography") return drawPathTypography(context, pathTypographyComposition(input));
  if (input.technique === "sand-deposition") return drawSandDeposition(context, sandDepositionComposition(input));
  if (input.technique === "quilled-paths") return drawQuilled(context, quillComposition(input));
  if (input.technique === "data-scores") return drawDataScores(context, dataScoresComposition(input));
  if (input.technique === "painterly-source") return drawPainterly(context, painterlyComposition(input));
  if (input.technique === "slit-compositions") return drawSlit(context, slitComposition(input));
  if (input.technique === "image-directed-field") return drawImageDirectedField(context, imageDirectedFieldComposition(input));
  if (input.technique === "crossing-lace") return drawCrossingLace(context, crossingLaceComposition(input));
  if (input.technique === "bundled-relations") return drawBundledRelations(context, bundledRelationsComposition(input));
  if (input.technique === "dry-bristles") return drawDryBristles(context, dryBristlesComposition(input));
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
  return referenceIds[id] === true || id === "branch-ornament" || id === "gesture-scores" || id === "data-scores" || id === "bundled-relations" || id === "dry-bristles" || id === "sand-deposition" || id === "crossing-lace" || id === "path-typography" || id === "quilled-paths" || id === "image-directed-field" || id === "slit-compositions" || id === "painterly-source" || externalDynamicsPreparable.has(id);
}

/** Cooperative cache warm-up; false means the caller cancelled before drawing. */
export async function prepareInstrument(input: InstrumentInput, cancelled: () => boolean): Promise<boolean> {
  definition(input.technique);
  if (input.technique === "branch-ornament")
    return prepareBranchOrnament(branchOrnamentComposition(input), cancelled);
  if (input.technique === "gesture-scores") return prepareGestureScore(gestureScoreComposition(input), cancelled);
  if (input.technique === "path-typography") return preparePathTypography(pathTypographyComposition(input), cancelled);
  if (input.technique === "image-directed-field") return prepareImageDirectedField(imageDirectedFieldComposition(input), cancelled);
  if (input.technique === "sand-deposition") return prepareSandDeposition(sandDepositionComposition(input), cancelled);
  if (input.technique === "quilled-paths") return prepareQuilled(quillComposition(input), cancelled);
  if (input.technique === "dry-bristles") return prepareDryBristles(dryBristlesComposition(input), cancelled);
  if (input.technique === "data-scores")
    return prepareDataScores(dataScoresComposition(input), cancelled);
  if (input.technique === "painterly-source") return preparePainterly(painterlyComposition(input), cancelled);
  if (input.technique === "slit-compositions") return prepareSlit(slitComposition(input), cancelled);
  if (input.technique === "crossing-lace") return prepareCrossingLace(crossingLaceComposition(input), cancelled);
  if (input.technique === "bundled-relations") return prepareBundledRelations(bundledRelationsComposition(input), cancelled);
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
    case "sand-deposition": return true;
    case "quilled-paths": return quillUsesSeed(q);
    case "gesture-scores": return q.recording === "wander" || Number(q.hairs) > 0 && q.bristles === true || q.sandMark !== "none" ||
      q.glyphMark !== "none" && (Number(q.glyphVariation) > 0 || Number(q.glyphRetention) < 1);
    case "optical-plates": return q.maskedPlate !== "none" && q.maskShape === "regions";
    case "data-scores": return dataScoresUsesSeed(q);
    case "path-typography": return pathTypographyUsesSeed(q);
    case "image-directed-field": return q.lines === true || q.mark !== "none" && (Number(q.markJitter) > 0 || Number(q.markVariation) > 0 || Number(q.markRetention) < 1);
    case "crossing-lace": return crossingLaceUsesSeed(q);
    case "bundled-relations": return bundledRelationsUsesSeed(q);
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
