import assert from "node:assert/strict";
import test from "node:test";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";
import {
  createCompositionRun, createInstrument, createRaster, dilateMask, drawInstrument, drawPixelSorting, definition, inspectorItems, movedPixels, pixelSortMask,
  pixelSortRunAt, pixelSortRunPaths, pixelSortRunTable, pixelSortStreakSites, pixelSortStreaks, pixelSortStructure, pixelSortingComposition,
  preparePixelSorting, prepareInstrument, rasterData, rasterMapping, runOutline, usesSeed, visibleParameters, createScalarGrid,
  type CompositionSurface, type DrawingContext, type InstrumentInput, type PixelSortConstruction, type PixelSortMask, type PixelSortRecipe, type PixelSortRuns, type Raster,
} from "../dist/index.js";

const gridToArray = (grid: { toArray(): ArrayLike<number> }): number[] => Array.from(grid.toArray());
const ID = "pixel-sorting";
type Params = Record<string, number | string | boolean>;
function input(params: Params = {}, seed = 42): InstrumentInput {
  const base = createInstrument(ID);
  return { ...base, seed, params: { ...base.params, ...params } };
}
const recipeOf = (params: Params = {}, seed = 42): PixelSortRecipe => pixelSortingComposition(input(params, seed));

function recorder(): { surface: CompositionSurface; ops: string[] } {
  const ops: string[] = [];
  const round = (value: unknown) => typeof value === "number" ? Math.round(value * 1e6) / 1e6 : value;
  const surface = new Proxy({ CLOSE: "close", ROUND: "round" } as Record<string, unknown>, {
    get(target, key: string) { return key in target ? target[key] : (...args: unknown[]) => { ops.push(JSON.stringify([key, ...args.map(round)])); }; },
  });
  return { surface: surface as unknown as CompositionSurface, ops };
}
const drawn = (recipe: PixelSortRecipe): string[] => { const { surface, ops } = recorder(); drawPixelSorting(surface, recipe); return ops; };
const drawnInput = (value: InstrumentInput): string[] => { const { surface, ops } = recorder(); drawInstrument(surface as unknown as DrawingContext, value); return ops; };

/** Gray 8-bit raster: luma of a neutral pixel is exactly value / 255. */
const gray = (width: number, height: number, values: number[]): Raster =>
  createRaster({ width, height, channels: 1, format: "u8", colorSpace: "srgb", alpha: "none", data: values });
const grayValues = (raster: Raster): number[] => Array.from(rasterData(raster).data as ArrayLike<number>);
const runs = (over: Partial<PixelSortRuns> = {}): PixelSortRuns => ({ direction: "right", select: { value: "luma", from: 0, to: 1 }, minRun: 1, maxRun: null, ragged: null, ...over });
function construct(raster: Raster, over: { runs?: Partial<PixelSortRuns>; sort?: Partial<PixelSortConstruction["sort"]>; mask?: PixelSortMask | null; maskRole?: "protect" | "select"; seed?: number } = {}): PixelSortConstruction {
  return { seed: over.seed ?? 1, image: { kind: "raster", raster }, runs: runs(over.runs), sort: { key: "luma", order: "ascending", ...over.sort }, mask: over.mask ?? null, maskRole: over.maskRole ?? "protect" };
}
const sortedGray = (raster: Raster, over: Parameters<typeof construct>[1] = {}) => grayValues(pixelSortStructure(construct(raster, over)).sorted);

// ------------------------------------------------------------------ exact sorting semantics

test("a row sorts ascending and descending exactly; the interval is inclusive and unselected pixels never move", () => {
  const row = gray(6, 1, [90, 10, 200, 30, 250, 60]);
  assert.deepEqual(sortedGray(row), [10, 30, 60, 90, 200, 250]);
  assert.deepEqual(sortedGray(row, { sort: { order: "descending" } }), [250, 200, 90, 60, 30, 10]);
  // [0, 100/255] selects 90, 10, 30 and 60; 200 and 250 split them into runs [90, 10], [30] and [60]
  const dark = { runs: { select: { value: "luma" as const, from: 0, to: 100 / 255 } } };
  assert.deepEqual(sortedGray(row, dark), [10, 90, 200, 30, 250, 60]);
  const table = pixelSortRunTable(pixelSortStructure(construct(row, dark)), "luma");
  assert.deepEqual(table.map((r) => [r.id, r.length, Math.round(r.keyMin * 255), Math.round(r.keyMax * 255), r.moved]), [["run:0.0", 2, 10, 90, 2], ["run:3.0", 1, 30, 30, 0], ["run:5.0", 1, 60, 60, 0]]);
  // minRun 2 leaves the single pixels (and only they) alone; the boundary values themselves are selected when they equal from/to
  assert.deepEqual(sortedGray(row, { runs: { ...dark.runs, minRun: 2 } }), [10, 90, 200, 30, 250, 60]);
  assert.deepEqual(sortedGray(gray(3, 1, [50, 40, 30]), { runs: { select: { value: "luma", from: 40 / 255, to: 50 / 255 } } }), [40, 50, 30]);
});

