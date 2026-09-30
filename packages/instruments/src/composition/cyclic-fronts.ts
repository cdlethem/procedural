import { cyclicFrontsDefinition } from "../adapters/cyclic-fronts-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { atEach, createCompositionRun, inside, strokeWith } from "./core.js";
import { CYCLIC_LIMITS, WALL, cyclicSimulation, usesSeed } from "./cyclic-rule.js";
import type { CyclicConstruction, CyclicState, CyclicStep } from "./cyclic-rule.js";
import { cyclicParams } from "./cyclic-params.js";
import type { CyclicInk, CyclicParams } from "./cyclic-params.js";
import { cyclicGrid, frontPaths, gridGeometry, spiralCores, stateCounts, stateRegions, cellSites } from "./cyclic-structure.js";
import type { CoreSite, CyclicFrame, CyclicGrid, FrontPath, GridGeometry, StateRegion } from "./cyclic-structure.js";
import { color, motif, pathMaterial } from "./materials.js";
import { createSimulationCache } from "./snapshots.js";
import type { Snapshots } from "./snapshots.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, PathMaterial, PathMaterialSpec, Site } from "./types.js";

/**
 * Cyclic Fronts as a typed, JSON-compatible composition: one producer (the cyclic automaton's snapshots, see
 * `cyclic-rule.ts`) and four consumers of the same grid: state cells (flat runs or hatching, or a mark at every cell),
 * interface fronts as paths, spiral cores as marks, and walls.
 *
 * - `construction` and `steps` are the model: rule, grid, initial condition and obstacles, and how many synchronous
 *   steps to show. They alone key the cached snapshots; scrubbing `steps` extends or replays a cached run.
 * - `frame` places the grid on the canvas (cells are square); `ink` is appearance only: colours, fills, marks,
 *   front material, which earlier fronts are echoed. Changing `ink`, `frame` or the palette repaints the same snapshot object.
 * - Colours: state s takes `statePalette(palette, states, ink.colors)`: "ramp" walks the palette as a closed loop so the
 *   last state is next to the first, "cycle" repeats palette entries. Cores use palette entries 0 (winding +1) and 1 (winding -1).
 *
 * Draw order: walls and state fill, cell marks, echoed fronts (oldest first), current fronts, cores. `drawCyclicFronts(surface, recipe,
 * { fill, cell, front, core })` replaces any consumer with an ordinary callback while the grid, regions, paths and sites stay the
 * same cached objects; a consumer runs only when the recipe selects that treatment. Host-supplied obstacle masks and initial
 * grids are resolved values for the direct API (`obstacleRuns`, `CyclicConstruction`); the saved instrument names only bundled choices.
 */
export interface CyclicFrontsComposition {
  kind: "cyclic-fronts";
  seed: number;
  palette: readonly number[];
  construction: CyclicConstruction;
  steps: number;
  frame: CyclicFrame;
  ink: CyclicInk;
}

/** Replace any consumer with an ordinary callback. */
export interface CyclicFrontsConsumers {
  /** Called per merged state region (local coordinates, region.state); replaces flat fill and hatching. */
  fill?: (surface: CompositionSurface, region: StateRegion, run: CompositionRun) => void;
  /** Called per cell site (angle = state / states of a turn, tone = state). */
  cell?: Mark;
  front?: PathMaterial;
  core?: Mark;
}

type Scalar = number | string | boolean;
const definition = cyclicFrontsDefinition;

/** Resolve stored scalar controls to the public composition value. */
export function cyclicFrontsComposition(input: InstrumentInput): CyclicFrontsComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const resolved: CyclicParams = cyclicParams(validateParameterValues(definition, input.params) as Record<string, Scalar>);
  return { kind: "cyclic-fronts", seed: input.seed, palette: [...input.palette], ...resolved };
}

