import { componentSeed } from "./core.js";
import { orientationAt, orientationField, orientationVector } from "./image-structure.js";
import type { OrientationField, OrientationSample } from "./image-structure.js";
import { LUMA, linearToSrgb, rasterStorage, resizeRaster, srgbToLinear } from "./raster.js";
import type { Raster } from "./raster.js";
import type { Path, Point, Site } from "./types.js";

/**
 * Painterly source interpretation: a coarse-to-fine mark PLAN built from a raster.
 *
 * `paintPlan` is the producer. It never draws and never knows a material or a palette; it returns a
 * frozen, cached value (marks with stable ids, a `Site` and a centerline `Path` each, plus the source
 * attributes that decided them). Consumers (`painterly-draw.ts`) draw the same plan with any
 * `pathMaterial` / `motif` or an ordinary callback.
 *
 * ## Method (what is new, what is reused)
 *
 * 1. The source is read in its own representation (`rasterStorage`: any channel layout, `srgb` or
 *    `linear`, straight or premultiplied alpha) and, if a side exceeds 512 px, box-resized once
 *    (`resizeRaster`). Colour is averaged in LINEAR light, weighted by alpha, and encoded to sRGB for
 *    display: a transparent pixel's hidden colour never bleeds into a mark.
 * 2. Layer `k` (0 = coarsest) has brush width `b_k = brush * ratio^-k` and a mark footprint of
 *    `b_k * aspect(family)` by `b_k` (a capsule: a centerline of length `length - b_k` with round caps;
 *    a dot is a disc). Candidate sites are the cells of a grid of spacing
 *    `s_k = b_k * sqrt(aspect / coverage)` anchored at the frame's top-left corner, so `coverage` is
 *    the mean number of marks covering a point. Cell `(i, j)` of layer `k` has the id `L<k>:<i>:<j>`;
 *    its jitter, angle scatter and drawing order come from `componentSeed(seed, id, purpose)`, so
 *    neither traversal order nor which other cells exist ever changes them.
 * 3. **Coverage / error selection (the missing computation).** An internal canvas records the colour
 *    of the last mark that covered each source pixel (unpainted pixels are marked). Before layer `k`
 *    paints, the error of a candidate cell is the mean, over the cell's wanted pixels, of
 *    `|blurredSource_k(p) - canvas(p)| / sqrt(3)` (Euclidean distance of sRGB-encoded channels, in
 *    [0, 1]) with an UNPAINTED pixel counting 1. `blurredSource_k` is the source box-averaged at
 *    radius `b_k / 2`, so detail finer than the brush never drives a layer. A cell paints when its
 *    error is STRICTLY greater than `threshold` (and above a 1e-6 numerical noise floor, so threshold 0
 *    still never repaints an exact match); the canvas keeps each mark's unquantized colour; every layer's cells are judged against the canvas as
 *    it stood when the layer began, then all are stamped in draw order. Layer 0 therefore always
 *    covers the wanted area, and exact matches (a flat region) are never repainted.
 * 4. **Direction.** The structure tensor (`orientationField`, lightness, Gaussian sigma
 *    `smoothing * b_k` in pixels, at most 16) gives the tangent of the level lines. The mark angle is
 *    the half-turn blend (doubled-angle vectors) of that tangent and `baseAngle`, weighted by
 *    `coherence * smoothstep(0, 0.35, local coherence)`: strokes follow strong structure and fall back
 *    to `baseAngle` where the image has none. A constant `scatter` (uniform in +/-scatter, per id) is
 *    added. Strokes are traced through the field in `halves` steps per side, the sign following the
 *    previous step (`orientationVector`), and are cut where they would leave the frame.
 * 5. **Negative space (wanted pixels).** A pixel is wanted when its alpha is at least 0.5, its
 *    sRGB luma is at most `paper`, and it lies inside the subject window. Unwanted pixels contribute no
 *    error and cannot seed a mark; a mark centred there is never created. `subject.feather` thins the
 *    window's rim by a stable per-id draw. Marks may still overlap unwanted pixels by up to half a
 *    brush width.
 *
 * ## Contract
 *
 * - Units: canvas units for positions, brush and lengths; degrees for `baseAngle`/`scatter` inputs;
 *   radians for published angles; colours are packed 0xRRGGBB sRGB.
 * - Frame: the raster is stretched to `frame.width` x `frame.height` centred at `(centerX, centerY)`
 *   (an explicit stretch, one raster pixel per `width/w` by `height/h` units). Instruments preserve
 *   aspect by choosing the frame.
 * - Ownership: the result and everything in it are deeply frozen; consumers must not mutate them.
 *   Cached by construction (source content hash and every option here), never by palette, material or
 *   retention. Six plans are kept.
 * - Identity: ids depend on layer and cell only. Raising `threshold`, adding layers, or changing
 *   anything that is not the layer's own grid or a coarser layer's canvas leaves a surviving mark's
 *   position, path, colour and order key unchanged. Raising the threshold prunes layer 1 to a subset;
 *   deeper layers respond to the changed canvas and may add marks the pruned layer left uncovered.
 * - Work (explicit, checked before or as work happens; nothing is truncated): candidate cells at most
 *   `MAX_PAINT_CANDIDATES`, marks at most `MAX_PAINT_MARKS`, layers at most `MAX_PAINT_LAYERS`, finest
 *   brush at least `MIN_PAINT_BRUSH`, analysis at most `MAX_ANALYSIS_SIDE` px a side. Errors name the
 *   control to change.
 * - Failure: invalid options and exceeded bounds throw. Nothing wanted (everything bare, transparent or
 *   outside the subject) gives a valid empty plan.
 * - Not done: no host image decoding; strokes are clipped to the frame only along their centerline;
 *   marks are opaque in the internal canvas even where a material draws translucently.
 */
