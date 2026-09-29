import { componentSeed } from "./core.js";
import { orientationField, orientationInRect, subdivideImage, IMAGE_STRUCTURE_LIMITS } from "./image-structure.js";
import type { OrientationSample, SplitPolicy, SubdivisionMetric } from "./image-structure.js";
import { convertRaster, cropRaster, gridStorage, linearToSrgb, rasterMapping, rasterStorage, valueField } from "./raster.js";
import type { Raster, RasterMapping, ValueKind } from "./raster.js";
import type { Region } from "./types.js";

/**
 * Adaptive image compartments: the PRODUCER of Adaptive Compartments (brief 30).
 *
 * `compartmentPlan` takes a resolved `Raster` (the library never fetches or decodes: bundled samples come from
 * `bundledRaster`, a host binds user images later), crops it, places the crop on a canvas rectangle and divides
 * it by adaptive error subdivision (`subdivideImage`, the foundation quadtree): a cell is split while its error
 * exceeds `threshold`, or while a side exceeds `maxCell`, and never below `minCell`. Flat areas therefore stay
 * as a few large compartments and busy areas become many small ones. Each LEAF becomes a `Compartment` with
 * attributes measured on its own pixels: mean value, error, spread (standard deviation), mean COLOR (averaged in
 * linear light, weighted by alpha, published as straight sRGB), tone (CIE L* / 100 of that color), coverage (mean
 * alpha) and the cell's dominant orientation (structure tensor averaged over the cell, then decomposed).
 *
 * Units. `minCell`, `maxCell`, `smoothing` and the area are CANVAS units; the crop is in source pixels. The raster
 * is mapped onto the area with independent x and y scales (`rasterMapping`), so the crop always fills the area
 * exactly: `coverCrop` picks a crop whose aspect matches the area to within one source pixel (that is the only
 * stretch). `minCell` is converted to whole pixels rounding UP (a cell side is never smaller than requested);
 * `maxCell` rounds DOWN. Orientation angles are radians (foundation convention) and unsigned in [0, pi).
 *
 * Identity and chance. Compartment ids are the foundation's path ids (`r`, `r.0`, `r.0.3`): raising the
 * threshold only ever adds descendants and never renames or moves an existing cell. The partition and every
 * attribute are a pure function of the source CONTENT and the construction options: no random source is
 * consulted, and nothing a filler does can change them. `seed` only labels each cell (`componentSeed`), and it
 * decides which cells a `keepCompartments` chance rule and the drawing's stable choices affect. Appearance
 * (colors, marks, materials, gutter, retention) is never an input, so the plan is cached by construction only:
 * the source hash, crop, area, measure, metric, threshold, cell limits, split policy and smoothing (plus the seed
 * for the labelled cells; the expensive analysis is shared between seeds).
 *
 * Ownership. Plans, cells and nodes are deeply frozen. A plan is cached (12 plans, 6 analyses); it holds no
 * reference to the source raster.
 *
 * Bounds (nothing is truncated; each failure names the control to change): source pixels at most
 * `IMAGE_STRUCTURE_LIMITS.pixels`; at most `maxCells` compartments (default 4096, at most 20,000).
 */
export interface PixelRect { x: number; y: number; width: number; height: number }

export type CompartmentMeasure = "lightness" | "luminance" | "luma" | "saturation" | "alpha";
const MEASURES: readonly CompartmentMeasure[] = ["lightness", "luminance", "luma", "saturation", "alpha"];
const METRICS: readonly SubdivisionMetric[] = ["variance", "stddev", "range", "sse"];
const SPLITS: readonly SplitPolicy[] = ["quad", "longest", "best"];

export const COMPARTMENT_LIMITS = Object.freeze({ cells: 20_000, defaultCells: 4096, sourcePixels: IMAGE_STRUCTURE_LIMITS.pixels, side: 4096 });

