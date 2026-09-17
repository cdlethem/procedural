import type { Layer } from "../studio-types";
import { choice, numeric, toggle, type StudioDefinition } from "./types";
import { pathsASettings, drawRoundedPanels, drawFlowingBrushes, drawContourAbstraction, drawGestureSkeletons, drawRoadMargins, drawNestedContourStrokes, drawScatterEnvelopes, drawTerracedIslands, drawFacetedSilhouettes, drawConcaveGrain } from "../../../../packages/javascript/examples/paths-a-studies.js";
import { drawPathsAQuality, validatePathsAQuality } from "./paths-a-quality";

const specs: [string, string, string, [string, string, number, number, number?], [string, string, number, number, number?]][] = [
  ["rounded-panels", "Rounded panels", "Corner-cut quilt panels.", ["iterations", "Refinement", 1, 5], ["panels", "Panels", 2, 9]],
  ["flowing-brushes", "Flowing brushes", "Refined calligraphic ribbons.", ["iterations", "Refinement", 1, 5], ["rows", "Rows", 3, 16]],
  ["contour-abstraction", "Contour abstraction", "One path at several simplification levels.", ["tolerance", "Tolerance", 1, 40], ["layers", "Layers", 3, 10]],
  ["gesture-skeletons", "Gesture skeletons", "Retained joints from loose drawn gestures.", ["tolerance", "Tolerance", 1, 24], ["gestures", "Gestures", 3, 14]],
  ["road-margins", "Road margins", "Parallel offset route edges.", ["distance", "Margin", 2, 30], ["routes", "Routes", 2, 8]],
  ["nested-contour-strokes", "Nested contour strokes", "Offset rings from one boundary.", ["distance", "Ring gap", 2, 18], ["rings", "Rings", 3, 12]],
  ["scatter-envelopes", "Scatter envelopes", "A hull and its scattered source sites.", ["count", "Sites", 8, 100], ["inset", "Dot size", 4, 28]],
  ["terraced-islands", "Terraced islands", "Nested convex island perimeters.", ["count", "Sites", 8, 80], ["terraces", "Terraces", 3, 12]],
  ["faceted-silhouettes", "Faceted silhouettes", "Triangulated convex paper-cut forms.", ["scale", "Scale", 120, 270], ["grain", "Grain lines", 0, 36]],
  ["concave-grain", "Concave grain", "Triangulated notched grain silhouette.", ["scale", "Scale", 120, 280], ["grain", "Grain lines", 0, 70]],
];
const n = (key: string, label: string, description: string, min: number, max: number, hardMin: number, hardMax: number, step = 1, integer = false) =>
  numeric(key, label, description, min, max, step, { hardMin, hardMax, integer });
