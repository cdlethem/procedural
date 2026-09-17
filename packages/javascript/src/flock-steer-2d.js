import { fdlibmHypot } from "./internal/fdlibm-hypot.js";
import { computed, inputNumber, itemAt, passiveArray, passiveRecord, positiveZero, safeInteger, valueAt } from "./internal/agent-behavior-utils.js";

const KEYS = ["points", "velocities", "pairs", "cohesion", "alignment", "separation", "maxSteer", "maxWork"];
export class FlockSteer2DError extends Error { constructor(code) { super(code); this.name = "FlockSteer2DError"; this.code = code; } }
function input(value) { return inputNumber(value, FlockSteer2DError); } function checked(value) { return computed(value, FlockSteer2DError); }
function nonnegative(value) { const result = input(value); if (result < 0) throw new FlockSteer2DError("INVALID_INPUT"); return result; }
function vectors(value, count) { const source = passiveArray(value, FlockSteer2DError, count), output = new Array(count * 2); for (let i = 0; i < count; i += 1) { const pair = passiveArray(itemAt(source, i), FlockSteer2DError, 2); output[i * 2] = input(itemAt(pair, 0)); output[i * 2 + 1] = input(itemAt(pair, 1)); } return output; }
function pairs(value, count) { const source = passiveArray(value, FlockSteer2DError), result = new Array(source.length * 2); let beforeI = -1, beforeJ = -1; for (let i = 0; i < source.length; i += 1) { const pair = passiveArray(itemAt(source, i), FlockSteer2DError, 2); const left = safeInteger(itemAt(pair, 0), FlockSteer2DError, 0), right = safeInteger(itemAt(pair, 1), FlockSteer2DError, 0); if (left >= right || right >= count || left < beforeI || (left === beforeI && right <= beforeJ)) throw new FlockSteer2DError("INVALID_INPUT"); result[i * 2] = left; result[i * 2 + 1] = right; beforeI = left; beforeJ = right; } return result; }

/** Calculate graph-supplied, synchronous flock steering without integration. */
export function flockSteer2D(inputValue) {
  const record = passiveRecord(inputValue, KEYS, FlockSteer2DError); const suppliedPoints = passiveArray(valueAt(record, "points"), FlockSteer2DError); const count = suppliedPoints.length; const points = vectors(suppliedPoints, count); const velocities = vectors(valueAt(record, "velocities"), count); const edges = pairs(valueAt(record, "pairs"), count);
  const cohesion = nonnegative(valueAt(record, "cohesion")), alignment = nonnegative(valueAt(record, "alignment")), separation = nonnegative(valueAt(record, "separation")), maxSteer = nonnegative(valueAt(record, "maxSteer")), maxWork = safeInteger(valueAt(record, "maxWork"), FlockSteer2DError, 0);
  const work = count + edges.length / 2; if (!Number.isSafeInteger(work) || work > maxWork) throw new FlockSteer2DError("WORK_LIMIT");
  const posX = new Array(count).fill(0), posY = new Array(count).fill(0), velocityX = new Array(count).fill(0), velocityY = new Array(count).fill(0), totalDegree = new Array(count).fill(0), separationX = new Array(count).fill(0), separationY = new Array(count).fill(0), separationDegree = new Array(count).fill(0);
  for (let offset = 0; offset < edges.length; offset += 2) {
    const i = edges[offset], j = edges[offset + 1], io = i * 2, jo = j * 2;
    posX[i] = checked(posX[i] + points[jo]); posY[i] = checked(posY[i] + points[jo + 1]); velocityX[i] = checked(velocityX[i] + velocities[jo]); velocityY[i] = checked(velocityY[i] + velocities[jo + 1]); totalDegree[i] += 1;
    posX[j] = checked(posX[j] + points[io]); posY[j] = checked(posY[j] + points[io + 1]); velocityX[j] = checked(velocityX[j] + velocities[io]); velocityY[j] = checked(velocityY[j] + velocities[io + 1]); totalDegree[j] += 1;
    const dx = checked(points[io] - points[jo]), dy = checked(points[io + 1] - points[jo + 1]), length = checked(fdlibmHypot(dx, dy));
    if (length > 0) { const ux = checked(dx / length), uy = checked(dy / length); separationX[i] = checked(separationX[i] + ux); separationY[i] = checked(separationY[i] + uy); separationDegree[i] += 1; separationX[j] = checked(separationX[j] - ux); separationY[j] = checked(separationY[j] - uy); separationDegree[j] += 1; }
  }
  const steering = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const offset = i * 2, degree = totalDegree[i]; let cx = 0, cy = 0, ax = 0, ay = 0, sx = 0, sy = 0;
    if (degree > 0) { cx = checked(cohesion * checked(checked(posX[i] / degree) - points[offset])); cy = checked(cohesion * checked(checked(posY[i] / degree) - points[offset + 1])); ax = checked(alignment * checked(checked(velocityX[i] / degree) - velocities[offset])); ay = checked(alignment * checked(checked(velocityY[i] / degree) - velocities[offset + 1])); }
    if (separationDegree[i] > 0) { sx = checked(separation * checked(separationX[i] / separationDegree[i])); sy = checked(separation * checked(separationY[i] / separationDegree[i])); }
    let rawX = checked(cx + ax); rawX = checked(rawX + sx); let rawY = checked(cy + ay); rawY = checked(rawY + sy); const magnitude = checked(fdlibmHypot(rawX, rawY));
    if (magnitude > maxSteer) { const scale = checked(maxSteer / magnitude); rawX = checked(rawX * scale); rawY = checked(rawY * scale); }
    steering[i] = [positiveZero(rawX), positiveZero(rawY)];
  }
  return { steering };
}
