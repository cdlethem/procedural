/**
 * Visibility (F8): exact hidden-line removal of 3D curves against a mesh, point occlusion, and a painter
 * ordering rule for the mesh's own triangles.
 *
 * WHAT HIDDEN LINES DECIDE. For every straight 3D segment of every curve, the part of it that lies BEHIND some
 * mesh triangle as seen by the camera is hidden; the rest is visible. Behind means: the point's projection is
 * inside the triangle's projection AND the point is farther from the eye than the triangle's plane along the
 * viewing ray. Both conditions are affine in the segment parameter (planes through the eye and a triangle edge
 * for perspective, through the edge parallel to the view axis for orthographic; the triangle's own plane for
 * depth), so the hidden set of one triangle is ONE interval of the segment, computed analytically by
 * clipping the segment against four half-spaces; there is no sampling, no depth buffer and no resolution.
 * The hidden set of the mesh is the union of those intervals; the visible set is the complement.
 *
 * Tolerance policy (one number, `tolerance`, world units; default `1e-9 * bounds diagonal of the mesh`):
 * - A point counts as BEHIND a triangle only if it is farther than the triangle's plane by MORE than
 *   `tolerance` (perpendicular distance). A curve lying on the surface (a mesh edge and its own faces) is
 *   never hidden by the faces it lies on; two surfaces closer than `tolerance` are not ordered.
 * - The triangle's projected region is CLOSED and grown by a rounding slack (about 1e-12 of the scene's
 *   magnitude, never more than `tolerance`): a point on its boundary counts as inside. Consequently the union over a triangulation has no crack at shared edges,
 *   and a curve exactly behind an occluder's silhouette (an axis-aligned cube behind a cube) is hidden, not
 *   drawn twice; a curve exactly in front of it is visible.
 * - Hidden intervals shorter than `tolerance` are ignored, and visible gaps between hidden intervals
 *   shorter than `tolerance` are closed, so rounding never leaves dust.
 *
 * Near plane. For a perspective camera the part of a segment nearer than `near` is removed (reported as
 * clipped, never drawn) and triangles are clipped to the same plane before use, so geometry behind the eye
 * neither occludes nor mirrors. Orthographic cameras have no near plane.
 *
 * Occluders. `"all"` (default) uses every triangle, so open sheets and back faces occlude correctly; `"front"`
 * uses only camera-facing triangles, which gives the same answer for a closed, consistently oriented mesh
 * and roughly halves the work. Triangles that are edge-on (projected area zero) occlude nothing.
 *
 * Output. Each curve is cut into maximal runs of equal visibility and returned as `ProjectedPath` values:
 * projected 2D points (canvas units), per-point camera depth, `visible`, the source `curve` id and the
 * curve's `tone`; ids are `<curve id>#<n>`. A run that projects to under 1e-6 canvas units (a segment seen end-on)
 * draws nothing and is dropped and counted in `stats.edgeOnRuns`, never returned as a dot. Runs continue across the curve's own vertices, so one visible
 * stroke is one path, and a closed curve that is wholly visible comes back closed. Both visible and hidden
 * runs are returned; the hidden-line POLICY (drop, dash, fade) is the consumer's.
 *
 * Bounded work. Occluder preparation and each segment query are charged as work (triangle candidates
 * tested plus a quarter per tree node visited); over `maxWork` (default DEFAULT_VISIBILITY_WORK) or
 * `MAX_VISIBILITY_SEGMENTS` segments the call throws naming the control to reduce. A 2D bounding-volume
 * hierarchy over the projected triangles (Morton ordered, depth-pruned) keeps typical queries near
 * logarithmic; a pathological view (a huge grazing sheet with very long curves over it) can approach
 * segments x triangles, which is what `maxWork` bounds.
 *
 * Painter order (`paintOrder`). A far-to-near order of the mesh's triangles such that for EVERY pair whose
 * projections overlap in positive area (more than 1e-9 of the smaller one) and that does not intersect
 * within the overlap, the farther triangle comes first. The pairwise test is exact: over the convex overlap
 * polygon the two triangles' depths are compared at every polygon vertex (1/depth is affine in screen
 * position, so the sign there decides the whole polygon); one side wins if the other is never nearer than
 * `tolerance`. Pairs that intersect within the overlap, or are coplanar within `tolerance`, are UNDECIDED and
 * unconstrained; cyclic overlaps (three triangles each in front of the next) are broken at the farthest
 * remaining triangle and counted. Unconstrained triangles fall back to centroid depth (far first). The result
 * reports `exact` (no undecided pair and no cycle break) and the counts; when it is not exact, painting is
 * correct except where those pairs overlap. Faces crossing the perspective near plane are ordered through
 * their clipped pieces (a triangle appears once, at its first piece). Back-facing triangles are dropped with
 * `cull: "back"` (valid for closed, outward-oriented meshes). The painter never sorts by face size or
 * material: it only reads geometry and camera.
 */
import type { Camera } from "./camera.js";
import { componentSeed } from "./core.js";
import { cloudStorage, type PointCloud } from "./mesh-sample.js";
import { meshEdgeVertices, type MeshFeatureEdge, type MeshTopology } from "./mesh-topology.js";
import { meshDerived, meshMeasures, meshStorage, type Mesh, type Vec3 } from "./mesh.js";
import type { CompositionRun, Path } from "./types.js";

export const MAX_VISIBILITY_SEGMENTS = 200_000;
export const DEFAULT_VISIBILITY_WORK = 20_000_000;
const EDGE_ON = 1e-6;

export interface SpatialCurve {
  readonly id: string;
  readonly points: readonly Vec3[];
  readonly closed?: boolean;
  readonly tone?: number;
}
export interface VisibilityOptions {
  /** Absolute world-unit tolerance (see the module header); default 1e-9 times the mesh bounds diagonal. */
  readonly tolerance?: number;
  readonly occluders?: "all" | "front";
  readonly maxWork?: number;
  readonly run?: CompositionRun;
}
export interface HiddenLineOptions extends VisibilityOptions {
  /** Base of per-path seeds (uint32); default 0. */
  readonly seed?: number;
}
export interface ProjectedPath extends Path {
  readonly visible: boolean;
  /** Camera depth of each point (larger is farther). */
  readonly depths: readonly number[];
  /** Id of the curve this run belongs to. */
  readonly curve: string;
}
export interface VisibilityStats {
  readonly segments: number;
  /** Occluder pieces after near-plane clipping and removal of edge-on triangles. */
  readonly occluders: number;
  readonly tests: number;
  readonly nodes: number;
  readonly work: number;
  /** Segments shortened or removed by the near plane. */
  readonly clippedSegments: number;
  /** Runs dropped because they project to less than 1e-6 canvas units (an edge seen end-on). */
  readonly edgeOnRuns: number;
  readonly tolerance: number;
}
export interface HiddenLineResult {
  readonly paths: readonly ProjectedPath[];
  readonly stats: VisibilityStats;
}

