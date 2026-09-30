import { cachedBy, componentSeed } from "./core.js";
import { locateInDomain } from "./domains.js";
import type { PlanarDomain } from "./domains.js";
import { offsetDomain } from "./domains-offset.js";
import { clipPath, hatchDomain } from "./domains-paths.js";
import { fieldKey, stitchField } from "./stitch-field.js";
import type { StitchField, StitchFieldSpec } from "./stitch-field.js";
import type { StitchRegion } from "./stitch-regions.js";
import { boundStitches, distinctPoints, polylineLength, routeRuns, runningStitches, samplePolyline, spanStitches } from "./stitch-route.js";
import type { Chain, Pt, Run } from "./stitch-route.js";
import { traceStreamlines } from "./streamlines.js";
import type { Streamline } from "./streamlines.js";
import type { Path } from "./types.js";

/**
 * Region stitch fills: a set of labelled planar regions and a direction field become ORDERED STITCH PATHS (threads), with the
 * fill and routing rules stated here. This is not a machine-embroidery export: no pull compensation, density units, thread
 * physics, trims, colour changes or file format are modelled; the numbers are canvas geometry.
 *
 * Vocabulary. A stitch is a straight segment between two needle penetrations; a THREAD is a polyline of penetrations
 * (`StitchThread.points`), one continuous run of thread. Every stitch of every thread has length <= `fill.length` (the DECLARED
 * BOUND, in canvas units) including connectors, outlines and travel. The tests check this to 1e-9.
 *
 * Per region, in this order (a thread's `role`):
 * 1. `region inset`. The fill domain is `offsetDomain(region, -inset)` (round joins; holes grow, so they stay open, and a
 *    region narrower than `2 * inset` vanishes). Everything below is confined to it (closed set: the boundary is inside).
 * 2. `underlay` (`edge`, `cross`, `both`): `edge` runs along every ring of the fill domain inset by a further `underlay.inset`;
 *    `cross` lays running rows of spacing `underlay.spacing` at 90 degrees to the fill direction inside that same inset domain.
 *    Underlay is drawn first, so the fill crosses it (an intentional thread crossing).
 * 3. `fill`, by rule (`mixed` picks the rule per region from `componentSeed(seed, region.id, "rule")`):
 *    - `running`: rows of spacing `fill.spacing` along the field, cut into stitches of exactly `fill.length` (the first and last
 *      are the remainders). Each row's penetrations start `stagger * u` of a stitch in, `u = componentSeed(seed, row id,
 *      "phase") / 2^32`: 0 lines every penetration up across rows, 1 scatters them.
 *    - `satin`: the same rows, but each row piece is ONE stitch across the shape, divided into equal parts only when it is longer
 *      than the bound.
 *    - `seed`: short stitches scattered over the region (moss). One candidate per cell of a `spacing` grid anchored at `origin`
 *      (position jittered by +-0.425 cell, by id), kept when inside the fill domain; the stitch is centred on it, lies along the
 *      field turned by `scatter * pi * (u - 1/2)` (scatter 0: all along the field; 1: any direction), has length
 *      `length * (1/2 + u/2)` and is clipped to the fill domain (a clipped stitch shorter than a quarter of its length is dropped).
 * 4. `crossing` (`over`): a second, running layer over the fill at `angle` degrees from the fill direction with spacing
 *    `crossing.spacing`. It is drawn after the fill, so it visibly crosses it.
 * 5. `outline` (`running` or `satin`): each ring of the fill domain, starting at the SEAM and closing on it. `running` places a
 *    penetration at every vertex and cuts longer edges equally; `satin` is a zigzag band `width` wide inside the boundary
 *    (stitches across the band every `fill.spacing` along it), clipped to the fill domain. `lap` continues the thread that far
 *    past the seam, overlapping its own start.
 *
 * The SEAM is a direction in degrees (0 = +x, positive clockwise on screen). For a ring it names the ring's SUPPORT vertex: the
 * vertex maximising `(v - c) . (cos, sin)` where `c` is the centre of the ring's bounding box (ties: the first vertex), so it is
 * the extreme point of the ring in that direction. It is where outlines and edge underlay begin and end, and (for the
 * domain as a whole) where the region's routing starts.
 *
 * ROWS. With a constant field the rows are the foundation's exact hatch (`hatchDomain`, anchored at `origin`, so neighbouring
 * regions' rows align). Otherwise rows are evenly spaced streamlines of the field (`traceStreamlines`, Jobard-Lefer, separation
 * `spacing`, crowding stop 0.8, starts on a lattice of 4 spacings anchored at `origin`, ids `row:<i>:<j>`), traced ONCE per
 * distinct (field, turn, bounds, spacing) over the padded bounds of the fill domain and clipped to it (`clipPath`, holes
 * respected). A per-region turn (`angleSpread`) gives each region its own field, so it traces per region. Curved rows are cut
 * into stitches along their arc length (chords are shorter than arcs), then the stitched polyline is clipped once more so a
 * chord that cuts a corner of the boundary can never enter a hole or leave the region. Spacing between neighbouring streamlines
 * is at least 0.8 * spacing (the crowding stop) and, where lines diverge, up to about 2 * spacing (measured in the tests).
 *
 * ROUTING. Within a region every row piece is a candidate; `routeRuns` visits them greedily by nearest endpoint starting at the
 * seam. Two consecutive pieces continue ONE thread when the connecting stitch is at most `fill.length` long and lies inside the
 * fill domain (exact predicates); otherwise the thread ENDS (a trim; no stitch is made across the gap, so holes and gaps
 * between regions get no thread). Seed stitches are always separate threads. Regions are visited in label order or, with
 * `routing.order = "nearest"`, greedily by nearest start from the previous region's last point. With `routing.travel` every gap
 * between consecutive threads gets a visible TRAVEL thread (a straight thread cut equally to the bound); the default is none.
 *
 * IDS, SEEDS, OWNERSHIP. Threads are `<region id>/<tag>:<n>` (tags `ue` edge underlay, `uc` cross underlay, `f` fill, `c` crossing,
 * `o` outline; n counts that tag in routing order) and `travel:<n>`. Seeds are `componentSeed(seed, id, "thread")`. Ids depend on
 * construction only, never on colour, weight or material. Results are deeply frozen and cached (identity of the regions array,
 * then the construction) so a drawing edit reuses them; the seed enters the key only where it is read (a constant field with no
 * stagger, spread, seed stitches or mixed rule ignores it).
 *
 * WORK BOUNDS (throw naming the control; nothing is thinned): at most {@link STITCH_LIMITS.stitches} stitches, {@link STITCH_LIMITS.threads}
 * threads, {@link STITCH_LIMITS.rows} rows, {@link STITCH_LIMITS.steps} streamline steps and {@link STITCH_LIMITS.cells} seed cells
 * per construction. Empty results (no region survives the inset) are valid.
 */
