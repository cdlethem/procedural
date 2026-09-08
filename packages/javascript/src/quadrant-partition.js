const MAX_REPLACEMENTS = 178956970;
const UINT32_MAX = 4294967295;

/** Validation/access error with a stable catalog code and optional midpoint detail. */
export class PartitionError extends Error {
  constructor(code, replacementIndex = null, stage = null) {
    super(code);
    this.name = "PartitionError";
    this.code = code;
    if (code === "PARTITION_ARITHMETIC_INVALID") {
      this.replacementIndex = replacementIndex;
      this.stage = stage;
    }
  }
}

function invalid() { throw new PartitionError("INVALID_INPUT"); }
function number(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid();
  return value === 0 ? 0 : value;
}
function integer(value, maximum) {
  value = number(value);
  if (!Number.isInteger(value) || value < 0 || value > maximum) invalid();
  return value;
}
function pair(value, positive) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== 2) invalid();
  const x = number(value[0]), y = number(value[1]);
  if (positive && (!(x > 0) || !(y > 0))) invalid();
  return [x, y];
}
function record(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid();
  const keys = ["seed", "replacements", "origin", "extent", "selectionFraction"];
  if (Reflect.ownKeys(value).length !== keys.length) invalid();
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) invalid();
  }
  return value;
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
  state() { return [this.s0, this.s1, this.s2, this.s3]; }
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

class Partition {
  #left; #top; #right; #bottom; #ids; #replacements;
  constructor(left, top, right, bottom, ids, replacements) {
    this.#left = left; this.#top = top; this.#right = right;
    this.#bottom = bottom; this.#ids = ids; this.#replacements = replacements;
    Object.freeze(this);
  }
  get size() { return this.#ids.length; }
  get replacements() { return this.#replacements; }
  #index(index) {
    if (typeof index !== "number" || !Number.isSafeInteger(index) || index < 0) {
      throw new PartitionError("INVALID_INDEX");
    }
    if (index >= this.#ids.length) throw new PartitionError("INDEX_OUT_OF_RANGE");
    return index;
  }
  boundsAt(index) {
    const i = this.#index(index);
    return [this.#left[i], this.#top[i], this.#right[i], this.#bottom[i]];
  }
  idAt(index) { return this.#ids[this.#index(index)]; }
  boundsInto(index, out, offset = 0) {
    const i = this.#index(index);
    if ((!Array.isArray(out) && !(out instanceof Float64Array)) ||
        !Number.isInteger(offset) || offset < 0 || offset > out.length - 4 ||
        !writableSlot(out, offset) || !writableSlot(out, offset + 1) ||
        !writableSlot(out, offset + 2) || !writableSlot(out, offset + 3)) {
      throw new PartitionError("INVALID_OUTPUT");
    }
    out[offset] = this.#left[i]; out[offset + 1] = this.#top[i];
    out[offset + 2] = this.#right[i]; out[offset + 3] = this.#bottom[i];
    return out;
  }
  toValues() {
    const bounds = this.#left.map((left, i) => [left, this.#top[i], this.#right[i], this.#bottom[i]]);
    return { bounds, ids: this.#ids.slice(), replacements: this.#replacements };
  }
}

/**
 * Retain equal-quadrant bounds and birth IDs in live-list mutation order.
 * Implements layout.seeded-quadrant-partition-2d0.1.0 independently of source code.
 * Motivating sketches: survey/out/2018/Generativos/mosaic02 and
 * survey/out/2018/Generativos/mosaic. The private Java investigation observed discrete
 * replacement settings100/200 and selection fractions0.5/1; neither defaults nor
 * continuous useful ranges are established. See the catalog contract for evidence.
 */
export function seededQuadrantPartition2D(config) {
  const r = record(config);
  const seed = integer(r.seed, UINT32_MAX);
  const count = integer(r.replacements, MAX_REPLACEMENTS);
  const origin = pair(r.origin, false), extent = pair(r.extent, true);
  const fraction = number(r.selectionFraction);
  if (!(fraction > 0) || fraction > 1) invalid();
  const right = origin[0] + extent[0], bottom = origin[1] + extent[1];
  if (!Number.isFinite(right) || !Number.isFinite(bottom) || !(right > origin[0]) || !(bottom > origin[1])) {
    throw new PartitionError("INVALID_RECTANGLE");
  }
  const width = right - origin[0], height = bottom - origin[1];
  if (!Number.isFinite(width) || !Number.isFinite(height) || !(width > 0) || !(height > 0)) {
    throw new PartitionError("INVALID_RECTANGLE");
  }
  const left = [origin[0]], top = [origin[1]], rights = [right], bottoms = [bottom], ids = [0];
  if (count === 0) return new Partition(left, top, rights, bottoms, ids, 0);
  const stream = new Stream(seed);
  for (let n = 0; n < count; n += 1) {
    const limit = left.length * fraction;
    const selected = Math.floor(stream.unit() * limit);
    const l = left[selected], t = top[selected], rr = rights[selected], b = bottoms[selected];
    const mx = l + (rr - l) * 0.5;
    if (!(l < mx && mx < rr)) throw new PartitionError("PARTITION_ARITHMETIC_INVALID", n, "midpoint_x");
    const my = t + (b - t) * 0.5;
    if (!(t < my && my < b)) throw new PartitionError("PARTITION_ARITHMETIC_INVALID", n, "midpoint_y");
    const id = 4 * n + 1;
    // Append TL/TR/BR/BL, then remove the selected parent. IDs record birth order.
    left.push(l, mx, mx, l); top.push(t, t, my, my);
    rights.push(mx, rr, rr, mx); bottoms.push(my, my, b, b);
    ids.push(id, id + 1, id + 2, id + 3);
    left.splice(selected, 1); top.splice(selected, 1); rights.splice(selected, 1);
    bottoms.splice(selected, 1); ids.splice(selected, 1);
  }
  return new Partition(left, top, rights, bottoms, ids, count);
}
