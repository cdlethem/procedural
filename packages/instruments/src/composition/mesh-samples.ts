/**
 * Bundled deterministic meshes (F8 input samples). An instrument that persists only "technique id + scalar
 * params" chooses one of these by a validated select; a host that owns a real model would hand over resolved
 * `MeshInput` instead (future host work). Every producer is a pure function of its options, returns a frozen
 * cached `Mesh` (cache identity is the construction, never appearance), and has documented closed-form
 * measures that the tests check independently.
 *
 * Conventions: right-handed, +Y up, faces counter-clockwise from outside (positive signed volume).
 * - `icosphereMesh(levels, radius)`: a regular icosahedron inscribed in the sphere of `radius`, subdivided by
 *   edge midpoints pushed to the sphere; 20 * 4^levels triangles, 10 * 4^levels + 2 vertices, closed.
 * - `torusMesh({major, minor, u, v})`: ring in the XZ plane around +Y, `u` quads around the ring, `v` around
 *   the tube; u * v quads, closed, Euler characteristic 0.
 * - `terrainMesh({width, depth, columns, rows, height})`: an open height field over `[-width/2, width/2] x
 *   [-depth/2, depth/2]` in (x, z) with `y = height(x, z)`; columns * rows quads facing up; vertex attribute
 *   `height`. A non-finite height throws naming the vertex.
 * - `vaseMesh({profile, slices, ...})`: a profile revolved about the Y axis by `RadialProfile3D` (the same
 *   source the revolved instruments use), rotated so the axis is +Y; face attributes `band` (profile band, -1
 *   for caps), `cell` (angular cell) and `kind` (0 side, 1 bottom cap, 2 top cap).
 * - `figureMesh()`: a faceted standing figure (pedestal, two legs, torso, two arms, head) of seven closed
 *   components, mixing quads and triangles, about 2.4 units tall. The parts are separated by small gaps (0.01 to 0.02),
 *   so no two faces of different parts touch or overlap in space: hidden-line and painter results are exact.
 */
import { RadialProfile3D, gradientNoise2D01 } from "@procedurals/javascript";
import { componentSeed } from "./core.js";
import { boxMesh, mergeMeshes, mesh, MESH_LIMITS, transformMesh, type Mesh, type MeshInput } from "./mesh.js";
import { pointCloud, sampleSurface, type PointCloud, type PointCloudInput, type SurfaceSampleOptions } from "./mesh-sample.js";
import { memoized } from "./sources.js";

const cache = new Map<string, Mesh>();
const cached = (key: unknown[], make: () => Mesh): Mesh => memoized(cache, JSON.stringify(key), make);

