/**
 * Owned immutable rasters (F3, asset inputs) and the sampling, conversion and extraction that
 * consume them.
 *
 * Input contract. The library NEVER fetches, opens or decodes files, URLs or image containers. A host
 * (or a bundled generator, see `raster-samples.ts`) decodes an image and hands over `RasterData`:
 * resolved samples plus every declaration needed to interpret them. `createRaster` validates, COPIES
 * and freezes; the caller's array is never retained and mutating it later cannot change the raster.
 * Typed-array storage cannot be frozen, so the storage is private to this module: a `Raster` exposes
 * only read accessors (`rasterPixel`, `rasterData` returns a copy), never its backing array.
 *
 * Declarations (all explicit, no defaults):
 * - `width`, `height`: integers in [1, 8192], at most 16,777,216 pixels and 128 MiB of storage.
 * - `channels`: 1 gray, 2 gray + alpha, 3 RGB, 4 RGBA. The alpha channel, when present, is last.
 * - `format`: `u8` (`Uint8ClampedArray`, integers 0..255, value = byte / 255) or `f32` (`Float32Array`,
 *   finite values in [0, 1]). Float rasters serve fields (height, pigment, coverage) as well as color;
 *   unbounded fields are the host's to normalize, this type has no range metadata.
 * - `colorSpace`: `srgb` (IEC 61966-2-1 transfer curve, Rec. 709 primaries) or `linear` (the same
 *   primaries, light-proportional). It describes the COLOR channels of gray/RGB data. Alpha is always
 *   linear coverage and is never transfer-encoded.
 * - `alpha`: `none` (only channels 1 and 3), `straight` (color is independent of alpha) or
 *   `premultiplied` (stored color is color * alpha, so every color value must not exceed alpha).
 * Row-major, top row first; pixel (i, j) has channel `c` at `(j * width + i) * channels + c`.
 *
 * Pixel-center convention. Raster space has its origin at the TOP-LEFT CORNER of the top-left pixel,
 * x to the right, y down, one unit per pixel. Pixel (i, j) covers [i, i+1) x [j, j+1) and its sample
 * lies at its centre (i + 0.5, j + 0.5). A point exactly on the boundary between two pixels belongs to
 * the pixel with the larger index (`nearest` uses `floor`). `rasterMapping` places this space on a
 * canvas rectangle; canvas units are whatever the caller's rectangle uses.
 *
 * Sampling. `sampleRaster` reads the raster at any real point in the raster's own color space (or the
 * stated `space`) with `nearest`, `bilinear` or `bicubic` (Catmull-Rom, a = -1/2) interpolation.
 * Interpolation is ALWAYS done on premultiplied color in the working space, so a transparent pixel's
 * hidden color never bleeds into its neighbours; the result is returned straight or premultiplied as
 * requested. Bicubic can overshoot; its result is clamped to [0, 1] (and color to <= alpha).
 * Outside the image the `edge` rule applies: `clamp` repeats the outermost pixels, `repeat` tiles,
 * `mirror` reflects about the pixel EDGES (..., 1, 0 | 0, 1, ..., n-1 | n-1, ...), and `zero` is
 * transparent black (for an alpha-free raster: black), so an image fades to nothing at its border.
 *
 * Conversion happens only at the boundary, through `convertRaster`: color space, straight/premultiplied
 * and `u8`/`f32`. Float to byte rounds to nearest, .5 upward (`Math.round`). Conversions to bytes and
 * premultiplication of bytes lose precision; a straight-alpha byte raster with transparent pixels loses
 * their hidden color when premultiplied. Nothing converts implicitly; every consumer states the space it
 * works in (`valueField`: linear light for `luminance`/`lightness`, encoded for `luma`).
 *
 * Content hash. `raster.hash` is the lowercase hex SHA-256 of
 * `"procedural-raster/1\n" + width + "x" + height + "x" + channels + " " + format + " " + colorSpace + " " +
 * alpha + "\n"` (ASCII) followed by the storage bytes (`u8` as is, `f32` as little-endian IEEE-754). The
 * `label` is a diagnostic name and is NOT hashed. Equal hash means equal content and declarations.
 * The hash is computed lazily (pure JavaScript, measured about 270 MB/s: 59 ms for a 2048 x 2048 RGBA byte raster) and cached.
 *
 * Grids. `ScalarGrid` (float64) and `LabelGrid` (int32) are the immutable single-channel results of
 * analysis (value fields, masks, labels), with the same private-storage rule.
 *
 * Work bounds. Everything is linear in pixels; over a limit the function throws a message naming the
 * argument to change. Nothing truncates.
 */

export type ColorSpace = "srgb" | "linear";
export type AlphaMode = "none" | "straight" | "premultiplied";
export type RasterFormat = "u8" | "f32";
export type RasterChannels = 1 | 2 | 3 | 4;

/** Plain-data raster description (JSON-compatible apart from `data`, which may be a plain array). */
export interface RasterData {
  width: number;
  height: number;
  channels: RasterChannels;
  format: RasterFormat;
  colorSpace: ColorSpace;
  alpha: AlphaMode;
  data: ArrayLike<number>;
  /** Optional diagnostic name for error messages; not part of the content hash. */
  label?: string;
}

