export function fail(ErrorType, code) { throw new ErrorType(code); }
export function finite(ErrorType, value) { if (typeof value !== "number" || !Number.isFinite(value)) fail(ErrorType, "INVALID_INPUT"); return value === 0 ? 0 : value; }
export function integer(ErrorType, value, lo, hi) { const n = finite(ErrorType, value); if (!Number.isSafeInteger(n) || n < lo || n > hi) fail(ErrorType, "INVALID_INPUT"); return n; }
export function record(ErrorType, value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) || Reflect.ownKeys(value).length !== keys.length) fail(ErrorType, "INVALID_INPUT");
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(value, key) || !("value" in Object.getOwnPropertyDescriptor(value, key))) fail(ErrorType, "INVALID_INPUT");
  return value;
}
export function at(ErrorType, value, key) { const d = Object.getOwnPropertyDescriptor(value, String(key)); if (d === undefined || !("value" in d)) fail(ErrorType, "INVALID_INPUT"); return d.value; }
export function array(ErrorType, value, length) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 4294967295 || (length !== undefined && value.length !== length) || Reflect.ownKeys(value).length !== value.length + 1) fail(ErrorType, "INVALID_INPUT");
  for (let i = 0; i < value.length; i += 1) at(ErrorType, value, i);
  return value;
}
export function computed(ErrorType, value) { if (!Number.isFinite(value)) fail(ErrorType, "NUMERIC_OVERFLOW"); return value === 0 ? 0 : value; }
export function work(ErrorType, value, max) { if (!Number.isSafeInteger(value) || value > max) fail(ErrorType, "WORK_LIMIT"); return value; }