export interface CompartmentOptions {
  /** Labels every compartment through `componentSeed`; never changes the partition. uint32. */
  seed: number;
  source: Raster;
  /** Integer source-pixel rectangle; default the whole raster. See `coverCrop`. */
  crop?: PixelRect;
  /** Canvas rectangle the crop is fitted to, in canvas units. */
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  /** Value the error is measured on (`lightness` = CIE L* / 100; `saturation` is HSV). Transparent pixels are composited over white. */
  measure: CompartmentMeasure;
  /** `variance`, `stddev`, `range` (max - min) or `sse` (pixels x variance), all in `measure` units. */
  metric: SubdivisionMetric;
  /** A cell splits while its error is greater than this (>= 0). */
  threshold: number;
  /** Smallest cell side in canvas units (rounded up to whole source pixels). */
  minCell: number;
  /** Cells with a side above this always split (canvas units, rounded down to pixels; at least twice the smallest cell). Default: none. */
  maxCell?: number;
  split: SplitPolicy;
  /** Gaussian smoothing of the orientation tensor in canvas units (0..64 pixels once converted). */
  smoothing: number;
  /** Compartment bound, default 4096, at most 20,000. */
  maxCells?: number;
}

export interface Compartment {
  /** Path id from the subdivision: `r` root, `.k` per level. Stable under every appearance edit and under a higher threshold. */
  readonly id: string;
  readonly seed: number;
  readonly parent: string | null;
  readonly depth: number;
  /** Position in plan order (a Z-order of the leaves). */
  readonly order: number;
  /** Canvas [left, top, right, bottom]; the leaves tile the area exactly. */
  readonly bounds: readonly [number, number, number, number];
  readonly width: number;
  readonly height: number;
  readonly area: number;
  /** The cell in SOURCE raster pixels (crop offset included). */
  readonly pixels: Readonly<PixelRect>;
  /** Mean of `measure` over the cell, [0, 1]. */
  readonly value: number;
  /** The chosen metric over the cell, in its own units. */
  readonly error: number;
  /** Standard deviation of `measure` over the cell. */
  readonly spread: number;
  /** True when `error <= threshold`: the cell is quiet at its own scale. False means the error is still above the threshold and only `minCell` stopped the splitting. */
  readonly resolved: boolean;
  /** Mean color, straight sRGB in [0, 1] (averaged in linear light, weighted by alpha). Black where coverage is 0. */
  readonly color: readonly [number, number, number];
  /** CIE L* / 100 of the mean color, [0, 1]; 0 where coverage is 0. */
  readonly tone: number;
  /** Mean alpha over the cell, [0, 1] (1 for a raster without alpha). */
  readonly coverage: number;
  /** Dominant orientation of the cell; `defined` false with the fallback direction 0 where the cell is flat. */
  readonly orientation: OrientationSample;
}

export interface CompartmentNode {
  readonly id: string;
  readonly parent: string | null;
  readonly depth: number;
  readonly bounds: readonly [number, number, number, number];
  readonly value: number;
  readonly error: number;
  readonly children: readonly string[];
  readonly terminal: boolean;
}

export interface CompartmentPlan {
  /** SHA-256 of the source raster's canonical bytes (asset identity). */
  readonly sourceHash: string;
  readonly crop: Readonly<PixelRect>;
  /** Cropped raster pixels to canvas. */
  readonly mapping: RasterMapping;
  /** Pixel limits actually used after unit conversion. */
  readonly minCellPixels: number;
  readonly maxCellPixels: number | null;
  readonly threshold: number;
  readonly metric: SubdivisionMetric;
  /** Leaves in Z-order: the compartments. */
  readonly cells: readonly Compartment[];
  /** Every node of the region tree, parents first. */
  readonly tree: readonly CompartmentNode[];
}

const frozenRect = (r: PixelRect): Readonly<PixelRect> => Object.freeze({ x: r.x, y: r.y, width: r.width, height: r.height });

function finite(name: string, v: unknown, low: number, high: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < low || v > high) throw new Error(`Compartments: ${name} must be a number in [${low}, ${high}] (got ${String(v)})`);
  return v;
}

/**
 * A crop that fills an area of the given aspect (width / height) from the source, `zoom` times closer than
 * the largest crop of that aspect. `focusX`/`focusY` in [0, 1] slide it over the available travel (0 the
 * top/left, 1 the bottom/right). Sides are rounded to whole pixels independently, so the crop's aspect can
 * differ from the requested one by at most one source pixel per side.
 */
export function coverCrop(source: { width: number; height: number }, aspect: number, zoom: number, focusX: number, focusY: number): PixelRect {
  finite("aspect", aspect, 1e-3, 1e3); finite("zoom", zoom, 1, 64); finite("focusX", focusX, 0, 1); finite("focusY", focusY, 0, 1);
  const fits = source.width / source.height >= aspect;
  const baseHeight = fits ? source.height : source.width / aspect, baseWidth = fits ? source.height * aspect : source.width;
  const width = Math.min(source.width, Math.max(1, Math.round(baseWidth / zoom))), height = Math.min(source.height, Math.max(1, Math.round(baseHeight / zoom)));
  return { x: Math.round(focusX * (source.width - width)), y: Math.round(focusY * (source.height - height)), width, height };
}

