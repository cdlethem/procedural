/**
 * Random-walk colour fronts: seeded walkers claim lattice cells for their colour, branch, and die, until the
 * region they can reach is full. Runs through the F7 snapshot API (`snapshots.ts`); see
 * `docs/composition-random-walk-fronts.md` for the frozen rules.
 *
 * State: `cells` (bits 0-3 owner colour + 1, 0 = unclaimed; bit 7 = unclaimed cell next to a claimed cell,
 * the front's frontier), `age` (step each cell was claimed; seeds are 0), the live walkers in ascending id
 * order, and counters. Published (`frontsField`): who owns each cell and when, the seeds, the walkers alive at
 * the step, and why the walk ended, if it did.
 */
import { createSimulationCache, elementId, finalState, runSimulation,
  type Simulation, type SimulationContext, type Snapshots } from "./snapshots.js";
import { freezeCopy } from "./snapshot-values.js";
import { latticeWalkStep } from "./walks.js";
import { gridStorage, nearestAllowedCell, walkRegions, type WalkGrid } from "./walk-grid.js";
import type { CompositionRun } from "./types.js";

export type WalkRevisit = "avoid" | "own" | "any";
export type WalkTransition = "inherit" | "cycle" | "random";
export type SeedLayout = "scatter" | "grid" | "ring" | "region";

export type WalkSeeding =
  | { readonly layout: SeedLayout; readonly count: number }
  /** Explicit seed cells `[x, y]` (direct API): each must be an allowed cell; seed `k` gets colour `k mod colors`. */
  | { readonly layout: "cells"; readonly cells: readonly (readonly [number, number])[] };

/** Everything that shapes the walk apart from the mask and the layer seed. Plain data; all of it is construction. */
export interface WalkRules {
  readonly neighbourhood: 4 | 8;
  /** Probability of keeping the previous direction when it is free (0 = memoryless). */
  readonly persistence: number;
  /** Probability a walker with an unclaimed neighbour takes only unclaimed neighbours (the greedy front). */
  readonly explore: number;
  /** `avoid`: never enters a claimed cell; `own`: may cross its own colour; `any`: may cross anything. Only unclaimed cells are ever claimed. */
  readonly revisit: WalkRevisit;
  /** Probability that a walker which claims a cell also spawns a child on it. */
  readonly branching: number;
  /** Most walkers alive at once; a birth that would exceed it does not happen. */
  readonly maxWalkers: number;
  /** A walker dies after this many consecutive steps without claiming a cell. */
  readonly patience: number;
  readonly walkersPerSeed: number;
  readonly colors: number;
  readonly transition: WalkTransition;
  /** Probability per claimed cell that the walker's colour changes (`transition` says how). */
  readonly shift: number;
  /** The walk ends when this fraction of the allowed cells is claimed. */
  readonly coverage: number;
  readonly seeding: WalkSeeding;
}

export const WALK_FRONT_LIMITS = Object.freeze({
  maxSteps: 20_000, maxWalkers: 1000, maxColors: 8, maxSeeds: 64, maxWalkersPerSeed: 8, maxPatience: 100_000,
  /** Conservative work bound: steps × maxWalkers × (neighbourhood + 6) + setup. About a second or two at the bound. */
  maxWork: 90_000_000,
  historyEvery: 10,
});

/** Why a walk ended. */
export type WalkEnd = "full" | "saturated" | "coverage" | "extinct";
const END_NAMES: readonly (WalkEnd | null)[] = [null, "full", "saturated", "coverage", "extinct"];

interface Walker { id: number; x: number; y: number; dir: number; color: number; idle: number }
export interface FrontsState {
  cells: Uint8Array;
  age: Uint16Array;
  walkers: Walker[];
  seeds: number[][];
  nextId: number;
  claimed: number;
  open: number;
  births: number;
  deaths: number;
  ended: number;
  endStep: number;
}
export interface FrontsProjection { claimed: number; walkers: number; open: number; births: number; deaths: number; ended: number }

const DX = [1, 0, -1, 0, 1, -1, -1, 1], DY = [0, 1, 0, -1, 1, 1, -1, -1];
const FRONTIER = 0x80, OWNER = 0x0f;

