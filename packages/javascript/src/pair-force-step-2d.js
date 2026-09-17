import { fdlibmHypot } from "./internal/fdlibm-hypot.js";

const MAX_POINTS = 2147483647;

/** Error with one of the stable motion.pair-force-step-2d contract codes. */
export class PairForceStep2DError extends Error {
  constructor(code) {
    super(code);
    this.name = "PairForceStep2DError";
    this.code = code;
  }
}

function invalid() { throw new PairForceStep2DError("INVALID_INPUT"); }
function overflow() { throw new PairForceStep2DError("NUMERIC_OVERFLOW"); }
function zero(value) { return value === 0 ? 0 : value; }
function finiteInput(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid();
  return zero(value);
}
function checked(value) { if (!Number.isFinite(value)) overflow(); return zero(value); }
function passiveRecord(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid();
  const prototype = Object.getPrototypeOf(value);
  if ((prototype !== Object.prototype && prototype !== null) || Reflect.ownKeys(value).length !== keys.length) invalid();
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) invalid();
  }
  return value;
}
function passiveArray(value, length = undefined) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > MAX_POINTS
      || (length !== undefined && value.length !== length) || Reflect.ownKeys(value).length !== value.length + 1) invalid();
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor)) invalid();
  }
  return value;
}
function valueAt(record, key) { return Object.getOwnPropertyDescriptor(record, key).value; }
function itemAt(array, index) { return Object.getOwnPropertyDescriptor(array, String(index)).value; }
function nonnegative(value) { const result = finiteInput(value); if (result < 0) invalid(); return result; }
function dampingValue(value) { const result = nonnegative(value); if (result > 1) invalid(); return result; }
function dtValue(value) { const result = finiteInput(value); if (result <= 0) invalid(); return result; }
function workLimit(value) {
  const result = finiteInput(value);
  if (!Number.isSafeInteger(result) || result < 0) invalid();
  return result;
}
function indexValue(value, count) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value >= count) invalid();
  return value;
}
function captureVectors(value, count) {
  const source = passiveArray(value, count);
  const captured = new Array(count * 2);
  for (let index = 0, offset = 0; index < count; index += 1, offset += 2) {
    const pair = passiveArray(itemAt(source, index), 2);
    captured[offset] = finiteInput(itemAt(pair, 0));
    captured[offset + 1] = finiteInput(itemAt(pair, 1));
  }
  return captured;
}
function capturePairs(value, count) {
  const source = passiveArray(value);
  const captured = new Array(source.length * 2);
  let previousLeft = -1, previousRight = -1;
  for (let index = 0, offset = 0; index < source.length; index += 1, offset += 2) {
    const pair = passiveArray(itemAt(source, index), 2);
    const left = indexValue(itemAt(pair, 0), count), right = indexValue(itemAt(pair, 1), count);
    if (left >= right || left < previousLeft || (left === previousLeft && right <= previousRight)) invalid();
    captured[offset] = left; captured[offset + 1] = right;
    previousLeft = left; previousRight = right;
  }
  return captured;
}

/**
 * Advance equal-unit-mass 2D bodies synchronously under supplied reciprocal pairs.
 * Implements motion.pair-force-step-2d 0.1.0.
 */
export function pairForceStep2D(input) {
  const record = passiveRecord(input, ["points", "velocities", "pairs", "attraction", "repulsion", "repulsionRadius", "damping", "dt", "maxSpeed", "maxWork"]);
  const suppliedPoints = passiveArray(valueAt(record, "points"));
  const count = suppliedPoints.length;
  const points = captureVectors(suppliedPoints, count);
  const velocities = captureVectors(valueAt(record, "velocities"), count);
  const pairs = capturePairs(valueAt(record, "pairs"), count);
  const attraction = nonnegative(valueAt(record, "attraction"));
  const repulsion = nonnegative(valueAt(record, "repulsion"));
  const repulsionRadius = nonnegative(valueAt(record, "repulsionRadius"));
  const damping = dampingValue(valueAt(record, "damping"));
  const dt = dtValue(valueAt(record, "dt"));
  const maxSpeed = nonnegative(valueAt(record, "maxSpeed"));
  const maxWork = workLimit(valueAt(record, "maxWork"));
  const pairCount = pairs.length / 2;
  if (count + pairCount > maxWork) throw new PairForceStep2DError("WORK_LIMIT");

  const forces = new Array(count * 2).fill(0);
  for (let pairOffset = 0; pairOffset < pairs.length; pairOffset += 2) {
    const left = pairs[pairOffset], right = pairs[pairOffset + 1];
    const leftOffset = left * 2, rightOffset = right * 2;
    const dx = checked(points[rightOffset] - points[leftOffset]);
    const dy = checked(points[rightOffset + 1] - points[leftOffset + 1]);
    const length = checked(fdlibmHypot(dx, dy));
    let fx = checked(attraction * dx);
    let fy = checked(attraction * dy);
    if (length > 0 && length < repulsionRadius) {
      const ratio = checked(length / repulsionRadius);
      const falloff = checked(1 - ratio);
      const strength = checked(repulsion * falloff);
      const ux = checked(dx / length);
      const uy = checked(dy / length);
      const rx = checked(strength * ux);
      const ry = checked(strength * uy);
      fx = checked(fx - rx);
      fy = checked(fy - ry);
    }
    forces[leftOffset] = checked(forces[leftOffset] + fx);
    forces[leftOffset + 1] = checked(forces[leftOffset + 1] + fy);
    forces[rightOffset] = checked(forces[rightOffset] - fx);
    forces[rightOffset + 1] = checked(forces[rightOffset + 1] - fy);
  }

  const nextPoints = new Array(count * 2);
  const nextVelocities = new Array(count * 2);
  for (let index = 0, offset = 0; index < count; index += 1, offset += 2) {
    const impulseX = checked(dt * forces[offset]);
    let vx = checked(velocities[offset] + impulseX);
    vx = checked(vx * damping);
    const impulseY = checked(dt * forces[offset + 1]);
    let vy = checked(velocities[offset + 1] + impulseY);
    vy = checked(vy * damping);
    const speed = checked(fdlibmHypot(vx, vy));
    if (speed > maxSpeed) {
      const scale = checked(maxSpeed / speed);
      vx = checked(vx * scale);
      vy = checked(vy * scale);
    }
    nextVelocities[offset] = zero(vx);
    nextVelocities[offset + 1] = zero(vy);
    nextPoints[offset] = zero(checked(points[offset] + checked(dt * vx)));
    nextPoints[offset + 1] = zero(checked(points[offset + 1] + checked(dt * vy)));
  }
  const outputForces = new Array(count);
  const outputPoints = new Array(count);
  const outputVelocities = new Array(count);
  for (let index = 0, offset = 0; index < count; index += 1, offset += 2) {
    outputPoints[index] = [zero(nextPoints[offset]), zero(nextPoints[offset + 1])];
    outputVelocities[index] = [zero(nextVelocities[offset]), zero(nextVelocities[offset + 1])];
    outputForces[index] = [zero(forces[offset]), zero(forces[offset + 1])];
  }
  return { points: outputPoints, velocities: outputVelocities, forces: outputForces };
}
