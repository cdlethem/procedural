import {
  passiveArray,
  passiveRecord,
  valueAt,
  number,
  workLimit,
  checkedProduct,
  checkedWork,
} from "./internal/raster-study-utils.js";
import { gradientNoise2D01 } from "./gradient-noise-2d-01.js";
import { gradientNoise3D01 } from "./gradient-noise-3d-01.js";

const INT32_MAX = 2147483647;
const MAX_QUERY_COORDINATE = 9007199254740991;

/** Error with a stable field.octave-gradient-noise contract code. */
export class OctaveGradientNoiseError extends Error {
  constructor(code) {
    super(code);
    this.name = "OctaveGradientNoiseError";
    this.code = code;
  }
}

function invalid() { throw new OctaveGradientNoiseError("INVALID_INPUT"); }
function overflow() { throw new OctaveGradientNoiseError("NUMERIC_OVERFLOW"); }
function queryRange() { throw new OctaveGradientNoiseError("QUERY_OUT_OF_RANGE"); }

function finite(value) {
  if (!Number.isFinite(value)) overflow();
  return value;
}

function integer(value, maximum) {
  const result = number(value, OctaveGradientNoiseError);
  if (!Number.isSafeInteger(result) || result < 0 || result > maximum) invalid();
  return result;
}

function point(value, dimension) {
  const result = passiveArray(value, OctaveGradientNoiseError, dimension);
  for (let axis = 0; axis < dimension; axis += 1) number(result[axis], OctaveGradientNoiseError);
  return result;
}

function points(value, dimension) {
  const result = passiveArray(value, OctaveGradientNoiseError);
  if (result.length > INT32_MAX) invalid();
  for (let index = 0; index < result.length; index += 1) point(result[index], dimension);
  return result;
}

function validate(input) {
  const root = passiveRecord(input, [
    "dimension", "points", "seed", "octaves", "frequency", "lacunarity",
    "amplitude", "persistence", "normalization", "maxWork",
  ], OctaveGradientNoiseError);
  const dimension = number(valueAt(root, "dimension", OctaveGradientNoiseError), OctaveGradientNoiseError);
  if (dimension !== 2 && dimension !== 3) invalid();
  const suppliedPoints = points(valueAt(root, "points", OctaveGradientNoiseError), dimension);
  const seed = integer(valueAt(root, "seed", OctaveGradientNoiseError), 0xffffffff);
  const octaves = integer(valueAt(root, "octaves", OctaveGradientNoiseError), INT32_MAX);
  if (octaves < 1) invalid();
  const frequency = number(valueAt(root, "frequency", OctaveGradientNoiseError), OctaveGradientNoiseError);
  if (frequency < 0) invalid();
  const lacunarity = number(valueAt(root, "lacunarity", OctaveGradientNoiseError), OctaveGradientNoiseError);
  if (!(lacunarity > 0)) invalid();
  const amplitude = number(valueAt(root, "amplitude", OctaveGradientNoiseError), OctaveGradientNoiseError);
  if (amplitude < 0) invalid();
  const persistence = number(valueAt(root, "persistence", OctaveGradientNoiseError), OctaveGradientNoiseError);
  if (persistence < 0) invalid();
  const normalization = valueAt(root, "normalization", OctaveGradientNoiseError);
  if (normalization !== "NONE" && normalization !== "WEIGHT_SUM") invalid();
  if (normalization === "WEIGHT_SUM" && amplitude === 0) invalid();
  const maxWork = workLimit(valueAt(root, "maxWork", OctaveGradientNoiseError), OctaveGradientNoiseError);
  return { dimension, points: suppliedPoints, seed, octaves, frequency, lacunarity, amplitude, persistence, normalization, maxWork };
}

function schedule(value) {
  const frequencies = new Array(value.octaves);
  const weights = new Array(value.octaves);
  let frequency = value.frequency;
  let weight = value.amplitude;
  let amplitudeSum = 0;
  for (let octave = 0; octave < value.octaves; octave += 1) {
    frequencies[octave] = frequency;
    weights[octave] = weight;
    amplitudeSum = finite(amplitudeSum + weight);
    if (octave + 1 < value.octaves) {
      frequency = finite(frequency * value.lacunarity);
      weight = finite(weight * value.persistence);
    }
  }
  return { frequencies, weights, amplitudeSum };
}

function query(pointValue, frequency, dimension, result) {
  for (let axis = 0; axis < dimension; axis += 1) {
    const coordinate = finite(pointValue[axis] * frequency);
    if (coordinate < -MAX_QUERY_COORDINATE || coordinate >= MAX_QUERY_COORDINATE) queryRange();
    result[axis] = coordinate;
  }
  return result;
}

/**
 * Evaluate a bounded, ordered geometric sum of an existing 2D or 3D gradient field.
 * Implements field.octave-gradient-noise 0.1.0.
 */
export function octaveGradientNoise(input) {
  const value = validate(input);
  const work = checkedProduct([value.points.length + 1, value.octaves], OctaveGradientNoiseError);
  checkedWork(work, value.maxWork, OctaveGradientNoiseError);
  const scheduled = schedule(value);
  const field = value.dimension === 2 ? gradientNoise2D01({ seed: value.seed }) : gradientNoise3D01({ seed: value.seed });
  const values = new Array(value.points.length);
  const coordinates = new Array(value.dimension);

  for (let index = 0; index < value.points.length; index += 1) {
    let sum = 0;
    for (let octave = 0; octave < value.octaves; octave += 1) {
      query(value.points[index], scheduled.frequencies[octave], value.dimension, coordinates);
      const sample = value.dimension === 2
        ? field.sample(coordinates[0], coordinates[1])
        : field.sample(coordinates[0], coordinates[1], coordinates[2]);
      const weighted = finite(scheduled.weights[octave] * sample);
      sum = finite(sum + weighted);
    }
    if (value.normalization === "WEIGHT_SUM") sum = finite(sum / scheduled.amplitudeSum);
    values[index] = sum === 0 ? 0 : sum;
  }
  return { values, amplitudeSum: scheduled.amplitudeSum };
}
