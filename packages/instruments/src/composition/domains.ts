import { textOutlines } from "../adapters/image-signal-instruments.js";
import { componentSeed } from "./core.js";
import {
  PlanarError, charge, checkCoordinate, forEachCandidate, classify, locateInRing, makeWork, overlay,
  planarize, pushEdge, ringArea, ringOrientation, windings,
  type Fill, type Pt, type RawRegion, type Seg, type Work,
} from "./planar-kernel.js";
import type { Path, Point, Region } from "./types.js";

/**
 * Robust planar domains: polygons with holes, exact Boolean operations, and the queries that
 * consumers of a region need. The full contract (semantics, limits, non-goals) is
 * `docs/composition-domains.md`; the summary follows.
 *
 * VALUES. A `PlanarRegion` is one connected polygon: an `outer` ring and zero or more `holes`.
 * A `PlanarDomain` is an ordered, deeply frozen set of regions whose interiors are pairwise
 * disjoint (they may touch at points or along shared boundary pieces). Both are plain data
 * (arrays of `[x, y]`, numbers, strings): they round-trip through JSON and can be fed back to
 * every function. Coordinates are canvas units. ORIENTATION IS NORMALISED: an outer ring has
 * positive shoelace area `Σ(xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)/2`, holes negative, so the region is always on the
 * LEFT of its rings' direction of travel. (That is counter-clockwise with y up and clockwise on
 * the y-down canvas.) Input rings may be given in either orientation and are reversed as needed.
 *
 * BOUNDARY RULE. A region is the CLOSED set: points on the outer ring or on a hole ring are
 * contained. `locateInDomain` reports "inside", "boundary" or "outside" by exact predicates.
 *
 * FAILURE. Constructors throw `PlanarError` for non-finite or out-of-range coordinates, rings
 * with fewer than three distinct vertices, zero-area rings, self-intersecting or self-touching
 * rings, rings that cross or share a boundary piece, holes outside their outer ring or overlapping
 * other holes, and overlapping regions in a domain. Pass `repair: "nonzero" | "evenodd"` to
 * `planarDomain` (or use `ringsDomain`) to instead resolve the supplied rings by a fill rule.
 * Work above `maxWork` exact geometric tests throws with code "WORK_LIMIT"; nothing is thinned.
 *
 * DETERMINISM. Results depend only on the geometry: not on ring start vertices, ring order,
 * argument order of symmetric operations, or call history. No randomness; there are no seeds.
 */
export type Ring = readonly Point[];
export type { Fill, PlanarErrorCode } from "./planar-kernel.js";
export { PlanarError } from "./planar-kernel.js";

/** Plain-data region input: rings are copied, checked and orientation-normalised. */
export interface PlanarRegionData {
  readonly id?: string;
  readonly outer: readonly (readonly [number, number])[];
  readonly holes?: readonly (readonly (readonly [number, number])[])[];
}
export interface PlanarRegion {
  readonly id: string;
  /** Positive shoelace area (region on the left of travel). */
  readonly outer: Ring;
  /** Negative shoelace area each; hole `k` is conventionally named `${id}/h${k}`. */
  readonly holes: readonly Ring[];
  /** Outer area minus hole areas. */
  readonly area: number;
  /** Total length of the outer and hole rings. */
  readonly perimeter: number;
  /** [left, top, right, bottom] = [min x, min y, max x, max y] of the outer ring. */
  readonly bounds: readonly [number, number, number, number];
  /** Area centroid of the region (holes accounted for). */
  readonly centroid: Point;
}
export interface PlanarDomain {
  readonly id: string;
  readonly regions: readonly PlanarRegion[];
  readonly area: number;
  readonly perimeter: number;
  /** `null` for the empty domain. */
  readonly bounds: readonly [number, number, number, number] | null;
  readonly centroid: Point | null;
}
export type PlanarShape = PlanarRegion | PlanarDomain | PlanarRegionData;

/** Explicit work and size bounds. Measured on the development machine; see the documentation. */
export const PLANAR_LIMITS = Object.freeze({
  /** Default `maxWork`: exact segment/edge tests per operation. */
  maxWork: 40_000_000,
  /** Largest `maxWork` a caller may request. */
  maxWorkCeiling: 2_000_000_000,
  /** Boundary edges accepted by one operation (sum over all inputs). */
  maxEdges: 400_000,
  /** Regions in one input list. */
  maxRegions: 100_000,
});

