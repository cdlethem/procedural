import { visibilityDrawingDefinition } from "../adapters/visibility-drawing-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { createCompositionRun, strokeWith } from "./core.js";
import type { Camera } from "./camera.js";
import { pathMaterial } from "./materials.js";
import type { CompositionRun, CompositionSurface, Path, PathMaterial, PathMaterialSpec } from "./types.js";
import type { Mesh } from "./mesh.js";
import type { ProjectedPath } from "./visibility.js";
import { boundaryEdges, contourCurves, creaseCurvesExcluding, edgeCurves, sectionCurves, silhouetteEdges,
  type Convexity, type ContourRule, type CreaseRule, type SectionRule } from "./visibility-features.js";
import { sceneUsesSeed, visibilityMesh, type VisibilitySceneOptions, type VisibilityShape } from "./visibility-scenes.js";
import { CUE_STEPS, curvePaths, darkness, depthRange, paintedFaces, splitByDepth, tonedHatch, triangleLit, viewCamera,
  type CurvePaths, type DepthRange, type HatchResult, type LightRule, type PaintedFaces, type ViewRule } from "./visibility-view.js";

/**
 * Visibility Drawing (brief 53) as a typed, JSON-compatible composition over the F8 spatial foundation:
 *
 *   scene (bundled mesh)  ->  VIEW-INDEPENDENT classes: creases, rim, section planes, iso-contours     (cached by mesh + rule)
 *                         ->  camera                                                                   (`viewCamera`)
 *                         ->  VIEW-DEPENDENT: silhouette edges, exact hidden-line removal per class,
 *                             tone hatching of visible faces, painter's fill                          (cached by mesh + camera + rule)
 *                         ->  path materials (ink / stitch / beads), depth cue, hidden-line policy     (never cached: appearance)
 *
 * `visibilityProducts` returns the cached producer values. A palette, weight, material, depth cue, hidden-line policy or
 * colour edit reuses every one of them (identical objects); a camera edit reuses the mesh and the view-independent
 * classes (creases, rim, sections, contours) and recomputes silhouettes and visibility; a structural edit (shape, angle,
 * spacing, levels, light for hatch) recomputes exactly the classes that depend on it. A class set to Removed is not
 * computed; Visible only and Hidden dashed share one computation (the hidden runs are always returned).
 *
 * Output: for every class the projected visible and hidden `ProjectedPath`s (canvas units, per-point camera depth,
 * `visible` label, source curve id), the hatch strokes and the painter-ordered fill polygons. Any of these can be handed to
 * `strokeWith` / `atEach` with other materials; `drawVisibilityProducts` accepts replacement materials per class.
 *
 * Tones (palette entries): with `colorBy` "class" silhouette 0, creases 1, rim 2, sections 3, contours 4, hatch 0; "ink" uses 0
 * everywhere. The layer is transparent: only marks and, for a Filled tone, the opaque projected faces of the object.
 * Drawing work is charged to the run (default 1,500,000 units: one per stroke plus stitches or beads); over it the draw throws
 * naming the controls to change.
 */
export type ClassName = "silhouette" | "crease" | "boundary" | "sections" | "contours";
export const classNames: readonly ClassName[] = ["silhouette", "crease", "boundary", "sections", "contours"];
export type ClassMode = "off" | "visible" | "dashed";
export type LineMaterial = "ink" | "stitch" | "beads";
export type Shading = "none" | "hatch" | "fill" | "fill-hatch";
export type DepthCue = "none" | "weight" | "opacity" | "both";
export type ColorBy = "class" | "ink";

export interface ClassStyle { readonly mode: ClassMode; readonly material: LineMaterial; readonly weight: number }

export interface VisibilityDrawingRecipe {
  kind: "visibility-drawing";
  seed: number;
  palette: readonly number[];
  scene: VisibilitySceneOptions;
  view: ViewRule;
  silhouette: ClassStyle;
  crease: ClassStyle & CreaseRule;
  boundary: ClassStyle;
  sections: ClassStyle & SectionRule;
  contours: ClassStyle & ContourRule;
  tone: {
    shading: Shading;
    hatch: ClassStyle & { spacing: number; angle: number; families: number; bare: number };
    fill: { color: number; pale: number; bands: number; shade: number };
    light: LightRule;
  };
  lines: { colorBy: ColorBy; depthCue: DepthCue; cueAmount: number; hiddenOpacity: number; hiddenWeight: number; hiddenDash: number; stitchSpacing: number; beadScale: number };
}

type Scalar = number | string | boolean;
const definition = visibilityDrawingDefinition;
const DEFAULT_DRAW_WORK = 1_500_000;

