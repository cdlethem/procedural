import { surfaceGrowthDefinition } from "../adapters/surface-growth-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { atEach, cachedBy, componentSeed, createCompositionRun, strokeWith } from "./core.js";
import { camera as makeCamera, type Camera } from "./camera.js";
import { growthField, type GrowthField } from "./growth-field.js";
import { bundledGrowthSeed, type GrowthSeed } from "./growth-seeds.js";
import { motif, pathMaterial, tonedMaterial } from "./materials.js";
import { internalVertexNormals, meshDerived, meshStorage, type Mesh } from "./mesh.js";
import { pointAttribute, projectPoints, sampleSurface, type ProjectedPoint } from "./mesh-sample.js";
import { isoContours } from "./mesh-section.js";
import { meshFeatureEdges, meshTopology } from "./mesh-topology.js";
import { growthConstruction, type SurfaceGrowthConstruction } from "./surface-growth-controls.js";
import { grownSurface, prepareSurfaceGrowth, surfaceGrowthSnapshots, type GrownSurface, type GrowthSnapshots } from "./surface-growth.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, PathMaterial, PathMaterialSpec } from "./types.js";
import { hiddenLines, meshEdgeCurves, paintOrder, visiblePoints, type ProjectedPath, type SpatialCurve } from "./visibility.js";

/**
 * Surface Growth as a typed, JSON-compatible composition in four separate stages:
 *
 * 1. construction (`growth` snapshots, `surface`, `field`, `steps`): the F7 run of `surface-growth.ts`. Its
 *    content key is the only thing a structural edit changes; nothing below can reach it.
 * 2. the grown `Mesh` (`grownSurface`): vertex attributes `growth`, `field`, `stretch`, `birth`, `generation`.
 * 3. the view (`view`): a `Camera` and everything that depends on it and the mesh only (painter order, hidden-line
 *    paths, iso-contour paths, occlusion-tested grains). Editing the camera never rebuilds stages 1 and 2.
 * 4. appearance (`faces`, `lines`, `levels`, `grains`, palette): colors, weights, materials, opacities. Editing
 *    these recomputes nothing except what a treatment selects from the view (for instance the crease angle or
 *    the number of level lines), and each of those is cached by mesh and camera.
 *
 * Palette tones: 0 every line and (without attribute coloring) nothing else; 1 the fill; with `colorBy` the fill
 * ramps through tones 1 to n - 1 (linear in RGB between stops; grains take the nearest tone). Back faces mix the
 * fill with tone 0. Draw order: faces far to near, grains far to near (occluded ones omitted), level lines,
 * wire edges, contour edges (silhouette, boundary, creases). Nothing is painted over the background, so the
 * picture is a transparent layer. Hidden lines are either removed or faded (`hidden`), never just dimmed
 * by depth: the visibility solution of `visibility.ts` decides what is hidden.
 *
 * `drawSurfaceGrowth(surface, recipe, {line, grain})` replaces the line material or the grain mark with an
 * ordinary callback. The direct API accepts any `GrowthSeed` mesh and `GrowthField` through
 * `growSurface`; the instrument names bundled seeds and field kinds only (binding a user's own mesh or field
 * to the host is future work).
 */
export interface SurfaceGrowthComposition {
  kind: "surface-growth";
  seed: number;
  palette: readonly number[];
  construction: SurfaceGrowthConstruction;
  view: { projection: "orthographic" | "perspective"; yaw: number; pitch: number; roll: number; distance: number; size: number; centerX: number; centerY: number };
  faces: { mode: "none" | "flat" | "facets" | "shaded"; colorBy: ColorBy; opacity: number; back: "same" | "tinted" | "hidden"; lightAzimuth: number; lightElevation: number; lightStrength: number };
  lines: { mode: "none" | "contour" | "wire" | "both"; crease: number; hidden: "remove" | "fade"; hiddenOpacity: number; material: PathMaterialSpec["kind"]; contourWeight: number; wireWeight: number };
  levels: { by: "none" | "growth" | "stretch" | "height" | "depth"; count: number; weight: number };
  grains: { count: number; size: number; mark: "dot" | "rings" | "rosette" };
}
export type ColorBy = "none" | "growth" | "stretch" | "depth";

