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
import { riverRibbonsDefinition } from "./adapters/river-ribbons-instrument.js";
import { drawRiverRibbons, prepareRiverRibbonsDrawing, riverRibbonsComposition } from "./composition/river-draw.js";
import { riverUsesSeed } from "./composition/river.js";
import { cellDivisionDefinitions } from "./adapters/cell-division-instrument.js";
import { cellDivisionComposition, cellDivisionUsesSeed, drawCellDivision, prepareCellDivision } from "./composition/cell-division-draw.js";
import { laplacianFrontsDefinitions, laplacianFrontsUsesSeed } from "./adapters/laplacian-fronts-instrument.js";
import { drawLaplacianFronts, laplacianFrontsComposition, prepareLaplacianFronts } from "./composition/laplacian-fronts.js";
import { branchOrnamentComposition, drawBranchOrnament, prepareBranchOrnament } from "./composition/branch-ornament.js";
import { gestureScoresDefinitions } from "./adapters/gesture-scores-instruments.js";
import { drawGestureScore, gestureScoreComposition, prepareGestureScore } from "./composition/gesture-scores.js";
import { fmEngravingDefinition, fmEngravingUsesSeed } from "./adapters/fm-engraving-instrument.js";
import { drawEngraving, engravingComposition, prepareEngraving } from "./composition/engraving-draw.js";
import { dataScoresDefinition } from "./adapters/data-scores-instrument.js";
import { painterlySourceDefinition } from "./adapters/painterly-source-instrument.js";
import { drawPainterly, painterlyComposition, preparePainterly } from "./composition/painterly-draw.js";
import { imageDirectedFieldDefinition } from "./adapters/image-directed-field-instrument.js";
import { drawImageDirectedField, imageDirectedFieldComposition, prepareImageDirectedField } from "./composition/image-directed-field.js";
import { dataScoresComposition, dataScoresUsesSeed, drawDataScores, prepareDataScores } from "./composition/data-scores.js";
import { pixelSortingDefinition } from "./adapters/pixel-sorting-instrument.js";
import { drawPixelSorting, pixelSortingComposition, pixelSortingUsesSeed, preparePixelSorting } from "./composition/pixel-sorting.js";
import { shapePackingDefinition } from "./adapters/shape-packing-instrument.js";
import { drawShapePacking, prepareShapePacking, shapePackingComposition, shapePackingUsesSeed } from "./composition/shape-packing.js";
import { crossingLaceDefinition } from "./adapters/crossing-lace-instrument.js";
import { crossingLaceComposition, crossingLaceUsesSeed, drawCrossingLace, prepareCrossingLace } from "./composition/crossing-lace.js";
import { hyperbolicGardensDefinition } from "./adapters/hyperbolic-gardens-instrument.js";
import { meshAbstractionDefinition } from "./adapters/mesh-abstraction-instrument.js";
import { drawMeshAbstraction, meshAbstractionComposition, prepareMeshAbstraction } from "./composition/mesh-abstraction-draw.js";
import { meshAbstractionUsesSeed } from "./composition/mesh-abstraction.js";
import { surfaceGrowthDefinition } from "./adapters/surface-growth-instrument.js";
import { drawSurfaceGrowth, prepareSurfaceGrowthDrawing, surfaceGrowthComposition, surfaceGrowthUsesSeed } from "./composition/surface-growth-draw.js";
import { drawHyperbolicGardens, hyperbolicGardensComposition, hyperbolicGardensUsesSeed, prepareHyperbolicGardens } from "./composition/hyperbolic-draw.js";
import { visibilityDrawingDefinition } from "./adapters/visibility-drawing-instrument.js";
import { drawVisibilityDrawing, prepareVisibilityDrawing, visibilityDrawingComposition, visibilityDrawingUsesSeed } from "./composition/visibility-drawing.js";
import { quilledPathsDefinition } from "./adapters/quilled-paths-instrument.js";
import { drawQuilled, prepareQuilled, quillComposition, quillUsesSeed } from "./composition/quill-draw.js";
import { bundledRelationsDefinition } from "./adapters/bundled-relations-instrument.js";
import { bundledRelationsComposition, bundledRelationsUsesSeed, drawBundledRelations, prepareBundledRelations } from "./composition/bundled-relations.js";
import { dryBristlesDefinition } from "./adapters/dry-bristles-instrument.js";
import { drawDryBristles, dryBristlesComposition, prepareDryBristles } from "./composition/dry-bristles.js";
import { polygonWatercolorDefinition } from "./adapters/polygon-watercolor-instrument.js";
import { drawPolygonWatercolor, polygonWatercolorComposition, polygonWatercolorUsesSeed, preparePolygonWatercolor } from "./composition/polygon-watercolor.js";
import { collisionScoresDefinition } from "./adapters/collision-scores-instrument.js";
import { collisionScoresComposition, collisionScoresUsesSeed, drawCollisionScores, prepareCollisionScores } from "./composition/collision-draw.js";
import type { CompositionSurface } from "./composition/types.js";
import { graphRolesUsesSeed } from "./composition/graph-draw.js";
import { validateParameterValues } from "./parameter-validation.js";
import { typeRhythmUsesSeed } from "./adapters/type-rhythm-instrument.js";
import { slitCompositionsDefinition } from "./adapters/slit-compositions-instrument.js";
import { drawSlit, prepareSlit, slitComposition } from "./composition/slit-draw.js";
import { compartmentsUsesSeed } from "./adapters/compartments-instrument.js";
import { strokeReliefDefinition } from "./adapters/stroke-relief-instrument.js";
import { drawStrokeRelief, prepareStrokeRelief, strokeReliefComposition } from "./composition/stroke-relief.js";
import { inversionGardensDefinition } from "./adapters/inversion-gardens-instrument.js";
import { drawInversionGardens, inversionGardensComposition, inversionGardensUsesSeed, prepareInversionGardens } from "./composition/inversion-gardens.js";
import { pathTypographyDefinition, pathTypographyUsesSeed } from "./adapters/path-typography-instrument.js";
import { cyclicFrontsDefinition } from "./adapters/cyclic-fronts-instrument.js";
import { cyclicFrontsComposition, cyclicFrontsUsesSeed, drawCyclicFronts, prepareCyclicFronts } from "./composition/cyclic-fronts.js";
import { chemotacticTrailsDefinition } from "./adapters/chemotactic-trails-instrument.js";
import { chemotacticTrailsComposition, drawChemotacticTrails, prepareChemotacticTrails } from "./composition/chemotaxis-draw.js";
import { hingedPanelsDefinition } from "./adapters/hinged-panels-instrument.js";
import { drawHingedPanels, hingedPanelsComposition, hingedPanelsUsesSeed, prepareHingedPanels } from "./composition/hinge-draw.js";
import { drawPathTypography, pathTypographyComposition, preparePathTypography } from "./composition/path-type-draw.js";
import { drainageErosionDefinition } from "./adapters/drainage-erosion-instrument.js";
import { drainageErosionComposition, drawDrainageErosion, prepareDrainageErosion } from "./composition/drainage-draw.js";
import { drainageUsesSeed } from "./composition/drainage-settings.js";
import { nodalPlatesDefinition } from "./adapters/nodal-plates-instrument.js";
import { drawNodalPlate, nodalPlateComposition, nodalPlatesUsesSeed, prepareNodalPlate } from "./composition/nodal-draw.js";
import { patternCompetitionDefinition } from "./adapters/pattern-competition-instrument.js";
import { drawPatternCompetition, patternCompetitionComposition, patternCompetitionUsesSeed, preparePatternCompetition } from "./composition/pattern-draw.js";
import { glyphPackingDefinition, glyphPackingUsesSeed } from "./adapters/glyph-packing-instrument.js";
import { drawGlyphPacking, glyphPackingComposition, prepareGlyphPacking } from "./composition/glyph-pack-draw.js";
import { regionStitchDefinition, regionStitchUsesSeed } from "./adapters/region-stitch-instrument.js";
import { drawStitches, prepareStitches, regionStitchComposition } from "./composition/stitch-draw.js";
import { outlineTypeDefinition, outlineTypeUsesSeed } from "./adapters/outline-type-instrument.js";
import { drawOutlineType, outlineTypeComposition, prepareOutlineType } from "./composition/outline-type-draw.js";
import { valueRegionsDefinition } from "./adapters/value-regions-instrument.js";
import { drawValueRegions, prepareValueRegions, valueRegionsComposition, valueRegionsUsesSeed } from "./composition/value-regions-draw.js";
import { randomWalkFrontsDefinition } from "./adapters/random-walk-fronts-instrument.js";
import { drawWalkFronts, prepareRandomWalkFronts, randomWalkFrontsComposition } from "./composition/walk-fronts-draw.js";
import { wetPigmentDefinition, wetPigmentPalette } from "./adapters/wet-pigment-instrument.js";
import { drawWetPigment, prepareWetPigment, wetPigmentComposition, wetPigmentUsesSeed } from "./composition/wet-pigment-draw.js";
import { aggregationColoniesDefinition } from "./adapters/aggregation-colonies-instrument.js";
import { aggregationColoniesComposition, drawAggregationColonies, prepareAggregationColonies } from "./composition/aggregation-draw.js";

import { roadsParcelsDefinition } from "./adapters/roads-parcels-instrument.js";
import { drawRoadsParcels, prepareRoadsParcels, roadsParcelsComposition } from "./composition/roads-parcels.js";
import { roadsParcelsUsesSeed } from "./composition/roads-parcels-params.js";
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
export type { FitMode, ToneEncoding, ToneSource, ToneOptions, ToneField } from "./composition/engraving-tone.js";
export { toneField, areaAverage, BUNDLED_SOURCE_SIZE, TONE_LIMITS } from "./composition/engraving-tone.js";
export type { CarrierFamily, Carrier, CarrierOptions } from "./composition/engraving-carriers.js";
export { engravingCarriers, carrierFamilies, MAX_LINES, MAX_STATIONS as MAX_CARRIER_STATIONS, STATION } from "./composition/engraving-carriers.js";
export type { FootprintShape, ClipMode, EngravingOptions, EngravingSignal, EngravedLine, EngravingStats, EngravingLines } from "./composition/engraving.js";
export { engravedLines, engravingTone, toneSignal, shapedTone, ENGRAVING_LIMITS } from "./composition/engraving.js";
export type { LineKind, ColorBy as EngravingColorBy, EngravingLineSpec, EngravingComposition, EngravingConsumers } from "./composition/engraving-draw.js";
export { engravingComposition, engravingProducts, tonePieces, drawEngraving, prepareEngraving, TONE_BINS } from "./composition/engraving-draw.js";
export type { StitchFieldSpec, StitchFieldKind, StitchField } from "./composition/stitch-field.js";
export { stitchField, fieldKey as stitchFieldKey, stitchFieldKinds } from "./composition/stitch-field.js";
export type { StitchRegion, StitchFootprint, StitchWord, StitchSourceKind, RegionSourceSpec } from "./composition/stitch-regions.js";
export { bundledStitchRegions, stitchRegionsOf, regionBoundaries, stitchWords, stitchSourceKinds, STITCH_REGION_LIMITS } from "./composition/stitch-regions.js";
export type { Chain as StitchChain, Run as StitchRun, RouteOptions as StitchRouteOptions } from "./composition/stitch-route.js";
export { routeRuns, runningStitches, spanStitches, boundStitches, samplePolyline, polylineLength } from "./composition/stitch-route.js";
export type { FillRule as StitchFillRule, FillChoice as StitchFillChoice, UnderlayKind as StitchUnderlayKind, OutlineKind as StitchOutlineKind, CrossingKind as StitchCrossingKind,
  RegionOrder as StitchRegionOrder, ThreadRole as StitchThreadRole, StitchOptions, StitchThread, StitchRegionInfo, StitchStats, StitchProducts } from "./composition/stitch.js";
