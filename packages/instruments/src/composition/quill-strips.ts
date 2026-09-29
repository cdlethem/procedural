import { offsetPolyline2D } from "@procedurals/javascript";
import { componentSeed } from "./core.js";
import { cleanPoints } from "./quill-scaffold.js";
import type { Path, Point } from "./types.js";

/**
 * Strips: scaffold paths -> nested, rolled, mutually clear centerlines.
 *
 * INPUT CONTRACT. `quillStrips(scaffold, options)` takes any frozen `Path[]` (see
 * `quill-scaffold.ts`) plus scalar options. Lengths are canvas units, angles degrees. Nothing
 * is fetched and no callback runs.
 *
 * OUTPUT. A frozen, cached `QuillStrips`: an ordered list of `QuillStrip` centerlines (canvas
 * plan coordinates, y down) with diagnostics. Strips are cached by scaffold identity plus the
 * options that construct them, so heights, camera and material never rebuild them.
 *
 * CONSTRUCTION, in this order:
 * 1. `subdivide`: every scaffold path keeps its own vertices and gains equally spaced points so no
 *    segment exceeds `resolution`. Corners are never rounded. Repeated points and a repeated
 *    closing point are removed first.
 * 2. TERMINALS on open paths (`terminals`): a roll of radius `curlRadius` continues the strip
 *    tangentially (G1, not curvature-continuous). Its radius of curvature falls linearly with the
 *    turned angle, by exactly one `pitch = thickness + curlGap` per full turn, so successive turns
 *    of the roll stay `pitch` apart, until it reaches the tightest bend the paper allows,
 *    `1.25 * pitch`. `curl` names the side of the strip each end rolls toward: `left`/`right`
 *    (both ends: a C scroll), `opposite` (end left, start right: an S scroll) or `random`
 *    (independent stable choice per strip end). Sides are the viewer's, looking along the
 *    strip on the canvas.
 * 3. LOCAL NESTING on closed paths (`nest`, `spacing`, `nestSide`): ring k is the miter offset
 *    (`offsetPolyline2D`, limit 2) of the ORIGINAL path by `k * spacing`, toward the interior,
 *    the exterior or both. A ring is used only while it is a valid offset: simple (no
 *    crossings), same orientation and shrinking (or growing) as asked, and no vertex nearer
 *    the source than 0.9 of the distance (`inverted`: the offset has passed through itself). The first invalid ring ends that direction for that
 *    path only, and the stop is reported in `diagnostics.nestStops`: a narrow letter stem
 *    nests one ring, a hill nests many. Open paths are never nested.
 * 4. JUNCTION POLICY. Strips are ranked by (|ring|, ring sign, scaffold order): every scaffold
 *    strip outranks every nest ring, shallower rings outrank deeper ones. A segment whose
 *    distance to a higher-ranked kept segment, or to an earlier kept segment of its own strip
 *    farther than `2r + resolution` along the arc (`r = thickness + clearance`), is closer than
 *    97% of `r` overlaps another strip. `overlap: "trim"` drops that segment (the strip splits
 *    into pieces `<source>[/nest:±k]#<n>`; pieces shorter than `2r` are dropped);
 *    `overlap: "reject"` throws naming the controls to change. There is no crossing
 *    and no depth-ordering of overlapping walls: strips are either apart or trimmed.
 *
 * IDS AND SEEDS. A strip id is `<scaffold id>#<piece>` for the scaffold ring and
 * `<scaffold id>/nest:<±k>#<piece>` for nest rings (`+k` toward the interior, `-k` toward the
 * exterior). Seeds derive from `componentSeed(seed, source id, purpose)`, never from order.
 *
 * WORK BOUNDS. `MAX_QUILL_VERTICES` centerline vertices before trimming, `MAX_QUILL_STRIPS`,
 * `MAX_COIL_TURNS` per roll and `MAX_CLASH_TESTS` segment-pair distance tests. Each throws an
 * `Error` naming what to change. Nothing is truncated silently.
 */
