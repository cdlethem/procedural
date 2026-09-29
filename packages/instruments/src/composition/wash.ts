import { gradientNoise2D01 } from "@procedurals/javascript";
import { componentSeed } from "./core.js";
import {
  domainDifference, domainIntersection, emptyDomain, keyholeRing, locateInDomain, planarDomain, ringsDomain, unionDomains,
} from "./domains.js";
import type { PlanarDomain, PlanarRegion, PlanarShape, Ring } from "./domains.js";
import { offsetDomain } from "./domains-offset.js";
import { clipPath } from "./domains-paths.js";
import { lexLess, orient } from "./planar-kernel.js";
import type { Point } from "./types.js";

/**
 * Correlated washes: the producer of Polygon Watercolor.
 *
 * INPUT. A parent shape (region, domain or plain region data; a `PlanarDomain` from this library is used as is) and
 * `WashOptions`. Every region of the parent is washed independently; a pass of a region is one `PlanarDomain`.
 *
 * MODEL (a geometric wash, not fluid simulation). The parent's outline is resampled at a fixed spacing (a third of the finest ripple's wavelength,
 * canonical per edge, so two regions that share an edge get identical points) and every sample is carried by a smooth
 * *vector displacement field of position*: octave `o` of `octaves` has wavelength `S / 2^o` with `S = swell * shortSide` (`shortSide` is the smaller
 * side of the parent's bounds, so the law is scale free), rms amplitude
 * `min(0.1 * variance * S * 2^(-H o), 0.3 * wavelength)` with `H = 1 - 0.8 * roughness`. A field is a function of
 * (x, y) only, never of ring, start vertex or vertex order, so it does not depend on how the parent was digitised and a
 * shared edge moves as one. Pass `k` samples `sqrt(1 - rho_o) * shared + sqrt(rho_o) * own_k` of two unit-variance fields
 * (`shared`: one per parent, `own_k`: one per pass), where `rho_o = independence * t_o` and `t_o` is 1 for `divergence:
 * "all"`, ramps 0 to 1 from the coarsest to the finest octave for "fine" (passes share their broad outline, differ in
 * the ragged detail) and 1 to 0 for "coarse". Hence two passes' displacements at one point have correlation exactly
 * `1 - rho_o` in each octave. Independence 0 makes every pass the same shape; 1 gives unrelated boundaries that still
 * hover about the parent.
 *
 * PASSES. `creep` grows (positive) or shrinks (negative) pass `k` by `creep * k` canvas units before the boundary is
 * displaced (an exact round-join offset; 0 skips it). With `patches`, pass `k` covers only a ragged elliptical patch of
 * the region (radius `size` times the region's half diagonal, centred between a stable point of the region and the
 * region's common `focus` point) instead of all of it: the boundary of the patch is displaced by the same law. Without
 * patches a pass is the displaced parent.
 *
 * VALIDITY POLICY. A displaced outline can fold. Each region's displaced rings (outer and holes, orientation kept) are
 * resolved by the exact `positive` fill rule (`ringsDomain`): reversed loops, i.e. kinks, paint nothing, outward ripples
 * stay. Every pass is therefore a valid `PlanarDomain` (simple rings, disjoint regions) whatever the settings; nothing
 * is ever accepted unchecked, and an empty pass (a patch off the region, a wash shrunk away) is a valid empty domain.
 *
 * RESERVES. With `holes: "reserved"` the parent's holes are unpainted: each pass's own hole outlines are displaced like
 * the outer one and the exact Boolean difference with the parent's holes (grown by `margin`) and with `reserve` (any
 * shape) is taken last, so *no pass ever intersects a reserve*. Hole edges thus retreat raggedly but never advance.
 * `holes: "open"` washes over the parent's counters (the parent is its outer rings).
 *
 * IDENTITY AND SEEDS. A pass has id `${region.id}/p${k}` (its domain has the same id, regions `${id}/${n}`). All
 * randomness is `componentSeed(seed, <scope>, <purpose>)`: scope `wash` when `coupling` is "one" or the parent has a single region (all regions
 * share one displacement field) or the region id when "separate"; own fields use `<scope>/p<k>`. Pass `k` therefore never depends
 * on the number of passes: adding passes only appends. Nothing about pigment, opacity or colour reaches a producer.
 *
 * OWNERSHIP AND CACHING. Results are deeply frozen and cached per region object and structural options (LRU of 6
 * option sets per region), so the same call returns the same objects and a pass count edit reuses earlier passes.
 *
 * UNITS AND LIMITS. Canvas units, except `swell` (a fraction of the parent's shorter side). `passes` 1 to 64; `octaves` 1 to 8 with the
 * finest wavelength at least 0.5 units; boundary vertices summed over passes
 * (`washWork`) at most `WASH_LIMITS.vertices`, checked before any pass exists; the kernel's own edge and work limits apply
 * to each Boolean. Violations throw an `Error` naming the control to change. Empty parents are valid (no passes).
 */
