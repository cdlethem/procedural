import type { Layer } from "../studio-types";
import { numeric, type StudioDefinition } from "./types";
import { pathsASettings, drawRoundedPanels, drawFlowingBrushes, drawContourAbstraction, drawGestureSkeletons, drawRoadMargins, drawNestedContourStrokes, drawScatterEnvelopes, drawTerracedIslands, drawFacetedSilhouettes, drawConcaveGrain } from "../../../../packages/javascript/examples/paths-a-studies.js";

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
export const pathsADefinitions: StudioDefinition[] = specs.map(([id, title, description, first, second]) => ({ id, title, description, parameters: [numeric(first[0], first[1], `Changes ${first[1].toLowerCase()} in this composition.`, first[2], first[3], first[4]), numeric(second[0], second[1], `Changes ${second[1].toLowerCase()} in this composition.`, second[2], second[3], second[4]), numeric("weight", "Stroke weight", "Outline width in pixels.", .5, 6, .25)], defaults: pathsASettings[id as keyof typeof pathsASettings].defaults }));
const draws: Record<string, (p: any, layer: Layer) => void> = { "rounded-panels": drawRoundedPanels, "flowing-brushes": drawFlowingBrushes, "contour-abstraction": drawContourAbstraction, "gesture-skeletons": drawGestureSkeletons, "road-margins": drawRoadMargins, "nested-contour-strokes": drawNestedContourStrokes, "scatter-envelopes": drawScatterEnvelopes, "terraced-islands": drawTerracedIslands, "faceted-silhouettes": drawFacetedSilhouettes, "concave-grain": drawConcaveGrain };
export function drawPathsA(p: any, layer: Layer): void { const draw = draws[layer.technique]; if (!draw) throw Error("Unknown paths A technique"); draw(p, layer); }