/** Replace the line material or the grain mark with an ordinary callback. */
export interface SurfaceGrowthConsumers {
  line?: PathMaterial;
  grain?: Mark;
}

type Scalar = number | string | boolean;
const definition = surfaceGrowthDefinition;
const DRAW_WORK = 2_000_000;
const SPACING = 6;
const AMBIENT = 0.3;
const ORTHOGRAPHIC_DISTANCE = 4;
const dot = { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } as const;

/** Resolve stored scalar controls to the public composition value. */
export function surfaceGrowthComposition(input: InstrumentInput): SurfaceGrowthComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  return {
    kind: "surface-growth", seed: input.seed, palette: [...input.palette], construction: growthConstruction(q),
    view: { projection: q.projection as "orthographic" | "perspective", yaw: q.yaw as number, pitch: q.pitch as number, roll: q.roll as number,
      distance: q.distance as number, size: q.size as number, centerX: q.centerX as number, centerY: q.centerY as number },
    faces: { mode: q.faces as SurfaceGrowthComposition["faces"]["mode"], colorBy: q.colorBy as ColorBy, opacity: q.faceOpacity as number,
      back: q.backFaces as SurfaceGrowthComposition["faces"]["back"], lightAzimuth: q.lightAzimuth as number, lightElevation: q.lightElevation as number, lightStrength: q.lightStrength as number },
    lines: { mode: q.lines as SurfaceGrowthComposition["lines"]["mode"], crease: q.creaseAngle as number, hidden: q.hidden as "remove" | "fade", hiddenOpacity: q.hiddenOpacity as number,
      material: q.lineMaterial as PathMaterialSpec["kind"], contourWeight: q.contourWeight as number, wireWeight: q.wireWeight as number },
    levels: { by: q.levelBy as SurfaceGrowthComposition["levels"]["by"], count: q.levels as number, weight: q.levelWeight as number },
    grains: { count: q.grains as number, size: q.grainSize as number, mark: q.grainMark as SurfaceGrowthComposition["grains"]["mark"] },
  };
}

/** Whether changing the seed can change this configuration. */
export function surfaceGrowthUsesSeed(q: Record<string, Scalar>): boolean {
  return Number(q.perturb) > 0 || q.field === "noise" || Number(q.grains) > 0;
}

// ------------------------------------------------------------------------------------ stage 1 and 2

/** The seed surface and field of a recipe (cached by construction: seeds by kind and resolution, fields by content). */
export function growthSources(recipe: SurfaceGrowthComposition): { seed: GrowthSeed; field: GrowthField } {
  const { kind, resolution } = recipe.construction.surface;
  const seed = bundledGrowthSeed(kind, resolution);
  return { seed, field: growthField(recipe.construction.field, seed, recipe.seed) };
}

/** The cached F7 snapshots of the recipe's construction at its `steps`. */
export function surfaceGrowthRun(recipe: SurfaceGrowthComposition, run?: CompositionRun): GrowthSnapshots {
  const { seed, field } = growthSources(recipe);
  return surfaceGrowthSnapshots(seed, field, recipe.construction.growth, recipe.seed, recipe.construction.steps, run ? { run } : {});
}

/** Run (cooperatively) and build the mesh; false if cancelled. */
export async function prepareSurfaceGrowthDrawing(recipe: SurfaceGrowthComposition, cancelled: () => boolean): Promise<boolean> {
  const { seed, field } = growthSources(recipe);
  const snaps = await prepareSurfaceGrowth(seed, field, recipe.construction.growth, recipe.seed, recipe.construction.steps, cancelled);
  if (!snaps) return false;
  grownSurface(snaps);
  return !cancelled();
}

