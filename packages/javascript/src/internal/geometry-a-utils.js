export class GeometryAError extends Error {
  constructor(code) { super(code); this.name = "GeometryAError"; this.code = code; }
}

export function fail(code) { throw new GeometryAError(code); }
export function finite(value) { return typeof value === "number" && Number.isFinite(value); }
export function inputNumber(value) { if (!finite(value)) fail("INVALID_INPUT"); return value === 0 ? 0 : value; }
export function computed(value) { if (!Number.isFinite(value)) fail("NUMERIC_OVERFLOW"); return value === 0 ? 0 : value; }
export function passiveRecord(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("INVALID_INPUT");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail("INVALID_INPUT");
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length) fail("INVALID_INPUT");
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) fail("INVALID_INPUT");
  }
}
export function valueAt(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !("value" in descriptor)) fail("INVALID_INPUT");
  return descriptor.value;
}
export function passiveArray(value, length = undefined) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail("INVALID_INPUT");
  if (value.length > 4294967295 || (length !== undefined && value.length !== length)) fail("INVALID_INPUT");
  const own = Reflect.ownKeys(value);
  if (own.length !== value.length + 1) fail("INVALID_INPUT");
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (lengthDescriptor === undefined || !("value" in lengthDescriptor)) fail("INVALID_INPUT");
  for (let i = 0; i < value.length; i += 1) valueAt(value, String(i));
}
export function readPoints(value, minimum) {
  passiveArray(value);
  if (value.length < minimum) fail("INVALID_INPUT");
  const result = new Array(value.length);
  for (let i = 0; i < value.length; i += 1) {
    const point = valueAt(value, String(i)); passiveArray(point, 2);
    result[i] = [inputNumber(valueAt(point, "0")), inputNumber(valueAt(point, "1"))];
  }
  return result;
}
export function safeWork(value) {
  const number = inputNumber(value);
  if (!Number.isSafeInteger(number) || number < 0) fail("INVALID_INPUT");
  return number;
}
export function checkedProduct(a, b) {
  const result = a * b;
  if (!Number.isSafeInteger(result)) fail("WORK_LIMIT");
  return result;
}
export function checkedSum(a, b) {
  const result = a + b;
  if (!Number.isSafeInteger(result)) fail("WORK_LIMIT");
  return result;
}
export function point(x, y) { return [x === 0 ? 0 : x, y === 0 ? 0 : y]; }
export function cross(a, b, c) {
  const abx = computed(b[0] - a[0]), aby = computed(b[1] - a[1]);
  const acx = computed(c[0] - a[0]), acy = computed(c[1] - a[1]);
  return computed(computed(abx * acy) - computed(aby * acx));
}
