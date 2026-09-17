import { ExactRational } from "./exact-rational.js";

// Small exact-geometry vocabulary shared only by the Region2D operations.  Coordinates
// supplied by callers are binary64 values; ExactRational therefore represents them
// without introducing a tolerance policy.
const ZERO = ExactRational.ZERO;
const ONE = ExactRational.ONE;
export const MAX_SAFE = Number.MAX_SAFE_INTEGER;

export function fail(ErrorType, code) { throw new ErrorType(code); }
export function zero(n) { return n === 0 ? 0 : n; }
export function finite(n, ErrorType) { if (typeof n !== "number" || !Number.isFinite(n)) fail(ErrorType, "INVALID_INPUT"); return zero(n); }
export function integer(n, ErrorType) { n = finite(n, ErrorType); if (n < 0 || n > MAX_SAFE || n !== Math.floor(n)) fail(ErrorType, "INVALID_INPUT"); return n; }

function dataDescriptor(value, key) { const d = Object.getOwnPropertyDescriptor(value, key); return d && Object.prototype.hasOwnProperty.call(d, "value"); }
export function plainRecord(value, keys, ErrorType) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(ErrorType, "INVALID_INPUT");
  const p = Object.getPrototypeOf(value); if (p !== Object.prototype && p !== null) fail(ErrorType, "INVALID_INPUT");
  const own = Reflect.ownKeys(value); if (own.length !== keys.length || own.some((key) => typeof key !== "string" || !keys.includes(key))) fail(ErrorType, "INVALID_INPUT");
  for (const key of keys) if (!dataDescriptor(value, key)) fail(ErrorType, "INVALID_INPUT");
  return value;
}
export function denseArray(value, ErrorType) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail(ErrorType, "INVALID_INPUT");
  const own = Reflect.ownKeys(value); if (own.length !== value.length + 1 || !own.includes("length")) fail(ErrorType, "INVALID_INPUT");
  for (let i = 0; i < value.length; i += 1) if (!dataDescriptor(value, String(i))) fail(ErrorType, "INVALID_INPUT");
  return value;
}
export function pointArray(value, ErrorType) { denseArray(value, ErrorType); if (value.length !== 2) fail(ErrorType, "INVALID_INPUT"); return [finite(value[0], ErrorType), finite(value[1], ErrorType)]; }
export function exactPoint(p) { return { x: ExactRational.of(p[0]), y: ExactRational.of(p[1]) }; }
export function sub(a, b) { return { x: a.x.subtract(b.x), y: a.y.subtract(b.y) }; }
export function add(a, b) { return { x: a.x.add(b.x), y: a.y.add(b.y) }; }
export function scale(a, t) { return { x: a.x.multiply(t), y: a.y.multiply(t) }; }
export function cross(a, b) { return a.x.multiply(b.y).subtract(a.y.multiply(b.x)); }
export function dot(a, b) { return a.x.multiply(b.x).add(a.y.multiply(b.y)); }
export function same(a, b) { return a.x.equals(b.x) && a.y.equals(b.y); }
export function at(a, d, t) { return add(a, scale(d, t)); }
export function inUnit(t) { return t.compareTo(ZERO) >= 0 && t.compareTo(ONE) <= 0; }
export function witness(kind = "NONE", aRing = -1, aEdge = -1, bRing = -1, bEdge = -1, vertex = -1) { return { kind, aRing, aEdge, bRing, bEdge, vertex }; }

function between(n, a, b) { return a.compareTo(b) <= 0 ? n.compareTo(a) >= 0 && n.compareTo(b) <= 0 : n.compareTo(b) >= 0 && n.compareTo(a) <= 0; }
export function onSegment(a, b, p) {
  const d = sub(b, a); if (same(a, b)) return same(a, p);
  if (cross(d, sub(p, a)).signum() !== 0) return false;
  return d.x.signum() !== 0 ? between(p.x, a.x, b.x) : between(p.y, a.y, b.y);
}
// null=no contact; proper flags a crossing rather than an endpoint/overlap contact.
export function segmentContact(a, b, c, d) {
  const ab = sub(b, a), cd = sub(d, c), ac = sub(c, a), den = cross(ab, cd);
  if (den.signum() !== 0) {
    const t = cross(ac, cd).divide(den), u = cross(ac, ab).divide(den);
    if (!inUnit(t) || !inUnit(u)) return null;
    return { crossing: t.compareTo(ZERO) > 0 && t.compareTo(ONE) < 0 && u.compareTo(ZERO) > 0 && u.compareTo(ONE) < 0, t, u };
  }
  if (cross(ac, ab).signum() !== 0) return null;
  if (onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)) return { crossing: false, t: ZERO, u: ZERO };
  return null;
}