function integerIn(name: string, value: number, low: number, high: number): number {
  if (!Number.isInteger(value) || value < low || value > high) throw new Error(`${name} must be an integer in ${low}..${high} (got ${String(value)})`);
  return value;
}
function positive(name: string, value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number (got ${String(value)})`);
  return value;
}

// ---------------------------------------------------------------------------------------------
// Icosphere

const PHI = (1 + Math.sqrt(5)) / 2;
const ICOSAHEDRON = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]];
const ICOSAHEDRON_FACES = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
  3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1];
export const MAX_ICOSPHERE_LEVELS = 6;

export function icosphereMesh(levels: number, radius = 1): Mesh {
  integerIn("icosphere levels", levels, 0, MAX_ICOSPHERE_LEVELS);
  positive("icosphere radius", radius);
  return cached(["icosphere", levels, radius], () => {
    const positions: number[] = [];
    const push = (x: number, y: number, z: number): number => {
      const l = Math.hypot(x, y, z);
      positions.push(x / l * radius, y / l * radius, z / l * radius);
      return positions.length / 3 - 1;
    };
    for (const [x, y, z] of ICOSAHEDRON) push(x, y, z);
    let triangles = ICOSAHEDRON_FACES.slice();
    for (let level = 0; level < levels; level++) {
      const midpoints = new Map<number, number>(), next: number[] = [];
      const mid = (a: number, b: number): number => {
        const key = Math.min(a, b) * 1_000_003 + Math.max(a, b);
        let found = midpoints.get(key);
        if (found === undefined) {
          found = push((positions[a * 3] + positions[b * 3]) / 2, (positions[a * 3 + 1] + positions[b * 3 + 1]) / 2, (positions[a * 3 + 2] + positions[b * 3 + 2]) / 2);
          midpoints.set(key, found);
        }
        return found;
      };
      for (let t = 0; t < triangles.length; t += 3) {
        const a = triangles[t], b = triangles[t + 1], c = triangles[t + 2], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
        next.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
      }
      triangles = next;
    }
    return mesh({ id: `icosphere-${levels}`, positions, triangles });
  });
}

// ---------------------------------------------------------------------------------------------
// Torus

export interface TorusOptions { readonly major?: number; readonly minor?: number; readonly u?: number; readonly v?: number }
export function torusMesh(options: TorusOptions = {}): Mesh {
  const major = positive("torus major radius", options.major ?? 1), minor = positive("torus minor radius", options.minor ?? 0.4);
  if (!(minor < major)) throw new Error("torus minor radius must be smaller than the major radius (otherwise the surface crosses itself)");
  const u = integerIn("torus u", options.u ?? 48, 3, 400), v = integerIn("torus v", options.v ?? 24, 3, 400);
  return cached(["torus", major, minor, u, v], () => {
    const positions: number[] = [], quads: number[] = [];
    for (let i = 0; i < u; i++) for (let j = 0; j < v; j++) {
      const theta = 2 * Math.PI * i / u, phi = 2 * Math.PI * j / v, ring = major + minor * Math.cos(phi);
      positions.push(ring * Math.cos(theta), minor * Math.sin(phi), -ring * Math.sin(theta));
    }
    for (let i = 0; i < u; i++) for (let j = 0; j < v; j++) {
      const i1 = (i + 1) % u, j1 = (j + 1) % v;
      quads.push(i * v + j, i1 * v + j, i1 * v + j1, i * v + j1);
    }
    return mesh({ id: `torus-${u}x${v}`, positions, quads });
  });
}

// ---------------------------------------------------------------------------------------------
// Terrain

export interface TerrainOptions {
  readonly width: number;
  readonly depth: number;
  readonly columns: number;
  readonly rows: number;
  /** Height `y` at world `(x, z)`; must return finite numbers. Trusted code: the library never stores it. */
  readonly height: (x: number, z: number) => number;
  readonly id?: string;
}
/** Terrain for a caller's height function. Not cached: a function has no content identity. */
export function terrainMesh(options: TerrainOptions): Mesh {
  const width = positive("terrain width", options.width), depth = positive("terrain depth", options.depth);
  const columns = integerIn("terrain columns", options.columns, 1, 2000), rows = integerIn("terrain rows", options.rows, 1, 2000);
  if ((columns + 1) * (rows + 1) > MESH_LIMITS.maxVertices || 2 * columns * rows > MESH_LIMITS.maxTriangles)
    throw new Error(`terrain ${columns} x ${rows} needs ${(columns + 1) * (rows + 1)} vertices and ${2 * columns * rows} triangles; the limits are ${MESH_LIMITS.maxVertices} and ${MESH_LIMITS.maxTriangles}; reduce columns or rows`);
  const positions: number[] = [], heights: number[] = [], quads: number[] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
    const x = -width / 2 + width * i / columns, z = -depth / 2 + depth * j / rows, y = options.height(x, z);
    if (typeof y !== "number" || !Number.isFinite(y)) throw new Error(`terrain height at vertex (${i}, ${j}), world (${x}, ${z}) is ${String(y)}; the height function must return finite numbers`);
    positions.push(x, y, z); heights.push(y);
  }
  const at = (i: number, j: number): number => j * (columns + 1) + i;
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) quads.push(at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j));
  return mesh({ id: options.id ?? `terrain-${columns}x${rows}`, positions, quads, attributes: [{ name: "height", domain: "vertex", size: 1, values: heights }] });
}

export const terrainVariants = ["hills", "ridges", "crater", "dunes"] as const;
export type TerrainVariant = (typeof terrainVariants)[number];
/** Named seeded height fields on a 4 x 4 domain, heights within about +-1. */
export function terrainHeight(variant: TerrainVariant, seed: number): (x: number, z: number) => number {
  if (!terrainVariants.includes(variant)) throw new Error(`terrain variant must be one of ${terrainVariants.join(", ")} (got ${String(variant)})`);
  const base = gradientNoise2D01({ seed: componentSeed(seed, variant, "terrain") }), fine = gradientNoise2D01({ seed: componentSeed(seed, variant, "terrain-fine") });
  const n = (x: number, z: number): number => base.sample(x * 0.55 + 31.7, z * 0.55 - 12.3) - 0.5;
  const f = (x: number, z: number): number => fine.sample(x * 1.7 - 5.1, z * 1.7 + 9.4) - 0.5;
  switch (variant) {
    case "hills": return (x, z) => 1.2 * n(x, z) + 0.25 * f(x, z);
    case "ridges": return (x, z) => 1.5 * (1 - Math.abs(2.4 * n(x, z))) - 0.5 + 0.1 * f(x, z);
    case "crater": return (x, z) => { const r = Math.hypot(x, z); return 0.55 * Math.exp(-((r - 1.25) ** 2) / 0.18) - 0.6 * Math.exp(-(r * r) / 0.55) + 0.25 * n(x, z); };
    case "dunes": return (x, z) => 0.3 * Math.sin(1.6 * x + 2.2 * n(x, z) + 0.6 * z) + 0.12 * Math.sin(3.3 * x - 1.3 * z + 3 * f(x, z));
  }
}

// ---------------------------------------------------------------------------------------------
// Vase

/** Profiles as `[axial 0..1, radius multiplier]`, bottom to top. */
export const vaseProfiles = {
  amphora: [[0, 0.3], [0.06, 0.55], [0.3, 1], [0.55, 0.85], [0.78, 0.38], [0.88, 0.34], [0.96, 0.52], [1, 0.5]],
  goblet: [[0, 0.55], [0.05, 0.5], [0.12, 0.14], [0.42, 0.12], [0.55, 0.45], [0.75, 0.85], [1, 0.9]],
  bottle: [[0, 0.7], [0.05, 0.9], [0.5, 0.95], [0.65, 0.7], [0.78, 0.22], [0.98, 0.2], [1, 0.28]],
  urn: [[0, 0.45], [0.1, 0.7], [0.4, 1], [0.7, 0.72], [0.88, 0.5], [1, 0.62]],
} as const;
export type VaseProfile = keyof typeof vaseProfiles;
export const vaseProfileNames = Object.keys(vaseProfiles) as readonly VaseProfile[];
export interface VaseOptions {
  readonly profile: VaseProfile;
  readonly slices?: number;
  readonly height?: number;
  readonly radius?: number;
  /** Close the bottom / top ring with a fan (default: bottom closed, top open like a vessel). */
  readonly capBottom?: boolean;
  readonly capTop?: boolean;
  /**
   * Rings per profile band (integer 1..8, default 1 = the profile's own knots, so the stacked-frusta closed forms hold). Above 1 each band is
   * split at equal axial steps and the radius follows the cubic Hermite curve through the knots (finite-difference slopes in the axial
   * variable), so the profile is C1 between knots and a strand marching over the vase turns smoothly instead of kinking at every band.
   */
  readonly smooth?: number;
}
/** `[axial, radius]` knots with `k - 1` Hermite-interpolated rings inserted in every band; `k = 1` returns the knots. */
function refineProfile(knots: readonly (readonly [number, number])[], k: number): [number, number][] {
  if (k === 1) return knots.map(([a, r]) => [a, r]);
  const slope = (i: number): number => {
    const lo = Math.max(0, i - 1), hi = Math.min(knots.length - 1, i + 1);
    return (knots[hi][1] - knots[lo][1]) / (knots[hi][0] - knots[lo][0]);
  };
  const out: [number, number][] = [];
  for (let i = 0; i < knots.length - 1; i++) {
    const [a0, r0] = knots[i], [a1, r1] = knots[i + 1], da = a1 - a0, m0 = slope(i), m1 = slope(i + 1);
    for (let j = 0; j < k; j++) {
      const u = j / k, u2 = u * u, u3 = u2 * u;
      const r = (2 * u3 - 3 * u2 + 1) * r0 + (u3 - 2 * u2 + u) * da * m0 + (-2 * u3 + 3 * u2) * r1 + (u3 - u2) * da * m1;
      out.push([a0 + da * u, Math.max(r, 1e-3)]);
    }
  }
  out.push([knots[knots.length - 1][0], knots[knots.length - 1][1]]);
  return out;
}
export function vaseMesh(options: VaseOptions): Mesh {
  const profile = vaseProfiles[options.profile];
  if (!profile) throw new Error(`vase profile must be one of ${vaseProfileNames.join(", ")} (got ${String(options.profile)})`);
  const slices = integerIn("vase slices", options.slices ?? 32, 3, 256), height = positive("vase height", options.height ?? 2), radius = positive("vase radius", options.radius ?? 0.6);
  const smooth = integerIn("vase smooth", options.smooth ?? 1, 1, 8);
  const capBottom = options.capBottom ?? true, capTop = options.capTop ?? false;
  return cached(["vase", options.profile, slices, height, radius, capBottom, capTop, smooth], () => {
    const values = RadialProfile3D.generate({
      profile: refineProfile(profile, smooth).map(([axial, r]) => [(axial - 0.5) * height, r * radius]), slices, capStart: capBottom, capEnd: capTop, maxFaces: MESH_LIMITS.maxTriangles,
    }).toValues() as { positions: number[][]; triangles: number[][]; faceKinds: string[]; bands: number[]; cells: number[] };
    // The source revolves about +Z; (x, y, z) -> (x, z, -y) is a proper rotation taking +Z to +Y.
    const positions = values.positions.flatMap(([x, y, z]) => [x, z, -y]);
    const kinds = values.faceKinds.map((k) => (k === "side" ? 0 : k === "start-cap" ? 1 : 2));
    return mesh({
      id: `vase-${options.profile}-${slices}`, positions, triangles: values.triangles.flat(),
      attributes: [{ name: "band", domain: "face", size: 1, values: values.bands }, { name: "cell", domain: "face", size: 1, values: values.cells }, { name: "kind", domain: "face", size: 1, values: kinds }],
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Faceted figure

/** A block whose bottom face (half extents `bw`, `bd`) and top face (`tw`, `td`) are centred on (cx, cz). */
function taper(bw: number, bd: number, tw: number, td: number, y0: number, y1: number, cx = 0, cz = 0, id = "block"): Mesh {
  const positions = [
    cx - bw, y0, cz - bd, cx + bw, y0, cz - bd, cx + bw, y0, cz + bd, cx - bw, y0, cz + bd,
    cx - tw, y1, cz - td, cx + tw, y1, cz - td, cx + tw, y1, cz + td, cx - tw, y1, cz + td];
  return mesh({ id, positions, quads: [0, 1, 2, 3, 4, 7, 6, 5, 1, 0, 4, 5, 2, 1, 5, 6, 3, 2, 6, 7, 0, 3, 7, 4] });
}
/** `headLevels` (0 to 5, default 1) is the subdivision level of the head icosphere: 80 triangles at 1, 5,120 at 4. The body is fixed. */
export function figureMesh(headLevels = 1): Mesh {
  integerIn("figure head levels", headLevels, 0, 5);
  return cached(["figure", headLevels], () => {
    const parts: Mesh[] = [
      boxMesh([1.5, 0.12, 1.0], [0, 0.06, 0], "pedestal"),
      taper(0.17, 0.2, 0.15, 0.17, 0.14, 1.0, -0.2, 0, "leg-left"),
      taper(0.17, 0.2, 0.15, 0.17, 0.14, 1.0, 0.2, 0, "leg-right"),
      taper(0.36, 0.22, 0.5, 0.26, 1.02, 1.76, 0, 0, "torso"),
      transformMesh(taper(0.09, 0.11, 0.13, 0.13, -0.7, 0, 0, 0, "arm"), { rotate: [0, 0, -14], translate: [0.66, 1.68, 0] }, "arm-left"),
      transformMesh(taper(0.09, 0.11, 0.13, 0.13, -0.7, 0, 0, 0, "arm"), { rotate: [0, 0, 14], translate: [-0.66, 1.68, 0] }, "arm-right"),
      transformMesh(icosphereMesh(headLevels, 1), { scale: [0.26, 0.31, 0.27], translate: [0, 2.08, 0.02] }, "head"),
    ];
    return mergeMeshes("figure", parts);
  });
}

// ---------------------------------------------------------------------------------------------
// Selection by id

export type BundledMeshId = "icosphere" | "torus" | "terrain" | "vase" | "figure";
export const bundledMeshIds: readonly BundledMeshId[] = ["icosphere", "torus", "terrain", "vase", "figure"];
export interface BundledMeshInfo {
  readonly id: BundledMeshId;
  readonly title: string;
  /** Whether the result is closed (a solid) or open (a sheet or vessel). */
  readonly closed: boolean;
  /** `detail` is an integer in `[minDetail, maxDetail]`; what it scales is stated in `detailMeaning`. */
  readonly minDetail: number;
  readonly maxDetail: number;
  readonly defaultDetail: number;
  readonly detailMeaning: string;
  readonly usesSeed: boolean;
  /** Valid `variant` names (the first is the default), or empty. */
  readonly variants: readonly string[];
}
const info: Record<BundledMeshId, BundledMeshInfo> = {
  icosphere: { id: "icosphere", title: "Icosphere", closed: true, minDetail: 0, maxDetail: MAX_ICOSPHERE_LEVELS, defaultDetail: 3, detailMeaning: "subdivision levels (20 x 4^levels triangles)", usesSeed: false, variants: [] },
  torus: { id: "torus", title: "Torus", closed: true, minDetail: 1, maxDetail: 8, defaultDetail: 4, detailMeaning: "12 x detail segments around the ring, 6 x detail around the tube", usesSeed: false, variants: [] },
  terrain: { id: "terrain", title: "Terrain", closed: false, minDetail: 1, maxDetail: 8, defaultDetail: 4, detailMeaning: "8 x detail cells per side", usesSeed: true, variants: terrainVariants },
  vase: { id: "vase", title: "Vase", closed: false, minDetail: 1, maxDetail: 8, defaultDetail: 4, detailMeaning: "8 x detail angular slices", usesSeed: false, variants: vaseProfileNames },
  figure: { id: "figure", title: "Faceted figure", closed: true, minDetail: 0, maxDetail: 5, defaultDetail: 1, detailMeaning: "subdivision level of the head icosphere (80 triangles at 1, 5,120 at 4); the body is fixed", usesSeed: false, variants: [] },
};
export function bundledMeshInfo(id: BundledMeshId): BundledMeshInfo {
  const found = info[id];
  if (!found) throw new Error(`Unknown bundled mesh "${String(id)}"; choose one of ${bundledMeshIds.join(", ")}`);
  return found;
}

/** One of the bundled meshes by id (see `bundledMeshInfo` for the meaning of `detail`, `seed` and `variant`). */
export function bundledMesh(id: BundledMeshId, options: { detail?: number; seed?: number; variant?: string } = {}): Mesh {
  const about = bundledMeshInfo(id), detail = options.detail ?? about.defaultDetail, seed = options.seed ?? 0;
  integerIn(`${id} detail`, detail, about.minDetail, about.maxDetail);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error(`${id} seed must be a uint32 integer`);
  const variant = options.variant ?? about.variants[0];
  if (about.variants.length > 0 && !about.variants.includes(variant)) throw new Error(`${id} variant must be one of ${about.variants.join(", ")} (got ${String(variant)})`);
  switch (id) {
    case "icosphere": return icosphereMesh(detail);
    case "torus": return torusMesh({ u: 12 * detail, v: 6 * detail });
    case "vase": return vaseMesh({ profile: variant as VaseProfile, slices: 8 * detail });
    case "figure": return figureMesh(detail);
    case "terrain": {
      const cells = 8 * detail;
      return cached(["terrain", variant, seed, cells], () => terrainMesh({ width: 4, depth: 4, columns: cells, rows: cells, height: terrainHeight(variant as TerrainVariant, seed), id: `terrain-${variant}-${cells}` }));
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Typed descriptors: what a persisted recipe stores

/**
 * A mesh as a recipe stores it: a bundled mesh by id and scalar options, or owned data (a host's resolved
 * `MeshInput`, JSON-compatible when its arrays are plain arrays). Never a function, URL or file name.
 */
export type MeshSource =
  | { readonly kind: "bundled"; readonly id: BundledMeshId; readonly detail?: number; readonly seed?: number; readonly variant?: string }
  | { readonly kind: "data"; readonly data: MeshInput };
export function resolveMeshSource(source: MeshSource): Mesh {
  if (source === null || typeof source !== "object") throw new Error("A mesh source must be an object with a kind");
  if (source.kind === "bundled") return bundledMesh(source.id, { detail: source.detail, seed: source.seed, variant: source.variant });
  if (source.kind === "data") return mesh(source.data);
  throw new Error(`A mesh source kind must be "bundled" or "data" (got ${String((source as { kind?: unknown }).kind)})`);
}
/** A point cloud as a recipe stores it: seeded samples of a mesh source, or owned points. */
export type PointSource =
  | { readonly kind: "samples"; readonly mesh: MeshSource; readonly sampling: SurfaceSampleOptions }
  | { readonly kind: "data"; readonly data: PointCloudInput };
export function resolvePointSource(source: PointSource): PointCloud {
  if (source === null || typeof source !== "object") throw new Error("A point source must be an object with a kind");
  if (source.kind === "samples") return sampleSurface(resolveMeshSource(source.mesh), source.sampling);
  if (source.kind === "data") return pointCloud(source.data);
  throw new Error(`A point source kind must be "samples" or "data" (got ${String((source as { kind?: unknown }).kind)})`);
}
