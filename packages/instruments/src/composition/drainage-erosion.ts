import { createSimulationCache, type Simulation, type Snapshots, type SimulationCache } from "./snapshots.js";
import { accumulateFlow, fillDepressions, flowReceivers, gridSpacing, outletMask, stepLength, MAX_GRID_CELLS, type OutletMode } from "./drainage-flow.js";
import { bedrockField, coastalRamp, initialTerrain, rainField, type BedrockKind, type RainMode, type TerrainShape } from "./terrain.js";

/**
 * Stream-power erosion with deposition on a height grid, run as an F7 `Simulation` (`docs/composition-drainage-erosion.md`).
 *
 * A 2D model in domain units (the longer side of the grid is 1; elevations, areas and volumes use the same unit),
 * not a calibrated landscape-evolution code. One step is, in this fixed order and reading only the state at the
 * start of the step (a synchronous update):
 *
 *  1. FILL depressions of the terrain `z` (Priority-Flood with epsilon; `drainage-flow.ts` states the tie rule)
 *     into the routing surface `F >= z`. Flow is routed over `F`; the terrain itself is only changed below.
 *  2. ROUTE: D8 receiver of every cell on `F`; discharge `A_i` (cells of rain, times the cell area `h²`) by
 *     accumulating the rain field upstream.
 *  3. ERODE and DEPOSIT, walking cells from the highest `F` to the lowest so each cell sees everything upstream:
 *       S     = (F_i - F_r) / (h d)                       slope to the receiver r (d = 1 or √2 cells)
 *       q     = A_i^m S^n
 *       E_i   = min( K_i q,  max(0, z_i - F_r) )          stream-power detachment, in elevation per step;
 *                                                        never below the receiver's filled elevation
 *       cap_i = carry · K_i q · A_i                        sediment the flow can carry (volume per step)
 *       out_i = load_i + E_i h²                            sediment volume leaving the cell before deposition
 *       D_i   = min( deposition · max(0, out_i - cap_i) / h²,  max(0, minDonor_i - z_i) )
 *                                                        deposit a share of the excess, raising the cell by at most
 *                                                        the lowest filled elevation among the cells draining into it (a lake
 *                                                        bed: at most to the lake surface)
 *       load_r += out_i - D_i h²                          the rest is carried to the receiver
 *     `K_i = erodibility × (1 - contrast × hardness_i)`. Lake cells (`F > z`) have almost no slope, so they do not
 *     erode and trap sediment. Sediment that reaches an outlet leaves the model (`exported`).
 *  4. APPLY `z_i += D_i - E_i + uplift × ramp_i` on every non-outlet cell, with `ramp` the coastal ramp of `terrain.ts` (0 at
 *     the outlets, 1 inland), so uplift never builds a cliff at an outlet. Outlets stay at base level 0.
 *  5. CREEP: explicit hillslope diffusion of coefficient `kappa = creep × 1e-5` (domain units squared per step) between
 *     4-neighbours that are both non-outlet, in `ceil(4 kappa / (h² / 2))` sub-steps of at most 1/2 so each is a
 *     convex average. Each pair exchanges equal and opposite amounts, so it moves mass and creates none.
 *
 * MASS. `uplifted`, `eroded`, `deposited` and `exported` accumulate volumes (elevation × h², summed over cells) in
 * the state. The model's own identities, tested to rounding error: `Σ(z_after - z_before) h² = uplifted - eroded +
 * deposited` over any number of steps and `exported = eroded - deposited`. Creep and filling never change the total.
 *
 * STEP BOUND. Erosion never lowers a cell below its receiver's filled elevation and deposition never raises it above the
 * lowest cell draining into it, so a step cannot invert a slope through a single cell: after filling the surface
 * has no upstream cell lower than its receiver (a property of `fillDepressions`, tested), and the terrain can only
 * create a depression that the next fill turns into a lake.
 *
 * FIELDS. Rain and hardness are functions of `(params, seed)` and constant in time; they are rebuilt from those two
 * (memoised by content) rather than stored in every checkpoint.
 *
 * WORK AND STATE. One unit is one cell visit of one stage: `cells × (8 + creep sub-steps)` per step. The total is checked
 * against `MAX_EROSION_WORK` before running, naming `steps`, `resolution` and `creep`. State is the height (`cells`
 * values) plus four numbers; checkpoints every `CHECKPOINT_EVERY` steps and the first and last height are retained.
 */