export type FillRule = "running" | "satin" | "seed";
export type FillChoice = FillRule | "mixed";
export type UnderlayKind = "none" | "edge" | "cross" | "both";
export type OutlineKind = "none" | "running" | "satin";
export type CrossingKind = "none" | "over";
export type RegionOrder = "label" | "nearest";
export type ThreadRole = "underlay" | "fill" | "crossing" | "outline" | "travel";

export const fillChoices: readonly FillChoice[] = Object.freeze(["running", "satin", "seed", "mixed"] as const);
export const underlayKinds: readonly UnderlayKind[] = Object.freeze(["none", "edge", "cross", "both"] as const);
export const outlineKinds: readonly OutlineKind[] = Object.freeze(["none", "running", "satin"] as const);
export const crossingKinds: readonly CrossingKind[] = Object.freeze(["none", "over"] as const);
export const regionOrders: readonly RegionOrder[] = Object.freeze(["label", "nearest"] as const);

export const STITCH_LIMITS = Object.freeze({ stitches: 300_000, threads: 150_000, rows: 60_000, steps: 1_500_000, cells: 200_000 });

export interface StitchOptions {
  seed: number;
  regions: readonly StitchRegion[];
  field: StitchFieldSpec;
  /** The canvas point row families and seed grids are measured from. */
  origin: readonly [number, number];
  fill: {
    rule: FillChoice;
    /** Row spacing (running, satin) or seed grid cell (seed), canvas units. */
    spacing: number;
    /** The declared bound on every stitch, canvas units. */
    length: number;
    /** 0..1: running penetration offset between rows. */
    stagger: number;
    /** 0..1: seed stitch direction scatter about the field. */
    scatter: number;
    /** Degrees: each region's field is turned by a seeded amount in [-spread, spread]. */
    angleSpread: number;
    /** Region inset, canvas units. */
    inset: number;
  };
  underlay: { kind: UnderlayKind; spacing: number; inset: number };
  crossing: { kind: CrossingKind; angle: number; spacing: number };
  outline: { kind: OutlineKind; width: number; lap: number };
  /** Degrees, 0 = +x, positive clockwise on screen. */
  seam: number;
  routing: { order: RegionOrder; travel: boolean };
}

