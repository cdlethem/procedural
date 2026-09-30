import { componentSeed } from "./core.js";
import { edgeIndex, locateIndexed } from "./domains-index.js";
import { locateInFlatRing, regionsContact, ringWithin, transformRing } from "./domains-contact.js";
import type { FlatRing, Tally } from "./domains-contact.js";
import { footprintOf } from "./glyph-sources.js";
import type { CounterPolicy, FlatPart, GlyphSource, GlyphVocabulary } from "./glyph-sources.js";
import type { PackingField } from "./glyph-containers.js";
import type { Point, Site } from "./types.js";

/**
 * Glyph packing: words and symbols that occupy a shape, largest first, without touching.
 *
 * INPUTS. A `PackingField` (`glyph-containers.ts`: the usable planar domain, holes and negative space already removed
 * and the margin already inset) and a `GlyphVocabulary` (`glyph-sources.ts`: ranked outlines with frequencies). Options
 * are validated with the name of the control to change. Nothing is fetched; the only randomness is the seed, spent as
 * one independent stream per demand and attempt (`componentSeed(seed, "d<j>/a<k>", purpose)`), never in traversal order.
 *
 * THE ALGORITHM (stated, deterministic, bounded).
 *  1. PLAN. A size schedule is a power law: `count(size > s) = C·(s^−D − largest^−D)`, `D` = `falloff`, so `D = 2` gives every
 *     octave of size the same total area and larger `D` gives many more small glyphs. The demands are the glyphs of sizes
 *     `s_j = (largest^−D + j/C)^(−1/D)`, j = 0, 1, … down to `smallest`, RANKED LARGE TO SMALL. The vocabulary entry of demand j is
 *     drawn by frequency from the entries whose rank fraction is near the size's rank fraction (`hierarchy` 0: any entry at any
 *     size; 1: the head of the list is large and the tail small). `C` is found by bisection so the demanded footprint area is
 *     `coverage × available area`. The plan needs no geometry. More than `maxDemands` demands is an error naming Coverage.
 *  2. FREE CELLS (spatial index of free space). A grid of cells of side `h` covers the field; a cell is free while its centre (or a
 *     corner) lies in the field and its centre is in no placed footprint. A candidate anchor is a seeded free cell plus a seeded
 *     offset inside it. This is a SAMPLING device: every acceptance is decided by the exact tests below.
 *  3. ATTEMPTS. Each demand gets up to `retries` attempts. An attempt draws an anchor and an orientation (rule below), turns and scales the
 *     source's footprint to the anchor, then applies two exact tests, cheapest first:
 *       CONTAINMENT: every ink outline of the glyph lies strictly inside the field (`ringWithin`: no contact with any boundary edge,
 *       and no hole of the field encircled). Touching the field's boundary counts as outside.
 *       COLLISION: the glyph's GROWN footprint has no contact with any placed glyph's grown footprint (`ringsContact` between every
 *       pair of rings of nearby parts, and one vertex of each ring tested against the other's region). Counters are unavailable
 *       when `counters` is `"solid"`; under `"open"` a footprint keeps its counters, so a smaller glyph can lie inside one. Placed
 *       glyphs are found through a uniform grid of part boxes; only parts whose boxes overlap are tested.
 *     Every predicate is the kernel's exact orientation on the binary64 vertices of the transformed footprints: no tolerance.
 *  4. The first passing attempt places the glyph (its id is `d<j>`); its footprint clears the cells it covers. A demand whose attempts
 *     all fail, or that finds no free cell, is UNPLACED with its reason. Work is bounded before it starts (`demands × retries ≤
 *     maxAttempts`) and while it runs (`maxTests` exact segment tests), and either throws naming the controls to change.
 *
 * ORIENTATION. `aligned`: exactly `angle`. `boundary`: the direction of the nearest boundary edge of the field (so glyphs follow the
 * container's outline, its holes and the negative space), turned to read upright when `upright` (never upside down), plus `angle`, plus a
 * seeded ±`spread`. `random`: `angle` plus a seeded ±`spread`. Angles are degrees in the option and radians in the instance.
 *
 * OUTPUT. `instances`, each a `Site` (id `d<j>`, position at the centre of the ink box, angle, `scale` canvas units per glyph unit —
 * cap height for words, longer side for symbols) with its glyph, rank, tier (size quartile 0..3, also its `tone`), footprint area and
 * ink bounds; `unplaced`, every demand that did not fit with its reason; `stats` with the rejection counts and the achieved coverage.
 * A request the field cannot hold returns a partial packing with the unplaced set, never an error. Results are deeply frozen and
 * cached by construction inputs; the caller's `check` is not part of the key.
 */