function signedArea(ring) { let s = ZERO; for (let i = 0; i < ring.length; i += 1) { const a = ring[i], b = ring[(i + 1) % ring.length]; s = s.add(a.x.multiply(b.y).subtract(a.y.multiply(b.x))); } return s; }
export function locationInRing(ring, p) {
  let inside = false;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (onSegment(a, b, p)) return 0;
    const ay = a.y.compareTo(p.y) > 0, by = b.y.compareTo(p.y) > 0;
    if (ay === by) continue;
    const side = cross(sub(b, a), sub(p, a)).signum();
    if ((b.y.compareTo(a.y) > 0 && side > 0) || (b.y.compareTo(a.y) < 0 && side < 0)) inside = !inside;
  }
  return inside ? 1 : -1;
}
function ringIssue(ring) {
  if (ring.length < 3) return { edge: -1, vertex: -1 };
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (same(a, b)) return { edge: i, vertex: i };
    const previous = ring[(i - 1 + ring.length) % ring.length];
    const incoming = sub(a, previous), outgoing = sub(b, a);
    if (cross(incoming, outgoing).signum() === 0 && dot(incoming, outgoing).signum() < 0) return { edge: i, vertex: i };
    for (let j = i + 1; j < ring.length; j += 1) {
      if (j === i || (j + 1) % ring.length === i || (i + 1) % ring.length === j) continue;
      if (segmentContact(a, b, ring[j], ring[(j + 1) % ring.length])) return { edge: i, vertex: -1 };
    }
  }
  return signedArea(ring).signum() === 0 ? { edge: -1, vertex: -1 } : null;
}
export function captureRegion(value, ErrorType) {
  plainRecord(value, ["outer", "holes"], ErrorType); denseArray(value.outer, ErrorType); denseArray(value.holes, ErrorType);
  const readRing = (raw) => { denseArray(raw, ErrorType); if (raw.length < 3) fail(ErrorType, "INVALID_REGION"); return raw.map((p) => exactPoint(pointArray(p, ErrorType))); };
  const outer = readRing(value.outer), holes = value.holes.map(readRing);
  return { outer, holes, rings: [outer, ...holes], edges: outer.length + holes.reduce((n, ring) => n + ring.length, 0) };
}
export function firstRegionIssue(region) {
  const { outer, holes } = region;
  const outerIssue = ringIssue(outer);
  if (outerIssue) return { ring: 0, ...outerIssue };
  for (let h = 0; h < holes.length; h += 1) {
    const issue = ringIssue(holes[h]);
    if (issue) return { ring: h + 1, ...issue };
  }
  for (let h = 0; h < holes.length; h += 1) {
    if (locationInRing(outer, holes[h][0]) !== 1) return { ring: h + 1, edge: -1, vertex: 0 };
    for (let i = 0; i < outer.length; i += 1) for (let j = 0; j < holes[h].length; j += 1) if (segmentContact(outer[i], outer[(i + 1) % outer.length], holes[h][j], holes[h][(j + 1) % holes[h].length])) return { ring: h + 1, edge: j, vertex: -1 };
    for (let q = 0; q < h; q += 1) {
      if (locationInRing(holes[q], holes[h][0]) !== -1 || locationInRing(holes[h], holes[q][0]) !== -1) return { ring: h + 1, edge: -1, vertex: 0 };
      for (let i = 0; i < holes[q].length; i += 1) for (let j = 0; j < holes[h].length; j += 1) if (segmentContact(holes[q][i], holes[q][(i + 1) % holes[q].length], holes[h][j], holes[h][(j + 1) % holes[h].length])) return { ring: h + 1, edge: j, vertex: -1 };
    }
  }
  return null;
}
export function validateRegion(region, ErrorType) {
  if (firstRegionIssue(region)) fail(ErrorType, "INVALID_REGION");
  return region;
}
export function inputRegion(value, ErrorType) { return validateRegion(captureRegion(value, ErrorType), ErrorType); }
export function filledLocation(region, p) { if (locationInRing(region.outer, p) !== 1) return -1; for (const hole of region.holes) if (locationInRing(hole, p) !== -1) return -1; return 1; }
export function validationWork(region) { const e = BigInt(region.edges), q = BigInt(region.rings.length); return e * e + 8n * e * q + 4n * q * q; }
export function regionWork(a, b) { return validationWork(a) + validationWork(b) + 12n * BigInt(a.edges) * BigInt(b.edges) + BigInt(a.edges + b.edges); }