// ---------------------------------------------------------------------------------------------
// 2D bounding-volume hierarchy over projected boxes

class Bvh {
  readonly n: number;
  readonly leafBase: number;
  readonly order: Uint32Array;
  readonly minx: Float64Array; readonly miny: Float64Array; readonly maxx: Float64Array; readonly maxy: Float64Array; readonly zmin: Float64Array;
  nodesVisited = 0;
  private readonly boxes: Float64Array;
  private readonly itemZ: Float64Array;
  private readonly stack = new Int32Array(256);

  /** `boxes` holds minx, miny, maxx, maxy per item. */
  constructor(boxes: Float64Array, z: Float64Array, n: number) {
    this.n = n; this.boxes = boxes; this.itemZ = z;
    let gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const cx = (boxes[i * 4] + boxes[i * 4 + 2]) / 2, cy = (boxes[i * 4 + 1] + boxes[i * 4 + 3]) / 2;
      if (cx < gx0) gx0 = cx; if (cx > gx1) gx1 = cx; if (cy < gy0) gy0 = cy; if (cy > gy1) gy1 = cy;
    }
    const sx = gx1 > gx0 ? 65535 / (gx1 - gx0) : 0, sy = gy1 > gy0 ? 65535 / (gy1 - gy0) : 0;
    const spread = (v: number): number => {
      v &= 0xffff; v = (v | (v << 8)) & 0x00ff00ff; v = (v | (v << 4)) & 0x0f0f0f0f; v = (v | (v << 2)) & 0x33333333; v = (v | (v << 1)) & 0x55555555;
      return v >>> 0;
    };
    const keys = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const cx = ((boxes[i * 4] + boxes[i * 4 + 2]) / 2 - gx0) * sx, cy = ((boxes[i * 4 + 1] + boxes[i * 4 + 3]) / 2 - gy0) * sy;
      keys[i] = ((spread(Math.min(65535, cx)) | (spread(Math.min(65535, cy)) << 1)) >>> 0) * 1048576 + i;
    }
    keys.sort();
    this.order = new Uint32Array(n);
    for (let i = 0; i < n; i++) this.order[i] = keys[i] % 1048576;
    const leaves = Math.max(1, Math.ceil(n / 4));
    let width = 1;
    while (width < leaves) width <<= 1;
    this.leafBase = width - 1;
    const size = 2 * width - 1;
    this.minx = new Float64Array(size).fill(Infinity); this.miny = new Float64Array(size).fill(Infinity);
    this.maxx = new Float64Array(size).fill(-Infinity); this.maxy = new Float64Array(size).fill(-Infinity);
    this.zmin = new Float64Array(size).fill(Infinity);
    for (let k = 0; k < n; k++) {
      const node = this.leafBase + (k >> 2), item = this.order[k];
      if (boxes[item * 4] < this.minx[node]) this.minx[node] = boxes[item * 4];
      if (boxes[item * 4 + 1] < this.miny[node]) this.miny[node] = boxes[item * 4 + 1];
      if (boxes[item * 4 + 2] > this.maxx[node]) this.maxx[node] = boxes[item * 4 + 2];
      if (boxes[item * 4 + 3] > this.maxy[node]) this.maxy[node] = boxes[item * 4 + 3];
      if (z[item] < this.zmin[node]) this.zmin[node] = z[item];
    }
    for (let node = this.leafBase - 1; node >= 0; node--) {
      const a = 2 * node + 1, b = a + 1;
      this.minx[node] = Math.min(this.minx[a], this.minx[b]); this.miny[node] = Math.min(this.miny[a], this.miny[b]);
      this.maxx[node] = Math.max(this.maxx[a], this.maxx[b]); this.maxy[node] = Math.max(this.maxy[a], this.maxy[b]);
      this.zmin[node] = Math.min(this.zmin[a], this.zmin[b]);
    }
  }

  /** Items whose box meets the segment (grown by `margin`) and whose nearest depth is below `zmax`. */
  segment(x0: number, y0: number, x1: number, y1: number, margin: number, zmax: number, out: Uint32Array): number {
    let count = 0, top = 0;
    const stack = this.stack, dx = x1 - x0, dy = y1 - y0;
    stack[top++] = 0;
    while (top > 0) {
      const node = stack[--top];
      this.nodesVisited++;
      if (this.zmin[node] >= zmax || !hits(x0, y0, dx, dy, this.minx[node] - margin, this.miny[node] - margin, this.maxx[node] + margin, this.maxy[node] + margin)) continue;
      if (node >= this.leafBase) {
        const from = (node - this.leafBase) * 4, to = Math.min(from + 4, this.n);
        for (let k = from; k < to; k++) {
          const item = this.order[k], b = this.boxes;
          if (this.itemZ[item] < zmax && hits(x0, y0, dx, dy, b[item * 4] - margin, b[item * 4 + 1] - margin, b[item * 4 + 2] + margin, b[item * 4 + 3] + margin)) out[count++] = item;
        }
      } else { stack[top++] = 2 * node + 2; stack[top++] = 2 * node + 1; }
    }
    return count;
  }

  /** Items whose box meets the box. */
  box(x0: number, y0: number, x1: number, y1: number, out: Uint32Array): number {
    let count = 0, top = 0;
    const stack = this.stack;
    stack[top++] = 0;
    while (top > 0) {
      const node = stack[--top];
      this.nodesVisited++;
      if (this.minx[node] > x1 || this.maxx[node] < x0 || this.miny[node] > y1 || this.maxy[node] < y0) continue;
      if (node >= this.leafBase) {
        const from = (node - this.leafBase) * 4, to = Math.min(from + 4, this.n);
        for (let k = from; k < to; k++) {
          const item = this.order[k], b = this.boxes;
          if (!(b[item * 4] > x1 || b[item * 4 + 2] < x0 || b[item * 4 + 1] > y1 || b[item * 4 + 3] < y0)) out[count++] = item;
        }
      } else { stack[top++] = 2 * node + 2; stack[top++] = 2 * node + 1; }
    }
    return count;
  }
}

