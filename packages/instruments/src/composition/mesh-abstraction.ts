/**
 * Local mesh abstraction (brief 55): the producers of the instrument, in three SEPARATE stages so an edit only
 * recomputes what it changes.
 *
 * 1. Construction (`meshAbstractionProducts`): a source mesh (bundled and validated by select, or a resolved `Mesh` given
 *    to the direct API; host binding of a user's own mesh or scan is future work), a preserved region turned into a
 *    per-vertex importance field (`mesh-region.ts`), and the constrained edge-collapse simplification of
 *    `mesh-simplify.ts` run through the F7 snapshot cache. The result is a frozen `Abstraction` (a `Mesh` with `error` and
 *    `importance` vertex attributes, `origin` ids and the `source` face of every triangle). Only the source, the region, the
 *    rule, the boundary and crease treatment, the error limit, the facet count and the seed reach it. Changing the facet
 *    count extends or replays the cached snapshots; the camera and every appearance choice never touch it.
 * 2. View (`meshViewProducts`): for one mesh and one camera, the painter order (`paintOrder`) and the projected edge
 *    paths with hidden-line removal (`hiddenLines`), split into region and other edges. Cached per mesh and camera; a
 *    palette, material, opacity or line-weight edit does not reach it.
 * 3. Appearance (`mesh-abstraction-draw.ts`): reads the two.
 *
 * Units. The camera fits the SOURCE bounds (diagonal `D`) so that it never depends on the abstraction: `size` canvas
 * units per `D` (orthographic `zoom = size / D`; perspective `distance = distanceFactor * D`, the same size at the target).
 * The error limit is a fraction of `D`. The facet target is the protected triangles (all three corners at importance 1: they cannot change) plus
 * `keep` of the others, never below `SIMPLIFY_LIMITS.minFaces` in total.
 *
 * Failure. Nothing is repaired: a source over the triangle limit, a non-manifold mesh, an empty band or work past a bound
 * throws naming the control to change.
 */
import { bundledMeshInfo, resolveMeshSource, type BundledMeshId, type MeshSource } from "./mesh-samples.js";
import { camera as makeCamera, type Camera } from "./camera.js";
import { cachedBy } from "./core.js";
import { isMesh, meshAttribute, meshMeasures, meshStorage, type Mesh } from "./mesh.js";
import { regionImportance, type MeshRegion } from "./mesh-region.js";
import { prepareSimplification, simplifyMesh, SIMPLIFY_LIMITS, type Abstraction, type BoundaryMode, type SimplifyRule } from "./mesh-simplify.js";
import { meshBoundaryEdges, meshEdgeVertices, meshFeatureEdges, meshTopology } from "./mesh-topology.js";
import { hiddenLines, meshEdgeCurves, paintOrder, type PaintOrder, type ProjectedPath, type SpatialCurve } from "./visibility.js";
import type { CompositionRun } from "./types.js";

export const SOURCES = ["icosphere", "terrain", "vase", "figure", "torus"] as const satisfies readonly BundledMeshId[];
export type AbstractionSource = (typeof SOURCES)[number];

export interface AbstractionView {
  projection: "orthographic" | "perspective";
  yaw: number; pitch: number; roll: number;
  /** Perspective eye distance in source diagonals. */
  distance: number;
  /** Canvas position of the source's centre and the canvas size of its bounding diagonal. */
  centerX: number; centerY: number; size: number;
}

export interface MeshAbstractionConstruction {
  /** Share of the triangles outside the protected region to keep (the total is never below `SIMPLIFY_LIMITS.minFaces`). */
  keep: number;
  rule: SimplifyRule;
  boundary: BoundaryMode;
  /** Degrees of fold that construction preserves; 0 preserves none. */
  creaseAngle: number;
  /** RMS error target as a fraction of the source diagonal; 0 is none. */
  maxError: number;
  region: MeshRegion;
}

export interface MeshAbstractionComposition {
  kind: "mesh-abstraction";
  seed: number;
  palette: readonly number[];
  /** A bundled descriptor (what the instrument stores) or a resolved mesh (direct API only). */
  source: MeshSource | Mesh;
  construction: MeshAbstractionConstruction;
  view: AbstractionView;
  facets: { mode: "shaded" | "flat" | "none"; opacity: number; light: number; contrast: number };
  lines: { edges: "none" | "outline" | "mesh"; hidden: "drop" | "faint" | "dashed"; weight: number; material: "ink" | "stitch" | "beads"; outlineAngle: number };
  highlight: { mode: "off" | "tint" | "lines" | "both"; amount: number };
  compare: { mode: "off" | "ghost" | "beside"; lines: "outline" | "mesh"; weight: number; opacity: number };
}

