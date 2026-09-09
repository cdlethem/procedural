const MAX_SAFE = 9007199254740991;

/** Stable contract failure with no partially published result. */
export class DiscProjectionError extends Error {
  constructor(code) {
    super(code);
    this.name = "DiscProjectionError";
    this.code = code;
  }
}

function invalid() { throw new DiscProjectionError("INVALID_INPUT"); }
function error(code) { throw new DiscProjectionError(code); }

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function isPlainArray(value) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
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

function positiveZero(value) { return value === 0 ? 0 : value; }

function numberValue(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid();
  return value;
}

function checkStrength(strength) {
  if (typeof strength !== "number" || !Number.isFinite(strength)) invalid();
  if (strength < 0 || strength > 1) invalid();
}

function rows(input, stride) {
  if (!isPlainArray(input)) invalid();
  if (input.length > Math.floor(2147483647 / stride)) invalid();
  const output = new Array(input.length * stride);
  let index = 0;
  for (const item of input) {
    if (!isPlainArray(item) || item.length !== stride) invalid();
    let column = 0;
    for (const value of item) {
      const n = numberValue(value);
      if (stride === 3 && column === 2 && n <= 0) invalid();
      output[index++] = n;
      column += 1;
    }
  }
  return output;
}

function checkKeys(record, keys) {
  if (!isPlainObject(record)) invalid();
  if (Reflect.ownKeys(record).length !== keys.length) invalid();
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(record, key)) invalid();
}

function calculate(points, discs, strength, maxTests) {
  const tests = (points.length / 2) * (discs.length / 3);
  if (tests > maxTests) error("WORK_LIMIT");
  const output = new Array(points.length);
  for (let i = 0; i < points.length; i += 2) {
    let x = points[i];
    let y = points[i + 1];
    if (strength !== 0) {
      for (let j = 0; j < discs.length; j += 3) {
        const dx = x - discs[j];
        const dy = y - discs[j + 1];
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;
        const hi = Math.max(Math.abs(dx), Math.abs(dy));
        const lo = Math.min(Math.abs(dx), Math.abs(dy));
        let distance = 0;
        if (hi !== 0) {
          const ratio = lo / hi;
          const square = ratio * ratio;
          const root = Math.sqrt(1 + square);
          distance = hi * root;
        }
        const radius = discs[j + 2];
        if (distance >= radius) continue; // Includes infinite distance.
        const ux = distance === 0 ? 1 : dx / distance;
        const uy = distance === 0 ? 0 : dy / distance;
        const gap = radius - distance;
        const movement = strength * gap;
        const moveX = ux * movement;
        const moveY = uy * movement;
        const nextX = x + moveX;
        const nextY = y + moveY;
        if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) error("NUMERIC_OVERFLOW");
        x = nextX;
        y = nextY;
      }
    }
    output[i] = positiveZero(x);
    output[i + 1] = positiveZero(y);
  }
  return new DiscProjection(output);
}

class DiscProjection {
  #coordinates;
  constructor(coordinates) { this.#coordinates = coordinates; Object.freeze(this); }
  get size() { return this.#coordinates.length / 2; }
  points() { return this.#coordinates.slice(); }
  toValues() {
    const rows = new Array(this.size);
    for (let i = 0; i < this.#coordinates.length; i += 2) rows[i / 2] = [this.#coordinates[i], this.#coordinates[i + 1]];
    return { points: rows };
  }
  pointInto(index, target, offset) {
    if (typeof index !== "number" || !Number.isFinite(index) || index < 0 ||
        index !== Math.floor(index) || index > MAX_SAFE) {
      throw new DiscProjectionError("INVALID_INDEX");
    }
    if (index >= this.size) throw new DiscProjectionError("INDEX_OUT_OF_RANGE");
    if ((!isPlainArray(target) && !(target instanceof Float64Array)) ||
        typeof offset !== "number" || !Number.isInteger(offset) || offset < 0 || offset > target.length - 2) {
      throw new DiscProjectionError("INVALID_OUTPUT");
    }
    if (!(target instanceof Float64Array) && (!writableSlot(target, offset) || !writableSlot(target, offset + 1))) {
      throw new DiscProjectionError("INVALID_OUTPUT");
    }
    const start = index * 2;
    target[offset] = this.#coordinates[start];
    target[offset + 1] = this.#coordinates[start + 1];
  }
}

/**
 * Ordered outward point deformation. Implements geometry.sequential-disc-projection-2d
 * 0.1.0. Motivated by survey/out/2019/generativos/colidion/notes.md.
 *
 * Each disc receives the point changed by preceding discs. Exact centers use
 * positiveX; later discs may undo earlier exclusion. This is not collision
 * resolution or clipping. Strength is explicit caller data with no default or
 * recommended artistic range.
 */
export function sequentialDiscProjection2D(input) {
  checkKeys(input, ["points", "discs", "strength", "maxTests"]);
  const points = rows(input.points, 2);
  const discs = rows(input.discs, 3);
  const strength = numberValue(input.strength);
  checkStrength(strength);
  const budget = numberValue(input.maxTests);
  if (budget < 0 || budget > MAX_SAFE || budget !== Math.floor(budget)) invalid();
  return calculate(points, discs, strength, budget);
}
