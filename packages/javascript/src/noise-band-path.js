import { gradientNoise2D01 } from "./gradient-noise-2d-01.js";
import { fdlibmSin, fdlibmCos } from "./fdlibm-trig.js";

const HALF_PI = Math.PI / 2; // exactly 0x1.921fb54442d18p0 (halving is exact)
const UINT32_MAX = 4294967295;
const INT32_MAX = 2147483647;
const MAX_VERTICES = 1073741823;
const MAX_SAFE = 9007199254740991;
const KEYS = ["field", "start", "heading", "seed", "attempts", "stepDistance",
  "fieldScale", "fieldOffset", "tolerance", "maxVertices"];

/** Error with one of the stable path.noise-band-trace-2d contract codes. */
export class NoiseBandPathError extends Error {
  constructor(code, attemptIndex = null, stage = null) {
    super(code);
    this.name = "NoiseBandPathError";
    this.code = code;
    if (code === "TRACE_ARITHMETIC_INVALID" || code === "TRACE_QUERY_INVALID" || code === "VERTEX_LIMIT_EXCEEDED") {
      this.attemptIndex = attemptIndex;
      this.stage = stage;
    }
  }
}

function fail(code) { throw new NoiseBandPathError(code); }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function zero(value) { return value === 0 ? 0 : value; }
function num(value) { if (!finite(value)) fail("INVALID_INPUT"); return value; }
function uint(value) {
  const n = num(value);
  if (n < 0 || n > UINT32_MAX || n !== Math.floor(n)) fail("INVALID_INPUT");
  return n;
}
function integer(value, lo, hi) {
  const n = num(value);
  if (n < lo || n > hi || n !== Math.floor(n)) fail("INVALID_INPUT");
  return n;
}
function nonnegative(value) {
  const n = num(value);
  if (n < 0) fail("INVALID_INPUT");
  return n;
}

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
function passiveArray(value, length) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail("INVALID_INPUT");
  if (length !== undefined && value.length !== length) fail("INVALID_INPUT");
  return value;
}
function arrayItem(array, index) {
  const descriptor = Object.getOwnPropertyDescriptor(array, String(index));
  if (descriptor === undefined || !("value" in descriptor)) fail("INVALID_INPUT");
  return descriptor.value;
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
function pair(value) {
  const array = passiveArray(value, 2);
  return [zero(num(arrayItem(array, 0))), zero(num(arrayItem(array, 1)))];
}

function arith(value, attemptIndex, stage) {
  if (!Number.isFinite(value)) throw new NoiseBandPathError("TRACE_ARITHMETIC_INVALID", attemptIndex, stage);
  return value;
}
/** Q(x,y,prefix): field query with strict per-axis multiply-then-add domain checks. */
function query(field, x, y, scale, offsetX, offsetY, attemptIndex, prefix) {
  let qx = x * scale;
  if (!Number.isFinite(qx)) throw new NoiseBandPathError("TRACE_QUERY_INVALID", attemptIndex, prefix + "_x");
  qx = qx + offsetX;
  if (!Number.isFinite(qx) || qx < -MAX_SAFE || qx >= MAX_SAFE) {
    throw new NoiseBandPathError("TRACE_QUERY_INVALID", attemptIndex, prefix + "_x");
  }
  let qy = y * scale;
  if (!Number.isFinite(qy)) throw new NoiseBandPathError("TRACE_QUERY_INVALID", attemptIndex, prefix + "_y");
  qy = qy + offsetY;
  if (!Number.isFinite(qy) || qy < -MAX_SAFE || qy >= MAX_SAFE) {
    throw new NoiseBandPathError("TRACE_QUERY_INVALID", attemptIndex, prefix + "_y");
  }
  return field.sample(qx, qy);
}

// Private xoshiro128**1.1 stream with two SplitMix64 expansion words; same
// algorithm as design/operations/noise-band-path-contract.md's frozen RNG.
class Xoshiro {
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

function serializable(value) {
  if (Array.isArray(value)) return value.map(serializable);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value)) out[key] = serializable(value[key]);
    return out;
  }
  return value;
}

