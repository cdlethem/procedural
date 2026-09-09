import { fdlibmHypot as hypot } from "./internal/fdlibm-hypot.js";

const MAX_CONTROLS = 268435455;
const MAX_PRODUCT = 2147483646;
const KEYS = ["controls", "subdivisions"];
const QUERY_KEYS = ["mode", "value"];

/** Error with one of the stable closed-spline-2d contract codes. */
export class SplineError extends Error {
  constructor(code) { super(code); this.name = "SplineError"; this.code = code; }
}

function fail(code) { throw new SplineError(code); }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function number(value, code) { if (!finite(value)) fail(code); return value === 0 ? 0 : value; }
function positiveZero(value) { return value === 0 ? 0 : value; }
function computed(value, code) { if (!Number.isFinite(value)) fail(code); return value; }
function add(a, b, code) { return computed(a + b, code); }
function sub(a, b, code) { return computed(a - b, code); }
function mul(a, b, code) { return computed(a * b, code); }

function passiveRecord(value, keys, code) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(code);
  if (Reflect.ownKeys(value).length !== keys.length) fail(code);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) fail(code);
  }
  return value;
}
function recordValue(record, key) { return Object.getOwnPropertyDescriptor(record, key).value; }
function passiveArray(value, length, code) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail(code);
  if (length !== undefined && value.length !== length) fail(code);
  return value;
}
function arrayItem(array, index, code) {
  const descriptor = Object.getOwnPropertyDescriptor(array, String(index));
  if (descriptor === undefined || !("value" in descriptor)) fail(code);
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



function bounds(count, resolution) {
  if (count < 3 || count > MAX_CONTROLS || resolution < 1) fail("INVALID_INPUT");
  if (BigInt(count) * BigInt(resolution) > BigInt(MAX_PRODUCT)) fail("INVALID_INPUT");
}
function wrap(value, period) {
  let wrapped = value % period;
  if (wrapped < 0) wrapped = add(wrapped, period, "NUMERIC_OVERFLOW");
  return wrapped === period ? 0 : positiveZero(wrapped);
}

class Spline {
  #controls; #count; #resolution; #a; #b; #c; #d; #cumulative; #length;
  constructor(controls, resolution, a, b, c, d, cumulative, length) {
    this.#controls = controls;
    this.#count = controls.length;
    this.#resolution = resolution;
    this.#a = a; this.#b = b; this.#c = c; this.#d = d;
    this.#cumulative = cumulative;
    this.#length = length;
    Object.freeze(this);
  }
  get length() { return this.#length; }
  get controlCount() { return this.#count; }
  get subdivisions() { return this.#resolution; }

  #position(span, t, axis) {
    const count = this.#count;
    if (t === 1) return this.#controls[(span + 1) % count][axis];
    if (t === 0) return this.#controls[span][axis];
    const k = 2 * span + axis;
    const a = this.#a[k], b = this.#b[k], c = this.#c[k], d = this.#d[k];
    return add(mul(add(mul(add(mul(a, t, "NUMERIC_OVERFLOW"), b, "NUMERIC_OVERFLOW"), t, "NUMERIC_OVERFLOW"),
      c, "NUMERIC_OVERFLOW"), t, "NUMERIC_OVERFLOW"), d, "NUMERIC_OVERFLOW");
  }
  #tangent(span, t, axis) {
    const k = 2 * span + axis;
    const a = this.#a[k], b = this.#b[k], c = this.#c[k];
    if (t === 0) return c;
    return add(mul(add(mul(mul(3, a, "NUMERIC_OVERFLOW"), t, "NUMERIC_OVERFLOW"),
      mul(2, b, "NUMERIC_OVERFLOW"), "NUMERIC_OVERFLOW"), t, "NUMERIC_OVERFLOW"), c, "NUMERIC_OVERFLOW");
  }
  #write(span, t, target) {
    if (t === 1) { span = (span + 1) % this.#count; t = 0; }
    const x = this.#position(span, t, 0), y = this.#position(span, t, 1);
    const tx = this.#tangent(span, t, 0), ty = this.#tangent(span, t, 1);
    target[0] = positiveZero(x); target[1] = positiveZero(y);
    target[2] = positiveZero(tx); target[3] = positiveZero(ty);
  }

  #checkDestination(out) {
    if (!Array.isArray(out) && !(out instanceof Float64Array)) return false;
    if (out.length !== 4) return false;
    for (let k = 0; k < 4; k += 1) if (!writableSlot(out, k)) return false;
    return true;
  }
  static #query(value) { if (!finite(value)) fail("INVALID_QUERY"); }

  sampleParameterInto(value, target) {
    Spline.#query(value);
    if (!this.#checkDestination(target)) fail("INVALID_QUERY");
    const wrapped = wrap(value, this.#count);
    const span = Math.floor(wrapped);
    this.#write(span, wrapped - span, target);
    return target;
  }
  sampleParameter(value) {
    const target = [0, 0, 0, 0];
    this.sampleParameterInto(value, target);
    return { x: target[0], y: target[1], tangentX: target[2], tangentY: target[3] };
  }
  sampleDistanceInto(value, target) {
    Spline.#query(value);
    if (!this.#checkDestination(target)) fail("INVALID_QUERY");
    if (this.#length === 0) { this.#write(0, 0, target); return target; }
    const wrapped = wrap(value, this.#length);
    if (wrapped === 0) { this.#write(0, 0, target); return target; }
    const cumulative = this.#cumulative;
    let lo = 0, hi = cumulative.length - 1;
    while (lo + 1 < hi) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (cumulative[mid] <= wrapped) lo = mid; else hi = mid;
    }
    const numerator = sub(wrapped, cumulative[lo], "NUMERIC_OVERFLOW");
    const denominator = sub(cumulative[lo + 1], cumulative[lo], "NUMERIC_OVERFLOW");
    const u = computed(numerator / denominator, "NUMERIC_OVERFLOW");
    const resolution = this.#resolution;
    const local = computed(add(lo % resolution, u, "NUMERIC_OVERFLOW") / resolution, "NUMERIC_OVERFLOW");
    this.#write(Math.floor(lo / resolution), local, target);
    return target;
  }
  sampleDistance(value) {
    const target = [0, 0, 0, 0];
    this.sampleDistanceInto(value, target);
    return { x: target[0], y: target[1], tangentX: target[2], tangentY: target[3] };
  }
  sample(input) {
    const record = passiveRecord(input, QUERY_KEYS, "INVALID_QUERY");
    const mode = recordValue(record, "mode");
    if (mode !== "parameter" && mode !== "distance") fail("INVALID_QUERY");
    const value = number(recordValue(record, "value"), "INVALID_QUERY");
    const target = [0, 0, 0, 0];
    if (mode === "parameter") this.sampleParameterInto(value, target);
    else this.sampleDistanceInto(value, target);
    return { point: [target[0], target[1]], tangent: [target[2], target[3]] };
  }
  serialize() {
    const controls = [];
    for (const point of this.#controls) controls.push([point[0], point[1]]);
    return { controls, subdivisions: this.#resolution };
  }
}

/**
 * Retain a closed uniform Catmull-Rom spline from explicit planar controls with direct
 * parameter and approximate distance queries. Implements geometry.closed-spline-2d 0.1.0
 * independently of source code. Motivating sketches: survey/out/2018/Generativos/blobs and
 * survey/out/2018/Generativos/databol; no artistic control-count or subdivision range is
 * established, see the catalog contract for evidence. Distance arithmetic uses a ported,
 * bit-exact fdlibm5.3 hypot (verified against java.lang.StrictMath.hypot), not host Math.hypot.
 */
export function closedSpline2D(config) {
  const record = passiveRecord(config, KEYS, "INVALID_INPUT");
  const suppliedControls = recordValue(record, "controls");
  const rows = passiveArray(suppliedControls, undefined, "INVALID_INPUT");
  if (rows.length < 3 || rows.length > MAX_CONTROLS) fail("INVALID_INPUT");
  const rRaw = number(recordValue(record, "subdivisions"), "INVALID_INPUT");
  if (rRaw < 1 || rRaw > MAX_PRODUCT || rRaw !== Math.floor(rRaw)) fail("INVALID_INPUT");
  const resolution = rRaw;
  bounds(rows.length, resolution);

  const count = rows.length;
  const controls = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const row = passiveArray(arrayItem(rows, i, "INVALID_INPUT"), 2, "INVALID_INPUT");
    controls[i] = [number(arrayItem(row, 0, "INVALID_INPUT"), "INVALID_INPUT"),
      number(arrayItem(row, 1, "INVALID_INPUT"), "INVALID_INPUT")];
  }

  const a = new Array(2 * count), b = new Array(2 * count), c = new Array(2 * count), d = new Array(2 * count);
  for (let span = 0; span < count; span += 1) {
    for (let axis = 0; axis < 2; axis += 1) {
      const p0 = controls[(span + count - 1) % count][axis];
      const p1 = controls[span][axis];
      const p2 = controls[(span + 1) % count][axis];
      const p3 = controls[(span + 2) % count][axis];
      const k = 2 * span + axis;
      const code = "NUMERIC_OVERFLOW";
      a[k] = mul(0.5, add(sub(add(-p0, mul(3, p1, code), code), mul(3, p2, code), code), p3, code), code);
      b[k] = mul(0.5, sub(add(sub(mul(2, p0, code), mul(5, p1, code), code), mul(4, p2, code), code), p3, code), code);
      c[k] = mul(0.5, add(-p0, p2, code), code);
      d[k] = p1;
    }
  }

  const cumulative = new Array(count * resolution + 1);
  cumulative[0] = 0;
  let total = 0;
  let index = 0;
  const spline = { a, b, c, d, controls, count };
  for (let span = 0; span < count; span += 1) {
    let previousX = controls[span][0], previousY = controls[span][1];
    for (let step = 1; step <= resolution; step += 1) {
      const t = step / resolution;
      const x = positionRaw(spline, span, t, 0), y = positionRaw(spline, span, t, 1);
      const dx = sub(x, previousX, "NUMERIC_OVERFLOW"), dy = sub(y, previousY, "NUMERIC_OVERFLOW");
      const chord = computed(hypot(dx, dy), "NUMERIC_OVERFLOW");
      total = add(total, chord, "NUMERIC_OVERFLOW");
      index += 1;
      cumulative[index] = total;
      previousX = x; previousY = y;
    }
  }
  const length = positiveZero(total);
  return new Spline(controls, resolution, a, b, c, d, cumulative, length);
}

function positionRaw(spline, span, t, axis) {
  if (t === 1) return spline.controls[(span + 1) % spline.count][axis];
  if (t === 0) return spline.controls[span][axis];
  const k = 2 * span + axis;
  const code = "NUMERIC_OVERFLOW";
  return add(mul(add(mul(add(mul(spline.a[k], t, code), spline.b[k], code), t, code), spline.c[k], code), t, code), spline.d[k], code);
}
