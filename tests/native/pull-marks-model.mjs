#!/usr/bin/env node
/**
 * Focused pure-model checks for the PullMarks starter: retained field/grid/contour
 * identity, radius/power rebuild behavior, and reset semantics. Cross-checked against
 * a real RadialPull2D + ClosedSpline2D Java reference run (grid 62 paths of length 248;
 * grid[0][0] = 16,16; contour[0][0] = 182.22866612120552,217.14349528239387) before
 * this test was written.
 * Scoped conformance check, not the full CP2-milestone render/evidence apparatus.
 */
import assert from "node:assert/strict";
import { createPullMarks } from "../../packages/javascript/examples/pull-marks/pull-marks.js";

function main() {
  const composition = createPullMarks();
  assert.equal(composition.gridOutput.length, 62, "62 scanline paths");
  assert.equal(composition.gridOutput[0].length, 248, "each scanline has 248 samples");
  assert.deepEqual(composition.gridOutput[0][0], [16, 16],
    "grid[0][0] matches the real RadialPull2D reference run (outside every influence radius)");
  assert.equal(composition.contourOutput.length, 3, "3 retained closed-spline contours");
  assert.deepEqual(composition.contourOutput[0][0], [182.22866612120552, 217.14349528239387],
    "contour[0][0] matches the real RadialPull2D+ClosedSpline2D reference run");

  const baseGrid00 = composition.gridOutput[0][0];
  const baseGridKey = JSON.stringify(composition.gridOutput);
  composition.toggleRadius();
  assert.equal(composition.radius, 180.0, "radius toggled to 180");
  const widerGridKey = JSON.stringify(composition.gridOutput);
  assert.notEqual(widerGridKey, baseGridKey, "wider radius changes the grid output (affects points beyond the old radius)");

  composition.togglePower();
  assert.equal(composition.power, 0.5, "power toggled to 0.5");
  composition.toggleAlternate();
  assert.equal(composition.alternate, true);
  composition.toggleContoursMode();
  assert.equal(composition.contoursMode, true);

  composition.reset();
  assert.equal(composition.radius, 120.0, "reset restores radius 120");
  assert.equal(composition.power, 2.0, "reset restores power 2.0");
  assert.equal(composition.alternate, false, "reset restores base palette");
  assert.equal(composition.contoursMode, false, "reset restores grid mode");
  assert.deepEqual(composition.gridOutput[0][0], baseGrid00, "reset restores byte-identical grid output");

  return { gridPaths: 62, contourPaths: 3, baseGrid00 };
}

const scenarios = main();
console.log(JSON.stringify({ status: "passed", scenarios }));
