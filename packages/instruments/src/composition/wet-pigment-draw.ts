import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { wetPigmentDefinition } from "../adapters/wet-pigment-instrument.js";
import { cachedBy, createCompositionRun } from "./core.js";
import { domainIntersection, domainRings, keyholeRing, type PlanarDomain } from "./domains.js";
import { clipPaths } from "./domains-paths.js";
import { offsetDomain } from "./domains-offset.js";
import { maskDomain } from "./domains-raster.js";
import type { CompositionRun, CompositionSurface, Path } from "./types.js";
import { prepareWetPigmentSnapshots, WET_LIMITS, wetEnvironment, wetPigmentSnapshots,
  type WetEnvironment, type WetFrame, type WetModel, type WetSnapshots } from "./wet-pigment.js";

/**
 * Wet Pigment as a typed, JSON-compatible composition: one producer (`wetPigmentSnapshots`, the stepped
 * water-and-pigment model of `wet-pigment.ts`) and three treatments of the SAME frame, each usable alone
 * and replaceable by an ordinary callback:
 *
 * - PIGMENT BANDS: the pigment on the paper (deposit, plus the still-suspended pigment when
 *   `suspended`) as `bands` nested translucent fills. Band k is the region where the density reaches
 *   `L_k = −ln(1 − k / (bands + 1)) / gain` (a Beer–Lambert reading: `gain` is what counts as dark), extracted
 *   by marching squares with linear interpolation (`maskDomain`, "contour" mode) as a planar domain with
 *   holes. Cumulative opacity after band k is `opacity·k / bands`. Ramp colour mixes palette 0 (thin) to 1 (dense).
 * - DRYING FRONTS: contours of the time each cell last ran dry, one at every `every` steps
 *   (`τ = s + ½`, undried cells count as drying at the last step + 1), from `maskDomain` rings, clipped to the
 *   wet region shrunk by 0.8 cell so no line runs along the region's own edge; pieces shorter than three cells are dropped
 *   (specks where one edge cell dried early). Paths carry `level = s`.
 *   Palette 2.
 * - WATER FILM: the region where water still stands (a domain, palette 3) and its advancing edge as clipped
 *   paths, exactly like the fronts.
 * - OUTLINE (of the wet region itself): the mask polygon's rings (palette 4).
 *
 * KEYS. The construction (mask, grid, paper, water, transport, pigment, backruns) and the step count decide
 * the snapshots; `bands`, `gain`, `suspended`, `every` decide only geometry read from a frame; palette, opacity,
 * colour mode and weights are appearance and rebuild nothing. Geometry is cached per frame object.
 *
 * WORK. Drawing charges the run one unit per band, front and film polygon set. Front levels are capped at
 * `MAX_FRONTS`; more is an error naming the interval.
 */
export interface WetPigmentComposition {
  kind: "wet-pigment";
  seed: number;
  palette: readonly number[];
  model: WetModel;
  steps: number;
  pigment: { show: boolean; bands: number; gain: number; opacity: number; colorMode: "ramp" | "single"; suspended: boolean };
  fronts: { show: boolean; every: number; weight: number };
  film: { show: boolean; opacity: number; edgeWeight: number };
  outline: { show: boolean; weight: number };
}

export const MAX_FRONTS = 40;
export const MAX_BANDS = 24;

type Scalar = number | string | boolean;
const definition = wetPigmentDefinition;

