import { cachedBy, componentSeed } from "./core.js";
import { domainContains, planarDomain, type PlanarRegionData } from "./domains.js";
import { fillableRings, IsoField } from "./iso-rings.js";
import {
  createSimulationCache, elementId, finalState, runSimulation, stateAt,
  type Simulation, type SimulationContext, type Snapshots,
} from "./snapshots.js";
import type { CompositionRun, Path, Point, Site } from "./types.js";

/**
 * Coupled chemotactic trails: agents that sense a chemical field, steer by it, and lay more of it.
 * A 2D model on a square grid over the 640-unit reference canvas; it is a drawing model of feedback
 * between walkers and a diffusing, decaying field, not a measurement of any organism or chemistry.
 * Contract, units, limits and checks: `docs/composition-chemotaxis.md`.
 *
 * STATE (one `Simulation` of the foundation, `snapshots.ts`). A `columns = rows = grid` field of
 * chemical (row-major, cell `(i, j)` centred at `((i + .5) cell, (j + .5) cell)`, `cell = 640 / grid`),
 * a wall mask, and agents in birth order. An agent's id is `agent:<serial>` from the birth counter
 * `next`; slots are never reused, dead agents keep their slot.
 *
 * UPDATE ORDER (frozen). Step `k` builds the state after `k` steps from the state after `k - 1`:
 *   0. birth      agents whose birth step is `k` appear at their emitter (ascending serial);
 *   1. sense      every living agent, ascending id, reads the OLD field at two probes (heading ∓ sensor
 *                 angle, `reach` ahead) and turns; only headings change;
 *   2. move       every living agent, ascending id, advances `speed` along its new heading, bouncing
 *                 off arena walls and barrier cells (a blocked move keeps the position);
 *   3. deposit    every living agent, ascending id, adds `deposit * strength` to the field around its
 *                 new position, then each emitter, in order, adds `beacon * strength` at its position;
 *   4. lifespan   agents that have acted `lifespan` steps die (0: never);
 *   5. relax      diffuse (no-flux at walls, or torus) then decay, on the whole field at once.
 * Nothing in 1 and 2 sees this step's deposits; that is the "synchronous" part of the coupling: an
 * agent responds to what was laid on earlier steps by anyone (including itself).
 *
 * TURN RULE. With `L` and `R` the bilinear field values at the two probes, contrast
 * `s = (R - L) / (R + L + SENSE_FLOOR)` (in (-1, 1), 0 when nothing is sensed) and
 * `turn = attraction * turnRate/360 * s + wander/360 * (2u - 1)` in turns, `u` a draw from the agent's
 * own stream for this step. Negative attraction repels. The probes and the bilinear sampling are the
 * ones of `sensorMotorStep2D`, which the tests use as the oracle; the contrast normalisation and the
 * noise are this model's extension.
 *
 * TERMINATION. When no agent is alive and none is yet to be born, and no emitter leaks (`beacon` 0),
 * the field only decays: it is set to zero when its maximum falls below `FIELD_EPSILON`, the state is
 * then `halted` and every later step returns it unchanged. The projection reports `halted`.
 */
export const CHEMOTAXIS_ARENA = 640;
export const CHEMOTAXIS_LIMITS = Object.freeze({
  /** Agents over all emitters. */
  maxAgents: 2400,
  minGrid: 16,
  maxGrid: 256,
  maxSteps: 1200,
  /** Fastest agent, canvas units per step (bundled barriers are thicker than this). */
  maxSpeed: 8,
  maxEmitters: 16,
  /** Values one run may keep in its per-step history (4 per agent per step). */
  maxHistoryValues: 3_600_000,
  /** Declared work units of a run (an agent step costs `AGENT_WORK`, a grid cell one). */
  maxWork: 60_000_000,
  /** Contour vertices over all levels. */
  maxContourVertices: 150_000,
});
export const AGENT_WORK = 16;
/** Chemical below which contrast is insensitive, in deposit units. */
export const SENSE_FLOOR = 0.02;
/** Field maximum below which an emitter-free colony that died out is set to zero. */
export const FIELD_EPSILON = 1e-9;
export const CHEMOTAXIS_RETENTION = Object.freeze({ checkpointEvery: 40, historyEvery: 1 });

const TAU = Math.PI * 2;

/** One source: where agents are born and how strongly they and the emitter lay chemical. */
export interface ChemotaxisEmitter {
  readonly x: number;
  readonly y: number;
  /** Agents born here. */
  readonly agents: number;
  /** Multiplier (>= 0) on the deposit of its agents and on its own beacon. */
  readonly strength: number;
}