export interface PlanarOptions {
  /** Id of the returned domain. Default depends on the operation. Regions are `${id}/${k}`. */
  readonly id?: string;
  /** Exact-test budget; default `PLANAR_LIMITS.maxWork`. Exceeding it throws a "WORK_LIMIT" `PlanarError`. */
  readonly maxWork?: number;
  /** A composition run whose `check()` is called periodically so long operations can be cancelled. */
  readonly run?: { check(): void };
  /**
   * Computed results only: drop regions smaller than this area and fill holes smaller than it.
   * Default 0 keeps everything, including numerically tiny slivers.
   */
  readonly minArea?: number;
}
export interface RepairOptions extends PlanarOptions {
  /** Resolve self-intersecting or overlapping input by this fill rule instead of rejecting it. */
  readonly repair?: "nonzero" | "evenodd";
}

const trusted = new WeakSet<object>();
/** Regions built from data without an explicit id; a domain renames them `${id}/${k}`. */
const autoNamed = new WeakSet<object>();

export function workFor(label: string, options: PlanarOptions | undefined): Work {
  const limit = options?.maxWork ?? PLANAR_LIMITS.maxWork;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > PLANAR_LIMITS.maxWorkCeiling)
    throw new PlanarError("INVALID_INPUT", `options.maxWork must be an integer in [1, ${PLANAR_LIMITS.maxWorkCeiling}]`);
  const run = options?.run;
  return makeWork(label, limit, run ? () => { try { run.check(); } catch (error) { throw new PlanarError("CANCELLED", error instanceof Error ? error.message : "Cancelled"); } } : undefined);
}
function minAreaOf(options: PlanarOptions | undefined): number {
  const value = options?.minArea ?? 0;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new PlanarError("INVALID_INPUT", "options.minArea must be a finite number ≥ 0");
  return value;
}
function idOf(value: unknown, label: string, fallback: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || value.length === 0 || value.length > 200) throw new PlanarError("INVALID_INPUT", `${label} must be a non-empty string of at most 200 characters`);
  return value;
}

// ---------------------------------------------------------------------------------------------
// Ring hygiene and measures
// ---------------------------------------------------------------------------------------------
/** Validate and copy one ring: finite in-range coordinates; drops consecutive duplicates and a repeated closing vertex. */
export function cleanRing(label: string, ring: unknown, minimum = 3): Pt[] {
  if (!Array.isArray(ring)) throw new PlanarError("INVALID_INPUT", `${label} must be an array of [x, y] points`);
  const out: Pt[] = [];
  for (let i = 0; i < ring.length; i++) {
    const p: unknown = ring[i];
    if (!Array.isArray(p) || p.length !== 2) throw new PlanarError("INVALID_INPUT", `${label}[${i}] must be a two-element [x, y] point`);
    const x = checkCoordinate(`${label}[${i}][0]`, p[0]), y = checkCoordinate(`${label}[${i}][1]`, p[1]);
    const last = out[out.length - 1];
    if (last && last[0] === x && last[1] === y) continue;
    out.push([x, y]);
  }
  while (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
  if (out.length < minimum) throw new PlanarError("INVALID_INPUT", `${label} needs at least ${minimum} distinct vertices`);
  return out;
}

const freezeRing = (points: readonly Pt[]): Ring => Object.freeze(points.map((p) => Object.freeze([p[0], p[1]] as const)));

interface Measures { area: number; perimeter: number; bounds: [number, number, number, number]; cx: number; cy: number }
function measureRings(outer: readonly Pt[], holes: readonly (readonly Pt[])[]): Measures {
  let area = 0, mx = 0, my = 0, perimeter = 0;
  const all = [outer, ...holes];
  for (const ring of all) {
    const [ox, oy] = ring[0];
    let a = 0, sx = 0, sy = 0;
    for (let i = 1; i + 1 < ring.length; i++) {
      const x1 = ring[i][0] - ox, y1 = ring[i][1] - oy, x2 = ring[i + 1][0] - ox, y2 = ring[i + 1][1] - oy, c = x1 * y2 - x2 * y1;
      a += c; sx += (x1 + x2) * c; sy += (y1 + y2) * c;
    }
    a /= 2;
    // ∫x dA over the ring = ox·A + Σ (x1+x2)·c / 6
    area += a; mx += ox * a + sx / 6; my += oy * a + sy / 6;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) perimeter += Math.hypot(ring[i][0] - ring[j][0], ring[i][1] - ring[j][1]);
  }
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const [x, y] of outer) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
  return { area, perimeter, bounds: [l, t, r, b], cx: area === 0 ? (l + r) / 2 : mx / area, cy: area === 0 ? (t + b) / 2 : my / area };
}