test("diagonal scan lines are the image's diagonals, visited in the stated direction", () => {
  const image = gray(3, 3, [10, 20, 30, 40, 50, 60, 70, 80, 90]);
  assert.deepEqual(sortedGray(image, { runs: { direction: "down-right" }, sort: { order: "descending" } }), [90, 60, 30, 80, 50, 20, 70, 40, 10]);
  // the opposite direction visits the same lines backwards, so an ascending sort puts the smallest at the bottom-right end: the same picture as a descending down-right sort
  assert.deepEqual(sortedGray(image, { runs: { direction: "up-left" }, sort: { order: "ascending" } }), [90, 60, 30, 80, 50, 20, 70, 40, 10]);
  // down-left lines run (1,0)->(0,1), (2,0)->(1,1)->(0,2), (2,1)->(1,2); descending puts the largest first along each
  assert.deepEqual(sortedGray(image, { runs: { direction: "down-left" }, sort: { order: "descending" } }), [10, 40, 70, 20, 50, 80, 30, 60, 90]);
});

test("equal keys keep scan order in both orders, and hue/saturation keys order by their own value", () => {
  // red, green and blue all have saturation 1, so a saturation sort of a pure-color row cannot move anything
  const colors = createRaster({ width: 3, height: 1, channels: 3, format: "u8", colorSpace: "srgb", alpha: "none", data: [255, 0, 0, 0, 255, 0, 0, 0, 255] });
  for (const order of ["ascending", "descending"] as const) {
    const s = pixelSortStructure(construct(colors, { sort: { key: "saturation", order } }));
    assert.deepEqual(Array.from(rasterData(s.sorted).data as ArrayLike<number>), [255, 0, 0, 0, 255, 0, 0, 0, 255]);
    assert.equal(s.moved, 0);
  }
  // hue: red 0, green 1/3, blue 2/3
  const byHue = pixelSortStructure(construct(colors, { sort: { key: "hue", order: "descending" } }));
  assert.deepEqual(Array.from(rasterData(byHue.sorted).data as ArrayLike<number>), [0, 0, 255, 0, 255, 0, 255, 0, 0]);
});

test("alpha: fully transparent pixels are never selected and keep their bytes; opaque neighbours sort around them", () => {
  const data = [200, 255, 10, 0, 100, 255, 50, 255];
  const raster = createRaster({ width: 4, height: 1, channels: 2, format: "u8", colorSpace: "srgb", alpha: "straight", data });
  const s = pixelSortStructure(construct(raster));
  assert.deepEqual(Array.from(rasterData(s.sorted).data as ArrayLike<number>), [200, 255, 10, 0, 50, 255, 100, 255]);
  assert.deepEqual(s.runs.runs.map((r) => [r.x, r.length]), [[0, 1], [2, 2]]);
  const streaks = pixelSortStreaks(s, { show: "all", tint: "image", merge: 0, palette: [0, 1] }).streaks;
  const hole = streaks.find((streak) => streak.x === 1)!;
  assert.equal(hole.a, 0); assert.equal(hole.sorted, false);
});

// ------------------------------------------------------------------ independent oracle

/** Line-wise oracle written from the definition, not from the implementation: lines by a per-direction key, visit order by projection. */
function oracle(width: number, height: number, values: number[], direction: string, from: number, to: number, minRun: number, eligible: boolean[], order: "ascending" | "descending"): number[] {
  const [dx, dy] = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1], "down-right": [1, 1], "down-left": [-1, 1], "up-right": [1, -1], "up-left": [-1, -1] }[direction]!;
  const lineOf = (x: number, y: number) => dx === 0 ? x : dy === 0 ? y : dx === dy ? x - y : x + y;
  const lines = new Map<number, number[]>();
  for (let p = 0; p < width * height; p++) { const k = lineOf(p % width, Math.floor(p / width)); (lines.get(k) ?? lines.set(k, []).get(k)!).push(p); }
  const out = values.slice();
  for (const pixels of lines.values()) {
    pixels.sort((a, b) => (((a % width) * dx + Math.floor(a / width) * dy) - ((b % width) * dx + Math.floor(b / width) * dy)));
    let start = 0;
    const flush = (end: number) => {
      const run = pixels.slice(start, end);
      if (run.length >= minRun && run.length > 0) {
        const sorted = run.map((p, i) => ({ p, i, v: values[p] })).sort((a, b) => (order === "ascending" ? a.v - b.v : b.v - a.v) || a.i - b.i);
        run.forEach((p, i) => { out[p] = sorted[i].v; });
      }
    };
    for (let i = 0; i <= pixels.length; i++) {
      const selected = i < pixels.length && eligible[pixels[i]] && values[pixels[i]] / 255 >= from && values[pixels[i]] / 255 <= to;
      if (!selected) { flush(i); start = i + 1; }
    }
  }
  return out;
}

test("sorting equals an independent line-wise oracle for random images, directions, intervals, masks and orders", () => {
  let state = 987654321;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const directions = ["right", "left", "down", "up", "down-right", "down-left", "up-right", "up-left"];
  for (let trial = 0; trial < 60; trial++) {
    const width = 1 + Math.floor(random() * 13), height = 1 + Math.floor(random() * 11);
    const values = Array.from({ length: width * height }, () => Math.floor(random() * 6) * 40);
    const direction = directions[trial % 8], from = Math.floor(random() * 3) * 40 / 255, to = from + (1 + Math.floor(random() * 4)) * 40 / 255, minRun = 1 + Math.floor(random() * 3);
    const order = random() < 0.5 ? "ascending" : "descending", role = random() < 0.5 ? "protect" : "select";
    const mask: PixelSortMask = { kind: "ellipse", x: random(), y: random(), width: 0.2 + random(), height: 0.2 + random() };
    const raster = gray(width, height, values);
    const inside = gridToArray(pixelSortMask(raster, mask, 1)!);
    const eligible = inside.map((v) => (v >= 0.5) === (role === "select"));
    const got = sortedGray(raster, { runs: { direction: direction as never, select: { value: "luma", from, to }, minRun }, sort: { order }, mask, maskRole: role });
    assert.deepEqual(got, oracle(width, height, values, direction, from, to, minRun, eligible, order), `trial ${trial} ${direction} ${width}x${height}`);
  }
});