export { stitchThreads, stitchUsesSeed, estimateStitches, STITCH_LIMITS, INSIDE_TOLERANCE as STITCH_INSIDE_TOLERANCE, fillChoices as stitchFillChoices } from "./composition/stitch.js";
export type { StitchColorBy, StitchComposition, StitchThreadSpec, ThreadKind as StitchThreadKind, StitchTrim, StitchConsumers } from "./composition/stitch-draw.js";
export { regionStitchComposition, regionStitchProducts, stitchRuns, drawStitches, drawStitchProducts, prepareStitches } from "./composition/stitch-draw.js";
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
export type { RiverOptions, RiverConstruction, RiverPlanform, RiverState, RiverFrameData, OxbowRecord, RiverChannel, RiverOxbow, RiverFrame, RiverScene, RiverControl, RiverAgeField } from "./composition/river.js";
export { riverRibbons, prepareRiverRibbons, riverSnapshots, riverSimulation, riverConstruction, checkRiver, riverFields, riverTraces, oxbowPaths, riverAgeField, riverUsesSeed, isRiverCached, clearRiverCache,
  RIVER_LIMITS, MAX_SINUOSITY, MAX_NODES, END_ROOM, MAX_AGE_CELLS, MAX_AGE_WORK } from "./composition/river.js";
export type { Valley as RiverValley, Walls as RiverWalls, Cut as RiverCut, Loop as RiverLoop } from "./composition/river-model.js";
export { arcLengths as channelArcLengths, signedCurvature as channelCurvature, smoothCurvature as smoothChannelCurvature, kernelTaps as curvatureKernelTaps, dischargeAt, dischargeWidths,
  valleyOf as riverValley, migrationOffsets, easeAtWalls, confine as confineChannel, findCuts as findNeckCuts, applyCuts as applyNeckCuts, resample as resampleChannel, firstSelfCrossing,
  MAX_KERNEL_TAPS, LOOP_FACTOR, SETTLE_TOLERANCE, ANCHOR_WIDTHS, WALL_WIDTHS } from "./composition/river-model.js";
export type { RiverRibbonsComposition, RiverRibbon, RibbonPainter, RiverConsumers } from "./composition/river-draw.js";
export { riverRibbonsComposition, drawRiverRibbons, prepareRiverRibbonsDrawing, riverBanks, ribbonHalfWidths } from "./composition/river-draw.js";
export type { ColonyOptions as CellColonyOptions, Colony as CellColony, ColonyCell, ColonyFrame as CellColonyFrame, ColonyStatus as CellColonyStatus, CellBoundary, NutrientSource, SeedLayout as CellSeedLayout, DivisionAxis } from "./composition/cell-division.js";
export { cellColony, prepareCellColony, colonyAt, colonyFrameAt, colonyOptionsOf, colonyConstruction, colonyUsesSeed, validateColony, fieldSize, fieldLayout, diffusionPlan,
  cellDivisionSimulation, COLONY_LIMITS as CELL_COLONY_LIMITS, MAX_COLONY_WORK } from "./composition/cell-division.js";
export type { CellShape, ColorBy as CellColonyColorBy, CellDivisionComposition, CellDivisionConsumers, CellSite, CellWall } from "./composition/cell-division-draw.js";
export { cellDivisionComposition, cellDivisionProducts, cellSites as cellDivisionSites, lineagePaths, nutrientPaths, cellWalls, wallPaths, wallHatch, agedCells,
  drawCellDivision, prepareCellDivision, MAX_WALL_CELLS } from "./composition/cell-division-draw.js";
export type { LayoutSpec as GrowthLayoutSpec, GrowthLayout, SeedShape as GrowthSeedShape, SourceKind as GrowthSourceKind, SourceSide as GrowthSourceSide,
  SinkKind as GrowthSinkKind, BarrierKind as GrowthBarrierKind } from "./composition/laplacian-layout.js";
export { growthLayout, checkLayoutSpec as checkGrowthLayoutSpec, clusterCentres as growthClusterCentres, ringPoints as growthRingPoints,
  pillarCentres as growthPillarCentres, GROWTH_LIMITS, KIND_FREE as GROWTH_KIND_FREE, KIND_SOURCE as GROWTH_KIND_SOURCE, KIND_SINK as GROWTH_KIND_SINK,
  KIND_WALL as GROWTH_KIND_WALL, NOISE_LENGTH as GROWTH_NOISE_LENGTH } from "./composition/laplacian-layout.js";
export type { GrowthSpec as FrontGrowthSpec, PhysicsSpec, GrowthState, FrontFrame, GrowthSnapshots, GrowthDiagnostics, PotentialField, SolveReport, RateReport, StopReason } from "./composition/laplacian-growth.js";
export { solvePotential as solveLaplacePotential, jacobiRadius as growthJacobiRadius, frontRates as growthFrontRates, coverage as growthCoverage,
  growthSimulation, growthLimits, growthSnapshots, prepareGrowth, growthCached, checkGrowthSpec, lastActiveStep as growthLastActiveStep, growthDiagnostics,
  ringPaths as growthRingPaths, frontPaths as growthFrontPaths, frontOutlines as growthFrontOutlines, frontRings as growthFrontRings, occupiedRegion as growthOccupiedRegion,
  potentialField as growthPotentialField, equipotentialPaths as growthEquipotentialPaths, GROWTH_STEP_LIMIT, MAX_GROWTH_WORK, MAX_ITERATIONS as GROWTH_MAX_ITERATIONS,
  CHECKPOINT_EVERY as GROWTH_CHECKPOINT_EVERY } from "./composition/laplacian-growth.js";
export type { GrowthSite } from "./composition/laplacian-marks.js";
export { ageSites as growthAgeSites, tipSites as growthTipSites, boundaryPaths as growthBoundaryPaths, MIN_AGE_SPACING as GROWTH_MIN_AGE_SPACING } from "./composition/laplacian-marks.js";
export type { FrontStrokes, FillView as FrontsFillView, MarksView as FrontsMarksView, PotentialView as FrontsPotentialView, BoundaryView as FrontsBoundaryView, LaplacianFrontsComposition,
  FillBand, BandFill, LaplacianConsumers, LaplacianFrontsProducts } from "./composition/laplacian-fronts.js";
export { laplacianFrontsComposition, laplacianFrontsProducts, drawLaplacianFronts, prepareLaplacianFronts, frontSteps as growthFrontSteps, bandSteps as growthBandSteps,
  frontStrokes as growthFrontStrokes, ageRamp as growthAgeRamp, growthSeedOf, RAMP as GROWTH_AGE_RAMP, MAX_DRAWN_VERTICES as GROWTH_MAX_DRAWN_VERTICES,
  MAX_MARK_SITES as GROWTH_MAX_MARK_SITES } from "./composition/laplacian-fronts.js";
export type { Raster, RasterData, RasterChannels, RasterFormat, ColorSpace, AlphaMode, ConvertOptions, SampleFilter, EdgeRule, SampleOptions, ScalarGrid, LabelGrid,
  ValueKind, ValueOptions, RasterMapping, ResizeFilter } from "./composition/raster.js";
export { createRaster, rasterData, rasterPixel, convertRaster, sampleRaster, sampleInto, sampleGrid, createScalarGrid, valueField, rasterMapping, cropRaster,
  resizeRaster, srgbToLinear, linearToSrgb, LUMA, RASTER_LIMITS } from "./composition/raster.js";
export type { BundledRasterId } from "./composition/raster-samples.js";
export { bundledRaster, bundledRasterIds, bundledRasterInfo, BUNDLED_RASTER_SIZE } from "./composition/raster-samples.js";
export type { ImageSource, SegmentOptions, ValueRegion, RegionAdjacency, Segmentation, SubdivisionMetric, SplitPolicy, SubdivideOptions, ImageCell, Subdivision,
  OrientationOptions, OrientationSample, OrientationField, OrientationVectorOptions, ScanDirection, ScanOptions, ScanRun, RunSet, SortRunsOptions, PixelMoves,
  ApplyMovesOptions, FrequencyModulationOptions, ModulatedLine } from "./composition/image-structure.js";
export { segmentValueBands, valueRegionMask, subdivideImage, subdivisionLabels, orientationField, orientationPixel, orientationAt, orientationInRect, orientationGrids, orientationVector,
  scanRuns, scanRunPixel, scanRunSegment, sortScanRuns, applyPixelMoves, pixelSort, frequencyModulation, modulatedPolyline, smoothValues, IMAGE_STRUCTURE_LIMITS } from "./composition/image-structure.js";
export type { SourceFrame, TraceFigure, PathData, BristleSource } from "./composition/bristle-sources.js";
export { bristleSourcePaths, pathSet, traceFigures, contourFields, MAX_SOURCE_PATHS, MAX_SOURCE_POINTS } from "./composition/bristle-sources.js";
export type { DryBristlesComposition, DryBristlesConsumers, DryBristlesPlan } from "./composition/dry-bristles.js";
export { dryBristlesComposition, dryBristlesPlan, dryBristlesStrokes, drawDryBristles, prepareDryBristles } from "./composition/dry-bristles.js";
export type { PolygonWatercolorComposition, PolygonWatercolorConsumers, WashInk, WashPainter } from "./composition/polygon-watercolor.js";
export { polygonWatercolorComposition, polygonWatercolorParent, polygonWatercolorPasses, drawPolygonWatercolor, preparePolygonWatercolor, washPainter, washTone } from "./composition/polygon-watercolor.js";
export type { WashBoundary, WashDivergence, WashEdge, WashLaw, WashOptions, WashOutline, WashPass, WashPasses, WashPatches } from "./composition/wash.js";
export { WASH_LIMITS, checkWashOptions, prepareWashPasses, washLaw, washOffset, washOutline, washParent, washPassCount, washPasses, washPatch, washSide, washWork } from "./composition/wash.js";
export type { WashParent, WashPlacement, WashShape, WashWord } from "./composition/wash-shapes.js";
export { washParentDomain, washShapes, washWords } from "./composition/wash-shapes.js";
export type {
  TilingRuleName, TilingOptions, TilingTile, TilingVertex, TilingEdge, Tiling, TileFiller, TileFillSpec, TileColorMode, TilingView,
} from "./composition/types.js";
export { substitutionTiling, tilingRules, tilingEdgePaths, tileAncestorId, MAX_TILING_DEPTH, MAX_TILING_PIECES } from "./composition/tilings.js";
export { tileFill, tileTone, tonedTiles, tonedEdges, selectedVertices, shownTiles, insetPolygon, drawTiling } from "./composition/tiling-materials.js";
export { planarRegion, planarDomain, ringsDomain, locateInDomain, domainClearance, domainContains, domainRings, domainUnion, domainIntersection, domainDifference, domainXor,
  unionDomains, emptyDomain, rectangleRegion, rectangleDomain, textDomain, keyholeRing, keyholeJoin, keyholeRings, PlanarError, PLANAR_LIMITS } from "./composition/domains.js";
