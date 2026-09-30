/**
 * Scenes and surface fields for Visibility Drawing (brief 53): WHICH mesh is drawn and the view-independent scalar
 * fields whose iso-contours can be drawn on it.
 *
 * Inputs: a shape id from a validated list (the foundation's bundled meshes plus the composed `assembly`), integer
 * `detail`, the terrain variant, the vase profile and a uint32 seed. Nothing is fetched or decoded; owned meshes are
 * accepted by the lower-level producers (`visibility-features.ts`) as ordinary `Mesh` values, host binding of a
 * user's own model is future work.
 *
 * Output: a frozen `Mesh` cached by construction (a camera, a palette or any material never reaches it) and
 * `Float64Array` fields cached per mesh object. Failure: an out-of-range `detail` throws naming Detail and the shape.
 * Units: world units of the bundled meshes (an assembly spans about 4 units).
 *
 * The assembly is four closed solids on a plinth (an amphora-family vase with an open top, an icosphere, an upright
 * torus and a block) that never touch (gaps of at least 0.01), so hidden-line removal and the painter order have a
 * clear, exact answer and each part occludes the ones behind it. The seed permutes which of four floor slots each part
 * takes, and varies each part's size (0.9 to 1.1) and turn about the vertical axis.
 */
import { componentSeed } from "./core.js";
import { bundledMesh, bundledMeshInfo, icosphereMesh, torusMesh, vaseMesh, vaseProfileNames, terrainVariants, type VaseProfile } from "./mesh-samples.js";
import { meshEdgeAngle, meshEdgeVertices, meshTopology } from "./mesh-topology.js";
import { boxMesh, internalVertexNormals, mergeMeshes, mesh, meshData, meshDerived, meshStorage, transformMesh, type Mesh } from "./mesh.js";
import { memoized } from "./sources.js";

export const visibilityShapes = ["icosphere", "torus", "terrain", "vase", "figure", "assembly"] as const;
export type VisibilityShape = (typeof visibilityShapes)[number];
export const visibilityFields = ["height", "slope", "curvature"] as const;
export type VisibilityField = (typeof visibilityFields)[number];

export interface VisibilitySceneOptions {
  readonly shape: VisibilityShape;
  /** Integer 1 to 8; the icosphere and the assembly accept up to 6 (subdivision levels). Ignored by the figure. */
  readonly detail: number;
  readonly terrainVariant: string;
  readonly vaseProfile: string;
  readonly seed: number;
}

/** Largest `detail` per shape (the icosphere's 81,920 triangles at level 6 is the heaviest mesh offered). */
export const maxSceneDetail = (shape: VisibilityShape): number => (shape === "icosphere" || shape === "assembly" ? 6 : 8);

const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / 0x1_0000_0000;
const sceneCache = new Map<string, Mesh>();

/** Attribute-free copy, so parts with different attributes can be merged. */
function bare(source: Mesh, id: string): Mesh {
  const data = meshData(source);
  return mesh({ id, positions: data.positions, triangles: data.triangles, quads: data.quads });
}

/** The assembly: see the module header. `detail` is the icosphere level; the torus and vase scale with it. */
export function assemblyMesh(detail: number, profile: VaseProfile, seed: number): Mesh {
  const slots: readonly (readonly [number, number])[] = [[-0.85, -0.7], [0.85, -0.7], [-0.85, 0.7], [0.85, 0.7]];
  const parts = ["vase", "sphere", "torus", "block"];
  // seeded permutation: sort by a hash of the part name
  const order = parts.map((name) => ({ name, key: seed === 0 ? parts.indexOf(name) : unit(seed, name, "slot") })).sort((a, b) => a.key - b.key).map((p) => p.name);
  const at = (name: string): readonly [number, number] => slots[order.indexOf(name)];
  const size = (name: string): number => (seed === 0 ? 1 : 0.9 + 0.2 * unit(seed, name, "size"));
  const turn = (name: string): number => (seed === 0 ? 0 : (unit(seed, name, "turn") - 0.5) * 70);
  const floor = 0.15;
  const [[vx, vz], [sx, sz], [tx, tz], [bx, bz]] = ["vase", "sphere", "torus", "block"].map(at);
  const vaseScale = size("vase"), sphereScale = size("sphere"), torusScale = size("torus"), blockScale = size("block");
  const vase = bare(vaseMesh({ profile, slices: 8 * detail, height: 1.7, radius: 0.5 }), "vase");
  const sphere = icosphereMesh(detail, 0.55 * sphereScale);
  const torus = torusMesh({ major: 0.55, minor: 0.14, u: 12 * detail, v: Math.max(6, 6 * detail) });
  const parts3: Mesh[] = [
    boxMesh([3.9, 0.14, 2.7], [0, 0.07, 0], "plinth"),
    transformMesh(vase, { scale: vaseScale, rotate: [0, turn("vase"), 0], translate: [vx, floor + 0.85 * vaseScale, vz] }, "vase"),
    transformMesh(bare(sphere, "sphere"), { translate: [sx, floor + 0.55 * sphereScale, sz] }, "sphere"),
    transformMesh(bare(torus, "torus"), { scale: torusScale, rotate: [90, turn("torus"), 0], translate: [tx, floor + 0.69 * torusScale, tz] }, "torus"),
    transformMesh(boxMesh([0.6, 0.9, 0.6], [0, 0.45, 0], "block"), { scale: blockScale, rotate: [0, turn("block"), 0], translate: [bx, floor, bz] }, "block"),
  ];
  return mergeMeshes(`assembly-${detail}-${profile}-${seed}`, parts3);
}

