import { ExactRational } from "./internal/exact-rational.js";

const MAX_SAFE = 9007199254740991;
const MAX_VERTICES = 1073741823;
const MAX_SEGMENTS = 536870911;
const MAX_OUTPUT = 536870911;
const KEYS = ["polygon", "segments", "maxWork", "maxOutputSegments"];

/** Stable operation failure. Dynamic failures identify their source and merged interval. */
export class SegmentClipError extends Error {
  constructor(code, sourceIndex = -1, intervalIndex = -1, stage = null) {
    super(code);
    this.name = "SegmentClipError";
    this.code = code;
    this.sourceIndex = sourceIndex;
    this.intervalIndex = intervalIndex;
    this.stage = stage;
  }
}

function error(code) { throw new SegmentClipError(code); }
function dynamic(code, source, interval, stage) { throw new SegmentClipError(code, source, interval, stage); }
function writableSlot(array, index) {
  const key = String(index);
  const descriptor = Object.getOwnPropertyDescriptor(array, key);
  if (descriptor !== undefined) return "value" in descriptor && descriptor.writable === true;
  if (!Object.isExtensible(array)) return false;
  for (let prototype = Object.getPrototypeOf(array); prototype !== null; prototype = Object.getPrototypeOf(prototype)) {
    if (Object.getOwnPropertyDescriptor(prototype, key) !== undefined) return false;
  }
  return true;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function isPlainArray(value) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
}

function zero(value) { return value === 0 ? 0 : value; }

function numberValue(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) error("INVALID_INPUT");
  return zero(value);
}

function integerValue(value, maximum) {
  const n = numberValue(value);
  if (n < 0 || n > maximum || n !== Math.floor(n)) error("INVALID_INPUT");
  return n;
}

function checkKeys(record) {
  if (!isPlainObject(record)) error("INVALID_INPUT");
  const ownKeys = Reflect.ownKeys(record);
  if (ownKeys.length !== KEYS.length) error("INVALID_INPUT");
  for (const key of KEYS) if (!Object.prototype.hasOwnProperty.call(record, key)) error("INVALID_INPUT");
}

function validateRows(value, width, min, max) {
  if (!isPlainArray(value)) error("INVALID_INPUT");
  if (value.length < min || value.length > max) error("INVALID_INPUT");
  const result = new Array(value.length * width);
  let at = 0;
  for (const row of value) {
    if (!isPlainArray(row) || row.length !== width) error("INVALID_INPUT");
    for (const item of row) result[at++] = numberValue(item);
  }
  return result;
}

// --- exact point/segment arithmetic over ExactRational ---
function point(x, y) { return { x: ExactRational.of(x), y: ExactRational.of(y) }; }
function subtractP(a, b) { return { x: a.x.subtract(b.x), y: a.y.subtract(b.y) }; }
function atP(a, d, t) { return { x: a.x.add(d.x.multiply(t)), y: a.y.add(d.y.multiply(t)) }; }
function crossP(a, b) { return a.x.multiply(b.y).subtract(a.y.multiply(b.x)); }
function dotP(a, b) { return a.x.multiply(b.x).add(a.y.multiply(b.y)); }
function coordinate(p, x) { return x ? p.x : p.y; }
function unitInterval(r) { return r.compareTo(ExactRational.ZERO) >= 0 && r.compareTo(ExactRational.ONE) <= 0; }
function sameP(a, b) { return a.x.equals(b.x) && a.y.equals(b.y); }

function between(value, a, b) {
  const lower = a.compareTo(b) <= 0 ? a : b;
  const upper = a.compareTo(b) <= 0 ? b : a;
  return value.compareTo(lower) >= 0 && value.compareTo(upper) <= 0;
}
function on(start, end, p) {
  return crossP(subtractP(end, start), subtractP(p, start)).signum() === 0 &&
    between(p.x, start.x, end.x) && between(p.y, start.y, end.y);
}
function meet(a, b, c, d) {
  if (on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b)) return true;
  return crossP(subtractP(b, a), subtractP(c, a)).signum() * crossP(subtractP(b, a), subtractP(d, a)).signum() < 0 &&
    crossP(subtractP(d, c), subtractP(a, c)).signum() * crossP(subtractP(d, c), subtractP(b, c)).signum() < 0;
}
function containsPoint(polygon, p) {
  let inside = false;
  for (let i = 0; i < polygon.length; i += 1) {
    const first = polygon[i], second = polygon[(i + 1) % polygon.length];
    if (on(first, second, p)) return true;
    if ((first.y.compareTo(p.y) > 0) !== (second.y.compareTo(p.y) > 0)) {
      const crossingX = first.x.add(p.y.subtract(first.y).multiply(second.x.subtract(first.x)).divide(second.y.subtract(first.y)));
      if (p.x.compareTo(crossingX) < 0) inside = !inside;
    }
  }
  return inside;
}

