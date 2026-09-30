/**
 * The camera-dependent stage of Visibility Drawing (brief 53): the camera, exact visibility of curve classes, tone
 * hatching of visible faces, the painter's fill and the depth cue. Everything here reads a mesh (never modifies it)
 * and returns frozen values cached by the mesh object plus the camera and the rule that produced them.
 *
 * CAMERA. `viewCamera` aims at the centre of the mesh's bounds; `size` is the canvas diameter of the smallest sphere about that
 * centre holding every vertex, at the target depth (so `zoom = size / (2 radius)` in both projections), and `distance` the eye
 * distance in those diameters (perspective strength; an orthographic camera only uses it to place depth, at two diameters).
 * Camera and material are separate stages: nothing here reads a palette, a weight or a material.
 *
 * VISIBILITY. `curvePaths` is `hiddenLines` on one class of curves: exact per-triangle intervals, no depth buffer, no
 * sampling; both the visible and the hidden runs are returned (the class decides how to draw hidden ones).
 * Tolerance is `visibilityTolerance`. Occluders are the camera-facing triangles when the mesh is a closed consistently oriented manifold (identical answer
 * at half the work) and all triangles otherwise, so an open vessel's far wall and interior are handled.
 *
 * HATCH. Parallel screen lines on a fixed lattice (anchored at the canvas origin, so neighbouring faces continue each
 * other's lines) are clipped to the projected triangle, unprojected onto the triangle's plane and handed to the same exact
 * solver as 3D segments, so a hatch line is hidden exactly where a nearer surface covers it, and the visible pieces
 * of one lattice line are re-joined across triangles. Tone: `darkness = 1 - (ambient + (1 - ambient) * max(0, n . L))`
 * with `L` from azimuth (0 = +z, positive toward +x) and elevation, `n` the triangle's flat normal or the mean of its
 * vertices' angle-weighted normals ("smooth"), flipped toward the viewer for back faces of an open mesh (two-sided
 * light). Family `j` of `F` (angle `angle + 180 j / F`) is drawn on a triangle when `darkness > threshold + (1 - threshold) j / F`,
 * so darker faces carry more crossing families and lighter faces fewer. There are no cast shadows.
 *
 * PAINTER. `paintedFaces` is `paintOrder` (far to near, exact where `exact`) projected to canvas polygons, clipped to a
 * perspective near plane. The fill is opaque; a transparent layer means the mesh's silhouette only, never a full-canvas fill.
 *
 * DEPTH CUE. `depthRange` is the depth interval of the mesh's vertices; `cueBin` quantizes a depth to one of
 * `CUE_STEPS` bins and `splitByDepth` cuts a projected path exactly where its depth crosses a bin boundary (perspective-
 * correct: 1/depth is affine in the screen parameter), so weight or opacity can follow depth along one line.
 *
 * Work is bounded and named: at most `MAX_HATCH_SEGMENTS` hatch segments; the solver's `maxWork` errors are re-thrown
 * naming the controls that reduce them.
 */
import { camera, type Camera } from "./camera.js";
import { cachedBy, componentSeed } from "./core.js";
import { meshTopology } from "./mesh-topology.js";
import { internalVertexNormals, meshDerived, meshStorage, type Mesh } from "./mesh.js";
import { hiddenLines, paintOrder, type ProjectedPath, type SpatialCurve, type VisibilityStats } from "./visibility.js";
import { constructionCounts } from "./visibility-features.js";

export interface ViewRule {
  readonly projection: "orthographic" | "perspective";
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
  /** Eye distance in bounding-sphere diameters (perspective). */
  readonly distance: number;
  readonly centerX: number;
  readonly centerY: number;
  /** Canvas diameter of the bounding sphere about the bounds' centre at the target depth. */
  readonly size: number;
}

export const MAX_HATCH_SEGMENTS = 150_000;
export const CUE_STEPS = 6;