export const MAX_PAINT_LAYERS = 8;
export const MAX_PAINT_CANDIDATES = 240_000;
export const MAX_PAINT_MARKS = 40_000;
export const MAX_ANALYSIS_SIDE = 512;
export const MIN_PAINT_BRUSH = 0.5;
const MAX_SIGMA = 16;
/** Errors at or below this are floating-point noise (equal colours averaged over different windows), never detail. */
const NOISE_FLOOR = 1e-6;

export type PaintFamily = "dot" | "dab" | "stroke" | "ribbon";
/** Footprint length per brush width, and centerline steps per half stroke. */
export const PAINT_FAMILIES: Readonly<Record<PaintFamily, Readonly<{ aspect: number; halves: number }>>> = Object.freeze({
  dot: Object.freeze({ aspect: 1, halves: 1 }),
  dab: Object.freeze({ aspect: 1.8, halves: 1 }),
  stroke: Object.freeze({ aspect: 3.6, halves: 2 }),
  ribbon: Object.freeze({ aspect: 9, halves: 5 }),
});

export interface PaintFrame { centerX: number; centerY: number; width: number; height: number }
/** An elliptical window in frame fractions (0 left/top, 1 right/bottom); `feather` in [0, 1] of its radius. */
export interface PaintSubject { centerX: number; centerY: number; width: number; height: number; feather: number }

export interface PaintPlanOptions {
  seed: number;
  source: Raster;
  frame: PaintFrame;
  /** Integer 1..8. */
  layers: number;
  /** Coarsest brush width, canvas units, 0.5..100. */
  brush: number;
  /** Brush width ratio between successive layers, 1.1..8. */
  ratio: number;
  /** Mean number of marks covering a point, 0.25..8. */
  coverage: number;
  family: PaintFamily;
  /** Cell error in [0, 1] above which a layer paints. */
  threshold: number;
  /** Position jitter as a fraction of the grid spacing, 0..2. */
  jitter: number;
  /** 0 = every mark at `baseAngle`; 1 = marks follow the structure field where it is coherent. */
  coherence: number;
  /** Degrees. */
  baseAngle: number;
  /** Structure-tensor sigma in brush widths, 0..8. */
  smoothing: number;
  /** Uniform per-mark angle scatter, +/- degrees, 0..180. */
  scatter: number;
  /** Source sRGB luma above which the source is left bare, 0..1 (1 leaves nothing bare). */
  paper: number;
  subject: PaintSubject | null;
}