/** One continuous run of thread: a `Path` plus what it is and where it sits in the stitching order. */
export interface StitchThread extends Path {
  /** Region id, or the destination region's id for a travel thread. */
  readonly region: string;
  readonly role: ThreadRole;
  /** The fill rule that made a `fill` thread, else null. */
  readonly rule: FillRule | null;
  /** Position in the whole stitching order, from 0. */
  readonly order: number;
  /** `points.length - 1`. */
  readonly stitches: number;
  /** Total thread length, canvas units. */
  readonly length: number;
  /** Stitch index at which each row begins (fill and crossing rows; `[0]` for a ring or a seed stitch). */
  readonly rowStarts: readonly number[];
  /** Ordinal of the thread's first row within its region's role (for row colour rules). */
  readonly firstRow: number;
}

export interface StitchRegionInfo {
  readonly id: string;
  readonly index: number;
  readonly label: string;
  readonly tone: number;
  readonly rule: FillRule;
  /** Degrees the region's field was turned by `angleSpread`. */
  readonly turn: number;
  readonly area: number;
  readonly fillArea: number;
  readonly threads: number;
  readonly stitches: number;
}

export interface StitchStats {
  readonly threads: number;
  readonly stitches: number;
  readonly length: number;
  readonly longest: number;
  readonly travelThreads: number;
  /** Trims: gaps between consecutive non-travel threads of a region that were not stitched. */
  readonly trims: number;
  readonly emptyRegions: number;
}

export interface StitchProducts {
  readonly regions: readonly StitchRegionInfo[];
  readonly threads: readonly StitchThread[];
  readonly stats: StitchStats;
}

const U32 = 0x1_0000_0000;
const RADIANS = Math.PI / 180;
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
const halfTurn = (a: number): number => { const r = a - Math.PI * Math.floor(a / Math.PI); return r >= Math.PI ? 0 : r; };

function check(name: string, v: number, lo: number, hi: number): void {
  if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) throw new Error(`${name} must be a number in [${lo}, ${hi}]`);
}

function validate(o: StitchOptions): void {
  if (!Number.isSafeInteger(o.seed) || o.seed < 0 || o.seed > 0xffffffff) throw new Error("Stitch seed must be a uint32 integer");
  if (!Array.isArray(o.regions)) throw new Error("Stitch regions must be an array of StitchRegion");
  if (o.regions.length > 512) throw new Error(`There are ${o.regions.length} regions; the limit is 512. Use fewer regions`);
  check("Origin X", o.origin[0], -1e6, 1e6); check("Origin Y", o.origin[1], -1e6, 1e6);
  const f = o.fill;
  if (!fillChoices.includes(f.rule)) throw new Error(`Fill must be one of ${fillChoices.join(", ")}`);
  check("Row spacing", f.spacing, 0.8, 200); check("Stitch length", f.length, 1, 200);
  check("Stagger", f.stagger, 0, 1); check("Scatter", f.scatter, 0, 1); check("Angle spread", f.angleSpread, 0, 360); check("Region inset", f.inset, 0, 1000);
  if (!underlayKinds.includes(o.underlay.kind)) throw new Error(`Underlay must be one of ${underlayKinds.join(", ")}`);
  check("Underlay spacing", o.underlay.spacing, 0.8, 200); check("Underlay inset", o.underlay.inset, 0, 1000);
  if (!crossingKinds.includes(o.crossing.kind)) throw new Error(`Crossing must be one of ${crossingKinds.join(", ")}`);
  check("Crossing angle", o.crossing.angle, -3600, 3600); check("Crossing spacing", o.crossing.spacing, 0.8, 200);
  if (!outlineKinds.includes(o.outline.kind)) throw new Error(`Outline must be one of ${outlineKinds.join(", ")}`);
  check("Outline width", o.outline.width, 0.2, 200); check("Lap", o.outline.lap, 0, 1000);
  check("Seam", o.seam, -3600, 3600);
  if (!regionOrders.includes(o.routing.order)) throw new Error(`Region order must be one of ${regionOrders.join(", ")}`);
  if (typeof o.routing.travel !== "boolean") throw new Error("Travel must be true or false");
}

/** Stitches this configuration needs at least, from the regions' total area (an upper bound on the fill area). */
export function estimateStitches(o: Pick<StitchOptions, "fill" | "underlay" | "crossing">, area: number): number {
  const f = o.fill;
  let stitches = (f.rule === "seed" ? area / (f.spacing * f.spacing) : area / (f.spacing * f.length)) * (f.rule === "mixed" ? 0.5 : 1);
  if (o.underlay.kind === "cross" || o.underlay.kind === "both") stitches += area / (o.underlay.spacing * f.length);
  if (o.crossing.kind === "over") stitches += area / (o.crossing.spacing * f.length);
  return stitches;
}

