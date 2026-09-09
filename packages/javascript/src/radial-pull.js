import { fdlibmPow } from "./internal/fdlibm-pow.js";

const MAX_COUNT = 536870911;

/** Stable failure code for malformed construction, queries, and arithmetic overflow. */
export class PullError extends Error {
  constructor(code) {
    super(code);
    this.name = "PullError";
    this.code = code;
  }
}

function invalidInput() { throw new PullError("INVALID_INPUT"); }
function invalidQuery() { throw new PullError("INVALID_QUERY"); }
function checked(value) {
  if (!Number.isFinite(value)) throw new PullError("NUMERIC_OVERFLOW");
  return value;
}
function checkedAdd(a, b) { return checked(a + b); }
function checkedSubtract(a, b) { return checked(a - b); }
function checkedMultiply(a, b) { return checked(a * b); }
function checkedDivide(a, b) { return checked(a / b); }
function checkedPow(a, b) { return checked(fdlibmPow(a, b)); }

function positiveZero(value) { return value === 0 ? 0 : value; }

function finiteValue(value, ErrorCtor) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new PullError(ErrorCtor);
  return positiveZero(value);
}

function positive(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) invalidInput();
  return value;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function isPlainArray(value) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
}

// --- fdlibm5.3 StrictMath.hypot, verified bit-exact against the JDK17 reference. ---
// Duplicated per-module per the established convention (see closed-spline.js).
const HYPOT_BUFFER = new ArrayBuffer(8);
const HYPOT_VIEW = new DataView(HYPOT_BUFFER);
function hypotBitsOf(value) { HYPOT_VIEW.setFloat64(0, value, false); return HYPOT_VIEW.getBigUint64(0, false); }
function hypotFromBits(bits) { HYPOT_VIEW.setBigUint64(0, bits & 0xffffffffffffffffn, false); return HYPOT_VIEW.getFloat64(0, false); }
function hi32(value) { return Number(hypotBitsOf(value) >> 32n) | 0; }
function withHi32(value, hi) {
  const low = hypotBitsOf(value) & 0xffffffffn;
  return hypotFromBits((BigInt(hi >>> 0) << 32n) | low);
}
const HYPOT_TWO_MINUS_600 = hypotFromBits(0x1a70000000000000n);
const HYPOT_TWO_PLUS_600 = hypotFromBits(0x6570000000000000n);
const HYPOT_A_THRESHOLD = hypotFromBits(0x5f300000ffffffffn);
const HYPOT_B_THRESHOLD = hypotFromBits(0x20b0000000000000n);
const HYPOT_MIN_NORMAL = hypotFromBits(0x0010000000000000n);
const HYPOT_T1_2_1022 = hypotFromBits(0x7fd0000000000000n);
function powerOfTwoD(n) {
  return hypotFromBits((BigInt(n + 1023) << 52n) & 0x7ff0000000000000n);
}
function hypot(x, y) {
  let a = Math.abs(x), b = Math.abs(y);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    if (a === Infinity || b === Infinity) return Infinity;
    return a + b;
  }
  if (b > a) { const t = a; a = b; b = t; }
  let ha = hi32(a), hb = hi32(b);
  if ((ha - hb) > 0x3c00000) return a + b;
  let k = 0;
  if (a > HYPOT_A_THRESHOLD) {
    a = a * HYPOT_TWO_MINUS_600;
    b = b * HYPOT_TWO_MINUS_600;
    k += 600;
    ha = hi32(a); hb = hi32(b);
  }
  let t1, t2;
  if (b < HYPOT_B_THRESHOLD) {
    if (b < HYPOT_MIN_NORMAL) {
      if (b === 0) return a;
      t1 = HYPOT_T1_2_1022;
      b = b * t1;
      a = a * t1;
      k -= 1022;
    } else {
      a = a * HYPOT_TWO_PLUS_600;
      b = b * HYPOT_TWO_PLUS_600;
      k -= 600;
    }
    ha = hi32(a); hb = hi32(b);
  }
  let w = a - b;
  if (w > b) {
    t1 = withHi32(0, ha);
    t2 = a - t1;
    w = Math.sqrt(t1 * t1 - (b * (-b) - t2 * (a + t1)));
  } else {
    a = a + a;
    const y1 = withHi32(0, hb);
    const y2 = b - y1;
    t1 = withHi32(0, ha + 0x00100000);
    t2 = a - t1;
    w = Math.sqrt(t1 * y1 - (w * (-w) - (t1 * y2 + t2 * b)));
  }
  if (k !== 0) return powerOfTwoD(k) * w;
  return w;
}
// --- end fdlibm hypot ---

