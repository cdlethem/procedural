import assert from "node:assert/strict";
import test from "node:test";
import {
  boundValueRegionWork, componentSeed, createInstrument, createRaster, definitions, drawInstrument, drawnValueRegions, drawValueRegions, keptValueRegions,
  locateInDomain, smoothValues, createScalarGrid, usesSeed, validateInstrument, valueRegionHatchSpacing, valueRegionMap, valueRegionOutline, valueRegionsComposition,
  valueRegionsOf, valueRetainRules, prepareInstrument, rasterPixel, sampleGrid, createCompositionRun,
  type PlanarDomain, type Raster, type ValueRegionMap, type ValueRegionOptions, type ValueRegionShape, type ValueRegionsRecipe,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.js";

const near = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const deepFrozen = (value: unknown): boolean =>
  value === null || typeof value !== "object" || (Object.isFrozen(value) && Object.values(value as object).every(deepFrozen));
const stream = (seed: number) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x1_0000_0000;

const gray = (width: number, height: number, byte: (x: number, y: number) => number): Raster => {
  const data = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[y * width + x] = byte(x, y);
  return createRaster({ width, height, channels: 1, format: "u8", colorSpace: "srgb", alpha: "none", data });
};
/** CIE L* / 100 of an sRGB gray byte, computed here from the definition. */
const lstar = (byte: number) => {
  const c = byte / 255, y = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return (y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y) / 100;
};
const DARK = 20, MID = 130, LIGHT = 240;

/** Options with `scale` canvas units per source pixel, no smoothing, no merging, exact boundaries unless overridden. */
const optionsFor = (source: Raster, over: Partial<ValueRegionOptions> = {}, scale = 1): ValueRegionOptions => ({
  seed: 5, source, centerX: (source.width * scale) / 2, centerY: (source.height * scale) / 2, width: source.width * scale, height: source.height * scale,
  measure: "lightness", smoothing: 0, bands: { kind: "equal", count: 2 }, connectivity: 4, minArea: 0, merge: "longest-border", simplify: 0, ...over,
});
const ringEdges = (domain: PlanarDomain): [string, string][] => {
  const out: [string, string][] = [];
  for (const piece of domain.regions) for (const ring of [piece.outer, ...piece.holes]) for (let i = 0; i < ring.length; i++) out.push([ring[i].join(","), ring[(i + 1) % ring.length].join(",")]);
  return out;
};

// --- independent references -------------------------------------------------------------------------------------

/** Connected components of equal band by flood fill (band from the documented equal-width rule), as sorted pixel counts. */
function referenceComponents(w: number, h: number, band: (x: number, y: number) => number, connectivity: 4 | 8): number[] {
  const seen = new Uint8Array(w * h), sizes: number[] = [];
  const steps = connectivity === 4 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let y0 = 0; y0 < h; y0++) for (let x0 = 0; x0 < w; x0++) {
    if (seen[y0 * w + x0]) continue;
    const b = band(x0, y0), stack = [[x0, y0]];
    seen[y0 * w + x0] = 1;
    let size = 0;
    while (stack.length) {
      const [x, y] = stack.pop()!;
      size++;
      for (const [dx, dy] of steps) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || band(nx, ny) !== b) continue;
        seen[ny * w + nx] = 1; stack.push([nx, ny]);
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => a - b);
}
const distanceToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
const distanceToBoundary = (domain: PlanarDomain, x: number, y: number): number => {
  let best = Infinity;
  for (const piece of domain.regions) for (const ring of [piece.outer, ...piece.holes]) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    best = Math.min(best, distanceToSegment(x, y, a[0], a[1], b[0], b[1]));
  }
  return best;
};

/** Blobby three-band picture: smoothed noise quantised to gray steps. */
const blobs = (seed: number, w = 36, h = 26): Raster => {
  const r = stream(seed), g = Float64Array.from({ length: w * h }, () => r());
  return gray(w, h, (x, y) => {
    let s = 0, c = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += g[yy * w + xx]; c++; } }
    const v = s / c;
    return v < 0.45 ? DARK : v < 0.5 ? MID : LIGHT;
  });
};

// --- segmentation into shapes: exact analytic pictures --------------------------------------------------------------

/** 16 x 16 at two canvas units per pixel: dark field, light 10 x 10 square inside it, dark 4 x 4 core inside that. */
const nestedSquares = (): Raster => gray(16, 16, (x, y) => (x >= 6 && x < 10 && y >= 6 && y < 10) ? DARK : (x >= 3 && x < 13 && y >= 3 && y < 13) ? LIGHT : DARK);