function closestPoint(p, a, b) {
  const d = sub(b, a), length = dot(d, d); let t;
  if (length.signum() === 0) t = ZERO;
  else { t = dot(sub(p, a), d).divide(length); if (t.compareTo(ZERO) < 0) t = ZERO; else if (t.compareTo(ONE) > 0) t = ONE; }
  const q = at(a, d, t), v = sub(p, q); return { squared: dot(v, v), a: p, b: q };
}
export function compareRegionsDetailed(a, b) {
  for (let ar = 0; ar < a.rings.length; ar += 1) for (let ae = 0; ae < a.rings[ar].length; ae += 1) {
    const x = a.rings[ar][ae], y = a.rings[ar][(ae + 1) % a.rings[ar].length];
    for (let br = 0; br < b.rings.length; br += 1) for (let be = 0; be < b.rings[br].length; be += 1) {
      const c = segmentContact(x, y, b.rings[br][be], b.rings[br][(be + 1) % b.rings[br].length]);
      if (c) return { relation: "INTERSECTS", minimumDistance: null, witness: witness(c.crossing ? "EDGE_CROSSING" : "EDGE_CONTACT", ar, ae, br, be) };
    }
  }
  if (filledLocation(a, b.outer[0]) === 1) return { relation: "INTERSECTS", minimumDistance: null, witness: witness("A_CONTAINS_B") };
  if (filledLocation(b, a.outer[0]) === 1) return { relation: "INTERSECTS", minimumDistance: null, witness: witness("B_CONTAINS_A") };
  let best = null;
  for (let ar = 0; ar < a.rings.length; ar += 1) for (let ae = 0; ae < a.rings[ar].length; ae += 1) for (let br = 0; br < b.rings.length; br += 1) for (let be = 0; be < b.rings[br].length; be += 1) {
    const aa = a.rings[ar][ae], ab = a.rings[ar][(ae + 1) % a.rings[ar].length], ba = b.rings[br][be], bb = b.rings[br][(be + 1) % b.rings[br].length];
    for (const candidate of [closestPoint(aa, ba, bb), closestPoint(ab, ba, bb), (() => { const z = closestPoint(ba, aa, ab); return { squared: z.squared, a: z.b, b: z.a }; })(), (() => { const z = closestPoint(bb, aa, ab); return { squared: z.squared, a: z.b, b: z.a }; })()]) {
      if (best === null || candidate.squared.compareTo(best.squared) < 0) best = { ...candidate, ar, ae, br, be };
    }
  }
  const ax = zero(best.a.x.value()), ay = zero(best.a.y.value()), bx = zero(best.b.x.value()), by = zero(best.b.y.value());
  const minimumDistance = zero(Math.hypot(ax - bx, ay - by)); if (!Number.isFinite(minimumDistance)) throw new Error("NUMERIC_OVERFLOW");
  return { relation: "DISJOINT", minimumDistance, witness: witness("MINIMUM_PAIR", best.ar, best.ae, best.br, best.be), squared: best.squared };
}
export function compareRegions(a, b) { const value = compareRegionsDetailed(a, b); return { relation: value.relation, minimumDistance: value.minimumDistance, witness: value.witness }; }

export function asNumberPoint(p) { const x = zero(p.x.value()), y = zero(p.y.value()); if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("NUMERIC_OVERFLOW"); return [x, y]; }
export function normalizeRing(points) {
  const exact = points.map(exactPoint); if (signedArea(exact).signum() < 0) points = [...points].reverse();
  let first = 0; for (let i = 1; i < points.length; i += 1) if (points[i][0] < points[first][0] || (points[i][0] === points[first][0] && points[i][1] < points[first][1])) first = i;
  return points.slice(first).concat(points.slice(0, first)).map(([x, y]) => [zero(x), zero(y)]);
}
export function normalizeHole(points) {
  const exact = points.map(exactPoint); if (signedArea(exact).signum() > 0) points = [...points].reverse();
  let first = 0; for (let i = 1; i < points.length; i += 1) if (points[i][0] < points[first][0] || (points[i][0] === points[first][0] && points[i][1] < points[first][1])) first = i;
  return points.slice(first).concat(points.slice(0, first)).map(([x, y]) => [zero(x), zero(y)]);
}
export function ringValidPoints(points) { const r = points.map(exactPoint); return r.length >= 3 && ringIssue(r) === null; }
export function ringIssuePoints(points) { return ringIssue(points.map(exactPoint)); }
