import { ExactRational } from "./internal/exact-rational.js";

const MAX_COUNT = 536870911;
const MAX_SAFE = 9007199254740991;

/** Signals an operation error with stable contract detail. */
export class ContactError extends Error {
  constructor(code, queryIndex = -1, stage = null) {
    super(code);
    this.name = "ContactError";
    this.code = code;
    this.queryIndex = queryIndex;
    this.stage = stage;
  }
}

function error(code) { throw new ContactError(code); }
function dynamic(code, queryIndex, stage) { throw new ContactError(code, queryIndex, stage); }

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

function record(value) {
  if (!isPlainObject(value)) error("INVALID_INPUT");
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || !Object.prototype.hasOwnProperty.call(value, "queries") ||
      !Object.prototype.hasOwnProperty.call(value, "obstacles") || !Object.prototype.hasOwnProperty.call(value, "maxWork")) {
    error("INVALID_INPUT");
  }
  return value;
}

function quadruples(value) {
  if (!isPlainArray(value)) error("INVALID_INPUT");
  if (value.length > MAX_COUNT) error("INVALID_INPUT");
  const result = new Array(value.length * 4);
  for (let rowIndex = 0; rowIndex < value.length; rowIndex += 1) {
    const rowValue = value[rowIndex];
    if (!isPlainArray(rowValue) || rowValue.length !== 4) error("INVALID_INPUT");
    for (let column = 0; column < 4; column += 1) result[rowIndex * 4 + column] = numberValue(rowValue[column]);
  }
  return result;
}

function whole(value) {
  const n = numberValue(value);
  if (n < 0 || n > MAX_SAFE || n !== Math.floor(n)) error("INVALID_INPUT");
  return n;
}

// --- exact point/geometry arithmetic over ExactRational ---
function point(x, y) { return { x: ExactRational.of(x), y: ExactRational.of(y) }; }
function subtractP(a, b) { return { x: a.x.subtract(b.x), y: a.y.subtract(b.y) }; }
function atP(a, d, t) { return { x: a.x.add(d.x.multiply(t)), y: a.y.add(d.y.multiply(t)) }; }
function crossP(a, b) { return a.x.multiply(b.y).subtract(a.y.multiply(b.x)); }
function coordinate(p, xAxis) { return xAxis ? p.x : p.y; }
function unitInterval(value) { return value.compareTo(ExactRational.ZERO) >= 0 && value.compareTo(ExactRational.ONE) <= 0; }
function samePoint(a, b) { return a.x.equals(b.x) && a.y.equals(b.y); }
function sameCoords(x, y, otherX, otherY) { return x === otherX && y === otherY; }

function between(value, first, second) {
  if (first.compareTo(second) <= 0) return value.compareTo(first) >= 0 && value.compareTo(second) <= 0;
  return value.compareTo(second) >= 0 && value.compareTo(first) <= 0;
}

function onSegment(start, end, p) {
  const direction = subtractP(end, start);
  if (samePoint(start, end)) return samePoint(start, p);
  if (crossP(direction, subtractP(p, start)).signum() !== 0) return false;
  const xAxis = direction.x.signum() !== 0;
  const value = coordinate(p, xAxis);
  const first = coordinate(start, xAxis);
  const second = coordinate(end, xAxis);
  return between(value, first, second);
}

function contact(start, end, direction, obstacle) {
  const obstacleStart = obstacle.start, obstacleEnd = obstacle.end, obstacleDirection = obstacle.direction;
  if (samePoint(start, end)) {
    return onSegment(obstacleStart, obstacleEnd, start) ? ExactRational.ZERO : null;
  }
  const offset = subtractP(obstacleStart, start);
  const denominator = crossP(direction, obstacleDirection);
  if (denominator.signum() !== 0) {
    const t = crossP(offset, obstacleDirection).divide(denominator);
    const u = crossP(offset, direction).divide(denominator);
    return unitInterval(t) && unitInterval(u) ? t : null;
  }
  if (crossP(offset, direction).signum() !== 0) return null;
  const xAxis = direction.x.signum() !== 0;
  const first = coordinate(obstacleStart, xAxis).subtract(coordinate(start, xAxis)).divide(coordinate(direction, xAxis));
  const second = coordinate(obstacleEnd, xAxis).subtract(coordinate(start, xAxis)).divide(coordinate(direction, xAxis));
  const lower = first.compareTo(second) <= 0 ? first : second;
  const upper = first.compareTo(second) <= 0 ? second : first;
  const t = lower.compareTo(ExactRational.ZERO) < 0 ? ExactRational.ZERO : lower;
  return t.compareTo(ExactRational.ONE) <= 0 && t.compareTo(upper) <= 0 ? t : null;
}

