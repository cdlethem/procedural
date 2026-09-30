import type { Camera } from "./camera.js";
import { componentSeed } from "./core.js";
import { strandPieces, type StrandPiece, type Strands } from "./lace-strands.js";
import { meshFeatureEdges, meshTopology } from "./mesh-topology.js";
import { traceGraph } from "./mesh-trace.js";
import { meshMeasures, meshStorage, type Mesh, type Vec3 } from "./mesh.js";
import { cutPath } from "./strands.js";
import type { SurfaceWeaveProducts } from "./surface-weave-products.js";
import type { Interval, ProjectedStrand, ProjectedWeave } from "./surface-weave-view.js";
import type { Path } from "./types.js";
import { hiddenLines, meshEdgeCurves, paintOrder, type ProjectedPath } from "./visibility.js";

/**
 * Surface Weave: thread pieces and the model's own drawing geometry (see `surface-weave-view.ts` for the stages).
 *
 * PIECES (`weavePieces`). `strandPieces` (Crossing Lace's cutter) opens the UNDER strand at every woven crossing on the canvas
 * geometry, then each piece is cut again at the hidden intervals of its strand into `visible` fragments (and, for the faint
 * policy, `hidden` ones). Ids are `<strand>#<u>` (`u` = under-crossings before the piece) with `:<k>` (`:<k>h` for hidden
 * fragments) when clipping cut it; a strand that is wholly visible keeps its piece ids. A thread's width is a share of the
 * strand's own mean spacing: canvas width `share * spacing * scaleAt(mean depth)`, so nearer threads are wider in perspective
 * and threads thin where the weave is dense. Hairlines use the fixed `HAIRLINE_WIDTH` instead. A fragment reports
 * `facing` and `depth` at its middle for shading.
 *
 * RIBBONS. For the flat cross-section each fragment carries `lateral`: per point the canvas offset of the ribbon's edge, the
 * projection of the surface-tangent vector across the strand (`normal x direction`) of half the world width, so the ribbon
 * foreshortens and vanishes edge-on exactly as a strip lying in the surface would.
 *
 * MODEL (`weaveModel`). The mesh's visible silhouette and boundary edges (hidden-line removed by the mesh itself) and, for
 * the veil, its triangles in painter order (`paintOrder`; back faces are culled only for a closed outward solid) with the
 * projected vertices and per-triangle facing.
 *
 * WORK. Pieces are linear in vertices and crossings; the model charges `hiddenLines` and `paintOrder` their own bounded
 * work (20,000,000 units by default). Cached: `weavePieces` per projection and option set (4), `weaveModel` per mesh and camera (4).
 */
export const HAIRLINE_WIDTH = 1.4;
export interface WeavePieceOptions {
  /** Thread width as a share of the strand's local spacing. */
  share: number;
  hairline: boolean;
  clearance: number;
  minAngle: number;
  /** Compute ribbon edges (`lateral`). */
  flat: boolean;
  /** Also return the hidden fragments. */
  faint: boolean;
}
export interface WeavePiece extends Path {
  /** Index of the strand (in `products.strands`). */
  readonly source: number;
  readonly family: 0 | 1;
  /** The cut piece (`<strand>#<u>`) this fragment came from. */
  readonly piece: string;
  /** Arc length along the strand at which the fragment begins (canvas units). */
  readonly start: number;
  readonly visible: boolean;
  /** |cos| between the surface normal and the direction to the eye at the fragment's middle: 1 face on, 0 edge on. */
  readonly facing: number;
  /** Camera depth at the fragment's middle. */
  readonly depth: number;
  /** Canvas width of the thread (round cross-section). */
  readonly width: number;
  /** Ribbon edge offsets, `x, y` per point, when `flat`; null otherwise. */
  readonly lateral: Float64Array | null;
}
export interface WeavePieces {
  readonly visible: readonly WeavePiece[];
  readonly hidden: readonly WeavePiece[];
  readonly strands: Strands;
  /** Canvas thread width per strand. */
  readonly widths: readonly number[];
}

const pieceCache = new WeakMap<ProjectedWeave, Map<string, WeavePieces>>();

function locate(strand: ProjectedStrand, arc: number): { k: number; f: number } {
  const cum = strand.cumulative, m = cum.length - 1;
  let s = arc;
  if (strand.path.closed) s = ((s % strand.length) + strand.length) % strand.length;
  s = Math.min(Math.max(s, 0), strand.length);
  let lo = 0, hi = m;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
  const span = cum[lo + 1] - cum[lo];
  return { k: lo, f: span > 0 ? (s - cum[lo]) / span : 0 };
}

