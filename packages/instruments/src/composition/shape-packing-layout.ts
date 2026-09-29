import { componentSeed } from "./core.js";
import { PlanarError, planarDomain, planarRegion, unionDomains, domainDifference } from "./domains.js";
import type { PlanarDomain, PlanarRegionData, Ring } from "./domains.js";
import { offsetDomain } from "./domains-offset.js";
import { regionInside, regionsOverlap } from "./domains-overlap.js";
import type { RingRegion } from "./domains-overlap.js";
import { BitGrid, CENTER, buildLevels, distanceToBlocked, feasibleAnchors, noFitBoundary, rasterize, touchedRuns } from "./shape-packing-grid.js";
import type { Pt2, Steps } from "./shape-packing-grid.js";
import type { PackItem } from "./shape-pieces.js";
import type { Point } from "./types.js";

/**
 * Deterministic non-convex packing (brief 47). Contract: docs/composition-shape-packing.md.
 *
 * INPUT. A container (`PlanarDomain`: holes are obstacles), a list of `PackItem`s (a normal-form shape at a size)
 * and `PackRules`. Output: `ShapePacking`, deeply frozen: one `PackedInstance` per placed item (transform, placed
 * region, gap footprint), the items that did not fit (`unplaced`, with why), the coverage achieved, and the measured
 * work. Same input, same output, to the last bit; there is no randomness inside (chance lives in the item list and,
 * for `order: "shuffled"`, in `componentSeed(seed, item.id, "order")`).
 *
 * THE RULE. Items are taken in `order` (largest first by default). Each is tried at every angle of the set
 * {k·360°/rotations} (and its mirror image when `mirror`). Its FOOTPRINT is the piece grown by gap/2 (round join),
 * so two placed pieces are at least `gap` apart, and the footprint must lie inside the container shrunk by
 * `margin - gap/2` (so a piece is at least `margin` from the container's edge and from its holes).
 *   1. SEARCH. (The first piece has nothing to touch, so every feasible place is a candidate for it.) A conservative occupancy bitset (cells touched by any placed footprint or outside the container are
 *      blocked) answers, for one rasterised footprint, at which cell anchors it fits: a bit-parallel erosion. The
 *      candidates are the anchors on the boundary of that feasible set (the raster no-fit polygon): the footprint
 *      touches something there. Among all candidates of all angles the one that minimises the RULE POTENTIAL of its
 *      centroid wins (ties: lower angle index, then row, then column):
 *        center  distance from the container's area centroid (the first piece starts at the middle, the rest grow around it);
 *        walls   distance to the container boundary (the layout follows the edge, then its inner boundary);
 *        settle  position along a chosen direction (pieces fall that way and stack, like a jar shaken down).
 *   2. EXACT CHECK. The winner is verified with exact predicates against the container (`regionInside`) and every
 *      placed footprint whose box overlaps (`regionsOverlap`): boxes are only a filter; concavities and holes
 *      count (a small piece may sit in a letter's counter). A failed candidate is discarded and the next taken.
 *   3. SETTLE. The piece is slid, in continuous coordinates, towards the potential's descent direction and its
 *      neighbours (at most 4 rounds of 5 directions, each move found by stepping then bisecting with the exact
 *      check) so the raster's slack disappears and it touches its neighbours at the gap.
 *   4. COMMIT. The final footprint's touched cells are blocked; the next item searches the updated raster.
 * An item that fits nowhere is retried at `shrink` times its size, up to `retries` more times; if it still fits
 * nowhere it is reported unplaced. Nothing is ever placed by relaxing the exact checks.
 *
 * STOP. All items are tried, or (when `coverage` is set) as soon as the placed area reaches that fraction of the
 * container area; the remaining items are reported unplaced with reason "stopped".
 *
 * UNITS. Canvas units; angles in radians clockwise on the canvas (y down), about the piece's area centroid
 * (mirror = x → −x first). A placed piece's transform is world = position + R(angle)·(±x, y)·size for the
 * normal-form shape.
 *
 * LIMITS. `PACK_LIMITS`: work is counted in (row, run) steps of the bit-parallel search, a deterministic function of
 * the input; exceeding it throws naming the controls to lower. Nothing is truncated or thinned.
 */

