/**
 * Nutrient-driven cell division (roadmap brief 20): a 2D colony of discs that eat a diffusing, consumed
 * nutrient, grow, divide into two daughters and push each other apart. Runs through the F7 stateful
 * snapshot API (`snapshots.ts`); nothing here keeps its own stepping, caching or cancellation.
 *
 * Scope. This is a flat cellular-colony model, not biology and not physics: discs, a five-point
 * diffusion stencil, a first-order uptake law and position-based overlap relaxation. The separate 3D
 * surface-growth brief is not implemented here.
 *
 * Frame and units. Everything is in the domain's local frame, canvas units, origin at the domain's
 * top-left corner, x right and y down, so `[0, width] x [0, height]`. Placing the colony on the canvas is
 * a translation the drawing applies: it is not part of the construction, so it never recomputes anything.
 * Nutrient is measured in *area units*: one unit of nutrient becomes exactly one canvas unit squared of
 * cell area (yield 1), which is what makes the balance below an equation rather than a tendency.
 *
 * The model, one step (synchronous rules read the old state everywhere; sequential ones are ascending id)
 *  1. Growth (synchronous, order independent). Every cell that is below the division radius claims the
 *     fraction `uptake` of the nutrient in every open field cell whose centre lies within
 *     `max(radius, 0.71 field cells)` of it. A field cell claimed by more than one whole unit is shared in
 *     proportion to the claims. The absorbed nutrient becomes area; a cell never grows past the division
 *     radius and only takes what it can use.
 *  2. Diffusion. `diffusion` is the diffusivity in canvas units squared per step. It is spent as `passes`
 *     passes of the masked five-point stencil, `n += c * sum(neighbour - n)` over open neighbours only
 *     (walls and the outside are no-flux), so mass is conserved; `passes = ceil(diffusion / (0.25 * fieldCell^2))`
 *     and `c = diffusion / (passes * fieldCell^2) <= 0.25` keeps every pass a convex average. The
 *     field cell therefore changes the resolution of the nutrient, not how fast it spreads.
 *  3. Sources. Source cells are held at the supply concentration 1; the nutrient this adds is counted in
 *     `inflow`.
 *  4. Division (sequential, ascending id). A live cell of radius >= the division radius, while the live
 *     count is below `maxCells`, is replaced by two daughters with fresh birth-counter ids `cell:n`,
 *     `cell:n+1`. Areas add up to the mother's (`r1^2 + r2^2 = R^2`) with the larger daughter (area share
 *     `split`) ahead along the division axis and its centre of area at the mother's centre; the daughters
 *     touch. The mother is kept as an ancestor record (position, radius and step at division), so lineage is
 *     never lost. The axis is set by `orientation` (random, along or across the local nutrient gradient,
 *     radial or tangential to the colony, or fixed) plus a jitter, each from the mother's own stream.
 *  5. Relaxation (`relax` passes, synchronous). Two cells closer than `(r1 + r2) * (1 - overlap)` move apart
 *     along their line, each by `stiffness` times the overlap times the *other's* share of the two areas (a
 *     large cell yields less), summed over all neighbours, capped at half the cell's radius, then held inside
 *     the boundary. Neighbours come from a `PointGrid`; ties by lowest id.
 *  6. Status. `full` is the step at which the live count reached `maxCells`. The colony *settles* (status
 *     `settled`; every later step is the identical state) when it is full, every cell has reached the
 *     division radius and nothing moved by more than 1e-4. It is *starved* when there is no source and
 *     the nutrient left in the field is below 1e-6 area units. Dying never happens: no cell is ever removed.
 *
 * Declared quantities (proved in the tests): the live count grows by exactly one per division; cell area
 * plus field nutrient equals its initial value plus the nutrient the sources have added (`inflow`); a
 * division keeps area and the centre of area; ids are never reused; the state after `k` steps is a prefix of
 * the state after `k + m`.
 *
 * Bounds (each throws naming the control): field <= 62,500 cells (`Field cell`, `Width`, `Height`),
 * `maxCells` <= 2,000 (`Cell limit`), steps <= 1,000 (`Steps`), declared work per step (`Field cell`,
 * `Cell limit`, `Steps`, `Relaxation`), a step that crowds beyond its declared work (`Cell limit`, `Width`,
 * `Height`).
 */
import { componentSeed } from "./core.js";
import { elementId, createSimulationCache, finalState, type Simulation, type SimulationContext, type Snapshots } from "./snapshots.js";
import { PointGrid } from "./spatial-index.js";
import { graphFromParts, type Graph } from "./graph.js";
import type { DensityField } from "./grains.js";
import type { Point } from "./types.js";

export type CellBoundary = "box" | "dish";
export type NutrientSource = "none" | "edge" | "point" | "pair" | "ring";
export type SeedLayout = "cluster" | "ring" | "line" | "scatter";
export type DivisionAxis = "random" | "gradient" | "across" | "radial" | "tangential" | "fixed";

