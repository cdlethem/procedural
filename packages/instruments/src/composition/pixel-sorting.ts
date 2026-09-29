import { gradientNoise2D01 } from "@procedurals/javascript";
import { pixelSortingDefinition } from "../adapters/pixel-sorting-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { atEach, componentSeed, createCompositionRun, strokeWith } from "./core.js";
import { applyPixelMoves, orientationField, orientationGrids, scanRuns, scanRunPixel, segmentValueBands, sortScanRuns } from "./image-structure.js";
import type { PixelMoves, RunSet, ScanDirection, ScanRun } from "./image-structure.js";
import { pathMaterial } from "./materials.js";
import { bundledRaster, bundledRasterIds } from "./raster-samples.js";
import type { BundledRasterId } from "./raster-samples.js";
import { convertRaster, createScalarGrid, gridStorage, rasterMapping, rasterStorage, valueField } from "./raster.js";
import type { Raster, RasterMapping, ScalarGrid } from "./raster.js";
import type { CompositionRun, CompositionSurface, Path, PathMaterial, PathMaterialSpec, Point, Site } from "./types.js";

/**
 * Masked pixel sorting as a typed composition (brief 29).
 *
 * Pipeline, each stage a pure, cached, frozen producer:
 * `Raster` (owned, immutable) + selection mask -> straight scan lines (`scanRuns`, eight directions)
 * -> selected runs (a value interval, an optional ragged field, a protected or selecting region, a
 * shortest and optionally a longest length) -> stable sort of every run by a declared key
 * (`sortScanRuns`) -> the moved-pixel mapping and the transformed raster (`applyPixelMoves`)
 * -> merged vector streaks (`pixelSortStreaks`) drawn as bars or stitches, and run outlines
 * (`pixelSortRunPaths`) drawn by an ordinary path material.
 *
 * Inputs. `image` is a resolved value, never a URL: either a bundled sample (id, size and variant,
 * plain JSON) or a `Raster` the caller constructed. The persisted instrument stores its technique id,
 * scalar parameters and palette, so it can only name a bundled sample; a host-supplied image binds
 * through future host work and the direct API already accepts it. Nothing here fetches or decodes.
 *
 * Outputs (`PixelSortStructure`): the source raster, the run set, the moved-pixel mapping (`moves`,
 * slot -> destination and source pixel index, plus `movedPixels` for the pixels that actually change
 * place), a run table (`pixelSortRunTable`), and the transformed raster. Only pixels inside a
 * selected run can move, and only within their own run. Pixels are conserved per run, unselected
 * pixels and alpha are byte identical, and equal keys keep scan order.
 *
 * Ownership. Every published value is frozen. Typed-array storage is private to this module.
 * The structure is cached by construction only: image, direction, selection, lengths, sort, mask
 * (and the seed, but only when the ragged field or the noise mask is used). Palette, colors,
 * merge tolerance, mark kind, outlines and footprint never rebuild it or rename anything.
 * Run ids are `run:<x>.<y>` of the first pixel of the run and streak ids `s:<x>.<y>` of its first
 * pixel, so both are stable under every appearance edit and under filtering.
 *
 * Seeds. The sort is deterministic. Chance enters in two places only: the ragged selection field
 * and the noise mask, both from `componentSeed(seed, "pixel-sorting", <purpose>)`.
 *
 * Failure and bounds (all explicit, nothing is truncated; each message names the control to change):
 * foundation bounds (4,194,304 analysis pixels, 1,000,000 runs), at most 40,000 drawn streaks
 * (raise Merge tolerance or lower Resolution) and at most 4,000 outlined runs (raise Shortest run,
 * narrow the interval or turn the outlines off).
 *
 * Units. Raster space is pixels with the origin at the top-left corner of the top-left pixel;
 * canvas space is the footprint rectangle (independent x and y scales, an intentional stretch).
 * Angles are radians, canvas lengths are canvas units.
 *
 * Limits. Only straight scan lines are supported. A curved scan path would need its own pixel
 * visitation and overlap rules and is not offered. Diagonal runs are drawn as the exact union of
 * their pixel squares (a staircase); their bars are one polygon, not a rotated rectangle.
 */

/** `work` is the callback budget of one drawing (streak callbacks and stitched outlines are charged to it); the stock streaks are drawn in one batch and are not. */
export const PIXEL_SORTING_LIMITS = Object.freeze({ streaks: 40_000, outlinedRuns: 4_000, grow: 16, work: 2_000_000 });

export type PixelSortValue = "luma" | "lightness" | "hue" | "saturation";
const VALUES: readonly PixelSortValue[] = ["luma", "lightness", "hue", "saturation"];
const DIRECTIONS: readonly ScanDirection[] = ["right", "left", "down", "up", "down-right", "down-left", "up-right", "up-left"];

export type PixelSortImage =
  | { readonly kind: "bundled"; readonly id: BundledRasterId; readonly size: number; readonly variant: number }
  | { readonly kind: "raster"; readonly raster: Raster };