export type PackOrder = "largest" | "smallest" | "shuffled";
export type PackRule = "center" | "walls" | "settle";

export interface PackRules {
  readonly order: PackOrder;
  readonly rule: PackRule;
  /** Degrees; the direction pieces fall for `settle` (90 = down the canvas). */
  readonly settleAngle: number;
  /** Angles per full turn, 1..24. */
  readonly rotations: number;
  readonly mirror: boolean;
  readonly gap: number;
  readonly margin: number;
  /** `open`: holes of a piece are free space smaller pieces may enter; `solid`: they are filled. */
  readonly counters: "open" | "solid";
  /** Cells across the longest side of the container. */
  readonly resolution: number;
  /** Extra attempts at a smaller size for an item that fits nowhere. */
  readonly retries: number;
  /** Size factor per retry, in (0, 1). */
  readonly shrink: number;
  /** Stop when this fraction of the container area is covered; null: try every item. */
  readonly stop: number | null;
}

export const PACK_LIMITS = Object.freeze({
  /** (row, run) steps in the search, all items together. */
  search: 60_000_000,
  rotations: 24, resolution: 320, retries: 8,
});

export interface PackedInstance {
  /** The item's id. */
  readonly id: string;
  readonly item: PackItem;
  /** Placement order, 0 first. */
  readonly rank: number;
  /** Position of the piece's area centroid. */
  readonly position: Point;
  /** Radians clockwise on the canvas. */
  readonly angle: number;
  readonly mirrored: boolean;
  /** Longest side of the unrotated piece as placed; less than `item.size` after a retry. */
  readonly size: number;
  /** Retries used: 0 = placed at the item's own size. */
  readonly retries: number;
  /** The piece where it stands: regions `${id}/${k}`, holes included. */
  readonly region: PlanarDomain;
  /** The gap footprint (piece grown by gap/2) as plain ring data; interiors of footprints are pairwise disjoint. */
  readonly footprint: readonly { readonly outer: Ring; readonly holes: readonly Ring[] }[];
}

export interface UnplacedItem {
  readonly id: string;
  readonly item: PackItem;
  /** The size of the last attempt (after retries), or the item's size when it was never tried. */
  readonly size: number;
  readonly attempts: number;
  readonly reason: "no-room" | "stopped";
}

export interface PackStats {
  /** Items tried (each with its attempts). */
  readonly tried: number;
  /** (row, run) steps spent by the raster search. */
  readonly steps: number;
  /** Candidates the exact check refused (raster slack or a container edge case). */
  readonly rejected: number;
  /** Exact overlap tests that ran (each may involve several regions). */
  readonly exactTests: number;
  readonly cell: number;
  readonly cells: readonly [number, number];
}

export interface ShapePacking {
  readonly id: string;
  readonly container: PlanarDomain;
  /** Where pieces may be: the container moved in by `margin` (the container itself for 0). Every placed region lies inside it. */
  readonly usable: PlanarDomain;
  readonly rules: PackRules;
  readonly instances: readonly PackedInstance[];
  readonly unplaced: readonly UnplacedItem[];
  /** Area of the placed pieces (holes excluded). */
  readonly placedArea: number;
  readonly containerArea: number;
  /** placedArea / containerArea, in [0, 1]. */
  readonly coverage: number;
  readonly stats: PackStats;
}

// ------------------------------------------------------------------------------------------ geometry helpers

interface LocalRegion extends RingRegion { readonly outer: readonly Point[]; readonly holes: readonly (readonly Point[])[] }

const boundsOf = (outer: readonly Point[]): [number, number, number, number] => {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const [x, y] of outer) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
  return [l, t, r, b];
};

