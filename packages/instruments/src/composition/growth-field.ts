/**
 * Growth fields: where a surface is allowed to expand.
 *
 * A `GrowthField` is a pure function of MATERIAL coordinates (the seed's positions; `surface-growth.ts`),
 * with values in [0, 1]: the share of the growth rate a point receives. Being a function of material, not
 * of the deformed, refined surface, it is unaffected by remeshing: a vertex born by an edge split
 * evaluates the same field at the midpoint of its parents' material positions (exact transfer, not an
 * interpolation of the parents' values), so refinement sharpens a field's detail and never blurs or moves
 * it.
 *
 * Fields are built from regions, each a value in [0, 1] scaled by its `weight`, combined by `max`, `sum`
 * (clamped to 1) or `multiply`, then lifted by a uniform `baseline`:
 * `value = baseline + (1 - baseline) * combine(regions)`.
 *
 * | region    | value (material units; `u, v, w` = x, z, y)                                                      |
 * |-----------|--------------------------------------------------------------------------------------------------|
 * | `uniform` | 1 everywhere                                                                                     |
 * | `edge`    | smoothstep of `1 - d / width`, d the Euclidean distance to the seed's boundary (open seeds only)  |
 * | `radial`  | `exp(-((rho - radius) / width)^2 / 2)`, rho the distance to the point `(centerX, h, centerY)`     |
 * |           | where `h` is 0 on a flat seed and the sphere's height `sqrt(1 - cx^2 - cy^2)` on a closed one    |
 * | `stripes` | `smoothstep` of a cosine of `count` periods across 2 units along `angle`, sharpened by `sharpness`|
 * | `noise`   | two octaves of the portable 3-D gradient noise at `scale`, stretched by `contrast` about 1/2      |
 *
 * `gridGrowthField` adds a sampled field (bilinear on material `(x, z)`), the route for a field computed
 * elsewhere, such as a reaction pattern. Its values must be finite and are clamped to [0, 1].
 *
 * Every field has a content `key` (a hash of its construction, the seed it was built for and its noise
 * seed); the snapshot cache keys on it, so two equal fields share one simulation and an edit to any region
 * recomputes. A field never reads the drawing: palette and camera cannot reach it.
 */
import { gradientNoise3D01 } from "@procedurals/javascript";
import { componentSeed } from "./core.js";
import { sha256Hex } from "./raster.js";
import type { GrowthSeed } from "./growth-seeds.js";

export type GrowthCombine = "max" | "sum" | "multiply";
export type GrowthRegion =
  | { readonly kind: "uniform"; readonly weight?: number }
  | { readonly kind: "edge"; readonly width: number; readonly weight?: number }
  | { readonly kind: "radial"; readonly centerX: number; readonly centerY: number; readonly radius: number; readonly width: number; readonly weight?: number }
  | { readonly kind: "stripes"; readonly count: number; readonly angle: number; readonly sharpness: number; readonly weight?: number }
  | { readonly kind: "noise"; readonly scale: number; readonly contrast: number; readonly weight?: number };

export interface GrowthFieldSpec {
  readonly regions: readonly GrowthRegion[];
  readonly combine: GrowthCombine;
  /** Growth every point receives regardless of the regions, 0..1. */
  readonly baseline: number;
}

export interface GrowthField {
  /** Content identity of the construction (spec, seed surface, noise seed). */
  readonly key: string;
  /** Value in [0, 1] at a material point. */
  sample(x: number, y: number, z: number): number;
}

export const GROWTH_FIELD_LIMITS = Object.freeze({ maxRegions: 8, maxGridValues: 65_536, maxStripes: 40 });

const smooth = (t: number): number => { const s = Math.min(1, Math.max(0, t)); return s * s * (3 - 2 * s); };
const finiteIn = (name: string, value: unknown, low: number, high: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high) throw new Error(`${name} must be a number in ${low}..${high} (got ${String(value)})`);
  return value as number;
};
const encoder = new TextEncoder();
const hashKey = (...parts: unknown[]): string => sha256Hex(encoder.encode(JSON.stringify(parts)));

