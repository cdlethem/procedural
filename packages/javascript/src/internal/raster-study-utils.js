export const MAX_ARRAY = 4294967295;
export const MAX_SAFE = Number.MAX_SAFE_INTEGER;

export function passiveRecord(value, keys, ErrorType) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new ErrorType("INVALID_INPUT");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null || Reflect.ownKeys(value).length !== keys.length) throw new ErrorType("INVALID_INPUT");
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) throw new ErrorType("INVALID_INPUT");
  }
  return value;
}

export function passiveArray(value, ErrorType, length) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > MAX_ARRAY || (length !== undefined && value.length !== length) || Reflect.ownKeys(value).length !== value.length + 1) throw new ErrorType("INVALID_INPUT");
  for (let i = 0; i < value.length; i += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !("value" in descriptor)) throw new ErrorType("INVALID_INPUT");
  }
  return value;
}

export function valueAt(record, key, ErrorType) { return Object.getOwnPropertyDescriptor(record, key).value; }
export function number(value, ErrorType) { if (typeof value !== "number" || !Number.isFinite(value)) throw new ErrorType("INVALID_INPUT"); return value === 0 ? 0 : value; }
export function positiveDimension(value, ErrorType) { const n = number(value, ErrorType); if (!Number.isSafeInteger(n) || n < 1 || n > MAX_ARRAY) throw new ErrorType("INVALID_INPUT"); return n; }
export function workLimit(value, ErrorType) { const n = number(value, ErrorType); if (!Number.isSafeInteger(n) || n < 0) throw new ErrorType("INVALID_INPUT"); return n; }
export function checkedProduct(values, ErrorType, code = "WORK_LIMIT") { let result = 1; for (const value of values) { result *= value; if (!Number.isSafeInteger(result)) throw new ErrorType(code); } return result; }
export function checkedWork(value, maxWork, ErrorType) { if (!Number.isSafeInteger(value) || value > maxWork) throw new ErrorType("WORK_LIMIT"); }
