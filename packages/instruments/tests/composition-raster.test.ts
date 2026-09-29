import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  bundledRaster, bundledRasterIds, convertRaster, createRaster, createScalarGrid, cropRaster, linearToSrgb, orientationField, rasterData, rasterMapping,
  rasterPixel, resizeRaster, sampleGrid, sampleRaster, segmentValueBands, srgbToLinear, valueField,
  type EdgeRule, type Raster, type RasterData, type SampleOptions,
} from "../dist/index.js";

const near = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected} (±${tolerance})`);
const nearAll = (actual: ArrayLike<number>, expected: number[], tolerance = 1e-9) => {
  assert.equal(actual.length, expected.length);
  expected.forEach((e, i) => near(actual[i], e, tolerance));
};

const gray8 = (width: number, height: number, values: number[], colorSpace: "srgb" | "linear" = "srgb"): Raster =>
  createRaster({ width, height, channels: 1, format: "u8", colorSpace, alpha: "none", data: values });
const grayF = (width: number, height: number, values: number[], colorSpace: "srgb" | "linear" = "linear"): Raster =>
  createRaster({ width, height, channels: 1, format: "f32", colorSpace, alpha: "none", data: values });
const rgba = (values: number[], width: number, alpha: "straight" | "premultiplied", format: "u8" | "f32" = "f32", colorSpace: "srgb" | "linear" = "srgb"): Raster =>
  createRaster({ width, height: 1, channels: 4, format, colorSpace, alpha, data: values });

/** Deterministic pseudo-random stream for property tests. */
function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x1_0000_0000; };
}

test("createRaster rejects every malformed declaration and names the field or index", () => {
  const base: RasterData = { width: 2, height: 2, channels: 1, format: "u8", colorSpace: "srgb", alpha: "none", data: [0, 1, 2, 3] };
  assert.throws(() => createRaster({ ...base, data: [0, 1, 2] }), /data has 3 samples but 2 x 2 x 1 needs 4/);
  assert.throws(() => createRaster({ ...base, data: [0, 1, 2.5, 3] }), /data\[2\] must be an integer in \[0, 255\]/);
  assert.throws(() => createRaster({ ...base, data: [0, 1, 256, 3] }), /data\[2\]/);
  assert.throws(() => createRaster({ ...base, format: "f32", data: [0, 0.5, 1.5, 1] }), /data\[2\] must be a finite number in \[0, 1\]/);
  assert.throws(() => createRaster({ ...base, format: "f32", data: [0, NaN, 1, 1] }), /data\[1\]/);
  assert.throws(() => createRaster({ ...base, width: 0 }), /width must be an integer/);
  assert.throws(() => createRaster({ ...base, height: 1.5 }), /height must be an integer/);
  assert.throws(() => createRaster({ ...base, alpha: "straight" }), /alpha must be "none"/);
  assert.throws(() => createRaster({ ...base, channels: 4, data: new Array(16).fill(0) }), /include an alpha channel/);
  assert.throws(() => createRaster({ ...base, colorSpace: "p3" as never }), /colorSpace/);
  assert.throws(() => createRaster({ ...base, extra: 1 } as never), /unknown field: extra/);
  assert.throws(() => createRaster({ ...base, data: "abcd" as never }), /array or typed array/);
  assert.throws(() => createRaster({ ...base, channels: 2, alpha: "premultiplied", data: [200, 100, 10, 255, 0, 0, 0, 0] }), /premultiplied color data\[0\] exceeds its alpha/);
});

test("createRaster size and byte limits fail before any allocation and say what to reduce", () => {
  assert.throws(() => createRaster({ width: 8193, height: 1, channels: 1, format: "u8", colorSpace: "srgb", alpha: "none", data: [] }), /width must be an integer in \[1, 8192\]/);
  assert.throws(() => createRaster({ width: 8192, height: 8192, channels: 1, format: "u8", colorSpace: "srgb", alpha: "none", data: [] }), /more than 16777216 pixels; reduce width or height/);
  assert.throws(() => createRaster({ width: 4096, height: 4096, channels: 4, format: "f32", colorSpace: "srgb", alpha: "straight", data: [] }), /exceeds 134217728 bytes/);
});

test("a raster owns a copy: neither the input nor exported data can change it", () => {
  const input = new Uint8ClampedArray([10, 20, 30, 40]);
  const raster = gray8(2, 2, Array.from(input));
  const viaTyped = createRaster({ width: 2, height: 2, channels: 1, format: "u8", colorSpace: "srgb", alpha: "none", data: input });
  input[0] = 99;
  assert.equal(rasterPixel(viaTyped, 0, 0)[0], 10 / 255);
  const exported = rasterData(raster);
  (exported.data as Uint8ClampedArray)[1] = 77;
  assert.equal(rasterPixel(raster, 1, 0)[0], 20 / 255);
  assert.ok(Object.isFrozen(raster));
  assert.throws(() => { (raster as { width: number }).width = 5; }, TypeError);
  assert.throws(() => rasterPixel(raster, 2, 0), /outside 2 x 2/);
});

test("the hash is the SHA-256 of the documented canonical bytes, and depends on every declaration", () => {
  const u8 = createRaster({ width: 2, height: 2, channels: 3, format: "u8", colorSpace: "srgb", alpha: "none", data: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 255] });
  const expectU8 = createHash("sha256").update("procedural-raster/1\n2x2x3 u8 srgb none\n").update(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 255])).digest("hex");
  assert.equal(u8.hash, expectU8);
  const f32 = createRaster({ width: 3, height: 1, channels: 2, format: "f32", colorSpace: "linear", alpha: "premultiplied", data: [0, 0.25, 0.25, 0.5, 0.125, 0.75] });
  const bytes = Buffer.alloc(24);
  Array.from(rasterData(f32).data).forEach((v, i) => bytes.writeFloatLE(v, i * 4));
  assert.equal(f32.hash, createHash("sha256").update("procedural-raster/1\n3x1x2 f32 linear premultiplied\n").update(bytes).digest("hex"));
  // label is not content; every declaration and every sample is
  const relabeled = createRaster({ ...rasterData(u8), label: "other" });
  assert.equal(relabeled.hash, u8.hash);
  assert.notEqual(createRaster({ ...rasterData(u8), colorSpace: "linear" }).hash, u8.hash);
  assert.notEqual(createRaster({ ...rasterData(u8), width: 4, height: 1 }).hash, u8.hash);
  const changed = rasterData(u8); (changed.data as Uint8ClampedArray)[11] = 254;
  assert.notEqual(createRaster(changed).hash, u8.hash);
  const straight = createRaster({ width: 1, height: 1, channels: 2, format: "u8", colorSpace: "srgb", alpha: "straight", data: [5, 200] });
  const premultiplied = createRaster({ width: 1, height: 1, channels: 2, format: "u8", colorSpace: "srgb", alpha: "premultiplied", data: [5, 200] });
  assert.notEqual(straight.hash, premultiplied.hash);
  // a long buffer crosses the 64-byte block boundaries of the hash
  const long = createRaster({ width: 1000, height: 3, channels: 1, format: "u8", colorSpace: "srgb", alpha: "none", data: Array.from({ length: 3000 }, (_, i) => (i * 7) & 255) });
  assert.equal(long.hash, createHash("sha256").update("procedural-raster/1\n1000x3x1 u8 srgb none\n").update(Uint8Array.from(Array.from({ length: 3000 }, (_, i) => (i * 7) & 255))).digest("hex"));
});

test("sRGB transfer curves match the standard's values and invert each other", () => {
  near(srgbToLinear(0.04045), 0.04045 / 12.92, 1e-15);
  near(srgbToLinear(0.5), 0.21404114048223255, 1e-12);
  near(srgbToLinear(1), 1, 1e-15);
  near(linearToSrgb(0.0031308), 12.92 * 0.0031308, 1e-15);
  for (let i = 0; i <= 100; i++) near(linearToSrgb(srgbToLinear(i / 100)), i / 100, 1e-12);
  const linear = convertRaster(gray8(1, 1, [128]), { colorSpace: "linear", format: "f32" });
  near(rasterPixel(linear, 0, 0)[0], 0.2158605, 1e-6);
  assert.equal(linear.colorSpace, "linear");
  assert.equal(rasterPixel(convertRaster(gray8(1, 1, [128]), { colorSpace: "linear" }), 0, 0)[0], 55 / 255);
});

test("alpha conversions keep meaning: straight and premultiplied round-trip, alpha is never transfer-encoded", () => {
  const straight = rgba([0.8, 0.4, 0.2, 0.5, 0.1, 0.2, 0.3, 0], 2, "straight");
  const premultiplied = convertRaster(straight, { alpha: "premultiplied" });
  nearAll(rasterPixel(premultiplied, 0, 0), [0.4, 0.2, 0.1, 0.5], 1e-7);
  nearAll(rasterPixel(premultiplied, 1, 0), [0, 0, 0, 0], 1e-7);
  nearAll(rasterPixel(convertRaster(premultiplied, { alpha: "straight" }), 0, 0), [0.8, 0.4, 0.2, 0.5], 1e-6);
  // color space conversion of a straight raster converts the color and leaves alpha
  const linear = convertRaster(straight, { colorSpace: "linear" });
  near(rasterPixel(linear, 0, 0)[0], srgbToLinear(0.8), 1e-6);
  near(rasterPixel(linear, 0, 0)[3], 0.5, 1e-7);
  // premultiplied conversion to linear: premultiplied linear color = linear(straight) * alpha
  const both = convertRaster(straight, { colorSpace: "linear", alpha: "premultiplied" });
  near(rasterPixel(both, 0, 0)[0], srgbToLinear(0.8) * 0.5, 1e-6);
  assert.throws(() => convertRaster(gray8(1, 1, [1]), { alpha: "premultiplied" }), /has no alpha channel/);
  assert.equal(convertRaster(straight, {}).hash, straight.hash);
});

test("nearest sampling: a boundary belongs to the larger index and edge rules decide outside pixels", () => {
  const r = grayF(4, 1, [0.1, 0.2, 0.3, 0.4]);
  const at = (x: number, edge: EdgeRule) => sampleRaster(r, x, 0.5, { filter: "nearest", edge })[0];
  near(at(0.999, "clamp"), 0.1, 1e-7); near(at(1, "clamp"), 0.2, 1e-7); near(at(3.999, "clamp"), 0.4, 1e-7);
  near(at(-0.5, "clamp"), 0.1, 1e-7); near(at(-0.5, "repeat"), 0.4, 1e-7); near(at(-0.5, "mirror"), 0.1, 1e-7); near(at(-0.5, "zero"), 0, 1e-12);
  near(at(4.5, "repeat"), 0.1, 1e-7); near(at(4.5, "mirror"), 0.4, 1e-7); near(at(-1.5, "mirror"), 0.2, 1e-7); near(at(9, "clamp"), 0.4, 1e-7);
});

test("bilinear sampling interpolates between pixel centres and follows the edge rule at the border", () => {
  const r = grayF(4, 1, [0, 0.25, 0.5, 1]);
  const at = (x: number, edge: EdgeRule = "clamp") => sampleRaster(r, x, 0.5, { edge })[0];
  near(at(0.5), 0, 1e-7); near(at(1.5), 0.25, 1e-7); near(at(2.5), 0.5, 1e-7);
  near(at(1), 0.125, 1e-7); near(at(2), 0.375, 1e-7); near(at(3.25), 0.875, 1e-7);
  near(at(0, "clamp"), 0, 1e-7);
  near(at(0, "repeat"), 0.5, 1e-7);
  near(at(0, "mirror"), 0, 1e-7);
  near(at(0, "zero"), 0, 1e-7);
  near(at(4, "repeat"), 0.5, 1e-7);
  near(at(4, "zero"), 0.5, 1e-7);
  const y = grayF(1, 2, [0.2, 0.6]);
  near(sampleRaster(y, 0.5, 1)[0], 0.4, 1e-7);
  assert.throws(() => sampleRaster(r, NaN, 0), /must be finite/);
  assert.throws(() => sampleRaster(r, 1e12, 0), /within ±1000000000/);
  assert.throws(() => sampleRaster(r, 0, 0, { filter: "lanczos" as never }), /filter must be/);
});

test("bicubic (Catmull-Rom) reproduces pixels and linear ramps exactly and clamps overshoot", () => {
  const ramp = grayF(10, 1, Array.from({ length: 10 }, (_, i) => i / 10));
  for (const u of [3.2, 4.0, 4.5, 5.8]) near(sampleRaster(ramp, u + 0.5, 0.5, { filter: "bicubic" })[0], u / 10, 1e-6);
  for (let i = 0; i < 10; i++) near(sampleRaster(ramp, i + 0.5, 0.5, { filter: "bicubic" })[0], i / 10, 1e-7);
  // taps [1, 0, 0, 0] at t = 1/2 weigh the first by -1/16: negative before clamping
  const dip = grayF(4, 1, [1, 0, 0, 0]);
  assert.equal(sampleRaster(dip, 2, 0.5, { filter: "bicubic" })[0], 0);
  const bump = grayF(4, 1, [0, 1, 1, 0]);
  near(sampleRaster(bump, 2, 0.5, { filter: "bicubic" })[0], 1, 1e-12); // 9/8 unclamped
});

test("interpolation uses premultiplied color so hidden color never bleeds", () => {
  // opaque red beside a fully transparent blue
  const r = rgba([1, 0, 0, 1, 0, 0, 1, 0], 2, "straight");
  const mid = sampleRaster(r, 1, 0.5);
  nearAll(mid, [1, 0, 0, 0.5], 1e-7);
  nearAll(sampleRaster(r, 1, 0.5, { output: "premultiplied" }), [0.5, 0, 0, 0.5], 1e-7);
  nearAll(sampleRaster(r, 1.5, 0.5, { filter: "nearest" }), [0, 0, 0, 0], 1e-7);
  // premultiplied storage gives the same answer
  const p = convertRaster(r, { alpha: "premultiplied" });
  nearAll(sampleRaster(p, 1, 0.5), [1, 0, 0, 0.5], 1e-7);
  // zero edge fades an opaque pixel to transparent, not to black-opaque
  nearAll(sampleRaster(rgba([0.2, 0.4, 0.6, 1], 1, "straight"), 0, 0.5, { edge: "zero" }), [0.2, 0.4, 0.6, 0.5], 1e-7);
  // the working space is honoured: mixing white and black in linear light is not sRGB 0.5
  const bw = grayF(2, 1, [0, 1], "srgb");
  near(sampleRaster(bw, 1, 0.5)[0], 0.5, 1e-7);
  near(sampleRaster(bw, 1, 0.5, { space: "linear" })[0], 0.5, 1e-7);
  near(linearToSrgb(sampleRaster(bw, 1, 0.5, { space: "linear" })[0]), 0.7353569830524495, 1e-9);
});

test("sampling property: bounded by the data, finite, and consistent between filters at pixel centres", () => {
  const random = stream(11);
  for (const channels of [1, 2, 3, 4] as const) {
    const alpha = channels === 2 || channels === 4 ? "straight" : "none";
    const data = Array.from({ length: 5 * 4 * channels }, () => random());
    const raster = createRaster({ width: 5, height: 4, channels, format: "f32", colorSpace: "srgb", alpha, data });
    for (const edge of ["clamp", "repeat", "mirror", "zero"] as EdgeRule[]) for (const filter of ["nearest", "bilinear", "bicubic"] as const) {
      for (let k = 0; k < 40; k++) {
        const s = sampleRaster(raster, random() * 9 - 2, random() * 8 - 2, { edge, filter });
        assert.equal(s.length, channels);
        for (const v of s) assert.ok(v >= 0 && v <= 1 && Number.isFinite(v));
      }
    }
    for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) {
      const stored = rasterPixel(raster, i, j);
      for (const filter of ["nearest", "bilinear", "bicubic"] as const) nearAll(sampleRaster(raster, i + 0.5, j + 0.5, { filter }), stored, 1e-6);
    }
    const options: SampleOptions = { edge: "repeat" };
    nearAll(sampleRaster(raster, 0.3, 0.7, options), sampleRaster(raster, 5.3, 4.7, options), 1e-9);
    nearAll(sampleRaster(raster, 0.3, 0.7, { edge: "mirror" }), sampleRaster(raster, -0.3, 0.7, { edge: "mirror" }), 1e-9);
  }
});

test("valueField: luma, luminance, lightness, hue and saturation have their stated values", () => {
  const rgb = createRaster({ width: 4, height: 1, channels: 3, format: "u8", colorSpace: "srgb", alpha: "none", data: [255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0] });
  nearAll(valueField(rgb, "luma").toArray(), [0.2126, 0.7152, 0.0722, 0.2126 + 0.7152], 1e-12);
  nearAll(valueField(rgb, "luminance").toArray(), [0.2126, 0.7152, 0.0722, 0.9278], 1e-12);
  nearAll(valueField(rgb, "hue").toArray(), [0, 1 / 3, 2 / 3, 1 / 6], 1e-12);
  nearAll(valueField(rgb, "saturation").toArray(), [1, 1, 1, 1], 1e-12);
  // neutral gray: luma is exactly the stored value; lightness follows CIE L*
  const neutral = gray8(3, 1, [0, 128, 255]);
  assert.deepEqual(Array.from(valueField(neutral, "luma").toArray()), [0, 128 / 255, 1]);
  assert.deepEqual(Array.from(valueField(neutral, "hue").toArray()), [0, 0, 0]);
  const Y = srgbToLinear(128 / 255);
  near(valueField(neutral, "lightness").at(1, 0), (116 * Math.cbrt(Y) - 16) / 100, 1e-12);
  near(valueField(neutral, "lightness").at(2, 0), 1, 1e-12);
  near(valueField(neutral, "lightness").at(0, 0), 0, 1e-12);
  // L* of 18% grey is 49.496 (linear input); the low branch is linear in Y
  near(valueField(grayF(2, 1, [0.18, 0.005]), "lightness").at(0, 0), 0.49496, 1e-5);
  near(valueField(grayF(2, 1, [0.18, 0.005]), "lightness").at(1, 0), (24389 / 27) * 0.005 / 100, 1e-7);
});

test("valueField composites transparency over a linear background and reports alpha", () => {
  const black = createRaster({ width: 3, height: 1, channels: 2, format: "f32", colorSpace: "srgb", alpha: "straight", data: [0, 0.5, 0, 0, 1, 1] });
  nearAll(valueField(black, "luminance").toArray(), [0.5, 1, 1], 1e-7);
  nearAll(valueField(black, "luminance", { background: 0 }).toArray(), [0, 0, 1], 1e-7);
  nearAll(valueField(black, "alpha").toArray(), [0.5, 0, 1], 1e-7);
  near(valueField(black, "luma").at(0, 0), linearToSrgb(0.5), 1e-7);
  const premultiplied = convertRaster(black, { alpha: "premultiplied" });
  nearAll(valueField(premultiplied, "luminance").toArray(), [0.5, 1, 1], 1e-7);
  assert.deepEqual(Array.from(valueField(gray8(2, 1, [3, 4]), "alpha").toArray()), [1, 1]);
  assert.throws(() => valueField(black, "luminance", { background: 2 }), /background/);
  assert.throws(() => valueField(black, "chroma" as never), /unknown value kind/);
});

test("grids are immutable copies with checked access", () => {
  const source = [1, 2, 3, 4, 5, 6];
  const grid = createScalarGrid(3, 2, source);
  source[0] = 99;
  assert.equal(grid.at(0, 0), 1);
  const out = grid.toArray(); out[1] = 42;
  assert.equal(grid.get(1), 2);
  assert.equal(grid.at(2, 1), 6);
  assert.ok(Object.isFrozen(grid));
  assert.throws(() => grid.at(3, 0), /outside 3 x 2/);
  assert.throws(() => createScalarGrid(2, 1, [1, NaN]), /data\[1\]/);
  assert.throws(() => createScalarGrid(2, 2, [1, 2, 3]), /needs 4/);
  near(sampleGrid(grid, 1, 0.5), 1.5); // between pixel centres 0.5 and 1.5
  near(sampleGrid(grid, 1.5, 1), 3.5); // centre column 1, halfway between rows: (2 + 5) / 2
});

test("rasterMapping places pixel space on a canvas rectangle", () => {
  const map = rasterMapping({ width: 4, height: 2 }, { x: 10, y: 20, width: 200, height: 100 });
  assert.equal(map.scaleX, 50); assert.equal(map.scaleY, 50);
  assert.deepEqual(map.toCanvas(0, 0), [10, 20]);
  assert.deepEqual(map.toCanvas(4, 2), [210, 120]);
  assert.deepEqual(map.toCanvas(1.5, 0.5), [85, 45]);
  assert.deepEqual(map.toRaster(85, 45), [1.5, 0.5]);
  assert.throws(() => rasterMapping({ width: 4, height: 2 }, { x: 0, y: 0, width: 0, height: 1 }), /rect.width/);
});

test("crop is an exact copy; resize keeps means and works in linear light", () => {
  const data = Array.from({ length: 6 * 4 }, (_, i) => i * 10);
  const r = gray8(6, 4, data);
  const crop = cropRaster(r, { x: 2, y: 1, width: 3, height: 2 });
  assert.deepEqual(Array.from(rasterData(crop).data), [80, 90, 100, 140, 150, 160]);
  assert.throws(() => cropRaster(r, { x: 4, y: 0, width: 3, height: 1 }), /must lie inside 6 x 4/);
  assert.throws(() => cropRaster(r, { x: 0.5, y: 0, width: 1, height: 1 }), /integer/);
  // a black/white checker averages to LINEAR 1/2 = sRGB 188 in sRGB, 128 in linear storage
  const checker = [0, 255, 255, 0];
  assert.equal(rasterData(resizeRaster(gray8(2, 2, checker), 1, 1)).data[0], 188);
  assert.equal(rasterData(resizeRaster(gray8(2, 2, checker, "linear"), 1, 1)).data[0], 128);
  // area averaging conserves the mean for any ratio (5x5 -> 2x2 and 3x3 -> 7x7 up)
  const random = stream(5);
  const f = grayF(5, 5, Array.from({ length: 25 }, () => random()));
  const mean = (raster: Raster) => Array.from(rasterData(raster).data).reduce((a, b) => a + b, 0) / (raster.width * raster.height);
  near(mean(resizeRaster(f, 2, 2)), mean(f), 1e-6);
  near(mean(resizeRaster(f, 5, 5)), mean(f), 1e-6);
  nearAll(rasterData(resizeRaster(f, 5, 5)).data, Array.from(rasterData(f).data), 1e-6);
  const up = grayF(2, 1, [0, 1]);
  nearAll(rasterData(resizeRaster(up, 4, 1)).data, [0, 0, 1, 1], 1e-7);
  nearAll(rasterData(resizeRaster(up, 4, 1, "nearest")).data, [0, 0, 1, 1], 1e-7);
  near(rasterData(resizeRaster(up, 4, 1, "bilinear")).data[1], 0.25, 1e-7);
  // alpha survives a resize weighted by coverage: opaque red next to transparent blue averages to half-covered red
  const edge = rgba([1, 0, 0, 1, 0, 0, 1, 0], 2, "straight", "f32", "linear");
  nearAll(rasterData(resizeRaster(edge, 1, 1)).data, [1, 0, 0, 0.5], 1e-7);
});

test("bundled rasters: four distinct, deterministic, seeded subjects with pinned content", () => {
  const pinned: Record<string, string> = {
    portrait: "386adc684770f98751c98d89ba2f0296b59130183d3e7c1733a5b8414d554307",
    geometry: "798bf881eca6276b7976fde43cfbcc6f488db17ff5c9b7c25d38a4543690e1bf",
    landscape: "e5b80d182d2f8637240ecf25f03856a14cbd9043d04ec2e8eee68c439403be2f",
    noise: "8b4d8d3344c1ad0e2124ee3a74e9ba76e2d03a9473dfb10d2b01e672d830f5b4",
  };
  const hashes = new Set<string>();
  for (const id of bundledRasterIds) {
    const r = bundledRaster(id, 7, 64);
    assert.equal(r.width, 64); assert.equal(r.height, 64); assert.equal(r.channels, 3); assert.equal(r.format, "u8"); assert.equal(r.colorSpace, "srgb"); assert.equal(r.alpha, "none");
    hashes.add(r.hash);
    assert.equal(r.hash, pinned[id], `${id} content changed`);
    assert.notEqual(bundledRaster(id, 8, 64).hash, r.hash, `${id}: the seed changes the picture`);
    assert.equal(bundledRaster(id, 7, 64), r, "cached");
  }
  assert.equal(hashes.size, 4);
  assert.throws(() => bundledRaster("sunset" as never, 1), /Unknown bundled raster/);
  assert.throws(() => bundledRaster("noise", -1), /uint32/);
  assert.throws(() => bundledRaster("noise", 1, 8), /size must be an integer in \[16, 512\]/);
});

test("bundled rasters differ measurably in structure, as their subjects imply", () => {
  const flatFraction = (raster: Raster) => {
    const field = orientationField(raster, { smoothing: 0 });
    const xx = field.tensor.xx.toArray(), yy = field.tensor.yy.toArray();
    let flat = 0;
    for (let i = 0; i < xx.length; i++) if (xx[i] + yy[i] < 1e-12) flat++;
    return flat / xx.length;
  };
  const regions = (raster: Raster) => segmentValueBands(raster, { bands: 4, connectivity: 8 }).regions.length;
  const geometry = bundledRaster("geometry", 3, 96), portrait = bundledRaster("portrait", 3, 96), noise = bundledRaster("noise", 3, 96);
  assert.ok(flatFraction(geometry) > 0.6, `geometry flat ${flatFraction(geometry)}`);
  assert.ok(flatFraction(noise) < 0.05, `noise flat ${flatFraction(noise)}`);
  assert.ok(regions(noise) > 3 * regions(portrait), `noise ${regions(noise)} portrait ${regions(portrait)}`);
  // the landscape's sky is brighter than its ground on every seed
  for (const seed of [1, 2, 3]) {
    const lightness = valueField(bundledRaster("landscape", seed, 64), "lightness");
    let sky = 0, ground = 0;
    for (let x = 0; x < 64; x++) { sky += lightness.at(x, 4); ground += lightness.at(x, 60); }
    assert.ok(sky > ground + 64 * 0.1);
  }
});