/** The construction of a colony: everything that shapes a step, and none of the step count or appearance. */
export interface ColonyOptions {
  /** Domain size, canvas units. */
  width: number; height: number;
  boundary: CellBoundary;
  /** Edge of one nutrient grid cell, canvas units. */
  fieldCell: number;
  source: NutrientSource;
  /** Direction of the source from the domain centre, degrees (0 right, 90 down). */
  sourceAngle: number;
  /** Distance of a point source from the centre, as a fraction of the half extent. */
  sourceOffset: number;
  /** Thickness of an edge or ring source, or radius of a point source, as a fraction of the shorter side. */
  sourceSize: number;
  /** Initial nutrient concentration everywhere, as a fraction of the supply (0 to 1). */
  reserve: number;
  /** Nutrient diffusivity, canvas units squared per step. */
  diffusion: number;
  seedLayout: SeedLayout;
  seedCount: number;
  /** Centre of the seed cells as fractions of the domain. */
  seedX: number; seedY: number;
  /** Radius of the seed cluster/ring, half length of the line, canvas units. */
  seedSpread: number;
  /** Rotation of the seed line or ring, degrees. */
  seedAngle: number;
  startRadius: number;
  divideRadius: number;
  /** Fraction of the nutrient under a cell it absorbs per step (0 to 1). */
  uptake: number;
  maxCells: number;
  /** Area share of the larger daughter, 0.5 (equal) to 0.95. */
  split: number;
  orientation: DivisionAxis;
  /** Axis angle for `fixed`, degrees. */
  splitAngle: number;
  /** Half range of a random turn added to the axis, degrees. */
  orientJitter: number;
  /** Fraction of `r1 + r2` two cells may overlap before they are pushed apart. */
  overlap: number;
  stiffness: number;
  relax: number;
}

const COLONY_KEYS = ["width", "height", "boundary", "fieldCell", "source", "sourceAngle", "sourceOffset", "sourceSize", "reserve", "diffusion",
  "seedLayout", "seedCount", "seedX", "seedY", "seedSpread", "seedAngle", "startRadius", "divideRadius", "uptake", "maxCells", "split",
  "orientation", "splitAngle", "orientJitter", "overlap", "stiffness", "relax"] as const satisfies readonly (keyof ColonyOptions)[];

/** The construction fields of a set of stored controls (the controls that carry these names), without validation. */
export function colonyOptionsOf(values: Readonly<Record<string, number | string | boolean>>): ColonyOptions {
  return Object.fromEntries(COLONY_KEYS.map((key) => [key, values[key]])) as unknown as ColonyOptions;
}

export const COLONY_LIMITS = Object.freeze({
  maxCells: 2000, maxSteps: 1000, maxFieldCells: 62_500, maxPasses: 64, maxDiffusionWork: 800_000,
  /** Units of work a neighbour query may cost before a step is declared over-crowded. */
  neighbourWork: 96,
  checkpointEvery: 25, historyEvery: 1,
  /** Movement per step below which a full colony of grown cells has settled. */
  settleMove: 1e-4, starvedNutrient: 1e-6, readyEps: 1e-9,
});

/** Live cells (parallel arrays, ascending id) and ancestor records. Plain data: checkpoints copy it. */
interface ColonyState {
  /** Birth counter: the serial the next cell receives. */
  next: number;
  id: number[]; x: number[]; y: number[]; r: number[];
  parent: number[]; birth: number[]; gen: number[]; clan: number[]; share: number[];
  /** Divided cells, ascending id: position, radius and step at division. */
  dead: { id: number[]; x: number[]; y: number[]; r: number[]; parent: number[]; birth: number[]; gen: number[]; clan: number[]; share: number[]; at: number[] };
  /** Nutrient amount per field cell, area units (concentration times cell area). */
  field: Float64Array;
  /** Total nutrient in the field. */
  mass: number;
  /** Nutrient the sources have added since the initial state, area units. */
  inflow: number;
  /** Nutrient converted to cell area since the initial state. */
  absorbed: number;
  /** 0 running, 1 settled, 2 starved. */
  halt: number;
  haltAt: number;
  fullAt: number;
}

/** What history retains per step: the totals, small enough to keep for every step. */
export interface ColonyFrame {
  step: number;
  cells: number;
  ancestors: number;
  /** Total cell area, canvas units squared. */
  area: number;
  /** Total nutrient in the field, area units. */
  nutrient: number;
  inflow: number;
  absorbed: number;
  halt: number;
}

export type ColonyStatus = "growing" | "full" | "settled" | "starved";

export interface ColonyCell {
  /** `cell:<serial>`, born once and never reused. */
  readonly id: string;
  readonly serial: number;
  readonly parent: string | null;
  /** Id of the seed cell this one descends from. */
  readonly root: string;
  readonly birth: number;
  readonly generation: number;
  readonly radius: number;
  /** Local frame. For an ancestor: where it stood when it divided. */
  readonly position: Point;
  /** Area share this cell took from its mother (1 for seeds). */
  readonly share: number;
  /** Step at which it divided; null while it is alive. */
  readonly divided: number | null;
}

export interface Colony {
  readonly options: Readonly<ColonyOptions>;
  readonly seed: number;
  readonly steps: number;
  readonly status: ColonyStatus;
  readonly fullAt: number | null;
  readonly haltedAt: number | null;
  /** Live cells, ascending id. */
  readonly cells: readonly ColonyCell[];
  /** Divided cells, ascending id: the interior nodes of the lineage. */
  readonly ancestors: readonly ColonyCell[];
  /** Nutrient concentration (fraction of the supply) over the domain grid; `mass` is nutrient in area units. */
  readonly field: DensityField;
  /** Every cell that ever lived; an edge joins a mother's division point to each daughter. Positions as in `cells`. */
  readonly lineage: Graph;
  readonly totals: { readonly area: number; readonly nutrient: number; readonly inflow: number; readonly absorbed: number; readonly births: number };
  /** The deepest generation of any cell (0: only founders). */
  readonly generations: number;
  /** Retained snapshots: appearance edits and placement return the identical object. */
  readonly snapshots: Snapshots<ColonyState, ColonyOptions, ColonyFrame>;
}

