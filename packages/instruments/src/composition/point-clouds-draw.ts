import { pointCloudsDefinition } from "../adapters/point-clouds-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import type { Camera } from "./camera.js";
import { atEach, createCompositionRun, strokeWith } from "./core.js";
import { pathMaterial, tonedMaterial } from "./materials.js";
import type { Mesh } from "./mesh.js";
import type { PointCloud } from "./mesh-sample.js";
import { describePointCloud } from "./point-structure.js";
import { cutMesh, cutPoints, dispersePoints, keepPoints, pointFrame, type CutSpec, type FocusSpec, type Kept, type KeepSpec, type PointFrame, type ThinRule } from "./point-select.js";
import { isMeshSubject, pointSubject, type GalaxySpec, type NoiseSpec, type PointSubject, type SubjectKind, type SubjectSpec } from "./point-subjects.js";
import { linkMaterial, markSites, paletteRamp, medianSpacing, pointToner, stockMark, type AxisKind, type Blend, type ColorBy, type MarkKind, type MarkStyle, type PointMark, type PointSite } from "./point-marks.js";
import { linkPaths, outlinePaths, pointCamera, pointLinks, viewPoints, type LinkPath, type LinkSet, type Outline, type PointView, type ViewSpec } from "./point-view.js";
import { memoized } from "./sources.js";
import type { CompositionRun, CompositionSurface, MotifSpec, Path, PathMaterial, PathMaterialSpec } from "./types.js";
import type { ProjectedPath } from "./visibility.js";

/**
 * Point Clouds as a typed, JSON-compatible composition over the F8 point-cloud foundation, one public function per stage:
 *
 *   pointSubject -> describePointCloud -> cutPoints -> keepPoints -> dispersePoints -> pointLinks      (construction)
 *   pointCamera -> viewPoints -> markSites / linkPaths / outlinePaths -> stock consumers               (camera, then appearance)
 *
 * `pointCloudProducts(recipe)` returns the construction values, cached by the construction fields alone: the subject
 * (and only the fields its kind reads), neighbour count, cut, thinning, focus, dispersion and links. Camera, palette,
 * marks, sizes, fade, colour, outline and every other appearance choice are not part of that key, so editing them returns
 * the SAME frozen products and recomputes nothing (tested by object identity). `pointCloudScene` is the camera stage:
 * projection, hidden-point removal, mark sites, link and outline paths; a palette-only or mark-only edit reuses the
 * cached view. Fields a choice makes irrelevant are normalised away before the key (no dense region when it is off, no
 * rule strength for the uniform rule, no cut plane when not cutting, no occluder for a subject without a surface), which is
 * what makes a hidden control unable to change the drawing.
 *
 * Only bundled subjects are named here. Host binding of a user's own mesh or scan is future work; a typed `PointCloud`
 * (`pointCloud(...)`, or the samples of a typed mesh) goes through `describePointCloud`, `cutPoints`, `keepPoints`,
 * `dispersePoints`, `viewPoints`, `markSites` and `drawPointCloudScene` with the same consumers. No scan is reconstructed,
 * registered or completed, and no missing geometry is inferred.
 *
 * Consumers (`PointCloudConsumers`) replace the stock mark, link material or outline material with ordinary callbacks:
 * marks receive a `PointSite` (a `Site` with tone, opacity, depth, projected axis length, disc outline), links and outline
 * runs receive `Path`s. Marks and links are painted in ONE far-to-near sequence (`sort`), so a near mark covers a far link
 * and a near link crosses a far mark; the outline is a separate visible-line pass on top. Work is charged to the run
 * (3,000,000 units by default: one per mark, link and outline run, plus the stock materials' own).
 */
type Scalar = number | string | boolean;
const definition = pointCloudsDefinition;

