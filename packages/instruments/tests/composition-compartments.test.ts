import assert from "node:assert/strict";
import test from "node:test";
import {
  boundCompartmentWork, bundledRaster, compartmentAngle, compartmentDrawRegions, compartmentFillKind, compartmentFiller, compartmentInk, compartmentOptions,
  compartmentPlan, compartmentRegions, componentSeed, coverCrop, createCompositionRun, createInstrument, createRaster, drawCompartments, drawInstrument,
  halftoneCentres, halftoneRadius, hatchSegments, hatchSpacing, inside, keptCompartments, nearestPaletteIndex, orientationField, orientationInRect,
  orientationPixel, referenceComposition, usesSeed, validateInstrument,
  type Compartment, type CompartmentFillSpec, type CompartmentOptions, type CompartmentsComposition, type CompositionSurface, type Raster,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.js";

const near = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const deepFrozen = (value: unknown): boolean =>
  value === null || typeof value !== "object" || (Object.isFrozen(value) && Object.values(value as object).every(deepFrozen));
/** Seeded stream for reproducible random rasters. */
const stream = (seed: number) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x1_0000_0000;

/** Opaque sRGB gray raster from a byte function. */
const gray = (width: number, height: number, byte: (x: number, y: number) => number, label = "test"): Raster => {
  const data = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[y * width + x] = byte(x, y);
  return createRaster({ width, height, channels: 1, format: "u8", colorSpace: "srgb", alpha: "none", data, label });
};
const rgb = (width: number, height: number, pixels: number[][]): Raster =>
  createRaster({ width, height, channels: 3, format: "u8", colorSpace: "srgb", alpha: "none", data: pixels.flat() });

/** Options with one canvas unit per source pixel, no error-driven splitting unless overridden. */
const optionsFor = (source: Raster, over: Partial<CompartmentOptions> = {}): CompartmentOptions => ({
  seed: 5, source, centerX: source.width / 2, centerY: source.height / 2, width: source.width, height: source.height,
  measure: "lightness", metric: "stddev", threshold: 0.01, minCell: 1, split: "quad", smoothing: 0, ...over,
});
const black = 0, white = 255;

// --- independent references -------------------------------------------------------------------------------

/** Leaves of the documented quadtree computed directly from pixels (no summed-area tables). */
function referenceLeaves(byte: (x: number, y: number) => number, w: number, h: number, threshold: number, minPx = 1): string[] {
  const out: string[] = [];
  const lightness = (b: number) => { const c = b / 255, y = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; return (y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y) / 100; };
  const visit = (x: number, y: number, cw: number, ch: number) => {
    const values: number[] = [];
    for (let j = y; j < y + ch; j++) for (let i = x; i < x + cw; i++) values.push(lightness(byte(i, j)));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
    const canX = cw >= 2 * minPx, canY = ch >= 2 * minPx;
    if (sd > threshold && (canX || canY)) {
      const hw = cw >> 1, hh = ch >> 1;
      if (canX && canY) { visit(x, y, hw, hh); visit(x + hw, y, cw - hw, hh); visit(x, y + hh, hw, ch - hh); visit(x + hw, y + hh, cw - hw, ch - hh); }
      else if (canX) { visit(x, y, hw, ch); visit(x + hw, y, cw - hw, ch); }
      else { visit(x, y, cw, hh); visit(x, y + hh, cw, ch - hh); }
    } else out.push(`${x},${y},${cw},${ch}`);
  };
  visit(0, 0, w, h);
  return out;
}
const encode = (linear: number) => (linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055);
const lstar = (y: number) => (y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y) / 100;

// --- the producer ------------------------------------------------------------------------------------------

test("a flat image stops at one cell; only maxCell divides it, on the documented halving", () => {
  const flat = gray(64, 64, () => white);
  const one = compartmentPlan(optionsFor(flat));
  assert.equal(one.cells.length, 1);
  const [root] = one.cells;
  assert.deepEqual([root.id, root.depth, root.parent, [...root.bounds]], ["r", 0, null, [0, 0, 64, 64]]);
  assert.deepEqual([root.value, root.error, root.spread, root.resolved, root.coverage, root.tone], [1, 0, 0, true, 1, 1]);
  for (const c of root.color) near(c, 1, 1e-12);
  assert.equal(root.orientation.defined, false);
  assert.equal(root.orientation.coherence, 0);
  // Sides above 20 split: 64 -> 32 -> 16, so 16 cells of 16.
  const forced = compartmentPlan(optionsFor(flat, { maxCell: 20 }));
  assert.equal(forced.cells.length, 16);
  assert.ok(forced.cells.every((cell) => cell.depth === 2 && cell.width === 16 && cell.height === 16 && cell.resolved));
  // Raising the threshold of a flat image is not an event: same partition.
  assert.deepEqual(compartmentPlan(optionsFor(flat, { threshold: 5, maxCell: 20 })).cells.map((c) => c.id), forced.cells.map((c) => c.id));
});

test("cells equal an independent quadtree of the pixels, tile the area exactly and measure their own pixels", () => {
  for (const edge of [20, 32, 45]) {
    const byte = (x: number) => (x < edge ? black : white);
    const source = gray(64, 64, byte);
    const plan = compartmentPlan(optionsFor(source, { threshold: 0.01 }));
    const expected = referenceLeaves(byte, 64, 64, 0.01);
    assert.deepEqual(plan.cells.map((c) => `${c.pixels.x},${c.pixels.y},${c.pixels.width},${c.pixels.height}`).sort(), expected.slice().sort(), `edge ${edge}`);
    near(plan.cells.reduce((sum, c) => sum + c.area, 0), 64 * 64);
    for (const cell of plan.cells) {
      // Mean and spread from the raw pixels: black is L = 0, white is L = 1.
      let whites = 0;
      for (let j = cell.pixels.y; j < cell.pixels.y + cell.pixels.height; j++) for (let i = cell.pixels.x; i < cell.pixels.x + cell.pixels.width; i++) whites += byte(i) === white ? 1 : 0;
      const n = cell.pixels.width * cell.pixels.height, p = whites / n;
      near(cell.value, p, 1e-12); near(cell.spread, Math.sqrt(p * (1 - p)), 1e-12); near(cell.error, cell.spread, 1e-12);
      assert.equal(cell.resolved, cell.error <= 0.01);
      assert.equal(cell.pixels.width * cell.pixels.height, n);
    }
  }
});

test("mean color is averaged in linear light and weighted by alpha; tone is CIE lightness of that color", () => {
  // Channel values 255 and 128 average in LINEAR light (1 and 0.2158), not as bytes (0.751); 0 and 1 alone cannot tell the spaces apart.
  const decode = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const bright = rgb(2, 1, [[255, 0, 0], [128, 0, 255]]);
  const [mixed] = compartmentPlan(optionsFor(bright, { threshold: 10 })).cells;
  const lr = (1 + decode(128 / 255)) / 2;
  near(mixed.color[0], encode(lr), 1e-6); near(mixed.color[1], 0, 1e-6); near(mixed.color[2], encode(0.5), 1e-6);
  near(mixed.tone, lstar(0.2126 * lr + 0.0722 * 0.5), 1e-6);
  assert.ok(Math.abs(mixed.color[0] - 0.751) > 0.05);
  // Opaque red beside fully transparent (hidden blue): the hidden color never contributes.
  const data = [255, 0, 0, 255, 0, 0, 255, 0];
  const halfAlpha = createRaster({ width: 2, height: 1, channels: 4, format: "u8", colorSpace: "srgb", alpha: "straight", data });
  const [red] = compartmentPlan(optionsFor(halfAlpha, { threshold: 10 })).cells;
  near(red.color[0], 1, 1e-6); near(red.color[1], 0, 1e-6); near(red.color[2], 0, 1e-6); near(red.coverage, 0.5);
  // Alpha 1 : 3 weights the average of white and black to a quarter white in linear light.
  const weighted = createRaster({ width: 2, height: 1, channels: 4, format: "u8", colorSpace: "srgb", alpha: "straight", data: [255, 255, 255, 64, 0, 0, 0, 192] });
  near(compartmentPlan(optionsFor(weighted, { threshold: 10, measure: "alpha" })).cells[0].color[0], encode(64 / 256), 1e-6);
  // A fully transparent source has no color and no coverage, and no cell is kept.
  const clear = createRaster({ width: 4, height: 4, channels: 4, format: "u8", colorSpace: "srgb", alpha: "straight", data: new Uint8Array(64) });
  const clearPlan = compartmentPlan(optionsFor(clear, { threshold: 10, measure: "alpha" }));
  assert.deepEqual([clearPlan.cells[0].coverage, clearPlan.cells[0].tone, [...clearPlan.cells[0].color]], [0, 0, [0, 0, 0]]);
  assert.equal(keptCompartments(clearPlan, 1, "chance").length, 0);
});

test("canvas cell limits convert to whole pixels: minCell rounds up, maxCell rounds down, and the plan tiles a non-uniform area", () => {
  const checker = gray(32, 32, (x, y) => ((x + y) & 1 ? white : black));
  // 100 units over 32 pixels: 3.125 units per pixel; 10 units needs ceil(3.2) = 4 pixels.
  const busy = compartmentPlan(optionsFor(checker, { width: 100, height: 100, centerX: 50, centerY: 50, minCell: 10 }));
  assert.equal(busy.minCellPixels, 4);
  assert.equal(busy.cells.length, 64);
  for (const cell of busy.cells) { assert.equal(cell.pixels.width, 4); near(cell.width, 12.5); assert.ok(cell.width >= 10); }
  const flat = gray(32, 32, () => 100);
  const fifty = compartmentPlan(optionsFor(flat, { width: 100, height: 100, centerX: 50, centerY: 50, maxCell: 50 }));
  assert.equal(fifty.maxCellPixels, 16);
  assert.equal(fifty.cells.length, 4);
  // 49 units is 15.68 pixels: floor gives 15, so 16-pixel cells must split again.
  const fortyNine = compartmentPlan(optionsFor(flat, { width: 100, height: 100, centerX: 50, centerY: 50, maxCell: 49 }));
  assert.equal(fortyNine.maxCellPixels, 15);
  assert.equal(fortyNine.cells.length, 16);
  assert.throws(() => compartmentPlan(optionsFor(flat, { width: 100, height: 100, centerX: 50, centerY: 50, minCell: 10, maxCell: 20 })), /maxCell 20 is too small for minCell 10/);
  // Independent x and y scales: the leaves still tile the rectangle exactly.
  const wide = compartmentPlan(optionsFor(checker, { width: 100, height: 50, centerX: 300, centerY: 200, threshold: 0.4, minCell: 3 }));
  near(wide.cells.reduce((sum, c) => sum + c.area, 0), 5000);
  assert.deepEqual([wide.mapping.x, wide.mapping.y], [250, 175]);
  for (const cell of wide.cells) assert.ok(cell.bounds[0] >= 250 - 1e-9 && cell.bounds[2] <= 350 + 1e-9 && cell.bounds[1] >= 175 - 1e-9 && cell.bounds[3] <= 225 + 1e-9);
});

test("raising the threshold only prunes: every coarse cell is a node of the finer tree with the same rectangle (all metrics and policies)", () => {
  const random = stream(11);
  for (const metric of ["stddev", "range", "variance", "sse"] as const) for (const split of ["quad", "longest", "best"] as const) {
    const noise = Array.from({ length: 48 * 48 }, () => Math.floor(random() * 256));
    const source = gray(48, 48, (x, y) => (x + y < 30 ? noise[y * 48 + x] : 200));
    const scale = metric === "sse" ? 40 : metric === "variance" ? 0.05 : 0.2;
    const fine = compartmentPlan(optionsFor(source, { metric, split, threshold: scale / 4, minCell: 2 }));
    const coarse = compartmentPlan(optionsFor(source, { metric, split, threshold: scale, minCell: 2 }));
    assert.ok(coarse.cells.length <= fine.cells.length);
    const nodes = new Map(fine.tree.map((node) => [node.id, node]));
    for (const cell of coarse.cells) {
      const node = nodes.get(cell.id);
      assert.ok(node, `${metric}/${split}: ${cell.id}`);
      assert.deepEqual([...node!.bounds], [...cell.bounds]);
    }
  }
});

test("the seed labels cells and never moves them; identical construction returns the same frozen plan", () => {
  const source = bundledRaster("portrait", 3, 64);
  const base = optionsFor(source, { threshold: 0.05, minCell: 2 });
  const a = compartmentPlan({ ...base, seed: 1 }), b = compartmentPlan({ ...base, seed: 2 });
  assert.equal(compartmentPlan({ ...base, seed: 1 }), a);
  assert.deepEqual(a.cells.map((c) => c.id), b.cells.map((c) => c.id));
  assert.deepEqual(a.cells.map((c) => c.bounds), b.cells.map((c) => c.bounds));
  assert.deepEqual(a.cells.map((c) => [c.value, c.error, c.color, c.orientation]), b.cells.map((c) => [c.value, c.error, c.color, c.orientation]));
  assert.notDeepEqual(a.cells.map((c) => c.seed), b.cells.map((c) => c.seed));
  for (const cell of a.cells) assert.equal(cell.seed, componentSeed(1, cell.id, "compartment"));
  assert.ok(deepFrozen(a) && deepFrozen(a.tree));
  assert.equal(a.sourceHash, source.hash);
  assert.ok(a.tree.filter((node) => node.terminal).length === a.cells.length && a.tree[0].id === "r");
});

test("a cell's orientation follows its stripes; opposed stripes of equal energy cancel instead of averaging angles", () => {
  const one = (byte: (x: number, y: number) => number, over = {}) => compartmentPlan(optionsFor(gray(64, 64, byte), { threshold: 10, smoothing: 2, ...over })).cells[0];
  const modPi = (a: number) => ((a % Math.PI) + Math.PI) % Math.PI;
  const vertical = one((x) => (x % 8 < 4 ? black : white));
  near(modPi(vertical.orientation.direction), Math.PI / 2, 1e-6); assert.ok(vertical.orientation.coherence > 0.99 && vertical.orientation.defined);
  const horizontal = one((_, y) => (y % 8 < 4 ? black : white));
  const h = modPi(horizontal.orientation.direction);
  assert.ok(Math.min(h, Math.PI - h) < 1e-6 && horizontal.orientation.coherence > 0.99);
  const crossed = one((x, y) => (x < 32 ? (x % 8 < 4 ? black : white) : (y % 8 < 4 ? black : white)));
  assert.ok(crossed.orientation.coherence < 0.05, `coherence ${crossed.orientation.coherence}`);
  // The cell reads exactly the rectangle mean of the field's tensor.
  const source = gray(64, 64, (x) => (x % 8 < 4 ? black : white));
  const field = orientationField(source, { smoothing: 2 });
  const whole = orientationInRect(field, { x: 0, y: 0, width: 64, height: 64 });
  near(whole.direction, vertical.orientation.direction, 1e-12);
  // Energy is the MEAN of the pixel energies over the rectangle.
  let total = 0;
  for (let j = 3; j < 11; j++) for (let i = 6; i < 14; i++) total += orientationPixel(field, i, j).energy;
  near(orientationInRect(field, { x: 6, y: 3, width: 8, height: 8 }).energy, total / 64, 1e-12);
  const pixel = orientationInRect(field, { x: 10, y: 5, width: 1, height: 1 }), reference = orientationPixel(field, 10, 5);
  assert.deepEqual([pixel.direction, pixel.coherence, pixel.energy], [reference.direction, reference.coherence, reference.energy]);
  assert.throws(() => orientationInRect(field, { x: 60, y: 0, width: 8, height: 1 }), /outside/);
  assert.throws(() => orientationInRect(field, { x: 0.5, y: 0, width: 1, height: 1 }), /integer/);
});

test("failures name the control to change and nothing is truncated", () => {
  const noise = stream(3), source = gray(64, 64, () => Math.floor(noise() * 256));
  assert.throws(() => compartmentPlan(optionsFor(source, { threshold: 0.001, maxCells: 100 })), /more than 100 cells; raise threshold, raise minCell or raise maxCell/);
  assert.throws(() => compartmentPlan(optionsFor(source, { smoothing: 500 })), /smoothing 500 is more than 64 source pixels/);
  assert.throws(() => compartmentPlan(optionsFor(source, { crop: { x: 60, y: 0, width: 10, height: 10 } })), /crop 60,0 10 x 10 must lie inside/);
  assert.throws(() => compartmentPlan(optionsFor(source, { minCell: 0 })), /minCell must be a number/);
  assert.throws(() => compartmentPlan({ ...optionsFor(source), source: {} as Raster }), /source must be a Raster/);
  assert.throws(() => compartmentPlan(optionsFor(source, { metric: "mean" as never })), /metric must be one of/);
  assert.throws(() => compartmentPlan(optionsFor(source, { seed: -1 })), /uint32/);
});

test("coverCrop fits the area's aspect and slides over the available travel", () => {
  assert.deepEqual(coverCrop({ width: 128, height: 128 }, 1, 2, 0.5, 0.5), { x: 32, y: 32, width: 64, height: 64 });
  assert.deepEqual(coverCrop({ width: 128, height: 128 }, 2, 1, 0.5, 1), { x: 0, y: 64, width: 128, height: 64 });
  assert.deepEqual(coverCrop({ width: 200, height: 100 }, 1, 1, 1, 0), { x: 100, y: 0, width: 100, height: 100 });
  assert.deepEqual(coverCrop({ width: 128, height: 128 }, 1, 4, 0, 0), { x: 0, y: 0, width: 32, height: 32 });
  assert.throws(() => coverCrop({ width: 8, height: 8 }, 1, 0.5, 0, 0), /zoom/);
});

// --- retention and gutter ----------------------------------------------------------------------------------

test("rank rules keep exactly round(fraction x n) cells by their attribute; chance rules only ever add cells", () => {
  // Four 32-pixel cells: flat black, half-striped (error .5), a quarter-striped (error sqrt(.1875)), flat gray.
  const byte = (x: number, y: number) => x < 32 && y < 32 ? black : x >= 32 && y < 32 ? (x % 2 ? white : black) : x < 32 ? (y % 4 === 0 ? black : white) : 128;
  const plan = compartmentPlan(optionsFor(gray(64, 64, byte), { threshold: 10, maxCell: 32 }));
  assert.equal(plan.cells.length, 4);
  const by = (rule: "detailed" | "quiet" | "dark" | "light", fraction: number) => keptCompartments(plan, fraction, rule).map((c) => c.id);
  const ids = plan.cells.map((c) => c.id); // r.0 TL, r.1 TR, r.2 BL, r.3 BR
  assert.deepEqual(ids, ["r.0", "r.1", "r.2", "r.3"]);
  assert.deepEqual(by("detailed", 0.25), ["r.1"]);
  assert.deepEqual(by("detailed", 0.5), ["r.1", "r.2"]);
  assert.equal(by("detailed", 0.75).length, 3);
  assert.deepEqual(by("quiet", 0.5).sort(), ["r.0", "r.3"]);
  assert.deepEqual(by("dark", 0.25), ["r.0"]);
  assert.deepEqual(by("light", 0.25).length, 1);
  assert.equal(plan.cells.find((c) => c.id === by("light", 0.25)[0])!.tone, Math.max(...plan.cells.map((c) => c.tone)));
  for (const rule of ["detailed", "quiet", "dark", "light"] as const) {
    assert.equal(by(rule, 0).length, 0); assert.equal(by(rule, 1).length, 4);
    for (const [low, high] of [[0.25, 0.5], [0.5, 0.75]]) assert.ok(by(rule, low).every((id) => by(rule, high).includes(id)));
  }
  // Chance on a larger plan: a stable draw per cell, so raising the fraction only adds cells.
  const big = compartmentPlan(optionsFor(bundledRaster("landscape", 3, 64), { threshold: 0.03, minCell: 2 }));
  let previous = new Set<string>();
  for (const fraction of [0, 0.2, 0.5, 0.8, 1]) {
    const now = new Set(keptCompartments(big, fraction, "chance").map((c) => c.id));
    for (const id of previous) assert.ok(now.has(id), `fraction ${fraction}`);
    previous = now;
  }
  assert.equal(previous.size, big.cells.length);
  const other = compartmentPlan({ ...optionsFor(bundledRaster("landscape", 3, 64), { threshold: 0.03, minCell: 2 }), seed: 99 });
  assert.notDeepEqual(keptCompartments(other, 0.5, "chance").map((c) => c.id), keptCompartments(big, 0.5, "chance").map((c) => c.id));
  const share = keptCompartments(big, 0.5, "chance").length / big.cells.length;
  assert.ok(share > 0.4 && share < 0.6, `share ${share}`);
});

test("the gutter insets each cell by half on every side and removes cells it would erase", () => {
  const plan = compartmentPlan(optionsFor(bundledRaster("geometry", 3, 64), { threshold: 0.05, minCell: 4 }));
  const regions = compartmentRegions(plan.cells, 3);
  assert.equal(regions.length, plan.cells.length);
  for (const region of regions) {
    const [l, t, r, b] = region.cell.bounds;
    assert.deepEqual([...region.bounds], [l + 1.5, t + 1.5, r - 1.5, b - 1.5]);
    assert.equal(region.id, region.cell.id);
    assert.equal(region.seed, region.cell.seed);
  }
  const smallest = Math.min(...plan.cells.map((c) => Math.min(c.width, c.height)));
  assert.equal(smallest, 4);
  assert.equal(compartmentRegions(plan.cells, 4).length, plan.cells.filter((c) => Math.min(c.width, c.height) > 4).length);
  assert.equal(compartmentRegions(plan.cells, 0).length, plan.cells.length);
});

// --- analytic geometry ------------------------------------------------------------------------------------

test("hatch lines are the symmetric stripe population clipped to the rectangle", () => {
  // Horizontal, spacing 4, in [0,20] x [0,10]: normal offsets +-2, +-6 from the center line y = 5.
  const lines = hatchSegments(0, 0, 20, 10, 0, 4);
  assert.equal(lines.length, 2);
  for (const [line, y] of [[lines[0], 3], [lines[1], 7]] as const) { near(line[1], y); near(line[3], y); near(line[0], 0); near(line[2], 20); }
  const random = stream(21);
  for (let trial = 0; trial < 80; trial++) {
    const x0 = random() * 10, y0 = random() * 10, w = 5 + random() * 60, h = 5 + random() * 60, theta = random() * Math.PI * 2, spacing = 1.5 + random() * 8;
    const cx = x0 + w / 2, cy = y0 + h / 2, dx = Math.cos(theta), dy = Math.sin(theta), reach = (w * Math.abs(dy) + h * Math.abs(dx)) / 2;
    let expected = 0;
    for (let k = -1000; k <= 1000; k++) if (Math.abs(spacing / 2 + k * spacing) < reach - 1e-9) expected++;
    const segments = hatchSegments(x0, y0, x0 + w, y0 + h, theta, spacing);
    assert.ok(Math.abs(segments.length - expected) <= 1, `count ${segments.length} vs ${expected}`);
    const normals: number[] = [];
    for (const [ax, ay, bx, by] of segments) {
      for (const [x, y] of [[ax, ay], [bx, by]]) {
        assert.ok(x >= x0 - 1e-7 && x <= x0 + w + 1e-7 && y >= y0 - 1e-7 && y <= y0 + h + 1e-7);
        const onEdge = Math.min(Math.abs(x - x0), Math.abs(x - x0 - w), Math.abs(y - y0), Math.abs(y - y0 - h)) < 1e-7;
        assert.ok(onEdge, "endpoints lie on the boundary");
      }
      const length = Math.hypot(bx - ax, by - ay);
      near((bx - ax) / length, dx, 1e-7); near((by - ay) / length, dy, 1e-7);
      normals.push(-(ax - cx) * dy + (ay - cy) * dx);
    }
    for (let i = 1; i < normals.length; i++) near(Math.abs(normals[i] - normals[i - 1]), spacing, 1e-6);
  }
  assert.deepEqual(hatchSegments(0, 0, 0, 10, 0, 4), []);
});

test("the halftone lattice is symmetric about the center, turns with the direction and keeps every disc inside", () => {
  const upright = halftoneCentres(0, 0, 20, 10, 0, 5, 1);
  assert.equal(upright.length, 8);
  assert.deepEqual(upright.map(([x]) => x).sort((a, b) => a - b).filter((x, i, all) => all.indexOf(x) === i), [2.5, 7.5, 12.5, 17.5]);
  assert.deepEqual([...new Set(upright.map(([, y]) => y))].sort(), [2.5, 7.5]);
  // A quarter turn gives the same lattice of a square pitch.
  const turned = halftoneCentres(0, 0, 20, 10, Math.PI / 2, 5, 1);
  const key = (points: [number, number][]) => points.map(([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`).sort();
  assert.deepEqual(key(turned), key(upright));
  for (const [x, y] of halftoneCentres(3, 4, 43, 30, 0.7, 4, 1.8)) assert.ok(x - 1.8 >= 3 - 1e-9 && x + 1.8 <= 43 + 1e-9 && y - 1.8 >= 4 - 1e-9 && y + 1.8 <= 30 + 1e-9);
  assert.equal(halftoneCentres(0, 0, 4, 4, 0, 5, 3).length, 0);
});

// --- fillers ----------------------------------------------------------------------------------------------

const baseSpec: CompartmentFillSpec = {
  kind: "detail", color: "image", body: 1, hatchBelow: 44, glyphBelow: 17, mixing: 0, spacing: 4, weight: 1, angle: 0, toneResponse: 1, dotMax: 1,
  glyph: { kind: "rings", fit: 0.7, petals: 6, opening: 0.3 }, border: { kind: "none", weight: 1, spacing: 6, minCell: 40 },
};
const spec = (over: Partial<CompartmentFillSpec> = {}): CompartmentFillSpec => ({ ...baseSpec, ...over });

test("detail picks a filler from a cell's size with a strict class boundary, and mixing interleaves classes by stable draws", () => {
  const source = gray(64, 64, () => 100);
  const side = (n: number) => compartmentPlan(optionsFor(source, { maxCell: n })).cells; // cells of n pixels (n a power of two fraction of 64)
  const [big] = side(32), [small] = side(16);
  assert.equal(big.width, 32);
  assert.equal(compartmentFillKind(spec({ hatchBelow: 33, glyphBelow: 10 }), big), "hatch");
  assert.equal(compartmentFillKind(spec({ hatchBelow: 32, glyphBelow: 10 }), big), "flat", "a size equal to the limit is not below it");
  assert.equal(compartmentFillKind(spec({ hatchBelow: 40, glyphBelow: 33 }), big), "motif");
  assert.equal(compartmentFillKind(spec({ hatchBelow: 40, glyphBelow: 32 }), big), "hatch");
  for (const kind of ["flat", "hatch", "dots", "motif"] as const) assert.equal(compartmentFillKind(spec({ kind }), small), kind);
  const many = compartmentPlan(optionsFor(source, { maxCell: 4 })).cells; // 256 equal cells
  const classes = (mixing: number, seed = 5) => many.map((cell) => compartmentFillKind(spec({ hatchBelow: 5, glyphBelow: 3, mixing }), { ...cell, seed: componentSeed(seed, cell.id, "compartment") }));
  assert.ok(classes(0).every((kind) => kind === "hatch"));
  const mixed = classes(1);
  assert.ok(mixed.includes("flat") && mixed.includes("hatch"));
  assert.deepEqual(classes(1), mixed);
  assert.notDeepEqual(classes(1, 6), mixed);
  // Wander is bounded to +-50% x mixing: a size 4 cell is never flat below hatchBelow 2.6 x 4 / ... i.e. thresholds in [0.5, 1.5] x limit.
  assert.ok(many.every((cell) => compartmentFillKind(spec({ hatchBelow: 2, glyphBelow: 0, mixing: 1 }), cell) === "flat"), "4 >= 2 x 1.5 always");
  assert.ok(many.every((cell) => compartmentFillKind(spec({ hatchBelow: 10, glyphBelow: 0, mixing: 1 }), cell) === "hatch"), "4 < 10 x 0.5 never flat");
});

test("colors: image keeps the cell's mean, palette picks the nearest Oklab entry, ink darkens with tone and scales by coverage", () => {
  const source = rgb(2, 1, [[30, 30, 200], [30, 30, 200]]);
  const cell = compartmentPlan(optionsFor(source, { threshold: 10 })).cells[0];
  const image = compartmentInk(spec({ body: 0.8 }), [0xff0000], cell);
  for (let c = 0; c < 3; c++) near(image.body[c], cell.color[c] * 255, 1e-9);
  near(image.bodyOpacity, 0.8); near(image.markOpacity, 1);
  assert.ok(image.mark.every((v, c) => v < image.body[c] || v <= 1) || image.mark.every((v, c) => v > image.body[c]), "marks contrast with the body");
  const palette = [0xff0000, 0x00ff00, 0x0000ff];
  assert.equal(nearestPaletteIndex(palette, [30, 30, 200]), 2);
  assert.deepEqual(compartmentInk(spec({ color: "palette" }), palette, cell).body, [0, 0, 255]);
  assert.equal(nearestPaletteIndex([0x000000, 0xffffff], [128, 128, 128]), 1, "mid sRGB gray is Oklab-nearer to white");
  assert.equal(nearestPaletteIndex([0x123456, 0x123456], [0x12, 0x34, 0x56]), 0, "ties keep the earlier entry");
  const ink = compartmentInk(spec({ color: "ink", body: 0.5 }), [0x203040, 0xffffff], { ...cell, tone: 0.25, coverage: 0.5 });
  assert.deepEqual([...ink.body, ...ink.mark], [0x20, 0x30, 0x40, 0x20, 0x30, 0x40]);
  near(ink.bodyOpacity, 0.5 * 0.75 * 0.5); near(ink.markOpacity, 0.5);
  const dark = compartmentInk(spec(), [0], { ...cell, color: [0.1, 0.1, 0.1] }), light = compartmentInk(spec(), [0], { ...cell, color: [0.9, 0.9, 0.9] });
  assert.ok(dark.mark[0] > dark.body[0] && light.mark[0] < light.body[0]);
});

test("hatch spacing tightens with darkness by whole octaves; dot area follows darkness up to the cap", () => {
  const cell = compartmentPlan(optionsFor(gray(8, 8, () => 0), { threshold: 10 })).cells[0];
  const at = (tone: number, over: Partial<CompartmentFillSpec> = {}) => hatchSpacing(spec({ spacing: 8, toneResponse: 1, ...over }), { ...cell, tone });
  near(at(0.5), 8); near(at(1), 16); near(at(0), 4); near(at(0, { toneResponse: 0 }), 8); near(at(0, { toneResponse: 2, spacing: 3 }), 1.5, 1e-12);
  // Coverage of a disc is pi r^2 / pitch^2 = darkness while below the cap.
  for (const darkness of [0.1, 0.4, 0.7]) near(Math.PI * halftoneRadius(spec({ spacing: 10 }), { ...cell, tone: 1 - darkness }) ** 2 / 100, darkness, 1e-12);
  near(halftoneRadius(spec({ spacing: 10, dotMax: 0.6 }), { ...cell, tone: 0 }), 3);
  near(halftoneRadius(spec({ spacing: 10 }), { ...cell, tone: 1 }), 0);
  const weak = { ...cell, orientation: { ...cell.orientation, defined: true, coherence: 0.1, direction: 1 } }, strong = { ...cell, orientation: { ...weak.orientation, coherence: 0.9 } };
  near(compartmentAngle(spec({ angle: 90 }), weak), Math.PI / 2); near(compartmentAngle(spec({ angle: 90 }), strong), 1 + Math.PI / 2);
});

// --- drawing ----------------------------------------------------------------------------------------------

type Call = { name: string; args: unknown[]; at: [number, number] };
function recorder(): { surface: CompositionSurface; calls: Call[] } {
  const calls: Call[] = [], stack: [number, number][] = [], origin: [number, number] = [0, 0];
  let now = origin;
  const log = (name: string) => (...args: unknown[]) => { calls.push({ name, args, at: now }); };
  const surface = {
    CLOSE: "close", ROUND: "round",
    push: () => { stack.push(now); }, pop: () => { now = stack.pop()!; },
    translate: (x: number, y: number) => { now = [now[0] + x, now[1] + y]; },
    rotate: log("rotate"), scale: log("scale"), noFill: log("noFill"), noStroke: log("noStroke"), fill: log("fill"), stroke: log("stroke"),
    strokeWeight: log("strokeWeight"), strokeCap: log("strokeCap"), circle: log("circle"), line: log("line"), rect: log("rect"),
    beginShape: log("beginShape"), vertex: log("vertex"), endShape: log("endShape"),
  } as unknown as CompositionSurface;
  return { surface, calls };
}
function recipeFor(source: Raster, planOver: Partial<CompartmentsComposition["plan"]>, fill: CompartmentFillSpec, select = { retained: 1, by: "chance" as const, gutter: 0 }): CompartmentsComposition {
  return { palette: [0x102030, 0xa03020, 0xe0b040], image: { kind: "raster", raster: source }, view: { zoom: 1, focusX: 0.5, focusY: 0.5 },
    plan: { seed: 5, centerX: source.width / 2, centerY: source.height / 2, width: source.width, height: source.height, measure: "lightness", metric: "stddev",
      threshold: 10, minCell: 1, split: "quad", smoothing: 0, ...planOver }, select, fill };
}

test("a flat filler paints each cell's mean color over its exact rectangle; coverage scales opacity", () => {
  const source = createRaster({ width: 64, height: 64, channels: 4, format: "u8", colorSpace: "srgb", alpha: "straight",
    data: Uint8ClampedArray.from({ length: 64 * 64 * 4 }, (_, i) => [200, 40, 20, 128][i % 4]) });
  const recipe = recipeFor(source, { maxCell: 32 }, spec({ kind: "flat", body: 0.5 }));
  const { surface, calls } = recorder();
  drawCompartments(surface, recipe);
  const rects = calls.filter((c) => c.name === "rect"), fills = calls.filter((c) => c.name === "fill");
  assert.equal(rects.length, 4);
  const plan = compartmentPlan(compartmentOptions(recipe));
  const seen = rects.map((c) => [c.at[0] + (c.args[0] as number), c.at[1] + (c.args[1] as number), c.args[2], c.args[3]]);
  assert.deepEqual(seen.sort(), plan.cells.map((cell) => [cell.bounds[0], cell.bounds[1], cell.width, cell.height]).sort());
  for (const fill of fills) {
    const [r, g, b, a] = fill.args as number[];
    near(r, 200, 1e-4); near(g, 40, 1e-4); near(b, 20, 1e-4); assert.equal(a, Math.round(255 * 0.5 * (128 / 255)));
  }
});

test("hatch strokes stay inside the inset cell and follow the cell's direction; dots and glyphs stay inside too", () => {
  const stripes = gray(64, 64, (x) => (x % 8 < 4 ? black : white));
  for (const kind of ["hatch", "dots", "motif"] as const) {
    const recipe = recipeFor(stripes, { maxCell: 32, smoothing: 2 }, spec({ kind, body: 0, glyph: { kind: "dot", fit: 0.6, petals: 1, opening: 0 }, spacing: 5, weight: 1.5 }), { retained: 1, by: "chance", gutter: 4 });
    const { surface, calls } = recorder();
    drawCompartments(surface, recipe);
    const inset = compartmentDrawRegions(recipe);
    assert.equal(inset.length, 4);
    if (kind === "hatch") {
      const lines = calls.filter((c) => c.name === "line");
      assert.ok(lines.length > 10);
      for (const line of lines) {
        const [ax, ay, bx, by] = line.args as number[];
        // Vertical stripes: level lines are vertical (direction pi/2), so hatch runs top to bottom.
        near(ax, bx, 1e-6); assert.ok(ay !== by);
        const region = inset.find((r) => Math.abs(line.at[0] - r.bounds[0]) < 1e-9 && Math.abs(line.at[1] - r.bounds[1]) < 1e-9)!;
        assert.ok(region && ax >= 0.75 - 1e-9 && ax <= region.bounds[2] - region.bounds[0] - 0.75 + 1e-9 && Math.min(ay, by) >= 0.75 - 1e-9 && Math.max(ay, by) <= region.bounds[3] - region.bounds[1] - 0.75 + 1e-9);
      }
    } else if (kind === "dots") {
      const circles = calls.filter((c) => c.name === "circle");
      assert.ok(circles.length > 4);
      for (const circle of circles) {
        const [x, y, d] = circle.args as number[], region = inset.find((r) => Math.abs(circle.at[0] - r.bounds[0]) < 1e-9 && Math.abs(circle.at[1] - r.bounds[1]) < 1e-9)!;
        assert.ok(region && x - d / 2 >= -1e-9 && y - d / 2 >= -1e-9 && x + d / 2 <= region.bounds[2] - region.bounds[0] + 1e-9 && y + d / 2 <= region.bounds[3] - region.bounds[1] + 1e-9);
      }
    } else {
      const circles = calls.filter((c) => c.name === "circle");
      assert.equal(circles.length, 4);
      for (const circle of circles) near(circle.args[2] as number, 0.6 * 28, 1e-9); // fit 0.6 of the 28-unit inset cell side (32 - gutter 4)
    }
  }
});

test("a border uses the path material on cells at least borderMin across", () => {
  const source = bundledRaster("geometry", 3, 64);
  const big = { width: 256, height: 256, centerX: 128, centerY: 128, threshold: 0.05, minCell: 4 };
  const recipe = recipeFor(source, big, spec({ kind: "flat", border: { kind: "ink", weight: 1, spacing: 6, minCell: 20 } }));
  const plan = compartmentPlan(compartmentOptions(recipe));
  const { surface, calls } = recorder();
  drawCompartments(surface, recipe);
  const expected = plan.cells.filter((c) => Math.min(c.width, c.height) >= 20).length;
  assert.ok(expected > 3 && expected < plan.cells.length);
  assert.equal(calls.filter((c) => c.name === "endShape").length, expected);
  const stitched = recorder();
  drawCompartments(stitched.surface, recipeFor(source, big, spec({ kind: "flat", border: { kind: "stitch", weight: 1, spacing: 6, minCell: 20 } })));
  assert.ok(stitched.calls.filter((c) => c.name === "line").length > expected && stitched.calls.every((c) => c.name !== "endShape"));
});

test("filler substitution and appearance edits never touch the partition; a filler cannot change the frozen cells", () => {
  const source = bundledRaster("portrait", 3, 96);
  const recipe = recipeFor(source, { threshold: 0.05, minCell: 3 }, spec());
  const options = compartmentOptions(recipe), plan = compartmentPlan(options), snapshot = JSON.stringify(plan.cells);
  const regions = compartmentDrawRegions(recipe);
  const mutations: string[] = [];
  inside(recorder().surface, regions, (_surface, region) => {
    for (const attempt of [() => { (region.cell as { value: number }).value = 9; }, () => { (region.cell.bounds as unknown as number[])[0] = -1; }, () => { (region.cell.color as unknown as number[])[0] = 9; }]) {
      try { attempt(); mutations.push("changed"); } catch (error) { assert.ok(error instanceof TypeError); }
    }
  });
  assert.deepEqual(mutations, []);
  for (const fill of [spec({ kind: "flat" }), spec({ kind: "hatch", color: "palette" }), spec({ kind: "dots", body: 0.2 }), spec({ kind: "motif", border: { kind: "stitch", weight: 1, spacing: 5, minCell: 8 } })]) {
    drawCompartments(recorder().surface, { ...recipe, fill });
    assert.equal(compartmentPlan(compartmentOptions({ ...recipe, fill })), plan);
  }
  drawCompartments(recorder().surface, { ...recipe, palette: [1, 2, 3], select: { retained: 0.5, by: "detailed", gutter: 3 } });
  assert.equal(compartmentPlan(compartmentOptions({ ...recipe, select: { retained: 0.3, by: "quiet", gutter: 1 } })), plan);
  assert.equal(JSON.stringify(plan.cells), snapshot);
  // Construction edits do replace it.
  for (const over of [{ threshold: 0.1 }, { minCell: 5 }, { metric: "range" as const }, { split: "longest" as const }, { measure: "saturation" as const }, { maxCell: 40 }, { width: 400 }]) {
    assert.notEqual(compartmentPlan(compartmentOptions({ ...recipe, plan: { ...recipe.plan, ...over } })), plan, JSON.stringify(over));
  }
  assert.notEqual(compartmentPlan(compartmentOptions({ ...recipe, view: { ...recipe.view, zoom: 2 } })), plan);
});

test("estimated work covers what is drawn, and a bound names the control to change", () => {
  const source = bundledRaster("portrait", 3, 128);
  const cases: [string, Partial<CompartmentFillSpec>, Partial<CompartmentsComposition["plan"]>][] = [
    ["detail", {}, { threshold: 0.03, minCell: 3 }],
    ["hatch", { kind: "hatch", spacing: 2 }, { threshold: 0.02, minCell: 5 }],
    ["dots", { kind: "dots", spacing: 3 }, { threshold: 0.03, minCell: 6 }],
    ["stitch", { kind: "flat", border: { kind: "stitch", weight: 1, spacing: 3, minCell: 8 } }, { threshold: 0.03, minCell: 8 }],
    ["motif", { kind: "motif", glyph: { kind: "rosette", fit: 0.9, petals: 12, opening: 0.2 } }, { threshold: 0.03, minCell: 3 }],
  ];
  for (const [label, fill, plan] of cases) {
    const recipe = recipeFor(source, { width: 560, height: 560, centerX: 320, centerY: 320, ...plan }, spec(fill), { retained: 1, by: "chance", gutter: 1 });
    const estimate = boundCompartmentWork(compartmentDrawRegions(recipe), recipe.fill), run = createCompositionRun();
    drawCompartments(recorder().surface, recipe, run);
    assert.ok(run.workUsed <= estimate, `${label}: used ${run.workUsed} of estimated ${estimate}`);
    assert.ok(run.workUsed > 0);
  }
  const dense = recipeFor(source, { width: 560, height: 560, centerX: 320, centerY: 320, threshold: 0.03, minCell: 3 }, spec({ kind: "dots", spacing: 1.5 }), { retained: 1, by: "chance", gutter: 1 });
  assert.throws(() => drawCompartments(recorder().surface, dense), /would draw about \d+ marks; the limit is 80000: raise spacing/);
  const border = recipeFor(source, { width: 560, height: 560, centerX: 320, centerY: 320, threshold: 0.03, minCell: 8 }, spec({ kind: "flat", border: { kind: "beads", weight: 1, spacing: 0.5, minCell: 8 } }), { retained: 1, by: "chance", gutter: 1 });
  assert.throws(() => drawCompartments(recorder().surface, border), /raise borderSpacing/);
  assert.throws(() => compartmentFiller(spec({ spacing: 1 }), [1]), /spacing must be a number in \[1.5, 200\]/);
  assert.throws(() => compartmentFiller(spec({ kind: "wash" as never }), [1]), /unknown filler/);
});

// --- the instrument -----------------------------------------------------------------------------------------

const instrument = (params: Record<string, number | string | boolean> = {}, seed = 4) => {
  const input = createInstrument("adaptive-compartments");
  input.seed = seed; input.params = { ...input.params, ...params };
  return input;
};

test("the authored default divides every bundled image by its detail and shows all three size classes on the portrait", () => {
  const kinds = (image: string) => {
    const input = instrument({ image }), recipe = referenceComposition(input);
    assert.equal(recipe.kind, "compartments");
    validateInstrument(input);
    const plan = compartmentPlan(compartmentOptions(recipe as CompartmentsComposition));
    const counts: Record<string, number> = {};
    for (const cell of plan.cells) { const k = compartmentFillKind((recipe as CompartmentsComposition).fill, cell); counts[k] = (counts[k] ?? 0) + 1; }
    return { plan, counts };
  };
  const portrait = kinds("portrait");
  assert.ok(portrait.counts.flat > 5 && portrait.counts.hatch > 5 && portrait.counts.motif > 5, JSON.stringify(portrait.counts));
  // Detail decides the scale: cells far smaller than the largest lie where the image changes, so the busiest cells are small.
  const cells = portrait.plan.cells, sizes = cells.map((c) => c.width);
  assert.ok(Math.max(...sizes) / Math.min(...sizes) >= 8);
  // Cells whose error still exceeds the threshold could not split further, so they are all at the smallest size; the largest cells are all quiet.
  const unresolved = cells.filter((c) => !c.resolved), largest = cells.filter((c) => c.width >= 100);
  assert.ok(unresolved.length > 100 && largest.length > 2);
  assert.ok(unresolved.every((c) => c.pixels.width <= 2 * portrait.plan.minCellPixels - 1 && c.pixels.height <= 2 * portrait.plan.minCellPixels - 1));
  assert.ok(largest.every((c) => c.resolved));
  for (const image of ["geometry", "landscape", "noise"]) assert.ok(kinds(image).plan.cells.length > 20, image);
  const drawn = recorder();
  drawInstrument(drawn.surface as never, instrument());
  assert.ok(drawn.calls.length > 500);
});

test("coupled bounds are refused with both controls named; the seed matters only where chance is used", () => {
  assert.throws(() => validateInstrument(instrument({ gutter: 8, minCell: 8 })), /Gutter 8 must be smaller than the smallest cell 8/);
  assert.throws(() => validateInstrument(instrument({ minCell: 30, maxCell: 40 })), /Largest cell 40 must be at least twice the smallest cell 30/);
  assert.equal(usesSeed(instrument({ retained: 1, mixing: 0 })), false);
  assert.equal(usesSeed(instrument({ retained: 0.5, keepBy: "chance", mixing: 0 })), true);
  assert.equal(usesSeed(instrument({ retained: 0.5, keepBy: "detailed", mixing: 0 })), false);
  assert.equal(usesSeed(instrument({ retained: 1, filler: "detail", mixing: 0.4 })), true);
  assert.equal(usesSeed(instrument({ retained: 1, filler: "hatch", mixing: 0.4 })), false);
  // A seed the instrument claims not to use really changes nothing.
  const still = { retained: 1, mixing: 0 };
  assert.equal(drawFingerprint(instrument(still, 1)), drawFingerprint(instrument(still, 2)));
  assert.notEqual(drawFingerprint(instrument({ retained: 0.6 }, 1)), drawFingerprint(instrument({ retained: 0.6 }, 2)));
  assert.notEqual(drawFingerprint(instrument({ mixing: 1 }, 1)), drawFingerprint(instrument({ mixing: 1 }, 2)));
});

test("a control hidden by the filler or border choice leaves the drawing unchanged", () => {
  const cases: [Record<string, number | string | boolean>, Record<string, number | string | boolean>][] = [
    [{ filler: "flat" }, { spacing: 12, weight: 3, angle: 40, toneResponse: 2, dotMax: 0.4, smoothing: 20, glyphKind: "arrow", glyphFit: 0.4, hatchBelow: 90, glyphBelow: 60, mixing: 1, petals: 9, opening: 0.7 }],
    [{ filler: "hatch" }, { dotMax: 0.4, glyphKind: "rosette", glyphFit: 0.4, hatchBelow: 90, glyphBelow: 60, mixing: 1, petals: 9 }],
    [{ filler: "dots" }, { weight: 3, toneResponse: 2, glyphKind: "arrow", glyphFit: 0.4, hatchBelow: 90, mixing: 1 }],
    [{ filler: "motif", glyphKind: "arrow" }, { spacing: 12, toneResponse: 2, dotMax: 0.4, hatchBelow: 90, glyphBelow: 60, mixing: 1, petals: 9, opening: 0.7 }],
    [{ filler: "detail", glyphKind: "dot" }, { dotMax: 0.4, petals: 9, opening: 0.7 }],
    [{ border: "none" }, { borderWeight: 3, borderSpacing: 12, borderMin: 90 }],
    [{ border: "ink" }, { borderSpacing: 12 }],
    [{ retained: 1 }, { keepBy: "dark" }],
  ];
  for (const [held, hidden] of cases) {
    const before = drawFingerprint(instrument(held)), after = drawFingerprint(instrument({ ...held, ...hidden }));
    assert.equal(after, before, JSON.stringify([held, hidden]));
  }
  // The controls those conditions leave visible do matter.
  assert.notEqual(drawFingerprint(instrument({ filler: "hatch", spacing: 9 })), drawFingerprint(instrument({ filler: "hatch" })));
  assert.notEqual(drawFingerprint(instrument({ border: "ink", borderWeight: 2.5 })), drawFingerprint(instrument({ border: "ink" })));
});

test("editing an appearance control repaints the same partition; a structural control replaces it", () => {
  const plan = (params: Record<string, number | string | boolean>) => compartmentPlan(compartmentOptions(referenceComposition(instrument(params)) as CompartmentsComposition));
  const base = plan({});
  for (const params of [{ filler: "dots" }, { color: "palette" }, { body: 0.3 }, { gutter: 5 }, { retained: 0.4 }, { keepBy: "dark" }, { border: "stitch" }, { spacing: 9 }, { angle: 30 }, { weight: 2 }, { mixing: 1 }])
    assert.equal(plan(params), base, JSON.stringify(params));
  for (const params of [{ threshold: 9 }, { image: "geometry" }, { variant: 7 }, { minCell: 12 }, { maxCell: 60 }, { split: "best" }, { metric: "range" }, { measure: "saturation" }, { zoom: 2 }, { resolution: 96 }, { width: 400 }, { centerX: 300 }])
    assert.notEqual(plan(params), base, JSON.stringify(params));
});