/* ------------------------------------------------------------------------------- validation */

const integer = (label: string, value: number, min: number, max: number): void => {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer in [${min}, ${max}]`);
};
const finite = (label: string, value: number, min: number, max: number): void => {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and in [${min}, ${max}]`);
};
const oneOf = (label: string, value: string, options: readonly string[]): void => {
  if (!options.includes(value)) throw new Error(`${label} must be one of ${options.join(", ")}`);
};

export function fieldSize(o: Pick<ColonyOptions, "width" | "height" | "fieldCell">): { columns: number; rows: number } {
  return { columns: Math.ceil(o.width / o.fieldCell), rows: Math.ceil(o.height / o.fieldCell) };
}

/** Passes and per-pass coefficient that spend `diffusion` (canvas units squared per step) on this field cell. */
export function diffusionPlan(o: Pick<ColonyOptions, "diffusion" | "fieldCell">): { passes: number; coefficient: number } {
  const cells = o.diffusion / (o.fieldCell * o.fieldCell), passes = Math.max(1, Math.ceil(cells / 0.25));
  return { passes, coefficient: cells / passes };
}

/** Work one step may declare. Named after the controls that set it. */
function envelope(o: Readonly<ColonyOptions>, openCells: number): number {
  const reach = (Math.max(o.divideRadius, 0.71 * o.fieldCell) + 0.71 * o.fieldCell) / o.fieldCell;
  const candidates = (2 * reach + 2) ** 2;
  return Math.ceil(diffusionPlan(o).passes * openCells + o.maxCells * (2 * candidates + 2 * (reach + 2) ** 2 + 8)
    + o.relax * o.maxCells * (COLONY_LIMITS.neighbourWork + 4) + 2 * openCells + 1000);
}

/** Throws an Error naming the control for every invalid or over-budget construction. */
export function validateColony(o: Readonly<ColonyOptions>, steps: number): void {
  finite("Width", o.width, 20, 2000); finite("Height", o.height, 20, 2000);
  oneOf("Boundary", o.boundary, ["box", "dish"]);
  finite("Field cell", o.fieldCell, 1, 200);
  const { columns, rows } = fieldSize(o);
  if (columns * rows > COLONY_LIMITS.maxFieldCells)
    throw new Error(`The nutrient field would need ${columns * rows} cells; the limit is ${COLONY_LIMITS.maxFieldCells}. Raise the field cell or lower the width or height`);
  oneOf("Nutrient source", o.source, ["none", "edge", "point", "pair", "ring"]);
  finite("Source direction", o.sourceAngle, -3600, 3600); finite("Source distance", o.sourceOffset, 0, 1); finite("Source size", o.sourceSize, 0, 1);
  finite("Reserve", o.reserve, 0, 1); finite("Diffusion", o.diffusion, 0, 1e6);
  const plan = diffusionPlan(o);
  if (plan.passes > COLONY_LIMITS.maxPasses || plan.passes * columns * rows > COLONY_LIMITS.maxDiffusionWork)
    throw new Error(`Diffusion ${o.diffusion} over a ${columns} by ${rows} field needs ${plan.passes} passes (${plan.passes * columns * rows} cell updates per step); the limits are ${COLONY_LIMITS.maxPasses} passes and ${COLONY_LIMITS.maxDiffusionWork} updates. Lower the diffusion or raise the field cell`);
  oneOf("Seed layout", o.seedLayout, ["cluster", "ring", "line", "scatter"]);
  integer("Seed cells", o.seedCount, 1, COLONY_LIMITS.maxCells);
  finite("Seed X", o.seedX, 0, 1); finite("Seed Y", o.seedY, 0, 1); finite("Seed spread", o.seedSpread, 0, 4000); finite("Seed angle", o.seedAngle, -3600, 3600);
  finite("Start radius", o.startRadius, 0.05, 500); finite("Division radius", o.divideRadius, 0.05, 500);
  if (o.startRadius > o.divideRadius) throw new Error(`Start radius (${o.startRadius}) must not exceed the division radius (${o.divideRadius})`);
  finite("Uptake", o.uptake, 1e-6, 1);
  integer("Cell limit", o.maxCells, 1, COLONY_LIMITS.maxCells);
  if (o.seedCount > o.maxCells) throw new Error(`Seed cells (${o.seedCount}) exceed the cell limit (${o.maxCells}). Lower the seed cells or raise the cell limit`);
  finite("Split", o.split, 0.5, 0.95);
  oneOf("Division axis", o.orientation, ["random", "gradient", "across", "radial", "tangential", "fixed"]);
  finite("Split angle", o.splitAngle, -3600, 3600); finite("Axis jitter", o.orientJitter, 0, 180);
  finite("Overlap", o.overlap, 0, 0.5); finite("Stiffness", o.stiffness, 0, 1); integer("Relaxation", o.relax, 1, 16);
  integer("Steps", steps, 0, COLONY_LIMITS.maxSteps);
}

/* ------------------------------------------------------------------------------- layout */

interface Layout {
  columns: number; rows: number; cellArea: number;
  open: Uint8Array; isSource: Uint8Array; sources: Int32Array; openCells: number;
  budget: number;
}
const layouts = new WeakMap<object, Layout>();