// ------------------------------------------------------------------------------------------ stage 3

/**
 * The recipe's camera. It frames the grown mesh: the target is the centre of its bounds and `size` canvas units
 * are the radius of the sphere about it that contains every vertex, so a grown, larger or smaller surface always
 * fills the same part of the canvas. `distance` is in those radii. The mesh never depends on the camera.
 */
export function surfaceGrowthCamera(view: SurfaceGrowthComposition["view"], mesh: Mesh): Camera {
  const { min, max } = mesh.bounds, target: [number, number, number] = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const p = meshStorage(mesh).positions;
  let radius = 0;
  for (let v = 0; v < mesh.vertexCount; v++) radius = Math.max(radius, Math.hypot(p[v * 3] - target[0], p[v * 3 + 1] - target[1], p[v * 3 + 2] - target[2]));
  radius = Math.max(radius, 1e-9);
  // An orthographic camera ignores the eye distance except as an offset of depth, so a constant one keeps the control out of the drawing.
  const distance = (view.projection === "perspective" ? view.distance : ORTHOGRAPHIC_DISTANCE) * radius;
  return makeCamera({ projection: view.projection, yaw: view.yaw, pitch: view.pitch, roll: view.roll, target, zoom: view.size / radius, distance, center: [view.centerX, view.centerY] });
}

const orderCache = new WeakMap<Mesh, Map<string, readonly number[]>>();
const contourCache = new WeakMap<Mesh, Map<string, readonly ProjectedPath[]>>();
const wireCache = new WeakMap<Mesh, Map<string, readonly ProjectedPath[]>>();
const levelCache = new WeakMap<Mesh, Map<string, readonly ProjectedPath[]>>();
const grainCache = new WeakMap<Mesh, Map<string, readonly ProjectedPoint[]>>();

/** Triangle indices far to near for this mesh and camera (exact painter order of `visibility.ts`). */
export function surfacePaintOrder(mesh: Mesh, cam: Camera, run?: CompositionRun): readonly number[] {
  return cachedBy(orderCache, mesh, cam.key, () => paintOrder(mesh, cam, { cull: "none", ...(run ? { run } : {}) }).order);
}

/** Silhouette, boundary and (when `crease > 0` degrees) crease edges with hidden-line classification. */
export function surfaceContourPaths(mesh: Mesh, cam: Camera, crease: number, seed: number, run?: CompositionRun): readonly ProjectedPath[] {
  return cachedBy(contourCache, mesh, `${cam.key}|${crease}|${seed}`, () => {
    const topology = meshTopology(mesh);
    const edges = meshFeatureEdges(mesh, topology, cam, { crease: crease > 0 ? crease : null, silhouette: true, boundary: true });
    return hiddenLines(mesh, meshEdgeCurves(mesh, topology, edges), cam, { seed, ...(run ? { run } : {}) }).paths;
  });
}

/** Every mesh edge as its own curve, with hidden-line classification. */
export function surfaceWirePaths(mesh: Mesh, cam: Camera, seed: number, run?: CompositionRun): readonly ProjectedPath[] {
  return cachedBy(wireCache, mesh, `${cam.key}|${seed}`, () => {
    const topology = meshTopology(mesh), all = Array.from({ length: topology.counts.edges }, (_, e) => e);
    return hiddenLines(mesh, meshEdgeCurves(mesh, topology, all), cam, { seed, ...(run ? { run } : {}) }).paths;
  });
}

const attributeValues = (mesh: Mesh, name: string): Float64Array => meshStorage(mesh).attributes.find((a) => a.name === name)!.values;

/**
 * Level values of `by` for `count` iso-lines, evenly spaced strictly inside the range: growth between 1 and the growth limit, stretch
 * and height between the mesh's extremes, refinement depth at each half generation up to `count` of them.
 */
