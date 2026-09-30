import { chaikinPolyline2D } from "@procedurals/javascript";
import { laplacianFrontsDefinitions, growthSpecOf, laplacianFrontsUsesSeed } from "../adapters/laplacian-fronts-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { atEach, componentSeed, createCompositionRun, strokeWith } from "./core.js";
import { equipotentialPaths, frontOutlines, frontPaths, growthDiagnostics, growthSnapshots, lastActiveStep, prepareGrowth } from "./laplacian-growth.js";
import type { GrowthDiagnostics, GrowthSnapshots, GrowthSpec } from "./laplacian-growth.js";
import { ageSites, tipSites } from "./laplacian-marks.js";
import type { GrowthSite } from "./laplacian-marks.js";
import { motif, pathMaterial, tonedMaterial } from "./materials.js";
import { paletteRamp } from "./slit.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, Path, PathMaterial, PathMaterialSpec, Point } from "./types.js";

/**
 * Laplacian Fronts (brief 16): the construction is `laplacian-growth.ts` (potential solve, flux-driven advancement,
 * retained fronts) and everything here reads that one run. Four treatments of the same snapshot:
 *
 * - FRONTS: the fronts of chosen steps as `strokeWith` paths through the existing path materials (ink, stitch, beads), each
 *   tinted by its age along the palette; the newest drawn front can be heavier.
 * - FILL: the final region as one flat tone, or as bands (painter's order, the newest and largest first) whose tone is the
 *   age of the front that bounded them; holes (pockets) stay open through keyhole outlines.
 * - MARKS: motifs at age sites (a lattice over the occupied region, size and tone by age) or at the tips (local speed maxima,
 *   pointing the way the front runs), through the existing `motif` mark.
 * - POTENTIAL LINES: equipotentials of the final potential, the field the growth followed.
 *
 * Appearance (materials, palette, which fronts, fill, marks, potential levels) never enters the growth's content key, so a
 * recolour or a change of which fronts are drawn repaints the SAME snapshot object.
 * Age tones: the palette is sampled at `RAMP` stops by piecewise-linear interpolation (`paletteRamp`) and a front or band of age
 * fraction `a` uses stop `round(a (RAMP − 1))`; `a = step / lastActiveStep`.
 * Seeds: the growth's structural seed is the instrument seed only where it can matter (noise, clustered seed discs, walls and
 * pillars); otherwise 0, so seeds that cannot differ share one run.
 */

const definition = laplacianFrontsDefinitions[0];
type Scalar = number | string | boolean;

export const RAMP = 12;
/** Vertices of the fronts one drawing may stroke, after smoothing. */
export const MAX_DRAWN_VERTICES = 1_500_000;
export const MAX_MARK_SITES = 30_000;

export interface FrontStrokes {
  material: PathMaterialSpec;
  /** Draw every this-many-th step's front (the last one of the window is always drawn). */
  every: number;
  /** Window of fronts as fractions of `lastActiveStep`. */
  from: number; to: number;
  /** Stroke width of the last drawn front; 0 draws it like the others. */
  finalWeight: number;
  smooth: number;
}
export interface FillView { mode: "flat" | "bands"; opacity: number; bands: number }
export interface MarksView { source: "age" | "tips"; mark: MotifSpec; spacing: number; threshold: number }
export interface PotentialView { levels: number; weight: number }

export interface LaplacianFrontsComposition {
  kind: "laplacian-fronts";
  seed: number;
  palette: readonly number[];
  steps: number;
  /** The construction: everything that decides the run. */
  growth: GrowthSpec;
  fronts: FrontStrokes | null;
  fill: FillView | null;
  marks: MarksView | null;
  potential: PotentialView | null;
}

/** One band of the fill: `tone` is the age fraction of the front that bounds it. */
export interface FillBand { index: number; count: number; step: number; tone: number }
export type BandFill = (surface: CompositionSurface, outline: readonly (readonly Point[])[], band: FillBand, run: CompositionRun) => void;
/** Replace any consumer of `drawLaplacianFronts` with an ordinary callback. */
export interface LaplacianConsumers { front?: PathMaterial; finalFront?: PathMaterial; potential?: PathMaterial; mark?: Mark; fill?: BandFill }