const rad = Math.PI / 180;

/** The static grid of a construction: which field cells are open, which are held by a source. A pure function of the options. */
function layoutOf(o: Readonly<ColonyOptions>): Layout {
  const hit = layouts.get(o);
  if (hit) return hit;
  const { columns, rows } = fieldSize(o), fc = o.fieldCell;
  const open = new Uint8Array(columns * rows), isSource = new Uint8Array(columns * rows);
  const cx = o.width / 2, cy = o.height / 2, short = Math.min(o.width, o.height);
  const dx = Math.cos(o.sourceAngle * rad), dy = Math.sin(o.sourceAngle * rad);
  const band = Math.max(o.sourceSize * short, fc);
  const supportBox = Math.abs(dx) * cx + Math.abs(dy) * cy;
  const supportDish = Math.hypot(dx * cx, dy * cy);
  const support = o.boundary === "dish" ? supportDish : supportBox;
  const spot = [Math.cos(o.sourceAngle * rad) * o.sourceOffset * cx, Math.sin(o.sourceAngle * rad) * o.sourceOffset * cy] as const;
  let openCells = 0;
  const sources: number[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const x = (i + 0.5) * fc, y = (j + 0.5) * fc, k = j * columns + i;
    const inside = x < o.width && y < o.height && (o.boundary === "box" || ((x - cx) / cx) ** 2 + ((y - cy) / cy) ** 2 <= 1);
    if (!inside) continue;
    open[k] = 1; openCells++;
    const px = x - cx, py = y - cy;
    let held = false;
    if (o.source === "edge") held = px * dx + py * dy >= support - band;
    else if (o.source === "point") held = Math.hypot(px - spot[0], py - spot[1]) <= band;
    else if (o.source === "pair") held = Math.hypot(px - spot[0], py - spot[1]) <= band || Math.hypot(px + spot[0], py + spot[1]) <= band;
    else if (o.source === "ring") held = Math.hypot(px / cx, py / cy) >= 1 - 2 * band / short;
    if (held) { isSource[k] = 1; sources.push(k); }
  }
  const layout = { columns, rows, cellArea: fc * fc, open, isSource, sources: Int32Array.from(sources), openCells, budget: envelope(o, openCells) };
  layouts.set(o, layout);
  return layout;
}

/** Hold a centre inside the boundary with its whole disc. */
function constrain(o: Readonly<ColonyOptions>, x: number, y: number, r: number): [number, number] {
  const w = o.width, h = o.height;
  if (o.boundary === "box") {
    return [w <= 2 * r ? w / 2 : Math.min(w - r, Math.max(r, x)), h <= 2 * r ? h / 2 : Math.min(h - r, Math.max(r, y))];
  }
  const ax = w / 2 - r, ay = h / 2 - r;
  if (ax <= 0 || ay <= 0) return [w / 2, h / 2];
  const px = x - w / 2, py = y - h / 2, e2 = (px / ax) ** 2 + (py / ay) ** 2;
  if (e2 <= 1) return [Math.min(w, Math.max(0, x)), Math.min(h, Math.max(0, y))];
  const s = 1 / Math.sqrt(e2);
  return [w / 2 + px * s, h / 2 + py * s];
}

/* ------------------------------------------------------------------------------- the simulation */

const GOLDEN = 2.399963229728653;

const emptyCells = () => ({ id: [] as number[], x: [] as number[], y: [] as number[], r: [] as number[], parent: [] as number[],
  birth: [] as number[], gen: [] as number[], clan: [] as number[], share: [] as number[] });

function initialState(ctx: SimulationContext<ColonyOptions>): ColonyState {
  const o = ctx.params, L = layoutOf(o);
  validateColony(o, 0);
  const state: ColonyState = {
    next: 0, id: [], x: [], y: [], r: [], parent: [], birth: [], gen: [], clan: [], share: [],
    dead: { id: [], x: [], y: [], r: [], parent: [], birth: [], gen: [], clan: [], share: [], at: [] },
    field: new Float64Array(L.columns * L.rows), mass: 0, inflow: 0, absorbed: 0, halt: 0, haltAt: -1, fullAt: -1,
  };
  for (let k = 0; k < state.field.length; k++) if (L.open[k]) state.field[k] = o.reserve * L.cellArea;
  for (const k of L.sources) state.field[k] = L.cellArea;
  let mass = 0;
  for (let k = 0; k < state.field.length; k++) mass += state.field[k];
  state.mass = mass;
  const cx = o.seedX * o.width, cy = o.seedY * o.height, n = o.seedCount;
  for (let s = 0; s < n; s++) {
    let px = cx, py = cy;
    if (o.seedLayout === "cluster") {
      const radius = o.seedSpread * Math.sqrt((s + 0.5) / n), t = s * GOLDEN + o.seedAngle * rad;
      px += radius * Math.cos(t); py += radius * Math.sin(t);
    } else if (o.seedLayout === "ring") {
      const t = o.seedAngle * rad + 2 * Math.PI * s / n;
      px += o.seedSpread * Math.cos(t); py += o.seedSpread * Math.sin(t);
    } else if (o.seedLayout === "line") {
      const t = o.seedAngle * rad, f = n === 1 ? 0 : (2 * s / (n - 1) - 1) * o.seedSpread;
      px += f * Math.cos(t); py += f * Math.sin(t);
    } else {
      const stream = ctx.stream(elementId("cell", s), "seed");
      const radius = o.seedSpread * Math.sqrt(stream.next()), t = 2 * Math.PI * stream.next();
      px += radius * Math.cos(t); py += radius * Math.sin(t);
    }
    const [x, y] = constrain(o, px, py, o.startRadius);
    state.id.push(s); state.x.push(x); state.y.push(y); state.r.push(o.startRadius);
    state.parent.push(-1); state.birth.push(0); state.gen.push(0); state.clan.push(s); state.share.push(1);
  }
  state.next = n;
  ctx.charge(L.columns * L.rows + n);
  return state;
}

