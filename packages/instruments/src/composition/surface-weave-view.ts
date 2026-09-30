import { camera as makeCamera, type Camera, type Projection } from "./camera.js";
import type { CrossingOrder } from "./crossing-order.js";
import type { Crossing, CrossingSet } from "./crossings.js";
import { meshTopology } from "./mesh-topology.js";
import { meshMeasures, type Mesh, type Vec3 } from "./mesh.js";
import type { SurfaceWeaveProducts } from "./surface-weave-products.js";
import type { Path } from "./types.js";
import { hiddenLines, type ProjectedPath, type SpatialCurve } from "./visibility.js";

/**
 * Surface Weave, camera stage: the SAME frozen strands, crossings and order seen through a camera.
 *
 *   projectWeave  (camera)                          → canvas strands, hidden-line intervals, canvas crossing table
 *   (surface-weave-pieces.ts) weavePieces / weaveModel: cut threads for given widths, and the surface's own edges
 *
 * Changing the camera recomputes these stages and never the mesh, strands, crossings or order (the products are inputs,
 * not results, of this module). Changing widths, clearance or the cross-section recomputes `weavePieces` only; palette,
 * shading and colour recompute nothing.
 *
 * CAMERA. `weaveCamera` targets the centre of the mesh bounds; `size` is the canvas length of the bounds diagonal at the
 * target depth, `distance` (perspective) is in bounding diagonals. Every strand vertex must lie beyond the perspective
 * near plane; otherwise `projectWeave` throws naming Distance (a picture with part of the surface missing would
 * misreport the weave). With the instrument's minimum distance of 0.7 diagonals this cannot happen.
 *
 * PROJECTED CROSSINGS. Each surface crossing keeps its index, id and first/second sides; its point is the projection
 * of the 3D crossing, its `s` the arc length in CANVAS units along the projected strand, its tangents the projected segment
 * directions and its `sine` |sin| of the angle between them IN THE PICTURE (floored at 1e-4: an edge-on segment has no
 * angle). Over and under is the SURFACE order (`orderCrossings` on the camera-free set), reused unchanged, so the weave never
 * depends on the camera and rotating the view cannot flip a crossing. Indices, ids and the order along every strand are those
 * of the surface set, and running `orderCrossings` on this canvas set with strands presented open gives the same `over`.
 *
 * VISIBILITY. Strands are given to `hiddenLines` as curves on the mesh (a closed strand as an open curve that repeats its
 * first vertex); the mesh occludes them exactly (a strand lies ON the surface, so it is never hidden by its own faces; it
 * is hidden by another part of the surface in front, by the far wall of a vessel, or by an overhang). The runs give
 * intervals of canvas arc length per strand, `hidden` and `visible`. A crossing is `visible` when both strands are visible there.
 *
 * WORK. `hiddenLines` charges its own bounded work (`maxWork`, default 20,000,000; `stats.work`); the rest is linear in
 * vertices and crossings. Cached per order object and camera key, 4 cameras.
 */
export interface WeaveViewOptions {
  projection: Projection; yaw: number; pitch: number; roll: number;
  /** Eye distance in bounding diagonals (perspective only). */
  distance: number;
  centerX: number; centerY: number;
  /** Canvas length of the bounds diagonal at the target depth. */
  size: number;
}

export function weaveCamera(mesh: Mesh, view: WeaveViewOptions): Camera {
  const { min, max } = mesh.bounds, diagonal = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  if (!(view.size > 0) || !Number.isFinite(view.size)) throw new Error("Size must be a positive number");
  if (view.projection === "perspective" && !(view.distance >= 0.5)) throw new Error("Distance must be at least 0.5 bounding diagonals");
  return makeCamera({
    projection: view.projection, yaw: view.yaw, pitch: view.pitch, roll: view.roll,
    target: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    zoom: view.size / diagonal, distance: (view.projection === "perspective" ? view.distance : 3) * diagonal, center: [view.centerX, view.centerY],
  });
}

