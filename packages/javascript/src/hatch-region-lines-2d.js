import { ExactRational } from "./internal/exact-rational.js";
import { captureRegion, cross, dot, exactPoint, inUnit, locationInRing, finite, integer, plainRecord, pointArray, sub, validateRegion, validationWork, zero } from "./internal/region-utils.js";

export class HatchRegionLines2DError extends Error {
  constructor(code) { super(code); this.name = "HatchRegionLines2DError"; this.code = code; }
}
const ZERO = ExactRational.ZERO;
const ONE = ExactRational.ONE;
function finitePair(pair) { return Number.isFinite(pair[0]) && Number.isFinite(pair[1]); }
function exactAt(a, d, t) { return { x: a.x.add(d.x.multiply(t)), y: a.y.add(d.y.multiply(t)) }; }
function roundedPoint(p) {
  const result = [zero(p.x.value()), zero(p.y.value())];
  if (!finitePair(result)) throw new HatchRegionLines2DError("NUMERIC_OVERFLOW");
  return result;
}
function same(a, b) { return a[0] === b[0] && a[1] === b[1]; }
function insideOrOn(region, p) {
  if (locationInRing(region.outer, p) < 0) return false;
  return !region.holes.some((hole) => locationInRing(hole, p) > 0);
}
function addContacts(hits, start, end, ring) {
  const travel = sub(end, start), length = dot(travel, travel);
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i], b = ring[(i + 1) % ring.length], edge = sub(b, a), delta = sub(a, start), den = cross(travel, edge);
    if (den.signum() !== 0) {
      const t = cross(delta, edge).divide(den), u = cross(delta, travel).divide(den);
      if (inUnit(t) && inUnit(u)) hits.push(t);
    } else if (cross(delta, travel).signum() === 0) {
      for (const p of [a, b]) {
        const t = dot(sub(p, start), travel).divide(length);
        if (inUnit(t)) hits.push(t);
      }
    }
  }
}

/** Return line fragments inside a strict region, ordered by scanline then travel direction. */
export function hatchRegionLines2D(configuration) {
  const ErrorType = HatchRegionLines2DError;
  const input = plainRecord(configuration, ["region", "origin", "direction", "spacing", "phase", "maxWork", "maxOutputPaths"], ErrorType);
  const origin = pointArray(input.origin, ErrorType), direction = pointArray(input.direction, ErrorType);
  const spacing = finite(input.spacing, ErrorType), phase = finite(input.phase, ErrorType);
  const maxWork = integer(input.maxWork, ErrorType), maxOutput = integer(input.maxOutputPaths, ErrorType);
  if (!(spacing > 0)) throw new ErrorType("INVALID_INPUT");
  const magnitude = Math.hypot(direction[0], direction[1]);
  if (!Number.isFinite(magnitude) || magnitude === 0) throw new ErrorType("NUMERIC_OVERFLOW");
  const tangent = [direction[0] / magnitude, direction[1] / magnitude], normal = [-tangent[1], tangent[0]];
  if (!finitePair(tangent)) throw new ErrorType("NUMERIC_OVERFLOW");
  const region = captureRegion(input.region, ErrorType);
  let minN = Infinity, maxN = -Infinity, minT = Infinity, maxT = -Infinity;
  for (const ring of region.rings) for (const p of ring) {
    const px = p.x.value() - origin[0], py = p.y.value() - origin[1];
    const n = px * normal[0] + py * normal[1], t = px * tangent[0] + py * tangent[1];
    if (!Number.isFinite(n) || !Number.isFinite(t)) throw new ErrorType("NUMERIC_OVERFLOW");
    minN = Math.min(minN, n); maxN = Math.max(maxN, n);
    minT = Math.min(minT, t); maxT = Math.max(maxT, t);
  }
  const lower = Math.ceil((minN - phase) / spacing), upper = Math.floor((maxN - phase) / spacing);
  if (!Number.isSafeInteger(lower) || !Number.isSafeInteger(upper)) throw new ErrorType("NUMERIC_OVERFLOW");
  const count = upper >= lower ? BigInt(upper) - BigInt(lower) + 1n : 0n;
  const e = BigInt(region.edges), work = validationWork(region) + count * (8n * e * e + 16n * e + 8n);
  if (work > BigInt(maxWork)) throw new ErrorType("WORK_LIMIT");
  validateRegion(region, ErrorType);
  if (!(maxT > minT) || count === 0n) return { paths: [], lineIndices: [], intervals: [] };
  const paths = [], lineIndices = [], intervals = [];
  for (let k = lower; k <= upper; k += 1) {
    const n = phase + k * spacing;
    const base = [origin[0] + normal[0] * n, origin[1] + normal[1] * n];
    const sourceStart = [base[0] + tangent[0] * minT, base[1] + tangent[1] * minT];
    const sourceEnd = [base[0] + tangent[0] * maxT, base[1] + tangent[1] * maxT];
    if (!Number.isFinite(n) || !finitePair(base) || !finitePair(sourceStart) || !finitePair(sourceEnd)) throw new ErrorType("NUMERIC_OVERFLOW");
    const start = exactPoint(sourceStart), end = exactPoint(sourceEnd), travel = sub(end, start);
    if (dot(travel, travel).signum() === 0) throw new ErrorType("REPRESENTATION_COLLAPSE");
    const hits = [ZERO, ONE];
    for (const ring of region.rings) addContacts(hits, start, end, ring);
    hits.sort((a, b) => a.compareTo(b));
    const unique = hits.filter((value, i) => i === 0 || !value.equals(hits[i - 1]));
    const retained = [];
    for (let i = 0; i + 1 < unique.length; i += 1) {
      const a = unique[i], b = unique[i + 1];
      if (b.compareTo(a) <= 0 || !insideOrOn(region, exactAt(start, travel, a.add(b).divide(ExactRational.TWO)))) continue;
      if (retained.length && retained[retained.length - 1][1].equals(a)) retained[retained.length - 1][1] = b;
      else retained.push([a, b]);
    }
    if (BigInt(paths.length + retained.length) > BigInt(maxOutput)) throw new ErrorType("OUTPUT_LIMIT");
    let previousEnd = null;
    for (const [a, b] of retained) {
      const path = [roundedPoint(exactAt(start, travel, a)), roundedPoint(exactAt(start, travel, b))];
      if (same(path[0], path[1]) || (previousEnd && same(previousEnd, path[0]))) throw new ErrorType("REPRESENTATION_COLLAPSE");
      const interval = [zero(a.value()), zero(b.value())];
      if (interval[0] === interval[1]) throw new ErrorType("REPRESENTATION_COLLAPSE");
      paths.push(path); lineIndices.push(zero(k)); intervals.push(interval); previousEnd = path[1];
    }
  }
  return { paths, lineIndices, intervals };
}