test("concentric squares give a three-level hierarchy with exact areas, holes and shared boundary lengths", () => {
  const map = valueRegionMap(optionsFor(nestedSquares(), {}, 2));
  assert.deepEqual(map.regions.map((r) => r.id), ["v0", "v51", "v102"], "ids are the raster-order index of each first pixel");
  const [outer, middle, core] = map.regions;
  // Same-band regions are NOT joined through the region between them.
  assert.equal(outer.band, 0); assert.equal(middle.band, 1); assert.equal(core.band, 0);
  assert.deepEqual([outer.pixels, middle.pixels, core.pixels], [256 - 100, 100 - 16, 16]);
  near(outer.area, (256 - 100) * 4); near(middle.area, (100 - 16) * 4); near(core.area, 16 * 4);
  near(outer.area + middle.area + core.area, 32 * 32);
  assert.equal(outer.domain.regions[0].holes.length, 1, "the light square is a hole of the dark field");
  assert.equal(middle.domain.regions[0].holes.length, 1);
  assert.deepEqual([outer.parent, middle.parent, core.parent], [null, "v0", "v51"]);
  assert.deepEqual([outer.depth, middle.depth, core.depth], [0, 1, 2]);
  assert.deepEqual([outer.children, middle.children, core.children], [["v51"], ["v102"], []]);
  // The hole of the outer region is exactly the outer ring of the middle region, walked the other way.
  const hole = [...outer.domain.regions[0].holes[0]].map((p) => p.join(",")).sort();
  assert.deepEqual(hole, ["26,26", "26,6", "6,26", "6,6"].sort());
  assert.deepEqual(new Set(middle.domain.regions[0].outer.map((p) => p.join(","))), new Set(hole));
  assert.deepEqual(map.adjacency.map((a) => [a.a, a.b, a.length, a.arcs]), [["v0", "v51", 80, 1], ["v51", "v102", 32, 1]]);
  assert.deepEqual(outer.neighbors, [{ id: "v51", length: 80 }]);
  assert.deepEqual(middle.neighbors.map((n) => n.id), ["v0", "v102"]);
  assert.equal(outer.open, true); assert.equal(middle.open, false); assert.equal(core.open, false);
  // The four frame edges are one closed arc (the corners are not junctions); each boundary between two regions is one closed arc.
  assert.deepEqual(map.arcs.map((x) => [x.id, x.closed, x.length]), [["v0|~#0", true, 128], ["v0|v51#0", true, 80], ["v51|v102#0", true, 32]]);
});

test("corner contact joins under 8 and separates under 4: a checkerboard is one region per pixel or two regions of many pieces", () => {
  const board = gray(4, 4, (x, y) => (x + y) % 2 === 0 ? DARK : LIGHT);
  const four = valueRegionMap(optionsFor(board, { connectivity: 4 })), eight = valueRegionMap(optionsFor(board, { connectivity: 8 }));
  assert.equal(four.regions.length, 16);
  assert.ok(four.regions.every((r) => r.pixels === 1 && r.domain.regions.length === 1));
  assert.equal(eight.regions.length, 2);
  assert.ok(eight.regions.every((r) => r.pixels === 8 && r.domain.regions.length === 8), "each 8-connected region is eight squares touching at corners");
  near(eight.regions[0].area + eight.regions[1].area, 16);
  assert.deepEqual(eight.adjacency.map((a) => [a.a, a.b]), [[eight.regions[0].id, eight.regions[1].id]]);
});

test("regions equal an independent flood fill of the bands, under both connectivities, and tile the picture", () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const source = blobs(seed, 30 + seed, 22);
    const band = (x: number, y: number) => { const l = lstar(gray0(source, x, y)); return l < 0.25 ? 0 : l < 0.5 ? 1 : l < 0.75 ? 2 : 3; };
    for (const connectivity of [4, 8] as const) {
      const map = valueRegionMap(optionsFor(source, { connectivity, bands: { kind: "equal", count: 4 } }, 3));
      assert.deepEqual(map.regions.map((r) => r.pixels).sort((a, b) => a - b), referenceComponents(source.width, source.height, band, connectivity), `seed ${seed} connectivity ${connectivity}`);
      near(map.regions.reduce((s, r) => s + r.area, 0), source.width * source.height * 9, 1e-6);
    }
  }
});
const gray0 = (raster: Raster, x: number, y: number): number => Math.round(rasterPixel(raster, x, y)[0] * 255);

test("neighbouring regions share every boundary edge exactly, before and after simplification, and arcs use each edge once", () => {
  for (const simplify of [0, 2.5, 7]) for (const seed of [1, 2, 3, 4]) {
    const source = blobs(seed), scale = 4, map = valueRegionMap(optionsFor(source, { bands: { kind: "equal", count: 4 }, connectivity: seed % 2 === 0 ? 8 : 4, simplify }, scale));
    const owner = new Map<string, string>();
    for (const r of map.regions) for (const [a, b] of ringEdges(r.domain)) owner.set(`${a}|${b}`, r.id);
    let frame = 0, arcEdges = 0;
    const left = 0, top = 0, right = source.width * scale, bottom = source.height * scale;
    for (const [key, id] of owner) {
      const [a, b] = key.split("|"), reverse = owner.get(`${b}|${a}`);
      if (reverse !== undefined) { assert.notEqual(reverse, id); continue; }
      const [ax, ay] = a.split(",").map(Number), [bx, by] = b.split(",").map(Number);
      const onFrame = (Math.abs(ax - left) < 1e-9 && Math.abs(bx - left) < 1e-9) || (Math.abs(ax - right) < 1e-9 && Math.abs(bx - right) < 1e-9) ||
        (Math.abs(ay - top) < 1e-9 && Math.abs(by - top) < 1e-9) || (Math.abs(ay - bottom) < 1e-9 && Math.abs(by - bottom) < 1e-9);
      assert.ok(onFrame, `simplify ${simplify} seed ${seed}: edge ${key} of ${id} has no partner and is not on the frame`);
      frame++;
    }
    // Arcs: every undirected boundary edge appears in exactly one arc, oriented with `left` on its left.
    const seenEdge = new Set<string>();
    for (const arc of map.arcs) {
      const pts = arc.points, n = pts.length, last = arc.closed ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const a = pts[i].join(","), b = pts[(i + 1) % n].join(","), undirected = a < b ? `${a}|${b}` : `${b}|${a}`;
        assert.ok(!seenEdge.has(undirected), `edge ${undirected} in two arcs`);
        seenEdge.add(undirected); arcEdges++;
        assert.equal(owner.get(`${a}|${b}`), arc.left, "the left region owns the edge in the arc's direction");
        assert.equal(owner.get(`${b}|${a}`) ?? null, arc.right);
      }
    }
    assert.equal(arcEdges, [...owner.keys()].filter((k) => { const [a, b] = k.split("|"); return !owner.has(`${b}|${a}`) || a < b; }).length);
    // Arcs end exactly where three or more boundary edges meet: an interior vertex of an arc has two edges, and a junction is never interior.
    const degree = new Map<string, number>();
    for (const key of seenEdge) for (const v of key.split("|")) degree.set(v, (degree.get(v) ?? 0) + 1);
    for (const arc of map.arcs) for (let i = arc.closed ? 0 : 1; i < (arc.closed ? arc.points.length : arc.points.length - 1); i++) {
      if (arc.closed && i === 0) continue;
      assert.equal(degree.get(arc.points[i].join(",")), 2, `simplify ${simplify} seed ${seed}: ${arc.id} passes through a junction`);
    }
    assert.ok(frame > 0);
    near(map.regions.reduce((s, r) => s + r.area, 0), source.width * source.height * scale * scale, 1e-6);
  }
});