/** Everything that changes what the model computes (no appearance, no step count). */
export interface ChemotaxisConstruction {
  readonly emitters: readonly ChemotaxisEmitter[];
  /** Radius of the disc around an emitter where its agents appear. */
  readonly spawnRadius: number;
  /** Steps over which the population is born (0: all at the start). */
  readonly release: number;
  /** Steps an agent acts before it dies (0: never). */
  readonly lifespan: number;
  /** Chemical each agent lays per step. */
  readonly deposit: number;
  /** Chemical each emitter leaks per step. */
  readonly beacon: number;
  /** Fraction of the difference to its four neighbours a cell moves per step, 0..1. */
  readonly diffusion: number;
  /** Fraction of the chemical lost per step, 0..1. */
  readonly decay: number;
  /** Probe distance, canvas units. */
  readonly reach: number;
  /** Probe offset from the heading, degrees. */
  readonly sensorAngle: number;
  /** Largest turn a fully one-sided reading causes, degrees per step. */
  readonly turnRate: number;
  /** -1 (flee the chemical) to 1 (follow it); scales the turn. */
  readonly attraction: number;
  /** Half range of the random turn, degrees per step. */
  readonly wander: number;
  /** Canvas units per step. */
  readonly speed: number;
  readonly edge: "wall" | "wrap";
  /** Cells per side. */
  readonly grid: number;
  /** Resolved barrier regions (plain planar data); empty for none. */
  readonly barrier: readonly PlanarRegionData[];
}

interface State {
  field: Float64Array;
  wall: Uint8Array;
  x: Float64Array;
  y: Float64Array;
  /** Turns, [0, 1). */
  heading: Float64Array;
  alive: Uint8Array;
  origin: Int32Array;
  strength: Float64Array;
  /** Birth step per slot, ascending in slot order. */
  born: Int32Array;
  /** Birth counter: slots below it exist. */
  next: number;
  halted: number;
}

/** What each retained step publishes. Typed arrays are private copies; treat them as read-only. */
export interface ChemotaxisFrame {
  readonly step: number;
  /** Agents born so far (the length of the arrays). */
  readonly count: number;
  readonly alive: number;
  readonly halted: boolean;
  readonly fieldMax: number;
  readonly fieldTotal: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  /** Turns. */
  readonly heading: Float32Array;
  /** 1 while alive; a dead agent keeps its last position. */
  readonly live: Uint8Array;
}

const finite = (label: string, value: unknown, low: number, high: number, integer = false): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high || (integer && !Number.isInteger(value)))
    throw new Error(`${label} must be ${integer ? "an integer" : "a number"} from ${low} to ${high} (got ${String(value)})`);
  return value;
};

export const totalAgents = (c: Pick<ChemotaxisConstruction, "emitters">): number => c.emitters.reduce((sum, e) => sum + e.agents, 0);

/** Work units one step declares; the run declares `initialWork + steps * workPerStep`. */
export const chemotaxisStepWork = (c: ChemotaxisConstruction): number => AGENT_WORK * totalAgents(c) + c.grid * c.grid;
const initialWork = (c: ChemotaxisConstruction): number => 4 * c.grid * c.grid + 8 * totalAgents(c) + 8;

/**
 * Validate a construction and a step count, naming the control to change. Called before anything is
 * built; the same bounds hold for the direct API and the instrument.
 */
export function checkChemotaxis(c: ChemotaxisConstruction, steps: number): void {
  const L = CHEMOTAXIS_LIMITS;
  if (!Array.isArray(c.emitters) || c.emitters.length > L.maxEmitters) throw new Error(`Emitters must be an array of at most ${L.maxEmitters}`);
  c.emitters.forEach((e, k) => {
    const label = `Emitter ${k + 1}`;
    finite(`${label} X`, e.x, 0, CHEMOTAXIS_ARENA - 1e-9); finite(`${label} Y`, e.y, 0, CHEMOTAXIS_ARENA - 1e-9);
    finite(`${label} agents`, e.agents, 0, L.maxAgents, true); finite(`${label} strength`, e.strength, 0, 1000);
  });
  finite("Spawn radius", c.spawnRadius, 0, 640); finite("Release", c.release, 0, L.maxSteps, true); finite("Lifespan", c.lifespan, 0, L.maxSteps, true);
  finite("Deposit", c.deposit, 0, 1000); finite("Beacon", c.beacon, 0, 1e5);
  finite("Diffusion", c.diffusion, 0, 1); finite("Decay", c.decay, 0, 1);
  finite("Reach", c.reach, 0, 640); finite("Sensor angle", c.sensorAngle, 0, 180); finite("Turn rate", c.turnRate, 0, 360);
  finite("Attraction", c.attraction, -1, 1); finite("Wander", c.wander, 0, 360); finite("Speed", c.speed, 0, L.maxSpeed);
  if (c.edge !== "wall" && c.edge !== "wrap") throw new Error(`Edge must be "wall" or "wrap" (got ${String(c.edge)})`);
  finite("Field resolution", c.grid, L.minGrid, L.maxGrid, true);
  finite("Steps", steps, 0, L.maxSteps, true);
  checkChemotaxisBudget(totalAgents(c), c.grid, steps);
}

