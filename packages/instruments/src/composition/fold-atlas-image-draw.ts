import { foldAtlasImageDefinition, foldAtlasImageFromValues } from "../adapters/fold-atlas-image-instrument.js";
import type { FoldAtlasImageComposition, FoldImage } from "../adapters/fold-atlas-image-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { createCompositionRun } from "./core.js";
import { foldColors, foldDensity, foldGrid, foldMapped, foldPreimages, foldSamples, mergeRuns, prepareFoldMapped, prepareFoldPreimages, tonemapDensity } from "./fold-raster.js";
import type { FoldColors, FoldDensity, FoldGrid, FoldMapped, FoldPreimages, FoldRun, FoldSamples, SamplerSpec } from "./fold-raster.js";
import { bundledRaster } from "./raster-samples.js";
import { gridStorage } from "./raster.js";
import type { Raster, ScalarGrid } from "./raster.js";
import type { CompositionRun, CompositionSurface } from "./types.js";

/**
 * Fold Atlas Image as a typed composition: two consumers of the same chained coordinate maps (semantics in
 * `fold-raster.ts`), drawn as merged vector rectangles or dots on a transparent layer.
 *
 * - `mode: "fragments"` (inverse raster sampling): output cells of the frame each read the picture at their numeric
 *   preimage. Cells are stepped to `levels` per channel (or to a palette ramp) so equal neighbours merge into rectangles;
 *   fragments the map has turned over are darkened by `backShade`; cells with no reachable source draw nothing.
 * - `mode: "density"` (forward mapping with collisions): `count` samples of the picture are pushed through the maps,
 *   counted per cell (folds add, holes stay bare), tone-mapped by a separate exposure stage, and drawn as `bands` (merged
 *   rectangles) or `dots`.
 *
 * Stage products (`foldFragmentProducts`, `foldDensityProducts`) are cached by what each stage reads, so palette, levels,
 * shade, exposure, tone response and display edits redraw from the same cached objects. Work is bounded before drawing:
 * 40,000 cells per frame and 300,000 inverse seed points, each failure naming the control to change.
 */
export type { FoldAtlasImageComposition, FoldImage } from "../adapters/fold-atlas-image-instrument.js";

type Scalar = number | string | boolean;
const definition = foldAtlasImageDefinition;

/** Resolve stored scalar controls to the public composition value. */
export function foldAtlasImageComposition(input: InstrumentInput): FoldAtlasImageComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((color) =>
    !Number.isSafeInteger(color) || color < 0 || color > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  return foldAtlasImageFromValues(q, input.seed, input.palette);
}

/** The raster a recipe reads; bundled ones are cached by the library. */
export function foldImageRaster(image: FoldImage): Raster {
  return image.kind === "bundled" ? bundledRaster(image.id, image.variant, image.resolution) : image.raster;
}

/** The inverse stages: the preimage of every cell and the source color read there. */
export function foldFragmentProducts(recipe: FoldAtlasImageComposition): { preimages: FoldPreimages; colors: FoldColors } {
  const { fragments: f } = recipe, preimages = foldPreimages(recipe.map, recipe.source, recipe.frame, recipe.cell, { search: f.search, seeds: f.seeds, sheet: f.sheet });
  return { preimages, colors: foldColors(preimages, foldImageRaster(recipe.image), recipe.source, f.filter, f.area) };
}

/** The sampler a density recipe runs (`weight` and `curve` belong to tone sampling, `jitter` to grid sampling). */
export function foldSamplerSpec(recipe: FoldAtlasImageComposition): SamplerSpec {
  const d = recipe.density;
  return d.sampling === "tone" ? { kind: "tone", seed: recipe.seed, count: d.count, weight: d.weight, curve: d.curve }
    : { kind: "grid", seed: recipe.seed, count: d.count, jitter: d.jitter };
}

/**
 * The forward stages: samples, their mapped positions, the accumulated density (all cached; none reads exposure, tone
 * response or palette) and the tone of every cell (recomputed from the finished counts).
 */
export function foldDensityProducts(recipe: FoldAtlasImageComposition): { samples: FoldSamples; mapped: FoldMapped; density: FoldDensity; tone: ScalarGrid } {
  const samples = foldSamples(foldImageRaster(recipe.image), recipe.source, foldSamplerSpec(recipe));
  const mapped = foldMapped(samples, recipe.map), density = foldDensity(mapped, recipe.frame, recipe.cell);
  return { samples, mapped, density, tone: tonemapDensity(density, recipe.density.exposure, recipe.density.tonemap) };
}

// --- color ---------------------------------------------------------------------------------------------------

type Rgb = readonly [number, number, number];
const unpack = (packed: number): Rgb => [(packed >>> 16) & 255, (packed >>> 8) & 255, packed & 255];
const pack = ([r, g, b]: Rgb): number => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const WHITE: Rgb = [255, 255, 255];

/** The palette read as a ramp: t = 0 is its first color, t = 1 its last, linear in sRGB between neighbours. */
export function paletteRamp(palette: readonly number[], t: number): Rgb {
  if (palette.length === 1) return unpack(palette[0]);
  const at = Math.min(1, Math.max(0, t)) * (palette.length - 1), i = Math.min(palette.length - 2, Math.floor(at));
  return mix(unpack(palette[i]), unpack(palette[i + 1]), at - i);
}