/** Resolve stored scalar controls to the public composition value. */
export function visibilityDrawingComposition(input: InstrumentInput): VisibilityDrawingRecipe {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const num = (key: string) => q[key] as number;
  const style = (mode: string, material: string, weight: string): ClassStyle => ({ mode: q[mode] as ClassMode, material: q[material] as LineMaterial, weight: num(weight) });
  return {
    kind: "visibility-drawing", seed: input.seed, palette: [...input.palette],
    scene: { shape: q.shape as VisibilityShape, detail: num("detail"), terrainVariant: q.terrainVariant as string, vaseProfile: q.vaseProfile as string, seed: input.seed },
    view: { projection: q.projection as ViewRule["projection"], yaw: num("yaw"), pitch: num("pitch"), roll: num("roll"), distance: num("distance"), centerX: num("centerX"), centerY: num("centerY"), size: num("size") },
    silhouette: style("silhouette", "silhouetteMaterial", "silhouetteWeight"),
    crease: { ...style("crease", "creaseMaterial", "creaseWeight"), angle: num("creaseAngle"), convexity: q.creaseKind as Convexity },
    boundary: style("boundary", "boundaryMaterial", "boundaryWeight"),
    sections: { ...style("sections", "sectionMaterial", "sectionWeight"), axis: q.sectionAxis as SectionRule["axis"], tilt: num("sectionTilt"), spacing: num("sectionSpacing"), offset: num("sectionOffset") },
    contours: { ...style("contours", "contourMaterial", "contourWeight"), field: q.contourField as ContourRule["field"], levels: num("contourLevels") },
    tone: {
      shading: q.shading as Shading,
      hatch: { mode: "visible", material: q.hatchMaterial as LineMaterial, weight: num("hatchWeight"), spacing: num("hatchSpacing"), angle: num("hatchAngle"), families: num("hatchFamilies"), bare: num("hatchBare") },
      fill: { color: num("fillColor"), pale: num("fillPale"), bands: num("fillBands"), shade: num("fillShade") },
      light: { azimuth: num("lightAzimuth"), elevation: num("lightElevation"), ambient: num("ambient"), smooth: q.shadeNormals === "smooth" },
    },
    lines: { colorBy: q.colorBy as ColorBy, depthCue: q.depthCue as DepthCue, cueAmount: num("cueAmount"), hiddenOpacity: num("hiddenOpacity"), hiddenWeight: num("hiddenWeight"),
      hiddenDash: num("hiddenDash"), stitchSpacing: num("stitchSpacing"), beadScale: num("beadScale") },
  };
}

/** Whether the seed can change this construction (the terrain and the assembly are seeded). */
export function visibilityDrawingUsesSeed(q: Record<string, Scalar>): boolean {
  return sceneUsesSeed(q.shape as VisibilityShape);
}

export interface ClassProduct {
  readonly name: ClassName;
  /** Candidate 3D curves of the class before visibility. */
  readonly curves: number;
  readonly visible: readonly ProjectedPath[];
  readonly hidden: readonly ProjectedPath[];
}
export interface VisibilityProducts {
  readonly mesh: Mesh;
  readonly camera: Camera;
  readonly depth: DepthRange;
  /** The classes that are not Removed, in drawing order of `classNames`. */
  readonly classes: readonly ClassProduct[];
  readonly hatch: HatchResult | null;
  readonly fill: PaintedFaces | null;
}

const EMPTY_PATHS: CurvePaths = Object.freeze({ visible: Object.freeze([]), hidden: Object.freeze([]), stats: Object.freeze({ segments: 0, occluders: 0, tests: 0, nodes: 0, work: 0, clippedSegments: 0, edgeOnRuns: 0, tolerance: 0 }) });
const CONTROLS: Record<ClassName, string> = { silhouette: "Detail", crease: "Detail or Crease angle", boundary: "Detail", sections: "Section spacing or Detail", contours: "Contour levels or Detail" };

/** The producer values the consumers read; each is cached by its own construction. */
export function visibilityProducts(recipe: VisibilityDrawingRecipe): VisibilityProducts {
  const mesh = visibilityMesh(recipe.scene), view = viewCamera(mesh, recipe.view);
  const classes: ClassProduct[] = [];
  const silhouette = recipe.silhouette.mode !== "off" ? silhouetteEdges(mesh, view) : [];
  const push = (name: ClassName, curves: readonly { id: string }[]) => {
    const paths = curves.length === 0 ? EMPTY_PATHS : curvePaths(mesh, curves as never, view, name, CONTROLS[name]);
    classes.push(Object.freeze({ name, curves: curves.length, visible: paths.visible, hidden: paths.hidden }));
  };
  if (recipe.silhouette.mode !== "off") push("silhouette", edgeCurves(mesh, silhouette));
  if (recipe.crease.mode !== "off") push("crease", creaseCurvesExcluding(mesh, recipe.crease, silhouette));
  if (recipe.boundary.mode !== "off") push("boundary", edgeCurves(mesh, boundaryEdges(mesh)));
  if (recipe.sections.mode !== "off") push("sections", sectionCurves(mesh, recipe.sections).curves);
  if (recipe.contours.mode !== "off") push("contours", contourCurves(mesh, recipe.contours).curves);
  const { shading, hatch, light } = recipe.tone;
  return Object.freeze({
    mesh, camera: view, depth: depthRange(mesh, view), classes: Object.freeze(classes),
    hatch: shading === "hatch" || shading === "fill-hatch" ? tonedHatch(mesh, view, { spacing: hatch.spacing, angle: hatch.angle, families: hatch.families, threshold: hatch.bare, light }) : null,
    fill: shading === "fill" || shading === "fill-hatch" ? paintedFaces(mesh, view) : null,
  });
}

