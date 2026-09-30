import { meshAbstractionDefinition } from "../adapters/mesh-abstraction-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { createCompositionRun, strokeWith } from "./core.js";
import { color, pathMaterial, tonedMaterial } from "./materials.js";
import { meshDerived, meshStorage, type Mesh } from "./mesh.js";
import type { MeshRegion } from "./mesh-region.js";
import {
  abstractionCamera, abstractionImportance, meshAbstractionProducts, meshViewProducts, prepareMeshAbstractionProducts, sourceDescriptor,
  type AbstractionSource, type MeshAbstractionComposition, type MeshAbstractionProducts,
} from "./mesh-abstraction.js";
import type { Camera } from "./camera.js";
import type { CompositionRun, CompositionSurface, PathMaterial, PathMaterialSpec } from "./types.js";
import type { ProjectedPath } from "./visibility.js";

export type { MeshAbstractionComposition, MeshAbstractionProducts };
export { meshAbstractionProducts } from "./mesh-abstraction.js";

/**
 * Mesh Abstraction as a typed, JSON-compatible composition. Producer stages (construction and view) live in
 * `mesh-abstraction.ts`; this module resolves the stored controls and DRAWS what they produced.
 *
 * Palette tones: 0 facets (shaded by a light fixed in the world), 1 edge lines and the ghost, 2 the preserved region
 * (tint and region edges). Draw order: [the source, when beside], facets far to near (the painter order of
 * `paintOrder`, so nearer facets hide farther ones and translucent facets composite in depth order), hidden edges,
 * visible edges through `pathMaterial`, then the ghost. The layer paints nothing else: the Studio document owns the
 * background.
 *
 * Substitution: `drawMeshAbstraction(surface, recipe, {line, facet})` replaces the edge material (any `PathMaterial`)
 * or the facet painter with an ordinary callback; the products they read are the cached ones.
 */
export interface FacetPaint {
  /** Canvas corners, x0 y0 x1 y1 x2 y2, and the RGB the stock painter would use (0..255). */
  readonly points: readonly [number, number, number, number, number, number];
  readonly rgb: readonly [number, number, number];
  /** Triangle index in the mesh being drawn and its mean corner importance in [0, 1]. */
  readonly triangle: number;
  readonly importance: number;
  readonly opacity: number;
}
export interface MeshAbstractionConsumers {
  line?: PathMaterial;
  facet?: (surface: CompositionSurface, facet: FacetPaint) => void;
}

type Scalar = number | string | boolean;
const definition = meshAbstractionDefinition;
const dot = { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } as const;
const DRAW_WORK = 2_000_000;
/** Region edges are drawn at this share of the line weight. */
const FINE_LINE = 0.6;

/** Resolve stored scalar controls (and the layer seed) to the public composition value. */
export function meshAbstractionComposition(input: InstrumentInput): MeshAbstractionComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const invert = q.invert as boolean, falloff = q.falloff as number;
  const region: MeshRegion = q.region === "sphere" ? { kind: "sphere", center: [q.regionX as number, q.regionY as number, q.regionZ as number], radius: q.regionSize as number, falloff, invert }
    : q.region === "box" ? { kind: "box", center: [q.regionX as number, q.regionY as number, q.regionZ as number], size: q.regionSize as number, falloff, invert }
    : q.region === "band" ? { kind: "band", axis: q.regionAxis as "x" | "y" | "z", from: q.bandFrom as number, to: q.bandTo as number, falloff, invert }
    : q.region === "seeded" ? { kind: "seeded", count: q.regionCount as number, radius: q.regionSize as number, falloff, invert }
    : { kind: "none" };
  return {
    kind: "mesh-abstraction", seed: input.seed, palette: [...input.palette],
    source: sourceDescriptor({ source: q.source as AbstractionSource, detail: q.detail as number, terrainVariant: q.terrainVariant as string, vaseProfile: q.vaseProfile as string }, input.seed),
    construction: {
      keep: q.keep as number, rule: q.rule as "quadric" | "length", boundary: q.boundary as "hold" | "free" | "frozen",
      creaseAngle: q.keepCreases ? q.creaseAngle as number : 0, maxError: q.maxError as number, region,
    },
    view: { projection: q.projection as "orthographic" | "perspective", yaw: q.yaw as number, pitch: q.pitch as number, roll: q.roll as number, distance: q.distance as number,
      centerX: q.centerX as number, centerY: q.centerY as number, size: q.size as number },
    facets: { mode: q.facets as "shaded" | "flat" | "none", opacity: q.facetOpacity as number, light: q.light as number, contrast: q.contrast as number },
    lines: { edges: q.edges as "none" | "outline" | "mesh", hidden: q.hiddenLines as "drop" | "faint" | "dashed", weight: q.lineWeight as number,
      material: q.lineMaterial as "ink" | "stitch" | "beads", outlineAngle: q.creaseAngle as number },
    highlight: { mode: q.region === "none" ? "off" : q.highlight as "off" | "tint" | "lines" | "both", amount: q.highlightAmount as number },
    compare: { mode: q.compare as "off" | "ghost" | "beside", lines: q.ghostLines as "outline" | "mesh", weight: q.ghostWeight as number, opacity: q.ghostOpacity as number },
  };
}