export const MAX_QUILL_VERTICES = 90_000;
export const MAX_QUILL_STRIPS = 4_000;
export const MAX_COIL_TURNS = 40;
export const MAX_CLASH_TESTS = 60_000_000;
const MITER_LIMIT = 2;
const U32 = 0x1_0000_0000;
/** Distances within this fraction of the limit still count as apart (polygonal curves). */
const CLEAR_TOLERANCE = 0.97;

export type QuillTerminals = "none" | "start" | "end" | "both";
export type QuillCurl = "left" | "right" | "opposite" | "random";
export type QuillNestSide = "inward" | "outward" | "both";
export type QuillOverlap = "trim" | "reject";

export interface QuillStripOptions {
  seed: number;
  /** Centerline spacing of nest rings. At least `thickness + clearance`. */
  spacing: number;
  /** Rings on each requested side of every closed path; 0 draws only the scaffold. */
  nest: number;
  nestSide: QuillNestSide;
  /** Paper thickness: the width of the strip seen from above. */
  thickness: number;
  /** Least face-to-face gap between different strips (and between a strip and its own far parts). */
  clearance: number;
  /** Longest centerline segment. */
  resolution: number;
  overlap: QuillOverlap;
  terminals: QuillTerminals;
  curl: QuillCurl;
  /** Outer radius of a roll. */
  curlRadius: number;
  /** Face-to-face gap between successive turns of a roll. At least `clearance`. */
  curlGap: number;
}

export interface QuillStrip {
  readonly id: string;
  readonly seed: number;
  /** Id of the scaffold path this strip comes from. */
  readonly source: string;
  /** Index of the scaffold path in the scaffold list. */
  readonly sourceIndex: number;
  /** 0 for the scaffold ring, +k toward the interior, -k toward the exterior. */
  readonly ring: number;
  readonly piece: number;
  readonly points: readonly Point[];
  readonly closed: boolean;
  /** Stable value in [0, 1) of the scaffold path, for height variation. */
  readonly heightUnit: number;
  readonly level: number;
  readonly levelFraction: number;
  /** True when the piece begins / ends in the free end of a roll. */
  readonly rolled: { readonly start: boolean; readonly end: boolean };
}
export interface NestStop { readonly source: string; readonly ring: number; readonly reason: string }
export interface StripClash { readonly a: string; readonly b: string; readonly x: number; readonly y: number }
export interface QuillDiagnostics {
  readonly scaffoldPaths: number;
  /** Scaffold paths with fewer than two (open) or three (closed) distinct points. */
  readonly degeneratePaths: number;
  readonly candidates: number;
  readonly vertices: number;
  readonly rolledEnds: number;
  readonly nestStops: readonly NestStop[];
  /** Segments dropped for overlapping a higher-ranked strip. */
  readonly trimmedSegments: number;
  readonly droppedSlivers: number;
  readonly clashes: readonly StripClash[];
}
export interface QuillStrips {
  readonly options: Readonly<QuillStripOptions>;
  readonly strips: readonly QuillStrip[];
  readonly diagnostics: QuillDiagnostics;
}

const TERMINALS: readonly QuillTerminals[] = ["none", "start", "end", "both"];
const CURLS: readonly QuillCurl[] = ["left", "right", "opposite", "random"];
const NEST_SIDES: readonly QuillNestSide[] = ["inward", "outward", "both"];
const OVERLAPS: readonly QuillOverlap[] = ["trim", "reject"];

function finite(label: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}

/** Tightest radius of curvature a roll reaches: the smallest bend the paper makes. */
export function tightestBend(options: Pick<QuillStripOptions, "thickness" | "curlGap">): number {
  return 1.25 * (options.thickness + options.curlGap);
}

