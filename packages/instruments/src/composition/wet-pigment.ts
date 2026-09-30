import { componentSeed } from "./core.js";
import { locateInDomain, planarDomain, planarRegion, ringsDomain, textDomain, type PlanarDomain } from "./domains.js";
import { createSimulationCache, elementId, type SimulationContext, type Simulation, type Snapshots } from "./snapshots.js";
import { SeededStream } from "./snapshot-values.js";
import { memoized } from "./sources.js";

/**
 * Wet pigment: a bounded water-and-pigment model on a grid inside an artist-defined wet mask, run
 * through the stateful-snapshot foundation. NOT physical paint: a 2D cellular model whose every rule
 * is stated below, chosen so blooms, backruns, pooling and drying fronts appear.
 *
 * GRID. `grid` cells across the 640-unit canvas (`cell = 640 / grid`), row 0 at the top, cell `(i, j)` the
 * square `[i, i+1] × [j, j+1]` times `cell`, centre at `(i+½, j+½)·cell`. A cell is WET-MASK iff its centre is
 * inside or on the mask polygon (`locateInDomain`); parts of a mask off the canvas are cut. Every field is
 * an areal density per cell (depth for water, mass for pigment), so a total is a sum over cells.
 *
 * STATE (typed arrays, one value per cell): `water` W, suspended `pigment` P, `deposit` D, `dried` (the step
 * at which the cell last ran dry, or -1 while it is wet or was never wet). Also the accounting, the drop
 * sites (birth-counter ids `site:n`), and `settled`.
 *
 * DRY CELLS. A cell is wet iff W > 0. Water never sits below `WET_LIMITS.dryWater`: a film that thins below it
 * is dry, its remaining water counts as evaporated and its suspended pigment is deposited on the spot
 * (`dried` records the step). A dry cell has P = 0, emits nothing, diffuses nothing and lifts nothing; it
 * only ever changes by RECEIVING water from a wet neighbour (a spreading front), never by itself.
 *
 * ONE STEP k (fixed order, synchronous where stated):
 *  1. DROPS. Every site with `step === k` (step 0 is the initial state) adds water `depth·(1 − r²/R²)²`
 *     inside radius R (skipped where below the dry limit) to wet-mask cells, cells ascending; a pigment
 *     site adds pigment `water / ratio` with it, a backrun site clear water only.
 *  2. TRANSPORT, synchronous: every edge between two wet-mask cells (right and down neighbour of each cell,
 *     ascending) with mobility m = min(1.25, 1 / mean paper porosity):
 *        water flux i→j   q = m·D₀·(Wᵢ − Wⱼ) + tilt term (upwind: t·Wᵢ if the tilt pushes i→j, else t·Wⱼ),
 *        D₀ = 0.1·transport, t = tilt·(g·e), g the tilt direction, e the unit vector i→j.
 *     The source of a positive flux carries pigment with it: (P/W)·q (advection). Two wet cells also diffuse
 *     pigment by its gradient: m·κ·(Pᵢ − Pⱼ), κ = 0.07·pigmentSpread. Deltas are summed, then applied.
 *     With `boundary: "open"`, every link from a wet-mask cell to a cell outside the mask (or the grid) is a
 *     sink: water leaves by the same law with the outside at depth 0 and takes its pigment (edge loss);
 *     with "sealed" the mask is a wall.  The coefficients are limited so a cell never sends out more than
 *     it holds (see `WET_LIMITS`): 4·1.25·0.1 + √2·0.1 + 4·1.25·0.07 = 0.99 < 1.
 *  3. PAPER AND AIR, per wet cell ascending: absorption `min(W, absorbency·porosity)` leaves the surface
 *     film (pigment stays behind, so it concentrates); evaporation `min(W, evaporation·(1 + edgeDrying·w))`
 *     with `w = exp(−distance to the mask edge / edgeReach)` (edges dry first).
 *  4. DRYING. A wet cell whose water fell below the dry limit dries (above).
 *  5. SETTLING AND LIFTING, wet cells: with film `s = 1 − min(1, W / 0.1)`, the share of suspended pigment
 *     that settles is `f = depositRate + (1 − depositRate)·s` (a thin film cannot hold pigment) and the
 *     share of deposit that lifts back into suspension is `redissolve·min(1, W / 0.1)`; both from the
 *     values at the start of this stage. Lifting is what lets a late drop of water push old pigment outward.
 *  6. BOOKKEEPING. `settled` is the first step with no water anywhere and no drop still to come; from then the
 *     state is a fixed point and further steps return it unchanged (cost 1).
 *
 * ACCOUNTING (tested to floating-point rounding). Pigment: injected = suspended + deposited + lost. Water:
 * injected = surface + evaporated + absorbed + lost. `lost` is 0 with a sealed boundary.
 *
 * SEEDS. Mask outline, paper porosity and site placement come from `componentSeed(seed, id, purpose)` streams,
 * never from draw order: site k's position depends only on the seed, k and the earlier sites' positions.
 * Appearance (palette, bands, opacity, which fronts are drawn) is not read here and never enters the key.
 */