interface Analysis {
  sourceHash: string;
  crop: Readonly<PixelRect>;
  mapping: RasterMapping;
  minCellPixels: number;
  maxCellPixels: number | null;
  threshold: number;
  metric: SubdivisionMetric;
  cells: Omit<Compartment, "seed">[];
  tree: readonly CompartmentNode[];
}

const ANALYSES = new Map<string, Analysis>(), PLANS = new Map<string, CompartmentPlan>();
const remember = <T>(map: Map<string, T>, key: string, value: T, size: number): T => {
  map.set(key, value);
  if (map.size > size) map.delete(map.keys().next().value!);
  return value;
};
const recall = <T>(map: Map<string, T>, key: string): T | undefined => {
  const hit = map.get(key);
  if (hit !== undefined) { map.delete(key); map.set(key, hit); }
  return hit;
};

/** CIE L* / 100 from linear luminance. */
function lightness(y: number): number {
  return (y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y) / 100;
}

function analyse(o: CompartmentOptions, crop: PixelRect, maxCells: number): Analysis {
  const cropped = cropRaster(o.source, crop);
  const mapping = rasterMapping(cropped, { x: o.centerX - o.width / 2, y: o.centerY - o.height / 2, width: o.width, height: o.height });
  const minPx = Math.max(1, Math.ceil(o.minCell / Math.min(mapping.scaleX, mapping.scaleY)));
  let maxPx: number | null = null;
  if (o.maxCell !== undefined) {
    maxPx = Math.floor(o.maxCell / Math.max(mapping.scaleX, mapping.scaleY));
    if (maxPx < 2 * minPx - 1)
      throw new Error(`Compartments: maxCell ${o.maxCell} is too small for minCell ${o.minCell} at this source scale (${mapping.scaleX.toFixed(3)} canvas units per pixel); raise maxCell to at least ${Math.ceil((2 * minPx - 1) * Math.max(mapping.scaleX, mapping.scaleY))} or lower minCell`);
  }
  let division;
  try {
    division = subdivideImage(cropped, { value: o.measure as ValueKind, metric: o.metric, threshold: o.threshold, minCell: minPx,
      ...(maxPx === null ? {} : { maxCell: maxPx }), split: o.split, maxCells });
  } catch (error) {
    if (error instanceof Error && /more than \d+ cells/.test(error.message))
      throw new Error(`Compartments: the partition needs more than ${maxCells} cells; raise threshold, raise minCell or raise maxCell`);
    throw error;
  }
  const smoothPx = o.smoothing / Math.min(mapping.scaleX, mapping.scaleY);
  if (smoothPx > 64) throw new Error(`Compartments: smoothing ${o.smoothing} is more than 64 source pixels at this scale; lower smoothing`);
  const field = orientationField(cropped, { value: o.measure as ValueKind, smoothing: smoothPx });
  const values = gridStorage(valueField(cropped, o.measure as ValueKind));
  const hasAlpha = cropped.alpha !== "none";
  const linear = rasterStorage(convertRaster(cropped, hasAlpha ? { colorSpace: "linear", alpha: "premultiplied", format: "f32" } : { colorSpace: "linear", format: "f32" }));
  const ch = cropped.channels, colorChannels = hasAlpha ? ch - 1 : ch;
  const cells: Omit<Compartment, "seed">[] = [];
  division.leaves.forEach((leaf, order) => {
    const { x, y, width: w, height: h } = leaf, n = w * h;
    let variance = 0, r = 0, g = 0, b = 0, a = 0;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const p = j * cropped.width + i, d = values[p] - leaf.mean;
      variance += d * d;
      const base = p * ch;
      // Premultiplied linear color; gray channels feed all three.
      if (colorChannels === 1) { const c = linear[base]; r += c; g += c; b += c; } else { r += linear[base]; g += linear[base + 1]; b += linear[base + 2]; }
      a += hasAlpha ? linear[base + ch - 1] : 1;
    }
    const coverage = a / n;
    let color: [number, number, number] = [0, 0, 0], tone = 0;
    if (a > 0) {
      const lr = r / a, lg = g / a, lb = b / a;
      color = [linearToSrgb(Math.min(1, lr)), linearToSrgb(Math.min(1, lg)), linearToSrgb(Math.min(1, lb))];
      tone = lightness(0.2126 * lr + 0.7152 * lg + 0.0722 * lb);
    }
    const [left, top] = mapping.toCanvas(x, y), [right, bottom] = mapping.toCanvas(x + w, y + h);
    cells.push(Object.freeze({
      id: leaf.id, parent: leaf.parent, depth: leaf.depth, order, bounds: Object.freeze([left, top, right, bottom] as const), width: right - left, height: bottom - top,
      area: (right - left) * (bottom - top), pixels: frozenRect({ x: crop.x + x, y: crop.y + y, width: w, height: h }),
      value: leaf.mean, error: leaf.error, spread: Math.sqrt(variance / n), resolved: leaf.error <= o.threshold,
      color: Object.freeze(color), tone: Math.min(1, Math.max(0, tone)), coverage: Math.min(1, coverage),
      orientation: orientationInRect(field, { x, y, width: w, height: h }),
    }));
  });
  const tree = division.nodes.map((node): CompartmentNode => {
    const [left, top] = mapping.toCanvas(node.x, node.y), [right, bottom] = mapping.toCanvas(node.x + node.width, node.y + node.height);
    return Object.freeze({ id: node.id, parent: node.parent, depth: node.depth, bounds: Object.freeze([left, top, right, bottom] as const),
      value: node.mean, error: node.error, children: node.children, terminal: node.children.length === 0 });
  });
  return { sourceHash: o.source.hash, crop: frozenRect(crop), mapping, minCellPixels: minPx, maxCellPixels: maxPx, threshold: o.threshold, metric: o.metric,
    cells, tree: Object.freeze(tree) };
}