/** Does the segment from (x0, y0) with direction (dx, dy) meet the box? (Liang-Barsky.) */
function hits(x0: number, y0: number, dx: number, dy: number, minx: number, miny: number, maxx: number, maxy: number): boolean {
  let t0 = 0, t1 = 1;
  if (dx === 0) { if (x0 < minx || x0 > maxx) return false; }
  else {
    let a = (minx - x0) / dx, b = (maxx - x0) / dx;
    if (a > b) { const s = a; a = b; b = s; }
    if (a > t0) t0 = a; if (b < t1) t1 = b;
    if (t0 > t1) return false;
  }
  if (dy === 0) { if (y0 < miny || y0 > maxy) return false; }
  else {
    let a = (miny - y0) / dy, b = (maxy - y0) / dy;
    if (a > b) { const s = a; a = b; b = s; }
    if (a > t0) t0 = a; if (b < t1) t1 = b;
    if (t0 > t1) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// Occluder pieces: triangles in camera space, clipped to the near plane

interface Pieces {
  count: number;
  /** Source triangle of each piece. */
  triangle: Uint32Array;
  /** Screen x, y of the three vertices (counter-clockwise on the canvas is NOT guaranteed; see `orient`). */
  screen: Float64Array;
  /** Camera-space vertices, 9 per piece. */
  view: Float64Array;
  /** Per piece: three edge half-spaces (nx, ny, nz, d) then the "behind" half-space; positive is inside/behind. */
  coef: Float64Array;
  zmin: Float64Array;
  bvh: Bvh;
  perspective: boolean;
  marginScale: number;
}
const pieceCache: { key: string; pieces: Pieces }[] = [];

function cross(ax: number, ay: number, az: number, bx: number, by: number, bz: number, out: number[], o: number): void {
  out[o] = ay * bz - az * by; out[o + 1] = az * bx - ax * bz; out[o + 2] = ax * by - ay * bx;
}

/** Write the four half-spaces for the triangle (a, b, c) in camera space; false if it projects to zero area. */
function planes(perspective: boolean, v: ArrayLike<number>, o: number, coef: Float64Array, c0: number): boolean {
  const ax = v[o], ay = v[o + 1], az = v[o + 2], bx = v[o + 3], by = v[o + 4], bz = v[o + 5], cx = v[o + 6], cy = v[o + 7], cz = v[o + 8];
  const t: number[] = [0, 0, 0];
  cross(bx - ax, by - ay, bz - az, cx - ax, cy - ay, cz - az, t, 0);
  const nl = Math.hypot(t[0], t[1], t[2]);
  if (nl === 0) return false;
  const P = [[ax, ay, az], [bx, by, bz], [cx, cy, cz]];
  if (perspective) {
    const e: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    cross(ax, ay, az, bx, by, bz, e, 0); cross(bx, by, bz, cx, cy, cz, e, 3); cross(cx, cy, cz, ax, ay, az, e, 6);
    const det = e[0] * cx + e[1] * cy + e[2] * cz;
    if (Math.abs(det) <= 1e-15 * Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz) * Math.hypot(cx, cy, cz)) return false;
    const s = det > 0 ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      const l = Math.hypot(e[i * 3], e[i * 3 + 1], e[i * 3 + 2]);
      if (l === 0) return false;
      coef[c0 + i * 4] = s * e[i * 3] / l; coef[c0 + i * 4 + 1] = s * e[i * 3 + 1] / l; coef[c0 + i * 4 + 2] = s * e[i * 3 + 2] / l; coef[c0 + i * 4 + 3] = 0;
    }
    const c = t[0] * ax + t[1] * ay + t[2] * az;
    if (c === 0) return false;
    const sg = c > 0 ? 1 : -1;
    coef[c0 + 12] = sg * t[0] / nl; coef[c0 + 13] = sg * t[1] / nl; coef[c0 + 14] = sg * t[2] / nl; coef[c0 + 15] = -sg * c / nl;
    return true;
  }
  const area2 = t[2];
  if (Math.abs(area2) <= 1e-15 * nl) return false;
  const s = area2 > 0 ? 1 : -1;
  for (let i = 0; i < 3; i++) {
    const p = P[i], q = P[(i + 1) % 3];
    const ex = q[0] - p[0], ey = q[1] - p[1], l = Math.hypot(ex, ey);
    if (l === 0) return false;
    const nx = -s * ey / l, ny = s * ex / l;
    coef[c0 + i * 4] = nx; coef[c0 + i * 4 + 1] = ny; coef[c0 + i * 4 + 2] = 0; coef[c0 + i * 4 + 3] = -(nx * p[0] + ny * p[1]);
  }
  const sg = area2 > 0 ? 1 : -1;
  coef[c0 + 12] = sg * t[0] / nl; coef[c0 + 13] = sg * t[1] / nl; coef[c0 + 14] = sg * t[2] / nl; coef[c0 + 15] = -sg * (t[0] * ax + t[1] * ay + t[2] * az) / nl;
  return true;
}

/** Sutherland-Hodgman against the plane zc = near, keeping zc >= near. Returns 3 or 4 vertices, or fewer than 3. */
function clipNear(v: Float64Array, o: number, near: number): number[][] {
  const poly: number[][] = [];
  for (let i = 0; i < 3; i++) {
    const a = [v[o + i * 3], v[o + i * 3 + 1], v[o + i * 3 + 2]], b = [v[o + ((i + 1) % 3) * 3], v[o + ((i + 1) % 3) * 3 + 1], v[o + ((i + 1) % 3) * 3 + 2]];
    const ain = a[2] >= near, bin = b[2] >= near;
    if (ain) poly.push(a);
    if (ain !== bin) { const t = (near - a[2]) / (b[2] - a[2]); poly.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), near]); }
  }
  return poly;
}

