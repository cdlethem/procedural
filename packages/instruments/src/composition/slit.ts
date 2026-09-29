import { componentSeed } from "./core.js";
import { resolveFrameTime } from "./frame-stack.js";
import type { FrameStack } from "./frame-stack.js";
import { linearToSrgb, sampleInto } from "./raster.js";
import type { Raster } from "./raster.js";
import type { SliceRow, SliceTable } from "./slit-map.js";

/**
 * Strips, fragments and vector bands: the sampling and drawing-geometry half of the slit study.
 *
 * Source values. A resolved source is one `Raster` (`kind: "image"`, spatial slicing) or one
 * `FrameStack` (`kind: "stack"`, temporal slit-scan). The library never decodes or fetches; a
 * host binds its own decoded image or frames through these typed values (future host work: only
 * bundled sources are selectable by a persisted instrument today).
 *
 * Strips (`slitStrips`). For every row of a `SliceTable` the band is sampled at `detail` points along its
 * own length, `l = (m + 0.5) / detail` for `m = 0..detail-1`. The source position is
 * `p = 0.5 + (l - 0.5 - offset) / scale`, then the `outside` policy decides what a `p` beyond
 * [0, 1] means: `clamp` (nearest end), `wrap` (repeat), `mirror` (reflect about the ends) or `void`
 * (no sample: transparent).
 *
 * - Image: the picture is fitted to the footprint by `cover` (uniform scale, crop, centred). Slice
 *   `s` covers footprint fractions `[s/count, (s+1)/count]` across and `p` along; for columns the
 *   across axis is x, for rows it is y. A few taps across the slice width (as many as the width in
 *   source pixels, at most 4) are averaged in linear light.
 * - Frames: the slit is a curve in the frame, in frame pixels. Its centre is
 *   `(x * width, 0.5 * height)`; `angle` (degrees; 0 runs down the frame, positive turns toward +x)
 *   sets its direction, `length` its extent as a fraction of the frame's shorter side, and `bend`
 *   pushes its middle sideways by that fraction of the shorter side (a parabola, zero at both
 *   ends; positive is to the right of the direction of travel on screen). The slit position at `p` is
 *   `centre + direction (p - 0.5) length + normal bend (1 - (2p - 1)^2)`. A point outside the frame is
 *   void, always: there is nothing to sample beyond the frame.
 *   The two frames of a time (`frame`, `next`, `mix`) are mixed in LINEAR light.
 *
 * Colour and alpha: samples are averaged premultiplied in linear light, then stored as straight 8-bit
 * sRGB. Bands are OPAQUE vector fills, so coverage is thresholded: alpha at or above 0.5 is drawn opaque,
 * below is void. Work: `bands x detail` samples, at most 1,200 x 400 = 480,000 by the slice and detail limits.
 *
 * Fragments (`slitFragments`). Unsliced windows onto the source at their own place: `count` seeded
 * rectangles of about `size` (a fraction of each footprint side, +-25%) show the unrecomposed image (or the
 * frame nearest `time` of a sequence) with the same cover fit. Their ids are `fragment:NN` and each
 * draws its own position and size from that id, so raising the count only adds fragments. Cells are
 * `max(width, height) / detail` canvas units square; at most 250,000 cells in all.
 *
 * Bands (`slitRects`). The vector output. Each strip's samples are quantized (source colour: `levels`
 * per channel; tonal ramp: `levels` steps of luma through the palette; ink: a single palette colour where luma
 * is below `threshold`), equal consecutive samples merge into runs, and runs of neighbouring bands with the
 * same extent and colour merge into one rectangle when `gap` is 0. Optional `cells` (retained quilt leaves)
 * clip the rectangles exactly. Rectangles are in footprint-local units, origin at the footprint centre, x right, y
 * down; at most 120,000 (message names Detail, Slices and Tone steps). They are values, not paint: `drawSlit` decides how to fill them.
 */
export const SLIT_LIMITS = Object.freeze({ maxFragmentCells: 250_000, maxRects: 120_000, maxFragments: 24, minDetail: 4, maxDetail: 400 });

export type SlitDirection = "columns" | "rows";
export type OutsidePolicy = "clamp" | "wrap" | "mirror" | "void";
export type SlitSourceValue = { readonly kind: "image"; readonly raster: Raster } | { readonly kind: "stack"; readonly stack: FrameStack };