class Path {
  #positions; #headings; #attempts; #accepted; #rejected; #config;
  constructor(positions, headings, attempts, accepted, rejected, config) {
    this.#positions = positions;
    this.#headings = headings;
    this.#attempts = attempts;
    this.#accepted = accepted;
    this.#rejected = rejected;
    this.#config = config;
    Object.freeze(this);
  }
  get size() { return this.#positions.length / 2; }
  get attempts() { return this.#attempts; }
  get accepted() { return this.#accepted; }
  get rejected() { return this.#rejected; }

  #checked(index, headings) {
    if (typeof index !== "number" || !Number.isFinite(index) || index < 0
        || index !== Math.floor(index) || index > MAX_SAFE) fail("INVALID_INDEX");
    if (index >= (headings ? this.#accepted : this.size)) fail("INDEX_OUT_OF_RANGE");
    return index;
  }
  pointAt(index) {
    const i = this.#checked(index, false);
    return [this.#positions[2 * i], this.#positions[2 * i + 1]];
  }
  pointInto(index, output, offset = 0) {
    const i = this.#checked(index, false);
    if (!Array.isArray(output) && !(output instanceof Float64Array)) fail("INVALID_OUTPUT");
    if (!Number.isInteger(offset) || offset < 0 || offset > output.length - 2) fail("INVALID_OUTPUT");
    if (!writableSlot(output, offset) || !writableSlot(output, offset + 1)) fail("INVALID_OUTPUT");
    output[offset] = this.#positions[2 * i];
    output[offset + 1] = this.#positions[2 * i + 1];
    return output;
  }
  headingAt(index) {
    const i = this.#checked(index, true);
    return this.#headings[i];
  }
  serialize() { return serializable(this.#config); }
  toValues() {
    const positions = [];
    for (let i = 0; i < this.size; i += 1) positions.push([this.#positions[2 * i], this.#positions[2 * i + 1]]);
    return {
      positions,
      headings: this.#headings.slice(),
      attempts: this.#attempts,
      accepted: this.#accepted,
      rejected: this.#rejected,
    };
  }
}

/**
 * Retain an attempt-bounded connected path whose accepted proposals remain within
 * a strict scalar band around the starting noise value. Implements
 * path.noise-band-trace-2d 0.1.0 independently of source code. Motivating sketch:
 * survey/out/2018/Generativos/venas; no artistic attempts/tolerance/scale range is
 * established, see the catalog contract for evidence. Uses a bit-exact ported
 * fdlibm5.3 sin/cos (verified against java.lang.StrictMath.sin/cos), not host Math.
 */
export function noiseBandPath2D(input) {
  const record = passiveRecord(input, KEYS);
  const fieldConfig = passiveRecord(recordValue(record, "field"), ["seed"]);
  const fieldSeed = uint(recordValue(fieldConfig, "seed"));
  const [startX0, startY0] = pair(recordValue(record, "start"));
  let heading = zero(num(recordValue(record, "heading")));
  const seed = uint(recordValue(record, "seed"));
  const tries = integer(recordValue(record, "attempts"), 0, INT32_MAX);
  const distance = zero(nonnegative(recordValue(record, "stepDistance")));
  const scale = zero(num(recordValue(record, "fieldScale")));
  const [offsetX, offsetY] = pair(recordValue(record, "fieldOffset"));
  const tolerance = zero(nonnegative(recordValue(record, "tolerance")));
  const maximum = integer(recordValue(record, "maxVertices"), 1, MAX_VERTICES);
  const startX = zero(startX0), startY = zero(startY0);

  const field = gradientNoise2D01({ seed: fieldSeed });
  const configuration = {
    field: field.serialize(), start: [startX, startY], heading, seed, attempts: tries,
    stepDistance: distance, fieldScale: scale, fieldOffset: [offsetX, offsetY],
    tolerance, maxVertices: maximum,
  };

  let points = [startX, startY];
  let directions = [];
  if (tries === 0) return new Path(points, directions, 0, 0, 0, configuration);

  const level = query(field, startX, startY, scale, offsetX, offsetY, -1, "start_query");
  const random = new Xoshiro(seed);
  let x = startX, y = startY;
  let accepted = 0, rejected = 0;

  for (let attempt = 0; attempt < tries; attempt += 1) {
    const low = (-HALF_PI) * random.unit();
    const high = HALF_PI * random.unit();
    const span = high - low;
    const delta = span * random.unit();
    const turn = low + delta;
    const proposal = arith(heading + turn, attempt, "proposal_heading");
    const dx = arith(distance * fdlibmCos(proposal), attempt, "delta_x");
    let nextX = arith(x + dx, attempt, "position_x");
    const dy = arith(distance * fdlibmSin(proposal), attempt, "delta_y");
    let nextY = arith(y + dy, attempt, "position_y");
    const value = query(field, nextX, nextY, scale, offsetX, offsetY, attempt, "candidate_query");
    const driftProduct = 0.2 * random.unit();
    const drift = -0.1 + driftProduct;
    const rejectionHeading = arith(heading + drift, attempt, "rejection_heading");
    const difference = value - level;
    const bandError = Math.abs(difference);
    if (bandError < tolerance) {
      if (accepted + 1 === maximum) throw new NoiseBandPathError("VERTEX_LIMIT_EXCEEDED", attempt, "append");
      nextX = zero(nextX);
      nextY = zero(nextY);
      const canonicalProposal = zero(proposal);
      points.push(nextX, nextY);
      directions.push(canonicalProposal);
      x = nextX; y = nextY; heading = canonicalProposal;
      accepted += 1;
    } else {
      heading = zero(rejectionHeading);
      rejected += 1;
    }
  }
  return new Path(points, directions, tries, accepted, rejected, configuration);
}
