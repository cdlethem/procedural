import { cornerHash } from "./internal/noise-hash.js";
// lowbias32 mixer: https://github.com/skeeto/hash-prospector (Unlicense).
// See THIRD_PARTY_NOTICES.md; lattice composition and gradient ordering are project choices.
const MIN_QUERY_COORDINATE = -9_007_199_254_740_991;
const MAX_QUERY_COORDINATE = 9_007_199_254_740_991;
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

/** Error with one of the stable gradient-noise-2d-01 contract codes. */
export class GradientNoise2D01Error extends Error {
  constructor(code) {
    super(code);
    this.name = "GradientNoise2D01Error";
    this.code = code;
  }
}

function fail(code) {
  throw new GradientNoise2D01Error(code);
}

function normalizedZero(value) {
  return value === 0 ? 0 : value;
}

function finiteQueryCoordinate(value) {
  return typeof value === "number" && Number.isFinite(value) &&
    value >= MIN_QUERY_COORDINATE && value < MAX_QUERY_COORDINATE;
}

function dataProperty(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function validateSeed(params) {
  if (params === null || typeof params !== "object" || Array.isArray(params)) {
    fail("INVALID_INPUT");
  }
  const keys = Reflect.ownKeys(params);
  if (keys.length !== 1 || !hasOwn(params, "seed")) {
    fail("INVALID_INPUT");
  }
  const seed = dataProperty(params, "seed");
  if (typeof seed !== "number" || !Number.isFinite(seed) || !Number.isInteger(seed) ||
      seed < 0 || seed > 0xffff_ffff) {
    fail("INVALID_INPUT");
  }
  return normalizedZero(seed);
}

function validateTuple(query) {
  if (!Array.isArray(query) || query.length !== 2 || !hasOwn(query, 0) || !hasOwn(query, 1)) {
    fail("INVALID_QUERY");
  }
  const keys = Reflect.ownKeys(query);
  if (keys.length !== 3 || !keys.includes("length") || !keys.includes("0") || !keys.includes("1")) {
    fail("INVALID_QUERY");
  }
  const x = dataProperty(query, "0");
  const y = dataProperty(query, "1");
  if (!finiteQueryCoordinate(x) || !finiteQueryCoordinate(y)) {
    fail("INVALID_QUERY");
  }
  return [x, y];
}

function validateScalars(x, y) {
  if (!finiteQueryCoordinate(x) || !finiteQueryCoordinate(y)) {
    fail("INVALID_QUERY");
  }
}

function gradientDot(hash, dx, dy) {
  let gx;
  let gy;
  switch (hash & 7) {
    case 0: gx = 1; gy = 0; break;
    case 1: gx = -1; gy = 0; break;
    case 2: gx = 0; gy = 1; break;
    case 3: gx = 0; gy = -1; break;
    case 4: gx = 1; gy = 1; break;
    case 5: gx = -1; gy = 1; break;
    case 6: gx = 1; gy = -1; break;
    default: gx = -1; gy = -1; break;
  }
  const px = gx * dx;
  const py = gy * dy;
  return px + py;
}

function fade(t) {
  const a = t * t;
  const b = a * t;
  const c = 6 * t;
  const d = c - 15;
  const e = t * d;
  const f = e + 10;
  return b * f;
}

function lerp(a, b, t) {
  const difference = b - a;
  const product = t * difference;
  return a + product;
}

/**
 * Create an immutable single-octave 2D portable gradient-noise field.
 *
 * Motivating sketch: 2018/Generativos/pelines. No artistic default or encouraged
 * parameter range is established; seed is explicit and coordinates use lattice units.
 * The field is pure and seed-only. It is independently specified for CP1 rather
 * than a compatibility wrapper around a host noise implementation.
 */
export function gradientNoise2D01(params) {
  const seed = validateSeed(params);

  function sampleScalars(x, y) {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const u = x - i;
    const v = y - j;
    const n00 = gradientDot(cornerHash(seed, i, j), u, v);
    const n10 = gradientDot(cornerHash(seed, i + 1, j), u - 1, v);
    const n01 = gradientDot(cornerHash(seed, i, j + 1), u, v - 1);
    const n11 = gradientDot(cornerHash(seed, i + 1, j + 1), u - 1, v - 1);
    const fx = fade(u);
    const fy = fade(v);
    const bottom = lerp(n00, n10, fx);
    const top = lerp(n01, n11, fx);
    const raw = lerp(bottom, top, fy);
    const scaled = 0.5 * raw;
    let result = 0.5 + scaled;
    if (result < 0) result = 0;
    if (result > 1) result = 1;
    return normalizedZero(result);
  }

  function sample(x, y) {
    if (arguments.length === 1) {
      const query = validateTuple(x);
      return sampleScalars(query[0], query[1]);
    }
    if (arguments.length === 2) {
      validateScalars(x, y);
      return sampleScalars(x, y);
    }
    throw new TypeError("sample expects either [x, y] or x, y");
  }

  function serialize() {
    return { seed };
  }

  const field = { sample, serialize };
  Object.defineProperty(field, "toJSON", { value: serialize });
  return Object.freeze(field);
}
