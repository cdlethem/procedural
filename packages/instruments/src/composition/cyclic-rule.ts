import { locateInDomain, textDomain } from "./domains.js";
import type { PlanarShape } from "./domains.js";
import { elementId } from "./snapshots.js";
import type { Simulation, SimulationContext } from "./snapshots.js";

/**
 * The cyclic cellular automaton behind Cyclic Fronts (roadmap brief 19), as a `Simulation` of the
 * stateful-snapshot foundation. This file is the model only: rule, initial conditions, obstacles,
 * fixed update order, termination and period detection. Drawing treatments read its snapshots in
 * `cyclic-structure.ts` and `cyclic-fronts.ts`.
 *
 * THE RULE (Fisch, Gravner and Griffeath's cyclic cellular automaton, the threshold-range form).
 * A cell holds one of `states` (n) values arranged on a cycle 0 -> 1 -> ... -> n-1 -> 0. In one step a
 * cell in state s becomes s+1 (mod n) if and only if at least `threshold` cells of its neighbourhood are
 * in state s+1 (mod n) *before the step*; otherwise it keeps s. A cell never moves backwards and never
 * skips a state, so the domain of state s+1 invades the domain of state s: the interface between s and
 * s+1 is a moving front, and where all n states meet the fronts curl into a spiral wave.
 *
 * UPDATE ORDER: fully synchronous. Every cell reads the old grid and writes a new one; the visiting
 * order (row-major, top to bottom, left to right) therefore cannot change the result, and it is fixed
 * anyway for the termination and period bookkeeping.
 *
 * NEIGHBOURHOODS (offsets (dx, dy), the cell itself excluded, `range` = r >= 1):
 *  - moore:   max(|dx|, |dy|) <= r, so (2r+1)^2 - 1 cells (8, 24, 48, ...);
 *  - neumann: |dx| + |dy| <= r, so 2r(r+1) cells (4, 12, 24, ...);
 *  - ring:    round(sqrt(dx^2 + dy^2)) == r, the annulus at Euclidean distance [r - 1/2, r + 1/2) (r = 1
 *             is the 8 Moore neighbours; r = 2 is 12 cells, r = 3 is 16, and so on): a hollow neighbourhood
 *             whose cells do not see the ones next door.
 *
 * BOUNDARY: a bounded grid. Cells outside the grid do not exist and are never counted.
 * OBSTACLES: a wall cell (WALL = 255) never changes and is never counted as a successor, so fronts
 * stop at it and are not passed through it. A wall is not a state and has no colour of its own.
 *
 * TERMINATION AND PERIODS. If a step changes no cell the grid is a fixed point: it can never change
 * again. `fixedFrom` is the first step whose grid is fixed; later steps do no work. A grid that
 * cycles without being fixed (fronts running round a closed loop, stripes in a channel) is detected
 * exactly by Brent's algorithm: one earlier grid is kept, replaced by the current one at step 1, 2, 4,
 * 8, ..., and the first step whose grid equals it gives `period` (its distance to that step) and `periodAt`.
 * Detection is exact grid equality, not a hash, and needs one extra grid of memory. It reports a period no
 * later than about twice (start + period) steps and never reports a false one; a model that has not
 * repeated within `steps` reports 0 and that is the honest answer for a short run, not proof of chaos.
 * The grids from `periodAt` on are still computed, one by one, so `stateAt` stays the true state.
 *
 * Units: a cell is a unit square; lengths here are in cells and angles in radians or degrees as named.
 */

export type NeighbourhoodShape = "moore" | "neumann" | "ring";
export type StampName = "pinwheel" | "counter-rotating" | "target" | "triad";

/** Cell value of an obstacle. States are 0 .. states - 1. */
export const WALL = 255;

export const CYCLIC_LIMITS = Object.freeze({
  minStates: 3, maxStates: 24, maxRange: 6, maxCells: 240 * 240, maxColumns: 240, maxSteps: 2000,
  /** Most work units (cells x (neighbourhood + 2) per step, summed over steps) for a whole run; measured, see the brief document. */
  maxWork: 800_000_000,
  checkpointEvery: 25,
  maxCheckpointValues: 16_000_000,
  maxObstacleRuns: 100_000,
});

