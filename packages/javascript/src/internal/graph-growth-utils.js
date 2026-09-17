import { ExactRational } from "./exact-rational.js";

export const MAX_ARRAY = 4294967295;
export const MAX_SAFE = Number.MAX_SAFE_INTEGER;
export const ZERO = ExactRational.ZERO;
export const ONE = ExactRational.ONE;

export function z(value) { return value === 0 ? 0 : value; }
export function fail(ErrorType, code) { throw new ErrorType(code); }
export function num(value, ErrorType) {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(ErrorType, "INVALID_INPUT");
  return z(value);
}
export function calc(value, ErrorType) {
  if (!Number.isFinite(value)) fail(ErrorType, "NUMERIC_OVERFLOW");
  return z(value);
}
export function integer(value, ErrorType, min = 0, max = MAX_SAFE) {
  value = num(value, ErrorType);
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(ErrorType, "INVALID_INPUT");
  return value;
}
export function record(value, keys, ErrorType) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(ErrorType, "INVALID_INPUT");
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string" || !keys.includes(key))) fail(ErrorType, "INVALID_INPUT");
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) fail(ErrorType, "INVALID_INPUT");
  }
  return value;
}
export function array(value, ErrorType, length) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > MAX_ARRAY || (length !== undefined && value.length !== length) ||
      Reflect.ownKeys(value).length !== value.length + 1) fail(ErrorType, "INVALID_INPUT");
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor)) fail(ErrorType, "INVALID_INPUT");
  }
  return value;
}
export function at(value, key) { return Object.getOwnPropertyDescriptor(value, String(key)).value; }
export function point(value, ErrorType) {
  array(value, ErrorType, 2);
  return [num(at(value, 0), ErrorType), num(at(value, 1), ErrorType)];
}
export function R(value) { return ExactRational.of(value); }
export function rationalPoint(pointValue) { return [R(pointValue[0]), R(pointValue[1])]; }
export function cross(ax, ay, bx, by) { return ax.multiply(by).subtract(ay.multiply(bx)); }
export function sub(a, b) { return [a[0].subtract(b[0]), a[1].subtract(b[1])]; }
export function samePoint(a, b) { return a[0].equals(b[0]) && a[1].equals(b[1]); }
export function squared(a, b) {
  const dx = a[0].subtract(b[0]), dy = a[1].subtract(b[1]);
  return dx.multiply(dx).add(dy.multiply(dy));
}

// Closed segments. Collinear contacts return a single exact hit; positive overlaps
// remain distinct from misses and must be classified by the caller.
export function segment(a, b, c, d) {
  const r = sub(b, a), s = sub(d, c), q = sub(c, a);
  const denominator = cross(r[0], r[1], s[0], s[1]);
  if (denominator.signum() === 0) {
    if (cross(q[0], q[1], r[0], r[1]).signum() !== 0) return { kind: "miss" };
    const axis = r[0].signum() === 0 ? 1 : 0;
    const low = c[axis].compareTo(d[axis]) < 0 ? c : d;
    const high = low === c ? d : c;
    const aLow = a[axis].compareTo(b[axis]) < 0 ? a : b;
    const aHigh = aLow === a ? b : a;
    const start = low[axis].compareTo(aLow[axis]) > 0 ? low : aLow;
    const end = high[axis].compareTo(aHigh[axis]) < 0 ? high : aHigh;
    const order = start[axis].compareTo(end[axis]);
    if (order > 0) return { kind: "miss" };
    if (order < 0) return { kind: "overlap" };
    const t = start[axis].subtract(a[axis]).divide(r[axis]);
    const otherAxis = s[0].signum() === 0 ? 1 : 0;
    const u = start[otherAxis].subtract(c[otherAxis]).divide(s[otherAxis]);
    return { kind: "hit", t, u, point: start };
  }
  const t = cross(q[0], q[1], s[0], s[1]).divide(denominator);
  const u = cross(q[0], q[1], r[0], r[1]).divide(denominator);
  if (t.compareTo(ZERO) < 0 || t.compareTo(ONE) > 0 ||
      u.compareTo(ZERO) < 0 || u.compareTo(ONE) > 0) return { kind: "miss" };
  return { kind: "hit", t, u, point: [a[0].add(r[0].multiply(t)), a[1].add(r[1].multiply(t))] };
}