export type PixelSortMask =
  /** Ellipse centred at (x, y) with the given width and height, all as fractions of the image. */
  | { readonly kind: "ellipse"; readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  /** The 4-connected region of one equal-width lightness band that contains the pixel under (x, y). */
  | { readonly kind: "region"; readonly x: number; readonly y: number; readonly bands: number; readonly grow: number }
  /** The `share` of pixels with the strongest gradient energy (flat pixels never), grown by `grow`. */
  | { readonly kind: "edges"; readonly share: number; readonly grow: number }
  /** Seeded gradient-noise blobs of `scale` pixels covering `share` of the image. */
  | { readonly kind: "field"; readonly share: number; readonly scale: number };

export interface PixelSortRuns {
  direction: ScanDirection;
  /** Pixels whose (possibly ragged) value lies in [from, to], inclusive, can be sorted. */
  select: { value: PixelSortValue; from: number; to: number };
  minRun: number;
  /** null: runs are never cut. */
  maxRun: number | null;
  /** null: the interval is exact. */
  ragged: { amount: number; scale: number } | null;
}

export interface PixelSortMarks {
  show: "all" | "sorted" | "untouched";
  tint: "image" | "palette";
  kind: "bars" | "stitches";
  merge: number;
  stitchWidth: number;
  stitchGap: number;
}

export interface PixelSortRecipe {
  kind: "pixel-sorting";
  seed: number;
  palette: readonly number[];
  image: PixelSortImage;
  runs: PixelSortRuns;
  sort: { key: PixelSortValue; order: "ascending" | "descending" };
  /** null: no region; every pixel with alpha can be selected. */
  mask: PixelSortMask | null;
  maskRole: "protect" | "select";
  footprint: { centerX: number; centerY: number; width: number; height: number };
  marks: PixelSortMarks;
  outline: { kind: "none" | "ink" | "stitch"; weight: number; spacing: number };
}

/** The part of a recipe that decides which pixel goes where. */
export type PixelSortConstruction = Pick<PixelSortRecipe, "seed" | "image" | "runs" | "sort" | "mask" | "maskRole">;

// ------------------------------------------------------------------------------------ validation

function check(label: string, value: number, min: number, max: number, integer = false): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    throw new Error(`${label} must be ${integer ? "an integer" : "a finite number"} in [${min}, ${max}] (got ${String(value)})`);
}
function checkOneOf<T extends string>(label: string, value: unknown, allowed: readonly T[]): asserts value is T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`${label} must be one of ${allowed.join(", ")} (got ${String(value)})`);
}
function checkConstruction(recipe: PixelSortConstruction): void {
  if (!Number.isSafeInteger(recipe.seed) || recipe.seed < 0 || recipe.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  const { image, runs, sort, mask } = recipe;
  if (image === null || typeof image !== "object") throw new Error("Source image must be a bundled sample or a Raster");
  if (image.kind === "bundled") {
    checkOneOf("Source image", image.id, bundledRasterIds);
    check("Resolution", image.size, 16, 512, true);
    check("Image variant", image.variant, 0, 0xffffffff, true);
  } else if (image.kind === "raster") rasterStorage(image.raster);
  else throw new Error("Source image kind must be bundled or raster");
  checkOneOf("Scan direction", runs.direction, DIRECTIONS);
  checkOneOf("Select by", runs.select.value, VALUES);
  check("Interval start", runs.select.from, 0, 1); check("Interval end", runs.select.to, 0, 1);
  if (runs.select.from > runs.select.to) throw new Error("Interval start must not exceed the interval end");
  check("Shortest run", runs.minRun, 1, 8192, true);
  if (runs.maxRun !== null) check("Longest run", runs.maxRun, 2, 8192, true);
  if (runs.ragged) { check("Ragged amount", runs.ragged.amount, 0, 1); check("Ragged scale", runs.ragged.scale, 1, 1e4); }
  checkOneOf("Sort by", sort.key, VALUES);
  checkOneOf("Order", sort.order, ["ascending", "descending"] as const);
  checkOneOf("Region acts as", recipe.maskRole, ["protect", "select"] as const);
  if (mask) {
    if (mask.kind === "ellipse") {
      check("Focus X", mask.x, -4, 5); check("Focus Y", mask.y, -4, 5); check("Ellipse width", mask.width, 1e-6, 100); check("Ellipse height", mask.height, 1e-6, 100);
    } else if (mask.kind === "region") {
      check("Focus X", mask.x, 0, 1); check("Focus Y", mask.y, 0, 1); check("Tone bands", mask.bands, 2, 256, true); check("Grow", mask.grow, 0, PIXEL_SORTING_LIMITS.grow, true);
    } else if (mask.kind === "edges") {
      check("Share of the image", mask.share, 0, 1); check("Grow", mask.grow, 0, PIXEL_SORTING_LIMITS.grow, true);
    } else if (mask.kind === "field") {
      check("Share of the image", mask.share, 0, 1); check("Blob size", mask.scale, 1, 1e4);
    } else throw new Error("Region kind must be ellipse, region, edges or field");
  }
}
function checkAppearance(recipe: PixelSortRecipe): void {
  const { footprint, marks, outline } = recipe;
  check("Center X", footprint.centerX, -1e5, 1e5); check("Center Y", footprint.centerY, -1e5, 1e5);
  check("Width", footprint.width, 1e-3, 1e5); check("Height", footprint.height, 1e-3, 1e5);
  checkOneOf("Draw", marks.show, ["all", "sorted", "untouched"] as const);
  checkOneOf("Color", marks.tint, ["image", "palette"] as const);
  checkOneOf("Streak mark", marks.kind, ["bars", "stitches"] as const);
  check("Merge tolerance", marks.merge, 0, 1); check("Stitch thickness", marks.stitchWidth, .01, 4); check("Stitch gap", marks.stitchGap, 0, .99);
  checkOneOf("Run outlines", outline.kind, ["none", "ink", "stitch"] as const);
  check("Outline weight", outline.weight, 0, 50); check("Outline stitch spacing", outline.spacing, .5, 1e4);
  if (!Array.isArray(recipe.palette) || recipe.palette.length === 0) throw new Error("Composition needs packed RGB colors");
}

// ------------------------------------------------------------------------------------ image

/** The raster a recipe scans. Bundled samples are cached by the foundation; a Raster is used as is. */
export function pixelSortImage(image: PixelSortImage): Raster {
  return image.kind === "bundled" ? bundledRaster(image.id, image.variant, image.size) : image.raster;
}
const imageKey = (image: PixelSortImage): string => image.kind === "bundled" ? `bundled:${image.id}:${image.variant}:${image.size}` : `raster:${image.raster.hash}`;

// ------------------------------------------------------------------------------------ masks

/** Grow a 0/1 mask by a square of radius `radius` (Chebyshev distance): a pixel is set when any pixel within `radius` in x and y is. */
export function dilateMask(mask: ScalarGrid, radius: number): ScalarGrid {
  check("dilateMask radius", radius, 0, 1e4, true);
  const { width, height } = mask, source = gridStorage(mask);
  if (radius === 0) return mask;
  const pass = (input: Float64Array, along: "x" | "y"): Float64Array => {
    const out = new Float64Array(width * height), count = along === "x" ? width : height, lines = along === "x" ? height : width;
    const at = (line: number, k: number): number => along === "x" ? line * width + k : k * width + line;
    for (let line = 0; line < lines; line++) {
      let inside = 0;
      for (let k = 0; k < Math.min(count, radius); k++) if (input[at(line, k)] >= 0.5) inside++;
      for (let k = 0; k < count; k++) {
        if (k + radius < count && input[at(line, k + radius)] >= 0.5) inside++;
        if (k - radius - 1 >= 0 && input[at(line, k - radius - 1)] >= 0.5) inside--;
        out[at(line, k)] = inside > 0 ? 1 : 0;
      }
    }
    return out;
  };
  return createScalarGrid(width, height, pass(pass(source, "x"), "y"));
}

/** A 0/1 grid of the `share` of positions with the largest `values` among those `eligible`; ties fill in raster order. Deterministic. */
function topShare(values: Float64Array, eligible: (p: number) => boolean, share: number): Float64Array {
  const total = values.length, out = new Float64Array(total);
  const ranked: number[] = [];
  for (let p = 0; p < total; p++) if (eligible(p)) ranked.push(values[p]);
  const k = Math.min(ranked.length, Math.round(share * total));
  if (k <= 0) return out;
  const sorted = Float64Array.from(ranked).sort();
  const threshold = sorted[sorted.length - k];
  let taken = 0;
  for (let p = 0; p < total; p++) if (eligible(p) && values[p] > threshold) { out[p] = 1; taken++; }
  for (let p = 0; p < total && taken < k; p++) if (eligible(p) && values[p] === threshold && out[p] === 0) { out[p] = 1; taken++; }
  return out;
}

/**
 * The region of a recipe as a 0/1 grid the size of the image (1 = in the region), or null without one.
 * Ellipse: pixel centres (i + 1/2, j + 1/2) inside the closed ellipse. Region: the connected component
 * (`segmentValueBands`, 4-connectivity, lightness, small regions of under 0.4% of the image merged) that
 * holds the pixel containing the focus point; a focus outside the image or on a fully transparent pixel
 * gives an empty region. Edges and field: see `PixelSortMask`.
 */
export function pixelSortMask(raster: Raster, mask: PixelSortMask | null, seed: number): ScalarGrid | null {
  if (!mask) return null;
  const { width, height } = raster, P = width * height;
  if (mask.kind === "ellipse") {
    const out = new Float64Array(P), rx = mask.width / 2, ry = mask.height / 2;
    for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
      const u = ((i + 0.5) / width - mask.x) / rx, v = ((j + 0.5) / height - mask.y) / ry;
      if (u * u + v * v <= 1) out[j * width + i] = 1;
    }
    return createScalarGrid(width, height, out);
  }
  if (mask.kind === "region") {
    const seg = segmentValueBands(raster, { bands: mask.bands, connectivity: 4, minArea: Math.max(2, Math.round(P * 0.004)), value: "lightness" });
    const px = Math.min(width - 1, Math.floor(mask.x * width)), py = Math.min(height - 1, Math.floor(mask.y * height));
    const labels = gridStorage(seg.labels), id = labels[py * width + px], out = new Float64Array(P);
    if (id >= 0) for (let p = 0; p < P; p++) if (labels[p] === id) out[p] = 1;
    return dilateMask(createScalarGrid(width, height, out), mask.grow);
  }
  if (mask.kind === "edges") {
    const energy = gridStorage(orientationGrids(orientationField(raster, { smoothing: 1, value: "lightness" })).energy);
    return dilateMask(createScalarGrid(width, height, topShare(energy, (p) => energy[p] > 1e-10, mask.share)), mask.grow);
  }
  const noise = gradientNoise2D01({ seed: componentSeed(seed, "pixel-sorting", "field") }), values = new Float64Array(P);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) values[j * width + i] = noise.sample((i + 0.5) / mask.scale, (j + 0.5) / mask.scale);
  return createScalarGrid(width, height, topShare(values, () => true, mask.share));
}