/** Edge offsets of a ribbon of world half-width `half` along a strand, canvas units, 2 per vertex. */
function ribbonOffsets(products: SurfaceWeaveProducts, projected: ProjectedWeave, index: number, half: number): Float64Array {
  const strand = products.strands[index], n = strand.points.length, segments = strand.closed ? n : n - 1, normals = traceGraph(products.mesh).normals, view = projected.camera;
  const lateral = new Float64Array(segments * 3);
  for (let j = 0; j < segments; j++) {
    const a = strand.points[j], b = strand.points[(j + 1) % n], t = strand.triangles[j];
    let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    const nx = normals[t * 3], ny = normals[t * 3 + 1], nz = normals[t * 3 + 2];
    lateral[j * 3] = ny * dz - nz * dy; lateral[j * 3 + 1] = nz * dx - nx * dz; lateral[j * 3 + 2] = nx * dy - ny * dx;
  }
  const out = new Float64Array(n * 2);
  for (let k = 0; k < n; k++) {
    const before = strand.closed ? (k + segments - 1) % segments : Math.max(0, k - 1), after = Math.min(k, segments - 1);
    let x = lateral[before * 3] + lateral[after * 3], y = lateral[before * 3 + 1] + lateral[after * 3 + 1], z = lateral[before * 3 + 2] + lateral[after * 3 + 2];
    const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
    const p = strand.points[k], base = view.project(p)!, edge = view.project([p[0] + x * half, p[1] + y * half, p[2] + z * half])!;
    out[k * 2] = edge.x - base.x; out[k * 2 + 1] = edge.y - base.y;
  }
  return out;
}

/** The cut and clipped thread fragments for these widths (see the module header). */
export function weavePieces(products: SurfaceWeaveProducts, projected: ProjectedWeave, options: WeavePieceOptions): WeavePieces {
  const key = JSON.stringify([options.share, options.hairline, options.clearance, options.minAngle, options.flat, options.faint]);
  let byKey = pieceCache.get(projected);
  const hit = byKey?.get(key);
  if (hit) return hit;
  const { camera: view } = projected, normals = traceGraph(products.mesh).normals;
  const widths = products.strands.map((strand, i) => options.hairline ? HAIRLINE_WIDTH : options.share * strand.spacing * view.scaleAt(projected.strands[i].meanDepth));
  // A ribbon has square ends, not the round cap a stroked thread has, so an under ribbon needs no extra reach past the over thread's edge.
  const strands = strandPieces(projected.set, projected.order, { widths, reach: options.flat ? widths.map(() => 0) : widths, clearance: options.clearance, minAngle: options.minAngle });
  const ribbons = new Map<number, Float64Array>();
  const visible: WeavePiece[] = [], hidden: WeavePiece[] = [];

  const emit = (piece: StrandPiece, remove: readonly Interval[], into: WeavePiece[], isVisible: boolean): void => {
    const strand = projected.strands[piece.source], total = strand.length, shifts = strand.path.closed ? [-total, 0, total] : [0];
    const gaps: [number, number][] = [];
    let length = 0;
    for (let k = 1; k < piece.points.length; k++) length += Math.hypot(piece.points[k][0] - piece.points[k - 1][0], piece.points[k][1] - piece.points[k - 1][1]);
    if (piece.closed) length += Math.hypot(piece.points[0][0] - piece.points[piece.points.length - 1][0], piece.points[0][1] - piece.points[piece.points.length - 1][1]);
    for (const [a, b] of remove) for (const shift of shifts) {
      const low = a + shift - piece.start, high = b + shift - piece.start;
      if (high > 0 && low < length) gaps.push([low, high]);
    }
    const cut = gaps.length === 0 ? { pieces: [{ points: piece.points.map((p) => [p[0], p[1]] as [number, number]), start: 0 }] } : cutPath(piece.points, piece.closed, gaps);
    cut.pieces.forEach((fragment, n) => {
      const whole = gaps.length === 0 && cut.pieces.length === 1;
      const id = whole ? piece.id : `${piece.id}:${n}${isVisible ? "" : "h"}`, arc0 = piece.start + fragment.start;
      let run = 0;
      const arcs: number[] = [arc0];
      for (let k = 1; k < fragment.points.length; k++) { run += Math.hypot(fragment.points[k][0] - fragment.points[k - 1][0], fragment.points[k][1] - fragment.points[k - 1][1]); arcs.push(arc0 + run); }
      if (run < 1e-6) return; // a remnant of no length would draw as a dot at a strand end
      const mid = locate(strand, arc0 + run / 2), source = products.strands[piece.source], count = source.points.length;
      const a = source.points[mid.k], b = source.points[(mid.k + 1) % count];
      const position: Vec3 = [a[0] + (b[0] - a[0]) * mid.f, a[1] + (b[1] - a[1]) * mid.f, a[2] + (b[2] - a[2]) * mid.f];
      const tri = source.triangles[mid.k], eye = view.viewDirection(position);
      const facing = Math.abs(normals[tri * 3] * eye[0] + normals[tri * 3 + 1] * eye[1] + normals[tri * 3 + 2] * eye[2]);
      const depth = strand.depth[mid.k] + (strand.depth[(mid.k + 1) % strand.depth.length] - strand.depth[mid.k]) * mid.f;
      let lateral: Float64Array | null = null;
      if (options.flat) {
        let offsets = ribbons.get(piece.source);
        if (!offsets) ribbons.set(piece.source, offsets = ribbonOffsets(products, projected, piece.source, options.share * source.spacing / 2));
        const table = offsets, out = new Float64Array(arcs.length * 2);
        arcs.forEach((arc, k) => {
          const at = locate(strand, arc), next = (at.k + 1) % count;
          out[k * 2] = table[at.k * 2] + (table[next * 2] - table[at.k * 2]) * at.f;
          out[k * 2 + 1] = table[at.k * 2 + 1] + (table[next * 2 + 1] - table[at.k * 2 + 1]) * at.f;
        });
        lateral = out;
      }
      into.push(Object.freeze({
        id, seed: componentSeed(piece.seed, id, "fragment"), points: Object.freeze(fragment.points.map((p) => Object.freeze([p[0], p[1]] as const))), closed: whole && piece.closed,
        level: piece.level, levelFraction: piece.levelFraction, tone: piece.tone, source: piece.source, family: source.family, piece: piece.id, start: arc0, visible: isVisible,
        facing, depth, width: widths[piece.source], lateral,
      }));
    });
  };
  for (const piece of strands.pieces) {
    const strand = projected.strands[piece.source];
    emit(piece, strand.hidden, visible, true);
    if (options.faint) emit(piece, strand.visible, hidden, false);
  }
  const result: WeavePieces = Object.freeze({ visible: Object.freeze(visible), hidden: Object.freeze(hidden), strands, widths: Object.freeze(widths) });
  if (!byKey) pieceCache.set(projected, byKey = new Map());
  byKey.set(key, result);
  if (byKey.size > 4) byKey.delete(byKey.keys().next().value!);
  return result;
}

