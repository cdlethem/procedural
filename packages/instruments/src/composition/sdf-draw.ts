import { implicitSculptureDefinition } from "../adapters/implicit-sculpture-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { camera as makeCamera, type Camera } from "./camera.js";
import { createCompositionRun, strokeWith } from "./core.js";
import { IsoField, fillableRings } from "./iso-rings.js";
import { pointCloudData, projectPoints, type PointCloud } from "./mesh-sample.js";
import { meshFeatureEdges, meshTopology } from "./mesh-topology.js";
import { meshDerived, meshStorage } from "./mesh.js";
import { sliceCurves, slicePlanes, sliceMesh } from "./mesh-section.js";
import { buildSdfView, cachedSdfView, lightDirection, sdfView, shadeView, type Light, type SdfView, type ViewOptions } from "./sdf-march.js";
import { sdfMesh, sdfSurfacePoints, type SdfMesh } from "./sdf-mesh.js";
import { sculptureSdf, type SculptureSpec } from "./sdf-samples.js";
import type { Sdf } from "./sdf.js";
import type { CompositionRun, CompositionSurface, Path, PathMaterial, Point } from "./types.js";
import { hiddenLines, meshEdgeCurves, paintOrder, visiblePoints, type PaintOrder, type ProjectedPath, type SpatialCurve } from "./visibility.js";

/**
 * Implicit Sculpture as a typed, JSON-compatible composition over the producers in `sdf-samples.ts`, `sdf-march.ts` and
 * `sdf-mesh.ts`, each a public function, in FOUR SEPARATE STAGES:
 *
 *   construction   sculptureSdf(spec)                          spec, seed              -> Sdf
 *   extraction     sdfMesh(sdf, detail)                        sdf, Mesh detail        -> Mesh + provenance
 *   view           sdfView(sdf, camera, cells, steps, ao)      sdf, camera, sampling   -> per-cell hit, depth, normal, occlusion
 *   appearance     shading, tones, painter order, lines        view/mesh, camera, light, palette, weights
 *
 * The camera is built from view controls AFTER the sculpture and never enters the construction: a camera edit re-marches
 * the view (and re-solves hidden lines) but never rebuilds the tree or the mesh; a palette, opacity, level, weight or
 * light edit recomputes no ray. Sculpt edits rebuild everything downstream. `sculptureProducts` returns the cached
 * producer values a recipe needs (only those: a lines-only drawing extracts a mesh and marches nothing).
 *
 * Coordinates. The sculpture lives in world units; the camera targets its bounding-sphere centre, `size` is the canvas
 * diameter of that sphere, and `distance` (perspective) is in multiples of its radius. Everything drawn is canvas units in
 * the 640 reference frame. The layer paints transparent space; there is no background.
 *
 * Tones. Palette entry 0 is ink (silhouette, creases, slices); entries 1..n-1 are the shading ramp from shadow to light,
 * interpolated and quantised to `levels`. A one-colour palette shades by density (alpha) instead. Fills are painted with
 * `opacity`.
 *
 * Failures. Every limit throws naming the control: Cell size (view cells, ray work), March steps, Mesh detail (samples,
 * vertices, triangles), Slices, Grains. Nothing truncates or falls back to another picture.
 */
export type SculptureFill = "none" | "cells" | "bands" | "facets" | "points";

export interface ImplicitSculptureComposition {
  kind: "implicit-sculpture";
  seed: number;
  palette: readonly number[];
  sculpt: SculptureSpec;
  view: { projection: "orthographic" | "perspective"; yaw: number; pitch: number; roll: number; distance: number; size: number; centerX: number; centerY: number };
  light: Light;
  fill: { mode: SculptureFill; levels: number; opacity: number; cellShape: "square" | "dot"; cellGap: number; pointCount: number; pointSize: number };
  lines: { silhouette: boolean; creases: boolean; creaseAngle: number; sliceAxis: "x" | "y" | "z"; slices: number; hidden: "drop" | "faint"; weight: number; sliceWeight: number };
  quality: { cellSize: number; steps: number; meshDetail: number };
}