// ------------------------------------------------------------------------------------ structure

export interface RunRow {
  /** `run:<x>.<y>` of the run's first pixel: stable while the run exists. */
  readonly id: string;
  readonly index: number;
  /** Ordinal of the scan line the run lies on. */
  readonly line: number;
  readonly x: number;
  readonly y: number;
  readonly length: number;
  /** Lowest and highest sort key inside the run. */
  readonly keyMin: number;
  readonly keyMax: number;
  /** Pixels of the run that end up somewhere other than where they started. */
  readonly moved: number;
}

export interface PixelSortStructure {
  /** The construction key: what the cache is keyed by. */
  readonly key: string;
  readonly seed: number;
  readonly source: Raster;
  /** 1 inside the region, or null when the recipe has none. */
  readonly mask: ScalarGrid | null;
  readonly runs: RunSet;
  /** Slot -> destination and source pixel index, for every pixel of every run (see `movedPixels` for those that change). */
  readonly moves: PixelMoves;
  /** The source with every run sorted. */
  readonly sorted: Raster;
  /** Number of pixel slots whose source pixel differs from their own. */
  readonly moved: number;
}

const structures = new Map<string, PixelSortStructure>();
const STRUCTURE_CACHE = 6;
const runIndexes = new WeakMap<PixelSortStructure, Int32Array>();

