import { bundledRaster, bundledRasterIds } from "./raster-samples.js";
import type { BundledRasterId } from "./raster-samples.js";
import { IMAGE_STRUCTURE_LIMITS } from "./image-structure.js";
import { adoptScalarGrid, gridStorage, sampleGrid, valueField } from "./raster.js";
import type { Raster, ScalarGrid } from "./raster.js";

/**
 * The tone field of an engraving: one scalar in [0, 1] per point of the footprint, derived from an
 * owned raster and never from a canvas.
 *
 * Coordinates. The FOOTPRINT is a rectangle of `width` x `height` canvas units centred on the local origin
 * (x right, y down); the picture's frame, and every carrier and line built from this field, uses these local
 * coordinates until the final placement. The IMAGE is placed inside it by `fit`: `contain` keeps the aspect and
 * shows the whole image (centred), `cover` keeps the aspect and fills the footprint (the overflow is cropped by
 * the clip), `stretch` maps the image onto the footprint with independent x and y scales. The image rectangle is
 * `image` = [x0, y0, x1, y1].
 *
 * Tone. `dark` encodes 1 - L* / 100 (CIE lightness of the linear-light colour, `valueField` "lightness"), so a
 * black pixel is 1 and paper is 0; `light` encodes L* / 100. Transparent pixels are composited over the EMPTY
 * level (white paper for `dark`, black for `light`), so a transparent pixel is tone 0 either way and becomes
 * negative space. An optional region `mask` (a `ScalarGrid` of the raster's size, for example `valueRegionMask`)
 * sets the tone of every pixel with mask < 0.5 to 0 before smoothing.
 *
 * Smoothing. `smoothing` is a length in canvas units. 0 uses the raster's own pixels. Otherwise the tone grid is
 * the EXACT AREA AVERAGE of the raster tone over cells about `smoothing` units wide (never finer than the raster:
 * a cell is at least one pixel), which is the anti-alias filter for a line pattern coarser than the image; the
 * value is then read bilinearly at pixel centres (`sampleGrid`) with the edge clamped, so the field is
 * continuous and outside the image it repeats the edge tone.
 *
 * Failure: invalid extents, an unknown fit or source, a mask of another size or a raster over 4,194,304 pixels
 * throw naming the argument. The result is deeply frozen and cached by CONSTRUCTION only (source content,
 * footprint size, fit, encoding, smoothing); no threshold, curve, palette or material reaches it.
 */
export const BUNDLED_SOURCE_SIZE = 256;
export const TONE_LIMITS = Object.freeze({ footprint: 4096, smoothing: 200, sourcePixels: IMAGE_STRUCTURE_LIMITS.pixels });

export type FitMode = "contain" | "cover" | "stretch";
export type ToneEncoding = "dark" | "light";
export const fitModes: readonly FitMode[] = Object.freeze(["contain", "cover", "stretch"] as const);
export const toneEncodings: readonly ToneEncoding[] = Object.freeze(["dark", "light"] as const);

/** A bundled deterministic sample (the only kind a saved instrument can name) or a resolved raster the caller owns. */
export type ToneSource =
  | { kind: "bundled"; id: BundledRasterId; variant: number; mask?: ScalarGrid }
  | { kind: "raster"; raster: Raster; mask?: ScalarGrid };

export interface ToneOptions {
  source: ToneSource;
  /** Footprint size in canvas units, 1..4096 each. */
  width: number;
  height: number;
  fit: FitMode;
  encode: ToneEncoding;
  /** Smoothing length in canvas units, 0..200. */
  smoothing: number;
}

export interface ToneField {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  /** Local rectangle [x0, y0, x1, y1] of the image inside the footprint. */
  readonly image: readonly [number, number, number, number];
  readonly columns: number;
  readonly rows: number;
  /** The tone grid over the image rectangle, values in [0, 1]. */
  readonly grid: ScalarGrid;
  readonly encode: ToneEncoding;
  /** Tone at a local point, bilinear at pixel centres, edge clamped. */
  at(x: number, y: number): number;
  /** Grid coordinates (pixel units, origin at the image's top-left corner) of a local point. */
  gridPoint(x: number, y: number): readonly [number, number];
}

function integerIn(name: string, value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer in [${min}, ${max}]`);
  return value;
}
function numberIn(name: string, value: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be a number in [${min}, ${max}]`);
  return value;
}

/** The raster a source names. Bundled samples are generated deterministically (cached by `bundledRaster`). */
export function resolveToneRaster(source: ToneSource): Raster {
  if (source === null || typeof source !== "object") throw new Error("Engraving source is required");
  if (source.kind === "bundled") {
    if (!(bundledRasterIds as readonly string[]).includes(source.id)) throw new Error(`Unknown source image "${String(source.id)}": use one of ${bundledRasterIds.join(", ")}`);
    return bundledRaster(source.id, integerIn("Sample variant", source.variant, 0, 0xffffffff), BUNDLED_SOURCE_SIZE);
  }
  if (source.kind !== "raster") throw new Error(`Unknown engraving source kind: ${String((source as { kind?: unknown }).kind)}`);
  const raster = source.raster;
  if (raster === null || typeof raster !== "object" || typeof raster.hash !== "string") throw new Error("Engraving source raster must be a Raster made by createRaster");
  return raster;
}