export interface SlitLine {
  /** Centre across the frame, fraction of the width. */
  x: number;
  /** Degrees; 0 runs down the frame. */
  angle: number;
  /** Sideways push of the middle, fraction of the frame's shorter side. */
  bend: number;
  /** Extent, fraction of the frame's shorter side. */
  length: number;
}

export interface StripOptions {
  direction: SlitDirection;
  /** Footprint in canvas units; the image is fitted to it (ignored for frame stacks). */
  width: number;
  height: number;
  detail: number;
  outside: OutsidePolicy;
  /** Used for frame stacks only. */
  slit: SlitLine;
}

/** Sampled 8-bit sRGB straight RGBA, one row per band in output order. Read with `stripPixel`. */
export interface StripSet {
  readonly rows: number;
  readonly detail: number;
}
const stripStores = new WeakMap<object, Uint8Array>();

/** One sample: `[r, g, b, a]` bytes; alpha is 0 (void) or 255. */
export function stripPixel(strips: StripSet, row: number, m: number): readonly [number, number, number, number] {
  const store = stripStores.get(strips);
  if (!store) throw new Error("Expected a StripSet created by slitStrips");
  if (!Number.isInteger(row) || row < 0 || row >= strips.rows || !Number.isInteger(m) || m < 0 || m >= strips.detail) throw new Error(`Strip sample (${row}, ${m}) is outside ${strips.rows} x ${strips.detail}`);
  const at = (row * strips.detail + m) * 4;
  return [store[at], store[at + 1], store[at + 2], store[at + 3]];
}
function stripStorage(strips: StripSet): Uint8Array {
  const store = stripStores.get(strips);
  if (!store) throw new Error("Expected a StripSet created by slitStrips");
  return store;
}

function finiteIn(label: string, value: number, low: number, high: number, control: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high)
    throw new Error(`${label} must be a finite number in [${low}, ${high}] (got ${String(value)}); change ${control}`);
}
function checkDirection(direction: string): void {
  if (direction !== "columns" && direction !== "rows") throw new Error(`Unknown slice direction: ${String(direction)}`);
}
function checkDetail(detail: number): void {
  if (!Number.isInteger(detail) || detail < SLIT_LIMITS.minDetail || detail > SLIT_LIMITS.maxDetail)
    throw new Error(`Detail must be an integer in [${SLIT_LIMITS.minDetail}, ${SLIT_LIMITS.maxDetail}] (got ${String(detail)}); change Detail`);
}

/** Position on the slit at parameter `p`, in frame pixels. */
export function slitPoint(line: SlitLine, p: number, width: number, height: number): readonly [number, number] {
  const side = Math.min(width, height), angle = line.angle * Math.PI / 180;
  const dx = Math.sin(angle), dy = Math.cos(angle), nx = dy, ny = -dx;
  const along = (p - 0.5) * line.length * side, bulge = line.bend * side * (1 - (2 * p - 1) ** 2);
  return [line.x * width + dx * along + nx * bulge, 0.5 * height + dy * along + ny * bulge];
}

/** Apply the outside policy to a source position; NaN means void. */
export function placePosition(p: number, outside: OutsidePolicy): number {
  if (p >= 0 && p <= 1) return p;
  switch (outside) {
    case "clamp": return p < 0 ? 0 : 1;
    case "wrap": { const r = p - Math.floor(p); return r; }
    case "mirror": { const r = ((p % 2) + 2) % 2; return r <= 1 ? r : 2 - r; }
    default: return NaN;
  }
}

const tapScratch = new Float64Array(4);
/** Add `weight` times the premultiplied linear RGBA of `raster` at pixel-space (x, y) into `acc`. */
function tap(raster: Raster, x: number, y: number, weight: number, acc: Float64Array): void {
  sampleInto(raster, x, y, tapScratch, { space: "linear", output: "premultiplied", edge: "clamp" });
  switch (raster.channels) {
    case 1: acc[0] += weight * tapScratch[0]; acc[1] += weight * tapScratch[0]; acc[2] += weight * tapScratch[0]; acc[3] += weight; break;
    case 2: acc[0] += weight * tapScratch[0]; acc[1] += weight * tapScratch[0]; acc[2] += weight * tapScratch[0]; acc[3] += weight * tapScratch[1]; break;
    case 3: acc[0] += weight * tapScratch[0]; acc[1] += weight * tapScratch[1]; acc[2] += weight * tapScratch[2]; acc[3] += weight; break;
    default: acc[0] += weight * tapScratch[0]; acc[1] += weight * tapScratch[1]; acc[2] += weight * tapScratch[2]; acc[3] += weight * tapScratch[3];
  }
}