export interface PaintMark {
  readonly id: string;
  readonly layer: number;
  /** Position in `PaintPlan.marks`; also the value of `site.tone` / `path.tone` is `2 * index`. */
  readonly index: number;
  readonly seed: number;
  /** At the middle of the centerline; `angle` (radians) is the tangent there. `tone = 2 * index`. */
  readonly site: Site;
  /** The centerline (2..11 points, open). `tone = 2 * index`. */
  readonly path: Path;
  /** Source colour at the mark: packed sRGB, linear-light mean over the layer's brush window. */
  readonly color: number;
  /** Brush width and footprint length in canvas units. */
  readonly width: number;
  readonly length: number;
  readonly source: Readonly<{
    /** CIE L* / 100 of `color`. */
    lightness: number;
    /** Local orientation coherence in [0, 1] (0 where the image has no direction). */
    coherence: number;
    /** Tangent of the source's level lines at the centre, radians in [0, pi) in raster space. */
    structure: number;
    /** The cell error that admitted the mark, in (threshold, 1]. */
    error: number;
  }>;
}

export interface PaintLayer {
  readonly index: number;
  readonly brush: number;
  readonly length: number;
  readonly spacing: number;
  /** Cells whose jittered centre lies in the frame. */
  readonly candidates: number;
  /** Marks are `plan.marks[first .. first + count)`. */
  readonly first: number;
  readonly count: number;
}

export interface PaintPlan {
  readonly options: Readonly<Omit<PaintPlanOptions, "source">> & Readonly<{ sourceHash: string }>;
  readonly marks: readonly PaintMark[];
  /** `marks[i].site` and `.path`, index-aligned for `atEach` / `strokeWith`. */
  readonly sites: readonly Site[];
  readonly paths: readonly Path[];
  readonly layers: readonly PaintLayer[];
  /** Analysis raster size in pixels (after any resize). */
  readonly analysis: Readonly<{ width: number; height: number }>;
}

const fail = (message: string): never => { throw new Error(message); };
const finite = (name: string, value: unknown, min: number, max: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    fail(`Painterly source: ${name} must be a finite number in [${min}, ${max}]`);
  return value as number;
};
const smooth = (a: number, b: number, x: number): number => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / 0x1_0000_0000;
const halfTurn = (a: number): number => { const r = a - Math.PI * Math.floor(a / Math.PI); return r >= Math.PI ? 0 : r; };

/** The mark geometry of one layer, from controls alone. */
export function paintLayerGeometry(brush: number, ratio: number, coverage: number, family: PaintFamily, index: number):
  { brush: number; length: number; spacing: number } {
  const { aspect } = PAINT_FAMILIES[family];
  const b = brush * ratio ** -index;
  return { brush: b, length: b * aspect, spacing: b * Math.sqrt(aspect / coverage) };
}

/** Candidate cells over the frame, summed over layers: the work bound that needs no pixels. */
export function paintCandidateCount(options: Pick<PaintPlanOptions, "layers" | "brush" | "ratio" | "coverage" | "family"> & { width: number; height: number }): number {
  let total = 0;
  for (let k = 0; k < options.layers; k++) {
    const { spacing } = paintLayerGeometry(options.brush, options.ratio, options.coverage, options.family, k);
    total += Math.ceil(options.width / spacing) * Math.ceil(options.height / spacing);
  }
  return total;
}