/** Resolve stored scalar controls to the public composition value. Hidden controls never reach the model. */
export function wetPigmentComposition(input: InstrumentInput): WetPigmentComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length < 2 || input.palette.some((color) =>
    !Number.isSafeInteger(color) || color < 0 || color > 0xffffff)) throw new Error("Wet pigment needs at least two packed RGB colors (wash, pigment)");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const shape = q.maskShape as string, late = q.lateWater === true;
  const mask: WetModel["mask"] = shape === "letters" ? { kind: "letters", word: q.word as string }
    : shape === "ring" ? { kind: "ring", roughness: q.roughness as number, inner: q.inner as number }
      : { kind: "blob", roughness: q.roughness as number };
  const tilt = q.tilt as number;
  const model: WetModel = {
    grid: q.grid as number, mask,
    frame: { centerX: q.centerX as number, centerY: q.centerY as number, width: q.width as number, height: q.height as number, rotation: q.rotation as number },
    paper: { variation: q.paperVariation as number, grain: (q.paperVariation as number) > 0 ? q.paperGrain as number : 8, absorbency: q.absorbency as number },
    water: { prewet: q.prewet as number, evaporation: q.evaporation as number, edgeDrying: q.edgeDrying as number, edgeReach: (q.edgeDrying as number) > 0 ? q.edgeReach as number : 1 },
    transport: { strength: q.transport as number, pigmentSpread: q.pigmentSpread as number, tilt, tiltAngle: tilt > 0 ? q.tiltAngle as number : 0, boundary: q.boundary as "sealed" | "open" },
    pigment: { sites: q.sites as number, layout: q.layout as "scattered" | "rim" | "core", radius: q.dropRadius as number, depth: q.dropDepth as number,
      ratio: q.ratio as number, depositRate: q.depositRate as number, redissolve: q.redissolve as number },
    backruns: late
      ? { count: q.backruns as number, step: q.backrunStep as number, gap: q.backrunGap as number, depth: q.backrunDepth as number, radius: q.backrunRadius as number }
      : { count: 0, step: 1, gap: 0, depth: WET_LIMITS.dryWater, radius: 1 },
  };
  return {
    kind: "wet-pigment", seed: input.seed, palette: [...input.palette], model, steps: q.steps as number,
    pigment: { show: q.showPigment === true, bands: q.bands as number, gain: q.gain as number, opacity: q.opacity as number, colorMode: q.colorMode as "ramp" | "single", suspended: q.showSuspended === true },
    fronts: { show: q.showFronts === true, every: q.frontEvery as number, weight: q.frontWeight as number },
    film: { show: q.showFilm === true, opacity: q.filmOpacity as number, edgeWeight: q.filmEdge as number },
    outline: { show: q.showOutline === true, weight: q.outlineWeight as number },
  };
}

/** Whether the seed can change what is computed: outline, paper and sites all draw from it. */
export function wetPigmentUsesSeed(q: Record<string, Scalar>): boolean {
  return (q.maskShape !== "letters" && (q.roughness as number) > 0) || (q.paperVariation as number) > 0 || (q.sites as number) > 0 || (q.lateWater === true && (q.backruns as number) > 0);
}

/* ------------------------------------------------------------------------------------- treatments */

export interface PigmentBands {
  /** Density thresholds, ascending. */
  readonly levels: readonly number[];
  /** `domains[k]` is where the density reaches `levels[k]`; nested, each inside the one before. */
  readonly domains: readonly PlanarDomain[];
}
export interface DryingFronts {
  /** Step of each front, ascending. */
  readonly steps: readonly number[];
  /** Front lines clipped inside the wet region; `path.level` is the step. */
  readonly paths: readonly Path[];
}
export interface WetFilm {
  /** Where water still stands. */
  readonly domain: PlanarDomain;
  /** Its advancing edge (not the region's own edge). */
  readonly edge: readonly Path[];
}

const bandCache = new WeakMap<WetFrame, Map<string, PigmentBands>>();
const frontCache = new WeakMap<WetFrame, Map<string, DryingFronts>>();
const filmCache = new WeakMap<WetFrame, Map<string, WetFilm>>();
const interiorCache = new WeakMap<WetEnvironment, PlanarDomain>();

function rasterOptions(env: WetEnvironment, id: string, threshold: number) {
  return { mode: "contour" as const, threshold, cell: env.cell, origin: [0, 0] as [number, number], id };
}

/**
 * Carry a field a little past the wet region's staircase edge (each pass: a cell outside takes the mean of its
 * filled 4-neighbours), so a contour of it can be trimmed to the region's smooth outline instead of following
 * the cell staircase.
 */
function extended(values: Float64Array, env: WetEnvironment): Float64Array {
  const n = env.n, out = values.slice(), filled = env.wet.slice();
  for (let pass = 0; pass < 2; pass++) {
    const next = filled.slice();
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i;
      if (filled[k]) continue;
      let total = 0, count = 0;
      if (i > 0 && filled[k - 1]) { total += out[k - 1]; count++; }
      if (i < n - 1 && filled[k + 1]) { total += out[k + 1]; count++; }
      if (j > 0 && filled[k - n]) { total += out[k - n]; count++; }
      if (j < n - 1 && filled[k + n]) { total += out[k + n]; count++; }
      if (count > 0) { out[k] = total / count; next[k] = 1; }
    }
    filled.set(next);
  }
  return out;
}

