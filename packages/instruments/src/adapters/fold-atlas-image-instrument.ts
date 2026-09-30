import { bundledRasterIds } from "../composition/raster-samples.js";
import type { BundledRasterId } from "../composition/raster-samples.js";
import type { Raster, SampleFilter } from "../composition/raster.js";
import { FOLD_LIMITS, foldGrid, foldSeedCount } from "../composition/fold-raster.js";
import type { FoldRect, SheetRule, Tonemap } from "../composition/fold-raster.js";
import type { MapName, WarpOptions } from "../composition/types.js";
import { mapNames } from "../composition/warp.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
type Scalar = number | string | boolean;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, integer = false, visibleWhen?: Condition): Parameter => {
  const parameter = numeric(key, label, description, min, max, step, { hardMin, hardMax, integer });
  return visibleWhen ? { ...parameter, visibleWhen } : parameter;
};
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter => {
  const parameter = choice(key, label, description, options);
  return visibleWhen ? { ...parameter, visibleWhen } : parameter;
};

const fragments: Condition = { mode: ["fragments"] };
const density: Condition = { mode: ["density"] };
const sheets: Condition = { search: ["sheets"] };
const toned: Condition = { sampling: ["tone"] };
const gridded: Condition = { sampling: ["grid"] };
const banded: Condition = { display: ["bands"] };
const dotted: Condition = { display: ["dots"] };

const controlGroups: readonly ControlGroup[] = [
  { label: "Image", stage: "form", controls: ["image", "variant", "resolution"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Image size", controls: ["width", "height"], proportional: true },
    { label: "Frame", controls: ["frameWidth", "frameHeight"], proportional: true }] },
  { label: "Map", stage: "form", controls: ["mapCenterX", "mapCenterY", "mapRadius",
    ...(["First", "Second", "Third"] as const).map((label, index) => ({ label,
      controls: [`stage${index + 1}Map`, `stage${index + 1}Amount`, `stage${index + 1}Frequency`] })),
    "iterations", "bound"] },
  { label: "Show", stage: "material", controls: ["mode", "cell"] },
  { label: "Fragments", stage: "material", controls: ["filter", "areaAverage", { label: "Folds", controls: ["search", "seeds", "sheet", "backShade"] }, { label: "Color", controls: ["levels", "color"] }] },
  { label: "Density", stage: "material", controls: [{ label: "Samples", controls: ["sampling", "count", "weight", "curve", "jitter"] },
    { label: "Exposure", controls: ["exposure", "tonemap"] }, { label: "Marks", controls: ["display", "bands", "dotMax", "densityColor"] }] },
];

