const MAX_SLICES = 89478485;
const MAX_FACES = 715827881;
const SAFE = 9007199254740991;
const TAU = 6.283185307179586;
const KEYS = ["outerRadius", "innerRadius", "bottomZ", "topZ", "slices", "maxFaces"];
const KINDS = ["outer-wall", "inner-wall", "top-annulus", "bottom-annulus"];

/** Static input or retained-result access failure. */
export class MeshError extends Error {
  constructor(code) {
    super(code);
    this.name = "MeshError";
    this.code = code;
  }
}

/** Valid input exceeded its required face budget before geometry allocation. */
export class FaceLimitError extends Error {
  constructor() {
    super("FACE_LIMIT_EXCEEDED");
    this.name = "FaceLimitError";
    this.code = "FACE_LIMIT_EXCEEDED";
  }
}

/** A generated face cannot produce the specified scaled flat normal. */
export class MeshArithmeticError extends Error {
  constructor(faceIndex, stage) {
    super("MESH_ARITHMETIC_INVALID");
    this.name = "MeshArithmeticError";
    this.code = "MESH_ARITHMETIC_INVALID";
    this.faceIndex = faceIndex;
    this.stage = stage;
  }
}

function bad() { throw new MeshError("INVALID_INPUT"); }
function zero(value) { return value === 0 ? 0 : value; }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function record(value) {
  if (!isPlainObject(value)) bad();
  if (Reflect.ownKeys(value).length !== KEYS.length) bad();
  for (const key of KEYS) if (!Object.prototype.hasOwnProperty.call(value, key)) bad();
  return value;
}

function numberValue(value) {
  if (typeof value !== "number" || !finite(value)) bad();
  return zero(value);
}

function count(value, low, high) {
  const n = numberValue(value);
  if (n < low || n > high || n !== Math.floor(n)) bad();
  return n;
}

function accessIndex(value) {
  if (typeof value !== "number" || !finite(value) || value < 0 || value > SAFE || value !== Math.floor(value)) {
    throw new MeshError("INVALID_INDEX");
  }
  return value;
}

function checkedIndex(value, size) {
  if (value < 0 || value > SAFE) throw new MeshError("INVALID_INDEX");
  if (value >= size) throw new MeshError("INDEX_OUT_OF_RANGE");
  return value;
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

function checkDestination(target, offset, width) {
  if ((!Array.isArray(target) && !(target instanceof Float64Array) && !(target instanceof Int32Array)) ||
      typeof offset !== "number" || !Number.isInteger(offset) || offset < 0 || offset > target.length - width) {
    throw new MeshError("INVALID_OUTPUT");
  }
  if (Array.isArray(target)) {
    for (let i = 0; i < width; i += 1) {
      if (!writableSlot(target, offset + i)) throw new MeshError("INVALID_OUTPUT");
    }
  }
}

function put(p, vertex, x, y, z) {
  const i = vertex * 3;
  p[i] = zero(x); p[i + 1] = zero(y); p[i + 2] = zero(z);
}

function ring(p, ringIndex, radius, z, slices) {
  for (let cell = 0; cell < slices; cell += 1) {
    const theta = (TAU * cell) / slices;
    put(p, ringIndex * slices + cell, radius * Math.cos(theta), radius * Math.sin(theta), z);
  }
}

function face(t, f, a, b, c) {
  const i = f * 3;
  t[i] = a; t[i + 1] = b; t[i + 2] = c;
}

function quad(t, f, a, b, c, d) {
  face(t, f, a, b, c); f += 1;
  face(t, f, a, c, d); f += 1;
  return f;
}

function computeNormal(p, t, faceIndex, out) {
  const i = faceIndex * 3;
  const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
  let ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
  let vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
  if (!finite(ux) || !finite(uy) || !finite(uz) || !finite(vx) || !finite(vy) || !finite(vz)) {
    throw new MeshArithmeticError(faceIndex, "edge");
  }
  const su = Math.max(Math.abs(ux), Math.abs(uy), Math.abs(uz));
  const sv = Math.max(Math.abs(vx), Math.abs(vy), Math.abs(vz));
  if (su === 0 || sv === 0) throw new MeshArithmeticError(faceIndex, "edge_scale");
  ux /= su; uy /= su; uz /= su;
  vx /= sv; vy /= sv; vz /= sv;
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const sn = Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz));
  if (sn === 0) throw new MeshArithmeticError(faceIndex, "cross_scale");
  const qx = nx / sn, qy = ny / sn, qz = nz / sn;
  const length = Math.sqrt((qx * qx + qy * qy) + qz * qz);
  out[i] = zero(qx / length); out[i + 1] = zero(qy / length); out[i + 2] = zero(qz / length);
}

