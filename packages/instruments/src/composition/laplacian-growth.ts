import { componentSeed } from "./core.js";
import { maskDomain } from "./domains-raster.js";
import { domainRings, keyholeRings } from "./domains.js";
import type { PlanarDomain } from "./domains.js";
import { CANVAS, KIND_FREE, KIND_SOURCE, KIND_WALL, checkLayoutSpec, growthLayout } from "./laplacian-layout.js";
import type { GrowthLayout, LayoutSpec } from "./laplacian-layout.js";
import { createSimulationCache, finalState } from "./snapshots.js";
import type { Simulation, SimulationCache, Snapshots } from "./snapshots.js";
import type { CompositionRun, Path, Point } from "./types.js";

/**
 * Laplacian growth fronts (brief 16): boundary conditions and a seed region -> a potential solve -> flux-driven
 * advancement of the boundary -> a retained history of fronts. A 2D model on a square grid; it is a
 * dielectric-breakdown / Hele-Shaw-like moving-boundary construction, not a physical simulation of any material.
 *
 * MODEL. `layout` (see `laplacian-layout.ts`) classifies cells (free, source, sink, wall) and gives the seed.
 * The occupied region (the growing sink) has potential 0, sources potential 1, walls and the canvas edge
 * are insulating. The potential φ solves Laplace's equation on the free, unoccupied cells (the 5-point stencil,
 * cell size h) by red-black successive over-relaxation with the optimal ω for a square, `2 / (1 + sin(π/(n+1)))`.
 * The iteration stops when the RESIDUAL, `max over solved cells of |mean of open neighbours − φ|` (in units of
 * the source potential 1), is at most `tolerance`, measured by an independent pass over the final iterate,
 * or throws when `maxIterations` sweeps (a residual pass counts as one) are not enough. Nothing is returned
 * from a solve that did not converge: the error names Solver iterations, Solver precision and Grid.
 * Every state stores its own φ (warm start for the next solve), residual, sweeps and work.
 *
 * FLUX AND SPEED. At every free unoccupied cell with an occupied 4-neighbour (the frontier) the gradient of φ is
 * estimated component by component: one-sided toward a fixed neighbour (occupied, sink or source), else central,
 * walls and the grid edge mirrored (zero flux). `|g|` is its length, `ĝ = |g| / max|g|` over the frontier, and
 * the normal front speed is `v = ĝ^η − ℓ κ`, clamped at 0, where `η` is the growth bias and `ℓ κ` the
 * regularization: `ℓ` (canvas units, "surface tension") times the curvature `κ` (1/canvas unit, positive where the
 * occupied region is convex) of the 0.5 level of the occupancy field blurred by a Gaussian of 1.25 cells.
 * `η = 0` and `ℓ = 0` give a uniform speed: the front is an offset of the seed, which is what Laplacian growth
 * is distinguished from. `ĝ < 1e-6` counts as no flux (a cell screened by the fronts around it does not move).
 * A frontier cell's rate is `v · w · mobility` with `w = |g| / max(|gx|, |gy|)` in [1, √2], which corrects the
 * staircase's excess boundary length per cell for oblique fronts.
 *
 * ADVANCEMENT. Each step, the fastest cell advances by `stepScale` cell widths: every frontier cell's fill
 * increases by `stepScale · rate / max rate` (fills are areas in cell units) and the normalized time advances by
 * `dt = stepScale · h / max rate` (canvas units travelled by a unit-speed front). A cell with fill 1 or more
 * becomes occupied (potential 0, age = the step), and its excess fill is shared equally between its free, unoccupied
 * 4-neighbours, in ascending cell id, until no cell is full, so the area added equals the flux integrated (nothing
 * is dropped; excess with nowhere to go is reported as `lost`). Then φ is solved again on the new region. The
 * update order is therefore: rates from the state, fill, occupy in ascending id, solve, rates.
 *
 * FRONT. The front of a state is the 0.5 level, by marching squares (`maskDomain` in contour mode: exact
 * predicates, topology safe, merges and pockets stay valid closed rings) of the field
 * `F = 1` on occupied cells, `f(m)` on frontier cells with fill `m`, and 0 elsewhere, where
 * `f(m) = m / (0.5 + m)` for `m < 0.5` and `0.5 / (1.5 − m)` otherwise. `f` is chosen so that the interpolated
 * crossing lies `(0.5 + m) h` from the occupied neighbour's centre, i.e. the front moves continuously with the
 * fill and the enclosed area follows the accumulated fill. The contour is closed along the canvas edge; the
 * segments that lie ON the canvas edge are not fronts and are removed by `frontPaths`, so a front that meets an
 * insulating edge is an open chain and every other front is a closed loop. Occupied outer rings have positive
 * shoelace area (region on the left), pockets negative.
 *
 * TERMINATION. Growth stops, and the state is marked stopped at that step, when the front REACHES a source (a newly occupied
 * cell has a source 4-neighbour: the circuit is closed and nothing more can be said by this model), when the frontier is empty
 * (`exhausted`), or when every rate is 0 (`stalled`: no flux, or surface tension exceeds the flux everywhere). Later steps
 * are recorded as unchanged and their frames carry no rings (`stopStep` is the last step whose front differs).
 *
 * IDENTITY. Cells: their grid id `j·n + i`. Fronts: `front:<step>/<k>` with rings in domain order (outer ring then
 * its pockets, regions in the order `maskDomain` reports, which is deterministic). Seeds: the structural seed
 * enters only through `growthLayout` (cluster centres, pillars, wall gap phase, per-cell mobility) via `componentSeed`.
 *
 * BOUNDS. Grid 24..256; steps <= 2000; sweeps per solve <= `maxIterations` (<= 5000). Declared work per step is
 * `grid² (maxIterations + 30)` cell updates (initial: `grid² (4 maxIterations + 30)`); the preflight `checkGrowthWork`
 * throws naming Steps, Grid and Solver iterations when the total exceeds `MAX_GROWTH_WORK`. History and checkpoint
 * values are bounded by the snapshot runner; the messages name the retention arguments and are rethrown here naming Steps and Grid.
 */