test("arc sides are the regions actually on each side: a point just left and just right of an edge is inside exactly those regions", () => {
  const map = valueRegionMap(optionsFor(blobs(3), { bands: { kind: "equal", count: 4 }, simplify: 3 }, 4));
  const byId = new Map(map.regions.map((r) => [r.id, r]));
  const inside = (r: ValueRegionShape | undefined, x: number, y: number) => r !== undefined && locateInDomain(r.domain, x, y) === "inside";
  let checked = 0;
  for (const arc of map.arcs) for (let i = 0; i + 1 < arc.points.length; i++) {
    const [ax, ay] = arc.points[i], [bx, by] = arc.points[i + 1], mx = (ax + bx) / 2, my = (ay + by) / 2;
    const len = Math.hypot(bx - ax, by - ay), dx = (bx - ax) / len, dy = (by - ay) / len, e = 1e-4;
    // The domain convention: the region is on the LEFT of travel, the side of the rotation (dx, dy) -> (-dy, dx) of the shoelace orientation.
    const lx = mx - dy * e, ly = my + dx * e, rx = mx + dy * e, ry = my - dx * e;
    assert.ok(inside(byId.get(arc.left), lx, ly), `${arc.id} segment ${i}: left point not in ${arc.left}`);
    if (arc.right !== null) assert.ok(inside(byId.get(arc.right), rx, ry), `${arc.id}: right point not in ${arc.right}`);
    else assert.ok(!map.regions.some((r) => locateInDomain(r.domain, rx, ry) !== "outside"), `${arc.id}: nothing lies beyond a frame arc`);
    checked++;
  }
  assert.ok(checked > 100);
});

test("simplification never changes topology and no boundary vertex moves farther than the tolerance", () => {
  const source = blobs(2), scale = 4, exact = valueRegionMap(optionsFor(source, { bands: { kind: "equal", count: 4 }, connectivity: 8 }, scale));
  for (const tolerance of [1, 3, 6]) {
    const thin = valueRegionMap(optionsFor(source, { bands: { kind: "equal", count: 4 }, connectivity: 8, simplify: tolerance }, scale));
    assert.deepEqual(thin.regions.map((r) => [r.id, r.parent, r.depth, r.band, r.pixels]), exact.regions.map((r) => [r.id, r.parent, r.depth, r.band, r.pixels]));
    assert.deepEqual(thin.adjacency.map((a) => [a.a, a.b]), exact.adjacency.map((a) => [a.a, a.b]));
    assert.deepEqual(thin.regions.map((r) => r.domain.regions.map((p) => p.holes.length)), exact.regions.map((r) => r.domain.regions.map((p) => p.holes.length)));
    const vertices = (m: ValueRegionMap) => m.regions.reduce((n, r) => n + r.domain.regions.reduce((t, p) => t + p.outer.length, 0), 0);
    assert.ok(tolerance < 6 ? vertices(thin) <= vertices(exact) : vertices(thin) < vertices(exact));
    // Every exact boundary vertex is within the tolerance of the thinned boundary of its region.
    for (const region of exact.regions) {
      const thinned = thin.regions.find((r) => r.id === region.id)!;
      for (const piece of region.domain.regions) for (const [x, y] of piece.outer) assert.ok(distanceToBoundary(thinned.domain, x, y) <= tolerance + 1e-9, `${region.id} tolerance ${tolerance}`);
    }
  }
});

test("the four corners of the picture frame survive heavy simplification and the regions still tile it", () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const w = 30, h = 20, r = stream(seed), source = gray(w, h, () => (r() < 0.5 ? DARK : LIGHT)), scale = 3;
    const map = valueRegionMap(optionsFor(source, { bands: { kind: "equal", count: 2 }, minArea: 6 * 9, connectivity: 8, simplify: 12 }, scale));
    near(map.regions.reduce((s, x) => s + x.area, 0), w * h * scale * scale, 1e-6);
    const corners = new Set(map.regions.flatMap((x) => x.domain.regions.flatMap((p) => [...p.outer, ...p.holes.flat()])).map((p) => p.join(",")));
    for (const c of [[0, 0], [w * scale, 0], [0, h * scale], [w * scale, h * scale]]) assert.ok(corners.has(c.join(",")), `seed ${seed}: corner ${c} lost`);
  }
});