/** Scale, mirror, rotate and translate a ring; mirroring reverses the ring so the region stays on its left. */
function moveRing(ring: readonly Point[], scale: number, mirror: boolean, cos: number, sin: number, tx: number, ty: number): Point[] {
  const out = ring.map(([px, py]): Point => {
    const x = (mirror ? -px : px) * scale, y = py * scale;
    return [tx + x * cos - y * sin, ty + x * sin + y * cos];
  });
  return mirror ? out.reverse() : out;
}
function moveRegion(region: RingRegion, scale: number, mirror: boolean, cos: number, sin: number, tx: number, ty: number): LocalRegion {
  const outer = moveRing(region.outer, scale, mirror, cos, sin, tx, ty);
  return { outer, holes: region.holes.map((h) => moveRing(h, scale, mirror, cos, sin, tx, ty)), bounds: boundsOf(outer) };
}
const solidCache = new WeakMap<PlanarDomain, PlanarDomain>();
/** The same domain with every hole filled (regions that only touch stay separate). */
function solidOf(domain: PlanarDomain): PlanarDomain {
  let hit = solidCache.get(domain);
  if (!hit) {
    hit = domain.regions.every((r) => r.holes.length === 0) ? domain
      : planarDomain(domain.regions.map((r): PlanarRegionData => ({ id: r.id, outer: r.outer as unknown as [number, number][] })), { id: `${domain.id}/solid` });
    solidCache.set(domain, hit);
  }
  return hit;
}

// ------------------------------------------------------------------------------------------ the solver

/** A piece and its footprint at one position, with the footprint's box. */
interface Candidate { readonly piece: readonly LocalRegion[]; readonly foot: readonly LocalRegion[]; readonly bounds: readonly [number, number, number, number] }
interface Placed { readonly regions: readonly LocalRegion[]; readonly bounds: readonly [number, number, number, number] }
interface Variant { readonly index: number; readonly mirror: boolean; readonly angle: number; readonly cos: number; readonly sin: number }

const packCache = new WeakMap<PlanarDomain, Map<string, ShapePacking>>();
const RULES: readonly PackRule[] = ["center", "walls", "settle"];

function checkRules(rules: PackRules): void {
  const fail = (message: string): never => { throw new Error(message); };
  if (!["largest", "smallest", "shuffled"].includes(rules.order)) fail("Order must be largest, smallest or shuffled");
  if (!RULES.includes(rules.rule)) fail("Rule must be center, walls or settle");
  if (!Number.isFinite(rules.settleAngle)) fail("Settle direction must be finite");
  if (!Number.isSafeInteger(rules.rotations) || rules.rotations < 1 || rules.rotations > PACK_LIMITS.rotations) fail(`Rotations must be an integer in [1, ${PACK_LIMITS.rotations}]`);
  if (!Number.isFinite(rules.gap) || rules.gap < 0) fail("Gap must be finite and >= 0");
  if (!Number.isFinite(rules.margin) || rules.margin < 0) fail("Edge margin must be finite and >= 0");
  if (rules.counters !== "open" && rules.counters !== "solid") fail("Counters must be open or solid");
  if (!Number.isSafeInteger(rules.resolution) || rules.resolution < 16 || rules.resolution > PACK_LIMITS.resolution) fail(`Search resolution must be an integer in [16, ${PACK_LIMITS.resolution}]`);
  if (!Number.isSafeInteger(rules.retries) || rules.retries < 0 || rules.retries > PACK_LIMITS.retries) fail(`Retries must be an integer in [0, ${PACK_LIMITS.retries}]`);
  if (!(rules.shrink > 0 && rules.shrink < 1)) fail("Shrink must be in (0, 1)");
  if (rules.stop !== null && !(rules.stop > 0 && rules.stop <= 1)) fail("Coverage target must be in (0, 1]");
}

/** The order the items are tried in: a pure function of the list, the rule and the seed. */
export function packOrder(items: readonly PackItem[], order: PackOrder, seed: number): readonly PackItem[] {
  const list = items.slice();
  if (order === "shuffled") {
    const keyed = new Map(list.map((it) => [it.id, componentSeed(seed, it.id, "order")] as const));
    return list.sort((a, b) => keyed.get(a.id)! - keyed.get(b.id)! || (a.id < b.id ? -1 : 1));
  }
  const sign = order === "largest" ? -1 : 1;
  return list.sort((a, b) => sign * (a.size - b.size) || a.index - b.index || (a.id < b.id ? -1 : 1));
}

/**
 * Pack `items` into `container` by `rules` (see the header). Cached per container value and construction;
 * `run.check()` is called between candidates so a large packing can be cancelled.
 */
