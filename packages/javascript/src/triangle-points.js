const MAX_COUNT = 1_073_741_823;
const UINT32_MAX = 0xffff_ffff;
const MASK64 = (1n << 64n) - 1n;
const SEEDED_KEYS = ["seed", "count", "triangle"];
const MAP_KEYS = ["triangle", "unitCoordinates"];

export class TrianglePointsError extends Error {
  constructor(code) { super(code); this.name = "TrianglePointsError"; this.code = code; }
}

function fail(code) { throw new TrianglePointsError(code); }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function number(value) { if (!finite(value)) fail("INVALID_INPUT"); return value === 0 ? 0 : value; }
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
function value(record, key) { return Object.getOwnPropertyDescriptor(record, key).value; }
function passiveArray(value, length = undefined) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail("INVALID_INPUT");
  if (length !== undefined && value.length !== length) fail("INVALID_INPUT");
  return value;
}
function item(array, index) {
  const descriptor = Object.getOwnPropertyDescriptor(array, String(index));
  if (!descriptor || !("value" in descriptor)) fail("INVALID_INPUT");
  return descriptor.value;
}
function triangle(value) {
  const vertices = passiveArray(value, 3), result = new Array(6);
  for (let i = 0; i < 3; i++) {
    const vertex = passiveArray(item(vertices, i), 2);
    result[2 * i] = number(item(vertex, 0));
    result[2 * i + 1] = number(item(vertex, 1));
  }
  return result;
}
function integral(value, maximum, code = "INVALID_INPUT") {
  if (!finite(value) || !Number.isSafeInteger(value) || value < 0 || value > maximum) fail(code);
  return value;
}
function units(value) {
  const rows = passiveArray(value);
  if (rows.length > MAX_COUNT) fail("INVALID_INPUT");
  for (let i = 0; i < rows.length; i++) {
    const row = passiveArray(item(rows, i), 2);
    const u = number(item(row, 0));
    if (u < 0 || u > 1) fail("INVALID_INPUT");
    const v = number(item(row, 1));
    if (v < 0 || v > 1) fail("INVALID_INPUT");
  }
  return rows;
}

function zero(value) { return value === 0 ? 0 : value; }
function lerp(a, b, t) {
  if (t === 0) return zero(a);
  if (t === 1) return zero(b);
  let raw;
  if ((a < 0 && b > 0) || (b < 0 && a > 0)) {
    raw = a * (1 - t) + b * t;
  } else {
    raw = a + (b - a) * t;
  }
  const low = Math.min(a, b), high = Math.max(a, b);
  if (raw < low) raw = low;
  else if (raw > high) raw = high;
  return zero(raw);
}
function mapPoint(t, u, v, points, offset) {
  const root = Math.sqrt(u);
  points[offset] = lerp(t[0], lerp(t[2], t[4], v), root);
  points[offset + 1] = lerp(t[1], lerp(t[3], t[5], v), root);
}

class Stream {
  constructor(seed) {
    let state = (BigInt(seed) + 0x9e3779b97f4a7c15n) & MASK64;
    const first = splitMix(state);
    state = (state + 0x9e3779b97f4a7c15n) & MASK64;
    const second = splitMix(state);
    this.s0 = Number(first & 0xffff_ffffn) >>> 0;
    this.s1 = Number(first >> 32n) >>> 0;
    this.s2 = Number(second & 0xffff_ffffn) >>> 0;
    this.s3 = Number(second >> 32n) >>> 0;
  }
  output() {
    const value = Math.imul(this.s1, 5) >>> 0;
    const result = Math.imul(((value << 7) | (value >>> 25)) >>> 0, 9) >>> 0;
    const temporary = (this.s1 << 9) >>> 0;
    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ this.s1) >>> 0;
    this.s1 = (this.s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;
    this.s2 = (this.s2 ^ temporary) >>> 0;
    this.s3 = ((this.s3 << 11) | (this.s3 >>> 21)) >>> 0;
    return result;
  }
  unit() { return this.output() / 4_294_967_296; }
  state() { return [this.s0, this.s1, this.s2, this.s3]; }
}
function splitMix(state) {
  state = ((state ^ (state >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
  state = ((state ^ (state >> 27n)) * 0x94d049bb133111ebn) & MASK64;
  return (state ^ (state >> 31n)) & MASK64;
}

class Result {
  #points;
  constructor(points) { this.#points = points; Object.freeze(this); }
  get size() { return this.#points.length / 2; }
  #index(index) {
    if (typeof index !== "number" || !Number.isSafeInteger(index) || index < 0) fail("INVALID_INDEX");
    if (index >= this.size) fail("INDEX_OUT_OF_RANGE");
    return index;
  }
  pointAt(index) {
    const i = this.#index(index) * 2;
    return [zero(this.#points[i]), zero(this.#points[i + 1])];
  }
  pointInto(index, out, offset = 0) {
    const i = this.#index(index) * 2;
    if (!(out instanceof Float64Array) && !(Array.isArray(out) && Object.getPrototypeOf(out) === Array.prototype)) fail("INVALID_OUTPUT");
    if (!finite(offset) || !Number.isSafeInteger(offset) || offset < 0 || offset > out.length - 2) fail("INVALID_OUTPUT");
    if (Array.isArray(out)) for (let n = 0; n < 2; n += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(out, String(offset + n));
      if (descriptor !== undefined && (!("value" in descriptor) || descriptor.writable !== true)) fail("INVALID_OUTPUT");
      if (descriptor === undefined && !Object.isExtensible(out)) fail("INVALID_OUTPUT");
    }
    out[offset] = zero(this.#points[i]); out[offset + 1] = zero(this.#points[i + 1]);
    return out;
  }
  toValues() {
    const points = new Array(this.size);
    for (let i = 0; i < this.size; i += 1) points[i] = this.pointAt(i);
    return { points };
  }
}

/** Retain uniform triangle samples; motivated by puntis2.
 * Seed/count/vertices are explicit; no measured continuous useful range is claimed.
 * See sampling.seeded-triangle-points-2d and survey/out/2018/Generativos/puntis2/notes.md.
 */
export function seededTrianglePoints2D(config) {
  const record = passiveRecord(config, SEEDED_KEYS);
  const seed = integral(number(value(record, "seed")), UINT32_MAX);
  const count = integral(number(value(record, "count")), MAX_COUNT);
  const t = triangle(value(record, "triangle"));
  if (count === 0) return new Result(new Float64Array(0));
  const points = new Float64Array(count * 2), stream = new Stream(seed);
  for (let i = 0; i < count; i += 1) {
    mapPoint(t, stream.unit(), stream.unit(), points, 2 * i);
  }
  return new Result(points);
}

/** Map explicit unit pairs; motivated by puntis/puntis3 coordinate substitutions.
 * Pairs must be in [0,1]; this is a domain, not an artistic range or distribution.
 * See survey/out/2018/Generativos/puntis/notes.md and puntis3/notes.md.
 */
export function mapTriangleCoordinates2D(config) {
  const record = passiveRecord(config, MAP_KEYS);
  const t = triangle(value(record, "triangle"));
  const coordinates = units(value(record, "unitCoordinates"));
  const points = new Float64Array(coordinates.length * 2);
  for (let i = 0; i < coordinates.length; i += 1) {
    mapPoint(t, coordinates[i][0], coordinates[i][1], points, 2 * i);
  }
  return new Result(points);
}

