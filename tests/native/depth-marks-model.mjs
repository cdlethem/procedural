#!/usr/bin/env node
/**
 * Focused pure-model checks for the DepthMarks starter: retained field/grid/mesh
 * identity, depth-toggle rebuild, and reset behavior.
 * Scoped conformance check, not the full CP2-milestone render/evidence apparatus.
 */
import assert from "node:assert/strict";
import { createDepthMarks } from "../../packages/javascript/examples/depth-marks/depth-marks.js";

function main() {
  const composition = createDepthMarks();
  assert.equal(composition.depth, 0.25, "default depth is 0.25");
  assert.equal(composition.grid.size, 3600, "60x60 grid has 3600 points");
  assert.equal(composition.mesh.faceCount(), 960, "32-slice 16-row open profile has 960 faces");
  assert.equal(composition.planarSamples.length, 3600, "one planar sample per grid point");
  assert.equal(composition.meshSamples.length, 960, "one mesh sample per face");

  const baseSamples = Array.from(composition.planarSamples.slice(0, 3));
  composition.toggleDepth();
  assert.equal(composition.depth, 1.25, "toggle 0.25 -> 1.25");
  const alteredSamples = Array.from(composition.planarSamples.slice(0, 3));
  assert.notDeepEqual(baseSamples, alteredSamples, "different depth slice yields different samples");

  composition.toggleAlternate();
  assert.equal(composition.alternate, true);
  composition.toggleMeshMode();
  assert.equal(composition.meshMode, true);

  composition.reset();
  assert.equal(composition.depth, 0.25, "reset restores depth 0.25");
  assert.equal(composition.alternate, false, "reset restores primary palette");
  assert.equal(composition.meshMode, false, "reset restores planar mode");
  assert.deepEqual(Array.from(composition.planarSamples.slice(0, 3)), baseSamples,
    "reset restores byte-identical samples");

  return { gridSize: composition.grid.size, faceCount: composition.mesh.faceCount(), baseSamples };
}

const scenarios = main();
console.log(JSON.stringify({ status: "passed", scenarios }));