/** Throws, naming the control, for rules outside the model. */
export function checkWalkRules(rules: WalkRules): void {
  const range = (name: string, value: number, low: number, high: number, integer = false) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high || (integer && !Number.isInteger(value)))
      throw new Error(`${name} must be ${integer ? "an integer" : "a number"} from ${low} to ${high} (got ${String(value)})`);
  };
  if (rules.neighbourhood !== 4 && rules.neighbourhood !== 8) throw new Error("Neighbourhood must be 4 or 8");
  range("Persistence", rules.persistence, 0, 1); range("Explore", rules.explore, 0, 1); range("Branching", rules.branching, 0, 1);
  range("Shift", rules.shift, 0, 1); range("Coverage", rules.coverage, 0.001, 1);
  range("Maximum walkers", rules.maxWalkers, 1, WALK_FRONT_LIMITS.maxWalkers, true);
  range("Patience", rules.patience, 0, WALK_FRONT_LIMITS.maxPatience, true);
  range("Walkers per seed", rules.walkersPerSeed, 1, WALK_FRONT_LIMITS.maxWalkersPerSeed, true);
  range("Colors", rules.colors, 1, WALK_FRONT_LIMITS.maxColors, true);
  if (!["avoid", "own", "any"].includes(rules.revisit)) throw new Error(`Unknown revisit rule ${String(rules.revisit)}`);
  if (!["inherit", "cycle", "random"].includes(rules.transition)) throw new Error(`Unknown colour transition ${String(rules.transition)}`);
  const seeding = rules.seeding;
  if (seeding.layout === "cells") {
    range("Seed cells", seeding.cells.length, 1, WALK_FRONT_LIMITS.maxSeeds, true);
    for (const [x, y] of seeding.cells) if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error("Seed cells must be integer [x, y] cells");
  } else {
    if (!["scatter", "grid", "ring", "region"].includes(seeding.layout)) throw new Error(`Unknown seed layout ${String(seeding.layout)}`);
    range("Seeds", seeding.count, 1, WALK_FRONT_LIMITS.maxSeeds, true);
  }
  const seeds = seeding.layout === "cells" ? seeding.cells.length : seeding.count;
  if (seeds * rules.walkersPerSeed > rules.maxWalkers)
    throw new Error(`Seeds × Walkers per seed is ${seeds * rules.walkersPerSeed}, above Maximum walkers (${rules.maxWalkers}); raise Maximum walkers or lower Seeds or Walkers per seed`);
}

/** Work units one step may charge at most, and the bound on a whole run; both checked before anything runs. */
export const workPerStep = (rules: WalkRules): number => rules.maxWalkers * (rules.neighbourhood + 6) + 8;
export function checkWalkWork(rules: WalkRules, grid: WalkGrid, steps: number): void {
  if (!Number.isInteger(steps) || steps < 0 || steps > WALK_FRONT_LIMITS.maxSteps)
    throw new Error(`Steps must be an integer from 0 to ${WALK_FRONT_LIMITS.maxSteps} (got ${String(steps)})`);
  const bound = steps * workPerStep(rules) + setupWork(grid);
  if (bound > WALK_FRONT_LIMITS.maxWork)
    throw new Error(`${steps} steps with up to ${rules.maxWalkers} walkers is ${bound} work units, above the limit ${WALK_FRONT_LIMITS.maxWork}; lower Steps or Maximum walkers`);
}
const setupWork = (grid: WalkGrid): number => 6 * grid.columns * grid.rows + 4096;

/* --------------------------------------------------------------------------------------- seeds */

