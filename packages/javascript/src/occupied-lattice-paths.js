const MAX_CELLS = 1073741823;
const MAX_STEPS = 1073741822;
const MAX_SAFE = 9007199254740991;
const UINT32_MAX = 4294967295;

/** Error with one of the stable path.occupied-lattice-paths-2d contract codes. */
export class LatticeError extends Error {
  constructor(code) { super(code); this.name = "LatticeError"; this.code = code; }
}

function fail(code) { throw new LatticeError(code); }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function integral(value) {
  if (!finite(value) || value !== Math.floor(value)) fail("INVALID_INPUT");
  return value;
}
function boundedInt(value, lo, hi) {
  const n = integral(value);
  if (n < lo || n > hi) fail("INVALID_INPUT");
  return n;
}
function uint32(value) { return boundedInt(value, 0, UINT32_MAX); }

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
function recordValue(record, key) { return Object.getOwnPropertyDescriptor(record, key).value; }
function hasOwnKey(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && "value" in descriptor;
}
function passiveArray(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail("INVALID_INPUT");
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
function arrayItem(array, index) {
  const descriptor = Object.getOwnPropertyDescriptor(array, String(index));
  if (descriptor === undefined || !("value" in descriptor)) fail("INVALID_INPUT");
  return descriptor.value;
}
function pair(value) {
  const array = passiveArray(value);
  if (array.length !== 2) fail("INVALID_INPUT");
  return array;
}
function recordEitherKey(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("INVALID_INPUT");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail("INVALID_INPUT");
  if (Reflect.ownKeys(value).length !== 1) fail("INVALID_INPUT");
  return value;
}

// Private xoshiro128**1.1 stream with two SplitMix64 expansion words; same
// algorithm as quadrant-partition.js/noise-band-path.js's Stream/Xoshiro, extended
// to accept an explicit caller-supplied [s0,s1,s2,s3] state that bypasses expansion.
class Xoshiro {
  constructor(seed, state) {
    if (state !== null) {
      this.s0 = state[0] >>> 0; this.s1 = state[1] >>> 0; this.s2 = state[2] >>> 0; this.s3 = state[3] >>> 0;
      return;
    }
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
  nextU32() {
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
  /** floor(u32 * count / 2^32); consumes exactly one word for count in 1..4. */
  choose(count) { return Math.floor((this.nextU32() * count) / 4294967296); }
  state() { return [this.s0, this.s1, this.s2, this.s3]; }
}

function readRandom(value) {
  const record = recordEitherKey(value);
  const hasSeed = hasOwnKey(record, "seed"), hasState = hasOwnKey(record, "state");
  if (hasSeed === hasState) fail("INVALID_INPUT");
  if (hasSeed) return { seed: uint32(recordValue(record, "seed")), state: null };
  const words = passiveArray(recordValue(record, "state"));
  if (words.length !== 4) fail("INVALID_INPUT");
  const state = [uint32(arrayItem(words, 0)), uint32(arrayItem(words, 1)), uint32(arrayItem(words, 2)), uint32(arrayItem(words, 3))];
  if (state[0] === 0 && state[1] === 0 && state[2] === 0 && state[3] === 0) fail("INVALID_INPUT");
  return { seed: 0, state };
}

class LatticePaths {
  #x; #y; #offsets; #reasons; #randomState;
  constructor(x, y, offsets, reasons, randomState) {
    this.#x = x; this.#y = y; this.#offsets = offsets; this.#reasons = reasons; this.#randomState = randomState;
    Object.freeze(this);
  }
  get pathCount() { return this.#reasons.length; }

  #pathIndex(path) {
    if (typeof path !== "number" || !Number.isFinite(path) || path < 0
        || path !== Math.floor(path) || path > MAX_SAFE) fail("INVALID_INDEX");
    if (path >= this.#reasons.length) fail("INDEX_OUT_OF_RANGE");
    return path;
  }
  #cellIndex(path, cell) {
    if (typeof cell !== "number" || !Number.isFinite(cell) || cell < 0
        || cell !== Math.floor(cell) || cell > MAX_SAFE) fail("INVALID_INDEX");
    const length = this.#offsets[path + 1] - this.#offsets[path];
    if (cell >= length) fail("INDEX_OUT_OF_RANGE");
    return cell;
  }
  pathLengthAt(path) {
    const p = this.#pathIndex(path);
    return this.#offsets[p + 1] - this.#offsets[p];
  }
  cellAt(path, cell) {
    const p = this.#pathIndex(path);
    const c = this.#cellIndex(p, cell);
    const at = this.#offsets[p] + c;
    return [this.#x[at], this.#y[at]];
  }
  cellInto(path, cell, output, offset = 0) {
    const p = this.#pathIndex(path);
    const c = this.#cellIndex(p, cell);
    if (!Array.isArray(output) && !(output instanceof Int32Array)) fail("INVALID_OUTPUT");
    if (!Number.isInteger(offset) || offset < 0 || offset > output.length - 2) fail("INVALID_OUTPUT");
    if (!writableSlot(output, offset) || !writableSlot(output, offset + 1)) fail("INVALID_OUTPUT");
    const at = this.#offsets[p] + c;
    output[offset] = this.#x[at];
    output[offset + 1] = this.#y[at];
    return output;
  }
  completionReasonAt(path) { return this.#reasons[this.#pathIndex(path)]; }
  randomState() { return this.#randomState.slice(); }

  toValues() {
    const paths = [];
    for (let p = 0; p < this.#reasons.length; p += 1) {
      const path = [];
      for (let i = this.#offsets[p]; i < this.#offsets[p + 1]; i += 1) path.push([this.#x[i], this.#y[i]]);
      paths.push(path);
    }
    return { paths, completionReasons: this.#reasons.slice(), randomState: this.#randomState.slice() };
  }
}

/**
 * Generate ordered retained cardinal cell paths whose cells are claimed by one
 * call-local occupancy set. Implements path.occupied-lattice-paths-2d 0.1.0
 * independently of source code. Motivating sketch: survey/out/2019/generativos/tata;
 * no artistic dimensions/starts/step range is established, see the catalog contract
 * for evidence.
 */
export function occupiedLatticePaths2D(config) {
  const record = passiveRecord(config, ["dimensions", "starts", "maxSteps", "maxCells", "random"]);
  const dimensions = pair(recordValue(record, "dimensions"));
  const columns = boundedInt(arrayItem(dimensions, 0), 1, 2147483647);
  const rows = boundedInt(arrayItem(dimensions, 1), 1, 2147483647);
  const starts = passiveArray(recordValue(record, "starts"));
  if (starts.length > MAX_CELLS) fail("INVALID_INPUT");
  for (let i = 0; i < starts.length; i += 1) {
    const start = pair(arrayItem(starts, i));
    const sx = integral(arrayItem(start, 0));
    if (sx < 0 || sx >= columns) fail("INVALID_INPUT");
    const sy = integral(arrayItem(start, 1));
    if (sy < 0 || sy >= rows) fail("INVALID_INPUT");
  }
  const maxSteps = boundedInt(recordValue(record, "maxSteps"), 0, MAX_STEPS);
  const maxCells = boundedInt(recordValue(record, "maxCells"), 0, MAX_CELLS);
  const random = readRandom(recordValue(record, "random"));
  const potential = BigInt(starts.length) * (BigInt(maxSteps) + 1n);
  if (potential > BigInt(maxCells)) throw new LatticeError("WORK_LIMIT_EXCEEDED");

  const startX = new Array(starts.length), startY = new Array(starts.length);
  for (let i = 0; i < starts.length; i += 1) {
    const start = pair(arrayItem(starts, i));
    startX[i] = arrayItem(start, 0);
    startY[i] = arrayItem(start, 1);
  }

  const stream = new Xoshiro(random.seed, random.state);
  const outX = [], outY = [], offsets = [0], reasons = [];
  const occupied = new Set();
  const key = (x, y) => x + "," + y;

  for (let path = 0; path < starts.length; path += 1) {
    let currentX = startX[path], currentY = startY[path];
    if (occupied.has(key(currentX, currentY))) {
      offsets.push(outX.length);
      reasons.push("occupied-start");
      continue;
    }
    occupied.add(key(currentX, currentY));
    outX.push(currentX); outY.push(currentY);
    if (maxSteps === 0) {
      offsets.push(outX.length);
      reasons.push("step-limit");
      continue;
    }
    let moved = 0;
    let reason = null;
    while (moved < maxSteps) {
      const candidates = [];
      if (currentY > 0 && !occupied.has(key(currentX, currentY - 1))) candidates.push([currentX, currentY - 1]);
      if (currentX + 1 < columns && !occupied.has(key(currentX + 1, currentY))) candidates.push([currentX + 1, currentY]);
      if (currentY + 1 < rows && !occupied.has(key(currentX, currentY + 1))) candidates.push([currentX, currentY + 1]);
      if (currentX > 0 && !occupied.has(key(currentX - 1, currentY))) candidates.push([currentX - 1, currentY]);
      if (candidates.length === 0) { reason = "blocked"; break; }
      const chosen = stream.choose(candidates.length);
      [currentX, currentY] = candidates[chosen];
      occupied.add(key(currentX, currentY));
      outX.push(currentX); outY.push(currentY);
      moved += 1;
      if (moved === maxSteps) reason = "step-limit";
    }
    offsets.push(outX.length);
    reasons.push(reason);
  }
  return new LatticePaths(outX, outY, offsets, reasons, stream.state());
}