test("pixels are conserved inside every run and the moved-pixel mapping replays the sorted raster", () => {
  const raster = gray(9, 7, Array.from({ length: 63 }, (_, i) => (i * 37) % 251));
  const s = pixelSortStructure(construct(raster, { runs: { direction: "down-left", select: { value: "luma", from: 0.1, to: 0.9 }, minRun: 2 } }));
  const source = grayValues(raster), out = grayValues(s.sorted);
  const inRun = new Set<number>();
  for (const run of s.runs.runs) {
    const pixels = Array.from({ length: run.length }, (_, k) => (run.y + k * s.runs.dy) * 9 + run.x + k * s.runs.dx);
    pixels.forEach((p) => inRun.add(p));
    assert.deepEqual(pixels.map((p) => out[p]).sort((a, b) => a - b), pixels.map((p) => source[p]).sort((a, b) => a - b), "multiset per run");
    assert.deepEqual(pixels.map((p) => out[p]), pixels.map((p) => out[p]).slice().sort((a, b) => a - b), "ascending inside the run");
  }
  for (let p = 0; p < 63; p++) if (!inRun.has(p)) assert.equal(out[p], source[p], `unselected pixel ${p}`);
  // replay: pixel `to` receives the source pixel `from`
  const replay = source.slice();
  for (let slot = 0; slot < s.moves.count; slot++) replay[s.moves.to(slot)] = source[s.moves.from(slot)];
  assert.deepEqual(replay, out);
  const moved = movedPixels(s);
  assert.equal(moved.count, s.moved);
  assert.equal(moved.count, source.filter((v, p) => out[p] !== v).length, "the values are distinct, so a slot changes place exactly when its byte changes");
  for (let i = 0; i < moved.count; i++) assert.notEqual(moved.to(i), moved.from(i));
  for (let p = 0; p < 63; p++) assert.equal(pixelSortRunAt(s, p % 9, Math.floor(p / 9)) >= 0, inRun.has(p));
});

// ------------------------------------------------------------------ run length cap

