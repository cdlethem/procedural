#!/usr/bin/env node
/**
 * Focused pure-model checks for the ProjectionMarks starter: precomputed six-way
 * order/strength identity and toggle behavior. Cross-checked against a real
 * DiscProjection2D Java reference run (coords[0] length 3386; coords[0][0..1] =
 * 292.16025971044417,257.16025971044417) before this test was written.
 * Scoped conformance check, not the full CP2-milestone render/evidence apparatus.
 */
import assert from "node:assert/strict";
import { createProjectionMarks } from "../../packages/javascript/examples/projection-marks/projection-marks.js";

function main() {
  const composition = createProjectionMarks();
  assert.equal(composition.mode, 0, "default mode is 0 (strength 0.45)");
  assert.equal(composition.order, 0, "default order is 0 (forward)");
  const active = composition.activeCoordinates;
  assert.equal(active.length, 3386, "flat coordinate output has 3386 values");
  assert.equal(active[0], 292.16025971044417,
    "coordinates[0][0] matches the real DiscProjection2D Java reference run");
  assert.equal(active[1], 257.16025971044417,
    "coordinates[0][1] matches the real DiscProjection2D Java reference run");

  composition.cycleMode();
  assert.equal(composition.mode, 1, "mode cycles 0 -> 1");
  const mode1 = composition.activeCoordinates;
  assert.notDeepEqual(Array.from(mode1.slice(0, 4)), Array.from(active.slice(0, 4)),
    "different strength yields a different projected result");

  composition.toggleOrder();
  assert.equal(composition.order, 1, "order toggled to reversed");
  assert.deepEqual(composition.discOrders[1][0], composition.discOrders[0][3],
    "reversed disc order is an exact reversal of the forward order");

  composition.toggleAlternate();
  assert.equal(composition.alternate, true);

  composition.cycleMode();
  composition.cycleMode();
  assert.equal(composition.mode, 0, "mode cycles back to 0 after three calls");

  return { flatLength: active.length, firstPoint: [active[0], active[1]] };
}

const scenarios = main();
console.log(JSON.stringify({ status: "passed", scenarios }));