function placeSeeds(grid: WalkGrid, rules: WalkRules, ctx: SimulationContext<WalkRules>): { x: number; y: number; color: number }[] {
  const { columns, rows } = grid, data = gridStorage(grid), seeding = rules.seeding, out: { x: number; y: number; color: number }[] = [];
  const taken = new Set<number>();
  const add = (x: number, y: number, color: number) => {
    const cell = y * columns + x;
    if (taken.has(cell)) return; // two seeds that snap to one cell make one seed
    taken.add(cell);
    out.push({ x, y, color: color % rules.colors });
  };
  if (seeding.layout === "cells") {
    seeding.cells.forEach(([x, y], k) => {
      if (x < 0 || y < 0 || x >= columns || y >= rows || data[y * columns + x] !== 1) throw new Error(`Seed cell (${x}, ${y}) is not an allowed cell of the mask`);
      add(x, y, k);
    });
    return out;
  }
  const count = seeding.count, m = Math.min(columns, rows);
  if (seeding.layout === "region") {
    const regions = walkRegions(grid, rules.neighbourhood);
    for (let k = 0; k < Math.min(count, regions.count); k++) add(regions.anchors[k][0], regions.anchors[k][1], k);
  } else if (seeding.layout === "grid") {
    const g = Math.ceil(Math.sqrt(count));
    for (let k = 0; k < count; k++) {
      const [x, y] = nearestAllowedCell(grid, ((k % g) + 0.5) / g * columns, (Math.floor(k / g) + 0.5) / g * rows);
      add(x, y, k);
    }
  } else if (seeding.layout === "ring") {
    for (let k = 0; k < count; k++) {
      const [x, y] = nearestAllowedCell(grid, columns / 2 + Math.cos(2 * Math.PI * k / count) * 0.36 * m, rows / 2 + Math.sin(2 * Math.PI * k / count) * 0.36 * m);
      add(x, y, k);
    }
  } else {
    const list: number[] = [];
    for (let i = 0; i < data.length; i++) if (data[i] === 1) list.push(i);
    for (let k = 0; k < count; k++) {
      const stream = ctx.stream(elementId("seed", k), "place");
      let best = -1, bestScore = -1;
      for (let c = 0; c < 6; c++) {
        const cell = list[stream.int(list.length)], x = cell % columns, y = (cell - x) / columns;
        let score = Infinity;
        for (const s of out) score = Math.min(score, (s.x - x) ** 2 + (s.y - y) ** 2);
        if (score > bestScore) { bestScore = score; best = cell; }
      }
      add(best % columns, Math.floor(best / columns), k);
    }
  }
  return out;
}

/* ------------------------------------------------------------------------------------ the model */

function claim(state: FrontsState, grid: WalkGrid, rules: WalkRules, x: number, y: number, color: number, step: number): void {
  const { columns, rows } = grid, data = gridStorage(grid), i = y * columns + x, nb = rules.neighbourhood;
  if (state.cells[i] & FRONTIER) state.open--;
  state.cells[i] = color + 1;
  state.age[i] = step;
  state.claimed++;
  for (let d = 0; d < nb; d++) {
    const nx = x + DX[d], ny = y + DY[d];
    if (nx < 0 || ny < 0 || nx >= columns || ny >= rows) continue;
    const n = ny * columns + nx;
    if (data[n] === 1 && state.cells[n] === 0) { state.cells[n] = FRONTIER; state.open++; }
  }
}

function settle(state: FrontsState, grid: WalkGrid, rules: WalkRules, step: number): void {
  if (state.claimed === grid.count) state.ended = 1;
  else if (state.claimed >= Math.ceil(rules.coverage * grid.count)) state.ended = 3;
  else if (state.open === 0) state.ended = 2;
  else if (state.walkers.length === 0) state.ended = 4;
  if (state.ended !== 0) state.endStep = step;
}