export const WASH_LIMITS = Object.freeze({
  passes: 64,
  /** Boundary samples, summed over every pass and region (including patch outlines). */
  vertices: 600_000,
  /** Smallest wavelength of the finest ripple, canvas units. */
  finestWavelength: 0.5,
  /** rms displacement of the broadest ripple at edge variance 1, as a fraction of its wavelength. */
  swellAmplitude: 0.1,
  /** rms displacement of any octave never exceeds this fraction of its own wavelength (ripples stay ripples until Roughness tears them). */
  ripple: 0.3,
});

export type WashDivergence = "all" | "fine" | "coarse";
export interface WashBoundary {
  /** Wavelength of the broadest ripple as a fraction of the parent's shorter side, (0, 4]. */
  readonly swell: number;
  /** Ripple scales, 1 to 8: octave `o` has half the wavelength of octave `o - 1`. The outline is sampled three times per finest wavelength. */
  readonly octaves: number;
  /** 0 smooth swells to 1 torn: how strongly fine ripples keep up with broad ones. */
  readonly roughness: number;
  /** 0 to 1: rms displacement of the broadest ripple as a fraction of `WASH_LIMITS.swellAmplitude * swell wavelength`. */
  readonly variance: number;
  /** 0 every pass shares one boundary, 1 every pass has its own. */
  readonly independence: number;
  readonly divergence: WashDivergence;
}
export interface WashPatches {
  /** Patch radius as a fraction of the region's half diagonal, (0, 3]. */
  readonly size: number;
  /** 0 patches land anywhere in the region, 1 all are centred on one common point. */
  readonly focus: number;
}
export interface WashOptions {
  readonly seed: number;
  readonly passes: number;
  readonly boundary: WashBoundary;
  /** Signed canvas units of offset per pass index (pass `k` is offset by `creep * k`); 0 for none. */
  readonly creep: number;
  /** null: every pass covers the whole region. */
  readonly patches: WashPatches | null;
  /** "one": all regions share one displacement field (shared edges stay together); "separate": each region its own. */
  readonly coupling: "one" | "separate";
  /** "reserved": the parent's holes stay unpainted. "open": they are washed over. */
  readonly holes: "reserved" | "open";
  /** Extra clearance around reserved holes and `reserve`, canvas units, at least 0. */
  readonly margin: number;
  /** Any further shape that must stay unpainted (for example type). */
  readonly reserve?: PlanarShape | null;
}

/** A boundary polyline of a pass that is paper-facing: a closed ring, or an open piece of one. */
export interface WashEdge { readonly points: readonly Point[]; readonly closed: boolean }
export interface WashPass {
  readonly id: string;
  /** Id of the parent region this pass washes. */
  readonly region: string;
  readonly index: number;
  readonly domain: PlanarDomain;
  /** What this pass must never paint (the region's reserved holes grown by the margin, and `reserve`), or null. `domain` never intersects it. */
  readonly reserved: PlanarDomain | null;
  /** The boundary rings of `domain` without the stretches that lie on `reserved` (those are a mask edge, not a wash edge). */
  readonly edges: readonly WashEdge[];
  /** One closed ring per region of `domain` for a single fill call: holes joined to the outer ring by zero-width cuts (`keyholeRing`). Fill it, never stroke it. */
  readonly fills: readonly Ring[];
}
export interface WashPasses {
  readonly id: string;
  readonly parent: PlanarDomain;
  /** Pass-major: pass 0 of every region, then pass 1, ... */
  readonly passes: readonly WashPass[];
  /** Boundary samples spent (see `washWork`). */
  readonly work: number;
}