export interface PhysicsSpec {
  /** Growth bias η >= 0: front speed proportional to (normalized flux)^η. */
  eta: number;
  /** Surface tension (capillary length) ℓ, canvas units >= 0. */
  tension: number;
  /** Cell widths the fastest front cell advances per step, in (0, 1]. */
  stepScale: number;
  /** Residual tolerance of every solve, in units of the source potential. */
  tolerance: number;
  /** Most sweeps of one solve. */
  maxIterations: number;
}
export type GrowthSpec = LayoutSpec & PhysicsSpec;
export const physicsKeys = ["eta", "tension", "stepScale", "tolerance", "maxIterations"] as const;

export const GROWTH_STEP_LIMIT = 2000;
export const MAX_ITERATIONS = 5000;
/** Total declared cell updates one run may need; measured on the development machine (see the brief document). */
export const MAX_GROWTH_WORK = 4_000_000_000;
export const CHECKPOINT_EVERY = 25;
const MAX_HISTORY_VALUES = 16_000_000;
const MAX_CHECKPOINT_VALUES = 6_000_000;
const MIN_FLUX = 1e-6;
const BLUR_SIGMA = 1.25;

/** The reason growth stopped. */
export type StopReason = "running" | "exhausted" | "stalled" | "reached";
const REASONS: readonly StopReason[] = ["running", "exhausted", "stalled", "reached"];

export interface GrowthState {
  /** Fill per cell: 1 where occupied, in (0, 1) on the frontier, else 0. */
  fill: Float32Array;
  /** Step at which the cell was occupied (0 for the seed), -1 while it is not. */
  age: Int16Array;
  /** Potential of this occupancy (sources 1, occupied and sink cells 0). Walls hold 0 and are not solved. */
  phi: Float64Array;
  /** Rate of every frontier cell (1 = the largest possible speed before disorder), else 0. */
  rate: Float32Array;
  time: number; dt: number;
  cells: number; area: number;
  /** Residual and sweeps of the solve that produced `phi`, and the work of that solve. */
  residual: number; iterations: number;
  rateMax: number; frontier: number;
  /** 0 running, 1 exhausted, 2 stalled, 3 reached a source. */
  stopped: number; stopStep: number;
  lost: number;
}

/** What each retained step publishes: plain data, frozen by the runner. Points are canvas units. */
export interface FrontFrame {
  step: number;
  time: number; dt: number;
  cells: number;
  /** Canvas units squared enclosed: cell area times the total fill. */
  area: number;
  frontier: number;
  residual: number; iterations: number;
  /** 0 running, 1 exhausted, 2 stalled, 3 reached a source. */
  stopped: number;
  /** The step whose state first had no growth possible (-1 while growth runs). */
  stopStep: number;
  /** True when this step's front equals `stopStep`'s (growth had ended): `rings` is then empty. */
  repeat: boolean;
  /** x, y interleaved. */
  points: Float32Array;
  /** Ring `k` is `points[2 offsets[k] .. 2 offsets[k+1])`; offsets has one more entry than there are rings. */
  offsets: Int32Array;
}

/* ----------------------------------------------------------------------------------- the solve */

export interface SolveReport { residual: number; iterations: number; work: number; converged: boolean }

/**
 * Spectral radius ρ of the Jacobi iteration on the current geometry, estimated by power iteration on a coarsened grid
 * (blocks of s × s cells; a block is fixed if it holds any fixed cell, else unknown if it holds an unknown cell, else a wall)
 * and scaled back by `1 − (1 − ρc) / s²`. ω depends on it: an insulating edge or a single
 * source side makes the domain effectively larger than the square the textbook `cos(π/(n+1))` assumes.
 * An underestimate only lowers ω a little; the residual pass, not this estimate, decides convergence.
 */