export type { PlanarRegion, PlanarDomain, PlanarRegionData, PlanarShape, PlanarOptions, RepairOptions, TextDomainOptions, DomainLocation, Fill, PlanarErrorCode } from "./composition/domains.js";
export { offsetDomain, sweepDomain, shadowDomain } from "./composition/domains-offset.js";
export type { OffsetOptions } from "./composition/domains-offset.js";
export { clipPath, clipPaths, hatchDomain, clipRingToRect } from "./composition/domains-paths.js";
export type { ClipOptions, ClippedPiece, HatchOptions, HatchStroke } from "./composition/domains-paths.js";
export { maskDomain, labelDomains, simplifyDomain, MASK_DOMAIN_LIMITS } from "./composition/domains-raster.js";
export type { MaskRaster, RasterOptions, MaskOptions, LabelOptions, LabelDomain } from "./composition/domains-raster.js";
export { regionsOverlap, regionInside, shapesOverlap, shapeCovers } from "./composition/domains-overlap.js";
export type { RingRegion } from "./composition/domains-overlap.js";
export type { PackShape, PackItem, PackItemsOptions, PieceFamily, LetterSet, ContainerKind, PackContainerSpec } from "./composition/shape-pieces.js";
export { PIECE_FAMILIES, LETTER_SETS, PACK_ITEM_LIMITS, CONTAINER_KINDS, CONTAINER_LETTERS, packItems, customItem, customShape, pieceShape, packContainer } from "./composition/shape-pieces.js";
export type { PackOrder, PackRule, PackRules, PackedInstance, UnplacedItem, PackStats, ShapePacking } from "./composition/shape-packing-layout.js";
export { PACK_LIMITS, packOrder, packShapes, packNegativeSpace } from "./composition/shape-packing-layout.js";
export type { PackColorBy as ShapePackColorBy, PackRender as ShapePackRender, ShapePackingLook, ShapePackingRecipe, PackSite, ShapePackingConsumers } from "./composition/shape-packing.js";
export { SHAPE_PACKING_LIMITS, shapePackingLayout, packedSites, drawShapePacking, prepareShapePacking, shapePackingComposition } from "./composition/shape-packing.js";
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
export type { PixelSortValue, PixelSortImage, PixelSortMask, PixelSortRuns, PixelSortMarks, PixelSortRecipe, PixelSortConstruction, RunRow, PixelSortStructure,
  MovedPixels, PixelStreak, PixelStreaks, StreakSite, PixelSortConsumers } from "./composition/pixel-sorting.js";
export { PIXEL_SORTING_LIMITS, pixelSortImage, pixelSortMask, dilateMask, pixelSortStructure, pixelSortRunAt, pixelSortRunTable, movedPixels, pixelSortStreaks,
  runOutline, pixelSortStreakSites, pixelSortRunPaths, drawPixelSorting, preparePixelSorting, pixelSortingComposition } from "./composition/pixel-sorting.js";
export type { RelationSample } from "./composition/bundle-samples.js";
export { relationSample, relationSampleIds, relationColumns } from "./composition/bundle-samples.js";
export type { RelationColumns, GroupAssignment, RelationData, EndpointOrder, SectorBasis, LayoutFrame, EndpointLayoutOptions, GroupPlacement, EndpointLayout, EdgeScope,
  BundleFamilies, BundleOptions, BundledPath, EdgeBundle, BundledEdges, FamilyHighlight } from "./composition/bundling.js";
export { relationsFromTables, layoutEndpoints, selectRelations, bundleEdges, groupBands, pathMarkers, highlightedEdges,
  MAX_BUNDLED_EDGES, MAX_BUNDLE_VERTICES, MAX_BUNDLE_DETAIL } from "./composition/bundling.js";
export type { BundledRelationsRecipe, BundledConsumers, BundledStructure } from "./composition/bundled-relations.js";
export { bundledStructure, drawBundledRelations, prepareBundledRelations, bundledRelationsComposition, WEIGHT_BANDS, MAX_MATERIAL_WORK } from "./composition/bundled-relations.js";
export type { TextSource, TypeLine } from "./composition/type-text.js";
export { textSource, bundledTextSources, typeLine, fillRings, CAP_HEIGHT, MAX_TEXT_LINES, MAX_LINE_CHARS } from "./composition/type-text.js";
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
export type { PixelRect, CompartmentMeasure, CompartmentOptions, Compartment, CompartmentNode, CompartmentPlan, KeepRule, CompartmentRegion } from "./composition/compartments.js";
export { compartmentPlan, coverCrop, keptCompartments, compartmentRegions, keepRules, COMPARTMENT_LIMITS } from "./composition/compartments.js";
export type { CompartmentFillKind, CompartmentColor, CompartmentFiller, CompartmentGlyphSpec, CompartmentBorderSpec, CompartmentFillSpec, CompartmentInk,
  CompartmentImage, CompartmentsComposition } from "./composition/compartments-draw.js";
export { compartmentFiller, compartmentFillKind, compartmentAngle, compartmentInk, nearestPaletteIndex, hatchSegments, halftoneCentres, hatchSpacing, halftoneRadius,
  boundCompartmentWork, compartmentSource, compartmentOptions, compartmentDrawRegions, drawCompartments, prepareCompartments, MIN_COHERENCE, MAX_COMPARTMENT_UNITS } from "./composition/compartments-draw.js";
export type { ValueMeasure, ValueBandRule, ValueMergePolicy, ValueRegionOptions, ValueRegionNeighbor, ValueRegionShape, ValueRegionArc, ValueRegionAdjacency, ValueRegionMap,
  ValueRetainRule } from "./composition/value-regions.js";
export { valueRegionMap, keptValueRegions, valueRetainRules, valueMeasures, VALUE_REGION_LIMITS } from "./composition/value-regions.js";
export type { ValueRegionFillKind, ValueRegionColor, ValueNestedKind, ValueNestedMaterial, ValueRegionHatchSpec, ValueRegionNestedSpec, ValueRegionFillSpec, ValueRegionOutlineSpec,
  ValueRegionSelect, DrawnValueRegion, ValueRegionFiller, ValueRegionConsumers, ValueRegionImage, ValueRegionsRecipe } from "./composition/value-regions-draw.js";
export { valueRegionFillValid, valueRegionOutlineValid, insetValueRegion, drawnValueRegions, valueRegionInk, valueRegionHatchSpacing, valueRegionHatchAngle, valueRegionHatch,
  valueRegionFiller, valueRegionOutline, boundValueRegionWork, valueRegionSource, valueRegionOptions, valueRegionsOf, drawValueRegions, prepareValueRegions,
  valueRegionsComposition, valueRegionsUsesSeed, MIN_VALUE_REGION_ELONGATION, MAX_VALUE_REGION_UNITS } from "./composition/value-regions-draw.js";
export type { StrokeData, ReliefStroke, StrokeSet, StrokeFrame, DepositionOrder } from "./composition/strokes.js";
export { strokeSet, strokeData, strokesFromPaths, strokeFromGesture, placeStrokes, scaleWidths, depositionOrder, depositionOrders, paintMass, STROKE_LIMITS } from "./composition/strokes.js";
export type { BundledStrokeId } from "./composition/stroke-samples.js";
export { bundledStrokes, bundledStrokeIds, bundledStrokeInfo } from "./composition/stroke-samples.js";
export type { CrossSection, Overlap, ReliefGrid, DepositOptions as ReliefDepositOptions, StrokeRelief, DepositControl, ReliefNormals, Light, ShadeMaterial, ShadeBand, ShadedPatch } from "./composition/relief.js";
export { depositHeight, depositWork, reliefGrid, crossSectionProfile, pigmentField, reliefNormals, normalAt, lightVector, shadeSlope, shadeField, shadeRelief,
  crossSections, overlaps, MAX_RELIEF_CELLS, MAX_DEPOSIT_PAIRS, MAX_PATCH_VERTICES, footprintWeight, SHADE_LEVELS, PATCH_ALPHA } from "./composition/relief.js";
export type { ReliefSource, ReliefView, ColorBy as ReliefColorBy, StrokeReliefComposition, StrokeReliefConsumers, StrokeReliefProducts } from "./composition/stroke-relief.js";
export { strokeReliefComposition, sourceStrokes, strokeTones, strokeReliefProducts, reliefColors, flatRibbon, shadedPatch, drawStrokeRelief, prepareStrokeRelief } from "./composition/stroke-relief.js";
export type { ErosionParams, ErosionState, ErosionProjection, ErosionSnapshots } from "./composition/drainage-erosion.js";
export { erosionSimulation, erosionCache, erodedTerrain, checkErosionWork, creepSubsteps, terrainVolume, hasSettled, MAX_EROSION_STEPS, MAX_EROSION_WORK, MAX_CREEP_SUBSTEPS,
  CHECKPOINT_EVERY as EROSION_CHECKPOINT_EVERY } from "./composition/drainage-erosion.js";
export type { OutletMode, FilledSurface } from "./composition/drainage-flow.js";
export { outletMask, fillDepressions, flowReceivers, accumulateFlow, EPSILON as FILL_EPSILON, MAX_GRID_CELLS as MAX_TERRAIN_CELLS } from "./composition/drainage-flow.js";
export type { TerrainShape, TerrainSpec, RainMode, RainSpec, BedrockKind, BedrockSpec } from "./composition/terrain.js";
export { initialTerrain, rainField, bedrockField, terrainShapes, rainModes, bedrockKinds } from "./composition/terrain.js";
export type { ContourGrid } from "./composition/grid-contours.js";
export { gridContours, MAX_CONTOUR_VERTICES } from "./composition/grid-contours.js";
export type { DrainageSpec, Drainage, GridFrame, StreamNode, StreamReach, StreamOptions, StreamNetwork, Basin, BasinMap } from "./composition/drainage-network.js";
export { analyzeDrainage, streamNetwork, drainageBasins, MAX_STREAM_CELLS } from "./composition/drainage-network.js";
export { hillshadePatch, lakeDomain, basinColors } from "./composition/drainage-shade.js";
export type { DrainageView, Footprint as DrainageFootprint, StreamStyle, BasinStyle, MarkSet as DrainageMarkSet, MarkKind as DrainageMarkKind } from "./composition/drainage-settings.js";
export { footprintFor as drainageFootprint, erosionParamsFor, viewFor as drainageView } from "./composition/drainage-settings.js";
export type { DrainageErosionComposition, BasinGeometry, DrainageProducts, DrainageConsumers } from "./composition/drainage-draw.js";
export { drainageErosionComposition, drainageErosionProducts, drawDrainageErosion, prepareDrainageErosion, terrainContours, streamRibbon, simulationSeed as drainageSimulationSeed,
  MAX_CONTOUR_LEVELS, MAX_HATCH_STROKES } from "./composition/drainage-draw.js";
