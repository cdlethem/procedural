import {
  passiveArray,
  passiveRecord,
  valueAt,
  number,
  workLimit,
  checkedWork,
} from "./internal/raster-study-utils.js";
import { fdlibmCos, fdlibmSin } from "./fdlibm-trig.js";

const INT32_MAX = 2147483647;

/** Error with a stable field.displace-points-2d contract code. */
export class FieldDisplace2DError extends Error {
  constructor(code) {
    super(code);
    this.name = "FieldDisplace2DError";
    this.code = code;
  }
}

function invalid() { throw new FieldDisplace2DError("INVALID_INPUT"); }
function overflow() { throw new FieldDisplace2DError("NUMERIC_OVERFLOW"); }

function finite(value) {
  if (!Number.isFinite(value)) overflow();
  return value;
}

function zero(value) { return value === 0 ? 0 : value; }

function validatePair(value) {
  const values = passiveArray(value, FieldDisplace2DError, 2);
  number(values[0], FieldDisplace2DError);
  number(values[1], FieldDisplace2DError);
  return values;
}

function pair(value) {
  const values = validatePair(value);
  return [values[0] === 0 ? 0 : values[0], values[1] === 0 ? 0 : values[1]];
}

function pairs(value) {
  const values = passiveArray(value, FieldDisplace2DError);
  if (values.length > INT32_MAX) invalid();
  for (let index = 0; index < values.length; index += 1) validatePair(values[index]);
  return values;
}

function validate(input) {
  const root = passiveRecord(input, ["points", "samples", "mode", "bias", "gain", "maxWork"], FieldDisplace2DError);
  const points = pairs(valueAt(root, "points", FieldDisplace2DError));
  const samples = pairs(valueAt(root, "samples", FieldDisplace2DError));
  if (samples.length !== points.length) invalid();
  const mode = valueAt(root, "mode", FieldDisplace2DError);
  if (mode !== "CARTESIAN" && mode !== "POLAR") invalid();
  const bias = pair(valueAt(root, "bias", FieldDisplace2DError));
  const gain = pair(valueAt(root, "gain", FieldDisplace2DError));
  const maxWork = workLimit(valueAt(root, "maxWork", FieldDisplace2DError), FieldDisplace2DError);
  return { points, samples, mode, bias, gain, maxWork };
}

/**
 * Convert paired pre-sampled field channels into Cartesian or polar point offsets.
 * Implements field.displace-points-2d 0.1.0.
 */
export function fieldDisplace2D(input) {
  const value = validate(input);
  const count = value.points.length;
  checkedWork(count, value.maxWork, FieldDisplace2DError);
  const points = new Array(count);
  const offsets = new Array(count);

  for (let index = 0; index < count; index += 1) {
    const sample = value.samples[index];
    const product0 = finite(value.gain[0] * zero(sample[0]));
    const mapped0 = finite(value.bias[0] + product0);
    const product1 = finite(value.gain[1] * zero(sample[1]));
    const mapped1 = finite(value.bias[1] + product1);
    let dx, dy;
    if (value.mode === "CARTESIAN") {
      dx = mapped0;
      dy = mapped1;
    } else {
      const cosine = finite(fdlibmCos(mapped0));
      const sine = finite(fdlibmSin(mapped0));
      dx = finite(cosine * mapped1);
      dy = finite(sine * mapped1);
    }
    dx = zero(dx);
    dy = zero(dy);
    const source = value.points[index];
    const outputX = zero(finite(zero(source[0]) + dx));
    const outputY = zero(finite(zero(source[1]) + dy));
    points[index] = [outputX, outputY];
    offsets[index] = [dx, dy];
  }
  return { points, offsets };
}
