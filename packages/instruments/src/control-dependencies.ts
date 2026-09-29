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
    "linkWeight": { "links": [true] },
    "nodeSize": { "nodes": [true] },
    "radius": { "openChains": [false] },
    "trailStride": { "trails": [true] },
    "trailWeight": { "trails": [true] },
    "velocityScale": { "showVelocities": [true] },
    "velocityWeight": { "showVelocities": [true] },
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
  },
  "cell-mosaic": {
    "facetOpacity": { "facets": [true] },
    "finalSize": { "dots": [true] },
  },
  "centroid-trails": {
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
    "junctionSize": { "showJunctions": [true] },
    "lineWeight": { "showConnectors": [true] },
  },
  "concave-grain": {
    "grain": { "hatchMode": ["fan","dots"] },
    "hatchAlpha": { "hatchMode": ["fan","dots"] },
    "innerRadius": { "kind": ["notched"] },
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
    "contourWeight": { "contours": [true] },
    "edgeWeight": { "edges": [true] },
    "faceColor": { "faces": [true] },
    "hillCount": { "source": ["hills"] },
    "hillRadius": { "source": ["hills"] },
    "levelBase": { "contours": [true], "levelMode": ["sequence"] },
    "phase": { "source": ["waves","saddle"] },
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
    "directional": { "faces": [true] },
    "lightAzimuth": { "faces": [true] },
    "lightElevation": { "faces": [true] },
    "strokeWeight": { "edges": [true] },
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
  },
  "elastic-loops": {
    "length": { "sourceMode": ["open"] },
  },
  "escape-contours": {
    "constantImag": { "mapping": ["julia"] },
    "constantReal": { "mapping": ["julia"] },
  },
  "facet-marks": {
    "cluster": { "distribution": ["cluster"] },
    "grain": { "mode": ["grain"] },
    "opacity": { "mode": ["fill"] },
    "weight": { "mode": ["wire"] },
  },
  "faceted-silhouettes": {
    "grain": { "hatchMode": ["fan","dots"] },
    "hatchAlpha": { "hatchMode": ["fan","dots"] },
    "innerRadius": { "kind": ["notched"] },
  },
  "field-marks": {
    "direction": { "mark": ["line","bar"] },
    "pitch": { "distribution": ["grid"] },
    "variation": { "mark": ["line","bar"] },
    "weight": { "mark": ["line","bar"] },
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
    "shadow": { "dots": [false] },
    "weight": { "dots": [false] },
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
    "disorder": { "sourceMode": ["ring","line"] },
    "dotSize": { "nodeMarks": [true] },
    "graphWeight": { "graphMarks": [true] },
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
    "directional": { "faces": [true] },
    "lightAzimuth": { "faces": [true] },
    "lightElevation": { "faces": [true] },
    "strokeWeight": { "edges": [true] },
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
  },
  "registered-screens": {
    "angleA": { "enableA": [true] },
    "angleB": { "enableB": [true] },
    "curveA": { "enableA": [true] },
    "curveB": { "enableB": [true] },
    "offsetXB": { "enableB": [true] },
    "offsetYA": { "enableA": [true] },
    "offsetYB": { "enableB": [true] },
    "phaseA": { "enableA": [true] },
    "phaseB": { "enableB": [true] },
    "pitchA": { "enableA": [true] },
    "pitchB": { "enableB": [true] },
    "weightA": { "enableA": [true] },
    "weightB": { "enableB": [true] },
  },
  "relaxed-stones": {
    "facetOpacity": { "facets": [true] },
    "finalSize": { "dots": [true] },
  },
  "ripple-interference": {
    "pinRadius": { "pinMode": ["disc"] },
    "pinX": { "pinMode": ["vertical","disc"] },
    "pinY": { "pinMode": ["horizontal","disc"] },
    "showPins": { "pinMode": ["perimeter","vertical","horizontal","disc"] },
  },
  "road-margins": {
    "bothSides": { "showEdges": [true] },
    "distance": { "showEdges": [true] },
  },
  "rounded-panels": {
    "fillAlpha": { "treatment": ["fill","both"] },
    "weight": { "treatment": ["outline","both"] },
  },
  "rounded-polyhedra": {
    "axisY": { "base": ["tetra","octa"] },
  },
  "scatter-envelopes": {
    "inset": { "showDots": [true] },
    "weight": { "outlined": [true] },
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
    "weight": { "outlined": [true] },
  },
  "tiled-circuits": {
    "bodySize": { "showBody": [true] },
    "junctionSize": { "showJunctions": [true] },
    "lineWeight": { "showConnectors": [true] },
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