export const WET_LIMITS = Object.freeze({
  gridMin: 24, gridMax: 256, maxSteps: 2000, maxSites: 24, maxBackruns: 24, maxVertices: 4000,
  /** Water below this depth is dry. */
  dryWater: 0.005,
  /** Film depth below which pigment settles quickly and above which deposit can lift. */
  filmWater: 0.1,
  /** Transport passes per step (each with the same coefficients, so a step spreads three times as far). */
  substeps: 3,
  /** D₀ = waterSpread·transport, per pass. */
  waterSpread: 0.1,
  /** κ = pigmentSpread·pigmentSpreadScale. */
  pigmentSpreadScale: 0.07,
  /** Largest tilt per step (share of a cell's water pushed along the tilt). */
  maxTilt: 0.1,
  /** Largest mobility factor. */
  maxMobility: 1.25,
  /** Work bound (`wetWork`): steps × grid² × passes, an upper bound on cell updates, above this is refused. */
  maxWork: 100_000_000,
  checkpointEvery: 50,
  maxCheckpointValues: 8_000_000,
  candidates: 24,
});

/** The declared work bound of a run: initial state plus `steps` steps, each at most the whole grid times the passes. */
export function wetWork(grid: number, steps: number): number {
  return 4 * grid * grid + steps * ((WET_LIMITS.substeps + 1) * grid * grid + 1);
}

export type WetMaskSpec =
  | { readonly kind: "blob"; readonly roughness: number }
  | { readonly kind: "letters"; readonly word: string }
  | { readonly kind: "ring"; readonly roughness: number; readonly inner: number }
  /** A resolved region in canvas units (a host asset or a caller's own polygon); `frame` does not move it. */
  | { readonly kind: "domain"; readonly regions: readonly { readonly outer: readonly (readonly [number, number])[]; readonly holes?: readonly (readonly (readonly [number, number])[])[] }[] };

export type WetBoundary = "sealed" | "open";
export type WetLayout = "scattered" | "rim" | "core";

/** Everything that decides what the model computes (never appearance, never the step count). */
export interface WetModel {
  readonly grid: number;
  readonly mask: WetMaskSpec;
  readonly frame: { readonly centerX: number; readonly centerY: number; readonly width: number; readonly height: number; readonly rotation: number };
  readonly paper: { readonly variation: number; readonly grain: number; readonly absorbency: number };
  readonly water: { readonly prewet: number; readonly evaporation: number; readonly edgeDrying: number; readonly edgeReach: number };
  readonly transport: { readonly strength: number; readonly pigmentSpread: number; readonly tilt: number; readonly tiltAngle: number; readonly boundary: WetBoundary };
  readonly pigment: { readonly sites: number; readonly layout: WetLayout; readonly radius: number; readonly depth: number; readonly ratio: number; readonly depositRate: number; readonly redissolve: number };
  readonly backruns: { readonly count: number; readonly step: number; readonly gap: number; readonly depth: number; readonly radius: number };
}

export interface WetSite {
  readonly id: string;
  readonly kind: "pigment" | "water";
  readonly x: number; readonly y: number;
  /** Step at which the drop lands. */
  readonly step: number;
  readonly radius: number; readonly depth: number;
  /** The pigment site a backrun sits beside; null for pigment sites and for backruns with no pigment site. */
  readonly parent: string | null;
}

export interface WetAccounting {
  injectedWater: number; injectedPigment: number;
  evaporated: number; absorbed: number; lostWater: number; lostPigment: number;
}

export interface WetState {
  water: Float64Array; pigment: Float64Array; deposit: Float64Array; dried: Int32Array;
  accounting: WetAccounting;
  sites: WetSite[];
  nextSite: number;
  settled: number;
}

