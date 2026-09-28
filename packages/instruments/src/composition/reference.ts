import { referenceDefinitions } from "../adapters/reference-composition-instruments.js";
import type { InstrumentInput, InstrumentDefinition } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { atEach, createCompositionRun, inside, strokeWith } from "./core.js";
import { motif, pathMaterial, regionFill, regionFillValid, regionGeometry, regionGeometryKey,
  regionMode, retainPreparedRegions } from "./materials.js";
import type { PreparedRegionGeometry } from "./materials.js";
import { contourPaths, partitionRegions, poissonSites } from "./sources.js";
import type { CompositionRun, CompositionSurface, MotifSpec, PathMaterialSpec, ReferenceComposition,
  Region, RegionFillSpec } from "./types.js";

type Scalar = number | string | boolean;
function definition(id: string): InstrumentDefinition {
  const found = referenceDefinitions.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown reference instrument: ${id}`);
  return found;
}
function mark(params: Record<string, Scalar>, prefix = ""): MotifSpec {
  const nested = prefix === "bead";
  const read = (name: string) => params[prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name] as number;
  return { kind: params[nested ? "beadMark" : "mark"] as MotifSpec["kind"],
    size: nested ? read("size") : (params.size ?? params.markSize) as number,
    petals: nested ? read("petals") : (params.petals ?? params.markPetals) as number,
    opening: nested ? (params.beadOpening ?? .42) as number : (params.markOpening ?? .42) as number,
    weight: (nested ? params.beadWeight ?? params.weight : params.weight) as number,
    rotation: 0, variation: nested ? .2 : (params.variation ?? .3) as number,
    retention: nested ? 1 : (params.retention ?? 1) as number };
}
function material(params: Record<string, Scalar>, nested = false): PathMaterialSpec {
  return { kind: params.material as PathMaterialSpec["kind"], weight: params.weight as number,
    spacing: (nested ? params.materialSpacing : params.spacing) as number,
    phase: nested ? .3 : params.phase as number,
    retention: nested ? 1 : params.retention as number,
    mark: mark(params, "bead") };
}
/** Resolve persisted named scalar controls to a public JSON-compatible source/consumer pair. */
export function referenceComposition(input: InstrumentInput): ReferenceComposition {
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((color) =>
    !Number.isSafeInteger(color) || color < 0 || color > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition(input.technique), input.params);
  const seed = input.seed, palette = [...input.palette];
  if (input.technique === "motif-ecologies") {
    return { kind: "sites", palette, source: { seed, width: q.width as number, height: q.height as number,
      centerX: q.centerX as number, centerY: q.centerY as number, separation: q.separation as number,
      maxPoints: q.maxPoints as number, support: q.support as "rectangle" | "ellipse" | "annulus",
      opening: q.opening as number, rotation: q.rotation as number }, mark: mark(q) };
  }
  if (input.technique === "contour-scores") {
    return { kind: "paths", palette, source: { seed, source: q.source as "noise" | "hills" | "waves" | "saddle",
      width: q.width as number, height: q.height as number, centerX: q.centerX as number,
      centerY: q.centerY as number, resolution: q.resolution as number,
      frequency: q.source === "hills" || q.source === "saddle" ? 1.6 : q.frequency as number,
      aspect: q.aspect as number, hillCount: q.hillCount as number, hillRadius: q.hillRadius as number,
      levelBase: q.levelBase as number, levelStep: q.levelStep as number, levels: q.levels as number,
      rotation: q.rotation as number }, material: material(q) };
  }
  const fill: RegionFillSpec = { kind: q.fill as RegionFillSpec["kind"], inset: q.inset as number,
    retention: q.retention as number, spacing: q.spacing as number, angle: q.angle as number,
    weight: q.weight as number, underpaint: 0,
    mark: { ...mark(q), size: q.markSize as number, petals: q.markPetals as number, retention: 1 },
    material: material(q, true),
    contour: { source: q.contourField as RegionFillSpec["contour"]["source"],
      frequency: q.contourFrequency as number, resolution: 23, aspect: 1,
      hillCount: 3, hillRadius: .23, levelBase: q.contourField === "hills" ? .15 : -.65,
      levelStep: q.contourField === "hills" ? .25 : .35, levels: 4 } };
  return { kind: "regions", palette, source: { seed, width: q.width as number, height: q.height as number,
    centerX: q.centerX as number, centerY: q.centerY as number, columns: q.grid as number,
    rows: q.grid as number, attempts: q.attempts as number,
    axis: q.axis as "LONGEST" | "RANDOM", bias: q.bias as number }, fill };
}

/** Conservative aggregate geometry bound before allocating any nested leaf source. */
function boundNestedWork(regions: readonly Region[], spec: RegionFillSpec): void {
  regionFillValid(spec);
  let estimated = 0;
  for (const region of regions) {
    const width = region.bounds[2] - region.bounds[0] - spec.inset * 2;
    const height = region.bounds[3] - region.bounds[1] - spec.inset * 2;
    if (width < 1 || height < 1) continue;
    const mode = regionMode(spec, region);
    if (mode === "contours") estimated += spec.contour.resolution ** 2 * spec.contour.levels;
    else if (mode === "motifs") estimated += 80 * 30;
    else if (mode === "hatch") estimated += (Math.ceil(Math.hypot(width, height) / spec.spacing) + 2) * 168;
    if (estimated > 230_000) throw new Error("Nested region geometry exceeds 230000 units; reduce cuts, increase spacing or use fewer contour-filled leaves");
  }
}
/** Draw the same typed recipe prepared by prepareReferenceComposition; no surface clearing. */
export function drawReferenceComposition(surface: CompositionSurface, recipe: ReferenceComposition,
  run: CompositionRun = createCompositionRun()): void {
  run.check();
  if (recipe.kind === "sites") {
    const selected = motif(recipe.mark, recipe.palette);
    if (recipe.mark.retention > 0 && recipe.mark.size > 0) atEach(surface, poissonSites(recipe.source), selected, run);
  } else if (recipe.kind === "paths") {
    const selected = pathMaterial(recipe.material, recipe.palette);
    if (recipe.material.retention > 0) strokeWith(surface, contourPaths(recipe.source), selected, run);
  } else {
    const selected = regionFill(recipe.fill, recipe.palette);
    if (recipe.fill.retention === 0) return;
    const regions = partitionRegions(recipe.source);
    boundNestedWork(regions, recipe.fill);
    inside(surface, regions, selected, run);
  }
}
/** Build both top-level and nested sources, yielding to the event loop between leaf batches. */
export async function prepareReferenceComposition(recipe: ReferenceComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  if (recipe.kind === "sites") { motif(recipe.mark, recipe.palette); if (recipe.mark.retention > 0) poissonSites(recipe.source); return !cancelled(); }
  if (recipe.kind === "paths") { pathMaterial(recipe.material, recipe.palette); if (recipe.material.retention > 0) contourPaths(recipe.source); return !cancelled(); }
  regionFillValid(recipe.fill);
  if (recipe.fill.retention === 0) return !cancelled();
  const regions = partitionRegions(recipe.source);
  boundNestedWork(regions, recipe.fill);
  const scene = new Map<string, PreparedRegionGeometry | undefined>();
  for (let index = 0; index < regions.length; index++) {
    if (cancelled()) return false;
    const region = regions[index];
    scene.set(regionGeometryKey(recipe.fill, region), regionGeometry(recipe.fill, region));
    if ((index + 1) % 2 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  if (cancelled()) return false;
  retainPreparedRegions(scene);
  return true;
}