export type { ArcTable, ArcPoint } from "./composition/path-arc.js";
export { arcTable, arcPointAt, arcTurn, arcSpan, closedRing } from "./composition/path-arc.js";
export type { AdvanceItem, Crowding, CurvaturePolicy, PathsLayoutOptions, RepeatPolicy, ReadingDirection, DropReason, Adaptation, PathLayoutOptions, PathFrame, DroppedItem, LayoutReport,
  PathLayout, DisruptionOptions, DisruptedFrames } from "./composition/path-type.js";
export { layoutAlongPath, layoutPaths, readableSpans, SPAN_STEP, disruptFrames, cleanPath, MAX_LAYOUT_ITEMS, MAX_COLLISION_WORK, MIN_CONDENSE } from "./composition/path-type.js";
export type { PathText, Glyph, KerningRule, ShapeOptions, GlyphItem, GlyphRun } from "./composition/type-glyphs.js";
export { pathText, bundledPathTexts, glyphOf, opticalKern, shapeRun, MAX_PATH_TEXT, OPTICAL_DEPTH, OPTICAL_CLEARANCE } from "./composition/type-glyphs.js";
export type { ContourSupply, BranchSupply, GestureSupply, PathSupply, PathSelection, SelectedPaths, BundledBranch } from "./composition/path-type-supply.js";
export { branchChains, gestureNaturalExtent, rankedPaths, supplyPaths, smoothPath, bundledBranchTree } from "./composition/path-type-supply.js";
export type { ColorBy as PathTypographyColorBy, PathTypographyComposition, GlyphMark, PathTypographyConsumers, TypographyProducts } from "./composition/path-type-draw.js";
export { pathTypographyComposition, pathTypographyProducts, glyphTone, glyphFill, glyphOutline, drawPathTypography, preparePathTypography,
  MAX_TYPE_FRAMES, MIN_STRAIGHTNESS, GESTURE_SPACING, SPAN_CAPS } from "./composition/path-type-draw.js";
export type { FlatRing, FlatRegion, Tally } from "./composition/domains-contact.js";
export { flatRing, transformRing, segmentsContact, ringsContact, regionsContact, locateInFlatRing, ringWithin } from "./composition/domains-contact.js";
export type { GlyphPart, GlyphSource, SymbolInput, VocabularyEntry, GlyphVocabulary, CounterPolicy, FlatPart, Footprint, BundledSymbolId, BundledVocabularyId } from "./composition/glyph-sources.js";
export { wordSource, symbolSource, bundledSymbol, bundledSymbolIds, glyphVocabulary, bundledVocabulary, bundledVocabularyIds, footprintOf, MAX_SOURCE_TEXT } from "./composition/glyph-sources.js";
export type { BundledContainerId, ContainerPlacement, NegativeKind, NegativeSpec, PackingField } from "./composition/glyph-containers.js";
export { bundledContainerIds, containerSilhouette, placeContainer, negativeSpace, noNegativeSpace, packingField } from "./composition/glyph-containers.js";
export type { OrientationRule, Orientation, PackOptions, GlyphInstance, UnplacedReason, Unplaced, PackingStats, GlyphPacking, Demand } from "./composition/glyph-pack.js";
export { GLYPH_PACKING_LIMITS, validatePack, pickEntry, planDemands, packGlyphs, instanceInk } from "./composition/glyph-pack.js";
export type { GlyphColorBy, ContainerShown, GlyphPackingComposition, GlyphMark as GlyphPackMark, GlyphPackingConsumers, GlyphPackingProducts } from "./composition/glyph-pack-draw.js";
export { glyphPackingComposition, glyphPackingProducts, glyphTone as packedGlyphTone, glyphFill as packedGlyphFill, glyphOutline as packedGlyphOutline,
  drawGlyphPacking, prepareGlyphPacking } from "./composition/glyph-pack-draw.js";
export type { OutlineText, OutlineUnitKind, OutlineLayoutOptions, OutlineGlyph, OutlineLine, OutlineLayout, OutlineUnit, OutlineDisplacement, OutlineDisplacementSpec } from "./composition/outline-type.js";
export { outlineText, bundledOutlineTexts, outlineLayout, outlineUnits, displacementField, deformDomain, displaceUnits, MAX_OUTLINE_LINES, MAX_OUTLINE_LINE_CHARS, MAX_DISPLACED_VERTICES } from "./composition/outline-type.js";
export type { OutlineFillKind, OutlineFillSpec, OutlineFillShape, OutlineFillMark, OutlineFill, OutlineFillContext, OutlineFiller } from "./composition/outline-type-fill.js";
export { outlineFillerFor, validateOutlineFill, resolveOutlineFillKind, OUTLINE_MIXED_KINDS } from "./composition/outline-type-fill.js";
export type { OutlineTypeColorBy, OutlineTypeComposition, OutlineUnitProduct, OutlineTypeProducts, OutlineTypeConsumers } from "./composition/outline-type-draw.js";
export { outlineTypeComposition, outlineTypeProducts, outlineTone, trimPath, fillMaterial, drawOutlineType, prepareOutlineType,
  MAX_FILL_PATHS, MAX_FILL_POINTS, MAX_FILL_MARKS, MAX_OUTLINE_STATIONS } from "./composition/outline-type-draw.js";
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
export type { HyperbolicOptions, HyperbolicCenter, HyperbolicTile, HyperbolicVertex, HyperbolicEdge, HyperbolicTiling } from "./composition/hyperbolic.js";
export { hyperbolicTiling, hyperbolicEdgePaths, hyperbolicCellPaths, retainCells, geodesicPolyline, curvePolyline, MAX_HYPERBOLIC_TILES, MAX_HYPERBOLIC_GENERATIONS, MAX_DISK_RADIUS, EDGE_TOLERANCE } from "./composition/hyperbolic.js";
export type { HyperbolicFrame, HyperbolicRing, HyperbolicRingAround, HyperbolicFrameOptions, HyperbolicRingOptions } from "./composition/hyperbolic-frames.js";
export { hyperbolicFrames, hyperbolicRings, MAX_HYPERBOLIC_FRAMES, MAX_HYPERBOLIC_ARCS } from "./composition/hyperbolic-frames.js";
export type { Vec3 as HyperbolicVec3, Mat3 as HyperbolicMat3, TriangleGroup, MirrorAddress, DiskFrame } from "./composition/hyperbolic-geometry.js";
export { triangleGroup, mirrorAddress, addressMatrix, frameOf, toDisk, fromDisk, validateSchlafli, MAX_HYPERBOLIC_X0, IDENTITY as HYPERBOLIC_IDENTITY,
  apply as applyHyperbolic, mul as composeHyperbolic, inverse as invertHyperbolic, det as hyperbolicDeterminant, lorentz as lorentzProduct,
  along as geodesicPoint, distance as hyperbolicDistance } from "./composition/hyperbolic-geometry.js";
export type { HyperbolicColorBy, HyperbolicCellFill, HyperbolicMark, HyperbolicMotifColor, HyperbolicGardensComposition, HyperbolicConsumers, HyperbolicProducts } from "./composition/hyperbolic-draw.js";
export { hyperbolicGardensComposition, hyperbolicProducts, hyperbolicTone, hatchPolygon, MAX_HATCH_LINES_PER_CELL, drawHyperbolicGardens, drawHyperbolicProducts, prepareHyperbolicGardens } from "./composition/hyperbolic-draw.js";
export type { SpiralFamily, FrameOptions, SpiralOptions, LettersOptions, ScrollOptions, QuillScaffoldSpec } from "./composition/quill-scaffold.js";
export { quillScaffold, letterPaths, spiralPaths, scrollPaths, spiralFamilies, MAX_SCAFFOLD_POINTS } from "./composition/quill-scaffold.js";
export type { QuillTerminals, QuillCurl, QuillNestSide, QuillOverlap, QuillStripOptions, QuillStrip, NestStop, StripClash, QuillDiagnostics, QuillStrips } from "./composition/quill-strips.js";
export { quillStrips, rollPoints, subdivide, tightestBend, MAX_QUILL_VERTICES, MAX_QUILL_STRIPS, MAX_COIL_TURNS, MAX_CLASH_TESTS } from "./composition/quill-strips.js";
export type { QuillFaceKind, QuillGeometryOptions, QuillGeometry, QuillCamera, QuillFootprint, QuillProjection } from "./composition/quill-geometry.js";
export { quillGeometry, quillProjection, projectPoint, stripHeight, stripHeightFactor, stripSides, MAX_QUILL_FACES, MAX_PITCH, MIN_WALL } from "./composition/quill-geometry.js";
export type { QuillTone, QuillMaterialSpec, QuillView, QuilledPathsComposition, QuillFace, QuillFacePainter, QuillConsumers, QuillProducts } from "./composition/quill-draw.js";
export { quillComposition, quillProducts, quillCamera, quillPaper, drawQuilled, prepareQuilled } from "./composition/quill-draw.js";
export type { ChemotaxisEmitter, ChemotaxisConstruction, ChemotaxisFrame, ChemotaxisSnapshots, ChemicalField, ChemotaxisTrail, TrailOptions, ChemotaxisAgent } from "./composition/chemotaxis.js";
export { CHEMOTAXIS_ARENA, CHEMOTAXIS_LIMITS, SENSE_FLOOR, FIELD_EPSILON, checkChemotaxis, chemotaxisStepWork, chemotaxisSimulation, chemotaxisCache, chemotaxisRunOptions, chemotaxisSnapshots, prepareChemotaxis, runChemotaxis, chemicalField,
  chemotaxisTrails, chemotaxisAgents, contourLevels, fieldContourPaths, fieldBands, sampleField, relaxField, barrierMask, totalAgents } from "./composition/chemotaxis.js";