export const GLYPH_PACKING_LIMITS = Object.freeze({
  /** Most demands one packing plans. */
  maxDemands: 4_000,
  /** Most attempts (`demands × retries`) one packing may make. */
  maxAttempts: 300_000,
  /** Most exact segment tests (candidate footprint edges against placed or boundary edges). */
  maxTests: 80_000_000,
  /** Free-cell grid size. */
  maxCells: 20_000,
});

export type OrientationRule = "aligned" | "boundary" | "random";
export interface Orientation {
  readonly rule: OrientationRule;
  /** Degrees. */
  readonly angle: number;
  /** Degrees; the half-width of the seeded jitter under `boundary` and `random`. */
  readonly spread: number;
  /** Under `boundary`, keep text from reading upside down. */
  readonly upright: boolean;
}
export interface PackOptions {
  readonly seed: number;
  readonly vocabulary: GlyphVocabulary;
  /** Demanded footprint area as a fraction of the field's area, in [0, 1). */
  readonly coverage: number;
  /** Canvas units per glyph unit of the first (largest) and last (smallest) demand. */
  readonly largest: number;
  readonly smallest: number;
  /** The power-law exponent D of the size schedule, in [0.25, 6]. */
  readonly falloff: number;
  /** Gap between footprints as a fraction of a glyph's size, in [0, 2]. */
  readonly gap: number;
  readonly counters: CounterPolicy;
  /** 0: entries independent of size; 1: rank follows size. */
  readonly hierarchy: number;
  /** Attempts per demand, integer in [1, 10000]. */
  readonly retries: number;
  readonly orientation: Orientation;
  /** Called every 64 attempts; may throw to cancel. Not part of the identity of the result. */
  readonly check?: () => void;
}

export interface GlyphInstance extends Site {
  readonly glyph: GlyphSource;
  /** Index of the entry in the vocabulary (0 = head). */
  readonly rank: number;
  /** The demand index j: 0 is the largest demand. */
  readonly demand: number;
  /** Size quartile of the schedule, 0 largest .. 3 smallest. */
  readonly tier: 0 | 1 | 2 | 3;
  /** Canvas units per glyph unit (equal to `scale`). */
  readonly size: number;
  /** Ink bounds [left, top, right, bottom] in canvas units. */
  readonly bounds: readonly [number, number, number, number];
  /** Footprint area, canvas units² (ink area under open counters). */
  readonly area: number;
  /** Attempts it took, ≥ 1. */
  readonly attempts: number;
}
export type UnplacedReason = "collision" | "outside" | "no-room";
export interface Unplaced {
  readonly id: string;
  readonly glyph: string;
  readonly size: number;
  readonly attempts: number;
  readonly reason: UnplacedReason;
  readonly rejectedOutside: number;
  readonly rejectedCollision: number;
}
export interface PackingStats {
  readonly planned: number;
  readonly placed: number;
  readonly unplaced: number;
  readonly attempts: number;
  readonly rejectedOutside: number;
  readonly rejectedCollision: number;
  /** Demands that found no free cell left. */
  readonly noRoom: number;
  /** Exact segment tests spent. */
  readonly tests: number;
  readonly availableArea: number;
  /** The demanded footprint area as a fraction of the available area (the coverage option, after rounding up to whole demands). */
  readonly plannedCoverage: number;
  /** Placed footprint area as a fraction of the available area. */
  readonly coverage: number;
  /** Placed ink area (counters excluded) as a fraction of the available area. */
  readonly inkCoverage: number;
  readonly placedByTier: readonly [number, number, number, number];
  readonly cell: number;
}
export interface GlyphPacking {
  readonly id: string;
  readonly instances: readonly GlyphInstance[];
  readonly unplaced: readonly Unplaced[];
  readonly stats: PackingStats;
}

export interface Demand {
  readonly id: string;
  readonly index: number;
  /** Canvas units per glyph unit. */
  readonly size: number;
  readonly entry: number;
  readonly tier: 0 | 1 | 2 | 3;
}

const U32 = 0x1_0000_0000;
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
const DEG = Math.PI / 180;