/** A level set of a field carried past the region's edge, then trimmed to the region's outline. */
function trimmed(values: Float64Array, env: WetEnvironment, threshold: number, id: string): PlanarDomain {
  const n = env.n;
  const raw = maskDomain({ width: n, height: n, data: extended(values, env) }, rasterOptions(env, id, threshold));
  return raw.regions.length === 0 ? raw : domainIntersection(raw, env.domain, { id });
}

/** The wet region shrunk by 0.8 cell: front lines are kept only inside it. */
function interior(env: WetEnvironment): PlanarDomain {
  let value = interiorCache.get(env);
  if (!value) { value = offsetDomain(env.domain, -0.8 * env.cell, { join: "round" }); interiorCache.set(env, value); }
  return value;
}

/** The nested density domains of a frame (see the header). `levels` come from `bands` and `gain` alone. */
export function pigmentBands(frame: WetFrame, env: WetEnvironment, options: { bands: number; gain: number; suspended: boolean }): PigmentBands {
  const { bands, gain, suspended } = options;
  if (!Number.isInteger(bands) || bands < 1 || bands > MAX_BANDS) throw new Error(`bands must be an integer from 1 to ${MAX_BANDS}`);
  if (!Number.isFinite(gain) || gain <= 0) throw new Error("gain must be a positive number");
  return cachedBy(bandCache, frame, `${bands}|${gain}|${suspended}`, () => {
    const n = frame.grid, values = new Float64Array(n * n);
    for (const k of env.cells) values[k] = frame.deposit[k] + (suspended ? frame.pigment[k] : 0);
    const levels: number[] = [], domains: PlanarDomain[] = [];
    for (let k = 1; k <= bands; k++) {
      const level = -Math.log(1 - k / (bands + 1)) / gain;
      levels.push(level);
      domains.push(trimmed(values, env, level, `band:${k}`));
    }
    return Object.freeze({ levels: Object.freeze(levels), domains: Object.freeze(domains) });
  });
}

function edgePaths(domain: PlanarDomain, env: WetEnvironment, id: string, level: number, fraction: number): readonly Path[] {
  const rings = domainRings(domain);
  const paths: Path[] = rings.map((ring, r) => Object.freeze({
    id: `${id}:${r}`, seed: 0, points: ring, closed: true, level, levelFraction: fraction,
  }));
  // pieces shorter than three cells are isolated specks where a single edge cell dried early, not fronts
  return clipPaths(paths, interior(env)).filter((path) => {
    let length = 0;
    for (let i = 1; i < path.points.length; i++) length += Math.hypot(path.points[i][0] - path.points[i - 1][0], path.points[i][1] - path.points[i - 1][1]);
    return length >= 3 * env.cell;
  });
}

/** Drying-front contours of a frame every `every` steps (see the header). */
export function dryingFronts(frame: WetFrame, env: WetEnvironment, options: { every: number }): DryingFronts {
  const { every } = options;
  if (!Number.isInteger(every) || every < 1) throw new Error("frontEvery must be a positive integer");
  return cachedBy(frontCache, frame, `${every}`, () => {
    let last = -1;
    for (const k of env.cells) if (frame.dried[k] > last) last = frame.dried[k];
    const count = Math.floor(last / every);
    if (count > MAX_FRONTS) throw new Error(`${count} drying fronts would be drawn; the limit is ${MAX_FRONTS}. Raise the front interval (now ${every}) or lower the elapsed steps`);
    const n = frame.grid, cap = last + 1, steps: number[] = [], paths: Path[] = [];
    const values = new Float64Array(n * n);
    for (let s = every, index = 0; s <= last; s += every, index++) {
      values.fill(-1000);
      for (const k of env.cells) values[k] = s + 0.5 - (frame.dried[k] >= 0 ? frame.dried[k] : cap);
      const domain = maskDomain({ width: n, height: n, data: values }, rasterOptions(env, `front:${s}`, 0));
      steps.push(s);
      paths.push(...edgePaths(domain, env, `front:${s}`, s, count > 1 ? index / (count - 1) : 0));
    }
    return Object.freeze({ steps: Object.freeze(steps), paths: Object.freeze(paths) });
  });
}