/** Resolve stored scalar controls to the public composition value. */
export function laplacianFrontsComposition(input: InstrumentInput): LaplacianFrontsComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Instrument seed must be a uint32");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((color) => !Number.isSafeInteger(color) || color < 0 || color > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const kind = q.frontMaterial as string, num = (key: string): number => q[key] as number;
  const dot = (size: number): MotifSpec => ({ kind: "dot", size, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 });
  return {
    kind: "laplacian-fronts", seed: input.seed, palette: [...input.palette], steps: num("steps"),
    growth: growthSpecOf(q),
    fronts: kind === "none" ? null : {
      material: { kind: kind as PathMaterialSpec["kind"], weight: num("frontWeight"), spacing: num("frontSpacing"), phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
        mark: dot(kind === "beads" ? num("frontBeadSize") : 1) },
      every: num("frontEvery"), from: num("frontFrom"), to: num("frontTo"), finalWeight: num("finalWeight"), smooth: num("frontSmooth"),
    },
    fill: q.fill === "none" ? null : { mode: q.fill as "flat" | "bands", opacity: num("fillOpacity"), bands: num("fillBands") },
    marks: q.marks === "none" ? null : {
      source: q.marks as "age" | "tips", spacing: num("markSpacing"), threshold: num("tipThreshold"),
      mark: { kind: q.markKind as MotifSpec["kind"], size: num("markSize"), petals: 6, opening: 0.25, weight: 1, rotation: 0, variation: 0, retention: num("markRetention") },
    },
    potential: q.potential === "none" ? null : { levels: num("potentialLines"), weight: num("potentialWeight") },
  };
}

/** The seed the growth uses: the instrument seed only where it can change the construction. */
export function growthSeedOf(recipe: Pick<LaplacianFrontsComposition, "seed" | "growth">): number {
  const g = recipe.growth;
  return g.noise > 0 || g.seedShape === "cluster" || g.barrier !== "none" ? recipe.seed : 0;
}

export { laplacianFrontsUsesSeed };

/** The steps whose fronts are drawn: from `round(from last)` every `every` steps to `round(to last)`, which is always included. */
export function frontSteps(last: number, view: Pick<FrontStrokes, "every" | "from" | "to">): number[] {
  const start = Math.round(view.from * last), end = Math.max(start, Math.round(view.to * last)), steps: number[] = [];
  for (let s = start; s <= end; s += view.every) steps.push(s);
  if (steps[steps.length - 1] !== end) steps.push(end);
  return steps;
}

/** The steps that bound the age bands: `round(last (k + 1) / bands)` for k = 0 … bands − 1, without repeats. */
export function bandSteps(last: number, bands: number): number[] {
  const steps: number[] = [];
  for (let k = 0; k < bands; k++) { const s = Math.round(last * (k + 1) / bands); if (steps[steps.length - 1] !== s) steps.push(s); }
  return steps;
}

/** Everything the consumers read. */
export interface LaplacianFrontsProducts { readonly snapshots: GrowthSnapshots; readonly diagnostics: GrowthDiagnostics }

/** The cached producer values of a recipe: the same objects for the same construction, whatever the appearance. */
export function laplacianFrontsProducts(recipe: LaplacianFrontsComposition, run?: CompositionRun): LaplacianFrontsProducts {
  const snapshots = growthSnapshots(recipe.growth, growthSeedOf(recipe), recipe.steps, { run });
  return Object.freeze({ snapshots, diagnostics: growthDiagnostics(snapshots) });
}

const rampCache = new Map<string, readonly number[]>();
/** The palette sampled at `RAMP` stops. */
export function ageRamp(palette: readonly number[]): readonly number[] {
  const key = palette.join(",");
  let hit = rampCache.get(key);
  if (!hit) {
    hit = Object.freeze(Array.from({ length: RAMP }, (_, k) => { const [r, g, b] = paletteRamp(palette, k / (RAMP - 1)); return (r << 16) | (g << 8) | b; }));
    if (rampCache.size >= 16) rampCache.delete(rampCache.keys().next().value!);
    rampCache.set(key, hit);
  }
  return hit;
}
const toneOf = (fraction: number): number => Math.round(Math.min(1, Math.max(0, fraction)) * (RAMP - 1));

const smoothCache = new WeakMap<object, Map<number, Path>>();
function smoothed(path: Path, rounds: number): Path {
  if (rounds === 0 || path.points.length < 3) return path;
  let byRounds = smoothCache.get(path);
  if (!byRounds) { byRounds = new Map(); smoothCache.set(path, byRounds); }
  const hit = byRounds.get(rounds);
  if (hit) return hit;
  const points = chaikinPolyline2D({ points: path.points, closed: path.closed, iterations: rounds, maxWork: path.points.length * 2 ** (rounds + 2) + 16 }).points as unknown as Point[];
  const id = `${path.id}~s${rounds}`;
  const made: Path = Object.freeze({ id, seed: componentSeed(path.seed, id, "path"), closed: path.closed, level: path.level, levelFraction: path.levelFraction,
    points: Object.freeze(points.map((p) => Object.freeze([p[0], p[1]] as const))) });
  byRounds.set(rounds, made);
  return made;
}