export const RASTER_LIMITS = Object.freeze({ maxSide: 8192, maxPixels: 16_777_216, maxBytes: 134_217_728 });

/** Immutable owned raster. Use the functions in this module to read it. */
export interface Raster {
  readonly width: number;
  readonly height: number;
  readonly channels: RasterChannels;
  readonly format: RasterFormat;
  readonly colorSpace: ColorSpace;
  readonly alpha: AlphaMode;
  readonly label: string;
  /** Lowercase hex SHA-256 of the canonical bytes described in the module header. Computed lazily. */
  readonly hash: string;
}

type Storage = Uint8ClampedArray | Float32Array;
const stores = new WeakMap<object, Storage>();
const hashes = new WeakMap<object, string>();

/** The backing storage of a raster. Internal to the composition modules: NEVER mutate it. */
export function rasterStorage(raster: Raster): Storage {
  const store = stores.get(raster);
  if (!store) throw new Error("Expected a Raster created by createRaster");
  return store;
}

const EPS_PREMULTIPLIED = 1e-6;

function checkSize(label: string, width: unknown, height: unknown): void {
  for (const [name, v] of [["width", width], ["height", height]] as const)
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > RASTER_LIMITS.maxSide)
      throw new Error(`${label}: ${name} must be an integer in [1, ${RASTER_LIMITS.maxSide}] (got ${String(v)})`);
  if ((width as number) * (height as number) > RASTER_LIMITS.maxPixels)
    throw new Error(`${label}: ${width} x ${height} has more than ${RASTER_LIMITS.maxPixels} pixels; reduce width or height`);
}

const hasAlpha = (channels: number): boolean => channels === 2 || channels === 4;

/** Validate, copy and freeze a raster. Failures name the field and, for samples, the index. */
export function createRaster(input: RasterData): Raster {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error("Raster data must be an object");
  const allowed = ["width", "height", "channels", "format", "colorSpace", "alpha", "data", "label"];
  for (const key of Reflect.ownKeys(input))
    if (typeof key !== "string" || !allowed.includes(key)) throw new Error(`Raster data has an unknown field: ${String(key)}`);
  const label = input.label === undefined ? "raster" : input.label;
  if (typeof label !== "string" || label.length === 0 || label.length > 120) throw new Error("Raster label must be a nonempty string of at most 120 characters");
  checkSize(`Raster "${label}"`, input.width, input.height);
  const { width, height, channels, format, colorSpace, alpha } = input;
  if (channels !== 1 && channels !== 2 && channels !== 3 && channels !== 4) throw new Error(`Raster "${label}": channels must be 1, 2, 3 or 4`);
  if (format !== "u8" && format !== "f32") throw new Error(`Raster "${label}": format must be "u8" or "f32"`);
  if (colorSpace !== "srgb" && colorSpace !== "linear") throw new Error(`Raster "${label}": colorSpace must be "srgb" or "linear"`);
  if (alpha !== "none" && alpha !== "straight" && alpha !== "premultiplied") throw new Error(`Raster "${label}": alpha must be "none", "straight" or "premultiplied"`);
  if (hasAlpha(channels) === (alpha === "none"))
    throw new Error(`Raster "${label}": ${channels} channels ${hasAlpha(channels) ? "include an alpha channel, so alpha must be \"straight\" or \"premultiplied\"" : "have no alpha channel, so alpha must be \"none\""}`);
  const count = width * height * channels;
  if (count * (format === "u8" ? 1 : 4) > RASTER_LIMITS.maxBytes)
    throw new Error(`Raster "${label}": ${width} x ${height} x ${channels} ${format} exceeds ${RASTER_LIMITS.maxBytes} bytes; reduce width, height, channels or use u8`);
  const source = input.data;
  const isArray = Array.isArray(source) || (ArrayBuffer.isView(source) && !(source instanceof DataView));
  if (!isArray) throw new Error(`Raster "${label}": data must be an array or typed array of numbers`);
  if (source.length !== count) throw new Error(`Raster "${label}": data has ${source.length} samples but ${width} x ${height} x ${channels} needs ${count}`);
  const store: Storage = format === "u8" ? new Uint8ClampedArray(count) : new Float32Array(count);
  const nativeBytes = format === "u8" && (source instanceof Uint8Array || source instanceof Uint8ClampedArray);
  if (nativeBytes) store.set(source as Uint8Array);
  else {
    const top = format === "u8" ? 255 : 1;
    for (let i = 0; i < count; i++) {
      const v = (source as ArrayLike<unknown>)[i];
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > top || (format === "u8" && !Number.isInteger(v)))
        throw new Error(`Raster "${label}": data[${i}] must be ${format === "u8" ? "an integer" : "a finite number"} in [0, ${top}] (got ${String(v)})`);
      store[i] = v;
    }
  }
  if (alpha === "premultiplied") {
    const top = format === "u8" ? 255 : 1, eps = format === "u8" ? 0 : EPS_PREMULTIPLIED;
    for (let p = 0; p < width * height; p++) {
      const a = store[p * channels + channels - 1];
      for (let c = 0; c < channels - 1; c++)
        if (store[p * channels + c] > a + eps * top)
          throw new Error(`Raster "${label}": premultiplied color data[${p * channels + c}] exceeds its alpha; convert straight-alpha data with alpha: "straight"`);
    }
  }
  const raster: Raster = {
    width, height, channels, format, colorSpace, alpha, label,
    get hash() { return rasterHash(this); },
  };
  stores.set(raster, store);
  return Object.freeze(raster);
}

