const MAX_ATTEMPTS = 2147483646;
const UINT32_MAX = 4294967295;
const INT32_MAX = 2147483647;
const KEYS = ["seed", "columns", "rows", "attempts", "axisPolicy"];

/** Validation/access error with a stable catalog code. */
export class PartitionError extends Error {
  constructor(code) {
    super(code);
    this.name = "PartitionError";
    this.code = code;
  }
}

function invalid() { throw new PartitionError("INVALID_INPUT"); }

function integer(value, minimum, maximum) {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid();
  if (!Number.isInteger(value) || value < minimum || value > maximum) invalid();
  return value;
}

function record(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid();
  if (Reflect.ownKeys(value).length !== KEYS.length) invalid();
  for (const key of KEYS) if (!Object.prototype.hasOwnProperty.call(value, key)) invalid();
  return value;
}

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

// Private xoshiro128**1.1 stream, expanded through two SplitMix64 outputs.
// Identical to quadrant-partition.js's Stream (independently duplicated per the
// established per-module convention; both implement the shared private RNG contract).
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

class Partition {
  #left; #top; #right; #bottom; #splits;
  constructor(left, top, right, bottom, splits) {
    this.#left = left; this.#top = top; this.#right = right; this.#bottom = bottom;
    this.#splits = splits;
    Object.freeze(this);
  }
  get size() { return this.#left.length; }
  get splits() { return this.#splits; }
  #checkedIndex(index) {
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > 9007199254740991) {
      throw new PartitionError("INVALID_INDEX");
    }
    if (index >= this.size) throw new PartitionError("INDEX_OUT_OF_RANGE");
    return index;
  }
  boundsAt(index) {
    const i = this.#checkedIndex(index);
    return [this.#left[i], this.#top[i], this.#right[i], this.#bottom[i]];
  }
  boundsInto(index, destination) {
    const i = this.#checkedIndex(index);
    if ((!Array.isArray(destination) && !(destination instanceof Int32Array)) || destination.length !== 4 ||
        !writableSlot(destination, 0) || !writableSlot(destination, 1) ||
        !writableSlot(destination, 2) || !writableSlot(destination, 3)) {
      throw new PartitionError("INVALID_OUTPUT");
    }
    destination[0] = this.#left[i]; destination[1] = this.#top[i];
    destination[2] = this.#right[i]; destination[3] = this.#bottom[i];
    return destination;
  }
  toValues() {
    const bounds = new Array(this.size);
    for (let i = 0; i < this.size; i += 1) bounds[i] = [this.#left[i], this.#top[i], this.#right[i], this.#bottom[i]];
    return { bounds, splits: this.#splits };
  }
}

/**
 * Generate immutable ordered integer-cell rectangles from attempt-bounded binary cuts.
 * Implements layout.binary-cell-partition-2d 0.1.0.
 *
 * Independently specified from survey/out/2018/Generativos/poop/notes.md and
 * survey/out/2018/Generativos/barab/notes.md. CP17's private native study observed
 * attempts 20/80/240 and RANDOM/LONGEST policies; these are not defaults or
 * encouraged ranges.
 */
export function binaryCellPartition2D(input) {
  record(input);
  const seed = integer(input.seed, 0, UINT32_MAX);
  const columns = integer(input.columns, 1, INT32_MAX);
  const rows = integer(input.rows, 1, INT32_MAX);
  const attempts = integer(input.attempts, 0, MAX_ATTEMPTS);
  const axisPolicy = input.axisPolicy;
  if (axisPolicy !== "RANDOM" && axisPolicy !== "LONGEST") invalid();
  const randomAxis = axisPolicy === "RANDOM";

  let left = [0], top = [0], right = [columns], bottom = [rows];
  let size = 1, splits = 0;
  const stream = new Stream(seed);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const selected = Math.floor(stream.unit() * size);
    const x = left[selected], y = top[selected];
    const x2 = right[selected], y2 = bottom[selected];
    const width = x2 - x, height = y2 - y;
    const splitWidth = randomAxis ? stream.unit() < 0.5 : width > height;
    const extent = splitWidth ? width : height;
    if (extent === 1) continue;
    const cut = 1 + Math.floor(stream.unit() * (extent - 1));

    const survivors = left.slice(selected + 1, size);
    const survivorsTop = top.slice(selected + 1, size);
    const survivorsRight = right.slice(selected + 1, size);
    const survivorsBottom = bottom.slice(selected + 1, size);
    left.length = selected; top.length = selected; right.length = selected; bottom.length = selected;
    left.push(...survivors); top.push(...survivorsTop); right.push(...survivorsRight); bottom.push(...survivorsBottom);

    left.push(x, splitWidth ? x + cut : x);
    top.push(y, splitWidth ? y : y + cut);
    right.push(splitWidth ? x + cut : x2, x2);
    bottom.push(splitWidth ? y2 : y + cut, y2);
    size += 1;
    splits += 1;
  }
  return new Partition(left, top, right, bottom, splits);
}
