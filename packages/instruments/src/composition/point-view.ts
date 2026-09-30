/**
 * The camera stage of the point-cloud pipeline (brief 54): projection with depth, hidden-point removal, neighbour links
 * and the visible-line outline. Everything here reads a camera; everything before it (subject, structure, cut, thinning,
 * dispersion, links) does not, so a camera edit never recomputes construction.
 *
 * `pointCamera(frame, view)` makes the F8 `Camera` that fits the frame's bounding sphere to `fit` of the half canvas, in
 * both projections (perspective: the sphere's silhouette, not its centre depth, is what fits). Depth is normalised
 * against that sphere, not against the surviving points, so thinning or cutting never changes a point's `depth01`:
 * `depth01 = (depth - (distance - R)) / 2R` clamped to [0, 1], 0 at the sphere's nearest surface, 1 at its farthest.
 *
 * `viewPoints` projects a cloud (`projectPoints`, F8) and removes hidden points by policy: `hideBack` drops points whose
 * normal faces away from the eye (`facing <= 0`), `occluder` (a mesh) drops points behind any of its triangles by the exact
 * hidden-point test of the visibility foundation (`visiblePoints`, `occluders: "all"`, so an open vessel or a cut solid
 * shows its interior). Points nearer than a perspective near plane are dropped. `order: "far-to-near"` is the painter order
 * (ties by index). The result is frozen and cached by cloud content, camera and policy (two views kept).
 *
 * `pointLinks` draws a sparse network over the cloud: a fixed share `nodes` of the points (by a hash rank of the source
 * index, so the node set is nested in the share and independent of everything else) are network nodes, and each node is
 * joined to its `neighbors` nearest OTHER NODES when the distance is at most `reach` times the median nearest-node distance
 * and the two normals face the same way (dot product > 0: no link bridges the front and back of a thin sheet or the gap
 * between two parts). A link is listed once (ids `link:<id a>|<id b>`, `a` the lower source index); the graph is the
 * nearest-neighbour graph of the nodes, so it is re-formed, not merely thinned, when the share changes. More than
 * `MAX_LINKS` links throws naming Link neighbors and Link nodes. `linkPaths` projects a link set: a link is visible when
 * both endpoints are, its depth is the mean of theirs.
 *
 * `outlinePaths` is the visible-line pass for a mesh subject: silhouette edges (and with `features` the crease edges over
 * `crease` degrees and open boundaries) chained into curves and classified against the mesh by `hiddenLines`, so a hidden
 * run is hidden because a triangle covers it, not because it is far. Work beyond `maxWork` throws naming the control.
 */
import { camera as makeCamera, type Camera } from "./camera.js";
import { componentSeed } from "./core.js";
import type { Mesh } from "./mesh.js";
import { cloudStorage, mixHash, pointId, projectPoints, type PointCloud, type ProjectedPoint } from "./mesh-sample.js";
import { meshFeatureEdges, meshTopology } from "./mesh-topology.js";
import { neighborTable } from "./point-structure.js";
import type { PointFrame } from "./point-select.js";
import { memoized } from "./sources.js";
import type { Path, Site } from "./types.js";
import { hiddenLines, meshEdgeCurves, visiblePoints, type ProjectedPath } from "./visibility.js";

export const MAX_LINKS = 100_000;
/** Work bound handed to the exact visibility solver (units of its own work measure; about 1.5 s at the default of 20 million). */
export const VIEW_WORK = 20_000_000;

export interface ViewSpec {
  readonly projection: "orthographic" | "perspective";
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
  /** Eye distance in bounding radii, above 1 (perspective strength). */
  readonly perspective: number;
  /** Radius of the bounding sphere as a fraction of the half canvas (320). */
  readonly fit: number;
  readonly centerX: number;
  readonly centerY: number;
}

export function pointCamera(frame: PointFrame, view: ViewSpec): Camera {
  const R = frame.radius;
  if (!(view.perspective > 1.05)) throw new Error(`Perspective distance must exceed 1.05 radii (got ${String(view.perspective)}); change Perspective`);
  if (!(view.fit > 0)) throw new Error(`Size must be positive (got ${String(view.fit)}); change Size`);
  const distance = (view.projection === "perspective" ? view.perspective : 4) * R;
  const half = view.fit * 320;
  const zoom = view.projection === "perspective" ? half * Math.sqrt(distance * distance - R * R) / (distance * R) : half / R;
  return makeCamera({ projection: view.projection, yaw: view.yaw, pitch: view.pitch, roll: view.roll, target: frame.center, zoom, distance, center: [view.centerX, view.centerY] });
}