/** What history retains: the fields and totals at a step (plain data; the arrays are private copies, read only). */
export interface WetFrame {
  readonly step: number;
  readonly grid: number;
  readonly water: Float64Array; readonly pigment: Float64Array; readonly deposit: Float64Array; readonly dried: Int32Array;
  readonly wetCells: number;
  readonly settled: number;
  readonly totals: {
    readonly water: number; readonly suspended: number; readonly deposited: number;
    readonly injectedWater: number; readonly injectedPigment: number;
    readonly evaporated: number; readonly absorbed: number; readonly lostWater: number; readonly lostPigment: number;
  };
}

/* ------------------------------------------------------------------------------------ validation */

function bounded(name: string, value: unknown, min: number, max: number, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    throw new Error(`${name} must be ${integer ? "an integer" : "a number"} from ${min} to ${max} (got ${String(value)})`);
  return value;
}

/** Throws naming the control or option that is out of range. Steps are checked by the run. */
export function checkWetModel(model: WetModel): void {
  bounded("grid", model.grid, WET_LIMITS.gridMin, WET_LIMITS.gridMax, true);
  const mask = model.mask;
  if (mask.kind === "blob") bounded("roughness", mask.roughness, 0, 1);
  else if (mask.kind === "ring") { bounded("roughness", mask.roughness, 0, 1); bounded("inner", mask.inner, 0.1, 0.9); }
  else if (mask.kind === "letters") {
    if (typeof mask.word !== "string" || mask.word.length < 1 || mask.word.length > 20 || !/^[\x20-\x7E]+$/.test(mask.word)) throw new Error("word must be 1 to 20 printable ASCII characters");
  } else if (mask.kind === "domain") {
    if (!Array.isArray(mask.regions) || mask.regions.length === 0) throw new Error("mask regions must be a non-empty list of { outer, holes }");
    let vertices = 0;
    for (const region of mask.regions) vertices += region.outer.length + (region.holes ?? []).reduce((total: number, hole: readonly unknown[]) => total + hole.length, 0);
    if (vertices > WET_LIMITS.maxVertices) throw new Error(`The supplied mask has ${vertices} vertices; the limit is ${WET_LIMITS.maxVertices}. Simplify the mask`);
  } else throw new Error(`Unknown wet mask: ${String((mask as { kind?: unknown }).kind)}`);
  const f = model.frame;
  bounded("centerX", f.centerX, -4096, 4096); bounded("centerY", f.centerY, -4096, 4096);
  bounded("width", f.width, 8, 4096); bounded("height", f.height, 8, 4096); bounded("rotation", f.rotation, -3600, 3600);
  bounded("paperVariation", model.paper.variation, 0, 0.95); bounded("paperGrain", model.paper.grain, 2, 400);
  bounded("absorbency", model.paper.absorbency, 0, 0.5);
  const prewet = bounded("prewet", model.water.prewet, 0, 5);
  if (prewet > 0 && prewet < WET_LIMITS.dryWater) throw new Error(`prewet must be 0 or at least ${WET_LIMITS.dryWater} (a thinner film is dry)`);
  bounded("evaporation", model.water.evaporation, 0, 0.5); bounded("edgeDrying", model.water.edgeDrying, 0, 20); bounded("edgeReach", model.water.edgeReach, 1, 1000);
  bounded("transport", model.transport.strength, 0, 1); bounded("pigmentSpread", model.transport.pigmentSpread, 0, 1);
  bounded("tilt", model.transport.tilt, 0, WET_LIMITS.maxTilt); bounded("tiltAngle", model.transport.tiltAngle, -3600, 3600);
  if (model.transport.boundary !== "sealed" && model.transport.boundary !== "open") throw new Error(`boundary must be "sealed" or "open"`);
  const p = model.pigment;
  bounded("sites", p.sites, 0, WET_LIMITS.maxSites, true);
  if (p.layout !== "scattered" && p.layout !== "rim" && p.layout !== "core") throw new Error(`layout must be "scattered", "rim" or "core"`);
  bounded("dropRadius", p.radius, 1, 1000);
  bounded("dropDepth", p.depth, WET_LIMITS.dryWater, 5); bounded("ratio", p.ratio, 0.05, 100);
  bounded("depositRate", p.depositRate, 0, 1); bounded("redissolve", p.redissolve, 0, 1);
  const b = model.backruns;
  bounded("backruns", b.count, 0, WET_LIMITS.maxBackruns, true);
  bounded("backrunStep", b.step, 1, WET_LIMITS.maxSteps, true); bounded("backrunGap", b.gap, 0, WET_LIMITS.maxSteps, true);
  bounded("backrunDepth", b.depth, WET_LIMITS.dryWater, 5); bounded("backrunRadius", b.radius, 1, 1000);
}