const U32 = 0x1_0000_0000;
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
/** Standard deviation of `gradientNoise2D01` samples (measured over 200,000 points; the mean is 0.5). */
const NOISE_SD = 0.1334;
const TAU = 2 * Math.PI;

function fail(label: string, requirement: string, value: unknown): never {
  throw new Error(`${label} must be ${requirement} (got ${String(value)})`);
}
const inRange = (label: string, value: number, min: number, max: number) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) fail(label, `a number in [${min}, ${max}]`, value);
};

/** Validate options; the error names the control. Returns nothing. */
export function checkWashOptions(options: WashOptions): void {
  const { seed, passes, boundary: b, patches, creep, margin } = options;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) fail("Seed", "a uint32 integer", seed);
  if (!Number.isInteger(passes) || passes < 1 || passes > WASH_LIMITS.passes) fail("Passes", `an integer in [1, ${WASH_LIMITS.passes}]`, passes);
  inRange("Swell", b.swell, 0.005, 4);
  if (!Number.isInteger(b.octaves) || b.octaves < 1 || b.octaves > 8) fail("Detail", "an integer number of ripple scales in [1, 8]", b.octaves);
  inRange("Roughness", b.roughness, 0, 1); inRange("Edge variance", b.variance, 0, 1); inRange("Independence", b.independence, 0, 1);
  if (b.divergence !== "all" && b.divergence !== "fine" && b.divergence !== "coarse") fail("Divergence", `"all", "fine" or "coarse"`, b.divergence);
  inRange("Pass creep", creep, -1000, 1000); inRange("Reserve margin", margin, 0, 1000);
  if (patches) { inRange("Patch size", patches.size, 0.02, 3); inRange("Patch focus", patches.focus, 0, 1); }
  if (options.coupling !== "one" && options.coupling !== "separate") fail("Coupling", `"one" or "separate"`, options.coupling);
  if (options.holes !== "reserved" && options.holes !== "open") fail("Holes", `"reserved" or "open"`, options.holes);
}

// --- The displacement law ------------------------------------------------------------------------------------------
export interface WashLaw { readonly octaves: number; readonly wavelength: Float64Array; readonly amplitude: Float64Array; readonly shared: Float64Array; readonly own: Float64Array }
const lawCache = new Map<string, WashLaw>();
/** Octave wavelengths, rms amplitudes and the shared / own weights for a boundary. */
export function washLaw(b: WashBoundary, side: number): WashLaw {
  const key = JSON.stringify([b, side]), hit = lawCache.get(key);
  if (hit) return hit;
  const octaves = b.octaves, swell = b.swell * side;
  const wavelength = new Float64Array(octaves), amplitude = new Float64Array(octaves), shared = new Float64Array(octaves), own = new Float64Array(octaves);
  const decay = 2 ** -(1 - 0.8 * b.roughness);
  for (let o = 0; o < octaves; o++) {
    wavelength[o] = swell / 2 ** o;
    amplitude[o] = Math.min(WASH_LIMITS.swellAmplitude * b.variance * swell * decay ** o, WASH_LIMITS.ripple * wavelength[o]);
    const t = octaves === 1 ? 1 : b.divergence === "all" ? 1 : b.divergence === "fine" ? o / (octaves - 1) : 1 - o / (octaves - 1);
    const rho = b.independence * t;
    shared[o] = Math.sqrt(1 - rho); own[o] = Math.sqrt(rho);
  }
  const law = Object.freeze({ octaves, wavelength, amplitude, shared, own });
  if (lawCache.size > 64) lawCache.delete(lawCache.keys().next().value!);
  lawCache.set(key, law);
  return law;
}