export function validateStripOptions(o: QuillStripOptions): void {
  if (!Number.isSafeInteger(o.seed) || o.seed < 0 || o.seed > 0xffffffff) throw new Error("Strip seed must be a uint32 integer");
  finite("Paper thickness", o.thickness, 0.05, 1000);
  finite("Clearance", o.clearance, 0, 1000);
  finite("Path resolution", o.resolution, 0.25, 1000);
  finite("Strip spacing", o.spacing, 0.05, 10_000);
  finite("Curl radius", o.curlRadius, 0.05, 10_000);
  finite("Curl gap", o.curlGap, 0, 1000);
  if (!Number.isInteger(o.nest) || o.nest < 0 || o.nest > 64) throw new Error("Nest rings must be an integer in [0, 64]");
  if (!TERMINALS.includes(o.terminals)) throw new Error(`Unknown terminal choice: ${String(o.terminals)}`);
  if (!CURLS.includes(o.curl)) throw new Error(`Unknown curl choice: ${String(o.curl)}`);
  if (!NEST_SIDES.includes(o.nestSide)) throw new Error(`Unknown nest side: ${String(o.nestSide)}`);
  if (!OVERLAPS.includes(o.overlap)) throw new Error(`Unknown overlap policy: ${String(o.overlap)}`);
  if (o.nest > 0 && o.spacing < o.thickness + o.clearance)
    throw new Error(`Strip spacing ${o.spacing} must be at least paper thickness + clearance (${o.thickness + o.clearance}); raise Strip spacing or lower Paper thickness or Clearance`);
  if (o.terminals !== "none") {
    if (o.curlGap < o.clearance) throw new Error(`Curl gap ${o.curlGap} must be at least the clearance ${o.clearance}; raise Curl gap or lower Clearance`);
    const core = tightestBend(o);
    if (o.curlRadius < core)
      throw new Error(`Curl radius ${o.curlRadius} is below the tightest roll this paper makes (${core.toFixed(2)}); raise Curl radius or lower Paper thickness or Curl gap`);
    const turns = (o.curlRadius - core) / (o.thickness + o.curlGap);
    if (turns > MAX_COIL_TURNS) throw new Error(`A roll would make ${turns.toFixed(1)} turns; the limit is ${MAX_COIL_TURNS}. Lower Curl radius or raise Curl gap or Paper thickness`);
  }
}

const signedArea = (points: readonly Point[]): number => {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
};

/** Insert equally spaced points so no segment exceeds `max`; original vertices are kept. */
export function subdivide(points: readonly Point[], closed: boolean, max: number): Point[] {
  const out: Point[] = [];
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const pieces = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / max - 1e-9));
    for (let k = 0; k < pieces; k++) out.push([a[0] + (b[0] - a[0]) * k / pieces, a[1] + (b[1] - a[1]) * k / pieces]);
  }
  if (!closed) out.push([points[points.length - 1][0], points[points.length - 1][1]]);
  return out;
}

/**
 * The roll that continues a strip from `origin` heading `heading` (radians, canvas frame):
 * vertices AFTER the origin. `side` +1 turns the heading toward increasing angle (clockwise on
 * a y-down canvas), -1 the other way. Radius of curvature ρ(φ) = radius − pitch·φ/2π over the
 * turned angle φ, integrated in closed form:
 * Re = ρ sin φ + k(1 − cos φ), Im = side·(radius − ρ cos φ − k sin φ), k = pitch/2π,
 * then rotated by the heading. It ends where ρ reaches `core`.
 */
export function rollPoints(origin: Point, heading: number, side: 1 | -1, radius: number, pitch: number, core: number, step: number): Point[] {
  const k = pitch / (2 * Math.PI), end = (radius - core) / k;
  const ch = Math.cos(heading), sh = Math.sin(heading), out: Point[] = [];
  const at = (phi: number): Point => {
    const rho = radius - k * phi, c = Math.cos(phi), s = Math.sin(phi);
    const re = rho * s + k * (1 - c), im = side * (radius - rho * c - k * s);
    return [origin[0] + re * ch - im * sh, origin[1] + re * sh + im * ch];
  };
  for (let phi = 0; phi < end; ) {
    phi = Math.min(end, phi + Math.min(0.2, step / Math.max(radius - k * phi, core)));
    out.push(at(phi));
  }
  return out;
}

