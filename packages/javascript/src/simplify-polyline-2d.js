import { computed, fail, passiveRecord, readPoints, safeWork, checkedProduct, valueAt, point } from "./internal/geometry-a-utils.js";
const KEYS = ["points", "tolerance", "maxWork"];
function distanceToSegment(p, a, b) {
  const dx = computed(b[0] - a[0]), dy = computed(b[1] - a[1]);
  const length = computed(Math.hypot(dx, dy));
  if (length === 0) return computed(Math.hypot(computed(p[0] - a[0]), computed(p[1] - a[1])));
  const ux = computed(dx / length), uy = computed(dy / length);
  const projection = computed(computed(computed(p[0] - a[0]) * ux) + computed(computed(p[1] - a[1]) * uy));
  const clamped = projection < 0 ? 0 : projection > length ? length : projection;
  const factor = computed(clamped / length);
  const x = computed(a[0] + computed(factor * dx)), y = computed(a[1] + computed(factor * dy));
  return computed(Math.hypot(computed(p[0] - x), computed(p[1] - y)));
}
/** Deterministically simplify an open polyline. */
export function simplifyPolyline2D(input) {
  passiveRecord(input, KEYS); const source = readPoints(valueAt(input, "points"), 1);
  const tolerance = valueAt(input, "tolerance"), maxWork = safeWork(valueAt(input, "maxWork"));
  if (typeof tolerance !== "number" || !Number.isFinite(tolerance) || tolerance < 0) fail("INVALID_INPUT");
  if (checkedProduct(source.length, source.length) > maxWork) fail("WORK_LIMIT");
  if (source.length === 1) return { points: [point(source[0][0], source[0][1])], sourceIndices: [0] };
  const kept = [0]; const stack = [[0, source.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop(); let greatest = -1, index = -1;
    for (let i = start + 1; i < end; i += 1) { const d = distanceToSegment(source[i], source[start], source[end]); if (d > greatest) { greatest = d; index = i; } }
    if (greatest > tolerance) { stack.push([index, end]); stack.push([start, index]); } else kept.push(end);
  }
  kept.sort((a, b) => a - b);
  return { points: kept.map((i) => point(source[i][0], source[i][1])), sourceIndices: kept };
}