/* ----------------------------------------------------------------------------------- environment */

const TAU = Math.PI * 2;

/** A star-shaped outline `r(θ) = 1 + Σ a_h cos(hθ + φ_h)`, h = 3…7, scaled so its largest radius is 1. */
function blobRadii(seed: number, roughness: number, count: number): Float64Array {
  const stream = new SeededStream(componentSeed(seed, "mask", "blob"));
  const weights: number[] = [], phases: number[] = [];
  for (let h = 3; h <= 7; h++) { weights.push((0.4 + 0.6 * stream.next()) / h ** 0.7); phases.push(stream.next() * TAU); }
  const total = weights.reduce((a, b) => a + b, 0);
  const radii = new Float64Array(count);
  let peak = 0;
  for (let k = 0; k < count; k++) {
    const theta = (k / count) * TAU;
    let r = 1;
    for (let h = 3; h <= 7; h++) r += (roughness * 0.5 * weights[h - 3] / total) * Math.cos(h * theta + phases[h - 3]);
    radii[k] = r; if (r > peak) peak = r;
  }
  for (let k = 0; k < count; k++) radii[k] /= peak;
  return radii;
}

function place(ring: readonly (readonly [number, number])[], frame: WetModel["frame"]): [number, number][] {
  const angle = frame.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return ring.map(([x, y]): [number, number] => [frame.centerX + x * c - y * s, frame.centerY + x * s + y * c]);
}

const domainCache = new Map<string, PlanarDomain>();
/** The wet mask as a planar domain in canvas units (cached, frozen). */
export function wetMaskDomain(mask: WetMaskSpec, frame: WetModel["frame"], seed: number): PlanarDomain {
  const key = JSON.stringify([mask, frame, mask.kind === "blob" || mask.kind === "ring" ? seed : 0]);
  return memoized(domainCache, key, () => {
    if (mask.kind === "domain")
      return planarDomain(mask.regions.map((region) => ({ outer: region.outer, holes: region.holes ?? [] })), { id: "wet-mask" });
    if (mask.kind === "letters") {
      const domain = textDomain(mask.word, { centerX: frame.centerX, centerY: frame.centerY, width: frame.width, height: frame.height, id: "wet-mask" });
      if (frame.rotation === 0) return domain;
      const rings = domain.regions.flatMap((region) => [region.outer, ...region.holes]).map((ring) => {
        const angle = frame.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
        return ring.map(([x, y]): [number, number] => {
          const dx = x - frame.centerX, dy = y - frame.centerY;
          return [frame.centerX + dx * c - dy * s, frame.centerY + dx * s + dy * c];
        });
      });
      return ringsDomain(rings, { fill: "nonzero", id: "wet-mask" });
    }
    const count = 96, radii = blobRadii(seed, mask.roughness, count);
    const unit = (scale: number) => Array.from({ length: count }, (_, k): [number, number] => {
      const theta = (k / count) * TAU, r = radii[k] * scale;
      return [Math.cos(theta) * r * frame.width / 2, Math.sin(theta) * r * frame.height / 2];
    });
    const outer = place(unit(1), frame);
    const holes = mask.kind === "ring" ? [place(unit(mask.inner), frame)] : [];
    return planarDomain([planarRegion({ outer, holes })], { id: "wet-mask" });
  });
}

