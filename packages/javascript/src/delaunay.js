const MAX_POINTS = 357913943;
const MAX_SAFE = 9007199254740991;
const KEYS = ["points", "maxWork"];
const SHIFT32N = 4294967296n;
const MIN_SUBNORMAL = 5e-324;
const SIGNIFICAND_BIT = 1n << 52n;
const MANTISSA_MASK = 0xfffffffffffffn;

/** Error with one of the stable delaunay-2d contract codes. */
export class DelaunayError extends Error {
  constructor(code) { super(code); this.name = "DelaunayError"; this.code = code; }
}

function fail(code) { throw new DelaunayError(code); }
function workLimit(stage, workUsed) {
  const error = new DelaunayError("WORK_LIMIT_EXCEEDED");
  error.workUsed = workUsed;
  error.stage = stage;
  throw error;
}
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function number(value) { if (!finite(value)) fail("INVALID_INPUT"); return value === 0 ? 0 : value; }
function passiveRecord(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("INVALID_INPUT");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail("INVALID_INPUT");
  if (Reflect.ownKeys(value).length !== keys.length) fail("INVALID_INPUT");
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) fail("INVALID_INPUT");
  }
  return value;
}
function recordValue(record, key) { return Object.getOwnPropertyDescriptor(record, key).value; }
function passiveArray(value, length) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail("INVALID_INPUT");
  if (length !== undefined && value.length !== length) fail("INVALID_INPUT");
  return value;
}
function arrayItem(array, index) {
  const descriptor = Object.getOwnPropertyDescriptor(array, String(index));
  if (descriptor === undefined || !("value" in descriptor)) fail("INVALID_INPUT");
  return descriptor.value;
}
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

