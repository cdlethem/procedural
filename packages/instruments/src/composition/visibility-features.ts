/**
 * Feature classification for Visibility Drawing (brief 53): which curves on a mesh are candidates for a line drawing,
 * split into the stage that does NOT depend on the camera and the stage that does.
 *
 * VIEW INDEPENDENT (cached per mesh content and rule; a camera edit reuses every one of them):
 *   `creaseEdges`   mesh edges whose fold (`meshEdgeAngle`, degrees, positive convex) is at least the threshold;
 *   `boundaryEdges` edges with exactly one face (the rim of an open sheet or vessel);
 *   `sectionCurves` exact plane sections (`sliceMesh`) by evenly spaced parallel planes;
 *   `contourCurves` triangle-exact iso-contours (`isoContours`) of a surface field.
 * VIEW DEPENDENT (cached per camera):
 *   `silhouetteEdges` edges between a camera-facing and a back-facing face (`meshSilhouetteEdges`).
 * Edge sets become curves by `edgeCurves` (chains through vertices where exactly two selected edges meet, cached by
 * edge content). Nothing here projects, hides or draws: that is `visibility-view.ts`.
 *
 * OWNERSHIP. A crease edge that is also a silhouette edge is drawn once. When the silhouette class is drawn it owns
 * the shared edges (an outline is one continuous stroke) and `creaseCurvesExcluding` chains the remaining crease edges;
 * with no overlap it returns the plain cached crease curves. Boundary edges never coincide with either (silhouettes
 * exclude boundary edges; a boundary edge has no dihedral angle).
 *
 * Units: world units and degrees. Failure: an unusable rule throws naming the control; work over the foundation's bound
 * throws naming Section spacing or Contour levels. Sections and contours are frozen values from the foundation's caches.
 */
import type { Camera } from "./camera.js";
import { cachedBy } from "./core.js";
import { isoContours, planeFrame, sliceMesh, slicePlanes, sliceCurves, SECTION_LIMITS, type SectionPlane } from "./mesh-section.js";
import { meshBoundaryEdges, meshCreaseEdges, meshSilhouetteEdges, meshTopology, type MeshTopology } from "./mesh-topology.js";
import { meshStorage, type Mesh, type Vec3 } from "./mesh.js";
import { memoized } from "./sources.js";
import { meshEdgeCurves, type SpatialCurve } from "./visibility.js";
import { visibilityField, visibilityFields, type VisibilityField } from "./visibility-scenes.js";

export type Convexity = "both" | "convex" | "concave";
export interface CreaseRule { readonly angle: number; readonly convexity: Convexity }
export type SectionAxis = "x" | "y" | "z";
export interface SectionRule {
  readonly axis: SectionAxis;
  /** Degrees the plane normal is turned from the axis (about the next axis in x, y, z order). */
  readonly tilt: number;
  /** Distance between planes as a fraction of the mesh's extent along the normal, in (0, 1]. */
  readonly spacing: number;
  /** Shift of the whole stack, as a fraction of the spacing. */
  readonly offset: number;
}
export interface ContourRule { readonly field: VisibilityField; readonly levels: number }

/** Limits that name their control. */
export const VISIBILITY_LIMITS = Object.freeze({ maxSectionPlanes: 250, maxContourLevels: 200 });

/** Counts of real constructions (cache misses), so tests and hosts can see which stage recomputed. */
export const constructionCounts = { crease: 0, boundary: 0, sections: 0, contours: 0, silhouette: 0, chains: 0, hidden: 0, hatch: 0, paint: 0 };
export type ConstructionCounts = typeof constructionCounts;

const creaseCache = new Map<string, readonly number[]>();
const boundaryCache = new Map<string, readonly number[]>();
const chainCache = new Map<string, readonly SpatialCurve[]>();
const sectionCache = new Map<string, SectionSet>();
const contourCache = new Map<string, ContourSet>();
const silhouetteCache = new WeakMap<Mesh, Map<string, readonly number[]>>();