export interface CyclicRule {
  /** Number of states n on the cycle, 3 .. 24. */
  states: number;
  /** A cell advances when at least this many neighbours are already in its successor state. */
  threshold: number;
  /** Neighbourhood reach in cells, 1 .. 6. */
  range: number;
  neighbourhood: NeighbourhoodShape;
}

export type InitialSpec =
  /** Each cell independently holds a uniformly random state with probability `density`, else state 0. */
  | { kind: "random"; density: number }
  /** `count` seeded pinwheels of radius `radius` cells on a state-0 background. */
  | { kind: "spirals"; count: number; radius: number; noise: number }
  /** Bands `width` cells wide running through the states in order; `angle` degrees is the direction of increase. */
  | { kind: "stripes"; width: number; angle: number; noise: number }
  /** One designed stamp (pinwheel; two counter-rotating pinwheels; a target of concentric bands; three pinwheels around the centre) of radius `radius` cells centred at fractions (`x`, `y`) of the grid. */
  | { kind: "stamp"; stamp: StampName; radius: number; x: number; y: number; noise: number };

export type ObstacleSpec =
  | { kind: "none" }
  /** `count` seeded squares of side `size` cells. */
  | { kind: "blocks"; count: number; size: number }
  /** One circular wall of thickness `size` cells with an opening of `gap` (fraction of the circumference). */
  | { kind: "ring"; size: number; gap: number }
  /** `count` vertical walls `size` cells thick, evenly spaced, each with an opening of `gap` (fraction of the height). */
  | { kind: "bars"; count: number; size: number; gap: number }
  /** A resolved mask: alternating (start, length) pairs of wall cells over row-major cell indices (see `obstacleRuns`). */
  | { kind: "cells"; runs: readonly number[] };

/** Everything that shapes the grid and its evolution; nothing about how it is drawn or how many steps to show. */
export interface CyclicConstruction {
  columns: number;
  rows: number;
  rule: CyclicRule;
  initial: InitialSpec;
  obstacles: ObstacleSpec;
}

export interface CyclicState {
  cells: Uint8Array;
  /** Step at which each cell last changed; 0 when it never has. */
  last: Uint16Array;
  /** The earlier grid Brent's algorithm compares against, and the step it belongs to. */
  mark: Uint8Array;
  markStep: number;
  power: number;
  /** Cells changed by the step that produced this state (0 at step 0). */
  changed: number;
  /** First step whose grid is a fixed point, or -1. */
  fixedFrom: number;
  /** Detected period (>= 2 when found; a fixed point is reported through `fixedFrom`), or 0. */
  period: number;
  /** Step at which the period was confirmed, or 0. */
  periodAt: number;
}

/** What each retained step publishes: four numbers. The grids themselves are read with `stateAt`. */
export interface CyclicStep { step: number; changed: number; fixed: number; period: number }

/* ------------------------------------------------------------------------------------ neighbourhoods */

/** Offsets in fixed order (rows top to bottom, then left to right), the cell itself excluded. */
export function neighbourOffsets(shape: NeighbourhoodShape, range: number): readonly (readonly [number, number])[] {
  if (!Number.isInteger(range) || range < 1 || range > CYCLIC_LIMITS.maxRange) throw new Error(`Range must be an integer in [1, ${CYCLIC_LIMITS.maxRange}]`);
  const offsets: [number, number][] = [];
  for (let dy = -range; dy <= range; dy++) for (let dx = -range; dx <= range; dx++) {
    if (dx === 0 && dy === 0) continue;
    const inside = shape === "moore" ? true
      : shape === "neumann" ? Math.abs(dx) + Math.abs(dy) <= range
      : shape === "ring" ? Math.round(Math.hypot(dx, dy)) === range
      : (() => { throw new Error(`Unknown neighbourhood: ${String(shape)}`); })();
    if (inside) offsets.push([dx, dy]);
  }
  return offsets;
}

/** Cells in a neighbourhood: the most a threshold can ask for. */
export const neighbourCount = (shape: NeighbourhoodShape, range: number): number => neighbourOffsets(shape, range).length;

/* ------------------------------------------------------------------------------------ construction checks */

