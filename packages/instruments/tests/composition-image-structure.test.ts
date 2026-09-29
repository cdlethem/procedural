import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPixelMoves, bundledRaster, createRaster, createScalarGrid, frequencyModulation, modulatedPolyline, orientationAt, orientationField, orientationGrids,
  orientationPixel, orientationVector, pixelSort, rasterData, rasterPixel, scanRunPixel, scanRuns, segmentValueBands, sortScanRuns, subdivideImage,
  subdivisionLabels, valueField, valueRegionMask,
  type OrientationField, type ScalarGrid, type ScanDirection, type ScanOptions, type Subdivision,
} from "../dist/index.js";

const near = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected} (±${tolerance})`);
const grid = (width: number, height: number, fn: (x: number, y: number) => number) =>
  createScalarGrid(width, height, Array.from({ length: width * height }, (_, i) => fn(i % width, Math.floor(i / width))));
const rows = (values: number[][]) => createScalarGrid(values[0].length, values.length, values.flat());
function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x1_0000_0000; };
}

// ------------------------------------------------------------------------------------------ segmentation

test("a constant image is one region with exact attributes", () => {
  for (const source of [grid(10, 7, () => 0.3), createRaster({ width: 10, height: 7, channels: 1, format: "u8", colorSpace: "srgb", alpha: "none", data: new Array(70).fill(100) })]) {
    const seg = segmentValueBands(source, { bands: 4, connectivity: 4 });
    assert.equal(seg.regions.length, 1);
    const [r] = seg.regions;
    assert.equal(r.area, 70); assert.deepEqual({ ...r.bbox }, { x0: 0, y0: 0, x1: 10, y1: 7 }); assert.deepEqual([...r.centroid], [5, 3.5]);
    assert.deepEqual(Array.from(seg.labels.toArray()), new Array(70).fill(0));
    assert.equal(seg.adjacency.length, 0); assert.equal(seg.excluded, 0); assert.equal(seg.merged, 0);
  }
});

test("band rule: a value equal to a threshold is in the upper band and 1 is in the last band", () => {
  const seg = segmentValueBands(rows([[0, 0.2499999, 0.25, 0.5, 0.75, 1]]), { bands: 4, connectivity: 4 });
  assert.deepEqual(seg.regions.map(r => r.band), [0, 1, 2, 3]);
  assert.deepEqual(seg.regions.map(r => r.area), [2, 1, 1, 2]);
  const explicit = segmentValueBands(rows([[0.1, 0.3, 0.3, 0.9]]), { thresholds: [0.3], connectivity: 4 });
  assert.deepEqual(explicit.regions.map(r => [r.band, r.area]), [[0, 1], [1, 3]]);
});

test("a checkerboard is one region per pixel under 4-connectivity and two under 8", () => {
  const board = grid(4, 4, (x, y) => ((x + y) % 2 === 0 ? 0.1 : 0.9));
  const four = segmentValueBands(board, { bands: 2, connectivity: 4 });
  assert.equal(four.regions.length, 16);
  const eight = segmentValueBands(board, { bands: 2, connectivity: 8 });
  assert.equal(eight.regions.length, 2);
  assert.deepEqual(eight.regions.map(r => r.area), [8, 8]);
  assert.deepEqual([...eight.regions[0].centroid], [2, 2]);
  assert.equal(eight.adjacency.length, 1);
  assert.equal(eight.adjacency[0].length, 24); // every one of the 24 unit edges inside the 4x4 board separates the two colors
});

test("holes, disconnected components and diagonal contact are kept apart exactly as connectivity says", () => {
  // ring around a hole
  const ring = grid(5, 5, (x, y) => (x === 0 || y === 0 || x === 4 || y === 4 ? 0.9 : 0.1));
  const seg = segmentValueBands(ring, { bands: 2, connectivity: 4 });
  assert.deepEqual(seg.regions.map(r => r.area), [16, 9]); // ids follow the first pixel: the ring starts at (0, 0)
  assert.equal(seg.adjacency[0].length, 12);
  assert.deepEqual([...seg.regions[1].centroid], [2.5, 2.5]);
  // two separate 2x2 blobs stay two regions; blobs touching only at a corner join under 8
  const apart = grid(9, 4, (x, y) => ((x < 2 || (x >= 5 && x < 7)) && y < 2 ? 0.9 : 0.1));
  assert.equal(segmentValueBands(apart, { bands: 2, connectivity: 8 }).regions.length, 3);
  const corner = grid(4, 4, (x, y) => ((x < 2 && y < 2) || (x >= 2 && y >= 2) ? 0.9 : 0.1));
  assert.equal(segmentValueBands(corner, { bands: 2, connectivity: 4 }).regions.length, 4);
  const joined = segmentValueBands(corner, { bands: 2, connectivity: 8 });
  assert.deepEqual(joined.regions.map(r => r.area), [8, 8]); // dark blobs join across their corner, and so do the light ones
});

test("an L-shaped region has hand-computed area, bounding box and centroid; ids follow raster order", () => {
  const pixels = new Set(["1,1", "1,2", "1,3", "1,4", "2,4", "3,4"]);
  const seg = segmentValueBands(grid(6, 6, (x, y) => (pixels.has(`${x},${y}`) ? 0.9 : 0.1)), { bands: 2, connectivity: 4 });
  assert.equal(seg.regions.length, 2);
  assert.equal(seg.regions[0].band, 0); assert.equal(seg.regions[0].id, 0); // pixel (0,0) comes first
  const l = seg.regions[1];
  assert.equal(l.area, 6); assert.deepEqual({ ...l.bbox }, { x0: 1, y0: 1, x1: 4, y1: 5 });
  near(l.centroid[0], 2, 1e-12); near(l.centroid[1], 3.5, 1e-12); near(l.mean, 0.9, 1e-12);
  const mask = valueRegionMask(seg, 1);
  assert.equal(mask.toArray().reduce((a, b) => a + b, 0), 6);
  assert.equal(mask.at(1, 4), 1); assert.equal(mask.at(2, 3), 0);
  assert.throws(() => valueRegionMask(seg, 2), /id must be an integer in \[0, 1\]/);
});

test("mask, alpha and minAlpha exclude pixels from every region", () => {
  const source = createRaster({ width: 4, height: 1, channels: 2, format: "f32", colorSpace: "linear", alpha: "straight", data: [0.1, 1, 0.1, 0.5, 0.1, 0, 0.1, 1] });
  const dflt = segmentValueBands(source, { bands: 2, connectivity: 4, value: "luminance", background: 0 });
  assert.equal(dflt.excluded, 1);
  assert.deepEqual(Array.from(dflt.labels.toArray()), [0, 0, -1, 1]);
  const strict = segmentValueBands(source, { bands: 2, connectivity: 4, value: "luminance", background: 0, minAlpha: 0.5 });
  assert.deepEqual(Array.from(strict.labels.toArray()), [0, -1, -1, 1]);
  const masked = segmentValueBands(grid(4, 1, () => 0.1), { bands: 2, connectivity: 4, mask: rows([[1, 0.5, 0.49, 1]]) });
  assert.deepEqual(Array.from(masked.labels.toArray()), [0, 0, -1, 1]); // exactly 0.5 is selected, 0.49 is not
  assert.equal(masked.regions.length, 2);
  assert.throws(() => segmentValueBands(grid(4, 1, () => 0), { bands: 2, connectivity: 4, mask: rows([[1, 1]]) }), /mask must be a ScalarGrid of 4 x 1/);
});

test("small regions merge into the neighbour that the policy names, ties broken as documented", () => {
  // a one-pixel speck between a dark region on its left and a light one on its right
  const strip = (speck: number) => segmentValueBands(rows([[0.1, 0.1, 0.1, speck, 0.9, 0.9, 0.9]]), { bands: 3, connectivity: 4, minArea: 2 });
  assert.deepEqual(strip(0.4).regions.map(r => r.area), [4, 3]); // nearer to 0.1 than to 0.9
  assert.deepEqual(strip(0.6).regions.map(r => r.area), [3, 4]);
  assert.equal(strip(0.4).merged, 1);
  // speck with three edges against A (0.1) and one against B (0.9), value nearer B
  const layout = rows([[0.1, 0.1, 0.1, 0.1], [0.1, 0.6, 0.9, 0.9], [0.1, 0.1, 0.9, 0.9]]);
  const longest = segmentValueBands(layout, { bands: 3, connectivity: 4, minArea: 2 });
  assert.deepEqual(longest.regions.map(r => [r.band, r.area]), [[0, 8], [2, 4]]);
  const nearest = segmentValueBands(layout, { bands: 3, connectivity: 4, minArea: 2, merge: "nearest-value" });
  assert.deepEqual(nearest.regions.map(r => [r.band, r.area]), [[0, 7], [2, 5]]);
  // ties: equal border and equal gap go to the smaller id (the region met first in raster order)
  const tie = segmentValueBands(rows([[0.125, 0.125, 0.5, 0.875, 0.875]]), { bands: 3, connectivity: 4, minArea: 2 });
  assert.deepEqual(tie.regions.map(r => r.area), [3, 2]);
});

test("merging cascades: growing regions absorb their neighbours and untouched regions keep their attributes", () => {
  // widths 1, 1, 1, 6 with bands alternating: minArea 3 chains the three specks together
  const seg = segmentValueBands(rows([[0.1, 0.5, 0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]]), { bands: 3, connectivity: 4, minArea: 3 });
  assert.equal(seg.undersized, 0);
  assert.ok(seg.regions.every(r => r.area >= 3));
  assert.equal(seg.regions.reduce((a, r) => a + r.area, 0), 9);
  // an isolated undersized region (no neighbour) stays and is reported
  const alone = segmentValueBands(rows([[0.1, 0.9]]), { bands: 2, connectivity: 4, minArea: 5, mask: rows([[1, 0]]) });
  assert.equal(alone.regions.length, 1); assert.equal(alone.undersized, 1); assert.equal(alone.excluded, 1);
  // untouched regions are unchanged by merging elsewhere
  const big = grid(12, 12, (x, y) => (x < 6 ? 0.1 : 0.9) + (x === 2 && y === 2 ? 0.5 : 0));
  const base = segmentValueBands(big, { bands: 2, connectivity: 4 }), merged = segmentValueBands(big, { bands: 2, connectivity: 4, minArea: 2 });
  assert.equal(base.regions.length, 3); assert.equal(merged.regions.length, 2);
  assert.equal(merged.regions[1].area, 72);
});

test("segmentation validates every option and refuses adversarial sizes", () => {
  const g = grid(4, 4, () => 0.5);
  assert.throws(() => segmentValueBands(g, { bands: 2 } as never), /connectivity must be 4 or 8/);
  assert.throws(() => segmentValueBands(g, { connectivity: 4 }), /exactly one of bands and thresholds/);
  assert.throws(() => segmentValueBands(g, { bands: 2, thresholds: [0.5], connectivity: 4 }), /exactly one/);
  assert.throws(() => segmentValueBands(g, { bands: 1, connectivity: 4 }), /bands must be an integer in \[2, 256\]/);
  assert.throws(() => segmentValueBands(g, { thresholds: [0.5, 0.5], connectivity: 4 }), /strictly increasing \(thresholds\[1\] = 0.5\)/);
  assert.throws(() => segmentValueBands(g, { bands: 2, connectivity: 4, minArea: 0 }), /minArea/);
  assert.throws(() => segmentValueBands(g, { bands: 2, connectivity: 4, merge: "biggest" as never }), /merge must be/);
  assert.throws(() => segmentValueBands(g, { bands: 2, connectivity: 4, value: "luma" }), /value applies to rasters/);
  const huge = createRaster({ width: 2049, height: 2049, channels: 1, format: "u8", colorSpace: "srgb", alpha: "none", data: new Uint8ClampedArray(2049 * 2049) });
  assert.throws(() => segmentValueBands(huge, { bands: 2, connectivity: 4 }), /exceeds 4194304 pixels; crop or shrink/);
  // a 1024 x 1024 checkerboard has 1,048,576 four-connected regions
  assert.throws(() => segmentValueBands(grid(1024, 1024, (x, y) => ((x + y) & 1) * 0.9), { bands: 2, connectivity: 4 }), /more than 1000000 regions before merging; use fewer bands/);
});

/** Independent oracle: plain flood fill, ids in raster order of each region's first pixel. */
function floodLabels(bands: number[], width: number, height: number, connectivity: 4 | 8): Int32Array {
  const labels = new Int32Array(bands.length).fill(-1);
  let next = 0;
  for (let start = 0; start < bands.length; start++) {
    if (labels[start] >= 0 || bands[start] < 0) continue;
    const stack = [start];
    labels[start] = next;
    while (stack.length) {
      const p = stack.pop()!, x = p % width, y = Math.floor(p / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx === 0 && dy === 0) || (connectivity === 4 && dx !== 0 && dy !== 0)) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (labels[q] < 0 && bands[q] === bands[p]) { labels[q] = next; stack.push(q); }
      }
    }
    next++;
  }
  return labels;
}

test("segmentation property: labels equal an independent flood fill; attributes, adjacency and merging keep their invariants", () => {
  const random = stream(2024);
  for (let trial = 0; trial < 60; trial++) {
    const width = 3 + Math.floor(random() * 18), height = 3 + Math.floor(random() * 14), connectivity = random() < 0.5 ? 4 : 8;
    const bands = 2 + Math.floor(random() * 4), smooth = random() < 0.5;
    const values = Array.from({ length: width * height }, (_, i) => (smooth ? Math.min(0.999, ((i % width) / width + Math.floor(i / width) / height) / 2 + random() * 0.2) : random()));
    const maskData = Array.from({ length: width * height }, () => (random() < 0.1 ? 0 : 1));
    const useMask = random() < 0.5, source = createScalarGrid(width, height, values), mask = createScalarGrid(width, height, maskData);
    const base = { bands, connectivity } as const;
    const plain = segmentValueBands(source, useMask ? { ...base, mask } : base);
    const cuts = Array.from({ length: bands - 1 }, (_, k) => (k + 1) / bands);
    const bandOf = values.map((v, i) => (useMask && maskData[i] === 0 ? -1 : cuts.filter(t => t <= v).length));
    assert.deepEqual(Array.from(plain.labels.toArray()), Array.from(floodLabels(bandOf, width, height, connectivity)), `trial ${trial}`);
    const minArea = 1 + Math.floor(random() * 12);
    const merged = segmentValueBands(source, { ...base, minArea, ...(useMask ? { mask } : {}) });
    const again = segmentValueBands(source, { ...base, minArea, ...(useMask ? { mask } : {}) });
    assert.deepEqual(Array.from(again.labels.toArray()), Array.from(merged.labels.toArray()), "deterministic");
    const labels = merged.labels.toArray();
    const inRegions = merged.regions.reduce((a, r) => a + r.area, 0);
    assert.equal(inRegions + merged.excluded, width * height);
    assert.equal(plain.regions.length - merged.merged, merged.regions.length);
    assert.equal(merged.excluded, useMask ? maskData.filter(m => m === 0).length : 0);
    const counted = new Array(merged.regions.length).fill(0);
    labels.forEach(l => { if (l >= 0) counted[l]++; });
    merged.regions.forEach((r, id) => {
      assert.equal(r.id, id); assert.equal(counted[id], r.area);
      if (r.area < minArea) assert.ok(merged.undersized > 0);
      assert.ok(r.bbox.x0 >= 0 && r.bbox.x1 <= width && r.bbox.y0 >= 0 && r.bbox.y1 <= height);
      assert.ok(r.centroid[0] > r.bbox.x0 && r.centroid[0] < r.bbox.x1 && r.centroid[1] > r.bbox.y0 && r.centroid[1] < r.bbox.y1);
    });
    // each merged region is connected under the chosen connectivity (relabel it alone and count components)
    merged.regions.forEach((_, id) => {
      const one = Array.from(labels, l => (l === id ? 0 : -1));
      assert.equal(new Set(Array.from(floodLabels(one, width, height, connectivity)).filter(v => v >= 0)).size, 1, `trial ${trial} region ${id}`);
    });
    // adjacency lengths equal a direct count of unit edges between different labels
    const edge = new Map<string, number>();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const l = labels[y * width + x];
      for (const [nx, ny] of [[x + 1, y], [x, y + 1]]) {
        if (nx >= width || ny >= height) continue;
        const r = labels[ny * width + nx];
        if (l >= 0 && r >= 0 && l !== r) edge.set(`${Math.min(l, r)}|${Math.max(l, r)}`, (edge.get(`${Math.min(l, r)}|${Math.max(l, r)}`) ?? 0) + 1);
      }
    }
    assert.equal(merged.adjacency.length, edge.size);
    merged.adjacency.forEach(a => { assert.ok(a.a < a.b); assert.equal(a.length, edge.get(`${a.a}|${a.b}`)); });
    // without a mask every region reaches minArea unless the whole image is smaller
    if (!useMask && width * height >= minArea) assert.equal(merged.undersized, 0);
  }
});

// ------------------------------------------------------------------------------------------ subdivision

test("a flat image is never subdivided, even at threshold zero", () => {
  const sub = subdivideImage(grid(32, 32, () => 0.37), { metric: "variance", threshold: 0, minCell: 1 });
  assert.equal(sub.leaves.length, 1); assert.equal(sub.nodes.length, 1);
  assert.equal(sub.leaves[0].id, "r"); assert.equal(sub.leaves[0].error, 0); near(sub.leaves[0].mean, 0.37, 1e-15);
});

test("cell counts for a step edge follow the quadtree exactly", () => {
  const step = (edge: number) => grid(32, 32, x => (x < edge ? 0 : 1));
  const opts = { metric: "variance", threshold: 0.001, minCell: 1 } as const;
  assert.equal(subdivideImage(step(16), opts).leaves.length, 4);
  assert.equal(subdivideImage(step(8), opts).leaves.length, 10);
  // minCell 4 stops at 4x4: the mixed 4x4 cells stay leaves
  const coarse = subdivideImage(step(9), { ...opts, minCell: 4 });
  assert.equal(coarse.leaves.length, 22);
  assert.ok(coarse.leaves.filter(c => c.error > 0.001).every(c => c.width === 4 && c.height === 4));
  // the leaves tile the image exactly once
  const labels = subdivisionLabels(coarse).toArray();
  assert.equal(labels.length, 1024);
  const areas = new Array(coarse.leaves.length).fill(0);
  labels.forEach(l => areas[l]++);
  assert.deepEqual(areas, coarse.leaves.map(c => c.width * c.height));
  // a one-pixel-fine step at x = 9 needs single-pixel leaves only along the edge
  const fine = subdivideImage(step(9), opts);
  assert.ok(fine.leaves.every(c => c.error <= 0.001));
  assert.ok(fine.leaves.some(c => c.width === 1));
  assert.ok(fine.leaves.every(c => !(c.x < 9 && c.x + c.width > 9)), "no leaf straddles the edge");
});

test("metrics have their stated values on a known cell", () => {
  const checker = rows([[0, 1], [1, 0]]);
  const value = (metric: "variance" | "stddev" | "range" | "sse") => subdivideImage(checker, { metric, threshold: 1e9, minCell: 2 }).nodes[0].error;
  near(value("variance"), 0.25, 1e-15); near(value("stddev"), 0.5, 1e-15); near(value("range"), 1, 1e-15); near(value("sse"), 1, 1e-15);
  const ramp = grid(4, 1, x => x / 4);
  const rampError = (metric: "variance" | "range") => subdivideImage(ramp, { metric, threshold: 1e9, minCell: 4 }).nodes[0].error;
  near(rampError("variance"), 5 / 64, 1e-15); // values 0, 1/4, 1/2, 3/4
  near(rampError("range"), 0.75, 1e-15);
});

test("split policies choose the documented axes", () => {
  const vertical = grid(16, 16, x => (x < 8 ? 0 : 1)), horizontal = grid(16, 16, (_, y) => (y < 8 ? 0 : 1));
  const count = (source: ScalarGrid, split: "quad" | "longest" | "best") => subdivideImage(source, { metric: "variance", threshold: 0.01, minCell: 1, split }).leaves.length;
  assert.equal(count(vertical, "quad"), 4);
  assert.equal(count(vertical, "longest"), 2);
  assert.equal(count(vertical, "best"), 2);
  assert.equal(count(horizontal, "best"), 2);
  assert.equal(count(horizontal, "longest"), 4); // ties split x first, leaving two mixed halves that then split y
  assert.equal(subdivideImage(horizontal, { metric: "variance", threshold: 0.01, minCell: 1, split: "best" }).nodes[0].split, "y");
  assert.equal(subdivideImage(vertical, { metric: "variance", threshold: 0.01, minCell: 1, split: "best" }).nodes[0].split, "x");
  // a tie between the axes (8 x 8 checker blocks split identically either way) splits x
  const blocks = grid(16, 16, (x, y) => (((x >> 3) + (y >> 3)) % 2 === 0 ? 0 : 1));
  assert.equal(subdivideImage(blocks, { metric: "variance", threshold: 0.01, minCell: 1, split: "best" }).nodes[0].split, "x");
});

test("maxCell forces subdivision and non-square images tile exactly", () => {
  const forced = subdivideImage(grid(64, 64, () => 0.5), { metric: "variance", threshold: 1, minCell: 8, maxCell: 16 });
  assert.equal(forced.leaves.length, 16); assert.ok(forced.leaves.every(c => c.width === 16 && c.height === 16));
  const wide = subdivideImage(grid(40, 8, () => 0.5), { metric: "variance", threshold: 1, minCell: 4, maxCell: 10 });
  assert.equal(wide.leaves.length, 8); assert.ok(wide.leaves.every(c => c.width === 10 && c.height === 4));
  assert.equal(wide.leaves.reduce((a, c) => a + c.width * c.height, 0), 320);
  // odd sizes split as floor then rest and stay within one pixel of each other
  const odd = subdivideImage(grid(13, 9, () => 0.5), { metric: "variance", threshold: 1, minCell: 1, maxCell: 3 });
  assert.equal(odd.leaves.reduce((a, c) => a + c.width * c.height, 0), 117);
  assert.ok(odd.leaves.every(c => c.width <= 3 && c.height <= 3));
});

test("subdivision is bounded and explicit about the control that caused the failure", () => {
  const noise = grid(64, 64, (x, y) => ((x * 7 + y * 13) % 5) / 5);
  assert.throws(() => subdivideImage(noise, { metric: "variance", threshold: 0, minCell: 1, maxCells: 100 }), /more than 100 cells; raise threshold, raise minCell or raise maxCells/);
  assert.throws(() => subdivideImage(noise, { metric: "variance", threshold: 0, minCell: 1, maxCells: 300000 }), /maxCells must be an integer in \[1, 250000\]/);
  assert.throws(() => subdivideImage(noise, { metric: "entropy" as never, threshold: 0, minCell: 1 }), /metric must be/);
  assert.throws(() => subdivideImage(noise, { metric: "variance", threshold: -1, minCell: 1 }), /threshold/);
  assert.throws(() => subdivideImage(noise, { metric: "variance", threshold: 0, minCell: 4, maxCell: 6 }), /maxCell must be an integer in \[7,/);
  assert.throws(() => subdivideImage(noise, { metric: "variance", threshold: 0, minCell: 1, split: "diagonal" as never }), /split must be/);
});

test("subdivision property: raising the threshold only prunes, ids never change, and leaves always tile", () => {
  const random = stream(77);
  for (let trial = 0; trial < 25; trial++) {
    const width = 8 + Math.floor(random() * 40), height = 8 + Math.floor(random() * 40);
    const phase = random() * 6;
    const source = grid(width, height, (x, y) => Math.min(1, Math.max(0, 0.5 + 0.4 * Math.sin(x * 0.4 + phase) * Math.cos(y * 0.3) + (random() - 0.5) * 0.05)));
    const split = (["quad", "longest", "best"] as const)[trial % 3], metric = (["variance", "range", "sse", "stddev"] as const)[trial % 4];
    let previous: Subdivision | null = null;
    for (const threshold of [0.0005, 0.005, 0.03, 0.2, 5]) {
      const sub = subdivideImage(source, { metric, threshold, minCell: 2, split, maxCells: 250_000 });
      const labels = subdivisionLabels(sub).toArray();
      assert.ok(labels.every(l => l >= 0), "every pixel belongs to a leaf");
      assert.equal(sub.leaves.reduce((a, c) => a + c.width * c.height, 0), width * height);
      if (previous) {
        const ids = new Map(previous.nodes.map(n => [n.id, n]));
        for (const node of sub.nodes) {
          const before = ids.get(node.id)!;
          assert.ok(before, `${node.id} exists at the finer threshold`);
          assert.deepEqual([node.x, node.y, node.width, node.height], [before.x, before.y, before.width, before.height]);
        }
        assert.ok(sub.leaves.length <= previous.leaves.length);
      }
      for (const leaf of sub.leaves) assert.ok(leaf.error <= threshold || (leaf.width < 4 && leaf.height < 4), `${leaf.id} stays above the threshold only at the minimum size`);
      previous = sub;
    }
  }
});

// ------------------------------------------------------------------------------------------ orientation

const ramp = (width: number, height: number, angle: number, k = 0.01) => grid(width, height, (x, y) => 0.5 + k * (x * Math.cos(angle) + y * Math.sin(angle)));
const mod = (a: number) => a - Math.PI * Math.floor(a / Math.PI);
const angleGap = (a: number, b: number) => { const d = Math.abs(mod(a) - mod(b)); return Math.min(d, Math.PI - d); };

test("a constant image has zero coherence and energy, and the stated fallback direction", () => {
  const field = orientationField(grid(9, 9, () => 0.4), { smoothing: 2, fallback: 0.7 });
  for (const [x, y] of [[0, 0], [4, 4], [8, 3]]) {
    const o = orientationPixel(field, x, y);
    assert.equal(o.coherence, 0); assert.equal(o.energy, 0); assert.equal(o.defined, false); near(o.direction, 0.7, 1e-15);
  }
  const grids = orientationGrids(field);
  assert.ok(grids.coherence.toArray().every(v => v === 0));
  near(orientationAt(field, 3.3, 5.1).direction, 0.7, 1e-15);
  assert.equal(orientationField(grid(4, 4, () => 0), { smoothing: 0, fallback: -0.3 }).fallback, mod(-0.3));
});

test("linear ramps have exact gradients: direction is the level-line tangent, energy the squared slope", () => {
  // y points down, angles run clockwise on screen: a ramp increasing along +x has vertical level lines
  const cases: [number, number][] = [[0, Math.PI / 2], [Math.PI / 2, 0], [Math.PI / 4, (3 * Math.PI) / 4], [-Math.PI / 4, Math.PI / 4], [0.3, 0.3 + Math.PI / 2], [1, 1 + Math.PI / 2], [2, mod(2 + Math.PI / 2)], [2.9, mod(2.9 + Math.PI / 2)], [4, mod(4 + Math.PI / 2)]];
  for (const [angle, tangent] of cases) {
    const field = orientationField(ramp(41, 41, angle), { smoothing: 1 });
    for (const [x, y] of [[8, 8], [20, 20], [32, 12], [12, 30]]) {
      const o = orientationPixel(field, x, y);
      assert.ok(angleGap(o.direction, tangent) < 1e-9, `angle ${angle}: ${o.direction} vs ${tangent}`);
      near(o.coherence, 1, 1e-9); near(o.energy, 0.01 ** 2, 1e-12);
      assert.ok(o.direction >= 0 && o.direction < Math.PI);
      assert.ok(angleGap(o.gradientDirection, tangent + Math.PI / 2) < 1e-9);
      assert.equal(o.defined, true);
    }
  }
});

test("stripes at known angles are recovered with coherence one; crossed stripes have none", () => {
  const stripes = (angle: number) => grid(97, 97, (x, y) => 0.5 + 0.4 * Math.sin((2 * Math.PI * (x * Math.cos(angle) + y * Math.sin(angle))) / 16));
  // axis-aligned and 45 degree stripes are exact by symmetry of the operator; others within the operator's small angular error
  for (const [angle, tolerance] of [[0, 1e-9], [Math.PI / 2, 1e-9], [Math.PI / 4, 1e-9], [Math.PI / 6, 0.03], [Math.PI / 3, 0.03], [(2 * Math.PI) / 3, 0.03]] as const) {
    const field = orientationField(stripes(angle), { smoothing: 6 });
    const o = orientationPixel(field, 48, 48);
    assert.ok(angleGap(o.direction, angle + Math.PI / 2) < tolerance, `stripe angle ${angle}: ${o.direction}`);
    assert.ok(o.coherence > 0.9999, `coherence ${o.coherence}`);
  }
  const cross = grid(97, 97, (x, y) => 0.5 + 0.2 * Math.sin((2 * Math.PI * x) / 16) + 0.2 * Math.sin((2 * Math.PI * y) / 16));
  assert.ok(orientationPixel(orientationField(cross, { smoothing: 8 }), 48, 48).coherence < 0.05);
  // a rank-one tensor stays rank one when averaged over parallel structure, and the average of perpendicular ones cancels
  const mixed = grid(64, 32, (x, y) => (x < 32 ? 0.5 + 0.4 * Math.sin((2 * Math.PI * y) / 16) : 0.5 + 0.4 * Math.sin((2 * Math.PI * x) / 16)));
  const half = orientationField(mixed, { smoothing: 0 });
  assert.ok(angleGap(orientationPixel(half, 10, 8).direction, 0) < 1e-9);
  assert.ok(angleGap(orientationPixel(half, 50, 8).direction, Math.PI / 2) < 1e-9);
});

test("sampling interpolates the tensor, so unsigned orientations cannot flip or cancel wrongly", () => {
  const make = (tensors: [number, number, number][], width: number): OrientationField => {
    const part = (k: number) => createScalarGrid(width, 1, tensors.map(t => t[k]));
    return { width, height: 1, smoothing: 0, flatEnergy: 1e-10, fallback: 0, tensor: { xx: part(0), xy: part(1), yy: part(2) } };
  };
  const tangent = (d: number): [number, number, number] => { const g = d - Math.PI / 2; return [Math.cos(g) ** 2, Math.cos(g) * Math.sin(g), Math.sin(g) ** 2]; };
  // perpendicular equal-energy neighbours: halfway there is no direction, a quarter of the way it is the nearer one at coherence 1/2
  const perpendicular = make([[1, 0, 0], [0, 0, 1]], 2);
  const mid = orientationAt(perpendicular, 1, 0.5);
  assert.equal(mid.coherence, 0); assert.equal(mid.defined, false);
  const quarter = orientationAt(perpendicular, 0.75, 0.5);
  near(quarter.coherence, 0.5, 1e-12); near(quarter.direction, Math.PI / 2, 1e-12); near(quarter.energy, 1, 1e-12);
  // pixel centres reproduce the pixel
  const pixel = orientationPixel(perpendicular, 1, 0), centre = orientationAt(perpendicular, 1.5, 0.5);
  near(pixel.direction, centre.direction, 1e-15); near(pixel.coherence, centre.coherence, 1e-15);
  // 0.05 and pi - 0.05 average to horizontal, not to the arithmetic mean pi/2
  const wrap = make([tangent(0.05), tangent(Math.PI - 0.05)], 2);
  const avg = orientationAt(wrap, 1, 0.5);
  assert.ok(angleGap(avg.direction, 0) < 1e-9, `${avg.direction}`);
  assert.ok(avg.coherence > 0.98);
  assert.throws(() => orientationAt(perpendicular, NaN, 0), /must be finite/);
  assert.throws(() => orientationPixel(perpendicular, 2, 0), /outside 2 x 1/);
});

test("orientationVector keeps its sign against a hint and never flips a trajectory at the wrap", () => {
  const sample = (direction: number) => ({ direction, gradientDirection: mod(direction + Math.PI / 2), coherence: 1, energy: 1, defined: true });
  const left = orientationVector(sample(Math.PI - 0.01), { hint: [-1, 0.02] });
  assert.ok(left[0] < 0);
  const right = orientationVector(sample(Math.PI - 0.01), { hint: [1, 0] });
  assert.ok(right[0] > 0);
  assert.deepEqual(orientationVector(sample(1)), [Math.cos(1), Math.sin(1)]);
  assert.deepEqual(orientationVector(sample(0), { hint: [0, 1] }), [1, 0]); // perpendicular hint: default sign
  near(orientationVector(sample(0.4), { across: true })[0], Math.cos(0.4 + Math.PI / 2), 1e-15);
  // integrate along an orientation that rotates through the wrap: consecutive steps stay within 90 degrees
  let hint: [number, number] = [-1, 0.001];
  let prev = hint;
  for (let k = 0; k < 400; k++) {
    const a = mod(Math.PI - 0.6 + 0.003 * k * Math.PI); // sweeps across pi and 0
    const v = orientationVector(sample(a), { hint });
    assert.ok(v[0] * prev[0] + v[1] * prev[1] >= 0);
    prev = v; hint = v;
  }
});

test("orientation grids agree with per-pixel samples; work and options are bounded", () => {
  const field = orientationField(bundledRaster("portrait", 2, 40), { smoothing: 2 });
  const grids = orientationGrids(field);
  for (const [x, y] of [[5, 5], [20, 18], [33, 30]]) {
    const o = orientationPixel(field, x, y);
    assert.equal(grids.direction.at(x, y), o.direction); assert.equal(grids.coherence.at(x, y), o.coherence); assert.equal(grids.energy.at(x, y), o.energy);
  }
  const big = createScalarGrid(2048, 2048, new Float64Array(2048 * 2048));
  assert.throws(() => orientationField(big, { smoothing: 64 }), /smoothing 64 on 2048 x 2048 needs about .* million operations; the limit is 1000 million: lower smoothing or shrink/);
  assert.throws(() => orientationField(big, {} as never), /smoothing must be a finite number in \[0, 64\]/);
  assert.throws(() => orientationField(big, { smoothing: 65 }), /smoothing/);
  assert.doesNotThrow(() => orientationField(createScalarGrid(200, 200, new Float64Array(200 * 200)), { smoothing: 64 }));
});

// ------------------------------------------------------------------------------------------ scan runs and sorting

test("straight scan lines: runs, starts and ordering are exact in every direction", () => {
  const values = rows([[0.1, 0.5, 0.5, 0.9], [0.5, 0.5, 0.5, 0.5], [0.9, 0.4, 0.9, 0.4]]);
  const base: ScanOptions = { direction: "right", min: 0.3, max: 0.7 };
  const list = (o: Partial<ScanOptions>) => scanRuns(values, { ...base, ...o }).runs.map(r => [r.x, r.y, r.length, r.line]);
  assert.deepEqual(list({}), [[1, 0, 2, 0], [0, 1, 4, 1], [1, 2, 1, 2], [3, 2, 1, 2]]);
  assert.deepEqual(list({ minRun: 2 }), [[1, 0, 2, 0], [0, 1, 4, 1]]);
  assert.deepEqual(list({ direction: "left" }), [[2, 0, 2, 0], [3, 1, 4, 1], [3, 2, 1, 2], [1, 2, 1, 2]]);
  const down = scanRuns(values, { ...base, direction: "down" });
  assert.deepEqual(down.runs.map(r => [r.x, r.y, r.length, r.line]), [[0, 1, 1, 0], [1, 0, 3, 1], [2, 0, 2, 2], [3, 1, 2, 3]]);
  assert.equal(down.selectedPixels, 8); assert.equal(down.lines, 4);
  // inclusive bounds: values exactly on min and max are selected
  assert.equal(scanRuns(rows([[0.3, 0.7, 0.7000001]]), { direction: "right", min: 0.3, max: 0.7 }).selectedPixels, 2);
  // diagonal lines start where the predecessor leaves the image
  const all = scanRuns(grid(3, 3, () => 0.5), { direction: "down-right" });
  assert.deepEqual(all.runs.map(r => r.length), [3, 2, 1, 2, 1]);
  assert.deepEqual(all.runs.map(r => [r.x, r.y]), [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]]);
  assert.equal(scanRunPixel(all, all.runs[0], 2), 8);
  assert.throws(() => scanRunPixel(all, all.runs[0], 3), /k must be an integer in \[0, 2\]/);
});

test("runs partition the selected pixels exactly and are maximal, for every direction", () => {
  const random = stream(9);
  const directions: ScanDirection[] = ["right", "left", "down", "up", "down-right", "down-left", "up-right", "up-left"];
  for (const direction of directions) for (let trial = 0; trial < 6; trial++) {
    const width = 2 + Math.floor(random() * 15), height = 2 + Math.floor(random() * 15);
    const values = Array.from({ length: width * height }, () => random());
    const maskData = Array.from({ length: width * height }, () => (random() < 0.15 ? 0 : 1));
    const min = random() * 0.4, max = 0.6 + random() * 0.4, minRun = 1 + Math.floor(random() * 3);
    const set = scanRuns(createScalarGrid(width, height, values), { direction, min, max, minRun, mask: createScalarGrid(width, height, maskData) });
    const covered = new Int32Array(width * height);
    const selected = (p: number) => values[p] >= min && values[p] <= max && maskData[p] === 1;
    for (const run of set.runs) {
      assert.ok(run.length >= minRun);
      for (let k = 0; k < run.length; k++) { const p = (run.y + k * set.dy) * width + run.x + k * set.dx; assert.ok(selected(p)); covered[p]++; assert.equal(scanRunPixel(set, run, k), p); }
      const before = (run.y - set.dy) * width + run.x - set.dx, bx = run.x - set.dx, by = run.y - set.dy;
      if (bx >= 0 && bx < width && by >= 0 && by < height) assert.ok(!selected(before), "maximal at its start");
      const ex = run.x + run.length * set.dx, ey = run.y + run.length * set.dy;
      if (ex >= 0 && ex < width && ey >= 0 && ey < height) assert.ok(!selected(ey * width + ex), "maximal at its end");
    }
    assert.ok(covered.every(c => c <= 1));
    if (minRun === 1) for (let p = 0; p < width * height; p++) assert.equal(covered[p] === 1, selected(p));
    assert.equal(set.selectedPixels, covered.reduce((a, b) => a + b, 0));
    // every pixel is on exactly one line: with everything selected the runs cover the image once
    const all = scanRuns(createScalarGrid(width, height, new Array(width * height).fill(0.5)), { direction });
    assert.equal(all.selectedPixels, width * height); assert.equal(all.runs.length, all.lines);
  }
});

test("scan options fail clearly and bound the run count", () => {
  const g = grid(4, 4, () => 0.5);
  assert.throws(() => scanRuns(g, {} as never), /direction must be one of/);
  assert.throws(() => scanRuns(g, { direction: "sideways" as never }), /direction must be one of/);
  assert.throws(() => scanRuns(g, { direction: "right", min: 0.8, max: 0.2 }), /min must not exceed max/);
  assert.throws(() => scanRuns(g, { direction: "right", minRun: 0 }), /minRun/);
  assert.throws(() => scanRuns(g, { direction: "right", mask: grid(3, 4, () => 1) }), /mask must be a ScalarGrid of 4 x 4/);
  assert.throws(() => scanRuns(grid(2002, 1000, (x) => (x & 1) * 0.5), { direction: "right", min: 0.4, max: 0.6 }), /more than 1000000 runs; raise minRun/);
});

test("sorting is stable, ties keep scan order in both orders and both directions", () => {
  const key = rows([[0.9, 0.1, 0.5, 0.1]]);
  const cases: [ScanDirection, "ascending" | "descending", number[], number[]][] = [
    ["right", "ascending", [0, 1, 2, 3], [1, 3, 2, 0]],
    ["right", "descending", [0, 1, 2, 3], [0, 2, 1, 3]],
    ["left", "ascending", [3, 2, 1, 0], [3, 1, 2, 0]],
    ["left", "descending", [3, 2, 1, 0], [0, 2, 3, 1]],
  ];
  for (const [direction, order, to, from] of cases) {
    const runs = scanRuns(key, { direction });
    const moves = sortScanRuns(key, runs, { key, order });
    assert.deepEqual(Array.from({ length: moves.count }, (_, i) => moves.to(i)), to, `${direction} ${order} to`);
    assert.deepEqual(Array.from({ length: moves.count }, (_, i) => moves.from(i)), from, `${direction} ${order} from`);
  }
  assert.throws(() => sortScanRuns(key, scanRuns(key, { direction: "right" }), { key, order: "up" as never }), /order must be/);
  assert.throws(() => sortScanRuns(key, scanRuns(key, { direction: "right" }), { key: "luma", order: "ascending" }), /needs a Raster source/);
  assert.throws(() => sortScanRuns(key, scanRuns(key, { direction: "right" }), { key: grid(2, 1, () => 0), order: "ascending" }), /key must be a value kind or a ScalarGrid of 4 x 1/);
});

test("pixel sorting permutes only selected runs, conserves pixels, orders keys and reproduces exactly", () => {
  const random = stream(31);
  for (let trial = 0; trial < 30; trial++) {
    const width = 4 + Math.floor(random() * 20), height = 3 + Math.floor(random() * 10), channels = ([3, 4] as const)[trial % 2];
    const data = Array.from({ length: width * height * channels }, () => Math.floor(random() * 256));
    if (channels === 4) for (let p = 0; p < width * height; p++) data[p * 4 + 3] = 1 + Math.floor(random() * 255);
    const source = createRaster({ width, height, channels, format: "u8", colorSpace: "srgb", alpha: channels === 4 ? "straight" : "none", data });
    const direction = (["right", "left", "down", "up", "down-right", "up-left"] as ScanDirection[])[trial % 6];
    const maskData = Array.from({ length: width * height }, () => (random() < 0.2 ? 0 : 1));
    const scan: ScanOptions = { direction, min: 0.2, max: 0.9, mask: createScalarGrid(width, height, maskData), minRun: 2 };
    const order = trial % 4 < 2 ? "ascending" as const : "descending" as const;
    const a = pixelSort(source, scan, { key: "luma", order, alpha: "move" }), b = pixelSort(source, scan, { key: "luma", order, alpha: "move" });
    assert.equal(a.raster.hash, b.raster.hash, "exactly reproducible");
    const before = rasterData(source).data, after = rasterData(a.raster).data;
    const inRun = new Uint8Array(width * height);
    const sortedLuma = valueField(a.raster, "luma");
    for (const run of a.runs.runs) {
      const bag = (data: ArrayLike<number>) => Array.from({ length: run.length }, (_, k) => Array.from({ length: channels }, (_, c) => data[scanRunPixel(a.runs, run, k) * channels + c]).join(",")).sort();
      assert.deepEqual(bag(after), bag(before), "the pixels of a run are conserved");
      for (let k = 0; k < run.length; k++) {
        const p = scanRunPixel(a.runs, run, k);
        inRun[p] = 1;
        assert.equal(maskData[p], 1, "protected pixels are never in a run");
        if (k > 0) {
          const q = scanRunPixel(a.runs, run, k - 1);
          assert.ok(order === "ascending" ? sortedLuma.get(q) <= sortedLuma.get(p) : sortedLuma.get(q) >= sortedLuma.get(p), "keys are ordered");
        }
      }
    }
    for (let p = 0; p < width * height; p++) if (!inRun[p]) for (let c = 0; c < channels; c++) assert.equal(after[p * channels + c], before[p * channels + c], "unselected pixels are unchanged");
  }
});

test("alpha 'stay' moves color but leaves every slot's own alpha; premultiplied storage stays valid", () => {
  const straight = createRaster({ width: 3, height: 1, channels: 4, format: "u8", colorSpace: "srgb", alpha: "straight", data: [255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 64] });
  const key = rows([[3, 2, 1]]);
  const runs = scanRuns(key, { direction: "right", min: 0, max: 10 });
  const moves = sortScanRuns(key, runs, { key, order: "ascending" });
  assert.deepEqual(Array.from(rasterData(applyPixelMoves(straight, moves, { alpha: "move" })).data), [0, 0, 255, 64, 0, 255, 0, 128, 255, 0, 0, 255]);
  assert.deepEqual(Array.from(rasterData(applyPixelMoves(straight, moves, { alpha: "stay" })).data), [0, 0, 255, 255, 0, 255, 0, 128, 255, 0, 0, 64]);
  const premultiplied = createRaster({ width: 3, height: 1, channels: 4, format: "u8", colorSpace: "srgb", alpha: "premultiplied", data: [255, 0, 0, 255, 0, 128, 0, 128, 0, 0, 64, 64] });
  assert.deepEqual(Array.from(rasterData(applyPixelMoves(premultiplied, moves, { alpha: "stay" })).data), [0, 0, 255, 255, 0, 128, 0, 128, 64, 0, 0, 64]);
  assert.throws(() => applyPixelMoves(straight, moves, { alpha: "keep" as never }), /alpha must be "move" or "stay"/);
  const other = createRaster({ width: 2, height: 1, channels: 1, format: "u8", colorSpace: "srgb", alpha: "none", data: [1, 2] });
  assert.throws(() => applyPixelMoves(other, moves, { alpha: "move" }), /outside this raster/);
});

// ------------------------------------------------------------------------------------------ frequency modulation

test("constant tone: the offset is the closed-form sine, with the exact phase and vertex count", () => {
  const line = frequencyModulation({ length: 10, tones: [0.5, 0.5], frequency: { min: 1, max: 3 }, amplitude: { min: 0, max: 4 }, phase: 0.3, maxPhaseStep: 0.3 });
  const f = 2, amplitude = 2;
  assert.equal(line.count, 420); // total phase 2*pi*2*10 = 40 pi = 125.66 needs ceil(125.66 / 0.3) = 419 steps
  near(line.largestPhaseStep, (40 * Math.PI) / 419, 1e-12);
  line.s.forEach((s, k) => {
    near(line.phase[k], 0.3 + 2 * Math.PI * f * s, 1e-9);
    near(line.offset[k], amplitude * Math.sin(0.3 + 2 * Math.PI * f * s), 1e-9);
    near(line.frequency[k], f, 1e-12); near(line.amplitude[k], amplitude, 1e-12);
  });
  assert.equal(line.s[0], 0); assert.equal(line.s[line.count - 1], 10);
  near(line.endPhase, 0.3 + 2 * Math.PI * 20, 1e-9);
});

test("a tone ramp integrates frequency exactly: phase is quadratic and never jumps", () => {
  const L = 8, fMin = 1, fMax = 5;
  const line = frequencyModulation({ length: L, tones: s => s / L, samples: 41, frequency: { min: fMin, max: fMax }, amplitude: { min: 1, max: 1 }, maxPhaseStep: Math.PI / 6 });
  line.s.forEach((s, k) => {
    near(line.phase[k], 2 * Math.PI * (fMin * s + ((fMax - fMin) * s * s) / (2 * L)), 1e-9);
    near(line.frequency[k], fMin + ((fMax - fMin) * s) / L, 1e-12);
    near(line.offset[k], Math.sin(line.phase[k]), 1e-12);
  });
  let largest = 0;
  for (let k = 1; k < line.count; k++) {
    assert.ok(line.s[k] > line.s[k - 1]);
    assert.ok(line.phase[k] >= line.phase[k - 1]);
    largest = Math.max(largest, line.phase[k] - line.phase[k - 1]);
    assert.ok(Math.abs(line.offset[k] - line.offset[k - 1]) <= Math.PI / 6 + 1e-12, "no jump in offset beyond the phase step");
  }
  assert.ok(largest <= Math.PI / 6 + 1e-12); near(line.largestPhaseStep, largest, 1e-12);
});

test("phase continues across a following line, and a white area keeps advancing the wave", () => {
  const spec = { frequency: { min: 1, max: 1 }, amplitude: { min: 2, max: 2 } };
  const whole = frequencyModulation({ length: 6, tones: [0.2, 0.2], ...spec, phase: 0.4 });
  const first = frequencyModulation({ length: 2, tones: [0.2, 0.2], ...spec, phase: 0.4 });
  const second = frequencyModulation({ length: 4, tones: [0.2, 0.2], ...spec, phase: first.endPhase });
  near(first.endPhase, 0.4 + 2 * Math.PI * 2, 1e-12);
  second.s.forEach((s, k) => near(second.offset[k], 2 * Math.sin(0.4 + 2 * Math.PI * (2 + s)), 1e-9));
  near(second.endPhase, whole.endPhase, 1e-9);
  // tone 0 with amplitude.min 0: a straight line whose phase still advances, then a dark stretch continues the same wave
  const mixed = frequencyModulation({ length: 4, tones: s => (s < 2 ? 0 : 1), samples: 5, frequency: { min: 1, max: 1 }, amplitude: { min: 0, max: 3 } });
  mixed.s.forEach((s, k) => {
    near(mixed.phase[k], 2 * Math.PI * s, 1e-9);
    if (s <= 1) near(mixed.offset[k], 0, 1e-15);
  });
  assert.ok(mixed.offset.some(v => Math.abs(v) > 2.9));
  // the curve exponent shapes tone before the mapping
  const curved = frequencyModulation({ length: 2, tones: [0.5, 0.5], frequency: { min: 0, max: 4 }, amplitude: { min: 0, max: 1 }, curve: 2 });
  near(curved.frequency[0], 1, 1e-12);
});

test("frequency modulation validates its inputs and its work bound names the control", () => {
  const ok = { length: 10, tones: [0, 1], frequency: { min: 1, max: 2 }, amplitude: { min: 0, max: 1 } };
  assert.throws(() => frequencyModulation({ ...ok, tones: [0, 1.2] }), /tones\[1\] must be a finite number in \[0, 1\]/);
  assert.throws(() => frequencyModulation({ ...ok, tones: [0, NaN] }), /tones\[1\]/);
  assert.throws(() => frequencyModulation({ ...ok, tones: [0.5] }), /tones needs 2 to 1000000 values/);
  assert.throws(() => frequencyModulation({ ...ok, tones: () => 0.5 }), /samples must be an integer/);
  assert.throws(() => frequencyModulation({ ...ok, samples: 3 }), /samples applies only when tones is a function/);
  assert.throws(() => frequencyModulation({ ...ok, maxPhaseStep: 2 }), /maxPhaseStep must be a finite number in \[/);
  assert.throws(() => frequencyModulation({ ...ok, frequency: { min: -1, max: 2 } }), /frequency.min/);
  assert.throws(() => frequencyModulation({ ...ok, amplitude: { min: 0, max: Infinity } }), /amplitude.max/);
  assert.throws(() => frequencyModulation({ ...ok, length: 0 }), /length/);
  assert.throws(() => frequencyModulation({ ...ok, tones: [1, 1], length: 1000, frequency: { min: 1e6, max: 1e6 } }), /more than 1000000 vertices; lower frequency.max, raise maxPhaseStep or shorten length/);
});

test("modulated polylines offset to the right of the direction of travel", () => {
  const line = frequencyModulation({ length: 4, tones: [1, 1], frequency: { min: 0.25, max: 0.25 }, amplitude: { min: 1, max: 1 }, maxPhaseStep: 0.4 });
  const east = modulatedPolyline(line, { x: 10, y: 20, angle: 0 }), south = modulatedPolyline(line, { x: 10, y: 20, angle: Math.PI / 2 });
  line.s.forEach((s, k) => {
    near(east[k][0], 10 + s, 1e-12); near(east[k][1], 20 + line.offset[k], 1e-12);
    near(south[k][0], 10 - line.offset[k], 1e-12); near(south[k][1], 20 + s, 1e-12);
  });
  // one quarter cycle in, the sine peaks: east-bound offset is +1 (down on screen)
  const peak = line.s.findIndex(s => Math.abs(s - 1) < 1e-9);
  near(east[peak][1], 21, 1e-9);
  assert.throws(() => modulatedPolyline(line, { x: NaN, y: 0, angle: 0 }), /origin.x/);
});

test("a bundled sample flows through segmentation, subdivision and sorting with every pixel accounted for", () => {
  const raster = bundledRaster("portrait", 4, 64);
  const seg = segmentValueBands(raster, { bands: 4, connectivity: 8, minArea: 30 });
  assert.equal(seg.regions.reduce((a, r) => a + r.area, 0), 64 * 64);
  const sub = subdivideImage(raster, { metric: "sse", threshold: 0.02, minCell: 2, maxCells: 2000 });
  assert.equal(sub.leaves.reduce((a, c) => a + c.width * c.height, 0), 64 * 64);
  const sorted = pixelSort(raster, { direction: "right", min: 0.3, max: 0.8, minRun: 3 }, { key: "luma", order: "ascending", alpha: "move" });
  const untouched = new Set<number>(Array.from({ length: 64 * 64 }, (_, i) => i));
  for (const run of sorted.runs.runs) for (let k = 0; k < run.length; k++) untouched.delete(scanRunPixel(sorted.runs, run, k));
  for (const p of untouched) assert.deepEqual(rasterPixel(sorted.raster, p % 64, Math.floor(p / 64)), rasterPixel(raster, p % 64, Math.floor(p / 64)));
});