export interface WeaveModel {
  /** Visible silhouette and boundary edges as canvas paths. */
  readonly outline: readonly ProjectedPath[];
  readonly veil: {
    /** Triangle indices far to near. */
    readonly order: readonly number[];
    /** Canvas position of every vertex (NaN when nearer than the near plane). */
    readonly x: Float64Array;
    readonly y: Float64Array;
    /** |cos| of the angle between the triangle's normal and the direction to the eye, per triangle. */
    readonly facing: Float64Array;
  } | null;
}
const models = new Map<string, WeaveModel>();

/** The mesh's own visible edges (silhouette and boundary) and, when asked, its painter order. Cached by mesh content and camera. */
export function weaveModel(mesh: Mesh, view: Camera, veil: boolean): WeaveModel {
  const key = `${mesh.key}|${view.key}|${veil}`, hit = models.get(key);
  if (hit) return hit;
  const topology = meshTopology(mesh), closedSolid = topology.kind === "closed-manifold" && meshMeasures(mesh).signedVolume > 0;
  const edges = meshFeatureEdges(mesh, topology, view, { crease: null, silhouette: true, boundary: true });
  const curves = edges.length === 0 ? [] : meshEdgeCurves(mesh, topology, edges);
  const outline = curves.length === 0 ? [] : hiddenLines(mesh, curves, view, { occluders: closedSolid ? "front" : "all" }).paths.filter((path) => path.visible);
  let shaded: WeaveModel["veil"] = null;
  if (veil) {
    const s = meshStorage(mesh), x = new Float64Array(mesh.vertexCount), y = new Float64Array(mesh.vertexCount);
    for (let v = 0; v < mesh.vertexCount; v++) {
      const p = view.project([s.positions[v * 3], s.positions[v * 3 + 1], s.positions[v * 3 + 2]]);
      x[v] = p ? p.x : NaN; y[v] = p ? p.y : NaN;
    }
    const normals = traceGraph(mesh).normals, facing = new Float64Array(mesh.triangleCount);
    for (let t = 0; t < mesh.triangleCount; t++) {
      const a = s.triangles[t * 3], b = s.triangles[t * 3 + 1], c = s.triangles[t * 3 + 2];
      const eye = view.viewDirection([(s.positions[a * 3] + s.positions[b * 3] + s.positions[c * 3]) / 3, (s.positions[a * 3 + 1] + s.positions[b * 3 + 1] + s.positions[c * 3 + 1]) / 3, (s.positions[a * 3 + 2] + s.positions[b * 3 + 2] + s.positions[c * 3 + 2]) / 3]);
      facing[t] = Math.abs(normals[t * 3] * eye[0] + normals[t * 3 + 1] * eye[1] + normals[t * 3 + 2] * eye[2]);
    }
    shaded = Object.freeze({ order: paintOrder(mesh, view, { cull: closedSolid ? "back" : "none" }).order, x, y, facing });
  }
  const model: WeaveModel = Object.freeze({ outline: Object.freeze(outline), veil: shaded });
  models.set(key, model);
  if (models.size > 4) models.delete(models.keys().next().value!);
  return model;
}