export function surfaceLevelValues(mesh: Mesh, by: "growth" | "stretch" | "height" | "depth", count: number, limit: number): readonly number[] {
  let low: number, high: number;
  if (by === "growth") { low = 1; high = limit; }
  else if (by === "depth") {
    const generation = attributeValues(mesh, "generation");
    let top = 0;
    for (const g of generation) if (g > top) top = g;
    return Array.from({ length: Math.min(count, top) }, (_, k) => k + 0.5);
  } else {
    const values = by === "stretch" ? attributeValues(mesh, "stretch") : Float64Array.from({ length: mesh.vertexCount }, (_, v) => meshStorage(mesh).positions[v * 3 + 1]);
    low = Infinity; high = -Infinity;
    for (const v of values) { if (v < low) low = v; if (v > high) high = v; }
  }
  if (!(high > low)) return [];
  return Array.from({ length: count }, (_, k) => low + (high - low) * (k + 1) / (count + 1));
}

/** Iso-lines of a vertex quantity with hidden-line classification. */
export function surfaceLevelPaths(mesh: Mesh, cam: Camera, by: "growth" | "stretch" | "height" | "depth", count: number, limit: number, seed: number, run?: CompositionRun): readonly ProjectedPath[] {
  return cachedBy(levelCache, mesh, `${cam.key}|${by}|${count}|${limit}|${seed}`, () => {
    const levels = surfaceLevelValues(mesh, by, count, limit);
    if (levels.length === 0) return [];
    const values = by === "height" ? Float64Array.from({ length: mesh.vertexCount }, (_, v) => meshStorage(mesh).positions[v * 3 + 1]) : attributeValues(mesh, by === "depth" ? "generation" : by);
    const curves: readonly SpatialCurve[] = isoContours(mesh, { values, levels }).curves;
    return hiddenLines(mesh, curves, cam, { seed, ...(run ? { run } : {}) }).paths;
  });
}

const attributeOf = (by: ColorBy): string | null => by === "none" ? null : by === "depth" ? "generation" : by;
const scaleCache = new WeakMap<Mesh, number>();
/** The strain that maps to the ends of the stretch ramp: the 95th percentile of |stretch| (at least 0.01), so the ramp spans what this skin shows. */
function stretchScale(mesh: Mesh): number {
  const hit = scaleCache.get(mesh);
  if (hit !== undefined) return hit;
  const magnitudes = Float64Array.from(attributeValues(mesh, "stretch"), Math.abs).sort();
  const scale = Math.max(0.01, magnitudes.length ? magnitudes[Math.min(magnitudes.length - 1, Math.floor(0.95 * magnitudes.length))] : 0);
  scaleCache.set(mesh, scale);
  return scale;
}
/** Colour fraction in [0, 1] of one attribute value: growth over its capacity, stretch about zero over `stretchScale`, refinement depth over the deepest. */
function fractionOf(by: ColorBy, value: number, limit: number, scale: number, deepest: number): number {
  const t = by === "growth" ? (limit > 1 ? (value - 1) / (limit - 1) : 0) : by === "stretch" ? 0.5 + 0.5 * Math.max(-1, Math.min(1, value / scale)) : value / deepest;
  return Math.max(0, Math.min(1, t));
}
function colorFraction(mesh: Mesh, by: ColorBy, limit: number): Float64Array | null {
  const name = attributeOf(by);
  if (!name) return null;
  const values = attributeValues(mesh, name);
  let deepest = 1;
  if (by === "depth") for (const g of values) if (g > deepest) deepest = g;
  const scale = by === "stretch" ? stretchScale(mesh) : 1;
  return Float64Array.from(values, (v) => fractionOf(by, v, limit, scale, deepest));
}