// ---------------------------------------------------------------------------------------------
// Drawing

/** Scales the alpha of every fill and stroke a material sets: the surface a depth-cued or hidden line is drawn on. */
class AlphaSurface implements CompositionSurface {
  constructor(private readonly base: CompositionSurface, private readonly factor: number) {}
  get CLOSE() { return this.base.CLOSE; }
  get ROUND() { return this.base.ROUND; }
  push() { this.base.push(); } pop() { this.base.pop(); }
  translate(x: number, y: number) { this.base.translate(x, y); }
  rotate(r: number) { this.base.rotate(r); }
  scale(x: number, y?: number) { this.base.scale(x, y); }
  noFill() { this.base.noFill(); } noStroke() { this.base.noStroke(); }
  private scaled(channels: number[]): number[] { return channels.length === 4 ? [channels[0], channels[1], channels[2], channels[3] * this.factor] : channels.length === 3 ? [...channels, 255 * this.factor] : channels; }
  fill(...channels: number[]) { this.base.fill(...this.scaled(channels)); }
  stroke(...channels: number[]) { this.base.stroke(...this.scaled(channels)); }
  strokeWeight(w: number) { this.base.strokeWeight(w); }
  strokeCap(cap: unknown) { this.base.strokeCap(cap); }
  circle(x: number, y: number, d: number) { this.base.circle(x, y, d); }
  line(a: number, b: number, c: number, d: number) { this.base.line(a, b, c, d); }
  rect(x: number, y: number, w: number, h: number) { this.base.rect(x, y, w, h); }
  beginShape() { this.base.beginShape(); } vertex(x: number, y: number) { this.base.vertex(x, y); }
  endShape(mode?: unknown) { this.base.endShape(mode); }
}

/** Palette entry of a class. */
export const classTone = (mode: ColorBy, name: ClassName | "hatch"): number => (mode === "ink" ? 0 : name === "crease" ? 1 : name === "boundary" ? 2 : name === "sections" ? 3 : name === "contours" ? 4 : 0);

/** Weight or opacity multiplier of a depth bin: 1 at the near end falling to `1 - 0.85 * amount` at the far end. */
export const cueFactor = (amount: number, bin: number): number => 1 - 0.85 * amount * (bin + 0.5) / CUE_STEPS;

/** Replace the built-in material of a class's visible strokes; the depth cue still cuts strokes by depth, but weight is yours. */
export interface VisibilityConsumers { materials?: Partial<Record<ClassName | "hatch", PathMaterial>> }

function lineSpec(recipe: VisibilityDrawingRecipe, kind: LineMaterial, weight: number, hidden: boolean): PathMaterialSpec {
  const { hiddenDash, stitchSpacing, beadScale } = recipe.lines;
  const size = weight * beadScale;
  return { kind: hidden ? "stitch" : kind, weight, spacing: hidden ? hiddenDash : stitchSpacing, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
    mark: { kind: "dot", size, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } };
}