/** Whether the seed can change the grid (initial condition or obstacle draws); appearance never uses it. */
export function cyclicFrontsUsesSeed(q: Record<string, Scalar>): boolean {
  return usesSeed(cyclicParams(q).construction);
}

/* ------------------------------------------------------------------------------------ producers */

const RETENTION = { checkpointEvery: CYCLIC_LIMITS.checkpointEvery, historyEvery: 1, maxCheckpointValues: CYCLIC_LIMITS.maxCheckpointValues,
  maxWork: CYCLIC_LIMITS.maxWork + CYCLIC_LIMITS.maxCells * 4 + 1 } as const;
const snapshotCache = createSimulationCache({ capacity: 4, maxStoredValues: 20_000_000 });
export type CyclicSnapshots = Snapshots<CyclicState, CyclicConstruction, CyclicStep>;

/** The cached snapshots of a recipe: keyed by construction, seed (only where it matters) and steps, never by appearance. */
export function cyclicSnapshots(recipe: Pick<CyclicFrontsComposition, "seed" | "construction" | "steps">): CyclicSnapshots {
  return snapshotCache.get(cyclicSimulation, recipe.construction, usesSeed(recipe.construction) ? recipe.seed : 0, { steps: recipe.steps, ...RETENTION });
}

/** Whether a recipe's snapshots are already cached (a cancelled or failed preparation leaves this false). */
export function hasCyclicSnapshots(recipe: Pick<CyclicFrontsComposition, "seed" | "construction" | "steps">): boolean {
  return snapshotCache.has(cyclicSimulation, recipe.construction, usesSeed(recipe.construction) ? recipe.seed : 0, { steps: recipe.steps, ...RETENTION });
}

/** What the run can say about itself, from the retained per-step numbers. */
export interface CyclicSummary {
  readonly steps: number;
  /** Cells changed by each step, index 0 = step 1. */
  readonly changed: readonly number[];
  /** First step whose grid is a fixed point (nothing can change again), or -1 within these steps. */
  readonly fixedFrom: number;
  /** Detected period of a repeating grid (>= 2), or 0 (none found yet; a fixed point is reported by `fixedFrom`). */
  readonly period: number;
  /** Step at which that period was confirmed, or 0. */
  readonly periodAt: number;
  readonly states: readonly number[];
  readonly walls: number;
  readonly cores: number;
  /** Interface edges of the final grid: advancing and defect. */
  readonly advancingEdges: number;
  readonly defectEdges: number;
}

/** Everything a consumer can read, for one recipe, cached by construction. */
export interface CyclicFrontsProducts {
  readonly snapshots: CyclicSnapshots;
  readonly grid: CyclicGrid;
  readonly geometry: GridGeometry;
  readonly regions: readonly StateRegion[];
  readonly fronts: readonly FrontPath[];
  readonly cores: readonly CoreSite[];
  readonly summary: CyclicSummary;
}

export function cyclicSummary(snaps: CyclicSnapshots, grid: CyclicGrid, fronts: readonly FrontPath[], cores: readonly CoreSite[]): CyclicSummary {
  const changed: number[] = [];
  let fixedFrom = -1, period = 0, periodAt = 0;
  for (const entry of snaps.history) {
    if (entry.step > 0) changed.push(entry.value.changed);
    if (fixedFrom < 0 && entry.value.fixed === 1) fixedFrom = entry.step - 1;
    if (period === 0 && periodAt === 0 && entry.value.period > 1) { period = entry.value.period; periodAt = entry.step; }
  }
  return Object.freeze({ steps: snaps.steps, changed: Object.freeze(changed), fixedFrom, period, periodAt, states: stateCounts(grid), walls: grid.walls, cores: cores.length,
    advancingEdges: fronts.reduce((sum, path) => sum + (path.kind === "advance" ? path.edges : 0), 0), defectEdges: fronts.reduce((sum, path) => sum + (path.kind === "defect" ? path.edges : 0), 0) });
}