function budget(o: StitchOptions, area: number): void {
  const stitches = estimateStitches(o, area);
  if (stitches > STITCH_LIMITS.stitches)
    throw new Error(`These settings need about ${Math.round(stitches)} stitches; the limit is ${STITCH_LIMITS.stitches}. Raise Row spacing or Stitch length, or shrink the regions`);
}

// ---------------------------------------------------------------------------------------------------------------------
// Geometry helpers

interface Row { readonly id: string; readonly points: readonly Pt[]; readonly straight: boolean }
interface Draft { readonly role: ThreadRole; readonly tag: string; readonly rule: FillRule | null; readonly points: Pt[]; readonly rowStarts: number[]; readonly firstRow: number }

/** Rounding of a computed row end (a crossing of a row with the boundary) can leave it a few ulps outside the closed region. */
export const INSIDE_TOLERANCE = 1e-6;
/** Whether a segment lies in the closed region, allowing `INSIDE_TOLERANCE` canvas units of it outside (rounding of computed endpoints). */
const segmentInside = (domain: PlanarDomain, a: Pt, b: Pt): boolean => {
  if (a[0] === b[0] && a[1] === b[1]) return locateInDomain(domain, a[0], a[1]) !== "outside";
  let outside = 0;
  for (const piece of clipPath([a, b], domain, { keep: "outside" })) outside += polylineLength(piece.points);
  return outside <= INSIDE_TOLERANCE;
};

/** The support vertex of a ring in a direction (degrees): see the module header. */
function supportIndex(ring: readonly Pt[], degrees: number): number {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [x, y] of ring) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  const cx = (left + right) / 2, cy = (top + bottom) / 2, dx = Math.cos(degrees * RADIANS), dy = Math.sin(degrees * RADIANS);
  let best = 0, bestScore = -Infinity;
  ring.forEach(([x, y], i) => { const score = (x - cx) * dx + (y - cy) * dy; if (score > bestScore) { bestScore = score; best = i; } });
  return best;
}

/** The ring's vertices from its support vertex, closed by repeating it and continued `lap` further around. */
function ringFrom(ring: readonly Pt[], degrees: number, lap: number): Pt[] {
  const start = supportIndex(ring, degrees), n = ring.length;
  const out: Pt[] = [];
  for (let k = 0; k <= n; k++) out.push(ring[(start + k) % n]);
  let remaining = lap;
  for (let k = 1; k <= n && remaining > 0; k++) {
    const a = ring[(start + k - 1) % n], b = ring[(start + k) % n], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= remaining) { out.push(b); remaining -= d; } else { out.push([a[0] + ((b[0] - a[0]) * remaining) / d, a[1] + ((b[1] - a[1]) * remaining) / d]); remaining = 0; }
  }
  return out;
}