/** Surface samples that are visible (not hidden behind the surface), far to near, as sites; `tone` is the colour index. */
export function surfaceGrains(mesh: Mesh, cam: Camera, recipe: SurfaceGrowthComposition, run?: CompositionRun): readonly (ProjectedPoint & { tone: number })[] {
  const { count } = recipe.grains, by = recipe.faces.colorBy, limit = recipe.construction.growth.limit;
  const palette = recipe.palette;
  return cachedBy(grainCache as unknown as WeakMap<Mesh, Map<string, readonly (ProjectedPoint & { tone: number })[]>>, mesh, `${cam.key}|${recipe.seed}|${count}|${by}|${limit}|${palette.length}`, () => {
    const name = attributeOf(by), seed = componentSeed(recipe.seed, "grains", "sample");
    const cloud = sampleSurface(mesh, { seed, count, distribution: "even", normals: "smooth", attributes: name ? [name] : [] });
    const seen = visiblePoints(mesh, cloud, cam, run ? { run } : {});
    const values = name ? pointAttribute(cloud, name).values : null;
    const top = by === "depth" && values ? values.reduce((m, v) => Math.max(m, v), 1) : 1, scale = by === "stretch" ? stretchScale(mesh) : 1;
    const zoom = cam.options.zoom;
    return projectPoints(cloud, cam, { order: "far-to-near" }).filter((p) => seen[p.index] === 1).map((p) => {
      let tone = 1;
      if (values) {
        const v = values[p.index];
        tone = palette.length > 1 ? 1 + Math.min(palette.length - 2, Math.floor(fractionOf(by, v, limit, scale, top) * (palette.length - 1))) : 0;
      }
      return Object.freeze({ ...p, scale: cam.scaleAt(p.depth) / zoom, tone });
    });
  });
}

// ------------------------------------------------------------------------------------------ stage 4

function ramp(palette: readonly number[], t: number): [number, number, number] {
  const stops = palette.length > 1 ? palette.slice(1) : palette;
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = stops.length === 1 ? 0 : x - i;
  const a = stops[Math.max(0, i)] >>> 0, b = stops[Math.min(stops.length - 1, Math.max(0, i) + 1)] >>> 0;
  const mix = (shift: number): number => Math.round(((a >>> shift) & 255) * (1 - f) + ((b >>> shift) & 255) * f);
  return [mix(16), mix(8), mix(0)];
}

/** Forward every call to `surface`, multiplying the alpha of every fill and stroke by `factor` (colour channels as p5 reads them). */
export function withAlpha(surface: CompositionSurface, factor: number): CompositionSurface {
  const scaled = (channels: number[]): number[] => {
    if (channels.length === 1) return [channels[0], channels[0], channels[0], 255 * factor];
    if (channels.length === 2) return [channels[0], channels[0], channels[0], channels[1] * factor];
    if (channels.length === 3) return [...channels, 255 * factor];
    return [channels[0], channels[1], channels[2], (channels[3] ?? 255) * factor];
  };
  return {
    CLOSE: surface.CLOSE, ROUND: surface.ROUND,
    push: () => surface.push(), pop: () => surface.pop(), translate: (x, y) => surface.translate(x, y), rotate: (r) => surface.rotate(r), scale: (x, y) => surface.scale(x, y),
    noFill: () => surface.noFill(), noStroke: () => surface.noStroke(),
    fill: (...channels) => surface.fill(...scaled(channels)), stroke: (...channels) => surface.stroke(...scaled(channels)),
    strokeWeight: (w) => surface.strokeWeight(w), strokeCap: (c) => surface.strokeCap(c), circle: (x, y, d) => surface.circle(x, y, d),
    line: (a, b, c, d) => surface.line(a, b, c, d), rect: (x, y, w, h) => surface.rect(x, y, w, h),
    beginShape: () => surface.beginShape(), vertex: (x, y) => surface.vertex(x, y), endShape: (mode) => surface.endShape(mode),
  };
}

const lineSpec = (kind: PathMaterialSpec["kind"], weight: number): PathMaterialSpec =>
  ({ kind, weight, spacing: SPACING, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark: { ...dot, size: Math.max(1.5, weight * 2.4) } });