const seededParts = (recipe: PixelSortConstruction): boolean => recipe.runs.ragged !== null || recipe.mask?.kind === "field";

/** Cut runs longer than `maxRun` into ceil(L / maxRun) pieces whose lengths differ by at most one (longer pieces first). */
function limitRunLength(set: RunSet, maxRun: number): RunSet {
  const runs: ScanRun[] = [];
  let selectedPixels = 0;
  for (const run of set.runs) {
    const pieces = Math.ceil(run.length / maxRun), base = Math.floor(run.length / pieces), extra = run.length % pieces;
    let offset = 0;
    for (let k = 0; k < pieces; k++) {
      const length = base + (k < extra ? 1 : 0), x = run.x + offset * set.dx, y = run.y + offset * set.dy;
      runs.push(Object.freeze({ index: runs.length, line: run.line, x, y, length }));
      selectedPixels += length; offset += length;
    }
  }
  return Object.freeze({ ...set, runs: Object.freeze(runs), selectedPixels });
}

/**
 * Select, order and move. Frozen, cached by construction only (never by palette or drawing choices).
 * The scan uses one selection value per pixel: the chosen value, moved by the ragged field when there
 * is one and clamped to [0, 1]. Selectable pixels are those with alpha above 0 that are outside a
 * protecting region, or inside a selecting one.
 */
export function pixelSortStructure(recipe: PixelSortConstruction): PixelSortStructure {
  checkConstruction(recipe);
  const { runs: options, sort } = recipe;
  const key = JSON.stringify([imageKey(recipe.image), options.direction, options.select, options.minRun, options.maxRun, options.ragged, sort, recipe.mask, recipe.maskRole,
    seededParts(recipe) ? recipe.seed : null]);
  const hit = structures.get(key);
  if (hit) { structures.delete(key); structures.set(key, hit); return hit; }

  const source = pixelSortImage(recipe.image), { width, height } = source, P = width * height;
  const values = gridStorage(valueField(source, options.select.value)), selection = new Float64Array(P);
  if (options.ragged && options.ragged.amount > 0) {
    const noise = gradientNoise2D01({ seed: componentSeed(recipe.seed, "pixel-sorting", "ragged") }), { amount, scale } = options.ragged;
    for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
      const p = j * width + i, v = values[p] + (noise.sample((i + 0.5) / scale, (j + 0.5) / scale) - 0.5) * 2 * amount;
      selection[p] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  } else selection.set(values);
  const region = pixelSortMask(source, recipe.mask, recipe.seed), regionData = region ? gridStorage(region) : null;
  const alpha = source.alpha === "none" ? null : gridStorage(valueField(source, "alpha"));
  const eligible = new Float64Array(P);
  for (let p = 0; p < P; p++) {
    const allowed = regionData === null || (regionData[p] >= 0.5) === (recipe.maskRole === "select");
    eligible[p] = allowed && (alpha === null || alpha[p] > 0) ? 1 : 0;
  }
  let found = scanRuns(createScalarGrid(width, height, selection), {
    direction: options.direction, min: options.select.from, max: options.select.to, mask: createScalarGrid(width, height, eligible), minRun: options.minRun,
  });
  if (options.maxRun !== null) found = limitRunLength(found, options.maxRun);
  const moves = sortScanRuns(source, found, { key: sort.key, order: sort.order });
  const sorted = applyPixelMoves(source, moves, { alpha: "move" });
  let moved = 0;
  for (let slot = 0; slot < moves.count; slot++) if (moves.to(slot) !== moves.from(slot)) moved++;
  const structure: PixelSortStructure = Object.freeze({ key, seed: recipe.seed, source, mask: region, runs: found, moves, sorted, moved });
  const index = new Int32Array(P).fill(-1);
  for (const run of found.runs) for (let k = 0; k < run.length; k++) index[scanRunPixel(found, run, k)] = run.index;
  runIndexes.set(structure, index);
  structures.set(key, structure);
  if (structures.size > STRUCTURE_CACHE) structures.delete(structures.keys().next().value!);
  return structure;
}

/** Index of the run that holds pixel (x, y), or -1 for a pixel that is not sorted. */
export function pixelSortRunAt(structure: PixelSortStructure, x: number, y: number): number {
  const { width, height } = structure.source;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) throw new Error(`Pixel (${x}, ${y}) is outside ${width} x ${height}`);
  return runIndexes.get(structure)![y * width + x];
}

const runId = (x: number, y: number): string => `run:${x}.${y}`;
const tables = new WeakMap<PixelSortStructure, readonly RunRow[]>();