/**
 * The field cells a disc touches, with the share of each it covers, appended to `ids` (ascending index) and
 * `weights`. Coverage of a cell is estimated from the signed distance of its centre to the circle,
 * `clamp(0.5 + (reach - distance) / fieldCell, 0, 1)`, where `reach = max(radius, 0.71 fieldCell)` (a disc smaller than
 * a cell is shared among the nearest ones instead of vanishing between their centres), over every cell in range (walls
 * included), then scaled so the covered areas add up to the disc's own area `pi r^2` whatever the resolution.
 * Cells outside the boundary are counted in that scale and not returned, so a disc against the wall reaches only
 * the nutrient inside it. Returns the candidates visited (work).
 */
function footprint(o: Readonly<ColonyOptions>, L: Layout, x: number, y: number, radius: number, ids: number[], weights: number[]): number {
  const fc = o.fieldCell, kernel = Math.max(radius, 0.71 * fc), range = kernel + 0.71 * fc;
  const i0 = Math.max(0, Math.ceil((x - range) / fc - 0.5)), i1 = Math.min(L.columns - 1, Math.floor((x + range) / fc - 0.5));
  const j0 = Math.max(0, Math.ceil((y - range) / fc - 0.5)), j1 = Math.min(L.rows - 1, Math.floor((y + range) / fc - 0.5));
  const from = ids.length;
  let visited = 0, sum = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    visited++;
    const share = Math.min(1, Math.max(0, 0.5 + (kernel - Math.hypot((i + 0.5) * fc - x, (j + 0.5) * fc - y)) / fc));
    if (share === 0) continue;
    sum += share;
    const k = j * L.columns + i;
    if (L.open[k]) { ids.push(k); weights.push(share); }
  }
  const scale = sum > 0 ? Math.PI * radius * radius / (fc * fc * sum) : 0;
  for (let m = from; m < weights.length; m++) weights[m] = Math.min(1, weights[m] * scale);
  return visited;
}

/** Nutrient gradient at a cell (amount per field cell, up the gradient), from one-sided/central differences over open neighbours. */
function gradientAt(L: Layout, field: Float64Array, cells: readonly number[]): [number, number] {
  let gx = 0, gy = 0;
  for (const k of cells) {
    const i = k % L.columns, j = (k - i) / L.columns, here = field[k];
    const left = i > 0 && L.open[k - 1] ? field[k - 1] : here, right = i < L.columns - 1 && L.open[k + 1] ? field[k + 1] : here;
    const up = j > 0 && L.open[k - L.columns] ? field[k - L.columns] : here, down = j < L.rows - 1 && L.open[k + L.columns] ? field[k + L.columns] : here;
    gx += right - left; gy += down - up;
  }
  return [gx, gy];
}