const radiusCache = new WeakMap<Mesh, number>();
/** Radius of the smallest sphere about the centre of the mesh's bounds that holds every vertex. */
export function boundingRadius(mesh: Mesh): number {
  const hit = radiusCache.get(mesh);
  if (hit !== undefined) return hit;
  const { min, max } = mesh.bounds, p = meshStorage(mesh).positions, cx = (min[0] + max[0]) / 2, cy = (min[1] + max[1]) / 2, cz = (min[2] + max[2]) / 2;
  let r2 = 0;
  for (let v = 0; v < mesh.vertexCount; v++) r2 = Math.max(r2, (p[v * 3] - cx) ** 2 + (p[v * 3 + 1] - cy) ** 2 + (p[v * 3 + 2] - cz) ** 2);
  const radius = Math.sqrt(r2);
  radiusCache.set(mesh, radius);
  return radius;
}

export function viewCamera(mesh: Mesh, view: ViewRule): Camera {
  const { min, max } = mesh.bounds, diameter = 2 * boundingRadius(mesh);
  if (!(view.size > 0)) throw new Error(`Size must be positive (got ${String(view.size)})`);
  if (!(view.distance > 0)) throw new Error(`Eye distance must be positive (got ${String(view.distance)})`);
  return camera({
    projection: view.projection, yaw: view.yaw, pitch: view.pitch, roll: view.roll,
    target: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    zoom: view.size / diameter, distance: (view.projection === "perspective" ? view.distance : 2) * diameter, center: [view.centerX, view.centerY],
  });
}

/**
 * The solver's tolerance for drawings: one millionth of the bounds diagonal, a thousand times the foundation's default. Runs of
 * hidden line shorter than this and depth differences below it are numerical noise at silhouette vertices (measured slivers of
 * 1e-5 canvas units splitting an outline), far below anything a drawing can show.
 */
export function visibilityTolerance(mesh: Mesh): number {
  const { min, max } = mesh.bounds;
  return 1e-6 * Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
}

/** Whether the mesh's back faces can never be seen (closed, consistently oriented): then only front faces occlude. */
export const closedSolid = (mesh: Mesh): boolean => meshTopology(mesh).kind === "closed-manifold";

// ---------------------------------------------------------------------------------------------
// Visible and hidden runs of a class of curves

export interface CurvePaths {
  readonly visible: readonly ProjectedPath[];
  readonly hidden: readonly ProjectedPath[];
  readonly stats: VisibilityStats;
}
/** Canvas distance below which consecutive points of a run are one point (a hundredth of a canvas unit: invisible). */
const REPEAT = 0.01;
/** The run without consecutive points closer than `REPEAT` (the solver leaves such pairs where a hidden sliver was absorbed); null if nothing remains. */
function withoutRepeats(path: ProjectedPath): ProjectedPath | null {
  const points: (readonly [number, number])[] = [path.points[0]], depths: number[] = [path.depths[0]];
  for (let i = 1; i < path.points.length; i++) {
    const last = points[points.length - 1], q = path.points[i];
    if (Math.hypot(q[0] - last[0], q[1] - last[1]) >= REPEAT) { points.push(q); depths.push(path.depths[i]); }
    else if (i === path.points.length - 1 && points.length > 1) { points[points.length - 1] = q; depths[depths.length - 1] = path.depths[i]; }
  }
  if (points.length === path.points.length) return path;
  if (points.length < 2) return null;
  return Object.freeze({ ...path, points: Object.freeze(points), depths: Object.freeze(depths) });
}
const pathsCache = new WeakMap<readonly SpatialCurve[], Map<string, CurvePaths>>();