export function jacobiRadius(layout: GrowthLayout, fill: Readonly<Float32Array>): number {
  const { n, kind, open } = layout;
  const s = Math.max(1, Math.floor(n / 32)), m = Math.ceil(n / s);
  const status = new Uint8Array(m * m); // 0 wall, 1 fixed, 2 unknown
  for (let J = 0; J < m; J++) for (let I = 0; I < m; I++) {
    let fixed = false, unknownCell = false;
    for (let j = J * s; j < Math.min(n, (J + 1) * s); j++) for (let i = I * s; i < Math.min(n, (I + 1) * s); i++) {
      const c = j * n + i;
      if (kind[c] === KIND_WALL) continue;
      if (kind[c] === KIND_FREE && fill[c] < 1 && open[c] > 0) unknownCell = true; else fixed = true;
    }
    status[J * m + I] = fixed ? 1 : unknownCell ? 2 : 0;
  }
  // The Jacobi matrix is similar to the symmetric S = D^-1/2 N D^-1/2 (N the unknown-to-unknown adjacency, D the open-neighbour
  // degrees), for which the power-iteration ratio rises to the spectral radius from below.
  const degree = new Float64Array(m * m);
  for (let J = 0; J < m; J++) for (let I = 0; I < m; I++) {
    const c = J * m + I;
    if (status[c] !== 2) continue;
    let k = 0;
    if (J > 0 && status[c - m] !== 0) k++; if (J < m - 1 && status[c + m] !== 0) k++; if (I > 0 && status[c - 1] !== 0) k++; if (I < m - 1 && status[c + 1] !== 0) k++;
    degree[c] = Math.sqrt(Math.max(k, 1));
  }
  let v = new Float64Array(m * m), w = new Float64Array(m * m), unknown = 0;
  for (let c = 0; c < m * m; c++) if (status[c] === 2) { v[c] = 1; unknown++; }
  if (unknown === 0) return 0;
  let ratio = 0;
  for (let iteration = 0; iteration < 200; iteration++) {
    let before = 0, after = 0;
    for (let J = 0; J < m; J++) for (let I = 0; I < m; I++) {
      const c = J * m + I;
      if (status[c] !== 2) continue;
      let sum = 0;
      if (J > 0 && status[c - m] === 2) sum += v[c - m] / degree[c - m];
      if (J < m - 1 && status[c + m] === 2) sum += v[c + m] / degree[c + m];
      if (I > 0 && status[c - 1] === 2) sum += v[c - 1] / degree[c - 1];
      if (I < m - 1 && status[c + 1] === 2) sum += v[c + 1] / degree[c + 1];
      w[c] = sum / degree[c];
      before += v[c] * v[c]; after += w[c] * w[c];
    }
    if (!(after > 0) || !(before > 0)) break;
    ratio = Math.sqrt(after / before);
    const scale = 1 / Math.sqrt(after);
    for (let c = 0; c < m * m; c++) w[c] *= scale;
    [v, w] = [w, v];
  }
  const fine = 1 - (1 - ratio) / (s * s);
  return Math.min(Math.max(fine, 0), 1 - 1e-6);
}

/**
 * Relax `phi` in place toward the solution of Laplace's equation on the free cells that are not occupied
 * (`fill < 1`), holding sources at 1 and occupied and sink cells at 0 (their entries in `phi` must already hold those values).
 * Red-black SOR with Chebyshev acceleration of ω (ω = 1, then `1 / (1 - ρ² ω / 4)` after every half sweep, converging to the
 * optimal ω for the geometry's Jacobi radius ρ, see `jacobiRadius`). `work` counts cell updates (a residual pass counts like a sweep).
 */
export function solvePotential(layout: GrowthLayout, phi: Float64Array, fill: Readonly<Float32Array>, tolerance: number, maxIterations: number): SolveReport {
  const { n, kind, open, neighbours } = layout, cells = n * n;
  // Per colour, cells with four open neighbours use index arithmetic; the rest (walls, the grid edge) use the neighbour table.
  const lists = [new Int32Array(cells), new Int32Array(cells), new Int32Array(cells), new Int32Array(cells)];
  const counts = [0, 0, 0, 0];
  for (let c = 0; c < cells; c++) {
    if (kind[c] !== KIND_FREE || fill[c] >= 1 || open[c] === 0) continue;
    const slot = ((c % n) + Math.floor(c / n)) & 1 ? 2 : 0;
    const which = slot + (open[c] === 4 ? 0 : 1);
    lists[which][counts[which]++] = c;
  }
  const unknown = counts[0] + counts[1] + counts[2] + counts[3];
  if (unknown === 0) return { residual: 0, iterations: 0, work: 0, converged: true };
  const rho = jacobiRadius(layout, fill), rho2 = rho * rho;
  const half = (colour: number, omega: number): number => {
    let largest = 0;
    const inner = lists[2 * colour], rim = lists[2 * colour + 1], innerCount = counts[2 * colour], rimCount = counts[2 * colour + 1];
    for (let k = 0; k < innerCount; k++) {
      const c = inner[k];
      const r = 0.25 * (phi[c - n] + phi[c + n] + phi[c - 1] + phi[c + 1]) - phi[c];
      const a = r < 0 ? -r : r;
      if (a > largest) largest = a;
      phi[c] += omega * r;
    }
    for (let k = 0; k < rimCount; k++) {
      const c = rim[k], b = 4 * c;
      const r = 0.25 * (phi[neighbours[b]] + phi[neighbours[b + 1]] + phi[neighbours[b + 2]] + phi[neighbours[b + 3]]) - phi[c];
      const a = r < 0 ? -r : r;
      if (a > largest) largest = a;
      phi[c] += omega * r;
    }
    return largest;
  };
  const residualPass = (): number => {
    let largest = 0;
    for (let which = 0; which < 4; which++) for (let k = 0; k < counts[which]; k++) {
      const c = lists[which][k], b = 4 * c, m = open[c];
      const sum = phi[neighbours[b]] + phi[neighbours[b + 1]] + phi[neighbours[b + 2]] + phi[neighbours[b + 3]] - (4 - m) * phi[c];
      const a = Math.abs(sum / m - phi[c]);
      if (!(a <= largest)) largest = a; // NaN propagates: a poisoned iterate can never report convergence
    }
    return largest;
  };
  let iterations = 0, nextCheck = 0, residual = Infinity, omega = 1, halves = 0;
  while (iterations < maxIterations) {
    let estimate = 0;
    for (let colour = 0; colour < 2; colour++) {
      estimate = Math.max(estimate, half(colour, omega));
      omega = halves === 0 ? 1 / (1 - rho2 / 2) : 1 / (1 - rho2 * omega / 4);
      halves++;
    }
    iterations++;
    if (estimate <= tolerance && iterations >= nextCheck && iterations < maxIterations) {
      residual = residualPass();
      iterations++;
      if (residual <= tolerance) return { residual, iterations, work: iterations * unknown, converged: true };
      nextCheck = iterations + 8;
    }
  }
  residual = residualPass();
  return { residual, iterations, work: (iterations + 1) * unknown, converged: residual <= tolerance };
}