/** Exact finite binary64 dyadic n * 2^e; discarded before return. */
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
  add(other) {
    if (this.n === 0n) return other;
    if (other.n === 0n) return this;
    const base = this.e < other.e ? this.e : other.e;
    return new D((this.n << BigInt(this.e - base)) + (other.n << BigInt(other.e - base)), base);
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

function makePoint(x, y) { return { x, y, xd: D.of(x), yd: D.of(y) }; }
function orient(pa, pb, pc) {
  const filtered = orientationFilter(pa.x, pa.y, pb.x, pb.y, pc.x, pc.y);
  if (filtered !== 0) return filtered;
  const left = pb.xd.subtract(pa.xd).multiply(pc.yd.subtract(pa.yd));
  const right = pb.yd.subtract(pa.yd).multiply(pc.xd.subtract(pa.xd));
  return left.subtract(right).sign();
}
function incircle(pa, pb, pc, pd) {
  const ax = pa.xd.subtract(pd.xd), ay = pa.yd.subtract(pd.yd);
  const bx = pb.xd.subtract(pd.xd), by = pb.yd.subtract(pd.yd);
  const cx = pc.xd.subtract(pd.xd), cy = pc.yd.subtract(pd.yd);
  const aa = ax.multiply(ax).add(ay.multiply(ay));
  const bb = bx.multiply(bx).add(by.multiply(by));
  const cc = cx.multiply(cx).add(cy.multiply(cy));
  return aa.multiply(bx.multiply(cy).subtract(by.multiply(cx)))
    .subtract(bb.multiply(ax.multiply(cy).subtract(ay.multiply(cx))))
    .add(cc.multiply(ax.multiply(by).subtract(ay.multiply(bx)))).sign();
}

function faceEdgeStart(face, index) { return index === 0 ? face.a : index === 1 ? face.b : face.c; }
function faceEdgeEnd(face, index) { return index === 0 ? face.b : index === 1 ? face.c : face.a; }
function faceThird(face, x, y) {
  if (face.a !== x && face.a !== y) return face.a;
  if (face.b !== x && face.b !== y) return face.b;
  if (face.c !== x && face.c !== y) return face.c;
  throw new Error("missing opposite vertex");
}
function canonicalFace(points, a, b, c) {
  const direction = orient(points[a], points[b], points[c]);
  if (direction === 0) throw new Error("zero-area face");
  let b2 = b, c2 = c;
  if (direction < 0) { b2 = c; c2 = b; }
  if (a <= b2 && a <= c2) return { a, b: b2, c: c2 };
  if (b2 <= a && b2 <= c2) return { a: b2, b: c2, c: a };
  return { a: c2, b: a, c: b2 };
}
function faceCompare(left, right) {
  if (left.a !== right.a) return left.a < right.a ? -1 : 1;
  if (left.b !== right.b) return left.b < right.b ? -1 : 1;
  return left.c === right.c ? 0 : left.c < right.c ? -1 : 1;
}
function edgeKey(a, b) {
  const low = a < b ? a : b, high = a < b ? b : a;
  return BigInt(low) * SHIFT32N + BigInt(high);
}
function edgeA(edge) { return Number(edge / SHIFT32N); }
function edgeB(edge) { return Number(edge % SHIFT32N); }

class Budget {
  constructor(maximum) { this.maximum = maximum; this.used = 0; }
  charge(stage, cost) {
    if (cost > this.maximum - this.used) workLimit(stage, this.used);
    this.used += cost;
  }
}

/** Set with lexicographic minimum extraction; an endpoint pair occurs at most once while queued. */
class MinQueue {
  constructor() { this.heap = []; this.present = new Set(); }
  add(key) {
    if (this.present.has(key)) return;
    this.present.add(key);
    const heap = this.heap;
    heap.push(key);
    for (let i = heap.length - 1; i > 0; i = (i - 1) >> 1) {
      const parent = (i - 1) >> 1;
      if (heap[parent] <= heap[i]) break;
      const swap = heap[parent]; heap[parent] = heap[i]; heap[i] = swap;
    }
  }
  poll() {
    const heap = this.heap;
    const top = heap[0];
    this.present.delete(top);
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0, child = 0;
      for (;;) {
        const left = 2 * i + 1, right = left + 1;
        child = i;
        if (left < heap.length && heap[left] < heap[child]) child = left;
        if (right < heap.length && heap[right] < heap[child]) child = right;
        if (child === i) break;
        const swap = heap[child]; heap[child] = heap[i]; heap[i] = swap;
        i = child;
      }
    }
    return top;
  }
  get isEmpty() { return this.heap.length === 0; }
}

/**
 * Creation-ordered active face sequence plus local undirected-edge incidence.
 * Node identities grow monotonically even though every live topology index is
 * within the public int limit; owners of one edge are always ascending ids.
 */
class ActiveFaces {
  constructor() { this.nodes = new Map(); this.incidence = new Map(); this.head = null; this.tail = null; this.nextId = 0; }
  node(id) {
    const result = this.nodes.get(id);
    if (result === undefined) throw new Error("dead face reference");
    return result;
  }
  appendSorted(faces) {
    const ordered = faces.slice().sort(faceCompare);
    const ids = new Array(ordered.length);
    for (let i = 0; i < ordered.length; i += 1) {
      const face = ordered[i];
      const node = { face, id: this.nextId++, previous: this.tail, next: null };
      this.nodes.set(node.id, node);
      if (this.tail === null) this.head = node; else this.tail.next = node;
      this.tail = node;
      this.addEdges(node.id, face);
      ids[i] = node.id;
    }
    return ids;
  }
  addEdges(id, face) {
    for (let i = 0; i < 3; i += 1) {
      const key = edgeKey(faceEdgeStart(face, i), faceEdgeEnd(face, i));
      let owners = this.incidence.get(key);
      if (owners === undefined) { owners = []; this.incidence.set(key, owners); }
      owners.push(id);
      if (owners.length > 2) throw new Error("nonmanifold edge");
    }
  }
  remove(id) {
    const node = this.nodes.get(id);
    if (node === undefined) throw new Error("dead face");
    this.nodes.delete(id);
    for (let i = 0; i < 3; i += 1) {
      const key = edgeKey(faceEdgeStart(node.face, i), faceEdgeEnd(node.face, i));
      const owners = this.incidence.get(key);
      owners.splice(owners.indexOf(id), 1);
      if (owners.length === 0) this.incidence.delete(key);
    }
    if (node.previous === null) this.head = node.next; else node.previous.next = node.next;
    if (node.next === null) this.tail = node.previous; else node.next.previous = node.previous;
    node.previous = null;
    node.next = null;
  }
  replace(removed, fresh) {
    const ordered = removed.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const id of ordered) this.remove(id);
    return this.appendSorted(fresh);
  }
  sortedFaces() {
    const out = [];
    for (let node = this.head; node !== null; node = node.next) out.push(node.face);
    out.sort(faceCompare);
    return out;
  }
}

