import { componentSeed } from "./core.js";
import { orientationAt, orientationField } from "./image-structure.js";
import type { OrientationField } from "./image-structure.js";
import { sampleGrid, valueField } from "./raster.js";
import type { Raster, ScalarGrid } from "./raster.js";
import { bundledRaster } from "./raster-samples.js";
import type { BundledRasterId } from "./raster-samples.js";
import { traceStreamlines } from "./streamlines.js";
import type { StreamlineOptions } from "./streamlines.js";
import type { Path, Point, Site } from "./types.js";

/**
 * Image-directed fields: an image's structure as a direction field with a confidence, consumed by
 * streamline tracing (`fieldLines`) and by oriented mark placement (`fieldSites`).
 *
 * **Inputs.** `FieldImage` is a bundled deterministic sample (`{kind: "bundled", id, variant, size}`,
 * cached by the foundation) or a caller-resolved `Raster` (`{kind: "raster", raster}`; the library never
 * fetches or decodes, and persisted instruments name only bundled images until a host binds its own).
 * The picture is placed on the canvas by `frame`: an axis-aligned rectangle centred at `(centerX,
 * centerY)`, `width` x `height` canvas units (independent scales allowed, so a stretched picture is a
 * stretched field), turned `rotation` degrees clockwise on screen about its centre.
 *
 * **Field.** `structure` analyses the image once: the value channel (`lightness`, `luminance` or
 * `saturation`, the foundation's `valueField`) and the structure-tensor orientation with Gaussian scale
 * `smoothing` in CANVAS units (converted to pixels through the frame, at most 64 pixels). `imageField`
 * turns that into `at(x, y)` in canvas coordinates, returning the drawn line direction (`angle`, radians
 * in [0, pi), UNSIGNED), a `confidence` in [0, 1], the image's own `coherence`, its tone `value` and
 * whether the image defines a direction there. Modes:
 * - `follow`: along edges (the tangent of the level lines); confidence = coherence.
 * - `resist`: across edges (the gradient direction); confidence = coherence.
 * - `blend`: the along-edge orientation and an ambient one (`angle` constant, `swirl` around the
 *   picture's centre, or `radial`, each turned by `ambient.angle` degrees) are averaged as ORIENTATIONS
 *   (double-angle vectors, so 0.05 and pi - 0.05 average to horizontal), the image with weight
 *   `coherence` and the ambient with weight `ambient.weight * (1 - coherence)`. The confidence is the
 *   length of that sum: coherent image structure wins, flat areas take the ambient direction with
 *   confidence `ambient.weight`, and confidence dips where a strong image direction and the ambient one disagree.
 *
 * **Flat areas.** Where the image defines no direction (constant tone or exactly isotropic), follow and
 * resist have confidence 0 and no line or mark is ever drawn there, at any threshold. Only `blend`
 * with a positive ambient weight fills them, with the ambient direction.
 *
 * **Gate.** A place is usable when `confidence > 0`, `confidence >= minConfidence` and, if a `mask` is
 * given, its tone `value` lies in `[mask.min, mask.max]`. Lines start only at usable places and end at
 * the first unusable one; sites exist only at usable places. Both stay inside the image rectangle
 * (lines may leave it only with `clip: false`, see below).
 *
 * **Lines.** `fieldLines` traces with `streamlines.ts` in the picture's own (unrotated) frame, then rotates
 * the vertices. Starts are a jittered grid of `startSpacing` canvas units (`startJitter` of a cell, seeded
 * per cell id with `componentSeed(seed, id, "start")`) visited in a seeded order; with `fill` the
 * even-spacing rule then adds lines in the gaps. With `clip` the domain is the image rectangle; without,
 * lines may run on up to `maxLength` beyond it through the image's edge-replicated field (starts stay
 * inside). Ids: `line:<cell>` for a grid start, `<parent>/<vertex><L|R>` for a fill line. The integration
 * step is `min(2, separation * stopFraction / 2)` canvas units.
 * A `FieldLine` is a `Path` plus attributes read from the same construction: `length`, `meanValue`,
 * `meanConfidence` and `meanDirection` (radians, unsigned, canvas). Colour and weight can follow them at
 * draw time without touching the geometry.
 *
 * **Sites.** `fieldSites` places one candidate per cell of a jittered grid of `spacing` canvas units and keeps
 * the usable ones, oriented along the field (`angle` is the unsigned direction, so an arrow mark shows
 * the axis, not a sense). Ids `mark:<cell>`.
 *
 * **Ownership and caching.** Results are frozen. The analysis is cached by (image identity, channel,
 * pixel smoothing), the field by its full construction, lines and sites by every option that changes
 * their geometry: never by palette, material, mark or colour. Unrotated line geometry is cached separately
 * so a rotation edit only re-maps vertices.
 *
 * **Work bounds** (each throws naming the control to change; nothing is truncated): at most
 * {@link FIELD_LIMITS.starts} starts or mark cells, {@link FIELD_LIMITS.lines} lines, {@link FIELD_LIMITS.vertices}
 * vertices and {@link FIELD_LIMITS.steps} integration steps per construction; the foundation's own
 * orientation-work and separation-cell bounds also apply. Units: canvas units and, for published
 * angles, radians; `ambient.angle` and `frame.rotation` are degrees.
 */