export type Interval = readonly [number, number];
export interface ProjectedStrand {
  readonly path: Path;
  /** Canvas arc length at each vertex, then the total (`vertices + 1` entries for a closed strand, else `vertices`). */
  readonly cumulative: Float64Array;
  readonly length: number;
  readonly depth: Float64Array;
  readonly meanDepth: number;
  readonly hidden: readonly Interval[];
  readonly visible: readonly Interval[];
}
export interface ProjectedWeave {
  readonly camera: Camera;
  readonly strands: readonly ProjectedStrand[];
  /** The canvas crossing table: indices, ids and sides of the surface crossings. */
  readonly set: CrossingSet;
  readonly order: CrossingOrder;
  /** 1 when both strands are visible at the crossing. */
  readonly visibleCrossing: Uint8Array;
  readonly depthRange: readonly [number, number];
  readonly stats: { readonly hiddenLength: number; readonly visibleLength: number; readonly work: number };
}

const projections = new WeakMap<CrossingOrder, Map<string, ProjectedWeave>>();

function within(intervals: readonly Interval[], s: number): boolean {
  for (const [a, b] of intervals) if (s >= a - 1e-6 && s <= b + 1e-6) return true;
  return false;
}

export function projectWeave(products: SurfaceWeaveProducts, view: Camera): ProjectedWeave {
  let byCamera = projections.get(products.order);
  const known = byCamera?.get(view.key);
  if (known) return known;
  const { mesh, strands, crossings } = products;
  const topology = meshTopology(mesh), closedSolid = topology.kind === "closed-manifold" && meshMeasures(mesh).signedVolume > 0;
  const canvas: { x: Float64Array; y: Float64Array; segments: number }[] = [], out: ProjectedStrand[] = [];
  let near = Infinity, far = -Infinity;
  const curves: SpatialCurve[] = [];
  const staged = strands.map((strand, index) => {
    const n = strand.points.length, segments = strand.closed ? n : n - 1;
    const x = new Float64Array(n), y = new Float64Array(n), depth = new Float64Array(n), cumulative = new Float64Array(segments + 1);
    for (let k = 0; k < n; k++) {
      const p = view.project(strand.points[k]);
      if (p === null) throw new Error(`Strand ${strand.id} reaches the camera's near plane; raise Distance so the whole surface lies in front of it`);
      x[k] = p.x; y[k] = p.y; depth[k] = p.depth;
      near = Math.min(near, p.depth); far = Math.max(far, p.depth);
    }
    for (let k = 0; k < segments; k++) cumulative[k + 1] = cumulative[k] + Math.hypot(x[(k + 1) % n] - x[k], y[(k + 1) % n] - y[k]);
    canvas.push({ x, y, segments });
    curves.push({ id: strand.id, points: strand.closed ? [...strand.points, strand.points[0]] as Vec3[] : strand.points as Vec3[], closed: false, tone: strand.family });
    let mean = 0;
    for (let k = 0; k < n; k++) mean += depth[k];
    return { index, x, y, depth, cumulative, mean: mean / n };
  });
  const result = hiddenLines(mesh, curves, view, { occluders: closedSolid ? "front" : "all" });
  const runsByStrand = new Map<string, ProjectedPath[]>();
  for (const path of result.paths) { const list = runsByStrand.get(path.curve); if (list) list.push(path); else runsByStrand.set(path.curve, [path]); }
  let hiddenLength = 0, visibleLength = 0;
  strands.forEach((strand, i) => {
    const { x, y, depth, cumulative, mean } = staged[i], runs = runsByStrand.get(strand.id) ?? [], total = cumulative[cumulative.length - 1];
    const lengths = runs.map((run) => { let l = 0; for (let k = 1; k < run.points.length; k++) l += Math.hypot(run.points[k][0] - run.points[k - 1][0], run.points[k][1] - run.points[k - 1][1]); return l; });
    const sum = lengths.reduce((a, b) => a + b, 0), scale = sum > 0 ? total / sum : 1;
    const hidden: [number, number][] = [], visible: [number, number][] = [];
    let at = 0;
    runs.forEach((run, r) => {
      const to = r === runs.length - 1 ? total : at + lengths[r] * scale, list = run.visible ? visible : hidden, last = list[list.length - 1];
      if (last && Math.abs(last[1] - at) < 1e-9) last[1] = to; else list.push([at, to]);
      at = to;
    });
    for (const [a, b] of hidden) hiddenLength += b - a;
    for (const [a, b] of visible) visibleLength += b - a;
    const points = Array.from(x, (px, k) => Object.freeze([px, y[k]] as const));
    out.push(Object.freeze({
      path: Object.freeze({ id: strand.id, seed: strand.seed, points: Object.freeze(points), closed: strand.closed, level: strand.family, levelFraction: strand.family, tone: strand.family }),
      cumulative, length: total, depth, meanDepth: mean, hidden: Object.freeze(hidden), visible: Object.freeze(visible),
    }));
  });
  // The canvas crossing table: same crossings, canvas sides.
  const tangentAt = (p: number, segment: number): readonly [number, number] => {
    const { x, y, segments } = canvas[p], n = x.length;
    for (let step = 0; step < segments; step++) for (const k of step === 0 ? [segment] : [(segment + step) % segments, (segment - step + segments) % segments]) {
      const dx = x[(k + 1) % n] - x[k], dy = y[(k + 1) % n] - y[k], l = Math.hypot(dx, dy);
      if (l > 1e-9) return [dx / l, dy / l];
    }
    return [1, 0];
  };
  const table: Crossing[] = crossings.map((c) => {
    const at = view.project(c.position)!, sides = [c.first, c.second].map((part) => {
      const p = canvas[part.strand], k = part.segment, arc = staged[part.strand].cumulative[k] + Math.hypot(at.x - p.x[k], at.y - p.y[k]);
      return Object.freeze({ path: part.strand, pathId: strands[part.strand].id, s: arc, segment: k, t: part.t, tangent: Object.freeze(tangentAt(part.strand, k)) });
    });
    const sine = Math.max(1e-4, Math.min(1, Math.abs(sides[0].tangent[0] * sides[1].tangent[1] - sides[0].tangent[1] * sides[1].tangent[0])));
    return Object.freeze({ id: c.id, index: c.index, kind: "transversal" as const, point: Object.freeze([at.x, at.y] as const), first: sides[0], second: sides[1], sine, self: false });
  });
  const set: CrossingSet = Object.freeze({
    paths: Object.freeze(out.map((s) => s.path)), lengths: Object.freeze(out.map((s) => s.length)), crossings: Object.freeze(table),
    contacts: Object.freeze([]), nearMisses: Object.freeze([]), nearMiss: 0,
  });
  // The same decisions as the surface order, in a distinct object: the piece cutter caches per order object, and a camera's canvas geometry is not another camera's.
  const order: CrossingOrder = Object.freeze({ ...products.order });
  const visibleCrossing = new Uint8Array(crossings.length);
  table.forEach((c, i) => { visibleCrossing[i] = within(out[c.first.path].visible, c.first.s) && within(out[c.second.path].visible, c.second.s) ? 1 : 0; });
  const projected: ProjectedWeave = Object.freeze({
    camera: view, strands: Object.freeze(out), set, order, visibleCrossing, depthRange: Object.freeze([near, far] as const),
    stats: Object.freeze({ hiddenLength, visibleLength, work: result.stats.work }),
  });
  if (!byCamera) projections.set(products.order, byCamera = new Map());
  byCamera.set(view.key, projected);
  if (byCamera.size > 4) byCamera.delete(byCamera.keys().next().value!);
  return projected;
}