/** Euclidean distance from a material point to the nearest boundary segment (`x0 y0 z0 x1 y1 z1` each). */
export function boundaryDistance(boundary: Float64Array, x: number, y: number, z: number): number {
  let best = Infinity;
  for (let s = 0; s < boundary.length; s += 6) {
    const ax = boundary[s], ay = boundary[s + 1], az = boundary[s + 2];
    const dx = boundary[s + 3] - ax, dy = boundary[s + 4] - ay, dz = boundary[s + 5] - az;
    const length2 = dx * dx + dy * dy + dz * dz;
    const t = length2 > 0 ? Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / length2)) : 0;
    const d = Math.hypot(x - ax - t * dx, y - ay - t * dy, z - az - t * dz);
    if (d < best) best = d;
  }
  return best;
}

function checkRegion(region: GrowthRegion, index: number, closed: boolean): void {
  const at = `Growth region ${index + 1}`;
  finiteIn(`${at} weight`, region.weight ?? 1, 0, 1);
  switch (region.kind) {
    case "uniform": break;
    case "edge":
      finiteIn(`${at} width`, region.width, 0.01, 10);
      if (closed) throw new Error(`${at} is an edge region but the seed surface is closed and has no edge; choose another region kind or an open seed`);
      break;
    case "radial":
      finiteIn(`${at} centerX`, region.centerX, -2, 2); finiteIn(`${at} centerY`, region.centerY, -2, 2);
      finiteIn(`${at} radius`, region.radius, 0, 10); finiteIn(`${at} width`, region.width, 0.01, 10);
      break;
    case "stripes":
      finiteIn(`${at} count`, region.count, 0.5, GROWTH_FIELD_LIMITS.maxStripes); finiteIn(`${at} angle`, region.angle, -3600, 3600); finiteIn(`${at} sharpness`, region.sharpness, 0, 1);
      break;
    case "noise":
      finiteIn(`${at} scale`, region.scale, 0.05, 40); finiteIn(`${at} contrast`, region.contrast, 0.1, 20);
      break;
    default: throw new Error(`${at} has unknown kind ${String((region as { kind: unknown }).kind)}`);
  }
}

/** Build the field of `spec` for a seed surface. `seed` is a uint32 (the noise regions draw from it). */
export function growthField(spec: GrowthFieldSpec, seed: GrowthSeed, noiseSeed: number): GrowthField {
  if (!Array.isArray(spec.regions) || spec.regions.length > GROWTH_FIELD_LIMITS.maxRegions)
    throw new Error(`Growth field needs an array of at most ${GROWTH_FIELD_LIMITS.maxRegions} regions`);
  if (spec.combine !== "max" && spec.combine !== "sum" && spec.combine !== "multiply") throw new Error(`Growth combine must be max, sum or multiply (got ${String(spec.combine)})`);
  const baseline = finiteIn("Growth baseline", spec.baseline, 0, 1);
  if (!Number.isSafeInteger(noiseSeed) || noiseSeed < 0 || noiseSeed > 0xffffffff) throw new Error("Growth field seed must be a uint32 integer");
  spec.regions.forEach((region, index) => checkRegion(region, index, seed.closed));
  const noises = spec.regions.map((region, index) => region.kind === "noise"
    ? [gradientNoise3D01({ seed: componentSeed(noiseSeed, `region:${index}`, "growth-noise") }), gradientNoise3D01({ seed: componentSeed(noiseSeed, `region:${index}`, "growth-noise-fine") })] as const
    : null);
  const usesNoise = spec.regions.some((region) => region.kind === "noise");
  const { boundary, closed } = seed;
  const value = (region: GrowthRegion, index: number, x: number, y: number, z: number): number => {
    switch (region.kind) {
      case "uniform": return 1;
      case "edge": return smooth(1 - boundaryDistance(boundary, x, y, z) / region.width);
      case "radial": {
        const h = closed ? Math.sqrt(Math.max(0, 1 - region.centerX ** 2 - region.centerY ** 2)) : 0;
        const rho = Math.hypot(x - region.centerX, y - h, z - region.centerY);
        return Math.exp(-0.5 * ((rho - region.radius) / region.width) ** 2);
      }
      case "stripes": {
        const a = region.angle * Math.PI / 180, s = x * Math.cos(a) + z * Math.sin(a);
        const wave = 0.5 + 0.5 * Math.cos(Math.PI * region.count * s);
        return stripeValue(wave, region.sharpness);
      }
      case "noise": {
        const [coarse, fine] = noises[index]!;
        const n = 0.65 * coarse.sample(x * region.scale + 11.3, y * region.scale - 4.7, z * region.scale + 7.1)
          + 0.35 * fine.sample(x * region.scale * 2.3 - 2.9, y * region.scale * 2.3 + 6.4, z * region.scale * 2.3 - 8.8);
        return Math.min(1, Math.max(0, (n - 0.5) * region.contrast + 0.5));
      }
    }
  };
  const key = hashKey("growth-field", spec, seed.key, usesNoise ? noiseSeed : null);
  return Object.freeze({
    key,
    sample(x: number, y: number, z: number): number {
      let combined = spec.combine === "multiply" ? 1 : 0;
      spec.regions.forEach((region, index) => {
        const weight = region.weight ?? 1, layer = weight * value(region, index, x, y, z);
        if (spec.combine === "max") combined = Math.max(combined, layer);
        else if (spec.combine === "sum") combined = Math.min(1, combined + layer);
        else combined *= 1 - weight + layer;
      });
      if (spec.regions.length === 0) combined = 0;
      return Math.min(1, Math.max(0, baseline + (1 - baseline) * combined));
    },
  });
}

