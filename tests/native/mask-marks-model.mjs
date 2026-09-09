#!/usr/bin/env node
/**
 * Focused pure-model checks for the MaskMarks starter: coverage extraction
 * (alpha/255, RGB ignored) and all three displayed modes, compared pixel-by-
 * pixel against a real MaskedComposite2D/RasterCrossfade2D Java reference run
 * on the same synthetic 4x3 rasters (saved before this test was written),
 * plus showMask passthrough and mode cycling.
 */
import assert from "node:assert/strict";
import { createMaskMarks } from "../../packages/javascript/examples/mask-marks/mask-marks.js";

const W = 4, H = 3;
const GROUND = [0xff111111, 0xff222222, 0xff333333, 0xff444444,
  0xff555555, 0xff666666, 0xff777777, 0xff888888,
  0xff999999, 0xff0a0a0a, 0xff0b0b0b, 0xff0c0c0c];
const MARKS = [0xffff0000, 0x8000ff00, 0x000000ff, 0xff00ff00,
  0x40ff00ff, 0xffffff00, 0x00000000, 0xff123456,
  0xff654321, 0x7fabcdef, 0x01010101, 0xff000001];
const SOURCE = [0xff112233, 0xff445566, 0x00778899, 0xffaabbcc,
  0x55ddeeff, 0xff001122, 0xff334455, 0x00667788,
  0xff99aabb, 0xffccddee, 0x80ffeeff, 0xff110022];
const MASK = [0xff000000, 0x00ffffff, 0x80808080, 0x01111111,
  0xffff0000, 0x00000000, 0x40123456, 0xff654321,
  0x7fabcdef, 0x000000ff, 0x01010101, 0xff000000];

// Java reference output (MaskVerify.java, real MaskedComposite2D.compose and
// RasterCrossfade2D.mix on the rasters above).
const JAVA_MODE0 = [0xffff0000, 0xff222222, 0xff333333, 0xff444544,
  0xff804080, 0xff666666, 0xff777777, 0xff123456,
  0xff7f6e5d, 0xff0a0a0a, 0xff0b0b0b, 0xff000001];
const JAVA_MODE1 = [0xff112233, 0xff222222, 0xff333333, 0xff444445,
  0xff82888e, 0xff666666, 0xff666a6e, 0xff888888,
  0xff99a1aa, 0xff0a0a0a, 0xff0b0b0b, 0xff110022];
const JAVA_MODE2 = [0xff112233, 0x8000ff00, 0x00000000, 0xff01ff01,
  0x55ddeeff, 0xffffff00, 0x40334455, 0x00667788,
  0xff7f766e, 0x7fabcdef, 0x01565056, 0xff110022];
const JAVA_COVERAGE = [1.0, 0.0, 0x80 / 255.0, 0x01 / 255.0,
  1.0, 0.0, 0x40 / 255.0, 1.0,
  0x7f / 255.0, 0.0, 0x01 / 255.0, 1.0];

function raster(pixels) { return { width: W, height: H, pixels }; }

function assertRasterMatches(displayed, expected, label) {
  assert.equal(displayed.width, W, `${label}: width`);
  assert.equal(displayed.height, H, `${label}: height`);
  assert.equal(displayed.pixels.length, expected.length, `${label}: count`);
  for (let i = 0; i < expected.length; i += 1) {
    assert.equal(displayed.pixels[i] >>> 0, expected[i], `${label} pixel ${i}`);
  }
}

function main() {
  const composition = createMaskMarks(raster(GROUND), raster(SOURCE), raster(MARKS), raster(MASK));

  // Coverage: alpha/255 per pixel; RGB values are irrelevant.
  for (let i = 0; i < JAVA_COVERAGE.length; i += 1) {
    assert.equal(composition.coverage[i], JAVA_COVERAGE[i], `coverage pixel ${i}`);
  }
  // Opaque black and opaque white both yield one (mask RGB is ignored).
  assert.equal(composition.coverage[0], 1.0, "opaque black mask pixel yields full coverage");
  assert.equal(composition.coverage[1], 0.0, "fully transparent white mask pixel yields zero coverage");

  // Mode 0: marks over ground through the mask.
  assert.equal(composition.mode, 0);
  assertRasterMatches(composition.displayed, JAVA_MODE0, "mode0");

  // Mode 1: source over ground through the mask.
  composition.cycleMode();
  assert.equal(composition.mode, 1);
  assertRasterMatches(composition.displayed, JAVA_MODE1, "mode1");

  // Mode 2: crossfade marks->source weighted by the mask.
  composition.cycleMode();
  assert.equal(composition.mode, 2);
  assertRasterMatches(composition.displayed, JAVA_MODE2, "mode2");

  // Cycling wraps back to mode 0.
  composition.cycleMode();
  assert.equal(composition.mode, 0);

  // V: showMask displays the raw mask raster (transparent regions included).
  composition.toggleShowMask();
  assert.equal(composition.showMask, true);
  assertRasterMatches(composition.displayed, MASK, "showMask");
  composition.toggleShowMask();
  assert.equal(composition.showMask, false);
  assertRasterMatches(composition.displayed, JAVA_MODE0, "mode0 after mask off");

  // Dimension mismatch is rejected.
  assert.throws(
    () => createMaskMarks(raster(GROUND), raster(SOURCE), raster(MARKS), { width: W + 1, height: H, pixels: MASK }),
    /share dimensions/,
  );

  return { modes: 3, pixelsPerMode: W * H };
}

const result = main();
console.log(JSON.stringify({ status: "passed", ...result }));