function ensure(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
export function validatePack(o: PackOptions): void {
  ensure(Number.isSafeInteger(o.seed) && o.seed >= 0 && o.seed <= 0xffffffff, "Composition seed must be a uint32 integer");
  ensure(Number.isFinite(o.coverage) && o.coverage >= 0 && o.coverage < 1, "Coverage must be in [0, 1)");
  ensure(Number.isFinite(o.largest) && o.largest > 0 && Number.isFinite(o.smallest) && o.smallest > 0, "Largest size and Smallest size must be finite and above 0");
  ensure(o.largest >= o.smallest, `Largest size (${o.largest}) must be at least Smallest size (${o.smallest})`);
  ensure(Number.isFinite(o.falloff) && o.falloff >= 0.25 && o.falloff <= 6, "Falloff must be in [0.25, 6]");
  ensure(Number.isFinite(o.gap) && o.gap >= 0 && o.gap <= 2, "Gap must be in [0, 2]");
  ensure(o.counters === "solid" || o.counters === "open", `Counters must be "solid" or "open"`);
  ensure(Number.isFinite(o.hierarchy) && o.hierarchy >= 0 && o.hierarchy <= 1, "Hierarchy must be in [0, 1]");
  ensure(Number.isSafeInteger(o.retries) && o.retries >= 1 && o.retries <= 10_000, "Retry budget must be an integer in [1, 10000]");
  const r = o.orientation;
  ensure(r.rule === "aligned" || r.rule === "boundary" || r.rule === "random", `Orientation must be "aligned", "boundary" or "random"`);
  ensure(Number.isFinite(r.angle) && Number.isFinite(r.spread) && r.spread >= 0, "Angle must be finite and Spread finite and at least 0");
  ensure(o.vocabulary.entries.length > 0, "The vocabulary has no entries");
}

/** The entry drawn for a demand at size fraction `u` (0 largest .. 1 smallest) with uniform draw `r`: frequency × rank affinity. */
export function pickEntry(vocabulary: GlyphVocabulary, hierarchy: number, u: number, r: number): number {
  const entries = vocabulary.entries, n = entries.length;
  if (n === 1) return 0;
  let total = 0;
  const weights = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const d = (u - i / (n - 1)) / 0.22;
    weights[i] = entries[i].weight * ((1 - hierarchy) ** 2 + hierarchy * Math.exp(-d * d));
    total += weights[i];
  }
  let target = r * total;
  for (let i = 0; i < n; i++) { target -= weights[i]; if (target < 0) return i; }
  return n - 1;
}

/**
 * The ranked demands for a field of `area`. Sizes follow the power-law schedule (see the header); entries are drawn by `pickEntry`.
 * Throws when the coverage needs more than `maxDemands` glyphs of these sizes.
 */
export function planDemands(area: number, o: Pick<PackOptions, "seed" | "vocabulary" | "coverage" | "largest" | "smallest" | "falloff" | "hierarchy" | "counters">): readonly Demand[] {
  const target = o.coverage * area;
  if (!(target > 0)) return [];
  const { largest, smallest, falloff: d } = o;
  const span = Math.log(largest / smallest);
  const unitArea = o.vocabulary.entries.map((entry) => o.counters === "open" ? entry.source.area : entry.source.solidArea);
  const capacity = smallest ** -d - largest ** -d;
  const build = (c: number, limit: number): { demands: Demand[]; total: number } => {
    const demands: Demand[] = [];
    let total = 0;
    for (let j = 0; j < limit; j++) {
      let size: number;
      if (span === 0) size = largest;
      else {
        size = j === 0 ? largest : (largest ** -d + j / c) ** (-1 / d);
        if (j > 0 && size < smallest) break;
        size = Math.min(largest, Math.max(smallest, size));
      }
      const u = span === 0 ? 0 : Math.log(largest / size) / span;
      const id = `d${j}`;
      const entry = pickEntry(o.vocabulary, o.hierarchy, u, unit(o.seed, id, "glyph"));
      demands.push({ id, index: j, size, entry, tier: Math.min(3, Math.floor(u * 4)) as 0 | 1 | 2 | 3 });
      total += unitArea[entry] * size * size;
      if (span === 0 && total >= target) break;
    }
    return { demands, total };
  };
  if (span === 0) {
    const plan = build(1, GLYPH_PACKING_LIMITS.maxDemands);
    if (plan.total < target) throw new Error(`Coverage ${o.coverage} needs more than ${GLYPH_PACKING_LIMITS.maxDemands} glyphs at size ${largest}; raise Smallest size (or Largest size), or lower Coverage`);
    return plan.demands;
  }
  const most = (GLYPH_PACKING_LIMITS.maxDemands - 1) / capacity;
  if (build(0, 1).total >= target) return build(0, 1).demands;
  if (build(most, GLYPH_PACKING_LIMITS.maxDemands).total < target)
    throw new Error(`Coverage ${o.coverage} needs more than ${GLYPH_PACKING_LIMITS.maxDemands} glyphs between sizes ${smallest} and ${largest}; raise Smallest size, lower Coverage, or lower Falloff`);
  let lo = 0, hi = most;
  for (let i = 0; i < 48 && hi - lo > hi * 1e-4; i++) {
    const mid = (lo + hi) / 2;
    if (build(mid, GLYPH_PACKING_LIMITS.maxDemands).total >= target) hi = mid; else lo = mid;
  }
  return build(hi, GLYPH_PACKING_LIMITS.maxDemands).demands;
}