/** The coupled bounds on agents, field size and steps alone, with the controls to lower named in each error. */
export function checkChemotaxisBudget(agents: number, grid: number, steps: number): void {
  const L = CHEMOTAXIS_LIMITS;
  if (agents > L.maxAgents) throw new Error(`Emitters × Agents per emitter = ${agents} agents; the limit is ${L.maxAgents}. Lower Agents per emitter or Emitters`);
  const history = 4 * agents * (steps + 1);
  if (history > L.maxHistoryValues)
    throw new Error(`Agents × Steps would keep ${history} trajectory values; the limit is ${L.maxHistoryValues}. Lower Steps, Agents per emitter or Emitters`);
  const work = 4 * grid * grid + 8 * agents + 8 + steps * (AGENT_WORK * agents + grid * grid);
  if (work > L.maxWork)
    throw new Error(`Steps × (agents and field cells) needs ${work} work units; the limit is ${L.maxWork}. Lower Steps, Agents per emitter, Emitters or Field resolution`);
}

/* --------------------------------------------------------------------------------- field helpers */

const wrap01 = (h: number): number => h - Math.floor(h);

/** Bilinear value at canvas `(px, py)` with the boundary rules of `sensorMotorStep2D`: `clamp` (wall) or `wrap`. */
export function sampleField(field: ArrayLike<number>, grid: number, edge: "wall" | "wrap", px: number, py: number): number {
  const cell = CHEMOTAXIS_ARENA / grid;
  let gx = px / cell - 0.5, gy = py / cell - 0.5;
  let x0: number, y0: number, x1: number, y1: number;
  if (edge === "wrap") {
    gx = gx % grid; if (gx < 0) gx += grid; if (gx >= grid) gx = 0;
    gy = gy % grid; if (gy < 0) gy += grid; if (gy >= grid) gy = 0;
    x0 = Math.floor(gx); y0 = Math.floor(gy); x1 = (x0 + 1) % grid; y1 = (y0 + 1) % grid;
  } else {
    gx = Math.min(grid - 1, Math.max(0, gx)); gy = Math.min(grid - 1, Math.max(0, gy));
    x0 = Math.floor(gx); y0 = Math.floor(gy); x1 = Math.min(x0 + 1, grid - 1); y1 = Math.min(y0 + 1, grid - 1);
  }
  const tx = gx - x0, ty = gy - y0;
  const a = field[y0 * grid + x0], b = field[y0 * grid + x1], c = field[y1 * grid + x0], d = field[y1 * grid + x1];
  const bottom = a + (b - a) * tx, top = c + (d - c) * tx;
  return bottom + (top - bottom) * ty;
}

const cellIndex = (v: number, grid: number, cell: number): number => Math.min(grid - 1, Math.max(0, Math.floor(v / cell)));

/** Add `amount` around `(px, py)`: bilinear over the four nearest cell centres, wall cells excluded and their share renormalised, so the whole amount lands. */
function splat(field: Float64Array, wall: Uint8Array, grid: number, edge: "wall" | "wrap", px: number, py: number, amount: number): void {
  const cell = CHEMOTAXIS_ARENA / grid;
  const gx = px / cell - 0.5, gy = py / cell - 0.5;
  const i0 = Math.floor(gx), j0 = Math.floor(gy), fx = gx - i0, fy = gy - j0;
  const index = (v: number): number => edge === "wrap" ? ((v % grid) + grid) % grid : Math.min(grid - 1, Math.max(0, v));
  const ia = index(i0), ib = index(i0 + 1), ja = index(j0), jb = index(j0 + 1);
  const ks = [ja * grid + ia, ja * grid + ib, jb * grid + ia, jb * grid + ib];
  const ws = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  let open = 0;
  for (let n = 0; n < 4; n++) if (!wall[ks[n]]) open += ws[n];
  if (!(open > 0)) return;
  for (let n = 0; n < 4; n++) if (!wall[ks[n]]) field[ks[n]] += amount * ws[n] / open;
}