/** What the wash reads of a noise generator. */
interface NoiseField { sample(x: number, y: number): number }
const generators = new Map<number, NoiseField>();
function generator(seed: number): NoiseField {
  let g = generators.get(seed);
  if (!g) {
    g = gradientNoise2D01({ seed });
    if (generators.size > 4096) generators.delete(generators.keys().next().value!);
    generators.set(seed, g);
  }
  return g;
}

/** The two unit-variance vector fields (shared, own) of one pass, octave by octave. */
interface Field { readonly law: WashLaw; readonly sx: NoiseField[]; readonly sy: NoiseField[]; readonly ox: NoiseField[]; readonly oy: NoiseField[] }
function fieldFor(seed: number, scope: string, pass: number, b: WashBoundary, side: number): Field {
  const law = washLaw(b, side), sx: NoiseField[] = [], sy: NoiseField[] = [], ox: NoiseField[] = [], oy: NoiseField[] = [];
  for (let o = 0; o < law.octaves; o++) {
    const active = law.amplitude[o] > 0;
    sx.push(generator(active && law.shared[o] > 0 ? componentSeed(seed, scope, `shared:o${o}:x`) : 0));
    sy.push(generator(active && law.shared[o] > 0 ? componentSeed(seed, scope, `shared:o${o}:y`) : 0));
    ox.push(generator(active && law.own[o] > 0 ? componentSeed(seed, `${scope}/p${pass}`, `own:o${o}:x`) : 0));
    oy.push(generator(active && law.own[o] > 0 ? componentSeed(seed, `${scope}/p${pass}`, `own:o${o}:y`) : 0));
  }
  return { law, sx, sy, ox, oy };
}
function offsetAt(field: Field, x: number, y: number, out: [number, number]): void {
  const { law } = field;
  let dx = 0, dy = 0;
  for (let o = 0; o < law.octaves; o++) {
    const a = law.amplitude[o];
    if (a === 0) continue;
    const u = x / law.wavelength[o], v = y / law.wavelength[o], ws = law.shared[o], wi = law.own[o];
    let fx = 0, fy = 0;
    if (ws > 0) { fx += ws * (field.sx[o].sample(u, v) - 0.5); fy += ws * (field.sy[o].sample(u, v) - 0.5); }
    if (wi > 0) { fx += wi * (field.ox[o].sample(u, v) - 0.5); fy += wi * (field.oy[o].sample(u, v) - 0.5); }
    dx += a * fx / NOISE_SD; dy += a * fy / NOISE_SD;
  }
  out[0] = dx; out[1] = dy;
}
/**
 * The displacement vector pass `pass` applies at (x, y): `scope` is `"wash"` for coupled regions or a region id. This is
 * the whole law; the passes are the parent's outline carried through it.
 */
export function washOffset(seed: number, scope: string, pass: number, boundary: WashBoundary, side: number, x: number, y: number): readonly [number, number] {
  const out: [number, number] = [0, 0];
  offsetAt(fieldFor(seed, scope, pass, boundary, side), x, y, out);
  return out;
}

// --- Outline sampling ----------------------------------------------------------------------------------------------
/** Sample spacing: a third of the finest ripple's wavelength. */
const stepOf = (b: WashBoundary, side: number) => b.swell * side / 2 ** (b.octaves - 1) / 3;
/** The smaller side of the parent's bounds: the unit `swell` is a fraction of. */
export const washSide = (parent: PlanarDomain): number => parent.bounds ? Math.min(parent.bounds[2] - parent.bounds[0], parent.bounds[3] - parent.bounds[1]) : 0;

/** Sample a ring every at most `step` units. Edge samples are canonical (measured from the lexicographically smaller end), so a shared edge yields identical points from either side. */
function resampleRing(ring: readonly Point[], step: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    const forward = lexLess(a[0], a[1], b[0], b[1]);
    const p = forward ? a : b, q = forward ? b : a;
    for (let j = 0; j < m; j++) {
      const t = forward ? j : m - j;
      out.push(t === 0 ? p : t === m ? q : [p[0] + (q[0] - p[0]) * t / m, p[1] + (q[1] - p[1]) * t / m]);
    }
  }
  return out;
}
const ringLength = (ring: readonly Point[]): number => {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; sum += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return sum;
};
const samplesOf = (ring: readonly Point[], step: number): number => {
  let count = 0;
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; count += Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); }
  return count;
};