/** Stripe profile: the cosine `wave` in [0, 1], sharpened toward 0/1 by `sharpness` (0 leaves the cosine). */
export function stripeValue(wave: number, sharpness: number): number {
  if (sharpness <= 0) return wave;
  const half = 0.5 * Math.min(0.98, sharpness);
  return smooth((wave - (0.5 - half)) / (2 * half));
}

export interface GridFieldInput {
  readonly id: string;
  /** `[x0, z0, x1, z1]` of the grid's sample centres in material units (x0 < x1, z0 < z1). */
  readonly bounds: readonly [number, number, number, number];
  readonly columns: number;
  readonly rows: number;
  /** `columns * rows` finite numbers, row-major from `(x0, z0)`. */
  readonly values: ArrayLike<number>;
}

/** A sampled field: bilinear in material `(x, z)`, clamped to the grid's extent, values clamped to [0, 1]. */
export function gridGrowthField(input: GridFieldInput): GrowthField {
  const { columns, rows, bounds } = input;
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 2 || rows < 2 || columns * rows > GROWTH_FIELD_LIMITS.maxGridValues)
    throw new Error(`Grid field "${input.id}" needs integer columns and rows of at least 2 and at most ${GROWTH_FIELD_LIMITS.maxGridValues} values in all`);
  if (input.values.length !== columns * rows) throw new Error(`Grid field "${input.id}" has ${input.values.length} values; columns x rows is ${columns * rows}`);
  if (!(bounds[0] < bounds[2]) || !(bounds[1] < bounds[3]) || bounds.some((b) => !Number.isFinite(b))) throw new Error(`Grid field "${input.id}" bounds must be finite with x0 < x1 and z0 < z1`);
  const values = new Float64Array(columns * rows);
  for (let i = 0; i < values.length; i++) {
    const v = input.values[i];
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`Grid field "${input.id}" value ${i} is ${String(v)}; every value must be a finite number`);
    values[i] = Math.min(1, Math.max(0, v));
  }
  const key = hashKey("growth-grid", columns, rows, bounds, sha256Hex(new Uint8Array(values.buffer)));
  return Object.freeze({
    key,
    sample(x: number, _y: number, z: number): number {
      const gx = Math.min(columns - 1, Math.max(0, (x - bounds[0]) / (bounds[2] - bounds[0]) * (columns - 1)));
      const gz = Math.min(rows - 1, Math.max(0, (z - bounds[1]) / (bounds[3] - bounds[1]) * (rows - 1)));
      const i = Math.min(columns - 2, Math.floor(gx)), j = Math.min(rows - 2, Math.floor(gz)), fx = gx - i, fz = gz - j;
      const at = (a: number, b: number): number => values[b * columns + a];
      return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fz) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fz;
    },
  });
}