class RadialPull {
  #influences; #count;
  constructor(owned, count) {
    this.#influences = owned; this.#count = count;
    Object.freeze(this);
  }
  get influenceCount() { return this.#count; }
  serialize() {
    const rows = new Array(this.#count);
    for (let i = 0; i < this.#count; i += 1) {
      const offset = i * 4;
      rows[i] = [this.#influences[offset], this.#influences[offset + 1], this.#influences[offset + 2], this.#influences[offset + 3]];
    }
    return { influences: rows };
  }
  transform(x, y) {
    if (arguments.length === 1) {
      const query = x;
      if (!isPlainArray(query) || query.length !== 2) invalidQuery();
      const qx = finiteValue(query[0], "INVALID_QUERY");
      const qy = finiteValue(query[1], "INVALID_QUERY");
      const result = [0, 0];
      this.#calculate(qx, qy, result);
      return result;
    }
    const checkedX = finiteValue(x, "INVALID_QUERY");
    const checkedY = finiteValue(y, "INVALID_QUERY");
    const result = [0, 0];
    this.#calculate(checkedX, checkedY, result);
    return { x: result[0], y: result[1] };
  }
  transformInto(x, y, target) {
    const checkedX = finiteValue(x, "INVALID_QUERY");
    const checkedY = finiteValue(y, "INVALID_QUERY");
    if (!isPlainArray(target) || target.length !== 2) invalidQuery();
    this.#calculate(checkedX, checkedY, target);
  }
  #calculate(x, y, result) {
    let sumX = 0.0, sumY = 0.0;
    for (let i = 0; i < this.#count; i += 1) {
      const offset = i * 4;
      const dx = this.#influences[offset] - x;
      const dy = this.#influences[offset + 1] - y;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;
      const distance = hypot(dx, dy);
      const radius = this.#influences[offset + 2];
      if (distance === 0.0 || distance >= radius) continue;
      const ratio = checkedDivide(distance, radius);
      const fraction = checkedPow(ratio, this.#influences[offset + 3]);
      const remaining = checkedSubtract(1.0, fraction);
      const amount = checkedMultiply(radius, remaining);
      const ux = checkedDivide(dx, distance);
      const uy = checkedDivide(dy, distance);
      sumX = checkedAdd(sumX, checkedMultiply(ux, amount));
      sumY = checkedAdd(sumY, checkedMultiply(uy, amount));
    }
    const finalX = checkedAdd(x, sumX);
    const finalY = checkedAdd(y, sumY);
    result[0] = positiveZero(finalX);
    result[1] = positiveZero(finalY);
  }
}

/**
 * Create an immutable ordered radial-displacement field. Implements
 * geometry.radial-pull-2d 0.1.0.
 *
 * Motivated by survey/out/2018/Generativos/curvespace/notes.md, its curvespace
 * computation, the private CP19 radial-warp study, and
 * design/operations/radial-pull-contract.md. Each influence pulls the original
 * query toward its center within its radius; contributions are summed in supplied
 * order. The exact-center contribution is zero and radius endpoints contribute
 * zero. This function performs no rendering, clipping, inversion, topology
 * preservation, or field sampling.
 */
export function radialPull2D(descriptor) {
  if (!isPlainObject(descriptor)) invalidInput();
  if (Reflect.ownKeys(descriptor).length !== 1 || !Object.prototype.hasOwnProperty.call(descriptor, "influences")) invalidInput();
  const raw = descriptor.influences;
  if (!isPlainArray(raw)) invalidInput();
  if (raw.length > MAX_COUNT) invalidInput();
  const owned = new Array(raw.length * 4);
  for (let i = 0; i < raw.length; i += 1) {
    const rowValue = raw[i];
    if (!isPlainArray(rowValue) || rowValue.length !== 4) invalidInput();
    const offset = i * 4;
    owned[offset] = finiteValue(rowValue[0], "INVALID_INPUT");
    owned[offset + 1] = finiteValue(rowValue[1], "INVALID_INPUT");
    owned[offset + 2] = positive(rowValue[2]);
    owned[offset + 3] = positive(rowValue[3]);
  }
  return new RadialPull(owned, raw.length);
}
