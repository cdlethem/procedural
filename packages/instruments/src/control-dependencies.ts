import type { InstrumentDefinition, Parameter } from "./types.js";

export type ControlCondition = NonNullable<Parameter["visibleWhen"]>;

/**
 * Which controls depend on which selections, for instruments whose adapters predate conditional
 * controls. An entry names an instrument and, for each dependent control, the `visibleWhen`
 * condition to attach (see `visibility.ts` for the contract). Entries authored with an inline
 * `visibleWhen` never appear here; naming a control that already has one is an error, so a
 * control has exactly one source of truth.
 *
 * Every condition below is backed by measurement: `tests/helpers/audit-controls.ts` changes the
 * control under each combination of the instrument's discrete selections and records whether the
 * drawing changes, and `tests/conditional-controls.test.ts` re-checks the result on random
 * configurations.
 */
// BEGIN GENERATED (tests/helpers/generate-control-dependencies.ts; do not edit by hand)
export const controlDependencies: Readonly<Record<string, Readonly<Record<string, ControlCondition>>>> = {
  "agent-trails": {
    "aspect": { "sourceMode": ["area","ring","grid"] },
    "linkDotSize": { "dotMarks": [true], "links": [true] },
    "linkWeight": { "links": [true] },
    "nodeSize": { "nodes": [true] },
    "radius": { "openChains": [false] },
    "trailStride": { "trails": [true] },
    "trailWeight": { "trails": [true] },
    "velocityScale": { "showVelocities": [true] },
    "velocityWeight": { "showVelocities": [true] },
  },
  "annular-marks": {
    "ambient": { "faces": [true] },
    "colorMode": { "visibleCells": { "gte": 1 } },
    "depth": [{ "edges": [true], "visibleCells": { "gte": 1 } }, { "faces": [true], "visibleCells": { "gte": 1 } }],
    "directional": { "faces": [true] },
    "inner": [{ "faces": [true], "showTop": [true] }, { "visibleCells": { "gte": 1 } }],
    "lightAzimuth": { "faces": [true] },
    "lightElevation": { "faces": [true] },
    "noiseDepth": { "colorMode": ["noise"] },
    "noiseScale": { "colorMode": ["noise"] },
    "offsetX": [{ "edges": [true], "visibleCells": { "gte": 1 } }, { "faces": [true], "visibleCells": { "gte": 1 } }],
    "offsetY": [{ "edges": [true], "visibleCells": { "gte": 1 } }, { "faces": [true], "visibleCells": { "gte": 1 } }],
    "outer": [{ "edges": [true], "visibleCells": { "gte": 1 } }, { "faces": [true], "visibleCells": { "gte": 1 } }],
    "pitch": [{ "edges": [true], "visibleCells": { "gte": 1 } }, { "faces": [true], "visibleCells": { "gte": 1 } }],
    "roll": [{ "edges": [true], "visibleCells": { "gte": 1 } }, { "faces": [true], "visibleCells": { "gte": 1 } }],
    "showBottom": [{ "edges": [true], "visibleCells": { "gte": 1 } }, { "faces": [true], "visibleCells": { "gte": 1 } }],
    "showInner": [{ "edges": [true], "visibleCells": { "gte": 1 } }, { "faces": [true], "visibleCells": { "gte": 1 } }],
    "showOuter": [{ "edges": [true], "visibleCells": { "gte": 1 } }, { "faces": [true], "visibleCells": { "gte": 1 } }],
    "showTop": [{ "edges": [true], "visibleCells": { "gte": 1 } }, { "faces": [true], "visibleCells": { "gte": 1 } }],
    "slices": [{ "edges": [true], "visibleCells": { "gte": 1 } }, { "faces": [true], "visibleCells": { "gte": 1 } }],
    "strokeWeight": { "edges": [true] },
    "yaw": [{ "edges": [true], "visibleCells": { "gte": 1 } }, { "faces": [true], "visibleCells": { "gte": 1 } }],
  },
  "arrival-contours": {
    "contourCount": [{ "contrast": { "gt": 6.82 } }, { "weight": { "gt": 0 } }],
  },
  "aspect-tiles": {
    "inset": { "filled": [true] },
  },
  "attractor-growth": {
    "band": { "sourceMode": ["ring"] },
    "exclusion": { "sourceMode": ["area","two-lobe"] },
    "guideSize": { "guides": [true] },
    "lobeBias": { "sourceMode": ["two-lobe"] },
    "lobeGap": { "sourceMode": ["two-lobe"] },
    "rootSpread": { "rootCount": { "gte": 2 } },
    "terminalSize": { "terminals": [true] },
  },
  "band-marks": {
    "markStride": { "pointMaterial": ["nodes","ticks"] },
    "nodeSize": { "pointMaterial": ["nodes"] },
    "tickLength": { "pointMaterial": ["ticks"] },
  },
  "blue-noise-stipple": {
    "angleSpread": { "mark": ["square","diamond","cross","short-stroke"] },
    "innerRadius": { "support": ["annulus"] },
    "markAngle": { "mark": ["square","diamond","cross","short-stroke"] },
    "markAspect": { "mark": ["square","diamond","cross"] },
  },
  "blur-marks": {
    "sourceExtentX": { "arrangement": ["grid","area"] },
    "sourceSpacing": { "arrangement": ["line"] },
  },
  "branch-marks": {
    "columns": { "layout": ["line","grid","ring"], "rootCount": { "gte": 2 } },
    "extent": [{ "layout": ["area"] }, { "layout": ["ring"] }, { "rootCount": { "gte": 2 } }],
    "weight": { "strokes": [true] },
  },
  "branching-networks": {
    "dotSize": { "nodes": [true] },
    "innerRadius": { "shape": ["annulus"] },
    "maxDepth": { "shape": ["rectangle"] },
  },
  "bridge-web": {
    "nodeSize": { "nodes": [true] },
  },
  "cell-echoes": {
    "facetOpacity": { "facets": [true] },
    "finalSize": { "dots": [true] },
    "strength": { "iterations": { "gte": 1 } },
    "trailWeight": { "iterations": { "gte": 1 } },
  },
  "cell-mosaic": {
    "alternating": { "echoWeight": { "gt": 0 }, "echoes": { "gte": 1 } },
    "echoWeight": { "echoes": { "gte": 1 } },
    "facetOpacity": { "facets": [true] },
    "finalSize": { "dots": [true] },
    "strength": { "iterations": { "gte": 1 } },
    "trailWeight": { "iterations": { "gte": 1 } },
  },
  "centroid-trails": {
    "alternating": { "echoWeight": { "gt": 0 }, "echoes": { "gte": 1 } },
    "echoWeight": { "echoes": { "gte": 1 } },
    "facetOpacity": { "facets": [true] },
    "finalSize": { "dots": [true] },
  },
  "chord-looms": {
    "arcSweepA": { "shapeA": ["arc"] },
    "arcSweepB": { "shapeB": ["arc"] },
    "guideWeight": { "showGuides": [true] },
    "lobeDepthA": { "shapeA": ["lobed"] },
    "lobeDepthB": { "shapeB": ["lobed"] },
    "lobesA": { "shapeA": ["lobed"] },
    "lobesB": { "shapeB": ["lobed"] },
  },
  "compatible-mosaics": {
    "bodySize": { "showBody": [true] },
    "boundary": [{ "showBody": [true], "showConnectors": [false] }, { "showConnectors": [true] }, { "showJunctions": [true] }],
    "endWeight": [{ "showBody": [true], "showConnectors": [false] }, { "showConnectors": [true] }, { "showJunctions": [true] }],
    "junctionSize": { "showJunctions": [true] },
    "lineWeight": { "showConnectors": [true] },
    "turnWeight": [{ "showBody": [false], "showJunctions": [true] }, { "showBody": [true], "showConnectors": [false] }, { "showConnectors": [true] }],
  },
  "concave-grain": {
    "grain": { "hatchMode": ["fan","dots"] },
    "hatchAlpha": { "hatchMode": ["fan","dots"] },
    "innerRadius": { "kind": ["notched"] },
    "weight": [{ "grain": { "gte": 1 }, "hatchMode": ["fan","dots"] }, { "showEdges": [true] }],
  },
  "contact-network": {
    "aspect": { "sourceMode": ["area","ring","grid"] },
    "linkDotSize": { "dotMarks": [true], "links": [true] },
    "linkWeight": { "links": [true] },
    "nodeSize": { "nodes": [true] },
    "radius": { "openChains": [false] },
    "trailStride": { "trails": [true] },
    "trailWeight": { "trails": [true] },
    "velocityScale": { "showVelocities": [true] },
    "velocityWeight": { "showVelocities": [true] },
  },
  "contour-abstraction": {
    "nodeSize": { "showNodes": [true] },
  },
  "contour-blobs": {
    "centers": { "source": ["hills"] },
    "hillCount": { "source": ["hills"] },
    "hillRadius": { "source": ["hills"] },
    "phase": { "source": ["waves","saddle"] },
  },
  "contour-relief": {
    "aspect": [{ "contours": [true], "edges": [false] }, { "edges": [true] }, { "faces": [true] }],
    "centerX": [{ "contours": [true] }, { "edges": [true] }, { "faces": [true] }],
    "centerY": [{ "contours": [true] }, { "edges": [true] }, { "faces": [true] }],
    "columns": [{ "contours": [true], "edges": [false] }, { "edges": [true] }, { "faces": [true] }],
    "contourWeight": { "contours": [true] },
    "edgeWeight": { "edges": [true] },
    "faceColor": { "faces": [true] },
    "frequency": [{ "contours": [true], "edges": [false] }, { "edges": [true] }, { "faces": [true] }],
    "height": [{ "contours": [true], "edges": [false] }, { "edges": [true] }, { "faces": [true] }],
    "heightScale": [{ "contours": [true], "edges": [false] }, { "edges": [true] }, { "faces": [true] }],
    "hillCount": { "source": ["hills"] },
    "hillRadius": { "source": ["hills"] },
    "levelBase": { "contours": [true], "levelMode": ["sequence"] },
    "levelCount": { "contours": [true], "levelMode": ["sequence"] },
    "levelStep": { "contours": [true], "levelMode": ["sequence"] },
    "phase": { "source": ["waves","saddle"] },
    "pitch": [{ "contours": [true] }, { "edges": [true] }, { "faces": [true] }],
    "roll": [{ "contours": [true] }, { "edges": [true] }, { "faces": [true] }],
    "rows": [{ "contours": [true], "edges": [false] }, { "edges": [true] }, { "faces": [true] }],
    "source": [{ "contours": [true] }, { "edges": [true] }, { "faces": [true] }],
    "width": [{ "contours": [true], "edges": [false] }, { "edges": [true] }, { "faces": [true] }],
    "yaw": [{ "contours": [true] }, { "edges": [true] }, { "faces": [true] }],
  },
  "contour-terrain": {
    "centers": { "source": ["hills"] },
    "hillCount": { "source": ["hills"] },
    "hillRadius": { "source": ["hills"] },
    "phase": { "source": ["waves","saddle"] },
  },
  "curved-trajectories": {
    "ribbonWidth": { "showRibbon": [true] },
    "stationSize": { "showStations": [true] },
    "stationStride": { "showStations": [true] },
    "weight": { "showLine": [true] },
  },
  "cut-branch-marks": {
    "angle": { "segments": [true] },
    "attempts": { "segments": [true] },
    "endX": { "segments": [true] },
    "endY": { "segments": [true] },
    "minCutLength": { "segments": [true] },
    "opacity": { "segments": [true] },
    "startX": { "segments": [true] },
    "startY": { "segments": [true] },
    "weight": { "segments": [true] },
  },
  "depth-marks": {
    "ambient": { "faces": [true] },
    "capStart": [{ "edges": [true] }, { "faces": [true] }],
    "colorMode": [{ "edges": [true] }, { "faces": [true] }],
    "directional": { "faces": [true] },
    "height": [{ "edges": [true] }, { "faces": [true] }],
    "lightAzimuth": { "faces": [true] },
    "lightElevation": { "faces": [true] },
    "noiseDepth": { "colorMode": ["noise"] },
    "noiseScale": { "colorMode": ["noise"] },
    "offsetX": [{ "edges": [true] }, { "faces": [true] }],
    "offsetY": [{ "edges": [true] }, { "faces": [true] }],
    "pitch": [{ "edges": [true] }, { "faces": [true] }],
    "radius": [{ "edges": [true] }, { "faces": [true] }],
    "roll": [{ "edges": [true] }, { "faces": [true] }],
    "slices": [{ "edges": [true] }, { "faces": [true] }],
    "strokeWeight": { "edges": [true] },
    "yaw": [{ "edges": [true] }, { "faces": [true] }],
  },
  "diffusion-engraving": {
    "lineLength": { "mark": ["line"] },
    "lineWeight": { "mark": ["line"] },
    "markAngle": { "mark": ["line"] },
  },
  "distance-halos": {
    "siteSize": { "showSites": [true] },
  },
  "dithered-ribbons": {
    "lineLength": { "mark": ["line"] },
    "lineWeight": { "mark": ["line"] },
    "markAngle": { "mark": ["line"] },
  },
  "dye-currents": {
    "contourSpacing": { "contours": [true] },
    "contourThreshold": { "contours": [true] },
    "contourWeight": { "contours": [true] },
    "ticks": [{ "contours": [true] }, { "pigment": [true] }],
  },
  "elastic-loops": {
    "length": { "sourceMode": ["open"] },
    "nodeCap": { "sourceMode": ["ring"] },
    "nodeSize": [{ "endpoints": [true] }, { "structure": [true] }],
  },
  "escape-contours": {
    "constantImag": { "mapping": ["julia"] },
    "constantReal": { "mapping": ["julia"] },
  },
  "facet-marks": {
    "cluster": { "distribution": ["cluster"] },
    "grain": { "mode": ["grain"] },
    "groupSpread": { "groups": { "gte": 2 } },
    "opacity": { "mode": ["fill"] },
    "weight": { "mode": ["wire"] },
  },
  "faceted-silhouettes": {
    "grain": { "hatchMode": ["fan","dots"] },
    "hatchAlpha": { "hatchMode": ["fan","dots"] },
    "innerRadius": { "kind": ["notched"] },
    "weight": [{ "grain": { "gte": 1 }, "hatchMode": ["fan","dots"] }, { "showEdges": [true] }],
  },
  "field-marks": {
    "direction": { "mark": ["line","bar"] },
    "pitch": { "distribution": ["grid"] },
    "variation": { "mark": ["line","bar"] },
    "weight": { "mark": ["line","bar"] },
  },
  "flocking-marks": {
    "centerY": [{ "agentDots": [true] }, { "dotMarks": [true] }, { "links": [true] }, { "trailMarks": [true] }],
    "count": [{ "agentDots": [true] }, { "dotMarks": [true] }, { "links": [true], "trailMarks": [false] }, { "trailMarks": [true] }],
    "extent": [{ "agentDots": [true] }, { "dotMarks": [true] }, { "links": [true] }, { "trailMarks": [true] }],
    "speed": { "ticks": { "gte": 1 } },
    "ticks": [{ "agentDots": [true] }, { "dotMarks": [false], "links": [true] }, { "dotMarks": [true], "trailMarks": [false] }, { "trailMarks": [true] }],
    "weight": [{ "dotMarks": [true] }, { "links": [true] }, { "trailMarks": [true] }],
  },
  "flowing-brushes": {
    "nodeSize": { "showNodes": [true] },
  },
  "fragmented-lines": {
    "gaps": { "material": ["dash","paired-stitch","bar","leaf"] },
    "markAngle": { "material": ["dash","paired-stitch","bar","leaf"] },
    "markLength": { "material": ["dash","paired-stitch","bar","leaf"] },
    "markWidth": { "material": ["paired-stitch","bar","leaf"] },
    "omitChance": { "material": ["dash","paired-stitch","bar","leaf"] },
    "sampleSpacing": { "material": ["dash","paired-stitch","bar","leaf"] },
    "weight": { "material": ["line","dash","paired-stitch","bar"] },
  },
  "gesture-skeletons": {
    "nodeSize": { "showNodes": [true] },
  },
  "grain-marks": {
    "angle": { "strokes": [true] },
    "angleSpread": { "strokes": [true] },
    "weight": { "strokes": [true] },
  },
  "guarded-bands": {
    "frequency": [{ "fillRibbons": [true] }, { "outlines": [true] }, { "weight": { "gt": 0 } }],
  },
  "harmonic-traces": {
    "markSize": { "material": ["dots","normal-stitches"] },
    "spacing": { "material": ["dots","normal-stitches"] },
    "weight": { "material": ["line","normal-stitches"] },
  },
  "hatched-islands": {
    "cross": { "secondary": [true] },
    "crossPhase": { "secondary": [true] },
    "twist": { "secondary": [true] },
  },
  "lattice-marks": {
    "dotSize": [{ "dots": [true] }, { "endpoints": [true] }],
    "shadow": { "dots": [false] },
    "weight": { "dots": [false] },
  },
  "lingering-links": {
    "centerX": [{ "agentDots": [true] }, { "ticks": { "gte": 1 } }],
    "sourceMode": [{ "extent": { "gte": 1 } }, { "radius": { "gte": 1 } }],
  },
  "loop-marks": {
    "columns": { "layout": ["grid"] },
    "fanOpacity": { "treatment": ["fans"] },
    "nestedScale": { "layout": ["nested"] },
    "outlineWeight": { "treatment": ["outline","outline-tiles"] },
    "spacingX": { "layout": ["row","grid"] },
    "tileHeight": { "treatment": ["tiles","outline-tiles"] },
    "tileShape": { "treatment": ["tiles","outline-tiles"] },
    "tileSpacing": { "treatment": ["tiles","outline-tiles"] },
    "tileWidth": { "treatment": ["tiles","outline-tiles"] },
  },
  "maze-gardens": {
    "dotSize": { "nodes": [true] },
    "innerRadius": { "shape": ["annulus"] },
  },
  "nearest-feature-mosaic": {
    "boundaryWidth": { "display": ["boundaries","both"] },
    "cellCoverage": { "display": ["regions","both"] },
    "siteSize": { "showSites": [true] },
  },
  "neighborhood-growth": {
    "densityRadius": [{ "poolExtent": { "gt": 152.1 } }, { "insert": { "gte": 1 }, "poolExtent": { "gt": 5 }, "poolSize": { "gte": 1 } }],
    "disorder": { "sourceMode": ["ring","line"] },
    "dotSize": { "nodeMarks": [true] },
    "graphWeight": { "graphMarks": [true] },
    "maxNeighbors": [{ "centerX": { "gt": 29.3, "lt": 629.6 }, "centerY": { "lt": 617 } }, { "centerX": { "gt": 390.07, "lt": 749 } }, { "centerX": { "gt": 7.6, "lt": 588 } }, { "poolSize": { "gte": 5 } }],
    "minNeighbors": { "insert": { "gte": 1 } },
    "poolExtent": { "poolSize": { "gte": 1 } },
    "traceWeight": { "traces": [true] },
  },
  "nested-contour-strokes": {
    "dotSize": { "marks": ["dots","both"] },
    "weight": { "marks": ["outline","both"] },
  },
  "orbit-beads": {
    "depth": { "source": ["wave"] },
    "lobes": { "source": ["wave"] },
    "markSpacing": { "marks": ["beads","dashes"] },
  },
  "orbital-brush": {
    "depth": { "source": ["wave"] },
    "lobes": { "source": ["wave"] },
    "markSpacing": { "marks": ["beads","dashes"] },
  },
  "ordered-halftone": {
    "lineLength": { "mark": ["line"] },
    "lineWeight": { "mark": ["line"] },
    "markAngle": { "mark": ["line"] },
  },
  "packed-posters": {
    "inset": { "filled": [true] },
  },
  "path-clip-marks": {
    "angle": { "regionMode": ["regular"] },
    "notchDepth": { "regionMode": ["portal","bay"] },
    "notchWidth": { "regionMode": ["portal","bay"] },
    "sides": { "regionMode": ["regular"] },
    "wander": { "sourceMode": ["wander"] },
  },
  "path-marks": {
    "drift": { "trace": [false] },
    "gapEvery": [{ "gapLength": { "gte": 1 } }, { "weight": { "gt": 0 } }],
    "mark": { "trace": [false] },
    "markLength": { "trace": [false] },
    "regularity": { "trace": [false] },
    "sourceColumns": { "arrangement": ["grid"] },
    "sourceRows": { "arrangement": ["grid"] },
  },
  "phyllotactic-whorls": {
    "aspect": { "mark": ["ellipse","bar","leaf"] },
    "markAngle": { "mark": ["ellipse","bar","leaf"] },
    "markOrientation": { "mark": ["ellipse","bar","leaf"] },
  },
  "pinned-waves": {
    "impulseAmplitude2": { "impulseCount": { "gte": 2 } },
    "impulseAmplitude3": { "impulseCount": { "gte": 3 } },
    "impulseSpread2": { "impulseCount": { "gte": 2 } },
    "impulseX2": { "impulseCount": { "gte": 2 } },
    "impulseY2": { "impulseCount": { "gte": 2 } },
    "pinRadius": { "pinMode": ["disc"] },
    "pinX": { "pinMode": ["vertical","disc"] },
    "pinY": { "pinMode": ["horizontal","disc"] },
    "showPins": { "pinMode": ["perimeter","vertical","horizontal","disc"] },
  },
  "placement-marks": {
    "attempts": { "radial": [false] },
    "extentX": { "radial": [false] },
    "extentY": { "radial": [false] },
    "orientation": { "mark": ["diamond","stroke"] },
    "phase": { "radial": [true] },
    "ringCount": { "radial": [true] },
    "ringRadius": { "radial": [true] },
    "ringSamples": { "radial": [true] },
    "ringSpacing": { "radial": [true] },
    "weight": { "mark": ["outline","diamond","ring","stroke"] },
  },
  "polygon-marks": {
    "weight": { "outline": [true] },
  },
  "profile-marks": {
    "ambient": { "faces": [true] },
    "capEnd": [{ "edges": [true] }, { "faces": [true] }],
    "capStart": [{ "edges": [true] }, { "faces": [true] }],
    "colorMode": [{ "edges": [true] }, { "faces": [true] }],
    "directional": { "faces": [true] },
    "height": [{ "edges": [true] }, { "faces": [true] }],
    "lightAzimuth": { "faces": [true] },
    "lightElevation": { "faces": [true] },
    "noiseDepth": { "colorMode": ["noise"] },
    "noiseScale": { "colorMode": ["noise"] },
    "offsetX": [{ "edges": [true] }, { "faces": [true] }],
    "offsetY": [{ "edges": [true] }, { "faces": [true] }],
    "pitch": [{ "edges": [true] }, { "faces": [true] }],
    "radius": [{ "edges": [true] }, { "faces": [true] }],
    "roll": [{ "edges": [true] }, { "faces": [true] }],
    "slices": [{ "edges": [true] }, { "faces": [true] }],
    "strokeWeight": { "edges": [true] },
    "yaw": [{ "edges": [true] }, { "faces": [true] }],
  },
  "quantized-stripes": {
    "samples": { "source": ["palette-ramp"] },
  },
  "ramp-marks": {
    "axis": { "coordinate": ["linear","angular"] },
    "length": { "mark": ["bar","stroke"] },
    "weight": { "mark": ["stroke"] },
    "width": { "mark": ["dot","bar"] },
  },
  "recursive-tiles": {
    "dotSize": { "nodes": [true] },
    "tickLength": { "ticks": [true] },
  },
  "reduced-mosaic": {
    "maskThreshold": { "fieldMask": ["high","low"] },
  },
  "region-marks": {
    "markCount": { "mark": ["dot","line","grid"] },
    "markScale": { "mark": ["dot","line","grid"] },
    "weight": [{ "mark": ["line"] }, { "outline": [true] }],
  },
  "registered-screens": {
    "angleA": { "enableA": [true] },
    "angleB": { "enableB": [true] },
    "centerX": [{ "enableA": [true] }, { "enableB": [true] }],
    "centerY": [{ "enableA": [true] }, { "enableB": [true] }],
    "curveA": { "enableA": [true] },
    "curveB": { "enableB": [true] },
    "frequencyA": { "curveA": { "gt": 0 }, "enableA": [true] },
    "frequencyB": { "curveB": { "gt": 0 }, "enableB": [true] },
    "height": [{ "enableA": [true] }, { "enableB": [true] }],
    "offsetXB": { "enableB": [true] },
    "offsetYA": { "enableA": [true] },
    "offsetYB": { "enableB": [true] },
    "phaseA": { "enableA": [true] },
    "phaseB": { "enableB": [true] },
    "pitchA": { "enableA": [true] },
    "pitchB": { "enableB": [true] },
    "weightA": { "enableA": [true] },
    "weightB": { "enableB": [true] },
    "width": [{ "enableA": [true] }, { "enableB": [true] }],
  },
  "relaxed-stones": {
    "alternating": { "echoWeight": { "gt": 0 }, "echoes": { "gte": 1 } },
    "echoWeight": { "echoes": { "gte": 1 } },
    "facetOpacity": { "facets": [true] },
    "finalSize": { "dots": [true] },
  },
  "ripple-interference": {
    "impulseAmplitude3": { "impulseCount": { "gte": 3 } },
    "pinRadius": { "pinMode": ["disc"] },
    "pinX": { "pinMode": ["vertical","disc"] },
    "pinY": { "pinMode": ["horizontal","disc"] },
    "showPins": { "pinMode": ["perimeter","vertical","horizontal","disc"] },
  },
  "road-margins": {
    "bothSides": { "showEdges": [true] },
    "distance": { "showEdges": [true] },
    "iterations": [{ "showCenterline": [true], "weight": { "gt": 0 } }, { "showEdges": [true], "weight": { "gt": 0 } }],
    "weight": [{ "showCenterline": [true] }, { "showEdges": [true] }, { "showNodes": [true] }],
  },
  "rounded-panels": {
    "fillAlpha": { "treatment": ["fill","both"] },
    "weight": { "treatment": ["outline","both"] },
  },
  "rounded-polyhedra": {
    "axisY": { "base": ["tetra","octa"] },
  },
  "scatter-envelopes": {
    "clusterCount": [{ "filled": [true] }, { "outlined": [true] }, { "showDots": [true] }],
    "clusterSpread": { "clusterCount": { "gte": 2 } },
    "innerRing": { "support": ["ring"] },
    "inset": { "showDots": [true] },
    "weight": { "outlined": [true] },
  },
  "sensing-trails": {
    "aspect": [{ "agentDots": [true], "extent": { "gte": 1 } }, { "dotMarks": [true], "extent": { "gte": 1 } }, { "extent": { "gte": 1 }, "trailMarks": [true] }],
    "centerX": [{ "agentDots": [true] }, { "dotMarks": [true] }, { "showField": [true] }, { "trailMarks": [true] }],
    "centerY": [{ "agentDots": [true] }, { "dotMarks": [true] }, { "showField": [true] }, { "trailMarks": [true] }],
    "fieldSpread": [{ "probeAngle": { "gt": 0 }, "showField": [false] }, { "showField": [true] }, { "speed": { "gt": 0 } }, { "trailMarks": [true] }],
    "sourceMode": [{ "agentDots": [true], "extent": { "gte": 1 } }, { "dotMarks": [true], "extent": { "gte": 1 } }, { "extent": { "gte": 1 }, "trailMarks": [true] }],
    "weight": [{ "dotMarks": [true] }, { "trailMarks": [true] }],
  },
  "spaced-symbols": {
    "angleSpread": { "mark": ["square","diamond","cross","short-stroke"] },
    "innerRadius": { "support": ["annulus"] },
    "markAngle": { "mark": ["square","diamond","cross","short-stroke"] },
    "markAspect": { "mark": ["square","diamond","cross"] },
  },
  "spring-marks": {
    "bodySize": { "showBodies": [true] },
    "radius": { "targetMode": ["ring","line","grid"] },
    "targetAngle": { "targetMode": ["ring","line","grid"] },
    "targetAspect": { "targetMode": ["ring","line","grid"] },
    "targetSize": { "showTargets": [true] },
    "ticks": [{ "showBodies": [true] }, { "showSpokes": [true] }, { "showTrails": [true] }],
    "trailStride": { "showTrails": [true] },
    "trailWeight": { "showTrails": [true] },
    "weight": { "showSpokes": [true] },
  },
  "stitched-contours": {
    "gaps": { "material": ["dash","paired-stitch","bar","leaf"] },
    "markAngle": { "material": ["dash","paired-stitch","bar","leaf"] },
    "markLength": { "material": ["dash","paired-stitch","bar","leaf"] },
    "markWidth": { "material": ["paired-stitch","bar","leaf"] },
    "omitChance": { "material": ["dash","paired-stitch","bar","leaf"] },
    "sampleSpacing": { "material": ["dash","paired-stitch","bar","leaf"] },
    "weight": { "material": ["line","dash","paired-stitch","bar"] },
  },
  "stitched-paths": {
    "markWidth": { "material": ["paired-stitch","bar","leaf"] },
    "weight": { "material": ["line","dash","paired-stitch","bar"] },
  },
  "stream-ribbons": {
    "ribbonWidth": { "showRibbon": [true] },
    "startAngle": [{ "showLine": [true], "startExtent": { "gt": 0 } }, { "showRibbon": [true] }, { "showStations": [true] }],
    "stationSize": { "showStations": [true] },
    "stationStride": { "showStations": [true] },
    "weight": { "showLine": [true] },
  },
  "subdivided-shells": {
    "axisY": { "base": ["tetra","octa"] },
  },
  "swirling-particles": {
    "sourceAngle": { "sourceMode": ["line"] },
  },
  "terraced-islands": {
    "inset": { "showDots": [true] },
    "spread": { "islands": { "gte": 2 } },
    "terraces": [{ "filled": [true] }, { "outlined": [true], "weight": { "gt": 0 } }],
    "weight": { "outlined": [true] },
  },
  "tiled-circuits": {
    "angle": [{ "showBody": [true] }, { "showConnectors": [true] }, { "showJunctions": [true] }],
    "blankWeight": [{ "showBody": [true] }, { "showConnectors": [true] }, { "showJunctions": [true] }],
    "bodySize": { "showBody": [true] },
    "centerX": [{ "showBody": [true] }, { "showConnectors": [true] }, { "showJunctions": [true] }],
    "centerY": [{ "showBody": [true] }, { "showConnectors": [true] }, { "showJunctions": [true] }],
    "junctionSize": { "showJunctions": [true] },
    "lineWeight": { "showConnectors": [true] },
    "pitchY": [{ "showBody": [true] }, { "showConnectors": [true] }, { "showJunctions": [true] }],
    "rows": [{ "showBody": [true] }, { "showConnectors": [true] }, { "showJunctions": [true] }],
    "size": [{ "showBody": [true] }, { "showConnectors": [true] }, { "showJunctions": [true] }],
  },
  "triangle-glyphs": {
    "density": { "initialMode": ["random"] },
    "inactiveAlpha": { "showInactive": [true] },
    "inactiveColor": { "showInactive": [true] },
    "phase": { "initialMode": ["single","alternating","random"] },
  },
  "turtle-canopies": {
    "dotSize": { "nodes": [true] },
    "tickLength": { "ticks": [true] },
  },
  "warp-marks": {
    "sourceExtentX": { "arrangement": ["grid","area"] },
    "sourceSpacing": { "arrangement": ["line"] },
  },
  "weighted-image-atlas": {
    "features": { "source": ["relief","thermal"] },
    "fieldAlignment": { "marks": ["stitches","bars"] },
    "markAngle": { "marks": ["stitches","bars"] },
    "sourceAspect": { "source": ["relief","thermal"] },
    "sourceSeed": { "source": ["relief","thermal"] },
    "sourceSize": { "source": ["relief","thermal"] },
    "spread": { "source": ["relief","thermal"] },
  },
  "word-echo": {
    "footprint": { "transfer": ["contour"] },
    "pathAspect": { "transfer": ["path"] },
    "pathRadius": [{ "showWaveform": [true] }, { "transfer": ["path"] }],
    "pathShape": { "transfer": ["path"] },
    "pathTurns": { "transfer": ["path"] },
  },
  "woven-grammar": {
    "dotSize": { "nodes": [true] },
    "tickLength": { "ticks": [true] },
  },
  "woven-rows": {
    "density": { "initialMode": ["random"] },
    "inactiveAlpha": { "showInactive": [true] },
    "inactiveColor": { "showInactive": [true] },
  },
  "woven-strands": {
    "repeat": { "sequence": ["seeded","twill"] },
  },
};
// END GENERATED

/** Attach overlay conditions to their definitions; throws on any unknown instrument, control or conflict. */
export function applyControlDependencies(
  items: readonly InstrumentDefinition[],
  table: Readonly<Record<string, Readonly<Record<string, ControlCondition>>>> = controlDependencies,
): InstrumentDefinition[] {
  const known = new Set(items.map((item) => item.id));
  for (const id of Object.keys(table))
    if (!known.has(id)) throw new Error(`controlDependencies names unknown instrument ${id}`);
  return items.map((item) => {
    const overlay = table[item.id];
    if (!overlay) return item;
    const keys = new Set(item.parameters.map((parameter) => parameter.key));
    for (const key of Object.keys(overlay)) {
      if (!keys.has(key)) throw new Error(`controlDependencies for ${item.id} names unknown control ${key}`);
      if (item.parameters.find((parameter) => parameter.key === key)!.visibleWhen)
        throw new Error(`Instrument ${item.id} control ${key} already declares visibleWhen inline`);
    }
    return { ...item, parameters: item.parameters.map((parameter) =>
      overlay[parameter.key] ? { ...parameter, visibleWhen: overlay[parameter.key] } : parameter) };
  });
}