function canonicalize(originals) {
  const order = new Array(originals.length);
  for (let i = 0; i < order.length; i += 1) order[i] = i;
  order.sort((left, right) => {
    const a = originals[left], b = originals[right];
    if (a.x !== b.x) return a.x < b.x ? -1 : 1;
    if (a.y !== b.y) return a.y < b.y ? -1 : 1;
    return left === right ? 0 : left < right ? -1 : 1;
  });
  const points = [], sourceIndices = [], inputToVertex = new Array(originals.length);
  let previousBitsX = 0n, previousBitsY = 0n, first = true;
  for (const source of order) {
    const point = originals[source];
    const bitsX = bitsOf(point.x), bitsY = bitsOf(point.y);
    if (first || bitsX !== previousBitsX || bitsY !== previousBitsY) {
      points.push(makePoint(point.x, point.y));
      sourceIndices.push(source);
      previousBitsX = bitsX; previousBitsY = bitsY; first = false;
    }
    inputToVertex[source] = points.length - 1;
  }
  return { points, inputToVertex, sourceIndices };
}

function hullChain(points, reverse, budget, stage) {
  const chain = [];
  for (let i = reverse ? points.length - 1 : 0; reverse ? i >= 0 : i < points.length; i += reverse ? -1 : 1) {
    while (chain.length >= 2) {
      budget.charge(stage, 1);
      if (orient(points[chain[chain.length - 2]], points[chain[chain.length - 1]], points[i]) <= 0) chain.pop();
      else break;
    }
    chain.push(i);
  }
  return chain;
}
function strictHull(points, budget) {
  const lower = hullChain(points, false, budget, "hull_lower");
  const upper = hullChain(points, true, budget, "hull_upper");
  lower.pop(); upper.pop();
  for (const vertex of upper) lower.push(vertex);
  return lower;
}

function insert(points, active, site, budget) {
  let found = -1, sign0 = 0, sign1 = 0, sign2 = 0;
  for (let node = active.head; node !== null; node = node.next) {
    budget.charge("locate", 1);
    const face = node.face;
    const candidate0 = orient(points[face.a], points[face.b], points[site]);
    const candidate1 = orient(points[face.b], points[face.c], points[site]);
    const candidate2 = orient(points[face.c], points[face.a], points[site]);
    if (candidate0 >= 0 && candidate1 >= 0 && candidate2 >= 0) {
      found = node.id; sign0 = candidate0; sign1 = candidate1; sign2 = candidate2; break;
    }
  }
  if (found < 0) throw new Error("no containing active face");
  const foundFace = active.node(found).face;
  let zeros = 0, zeroIndex = -1;
  if (sign0 === 0) { zeros += 1; zeroIndex = 0; }
  if (sign1 === 0) { zeros += 1; zeroIndex = 1; }
  if (sign2 === 0) { zeros += 1; zeroIndex = 2; }
  const replacement = [], removed = [];
  if (zeros === 0) {
    replacement.push(canonicalFace(points, foundFace.a, foundFace.b, site));
    replacement.push(canonicalFace(points, foundFace.b, foundFace.c, site));
    replacement.push(canonicalFace(points, foundFace.c, foundFace.a, site));
    removed.push(found);
  } else {
    if (zeros !== 1) throw new Error("distinct site touches more than one face edge");
    const edgeStart = faceEdgeStart(foundFace, zeroIndex), edgeEnd = faceEdgeEnd(foundFace, zeroIndex);
    const owners = active.incidence.get(edgeKey(edgeStart, edgeEnd));
    if (owners === undefined || owners.length < 1 || owners.length > 2) throw new Error("invalid edge incidence");
    for (const owner of owners) {
      const old = active.node(owner).face;
      const other = faceThird(old, edgeStart, edgeEnd);
      replacement.push(canonicalFace(points, edgeStart, site, other));
      replacement.push(canonicalFace(points, site, edgeEnd, other));
      removed.push(owner);
    }
  }
  active.replace(removed, replacement);
}