export function creaseEdges(mesh: Mesh, rule: CreaseRule): readonly number[] {
  if (!(rule.angle > 0 && rule.angle <= 180)) throw new Error(`Crease angle must be greater than 0 and at most 180 degrees (got ${String(rule.angle)})`);
  if (rule.convexity !== "both" && rule.convexity !== "convex" && rule.convexity !== "concave") throw new Error(`Crease kind must be both, convex or concave (got ${String(rule.convexity)})`);
  return memoized(creaseCache, JSON.stringify([mesh.key, rule.angle, rule.convexity]), () => { constructionCounts.crease++; return meshCreaseEdges(meshTopology(mesh), rule.angle, rule.convexity); });
}

export function boundaryEdges(mesh: Mesh): readonly number[] {
  return memoized(boundaryCache, mesh.key, () => { constructionCounts.boundary++; return meshBoundaryEdges(meshTopology(mesh)); });
}

export function silhouetteEdges(mesh: Mesh, view: Camera): readonly number[] {
  return cachedBy(silhouetteCache, mesh, view.key, () => { constructionCounts.silhouette++; return meshSilhouetteEdges(mesh, meshTopology(mesh), view, { boundary: false }); });
}

const fnv = (values: readonly number[]): string => {
  let h = 0x811c9dc5;
  for (const v of values) { h = Math.imul(h ^ (v & 0xffff), 0x01000193); h = Math.imul(h ^ (v >>> 16), 0x01000193); }
  return (h >>> 0).toString(16);
};

/** Curves from selected edges (ascending or not): chains through degree-2 vertices, cached by edge content. */
export function edgeCurves(mesh: Mesh, edges: readonly number[]): readonly SpatialCurve[] {
  if (edges.length === 0) return Object.freeze([]);
  return memoized(chainCache, `${mesh.key}:${edges.length}:${fnv(edges)}`, () => { constructionCounts.chains++; return meshEdgeCurves(mesh, meshTopology(mesh), edges); });
}

/** Crease curves without the given (silhouette) edges; identical to the plain crease curves when none of them is a crease. */
export function creaseCurvesExcluding(mesh: Mesh, rule: CreaseRule, exclude: readonly number[]): readonly SpatialCurve[] {
  const creases = creaseEdges(mesh, rule);
  if (exclude.length === 0) return edgeCurves(mesh, creases);
  const skip = new Set(exclude);
  return edgeCurves(mesh, skip.size === 0 ? creases : creases.filter((e) => !skip.has(e)));
}

// ---------------------------------------------------------------------------------------------
// Sections

export interface SectionSet {
  readonly normal: Vec3;
  readonly planes: readonly SectionPlane[];
  readonly curves: readonly SpatialCurve[];
  /** Closed loops and open chains found, and contacts that left no curve. */
  readonly closed: number;
  readonly open: number;
  readonly degenerate: number;
  readonly work: number;
}

/** The unit normal of a section stack: the axis turned by `tilt` degrees about the next axis. */
export function sectionNormal(axis: SectionAxis, tilt: number): Vec3 {
  if (axis !== "x" && axis !== "y" && axis !== "z") throw new Error(`Section axis must be x, y or z (got ${String(axis)})`);
  if (typeof tilt !== "number" || !Number.isFinite(tilt)) throw new Error("Section tilt must be a finite number of degrees");
  const [s, c] = [Math.sin(tilt * Math.PI / 180), Math.cos(tilt * Math.PI / 180)];
  const exact = (v: number): number => (Math.abs(v) < 1e-15 ? 0 : v);
  // x turns toward y about z, y toward z about x, z toward x about y
  if (axis === "x") return [exact(c), exact(s), 0];
  if (axis === "y") return [0, exact(c), exact(s)];
  return [exact(s), 0, exact(c)];
}