class SegmentGrid {
  readonly ax: number[] = []; readonly ay: number[] = []; readonly bx: number[] = []; readonly by: number[] = [];
  readonly owner: number[] = []; readonly arc: number[] = []; readonly alive: boolean[] = [];
  private readonly cells = new Map<number, number[]>();
  private stamp: number[] = [];
  private query = 0;
  constructor(readonly cell: number) {}
  private key(ix: number, iy: number): number { return (ix + 1_000_000) * 4_000_037 + (iy + 1_000_000); }
  add(ax: number, ay: number, bx: number, by: number, owner: number, arc: number): number {
    const id = this.ax.length;
    this.ax.push(ax); this.ay.push(ay); this.bx.push(bx); this.by.push(by); this.owner.push(owner); this.arc.push(arc); this.alive.push(true);
    this.stamp.push(0);
    const x0 = Math.floor(Math.min(ax, bx) / this.cell), x1 = Math.floor(Math.max(ax, bx) / this.cell);
    const y0 = Math.floor(Math.min(ay, by) / this.cell), y1 = Math.floor(Math.max(ay, by) / this.cell);
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
      const key = this.key(ix, iy), list = this.cells.get(key);
      if (list) list.push(id); else this.cells.set(key, [id]);
    }
    return id;
  }
  /** Visit each live segment whose cells the expanded box touches once; stop when `visit` returns true. */
  near(ax: number, ay: number, bx: number, by: number, radius: number, visit: (id: number) => boolean | void): void {
    const q = ++this.query;
    const x0 = Math.floor((Math.min(ax, bx) - radius) / this.cell), x1 = Math.floor((Math.max(ax, bx) + radius) / this.cell);
    const y0 = Math.floor((Math.min(ay, by) - radius) / this.cell), y1 = Math.floor((Math.max(ay, by) + radius) / this.cell);
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
      const list = this.cells.get(this.key(ix, iy));
      if (!list) continue;
      for (const id of list) {
        if (this.stamp[id] === q || !this.alive[id]) continue;
        this.stamp[id] = q;
        if (visit(id)) return;
      }
    }
  }
}

function pointSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const orient = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
function crosses(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  const o1 = orient(ax, ay, bx, by, cx, cy), o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay), o4 = orient(cx, cy, dx, dy, bx, by);
  return o1 * o2 < 0 && o3 * o4 < 0;
}
function segmentDistance(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  if (crosses(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  return Math.min(pointSegment(ax, ay, cx, cy, dx, dy), pointSegment(bx, by, cx, cy, dx, dy),
    pointSegment(cx, cy, ax, ay, bx, by), pointSegment(dx, dy, ax, ay, bx, by));
}

/** Why an offset ring is not a valid offset of `source` at `distance`, or null when it is. */
function ringFault(source: readonly Point[], ring: readonly Point[], distance: number): string | null {
  if (ring.length < 3) return "collapsed";
  const sourceArea = signedArea(source), area = signedArea(ring), inward = Math.abs(area) < Math.abs(sourceArea);
  if (!Number.isFinite(area) || Math.abs(area) < 1e-6 || Math.sign(area) !== Math.sign(sourceArea)) return "collapsed";
  const shrinks = distance > 0 === sourceArea > 0;
  if (inward !== shrinks) return "collapsed";
  const grid = new SegmentGrid(Math.max(4, 2 * Math.abs(distance)));
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    grid.add(a[0], a[1], b[0], b[1], 0, i);
  }
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    let bad = false;
    grid.near(a[0], a[1], b[0], b[1], 0, (id) => {
      const j = grid.arc[id];
      if (j === i || j === (i + 1) % n || (j + 1) % n === i) return;
      if (crosses(a[0], a[1], b[0], b[1], grid.ax[id], grid.ay[id], grid.bx[id], grid.by[id])) { bad = true; return true; }
    });
    if (bad) return "crosses itself";
  }
  const near = new SegmentGrid(Math.max(4, 2 * Math.abs(distance)));
  for (let i = 0; i < source.length; i++) {
    const a = source[i], b = source[(i + 1) % source.length];
    near.add(a[0], a[1], b[0], b[1], 0, i);
  }
  const least = 0.9 * Math.abs(distance);
  for (const [x, y] of ring) {
    let bad = false;
    near.near(x, y, x, y, Math.abs(distance), (id) => {
      if (pointSegment(x, y, near.ax[id], near.ay[id], near.bx[id], near.by[id]) < least) { bad = true; return true; }
    });
    if (bad) return "inverted";
  }
  return null;
}

