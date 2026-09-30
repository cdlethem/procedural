import { componentSeed } from "./core.js";
import { DomainWalls } from "./domain-walls.js";
import { domainRings, planarDomain, planarRegion, rectangleDomain, textDomain, type PlanarDomain, type PlanarRegion } from "./domains.js";
import { maskDomain } from "./domains-raster.js";
import { graphFromParts, type Graph } from "./graph.js";
import { bundledRaster, bundledRasterIds, type BundledRasterId } from "./raster-samples.js";
import { gridStorage, valueField } from "./raster.js";
import { canonicalKey, createSimulationCache, elementId, type Simulation, type SimulationCache, type Snapshots } from "./snapshots.js";
import { PointGrid } from "./spatial-index.js";
import type { CompositionRun, Path, Site } from "./types.js";
import { angleWalkStep } from "./walks.js";

/**
 * Aggregation colonies: a specified 2D off-lattice diffusion-limited-aggregation (DLA) model, run as an F7
 * `Simulation`. It is NOT Andy Lomas's 3D Aggregation process and makes no claim to reproduce it.
 *
 * THE MODEL (one growth step = one released walker, in this order, all draws from that walker's own
 * seeded streams `walker:<n>`):
 *  1. RELEASE. Up to `LAUNCH_TRIES` points are drawn from the source (ellipse, rectangle or line boundary,
 *     or uniformly inside the domain). A point is refused when it lies outside the arena, not strictly
 *     inside the domain by at least one particle radius, in a region of the domain that holds no seed (a
 *     walker there could never reach the colony), or within one contact distance of any grain. No
 *     acceptable point: the walker is `unlaunched` and the step ends. The arena is the canvas, the source,
 *     the seeds and the domain, grown by `escape` on every side; a walker leaving it is `escaped`.
 *  2. WALK. Up to `lifetime` micro-steps. Each moves the walker by at most `disp`: the angle stepper
 *     (`angleWalkStep`, heading change within ±`turn`) plus a drift of `bias` (toward `biasAngle`) and
 *     `pull` (toward the seed centre), both fractions of the random step. `disp` is the largest distance
 *     that cannot touch anything: the distance to the nearest grain minus the contact distance, the
 *     distance to the nearest wall minus the particle radius, capped at `reach`, and at least
 *     `radius / 2`. This is the "walk on spheres" shortcut: a walker far from the colony crosses empty
 *     space in a few steps, and no contact can be missed. A step outside the arena ends the walker
 *     (`escaped`); a step whose segment comes within one radius of a wall is refused and the walker
 *     stays (a reflecting obstacle; a wall thinner than a step can never be crossed).
 *  3. ATTACH. A step that would land within `contact = 2 × radius` of a grain sticks with probability
 *     `stick` (a fixed draw per micro-step, so changing `stick` never moves a walk before its first
 *     contact) and is otherwise refused. On sticking, the new grain is placed on the circle of radius
 *     `contact` about its PARENT along the ray from the parent to the landing point. The parent is the
 *     nearest grain to the landing point; among equal distances the LOWEST id (`PointGrid.nearest`). A
 *     placement whose parent link would leave the domain or come within one radius of a wall is refused.
 *  4. END. A walker that used its whole `lifetime` is `timedOut`. `patience` consecutive walkers that
 *     neither attach nor find a way to (escaped, timed out, unlaunched) STALL the colony: the status
 *     becomes `stalled`, `stalledAt` records the step, and every later step is a no-op. Steps are bounded
 *     by `COLONY_LIMITS.maxSteps`, so a colony never holds more than about 12,400 grains.
 *
 * Analytic consequences (tested): every non-seed grain is exactly `contact` from its parent; no two
 * grains are closer than `contact / 2` (a walker is outside `contact` of everything before its last
 * micro-step, which moves it at most `radius / 2 = contact / 4`, and the projection onto the parent
 * moves it at most `contact / 4` more); grains keep at least one radius from every wall; ids and
 * parent links only ever append when `steps` grows.
 *
 * OUTPUT. `Colony` is a deeply frozen value cached by construction (the `Snapshots` object): `sites` in
 * birth order with stable ids `grain:<n>` (seeds are `grain:0…`, then each attached walker in order), the
 * parent links as a `Graph` forest (edges `e:<parent>|<child>` directed parent → child, `age` = steps − born
 * + 1 so older is larger, `weight` = the child's share of its tree's tips), attachment step, depth, limb,
 * subtree mass and tip flags. Colour, mark, ink and reveal never enter the key: a recolour repaints the
 * same `Snapshots` and the same `Colony` object.
 *
 * INPUTS AND OWNERSHIP. Seeds, source and domain are typed values. A domain is a `PlanarDomain` (any
 * holes and separate regions are obstacles) or a bundled construction (rectangle, ellipse, ring, letters,
 * a thresholded bundled image); persisted instruments name only the bundled constructions. Host-owned
 * masks or regions enter through `{ kind: "domain", domain }`; binding a user's own asset in Studio is
 * future host work. The domain's content is part of the simulation id, so an equal shape hits the same
 * cache entry and an edited one recomputes.
 *
 * UNITS. Canvas units (the 640 reference canvas), degrees for angles, dimensionless fractions for `stick`,
 * `bias`, `pull`, `hole`. Steps are released walkers.
 *
 * FAILURE AND BOUNDS. Invalid options throw an Error naming the control. `steps × (lifetime + LAUNCH_TRIES + 1)`
 * may not exceed `COLONY_LIMITS.maxWork` micro-steps (the error names Growth steps and Walker lifetime);
 * steps ≤ 12,000, seeds ≤ 400, so grains ≤ 12,400 (below the graph limit). State is at most about
 * 90,000 values and a run keeps a checkpoint every 250 steps. An empty result (no seed fits inside the
 * domain and arena, or a domain with no area) is a valid state: zero grains, `stalled`, with the counts.
 */