/** One relaxation: diffusion (conserving; no flux through walls or, in wall mode, the arena edge) then decay. */
export function relaxField(field: Float64Array, wall: Uint8Array, grid: number, edge: "wall" | "wrap", diffusion: number, decay: number): Float64Array {
  const out = new Float64Array(grid * grid), q = diffusion / 4, keep = 1 - decay, torus = edge === "wrap";
  for (let j = 0; j < grid; j++) {
    for (let i = 0; i < grid; i++) {
      const k = j * grid + i;
      if (wall[k]) continue;
      const c = field[k];
      let flux = 0;
      const l = i > 0 ? k - 1 : torus ? k + grid - 1 : -1, r = i < grid - 1 ? k + 1 : torus ? k - grid + 1 : -1;
      const u = j > 0 ? k - grid : torus ? k + grid * (grid - 1) : -1, d = j < grid - 1 ? k + grid : torus ? k - grid * (grid - 1) : -1;
      if (l >= 0 && !wall[l]) flux += field[l] - c;
      if (r >= 0 && !wall[r]) flux += field[r] - c;
      if (u >= 0 && !wall[u]) flux += field[u] - c;
      if (d >= 0 && !wall[d]) flux += field[d] - c;
      out[k] = (c + q * flux) * keep;
    }
  }
  return out;
}

/** Wall mask of resolved barrier regions: a cell is a wall when its centre lies in (or on) a region. */
export function barrierMask(barrier: readonly PlanarRegionData[], grid: number): Uint8Array {
  const mask = new Uint8Array(grid * grid);
  if (barrier.length === 0) return mask;
  const domain = planarDomain(barrier as PlanarRegionData[], { id: "chemotaxis-barrier" });
  const cell = CHEMOTAXIS_ARENA / grid;
  for (let j = 0; j < grid; j++) for (let i = 0; i < grid; i++)
    if (domainContains(domain, (i + 0.5) * cell, (j + 0.5) * cell)) mask[j * grid + i] = 1;
  return mask;
}

/* ------------------------------------------------------------------------------------ simulation */

function birthQueue(c: ChemotaxisConstruction): { origin: Int32Array; born: Int32Array; strength: Float64Array } {
  const total = totalAgents(c), origin = new Int32Array(total);
  let n = 0;
  const most = c.emitters.reduce((m, e) => Math.max(m, e.agents), 0);
  for (let round = 0; round < most; round++) c.emitters.forEach((e, k) => { if (e.agents > round) origin[n++] = k; });
  const born = new Int32Array(total), strength = new Float64Array(total);
  for (let s = 0; s < total; s++) {
    born[s] = c.release === 0 ? 0 : 1 + Math.floor(s * c.release / total);
    strength[s] = c.emitters[origin[s]].strength;
  }
  return { origin, born, strength };
}

function bornAgent(state: State, c: ChemotaxisConstruction, ctx: SimulationContext<ChemotaxisConstruction>): void {
  const slot = state.next++, id = elementId("agent", slot), draw = ctx.stream(id, "birth");
  const e = c.emitters[state.origin[slot]];
  const around = draw.next() * TAU, radius = c.spawnRadius * Math.sqrt(draw.next()), heading = draw.next();
  let x = e.x + radius * Math.cos(around), y = e.y + radius * Math.sin(around);
  if (c.edge === "wrap") {
    x = ((x % CHEMOTAXIS_ARENA) + CHEMOTAXIS_ARENA) % CHEMOTAXIS_ARENA; y = ((y % CHEMOTAXIS_ARENA) + CHEMOTAXIS_ARENA) % CHEMOTAXIS_ARENA;
  }
  const cell = CHEMOTAXIS_ARENA / c.grid;
  const inside = x >= 0 && x < CHEMOTAXIS_ARENA && y >= 0 && y < CHEMOTAXIS_ARENA;
  if (!inside || state.wall[cellIndex(y, c.grid, cell) * c.grid + cellIndex(x, c.grid, cell)]) { x = e.x; y = e.y; }
  state.x[slot] = x; state.y[slot] = y; state.heading[slot] = heading; state.alive[slot] = 1;
}