/** Work bound of a whole drawing: marks + links + outline runs above this throw naming Points. */
export const MAX_DRAWN_ITEMS = 250_000;
const DEFAULT_WORK = 3_000_000;
/** Links are painted as if this many median point spacings nearer the eye: a link lying on the surface stays above the grains around it, and is still covered by anything in front of the surface. */
export const LINK_LIFT = 2.5;

export interface PointCloudsComposition {
  kind: "point-clouds";
  seed: number;
  palette: readonly number[];
  subject: SubjectSpec;
  neighbors: number;
  cut: CutSpec;
  keep: KeepSpec;
  dispersion: { amount: number; bias: number };
  marks: { style: MarkStyle };
  depth: { sort: boolean; hideBack: boolean; hideBehind: boolean };
  links: { mode: "none" | "nearest"; neighbors: number; reach: number; nodes: number; weight: number; color: "cloud" | "ink" };
  outline: { mode: "none" | "silhouette" | "features"; material: "ink" | "stitch" | "beads"; crease: number; weight: number; hidden: "drop" | "dashed" };
  view: ViewSpec;
}

/** Resolve stored scalar controls to the public composition value. */
export function pointCloudsComposition(input: InstrumentInput): PointCloudsComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const num = (key: string): number => q[key] as number;
  const kind = q.subject as SubjectKind, surfaced = isMeshSubject(kind);
  const galaxy: GalaxySpec = { arms: num("arms"), twist: num("twist"), bulge: num("bulge"), thickness: num("thickness"), looseness: num("looseness") };
  const noise: NoiseSpec = { scale: num("noiseScale"), contrast: num("noiseContrast"), octaves: num("noiseOctaves") };
  const rule = q.thinRule as ThinRule;
  const focus: FocusSpec | null = q.focus === "ball" ? { center: [num("focusX"), num("focusY"), num("focusZ")], radius: num("focusRadius"), falloff: num("focusFalloff") } : null;
  const cutting = q.cut !== "none", outline = surfaced ? q.outline as "none" | "silhouette" | "features" : "none";
  const links = q.links === "nearest";
  return {
    kind: "point-clouds", seed: input.seed, palette: [...input.palette],
    subject: { kind, seed: input.seed, count: num("count"), distribution: q.distribution as "even" | "random", vase: q.vaseProfile as SubjectSpec["vase"], terrain: q.terrainVariant as SubjectSpec["terrain"], galaxy, noise },
    neighbors: num("neighbors"),
    cut: { axis: q.cut as CutSpec["axis"], at: cutting ? num("cutAt") : 0, flip: cutting ? q.cutFlip as boolean : false },
    keep: { fraction: num("keep"), rule, bias: rule === "uniform" ? 0 : num("thinBias"), focus },
    dispersion: { amount: num("dispersion"), bias: num("dispersionBias") },
    marks: { style: {
      mark: q.mark as MarkKind, size: num("markSize"), weight: num("markWeight"), petals: num("petals"), opening: num("opening"),
      axis: q.axis as AxisKind, axisTurn: num("axisTurn"), axisJitter: num("axisJitter"), localScale: num("localScale"), opacity: num("opacity"),
      sizeByDepth: num("sizeByDepth"), fade: num("fade"), colorBy: q.colorBy as ColorBy, blend: q.blend as Blend } },
    depth: { sort: q.sort as boolean, hideBack: q.hideBack as boolean, hideBehind: surfaced && (q.hideBehind as boolean) },
    links: { mode: links ? "nearest" : "none", neighbors: num("linkNeighbors"), reach: num("linkReach"), nodes: num("linkNodes"), weight: num("linkWeight"), color: q.linkColor as "cloud" | "ink" },
    outline: { mode: outline, material: q.outlineMaterial as "ink", crease: num("creaseAngle"), weight: num("outlineWeight"), hidden: q.outlineHidden as "drop" },
    view: { projection: q.projection as ViewSpec["projection"], yaw: num("yaw"), pitch: num("pitch"), roll: num("roll"), perspective: num("perspective"), fit: num("fit"), centerX: num("centerX"), centerY: num("centerY") },
  };
}