/** The compartment plan for these options; cached by construction, deeply frozen. See the module header for every rule. */
export function compartmentPlan(options: CompartmentOptions): CompartmentPlan {
  if (options === null || typeof options !== "object") throw new Error("Compartments: options are required");
  const o = options;
  if (!Number.isSafeInteger(o.seed) || o.seed < 0 || o.seed > 0xffffffff) throw new Error("Compartments: seed must be a uint32 integer");
  if (o.source === null || typeof o.source !== "object" || !("hash" in o.source)) throw new Error("Compartments: source must be a Raster (createRaster or bundledRaster)");
  finite("centerX", o.centerX, -1e5, 1e5); finite("centerY", o.centerY, -1e5, 1e5);
  finite("width", o.width, 1, COMPARTMENT_LIMITS.side); finite("height", o.height, 1, COMPARTMENT_LIMITS.side);
  if (!MEASURES.includes(o.measure)) throw new Error(`Compartments: measure must be one of ${MEASURES.join(", ")}`);
  if (!METRICS.includes(o.metric)) throw new Error(`Compartments: metric must be one of ${METRICS.join(", ")}`);
  if (!SPLITS.includes(o.split)) throw new Error(`Compartments: split must be one of ${SPLITS.join(", ")}`);
  finite("threshold", o.threshold, 0, Infinity);
  finite("minCell", o.minCell, 0.25, 2000);
  if (o.maxCell !== undefined) finite("maxCell", o.maxCell, 2 * o.minCell, 1e6);
  finite("smoothing", o.smoothing, 0, 1e4);
  const maxCells = o.maxCells === undefined ? COMPARTMENT_LIMITS.defaultCells : finite("maxCells", o.maxCells, 1, COMPARTMENT_LIMITS.cells);
  if (!Number.isInteger(maxCells)) throw new Error("Compartments: maxCells must be an integer");
  const crop = o.crop ?? { x: 0, y: 0, width: o.source.width, height: o.source.height };
  for (const [name, v] of [["x", crop.x], ["y", crop.y], ["width", crop.width], ["height", crop.height]] as const)
    if (!Number.isInteger(v)) throw new Error(`Compartments: crop.${name} must be an integer`);
  if (crop.x < 0 || crop.y < 0 || crop.width < 1 || crop.height < 1 || crop.x + crop.width > o.source.width || crop.y + crop.height > o.source.height)
    throw new Error(`Compartments: crop ${crop.x},${crop.y} ${crop.width} x ${crop.height} must lie inside the ${o.source.width} x ${o.source.height} source`);
  if (crop.width * crop.height > COMPARTMENT_LIMITS.sourcePixels)
    throw new Error(`Compartments: the crop has ${crop.width * crop.height} pixels; the limit is ${COMPARTMENT_LIMITS.sourcePixels}: raise zoom or lower the source resolution`);
  const construction = JSON.stringify([o.source.hash, crop.x, crop.y, crop.width, crop.height, o.centerX, o.centerY, o.width, o.height, o.measure, o.metric,
    o.threshold, o.minCell, o.maxCell ?? null, o.split, o.smoothing, maxCells]);
  const planKey = `${o.seed}|${construction}`, cachedPlan = recall(PLANS, planKey);
  if (cachedPlan) return cachedPlan;
  const analysis = recall(ANALYSES, construction) ?? remember(ANALYSES, construction, analyse(o, crop, maxCells), 6);
  const cells = Object.freeze(analysis.cells.map((cell): Compartment => Object.freeze({ ...cell, seed: componentSeed(o.seed, cell.id, "compartment") })));
  const plan: CompartmentPlan = Object.freeze({ sourceHash: analysis.sourceHash, crop: analysis.crop, mapping: analysis.mapping, minCellPixels: analysis.minCellPixels,
    maxCellPixels: analysis.maxCellPixels, threshold: analysis.threshold, metric: analysis.metric, cells, tree: analysis.tree });
  return remember(PLANS, planKey, plan, 12);
}