const byte = (linear: number): number => Math.round(Math.min(Math.max(linearToSrgb(Math.min(Math.max(linear, 0), 1)), 0), 1) * 255);

/** Store the accumulated sample (alpha threshold 0.5, opaque bytes) at `at`, or void. */
function store(acc: Float64Array, out: Uint8Array, at: number): void {
  const alpha = acc[3];
  if (!(alpha >= 0.5)) { out[at] = out[at + 1] = out[at + 2] = out[at + 3] = 0; return; }
  out[at] = byte(acc[0] / alpha); out[at + 1] = byte(acc[1] / alpha); out[at + 2] = byte(acc[2] / alpha); out[at + 3] = 255;
}

/** Canvas units per source pixel under the `cover` fit of a `sw x sh` source onto a `width x height` footprint. */
export const coverScale = (sw: number, sh: number, width: number, height: number): number => Math.max(width / sw, height / sh);

const stripCaches = new WeakMap<SliceTable, Map<string, StripSet>>();

/**
 * Sample every band of `table` from `source`. Cached by construction: the cache lives with the table and is
 * keyed by the source's content hash and the sampling options, never by colour, gap, mask or placement.
 */
export function slitStrips(source: SlitSourceValue, table: SliceTable, options: StripOptions): StripSet {
  const { direction, width, height, detail, outside, slit } = options;
  checkDirection(direction);
  checkDetail(detail);
  if (outside !== "clamp" && outside !== "wrap" && outside !== "mirror" && outside !== "void") throw new Error(`Unknown outside policy: ${String(outside)}`);
  if (table.mode === "space" && source.kind !== "image") throw new Error("A spatial slice table needs an image source");
  if (table.mode === "time" && source.kind !== "stack") throw new Error("A temporal slice table needs a frame stack");
  if (source.kind === "image") {
    finiteIn("Footprint width", width, 1e-6, 1e6, "Width"); finiteIn("Footprint height", height, 1e-6, 1e6, "Height");
  } else {
    finiteIn("Slit x", slit.x, -1, 2, "Slit position"); finiteIn("Slit angle", slit.angle, -3600, 3600, "Slit angle");
    finiteIn("Slit bend", slit.bend, -2, 2, "Slit bend"); finiteIn("Slit length", slit.length, 1e-6, 8, "Slit length");
  }
  const key = JSON.stringify(source.kind === "image"
    ? [source.raster.hash, direction, width, height, detail, outside]
    : [source.stack.hash, detail, outside, slit.x, slit.angle, slit.bend, slit.length]);
  let cache = stripCaches.get(table);
  if (!cache) stripCaches.set(table, cache = new Map());
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }

  const rows = table.rows, out = new Uint8Array(rows.length * detail * 4), acc = new Float64Array(4);
  if (source.kind === "image") {
    const { raster } = source, scale = coverScale(raster.width, raster.height, width, height);
    const across = direction === "columns" ? width : height;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r], [i0, i1] = row.interval;
      const taps = Math.min(4, Math.max(1, Math.round(((i1 - i0) * across) / scale)));
      for (let m = 0; m < detail; m++) {
        const at = (r * detail + m) * 4, p = placePosition(0.5 + ((m + 0.5) / detail - 0.5 - row.offset) / row.scale, outside);
        if (Number.isNaN(p)) { out[at + 3] = 0; continue; }
        acc.fill(0);
        for (let k = 0; k < taps; k++) {
          const a = i0 + ((k + 0.5) / taps) * (i1 - i0);
          const fx = direction === "columns" ? a : p, fy = direction === "columns" ? p : a;
          tap(raster, raster.width / 2 + (fx - 0.5) * width / scale, raster.height / 2 + (fy - 0.5) * height / scale, 1 / taps, acc);
        }
        store(acc, out, at);
      }
    }
  } else {
    const { stack } = source, { width: fw, height: fh } = stack;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r], time = row.time!;
      for (let m = 0; m < detail; m++) {
        const at = (r * detail + m) * 4, p = placePosition(0.5 + ((m + 0.5) / detail - 0.5 - row.offset) / row.scale, outside);
        if (Number.isNaN(p)) { out[at + 3] = 0; continue; }
        const [x, y] = slitPoint(slit, p, fw, fh);
        if (x < 0 || y < 0 || x > fw || y > fh) { out[at + 3] = 0; continue; }
        acc.fill(0);
        tap(stack.frames[time.frame], x, y, 1 - time.mix, acc);
        if (time.mix > 0) tap(stack.frames[time.next], x, y, time.mix, acc);
        store(acc, out, at);
      }
    }
  }
  const strips: StripSet = Object.freeze({ rows: rows.length, detail });
  stripStores.set(strips, out);
  cache.set(key, strips);
  if (cache.size > 4) cache.delete(cache.keys().next().value!);
  return strips;
}