/** The region where water still stands, and its advancing edge. */
export function wetFilm(frame: WetFrame, env: WetEnvironment): WetFilm {
  return cachedBy(filmCache, frame, "film", () => {
    const n = frame.grid, values = new Float64Array(n * n);
    for (const k of env.cells) values[k] = frame.water[k];
    const domain = trimmed(values, env, WET_LIMITS.dryWater / 2, "film");
    return Object.freeze({ domain, edge: edgePaths(domain, env, "film", frame.step, 1) });
  });
}

/* ---------------------------------------------------------------------------------------- products */

/** Everything the consumers read; treatments a recipe does not show are null. */
export interface WetPigmentProducts {
  readonly snapshots: WetSnapshots;
  readonly frame: WetFrame;
  readonly environment: WetEnvironment;
  readonly bands: PigmentBands | null;
  readonly fronts: DryingFronts | null;
  readonly film: WetFilm | null;
}

export function wetPigmentProducts(recipe: WetPigmentComposition, control: { cancelled?: () => boolean } = {}): WetPigmentProducts {
  const snapshots = wetPigmentSnapshots(recipe.model, recipe.seed, recipe.steps, control.cancelled);
  return productsOf(recipe, snapshots);
}

function productsOf(recipe: WetPigmentComposition, snapshots: WetSnapshots): WetPigmentProducts {
  const frame = snapshots.final as WetFrame, environment = wetEnvironment(recipe.model, recipe.seed);
  return {
    snapshots, frame, environment,
    bands: recipe.pigment.show ? pigmentBands(frame, environment, recipe.pigment) : null,
    fronts: recipe.fronts.show ? dryingFronts(frame, environment, recipe.fronts) : null,
    film: recipe.film.show ? wetFilm(frame, environment) : null,
  };
}

/* --------------------------------------------------------------------------------------- consumers */

export interface WetPigmentConsumers {
  pigment?(surface: CompositionSurface, bands: PigmentBands, run: CompositionRun): void;
  fronts?(surface: CompositionSurface, fronts: DryingFronts, run: CompositionRun): void;
  film?(surface: CompositionSurface, film: WetFilm, run: CompositionRun): void;
}

const channels = (color: number): [number, number, number] => [(color >>> 16) & 255, (color >>> 8) & 255, color & 255];
const paletteColor = (palette: readonly number[], role: number): [number, number, number] => channels(palette[role % palette.length]);

function fillDomain(surface: CompositionSurface, domain: PlanarDomain): void {
  for (const region of domain.regions) {
    const ring = keyholeRing(region);
    surface.beginShape();
    for (const [x, y] of ring) surface.vertex(x, y);
    surface.endShape(surface.CLOSE);
  }
}

function strokePath(surface: CompositionSurface, path: Path): void {
  surface.beginShape();
  for (const [x, y] of path.points) surface.vertex(x, y);
  surface.endShape(path.closed ? surface.CLOSE : undefined);
}

/** Layer opacity so that the cumulative opacity after band k is `opacity·k / bands`. */
export function bandAlpha(k: number, bands: number, opacity: number): number {
  const before = opacity * (k - 1) / bands, after = opacity * k / bands;
  return 1 - (1 - after) / (1 - before);
}

/** The stock pigment consumer: nested fills, thin to dense, at the layer alphas of `bandAlpha`. */
export function pigmentFills(recipe: Pick<WetPigmentComposition, "palette" | "pigment">): NonNullable<WetPigmentConsumers["pigment"]> {
  const { palette, pigment } = recipe;
  const thin = paletteColor(palette, 0), dense = paletteColor(palette, 1), count = pigment.bands;
  return (surface, bands, run) => {
    surface.noStroke();
    bands.domains.forEach((domain, index) => {
      if (domain.regions.length === 0) return;
      run.enter(1);
      try {
        const t = pigment.colorMode === "single" || count === 1 ? 1 : index / (count - 1);
        const rgb = [0, 1, 2].map((c) => Math.round(thin[c] + (dense[c] - thin[c]) * t));
        surface.fill(rgb[0], rgb[1], rgb[2], bandAlpha(index + 1, count, pigment.opacity) * 255);
        fillDomain(surface, domain);
      } finally { run.leave(); }
    });
  };
}

