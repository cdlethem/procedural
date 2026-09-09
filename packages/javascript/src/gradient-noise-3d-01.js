import { cornerHash, mix32 } from "./internal/noise-hash.js";

// lowbias32 mixer: https://github.com/skeeto/hash-prospector (Unlicense).
// See THIRD_PARTY_NOTICES.md; lattice composition and gradient ordering are project choices.
const MIN_QUERY_COORDINATE = -9_007_199_254_740_991;
const MAX_QUERY_COORDINATE = 9_007_199_254_740_991;
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

// Twelve cube-edge-midpoint gradients, identical to the Java GRADIENTS table.
const GRADIENTS = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

/** Error with one of the stable gradient-noise-3d-01 contract codes. */
export class GradientNoise3D01Error extends Error {
  constructor(code) {
    super(code);
    this.name = "GradientNoise3D01Error";
    this.code = code;
  }
}

function fail(code) {
  throw new GradientNoise3D01Error(code);
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
  if (!Array.isArray(query) || query.length !== 3 || !hasOwn(query, 0) || !hasOwn(query, 1) || !hasOwn(query, 2)) {
    fail("INVALID_QUERY");
  }
  const keys = Reflect.ownKeys(query);
  if (keys.length !== 4 || !keys.includes("length") || !keys.includes("0") || !keys.includes("1") || !keys.includes("2")) {
    fail("INVALID_QUERY");
  }
  const x = dataProperty(query, "0");
  const y = dataProperty(query, "1");
  const z = dataProperty(query, "2");
  if (!finiteQueryCoordinate(x) || !finiteQueryCoordinate(y) || !finiteQueryCoordinate(z)) {
    fail("INVALID_QUERY");
  }
  return [x, y, z];
}

function validateScalars(x, y, z) {
  if (!finiteQueryCoordinate(x) || !finiteQueryCoordinate(y) || !finiteQueryCoordinate(z)) {
    fail("INVALID_QUERY");
  }
}

function dot(seed, i, j, k, x, y, z) {
  const hash = mix32(cornerHash(seed, i, j) ^ k ^ 0xc2b2ae35);
  const g = GRADIENTS[hash % 12];
  const px = g[0] * x, py = g[1] * y, pz = g[2] * z;
  const xy = px + py;
  return xy + pz;
}

function fade(t) {
  const t2 = t * t, t3 = t2 * t, a = 6 * t - 15, b = t * a + 10;
  return t3 * b;
}

function lerp(a, b, t) {
  const delta = b - a, product = t * delta;
  return a + product;
}

/**
 * Create an immutable three-coordinate portable gradient-noise field.
 * Implements field.gradient-noise-3d-01 0.1.0.
 *
 * Motivated by survey/out/2016/Generativos/pelosNoise2/notes.md depth slices and
 * survey/out/2018/Generativos/conitos/notes.md volumetric samples. Independently
 * specified, not Processing noise or a matching z=0 slice of gradient-noise-2d-01.
 * No artistic default or encouraged parameter range is established.
 */
export function gradientNoise3D01(params) {
  const seed = validateSeed(params);

  function sampleScalars(x, y, z) {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
    const u = x - i, v = y - j, w = z - k;
    const um = u - 1, vm = v - 1, wm = w - 1;
    const fx = fade(u), fy = fade(v), fz = fade(w);
    const a = lerp(dot(seed, i, j, k, u, v, w), dot(seed, i + 1, j, k, um, v, w), fx);
    const b = lerp(dot(seed, i, j + 1, k, u, vm, w), dot(seed, i + 1, j + 1, k, um, vm, w), fx);
    const c = lerp(dot(seed, i, j, k + 1, u, v, wm), dot(seed, i + 1, j, k + 1, um, v, wm), fx);
    const d = lerp(dot(seed, i, j + 1, k + 1, u, vm, wm), dot(seed, i + 1, j + 1, k + 1, um, vm, wm), fx);
    const low = lerp(a, b, fy), high = lerp(c, d, fy);
    const raw = lerp(low, high, fz), scaled = 0.5 * raw;
    let result = 0.5 + scaled;
    if (result <= 0) return 0;
    if (result >= 1) return 1;
    return normalizedZero(result);
  }

  function sample(x, y, z) {
    if (arguments.length === 1) {
      const query = validateTuple(x);
      return sampleScalars(query[0], query[1], query[2]);
    }
    if (arguments.length === 3) {
      validateScalars(x, y, z);
      return sampleScalars(x, y, z);
    }
    throw new TypeError("sample expects either [x, y, z] or x, y, z");
  }

  function serialize() {
    return { seed };
  }

  const field = { sample, serialize };
  Object.defineProperty(field, "toJSON", { value: serialize });
  return Object.freeze(field);
}