// ------------------------------------------------------------------------------------------ fragments

export interface FragmentOptions {
  seed: number;
  count: number;
  /** Nominal side as a fraction of each footprint side, in (0, 1]. */
  size: number;
  /** For frame stacks: the moment shown, as a fraction of the duration in [0, 1]. */
  time: number;
  width: number;
  height: number;
  detail: number;
}
export interface SlitFragment {
  readonly id: string;
  readonly seed: number;
  /** [x0, y0, x1, y1] as fractions of the footprint. */
  readonly rect: readonly [number, number, number, number];
  readonly columns: number;
  readonly rows: number;
  /** Row-major sample index of this fragment's first cell in the set's storage. */
  readonly offset: number;
}
export interface FragmentSet {
  readonly fragments: readonly SlitFragment[];
  /** Canvas units of one cell. */
  readonly cell: number;
}
const fragmentStores = new WeakMap<object, Uint8Array>();
const U32 = 0x1_0000_0000;

const fragmentCache = new Map<string, FragmentSet>();

export function slitFragments(source: SlitSourceValue, options: FragmentOptions): FragmentSet {
  const { seed, count, size, time, width, height, detail } = options;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Fragment seed must be a uint32 integer");
  if (!Number.isInteger(count) || count < 0 || count > SLIT_LIMITS.maxFragments) throw new Error(`Fragments must be an integer in [0, ${SLIT_LIMITS.maxFragments}] (got ${String(count)}); change Fragments`);
  finiteIn("Fragment size", size, 0.01, 1, "Fragment size");
  finiteIn("Fragment time", time, 0, 1, "Fragment moment");
  finiteIn("Footprint width", width, 1e-6, 1e6, "Width"); finiteIn("Footprint height", height, 1e-6, 1e6, "Height");
  checkDetail(detail);
  const empty: FragmentSet = Object.freeze({ fragments: Object.freeze([]), cell: Math.max(width, height) / detail });
  if (count === 0) return empty;
  const hash = source.kind === "image" ? source.raster.hash : source.stack.hash;
  const key = JSON.stringify([hash, seed, count, size, source.kind === "stack" ? time : 0, width, height, detail]);
  const hit = fragmentCache.get(key);
  if (hit) { fragmentCache.delete(key); fragmentCache.set(key, hit); return hit; }

  const cell = Math.max(width, height) / detail, fragments: SlitFragment[] = [];
  let cells = 0;
  for (let k = 0; k < count; k++) {
    const id = `fragment:${String(k).padStart(2, "0")}`, unit = (purpose: string): number => componentSeed(seed, id, purpose) / U32;
    const fw = Math.min(1, size * (0.75 + 0.5 * unit("width"))), fh = Math.min(1, size * (0.75 + 0.5 * unit("height")));
    const cx = Math.min(Math.max(unit("x"), fw / 2), 1 - fw / 2), cy = Math.min(Math.max(unit("y"), fh / 2), 1 - fh / 2);
    const columns = Math.max(1, Math.ceil(fw * width / cell)), rows = Math.max(1, Math.ceil(fh * height / cell));
    fragments.push({ id, seed: componentSeed(seed, id, "fragment"), rect: Object.freeze([cx - fw / 2, cy - fh / 2, cx + fw / 2, cy + fh / 2] as const), columns, rows, offset: cells });
    cells += columns * rows;
  }
  if (cells > SLIT_LIMITS.maxFragmentCells)
    throw new Error(`Fragments need ${cells} cells; the limit is ${SLIT_LIMITS.maxFragmentCells}. Lower Fragments, Fragment size or Detail`);
  const out = new Uint8Array(cells * 4), acc = new Float64Array(4);
  let raster: Raster, sw: number, sh: number, scale: number;
  if (source.kind === "image") raster = source.raster;
  else {
    const t = source.stack, resolved = resolveFrameTime(t, t.start + time * t.duration, "nearest", "clamp");
    raster = t.frames[resolved.frame];
  }
  sw = raster.width; sh = raster.height; scale = coverScale(sw, sh, width, height);
  for (const f of fragments) {
    const [x0, y0, x1, y1] = f.rect;
    for (let j = 0; j < f.rows; j++) for (let i = 0; i < f.columns; i++) {
      const fx = x0 + ((i + 0.5) / f.columns) * (x1 - x0), fy = y0 + ((j + 0.5) / f.rows) * (y1 - y0);
      acc.fill(0);
      tap(raster, sw / 2 + (fx - 0.5) * width / scale, sh / 2 + (fy - 0.5) * height / scale, 1, acc);
      store(acc, out, (f.offset + j * f.columns + i) * 4);
    }
  }
  const set: FragmentSet = Object.freeze({ fragments: Object.freeze(fragments.map((f) => Object.freeze(f))), cell });
  fragmentStores.set(set, out);
  fragmentCache.set(key, set);
  if (fragmentCache.size > 6) fragmentCache.delete(fragmentCache.keys().next().value!);
  return set;
}

