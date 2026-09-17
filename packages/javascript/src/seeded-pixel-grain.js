import {
  MAX_ARRAY,
  passiveArray,
  passiveRecord,
  positiveDimension,
  valueAt,
  number,
  workLimit,
  checkedWork,
} from "./internal/raster-study-utils.js";
import { fdlibmPow } from "./internal/fdlibm-pow.js";

const INT32_MAX = 2147483647;
const UINT32_MODULUS = 4294967296;

/** Error with a stable raster.seeded-pixel-grain contract code. */
export class SeededPixelGrainError extends Error {
  constructor(code) {
    super(code);
    this.name = "SeededPixelGrainError";
    this.code = code;
  }
}

function invalid() { throw new SeededPixelGrainError("INVALID_INPUT"); }
function overflow() { throw new SeededPixelGrainError("NUMERIC_OVERFLOW"); }

function pixel(value) {
  const n = number(value, SeededPixelGrainError);
  if (!Number.isSafeInteger(n) || n < 0 || n > MAX_ARRAY) invalid();
  return n;
}

function stateValue(value) {
  const n = number(value, SeededPixelGrainError);
  if (!Number.isSafeInteger(n) || n < 0 || n > MAX_ARRAY) invalid();
  return n;
}

function finite(value) {
  if (!Number.isFinite(value)) overflow();
  return value;
}

function quantize(value) {
  return Math.floor(Math.min(255, Math.max(0, value)) + 0.5);
}

function next(state) {
  return (Math.imul(1664525, state) + 1013904223) >>> 0;
}

function validate(input) {
  const root = passiveRecord(input, ["source", "mode", "range", "exponent", "rngState", "maxWork"], SeededPixelGrainError);
  const source = passiveRecord(valueAt(root, "source", SeededPixelGrainError), ["width", "height", "pixels"], SeededPixelGrainError);
  const width = positiveDimension(valueAt(source, "width", SeededPixelGrainError), SeededPixelGrainError);
  const height = positiveDimension(valueAt(source, "height", SeededPixelGrainError), SeededPixelGrainError);
  if (width > Math.floor(INT32_MAX / height)) invalid();
  const count = width * height;
  const suppliedPixels = passiveArray(valueAt(source, "pixels", SeededPixelGrainError), SeededPixelGrainError, count);
  for (let index = 0; index < count; index += 1) pixel(suppliedPixels[index]);

  const mode = valueAt(root, "mode", SeededPixelGrainError);
  if (mode !== "RGB_ADD" && mode !== "ALPHA_MULTIPLY") invalid();
  const suppliedRange = passiveArray(valueAt(root, "range", SeededPixelGrainError), SeededPixelGrainError, 2);
  const low = number(suppliedRange[0], SeededPixelGrainError);
  const high = number(suppliedRange[1], SeededPixelGrainError);
  if (low > high || mode === "ALPHA_MULTIPLY" && low < 0) invalid();
  const exponent = number(valueAt(root, "exponent", SeededPixelGrainError), SeededPixelGrainError);
  if (!(exponent > 0)) invalid();
  const rngState = stateValue(valueAt(root, "rngState", SeededPixelGrainError));
  const maxWork = workLimit(valueAt(root, "maxWork", SeededPixelGrainError), SeededPixelGrainError);
  return { width, height, count, pixels: suppliedPixels, mode, low, high, exponent, rngState, maxWork };
}

/**
 * Apply one deterministic shared RGB offset or alpha multiplier to each straight ARGB8
 * source pixel. Implements raster.seeded-pixel-grain 0.1.0.
 */
export function seededPixelGrain(input) {
  const value = validate(input);
  checkedWork(value.count, value.maxWork, SeededPixelGrainError);
  const span = finite(value.high - value.low);
  const output = new Array(value.count);
  let state = value.rngState;

  for (let index = 0; index < value.count; index += 1) {
    state = next(state);
    const u = state / UINT32_MODULUS;
    const q = finite(value.exponent === 1 ? u : fdlibmPow(u, value.exponent));
    const scaled = finite(span * q);
    const sample = finite(value.low + scaled);
    const source = value.pixels[index];
    const alpha = source >>> 24;
    if (value.mode === "RGB_ADD") {
      const red = quantize(finite(((source >>> 16) & 255) + sample));
      const green = quantize(finite(((source >>> 8) & 255) + sample));
      const blue = quantize(finite((source & 255) + sample));
      output[index] = ((alpha << 24) | (red << 16) | (green << 8) | blue) >>> 0;
    } else {
      const adjustedAlpha = quantize(finite(alpha * sample));
      output[index] = ((adjustedAlpha << 24) | (source & 0x00ffffff)) >>> 0;
    }
  }
  return { raster: { width: value.width, height: value.height, pixels: output }, rngState: state };
}