export const COLONY_LIMITS = Object.freeze({
  maxSteps: 12_000,
  maxSeeds: 400,
  maxLifetime: 20_000,
  /** Walker micro-steps a run may spend in the worst case (every walker using its whole lifetime). */
  maxWork: 60_000_000,
  /** Release attempts per walker. */
  launchTries: 24,
  /** The 640-unit reference canvas the arena is built around. */
  canvas: 640,
  maxEscape: 400,
  checkpointEvery: 250,
  maxCoordinate: 5_000,
  /** A limb is a subtree of at most this share of the heaviest tree's grains (see `ColonySite.limb`). */
  limbShare: 1 / 6,
});

export type SeedShape = "point" | "ring" | "line" | "scatter";
export type SourceShape = "ellipse" | "rectangle" | "line" | "inside";

/** Where the colony starts. `ring` and `scatter` fill an ellipse `width × height`; `line` is `width` long; all turn by `angle` degrees about `(x, y)`. */
export interface SeedSpec { shape: SeedShape; count: number; x: number; y: number; width: number; height: number; angle: number }
/** Where walkers are released. `ellipse` and `rectangle` release from their boundary, `line` along its length, `inside` uniformly in the domain (the canvas when there is none). */
export interface SourceSpec { shape: SourceShape; x: number; y: number; width: number; height: number; angle: number }

export type ColonyDomainSpec =
  | { kind: "none" }
  | { kind: "rectangle" | "ellipse"; x: number; y: number; width: number; height: number }
  | { kind: "ring"; x: number; y: number; width: number; height: number; /** Hole size as a fraction of the outer ellipse, in (0, 0.95]. */ hole: number }
  | { kind: "letters"; text: string; x: number; y: number; width: number; height: number }
  | { kind: "image"; id: BundledRasterId; variant: number; /** Luminance at or above which a pixel is inside. */ threshold: number; x: number; y: number; width: number; height: number }
  | { kind: "domain"; domain: PlanarDomain };

export interface WalkerSpec {
  /** Particle radius: grains touch their parent at twice this distance. */
  radius: number;
  /** Probability of sticking on contact, in [0.005, 1]. */
  stick: number;
  /** Drift toward `biasAngle`, as a fraction of each random step, in [0, 0.9]. */
  bias: number;
  /** Direction of the drift in degrees (canvas y grows down, so 90 is toward the bottom). */
  biasAngle: number;
  /** Drift toward the seed centre `(seeds.x, seeds.y)`, as a fraction of each random step, in [0, 0.9]. */
  pull: number;
  /** Largest heading change per micro-step in degrees; 180 is a free random walk. */
  turn: number;
}

export interface GrowthSpec {
  /** Longest step in free space, canvas units. */
  reach: number;
  /** Most micro-steps a walker takes before it is abandoned. */
  lifetime: number;
  /** Consecutive failed walkers that stall the colony. */
  patience: number;
  /** How far past the canvas edge a walker may wander before it is lost. */
  escape: number;
}

export interface ColonyOptions { seed: number; seeds: SeedSpec; source: SourceSpec; domain: ColonyDomainSpec; walker: WalkerSpec; growth: GrowthSpec }

/** Frozen site of the colony: a `Site` (upright, unit scale) with the attachment structure. */
export interface ColonySite extends Site {
  /** Birth-order serial: the id is `grain:<index>`. */
  readonly index: number;
  /** Serial of the parent grain, or -1 for a seed. */
  readonly parent: number;
  /** Step at which the grain attached; 0 for seeds. */
  readonly born: number;
  /** Links from the seed grain of its tree. */
  readonly depth: number;
  /** Serial of the seed grain of its tree. */
  readonly root: number;
  /**
   * Which limb the grain belongs to: each seed and its trunk are one limb; a subtree of at most a sixth of the
   * heaviest tree that hangs from a heavier grain starts a new limb, numbered in birth order. Derived from the
   * final colony, so a longer run can regroup limbs (ids never change).
   */
  readonly limb: number;
  /** Direct children. */
  readonly children: number;
  /** Grains in the subtree including this one. */
  readonly mass: number;
  /** An attached grain with no children: an active tip. */
  readonly tip: boolean;
}

export type ColonyStatus = "growing" | "stalled";

export interface Colony {
  readonly seed: number;
  readonly steps: number;
  readonly radius: number;
  /** Twice the radius: the distance from a grain to its parent. */
  readonly contact: number;
  readonly sites: readonly ColonySite[];
  /** Parent links as a directed forest; see the header. */
  readonly graph: Graph;
  readonly status: ColonyStatus;
  /** Step at which patience ran out, or null while growing. */
  readonly stalledAt: number | null;
  readonly counts: Readonly<{ seeds: number; attached: number; released: number; escaped: number; timedOut: number; unlaunched: number }>;
  readonly maxDepth: number;
  readonly maxMass: number;
  /** Cluster bounds `[left, top, right, bottom]` of the grain centres; null when empty. */
  readonly bounds: readonly [number, number, number, number] | null;
  /** The domain the walkers were held in, or null. */
  readonly domain: PlanarDomain | null;
  /** The snapshots this value was read from; equal construction returns the same object. */
  readonly snapshots: Snapshots<ColonyState, ColonyParams, ColonyFrame>;
}