export function packShapes(container: PlanarDomain, items: readonly PackItem[], rules: PackRules, seed = 0, run?: { check(): void }): ShapePacking {
  checkRules(rules);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Seed must be a uint32 integer");
  if (container.regions.length === 0 || container.bounds === null || !(container.area > 0)) throw new Error("The container has no area");
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate item id ${item.id}`);
    ids.add(item.id);
  }
  const key = JSON.stringify([rules, seed, items.map((it) => [it.id, it.shape.id, it.size])]);
  let byKey = packCache.get(container);
  const cached = byKey?.get(key);
  if (cached) return cached;
  const result = solve(container, items, rules, seed, run);
  if (!byKey) { byKey = new Map(); packCache.set(container, byKey); }
  byKey.set(key, result);
  if (byKey.size > 4) byKey.delete(byKey.keys().next().value as string);
  return result;
}

function solve(container: PlanarDomain, items: readonly PackItem[], rules: PackRules, seed: number, run?: { check(): void }): ShapePacking {
  const [bl, bt, br, bb] = container.bounds!, longest = Math.max(br - bl, bb - bt), cell = longest / rules.resolution;
  const half = rules.gap / 2, grow = half - rules.margin;
  // `usable`: where PIECES may be (the exact containment test). `envelope`: where FOOTPRINTS may be, for the raster search only
  // (a footprint is the piece grown by half the gap, so it may reach `grow` past the usable edge; the exact test still decides).
  const noRoom = "Edge margin leaves no room inside the container: lower Edge margin";
  const shift = (distance: number, id: string): PlanarDomain => {
    if (distance === 0) return container;
    // No region survives an inward offset of half its shorter box side, and the offset itself would cost a great deal of work.
    if (distance < 0 && -distance >= Math.min(br - bl, bb - bt) / 2) throw new Error(noRoom);
    try { return offsetDomain(container, distance, { id: `${container.id}/${id}`, arcTolerance: Math.max(Math.abs(distance) / 16, 1e-6) }); }
    catch (error) { if (error instanceof PlanarError && error.code === "WORK_LIMIT") throw new Error(`Edge margin or Gap is too large for this container's outline: lower Edge margin`); throw error; }
  };
  const usable = shift(-rules.margin, "usable"), envelope = grow === -rules.margin ? usable : shift(grow, "envelope");
  if (usable.regions.length === 0 || envelope.regions.length === 0) throw new Error(noRoom);
  const originX = bl - 2 * cell, originY = bt - 2 * cell;
  const gw = Math.ceil((br - bl) / cell) + 5, gh = Math.ceil((bb - bt) / cell) + 5;
  const toCell = (x: number, y: number): Pt2 => [(x - originX) / cell, (y - originY) / cell];

  // Free cells: wholly inside the envelope (centre inside, no boundary edge touching).
  const free = new BitGrid(gw, gh);
  const usableMarks = rasterize(envelope.regions.flatMap((r) => [r.outer, ...r.holes].map((ring) => ring.map(([x, y]) => toCell(x, y)))), 0, 0, gw, gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (usableMarks[y * gw + x] === CENTER) free.set(x, y);

  // Rule potential per cell (lower is better).
  const potential = new Float64Array(gw * gh);
  const [cx, cy] = container.centroid!, centre = toCell(cx, cy);
  const fall = rules.settleAngle * Math.PI / 180, gx = Math.cos(fall), gy = Math.sin(fall);
  const wallDistance = rules.rule === "walls" ? distanceToBlocked(free) : null;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    potential[y * gw + x] = rules.rule === "center" ? (x + 0.5 - centre[0]) ** 2 + (y + 0.5 - centre[1]) ** 2
      : rules.rule === "walls" ? wallDistance![y * gw + x] : -((x + 0.5) * gx + (y + 0.5) * gy);
  }
  /** Unit direction of steepest descent of the potential at a canvas point. */
  const descent = (x: number, y: number): Point => {
    let dx: number, dy: number;
    if (rules.rule === "center") { dx = cx - x; dy = cy - y; }
    else if (rules.rule === "settle") { dx = gx; dy = gy; }
    else {
      const [u, v] = toCell(x, y), step = 0.75, at = (i: number, j: number): number => {
        const ci = Math.min(gw - 1, Math.max(0, Math.floor(i))), cj = Math.min(gh - 1, Math.max(0, Math.floor(j)));
        return wallDistance![cj * gw + ci];
      };
      dx = -(at(u + step, v) - at(u - step, v)); dy = -(at(u, v + step) - at(u, v - step));
      if (dx === 0 && dy === 0) { dx = cx - x; dy = cy - y; }
    }
    const length = Math.hypot(dx, dy) || 1;
    return [dx / length, dy / length];
  };

  const steps: Steps = { used: 0, limit: PACK_LIMITS.search, explain: () => `Shape packing needs more than ${PACK_LIMITS.search} search steps: lower Pieces, Rotations, Retries or Search resolution` };
  const placed: Placed[] = [], instances: PackedInstance[] = [], unplaced: UnplacedItem[] = [];
  let levels = buildLevels(free), rowMin = 0, rowMax = -1, placedArea = 0, exactTests = 0, rejected = 0, tried = 0;
  const refreshRows = (): void => {
    rowMin = gh; rowMax = -1;
    for (let y = 0; y < gh; y++) for (let w = 0; w < free.W; w++) if (free.rows[y * free.W + w] !== 0) { rowMin = Math.min(rowMin, y); rowMax = Math.max(rowMax, y); break; }
  };
  refreshRows();

  const variantsCount = rules.rotations * (rules.mirror ? 2 : 1);
  const variants: Variant[] = Array.from({ length: variantsCount }, (_, index) => {
    const angle = 2 * Math.PI * (index % rules.rotations) / rules.rotations;
    return { index, mirror: index >= rules.rotations, angle, cos: Math.cos(angle), sin: Math.sin(angle) };
  });
  const feasible = new Uint32Array(free.W * gh), boundaries: Uint32Array[] = [];

  /** Exact validity of a positioned candidate: the piece inside the usable region, its footprint disjoint from every placed footprint. */
  const fitsExactly = (candidate: Candidate, near: readonly Placed[]): boolean => {
    for (const region of candidate.piece) if (!regionInside(usable, region)) return false;
    const bounds = candidate.bounds;
    for (const other of near) {
      if (!(other.bounds[0] < bounds[2] && other.bounds[2] > bounds[0] && other.bounds[1] < bounds[3] && other.bounds[3] > bounds[1])) continue;
      exactTests++;
      for (const a of candidate.foot) for (const b of other.regions) if (regionsOverlap(a, b)) return false;
    }
    return true;
  };
  const boundsOfRegions = (regions: readonly LocalRegion[]): [number, number, number, number] => {
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const region of regions) { l = Math.min(l, region.bounds[0]); t = Math.min(t, region.bounds[1]); r = Math.max(r, region.bounds[2]); b = Math.max(b, region.bounds[3]); }
    return [l, t, r, b];
  };

  const ordered = packOrder(items, rules.order, seed);
  let stopped = false;
  for (const item of ordered) {
    if (stopped) { unplaced.push(Object.freeze({ id: item.id, item, size: item.size, attempts: 0, reason: "stopped" as const })); continue; }
    run?.check();
    tried++;
    let outcome: PackedInstance | null = null, size = item.size, attempt = 0;
    for (; attempt <= rules.retries && !outcome; attempt++, size *= rules.shrink) {
      outcome = attemptPlace(item, size, attempt);
    }
    if (outcome) {
      instances.push(outcome); placedArea += outcome.region.area;
      if (rules.stop !== null && placedArea / container.area >= rules.stop) stopped = true;
    } else unplaced.push(Object.freeze({ id: item.id, item, size: size / rules.shrink, attempts: rules.retries + 1, reason: "no-room" as const }));
  }

  function attemptPlace(item: PackItem, size: number, retries: number): PackedInstance | null {
    const base = rules.counters === "solid" ? solidOf(item.shape.domain) : item.shape.domain;
    const grown = half > 0 ? offsetDomain(base, half / size, { id: `${item.id}/footprint`, arcTolerance: Math.max(half / size / 16, 1e-9) }) : base;
    if (grown.regions.length === 0) return null;
    // Footprint variants: rasterised rings in cell units around the anchor cell's centre, as touched-cell runs.
    const footprints = variants.map((v) => grown.regions.map((r) => moveRegion(r, size, v.mirror, v.cos, v.sin, 0, 0)));
    const pieces = variants.map((v) => base.regions.map((r) => moveRegion(r, size, v.mirror, v.cos, v.sin, 0, 0)));
    const runs = footprints.map((regions) => {
      const rings = regions.flatMap((r) => [r.outer, ...r.holes]).map((ring) => ring.map(([x, y]): Pt2 => [x / cell + 0.5, y / cell + 0.5]));
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      for (const ring of rings) for (const [x, y] of ring) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
      const x0 = Math.floor(l) - 1, y0 = Math.floor(t) - 1, w = Math.floor(r) + 2 - x0, h = Math.floor(b) + 2 - y0;
      return w > gw || h > gh ? null : touchedRuns(rasterize(rings, x0, y0, w, h), x0, y0, w, h);
    });
    const live: number[] = [];
    variants.forEach((_, k) => {
      const list = runs[k];
      if (!list || list.length === 0) return;
      if (!boundaries[k]) boundaries[k] = new Uint32Array(free.W * gh);
      feasibleAnchors(levels, free, list, feasible, rowMin, rowMax, steps);
      // The first piece has nothing to touch: every feasible anchor is a candidate, so the rule alone decides where it starts.
      if (placed.length === 0) boundaries[k].set(feasible); else noFitBoundary(feasible, free, boundaries[k]);
      if (boundaries[k].some((w) => w !== 0)) live.push(k);
    });
    for (let tries = 0; live.length > 0 && tries < 8; tries++) {
      run?.check();
      let bestK = -1, bestX = 0, bestY = 0, bestV = Infinity;
      for (const k of live) {
        const rows = boundaries[k];
        for (let y = 0; y < gh; y++) for (let w = 0; w < free.W; w++) {
          let bits = rows[y * free.W + w];
          while (bits !== 0) {
            const low = bits & -bits, x = (w << 5) + 31 - Math.clz32(low);
            bits = (bits ^ low) >>> 0;
            const v = potential[y * gw + x];
            if (v < bestV) { bestV = v; bestK = k; bestX = x; bestY = y; }
          }
        }
      }
      if (bestK < 0) return null;
      const variant = variants[bestK], foot = footprints[bestK], piece = pieces[bestK];
      const px = originX + (bestX + 0.5) * cell, py = originY + (bestY + 0.5) * cell;
      const at = (x: number, y: number): Candidate => {
        const f = foot.map((r) => moveRegion(r, 1, false, 1, 0, x, y));
        return { piece: piece.map((r) => moveRegion(r, 1, false, 1, 0, x, y)), foot: f, bounds: boundsOfRegions(f) };
      };
      let position: Point = [px, py], moved = at(px, py);
      const bounds = moved.bounds, span = 10 * cell, near = placed.filter((o) => o.bounds[0] < bounds[2] + span && o.bounds[2] > bounds[0] - span && o.bounds[1] < bounds[3] + span && o.bounds[3] > bounds[1] - span);
      if (!fitsExactly(moved, near)) {
        rejected++;
        boundaries[bestK][bestY * free.W + (bestX >> 5)] &= ~(1 << (bestX & 31));
        if (!boundaries[bestK].some((w) => w !== 0)) live.splice(live.indexOf(bestK), 1);
        continue;
      }
      position = settle(position, at, near, descent, fitsExactly, cell);
      moved = at(position[0], position[1]);
      return commit(item, size, retries, variant, position, moved.foot, moved.bounds);
    }
    return null;
  }

  function commit(item: PackItem, size: number, retries: number, variant: Variant, position: Point, footprint: readonly LocalRegion[], bounds: readonly [number, number, number, number]): PackedInstance {
    const shape = item.shape.domain.regions.map((r, k): PlanarRegionData => {
      const outer = moveRing(r.outer, size, variant.mirror, variant.cos, variant.sin, position[0], position[1]);
      return { id: `${item.id}/${k}`, outer: outer as unknown as [number, number][], holes: r.holes.map((h) => moveRing(h, size, variant.mirror, variant.cos, variant.sin, position[0], position[1]) as unknown as [number, number][]) };
    });
    const region = planarDomain(shape.map((data) => planarRegion(data)), { id: item.id });
    // Block every cell the footprint touches.
    const rings = footprint.flatMap((r) => [r.outer, ...r.holes]).map((ring) => ring.map(([x, y]) => toCell(x, y)));
    const x0 = Math.max(0, Math.floor((bounds[0] - originX) / cell) - 1), y0 = Math.max(0, Math.floor((bounds[1] - originY) / cell) - 1);
    const x1 = Math.min(gw - 1, Math.ceil((bounds[2] - originX) / cell) + 1), y1 = Math.min(gh - 1, Math.ceil((bounds[3] - originY) / cell) + 1);
    const w = x1 - x0 + 1, h = y1 - y0 + 1, marks = rasterize(rings, x0, y0, w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (marks[j * w + i] !== 0) free.clear(x0 + i, y0 + j);
    levels = buildLevels(free);
    refreshRows();
    placed.push({ regions: footprint, bounds });
    const frozen = footprint.map((r) => Object.freeze({ outer: Object.freeze(r.outer.map((p) => Object.freeze([p[0], p[1]] as const))) as Ring,
      holes: Object.freeze(r.holes.map((hole) => Object.freeze(hole.map((p) => Object.freeze([p[0], p[1]] as const))) as Ring)) }));
    return Object.freeze({ id: item.id, item, rank: instances.length, position: Object.freeze([position[0], position[1]] as const) as Point, angle: variant.angle,
      mirrored: variant.mirror, size, retries, region, footprint: Object.freeze(frozen) });
  }

  const containerArea = container.area;
  return Object.freeze({
    id: `packing:${container.id}`, container, usable, rules: Object.freeze({ ...rules }),
    instances: Object.freeze(instances), unplaced: Object.freeze(unplaced), placedArea, containerArea, coverage: containerArea > 0 ? placedArea / containerArea : 0,
    stats: Object.freeze({ tried, steps: steps.used, rejected, exactTests, cell, cells: Object.freeze([gw, gh] as const) as readonly [number, number] }),
  });
}