test("a longest run cuts each run into the fewest nearly equal pieces, longer pieces first, in scan order", () => {
  const ramp = gray(10, 1, [9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((v) => v * 20));
  const right = pixelSortStructure(construct(ramp, { runs: { maxRun: 4 } }));
  assert.deepEqual(right.runs.runs.map((r) => [r.x, r.length]), [[0, 4], [4, 3], [7, 3]]);
  assert.deepEqual(pixelSortRunTable(right, "luma").map((r) => r.id), ["run:0.0", "run:4.0", "run:7.0"]);
  assert.deepEqual(grayValues(right.sorted), [120, 140, 160, 180, 60, 80, 100, 0, 20, 40]);
  const left = pixelSortStructure(construct(ramp, { runs: { direction: "left", maxRun: 4 } }));
  assert.deepEqual(left.runs.runs.map((r) => [r.x, r.length]), [[9, 4], [5, 3], [2, 3]]);
});

test("run pieces always sum to the run, differ by at most one, stay within the cap and are never below half of it", () => {
  for (let maxRun = 2; maxRun <= 17; maxRun++) for (let length = 1; length <= 90; length++) {
    const s = pixelSortStructure(construct(gray(length, 1, Array.from({ length }, (_, i) => i % 250)), { runs: { maxRun } }));
    const lengths = s.runs.runs.map((r) => r.length);
    assert.equal(lengths.reduce((a, b) => a + b, 0), length);
    assert.ok(Math.max(...lengths) <= Math.max(maxRun, length <= maxRun ? length : 0), `${length}/${maxRun}`);
    assert.ok(Math.max(...lengths) - Math.min(...lengths) <= 1);
    if (length > maxRun) assert.ok(Math.min(...lengths) >= Math.floor((maxRun + 1) / 2));
    let x = 0;
    for (const run of s.runs.runs) { assert.equal(run.x, x); x += run.length; }
  }
});

// ------------------------------------------------------------------ regions

test("an ellipse region contains exactly the pixel centres inside it, including the boundary", () => {
  // 4 x 1 image, ellipse centred on the middle with half-width 3/8: the outer pixel centres lie exactly on it
  const grid = gridToArray(pixelSortMask(gray(4, 1, [0, 0, 0, 0]), { kind: "ellipse", x: 0.5, y: 0.5, width: 0.75, height: 1 }, 0)!);
  assert.deepEqual(grid, [1, 1, 1, 1]);
  const narrower = gridToArray(pixelSortMask(gray(4, 1, [0, 0, 0, 0]), { kind: "ellipse", x: 0.5, y: 0.5, width: 0.7, height: 1 }, 0)!);
  assert.deepEqual(narrower, [0, 1, 1, 0]);
  // 8 x 8 disc of diameter 1: the count of centres within radius 4, counted independently
  let expected = 0;
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if ((i + 0.5 - 4) ** 2 + (j + 0.5 - 4) ** 2 <= 16) expected++;
  assert.equal(gridToArray(pixelSortMask(gray(8, 8, new Array(64).fill(0)), { kind: "ellipse", x: 0.5, y: 0.5, width: 1, height: 1 }, 0)!).filter((v) => v === 1).length, expected);
});

test("a protected region is byte-identical and splits runs; the selecting role sorts only inside it", () => {
  const values = Array.from({ length: 64 }, (_, i) => (i * 53) % 256);
  const raster = gray(8, 8, values), mask: PixelSortMask = { kind: "ellipse", x: 0.5, y: 0.5, width: 0.5, height: 0.5 };
  const region = gridToArray(pixelSortMask(raster, mask, 0)!);
  const protectedOut = sortedGray(raster, { mask, maskRole: "protect" }), selectOut = sortedGray(raster, { mask, maskRole: "select" });
  for (let p = 0; p < 64; p++) {
    if (region[p] === 1) assert.equal(protectedOut[p], values[p], `protected ${p}`); else assert.equal(selectOut[p], values[p], `outside the selecting region ${p}`);
  }
  assert.ok(protectedOut.some((v, p) => region[p] === 0 && v !== values[p]));
  assert.ok(selectOut.some((v, p) => region[p] === 1 && v !== values[p]));
  // the row through a protected pixel is two independent runs
  const row = pixelSortStructure(construct(gray(5, 1, [50, 40, 90, 20, 10]), { mask: { kind: "ellipse", x: 0.5, y: 0.5, width: 0.2, height: 1 } }));
  assert.deepEqual(grayValues(row.sorted), [40, 50, 90, 10, 20]);
});

test("the connected region under a point is exactly one tone band's component", () => {
  const two = gray(8, 4, Array.from({ length: 32 }, (_, i) => (i % 8 < 4 ? 30 : 220)));
  const at = (x: number) => gridToArray(pixelSortMask(two, { kind: "region", x, y: 0.5, bands: 2, grow: 0 }, 0)!);
  assert.deepEqual(at(0.1), Array.from({ length: 32 }, (_, i) => (i % 8 < 4 ? 1 : 0)));
  assert.deepEqual(at(0.9), Array.from({ length: 32 }, (_, i) => (i % 8 < 4 ? 0 : 1)));
  // two dark islands are different regions under 4-connectivity even at the same band
  const islands = gray(9, 1, [30, 30, 220, 220, 220, 30, 30, 220, 220]);
  assert.deepEqual(gridToArray(pixelSortMask(islands, { kind: "region", x: 0.05, y: 0.5, bands: 2, grow: 0 }, 0)!), [1, 1, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(gridToArray(pixelSortMask(islands, { kind: "region", x: 0.05, y: 0.5, bands: 2, grow: 1 }, 0)!), [1, 1, 1, 0, 0, 0, 0, 0, 0]);
});

test("edge and noise regions mark exactly the requested share; flat images have no edges", () => {
  const flat = gray(10, 10, new Array(100).fill(90));
  assert.equal(gridToArray(pixelSortMask(flat, { kind: "edges", share: 0.5, grow: 0 }, 0)!).filter((v) => v === 1).length, 0);
  const step = gray(12, 8, Array.from({ length: 96 }, (_, i) => (i % 12 < 6 ? 40 : 200)));
  const edge = gridToArray(pixelSortMask(step, { kind: "edges", share: 16 / 96, grow: 0 }, 0)!);
  assert.equal(edge.filter((v) => v === 1).length, 16);
  edge.forEach((v, p) => { if (v === 1) assert.ok(p % 12 >= 4 && p % 12 <= 7, `edge pixel column ${p % 12}`); });
  for (const share of [0, 0.13, 0.3, 1]) {
    const field = gridToArray(pixelSortMask(gray(40, 25, new Array(1000).fill(0)), { kind: "field", share, scale: 8 }, 5)!);
    assert.equal(field.filter((v) => v === 1).length, Math.round(share * 1000), `share ${share}`);
  }
  const a = pixelSortMask(flat, { kind: "field", share: 0.4, scale: 3 }, 1)!, b = pixelSortMask(flat, { kind: "field", share: 0.4, scale: 3 }, 2)!;
  assert.notDeepEqual(gridToArray(a), gridToArray(b));
  assert.deepEqual(gridToArray(a), gridToArray(pixelSortMask(flat, { kind: "field", share: 0.4, scale: 3 }, 1)!));
});

test("dilation grows a mask by a Chebyshev radius and is clipped by the image", () => {
  const dot = new Array(25).fill(0); dot[12] = 1;
  const grid = (radius: number) => gridToArray(dilateMask(createScalarGrid(5, 5, dot), radius));
  assert.deepEqual(grid(1), Array.from({ length: 25 }, (_, p) => (Math.abs((p % 5) - 2) <= 1 && Math.abs(Math.floor(p / 5) - 2) <= 1 ? 1 : 0)));
  assert.equal(grid(2).every((v) => v === 1), true);
  const corner = new Array(25).fill(0); corner[0] = 1;
  assert.equal(gridToArray(dilateMask(createScalarGrid(5, 5, corner), 1)).filter((v) => v === 1).length, 4);
  assert.deepEqual(grid(0), dot);
});


// ------------------------------------------------------------------ ragged selection and seeds

test("the ragged field is seeded chance: a different seed moves run boundaries, a full interval cannot be moved, none is exact", () => {
  const raster = gray(24, 24, Array.from({ length: 576 }, (_, i) => 30 + ((i * 7) % 190)));
  const partial = { select: { value: "luma" as const, from: 0.3, to: 0.7 }, ragged: { amount: 0.2, scale: 6 } };
  const layout = (seed: number, over: Partial<PixelSortRuns>) => pixelSortStructure(construct(raster, { runs: { ...partial, ...over }, seed })).runs.runs.map((r) => `${r.x},${r.y},${r.length}`).join("|");
  assert.notEqual(layout(1, {}), layout(2, {}));
  assert.equal(layout(1, {}), layout(1, {}));
  assert.equal(layout(1, { ragged: null }), layout(2, { ragged: null }));
  const full = { select: { value: "luma" as const, from: 0, to: 1 } };
  assert.equal(layout(1, full), layout(2, full), "clamping keeps a full-range interval full");
  // the exact interval selects exactly the pixels whose value lies in it
  const exact = pixelSortStructure(construct(raster, { runs: { ...partial, ragged: null } }));
  const selected = new Set<number>();
  for (const run of exact.runs.runs) for (let k = 0; k < run.length; k++) selected.add(run.y * 24 + run.x + k);
  const values = grayValues(raster);
  for (let p = 0; p < 576; p++) assert.equal(selected.has(p), values[p] / 255 >= 0.3 && values[p] / 255 <= 0.7);
});

test("usesSeed states the truth against real structural change", () => {
  const cases: [Params, boolean][] = [
    [{ selectFrom: 0.1, selectSpan: 0.5, ragged: true, scatter: 0.2, protect: "none" }, true],
    [{ selectFrom: 0.1, selectSpan: 0.5, ragged: false, protect: "none" }, false],
    [{ selectFrom: 0.1, selectSpan: 0.5, ragged: true, scatter: 0, protect: "none" }, false],
    [{ selectFrom: 0, selectSpan: 1, ragged: true, scatter: 0.3, protect: "none" }, false],
    [{ selectFrom: 0.1, selectSpan: 0.5, ragged: false, protect: "field", share: 0.3 }, true],
    [{ selectFrom: 0.1, selectSpan: 0.5, ragged: false, protect: "field", share: 0 }, false],
    [{ selectFrom: 0.1, selectSpan: 0.5, ragged: false, protect: "field", share: 1 }, false],
    [{ selectFrom: 0.1, selectSpan: 0.5, ragged: false, protect: "ellipse" }, false],
    [{ selectFrom: 0.1, selectSpan: 0.5, ragged: false, protect: "edges", share: 0.3 }, false],
  ];
  for (const [params, expected] of cases) {
    const a = input({ image: "landscape", ...params }, 1), b = input({ image: "landscape", ...params }, 2);
    assert.equal(usesSeed(a), expected, JSON.stringify(params));
    assert.equal(drawnInput(a).join() !== drawnInput(b).join(), expected, `seed effect ${JSON.stringify(params)}`);
  }
});

// ------------------------------------------------------------------ construction cache

test("appearance edits reuse the structure and never rename runs; structural edits replace it; the seed only when chance is used", () => {
  const base = pixelSortStructure(recipeOf());
  const ids = pixelSortRunTable(base, "luma").map((row) => row.id);
  for (const appearance of [{ tint: "palette" }, { mark: "stitches" }, { merge: 0.15 }, { runLines: "ink" }, { centerX: 200 }, { width: 300 }, { show: "sorted" }, { stitchGap: 0.5, mark: "stitches" }]) {
    const same = pixelSortStructure(recipeOf(appearance));
    assert.equal(same, base, JSON.stringify(appearance));
    assert.deepEqual(pixelSortRunTable(same, "luma").map((row) => row.id), ids);
  }
  assert.equal(pixelSortStructure({ ...recipeOf(), palette: [1, 2, 3] }), base);
  for (const structural of [{ direction: "right" }, { selectFrom: 0.1 }, { order: "descending" }, { minRun: 9 }, { protect: "none" }, { focusX: 0.4 }, { resolution: 100 }, { image: "noise" }, { keyBy: "hue" }, { limitRuns: true }])
    assert.notEqual(pixelSortStructure(recipeOf(structural)), base, JSON.stringify(structural));
  assert.notEqual(pixelSortStructure(recipeOf({}, 43)), base, "ragged edges are chance");
  const exact = { ragged: false, protect: "ellipse" };
  assert.equal(pixelSortStructure(recipeOf(exact, 1)), pixelSortStructure(recipeOf(exact, 2)), "no chance, no seed dependence");
  // hidden controls never reach the recipe
  assert.deepEqual(recipeOf({ ragged: false, scatter: 0.4, scatterScale: 33 }), recipeOf({ ragged: false, scatter: 0.1, scatterScale: 5 }));
  assert.deepEqual(recipeOf({ protect: "none", focusX: 0.1, bands: 7, grow: 5, share: 0.7, maskRole: "select" }), recipeOf({ protect: "none" }));
});

test("published values are frozen and JSON recipes replay the identical drawing", () => {
  const s = pixelSortStructure(recipeOf());
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.runs) && Object.isFrozen(s.runs.runs));
  assert.ok(Object.isFrozen(pixelSortRunTable(s, "luma")[0]));
  const streaks = pixelSortStreaks(s, { show: "all", tint: "image", merge: 0.03, palette: [1, 2] });
  assert.ok(Object.isFrozen(streaks) && Object.isFrozen(streaks.streaks) && Object.isFrozen(streaks.streaks[0]));
  const recipe = recipeOf({ direction: "down-left", protect: "region", runLines: "stitch", mark: "stitches" });
  assert.deepEqual(drawn(JSON.parse(JSON.stringify(recipe))), drawn(recipe));
});

// ------------------------------------------------------------------ streaks

test("streaks partition the image exactly once, in every direction, and agree with the runs and the sorted bytes", () => {
  let state = 4242;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const data = Array.from({ length: 11 * 6 * 3 }, () => Math.floor(random() * 4) * 80);
  const raster = createRaster({ width: 11, height: 6, channels: 3, format: "u8", colorSpace: "srgb", alpha: "none", data });
  for (const direction of ["right", "left", "down", "up", "down-right", "down-left", "up-right", "up-left"] as const) {
    const s = pixelSortStructure(construct(raster, { runs: { direction, select: { value: "luma", from: 0.2, to: 0.8 }, minRun: 2 } }));
    const bytes = Array.from(rasterData(s.sorted).data as ArrayLike<number>);
    const seen = new Array(66).fill(0);
    for (const streak of pixelSortStreaks(s, { show: "all", tint: "image", merge: 0, palette: [1, 2] }).streaks) {
      for (let k = 0; k < streak.length; k++) {
        const x = streak.x + k * s.runs.dx, y = streak.y + k * s.runs.dy, p = y * 11 + x;
        seen[p]++;
        assert.deepEqual([streak.r, streak.g, streak.b], bytes.slice(p * 3, p * 3 + 3), `${direction} colour at ${p}`);
        assert.equal(pixelSortRunAt(s, x, y), streak.run);
        assert.equal(streak.sorted, streak.run >= 0);
      }
    }
    assert.ok(seen.every((count) => count === 1), `${direction} covers every pixel once`);
    const sorted = pixelSortStreaks(s, { show: "sorted", tint: "image", merge: 0, palette: [1, 2] }).streaks.reduce((a, streak) => a + streak.length, 0);
    const untouched = pixelSortStreaks(s, { show: "untouched", tint: "image", merge: 0, palette: [1, 2] }).streaks.reduce((a, streak) => a + streak.length, 0);
    assert.equal(sorted, s.runs.selectedPixels); assert.equal(untouched, 66 - s.runs.selectedPixels);
  }
});

test("merging: identical colors join, the tolerance compares with the running mean inclusively, unsorted pixels are exact", () => {
  // three flat stretches along one line: three streaks
  const flat = pixelSortStructure(construct(gray(10, 1, [40, 40, 40, 40, 90, 90, 90, 200, 200, 200]), { runs: { select: { value: "luma", from: 0, to: 1 } } }));
  assert.deepEqual(pixelSortStreaks(flat, { show: "all", tint: "image", merge: 0, palette: [1, 2] }).streaks.map((s) => [s.x, s.length, s.r]), [[0, 4, 40], [4, 3, 90], [7, 3, 200]]);
  // a ramp 0, 10, 20, 30 with tolerance 10/255: 10 joins mean 0; 20 differs from mean 5 by 15; 30 joins 20 -> [0, 10] then [20, 30]
  const ramp = pixelSortStructure(construct(gray(4, 1, [0, 10, 20, 30])));
  const merged = pixelSortStreaks(ramp, { show: "all", tint: "image", merge: 10 / 255, palette: [1, 2] }).streaks;
  assert.deepEqual(merged.map((s) => [s.x, s.length, s.r]), [[0, 2, 5], [2, 2, 25]]);
  assert.deepEqual(pixelSortStreaks(ramp, { show: "all", tint: "image", merge: 9.9 / 255, palette: [1, 2] }).streaks.map((s) => s.length), [1, 1, 1, 1]);
  // pixels outside every run are never averaged, whatever the tolerance
  const mixed = pixelSortStructure(construct(gray(4, 1, [100, 101, 102, 103]), { runs: { select: { value: "luma", from: 0, to: 0 } } }));
  assert.deepEqual(pixelSortStreaks(mixed, { show: "all", tint: "image", merge: 1, palette: [1, 2] }).streaks.map((s) => s.length), [1, 1, 1, 1]);
  // a run boundary always breaks a streak, even for the same color
  const twoRuns = pixelSortStructure(construct(gray(6, 1, [50, 50, 50, 50, 50, 50]), { runs: { maxRun: 3 } }));
  assert.deepEqual(pixelSortStreaks(twoRuns, { show: "all", tint: "image", merge: 0, palette: [1, 2] }).streaks.map((s) => s.length), [3, 3]);
});

test("the palette gradient maps each pixel's brightness through the palette in order", () => {
  const s = pixelSortStructure(construct(gray(3, 1, [0, 128, 255]), { runs: { select: { value: "luma", from: 0, to: 0 } } }));
  const colors = pixelSortStreaks(s, { show: "all", tint: "palette", merge: 0, palette: [0x000000, 0xff0000, 0xffff00] }).streaks.map((x) => [x.r, x.g, x.b]);
  // luma 128/255 = 0.502 sits just past the middle stop (red): mostly red with a little yellow blended in
  assert.deepEqual(colors, [[0, 0, 0], [255, 1, 0], [255, 255, 0]]);
});

test("bar outlines are exact pixel unions: rectangle or staircase, area equal to the pixel count, pixel centres inside and neighbours outside", () => {
  const inside = (points: readonly (readonly [number, number])[], px: number, py: number): boolean => {
    let inn = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i], [xj, yj] = points[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inn = !inn;
    }
    return inn;
  };
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) for (let length = 1; length <= 6; length++) {
    const x = 8, y = 8, points = runOutline(dx, dy, x, y, length);
    let area = 0;
    for (let i = 0; i < points.length; i++) { const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length]; area += x1 * y2 - x2 * y1; }
    assert.equal(Math.abs(area) / 2, length, `area ${dx},${dy} L${length}`);
    const covered = new Set(Array.from({ length: length }, (_, k) => `${x + k * dx},${y + k * dy}`));
    for (let j = 0; j < 17; j++) for (let i = 0; i < 17; i++)
      assert.equal(inside(points, i + 0.5, j + 0.5), covered.has(`${i},${j}`), `(${i},${j}) dir ${dx},${dy} L${length}`);
  }
});