function stepState(state: ColonyState, ctx: SimulationContext<ColonyOptions>): ColonyState {
  if (state.halt !== 0) return state;
  const o = ctx.params, L = layoutOf(o), step = ctx.step, fc = o.fieldCell;
  const R = o.divideRadius, ready = R - COLONY_LIMITS.readyEps;
  let used = 0;
  const charge = (units: number): void => {
    used += units;
    if (used > L.budget)
      throw new Error(`Cell Division: step ${step} needs more than ${L.budget} work units; the colony is too crowded or too fine. Lower the cell limit or the field resolution, or enlarge the width and height`);
    ctx.charge(units);
  };
  const n0 = state.id.length;

  /* 1. growth */
  {
    const claim = new Float64Array(L.columns * L.rows), take = new Float64Array(L.columns * L.rows);
    const starts = new Int32Array(n0 + 1), flat: number[] = [], share: number[] = [];
    for (let c = 0; c < n0; c++) {
      starts[c] = flat.length;
      if (state.r[c] >= ready) continue;
      charge(footprint(o, L, state.x[c], state.y[c], state.r[c], flat, share));
      for (let m = starts[c]; m < flat.length; m++) claim[flat[m]] += o.uptake * share[m];
    }
    starts[n0] = flat.length;
    for (let c = 0; c < n0; c++) {
      if (starts[c] === starts[c + 1]) continue;
      let gain = 0;
      for (let m = starts[c]; m < starts[c + 1]; m++) { const k = flat[m]; gain += state.field[k] * o.uptake * share[m] / Math.max(1, claim[k]); }
      const allowed = Math.PI * (R * R - state.r[c] * state.r[c]);
      const lambda = gain > allowed ? allowed / gain : 1;
      if (gain <= 0) continue;
      for (let m = starts[c]; m < starts[c + 1]; m++) { const k = flat[m]; take[k] += state.field[k] * o.uptake * share[m] / Math.max(1, claim[k]) * lambda; }
      state.r[c] = Math.sqrt(state.r[c] * state.r[c] + gain * lambda / Math.PI);
      state.absorbed += gain * lambda;
      charge(starts[c + 1] - starts[c]);
    }
    for (let c = 0; c < n0; c++) for (let m = starts[c]; m < starts[c + 1]; m++) {
      const k = flat[m];
      if (take[k] !== 0) { state.field[k] = Math.max(0, state.field[k] - take[k]); take[k] = 0; }
    }
  }

  /* 2. diffusion, 3. sources */
  {
    const { columns: cols, rows, open } = L, { passes, coefficient: D } = diffusionPlan(o);
    let a = state.field, b: Float64Array = new Float64Array(a.length);
    for (let pass = 0; pass < passes; pass++) {
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        if (!open[k]) continue;
        const here = a[k];
        let sum = 0;
        if (i > 0 && open[k - 1]) sum += a[k - 1] - here;
        if (i < cols - 1 && open[k + 1]) sum += a[k + 1] - here;
        if (j > 0 && open[k - cols]) sum += a[k - cols] - here;
        if (j < rows - 1 && open[k + cols]) sum += a[k + cols] - here;
        b[k] = here + D * sum;
      }
      const t = a; a = b; b = t;
    }
    charge(passes * L.openCells);
    for (const k of L.sources) { state.inflow += L.cellArea - a[k]; a[k] = L.cellArea; }
    let mass = 0;
    for (let k = 0; k < a.length; k++) mass += a[k];
    state.field = a; state.mass = mass;
    charge(2 * L.openCells);
  }

  /* 4. division */
  if (n0 < o.maxCells && state.r.some((r) => r >= ready)) {
    let centroidX = 0, centroidY = 0;
    if (o.orientation === "radial" || o.orientation === "tangential") {
      for (let c = 0; c < n0; c++) { centroidX += state.x[c]; centroidY += state.y[c]; }
      centroidX /= n0; centroidY /= n0;
    }
    const keep = emptyCells(), born = emptyCells();
    let count = n0;
    const scratch: number[] = [], scratchWeights: number[] = [];
    for (let c = 0; c < n0; c++) {
      if (!(state.r[c] >= ready && count < o.maxCells)) {
        keep.id.push(state.id[c]); keep.x.push(state.x[c]); keep.y.push(state.y[c]); keep.r.push(state.r[c]); keep.parent.push(state.parent[c]);
        keep.birth.push(state.birth[c]); keep.gen.push(state.gen[c]); keep.clan.push(state.clan[c]); keep.share.push(state.share[c]);
        continue;
      }
      const mother = elementId("cell", state.id[c]);
      const axisStream = ctx.stream(mother, "axis"), jitterStream = ctx.stream(mother, "jitter");
      const randomAngle = 2 * Math.PI * axisStream.next(), jitter = (2 * jitterStream.next() - 1) * o.orientJitter * rad;
      let angle = randomAngle;
      if (o.orientation === "fixed") angle = o.splitAngle * rad;
      else if (o.orientation === "gradient" || o.orientation === "across") {
        scratch.length = 0; scratchWeights.length = 0;
        charge(footprint(o, L, state.x[c], state.y[c], state.r[c], scratch, scratchWeights));
        const [gx, gy] = gradientAt(L, state.field, scratch);
        if (Math.hypot(gx, gy) > 1e-12 * L.cellArea) angle = Math.atan2(gy, gx) + (o.orientation === "across" ? Math.PI / 2 : 0);
      } else if (o.orientation === "radial" || o.orientation === "tangential") {
        const ex = state.x[c] - centroidX, ey = state.y[c] - centroidY;
        if (Math.hypot(ex, ey) > 1e-9) angle = Math.atan2(ey, ex) + (o.orientation === "tangential" ? Math.PI / 2 : 0);
      }
      angle += jitter;
      const ux = Math.cos(angle), uy = Math.sin(angle);
      const f = o.split, R0 = state.r[c];
      const r1 = R0 * Math.sqrt(f), r2 = R0 * Math.sqrt(1 - f), gap = r1 + r2;
      const a = state.next, b = a + 1;
      // The larger daughter leads along the axis; the centre of area stays at the mother's centre.
      const p1 = constrain(o, state.x[c] + ux * gap * (1 - f), state.y[c] + uy * gap * (1 - f), r1);
      const p2 = constrain(o, state.x[c] - ux * gap * f, state.y[c] - uy * gap * f, r2);
      state.dead.id.push(state.id[c]); state.dead.x.push(state.x[c]); state.dead.y.push(state.y[c]); state.dead.r.push(R0);
      state.dead.parent.push(state.parent[c]); state.dead.birth.push(state.birth[c]); state.dead.gen.push(state.gen[c]);
      state.dead.clan.push(state.clan[c]); state.dead.share.push(state.share[c]); state.dead.at.push(step);
      for (const [serial, radius, at, share] of [[a, r1, p1, f], [b, r2, p2, 1 - f]] as const) {
        born.id.push(serial); born.x.push(at[0]); born.y.push(at[1]); born.r.push(radius); born.parent.push(state.id[c]);
        born.birth.push(step); born.gen.push(state.gen[c] + 1); born.clan.push(state.clan[c]); born.share.push(share);
      }
      state.next += 2; count++;
      charge(8);
    }
    for (const key of ["id", "x", "y", "r", "parent", "birth", "gen", "clan", "share"] as const) state[key] = keep[key].concat(born[key]);
    if (count >= o.maxCells && state.fullAt < 0) state.fullAt = step;
  }
  if (state.id.length >= o.maxCells && state.fullAt < 0) state.fullAt = step;

  /* 5. relaxation */
  const n = state.id.length;
  const start = { x: state.x.slice(), y: state.y.slice() };
  if (o.stiffness > 0 && n > 1) {
    for (let pass = 0; pass < o.relax; pass++) {
      let rMax = 0;
      for (let c = 0; c < n; c++) if (state.r[c] > rMax) rMax = state.r[c];
      const grid = new PointGrid({ bounds: [0, 0, o.width, o.height], cellSize: Math.max(2 * rMax, 1), maxPoints: n + 1, onWork: charge });
      for (let c = 0; c < n; c++) grid.insert(state.id[c], state.x[c], state.y[c]);
      charge(n);
      const mx = new Float64Array(n), my = new Float64Array(n);
      for (let c = 0; c < n; c++) {
        const hits = grid.within(state.x[c], state.y[c], state.r[c] + rMax, { exclude: state.id[c] });
        for (const hit of hits) {
          let lo = 0, hi = n - 1;
          while (lo < hi) { const mid = (lo + hi) >> 1; if (state.id[mid] < hit.id) lo = mid + 1; else hi = mid; }
          const j = lo, target = (state.r[c] + state.r[j]) * (1 - o.overlap);
          if (!(hit.distance < target)) continue;
          let ux: number, uy: number;
          if (hit.distance > 0) { ux = (state.x[c] - state.x[j]) / hit.distance; uy = (state.y[c] - state.y[j]) / hit.distance; }
          else { const t = (state.id[c] + state.id[j]) * GOLDEN, sign = state.id[c] < state.id[j] ? 1 : -1; ux = sign * Math.cos(t); uy = sign * Math.sin(t); }
          const mc = state.r[c] * state.r[c], mj = state.r[j] * state.r[j];
          const push = o.stiffness * (target - hit.distance) * mj / (mc + mj);
          mx[c] += push * ux; my[c] += push * uy;
        }
      }
      for (let c = 0; c < n; c++) {
        const size = Math.hypot(mx[c], my[c]), cap = 0.5 * state.r[c], k = size > cap ? cap / size : 1;
        const [x, y] = constrain(o, state.x[c] + mx[c] * k, state.y[c] + my[c] * k, state.r[c]);
        state.x[c] = x; state.y[c] = y;
      }
      charge(n);
    }
  }

  /* 6. status */
  let moved = 0;
  if (n === n0) for (let c = 0; c < n; c++) moved = Math.max(moved, Math.hypot(state.x[c] - start.x[c], state.y[c] - start.y[c]));
  else moved = Infinity;
  if (L.sources.length === 0 && state.mass < COLONY_LIMITS.starvedNutrient) { state.halt = 2; state.haltAt = step; }
  else if (state.fullAt >= 0 && n === n0 && moved < COLONY_LIMITS.settleMove && state.r.every((r) => r >= ready)) { state.halt = 1; state.haltAt = step; }
  return state;
}

