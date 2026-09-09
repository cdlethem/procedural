const MAX_PROPOSALS = 357913941;
const MAX_VERTICES = 1073741823;
const MIN_SUBNORMAL = 5e-324;
const SIGNIFICAND_BIT = 1n << 52n;
const MANTISSA_MASK = 0xfffffffffffffn;

/** Validation/access error with a stable catalog code and candidate index. */
export class PlacementError extends Error {
  constructor(code, candidateIndex = -1) {
    super(code);
    this.name = "PlacementError";
    this.code = code;
    this.candidateIndex = candidateIndex;
  }
}

function invalidInput(index) { throw new PlacementError("INVALID_INPUT", index); }
function invalidPolygon(index) { throw new PlacementError("INVALID_POLYGON", index); }

function isPlainArray(value) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
}

function zero(value) { return value === 0 ? 0 : value; }

function number(raw, index) {
  if (typeof raw !== "number") invalidInput(index);
  if (!Number.isFinite(raw)) invalidInput(index);
  return zero(raw);
}

// Shared scratch for exact binary64 bit access; all use is sequential.
const BIT_BUFFER = new ArrayBuffer(8);
const BIT_FLOAT = new Float64Array(BIT_BUFFER);
const BIT_INT = new BigInt64Array(BIT_BUFFER);
function bitsOf(value) { BIT_FLOAT[0] = value; return BIT_INT[0]; }
function nextUp(value) {
  if (Object.is(value, -0)) return 0;
  if (value === 0) return MIN_SUBNORMAL;
  if (value > 0) { BIT_INT[0] = bitsOf(value) + 1n; return BIT_FLOAT[0]; }
  BIT_INT[0] = bitsOf(value) - 1n; return BIT_FLOAT[0];
}
function nextDown(value) {
  if (value === 0) return -MIN_SUBNORMAL;
  if (value < 0) { BIT_INT[0] = bitsOf(value) + 1n; return BIT_FLOAT[0]; }
  BIT_INT[0] = bitsOf(value) - 1n; return BIT_FLOAT[0];
}

/**
 * Exact finite binary64 dyadic n * 2^e, discarded before return. Independently
 * duplicated from delaunay.js per the established per-module convention; this
 * operation reuses the same project-owned interval-filter/dyadic mechanism privately
 * (the accepted triangulator is unchanged; uncertain signs are never guessed).
 */
class D {
  constructor(n, e) { this.n = n; this.e = e; }
  static of(value) {
    const raw = bitsOf(value);
    const negative = raw < 0n;
    const exponent = Number((raw >> 52n) & 0x7ffn);
    const mantissa = raw & MANTISSA_MASK;
    if (exponent === 0 && mantissa === 0n) return new D(0n, 0);
    if (exponent === 0) return new D(negative ? -mantissa : mantissa, -1074);
    const significand = SIGNIFICAND_BIT | mantissa;
    return new D(negative ? -significand : significand, exponent - 1075);
  }
  subtract(other) {
    if (other.n === 0n) return this;
    const base = this.e < other.e ? this.e : other.e;
    return new D((this.n << BigInt(this.e - base)) - (other.n << BigInt(other.e - base)), base);
  }
  multiply(other) { return new D(this.n * other.n, this.e + other.e); }
  sign() { return this.n < 0n ? -1 : this.n > 0n ? 1 : 0; }
}