function initial(ctx: SimulationContext<ChemotaxisConstruction>): State {
  const c = ctx.params, total = totalAgents(c);
  const wall = barrierMask(c.barrier, c.grid);
  const cell = CHEMOTAXIS_ARENA / c.grid;
  c.emitters.forEach((e, k) => {
    if (wall[cellIndex(e.y, c.grid, cell) * c.grid + cellIndex(e.x, c.grid, cell)])
      throw new Error(`Emitter ${k + 1} lies inside the barrier; move the emitters (Center X/Y, Layout radius) or the barrier`);
  });
  ctx.charge(initialWork(c));
  const queue = birthQueue(c);
  const state: State = {
    field: new Float64Array(c.grid * c.grid), wall, x: new Float64Array(total), y: new Float64Array(total), heading: new Float64Array(total),
    alive: new Uint8Array(total), origin: queue.origin, strength: queue.strength, born: queue.born, next: 0, halted: 0,
  };
  while (state.next < total && state.born[state.next] === 0) bornAgent(state, c, ctx);
  state.halted = settled(state, c) ? 1 : 0;
  return state;
}

/** True when no agent lives or will be born and nothing leaks: the field can only decay. */
function extinct(state: State, c: ChemotaxisConstruction): boolean {
  if (state.next < state.born.length) return false;
  for (let s = 0; s < state.next; s++) if (state.alive[s]) return false;
  return true;
}
const leaks = (c: ChemotaxisConstruction): boolean => c.beacon > 0 && c.emitters.some((e) => e.strength > 0);
function settled(state: State, c: ChemotaxisConstruction): boolean {
  if (!extinct(state, c) || leaks(c)) return false;
  for (let k = 0; k < state.field.length; k++) if (state.field[k] >= FIELD_EPSILON) return false;
  state.field.fill(0);
  return true;
}

function step(state: State, ctx: SimulationContext<ChemotaxisConstruction>): State {
  const c = ctx.params, k = ctx.step, grid = c.grid, cell = CHEMOTAXIS_ARENA / grid, wrap = c.edge === "wrap";
  if (state.halted) { ctx.charge(1); return state; }
  ctx.charge(chemotaxisStepWork(c));
  const total = state.born.length;
  // 0. birth
  while (state.next < total && state.born[state.next] === k) bornAgent(state, c, ctx);
  // 1. sense (reads the old field; only headings change)
  const angle = c.sensorAngle / 360, gain = c.attraction * c.turnRate / 360, noise = c.wander / 360;
  for (let s = 0; s < state.next; s++) {
    if (!state.alive[s]) continue;
    const h0 = wrap01(state.heading[s]), x = state.x[s], y = state.y[s];
    let turn = 0;
    if (gain !== 0 && c.reach > 0) {
      const a = TAU * (h0 - angle), b = TAU * (h0 + angle);
      const left = sampleField(state.field, grid, c.edge, x + c.reach * Math.cos(a), y + c.reach * Math.sin(a));
      const right = sampleField(state.field, grid, c.edge, x + c.reach * Math.cos(b), y + c.reach * Math.sin(b));
      turn = gain * (right - left) / (right + left + SENSE_FLOOR);
    }
    if (noise > 0) turn += noise * (2 * ctx.stream(elementId("agent", s), "wander").next() - 1);
    state.heading[s] = wrap01(h0 + turn);
  }
  // 2. move
  const blocked = (px: number, py: number): boolean => {
    if (px < 0 || px >= CHEMOTAXIS_ARENA || py < 0 || py >= CHEMOTAXIS_ARENA) return true;
    return state.wall[cellIndex(py, grid, cell) * grid + cellIndex(px, grid, cell)] === 1;
  };
  if (c.speed > 0) for (let s = 0; s < state.next; s++) {
    if (!state.alive[s]) continue;
    const x = state.x[s], y = state.y[s], theta = TAU * state.heading[s];
    let nx = x + c.speed * Math.cos(theta), ny = y + c.speed * Math.sin(theta);
    if (wrap) {
      nx = ((nx % CHEMOTAXIS_ARENA) + CHEMOTAXIS_ARENA) % CHEMOTAXIS_ARENA; ny = ((ny % CHEMOTAXIS_ARENA) + CHEMOTAXIS_ARENA) % CHEMOTAXIS_ARENA;
      if (nx >= CHEMOTAXIS_ARENA) nx = 0; if (ny >= CHEMOTAXIS_ARENA) ny = 0;
    }
    // A move is tested at its midpoint and its end, axis by axis, so a thin wall still stops it.
    let bx = blocked(nx, y) || blocked((x + nx) / 2, y), by = blocked(x, ny) || blocked(x, (y + ny) / 2);
    if (!bx && !by && (blocked(nx, ny) || blocked((x + nx) / 2, (y + ny) / 2))) { bx = true; by = true; }
    let h = state.heading[s];
    if (bx) { nx = x; h = 0.5 - h; }
    if (by) { ny = y; h = -h; }
    state.x[s] = nx; state.y[s] = ny; state.heading[s] = wrap01(h);
  }
  // 3. deposit: agents, then emitters
  if (c.deposit > 0) for (let s = 0; s < state.next; s++)
    if (state.alive[s]) splat(state.field, state.wall, grid, c.edge, state.x[s], state.y[s], c.deposit * state.strength[s]);
  if (c.beacon > 0) for (const e of c.emitters) if (e.strength > 0) splat(state.field, state.wall, grid, c.edge, e.x, e.y, c.beacon * e.strength);
  // 4. lifespan
  if (c.lifespan > 0) for (let s = 0; s < state.next; s++)
    if (state.alive[s] && k >= Math.max(state.born[s], 1) + c.lifespan - 1) state.alive[s] = 0;
  // 5. relax
  state.field = relaxField(state.field, state.wall, grid, c.edge, c.diffusion, c.decay);
  if (settled(state, c)) state.halted = 1;
  return state;
}