/* ------------------------------------------------------------------------------ checks */

const finite = (label: string, value: number, low: number, high: number, integer = false): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high || (integer && !Number.isInteger(value)))
    throw new Error(`${label} must be ${integer ? "an integer" : "a number"} from ${low} to ${high}`);
  return value;
};
const oneOf = <T extends string>(label: string, value: string, allowed: readonly T[]): T => {
  if (!(allowed as readonly string[]).includes(value)) throw new Error(`${label} must be one of ${allowed.join(", ")}`);
  return value as T;
};
const position = (label: string, value: number): number => finite(label, value, -COLONY_LIMITS.maxCoordinate, COLONY_LIMITS.maxCoordinate);
const noNegativeZero = (value: number): number => (value === 0 ? 0 : value);

/** Validate everything but the simulation itself; every message names the control to change. */
export function checkColonyOptions(options: ColonyOptions): void {
  if (!Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) throw new Error("Colony seed must be a uint32 integer");
  const { seeds, source, walker, growth } = options;
  oneOf("Seed shape", seeds.shape, ["point", "ring", "line", "scatter"] as const);
  finite("Seed grains", seeds.count, 1, COLONY_LIMITS.maxSeeds, true);
  position("Seed X", seeds.x); position("Seed Y", seeds.y);
  finite("Seed width", seeds.width, 0, 4000); finite("Seed height", seeds.height, 0, 4000);
  finite("Seed angle", seeds.angle, -3600, 3600);
  oneOf("Source", source.shape, ["ellipse", "rectangle", "line", "inside"] as const);
  position("Source X", source.x); position("Source Y", source.y);
  finite("Source width", source.width, 0, 8000); finite("Source height", source.height, 0, 8000);
  finite("Source angle", source.angle, -3600, 3600);
  finite("Particle radius", walker.radius, 0.75, 40);
  finite("Sticking probability", walker.stick, 0.005, 1);
  finite("Wind", walker.bias, 0, 0.9); finite("Wind direction", walker.biasAngle, -3600, 3600);
  finite("Pull to the seed", walker.pull, 0, 0.9);
  finite("Path turning", walker.turn, 5, 180);
  finite("Step reach", growth.reach, walker.radius / 2, 400);
  finite("Walker lifetime", growth.lifetime, 10, COLONY_LIMITS.maxLifetime, true);
  finite("Give up after", growth.patience, 1, 5000, true);
  finite("Escape margin", growth.escape, 0, COLONY_LIMITS.maxEscape);
  const d = options.domain;
  oneOf("Domain", d.kind, ["none", "rectangle", "ellipse", "ring", "letters", "image", "domain"] as const);
  if (d.kind === "none") return;
  if (d.kind === "domain") { if (!d.domain || !Array.isArray(d.domain.regions)) throw new Error("Domain must be a PlanarDomain"); return; }
  position("Domain X", d.x); position("Domain Y", d.y);
  finite("Domain width", d.width, 1, 4000); finite("Domain height", d.height, 1, 4000);
  if (d.kind === "ring") finite("Hole size", d.hole, 0.02, 0.95);
  if (d.kind === "letters") { if (typeof d.text !== "string" || d.text.length < 1 || d.text.length > 20) throw new Error("Letters must be 1 to 20 characters"); }
  if (d.kind === "image") {
    oneOf("Domain image", d.id, bundledRasterIds);
    finite("Image variant", d.variant, 0, 0xffffffff, true); finite("Image threshold", d.threshold, 0, 1);
  }
}

/** The work a run may spend, in walker micro-steps: the bound `steps` is measured against. */
export const colonyWorkBound = (steps: number, lifetime: number): number => steps * (lifetime + COLONY_LIMITS.launchTries + 1);

/** Validate the step count and the run's worst-case work; the message names Growth steps and Walker lifetime. */
export function checkColonySteps(steps: number, growth: GrowthSpec): void {
  finite("Growth steps", steps, 0, COLONY_LIMITS.maxSteps, true);
  const work = colonyWorkBound(steps, growth.lifetime);
  if (work > COLONY_LIMITS.maxWork)
    throw new Error(`Growth steps ${steps} × Walker lifetime ${growth.lifetime} would allow ${work} walker steps; the limit is ${COLONY_LIMITS.maxWork}. Lower Growth steps or Walker lifetime`);
}

/* ------------------------------------------------------------------------------ domains */

const ELLIPSE_VERTICES = 96;
const IMAGE_SIDE = 128;
const RAD = Math.PI / 180;

function ellipseRing(x: number, y: number, width: number, height: number): [number, number][] {
  const ring: [number, number][] = [];
  for (let k = 0; k < ELLIPSE_VERTICES; k++) {
    const a = 2 * Math.PI * k / ELLIPSE_VERTICES;
    ring.push([x + Math.cos(a) * width / 2, y + Math.sin(a) * height / 2]);
  }
  return ring;
}

const builtDomains = new Map<string, PlanarDomain>();