/** `hiddenLines` on `curves`, split into visible and hidden runs and cached by the curve array and the view. */
export function curvePaths(mesh: Mesh, curves: readonly SpatialCurve[], view: Camera, label: string, controls: string): CurvePaths {
  return cachedBy(pathsCache, curves, `${mesh.key}|${view.key}`, () => {
    constructionCounts.hidden++;
    let result;
    try { result = hiddenLines(mesh, curves, view, { occluders: closedSolid(mesh) ? "front" : "all", seed: componentSeed(0, label, "class"), tolerance: visibilityTolerance(mesh) }); }
    catch (error) { throw new Error(`${label}: ${(error as Error).message}. Reduce ${controls}`); }
    const clean = result.paths.map(withoutRepeats).filter((p): p is ProjectedPath => p !== null);
    return Object.freeze({ visible: Object.freeze(clean.filter((p) => p.visible)), hidden: Object.freeze(clean.filter((p) => !p.visible)), stats: result.stats });
  });
}

// ---------------------------------------------------------------------------------------------
// Light and tone

export interface LightRule { readonly azimuth: number; readonly elevation: number; readonly ambient: number; readonly smooth: boolean }
export const lightDirection = (light: LightRule): readonly [number, number, number] => {
  const a = light.azimuth * Math.PI / 180, e = light.elevation * Math.PI / 180;
  return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
};

const litCache = new WeakMap<Mesh, Map<string, Float64Array>>();
/** `n . L` of every triangle (view independent): flat normal, or the normalised mean of the vertices' normals when `smooth`. */
export function triangleLit(mesh: Mesh, light: LightRule): Float64Array {
  return cachedBy(litCache, mesh, `${light.azimuth}|${light.elevation}|${light.smooth}`, () => {
    const s = meshStorage(mesh), d = meshDerived(mesh), L = lightDirection(light), T = mesh.triangleCount, out = new Float64Array(T);
    const vn = light.smooth ? internalVertexNormals(mesh) : null;
    for (let t = 0; t < T; t++) {
      let nx = d.triangleNormals[t * 3], ny = d.triangleNormals[t * 3 + 1], nz = d.triangleNormals[t * 3 + 2];
      if (vn) {
        nx = ny = nz = 0;
        for (let k = 0; k < 3; k++) { const v = s.triangles[t * 3 + k]; nx += vn[v * 3]; ny += vn[v * 3 + 1]; nz += vn[v * 3 + 2]; }
        const length = Math.hypot(nx, ny, nz);
        if (length > 1e-12) { nx /= length; ny /= length; nz /= length; } else { nx = d.triangleNormals[t * 3]; ny = d.triangleNormals[t * 3 + 1]; nz = d.triangleNormals[t * 3 + 2]; }
      }
      out[t] = nx * L[0] + ny * L[1] + nz * L[2];
    }
    return out;
  });
}

/** 0 fully lit .. 1 in shadow, from a signed `n . L` already flipped toward the viewer. */
export const darkness = (lit: number, ambient: number): number => 1 - (ambient + (1 - ambient) * Math.max(0, lit));

/** Camera-facing test of every triangle at its centroid: 1 front, 0 back or edge-on (strict, like the foundation's silhouettes). */
export function triangleFacing(mesh: Mesh, view: Camera): Uint8Array {
  const s = meshStorage(mesh), p = s.positions, d = meshDerived(mesh), T = mesh.triangleCount, out = new Uint8Array(T);
  const perspective = view.options.projection === "perspective";
  for (let t = 0; t < T; t++) {
    const a = s.triangles[t * 3], b = s.triangles[t * 3 + 1], c = s.triangles[t * 3 + 2];
    const nx = d.triangleNormals[t * 3], ny = d.triangleNormals[t * 3 + 1], nz = d.triangleNormals[t * 3 + 2];
    let dot: number;
    if (perspective) {
      const cx = (p[a * 3] + p[b * 3] + p[c * 3]) / 3, cy = (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1]) / 3, cz = (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2]) / 3;
      dot = nx * (view.eye[0] - cx) + ny * (view.eye[1] - cy) + nz * (view.eye[2] - cz);
    } else dot = -(nx * view.forward[0] + ny * view.forward[1] + nz * view.forward[2]);
    out[t] = dot > 0 ? 1 : 0;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Projection of one triangle (near-plane clipped)