/** Draw already-built producer values; `consumers` replace built-in materials. */
export function drawVisibilityProducts(surface: CompositionSurface, recipe: VisibilityDrawingRecipe, products: VisibilityProducts, consumers: VisibilityConsumers, run: CompositionRun): void {
  const { palette, lines } = recipe;
  const perspective = products.camera.options.projection === "perspective";
  const weightCue = lines.depthCue === "weight" || lines.depthCue === "both", opacityCue = lines.depthCue === "opacity" || lines.depthCue === "both";
  const surfaces = new Map<number, CompositionSurface>([[1, surface]]);
  const surfaceFor = (factor: number): CompositionSurface => {
    const key = Math.round(factor * 1000) / 1000;
    if (key >= 1) return surface;
    let found = surfaces.get(key);
    if (!found) { found = new AlphaSurface(surface, key); surfaces.set(key, found); }
    return found;
  };
  const materialCache = new Map<string, PathMaterial | null>();
  const drawPaths = (paths: readonly ProjectedPath[], name: ClassName | "hatch", style: ClassStyle, hidden: boolean): void => {
    if (paths.length === 0 || style.weight === 0) return;
    const tone = classTone(lines.colorBy, name), custom = hidden ? undefined : consumers.materials?.[name];
    const cueing = lines.depthCue !== "none" && lines.cueAmount > 0;
    for (const path of paths) {
      const pieces = cueing ? splitByDepth(path, products.depth, perspective) : [{ points: path.points, bin: 0, closed: path.closed }];
      pieces.forEach((piece, index) => {
        const factor = cueing ? cueFactor(lines.cueAmount, piece.bin) : 1;
        const weight = style.weight * (weightCue ? factor : 1) * (hidden ? lines.hiddenWeight : 1);
        const alpha = (opacityCue ? factor : 1) * (hidden ? lines.hiddenOpacity : 1);
        const bin = weightCue ? piece.bin : 0;
        let material: PathMaterial | null | undefined = custom;
        if (!material) {
          const key = `${name}|${hidden}|${bin}`;
          if (!materialCache.has(key)) materialCache.set(key, weight < 0.05 ? null : pathMaterial(lineSpec(recipe, style.material, weight, hidden), palette));
          material = materialCache.get(key);
        }
        if (!material) return;
        const drawn: Path = { id: `${path.id}/${index}`, seed: path.seed, points: piece.points, closed: piece.closed, level: 0, levelFraction: 0, tone };
        strokeWith(surfaceFor(alpha), [drawn], material, run);
      });
    }
  };
  if (products.fill) {
    const { color: base, pale, bands, shade } = recipe.tone.fill, { light } = recipe.tone, lit = triangleLit(products.mesh, light);
    const rgb = palette[base % palette.length] >>> 0, lift = (channel: number) => channel + (255 - channel) * pale, r = lift((rgb >>> 16) & 255), g = lift((rgb >>> 8) & 255), b = lift(rgb & 255);
    const fill = products.fill;
    run.enter(fill.polygons.length);
    try {
      surface.strokeWeight(0.8);
      for (let i = 0; i < fill.polygons.length; i++) {
        if ((i & 1023) === 0) run.check();
        const dark = darkness(fill.front[i] ? lit[fill.triangles[i]] : -lit[fill.triangles[i]], light.ambient);
        const tone = bands > 0 ? (Math.floor(Math.min(dark, 0.999999) * bands) + 0.5) / bands : dark;
        const k = 1 - shade * tone;
        const [cr, cg, cb] = [Math.round(r * k), Math.round(g * k), Math.round(b * k)];
        surface.fill(cr, cg, cb, 255); surface.stroke(cr, cg, cb, 255);
        surface.beginShape();
        const poly = fill.polygons[i];
        for (let v = 0; v < poly.length; v += 2) surface.vertex(poly[v], poly[v + 1]);
        surface.endShape(surface.CLOSE);
      }
    } finally { run.leave(); }
  }
  if (products.hatch) drawPaths(products.hatch.paths, "hatch", recipe.tone.hatch, false);
  const by = new Map(products.classes.map((c) => [c.name, c]));
  const order: ClassName[] = ["contours", "sections", "crease", "boundary", "silhouette"];
  // hidden runs first so a visible stroke is never covered by a dash
  for (const name of order) { const c = by.get(name); if (c && recipe[name].mode === "dashed") drawPaths(c.hidden, name, recipe[name], true); }
  for (const name of order) { const c = by.get(name); if (c) drawPaths(c.visible, name, recipe[name], false); }
}

/** Draw the recipe into a caller-owned surface; transparent layer, no clearing. */
export function drawVisibilityDrawing(surface: CompositionSurface, recipe: VisibilityDrawingRecipe, consumers: VisibilityConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: DEFAULT_DRAW_WORK })): void {
  run.check();
  const products = visibilityProducts(recipe);
  try { drawVisibilityProducts(surface, recipe, products, consumers, run); }
  catch (error) {
    if ((error as Error).message === "Composition work budget exceeded")
      throw new Error("Visibility Drawing needs more drawing work than its budget of " + DEFAULT_DRAW_WORK + " units (one per stroke plus stitches or beads). Raise Station spacing or Hatch spacing, lower Contour levels or Detail, or use Ink");
    throw error;
  }
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the producers stage by stage, yielding between stages; false if cancelled. */
export async function prepareVisibilityDrawing(recipe: VisibilityDrawingRecipe, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const mesh = visibilityMesh(recipe.scene);
  viewCamera(mesh, recipe.view);
  await yieldToHost();
  if (cancelled()) return false;
  visibilityProducts(recipe);
  return !cancelled();
}