/* ----------------------------------------------------------------------------- rates and advance */

/** The field whose 0.5 level is the front: see the header. */
export function coverage(fill: number): number {
  if (fill >= 1) return 1;
  if (fill <= 0) return 0;
  return fill < 0.5 ? fill / (0.5 + fill) : 0.5 / (1.5 - fill);
}

function frontField(fill: Readonly<Float32Array>): Float32Array {
  const out = new Float32Array(fill.length);
  for (let c = 0; c < fill.length; c++) out[c] = coverage(fill[c]);
  return out;
}

const GAUSS = (() => {
  const radius = Math.ceil(3 * BLUR_SIGMA), weights: number[] = [];
  let sum = 0;
  for (let k = -radius; k <= radius; k++) { const w = Math.exp(-(k * k) / (2 * BLUR_SIGMA * BLUR_SIGMA)); weights.push(w); sum += w; }
  return { radius, weights: weights.map((w) => w / sum) };
})();

function blur(values: Float32Array, n: number): Float32Array {
  const { radius, weights } = GAUSS, mid = new Float32Array(values.length), out = new Float32Array(values.length);
  const clamp = (v: number): number => (v < 0 ? 0 : v > n - 1 ? n - 1 : v);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -radius; k <= radius; k++) s += weights[k + radius] * values[j * n + clamp(i + k)];
    mid[j * n + i] = s;
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -radius; k <= radius; k++) s += weights[k + radius] * mid[clamp(j + k) * n + i];
    out[j * n + i] = s;
  }
  return out;
}

export interface RateReport { rate: Float32Array; max: number; frontier: number; work: number }

/** Rates of every frontier cell for an occupancy and its potential (see the header). `frontier` counts cells with an occupied neighbour. */
export function frontRates(layout: GrowthLayout, spec: PhysicsSpec, fill: Readonly<Float32Array>, phi: Readonly<Float64Array>): RateReport {
  const { n, kind, neighbours, cell, mobility } = layout, cells = n * n;
  const rate = new Float32Array(cells), gradient = new Float64Array(cells), weight = new Float64Array(cells);
  const listed: number[] = [];
  const fixed = (k: number): boolean => kind[k] !== KIND_FREE || fill[k] >= 1;
  let gmax = 0;
  for (let c = 0; c < cells; c++) {
    if (kind[c] !== KIND_FREE || fill[c] >= 1) continue;
    const b = 4 * c;
    const north = neighbours[b], south = neighbours[b + 1], west = neighbours[b + 2], east = neighbours[b + 3];
    const cluster = (k: number): boolean => k !== c && kind[k] === KIND_FREE && fill[k] >= 1;
    if (!(cluster(north) || cluster(south) || cluster(west) || cluster(east))) continue;
    const here = phi[c];
    const axis = (a: number, z: number): number => {
      const fa = fixed(a) && a !== c, fz = fixed(z) && z !== c;
      if (fa && fz) return Math.max(Math.abs(here - phi[a]), Math.abs(here - phi[z])) / cell;
      if (fa) return Math.abs(here - phi[a]) / cell;
      if (fz) return Math.abs(here - phi[z]) / cell;
      return Math.abs(phi[a] - phi[z]) / (2 * cell);
    };
    const gy = axis(north, south), gx = axis(west, east), g = Math.hypot(gx, gy);
    gradient[c] = g;
    weight[c] = g > 0 ? g / Math.max(gx, gy) : 1;
    if (g > gmax) gmax = g;
    listed.push(c);
  }
  let work = cells;
  const tension = spec.tension > 0;
  let smooth: Float32Array | null = null;
  if (tension && listed.length > 0) { smooth = blur(frontField(fill), n); work += 16 * cells; }
  let max = 0;
  const kappa = (c: number): number => {
    const i = c % n, j = (c - i) / n, at = (ii: number, jj: number): number => smooth![Math.min(n - 1, Math.max(0, jj)) * n + Math.min(n - 1, Math.max(0, ii))];
    const sx = (at(i + 1, j) - at(i - 1, j)) / 2, sy = (at(i, j + 1) - at(i, j - 1)) / 2;
    const magnitude = Math.hypot(sx, sy);
    if (magnitude < 1e-6) return 0;
    const centre = at(i, j);
    const sxx = at(i + 1, j) - 2 * centre + at(i - 1, j), syy = at(i, j + 1) - 2 * centre + at(i, j - 1);
    const sxy = (at(i + 1, j + 1) - at(i - 1, j + 1) - at(i + 1, j - 1) + at(i - 1, j - 1)) / 4;
    return -(sxx * sy * sy - 2 * sxy * sx * sy + syy * sx * sx) / (magnitude * magnitude * magnitude) / cell;
  };
  for (const c of listed) {
    const ghat = gmax > 0 ? gradient[c] / gmax : 0;
    let v = ghat < MIN_FLUX ? 0 : ghat ** spec.eta;
    if (tension && v > 0) v -= spec.tension * kappa(c);
    if (v <= 0) continue;
    const r = v * weight[c] * (mobility ? mobility[c] : 1);
    rate[c] = r;
    if (r > max) max = r;
  }
  return { rate, max, frontier: listed.length, work };
}

