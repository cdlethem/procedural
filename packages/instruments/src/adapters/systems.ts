import type { Layer } from "../types.js";
import { drawSystemsA, systemsADefinitions } from "./systems-a.js";
import { drawSystemsB, systemsBDefinitions } from "./systems-b.js";

export const systemsDefinitions = [...systemsADefinitions, ...systemsBDefinitions];
export function drawSystems(p: Parameters<typeof drawSystemsB>[0] & Parameters<typeof drawSystemsA>[0], layer: Layer): void {
  switch (layer.technique) {
    case "reaction-spots":
    case "reaction-stripes":
    case "organic-cells":
    case "geometric-generations":
    case "swirling-particles":
    case "flow-needles":
      return drawSystemsA(p, layer);
    case "ripple-interference":
    case "pinned-waves":
    case "branching-sentences":
      return drawSystemsB(p, layer);
    default: throw new Error("Unknown systems technique");
  }
}