/** The state after `steps`, its merged regions, its interface paths (advancing and defect) and spiral cores, and the run's summary. */
export function cyclicFrontsProducts(recipe: CyclicFrontsComposition): CyclicFrontsProducts {
  const snapshots = cyclicSnapshots(recipe), grid = cyclicGrid(snapshots), geometry = gridGeometry(grid.columns, grid.rows, recipe.frame);
  const fronts = frontPaths(grid, geometry, { kinds: "all", smoothing: 0, seed: recipe.seed }), cores = spiralCores(grid, geometry, recipe.seed);
  return { snapshots, grid, geometry, regions: stateRegions(grid, geometry, recipe.seed), fronts, cores, summary: cyclicSummary(snapshots, grid, fronts, cores) };
}

/* ------------------------------------------------------------------------------------ colours */

/**
 * One colour per state. "ramp": the palette as a closed loop (last entry blends back into the first) sampled at s / n, so
 * neighbouring states are neighbouring colours and the cycle has no seam; "cycle": palette entry s mod length.
 */
export function statePalette(palette: readonly number[], states: number, mode: "ramp" | "cycle"): number[] {
  const out: number[] = [];
  for (let s = 0; s < states; s++) {
    if (mode === "cycle" || palette.length === 1) { out.push(palette[s % palette.length]); continue; }
    const t = s / states * palette.length, j = Math.floor(t), f = t - j;
    const a = palette[j % palette.length], b = palette[(j + 1) % palette.length];
    const channel = (shift: number) => Math.round(((a >>> shift) & 255) * (1 - f) + ((b >>> shift) & 255) * f);
    out.push((channel(16) << 16) | (channel(8) << 8) | channel(0));
  }
  return out;
}

/** The darkest (or lightest) palette entry by Rec. 709 luma: walls use the first, fronts may use either. */
function extreme(palette: readonly number[], dark: boolean): number {
  let best = palette[0], bestLuma = dark ? Infinity : -Infinity;
  for (const c of palette) {
    const luma = 0.2126 * ((c >>> 16) & 255) + 0.7152 * ((c >>> 8) & 255) + 0.0722 * (c & 255);
    if (dark ? luma < bestLuma : luma > bestLuma) { best = c; bestLuma = luma; }
  }
  return best;
}

/* ------------------------------------------------------------------------------------ drawing */

/** Callback units one drawing may spend; over this, the error names the control to lower. */
export const CYCLIC_DRAW_UNITS = 900_000;
const BLEED = 1;

const unitDot = { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } as const;

function markSpec(kind: Exclude<CyclicInk["cellMark"]["kind"], "none">, size: number, weight: number): MotifSpec {
  return { kind, size, petals: 6, opening: kind === "rings" || kind === "rosette" ? 0.35 : 0, weight, rotation: 0, variation: 0, retention: 1 };
}

/** Hatch segments of one rectangle: lines at `angle` degrees, spaced `spacing`, anchored to the canvas origin so neighbours continue each other. */
export function stateHatch(bounds: readonly [number, number, number, number], angle: number, spacing: number): [number, number, number, number][] {
  const theta = angle * Math.PI / 180, c = Math.cos(theta), s = Math.sin(theta), nx = -s, ny = c;
  const [left, top, right, bottom] = bounds;
  const offsets = [left * nx + top * ny, right * nx + top * ny, left * nx + bottom * ny, right * nx + bottom * ny];
  const lines = Math.ceil(Math.max(...offsets) / spacing), first = Math.floor(Math.min(...offsets) / spacing);
  const out: [number, number, number, number][] = [];
  for (let k = first; k <= lines; k++) {
    const offset = k * spacing, px = nx * offset, py = ny * offset;
    let lo = -Infinity, hi = Infinity;
    for (const [origin, direction, min, max] of [[px, c, left, right], [py, s, top, bottom]] as const) {
      if (Math.abs(direction) < 1e-12) { if (origin < min || origin > max) { lo = Infinity; break; } continue; }
      const a = (min - origin) / direction, b = (max - origin) / direction;
      lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
    }
    if (lo < hi) out.push([px + c * lo, py + s * lo, px + c * hi, py + s * hi]);
  }
  return out;
}

