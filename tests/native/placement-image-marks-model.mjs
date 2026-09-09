#!/usr/bin/env node
/**
 * Focused pure-model checks for the PlacementImageMarks starter: crop
 * extraction (array-only, no drawing) and the fit/align placement rectangle
 * formula, checked against hand-computed expected values for all three fit
 * modes, both crop states, and all three alignment states -- transcribed
 * directly from Java2DImagePlacement.render's arithmetic (min/max scale plus
 * linear alignment interpolation, simple enough to verify by inspection
 * rather than a Java scratch run) -- plus the masked/full-coverage compose
 * dispatch.
 */
import assert from "node:assert/strict";
import { createPlacementImageMarks, cropRaster, placementRect } from "../../packages/javascript/examples/placement-image-marks/placement-image-marks.js";

function flatRaster(width, height, argb) {
  return { width, height, pixels: new Array(width * height).fill(argb >>> 0) };
}

function assertRectClose(rect, expected, label) {
  for (const key of ["x", "y", "width", "height"]) {
    assert.ok(Math.abs(rect[key] - expected[key]) < 1e-9, `${label}.${key}: ${rect[key]} !== ${expected[key]}`);
  }
}

function main() {
  // Crop extraction: a 4x2 source, cropping a 2x2 rectangle at (1,0).
  const source4x2 = { width: 4, height: 2, pixels: [1, 2, 3, 4, 5, 6, 7, 8] };
  const crop = cropRaster(source4x2, 1, 0, 2, 2);
  assert.deepEqual(crop, { width: 2, height: 2, pixels: [2, 3, 6, 7] });
  assert.throws(() => cropRaster(source4x2, 3, 0, 2, 2), /outside source/);

  const frame = { x: 80, y: 60, width: 560, height: 360 };

  // Uncropped source (320x160): all three fit modes at center alignment (0.5,0.5).
  assertRectClose(placementRect(320, 160, frame, "contain", 0.5, 0.5), { x: 80, y: 100, width: 560, height: 280 }, "contain uncropped center");
  assertRectClose(placementRect(320, 160, frame, "cover", 0.5, 0.5), { x: 0, y: 60, width: 720, height: 360 }, "cover uncropped center");
  assertRectClose(placementRect(320, 160, frame, "stretch", 0.5, 0.5), { x: 80, y: 60, width: 560, height: 360 }, "stretch uncropped center");

  // Cover, uncropped, at the two extreme alignments (the frame is narrower
  // than the scaled cover image, so alignX actually moves the destination).
  assertRectClose(placementRect(320, 160, frame, "cover", 0, 0), { x: 80, y: 60, width: 720, height: 360 }, "cover align 0");
  assertRectClose(placementRect(320, 160, frame, "cover", 1, 1), { x: -80, y: 60, width: 720, height: 360 }, "cover align 1");

  // Cropped source (160x160, contain): both extreme horizontal alignments.
  assertRectClose(placementRect(160, 160, frame, "contain", 0, 0), { x: 80, y: 60, width: 360, height: 360 }, "contain cropped align 0");
  assertRectClose(placementRect(160, 160, frame, "contain", 1, 1), { x: 280, y: 60, width: 360, height: 360 }, "contain cropped align 1");
  assertRectClose(placementRect(160, 160, frame, "contain", 0.5, 0.5), { x: 180, y: 60, width: 360, height: 360 }, "contain cropped align 0.5");

  // Composition state machine, matching Java's Fit.values() order (CONTAIN,
  // COVER, STRETCH) and alignment cycle (1 -> 2 -> 0 -> 1, i.e. 0.5,1.0,0.0).
  const source = flatRaster(320, 160, 0xffaabbcc);
  const ground = flatRaster(720, 480, 0xfff1ebdb);
  const maskCoverage = new Array(720 * 480).fill(0.5);
  const composition = createPlacementImageMarks(source, ground, maskCoverage);

  assert.equal(composition.fitMode, "contain");
  assert.equal(composition.cropped, false);
  assert.equal(composition.align, 0.5);
  assertRectClose(composition.placement.rect, { x: 80, y: 100, width: 560, height: 280 }, "default placement");
  assert.deepEqual(composition.placement.isolated.width, 320);

  composition.cycleFit();
  assert.equal(composition.fitMode, "cover");
  composition.cycleFit();
  assert.equal(composition.fitMode, "stretch");
  composition.cycleFit();
  assert.equal(composition.fitMode, "contain", "fit wraps back to contain");

  composition.toggleCropped();
  assert.equal(composition.cropped, true);
  assert.deepEqual(composition.crop, { x: 80, y: 0, width: 160, height: 160 });
  assertRectClose(composition.placement.rect, { x: 180, y: 60, width: 360, height: 360 }, "cropped contain center");

  composition.cycleAlignment();
  assert.equal(composition.alignment, 2);
  assert.equal(composition.align, 1.0);
  composition.cycleAlignment();
  assert.equal(composition.alignment, 0);
  assert.equal(composition.align, 0.0);
  composition.cycleAlignment();
  assert.equal(composition.alignment, 1, "alignment wraps back to 1");

  // Compose: masked vs full-coverage dispatch (both reuse the accepted
  // raster.masked-source-over-2d core, already verified in MaskMarks).
  const placedRaster = flatRaster(720, 480, 0xff334455);
  const unmasked = composition.compose(placedRaster);
  assert.equal(composition.masked, false);
  assert.equal(unmasked.pixels[0] >>> 0, 0xff334455, "full coverage shows the placed content everywhere");
  composition.toggleMasked();
  const masked = composition.compose(placedRaster);
  assert.notEqual(masked.pixels[0] >>> 0, unmasked.pixels[0] >>> 0, "masked mode blends with the ground instead");

  return { fitModes: 3, alignmentStates: 3, cropStates: 2 };
}

const result = main();
console.log(JSON.stringify({ status: "passed", ...result }));
