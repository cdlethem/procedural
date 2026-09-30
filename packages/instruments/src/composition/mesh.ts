/**
 * Owned immutable indexed meshes (F8, spatial inputs).
 *
 * Input contract. The library NEVER fetches or decodes model files. A host (or a bundled generator, see
 * `mesh-samples.ts`) hands over `MeshInput`: resolved numbers. `mesh()` validates, COPIES and freezes; the
 * caller's arrays are never retained. Typed arrays cannot be frozen, so storage is private to the composition
 * modules (`meshStorage`, never mutate it); a `Mesh` exposes counts, bounds, a content `key` and read
 * accessors that return copies. Host binding of a user's own model is future work; the persisted form of an
 * instrument is a bundled mesh id plus scalar parameters.
 *
 * Coordinates. Right-handed world space, +Y up. Finite numbers with magnitude at most 1e50 (so every product
 * the library forms is finite); `-0` is stored as `0`. Units are the caller's.
 *
 * Faces. Triangles (`triangles`, 3 indices each) and quadrilaterals (`quads`, 4 indices each); source face `f`
 * is the f-th triangle when `f < triangleCount` of the input, else the next quad. Vertices run
 * COUNTER-CLOCKWISE seen from outside (normal = (b - a) x (c - a)); the outside of a closed mesh is where the
 * normals point. Quads stay one face for topology (edges, adjacency, creases: the diagonal is never an edge)
 * and are triangulated for geometry (area, sampling, visibility) along the SHORTER diagonal (ties: a-c);
 * if that diagonal leaves the quad (its two triangles fold against the quad's Newell normal) the other is
 * used; if both fold the quad is invalid. A quad's normal is the Newell normal (c - a) x (d - b), normalized.
 * A face's area is the sum of its triangles' areas (the surface that is actually drawn and sampled).
 *
 * Degenerate faces. An index outside [0, vertexCount) or a non-integer index ALWAYS throws (naming the face
 * and corner). A face repeating an index, with zero length edge, with |cross| <= 1e-12 * (longest edge)^2
 * (a sliver: sine of the smallest angle at most 1e-12), or a folded quad, is degenerate. `degenerate:
 * "reject"` (default) throws naming the face; `"drop"` removes it, records its input index in `mesh.dropped`,
 * and renumbers the remaining faces (face attributes follow); throws if nothing is left.
 * Vertices no face uses are allowed and reported by the topology, never silently removed.
 *
 * Content hash. `mesh.key` is the lowercase hex SHA-256 of "procedural-mesh/1\n" + counts + positions
 * (little-endian float64) + face sizes/indices (uint32) + attributes sorted by name; `id` is a diagnostic
 * label and is NOT hashed. Derived values (topology, samples) are cached by this key plus their own options,
 * never by appearance. Hash cost about 270 MB/s (pure JavaScript); computed lazily and cached.
 *
 * Limits (measured, see docs/composition-spatial.md): MESH_LIMITS. Over a limit the function throws naming the
 * input to reduce; nothing is truncated.
 */
import { prepareSurfaceAttributes3D } from "@procedurals/javascript";
import { sha256Hex } from "./raster.js";

export type Vec3 = readonly [number, number, number];

export const MESH_LIMITS = Object.freeze({
  maxVertices: 200_000,
  /** Source faces (triangles + quads). */
  maxFaces: 200_000,
  /** Triangles after quads are split. */
  maxTriangles: 400_000,
  maxAttributes: 12,
  maxCoordinate: 1e50,
});

export type AttributeDomain = "vertex" | "face";
export interface MeshAttributeInput {
  readonly name: string;
  readonly domain: AttributeDomain;
  /** Values per element: 1 to 4. */
  readonly size: 1 | 2 | 3 | 4;
  /** Finite numbers, `size` per vertex (or per INPUT face: triangles first, then quads). */
  readonly values: ArrayLike<number>;
}
export interface MeshAttributeInfo { readonly name: string; readonly domain: AttributeDomain; readonly size: 1 | 2 | 3 | 4 }
export type DegeneratePolicy = "reject" | "drop";
export interface MeshInput {
  /** Diagnostic label for messages; not hashed. */
  readonly id: string;
  /** x, y, z per vertex. */
  readonly positions: ArrayLike<number>;
  readonly triangles?: ArrayLike<number>;
  readonly quads?: ArrayLike<number>;
  readonly attributes?: readonly MeshAttributeInput[];
  readonly degenerate?: DegeneratePolicy;
}
export interface Mesh {
  readonly id: string;
  readonly vertexCount: number;
  /** Source faces (triangles and quads). */
  readonly faceCount: number;
  readonly quadCount: number;
  /** Triangles after splitting quads. */
  readonly triangleCount: number;
  /** Input face indices removed by the `drop` policy, ascending. */
  readonly dropped: readonly number[];
  readonly attributes: readonly MeshAttributeInfo[];
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
  /** Lowercase hex SHA-256 of the content (see the module header). Computed lazily. */
  readonly key: string;
}

