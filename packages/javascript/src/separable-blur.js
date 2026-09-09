const UINT32_MAX = 4294967295;
const INT32_MAX = 2147483647;
const MAX_SAFE = 9007199254740991;

/** Validation/access error with a stable catalog code. */
export class SeparableBlurError extends Error {
  constructor(code) {
    super(code);
    this.name = "SeparableBlurError";
    this.code = code;
  }
}

function invalid() { throw new SeparableBlurError("INVALID_INPUT"); }

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
function maxSamplesValue(value) {
  const n = number(value);
  if (n < 1 || n !== Math.floor(n) || n > MAX_SAFE) invalid();
  return n;
}

function objectRaster(value) {
  exactKeys(value, ["width", "height", "pixels"]);
  const width = dimension(value.width);
  const height = dimension(value.height);
  const pixelCount = count(width, height);
  if (!isPlainArray(value.pixels) || value.pixels.length !== pixelCount) invalid();
  const pixels = new Array(pixelCount);
  for (let i = 0; i < pixelCount; i += 1) pixels[i] = unsigned(value.pixels[i]);
  return { width, height, pixels };
}

function objectKernel(value) {
  if (!isPlainArray(value)) invalid();
  if (value.length === 0 || (value.length & 1) === 0) invalid();
  const kernel = new Array(value.length);
  let maximum = 0.0;
  for (let i = 0; i < value.length; i += 1) {
    const weight = number(value[i]);
    if (weight < 0) invalid();
    kernel[i] = weight;
    if (weight > maximum) maximum = weight;
  }
  if (!(maximum > 0)) invalid();
  return kernel;
}

function normalize(supplied) {
  let maximum = 0.0;
  for (let i = 0; i < supplied.length; i += 1) if (supplied[i] > maximum) maximum = supplied[i];
  const normalized = new Array(supplied.length);
  let sum = 0.0;
  for (let i = 0; i < supplied.length; i += 1) {
    const scaled = supplied[i] / maximum;
    normalized[i] = scaled;
    sum += scaled;
  }
  for (let i = 0; i < normalized.length; i += 1) normalized[i] = normalized[i] / sum;
  return normalized;
}

function clamp(coordinate, length) {
  if (coordinate < 0) return 0;
  if (coordinate >= length) return length - 1;
  return coordinate;
}

function horizontalPass(width, height, source, weights, alpha, red, green, blue) {
  const half = Math.floor(weights.length / 2);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      let a = 0, r = 0, g = 0, b = 0;
      for (let tap = 0; tap < weights.length; tap += 1) {
        const coordinate = x + tap - half;
        const sampleX = clamp(coordinate, width);
        const pixel = source[row + sampleX];
        const sampleAlpha = ((pixel >>> 24) & 0xff) / 255;
        const weight = weights[tap];
        a += sampleAlpha * weight;
        const premultipliedRed = ((pixel >>> 16) & 0xff) * sampleAlpha;
        r += premultipliedRed * weight;
        const premultipliedGreen = ((pixel >>> 8) & 0xff) * sampleAlpha;
        g += premultipliedGreen * weight;
        const premultipliedBlue = (pixel & 0xff) * sampleAlpha;
        b += premultipliedBlue * weight;
      }
      const index = row + x;
      alpha[index] = a; red[index] = r; green[index] = g; blue[index] = b;
    }
  }
}

function quantize(value) {
  const lowClamped = Math.max(0, value);
  const clamped = Math.min(255, lowClamped);
  return Math.floor(clamped + 0.5);
}

function pack(alpha, red, green, blue) {
  if (alpha === 0) return 0;
  const outputAlpha = quantize(alpha * 255);
  if (outputAlpha === 0) return 0;
  const outputRed = quantize(red / alpha);
  const outputGreen = quantize(green / alpha);
  const outputBlue = quantize(blue / alpha);
  return ((outputAlpha << 24) | (outputRed << 16) | (outputGreen << 8) | outputBlue) >>> 0;
}

function verticalPass(width, height, weights, alpha, red, green, blue) {
  const output = new Array(alpha.length);
  const half = Math.floor(weights.length / 2);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let a = 0, r = 0, g = 0, b = 0;
      for (let tap = 0; tap < weights.length; tap += 1) {
        const coordinate = y + tap - half;
        const sampleY = clamp(coordinate, height);
        const index = sampleY * width + x;
        const weight = weights[tap];
        a += alpha[index] * weight;
        r += red[index] * weight;
        g += green[index] * weight;
        b += blue[index] * weight;
      }
      output[y * width + x] = pack(a, r, g, b);
    }
  }
  return output;
}

class Blur {
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
      throw new SeparableBlurError("INVALID_INDEX");
    }
    if (value >= this.#pixels.length) throw new SeparableBlurError("INDEX_OUT_OF_RANGE");
    return value;
  }
  pixelAt(value) { return this.#pixels[this.#index(value)]; }
  pixels() { return this.#pixels.slice(); }
  toValues() { return { width: this.#width, height: this.#height, pixels: this.#pixels.slice() }; }
}

function validated(width, height, source, kernelX, kernelY, maxSamples) {
  const pixelCount = count(width, height);
  const work = pixelCount * (kernelX.length + kernelY.length);
  if (work > maxSamples) throw new SeparableBlurError("WORK_LIMIT");
  if (kernelX.length === 1 && kernelY.length === 1) return new Blur(width, height, source.slice());

  const normalizedX = normalize(kernelX);
  const normalizedY = normalize(kernelY);
  const alpha = new Array(pixelCount), red = new Array(pixelCount), green = new Array(pixelCount), blue = new Array(pixelCount);
  horizontalPass(width, height, source, normalizedX, alpha, red, green, blue);
  const output = verticalPass(width, height, normalizedY, alpha, red, green, blue);
  return new Blur(width, height, output);
}

/**
 * Owned normalized separable filtering of straight ARGB8 rasters. Implements
 * raster.separable-blur-2d 0.1.0.
 *
 * Independently specified project work motivated by active weighted neighborhood
 * filters in survey/out/2015/Generativos/cityPink3d/notes.md and
 * survey/out/2020/generative/01_04/rgblur/notes.md. It deliberately does not
 * reproduce their shader gain, vignette, scanlines, fractional taps, or mask
 * modulation. Working RGB is encoded and premultiplied for the specified
 * arithmetic; it is not linear-light filtering. Kernels are explicit caller data:
 * no default or recommended artistic kernel range is provided.
 */
export function separableBlur2D(input) {
  exactKeys(input, ["source", "kernelX", "kernelY", "maxSamples"]);
  const source = objectRaster(input.source);
  const kernelX = objectKernel(input.kernelX);
  const kernelY = objectKernel(input.kernelY);
  const maxSamples = maxSamplesValue(input.maxSamples);
  return validated(source.width, source.height, source.pixels, kernelX, kernelY, maxSamples);
}