/**
 * The planar domain a spec describes, or null for `none`. Bundled constructions are cached by their
 * canonical spec (least recently used, 8 entries); a supplied domain is returned as it is.
 */
export function colonyDomain(spec: ColonyDomainSpec): PlanarDomain | null {
  if (spec.kind === "none") return null;
  if (spec.kind === "domain") return spec.domain;
  const key = canonicalKey(spec);
  const hit = builtDomains.get(key);
  if (hit) { builtDomains.delete(key); builtDomains.set(key, hit); return hit; }
  const id = `colony-${spec.kind}`;
  let domain: PlanarDomain;
  switch (spec.kind) {
    case "rectangle":
      domain = rectangleDomain([{ id, bounds: [spec.x - spec.width / 2, spec.y - spec.height / 2, spec.x + spec.width / 2, spec.y + spec.height / 2] }], { id });
      break;
    case "ellipse": domain = planarDomain(planarRegion({ id, outer: ellipseRing(spec.x, spec.y, spec.width, spec.height) }), { id }); break;
    case "ring":
      domain = planarDomain(planarRegion({ id, outer: ellipseRing(spec.x, spec.y, spec.width, spec.height),
        holes: [ellipseRing(spec.x, spec.y, spec.width * spec.hole, spec.height * spec.hole)] }), { id });
      break;
    case "letters": domain = textDomain(spec.text, { centerX: spec.x, centerY: spec.y, width: spec.width, height: spec.height, id }); break;
    case "image": {
      const grid = valueField(bundledRaster(spec.id, spec.variant, IMAGE_SIDE), "luminance");
      const side = Math.min(spec.width, spec.height), cell = side / IMAGE_SIDE;
      domain = maskDomain({ width: IMAGE_SIDE, height: IMAGE_SIDE, data: gridStorage(grid) },
        { threshold: spec.threshold, mode: "contour", cell, origin: [spec.x - side / 2, spec.y - side / 2], simplify: cell / 2, id });
      break;
    }
  }
  builtDomains.set(key, domain);
  if (builtDomains.size > 8) builtDomains.delete(builtDomains.keys().next().value!);
  return domain;
}

const prints = new WeakMap<PlanarDomain, string>();
/** A content hash of a domain's rings: equal shapes get equal simulation ids whatever object carries them. */
function domainPrint(domain: PlanarDomain): string {
  const hit = prints.get(domain);
  if (hit) return hit;
  const scratch = new Float64Array(1), words = new Uint32Array(scratch.buffer);
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x9e3779b9;
  const mix = (word: number) => { a = Math.imul(a ^ word, 0x01000193) >>> 0; b = Math.imul(b + word + (a >>> 7), 0x85ebca6b) >>> 0; };
  for (const ring of domainRings(domain)) {
    mix(ring.length);
    for (const [x, y] of ring) { scratch[0] = x; mix(words[0]); mix(words[1]); scratch[0] = y; mix(words[0]); mix(words[1]); }
  }
  const print = `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}:${domain.regions.length}`;
  prints.set(domain, print);
  return print;
}

/* ------------------------------------------------------------------------------ simulation */

/** Everything that shapes a walker or the seeds, and nothing about appearance or the step count. */
export interface ColonyParams {
  seedShape: SeedShape; seedCount: number; seedX: number; seedY: number; seedWidth: number; seedHeight: number; seedAngle: number;
  source: SourceShape; sourceX: number; sourceY: number; sourceWidth: number; sourceHeight: number; sourceAngle: number;
  radius: number; stick: number; bias: number; biasAngle: number; pull: number; turn: number;
  reach: number; lifetime: number; patience: number; escape: number;
}

/** The simulation parameters of some options: controls that cannot matter for the chosen shapes are zeroed, so they never split the cache. */
export function colonyParams(options: ColonyOptions): ColonyParams {
  const { seeds, source, walker, growth } = options;
  const lineSeed = seeds.shape === "line", pointSeed = seeds.shape === "point", inside = source.shape === "inside";
  const raw: ColonyParams = {
    seedShape: seeds.shape, seedCount: pointSeed ? 1 : seeds.count, seedX: seeds.x, seedY: seeds.y,
    seedWidth: pointSeed ? 0 : seeds.width, seedHeight: pointSeed || lineSeed ? 0 : seeds.height, seedAngle: pointSeed ? 0 : seeds.angle,
    source: source.shape, sourceX: inside ? 0 : source.x, sourceY: inside ? 0 : source.y, sourceWidth: inside ? 0 : source.width,
    sourceHeight: inside || source.shape === "line" ? 0 : source.height, sourceAngle: inside ? 0 : source.angle,
    radius: walker.radius, stick: walker.stick, bias: walker.bias, biasAngle: walker.bias === 0 ? 0 : walker.biasAngle, pull: walker.pull, turn: walker.turn,
    reach: growth.reach, lifetime: growth.lifetime, patience: growth.patience, escape: growth.escape,
  };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) out[key] = typeof value === "number" ? noNegativeZero(value) : value;
  return out as unknown as ColonyParams;
}