test("small regions merge by the stated policy and a merged hole disappears", () => {
  const island = gray(10, 10, (x, y) => (x >= 4 && x < 6 && y >= 4 && y < 6) ? LIGHT : (x === 1 && y === 8) ? MID : DARK);
  const opts = { bands: { kind: "equal", count: 3 } as const };
  const exact = valueRegionMap(optionsFor(island, opts));
  assert.deepEqual(exact.regions.map((r) => r.pixels), [95, 4, 1]);
  const speckGone = valueRegionMap(optionsFor(island, { ...opts, minArea: 3 }));
  assert.deepEqual(speckGone.regions.map((r) => r.pixels), [96, 4], "a 1 pixel speck merges, a 4 pixel island stays");
  assert.equal(speckGone.regions[0].domain.regions[0].holes.length, 1);
  assert.equal(speckGone.merged, 1);
  const flat = valueRegionMap(optionsFor(island, { ...opts, minArea: 5 }));
  assert.deepEqual(flat.regions.map((r) => r.pixels), [100]);
  assert.equal(flat.regions[0].domain.regions[0].holes.length, 0);
  assert.equal(flat.regions[0].domain.regions.length, 1);
  // One mid pixel, three edges against dark and one against light: the policies choose different neighbours.
  const pixel = gray(5, 3, (x, y) => (x === 2 && y === 1) ? MID : x < 3 ? DARK : LIGHT);
  const longest = valueRegionMap(optionsFor(pixel, { ...opts, minArea: 2, merge: "longest-border" })), nearest = valueRegionMap(optionsFor(pixel, { ...opts, minArea: 2, merge: "nearest-value" }));
  assert.deepEqual(longest.regions.map((r) => [r.band, r.pixels]), [[0, 9], [2, 6]]);
  assert.deepEqual(nearest.regions.map((r) => [r.band, r.pixels]), [[0, 8], [2, 7]]);
  assert.ok(Math.abs(lstar(MID) - lstar(LIGHT)) < Math.abs(lstar(MID) - lstar(DARK)));
});

test("balanced bands give every band the same number of pixels; equal widths do not", () => {
  const ramp = gray(100, 1, (x) => Math.round((x * 255) / 99));
  const balanced = valueRegionMap(optionsFor(ramp, { bands: { kind: "balanced", count: 4 } }));
  assert.deepEqual(balanced.regions.map((r) => r.pixels), [25, 25, 25, 25]);
  assert.equal(balanced.thresholds.length, 3);
  const equal = valueRegionMap(optionsFor(ramp, { bands: { kind: "equal", count: 4 } }));
  assert.notDeepEqual(equal.regions.map((r) => r.pixels), [25, 25, 25, 25]);
  // A flat picture has no balanced cut and stays one region.
  assert.equal(valueRegionMap(optionsFor(gray(8, 8, () => MID), { bands: { kind: "balanced", count: 5 } })).regions.length, 1);
  // Cuts: a value equal to a cut belongs to the band above it.
  const stairs = gray(4, 1, (x) => [0, 64, 128, 255][x]);
  const cut = lstar(128);
  assert.deepEqual(valueRegionMap(optionsFor(stairs, { bands: { kind: "cuts", cuts: [cut] } })).regions.map((r) => r.pixels), [2, 2]);
});

test("transparent pixels belong to no region, regions beside them are open and the outline hugs the cut", () => {
  const w = 8, h = 8, data = new Uint8ClampedArray(w * h * 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { data[(y * w + x) * 2] = x < 5 ? DARK : LIGHT; data[(y * w + x) * 2 + 1] = x < 3 ? 0 : 255; }
  const source = createRaster({ width: w, height: h, channels: 2, format: "u8", colorSpace: "srgb", alpha: "straight", data });
  const map = valueRegionMap(optionsFor(source, {}, 2));
  assert.equal(map.regions.length, 2);
  near(map.regions.reduce((s, r) => s + r.area, 0), 5 * 8 * 4);
  assert.ok(map.regions.every((r) => r.coverage === 1));
  assert.ok(map.regions[0].open, "the dark region borders the transparent strip");
  assert.equal(map.regions[1].open, true, "the light region touches the frame");
  const cutArc = map.arcs.find((a) => a.left === map.regions[0].id && a.right === null)!;
  assert.ok(cutArc.points.every(([x]) => x >= 6 - 1e-9), "no region reaches into the transparent columns");
  assert.ok(map.regions.every((r) => locateInDomain(r.domain, 2, 8) === "outside"));
});

test("values are frozen, cached by construction and their ids never depend on the seed", () => {
  const options = optionsFor(blobs(4), { bands: { kind: "equal", count: 4 }, simplify: 2 }, 4);
  const a = valueRegionMap(options), b = valueRegionMap({ ...options });
  assert.equal(a, b, "same construction, same object");
  assert.ok(deepFrozen(a.regions[0]) && deepFrozen(a.arcs) && deepFrozen(a.adjacency));
  const c = valueRegionMap({ ...options, seed: 99 });
  assert.notEqual(a, c);
  assert.deepEqual(c.regions.map((r) => r.id), a.regions.map((r) => r.id));
  assert.equal(c.regions[0].domain, a.regions[0].domain, "the polygons are shared between seeds");
  assert.deepEqual(c.regions.map((r) => r.seed), c.regions.map((r) => componentSeed(99, r.id, "region")));
  assert.notEqual(valueRegionMap({ ...options, simplify: 3 }), a);
});

test("retention only ever adds regions as the fraction rises, and rank rules pick by their attribute", () => {
  const map = valueRegionMap(optionsFor(blobs(5), { bands: { kind: "equal", count: 4 }, minArea: 12 }, 4));
  assert.ok(map.regions.length >= 8);
  for (const rule of valueRetainRules) {
    let previous = new Set<string>();
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      const kept = keptValueRegions(map, fraction, rule), ids = new Set(kept.map((x) => x.id));
      for (const id of previous) assert.ok(ids.has(id), `${rule} ${fraction}: ${id} dropped`);
      if (rule !== "chance") assert.equal(kept.length, Math.round(fraction * map.regions.length), `${rule} ${fraction}`);
      previous = ids;
    }
    assert.equal(previous.size, map.regions.length);
  }
  const half = keptValueRegions(map, 0.5, "largest"), rest = map.regions.filter((r) => !half.includes(r));
  assert.ok(Math.min(...half.map((r) => r.area)) >= Math.max(...rest.map((r) => r.area)));
  const dark = keptValueRegions(map, 0.5, "dark"), lightRest = map.regions.filter((r) => !dark.includes(r));
  assert.ok(Math.max(...dark.map((r) => r.tone)) <= Math.min(...lightRest.map((r) => r.tone)));
  const chance = (seed: number) => keptValueRegions(valueRegionMap({ ...optionsFor(blobs(5), { bands: { kind: "equal", count: 4 }, minArea: 12 }, 4), seed }), 0.5, "chance").map((x) => x.id);
  assert.deepEqual(chance(1), chance(1));
  assert.notDeepEqual(chance(1), chance(2));
});