/** Directions tried in order at each settle round: the descent direction, then 45° and 90° either side. */
const TURNS = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2] as const;

function settle(start: Point, at: (x: number, y: number) => Candidate, near: readonly Placed[],
  descent: (x: number, y: number) => Point, fits: (candidate: Candidate, near: readonly Placed[]) => boolean, cell: number): Point {
  let [x, y] = start;
  const test = (px: number, py: number): boolean => fits(at(px, py), near);
  const reach = 2.2 * cell, unit = cell / 3;
  for (let round = 0; round < 4; round++) {
    const [ux, uy] = descent(x, y);
    let moved = false;
    for (const turn of TURNS) {
      const c = Math.cos(turn), s = Math.sin(turn), dx = ux * c - uy * s, dy = ux * s + uy * c;
      if (!test(x + dx * unit / 16, y + dy * unit / 16)) continue;
      let good = unit / 16, bad = -1;
      for (let t = unit; t <= reach; t += unit) { if (test(x + dx * t, y + dy * t)) good = t; else { bad = t; break; } }
      if (bad > 0) for (let i = 0; i < 7; i++) { const mid = (good + bad) / 2; if (test(x + dx * mid, y + dy * mid)) good = mid; else bad = mid; }
      if (good > unit / 8) { x += dx * good; y += dy * good; moved = true; break; }
    }
    if (!moved) break;
  }
  return [x, y];
}

/**
 * The container minus the union of the placed pieces: the negative space, as a domain (empty when the pieces
 * cover the container exactly). One exact union and one exact difference; cached per packing.
 */
const negativeCache = new WeakMap<ShapePacking, PlanarDomain>();
export function packNegativeSpace(packing: ShapePacking, options: { maxWork?: number; run?: { check(): void } } = {}): PlanarDomain {
  const hit = negativeCache.get(packing);
  if (hit) return hit;
  const opts = { id: `${packing.id}/negative`, ...(options.maxWork === undefined ? {} : { maxWork: options.maxWork }), ...(options.run ? { run: options.run } : {}) };
  const domain = packing.instances.length === 0 ? packing.container
    : domainDifference(packing.container, unionDomains(packing.instances.map((i) => i.region), opts), opts);
  negativeCache.set(packing, domain);
  return domain;
}