function lattice(seed: number, ix: number, iy: number): number {
  let h = (Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ seed) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function valueNoise(seed: number, x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = lattice(seed, ix, iy), b = lattice(seed, ix + 1, iy), c = lattice(seed, ix, iy + 1), d = lattice(seed, ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Derived, immutable-in-use data of one construction: mask cells, paper, edge distance, edges and sinks. */
export interface WetEnvironment {
  readonly n: number; readonly cell: number;
  readonly domain: PlanarDomain;
  /** 1 for wet-mask cells. */
  readonly wet: Uint8Array;
  /** Wet-mask cell indices, ascending. */
  readonly cells: Int32Array;
  /** Paper porosity per cell (1 ± variation). */
  readonly porosity: Float64Array;
  /** Distance from a cell centre to the nearest cell outside the mask, in cells (0 outside). */
  readonly edgeDistance: Float64Array;
  readonly edgeWeight: Float64Array;
  /** Edges between wet-mask cells: `a` to `b`, `b` the right (`0`) or lower (`1`) neighbour. */
  readonly ea: Int32Array; readonly eb: Int32Array; readonly em: Float64Array; readonly ed: Uint8Array;
  /** Links from wet-mask cells to cells outside the mask or the grid (the open boundary's sinks). */
  readonly sa: Int32Array; readonly sdx: Int8Array; readonly sdy: Int8Array;
  /** Scratch deltas for transport, fully rewritten before every read. */
  readonly scratchWater: Float64Array; readonly scratchPigment: Float64Array;
}

const environments = new Map<string, WetEnvironment>();

function chamfer(wet: Uint8Array, n: number): Float64Array {
  const d = new Float64Array(n * n);
  const INF = 1e9, S2 = Math.SQRT2;
  for (let i = 0; i < d.length; i++) d[i] = wet[i] ? INF : 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (!wet[k]) continue;
    let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + 1);
    if (j > 0) {
      v = Math.min(v, d[k - n] + 1);
      if (i > 0) v = Math.min(v, d[k - n - 1] + S2);
      if (i < n - 1) v = Math.min(v, d[k - n + 1] + S2);
    }
    d[k] = v;
  }
  for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
    const k = j * n + i;
    if (!wet[k]) continue;
    let v = d[k];
    if (i < n - 1) v = Math.min(v, d[k + 1] + 1);
    if (j < n - 1) {
      v = Math.min(v, d[k + n] + 1);
      if (i < n - 1) v = Math.min(v, d[k + n + 1] + S2);
      if (i > 0) v = Math.min(v, d[k + n - 1] + S2);
    }
    d[k] = Math.min(v, Math.min(i + 1, n - i, j + 1, n - j));
  }
  return d;
}

/** The derived data of a construction (cached by content; pure in `model` and `seed`). */
export function wetEnvironment(model: WetModel, seed: number): WetEnvironment {
  const key = JSON.stringify([model, seed]);
  return memoized(environments, key, () => {
    checkWetModel(model);
    const n = model.grid, cell = 640 / n, total = n * n;
    const domain = wetMaskDomain(model.mask, model.frame, seed);
    const wet = new Uint8Array(total);
    let count = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (locateInDomain(domain, (i + 0.5) * cell, (j + 0.5) * cell) !== "outside") { wet[j * n + i] = 1; count++; }
    }
    const cells = new Int32Array(count);
    { let c = 0; for (let k = 0; k < total; k++) if (wet[k]) cells[c++] = k; }
    const paperSeed = componentSeed(seed, "paper", "porosity");
    const porosity = new Float64Array(total);
    const { variation, grain } = model.paper;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * cell, y = (j + 0.5) * cell;
      const noise = 0.65 * valueNoise(paperSeed, x / grain, y / grain) + 0.35 * valueNoise(paperSeed ^ 0x9e3779b9, x / (grain * 0.43) + 17.3, y / (grain * 0.43) + 5.1);
      porosity[j * n + i] = 1 + variation * Math.max(-1, Math.min(1, (noise - 0.5) * 2.6));
    }
    const edgeDistance = chamfer(wet, n);
    const reach = model.water.edgeReach / cell;
    const edgeWeight = new Float64Array(total);
    for (const k of cells) edgeWeight[k] = Math.exp(-Math.max(0, edgeDistance[k] - 1) / reach);
    const ea: number[] = [], eb: number[] = [], em: number[] = [], ed: number[] = [];
    const sa: number[] = [], sdx: number[] = [], sdy: number[] = [];
    const mobility = (a: number, b: number) => Math.min(WET_LIMITS.maxMobility, 2 / (porosity[a] + porosity[b]));
    for (const k of cells) {
      const i = k % n, j = (k - i) / n;
      if (i < n - 1 && wet[k + 1]) { ea.push(k); eb.push(k + 1); em.push(mobility(k, k + 1)); ed.push(0); }
      if (j < n - 1 && wet[k + n]) { ea.push(k); eb.push(k + n); em.push(mobility(k, k + n)); ed.push(1); }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = i + dx, y = j + dy;
        if (x < 0 || y < 0 || x >= n || y >= n || !wet[y * n + x]) { sa.push(k); sdx.push(dx); sdy.push(dy); }
      }
    }
    return Object.freeze({
      n, cell, domain, wet, cells, porosity, edgeDistance, edgeWeight,
      ea: Int32Array.from(ea), eb: Int32Array.from(eb), em: Float64Array.from(em), ed: Uint8Array.from(ed),
      sa: Int32Array.from(sa), sdx: Int8Array.from(sdx), sdy: Int8Array.from(sdy),
      scratchWater: new Float64Array(total), scratchPigment: new Float64Array(total),
    });
  });
}