const legacy = { ...toggle("legacy", "Legacy layout", "Retains the earlier saved composition."), hidden: true };
const sourceShape = [
  n("sides", "Sides", "Number of sides in the source polygon.", 3, 12, 3, 256, 1, true),
  n("notch", "Notch depth", "Pulls one edge inward before the path operation.", 0, .9, 0, .95, .01),
  n("aspect", "Height ratio", "Stretches the source outline vertically.", .3, 2, .01, 100, .01),
  n("rotation", "Rotation", "Turns the source outline in degrees.", -180, 180, -1_000_000, 1_000_000, 1),
];
const weight = n("weight", "Stroke weight", "Width of outlines and line marks in pixels.", 0, 12, 0, 100, .25);
const modern: Record<string, StudioDefinition> = {
  "rounded-panels": {
    id: "rounded-panels", title: "Rounded panels", description: "Repeat editable polygon outlines after Chaikin corner cuts.",
    parameters: [
      n("iterations", "Corner cuts", "Successive smoothing passes on each source outline.", 0, 6, 0, 16, 1, true),
      n("panels", "Panels", "Total repeated panels.", 1, 16, 1, 1000, 1, true), weight,
      ...sourceShape,
      n("panelSize", "Panel radius", "Size of each source outline before smoothing.", 20, 130, .01, 10000),
      n("columns", "Columns", "Number of panels on each row.", 1, 8, 1, 1000, 1, true),
      n("gapX", "Column gap", "Space between panel bounds; negative values overlap.", -120, 180, -10000, 10000),
      n("gapY", "Row gap", "Space between panel bounds; negative values overlap.", -120, 180, -10000, 10000),
      n("stagger", "Row stagger", "Horizontal row shift as a fraction of column pitch.", -1, 1, -100, 100, .01),
      choice("treatment", "Treatment", "Outline, filled panel, or both.", ["outline", "fill", "both"]),
      n("fillAlpha", "Fill opacity", "Opacity of the bounded panel fill.", 0, 255, 0, 255, 1, true), legacy,
    ],
    defaults: { iterations: 2, panels: 6, weight: 2, sides: 5, notch: .25, aspect: 1, rotation: -18,
      panelSize: 57, columns: 3, gapX: 26, gapY: 34, stagger: .2, treatment: "both", fillAlpha: 95, legacy: false },
    validate: params => validatePathsAQuality("rounded-panels", params),
  },
  "road-margins": {
    id: "road-margins", title: "Road margins", description: "Offset editable open routes with optional centerlines and source nodes.",
    parameters: [
      n("distance", "Signed margin", "Offset distance; sign selects the side when one edge is shown.", -40, 40, -10000, 10000),
      n("routes", "Routes", "Number of route centerlines.", 1, 12, 1, 1000, 1, true), weight,
      n("turns", "Turns", "Number of waypoint intervals in each route.", 1, 32, 1, 1000, 1, true),
      n("amplitude", "Bend amplitude", "Vertical reach of each route's turns.", -130, 130, -10000, 10000),
      n("frequency", "Bend cycles", "Oscillations across the canvas; negative values reverse progression.", -3, 5, -1000, 1000, .05),
      n("phase", "Bend phase", "Starting angle of route bends in degrees.", -180, 180, -1_000_000, 1_000_000),
      n("routeSpacing", "Route spacing", "Vertical distance between centerlines.", -160, 160, -10000, 10000),
      n("iterations", "Route smoothing", "Chaikin passes applied before offsetting.", 0, 5, 0, 16, 1, true),
      n("miterLimit", "Join limit", "Maximum pointed join length relative to margin before beveling.", 1, 8, 1, 1000, .1),
      toggle("showCenterline", "Show centerlines", "Draw the source route below its margin marks."),
      toggle("showEdges", "Show margin edges", "Draw offset route edges."),
      toggle("bothSides", "Both sides", "Draw the opposite offset edge as well."),
      toggle("showNodes", "Show waypoints", "Mark the route's original waypoints."), legacy,
    ],
    defaults: { distance: 12, routes: 5, weight: 2, turns: 10, amplitude: 46, frequency: 1.25,
      phase: 15, routeSpacing: 103, iterations: 2, miterLimit: 2,
      showCenterline: false, showEdges: true, bothSides: true, showNodes: false, legacy: false },
    validate: params => validatePathsAQuality("road-margins", params),
  },
  "nested-contour-strokes": {
    id: "nested-contour-strokes", title: "Nested contour strokes", description: "Offset an editable closed outline into contour rings.",
    parameters: [
      n("distance", "Signed ring gap", "Actual distance between successive offsets; negative values reverse direction.", -40, 40, -10000, 10000),
      n("rings", "Rings", "Number of contours drawn from the source boundary.", 1, 16, 1, 1000, 1, true), weight,
      ...sourceShape,
      n("scale", "Boundary radius", "Size of the source outline before offsetting.", 50, 280, .01, 10000),
      n("startOffset", "Starting offset", "Offset distance of the first ring from the source.", -100, 100, -10000, 10000),
      n("miterLimit", "Join limit", "Maximum pointed join length before beveling.", 1, 8, 1, 1000, .1),
      choice("marks", "Ring marks", "Draw contours, their vertices, or both.", ["outline", "dots", "both"]),
      n("dotSize", "Vertex size", "Diameter of the contour vertex marks.", 0, 12, 0, 1000, .25),
      n("alpha", "Mark opacity", "Opacity of ring outlines and vertices.", 0, 255, 0, 255, 1, true), legacy,
    ],
    defaults: { distance: 12, rings: 8, weight: 2, sides: 7, notch: .25, aspect: .85, rotation: 12,
      scale: 198, startOffset: 0, miterLimit: 2, marks: "outline", dotSize: 4, alpha: 190, legacy: false },
    validate: params => validatePathsAQuality("nested-contour-strokes", params),
  },
};
for (const [id, kind, sides, innerRadius, scale, grain, weightValue] of [
  ["faceted-silhouettes", "convex", 7, .65, 205, 16, 2],
  ["concave-grain", "notched", 6, .48, 215, 24, 1.5],
] as const) {
  modern[id] = {
    id, title: id === "concave-grain" ? "Concave grain" : "Faceted silhouettes",
    description: "Triangulate an editable convex or notched boundary, then treat its facets independently.",
    parameters: [
      n("scale", "Boundary radius", "Outer reach of the silhouette.", 60, 280, .01, 10000),
      n("grain", "Grain marks", "Fan lines or dots in each triangle.", 0, 60, 0, 1000, 1, true), weight,
      choice("kind", "Boundary", "Choose convex or radially notched source geometry.", ["convex", "notched"]),
      n("sides", "Outer sides", "Number of outer corners; notched shapes add one inner corner between each pair.", 3, 12, 3, 256, 1, true),
      n("innerRadius", "Notch radius", "Inner corner radius as a fraction of the outer radius; used for notched boundaries.", .1, .9, .01, 1, .01),
      n("aspect", "Height ratio", "Stretches the boundary vertically.", .3, 2, .01, 100, .01),
      n("rotation", "Rotation", "Turns the silhouette in degrees.", -180, 180, -1_000_000, 1_000_000),
      n("fillAlpha", "Facet fill", "Opacity of each filled triangle; zero leaves only marks.", 0, 255, 0, 255, 1, true),
      toggle("showEdges", "Show facet edges", "Trace the triangular facet boundaries."),
      choice("hatchMode", "Grain treatment", "Draw fan hatching, dots, or no grain marks.", ["fan", "dots", "none"]),
      n("hatchAlpha", "Grain opacity", "Opacity of facet-local grain marks.", 0, 255, 0, 255, 1, true), legacy,
    ],
    defaults: { scale, grain, weight: weightValue, kind, sides, innerRadius, aspect: .9, rotation: 12,
      fillAlpha: 115, showEdges: true, hatchMode: "fan", hatchAlpha: 165, legacy: false },
    validate: params => validatePathsAQuality(id, params),
  };
}
export const pathsADefinitions: StudioDefinition[] = specs.map(([id, title, description, first, second]) =>
  modern[id] ?? { id, title, description, parameters: [numeric(first[0], first[1], `Changes ${first[1].toLowerCase()} in this composition.`, first[2], first[3], first[4]), numeric(second[0], second[1], `Changes ${second[1].toLowerCase()} in this composition.`, second[2], second[3], second[4]), numeric("weight", "Stroke weight", "Outline width in pixels.", .5, 6, .25)], defaults: pathsASettings[id as keyof typeof pathsASettings].defaults });
const draws: Record<string, (p: any, layer: Layer) => void> = { "rounded-panels": drawRoundedPanels, "flowing-brushes": drawFlowingBrushes, "contour-abstraction": drawContourAbstraction, "gesture-skeletons": drawGestureSkeletons, "road-margins": drawRoadMargins, "nested-contour-strokes": drawNestedContourStrokes, "scatter-envelopes": drawScatterEnvelopes, "terraced-islands": drawTerracedIslands, "faceted-silhouettes": drawFacetedSilhouettes, "concave-grain": drawConcaveGrain };
export function drawPathsA(p: any, layer: Layer): void {
  const draw = draws[layer.technique];
  if (!draw) throw Error("Unknown paths A technique");
  if (modern[layer.technique] && layer.params.legacy !== true) drawPathsAQuality(p, layer);
  else draw(p, layer);
}
