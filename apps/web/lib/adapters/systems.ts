import type { Layer } from "../studio-types";
import { drawSystemsA, systemsADefinitions } from "./systems-a";
import { drawStreamRibbons, drawCurvedTrajectories, drawWovenRows, drawTriangleGlyphs, drawSwirlingParticles, drawFlowNeedles } from "../../../../packages/javascript/examples/systems-a-studies.js";
import { systemsBDefinitions } from "./systems-b";
import { drawRippleInterference, drawPinnedWaves, drawBranchingSentences, drawWovenGrammar, drawTurtleCanopies, drawRecursiveTiles, drawCompatibleMosaics, drawTiledCircuits, drawMazeGardens, drawBranchingNetworks } from "../../../../packages/javascript/examples/systems-b-studies.js";
export const systemsDefinitions = [...systemsADefinitions, ...systemsBDefinitions];
export function drawSystems(p: any, layer: Layer): void {
 switch(layer.technique) {
 case "stream-ribbons": return drawStreamRibbons(p, layer);
 case "curved-trajectories": return drawCurvedTrajectories(p, layer);
 case "reaction-spots": return drawSystemsA(p, layer);
 case "reaction-stripes": return drawSystemsA(p, layer);
 case "organic-cells": return drawSystemsA(p, layer);
 case "geometric-generations": return drawSystemsA(p, layer);
 case "woven-rows": return drawWovenRows(p, layer);
 case "triangle-glyphs": return drawTriangleGlyphs(p, layer);
 case "swirling-particles": return drawSwirlingParticles(p, layer);
 case "flow-needles": return drawFlowNeedles(p, layer);
 case "ripple-interference": return drawRippleInterference(p, layer);
 case "pinned-waves": return drawPinnedWaves(p, layer);
 case "branching-sentences": return drawBranchingSentences(p, layer);
 case "woven-grammar": return drawWovenGrammar(p, layer);
 case "turtle-canopies": return drawTurtleCanopies(p, layer);
 case "recursive-tiles": return drawRecursiveTiles(p, layer);
 case "compatible-mosaics": return drawCompatibleMosaics(p, layer);
 case "tiled-circuits": return drawTiledCircuits(p, layer);
 case "maze-gardens": return drawMazeGardens(p, layer);
 case "branching-networks": return drawBranchingNetworks(p, layer);
 default: throw new Error("Unknown systems technique");
 }
}
