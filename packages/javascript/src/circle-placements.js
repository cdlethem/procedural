const MAX_PROPOSALS = 1_073_741_823;
const MAX_SAFE_INTEGER = 9_007_199_254_740_991;
const ORDERED_KEYS = ["centres", "radii", "separationScale"];
const SEEDED_KEYS = ["seed", "attempts", "origin", "extent", "radiusRange", "separationScale"];
const MASK_64 = (1n << 64n) - 1n;

/** Stable errors for the two circle-placement contracts. */
export class CirclePlacementError extends Error {
  constructor(code, candidateIndex = undefined, stage = undefined) {
    super(code);
    this.code = code;
    if (candidateIndex !== undefined) this.candidateIndex = candidateIndex;
    if (stage !== undefined) this.stage = stage;
  }
}

function fail(code) { throw new CirclePlacementError(code); }
function arithmeticFail(candidateIndex, stage) { throw new CirclePlacementError("PLACEMENT_ARITHMETIC_INVALID", candidateIndex, stage); }
function zero(value) { return value === 0 ? 0 : value; }
function finiteNumber(value) { return typeof value === "number" && Number.isFinite(value); }

function passiveRecord(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length) return false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) return false;
  }
  return true;
}

function data(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function passiveArray(value, length) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== length) return false;
  const own = Reflect.ownKeys(value);
  if (own.length !== length + 1 || !own.includes("length")) return false;
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) return false;
  }
  return true;
}

function finitePair(value, positive = false) {
  if (!passiveArray(value, 2)) return null;
  const x = data(value, "0");
  const y = data(value, "1");
  if (!finiteNumber(x) || !finiteNumber(y) || (positive && (!(x > 0) || !(y > 0)))) return null;
  return [zero(x), zero(y)];
}