/** One row per sorted run with its key range and the number of pixels it moved. Frozen and cached on the structure. */
export function pixelSortRunTable(structure: PixelSortStructure, sortKey: PixelSortValue): readonly RunRow[] {
  const cached = tables.get(structure);
  if (cached) return cached;
  const keys = gridStorage(valueField(structure.source, sortKey)), rows: RunRow[] = [];
  let slot = 0;
  for (const run of structure.runs.runs) {
    let low = Infinity, high = -Infinity, moved = 0;
    for (let k = 0; k < run.length; k++, slot++) {
      const value = keys[scanRunPixel(structure.runs, run, k)];
      if (value < low) low = value;
      if (value > high) high = value;
      if (structure.moves.to(slot) !== structure.moves.from(slot)) moved++;
    }
    rows.push(Object.freeze({ id: runId(run.x, run.y), index: run.index, line: run.line, x: run.x, y: run.y, length: run.length, keyMin: low, keyMax: high, moved }));
  }
  const table = Object.freeze(rows);
  tables.set(structure, table);
  return table;
}

/** The pixels that change place: pairs (to, from) of pixel indices, in run order. */
export interface MovedPixels { readonly count: number; to(i: number): number; from(i: number): number }
export function movedPixels(structure: PixelSortStructure): MovedPixels {
  const to: number[] = [], from: number[] = [];
  for (let slot = 0; slot < structure.moves.count; slot++) {
    const a = structure.moves.to(slot), b = structure.moves.from(slot);
    if (a !== b) { to.push(a); from.push(b); }
  }
  const toArray = Int32Array.from(to), fromArray = Int32Array.from(from);
  const at = (array: Int32Array) => (i: number): number => {
    if (!Number.isInteger(i) || i < 0 || i >= array.length) throw new Error(`Moved pixel ${i} is outside 0..${array.length - 1}`);
    return array[i];
  };
  return Object.freeze({ count: toArray.length, to: at(toArray), from: at(fromArray) });
}

// ------------------------------------------------------------------------------------ streaks

/** A maximal stretch of one scan line drawn as one mark: the pixels of one run (or of no run) that share a color. */
export interface PixelStreak {
  readonly id: string;
  /** Index into the run set, or -1 for pixels that were not sorted. */
  readonly run: number;
  readonly sorted: boolean;
  readonly line: number;
  /** First pixel of the streak in scan order, and the number of pixels it covers. */
  readonly x: number;
  readonly y: number;
  readonly length: number;
  /** sRGB bytes; alpha is 0 to 255 (straight). */
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export interface PixelStreaks {
  readonly width: number;
  readonly height: number;
  readonly direction: ScanDirection;
  readonly dx: number;
  readonly dy: number;
  readonly streaks: readonly PixelStreak[];
}

/** sRGB straight u8 with `channels` channels expanded to RGBA. */
function displayBytes(raster: Raster): Uint8ClampedArray {
  const hasAlpha = raster.alpha !== "none";
  const conversion = hasAlpha ? { colorSpace: "srgb" as const, alpha: "straight" as const, format: "u8" as const } : { colorSpace: "srgb" as const, format: "u8" as const };
  const display = raster.format === "u8" && raster.colorSpace === "srgb" && raster.alpha !== "premultiplied" ? raster : convertRaster(raster, conversion);
  const store = rasterStorage(display) as unknown as ArrayLike<number>, { channels } = display, P = display.width * display.height, out = new Uint8ClampedArray(P * 4);
  for (let p = 0; p < P; p++) {
    const s = p * channels, o = p * 4;
    if (channels === 1 || channels === 2) { out[o] = out[o + 1] = out[o + 2] = store[s]; out[o + 3] = channels === 2 ? store[s + 1] : 255; }
    else { out[o] = store[s]; out[o + 1] = store[s + 1]; out[o + 2] = store[s + 2]; out[o + 3] = channels === 4 ? store[s + 3] : 255; }
  }
  return out;
}

/** Palette entries as a gradient: t in [0, 1] runs through them in order, linear in encoded sRGB. */
function paletteColor(palette: readonly number[], t: number, out: number[]): void {
  const last = palette.length - 1;
  if (last === 0) { const c = palette[0] >>> 0; out[0] = (c >>> 16) & 255; out[1] = (c >>> 8) & 255; out[2] = c & 255; return; }
  const scaled = Math.min(last, Math.max(0, t) * last), i = Math.min(last - 1, Math.floor(scaled)), f = scaled - i;
  const a = palette[i] >>> 0, b = palette[i + 1] >>> 0;
  out[0] = Math.round(((a >>> 16) & 255) * (1 - f) + ((b >>> 16) & 255) * f);
  out[1] = Math.round(((a >>> 8) & 255) * (1 - f) + ((b >>> 8) & 255) * f);
  out[2] = Math.round((a & 255) * (1 - f) + (b & 255) * f);
}

/**
 * Merge the sorted image into streaks. A scan line is walked pixel by pixel; a streak ends where the run
 * changes, where a sorted color leaves `merge` (max channel difference, 0 to 1, from the streak's running
 * mean), or where an unsorted color differs at all. Unsorted pixels are therefore drawn exactly. With
 * `tint: "palette"` every pixel's color is first replaced by the palette gradient at its luma.
 * Failing: more than 40,000 streaks (raise the merge tolerance or lower the resolution).
 */
export function pixelSortStreaks(structure: PixelSortStructure, options: { show: PixelSortMarks["show"]; tint: PixelSortMarks["tint"]; merge: number; palette: readonly number[] }): PixelStreaks {
  checkOneOf("Draw", options.show, ["all", "sorted", "untouched"] as const);
  checkOneOf("Color", options.tint, ["image", "palette"] as const);
  check("Merge tolerance", options.merge, 0, 1);
  const { sorted: raster, runs } = structure, { width, height } = raster, { dx, dy } = runs, P = width * height;
  const bytes = displayBytes(raster);
  if (options.tint === "palette") {
    if (!Array.isArray(options.palette) || options.palette.length === 0) throw new Error("Composition needs packed RGB colors");
    const color = [0, 0, 0];
    for (let p = 0; p < P; p++) {
      paletteColor(options.palette, (0.2126 * bytes[p * 4] + 0.7152 * bytes[p * 4 + 1] + 0.0722 * bytes[p * 4 + 2]) / 255, color);
      bytes[p * 4] = color[0]; bytes[p * 4 + 1] = color[1]; bytes[p * 4 + 2] = color[2];
    }
  }
  const index = runIndexes.get(structure)!, tolerance = options.merge * 255, streaks: PixelStreak[] = [];
  let line = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = x - dx, py = y - dy;
    if (px >= 0 && px < width && py >= 0 && py < height) continue;
    let cx = x, cy = y, start = -1, count = 0, run = -2, r = 0, g = 0, b = 0, a = 0;
    const emit = (): void => {
      if (count === 0) return;
      const isSorted = run >= 0;
      if (options.show === "all" || (options.show === "sorted") === isSorted) {
        if (streaks.length >= PIXEL_SORTING_LIMITS.streaks)
          throw new Error(`Pixel sorting would draw more than ${PIXEL_SORTING_LIMITS.streaks} streaks: raise Merge tolerance or lower Resolution`);
        const sx = start % width, sy = Math.floor(start / width);
        streaks.push(Object.freeze({ id: `s:${sx}.${sy}`, run, sorted: isSorted, line, x: sx, y: sy, length: count,
          r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count), a: Math.round(a / count) }));
      }
      count = 0;
    };
    while (cx >= 0 && cx < width && cy >= 0 && cy < height) {
      const p = cy * width + cx, o = p * 4, pr = bytes[o], pg = bytes[o + 1], pb = bytes[o + 2], pa = bytes[o + 3], pixelRun = index[p];
      let joins = count > 0 && pixelRun === run;
      if (joins) {
        if (pixelRun < 0) joins = pr * count === r && pg * count === g && pb * count === b && pa * count === a;
        else joins = Math.max(Math.abs(pr - r / count), Math.abs(pg - g / count), Math.abs(pb - b / count), Math.abs(pa - a / count)) <= tolerance;
      }
      if (!joins) { emit(); start = p; run = pixelRun; r = g = b = a = 0; }
      r += pr; g += pg; b += pb; a += pa; count++;
      cx += dx; cy += dy;
    }
    emit();
    line++;
  }
  return Object.freeze({ width, height, direction: runs.direction, dx, dy, streaks: Object.freeze(streaks) });
}