export interface ErosionParams {
  columns: number; rows: number;
  shape: TerrainShape; relief: number; roughness: number; frequency: number; octaves: number;
  outlets: OutletMode;
  rainMode: RainMode; rainVariation: number; rainAngle: number; storms: number;
  bedrock: BedrockKind; bedrockContrast: number; bedrockScale: number; bedrockAngle: number;
  erodibility: number; areaExponent: number; slopeExponent: number;
  deposition: number; carrying: number; uplift: number; creep: number;
}
export interface ErosionState {
  height: Float64Array;
  uplifted: number; eroded: number; deposited: number; exported: number;
  /** The largest change of any cell in the last step (0 before the first step). */
  change: number;
}
export interface ErosionProjection {
  step: number;
  /** Terrain elevation of every cell, row-major (a private copy the caller must not write). */
  height: Float64Array;
  uplifted: number; eroded: number; deposited: number; exported: number;
  /** The largest change of any cell in the last step; a run that is `settled` has nothing left to do. */
  change: number;
}

export const MAX_EROSION_STEPS = 5_000;
export const MAX_EROSION_WORK = 150_000_000;
export const MAX_CREEP_SUBSTEPS = 64;
export const CHECKPOINT_EVERY = 25;
/** Retention used by the instrument: checkpoints every 25 steps, history only at the first and last step. */
export const RETENTION = Object.freeze({ checkpointEvery: CHECKPOINT_EVERY, historyEvery: 0 });

/** Sub-steps of creep per step: each is at most a 1/2 convex average. */
export function creepSubsteps(p: Pick<ErosionParams, "columns" | "rows" | "creep">): number {
  if (p.creep === 0) return 0;
  const h = gridSpacing(p.columns, p.rows), factor = 4 * p.creep * 1e-5 / (h * h), substeps = Math.ceil(factor / 0.5);
  if (substeps > MAX_CREEP_SUBSTEPS)
    throw new Error(`Creep ${p.creep} needs ${substeps} diffusion sub-steps at ${Math.max(p.columns, p.rows)} cells across (limit ${MAX_CREEP_SUBSTEPS}); lower creep or the resolution`);
  return Math.max(1, substeps);
}
/** Work units of one step. */
export const stepWork = (p: ErosionParams): number => p.columns * p.rows * (8 + creepSubsteps(p));

/** Throws, naming the control to change, unless `steps` of these parameters fit `MAX_EROSION_WORK`. */
export function checkErosionWork(p: ErosionParams, steps: number): void {
  if (!Number.isInteger(steps) || steps < 0 || steps > MAX_EROSION_STEPS)
    throw new Error(`Erosion steps must be an integer from 0 to ${MAX_EROSION_STEPS} (got ${String(steps)}); lower steps`);
  const cells = p.columns * p.rows;
  if (cells > MAX_GRID_CELLS) throw new Error(`Grid ${p.columns} × ${p.rows} has ${cells} cells, above ${MAX_GRID_CELLS}; lower the resolution`);
  const work = cells * 6 + steps * stepWork(p);
  if (work > MAX_EROSION_WORK)
    throw new Error(`${steps} steps on ${cells} cells cost ${work} work units, above ${MAX_EROSION_WORK}; lower steps or the resolution${p.creep > 0 ? " or creep" : ""}`);
}