/* -------------------------------------------------------------------------------------- the model */

function siteFor(ctx: SimulationContext<WetModel>, env: WetEnvironment, serial: number, earlier: readonly WetSite[]): WetSite {
  const model = ctx.params, id = elementId("site", serial), stream = ctx.stream(id, "place");
  const { n, cell, cells } = env, radius = model.pigment.radius, target = 2.2 * radius;
  let best = -Infinity, bx = 0, by = 0;
  for (let c = 0; c < WET_LIMITS.candidates; c++) {
    const index = cells[stream.int(cells.length)], jx = stream.next(), jy = stream.next();
    const x = ((index % n) + jx) * cell, y = (Math.floor(index / n) + jy) * cell;
    let nearest = target;
    for (const site of earlier) if (site.kind === "pigment") nearest = Math.min(nearest, Math.hypot(site.x - x, site.y - y));
    const edge = env.edgeDistance[index] * cell;
    const score = model.pigment.layout === "scattered" ? nearest
      : model.pigment.layout === "rim" ? nearest - 3 * Math.abs(edge - 0.6 * radius)
        : nearest + 1.5 * edge;
    if (score > best) { best = score; bx = x; by = y; }
  }
  return { id, kind: "pigment", x: bx, y: by, step: 0, radius, depth: model.pigment.depth, parent: null };
}

function backrunFor(ctx: SimulationContext<WetModel>, env: WetEnvironment, serial: number, index: number, pigmentSites: readonly WetSite[]): WetSite {
  const model = ctx.params, b = model.backruns, id = elementId("site", serial), stream = ctx.stream(id, "place");
  const { n, cell, cells } = env;
  const parent = pigmentSites.length > 0 ? pigmentSites[index % pigmentSites.length] : null;
  const angle = stream.next() * TAU, distance = (0.3 + 0.9 * stream.next()) * b.radius;
  const anywhere = cells[stream.int(cells.length)], jx = stream.next(), jy = stream.next();
  let x: number, y: number;
  if (parent) { x = parent.x + Math.cos(angle) * distance; y = parent.y + Math.sin(angle) * distance; }
  else { x = ((anywhere % n) + jx) * cell; y = (Math.floor(anywhere / n) + jy) * cell; }
  const ci = Math.floor(x / cell), cj = Math.floor(y / cell);
  if (ci < 0 || cj < 0 || ci >= n || cj >= n || !env.wet[cj * n + ci]) { x = parent ? parent.x : ((anywhere % n) + jx) * cell; y = parent ? parent.y : (Math.floor(anywhere / n) + jy) * cell; }
  return { id, kind: "water", x, y, step: b.step + index * b.gap, radius: b.radius, depth: b.depth, parent: parent ? parent.id : null };
}

function inject(state: WetState, env: WetEnvironment, site: WetSite, concentration: number): void {
  const { n, cell } = env, R = site.radius;
  const i0 = Math.max(0, Math.floor((site.x - R) / cell)), i1 = Math.min(n - 1, Math.floor((site.x + R) / cell));
  const j0 = Math.max(0, Math.floor((site.y - R) / cell)), j1 = Math.min(n - 1, Math.floor((site.y + R) / cell));
  const acc = state.accounting;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * n + i;
    if (!env.wet[k]) continue;
    const dx = (i + 0.5) * cell - site.x, dy = (j + 0.5) * cell - site.y, q = (dx * dx + dy * dy) / (R * R);
    if (q >= 1) continue;
    const add = site.depth * (1 - q) * (1 - q);
    if (add < WET_LIMITS.dryWater) continue;
    state.water[k] += add; acc.injectedWater += add;
    if (site.kind === "pigment") { const mass = add * concentration; state.pigment[k] += mass; acc.injectedPigment += mass; }
    state.dried[k] = -1;
  }
}