test("run paths are closed outlines with stable ids on the canvas mapping", () => {
  const s = pixelSortStructure(construct(gray(4, 2, [10, 20, 90, 30, 200, 100, 150, 50]), { runs: { select: { value: "luma", from: 0, to: 0.5 }, minRun: 2 } }));
  const mapping = rasterMapping(s.source, { x: 100, y: 200, width: 40, height: 20 });
  const paths = pixelSortRunPaths(s, mapping, 9);
  assert.deepEqual(paths.map((path) => path.id), s.runs.runs.map((run) => `run:${run.x}.${run.y}`));
  assert.deepEqual(paths[0].points, [[100, 200], [140, 200], [140, 210], [100, 210]]);
  assert.ok(paths.every((path) => path.closed && Object.isFrozen(path) && path.tone === 0));
  const sites = pixelSortStreakSites(pixelSortStreaks(s, { show: "all", tint: "image", merge: 0, palette: [1, 2] }), mapping, 9);
  assert.deepEqual(sites[0].position, [105, 205]); assert.equal(sites[0].angle, 0); assert.equal(sites[0].length, 10); assert.equal(sites[0].breadth, 10);
});

// ------------------------------------------------------------------ work bounds

test("work bounds throw naming the control to change, and never truncate", () => {
  let state = 7;
  const noise = Array.from({ length: 300 * 300 }, () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state >>> 24; });
  const big = pixelSortStructure(construct(gray(300, 300, noise)));
  assert.throws(() => pixelSortStreaks(big, { show: "all", tint: "image", merge: 0, palette: [1, 2] }), /more than 40000 streaks: raise Merge tolerance or lower Resolution/);
  assert.doesNotThrow(() => pixelSortStreaks(big, { show: "all", tint: "image", merge: 0.2, palette: [1, 2] }));
  const stripes = pixelSortStructure(construct(gray(200, 200, Array.from({ length: 40000 }, (_, i) => (i % 2 ? 0 : 255))), { runs: { select: { value: "luma", from: 1, to: 1 } } }));
  assert.equal(stripes.runs.runs.length, 20000);
  assert.throws(() => pixelSortRunPaths(stripes, rasterMapping(stripes.source, { x: 0, y: 0, width: 200, height: 200 }), 1), /raise Shortest run, narrow the interval or set Run outlines to None/);
  const recipe = { ...recipeOf({ runLines: "ink" }), image: { kind: "raster" as const, raster: stripes.source }, runs: runs({ select: { value: "luma", from: 1, to: 1 } }) };
  assert.throws(() => drawn(recipe), /Shortest run/);
  assert.throws(() => pixelSortStructure({ ...construct(gray(3, 1, [1, 2, 3])), runs: runs({ select: { value: "luma", from: 0.8, to: 0.2 } }) }), /Interval start must not exceed/);
});