export interface MeshAbstractionProducts {
  readonly source: Mesh;
  readonly abstraction: Abstraction;
  readonly targetFaces: number;
  /** Importance of every SOURCE vertex under the region (for drawing the source beside the result). */
  readonly sourceImportance: Float64Array;
}

const importanceCache = new WeakMap<Mesh, Map<string, Float64Array>>();

export function resolveSource(source: MeshSource | Mesh): Mesh {
  return isMesh(source) ? source : resolveMeshSource(source);
}

/** The bundled descriptor of the instrument's source controls (`detail` is one control for every source). */
export function sourceDescriptor(q: { source: string; detail: number; terrainVariant: string; vaseProfile: string }, seed: number): MeshSource {
  const id = q.source as AbstractionSource;
  bundledMeshInfo(id);
  switch (id) {
    case "icosphere": return { kind: "bundled", id, detail: q.detail - 1 };
    case "terrain": return { kind: "bundled", id, detail: q.detail, seed, variant: q.terrainVariant };
    case "vase": return { kind: "bundled", id, detail: q.detail, variant: q.vaseProfile };
    case "torus": return { kind: "bundled", id, detail: q.detail };
    default: return { kind: "bundled", id, detail: q.detail - 1 };
  }
}

function sourceImportance(source: Mesh, region: MeshRegion, seed: number): Float64Array {
  const key = `${JSON.stringify(region)}|${seed}`;
  let byKey = importanceCache.get(source);
  if (!byKey) importanceCache.set(source, byKey = new Map());
  let field = byKey.get(key);
  if (!field) { field = regionImportance(source, region, seed); byKey.set(key, field); if (byKey.size > 8) byKey.delete(byKey.keys().next().value!); }
  return field;
}

/** Triangles whose three corners all have importance 1: the simplifier can never remove or move any of them. */
export function protectedTriangles(source: Mesh, importance: Float64Array): number {
  const tri = meshStorage(source).triangles;
  let count = 0;
  for (let t = 0; t < source.triangleCount; t++) if (importance[tri[t * 3]] >= 1 && importance[tri[t * 3 + 1]] >= 1 && importance[tri[t * 3 + 2]] >= 1) count++;
  return count;
}

function plan(recipe: MeshAbstractionComposition) {
  const source = resolveSource(recipe.source), c = recipe.construction;
  const T = source.triangleCount;
  if (T > SIMPLIFY_LIMITS.maxTriangles) throw new Error(`Source has ${T} triangles; the limit is ${SIMPLIFY_LIMITS.maxTriangles}; lower Source detail`);
  const importance = sourceImportance(source, c.region, recipe.seed), kept = protectedTriangles(source, importance);
  // `keep` is the share of the triangles OUTSIDE the protected region that remain, so the slider means the same thing
  // whatever the region's size.
  const target = Math.max(SIMPLIFY_LIMITS.minFaces, Math.min(T, kept + Math.round(c.keep * (T - kept))));
  const options = {
    targetFaces: target, seed: recipe.seed, region: c.region, rule: c.rule, boundary: c.boundary, creaseAngle: c.creaseAngle,
    maxError: c.maxError * meshMeasures(source).diagonal,
  };
  return { source, target, importance, options };
}

/** Stage 1: source, importance and the cached simplification. */
export function meshAbstractionProducts(recipe: MeshAbstractionComposition): MeshAbstractionProducts {
  const { source, target, importance, options } = plan(recipe);
  return { source, abstraction: simplifyMesh(source, options), targetFaces: target, sourceImportance: importance };
}

/** Cooperative stage 1; `null` when cancelled (nothing is published). */
export async function prepareMeshAbstractionProducts(recipe: MeshAbstractionComposition, cancelled: () => boolean): Promise<MeshAbstractionProducts | null> {
  const { source, target, importance, options } = plan(recipe);
  const abstraction = await prepareSimplification(source, { ...options, cancelled });
  return abstraction ? { source, abstraction, targetFaces: target, sourceImportance: importance } : null;
}

// ---------------------------------------------------------------------------------------------
// Stage 2: the view

