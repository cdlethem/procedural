import type { Layer } from "../types.js";
import { drawPathsA, pathsADefinitions } from "./paths-a.js";

export const pathsDefinitions = pathsADefinitions;
export function drawPaths(p: Parameters<typeof drawPathsA>[0], layer: Layer): void {
  switch (layer.technique) {
    case "rounded-panels":
    case "flowing-brushes":
    case "contour-abstraction":
    case "gesture-skeletons":
    case "road-margins":
    case "nested-contour-strokes":
    case "faceted-silhouettes":
    case "concave-grain":
      return drawPathsA(p, layer);
    default: throw new Error("Unknown paths technique");
  }
}
