const MAX = 715_827_881;
const SAFE = Number.MAX_SAFE_INTEGER;
const TAU = 6.283185307179586;
const KEYS = ["profile", "slices", "capStart", "capEnd", "maxFaces"];

/** Stable error returned by mesh.radial-profile-surface-3d. */
export class RadialProfileError extends Error {
  constructor(code, faceIndex = undefined, stage = undefined) {
    super(code); this.name = "RadialProfileError"; this.code = code;
    if (faceIndex !== undefined) this.faceIndex = faceIndex;
    if (stage !== undefined) this.stage = stage;
  }
}

function fail(code) { throw new RadialProfileError(code); }
function arithmetic(faceIndex, stage) { throw new RadialProfileError("MESH_ARITHMETIC_INVALID", faceIndex, stage); }
function zero(value) { return value === 0 ? 0 : value; }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function number(value) { if (!finite(value)) fail("INVALID_INPUT"); return zero(value); }
function passiveRecord(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("INVALID_INPUT");
  const prototype = Object.getPrototypeOf(value);
  if ((prototype !== Object.prototype && prototype !== null) || Reflect.ownKeys(value).length !== keys.length) fail("INVALID_INPUT");
  for (const key of keys) { const descriptor = Object.getOwnPropertyDescriptor(value, key); if (!descriptor || !("value" in descriptor)) fail("INVALID_INPUT"); }
  return value;
}
function recordValue(record, key) { return Object.getOwnPropertyDescriptor(record, key).value; }
function passiveArray(value, length = undefined) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || (length !== undefined && value.length !== length)) fail("INVALID_INPUT");
  return value;
}
function arrayValue(array, index) { const descriptor = Object.getOwnPropertyDescriptor(array, String(index)); if (!descriptor || !("value" in descriptor)) fail("INVALID_INPUT"); return descriptor.value; }
function writableArraySlot(array, index) {
  const key = String(index), own = Object.getOwnPropertyDescriptor(array, key);
  if (own !== undefined) return "value" in own && own.writable === true;
  if (!Object.isExtensible(array)) return false;
  for (let prototype = Object.getPrototypeOf(array); prototype !== null; prototype = Object.getPrototypeOf(prototype)) {
    const inherited = Object.getOwnPropertyDescriptor(prototype, key);
    if (inherited !== undefined) return "value" in inherited && inherited.writable === true;
  }
  return Object.isExtensible(array);
}
function integral(value, minimum, maximum) { const result = number(value); if (!Number.isSafeInteger(result) || result < minimum || result > maximum) fail("INVALID_INPUT"); return result; }

function profile(value) {
  const rows = passiveArray(value);
  if (rows.length < 2 || rows.length > 2_147_483_647) fail("INVALID_INPUT");
  const z = new Float64Array(rows.length), radius = new Float64Array(rows.length);
  for (let i = 0; i < rows.length; i += 1) {
    const row = passiveArray(arrayValue(rows, i), 2), zi = number(arrayValue(row, 0)), ri = number(arrayValue(row, 1));
    if (i > 0 && !(z[i - 1] < zi)) fail("INVALID_INPUT");
    if (ri < 0 || (i > 0 && i + 1 < rows.length && ri <= 0)) fail("INVALID_INPUT");
    z[i] = zi; radius[i] = ri;
  }
  if (rows.length === 2 && radius[0] === 0 && radius[1] === 0) fail("INVALID_INPUT");
  return { count: rows.length, z, radius };
}