/** Mutable working state; plain data plus the spatial index, so checkpoints copy it exactly. */
export interface ColonyState {
  x: number[]; y: number[]; parent: number[]; born: number[];
  grid: PointGrid;
  minX: number; minY: number; maxX: number; maxY: number;
  seeds: number;
  /** Indices of the domain's regions that hold a seed; walkers are released only into these when some region holds none. */
  live: number[];
  released: number; escaped: number; timedOut: number; unlaunched: number;
  /** Consecutive walkers that did not attach. */
  failures: number;
  /** 0 growing, 1 stalled. */
  status: number;
  /** Step at which the colony stalled, or -1. */
  stalledAt: number;
}

/** What a retained step publishes (typed arrays are private copies: read-only). */
export interface ColonyFrame {
  x: Float64Array; y: Float64Array; parent: Int32Array; born: Int32Array;
  seeds: number; released: number; escaped: number; timedOut: number; unlaunched: number; status: number; stalledAt: number;
}

/**
 * The arena walkers may live in: the canvas, the source, the seeds and the domain, grown by `escape` on
 * every side. A walker that leaves it is lost. Source and seed shapes count by their circumscribed circle.
 */
function arenaOf(p: ColonyParams, domain: PlanarDomain | null): readonly [number, number, number, number] {
  let left = 0, top = 0, right: number = COLONY_LIMITS.canvas, bottom: number = COLONY_LIMITS.canvas;
  const grow = (x: number, y: number, reach: number) => { left = Math.min(left, x - reach); top = Math.min(top, y - reach); right = Math.max(right, x + reach); bottom = Math.max(bottom, y + reach); };
  grow(p.seedX, p.seedY, p.seedShape === "point" ? 0 : p.seedShape === "line" ? p.seedWidth / 2 : Math.hypot(p.seedWidth, p.seedHeight) / 2);
  if (p.source !== "inside") grow(p.sourceX, p.sourceY, p.source === "line" ? p.sourceWidth / 2 : Math.hypot(p.sourceWidth, p.sourceHeight) / 2);
  if (domain?.bounds) { left = Math.min(left, domain.bounds[0]); top = Math.min(top, domain.bounds[1]); right = Math.max(right, domain.bounds[2]); bottom = Math.max(bottom, domain.bounds[3]); }
  return [left - p.escape, top - p.escape, right + p.escape, bottom + p.escape];
}

/** Cell side of the grain index: about the longest neighbourhood a step queries, and coarse enough to keep the grid at about a million cells. */
const cellSize = (p: ColonyParams, arena: readonly [number, number, number, number]): number =>
  Math.max(2 * p.radius, p.reach / 3, 1.5, Math.max(arena[2] - arena[0], arena[3] - arena[1]) / 1000);

export interface Box { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

/** The box `inside` releases into: the live regions' bounds within the arena, or the canvas when there is no domain. */
function insideBox(domain: PlanarDomain | null, arena: readonly [number, number, number, number], live: readonly PlanarRegion[] | null): Box {
  if (!domain || !domain.bounds) return { left: 0, top: 0, right: COLONY_LIMITS.canvas, bottom: COLONY_LIMITS.canvas };
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const region of live ?? domain.regions) { l = Math.min(l, region.bounds[0]); t = Math.min(t, region.bounds[1]); r = Math.max(r, region.bounds[2]); b = Math.max(b, region.bounds[3]); }
  return { left: Math.max(l, arena[0]), top: Math.max(t, arena[1]), right: Math.min(r, arena[2]), bottom: Math.min(b, arena[3]) };
}

const canvasBox: Box = { left: 0, top: 0, right: COLONY_LIMITS.canvas, bottom: COLONY_LIMITS.canvas };

/**
 * Where two uniform draws `(u, v)` release a walker: `ellipse` at angle `2πu` on the boundary, `rectangle` at
 * fraction `u` of the perimeter walked clockwise from the top-left corner (y grows down), `line` at
 * `(u − ½) × width` along the line, `inside` uniformly in `box`. Shapes turn by `angle` degrees about `(x, y)`.
 */
export function colonyReleasePoint(source: SourceSpec, u: number, v: number, box: Box = canvasBox): [number, number] {
  if (source.shape === "inside") return [box.left + u * (box.right - box.left), box.top + v * (box.bottom - box.top)];
  let lx: number, ly: number;
  const w = source.width, h = source.height;
  if (source.shape === "ellipse") { const a = 2 * Math.PI * u; lx = Math.cos(a) * w / 2; ly = Math.sin(a) * h / 2; }
  else if (source.shape === "line") { lx = (u - 0.5) * w; ly = 0; }
  else {
    const t = u * 2 * (w + h);
    if (t < w) { lx = -w / 2 + t; ly = -h / 2; }
    else if (t < w + h) { lx = w / 2; ly = -h / 2 + (t - w); }
    else if (t < 2 * w + h) { lx = w / 2 - (t - w - h); ly = h / 2; }
    else { lx = -w / 2; ly = h / 2 - (t - 2 * w - h); }
  }
  const c = Math.cos(source.angle * RAD), s = Math.sin(source.angle * RAD);
  return [source.x + lx * c - ly * s, source.y + lx * s + ly * c];
}