function validatePolygon(p) {
  let area = ExactRational.ZERO;
  for (let i = 0; i < p.length; i += 1) {
    for (let j = i + 1; j < p.length; j += 1) if (sameP(p[i], p[j])) error("INVALID_POLYGON");
    const a = p[i], b = p[(i + 1) % p.length], previous = p[(i + p.length - 1) % p.length];
    area = area.add(crossP(a, b));
    if (crossP(subtractP(a, previous), subtractP(b, a)).signum() === 0 &&
        dotP(subtractP(a, previous), subtractP(b, a)).signum() <= 0) error("INVALID_POLYGON");
  }
  if (area.signum() === 0) error("INVALID_POLYGON");
  for (let i = 0; i < p.length; i += 1) {
    for (let j = i + 1; j < p.length; j += 1) {
      if (j !== i + 1 && !(i === 0 && j === p.length - 1) &&
          meet(p[i], p[(i + 1) % p.length], p[j], p[(j + 1) % p.length])) error("INVALID_POLYGON");
    }
  }
}

function addCuts(cuts, source, direction, edgeStart, edgeEnd) {
  const edge = subtractP(edgeEnd, edgeStart);
  const offset = subtractP(edgeStart, source);
  const denominator = crossP(direction, edge);
  if (denominator.signum() !== 0) {
    const t = crossP(offset, edge).divide(denominator);
    const u = crossP(offset, direction).divide(denominator);
    if (unitInterval(t) && unitInterval(u)) cuts.push(t);
  } else if (crossP(offset, direction).signum() === 0) {
    const xAxis = direction.x.signum() !== 0;
    const first = coordinate(edgeStart, xAxis).subtract(coordinate(source, xAxis)).divide(coordinate(direction, xAxis));
    const second = coordinate(edgeEnd, xAxis).subtract(coordinate(source, xAxis)).divide(coordinate(direction, xAxis));
    if (unitInterval(first)) cuts.push(first);
    if (unitInterval(second)) cuts.push(second);
  }
}

function uniqueSorted(cuts) {
  const sorted = cuts.slice().sort((a, b) => a.compareTo(b));
  const result = [];
  for (const cut of sorted) {
    if (result.length === 0 || !result[result.length - 1].equals(cut)) result.push(cut);
  }
  return result;
}

class Packed {
  segments = []; intervals = []; sources = []; size = 0;
  add(startX, startY, endX, endY, t0, t1, source) {
    this.segments.push(startX, startY, endX, endY);
    this.intervals.push(t0, t1);
    this.sources.push(source);
    this.size += 1;
  }
}

function calculate(region, raw, limit) {
  const output = new Packed();
  for (let source = 0; source < raw.length / 4; source += 1) {
    const base = source * 4;
    const a = point(raw[base], raw[base + 1]);
    const b = point(raw[base + 2], raw[base + 3]);
    const direction = subtractP(b, a);
    if (sameP(a, b)) continue;
    const cuts = [ExactRational.ZERO, ExactRational.ONE];
    for (let edge = 0; edge < region.length; edge += 1) {
      addCuts(cuts, a, direction, region[edge], region[(edge + 1) % region.length]);
    }
    const unique = uniqueSorted(cuts);
    const retained = [];
    for (let i = 0; i + 1 < unique.length; i += 1) {
      const lo = unique[i], hi = unique[i + 1];
      if (lo.equals(hi)) continue;
      const midpoint = atP(a, direction, lo.add(hi).divide(ExactRational.TWO));
      if (containsPoint(region, midpoint)) {
        if (retained.length > 0 && retained[retained.length - 1].t1.equals(lo)) {
          retained[retained.length - 1].t1 = hi;
        } else {
          retained.push({ t0: lo, t1: hi });
        }
      }
    }
    let previousEnd = 0, hasPrevious = false;
    for (let i = 0; i < retained.length; i += 1) {
      if (output.size === limit) dynamic("OUTPUT_LIMIT_EXCEEDED", source, i, null);
      const interval = retained[i];
      const t0 = zero(interval.t0.value());
      const t1 = zero(interval.t1.value());
      if (t0 >= t1) dynamic("REPRESENTATION_COLLAPSE", source, i, "parameter");
      const exactA = atP(a, direction, interval.t0);
      const exactB = atP(a, direction, interval.t1);
      const ax = zero(interval.t0.equals(ExactRational.ZERO) ? raw[base] : exactA.x.value());
      const ay = zero(interval.t0.equals(ExactRational.ZERO) ? raw[base + 1] : exactA.y.value());
      const bx = zero(interval.t1.equals(ExactRational.ONE) ? raw[base + 2] : exactB.x.value());
      const by = zero(interval.t1.equals(ExactRational.ONE) ? raw[base + 3] : exactB.y.value());
      if (ax === bx && ay === by) dynamic("REPRESENTATION_COLLAPSE", source, i, "endpoints");
      if (hasPrevious && previousEnd >= t0) dynamic("REPRESENTATION_COLLAPSE", source, i, "gap");
      output.add(ax, ay, bx, by, t0, t1, source);
      previousEnd = t1;
      hasPrevious = true;
    }
  }
  return output;
}