function integer(name: string, value: number, min: number, max: number): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer in [${min}, ${max}]`);
}
function finite(name: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be a finite number in [${min}, ${max}]`);
}

/** Validate a construction; every error names the control to change. */
export function checkConstruction(c: CyclicConstruction): void {
  integer("Columns", c.columns, 2, CYCLIC_LIMITS.maxColumns);
  if (!Number.isSafeInteger(c.rows) || c.rows < 2 || c.rows > CYCLIC_LIMITS.maxColumns)
    throw new Error(`The grid would have ${c.rows} rows, outside [2, ${CYCLIC_LIMITS.maxColumns}]: lower Columns or the height-to-width ratio of Size`);
  const { rule } = c;
  integer("States", rule.states, CYCLIC_LIMITS.minStates, CYCLIC_LIMITS.maxStates);
  integer("Range", rule.range, 1, CYCLIC_LIMITS.maxRange);
  const size = neighbourCount(rule.neighbourhood, rule.range);
  integer("Threshold", rule.threshold, 1, size);
  const i = c.initial;
  if (i.kind === "random") finite("Density", i.density, 0, 1);
  else {
    finite("Noise", i.noise, 0, 1);
    if (i.kind === "spirals") { integer("Seeds", i.count, 0, 64); finite("Seed size", i.radius, 1, 200); }
    else if (i.kind === "stripes") { finite("Stripe width", i.width, 0.5, 200); finite("Stripe angle", i.angle, -3600, 3600); }
    else if (i.kind === "stamp") {
      finite("Seed size", i.radius, 1, 200); finite("Stamp X", i.x, 0, 1); finite("Stamp Y", i.y, 0, 1);
      if (!["pinwheel", "counter-rotating", "target", "triad"].includes(i.stamp)) throw new Error(`Unknown stamp: ${String(i.stamp)}`);
    } else throw new Error(`Unknown initialization: ${String((i as { kind: unknown }).kind)}`);
  }
  const o = c.obstacles;
  if (o.kind === "blocks") { integer("Obstacle count", o.count, 0, 400); finite("Obstacle size", o.size, 1, 60); }
  else if (o.kind === "ring") { finite("Obstacle size", o.size, 1, 60); finite("Obstacle opening", o.gap, 0, 1); }
  else if (o.kind === "bars") { integer("Obstacle count", o.count, 0, 40); finite("Obstacle size", o.size, 1, 60); finite("Obstacle opening", o.gap, 0, 1); }
  else if (o.kind === "cells") {
    if (o.runs.length % 2 !== 0 || o.runs.length > CYCLIC_LIMITS.maxObstacleRuns * 2) throw new Error("Obstacle mask runs must be (start, length) pairs, at most " + CYCLIC_LIMITS.maxObstacleRuns);
    let end = 0;
    for (let k = 0; k < o.runs.length; k += 2) {
      const start = o.runs[k], length = o.runs[k + 1];
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start < end || length < 1 || start + length > c.columns * c.rows)
        throw new Error("Obstacle mask runs must be ascending, disjoint and inside the grid");
      end = start + length;
    }
  } else if (o.kind !== "none") throw new Error(`Unknown obstacles: ${String((o as { kind: unknown }).kind)}`);
}

/** Work units one step charges (grid cells x (neighbours + comparison + copy)). */
export const stepWork = (c: CyclicConstruction): number => c.columns * c.rows * (neighbourCount(c.rule.neighbourhood, c.rule.range) + 2);

/** The whole run's declared work, or an error naming Steps, Columns or Range when it exceeds the bound. */
export function checkRunWork(c: CyclicConstruction, steps: number): number {
  integer("Steps", steps, 0, CYCLIC_LIMITS.maxSteps);
  const work = stepWork(c) * steps;
  if (work > CYCLIC_LIMITS.maxWork)
    throw new Error(`${steps} steps of a ${c.columns} x ${c.rows} grid with ${neighbourCount(c.rule.neighbourhood, c.rule.range)} neighbours need ${work} work units, above ${CYCLIC_LIMITS.maxWork}: lower Steps, Columns or Range`);
  return work;
}