/** Replace the built-in line drawing with an ordinary path material (it receives visible AND hidden runs; see `visible`). */
export interface SculptureConsumers { line?: PathMaterial }

type Scalar = number | string | boolean;
const definition = implicitSculptureDefinition;
/** Facets above which the painter is refused (naming Mesh detail). */
export const MAX_FACETS = 120_000;

export function implicitSculptureComposition(input: InstrumentInput): ImplicitSculptureComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const num = (key: string) => q[key] as number;
  return {
    kind: "implicit-sculpture", seed: input.seed, palette: [...input.palette],
    sculpt: {
      seed: input.seed, form: q.form as SculptureSpec["form"],
      carved: { roundness: num("roundness"), bores: num("bores"), boreRadius: num("boreRadius") },
      lattice: { cells: num("cells"), voidSize: num("voidSize"), tunnel: num("tunnel"), voidKeep: num("voidKeep") },
      blend: num("blend"),
      coral: { branches: num("branches"), twigs: num("twigs"), spread: num("spread"), thickness: num("thickness"), bulbs: q.bulbs as boolean },
      fractal: { fold: q.fold as "menger", iterations: num("iterations"), shape: q.foldShape as "box" },
      carve: { cut: q.cut as SculptureSpec["carve"]["cut"], at: num("cutAt"), turn: num("cutTurn"), hollow: q.hollow as boolean, wall: num("wall"), order: q.order as SculptureSpec["carve"]["order"] },
      deform: { twist: num("twist"), bend: num("bend") },
      repeat: { x: num("repeatX"), y: num("repeatY"), z: num("repeatZ"), gap: num("repeatGap") },
    },
    view: { projection: q.projection as "orthographic", yaw: num("yaw"), pitch: num("pitch"), roll: num("roll"), distance: num("distance"), size: num("size"), centerX: num("centerX"), centerY: num("centerY") },
    light: { azimuth: num("lightAzimuth"), elevation: num("lightElevation"), ambient: num("ambient"), aoStrength: num("aoStrength"), depthFade: num("depthFade") },
    fill: { mode: q.fill as SculptureFill, levels: num("levels"), opacity: num("opacity"), cellShape: q.cellShape as "square", cellGap: num("cellGap"), pointCount: num("pointCount"), pointSize: num("pointSize") },
    lines: { silhouette: q.silhouette as boolean, creases: q.creases as boolean, creaseAngle: num("creaseAngle"), sliceAxis: q.sliceAxis as "x", slices: num("slices"), hidden: q.hiddenLines as "drop", weight: num("lineWeight"), sliceWeight: num("sliceWeight") },
    quality: { cellSize: num("cellSize"), steps: num("steps"), meshDetail: num("meshDetail") },
  };
}

/** Whether the seed can change the drawing: the tree's own seeds, or the sampled grains. */
export function implicitSculptureUsesSeed(q: Record<string, Scalar>): boolean {
  if (q.fill === "points") return true;
  if (q.form === "coral") return true;
  return q.form === "lattice-cavity" && (q.voidKeep as number) > 0 && (q.voidKeep as number) < 1;
}

// ---------------------------------------------------------------------------------------------
// Stages

/** The camera for a sculpture: aimed at its bounding-sphere centre, scaled so the sphere is `size` canvas units across. */
export function sculptureCamera(tree: Sdf, view: ImplicitSculptureComposition["view"]): Camera {
  const R = tree.radius, perspective = view.projection === "perspective";
  const distance = (perspective ? view.distance : 3) * R;
  const zoom = perspective ? (view.size / 2) * Math.sqrt(distance * distance - R * R) / (distance * R) : view.size / (2 * R);
  return makeCamera({ projection: view.projection, yaw: view.yaw, pitch: view.pitch, roll: view.roll, target: tree.center, zoom, distance, center: [view.centerX, view.centerY] });
}