function drawFaces(surface: CompositionSurface, mesh: Mesh, cam: Camera, recipe: SurfaceGrowthComposition, order: readonly number[]): void {
  const f = recipe.faces, store = meshStorage(mesh), normals = meshDerived(mesh).triangleNormals, smoothNormals = internalVertexNormals(mesh), palette = recipe.palette;
  const fraction = colorFraction(mesh, f.colorBy, recipe.construction.growth.limit);
  const projected = new Float64Array(mesh.vertexCount * 3);
  for (let v = 0; v < mesh.vertexCount; v++) {
    const p = cam.project([store.positions[v * 3], store.positions[v * 3 + 1], store.positions[v * 3 + 2]]);
    projected[v * 3] = p ? p.x : NaN; projected[v * 3 + 1] = p ? p.y : NaN; projected[v * 3 + 2] = p ? p.depth : NaN;
  }
  const a = f.lightAzimuth * Math.PI / 180, e = f.lightElevation * Math.PI / 180;
  const light = [0, 1, 2].map((k) => -cam.forward[k] * Math.sin(e) + cam.right[k] * Math.cos(e) * Math.sin(a) + cam.up[k] * Math.cos(e) * Math.cos(a));
  const perspective = cam.options.projection === "perspective", shaded = f.mode === "shaded" || f.mode === "facets";
  const base = palette[1 % palette.length] >>> 0, plain: [number, number, number] = [(base >>> 16) & 255, (base >>> 8) & 255, base & 255];
  const ink = palette[0] >>> 0, inkRgb = [(ink >>> 16) & 255, (ink >>> 8) & 255, ink & 255];
  surface.push();
  for (const t of order) {
    const i0 = store.triangles[t * 3], i1 = store.triangles[t * 3 + 1], i2 = store.triangles[t * 3 + 2];
    if (Number.isNaN(projected[i0 * 3]) || Number.isNaN(projected[i1 * 3]) || Number.isNaN(projected[i2 * 3])) continue;
    const nx = normals[t * 3], ny = normals[t * 3 + 1], nz = normals[t * 3 + 2];
    let facing: number;
    if (perspective) {
      const cx = (store.positions[i0 * 3] + store.positions[i1 * 3] + store.positions[i2 * 3]) / 3, cy = (store.positions[i0 * 3 + 1] + store.positions[i1 * 3 + 1] + store.positions[i2 * 3 + 1]) / 3, cz = (store.positions[i0 * 3 + 2] + store.positions[i1 * 3 + 2] + store.positions[i2 * 3 + 2]) / 3;
      facing = nx * (cam.eye[0] - cx) + ny * (cam.eye[1] - cy) + nz * (cam.eye[2] - cz);
    } else facing = -(nx * cam.forward[0] + ny * cam.forward[1] + nz * cam.forward[2]);
    const front = facing > 0;
    if (!front && f.back === "hidden") continue;
    let rgb = fraction ? ramp(palette, (fraction[i0] + fraction[i1] + fraction[i2]) / 3) : plain;
    if (shaded) {
      let sx = nx, sy = ny, sz = nz;
      if (f.mode === "shaded") {
        sx = smoothNormals[i0 * 3] + smoothNormals[i1 * 3] + smoothNormals[i2 * 3]; sy = smoothNormals[i0 * 3 + 1] + smoothNormals[i1 * 3 + 1] + smoothNormals[i2 * 3 + 1]; sz = smoothNormals[i0 * 3 + 2] + smoothNormals[i1 * 3 + 2] + smoothNormals[i2 * 3 + 2];
        const length = Math.hypot(sx, sy, sz) || 1; sx /= length; sy /= length; sz /= length;
      }
      const sign = front ? 1 : -1, lambert = Math.max(0, sign * (sx * light[0] + sy * light[1] + sz * light[2]));
      const k = 1 - f.lightStrength + f.lightStrength * (AMBIENT + (1 - AMBIENT) * lambert);
      rgb = [rgb[0] * k, rgb[1] * k, rgb[2] * k];
    }
    if (!front && f.back === "tinted") rgb = [rgb[0] * 0.6 + inkRgb[0] * 0.3, rgb[1] * 0.6 + inkRgb[1] * 0.3, rgb[2] * 0.6 + inkRgb[2] * 0.3];
    const alpha = 255 * f.opacity;
    surface.fill(rgb[0], rgb[1], rgb[2], alpha); surface.stroke(rgb[0], rgb[1], rgb[2], alpha); surface.strokeWeight(0.7);
    surface.beginShape();
    surface.vertex(projected[i0 * 3], projected[i0 * 3 + 1]); surface.vertex(projected[i1 * 3], projected[i1 * 3 + 1]); surface.vertex(projected[i2 * 3], projected[i2 * 3 + 1]);
    surface.endShape(surface.CLOSE);
  }
  surface.pop();
}