/** The camera of a panel: fits the source bounds, independent of any abstraction. */
export function abstractionCamera(source: Mesh, view: AbstractionView, panel: { scale: number; dx: number } = { scale: 1, dx: 0 }): Camera {
  const { min, max } = source.bounds, diagonal = meshMeasures(source).diagonal;
  return makeCamera({
    projection: view.projection, yaw: view.yaw, pitch: view.pitch, roll: view.roll,
    target: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    zoom: view.size * panel.scale / diagonal, distance: (view.projection === "perspective" ? view.distance : 3) * diagonal,
    center: [view.centerX + panel.dx, view.centerY],
  });
}

export interface ViewSpec {
  readonly paint: boolean;
  readonly edges: "none" | "outline" | "mesh";
  /** Fold (degrees) that counts as a crease for `outline`; 0 draws silhouettes and boundaries only. */
  readonly outlineAngle: number;
  /** Per-vertex importance: edges whose two ends are at least 0.5 are labelled `region`. */
  readonly importance: Float64Array | null;
  /** What identifies `importance` for the cache (the region and seed for a source mesh). */
  readonly importanceKey: string;
}
export interface ViewProducts {
  readonly camera: Camera;
  readonly paint: PaintOrder | null;
  /** Visible and hidden runs; `tone` 1 for ordinary edges and 2 for region edges. */
  readonly paths: readonly ProjectedPath[];
}

const viewCache = new WeakMap<Mesh, Map<string, ViewProducts>>();

/** Painter order and hidden-line edge paths for `mesh` seen through `view`. Cached per mesh, camera and selection. */
export function meshViewProducts(mesh: Mesh, view: Camera, spec: ViewSpec, run?: CompositionRun): ViewProducts {
  const regionTag = spec.importance ? `r:${spec.importanceKey}` : "-";
  return cachedBy(viewCache, mesh, `${view.key}|${spec.paint}|${spec.edges}|${spec.outlineAngle}|${regionTag}`, () => {
    const topology = meshTopology(mesh);
    let paint: PaintOrder | null = null;
    if (spec.paint) {
      try { paint = paintOrder(mesh, view, { cull: topology.kind === "closed-manifold" ? "back" : "none", ...(run ? { run } : {}) }); }
      catch (error) { throw new Error(`${(error as Error).message}; lower Source detail or Facets kept`); }
    }
    let paths: readonly ProjectedPath[] = [];
    if (spec.edges !== "none") {
      const selected: number[] = [];
      if (spec.edges === "mesh") for (let e = 0; e < topology.counts.edges; e++) selected.push(e);
      else for (const f of meshFeatureEdges(mesh, topology, view, { crease: spec.outlineAngle > 0 ? spec.outlineAngle : null, silhouette: true, boundary: true })) selected.push(f.edge);
      const importance = spec.importance, inRegion: number[] = [], other: number[] = [];
      for (const e of selected) {
        const [a, b] = meshEdgeVertices(topology, e);
        (importance && importance[a] >= 0.5 && importance[b] >= 0.5 ? inRegion : other).push(e);
      }
      const curves: SpatialCurve[] = [
        ...meshEdgeCurves(mesh, topology, other).map((c) => ({ ...c, tone: 1 })),
        ...meshEdgeCurves(mesh, topology, inRegion).map((c) => ({ ...c, tone: 2 })),
      ];
      try { paths = hiddenLines(mesh, curves, view, { occluders: topology.kind === "closed-manifold" ? "front" : "all", ...(run ? { run } : {}) }).paths; }
      catch (error) { throw new Error(`${(error as Error).message}; use Edges outline, lower Source detail or Facets kept`); }
    }
    return Object.freeze({ camera: view, paint, paths });
  });
}

/** Vertex importance of an abstraction's mesh (the `importance` attribute), for `ViewSpec`. */
export function abstractionImportance(abstraction: Abstraction): Float64Array {
  return meshAttribute(abstraction.mesh, "importance").values;
}

/** True when the mesh has boundary edges (an open surface): the instrument's Boundary controls only matter then. */
export function hasBoundary(mesh: Mesh): boolean {
  return meshBoundaryEdges(meshTopology(mesh)).length > 0;
}

/** Whether the seed can change the construction: terrain heights and seeded regions. */
export function meshAbstractionUsesSeed(q: Record<string, number | string | boolean>): boolean {
  return q.source === "terrain" || q.region === "seeded";
}