export type FieldImage = { kind: "bundled"; id: BundledRasterId; variant: number; size: number } | { kind: "raster"; raster: Raster };
export type FieldValue = "lightness" | "luminance" | "saturation";
export type FieldMode = "follow" | "resist" | "blend";
export type AmbientKind = "angle" | "swirl" | "radial";

export const FIELD_LIMITS = Object.freeze({ starts: 40_000, lines: 30_000, vertices: 500_000, steps: 1_500_000 });

export interface FieldFrame { centerX: number; centerY: number; width: number; height: number; rotation: number }

export interface ImageFieldOptions {
  image: FieldImage;
  value: FieldValue;
  /** Structure-tensor Gaussian standard deviation in canvas units (>= 0; at most 64 pixels once mapped). */
  smoothing: number;
  mode: FieldMode;
  ambient: { kind: AmbientKind; angle: number; weight: number };
  frame: FieldFrame;
}

export interface FieldSample {
  /** Direction of the drawn line, canvas radians, unsigned, in [0, pi). */
  readonly angle: number;
  /** In [0, 1]; 0 where nothing may be drawn. */
  readonly confidence: number;
  /** The image's own structure coherence at this point. */
  readonly coherence: number;
  /** Tone of the chosen channel, [0, 1]. */
  readonly value: number;
  /** False where the image itself defines no direction (flat). */
  readonly defined: boolean;
}

export interface ImageField {
  readonly options: ImageFieldOptions;
  readonly raster: Raster;
  readonly values: ScalarGrid;
  readonly orientation: OrientationField;
  /** The picture rectangle in the picture's own unrotated frame: `[left, top, right, bottom]`. */
  readonly rect: readonly [number, number, number, number];
  /** Sample at a point of the picture's own unrotated frame (edge-replicated outside the rectangle). */
  atLocal(x: number, y: number): FieldSample;
  /** Sample at a canvas point (accounts for `frame.rotation`; the angle is a canvas angle). */
  at(x: number, y: number): FieldSample;
  /** Rotate a point of the unrotated frame onto the canvas. */
  toCanvas(x: number, y: number): Point;
}

const RADIANS = Math.PI / 180;
const U32 = 0x1_0000_0000;
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
const halfTurn = (a: number): number => { const r = a - Math.PI * Math.floor(a / Math.PI); return r >= Math.PI ? 0 : r; };

