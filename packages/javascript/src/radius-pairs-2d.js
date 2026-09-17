import { fdlibmHypot } from "./internal/fdlibm-hypot.js";

const MAX_POINTS = 2147483647;

/** Error with one of the stable spatial.radius-pairs-2d contract codes. */
export class RadiusPairs2DError extends Error {
  constructor(code) {
    super(code);
    this.name = "RadiusPairs2DError";
    this.code = code;
  }
}

function fail(code) { throw new RadiusPairs2DError(code); }
function zero(value) { return value === 0 ? 0 : value; }
function finite(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) fail("INVALID_INPUT");
  return zero(value);
}
function passiveRecord(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("INVALID_INPUT");
  const prototype = Object.getPrototypeOf(value);
  if ((prototype !== Object.prototype && prototype !== null) || Reflect.ownKeys(value).length !== keys.length) fail("INVALID_INPUT");
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) fail("INVALID_INPUT");
  }
  return value;
}
function passiveArray(value, length = undefined) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > MAX_POINTS
      || (length !== undefined && value.length !== length) || Reflect.ownKeys(value).length !== value.length + 1) fail("INVALID_INPUT");
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor)) fail("INVALID_INPUT");
  }
  return value;
}
function valueAt(record, key) { return Object.getOwnPropertyDescriptor(record, key).value; }
function itemAt(array, index) { return Object.getOwnPropertyDescriptor(array, String(index)).value; }
function radiusValue(value) { const result = finite(value); if (result < 0) fail("INVALID_INPUT"); return result; }
function workLimit(value) {
  const result = finite(value);
  if (!Number.isSafeInteger(result) || result < 0) fail("INVALID_INPUT");
  return result;
}

/**
 * Enumerate unordered original point indices within an inclusive Euclidean radius.
 * Implements spatial.radius-pairs-2d 0.1.0 with the contract's sorted-x sweep.
 */
export function radiusPairs2D(input) {
  const record = passiveRecord(input, ["points", "radius", "maxWork"]);
  const source = passiveArray(valueAt(record, "points"));
  const count = source.length;
  const points = new Array(count * 2);

  for (let index = 0, offset = 0; index < count; index += 1, offset += 2) {
    const point = passiveArray(itemAt(source, index), 2);
    points[offset] = finite(itemAt(point, 0));
    points[offset + 1] = finite(itemAt(point, 1));
  }
  const radius = radiusValue(valueAt(record, "radius"));
  const maxWork = workLimit(valueAt(record, "maxWork"));
  if (count > maxWork) fail("WORK_LIMIT");

  const order = new Array(count);
  for (let index = 0; index < count; index += 1) order[index] = index;
  order.sort((left, right) => {
    const lx = points[left * 2], rx = points[right * 2];
    if (lx < rx) return -1;
    if (lx > rx) return 1;
    return left < right ? -1 : left > right ? 1 : 0;
  });

  let work = count;
  const pairs = [];
  for (let position = 0; position < count; position += 1) {
    const left = order[position], leftOffset = left * 2;
    const leftX = points[leftOffset], leftY = points[leftOffset + 1];
    for (let next = position + 1; next < count; next += 1) {
      const right = order[next], rightOffset = right * 2;
      const dx = points[rightOffset] - leftX;
      if (dx > radius) break;
      if (work >= maxWork) fail("WORK_LIMIT");
      work += 1;
      const dy = Math.abs(points[rightOffset + 1] - leftY);
      if (dy > radius) continue;
      let accepted;
      if (radius === 0) accepted = dx === 0 && dy === 0;
      else accepted = fdlibmHypot(dx, dy) <= radius;
      if (accepted) pairs.push(left < right ? [left, right] : [right, left]);
    }
  }
  pairs.sort((left, right) => left[0] !== right[0] ? left[0] - right[0] : left[1] - right[1]);
  return { pairs };
}