class AnnularMesh3D {
  #positions; #normals; #triangles; #slices;
  constructor(positions, normals, triangles, slices) {
    this.#positions = positions; this.#normals = normals; this.#triangles = triangles; this.#slices = slices;
    Object.freeze(this);
  }
  get vertexCount() { return this.#positions.length / 3; }
  get faceCount() { return this.#triangles.length / 3; }
  #triple(data, index) {
    const i = index * 3;
    return [data[i], data[i + 1], data[i + 2]];
  }
  vertexAt(index) { return this.#triple(this.#positions, checkedIndex(accessIndex(index), this.vertexCount)); }
  normalAt(index) { return this.#triple(this.#normals, checkedIndex(accessIndex(index), this.faceCount)); }
  triangleAt(index) {
    const i = checkedIndex(accessIndex(index), this.faceCount) * 3;
    return [this.#triangles[i], this.#triangles[i + 1], this.#triangles[i + 2]];
  }
  faceKindAt(index) { return KINDS[Math.floor((checkedIndex(accessIndex(index), this.faceCount) % 8) / 2)]; }
  cellAt(index) { return Math.floor(checkedIndex(accessIndex(index), this.faceCount) / 8); }
  #into(data, index, output, offset) {
    checkDestination(output, offset, 3);
    const i = index * 3;
    output[offset] = data[i]; output[offset + 1] = data[i + 1]; output[offset + 2] = data[i + 2];
  }
  vertexInto(index, output, offset) { this.#into(this.#positions, checkedIndex(accessIndex(index), this.vertexCount), output, offset); }
  normalInto(index, output, offset) { this.#into(this.#normals, checkedIndex(accessIndex(index), this.faceCount), output, offset); }
  triangleInto(index, output, offset) {
    const f = checkedIndex(accessIndex(index), this.faceCount);
    checkDestination(output, offset, 3);
    const i = f * 3;
    output[offset] = this.#triangles[i]; output[offset + 1] = this.#triangles[i + 1]; output[offset + 2] = this.#triangles[i + 2];
  }
  toValues() {
    const positions = [], triangles = [], normals = [], faceKinds = [], cells = [];
    for (let i = 0; i < this.vertexCount; i += 1) positions.push(this.vertexAt(i));
    for (let i = 0; i < this.faceCount; i += 1) {
      triangles.push(this.triangleAt(i));
      normals.push(this.normalAt(i));
      faceKinds.push(this.faceKindAt(i));
      cells.push(this.cellAt(i));
    }
    return { positions, triangles, normals, faceKinds, cells };
  }
}

/**
 * Generate an owned indexed closed annular mesh. Implements mesh.annular-solid-3d 0.1.0.
 *
 * Local units are caller-defined. The axis is +Z, and angular cells increase from +X
 * toward +Y. The result contains four welded rings in outer-bottom, outer-top,
 * inner-bottom, inner-top order, and four face kinds per cell: outer wall, inner wall,
 * top annulus, and bottom annulus. There is no seam vertex at 2*PI and no interior
 * radial face.
 *
 * Motivated by survey/out/2017/Generativos/aros/notes.md (the annulusMesh candidate)
 * and evidence/parameter-experiments/annular-mesh/decision.md. The operation has no
 * renderer, style, random state, defaults, or recommended parameter range.
 */
export function annularSolid3D(input) {
  const map = record(input);
  const outer = numberValue(map.outerRadius);
  const inner = numberValue(map.innerRadius);
  if (!(outer > inner && inner > 0)) bad();
  const bottom = numberValue(map.bottomZ);
  const top = numberValue(map.topZ);
  if (!(bottom < top)) bad();
  const slices = count(map.slices, 3, MAX_SLICES);
  const maximum = count(map.maxFaces, 1, MAX_FACES);
  const faces = 8 * slices, vertices = 4 * slices;
  if (faces > maximum) throw new FaceLimitError();

  const p = new Array(vertices * 3).fill(0);
  const n = new Array(faces * 3).fill(0);
  const t = new Array(faces * 3).fill(0);
  ring(p, 0, outer, bottom, slices);
  ring(p, 1, outer, top, slices);
  ring(p, 2, inner, bottom, slices);
  ring(p, 3, inner, top, slices);
  let f = 0;
  for (let cell = 0; cell < slices; cell += 1) {
    const next = (cell + 1) % slices;
    const ob = cell, obt = next, ot = slices + cell, ott = slices + next;
    const ib = 2 * slices + cell, ibt = 2 * slices + next, it = 3 * slices + cell, itt = 3 * slices + next;
    f = quad(t, f, ob, obt, ott, ot);
    f = quad(t, f, ib, it, itt, ibt);
    f = quad(t, f, ot, ott, itt, it);
    f = quad(t, f, ob, ib, ibt, obt);
  }
  for (let i = 0; i < f; i += 1) computeNormal(p, t, i, n);
  return new AnnularMesh3D(p, n, t, slices);
}