function productLower(al, ah, bl, bh) {
  return nextDown(Math.min(al * bl, al * bh, ah * bl, ah * bh));
}
function productUpper(al, ah, bl, bh) {
  return nextUp(Math.max(al * bl, al * bh, ah * bl, ah * bh));
}
/** Returns zero for an uncertified sign, which must use the exact dyadic fallback. */
function orientationFilter(ax, ay, bx, by, cx, cy) {
  const x1 = bx - ax, y1 = by - ay, x2 = cx - ax, y2 = cy - ay;
  if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return 0;
  const xl1 = nextDown(x1), xh1 = nextUp(x1);
  const yl1 = nextDown(y1), yh1 = nextUp(y1);
  const xl2 = nextDown(x2), xh2 = nextUp(x2);
  const yl2 = nextDown(y2), yh2 = nextUp(y2);
  if (!Number.isFinite(xl1) || !Number.isFinite(xh1) || !Number.isFinite(yl1) || !Number.isFinite(yh1)
      || !Number.isFinite(xl2) || !Number.isFinite(xh2) || !Number.isFinite(yl2) || !Number.isFinite(yh2)) return 0;
  const leftLow = productLower(xl1, xh1, yl2, yh2), leftHigh = productUpper(xl1, xh1, yl2, yh2);
  const rightLow = productLower(yl1, yh1, xl2, xh2), rightHigh = productUpper(yl1, yh1, xl2, xh2);
  if (!Number.isFinite(leftLow) || !Number.isFinite(leftHigh) || !Number.isFinite(rightLow) || !Number.isFinite(rightHigh)) return 0;
  const lower = nextDown(leftLow - rightHigh), upper = nextUp(leftHigh - rightLow);
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) return 0;
  return lower > 0 ? 1 : upper < 0 ? -1 : 0;
}
function orient(ax, ay, bx, by, cx, cy) {
  const filtered = orientationFilter(ax, ay, bx, by, cx, cy);
  if (filtered !== 0) return filtered;
  const x1 = D.of(bx).subtract(D.of(ax)), y1 = D.of(by).subtract(D.of(ay));
  const x2 = D.of(cx).subtract(D.of(ax)), y2 = D.of(cy).subtract(D.of(ay));
  return x1.multiply(y2).subtract(y1.multiply(x2)).sign();
}

function validatePolygon(points, source) {
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (points[i][0] === points[j][0] && points[i][1] === points[j][1]) invalidPolygon(source);
    }
  }
  let orientation = 0;
  for (let i = 0; i < n; i += 1) {
    const a = points[i], b = points[(i + 1) % n], c = points[(i + 2) % n];
    const sign = orient(a[0], a[1], b[0], b[1], c[0], c[1]);
    if (sign === 0) invalidPolygon(source);
    if (orientation === 0) orientation = sign;
    else if (orientation !== sign) invalidPolygon(source);
  }
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (j === i || j === (i + 1) % n) continue;
      const a = points[i], b = points[(i + 1) % n], c = points[j];
      if (orient(a[0], a[1], b[0], b[1], c[0], c[1]) !== orientation) invalidPolygon(source);
    }
  }
  const x = new Array(n), y = new Array(n);
  for (let i = 0; i < n; i += 1) { x[i] = zero(points[i][0]); y[i] = zero(points[i][1]); }
  return makePolygon(x, y);
}

function makePolygon(x, y) {
  let minX = x[0], maxX = x[0], minY = y[0], maxY = y[0];
  for (let i = 1; i < x.length; i += 1) {
    minX = Math.min(minX, x[i]); maxX = Math.max(maxX, x[i]);
    minY = Math.min(minY, y[i]); maxY = Math.max(maxY, y[i]);
  }
  return { x, y, minX, maxX, minY, maxY };
}

function box(ax, ay, bx, by, x, y) {
  return x >= Math.min(ax, bx) && x <= Math.max(ax, bx) && y >= Math.min(ay, by) && y <= Math.max(ay, by);
}
function segments(ax, ay, bx, by, cx, cy, dx, dy) {
  const abC = orient(ax, ay, bx, by, cx, cy), abD = orient(ax, ay, bx, by, dx, dy);
  const cdA = orient(cx, cy, dx, dy, ax, ay), cdB = orient(cx, cy, dx, dy, bx, by);
  if ((abC === 0 && box(ax, ay, bx, by, cx, cy)) || (abD === 0 && box(ax, ay, bx, by, dx, dy))
      || (cdA === 0 && box(cx, cy, dx, dy, ax, ay)) || (cdB === 0 && box(cx, cy, dx, dy, bx, by))) return true;
  return abC * abD < 0 && cdA * cdB < 0;
}
function contains(p, x, y) {
  const direction = orient(p.x[0], p.y[0], p.x[1], p.y[1], p.x[2], p.y[2]);
  for (let i = 0; i < p.x.length; i += 1) {
    const j = (i + 1) % p.x.length;
    if (orient(p.x[i], p.y[i], p.x[j], p.y[j], x, y) !== direction) return false;
  }
  return true;
}
function intersects(a, b) {
  if (a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY) return false;
  for (let i = 0; i < a.x.length; i += 1) {
    const iNext = (i + 1) % a.x.length;
    for (let j = 0; j < b.x.length; j += 1) {
      const jNext = (j + 1) % b.x.length;
      if (segments(a.x[i], a.y[i], a.x[iNext], a.y[iNext], b.x[j], b.y[j], b.x[jNext], b.y[jNext])) return true;
    }
  }
  return contains(a, b.x[0], b.y[0]) || contains(b, a.x[0], a.y[0]);
}