const lru = <T>(cache: Map<string, T>, key: string, limit: number, make: () => T): T => {
  const hit = cache.get(key);
  if (hit !== undefined) { cache.delete(key); cache.set(key, hit); return hit; }
  const value = make();
  cache.set(key, value);
  if (cache.size > limit) cache.delete(cache.keys().next().value!);
  return value;
};

interface Facets { readonly order: PaintOrder; readonly normals: Float32Array }
const facetNormalCache = new WeakMap<object, Float32Array>();
const facetOrderCache = new Map<string, PaintOrder>();
function facets(extracted: SdfMesh, view: Camera): Facets {
  const { mesh } = extracted, s = meshStorage(mesh);
  if (mesh.triangleCount > MAX_FACETS) throw new Error(`Implicit Sculpture: ${mesh.triangleCount} facets exceed ${MAX_FACETS}; lower Mesh detail (now ${extracted.provenance.detail})`);
  let normals = facetNormalCache.get(mesh);
  if (!normals) {
    // The mesh's own (Newell) face normals: dual contouring keeps sharp features, so a face's normal is the surface's there.
    const { faceNormals } = meshDerived(mesh);
    normals = new Float32Array(mesh.triangleCount * 3);
    for (let t = 0; t < mesh.triangleCount; t++) {
      const f = s.triangleFace[t] * 3;
      normals[t * 3] = faceNormals[f]; normals[t * 3 + 1] = faceNormals[f + 1]; normals[t * 3 + 2] = faceNormals[f + 2];
    }
    facetNormalCache.set(mesh, normals);
  }
  const closed = meshTopology(mesh).kind === "closed-manifold";
  const order = lru(facetOrderCache, `${mesh.key}|${view.key}`, 3, () => paintOrder(mesh, view, { cull: closed ? "back" : "none", maxWork: 200_000_000 }));
  return { order, normals };
}

const chainLength = (points: readonly (readonly number[])[]): number => {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]);
  return length;
};

export interface SculptureLines { readonly features: readonly ProjectedPath[]; readonly slices: readonly ProjectedPath[] }
const lineCache = new Map<string, SculptureLines>();
function lines(extracted: SdfMesh, view: Camera, spec: ImplicitSculptureComposition["lines"]): SculptureLines {
  const { mesh } = extracted;
  const key = `${mesh.key}|${view.key}|${spec.silhouette ? 1 : 0}|${spec.creases ? spec.creaseAngle : "-"}|${spec.slices}|${spec.sliceAxis}`;
  return lru(lineCache, key, 3, () => {
    try {
      let features: readonly ProjectedPath[] = [], slices: readonly ProjectedPath[] = [];
      if (spec.silhouette || spec.creases) {
        const topology = meshTopology(mesh);
        const edges = meshFeatureEdges(mesh, topology, view, { crease: spec.creases ? spec.creaseAngle : null, silhouette: spec.silhouette, boundary: false });
        // Open chains shorter than 1.5 mesh cells are extraction noise (slivers where several features meet in one cell), not features.
        const chains = meshEdgeCurves(mesh, topology, edges).filter((c) => c.closed || chainLength(c.points) >= 1.5 * extracted.provenance.spacing);
        features = hiddenLines(mesh, chains, view, { maxWork: 100_000_000 }).paths;
      }
      if (spec.slices > 0) {
        const axis = spec.sliceAxis, a = axis === "x" ? 0 : axis === "y" ? 1 : 2, lo = mesh.bounds.min[a], hi = mesh.bounds.max[a];
        const spacing = (hi - lo) / (spec.slices + 1), normal: [number, number, number] = [a === 0 ? 1 : 0, a === 1 ? 1 : 0, a === 2 ? 1 : 0];
        const planes = slicePlanes(mesh, { normal, spacing, offset: lo + spacing });
        const curves: readonly SpatialCurve[] = sliceCurves(sliceMesh(mesh, planes, { maxWork: 100_000_000 }));
        slices = hiddenLines(mesh, curves, view, { maxWork: 100_000_000 }).paths;
      }
      return Object.freeze({ features, slices });
    } catch (error) {
      throw new Error(`Implicit Sculpture line work: ${(error as Error).message}; lower Mesh detail, Slices or raise the crease angle`);
    }
  });
}