export type { EmitterLayout, BarrierKind, EmitterLayoutOptions, BarrierOptions, ColonyControls } from "./composition/chemotaxis-layouts.js";
export { emitterLayout, bundledBarrier, colonyGeometry, barrierBlocks, emitterLayouts, barrierKinds, barrierThickness } from "./composition/chemotaxis-layouts.js";
export type { ChemotacticTrailsComposition, ChemotacticConsumers, ChemotacticProducts } from "./composition/chemotaxis-draw.js";
export { chemotacticTrailsComposition, chemotacticProducts, chemotacticSnapshots, drawChemotacticTrails, prepareChemotacticTrails } from "./composition/chemotaxis-draw.js";
export type { PanelSource, PanelPoint, PanelTilingOptions, Panel, Hinge, PanelTiling, PanelPolygonsInput, PanelEdgePiece } from "./composition/hinge-tiling.js";
export { panelTiling, panelTilingFromPolygons, panelBoundaryEdges, MAX_PANELS, PANEL_SOURCES, PENROSE_PATCHES } from "./composition/hinge-tiling.js";
export type { FoldRule, FoldFieldOptions, ClosureOptions, HingeKind, HingeReport, FoldCounts, FoldedPanels } from "./composition/hinge-fold.js";
export { hingeAngles, foldPanels, panelPoint, panelNormal, MAX_FOLD_ANGLE, ANGLE_TOLERANCE, MAX_ANCHORS, FOLD_RULES, AXIS_WINDOW } from "./composition/hinge-fold.js";
export type { PosedMeshOptions, PosedPanels } from "./composition/hinge-mesh.js";
export { posedPanels, MAX_GAP, MAX_THICKNESS } from "./composition/hinge-mesh.js";
export type { HingedTreatment, HingedFill, HingedColorBy, HingedLines, HingedMotif, HingedPanelsComposition, HingedConsumers, HingedProducts, HingedView } from "./composition/hinge-draw.js";
export { hingedPanelsComposition, hingedProducts, hingedPosed, hingedCamera, hingedView, hingedCurves, panelTones, LINE_TONE, drawHingedPanels, drawHingedProducts, prepareHingedPanels } from "./composition/hinge-draw.js";
export type { GrowthSeed, GrowthSeedKind, GrowthPins } from "./composition/growth-seeds.js";
export { GROWTH_SEED_KINDS, GROWTH_SEED_LIMITS, growthSeed, bundledGrowthSeed, sphereLevels } from "./composition/growth-seeds.js";
export type { GrowthRegion, GrowthCombine, GrowthFieldSpec, GrowthField, GridFieldInput } from "./composition/growth-field.js";
export { GROWTH_FIELD_LIMITS, growthField, gridGrowthField, boundaryDistance, stripeValue } from "./composition/growth-field.js";
export type { GrowthControls, GrowthPin, GrowthFrame, GrowthSnapshots, GrowthRunOptions, GrownSurface } from "./composition/surface-growth.js";
export { GROWTH_LIMITS, GROWTH_PINS, GROWTH_RETENTION, REFINE_PASSES, CHECKPOINT_EVERY, SETTLED, checkGrowth, growthStepWork, growthTables, hingeAngle, surfaceGrowthSimulation, surfaceGrowthCache, surfaceGrowthSnapshots, prepareSurfaceGrowth, grownSurface } from "./composition/surface-growth.js";
export type { GrowthFieldKind, SurfaceGrowthConstruction } from "./composition/surface-growth-controls.js";
export { GROWTH_FIELD_KINDS, growthConstruction, checkSurfaceGrowthControls } from "./composition/surface-growth-controls.js";
export type { SurfaceGrowthComposition, SurfaceGrowthConsumers, ColorBy as SurfaceGrowthColorBy } from "./composition/surface-growth-draw.js";
export { surfaceGrowthComposition, surfaceGrowthUsesSeed, growthSources, surfaceGrowthRun, prepareSurfaceGrowthDrawing, surfaceGrowthCamera, surfacePaintOrder, surfaceContourPaths, surfaceWirePaths, surfaceLevelValues, surfaceLevelPaths, surfaceGrains, withAlpha, drawSurfaceGrowth } from "./composition/surface-growth-draw.js";
export type { Simulation, SimulationContext, SimulationLimits, Snapshots, HistoryEntry, Frozen, RunOptions as SimulationRunOptions,
  AsyncRunOptions as SimulationAsyncRunOptions, SimulationCacheOptions } from "./composition/snapshots.js";
export { runSimulation, prepareSimulation, resumeSimulation, stateAt, finalState, projectionAt, checkSimulation, createSimulationCache, SimulationCache,
  SimulationCancelledError, elementId, SNAPSHOT_LIMITS, SeededStream, cloneState, countValues, freezeCopy, identical, canonicalKey } from "./composition/snapshots.js";
export type { PointGridOptions, PointHit } from "./composition/spatial-index.js";
export { PointGrid, MAX_GRID_CELLS } from "./composition/spatial-index.js";
export type { LatticeWalkOptions, LatticeStep, AngleWalkOptions, AngleStep } from "./composition/walks.js";
export { latticeWalkStep, angleWalkStep, LATTICE_DIRECTIONS } from "./composition/walks.js";
export type { WallSet as CollisionWalls } from "./composition/collision-walls.js";
export { buildWalls, timeToSegment, timeToReach, insideContainer, distanceToWalls, wallsNear, APPROACH_EPS } from "./composition/collision-walls.js";
export type { Bodies as CollisionBodyArrays, Physics as CollisionPhysics, PairOutcome, WallOutcome, FrameLimits } from "./composition/collision-solver.js";
export { pairLaw, wallLaw, solveFrame, EVENT, EVENT_STRIDE, KIND_PAIR, KIND_WALL, KIND_EMIT, REST_SPEED, TIE } from "./composition/collision-solver.js";
export type { ContainerShape, BarrierKind as CollisionBarrierKind, ContainerSpec, EmitterFootprint } from "./composition/collision-containers.js";
export { bundledContainer, containerRings, containerShapes, barrierKinds as collisionBarrierKinds, barriers as collisionBarriers } from "./composition/collision-containers.js";
export type { EmitterMode, MassLaw, CollisionBodies, CollisionEmitter, CollisionSetup, CollisionModel, CollisionState, CollisionFrame, CollisionBody, CollisionTrail,
  Contact as CollisionContact, CollisionScore, CollisionRunOptions } from "./composition/collision.js";
export { collisionModel, collisionSimulation, collisionSnapshots, prepareCollisionSnapshots, hasCollisionSnapshots, collisionScore, collisionScoreOfModel,
  emitterModes, COLLISION_LIMITS } from "./composition/collision.js";
export type { CollisionColorBy, CollisionView, CollisionScoresRecipe, ContactSite, DiscSite, TrailPath, CollisionConsumers } from "./composition/collision-draw.js";
export { collisionScoresComposition, collisionScoresUsesSeed, collisionScoreOfRecipe, drawCollisionScores, prepareCollisionScores } from "./composition/collision-draw.js";
export type { CyclicRule, CyclicConstruction, CyclicState, CyclicStep, InitialSpec, ObstacleSpec, NeighbourhoodShape, StampName } from "./composition/cyclic-rule.js";
export { cyclicSimulation, neighbourOffsets, obstacleRuns, lettersObstacle, checkConstruction as checkCyclicConstruction, CYCLIC_LIMITS, WALL as CYCLIC_WALL } from "./composition/cyclic-rule.js";
export type { CyclicGrid, CyclicFrame, GridGeometry, StateRegion, FrontPath, FrontOptions, CoreSite } from "./composition/cyclic-structure.js";
export { cyclicGrid, gridGeometry, stateRegions, frontPaths, spiralCores, cellSites, stateCounts, MAX_SMOOTHING } from "./composition/cyclic-structure.js";
export type { CyclicInk, CyclicParams } from "./composition/cyclic-params.js";
export type { CyclicFrontsComposition, CyclicFrontsConsumers, CyclicFrontsProducts, CyclicSummary, CyclicSnapshots } from "./composition/cyclic-fronts.js";
export { cyclicFrontsComposition, cyclicFrontsProducts, cyclicSnapshots, hasCyclicSnapshots, cyclicSummary, statePalette, stateHatch, drawCyclicFronts, prepareCyclicFronts, CYCLIC_DRAW_UNITS } from "./composition/cyclic-fronts.js";
export type { NodalShape, NodalEdge, ModeFunction } from "./composition/nodal-modes.js";
export { besselJ, besselJPrime, besselPair, besselZero, rectangleMode, circleMode, NODAL_MAX_INDEX } from "./composition/nodal-modes.js";
export type { NodalMode, NodalFieldOptions, NodalResolvedMode, NodalGrid, NodalField, NodalSiteOptions, NodalSite, NodalSiteSet } from "./composition/nodal-plate.js";
export { nodalField, nodalPaths, nodalSites, nodalSiteSet, nodalBands, nodalDistance, nodalProximity, NODAL_LIMITS } from "./composition/nodal-plate.js";
export type { NodalComposition, NodalConsumers } from "./composition/nodal-draw.js";
export { nodalPlateComposition, drawNodalPlate, prepareNodalPlate } from "./composition/nodal-draw.js";
export type { PatternModel, PatternScale, PatternState, PatternProjection, PatternSnapshots, PatternView, PatternFrame, PatternContourOptions, PatternPath, PatternSiteOptions, PatternSite, PatternBandOptions, PatternBand, PatternBoundary, PatternSymmetry, PatternStart, SymmetryOrbits } from "./composition/pattern-competition.js";
export { patternSimulation, patternSnapshots, preparePatternSnapshots, patternView, patternCompetingFields, patternScales, patternStepWork, checkPatternModel, patternFrame, patternContours, patternSites, patternBands, symmetryOrbits, scaleTone as patternScaleTone, PATTERN_LIMITS, PATTERN_BOUNDARIES, PATTERN_SYMMETRIES, PATTERN_STARTS } from "./composition/pattern-competition.js";
export type { PatternCompetitionComposition, PatternConsumers, PatternProducts } from "./composition/pattern-draw.js";
export { patternCompetitionComposition, patternRecipeSnapshots, patternProducts, drawPatternCompetition, preparePatternCompetition } from "./composition/pattern-draw.js";
export type { Cline, ClineShape, CircleInversion, Frame as InversionFrame, Segment as InversionSegment, Circle as InversionCircleCurve, Arc as InversionArc,
  Constraint as ClineConstraint } from "./composition/inversion.js";
export { circleCline, lineCline, clineValue, clineDot, clineShape, circleInversion, invertPoint, invertCline, invertFrame, segmentIntervals, circleIntervals,
  arcThrough, arcSteps, sampleArc, circumcircle, LINE_CURVATURE } from "./composition/inversion.js";
