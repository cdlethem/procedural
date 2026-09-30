/**
 * Cutaway views of a geological block (brief 46): what is left of the block after a cut, its exposed sections and its lines,
 * as camera-independent geometry. Nothing here knows the camera, palette or materials: `strata-draw.ts` orders, projects and paints.
 *
 * CUTS (`CutOptions.kind`). `block`: the whole block. `slice`: one plane (`slicePosition` across the block along the plane normal,
 * `sliceAzimuth` the direction the normal points toward in degrees from +x to +z, `sliceDip` its dip: 90 vertical, 0 horizontal);
 * the +normal side is removed and the plane is EXPOSED as a section. `corner`: the box `sx*x > W/2 - cutWidth*W`, `sz*z > D/2 -
 * cutDepth*D`, `y > H - cutHeight*H` at one corner is removed and its three faces are exposed. `exploded`: the slice plane splits the
 * block in two pieces and the +normal piece moves `gap * diagonal` along the normal; both cut faces are exposed.
 *
 * SHELL. The outer surface of the block (four walls and the base from the bricks, the erosion surface split by horizon into strata
 * outcrops) is clipped, polygon by polygon, to the kept pieces. The pieces of a cut are disjoint convex regions given by half-spaces,
 * so a clip is exact and a triangle stays convex. Erosion-surface triangles are split by the exact linear interpolation of
 * `horizon - ground` inside each triangle, so an outcrop boundary is the same polyline the iso-contour of that scalar gives.
 *
 * SECTIONS. The cut faces come from `sliceMesh` on the block mesh: each loop is a closed loop of one brick, identified by the
 * stratum and compartment of its first face, and the loops of one (stratum, compartment) become a `PlanarDomain` by even-odd fill
 * (a dome cut by a horizontal plane gives a ring: a hole where an older stratum is exposed). Regions smaller than `SECTION_MIN_AREA`
 * (a wedge thinning to its floor thickness, or a grid-scale speck) are not sections and are dropped. A corner cut restricts each face to
 * the part that borders the removed box by a Boolean intersection with the wedge of the other two half-planes.
 * Cut faces are triangulated with `triangulatePolygon` so they can be painter-ordered with the shell.
 *
 * LINES (`LineKind`). `outline` (block edges and the boundary of every cut face), `contact` (horizon traces on walls, on the erosion
 * surface as `isoContours` of `horizon - ground` at 0, and on sections as the rings of each stratum region), `fault` (fault planes
 * cut by walls, the erosion surface, the base and sections), `bed` (`beds` fine surfaces inside each stratum: contours of the
 * stratigraphic coordinate on the erosion surface, sections of interpolated bedding sheets on cut faces and border rows on walls),
 * `contour` (topographic contours of the erosion surface). Wall and outcrop contacts are drawn only where both strata beside them are
 * thicker than `VISIBLE_THICKNESS * H`, so a floor-thin eroded stratum draws nothing.
 *
 * WORK. Everything is linear in the block's triangles; the bedding sheets are bounded by `MAX_BED_VERTICES` (throws naming Beds, Grid
 * resolution and Strata). Results are cached by block and cut.
 */

import { domainIntersection, planarDomain, planarRegion, ringsDomain, unionDomains, type PlanarDomain, type PlanarRegion } from "./domains.js";
import { clipPath } from "./domains-paths.js";
import { ROLE, type GeologicalBlock } from "./strata-block.js";
import { mesh, meshStorage, type Mesh, type Vec3 } from "./mesh.js";
import { isoContours, sliceMesh, type PlaneFrame, type SectionPlane } from "./mesh-section.js";
import { triangulatePolygon } from "./polygon-triangulate.js";
import type { SpatialCurve } from "./visibility.js";


export type CutKind = "block" | "slice" | "corner" | "exploded";
export type CornerSide = "front-right" | "front-left" | "back-right" | "back-left";
export type LineKind = "outline" | "contact" | "fault" | "bed" | "contour";
export const TRI = Object.freeze({ ground: 0, wall: 1, base: 2, cap: 3 });