interface AttributeStorage extends MeshAttributeInfo { readonly values: Float64Array }
export interface MeshStorage {
  readonly positions: Float64Array;
  /** faceStart[f]..faceStart[f+1] index `faceIndices`; sizes 3 or 4. */
  readonly faceStart: Uint32Array;
  readonly faceIndices: Uint32Array;
  /** Triangulation: 3 vertex indices per triangle, and the source face of each. */
  readonly triangles: Uint32Array;
  readonly triangleFace: Uint32Array;
  readonly attributes: readonly AttributeStorage[];
}

const storages = new WeakMap<object, MeshStorage>();
const hashes = new WeakMap<object, string>();

/** The backing storage of a mesh. Internal to the composition modules: NEVER mutate it. */
export function meshStorage(value: Mesh): MeshStorage {
  const store = storages.get(value);
  if (!store) throw new Error("Not a mesh produced by mesh(): use mesh(input) to validate raw data");
  return store;
}
export const isMesh = (value: unknown): value is Mesh => typeof value === "object" && value !== null && storages.has(value);

const SLIVER = 1e-12;
const NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,31}$/;

function crossOf(p: Float64Array, a: number, b: number, c: number, out: Float64Array): number {
  const ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
  const ux = p[b * 3] - ax, uy = p[b * 3 + 1] - ay, uz = p[b * 3 + 2] - az;
  const vx = p[c * 3] - ax, vy = p[c * 3 + 1] - ay, vz = p[c * 3 + 2] - az;
  out[0] = uy * vz - uz * vy; out[1] = uz * vx - ux * vz; out[2] = ux * vy - uy * vx;
  const l1 = ux * ux + uy * uy + uz * uz, l2 = vx * vx + vy * vy + vz * vz;
  const wx = vx - ux, wy = vy - uy, wz = vz - uz, l3 = wx * wx + wy * wy + wz * wz;
  return Math.max(l1, l2, l3);
}

/** True when the triangle is a sliver, a point or a segment. */
function sliver(p: Float64Array, a: number, b: number, c: number, scratch: Float64Array): boolean {
  const longest2 = crossOf(p, a, b, c, scratch);
  if (longest2 === 0) return true;
  const c2 = scratch[0] * scratch[0] + scratch[1] * scratch[1] + scratch[2] * scratch[2];
  return c2 <= SLIVER * SLIVER * longest2 * longest2;
}

function dist2(p: Float64Array, a: number, b: number): number {
  const x = p[a * 3] - p[b * 3], y = p[a * 3 + 1] - p[b * 3 + 1], z = p[a * 3 + 2] - p[b * 3 + 2];
  return x * x + y * y + z * z;
}

/**
 * The two triangles of a quad `(a, b, c, d)`, or a reason it is degenerate. Prefers the shorter diagonal.
 * A valid triangulation has both triangle normals agreeing with the Newell normal (c - a) x (d - b).
 */
function splitQuad(p: Float64Array, q: readonly [number, number, number, number], scratch: Float64Array): { tri: [number, number, number, number, number, number] } | { reason: string } {
  const [a, b, c, d] = q;
  if (a === b || a === c || a === d || b === c || b === d || c === d) return { reason: "repeats a vertex (use a triangle)" };
  const nx = (p[c * 3 + 1] - p[a * 3 + 1]) * (p[d * 3 + 2] - p[b * 3 + 2]) - (p[c * 3 + 2] - p[a * 3 + 2]) * (p[d * 3 + 1] - p[b * 3 + 1]);
  const ny = (p[c * 3 + 2] - p[a * 3 + 2]) * (p[d * 3] - p[b * 3]) - (p[c * 3] - p[a * 3]) * (p[d * 3 + 2] - p[b * 3 + 2]);
  const nz = (p[c * 3] - p[a * 3]) * (p[d * 3 + 1] - p[b * 3 + 1]) - (p[c * 3 + 1] - p[a * 3 + 1]) * (p[d * 3] - p[b * 3]);
  const shortAc = dist2(p, a, c) <= dist2(p, b, d);
  const options: [number, number, number, number, number, number][] = shortAc
    ? [[a, b, c, a, c, d], [a, b, d, b, c, d]] : [[a, b, d, b, c, d], [a, b, c, a, c, d]];
  for (const t of options) {
    if (sliver(p, t[0], t[1], t[2], scratch)) continue;
    const d1 = scratch[0] * nx + scratch[1] * ny + scratch[2] * nz;
    if (sliver(p, t[3], t[4], t[5], scratch)) continue;
    const d2 = scratch[0] * nx + scratch[1] * ny + scratch[2] * nz;
    if (d1 > 0 && d2 > 0) return { tri: t };
  }
  return { reason: "is folded, non-convex on both diagonals, or has zero area" };
}

