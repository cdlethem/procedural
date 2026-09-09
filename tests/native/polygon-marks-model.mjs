#!/usr/bin/env node
/**
 * Focused pure-model checks for the PolygonMarks starter: seeded placement identity,
 * shape/ratio/seed rebuild behavior, and reset semantics. Cross-checked against a real
 * java.util.Random(42) + ConvexPolygonPlacements2D reference run (size 110; placement 0
 * source 0, vertexCount 12, x0/y0 350.0649600344394/336.6061614968339; last source 573)
 * before this test was written.
 * Scoped conformance check, not the full CP2-milestone render/evidence apparatus.
 */
import assert from "node:assert/strict";
import { createPolygonMarks } from "../../packages/javascript/examples/polygon-marks/polygon-marks.js";

function main() {
  const composition = createPolygonMarks();
  const placements = composition.placements;
  assert.equal(placements.size, 110, "seeded 600-proposal capsule filter keeps 110");
  assert.equal(placements.sourceIndexAt(0), 0);
  assert.equal(placements.vertexCountAt(0), 12, "capsule outlines have 12 vertices");
  assert.equal(placements.xAt(0, 0), 350.0649600344394,
    "placement 0 vertex 0 x matches the real java.util.Random(42) reference run");
  assert.equal(placements.yAt(0, 0), 336.6061614968339,
    "placement 0 vertex 0 y matches the real java.util.Random(42) reference run");
  assert.equal(placements.sourceIndexAt(placements.size - 1), 573,
    "last kept placement's source index matches the reference run");

  composition.toggleShape();
  assert.equal(composition.shape, 1, "shape toggled to diamond");
  assert.equal(composition.placements.vertexCountAt(0), 4, "diamond outlines have 4 vertices");
  const diamondSize = composition.placements.size;

  composition.toggleRatio();
  assert.equal(composition.ratio, 0.2, "ratio toggled to 0.2");
  const thinDiamondSize = composition.placements.size;
  assert.notEqual(thinDiamondSize, diamondSize, "thinner ratio changes the kept count");

  composition.nextSeed();
  assert.equal(composition.seed, 43, "seed advanced to 43");
  const seed43Size = composition.placements.size;

  composition.reset();
  assert.equal(composition.seed, 42, "reset restores seed 42");
  assert.equal(composition.ratio, 0.8, "reset restores ratio 0.8");
  assert.equal(composition.shape, 0, "reset restores capsule shape");
  assert.equal(composition.placements.size, 110, "reset restores the identical 110-placement layout");
  assert.equal(composition.placements.xAt(0, 0), 350.0649600344394, "reset restores byte-identical vertex 0");

  return { baseSize: 110, diamondSize, thinDiamondSize, seed43Size };
}

const scenarios = main();
console.log(JSON.stringify({ status: "passed", scenarios }));