function buildRegion(id: string, outer: readonly Pt[], holes: readonly (readonly Pt[])[]): PlanarRegion {
  const m = measureRings(outer, holes);
  const region: PlanarRegion = Object.freeze({
    id, outer: freezeRing(outer), holes: Object.freeze(holes.map(freezeRing)),
    area: m.area, perimeter: m.perimeter, bounds: Object.freeze(m.bounds), centroid: Object.freeze([m.cx, m.cy] as const),
  });
  trusted.add(region);
  return region;
}
function buildDomain(id: string, regions: readonly PlanarRegion[]): PlanarDomain {
  let area = 0, perimeter = 0, mx = 0, my = 0, l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const region of regions) {
    area += region.area; perimeter += region.perimeter;
    mx += region.centroid[0] * region.area; my += region.centroid[1] * region.area;
    if (region.bounds[0] < l) l = region.bounds[0];
    if (region.bounds[1] < t) t = region.bounds[1];
    if (region.bounds[2] > r) r = region.bounds[2];
    if (region.bounds[3] > b) b = region.bounds[3];
  }
  const domain: PlanarDomain = Object.freeze({
    id, regions: Object.freeze(regions.slice()), area, perimeter,
    bounds: regions.length ? Object.freeze([l, t, r, b] as const) : null,
    centroid: regions.length ? Object.freeze([area === 0 ? (l + r) / 2 : mx / area, area === 0 ? (t + b) / 2 : my / area] as const) : null,
  });
  trusted.add(domain);
  return domain;
}

// ---------------------------------------------------------------------------------------------
// Strict construction
// ---------------------------------------------------------------------------------------------
interface TaggedSeg extends Seg { ring: number; edge: number }

/**
 * Check that a set of rings forms valid simple boundaries: no ring touches itself, no two rings
 * cross or share a boundary piece (isolated touching points are allowed). Throws the first violation.
 */
function checkRingContacts(rings: readonly (readonly Pt[])[], names: readonly string[], work: Work): void {
  const segs: TaggedSeg[] = [];
  rings.forEach((ring, r) => {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const before = segs.length;
      pushEdge(segs, 1, 0, ring[j][0], ring[j][1], ring[i][0], ring[i][1]);
      if (segs.length === before) throw new PlanarError("INVALID_INPUT", `${names[r]} has a repeated vertex at index ${i}`);
      const s = segs[segs.length - 1] as TaggedSeg;
      s.ring = r; s.edge = j;
    }
  });
  charge(work, segs.length);
  segs.sort((a, b) => a.ax - b.ax || a.ay - b.ay || a.bx - b.bx || a.by - b.by);
  forEachCandidate(segs, work, (i, j) => {
    const s = segs[i] as TaggedSeg, t = segs[j] as TaggedSeg;
    const kind = classify(s, t);
    if (kind === 0) return;
    if (s.ring === t.ring) {
      const n = rings[s.ring].length, d = Math.abs(s.edge - t.edge);
      const adjacent = d === 1 || d === n - 1;
      if (adjacent && kind === 1) return;
      throw new PlanarError("SELF_INTERSECTION", `${names[s.ring]} ${kind === 2 ? "crosses itself" : adjacent ? "doubles back on itself" : "touches itself"} at edges ${Math.min(s.edge, t.edge)} and ${Math.max(s.edge, t.edge)}; repair the ring or pass repair: "nonzero" | "evenodd"`);
    }
    if (kind === 1) return;
    throw new PlanarError("SELF_INTERSECTION", `${names[s.ring]} ${kind === 2 ? "crosses" : "overlaps a boundary piece of"} ${names[t.ring]}; rings of one region may touch only at isolated points`);
  });
}