test("failures name the control to change", () => {
  const noise = gray(64, 64, (x, y) => ((x * 7 + y * 13 + ((x ^ y) * 3)) % 5) * 60);
  assert.throws(() => valueRegionMap(optionsFor(noise, { bands: { kind: "equal", count: 5 }, maxRegions: 50 })), /raise minArea, raise smoothing, use fewer bands or lower resolution/);
  assert.throws(() => valueRegionMap(optionsFor(noise, { smoothing: 500 })), /lower smoothing/);
  assert.throws(() => valueRegionMap(optionsFor(noise, { bands: { kind: "cuts", cuts: [0.6, 0.4] } })), /cuts must be strictly increasing/);
  assert.throws(() => valueRegionMap(optionsFor(noise, { bands: { kind: "equal", count: 1 } })), /bands must be an integer/);
  assert.throws(() => valueRegionMap(optionsFor(noise, { connectivity: 6 as never })), /connectivity must be 4 or 8/);
});

test("smoothing is a Gaussian: constants stay constant, results match direct convolution, values stay in range", () => {
  const constant = smoothValues(createScalarGrid(9, 7, new Float64Array(63).fill(0.4)), 2);
  for (const v of sampleAll(constant)) near(v, 0.4, 1e-12);
  const r = stream(9), w = 11, h = 9, data = Float64Array.from({ length: w * h }, () => r()), grid = createScalarGrid(w, h, data);
  const sigma = 1.3, radius = Math.ceil(3 * sigma), out = sampleAll(smoothValues(grid, sigma));
  const kernel = (d: number) => Math.exp(-(d * d) / (2 * sigma * sigma));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let j = Math.max(0, y - radius); j <= Math.min(h - 1, y + radius); j++) for (let i = Math.max(0, x - radius); i <= Math.min(w - 1, x + radius); i++) { const k = kernel(i - x) * kernel(j - y); s += k * data[j * w + i]; n += k; }
    near(out[y * w + x], s / n, 1e-12);
  }
  assert.equal(smoothValues(grid, 0), grid);
  assert.ok(out.every((v) => v >= Math.min(...data) - 1e-12 && v <= Math.max(...data) + 1e-12));
});
const sampleAll = (grid: { width: number; height: number }): number[] => {
  const out: number[] = [];
  for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) out.push(sampleGrid(grid as never, x + 0.5, y + 0.5));
  return out;
};

// --- consumers: what reaches the canvas -----------------------------------------------------------------------------

type Shape = { points: [number, number][]; fill: boolean; stroke: boolean; close: boolean };
type Line = [number, number, number, number];
function recorder() {
  const shapes: Shape[] = [], lines: Line[] = [], calls: string[] = [];
  let current: [number, number][] = [], fill = true, stroke = true;
  const surface = new Proxy({ CLOSE: "close", ROUND: "round" } as Record<string, unknown>, {
    get(target, name: string) {
      if (name in target) return target[name];
      return (...args: unknown[]) => {
        calls.push(name);
        if (name === "noFill") fill = false; else if (name === "fill") fill = true;
        else if (name === "noStroke") stroke = false; else if (name === "stroke") stroke = true;
        else if (name === "beginShape") current = [];
        else if (name === "vertex") current.push([args[0] as number, args[1] as number]);
        else if (name === "endShape") shapes.push({ points: current, fill, stroke, close: args[0] === "close" });
        else if (name === "line") lines.push(args as Line);
      };
    },
  });
  return { surface: surface as never, shapes, lines, calls };
}
const shoelace = (points: readonly (readonly number[])[]) => {
  let s = 0;
  for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
};
const instrument = (params: Record<string, number | string | boolean> = {}, seed = 4) => {
  const input = createInstrument("connected-value-regions");
  input.seed = seed; input.params = { ...input.params, ...params };
  return input;
};
const recipeOf = (params: Record<string, number | string | boolean> = {}, seed = 4): ValueRegionsRecipe => valueRegionsComposition(instrument(params, seed));
const keptOf = (recipe: ValueRegionsRecipe) => { const map = valueRegionsOf(recipe); return { map, kept: keptValueRegions(map, recipe.select.retained, recipe.select.by) }; };

