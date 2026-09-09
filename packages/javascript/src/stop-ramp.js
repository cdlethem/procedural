const MAX_COLOR = 16777215;

/** Error with one of the stable color.stop-ramp contract codes. */
export class StopRampError extends Error {
  constructor(code) { super(code); this.name = "StopRampError"; this.code = code; }
}

function fail(code) { throw new StopRampError(code); }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function number(value, code) { if (!finite(value)) fail(code); return value; }

function passiveRecord(value, keys, code) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(code);
  if (Reflect.ownKeys(value).length !== keys.length) fail(code);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) fail(code);
  }
  return value;
}
function recordValue(record, key) { return Object.getOwnPropertyDescriptor(record, key).value; }
function passiveArray(value, code) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail(code);
  return value;
}
function arrayItem(array, index, code) {
  const descriptor = Object.getOwnPropertyDescriptor(array, String(index));
  if (descriptor === undefined || !("value" in descriptor)) fail(code);
  return descriptor.value;
}

function checkedPosition(value) {
  const position = number(value, "INVALID_INPUT");
  if (position < 0 || position > 1) fail("INVALID_INPUT");
  return position === 0 ? 0 : position;
}
function checkedColor(value) {
  const color = number(value, "INVALID_INPUT");
  if (color < 0 || color > MAX_COLOR || color !== Math.floor(color)) fail("INVALID_INPUT");
  return color;
}
function channel(a, b, t) {
  const difference = b - a;
  const product = difference * t;
  const value = a + product;
  return Math.floor(value + 0.5);
}

class Ramp {
  #positions; #colors;
  constructor(positions, colors) {
    this.#positions = positions;
    this.#colors = colors;
    Object.freeze(this);
  }
  serialize() {
    const stops = [];
    for (let i = 0; i < this.#positions.length; i += 1) {
      stops.push({ position: this.#positions[i], color: this.#colors[i] });
    }
    return { stops };
  }
  sample(query) {
    const value = number(query, "INVALID_QUERY");
    const positions = this.#positions, colors = this.#colors;
    if (value <= positions[0]) return colors[0];
    const last = positions.length - 1;
    if (value >= positions[last]) return colors[last];
    let left = 0, right = last;
    while (right - left > 1) {
      const middle = left + Math.floor((right - left) / 2);
      if (value < positions[middle]) right = middle; else left = middle;
    }
    if (value === positions[left]) return colors[left];
    if (value === positions[right]) return colors[right];
    const numerator = value - positions[left];
    const denominator = positions[right] - positions[left];
    const t = numerator / denominator;
    const a = colors[left], b = colors[right];
    const red = channel((a >>> 16) & 255, (b >>> 16) & 255, t);
    const green = channel((a >>> 8) & 255, (b >>> 8) & 255, t);
    const blue = channel(a & 255, b & 255, t);
    return red * 65536 + green * 256 + blue;
  }
}

/**
 * Immutable noncyclic positioned RGB24 color stops with piecewise linear sampling and
 * endpoint holds. Implements color.stop-ramp 0.1.0 independently of source code.
 * Motivating sketches: survey/out/2016/Generativos/boxDepth, celular, colorRamp and
 * triangleRamp; no artistic stop-count/position/palette range is established, see the
 * catalog contract for evidence.
 */
export function stopRamp(input) {
  const record = passiveRecord(input, ["stops"], "INVALID_INPUT");
  const stopValues = passiveArray(recordValue(record, "stops"), "INVALID_INPUT");
  if (stopValues.length === 0) fail("INVALID_INPUT");
  const positions = new Array(stopValues.length), colors = new Array(stopValues.length);
  for (let index = 0; index < stopValues.length; index += 1) {
    const stopRecord = passiveRecord(arrayItem(stopValues, index, "INVALID_INPUT"),
      ["position", "color"], "INVALID_INPUT");
    const position = checkedPosition(recordValue(stopRecord, "position"));
    if (index > 0 && !(position > positions[index - 1])) fail("INVALID_INPUT");
    positions[index] = position;
    colors[index] = checkedColor(recordValue(stopRecord, "color"));
  }
  return new Ramp(positions, colors);
}