/** A surface whose fill and stroke alpha are scaled (for ghost and hidden lines); everything else passes through. */
function faint(surface: CompositionSurface, factor: number): CompositionSurface {
  const scale = (channels: number[]): number[] => channels.length === 4 ? [channels[0], channels[1], channels[2], channels[3] * factor] : channels.length === 3 ? [...channels, 255 * factor] : channels;
  return {
    CLOSE: surface.CLOSE, ROUND: surface.ROUND,
    push: () => surface.push(), pop: () => surface.pop(), translate: (x, y) => surface.translate(x, y), rotate: (r) => surface.rotate(r),
    scale: (x, y) => (y === undefined ? surface.scale(x) : surface.scale(x, y)),
    noFill: () => surface.noFill(), noStroke: () => surface.noStroke(),
    fill: (...c) => surface.fill(...scale(c)), stroke: (...c) => surface.stroke(...scale(c)),
    strokeWeight: (w) => surface.strokeWeight(w), strokeCap: (c) => surface.strokeCap(c),
    circle: (x, y, d) => surface.circle(x, y, d), line: (a, b, c, d) => surface.line(a, b, c, d), rect: (x, y, w, h) => surface.rect(x, y, w, h),
    beginShape: () => surface.beginShape(), vertex: (x, y) => surface.vertex(x, y), endShape: (m) => surface.endShape(m),
  };
}

const lineSpec = (kind: PathMaterialSpec["kind"], weight: number): PathMaterialSpec =>
  ({ kind, weight, spacing: kind === "beads" ? 6 : 7, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark: { ...dot, size: Math.max(1.5, weight * 2.4) } });

const rgbOf = (palette: readonly number[], tone: number): [number, number, number] => {
  const c = palette[tone % palette.length] >>> 0;
  return [(c >>> 16) & 255, (c >>> 8) & 255, c & 255];
};

interface Panel { readonly mesh: Mesh; readonly camera: Camera; readonly importance: Float64Array; readonly importanceKey: string }

/** Facets far to near. Back-facing triangles of an open surface are lit from their visible side. */
function paintFacets(surface: CompositionSurface, panel: Panel, recipe: MeshAbstractionComposition, order: readonly number[], facet?: MeshAbstractionConsumers["facet"]): void {
  const { mesh, camera, importance } = panel, f = recipe.facets, h = recipe.highlight;
  const store = meshStorage(mesh), normals = meshDerived(mesh).triangleNormals;
  const projected = new Float64Array(mesh.vertexCount * 2).fill(NaN);
  for (let v = 0; v < mesh.vertexCount; v++) {
    const p = camera.project([store.positions[v * 3], store.positions[v * 3 + 1], store.positions[v * 3 + 2]]);
    if (p) { projected[v * 2] = p.x; projected[v * 2 + 1] = p.y; }
  }
  const base = rgbOf(recipe.palette, 0), accent = rgbOf(recipe.palette, 2);
  const azimuth = f.light * Math.PI / 180, elevation = 50 * Math.PI / 180;
  const light = [Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation)];
  const perspective = camera.options.projection === "perspective";
  const tint = h.mode === "tint" || h.mode === "both" ? h.amount : 0;
  const opaque = f.opacity >= 0.999;
  surface.push();
  for (const t of order) {
    const a = store.triangles[t * 3], b = store.triangles[t * 3 + 1], c = store.triangles[t * 3 + 2];
    const x0 = projected[a * 2], y0 = projected[a * 2 + 1], x1 = projected[b * 2], y1 = projected[b * 2 + 1], x2 = projected[c * 2], y2 = projected[c * 2 + 1];
    if (Number.isNaN(x0 + x1 + x2)) continue;
    let nx = normals[t * 3], ny = normals[t * 3 + 1], nz = normals[t * 3 + 2];
    const toEye = perspective
      ? nx * (camera.eye[0] - store.positions[a * 3]) + ny * (camera.eye[1] - store.positions[a * 3 + 1]) + nz * (camera.eye[2] - store.positions[a * 3 + 2])
      : -(nx * camera.forward[0] + ny * camera.forward[1] + nz * camera.forward[2]);
    if (toEye < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const half = 0.5 + 0.5 * (nx * light[0] + ny * light[1] + nz * light[2]);
    const level = f.mode === "shaded" ? 0.4 + 0.6 * (1 - f.contrast * (1 - half)) : 1;
    const imp = (importance[a] + importance[b] + importance[c]) / 3, mix = tint * imp;
    const rgb: [number, number, number] = [0, 1, 2].map((k) => Math.round(((1 - mix) * base[k] + mix * accent[k]) * level)) as [number, number, number];
    if (facet) { facet(surface, { points: [x0, y0, x1, y1, x2, y2], rgb, triangle: t, importance: imp, opacity: f.opacity }); continue; }
    surface.fill(rgb[0], rgb[1], rgb[2], 255 * f.opacity);
    if (opaque) { surface.stroke(rgb[0], rgb[1], rgb[2], 255); surface.strokeWeight(0.6); } else surface.noStroke();
    surface.beginShape(); surface.vertex(x0, y0); surface.vertex(x1, y1); surface.vertex(x2, y2); surface.endShape(surface.CLOSE);
  }
  surface.pop();
}