test("stitched outlines are checked against the callback budget before anything is painted, and name the controls", () => {
  // 100 full-height runs on a 2900-unit footprint: about 11,700 stations each at spacing .5
  const columns = gray(100, 100, new Array(10000).fill(100));
  const big = (spacing: number): PixelSortRecipe => ({ ...recipeOf({ runLines: "stitch" }), image: { kind: "raster", raster: columns }, mask: null, maskRole: "protect",
    runs: runs({ direction: "down", select: { value: "luma", from: 100 / 255, to: 100 / 255 } }),
    footprint: { centerX: 1450, centerY: 1450, width: 2900, height: 2900 }, outline: { kind: "stitch", weight: 1, spacing } });
  const { surface, ops } = recorder();
  assert.throws(() => drawPixelSorting(surface, big(0.5)), /Stitched run outlines would need \d+ work units; the limit is 2000000: raise Outline stitch spacing or Shortest run/);
  assert.equal(ops.length, 0, "nothing was painted");
  assert.doesNotThrow(() => drawPixelSorting(recorder().surface, big(3)));
  return preparePixelSorting(big(0.5), () => false).then(() => assert.fail("expected a rejection"), (error: Error) => assert.match(error.message, /Outline stitch spacing/));
});

test("preparation warms and bound-checks, and honours cancellation", async () => {
  assert.equal(await preparePixelSorting(recipeOf(), () => false), true);
  assert.equal(await preparePixelSorting(recipeOf(), () => true), false);
  assert.equal(await prepareInstrument(input(), () => false), true);
  const stripes = pixelSortStructure(construct(gray(200, 200, Array.from({ length: 40000 }, (_, i) => (i % 2 ? 0 : 255))), { runs: { select: { value: "luma", from: 1, to: 1 } } }));
  await assert.rejects(preparePixelSorting({ ...recipeOf({ runLines: "ink" }), image: { kind: "raster", raster: stripes.source }, runs: runs({ select: { value: "luma", from: 1, to: 1 } }) }, () => false), /Shortest run/);
});