export interface CutOptions {
  readonly kind: CutKind;
  /** Fraction across the block along the slice normal, in (0, 1). */
  readonly slicePosition: number;
  readonly sliceAzimuth: number;
  readonly sliceDip: number;
  readonly corner: CornerSide;
  /** Fractions of the block width, depth and height removed at the corner. */
  readonly cutWidth: number;
  readonly cutDepth: number;
  readonly cutHeight: number;
  /** Explosion distance as a fraction of the block's diagonal. */
  readonly gap: number;
}
export interface LineOptions {
  /** Bedding surfaces per stratum (0 none). */
  readonly beds: number;
  /** Topographic contour levels on the erosion surface (0 none). */
  readonly contours: number;
}
export interface ViewCurve extends SpatialCurve { readonly kind: LineKind; readonly tone: number }
export interface CapRegion {
  readonly plane: string;
  readonly stratum: number;
  readonly compartment: number;
  readonly domain: PlanarDomain;
  readonly frame: PlaneFrame;
  /** +1 when the section faces along the frame normal, -1 when it faces against it (the far piece of an exploded block). */
  readonly facing: 1 | -1;
  readonly shift: Vec3;
}
export interface ViewGeometry {
  readonly key: string;
  readonly mesh: Mesh;
  /** Stratum and `TRI` kind of every triangle of `mesh`. */
  readonly triStratum: Uint8Array;
  readonly triKind: Uint8Array;
  readonly curves: readonly ViewCurve[];
  readonly caps: readonly CapRegion[];
  /** Bounding sphere of the whole block including any explosion: what a camera should fit. */
  readonly fit: { readonly center: Vec3; readonly radius: number };
  readonly stats: { readonly shellTriangles: number; readonly capTriangles: number; readonly sections: number; readonly bedVertices: number };
}

export const SECTION_MIN_AREA = 2e-5;
export const VISIBLE_THICKNESS = 0.004;
export const MAX_BED_VERTICES = 140_000;
export const MAX_BEDS = 6;

interface Constraint { readonly n: Vec3; readonly d: number; readonly keep: "le" | "gt" }
interface Piece { readonly constraints: readonly Constraint[]; readonly shift: Vec3 }
interface CapSpec { readonly id: string; readonly point: Vec3; readonly normal: Vec3; readonly wedge: readonly Constraint[]; readonly facing: 1 | -1; readonly shift: Vec3 }

const radians = Math.PI / 180;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cache = new Map<string, ViewGeometry>();

/** The pieces kept by a cut and the faces it exposes, for a block of extents `W`, `D`, `H` (see the module header). */
export function cutGeometry(block: GeologicalBlock, cut: CutOptions): { pieces: readonly Piece[]; caps: readonly CapSpec[] } {
  const { width: W, depth: D, height: H } = block.model;
  for (const [name, value] of [["Slice position", cut.slicePosition], ["Cut width", cut.cutWidth], ["Cut depth", cut.cutDepth], ["Cut height", cut.cutHeight]] as const)
    if (!(value > 0 && value < 1) && cut.kind !== "block") throw new Error(`${name} must be between 0 and 1, exclusive (got ${String(value)})`);
  if (cut.kind === "block") return { pieces: [{ constraints: [], shift: [0, 0, 0] }], caps: [] };
  if (cut.kind === "corner") {
    const sx = cut.corner.endsWith("right") ? 1 : -1, sz = cut.corner.startsWith("front") ? 1 : -1;
    const c1: Constraint = { n: [sx, 0, 0], d: W / 2 - cut.cutWidth * W, keep: "gt" }, c2: Constraint = { n: [0, 0, sz], d: D / 2 - cut.cutDepth * D, keep: "gt" };
    const c3: Constraint = { n: [0, 1, 0], d: H - cut.cutHeight * H, keep: "gt" };
    const le = (c: Constraint): Constraint => ({ ...c, keep: "le" });
    const zero: Vec3 = [0, 0, 0];
    const spec = (id: string, c: Constraint, others: Constraint[]): CapSpec => ({ id, point: [c.n[0] * c.d, c.n[1] * c.d, c.n[2] * c.d], normal: c.n, wedge: others, facing: 1, shift: zero });
    return {
      pieces: [{ constraints: [le(c1)], shift: zero }, { constraints: [c1, le(c2)], shift: zero }, { constraints: [c1, c2, le(c3)], shift: zero }],
      caps: [spec("cutX", c1, [c2, c3]), spec("cutZ", c2, [c1, c3]), spec("cutY", c3, [c1, c2])],
    };
  }
  const phi = cut.sliceAzimuth * radians, delta = cut.sliceDip * radians;
  const raw: Vec3 = [Math.sin(delta) * Math.cos(phi), Math.cos(delta), Math.sin(delta) * Math.sin(phi)];
  const length = Math.hypot(...raw), n: Vec3 = [raw[0] / length + 0, raw[1] / length + 0, raw[2] / length + 0];
  const half = (W * Math.abs(n[0]) + H * Math.abs(n[1]) + D * Math.abs(n[2])) / 2;
  const d = dot(n, [0, H / 2, 0]) - half + cut.slicePosition * 2 * half;
  const point: Vec3 = [n[0] * d, n[1] * d, n[2] * d];
  const le: Constraint = { n, d, keep: "le" }, gt: Constraint = { n, d, keep: "gt" };
  if (cut.kind === "slice") return { pieces: [{ constraints: [le], shift: [0, 0, 0] }], caps: [{ id: "slice", point, normal: n, wedge: [], facing: 1, shift: [0, 0, 0] }] };
  const g = cut.gap * Math.hypot(W, D, H), move: Vec3 = [n[0] * g, n[1] * g, n[2] * g];
  return {
    pieces: [{ constraints: [le], shift: [0, 0, 0] }, { constraints: [gt], shift: move }],
    caps: [{ id: "near", point, normal: n, wedge: [], facing: 1, shift: [0, 0, 0] }, { id: "far", point, normal: n, wedge: [], facing: -1, shift: move }],
  };
}

