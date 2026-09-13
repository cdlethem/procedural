import { cross, computed, fail, passiveRecord, readPoints, safeWork, checkedProduct, checkedSum, valueAt, point } from "./internal/geometry-a-utils.js";
const KEYS = ["points", "maxWork"];
function orientation(a, b, c) { return cross(a, b, c); }
function onSegment(a, b, p) { return orientation(a, b, p) === 0 && p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]); }
function intersects(a, b, c, d) {
  const abC = orientation(a, b, c), abD = orientation(a, b, d), cdA = orientation(c, d, a), cdB = orientation(c, d, b);
  if (abC === 0 && onSegment(a, b, c)) return true; if (abD === 0 && onSegment(a, b, d)) return true;
  if (cdA === 0 && onSegment(c, d, a)) return true; if (cdB === 0 && onSegment(c, d, b)) return true;
  return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0);
}
function inClosedTriangle(p, a, b, c) { const x = orientation(a, b, p), y = orientation(b, c, p), z = orientation(c, a, p); return x >= 0 && y >= 0 && z >= 0; }
/** Triangulate a strict simple polygon with deterministic ear removal. */
export function triangulateSimplePolygon2D(input) {
  passiveRecord(input, KEYS); const source = readPoints(valueAt(input, "points"), 3); const maxWork = safeWork(valueAt(input, "maxWork"));
  const square = checkedProduct(source.length, source.length); if (checkedSum(checkedProduct(square, source.length), square) > maxWork) fail("WORK_LIMIT");
  for (let i = 0; i < source.length; i += 1) for (let j = i + 1; j < source.length; j += 1) if (source[i][0] === source[j][0] && source[i][1] === source[j][1]) fail("INVALID_TOPOLOGY");
  let area = 0; for (let i = 0; i < source.length; i += 1) area = computed(area + computed(computed(source[i][0] * source[(i + 1) % source.length][1]) - computed(source[i][1] * source[(i + 1) % source.length][0])));
  if (area === 0) fail("INVALID_TOPOLOGY");
  for (let i = 0; i < source.length; i += 1) if (orientation(source[(i + source.length - 1) % source.length], source[i], source[(i + 1) % source.length]) === 0) fail("INVALID_TOPOLOGY");
  for (let i = 0; i < source.length; i += 1) for (let j = i + 1; j < source.length; j += 1) {
    if (i === j || (i + 1) % source.length === j || (j + 1) % source.length === i) continue;
    if (intersects(source[i], source[(i + 1) % source.length], source[j], source[(j + 1) % source.length])) fail("INVALID_TOPOLOGY");
  }
  let ring = area > 0 ? Array.from({ length: source.length }, (_, i) => i) : Array.from({ length: source.length }, (_, i) => source.length - 1 - i);
  const triangles = [];
  while (ring.length > 3) {
    let found = false;
    for (let position = 0; position < ring.length; position += 1) {
      const previous = ring[(position + ring.length - 1) % ring.length], current = ring[position], next = ring[(position + 1) % ring.length];
      if (orientation(source[previous], source[current], source[next]) <= 0) continue;
      let contains = false; for (const index of ring) if (index !== previous && index !== current && index !== next && inClosedTriangle(source[index], source[previous], source[current], source[next])) { contains = true; break; }
      if (!contains) { triangles.push([previous, current, next]); ring.splice(position, 1); found = true; break; }
    }
    if (!found) fail("INVALID_TOPOLOGY");
  }
  triangles.push([ring[0], ring[1], ring[2]]);
  return { points: source.map((p) => point(p[0], p[1])), triangles };
}