/* ----------------------------------------------------------------------------------- simulation */

function touchesSource(layout: GrowthLayout, c: number): boolean {
  for (let slot = 0; slot < 4; slot++) if (layout.kind[layout.neighbours[4 * c + slot]] === KIND_SOURCE) return true;
  return false;
}

function reasonOf(frontier: number, max: number): number {
  if (frontier === 0) return 1;
  return max > 0 ? 0 : 2;
}

function totals(layout: GrowthLayout, fill: Readonly<Float32Array>): { cells: number; area: number } {
  let cells = 0, total = 0;
  for (let c = 0; c < fill.length; c++) { if (fill[c] >= 1) cells++; total += Math.min(fill[c], 1); }
  return { cells, area: total * layout.cell * layout.cell };
}

function solveOrThrow(layout: GrowthLayout, spec: GrowthSpec, phi: Float64Array, fill: Float32Array, budget: number, step: number): SolveReport {
  const report = solvePotential(layout, phi, fill, spec.tolerance, budget);
  if (!report.converged)
    throw new Error(`The potential solve at step ${step} reached residual ${report.residual.toExponential(2)} after ${report.iterations} sweeps, above the tolerance ${spec.tolerance.toExponential(0)}: raise Solver iterations, lower Solver precision or lower Grid`);
  return report;
}

function withRates(layout: GrowthLayout, spec: GrowthSpec, state: GrowthState, step: number, ctx: { charge(units: number): void }): void {
  const report = frontRates(layout, spec, state.fill, state.phi);
  ctx.charge(report.work);
  state.rate = report.rate; state.rateMax = report.max; state.frontier = report.frontier;
  const stopped = reasonOf(report.frontier, report.max);
  if (stopped !== 0) { state.stopped = stopped; state.stopStep = step; }
}

export function growthLimits(spec: GrowthSpec): { stepLimit: number; workPerStep: number; initialWork: number } {
  const cells = spec.grid * spec.grid;
  return { stepLimit: GROWTH_STEP_LIMIT, workPerStep: cells * (spec.maxIterations + 30), initialWork: cells * (4 * spec.maxIterations + 30) };
}