// ------------------------------------------------------------------ drawing

test("the layer is transparent, stays inside its footprint and never clears", () => {
  for (const params of [{}, { mark: "stitches" }, { direction: "down-right" }, { show: "sorted", runLines: "ink" }]) {
    const ops = drawnInput(input(params));
    assert.ok(!ops.some((op) => op.startsWith('["background"') || op.startsWith('["clear"')));
    for (const op of ops.filter((o) => o.startsWith('["rect"'))) {
      const [, x, y, w, h] = JSON.parse(op) as [string, number, number, number, number];
      assert.ok(x >= 80 - 1e-6 && y >= 80 - 1e-6 && x + w <= 560 + 1e-6 && y + h <= 560 + 1e-6, op);
    }
    const pushes = ops.filter((o) => o === '["push"]').length, pops = ops.filter((o) => o === '["pop"]').length;
    assert.equal(pushes, pops);
  }
  // show: sorted draws strictly fewer marks than the whole image and none of them overlap the unsorted ones
  const all = drawnInput(input({ show: "all" })).filter((o) => o.startsWith('["rect"')).length;
  const sortedOnly = drawnInput(input({ show: "sorted" })).filter((o) => o.startsWith('["rect"')).length;
  const untouched = drawnInput(input({ show: "untouched", merge: 0 })).filter((o) => o.startsWith('["rect"')).length;
  assert.ok(sortedOnly > 0 && sortedOnly < all && untouched < all);
});

