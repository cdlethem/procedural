import { componentSeed } from "./core.js";
import { createRaster } from "./raster.js";
import type { Raster } from "./raster.js";

/**
 * Bundled sample rasters: deterministic, seeded, closed-form stand-ins for a host's decoded photographs,
 * so image studies work with no host-owned asset. Nothing here is a photograph or a decoded file; each
 * subject is painted from ellipses, half-planes, smoothsteps and a hashed value-noise, and the seed
 * moves and re-tints its parts.
 *
 * Every raster is square, 8-bit sRGB RGB without alpha (`channels 3`, `alpha "none"`), `size` pixels a
 * side (16 to 512, default 128: 48 KiB). Generation uses only IEEE-754 arithmetic, `Math.sqrt` (correctly
 * rounded), `Math.floor` and integer hashing, no `sin`, `cos`, `exp` or `pow`, so the bytes (and the
 * `hash`) are identical on every JavaScript engine.
 *
 * | id | subject | what it exercises |
 * |---|---|---|
 * | `portrait` | soft head-and-shoulders made of feathered ellipses on a graded backdrop | smooth tones, gentle edges, a few large connected regions |
 * | `geometry` | Mondrian-like grid with circle, triangle, stripes and checker patch, flat colors | hard edges, exact flat regions, one-pixel structure, strong orientation in the stripes |
 * | `landscape` | sky gradient with sun and clouds, three noisy ridges, textured foreground | a dominant vertical gradient, ragged horizontal boundaries, fine texture |
 * | `noise` | low-frequency color field plus mid-frequency detail, film grain and vignette | no large flat regions, weak coherence, worst case for segmentation |
 */
export const bundledRasterIds = ["portrait", "geometry", "landscape", "noise"] as const;
export type BundledRasterId = (typeof bundledRasterIds)[number];

export const bundledRasterInfo: Readonly<Record<BundledRasterId, { title: string; character: string }>> = Object.freeze({
  portrait: Object.freeze({ title: "Portrait blobs", character: "soft feathered head and shoulders" }),
  geometry: Object.freeze({ title: "Geometric scene", character: "flat colors with hard edges, stripes and a checker patch" }),
  landscape: Object.freeze({ title: "Landscape", character: "sky gradient, layered ridges, textured ground" }),
  noise: Object.freeze({ title: "Photographic noise", character: "graded color field with detail and grain" }),
});

export const BUNDLED_RASTER_SIZE = Object.freeze({ min: 16, max: 512, default: 128 });

type Color = readonly [number, number, number];

const U32 = 0x1_0000_0000;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, x: number): number => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;

function hash01(ix: number, iy: number, key: number): number {
  let h = (Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ key) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / U32;
}

function valueNoise(x: number, y: number, key: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return mix(mix(hash01(ix, iy, key), hash01(ix + 1, iy, key), sx), mix(hash01(ix, iy + 1, key), hash01(ix + 1, iy + 1, key), sx), sy);
}

function fbm(x: number, y: number, key: number, octaves: number): number {
  let sum = 0, amplitude = 0.5, total = 0, frequency = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * valueNoise(x * frequency, y * frequency, (key + Math.imul(o + 1, 0x9e3779b9)) | 0);
    total += amplitude; amplitude *= 0.5; frequency *= 2;
  }
  return sum / total;
}