function project(state: State, stepNumber: number): ChemotaxisFrame {
  const n = state.next;
  let alive = 0, max = 0, sum = 0;
  for (let s = 0; s < n; s++) alive += state.alive[s];
  for (let k = 0; k < state.field.length; k++) { const v = state.field[k]; sum += v; if (v > max) max = v; }
  return {
    step: stepNumber, count: n, alive, halted: state.halted === 1, fieldMax: max, fieldTotal: sum,
    x: Float32Array.from(state.x.subarray(0, n)), y: Float32Array.from(state.y.subarray(0, n)),
    heading: Float32Array.from(state.heading.subarray(0, n)), live: state.alive.slice(0, n),
  };
}

export const chemotaxisSimulation: Simulation<State, ChemotaxisConstruction, ChemotaxisFrame> = {
  id: "chemotactic-trails",
  limits: (c) => ({ stepLimit: CHEMOTAXIS_LIMITS.maxSteps, workPerStep: chemotaxisStepWork(c), initialWork: initialWork(c) }),
  initial, step, project,
};

export type ChemotaxisSnapshots = Snapshots<State, ChemotaxisConstruction, ChemotaxisFrame>;

/** The shared content-keyed cache of colonies (six runs). Exposed so hosts and tests can ask `has` without running. */
export const chemotaxisCache = createSimulationCache({ capacity: 6 });
export const chemotaxisRunOptions = (steps: number, options: { cancelled?: () => boolean; run?: CompositionRun }) =>
  ({ steps, ...CHEMOTAXIS_RETENTION, maxWork: CHEMOTAXIS_LIMITS.maxWork, ...options });

/**
 * The frozen snapshots of a construction at `steps`, from the shared cache. A longer request extends a
 * cached run and a shorter one replays from its nearest checkpoint; the appearance of a drawing is never
 * part of the key, so recolouring returns the same object. Throws (naming the control) beyond the bounds.
 */
export function chemotaxisSnapshots(c: ChemotaxisConstruction, seed: number, steps: number, options: { cancelled?: () => boolean; run?: CompositionRun } = {}): ChemotaxisSnapshots {
  checkChemotaxis(c, steps);
  return chemotaxisCache.get(chemotaxisSimulation, c, seed, chemotaxisRunOptions(steps, options));
}

/** Cooperative `chemotaxisSnapshots`; false when cancelled (nothing is cached). */
export async function prepareChemotaxis(c: ChemotaxisConstruction, seed: number, steps: number, cancelled: () => boolean): Promise<boolean> {
  checkChemotaxis(c, steps);
  if (cancelled()) return false;
  const made = await chemotaxisCache.prepare(chemotaxisSimulation, c, seed, chemotaxisRunOptions(steps, { cancelled }));
  return made !== null && !cancelled();
}

/** Run outside the shared cache (tests and one-off analysis). */
export function runChemotaxis(c: ChemotaxisConstruction, seed: number, steps: number, retention: { checkpointEvery?: number; historyEvery?: number } = {}): ChemotaxisSnapshots {
  checkChemotaxis(c, steps);
  return runSimulation(chemotaxisSimulation, c, seed, { ...chemotaxisRunOptions(steps, {}), ...retention });
}

/* ------------------------------------------------------------------------------------- products */