function buildPieces(mesh: Mesh, view: Camera, mode: "all" | "front", cull: boolean, run: CompositionRun | undefined, chargeWork: (n: number) => void): Pieces {
  const key = `${mesh.key}|${view.key}|${mode}|${cull}`;
  const hit = pieceCache.findIndex((entry) => entry.key === key);
  if (hit >= 0) { const [entry] = pieceCache.splice(hit, 1); pieceCache.push(entry); chargeWork(entry.pieces.count); return entry.pieces; }
  const s = meshStorage(mesh), d = meshDerived(mesh), perspective = view.options.projection === "perspective", near = view.options.near;
  const T = mesh.triangleCount;
  chargeWork(T * 2);
  const camVerts = new Float64Array(mesh.vertexCount * 3);
  for (let i = 0; i < mesh.vertexCount; i++) view.toView(s.positions[i * 3], s.positions[i * 3 + 1], s.positions[i * 3 + 2], camVerts, i * 3);
  // One piece per triangle, more only when the near plane splits a triangle in two; storage grows on demand and is trimmed at the end.
  let capacity = T;
  let triangle = new Uint32Array(capacity), viewOut = new Float64Array(capacity * 9), coef = new Float64Array(capacity * 16), screen = new Float64Array(capacity * 6), boxes = new Float64Array(capacity * 4), zmin = new Float64Array(capacity);
  const grow = (): void => {
    capacity = Math.ceil(capacity * 1.5) + 8;
    const widen = <A extends Float64Array | Uint32Array>(a: A, per: number): A => { const b = new (a.constructor as new (n: number) => A)(capacity * per); b.set(a); return b; };
    triangle = widen(triangle, 1); viewOut = widen(viewOut, 9); coef = widen(coef, 16); screen = widen(screen, 6); boxes = widen(boxes, 4); zmin = widen(zmin, 1);
  };
  const local = new Float64Array(9);
  let count = 0;
  const [cx, cy] = view.options.center, focal = view.options.zoom * view.options.distance;
  const emit = (t: number, o: number, source: Float64Array): void => {
    if (count === capacity) grow();
    if (!planes(perspective, source, o, coef, count * 16)) return;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity, zlow = Infinity;
    for (let k = 0; k < 3; k++) {
      const xc = source[o + k * 3], yc = source[o + k * 3 + 1], zc = source[o + k * 3 + 2];
      const scale = perspective ? focal / zc : view.options.zoom, x = cx + scale * xc, y = cy - scale * yc;
      screen[count * 6 + k * 2] = x; screen[count * 6 + k * 2 + 1] = y;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; if (zc < zlow) zlow = zc;
      viewOut[count * 9 + k * 3] = xc; viewOut[count * 9 + k * 3 + 1] = yc; viewOut[count * 9 + k * 3 + 2] = zc;
    }
    boxes[count * 4] = minx; boxes[count * 4 + 1] = miny; boxes[count * 4 + 2] = maxx; boxes[count * 4 + 3] = maxy;
    zmin[count] = zlow; triangle[count] = t; count++;
  };
  for (let t = 0; t < T; t++) {
    if ((t & 4095) === 0) run?.check();
    const a = s.triangles[t * 3], b = s.triangles[t * 3 + 1], c = s.triangles[t * 3 + 2];
    if (mode === "front" || cull) {
      const nx = d.triangleNormals[t * 3], ny = d.triangleNormals[t * 3 + 1], nz = d.triangleNormals[t * 3 + 2];
      const dot = perspective ? nx * (view.eye[0] - s.positions[a * 3]) + ny * (view.eye[1] - s.positions[a * 3 + 1]) + nz * (view.eye[2] - s.positions[a * 3 + 2])
        : -(nx * view.forward[0] + ny * view.forward[1] + nz * view.forward[2]);
      if (!(dot > 0)) continue;
    }
    for (let k = 0; k < 3; k++) { const v = [a, b, c][k]; local[k * 3] = camVerts[v * 3]; local[k * 3 + 1] = camVerts[v * 3 + 1]; local[k * 3 + 2] = camVerts[v * 3 + 2]; }
    if (perspective && (local[2] < near || local[5] < near || local[8] < near)) {
      const poly = clipNear(local, 0, near);
      if (poly.length < 3) continue;
      const scratch = new Float64Array(9);
      for (let k = 1; k + 1 < poly.length; k++) {
        [poly[0], poly[k], poly[k + 1]].forEach((p, i) => { scratch[i * 3] = p[0]; scratch[i * 3 + 1] = p[1]; scratch[i * 3 + 2] = p[2]; });
        emit(t, 0, scratch);
      }
    } else emit(t, 0, local);
  }
  chargeWork(count);
  const tight = { triangle: triangle.slice(0, count), screen: screen.slice(0, count * 6), view: viewOut.slice(0, count * 9), coef: coef.slice(0, count * 16), zmin: zmin.slice(0, count) };
  const pieces: Pieces = {
    count, ...tight, bvh: new Bvh(boxes.slice(0, count * 4), tight.zmin, count),
    perspective, marginScale: perspective ? focal / near : view.options.zoom,
  };
  pieceCache.push({ key, pieces });
  // keep at most two prepared views, and drop older ones while the pieces held exceed 500,000 (about 150 MB)
  while (pieceCache.length > 2 || (pieceCache.length > 1 && pieceCache.reduce((sum, entry) => sum + entry.pieces.count, 0) > 500_000)) pieceCache.shift();
  return pieces;
}

function defaultTolerance(mesh: Mesh, options: VisibilityOptions): number {
  const tolerance = options.tolerance ?? 1e-9 * meshMeasures(mesh).diagonal;
  if (typeof tolerance !== "number" || !Number.isFinite(tolerance) || tolerance < 0) throw new Error(`Visibility tolerance must be a finite non-negative number (got ${String(tolerance)})`);
  return tolerance;
}

/**
 * How far a triangle's projected region is grown so that coincident boundaries (a curve exactly on an occluder's
 * silhouette) and shared edges are robust against rounding: about 1e-12 of the largest camera-space magnitude,
 * never more than the tolerance. Independent of the depth tolerance's default so a coarse tolerance does not
 * inflate silhouettes.
 */