/** The constant fields of a construction, memoised by content (a pure function of `(params, seed)`). */
interface Fields { outlets: Uint8Array; rain: Float64Array; stiffness: Float64Array; ramp: Float64Array }
const fieldMemo = new Map<string, Fields>();
function fieldsFor(p: ErosionParams, seed: number): Fields {
  const key = JSON.stringify([p.columns, p.rows, p.outlets, p.rainMode, p.rainVariation, p.rainAngle, p.storms, p.bedrock, p.bedrockContrast, p.bedrockScale, p.bedrockAngle, seed]);
  const hit = fieldMemo.get(key);
  if (hit) { fieldMemo.delete(key); fieldMemo.set(key, hit); return hit; }
  const hard = bedrockField({ columns: p.columns, rows: p.rows, kind: p.bedrock, scale: p.bedrockScale, angle: p.bedrockAngle }, seed);
  const stiffness = new Float64Array(hard.length);
  for (let c = 0; c < hard.length; c++) stiffness[c] = 1 - p.bedrockContrast * hard[c];
  const made: Fields = {
    outlets: outletMask(p.columns, p.rows, p.outlets),
    rain: rainField({ columns: p.columns, rows: p.rows, mode: p.rainMode, variation: p.rainVariation, angle: p.rainAngle, storms: p.storms }, seed),
    stiffness, ramp: coastalRamp(p.columns, p.rows, p.outlets),
  };
  fieldMemo.set(key, made);
  if (fieldMemo.size > 4) fieldMemo.delete(fieldMemo.keys().next().value!);
  return made;
}

function checkParams(p: ErosionParams): void {
  const range = (label: string, v: number, min: number, max: number) => {
    if (!Number.isFinite(v) || v < min || v > max) throw new Error(`${label} must be from ${min} to ${max} (got ${String(v)})`);
  };
  range("erodibility", p.erodibility, 0, 1e3); range("area exponent", p.areaExponent, 0, 2); range("slope exponent", p.slopeExponent, 0.25, 4);
  range("deposition", p.deposition, 0, 1); range("carrying capacity", p.carrying, 0, 1e3); range("uplift", p.uplift, 0, 1);
  range("bedrock contrast", p.bedrockContrast, 0, 0.99); range("creep", p.creep, 0, 1e4);
}

