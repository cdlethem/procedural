#!/usr/bin/env node
/**
 * Focused pure-model checks for the LayerMarks starter: the portable region
 * coverage/compositing kernel (compositeRegions/regionCoverage), cross-checked
 * pixel-by-pixel against a real Java2DRegions.render Java reference run (three
 * scenarios: Space.CANVAS translation, Space.LOCAL translation, and a feathered
 * two-region strip -- saved before this test was written), plus the
 * composition's region partition and mode dispatch.
 */
import assert from "node:assert/strict";
import { createLayerMarks, compositeRegions } from "../../packages/javascript/examples/layer-marks/layer-marks.js";

function flatRaster(width, height, argb) {
  return { width, height, pixels: new Array(width * height).fill(argb >>> 0) };
}

function markerRaster(width, height) {
  const pixels = new Array(width * height).fill(0);
  pixels[0] = 0xffff0000; pixels[1] = 0xffff0000;
  pixels[width] = 0xffff0000; pixels[width + 1] = 0xffff0000;
  return { width, height, pixels };
}

function translateRaster(raster, dx, dy) {
  const { width, height, pixels } = raster;
  const out = new Array(width * height).fill(0);
  for (let y = 0; y < height; y += 1) {
    const ny = y + dy;
    if (ny < 0 || ny >= height) continue;
    for (let x = 0; x < width; x += 1) {
      const nx = x + dx;
      if (nx < 0 || nx >= width) continue;
      out[ny * width + nx] = pixels[y * width + x];
    }
  }
  return { width, height, pixels: out };
}

function assertRasterMatches(raster, expected, label) {
  assert.equal(raster.pixels.length, expected.length, `${label}: count`);
  for (let i = 0; i < expected.length; i += 1) assert.equal(raster.pixels[i] >>> 0, expected[i], `${label} pixel ${i}`);
}

// Java2DRegions.render reference values (LayerVerify.java, real Processing JAVA2D run).
function javaCanvasSpace() {
  const g = 0xff000000;
  const row = [0xffff0000, 0xffff0000, g, g, g, g, g, g, g, g];
  const black = new Array(10).fill(g);
  return [...row, ...row, ...black, ...black, ...black, ...black];
}
function javaLocalSpace() {
  const g = 0xff000000;
  const row = [0xffff0000, 0xffff0000, g, g, g, 0xffff0000, 0xffff0000, g, g, g];
  const black = new Array(10).fill(g);
  return [...row, ...row, ...black, ...black, ...black, ...black];
}
const JAVA_FEATHERED = [0xff404040, 0xff404040, 0xff404040, 0xff404040, 0xff404040,
  0xff202020, 0xff202020, 0xff202020, 0xff202020, 0xff202020];

function main() {
  // Scenario 1: Space.CANVAS -- every region draws the same unpositioned content;
  // only the coverage mask clips it, so the marker (fully inside region A) never
  // reaches region B's territory.
  const ground1 = flatRaster(10, 6, 0xff000000);
  const marker = markerRaster(10, 6);
  const regionsAB = [{ id: 1, left: 0, top: 0, right: 5, bottom: 6 }, { id: 2, left: 5, top: 0, right: 10, bottom: 6 }];
  const canvasSpace = compositeRegions(ground1, regionsAB, 0, () => marker);
  assertRasterMatches(canvasSpace, javaCanvasSpace(), "canvasSpace");

  // Scenario 2: Space.LOCAL -- content is translated to each region's origin
  // before drawing, so the marker reappears inside region B too.
  const localSpace = compositeRegions(ground1, regionsAB, 0, (region) => translateRaster(marker, region.left, region.top));
  assertRasterMatches(localSpace, javaLocalSpace(), "localSpace");

  // Scenario 3: feather ramp in a 1-pixel-tall strip -- the vertical distance to
  // the top/bottom edge (0.5px) binds everywhere, giving uniform 0.25 coverage
  // per region rather than a visible horizontal ramp; this is Java's real
  // behavior for this shape, not a simplification.
  const ground2 = flatRaster(10, 1, 0xff000000);
  const white = flatRaster(10, 1, 0xffffffff);
  const gray = flatRaster(10, 1, 0xff808080);
  const strip = [{ id: 1, left: 0, top: 0, right: 5, bottom: 1 }, { id: 2, left: 5, top: 0, right: 10, bottom: 1 }];
  const feathered = compositeRegions(ground2, strip, 2.0, (region) => (region.id === 1 ? white : gray));
  assertRasterMatches(feathered, JAVA_FEATHERED, "feathered");

  // Composition: region partition (four equal 324x204 quadrants from the fixed
  // 36,36,684,444 bounds cut at X=360, Y=240 in both halves) and mode dispatch.
  const composition = createLayerMarks(flatRaster(720, 480, 0xfff4eede));
  assert.equal(composition.regions.length, 4, "four quadrant regions");
  const dims = composition.regions.map((r) => [r.right - r.left, r.bottom - r.top]);
  for (const [w, h] of dims) assert.deepEqual([w, h], [324, 204], "every quadrant is 324x204");
  const lefts = composition.regions.map((r) => r.left).sort((a, b) => a - b);
  assert.deepEqual(lefts, [36, 36, 360, 360], "two regions at each X split");

  assert.equal(composition.mode, 0);
  assert.deepEqual(composition.modeInfo, { space: "canvas", feather: 0, contentKind: "picture" });
  composition.cycleMode();
  assert.deepEqual(composition.modeInfo, { space: "local", feather: 0, contentKind: "local" });
  composition.cycleMode();
  assert.deepEqual(composition.modeInfo, { space: "local", feather: 24, contentKind: "local" });
  composition.cycleMode();
  assert.equal(composition.modeInfo.space, "crossfade");
  composition.cycleMode();
  assert.equal(composition.mode, 0, "mode wraps back to 0");

  return { regionCount: composition.regions.length, scenarios: 3 };
}

const result = main();
console.log(JSON.stringify({ status: "passed", ...result }));
