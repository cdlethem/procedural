#!/usr/bin/env node
/**
 * Focused pure-model checks for the MaskedPartitionMarks starter: the portable
 * compositeMaskedRegions kernel, cross-checked pixel-by-pixel against a real
 * Java2DRegions.renderMasked run with an irregular, non-frame-clipped
 * checkerboard coverage raster (saved before this test was written, proving
 * mask pixels apply across the whole destination, not just the region's own
 * frame), plus path tracing, region partition, and mode/layout dispatch.
 */
import assert from "node:assert/strict";
import { createMaskedPartitionMarks, compositeMaskedRegions } from "../../packages/javascript/examples/masked-partition-marks/masked-partition-marks.js";

function flatRaster(width, height, argb) {
  return { width, height, pixels: new Array(width * height).fill(argb >>> 0) };
}

function assertRasterMatches(raster, expected, label) {
  assert.equal(raster.pixels.length, expected.length, `${label}: count`);
  for (let i = 0; i < expected.length; i += 1) assert.equal(raster.pixels[i] >>> 0, expected[i], `${label} pixel ${i}`);
}

// Java2DRegions.renderMasked reference (PartitionVerify.java, real Processing
// JAVA2D run): W=6,H=4, region A's checkerboard coverage and region B's uniform
// 0.5 coverage both apply across the FULL destination (not clipped to their own
// [0,3) / [3,6) frames), proving renderMasked's real non-clipping semantics.
const JAVA_MASKED = [
  0xff2ba583, 0xff1b2750, 0xff2ba583, 0xff1b2750, 0xff2ba583, 0xff1b2750,
  0xff1b2750, 0xff2ba583, 0xff1b2750, 0xff2ba583, 0xff1b2750, 0xff2ba583,
  0xff2ba583, 0xff1b2750, 0xff2ba583, 0xff1b2750, 0xff2ba583, 0xff1b2750,
  0xff1b2750, 0xff2ba583, 0xff1b2750, 0xff2ba583, 0xff1b2750, 0xff2ba583,
];

function main() {
  const W = 6, H = 4;
  const ground = flatRaster(W, H, 0xff101010);
  const covA = new Array(W * H);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) covA[y * W + x] = (x + y) % 2 === 0 ? 1.0 : 0.0;
  const covB = new Array(W * H).fill(0.5);
  const regionA = { id: 1, left: 0, top: 0, right: 3, bottom: 4 };
  const regionB = { id: 2, left: 3, top: 0, right: 6, bottom: 4 };
  const green = flatRaster(W, H, 0xff28c85a);
  const blue = flatRaster(W, H, 0xa0325adc);
  let callCount = 0;
  const contentRasterFor = () => { callCount += 1; return callCount === 1 ? green : blue; };
  const masked = compositeMaskedRegions(ground, [{ region: regionA, coverage: covA }, { region: regionB, coverage: covB }], contentRasterFor);
  assertRasterMatches(masked, JAVA_MASKED, "masked");
  assert.equal(callCount, 2, "content is invoked once per region");

  // Composition: 24 deterministic gradient-field paths (portable, no canvas).
  const composition = createMaskedPartitionMarks(flatRaster(720, 480, 0xfff5efe1));
  assert.equal(composition.paths.length, 24);
  const first = new Float64Array(2);
  composition.paths[0].pointInto(0, first, 0);
  assert.deepEqual([first[0], first[1]], [50, 55], "path 0 starts at its authored start point");
  const second = new Float64Array(2);
  composition.paths[7].pointInto(0, second, 0);
  // path 7: i%6=1 -> x=50+120=170; floor(7/6)=1 -> y=55+120=175.
  assert.deepEqual([second[0], second[1]], [170, 175], "path 7 starts at its grid position");
  // Retracing the same config is deterministic (same seed/field/start).
  const retraced = new Float64Array(2);
  composition.paths[0].pointInto(60, retraced, 0);
  const check = new Float64Array(2);
  composition.paths[0].pointInto(60, check, 0);
  assert.deepEqual(Array.from(retraced), Array.from(check), "path evaluation is deterministic");

  // Regions: default layout (X=360) gives four equal 324x204 quadrants, matching
  // LayerMarks's fixed layout, since 360 is the true midpoint of [36,684].
  assert.equal(composition.regions.length, 4);
  for (const r of composition.regions) assert.deepEqual([r.right - r.left, r.bottom - r.top], [324, 204]);

  // N: alternate layout uses X=430, an off-center split -> unequal region widths.
  composition.toggleAlternateLayout();
  assert.equal(composition.alternateLayout, true);
  const widths = composition.regions.map((r) => r.right - r.left).sort((a, b) => a - b);
  assert.deepEqual(widths, [254, 254, 394, 394], "alternate layout splits unevenly at X=430");

  // Mode dispatch: mode 0 is canvas space, modes 1-2 are local space.
  assert.equal(composition.mode, 0);
  assert.equal(composition.space, "canvas");
  composition.cycleMode();
  assert.equal(composition.space, "local");
  composition.cycleMode();
  assert.equal(composition.space, "local");
  composition.cycleMode();
  assert.equal(composition.mode, 0, "mode wraps back to 0 after three states");

  // Reset with a changed layout rebuilds geometry and reports it; reset with an
  // unchanged layout does not. alternateLayout is currently true (set above);
  // bring mode to a nonzero state first.
  composition.cycleMode();
  assert.equal(composition.alternateLayout, true);
  return finishReset(composition);
}

function finishReset(composition) {
  composition.cycleMode();
  const changed = composition.reset();
  assert.equal(changed, true, "reset reports a layout change when alternateLayout was on");
  assert.equal(composition.alternateLayout, false);
  assert.equal(composition.mode, 0);
  const widths = composition.regions.map((r) => r.right - r.left).sort((a, b) => a - b);
  assert.deepEqual(widths, [324, 324, 324, 324], "reset restores the default even layout");

  composition.cycleMode();
  const unchanged = composition.reset();
  assert.equal(unchanged, false, "reset reports no layout change when alternateLayout was already off");
  assert.equal(composition.mode, 0);

  return { pathCount: composition.paths.length, regionCount: composition.regions.length };
}

const result = main();
console.log(JSON.stringify({ status: "passed", ...result }));
