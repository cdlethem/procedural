#!/usr/bin/env node
/**
 * Focused pure-model checks for the BodyMarks starter: retained head/spine
 * identity, tick advance, taper/centerline toggles, and reset semantics.
 * Cross-checked against a real GradientNoise2D01 + RegularGrid + GradientPath2D
 * Java reference run before this test was written: heads[0..3]=160,200,270,200;
 * after one tick heads[0..3]=159.43656887449393,196.0398806373026,
 * 266.70890797155505,197.72651957116275; spine0.point[5]=161.41900122489443,
 * 215.9027382883751 heading[5]=7.8712447559613485; phaseFor(0) before any tick
 * =0.1455013970070159.
 * Scoped conformance check, not the full CP2-milestone render/evidence apparatus.
 */
import assert from "node:assert/strict";
import { createBodyMarks } from "../../packages/javascript/examples/body-marks/body-marks.js";

function main() {
  const composition = createBodyMarks();
  assert.deepEqual(Array.from(composition.heads.slice(0, 4)), [160, 200, 270, 200],
    "initial head layout matches the real RegularGrid Java reference run");
  assert.equal(composition.tick, 0, "starts at tick 0");
  assert.equal(composition.running, false, "starts paused");
  assert.equal(composition.centerlines, false, "starts in body mode");
  assert.equal(composition.taperExponent, 0.7, "default taper exponent is 0.7");
  assert.equal(composition.spines.length, 12, "12 retained heads/spines");

  const phase0 = composition.phaseFor(0);
  assert.equal(phase0, 0.1455013970070159, "phaseFor(0) matches the real Java reference run");

  composition.advanceTick();
  assert.equal(composition.tick, 1, "tick advances to 1");
  assert.deepEqual(Array.from(composition.heads.slice(0, 4)),
    [159.43656887449393, 196.0398806373026, 266.70890797155505, 197.72651957116275],
    "post-tick heads match the real GradientPath2D Java reference run");

  const point = [0, 0];
  composition.spines[0].pointInto(5, point, 0);
  assert.deepEqual(point, [161.41900122489443, 215.9027382883751],
    "spine0 point[5] matches the real Java reference run");
  assert.equal(composition.spines[0].headingAt(5), 7.8712447559613485,
    "spine0 heading[5] matches the real Java reference run");

  composition.toggleCenterlines();
  assert.equal(composition.centerlines, true);
  composition.toggleTaper();
  assert.equal(composition.taperExponent, 2.0, "taper toggled to 2.0");
  assert.notEqual(composition.halfWidth(0), 0, "halfWidth(0) is always full HALF_WIDTH regardless of taper");
  assert.equal(composition.halfWidth(0), 12, "halfWidth(0) is exactly HALF_WIDTH (1^exponent == 1)");

  composition.reset();
  assert.equal(composition.tick, 0, "reset restores tick 0");
  assert.equal(composition.running, false, "reset restores paused");
  assert.equal(composition.centerlines, false, "reset restores body mode");
  assert.equal(composition.taperExponent, 0.7, "reset restores default taper");
  assert.deepEqual(Array.from(composition.heads.slice(0, 4)), [160, 200, 270, 200],
    "reset restores the identical initial head layout");

  return { headCount: 12, phase0, halfWidth0: 12 };
}

const scenarios = main();
console.log(JSON.stringify({ status: "passed", scenarios }));