export const foldAtlasImageDefinition: InstrumentDefinition = {
  id: "fold-atlas-image", title: "Fold Atlas Image",
  description: "A picture pushed through chained coordinate maps. Fragments inverts the map for every output cell and paints the picture there, so folds show stretched, mirrored and overlapping fragments with one sheet on top; Density pushes thousands of samples of the picture forward and stacks them in cells, so where a fold piles the picture onto itself the density adds up and where it stretches thin the paper stays bare.",
  procedure: "A portrait is pushed through a handkerchief fold and a swirl, and for every output cell the maps are run backward to find which part of the picture lands there. Folds stack parts of the face on top of each other, and cells nothing reaches stay bare.",
  renderer: "2d",
  parameters: [
    select("image", "Source image", "Bundled sample picture the map folds: a soft portrait, a hard-edged geometric scene, a landscape, or worst-case grain. Your own images bind through the host when it supports them.", [...bundledRasterIds]),
    n("variant", "Image variant", "The sample's own seed: it re-arranges and re-tints the picture, not the fold.", 0, 99, 1, 0, 9999, true),
    n("resolution", "Image resolution", "Pixels across the sample. More pixels keep finer detail for the fragments to stretch and for density sampling to find; fewer are faster and blunter.", 48, 256, 8, 16, 512, true),
    n("centerX", "Image center X", "Horizontal center of the picture before the map, in canvas units. The frame is centered on it too.", 80, 560, 1, -1000, 1600),
    n("centerY", "Image center Y", "Vertical center of the picture before the map, in canvas units.", 80, 560, 1, -1000, 1600),
    n("width", "Image width", "Width of the picture before mapping. The whole picture is fitted to it (stretched if the height differs).", 100, 600, 1, 16, 2000),
    n("height", "Image height", "Height of the picture before mapping.", 100, 600, 1, 16, 2000),
    n("frameWidth", "Frame width", "Width of the region the result is drawn in. Anything the map sends outside the frame is dropped, and the frame is where output cells are laid.", 200, 640, 1, 32, 2000),
    n("frameHeight", "Frame height", "Height of the region the result is drawn in.", 200, 640, 1, 32, 2000),
    n("mapCenterX", "Map center X", "Fixed point of every map, horizontally.", 0, 640, 1, -640, 1280),
    n("mapCenterY", "Map center Y", "Fixed point of every map, vertically.", 0, 640, 1, -640, 1280),
    n("mapRadius", "Map radius", "Canvas length the maps treat as 1; smaller values apply them more strongly.", 60, 480, 1, 1, 4096),
    select("stage1Map", "First map", "Sinusoidal folds, swirl twists, fisheye compresses, spherical inverts about the center, polar unrolls, handkerchief drapes, waves ripple and horseshoe reflects.", mapNames as string[]),
    n("stage1Amount", "First amount", "Blend from no change (0) to the full map (1); above 1 exaggerates it.", 0, 1.5, .01, 0, 2),
    n("stage1Frequency", "First frequency", "The map's coefficient: fold count, twist rate or scale.", .25, 6, .05, .05, 12),
    select("stage2Map", "Second map", "Applied after the first map to its result.", mapNames as string[]),
    n("stage2Amount", "Second amount", "Blend from no change to the full map; zero skips this stage.", 0, 1.5, .01, 0, 2),
    n("stage2Frequency", "Second frequency", "The second map's coefficient.", .25, 6, .05, .05, 12),
    select("stage3Map", "Third map", "Applied after the second map to its result.", mapNames as string[]),
    n("stage3Amount", "Third amount", "Blend from no change to the full map; zero skips this stage.", 0, 1.5, .01, 0, 2),
    n("stage3Frequency", "Third frequency", "The third map's coefficient.", .25, 6, .05, .05, 12),
    n("iterations", "Repeat chain", "Run the whole chain again on its own output; order matters.", 1, 4, 1, 1, 4, true),
    n("bound", "Exclusion bound", "Points a map sends farther than this many radii from the map center are dropped. Density counts them as excluded; Fragments leaves cells with no reachable source as bare paper.", 2, 20, .5, 1, 50),
    select("mode", "Show", "Fragments paints the picture through the inverted map (one visible sheet per cell). Density stacks forward-mapped samples of the picture (folded regions add up, stretched regions leave holes).", ["fragments", "density"]),
    n("cell", "Cell size", "Side of each output cell in canvas units. Smaller cells resolve finer fold edges and cost more: the frame is limited to 40,000 cells.", 4, 24, .5, 1, 400),
    select("filter", "Sampling filter", "How the picture is read between its pixels: nearest keeps hard pixels, bilinear blends four, bicubic keeps edges crisper. Reads happen in linear light; the picture's edge repeats its outermost pixel.", ["nearest", "bilinear", "bicubic"], fragments),
    { ...toggle("areaAverage", "Average shrunken areas", "Where the map shrinks the picture, a cell reads the average of the picture area it covers (from box-averaged smaller copies) instead of one pixel, so shrunken detail blurs instead of speckling. Off reads one point per cell."), visibleWhen: fragments },
    select("search", "Fold search", "Where the inverse looks for its source point. nearest starts from the cell itself, so a folded cell shows whichever sheet is closest; sheets also seeds the search from a fine lattice of the picture pushed through the map, finds every sheet, and shows the one you choose.", ["nearest", "sheets"], fragments),
    n("seeds", "Search detail", "Seed points per cell side pushed through the map to find where each sheet lands (1 to 4). Higher values find thin or small sheets that a coarse seeding misses, at the price of more seed points.", 1, 3, 1, 1, 4, true, sheets),
    select("sheet", "Sheet on top", "Where a fold puts two regions of the picture on one cell: front shows the region the map has kept the right way round, back shows the mirrored one.", ["front", "back"], sheets),
    n("backShade", "Mirrored shade", "Darkens fragments the map has turned over, so folds read as folds. 0 leaves them the picture's color.", 0, .8, .01, 0, 1, false, fragments),
    n("levels", "Color levels", "Steps per color channel. Cells of the same stepped color merge into one rectangle, so fewer levels give bigger, simpler shapes.", 2, 16, 1, 2, 64, true, fragments),
    select("color", "Color source", "image uses the picture's colors; palette maps its brightness along the palette from its first color (dark) to its last (light).", ["image", "palette"], fragments),
    select("sampling", "Sampling", "tone draws random points where the picture is dark or light, so density carries the picture; grid places one jittered point per cell of an even lattice, so density shows only the map's own stretching.", ["tone", "grid"], density),
    n("count", "Sample count", "Points pushed through the map. The first N points of a larger set are the N-point set, so raising the count only adds. Grid sampling rounds to a whole lattice.", 2000, 150000, 1000, 1, 400000, true, density),
    select("weight", "Sample where", "dark puts points where the picture is dark, light where it is bright.", ["dark", "light"], toned),
    n("curve", "Tone contrast", "Weight of a pixel is its tone to this power: above 1 favors the extremes, below 1 flattens toward uniform.", .25, 3, .05, .05, 8, false, toned),
    n("jitter", "Grid jitter", "How far each point wanders inside its own lattice cell: 0 centered, 1 anywhere in the cell.", 0, 1, .01, 0, 1, false, gridded),
    n("exposure", "Exposure", "Brightens or dims the density tone: 1 calls the density an unfolded picture would give 1. It only changes tone, never where samples land.", .1, 8, .05, .01, 64, false, density),
    select("tonemap", "Tone response", "film saturates smoothly, log lifts the light end and compresses heavy pile-ups, linear clips at four times the reference density. Empty cells stay empty in all three.", ["film", "log", "linear"], density),
    select("display", "Density marks", "bands paint stepped tone as merged rectangles; dots size a round dot by tone, so a fold's pile-up prints as a heavy line.", ["bands", "dots"], density),
    n("bands", "Bands", "Tone steps for bands; neighbouring cells of one step merge into one rectangle.", 2, 12, 1, 2, 32, true, banded),
    n("dotMax", "Largest dot", "Diameter of the fullest dot as a share of the cell. Above 1 dots in dense cells merge.", .3, 1.4, .05, .05, 2, false, dotted),
    select("densityColor", "Density color", "ink uses the first palette color, lighter where density is low; palette runs the palette from its last color (sparse) to its first (dense).", ["ink", "palette"], density),
  ],
  controlGroups,
  defaults: {
    image: "portrait", variant: 3, resolution: 128,
    centerX: 320, centerY: 320, width: 440, height: 440, frameWidth: 620, frameHeight: 620,
    mapCenterX: 320, mapCenterY: 320, mapRadius: 230,
    stage1Map: "handkerchief", stage1Amount: 1, stage1Frequency: 1.2,
    stage2Map: "swirl", stage2Amount: .7, stage2Frequency: 1.4,
    stage3Map: "fisheye", stage3Amount: 0, stage3Frequency: 1,
    iterations: 1, bound: 8,
    mode: "fragments", cell: 5,
    filter: "bilinear", areaAverage: true, search: "sheets", seeds: 3, sheet: "front", backShade: .3, levels: 6, color: "image",
    sampling: "tone", count: 100000, weight: "dark", curve: 1, jitter: 1,
    exposure: 1, tonemap: "film", display: "bands", bands: 6, dotMax: 1, densityColor: "ink",
  },
  validate: validateFoldAtlasImage,
};