/** The seed candidates in a fixed order; `scatter` draws two numbers per candidate from one stream. */
function seedCandidates(p: ColonyParams, uniform: () => number): [number, number][] {
  const c = Math.cos(p.seedAngle * RAD), s = Math.sin(p.seedAngle * RAD);
  const at = (lx: number, ly: number): [number, number] => [p.seedX + lx * c - ly * s, p.seedY + lx * s + ly * c];
  const out: [number, number][] = [];
  switch (p.seedShape) {
    case "point": out.push([p.seedX, p.seedY]); break;
    case "ring": for (let k = 0; k < p.seedCount; k++) { const a = 2 * Math.PI * k / p.seedCount; out.push(at(Math.cos(a) * p.seedWidth / 2, Math.sin(a) * p.seedHeight / 2)); } break;
    case "line": for (let k = 0; k < p.seedCount; k++) out.push(at(p.seedCount === 1 ? 0 : (k / (p.seedCount - 1) - 0.5) * p.seedWidth, 0)); break;
    case "scatter": for (let k = 0; k < p.seedCount; k++) { const r = Math.sqrt(uniform()), a = 2 * Math.PI * uniform(); out.push(at(r * Math.cos(a) * p.seedWidth / 2, r * Math.sin(a) * p.seedHeight / 2)); } break;
  }
  return out;
}

const regionWalls = new WeakMap<PlanarRegion, DomainWalls>();
const wallsOfRegion = (region: PlanarRegion): DomainWalls => {
  let walls = regionWalls.get(region);
  if (!walls) { walls = new DomainWalls(region); regionWalls.set(region, walls); }
  return walls;
};

const simulations = new WeakMap<object, Simulation<ColonyState, ColonyParams, ColonyFrame>>();
const noDomain = {};