function build(grid: WalkGrid): Simulation<FrontsState, WalkRules, FrontsProjection> {
  const { columns, rows } = grid, data = gridStorage(grid);
  return {
    id: `random-walk-fronts/${grid.id}`,
    limits: (rules) => ({ stepLimit: WALK_FRONT_LIMITS.maxSteps, workPerStep: workPerStep(rules), initialWork: setupWork(grid) }),
    initial(ctx) {
      const rules = ctx.params;
      checkWalkRules(rules);
      ctx.charge(4 * columns * rows);
      const state: FrontsState = {
        cells: new Uint8Array(columns * rows), age: new Uint16Array(columns * rows), walkers: [], seeds: [],
        nextId: 0, claimed: 0, open: 0, births: 0, deaths: 0, ended: 0, endStep: 0,
      };
      const seeds = placeSeeds(grid, rules, ctx);
      ctx.charge(64 * seeds.length);
      for (const seed of seeds) {
        claim(state, grid, rules, seed.x, seed.y, seed.color, 0);
        state.seeds.push([seed.x, seed.y, seed.color]);
      }
      for (const seed of seeds)
        for (let k = 0; k < rules.walkersPerSeed; k++) state.walkers.push({ id: state.nextId++, x: seed.x, y: seed.y, dir: -1, color: seed.color, idle: 0 });
      settle(state, grid, rules, 0);
      return state;
    },
    step(state, ctx) {
      if (state.ended !== 0) return state;
      const rules = ctx.params, step = ctx.step, nb = rules.neighbourhood, cells = state.cells;
      const survivors: Walker[] = [], born: Walker[] = [];
      let died = 0;
      for (const walker of state.walkers) {
        ctx.charge(nb + 6);
        // Six draws per walker and step, always, in this order: greedy, persistence, direction, branch, shift, pick.
        const stream = ctx.stream(elementId("walker", walker.id), "walk");
        const greedy = stream.next();
        const own = walker.color + 1;
        let hasOpen = false;
        for (let d = 0; d < nb && !hasOpen; d++) {
          const nx = walker.x + DX[d], ny = walker.y + DY[d];
          if (nx >= 0 && ny >= 0 && nx < columns && ny < rows && data[ny * columns + nx] === 1 && (cells[ny * columns + nx] & OWNER) === 0) hasOpen = true;
        }
        const restrict = hasOpen && greedy < rules.explore;
        const move = latticeWalkStep(walker.x, walker.y, stream, {
          columns, rows, neighbourhood: nb, persistence: rules.persistence, previous: walker.dir,
          blocked: (x, y) => {
            const cell = y * columns + x;
            if (data[cell] !== 1) return true;
            const owner = cells[cell] & OWNER;
            if (owner === 0) return false;
            if (restrict || rules.revisit === "avoid") return true;
            return rules.revisit === "own" && owner !== own;
          },
        });
        const branch = stream.next(), shift = stream.next(), pick = stream.next();
        if (move.stuck) { died++; state.deaths++; continue; }
        const next: Walker = { id: walker.id, x: move.x, y: move.y, dir: move.direction, color: walker.color, idle: walker.idle + 1 };
        if ((cells[move.y * columns + move.x] & OWNER) === 0) {
          claim(state, grid, rules, move.x, move.y, next.color, step);
          next.idle = 0;
          if (rules.colors > 1 && rules.transition !== "inherit" && shift < rules.shift)
            next.color = rules.transition === "cycle" ? (next.color + 1) % rules.colors : (next.color + 1 + Math.floor(pick * (rules.colors - 1))) % rules.colors;
          if (branch < rules.branching && state.walkers.length - died + born.length < rules.maxWalkers) {
            born.push({ id: state.nextId++, x: move.x, y: move.y, dir: -1, color: next.color, idle: 0 });
            state.births++;
          }
        }
        if (next.idle > rules.patience) { died++; state.deaths++; continue; }
        survivors.push(next);
      }
      state.walkers = survivors.concat(born);
      settle(state, grid, rules, step);
      return state;
    },
    project: (state): FrontsProjection => ({ claimed: state.claimed, walkers: state.walkers.length, open: state.open, births: state.births, deaths: state.deaths, ended: state.ended }),
  };
}

const simulations = new Map<string, Simulation<FrontsState, WalkRules, FrontsProjection>>();
/** The one simulation object for a grid's content (snapshots may only be extended by the object that made them). */
export function frontsSimulation(grid: WalkGrid): Simulation<FrontsState, WalkRules, FrontsProjection> {
  let sim = simulations.get(grid.id);
  if (sim) { simulations.delete(grid.id); simulations.set(grid.id, sim); return sim; }
  sim = build(grid);
  simulations.set(grid.id, sim);
  if (simulations.size > 24) simulations.delete(simulations.keys().next().value!);
  return sim;
}

export type FrontsSnapshots = Snapshots<FrontsState, WalkRules, FrontsProjection>;

/** Retention is fixed per grid so a slider drag extends or replays a cached run instead of fragmenting the cache. */
const retention = (grid: WalkGrid) => ({
  checkpointEvery: Math.max(100, Math.ceil(grid.columns * grid.rows / 200)),
  historyEvery: WALK_FRONT_LIMITS.historyEvery,
  maxWork: WALK_FRONT_LIMITS.maxWork, maxCheckpointValues: 12_000_000,
});