/** Whether the seed can change this construction: always (it decides where every point falls). */
export function pointCloudsUsesSeed(_q: Record<string, Scalar>): boolean { return true; }

export interface PointCloudProducts {
  readonly subject: PointSubject;
  readonly frame: PointFrame;
  /** The subject's cloud with the estimated attributes. */
  readonly described: PointCloud;
  readonly kept: Kept;
  /** The kept points after dispersion: what every view draws. */
  readonly cloud: PointCloud;
  readonly links: LinkSet | null;
  /** The source surface cut like the points, or null for a subject without one. */
  readonly occluder: Mesh | null;
}

const productCache = new Map<string, PointCloudProducts>();
const frames = new WeakMap<PointCloud, PointFrame>();

function subjectFrame(subject: PointSubject): PointFrame {
  let hit = frames.get(subject.cloud);
  if (!hit) { hit = pointFrame(subject.cloud); frames.set(subject.cloud, hit); }
  return hit;
}

/** The construction values, cached by construction alone (see the module header). */
export function pointCloudProducts(recipe: PointCloudsComposition): PointCloudProducts {
  const { subject: spec, cut, keep, dispersion, links } = recipe;
  const key = JSON.stringify([spec.kind, spec.seed, spec.count, spec.kind === "figure" || spec.kind === "torus" ? spec.distribution : spec.kind === "vase" ? [spec.distribution, spec.vase] : spec.kind === "terrain" ? [spec.distribution, spec.terrain] : spec.kind === "galaxy" ? spec.galaxy : spec.noise,
    recipe.neighbors, cut, keep, dispersion, links.mode === "nearest" ? [links.neighbors, links.reach, links.nodes] : null]);
  return memoized(productCache, key, () => {
    const subject = pointSubject(spec), frame = subjectFrame(subject);
    const described = describePointCloud(subject.cloud, { neighbors: recipe.neighbors });
    const kept = keepPoints(cutPoints(described, cut, frame), keep, frame);
    const cloud = dispersePoints(kept.cloud, dispersion);
    return Object.freeze({
      subject, frame, described, kept, cloud,
      links: links.mode === "nearest" && cloud.count > 1 ? pointLinks(cloud, { neighbors: links.neighbors, reach: links.reach, nodes: links.nodes }) : null,
      occluder: subject.mesh ? cutMesh(subject.mesh, cut, frame) : null,
    });
  });
}

export interface PointCloudScene {
  readonly camera: Camera;
  readonly view: PointView;
  readonly sites: readonly PointSite[];
  readonly links: readonly LinkPath[];
  readonly outline: Outline | null;
}

/** The camera stage: projection, hidden-point removal, mark sites, link paths, outline. */
export function pointCloudScene(recipe: PointCloudsComposition, products: PointCloudProducts): PointCloudScene {
  const camera = pointCamera(products.frame, recipe.view), { depth, outline } = recipe;
  const view = viewPoints(products.cloud, camera, products.frame, {
    order: depth.sort ? "far-to-near" : "index", hideBack: depth.hideBack, occluder: depth.hideBehind ? products.occluder : null });
  const sites = markSites(products.cloud, view.points, camera, recipe.marks.style, recipe.palette.length);
  let links: LinkPath[] = [];
  if (products.links && products.links.links.length) {
    const toneOf = pointToner(products.cloud, recipe.marks.style.colorBy, recipe.marks.style.blend, recipe.palette.length);
    const tones = new Map(view.points.map((v) => [v.index, toneOf(v)]));
    links = linkPaths(products.cloud, products.links, view.points).map((p) => Object.freeze({ ...p,
      tone: recipe.links.color === "ink" ? 0 : Math.round((tones.get(p.a)! + tones.get(p.b)!) / 2) }));
    const lift = LINK_LIFT * medianSpacing(products.cloud);
    links = links.map((p) => Object.freeze({ ...p, order: p.depth - lift }));
    if (recipe.depth.sort) links.sort((a, b) => b.order! - a.order! || (a.id < b.id ? -1 : 1));
  }
  const lines = outline.mode !== "none" && products.occluder ? outlinePaths(products.occluder, camera, { mode: outline.mode, crease: outline.crease }) : null;
  return Object.freeze({ camera, view, sites, links, outline: lines });
}