/** Control-level checks shared by `paintPlan` and the instrument; each message names the control to change. */
export function checkPaintBounds(o: Pick<PaintPlanOptions, "layers" | "brush" | "ratio" | "coverage" | "family"> & { width: number; height: number }): void {
  if (!Number.isInteger(o.layers) || o.layers < 1 || o.layers > MAX_PAINT_LAYERS) fail(`Painterly source: layers must be an integer in [1, ${MAX_PAINT_LAYERS}]`);
  finite("brush", o.brush, MIN_PAINT_BRUSH, 100);
  finite("ratio", o.ratio, 1.1, 8);
  finite("coverage", o.coverage, 0.25, 8);
  finite("size", o.width, 1e-6, 1e5); finite("size", o.height, 1e-6, 1e5);
  if (!(o.family in PAINT_FAMILIES)) fail(`Painterly source: unknown mark family ${String(o.family)}`);
  const finest = o.brush * o.ratio ** -(o.layers - 1);
  if (finest < MIN_PAINT_BRUSH)
    fail(`Painterly source: the finest layer's brush would be ${finest.toFixed(3)} units, below the ${MIN_PAINT_BRUSH} minimum. Lower layers or ratio, or raise brush`);
  const cells = paintCandidateCount(o);
  if (cells > MAX_PAINT_CANDIDATES)
    fail(`Painterly source: ${o.layers} layers would consider ${cells} candidate marks; the limit is ${MAX_PAINT_CANDIDATES}. Lower layers, raise brush or ratio, lower coverage or shrink size`);
}

function checkOptions(o: PaintPlanOptions): void {
  if (!Number.isSafeInteger(o.seed) || o.seed < 0 || o.seed > 0xffffffff) fail("Composition seed must be a uint32 integer");
  if (o.source === null || typeof o.source !== "object") fail("Painterly source: source must be a Raster");
  rasterStorage(o.source);
  const f = o.frame;
  finite("frame.centerX", f.centerX, -1e6, 1e6); finite("frame.centerY", f.centerY, -1e6, 1e6);
  checkPaintBounds({ ...o, width: f.width, height: f.height });
  finite("threshold", o.threshold, 0, 1); finite("jitter", o.jitter, 0, 2); finite("coherence", o.coherence, 0, 1);
  finite("baseAngle", o.baseAngle, -1e4, 1e4); finite("smoothing", o.smoothing, 0, 8); finite("scatter", o.scatter, 0, 180);
  finite("paper", o.paper, 0, 1);
  if (o.subject !== null) {
    const s = o.subject;
    finite("subject.centerX", s.centerX, -4, 5); finite("subject.centerY", s.centerY, -4, 5);
    finite("subject.width", s.width, 1e-3, 100); finite("subject.height", s.height, 1e-3, 100); finite("subject.feather", s.feather, 0, 1);
  }
}

// ── pixels ───────────────────────────────────────────────────────────────────────────────────────

const LUT_SIZE = 4096;
const ENCODE = new Float32Array(LUT_SIZE + 1).map((_, i) => linearToSrgb(i / LUT_SIZE));
/** sRGB encode of a linear value by table (error under 2e-4 of full scale, checked in tests). */
const encode = (x: number): number => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const t = x * LUT_SIZE, i = Math.floor(t), f = t - i;
  return ENCODE[i] + (ENCODE[i + 1] - ENCODE[i]) * f;
};

interface Pixels { width: number; height: number; linear: Float64Array; alpha: Float64Array }

function analysisRaster(source: Raster): Raster {
  const side = Math.max(source.width, source.height);
  if (side <= MAX_ANALYSIS_SIDE) return source;
  const f = MAX_ANALYSIS_SIDE / side;
  return resizeRaster(source, Math.max(1, Math.round(source.width * f)), Math.max(1, Math.round(source.height * f)), "box", `${source.label}:analysis`);
}

/** Straight linear-light colour and coverage per pixel, whatever the stored representation. */
function decode(raster: Raster): Pixels {
  const { width, height, channels, format, colorSpace, alpha: mode } = raster, n = width * height;
  const store = rasterStorage(raster), scale = format === "u8" ? 1 / 255 : 1;
  const hasAlpha = channels === 2 || channels === 4, cc = hasAlpha ? channels - 1 : channels;
  const linear = new Float64Array(3 * n), alpha = new Float64Array(n);
  for (let p = 0; p < n; p++) {
    const a = hasAlpha ? store[p * channels + cc] * scale : 1;
    alpha[p] = a;
    for (let c = 0; c < 3; c++) {
      let v = store[p * channels + (cc === 1 ? 0 : c)] * scale;
      if (mode === "premultiplied") v = a > 0 ? v / a : 0;
      linear[3 * p + c] = colorSpace === "srgb" ? srgbToLinear(v < 0 ? 0 : v > 1 ? 1 : v) : v < 0 ? 0 : v > 1 ? 1 : v;
    }
  }
  return { width, height, linear, alpha };
}