/** Insert every other ring's vertex that lies exactly on an edge (T-junctions), so neighbouring regions sample a shared boundary identically. */
function splitTouching(rings: readonly (readonly Point[])[]): Point[][] {
  const all: Point[] = [];
  for (const ring of rings) for (const p of ring) all.push(p);
  all.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const xs = all.map((p) => p[0]);
  const lower = (x: number) => { let lo = 0, hi = xs.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (xs[mid] < x) lo = mid + 1; else hi = mid; } return lo; };
  return rings.map((ring) => {
    const out: Point[] = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      out.push(a);
      const minX = Math.min(a[0], b[0]), maxX = Math.max(a[0], b[0]), minY = Math.min(a[1], b[1]), maxY = Math.max(a[1], b[1]);
      const found: Point[] = [];
      for (let j = lower(minX); j < all.length && all[j][0] <= maxX; j++) {
        const p = all[j];
        if (p[1] < minY || p[1] > maxY || (p[0] === a[0] && p[1] === a[1]) || (p[0] === b[0] && p[1] === b[1])) continue;
        if (orient(a[0], a[1], b[0], b[1], p[0], p[1]) === 0 && (found.length === 0 || found[found.length - 1] !== p)) found.push(p);
      }
      if (found.length === 0) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      found.sort((p, q) => ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) - ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy));
      let last: Point = a;
      for (const p of found) if (p[0] !== last[0] || p[1] !== last[1]) { out.push(p); last = p; }
    }
    return out;
  });
}

const objectIds = new WeakMap<object, number>();
let nextObjectId = 1;
const tagOf = (value: object): number => { let id = objectIds.get(value); if (!id) objectIds.set(value, id = nextObjectId++); return id; };

const parentOf = new WeakMap<object, PlanarDomain>();
/** The parent as a domain; a value from this library is used as is (identity is the cache key). */
export function washParent(parent: PlanarShape): PlanarDomain {
  if (typeof parent !== "object" || parent === null) throw new Error("Parent must be a region, a domain or region data");
  let domain = parentOf.get(parent);
  if (!domain) { domain = planarDomain(parent, { id: "wash" }); parentOf.set(parent, domain); parentOf.set(domain, domain); }
  return domain;
}

/** Outer rings, and holes when reserved-or-not decides them, resampled once per domain and detail. */
const ringCache = new WeakMap<PlanarDomain, Map<string, ReadonlyMap<string, readonly (readonly Point[])[]>>>();
function outlines(parent: PlanarDomain, step: number, withHoles: boolean): ReadonlyMap<string, readonly (readonly Point[])[]> {
  let byKey = ringCache.get(parent);
  if (!byKey) ringCache.set(parent, byKey = new Map());
  const key = `${step}|${withHoles}`, hit = byKey.get(key);
  if (hit) return hit;
  const rings: Ring[] = [], owner: string[] = [];
  for (const region of parent.regions) for (const ring of [region.outer, ...(withHoles ? region.holes : [])]) { rings.push(ring); owner.push(region.id); }
  const split = parent.regions.length > 1 ? splitTouching(rings) : (rings as readonly (readonly Point[])[]);
  const map = new Map<string, Point[][]>();
  split.forEach((ring, i) => { const list = map.get(owner[i]) ?? []; list.push(resampleRing(ring, step)); map.set(owner[i], list); });
  byKey.size >= 4 && byKey.delete(byKey.keys().next().value!);
  byKey.set(key, map);
  return map;
}