class Placements {
  #polygons; #sourceIndices; #attempts;
  constructor(polygons, sourceIndices, attempts) {
    this.#polygons = polygons; this.#sourceIndices = sourceIndices; this.#attempts = attempts;
    Object.freeze(this);
  }
  get attempts() { return this.#attempts; }
  get size() { return this.#polygons.length; }
  #checkedIndex(value) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 2147483647) {
      throw new PlacementError("INDEX_OUT_OF_RANGE");
    }
    if (value >= this.#polygons.length) throw new PlacementError("INDEX_OUT_OF_RANGE");
    return value;
  }
  #checkedVertex(polygon, value) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= polygon.x.length) {
      throw new PlacementError("INDEX_OUT_OF_RANGE");
    }
    return value;
  }
  sourceIndexAt(index) { return this.#sourceIndices[this.#checkedIndex(index)]; }
  vertexCountAt(index) { return this.#polygons[this.#checkedIndex(index)].x.length; }
  xAt(polygonIndex, vertexIndex) {
    const p = this.#polygons[this.#checkedIndex(polygonIndex)];
    return p.x[this.#checkedVertex(p, vertexIndex)];
  }
  yAt(polygonIndex, vertexIndex) {
    const p = this.#polygons[this.#checkedIndex(polygonIndex)];
    return p.y[this.#checkedVertex(p, vertexIndex)];
  }
  toValues() {
    const polygons = this.#polygons.map((p) => p.x.map((x, i) => [x, p.y[i]]));
    return { attempts: this.#attempts, polygons, sourceIndices: this.#sourceIndices.slice() };
  }
}

function build(candidates, attempts) {
  const kept = [], indices = [];
  for (let i = 0; i < candidates.length; i += 1) {
    let collision = false;
    for (let j = 0; j < kept.length; j += 1) {
      if (intersects(candidates[i], kept[j])) { collision = true; break; }
    }
    if (!collision) { kept.push(candidates[i]); indices.push(i); }
  }
  return new Placements(kept, indices, attempts);
}

/**
 * Filter caller-supplied strictly convex polygon proposals by greedy non-intersecting
 * placement, in proposal order. Implements sampling.ordered-convex-polygon-filter-2d 0.1.0.
 *
 * Motivated by survey/out/2017/Generativos/celular/notes.md and
 * survey/out/2017/Generativos/celular2/notes.md. Independently specified symmetric
 * containment/contact semantics intentionally differ from source collision defects.
 */
export function orderedConvexPolygonFilter2D(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) invalidInput(-1);
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) invalidInput(-1);
  if (Reflect.ownKeys(input).length !== 1 || !Object.prototype.hasOwnProperty.call(input, "polygons")) invalidInput(-1);
  const rows = input.polygons;
  if (!isPlainArray(rows)) invalidInput(-1);
  if (rows.length > MAX_PROPOSALS) invalidInput(-1);
  const validated = new Array(rows.length);
  let total = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!isPlainArray(row)) invalidInput(i);
    if (row.length < 3) invalidInput(i);
    total += row.length;
    if (total > MAX_VERTICES) invalidInput(i);
    const copy = new Array(row.length);
    for (let j = 0; j < row.length; j += 1) {
      const vertex = row[j];
      if (!isPlainArray(vertex) || vertex.length !== 2) invalidInput(i);
      copy[j] = [number(vertex[0], i), number(vertex[1], i)];
    }
    validated[i] = validatePolygon(copy, i);
  }
  return build(validated, rows.length);
}