/** How a retained fraction picks the cells that stay: a stable hash draw, or a rank by an attribute. */
export type KeepRule = "chance" | "detailed" | "quiet" | "dark" | "light";
export const keepRules: readonly KeepRule[] = Object.freeze(["chance", "detailed", "quiet", "dark", "light"] as const);

const U32 = 0x1_0000_0000;
const unit = (cell: Compartment, purpose: string): number => componentSeed(cell.seed, cell.id, purpose) / U32;

/**
 * The compartments that stay, in plan order. Only cells with coverage above 0 compete. `chance` keeps a cell when its own
 * stable draw is below `fraction` (so raising the fraction only adds cells and no traversal order matters).
 * The other rules rank the cells by an attribute (`detailed` largest error first, `quiet` smallest error first,
 * `dark` lowest tone first, `light` highest first; ties are broken by a stable per-cell draw) and keep the first
 * round(fraction x count): raising the fraction only adds cells here too.
 */
export function keptCompartments(plan: CompartmentPlan, fraction: number, by: KeepRule): readonly Compartment[] {
  finite("retained", fraction, 0, 1);
  if (!keepRules.includes(by)) throw new Error(`Compartments: keepBy must be one of ${keepRules.join(", ")}`);
  const candidates = plan.cells.filter((cell) => cell.coverage > 0);
  if (fraction >= 1) return Object.freeze(candidates);
  if (by === "chance") return Object.freeze(candidates.filter((cell) => unit(cell, "keep") < fraction));
  const key = (cell: Compartment): number => by === "detailed" ? -cell.error : by === "quiet" ? cell.error : by === "dark" ? cell.tone : -cell.tone;
  const ranked = candidates.slice().sort((a, b) => key(a) - key(b) || unit(a, "keep-tie") - unit(b, "keep-tie") || (a.id < b.id ? -1 : 1));
  const keep = new Set(ranked.slice(0, Math.round(fraction * ranked.length)).map((cell) => cell.id));
  return Object.freeze(candidates.filter((cell) => keep.has(cell.id)));
}

/** A compartment as the region a filler draws in: `bounds` are inset by half the gutter, `cell` carries every attribute. */
export interface CompartmentRegion extends Region {
  readonly cell: Compartment;
}

/**
 * Regions for `inside`: each cell inset by half the gutter on every side, so neighbours end up a gutter apart.
 * A cell whose inset width or height would be 0 or less produces no region. Ids and seeds are the cells'.
 */
export function compartmentRegions(cells: readonly Compartment[], gutter: number): readonly CompartmentRegion[] {
  finite("gutter", gutter, 0, 1000);
  const half = gutter / 2, regions: CompartmentRegion[] = [];
  for (const cell of cells) {
    const [l, t, r, b] = cell.bounds;
    if (r - l - gutter <= 0 || b - t - gutter <= 0) continue;
    regions.push(Object.freeze({ id: cell.id, seed: cell.seed, bounds: Object.freeze([l + half, t + half, r - half, b - half] as const), cell }));
  }
  return Object.freeze(regions);
}
