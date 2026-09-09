import { fdlibmSin, fdlibmCos, fdlibmAtan2 } from "./fdlibm-trig.js";

const MAX_SEGMENTS = 536870911;
const MAX_SAFE = 9007199254740991;
const UINT32_MAX = 4294967295;
const KEYS = ["seed", "segment", "attempts", "firstCutAngleScale", "minCutLength", "maxSegments"];

/** Error with one of the stable topology.seeded-line-pool-2d contract codes. */
export class LinePoolError extends Error {
  constructor(code, detail = null) {
    super(code);
    this.name = "LinePoolError";
    this.code = code;
    if (code === "ARITHMETIC_OVERFLOW" || code === "SEGMENT_LIMIT_EXCEEDED") Object.assign(this, detail);
  }
}
function fail(code, detail) { throw new LinePoolError(code, detail); }
function overflow(attempt, stage, childOrdinal) {
  const detail = childOrdinal === undefined ? { attempt, stage } : { attempt, stage, childOrdinal };
  fail("ARITHMETIC_OVERFLOW", detail);
}

// Private xoshiro128**1.1 stream, expanded through two SplitMix64 outputs.
class Stream {
  constructor(seed) {
    let x = BigInt(seed) + 0x9e3779b97f4a7c15n;
    const a = this.split(x);
    x += 0x9e3779b97f4a7c15n;
    const b = this.split(x);
    this.s0 = Number(a & 0xffffffffn) >>> 0;
    this.s1 = Number(a >> 32n) >>> 0;
    this.s2 = Number(b & 0xffffffffn) >>> 0;
    this.s3 = Number(b >> 32n) >>> 0;
  }
  split(x) {
    x = BigInt.asUintN(64, x);
    x = BigInt.asUintN(64, (x ^ (x >> 30n)) * 0xbf58476d1ce4e5b9n);
    x = BigInt.asUintN(64, (x ^ (x >> 27n)) * 0x94d049bb133111ebn);
    return BigInt.asUintN(64, x ^ (x >> 31n));
  }
  output() {
    const value = Math.imul(this.s1, 5) >>> 0;
    const result = Math.imul(((value << 7) | (value >>> 25)) >>> 0, 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ this.s1) >>> 0;
    this.s1 = (this.s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;
    this.s2 = (this.s2 ^ t) >>> 0;
    this.s3 = ((this.s3 << 11) | (this.s3 >>> 21)) >>> 0;
    return result;
  }
  unit() { return this.output() / 4294967296; }
}

function range(low, high, stream) {
  if (low >= high) return low;
  return low + ((high - low) * stream.unit());
}

function record(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("INVALID_INPUT");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail("INVALID_INPUT");
  if (Reflect.ownKeys(value).length !== KEYS.length) fail("INVALID_INPUT");
  for (const key of KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) fail("INVALID_INPUT");
  }
  return value;
}
function number(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) fail("INVALID_INPUT");
  return value;
}
function uint32(value) {
  const n = number(value);
  if (n < 0 || n > UINT32_MAX || n !== Math.floor(n)) fail("INVALID_INPUT");
  return n;
}
function segmentOf(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== 4) fail("INVALID_INPUT");
  const values = [];
  for (let index = 0; index < 4; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor)) fail("INVALID_INPUT");
    values.push(number(descriptor.value));
  }
  return values;
}
function attemptsOf(value) {
  const n = number(value);
  if (n < 0 || n > 2147483647 || n !== Math.floor(n)) fail("INVALID_INPUT");
  return n;
}
function nonnegative(value) {
  const n = number(value);
  if (n < 0) fail("INVALID_INPUT");
  return n;
}
function positive(value) {
  const n = number(value);
  if (!(n > 0)) fail("INVALID_INPUT");
  return n;
}
function maximum(value) {
  const n = number(value);
  if (n < 1 || n > MAX_SEGMENTS || n !== Math.floor(n)) fail("INVALID_INPUT");
  return n;
}
function accessIndex(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_SAFE || value !== Math.floor(value)) fail("INVALID_INDEX");
  return value;
}
function zero(value) { return value === 0 ? 0 : value; }
function writableSlot(array, index) {
  const key = String(index);
  const descriptor = Object.getOwnPropertyDescriptor(array, key);
  if (descriptor !== undefined) return "value" in descriptor && descriptor.writable === true;
  if (!Object.isExtensible(array)) return false;
  for (let prototype = Object.getPrototypeOf(array); prototype !== null; prototype = Object.getPrototypeOf(prototype)) {
    if (Object.getOwnPropertyDescriptor(prototype, key) !== undefined) return false;
  }
  return true;
}