/** The triangle in camera space clipped to the perspective near plane, as canvas x, y pairs; empty when nothing remains. */
function projectTriangle(mesh: Mesh, view: Camera, t: number, scratch: Float64Array): number[] {
  const s = meshStorage(mesh), p = s.positions, o = view.options, perspective = o.projection === "perspective";
  const q: number[][] = [];
  for (let k = 0; k < 3; k++) {
    const v = s.triangles[t * 3 + k];
    view.toView(p[v * 3], p[v * 3 + 1], p[v * 3 + 2], scratch, 0);
    q.push([scratch[0], scratch[1], scratch[2]]);
  }
  let poly = q;
  if (perspective) {
    const next: number[][] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], ina = a[2] >= o.near, inb = b[2] >= o.near;
      if (ina) next.push(a);
      if (ina !== inb) { const u = (o.near - a[2]) / (b[2] - a[2]); next.push([a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1]), o.near]); }
    }
    poly = next;
    if (poly.length < 3) return [];
  }
  const out: number[] = [];
  for (const [x, y, z] of poly) { const scale = perspective ? o.zoom * o.distance / z : o.zoom; out.push(o.center[0] + scale * x, o.center[1] - scale * y); }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Tone hatching of visible faces

export interface HatchRule {
  /** Distance between lines on the canvas. */
  readonly spacing: number;
  /** Degrees of the first family, clockwise on the canvas from horizontal. */
  readonly angle: number;
  /** Crossing families, 1 to 3. */
  readonly families: number;
  /** Darkness below which a face is left bare, in [0, 1). */
  readonly threshold: number;
  readonly light: LightRule;
}
export interface HatchResult {
  /** Visible strokes only; a stroke is one lattice line's run across as many triangles as it stays visible. */
  readonly paths: readonly ProjectedPath[];
  readonly segments: number;
  /** Triangles carrying at least one family. */
  readonly hatched: number;
  readonly stats: VisibilityStats;
}
const hatchCache = new WeakMap<Mesh, Map<string, HatchResult>>();

