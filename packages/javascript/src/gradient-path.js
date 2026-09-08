import { gradientNoise2D01 } from "./gradient-noise-2d-01.js";

const MIN_QUERY_COORDINATE = -9_007_199_254_740_991;
const MAX_QUERY_COORDINATE = 9_007_199_254_740_991;
const MAX_STEPS = 1_073_741_822;
const CONFIG_KEYS = ["field", "start", "steps", "stepDistance", "fieldScale", "fieldOffset", "angleBase", "angleScale"];

/** Error with one of the stable gradient-path contract codes. */
export class GradientPathError extends Error {
  constructor(code, stepIndex = undefined, stage = undefined) {
    super(code);
    this.name = "GradientPathError";
    this.code = code;
    if (stepIndex !== undefined) this.stepIndex = stepIndex;
    if (stage !== undefined) this.stage = stage;
  }
}

function fail(code) {
  throw new GradientPathError(code);
}

function traceFail(code, stepIndex, stage) {
  throw new GradientPathError(code, stepIndex, stage);
}

function normalizedZero(value) {
  return value === 0 ? 0 : value;
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function passiveRecord(value, expectedKeys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== expectedKeys.length) return false;
  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) return false;
  }
  return true;
}

function dataValue(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function finitePair(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== 2) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || !keys.includes("length") || !keys.includes("0") || !keys.includes("1")) return null;
  const first = dataValue(value, "0");
  const second = dataValue(value, "1");
  if (!finiteNumber(first) || !finiteNumber(second)) return null;
  return [normalizedZero(first), normalizedZero(second)];
}

function validateConfig(config) {
  if (!passiveRecord(config, CONFIG_KEYS)) fail("INVALID_INPUT");

  const field = dataValue(config, "field");
  if (!passiveRecord(field, ["seed"])) fail("INVALID_INPUT");
  const seed = dataValue(field, "seed");
  if (!finiteNumber(seed) || !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff) fail("INVALID_INPUT");

  const start = finitePair(dataValue(config, "start"));
  if (start === null) fail("INVALID_INPUT");

  const steps = dataValue(config, "steps");
  if (!finiteNumber(steps) || !Number.isSafeInteger(steps) || steps < 0 || steps > MAX_STEPS) fail("INVALID_INPUT");

  const stepDistance = dataValue(config, "stepDistance");
  if (!finiteNumber(stepDistance) || stepDistance < 0) fail("INVALID_INPUT");

  const fieldScale = dataValue(config, "fieldScale");
  if (!finiteNumber(fieldScale)) fail("INVALID_INPUT");

  const fieldOffset = finitePair(dataValue(config, "fieldOffset"));
  if (fieldOffset === null) fail("INVALID_INPUT");

  const angleBase = dataValue(config, "angleBase");
  if (!finiteNumber(angleBase)) fail("INVALID_INPUT");
  const angleScale = dataValue(config, "angleScale");
  if (!finiteNumber(angleScale)) fail("INVALID_INPUT");

  return {
    seed: normalizedZero(seed), startX: start[0], startY: start[1], steps: normalizedZero(steps),
    stepDistance: normalizedZero(stepDistance), fieldScale: normalizedZero(fieldScale),
    fieldOffsetX: fieldOffset[0], fieldOffsetY: fieldOffset[1],
    angleBase: normalizedZero(angleBase), angleScale: normalizedZero(angleScale),
  };
}

function validQueryCoordinate(value) {
  return Number.isFinite(value) && value >= MIN_QUERY_COORDINATE && value < MAX_QUERY_COORDINATE;
}

function validateIndex(index) {
  if (typeof index !== "number" || !Number.isSafeInteger(index) || index < 0) fail("INVALID_INDEX");
}

function writableArraySlot(array, index) {
  const key = String(index);
  const own = Object.getOwnPropertyDescriptor(array, key);
  if (own !== undefined) return "value" in own && own.writable === true;
  if (!Object.isExtensible(array)) return false;
  for (let prototype = Object.getPrototypeOf(array); prototype !== null; prototype = Object.getPrototypeOf(prototype)) {
    if (Object.getOwnPropertyDescriptor(prototype, key) !== undefined) return false;
  }
  return true;
}

function validateOutput(out, offset) {
  if (typeof offset !== "number" || !Number.isSafeInteger(offset) || offset < 0) fail("INVALID_OUTPUT");
  if (out instanceof Float64Array) {
    if (out.length < offset + 2) fail("INVALID_OUTPUT");
    return;
  }
  if (!Array.isArray(out) || Object.getPrototypeOf(out) !== Array.prototype || out.length < offset + 2 ||
      !writableArraySlot(out, offset) || !writableArraySlot(out, offset + 1)) {
    fail("INVALID_OUTPUT");
  }
}