/* ------------------------------------------------------------------------------------ obstacles */

/** Cell index runs of a boolean per-cell predicate: alternating (start, length) pairs. */
function runsOf(wall: Uint8Array): number[] {
  const runs: number[] = [];
  for (let i = 0; i < wall.length;) {
    if (!wall[i]) { i++; continue; }
    let j = i;
    while (j < wall.length && wall[j]) j++;
    runs.push(i, j - i);
    i = j;
  }
  return runs;
}

/**
 * Turn any planar shape (a region, a domain, or plain ring data) into an obstacle mask. `frame` is the
 * shape's coordinate system in cells: a cell is a wall when its centre `(x + 1/2, y + 1/2)` is inside or on the
 * shape (the closed set, as `locateInDomain` defines it). Cell size and canvas position are not involved,
 * so moving or resizing the drawn grid never changes which cells are walls.
 */
export function obstacleRuns(shape: PlanarShape, columns: number, rows: number): ObstacleSpec {
  integer("Columns", columns, 2, CYCLIC_LIMITS.maxColumns); integer("Rows", rows, 2, CYCLIC_LIMITS.maxColumns);
  const wall = new Uint8Array(columns * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++)
    if (locateInDomain(shape, x + 0.5, y + 0.5) !== "outside") wall[y * columns + x] = 1;
  return { kind: "cells", runs: runsOf(wall) };
}

/** The bundled lettering obstacle: `text` (1-20 printable ASCII) fitted into 84% x 34% of the grid, centred. */
export function lettersObstacle(text: string, columns: number, rows: number): ObstacleSpec {
  const shape = textDomain(text, { centerX: columns / 2, centerY: rows / 2, width: columns * 0.84, height: rows * 0.34 });
  return obstacleRuns(shape, columns, rows);
}

function markObstacles(c: CyclicConstruction, ctx: SimulationContext<CyclicConstruction>, wall: Uint8Array): void {
  const { columns, rows } = c, o = c.obstacles;
  if (o.kind === "none") return;
  if (o.kind === "cells") {
    for (let k = 0; k < o.runs.length; k += 2) wall.fill(1, o.runs[k], o.runs[k] + o.runs[k + 1]);
    return;
  }
  if (o.kind === "blocks") {
    const side = Math.max(1, Math.round(o.size));
    for (let i = 0; i < o.count; i++) {
      const stream = ctx.stream(elementId("block", i), "obstacle");
      const bx = Math.floor(stream.next() * Math.max(1, columns - side + 1)), by = Math.floor(stream.next() * Math.max(1, rows - side + 1));
      for (let y = by; y < Math.min(rows, by + side); y++) for (let x = bx; x < Math.min(columns, bx + side); x++) wall[y * columns + x] = 1;
    }
    return;
  }
  if (o.kind === "ring") {
    const cx = columns / 2, cy = rows / 2, radius = 0.36 * Math.min(columns, rows);
    const opening = o.gap > 0 ? ctx.stream(elementId("ring", 0), "obstacle").next() * 2 * Math.PI : 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (Math.abs(Math.hypot(dx, dy) - radius) > o.size / 2) continue;
      if (o.gap > 0) {
        let turn = (Math.atan2(dy, dx) - opening) / (2 * Math.PI);
        turn -= Math.floor(turn);
        if (turn < o.gap) continue;
      }
      wall[y * columns + x] = 1;
    }
    return;
  }
  // bars
  const thick = Math.max(1, Math.round(o.size));
  for (let i = 0; i < o.count; i++) {
    const left = Math.round((i + 1) / (o.count + 1) * columns - thick / 2);
    const centre = o.gap > 0 ? ctx.stream(elementId("bar", i), "obstacle").next() * rows : 0;
    for (let x = Math.max(0, left); x < Math.min(columns, left + thick); x++) for (let y = 0; y < rows; y++) {
      if (o.gap > 0 && Math.abs(y + 0.5 - centre) <= o.gap * rows / 2) continue;
      wall[y * columns + x] = 1;
    }
  }
}

/* ------------------------------------------------------------------------------------ initial grids */