export function tonedHatch(mesh: Mesh, view: Camera, rule: HatchRule): HatchResult {
  const { spacing, angle, families, threshold } = rule;
  if (!(spacing >= 0.5)) throw new Error(`Hatch spacing must be at least 0.5 canvas units (got ${String(spacing)})`);
  if (!Number.isInteger(families) || families < 1 || families > 3) throw new Error(`Hatch families must be 1, 2 or 3 (got ${String(families)})`);
  if (!(threshold >= 0 && threshold < 1)) throw new Error(`Bare highlights must be at least 0 and below 1 (got ${String(threshold)})`);
  const key = `${view.key}|${spacing}|${angle}|${families}|${threshold}|${rule.light.azimuth}|${rule.light.elevation}|${rule.light.ambient}|${rule.light.smooth}`;
  return cachedBy(hatchCache, mesh, key, () => {
    constructionCounts.hatch++;
    const s = meshStorage(mesh), p = s.positions, d = meshDerived(mesh), o = view.options, perspective = o.projection === "perspective";
    const facing = triangleFacing(mesh, view), lit = triangleLit(mesh, rule.light), solid = closedSolid(mesh);
    const scratch = new Float64Array(3), curves: SpatialCurve[] = [];
    const directions = Array.from({ length: families }, (_, j) => { const a = (angle + 180 * j / families) * Math.PI / 180; return [Math.cos(a), Math.sin(a)] as const; });
    const focal = o.zoom * o.distance;
    let hatched = 0;
    for (let t = 0; t < mesh.triangleCount; t++) {
      const front = facing[t] === 1;
      if (solid && !front) continue;
      const dark = darkness(front ? lit[t] : -lit[t], rule.light.ambient);
      let active = 0;
      for (let j = 0; j < families; j++) if (dark > threshold + (1 - threshold) * j / families) active = j + 1;
      if (active === 0) continue;
      const poly = projectTriangle(mesh, view, t, scratch);
      if (poly.length < 6) continue;
      const nx = d.triangleNormals[t * 3], ny = d.triangleNormals[t * 3 + 1], nz = d.triangleNormals[t * 3 + 2];
      const denomOrtho = nx * view.forward[0] + ny * view.forward[1] + nz * view.forward[2];
      if (!perspective && Math.abs(denomOrtho) < 1e-9) continue;
      const a0 = s.triangles[t * 3];
      const planeD = nx * (p[a0 * 3] - view.eye[0]) + ny * (p[a0 * 3 + 1] - view.eye[1]) + nz * (p[a0 * 3 + 2] - view.eye[2]);
      const nRight = nx * view.right[0] + ny * view.right[1] + nz * view.right[2], nUp = nx * view.up[0] + ny * view.up[1] + nz * view.up[2];
      const unproject = (X: number, Y: number): readonly [number, number, number] | null => {
        let zc: number, xc: number, yc: number;
        if (perspective) {
          const rx = (X - o.center[0]) / focal, ry = -(Y - o.center[1]) / focal, denom = rx * nRight + ry * nUp + denomOrtho;
          if (Math.abs(denom) < 1e-12) return null;
          zc = planeD / denom; xc = rx * zc; yc = ry * zc;
        } else {
          xc = (X - o.center[0]) / o.zoom; yc = -(Y - o.center[1]) / o.zoom;
          zc = (planeD - xc * nRight - yc * nUp) / denomOrtho;
        }
        return view.fromView(xc, yc, zc);
      };
      hatched++;
      const n = poly.length / 2;
      for (let j = 0; j < active; j++) {
        const [ux, uy] = directions[j], mx = -uy, my = ux;
        let lo = Infinity, hi = -Infinity;
        const offsets = new Array<number>(n);
        for (let i = 0; i < n; i++) { const v = mx * poly[i * 2] + my * poly[i * 2 + 1]; offsets[i] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
        for (let k = Math.ceil(lo / spacing - 0.5); k <= Math.floor(hi / spacing - 0.5); k++) {
          const c = (k + 0.5) * spacing;
          const hits: number[] = [];
          for (let i = 0; i < n; i++) {
            const i2 = (i + 1) % n;
            if ((offsets[i] <= c) === (offsets[i2] <= c)) continue;
            const u = (c - offsets[i]) / (offsets[i2] - offsets[i]);
            hits.push(poly[i * 2] + u * (poly[i2 * 2] - poly[i * 2]), poly[i * 2 + 1] + u * (poly[i2 * 2 + 1] - poly[i * 2 + 1]));
          }
          if (hits.length < 4) continue;
          let x0 = hits[0], y0 = hits[1], x1 = hits[2], y1 = hits[3];
          if (ux * (x1 - x0) + uy * (y1 - y0) < 0) { [x0, x1] = [x1, x0]; [y0, y1] = [y1, y0]; }
          if (Math.hypot(x1 - x0, y1 - y0) < 1e-6) continue;
          const A = unproject(x0, y0), B = unproject(x1, y1);
          if (!A || !B) continue;
          if (curves.length >= MAX_HATCH_SEGMENTS)
            throw new Error(`Hatch needs more than ${MAX_HATCH_SEGMENTS} segments. Raise Hatch spacing, lower Hatch families or Detail, or raise Bare highlights`);
          curves.push({ id: `${j}:${k}:${t}`, points: [A, B], tone: j });
        }
      }
    }
    if (curves.length === 0) return Object.freeze({ paths: Object.freeze([]), segments: 0, hatched, stats: Object.freeze({ segments: 0, occluders: 0, tests: 0, nodes: 0, work: 0, clippedSegments: 0, edgeOnRuns: 0, tolerance: 0 }) });
    let solved;
    try { solved = hiddenLines(mesh, curves, view, { occluders: solid ? "front" : "all", tolerance: visibilityTolerance(mesh) }); }
    catch (error) { throw new Error(`Hatch: ${(error as Error).message}. Raise Hatch spacing or lower Hatch families or Detail`); }
    // Re-join the visible pieces of each lattice line across triangles.
    const groups = new Map<string, ProjectedPath[]>();
    for (const piece of solved.paths) {
      if (!piece.visible) continue;
      const [j, k] = piece.curve.split(":");
      const group = `${j}:${k}`;
      (groups.get(group) ?? groups.set(group, []).get(group)!).push(piece);
    }
    const paths: ProjectedPath[] = [];
    for (const [group, pieces] of [...groups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const [ux, uy] = directions[Number(group.split(":")[0])];
      const oriented = pieces.map((piece) => {
        const first = piece.points[0], last = piece.points[piece.points.length - 1];
        const forward = ux * (last[0] - first[0]) + uy * (last[1] - first[1]) >= 0;
        return { points: forward ? piece.points : [...piece.points].reverse(), depths: forward ? piece.depths : [...piece.depths].reverse() };
      }).sort((a, b) => (ux * a.points[0][0] + uy * a.points[0][1]) - (ux * b.points[0][0] + uy * b.points[0][1]));
      let run: { points: (readonly [number, number])[]; depths: number[] } | null = null;
      let ordinal = 0;
      const emit = (): void => {
        if (!run) return;
        const id = `hatch/${group}#${ordinal++}`;
        paths.push(Object.freeze({
          id, seed: componentSeed(0, id, "path"), points: Object.freeze(run.points.map((q) => Object.freeze([q[0], q[1]] as const))), closed: false, level: 0, levelFraction: 0,
          visible: true, depths: Object.freeze(run.depths), curve: group,
        }));
        run = null;
      };
      for (const piece of oriented) {
        if (run) {
          const end = run.points[run.points.length - 1], start = piece.points[0];
          const depthGap = Math.abs(piece.depths[0] - run.depths[run.depths.length - 1]);
          // one stroke only where the surface is continuous: a jump in depth is another surface (a nearer part beginning)
          if (Math.hypot(start[0] - end[0], start[1] - end[1]) <= 1e-5 && depthGap <= 1e-7 * Math.max(1, Math.abs(piece.depths[0]))) { run.points.push(...piece.points.slice(1)); run.depths.push(...piece.depths.slice(1)); continue; }
          emit();
        }
        run = { points: [...piece.points], depths: [...piece.depths] };
      }
      emit();
    }
    return Object.freeze({ paths: Object.freeze(paths), segments: curves.length, hatched, stats: solved.stats });
  });
}

// ---------------------------------------------------------------------------------------------
// Painter's fill

export interface PaintedFaces {
  /** Canvas polygons (x, y pairs, 3 or 4 points) far to near. */
  readonly polygons: readonly (readonly number[])[];
  /** Triangle index of each polygon. */
  readonly triangles: Uint32Array;
  /** 1 when the polygon's triangle faces the camera, 0 for a back face of an open mesh (drawn with a flipped normal). */
  readonly front: Uint8Array;
  readonly exact: boolean;
  readonly undecided: number;
  readonly cycleBreaks: number;
}
const paintCache = new WeakMap<Mesh, Map<string, PaintedFaces>>();

export function paintedFaces(mesh: Mesh, view: Camera): PaintedFaces {
  return cachedBy(paintCache, mesh, view.key, () => {
    constructionCounts.paint++;
    let ordered;
    try { ordered = paintOrder(mesh, view, { cull: closedSolid(mesh) ? "back" : "none" }); }
    catch (error) { throw new Error(`Fill: ${(error as Error).message}. Lower Detail or use Surface tone Hatched`); }
    const facing = triangleFacing(mesh, view), scratch = new Float64Array(3);
    const polygons: number[][] = [], triangles: number[] = [], front: number[] = [];
    for (const t of ordered.order) {
      const poly = projectTriangle(mesh, view, t, scratch);
      if (poly.length < 6) continue;
      polygons.push(poly); triangles.push(t); front.push(facing[t]);
    }
    return Object.freeze({ polygons: Object.freeze(polygons.map((q) => Object.freeze(q))), triangles: Uint32Array.from(triangles), front: Uint8Array.from(front),
      exact: ordered.exact, undecided: ordered.undecided, cycleBreaks: ordered.cycleBreaks });
  });
}

// ---------------------------------------------------------------------------------------------
// Depth cue

export interface DepthRange { readonly near: number; readonly far: number }
/** Depth interval of the mesh's vertices (exact for the mesh, not its bounding sphere), at least as far as the perspective near plane. */
export function depthRange(mesh: Mesh, view: Camera): DepthRange {
  const p = meshStorage(mesh).positions, scratch = new Float64Array(3);
  let near = Infinity, far = -Infinity;
  for (let v = 0; v < mesh.vertexCount; v++) { view.toView(p[v * 3], p[v * 3 + 1], p[v * 3 + 2], scratch, 0); if (scratch[2] < near) near = scratch[2]; if (scratch[2] > far) far = scratch[2]; }
  if (view.options.projection === "perspective") { near = Math.max(view.options.near, near); far = Math.max(far, near + 1e-9); }
  return { near, far: far > near ? far : near + 1e-9 };
}

/** 0 (nearest) to `CUE_STEPS - 1` (farthest). */
export function cueBin(depth: number, range: DepthRange): number {
  const t = (depth - range.near) / (range.far - range.near);
  return Math.max(0, Math.min(CUE_STEPS - 1, Math.floor(t * CUE_STEPS)));
}

export interface CuePiece { readonly points: readonly (readonly [number, number])[]; readonly bin: number; readonly closed: boolean }

/** Cut a projected path where its depth crosses a bin boundary; each piece has one bin. A path inside one bin is returned whole. */
export function splitByDepth(path: ProjectedPath, range: DepthRange, perspective: boolean): readonly CuePiece[] {
  const n = path.points.length, bins = path.depths.map((z) => cueBin(z, range));
  if (bins.every((b) => b === bins[0])) return [{ points: path.points, bin: bins[0], closed: path.closed }];
  const width = (range.far - range.near) / CUE_STEPS;
  const pieces: { points: [number, number][]; bin: number }[] = [{ points: [[path.points[0][0], path.points[0][1]]], bin: bins[0] }];
  const segments = path.closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const a = path.points[i], b = path.points[(i + 1) % n], za = path.depths[i], zb = path.depths[(i + 1) % n];
    const ba = bins[i], bb = bins[(i + 1) % n];
    if (ba !== bb) {
      const step = bb > ba ? 1 : -1;
      for (let bin = ba; bin !== bb; bin += step) {
        const boundary = range.near + (step > 0 ? bin + 1 : bin) * width;
        const u = Math.max(0, Math.min(1, perspective ? (1 / boundary - 1 / za) / (1 / zb - 1 / za) : (boundary - za) / (zb - za)));
        const x = a[0] + u * (b[0] - a[0]), y = a[1] + u * (b[1] - a[1]);
        pieces[pieces.length - 1].points.push([x, y]);
        pieces.push({ points: [[x, y]], bin: bin + step });
      }
    }
    pieces[pieces.length - 1].points.push([b[0], b[1]]);
  }
  return pieces.filter((piece) => piece.points.length >= 2).map((piece) => ({ points: piece.points, bin: piece.bin, closed: false }));
}