class SegmentClip {
  #segments; #intervals; #sourceIndices; #size;
  constructor(output) {
    this.#segments = output.segments; this.#intervals = output.intervals;
    this.#sourceIndices = output.sources; this.#size = output.size;
    Object.freeze(this);
  }
  get size() { return this.#size; }
  #checkedIndex(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 ||
        value !== Math.floor(value) || value > MAX_SAFE) {
      throw new SegmentClipError("INVALID_INDEX");
    }
    if (value >= this.#size) throw new SegmentClipError("INDEX_OUT_OF_RANGE");
    return value;
  }
  sourceIndexAt(index) { return this.#sourceIndices[this.#checkedIndex(index)]; }
  segmentAt(index) {
    const i = this.#checkedIndex(index) * 4;
    return [this.#segments[i], this.#segments[i + 1], this.#segments[i + 2], this.#segments[i + 3]];
  }
  segmentInto(index, destination, offset) {
    const i = this.#checkedIndex(index);
    this.#checkDestination(destination, offset, 4);
    const base = i * 4;
    destination[offset] = this.#segments[base]; destination[offset + 1] = this.#segments[base + 1];
    destination[offset + 2] = this.#segments[base + 2]; destination[offset + 3] = this.#segments[base + 3];
  }
  intervalAt(index) {
    const i = this.#checkedIndex(index) * 2;
    return [this.#intervals[i], this.#intervals[i + 1]];
  }
  intervalInto(index, destination, offset) {
    const i = this.#checkedIndex(index);
    this.#checkDestination(destination, offset, 2);
    const base = i * 2;
    destination[offset] = this.#intervals[base]; destination[offset + 1] = this.#intervals[base + 1];
  }
  #checkDestination(target, offset, width) {
    if (!isPlainArray(target) && !(target instanceof Float64Array)) throw new SegmentClipError("INVALID_OUTPUT");
    if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0 || offset > target.length - width) {
      throw new SegmentClipError("INVALID_OUTPUT");
    }
    if (target instanceof Float64Array) return;
    for (let i = 0; i < width; i += 1) {
      if (!writableSlot(target, offset + i)) throw new SegmentClipError("INVALID_OUTPUT");
    }
  }
  toValues() {
    const segments = [], sourceIndices = [], intervals = [];
    for (let i = 0; i < this.#size; i += 1) {
      segments.push([this.#segments[i * 4], this.#segments[i * 4 + 1], this.#segments[i * 4 + 2], this.#segments[i * 4 + 3]]);
      sourceIndices.push(this.#sourceIndices[i]);
      intervals.push([this.#intervals[i * 2], this.#intervals[i * 2 + 1]]);
    }
    return { segments, sourceIndices, intervals };
  }
}

/**
 * Clip supplied line segments against one simple polygon with exact topology, rounding
 * each retained interval once to binary64. Implements geometry.clip-segments-simple-polygon-2d
 * 0.1.0.
 *
 * Motivated by the retained clipping dependency in survey/out/2014/Generativos/Forms/forms1/
 * notes.md; hatch generation, drawing, styling, and polygon boolean operations are
 * deliberately outside it.
 */
export function clipSegmentsSimplePolygon2D(input) {
  checkKeys(input);
  const polygon = validateRows(input.polygon, 2, 3, MAX_VERTICES);
  const rawSegments = validateRows(input.segments, 4, 0, MAX_SEGMENTS);
  const maxWork = integerValue(input.maxWork, MAX_SAFE);
  const maxOutput = integerValue(input.maxOutputSegments, MAX_OUTPUT);
  const v = BigInt(polygon.length / 2);
  const s = BigInt(rawSegments.length / 4);
  const vv = v * v;
  const work = vv + s * (vv * 8n + v * 16n + 8n);
  if (work > BigInt(maxWork)) error("WORK_LIMIT_EXCEEDED");
  const region = new Array(polygon.length / 2);
  for (let i = 0; i < region.length; i += 1) region[i] = point(polygon[i * 2], polygon[i * 2 + 1]);
  validatePolygon(region);
  return new SegmentClip(calculate(region, rawSegments, maxOutput));
}