function legalize(points, active, budget) {
  const queue = new MinQueue();
  for (const [key, owners] of active.incidence) if (owners.length === 2) queue.add(key);
  while (!queue.isEmpty) {
    budget.charge("legalize", 1);
    const item = queue.poll();
    const owners = active.incidence.get(item);
    if (owners === undefined || owners.length !== 2) continue;
    const first = active.node(owners[0]).face, second = active.node(owners[1]).face;
    const u = edgeA(item), v = edgeB(item);
    const firstOpposite = faceThird(first, u, v), secondOpposite = faceThird(second, u, v);
    const left = orient(points[u], points[v], points[firstOpposite]) > 0 ? firstOpposite : secondOpposite;
    const right = left === firstOpposite ? secondOpposite : firstOpposite;
    if (orient(points[u], points[v], points[left]) <= 0 || orient(points[u], points[v], points[right]) >= 0)
      throw new Error("inconsistent edge sides");
    if (orient(points[left], points[right], points[u]) * orient(points[left], points[right], points[v]) >= 0) continue;
    const determinant = incircle(points[u], points[v], points[left], points[right]);
    const replacement = edgeKey(left, right);
    if (determinant < 0 || (determinant === 0 && replacement >= item)) continue;
    const faces = [canonicalFace(points, left, right, u), canonicalFace(points, right, left, v)];
    const appended = active.replace([owners[0], owners[1]], faces);
    for (const id of appended) {
      const face = active.node(id).face;
      for (let edge = 0; edge < 3; edge += 1) {
        const key = edgeKey(faceEdgeStart(face, edge), faceEdgeEnd(face, edge));
        const current = active.incidence.get(key);
        if (current !== undefined && current.length === 2) queue.add(key);
      }
    }
  }
}

function addOutputEdge(incidence, key, face) {
  const values = incidence.get(key);
  if (values === undefined) { incidence.set(key, [face, -1]); return; }
  if (values[1] !== -1) throw new Error("nonmanifold final edge");
  values[1] = face;
}