function coverSlack(mesh: Mesh, view: Camera, tolerance: number): number {
  return Math.min(tolerance, 1e-12 * (view.options.distance + meshMeasures(mesh).diagonal));
}

function workGuard(options: VisibilityOptions, what: string): { charge: (n: number) => void; used: () => number } {
  const max = options.maxWork ?? DEFAULT_VISIBILITY_WORK;
  if (!Number.isFinite(max) || max < 0) throw new Error("Visibility maxWork must be a finite non-negative number");
  let used = 0;
  return {
    charge(n) {
      used += n;
      if (used > max) throw new Error(`${what} needs more than maxWork = ${max} units of work (used ${Math.round(used)}); reduce the curves or mesh detail, or raise maxWork`);
    },
    used: () => used,
  };
}

// ---------------------------------------------------------------------------------------------
// Hidden lines

interface Run { visible: boolean; points: [number, number][]; depths: number[]; startsAtVertex: boolean; endsAtVertex: boolean }

/** Hidden-line removal of `curves` against `mesh` seen through `view` (see the module header). */
export function hiddenLines(mesh: Mesh, curves: readonly SpatialCurve[], view: Camera, options: HiddenLineOptions = {}): HiddenLineResult {
  const seed = options.seed ?? 0;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("hiddenLines: seed must be a uint32 integer");
  const mode = options.occluders ?? "all";
  if (mode !== "all" && mode !== "front") throw new Error('hiddenLines: occluders must be "all" or "front"');
  const tolerance = defaultTolerance(mesh, options);
  const ids = new Set<string>();
  let segmentCount = 0;
  for (const curve of curves) {
    if (typeof curve.id !== "string" || curve.id.length === 0) throw new Error("hiddenLines: every curve needs a non-empty id");
    if (ids.has(curve.id)) throw new Error(`hiddenLines: curve id "${curve.id}" is repeated`);
    ids.add(curve.id);
    if (!Array.isArray(curve.points) || curve.points.length < 2) throw new Error(`hiddenLines: curve "${curve.id}" needs at least two points`);
    curve.points.forEach((p, i) => { if (!Array.isArray(p) || p.length !== 3 || p.some((v) => typeof v !== "number" || !Number.isFinite(v))) throw new Error(`hiddenLines: curve "${curve.id}" point ${i} must be three finite numbers`); });
    segmentCount += curve.points.length - 1 + (curve.closed ? 1 : 0);
  }
  if (segmentCount > MAX_VISIBILITY_SEGMENTS) throw new Error(`hiddenLines: ${segmentCount} curve segments; the limit is ${MAX_VISIBILITY_SEGMENTS}; reduce the curves`);
  const guard = workGuard(options, "hiddenLines");
  const pieces = buildPieces(mesh, view, mode, false, options.run, guard.charge);
  const slack = coverSlack(mesh, view, tolerance);
  const perspective = view.options.projection === "perspective", near = view.options.near;
  const [ccx, ccy] = view.options.center, focal = view.options.zoom * view.options.distance, margin = slack * pieces.marginScale + 1e-12;
  const candidates = new Uint32Array(Math.max(1, pieces.count));
  const q0 = new Float64Array(3), q1 = new Float64Array(3);
  const paths: ProjectedPath[] = [];
  let tests = 0, clipped = 0, segmentsDone = 0, edgeOn = 0;
  const lows: number[] = [], highs: number[] = [];

  for (const curve of curves) {
    const runs: Run[] = [];
    const n = curve.points.length, total = n - 1 + (curve.closed ? 1 : 0);
    let continuing = false; // the last piece ended exactly at a curve vertex
    for (let s = 0; s < total; s++) {
      if ((segmentsDone++ & 63) === 0) options.run?.check();
      const p0 = curve.points[s], p1 = curve.points[(s + 1) % n];
      view.toView(p0[0], p0[1], p0[2], q0, 0); view.toView(p1[0], p1[1], p1[2], q1, 0);
      let ta = 0, tb = 1;
      if (perspective) {
        if (q0[2] < near && q1[2] < near) { clipped++; continuing = false; continue; }
        if (q0[2] < near) ta = (near - q0[2]) / (q1[2] - q0[2]);
        else if (q1[2] < near) tb = (near - q0[2]) / (q1[2] - q0[2]);
        if (ta !== 0 || tb !== 1) clipped++;
      }
      const ax = q0[0] + ta * (q1[0] - q0[0]), ay = q0[1] + ta * (q1[1] - q0[1]), az = q0[2] + ta * (q1[2] - q0[2]);
      const bx = q0[0] + tb * (q1[0] - q0[0]), by = q0[1] + tb * (q1[1] - q0[1]), bz = q0[2] + tb * (q1[2] - q0[2]);
      const length = Math.hypot(bx - ax, by - ay, bz - az);
      if (length === 0) continue; // repeated point: nothing to draw, continuity is preserved
      const sa = perspective ? focal / az : view.options.zoom, sb = perspective ? focal / bz : view.options.zoom;
      const X0 = ccx + sa * ax, Y0 = ccy - sa * ay, X1 = ccx + sb * bx, Y1 = ccy - sb * by;
      const nodesBefore = pieces.bvh.nodesVisited;
      const count = pieces.bvh.segment(X0, Y0, X1, Y1, margin, Math.max(az, bz), candidates);
      tests += count;
      guard.charge(count + 0.25 * (pieces.bvh.nodesVisited - nodesBefore) + 1);
      lows.length = 0; highs.length = 0;
      const c = pieces.coef, dx = bx - ax, dy = by - ay, dz = bz - az;
      for (let k = 0; k < count; k++) {
        const o = candidates[k] * 16;
        let lo = 0, hi = 1, alive = true;
        for (let f = 0; f < 4 && alive; f++) {
          const nx = c[o + f * 4], ny = c[o + f * 4 + 1], nz = c[o + f * 4 + 2], dd = c[o + f * 4 + 3];
          // h >= -tolerance for edge planes, g > tolerance for the depth plane
          const shift = f < 3 ? slack : -tolerance;
          const va = nx * ax + ny * ay + nz * az + dd + shift, vb = va + nx * dx + ny * dy + nz * dz;
          if (va >= 0 && vb >= 0) continue;
          if (va < 0 && vb < 0) { alive = false; break; }
          const t = va / (va - vb);
          if (va < 0) { if (t > lo) lo = t; } else if (t < hi) hi = t;
          if (lo >= hi) alive = false;
        }
        if (alive && hi > lo) { lows.push(lo); highs.push(hi); }
      }
      // union of hidden intervals, ignoring those shorter than the tolerance and closing gaps shorter than it
      const tol = tolerance / length;
      const order = lows.map((_, i) => i).filter((i) => highs[i] - lows[i] >= tol).sort((i, j) => lows[i] - lows[j]);
      const merged: [number, number][] = [];
      for (const i of order) {
        const last = merged[merged.length - 1];
        if (last && lows[i] <= last[1] + tol) last[1] = Math.max(last[1], highs[i]); else merged.push([lows[i], highs[i]]);
      }
      const spans: [number, number, boolean][] = [];
      let cursor = 0;
      for (const [lo, hi] of merged) { if (lo > cursor) spans.push([cursor, lo, true]); spans.push([lo, hi, false]); cursor = hi; }
      if (cursor < 1) spans.push([cursor, 1, true]);
      // visible dust shorter than the tolerance is absorbed by the hidden run beside it
      for (let i = 0; i < spans.length && spans.length > 1; i++) if (spans[i][2] && spans[i][1] - spans[i][0] < tol) spans[i][2] = false;
      const joined: [number, number, boolean][] = [];
      for (const span of spans) { const last = joined[joined.length - 1]; if (last && last[2] === span[2]) last[1] = span[1]; else joined.push([...span]); }
      for (const [lo, hi, visible] of joined) {
        const startVertex = ta === 0 && lo === 0, endVertex = tb === 1 && hi === 1;
        const at = (u: number): [number, number, number] => {
          const x = ax + u * dx, y = ay + u * dy, z = az + u * dz, scale = perspective ? focal / z : view.options.zoom;
          return [ccx + scale * x, ccy - scale * y, z];
        };
        const start = at(lo), end = at(hi);
        const last = runs[runs.length - 1];
        if (last && last.visible === visible && continuing && startVertex) { last.points.push([end[0], end[1]]); last.depths.push(end[2]); }
        else runs.push({ visible, points: [[start[0], start[1]], [end[0], end[1]]], depths: [start[2], end[2]], startsAtVertex: startVertex, endsAtVertex: false });
        runs[runs.length - 1].endsAtVertex = endVertex;
        continuing = endVertex;
      }
    }
    let closedWhole = false;
    if (curve.closed && runs.length > 0) {
      const first = runs[0], last = runs[runs.length - 1];
      if (runs.length === 1 && first.startsAtVertex && first.endsAtVertex) { first.points.pop(); first.depths.pop(); closedWhole = true; }
      else if (runs.length > 1 && first.startsAtVertex && last.endsAtVertex && first.visible === last.visible) {
        last.points.push(...first.points.slice(1)); last.depths.push(...first.depths.slice(1)); last.endsAtVertex = first.endsAtVertex;
        runs.shift();
      }
    }
    let ordinal = 0;
    for (const r of runs) {
      let projected = 0;
      for (let i = 1; i < r.points.length; i++) projected += Math.hypot(r.points[i][0] - r.points[i - 1][0], r.points[i][1] - r.points[i - 1][1]);
      if (projected < EDGE_ON) { edgeOn++; continue; }
      const id = `${curve.id}#${ordinal++}`;
      paths.push(Object.freeze({
        id, seed: componentSeed(seed, id, "path"), points: Object.freeze(r.points.map((p) => Object.freeze([p[0], p[1]] as const))), closed: closedWhole,
        level: 0, levelFraction: 0, ...(curve.tone === undefined ? {} : { tone: curve.tone }),
        visible: r.visible, depths: Object.freeze(r.depths), curve: curve.id,
      }));
    }
  }
  return Object.freeze({ paths: Object.freeze(paths), stats: Object.freeze({
    segments: segmentCount, occluders: pieces.count, tests, nodes: pieces.bvh.nodesVisited, work: guard.used(), clippedSegments: clipped, edgeOnRuns: edgeOn, tolerance }) });
}