/** Zigzag stitches across a band of `width` inside a ring: see the module header. Returns one long polyline (before clipping). */
function satinBand(ring: readonly Pt[], degrees: number, width: number, spacing: number, lap: number): Pt[] {
  const path = ringFrom(ring, degrees, lap), total = polylineLength(path);
  const parts = Math.max(1, Math.ceil(total / spacing));
  const positions = Array.from({ length: parts + 1 }, (_, i) => (total * i) / parts);
  const at = samplePolyline(path, positions);
  const out: Pt[] = [];
  let segment = 0, start = 0;
  positions.forEach((s, i) => {
    while (segment < path.length - 2 && s > start + Math.hypot(path[segment + 1][0] - path[segment][0], path[segment + 1][1] - path[segment][1])) {
      start += Math.hypot(path[segment + 1][0] - path[segment][0], path[segment + 1][1] - path[segment][1]); segment++;
    }
    const a = path[segment], b = path[segment + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const p = at[i], q: Pt = [p[0] + (-(b[1] - a[1]) / d) * width, p[1] + ((b[0] - a[0]) / d) * width];
    if (i % 2 === 0) out.push(p, q); else out.push(q, p);
  });
  return out;
}

function rowsCacheKey(parts: unknown[]): string { return JSON.stringify(parts); }
const lineCache = new Map<string, readonly Streamline[]>();

function curvedLines(domain: PlanarDomain, field: StitchField, turn: number, spacing: number, origin: readonly [number, number], cancelled?: () => boolean): readonly Streamline[] {
  const [l, t, r, b] = domain.bounds!, pad = 2 * spacing;
  const bounds: [number, number, number, number] = [l - pad, t - pad, r + pad, b + pad];
  const key = rowsCacheKey([field.key, turn, bounds, spacing, origin]);
  const hit = lineCache.get(key);
  if (hit) { lineCache.delete(key); lineCache.set(key, hit); return hit; }
  const step = Math.min(1.5, spacing * 0.4), cell = 4 * spacing;
  const steps = ((bounds[2] - bounds[0]) * (bounds[3] - bounds[1]) / spacing / step) * 1.3;
  if (steps > STITCH_LIMITS.steps) throw new Error(`Tracing the rows would take about ${Math.round(steps)} steps; the limit is ${STITCH_LIMITS.steps}. Raise Row spacing or shrink the regions`);
  const seeds: { id: string; x: number; y: number }[] = [];
  const i0 = Math.floor((bounds[0] - origin[0]) / cell), i1 = Math.ceil((bounds[2] - origin[0]) / cell), j0 = Math.floor((bounds[1] - origin[1]) / cell), j1 = Math.ceil((bounds[3] - origin[1]) / cell);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = origin[0] + (i + 0.5) * cell, y = origin[1] + (j + 0.5) * cell;
    if (x >= bounds[0] && x <= bounds[2] && y >= bounds[1] && y <= bounds[3]) seeds.push({ id: `row:${i}:${j}`, x, y });
  }
  let lines: readonly Streamline[];
  try {
    lines = traceStreamlines({
      field: (x, y, hint) => {
        const a = halfTurn(field.angleAt(x, y) + turn);
        let dx = Math.cos(a), dy = Math.sin(a);
        if (dx * hint[0] + dy * hint[1] < 0) { dx = -dx; dy = -dy; }
        return [dx, dy];
      },
      bounds, seeds, separation: spacing, stopFraction: 0.8, step, minLength: spacing * 1.5, maxLength: 4 * (bounds[2] - bounds[0] + bounds[3] - bounds[1]) + 100,
      minRadius: spacing, fill: true, maxLines: STITCH_LIMITS.rows, maxVertices: 3_000_000, maxSteps: STITCH_LIMITS.steps, cancelled,
    }).lines;
  } catch (error) {
    if (error instanceof Error && /^Streamline/.test(error.message)) throw new Error(`${error.message.replace(/:.*$/s, "")}. Raise Row spacing or shrink the regions`);
    throw error;
  }
  lineCache.set(key, lines);
  if (lineCache.size > 6) lineCache.delete(lineCache.keys().next().value as string);
  return lines;
}