/** Summed-area tables of alpha-weighted linear colour and alpha (row stride width + 1). */
function summed(px: Pixels): Float64Array[] {
  const { width, height } = px, stride = width + 1;
  const tables = [0, 1, 2, 3].map(() => new Float64Array(stride * (height + 1)));
  for (let y = 0; y < height; y++) {
    const run = [0, 0, 0, 0];
    for (let x = 0; x < width; x++) {
      const p = y * width + x, a = px.alpha[p];
      run[0] += px.linear[3 * p] * a; run[1] += px.linear[3 * p + 1] * a; run[2] += px.linear[3 * p + 2] * a; run[3] += a;
      const at = (y + 1) * stride + x + 1;
      for (let c = 0; c < 4; c++) tables[c][at] = tables[c][at - stride] + run[c];
    }
  }
  return tables;
}

const pack = (r: number, g: number, b: number): number =>
  (Math.round(Math.min(1, Math.max(0, r)) * 255) << 16 | Math.round(Math.min(1, Math.max(0, g)) * 255) << 8 | Math.round(Math.min(1, Math.max(0, b)) * 255)) >>> 0;
/** CIE L* / 100 of an encoded sRGB colour. */
function lightnessOf(r: number, g: number, b: number): number {
  const y = LUMA.r * srgbToLinear(r) + LUMA.g * srgbToLinear(g) + LUMA.b * srgbToLinear(b);
  const t = y > 216 / 24389 ? Math.cbrt(y) : (24389 / 27 * y + 16) / 116;
  return (116 * t - 16) / 100;
}

// ── orientation cache ────────────────────────────────────────────────────────────────────────────

const fields = new Map<string, OrientationField>();
function fieldFor(raster: Raster, sigma: number): OrientationField {
  const key = `${raster.hash}|${sigma}`, hit = fields.get(key);
  if (hit) { fields.delete(key); fields.set(key, hit); return hit; }
  const made = orientationField(raster, { value: "lightness", smoothing: sigma });
  fields.set(key, made);
  if (fields.size > 12) fields.delete(fields.keys().next().value!);
  return made;
}

// ── the builder ──────────────────────────────────────────────────────────────────────────────────

const cache = new Map<string, PaintPlan>();
const keyOf = (o: PaintPlanOptions): string => JSON.stringify([o.source.hash, o.seed, o.frame, o.layers, o.brush, o.ratio, o.coverage, o.family,
  o.threshold, o.jitter, o.coherence, o.baseAngle, o.smoothing, o.scatter, o.paper, o.subject]);

interface Accepted { id: string; x: number; y: number; error: number; px: number; py: number }

