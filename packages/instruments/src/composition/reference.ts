import { referenceDefinitions } from "../adapters/reference-composition-instruments.js";
import type { InstrumentInput, InstrumentDefinition } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { atEach, createCompositionRun, inside, strokeWith } from "./core.js";
import { motif, pathMaterial, regionFill, regionFillValid, regionGeometry, regionGeometryKey,
  regionMode, retainPreparedRegions } from "./materials.js";
import type { PreparedRegionGeometry } from "./materials.js";
import { contourPaths, gridPaths, gridSites, latticeSites, memoized, partitionRegions, poissonSites, regionTree, wallpaperSites } from "./sources.js";
import { warpPaths, warpSites } from "./warp.js";
import { drawGraphComposition, graphRolesComposition, prepareGraphComposition } from "./graph-draw.js";
import { drawPlatesRecipe, preparePlatesRecipe } from "./plates.js";
import { opticalPlatesRecipe } from "../adapters/optical-plates.js";
import { tilingComposition } from "../adapters/tiling-instruments.js";
import { drawTiling, prepareTiling } from "./tiling-materials.js";
import { typeRhythmComposition } from "../adapters/type-rhythm-instrument.js";
import { drawTypeRhythm, prepareTypeRhythm } from "./type-rhythm-draw.js";
import type { CompositionRun, CompositionSurface, LatticeSite, MapName, MapStage, MotifSpec, Path, PathMaterialSpec,
  ReferenceComposition, Region, RegionFillSpec, RegionTreeNode, Site, WallpaperGroup } from "./types.js";

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
    phaseSpread: nested ? 0 : (params.phaseSpread ?? 0) as number,
    levelRamp: nested ? 0 : (params.levelRamp ?? 0) as number,
    retention: nested ? 1 : params.retention as number,
    mark: mark(params, "bead") };
}
function nodeMark(params: Record<string, Scalar>): MotifSpec {
  return { kind: params.nodeMark as MotifSpec["kind"], size: params.nodeSize as number, petals: params.nodePetals as number,
    opening: params.nodeOpening as number, weight: params.nodeWeight as number, rotation: 0, variation: 0, retention: 1 };
}
function mapStages(params: Record<string, Scalar>): MapStage[] {
  return [1, 2, 3].map((index) => ({ map: params[`stage${index}Map`] as MapName,
    amount: params[`stage${index}Amount`] as number, frequency: params[`stage${index}Frequency`] as number }));
}
const foldedCache = new Map<string, { paths: readonly Path[]; sites: readonly Site[] }>();
/** The mapped grid lines and nodes; cached so repeated draws and preparation share the work. */
function foldedGrid(recipe: Extract<ReferenceComposition, { kind: "warp" }>): { paths: readonly Path[]; sites: readonly Site[] } {
  return memoized(foldedCache, JSON.stringify([recipe.grid, recipe.map]), () => ({
    paths: warpPaths(gridPaths(recipe.grid), recipe.map),
    // The study, not the geometry, decides colour: nodes a map turns inside out take the second color.
    sites: warpSites(gridSites(recipe.grid), recipe.map).map((site) => Object.freeze({ ...site, tone: site.flipped ? 1 : 0 })) }));
}
/** Resolve persisted named scalar controls to a public JSON-compatible source/consumer pair. */
export function referenceComposition(input: InstrumentInput): ReferenceComposition {
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((color) =>
    !Number.isSafeInteger(color) || color < 0 || color > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition(input.technique), input.params);
  const seed = input.seed, palette = [...input.palette];
  if (input.technique === "graph-roles") return { kind: "graph", ...graphRolesComposition(q, seed, palette) };
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
  if (input.technique === "optical-plates") return opticalPlatesRecipe(q, seed, palette);
  if (input.technique === "fold-atlas") {
    return { kind: "warp", palette, grid: { seed, centerX: q.centerX as number, centerY: q.centerY as number,
      width: q.width as number, height: q.height as number, columns: q.columns as number, rows: q.rows as number,
      jitter: q.jitter as number },
      map: { centerX: q.mapCenterX as number, centerY: q.mapCenterY as number, radius: q.mapRadius as number,
        stages: mapStages(q), iterations: q.iterations as number, bound: q.bound as number },
      material: material(q), mark: nodeMark(q) };
  }
  if (input.technique === "wallpaper-motifs") {
    return { kind: "wallpaper", palette, source: { seed, group: q.group as WallpaperGroup,
      cellWidth: q.cellWidth as number, cellHeight: q.cellHeight as number,
      centerX: q.centerX as number, centerY: q.centerY as number,
      width: q.width as number, height: q.height as number,
      motifOffsetX: q.motifOffsetX as number, motifOffsetY: q.motifOffsetY as number,
      margin: q.margin as number, breakAmount: q.breakAmount as number, breakDensity: q.breakDensity as number },
      mark: mark(q) };
  }
  if (input.technique === "substitution-tilings") return tilingComposition(q, seed, palette);
  if (input.technique === "typographic-rhythm") return { kind: "typography", ...typeRhythmComposition(q, seed, palette) };
  if (input.technique === "ordered-disorder") {
    return { kind: "lattice", palette, source: { seed, columns: q.columns as number, rows: q.rows as number,
      width: q.width as number, height: q.height as number, centerX: q.centerX as number,
      centerY: q.centerY as number, correlation: q.correlation as number,
      displacement: q.displacement as number, rotation: (q.rotation as number) * Math.PI / 180, scale: q.scale as number,
      omission: q.omission as number, anchors: q.anchors as number,
      focalX: q.focalX as number, focalY: q.focalY as number, focalRadius: q.focalRadius as number,
      retention: q.retention as number }, mark: mark(q) };
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
  if (input.technique === "recursive-cells") {
    return { kind: "cells", palette, source: { seed, width: q.width as number, height: q.height as number,
      centerX: q.centerX as number, centerY: q.centerY as number, depth: q.depth as number,
      minSize: q.minSize as number, stopChance: q.stopChance as number,
      childRetention: q.childRetention as number, axis: q.axis as "LONGEST" | "RANDOM",
      bias: q.bias as number }, fill };
  }
  return { kind: "regions", palette, source: { seed, width: q.width as number, height: q.height as number,
    centerX: q.centerX as number, centerY: q.centerY as number, columns: q.grid as number,
    rows: q.grid as number, attempts: q.attempts as number,
    axis: q.axis as "LONGEST" | "RANDOM", bias: q.bias as number }, fill };
}
function terminalRegions(nodes: readonly RegionTreeNode[]): readonly Region[] {
  return Object.freeze(nodes.filter((node) => node.terminal).map((node): Region =>
    Object.freeze({ id: node.id, seed: node.seed, bounds: node.bounds })));
}
function keptLattice(sites: readonly LatticeSite[]): readonly LatticeSite[] {
  return Object.freeze(sites.filter((site) => site.kept));
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
  if (recipe.kind === "graph") return drawGraphComposition(surface, recipe, run);
  if (recipe.kind === "sites") {
    const selected = motif(recipe.mark, recipe.palette);
    if (recipe.mark.retention > 0 && recipe.mark.size > 0) atEach(surface, poissonSites(recipe.source), selected, run);
  } else if (recipe.kind === "paths") {
    const selected = pathMaterial(recipe.material, recipe.palette);
    if (recipe.material.retention > 0) strokeWith(surface, contourPaths(recipe.source), selected, run);
  } else if (recipe.kind === "wallpaper") {
    const selected = motif(recipe.mark, recipe.palette);
    if (recipe.mark.retention > 0 && recipe.mark.size > 0) atEach(surface, wallpaperSites(recipe.source), selected, run);
  } else if (recipe.kind === "lattice") {
    const selected = motif(recipe.mark, recipe.palette);
    if (recipe.mark.retention > 0 && recipe.mark.size > 0) atEach(surface, keptLattice(latticeSites(recipe.source)), selected, run);
  } else if (recipe.kind === "warp") {
    const { paths, sites } = foldedGrid(recipe);
    if (recipe.material.retention > 0) strokeWith(surface, paths, pathMaterial(recipe.material, recipe.palette), run);
    if (recipe.mark.size > 0) atEach(surface, sites, motif(recipe.mark, recipe.palette), run);
  } else if (recipe.kind === "plates") {
    drawPlatesRecipe(surface, recipe, run);
  } else if (recipe.kind === "typography") {
    drawTypeRhythm(surface, recipe, run);
  } else if (recipe.kind === "tiling") {
    drawTiling(surface, recipe, run);
  } else if (recipe.kind === "cells") {
    const selected = regionFill(recipe.fill, recipe.palette);
    if (recipe.fill.retention === 0) return;
    const regions = terminalRegions(regionTree(recipe.source));
    boundNestedWork(regions, recipe.fill);
    inside(surface, regions, selected, run);
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
  if (recipe.kind === "graph") return prepareGraphComposition(recipe, cancelled);
  if (recipe.kind === "sites") { motif(recipe.mark, recipe.palette); if (recipe.mark.retention > 0) poissonSites(recipe.source); return !cancelled(); }
  if (recipe.kind === "paths") { pathMaterial(recipe.material, recipe.palette); if (recipe.material.retention > 0) contourPaths(recipe.source); return !cancelled(); }
  if (recipe.kind === "wallpaper") { motif(recipe.mark, recipe.palette); if (recipe.mark.retention > 0) wallpaperSites(recipe.source); return !cancelled(); }
  if (recipe.kind === "lattice") { motif(recipe.mark, recipe.palette); if (recipe.mark.retention > 0) latticeSites(recipe.source); return !cancelled(); }
  if (recipe.kind === "warp") { pathMaterial(recipe.material, recipe.palette); motif(recipe.mark, recipe.palette); foldedGrid(recipe); return !cancelled(); }
  if (recipe.kind === "plates") return preparePlatesRecipe(recipe, cancelled);
  if (recipe.kind === "typography") return prepareTypeRhythm(recipe, cancelled);
  if (recipe.kind === "tiling") return prepareTiling(recipe, cancelled);
  const regions = recipe.kind === "cells" ? terminalRegions(regionTree(recipe.source)) : partitionRegions(recipe.source);
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