/** Windings of a normalised, planarised set of rings: every side must lie in {0, 1}. */
function checkNesting(rings: readonly (readonly Pt[])[], label: string, work: Work): void {
  const segs: Seg[] = [];
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) pushEdge(segs, 1, 0, ring[j][0], ring[j][1], ring[i][0], ring[i][1]);
  const planar = planarize(segs, work);
  const { above, below } = windings(planar, 1, work);
  for (let k = 0; k < planar.length; k++) {
    if ((above[k] < 0 || above[k] > 1) || (below[k] < 0 || below[k] > 1))
      throw new PlanarError("INVALID_REGION", `${label}: rings are not properly nested (a hole lies outside its outer ring, holes overlap, or a hole is nested inside another hole) near (${planar[k].ax}, ${planar[k].ay})`);
  }
}

function strictRegion(data: PlanarRegionData, fallbackId: string, work: Work): PlanarRegion {
  if (typeof data !== "object" || data === null) throw new PlanarError("INVALID_INPUT", "A region must be an object with an outer ring");
  const id = idOf(data.id, "Region id", fallbackId);
  const named = data.id !== undefined;
  const outer = cleanRing(`${id}.outer`, data.outer);
  const holeInput = data.holes ?? [];
  if (!Array.isArray(holeInput)) throw new PlanarError("INVALID_INPUT", `${id}.holes must be an array of rings`);
  const holes = holeInput.map((ring, k) => cleanRing(`${id}.holes[${k}]`, ring));
  const rings = [outer, ...holes], names = [`${id}.outer`, ...holes.map((_, k) => `${id}.holes[${k}]`)];
  checkRingContacts(rings, names, work);
  const oriented = rings.map((ring, k) => {
    const sign = ringOrientation(ring);
    if (sign === 0) throw new PlanarError("INVALID_REGION", `${names[k]} has zero area`);
    return sign === (k === 0 ? 1 : -1) ? ring : ring.slice().reverse();
  });
  if (oriented.length > 1) checkNesting(oriented, id, work);
  const region = buildRegion(id, oriented[0], oriented.slice(1));
  if (!named) autoNamed.add(region);
  return region;
}

/**
 * The strict single-region constructor. `data.outer` and each of `data.holes` are rings of
 * `[x, y]` (either orientation; they are reversed to the documented orientation). The vertex order and
 * start of each ring are preserved. Throws `PlanarError` unless the rings are valid; see the header.
 */
export function planarRegion(data: PlanarRegionData, options?: PlanarOptions): PlanarRegion {
  if (trusted.has(data)) return data as PlanarRegion;
  return strictRegion(data, "region", workFor("planarRegion", options));
}

function asDomainOrRegion(shape: PlanarShape, index: number, work: Work): PlanarDomain | PlanarRegion {
  if (typeof shape !== "object" || shape === null) throw new PlanarError("INVALID_INPUT", `shape ${index} must be a region or domain`);
  if (trusted.has(shape)) return shape as PlanarDomain | PlanarRegion;
  if ("regions" in shape) throw new PlanarError("INVALID_INPUT", `shape ${index} looks like a domain but was not produced by this library; pass its regions to planarDomain instead`);
  return strictRegion(shape as PlanarRegionData, `region${index}`, work);
}
function regionsOf(shapes: readonly PlanarShape[], work: Work): PlanarRegion[] {
  const out: PlanarRegion[] = [];
  shapes.forEach((shape, index) => {
    const value = asDomainOrRegion(shape, index, work);
    if ("regions" in value) out.push(...value.regions); else out.push(value);
  });
  return out;
}
function listOf(input: PlanarShape | readonly PlanarShape[]): readonly PlanarShape[] {
  if (Array.isArray(input)) return input as readonly PlanarShape[];
  return [input as PlanarShape];
}

function finishRaw(id: string, raw: readonly RawRegion[], options: PlanarOptions | undefined): PlanarDomain {
  const minArea = minAreaOf(options);
  const kept: { outer: Pt[]; holes: Pt[][] }[] = [];
  for (const part of raw) {
    const outerArea = ringArea(part.outer);
    if (outerArea < minArea) continue;
    const holes = minArea > 0 ? part.holes.filter((hole) => -ringArea(hole) >= minArea) : part.holes;
    if (minArea > 0 && outerArea + holes.reduce((sum, hole) => sum + ringArea(hole), 0) < minArea) continue;
    kept.push({ outer: part.outer, holes });
  }
  return buildDomain(id, kept.map((part, k) => buildRegion(`${id}/${k}`, part.outer, part.holes)));
}