class LinePool {
  #coordinates; #divided; #attempts; #successfulCuts; #skips;
  constructor(coordinates, divided, attempts, successfulCuts, skips) {
    this.#coordinates = coordinates;
    this.#divided = divided;
    this.#attempts = attempts;
    this.#successfulCuts = successfulCuts;
    this.#skips = skips;
  }
  #checkedIndex(index) {
    const at = accessIndex(index);
    if (at >= this.#divided.length) fail("INDEX_OUT_OF_RANGE");
    return at;
  }
  get size() { return this.#divided.length; }
  get attempts() { return this.#attempts; }
  get successfulCuts() { return this.#successfulCuts; }
  get skips() { return this.#skips; }
  segmentAt(index) {
    const at = this.#checkedIndex(index);
    const base = at * 4;
    return [zero(this.#coordinates[base]), zero(this.#coordinates[base + 1]), zero(this.#coordinates[base + 2]), zero(this.#coordinates[base + 3])];
  }
  segmentInto(index, destination, offset = 0) {
    const at = this.#checkedIndex(index);
    if (!Array.isArray(destination) && !(destination instanceof Float64Array)) fail("INVALID_OUTPUT");
    if (!Number.isInteger(offset) || offset < 0 || offset > destination.length - 4) fail("INVALID_OUTPUT");
    for (let slot = 0; slot < 4; slot += 1) if (!writableSlot(destination, offset + slot)) fail("INVALID_OUTPUT");
    const base = at * 4;
    destination[offset] = zero(this.#coordinates[base]);
    destination[offset + 1] = zero(this.#coordinates[base + 1]);
    destination[offset + 2] = zero(this.#coordinates[base + 2]);
    destination[offset + 3] = zero(this.#coordinates[base + 3]);
    return destination;
  }
  dividedAt(index) { return this.#divided[this.#checkedIndex(index)]; }
  toValues() {
    const count = this.size;
    const segments = new Array(count);
    const divided = new Array(count);
    for (let index = 0; index < count; index += 1) {
      segments[index] = this.segmentAt(index);
      divided[index] = this.#divided[index];
    }
    return { segments, divided, attempts: this.#attempts, successfulCuts: this.#successfulCuts, skips: this.#skips };
  }
}

/**
 * Generates a detached retained pool of branching segments by repeatedly cutting
 * a selected existing segment, motivated by survey/out/2019/generativos/brotes/notes.md.
 * The parameter decision is recorded in design/capabilities/line-pool-admission.md: the
 * inspected control experiment tested 9000/90000/180000 attempts and first-cut angle
 * scales 0.7/1.4/2.1; those discrete observations do not establish a default or
 * continuous encouraged range. minCutLength is a caller coordinate-unit termination
 * threshold based on the source's 4-unit skip, not a measured artistic range.
 */
export function seededLinePool2D(config) {
  const input = record(config);
  const seed = uint32(input.seed);
  const initial = segmentOf(input.segment);
  const attempts = attemptsOf(input.attempts);
  const firstCutAngleScale = nonnegative(input.firstCutAngleScale);
  const minCutLength = positive(input.minCutLength);
  const maxSegments = maximum(input.maxSegments);

  const coordinates = [initial[0], initial[1], initial[2], initial[3]];
  const divided = [false];
  if (attempts === 0) return new LinePool(coordinates, divided, 0, 0, 0);

  const stream = new Stream(seed);
  let successfulCuts = 0;
  let skips = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const size = divided.length;
    const selectedIndex = Math.min(size - 1, Math.floor((stream.unit() * size) * range(0.8, 1.0, stream)));
    const base = selectedIndex * 4;
    const sx = coordinates[base], sy = coordinates[base + 1], ex = coordinates[base + 2], ey = coordinates[base + 3];
    const dx = checkedValue(ex - sx, attempt, "difference_x");
    const dy = checkedValue(ey - sy, attempt, "difference_y");
    const xx = checkedValue(dx * dx, attempt, "square_x");
    const yy = checkedValue(dy * dy, attempt, "square_y");
    const squared = checkedValue(xx + yy, attempt, "squared_length");
    const length = Math.sqrt(squared);
    const heading = fdlibmAtan2(dy, dx);
    if (length < minCutLength) { skips += 1; continue; }

    let fraction = range(range(0.6, 0.7, stream), range(0.0, 0.8, stream), stream);
    const wasDivided = divided[selectedIndex];
    if (wasDivided) fraction = fraction * 0.4;
    const remainder = length * (1.0 - fraction);

    let firstPresent = false, firstContinuation = false, firstTurn = 0.0, firstDistance = 0.0;
    let firstContinuationX = 0.0, firstContinuationY = 0.0;
    let secondPresent = false, secondTurn = 0.0, secondDistance = 0.0;
    let childCount;
    if (!wasDivided) {
      const a = checkedValue(range(0.0, 1.2, stream) * range(0.2, 1.0, stream) * firstCutAngleScale, attempt, "spread_positive");
      const b = checkedValue(range(0.0, 1.2, stream) * range(0.2, 1.0, stream) * firstCutAngleScale, attempt, "spread_negative");
      stream.unit();
      const l0 = checkedValue(remainder * range(0.9, 1.2, stream), attempt, "length_positive");
      const l1 = checkedValue(remainder * range(0.9, 1.2, stream), attempt, "length_negative");
      const l2 = checkedValue(remainder * range(0.9, 1.2, stream), attempt, "length_straight");
      const h0 = checkedValue(heading + a, attempt, "heading_positive");
      const h1 = checkedValue(heading - b, attempt, "heading_negative");
      const h2 = checkedValue(heading + range(-0.1, 0.1, stream), attempt, "heading_straight");
      const choice = Math.min(2, Math.floor(3.0 * stream.unit()));
      if (choice === 0) {
        childCount = 0;
      } else if (choice === 1) {
        firstPresent = true; firstTurn = h0; firstDistance = l0;
        secondPresent = true; secondTurn = h1; secondDistance = l1;
        childCount = 2;
      } else {
        firstPresent = true; firstTurn = h2; firstDistance = l2;
        childCount = 1;
      }
    } else {
      let deviation = range(0.1, 0.4, stream);
      const sign = stream.unit() < 0.5 ? -1.0 : 1.0;
      deviation = (deviation * sign) * 2.0;
      const distance = checkedValue(remainder * range(0.9, 1.1, stream), attempt, "length_repeat");
      const turn = checkedValue(heading + deviation, attempt, "heading_repeat");
      firstPresent = true; firstContinuation = true; firstContinuationX = ex; firstContinuationY = ey;
      secondPresent = true; secondTurn = turn; secondDistance = distance;
      childCount = 2;
    }

    if (size + childCount > maxSegments) fail("SEGMENT_LIMIT_EXCEEDED", { attempt, selectedIndex });
    const nx = checkedValue(sx + checkedValue(dx * fraction, attempt, "cut_delta_x"), attempt, "cut_x");
    const ny = checkedValue(sy + checkedValue(dy * fraction, attempt, "cut_delta_y"), attempt, "cut_y");

    let firstEndX = 0.0, firstEndY = 0.0, firstDivided = false;
    if (firstPresent) {
      if (firstContinuation) {
        firstEndX = firstContinuationX; firstEndY = firstContinuationY; firstDivided = true;
      } else {
        firstEndX = checkedValue(nx + checkedValue(fdlibmCos(firstTurn) * firstDistance, attempt, "child_delta_x", 0), attempt, "child_x", 0);
        firstEndY = checkedValue(ny + checkedValue(fdlibmSin(firstTurn) * firstDistance, attempt, "child_delta_y", 0), attempt, "child_y", 0);
      }
    }
    let secondEndX = 0.0, secondEndY = 0.0;
    if (secondPresent) {
      secondEndX = checkedValue(nx + checkedValue(fdlibmCos(secondTurn) * secondDistance, attempt, "child_delta_x", 1), attempt, "child_x", 1);
      secondEndY = checkedValue(ny + checkedValue(fdlibmSin(secondTurn) * secondDistance, attempt, "child_delta_y", 1), attempt, "child_y", 1);
    }

    coordinates[base + 2] = nx;
    coordinates[base + 3] = ny;
    divided[selectedIndex] = true;
    if (firstPresent) { coordinates.push(nx, ny, firstEndX, firstEndY); divided.push(firstDivided); }
    if (secondPresent) { coordinates.push(nx, ny, secondEndX, secondEndY); divided.push(false); }
    successfulCuts += 1;
  }
  return new LinePool(coordinates, divided, attempts, successfulCuts, skips);
}

function checkedValue(value, attempt, stage, childOrdinal) {
  if (!Number.isFinite(value)) overflow(attempt, stage, childOrdinal);
  return value;
}