// ---------------------------------------------------------------------------------------------
// Packing
// ---------------------------------------------------------------------------------------------
interface Placed { readonly outer: FlatRing; readonly holes: readonly FlatRing[]; stamp: number }

/** Direction of travel of the field's boundary edge nearest to (x, y), radians. */
function nearestTangent(edges: Float64Array, x: number, y: number): number {
  let best = Infinity, angle = 0;
  for (let e = 0; e < edges.length; e += 4) {
    const ax = edges[e], ay = edges[e + 1], dx = edges[e + 2] - ax, dy = edges[e + 3] - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    const px = ax + t * dx - x, py = ay + t * dy - y, dist = px * px + py * py;
    if (dist < best) { best = dist; angle = Math.atan2(dy, dx); }
  }
  return angle;
}

const packings = new WeakMap<PackingField, Map<string, GlyphPacking>>();
const packingKey = (o: PackOptions): string => JSON.stringify([o.seed, o.vocabulary.id, o.vocabulary.entries.map((e) => [e.source.id, e.weight]), o.coverage, o.largest,
  o.smallest, o.falloff, o.gap, o.counters, o.hierarchy, o.retries, o.orientation]);

/** Pack the vocabulary into the field (see the header). Cached per field and options; the value is deeply frozen. */
export function packGlyphs(field: PackingField, options: PackOptions): GlyphPacking {
  validatePack(options);
  let byKey = packings.get(field);
  if (!byKey) { byKey = new Map(); packings.set(field, byKey); }
  const key = packingKey(options);
  const hit = byKey.get(key);
  if (hit) return hit;
  const packing = solve(field, options);
  if (byKey.size >= 6) byKey.delete(byKey.keys().next().value!);
  byKey.set(key, packing);
  return packing;
}