/** The chemical at one step: an immutable view of a private copy. */
export interface ChemicalField {
  readonly step: number;
  readonly columns: number;
  readonly rows: number;
  /** Canvas units per cell. */
  readonly cell: number;
  /** Row-major; cell `(i, j)` is centred at `((i + .5) cell, (j + .5) cell)`. Read-only. */
  readonly values: Readonly<Float64Array>;
  readonly wall: Readonly<Uint8Array>;
  readonly max: number;
  readonly total: number;
}

const fieldCache = new WeakMap<ChemotaxisSnapshots, Map<string, ChemicalField>>();

/** The field after `step` steps (default the last), cached per snapshots. */
export function chemicalField(snaps: ChemotaxisSnapshots, step = snaps.steps): ChemicalField {
  return cachedBy(fieldCache, snaps, String(step), () => {
    const state = step === snaps.steps ? finalState(snaps) : stateAt(snaps, step);
    let max = 0, total = 0;
    for (const v of state.field) { total += v; if (v > max) max = v; }
    const grid = snaps.params.grid;
    return Object.freeze({ step, columns: grid, rows: grid, cell: CHEMOTAXIS_ARENA / grid, values: state.field, wall: state.wall, max, total });
  });
}

/** Ids of the agents born by `frame`, in birth order. */
export const agentId = (serial: number): string => elementId("agent", serial);

export interface ChemotaxisTrail extends Path {
  /** `agent:<serial>`. */
  readonly agent: string;
  readonly serial: number;
  /** Emitter the agent came from. */
  readonly origin: number;
  /** Step of the first point. */
  readonly from: number;
  /** Step of the last point. */
  readonly to: number;
}

export interface TrailOptions {
  /** Steps of history drawn (0: every step); the trail ends at the last step. */
  readonly memory: number;
  /** Shortest trail kept, canvas units of arc length. */
  readonly minLength: number;
}

const trailCache = new WeakMap<ChemotaxisSnapshots, Map<string, readonly ChemotaxisTrail[]>>();

const polylineLength = (points: readonly Point[]): number => {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return length;
};

/**
 * Each agent's recorded trajectory as paths (ids `trail:agent:<n>`, `#1`, `#2` ... where a torus wrap
 * cuts it). The points are the agent's positions at consecutive steps of the retained history from its
 * birth (or `steps - memory`) to its last living step plus the move that ended it; the path never
 * depends on later steps once the agent is dead. Frozen and cached per snapshots and options.
 */
export function chemotaxisTrails(snaps: ChemotaxisSnapshots, options: TrailOptions): readonly ChemotaxisTrail[] {
  finite("Trail memory", options.memory, 0, CHEMOTAXIS_LIMITS.maxSteps, true); finite("Shortest trail", options.minLength, 0, 1e5);
  return cachedBy(trailCache, snaps, `${options.memory}|${options.minLength}`, () => {
    if (snaps.historyEvery !== 1) throw new Error("Trails need a history of every step");
    const frames = snaps.history;
    const start = options.memory === 0 ? 0 : Math.max(0, snaps.steps - options.memory);
    const count = frames[frames.length - 1].value.count;
    const wrapEdge = snaps.params.edge === "wrap", half = CHEMOTAXIS_ARENA / 2;
    const trails: ChemotaxisTrail[] = [];
    for (let s = 0; s < count; s++) {
      const agent = agentId(s), origin = originOf(snaps, s);
      let piece: Point[] = [], pieceFrom = 0, pieceIndex = 0, last = start, previous: Point | null = null, ended = false;
      const flush = (to: number) => {
        if (piece.length >= 2 && polylineLength(piece) >= options.minLength) {
          const id = pieceIndex === 0 ? `trail:${agent}` : `trail:${agent}#${pieceIndex}`;
          trails.push(Object.freeze({ id, seed: componentSeed(snaps.seed, id, "trail"), points: Object.freeze(piece), closed: false, level: pieceFrom, levelFraction: 0, agent, serial: s, origin, from: pieceFrom, to }));
        }
        if (piece.length >= 2) pieceIndex++;
        piece = [];
      };
      for (const { step, value } of frames) {
        if (step < start || ended) continue;
        if (s >= value.count) continue;
        const live = value.live[s] === 1;
        if (!live && previous === null) continue;
        const p: Point = Object.freeze([value.x[s], value.y[s]] as const);
        if (previous && wrapEdge && (Math.abs(p[0] - previous[0]) > half || Math.abs(p[1] - previous[1]) > half)) { flush(last); piece = []; }
        if (piece.length === 0) pieceFrom = step;
        piece.push(p); previous = p; last = step;
        if (!live) ended = true;
      }
      flush(last);
    }
    return Object.freeze(trails);
  });
}

