import { gradientNoise2D01 } from "@procedurals/javascript";
import { componentSeed } from "./core.js";
import { gridSpacing, outletMask, type OutletMode } from "./drainage-flow.js";

/**
 * Initial terrain, rainfall and bedrock fields on a height grid (see `drainage-flow.ts` for the grid and its
 * units: the longer side of the grid is 1, cells are square, elevations are in the same unit).
 *
 * All three are pure functions of `(spec, seed)`. Each is defined in continuous domain coordinates and
 * sampled at cell centres, so a finer grid resolves the same landscape in more detail (the noise
 * normalisation to [0, 1] uses the sampled extremes, which differ slightly between resolutions). Seeds are
 * derived with `componentSeed(seed, purpose, ...)`, never from draw order.
 *
 * TERRAIN. `t(u, v)` in [0, 1] (u, v the cell centre as a fraction of the width and height) is
 *   - `noise`      fractal noise only;
 *   - `dome`       `1 - d²` with d the elliptic distance from the centre (0 beyond d = 1);
 *   - `ridge`      a central north-south crest `1 - |2u - 1|^1.3`, lower toward the bottom (× `0.75 + 0.25 (1 - v)`);
 *   - `plane`      `1 - v`, a plane falling toward the bottom;
 *   - `escarpment` a high plateau over a low plain, `1 - 0.8 smoothstep(0.30, 0.60, v)`;
 * mixed with the same fractal noise `n` as `(1 - roughness) t + roughness n` (shape `noise` is `n`). The
 * fractal noise sums `octaves` octaves of gradient noise (frequency `frequency` cycles across the longer side,
 * doubling, gain 1/2), normalised so its sampled minimum is 0 and maximum 1. Elevation is `relief × t × ramp`,
 * `relief` in domain units (fraction of the longer side). RAMP (`coastalRamp`): the terrain falls smoothly to base level (0)
 * over `COAST` (0.3) toward every outlet side, so the outlets sit at the foot of the land and not at the top
 * of a cliff: `smoothstep(0, COAST, distance to the nearest outlet side)`; for a single outlet the distance to
 * that cell over `SINGLE_COAST` (0.3). Outlet cells are exactly 0. The uplift of the erosion model uses the same ramp.
 *
 * RAIN. A dimensionless multiplier of the rain that falls on each cell, always with mean exactly 1 over the
 * grid, so accumulated flow is "cells of average rain". `uniform`: 1. `gradient`: `1 + variation (2p - 1)`
 * with `p` the position along `angle` degrees (0 rain increases toward +x, 90 toward the bottom) across the
 * footprint, clamped at 0.02. `storms`: `count` seeded Gaussian storm cells (`storm:k`, so adding one
 * never moves another), rain `(1 - variation) + variation × storms / mean(storms)`.
 *
 * BEDROCK. A hardness `h` in [0, 1] (1 hardest); the erodibility of a cell is `K (1 - contrast h)`. `uniform`:
 * 0. `layers`: warped parallel bands, `smoothstep(0.35, 0.65, 0.5 + 0.5 sin(2π (p scale + warp)))` with `p`
 * the position along `angle`; `blobs`: `smoothstep(0.5, 0.62, noise)` of frequency `scale`, hard cores in
 * soft rock.
 */
export const COAST = 0.3;
export const SINGLE_COAST = 0.3;
export type TerrainShape = "noise" | "dome" | "ridge" | "plane" | "escarpment";
export const terrainShapes: readonly TerrainShape[] = Object.freeze(["noise", "dome", "ridge", "plane", "escarpment"]);
export type RainMode = "uniform" | "gradient" | "storms";
export const rainModes: readonly RainMode[] = Object.freeze(["uniform", "gradient", "storms"]);
export type BedrockKind = "uniform" | "layers" | "blobs";
export const bedrockKinds: readonly BedrockKind[] = Object.freeze(["uniform", "layers", "blobs"]);

export interface TerrainSpec {
  columns: number; rows: number;
  shape: TerrainShape; relief: number; roughness: number; frequency: number; octaves: number;
  outlets: OutletMode;
}
export interface RainSpec {
  columns: number; rows: number;
  mode: RainMode; variation: number; angle: number; storms: number;
}
export interface BedrockSpec {
  columns: number; rows: number;
  kind: BedrockKind; scale: number; angle: number;
}

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};
const U32 = 0x1_0000_0000;
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;