function remember<T>(cache: Map<string, T>, key: string, size: number, build: () => T): T {
  const hit = cache.get(key);
  if (hit !== undefined) { cache.delete(key); cache.set(key, hit); return hit; }
  const value = build();
  cache.set(key, value);
  if (cache.size > size) cache.delete(cache.keys().next().value as string);
  return value;
}

function checkNumber(name: string, value: number, min: number, max: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be a finite number in [${min}, ${max}]`);
}

function resolveImage(image: FieldImage, variant = true): { raster: Raster; key: string } {
  if (image.kind === "raster") return { raster: image.raster, key: `raster:${image.raster.hash}` };
  if (image.kind !== "bundled") throw new Error(`Unknown image source: ${(image as { kind: string }).kind}`);
  if (!Number.isSafeInteger(image.variant) || image.variant < 0 || image.variant > 0xffffffff) throw new Error("Image variant must be a uint32 integer");
  const raster = bundledRaster(image.id, image.variant, image.size);
  return { raster, key: variant ? `bundled:${image.id}:${image.variant}:${image.size}` : "" };
}

interface Structure { raster: Raster; values: ScalarGrid; orientation: OrientationField }
const structures = new Map<string, Structure>();

/** Cached channel and orientation analysis of the image at a pixel smoothing (see the module header). */
export function imageStructure(image: FieldImage, value: FieldValue, smoothingPixels: number): Structure {
  checkNumber("Coherence scale (smoothing)", smoothingPixels, 0, 64);
  const { raster, key } = resolveImage(image);
  return remember(structures, `${key}|${value}|${smoothingPixels}`, 6, () => {
    const values = valueField(raster, value);
    return Object.freeze({ raster, values, orientation: orientationField(values, { smoothing: smoothingPixels }) });
  });
}

function validateFrame(frame: FieldFrame): void {
  checkNumber("frame.centerX", frame.centerX, -1e6, 1e6); checkNumber("frame.centerY", frame.centerY, -1e6, 1e6);
  checkNumber("frame.width", frame.width, 1e-6, 1e6); checkNumber("frame.height", frame.height, 1e-6, 1e6);
  checkNumber("frame.rotation", frame.rotation, -1e6, 1e6);
}

const fields = new Map<string, ImageField>();

/** The image's direction field placed on the canvas. Cheap once `imageStructure` is cached. */
export function imageField(options: ImageFieldOptions): ImageField {
  const { frame, ambient, mode } = options;
  if (!["follow", "resist", "blend"].includes(mode)) throw new Error(`Unknown field mode: ${String(mode)}`);
  if (!["angle", "swirl", "radial"].includes(ambient.kind)) throw new Error(`Unknown ambient field: ${String(ambient.kind)}`);
  validateFrame(frame);
  checkNumber("Coherence scale (smoothing)", options.smoothing, 0, 1e6);
  checkNumber("ambient.angle", ambient.angle, -1e6, 1e6); checkNumber("ambient.weight", ambient.weight, 0, 1);
  const { raster, key } = resolveImage(options.image);
  const key2 = JSON.stringify([key, options.value, options.smoothing, mode, ambient, frame]);
  return remember(fields, key2, 8, () => {
    const { width: W, height: H } = raster;
    const sx = frame.width / W, sy = frame.height / H;
    const pixels = options.smoothing / ((sx + sy) / 2);
    if (pixels > 64) throw new Error(`Coherence scale (smoothing) ${options.smoothing} canvas units is ${pixels.toFixed(1)} image pixels; the limit is 64 pixels: lower the coherence scale or raise the image size`);
    const structure = imageStructure(options.image, options.value, pixels);
    const left = frame.centerX - frame.width / 2, top = frame.centerY - frame.height / 2;
    const rect = Object.freeze([left, top, left + frame.width, top + frame.height]) as readonly [number, number, number, number];
    const across = mode === "resist", blend = mode === "blend", weight = ambient.weight, offset = ambient.angle * RADIANS;
    const rotation = frame.rotation * RADIANS, cr = Math.cos(rotation), sr = Math.sin(rotation);
    const atLocal = (x: number, y: number): FieldSample => {
      const u = (x - left) / sx, v = (y - top) / sy;
      const o = orientationAt(structure.orientation, u, v);
      const value = sampleGrid(structure.values, u, v);
      // The along-edge tangent in canvas terms (anisotropic pictures bend directions).
      const tangent = Math.atan2(sy * Math.sin(o.direction), sx * Math.cos(o.direction));
      const coherence = o.defined ? o.coherence : 0;
      if (!blend) {
        const angle = halfTurn(across ? tangent + Math.PI / 2 : tangent);
        return { angle, confidence: coherence, coherence, value, defined: o.defined };
      }
      let ambientAngle = offset;
      if (ambient.kind !== "angle") {
        const around = Math.atan2(y - frame.centerY, x - frame.centerX);
        ambientAngle += ambient.kind === "swirl" ? around + Math.PI / 2 : around;
      }
      const wa = weight * (1 - coherence);
      const ux = coherence * Math.cos(2 * tangent) + wa * Math.cos(2 * ambientAngle), uy = coherence * Math.sin(2 * tangent) + wa * Math.sin(2 * ambientAngle);
      const confidence = Math.min(1, Math.hypot(ux, uy));
      return { angle: confidence > 0 ? halfTurn(0.5 * Math.atan2(uy, ux)) : 0, confidence, coherence, value, defined: o.defined };
    };
    const toCanvas = (x: number, y: number): Point => {
      const dx = x - frame.centerX, dy = y - frame.centerY;
      return [frame.centerX + cr * dx - sr * dy, frame.centerY + sr * dx + cr * dy];
    };
    const at = (x: number, y: number): FieldSample => {
      const dx = x - frame.centerX, dy = y - frame.centerY;
      const s = atLocal(frame.centerX + cr * dx + sr * dy, frame.centerY - sr * dx + cr * dy);
      return { ...s, angle: halfTurn(s.angle + rotation) };
    };
    return Object.freeze({ options: Object.freeze(options), raster, values: structure.values, orientation: structure.orientation, rect, atLocal, at, toCanvas });
  });
}

/** What a place must offer for a line or mark: see the module header. */
export interface FieldGate {
  /** In [0, 1]. */
  minConfidence: number;
  /** Tone window on the field's channel, inclusive, or null for no mask. */
  mask: { min: number; max: number } | null;
}

function validateGate(gate: FieldGate): void {
  checkNumber("Confidence threshold (minConfidence)", gate.minConfidence, 0, 1);
  if (gate.mask) {
    checkNumber("Tone mask minimum", gate.mask.min, 0, 1); checkNumber("Tone mask maximum", gate.mask.max, 0, 1);
    if (gate.mask.min > gate.mask.max) throw new Error("Tone mask minimum must not exceed the maximum");
  }
}
const usable = (sample: FieldSample, gate: FieldGate): boolean =>
  sample.confidence > 0 && sample.confidence >= gate.minConfidence && (!gate.mask || (sample.value >= gate.mask.min && sample.value <= gate.mask.max));

export interface FieldLineOptions {
  field: ImageField;
  gate: FieldGate;
  seed: number;
  clip: boolean;
  /** Distance between neighbouring lines, canvas units. */
  separation: number;
  /** Lines stop this fraction of `separation` from another line, in (0, 1]. */
  stopFraction: number;
  /** Spacing of the grid of start points, canvas units. */
  startSpacing: number;
  /** Start displacement as a fraction of a cell, [0, 1]. */
  startJitter: number;
  fill: boolean;
  minLength: number;
  maxLength: number;
  /** Tightest turning radius; 0 for no limit. */
  minRadius: number;
}

/** A traced line with the image attributes read along it. */
export interface FieldLine extends Path {
  readonly length: number;
  readonly meanValue: number;
  readonly meanConfidence: number;
  /** Unsigned canvas direction, radians in [0, pi). */
  readonly meanDirection: number;
  readonly parent: string | null;
}

export interface FieldSiteOptions {
  field: ImageField;
  gate: FieldGate;
  seed: number;
  spacing: number;
  jitter: number;
}

/** An oriented mark position with the attributes the field had there. */
export interface FieldSite extends Site {
  readonly confidence: number;
  readonly value: number;
  readonly coherence: number;
}

interface StartCell { id: string; x: number; y: number }
function startCells(rect: readonly [number, number, number, number], spacing: number, jitter: number, seed: number, prefix: string, purpose: string, control: string): StartCell[] {
  const [left, top, right, bottom] = rect, W = right - left, H = bottom - top;
  const cols = Math.max(1, Math.round(W / spacing)), rows = Math.max(1, Math.round(H / spacing));
  if (cols * rows > FIELD_LIMITS.starts)
    throw new Error(`${control} ${spacing} would make ${cols * rows} cells on this picture; the limit is ${FIELD_LIMITS.starts}. Raise the spacing or shrink the picture`);
  const cw = W / cols, ch = H / rows, cells: StartCell[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const id = `${prefix}:${i}:${j}`;
    const x = left + (i + 0.5) * cw + (unit(seed, id, `${purpose}x`) - 0.5) * jitter * cw;
    const y = top + (j + 0.5) * ch + (unit(seed, id, `${purpose}y`) - 0.5) * jitter * ch;
    cells.push({ id, x: Math.min(right, Math.max(left, x)), y: Math.min(bottom, Math.max(top, y)) });
  }
  return cells;
}

function validateLines(o: FieldLineOptions): void {
  validateGate(o.gate);
  if (!Number.isSafeInteger(o.seed) || o.seed < 0 || o.seed > 0xffffffff) throw new Error("Field seed must be a uint32 integer");
  checkNumber("Separation", o.separation, 0.5, 1e4); checkNumber("Crowding stop (stopFraction)", o.stopFraction, 0.05, 1);
  checkNumber("Start spacing", o.startSpacing, 0.5, 1e4); checkNumber("Start jitter", o.startJitter, 0, 1);
  checkNumber("Minimum length", o.minLength, 0, 1e6); checkNumber("Maximum length", o.maxLength, 0.5, 1e6); checkNumber("Tightest turn (minRadius)", o.minRadius, 0, 1e6);
  if (o.minLength > o.maxLength) throw new Error("Minimum length must not exceed maximum length");
}

const localCache = new Map<string, readonly { id: string; points: readonly Point[]; length: number; parent: string | null }[]>();
const lineCache = new Map<string, readonly FieldLine[]>();

/** Evenly spaced lines through the field; cached, frozen, ids stable for the same construction (see the module header). */
export function fieldLines(options: FieldLineOptions, cancelled?: () => boolean): readonly FieldLine[] {
  validateLines(options);
  const { field, gate, seed, clip, separation, stopFraction } = options;
  const o = field.options, { rotation, ...upright } = o.frame;
  const geometry = [gate, seed, clip, separation, stopFraction, options.startSpacing, options.startJitter, options.fill, options.minLength, options.maxLength, options.minRadius];
  const base = [resolveImage(o.image).key, o.value, o.smoothing, o.mode, o.ambient];
  const local = remember(localCache, JSON.stringify([base, upright, geometry]), 8, () => {
    const cells = startCells(field.rect, options.startSpacing, options.startJitter, seed, "line", "start", "Start spacing");
    const ordered = cells.map((c) => ({ ...c, order: unit(seed, c.id, "order") })).sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
    const [left, top, right, bottom] = field.rect;
    const grow = clip ? 0 : options.maxLength;
    const trace: StreamlineOptions = {
      field: (x, y, hint) => {
        const s = field.atLocal(x, y);
        if (!usable(s, gate)) return null;
        let dx = Math.cos(s.angle), dy = Math.sin(s.angle);
        if (dx * hint[0] + dy * hint[1] < 0) { dx = -dx; dy = -dy; }
        return [dx, dy];
      },
      bounds: [left - grow, top - grow, right + grow, bottom + grow],
      startBounds: field.rect,
      seeds: ordered.map((c) => ({ id: c.id, x: c.x, y: c.y, reverseFirst: unit(seed, c.id, "first") < 0.5 })),
      separation, stopFraction, step: Math.min(2, separation * stopFraction / 2),
      minLength: options.minLength, maxLength: options.maxLength, minRadius: options.minRadius, fill: options.fill,
      maxLines: FIELD_LIMITS.lines, maxVertices: FIELD_LIMITS.vertices, maxSteps: FIELD_LIMITS.steps, cancelled,
    };
    try {
      return traceStreamlines(trace).lines.map((l) => ({ id: l.id, points: l.points, length: l.length, parent: l.parent }));
    } catch (error) {
      if (error instanceof Error && /^Streamline/.test(error.message))
        throw new Error(`${error.message.replace(/^(Streamlines? [^:]*):.*$/s, "$1")}. Raise Line separation or Start spacing, lower Longest line or narrow the picture`);
      throw error;
    }
  });
  return remember(lineCache, JSON.stringify([base, o.frame, geometry]), 8, () => {
    const lines = local.map((l): FieldLine => {
      const points = l.points.map((p) => Object.freeze(field.toCanvas(p[0], p[1])) as Point);
      let sumValue = 0, sumConfidence = 0, cx = 0, cy = 0;
      for (const p of l.points) {
        const s = field.atLocal(p[0], p[1]);
        sumValue += s.value; sumConfidence += s.confidence;
      }
      for (let i = 1; i < points.length; i++) {
        const dx = points[i][0] - points[i - 1][0], dy = points[i][1] - points[i - 1][1], w = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        cx += w * Math.cos(2 * a); cy += w * Math.sin(2 * a);
      }
      return Object.freeze({
        id: l.id, seed: componentSeed(seed, l.id, "line"), points: Object.freeze(points), closed: false, level: 0, levelFraction: 0,
        length: l.length, meanValue: sumValue / l.points.length, meanConfidence: sumConfidence / l.points.length,
        meanDirection: halfTurn(0.5 * Math.atan2(cy, cx)), parent: l.parent,
      });
    });
    return Object.freeze(lines);
  });
}

const siteCache = new Map<string, readonly FieldSite[]>();

/** Oriented sites at the usable cells of a jittered grid; cached, frozen, ids stable (see the module header). */
export function fieldSites(options: FieldSiteOptions): readonly FieldSite[] {
  const { field, gate, seed, spacing, jitter } = options;
  validateGate(gate);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Field seed must be a uint32 integer");
  checkNumber("Mark spacing", spacing, 0.5, 1e4); checkNumber("Mark jitter", jitter, 0, 1);
  const key = JSON.stringify([resolveImage(field.options.image).key, field.options.value, field.options.smoothing, field.options.mode, field.options.ambient, field.options.frame, gate, seed, spacing, jitter]);
  return remember(siteCache, key, 8, () => {
    const sites: FieldSite[] = [];
    for (const cell of startCells(field.rect, spacing, jitter, seed, "mark", "site", "Mark spacing")) {
      const s = field.atLocal(cell.x, cell.y);
      if (!usable(s, gate)) continue;
      sites.push(Object.freeze({
        id: cell.id, seed: componentSeed(seed, cell.id, "site"), position: Object.freeze(field.toCanvas(cell.x, cell.y)) as Point,
        angle: halfTurn(s.angle + field.options.frame.rotation * RADIANS), scale: 1, confidence: s.confidence, value: s.value, coherence: s.coherence,
      }));
    }
    return Object.freeze(sites);
  });
}