/**
 * Eagerly trace a fixed-step path through the named portable gradient field.
 *
 * Motivating sketches: `2019/generativos/ciserp`, `2018/Generativos/mantel`,
 * `2019/generativos/natalata`, and `2019/generativos/limo002`. The retained path deliberately leaves marks,
 * envelopes, clipping, and rendering to the caller. No artistic default or
 * encouraged parameter range is approved: all configuration is explicit.
 */
export function gradientPath2D(config) {
  const values = validateConfig(config);
  const positionValues = new Float64Array(2 * (values.steps + 1));
  const headingValues = new Float64Array(values.steps);
  const field = gradientNoise2D01({ seed: values.seed });
  let x = values.startX;
  let y = values.startY;
  positionValues[0] = x;
  positionValues[1] = y;

  for (let stepIndex = 0; stepIndex < values.steps; stepIndex += 1) {
    let queryX = x * values.fieldScale;
    if (!Number.isFinite(queryX)) traceFail("TRACE_QUERY_INVALID", stepIndex, "query_x");
    queryX = queryX + values.fieldOffsetX;
    if (!validQueryCoordinate(queryX)) traceFail("TRACE_QUERY_INVALID", stepIndex, "query_x");
    let queryY = y * values.fieldScale;
    if (!Number.isFinite(queryY)) traceFail("TRACE_QUERY_INVALID", stepIndex, "query_y");
    queryY = queryY + values.fieldOffsetY;
    if (!validQueryCoordinate(queryY)) traceFail("TRACE_QUERY_INVALID", stepIndex, "query_y");

    const sample = field.sample(queryX, queryY);
    const mapped = values.angleScale * sample;
    let heading = values.angleBase + mapped;
    if (!Number.isFinite(mapped) || !Number.isFinite(heading)) traceFail("TRACE_ARITHMETIC_INVALID", stepIndex, "heading");
    heading = normalizedZero(heading);

    const cosine = Math.cos(heading);
    const deltaX = values.stepDistance * cosine;
    if (!Number.isFinite(cosine) || !Number.isFinite(deltaX)) traceFail("TRACE_ARITHMETIC_INVALID", stepIndex, "delta_x");
    const sine = Math.sin(heading);
    const deltaY = values.stepDistance * sine;
    if (!Number.isFinite(sine) || !Number.isFinite(deltaY)) traceFail("TRACE_ARITHMETIC_INVALID", stepIndex, "delta_y");
    const nextX = x + deltaX;
    if (!Number.isFinite(nextX)) traceFail("TRACE_ARITHMETIC_INVALID", stepIndex, "position_x");
    const nextY = y + deltaY;
    if (!Number.isFinite(nextY)) traceFail("TRACE_ARITHMETIC_INVALID", stepIndex, "position_y");

    x = normalizedZero(nextX);
    y = normalizedZero(nextY);
    headingValues[stepIndex] = heading;
    const positionOffset = 2 * (stepIndex + 1);
    positionValues[positionOffset] = x;
    positionValues[positionOffset + 1] = y;
  }

  function pointAt(index) {
    validateIndex(index);
    if (index > values.steps) fail("INDEX_OUT_OF_RANGE");
    const offset = 2 * index;
    return [positionValues[offset], positionValues[offset + 1]];
  }

  function headingAt(index) {
    validateIndex(index);
    if (index >= values.steps) fail("INDEX_OUT_OF_RANGE");
    return headingValues[index];
  }

  function pointInto(index, out, offset = 0) {
    validateIndex(index);
    if (index > values.steps) fail("INDEX_OUT_OF_RANGE");
    validateOutput(out, offset);
    const positionOffset = 2 * index;
    out[offset] = positionValues[positionOffset];
    out[offset + 1] = positionValues[positionOffset + 1];
    return out;
  }

  function serialize() {
    return {
      field: { seed: values.seed },
      start: [values.startX, values.startY],
      steps: values.steps,
      stepDistance: values.stepDistance,
      fieldScale: values.fieldScale,
      fieldOffset: [values.fieldOffsetX, values.fieldOffsetY],
      angleBase: values.angleBase,
      angleScale: values.angleScale,
    };
  }

  function toValues() {
    const positions = new Array(values.steps + 1);
    for (let index = 0; index <= values.steps; index += 1) {
      const offset = 2 * index;
      positions[index] = [positionValues[offset], positionValues[offset + 1]];
    }
    return { positions, headings: Array.from(headingValues) };
  }

  const path = { pointAt, headingAt, pointInto, serialize, toValues };
  Object.defineProperty(path, "steps", { value: values.steps, enumerable: true });
  Object.defineProperty(path, "toJSON", { value: serialize });
  return Object.freeze(path);
}