let nextMaskId = 1;
const maskIds = new WeakMap<ScalarGrid, number>();
function maskKey(mask: ScalarGrid | undefined): string {
  if (!mask) return "-";
  let id = maskIds.get(mask);
  if (id === undefined) { id = nextMaskId++; maskIds.set(mask, id); }
  return `mask#${id}`;
}

function sourceKey(source: ToneSource, raster: Raster): string {
  return source.kind === "bundled" ? `bundled:${source.id}:${source.variant}:${maskKey(source.mask)}` : `raster:${raster.hash}:${maskKey(source.mask)}`;
}

/** Exact area average of a w x h array onto gw x gh cells (gw <= w, gh <= h). */
export function areaAverage(values: Float64Array, w: number, h: number, gw: number, gh: number): Float64Array {
  if (gw === w && gh === h) return values.slice();
  const across = new Float64Array(gw * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < gw; i++) {
    const a = (i * w) / gw, b = ((i + 1) * w) / gw;
    let sum = 0;
    for (let k = Math.floor(a); k < Math.min(w, Math.ceil(b)); k++) sum += values[j * w + k] * (Math.min(b, k + 1) - Math.max(a, k));
    across[j * gw + i] = sum / (b - a);
  }
  const out = new Float64Array(gw * gh);
  for (let j = 0; j < gh; j++) {
    const a = (j * h) / gh, b = ((j + 1) * h) / gh;
    for (let i = 0; i < gw; i++) {
      let sum = 0;
      for (let k = Math.floor(a); k < Math.min(h, Math.ceil(b)); k++) sum += across[k * gw + i] * (Math.min(b, k + 1) - Math.max(a, k));
      out[j * gw + i] = sum / (b - a);
    }
  }
  return out;
}

const cache = new Map<string, ToneField>();
const CACHE_SIZE = 8;

/** The tone field for these construction inputs. Cached; frozen. */
export function toneField(options: ToneOptions): ToneField {
  if (options === null || typeof options !== "object") throw new Error("Tone options are required");
  const width = numberIn("Footprint width", options.width, 1, TONE_LIMITS.footprint), height = numberIn("Footprint height", options.height, 1, TONE_LIMITS.footprint);
  if (!fitModes.includes(options.fit)) throw new Error(`Fit must be one of ${fitModes.join(", ")}`);
  if (!toneEncodings.includes(options.encode)) throw new Error(`Encoding must be one of ${toneEncodings.join(", ")}`);
  const smoothing = numberIn("Tone smoothing", options.smoothing, 0, TONE_LIMITS.smoothing);
  const raster = resolveToneRaster(options.source);
  const { mask } = options.source;
  if (raster.width * raster.height > TONE_LIMITS.sourcePixels)
    throw new Error(`Source image is ${raster.width} x ${raster.height}; the limit is ${TONE_LIMITS.sourcePixels} pixels. Crop or resize it first`);
  if (mask && (mask.width !== raster.width || mask.height !== raster.height))
    throw new Error(`Region mask is ${mask.width} x ${mask.height} but the source image is ${raster.width} x ${raster.height}`);
  const key = `${sourceKey(options.source, raster)}|${options.fit}|${width}x${height}|${options.encode}|${smoothing}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }

  const rw = raster.width, rh = raster.height;
  const sx = options.fit === "stretch" ? width / rw : options.fit === "contain" ? Math.min(width / rw, height / rh) : Math.max(width / rw, height / rh);
  const sy = options.fit === "stretch" ? height / rh : sx;
  const rectW = rw * sx, rectH = rh * sy;
  const image: [number, number, number, number] = [-rectW / 2, -rectH / 2, rectW / 2, rectH / 2];
  const dark = options.encode === "dark";
  const lightness = gridStorage(valueField(raster, "lightness", { background: dark ? 1 : 0 }));
  const tone = new Float64Array(lightness.length);
  const keep = mask ? gridStorage(mask) : null;
  for (let p = 0; p < tone.length; p++) tone[p] = keep && keep[p] < 0.5 ? 0 : dark ? 1 - lightness[p] : lightness[p];
  const columns = smoothing > 0 ? Math.min(rw, Math.max(1, Math.round(rectW / smoothing))) : rw;
  const rows = smoothing > 0 ? Math.min(rh, Math.max(1, Math.round(rectH / smoothing))) : rh;
  const reduced = areaAverage(tone, rw, rh, columns, rows);
  for (let p = 0; p < reduced.length; p++) reduced[p] = reduced[p] < 0 ? 0 : reduced[p] > 1 ? 1 : reduced[p];
  const grid = adoptScalarGrid(columns, rows, reduced);
  const kx = columns / rectW, ky = rows / rectH;
  const field: ToneField = Object.freeze({
    key, width, height, image: Object.freeze(image) as ToneField["image"], columns, rows, grid, encode: options.encode,
    at: (x: number, y: number) => sampleGrid(grid, (x - image[0]) * kx, (y - image[1]) * ky, "clamp"),
    gridPoint: (x: number, y: number) => Object.freeze([(x - image[0]) * kx, (y - image[1]) * ky] as const),
  });
  cache.set(key, field);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  return field;
}