/** The colony model for one domain (or none). One instance per domain object; its id carries the domain's content hash. */
export function colonySimulation(domain: PlanarDomain | null): Simulation<ColonyState, ColonyParams, ColonyFrame> {
  const owner = domain ?? noDomain;
  const hit = simulations.get(owner);
  if (hit) return hit;
  const walls = domain ? new DomainWalls(domain) : null;
  const made: Simulation<ColonyState, ColonyParams, ColonyFrame> = {
    id: domain ? `aggregation-colony|${domainPrint(domain)}` : "aggregation-colony",
    limits: (p) => ({ stepLimit: COLONY_LIMITS.maxSteps, workPerStep: p.lifetime + COLONY_LIMITS.launchTries + 1, initialWork: COLONY_LIMITS.maxSeeds + 1 }),

    initial(ctx) {
      const p = ctx.params;
      const contact = 2 * p.radius, arena = arenaOf(p, domain);
      const grid = new PointGrid({ bounds: arena as [number, number, number, number], cellSize: cellSize(p, arena), maxPoints: COLONY_LIMITS.maxSteps + COLONY_LIMITS.maxSeeds + 1 });
      const state: ColonyState = { x: [], y: [], parent: [], born: [], grid, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity,
        seeds: 0, live: [], released: 0, escaped: 0, timedOut: 0, unlaunched: 0, failures: 0, status: 0, stalledAt: -1 };
      const stream = p.seedShape === "scatter" ? ctx.stream("seeds", "scatter") : null;
      const candidates = seedCandidates(p, () => stream!.next());
      ctx.charge(candidates.length);
      for (const [x, y] of candidates) {
        if (x < arena[0] || y < arena[1] || x > arena[2] || y > arena[3]) continue;
        if (walls && !(walls.inside(x, y) && walls.gap(x, y, p.radius) >= p.radius)) continue;
        if (grid.nearest(x, y, { maxDistance: contact / 2 })) continue;
        const id = state.x.length;
        state.x.push(x); state.y.push(y); state.parent.push(-1); state.born.push(0);
        grid.insert(id, x, y);
        state.minX = Math.min(state.minX, x); state.maxX = Math.max(state.maxX, x); state.minY = Math.min(state.minY, y); state.maxY = Math.max(state.maxY, y);
      }
      state.seeds = state.x.length;
      if (state.seeds === 0) { state.status = 1; state.stalledAt = 0; }
      else if (domain) {
        // Regions with a seed are live; a walker released into any other region could never reach the colony.
        const live = new Set<number>();
        for (let k = 0; k < state.seeds; k++) domain.regions.forEach((region, r) => {
          const b = region.bounds;
          if (state.x[k] >= b[0] && state.x[k] <= b[2] && state.y[k] >= b[1] && state.y[k] <= b[3] && wallsOfRegion(region).inside(state.x[k], state.y[k])) live.add(r);
        });
        state.live = [...live].sort((a, b) => a - b);
      }
      return state;
    },

    step(state, ctx) {
      if (state.status !== 0) { ctx.charge(1); return state; }
      const p = ctx.params;
      const radius = p.radius, contact = 2 * radius, minStep = radius / 2, reach = Math.max(p.reach, minStep);
      const arena = arenaOf(p, domain);
      const filtered = domain !== null && state.live.length > 0 && state.live.length < domain.regions.length;
      const liveRegions = filtered ? state.live.map((r) => domain.regions[r]) : null;
      const box = insideBox(domain, arena, liveRegions);
      const drift = p.bias + p.pull, turn = p.turn * RAD;
      const windX = Math.cos(p.biasAngle * RAD) * p.bias, windY = Math.sin(p.biasAngle * RAD) * p.bias;
      const id = elementId("walker", state.released++);
      let used = 0;

      // RELEASE
      const launch = ctx.stream(id, "launch");
      const source: SourceSpec = { shape: p.source, x: p.sourceX, y: p.sourceY, width: p.sourceWidth, height: p.sourceHeight, angle: p.sourceAngle };
      let at: [number, number] = [0, 0];
      let released = false;
      for (let attempt = 0; attempt < COLONY_LIMITS.launchTries; attempt++) {
        used++;
        const u = launch.next();
        at = colonyReleasePoint(source, u, launch.next(), box);
        if (!(at[0] >= arena[0] && at[1] >= arena[1] && at[0] <= arena[2] && at[1] <= arena[3])) continue;
        if (walls && !(walls.inside(at[0], at[1]) && walls.gap(at[0], at[1], radius) >= radius)) continue;
        if (liveRegions && !liveRegions.some((region) => wallsOfRegion(region).inside(at[0], at[1]))) continue;
        if (state.grid.nearest(at[0], at[1], { maxDistance: contact })) continue;
        released = true; break;
      }
      // Released facing the seeds, off by at most `turn` (and 90°): the heading only matters when `turn` is below 180.
      let heading = Math.atan2(p.seedY - at[1], p.seedX - at[0]) + (launch.next() * 2 - 1) * Math.min(turn, Math.PI / 2);
      let attached = false, escaped = false;
      if (released) {
        // WALK
        const walk = ctx.stream(id, "walk");
        let x = at[0], y = at[1];
        for (let micro = 0; micro < p.lifetime && !attached && !escaped; micro++) {
          used++;
          let free = reach;
          const dx = Math.max(state.minX - x, 0, x - state.maxX), dy = Math.max(state.minY - y, 0, y - state.maxY);
          if (Math.hypot(dx, dy) - contact < reach) {
            const near = state.grid.nearest(x, y, { maxDistance: reach + contact });
            if (near) free = near.distance - contact;
          }
          let disp = Math.min(reach, free);
          if (walls) disp = Math.min(disp, walls.gap(x, y, reach + radius) - radius);
          disp = Math.max(minStep, disp);
          const length = disp / (1 + drift);
          const toX = p.seedX - x, toY = p.seedY - y, toLength = Math.hypot(toX, toY);
          const pull = toLength > 0 ? p.pull * length / toLength : 0;
          const moved = angleWalkStep(x, y, heading, walk, { length, turn });
          const nx = moved.x + windX * length + toX * pull, ny = moved.y + windY * length + toY * pull;
          const stickDraw = walk.next();
          heading = moved.heading;
          if (!(nx >= arena[0] && ny >= arena[1] && nx <= arena[2] && ny <= arena[3])) { escaped = true; break; }
          if (walls && !walls.clear(x, y, nx, ny, radius)) continue;
          if (free < minStep) {
            const parent = state.grid.nearest(nx, ny, { maxDistance: contact });
            if (parent) {
              // ATTACH
              if (stickDraw >= p.stick) continue;
              const px = state.x[parent.id], py = state.y[parent.id];
              let ox = nx - px, oy = ny - py;
              const away = Math.hypot(ox, oy);
              if (away > 1e-12) { ox /= away; oy /= away; } else { ox = Math.cos(heading); oy = Math.sin(heading); }
              const gx = px + ox * contact, gy = py + oy * contact;
              if (!(gx >= arena[0] && gy >= arena[1] && gx <= arena[2] && gy <= arena[3])) continue;
              if (walls && !walls.clear(px, py, gx, gy, radius)) continue;
              const grain = state.x.length;
              state.x.push(gx); state.y.push(gy); state.parent.push(parent.id); state.born.push(ctx.step);
              state.grid.insert(grain, gx, gy);
              state.minX = Math.min(state.minX, gx); state.maxX = Math.max(state.maxX, gx); state.minY = Math.min(state.minY, gy); state.maxY = Math.max(state.maxY, gy);
              attached = true;
              break;
            }
          }
          x = nx; y = ny;
        }
        if (!attached) { if (escaped) state.escaped++; else state.timedOut++; }
      } else state.unlaunched++;
      ctx.charge(used);
      if (attached) state.failures = 0;
      else if (++state.failures >= p.patience) { state.status = 1; state.stalledAt = ctx.step; }
      return state;
    },

    project(state) {
      return { x: Float64Array.from(state.x), y: Float64Array.from(state.y), parent: Int32Array.from(state.parent), born: Int32Array.from(state.born),
        seeds: state.seeds, released: state.released, escaped: state.escaped, timedOut: state.timedOut, unlaunched: state.unlaunched,
        status: state.status, stalledAt: state.stalledAt };
    },
  };
  simulations.set(owner, made);
  return made;
}

/* ------------------------------------------------------------------------------ running */

const cache: SimulationCache = createSimulationCache({ capacity: 6 });

/** Retained snapshots by construction: a longer `steps` extends a cached run and a recolour never asks again. */
export const colonyCache = cache;

interface Request { steps: number; cancelled?: () => boolean; run?: CompositionRun }

function runOptions(steps: number, request: Request) {
  return { steps, checkpointEvery: COLONY_LIMITS.checkpointEvery, historyEvery: 0, maxWork: COLONY_LIMITS.maxWork, cancelled: request.cancelled, run: request.run };
}

/** Grow a colony for `steps` released walkers (cached). Throws naming the control that is invalid or over budget. */
export function growColony(options: ColonyOptions, steps: number, request: Omit<Request, "steps"> = {}): Colony {
  checkColonyOptions(options); checkColonySteps(steps, options.growth);
  const domain = colonyDomain(options.domain);
  const snaps = cache.get(colonySimulation(domain), colonyParams(options), options.seed, runOptions(steps, { ...request, steps }));
  return colonyOf(snaps, domain);
}