/** Feathered coverage of an axis-aligned ellipse: 1 inside, 0 outside, smooth over `feather` (in units of the smaller radius' scale). */
function ellipse(u: number, v: number, cx: number, cy: number, rx: number, ry: number, feather: number): number {
  const d = (Math.sqrt(((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2) - 1) * Math.min(rx, ry);
  return 1 - smooth(-feather, feather, d);
}

const over = (base: number[], color: Color, alpha: number): void => {
  base[0] = mix(base[0], color[0], alpha); base[1] = mix(base[1], color[1], alpha); base[2] = mix(base[2], color[2], alpha);
};

type Scene = (u: number, v: number, out: number[], x: number, y: number) => void;

function portrait(seed: number): Scene {
  const palettes: Color[][] = [
    [[0.83, 0.72, 0.58], [0.55, 0.62, 0.66]], [[0.74, 0.8, 0.83], [0.34, 0.42, 0.55]],
    [[0.9, 0.78, 0.7], [0.62, 0.42, 0.42]], [[0.78, 0.83, 0.7], [0.36, 0.5, 0.4]],
  ];
  const k = (purpose: string): number => unit(seed, "portrait", purpose);
  const palette = palettes[Math.floor(k("palette") * palettes.length)];
  const cx = 0.5 + (k("x") - 0.5) * 0.12, shear = (k("tilt") - 0.5) * 0.16;
  const hair: Color = [0.14 + 0.2 * k("hair"), 0.09 + 0.12 * k("hair"), 0.07 + 0.06 * k("hair")];
  const skin: Color = [0.86 - 0.16 * k("skin"), 0.68 - 0.16 * k("skin"), 0.56 - 0.14 * k("skin")];
  return (u, v, out) => {
    const w = u - shear * (v - 0.5), back = smooth(0, 1, v);
    out[0] = mix(palette[0][0], palette[1][0], back); out[1] = mix(palette[0][1], palette[1][1], back); out[2] = mix(palette[0][2], palette[1][2], back);
    const vignette = 1 - 0.32 * smooth(0.3, 0.75, Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2));
    out[0] *= vignette; out[1] *= vignette; out[2] *= vignette;
    over(out, [0.16, 0.17, 0.22], ellipse(w, v, cx, 1.04, 0.44, 0.27, 0.035));
    over(out, [skin[0] * 0.8, skin[1] * 0.78, skin[2] * 0.78], smooth(cx - 0.1, cx - 0.085, w) * (1 - smooth(cx + 0.085, cx + 0.1, w)) * smooth(0.5, 0.56, v) * (1 - smooth(0.82, 0.9, v)));
    over(out, hair, ellipse(w, v, cx, 0.37, 0.27, 0.31, 0.03));
    const light = clamp01(0.5 + 0.33 * ((cx - w) / 0.21) - 0.3 * ((v - 0.43) / 0.27)), shade = 0.72 + 0.36 * light;
    over(out, [skin[0] * shade, skin[1] * shade, skin[2] * shade], ellipse(w, v, cx, 0.45, 0.21, 0.27, 0.014));
    over(out, hair, ellipse(w, v, cx - 0.02, 0.2, 0.2, 0.085, 0.035) * (1 - smooth(0.26, 0.36, v)));
    over(out, [0.85, 0.5, 0.47], 0.3 * (ellipse(w, v, cx - 0.115, 0.55, 0.06, 0.04, 0.06) + ellipse(w, v, cx + 0.115, 0.55, 0.06, 0.04, 0.06)));
    over(out, [skin[0] * 0.55, skin[1] * 0.5, skin[2] * 0.5], 0.4 * ellipse(w, v, cx + 0.012, 0.52, 0.02, 0.05, 0.02));
    over(out, [0.1, 0.07, 0.06], 0.9 * (ellipse(w, v, cx - 0.078, 0.435, 0.036, 0.018, 0.008) + ellipse(w, v, cx + 0.078, 0.435, 0.036, 0.018, 0.008)));
    over(out, hair, 0.7 * (ellipse(w, v, cx - 0.078, 0.395, 0.05, 0.008, 0.008) + ellipse(w, v, cx + 0.078, 0.395, 0.05, 0.008, 0.008)));
    over(out, [0.55, 0.22, 0.22], 0.85 * ellipse(w, v, cx, 0.625, 0.062, 0.013, 0.01));
  };
}

const MONDRIAN: Color[] = [[0.96, 0.94, 0.9], [0.08, 0.08, 0.09], [0.85, 0.12, 0.1], [0.1, 0.25, 0.65], [0.98, 0.8, 0.1], [0.98, 0.98, 0.98]];
const STRIPE_NORMALS: readonly (readonly [number, number])[] = [[1, 1], [1, -1], [2, 1], [1, 2], [3, 1]];
const CELL_COLORS = [0, 0, 2, 0, 5, 3, 4, 0, 0];

function geometry(seed: number): Scene {
  const k = (purpose: string): number => unit(seed, "geometry", purpose);
  const cut1 = 0.28 + 0.12 * k("cut1"), cut2 = 0.62 + 0.12 * k("cut2"), row1 = 0.3 + 0.12 * k("row1"), row2 = 0.66 + 0.1 * k("row2");
  const shuffle = Math.floor(k("shuffle") * 9), [sa, sb] = STRIPE_NORMALS[Math.floor(k("stripe") * STRIPE_NORMALS.length)];
  const discX = 0.42 + 0.1 * k("discx"), discY = 0.45 + 0.08 * k("discy"), discR = 0.17 + 0.03 * k("discr");
  const triX = 0.66 + 0.06 * k("trix"), triY = 0.6 + 0.05 * k("triy"), triLeg = 0.2 * (0.9 + 0.2 * k("trileg"));
  const line = 0.008;
  return (u, v, out) => {
    const cell = (u < cut1 ? 0 : u < cut2 ? 1 : 2) * 3 + (v < row1 ? 0 : v < row2 ? 1 : 2);
    let color = MONDRIAN[CELL_COLORS[(cell + shuffle) % 9]];
    if (Math.abs(u - cut1) < line || Math.abs(u - cut2) < line || Math.abs(v - row1) < line || Math.abs(v - row2) < line) color = MONDRIAN[1];
    if (u > cut2 + line && v > row2 + line) {
      const s = (sa * u + sb * v) * 22;
      color = s - Math.floor(s) < 0.5 ? MONDRIAN[1] : MONDRIAN[5];
    }
    if (u < cut1 - line && v > row2 + line) {
      const i = Math.floor((u / (cut1 - line)) * 6), j = Math.floor(((v - row2 - line) / (1 - row2 - line)) * 4);
      color = (i + j) % 2 === 0 ? MONDRIAN[1] : MONDRIAN[5];
    }
    const r = Math.sqrt((u - discX) ** 2 + (v - discY) ** 2);
    if (r < discR) color = r < discR * 0.55 ? MONDRIAN[5] : MONDRIAN[1];
    if (r < discR * 0.28) color = MONDRIAN[2];
    if (u >= triX && v <= triY && (u - triX) + (triY - v) <= triLeg) color = MONDRIAN[3];
    out[0] = color[0]; out[1] = color[1]; out[2] = color[2];
  };
}

function landscape(seed: number): Scene {
  const k = (purpose: string): number => unit(seed, "landscape", purpose), key = (purpose: string): number => componentSeed(seed, "landscape", purpose) | 0;
  const horizon = 0.62 + 0.06 * k("horizon"), sunX = 0.25 + 0.5 * k("sunx"), sunY = 0.2 + 0.12 * k("suny");
  const cloudKey = key("cloud"), groundKey = key("ground");
  const layers: { base: number; amp: number; freq: number; color: Color; ridgeKey: number; grainKey: number }[] = [
    { base: horizon - 0.1, amp: 0.16, freq: 3, color: [0.46, 0.55, 0.66], ridgeKey: key("ridge0"), grainKey: key("grain0") },
    { base: horizon, amp: 0.13, freq: 5, color: [0.26, 0.4, 0.42], ridgeKey: key("ridge1"), grainKey: key("grain1") },
    { base: horizon + 0.12, amp: 0.1, freq: 8, color: [0.13, 0.27, 0.2], ridgeKey: key("ridge2"), grainKey: key("grain2") },
  ];
  return (u, v, out) => {
    const t = clamp01(v / horizon), sunDistance = (u - sunX) ** 2 + (v - sunY) ** 2;
    out[0] = mix(0.16, 0.86, t * t); out[1] = mix(0.36, 0.86, t * t); out[2] = mix(0.72, 0.9, t);
    over(out, [1, 0.93, 0.75], 0.55 / (1 + sunDistance / 0.012));
    over(out, [1, 0.98, 0.9], 1 - smooth(0.055, 0.065, Math.sqrt(sunDistance)));
    over(out, [0.97, 0.97, 0.98], 0.75 * smooth(0.52, 0.7, fbm(u * 3.2, v * 7.5, cloudKey, 4)) * (1 - smooth(0.2, horizon, v)));
    layers.forEach((layer, i) => {
      const ridge = layer.base + layer.amp * (fbm(u * layer.freq, i * 5.5, layer.ridgeKey, 5) - 0.5);
      if (v <= ridge) return;
      const shade = (0.86 + 0.28 * fbm(u * 60, v * 60, layer.grainKey, 3)) * (1 - 0.18 * smooth(ridge, ridge + 0.25, v));
      over(out, [layer.color[0] * shade, layer.color[1] * shade, layer.color[2] * shade], 1);
    });
    if (v > 0.86) {
      const g = 0.7 + 0.5 * fbm(u * 120, v * 90, groundKey, 3);
      over(out, [0.2 * g, 0.36 * g, 0.14 * g], smooth(0.86, 0.9, v));
    }
  };
}

function noise(seed: number): Scene {
  const key = (purpose: string): number => componentSeed(seed, "noise", purpose) | 0;
  const base = [0, 1, 2].map(ch => key(`base${ch}`)), grain = [0, 1, 2].map(ch => key(`grain${ch}`)), detailKey = key("detail");
  return (u, v, out, x, y) => {
    const detail = fbm(u * 14, v * 14, detailKey, 4) - 0.5;
    const vignette = 1 - 0.45 * smooth(0.25, 0.8, Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2));
    for (let ch = 0; ch < 3; ch++) {
      const field = fbm(u * 2.4 + ch * 3.7, v * 2.4 - ch * 1.9, base[ch], 3);
      out[ch] = clamp01((0.15 + 0.7 * field + 0.42 * detail + (hash01(x, y, grain[ch]) - 0.5) * 0.14) * vignette);
    }
  };
}