function hatchCount(bounds: readonly [number, number, number, number], angle: number, spacing: number): number {
  const theta = angle * Math.PI / 180;
  return Math.ceil(((bounds[2] - bounds[0]) * Math.abs(Math.sin(theta)) + (bounds[3] - bounds[1]) * Math.abs(Math.cos(theta))) / spacing) + 1;
}

/** Draw the recipe into a caller-owned surface. Transparent: the host owns the paper. */
export function drawCyclicFronts(surface: CompositionSurface, recipe: CyclicFrontsComposition, consumers: CyclicFrontsConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: CYCLIC_DRAW_UNITS + 200_000 })): void {
  run.check();
  const { ink } = recipe, snaps = cyclicSnapshots(recipe), grid = cyclicGrid(snaps), geometry = gridGeometry(grid.columns, grid.rows, recipe.frame);
  const colors = statePalette(recipe.palette, grid.states, ink.colors);
  const wantFill = ink.fill.kind !== "none", wantMarks = ink.cellMark.kind !== "none", wantFronts = ink.fronts.kinds !== "none", wantCores = ink.coreMark.kind !== "none";
  const regions = wantFill || ink.walls !== "hidden" ? stateRegions(grid, geometry, recipe.seed) : [];
  const solid = regions.filter((region) => region.state !== WALL), walls = regions.filter((region) => region.state === WALL);
  const cell = geometry.cell;

  // Budget before any drawing: every count is known from the producers, so the error can name the control.
  const sites = wantMarks ? cellSites(grid, geometry, recipe.seed) : [];
  const echoSteps: number[] = [];
  if (wantFronts) for (let j = ink.fronts.echoes; j >= 1; j--) if (recipe.steps - j * ink.fronts.echoSpacing >= 0) echoSteps.push(recipe.steps - j * ink.fronts.echoSpacing);
  const frontSets = wantFronts ? [...echoSteps, recipe.steps].map((step) => frontPaths(cyclicGrid(snaps, step), geometry,
    { kinds: ink.fronts.kinds === "all" ? "all" : "advance", smoothing: ink.fronts.smoothing, seed: recipe.seed })) : [];
  const cores = wantCores ? spiralCores(grid, geometry, recipe.seed, ink.coreMark.reach) : [];
  let units = solid.length * (wantFill ? 1 : 0) + walls.length + sites.length + cores.length;
  if (ink.fill.kind === "hatch") {
    let lines = 0;
    for (const region of solid) lines += hatchCount(region.bounds, ink.fill.angle + region.state * 180 / grid.states, ink.fill.spacing);
    if (lines > CYCLIC_DRAW_UNITS) throw new Error(`Hatching needs ${lines} lines, above ${CYCLIC_DRAW_UNITS}: raise Hatch spacing or lower Columns`);
    units += lines;
  }
  if (sites.length > CYCLIC_DRAW_UNITS) throw new Error(`Cell marks need ${sites.length} marks, above ${CYCLIC_DRAW_UNITS}: lower Columns or turn Cell mark off`);
  for (const paths of frontSets) for (const path of paths) {
    units += 1 + (ink.fronts.material === "ink" ? 0 : Math.ceil(path.edges * cell / ink.fronts.spacing) + path.points.length);
  }
  if (units > CYCLIC_DRAW_UNITS) throw new Error(`This drawing needs ${units} mark operations, above ${CYCLIC_DRAW_UNITS}: lower Columns, Echoes or Steps of fronts, raise Stitch spacing, or turn a treatment off`);

  if (ink.walls !== "hidden" && walls.length > 0) {
    // Beyond the palette's own extreme, so a wall never reads as one of the states.
    const edge = extreme(recipe.palette, ink.walls === "dark");
    const push = (shift: number) => { const c = (edge >>> shift) & 255; return Math.round(ink.walls === "dark" ? c * 0.45 : c + (255 - c) * 0.65); };
    const wallColor = [(push(16) << 16) | (push(8) << 8) | push(0)];
    inside(surface, walls, (p, region) => {
      color(p, wallColor, 0, 255, true); color(p, wallColor, 0, 255, false); p.strokeWeight(BLEED);
      p.rect(0, 0, region.bounds[2] - region.bounds[0], region.bounds[3] - region.bounds[1]);
    }, run);
  }
  if (wantFill) {
    if (consumers.fill) inside(surface, solid, consumers.fill, run);
    else if (ink.fill.kind === "flat") {
      // Opaque rectangles get a hairline stroke of their own color: two anti-aliased edges that meet on a fractional
      // pixel otherwise leave a faint seam of paper between merged rectangles.
      const alpha = Math.round(255 * ink.fill.opacity), seam = ink.fill.opacity >= 1 ? BLEED : 0;
      inside(surface, solid, (p, region) => {
        color(p, colors, region.state, alpha, true);
        if (seam > 0) { color(p, colors, region.state, 255, false); p.strokeWeight(seam); } else p.noStroke();
        p.rect(0, 0, region.bounds[2] - region.bounds[0], region.bounds[3] - region.bounds[1]);
      }, run);
    } else {
      surface.push(); surface.noFill(); surface.strokeWeight(ink.fill.weight); surface.strokeCap(surface.ROUND);
      for (const region of solid) {
        run.enter(1);
        try {
          color(surface, colors, region.state, 255, false);
          for (const [x1, y1, x2, y2] of stateHatch(region.bounds, ink.fill.angle + region.state * 180 / grid.states, ink.fill.spacing)) surface.line(x1, y1, x2, y2);
        } finally { run.leave(); }
      }
      surface.pop();
    }
  }
  if (wantMarks) atEach(surface, sites, consumers.cell ?? motif(markSpec(ink.cellMark.kind as Exclude<typeof ink.cellMark.kind, "none">, ink.cellMark.size * cell, ink.cellMark.weight), colors), run);
  if (wantFronts) {
    const base = ink.fronts;
    frontSets.forEach((paths, index) => {
      // Echoes fade by getting thinner; the current fronts (last) are drawn at the full weight.
      const age = frontSets.length - 1 - index;
      const weight = base.weight * (1 - 0.6 * age / (frontSets.length));
      const spec: PathMaterialSpec = { kind: base.material, weight, spacing: base.spacing, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
        mark: { ...unitDot, size: Math.max(0.5, weight * 2.2) } };
      const inkColors = base.color === "state" ? colors : [extreme(recipe.palette, base.color === "dark")];
      strokeWith(surface, paths, consumers.front ?? pathMaterial(spec, inkColors), run);
    });
  }
  if (wantCores) {
    const kind = ink.coreMark.kind as Exclude<typeof ink.coreMark.kind, "none">;
    atEach(surface, cores, consumers.core ?? motif(markSpec(kind, ink.coreMark.size, ink.coreMark.weight), recipe.palette.length > 1 ? recipe.palette.slice(0, 2) : [recipe.palette[0], recipe.palette[0]]), run);
  }
}

/** Run the simulation in time slices with a yield to the host and warm the final grid; false if cancelled (nothing is cached). */
export async function prepareCyclicFronts(recipe: CyclicFrontsComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const snaps = await snapshotCache.prepare(cyclicSimulation, recipe.construction, usesSeed(recipe.construction) ? recipe.seed : 0,
    { steps: recipe.steps, ...RETENTION, cancelled });
  if (!snaps) return false;
  cyclicGrid(snaps);
  return !cancelled();
}