function number(label: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number (got ${String(value)})`);
  return value;
}

/** Validate, copy and freeze a mesh. Failures name the mesh, the face or vertex and the input to change. */
export function mesh(input: MeshInput | Mesh): Mesh {
  if (isMesh(input)) return input;
  const source = input as MeshInput;
  if (source === null || typeof source !== "object" || Array.isArray(source)) throw new Error("Mesh data must be an object");
  const allowed = ["id", "positions", "triangles", "quads", "attributes", "degenerate"];
  for (const key of Reflect.ownKeys(source))
    if (typeof key !== "string" || !allowed.includes(key)) throw new Error(`Mesh data has an unknown field: ${String(key)}`);
  const id = source.id;
  if (typeof id !== "string" || id.length === 0 || id.length > 120) throw new Error("Mesh needs a non-empty id of at most 120 characters");
  const label = `Mesh "${id}"`;
  const policy = source.degenerate ?? "reject";
  if (policy !== "reject" && policy !== "drop") throw new Error(`${label}: degenerate must be "reject" or "drop"`);

  const rawPositions = source.positions;
  if (rawPositions === null || typeof rawPositions !== "object" || typeof rawPositions.length !== "number") throw new Error(`${label}: positions must be an array of x, y, z numbers`);
  if (rawPositions.length % 3 !== 0 || rawPositions.length < 3) throw new Error(`${label}: positions has ${rawPositions.length} numbers; expected a positive multiple of 3 (x, y, z per vertex)`);
  const vertexCount = rawPositions.length / 3;
  if (vertexCount > MESH_LIMITS.maxVertices) throw new Error(`${label}: ${vertexCount} vertices; the limit is ${MESH_LIMITS.maxVertices}; reduce positions`);
  const positions = new Float64Array(rawPositions.length);
  for (let i = 0; i < rawPositions.length; i++) {
    const v = number(`${label}: positions[${i}] (vertex ${Math.floor(i / 3)}, ${"xyz"[i % 3]})`, rawPositions[i]);
    if (Math.abs(v) > MESH_LIMITS.maxCoordinate) throw new Error(`${label}: positions[${i}] = ${v} exceeds the coordinate limit ${MESH_LIMITS.maxCoordinate}`);
    positions[i] = v === 0 ? 0 : v;
  }

  const readFaces = (field: "triangles" | "quads", size: 3 | 4): number[] => {
    const raw = source[field];
    if (raw === undefined) return [];
    if (raw === null || typeof raw !== "object" || typeof raw.length !== "number" || raw.length % size !== 0)
      throw new Error(`${label}: ${field} must be an array whose length is a multiple of ${size}`);
    const out: number[] = new Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      const v = raw[i];
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= vertexCount)
        throw new Error(`${label}: ${field} face ${Math.floor(i / size)} corner ${i % size} is ${String(v)}; expected an integer in 0..${vertexCount - 1}`);
      out[i] = v;
    }
    return out;
  };
  const inTriangles = readFaces("triangles", 3), inQuads = readFaces("quads", 4);
  const inputFaces = inTriangles.length / 3 + inQuads.length / 4;
  if (inputFaces === 0) throw new Error(`${label} needs at least one triangle or quad`);
  if (inputFaces > MESH_LIMITS.maxFaces) throw new Error(`${label}: ${inputFaces} faces; the limit is ${MESH_LIMITS.maxFaces}; reduce triangles/quads`);

  const scratch = new Float64Array(3);
  const kept: number[] = [];
  const dropped: number[] = [];
  const triangleOut: number[] = [], triangleFace: number[] = [], faceIndices: number[] = [], faceStart: number[] = [0];
  const reject = (face: number, why: string): void => {
    if (policy === "reject") throw new Error(`${label}: face ${face} (${face < inTriangles.length / 3 ? "triangle" : "quad"}) ${why}; fix it or pass degenerate: "drop"`);
    dropped.push(face);
  };
  let faceOut = 0;
  for (let f = 0; f < inputFaces; f++) {
    const isTriangle = f < inTriangles.length / 3;
    if (isTriangle) {
      const a = inTriangles[f * 3], b = inTriangles[f * 3 + 1], c = inTriangles[f * 3 + 2];
      if (a === b || a === c || b === c) { reject(f, "repeats a vertex index"); continue; }
      if (sliver(positions, a, b, c, scratch)) { reject(f, "has zero area (a sliver, point or segment)"); continue; }
      faceIndices.push(a, b, c); triangleOut.push(a, b, c); triangleFace.push(faceOut);
    } else {
      const k = (f - inTriangles.length / 3) * 4;
      const q = [inQuads[k], inQuads[k + 1], inQuads[k + 2], inQuads[k + 3]] as const;
      const split = splitQuad(positions, q, scratch);
      if ("reason" in split) { reject(f, split.reason); continue; }
      faceIndices.push(q[0], q[1], q[2], q[3]); triangleOut.push(...split.tri); triangleFace.push(faceOut, faceOut);
    }
    faceStart.push(faceIndices.length); kept.push(f); faceOut++;
  }
  if (faceOut === 0) throw new Error(`${label}: every face is degenerate`);
  if (triangleOut.length / 3 > MESH_LIMITS.maxTriangles) throw new Error(`${label}: ${triangleOut.length / 3} triangles after splitting quads; the limit is ${MESH_LIMITS.maxTriangles}; reduce quads`);

  const attrSource = source.attributes ?? [];
  if (!Array.isArray(attrSource) || attrSource.length > MESH_LIMITS.maxAttributes) throw new Error(`${label}: attributes must be an array of at most ${MESH_LIMITS.maxAttributes}`);
  const names = new Set<string>();
  const attributes: AttributeStorage[] = attrSource.map((attribute): AttributeStorage => {
    const { name, domain, size, values } = attribute;
    if (typeof name !== "string" || !NAME.test(name)) throw new Error(`${label}: attribute name ${JSON.stringify(name)} must match ${NAME}`);
    if (names.has(name)) throw new Error(`${label}: attribute "${name}" is repeated`);
    names.add(name);
    if (domain !== "vertex" && domain !== "face") throw new Error(`${label}: attribute "${name}" domain must be "vertex" or "face"`);
    if (size !== 1 && size !== 2 && size !== 3 && size !== 4) throw new Error(`${label}: attribute "${name}" size must be 1, 2, 3 or 4`);
    const elements = domain === "vertex" ? vertexCount : inputFaces;
    if (values === null || typeof values !== "object" || values.length !== elements * size)
      throw new Error(`${label}: attribute "${name}" has ${values?.length} values; expected ${elements * size} (${elements} ${domain}s x ${size})`);
    const stored = new Float64Array(domain === "vertex" ? elements * size : faceOut * size);
    if (domain === "vertex") {
      for (let i = 0; i < stored.length; i++) { const v = number(`${label}: attribute "${name}"[${i}]`, values[i]); stored[i] = v === 0 ? 0 : v; }
    } else {
      for (let f = 0; f < inputFaces; f++) for (let c = 0; c < size; c++) number(`${label}: attribute "${name}" face ${f}`, values[f * size + c]);
      kept.forEach((original, f) => { for (let c = 0; c < size; c++) { const v = values[original * size + c]; stored[f * size + c] = v === 0 ? 0 : v; } });
    }
    return { name, domain, size, values: stored };
  }).sort((x, y) => (x.name < y.name ? -1 : 1));

  let low: [number, number, number] = [Infinity, Infinity, Infinity], high: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) {
    if (positions[i + k] < low[k]) low[k] = positions[i + k];
    if (positions[i + k] > high[k]) high[k] = positions[i + k];
  }
  const store: MeshStorage = {
    positions, faceStart: Uint32Array.from(faceStart), faceIndices: Uint32Array.from(faceIndices),
    triangles: Uint32Array.from(triangleOut), triangleFace: Uint32Array.from(triangleFace), attributes,
  };
  const result: Mesh = {
    id, vertexCount, faceCount: faceOut, quadCount: faceStart.slice(1).filter((end, f) => end - faceStart[f] === 4).length,
    triangleCount: triangleOut.length / 3, dropped: Object.freeze(dropped),
    attributes: Object.freeze(attributes.map(({ name, domain, size }) => Object.freeze({ name, domain, size }))),
    bounds: Object.freeze({ min: Object.freeze(low) as Vec3, max: Object.freeze(high) as Vec3 }),
    get key() { return meshKey(this); },
  };
  storages.set(result, store);
  return Object.freeze(result);
}

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
function bytesOf(array: Float64Array | Uint32Array): Uint8Array {
  if (LITTLE_ENDIAN) return new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  const view = new DataView(new ArrayBuffer(array.byteLength));
  for (let i = 0; i < array.length; i++) array instanceof Float64Array ? view.setFloat64(i * 8, array[i], true) : view.setUint32(i * 4, array[i], true);
  return new Uint8Array(view.buffer);
}
const text = (value: string): Uint8Array => new TextEncoder().encode(value);

function meshKey(value: Mesh): string {
  const hit = hashes.get(value);
  if (hit) return hit;
  const s = meshStorage(value);
  const chunks: Uint8Array[] = [text(`procedural-mesh/1\n${value.vertexCount} ${value.faceCount}\n`), bytesOf(s.positions), bytesOf(s.faceStart), bytesOf(s.faceIndices)];
  for (const a of s.attributes) chunks.push(text(`\n${a.name} ${a.domain} ${a.size}\n`), bytesOf(a.values));
  const key = sha256Hex(...chunks);
  hashes.set(value, key);
  return key;
}

// ---------------------------------------------------------------------------------------------
// Read accessors (copies)

export function meshData(value: Mesh): { positions: Float64Array; triangles: number[]; quads: number[]; attributes: MeshAttributeInput[] } {
  const s = meshStorage(value);
  const triangles: number[] = [], quads: number[] = [], faceOrder: number[] = [];
  for (let f = 0; f < value.faceCount; f++) if (s.faceStart[f + 1] - s.faceStart[f] === 3) { triangles.push(...s.faceIndices.subarray(s.faceStart[f], s.faceStart[f + 1])); faceOrder.push(f); }
  for (let f = 0; f < value.faceCount; f++) if (s.faceStart[f + 1] - s.faceStart[f] === 4) { quads.push(...s.faceIndices.subarray(s.faceStart[f], s.faceStart[f + 1])); faceOrder.push(f); }
  const attributes = s.attributes.map((a): MeshAttributeInput => {
    if (a.domain === "vertex") return { name: a.name, domain: a.domain, size: a.size, values: a.values.slice() };
    const out = new Float64Array(a.values.length);
    faceOrder.forEach((f, i) => { for (let c = 0; c < a.size; c++) out[i * a.size + c] = a.values[f * a.size + c]; });
    return { name: a.name, domain: a.domain, size: a.size, values: out };
  });
  return { positions: s.positions.slice(), triangles, quads, attributes };
}

export function meshVertex(value: Mesh, index: number): Vec3 {
  if (!Number.isInteger(index) || index < 0 || index >= value.vertexCount) throw new Error(`Mesh "${value.id}": vertex ${index} is outside 0..${value.vertexCount - 1}`);
  const p = meshStorage(value).positions;
  return [p[index * 3], p[index * 3 + 1], p[index * 3 + 2]];
}
/** Vertex indices of source face `face`, in stored (counter-clockwise) order: 3 or 4 of them. */
export function meshFace(value: Mesh, face: number): readonly number[] {
  if (!Number.isInteger(face) || face < 0 || face >= value.faceCount) throw new Error(`Mesh "${value.id}": face ${face} is outside 0..${value.faceCount - 1}`);
  const s = meshStorage(value);
  return Array.from(s.faceIndices.subarray(s.faceStart[face], s.faceStart[face + 1]));
}
export function meshAttribute(value: Mesh, name: string): { name: string; domain: AttributeDomain; size: 1 | 2 | 3 | 4; values: Float64Array } {
  const found = meshStorage(value).attributes.find((a) => a.name === name);
  if (!found) throw new Error(`Mesh "${value.id}" has no attribute "${name}"`);
  return { name: found.name, domain: found.domain, size: found.size, values: found.values.slice() };
}

// ---------------------------------------------------------------------------------------------
// Derived geometry (cached per mesh object)

export interface MeshDerived {
  /** Unit normal and area of every TRIANGLE (3 and 1 numbers each). */
  readonly triangleNormals: Float64Array;
  readonly triangleAreas: Float64Array;
  /** Unit (Newell) normal, area (sum of its triangles) and centroid (vertex mean) of every source FACE. */
  readonly faceNormals: Float64Array;
  readonly faceAreas: Float64Array;
  readonly faceCentroids: Float64Array;
  readonly area: number;
  readonly signedVolume: number;
}
const derivedCache = new WeakMap<object, MeshDerived>();
export function meshDerived(value: Mesh): MeshDerived {
  const hit = derivedCache.get(value);
  if (hit) return hit;
  const s = meshStorage(value), p = s.positions;
  const T = value.triangleCount, F = value.faceCount;
  const triangleNormals = new Float64Array(T * 3), triangleAreas = new Float64Array(T);
  const faceAreas = new Float64Array(F), faceNormals = new Float64Array(F * 3), faceCentroids = new Float64Array(F * 3);
  const scratch = new Float64Array(3);
  let area = 0, volume = 0;
  // Volume about the bounds centre keeps the divergence sum well conditioned for meshes far from the origin.
  const ox = (value.bounds.min[0] + value.bounds.max[0]) / 2, oy = (value.bounds.min[1] + value.bounds.max[1]) / 2, oz = (value.bounds.min[2] + value.bounds.max[2]) / 2;
  for (let t = 0; t < T; t++) {
    const a = s.triangles[t * 3], b = s.triangles[t * 3 + 1], c = s.triangles[t * 3 + 2];
    crossOf(p, a, b, c, scratch);
    const length = Math.hypot(scratch[0], scratch[1], scratch[2]);
    triangleNormals[t * 3] = scratch[0] / length; triangleNormals[t * 3 + 1] = scratch[1] / length; triangleNormals[t * 3 + 2] = scratch[2] / length;
    triangleAreas[t] = length / 2;
    faceAreas[s.triangleFace[t]] += length / 2;
    const ax = p[a * 3] - ox, ay = p[a * 3 + 1] - oy, az = p[a * 3 + 2] - oz;
    const bx = p[b * 3] - ox, by = p[b * 3 + 1] - oy, bz = p[b * 3 + 2] - oz;
    const cx = p[c * 3] - ox, cy = p[c * 3 + 1] - oy, cz = p[c * 3 + 2] - oz;
    volume += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
    area += length / 2;
  }
  for (let f = 0; f < F; f++) {
    const start = s.faceStart[f], end = s.faceStart[f + 1];
    let cx = 0, cy = 0, cz = 0;
    for (let k = start; k < end; k++) { const v = s.faceIndices[k]; cx += p[v * 3]; cy += p[v * 3 + 1]; cz += p[v * 3 + 2]; }
    faceCentroids[f * 3] = cx / (end - start); faceCentroids[f * 3 + 1] = cy / (end - start); faceCentroids[f * 3 + 2] = cz / (end - start);
    if (end - start === 3) crossOf(p, s.faceIndices[start], s.faceIndices[start + 1], s.faceIndices[start + 2], scratch);
    else {
      const a = s.faceIndices[start], b = s.faceIndices[start + 1], c = s.faceIndices[start + 2], d = s.faceIndices[start + 3];
      const ux = p[c * 3] - p[a * 3], uy = p[c * 3 + 1] - p[a * 3 + 1], uz = p[c * 3 + 2] - p[a * 3 + 2];
      const vx = p[d * 3] - p[b * 3], vy = p[d * 3 + 1] - p[b * 3 + 1], vz = p[d * 3 + 2] - p[b * 3 + 2];
      scratch[0] = uy * vz - uz * vy; scratch[1] = uz * vx - ux * vz; scratch[2] = ux * vy - uy * vx;
    }
    const length = Math.hypot(scratch[0], scratch[1], scratch[2]);
    faceNormals[f * 3] = scratch[0] / length; faceNormals[f * 3 + 1] = scratch[1] / length; faceNormals[f * 3 + 2] = scratch[2] / length;
  }
  const derived: MeshDerived = { triangleNormals, triangleAreas, faceNormals, faceAreas, faceCentroids, area, signedVolume: volume };
  derivedCache.set(value, derived);
  return derived;
}

export interface MeshMeasures {
  /** Sum of triangle areas, in squared units. */
  readonly area: number;
  /** Signed volume by the divergence theorem. Positive for a closed mesh whose normals point outward;
   *  meaningful only when the topology reports a closed, consistently oriented manifold. */
  readonly signedVolume: number;
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
  /** Length of the bounds diagonal. */
  readonly diagonal: number;
}
export function meshMeasures(value: Mesh): MeshMeasures {
  const d = meshDerived(value), { min, max } = value.bounds;
  return Object.freeze({ area: d.area, signedVolume: d.signedVolume, bounds: value.bounds, diagonal: Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) });
}
export function faceNormal(value: Mesh, face: number): Vec3 {
  meshFace(value, face);
  const n = meshDerived(value).faceNormals;
  return [n[face * 3], n[face * 3 + 1], n[face * 3 + 2]];
}
export function faceArea(value: Mesh, face: number): number {
  meshFace(value, face);
  return meshDerived(value).faceAreas[face];
}

const vertexNormalCache = new WeakMap<object, Float64Array>();
/** Unit vertex normals: face normals weighted by the face's interior angle at the vertex. Unused vertices get (0,0,0). */
export function vertexNormals(value: Mesh): Float64Array {
  return internalVertexNormals(value).slice();
}
export function internalVertexNormals(value: Mesh): Float64Array {
  const hit = vertexNormalCache.get(value);
  if (hit) return hit;
  const s = meshStorage(value), p = s.positions, n = meshDerived(value).faceNormals;
  const out = new Float64Array(value.vertexCount * 3);
  for (let f = 0; f < value.faceCount; f++) {
    const start = s.faceStart[f], size = s.faceStart[f + 1] - start;
    for (let k = 0; k < size; k++) {
      const v = s.faceIndices[start + k], prev = s.faceIndices[start + (k + size - 1) % size], next = s.faceIndices[start + (k + 1) % size];
      const ux = p[prev * 3] - p[v * 3], uy = p[prev * 3 + 1] - p[v * 3 + 1], uz = p[prev * 3 + 2] - p[v * 3 + 2];
      const wx = p[next * 3] - p[v * 3], wy = p[next * 3 + 1] - p[v * 3 + 1], wz = p[next * 3 + 2] - p[v * 3 + 2];
      const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
      const angle = Math.atan2(Math.hypot(cx, cy, cz), ux * wx + uy * wy + uz * wz);
      out[v * 3] += n[f * 3] * angle; out[v * 3 + 1] += n[f * 3 + 1] * angle; out[v * 3 + 2] += n[f * 3 + 2] * angle;
    }
  }
  for (let v = 0; v < value.vertexCount; v++) {
    const length = Math.hypot(out[v * 3], out[v * 3 + 1], out[v * 3 + 2]);
    if (length > 0) { out[v * 3] /= length; out[v * 3 + 1] /= length; out[v * 3 + 2] /= length; }
  }
  vertexNormalCache.set(value, out);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Construction helpers

export interface MeshTransform {
  /** Uniform factor or per-axis factors; a negative determinant reverses every face so normals still point outward. */
  readonly scale?: number | Vec3;
  /** Degrees about x, then y, then z (extrinsic, right-handed: positive turns y toward z about x, z toward x about y, x toward y about z). */
  readonly rotate?: Vec3;
  readonly translate?: Vec3;
}
const radians = (degrees: number): [number, number] => {
  const d = ((degrees % 360) + 360) % 360;
  if (d === 0) return [0, 1]; if (d === 90) return [1, 0]; if (d === 180) return [0, -1]; if (d === 270) return [-1, 0];
  const r = degrees * Math.PI / 180;
  return [Math.sin(r), Math.cos(r)];
};

/** Scale, then rotate, then translate every vertex. Attributes and the face structure carry over unchanged. */
export function transformMesh(value: Mesh, transform: MeshTransform, id: string = `${value.id}*`): Mesh {
  const scale: Vec3 = transform.scale === undefined ? [1, 1, 1] : typeof transform.scale === "number" ? [transform.scale, transform.scale, transform.scale] : transform.scale;
  const rotate = transform.rotate ?? [0, 0, 0], move = transform.translate ?? [0, 0, 0];
  for (const [name, values] of [["scale", scale], ["rotate", rotate], ["translate", move]] as const)
    if (values.length !== 3 || values.some((v) => typeof v !== "number" || !Number.isFinite(v))) throw new Error(`transformMesh: ${name} must be finite numbers (x, y, z)`);
  if (scale.some((v) => v === 0)) throw new Error("transformMesh: scale must not be 0 (it would collapse faces)");
  const [sx, cx] = radians(rotate[0]), [sy, cy] = radians(rotate[1]), [sz, cz] = radians(rotate[2]);
  const data = meshData(value), p = data.positions;
  for (let i = 0; i < p.length; i += 3) {
    let x = p[i] * scale[0], y = p[i + 1] * scale[1], z = p[i + 2] * scale[2];
    [y, z] = [y * cx - z * sx, y * sx + z * cx];
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    [x, y] = [x * cz - y * sz, x * sz + y * cz];
    p[i] = x + move[0]; p[i + 1] = y + move[1]; p[i + 2] = z + move[2];
  }
  const flip = scale[0] * scale[1] * scale[2] < 0;
  const triangles = flip ? data.triangles.map((_, i, a) => a[i - (i % 3) + [0, 2, 1][i % 3]]) : data.triangles;
  const quads = flip ? data.quads.map((_, i, a) => a[i - (i % 4) + [0, 3, 2, 1][i % 4]]) : data.quads;
  return mesh({ id, positions: p, triangles, quads, attributes: data.attributes });
}

/** Concatenate meshes (disjoint vertex sets). Attribute sets (name, domain, size) must be identical. */
export function mergeMeshes(id: string, parts: readonly Mesh[]): Mesh {
  if (parts.length === 0) throw new Error("mergeMeshes needs at least one mesh");
  const signature = (m: Mesh) => m.attributes.map((a) => `${a.name}:${a.domain}:${a.size}`).join(",");
  for (const m of parts) if (signature(m) !== signature(parts[0])) throw new Error(`mergeMeshes: "${m.id}" has attributes [${signature(m)}] but "${parts[0].id}" has [${signature(parts[0])}]`);
  const datas = parts.map(meshData);
  let vertices = 0;
  const positions: number[] = [], triangles: number[] = [], quads: number[] = [];
  for (const data of datas) {
    positions.push(...data.positions);
    for (const t of data.triangles) triangles.push(t + vertices);
    for (const q of data.quads) quads.push(q + vertices);
    vertices += data.positions.length / 3;
  }
  // Face attributes follow the merged order: all triangles of every part, then all quads of every part.
  const attributes: MeshAttributeInput[] = parts[0].attributes.map((info, k) => {
    const values: number[] = [];
    const of = (data: (typeof datas)[number]): Float64Array => data.attributes[k].values as Float64Array;
    if (info.domain === "vertex") for (const data of datas) values.push(...of(data));
    else {
      for (const data of datas) values.push(...of(data).slice(0, data.triangles.length / 3 * info.size));
      for (const data of datas) values.push(...of(data).slice(data.triangles.length / 3 * info.size));
    }
    return { name: info.name, domain: info.domain, size: info.size, values };
  });
  return mesh({ id, positions, triangles, quads, attributes });
}

/** An axis-aligned box of six quads centred at `center` with full extents `size`. */
export function boxMesh(size: Vec3, center: Vec3 = [0, 0, 0], id = "box"): Mesh {
  const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
  if (!(hx > 0 && hy > 0 && hz > 0)) throw new Error("boxMesh: every extent of size must be positive");
  const positions: number[] = [];
  for (const y of [-hy, hy]) for (const z of [-hz, hz]) for (const x of [-hx, hx]) positions.push(center[0] + x, center[1] + y, center[2] + z);
  // vertex index = x + 2z + 4y (bits); faces counter-clockwise seen from outside
  const quads = [4, 6, 7, 5, 0, 1, 3, 2, 0, 4, 5, 1, 2, 3, 7, 6, 0, 2, 6, 4, 1, 5, 7, 3];
  return mesh({ id, positions, quads });
}

// ---------------------------------------------------------------------------------------------
// Corner attributes for renderers

export interface CornerAttributes {
  /** x, y, z per output vertex (a triangle corner, or a source vertex shared by triangles when smooth). */
  readonly positions: Float64Array;
  /** Unit normal per output vertex. */
  readonly normals: Float64Array;
  /** Three output-vertex indices per triangle of the mesh's triangulation, in triangle order. */
  readonly triangles: Uint32Array;
  /** Mesh vertex each output vertex came from. */
  readonly sourceVertex: Uint32Array;
}
/**
 * Detached per-corner positions and unit normals for a renderer (for example a WEBGL consumer), computed by the
 * retained `prepareSurfaceAttributes3D` operation (exact degenerate-face detection, no weld, no UV chart): `flat` gives every
 * triangle corner its face normal, `smooth` welds the triangles around a mesh vertex into one vertex whose normal is
 * the normalized SUM of their unit face normals. This is the renderer's normal; sampling and analysis use the
 * angle-weighted `vertexNormals`, which does not double count the diagonal of a quad. The `smooth` result throws
 * where opposite faces cancel to a zero normal. Work is the operation's own bounded work (about 27 numbers per triangle).
 */
export function meshCornerAttributes(value: Mesh, options: { normals: "flat" | "smooth" }): CornerAttributes {
  if (options.normals !== "flat" && options.normals !== "smooth") throw new Error('meshCornerAttributes: normals must be "flat" or "smooth"');
  const s = meshStorage(value), T = value.triangleCount;
  const positions: number[][] = [], triangles: number[][] = [];
  for (let v = 0; v < value.vertexCount; v++) positions.push([s.positions[v * 3], s.positions[v * 3 + 1], s.positions[v * 3 + 2]]);
  for (let t = 0; t < T; t++) triangles.push([s.triangles[t * 3], s.triangles[t * 3 + 1], s.triangles[t * 3 + 2]]);
  let result;
  try {
    result = prepareSurfaceAttributes3D({ positions, triangles, normalMode: options.normals, smoothingGroups: new Array(T).fill(0), cornerUVs: null,
      maxVertices: 3 * T, maxWork: value.vertexCount + 27 * T });
  } catch (error) {
    throw new Error(`Mesh "${value.id}": ${(error as { code?: string }).code ?? "surface attributes failed"} while preparing ${options.normals} corner attributes`);
  }
  return Object.freeze({
    positions: Float64Array.from((result.positions as number[][]).flat()), normals: Float64Array.from((result.normals as number[][]).flat()),
    triangles: Uint32Array.from((result.triangles as number[][]).flat()), sourceVertex: Uint32Array.from(result.sourceVertexIndices as number[]),
  });
}
