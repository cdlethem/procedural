export const MAX_ARRAY = 4294967295;
export const MAX_SAFE = Number.MAX_SAFE_INTEGER;

export function positiveZero(value) { return value === 0 ? 0 : value; }

export function passiveRecord(value, keys, ErrorType) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new ErrorType("INVALID_INPUT");
  const prototype = Object.getPrototypeOf(value);
  if ((prototype !== Object.prototype && prototype !== null) || Reflect.ownKeys(value).length !== keys.length) throw new ErrorType("INVALID_INPUT");
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) throw new ErrorType("INVALID_INPUT");
  }
  return value;
}

export function passiveArray(value, ErrorType, length = undefined) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > MAX_ARRAY
    || (length !== undefined && value.length !== length) || Reflect.ownKeys(value).length !== value.length + 1) throw new ErrorType("INVALID_INPUT");
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor)) throw new ErrorType("INVALID_INPUT");
  }
  return value;
}

export function valueAt(record, key) { return Object.getOwnPropertyDescriptor(record, key).value; }
export function itemAt(array, index) { return Object.getOwnPropertyDescriptor(array, String(index)).value; }

export function inputNumber(value, ErrorType) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ErrorType("INVALID_INPUT");
  return positiveZero(value);
}

export function computed(value, ErrorType) {
  if (!Number.isFinite(value)) throw new ErrorType("NUMERIC_OVERFLOW");
  return positiveZero(value);
}

export function safeInteger(value, ErrorType, minimum, maximum = MAX_SAFE) {
  const result = inputNumber(value, ErrorType);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) throw new ErrorType("INVALID_INPUT");
  return result;
}
