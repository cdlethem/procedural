/**
 * Point clouds and seeded surface sampling (F8).
 *
 * A `PointCloud` is owned immutable input like a mesh: positions, optional unit normals and named numeric
 * attributes, copied and validated on entry (`pointCloud`), private storage, content `key`. The library never
 * loads scans; a host that owns a cloud hands over resolved numbers, bundled generators (`sampleSurface` of a
 * bundled mesh, `meshVertexCloud`) supply the rest. Host binding of a user's own cloud is future work.
 * Reconstruction, registration and completion of scans are not offered.
 *
 * Identity. Point `k` has id `p:<source index>` and seed `componentSeed(cloud.seed, id, "point")`. The source
 * index is `k` for a fresh cloud and the ORIGINAL index for clouds made by `selectPoints`/`thinPointCloud`/
 * `cropPointCloud`, so thinning or cropping never renames the points that remain.
 *
 * Surface sampling (`sampleSurface`). Points are placed on a mesh with density proportional to area, by
 * barycentric coordinates in the mesh's triangulation. A sample records its triangle, source face and the
 * barycentric weights `(w0, w1, w2)` of the triangle's three vertices in stored order, so
 * `position = w0 p0 + w1 p1 + w2 p2` exactly (weights are non-negative and sum to 1).
 * PREFIX PROPERTY: sample `k` depends only on `(mesh content, seed, distribution, k)`, never on `count`;
 * the first `n` points of a `count = m` run are exactly the `count = n` run (positions, normals, attributes).
 * - `even` (default): the triangle for sample `k` is `lowerBound(cumulativeArea, frac(s + k / phi))`, a
 *   golden-ratio (Kronecker) sequence, so every triangle's count stays within a few of its exact share for
 *   every prefix, and within a triangle its j-th point (j from 1) is the R2 sequence
 *   `frac(o + j (0.7549, 0.5698))` plus a hashed jitter of width `1 / sqrt(j)` per axis, folded into the
 *   triangle by reflection across its diagonal. The R2 part spreads points without clumping and refines evenly as
 *   `count` grows; the jitter, which depends only on `(seed, triangle, j)`, breaks the visible lattice rows a bare
 *   R2 sequence shows on large flat faces. The offsets `s`, `o` come from the seed (and the triangle index).
 * - `random`: independent hashes of `(seed, k)`; uniform in expectation, clumps and gaps as chance dictates.
 * Normals are the source face's normal (Newell for quads), or with `normals: "smooth"` the barycentric blend
 * of the angle-weighted vertex normals, renormalized (face normal if the blend vanishes). Requested
 * attributes: a vertex attribute is interpolated with the same weights, a face attribute is inherited.
 * Ids `p:<k>`. Work is linear in `count`; more than `POINT_LIMITS.maxPoints` throws.
 */
import type { Camera } from "./camera.js";
import { componentSeed } from "./core.js";
import { internalVertexNormals, meshDerived, meshStorage, type Mesh, type Vec3 } from "./mesh.js";
import { sha256Hex } from "./raster.js";
import { memoized } from "./sources.js";
import type { Site } from "./types.js";

export const POINT_LIMITS = Object.freeze({ maxPoints: 200_000, maxAttributes: 8, maxCoordinate: 1e50 });

export interface PointAttributeInput { readonly name: string; readonly size: 1 | 2 | 3 | 4; readonly values: ArrayLike<number> }
export interface PointCloudInput {
  readonly id: string;
  /** x, y, z per point; may be empty. */
  readonly positions: ArrayLike<number>;
  /** Optional x, y, z per point; each must be a unit vector (length within 1e-6 of 1). */
  readonly normals?: ArrayLike<number>;
  readonly attributes?: readonly PointAttributeInput[];
  /** Base of per-point seeds (uint32); default 0. */
  readonly seed?: number;
}
export interface PointCloud {
  readonly id: string;
  readonly count: number;
  readonly seed: number;
  readonly hasNormals: boolean;
  readonly attributes: readonly { readonly name: string; readonly size: 1 | 2 | 3 | 4 }[];
  /** Null for an empty cloud. */
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 } | null;
  /** Lowercase hex SHA-256 of the content (ids of the kept points included); computed lazily. */
  readonly key: string;
}
interface CloudStorage {
  positions: Float64Array;
  normals: Float64Array | null;
  attributes: readonly { name: string; size: 1 | 2 | 3 | 4; values: Float64Array }[];
  /** Original index of each point, or null when the index is the position. */
  source: Uint32Array | null;
}
const clouds = new WeakMap<object, CloudStorage>();
const cloudKeys = new WeakMap<object, string>();