/** Replace any stock consumer with an ordinary callback. */
export interface PointCloudConsumers { mark?: PointMark; link?: PathMaterial; outline?: PathMaterial; hiddenOutline?: PathMaterial }

const dot: MotifSpec = { kind: "dot", size: 2, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 };
function outlineMaterial(recipe: PointCloudsComposition, hidden: boolean): PathMaterial {
  const { material, weight } = recipe.outline;
  const spec: PathMaterialSpec = hidden
    ? { kind: "stitch", weight: weight * 0.7, spacing: 6, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark: dot }
    : { kind: material, weight, spacing: 7, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark: { ...dot, size: Math.max(0.5, weight * 2.4) } };
  return tonedMaterial(pathMaterial(spec, recipe.palette), 0);
}

/** Draw already-built producer values; the composition chooses the stock consumers, `consumers` replace them. */
export function drawPointCloudScene(surface: CompositionSurface, recipe: PointCloudsComposition, scene: PointCloudScene, consumers: PointCloudConsumers, run: CompositionRun): void {
  const ramp = paletteRamp(recipe.palette), style = recipe.marks.style;
  const items = scene.sites.length + scene.links.length + (scene.outline ? scene.outline.visible.length + scene.outline.hidden.length : 0);
  if (items > MAX_DRAWN_ITEMS) throw new Error(`${items} marks, links and outline runs exceed ${MAX_DRAWN_ITEMS}; lower Points, Link neighbors or Link nodes`);
  const mark = consumers.mark ?? stockMark(style, ramp);
  const link = consumers.link ?? linkMaterial({ weight: recipe.links.weight, opacity: 1, fade: style.fade, sizeByDepth: style.sizeByDepth }, ramp);
  const { sites, links } = scene;
  if (!recipe.depth.sort) {
    if (links.length) strokeWith(surface, links, link, run);
    if (sites.length) atEach(surface, sites, mark, run);
  } else {
    // One far-to-near sequence: sites arrive far to near from the view, links are sorted alike.
    let s = 0, l = 0;
    while (s < sites.length || l < links.length) {
      run.check();
      const takeSite = l >= links.length || (s < sites.length && sites[s].depth >= links[l].order!);
      if (takeSite) atEach(surface, [sites[s++]], mark, run);
      else strokeWith(surface, [links[l++]], link, run);
    }
  }
  if (scene.outline) {
    const draw = (paths: readonly ProjectedPath[], material: PathMaterial): void => { if (paths.length) strokeWith(surface, paths as readonly Path[], material, run); };
    if (recipe.outline.hidden === "dashed") draw(scene.outline.hidden, consumers.hiddenOutline ?? outlineMaterial(recipe, true));
    draw(scene.outline.visible, consumers.outline ?? outlineMaterial(recipe, false));
  }
}

/** Draw the recipe into a caller-owned surface; transparent layer, no clearing. */
export function drawPointClouds(surface: CompositionSurface, recipe: PointCloudsComposition, consumers: PointCloudConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: DEFAULT_WORK })): void {
  run.check();
  const products = pointCloudProducts(recipe);
  drawPointCloudScene(surface, recipe, pointCloudScene(recipe, products), consumers, run);
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the stages one at a time, yielding between them; false if cancelled. */
export async function preparePointClouds(recipe: PointCloudsComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  pointSubject(recipe.subject);
  await yieldToHost();
  if (cancelled()) return false;
  const products = pointCloudProducts(recipe);
  await yieldToHost();
  if (cancelled()) return false;
  pointCloudScene(recipe, products);
  return !cancelled();
}