// ------------------------------------------------------------------------------------------ vector bands

export type ColorMode = "source" | "ramp" | "ink";
export interface SlitColor {
  mode: ColorMode;
  /** Steps per channel (source) or tone steps (ramp), 2..64. */
  levels: number;
  /** Ink only: luma (0..1) below which a sample is inked. */
  threshold: number;
  /** Packed 0xRRGGBB colors; the ramp runs through them evenly from dark to light, ink uses the first. */
  palette: readonly number[];
}
/** A retained clipping cell in footprint-local units: [left, top, right, bottom]. */
export type SlitCell = readonly [number, number, number, number];

export interface SlitRectOptions {
  direction: SlitDirection;
  width: number;
  height: number;
  color: SlitColor;
  /** Fraction of every band's width left empty (split evenly to both sides), in [0, 1). */
  gap: number;
  /** Clip to these cells, exactly; `null` for no clipping. */
  cells: readonly SlitCell[] | null;
}
export interface SlitRect {
  /** `band:<first slot>-<last slot>:<first sample>-<last sample>` or `<fragment id>:<row>-<row>:<first>-<last>`. */
  readonly id: string;
  /** Footprint-local top-left and size, canvas units. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rgb: readonly [number, number, number];
  /** Slice ids covered, first to last (bands only). */
  readonly rows: readonly [string, string] | null;
  readonly fragment: string | null;
}

function checkColor(color: SlitColor): void {
  if (color.mode !== "source" && color.mode !== "ramp" && color.mode !== "ink") throw new Error(`Unknown color mode: ${String(color.mode)}`);
  if (!Number.isInteger(color.levels) || color.levels < 2 || color.levels > 64) throw new Error(`Tone steps must be an integer in [2, 64] (got ${String(color.levels)}); change Tone steps`);
  finiteIn("Ink threshold", color.threshold, 0, 1, "Ink threshold");
  if (!Array.isArray(color.palette) || color.palette.length === 0 || color.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff)) throw new Error("Slit colors need packed RGB palette colors");
}

interface Quantizer { key(r: number, g: number, b: number): number; rgb(key: number): readonly [number, number, number] }
/** Rec. 709 weights on the stored (sRGB-encoded) bytes: the display gray, in [0, 1]. */
const lumaOf = (r: number, g: number, b: number): number => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Piecewise-linear ramp through the palette (sRGB channel values, evenly spaced stops). */
export function paletteRamp(palette: readonly number[], t: number): readonly [number, number, number] {
  const channels = (c: number): [number, number, number] => [(c >>> 16) & 255, (c >>> 8) & 255, c & 255];
  if (palette.length === 1) return channels(palette[0]);
  const position = Math.min(Math.max(t, 0), 1) * (palette.length - 1), j = Math.min(palette.length - 2, Math.floor(position)), f = position - j;
  const a = channels(palette[j]), b = channels(palette[j + 1]);
  return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)];
}