/** Whether this exact construction (options and steps) is already cached: a cancelled or failed run never is. */
export function colonyIsCached(options: ColonyOptions, steps: number): boolean {
  return cache.has(colonySimulation(colonyDomain(options.domain)), colonyParams(options), options.seed, runOptions(steps, { steps }));
}

/** Cooperative `growColony`: time-sliced, cancellable between walkers; null when cancelled (nothing is cached). */
export async function prepareColony(options: ColonyOptions, steps: number, cancelled: () => boolean): Promise<Colony | null> {
  checkColonyOptions(options); checkColonySteps(steps, options.growth);
  const domain = colonyDomain(options.domain);
  const snaps = await cache.prepare(colonySimulation(domain), colonyParams(options), options.seed, runOptions(steps, { steps, cancelled }));
  return snaps ? colonyOf(snaps, domain) : null;
}

/* ------------------------------------------------------------------------------ the published value */

const colonies = new WeakMap<object, Colony>();

function colonyOf(snaps: Snapshots<ColonyState, ColonyParams, ColonyFrame>, domain: PlanarDomain | null): Colony {
  const hit = colonies.get(snaps);
  if (hit) return hit;
  const frame = snaps.final, n = frame.x.length, steps = snaps.steps, seed = snaps.seed;
  const depth = new Int32Array(n), root = new Int32Array(n), limb = new Int32Array(n), children = new Int32Array(n), mass = new Int32Array(n).fill(1), leaves = new Int32Array(n);
  for (let i = n - 1; i >= 0; i--) {
    const parent = frame.parent[i];
    if (parent >= 0) { children[parent]++; mass[parent] += mass[i]; }
  }
  for (let i = n - 1; i >= 0; i--) {
    if (children[i] === 0) leaves[i] = 1;
    if (frame.parent[i] >= 0) leaves[frame.parent[i]] += leaves[i];
  }
  let heaviest = 0;
  for (let i = 0; i < n; i++) if (frame.parent[i] < 0 && mass[i] > heaviest) heaviest = mass[i];
  // A limb is a trunk (each seed) or a subtree of at most LIMB_SHARE of the heaviest tree hanging from a heavier parent.
  const limbMass = Math.max(1, Math.floor(heaviest * COLONY_LIMITS.limbShare));
  let limbs = 0, maxDepth = 0;
  for (let i = 0; i < n; i++) {
    const parent = frame.parent[i];
    if (parent < 0) { root[i] = i; limb[i] = limbs++; continue; }
    depth[i] = depth[parent] + 1; root[i] = root[parent];
    limb[i] = mass[i] <= limbMass && mass[parent] > limbMass ? limbs++ : limb[parent];
    if (depth[i] > maxDepth) maxDepth = depth[i];
  }
  const sites: ColonySite[] = new Array(n);
  const nodes: { id: string; position: [number, number] }[] = new Array(n);
  const edges: { id: string; from: string; to: string; weight: number; age: number }[] = [];
  let maxMass = 0, left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (let i = 0; i < n; i++) {
    const id = elementId("grain", i), parent = frame.parent[i], x = frame.x[i], y = frame.y[i];
    const angle = parent < 0 ? 0 : Math.atan2(y - frame.y[parent], x - frame.x[parent]);
    sites[i] = Object.freeze({ id, seed: componentSeed(seed, id, "site"), position: Object.freeze([x, y] as const), angle, scale: 1,
      index: i, parent, born: frame.born[i], depth: depth[i], root: root[i], limb: limb[i], children: children[i], mass: mass[i], tip: parent >= 0 && children[i] === 0 });
    nodes[i] = { id, position: [x, y] };
    if (parent >= 0) edges.push({ id: `e:${elementId("grain", parent)}|${id}`, from: elementId("grain", parent), to: id, weight: leaves[i] / leaves[root[i]], age: steps - frame.born[i] + 1 });
    else maxMass = Math.max(maxMass, mass[i]);
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  const value: Colony = Object.freeze({
    seed, steps, radius: snaps.params.radius, contact: 2 * snaps.params.radius,
    sites: Object.freeze(sites),
    graph: graphFromParts({ seed: componentSeed(seed, "colony", "graph"), directed: true, nodes, edges }),
    status: frame.status === 0 ? "growing" : "stalled" as ColonyStatus, stalledAt: frame.stalledAt < 0 ? null : frame.stalledAt,
    counts: Object.freeze({ seeds: frame.seeds, attached: n - frame.seeds, released: frame.released, escaped: frame.escaped, timedOut: frame.timedOut, unlaunched: frame.unlaunched }),
    maxDepth, maxMass, bounds: n === 0 ? null : Object.freeze([left, top, right, bottom] as const),
    domain, snapshots: snaps,
  });
  colonies.set(snaps, value);
  return value;
}

/** A path of the domain's rings (outer rings and holes), one closed `Path` each, for an outline. */
export function domainPaths(domain: PlanarDomain, seed: number): readonly Path[] {
  return Object.freeze(domainRings(domain).map((ring, k): Path => {
    const id = `${domain.id}/ring:${k}`;
    return Object.freeze({ id, seed: componentSeed(seed, id, "outline"), points: ring, closed: true, level: 0, levelFraction: 0 });
  }));
}