export interface GrainProducts { readonly cloud: PointCloud; readonly visible: Uint8Array }
const grainCache = new Map<string, GrainProducts>();
const cloudCache = new Map<string, PointCloud>();
function grains(tree: Sdf, extracted: SdfMesh, view: Camera, recipe: ImplicitSculptureComposition): GrainProducts {
  const { pointCount } = recipe.fill, { detail } = extracted.provenance;
  const cloud = lru(cloudCache, `${tree.key}|${detail}|${pointCount}|${recipe.seed}`, 3, () => sdfSurfacePoints(tree, { detail, count: pointCount, seed: recipe.seed }));
  return lru(grainCache, `${cloud.key}|${extracted.mesh.key}|${view.key}`, 3, () => ({ cloud, visible: visiblePoints(extracted.mesh, cloud, view, { tolerance: 0.4 * extracted.provenance.spacing }) }));
}

/** Producer values a recipe needs; each is cached by its own construction, none by palette, weights or tones. */
export interface SculptureProducts {
  readonly sdf: Sdf;
  readonly camera: Camera;
  readonly mesh: SdfMesh | null;
  readonly view: SdfView | null;
  readonly facets: Facets | null;
  readonly lines: SculptureLines | null;
  readonly grains: GrainProducts | null;
}

export const viewOptions = (recipe: ImplicitSculptureComposition, run?: CompositionRun): ViewOptions => ({
  cellSize: recipe.quality.cellSize, maxSteps: recipe.quality.steps, ao: recipe.light.aoStrength > 0, run,
});
const needsMesh = (r: ImplicitSculptureComposition): boolean => r.fill.mode === "facets" || r.fill.mode === "points" || r.lines.silhouette || r.lines.creases || r.lines.slices > 0;
const needsView = (r: ImplicitSculptureComposition): boolean => r.fill.mode === "cells" || r.fill.mode === "bands";