class Result {
  #positions; #triangles; #normals; #kinds; #bands; #cells;
  constructor(positions, triangles, normals, kinds, bands, cells) {
    this.#positions = positions; this.#triangles = triangles; this.#normals = normals;
    this.#kinds = kinds; this.#bands = bands; this.#cells = cells; Object.freeze(this);
  }
  vertexCount() { return this.#positions.length / 3; }
  faceCount() { return this.#triangles.length / 3; }
  #index(index, size) { if (typeof index !== "number" || !Number.isSafeInteger(index) || index < 0) fail("INVALID_INDEX"); if (index >= size) fail("INDEX_OUT_OF_RANGE"); return index; }
  vertexAt(index) { const i = this.#index(index, this.vertexCount()) * 3; return [zero(this.#positions[i]), zero(this.#positions[i + 1]), zero(this.#positions[i + 2])]; }
  triangleAt(index) { const i = this.#index(index, this.faceCount()) * 3; return [this.#triangles[i], this.#triangles[i + 1], this.#triangles[i + 2]]; }
  normalAt(index) { const i = this.#index(index, this.faceCount()) * 3; return [zero(this.#normals[i]), zero(this.#normals[i + 1]), zero(this.#normals[i + 2])]; }
  faceKindAt(index) { return this.#kinds[this.#index(index, this.faceCount())]; }
  bandAt(index) { return this.#bands[this.#index(index, this.faceCount())]; }
  cellAt(index) { return this.#cells[this.#index(index, this.faceCount())]; }
  #output(out, offset, type) {
    const valid = type === "float" ? out instanceof Float64Array : out instanceof Int32Array;
    if (!valid && !(Array.isArray(out) && Object.getPrototypeOf(out) === Array.prototype)) fail("INVALID_OUTPUT");
    if (typeof offset !== "number" || !Number.isSafeInteger(offset) || offset < 0 || offset > out.length - 3) fail("INVALID_OUTPUT");
    if (Array.isArray(out)) for (let n = 0; n < 3; n += 1) if (!writableArraySlot(out, offset + n)) fail("INVALID_OUTPUT");
  }
  vertexInto(index, out, offset = 0) { const i = this.#index(index, this.vertexCount()) * 3; this.#output(out, offset, "float"); out[offset] = zero(this.#positions[i]); out[offset + 1] = zero(this.#positions[i + 1]); out[offset + 2] = zero(this.#positions[i + 2]); return out; }
  triangleInto(index, out, offset = 0) { const i = this.#index(index, this.faceCount()) * 3; this.#output(out, offset, "int"); out[offset] = this.#triangles[i]; out[offset + 1] = this.#triangles[i + 1]; out[offset + 2] = this.#triangles[i + 2]; return out; }
  normalInto(index, out, offset = 0) { const i = this.#index(index, this.faceCount()) * 3; this.#output(out, offset, "float"); out[offset] = zero(this.#normals[i]); out[offset + 1] = zero(this.#normals[i + 1]); out[offset + 2] = zero(this.#normals[i + 2]); return out; }
  toValues() {
    const vertices = this.vertexCount(), faces = this.faceCount(), positions = new Array(vertices), triangles = new Array(faces), normals = new Array(faces), faceKinds = new Array(faces), bands = new Array(faces), cells = new Array(faces);
    for (let i = 0; i < vertices; i += 1) positions[i] = this.vertexAt(i);
    for (let i = 0; i < faces; i += 1) { triangles[i] = this.triangleAt(i); normals[i] = this.normalAt(i); faceKinds[i] = this.#kinds[i]; bands[i] = this.#bands[i]; cells[i] = this.#cells[i]; }
    return { positions, triangles, normals, faceKinds, bands, cells };
  }
}

function put(data, vertex, x, y, z) { const i = vertex * 3; data[i] = zero(x); data[i + 1] = zero(y); data[i + 2] = zero(z); }
function putFace(triangles, kinds, bands, cells, face, a, b, c, kind, band, cell) { const i = face * 3; triangles[i] = a; triangles[i + 1] = b; triangles[i + 2] = c; kinds[face] = kind; bands[face] = band; cells[face] = cell; return face + 1; }
function normal(positions, triangles, face, normals) {
  const i = face * 3, a = triangles[i] * 3, b = triangles[i + 1] * 3, c = triangles[i + 2] * 3;
  let ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
  if (!finite(ux) || !finite(uy) || !finite(uz)) arithmetic(face, "edge");
  let vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
  if (!finite(vx) || !finite(vy) || !finite(vz)) arithmetic(face, "edge");
  const su = Math.max(Math.abs(ux), Math.max(Math.abs(uy), Math.abs(uz))), sv = Math.max(Math.abs(vx), Math.max(Math.abs(vy), Math.abs(vz)));
  if (su === 0 || sv === 0) arithmetic(face, "edge_scale");
  ux /= su; uy /= su; uz /= su; vx /= sv; vy /= sv; vz /= sv;
  const qx = uy * vz - uz * vy, qy = uz * vx - ux * vz, qz = ux * vy - uy * vx, sn = Math.max(Math.abs(qx), Math.max(Math.abs(qy), Math.abs(qz)));
  if (sn === 0) arithmetic(face, "cross_scale");
  const sx = qx / sn, sy = qy / sn, sz = qz / sn, length = Math.sqrt((sx * sx + sy * sy) + sz * sz);
  normals[i] = zero(sx / length); normals[i + 1] = zero(sy / length); normals[i + 2] = zero(sz / length);
}

/**
 * Owned indexed radial surface generator for mesh.radial-profile-surface-3d 0.1.0.
 * Motivated by survey/out/2017/Generativos/cilindros/notes.md and
 * survey/out/2017/Generativos/fieeee/notes.md. The observed 8/32-slice comparison
 * and the cilindros 128-slice helper establish useful discrete substitutions only:
 * they do not establish defaults, a continuous encouraged range, or capacity advice.
 */
export class RadialProfile3D {
  static generate(config) {
    const record = passiveRecord(config, KEYS), p = profile(recordValue(record, "profile"));
    const slices = integral(recordValue(record, "slices"), 3, MAX);
    const capStart = recordValue(record, "capStart"); if (typeof capStart !== "boolean") fail("INVALID_INPUT");
    const capEnd = recordValue(record, "capEnd"); if (typeof capEnd !== "boolean") fail("INVALID_INPUT");
    const maxFaces = integral(recordValue(record, "maxFaces"), 1, MAX);
    const startPole = p.radius[0] === 0, endPole = p.radius[p.count - 1] === 0;
    const poles = (startPole ? 1 : 0) + (endPole ? 1 : 0), caps = (capStart && !startPole ? 1 : 0) + (capEnd && !endPole ? 1 : 0);
    const facesWide = BigInt(slices) * (2n * BigInt(p.count - 1) - BigInt(poles) + BigInt(caps));
    const verticesWide = BigInt(p.count - poles) * BigInt(slices) + BigInt(poles + caps);
    if (facesWide > BigInt(maxFaces)) fail("FACE_LIMIT_EXCEEDED");
    const faces = Number(facesWide), vertices = Number(verticesWide);
    const positions = new Float64Array(vertices * 3), normals = new Float64Array(faces * 3), triangles = new Int32Array(faces * 3), bands = new Int32Array(faces), cells = new Int32Array(faces), kinds = new Array(faces), starts = new Int32Array(p.count), rings = new Uint8Array(p.count);
    let vertex = 0;
    for (let row = 0; row < p.count; row += 1) { starts[row] = vertex; if (p.radius[row] === 0) put(positions, vertex++, 0, 0, p.z[row]); else { rings[row] = 1; for (let cell = 0; cell < slices; cell += 1) { const theta = (TAU * cell) / slices; put(positions, vertex++, p.radius[row] * Math.cos(theta), p.radius[row] * Math.sin(theta), p.z[row]); } } }
    let startCenter = -1, endCenter = -1;
    if (capStart && rings[0]) { startCenter = vertex; put(positions, vertex++, 0, 0, p.z[0]); }
    if (capEnd && rings[p.count - 1]) { endCenter = vertex; put(positions, vertex++, 0, 0, p.z[p.count - 1]); }
    let face = 0;
    for (let band = 0; band + 1 < p.count; band += 1) for (let cell = 0; cell < slices; cell += 1) { const next = (cell + 1) % slices; if (rings[band] && rings[band + 1]) { const a = starts[band] + cell, b = starts[band] + next, c = starts[band + 1] + next, d = starts[band + 1] + cell; face = putFace(triangles, kinds, bands, cells, face, a, b, c, "side", band, cell); face = putFace(triangles, kinds, bands, cells, face, a, c, d, "side", band, cell); } else if (!rings[band]) face = putFace(triangles, kinds, bands, cells, face, starts[band], starts[band + 1] + next, starts[band + 1] + cell, "side", band, cell); else face = putFace(triangles, kinds, bands, cells, face, starts[band] + cell, starts[band] + next, starts[band + 1], "side", band, cell); }
    if (startCenter >= 0) for (let cell = 0; cell < slices; cell += 1) face = putFace(triangles, kinds, bands, cells, face, startCenter, starts[0] + ((cell + 1) % slices), starts[0] + cell, "start-cap", -1, cell);
    if (endCenter >= 0) for (let cell = 0; cell < slices; cell += 1) face = putFace(triangles, kinds, bands, cells, face, endCenter, starts[p.count - 1] + cell, starts[p.count - 1] + ((cell + 1) % slices), "end-cap", -1, cell);
    for (let i = 0; i < faces; i += 1) normal(positions, triangles, i, normals);
    return new Result(positions, triangles, normals, kinds, bands, cells);
  }
}