export const growthSimulation: Simulation<GrowthState, GrowthSpec, FrontFrame> = {
  id: "laplacian-growth",
  limits: (spec) => growthLimits(spec),
  initial(ctx) {
    const spec = ctx.params as GrowthSpec, layout = growthLayout(spec, ctx.seed), cells = layout.n * layout.n;
    const fill = new Float32Array(cells), age = new Int16Array(cells).fill(-1), phi = new Float64Array(cells);
    for (let c = 0; c < cells; c++) {
      if (layout.seedCells[c]) { fill[c] = 1; age[c] = 0; }
      else if (layout.kind[c] === KIND_SOURCE || layout.kind[c] === KIND_FREE) phi[c] = 1;
    }
    const report = solveOrThrow(layout, spec, phi, fill, 4 * spec.maxIterations, 0);
    ctx.charge(report.work);
    const { cells: occupied, area } = totals(layout, fill);
    const state: GrowthState = { fill, age, phi, rate: new Float32Array(cells), time: 0, dt: 0, cells: occupied, area, residual: report.residual,
      iterations: report.iterations, rateMax: 0, frontier: 0, stopped: 0, stopStep: -1, lost: 0 };
    withRates(layout, spec, state, 0, ctx);
    for (let c = 0; c < cells; c++) if (layout.seedCells[c] && touchesSource(layout, c)) { state.stopped = 3; state.stopStep = 0; break; }
    return state;
  },
  step(state, ctx) {
    const spec = ctx.params as GrowthSpec, layout = growthLayout(spec, ctx.seed);
    ctx.charge(1);
    if (state.stopped !== 0) return state;
    const { n, cell, kind, neighbours } = layout, cells = n * n;
    const { fill, age, phi, rate } = state;
    const scale = spec.stepScale / state.rateMax;
    const full: number[] = [];
    for (let c = 0; c < cells; c++) {
      if (rate[c] <= 0) continue;
      fill[c] += scale * rate[c];
      if (fill[c] >= 1) full.push(c);
    }
    ctx.charge(cells);
    // Occupy in ascending id per round; excess fill is shared among free, unoccupied neighbours (which join the next round when full).
    let round = full, lost = state.lost, touched = false;
    while (round.length > 0) {
      round.sort((a, b) => a - b);
      const next: number[] = [];
      for (const c of round) {
        if (age[c] >= 0) continue;
        age[c] = ctx.step; phi[c] = 0;
        if (touchesSource(layout, c)) touched = true;
        const excess = fill[c] - 1;
        fill[c] = 1;
        if (excess <= 0) continue;
        const targets: number[] = [];
        for (let slot = 0; slot < 4; slot++) {
          const k = neighbours[4 * c + slot];
          if (k !== c && kind[k] === KIND_FREE && age[k] < 0) targets.push(k);
        }
        if (targets.length === 0) { lost += excess; continue; }
        const share = excess / targets.length;
        for (const k of targets) { fill[k] += share; if (fill[k] >= 1) next.push(k); }
      }
      ctx.charge(4 * round.length);
      round = next;
    }
    state.lost = lost;
    state.dt = spec.stepScale * cell / state.rateMax;
    state.time += state.dt;
    const t = totals(layout, fill);
    state.cells = t.cells; state.area = t.area;
    ctx.charge(cells);
    const report = solveOrThrow(layout, spec, phi, fill, spec.maxIterations, ctx.step);
    ctx.charge(report.work);
    state.residual = report.residual; state.iterations = report.iterations;
    withRates(layout, spec, state, ctx.step, ctx);
    if (touched) { state.stopped = 3; state.stopStep = ctx.step; }
    return state;
  },
  project(state, step): FrontFrame {
    const base = { step, time: state.time, dt: state.dt, cells: state.cells, area: state.area, frontier: state.frontier,
      residual: state.residual, iterations: state.iterations, stopped: state.stopped, stopStep: state.stopStep };
    if (state.stopped !== 0 && step > state.stopStep)
      return { ...base, repeat: true, points: new Float32Array(0), offsets: new Int32Array(1) };
    const rings = frontRings(state.fill);
    return { ...base, repeat: false, ...rings };
  },
};

/** Rings (outer then pockets, region by region) of the 0.5 level of the front field of an occupancy, as flat typed arrays; the grid is square. */
export function frontRings(fill: Readonly<Float32Array>): { points: Float32Array; offsets: Int32Array } {
  const n = Math.round(Math.sqrt(fill.length));
  const domain = maskDomain({ width: n, height: n, data: frontField(fill) }, { mode: "contour", threshold: 0.5, cell: CANVAS / n, id: "front" });
  return packRings(domainRings(domain));
}

function packRings(rings: readonly (readonly Point[])[]): { points: Float32Array; offsets: Int32Array } {
  let total = 0;
  for (const ring of rings) total += ring.length;
  const points = new Float32Array(2 * total), offsets = new Int32Array(rings.length + 1);
  let at = 0;
  rings.forEach((ring, k) => { for (const p of ring) { points[2 * at] = p[0]; points[2 * at + 1] = p[1]; at++; } offsets[k + 1] = at; });
  return { points, offsets };
}

/* ------------------------------------------------------------------------------------ producers */

export type GrowthSnapshots = Snapshots<GrowthState, GrowthSpec, FrontFrame>;

const cache: SimulationCache = createSimulationCache({ capacity: 6, maxStoredValues: 14_000_000 });