test("a custom streak consumer receives the same frozen streaks as sites, in order, with the same structure", () => {
  const recipe = recipeOf({ mark: "bars" });
  const seen: string[] = [];
  const { surface } = recorder();
  drawPixelSorting(surface, recipe, { streak: (_p, site) => { seen.push(site.streak.id); } }, createCompositionRun({ maxWork: 200000 }));
  const streaks = pixelSortStreaks(pixelSortStructure(recipe), { show: recipe.marks.show, tint: recipe.marks.tint, merge: recipe.marks.merge, palette: recipe.palette });
  assert.deepEqual(seen, streaks.streaks.map((s) => s.id));
  assert.throws(() => drawPixelSorting(surface, recipe, { streak: () => {} }, createCompositionRun({ maxWork: 10 })), /work budget/);
});

// ------------------------------------------------------------------ controls

test("a hidden control never changes the drawing (many configurations, every hidden control changed)", () => {
  const item = definition(ID);
  let state = 20260929;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const drivers = item.parameters.filter((parameter) => parameter.type === "select" || parameter.type === "boolean");
  let checked = 0;
  const failures: string[] = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    const params: Params = { ...item.defaults, resolution: 48 + Math.floor(random() * 40) };
    for (const driver of drivers) {
      if (driver.key === "image") continue;
      const pool = driver.type === "boolean" ? [false, true] : driver.options!.map((option) => option.value);
      params[driver.key] = pool[Math.floor(random() * pool.length)];
    }
    params.image = ["portrait", "landscape", "geometry", "noise"][attempt % 4];
    const shown = new Set(visibleParameters(ID, params).map((parameter) => parameter.key));
    const base = drawFingerprint({ ...createInstrument(ID), params });
    for (const parameter of item.parameters.filter((entry) => !shown.has(entry.key))) {
      let value: number | string | boolean;
      if (parameter.type === "boolean") value = !params[parameter.key];
      else if (parameter.type === "select") {
        const others = parameter.options!.map((option) => option.value).filter((option) => option !== params[parameter.key]);
        value = others[Math.floor(random() * others.length)];
      } else {
        value = parameter.min! + (parameter.max! - parameter.min!) * (0.1 + 0.8 * random());
        value = parameter.integer ? Math.round(value) : Math.round(value * 100) / 100;
        if (value === params[parameter.key]) continue;
      }
      checked++;
      const changed = drawFingerprint({ ...createInstrument(ID), params: { ...params, [parameter.key]: value } });
      if (changed !== base) failures.push(`${parameter.key}=${String(value)} under ${JSON.stringify({ protect: params.protect, mark: params.mark, show: params.show, runLines: params.runLines, ragged: params.ragged, limitRuns: params.limitRuns })}`);
    }
  }
  assert.deepEqual(failures, []);
  assert.ok(checked > 200, `only ${checked} hidden changes exercised`);
});

test("controls: groups, proportional clusters and dependencies are as authored", () => {
  const items = inspectorItems(ID, createInstrument(ID).params);
  assert.deepEqual(items.map((entry) => entry.label), ["Image", "Placement", "Runs", "Sort", "Protected region", "Streaks", "Run outlines"]);
  const keys = (params: Params) => new Set(visibleParameters(ID, { ...createInstrument(ID).params, ...params }).map((parameter) => parameter.key));
  assert.ok(keys({ protect: "none" }).has("focusX") === false && keys({ protect: "none" }).has("maskRole") === false);
  assert.ok(keys({ protect: "region" }).has("bands") && !keys({ protect: "region" }).has("focusWidth") && keys({ protect: "ellipse" }).has("focusWidth"));
  assert.ok(keys({ protect: "edges" }).has("share") && keys({ protect: "edges" }).has("grow") && !keys({ protect: "edges" }).has("fieldScale") && keys({ protect: "field" }).has("fieldScale"));
  assert.ok(!keys({ show: "untouched" }).has("merge") && keys({ show: "sorted" }).has("merge"));
  assert.ok(!keys({ mark: "bars" }).has("stitchGap") && keys({ mark: "stitches" }).has("stitchGap"));
  assert.ok(!keys({ ragged: false }).has("scatter") && keys({ ragged: true }).has("scatterScale") && !keys({ limitRuns: false }).has("maxRun") && keys({ limitRuns: true }).has("maxRun"));
  assert.ok(!keys({ runLines: "none" }).has("lineWeight") && keys({ runLines: "ink" }).has("lineWeight") && !keys({ runLines: "ink" }).has("lineSpacing") && keys({ runLines: "stitch" }).has("lineSpacing"));
});
