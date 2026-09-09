const UINT32_MAX = 4294967295;
const INT32_MAX = 2147483647;
const MAX_SAFE = 9007199254740991;

/** Validation/access error with a stable catalog code. */
export class RasterCrossfadeError extends Error {
  constructor(code) {
    super(code);
    this.name = "RasterCrossfadeError";
    this.code = code;
  }
}

function invalid() { throw new RasterCrossfadeError("INVALID_INPUT"); }

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isPlainArray(value) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
}

function exactKeys(record, keys) {
  if (!isPlainObject(record)) invalid();
  if (Reflect.ownKeys(record).length !== keys.length) invalid();
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(record, key)) invalid();
}

function number(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid();
  return value;
}

function dimension(value) {
  const n = number(value);
  if (n < 1 || n !== Math.floor(n) || n > INT32_MAX) invalid();
  return n;
}

function count(width, height) {
  const product = width * height;
  if (width < 1 || height < 1 || product > INT32_MAX) invalid();
  return product;
}

function unsigned(value) {
  const n = number(value);
  if (n < 0 || n > UINT32_MAX || n !== Math.floor(n)) invalid();
  return n >>> 0;
}

function weight(value) {
  const n = number(value);
  if (n < 0 || n > 1) invalid();
  return n;
}

function objectRaster(value) {
  exactKeys(value, ["width", "height", "pixels"]);
  const width = dimension(value.width);
  const height = dimension(value.height);
  const pixelCount = count(width, height);
  return { width, height, pixels: objectPixels(value.pixels, pixelCount) };
}

function objectPixels(value, pixelCount) {
  if (!isPlainArray(value) || value.length !== pixelCount) invalid();
  const pixels = new Array(pixelCount);
  for (let i = 0; i < pixelCount; i += 1) pixels[i] = unsigned(value[i]);
  return pixels;
}

function quantize(value) {
  const clampedLow = Math.max(0, value);
  const clamped = Math.min(255, clampedLow);
  return Math.floor(clamped + 0.5);
}

function channel(first, second, u, v, a) {
  const p = first * u, q = second * v;
  const sum = p + q;
  const c = sum / a;
  return quantize(c);
}

function composite(first, second, w) {
  if (w === 0) return first;
  if (w === 1) return second;
  const t = 1 - w;
  const firstAlpha = (first >>> 24) & 0xff;
  const af = firstAlpha / 255;
  const secondAlpha = (second >>> 24) & 0xff;
  const as = secondAlpha / 255;
  const u = af * t;
  const v = as * w;
  const a = u + v;
  if (a === 0) return 0;
  const alpha = quantize(a * 255);
  if (alpha === 0) return 0;
  const red = channel((first >>> 16) & 0xff, (second >>> 16) & 0xff, u, v, a);
  const green = channel((first >>> 8) & 0xff, (second >>> 8) & 0xff, u, v, a);
  const blue = channel(first & 0xff, second & 0xff, u, v, a);
  return ((alpha << 24) | (red << 16) | (green << 8) | blue) >>> 0;
}

class Crossfade {
  #width; #height; #pixels;
  constructor(width, height, pixels) {
    this.#width = width; this.#height = height; this.#pixels = pixels;
    Object.freeze(this);
  }
  get width() { return this.#width; }
  get height() { return this.#height; }
  #index(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 ||
        value !== Math.floor(value) || value > MAX_SAFE) {
      throw new RasterCrossfadeError("INVALID_INDEX");
    }
    if (value >= this.#pixels.length) throw new RasterCrossfadeError("INDEX_OUT_OF_RANGE");
    return value;
  }
  pixelAt(value) { return this.#pixels[this.#index(value)]; }
  pixels() { return this.#pixels.slice(); }
  toValues() { return { width: this.#width, height: this.#height, pixels: this.#pixels.slice() }; }
}

function validated(width, height, first, second, weights) {
  const pixelCount = count(width, height);
  const output = new Array(pixelCount);
  for (let i = 0; i < pixelCount; i += 1) output[i] = composite(first[i], second[i], weights[i]);
  return new Crossfade(width, height, output);
}

/**
 * Crossfade two same-sized straight ARGB8 rasters using explicit per-pixel weights and
 * premultiplied working channels. Implements raster.crossfade-2d 0.1.0.
 *
 * Provenance: 2017/Generativos/Eyes/eyes002 image stamps; spatial weighting and this
 * portable pixel operation are independently specified project composition work.
 */
export function rasterCrossfade2D(input) {
  exactKeys(input, ["first", "second", "weights"]);
  const first = objectRaster(input.first);
  if (!isPlainObject(input.second)) invalid();
  exactKeys(input.second, ["width", "height", "pixels"]);
  const secondWidth = dimension(input.second.width);
  const secondHeight = dimension(input.second.height);
  const secondCount = count(secondWidth, secondHeight);
  if (first.width !== secondWidth || first.height !== secondHeight) invalid();
  const second = objectPixels(input.second.pixels, secondCount);

  if (!isPlainArray(input.weights) || input.weights.length !== first.pixels.length) invalid();
  const weights = new Array(first.pixels.length);
  for (let i = 0; i < weights.length; i += 1) weights[i] = weight(input.weights[i]);
  return validated(first.width, first.height, first.pixels, second, weights);
}