function ringsOfRegions(regions: readonly PlanarRegion[]): Pt[][] {
  const out: Pt[][] = [];
  for (const region of regions) { out.push(region.outer as Pt[]); for (const hole of region.holes) out.push(hole as Pt[]); }
  return out;
}
function edgeCount(rings: readonly (readonly unknown[])[]): number {
  let n = 0;
  for (const ring of rings) n += ring.length;
  return n;
}
function checkEdgeLimit(rings: readonly (readonly unknown[])[], label: string): void {
  const n = edgeCount(rings);
  if (n > PLANAR_LIMITS.maxEdges) throw new PlanarError("WORK_LIMIT", `${label} has ${n} boundary edges; the limit is ${PLANAR_LIMITS.maxEdges}. Simplify the shapes (simplifyDomain) or split the work`);
}

/**
 * Build a domain from one or more regions. Plain region data is validated strictly (see
 * `planarRegion`); values already produced by this library are trusted. The regions' interiors
 * must be disjoint (touching is allowed), otherwise a "INVALID_REGION" error is thrown, unless
 * `options.repair` names a fill rule, in which case ALL rings are pooled (holes and outers
 * keep their normalised orientation) and resolved by that rule into canonical regions.
 * Without `repair`, region order and ids are kept as supplied (`data.id`, else `${id}/${k}`).
 */
export function planarDomain(input: PlanarShape | readonly PlanarShape[], options?: RepairOptions): PlanarDomain {
  const id = idOf(options?.id, "options.id", "domain");
  const work = workFor("planarDomain", options);
  const shapes = listOf(input);
  if (shapes.length > PLANAR_LIMITS.maxRegions) throw new PlanarError("WORK_LIMIT", `${shapes.length} shapes exceed the limit of ${PLANAR_LIMITS.maxRegions}`);
  if (options?.repair !== undefined) {
    if (options.repair !== "nonzero" && options.repair !== "evenodd") throw new PlanarError("INVALID_INPUT", `options.repair must be "nonzero" or "evenodd"`);
    const rings: Pt[][] = [];
    shapes.forEach((shape, index) => {
      if (typeof shape !== "object" || shape === null) throw new PlanarError("INVALID_INPUT", `shape ${index} must be a region or domain`);
      if (trusted.has(shape)) { rings.push(...ringsOfRegions("regions" in shape ? shape.regions : [shape as PlanarRegion])); return; }
      const data = shape as PlanarRegionData, rid = data.id ?? `region${index}`;
      const outer = cleanRing(`${rid}.outer`, data.outer);
      rings.push(ringArea(outer) >= 0 ? outer : outer.reverse());
      (data.holes ?? []).forEach((hole, k) => {
        const ring = cleanRing(`${rid}.holes[${k}]`, hole);
        rings.push(ringArea(ring) <= 0 ? ring : ring.reverse());
      });
    });
    return resolveRings(id, rings, options.repair, options, work);
  }
  const regions = regionsOf(shapes, work);
  if (regions.length > 1) {
    const rings = ringsOfRegions(regions);
    checkEdgeLimit(rings, "planarDomain input");
    const segs: Seg[] = [];
    for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) pushEdge(segs, 1, 0, ring[j][0], ring[j][1], ring[i][0], ring[i][1]);
    const planar = planarize(segs, work);
    const { above, below } = windings(planar, 1, work);
    for (let k = 0; k < planar.length; k++)
      if (above[k] < 0 || above[k] > 1 || below[k] < 0 || below[k] > 1)
        throw new PlanarError("INVALID_REGION", `Regions of a domain overlap near (${planar[k].ax}, ${planar[k].ay}); their interiors must be disjoint`);
  }
  const seen = new Set<string>();
  const named = regions.map((region, k) => {
    const wanted = autoNamed.has(region) ? `${id}/${k}` : region.id;
    if (seen.has(wanted)) throw new PlanarError("INVALID_INPUT", `Region id ${JSON.stringify(wanted)} is used twice`);
    seen.add(wanted);
    return wanted === region.id ? region : buildRegion(wanted, region.outer as Pt[], region.holes as Pt[][]);
  });
  return buildDomain(id, named);
}