/**
 * Which points a mesh hides: 1 = visible, 0 = hidden (behind a triangle by more than the tolerance) or
 * removed by a perspective near plane. Points on the mesh itself are visible where the surface faces them
 * and hidden where another part of the mesh covers them, with the same tolerance rules as hidden lines.
 */
export function visiblePoints(mesh: Mesh, cloud: PointCloud, view: Camera, options: VisibilityOptions = {}): Uint8Array {
  const mode = options.occluders ?? "all";
  if (mode !== "all" && mode !== "front") throw new Error('visiblePoints: occluders must be "all" or "front"');
  const tolerance = defaultTolerance(mesh, options), guard = workGuard(options, "visiblePoints");
  const pieces = buildPieces(mesh, view, mode, false, options.run, guard.charge), slack = coverSlack(mesh, view, tolerance);
  const positions = cloudStorage(cloud).positions, out = new Uint8Array(cloud.count).fill(1);
  const perspective = view.options.projection === "perspective", near = view.options.near, [cx, cy] = view.options.center, focal = view.options.zoom * view.options.distance;
  const margin = slack * pieces.marginScale + 1e-12, q = new Float64Array(3), candidates = new Uint32Array(Math.max(1, pieces.count)), c = pieces.coef;
  for (let i = 0; i < cloud.count; i++) {
    if ((i & 1023) === 0) options.run?.check();
    view.toView(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], q, 0);
    if (perspective && q[2] < near) { out[i] = 0; continue; }
    const scale = perspective ? focal / q[2] : view.options.zoom, x = cx + scale * q[0], y = cy - scale * q[1];
    const count = pieces.bvh.segment(x, y, x, y, margin, q[2], candidates);
    guard.charge(count + 1);
    for (let k = 0; k < count; k++) {
      const o = candidates[k] * 16;
      let inside = true;
      for (let f = 0; f < 3 && inside; f++) if (c[o + f * 4] * q[0] + c[o + f * 4 + 1] * q[1] + c[o + f * 4 + 2] * q[2] + c[o + f * 4 + 3] < -slack) inside = false;
      if (inside && c[o + 12] * q[0] + c[o + 13] * q[1] + c[o + 14] * q[2] + c[o + 15] > tolerance) { out[i] = 0; break; }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Curves from mesh edges

/**
 * Chain selected mesh edges into polylines. Edges are grouped by `tone` (default: one group), and within
 * a group chains run through vertices where exactly two selected edges meet and stop at every other vertex,
 * so a curve never crosses a junction or changes tone. Deterministic: chains start at the lowest edge.
 * Ids `chain:<lowest edge id>`; tone is carried to the curve. Mesh diagonals inside quads are never edges.
 */
export function meshEdgeCurves(mesh: Mesh, topology: MeshTopology, edges: readonly (number | MeshFeatureEdge)[]): readonly SpatialCurve[] {
  const items = edges.map((e) => (typeof e === "number" ? { edge: e, tone: undefined as number | undefined } : { edge: e.edge, tone: e.tone as number | undefined }));
  const positions = meshStorage(mesh).positions, out: SpatialCurve[] = [];
  const tones = [...new Set(items.map((i) => i.tone))].sort((a, b) => (a ?? -1) - (b ?? -1));
  for (const tone of tones) {
    const group = items.filter((i) => i.tone === tone).map((i) => i.edge).sort((a, b) => a - b);
    const ends = group.map((e) => meshEdgeVertices(topology, e));
    const at = new Map<number, number[]>();
    group.forEach((_, i) => { for (const v of ends[i]) (at.get(v) ?? at.set(v, []).get(v)!).push(i); });
    const used = new Uint8Array(group.length);
    const walk = (start: number, from: number): { vertices: number[]; edges: number[] } => {
      const vertices = [from], chain = [group[start]];
      used[start] = 1;
      let vertex = ends[start][0] === from ? ends[start][1] : ends[start][0];
      vertices.push(vertex);
      for (;;) {
        const incident = at.get(vertex)!;
        if (incident.length !== 2) break;
        const next = incident.find((i) => !used[i]);
        if (next === undefined) break;
        used[next] = 1; chain.push(group[next]);
        vertex = ends[next][0] === vertex ? ends[next][1] : ends[next][0];
        vertices.push(vertex);
      }
      return { vertices, edges: chain };
    };
    const emit = (vertices: number[], chain: number[], closed: boolean): void => {
      const lowest = Math.min(...chain);
      out.push(Object.freeze({
        id: `chain:e:${meshEdgeVertices(topology, lowest).join("-")}`, closed,
        points: Object.freeze(vertices.slice(0, closed ? -1 : undefined).map((v) => Object.freeze([positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]] as const) as Vec3)),
        ...(tone === undefined ? {} : { tone }),
      }));
    };
    for (let i = 0; i < group.length; i++) {
      if (used[i]) continue;
      // start at an open end (a vertex with other than two selected edges) when the edge has one
      const [a, b] = ends[i];
      const openEnd = at.get(a)!.length !== 2 ? a : at.get(b)!.length !== 2 ? b : -1;
      if (openEnd < 0) continue;
      const { vertices, edges: chain } = walk(i, openEnd);
      emit(vertices, chain, false);
    }
    for (let i = 0; i < group.length; i++) {
      if (used[i]) continue;
      const { vertices, edges: chain } = walk(i, ends[i][0]);
      emit(vertices, chain, vertices[0] === vertices[vertices.length - 1]);
    }
  }
  return Object.freeze(out);
}

// ---------------------------------------------------------------------------------------------
// Painter order

export interface PaintOptions {
  readonly cull?: "back" | "none";
  readonly tolerance?: number;
  readonly maxWork?: number;
  readonly run?: CompositionRun;
}
export interface PaintOrder {
  /** Triangle indices, far to near (paint first to last). Culled and fully clipped triangles are absent. */
  readonly order: readonly number[];
  readonly culled: number;
  /** Facing triangles removed entirely: behind the perspective near plane or edge-on. */
  readonly clipped: number;
  /** Pairs of pieces overlapping in positive projected area. */
  readonly overlapping: number;
  /** Overlapping pairs with a decided order (each is a constraint). */
  readonly constraints: number;
  /** Overlapping pairs that intersect within the overlap or are coplanar: unconstrained. */
  readonly undecided: number;
  /** Times a cycle of constraints was broken at the farthest remaining piece. */
  readonly cycleBreaks: number;
  /** No undecided pair and no cycle break: every overlapping pair is painted correctly. */
  readonly exact: boolean;
}

function clipConvex(subject: number[], clip: number[]): number[] {
  // both counter-clockwise polygons as flat x,y lists; returns the intersection polygon
  let poly = subject;
  for (let e = 0; e < clip.length / 2 && poly.length > 0; e++) {
    const ax = clip[e * 2], ay = clip[e * 2 + 1], bx = clip[((e + 1) % (clip.length / 2)) * 2], by = clip[((e + 1) % (clip.length / 2)) * 2 + 1];
    const side = (x: number, y: number): number => (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    const next: number[] = [], m = poly.length / 2;
    for (let i = 0; i < m; i++) {
      const px = poly[i * 2], py = poly[i * 2 + 1], qx = poly[((i + 1) % m) * 2], qy = poly[((i + 1) % m) * 2 + 1];
      const sp = side(px, py), sq = side(qx, qy);
      if (sp >= 0) next.push(px, py);
      if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) { const t = sp / (sp - sq); next.push(px + t * (qx - px), py + t * (qy - py)); }
    }
    poly = next;
  }
  return poly;
}
const shoelace = (poly: number[]): number => {
  let sum = 0;
  const m = poly.length / 2;
  for (let i = 0; i < m; i++) sum += poly[i * 2] * poly[((i + 1) % m) * 2 + 1] - poly[((i + 1) % m) * 2] * poly[i * 2 + 1];
  return sum / 2;
};

export function paintOrder(mesh: Mesh, view: Camera, options: PaintOptions = {}): PaintOrder {
  const cull = options.cull ?? "none";
  if (cull !== "back" && cull !== "none") throw new Error('paintOrder: cull must be "back" or "none"');
  const tolerance = defaultTolerance(mesh, options), guard = workGuard(options, "paintOrder");
  const pieces = buildPieces(mesh, view, "all", cull === "back", options.run, guard.charge);
  const n = pieces.count, perspective = pieces.perspective, [cx, cy] = view.options.center, focal = view.options.zoom * view.options.distance;
  const totalTriangles = mesh.triangleCount;
  let culledCount = 0;
  if (cull === "back") {
    const d = meshDerived(mesh), s = meshStorage(mesh);
    for (let t = 0; t < totalTriangles; t++) {
      const a = s.triangles[t * 3], nx = d.triangleNormals[t * 3], ny = d.triangleNormals[t * 3 + 1], nz = d.triangleNormals[t * 3 + 2];
      const dot = perspective ? nx * (view.eye[0] - s.positions[a * 3]) + ny * (view.eye[1] - s.positions[a * 3 + 1]) + nz * (view.eye[2] - s.positions[a * 3 + 2])
        : -(nx * view.forward[0] + ny * view.forward[1] + nz * view.forward[2]);
      if (!(dot > 0)) culledCount++;
    }
  }
  // counter-clockwise screen polygons and centroid depths
  const poly: number[][] = new Array(n), depth = new Float64Array(n), area = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = Array.from(pieces.screen.subarray(i * 6, i * 6 + 6));
    if (shoelace(p) < 0) { [p[2], p[3], p[4], p[5]] = [p[4], p[5], p[2], p[3]]; }
    poly[i] = p; area[i] = shoelace(p);
    depth[i] = (pieces.view[i * 9 + 2] + pieces.view[i * 9 + 5] + pieces.view[i * 9 + 8]) / 3;
  }
  const depthAt = (piece: number, x: number, y: number): number => {
    const o = piece * 16 + 12, c = pieces.coef;
    if (perspective) {
      const rx = (x - cx) / focal, ry = -(y - cy) / focal;
      return -c[o + 3] / (c[o] * rx + c[o + 1] * ry + c[o + 2]);
    }
    const rx = (x - cx) / view.options.zoom, ry = -(y - cy) / view.options.zoom;
    return -(c[o + 3] + c[o] * rx + c[o + 1] * ry) / c[o + 2];
  };
  const from: number[] = [], to: number[] = [];
  let overlapping = 0, undecided = 0;
  const candidates = new Uint32Array(Math.max(1, n));
  const b = pieces.bvh;
  for (let i = 0; i < n; i++) {
    if ((i & 255) === 0) options.run?.check();
    const p = poly[i];
    const found = b.box(Math.min(p[0], p[2], p[4]), Math.min(p[1], p[3], p[5]), Math.max(p[0], p[2], p[4]), Math.max(p[1], p[3], p[5]), candidates);
    guard.charge(found + 1);
    for (let k = 0; k < found; k++) {
      const j = candidates[k];
      if (j <= i) continue;
      const overlap = clipConvex(p, poly[j]);
      if (overlap.length < 6) continue;
      const areaOverlap = shoelace(overlap);
      if (!(areaOverlap > 1e-9 * Math.min(area[i], area[j]))) continue;
      overlapping++;
      let iFront = false, jFront = false;
      for (let v = 0; v < overlap.length / 2; v++) {
        const zi = depthAt(i, overlap[v * 2], overlap[v * 2 + 1]), zj = depthAt(j, overlap[v * 2], overlap[v * 2 + 1]);
        if (zi < zj - tolerance) iFront = true; else if (zj < zi - tolerance) jFront = true;
      }
      if (iFront === jFront) { undecided++; continue; }
      // the farther piece is painted first
      if (iFront) { from.push(j); to.push(i); } else { from.push(i); to.push(j); }
    }
  }
  // Kahn's algorithm; ready pieces leave farthest first, a stall is broken at the farthest remaining piece
  const indegree = new Uint32Array(n), start = new Uint32Array(n + 1);
  for (let e = 0; e < from.length; e++) { indegree[to[e]]++; start[from[e] + 1]++; }
  for (let i = 0; i < n; i++) start[i + 1] += start[i];
  const fill = start.slice(0, n), successors = new Uint32Array(from.length);
  for (let e = 0; e < from.length; e++) successors[fill[from[e]]++] = to[e];
  const better = (a: number, c: number): boolean => depth[a] > depth[c] || (depth[a] === depth[c] && a < c);
  const heap: number[] = [];
  const push = (v: number): void => {
    heap.push(v);
    let i = heap.length - 1;
    while (i > 0) { const parent = (i - 1) >> 1; if (better(heap[i], heap[parent])) { [heap[i], heap[parent]] = [heap[parent], heap[i]]; i = parent; } else break; }
  };
  const pop = (): number => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let best = i;
        if (l < heap.length && better(heap[l], heap[best])) best = l;
        if (r < heap.length && better(heap[r], heap[best])) best = r;
        if (best === i) break;
        [heap[i], heap[best]] = [heap[best], heap[i]]; i = best;
      }
    }
    return top;
  };
  const byDepth = Array.from({ length: n }, (_, i) => i).sort((a, c) => (better(a, c) ? -1 : 1));
  const emitted = new Uint8Array(n), sequence: number[] = [];
  let cursor = 0, cycleBreaks = 0;
  for (let i = 0; i < n; i++) if (indegree[i] === 0) push(i);
  const release = (v: number): void => {
    emitted[v] = 1; sequence.push(v);
    for (let e = start[v]; e < start[v + 1]; e++) { const w = successors[e]; if (!emitted[w] && --indegree[w] === 0) push(w); }
  };
  while (sequence.length < n) {
    while (heap.length > 0) { const v = pop(); if (!emitted[v]) release(v); }
    if (sequence.length >= n) break;
    while (emitted[byDepth[cursor]]) cursor++;
    cycleBreaks++;
    indegree[byDepth[cursor]] = 0;
    release(byDepth[cursor]);
  }
  const seen = new Set<number>(), order: number[] = [];
  for (const piece of sequence) { const t = pieces.triangle[piece]; if (!seen.has(t)) { seen.add(t); order.push(t); } }
  const clippedTriangles = totalTriangles - culledCount - seen.size;
  return Object.freeze({ order: Object.freeze(order), culled: culledCount, clipped: clippedTriangles, overlapping, constraints: from.length, undecided, cycleBreaks,
    exact: undecided === 0 && cycleBreaks === 0 });
}