test("flat fill paints exactly the polygons: holes stay open and the painted area is the sum of the region areas", () => {
  for (const image of ["portrait", "geometry", "landscape"]) {
    const recipe = recipeOf({ image, fill: "flat", outline: "none", bands: 5, minArea: .3 }), { kept } = keptOf(recipe), rec = recorder();
    drawValueRegions(rec.surface, recipe);
    const painted = rec.shapes.filter((s) => s.fill);
    near(painted.reduce((s, p) => s + Math.abs(shoelace(p.points)), 0), kept.reduce((s, r) => s + r.area, 0), 1e-6);
    assert.equal(painted.length, kept.reduce((s, r) => s + r.domain.regions.length, 0), image);
    assert.ok(kept.some((r) => r.domain.regions.some((p) => p.holes.length > 0)), `${image} has holes to keep open`);
  }
});

test("a gutter pulls each fill back by half its width from the boundary and erases regions thinner than it", () => {
  // Light strip 8 units wide, dark field 40, light field 32; 48 units tall (scale 4).
  const map = valueRegionMap(optionsFor(gray(20, 12, (x) => x < 2 ? LIGHT : x < 12 ? DARK : LIGHT), {}, 4));
  const [strip, field, right] = map.regions;
  assert.deepEqual(map.regions.map((r) => r.area), [8 * 48, 40 * 48, 32 * 48]);
  const one = drawnValueRegions(map.regions, 1);
  assert.deepEqual(one.map((d) => d.shape.id), [strip.id, field.id, right.id]);
  near(one[0].domain.area, 7 * 47); near(one[1].domain.area, 39 * 47); near(one[2].domain.area, 31 * 47);
  for (const d of one) for (const piece of d.domain.regions) for (const [x, y] of [...piece.outer, ...piece.holes.flat()]) {
    assert.equal(locateInDomain(d.shape.domain, x, y), "inside");
    assert.ok(distanceToBoundary(d.shape.domain, x, y) >= 0.5 - 1e-9);
  }
  const ten = drawnValueRegions(map.regions, 10);
  assert.deepEqual(ten.map((d) => d.shape.id), [field.id, right.id], "the 8 unit strip is erased by a 10 unit gutter");
  near(ten[0].domain.area, 30 * 38); near(ten[1].domain.area, 22 * 38);
  assert.equal(drawnValueRegions(map.regions, 0)[0].domain, map.regions[0].domain, "no gutter, no copy");
});

test("hatching stays inside every polygon and its spacing follows tone exactly", () => {
  const recipe = recipeOf({ fill: "hatch", outline: "none", gutter: 2, crossBelow: 0, hatchSpacing: 5, toneResponse: 1, hatchDirection: "fixed", bandTurn: 0, jitter: 0, hatchAngle: 20, body: 0, minArea: .5 });
  const { kept } = keptOf(recipe), drawn = drawnValueRegions(kept, 2), rec = recorder();
  drawValueRegions(rec.surface, recipe);
  assert.ok(rec.lines.length > 300);
  const perRegion = new Map<string, Line[]>();
  for (const line of rec.lines) {
    const mx = (line[0] + line[2]) / 2, my = (line[1] + line[3]) / 2;
    const owners = drawn.filter((d) => locateInDomain(d.domain, mx, my) === "inside");
    assert.equal(owners.length, 1, "a hatch line's midpoint is strictly inside exactly one polygon (so never in a hole)");
    // Endpoints are computed crossings, rounded to the nearest double: they may sit one ulp off the boundary.
    for (const [x, y] of [[line[0], line[1]], [line[2], line[3]]]) assert.ok(locateInDomain(owners[0].domain, x, y) !== "outside" || distanceToBoundary(owners[0].domain, x, y) < 1e-9);
    perRegion.set(owners[0].shape.id, [...(perRegion.get(owners[0].shape.id) ?? []), line]);
  }
  const theta = (20 * Math.PI) / 180, nx = -Math.sin(theta), ny = Math.cos(theta);
  let checked = 0;
  for (const [id, lines] of perRegion) {
    const tone = kept.find((r) => r.id === id)!.tone, expected = 5 * 2 ** (1 * (2 * tone - 1));
    const offsets = [...new Set(lines.map((l) => Math.round((l[0] * nx + l[1] * ny) * 1e6) / 1e6))].sort((a, b) => a - b);
    for (let i = 1; i < offsets.length; i++) near(offsets[i] - offsets[i - 1], expected, 2e-6);
    near(valueRegionHatchSpacing({ spacing: 5, toneResponse: 1 } as never, tone), expected);
    if (offsets.length > 1) checked++;
  }
  assert.ok(checked >= 5);
  assert.ok(valueRegionHatchSpacing({ spacing: 5, toneResponse: 1 } as never, 0) < 5 && valueRegionHatchSpacing({ spacing: 5, toneResponse: 1 } as never, 1) > 5);
  near(valueRegionHatchSpacing({ spacing: 5, toneResponse: 1 } as never, 0.5), 5);
});

test("the outline strokes each boundary edge once: its length is every perimeter counted once, shared edges included once", () => {
  const recipe = recipeOf({ fill: "none", outline: "ink", bands: 5, minArea: .3 }), { map, kept } = keptOf(recipe), rec = recorder();
  drawValueRegions(rec.surface, recipe);
  const strokes = rec.shapes.filter((s) => s.stroke && !s.fill);
  const length = strokes.reduce((s, p) => s + p.points.reduce((t, q, i) => { const n = p.points[(i + 1) % p.points.length]; return t + (i + 1 < p.points.length || p.close ? Math.hypot(n[0] - q[0], n[1] - q[1]) : 0); }, 0), 0);
  const perimeters = kept.reduce((s, r) => s + r.domain.perimeter, 0), frame = 2 * (recipe.plan.width + recipe.plan.height);
  near(length, (perimeters + frame) / 2, 1e-6);
  assert.equal(strokes.length, map.arcs.length);
  // Dropping regions draws only the arcs that border a kept one.
  const partial = recipeOf({ fill: "none", outline: "ink", bands: 5, minArea: .3, retained: .4 }), part = keptOf(partial);
  const arcs = valueRegionOutline(part.map, part.kept, 1);
  assert.ok(arcs.length < part.map.arcs.length && arcs.every((a) => part.kept.some((r) => r.id === part.map.arcs.find((x) => x.id === a.id)!.left || r.id === part.map.arcs.find((x) => x.id === a.id)!.right)));
});