function pointBuffer(canonical) {
  const points = new Array(2 * canonical.points.length);
  for (let i = 0; i < canonical.points.length; i += 1) {
    points[2 * i] = canonical.points[i].x;
    points[2 * i + 1] = canonical.points[i].y;
  }
  return points;
}
function emptyResult(canonical, workUsed) {
  return new Delaunay2D(pointBuffer(canonical), canonical.inputToVertex, canonical.sourceIndices,
    [], [], [], workUsed);
}
function finish(canonical, active, workUsed) {
  const faces = active.sortedFaces();
  const triangles = new Array(3 * faces.length);
  const incidence = new Map();
  for (let i = 0; i < faces.length; i += 1) {
    const face = faces[i];
    triangles[3 * i] = face.a; triangles[3 * i + 1] = face.b; triangles[3 * i + 2] = face.c;
    addOutputEdge(incidence, edgeKey(face.a, face.b), i);
    addOutputEdge(incidence, edgeKey(face.b, face.c), i);
    addOutputEdge(incidence, edgeKey(face.c, face.a), i);
  }
  const keys = [...incidence.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const edges = new Array(2 * keys.length), edgeFaces = new Array(2 * keys.length);
  for (let cursor = 0; cursor < keys.length; cursor += 1) {
    const faceIndexes = incidence.get(keys[cursor]);
    edges[2 * cursor] = edgeA(keys[cursor]); edges[2 * cursor + 1] = edgeB(keys[cursor]);
    edgeFaces[2 * cursor] = faceIndexes[0]; edgeFaces[2 * cursor + 1] = faceIndexes[1];
  }
  return new Delaunay2D(pointBuffer(canonical), canonical.inputToVertex, canonical.sourceIndices,
    triangles, edges, edgeFaces, workUsed);
}

class Delaunay2D {
  #points; #inputToVertex; #sourceIndices; #triangles; #edges; #edgeFaces; #workUsed;
  constructor(points, inputToVertex, sourceIndices, triangles, edges, edgeFaces, workUsed) {
    this.#points = points;
    this.#inputToVertex = inputToVertex;
    this.#sourceIndices = sourceIndices;
    this.#triangles = triangles;
    this.#edges = edges;
    this.#edgeFaces = edgeFaces;
    this.#workUsed = workUsed;
    Object.freeze(this);
  }
  get inputCount() { return this.#inputToVertex.length; }
  get vertexCount() { return this.#points.length / 2; }
  get faceCount() { return this.#triangles.length / 3; }
  get edgeCount() { return this.#edges.length / 2; }
  get workUsed() { return this.#workUsed; }
  #index(index, count) {
    if (typeof index !== "number" || !Number.isSafeInteger(index) || index < 0) {
      throw new DelaunayError("INVALID_INDEX");
    }
    if (index >= count) throw new DelaunayError("INDEX_OUT_OF_RANGE");
    return index;
  }
  #checkDestination(out, offset, width, typed) {
    if (!Array.isArray(out) && !(out instanceof typed)) return false;
    if (!Number.isInteger(offset) || offset < 0 || offset > out.length - width) return false;
    for (let k = 0; k < width; k += 1) if (!writableSlot(out, offset + k)) return false;
    return true;
  }
  pointAt(index) {
    const i = this.#index(index, this.vertexCount);
    return [this.#points[2 * i], this.#points[2 * i + 1]];
  }
  triangleAt(index) {
    const i = this.#index(index, this.faceCount);
    return [this.#triangles[3 * i], this.#triangles[3 * i + 1], this.#triangles[3 * i + 2]];
  }
  edgeAt(index) {
    const i = this.#index(index, this.edgeCount);
    return [this.#edges[2 * i], this.#edges[2 * i + 1]];
  }
  edgeFacesAt(index) {
    const i = this.#index(index, this.edgeCount);
    return [this.#edgeFaces[2 * i], this.#edgeFaces[2 * i + 1]];
  }
  pointInto(index, out, offset = 0) {
    const i = this.#index(index, this.vertexCount);
    if (!this.#checkDestination(out, offset, 2, Float64Array)) throw new DelaunayError("INVALID_OUTPUT");
    out[offset] = this.#points[2 * i];
    out[offset + 1] = this.#points[2 * i + 1];
    return out;
  }
  triangleInto(index, out, offset = 0) {
    const i = this.#index(index, this.faceCount);
    if (!this.#checkDestination(out, offset, 3, Int32Array)) throw new DelaunayError("INVALID_OUTPUT");
    out[offset] = this.#triangles[3 * i];
    out[offset + 1] = this.#triangles[3 * i + 1];
    out[offset + 2] = this.#triangles[3 * i + 2];
    return out;
  }
  edgeInto(index, out, offset = 0) {
    const i = this.#index(index, this.edgeCount);
    if (!this.#checkDestination(out, offset, 2, Int32Array)) throw new DelaunayError("INVALID_OUTPUT");
    out[offset] = this.#edges[2 * i];
    out[offset + 1] = this.#edges[2 * i + 1];
    return out;
  }
  edgeFacesInto(index, out, offset = 0) {
    const i = this.#index(index, this.edgeCount);
    if (!this.#checkDestination(out, offset, 2, Int32Array)) throw new DelaunayError("INVALID_OUTPUT");
    out[offset] = this.#edgeFaces[2 * i];
    out[offset + 1] = this.#edgeFaces[2 * i + 1];
    return out;
  }
  inputVertexAt(index) { return this.#inputToVertex[this.#index(index, this.inputCount)]; }
  sourceIndexAt(index) { return this.#sourceIndices[this.#index(index, this.vertexCount)]; }
  toValues() {
    const points = [];
    for (let i = 0; i < this.vertexCount; i += 1) points.push([this.#points[2 * i], this.#points[2 * i + 1]]);
    const triangles = [];
    for (let i = 0; i < this.faceCount; i += 1) triangles.push(this.triangleAt(i));
    const edges = [];
    for (let i = 0; i < this.edgeCount; i += 1) edges.push(this.edgeAt(i));
    const edgeFaces = [];
    for (let i = 0; i < this.edgeCount; i += 1) edgeFaces.push(this.edgeFacesAt(i));
    return {
      points,
      inputToVertex: this.#inputToVertex.slice(),
      sourceIndices: this.#sourceIndices.slice(),
      triangles,
      edges,
      edgeFaces,
      workUsed: this.#workUsed,
    };
  }
}

/**
 * Build retained exact planar Delaunay topology from an ordered finite binary64
 * site list and explicit deterministic work budget.
 * Implements topology.delaunay-2d 0.1.0 independently of source code.
 * Motivating sketches: survey/out/2018/Generativos/datata and
 * survey/out/2019/generativos/lightcity. No site sampling, palette, renderer or
 * artistic range is established; see the catalog contract for evidence.
 */
export function delaunay2D(config) {
  const record = passiveRecord(config, KEYS);
  const suppliedPoints = recordValue(record, "points");
  if (!Array.isArray(suppliedPoints) || Object.getPrototypeOf(suppliedPoints) !== Array.prototype) fail("INVALID_INPUT");
  const count = suppliedPoints.length;
  if (count > MAX_POINTS) fail("INVALID_INPUT");
  const maxWork = recordValue(record, "maxWork");
  if (!finite(maxWork) || maxWork < 0 || maxWork > MAX_SAFE || !Number.isInteger(maxWork)) fail("INVALID_INPUT");

  // Complete static validation before the canonicalize atomic charge.
  const packed = new Array(2 * count);
  for (let i = 0; i < count; i += 1) {
    const row = passiveArray(arrayItem(suppliedPoints, i), 2);
    packed[2 * i] = number(arrayItem(row, 0));
    packed[2 * i + 1] = number(arrayItem(row, 1));
  }

  const budget = new Budget(maxWork);
  budget.charge("canonicalize", count);
  const originals = new Array(count);
  for (let i = 0; i < count; i += 1) originals[i] = makePoint(packed[2 * i], packed[2 * i + 1]);
  const canonical = canonicalize(originals);
  if (canonical.points.length < 3) return emptyResult(canonical, budget.used);

  const hull = strictHull(canonical.points, budget);
  if (hull.length < 3) return emptyResult(canonical, budget.used);

  const active = new ActiveFaces();
  const root = hull[0];
  const fan = [];
  for (let i = 1; i + 1 < hull.length; i += 1) {
    fan.push(canonicalFace(canonical.points, root, hull[i], hull[i + 1]));
  }
  active.appendSorted(fan);

  const corner = new Array(canonical.points.length).fill(false);
  for (const value of hull) corner[value] = true;
  for (let site = 0; site < canonical.points.length; site += 1) {
    if (!corner[site]) insert(canonical.points, active, site, budget);
  }
  legalize(canonical.points, active, budget);
  return finish(canonical, active, budget.used);
}