/** Raster-space outline of `length` pixels from (x, y) along (dx, dy): a rectangle, or for a diagonal the exact staircase union of the pixel squares. */
export function runOutline(dx: number, dy: number, x: number, y: number, length: number): Point[] {
  if (dx === 0 || dy === 0) {
    const left = dx < 0 ? x - (length - 1) : x, top = dy < 0 ? y - (length - 1) : y, w = dx !== 0 ? length : 1, h = dy !== 0 ? length : 1;
    return [[left, top], [left + w, top], [left + w, top + h], [left, top + h]];
  }
  const X = (a: number): number => dx > 0 ? x + a : x + 1 - a, Y = (b: number): number => dy > 0 ? y + b : y + 1 - b;
  const points: Point[] = [[X(0), Y(0)]];
  for (let k = 0; k < length; k++) points.push([X(k + 1), Y(k)], [X(k + 1), Y(k + 1)]);
  for (let k = length - 1; k >= 0; k--) { points.push([X(k), Y(k + 1)]); if (k >= 1) points.push([X(k), Y(k)]); }
  return points;
}

// ------------------------------------------------------------------------------------ sites and paths

/** A streak as a site: canvas centre, direction of the scan in radians, and the canvas size of the bar in its local frame (x along the scan, y across it). */
export interface StreakSite extends Site {
  readonly streak: PixelStreak;
  /** Canvas length of the covered pixels along the scan. */
  readonly length: number;
  /** Canvas distance between neighbouring scan lines: the bar's thickness (for a diagonal, the streak is the staircase union of its pixels, not this rectangle). */
  readonly breadth: number;
}

/** Canvas units of one pixel step along the scan, and of the spacing between neighbouring scan lines. */
function scanScale(dx: number, dy: number, mapping: RasterMapping): { step: number; breadth: number; angle: number } {
  const sx = mapping.scaleX, sy = mapping.scaleY, step = Math.hypot(dx * sx, dy * sy);
  const breadth = dx === 0 ? sx : dy === 0 ? sy : (sx * sy) / Math.hypot(sx, sy);
  return { step, breadth, angle: Math.atan2(dy * sy, dx * sx) };
}

/** Streaks placed on the canvas as sites, with seeds `componentSeed(seed, streak id, "streak")`; tone 1 for sorted streaks, 0 for the rest. */
export function pixelSortStreakSites(streaks: PixelStreaks, mapping: RasterMapping, seed: number): readonly StreakSite[] {
  const { step, breadth, angle } = scanScale(streaks.dx, streaks.dy, mapping);
  return Object.freeze(streaks.streaks.map((streak): StreakSite => {
    const half = (streak.length - 1) / 2;
    const [x, y] = mapping.toCanvas(streak.x + 0.5 + half * streaks.dx, streak.y + 0.5 + half * streaks.dy);
    return Object.freeze({ id: streak.id, seed: componentSeed(seed, streak.id, "streak"), position: Object.freeze([x, y]) as Point, angle, scale: 1,
      tone: streak.sorted ? 1 : 0, streak, length: streak.length * step, breadth });
  }));
}