// ---------------------------------------------------------------------------------------------
// Clipping

function clipPolygon(points: readonly Vec3[], c: Constraint): Vec3[] {
  const out: Vec3[] = [], sign = c.keep === "le" ? 1 : -1;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const fa = sign * (dot(c.n, a) - c.d), fb = sign * (dot(c.n, b) - c.d);
    if (fa <= 0) out.push(a);
    if ((fa <= 0) !== (fb <= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
  }
  return out;
}
function clipPolyline(points: readonly Vec3[], c: Constraint): Vec3[][] {
  const runs: Vec3[][] = [], sign = c.keep === "le" ? 1 : -1;
  let run: Vec3[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], fa = sign * (dot(c.n, a) - c.d);
    if (i > 0) {
      const p = points[i - 1], fp = sign * (dot(c.n, p) - c.d);
      if ((fp <= 0) !== (fa <= 0)) {
        const t = fp / (fp - fa), x: Vec3 = [p[0] + (a[0] - p[0]) * t, p[1] + (a[1] - p[1]) * t, p[2] + (a[2] - p[2]) * t];
        if (fp <= 0) { run.push(x); runs.push(run); run = []; } else run = [x];
      }
    }
    if (fa <= 0) run.push(a);
  }
  if (run.length) runs.push(run);
  return runs.filter((r) => r.length >= 2);
}
function inPiece(points: readonly Vec3[], piece: Piece): Vec3[] | null {
  let poly = points as Vec3[];
  for (const c of piece.constraints) { poly = clipPolygon(poly, c); if (poly.length < 3) return null; }
  return poly;
}

// ---------------------------------------------------------------------------------------------
// Erosion surface split into outcrops

interface Polygon { readonly points: Vec3[]; readonly stratum: number; readonly kind: number }