/** Boundary samples one pass of every region needs: outlines at the sample spacing, plus each patch's outline. */
export function washWork(parent: PlanarShape, options: WashOptions): number {
  const domain = washParent(parent), step = stepOf(options.boundary, washSide(domain));
  let per = 0;
  for (const region of domain.regions) {
    for (const ring of [region.outer, ...(options.holes === "reserved" ? region.holes : [])]) per += samplesOf(ring, step);
    if (options.patches) {
      const [l, t, r, b] = region.bounds, radius = options.patches.size * Math.hypot(r - l, b - t) / 2;
      per += Math.ceil(TAU * radius * 1.3 / step);
    }
  }
  return per * options.passes;
}

// --- One pass ------------------------------------------------------------------------------------------------------
function displaceRing(ring: readonly Point[], field: Field): Point[] {
  const out: Point[] = new Array(ring.length), delta: [number, number] = [0, 0];
  for (let i = 0; i < ring.length; i++) { offsetAt(field, ring[i][0], ring[i][1], delta); out[i] = [ring[i][0] + delta[0], ring[i][1] + delta[1]]; }
  return out;
}

/** A stable point of the region for `purpose` (rejection sampling in its bounds; the last candidate if none is inside). */
function pointIn(region: PlanarRegion, seed: number, id: string, purpose: string): Point {
  const [l, t, r, b] = region.bounds;
  let x = l, y = t;
  for (let attempt = 0; attempt < 32; attempt++) {
    x = l + unit(seed, id, `${purpose}:${attempt}:x`) * (r - l); y = t + unit(seed, id, `${purpose}:${attempt}:y`) * (b - t);
    if (locateInDomain(region, x, y) === "inside") break;
  }
  return [x, y];
}

const PATCH_SIDES = 32;
/** The (undisplaced) elliptical patch of pass `k`. */
export function washPatch(region: PlanarRegion, pass: number, seed: number, patches: WashPatches): Ring {
  const id = `${region.id}/p${pass}`, [l, t, r, b] = region.bounds;
  const focus = pointIn(region, seed, region.id, "focus"), site = pointIn(region, seed, id, "site");
  const cx = focus[0] + (site[0] - focus[0]) * (1 - patches.focus), cy = focus[1] + (site[1] - focus[1]) * (1 - patches.focus);
  const radius = patches.size * Math.hypot(r - l, b - t) / 2 * (0.75 + 0.5 * unit(seed, id, "patch:radius"));
  const aspect = 0.6 + 0.4 * unit(seed, id, "patch:aspect"), angle = TAU * unit(seed, id, "patch:angle");
  const c = Math.cos(angle), s = Math.sin(angle), ring: Point[] = [];
  for (let i = 0; i < PATCH_SIDES; i++) {
    const a = TAU * i / PATCH_SIDES, px = radius * Math.cos(a), py = radius * aspect * Math.sin(a);
    ring.push(Object.freeze([cx + px * c - py * s, cy + px * s + py * c] as const));
  }
  return Object.freeze(ring);
}

interface Context {
  readonly options: WashOptions; readonly parent: PlanarDomain; readonly key: string; readonly side: number;
  readonly reserve: PlanarDomain | null;
  readonly reserved: Map<PlanarRegion, PlanarDomain | null>;
}
const reserveCache = new WeakMap<PlanarRegion, Map<string, PlanarDomain | null>>();
/** Everything the region's passes must not touch: its holes grown by margin, and the extra reserve. */
function reservedFor(region: PlanarRegion, ctx: Context): PlanarDomain | null {
  if (ctx.reserved.has(region)) return ctx.reserved.get(region)!;
  const built = buildReserved(region, ctx);
  ctx.reserved.set(region, built);
  return built;
}
function buildReserved(region: PlanarRegion, ctx: Context): PlanarDomain | null {
  const { options } = ctx;
  const parts: PlanarDomain[] = [];
  if (options.holes === "reserved" && region.holes.length > 0) {
    const holes = planarDomain(region.holes.map((ring, k) => ({ id: `${region.id}/h${k}`, outer: [...ring].reverse() as [number, number][] })), { id: `${region.id}/holes` });
    parts.push(options.margin > 0 ? offsetDomain(holes, options.margin, { id: `${region.id}/holes+${options.margin}` }) : holes);
  }
  if (ctx.reserve && ctx.reserve.regions.length > 0) {
    const [l, t, r, b] = region.bounds, m = options.margin;
    const near = ctx.reserve.regions.filter((q) => q.bounds[0] <= r + m && q.bounds[2] >= l - m && q.bounds[1] <= b + m && q.bounds[3] >= t - m);
    if (near.length > 0) {
      const d = planarDomain(near, { id: "reserve" });
      parts.push(m > 0 ? offsetDomain(d, m, { id: `reserve+${m}` }) : d);
    }
  }
  return parts.length === 0 ? null : parts.length === 1 ? parts[0] : unionDomains(parts, { id: `${region.id}/reserved` });
}

