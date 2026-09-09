#!/usr/bin/env node
/**
 * Focused pure-model checks for the BlurMarks starter: retained layer identity,
 * mode/blend behavior, and full blur/crossfade/composite pipeline correctness.
 * Cross-checked against a real SeparableBlur2D + RasterCrossfade2D +
 * MaskedComposite2D Java reference run on a synthetic 40x30 raster (striped
 * ground, semi-transparent circular artwork spot) before this test was written:
 * mode 2 + blended -> displayed[0]=0xff203141, displayed[mid]=0xff774641,
 * displayed[last]=0xff20313f, displayed[15*40+20]=0xff774641.
 * Scoped conformance check, not the full CP2-milestone render/evidence apparatus.
 */
import assert from "node:assert/strict";
import { createBlurMarks, triangular } from "../../packages/javascript/examples/blur-marks/blur-marks.js";

function syntheticRasters(width, height) {
  const ground = new Array(width * height);
  const artwork = new Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      ground[i] = (0xff000000 | ((Math.floor(x / 5) % 2 === 0) ? 0x203141 : 0x20313f)) >>> 0;
      const dx = x - Math.floor(width / 2), dy = y - Math.floor(height / 2);
      artwork[i] = dx * dx + dy * dy < 36 ? 0x9bf06441 : 0x00000000;
    }
  }
  return { ground: { width, height, pixels: ground }, artwork: { width, height, pixels: artwork } };
}

function main() {
  assert.deepEqual(triangular(2), [1, 2, 3, 2, 1], "triangular(2) is a symmetric tent");
  assert.equal(triangular(12).length, 25, "triangular(12) has 25 taps");

  const width = 40, height = 30;
  const { ground, artwork } = syntheticRasters(width, height);
  const composition = createBlurMarks(ground, artwork);
  assert.equal(composition.mode, 0, "default mode is 0 (sharp)");
  assert.equal(composition.blended, false, "default is not blended");
  assert.equal(composition.layerCount, 4, "4 retained layers (sharp + 3 blurred)");
  assert.equal(composition.filterCalls, 3, "construction performs exactly 3 blur filter calls");

  composition.cycleMode();
  composition.cycleMode();
  assert.equal(composition.mode, 2, "mode cycled to 2 (horizontal streak)");
  composition.toggleBlended();
  assert.equal(composition.blended, true);

  const displayed = composition.displayed;
  const p = displayed.pixels.map((v) => v >>> 0);
  assert.equal(p[0].toString(16), "ff203141", "displayed[0] matches the real Java reference run");
  assert.equal(p[Math.floor(height / 2) * width + Math.floor(width / 2)].toString(16), "ff774641",
    "displayed[mid] matches the real Java reference run");
  assert.equal(p[p.length - 1].toString(16), "ff20313f", "displayed[last] matches the real Java reference run");
  assert.equal(p[15 * width + 20].toString(16), "ff774641", "displayed[15,20] matches the real Java reference run");

  assert.equal(composition.filterCalls, 3, "mode/blend toggles never trigger additional blur filter calls");

  composition.cycleMode();
  composition.cycleMode();
  assert.equal(composition.mode, 0, "mode wraps back to 0 after 4 cycles");

  return { modes: composition.layerCount, filterCalls: composition.filterCalls };
}

const scenarios = main();
console.log(JSON.stringify({ status: "passed", scenarios }));