/** Normalised depth of a camera-space depth against the frame's bounding sphere, in [0, 1]. */
export function depth01(view: Camera, frame: PointFrame, depth: number): number {
  const near = view.options.distance - frame.radius;
  return Math.min(1, Math.max(0, (depth - near) / (2 * frame.radius)));
}

export interface ViewedPoint extends Site {
  /** Index in the cloud that was viewed. */
  readonly index: number;
  readonly depth: number;
  readonly depth01: number;
  /** Cosine between the normal and the direction to the eye, or null without normals. */
  readonly facing: number | null;
  /** Canvas units per unit at this depth relative to the target depth (1 for orthographic). */
  readonly perspective: number;
}
export interface ViewOptions {
  readonly order: "far-to-near" | "index";
  readonly hideBack: boolean;
  readonly occluder: Mesh | null;
  readonly maxWork?: number;
}
export interface PointView {
  readonly points: readonly ViewedPoint[];
  readonly stats: { readonly cloud: number; readonly hiddenBack: number; readonly hiddenBehind: number };
}
const views = new Map<string, PointView>();

export function viewPoints(cloud: PointCloud, view: Camera, frame: PointFrame, options: ViewOptions): PointView {
  const keyed = JSON.stringify([cloud.key, view.key, frame.radius, options.order, options.hideBack, options.occluder?.key ?? null]);
  return memoized(views, keyed, () => {
    const all = projectPoints(cloud, view, { order: "index" });
    let sorted: readonly ProjectedPoint[] = all;
    let hiddenBack = 0, hiddenBehind = 0;
    if (options.hideBack) { const before = sorted.length; sorted = sorted.filter((p) => p.facing === null || p.facing > 0); hiddenBack = before - sorted.length; }
    if (options.occluder) {
      let mask: Uint8Array;
      try { mask = visiblePoints(options.occluder, cloud, view, { maxWork: options.maxWork ?? VIEW_WORK }); }
      catch (error) {
        if (error instanceof Error && /maxWork/.test(error.message)) throw new Error(`Hide behind surface: ${error.message}; reduce Points or turn Hide behind surface off`);
        throw error;
      }
      const before = sorted.length;
      sorted = sorted.filter((p) => mask[p.index] === 1);
      hiddenBehind = before - sorted.length;
    }
    const out = sorted.map((p): ViewedPoint => Object.freeze({ ...p, depth01: depth01(view, frame, p.depth), perspective: view.options.projection === "perspective" ? view.options.distance / p.depth : 1 }));
    if (options.order === "far-to-near") out.sort((a, b) => b.depth - a.depth || a.index - b.index);
    return Object.freeze({ points: Object.freeze(out), stats: Object.freeze({ cloud: cloud.count, hiddenBack, hiddenBehind }) });
  });
}

// ---------------------------------------------------------------------------------------------
// Links

export interface PointLink {
  readonly id: string;
  /** Indices of the two endpoints in the cloud, `a` below `b`. */
  readonly a: number;
  readonly b: number;
  readonly length: number;
}
export interface LinkSet {
  readonly links: readonly PointLink[];
  /** Number of network nodes (points chosen by the node share). */
  readonly nodes: number;
  /** Median distance from a node to its nearest neighbouring node, the unit of `reach`. */
  readonly unit: number;
}
export interface LinkOptions {
  /** Each node links to this many of its nearest nodes, 1..12. */
  readonly neighbors: number;
  /** Longest link in multiples of `unit`. */
  readonly reach: number;
  /** Share of the points that are nodes, 0..1. */
  readonly nodes: number;
}
const linkCache = new Map<string, LinkSet>();