/** Packed display color of every fragment cell, or -1 where the cell is excluded. */
export function fragmentKeys(recipe: FoldAtlasImageComposition, products: { preimages: FoldPreimages; colors: FoldColors }): Int32Array {
  const { levels, color, backShade } = recipe.fragments, { red, green, blue } = products.colors, determinant = gridStorage(products.preimages.determinant);
  const r = gridStorage(red), g = gridStorage(green), b = gridStorage(blue), keys = new Int32Array(r.length).fill(-1), last = levels - 1;
  for (let k = 0; k < keys.length; k++) {
    if (r[k] !== r[k]) continue;
    let rgb: Rgb;
    if (color === "image") rgb = [Math.round(r[k] * last) / last * 255, Math.round(g[k] * last) / last * 255, Math.round(b[k] * last) / last * 255];
    else rgb = paletteRamp(recipe.palette, Math.round((.2126 * r[k] + .7152 * g[k] + .0722 * b[k]) * last) / last);
    keys[k] = pack(determinant[k] < 0 ? mix(rgb, [0, 0, 0], backShade) : rgb);
  }
  return keys;
}

const DOT_STEPS = 16;
/** The band a density tone falls in, 0 .. bands - 1 (tone 1 belongs to the last band). */
const bandOf = (tone: number, bands: number): number => Math.min(bands - 1, Math.floor(tone * bands));
/** Density color for tone t in (0, 1]: ink tints toward white as density falls; palette runs last color (sparse) to first (dense). */
export function densityColor(recipe: FoldAtlasImageComposition, t: number): Rgb {
  return recipe.density.color === "ink" ? mix(WHITE, unpack(recipe.palette[0]), t) : paletteRamp(recipe.palette, 1 - t);
}

/** Stroke width that merged rectangles share with their neighbours so no hairline shows between them. */
const RECT_PAD = .35;

function drawRuns(surface: CompositionSurface, runs: readonly FoldRun[], grid: FoldGrid, colorOf: (key: number) => Rgb, run: CompositionRun): void {
  run.enter(runs.length);
  try {
    surface.push();
    surface.strokeWeight(RECT_PAD);
    for (const r of runs) {
      const [red, green, blue] = colorOf(r.key);
      surface.fill(red, green, blue); surface.stroke(red, green, blue);
      surface.rect(grid.x + r.column * grid.cellWidth, grid.y + r.row * grid.cellHeight, r.columns * grid.cellWidth, r.rows * grid.cellHeight);
    }
    surface.pop();
  } finally { run.leave(); }
}

/** Draw a descriptor into a host surface; no clearing, transparent layer. */
export function drawFoldAtlasImage(surface: CompositionSurface, recipe: FoldAtlasImageComposition, run: CompositionRun = createCompositionRun({ maxWork: 100_000 })): void {
  run.check();
  if (recipe.mode === "fragments") {
    const products = foldFragmentProducts(recipe), { grid } = products.preimages;
    drawRuns(surface, mergeRuns(grid.columns, grid.rows, fragmentKeys(recipe, products)), grid, unpack, run);
    return;
  }
  const { density, tone } = foldDensityProducts(recipe), { grid } = density, values = gridStorage(tone), { display, bands } = recipe.density;
  if (display === "bands") {
    const keys = new Int32Array(values.length);
    for (let k = 0; k < keys.length; k++) keys[k] = values[k] > 0 ? bandOf(values[k], bands) : -1;
    drawRuns(surface, mergeRuns(grid.columns, grid.rows, keys), grid, (band) => densityColor(recipe, (band + 1) / bands), run);
    return;
  }
  const size = recipe.density.dotMax * Math.min(grid.cellWidth, grid.cellHeight);
  let dots = 0;
  for (const v of values) if (v > 0) dots++;
  run.enter(dots);
  try {
    surface.push();
    surface.noStroke();
    for (let k = 0; k < values.length; k++) {
      if (!(values[k] > 0)) continue;
      const [r, g, b] = densityColor(recipe, recipe.density.color === "ink" ? 1 : Math.ceil(values[k] * DOT_STEPS) / DOT_STEPS);
      surface.fill(r, g, b);
      surface.circle(grid.x + (k % grid.columns + .5) * grid.cellWidth, grid.y + (Math.floor(k / grid.columns) + .5) * grid.cellHeight, size * Math.sqrt(values[k]));
    }
    surface.pop();
  } finally { run.leave(); }
}

/** Build the stages cooperatively, yielding to the host; false when cancelled. */
export async function prepareFoldAtlasImage(recipe: FoldAtlasImageComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  foldGrid(recipe.frame, recipe.cell);
  if (recipe.mode === "fragments") {
    const f = recipe.fragments, rules = { search: f.search, seeds: f.seeds, sheet: f.sheet };
    const preimages = await prepareFoldPreimages(recipe.map, recipe.source, recipe.frame, recipe.cell, rules, cancelled);
    if (!preimages || cancelled()) return false;
    foldColors(preimages, foldImageRaster(recipe.image), recipe.source, f.filter, f.area);
    return !cancelled();
  }
  const samples = foldSamples(foldImageRaster(recipe.image), recipe.source, foldSamplerSpec(recipe));
  const mapped = await prepareFoldMapped(samples, recipe.map, cancelled);
  if (!mapped || cancelled()) return false;
  foldDensity(mapped, recipe.frame, recipe.cell);
  return !cancelled();
}