function quantizer(color: SlitColor): Quantizer {
  const q = color.levels;
  if (color.mode === "source") {
    const step = (c: number): number => Math.round((c / 255) * (q - 1));
    return { key: (r, g, b) => (step(r) * q + step(g)) * q + step(b),
      rgb: (key) => { const b = key % q, g = Math.floor(key / q) % q, r = Math.floor(key / (q * q)); return [Math.round((r / (q - 1)) * 255), Math.round((g / (q - 1)) * 255), Math.round((b / (q - 1)) * 255)]; } };
  }
  if (color.mode === "ramp")
    return { key: (r, g, b) => Math.round(lumaOf(r, g, b) * (q - 1)), rgb: (key) => paletteRamp(color.palette, key / (q - 1)) };
  const ink = paletteRamp(color.palette, 0);
  return { key: (r, g, b) => (lumaOf(r, g, b) < color.threshold ? 0 : -1), rgb: () => ink };
}


/**
 * The vector bands and fragments as rectangles, in draw order: bands by output slot, then by run, then fragments.
 * Exact geometry; no antialiasing allowance (`drawSlit` adds a hairline spill).
 */
export function slitRects(table: SliceTable, strips: StripSet, fragments: FragmentSet | null, options: SlitRectOptions): readonly SlitRect[] {
  const { direction, width, height, gap, cells } = options;
  checkDirection(direction);
  checkColor(options.color);
  finiteIn("Footprint width", width, 1e-6, 1e6, "Width"); finiteIn("Footprint height", height, 1e-6, 1e6, "Height");
  finiteIn("Gap", gap, 0, 0.999, "Gap");
  if (strips.rows !== table.rows.length) throw new Error("The strips do not belong to this slice table");
  const quant = quantizer(options.color), data = stripStorage(strips), detail = strips.detail;
  const columns = direction === "columns", across = columns ? width : height, along = columns ? height : width;
  const out: SlitRect[] = [];
  const tooMany = (): never => { throw new Error(`The bands need more than ${SLIT_LIMITS.maxRects} rectangles; lower Detail, Slices or Tone steps, or raise Gap`); };
  const cellList: readonly (SlitCell | null)[] = cells ?? [null];
  const put = (id: string, a0: number, a1: number, l0: number, l1: number, rgb: readonly [number, number, number], rows: SlitRect["rows"], fragment: string | null): SlitRect => {
    if (out.length >= SLIT_LIMITS.maxRects) tooMany();
    const rect: SlitRect = Object.freeze(columns || fragment !== null
      ? { id, x: a0, y: l0, width: a1 - a0, height: l1 - l0, rgb, rows, fragment }
      : { id, x: l0, y: a0, width: l1 - l0, height: a1 - a0, rgb, rows, fragment });
    out.push(rect);
    return rect;
  };
  // Bands: openings keyed by (cell, sample range, color) may grow across neighbouring bands.
  const mergeable = gap === 0;
  interface Piece { a0: number; a1: number; l0: number; l1: number; rgb: readonly [number, number, number]; first: string; last: string; slot0: number; slot1: number; s0: number; s1: number; open: boolean }
  const pieces: Piece[] = [];
  let live = new Map<string, Piece>();
  const EPS = 1e-9;
  for (let r = 0; r < table.rows.length; r++) {
    const row: SliceRow = table.rows[r];
    const band0 = row.across[0] * across - across / 2, band1 = row.across[1] * across - across / 2, trim = (band1 - band0) * gap / 2;
    const b0 = band0 + trim, b1 = band1 - trim;
    const next = new Map<string, Piece>();
    for (let m = 0; m < detail;) {
      const at = (r * detail + m) * 4;
      if (data[at + 3] === 0) { m++; continue; }
      const k = quant.key(data[at], data[at + 1], data[at + 2]);
      if (k < 0) { m++; continue; }
      let e = m + 1;
      while (e < detail) {
        const t = (r * detail + e) * 4;
        if (data[t + 3] === 0 || quant.key(data[t], data[t + 1], data[t + 2]) !== k) break;
        e++;
      }
      const l0 = (m / detail) * along - along / 2, l1 = (e / detail) * along - along / 2, rgb = quant.rgb(k);
      for (let c = 0; c < cellList.length; c++) {
        const cell = cellList[c];
        let ca0 = b0, ca1 = b1, cl0 = l0, cl1 = l1;
        if (cell) {
          const [left, top, right, bottom] = cell;
          const a0 = columns ? left : top, a1 = columns ? right : bottom, p0 = columns ? top : left, p1 = columns ? bottom : right;
          ca0 = Math.max(b0, a0); ca1 = Math.min(b1, a1); cl0 = Math.max(l0, p0); cl1 = Math.min(l1, p1);
          if (!(ca1 - ca0 > EPS) || !(cl1 - cl0 > EPS)) continue;
        }
        const key = `${c}|${m}|${e}|${k}|${cl0}|${cl1}`;
        const before = mergeable ? live.get(key) : undefined;
        if (before && Math.abs(before.a1 - ca0) <= EPS) { before.a1 = ca1; before.last = row.id; before.slot1 = row.slot; next.set(key, before); }
        else {
          const piece: Piece = { a0: ca0, a1: ca1, l0: cl0, l1: cl1, rgb, first: row.id, last: row.id, slot0: row.slot, slot1: row.slot, s0: m, s1: e - 1, open: true };
          pieces.push(piece);
          if (pieces.length > SLIT_LIMITS.maxRects) tooMany();
          next.set(key, piece);
        }
      }
      m = e;
    }
    live = next;
  }
  for (const p of pieces) put(`band:${p.slot0}-${p.slot1}:${p.s0}-${p.s1}`, p.a0, p.a1, p.l0, p.l1, p.rgb, Object.freeze([p.first, p.last] as const), null);
  // Fragments: the same quantization, merged along rows then down neighbouring rows.
  if (fragments && fragments.fragments.length > 0) {
    const fdata = fragmentStores.get(fragments)!;
    for (const f of fragments.fragments) {
      const [fx0, fy0, fx1, fy1] = f.rect, x0 = (fx0 - 0.5) * width, x1 = (fx1 - 0.5) * width, y0 = (fy0 - 0.5) * height, y1 = (fy1 - 0.5) * height;
      let open = new Map<string, { rect: { x0: number; y0: number; x1: number; y1: number; rgb: readonly [number, number, number]; c0: number; c1: number; r0: number; r1: number } }>();
      const fragmentPieces: { x0: number; y0: number; x1: number; y1: number; rgb: readonly [number, number, number]; c0: number; c1: number; r0: number; r1: number }[] = [];
      for (let j = 0; j < f.rows; j++) {
        const next = new Map<string, { rect: (typeof fragmentPieces)[number] }>();
        const ry0 = y0 + (j / f.rows) * (y1 - y0), ry1 = y0 + ((j + 1) / f.rows) * (y1 - y0);
        for (let i = 0; i < f.columns;) {
          const at = (f.offset + j * f.columns + i) * 4;
          if (fdata[at + 3] === 0) { i++; continue; }
          const k = quant.key(fdata[at], fdata[at + 1], fdata[at + 2]);
          if (k < 0) { i++; continue; }
          let e = i + 1;
          while (e < f.columns) {
            const t = (f.offset + j * f.columns + e) * 4;
            if (fdata[t + 3] === 0 || quant.key(fdata[t], fdata[t + 1], fdata[t + 2]) !== k) break;
            e++;
          }
          const key = `${i}|${e}|${k}`, before = open.get(key);
          if (before) { before.rect.y1 = ry1; before.rect.r1 = j; next.set(key, before); }
          else {
            const rect = { x0: x0 + (i / f.columns) * (x1 - x0), y0: ry0, x1: x0 + (e / f.columns) * (x1 - x0), y1: ry1, rgb: quant.rgb(k), c0: i, c1: e - 1, r0: j, r1: j };
            fragmentPieces.push(rect);
            next.set(key, { rect });
          }
          i = e;
        }
        open = next;
      }
      for (const p of fragmentPieces) put(`${f.id}:${p.r0}-${p.r1}:${p.c0}-${p.c1}`, p.x0, p.x1, p.y0, p.y1, p.rgb, null, f.id);
    }
  }
  return Object.freeze(out);
}