function solve(field: PackingField, o: PackOptions): GlyphPacking {
  const available = field.available;
  const area = available.area;
  const empty = (planned: number): GlyphPacking => Object.freeze({ id: "glyphs", instances: Object.freeze([]), unplaced: Object.freeze([]),
    stats: Object.freeze({ planned, placed: 0, unplaced: 0, attempts: 0, rejectedOutside: 0, rejectedCollision: 0, noRoom: 0, tests: 0, availableArea: area,
      plannedCoverage: 0, coverage: 0, inkCoverage: 0, placedByTier: Object.freeze([0, 0, 0, 0] as const), cell: 0 }) });
  if (!(area > 0) || !available.bounds) return empty(0);
  const demands = planDemands(area, o);
  if (demands.length * o.retries > GLYPH_PACKING_LIMITS.maxAttempts)
    throw new Error(`${demands.length} demands × Retry budget ${o.retries} exceeds ${GLYPH_PACKING_LIMITS.maxAttempts} attempts; lower Retry budget or Coverage, or raise Smallest size`);
  if (demands.length === 0) return empty(0);

  const [left, top, right, bottom] = available.bounds;
  const index = edgeIndex(available);
  const tally: Tally = { tests: 0 };
  const limitTests = (): void => {
    if (tally.tests > GLYPH_PACKING_LIMITS.maxTests)
      throw new Error(`Packing needs more than ${GLYPH_PACKING_LIMITS.maxTests} exact geometry tests; lower Retry budget or Coverage, raise Smallest size, or simplify the container`);
  };

  // Free cells: a sampling index of the space not yet covered.
  const width = right - left, height = bottom - top;
  const h = Math.max(0.4 * o.smallest, Math.sqrt(width * height / GLYPH_PACKING_LIMITS.maxCells));
  const nx = Math.max(1, Math.ceil(width / h)), ny = Math.max(1, Math.ceil(height / h));
  const slot = new Int32Array(nx * ny).fill(-1);
  const free = new Int32Array(nx * ny);
  let freeCount = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = left + (i + 0.5) * h, y = top + (j + 0.5) * h;
    const near = locateIndexed(index, x, y) > 0 || locateIndexed(index, x - h / 2, y - h / 2) > 0 || locateIndexed(index, x + h / 2, y - h / 2) > 0
      || locateIndexed(index, x - h / 2, y + h / 2) > 0 || locateIndexed(index, x + h / 2, y + h / 2) > 0;
    if (near) { slot[j * nx + i] = freeCount; free[freeCount++] = j * nx + i; }
  }
  const clearCell = (cell: number): void => {
    const at = slot[cell];
    if (at < 0) return;
    const last = free[--freeCount];
    free[at] = last; slot[last] = at; slot[cell] = -1;
  };

  // Placed parts, found through a uniform grid of boxes.
  const side = 40, bw = width / side, bh = height / side;
  const buckets: Placed[][] = Array.from({ length: side * side }, () => []);
  const bucketOf = (value: number, origin: number, size: number): number => Math.min(side - 1, Math.max(0, Math.floor((value - origin) / size)));
  let clock = 0;
  const tangentEdges = index.edges;

  const instances: GlyphInstance[] = [], unplaced: Unplaced[] = [];
  let attempts = 0, rejectedOutside = 0, rejectedCollision = 0, noRoom = 0, coveredArea = 0, inkArea = 0, plannedArea = 0;
  const placedByTier: [number, number, number, number] = [0, 0, 0, 0];
  const unitAreaOf = (source: GlyphSource): number => o.counters === "open" ? source.area : source.solidArea;

  for (const demand of demands) {
    const source = o.vocabulary.entries[demand.entry].source;
    const footprint = footprintOf(source, o.gap, o.counters);
    const grown = footprint.halfGap > 0;
    const s = demand.size;
    plannedArea += unitAreaOf(source) * s * s;
    let outside = 0, collided = 0, used = 0, placed = false, roomless = false;
    for (let a = 0; a < o.retries; a++) {
      if (freeCount === 0) { roomless = true; break; }
      if ((attempts & 63) === 0) o.check?.();
      limitTests();
      attempts++; used++;
      const id = `${demand.id}/a${a}`;
      const cell = free[Math.min(freeCount - 1, Math.floor(unit(o.seed, id, "cell") * freeCount))];
      const ci = cell % nx, cj = (cell - ci) / nx;
      const x = left + (ci + unit(o.seed, id, "x")) * h, y = top + (cj + unit(o.seed, id, "y")) * h;
      if (locateIndexed(index, x, y) <= 0) { outside++; rejectedOutside++; continue; }
      let theta = o.orientation.angle * DEG;
      if (o.orientation.rule === "boundary") {
        let tangent = nearestTangent(tangentEdges, x, y);
        if (o.orientation.upright && Math.cos(tangent) < 0) tangent += Math.PI;
        theta += tangent;
      }
      if (o.orientation.rule !== "aligned") theta += o.orientation.spread * DEG * (2 * unit(o.seed, id, "angle") - 1);
      const cos = Math.cos(theta), sin = Math.sin(theta);
      // CONTAINMENT with the ink outlines.
      const rawPlaced = footprint.raw.map((part) => transformRing(part.outer, cos, sin, s, x, y));
      let inside = true;
      for (const ring of rawPlaced) if (!ringWithin(available, ring, tally)) { inside = false; break; }
      if (!inside) { outside++; rejectedOutside++; continue; }
      // COLLISION between grown footprints.
      const parts: Placed[] = grown
        ? footprint.padded.map((part) => ({ outer: transformRing(part.outer, cos, sin, s, x, y), holes: part.holes.map((hole) => transformRing(hole, cos, sin, s, x, y)), stamp: 0 }))
        : footprint.raw.map((part, k) => ({ outer: rawPlaced[k], holes: part.holes.map((hole) => transformRing(hole, cos, sin, s, x, y)), stamp: 0 }));
      let hitOther = false;
      search: for (const part of parts) {
        const stamp = ++clock;
        const c0 = bucketOf(part.outer.minX, left, bw), c1 = bucketOf(part.outer.maxX, left, bw);
        const r0 = bucketOf(part.outer.minY, top, bh), r1 = bucketOf(part.outer.maxY, top, bh);
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) for (const other of buckets[r * side + c]) {
          if (other.stamp === stamp) continue;
          other.stamp = stamp;
          if (regionsContact(part, other, tally)) { hitOther = true; break search; }
        }
      }
      if (hitOther) { collided++; rejectedCollision++; continue; }
      // ACCEPT.
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      for (const ring of rawPlaced) { l = Math.min(l, ring.minX); t = Math.min(t, ring.minY); r = Math.max(r, ring.maxX); b = Math.max(b, ring.maxY); }
      for (const part of parts) {
        const c0 = bucketOf(part.outer.minX, left, bw), c1 = bucketOf(part.outer.maxX, left, bw);
        const r0 = bucketOf(part.outer.minY, top, bh), r1 = bucketOf(part.outer.maxY, top, bh);
        for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) buckets[rr * side + cc].push(part);
        const i0 = Math.max(0, Math.floor((part.outer.minX - left) / h)), i1 = Math.min(nx - 1, Math.floor((part.outer.maxX - left) / h));
        const j0 = Math.max(0, Math.floor((part.outer.minY - top) / h)), j1 = Math.min(ny - 1, Math.floor((part.outer.maxY - top) / h));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const at = j * nx + i;
          if (slot[at] < 0) continue;
          const cx = left + (i + 0.5) * h, cy = top + (j + 0.5) * h;
          if (locateInFlatRing(part.outer, cx, cy) < 0) continue;
          if (part.holes.some((hole) => locateInFlatRing(hole, cx, cy) > 0)) continue;
          clearCell(at);
        }
      }
      const footprintArea = footprint.area * s * s;
      coveredArea += footprintArea;
      inkArea += source.area * s * s;
      placedByTier[demand.tier]++;
      instances.push(Object.freeze({
        id: demand.id, seed: componentSeed(o.seed, demand.id, "glyph"), position: Object.freeze([x, y] as const) as Point, angle: theta, scale: s, tone: demand.tier,
        glyph: source, rank: demand.entry, demand: demand.index, tier: demand.tier, size: s, bounds: Object.freeze([l, t, r, b] as const), area: footprintArea, attempts: used,
      }));
      placed = true;
      break;
    }
    if (!placed) {
      const reason: UnplacedReason = roomless ? "no-room" : collided >= outside ? "collision" : "outside";
      if (roomless) noRoom++;
      unplaced.push(Object.freeze({ id: demand.id, glyph: source.id, size: s, attempts: used, reason, rejectedOutside: outside, rejectedCollision: collided }));
    }
  }
  return Object.freeze({
    id: "glyphs", instances: Object.freeze(instances), unplaced: Object.freeze(unplaced),
    stats: Object.freeze({ planned: demands.length, placed: instances.length, unplaced: unplaced.length, attempts, rejectedOutside, rejectedCollision, noRoom,
      tests: tally.tests, availableArea: area, plannedCoverage: plannedArea / area, coverage: coveredArea / area, inkCoverage: inkArea / area,
      placedByTier: Object.freeze(placedByTier) as readonly [number, number, number, number], cell: h }),
  });
}

const inkCache = new WeakMap<GlyphInstance, readonly (readonly Point[])[]>();
/** The instance's ink outlines (outer rings and counters) in canvas coordinates: its actual footprint. Frozen, cached. */
export function instanceInk(instance: GlyphInstance): readonly (readonly Point[])[] {
  let hit = inkCache.get(instance);
  if (!hit) {
    const c = Math.cos(instance.angle), s = Math.sin(instance.angle), k = instance.scale;
    const [x, y] = instance.position;
    hit = Object.freeze(instance.glyph.ink.map((ring) => Object.freeze(ring.map(([px, py]): Point => Object.freeze([x + k * (c * px - s * py), y + k * (s * px + c * py)] as const)))));
    inkCache.set(instance, hit);
  }
  return hit;
}