export const erosionSimulation: Simulation<ErosionState, ErosionParams, ErosionProjection> = {
  id: "drainage-erosion",
  limits(p) {
    checkParams(p);
    return { stepLimit: MAX_EROSION_STEPS, workPerStep: stepWork(p), initialWork: p.columns * p.rows * 6 };
  },
  initial(ctx) {
    const p = ctx.params;
    ctx.charge(p.columns * p.rows * 6);
    const height = initialTerrain({ columns: p.columns, rows: p.rows, shape: p.shape, relief: p.relief, roughness: p.roughness,
      frequency: p.frequency, octaves: p.octaves, outlets: p.outlets }, ctx.seed);
    return { height, uplifted: 0, eroded: 0, deposited: 0, exported: 0, change: 0 };
  },
  step(state, ctx) {
    const p = ctx.params, { columns, rows } = p, n = columns * rows, h = gridSpacing(columns, rows), cellArea = h * h;
    const substeps = creepSubsteps(p);
    ctx.charge(n * (8 + substeps));
    const fields = fieldsFor(p, ctx.seed), z = state.height;
    const { filled, order } = fillDepressions(z, columns, rows, fields.outlets);
    const receivers = flowReceivers(filled, columns, rows, fields.outlets);
    const flow = accumulateFlow(receivers, order, fields.rain);
    const minDonor = new Float64Array(n).fill(Infinity);
    for (let c = 0; c < n; c++) {
      const r = receivers[c];
      if (r >= 0 && filled[c] < minDonor[r]) minDonor[r] = filled[c];
    }
    const m = p.areaExponent, nn = p.slopeExponent, load = new Float64Array(n), dz = new Float64Array(n);
    let eroded = 0, deposited = 0, exported = 0;
    for (let k = n - 1; k >= 0; k--) {
      const c = order[k], r = receivers[c];
      if (r < 0) { exported += load[c]; continue; }
      const slope = (filled[c] - filled[r]) / (h * stepLength(columns, c, r)), area = flow[c] * cellArea;
      const power = (m === 0.5 ? Math.sqrt(area) : m === 1 ? area : area ** m) * (nn === 1 ? slope : slope ** nn);
      const potential = p.erodibility * fields.stiffness[c] * power;
      const allowed = z[c] - filled[r];
      const erosion = allowed > 0 ? Math.min(potential, allowed) : 0;
      const out = load[c] + erosion * cellArea;
      const excess = out - p.carrying * potential * area;
      let deposit = excess > 0 ? p.deposition * excess / cellArea : 0;
      // A lake bed rises at most to the lake surface; other ground at most to the lowest filled cell draining into it.
      const ceiling = filled[c] > z[c] ? filled[c] : minDonor[c];
      const room = ceiling === Infinity ? 0 : Math.max(0, ceiling - z[c]);
      if (deposit > room) deposit = room;
      load[r] += out - deposit * cellArea;
      dz[c] = deposit - erosion;
      eroded += erosion * cellArea; deposited += deposit * cellArea;
    }
    const before = z.slice();
    let raised = 0;
    for (let c = 0; c < n; c++) {
      if (fields.outlets[c]) continue;
      const lift = p.uplift * fields.ramp[c];
      z[c] += dz[c] + lift;
      raised += lift;
    }
    if (substeps > 0) {
      const share = 4 * p.creep * 1e-5 / (h * h) / substeps / 4;
      let from: Float64Array = z, to: Float64Array = new Float64Array(n);
      for (let s = 0; s < substeps; s++) {
        for (let c = 0; c < n; c++) {
          if (fields.outlets[c]) { to[c] = from[c]; continue; }
          const i = c % columns, j = (c - i) / columns;
          let sum = 0;
          if (i > 0 && !fields.outlets[c - 1]) sum += from[c - 1] - from[c];
          if (i < columns - 1 && !fields.outlets[c + 1]) sum += from[c + 1] - from[c];
          if (j > 0 && !fields.outlets[c - columns]) sum += from[c - columns] - from[c];
          if (j < rows - 1 && !fields.outlets[c + columns]) sum += from[c + columns] - from[c];
          to[c] = from[c] + share * sum;
        }
        const swap = from; from = to; to = swap;
      }
      if (from !== z) z.set(from);
    }
    let change = 0;
    for (let c = 0; c < n; c++) { const d = Math.abs(z[c] - before[c]); if (d > change) change = d; }
    return { height: z, change, uplifted: state.uplifted + raised * cellArea, eroded: state.eroded + eroded,
      deposited: state.deposited + deposited, exported: state.exported + exported };
  },
  project(state, step) {
    return { step, height: state.height, uplifted: state.uplifted, eroded: state.eroded, deposited: state.deposited, exported: state.exported, change: state.change };
  },
};

/** Retained runs by construction. A palette or drawing edit never reaches it; more steps extend a cached shorter run. */
export const erosionCache: SimulationCache = createSimulationCache({ capacity: 6 });

export type ErosionSnapshots = Snapshots<ErosionState, ErosionParams, ErosionProjection>;

/** The retained run of this construction (cache hit, extension of a shorter run, or a fresh run). */
export function erodedTerrain(params: ErosionParams, seed: number, steps: number, control: { cancelled?: () => boolean } = {}): ErosionSnapshots {
  checkErosionWork(params, steps);
  return erosionCache.get(erosionSimulation, params, seed, { steps, ...RETENTION, maxWork: MAX_EROSION_WORK, cancelled: control.cancelled });
}

/**
 * Whether the run has reached a fixed point: it has taken a step and that step moved no cell by more than `tolerance` (elevation, default 1e-9).
 * With no erodibility, uplift or creep this is exact from the first step; with erosion alone the height is non-increasing and bounded
 * below by the outlets, so it settles; with uplift it settles only into a steady state where erosion balances the uplift.
 */
export const hasSettled = (projection: Readonly<ErosionProjection>, tolerance = 1e-9): boolean => projection.step > 0 && projection.change <= tolerance;

/** Total volume of the terrain (elevation × h², summed): the quantity the ledger accounts for. */
export function terrainVolume(height: ArrayLike<number>, columns: number, rows: number): number {
  const h = gridSpacing(columns, rows);
  let sum = 0;
  for (let c = 0; c < height.length; c++) sum += height[c];
  return sum * h * h;
}

export { fieldsFor as erosionFields };