function number(label: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be a number from ${min} to ${max}`);
}

/** Validate the whole construction and the declared work of `steps` steps; every message names the control to change. */
export function checkGrowthSpec(spec: GrowthSpec, steps: number): void {
  checkLayoutSpec(spec);
  number("Growth bias", spec.eta, 0, 8);
  number("Surface tension", spec.tension, 0, 4 * CANVAS);
  number("Step size", spec.stepScale, 0.02, 1);
  number("Solver precision", spec.tolerance, 1e-12, 1e-2);
  if (!Number.isInteger(spec.maxIterations) || spec.maxIterations < 10 || spec.maxIterations > MAX_ITERATIONS) throw new Error(`Solver iterations must be an integer from 10 to ${MAX_ITERATIONS}`);
  if (!Number.isInteger(steps) || steps < 0 || steps > GROWTH_STEP_LIMIT) throw new Error(`Steps must be an integer from 0 to ${GROWTH_STEP_LIMIT}`);
  const limits = growthLimits(spec), declared = limits.initialWork + steps * limits.workPerStep;
  if (declared > MAX_GROWTH_WORK)
    throw new Error(`Steps ${steps} × Grid ${spec.grid}² × Solver iterations ${spec.maxIterations} declare ${Math.round(declared / 1e6)} million cell updates; the limit is ${MAX_GROWTH_WORK / 1e6} million. Lower Steps, Grid or Solver iterations`);
}

const runOptions = (steps: number) => ({ steps, checkpointEvery: CHECKPOINT_EVERY, historyEvery: 1, maxWork: MAX_GROWTH_WORK,
  maxHistoryValues: MAX_HISTORY_VALUES, maxCheckpointValues: MAX_CHECKPOINT_VALUES });

function named(error: unknown): never {
  if (error instanceof Error && /(history|checkpoints) hold/.test(error.message))
    throw new Error(`The retained fronts and checkpoints exceed their memory bound (${error.message}). Lower Steps or Grid`);
  throw error;
}

/** The retained run of a construction: cached by content (appearance never enters), extended or replayed from the cached run of the same construction. */
export function growthSnapshots(spec: GrowthSpec, seed: number, steps: number, options: { run?: CompositionRun; cancelled?: () => boolean } = {}): GrowthSnapshots {
  checkGrowthSpec(spec, steps);
  try { return cache.get(growthSimulation, spec, seed, { ...runOptions(steps), ...options }); } catch (error) { return named(error); }
}

/** Cooperative `growthSnapshots`: time-sliced, resolves null when cancelled and caches nothing then. */
export async function prepareGrowth(spec: GrowthSpec, seed: number, steps: number, cancelled: () => boolean): Promise<GrowthSnapshots | null> {
  checkGrowthSpec(spec, steps);
  try { return await cache.prepare(growthSimulation, spec, seed, { ...runOptions(steps), cancelled }); } catch (error) { return named(error); }
}

/** True when this exact construction is already retained. */
export function growthCached(spec: GrowthSpec, seed: number, steps: number): boolean {
  return cache.has(growthSimulation, spec, seed, runOptions(steps));
}

/** The step of the last front that differs from its predecessor: `steps` while growth runs, the stopping step once it has ended. */
export function lastActiveStep(snaps: GrowthSnapshots): number {
  const stop = snaps.final.stopStep;
  return snaps.final.stopped !== 0 && stop >= 0 ? Math.min(stop, snaps.steps) : snaps.steps;
}

export interface GrowthDiagnostics {
  readonly steps: number;
  readonly lastActiveStep: number;
  readonly stopped: StopReason;
  readonly cells: number;
  /** Canvas units squared. */
  readonly area: number;
  /** Normalized time: canvas units travelled by a unit-speed front. */
  readonly time: number;
  /** Largest residual of any solve of the run (the tolerance bounds it), and the sweeps of the most and of all solves. */
  readonly residualMax: number;
  readonly iterationsMax: number;
  readonly iterationsTotal: number;
  /** Declared-unit work actually charged (cell updates). */
  readonly work: number;
}

const diagnostics = new WeakMap<object, GrowthDiagnostics>();

export function growthDiagnostics(snaps: GrowthSnapshots): GrowthDiagnostics {
  const hit = diagnostics.get(snaps);
  if (hit) return hit;
  let residualMax = 0, iterationsMax = 0, iterationsTotal = 0;
  for (const { value } of snaps.history) {
    if (value.residual > residualMax) residualMax = value.residual;
    if (value.iterations > iterationsMax) iterationsMax = value.iterations;
    iterationsTotal += value.iterations;
  }
  const last = snaps.final;
  const made = Object.freeze({ steps: snaps.steps, lastActiveStep: lastActiveStep(snaps), stopped: REASONS[last.stopped], cells: last.cells,
    area: last.area, time: last.time, residualMax, iterationsMax, iterationsTotal, work: snaps.work });
  diagnostics.set(snaps, made);
  return made;
}

/**
 * Rings of one frame as frozen paths: closed loops, or open chains where the contour ran along the canvas edge (those
 * segments are the edge of the picture, not a front). Ids `<idPrefix>/<ring>` (`<ring>.<chain>` when a ring was cut).
 */
export function ringPaths(points: Readonly<Float32Array>, offsets: Readonly<Int32Array>, idPrefix: string, seed: number, level: number, levelFraction: number): Path[] {
  const edge = 1e-3, paths: Path[] = [];
  const on = (a: number, b: number, k: number): boolean =>
    (Math.abs(points[2 * a + k]) < edge && Math.abs(points[2 * b + k]) < edge) || (Math.abs(points[2 * a + k] - CANVAS) < edge && Math.abs(points[2 * b + k] - CANVAS) < edge);
  const emit = (id: string, chain: Point[], closed: boolean): void => {
    paths.push(Object.freeze({ id, seed: componentSeed(seed, id, "path"), points: Object.freeze(chain), closed, level, levelFraction }));
  };
  for (let r = 0; r + 1 < offsets.length; r++) {
    const from = offsets[r], count = offsets[r + 1] - from;
    if (count < 2) continue;
    const point = (i: number): Point => { const k = from + (i % count); return Object.freeze([points[2 * k], points[2 * k + 1]] as const); };
    const border = Array.from({ length: count }, (_, i) => on(from + i, from + (i + 1) % count, 0) || on(from + i, from + (i + 1) % count, 1));
    const first = border.indexOf(true);
    if (first < 0) { emit(`${idPrefix}/${r}`, Array.from({ length: count }, (_, i) => point(i)), true); continue; }
    let chains = 0;
    for (let i = 1; i <= count;) {
      if (border[(first + i) % count]) { i++; continue; }
      const chain = [point(first + i)];
      while (i <= count && !border[(first + i) % count]) { chain.push(point(first + i + 1)); i++; }
      if (chain.length >= 2) emit(`${idPrefix}/${r}.${chains++}`, chain, false);
    }
  }
  return paths;
}

const pathCache = new WeakMap<object, Map<number, readonly Path[]>>();

/** The front after `step` steps as frozen paths (step is clamped to the last active step, where growth had ended). Cached per run. */
export function frontPaths(snaps: GrowthSnapshots, step: number): readonly Path[] {
  if (!Number.isInteger(step) || step < 0 || step > snaps.steps) throw new Error(`Front step must be an integer from 0 to ${snaps.steps}`);
  const at = Math.min(step, lastActiveStep(snaps));
  let byStep = pathCache.get(snaps);
  if (!byStep) { byStep = new Map(); pathCache.set(snaps, byStep); }
  const hit = byStep.get(at);
  if (hit) return hit;
  const frame = snaps.history.find((entry) => entry.step === at)!.value;
  const last = lastActiveStep(snaps);
  const made = Object.freeze(ringPaths(frame.points, frame.offsets, `front:${at}`, snaps.seed, at, last > 0 ? at / last : 0));
  byStep.set(at, made);
  return made;
}

const regionCache = new WeakMap<object, PlanarDomain>();

/** The occupied region of the final step: a planar domain with its pockets as holes (contour of the same front field). Cached per run. */
export function occupiedRegion(snaps: GrowthSnapshots): PlanarDomain {
  const hit = regionCache.get(snaps);
  if (hit) return hit;
  const state = finalState(snaps), n = Math.round(Math.sqrt(state.fill.length));
  const made = maskDomain({ width: n, height: n, data: frontField(state.fill) }, { mode: "contour", threshold: 0.5, cell: CANVAS / n, id: "occupied" });
  regionCache.set(snaps, made);
  return made;
}

/** Keyhole-joined outlines of one retained front (each outer ring bridged to its pockets), for polygon fills. */
export function frontOutlines(snaps: GrowthSnapshots, step: number): readonly (readonly Point[])[] {
  const at = Math.min(step, lastActiveStep(snaps));
  const frame = snaps.history.find((entry) => entry.step === at)!.value;
  const rings: Point[][] = [];
  for (let r = 0; r + 1 < frame.offsets.length; r++) {
    const ring: Point[] = [];
    for (let k = frame.offsets[r]; k < frame.offsets[r + 1]; k++) ring.push([frame.points[2 * k], frame.points[2 * k + 1]]);
    rings.push(ring);
  }
  return keyholeRings(rings);
}

export interface PotentialField {
  readonly n: number;
  readonly cell: number;
  /** Row-major potential at cell centres, sources 1, occupied and sink cells 0; wall cells hold the mean of their open neighbours. */
  readonly values: Readonly<Float32Array>;
  readonly residual: number;
  readonly iterations: number;
}
const potentialCache = new WeakMap<object, PotentialField>();

/** The scalar potential of the final occupancy. Cached per run. */
export function potentialField(snaps: GrowthSnapshots): PotentialField {
  const hit = potentialCache.get(snaps);
  if (hit) return hit;
  const state = finalState(snaps), n = Math.round(Math.sqrt(state.phi.length));
  const layout = growthLayout(snaps.params as GrowthSpec, snaps.seed);
  const values = Float32Array.from(state.phi);
  for (let c = 0; c < values.length; c++) {
    if (layout.kind[c] !== KIND_WALL) continue;
    let sum = 0, count = 0;
    for (let slot = 0; slot < 4; slot++) {
      const k = c + [-n, n, -1, 1][slot];
      if (k >= 0 && k < values.length && layout.kind[k] !== KIND_WALL && Math.abs((k % n) - (c % n)) <= 1) { sum += state.phi[k]; count++; }
    }
    values[c] = count > 0 ? sum / count : 1;
  }
  const made = Object.freeze({ n, cell: CANVAS / n, values, residual: state.residual, iterations: state.iterations });
  potentialCache.set(snaps, made);
  return made;
}

const equipotentialCache = new WeakMap<object, Map<string, readonly Path[]>>();

/** Lines of equal potential `levels` (each in (0, 1)) of the final occupancy around the occupied region, with the ring conventions of `ringPaths`. */
export function equipotentialPaths(snaps: GrowthSnapshots, levels: readonly number[]): readonly Path[] {
  for (const level of levels) if (!(level > 0 && level < 1)) throw new Error("Potential levels must lie strictly between 0 and 1");
  const key = levels.join(",");
  let byLevels = equipotentialCache.get(snaps);
  if (!byLevels) { byLevels = new Map(); equipotentialCache.set(snaps, byLevels); }
  const hit = byLevels.get(key);
  if (hit) return hit;
  const field = potentialField(snaps), data = Float32Array.from(field.values, (v) => 1 - v);
  const paths: Path[] = [];
  levels.forEach((level, k) => {
    const domain = maskDomain({ width: field.n, height: field.n, data }, { mode: "contour", threshold: 1 - level, cell: field.cell, id: `potential:${k}` });
    const packed = packRings(domainRings(domain));
    paths.push(...ringPaths(packed.points, packed.offsets, `potential:${k}`, snaps.seed, level, levels.length > 1 ? k / (levels.length - 1) : 0));
  });
  const made = Object.freeze(paths);
  byLevels.set(key, made);
  return made;
}
