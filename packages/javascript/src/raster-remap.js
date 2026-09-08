const INT32_MAX = 2147483647;
const MAX_OUTPUT_COUNT = 1073741823;
const MAX_UNSIGNED32 = 4294967295;
const MAX_SAFE = 9007199254740991;

/** Error with one of the stable raster.bilinear-remap-2d contract codes. */
export class RasterRemapError extends Error {
  constructor(code) { super(code); this.name = "RasterRemapError"; this.code = code; }
}

function fail(code) { throw new RasterRemapError(code); }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function number(value) { if (!finite(value)) fail("INVALID_INPUT"); return value; }
function dimension(value) {
  const n = number(value);
  if (n < 1 || n !== Math.floor(n) || n > INT32_MAX) fail("INVALID_INPUT");
  return n;
}
function sourceCount(w, h) {
  if (w < 1 || h < 1 || BigInt(w) * BigInt(h) > BigInt(INT32_MAX)) fail("INVALID_INPUT");
  return w * h;
}
function outputCount(w, h) {
  if (w < 1 || h < 1 || BigInt(w) * BigInt(h) > BigInt(MAX_OUTPUT_COUNT)) fail("INVALID_INPUT");
  return w * h;
}
function unsigned(value) {
  const n = number(value);
  if (n < 0 || n > MAX_UNSIGNED32 || n !== Math.floor(n)) fail("INVALID_INPUT");
  return n;
}
function coordinate(value) { return number(value); }

function passiveRecord(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("INVALID_INPUT");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail("INVALID_INPUT");
  if (Reflect.ownKeys(value).length !== keys.length) fail("INVALID_INPUT");
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) fail("INVALID_INPUT");
  }
  return value;
}
function recordValue(record, key) { return Object.getOwnPropertyDescriptor(record, key).value; }
function passiveArray(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail("INVALID_INPUT");
  return value;
}
function arrayItem(array, index) {
  const descriptor = Object.getOwnPropertyDescriptor(array, String(index));
  if (descriptor === undefined || !("value" in descriptor)) fail("INVALID_INPUT");
  return descriptor.value;
}

function channel(a, b, c, d, fx, fy) {
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  let value = top + (bottom - top) * fy;
  value = Math.max(0, Math.min(255, value));
  return Math.floor(value + 0.5);
}
function sampleAt(source, width, height, x, y) {
  x = Math.max(0, Math.min(x, width - 1));
  y = Math.max(0, Math.min(y, height - 1));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1), y1 = Math.min(y0 + 1, height - 1);
  const fx = x - x0, fy = y - y0;
  const p00 = source[y0 * width + x0], p10 = source[y0 * width + x1];
  const p01 = source[y1 * width + x0], p11 = source[y1 * width + x1];
  const a = channel((p00 >>> 24) & 255, (p10 >>> 24) & 255, (p01 >>> 24) & 255, (p11 >>> 24) & 255, fx, fy);
  const r = channel((p00 >>> 16) & 255, (p10 >>> 16) & 255, (p01 >>> 16) & 255, (p11 >>> 16) & 255, fx, fy);
  const g = channel((p00 >>> 8) & 255, (p10 >>> 8) & 255, (p01 >>> 8) & 255, (p11 >>> 8) & 255, fx, fy);
  const b = channel(p00 & 255, p10 & 255, p01 & 255, p11 & 255, fx, fy);
  return (((a << 24) | (r << 16) | (g << 8) | b) >>> 0);
}

class Raster {
  #width; #height; #pixels;
  constructor(width, height, pixels) {
    this.#width = width;
    this.#height = height;
    this.#pixels = pixels;
    Object.freeze(this);
  }
  get width() { return this.#width; }
  get height() { return this.#height; }
  #index(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0
        || value !== Math.floor(value) || value > MAX_SAFE) fail("INVALID_INDEX");
    if (value >= this.#pixels.length) fail("INDEX_OUT_OF_RANGE");
    return value;
  }
  pixelAt(index) { return this.#pixels[this.#index(index)]; }
  pixels() { return this.#pixels.slice(); }
  toValues() {
    return { width: this.#width, height: this.#height, pixels: this.#pixels.slice() };
  }
}

/**
 * Remap an owned packed ARGB8 raster through explicit source coordinates using
 * edge-clamped bilinear interpolation. Implements raster.bilinear-remap-2d 0.1.0
 * independently of source code. Motivating sketch: survey/out/2016/Generativos/colorRamp;
 * dimensions, coordinates and pixels are caller data, no encouraged range is evidenced.
 * Stored channels are interpolated independently (straight, not premultiplied).
 */
export function bilinearRasterRemap2D(input) {
  const root = passiveRecord(input, ["source", "outputWidth", "outputHeight", "sourceCoordinates"]);
  const sourceValue = passiveRecord(recordValue(root, "source"), ["width", "height", "pixels"]);
  const sw = dimension(recordValue(sourceValue, "width"));
  const sh = dimension(recordValue(sourceValue, "height"));
  const sCount = sourceCount(sw, sh);
  const suppliedPixels = passiveArray(recordValue(sourceValue, "pixels"));
  if (suppliedPixels.length !== sCount) fail("INVALID_INPUT");
  const sourcePixels = new Array(sCount);
  for (let i = 0; i < sCount; i += 1) sourcePixels[i] = unsigned(arrayItem(suppliedPixels, i));

  const ow = dimension(recordValue(root, "outputWidth"));
  const oh = dimension(recordValue(root, "outputHeight"));
  const oCount = outputCount(ow, oh);
  const suppliedCoordinates = passiveArray(recordValue(root, "sourceCoordinates"));
  if (suppliedCoordinates.length !== oCount) fail("INVALID_INPUT");
  const xy = new Array(2 * oCount);
  for (let i = 0; i < oCount; i += 1) {
    const pair = passiveArray(arrayItem(suppliedCoordinates, i));
    if (pair.length !== 2) fail("INVALID_INPUT");
    xy[2 * i] = coordinate(arrayItem(pair, 0));
    xy[2 * i + 1] = coordinate(arrayItem(pair, 1));
  }

  const output = new Array(oCount);
  for (let index = 0; index < oCount; index += 1) {
    output[index] = sampleAt(sourcePixels, sw, sh, xy[2 * index], xy[2 * index + 1]);
  }
  return new Raster(ow, oh, output);
}