interface Candidate {
  source: Path;
  sourceIndex: number;
  ring: number;
  points: Point[];
  closed: boolean;
  /** Vertices at the start / end that belong to a roll. */
  rollStart: number;
  rollEnd: number;
}

const stripCache = new WeakMap<readonly Path[], Map<string, QuillStrips>>();
const unit = (seed: number, id: string, purpose: string) => componentSeed(seed, id, purpose) / U32;

function withRolls(source: Path, points: Point[], o: QuillStripOptions): { points: Point[]; rollStart: number; rollEnd: number } {
  const pitch = o.thickness + o.curlGap, core = tightestBend(o);
  const roll = (from: Point, toward: Point, side: 1 | -1): Point[] =>
    rollPoints(from, Math.atan2(from[1] - toward[1], from[0] - toward[0]), side, o.curlRadius, pitch, core, o.resolution);
  const endLeft = o.curl === "random" ? unit(o.seed, source.id, "curl:end") < 0.5 : o.curl !== "right";
  const startLeft = o.curl === "random" ? unit(o.seed, source.id, "curl:start") < 0.5 : o.curl === "left";
  const n = points.length;
  let head: Point[] = [], tail: Point[] = [];
  // The end rolls toward the viewer's left when its heading turns toward decreasing angle.
  if (o.terminals === "end" || o.terminals === "both") tail = roll(points[n - 1], points[n - 2], endLeft ? -1 : 1);
  // The start is rolled backward, so the same physical side has the opposite sign.
  if (o.terminals === "start" || o.terminals === "both") head = roll(points[0], points[1], startLeft ? 1 : -1).reverse();
  return { points: [...head, ...points, ...tail], rollStart: head.length, rollEnd: tail.length };
}

/**
 * Cached strips for a scaffold. See the header for the construction, ranking and limits.
 */
export function quillStrips(scaffold: readonly Path[], options: QuillStripOptions): QuillStrips {
  validateStripOptions(options);
  const key = JSON.stringify([options.seed, options.spacing, options.nest, options.nestSide, options.thickness, options.clearance,
    options.resolution, options.overlap, options.terminals, options.curl, options.curlRadius, options.curlGap]);
  let byOptions = stripCache.get(scaffold);
  if (!byOptions) { byOptions = new Map(); stripCache.set(scaffold, byOptions); }
  const hit = byOptions.get(key);
  if (hit) return hit;
  const built = buildStrips(scaffold, { ...options });
  byOptions.set(key, built);
  if (byOptions.size > 6) byOptions.delete(byOptions.keys().next().value!);
  return built;
}