function roundedContact(queryIndex, obstacleIndex, queries, offset, start, direction, parameter) {
  const atStart = parameter.equals(ExactRational.ZERO);
  const atEnd = parameter.equals(ExactRational.ONE);
  const t = zero(parameter.value());
  if (!atStart && !atEnd && (t === 0.0 || t === 1.0)) dynamic("REPRESENTATION_COLLAPSE", queryIndex, "parameter");
  if (atStart) return { obstacleIndex, t, x: queries[offset], y: queries[offset + 1] };
  if (atEnd) return { obstacleIndex, t, x: queries[offset + 2], y: queries[offset + 3] };
  const exact = atP(start, direction, parameter);
  const x = zero(exact.x.value());
  const y = zero(exact.y.value());
  if (sameCoords(x, y, queries[offset], queries[offset + 1]) || sameCoords(x, y, queries[offset + 2], queries[offset + 3])) {
    dynamic("REPRESENTATION_COLLAPSE", queryIndex, "point");
  }
  return { obstacleIndex, t, x, y };
}

function exactObstacles(values, count) {
  const result = new Array(count);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 4;
    const start = point(values[offset], values[offset + 1]);
    const end = point(values[offset + 2], values[offset + 3]);
    result[index] = { start, end, direction: subtractP(end, start) };
  }
  return result;
}

class NearestSegmentContact2D {
  #hits;
  constructor(hits) { this.#hits = hits; Object.freeze(this); }
  get size() { return this.#hits.length; }
  hitAt(index) {
    if (typeof index !== "number" || !Number.isFinite(index) || index !== Math.floor(index) || index < 0) {
      throw new ContactError("INVALID_INDEX");
    }
    if (index >= this.#hits.length) throw new ContactError("INDEX_OUT_OF_RANGE");
    const hit = this.#hits[index];
    return hit === null ? null : { ...hit };
  }
  toValues() {
    const values = new Array(this.#hits.length);
    for (let i = 0; i < this.#hits.length; i += 1) {
      const contact = this.#hits[i];
      values[i] = contact === null ? null : { obstacleIndex: contact.obstacleIndex, t: contact.t, point: [contact.x, contact.y] };
    }
    return { hits: values };
  }
}

/**
 * Find the nearest closed-segment contact for each directed query segment. Implements
 * geometry.nearest-segment-contact-2d 0.1.0.
 *
 * Queries and obstacles use caller coordinate units, origins, and axes. Contacts are
 * selected with exact rational arithmetic from supplied binary64 values before their
 * parameter and point are rounded once to binary64. Admitted as the independent contact
 * dependency from 2018/Generativos/plasma007#2, documented at
 * survey/out/2018/Generativos/plasma007/notes.md; it does not include that sketch's ray
 * generation or ordered two-pass drawing orchestration.
 */
export function nearestSegmentContact2D(configuration) {
  const config = record(configuration);
  const queries = quadruples(config.queries);
  const obstacles = quadruples(config.obstacles);
  const maxWork = whole(config.maxWork);
  const queryCount = queries.length / 4;
  const obstacleCount = obstacles.length / 4;
  const work = BigInt(queryCount) * BigInt(obstacleCount);
  if (work > BigInt(maxWork)) error("WORK_LIMIT_EXCEEDED");

  const exactObstacleList = exactObstacles(obstacles, obstacleCount);
  const hits = new Array(queryCount).fill(null);
  for (let queryIndex = 0; queryIndex < queryCount; queryIndex += 1) {
    const queryOffset = queryIndex * 4;
    const start = point(queries[queryOffset], queries[queryOffset + 1]);
    const end = point(queries[queryOffset + 2], queries[queryOffset + 3]);
    const direction = subtractP(end, start);
    let nearest = null;
    let obstacleIndex = -1;
    for (let candidateIndex = 0; candidateIndex < obstacleCount; candidateIndex += 1) {
      const obstacle = exactObstacleList[candidateIndex];
      const candidate = contact(start, end, direction, obstacle);
      if (candidate !== null && (nearest === null || candidate.compareTo(nearest) < 0)) {
        nearest = candidate;
        obstacleIndex = candidateIndex;
      }
    }
    if (nearest !== null) {
      hits[queryIndex] = roundedContact(queryIndex, obstacleIndex, queries, queryOffset, start, direction, nearest);
    }
  }
  return new NearestSegmentContact2D(hits);
}