/** The raster as plain data: a copy whose typed array the caller may keep and change. */
export function rasterData(raster: Raster): RasterData {
  const store = rasterStorage(raster);
  return { width: raster.width, height: raster.height, channels: raster.channels, format: raster.format, colorSpace: raster.colorSpace,
    alpha: raster.alpha, data: store.slice(), label: raster.label };
}

/** Stored values of one pixel, normalized to [0, 1] (bytes divided by 255), in stored space and alpha mode. */
export function rasterPixel(raster: Raster, x: number, y: number): number[] {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= raster.width || y >= raster.height)
    throw new Error(`Raster "${raster.label}": pixel (${x}, ${y}) is outside ${raster.width} x ${raster.height}`);
  const store = rasterStorage(raster), unit = raster.format === "u8" ? 255 : 1;
  const out: number[] = [], base = (y * raster.width + x) * raster.channels;
  for (let c = 0; c < raster.channels; c++) out.push(store[base + c] / unit);
  return out;
}

// ---------------------------------------------------------------------------------------------
// SHA-256

const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);

class Sha256 {
  #h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  #w = new Uint32Array(64);
  #buffer = new Uint8Array(64);
  #filled = 0;
  #length = 0;

  #block(bytes: Uint8Array, offset: number): void {
    const w = this.#w, h = this.#h;
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      w[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], k = h[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (k + S1 + ((e & f) ^ (~e & g)) + K256[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += k;
  }

  update(bytes: Uint8Array): void {
    this.#length += bytes.length;
    let i = 0;
    if (this.#filled > 0) {
      const take = Math.min(64 - this.#filled, bytes.length);
      this.#buffer.set(bytes.subarray(0, take), this.#filled);
      this.#filled += take; i = take;
      if (this.#filled < 64) return;
      this.#block(this.#buffer, 0); this.#filled = 0;
    }
    for (; i + 64 <= bytes.length; i += 64) this.#block(bytes, i);
    if (i < bytes.length) { this.#buffer.set(bytes.subarray(i), 0); this.#filled = bytes.length - i; }
  }

  hex(): string {
    const bits = this.#length * 8, tail = new Uint8Array(((this.#filled + 9 + 63) & ~63) - this.#filled);
    tail[0] = 0x80;
    const view = new DataView(tail.buffer);
    view.setUint32(tail.length - 8, Math.floor(bits / 0x1_0000_0000));
    view.setUint32(tail.length - 4, bits >>> 0);
    const length = this.#length;
    this.update(tail);
    this.#length = length;
    return Array.from(this.#h, v => (v >>> 0).toString(16).padStart(8, "0")).join("");
  }
}

/** Lowercase hex SHA-256 of the bytes (exported for tests and asset manifests). */
export function sha256Hex(...chunks: Uint8Array[]): string {
  const hash = new Sha256();
  for (const chunk of chunks) hash.update(chunk);
  return hash.hex();
}

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

function rasterHash(raster: Raster): string {
  const hit = hashes.get(raster);
  if (hit) return hit;
  const store = rasterStorage(raster), hash = new Sha256();
  hash.update(new TextEncoder().encode(`procedural-raster/1\n${raster.width}x${raster.height}x${raster.channels} ${raster.format} ${raster.colorSpace} ${raster.alpha}\n`));
  if (store instanceof Uint8ClampedArray) hash.update(new Uint8Array(store.buffer, store.byteOffset, store.byteLength));
  else if (LITTLE_ENDIAN) hash.update(new Uint8Array(store.buffer, store.byteOffset, store.byteLength));
  else {
    const chunk = new DataView(new ArrayBuffer(16384));
    for (let i = 0; i < store.length; i += 4096) {
      const n = Math.min(4096, store.length - i);
      for (let k = 0; k < n; k++) chunk.setFloat32(k * 4, store[i + k], true);
      hash.update(new Uint8Array(chunk.buffer, 0, n * 4));
    }
  }
  const value = hash.hex();
  hashes.set(raster, value);
  return value;
}

// ---------------------------------------------------------------------------------------------
// Color transfer

/** IEC 61966-2-1 decode: encoded [0, 1] to linear light. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
/** IEC 61966-2-1 encode: linear light [0, 1] to encoded. */
export function linearToSrgb(l: number): number {
  return l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
}
const DECODE_BYTE = new Float64Array(256).map((_, i) => srgbToLinear(i / 255));

/** Rec. 709 / sRGB luminance weights. */
export const LUMA = Object.freeze({ r: 0.2126, g: 0.7152, b: 0.0722 });

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---------------------------------------------------------------------------------------------
// Reading normalized pixels

/** Straight-alpha view of one stored pixel in the raster's own space: `out[0..cc)` color, `out[cc]` alpha (1 if none). */
function readStraight(raster: Raster, store: Storage, pixel: number, out: Float64Array): void {
  const { channels } = raster, unit = raster.format === "u8" ? 255 : 1, base = pixel * channels;
  const cc = hasAlpha(channels) ? channels - 1 : channels;
  const a = hasAlpha(channels) ? store[base + cc] / unit : 1;
  for (let c = 0; c < cc; c++) {
    const v = store[base + c] / unit;
    out[c] = raster.alpha === "premultiplied" ? (a > 0 ? Math.min(1, v / a) : 0) : v;
  }
  out[cc] = a;
}

function convertColor(v: number, from: ColorSpace, to: ColorSpace): number {
  if (from === to) return v;
  return from === "srgb" ? srgbToLinear(v) : linearToSrgb(v);
}

// ---------------------------------------------------------------------------------------------
// Conversion

export interface ConvertOptions {
  colorSpace?: ColorSpace;
  /** `straight` or `premultiplied`; only meaningful (and only allowed) for rasters with an alpha channel. */
  alpha?: "straight" | "premultiplied";
  format?: RasterFormat;
  label?: string;
}

function writeStored(store: Storage, format: RasterFormat, index: number, v: number): void {
  store[index] = format === "u8" ? Math.round(clamp01(v) * 255) : clamp01(v);
}

/** A new raster in the requested representation. Unspecified fields keep the source's. Lossy steps are stated in the module header. */
export function convertRaster(raster: Raster, options: ConvertOptions = {}): Raster {
  const colorSpace = options.colorSpace ?? raster.colorSpace, format = options.format ?? raster.format;
  if (colorSpace !== "srgb" && colorSpace !== "linear") throw new Error(`convertRaster: colorSpace must be "srgb" or "linear"`);
  if (format !== "u8" && format !== "f32") throw new Error(`convertRaster: format must be "u8" or "f32"`);
  let alpha: AlphaMode = raster.alpha;
  if (options.alpha !== undefined) {
    if (options.alpha !== "straight" && options.alpha !== "premultiplied") throw new Error(`convertRaster: alpha must be "straight" or "premultiplied"`);
    if (!hasAlpha(raster.channels)) throw new Error(`convertRaster: raster "${raster.label}" has no alpha channel, so alpha cannot be requested`);
    alpha = options.alpha;
  }
  const label = options.label ?? raster.label;
  const store = rasterStorage(raster), pixels = raster.width * raster.height, { channels } = raster;
  const cc = hasAlpha(channels) ? channels - 1 : channels;
  if (colorSpace === raster.colorSpace && alpha === raster.alpha && format === raster.format) return createRaster({ ...rasterData(raster), label });
  const out: Storage = format === "u8" ? new Uint8ClampedArray(store.length) : new Float32Array(store.length);
  const px = new Float64Array(4);
  for (let p = 0; p < pixels; p++) {
    readStraight(raster, store, p, px);
    const a = px[cc], base = p * channels;
    for (let c = 0; c < cc; c++) {
      let v = convertColor(px[c], raster.colorSpace, colorSpace);
      if (alpha === "premultiplied") v = Math.min(v * a, a);
      writeStored(out, format, base + c, v);
    }
    if (cc < channels) writeStored(out, format, base + cc, a);
  }
  return createRaster({ width: raster.width, height: raster.height, channels, format, colorSpace, alpha, data: out, label });
}

// ---------------------------------------------------------------------------------------------
// Sampling

export type SampleFilter = "nearest" | "bilinear" | "bicubic";
export type EdgeRule = "clamp" | "repeat" | "mirror" | "zero";

export interface SampleOptions {
  /** Default `bilinear`. */
  filter?: SampleFilter;
  /** Default `clamp`. */
  edge?: EdgeRule;
  /** Working and result color space. Default: the raster's own. */
  space?: ColorSpace;
  /** Result alpha mode for rasters with alpha. Default `straight`. */
  output?: "straight" | "premultiplied";
}

const MAX_COORDINATE = 1e9;

function wrapIndex(i: number, n: number, edge: EdgeRule): number {
  if (i >= 0 && i < n) return i;
  switch (edge) {
    case "clamp": return i < 0 ? 0 : n - 1;
    case "repeat": return ((i % n) + n) % n;
    case "mirror": { const m = ((i % (2 * n)) + 2 * n) % (2 * n); return m < n ? m : 2 * n - 1 - m; }
    default: return -1;
  }
}

const texelScratch = new Float64Array(4);
const accumulator = new Float64Array(4);

/** Add `weight` times the premultiplied working-space texel at (i, j) into `acc`. */
function addTexel(raster: Raster, store: Storage, i: number, j: number, edge: EdgeRule, space: ColorSpace, weight: number, acc: Float64Array): void {
  const ii = wrapIndex(i, raster.width, edge), jj = wrapIndex(j, raster.height, edge);
  if (ii < 0 || jj < 0 || weight === 0) return;
  const { channels } = raster, cc = hasAlpha(channels) ? channels - 1 : channels;
  const pixel = jj * raster.width + ii, base = pixel * channels;
  if (raster.alpha === "premultiplied" && space === raster.colorSpace) {
    const unit = raster.format === "u8" ? 255 : 1;
    for (let c = 0; c < channels; c++) acc[c] += weight * (store[base + c] / unit);
    return;
  }
  if (raster.alpha === "none" && raster.format === "u8" && raster.colorSpace === "srgb" && space === "linear") {
    for (let c = 0; c < cc; c++) acc[c] += weight * DECODE_BYTE[store[base + c]];
    return;
  }
  readStraight(raster, store, pixel, texelScratch);
  const a = texelScratch[cc];
  for (let c = 0; c < cc; c++) acc[c] += weight * convertColor(texelScratch[c], raster.colorSpace, space) * a;
  if (cc < channels) acc[cc] += weight * a;
}

function catmullRom(t: number, w: Float64Array): void {
  const t2 = t * t, t3 = t2 * t;
  w[0] = -0.5 * t3 + t2 - 0.5 * t;
  w[1] = 1.5 * t3 - 2.5 * t2 + 1;
  w[2] = -1.5 * t3 + 2 * t2 + 0.5 * t;
  w[3] = 0.5 * t3 - 0.5 * t2;
}
const wx = new Float64Array(4), wy = new Float64Array(4);

/** Write the interpolated sample at raster point (x, y) into `out` (length `raster.channels`). */
export function sampleInto(raster: Raster, x: number, y: number, out: Float64Array | number[], options: SampleOptions = {}): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > MAX_COORDINATE || Math.abs(y) > MAX_COORDINATE)
    throw new Error(`sampleRaster: point (${x}, ${y}) must be finite with coordinates within ±${MAX_COORDINATE}`);
  const filter = options.filter ?? "bilinear", edge = options.edge ?? "clamp", space = options.space ?? raster.colorSpace;
  const output = options.output ?? "straight";
  if (filter !== "nearest" && filter !== "bilinear" && filter !== "bicubic") throw new Error(`sampleRaster: filter must be "nearest", "bilinear" or "bicubic"`);
  if (edge !== "clamp" && edge !== "repeat" && edge !== "mirror" && edge !== "zero") throw new Error(`sampleRaster: edge must be "clamp", "repeat", "mirror" or "zero"`);
  if (space !== "srgb" && space !== "linear") throw new Error(`sampleRaster: space must be "srgb" or "linear"`);
  if (output !== "straight" && output !== "premultiplied") throw new Error(`sampleRaster: output must be "straight" or "premultiplied"`);
  const store = rasterStorage(raster), { channels } = raster, cc = hasAlpha(channels) ? channels - 1 : channels;
  const acc = accumulator;
  acc.fill(0);
  if (filter === "nearest") addTexel(raster, store, Math.floor(x), Math.floor(y), edge, space, 1, acc);
  else if (filter === "bilinear") {
    const u = x - 0.5, v = y - 0.5, i = Math.floor(u), j = Math.floor(v), s = u - i, t = v - j;
    addTexel(raster, store, i, j, edge, space, (1 - s) * (1 - t), acc);
    addTexel(raster, store, i + 1, j, edge, space, s * (1 - t), acc);
    addTexel(raster, store, i, j + 1, edge, space, (1 - s) * t, acc);
    addTexel(raster, store, i + 1, j + 1, edge, space, s * t, acc);
  } else {
    const u = x - 0.5, v = y - 0.5, i = Math.floor(u), j = Math.floor(v);
    catmullRom(u - i, wx); catmullRom(v - j, wy);
    for (let b = 0; b < 4; b++) for (let a = 0; a < 4; a++) addTexel(raster, store, i - 1 + a, j - 1 + b, edge, space, wx[a] * wy[b], acc);
  }
  const alpha = cc < channels ? clamp01(acc[cc]) : 1;
  for (let c = 0; c < cc; c++) {
    const premultiplied = Math.min(Math.max(acc[c], 0), alpha);
    out[c] = output === "premultiplied" || alpha === 1 ? premultiplied : alpha > 0 ? premultiplied / alpha : 0;
  }
  if (cc < channels) out[cc] = alpha;
}

/** The sample at raster point (x, y): one number per channel in [0, 1], in the working space. */
export function sampleRaster(raster: Raster, x: number, y: number, options: SampleOptions = {}): number[] {
  const out = new Array<number>(raster.channels).fill(0);
  sampleInto(raster, x, y, out, options);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Grids

/** Immutable single-channel float64 image (value fields, masks, coverage). */
export interface ScalarGrid {
  readonly kind: "scalar";
  readonly width: number;
  readonly height: number;
  at(x: number, y: number): number;
  get(index: number): number;
  toArray(): Float64Array;
}
/** Immutable single-channel int32 image (labels; -1 conventionally means "no region"). */
export interface LabelGrid {
  readonly kind: "label";
  readonly width: number;
  readonly height: number;
  at(x: number, y: number): number;
  get(index: number): number;
  toArray(): Int32Array;
}
const gridStores = new WeakMap<object, Float64Array | Int32Array>();

/** Backing array of a grid. Internal to the composition modules: NEVER mutate it. */
export function gridStorage(grid: ScalarGrid): Float64Array;
export function gridStorage(grid: LabelGrid): Int32Array;
export function gridStorage(grid: ScalarGrid | LabelGrid): Float64Array | Int32Array {
  const store = gridStores.get(grid);
  if (!store) throw new Error("Expected a grid created by this library");
  return store;
}

function makeGrid<T extends Float64Array | Int32Array>(kind: "scalar" | "label", width: number, height: number, data: T): object {
  const at = (x: number, y: number): number => {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height)
      throw new Error(`Grid pixel (${x}, ${y}) is outside ${width} x ${height}`);
    return data[y * width + x];
  };
  const get = (index: number): number => {
    if (!Number.isInteger(index) || index < 0 || index >= data.length) throw new Error(`Grid index ${index} is outside 0..${data.length - 1}`);
    return data[index];
  };
  const grid = { kind, width, height, at, get, toArray: () => data.slice() };
  gridStores.set(grid, data);
  return Object.freeze(grid);
}

/** Own a copy of `data` (row-major, width x height) as an immutable scalar grid. Values must be finite. */
export function createScalarGrid(width: number, height: number, data: ArrayLike<number>): ScalarGrid {
  checkSize("Scalar grid", width, height);
  if (data.length !== width * height) throw new Error(`Scalar grid: data has ${data.length} values but ${width} x ${height} needs ${width * height}`);
  const copy = new Float64Array(width * height);
  for (let i = 0; i < copy.length; i++) {
    const v = data[i];
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`Scalar grid: data[${i}] must be a finite number`);
    copy[i] = v;
  }
  return makeGrid("scalar", width, height, copy) as ScalarGrid;
}

/** Wrap an array the caller relinquishes (not copied, not validated for finiteness). Internal use. */
export function adoptScalarGrid(width: number, height: number, data: Float64Array): ScalarGrid {
  return makeGrid("scalar", width, height, data) as ScalarGrid;
}
/** Wrap an int32 array the caller relinquishes. Internal use. */
export function adoptLabelGrid(width: number, height: number, data: Int32Array): LabelGrid {
  return makeGrid("label", width, height, data) as LabelGrid;
}

/** Bilinear read of a grid at raster point (x, y) with the pixel-center convention and edge rule (default `clamp`; `zero` reads 0). */
export function sampleGrid(grid: ScalarGrid, x: number, y: number, edge: EdgeRule = "clamp"): number {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > MAX_COORDINATE || Math.abs(y) > MAX_COORDINATE)
    throw new Error(`sampleGrid: point (${x}, ${y}) must be finite with coordinates within ±${MAX_COORDINATE}`);
  const data = gridStorage(grid), { width, height } = grid;
  const u = x - 0.5, v = y - 0.5, i = Math.floor(u), j = Math.floor(v), s = u - i, t = v - j;
  const at = (a: number, b: number): number => {
    const aa = wrapIndex(a, width, edge), bb = wrapIndex(b, height, edge);
    return aa < 0 || bb < 0 ? 0 : data[bb * width + aa];
  };
  return (1 - t) * ((1 - s) * at(i, j) + s * at(i + 1, j)) + t * ((1 - s) * at(i, j + 1) + s * at(i + 1, j + 1));
}

// ---------------------------------------------------------------------------------------------
// Value extraction

export type ValueKind = "luminance" | "lightness" | "luma" | "hue" | "saturation" | "alpha";

export interface ValueOptions {
  /** Linear-light gray level, in [0, 1], that transparent pixels are composited over. Default 1 (white paper). */
  background?: number;
}

const CIE_EPSILON = 216 / 24389, CIE_KAPPA = 24389 / 27;

/**
 * One scalar per pixel in [0, 1], a ScalarGrid the size of the raster.
 * - `luminance`: relative luminance Y (Rec. 709 weights on LINEAR light) of the color composited over `background`.
 * - `luma`: the same weights applied to the sRGB-ENCODED composited color (the display "grayscale" pixel sorters use).
 * - `lightness`: CIE L* divided by 100, computed from that Y; perceptually even steps, so equal-width bands look equally spaced.
 * - `hue` (in [0, 1), achromatic 0) and `saturation` (HSV) of the encoded composited color.
 * - `alpha`: coverage; a raster without alpha gives 1.
 * A gray raster has R = G = B, and an opaque neutral pixel gives exactly its own value for `luma` (`lightness`
 * and `luminance` are its transfer-curve images). Compositing is `a * color + (1 - a) * background` in linear light.
 */
export function valueField(raster: Raster, kind: ValueKind, options: ValueOptions = {}): ScalarGrid {
  const background = options.background ?? 1;
  if (typeof background !== "number" || !(background >= 0 && background <= 1)) throw new Error("valueField: background must be a number in [0, 1]");
  if (!["luminance", "lightness", "luma", "hue", "saturation", "alpha"].includes(kind)) throw new Error(`valueField: unknown value kind "${String(kind)}"`);
  const store = rasterStorage(raster), { width, height, channels } = raster, pixels = width * height;
  const cc = hasAlpha(channels) ? channels - 1 : channels, gray = cc === 1;
  const out = new Float64Array(pixels), px = new Float64Array(4), lin = new Float64Array(3);
  const srgb = raster.colorSpace === "srgb";
  // exact bytes (not premultiplied) decode through the 256-entry table instead of a power function
  const table = srgb && raster.format === "u8" && raster.alpha !== "premultiplied";
  const decode = (v: number): number => (table ? DECODE_BYTE[Math.round(v * 255)] : srgbToLinear(v));
  for (let p = 0; p < pixels; p++) {
    readStraight(raster, store, p, px);
    const a = px[cc];
    if (kind === "alpha") { out[p] = a; continue; }
    const r0 = px[0], g0 = gray ? r0 : px[1], b0 = gray ? r0 : px[2];
    if (kind === "luminance" || kind === "lightness") {
      lin[0] = srgb ? decode(r0) : r0; lin[1] = gray ? lin[0] : srgb ? decode(g0) : g0; lin[2] = gray ? lin[0] : srgb ? decode(b0) : b0;
      if (a < 1) for (let c = 0; c < 3; c++) lin[c] = a * lin[c] + (1 - a) * background;
      const Y = lin[0] === lin[1] && lin[1] === lin[2] ? lin[0] : LUMA.r * lin[0] + LUMA.g * lin[1] + LUMA.b * lin[2];
      out[p] = kind === "luminance" ? clamp01(Y) : clamp01((Y > CIE_EPSILON ? 116 * Math.cbrt(Y) - 16 : CIE_KAPPA * Y) / 100);
      continue;
    }
    // encoded (sRGB) composited color
    let R = srgb ? r0 : linearToSrgb(r0), G = gray ? R : srgb ? g0 : linearToSrgb(g0), B = gray ? R : srgb ? b0 : linearToSrgb(b0);
    if (a < 1) {
      R = linearToSrgb(a * srgbToLinear(R) + (1 - a) * background);
      G = gray ? R : linearToSrgb(a * srgbToLinear(G) + (1 - a) * background);
      B = gray ? R : linearToSrgb(a * srgbToLinear(B) + (1 - a) * background);
    }
    if (kind === "luma") { out[p] = clamp01(R === G && G === B ? R : LUMA.r * R + LUMA.g * G + LUMA.b * B); continue; }
    const hi = Math.max(R, G, B), lo = Math.min(R, G, B), d = hi - lo;
    if (kind === "saturation") { out[p] = hi > 0 ? d / hi : 0; continue; }
    let h = 0;
    if (d > 0) {
      h = hi === R ? ((G - B) / d) % 6 : hi === G ? (B - R) / d + 2 : (R - G) / d + 4;
      h /= 6;
      if (h < 0) h += 1;
      if (h >= 1) h = 0;
    }
    out[p] = h;
  }
  return adoptScalarGrid(width, height, out);
}

// ---------------------------------------------------------------------------------------------
// Geometry helpers

/** Placement of raster space on a canvas rectangle (canvas units), possibly with different x and y scales. */
export interface RasterMapping {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Canvas units per pixel. */
  readonly scaleX: number;
  readonly scaleY: number;
  /** Canvas point to raster point (pixel units, pixel centres at +0.5). */
  toRaster(cx: number, cy: number): [number, number];
  /** Raster point to canvas point. */
  toCanvas(px: number, py: number): [number, number];
}

/** Map a raster (or any `{width, height}` in pixels) onto the canvas rectangle `rect`: its top-left corner to (x, y), its bottom-right to (x + width, y + height). */
export function rasterMapping(size: { width: number; height: number }, rect: { x: number; y: number; width: number; height: number }): RasterMapping {
  for (const [name, v] of [["x", rect.x], ["y", rect.y]] as const)
    if (!Number.isFinite(v)) throw new Error(`rasterMapping: rect.${name} must be finite`);
  for (const [name, v] of [["width", rect.width], ["height", rect.height]] as const)
    if (!Number.isFinite(v) || v <= 0) throw new Error(`rasterMapping: rect.${name} must be a positive finite number`);
  if (!(size.width >= 1) || !(size.height >= 1)) throw new Error("rasterMapping: size must be positive");
  const scaleX = rect.width / size.width, scaleY = rect.height / size.height;
  return Object.freeze({
    x: rect.x, y: rect.y, width: rect.width, height: rect.height, scaleX, scaleY,
    toRaster: (cx: number, cy: number): [number, number] => [(cx - rect.x) / scaleX, (cy - rect.y) / scaleY],
    toCanvas: (px: number, py: number): [number, number] => [rect.x + px * scaleX, rect.y + py * scaleY],
  });
}

/** Exact copy of an integer pixel rectangle. The rectangle must lie inside the raster. */
export function cropRaster(raster: Raster, rect: { x: number; y: number; width: number; height: number }, label?: string): Raster {
  const { x, y, width, height } = rect;
  for (const [name, v] of [["x", x], ["y", y], ["width", width], ["height", height]] as const)
    if (!Number.isInteger(v)) throw new Error(`cropRaster: rect.${name} must be an integer`);
  if (x < 0 || y < 0 || width < 1 || height < 1 || x + width > raster.width || y + height > raster.height)
    throw new Error(`cropRaster: rect (${x}, ${y}, ${width}, ${height}) must lie inside ${raster.width} x ${raster.height} with positive size`);
  const store = rasterStorage(raster), { channels } = raster;
  const out: Storage = raster.format === "u8" ? new Uint8ClampedArray(width * height * channels) : new Float32Array(width * height * channels);
  for (let j = 0; j < height; j++)
    out.set(store.subarray(((y + j) * raster.width + x) * channels, ((y + j) * raster.width + x + width) * channels), j * width * channels);
  return createRaster({ width, height, channels, format: raster.format, colorSpace: raster.colorSpace, alpha: raster.alpha, data: out, label: label ?? raster.label });
}

export type ResizeFilter = "box" | SampleFilter;

/**
 * Resample to `width` x `height` (keeping color space, alpha mode and format; work in premultiplied LINEAR light).
 * `box` is exact area averaging (the right choice for shrinking); `nearest`, `bilinear` and `bicubic` sample the
 * source at each destination pixel centre and alias when shrinking by more than a factor of about two.
 */
export function resizeRaster(raster: Raster, width: number, height: number, filter: ResizeFilter = "box", label?: string): Raster {
  checkSize("resizeRaster", width, height);
  if (filter !== "box" && filter !== "nearest" && filter !== "bilinear" && filter !== "bicubic") throw new Error(`resizeRaster: filter must be "box", "nearest", "bilinear" or "bicubic"`);
  const { channels } = raster, cc = hasAlpha(channels) ? channels - 1 : channels, store = rasterStorage(raster);
  const acc = new Float64Array(width * height * channels);
  if (filter === "box") {
    const weights = (n: number, m: number): { start: Int32Array; w: Float64Array[] } => {
      const start = new Int32Array(m), w: Float64Array[] = [], scale = n / m;
      for (let d = 0; d < m; d++) {
        const lo = d * scale, hi = (d + 1) * scale, first = Math.floor(lo), last = Math.min(n - 1, Math.ceil(hi) - 1);
        start[d] = first;
        const row = new Float64Array(last - first + 1);
        for (let s = first; s <= last; s++) row[s - first] = (Math.min(hi, s + 1) - Math.max(lo, s)) / scale;
        w.push(row);
      }
      return { start, w };
    };
    const hx = weights(raster.width, width), hy = weights(raster.height, height);
    const mid = new Float64Array(width * raster.height * channels), one = new Float64Array(4);
    for (let j = 0; j < raster.height; j++) for (let i = 0; i < width; i++) {
      const row = hx.w[i];
      for (let k = 0; k < row.length; k++) {
        one.fill(0);
        addTexel(raster, store, hx.start[i] + k, j, "clamp", "linear", 1, one);
        for (let c = 0; c < channels; c++) mid[(j * width + i) * channels + c] += row[k] * one[c];
      }
    }
    for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
      const col = hy.w[j];
      for (let k = 0; k < col.length; k++)
        for (let c = 0; c < channels; c++) acc[(j * width + i) * channels + c] += col[k] * mid[((hy.start[j] + k) * width + i) * channels + c];
    }
  } else {
    const sx = raster.width / width, sy = raster.height / height, one = new Float64Array(4);
    for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
      sampleInto(raster, (i + 0.5) * sx, (j + 0.5) * sy, one, { filter, edge: "clamp", space: "linear", output: "premultiplied" });
      for (let c = 0; c < channels; c++) acc[(j * width + i) * channels + c] = one[c];
    }
  }
  const out: Storage = raster.format === "u8" ? new Uint8ClampedArray(acc.length) : new Float32Array(acc.length);
  for (let p = 0; p < width * height; p++) {
    const base = p * channels, a = cc < channels ? clamp01(acc[base + cc]) : 1;
    for (let c = 0; c < cc; c++) {
      const premultiplied = Math.min(Math.max(acc[base + c], 0), a);
      const straight = a === 1 ? premultiplied : a > 0 ? premultiplied / a : 0;
      const encoded = convertColor(straight, "linear", raster.colorSpace);
      writeStored(out, raster.format, base + c, raster.alpha === "premultiplied" ? Math.min(encoded * a, a) : encoded);
    }
    if (cc < channels) writeStored(out, raster.format, base + cc, a);
  }
  return createRaster({ width, height, channels, format: raster.format, colorSpace: raster.colorSpace, alpha: raster.alpha, data: out, label: label ?? raster.label });
}