export function sculptureProducts(recipe: ImplicitSculptureComposition, run?: CompositionRun): SculptureProducts {
  const tree = sculptureSdf(recipe.sculpt), view = sculptureCamera(tree, recipe.view);
  const extracted = needsMesh(recipe) ? sdfMesh(tree, { detail: recipe.quality.meshDetail, run }) : null;
  const { hollow, wall } = recipe.sculpt.carve;
  if (extracted && hollow && wall < 0.8 * extracted.provenance.spacing)
    throw new Error(`Implicit Sculpture: the hollow Wall (${wall}) is thinner than 0.8 of a mesh cell (${extracted.provenance.spacing.toFixed(3)}), so the extracted mesh cannot resolve it; raise Wall or Mesh detail, or use only the cells or bands fill without lines`);
  return {
    sdf: tree, camera: view, mesh: extracted,
    view: needsView(recipe) ? sdfView(tree, view, viewOptions(recipe, run)) : null,
    facets: recipe.fill.mode === "facets" ? facets(extracted!, view) : null,
    lines: extracted && (recipe.lines.silhouette || recipe.lines.creases || recipe.lines.slices > 0) ? lines(extracted, view, recipe.lines) : null,
    grains: recipe.fill.mode === "points" ? grains(tree, extracted!, view, recipe) : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Tones

const unpack = (rgb: number): [number, number, number] => [(rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255];
/** Quantise a tone in [0, 1] to the centre of one of `levels` steps. */
export const quantize = (t: number, levels: number): number => (Math.min(levels - 1, Math.floor(Math.max(0, Math.min(1, t)) * levels)) + 0.5) / levels;

/** Fill colour and alpha for tone `t` (0 shadow .. 1 light): the palette ramp, or density for a one-colour palette. */
export function toneColor(palette: readonly number[], t: number, opacity: number): [number, number, number, number] {
  if (palette.length === 1) return [...unpack(palette[0]), 255 * opacity * (0.1 + 0.9 * (1 - t))];
  const stops = palette.slice(1), at = Math.max(0, Math.min(1, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(at)), f = at - i;
  if (stops.length === 1) return [...unpack(stops[0]), 255 * opacity];
  const a = unpack(stops[i]), b = unpack(stops[i + 1]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, 255 * opacity];
}

const lineMaterial = (recipe: ImplicitSculptureComposition, weight: number): PathMaterial => (surface, path) => {
  const projected = path as ProjectedPath, [r, g, b] = unpack(recipe.palette[0]), faint = recipe.lines.hidden === "faint";
  if (!projected.visible && !faint) return;
  surface.noFill();
  surface.stroke(r, g, b, projected.visible ? 255 : 70);
  surface.strokeWeight(projected.visible ? weight : weight * 0.6);
  surface.beginShape();
  for (const [x, y] of path.points) surface.vertex(x, y);
  surface.endShape(path.closed ? surface.CLOSE : undefined);
};

// ---------------------------------------------------------------------------------------------
// Drawing

function fillPolygon(surface: CompositionSurface, ring: readonly Point[]): void {
  surface.beginShape();
  for (const [x, y] of ring) surface.vertex(x, y);
  surface.endShape(surface.CLOSE);
}

function drawCells(surface: CompositionSurface, recipe: ImplicitSculptureComposition, view: SdfView, shade: Float32Array, run: CompositionRun): void {
  const { levels, opacity, cellShape, cellGap } = recipe.fill, cell = view.cellSize, palette = recipe.palette;
  surface.noStroke();
  const overlap = opacity >= 0.999 && cellGap === 0 && cellShape === "square" ? 0.4 : 0;
  for (let j = 0; j < view.rows; j++) {
    let start = -1, key = "";
    let rgba: [number, number, number, number] = [0, 0, 0, 0];
    const flush = (end: number): void => {
      if (start < 0) return;
      run.enter(1);
      try {
        surface.fill(rgba[0], rgba[1], rgba[2], rgba[3]);
        surface.rect(view.x0 + (start - 0.5) * cell, view.y0 + (j - 0.5) * cell, (end - start) * cell + overlap, cell + overlap);
      } finally { run.leave(); }
      start = -1;
    };
    for (let i = 0; i < view.columns; i++) {
      const c = j * view.columns + i, t = shade[c];
      if (!(t >= 0)) { flush(i); continue; }
      const q = quantize(t, levels);
      if (cellShape === "dot") {
        run.enter(1);
        try {
          const [r, g, b, a] = toneColor(palette, q, opacity);
          surface.fill(r, g, b, a);
          surface.circle(view.x0 + i * cell, view.y0 + j * cell, cell * (1 - cellGap) * (0.3 + 0.75 * (1 - q)));
        } finally { run.leave(); }
        continue;
      }
      if (cellGap > 0) {
        run.enter(1);
        try {
          const [r, g, b, a] = toneColor(palette, q, opacity), s = cell * (1 - cellGap);
          surface.fill(r, g, b, a);
          surface.rect(view.x0 + i * cell - s / 2, view.y0 + j * cell - s / 2, s, s);
        } finally { run.leave(); }
        continue;
      }
      const k = String(q);
      if (start >= 0 && k !== key) flush(i);
      if (start < 0) { start = i; key = k; rgba = toneColor(palette, q, opacity); }
    }
    flush(view.columns);
  }
}

function drawBands(surface: CompositionSurface, recipe: ImplicitSculptureComposition, view: SdfView, shade: Float32Array, run: CompositionRun): void {
  const { levels, opacity } = recipe.fill, cell = view.cellSize, palette = recipe.palette, n = view.hit.length;
  const grid = { columns: view.columns, rows: view.rows, x0: view.x0, y0: view.y0, dx: cell, dy: cell };
  const mask = new Float32Array(n), tones = new Float32Array(n);
  for (let c = 0; c < n; c++) { mask[c] = view.hit[c] ? Math.max(view.coverage[c], 0.5) : view.coverage[c]; tones[c] = view.hit[c] ? shade[c] : -1; }
  const paint = (rings: readonly (readonly Point[])[], tone: number): void => {
    const [r, g, b, a] = toneColor(palette, tone, opacity);
    surface.fill(r, g, b, a);
    for (const ring of fillableRings(rings)) { run.enter(Math.max(1, Math.ceil(ring.length / 8))); try { fillPolygon(surface, ring); } finally { run.leave(); } }
  };
  surface.noStroke();
  paint(new IsoField({ ...grid, values: mask, outside: -1 }).rings(0.5, 400_000), quantize(0, levels));
  const field = new IsoField({ ...grid, values: tones, outside: -1e9 });
  for (let l = 1; l < levels; l++) paint(field.rings(l / levels, 400_000), (l + 0.5) / levels);
}

function drawFacets(surface: CompositionSurface, recipe: ImplicitSculptureComposition, products: SculptureProducts, run: CompositionRun): void {
  const { mesh } = products.mesh!, s = meshStorage(mesh), { order, normals } = products.facets!, cam = products.camera, tree = products.sdf;
  const { levels, opacity } = recipe.fill, palette = recipe.palette, light = recipe.light;
  const [lx, ly, lz] = lightDirection(cam, light.azimuth, light.elevation), near = cam.options.distance - tree.radius, span = 2 * tree.radius;
  const screen = new Float64Array(mesh.vertexCount * 3), scratch = new Float64Array(3);
  const perspective = cam.options.projection === "perspective", [cx, cy] = cam.options.center;
  for (let v = 0; v < mesh.vertexCount; v++) {
    cam.toView(s.positions[v * 3], s.positions[v * 3 + 1], s.positions[v * 3 + 2], scratch, 0);
    const k = cam.scaleAt(scratch[2]);
    screen[v * 3] = perspective && scratch[2] < cam.options.near ? NaN : cx + k * scratch[0]; screen[v * 3 + 1] = cy - k * scratch[1]; screen[v * 3 + 2] = scratch[2];
  }
  run.enter(Math.max(1, order.order.length >> 3));
  try {
    surface.noStroke();
    let last = -1;
    for (const t of order.order) {
      const a = s.triangles[t * 3], b = s.triangles[t * 3 + 1], c = s.triangles[t * 3 + 2];
      if (Number.isNaN(screen[a * 3]) || Number.isNaN(screen[b * 3]) || Number.isNaN(screen[c * 3])) continue;
      const lambert = Math.max(0, normals[t * 3] * lx + normals[t * 3 + 1] * ly + normals[t * 3 + 2] * lz);
      let tone = light.ambient + (1 - light.ambient) * lambert;
      const depth = (screen[a * 3 + 2] + screen[b * 3 + 2] + screen[c * 3 + 2]) / 3;
      tone *= 1 - light.depthFade * Math.max(0, Math.min(1, (depth - near) / span));
      const q = quantize(tone, levels);
      if (q !== last) { const [r, g, bl, al] = toneColor(palette, q, opacity); surface.fill(r, g, bl, al); if (opacity >= 0.999) { surface.stroke(r, g, bl, al); surface.strokeWeight(0.5); } last = q; }
      surface.beginShape();
      surface.vertex(screen[a * 3], screen[a * 3 + 1]); surface.vertex(screen[b * 3], screen[b * 3 + 1]); surface.vertex(screen[c * 3], screen[c * 3 + 1]);
      surface.endShape(surface.CLOSE);
    }
  } finally { run.leave(); }
}

function drawGrains(surface: CompositionSurface, recipe: ImplicitSculptureComposition, products: SculptureProducts, run: CompositionRun): void {
  const { cloud, visible } = products.grains!, cam = products.camera, normals = pointCloudData(cloud).normals;
  const { levels, opacity, pointSize } = recipe.fill, light = recipe.light, palette = recipe.palette, tree = products.sdf;
  const [lx, ly, lz] = lightDirection(cam, light.azimuth, light.elevation), near = cam.options.distance - tree.radius, span = 2 * tree.radius;
  const projected = projectPoints(cloud, cam, { order: "far-to-near", cullBackFacing: true });
  surface.noStroke();
  run.enter(Math.max(1, projected.length >> 3));
  try {
    for (const p of projected) {
      if (!visible[p.index]) continue;
      const nx = normals![p.index * 3], ny = normals![p.index * 3 + 1], nz = normals![p.index * 3 + 2];
      let tone = light.ambient + (1 - light.ambient) * Math.max(0, nx * lx + ny * ly + nz * lz);
      tone *= 1 - light.depthFade * Math.max(0, Math.min(1, (p.depth - near) / span));
      const [r, g, b, a] = toneColor(palette, quantize(tone, levels), opacity);
      surface.fill(r, g, b, a);
      surface.circle(p.position[0], p.position[1], pointSize * cam.scaleAt(p.depth) / cam.options.zoom);
    }
  } finally { run.leave(); }
}

/** Draw already-built producer values; `consumers.line` replaces the built-in line drawing. */
export function drawSculptureProducts(surface: CompositionSurface, recipe: ImplicitSculptureComposition, products: SculptureProducts, consumers: SculptureConsumers, run: CompositionRun): void {
  const { mode } = recipe.fill;
  if (mode !== "none" && recipe.fill.opacity > 0) {
    if (products.view) {
      const shade = shadeView(products.view, products.camera, products.sdf, recipe.light);
      if (mode === "cells") drawCells(surface, recipe, products.view, shade, run); else drawBands(surface, recipe, products.view, shade, run);
    } else if (mode === "facets") drawFacets(surface, recipe, products, run);
    else if (mode === "points") drawGrains(surface, recipe, products, run);
  }
  if (products.lines) {
    if (products.lines.slices.length) strokeWith(surface, products.lines.slices as readonly Path[], consumers.line ?? lineMaterial(recipe, recipe.lines.sliceWeight), run);
    if (products.lines.features.length) strokeWith(surface, products.lines.features as readonly Path[], consumers.line ?? lineMaterial(recipe, recipe.lines.weight), run);
  }
}

/** Draw the recipe into a caller-owned surface; transparent layer, no clearing. */
export function drawImplicitSculpture(surface: CompositionSurface, recipe: ImplicitSculptureComposition, consumers: SculptureConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 400_000 })): void {
  run.check();
  drawSculptureProducts(surface, recipe, sculptureProducts(recipe, run), consumers, run);
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the producers stage by stage, yielding between stages and between ray chunks; false if cancelled. Publishes only finished stages. */
export async function prepareImplicitSculpture(recipe: ImplicitSculptureComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const run = createCompositionRun({ maxWork: Number.MAX_SAFE_INTEGER, cancelled });
  try {
    const tree = sculptureSdf(recipe.sculpt), view = sculptureCamera(tree, recipe.view);
    await yieldToHost();
    if (needsMesh(recipe)) {
      if (cancelled()) return false;
      sdfMesh(tree, { detail: recipe.quality.meshDetail, run });
      await yieldToHost();
    }
    if (needsView(recipe) && !cachedSdfView(tree, view, viewOptions(recipe))) {
      const steps = buildSdfView(tree, view, viewOptions(recipe, run));
      for (;;) {
        if (cancelled()) return false;
        const step = steps.next();
        if (step.done) break;
        await yieldToHost();
      }
    }
    if (cancelled()) return false;
    sculptureProducts(recipe, run);
    return !cancelled();
  } catch (error) {
    if (cancelled() && (error as Error).message === "Composition cancelled") return false;
    throw error;
  }
}