const cache = new Map<string, Raster>();
const CACHE_SIZE = 12;

/**
 * A bundled sample raster (8-bit sRGB RGB, `size` x `size`); the seed re-arranges and re-tints it.
 * The result is immutable and cached by (id, seed, size). Its `label` is `<id>:<seed>`.
 */
export function bundledRaster(id: BundledRasterId, seed: number, size: number = BUNDLED_RASTER_SIZE.default): Raster {
  if (!(bundledRasterIds as readonly string[]).includes(id)) throw new Error(`Unknown bundled raster "${String(id)}"; choose one of ${bundledRasterIds.join(", ")}`);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Bundled raster seed must be a uint32 integer");
  if (!Number.isInteger(size) || size < BUNDLED_RASTER_SIZE.min || size > BUNDLED_RASTER_SIZE.max)
    throw new Error(`Bundled raster size must be an integer in [${BUNDLED_RASTER_SIZE.min}, ${BUNDLED_RASTER_SIZE.max}] (got ${String(size)})`);
  const cacheKey = `${id}|${seed}|${size}`, hit = cache.get(cacheKey);
  if (hit) { cache.delete(cacheKey); cache.set(cacheKey, hit); return hit; }
  const scene = { portrait, geometry, landscape, noise }[id](seed);
  const data = new Uint8ClampedArray(size * size * 3), color = [0, 0, 0];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size, v = (y + 0.5) / size;
    scene(u, v, color, x, y);
    const base = (y * size + x) * 3;
    data[base] = Math.round(clamp01(color[0]) * 255); data[base + 1] = Math.round(clamp01(color[1]) * 255); data[base + 2] = Math.round(clamp01(color[2]) * 255);
  }
  const raster = createRaster({ width: size, height: size, channels: 3, format: "u8", colorSpace: "srgb", alpha: "none", data, label: `${id}:${seed}` });
  cache.set(cacheKey, raster);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return raster;
}
