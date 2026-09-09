#!/usr/bin/env node
/**
 * Focused pure-model checks for the ImageFieldMarks starter: grid point count
 * and positions (from the accepted regularGrid core), sampled brightness (from
 * the accepted bilinearRasterRemap2D core, already verified against Java in the
 * WarpMarks port), and this composition's own new logic -- the per-point
 * visibility skip/diameter formula and source/color selection -- checked
 * against an independent computation from the same sampling backend.
 */
import assert from "node:assert/strict";
import { regularGrid } from "../../packages/javascript/src/regular-grid.js";
import { bilinearRasterRemap2D } from "../../packages/javascript/src/raster-remap.js";
import { createImageFieldMarks } from "../../packages/javascript/examples/image-field-marks/image-field-marks.js";

// Radial brightness (bright center, dark edges), not a periodic pattern -- a
// period aligned with the 16px grid spacing would sample only one parity at
// every point. This genuinely varies across grid positions instead.
function radialRaster(width, height) {
  const pixels = new Array(width * height);
  const cx = width / 2, cy = height / 2, maxDist = Math.hypot(cx, cy);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = Math.max(0, 1 - Math.hypot(x - cx, y - cy) / maxDist);
      const v = Math.round(t * 255);
      pixels[y * width + x] = ((0xff << 24) | (v << 16) | (v << 8) | v) >>> 0;
    }
  }
  return { width, height, pixels };
}

function gradientRaster(width, height) {
  const pixels = new Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = Math.round((x / (width - 1)) * 255);
      pixels[y * width + x] = ((0xff << 24) | (t << 16) | (t << 8) | t) >>> 0;
    }
  }
  return { width, height, pixels };
}

function main() {
  const width = 720, height = 480;
  const sourceA = radialRaster(width, height);
  const sourceB = gradientRaster(width, height);
  const composition = createImageFieldMarks([sourceA, sourceB]);

  // Grid: 45x30 points from the accepted regularGrid core.
  const grid = regularGrid({ origin: [8, 8], spacing: [16, 16], columns: 45, rows: 30 });
  assert.equal(composition.pointCount, grid.size);
  assert.equal(composition.pointCount, 1350);
  const point = new Float64Array(2);
  grid.pointInto(0, point, 0);
  assert.deepEqual([composition.positions[0], composition.positions[1]], [point[0], point[1]]);
  grid.pointInto(grid.size - 1, point, 0);
  assert.deepEqual([composition.positions[(grid.size - 1) * 2], composition.positions[(grid.size - 1) * 2 + 1]], [point[0], point[1]]);

  // Independently sample the same raster/positions through the same accepted
  // remap core, to check this module's own skip/diameter/argb logic (not the
  // remap arithmetic itself, which is already verified elsewhere).
  function expectedDots(raster, visibility, sourceColors) {
    const pairs = new Array(grid.size);
    for (let i = 0; i < grid.size; i += 1) pairs[i] = [composition.positions[i * 2], composition.positions[i * 2 + 1]];
    const remapped = bilinearRasterRemap2D({ source: raster, outputWidth: grid.size, outputHeight: 1, sourceCoordinates: pairs });
    const out = [];
    for (let i = 0; i < grid.size; i += 1) {
      const argb = remapped.pixelAt(i) >>> 0;
      const brightness = Math.max((argb >>> 16) & 255, (argb >>> 8) & 255, argb & 255) / 255.0;
      if (visibility && brightness >= 0.65) continue;
      const diameter = visibility ? 10 : 2 + 12 * (1 - brightness);
      out.push({ x: composition.positions[i * 2], y: composition.positions[i * 2 + 1], diameter, argb: sourceColors ? argb : null });
    }
    return out;
  }

  // Default state: source 0, no visibility mode, no source colors.
  assert.equal(composition.sourceIndex, 0);
  assert.equal(composition.visibility, false);
  const dotsDefault = composition.dots;
  const expectedDefault = expectedDots(sourceA, false, false);
  assert.equal(dotsDefault.length, expectedDefault.length, "no points skipped when visibility mode is off");
  assert.equal(dotsDefault.length, grid.size);
  for (let i = 0; i < dotsDefault.length; i += 1) {
    assert.equal(dotsDefault[i].x, expectedDefault[i].x);
    assert.equal(dotsDefault[i].y, expectedDefault[i].y);
    assert.equal(dotsDefault[i].diameter, expectedDefault[i].diameter, `dot ${i} diameter`);
  }

  // Visibility mode: bright points (>=0.65) are skipped, others get diameter 10.
  composition.toggleVisibility();
  assert.equal(composition.visibility, true);
  const dotsVisibility = composition.dots;
  const expectedVisibility = expectedDots(sourceA, true, false);
  assert.equal(dotsVisibility.length, expectedVisibility.length);
  assert.ok(dotsVisibility.length > 0 && dotsVisibility.length < grid.size,
    "visibility mode keeps some points and skips others on the radial source");
  for (const dot of dotsVisibility) assert.equal(dot.diameter, 10);
  composition.toggleVisibility();

  // Source toggle: switches which retained raster is sampled.
  composition.toggleSource();
  assert.equal(composition.sourceIndex, 1);
  const dotsSourceB = composition.dots;
  const expectedSourceB = expectedDots(sourceB, false, false);
  for (let i = 0; i < dotsSourceB.length; i += 1) assert.equal(dotsSourceB[i].diameter, expectedSourceB[i].diameter, `source B dot ${i}`);
  composition.toggleSource();
  assert.equal(composition.sourceIndex, 0);

  // Source colors: dots carry the sampled ARGB.
  composition.toggleSourceColors();
  assert.equal(composition.sourceColors, true);
  assert.equal(composition.dots[0].argb, composition.argbAt(0));

  return { pointCount: composition.pointCount, defaultDots: dotsDefault.length, visibilityDots: dotsVisibility.length };
}

const result = main();
console.log(JSON.stringify({ status: "passed", ...result }));