function* build(o: PaintPlanOptions): Generator<void, PaintPlan> {
  const { seed, frame, family } = o, fam = PAINT_FAMILIES[family];
  const analysis = analysisRaster(o.source), px = decode(analysis), aw = px.width, ah = px.height, n = aw * ah;
  const left = frame.centerX - frame.width / 2, top = frame.centerY - frame.height / 2;
  const ux = frame.width / aw, uy = frame.height / ah, mean = Math.sqrt(ux * uy);
  const tables = summed(px), stride = aw + 1;
  const baseAngle = halfTurn(o.baseAngle * Math.PI / 180), scatterRadians = o.scatter * Math.PI / 180;

  // Wanted pixels: opaque enough, not paper, inside the subject window.
  const want = new Uint8Array(n);
  const subject = o.subject;
  const sx = subject ? left + subject.centerX * frame.width : 0, sy = subject ? top + subject.centerY * frame.height : 0;
  const srx = subject ? subject.width * frame.width / 2 : 1, sry = subject ? subject.height * frame.height / 2 : 1;
  const radius = (x: number, y: number): number => Math.hypot((x - sx) / srx, (y - sy) / sry);
  for (let j = 0; j < ah; j++) for (let i = 0; i < aw; i++) {
    const p = j * aw + i;
    if (px.alpha[p] < 0.5) continue;
    const luma = LUMA.r * encode(px.linear[3 * p]) + LUMA.g * encode(px.linear[3 * p + 1]) + LUMA.b * encode(px.linear[3 * p + 2]);
    if (luma > o.paper) continue;
    if (subject && radius(left + (i + 0.5) * ux, top + (j + 0.5) * uy) >= 1) continue;
    want[p] = 1;
  }
  const keepFeather = (id: string, x: number, y: number): boolean => {
    if (!subject || subject.feather === 0) return true;
    const rho = radius(x, y), t = Math.min(1, Math.max(0, (1 - rho) / subject.feather));
    return unit(seed, id, "subject") < t * t * (3 - 2 * t);
  };

  const canvas = new Float32Array(3 * n), painted = new Uint8Array(n), ref = new Float32Array(3 * n);
  const marks: PaintMark[] = [], sites: Site[] = [], paths: Path[] = [], layers: PaintLayer[] = [];
  yield;

  for (let k = 0; k < o.layers; k++) {
    const { brush: b, length, spacing } = paintLayerGeometry(o.brush, o.ratio, o.coverage, family, k);

    // The source blurred at this brush's scale, encoded once per pixel.
    const r = Math.max(0, Math.round(0.5 * b / mean));
    for (let j = 0; j < ah; j++) {
      const y0 = Math.max(0, j - r), y1 = Math.min(ah, j + r + 1);
      for (let i = 0; i < aw; i++) {
        const x0 = Math.max(0, i - r), x1 = Math.min(aw, i + r + 1);
        const sum = (t: Float64Array): number => t[y1 * stride + x1] - t[y0 * stride + x1] - t[y1 * stride + x0] + t[y0 * stride + x0];
        const a = sum(tables[3]), p = j * aw + i;
        if (a > 0) { ref[3 * p] = encode(sum(tables[0]) / a); ref[3 * p + 1] = encode(sum(tables[1]) / a); ref[3 * p + 2] = encode(sum(tables[2]) / a); }
        else { ref[3 * p] = 0; ref[3 * p + 1] = 0; ref[3 * p + 2] = 0; }
      }
    }

    // Candidate cells and their errors, all against the canvas as this layer begins.
    const columns = Math.ceil(frame.width / spacing), rows = Math.ceil(frame.height / spacing);
    const accepted: Accepted[] = [];
    let candidates = 0;
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const id = `L${k}:${i}:${j}`, h = componentSeed(seed, id, "site");
      const x = left + (i + 0.5) * spacing + ((h >>> 16) / 65536 - 0.5) * o.jitter * spacing;
      const y = top + (j + 0.5) * spacing + ((h & 0xffff) / 65536 - 0.5) * o.jitter * spacing;
      if (x < left || y < top || x >= left + frame.width || y >= top + frame.height) continue;
      candidates++;
      const cxp = Math.min(aw - 1, Math.floor((x - left) / ux)), cyp = Math.min(ah - 1, Math.floor((y - top) / uy));
      if (!want[cyp * aw + cxp] || !keepFeather(id, x, y)) continue;
      const x0 = Math.min(aw - 1, Math.max(0, Math.floor(i * spacing / ux))), x1 = Math.min(aw, Math.max(x0 + 1, Math.ceil((i + 1) * spacing / ux)));
      const y0 = Math.min(ah - 1, Math.max(0, Math.floor(j * spacing / uy))), y1 = Math.min(ah, Math.max(y0 + 1, Math.ceil((j + 1) * spacing / uy)));
      let sumError = 0, wanted = 0;
      for (let v = y0; v < y1; v++) for (let u = x0; u < x1; u++) {
        const p = v * aw + u;
        if (!want[p]) continue;
        wanted++;
        if (!painted[p]) { sumError += 1; continue; }
        const dr = ref[3 * p] - canvas[3 * p], dg = ref[3 * p + 1] - canvas[3 * p + 1], db = ref[3 * p + 2] - canvas[3 * p + 2];
        sumError += Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3);
      }
      const error = wanted > 0 ? sumError / wanted : 0;
      if (error > o.threshold && error > NOISE_FLOOR) accepted.push({ id, x, y, error, px: cxp, py: cyp });
    }
    if (marks.length + accepted.length > MAX_PAINT_MARKS)
      fail(`Painterly source: layer ${k + 1} would bring the plan to ${marks.length + accepted.length} marks; the limit is ${MAX_PAINT_MARKS}. Raise threshold, brush or ratio, lower layers or coverage`);
    accepted.sort((a, c) => componentSeed(seed, a.id, "order") - componentSeed(seed, c.id, "order") || (a.id < c.id ? -1 : 1));

    // Direction field for this layer.
    const sigma = Math.min(MAX_SIGMA, Math.round(o.smoothing * b / mean * 4) / 4);
    const field = fieldFor(analysis, sigma);
    const blend = (x: number, y: number, offset: number): { sample: OrientationSample; theta: number } => {
      const sample = orientationAt(field, Math.min(aw, Math.max(0, (x - left) / ux)), Math.min(ah, Math.max(0, (y - top) / uy)));
      // The tangent in canvas space (anisotropic frames bend it).
      const structure = Math.atan2(Math.sin(sample.direction) * uy, Math.cos(sample.direction) * ux);
      const w = o.coherence * smooth(0, 0.35, sample.coherence);
      const tx = w * Math.cos(2 * structure) + (1 - w) * Math.cos(2 * baseAngle), ty = w * Math.sin(2 * structure) + (1 - w) * Math.sin(2 * baseAngle);
      const theta = Math.hypot(tx, ty) < 1e-9 ? baseAngle : 0.5 * Math.atan2(ty, tx);
      return { sample, theta: halfTurn(theta + offset) };
    };
    const vector = (x: number, y: number, offset: number, hint?: [number, number]): { v: [number, number]; sample: OrientationSample } => {
      const { sample, theta } = blend(x, y, offset);
      const v = orientationVector({ direction: theta, gradientDirection: halfTurn(theta + Math.PI / 2), coherence: sample.coherence, energy: sample.energy, defined: sample.defined }, { hint });
      return { v, sample };
    };
    const inside = (x: number, y: number): boolean => x >= left && y >= top && x < left + frame.width && y < top + frame.height;

    const exact: (readonly [number, number, number])[] = [];
    const first = marks.length, center = Math.max(0.25 * b, length - b), step = center / 2 / fam.halves;
    for (const a of accepted) {
      const offset = scatterRadians === 0 ? 0 : (unit(seed, a.id, "angle") * 2 - 1) * scatterRadians;
      const { v: v0, sample } = vector(a.x, a.y, offset);
      const walk = (sign: 1 | -1): Point[] => {
        const out: Point[] = [];
        let x = a.x, y = a.y, hint: [number, number] = [sign * v0[0], sign * v0[1]];
        for (let s = 0; s < fam.halves; s++) {
          const { v } = vector(x, y, offset, hint);
          const nx = x + step * v[0], ny = y + step * v[1];
          if (!inside(nx, ny)) break;
          out.push(Object.freeze([nx, ny] as const)); x = nx; y = ny; hint = v;
        }
        return out;
      };
      const points: Point[] = [...walk(-1).reverse(), Object.freeze([a.x, a.y] as const), ...walk(1)];
      if (points.length < 2) points.push(Object.freeze([a.x + 1e-3 * b * v0[0], a.y + 1e-3 * b * v0[1]] as const));
      const index = marks.length, tone = 2 * index, markSeed = componentSeed(seed, a.id, "mark");
      const p = a.py * aw + a.px;
      const er = ref[3 * p], eg = ref[3 * p + 1], eb = ref[3 * p + 2], color = pack(er, eg, eb);
      const site: Site = Object.freeze({ id: a.id, seed: markSeed, position: Object.freeze([a.x, a.y] as const), angle: Math.atan2(v0[1], v0[0]), scale: 1, tone });
      const path: Path = Object.freeze({ id: a.id, seed: markSeed, points: Object.freeze(points), closed: false, level: k,
        levelFraction: o.layers > 1 ? k / (o.layers - 1) : 0, tone });
      const mark: PaintMark = Object.freeze({ id: a.id, layer: k, index, seed: markSeed, site, path, color, width: b, length,
        source: Object.freeze({ lightness: lightnessOf(er, eg, eb), coherence: sample.coherence, structure: sample.direction, error: a.error }) });
      marks.push(mark); sites.push(site); paths.push(path); exact.push([er, eg, eb]);
    }
    layers.push(Object.freeze({ index: k, brush: b, length, spacing, candidates, first, count: marks.length - first }));

    // Stamp this layer in draw order; later layers judge against the result.
    for (let m = first; m < marks.length; m++) {
      const mark = marks[m], [cr, cg, cb] = exact[m - first], pts = mark.path.points, rad = b / 2;
      for (let s = 0; s + 1 < pts.length; s++) {
        const [ax, ay] = pts[s], [bx, by] = pts[s + 1];
        const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - rad - left) / ux)), i1 = Math.min(aw - 1, Math.floor((Math.max(ax, bx) + rad - left) / ux));
        const j0 = Math.max(0, Math.floor((Math.min(ay, by) - rad - top) / uy)), j1 = Math.min(ah - 1, Math.floor((Math.max(ay, by) + rad - top) / uy));
        const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const x = left + (i + 0.5) * ux - ax, y = top + (j + 0.5) * uy - ay;
          const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, (x * dx + y * dy) / len2));
          const ex = x - t * dx, ey = y - t * dy;
          if (ex * ex + ey * ey > rad * rad) continue;
          const p = j * aw + i;
          canvas[3 * p] = cr; canvas[3 * p + 1] = cg; canvas[3 * p + 2] = cb; painted[p] = 1;
        }
      }
    }
    yield;
  }
  return Object.freeze({
    options: Object.freeze({ seed: o.seed, sourceHash: o.source.hash, frame: Object.freeze({ ...o.frame }), layers: o.layers, brush: o.brush,
      ratio: o.ratio, coverage: o.coverage, family: o.family, threshold: o.threshold, jitter: o.jitter, coherence: o.coherence,
      baseAngle: o.baseAngle, smoothing: o.smoothing, scatter: o.scatter, paper: o.paper, subject: o.subject ? Object.freeze({ ...o.subject }) : null }),
    marks: Object.freeze(marks), sites: Object.freeze(sites), paths: Object.freeze(paths), layers: Object.freeze(layers),
    analysis: Object.freeze({ width: aw, height: ah }),
  });
}

const remember = (key: string, plan: PaintPlan): PaintPlan => {
  cache.set(key, plan);
  if (cache.size > 6) cache.delete(cache.keys().next().value!);
  return plan;
};

/** The coarse-to-fine mark plan for a raster; cached by construction, frozen. See the module header. */
export function paintPlan(options: PaintPlanOptions): PaintPlan {
  checkOptions(options);
  const key = keyOf(options), hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const run = build(options);
  for (;;) { const step = run.next(); if (step.done) return remember(key, step.value); }
}

const yieldToHost = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0)); // the package lib predates Promise.withResolvers

/** Build the plan cooperatively, yielding between layers; false if cancelled (nothing is cached then). */
export async function preparePaintPlan(options: PaintPlanOptions, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  checkOptions(options);
  const key = keyOf(options), hit = cache.get(key);
  if (hit) return !cancelled();
  const run = build(options);
  for (;;) {
    const step = run.next();
    if (step.done) { remember(key, step.value); return !cancelled(); }
    await yieldToHost();
    if (cancelled()) return false;
  }
}