/** The stroked fronts of a recipe: frozen paths tinted by age (the last window front separately, for its own weight). */
export function frontStrokes(recipe: LaplacianFrontsComposition, products: LaplacianFrontsProducts): { history: readonly Path[]; final: readonly Path[] } {
  const view = recipe.fronts!, last = lastActiveStep(products.snapshots);
  const steps = frontSteps(last, view), edge = steps[steps.length - 1];
  let vertices = 0;
  const history: Path[] = [], final: Path[] = [];
  for (const step of steps) for (const path of frontPaths(products.snapshots, step)) {
    vertices += path.points.length * 2 ** view.smooth;
    if (vertices > MAX_DRAWN_VERTICES)
      throw new Error(`The drawn fronts would need over ${MAX_DRAWN_VERTICES} vertices; raise Front interval, narrow First front / Last front or lower Front smoothing`);
    const tinted = { ...smoothed(path, view.smooth), tone: toneOf(path.levelFraction) };
    (step === edge && view.finalWeight > 0 ? final : history).push(tinted);
  }
  return { history, final };
}

function paintOutline(surface: CompositionSurface, outline: readonly (readonly Point[])[], rgb: number, alpha: number): void {
  surface.push();
  surface.noStroke();
  surface.fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, alpha);
  for (const ring of outline) {
    if (ring.length < 3) continue;
    surface.beginShape();
    for (const [x, y] of ring) surface.vertex(x, y);
    surface.endShape(surface.CLOSE);
  }
  surface.pop();
}

/** Draw the recipe into a caller-owned surface: fill, potential lines, fronts, then marks. */
export function drawLaplacianFronts(surface: CompositionSurface, recipe: LaplacianFrontsComposition,
  consumers: LaplacianConsumers = {}, run: CompositionRun = createCompositionRun({ maxWork: 400_000 })): void {
  run.check();
  const products = laplacianFrontsProducts(recipe, run), { snapshots } = products, last = lastActiveStep(snapshots);
  const ramp = ageRamp(recipe.palette);
  if (recipe.fill) {
    const { mode, opacity, bands } = recipe.fill, alpha = 255 * opacity;
    const steps = mode === "flat" ? [last] : bandSteps(last, bands);
    // Painter's order: the newest, largest region first, older bands on top.
    for (let k = steps.length - 1; k >= 0; k--) {
      run.check();
      const outline = frontOutlines(snapshots, steps[k]), tone = last > 0 ? steps[k] / last : 0;
      if (consumers.fill) consumers.fill(surface, outline, { index: k, count: steps.length, step: steps[k], tone }, run);
      else paintOutline(surface, outline, mode === "flat" ? recipe.palette[0] : ramp[toneOf(tone)], alpha);
    }
  }
  if (recipe.potential) {
    const levels = Array.from({ length: recipe.potential.levels }, (_, k) => (k + 1) / (recipe.potential!.levels + 1));
    const paths = equipotentialPaths(snapshots, levels);
    const line = consumers.potential ?? tonedMaterial(pathMaterial({ kind: "ink", weight: recipe.potential.weight, spacing: 4, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
      mark: { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } }, ramp), RAMP - 1);
    strokeWith(surface, paths, line, run);
  }
  if (recipe.fronts) {
    const { history, final } = frontStrokes(recipe, products);
    strokeWith(surface, history, consumers.front ?? pathMaterial(recipe.fronts.material, ramp), run);
    if (final.length) strokeWith(surface, final, consumers.finalFront ?? pathMaterial({ ...recipe.fronts.material, weight: recipe.fronts.finalWeight }, ramp), run);
  }
  if (recipe.marks) {
    const view = recipe.marks;
    const sites: readonly GrowthSite[] = view.source === "age" ? ageSites(snapshots, view.spacing) : tipSites(snapshots, view.threshold);
    if (sites.length > MAX_MARK_SITES) throw new Error(`The marks would need ${sites.length} sites; the limit is ${MAX_MARK_SITES}. Raise Mark spacing`);
    atEach(surface, sites.map((site) => ({ ...site, tone: toneOf(site.amount) })), consumers.mark ?? motif(view.mark, ramp), run);
  }
}

/** Build the producers, yielding between solver slices; false if cancelled. Nothing is cached for a cancelled run. */
export async function prepareLaplacianFronts(recipe: LaplacianFrontsComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const snapshots = await prepareGrowth(recipe.growth, growthSeedOf(recipe), recipe.steps, cancelled);
  return snapshots !== null && !cancelled();
}