/** The raw displaced outline of pass `k` of a region (before the fold policy) and its displaced patch outline, or null. */
export interface WashOutline { readonly rings: readonly (readonly Point[])[]; readonly patch: readonly Point[] | null }
function displacedOutline(region: PlanarRegion, k: number, ctx: Context, run?: { check(): void }): WashOutline {
  const { options } = ctx, id = `${region.id}/p${k}`, step = stepOf(options.boundary, ctx.side);
  const field = fieldFor(options.seed, options.coupling === "one" || ctx.parent.regions.length === 1 ? "wash" : region.id, k, options.boundary, ctx.side);
  let rings: readonly (readonly Point[])[];
  if (options.creep === 0) rings = outlines(ctx.parent, step, options.holes === "reserved").get(region.id)!;
  else {
    const grown = offsetDomain(options.holes === "reserved" ? region : planarDomain({ id: region.id, outer: region.outer }), options.creep * k,
      { id: `${id}/offset`, ...(run ? { run } : {}) });
    rings = grown.regions.flatMap((q) => [q.outer, ...q.holes]).map((ring) => resampleRing(ring, step));
  }
  return { rings: rings.map((ring) => displaceRing(ring, field)),
    patch: options.patches ? displaceRing(resampleRing(washPatch(region, k, options.seed, options.patches), step), field) : null };
}
/** The pre-repair displaced outline of pass `pass` of region `regionId`: what the fold policy is applied to. Not cached. */
export function washOutline(parent: PlanarShape, options: WashOptions, regionId: string, pass: number): WashOutline {
  const { domain, ctx } = plan(parent, options);
  const region = domain.regions.find((q) => q.id === regionId);
  if (!region) throw new Error(`No region ${JSON.stringify(regionId)} in the parent`);
  if (!Number.isInteger(pass) || pass < 0 || pass >= options.passes) throw new Error(`Pass must be an integer in [0, ${options.passes - 1}]`);
  return displacedOutline(region, pass, ctx);
}

const passCache = new WeakMap<PlanarRegion, Map<string, Map<number, WashPass>>>();
function washPass(region: PlanarRegion, k: number, ctx: Context, run?: { check(): void }): WashPass {
  let byKey = passCache.get(region);
  if (!byKey) passCache.set(region, byKey = new Map());
  let passes = byKey.get(ctx.key);
  if (passes) { byKey.delete(ctx.key); byKey.set(ctx.key, passes); }
  else {
    passes = new Map(); byKey.set(ctx.key, passes);
    if (byKey.size > 6) byKey.delete(byKey.keys().next().value!);
  }
  const cached = passes.get(k);
  if (cached) return cached;
  run?.check();
  const { options } = ctx, id = `${region.id}/p${k}`;
  const { rings, patch } = displacedOutline(region, k, ctx, run);
  let domain = ringsDomain(rings, { fill: "positive", id, ...(run ? { run } : {}) });
  if (patch && domain.regions.length > 0)
    domain = domainIntersection(domain, ringsDomain([patch], { fill: "positive", id: `${id}/patch` }), { id, ...(run ? { run } : {}) });
  const reserved = reservedFor(region, ctx);
  if (reserved && domain.regions.length > 0) domain = domainDifference(domain, reserved, { id, ...(run ? { run } : {}) });
  if (domain.regions.length === 0 && domain.id !== id) domain = emptyDomain(id);
  const edges = domain.regions.flatMap((q) => [q.outer, ...q.holes]).flatMap((ring): WashEdge[] => reserved
    ? clipPath(ring, reserved, { closed: true, keep: "outside" }).map((piece) => Object.freeze({ points: piece.points, closed: piece.closed }))
    : [Object.freeze({ points: ring, closed: true })]);
  const pass: WashPass = Object.freeze({ id, region: region.id, index: k, domain, reserved, edges: Object.freeze(edges), fills: Object.freeze(domain.regions.map(keyholeRing)) });
  passes.set(k, pass);
  return pass;
}

