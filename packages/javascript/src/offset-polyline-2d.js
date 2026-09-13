import { computed, fail, passiveRecord, readPoints, safeWork, checkedProduct, valueAt, point } from "./internal/geometry-a-utils.js";
const KEYS = ["points", "closed", "distance", "miterLimit", "maxWork"];
function direction(a, b) {
  const dx = computed(b[0] - a[0]), dy = computed(b[1] - a[1]); const length = computed(Math.hypot(dx, dy));
  if (length === 0) fail("INVALID_INPUT");
  return [computed(dx / length), computed(dy / length)];
}
function offset(v, normal, distance) { return point(computed(v[0] + computed(distance * normal[0])), computed(v[1] + computed(distance * normal[1]))); }
/** Offset a route with signed left normals and bounded joins. */
export function offsetPolyline2D(input) {
  passiveRecord(input, KEYS); const source = readPoints(valueAt(input, "points"), 2);
  const closed = valueAt(input, "closed"), distance = valueAt(input, "distance"), limit = valueAt(input, "miterLimit"), maxWork = safeWork(valueAt(input, "maxWork"));
  if (typeof closed !== "boolean" || !Number.isFinite(distance) || !Number.isFinite(limit) || limit < 1 || (closed && source.length < 3)) fail("INVALID_INPUT");
  if (checkedProduct(source.length, 4) > maxWork) fail("WORK_LIMIT");
  const edges = closed ? source.length : source.length - 1, directions = new Array(edges), normals = new Array(edges);
  for (let i = 0; i < edges; i += 1) { directions[i] = direction(source[i], source[(i + 1) % source.length]); normals[i] = [-directions[i][1], directions[i][0]]; }
  const result = [];
  const join = (vertex, incoming, outgoing) => {
    const a = directions[incoming], b = directions[outgoing];
    const cross = computed(computed(a[0] * b[1]) - computed(a[1] * b[0]));
    const dot = computed(computed(a[0] * b[0]) + computed(a[1] * b[1]));
    if (cross === 0 && dot < 0) fail("INVALID_INPUT");
    if (distance === 0) { result.push(point(vertex[0], vertex[1])); return; }
    const before = offset(vertex, normals[incoming], distance), after = offset(vertex, normals[outgoing], distance);
    if (cross === 0) { result.push(before); return; }
    const denominator = cross;
    const deltaX = computed(after[0] - before[0]), deltaY = computed(after[1] - before[1]);
    const t = computed(computed(computed(deltaX * b[1]) - computed(deltaY * b[0])) / denominator);
    const x = computed(before[0] + computed(t * a[0])), y = computed(before[1] + computed(t * a[1]));
    const miterDistance = computed(Math.hypot(computed(x - vertex[0]), computed(y - vertex[1])));
    const bound = computed(Math.abs(distance) * limit);
    if (miterDistance <= bound) result.push(point(x, y)); else { result.push(before); result.push(after); }
  };
  if (!closed) {
    result.push(offset(source[0], normals[0], distance));
    for (let i = 1; i < source.length - 1; i += 1) join(source[i], i - 1, i);
    result.push(offset(source[source.length - 1], normals[normals.length - 1], distance));
  } else for (let i = 0; i < source.length; i += 1) join(source[i], (i + source.length - 1) % source.length, i);
  return { points: result };
}