function buildStrips(scaffold: readonly Path[], o: QuillStripOptions): QuillStrips {
  const candidates: Candidate[] = [], nestStops: NestStop[] = [];
  let degenerate = 0, vertices = 0, rolledEnds = 0;
  const charge = (count: number, what: string) => {
    vertices += count;
    if (vertices > MAX_QUILL_VERTICES)
      throw new Error(`${what} would need ${vertices} strip vertices; the limit is ${MAX_QUILL_VERTICES}. Raise Path resolution or lower the nest rings, the scaffold size or its path count`);
    if (candidates.length > MAX_QUILL_STRIPS)
      throw new Error(`The scaffold makes more than ${MAX_QUILL_STRIPS} strips; lower the nest rings or the scaffold's path count`);
  };
  scaffold.forEach((source, sourceIndex) => {
    const clean = cleanPoints(source.points, source.closed);
    if (clean.length < (source.closed ? 3 : 2)) { degenerate++; return; }
    let base = subdivide(clean, source.closed, o.resolution), rollStart = 0, rollEnd = 0;
    if (!source.closed && o.terminals !== "none") {
      ({ points: base, rollStart, rollEnd } = withRolls(source, base, o));
      rolledEnds += (rollStart > 0 ? 1 : 0) + (rollEnd > 0 ? 1 : 0);
    }
    candidates.push({ source, sourceIndex, ring: 0, points: base, closed: source.closed, rollStart, rollEnd });
    charge(base.length, `Path ${source.id}`);
    if (!source.closed || o.nest === 0) return;
    const inward = signedArea(clean) > 0 ? 1 : -1;
    const wanted: Array<{ sign: 1 | -1; open: boolean }> = [
      { sign: 1, open: o.nestSide !== "outward" }, { sign: -1, open: o.nestSide !== "inward" }];
    for (const { sign, open } of wanted) {
      for (let k = 1; open && k <= o.nest; k++) {
        const distance = inward * sign * k * o.spacing;
        let ring: Point[] | null = null, reason: string | null;
        try {
          ring = offsetPolyline2D({ points: clean, closed: true, distance, miterLimit: MITER_LIMIT, maxWork: clean.length * 4 + 16 }).points as unknown as Point[];
          reason = ringFault(clean, ring, distance);
        } catch (error) { reason = `offset failed (${(error as Error).message})`; }
        if (reason !== null || ring === null) { nestStops.push({ source: source.id, ring: sign * k, reason: reason ?? "collapsed" }); break; }
        const points = subdivide(ring, true, o.resolution);
        candidates.push({ source, sourceIndex, ring: sign * k, points, closed: true, rollStart: 0, rollEnd: 0 });
        charge(points.length, `Ring ${sign * k} of ${source.id}`);
      }
    }
  });
  candidates.sort((a, b) => Math.abs(a.ring) - Math.abs(b.ring) || b.ring - a.ring || a.sourceIndex - b.sourceIndex);

  const r = o.thickness + o.clearance, limit = r * CLEAR_TOLERANCE, window = 2 * r + o.resolution;
  const grid = new SegmentGrid(2 * Math.max(r, o.resolution));
  const strips: QuillStrip[] = [], clashes: StripClash[] = [];
  let tests = 0, trimmed = 0, slivers = 0;
  candidates.forEach((candidate, rank) => {
    const { points, closed } = candidate, n = points.length, segments = closed ? n : n - 1;
    const arcs = new Array<number>(segments + 1);
    arcs[0] = 0;
    for (let j = 0; j < segments; j++) {
      const a = points[j], b = points[(j + 1) % n];
      arcs[j + 1] = arcs[j] + Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    const total = arcs[segments], keep = new Array<boolean>(segments), ids = new Array<number>(segments).fill(-1);
    for (let j = 0; j < segments; j++) {
      const a = points[j], b = points[(j + 1) % n];
      let clash = false;
      grid.near(a[0], a[1], b[0], b[1], r, (id) => {
        if (grid.owner[id] === rank) {
          let gap = Math.abs(grid.arc[id] - arcs[j]);
          if (closed) gap = Math.min(gap, total - gap);
          if (gap < window) return;
        }
        if (++tests > MAX_CLASH_TESTS) throw new Error(`Overlap checking exceeded ${MAX_CLASH_TESTS} segment tests; raise Path resolution or lower the nest rings or scaffold size`);
        if (segmentDistance(a[0], a[1], b[0], b[1], grid.ax[id], grid.ay[id], grid.bx[id], grid.by[id]) < limit) {
          clash = true;
          if (clashes.length < 24) clashes.push({ a: candidate.source.id, b: candidates[grid.owner[id]].source.id, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 });
          return true;
        }
      });
      keep[j] = !clash;
      if (clash) trimmed++;
      else ids[j] = grid.add(a[0], a[1], b[0], b[1], rank, arcs[j]);
    }
    // A roll that touches something is cut at its first contact: the turns beyond it would only be detached arcs.
    if (candidate.rollEnd > 0) {
      const from = keep.findIndex((kept, j) => !kept && j >= n - candidate.rollEnd);
      if (from >= 0) for (let j = from; j < segments; j++) if (keep[j]) { keep[j] = false; trimmed++; if (ids[j] >= 0) grid.alive[ids[j]] = false; }
    }
    if (candidate.rollStart > 0) {
      let last = -1;
      for (let j = 0; j < candidate.rollStart; j++) if (!keep[j]) last = j;
      for (let j = 0; j < last; j++) if (keep[j]) { keep[j] = false; trimmed++; if (ids[j] >= 0) grid.alive[ids[j]] = false; }
    }
    const runs = keptRuns(keep, closed);
    let piece = 0;
    const base = `${candidate.source.id}${candidate.ring === 0 ? "" : `/nest:${candidate.ring > 0 ? "+" : ""}${candidate.ring}`}`;
    for (const run of runs) {
      const vertexCount = run.wholeLoop ? n : run.count + 1;
      const piecePoints: Point[] = [];
      for (let v = 0; v < vertexCount; v++) piecePoints.push(points[(run.start + v) % n]);
      let length = 0;
      for (let v = 0; v + 1 < piecePoints.length; v++) length += Math.hypot(piecePoints[v + 1][0] - piecePoints[v][0], piecePoints[v + 1][1] - piecePoints[v][1]);
      if (!run.wholeLoop && (piecePoints.length < 3 || length < 2 * r)) {
        slivers++;
        for (let s = 0; s < run.count; s++) { const id = ids[(run.start + s) % segments]; if (id >= 0) grid.alive[id] = false; }
        continue;
      }
      const id = `${base}#${piece++}`;
      strips.push(Object.freeze({
        id, seed: componentSeed(o.seed, id, "strip"), source: candidate.source.id, sourceIndex: candidate.sourceIndex,
        ring: candidate.ring, piece: piece - 1, closed: run.wholeLoop, heightUnit: unit(o.seed, candidate.source.id, "height"),
        level: candidate.source.level, levelFraction: candidate.source.levelFraction,
        points: Object.freeze(piecePoints.map(([x, y]) => Object.freeze([x, y] as const))),
        rolled: Object.freeze({ start: candidate.rollStart > 0 && !run.wholeLoop && run.start === 0, end: candidate.rollEnd > 0 && !run.wholeLoop && run.start + run.count === n - 1 }),
      }));
    }
  });
  if (o.overlap === "reject" && trimmed > 0) {
    const first = clashes[0];
    throw new Error(`Strips overlap along ${trimmed} segments (first: ${first.a} and ${first.b} near ${first.x.toFixed(1)}, ${first.y.toFixed(1)}); raise Strip spacing, lower Paper thickness or Clearance, or trim the overlaps instead of rejecting them`);
  }
  return Object.freeze({
    options: Object.freeze(o), strips: Object.freeze(strips),
    diagnostics: Object.freeze({ scaffoldPaths: scaffold.length, degeneratePaths: degenerate, candidates: candidates.length, vertices, rolledEnds,
      nestStops: Object.freeze(nestStops), trimmedSegments: trimmed, droppedSlivers: slivers, clashes: Object.freeze(clashes) }),
  });
}

interface Run { start: number; count: number; wholeLoop: boolean }
/** Maximal runs of consecutive kept segments; a closed strip that loses nothing is one whole loop. */
function keptRuns(keep: readonly boolean[], closed: boolean): Run[] {
  const n = keep.length, runs: Run[] = [];
  if (keep.every(Boolean)) return closed ? [{ start: 0, count: n, wholeLoop: true }] : [{ start: 0, count: n, wholeLoop: false }];
  // Start just after a dropped segment so no run wraps the array end.
  const first = closed ? keep.indexOf(false) + 1 : 0;
  let run: Run | null = null;
  for (let step = 0; step < n; step++) {
    const j = (first + step) % n;
    if (keep[j]) {
      if (!run) run = { start: j, count: 0, wholeLoop: false };
      run.count++;
    } else if (run) { runs.push(run); run = null; }
  }
  if (run) runs.push(run);
  return runs;
}