function resolveRings(id: string, rings: readonly (readonly Pt[])[], fill: Fill, options: PlanarOptions | undefined, work: Work): PlanarDomain {
  checkEdgeLimit(rings, "The ring set");
  const raw = overlay([{ rings, fill }], ([inside]) => inside, work);
  return finishRaw(id, raw, options);
}

/**
 * Resolve arbitrary closed rings (a "ring soup", such as font contours) by a fill rule. Rings may
 * have any orientation, cross each other and themselves, and overlap: this is the documented
 * repair path. `fill: "nonzero"` follows the font convention (outer rings and counters have
 * opposite orientation); "evenodd" alternates; "positive" keeps only areas wound counter-clockwise
 * (positive shoelace) net. Rings with fewer than three distinct vertices enclose nothing and are ignored.
 */
export function ringsDomain(rings: readonly (readonly (readonly [number, number])[])[], options: PlanarOptions & { readonly fill: Fill }): PlanarDomain {
  const id = idOf(options.id, "options.id", "rings");
  if (options.fill !== "nonzero" && options.fill !== "evenodd" && options.fill !== "positive") throw new PlanarError("INVALID_INPUT", `options.fill must be "nonzero", "evenodd" or "positive"`);
  if (!Array.isArray(rings)) throw new PlanarError("INVALID_INPUT", "rings must be an array of rings");
  const clean: Pt[][] = [];
  rings.forEach((ring, k) => {
    let cleaned: Pt[];
    try { cleaned = cleanRing(`rings[${k}]`, ring); } catch (error) {
      if (error instanceof PlanarError && /at least 3 distinct/.test(error.message)) return;
      throw error;
    }
    clean.push(cleaned);
  });
  return resolveRings(id, clean, options.fill, options, workFor("ringsDomain", options));
}

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------
export type DomainLocation = "inside" | "boundary" | "outside";
function locateInRegion(region: PlanarRegion, x: number, y: number): number {
  const [l, t, r, b] = region.bounds;
  if (x < l || x > r || y < t || y > b) return -1;
  const outer = locateInRing(region.outer as Pt[], x, y);
  if (outer <= 0) return outer;
  for (const hole of region.holes) {
    const at = locateInRing(hole as Pt[], x, y);
    if (at === 0) return 0;
    if (at > 0) return -1;
  }
  return 1;
}
/** Exact location of a point against a region or domain (the closed set; see the header). */
export function locateInDomain(shape: PlanarShape, x: number, y: number): DomainLocation {
  checkCoordinate("x", x); checkCoordinate("y", y);
  const value = asDomainOrRegion(shape, 0, workFor("locate", undefined));
  let boundary = false;
  for (const region of "regions" in value ? value.regions : [value]) {
    const at = locateInRegion(region, x, y);
    if (at > 0) return "inside";
    if (at === 0) boundary = true;
  }
  return boundary ? "boundary" : "outside";
}
/** True for points inside or on the boundary of the shape. */
export const domainContains = (shape: PlanarShape, x: number, y: number): boolean => locateInDomain(shape, x, y) !== "outside";

/** All rings of a shape in order: each region's outer ring then its holes. Frozen, not copied. */
export function domainRings(shape: PlanarShape): readonly Ring[] {
  const value = asDomainOrRegion(shape, 0, workFor("domainRings", undefined));
  return Object.freeze("regions" in value ? value.regions.flatMap((region) => [region.outer, ...region.holes]) : [value.outer, ...value.holes]);
}

