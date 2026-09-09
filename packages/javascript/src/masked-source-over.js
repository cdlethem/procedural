const UINT32_MAX = 4294967295;
const INT32_MAX = 2147483647;
const MAX_SAFE = 9007199254740991;

/** Validation/access error with a stable catalog code. */
export class MaskedCompositeError extends Error {
  constructor(code) {
    super(code);
    this.name = "MaskedCompositeError";
    this.code = code;
  }
}

function invalid() { throw new MaskedCompositeError("INVALID_INPUT"); }

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

function maskValue(value) {
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

function channel(source, destination, a, u, v) {
  const p = source * a, q = destination * u;
  const sum = p + q;
  const c = sum / v;
  return quantize(c);
}

function composite(source, destination, mask) {
  const sourceAlpha = (source >>> 24) & 0xff;
  if (mask === 0 || sourceAlpha === 0) return destination;
  const sourceAlphaUnit = sourceAlpha / 255;
  const a = sourceAlphaUnit * mask;
  const destinationAlpha = (destination >>> 24) & 0xff;
  const b = destinationAlpha / 255;
  const t = 1 - a;
  const u = b * t;
  const v = a + u;
  if (v === 0) return 0;
  const alpha = quantize(v * 255);
  if (alpha === 0) return 0;
  const red = channel((source >>> 16) & 0xff, (destination >>> 16) & 0xff, a, u, v);
  const green = channel((source >>> 8) & 0xff, (destination >>> 8) & 0xff, a, u, v);
  const blue = channel(source & 0xff, destination & 0xff, a, u, v);
  return ((alpha << 24) | (red << 16) | (green << 8) | blue) >>> 0;
}

class Composite {
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
      throw new MaskedCompositeError("INVALID_INDEX");
    }
    if (value >= this.#pixels.length) throw new MaskedCompositeError("INDEX_OUT_OF_RANGE");
    return value;
  }
  pixelAt(value) { return this.#pixels[this.#index(value)]; }
  pixels() { return this.#pixels.slice(); }
  toValues() { return { width: this.#width, height: this.#height, pixels: this.#pixels.slice() }; }
}

function validated(width, height, source, destination, mask) {
  const pixelCount = count(width, height);
  const output = new Array(pixelCount);
  for (let i = 0; i < pixelCount; i += 1) output[i] = composite(source[i], destination[i], mask[i]);
  return new Composite(width, height, output);
}

/**
 * Composite same-sized straight ARGB8 rasters using an explicit scalar visibility mask.
 * Implements raster.masked-source-over-2d 0.1.0.
 *
 * Provenance: 2017/Generativos/Eyes/eyes002 image stamps; spatial masking and this
 * portable pixel operation are independently specified project composition work.
 */
export function maskedSourceOver2D(input) {
  exactKeys(input, ["source", "destination", "mask"]);
  const source = objectRaster(input.source);
  if (!isPlainObject(input.destination)) invalid();
  exactKeys(input.destination, ["width", "height", "pixels"]);
  const destinationWidth = dimension(input.destination.width);
  const destinationHeight = dimension(input.destination.height);
  const destinationCount = count(destinationWidth, destinationHeight);
  if (source.width !== destinationWidth || source.height !== destinationHeight) invalid();
  const destination = objectPixels(input.destination.pixels, destinationCount);

  if (!isPlainArray(input.mask) || input.mask.length !== source.pixels.length) invalid();
  const mask = new Array(source.pixels.length);
  for (let i = 0; i < mask.length; i += 1) mask[i] = maskValue(input.mask[i]);
  return validated(source.width, source.height, source.pixels, destination, mask);
}
