import assert from "node:assert/strict";
import test from "node:test";
import {
  FOLD_LIMITS, bundledRaster, canPrepareInstrument, createInstrument, createRaster, definition, foldFragmentKeys, foldGrid, drawFoldAtlasImage, drawInstrument, foldAtlasImageComposition, foldColors,
  foldDensity, foldDensityProducts, foldFragmentProducts, foldMapped, foldPreimages, foldSamples, foldSeedCount, invertMap, latticeStarts, mapNames, mergeRuns,
  prepareInstrument, tonemapDensity, usesSeed, validateInstrument, visibleParameters, warpPoint,
  type FoldAtlasImageComposition, type FoldRect, type InstrumentInput, type MapName, type Raster, type WarpOptions,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.js";

const ID = "fold-atlas-image";
const near = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const nearAll = (actual: number[], expected: number[], tolerance = 1e-9) => actual.forEach((v, i) => near(v, expected[i], tolerance));
const stage = (map: MapName, amount = 1, frequency = 1) => ({ map, amount, frequency });
const warp = (stages: WarpOptions["stages"], over: Partial<WarpOptions> = {}): WarpOptions => ({ centerX: 300, centerY: 300, radius: 100, stages, iterations: 1, bound: 8, ...over });
const stream = (seed: number) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x1_0000_0000;
const rgb = (width: number, height: number, color: (x: number, y: number) => [number, number, number]): Raster => {
  const data: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.push(...color(x, y));
  return createRaster({ width, height, channels: 3, format: "u8", colorSpace: "srgb", alpha: "none", data });
};
const RED: [number, number, number] = [255, 0, 0], BLUE: [number, number, number] = [0, 0, 255];
const nullSurface = () => new Proxy({ CLOSE: "close", ROUND: "round" } as Record<string, unknown>, { get: (t, k: string) => (k in t ? t[k] : () => {}) });
/** A recording surface: counts calls by name and keeps rect calls. */
const recorder = () => {
  const calls: Record<string, number> = {}, rects: number[][] = [];
  const surface = new Proxy({ CLOSE: "close", ROUND: "round" } as Record<string, unknown>, {
    get: (t, k: string) => (k in t ? t[k] : (...args: number[]) => { calls[k] = (calls[k] ?? 0) + 1; if (k === "rect") rects.push(args); }),
  });
  return { surface, calls, rects };
};
/** The library's default recipe with fields replaced. */
const recipeOf = (over: Partial<FoldAtlasImageComposition>, params: Record<string, string | number | boolean> = {}): FoldAtlasImageComposition => {
  const input = createInstrument(ID);
  Object.assign(input.params, params);
  return { ...foldAtlasImageComposition(input), ...over };
};
const withParams = (params: Record<string, string | number | boolean>, seed = 42): InstrumentInput => {
  const input = createInstrument(ID);
  input.seed = seed;
  Object.assign(input.params, params);
  return input;
};

// --- identity --------------------------------------------------------------------------------------------------

test("amount 0 is the identity: every cell reads its own pixel, and one grid sample fills each cell", () => {
  const random = stream(7);
  const pixels = Array.from({ length: 64 }, () => [Math.floor(random() * 256), Math.floor(random() * 256), Math.floor(random() * 256)] as [number, number, number]);
  const raster = rgb(8, 8, (x, y) => pixels[y * 8 + x]);
  const source: FoldRect = { x: 100, y: 100, width: 80, height: 80 };
  const map = warp([stage("sinusoidal", 0), stage("swirl", 0), stage("waves", 0)], { centerX: 140, centerY: 140, radius: 60 });
  for (const search of ["nearest", "sheets"] as const) {
    const pre = foldPreimages(map, source, source, 10, { search, seeds: 2, sheet: "front" });
    assert.deepEqual(pre.counts, { ok: 64, unconverged: 0, outside: 0, mirrored: 0, folded: 0 });
    const sx = pre.sourceX.toArray(), sy = pre.sourceY.toArray();
    for (let k = 0; k < 64; k++) { near(sx[k], 100 + (k % 8 + .5) * 10, 1e-9); near(sy[k], 100 + (Math.floor(k / 8) + .5) * 10, 1e-9); }
    for (const [filter, area] of [["nearest", false], ["bilinear", false], ["bicubic", false], ["nearest", true], ["bilinear", true], ["bicubic", true]] as const) {
      const colors = foldColors(pre, raster, source, filter, area), r = colors.red.toArray(), g = colors.green.toArray(), b = colors.blue.toArray();
      for (let k = 0; k < 64; k++) { near(r[k], pixels[k][0] / 255, 1e-9); near(g[k], pixels[k][1] / 255, 1e-9); near(b[k], pixels[k][2] / 255, 1e-9); }
    }
  }
  const samples = foldSamples(raster, source, { kind: "grid", seed: 1, count: 64, jitter: 0 });
  assert.equal(samples.count, 64);
  const density = foldDensity(foldMapped(samples, map), source, 10);
  assert.deepEqual(density.count.toArray(), new Float64Array(64).fill(1));
  assert.deepEqual([density.total, density.excluded, density.outside, density.holes, density.max], [64, 0, 0, 0, 1]);
  near(density.reference, 1);
});

// --- forward mapping -------------------------------------------------------------------------------------------

test("mapped samples are the documented map values", () => {
  const raster = rgb(2, 2, () => RED), source: FoldRect = { x: 240, y: 240, width: 120, height: 120 };
  const samples = foldSamples(raster, source, { kind: "grid", seed: 3, count: 100, jitter: 0 });
  const mapped = foldMapped(samples, warp([stage("sinusoidal", 1, 1.5)])), mx = mapped.x.toArray(), my = mapped.y.toArray();
  for (let i = 0; i < 100; i++) {
    const u = (240 + (i % 10 + .5) * 12 - 300) / 100, v = (240 + (Math.floor(i / 10) + .5) * 12 - 300) / 100;
    near(mx[i], 300 + 100 * Math.sin(1.5 * u)); near(my[i], 300 + 100 * Math.sin(1.5 * v));
  }
});

test("density conserves mass: total + excluded + outside = samples, holes stay 0, and every count equals an independent binning", () => {
  const raster = rgb(2, 2, () => RED), source: FoldRect = { x: 210, y: 210, width: 180, height: 180 };
  const samples = foldSamples(raster, source, { kind: "grid", seed: 5, count: 4000, jitter: 1 });
  const map = warp([stage("spherical", 1, 1)], { bound: 3 }), frame: FoldRect = { x: 100, y: 100, width: 400, height: 400 };
  const density = foldDensity(foldMapped(samples, map), frame, 20);
  const sx = samples.x.toArray(), sy = samples.y.toArray(), expected = new Float64Array(400);
  let excluded = 0, outside = 0;
  for (let i = 0; i < samples.count; i++) {
    const u = (sx[i] - 300) / 100, v = (sy[i] - 300) / 100, r2 = u * u + v * v;
    if (r2 === 0 || 1 / Math.sqrt(r2) > 3) { excluded++; continue; }       // inversion: |F| = 1/r; excluded past the bound
    const x = 300 + 100 * u / r2, y = 300 + 100 * v / r2, c = Math.floor((x - 100) / 20), r = Math.floor((y - 100) / 20);
    if (c < 0 || c > 19 || r < 0 || r > 19) outside++; else expected[r * 20 + c]++;
  }
  assert.ok(excluded > 100 && outside > 100, "the map excludes some samples and throws some past the frame");
  assert.equal(density.excluded, excluded); assert.equal(density.outside, outside);
  assert.equal(density.total + density.excluded + density.outside, samples.count);
  assert.deepEqual(density.count.toArray(), expected);
  assert.equal(density.holes, expected.filter((c) => c === 0).length);
  assert.ok(density.holes > 0, "inversion leaves cells no sample reaches, and they stay zero");
});

test("a fold adds the two sheets in density and shows one of them in inverse sampling, chosen by the sheet rule", () => {
  // sin(3u) folds at u = pi/6: the source strip u in [-1, 1] covers each output x twice. Red left of u = 0.5, blue right.
  const raster = rgb(32, 32, (x) => (x < 24 ? RED : BLUE)), source: FoldRect = { x: 200, y: 200, width: 200, height: 200 };
  const map = warp([stage("sinusoidal", 1, 3)]);
  const column = 35, sOut = ((200 + 5 * (column + .5)) - 300) / 100;          // output cell centre at s = 0.775
  const u1 = Math.asin(sOut) / 3, u2 = (Math.PI - Math.asin(sOut)) / 3;       // the two source points that land there
  assert.ok(u1 < .5 && u2 >= .5 && u2 < 1);
  const at = (rules: { search: "nearest" | "sheets"; seeds: number; sheet: "front" | "back" }) => {
    const pre = foldPreimages(map, source, source, 5, rules), k = 19 * 40 + column, colors = foldColors(pre, raster, source, "nearest", true);
    return { x: pre.sourceX.get(k), det: pre.determinant.get(k), status: pre.status.get(k), rgb: [colors.red.get(k), colors.green.get(k), colors.blue.get(k)], counts: pre.counts };
  };
  const front = at({ search: "sheets", seeds: 3, sheet: "front" }), back = at({ search: "sheets", seeds: 3, sheet: "back" }), nearest = at({ search: "nearest", seeds: 1, sheet: "front" });
  assert.equal(front.status, 0);
  near(front.x, 300 + 100 * u1, 1e-3); assert.ok(front.det > 0); nearAll(front.rgb, [1, 0, 0]);
  near(back.x, 300 + 100 * u2, 1e-3); assert.ok(back.det < 0); nearAll(back.rgb, [0, 0, 1]);
  near(nearest.x, 300 + 100 * u2, 1e-3);                                    // Newton from the cell itself lands on the closer sheet
  assert.ok(front.counts.folded > 100 && front.counts.mirrored < back.counts.mirrored);
  // The point solver reports both sheets and their orientations.
  const both = invertMap(map, source, 300 + 100 * sOut, 302.5, { sheet: "front", starts: latticeStarts(source, 3) });
  assert.equal(both.candidates, 2); assert.equal(both.status, "ok");
  // Forward: the density of that cell is the SUM over both source regions, counted here from the samples' own positions.
  const samples = foldSamples(raster, source, { kind: "grid", seed: 1, count: 160000, jitter: 0 });
  assert.equal(samples.count, 160000);
  const density = foldDensity(foldMapped(samples, map), source, 5), sx = samples.x.toArray(), sy = samples.y.toArray();
  let redMass = 0, blueMass = 0;
  const expected = new Float64Array(1600);
  for (let i = 0; i < samples.count; i++) {
    const u = (sx[i] - 300) / 100, v = (sy[i] - 300) / 100;
    const c = Math.floor((100 * Math.sin(3 * u) + 100) / 5), r = Math.floor((100 * Math.sin(3 * v) + 100) / 5);
    if (c < 0 || c > 39 || r < 0 || r > 39) continue;
    expected[r * 40 + c]++;
    if (c === column && r === 19) { if (u < .5) redMass++; else blueMass++; }
  }
  assert.deepEqual(density.count.toArray(), expected);
  assert.ok(redMass >= 10 && blueMass >= 10, `both sheets contribute (${redMass} red, ${blueMass} blue)`);
  assert.equal(density.count.get(19 * 40 + column), redMass + blueMass);
  const flat = foldDensity(foldMapped(samples, warp([stage("sinusoidal", 0)])), source, 5);
  assert.deepEqual(flat.count.toArray(), new Float64Array(1600).fill(100), "the same samples unfolded put 100 in every cell");
  // Per sheet the density is 100 x 1 / (3 |cos 3u|) x 1 / 3 (the x stretch, and the y stretch at v ~ 0): two sheets add.
  const perSheet = 100 / (3 * Math.sqrt(1 - sOut * sOut)) / 3;
  near(density.count.get(19 * 40 + column), 2 * perSheet, 6);
  assert.ok(density.count.get(19 * 40 + column) > 1.5 * Math.max(redMass, blueMass), "the cell holds the sum, not the larger sheet");
});

// --- inverse numerics ------------------------------------------------------------------------------------------

test("inverse sampling round-trips the invertible maps to within the solver tolerance", () => {
  const source: FoldRect = { x: 200, y: 200, width: 200, height: 200 };
  const cases: [string, WarpOptions][] = [
    ["fisheye", warp([stage("fisheye", 1, 1)])], ["swirl", warp([stage("swirl", .8, 1.5)])], ["waves", warp([stage("waves", 1, 2)])],
    ["spherical", warp([stage("spherical", 1, 1)], { bound: 6 })], ["swirl then fisheye", warp([stage("swirl", .5, 1), stage("fisheye", .9, 1)])],
  ];
  const random = stream(11);
  for (const [name, map] of cases) {
    let checked = 0;
    for (let i = 0; i < 150; i++) {
      const p: [number, number] = [200 + 200 * random(), 200 + 200 * random()];
      if (name === "spherical" && Math.hypot(p[0] - 300, p[1] - 300) < 40) continue;
      const q = warpPoint(map, p[0], p[1]);
      if (!q) continue;
      const back = invertMap(map, source, q[0], q[1], { sheet: "front", starts: latticeStarts(source, 3) });
      assert.equal(back.status, "ok", `${name} at ${p}`);
      near(back.x, p[0], 2e-3); near(back.y, p[1], 2e-3);
      const again = warpPoint(map, back.x, back.y)!;
      near(again[0], q[0], 1e-3); near(again[1], q[1], 1e-3);
      checked++;
    }
    assert.ok(checked > 100, `${name}: ${checked} points checked`);
  }
});

test("exact exclusion rule: a cell is drawn exactly when a start converges to a preimage inside the source, else excluded, never filled", () => {
  // Inversion about (300, 300): F(p) = p / |p|^2 in radii, bound 2 radii. Source: the square of half-width 0.8 radii.
  const map = warp([stage("spherical", 1, 1)], { bound: 2 });
  const source: FoldRect = { x: 220, y: 220, width: 160, height: 160 }, frame: FoldRect = { x: 100, y: 100, width: 400, height: 400 };
  const pre = foldPreimages(map, source, frame, 10, { search: "sheets", seeds: 3, sheet: "front" });
  let ok = 0, outside = 0, unreachable = 0, checked = 0;
  for (let j = 0; j < 40; j++) for (let i = 0; i < 40; i++) {
    const a = (100 + (i + .5) * 10 - 300) / 100, b = (100 + (j + .5) * 10 - 300) / 100, rho = Math.hypot(a, b), k = j * 40 + i;
    const ux = a / (rho * rho), uy = b / (rho * rho), reach = Math.max(Math.abs(ux), Math.abs(uy));
    if (Math.abs(rho - 2) < .02 || Math.abs(reach - .8) < .02) continue;            // skip cells on a rule's boundary
    checked++;
    const status = pre.status.get(k);
    if (rho > 2) { assert.equal(status, 1, `cell ${i},${j}: no point maps beyond the bound`); unreachable++; }
    else if (reach > .8) { assert.ok(status === 1 || status === 2, `cell ${i},${j}: the preimage is outside the source`); assert.ok(Number.isNaN(pre.sourceX.get(k))); outside++; }
    else { assert.equal(status, 0, `cell ${i},${j}`); near(pre.sourceX.get(k), 300 + 100 * ux, 1e-3); near(pre.sourceY.get(k), 300 + 100 * uy, 1e-3); ok++; }
  }
  assert.ok(ok > 100 && outside > 50 && unreachable > 100 && checked > 1400, `${ok} drawn, ${outside} outside, ${unreachable} unreachable`);
  const raster = rgb(4, 4, () => RED), colors = foldColors(pre, raster, source, "bilinear", true);
  for (let k = 0; k < 1600; k++) if (pre.status.get(k) !== 0) assert.ok(Number.isNaN(colors.red.get(k)), "excluded cells carry no color");
  // The drawing covers exactly the drawn cells: merged rectangles tile them and nothing else.
  const { surface, rects } = recorder();
  drawFoldAtlasImage(surface as never, recipeOf({ map, source, frame, cell: 10, image: { kind: "raster", raster } }, { mode: "fragments" }));
  const area = rects.reduce((sum, [, , w, h]) => sum + w * h, 0);
  near(area, pre.counts.ok * 100, 1e-6);
});

// --- tone, exposure, caching -----------------------------------------------------------------------------------

test("area averaging: cells the map shrinks read the mean of what they cover, point sampling aliases, and unshrunk cells read the raster exactly", () => {
  // A one-pixel checkerboard seen through a map that shrinks it: fisheye at frequency 6 has |det| below 0.15 past two thirds of the radius.
  const board = rgb(64, 64, (x, y) => ((x + y) % 2 === 0 ? [0, 0, 0] : [255, 255, 255])), source: FoldRect = { x: 200, y: 200, width: 200, height: 200 };
  const map = warp([stage("fisheye", 1, 6)]), pre = foldPreimages(map, source, source, 4, { search: "sheets", seeds: 3, sheet: "front" });
  const point = foldColors(pre, board, source, "nearest", false), mean = foldColors(pre, board, source, "bilinear", true);
  const linearHalf = 188 / 255;                                                // the byte the box mean of black and white rounds to
  let shrunk = 0, aliased = 0, averaged = 0;
  for (let k = 0; k < 2500; k++) {
    if (pre.status.get(k) !== 0) continue;
    const footprint = 16 / (Math.abs(pre.determinant.get(k)) * 9.765625);         // pixels^2 under the cell (64 px over 200 units: 9.77 units^2 per pixel)
    if (footprint < 16) continue;                                                // at least four pixels across: mip level 2 or more
    shrunk++;
    if (Math.abs(point.red.get(k) - .5) > .3) aliased++;
    if (Math.abs(mean.red.get(k) - linearHalf) < .03) averaged++;
  }
  assert.ok(shrunk > 30, `${shrunk} shrunken cells`);
  assert.equal(aliased, shrunk, "one-pixel point sampling of a checkerboard is always black or white");
  assert.ok(averaged > .85 * shrunk, `area averaging reads the mean in ${averaged} of ${shrunk}`);
});

test("mirrored cells are darkened by the shade and unmirrored cells are not", () => {
  const base = recipeOf({}, { mode: "fragments", cell: 8, stage1Map: "sinusoidal", stage1Amount: 1, stage1Frequency: 3, stage2Amount: 0, backShade: 0, color: "image", levels: 16 });
  const products = foldFragmentProducts(base);
  const plain = foldFragmentKeys(base, products), shaded = foldFragmentKeys({ ...base, fragments: { ...base.fragments, backShade: .5 } }, products);
  let mirrored = 0, front = 0;
  for (let k = 0; k < plain.length; k++) {
    if (plain[k] < 0) { assert.equal(shaded[k], -1); continue; }
    if (products.preimages.determinant.get(k) < 0) {
      mirrored++;
      for (const shift of [16, 8, 0]) near((shaded[k] >> shift) & 255, Math.round(((plain[k] >> shift) & 255) * .5), 1);
    } else { front++; assert.equal(shaded[k], plain[k]); }
  }
  assert.ok(mirrored > 20 && front > 20, `${mirrored} mirrored, ${front} unmirrored`);
});

test("exposure and tone response only read the finished counts: mapped samples and density stay the same objects", () => {
  const base = recipeOf({}, { mode: "density", count: 20000 });
  const a = foldDensityProducts(base);
  const dim = foldDensityProducts({ ...base, density: { ...base.density, exposure: .3 } }), bright = foldDensityProducts({ ...base, density: { ...base.density, exposure: 4, tonemap: "log" } });
  for (const other of [dim, bright]) {
    assert.equal(other.samples, a.samples); assert.equal(other.mapped, a.mapped); assert.equal(other.density, a.density);
  }
  const before = a.mapped.x.toArray();
  foldDensityProducts({ ...base, density: { ...base.density, exposure: 7 } });
  assert.deepEqual(a.mapped.x.toArray(), before);
  // The tone is 1 - exp(-exposure * count / reference) for film, and exactly 0 in a hole.
  const counts = a.density.count.toArray(), tone = a.tone.toArray(), toneDim = dim.tone.toArray();
  let holes = 0;
  for (let k = 0; k < counts.length; k++) {
    if (counts[k] === 0) { holes++; assert.equal(tone[k], 0); assert.equal(toneDim[k], 0); continue; }
    near(tone[k], 1 - Math.exp(-counts[k] / a.density.reference), 1e-12); near(toneDim[k], 1 - Math.exp(-.3 * counts[k] / a.density.reference), 1e-12);
  }
  assert.ok(holes > 0 && holes === a.density.holes);
  const linear = tonemapDensity(a.density, 1, "linear").toArray(), log = tonemapDensity(a.density, 1, "log").toArray();
  for (let k = 0; k < counts.length; k++) {
    if (counts[k] === 0) continue;
    const x = counts[k] / a.density.reference;
    near(linear[k], Math.min(1, x / 4), 1e-12); near(log[k], Math.min(1, Math.log(1 + x) / Math.log(9)), 1e-12);
  }
});

test("stages are cached by identity: palette, levels, shade, color, exposure and display edits reuse the products; a stage's own inputs replace them", () => {
  const base = recipeOf({}, { mode: "fragments", cell: 8 });
  const a = foldFragmentProducts(base);
  for (const edit of [
    { palette: [0x102030, 0x405060] }, { fragments: { ...base.fragments, levels: 3, backShade: .6, color: "palette" as const } },
    { density: { ...base.density, exposure: 3, display: "dots" as const } }, { mode: "density" as const },
  ]) {
    const b = foldFragmentProducts({ ...base, ...edit });
    assert.equal(b.preimages, a.preimages); assert.equal(b.colors, a.colors);
  }
  const filtered = foldFragmentProducts({ ...base, fragments: { ...base.fragments, filter: "nearest" } });
  assert.equal(filtered.preimages, a.preimages); assert.notEqual(filtered.colors, a.colors);
  const unaveraged = foldFragmentProducts({ ...base, fragments: { ...base.fragments, area: !base.fragments.area } });
  assert.equal(unaveraged.preimages, a.preimages); assert.notEqual(unaveraged.colors, a.colors);
  const moved = foldFragmentProducts({ ...base, map: { ...base.map, radius: base.map.radius + 1 } });
  assert.notEqual(moved.preimages, a.preimages);
  // With nearest search the sheet and seed controls are irrelevant, so they do not even change the key.
  const n1 = foldFragmentProducts({ ...base, fragments: { ...base.fragments, search: "nearest", sheet: "front", seeds: 1 } });
  const n2 = foldFragmentProducts({ ...base, fragments: { ...base.fragments, search: "nearest", sheet: "back", seeds: 3 } });
  assert.equal(n1.preimages, n2.preimages);

  const d = recipeOf({}, { mode: "density", count: 8000 }), first = foldDensityProducts(d);
  for (const edit of [{ palette: [1, 2, 3] }, { density: { ...d.density, exposure: 2, tonemap: "linear" as const, display: "dots" as const, bands: 3, dotMax: 1.2, color: "palette" as const } },
    { fragments: { ...d.fragments, levels: 9 } }]) {
    const other = foldDensityProducts({ ...d, ...edit });
    assert.equal(other.samples, first.samples); assert.equal(other.mapped, first.mapped); assert.equal(other.density, first.density);
  }
  const bigger = foldDensityProducts({ ...d, cell: d.cell + 2 });
  assert.equal(bigger.samples, first.samples); assert.equal(bigger.mapped, first.mapped); assert.notEqual(bigger.density, first.density);
  const swirled = foldDensityProducts({ ...d, map: { ...d.map, radius: d.map.radius + 2 } });
  assert.equal(swirled.samples, first.samples); assert.notEqual(swirled.mapped, first.mapped);
  const more = foldDensityProducts({ ...d, density: { ...d.density, count: 9000 } });
  assert.notEqual(more.samples, first.samples);
});

test("tone sampling is prefix-stable, follows the image's tone and depends on the seed", () => {
  const raster = rgb(16, 16, (x) => (x < 8 ? [0, 0, 0] : [255, 255, 255])), source: FoldRect = { x: 0, y: 0, width: 160, height: 160 };
  const small = foldSamples(raster, source, { kind: "tone", seed: 9, count: 500, weight: "dark", curve: 1 });
  const large = foldSamples(raster, source, { kind: "tone", seed: 9, count: 3000, weight: "dark", curve: 1 });
  assert.deepEqual(small.x.toArray(), large.x.toArray().slice(0, 500));
  assert.deepEqual(small.y.toArray(), large.y.toArray().slice(0, 500));
  for (const x of large.x.toArray()) assert.ok(x >= 0 && x < 80, "dark weight puts every point in the black half");
  const light = foldSamples(raster, source, { kind: "tone", seed: 9, count: 500, weight: "light", curve: 1 });
  for (const x of light.x.toArray()) assert.ok(x >= 80 && x < 160);
  const other = foldSamples(raster, source, { kind: "tone", seed: 10, count: 500, weight: "dark", curve: 1 });
  assert.notDeepEqual(other.x.toArray(), small.x.toArray());
  // Spread inside the black half is uniform to within sampling noise.
  const left = large.x.toArray().filter((x) => x < 40).length;
  assert.ok(Math.abs(left / 3000 - .5) < .05, `${left} of 3000 in the left quarter of the picture`);
  const white = rgb(4, 4, () => [255, 255, 255]);
  assert.throws(() => foldSamples(white, source, { kind: "tone", seed: 1, count: 10, weight: "dark", curve: 1 }), /no dark tone/);
});

// --- merged runs -----------------------------------------------------------------------------------------------

test("merged runs tile exactly the non-empty cells, one uniform rectangle each, and merge vertically", () => {
  assert.deepEqual(mergeRuns(3, 3, new Array(9).fill(5)).map((r) => [r.column, r.row, r.columns, r.rows, r.key]), [[0, 0, 3, 3, 5]]);
  const l = mergeRuns(3, 3, [1, -1, -1, 1, -1, -1, 1, 1, 1]).map((r) => [r.column, r.row, r.columns, r.rows]);
  assert.deepEqual(l, [[0, 0, 1, 2], [0, 2, 3, 1]]);
  const random = stream(21);
  for (let trial = 0; trial < 40; trial++) {
    const columns = 1 + Math.floor(random() * 9), rows = 1 + Math.floor(random() * 9);
    const keys = Array.from({ length: columns * rows }, () => (random() < .25 ? -1 : Math.floor(random() * 3)));
    const rebuilt = new Array<number>(keys.length).fill(-2);
    for (const run of mergeRuns(columns, rows, keys))
      for (let r = run.row; r < run.row + run.rows; r++) for (let c = run.column; c < run.column + run.columns; c++) {
        assert.equal(rebuilt[r * columns + c], -2, "cells belong to one rectangle"); rebuilt[r * columns + c] = run.key;
      }
    assert.deepEqual(rebuilt.map((k) => (k === -2 ? -1 : k)), keys);
    assert.ok(!rebuilt.some((k, i) => k === -2 && keys[i] >= 0));
  }
});

// --- the instrument --------------------------------------------------------------------------------------------

test("the instrument draws a transparent layer: fragments and density both paint, nothing clears, and an all-excluded map paints nothing", () => {
  for (const mode of ["fragments", "density"]) {
    const { surface, calls } = recorder();
    drawInstrument(surface as never, withParams({ mode }));
    assert.ok((calls.rect ?? 0) > 50, `${mode} rects`);
    assert.equal(calls.background, undefined); assert.equal(calls.clear, undefined);
    assert.equal(calls.push, calls.pop);
  }
  for (const display of ["bands", "dots"]) {
    const { surface, calls } = recorder();
    drawInstrument(surface as never, withParams({ mode: "density", display }));
    assert.ok((calls[display === "bands" ? "rect" : "circle"] ?? 0) > 50);
  }
  // Inversion with the smallest frequency sends every source point beyond the bound (20 / rho > 8 for rho < 2.5): nothing survives.
  for (const params of [{ mode: "density", count: 2000 }, { mode: "fragments" }]) {
    const { surface, calls } = recorder();
    drawInstrument(surface as never, withParams({ ...params, stage1Map: "spherical", stage1Amount: 1, stage1Frequency: .05, stage2Amount: 0, stage3Amount: 0 }));
    assert.equal((calls.rect ?? 0) + (calls.circle ?? 0), 0, JSON.stringify(params));
  }
});

test("hidden controls never change the drawing, and the seed matters only where chance belongs", () => {
  const changes = (params: Record<string, string | number | boolean>, other: Record<string, string | number | boolean>) =>
    drawFingerprint(withParams(params)) !== drawFingerprint(withParams({ ...params, ...other }));
  // Fragments mode ignores every density control.
  for (const other of [{ count: 20000 }, { exposure: 3 }, { tonemap: "log" }, { display: "dots" }, { sampling: "grid" }, { densityColor: "palette" }, { weight: "light" }])
    assert.equal(changes({ mode: "fragments" }, other), false, JSON.stringify(other));
  // Density mode ignores every fragment control.
  for (const other of [{ filter: "nearest" }, { areaAverage: false }, { levels: 3 }, { backShade: .7 }, { search: "nearest" }, { sheet: "back" }, { color: "palette" }, { seeds: 1 }])
    assert.equal(changes({ mode: "density", count: 12000 }, other), false, JSON.stringify(other));
  // The nearest search has no sheet or seed choices.
  assert.equal(changes({ mode: "fragments", search: "nearest" }, { sheet: "back" }), false);
  assert.equal(changes({ mode: "fragments", search: "nearest" }, { seeds: 1 }), false);
  assert.equal(changes({ mode: "fragments", search: "sheets" }, { sheet: "back" }), true);
  // Tone and grid sampling each hide the other's controls.
  assert.equal(changes({ mode: "density", count: 12000, sampling: "tone" }, { jitter: .2 }), false);
  assert.equal(changes({ mode: "density", count: 12000, sampling: "grid" }, { weight: "light" }), false);
  assert.equal(changes({ mode: "density", count: 12000, sampling: "grid" }, { curve: 2 }), false);
  assert.equal(changes({ mode: "density", count: 12000, display: "bands" }, { dotMax: 1.3 }), false);
  assert.equal(changes({ mode: "density", count: 12000, display: "dots" }, { bands: 3 }), false);
  // Visible controls do change it.
  assert.equal(changes({ mode: "density", count: 12000 }, { exposure: 3 }), true);
  assert.equal(changes({ mode: "fragments" }, { levels: 3 }), true);
  assert.equal(changes({ mode: "fragments", stage1Map: "fisheye", stage1Frequency: 6, stage1Amount: 1, stage2Amount: 0 }, { areaAverage: false }), true);
  // Seed: only density sampling with chance (tone, or grid with jitter) uses it, and the drawing agrees.
  const seeded = (params: Record<string, string | number | boolean>) => {
    const a = withParams(params, 1), b = withParams(params, 2);
    return { flag: usesSeed(a), differs: drawFingerprint(a) !== drawFingerprint(b) };
  };
  assert.deepEqual(seeded({ mode: "fragments" }), { flag: false, differs: false });
  assert.deepEqual(seeded({ mode: "density", count: 12000, sampling: "tone" }), { flag: true, differs: true });
  assert.deepEqual(seeded({ mode: "density", count: 12000, sampling: "grid", jitter: .5 }), { flag: true, differs: true });
  assert.deepEqual(seeded({ mode: "density", count: 12000, sampling: "grid", jitter: 0 }), { flag: false, differs: false });
  // The inspector shows the fragment controls in fragments mode and hides the density ones.
  const shown = (params: Record<string, string | number | boolean>) => new Set(visibleParameters(ID, { ...createInstrument(ID).params, ...params }).map((p) => p.key));
  assert.ok(shown({ mode: "fragments" }).has("levels") && !shown({ mode: "fragments" }).has("exposure") && !shown({ mode: "density" }).has("levels"));
  assert.ok(!shown({ search: "nearest" }).has("sheet") && shown({ search: "sheets" }).has("sheet") && !shown({ mode: "density", sampling: "grid" }).has("weight"));
});

test("bounds fail naming the control to change, and unsupported images are refused", () => {
  const big = withParams({ frameWidth: 640, frameHeight: 640, cell: 1 });
  assert.throws(() => validateInstrument(big), /needs 409600 cells; the limit is 40000\. Raise Cell size/);
  const seeds = withParams({ width: 2000, height: 2000, cell: 4, seeds: 4, search: "sheets", frameWidth: 640, frameHeight: 640 });
  assert.throws(() => validateInstrument(seeds), /seed points; the limit is 300000\. .*Search detail/);
  assert.equal(foldSeedCount({ x: 0, y: 0, width: 600, height: 600 }, 4, { search: "sheets", seeds: 3, sheet: "front" }), 450 * 450);
  assert.equal(foldSeedCount({ x: 0, y: 0, width: 600, height: 600 }, 4, { search: "nearest", seeds: 3, sheet: "front" }), 0);
  const withAlpha = createRaster({ width: 1, height: 1, channels: 4, format: "u8", colorSpace: "srgb", alpha: "straight", data: [1, 2, 3, 255] });
  const pre = foldPreimages(warp([stage("sinusoidal", 0)]), { x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 10, height: 10 }, 5, { search: "nearest", seeds: 1, sheet: "front" });
  assert.throws(() => foldColors(pre, withAlpha, { x: 0, y: 0, width: 10, height: 10 }, "nearest", true), /alpha channel/);
  assert.throws(() => validateInstrument({ ...createInstrument(ID), params: { ...createInstrument(ID).params, image: "nope" } }));
});

test("the instrument is registered, preparable, and prepares the same products it draws", async () => {
  assert.equal(definition(ID).title, "Fold Atlas Image");
  assert.equal(canPrepareInstrument(ID), true);
  for (const mode of ["fragments", "density"]) {
    const input = withParams({ mode, cell: 7, count: 9000 });
    assert.equal(await prepareInstrument(input, () => false), true);
    assert.equal(await prepareInstrument(input, () => true), false);
  }
  const fresh = withParams({ mode: "fragments", cell: 9.5, seeds: 2 });
  assert.equal(await prepareInstrument(fresh, () => false), true);
  const recipe = foldAtlasImageComposition(fresh), products = foldFragmentProducts(recipe);
  assert.equal(foldFragmentProducts(recipe).preimages, products.preimages, "preparation filled the cache the draw reads");
  assert.ok(mapNames.length === 8);
});

test("every slider corner is admitted and draws: each numeric control alone at its ends, all minimums, all maximums, and the costliest corners stay inside the declared work limits", async () => {
  const item = definition(ID), numbers = item.parameters.filter((p) => p.type === "number");
  const cornerOf = (edge: "min" | "max" | "default", over: Record<string, string | number | boolean> = {}): InstrumentInput => {
    const input = createInstrument(ID);
    if (edge !== "default") for (const p of numbers) input.params[p.key] = edge === "min" ? p.min! : p.max!;
    Object.assign(input.params, over);
    return input;
  };
  const admit = (label: string, input: InstrumentInput) => {
    assert.doesNotThrow(() => validateInstrument(input), label);
    assert.doesNotThrow(() => drawInstrument(nullSurface() as never, input), label);
  };
  for (const mode of ["fragments", "density"]) {
    admit(`${mode} all minimums`, cornerOf("min", { mode })); admit(`${mode} all maximums`, cornerOf("max", { mode }));
    for (const p of numbers) for (const end of [p.min!, p.max!]) {
      admit(`${mode} ${p.key}=${end}`, cornerOf("default", { mode, [p.key]: end }));
      admit(`${mode} max with ${p.key}=${end}`, cornerOf("max", { mode, [p.key]: end }));
      admit(`${mode} min with ${p.key}=${end}`, cornerOf("min", { mode, [p.key]: end }));
    }
    for (const search of ["nearest", "sheets"]) for (const display of ["bands", "dots"]) admit(`${mode} ${search} ${display} maximums`, cornerOf("max", { mode, search, display }));
  }
  // The costliest corners prepare (validation, cold stage caches) inside the declared work: counts, never clocks.
  const heavy: [string, InstrumentInput][] = [
    ["fragments all maximums", cornerOf("max", { mode: "fragments" })],
    ["density all maximums", cornerOf("max", { mode: "density" })],
    ["fragments finest cells, widest image, most seeds", cornerOf("max", { mode: "fragments", search: "sheets", cell: 4, seeds: 3 })],
    ["fragments finest cells, four-fold chain", cornerOf("max", { mode: "fragments", cell: 4, seeds: 3, stage1Map: "handkerchief", stage2Map: "swirl", stage3Map: "waves", iterations: 4 })],
    ["density most samples, finest cells, four-fold chain", cornerOf("max", { mode: "density", cell: 4, iterations: 4, stage1Map: "handkerchief", stage3Map: "waves" })],
  ];
  for (const [label, input] of heavy) {
    validateInstrument(input);
    assert.equal(await prepareInstrument(input, () => false), true, label);
    const recipe = foldAtlasImageComposition(input), grid = foldGrid(recipe.frame, recipe.cell);
    assert.ok(grid.columns * grid.rows <= FOLD_LIMITS.cells, label);
    if (recipe.mode === "fragments") {
      const f = recipe.fragments, seeds = foldSeedCount(recipe.source, recipe.cell, { search: f.search, seeds: f.seeds, sheet: f.sheet });
      assert.ok(seeds <= FOLD_LIMITS.seeds, `${label}: ${seeds} seed points`);
    } else assert.ok(foldDensityProducts(recipe).samples.count <= FOLD_LIMITS.samples, label);
  }
  // Every numeric control's hard limits still admit exact entry through validateInstrument (values outside are refused).
  for (const p of numbers) {
    assert.throws(() => validateInstrument({ ...createInstrument(ID), params: { ...createInstrument(ID).params, [p.key]: p.hardMax! + 1 } }), undefined, `${p.key} above its hard limit`);
    assert.throws(() => validateInstrument({ ...createInstrument(ID), params: { ...createInstrument(ID).params, [p.key]: p.hardMin! - 1 } }), undefined, `${p.key} below its hard limit`);
  }
});

test("the bundled sample images all fold, in both modes, with every map", () => {
  for (const id of ["portrait", "geometry", "landscape", "noise"]) {
    assert.equal(bundledRaster(id as never, 3, 64).channels, 3);
    for (const mode of ["fragments", "density"]) for (const map of mapNames) {
      const input = withParams({ image: id, mode, stage1Map: map, stage1Amount: 1, count: 6000, cell: 12 });
      assert.doesNotThrow(() => drawInstrument(nullSurface() as never, input), `${id} ${mode} ${map}`);
    }
  }
});