function wetCount(state: WetState): number {
  let count = 0;
  const w = state.water;
  for (let k = 0; k < w.length; k++) if (w[k] > 0) count++;
  return count;
}

const sum = (a: ArrayLike<number>): number => { let s = 0; for (let k = 0; k < a.length; k++) s += a[k]; return s; };

function initialState(ctx: SimulationContext<WetModel>): WetState {
  const model = ctx.params, env = wetEnvironment(model, ctx.seed), total = env.n * env.n;
  ctx.charge(4 * total);
  const state: WetState = {
    water: new Float64Array(total), pigment: new Float64Array(total), deposit: new Float64Array(total), dried: new Int32Array(total).fill(-1),
    accounting: { injectedWater: 0, injectedPigment: 0, evaporated: 0, absorbed: 0, lostWater: 0, lostPigment: 0 },
    sites: [], nextSite: 0, settled: -1,
  };
  if (env.cells.length > 0) {
    if (model.water.prewet > 0) for (const k of env.cells) { state.water[k] = model.water.prewet; state.accounting.injectedWater += model.water.prewet; }
    for (let s = 0; s < model.pigment.sites; s++) state.sites.push(siteFor(ctx, env, state.nextSite++, state.sites));
    const pigments = state.sites.slice();
    for (let b = 0; b < model.backruns.count; b++) state.sites.push(backrunFor(ctx, env, state.nextSite++, b, pigments));
  }
  for (const site of state.sites) if (site.step === 0) inject(state, env, site, 1 / model.pigment.ratio);
  if (wetCount(state) === 0 && state.sites.every((site) => site.step <= 0)) state.settled = 0;
  return state;
}

function stepState(state: WetState, ctx: SimulationContext<WetModel>): WetState {
  if (state.settled >= 0) { ctx.charge(1); return state; }
  const model = ctx.params, env = wetEnvironment(model, ctx.seed), k = ctx.step;
  ctx.charge((WET_LIMITS.substeps + 1) * env.cells.length + 1);
  const { water: W, pigment: P, deposit: D, dried, accounting: acc } = state;
  const concentration = 1 / model.pigment.ratio;
  // 1. drops
  for (const site of state.sites) if (site.step === k) inject(state, env, site, concentration);
  // 2. transport
  const d0 = WET_LIMITS.waterSpread * model.transport.strength, kappa = WET_LIMITS.pigmentSpreadScale * model.transport.pigmentSpread;
  const tilt = model.transport.tilt, angle = model.transport.tiltAngle * Math.PI / 180, gx = Math.cos(angle), gy = Math.sin(angle);
  const dW = env.scratchWater, dP = env.scratchPigment;
  const { ea, eb, em, ed } = env;
  const cells = env.cells;
  for (let pass = 0; pass < WET_LIMITS.substeps; pass++) {
  dW.fill(0); dP.fill(0);
  for (let e = 0; e < ea.length; e++) {
    const a = ea[e], b = eb[e], wa = W[a], wb = W[b];
    if (wa === 0 && wb === 0) continue;
    const m = em[e], t = tilt * (ed[e] === 0 ? gx : gy);
    const q = m * d0 * (wa - wb) + (t > 0 ? t * wa : t * wb);
    if (q > 0) { const carried = P[a] / wa * q; dW[a] -= q; dW[b] += q; dP[a] -= carried; dP[b] += carried; }
    else if (q < 0) { const r = -q, carried = P[b] / wb * r; dW[b] -= r; dW[a] += r; dP[b] -= carried; dP[a] += carried; }
    if (kappa > 0 && wa > 0 && wb > 0) { const f = m * kappa * (P[a] - P[b]); dP[a] -= f; dP[b] += f; }
  }
  if (model.transport.boundary === "open") {
    const { sa, sdx, sdy } = env;
    for (let s = 0; s < sa.length; s++) {
      const a = sa[s], wa = W[a];
      if (wa === 0) continue;
      const m = Math.min(WET_LIMITS.maxMobility, 1 / env.porosity[a]), t = tilt * (gx * sdx[s] + gy * sdy[s]);
      const q = m * d0 * wa + (t > 0 ? t * wa : 0);
      const carried = P[a] / wa * q;
      dW[a] -= q; dP[a] -= carried; acc.lostWater += q; acc.lostPigment += carried;
    }
  }
  for (let c = 0; c < cells.length; c++) { const i = cells[c]; W[i] += dW[i]; P[i] += dP[i]; }
  }
  // 3 to 5. paper, air, drying, settling and lifting
  const { absorbency } = model.paper, { evaporation, edgeDrying } = model.water;
  const { depositRate, redissolve } = model.pigment;
  const dry = WET_LIMITS.dryWater, film = WET_LIMITS.filmWater;
  for (let c = 0; c < cells.length; c++) {
    const i = cells[c];
    let w = W[i];
    if (w === 0) continue;
    const absorbed = Math.min(w, absorbency * env.porosity[i]);
    w -= absorbed; acc.absorbed += absorbed;
    const evaporated = Math.min(w, evaporation * (1 + edgeDrying * env.edgeWeight[i]));
    w -= evaporated; acc.evaporated += evaporated;
    if (w < dry) {
      acc.evaporated += w; W[i] = 0; D[i] += P[i]; P[i] = 0; dried[i] = k;
      continue;
    }
    W[i] = w;
    const thin = w >= film ? 0 : 1 - w / film, settle = depositRate + (1 - depositRate) * thin;
    const lift = redissolve * Math.min(1, w / film);
    const down = settle * P[i], up = lift * D[i];
    P[i] += up - down; D[i] += down - up;
  }
  // 6. bookkeeping
  if (wetCount(state) === 0 && state.sites.every((site) => site.step <= k)) state.settled = k;
  return state;
}