export type { GasketOptions, GasketCircle, GasketDual, Gasket } from "./composition/inversion-gasket.js";
export { apollonianGasket, tangencyPoint, GASKET_LIMITS } from "./composition/inversion-gasket.js";
export type { SourceKind, SourceOptions, SourceChain, SourceCircle, SourceSite, Source as InversionSource } from "./composition/inversion-sources.js";
export { sourceGeometry, SOURCE_KINDS, GLYPHS as INVERSION_GLYPHS } from "./composition/inversion-sources.js";
export type { Arrangement, OrbitRule, OrbitOptions, OrbitCircle, OrbitImage, GardenPath, GardenDisc, GardenSite, Orbit } from "./composition/inversion-orbit.js";
export { orbitCircles, orbitImages, wordConstraints, inWordDomain, parseWord, ORBIT_LIMITS } from "./composition/inversion-orbit.js";
export type { Construction, GardenOptions, GardenImage, Garden } from "./composition/inversion-garden.js";
export { gardenProducts, orbitOptions, GARDEN_LIMITS } from "./composition/inversion-garden.js";
export type { ColorBy as GardenColorBy, OriginalMode, StrokeStyle as GardenStrokeStyle, FillKind, MarkKind, InversionGardensComposition, DiscFiller, GardenConsumers } from "./composition/inversion-gardens.js";
export { inversionGardensComposition, inversionGardensProducts, inversionGardensUsesSeed, gardenSource, gardenTone, discFill, markSites, drawInversionGardens, drawInversionGardensProducts,
  prepareInversionGardens } from "./composition/inversion-gardens.js";
export type { CornerAttributes, Vec3, Mesh, MeshInput, MeshAttributeInput, MeshAttributeInfo, MeshMeasures, MeshTransform, AttributeDomain, DegeneratePolicy } from "./composition/mesh.js";
export { mesh, isMesh, meshData, meshVertex, meshFace, meshAttribute, meshMeasures, faceNormal, faceArea, vertexNormals, meshCornerAttributes, transformMesh, mergeMeshes, boxMesh, MESH_LIMITS } from "./composition/mesh.js";
export type { MeshTopology, MeshTopologyCounts, MeshKind, MeshEdgeClass, MeshVertexClass, MeshComponentSummary, MeshFeatureOptions, MeshFeatureEdge } from "./composition/mesh-topology.js";
export { meshTopology, meshEdgeId, meshEdgeVertices, meshEdgeFaces, meshEdgeClass, meshEdgeAngle, findMeshEdge, meshFaceNeighbors, meshVertexClass, meshVertexFanCount,
  meshComponentOfFace, meshComponents, meshCreaseEdges, meshBoundaryEdges, meshFaceFacing, meshSilhouetteEdges, meshFeatureEdges } from "./composition/mesh-topology.js";
export type { Camera, CameraOptions, Projection, ProjectedVertex } from "./composition/camera.js";
export { camera, DEFAULT_CAMERA } from "./composition/camera.js";
export type { PointCloud, PointCloudInput, PointAttributeInput, SurfaceSampleOptions, SurfaceSamples, ProjectedPoint, ProjectOptions } from "./composition/mesh-sample.js";
export { pointCloud, isPointCloud, pointCloudData, pointPosition, pointId, pointSeed, pointAttribute, selectPoints, thinPointCloud, cropPointCloud, meshVertexCloud,
  sampleSurface, sampleSource, projectPoints, POINT_LIMITS } from "./composition/mesh-sample.js";
export type { SpatialCurve, VisibilityOptions, HiddenLineOptions, ProjectedPath, VisibilityStats, HiddenLineResult, PaintOptions, PaintOrder } from "./composition/visibility.js";
export { hiddenLines, visiblePoints, meshEdgeCurves, paintOrder, MAX_VISIBILITY_SEGMENTS, DEFAULT_VISIBILITY_WORK } from "./composition/visibility.js";
export type { TorusOptions, TerrainOptions, TerrainVariant, VaseProfile, VaseOptions, BundledMeshId, BundledMeshInfo, MeshSource, PointSource } from "./composition/mesh-samples.js";
export { icosphereMesh, torusMesh, terrainMesh, terrainHeight, vaseMesh, figureMesh, bundledMesh, bundledMeshIds, bundledMeshInfo, terrainVariants, vaseProfiles, vaseProfileNames,
  resolveMeshSource, resolvePointSource, MAX_ICOSPHERE_LEVELS } from "./composition/mesh-samples.js";
export type { WalkGrid, WalkShapeName, WalkMaskSource, WalkBarrier, WalkRegions } from "./composition/walk-grid.js";
export { walkGrid, walkRegions, nearestAllowedCell, walkShapeNames, WALK_GRID_LIMITS } from "./composition/walk-grid.js";
export type { WalkRules, WalkSeeding, SeedLayout, WalkRevisit, WalkTransition, WalkEnd, FrontsField, FrontsSeed, FrontsWalker, FrontsSnapshots } from "./composition/walk-fronts.js";
export { walkFronts, runWalkFronts, prepareWalkFrontsSnapshots, frontsField, frontsSimulation, checkWalkRules, WALK_FRONT_LIMITS } from "./composition/walk-fronts.js";
export type { FrontsFrame, Territory, BandDomain, CellRuns, HatchOptions as FrontsHatchOptions, SiteOptions as FrontsSiteOptions } from "./composition/walk-fronts-products.js";
export { territoryDomains, bandDomains, cellRuns, frontContours, territoryOutlines, territoryHatching, frontSites, bandCount, FRONT_PRODUCT_LIMITS } from "./composition/walk-fronts-products.js";
export type { FrontsView, FillKind as FrontsFillKind, LineKind as FrontsLineKind, RandomWalkFrontsComposition, RandomWalkFrontsConsumers, FrontsProducts } from "./composition/walk-fronts-draw.js";
export { randomWalkFrontsComposition, randomWalkFrontsProducts, drawWalkFronts, prepareRandomWalkFronts } from "./composition/walk-fronts-draw.js";
export type { ContourEnd, LevelTies, ContourNode, ContourCurve, SectionPlane, PlaneFrame, SectionOptions, SectionLoop, MeshSection, MeshSlices, SlicePlaneOptions,
  SectionDomainOptions, IsoOptions, IsoCurve, IsoContours } from "./composition/mesh-section.js";
export { planeFrame, sectionMesh, sliceMesh, sliceCurves, slicePlanes, sectionDomain, isoContours, SECTION_LIMITS, DEFAULT_SECTION_WORK } from "./composition/mesh-section.js";
export type { WetMaskSpec, WetBoundary, WetLayout, WetModel, WetSite, WetAccounting, WetState, WetFrame, WetEnvironment, WetSnapshots } from "./composition/wet-pigment.js";
export { WET_LIMITS, wetPigmentSimulation, wetPigmentSnapshots, prepareWetPigmentSnapshots, wetEnvironment, wetMaskDomain, checkWetModel, wetWork } from "./composition/wet-pigment.js";
export type { WetPigmentComposition, PigmentBands, DryingFronts, WetFilm, WetPigmentProducts, WetPigmentConsumers } from "./composition/wet-pigment-draw.js";
export { wetPigmentComposition, wetPigmentProducts, pigmentBands, dryingFronts, wetFilm, pigmentFills, frontLines, filmSheen, bandAlpha, drawWetPigment,
  prepareWetPigment, wetPigmentUsesSeed, MAX_FRONTS, MAX_BANDS } from "./composition/wet-pigment-draw.js";
export { WET_WORDS } from "./adapters/wet-pigment-instrument.js";
export { DomainWalls } from "./composition/domain-walls.js";
export type { SeedShape, SourceShape, SeedSpec, SourceSpec, ColonyDomainSpec, WalkerSpec, GrowthSpec, ColonyOptions, ColonySite, ColonyStatus, Colony,
  ColonyParams, ColonyState, ColonyFrame, Box as ColonyBox } from "./composition/aggregation.js";
export { growColony, prepareColony, colonyIsCached, colonyReleasePoint, colonySimulation, colonyDomain, colonyParams, colonyCache, checkColonyOptions, checkColonySteps, colonyWorkBound, domainPaths,
  COLONY_LIMITS } from "./composition/aggregation.js";
export type { ColonyColorBy, ColonyView, AggregationColoniesRecipe, ColonyConsumers, LinkLayer } from "./composition/aggregation-draw.js";
export { aggregationColoniesComposition, drawAggregationColonies, prepareAggregationColonies, colonyOfRecipe, colonyMarkSites, colonyTipSites, colonyLinkPaths,
  colonyTone, massFraction, shownGrains, colonyColorings } from "./composition/aggregation-draw.js";
export type { RoadFieldKind, RoadFieldOptions, RoadField } from "./composition/road-field.js";
export { roadField } from "./composition/road-field.js";
export type { RoadGrowthParams, RoadState, RoadProgress, RoadJunction, DeadEndPolicy, ReserveShape } from "./composition/road-growth.js";
export { roadSimulation, validateRoadGrowth, ROAD_LIMITS } from "./composition/road-growth.js";
export type { RoadKind, RoadStreet, RoadPlacement, RoadNetwork, RoadSnapshots } from "./composition/road-network.js";
export { growRoads, prepareRoads, roadNetwork, roadFaces, roadsCached, CHECKPOINT_EVERY as ROAD_CHECKPOINT_EVERY } from "./composition/road-network.js";
export type { RoadHierarchy, RoadWidths, BlockOptions, LotOptions, UnbuiltRule, TypeRule, RoadBlock, RoadBlocks, LotFrame, ParcelRole, Parcel, RoadParcels } from "./composition/road-parcels.js";
export { roadBlocks, roadParcels, prepareBlocks, prepareParcels, roadClass, classWidth, lotFrame, MAX_BLOCKS, MAX_PARCELS } from "./composition/road-parcels.js";
export type { LotFill, RoadsParcelsComposition, RoadsParcelsConsumers, RoadsParcelsProducts } from "./composition/roads-parcels.js";
export { roadsParcelsComposition, roadsParcelsProducts, roadPaths, drawRoadsParcels, prepareRoadsParcels } from "./composition/roads-parcels.js";
export { roadGrowthParams, validateRoadsParcels } from "./composition/roads-parcels-params.js";
export type { MeshRegion, Axis as MeshAxis } from "./composition/mesh-region.js";
export { regionImportance, checkRegion, MAX_SEEDED_REGIONS } from "./composition/mesh-region.js";
export type { SimplifyParams, SimplifyProjection, SimplifyOptions, Abstraction, StopReason, BlockReason, SimplifyRule, BoundaryMode } from "./composition/mesh-simplify.js";
export { simplifyMesh, prepareSimplification, abstractionAt, simplifySimulation, simplifyRetention, maxValence, SIMPLIFY_LIMITS, MIN_NORMAL_DOT, MIN_VALENCE_CAP, CONSTRAINT_WEIGHT, IMPORTANCE_BIAS } from "./composition/mesh-simplify.js";
export type { MeshAbstractionComposition, MeshAbstractionProducts, MeshAbstractionConstruction, AbstractionView, AbstractionSource, ViewSpec as AbstractionViewSpec, ViewProducts as AbstractionViewProducts } from "./composition/mesh-abstraction.js";
export { meshAbstractionProducts, meshViewProducts as abstractionViewProducts, abstractionCamera, sourceDescriptor as abstractionSourceDescriptor } from "./composition/mesh-abstraction.js";
export type { MeshAbstractionConsumers, FacetPaint } from "./composition/mesh-abstraction-draw.js";
export { meshAbstractionComposition, drawMeshAbstraction, prepareMeshAbstraction } from "./composition/mesh-abstraction-draw.js";
export type { VisibilityShape, VisibilityField, VisibilitySceneOptions } from "./composition/visibility-scenes.js";
export { visibilityShapes, visibilityFields, visibilityMesh, visibilityField, assemblyMesh, meanCurvature, maxSceneDetail as maxVisibilitySceneDetail, sceneUsesSeed as visibilitySceneUsesSeed } from "./composition/visibility-scenes.js";
export type { CreaseRule, SectionRule, ContourRule, SectionAxis, SectionSet, ContourSet, ConstructionCounts, Convexity as CreaseConvexity } from "./composition/visibility-features.js";
export { creaseEdges as visibilityCreaseEdges, boundaryEdges as visibilityBoundaryEdges, silhouetteEdges as visibilitySilhouetteEdges, edgeCurves as visibilityEdgeCurves, creaseCurvesExcluding,
  sectionCurves as visibilitySectionCurves, contourCurves as visibilityContourCurves, sectionNormal, constructionCounts as visibilityConstructionCounts, VISIBILITY_LIMITS } from "./composition/visibility-features.js";