const originCache = new WeakMap<ChemotaxisSnapshots, Int32Array>();
function originOf(snaps: ChemotaxisSnapshots, serial: number): number {
  let origins = originCache.get(snaps);
  if (!origins) { origins = finalState(snaps).origin; originCache.set(snaps, origins); }
  return origins[serial];
}

/** An agent at the last step: a site whose angle is its heading. */
export interface ChemotaxisAgent extends Site {
  readonly agent: string;
  readonly serial: number;
  readonly origin: number;
  readonly alive: boolean;
}

const agentCache = new WeakMap<ChemotaxisSnapshots, readonly ChemotaxisAgent[]>();

/** The agents born by the last step (dead ones included, `alive` false), ascending id. */
export function chemotaxisAgents(snaps: ChemotaxisSnapshots): readonly ChemotaxisAgent[] {
  const hit = agentCache.get(snaps);
  if (hit) return hit;
  const frame = snaps.final, made: ChemotaxisAgent[] = [];
  for (let s = 0; s < frame.count; s++) {
    const id = agentId(s);
    made.push(Object.freeze({
      id, seed: componentSeed(snaps.seed, id, "agent"), position: Object.freeze([frame.x[s], frame.y[s]] as const), angle: frame.heading[s] * TAU, scale: 1,
      agent: id, serial: s, origin: originOf(snaps, s), alive: frame.live[s] === 1,
    }));
  }
  const frozen = Object.freeze(made);
  agentCache.set(snaps, frozen);
  return frozen;
}

/** Contour levels for a display: `count` values spaced geometrically from `lowest` to 0.85 of the field maximum. */
export function contourLevels(max: number, count: number, lowest: number): readonly number[] {
  finite("Contours", count, 0, 24, true); finite("Lowest contour", lowest, 1e-4, 0.85);
  if (!(max > 0) || count === 0) return [];
  return Array.from({ length: count }, (_, i) => max * (count === 1 ? lowest : lowest * (0.85 / lowest) ** (i / (count - 1))));
}

const ringCache = new WeakMap<ChemicalField, Map<string, readonly (readonly (readonly Point[])[])[]>>();

/** Closed level-set rings of `{ chemical >= level }` for each level (`iso-rings.ts`: linear crossings, linear time). Cached per field. */
export function fieldRings(field: ChemicalField, levels: readonly number[]): readonly (readonly (readonly Point[])[])[] {
  return cachedBy(ringCache, field, levels.join(","), () => {
    const iso = new IsoField({ values: field.values, columns: field.columns, rows: field.rows, x0: field.cell / 2, y0: field.cell / 2, dx: field.cell, dy: field.cell, outside: 0 });
    let budget = CHEMOTAXIS_LIMITS.maxContourVertices;
    return Object.freeze(levels.map((level) => {
      let rings: Point[][];
      try { rings = iso.rings(level, budget); } catch (error) {
        if (error instanceof Error && /exceed/.test(error.message)) throw new Error(`Contours would exceed ${CHEMOTAXIS_LIMITS.maxContourVertices} vertices; lower Contours or raise Lowest contour`);
        throw error;
      }
      for (const ring of rings) budget -= ring.length;
      return Object.freeze(rings.map((ring) => Object.freeze(ring)));
    }));
  });
}

const contourCache = new WeakMap<ChemicalField, Map<string, readonly Path[]>>();

/** Field contours as closed paths (`contour:<level index>:<ring>`), `level` the chemical value and `levelFraction` the level's rank. */
export function fieldContourPaths(field: ChemicalField, levels: readonly number[], seed: number): readonly Path[] {
  return cachedBy(contourCache, field, `${seed}|${levels.join(",")}`, () => {
    const rings = fieldRings(field, levels), out: Path[] = [];
    rings.forEach((set, i) => set.forEach((ring, r) => {
      const id = `contour:${i}:${r}`;
      out.push(Object.freeze({ id, seed: componentSeed(seed, id, "contour"), points: ring, closed: true, level: levels[i], levelFraction: levels.length > 1 ? i / (levels.length - 1) : 0 }));
    }));
    return Object.freeze(out);
  });
}

/** Filled polygons of each level (holes cut in), outermost level first. */
export function fieldBands(field: ChemicalField, levels: readonly number[]): readonly (readonly (readonly Point[])[])[] {
  return fieldRings(field, levels).map((set) => fillableRings(set));
}