const mod = (value: number, n: number): number => ((value % n) + n) % n;
/** Serial of a cell's id: independent of the grid width, so growing the grid keeps every existing cell's draws. */
const cellSerial = (x: number, y: number): number => y * 4096 + x;

function pinwheel(cells: Uint8Array, columns: number, rows: number, n: number, cx: number, cy: number, radius: number, turn: number, phase: number): void {
  const r2 = radius * radius;
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(rows - 1, Math.ceil(cy + radius)); y++)
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(columns - 1, Math.ceil(cx + radius)); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > r2) continue;
      const fraction = turn * Math.atan2(dy, dx) / (2 * Math.PI) + phase;
      cells[y * columns + x] = Math.min(n - 1, Math.floor((fraction - Math.floor(fraction)) * n));
    }
}

function initialCells(c: CyclicConstruction, ctx: SimulationContext<CyclicConstruction>): Uint8Array {
  const { columns, rows } = c, n = c.rule.states, cells = new Uint8Array(columns * rows), i = c.initial;
  if (i.kind === "random") {
    if (i.density > 0) for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const u = ctx.stream(elementId("cell", cellSerial(x, y)), "initial").next();
      if (u < i.density) cells[y * columns + x] = Math.min(n - 1, Math.floor(u / i.density * n));
    }
  } else if (i.kind === "spirals") {
    for (let k = 0; k < i.count; k++) {
      const stream = ctx.stream(elementId("seed", k), "spiral");
      const span = (size: number) => Math.max(0, size - 2 * i.radius);
      const cx = columns <= 2 * i.radius ? columns / 2 : i.radius + stream.next() * span(columns);
      const cy = rows <= 2 * i.radius ? rows / 2 : i.radius + stream.next() * span(rows);
      const turn = stream.next() < 0.5 ? 1 : -1, phase = stream.next();
      pinwheel(cells, columns, rows, n, cx, cy, i.radius, turn, phase);
    }
  } else if (i.kind === "stripes") {
    const angle = i.angle * Math.PI / 180, ux = Math.cos(angle), uy = Math.sin(angle);
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++)
      cells[y * columns + x] = mod(Math.floor(((x + 0.5) * ux + (y + 0.5) * uy) / i.width), n);
  } else {
    const cx = i.x * columns, cy = i.y * rows, r = i.radius;
    if (i.stamp === "pinwheel") pinwheel(cells, columns, rows, n, cx, cy, r, 1, 0);
    else if (i.stamp === "counter-rotating") {
      pinwheel(cells, columns, rows, n, cx - r * 1.05, cy, r, 1, 0);
      pinwheel(cells, columns, rows, n, cx + r * 1.05, cy, r, -1, 0);
    } else if (i.stamp === "triad") {
      for (let k = 0; k < 3; k++) {
        const a = 2 * Math.PI * k / 3 - Math.PI / 2;
        pinwheel(cells, columns, rows, n, cx + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * 1.1, r, 1, k / 3);
      }
    } else {
      // Target: states fall with distance, one full cycle across the radius, so each ring is the successor of the ring outside it (the wave runs outward) and the outermost ring joins the background 0.
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(rows - 1, Math.ceil(cy + r)); y++)
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(columns - 1, Math.ceil(cx + r)); x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (d <= r) cells[y * columns + x] = Math.max(0, n - 1 - Math.floor(d / r * n));
        }
    }
  }
  if (i.kind !== "random" && i.noise > 0)
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const u = ctx.stream(elementId("cell", cellSerial(x, y)), "noise").next();
      if (u < i.noise) cells[y * columns + x] = Math.min(n - 1, Math.floor(u / i.noise * n));
    }
  const wall = new Uint8Array(columns * rows);
  markObstacles(c, ctx, wall);
  for (let k = 0; k < wall.length; k++) if (wall[k]) cells[k] = WALL;
  return cells;
}

/* ------------------------------------------------------------------------------------ the step */

interface Reach { count: number; dx: Int8Array; dy: Int8Array; delta: Int32Array }
function reachOf(c: CyclicConstruction): Reach {
  const offsets = neighbourOffsets(c.rule.neighbourhood, c.rule.range);
  return { count: offsets.length, dx: Int8Array.from(offsets, (o) => o[0]), dy: Int8Array.from(offsets, (o) => o[1]),
    delta: Int32Array.from(offsets, (o) => o[1] * c.columns + o[0]) };
}