/** How the picture reaches the maps: a bundled sample by id (persistable), or an already resolved raster (direct API). */
export type FoldImage =
  | { kind: "bundled"; id: BundledRasterId; variant: number; resolution: number }
  | { kind: "raster"; raster: Raster };

/** Named descriptor: JSON-compatible except a `raster` image, which is a resolved value and never a URL. */
export interface FoldAtlasImageComposition {
  kind: "fold-atlas-image";
  seed: number;
  palette: readonly number[];
  image: FoldImage;
  /** Canvas rectangle the picture occupies before the maps. */
  source: FoldRect;
  /** Canvas rectangle output cells tile. */
  frame: FoldRect;
  cell: number;
  map: WarpOptions;
  mode: "fragments" | "density";
  fragments: { filter: SampleFilter; area: boolean; search: "nearest" | "sheets"; seeds: number; sheet: SheetRule; backShade: number; levels: number; color: "image" | "palette" };
  density: { sampling: "tone" | "grid"; count: number; weight: "dark" | "light"; curve: number; jitter: number;
    exposure: number; tonemap: Tonemap; display: "bands" | "dots"; bands: number; dotMax: number; color: "ink" | "palette" };
}

/** Resolve validated named controls to the public descriptor. */
export function foldAtlasImageFromValues(q: Record<string, Scalar>, seed: number, palette: readonly number[]): FoldAtlasImageComposition {
  if (!(bundledRasterIds as readonly string[]).includes(q.image as string)) throw new Error(`Unknown bundled image: ${String(q.image)}`);
  const v = (key: string): number => q[key] as number;
  const stage = (index: 1 | 2 | 3) => ({ map: q[`stage${index}Map`] as MapName, amount: v(`stage${index}Amount`), frequency: v(`stage${index}Frequency`) });
  return {
    kind: "fold-atlas-image", seed, palette: [...palette],
    image: { kind: "bundled", id: q.image as BundledRasterId, variant: v("variant"), resolution: v("resolution") },
    source: { x: v("centerX") - v("width") / 2, y: v("centerY") - v("height") / 2, width: v("width"), height: v("height") },
    frame: { x: v("centerX") - v("frameWidth") / 2, y: v("centerY") - v("frameHeight") / 2, width: v("frameWidth"), height: v("frameHeight") },
    cell: v("cell"),
    map: { centerX: v("mapCenterX"), centerY: v("mapCenterY"), radius: v("mapRadius"), stages: [stage(1), stage(2), stage(3)], iterations: v("iterations"), bound: v("bound") },
    mode: q.mode as "fragments" | "density",
    fragments: { filter: q.filter as SampleFilter, area: q.areaAverage as boolean, search: q.search as "nearest" | "sheets", seeds: v("seeds"), sheet: q.sheet as SheetRule,
      backShade: v("backShade"), levels: v("levels"), color: q.color as "image" | "palette" },
    density: { sampling: q.sampling as "tone" | "grid", count: v("count"), weight: q.weight as "dark" | "light", curve: v("curve"), jitter: v("jitter"),
      exposure: v("exposure"), tonemap: q.tonemap as Tonemap, display: q.display as "bands" | "dots", bands: v("bands"), dotMax: v("dotMax"),
      color: q.densityColor as "ink" | "palette" },
  };
}

/** Coupled bounds that no single control can state: the frame's cell count and the inverse's seed count. */
export function validateFoldAtlasImage(q: Record<string, Scalar>): void {
  const frame = { x: 0, y: 0, width: q.frameWidth as number, height: q.frameHeight as number };
  const grid = foldGrid(frame, q.cell as number);
  if (q.mode === "fragments") {
    const rules = { search: q.search as "nearest" | "sheets", seeds: q.seeds as number, sheet: q.sheet as SheetRule };
    const seeds = foldSeedCount({ x: 0, y: 0, width: q.width as number, height: q.height as number }, q.cell as number, rules);
    if (seeds > FOLD_LIMITS.seeds)
      throw new Error(`Fold Atlas Image: a ${q.width} x ${q.height} image with cells of ${q.cell} and ${rules.seeds} seeds per cell side needs ${seeds} seed points; the limit is ${FOLD_LIMITS.seeds}. Raise Cell size, lower Search detail, or set Fold search to nearest`);
  }
}

/** Whether the seed can change this construction: only density sampling has chance in it. */
export function foldAtlasImageUsesSeed(q: Record<string, Scalar>): boolean {
  return q.mode === "density" && (q.sampling === "tone" || (q.jitter as number) > 0);
}