/** The outline of every sorted run as a closed canvas path (`run:<x>.<y>`), tone 0. Failing: more than 4,000 runs (raise Shortest run, narrow the interval, or turn the outlines off). */
export function pixelSortRunPaths(structure: PixelSortStructure, mapping: RasterMapping, seed: number): readonly Path[] {
  const { runs } = structure;
  if (runs.runs.length > PIXEL_SORTING_LIMITS.outlinedRuns)
    throw new Error(`Pixel sorting has ${runs.runs.length} runs to outline; the limit is ${PIXEL_SORTING_LIMITS.outlinedRuns}: raise Shortest run, narrow the interval or set Run outlines to None`);
  return Object.freeze(runs.runs.map((run): Path => {
    const id = runId(run.x, run.y);
    return Object.freeze({ id, seed: componentSeed(seed, id, "run"), closed: true, level: run.line, levelFraction: 0, tone: 0,
      points: Object.freeze(runOutline(runs.dx, runs.dy, run.x, run.y, run.length).map(([x, y]) => Object.freeze(mapping.toCanvas(x, y)) as Point)) });
  }));
}

// ------------------------------------------------------------------------------------ drawing

function mappingOf(recipe: PixelSortRecipe, structure: PixelSortStructure): RasterMapping {
  const { centerX, centerY, width, height } = recipe.footprint;
  return rasterMapping(structure.source, { x: centerX - width / 2, y: centerY - height / 2, width, height });
}

/** The stock streak marks, in one style batch: bars fill the pixels' exact union, stitches are round-capped strokes along the scan. */
function paintStreaks(surface: CompositionSurface, streaks: PixelStreaks, mapping: RasterMapping, marks: PixelSortMarks, run: CompositionRun): void {
  const { dx, dy } = streaks, { step, breadth } = scanScale(dx, dy, mapping), axis = dx === 0 || dy === 0;
  surface.push();
  try {
    if (marks.kind === "bars") {
      surface.strokeWeight(Math.min(0.35, 0.15 * Math.min(mapping.scaleX, mapping.scaleY)));
      for (const s of streaks.streaks) {
        run.check();
        surface.fill(s.r, s.g, s.b, s.a);
        if (s.a === 255) surface.stroke(s.r, s.g, s.b, s.a); else surface.noStroke();
        const outline = runOutline(dx, dy, s.x, s.y, s.length);
        if (axis) {
          const [x, y] = mapping.toCanvas(outline[0][0], outline[0][1]);
          surface.rect(x, y, (outline[1][0] - outline[0][0]) * mapping.scaleX, (outline[3][1] - outline[0][1]) * mapping.scaleY);
        } else {
          surface.beginShape();
          for (const [px, py] of outline) { const [x, y] = mapping.toCanvas(px, py); surface.vertex(x, y); }
          surface.endShape(surface.CLOSE);
        }
      }
    } else {
      const weight = marks.stitchWidth * breadth, trim = (marks.stitchGap * step) / 2 + weight / 2, ux = dx * mapping.scaleX / step, uy = dy * mapping.scaleY / step;
      surface.noFill(); surface.strokeCap(surface.ROUND); surface.strokeWeight(weight);
      for (const s of streaks.streaks) {
        run.check();
        surface.stroke(s.r, s.g, s.b, s.a);
        const [ax, ay] = mapping.toCanvas(s.x + 0.5, s.y + 0.5), [bx, by] = mapping.toCanvas(s.x + 0.5 + (s.length - 1) * dx, s.y + 0.5 + (s.length - 1) * dy);
        const inset = step / 2 - trim, cx = (ax + bx) / 2, cy = (ay + by) / 2, half = Math.hypot(bx - ax, by - ay) / 2 + inset;
        const reach = Math.max(0, half);
        surface.line(cx - ux * reach, cy - uy * reach, cx + ux * reach, cy + uy * reach);
      }
    }
  } finally { surface.pop(); }
}

export interface PixelSortConsumers {
  /** Replace the stock bar or stitch: called once per streak through `atEach`, in the streak's local frame, charged to the run budget. */
  streak?: (surface: CompositionSurface, site: StreakSite, run: CompositionRun) => void;
  /** Replace the path material that draws run outlines. */
  outline?: PathMaterial;
}

function outlineSpec(outline: PixelSortRecipe["outline"]): PathMaterialSpec {
  const mark = { kind: "dot" as const, size: 3, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 };
  return { kind: outline.kind === "stitch" ? "stitch" : "ink", weight: outline.weight, spacing: outline.spacing, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark };
}