/** The stock front consumer: one stroked polyline per clipped piece, palette 2. */
export function frontLines(recipe: Pick<WetPigmentComposition, "palette" | "fronts">): NonNullable<WetPigmentConsumers["fronts"]> {
  const [r, g, b] = paletteColor(recipe.palette, 2);
  return (surface, fronts, run) => {
    if (fronts.paths.length === 0 || !(recipe.fronts.weight > 0)) return;
    run.enter(1);
    try {
      surface.noFill(); surface.stroke(r, g, b, 200); surface.strokeWeight(recipe.fronts.weight);
      for (const path of fronts.paths) strokePath(surface, path);
    } finally { run.leave(); }
  };
}

/** The stock film consumer: a pale fill and the advancing edge, palette 3. */
export function filmSheen(recipe: Pick<WetPigmentComposition, "palette" | "film">): NonNullable<WetPigmentConsumers["film"]> {
  const [r, g, b] = paletteColor(recipe.palette, 3);
  return (surface, film, run) => {
    run.enter(1);
    try {
      if (recipe.film.opacity > 0) { surface.noStroke(); surface.fill(r, g, b, recipe.film.opacity * 255); fillDomain(surface, film.domain); }
      if (recipe.film.edgeWeight > 0) {
        surface.noFill(); surface.stroke(r, g, b, 230); surface.strokeWeight(recipe.film.edgeWeight);
        for (const path of film.edge) strokePath(surface, path);
      }
    } finally { run.leave(); }
  };
}

/** Draw the recipe into a caller-owned surface: film, pigment, fronts, outline (bottom to top). */
export function drawWetPigment(surface: CompositionSurface, recipe: WetPigmentComposition, consumers: WetPigmentConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 400_000 })): void {
  run.check();
  const products = wetPigmentProducts(recipe, { cancelled: () => { try { run.check(); return false; } catch { return true; } } });
  paint(surface, recipe, products, consumers, run);
}

function paint(surface: CompositionSurface, recipe: WetPigmentComposition, products: WetPigmentProducts, consumers: WetPigmentConsumers, run: CompositionRun): void {
  const layer = <T>(value: T | null, consumer: ((surface: CompositionSurface, value: T, run: CompositionRun) => void) | undefined) => {
    if (value === null || !consumer) return;
    surface.push();
    try { consumer(surface, value, run); } finally { surface.pop(); }
  };
  layer(products.film, consumers.film ?? filmSheen(recipe));
  layer(products.bands, consumers.pigment ?? pigmentFills(recipe));
  layer(products.fronts, consumers.fronts ?? frontLines(recipe));
  if (recipe.outline.show && recipe.outline.weight > 0) {
    const [r, g, b] = paletteColor(recipe.palette, 4);
    run.enter(1);
    surface.push();
    try {
      surface.noFill(); surface.stroke(r, g, b, 230); surface.strokeWeight(recipe.outline.weight);
      for (const ring of domainRings(products.environment.domain)) {
        surface.beginShape();
        for (const [x, y] of ring) surface.vertex(x, y);
        surface.endShape(surface.CLOSE);
      }
    } finally { surface.pop(); run.leave(); }
  }
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Run the model in time slices, then build the shown treatments stage by stage; false if cancelled. */
export async function prepareWetPigment(recipe: WetPigmentComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const snapshots = await prepareWetPigmentSnapshots(recipe.model, recipe.seed, recipe.steps, cancelled);
  if (snapshots === null || cancelled()) return false;
  const frame = snapshots.final as WetFrame, env = wetEnvironment(recipe.model, recipe.seed);
  const stages: (() => unknown)[] = [];
  if (recipe.film.show) stages.push(() => wetFilm(frame, env));
  if (recipe.pigment.show) stages.push(() => pigmentBands(frame, env, recipe.pigment));
  if (recipe.fronts.show) stages.push(() => dryingFronts(frame, env, recipe.fronts));
  for (const stage of stages) {
    await yieldToHost();
    if (cancelled()) return false;
    stage();
  }
  return !cancelled();
}