/** The rows of a domain: exact hatch for a constant field, clipped streamlines otherwise. `turn` is radians added to the field. */
function rowsOf(domain: PlanarDomain, field: StitchField, turn: number, spacing: number, origin: readonly [number, number], tag: string, cancelled?: () => boolean): Row[] {
  if (domain.regions.length === 0) return [];
  const [l, t, r, b] = domain.bounds!;
  if (((b - t) + (r - l)) / spacing > STITCH_LIMITS.rows) throw new Error(`The regions need more than ${STITCH_LIMITS.rows} rows; raise Row spacing`);
  if (field.constant) {
    const degrees = ((field.spec.angle * RADIANS + turn) / RADIANS);
    return hatchDomain(domain, { angle: degrees, spacing, phase: 0.5, origin, id: tag, maxLines: STITCH_LIMITS.rows }).map((stroke) => ({ id: stroke.id, points: stroke.points as readonly Pt[], straight: true }));
  }
  const rows: Row[] = [];
  for (const line of curvedLines(domain, field, turn, spacing, origin, cancelled)) {
    cancelled?.();
    let lo = Infinity, hi = -Infinity, top = Infinity, bottom = -Infinity;
    for (const p of line.points) { lo = Math.min(lo, p[0]); hi = Math.max(hi, p[0]); top = Math.min(top, p[1]); bottom = Math.max(bottom, p[1]); }
    if (hi < l || lo > r || bottom < t || top > b) continue;
    clipPath(line.points as readonly Pt[], domain, { id: `${tag}${line.id}` }).forEach((piece) => rows.push({ id: piece.id, points: piece.points, straight: false }));
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------------------------------
// One region

interface Counters { stitches: number; threads: number; cancelled?: () => boolean }

function count(c: Counters, points: number): void {
  c.stitches += Math.max(0, points - 1); c.threads++;
  if (c.stitches > STITCH_LIMITS.stitches) throw new Error(`These settings make more than ${STITCH_LIMITS.stitches} stitches. Raise Row spacing or Stitch length, or shrink the regions`);
  if (c.threads > STITCH_LIMITS.threads) throw new Error(`These settings make more than ${STITCH_LIMITS.threads} threads. Raise Row spacing, or use fewer seed stitches`);
}

function stitchedRuns(rows: readonly Row[], domain: PlanarDomain, cut: (row: Row) => Pt[], minRun: number, counters: Counters): Run[] {
  const runs: Run[] = [];
  for (const row of rows) {
    counters.cancelled?.();
    if (!(polylineLength(row.points) >= minRun)) continue;
    const stitched = cut(row);
    const pieces = row.straight ? [stitched] : clipPath(stitched, domain, { keep: "inside" }).map((piece) => distinctPoints(piece.points as Pt[]));
    for (const points of pieces) if (points.length >= 2 && polylineLength(points) >= minRun) runs.push({ points });
  }
  return runs;
}

function routed(runs: readonly Run[], start: Pt, domain: PlanarDomain, length: number, spacing: number, join: boolean, counters: Counters): Chain[] {
  const chains = routeRuns(runs, start, {
    join: join ? (end, entry) => Math.hypot(entry[0] - end[0], entry[1] - end[1]) <= length && segmentInside(domain, end, entry) : null,
    cell: Math.max(2 * spacing, length), cancelled: counters.cancelled,
  });
  for (const chain of chains) count(counters, chain.points.length);
  return chains;
}

function fromChains(chains: readonly Chain[], role: ThreadRole, tag: string, rule: FillRule | null): Draft[] {
  return chains.map((chain) => ({ role, tag, rule, points: chain.points, rowStarts: chain.rowStarts, firstRow: chain.firstRow }));
}

function ringThreads(domain: PlanarDomain, seam: number, role: ThreadRole, tag: string, produce: (ring: readonly Pt[]) => Pt[][], counters: Counters): Draft[] {
  const drafts: Draft[] = [];
  for (const region of domain.regions) for (const ring of [region.outer, ...region.holes]) {
    counters.cancelled?.();
    for (const points of produce(ring as readonly Pt[])) if (points.length >= 2) { count(counters, points.length); drafts.push({ role, tag, rule: null, points, rowStarts: [0], firstRow: 0 }); }
  }
  return drafts;
}

interface RegionResult { info: Omit<StitchRegionInfo, "threads" | "stitches">; drafts: Draft[] }

function stitchRegion(region: StitchRegion, o: StitchOptions, field: StitchField, counters: Counters): RegionResult {
  const { fill } = o, L = fill.length, seed = o.seed;
  const rule: FillRule = fill.rule === "mixed" ? (["running", "satin", "seed"] as const)[componentSeed(seed, region.id, "rule") % 3] : fill.rule;
  const turnDegrees = fill.angleSpread > 0 ? (unit(seed, region.id, "turn") - 0.5) * 2 * fill.angleSpread : 0;
  const turn = turnDegrees * RADIANS;
  const domain = fill.inset > 0 ? offsetDomain(region.domain, -fill.inset, { id: `fill:${region.id}` }) : region.domain;
  const base = { id: region.id, index: region.index, label: region.label, tone: region.tone, rule, turn: turnDegrees, area: region.domain.area, fillArea: domain.area };
  if (domain.regions.length === 0) return { info: base, drafts: [] };
  const drafts: Draft[] = [];
  const bounds = domain.bounds!;
  const start = ((): Pt => { const ring = domain.regions.flatMap((r) => r.outer as readonly Pt[]); return ring[supportIndex(ring, o.seam)]; })();
  const minRun = 0.25 * fill.spacing;
  const running = (row: Row, phase: number): Pt[] => runningStitches(row.points, L, phase);
  const phaseOf = (row: Row): number => Math.min(0.999999, fill.stagger * unit(seed, `${region.id}/${row.id}`, "phase"));

  // Underlay.
  if (o.underlay.kind !== "none") {
    const under = offsetDomain(domain, -o.underlay.inset, { id: `underlay:${region.id}` });
    if (o.underlay.kind === "edge" || o.underlay.kind === "both")
      drafts.push(...ringThreads(under, o.seam, "underlay", "ue", (ring) => [boundStitches(ringFrom(ring, o.seam, 0), L)], counters));
    if ((o.underlay.kind === "cross" || o.underlay.kind === "both") && under.regions.length > 0) {
      const rows = rowsOf(under, field, turn + Math.PI / 2, o.underlay.spacing, o.origin, `${region.id}/uc`, counters.cancelled);
      const runs = stitchedRuns(rows, under, (row) => runningStitches(row.points, L, 0), 0.25 * o.underlay.spacing, counters);
      drafts.push(...fromChains(routed(runs, start, under, L, o.underlay.spacing, true, counters), "underlay", "uc", null));
    }
  }

  // Fill.
  if (rule === "seed") {
    const cell = fill.spacing, cells = ((bounds[2] - bounds[0]) / cell + 1) * ((bounds[3] - bounds[1]) / cell + 1);
    if (cells > STITCH_LIMITS.cells) throw new Error(`Seed stitching would test ${Math.round(cells)} grid cells; the limit is ${STITCH_LIMITS.cells}. Raise Row spacing or shrink the regions`);
    const runs: Run[] = [];
    const i0 = Math.floor((bounds[0] - o.origin[0]) / cell), i1 = Math.floor((bounds[2] - o.origin[0]) / cell);
    const j0 = Math.floor((bounds[1] - o.origin[1]) / cell), j1 = Math.floor((bounds[3] - o.origin[1]) / cell);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      counters.cancelled?.();
      const id = `${region.id}/seed:${i}:${j}`;
      const x = o.origin[0] + (i + 0.5 + (unit(seed, id, "x") - 0.5) * 0.85) * cell, y = o.origin[1] + (j + 0.5 + (unit(seed, id, "y") - 0.5) * 0.85) * cell;
      if (x < bounds[0] || x > bounds[2] || y < bounds[1] || y > bounds[3] || locateInDomain(domain, x, y) !== "inside") continue;
      const angle = field.angleAt(x, y) + turn + fill.scatter * Math.PI * (unit(seed, id, "angle") - 0.5);
      const length = L * (0.5 + 0.5 * unit(seed, id, "length")), hx = Math.cos(angle) * length / 2, hy = Math.sin(angle) * length / 2;
      const piece = clipPath([[x - hx, y - hy], [x + hx, y + hy]], domain).find((p) => p.from <= 0.5 && p.to >= 0.5);
      if (!piece || polylineLength(piece.points) < 0.25 * length) continue;
      runs.push({ points: piece.points as Pt[] });
    }
    drafts.push(...fromChains(routed(runs, start, domain, L, cell, false, counters), "fill", "f", "seed"));
  } else {
    const rows = rowsOf(domain, field, turn, fill.spacing, o.origin, `${region.id}/f`, counters.cancelled);
    const runs = stitchedRuns(rows, domain, rule === "satin" ? (row) => spanStitches(row.points, L) : (row) => running(row, phaseOf(row)), minRun, counters);
    drafts.push(...fromChains(routed(runs, start, domain, L, fill.spacing, true, counters), "fill", "f", rule));
  }

  // Crossing layer.
  if (o.crossing.kind === "over") {
    const rows = rowsOf(domain, field, turn + o.crossing.angle * RADIANS, o.crossing.spacing, o.origin, `${region.id}/c`, counters.cancelled);
    const runs = stitchedRuns(rows, domain, (row) => running(row, Math.min(0.999999, 0.5 * unit(seed, `${region.id}/${row.id}`, "phase"))), 0.25 * o.crossing.spacing, counters);
    drafts.push(...fromChains(routed(runs, start, domain, L, o.crossing.spacing, true, counters), "crossing", "c", null));
  }

  // Outline.
  if (o.outline.kind === "running")
    drafts.push(...ringThreads(domain, o.seam, "outline", "o", (ring) => [boundStitches(ringFrom(ring, o.seam, o.outline.lap), L)], counters));
  else if (o.outline.kind === "satin")
    drafts.push(...ringThreads(domain, o.seam, "outline", "o", (ring) =>
      clipPath(satinBand(ring, o.seam, o.outline.width, fill.spacing, o.outline.lap), domain).map((piece) => boundStitches(piece.points as Pt[], L)), counters));
  return { info: base, drafts };
}

// ---------------------------------------------------------------------------------------------------------------------
// Assembly

const freezePoints = (points: readonly Pt[]): readonly Pt[] => Object.freeze(points.map((p) => Object.freeze([p[0], p[1]] as const) as Pt));

function threadOf(o: StitchOptions, id: string, region: StitchRegion, draft: Pick<Draft, "role" | "rule" | "points" | "rowStarts" | "firstRow">, order: number, regions: number): StitchThread {
  let length = 0;
  for (let i = 1; i < draft.points.length; i++) length += Math.hypot(draft.points[i][0] - draft.points[i - 1][0], draft.points[i][1] - draft.points[i - 1][1]);
  return Object.freeze({
    id, seed: componentSeed(o.seed, id, "thread"), points: freezePoints(draft.points), closed: false,
    level: region.index, levelFraction: regions > 1 ? region.index / (regions - 1) : 0,
    region: region.id, role: draft.role, rule: draft.rule, order, stitches: draft.points.length - 1, length,
    rowStarts: Object.freeze([...draft.rowStarts]), firstRow: draft.firstRow,
  });
}

function build(o: StitchOptions, cancelled?: () => boolean): StitchProducts {
  validate(o);
  let area = 0;
  for (const region of o.regions) area += region.domain.area;
  budget(o, area);
  const field = stitchField(o.field), counters: Counters = { stitches: 0, threads: 0, cancelled: cancelled && (() => { if (cancelled()) throw new Error("Composition cancelled"); return false; }) };
  const results = o.regions.map((region) => stitchRegion(region, o, field, counters));
  // Region order.
  const firsts = results.map((r) => r.drafts[0]?.points[0]), lasts = results.map((r) => r.drafts.length ? r.drafts[r.drafts.length - 1].points.at(-1)! : undefined);
  const order: number[] = [];
  if (o.routing.order === "label") results.forEach((r, i) => { if (r.drafts.length) order.push(i); });
  else {
    const left = new Set(results.flatMap((r, i) => (r.drafts.length ? [i] : [])));
    let current = left.size ? Math.min(...left) : -1;
    while (current >= 0) {
      order.push(current); left.delete(current);
      const end = lasts[current]!;
      let best = -1, bestD = Infinity;
      for (const i of left) { const p = firsts[i]!, d = (p[0] - end[0]) ** 2 + (p[1] - end[1]) ** 2; if (d < bestD) { bestD = d; best = i; } }
      current = best;
    }
  }
  const threads: StitchThread[] = [], tags = new Map<string, number>();
  const infos: StitchRegionInfo[] = [];
  let travels = 0, trims = 0, previous: StitchThread | null = null;
  const total = o.regions.length;
  const perRegion = new Map<number, { threads: number; stitches: number }>();
  for (const index of order) {
    const region = o.regions[index], result = results[index];
    let regionThreads = 0, regionStitches = 0;
    for (const draft of result.drafts) {
      const tag = `${region.id}/${draft.tag}`, n = tags.get(tag) ?? 0;
      tags.set(tag, n + 1);
      if (previous) {
        const a = previous.points[previous.points.length - 1], b = draft.points[0];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-9) {
          if (o.routing.travel) {
            const points = boundStitches([a, b], o.fill.length);
            count(counters, points.length);
            threads.push(threadOf(o, `travel:${travels++}`, region, { role: "travel", rule: null, points, rowStarts: [0], firstRow: 0 }, threads.length, total));
          } else if (previous.region === region.id) trims++;
        }
      }
      const thread = threadOf(o, `${tag}:${n}`, region, draft, threads.length, total);
      threads.push(thread); previous = thread;
      regionThreads++; regionStitches += thread.stitches;
    }
    perRegion.set(index, { threads: regionThreads, stitches: regionStitches });
  }
  let stitches = 0, length = 0, longest = 0, emptyRegions = 0;
  for (const thread of threads) {
    stitches += thread.stitches; length += thread.length;
    for (let i = 1; i < thread.points.length; i++) longest = Math.max(longest, Math.hypot(thread.points[i][0] - thread.points[i - 1][0], thread.points[i][1] - thread.points[i - 1][1]));
  }
  results.forEach((result, i) => {
    const used = perRegion.get(i) ?? { threads: 0, stitches: 0 };
    if (used.threads === 0) emptyRegions++;
    infos.push(Object.freeze({ ...result.info, ...used }));
  });
  return Object.freeze({
    regions: Object.freeze(infos), threads: Object.freeze(threads),
    stats: Object.freeze({ threads: threads.length, stitches, length, longest, travelThreads: travels, trims, emptyRegions }),
  });
}

/** Whether the seed can change these threads: only where a seeded choice is read (the crossing layer always staggers by up to half a stitch). */
export function stitchUsesSeed(o: Pick<StitchOptions, "fill" | "crossing">): boolean {
  const f = o.fill;
  return f.rule === "seed" || f.rule === "mixed" || f.angleSpread > 0 || (f.rule === "running" && f.stagger > 0) || o.crossing.kind === "over";
}

const cache = new WeakMap<object, Map<string, StitchProducts>>();

/** The threads of these regions and settings; cached, frozen, ids stable for the same construction (see the module header). */
export function stitchThreads(options: StitchOptions, cancelled?: () => boolean): StitchProducts {
  validate(options);
  const { regions, seed, ...rest } = options;
  const seeded = stitchUsesSeed(options);
  const key = JSON.stringify([seeded ? seed : null, { ...rest, field: fieldKey(rest.field) }]);
  return cachedBy(cache, regions, key, () => build(options, cancelled));
}