export type { ViewRule, CurvePaths, LightRule, HatchRule, HatchResult, PaintedFaces, DepthRange, CuePiece } from "./composition/visibility-view.js";
export { viewCamera, curvePaths as visibilityCurvePaths, tonedHatch, paintedFaces, triangleLit, triangleFacing, lightDirection, darkness as toneDarkness, depthRange, cueBin, splitByDepth,
  closedSolid, MAX_HATCH_SEGMENTS, CUE_STEPS } from "./composition/visibility-view.js";
export type { ClassName as VisibilityClassName, ClassMode as VisibilityClassMode, LineMaterial as VisibilityLineMaterial, Shading as VisibilityShading, DepthCue as VisibilityDepthCue,
  ColorBy as VisibilityColorBy, ClassStyle as VisibilityClassStyle, VisibilityDrawingRecipe, ClassProduct as VisibilityClassProduct, VisibilityProducts, VisibilityConsumers } from "./composition/visibility-drawing.js";
export { visibilityDrawingComposition, visibilityProducts, drawVisibilityProducts, drawVisibilityDrawing, prepareVisibilityDrawing, classNames as visibilityClassNames, classTone as visibilityClassTone, cueFactor } from "./composition/visibility-drawing.js";

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
  ...gestureScoresDefinitions, dataScoresDefinition, bundledRelationsDefinition, dryBristlesDefinition, ...sandDepositionDefinitions, crossingLaceDefinition, pathTypographyDefinition, quilledPathsDefinition, imageDirectedFieldDefinition, slitCompositionsDefinition, strokeReliefDefinition, fmEngravingDefinition, painterlySourceDefinition, pixelSortingDefinition, nodalPlatesDefinition, glyphPackingDefinition, polygonWatercolorDefinition, shapePackingDefinition, regionStitchDefinition, inversionGardensDefinition, outlineTypeDefinition, valueRegionsDefinition, randomWalkFrontsDefinition, chemotacticTrailsDefinition, hyperbolicGardensDefinition, wetPigmentDefinition, cyclicFrontsDefinition, riverRibbonsDefinition, patternCompetitionDefinition, aggregationColoniesDefinition, collisionScoresDefinition, ...cellDivisionDefinitions, drainageErosionDefinition, roadsParcelsDefinition, hingedPanelsDefinition, ...laplacianFrontsDefinitions, meshAbstractionDefinition, visibilityDrawingDefinition, surfaceGrowthDefinition,
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
  if (id === "wet-pigment") return [...wetPigmentPalette];
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
  "fm-engraving": [0x1d2733, 0xb5452e, 0xd39a3a, 0x2f6f8f],
  "sand-deposition": [0x3b2f27, 0xb5522f, 0x1f5f73],
  "cell-division": [0x2b3a55, 0x2f6f8f, 0x4f9a8a, 0xd9a441, 0xc4452b],
  "laplacian-fronts": [0x1f2733, 0xb5452e, 0xe0a13a, 0x2f7f8f],
  "quilled-paths": [0xd4563f, 0xe6a23a, 0x2f7f86, 0x6f9a55, 0x8b5190],
  "data-scores": [0x1f2a33, 0xc4452b, 0x2f6f8f, 0xd9a441, 0x4f7a5c, 0x8a4a86],
  "pixel-sorting": [0x1c2230, 0x8a3b32, 0xd9a441, 0xf1e6cf],
  "shape-packing": [0x1f2a33, 0xc4452b, 0x2f6f8f, 0xd9a441, 0x4f7a5c],
  "path-typography": [0x1f2226, 0xc24a34, 0x2f6c8f, 0xb8862b],
  "glyph-packing": [0x1e2228, 0xb8452f, 0x2f6f7a, 0xd9a441],
  "outline-type": [0x20232a, 0x2b7a83, 0xc9493a, 0xb98524, 0x7d4a8a, 0x5b7f3b, 0x3d5a9e],
  "image-directed-field": [0x1d2230, 0x8d3b2a, 0x2f6f7a, 0xc99a3b],
  "bundled-relations": [0x1f2a33, 0xc4452b, 0x2f6f8f, 0xd9a441, 0x4f7a5c, 0x8a4a86, 0x9c5f34],
  "dry-bristles": [0x22252b, 0x2f6f7a, 0xb8452f, 0xc99a3b],
  "polygon-watercolor": [0x2f6f8f, 0xc4573b, 0xd9a441, 0x4f7a5c],
  "aggregation-colonies": [0x243b4a, 0x3f7f7a, 0xd9a441, 0xc4452b, 0x8a4a86],
  "substitution-tilings": [0x1f2733, 0xc4573b, 0xe3a93f, 0x2f7c78, 0x7d4d8f],
  "typographic-rhythm": [0x1c1d20, 0xc93a2a, 0x2b5d9b, 0xe6ae2c],
  "painterly-source": [0x2b2a33, 0xb8503a, 0xe0b458, 0x4d7c8a, 0xf0e6d2],
  "slit-compositions": [0x1d2733, 0xb5452e, 0xe0a13a, 0xf1e6cc],
  "nodal-plates": [0x1c2430, 0xb8452f, 0x2f6f8f, 0xd9a441, 0x4f7a5c],
  "pattern-competition": [0x1c2430, 0xb8452f, 0xd9a441, 0x4f7a5c, 0x2f6f8f],
  "adaptive-compartments": [0x1f2733, 0xc4573b, 0xe3a93f, 0x2f7c78, 0xefe6d2],
  "connected-value-regions": [0x231f24, 0xb5452e, 0xe0a13a, 0x2f6f7a, 0xefe6d2],
  "stroke-relief": [0x2b2019, 0xc4452b, 0x2f6f8f, 0xd9a441, 0x4f7a5c],
  "crossing-lace": [0x1f2a33, 0xc4452b, 0x2f6f8f, 0xd9a441, 0x4f7a5c],
  "collision-scores": [0x1f2733, 0xc4452b, 0x2f7f8f, 0xd9a441, 0x5d8a55, 0x8b5190],
  "cyclic-fronts": [0x1c2b4f, 0x2e8b9d, 0xe6be5a, 0xd9553b, 0x8a2f7a],
  "river-ribbons": [0x1f5f73, 0x6b5636, 0x2f7f86, 0xc9a86a],
  "drainage-erosion": [0x2b2622, 0x2f6f8f, 0xd6a45a, 0x8ea15a, 0xc46a4a, 0x6f8fa3],
  "region-stitch": [0x2b2a33, 0xb8503a, 0xe0b458, 0x4d7c8a, 0x7f9a4f, 0x8b4a6f],
  "inversion-gardens": [0x1d2733, 0xc4452b, 0x2f6f8f, 0xd9a441, 0x4f7a5c, 0x8a4a86],
  "random-walk-fronts": [0xc4452b, 0xe0a13a, 0x2f7f86, 0x6f9a55, 0x8b5190, 0x1f2733],
  "chemotactic-trails": [0x1f3040, 0xc4452b, 0xd9a441, 0x2f7a86, 0x6a8f4a],
  "hyperbolic-gardens": [0x1f2733, 0xc4573b, 0xe3a93f, 0x2f7c78, 0x7d4d8f],
  "roads-parcels": [0x1f2a33, 0xb5452e, 0xd08a20, 0x2f7c78, 0x7d4d8f],
  "hinged-panels": [0x252a33, 0xd9694a, 0xecb654, 0x3f8f8b, 0x8a6bb0],
  "mesh-abstraction": [0xd8cbb0, 0x1f2733, 0xc4452b, 0x2f7c78],
  "visibility-drawing": [0x1c2430, 0xb85c3a, 0x2f6f86, 0x6b7f3b, 0x8a5a8c],
  "surface-growth": [0x1d2a2f, 0xe6d3b0, 0xd8894f, 0x9b3d3d, 0x3f6f6c],
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
  if (input.technique === "cyclic-fronts") return drawCyclicFronts(context, cyclicFrontsComposition(input));
  if (input.technique === "aggregation-colonies") return drawAggregationColonies(context, aggregationColoniesComposition(input));
  if (input.technique === "gesture-scores") return drawGestureScore(context, gestureScoreComposition(input));
  if (input.technique === "path-typography") return drawPathTypography(context, pathTypographyComposition(input));
  if (input.technique === "glyph-packing") return drawGlyphPacking(context, glyphPackingComposition(input));
  if (input.technique === "outline-type") return drawOutlineType(context, outlineTypeComposition(input));
  if (input.technique === "sand-deposition") return drawSandDeposition(context, sandDepositionComposition(input));
  if (input.technique === "river-ribbons") return drawRiverRibbons(context, riverRibbonsComposition(input));
  if (input.technique === "cell-division") return drawCellDivision(context, cellDivisionComposition(input));
  if (input.technique === "laplacian-fronts") return drawLaplacianFronts(context, laplacianFrontsComposition(input));
  if (input.technique === "quilled-paths") return drawQuilled(context, quillComposition(input));
  if (input.technique === "data-scores") return drawDataScores(context, dataScoresComposition(input));
  if (input.technique === "pixel-sorting") return drawPixelSorting(context, pixelSortingComposition(input));
  if (input.technique === "shape-packing") return drawShapePacking(context, shapePackingComposition(input));
  if (input.technique === "connected-value-regions") return drawValueRegions(context, valueRegionsComposition(input));
  if (input.technique === "fm-engraving") return drawEngraving(context, engravingComposition(input));
  if (input.technique === "painterly-source") return drawPainterly(context, painterlyComposition(input));
  if (input.technique === "slit-compositions") return drawSlit(context, slitComposition(input));
  if (input.technique === "nodal-plates") return drawNodalPlate(context, nodalPlateComposition(input));
  if (input.technique === "pattern-competition") return drawPatternCompetition(context, patternCompetitionComposition(input));
  if (input.technique === "stroke-relief") return drawStrokeRelief(context, strokeReliefComposition(input));
  if (input.technique === "drainage-erosion") return drawDrainageErosion(context, drainageErosionComposition(input));
  if (input.technique === "image-directed-field") return drawImageDirectedField(context, imageDirectedFieldComposition(input));
  if (input.technique === "crossing-lace") return drawCrossingLace(context, crossingLaceComposition(input));
  if (input.technique === "region-stitch") return drawStitches(context, regionStitchComposition(input));
  if (input.technique === "hyperbolic-gardens") return drawHyperbolicGardens(context, hyperbolicGardensComposition(input));
  if (input.technique === "mesh-abstraction") return drawMeshAbstraction(context, meshAbstractionComposition(input));
  if (input.technique === "visibility-drawing") return drawVisibilityDrawing(context, visibilityDrawingComposition(input));
  if (input.technique === "surface-growth") return drawSurfaceGrowth(context, surfaceGrowthComposition(input));
  if (input.technique === "bundled-relations") return drawBundledRelations(context, bundledRelationsComposition(input));
  if (input.technique === "dry-bristles") return drawDryBristles(context, dryBristlesComposition(input));
  if (input.technique === "collision-scores") return drawCollisionScores(context, collisionScoresComposition(input));
  if (input.technique === "roads-parcels") return drawRoadsParcels(context, roadsParcelsComposition(input));
  if (input.technique === "polygon-watercolor") return drawPolygonWatercolor(context, polygonWatercolorComposition(input));
  if (input.technique === "inversion-gardens") return drawInversionGardens(context, inversionGardensComposition(input));
  if (input.technique === "random-walk-fronts") return drawWalkFronts(context, randomWalkFrontsComposition(input));
  if (input.technique === "chemotactic-trails") return drawChemotacticTrails(context, chemotacticTrailsComposition(input));
  if (input.technique === "wet-pigment") return drawWetPigment(context, wetPigmentComposition(input));
  if (input.technique === "hinged-panels") return drawHingedPanels(context, hingedPanelsComposition(input));
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
  return referenceIds[id] === true || id === "branch-ornament" || id === "gesture-scores" || id === "pixel-sorting" || id === "data-scores" || id === "bundled-relations" || id === "dry-bristles" || id === "sand-deposition" || id === "crossing-lace" || id === "path-typography" || id === "quilled-paths" || id === "image-directed-field" || id === "slit-compositions" || id === "stroke-relief" || id === "fm-engraving" || id === "painterly-source" || id === "nodal-plates" || id === "glyph-packing" || id === "polygon-watercolor" || id === "shape-packing" || id === "region-stitch" || id === "inversion-gardens" || id === "outline-type" || id === "connected-value-regions" || id === "random-walk-fronts" || id === "chemotactic-trails" || id === "hyperbolic-gardens" || id === "wet-pigment" || id === "cyclic-fronts" || id === "river-ribbons" || id === "pattern-competition" || id === "aggregation-colonies" || id === "collision-scores" || id === "cell-division" || id === "drainage-erosion" || id === "roads-parcels" || id === "hinged-panels" || id === "laplacian-fronts" || id === "mesh-abstraction" || id === "visibility-drawing" || id === "surface-growth" || externalDynamicsPreparable.has(id);
}