/** The static grid of a construction: `open[k]` is 1 where the field cell lies inside the boundary, `held[k]` 1 where a source holds it. */
export function fieldLayout(o: Readonly<ColonyOptions>): { readonly columns: number; readonly rows: number; readonly open: Readonly<Uint8Array>; readonly held: Readonly<Uint8Array> } {
  const L = layoutOf(o);
  return { columns: L.columns, rows: L.rows, open: L.open, held: L.isSource };
}

function frame(state: ColonyState, step: number): ColonyFrame {
  let area = 0;
  for (const r of state.r) area += Math.PI * r * r;
  return { step, cells: state.id.length, ancestors: state.dead.id.length, area, nutrient: state.mass, inflow: state.inflow, absorbed: state.absorbed, halt: state.halt };
}

export const cellDivisionSimulation: Simulation<ColonyState, ColonyOptions, ColonyFrame> = {
  id: "cell-division",
  limits: (o) => {
    const L = layoutOf(o);
    return { stepLimit: COLONY_LIMITS.maxSteps, workPerStep: L.budget, initialWork: L.columns * L.rows + o.seedCount };
  },
  initial: initialState,
  step: stepState,
  project: frame,
};

/* ------------------------------------------------------------------------------- producers */

/** Work bound of a run: the runner refuses a construction above it and names `Steps`, `Cell limit` or the field. */
export const MAX_COLONY_WORK = 1_500_000_000;

/** The seed changes the colony only where a stream is drawn: scatter seeds and every division axis but a fixed one. */
export function colonyUsesSeed(o: Pick<ColonyOptions, "seedLayout" | "orientation" | "orientJitter">): boolean {
  return o.seedLayout === "scatter" || o.orientation !== "fixed" || o.orientJitter > 0;
}

/** Pure placement/appearance-free construction: irrelevant fields are pinned so hidden edits reuse the same snapshot. */
export function colonyConstruction(o: Readonly<ColonyOptions>): ColonyOptions {
  const point = o.source === "point" || o.source === "pair";
  const edge = o.source === "edge";
  const on = o.source !== "none";
  return {
    ...o,
    sourceAngle: point || edge ? o.sourceAngle : 0,
    sourceOffset: point ? o.sourceOffset : 0,
    sourceSize: on ? o.sourceSize : 0,
    seedAngle: o.seedLayout === "scatter" ? 0 : o.seedAngle,
    seedSpread: o.seedCount === 1 && o.seedLayout !== "scatter" ? 0 : o.seedSpread,
    splitAngle: o.orientation === "fixed" ? o.splitAngle : 0,
    orientJitter: o.orientation === "random" ? 0 : o.orientJitter,
    stiffness: o.stiffness,
  };
}

