import type { Layer } from "../studio-types";
import { pathsADefinitions } from "./paths-a";
import { drawRoundedPanels, drawFlowingBrushes, drawContourAbstraction, drawGestureSkeletons, drawRoadMargins, drawNestedContourStrokes, drawScatterEnvelopes, drawTerracedIslands, drawFacetedSilhouettes, drawConcaveGrain } from "../../../../packages/javascript/examples/paths-a-studies.js";
import { pathsBDefinitions } from "./paths-b";
import { drawStitchedContours, drawFragmentedLines, drawBlueNoiseStipple, drawSpacedSymbols, drawRelaxedStones, drawCentroidTrails, drawPackedPosters, drawAspectTiles, drawObstacleRoads, drawArrivalContours } from "../../../../packages/javascript/examples/paths-b-studies.js";
export const pathsDefinitions = [...pathsADefinitions, ...pathsBDefinitions];
export function drawPaths(p: any, layer: Layer): void {
 switch(layer.technique) {
 case "rounded-panels": return drawRoundedPanels(p, layer);
 case "flowing-brushes": return drawFlowingBrushes(p, layer);
 case "contour-abstraction": return drawContourAbstraction(p, layer);
 case "gesture-skeletons": return drawGestureSkeletons(p, layer);
 case "road-margins": return drawRoadMargins(p, layer);
 case "nested-contour-strokes": return drawNestedContourStrokes(p, layer);
 case "scatter-envelopes": return drawScatterEnvelopes(p, layer);
 case "terraced-islands": return drawTerracedIslands(p, layer);
 case "faceted-silhouettes": return drawFacetedSilhouettes(p, layer);
 case "concave-grain": return drawConcaveGrain(p, layer);
 case "stitched-contours": return drawStitchedContours(p, layer);
 case "fragmented-lines": return drawFragmentedLines(p, layer);
 case "blue-noise-stipple": return drawBlueNoiseStipple(p, layer);
 case "spaced-symbols": return drawSpacedSymbols(p, layer);
 case "relaxed-stones": return drawRelaxedStones(p, layer);
 case "centroid-trails": return drawCentroidTrails(p, layer);
 case "packed-posters": return drawPackedPosters(p, layer);
 case "aspect-tiles": return drawAspectTiles(p, layer);
 case "obstacle-roads": return drawObstacleRoads(p, layer);
 case "arrival-contours": return drawArrivalContours(p, layer);
 default: throw new Error("Unknown paths technique");
 }
}
