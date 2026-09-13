import { computed, fail, passiveRecord, readPoints, safeWork, checkedProduct, checkedSum, valueAt, point } from "./internal/geometry-a-utils.js";
const KEYS = ["points", "closed", "iterations", "maxWork"];

/** Refine an explicit polyline by fixed Chaikin cuts. */
export function chaikinPolyline2D(input) {
  passiveRecord(input, KEYS);
  const source = readPoints(valueAt(input, "points"), 2);
  const closed = valueAt(input, "closed");
  const iterations = valueAt(input, "iterations"); const maxWork = safeWork(valueAt(input, "maxWork"));
  if (typeof closed !== "boolean" || !Number.isSafeInteger(iterations) || iterations < 0 || iterations > 4294967295) fail("INVALID_INPUT");
  let count = source.length, total = count;
  for (let pass = 0; pass < iterations; pass += 1) { count = checkedProduct(count, 2); total = checkedSum(total, count); }
  if (total > maxWork) fail("WORK_LIMIT");
  let current = source;
  for (let pass = 0; pass < iterations; pass += 1) {
    const next = new Array(current.length * 2); let out = 0;
    if (!closed) next[out++] = point(current[0][0], current[0][1]);
    const edgeCount = closed ? current.length : current.length - 1;
    for (let i = 0; i < edgeCount; i += 1) {
      const a = current[i], b = current[(i + 1) % current.length];
      const qx = computed(computed(.75 * a[0]) + computed(.25 * b[0]));
      const qy = computed(computed(.75 * a[1]) + computed(.25 * b[1]));
      const rx = computed(computed(.25 * a[0]) + computed(.75 * b[0]));
      const ry = computed(computed(.25 * a[1]) + computed(.75 * b[1]));
      next[out++] = point(qx, qy); next[out++] = point(rx, ry);
    }
    if (!closed) next[out++] = point(current[current.length - 1][0], current[current.length - 1][1]);
    current = next;
  }
  return { points: current.map((p) => point(p[0], p[1])) };
}