function safeInteger(value, maximum) {
  return finiteNumber(value) && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function checked(value, candidateIndex, stage, requirePositive = false, rejectUnderflow = false, source = 0) {
  if (!Number.isFinite(value) || (requirePositive && !(value > 0)) || (rejectUnderflow && source !== 0 && value === 0)) {
    arithmeticFail(candidateIndex, stage);
  }
  return value;
}

function writableSlot(array, index) {
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
  if (!safeInteger(offset, MAX_SAFE_INTEGER)) fail("INVALID_OUTPUT");
  if (out instanceof Float64Array) {
    if (out.length < offset + 2) fail("INVALID_OUTPUT");
    return;
  }
  if (!Array.isArray(out) || Object.getPrototypeOf(out) !== Array.prototype || out.length < offset + 2 ||
      !writableSlot(out, offset) || !writableSlot(out, offset + 1)) fail("INVALID_OUTPUT");
}

function validateAccessIndex(index, size) {
  if (!safeInteger(index, MAX_SAFE_INTEGER)) fail("INVALID_INDEX");
  if (index >= size) fail("INDEX_OUT_OF_RANGE");
}

class Storage {
  constructor(maximum) {
    this.maximum = maximum;
    const capacity = Math.min(maximum, 16);
    this.coordinates = new Float64Array(capacity * 2);
    this.radii = new Float64Array(capacity);
    this.indices = new Int32Array(capacity);
    this.size = 0;
  }

  append(x, y, radius, sourceIndex) {
    this.ensure(this.size + 1);
    const base = this.size * 2;
    this.coordinates[base] = zero(x);
    this.coordinates[base + 1] = zero(y);
    this.radii[this.size] = radius;
    this.indices[this.size] = sourceIndex;
    this.size += 1;
  }

  ensure(needed) {
    if (needed <= this.radii.length) return;
    let capacity = this.radii.length;
    while (capacity < needed) {
      const next = capacity + Math.max(capacity, 16);
      capacity = next <= capacity ? this.maximum : Math.min(next, this.maximum);
    }
    const coordinates = new Float64Array(capacity * 2);
    const radii = new Float64Array(capacity);
    const indices = new Int32Array(capacity);
    coordinates.set(this.coordinates.subarray(0, this.size * 2));
    radii.set(this.radii.subarray(0, this.size));
    indices.set(this.indices.subarray(0, this.size));
    this.coordinates = coordinates;
    this.radii = radii;
    this.indices = indices;
  }

  finish(attempts) {
    return new CirclePlacementResult(this.coordinates.slice(0, this.size * 2), this.radii.slice(0, this.size),
      this.indices.slice(0, this.size), attempts);
  }
}

class CirclePlacementResult {
  #coordinates; #radii; #indices; #attempts;

  constructor(coordinates, radii, indices, attempts) {
    this.#coordinates = coordinates;
    this.#radii = radii;
    this.#indices = indices;
    this.#attempts = attempts;
  }

  get size() { return this.#radii.length; }
  get attempts() { return this.#attempts; }

  pointAt(index) {
    validateAccessIndex(index, this.size);
    const base = index * 2;
    return [zero(this.#coordinates[base]), zero(this.#coordinates[base + 1])];
  }

  pointInto(index, out, offset = 0) {
    validateAccessIndex(index, this.size);
    validateOutput(out, offset);
    const base = index * 2;
    out[offset] = zero(this.#coordinates[base]);
    out[offset + 1] = zero(this.#coordinates[base + 1]);
    return out;
  }

  radiusAt(index) { validateAccessIndex(index, this.size); return this.#radii[index]; }
  sourceIndexAt(index) { validateAccessIndex(index, this.size); return this.#indices[index]; }

  toValues() {
    const centres = new Array(this.size);
    const radii = new Array(this.size);
    const sourceIndices = new Array(this.size);
    for (let index = 0; index < this.size; index += 1) {
      const base = index * 2;
      centres[index] = [zero(this.#coordinates[base]), zero(this.#coordinates[base + 1])];
      radii[index] = this.#radii[index];
      sourceIndices[index] = this.#indices[index];
    }
    return { centres, radii, sourceIndices, attempts: this.#attempts };
  }
}

function accept(storage, x, y, radius, sourceIndex, candidateIndex, separationScale) {
  for (let accepted = 0; accepted < storage.size; accepted += 1) {
    const base = accepted * 2;
    const dx = checked(x - storage.coordinates[base], candidateIndex, "difference_x");
    const dy = checked(y - storage.coordinates[base + 1], candidateIndex, "difference_y");
    const squareX = checked(dx * dx, candidateIndex, "square_x", false, true, dx);
    const squareY = checked(dy * dy, candidateIndex, "square_y", false, true, dy);
    const distanceSquared = checked(squareX + squareY, candidateIndex, "distance_squared");
    const radiusSum = checked(radius + storage.radii[accepted], candidateIndex, "radius_sum");
    const threshold = checked(radiusSum * separationScale, candidateIndex, "threshold", true);
    const thresholdSquared = checked(threshold * threshold, candidateIndex, "threshold_squared", false, true, threshold);
    if (distanceSquared < thresholdSquared) return;
  }
  storage.append(x, y, radius, sourceIndex);
}

function orderedInput(config) {
  if (!passiveRecord(config, ORDERED_KEYS)) fail("INVALID_INPUT");
  const centres = data(config, "centres");
  if (!Array.isArray(centres) || Object.getPrototypeOf(centres) !== Array.prototype || !safeInteger(centres.length, MAX_PROPOSALS)) fail("INVALID_INPUT");
  const radii = data(config, "radii");
  if (!Array.isArray(radii) || Object.getPrototypeOf(radii) !== Array.prototype || radii.length !== centres.length) fail("INVALID_INPUT");
  const separationScale = data(config, "separationScale");
  if (!finiteNumber(separationScale) || !(separationScale > 0)) fail("INVALID_INPUT");
  for (let index = 0; index < centres.length; index += 1) {
    const centre = finitePair(centres[index]);
    if (centre === null) fail("INVALID_INPUT");
    const radius = radii[index];
    if (!finiteNumber(radius) || !(radius > 0)) fail("INVALID_INPUT");
  }
  return { centres, radii, separationScale };
}

/** Retains explicit circle proposals in their supplied order. */
export function orderedCircleFilter2D(config) {
  const input = orderedInput(config);
  const storage = new Storage(input.centres.length);
  for (let index = 0; index < input.centres.length; index += 1) {
    const centre = input.centres[index];
    accept(storage, zero(data(centre, "0")), zero(data(centre, "1")), input.radii[index], index, index, input.separationScale);
  }
  return storage.finish(input.centres.length);
}

function seededInput(config) {
  if (!passiveRecord(config, SEEDED_KEYS)) fail("INVALID_INPUT");
  const seed = data(config, "seed");
  if (!safeInteger(seed, 0xffff_ffff)) fail("INVALID_INPUT");
  const attempts = data(config, "attempts");
  if (!safeInteger(attempts, MAX_PROPOSALS)) fail("INVALID_INPUT");
  const origin = finitePair(data(config, "origin"));
  if (origin === null) fail("INVALID_INPUT");
  const extent = finitePair(data(config, "extent"), true);
  if (extent === null) fail("INVALID_INPUT");
  const radiusRange = finitePair(data(config, "radiusRange"), true);
  if (radiusRange === null || radiusRange[0] > radiusRange[1]) fail("INVALID_INPUT");
  const separationScale = data(config, "separationScale");
  if (!finiteNumber(separationScale) || !(separationScale > 0)) fail("INVALID_INPUT");
  return { seed, attempts, origin, extent, radiusRange, separationScale };
}

class Xoshiro128StarStar11 {
  constructor(seed) {
    let state = BigInt(seed) & 0xffff_ffffn;
    state = (state + 0x9e3779b97f4a7c15n) & MASK_64;
    const first = splitMixOutput(state);
    state = (state + 0x9e3779b97f4a7c15n) & MASK_64;
    const second = splitMixOutput(state);
    this.s0 = Number(first & 0xffff_ffffn) >>> 0;
    this.s1 = Number((first >> 32n) & 0xffff_ffffn) >>> 0;
    this.s2 = Number(second & 0xffff_ffffn) >>> 0;
    this.s3 = Number((second >> 32n) & 0xffff_ffffn) >>> 0;
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) throw new Error("unreachable all-zero xoshiro state");
  }

  nextU32() {
    const output = Math.imul(rotl32(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
    const temporary = (this.s1 << 9) >>> 0;
    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ this.s1) >>> 0;
    this.s1 = (this.s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;
    this.s2 = (this.s2 ^ temporary) >>> 0;
    this.s3 = rotl32(this.s3, 11);
    return output;
  }

  unit() { return this.nextU32() / 4_294_967_296; }
}

function splitMixOutput(state) {
  let mixed = state;
  mixed = ((mixed ^ (mixed >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK_64;
  mixed = ((mixed ^ (mixed >> 27n)) * 0x94d049bb133111ebn) & MASK_64;
  return (mixed ^ (mixed >> 31n)) & MASK_64;
}

function rotl32(value, shift) { return ((value << shift) | (value >>> (32 - shift))) >>> 0; }

function mapCandidate(input, ux, uy, u, v, candidateIndex) {
  const px = input.extent[0] * ux;
  const x = checked(px + input.origin[0], candidateIndex, "proposal_x");
  const py = input.extent[1] * uy;
  const y = checked(py + input.origin[1], candidateIndex, "proposal_y");
  const span = input.radiusRange[1] - input.radiusRange[0];
  const first = span * u;
  const second = first * v;
  return { x: zero(x), y: zero(y), radius: input.radiusRange[0] + second };
}

/** Generates ordered candidates from the private portable stream, then uses the shared filter. */
export function seededCirclePlacement2D(config) {
  const input = seededInput(config);
  const storage = new Storage(input.attempts);
  if (input.attempts === 0) return storage.finish(0);
  const stream = new Xoshiro128StarStar11(input.seed);
  for (let index = 0; index < input.attempts; index += 1) {
    const ux = stream.unit();
    const uy = stream.unit();
    const u = stream.unit();
    const v = stream.unit();
    const candidate = mapCandidate(input, ux, uy, u, v, index);
    accept(storage, candidate.x, candidate.y, candidate.radius, index, index, input.separationScale);
  }
  return storage.finish(input.attempts);
}