test("nested marks and contour lines stay inside the polygon, away from its edge by the clearance", () => {
  for (const nestedKind of ["motifs", "contours"]) {
    const recipe = recipeOf({ fill: "nested", nestedKind, outline: "none", body: 0, gutter: 0, nestedInset: 4, markSize: 8, minArea: 1, image: "geometry", bands: 4 }), { kept } = keptOf(recipe);
    const rec = recorder();
    drawValueRegions(rec.surface, recipe);
    assert.ok(rec.calls.length > 100, nestedKind);
    if (nestedKind === "contours") {
      const inks = rec.shapes.filter((s) => s.stroke && !s.fill);
      assert.ok(inks.length > 10);
      for (const s of inks) for (const [x, y] of s.points) {
        const owner = kept.find((r) => locateInDomain(r.domain, x, y) !== "outside");
        assert.ok(owner, `contour vertex ${x},${y} is outside every region`);
        assert.ok(distanceToBoundary(owner!.domain, x, y) >= 4 - 1e-6, "clearance");
      }
    }
  }
});

// --- the instrument -------------------------------------------------------------------------------------------------

test("the authored default cuts every bundled picture into a handful of coherent, nested, mostly-large shapes", () => {
  for (const image of ["portrait", "geometry", "landscape", "noise"]) {
    const input = instrument({ image }), recipe = valueRegionsComposition(input);
    validateInstrument(input);
    const map = valueRegionsOf(recipe);
    assert.ok(map.regions.length >= 5 && map.regions.length <= 60, `${image}: ${map.regions.length} regions`);
    near(map.regions.reduce((s, r) => s + r.area, 0), recipe.plan.width * recipe.plan.height, 1e-6);
    const total = recipe.plan.width * recipe.plan.height, big = map.regions.filter((r) => r.area > total * 0.03);
    assert.ok(big.length >= 4, `${image}: several large shapes`);
    assert.ok(map.regions.every((r) => r.area >= total * 0.005 * 0.5), `${image}: no speck survives the minimum area`);
  }
  const scene = valueRegionsOf(recipeOf({ image: "geometry" }));
  assert.ok(scene.regions.some((r) => r.depth >= 1), "the geometric scene has regions inside others");
  assert.ok(scene.regions.some((r) => r.domain.regions.some((p) => p.holes.length > 0)));
  const rec = recorder();
  drawInstrument(rec.surface, instrument());
  assert.ok(rec.lines.length > 500 && rec.shapes.length > 20);
});

test("appearance edits repaint the same regions; structural edits replace them", () => {
  const base = valueRegionsOf(recipeOf());
  for (const params of [{ fill: "flat" }, { color: "palette" }, { body: .3 }, { gutter: 4 }, { retained: .4 }, { keepBy: "dark" }, { outline: "stitch" }, { outlineWeight: 3 }, { hatchSpacing: 9 },
    { hatchAngle: 10 }, { crossBelow: 0 }, { nestedInset: 6 }, { jitter: 20 }, { hatchDirection: "fixed" }])
    assert.equal(valueRegionsOf(recipeOf(params)), base, JSON.stringify(params));
  for (const params of [{ bands: 3 }, { bandMode: "equal" }, { image: "geometry" }, { variant: 8 }, { measure: "luma" }, { smoothing: 5 }, { corners: true }, { minArea: 2 }, { merge: "nearest-value" },
    { simplify: 8 }, { resolution: 96 }, { zoom: 2 }, { width: 400 }, { centerX: 300 }])
    assert.notEqual(valueRegionsOf(recipeOf(params)), base, JSON.stringify(params));
  // The seed changes labels only, never the partition.
  assert.deepEqual(valueRegionsOf(recipeOf({}, 9)).regions.map((r) => [r.id, r.area]), base.regions.map((r) => [r.id, r.area]));
});