function requireSeed(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Terrain seed must be a uint32 integer");
}
function requireRange(label: string, value: number, min: number, max: number, integer = false): void {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    throw new Error(`${label} must be ${integer ? "an integer" : "a number"} from ${min} to ${max} (got ${String(value)})`);
}

/** Fractal noise over the grid, normalised to [0, 1] by its sampled extremes (0.5 everywhere if it is constant). */
function noiseGrid(columns: number, rows: number, seed: number, purpose: string, frequency: number, octaves: number): Float64Array {
  const noise = gradientNoise2D01({ seed: componentSeed(seed, "terrain", purpose) }), h = gridSpacing(columns, rows);
  const out = new Float64Array(columns * rows);
  let min = Infinity, max = -Infinity;
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const x = (i + 0.5) * h, y = (j + 0.5) * h;
    let sum = 0, amplitude = 1, total = 0, scale = frequency;
    for (let o = 0; o < octaves; o++) {
      sum += amplitude * noise.sample(x * scale + 17.3 * o, y * scale - 9.1 * o);
      total += amplitude; amplitude *= 0.5; scale *= 2;
    }
    const v = sum / total;
    out[j * columns + i] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  for (let k = 0; k < out.length; k++) out[k] = max > min ? (out[k] - min) / (max - min) : 0.5;
  return out;
}

function shapeValue(shape: TerrainShape, u: number, v: number): number {
  switch (shape) {
    case "dome": { const dx = 2 * u - 1, dy = 2 * v - 1; return Math.max(0, 1 - (dx * dx + dy * dy)); }
    case "ridge": return (1 - Math.abs(2 * u - 1) ** 1.3) * (0.75 + 0.25 * (1 - v));
    case "plane": return 1 - v;
    case "escarpment": return 1 - 0.8 * smoothstep(0.30, 0.60, v);
    default: return 0.5;
  }
}

/**
 * The coastal ramp of a grid: 0 on the outlets, rising smoothly to 1 over `COAST` (`SINGLE_COAST` around a single
 * outlet) inland of every outlet side. The initial terrain and the uplift are both multiplied by it, so the land
 * meets the outlets as a ramp, not a cliff, and stays that way as it is uplifted.
 */
export function coastalRamp(columns: number, rows: number, outlets: OutletMode): Float64Array {
  const h = gridSpacing(columns, rows), ramp = new Float64Array(columns * rows);
  const open = { left: outlets === "edges" || outlets === "sides", right: outlets === "edges" || outlets === "sides", top: outlets === "edges", bottom: outlets === "edges" || outlets === "bottom" };
  const ox = ((columns >> 1) + 0.5) * h, oy = (rows - 0.5) * h;
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const x = (i + 0.5) * h, y = (j + 0.5) * h;
    if (outlets === "single") { ramp[j * columns + i] = smoothstep(0, SINGLE_COAST, Math.hypot(x - ox, y - oy)); continue; }
    let distance = Infinity;
    if (open.left) distance = Math.min(distance, x);
    if (open.right) distance = Math.min(distance, columns * h - x);
    if (open.top) distance = Math.min(distance, y);
    if (open.bottom) distance = Math.min(distance, rows * h - y);
    ramp[j * columns + i] = smoothstep(0, COAST, distance);
  }
  return ramp;
}

/** The initial elevation (see the header). Outlet cells are 0. */
export function initialTerrain(spec: TerrainSpec, seed: number): Float64Array {
  requireSeed(seed);
  const { columns, rows } = spec;
  if (!terrainShapes.includes(spec.shape)) throw new Error(`Unknown terrain shape: ${String(spec.shape)}`);
  requireRange("relief", spec.relief, 0, 10); requireRange("roughness", spec.roughness, 0, 1);
  requireRange("frequency", spec.frequency, 0.05, 64); requireRange("octaves", spec.octaves, 1, 8, true);
  const outlets = outletMask(columns, rows, spec.outlets), ramp = coastalRamp(columns, rows, spec.outlets);
  const fractal = noiseGrid(columns, rows, seed, "fbm", spec.frequency, spec.octaves);
  const z = new Float64Array(columns * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const c = j * columns + i, u = (i + 0.5) / columns, v = (j + 0.5) / rows;
    const t = spec.shape === "noise" ? fractal[c] : (1 - spec.roughness) * shapeValue(spec.shape, u, v) + spec.roughness * fractal[c];
    z[c] = outlets[c] ? 0 : spec.relief * t * ramp[c];
  }
  return z;
}