/** Work the stock stitch material charges for these outlines: per path one callback, its vertices, and two units per station. */
function checkOutlineWork(recipe: PixelSortRecipe, paths: readonly Path[]): void {
  if (recipe.outline.kind !== "stitch") return;
  let work = 0;
  for (const path of paths) {
    let length = 0;
    for (let i = 0; i < path.points.length; i++) {
      const a = path.points[i], b = path.points[(i + 1) % path.points.length];
      length += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    work += 1 + path.points.length + 2 * Math.max(1, Math.ceil(length / recipe.outline.spacing));
  }
  if (work > PIXEL_SORTING_LIMITS.work)
    throw new Error(`Stitched run outlines would need ${work} work units; the limit is ${PIXEL_SORTING_LIMITS.work}: raise Outline stitch spacing or Shortest run, narrow the interval, or use ink outlines`);
}

/**
 * Draw into a caller-owned surface, transparent: streaks (stock or a `streak` consumer), then run outlines.
 * Nothing clears the canvas or paints outside the footprint.
 */
export function drawPixelSorting(surface: CompositionSurface, recipe: PixelSortRecipe, consumers: PixelSortConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: PIXEL_SORTING_LIMITS.work })): void {
  run.check();
  checkConstruction(recipe); checkAppearance(recipe);
  const structure = pixelSortStructure(recipe), mapping = mappingOf(recipe, structure);
  const streaks = pixelSortStreaks(structure, { show: recipe.marks.show, tint: recipe.marks.tint, merge: recipe.marks.merge, palette: recipe.palette });
  const paths = recipe.outline.kind !== "none" || consumers.outline ? pixelSortRunPaths(structure, mapping, recipe.seed) : null;
  if (paths && !consumers.outline) checkOutlineWork(recipe, paths);
  if (consumers.streak) atEach(surface, pixelSortStreakSites(streaks, mapping, recipe.seed), consumers.streak, run);
  else paintStreaks(surface, streaks, mapping, recipe.marks, run);
  if (paths) strokeWith(surface, paths, consumers.outline ?? pathMaterial(outlineSpec(recipe.outline), recipe.palette), run);
}

/** Build (and bound-check) the structure, the streaks and the outlines, yielding once; false if cancelled. */
export async function preparePixelSorting(recipe: PixelSortRecipe, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  checkConstruction(recipe); checkAppearance(recipe);
  const structure = pixelSortStructure(recipe), mapping = mappingOf(recipe, structure);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  if (cancelled()) return false;
  pixelSortStreaks(structure, { show: recipe.marks.show, tint: recipe.marks.tint, merge: recipe.marks.merge, palette: recipe.palette });
  if (recipe.outline.kind !== "none") checkOutlineWork(recipe, pixelSortRunPaths(structure, mapping, recipe.seed));
  return !cancelled();
}

// ------------------------------------------------------------------------------------ named-instrument binding

/**
 * The bundled variant each sample uses in the instrument. Variants re-arrange and re-tint a sample
 * (see `bundledRaster`); the instrument fixes one so the subject does not change with the seed.
 */
const IMAGE_VARIANT: Readonly<Record<BundledRasterId, number>> = Object.freeze({ portrait: 3, geometry: 3, landscape: 3, noise: 3 });

type Scalar = number | string | boolean;

/**
 * Resolve the stored scalar controls to the public recipe. The bundled image is named by id, size and
 * variant. Controls that do not apply to the current choices never reach the recipe.
 */
export function pixelSortingComposition(input: InstrumentInput): PixelSortRecipe {
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((rgb) => !Number.isSafeInteger(rgb) || rgb < 0 || rgb > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(pixelSortingDefinition, input.params) as Record<string, Scalar>;
  const id = q.image as BundledRasterId, protect = q.protect as string;
  let mask: PixelSortMask | null = null;
  if (protect === "ellipse") mask = { kind: "ellipse", x: q.focusX as number, y: q.focusY as number, width: q.focusWidth as number, height: q.focusHeight as number };
  else if (protect === "region") mask = { kind: "region", x: q.focusX as number, y: q.focusY as number, bands: q.bands as number, grow: q.grow as number };
  else if (protect === "edges") mask = { kind: "edges", share: q.share as number, grow: q.grow as number };
  else if (protect === "field") mask = { kind: "field", share: q.share as number, scale: q.fieldScale as number };
  const from = q.selectFrom as number, stitches = q.mark === "stitches", show = q.show as PixelSortMarks["show"];
  return {
    kind: "pixel-sorting", seed: input.seed, palette: [...input.palette],
    image: { kind: "bundled", id, size: q.resolution as number, variant: IMAGE_VARIANT[id] },
    runs: { direction: q.direction as ScanDirection, select: { value: q.selectBy as PixelSortValue, from, to: Math.min(1, from + (q.selectSpan as number)) },
      minRun: q.minRun as number, maxRun: q.limitRuns === true ? q.maxRun as number : null,
      ragged: q.ragged === true && (q.scatter as number) > 0 ? { amount: q.scatter as number, scale: q.scatterScale as number } : null },
    sort: { key: q.keyBy as PixelSortValue, order: q.order as "ascending" | "descending" },
    mask, maskRole: mask ? q.maskRole as "protect" | "select" : "protect",
    footprint: { centerX: q.centerX as number, centerY: q.centerY as number, width: q.width as number, height: q.height as number },
    marks: { show, tint: q.tint as PixelSortMarks["tint"], kind: q.mark as PixelSortMarks["kind"], merge: show === "untouched" ? 0 : q.merge as number,
      stitchWidth: stitches ? q.stitchWidth as number : 1, stitchGap: stitches ? q.stitchGap as number : 0 },
    outline: { kind: q.runLines as "none" | "ink" | "stitch", weight: q.runLines === "none" ? 1 : q.lineWeight as number, spacing: q.runLines === "stitch" ? q.lineSpacing as number : 6 },
  };
}

/** Whether the seed can change this instrument's construction: only the ragged field and the noise mask are chance. */
export function pixelSortingUsesSeed(q: InstrumentInput["params"]): boolean {
  const fullRange = Number(q.selectFrom) <= 0 && Number(q.selectFrom) + Number(q.selectSpan) >= 1;
  const share = Number(q.share);
  return (q.ragged === true && Number(q.scatter) > 0 && !fullRange) || (q.protect === "field" && share > 0 && share < 1);
}