const colonies = createSimulationCache({ capacity: 6 });

function runOptions(steps: number, cancelled?: () => boolean) {
  return { steps, checkpointEvery: COLONY_LIMITS.checkpointEvery, historyEvery: COLONY_LIMITS.historyEvery, maxWork: MAX_COLONY_WORK, cancelled };
}

const built = new WeakMap<object, Colony>();

function colonyFrom(snaps: Snapshots<ColonyState, ColonyOptions, ColonyFrame>): Colony {
  const hit = built.get(snaps);
  if (hit) return hit;
  const o = snaps.params as ColonyOptions, state = finalState(snaps);
  const L = layoutOf(o);
  const record = (kind: "live" | "dead", i: number): ColonyCell => {
    const t = kind === "live" ? state : state.dead;
    return Object.freeze({
      id: elementId("cell", t.id[i]), serial: t.id[i], parent: t.parent[i] < 0 ? null : elementId("cell", t.parent[i]),
      root: elementId("cell", t.clan[i]), birth: t.birth[i], generation: t.gen[i], radius: t.r[i],
      position: Object.freeze([t.x[i], t.y[i]] as const), share: t.share[i],
      divided: kind === "dead" ? state.dead.at[i] : null,
    });
  };
  const cells = state.id.map((_, i) => record("live", i)), ancestors = state.dead.id.map((_, i) => record("dead", i));
  const everyone = [...cells, ...ancestors].sort((a, b) => a.serial - b.serial);
  const lineage = graphFromParts({
    seed: snaps.seed, directed: true,
    nodes: everyone.map((cell) => ({ id: cell.id, position: cell.position })),
    edges: everyone.filter((cell) => cell.parent !== null).map((cell) => ({
      id: `e:${cell.parent}>${cell.id}`, from: cell.parent!, to: cell.id, weight: cell.share, age: snaps.steps - cell.birth + 1 })),
  });
  const values = new Array<number>(state.field.length);
  for (let k = 0; k < values.length; k++) values[k] = state.field[k] / L.cellArea;
  const field: DensityField = Object.freeze({ left: 0, top: 0, cell: o.fieldCell, columns: L.columns, rows: L.rows, values: Object.freeze(values), mass: state.mass, outside: 0, grains: 0 });
  const status: ColonyStatus = state.halt === 1 ? "settled" : state.halt === 2 ? "starved" : state.fullAt >= 0 ? "full" : "growing";
  let area = 0;
  for (const r of state.r) area += Math.PI * r * r;
  const colony: Colony = Object.freeze({
    options: snaps.params as ColonyOptions, seed: snaps.seed, steps: snaps.steps, status,
    fullAt: state.fullAt < 0 ? null : state.fullAt, haltedAt: state.haltAt < 0 ? null : state.haltAt,
    cells: Object.freeze(cells), ancestors: Object.freeze(ancestors), field, lineage,
    totals: Object.freeze({ area, nutrient: state.mass, inflow: state.inflow, absorbed: state.absorbed, births: state.next }),
    generations: everyone.reduce((deepest, cell) => Math.max(deepest, cell.generation), 0),
    snapshots: snaps,
  });
  built.set(snaps, colony);
  return colony;
}

/**
 * The colony after `steps` steps as a frozen value. The same construction (options, seed, steps) returns
 * the identical object; more steps extend a cached shorter run and fewer replay from its nearest checkpoint.
 * Throws an Error naming the control for anything invalid or over budget.
 */
export function cellColony(options: ColonyOptions, seed: number, steps: number): Colony {
  validateColony(options, steps);
  const construction = colonyConstruction(options);
  return colonyFrom(colonies.get(cellDivisionSimulation, construction, colonyUsesSeed(options) ? seed : 0, runOptions(steps)));
}

/** Cooperative `cellColony`; null if `cancelled()` said stop (nothing is cached). */
export async function prepareCellColony(options: ColonyOptions, seed: number, steps: number, cancelled: () => boolean): Promise<Colony | null> {
  validateColony(options, steps);
  const construction = colonyConstruction(options);
  const snaps = await colonies.prepare(cellDivisionSimulation, construction, colonyUsesSeed(options) ? seed : 0, runOptions(steps, cancelled));
  return snaps ? colonyFrom(snaps) : null;
}

/** The colony's frame at any step up to `colony.steps` (retained for every step). */
export function colonyFrameAt(colony: Colony, step: number): ColonyFrame {
  const entry = colony.snapshots.history.find((e) => e.step === step);
  if (!entry) throw new Error(`Step ${step} is outside 0 to ${colony.steps}`);
  return entry.value as ColonyFrame;
}

/** The cells of the colony at an earlier `step`, replayed from the nearest checkpoint (a scrub without re-running the colony). */
export function colonyAt(colony: Colony, step: number): Colony {
  const { snapshots } = colony;
  if (!Number.isInteger(step) || step < 0 || step > colony.steps) throw new Error(`Step ${step} is outside 0 to ${colony.steps}`);
  if (step === colony.steps) return colony;
  return cellColony(snapshots.params as ColonyOptions, snapshots.seed, step);
}

export { componentSeed };