const contexts = new WeakMap<PlanarDomain, Map<string, Context>>();
function contextFor(parent: PlanarDomain, options: WashOptions): Context {
  const reserve = options.reserve ? washParent(options.reserve) : null;
  const key = JSON.stringify([options.seed, options.boundary, options.creep, options.patches, options.coupling, options.holes, options.margin, reserve ? tagOf(reserve) : 0]);
  let byKey = contexts.get(parent);
  if (!byKey) contexts.set(parent, byKey = new Map());
  let ctx = byKey.get(key);
  if (!ctx) { ctx = { options, parent, key, reserve, side: washSide(parent), reserved: new Map() }; byKey.size >= 6 && byKey.delete(byKey.keys().next().value!); byKey.set(key, ctx); }
  return ctx;
}

/** Work plan shared by `washPasses` and `prepareWash`: validation, the work bound, and the context. */
function plan(parent: PlanarShape, options: WashOptions) {
  checkWashOptions(options);
  const domain = washParent(parent), side = washSide(domain), finest = options.boundary.swell * side / 2 ** (options.boundary.octaves - 1);
  if (domain.regions.length > 0 && finest < WASH_LIMITS.finestWavelength)
    throw new Error(`The finest ripple would be ${finest.toPrecision(3)} units wide, below ${WASH_LIMITS.finestWavelength}; raise Swell or lower Detail`);
  const work = washWork(domain, options);
  if (work > WASH_LIMITS.vertices)
    throw new Error(`The wash needs ${work} boundary samples (passes × outline length ÷ a third of the finest ripple), more than the limit of ${WASH_LIMITS.vertices}; lower Detail or Passes, lower Patch size, raise Swell, or wash a smaller shape`);
  return { domain, work, ctx: contextFor(domain, options) };
}

const resultCache = new WeakMap<Context, Map<number, WashPasses>>();
/** All passes of every region of the parent (see the header). Cached: the same construction returns the same object. */
export function washPasses(parent: PlanarShape, options: WashOptions, run?: { check(): void }): WashPasses {
  const { domain, work, ctx } = plan(parent, options);
  let byCount = resultCache.get(ctx);
  if (!byCount) resultCache.set(ctx, byCount = new Map());
  const hit = byCount.get(options.passes);
  if (hit) return hit;
  const passes: WashPass[] = [];
  for (let k = 0; k < options.passes; k++) for (const region of domain.regions) passes.push(washPass(region, k, ctx, run));
  const result: WashPasses = Object.freeze({ id: domain.id, parent: domain, passes: Object.freeze(passes), work });
  byCount.set(options.passes, result);
  return result;
}

/** Number of passes `washPasses` would return for these options (regions × passes). */
export const washPassCount = (parent: PlanarShape, options: WashOptions): number => washParent(parent).regions.length * options.passes;

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
/** Build every pass, yielding to the host between slices; false when the caller cancelled. */
export async function prepareWashPasses(parent: PlanarShape, options: WashOptions, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const { domain, ctx } = plan(parent, options);
  let slice = performance.now();
  try {
    for (let k = 0; k < options.passes; k++) for (const region of domain.regions) {
      washPass(region, k, ctx, { check() { if (cancelled()) throw new Error("Preparation cancelled"); } });
      if (performance.now() - slice > 12) { await yieldToHost(); if (cancelled()) return false; slice = performance.now(); }
    }
  } catch (error) {
    if (cancelled()) return false;
    throw error;
  }
  return !cancelled();
}