export function sectionCurves(mesh: Mesh, rule: SectionRule): SectionSet {
  const { spacing, offset } = rule;
  if (!(spacing > 0 && spacing <= 1)) throw new Error(`Section spacing must be greater than 0 and at most 1 of the object's extent (got ${String(spacing)})`);
  if (typeof offset !== "number" || !Number.isFinite(offset)) throw new Error("Section offset must be a finite number");
  const normal = sectionNormal(rule.axis, rule.tilt);
  return memoized(sectionCache, JSON.stringify([mesh.key, rule.axis, rule.tilt, spacing, offset]), () => {
    constructionCounts.sections++;
    const frame = planeFrame({ point: [0, 0, 0], normal });
    const positions = meshStorage(mesh).positions, n = frame.normal;
    const { min, max } = mesh.bounds, origin: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    let low = Infinity, high = -Infinity;
    for (let v = 0; v < mesh.vertexCount; v++) {
      const d = n[0] * (positions[v * 3] - origin[0]) + n[1] * (positions[v * 3 + 1] - origin[1]) + n[2] * (positions[v * 3 + 2] - origin[2]);
      if (d < low) low = d; if (d > high) high = d;
    }
    const step = (high - low) * spacing;
    if (!(step > 0)) throw new Error("Section spacing: the object has no extent along the section direction");
    const count = Math.ceil((high - low) / step);
    if (count > VISIBILITY_LIMITS.maxSectionPlanes) throw new Error(`Section spacing ${spacing} gives ${count} planes; the limit is ${VISIBILITY_LIMITS.maxSectionPlanes}. Raise Section spacing`);
    const planes = slicePlanes(mesh, { normal, spacing: step, offset: offset * step, origin });
    if (planes.length > SECTION_LIMITS.maxPlanes) throw new Error(`Section spacing ${spacing} gives ${planes.length} planes; raise Section spacing`);
    let slices;
    try { slices = sliceMesh(mesh, planes); } catch (error) { throw new Error(`Section spacing: ${(error as Error).message}. Raise Section spacing or lower Detail`); }
    const curves = sliceCurves(slices);
    let closed = 0, open = 0, degenerate = 0;
    for (const section of slices.sections) { closed += section.closedCount; open += section.openCount; degenerate += section.degenerate; }
    return Object.freeze({ normal, planes, curves, closed, open, degenerate, work: slices.work });
  });
}

// ---------------------------------------------------------------------------------------------
// Contours

export interface ContourSet {
  readonly field: VisibilityField;
  /** The levels traced (evenly spaced strictly inside `range`), or none when the field is constant. */
  readonly levels: readonly number[];
  /** Low and high of the field used to place levels (5th to 95th percentile for curvature, else min to max), or null when constant. */
  readonly range: readonly [number, number] | null;
  readonly curves: readonly SpatialCurve[];
  readonly work: number;
}

function fieldRange(values: Float64Array, field: VisibilityField): [number, number] | null {
  let lo: number, hi: number;
  if (field === "curvature") {
    const sorted = Float64Array.from(values).sort();
    lo = sorted[Math.floor(0.05 * (sorted.length - 1))]; hi = sorted[Math.ceil(0.95 * (sorted.length - 1))];
  } else { lo = Infinity; hi = -Infinity; for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; } }
  return hi - lo <= 1e-9 * Math.max(1, Math.abs(lo), Math.abs(hi)) ? null : [lo, hi];
}

export function contourCurves(mesh: Mesh, rule: ContourRule): ContourSet {
  if (!visibilityFields.includes(rule.field)) throw new Error(`Contour field must be one of ${visibilityFields.join(", ")} (got ${String(rule.field)})`);
  if (!Number.isInteger(rule.levels) || rule.levels < 1 || rule.levels > VISIBILITY_LIMITS.maxContourLevels)
    throw new Error(`Contour levels must be an integer from 1 to ${VISIBILITY_LIMITS.maxContourLevels} (got ${String(rule.levels)})`);
  return memoized(contourCache, JSON.stringify([mesh.key, rule.field, rule.levels]), () => {
    constructionCounts.contours++;
    const values = visibilityField(mesh, rule.field), range = fieldRange(values, rule.field);
    if (range === null) return Object.freeze({ field: rule.field, levels: Object.freeze([]), range: null, curves: Object.freeze([]), work: 0 });
    const levels = Array.from({ length: rule.levels }, (_, i) => range[0] + (range[1] - range[0]) * (i + 1) / (rule.levels + 1));
    let traced;
    try { traced = isoContours(mesh, { values, levels }); } catch (error) { throw new Error(`Contour levels: ${(error as Error).message}. Lower Contour levels or Detail`); }
    return Object.freeze({ field: rule.field, levels: Object.freeze(levels), range: Object.freeze(range) as readonly [number, number], curves: traced.curves, work: traced.work });
  });
}

export type { MeshTopology };