/** Cooperative cache warm-up; false means the caller cancelled before drawing. */
export async function prepareInstrument(input: InstrumentInput, cancelled: () => boolean): Promise<boolean> {
  definition(input.technique);
  if (input.technique === "branch-ornament")
    return prepareBranchOrnament(branchOrnamentComposition(input), cancelled);
  if (input.technique === "gesture-scores") return prepareGestureScore(gestureScoreComposition(input), cancelled);
  if (input.technique === "cyclic-fronts") return prepareCyclicFronts(cyclicFrontsComposition(input), cancelled);
  if (input.technique === "aggregation-colonies") return prepareAggregationColonies(aggregationColoniesComposition(input), cancelled);
  if (input.technique === "fm-engraving") return prepareEngraving(engravingComposition(input), cancelled);
  if (input.technique === "path-typography") return preparePathTypography(pathTypographyComposition(input), cancelled);
  if (input.technique === "glyph-packing") return prepareGlyphPacking(glyphPackingComposition(input), cancelled);
  if (input.technique === "outline-type") return prepareOutlineType(outlineTypeComposition(input), cancelled);
  if (input.technique === "image-directed-field") return prepareImageDirectedField(imageDirectedFieldComposition(input), cancelled);
  if (input.technique === "sand-deposition") return prepareSandDeposition(sandDepositionComposition(input), cancelled);
  if (input.technique === "river-ribbons") return prepareRiverRibbonsDrawing(riverRibbonsComposition(input), cancelled);
  if (input.technique === "cell-division") return prepareCellDivision(cellDivisionComposition(input), cancelled);
  if (input.technique === "laplacian-fronts") return prepareLaplacianFronts(laplacianFrontsComposition(input), cancelled);
  if (input.technique === "quilled-paths") return prepareQuilled(quillComposition(input), cancelled);
  if (input.technique === "dry-bristles") return prepareDryBristles(dryBristlesComposition(input), cancelled);
  if (input.technique === "polygon-watercolor") return preparePolygonWatercolor(polygonWatercolorComposition(input), cancelled);
  if (input.technique === "random-walk-fronts") return prepareRandomWalkFronts(randomWalkFrontsComposition(input), cancelled);
  if (input.technique === "wet-pigment") return prepareWetPigment(wetPigmentComposition(input), cancelled);
  if (input.technique === "data-scores")
    return prepareDataScores(dataScoresComposition(input), cancelled);
  if (input.technique === "pixel-sorting") return preparePixelSorting(pixelSortingComposition(input), cancelled);
  if (input.technique === "shape-packing") return prepareShapePacking(shapePackingComposition(input), cancelled);
  if (input.technique === "connected-value-regions") return prepareValueRegions(valueRegionsComposition(input), cancelled);
  if (input.technique === "painterly-source") return preparePainterly(painterlyComposition(input), cancelled);
  if (input.technique === "slit-compositions") return prepareSlit(slitComposition(input), cancelled);
  if (input.technique === "nodal-plates") return prepareNodalPlate(nodalPlateComposition(input), cancelled);
  if (input.technique === "pattern-competition") return preparePatternCompetition(patternCompetitionComposition(input), cancelled);
  if (input.technique === "stroke-relief") return prepareStrokeRelief(strokeReliefComposition(input), cancelled);
  if (input.technique === "drainage-erosion") return prepareDrainageErosion(drainageErosionComposition(input), cancelled);
  if (input.technique === "crossing-lace") return prepareCrossingLace(crossingLaceComposition(input), cancelled);
  if (input.technique === "collision-scores") return prepareCollisionScores(collisionScoresComposition(input), cancelled);
  if (input.technique === "region-stitch") return prepareStitches(regionStitchComposition(input), cancelled);
  if (input.technique === "hyperbolic-gardens") return prepareHyperbolicGardens(hyperbolicGardensComposition(input), cancelled);
  if (input.technique === "mesh-abstraction") return prepareMeshAbstraction(meshAbstractionComposition(input), cancelled);
  if (input.technique === "visibility-drawing") return prepareVisibilityDrawing(visibilityDrawingComposition(input), cancelled);
  if (input.technique === "surface-growth") return prepareSurfaceGrowthDrawing(surfaceGrowthComposition(input), cancelled);
  if (input.technique === "bundled-relations") return prepareBundledRelations(bundledRelationsComposition(input), cancelled);
  if (input.technique === "roads-parcels") return prepareRoadsParcels(roadsParcelsComposition(input), cancelled);
  if (input.technique === "inversion-gardens") return prepareInversionGardens(inversionGardensComposition(input), cancelled);
  if (input.technique === "chemotactic-trails") return prepareChemotacticTrails(chemotacticTrailsComposition(input), cancelled);
  if (input.technique === "hinged-panels") return prepareHingedPanels(hingedPanelsComposition(input), cancelled);
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
    case "cyclic-fronts": return cyclicFrontsUsesSeed(q);
    case "river-ribbons": return riverUsesSeed({ planform: q.planform as "wandering", amplitude: Number(q.amplitude), heterogeneity: Number(q.heterogeneity) });
    case "cell-division": return cellDivisionUsesSeed(q);
    case "drainage-erosion": return drainageUsesSeed(q);
    case "nodal-plates": return nodalPlatesUsesSeed(q);
    case "pattern-competition": return patternCompetitionUsesSeed(q);
    case "laplacian-fronts": return laplacianFrontsUsesSeed(q);
    case "quilled-paths": return quillUsesSeed(q);
    case "gesture-scores": return q.recording === "wander" || Number(q.hairs) > 0 && q.bristles === true || q.sandMark !== "none" ||
      q.glyphMark !== "none" && (Number(q.glyphVariation) > 0 || Number(q.glyphRetention) < 1);
    case "optical-plates": return q.maskedPlate !== "none" && q.maskShape === "regions";
    case "data-scores": return dataScoresUsesSeed(q);
    case "pixel-sorting": return pixelSortingUsesSeed(q);
    case "polygon-watercolor": return polygonWatercolorUsesSeed(q);
    case "shape-packing": return shapePackingUsesSeed(q);
    case "connected-value-regions": return valueRegionsUsesSeed(q);
    case "fm-engraving": return fmEngravingUsesSeed(q);
    case "wet-pigment": return wetPigmentUsesSeed(q);
    case "path-typography": return pathTypographyUsesSeed(q);
    case "glyph-packing": return glyphPackingUsesSeed(q);
    case "outline-type": return outlineTypeUsesSeed(q);
    case "image-directed-field": return q.lines === true || q.mark !== "none" && (Number(q.markJitter) > 0 || Number(q.markVariation) > 0 || Number(q.markRetention) < 1);
    case "crossing-lace": return crossingLaceUsesSeed(q);
    case "collision-scores": return collisionScoresUsesSeed(q);
    case "hyperbolic-gardens": return hyperbolicGardensUsesSeed(q);
    case "hinged-panels": return hingedPanelsUsesSeed(q);
    case "mesh-abstraction": return meshAbstractionUsesSeed(q);
    case "visibility-drawing": return visibilityDrawingUsesSeed(q);
    case "surface-growth": return surfaceGrowthUsesSeed(q);
    case "bundled-relations": return bundledRelationsUsesSeed(q);
    case "roads-parcels": return roadsParcelsUsesSeed(q);
    case "region-stitch": return regionStitchUsesSeed(q);
    case "inversion-gardens": return inversionGardensUsesSeed(q);
    case "substitution-tilings":
      return Number(q.retention) > 0 && Number(q.retention) < 1 || q.interior === "wash" && Number(q.bleed) > 0 ||
        q.interior !== "none" && q.colorBy === "supertile";
    case "typographic-rhythm": return typeRhythmUsesSeed(q);
    case "adaptive-compartments": return compartmentsUsesSeed(q);
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