/** Snapshots retained by construction (grid content, rules, layer seed, steps). Appearance never enters. */
export const frontsCache = createSimulationCache({ capacity: 4, maxStoredValues: 24_000_000 });

function checked(grid: WalkGrid, rules: WalkRules, seed: number, steps: number): void {
  checkWalkRules(rules);
  checkWalkWork(rules, grid, steps);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Seed must be a uint32 integer");
}

/** The frozen snapshots of a walk to `steps` steps (cached; the same object for the same construction). */
export function walkFronts(grid: WalkGrid, rules: WalkRules, seed: number, options: { steps: number; run?: CompositionRun; cancelled?: () => boolean }): FrontsSnapshots {
  checked(grid, rules, seed, options.steps);
  return frontsCache.get(frontsSimulation(grid), rules, seed, { ...retention(grid), steps: options.steps, run: options.run, cancelled: options.cancelled });
}

/** Cooperative `walkFronts` in time slices; `null` when cancelled (nothing is cached). */
export async function prepareWalkFrontsSnapshots(grid: WalkGrid, rules: WalkRules, seed: number, options: { steps: number; cancelled: () => boolean }): Promise<FrontsSnapshots | null> {
  checked(grid, rules, seed, options.steps);
  return frontsCache.prepare(frontsSimulation(grid), rules, seed, { ...retention(grid), steps: options.steps, cancelled: options.cancelled });
}

/** An uncached run (analysis and tests). */
export function runWalkFronts(grid: WalkGrid, rules: WalkRules, seed: number, steps: number): FrontsSnapshots {
  checked(grid, rules, seed, steps);
  return runSimulation(frontsSimulation(grid), rules, seed, { ...retention(grid), steps });
}

/* ------------------------------------------------------------------------------------ published */

export interface FrontsWalker { readonly id: string; readonly x: number; readonly y: number; readonly color: number }
export interface FrontsSeed { readonly x: number; readonly y: number; readonly color: number }

/** The visited region, its ages and colours at the last step, frozen; typed arrays are private copies: read only. */
export interface FrontsField {
  readonly columns: number;
  readonly rows: number;
  readonly colors: number;
  readonly step: number;
  /** Allowed cells. */
  readonly allowed: number;
  readonly claimed: number;
  /** Unclaimed allowed cells adjacent to a claimed one: zero means no growth is possible. */
  readonly open: number;
  readonly births: number;
  readonly deaths: number;
  /** Why the walk stopped, and the step it stopped at; null while it could still grow. */
  readonly ended: { readonly reason: WalkEnd; readonly step: number } | null;
  readonly seeds: readonly FrontsSeed[];
  readonly walkers: readonly FrontsWalker[];
  /** Per cell, row-major: 0 unclaimed, else colour index + 1. */
  readonly owner: Readonly<Uint8Array>;
  /** Per cell: the step it was claimed (seeds 0; meaningful only where `owner` is not 0). */
  readonly age: Readonly<Uint16Array>;
}

const fields = new WeakMap<object, FrontsField>();

/** The published field of snapshots, made once per snapshots object. */
export function frontsField(snaps: FrontsSnapshots, grid: WalkGrid): FrontsField {
  const hit = fields.get(snaps);
  if (hit) return hit;
  const state = finalState(snaps), owner = new Uint8Array(state.cells.length);
  for (let i = 0; i < owner.length; i++) owner[i] = state.cells[i] & OWNER;
  const field: FrontsField = Object.freeze({
    columns: grid.columns, rows: grid.rows, colors: snaps.params.colors, step: snaps.steps, allowed: grid.count,
    claimed: state.claimed, open: state.open, births: state.births, deaths: state.deaths,
    ended: state.ended === 0 ? null : Object.freeze({ reason: END_NAMES[state.ended] as WalkEnd, step: state.endStep }),
    seeds: freezeCopy(state.seeds.map(([x, y, color]) => ({ x, y, color }))),
    walkers: freezeCopy(state.walkers.map((w) => ({ id: elementId("walker", w.id), x: w.x, y: w.y, color: w.color }))),
    owner, age: state.age,
  });
  fields.set(snaps, field);
  return field;
}