/** Backing storage of a cloud. Internal to the composition modules: NEVER mutate it. */
export function cloudStorage(cloud: PointCloud): CloudStorage {
  const store = clouds.get(cloud);
  if (!store) throw new Error("Not a point cloud produced by pointCloud(): use pointCloud(input) to validate raw data");
  return store;
}
export const isPointCloud = (value: unknown): value is PointCloud => typeof value === "object" && value !== null && clouds.has(value);
const NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,31}$/;

function finiteValue(label: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number (got ${String(value)})`);
  return value === 0 ? 0 : value;
}

function build<T extends object = object>(id: string, count: number, seed: number, positions: Float64Array, normals: Float64Array | null,
  attributes: CloudStorage["attributes"], source: Uint32Array | null, extra?: T): PointCloud & T {
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) {
    if (positions[i + k] < min[k]) min[k] = positions[i + k];
    if (positions[i + k] > max[k]) max[k] = positions[i + k];
  }
  const cloud = {
    id, count, seed, hasNormals: normals !== null, ...extra,
    attributes: Object.freeze(attributes.map(({ name, size }) => Object.freeze({ name, size }))),
    bounds: count === 0 ? null : Object.freeze({ min: Object.freeze(min) as Vec3, max: Object.freeze(max) as Vec3 }),
    get key(): string { return cloudKey(this as unknown as PointCloud); },
  } as PointCloud & T;
  clouds.set(cloud, { positions, normals, attributes, source });
  return Object.freeze(cloud);
}

/** Validate, copy and freeze a point cloud. Failures name the cloud, the point and the input to change. */
export function pointCloud(input: PointCloudInput | PointCloud): PointCloud {
  if (isPointCloud(input)) return input;
  const source = input as PointCloudInput;
  if (source === null || typeof source !== "object" || Array.isArray(source)) throw new Error("Point cloud data must be an object");
  for (const key of Reflect.ownKeys(source))
    if (typeof key !== "string" || !["id", "positions", "normals", "attributes", "seed"].includes(key)) throw new Error(`Point cloud data has an unknown field: ${String(key)}`);
  const id = source.id;
  if (typeof id !== "string" || id.length === 0 || id.length > 120) throw new Error("Point cloud needs a non-empty id of at most 120 characters");
  const label = `Point cloud "${id}"`;
  const seed = source.seed ?? 0;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error(`${label}: seed must be a uint32 integer`);
  const raw = source.positions;
  if (raw === null || typeof raw !== "object" || typeof raw.length !== "number" || raw.length % 3 !== 0) throw new Error(`${label}: positions must be an array whose length is a multiple of 3`);
  const count = raw.length / 3;
  if (count > POINT_LIMITS.maxPoints) throw new Error(`${label}: ${count} points; the limit is ${POINT_LIMITS.maxPoints}; reduce positions`);
  const positions = new Float64Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const v = finiteValue(`${label}: positions[${i}] (point ${Math.floor(i / 3)})`, raw[i]);
    if (Math.abs(v) > POINT_LIMITS.maxCoordinate) throw new Error(`${label}: positions[${i}] = ${v} exceeds the coordinate limit ${POINT_LIMITS.maxCoordinate}`);
    positions[i] = v;
  }
  let normals: Float64Array | null = null;
  if (source.normals !== undefined) {
    const n = source.normals;
    if (n === null || typeof n !== "object" || n.length !== raw.length) throw new Error(`${label}: normals must have ${raw.length} numbers (x, y, z per point)`);
    normals = new Float64Array(raw.length);
    for (let i = 0; i < n.length; i++) normals[i] = finiteValue(`${label}: normals[${i}] (point ${Math.floor(i / 3)})`, n[i]);
    for (let p = 0; p < count; p++)
      if (Math.abs(Math.hypot(normals[p * 3], normals[p * 3 + 1], normals[p * 3 + 2]) - 1) > 1e-6) throw new Error(`${label}: normal of point ${p} is not a unit vector`);
  }
  const names = new Set<string>();
  const attrs = source.attributes ?? [];
  if (!Array.isArray(attrs) || attrs.length > POINT_LIMITS.maxAttributes) throw new Error(`${label}: attributes must be an array of at most ${POINT_LIMITS.maxAttributes}`);
  const attributes = attrs.map((a) => {
    if (typeof a.name !== "string" || !NAME.test(a.name)) throw new Error(`${label}: attribute name ${JSON.stringify(a.name)} must match ${NAME}`);
    if (names.has(a.name)) throw new Error(`${label}: attribute "${a.name}" is repeated`);
    names.add(a.name);
    if (a.size !== 1 && a.size !== 2 && a.size !== 3 && a.size !== 4) throw new Error(`${label}: attribute "${a.name}" size must be 1, 2, 3 or 4`);
    if (a.values === null || typeof a.values !== "object" || a.values.length !== count * a.size) throw new Error(`${label}: attribute "${a.name}" has ${a.values?.length} values; expected ${count * a.size}`);
    const values = new Float64Array(count * a.size);
    for (let i = 0; i < values.length; i++) values[i] = finiteValue(`${label}: attribute "${a.name}"[${i}] (point ${Math.floor(i / a.size)})`, a.values[i]);
    return { name: a.name, size: a.size, values };
  }).sort((x, y) => (x.name < y.name ? -1 : 1));
  return build(id, count, seed, positions, normals, attributes, null);
}

function cloudKey(cloud: PointCloud): string {
  const hit = cloudKeys.get(cloud);
  if (hit) return hit;
  const s = cloudStorage(cloud), encode = (t: string) => new TextEncoder().encode(t);
  const bytes = (a: Float64Array | Uint32Array) => {
    const view = new DataView(new ArrayBuffer(a.byteLength));
    for (let i = 0; i < a.length; i++) a instanceof Float64Array ? view.setFloat64(i * 8, a[i], true) : view.setUint32(i * 4, a[i], true);
    return new Uint8Array(view.buffer);
  };
  const chunks = [encode(`procedural-points/1\n${cloud.count} ${cloud.seed} ${s.normals ? 1 : 0} ${s.source ? 1 : 0}\n`), bytes(s.positions)];
  if (s.normals) chunks.push(bytes(s.normals));
  if (s.source) chunks.push(bytes(s.source));
  for (const a of s.attributes) chunks.push(encode(`\n${a.name} ${a.size}\n`), bytes(a.values));
  const key = sha256Hex(...chunks);
  cloudKeys.set(cloud, key);
  return key;
}

export function pointCloudData(cloud: PointCloud): { positions: Float64Array; normals: Float64Array | null; attributes: PointAttributeInput[]; seed: number } {
  const s = cloudStorage(cloud);
  return { positions: s.positions.slice(), normals: s.normals ? s.normals.slice() : null, seed: cloud.seed,
    attributes: s.attributes.map((a) => ({ name: a.name, size: a.size, values: a.values.slice() })) };
}
export function pointPosition(cloud: PointCloud, index: number): Vec3 {
  if (!Number.isInteger(index) || index < 0 || index >= cloud.count) throw new Error(`Point cloud "${cloud.id}": point ${index} is outside 0..${cloud.count - 1}`);
  const p = cloudStorage(cloud).positions;
  return [p[index * 3], p[index * 3 + 1], p[index * 3 + 2]];
}
/** Stable id of point `index`: `p:<source index>`. */
export function pointId(cloud: PointCloud, index: number): string {
  const s = cloudStorage(cloud);
  return `p:${s.source ? s.source[index] : index}`;
}
export function pointSeed(cloud: PointCloud, index: number): number {
  return componentSeed(cloud.seed, pointId(cloud, index), "point");
}
export function pointAttribute(cloud: PointCloud, name: string): { name: string; size: 1 | 2 | 3 | 4; values: Float64Array } {
  const found = cloudStorage(cloud).attributes.find((a) => a.name === name);
  if (!found) throw new Error(`Point cloud "${cloud.id}" has no attribute "${name}"`);
  return { name: found.name, size: found.size, values: found.values.slice() };
}

/** The listed points (ascending, distinct), keeping their ids, seeds, normals and attributes. */
export function selectPoints(cloud: PointCloud, indices: ArrayLike<number>, id: string = `${cloud.id}~`): PointCloud {
  const s = cloudStorage(cloud), n = indices.length;
  for (let i = 0; i < n; i++) {
    const v = indices[i];
    if (!Number.isInteger(v) || v < 0 || v >= cloud.count) throw new Error(`selectPoints: index ${String(v)} is outside 0..${cloud.count - 1}`);
    if (i > 0 && v <= indices[i - 1]) throw new Error("selectPoints: indices must be strictly ascending");
  }
  const positions = new Float64Array(n * 3), normals = s.normals ? new Float64Array(n * 3) : null, source = new Uint32Array(n);
  const attributes = s.attributes.map((a) => ({ name: a.name, size: a.size, values: new Float64Array(n * a.size) }));
  for (let i = 0; i < n; i++) {
    const from = indices[i];
    for (let c = 0; c < 3; c++) { positions[i * 3 + c] = s.positions[from * 3 + c]; if (normals) normals[i * 3 + c] = s.normals![from * 3 + c]; }
    source[i] = s.source ? s.source[from] : from;
    s.attributes.forEach((a, k) => { for (let c = 0; c < a.size; c++) attributes[k].values[i * a.size + c] = a.values[from * a.size + c]; });
  }
  return build(id, n, cloud.seed, positions, normals, attributes, source);
}

/**
 * The same points (ids, seeds, source indices) with replaced geometry and/or extra attributes: a displaced cloud, or one
 * that gained derived per-point values. Positions and normals, if given, replace the originals (normals must be unit;
 * `null` drops them); added attributes must not repeat an existing name, and at most `POINT_LIMITS.maxAttributes` remain.
 * Failures name the cloud and the input to change. `id` defaults to the original's.
 */
export function derivePointCloud(cloud: PointCloud, change: { id?: string; positions?: ArrayLike<number>; normals?: ArrayLike<number> | null;
  attributes?: readonly PointAttributeInput[] }): PointCloud {
  const s = cloudStorage(cloud), label = `Point cloud "${cloud.id}"`, n = cloud.count;
  const checked = (name: string, values: ArrayLike<number>, length: number, limit: number): Float64Array => {
    if (values === null || typeof values !== "object" || values.length !== length) throw new Error(`${label}: ${name} must have ${length} numbers`);
    const out = new Float64Array(length);
    for (let i = 0; i < length; i++) {
      const v = finiteValue(`${label}: ${name}[${i}]`, values[i]);
      if (Math.abs(v) > limit) throw new Error(`${label}: ${name}[${i}] = ${v} exceeds ${limit}`);
      out[i] = v;
    }
    return out;
  };
  const positions = change.positions === undefined ? s.positions : checked("positions", change.positions, n * 3, POINT_LIMITS.maxCoordinate);
  let normals = s.normals;
  if (change.normals === null) normals = null;
  else if (change.normals !== undefined) {
    normals = checked("normals", change.normals, n * 3, 1 + 1e-6);
    for (let p = 0; p < n; p++) if (Math.abs(Math.hypot(normals[p * 3], normals[p * 3 + 1], normals[p * 3 + 2]) - 1) > 1e-6) throw new Error(`${label}: normal of point ${p} is not a unit vector`);
  }
  const attributes = s.attributes.map((a) => ({ name: a.name, size: a.size, values: a.values }));
  for (const a of change.attributes ?? []) {
    if (typeof a.name !== "string" || !NAME.test(a.name)) throw new Error(`${label}: attribute name ${JSON.stringify(a.name)} must match ${NAME}`);
    if (attributes.some((x) => x.name === a.name)) throw new Error(`${label}: attribute "${a.name}" already exists`);
    if (a.size !== 1 && a.size !== 2 && a.size !== 3 && a.size !== 4) throw new Error(`${label}: attribute "${a.name}" size must be 1, 2, 3 or 4`);
    attributes.push({ name: a.name, size: a.size, values: checked(`attribute "${a.name}"`, a.values, n * a.size, Infinity) });
  }
  if (attributes.length > POINT_LIMITS.maxAttributes) throw new Error(`${label}: ${attributes.length} attributes; the limit is ${POINT_LIMITS.maxAttributes}`);
  attributes.sort((x, y) => (x.name < y.name ? -1 : 1));
  return build(change.id ?? cloud.id, n, cloud.seed, positions, normals, attributes, s.source);
}

/** Deterministic hash of three integers to [0, 1). */
export function mixHash(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13) ^ b, 0xc2b2ae35) >>> 0;
  h = Math.imul(h ^ (h >>> 16) ^ c, 0x27d4eb2f) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Keep `count` of the points, chosen by seeded rank (the points with the smallest hash of `(seed, source
 * index)`). Prefix stable: the set for `count` is contained in the set for `count + 1`. Ids are kept.
 */
export function thinPointCloud(cloud: PointCloud, options: { seed: number; count: number }): PointCloud {
  const { seed, count } = options;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("thinPointCloud: seed must be a uint32 integer");
  if (!Number.isSafeInteger(count) || count < 0 || count > cloud.count) throw new Error(`thinPointCloud: count must be an integer in 0..${cloud.count} (got ${String(count)})`);
  const s = cloudStorage(cloud), rank = new Float64Array(cloud.count);
  for (let i = 0; i < cloud.count; i++) rank[i] = mixHash(seed, s.source ? s.source[i] : i, 0x7e1a);
  const order = Array.from({ length: cloud.count }, (_, i) => i).sort((a, b) => rank[a] - rank[b] || a - b).slice(0, count).sort((a, b) => a - b);
  return selectPoints(cloud, order, `${cloud.id}~${count}`);
}

/** Keep the points inside the closed world box `[min, max]`. Ids are kept. */
export function cropPointCloud(cloud: PointCloud, min: Vec3, max: Vec3): PointCloud {
  for (let k = 0; k < 3; k++) if (!Number.isFinite(min[k]) || !Number.isFinite(max[k]) || min[k] > max[k]) throw new Error("cropPointCloud: min and max must be finite with min <= max on every axis");
  const p = cloudStorage(cloud).positions, keep: number[] = [];
  for (let i = 0; i < cloud.count; i++)
    if (p[i * 3] >= min[0] && p[i * 3] <= max[0] && p[i * 3 + 1] >= min[1] && p[i * 3 + 1] <= max[1] && p[i * 3 + 2] >= min[2] && p[i * 3 + 2] <= max[2]) keep.push(i);
  return selectPoints(cloud, keep, `${cloud.id}[crop]`);
}

/** The mesh's vertices as a cloud (unit vertex normals; unused vertices are omitted), ids by vertex index. */
export function meshVertexCloud(value: Mesh): PointCloud {
  const s = meshStorage(value), normals = internalVertexNormals(value), used: number[] = [];
  const seen = new Uint8Array(value.vertexCount);
  for (const v of s.faceIndices) seen[v] = 1;
  for (let v = 0; v < value.vertexCount; v++) if (seen[v]) used.push(v);
  const positions = new Float64Array(used.length * 3), n = new Float64Array(used.length * 3);
  used.forEach((v, i) => { for (let c = 0; c < 3; c++) { positions[i * 3 + c] = s.positions[v * 3 + c]; n[i * 3 + c] = normals[v * 3 + c]; } });
  return build(`${value.id}:vertices`, used.length, 0, positions, n, [], Uint32Array.from(used));
}

// ---------------------------------------------------------------------------------------------
// Surface sampling

export interface SurfaceSampleOptions {
  /** uint32 stream seed. */
  readonly seed: number;
  /** Number of points, 0 to `POINT_LIMITS.maxPoints`. */
  readonly count: number;
  readonly distribution?: "even" | "random";
  readonly normals?: "face" | "smooth";
  /** Mesh attributes (by name) to carry onto the points. */
  readonly attributes?: readonly string[];
}
export interface SurfaceSamples extends PointCloud {
  readonly distribution: "even" | "random";
  readonly meshKey: string;
}
interface SampleStorage { triangle: Uint32Array; face: Uint32Array; barycentric: Float64Array }
const sampleStorages = new WeakMap<object, SampleStorage>();
const sampleCache = new Map<string, SurfaceSamples>();

const GOLDEN = 0.6180339887498949, R2A = 0.7548776662466927, R2B = 0.5698402909980532;
/** Width of the per-point jitter, in units of the R2 spacing 1 / sqrt(j): it hides the lattice rows a bare R2 sequence shows on large flat faces. */
const JITTER = 1;
const frac = (v: number): number => v - Math.floor(v);

/** Provenance of sample `k`: its triangle, source face and barycentric weights. */
export function sampleSource(samples: SurfaceSamples, index: number): { triangle: number; face: number; barycentric: Vec3 } {
  if (!Number.isInteger(index) || index < 0 || index >= samples.count) throw new Error(`Samples "${samples.id}": sample ${index} is outside 0..${samples.count - 1}`);
  const s = sampleStorages.get(samples)!;
  return { triangle: s.triangle[index], face: s.face[index], barycentric: [s.barycentric[index * 3], s.barycentric[index * 3 + 1], s.barycentric[index * 3 + 2]] };
}

export function sampleSurface(value: Mesh, options: SurfaceSampleOptions): SurfaceSamples {
  const { seed, count } = options;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("sampleSurface: seed must be a uint32 integer");
  if (!Number.isSafeInteger(count) || count < 0 || count > POINT_LIMITS.maxPoints) throw new Error(`sampleSurface: count must be an integer in 0..${POINT_LIMITS.maxPoints} (got ${String(count)}); reduce count`);
  const distribution = options.distribution ?? "even", normalMode = options.normals ?? "face";
  if (distribution !== "even" && distribution !== "random") throw new Error('sampleSurface: distribution must be "even" or "random"');
  if (normalMode !== "face" && normalMode !== "smooth") throw new Error('sampleSurface: normals must be "face" or "smooth"');
  const store = meshStorage(value);
  const wanted = [...(options.attributes ?? [])].sort();
  for (const name of wanted) if (!store.attributes.some((a) => a.name === name)) throw new Error(`sampleSurface: mesh "${value.id}" has no attribute "${name}"`);
  if (new Set(wanted).size !== wanted.length) throw new Error("sampleSurface: attributes must not repeat");
  return memoized(sampleCache, JSON.stringify([value.key, seed, count, distribution, normalMode, wanted]), () => generate(value, seed, count, distribution, normalMode, wanted));
}

function generate(value: Mesh, seed: number, count: number, distribution: "even" | "random", normalMode: "face" | "smooth", wanted: readonly string[]): SurfaceSamples {
  const s = meshStorage(value), d = meshDerived(value), p = s.positions, T = value.triangleCount;
  const cumulative = new Float64Array(T);
  let total = 0;
  for (let t = 0; t < T; t++) { total += d.triangleAreas[t]; cumulative[t] = total; }
  for (let t = 0; t < T; t++) cumulative[t] /= total;
  cumulative[T - 1] = 1;
  const pick = (u: number): number => {
    let lo = 0, hi = T - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cumulative[mid] > u) hi = mid; else lo = mid + 1; }
    return lo;
  };
  const perTriangle = distribution === "even" ? new Uint32Array(T) : null;
  const offset = mixHash(seed, 0xffffff, 0x51);
  const positions = new Float64Array(count * 3), normals = new Float64Array(count * 3);
  const triangle = new Uint32Array(count), face = new Uint32Array(count), barycentric = new Float64Array(count * 3);
  const vertexNormals = normalMode === "smooth" ? internalVertexNormals(value) : null;
  const carried = wanted.map((name) => {
    const a = s.attributes.find((x) => x.name === name)!;
    return { name, size: a.size, domain: a.domain, source: a.values, values: new Float64Array(count * a.size) };
  });
  for (let k = 0; k < count; k++) {
    let t: number, a: number, b: number;
    if (perTriangle) {
      t = pick(frac(offset + k * GOLDEN));
      const j = perTriangle[t]++ + 1, jitter = JITTER / Math.sqrt(j);
      a = frac(mixHash(seed, t, 0x3a) + j * R2A + (mixHash(seed, t * 2 + 1, j) - 0.5) * jitter);
      b = frac(mixHash(seed, t, 0x3b) + j * R2B + (mixHash(seed, t * 2 + 2, j) - 0.5) * jitter);
    } else {
      t = pick(mixHash(seed, k, 0x11)); a = mixHash(seed, k, 0x12); b = mixHash(seed, k, 0x13);
    }
    if (a + b > 1) { a = 1 - a; b = 1 - b; }
    const w0 = 1 - a - b, w1 = a, w2 = b;
    const i0 = s.triangles[t * 3], i1 = s.triangles[t * 3 + 1], i2 = s.triangles[t * 3 + 2], f = s.triangleFace[t];
    triangle[k] = t; face[k] = f; barycentric[k * 3] = w0; barycentric[k * 3 + 1] = w1; barycentric[k * 3 + 2] = w2;
    for (let c = 0; c < 3; c++) positions[k * 3 + c] = w0 * p[i0 * 3 + c] + w1 * p[i1 * 3 + c] + w2 * p[i2 * 3 + c];
    let nx = d.faceNormals[f * 3], ny = d.faceNormals[f * 3 + 1], nz = d.faceNormals[f * 3 + 2];
    if (vertexNormals) {
      const sx = w0 * vertexNormals[i0 * 3] + w1 * vertexNormals[i1 * 3] + w2 * vertexNormals[i2 * 3];
      const sy = w0 * vertexNormals[i0 * 3 + 1] + w1 * vertexNormals[i1 * 3 + 1] + w2 * vertexNormals[i2 * 3 + 1];
      const sz = w0 * vertexNormals[i0 * 3 + 2] + w1 * vertexNormals[i1 * 3 + 2] + w2 * vertexNormals[i2 * 3 + 2];
      const length = Math.hypot(sx, sy, sz);
      if (length > 1e-12) { nx = sx / length; ny = sy / length; nz = sz / length; }
    }
    normals[k * 3] = nx; normals[k * 3 + 1] = ny; normals[k * 3 + 2] = nz;
    for (const c of carried) for (let e = 0; e < c.size; e++)
      c.values[k * c.size + e] = c.domain === "vertex" ? w0 * c.source[i0 * c.size + e] + w1 * c.source[i1 * c.size + e] + w2 * c.source[i2 * c.size + e] : c.source[f * c.size + e];
  }
  const samples: SurfaceSamples = build(`${value.id}:samples`, count, seed, positions, normals,
    carried.map(({ name, size, values }) => ({ name, size: size as 1 | 2 | 3 | 4, values })), null, { distribution, meshKey: value.key });
  sampleStorages.set(samples, { triangle, face, barycentric });
  return samples;
}

// ---------------------------------------------------------------------------------------------
// Projection consumer

export interface ProjectedPoint extends Site {
  /** Position in the cloud (not the source index). */
  readonly index: number;
  /** Camera-space depth (larger is farther). */
  readonly depth: number;
  /** Cosine between the point's normal and the direction to the eye, or null without normals. */
  readonly facing: number | null;
}
export interface ProjectOptions {
  /** `index`: cloud order; `far-to-near`: painter order for opaque or additive grains; `near-to-far`. Ties by index. */
  readonly order?: "index" | "far-to-near" | "near-to-far";
  /** Canvas box `[left, top, right, bottom]`; points projecting outside are dropped. */
  readonly crop?: readonly [number, number, number, number] | null;
  /** Drop points whose normal faces away from the eye (needs normals). */
  readonly cullBackFacing?: boolean;
}
/** Project every point with the camera; points nearer than a perspective near plane are dropped. */
export function projectPoints(cloud: PointCloud, view: Camera, options: ProjectOptions = {}): readonly ProjectedPoint[] {
  const s = cloudStorage(cloud), order = options.order ?? "index", crop = options.crop ?? null;
  if (options.cullBackFacing && !s.normals) throw new Error(`projectPoints: cullBackFacing needs normals but cloud "${cloud.id}" has none`);
  const out: ProjectedPoint[] = [], scratch = new Float64Array(3);
  const perspective = view.options.projection === "perspective", [cx, cy] = view.options.center;
  for (let i = 0; i < cloud.count; i++) {
    const x = s.positions[i * 3], y = s.positions[i * 3 + 1], z = s.positions[i * 3 + 2];
    view.toView(x, y, z, scratch, 0);
    if (perspective && scratch[2] < view.options.near) continue;
    const scale = view.scaleAt(scratch[2]), px = cx + scale * scratch[0], py = cy - scale * scratch[1];
    if (crop && (px < crop[0] || px > crop[2] || py < crop[1] || py > crop[3])) continue;
    let facing: number | null = null;
    if (s.normals) {
      const nx = s.normals[i * 3], ny = s.normals[i * 3 + 1], nz = s.normals[i * 3 + 2];
      if (perspective) { const dx = view.eye[0] - x, dy = view.eye[1] - y, dz = view.eye[2] - z; facing = (nx * dx + ny * dy + nz * dz) / Math.hypot(dx, dy, dz); }
      else facing = 0 - (nx * view.forward[0] + ny * view.forward[1] + nz * view.forward[2]);
      if (options.cullBackFacing && !(facing > 0)) continue;
    }
    const id = pointId(cloud, i);
    out.push(Object.freeze({ id, seed: componentSeed(cloud.seed, id, "point"), position: Object.freeze([px, py] as const), angle: 0, scale: 1, index: i, depth: scratch[2], facing }));
  }
  if (order === "far-to-near") out.sort((a, b) => b.depth - a.depth || a.index - b.index);
  else if (order === "near-to-far") out.sort((a, b) => a.depth - b.depth || a.index - b.index);
  return Object.freeze(out);
}