// ---------------------------------------------------------------------------------------------
// Booleans
// ---------------------------------------------------------------------------------------------
type Combine = (inside: readonly boolean[]) => boolean;
function combine(name: string, a: PlanarShape, b: PlanarShape, keep: Combine, options: PlanarOptions | undefined): PlanarDomain {
  const work = workFor(name, options);
  const left = regionsOf([a], work), right = regionsOf([b], work);
  const idA = "regions" in (a as object) ? (a as PlanarDomain).id : (a as PlanarRegion | PlanarRegionData).id ?? "a";
  const idB = "regions" in (b as object) ? (b as PlanarDomain).id : (b as PlanarRegion | PlanarRegionData).id ?? "b";
  const id = idOf(options?.id, "options.id", `${name}(${idA},${idB})`);
  const ringsA = ringsOfRegions(left), ringsB = ringsOfRegions(right);
  checkEdgeLimit([...ringsA, ...ringsB], name);
  const raw = overlay([{ rings: ringsA, fill: "nonzero" }, { rings: ringsB, fill: "nonzero" }], keep, work);
  return finishRaw(id, raw, options);
}
/** Points in a or b. Symmetric. */
export const domainUnion = (a: PlanarShape, b: PlanarShape, options?: PlanarOptions): PlanarDomain => combine("union", a, b, ([p, q]) => p || q, options);
/** Points in both a and b. Symmetric. The result is closed under the boundary rule only where it has area: pieces that meet in a point or along a segment are not returned. */
export const domainIntersection = (a: PlanarShape, b: PlanarShape, options?: PlanarOptions): PlanarDomain => combine("intersection", a, b, ([p, q]) => p && q, options);
/** Points in a but not b (the result's boundary includes the part of b's boundary inside a). */
export const domainDifference = (a: PlanarShape, b: PlanarShape, options?: PlanarOptions): PlanarDomain => combine("difference", a, b, ([p, q]) => p && !q, options);
/** Points in exactly one of a and b. Symmetric. */
export const domainXor = (a: PlanarShape, b: PlanarShape, options?: PlanarOptions): PlanarDomain => combine("xor", a, b, ([p, q]) => p !== q, options);

/** Union of any number of shapes in one exact pass. Order does not matter. `[]` gives the empty domain. */
export function unionDomains(shapes: readonly PlanarShape[], options?: PlanarOptions): PlanarDomain {
  const work = workFor("unionDomains", options);
  const id = idOf(options?.id, "options.id", "union");
  const regions = regionsOf(shapes, work);
  const rings = ringsOfRegions(regions);
  checkEdgeLimit(rings, "unionDomains input");
  return finishRaw(id, overlay([{ rings, fill: "nonzero" }], ([inside]) => inside, work), options);
}

/** The empty domain (no regions, zero area). */
export const emptyDomain = (id = "empty"): PlanarDomain => buildDomain(idOf(id, "id", "empty"), []);

// ---------------------------------------------------------------------------------------------
// Bridges from existing composition values
// ---------------------------------------------------------------------------------------------
/** One axis-aligned rectangle from a composition `Region` (or any `{ id?, bounds: [left, top, right, bottom] }`). */
export function rectangleRegion(region: { readonly id?: string; readonly bounds: readonly [number, number, number, number] }): PlanarRegion {
  if (typeof region !== "object" || region === null || !Array.isArray(region.bounds) || region.bounds.length !== 4) throw new PlanarError("INVALID_INPUT", "A rectangle needs bounds [left, top, right, bottom]");
  const [l, t, r, b] = region.bounds.map((v, k) => checkCoordinate(`bounds[${k}]`, v));
  if (!(r > l && b > t)) throw new PlanarError("INVALID_INPUT", `Rectangle bounds [${l}, ${t}, ${r}, ${b}] must have right > left and bottom > top`);
  return buildRegion(idOf(region.id, "Region id", "region"), [[l, t], [r, t], [r, b], [l, b]], []);
}
/**
 * A domain from composition `Region` rectangles: `partitionRegions` output, `regionTree` leaves.
 * Region ids and order are kept; rectangles may share edges but must not overlap.
 */
export function rectangleDomain(regions: readonly Pick<Region, "id" | "bounds">[], options?: PlanarOptions): PlanarDomain {
  if (!Array.isArray(regions)) throw new PlanarError("INVALID_INPUT", "regions must be an array");
  return planarDomain(regions.map(rectangleRegion), options);
}