function frameOf(state: WetState, step: number): WetFrame {
  const acc = state.accounting;
  return {
    step, grid: Math.round(Math.sqrt(state.water.length)),
    water: state.water, pigment: state.pigment, deposit: state.deposit, dried: state.dried,
    wetCells: wetCount(state), settled: state.settled,
    totals: {
      water: sum(state.water), suspended: sum(state.pigment), deposited: sum(state.deposit),
      injectedWater: acc.injectedWater, injectedPigment: acc.injectedPigment,
      evaporated: acc.evaporated, absorbed: acc.absorbed, lostWater: acc.lostWater, lostPigment: acc.lostPigment,
    },
  };
}

/** The model as a `Simulation`: params are the construction, the retained projection is the frame at that step. */
export const wetPigmentSimulation: Simulation<WetState, WetModel, WetFrame> = {
  id: "wet-pigment",
  limits: (model) => ({ stepLimit: WET_LIMITS.maxSteps, workPerStep: wetWork(model.grid, 1) - 4 * model.grid * model.grid, initialWork: 4 * model.grid * model.grid }),
  initial: initialState,
  step: stepState,
  project: frameOf,
};

/* ------------------------------------------------------------------------------------ running it */

export type WetSnapshots = Snapshots<WetState, WetModel, WetFrame>;

const wetCache = createSimulationCache({ capacity: 3 });

/**
 * Snapshots of `steps` steps of `model` for `seed`, from the shared cache: the same object for the same
 * construction and steps, whatever the appearance; a longer `steps` extends a cached run and a shorter one
 * replays from a checkpoint. Throws naming the control that is out of range or too costly.
 */
export function wetPigmentSnapshots(model: WetModel, seed: number, steps: number, cancelled?: () => boolean): WetSnapshots {
  checkWetModel(model);
  checkWetWork(model, steps);
  return wetCache.get(wetPigmentSimulation, model, seed, { steps, ...retention, ...(cancelled ? { cancelled } : {}) }) as WetSnapshots;
}

/** As `wetPigmentSnapshots`, in time slices; resolves null when cancelled (nothing is published or cached). */
export async function prepareWetPigmentSnapshots(model: WetModel, seed: number, steps: number, cancelled: () => boolean): Promise<WetSnapshots | null> {
  checkWetModel(model);
  checkWetWork(model, steps);
  return await wetCache.prepare(wetPigmentSimulation, model, seed, { steps, ...retention, cancelled }) as WetSnapshots | null;
}

function checkWetWork(model: WetModel, steps: number): void {
  bounded("steps", steps, 0, WET_LIMITS.maxSteps, true);
  const work = wetWork(model.grid, steps);
  if (work > WET_LIMITS.maxWork)
    throw new Error(`steps × grid² would take ${work} cell updates; the limit is ${WET_LIMITS.maxWork}. Lower steps or grid`);
}

const retention = {
  checkpointEvery: WET_LIMITS.checkpointEvery, historyEvery: 0,
  maxWork: WET_LIMITS.maxWork, maxCheckpointValues: WET_LIMITS.maxCheckpointValues,
} as const;