/** The mesh a scene names, cached by construction. */
export function visibilityMesh(options: VisibilitySceneOptions): Mesh {
  const { shape, detail } = options;
  if (!visibilityShapes.includes(shape)) throw new Error(`Shape must be one of ${visibilityShapes.join(", ")} (got ${String(shape)})`);
  if (!Number.isInteger(detail) || detail < 1 || detail > maxSceneDetail(shape))
    throw new Error(`Detail must be an integer from 1 to ${maxSceneDetail(shape)} for the ${shape} shape (got ${String(detail)})`);
  if (!Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) throw new Error("Visibility Drawing seed must be a uint32 integer");
  if (shape === "terrain" && !terrainVariants.includes(options.terrainVariant as never)) throw new Error(`Terrain must be one of ${terrainVariants.join(", ")} (got ${String(options.terrainVariant)})`);
  if ((shape === "vase" || shape === "assembly") && !vaseProfileNames.includes(options.vaseProfile as VaseProfile)) throw new Error(`Vase profile must be one of ${vaseProfileNames.join(", ")} (got ${String(options.vaseProfile)})`);
  switch (shape) {
    case "icosphere": case "torus": case "figure": return bundledMesh(shape, { detail: shape === "figure" ? bundledMeshInfo("figure").defaultDetail : detail });
    case "terrain": return bundledMesh("terrain", { detail, seed: options.seed, variant: options.terrainVariant });
    case "vase": return bundledMesh("vase", { detail, variant: options.vaseProfile });
    case "assembly": return memoized(sceneCache, JSON.stringify(["assembly", detail, options.vaseProfile, options.seed]), () => assemblyMesh(detail, options.vaseProfile as VaseProfile, options.seed));
  }
}

/** Whether the seed can change this scene. */
export const sceneUsesSeed = (shape: VisibilityShape): boolean => shape === "terrain" || shape === "assembly";

// ---------------------------------------------------------------------------------------------
// Surface fields (view independent)

const fieldCache = new WeakMap<Mesh, Map<VisibilityField, Float64Array>>();

/**
 * Mean curvature at every vertex from the dihedral angles of the mesh's real edges (quad diagonals are not edges, so
 * the choice of triangulation cannot add noise): `H_i = (1/4) sum_e |e| theta_e / A_i` over the edges at the vertex, with
 * `theta_e` the signed fold in radians (positive convex, from `meshEdgeAngle`) and `A_i` the vertex's share of the faces
 * around it (each source face's area divided equally among its corners, so a quad is not skewed by its diagonal). Summed over all vertices this is the integral of mean curvature `1/2 sum |e| theta_e`, and
 * a sphere of radius r gives about 1/r. Positive on convex surface, negative in valleys and on the inside of a torus tube;
 * boundary and non-manifold edges contribute nothing, so a rim vertex is the least reliable. Units 1 / world unit.
 */
export function meanCurvature(source: Mesh): Float64Array {
  const s = meshStorage(source), p = s.positions, V = source.vertexCount;
  const topology = meshTopology(source), area = new Float64Array(V), sum = new Float64Array(V), d = meshDerived(source);
  for (let f = 0; f < source.faceCount; f++) {
    const start = s.faceStart[f], size = s.faceStart[f + 1] - start;
    for (let k = 0; k < size; k++) area[s.faceIndices[start + k]] += d.faceAreas[f] / size;
  }
  for (let e = 0; e < topology.counts.edges; e++) {
    const angle = meshEdgeAngle(topology, e);
    if (Number.isNaN(angle)) continue;
    const [a, b] = meshEdgeVertices(topology, e);
    const contribution = 0.25 * Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]) * angle * Math.PI / 180;
    sum[a] += contribution; sum[b] += contribution;
  }
  const out = new Float64Array(V);
  for (let v = 0; v < V; v++) if (area[v] > 0) out[v] = sum[v] / area[v] + 0;
  return out;
}

/**
 * A per-vertex scalar of the mesh, cached per mesh object. `height` is world y, `slope` the angle in degrees between the
 * vertex normal and +y (0 facing up, 90 vertical, 180 facing down) and `curvature` the mean curvature above.
 */
export function visibilityField(source: Mesh, field: VisibilityField): Float64Array {
  if (!visibilityFields.includes(field)) throw new Error(`Contour field must be one of ${visibilityFields.join(", ")} (got ${String(field)})`);
  let byField = fieldCache.get(source);
  if (!byField) { byField = new Map(); fieldCache.set(source, byField); }
  const hit = byField.get(field);
  if (hit) return hit;
  const V = source.vertexCount;
  let values: Float64Array;
  if (field === "height") { values = new Float64Array(V); const p = meshStorage(source).positions; for (let v = 0; v < V; v++) values[v] = p[v * 3 + 1]; }
  else if (field === "slope") {
    values = new Float64Array(V);
    const n = internalVertexNormals(source);
    for (let v = 0; v < V; v++) values[v] = Math.acos(Math.max(-1, Math.min(1, n[v * 3 + 1]))) * 180 / Math.PI;
  } else values = meanCurvature(source);
  byField.set(field, values);
  return values;
}