const textCache = new Map<string, PlanarDomain>();
export interface TextDomainOptions extends PlanarOptions {
  readonly centerX: number;
  readonly centerY: number;
  /** The glyph ink is scaled uniformly to fit inside this box and centred in it. */
  readonly width: number;
  readonly height: number;
}
/**
 * The licensed outline font's outlines of 1–20 printable ASCII characters as a domain: counters are
 * holes, overlapping contours are unioned (nonzero fill). The ink bounds are fitted uniformly into
 * `width × height` about `(centerX, centerY)`, y down like the canvas. Cached; the value is frozen.
 */
export function textDomain(content: string, options: TextDomainOptions): PlanarDomain {
  for (const key of ["centerX", "centerY", "width", "height"] as const) checkCoordinate(`options.${key}`, options[key]);
  if (!(options.width > 0 && options.height > 0)) throw new PlanarError("INVALID_INPUT", "options.width and options.height must be positive");
  const id = idOf(options.id, "options.id", `text:${content}`);
  const key = JSON.stringify([content, options.centerX, options.centerY, options.width, options.height, id, options.minArea ?? 0]);
  const hit = textCache.get(key);
  if (hit) return hit;
  const contours = textOutlines(content);
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const contour of contours) for (const [x, y] of contour) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  if (!(right > left && bottom > top)) throw new PlanarError("INVALID_INPUT", `Text ${JSON.stringify(content)} has no outlines`);
  const scale = Math.min(options.width / (right - left), options.height / (bottom - top));
  const mx = (left + right) / 2, my = (top + bottom) / 2;
  const domain = ringsDomain(contours.map((contour) => contour.map(([x, y]): [number, number] =>
    [options.centerX + (x - mx) * scale, options.centerY + (y - my) * scale])), { fill: "nonzero", id, ...(options.minArea === undefined ? {} : { minArea: options.minArea }), ...(options.maxWork === undefined ? {} : { maxWork: options.maxWork }) });
  if (textCache.size >= 32) textCache.delete(textCache.keys().next().value as string);
  textCache.set(key, domain);
  return domain;
}

/**
 * Merge each hole of a region into its outer ring by one zero-width "keyhole" cut, giving one
 * polygon with no separate contour, for surfaces that fill a single closed shape (p5's
 * beginShape/endShape). Each hole is joined at the nearest outer/hole vertex pair (ties by lower
 * indices) and the cut is traversed out and back, so it encloses no area. Fill it, never stroke it.
 * Holes touching the outer ring at a vertex are joined there.
 */
export function keyholeRing(region: PlanarRegion): Ring {
  if (!trusted.has(region)) throw new PlanarError("INVALID_INPUT", "keyholeRing needs a region produced by planarRegion or a domain operation");
  if (region.holes.length === 0) return region.outer;
  const cuts = new Map<number, { hole: Ring; start: number }[]>();
  for (const hole of region.holes) {
    let bestOuter = 0, bestHole = 0, bestDistance = Infinity;
    region.outer.forEach((p, i) => hole.forEach((q, j) => {
      const distance = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
      if (distance < bestDistance) { bestDistance = distance; bestOuter = i; bestHole = j; }
    }));
    const at = cuts.get(bestOuter);
    if (at) at.push({ hole, start: bestHole }); else cuts.set(bestOuter, [{ hole, start: bestHole }]);
  }
  const merged: Point[] = [];
  region.outer.forEach((p, i) => {
    merged.push(p);
    for (const { hole, start } of cuts.get(i) ?? []) {
      for (let step = 0; step <= hole.length; step++) merged.push(hole[(start + step) % hole.length]);
      merged.push(p);
    }
  });
  return Object.freeze(merged);
}

// ---------------------------------------------------------------------------------------------
// Composition path bridge (shared by clipping and hatching)
// ---------------------------------------------------------------------------------------------
/** A composition `Path` derived from `path`: id `<id>#<n>`, seed derived from the source path's seed and id. */
export function derivedPath(path: Path, index: number, points: readonly Point[], closed: boolean, purpose: string): Path {
  return Object.freeze({
    id: `${path.id}#${index}`, seed: componentSeed(path.seed, path.id, purpose),
    points: Object.freeze(points.map((p) => Object.freeze([p[0], p[1]] as const))), closed,
    level: path.level, levelFraction: path.levelFraction, ...(path.tone === undefined ? {} : { tone: path.tone }),
  });
}

export { asDomainOrRegion as resolveShape, buildDomain, finishRaw, ringsOfRegions, checkEdgeLimit };