/** Stroke `paths` of one weight with the material; hidden runs are dropped or drawn at `hiddenOpacity`. */
function strokePaths(surface: CompositionSurface, paths: readonly ProjectedPath[], recipe: SurfaceGrowthComposition, weight: number, material: PathMaterial | undefined, run: CompositionRun): void {
  const l = recipe.lines, palette = recipe.palette;
  const mat = material ?? tonedMaterial(pathMaterial(lineSpec(l.material, weight), palette), 0);
  const visible = paths.filter((p) => p.visible);
  if (visible.length > 0) strokeWith(surface, visible, mat, run);
  if (l.hidden === "fade" && l.hiddenOpacity > 0) {
    const hidden = paths.filter((p) => !p.visible);
    if (hidden.length > 0) strokeWith(withAlpha(surface, l.hiddenOpacity), hidden, mat, run);
  }
}

/** Draw the recipe into a caller-owned surface (see the module header for the order). */
export function drawSurfaceGrowth(surface: CompositionSurface, recipe: SurfaceGrowthComposition, consumers: SurfaceGrowthConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: DRAW_WORK })): void {
  run.check();
  const grown: GrownSurface = grownSurface(surfaceGrowthRun(recipe, run));
  const mesh = grown.mesh, cam = surfaceGrowthCamera(recipe.view, mesh), f = recipe.faces, l = recipe.lines, palette = recipe.palette;
  if (f.mode !== "none" && f.opacity > 0) drawFaces(surface, mesh, cam, recipe, surfacePaintOrder(mesh, cam, run));
  if (recipe.grains.count > 0) {
    const spec: MotifSpec = { kind: recipe.grains.mark, size: recipe.grains.size, petals: 5, opening: 0.3, weight: 1, rotation: 0, variation: 0, retention: 1 };
    atEach(surface, surfaceGrains(mesh, cam, recipe, run), consumers.grain ?? motif(spec, palette), run);
  }
  if (recipe.levels.by !== "none" && recipe.levels.count > 0)
    strokePaths(surface, surfaceLevelPaths(mesh, cam, recipe.levels.by, recipe.levels.count, recipe.construction.growth.limit, recipe.seed, run), recipe, recipe.levels.weight, consumers.line, run);
  if (l.mode === "wire" || l.mode === "both") strokePaths(surface, surfaceWirePaths(mesh, cam, recipe.seed, run), recipe, l.wireWeight, consumers.line, run);
  if (l.mode === "contour" || l.mode === "both") {
    const paths = surfaceContourPaths(mesh, cam, l.crease, recipe.seed, run);
    strokePaths(surface, paths.filter((p) => p.tone !== 0), recipe, l.contourWeight, consumers.line, run);
    strokePaths(surface, paths.filter((p) => p.tone === 0), recipe, l.contourWeight * 0.7, consumers.line, run);
  }
}