function strokeEdges(surface: CompositionSurface, paths: readonly ProjectedPath[], recipe: MeshAbstractionComposition, run: CompositionRun, weightScale: number, custom?: PathMaterial): void {
  const l = { ...recipe.lines, weight: recipe.lines.weight * weightScale }, ink = recipe.highlight.mode === "lines" || recipe.highlight.mode === "both";
  const retone = (path: ProjectedPath): ProjectedPath => ({ ...path, tone: ink && path.tone === 2 ? 2 : 1 });
  const visible = paths.filter((p) => p.visible).map(retone);
  if (l.hidden !== "drop") {
    const hidden = paths.filter((p) => !p.visible).map(retone);
    if (hidden.length > 0) strokeWith(faint(surface, l.hidden === "faint" ? 0.3 : 0.6), hidden, pathMaterial(lineSpec(l.hidden === "faint" ? "ink" : "stitch", l.weight * 0.8), recipe.palette), run);
  }
  // Region edges are short and many: a finer line keeps the fine structure readable instead of a solid patch.
  const coarse = visible.filter((p) => p.tone !== 2), fine = visible.filter((p) => p.tone === 2);
  if (coarse.length > 0) strokeWith(surface, coarse, custom ?? pathMaterial(lineSpec(l.material, l.weight), recipe.palette), run);
  if (fine.length > 0) strokeWith(surface, fine, custom ?? pathMaterial(lineSpec(l.material, l.weight * FINE_LINE), recipe.palette), run);
}

function paintPanel(surface: CompositionSurface, panel: Panel, recipe: MeshAbstractionComposition, run: CompositionRun, consumers: MeshAbstractionConsumers, weightScale = 1): void {
  const wantsFill = recipe.facets.mode !== "none" && recipe.facets.opacity > 0;
  const view = meshViewProducts(panel.mesh, panel.camera, {
    paint: wantsFill, edges: recipe.lines.edges, outlineAngle: recipe.lines.outlineAngle, importance: panel.importance, importanceKey: panel.importanceKey,
  }, run);
  if (wantsFill && view.paint) paintFacets(surface, panel, recipe, view.paint.order, consumers.facet);
  if (recipe.lines.edges !== "none") strokeEdges(surface, view.paths, recipe, run, weightScale, consumers.line);
}

/** Draw the recipe into a caller-owned surface. */
export function drawMeshAbstraction(surface: CompositionSurface, recipe: MeshAbstractionComposition, consumers: MeshAbstractionConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: DRAW_WORK })): void {
  run.check();
  const products = meshAbstractionProducts(recipe), { source, abstraction } = products;
  const regionKey = JSON.stringify(recipe.construction.region) + recipe.seed;
  const result = (dx: number, scale: number): Panel => ({ mesh: abstraction.mesh, camera: abstractionCamera(source, recipe.view, { scale, dx }), importance: abstractionImportance(abstraction), importanceKey: `a${regionKey}` });
  const original = (dx: number, scale: number): Panel => ({ mesh: source, camera: abstractionCamera(source, recipe.view, { scale, dx }), importance: products.sourceImportance, importanceKey: `s${regionKey}` });
  if (recipe.compare.mode === "beside") {
    const offset = recipe.view.size * 0.27;
    // The source has many times the edges in the same space: thin its lines so they stay lines.
    const density = Math.min(1, Math.max(0.3, 1.6 * Math.sqrt(abstraction.faces / source.triangleCount)));
    paintPanel(surface, original(-offset, 0.55), recipe, run, consumers, density);
    paintPanel(surface, result(offset, 0.55), recipe, run, consumers);
    return;
  }
  paintPanel(surface, result(0, 1), recipe, run, consumers);
  if (recipe.compare.mode === "ghost") {
    const panel = original(0, 1);
    const view = meshViewProducts(panel.mesh, panel.camera, { paint: false, edges: recipe.compare.lines, outlineAngle: recipe.lines.outlineAngle, importance: null, importanceKey: "" }, run);
    const visible = view.paths.filter((p) => p.visible).map((p) => ({ ...p, tone: 1 }));
    if (visible.length > 0) strokeWith(faint(surface, recipe.compare.opacity), visible, tonedMaterial(pathMaterial(lineSpec("ink", recipe.compare.weight), recipe.palette), 1), run);
  }
}

/** Run the collapses cooperatively and build the products; false if cancelled. */
export async function prepareMeshAbstraction(recipe: MeshAbstractionComposition, cancelled: () => boolean): Promise<boolean> {
  const products = await prepareMeshAbstractionProducts(recipe, cancelled);
  return products !== null && !cancelled();
}