/** The rain multiplier of every cell, mean 1 (see the header). */
export function rainField(spec: RainSpec, seed: number): Float64Array {
  requireSeed(seed);
  const { columns, rows } = spec, n = columns * rows;
  if (!rainModes.includes(spec.mode)) throw new Error(`Unknown rain mode: ${String(spec.mode)}`);
  requireRange("rain variation", spec.variation, 0, 1); requireRange("rain angle", spec.angle, -3600, 3600);
  requireRange("storms", spec.storms, 1, 12, true);
  const rain = new Float64Array(n).fill(1);
  if (spec.mode === "uniform" || spec.variation === 0) return rain;
  if (spec.mode === "gradient") {
    const a = spec.angle * Math.PI / 180, cx = Math.cos(a), cy = Math.sin(a);
    // Position along the direction over the unit square, scaled so the corners reach 0 and 1.
    const half = (Math.abs(cx) + Math.abs(cy)) / 2;
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const p = 0.5 + ((((i + 0.5) / columns) - 0.5) * cx + (((j + 0.5) / rows) - 0.5) * cy) / (2 * half);
      rain[j * columns + i] = Math.max(0.02, 1 + spec.variation * (2 * p - 1));
    }
  } else {
    const storms = Array.from({ length: spec.storms }, (_, k) => {
      const id = `storm:${k}`;
      return { x: unit(seed, id, "x"), y: unit(seed, id, "y"), sigma: (0.10 + 0.15 * unit(seed, id, "radius")) / 2, weight: 0.5 + unit(seed, id, "weight") };
    });
    let sum = 0;
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const u = (i + 0.5) / columns, v = (j + 0.5) / rows;
      let g = 0;
      for (const s of storms) g += s.weight * Math.exp(-(((u - s.x) * columns / Math.max(columns, rows)) ** 2 + ((v - s.y) * rows / Math.max(columns, rows)) ** 2) / (2 * s.sigma * s.sigma));
      rain[j * columns + i] = g; sum += g;
    }
    const mean = sum / n;
    if (!(mean > 0)) return new Float64Array(n).fill(1);
    for (let c = 0; c < n; c++) rain[c] = (1 - spec.variation) + spec.variation * rain[c] / mean;
  }
  // Normalise to mean exactly 1 (the gradient clamp and float summation can leave a residue).
  let total = 0;
  for (let c = 0; c < n; c++) total += rain[c];
  const scale = n / total;
  for (let c = 0; c < n; c++) rain[c] *= scale;
  return rain;
}

/** Hardness of every cell in [0, 1] (see the header). */
export function bedrockField(spec: BedrockSpec, seed: number): Float64Array {
  requireSeed(seed);
  const { columns, rows } = spec, n = columns * rows;
  if (!bedrockKinds.includes(spec.kind)) throw new Error(`Unknown bedrock kind: ${String(spec.kind)}`);
  requireRange("bedrock scale", spec.scale, 0.25, 64); requireRange("bedrock angle", spec.angle, -3600, 3600);
  const hard = new Float64Array(n);
  if (spec.kind === "uniform") return hard;
  if (spec.kind === "blobs") {
    const noise = noiseGrid(columns, rows, seed, "bedrock-blobs", spec.scale, 2);
    for (let c = 0; c < n; c++) hard[c] = smoothstep(0.5, 0.62, noise[c]);
    return hard;
  }
  const warp = noiseGrid(columns, rows, seed, "bedrock-warp", 1.5, 2), a = spec.angle * Math.PI / 180, cx = Math.cos(a), cy = Math.sin(a);
  const phase = unit(seed, "bedrock", "phase");
  const h = gridSpacing(columns, rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const c = j * columns + i, p = (i + 0.5) * h * cx + (j + 0.5) * h * cy;
    hard[c] = smoothstep(0.35, 0.65, 0.5 + 0.5 * Math.sin(2 * Math.PI * (p * spec.scale + phase + 0.35 * (warp[c] - 0.5))));
  }
  return hard;
}