test("coupled bounds are refused; the seed matters only where chance is used; hidden controls change nothing", () => {
  assert.throws(() => validateInstrument(instrument({ bandMode: "manual", cut1: .6, cut2: .4, cut3: .9 })), /Manual cuts must rise/);
  validateInstrument(instrument({ bandMode: "equal", cut1: .6, cut2: .4, cut3: .9 }));
  assert.equal(usesSeed(instrument({ retained: 1, jitter: 0 })), false);
  assert.equal(usesSeed(instrument({ retained: .5, keepBy: "chance", jitter: 0 })), true);
  assert.equal(usesSeed(instrument({ retained: .5, keepBy: "largest", jitter: 0 })), false);
  assert.equal(usesSeed(instrument({ fill: "hatch", jitter: 10 })), true);
  assert.equal(usesSeed(instrument({ fill: "nested" })), true);
  assert.equal(usesSeed(instrument({ fill: "flat", retained: 1 })), false);
  for (const held of [{ jitter: 0 }, { fill: "flat" }]) assert.equal(drawFingerprint(instrument(held, 1)), drawFingerprint(instrument(held, 2)));
  assert.notEqual(drawFingerprint(instrument({ retained: .6 }, 1)), drawFingerprint(instrument({ retained: .6 }, 2)));
  assert.notEqual(drawFingerprint(instrument({ jitter: 30 }, 1)), drawFingerprint(instrument({ jitter: 30 }, 2)));
  assert.notEqual(drawFingerprint(instrument({ fill: "nested" }, 1)), drawFingerprint(instrument({ fill: "nested" }, 2)));
  const cases: [Record<string, number | string | boolean>, Record<string, number | string | boolean>][] = [
    [{ fill: "flat" }, { hatchSpacing: 12, hatchWeight: 3, hatchAngle: 40, toneResponse: 2, crossBelow: .9, crossAngle: 30, bandTurn: 40, jitter: 30, hatchDirection: "fixed", mark: "arrow", markSize: 20, nestedKind: "contours", contourLevels: 9, nestedWeight: 2, nestedInset: 8 }],
    [{ fill: "hatch" }, { nestedKind: "contours", mark: "arrow", markSize: 20, markSpacing: 30, contourLevels: 9, contourMaterial: "beads", nestedWeight: 2, nestedInset: 8 }],
    [{ fill: "nested", nestedKind: "motifs" }, { hatchSpacing: 12, hatchWeight: 3, jitter: 30, contourLevels: 9, contourMaterial: "stitch" }],
    [{ fill: "nested", nestedKind: "contours" }, { mark: "arrow", markSize: 20, markSpacing: 30, hatchAngle: 50 }],
    [{ fill: "none" }, { color: "palette", body: .2, gutter: 6, hatchSpacing: 12, mark: "arrow", nestedInset: 8 }],
    [{ bandMode: "equal" }, { cut1: .1, cut2: .2, cut3: .3 }], [{ bandMode: "manual" }, { bands: 7 }],
    [{ outline: "none" }, { outlineColor: "accent", outlineWeight: 3, outlineSpacing: 12 }], [{ outline: "ink" }, { outlineSpacing: 12 }],
  ];
  for (const [held, hidden] of cases) assert.equal(drawFingerprint(instrument({ ...held, ...hidden })), drawFingerprint(instrument(held)), JSON.stringify([held, hidden]));
  assert.notEqual(drawFingerprint(instrument({ hatchSpacing: 9 })), drawFingerprint(instrument()));
  assert.notEqual(drawFingerprint(instrument({ outlineWeight: 3 })), drawFingerprint(instrument()));
});

test("counted work covers what is drawn, and a bound names the control to change", async () => {
  const configs: Record<string, number | string | boolean>[] = [
    { fill: "flat", outline: "none" }, { fill: "hatch", crossBelow: 1, hatchSpacing: 3 }, { fill: "nested", nestedKind: "motifs" }, { fill: "nested", nestedKind: "contours", contourMaterial: "stitch" },
    { fill: "nested", nestedKind: "mixed", contourMaterial: "beads", contourLevels: 10 }, { fill: "none", outline: "ink" }, { fill: "none", outline: "stitch", outlineSpacing: 3 }, { fill: "flat", outline: "beads", outlineSpacing: 4, gutter: 2 },
  ];
  for (const params of configs) {
    const recipe = recipeOf({ bands: 5, minArea: .3, ...params }), { map, kept } = keptOf(recipe), run = createCompositionRun({ maxWork: 1_000_000 });
    const estimate = boundValueRegionWork(map, drawnValueRegions(kept, recipe.select.gutter), kept, recipe.fill, recipe.outline);
    drawValueRegions(recorder().surface, recipe, {}, run);
    assert.ok(run.workUsed <= estimate, `${JSON.stringify(params)}: used ${run.workUsed} of counted ${estimate}`);
    assert.ok(run.workUsed > 20);
  }
  const busy = recipeOf({ image: "noise", resolution: 192, bands: 8, minArea: .005, smoothing: 2, fill: "nested", nestedKind: "contours", contourMaterial: "stitch", nestedWeight: 0.3, contourLevels: 12, outline: "none" });
  assert.throws(() => drawValueRegions(recorder().surface, busy), /would draw about \d+ marks; the limit is 80000: raise contourLevels or minArea/);
  const beads = recipeOf({ fill: "none", outline: "beads", outlineSpacing: .5, image: "noise", resolution: 192, bands: 8, minArea: .005, smoothing: 2 }), b = keptOf(beads);
  assert.throws(() => boundValueRegionWork(b.map, drawnValueRegions(b.kept, 0), b.kept, beads.fill, beads.outline), /raise outlineSpacing/);
  assert.throws(() => drawValueRegions(recorder().surface, { ...recipeOf(), fill: { ...recipeOf().fill, hatch: { ...recipeOf().fill.hatch, spacing: 0.5 } } }), /hatch spacing must be a number/);
  assert.equal(await prepareInstrument(instrument(), () => true), false);
  assert.equal(await prepareInstrument(instrument({ bands: 6 }), () => false), true);
  assert.ok(definitions.some((d) => d.id === "connected-value-regions"));
});

test("very jagged pinched regions can still be inset for nested marks and gutters (the exact offset is retried, never surfaced as a kernel error)", () => {
  const configs = [
    { image: "noise", measure: "luma", bandMode: "balanced", corners: true, merge: "nearest-value", fill: "nested", nestedKind: "mixed", mark: "arrow", contourMaterial: "beads" },
    { image: "noise", measure: "luma", bandMode: "equal", corners: true, keepBy: "enclosed", fill: "nested", nestedKind: "motifs", mark: "dot" },
    { image: "noise", corners: true, minArea: .1, fill: "flat", gutter: 3.5, simplify: 1 },
  ];
  for (const params of configs) {
    const rec = recorder();
    drawInstrument(rec.surface, instrument(params));
    assert.ok(rec.calls.length > 50, JSON.stringify(params));
  }
});