/**
 * One synchronous step. Returns the number of changed cells. Cells at least `range` from every edge take a
 * bounds-free fast path; edge cells test each offset. Both count exactly the in-grid neighbours in state s+1.
 */
function advance(cells: Uint8Array, next: Uint8Array, last: Uint16Array, c: CyclicConstruction, reach: Reach, step: number): number {
  const { columns, rows } = c, n = c.rule.states, need = c.rule.threshold, r = c.rule.range;
  const { count, dx, dy, delta } = reach;
  let changed = 0;
  for (let y = 0; y < rows; y++) {
    const rowInside = y >= r && y < rows - r;
    for (let x = 0; x < columns; x++) {
      const at = y * columns + x, s = cells[at];
      if (s === WALL) { next[at] = WALL; continue; }
      const succ = s + 1 === n ? 0 : s + 1;
      let seen = 0;
      if (rowInside && x >= r && x < columns - r) {
        for (let j = 0; j < count; j++) if (cells[at + delta[j]] === succ && ++seen >= need) break;
      } else {
        for (let j = 0; j < count; j++) {
          const nx = x + dx[j], ny = y + dy[j];
          if (nx >= 0 && nx < columns && ny >= 0 && ny < rows && cells[ny * columns + nx] === succ && ++seen >= need) break;
        }
      }
      if (seen >= need) { next[at] = succ; last[at] = step; changed++; } else next[at] = s;
    }
  }
  return changed;
}

const sameGrid = (a: Uint8Array, b: Uint8Array): boolean => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

/** True when nothing in `params` or the seed can change the initial grid, so every seed shares one snapshot. */
export function usesSeed(c: CyclicConstruction): boolean {
  const i = c.initial, o = c.obstacles;
  const initial = i.kind === "random" ? i.density > 0 : i.kind === "spirals" ? i.count > 0 || i.noise > 0
    : i.noise > 0;
  const walls = o.kind === "blocks" ? o.count > 0 : o.kind === "ring" ? o.gap > 0 : o.kind === "bars" ? o.count > 0 && o.gap > 0 : false;
  return initial || walls;
}

/**
 * The cyclic simulation. Params are a `CyclicConstruction` (no step count, no appearance); the runner's
 * `steps` is the number of synchronous updates. The retained projection per step is `CyclicStep`.
 */
export const cyclicSimulation: Simulation<CyclicState, CyclicConstruction, CyclicStep> = {
  id: "cyclic-fronts",
  limits(c) {
    checkConstruction(c);
    const work = stepWork(c);
    return { stepLimit: CYCLIC_LIMITS.maxSteps, workPerStep: work, initialWork: c.columns * c.rows * 4 + 1 };
  },
  initial(ctx) {
    const c = ctx.params;
    checkConstruction(c);
    ctx.charge(c.columns * c.rows * 4);
    const cells = initialCells(c, ctx);
    return { cells, last: new Uint16Array(cells.length), mark: cells.slice(), markStep: 0, power: 1, changed: 0, fixedFrom: -1, period: 0, periodAt: 0 };
  },
  step(state, ctx) {
    const c = ctx.params;
    if (state.fixedFrom >= 0) { ctx.charge(1); state.changed = 0; return state; }
    ctx.charge(stepWork(c));
    const next = new Uint8Array(state.cells.length);
    const changed = advance(state.cells, next, state.last, c, reachOf(c), ctx.step);
    state.cells = next;
    state.changed = changed;
    if (changed === 0) state.fixedFrom = ctx.step - 1;
    else if (state.period === 0) {
      if (sameGrid(next, state.mark)) { state.period = ctx.step - state.markStep; state.periodAt = ctx.step; }
      else if (ctx.step - state.markStep === state.power) { state.mark = next.slice(); state.markStep = ctx.step; state.power *= 2; }
    }
    return state;
  },
  project: (state, step) => ({ step, changed: state.changed, fixed: state.fixedFrom >= 0 ? 1 : 0, period: state.fixedFrom >= 0 ? 1 : state.period }),
};