export function pointLinks(cloud: PointCloud, options: LinkOptions): LinkSet {
  const { neighbors, reach, nodes } = options;
  if (!Number.isInteger(neighbors) || neighbors < 1 || neighbors > 12) throw new Error(`Link neighbors must be an integer in 1..12 (got ${String(neighbors)}); change Link neighbors`);
  if (!(reach > 0) || !Number.isFinite(reach)) throw new Error(`Link reach must be a positive number (got ${String(reach)}); change Link reach`);
  if (!(nodes >= 0 && nodes <= 1)) throw new Error(`Link nodes must be a number in 0..1 (got ${String(nodes)}); change Link nodes`);
  return memoized(linkCache, `${cloud.key}|${neighbors}|${reach}|${nodes}`, () => {
    const s = cloudStorage(cloud), chosen: number[] = [];
    for (let i = 0; i < cloud.count; i++) if (mixHash(cloud.seed, s.source ? s.source[i] : i, 0x4c4b) < nodes) chosen.push(i);
    const m = chosen.length;
    if (m < 2) return Object.freeze({ links: Object.freeze([]), nodes: m, unit: 0 });
    const positions = new Float64Array(m * 3);
    chosen.forEach((i, at) => { for (let c = 0; c < 3; c++) positions[at * 3 + c] = s.positions[i * 3 + c]; });
    const table = neighborTable(positions, m, neighbors), k = table.k, nearest: number[] = [];
    for (let at = 0; at < m; at++) nearest.push(table.distance[at * k]);
    nearest.sort((x, y) => x - y);
    const unit = nearest[m >> 1], limit = reach * unit, seen = new Set<number>(), links: PointLink[] = [];
    for (let at = 0; at < m; at++) for (let e = 0; e < k; e++) {
      const other = table.index[at * k + e], d = table.distance[at * k + e];
      if (d > limit) continue;
      const lo = Math.min(at, other), hi = Math.max(at, other), pair = lo * m + hi;
      if (seen.has(pair)) continue;
      seen.add(pair);
      const a = chosen[lo], b = chosen[hi];
      if (s.normals && s.normals[a * 3] * s.normals[b * 3] + s.normals[a * 3 + 1] * s.normals[b * 3 + 1] + s.normals[a * 3 + 2] * s.normals[b * 3 + 2] <= 0) continue;
      const sa = s.source ? s.source[a] : a, sb = s.source ? s.source[b] : b;
      links.push(Object.freeze({ id: `link:p:${Math.min(sa, sb)}|p:${Math.max(sa, sb)}`, a, b, length: d }));
      if (links.length > MAX_LINKS) throw new Error(`Links exceed ${MAX_LINKS}; lower Link neighbors or Link nodes, or Points`);
    }
    return Object.freeze({ links: Object.freeze(links), nodes: m, unit });
  });
}

export interface LinkPath extends Path {
  readonly a: number;
  readonly b: number;
  readonly depth: number;
  readonly depth01: number;
  /** Painter key: `depth` pulled toward the eye by the caller's lift (see `drawPointCloudScene`), so a link on a surface is not buried by its own neighbours. */
  readonly order?: number;
  /** Mean of the endpoints' perspective scale. */
  readonly perspective: number;
}
/** Project links between viewed points; a link with a missing (hidden or clipped) endpoint is omitted. */
export function linkPaths(cloud: PointCloud, set: LinkSet, viewed: readonly ViewedPoint[]): readonly LinkPath[] {
  const at = new Map<number, ViewedPoint>();
  for (const p of viewed) at.set(p.index, p);
  const out: LinkPath[] = [];
  for (const link of set.links) {
    const a = at.get(link.a), b = at.get(link.b);
    if (!a || !b) continue;
    out.push(Object.freeze({
      id: link.id, seed: componentSeed(cloud.seed, link.id, "link"), points: Object.freeze([a.position, b.position]), closed: false, level: 0, levelFraction: 0,
      a: link.a, b: link.b, depth: (a.depth + b.depth) / 2, depth01: (a.depth01 + b.depth01) / 2, perspective: (a.perspective + b.perspective) / 2,
    }));
  }
  return Object.freeze(out);
}

// ---------------------------------------------------------------------------------------------
// Outline

export interface OutlineSpec { readonly mode: "silhouette" | "features"; readonly crease: number }
export interface Outline { readonly visible: readonly ProjectedPath[]; readonly hidden: readonly ProjectedPath[] }
const outlines = new Map<string, Outline>();

export function outlinePaths(mesh: Mesh, view: Camera, spec: OutlineSpec, maxWork: number = VIEW_WORK): Outline {
  return memoized(outlines, JSON.stringify([mesh.key, view.key, spec.mode, spec.crease]), () => {
    const topology = meshTopology(mesh);
    const edges = meshFeatureEdges(mesh, topology, view, { crease: spec.mode === "features" ? spec.crease : null, silhouette: true, boundary: spec.mode === "features" });
    const curves = meshEdgeCurves(mesh, topology, edges);
    let result;
    try { result = hiddenLines(mesh, curves, view, { maxWork }); }
    catch (error) {
      if (error instanceof Error && /maxWork|segments/.test(error.message)) throw new Error(`Outline: ${error.message}; turn Outline off or lower Points`);
      throw error;
    }
    return Object.freeze({ visible: Object.freeze(result.paths.filter((p) => p.visible)), hidden: Object.freeze(result.paths.filter((p) => !p.visible)) });
  });
}

/** Source index of a viewed point (the `p:<n>` of its id). */
export const sourceOf = (cloud: PointCloud, index: number): number => Number(pointId(cloud, index).slice(2));