function groundOutcrops(block: GeologicalBlock): Polygon[] {
  const n = block.model.strata, g = block.ground, s = meshStorage(g.mesh), out: Polygon[] = [];
  const V = g.mesh.vertexCount;
  const stratumOf = new Uint8Array(V);
  for (let v = 0; v < V; v++) { let k = 0; for (let w = 1; w <= n - 1; w++) if (g.gap[w - 1][v] <= 0) k = w; stratumOf[v] = k; }
  for (let t = 0; t < g.mesh.triangleCount; t++) {
    const ids = [s.triangles[t * 3], s.triangles[t * 3 + 1], s.triangles[t * 3 + 2]];
    const P = ids.map((i) => [s.positions[i * 3], s.positions[i * 3 + 1], s.positions[i * 3 + 2]] as Vec3);
    const kMin = Math.min(...ids.map((i) => stratumOf[i])), kMax = Math.max(...ids.map((i) => stratumOf[i]));
    for (let k = kMin; k <= kMax; k++) {
      // Barycentric polygon, clipped by gap_k <= 0 (ground at or above horizon k) and gap_{k+1} > 0 (below horizon k+1).
      let poly: [number, number, number][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      const clip = (w: number, keepLe: boolean): void => {
        const f = ids.map((i) => (keepLe ? 1 : -1) * g.gap[w - 1][i]);
        const value = (b: readonly number[]) => b[0] * f[0] + b[1] * f[1] + b[2] * f[2];
        const next: [number, number, number][] = [];
        for (let i = 0; i < poly.length && poly.length; i++) {
          const a = poly[i], b = poly[(i + 1) % poly.length], fa = value(a), fb = value(b);
          if (fa <= 0) next.push(a);
          if ((fa <= 0) !== (fb <= 0)) { const u = fa / (fa - fb); next.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]); }
        }
        poly = next;
      };
      if (k >= 1) clip(k, true);
      if (poly.length >= 3 && k <= n - 2) clip(k + 1, false);
      if (poly.length < 3) continue;
      out.push({ stratum: k, kind: TRI.ground, points: poly.map((b) => [b[0] * P[0][0] + b[1] * P[1][0] + b[2] * P[2][0], b[0] * P[0][1] + b[1] * P[1][1] + b[2] * P[2][1], b[0] * P[0][2] + b[1] * P[1][2] + b[2] * P[2][2]] as Vec3) });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Curves on the shell

function polylines(points: Vec3[], keep: (i: number) => boolean): Vec3[][] {
  const runs: Vec3[][] = [];
  let run: Vec3[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    if (keep(i)) { if (!run.length) run.push(points[i]); run.push(points[i + 1]); } else if (run.length) { runs.push(run); run = []; }
  }
  if (run.length) runs.push(run);
  return runs;
}

function shellCurves(block: GeologicalBlock, lines: LineOptions): ViewCurve[] {
  const { model } = block, n = model.strata, H = model.height, M = model.compartments.length - 1, vis = VISIBLE_THICKNESS * H;
  const out: ViewCurve[] = [];
  let id = 0;
  const emit = (kind: LineKind, tone: number, points: Vec3[]) => { if (points.length >= 2) out.push(Object.freeze({ id: `${kind}:${id++}`, kind, tone, points: Object.freeze(points) })); };
  for (const grid of block.grids) {
    const { nz, nq } = grid, stride = nz + 1, sheets = grid.sheets, ci = grid.compartment;
    const outerColumns: number[] = [];
    if (ci === 0) outerColumns.push(0);
    if (ci === M) outerColumns.push(nz);
    // Each outer wall as an ordered list of grid vertices.
    const walls: number[][] = [
      Array.from({ length: nz + 1 }, (_, a) => a), // front row b = 0
      Array.from({ length: nz + 1 }, (_, a) => nq * stride + a), // back row b = nq
      ...outerColumns.map((a) => Array.from({ length: nq + 1 }, (_, b) => b * stride + a)),
    ];
    const at = (w: number, v: number): Vec3 => [sheets[w].x[v], sheets[w].y[v], sheets[w].z[v]];
    for (const wall of walls) {
      for (let w = 1; w <= n - 1; w++) {
        const pts = wall.map((v) => at(w, v));
        const ok = (v: number) => sheets[w].y[v] - sheets[w - 1].y[v] > vis && sheets[w + 1].y[v] - sheets[w].y[v] > vis;
        for (const run of polylines(pts, (i) => ok(wall[i]) && ok(wall[i + 1]))) emit("contact", w, run);
      }
      if (lines.beds > 0) for (let k = 0; k < n; k++) for (let i = 1; i <= lines.beds; i++) {
        const f = i / (lines.beds + 1);
        const pts = wall.map((v): Vec3 => {
          const a = v % stride, b = (v - a) / stride, y = sheets[k].y[v] + f * (sheets[k + 1].y[v] - sheets[k].y[v]);
          return grid.place(y, a, b);
        });
        for (const run of polylines(pts, (j) => sheets[k + 1].y[wall[j]] - sheets[k].y[wall[j]] > vis && sheets[k + 1].y[wall[j + 1]] - sheets[k].y[wall[j + 1]] > vis)) emit("bed", k, run);
      }
      // The top edge and base edge of the wall.
      emit("outline", 0, wall.map((v) => at(n, v)));
      emit("outline", 0, wall.map((v): Vec3 => grid.place(0, v % stride, (v - (v % stride)) / stride)));
    }
    // Vertical corner edges.
    for (const [a, b] of [[0, 0], [0, nq], [nz, 0], [nz, nq]] as const) {
      if ((a === 0 && ci !== 0) || (a === nz && ci !== M)) continue;
      emit("outline", 0, [grid.place(0, a, b), [sheets[n].x[b * stride + a], sheets[n].y[b * stride + a], sheets[n].z[b * stride + a]]]);
    }
    // Fault traces on the right edge of every compartment but the last: front and back walls, ground, base.
    if (ci < M) {
      const a = nz;
      for (const b of [0, nq]) emit("fault", ci, [grid.place(0, a, b), [sheets[n].x[b * stride + a], sheets[n].y[b * stride + a], sheets[n].z[b * stride + a]]]);
      emit("fault", ci, Array.from({ length: nq + 1 }, (_, b): Vec3 => [sheets[n].x[b * stride + a], sheets[n].y[b * stride + a], sheets[n].z[b * stride + a]]));
      emit("fault", ci, Array.from({ length: nq + 1 }, (_, b): Vec3 => grid.place(0, a, b)));
    }
  }
  return out;
}

function groundCurves(block: GeologicalBlock, lines: LineOptions): ViewCurve[] {
  const { model } = block, n = model.strata, out: ViewCurve[] = [];
  const keep = (kind: LineKind, tone: number, curves: readonly { points: readonly Vec3[]; id: string }[], prefix: string) => {
    for (const c of curves) out.push(Object.freeze({ id: `${prefix}:${c.id}`, kind, tone, points: c.points }));
  };
  for (let w = 1; w <= n - 1; w++) {
    const contours = isoContours(block.ground.mesh, { values: block.ground.gap[w - 1], levels: [0] });
    keep("contact", w, contours.curves, `outcrop${w}`);
  }
  if (lines.beds > 0) {
    const levels: number[] = [];
    for (let k = 0; k < n; k++) for (let i = 1; i <= lines.beds; i++) levels.push(k + i / (lines.beds + 1));
    const beds = isoContours(block.ground.mesh, { values: block.ground.coordinate, levels });
    for (const c of beds.curves) out.push(Object.freeze({ id: `ground-bed:${c.id}`, kind: "bed" as const, tone: Math.floor(c.level), points: c.points }));
  }
  if (lines.contours > 0) {
    const [low, high] = model.groundRange;
    if (high - low > 1e-9) {
      const levels = Array.from({ length: lines.contours }, (_, i) => low + ((i + 0.5) * (high - low)) / lines.contours);
      const topo = isoContours(block.ground.mesh, { values: "elevation", levels });
      for (const c of topo.curves) out.push(Object.freeze({ id: `contour:${c.id}`, kind: "contour" as const, tone: 0, points: c.points }));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Bedding sheets for sections

interface BedSheets { readonly mesh: Mesh; readonly stratum: Uint8Array }
function bedSheets(block: GeologicalBlock, beds: number): BedSheets | null {
  if (beds === 0) return null;
  const { model } = block, n = model.strata, vis = VISIBLE_THICKNESS * model.height;
  let estimate = 0;
  for (const grid of block.grids) estimate += (grid.nz + 1) * (grid.nq + 1) * n * beds;
  if (estimate > MAX_BED_VERTICES) throw new Error(`Bedding needs up to ${estimate} vertices; the limit is ${MAX_BED_VERTICES}. Lower Beds, Grid resolution, Strata or Faults`);
  const positions: number[] = [], triangles: number[] = [], stratum: number[] = [];
  for (const grid of block.grids) {
    const { nz, nq } = grid, stride = nz + 1;
    for (let k = 0; k < n; k++) for (let i = 1; i <= beds; i++) {
      const f = i / (beds + 1), lo = grid.sheets[k].y, hi = grid.sheets[k + 1].y, ids = new Int32Array(stride * (nq + 1)).fill(-1);
      const vertex = (v: number): number => {
        if (ids[v] < 0) { const a = v % stride, b = (v - a) / stride, p = grid.place(lo[v] + f * (hi[v] - lo[v]), a, b); ids[v] = positions.length / 3; positions.push(p[0], p[1], p[2]); }
        return ids[v];
      };
      for (let b = 0; b < nq; b++) for (let a = 0; a < nz; a++) {
        const c = [b * stride + a, b * stride + a + 1, (b + 1) * stride + a + 1, (b + 1) * stride + a];
        if (!c.some((v) => hi[v] - lo[v] > vis)) continue;
        const tris = ((a + b) & 1) === 1 ? [[0, 1, 3], [1, 2, 3]] : [[0, 1, 2], [0, 2, 3]];
        for (const [p, q, r] of tris) { triangles.push(vertex(c[p]), vertex(c[q]), vertex(c[r])); stratum.push(k); }
      }
    }
  }
  if (triangles.length === 0) return null;
  return { mesh: mesh({ id: "bedding", positions, triangles, degenerate: "drop", attributes: [{ name: "stratum", domain: "face", size: 1, values: stratum }] }), stratum: Uint8Array.from(stratum) };
}

// ---------------------------------------------------------------------------------------------
// Cut faces

/** Closed convex polygon `[-r, r]^2` clipped by `a u + b v + c >= 0` for each half-plane. */
function wedgePolygon(radius: number, halfPlanes: readonly (readonly [number, number, number])[]): [number, number][] | null {
  let poly: [number, number][] = [[-radius, -radius], [radius, -radius], [radius, radius], [-radius, radius]];
  for (const [a, b, c] of halfPlanes) {
    const next: [number, number][] = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], fp = a * p[0] + b * p[1] + c, fq = a * q[0] + b * q[1] + c;
      if (fp >= 0) next.push(p);
      if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); next.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    poly = next;
    if (poly.length < 3) return null;
  }
  return poly;
}

/** The faulted horizons as planes `N . p = D` for a cap's line work: `p - kappa (y - H/2) = c_j`. */
function faultPlanes(block: GeologicalBlock): { n: Vec3; d: number }[] {
  const { model } = block, [x1, z1] = model.toWorld(1, 0), [x0, z0] = model.toWorld(0, 0);
  const eP: Vec3 = [x1 - x0, 0, z1 - z0];
  return model.faults.map((f) => ({ n: [eP[0], -model.kappa, eP[2]] as Vec3, d: f.position - model.kappa * model.height / 2 }));
}

interface Caps { readonly regions: CapRegion[]; readonly curves: ViewCurve[]; readonly triangles: { points: [Vec3, Vec3, Vec3]; stratum: number }[]; readonly sections: number }

function capsOf(block: GeologicalBlock, specs: readonly CapSpec[], bed: BedSheets | null): Caps {
  const regions: CapRegion[] = [], curves: ViewCurve[] = [], triangles: Caps["triangles"] = [];
  if (specs.length === 0) return { regions, curves, triangles, sections: 0 };
  const sectionPlanes: SectionPlane[] = [];
  for (const spec of specs) {
    const id = spec.id === "far" ? "near" : spec.id;
    if (!sectionPlanes.some((p) => p.id === id)) sectionPlanes.push({ id, point: spec.point, normal: spec.normal });
  }
  const slices = sliceMesh(block.mesh, sectionPlanes);
  const bedSlices = bed ? sliceMesh(bed.mesh, sectionPlanes) : null;
  const radius = 4 * Math.hypot(block.model.width, block.model.depth, block.model.height);
  const faults = faultPlanes(block);
  let id = 0;
  for (const spec of specs) {
    const section = slices.sections.find((s) => s.id === (spec.id === "far" ? "near" : spec.id))!;
    const frame = section.frame, [ux, uy, uz] = frame.u, [vx, vy, vz] = frame.v, [ox, oy, oz] = frame.origin;
    const lift = (p: readonly [number, number]): Vec3 => [ox + p[0] * ux + p[1] * vx + spec.shift[0], oy + p[0] * uy + p[1] * vy + spec.shift[1], oz + p[0] * uz + p[1] * vz + spec.shift[2]];
    const groups = new Map<string, [number, number][][]>();
    for (const loop of section.loops) {
      if (!loop.closed) continue;
      const face = loop.faces[0], key = `${block.faceStratum[face]}/${block.faceCompartment[face]}`;
      let list = groups.get(key);
      if (!list) { list = []; groups.set(key, list); }
      list.push(loop.uv.map((q) => [q[0], q[1]] as [number, number]));
    }
    // Restriction of a corner face to the removed box's wedge.
    const half = spec.wedge.map((c): readonly [number, number, number] => [dot(c.n, frame.u), dot(c.n, frame.v), dot(c.n, frame.origin) - c.d]);
    const wedgeRing = half.length ? wedgePolygon(radius, half) : null;
    const wedge: PlanarRegion | null = wedgeRing ? planarRegion({ id: `${spec.id}-wedge`, outer: wedgeRing }) : null;
    if (half.length && !wedge) continue;
    const perSection: PlanarDomain[] = [];
    for (const [key, rings] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const [stratum, compartment] = key.split("/").map(Number);
      let domain = ringsDomain(rings, { fill: "evenodd", id: `${spec.id}/s${stratum}c${compartment}` });
      if (wedge) domain = domainIntersection(domain, wedge, { id: `${spec.id}/s${stratum}c${compartment}` });
      const kept = domain.regions.filter((r) => r.area >= SECTION_MIN_AREA);
      if (kept.length === 0) continue;
      if (kept.length !== domain.regions.length) domain = planarDomain(kept, { id: domain.id });
      perSection.push(domain);
      regions.push(Object.freeze({ plane: spec.id, stratum, compartment, domain, frame, facing: spec.facing, shift: spec.shift }));
      for (const region of domain.regions) {
        for (const tri of triangulatePolygon(region.outer, region.holes)) {
          const [a, b, c] = tri.map(lift) as [Vec3, Vec3, Vec3];
          triangles.push({ points: spec.facing === 1 ? [a, b, c] : [a, c, b], stratum });
        }
        for (const ring of [region.outer, ...region.holes]) curves.push(Object.freeze({ id: `contact:${spec.id}:${id++}`, kind: "contact" as const, tone: stratum, closed: true, points: Object.freeze(ring.map(lift)) }));
      }
    }
    if (perSection.length === 0) continue;
    const union = unionDomains(perSection, { id: `${spec.id}/union` });
    for (const region of union.regions) for (const ring of [region.outer, ...region.holes])
      curves.push(Object.freeze({ id: `outline:${spec.id}:${id++}`, kind: "outline" as const, tone: 0, closed: true, points: Object.freeze(ring.map(lift)) }));
    // Fault planes cut by the section plane.
    for (const [j, f] of faults.entries()) {
      const a = dot(f.n, frame.u), b = dot(f.n, frame.v), c = dot(f.n, frame.origin) - f.d, h = a * a + b * b;
      if (h < 1e-18) continue;
      const p0: [number, number] = [-c * a / h, -c * b / h], d: [number, number] = [-b / Math.sqrt(h), a / Math.sqrt(h)];
      const line: [number, number][] = [[p0[0] - radius * d[0], p0[1] - radius * d[1]], [p0[0] + radius * d[0], p0[1] + radius * d[1]]];
      for (const piece of clipPath(line, union, { keep: "inside" })) curves.push(Object.freeze({ id: `fault:${spec.id}:${j}:${id++}`, kind: "fault" as const, tone: j, points: Object.freeze(piece.points.map((q) => lift(q))) }));
    }
    // Bedding: sections of the interpolated bedding sheets, kept inside the exposed regions.
    if (bedSlices && bed) {
      const bedSection = bedSlices.sections.find((s) => s.id === (spec.id === "far" ? "near" : spec.id));
      for (const loop of bedSection?.loops ?? []) {
        const stratum = bed.stratum[loop.faces[0]];
        for (const piece of clipPath(loop.uv.map((q) => [q[0], q[1]] as [number, number]), union, { closed: loop.closed, keep: "inside" }))
          curves.push(Object.freeze({ id: `bed:${spec.id}:${id++}`, kind: "bed" as const, tone: stratum, points: Object.freeze(piece.points.map((q) => lift(q))) }));
      }
    }
  }

  return { regions, curves, triangles, sections: slices.sections.length };
}

// ---------------------------------------------------------------------------------------------

/** The camera-independent drawing geometry of a cut block (see the module header); cached by block and cut. */
export function viewGeometry(block: GeologicalBlock, cut: CutOptions, lines: LineOptions): ViewGeometry {
  if (!Number.isInteger(lines.beds) || lines.beds < 0 || lines.beds > MAX_BEDS) throw new Error(`Beds must be a whole number from 0 to ${MAX_BEDS} (got ${String(lines.beds)})`);
  if (!Number.isInteger(lines.contours) || lines.contours < 0 || lines.contours > 60) throw new Error(`Contours must be a whole number from 0 to 60 (got ${String(lines.contours)})`);
  const key = `${block.key}|${JSON.stringify(cut)}|${lines.beds}|${lines.contours}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const { pieces, caps: specs } = cutGeometry(block, cut);
  const { width: W, depth: D, height: H } = block.model;

  // Shell polygons.
  const s = meshStorage(block.mesh), polys: Polygon[] = [];
  for (let t = 0; t < block.mesh.triangleCount; t++) {
    const role = block.faceRole[t];
    if (role !== ROLE.wall && role !== ROLE.base) continue;
    const pts: Vec3[] = [0, 1, 2].map((k) => [s.positions[s.triangles[t * 3 + k] * 3], s.positions[s.triangles[t * 3 + k] * 3 + 1], s.positions[s.triangles[t * 3 + k] * 3 + 2]] as Vec3);
    polys.push({ points: pts, stratum: block.faceStratum[t], kind: role === ROLE.base ? TRI.base : TRI.wall });
  }
  polys.push(...groundOutcrops(block));

  const positions: number[] = [], indices: number[] = [], triStratum: number[] = [], triKind: number[] = [];
  const pushTriangle = (a: Vec3, b: Vec3, c: Vec3, stratum: number, kind: number): void => {
    const base = positions.length / 3;
    positions.push(...a, ...b, ...c); indices.push(base, base + 1, base + 2); triStratum.push(stratum); triKind.push(kind);
  };
  for (const poly of polys) for (const piece of pieces) {
    const clipped = inPiece(poly.points, piece);
    if (!clipped) continue;
    const q = piece.shift[0] === 0 && piece.shift[1] === 0 && piece.shift[2] === 0 ? clipped : clipped.map((p) => add(p, piece.shift));
    for (let i = 1; i + 1 < q.length; i++) pushTriangle(q[0], q[i], q[i + 1], poly.stratum, poly.kind);
  }
  const shellTriangles = indices.length / 3;

  // Cut faces.
  const bed = bedSheets(block, lines.beds);
  const caps = capsOf(block, specs, bed);
  for (const tri of caps.triangles) pushTriangle(tri.points[0], tri.points[1], tri.points[2], tri.stratum, TRI.cap);

  // Shell lines clipped to the kept pieces.
  const curves: ViewCurve[] = [];
  for (const curve of [...shellCurves(block, lines), ...groundCurves(block, lines)]) {
    let n = 0;
    for (const piece of pieces) {
      let runs: Vec3[][] = [curve.points as Vec3[]];
      for (const c of piece.constraints) runs = runs.flatMap((r) => clipPolyline(r, c));
      for (const run of runs) {
        const moved = piece.shift[0] === 0 && piece.shift[1] === 0 && piece.shift[2] === 0 ? run : run.map((p) => add(p, piece.shift));
        curves.push(Object.freeze({ id: `${curve.id}#${n++}`, kind: curve.kind, tone: curve.tone, points: Object.freeze(moved) }));
      }
    }
  }
  curves.push(...caps.curves);
  if (indices.length === 0) throw new Error("The cut removes the whole block: lower Slice position or the Cut sizes");

  const viewMesh = mesh({ id: "geological-view", positions, triangles: indices, degenerate: "drop" });
  // Dropped degenerate triangles renumber the rest: rebuild the per-triangle attributes without them.
  const dropped = new Set(viewMesh.dropped), stratumKept: number[] = [], kindKept: number[] = [];
  for (let t = 0; t < triStratum.length; t++) if (!dropped.has(t)) { stratumKept.push(triStratum[t]); kindKept.push(triKind[t]); }
  const center: Vec3 = [0, H / 2, 0], move = cut.kind === "exploded" ? cut.gap * Math.hypot(W, D, H) : 0;
  const result: ViewGeometry = Object.freeze({
    key, mesh: viewMesh, triStratum: Uint8Array.from(stratumKept), triKind: Uint8Array.from(kindKept),
    curves: Object.freeze(curves), caps: Object.freeze(caps.regions),
    fit: Object.freeze({ center, radius: Math.hypot(W, D, H) / 2 + move }),
    stats: Object.freeze({ shellTriangles, capTriangles: caps.triangles.length, sections: caps.sections, bedVertices: bed ? bed.mesh.vertexCount : 0 }),
  });
  cache.set(key, result);
  if (cache.size > 6) cache.delete(cache.keys().next().value!);
  return result;
}


