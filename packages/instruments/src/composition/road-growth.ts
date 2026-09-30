import { canonicalKey, elementId, type Simulation, type SimulationContext, type SimulationLimits } from "./snapshots.js";
import { roadField, type RoadField, type RoadFieldKind } from "./road-field.js";

/**
 * Street growth as a stepped simulation (foundation F7): the road network of brief 43.
 *
 * MODEL. The network is a planar straight-line graph in the site's local frame (canvas units, the
 * site centre at the origin, y down, width × height). One step is one attempt to add ONE street:
 *
 *  1. Choose an origin. The first `anchors` steps use the anchor points (a ring of `anchors` points
 *     `anchorSpread` of the way to the site edge, turned by `anchorAngle`). Every later step draws
 *     PROBES points from the street's own stream and takes the one with the most room: its clearance
 *     (distance to the nearest road or the site edge, capped at twice the local block scale) divided by
 *     the local block scale `blockSize / 2 × scale(x, y)`; it must reach 1. Scale is 1 far from the
 *     focus and `focusScale` at it (smoothstep over `focusReach`), so blocks shrink toward a centre.
 *     If no probe has room, one of SWEEP_BANDS bands of an exhaustive lattice is scanned instead; a
 *     lattice point with room becomes the origin, and when every band is empty growth is DONE.
 *  2. Choose a direction. Anchors take the guide field's along (even index) or across (odd) direction.
 *     Otherwise the field direction (along or across, turned by the street's wobble) most
 *     perpendicular to the nearest road, so a new street splits the block it starts in.
 *  3. Trace both ways from the origin with RK2 steps of length h through the field, keeping heading.
 *     A trace ends at the first road it meets (junction: `edge`, or an existing `node` within `snap`),
 *     at the site edge (open end, when there is no boundary road), or FAILS: it would meet a road at
 *     less than `minAngle`, meet itself, or run out of budget. With `crossings > 0` it passes through
 *     that many ordinary streets on each side before ending at the next road.
 *  4. Commit. The street is simplified (chords stay within `tol` < snap/3), every junction becomes a
 *     node (the road it meets is split there: the first half keeps its edge id, the second is a new
 *     edge), and the street's edges are appended. A street must attach to the existing network at
 *     one end at least. A failed street is dropped (`deadEnds: "drop"`) or, when the other end
 *     connected, kept as a dead-end stub (`"stub"`); either way a stalled disc around the origin
 *     excludes it from later probes, so the void it could not fill stays one large block.
 *
 * FIXED ORDER, IDS. Nodes, edges and streets are append-only; an id is its serial, allocated from
 * counters that are part of the state and never reused. Random draws come from
 * `ctx.stream("street:<serial>", purpose)`; nothing else is random. Splitting an edge shortens it
 * (`b` changes) and appends its second half; nothing is ever removed, so growing `steps` only appends.
 * Clearance only ever decreases as roads are added and stalled discs only grow, so a band found
 * empty stays empty and DONE is final: every step after it returns the state unchanged.
 *
 * PLANARITY. Every traced segment is tested against every road it could touch and against the street's
 * own earlier segments, and the junction node is created on the road it meets: no two edges cross
 * without a shared node (checked by the tests with an independent brute-force test).
 *
 * UNITS AND BOUNDS. Canvas units and degrees. Work per step is counted in grid cells and segment tests
 * (`ROAD_LIMITS.workPerStep`); steps are limited to `ROAD_LIMITS.maxSteps`; the stored state is
 * limited by the runner (`maxStateValues`). Errors name the control to change.
 */
export type RoadJunction = "tee" | "crossing" | "through";
export type DeadEndPolicy = "drop" | "stub";
export type ReserveShape = "none" | "ellipse" | "rectangle";

/** Construction parameters (initial condition and model). Appearance, placement transform and lots are not here. */
export interface RoadGrowthParams {
  readonly field: RoadFieldKind;
  readonly gridAngle: number;
  readonly spin: number;
  readonly warp: number;
  readonly fieldScale: number;
  readonly blockSize: number;
  readonly width: number;
  readonly height: number;
  readonly focusX: number;
  readonly focusY: number;
  readonly focusScale: number;
  readonly focusReach: number;
  readonly anchors: number;
  readonly anchorSpread: number;
  readonly anchorAngle: number;
  readonly wobble: number;
  readonly junction: RoadJunction;
  readonly snap: number;
  readonly minAngle: number;
  readonly deadEnds: DeadEndPolicy;
  readonly frame: boolean;
  readonly hubRadius: number;
  readonly reserve: ReserveShape;
  readonly reserveX: number;
  readonly reserveY: number;
  readonly reserveWidth: number;
  readonly reserveHeight: number;
  readonly reserveAngle: number;
}

export const ROAD_LIMITS = Object.freeze({
  /** Hard cap on growth steps (one attempted street each). */
  maxSteps: 1500,
  /** Work units one step may charge: grid cells visited, segment tests and trace steps. */
  workPerStep: 150_000,
  /** Probes drawn per step. */
  probes: 16,
  /** Exhaustive lattice bands scanned when probes find no room. */
  sweepBands: 16,
  /** Most lattice points in the exhaustive sweep. */
  sweepPoints: 6400,
  /** Most cells in the edge grid (site area / (cell size)²). */
  maxCells: 400_000,
  /** Site side limits, canvas units. */
  minSide: 40,
  maxSide: 2000,
  minBlock: 8,
});

/** Street kinds stored per street. */
export const KIND_FRAME = 0, KIND_RESERVE = 1, KIND_HUB = 2, KIND_ROUTE = 3, KIND_LINK = 4;

/** Plain, append-only state (see the model above). Positions are local canvas units. */
export interface RoadState {
  nodeX: number[]; nodeY: number[];
  edgeA: number[]; edgeB: number[]; edgeStreet: number[]; edgeBirth: number[];
  streetKind: number[]; streetBirth: number[]; streetDead: number[];
  /** Route streets born so far: the next route street is `street:<routes>`. */
  routes: number;
  anchorCursor: number;
  /** Lattice bands found empty so far. */
  sweep: number;
  done: number; doneAt: number;
  /** Attempts that produced no street (dropped or stalled). */
  failed: number;
  /** Stalled discs, flat [x, y, radius, …]. */
  stalled: number[];
  grid: Map<number, number[]>;
}

/** What history keeps per step: counts only (the network itself is in the checkpoints). */
export interface RoadProgress { readonly streets: number; readonly nodes: number; readonly edges: number; readonly failed: number; readonly done: number }

type Pt = [number, number];
type Ring = readonly Pt[];

/* ------------------------------------------------------------------------------------- model */

interface Model {
  readonly p: RoadGrowthParams;
  readonly field: RoadField;
  readonly hx: number; readonly hy: number;
  readonly cell: number; readonly cols: number; readonly rows: number;
  readonly step: number;       // trace step length
  readonly maxPoints: number;  // trace budget per direction
  readonly tol: number;        // simplification tolerance
  readonly crossings: number;
  readonly half: number;       // blockSize / 2
  readonly rings: readonly { readonly kind: number; readonly points: Ring }[];
  readonly lattice: { readonly s: number; readonly cols: number; readonly rows: number };
  readonly minAngleSin: number;
}

const radians = Math.PI / 180;
const models = new Map<string, Model>();

function fail(control: string, message: string): never { throw new Error(`${control}: ${message}`); }
function range(control: string, value: number, min: number, max: number, integer = false): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    fail(control, `must be ${integer ? "an integer " : ""}from ${min} to ${max} (got ${String(value)})`);
}

/** Reject parameters that cannot be built, naming the control. Called by `limits` and by the instrument's validation. */
export function validateRoadGrowth(p: RoadGrowthParams): void {
  if (!["grid", "radial", "spiral", "organic"].includes(p.field)) fail("Field", `unknown pattern ${String(p.field)}`);
  range("Width", p.width, ROAD_LIMITS.minSide, ROAD_LIMITS.maxSide);
  range("Height", p.height, ROAD_LIMITS.minSide, ROAD_LIMITS.maxSide);
  range("Block size", p.blockSize, ROAD_LIMITS.minBlock, 2000);
  range("Field scale", p.fieldScale, 4, 4000);
  range("Grid angle", p.gridAngle, -3600, 3600);
  range("Spiral turn", p.spin, -3600, 3600);
  range("Warp", p.warp, 0, 720);
  range("Focus X", p.focusX, -2000, 2000);
  range("Focus Y", p.focusY, -2000, 2000);
  range("Focus block scale", p.focusScale, 0.1, 1);
  range("Focus reach", p.focusReach, 1, 4000);
  range("Anchors", p.anchors, 0, 12, true);
  range("Anchor spread", p.anchorSpread, 0, 1);
  range("Anchor angle", p.anchorAngle, -3600, 3600);
  range("Wobble", p.wobble, 0, 90);
  if (!["tee", "crossing", "through"].includes(p.junction)) fail("Junction", `unknown policy ${String(p.junction)}`);
  range("Snap", p.snap, 0.5, 200);
  range("Shallowest meeting", p.minAngle, 0, 80);
  if (!["drop", "stub"].includes(p.deadEnds)) fail("Dead ends", `unknown policy ${String(p.deadEnds)}`);
  range("Hub radius", p.hubRadius, 0, 2000);
  if (!["none", "ellipse", "rectangle"].includes(p.reserve)) fail("Reserved zone", `unknown shape ${String(p.reserve)}`);
  range("Zone X", p.reserveX, -2000, 2000);
  range("Zone Y", p.reserveY, -2000, 2000);
  range("Zone width", p.reserveWidth, 0, 4000);
  range("Zone height", p.reserveHeight, 0, 4000);
  range("Zone angle", p.reserveAngle, -3600, 3600);
  const cell = Math.max(3, p.blockSize * Math.min(1, p.focusScale) / 4);
  if (p.width * p.height / (cell * cell) > ROAD_LIMITS.maxCells)
    fail("Block size", `a ${p.width} × ${p.height} site with blocks of ${p.blockSize} needs ${Math.ceil(p.width * p.height / (cell * cell))} grid cells, above ${ROAD_LIMITS.maxCells}; raise Block size or Focus block scale, or shrink the site`);
}

function clipConvex(subject: Ring, minX: number, minY: number, maxX: number, maxY: number): Pt[] {
  let poly: Pt[] = subject.map(([x, y]) => [x, y] as Pt);
  const clip = (inside: (q: Pt) => boolean, cut: (a: Pt, b: Pt) => Pt): void => {
    const out: Pt[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) out.push(cut(a, b));
    }
    poly = out;
  };
  clip((q) => q[0] >= minX, (a, b) => [minX, a[1] + (b[1] - a[1]) * (minX - a[0]) / (b[0] - a[0])]);
  clip((q) => q[0] <= maxX, (a, b) => [maxX, a[1] + (b[1] - a[1]) * (maxX - a[0]) / (b[0] - a[0])]);
  clip((q) => q[1] >= minY, (a, b) => [a[0] + (b[0] - a[0]) * (minY - a[1]) / (b[1] - a[1]), minY]);
  clip((q) => q[1] <= maxY, (a, b) => [a[0] + (b[0] - a[0]) * (maxY - a[1]) / (b[1] - a[1]), maxY]);
  return poly;
}

const ringArea = (r: Ring): number => { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
export function pointInRing(ring: Ring, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segmentsMeet(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
function ringsMeet(a: Ring, b: Ring): boolean {
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++)
    if (segmentsMeet(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
  return pointInRing(a, b[0][0], b[0][1]) || pointInRing(b, a[0][0], a[0][1]);
}

function polygon(cx: number, cy: number, rx: number, ry: number, angle: number, sides: number): Pt[] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return Array.from({ length: sides }, (_, i) => {
    const t = 2 * Math.PI * i / sides, x = rx * Math.cos(t), y = ry * Math.sin(t);
    return [cx + c * x - s * y, cy + s * x + c * y] as Pt;
  });
}

/** A rectangle as eight vertices (edge midpoints between the corners) starting at a midpoint, so links can leave from opposite midpoints. */
function rectangle(cx: number, cy: number, w: number, h: number, angle: number): Pt[] {
  const c = Math.cos(angle), s = Math.sin(angle), at = (x: number, y: number): Pt => [cx + c * x - s * y, cy + s * x + c * y];
  const corners: Pt[] = [at(w / 2, -h / 2), at(w / 2, h / 2), at(-w / 2, h / 2), at(-w / 2, -h / 2)];
  const out: Pt[] = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[(i + 3) % 4], b = corners[i];
    out.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b);
  }
  return out;
}

function buildModel(p: RoadGrowthParams, seed: number): Model {
  validateRoadGrowth(p);
  const hx = p.width / 2, hy = p.height / 2;
  const half = p.blockSize / 2;
  const smallest = half * Math.min(1, p.focusScale);
  const cell = Math.max(3, smallest / 2);
  const cols = Math.ceil(p.width / cell) + 1, rows = Math.ceil(p.height / cell) + 1;
  const step = Math.min(6, Math.max(2, p.blockSize / 16));
  const margin = Math.max(2 * p.snap, 0.25 * p.blockSize);
  const rings: { kind: number; points: Ring }[] = [];
  const fit = (points: Pt[]): Ring | null => {
    const clipped = clipConvex(points, -hx + margin, -hy + margin, hx - margin, hy - margin);
    return clipped.length >= 3 && Math.abs(ringArea(clipped)) > 4 * p.snap * p.snap ? clipped : null;
  };
  if (p.reserve !== "none" && p.reserveWidth > 0 && p.reserveHeight > 0) {
    const shape = p.reserve === "ellipse"
      ? polygon(p.reserveX, p.reserveY, p.reserveWidth / 2, p.reserveHeight / 2, p.reserveAngle * radians, 40)
      : rectangle(p.reserveX, p.reserveY, p.reserveWidth, p.reserveHeight, p.reserveAngle * radians);
    const ring = fit(shape);
    if (ring) rings.push({ kind: KIND_RESERVE, points: ring });
  }
  if ((p.field === "radial" || p.field === "spiral") && p.hubRadius > 0) {
    const ring = fit(polygon(p.focusX, p.focusY, p.hubRadius, p.hubRadius, 0, 16));
    if (ring) {
      if (rings.length > 0 && ringsMeet(rings[0].points, ring))
        fail("Hub radius", "the hub ring overlaps the reserved zone; lower Hub radius or move the zone or the focus apart");
      rings.push({ kind: KIND_HUB, points: ring });
    }
  }
  const field = roadField({ kind: p.field, angle: p.gridAngle, spin: p.spin, focus: [p.focusX, p.focusY], warp: p.warp, scale: p.fieldScale, seed });
  const spacing = Math.max(smallest / 1.5, Math.sqrt(p.width * p.height / ROAD_LIMITS.sweepPoints));
  return {
    p, field, hx, hy, cell, cols, rows, step, maxPoints: Math.ceil(2 * (p.width + p.height) / step) + 16,
    tol: Math.min(0.3, p.snap / 3), crossings: p.junction === "tee" ? 0 : p.junction === "crossing" ? 1 : 3, half, rings,
    lattice: { s: spacing, cols: Math.max(1, Math.floor(p.width / spacing)), rows: Math.max(1, Math.floor(p.height / spacing)) },
    minAngleSin: Math.sin(p.minAngle * radians),
  };
}

function modelFor(p: RoadGrowthParams, seed: number): Model {
  const key = `${canonicalKey(p)}|${seed}`;
  const hit = models.get(key);
  if (hit) { models.delete(key); models.set(key, hit); return hit; }
  const made = buildModel(p, seed);
  models.set(key, made);
  if (models.size > 8) models.delete(models.keys().next().value!);
  return made;
}

/** The exclusion rings (reserved zone, hub) of a construction, local frame: the same polygons the state's ring streets use. */
export function roadRings(p: RoadGrowthParams, seed: number): readonly { readonly kind: "reserve" | "hub"; readonly points: Ring }[] {
  return modelFor(p, seed).rings.map((r) => ({ kind: r.kind === KIND_RESERVE ? "reserve" : "hub", points: r.points }));
}

/* ------------------------------------------------------------------------------ edge grid */

interface Work { units: number }
const clampInt = (v: number, lo: number, hi: number): number => v < lo ? lo : v > hi ? hi : v;
const colOf = (m: Model, x: number): number => clampInt(Math.floor((x + m.hx) / m.cell), 0, m.cols - 1);
const rowOf = (m: Model, y: number): number => clampInt(Math.floor((y + m.hy) / m.cell), 0, m.rows - 1);

function addNode(st: RoadState, x: number, y: number): number { st.nodeX.push(x); st.nodeY.push(y); return st.nodeX.length - 1; }

function gridInsert(st: RoadState, m: Model, e: number): void {
  const a = st.edgeA[e], b = st.edgeB[e];
  const c0 = colOf(m, Math.min(st.nodeX[a], st.nodeX[b])), c1 = colOf(m, Math.max(st.nodeX[a], st.nodeX[b]));
  const r0 = rowOf(m, Math.min(st.nodeY[a], st.nodeY[b])), r1 = rowOf(m, Math.max(st.nodeY[a], st.nodeY[b]));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const key = r * m.cols + c, list = st.grid.get(key);
    if (list) list.push(e); else st.grid.set(key, [e]);
  }
}
function addEdge(st: RoadState, m: Model, a: number, b: number, street: number, birth: number): number {
  st.edgeA.push(a); st.edgeB.push(b); st.edgeStreet.push(street); st.edgeBirth.push(birth);
  const e = st.edgeA.length - 1;
  gridInsert(st, m, e);
  return e;
}
function hasEdge(st: RoadState, m: Model, a: number, b: number): boolean {
  const list = st.grid.get(rowOf(m, st.nodeY[a]) * m.cols + colOf(m, st.nodeX[a]));
  if (!list) return false;
  for (const e of list) if ((st.edgeA[e] === a && st.edgeB[e] === b) || (st.edgeA[e] === b && st.edgeB[e] === a)) return true;
  return false;
}

function pointSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): [number, number, number] {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : clampInt((( px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  const x = ax + t * dx, y = ay + t * dy;
  return [Math.hypot(px - x, py - y), x, y];
}

/** Nearest road to a point and its distance, capped: rings of grid cells until nothing nearer can exist. */
function nearestEdge(st: RoadState, m: Model, x: number, y: number, cap: number, w: Work): { d: number; edge: number } {
  const c0 = colOf(m, x), r0 = rowOf(m, y);
  let best = Infinity, edge = -1;
  const maxRing = Math.min(Math.max(m.cols, m.rows), Math.ceil(cap / m.cell) + 1);
  for (let k = 0; k <= maxRing; k++) {
    for (let r = r0 - k; r <= r0 + k; r++) {
      if (r < 0 || r >= m.rows) continue;
      const full = k === 0 || r === r0 - k || r === r0 + k, stride = full ? 1 : 2 * k;
      for (let c = c0 - k; c <= c0 + k; c += stride) {
        if (c < 0 || c >= m.cols) continue;
        w.units += 1;
        const list = st.grid.get(r * m.cols + c);
        if (!list) continue;
        for (const e of list) {
          w.units += 1;
          const a = st.edgeA[e], b = st.edgeB[e];
          const [d] = pointSegment(x, y, st.nodeX[a], st.nodeY[a], st.nodeX[b], st.nodeY[b]);
          if (d < best || (d === best && e < edge)) { best = d; edge = e; }
        }
      }
    }
    if (best <= k * m.cell || k * m.cell >= cap) break;
  }
  return { d: Math.min(best, cap), edge };
}

const localHalf = (m: Model, x: number, y: number): number => {
  const d = Math.hypot(x - m.p.focusX, y - m.p.focusY), t = clampInt(d / m.p.focusReach, 0, 1), s = t * t * (3 - 2 * t);
  return m.half * (m.p.focusScale + (1 - m.p.focusScale) * s);
};

const excluded = (st: RoadState, m: Model, x: number, y: number): boolean => {
  for (const ring of m.rings) if (pointInRing(ring.points, x, y)) return true;
  for (let i = 0; i < st.stalled.length; i += 3) if (Math.hypot(x - st.stalled[i], y - st.stalled[i + 1]) < st.stalled[i + 2]) return true;
  return false;
};

/** Room around a point as a multiple of the local half block scale, capped at 2; 0 where excluded or outside. */
function room(st: RoadState, m: Model, x: number, y: number, w: Work): { ratio: number; edge: number } {
  if (Math.abs(x) >= m.hx || Math.abs(y) >= m.hy || excluded(st, m, x, y)) return { ratio: 0, edge: -1 };
  const local = localHalf(m, x, y), near = nearestEdge(st, m, x, y, 2 * local, w);
  const clearance = Math.min(near.d, m.hx - Math.abs(x), m.hy - Math.abs(y));
  return { ratio: Math.min(2, clearance / local), edge: near.edge };
}

/* ------------------------------------------------------------------------------- tracing */

interface Vtx { x: number; y: number; edge?: number; node?: number }
interface End { kind: "edge" | "node" | "boundary" | "fail"; vertex: Vtx | null; reason?: string }
interface Own { ax: number[]; ay: number[]; bx: number[]; by: number[]; grid: Map<number, number[]> }

const cross = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;

interface Probe { t: number; edge: number; near: { edge: number; x: number; y: number } | null; self: boolean }

/** Nearest road hit by segment p→q (parameter t in (0, 1]), the road within `snap` of q, and any self-hit. */
function probeSegment(st: RoadState, m: Model, own: Own, px: number, py: number, qx: number, qy: number, skipEdge: number, w: Work): Probe {
  const snap = m.p.snap;
  const c0 = colOf(m, Math.min(px, qx) - snap), c1 = colOf(m, Math.max(px, qx) + snap);
  const r0 = rowOf(m, Math.min(py, qy) - snap), r1 = rowOf(m, Math.max(py, qy) + snap);
  const rx = qx - px, ry = qy - py;
  let bestT = Infinity, bestEdge = -1, nearD = snap, nearEdge = -1, nx = 0, ny = 0;
  const seen = new Set<number>();
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    w.units += 1;
    const list = st.grid.get(r * m.cols + c);
    if (!list) continue;
    for (const e of list) {
      if (e === skipEdge || seen.has(e)) continue;
      seen.add(e);
      w.units += 1;
      const a = st.edgeA[e], b = st.edgeB[e], ax = st.nodeX[a], ay = st.nodeY[a], sx = st.nodeX[b] - ax, sy = st.nodeY[b] - ay;
      const denom = cross(rx, ry, sx, sy);
      if (Math.abs(denom) > 1e-12) {
        const t = cross(ax - px, ay - py, sx, sy) / denom, u = cross(ax - px, ay - py, rx, ry) / denom;
        if (t > 1e-9 && t <= 1 + 1e-12 && u >= -1e-12 && u <= 1 + 1e-12 && (t < bestT || (t === bestT && e < bestEdge))) { bestT = t; bestEdge = e; }
      }
      const [d, x, y] = pointSegment(qx, qy, ax, ay, ax + sx, ay + sy);
      if (d < nearD || (d === nearD && nearEdge >= 0 && e < nearEdge)) { nearD = d; nearEdge = e; nx = x; ny = y; }
    }
  }
  let self = false;
  const oc0 = colOf(m, Math.min(px, qx)), oc1 = colOf(m, Math.max(px, qx)), or0 = rowOf(m, Math.min(py, qy)), or1 = rowOf(m, Math.max(py, qy));
  const ownSeen = new Set<number>();
  for (let r = or0; r <= or1 && !self; r++) for (let c = oc0; c <= oc1 && !self; c++) {
    const list = own.grid.get(r * m.cols + c);
    if (!list) continue;
    for (const i of list) {
      if (ownSeen.has(i)) continue;
      ownSeen.add(i);
      w.units += 1;
      // A segment that shares an end with p (the previous segment, or the other side's first one) only touches there.
      const touches = (own.ax[i] === px && own.ay[i] === py) || (own.bx[i] === px && own.by[i] === py);
      if (touches) continue;
      const sx = own.bx[i] - own.ax[i], sy = own.by[i] - own.ay[i], denom = cross(rx, ry, sx, sy);
      if (Math.abs(denom) < 1e-12) continue;
      const t = cross(own.ax[i] - px, own.ay[i] - py, sx, sy) / denom, u = cross(own.ax[i] - px, own.ay[i] - py, rx, ry) / denom;
      if (t > 1e-9 && t <= 1 + 1e-12 && u >= -1e-12 && u <= 1 + 1e-12) self = true;
    }
  }
  return { t: bestT, edge: bestEdge, near: nearEdge >= 0 ? { edge: nearEdge, x: nx, y: ny } : null, self };
}

function ownInsert(m: Model, own: Own, ax: number, ay: number, bx: number, by: number): void {
  own.ax.push(ax); own.ay.push(ay); own.bx.push(bx); own.by.push(by);
  const i = own.ax.length - 1;
  for (let r = rowOf(m, Math.min(ay, by)); r <= rowOf(m, Math.max(ay, by)); r++) for (let c = colOf(m, Math.min(ax, bx)); c <= colOf(m, Math.max(ax, bx)); c++) {
    const key = r * m.cols + c, list = own.grid.get(key);
    if (list) list.push(i); else own.grid.set(key, [i]);
  }
}

/** Sine of the angle between a heading and a road. */
function meetingSine(st: RoadState, edge: number, hx: number, hy: number): number {
  const a = st.edgeA[edge], b = st.edgeB[edge], sx = st.nodeX[b] - st.nodeX[a], sy = st.nodeY[b] - st.nodeY[a];
  return Math.abs(cross(hx, hy, sx, sy)) / (Math.hypot(hx, hy) * Math.hypot(sx, sy));
}

function endOn(st: RoadState, m: Model, own: Own, px: number, py: number, edge: number, x: number, y: number, w: Work): End {
  const a = st.edgeA[edge], b = st.edgeB[edge];
  const da = Math.hypot(x - st.nodeX[a], y - st.nodeY[a]), db = Math.hypot(x - st.nodeX[b], y - st.nodeY[b]);
  const node = da <= db ? a : b, dn = Math.min(da, db);
  if (dn <= m.p.snap) {
    // Land on the existing node when the chord to it meets nothing else.
    const probe = probeSegment(st, m, { ax: [], ay: [], bx: [], by: [], grid: new Map() }, px, py, st.nodeX[node], st.nodeY[node], -1, w);
    const clean = probe.t === Infinity || [st.edgeA[probe.edge], st.edgeB[probe.edge]].includes(node);
    if (clean) return { kind: "node", vertex: { x: st.nodeX[node], y: st.nodeY[node], node } };
  }
  return { kind: "edge", vertex: { x, y, edge } };
}

interface Trace { via: Vtx[]; end: End }

function trace(st: RoadState, m: Model, own: Own, sx: number, sy: number, d0: Pt, bias: number, w: Work): Trace {
  let px = sx, py = sy, dx = d0[0], dy = d0[1], crossed = 0, skip = -1;
  const via: Vtx[] = [], h = m.step;
  for (let k = 0; k < m.maxPoints; k++) {
    w.units += 2;
    const a = m.field.direction(px, py, [dx, dy], bias);
    const b = m.field.direction(px + a[0] * h / 2, py + a[1] * h / 2, a, bias);
    const qx = px + b[0] * h, qy = py + b[1] * h;
    let tExit = Infinity;
    if (Math.abs(qx) > m.hx || Math.abs(qy) > m.hy) {
      tExit = Math.min(qx > m.hx ? (m.hx - px) / (qx - px) : Infinity, qx < -m.hx ? (-m.hx - px) / (qx - px) : Infinity,
        qy > m.hy ? (m.hy - py) / (qy - py) : Infinity, qy < -m.hy ? (-m.hy - py) / (qy - py) : Infinity);
    }
    const probe = probeSegment(st, m, own, px, py, qx, qy, skip, w);
    skip = -1;
    if (probe.self) return { via, end: { kind: "fail", vertex: null, reason: "self" } };
    if (probe.t !== Infinity && probe.t <= tExit + 1e-9) {
      const x = px + probe.t * (qx - px), y = py + probe.t * (qy - py);
      if (meetingSine(st, probe.edge, b[0], b[1]) < m.minAngleSin) return { via, end: { kind: "fail", vertex: null, reason: "shallow" } };
      const kind = st.streetKind[st.edgeStreet[probe.edge]];
      const end = endOn(st, m, own, px, py, probe.edge, x, y, w);
      if (end.kind === "edge" && kind === KIND_ROUTE && crossed < m.crossings) {
        via.push({ x, y, edge: probe.edge });
        ownInsert(m, own, px, py, x, y);
        crossed++; skip = probe.edge; px = x; py = y; dx = b[0]; dy = b[1];
        continue;
      }
      ownInsert(m, own, px, py, end.vertex!.x, end.vertex!.y);
      return { via, end };
    }
    if (tExit !== Infinity) {
      const x = clampInt(px + tExit * (qx - px), -m.hx, m.hx), y = clampInt(py + tExit * (qy - py), -m.hy, m.hy);
      ownInsert(m, own, px, py, x, y);
      return { via, end: { kind: "boundary", vertex: { x, y } } };
    }
    // A route street the junction policy lets this street pass through is not "near": the next segment crosses it.
    if (probe.near && !(crossed < m.crossings && st.streetKind[st.edgeStreet[probe.near.edge]] === KIND_ROUTE)) {
      // A road within `snap` of the step end: meet it instead of running alongside.
      if (meetingSine(st, probe.near.edge, b[0], b[1]) < m.minAngleSin) return { via, end: { kind: "fail", vertex: null, reason: "shallow" } };
      const chord = probeSegment(st, m, own, px, py, probe.near.x, probe.near.y, probe.near.edge, w);
      if (chord.t === Infinity && !chord.self) {
        const end = endOn(st, m, own, px, py, probe.near.edge, probe.near.x, probe.near.y, w);
        ownInsert(m, own, px, py, end.vertex!.x, end.vertex!.y);
        return { via, end };
      }
    }
    via.push({ x: qx, y: qy });
    ownInsert(m, own, px, py, qx, qy);
    px = qx; py = qy; dx = b[0]; dy = b[1];
  }
  return { via, end: { kind: "fail", vertex: null, reason: "long" } };
}

function simplify(points: readonly Vtx[], tol: number): Vtx[] {
  const keep = new Uint8Array(points.length);
  const fixed = (v: Vtx): boolean => v.edge !== undefined || v.node !== undefined;
  keep[0] = 1; keep[points.length - 1] = 1;
  points.forEach((v, i) => { if (fixed(v)) keep[i] = 1; });
  const run = (lo: number, hi: number): void => {
    if (hi - lo < 2) return;
    let worst = -1, at = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = pointSegment(points[i].x, points[i].y, points[lo].x, points[lo].y, points[hi].x, points[hi].y)[0];
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tol) { keep[at] = 1; run(lo, at); run(at, hi); }
  };
  let lo = 0;
  for (let i = 1; i < points.length; i++) if (keep[i]) { run(lo, i); lo = i; }
  return points.filter((_, i) => keep[i]);
}

/* --------------------------------------------------------------------------------- commit */

/** The node at `(x, y)` on the road `hint`: the road's end when it is that close, otherwise the road is split there. */
function splitAt(st: RoadState, m: Model, hint: number, x: number, y: number, birth: number): number {
  let best = hint, bestD = Infinity;
  const list = st.grid.get(rowOf(m, y) * m.cols + colOf(m, x)) ?? [];
  for (const e of [hint, ...list]) {
    const a = st.edgeA[e], b = st.edgeB[e], d = pointSegment(x, y, st.nodeX[a], st.nodeY[a], st.nodeX[b], st.nodeY[b])[0];
    if (d < bestD - 1e-12) { bestD = d; best = e; }
  }
  const a = st.edgeA[best], b = st.edgeB[best];
  for (const n of [a, b]) if (Math.hypot(x - st.nodeX[n], y - st.nodeY[n]) < 1e-7) return n;
  const node = addNode(st, x, y);
  st.edgeB[best] = node;
  addEdge(st, m, node, b, st.edgeStreet[best], st.edgeBirth[best]);
  return node;
}

function commit(st: RoadState, m: Model, vertices: readonly Vtx[], birth: number, dead: boolean, kind = KIND_ROUTE): boolean {
  const ids: number[] = [];
  const street = st.streetKind.length;
  st.streetKind.push(kind); st.streetBirth.push(birth); st.streetDead.push(dead ? 1 : 0);
  for (const v of vertices) ids.push(v.node !== undefined ? v.node : v.edge !== undefined ? splitAt(st, m, v.edge, v.x, v.y, birth) : addNode(st, v.x, v.y));
  let added = 0;
  for (let i = 0; i + 1 < ids.length; i++) {
    if (ids[i] === ids[i + 1] || hasEdge(st, m, ids[i], ids[i + 1])) continue;
    addEdge(st, m, ids[i], ids[i + 1], street, birth);
    added++;
  }
  if (added === 0) { st.streetKind.pop(); st.streetBirth.pop(); st.streetDead.pop(); return false; }
  if (kind === KIND_ROUTE) st.routes += 1;
  return true;
}

/* ---------------------------------------------------------------------------- simulation */

const anchorPoint = (m: Model, i: number): Pt => {
  const angle = m.p.anchorAngle * radians + 2 * Math.PI * i / m.p.anchors, r = m.p.anchorSpread * Math.min(m.hx, m.hy);
  return [r * Math.cos(angle), r * Math.sin(angle)];
};

function growStreet(st: RoadState, m: Model, ctx: SimulationContext<RoadGrowthParams>, x: number, y: number, anchor: number, nearEdge: number, w: Work): boolean {
  const id = elementId("street", st.routes);
  const wobble = (ctx.stream(id, "wobble").next() * 2 - 1) * m.p.wobble * radians;
  const field = m.field;
  const along = field.direction(x, y, [1, 0], wobble), crossDir = [-along[1], along[0]] as Pt;
  let d0: Pt = along;
  if (anchor >= 0) d0 = anchor % 2 === 0 ? along : crossDir;
  else if (nearEdge >= 0) {
    const a = st.edgeA[nearEdge], b = st.edgeB[nearEdge], tx = st.nodeX[b] - st.nodeX[a], ty = st.nodeY[b] - st.nodeY[a], len = Math.hypot(tx, ty);
    const dotAlong = Math.abs(along[0] * tx + along[1] * ty) / len, dotAcross = Math.abs(crossDir[0] * tx + crossDir[1] * ty) / len;
    d0 = dotAcross < dotAlong ? crossDir : along;
  }
  const own: Own = { ax: [], ay: [], bx: [], by: [], grid: new Map() };
  const forward = trace(st, m, own, x, y, d0, wobble, w);
  const backward = trace(st, m, own, x, y, [-d0[0], -d0[1]], wobble, w);
  const tagged = (t: Trace): boolean => t.via.some((v) => v.edge !== undefined) || t.end.kind === "edge" || t.end.kind === "node";
  const connected = tagged(forward) || tagged(backward);
  const failed = forward.end.kind === "fail" || backward.end.kind === "fail";
  const alone = st.edgeA.length === 0;
  let keep = connected || alone;
  if (failed && (m.p.deadEnds === "drop" || !connected)) keep = false;
  if (!keep) return false;
  const chain: Vtx[] = [];
  for (let i = backward.via.length - 1; i >= 0; i--) chain.push(backward.via[i]);
  if (backward.end.vertex) chain.unshift(backward.end.vertex);
  chain.push({ x, y });
  for (const v of forward.via) chain.push(v);
  if (forward.end.vertex) chain.push(forward.end.vertex);
  if (chain.length < 2) return false;
  return commit(st, m, simplify(chain, m.tol), ctx.step, failed);
}

function candidate(st: RoadState, m: Model, ctx: SimulationContext<RoadGrowthParams>, streamId: string, w: Work): { x: number; y: number; edge: number } | null {
  const stream = ctx.stream(streamId, "probe");
  let best: { x: number; y: number; edge: number } | null = null, bestRatio = 0;
  for (let i = 0; i < ROAD_LIMITS.probes; i++) {
    const x = (stream.next() * 2 - 1) * m.hx, y = (stream.next() * 2 - 1) * m.hy;
    const r = room(st, m, x, y, w);
    if (r.ratio >= 1 && r.ratio > bestRatio) { bestRatio = r.ratio; best = { x, y, edge: r.edge }; }
  }
  return best;
}

/** One band of the exhaustive lattice: the point with the most room, ties to the lowest row-major index. */
function sweepBand(st: RoadState, m: Model, band: number, w: Work): { x: number; y: number; edge: number } | null {
  const { cols, rows } = m.lattice, bands = ROAD_LIMITS.sweepBands;
  const first = Math.floor(rows * band / bands), last = Math.floor(rows * (band + 1) / bands);
  let best: { x: number; y: number; edge: number } | null = null, bestRatio = 0;
  for (let j = first; j < last; j++) for (let i = 0; i < cols; i++) {
    const x = -m.hx + (i + 0.5) * m.p.width / cols, y = -m.hy + (j + 0.5) * m.p.height / rows;
    const r = room(st, m, x, y, w);
    if (r.ratio >= 1 && r.ratio > bestRatio) { bestRatio = r.ratio; best = { x, y, edge: r.edge }; }
  }
  return best;
}

function ringStreet(st: RoadState, m: Model, kind: number, points: Ring): void {
  const street = st.streetKind.length;
  st.streetKind.push(kind); st.streetBirth.push(0); st.streetDead.push(0);
  const ids = points.map(([x, y]) => addNode(st, x, y));
  for (let i = 0; i < ids.length; i++) addEdge(st, m, ids[i], ids[(i + 1) % ids.length], street, 0);
}

/** Two straight links from a ring outward (from its first vertex and the opposite one, along the guide field) to the first road each meets. */
function linkRing(st: RoadState, m: Model, ring: Ring, firstNode: number): void {
  let cx = 0, cy = 0;
  for (const [x, y] of ring) { cx += x; cy += y; }
  cx /= ring.length; cy /= ring.length;
  const w: Work = { units: 0 }, own: Own = { ax: [], ay: [], bx: [], by: [], grid: new Map() };
  for (const index of [0, Math.floor(ring.length / 2)]) {
    const [x, y] = ring[index], length = Math.hypot(x - cx, y - cy) || 1, reach = 2 * (m.p.width + m.p.height);
    // Leave along the guide field's direction that points most nearly away from the ring.
    const [dx, dy] = m.field.direction(x, y, [(x - cx) / length, (y - cy) / length]);
    const qx = x + dx * reach, qy = y + dy * reach;
    const hit = probeSegment(st, m, own, x, y, qx, qy, -1, w);
    if (hit.t === Infinity) continue;
    const hx = x + hit.t * (qx - x), hy = y + hit.t * (qy - y);
    const end = endOn(st, m, own, x, y, hit.edge, hx, hy, w);
    commit(st, m, [{ x, y, node: firstNode + index }, end.vertex!], 0, false, KIND_LINK);
  }
}

export const roadSimulation: Simulation<RoadState, RoadGrowthParams, RoadProgress> = {
  id: "roads-parcels/growth",
  limits(params): SimulationLimits {
    validateRoadGrowth(params);
    return { stepLimit: ROAD_LIMITS.maxSteps, workPerStep: ROAD_LIMITS.workPerStep, initialWork: 10_000 };
  },
  initial(ctx) {
    const m = modelFor(ctx.params, ctx.seed);
    const st: RoadState = { nodeX: [], nodeY: [], edgeA: [], edgeB: [], edgeStreet: [], edgeBirth: [], streetKind: [], streetBirth: [], streetDead: [],
      routes: 0, anchorCursor: 0, sweep: 0, done: 0, doneAt: -1, failed: 0, stalled: [], grid: new Map() };
    if (ctx.params.frame) ringStreet(st, m, KIND_FRAME, [[-m.hx, -m.hy], [m.hx, -m.hy], [m.hx, m.hy], [-m.hx, m.hy]]);
    const starts: number[] = [];
    for (const ring of m.rings) { starts.push(st.nodeX.length); ringStreet(st, m, ring.kind, ring.points); }
    // An inner ring is joined to what surrounds it by two links, so no block ever has a bridge inside it.
    if (ctx.params.frame) m.rings.forEach((ring, index) => linkRing(st, m, ring.points, starts[index]));
    return st;
  },
  step(st, ctx) {
    if (st.done) return st;
    const m = modelFor(ctx.params, ctx.seed), w: Work = { units: 0 };
    const streamId = elementId("street", st.routes);
    let origin: { x: number; y: number; edge: number } | null = null, anchor = -1;
    while (!origin && st.anchorCursor < m.p.anchors) {
      const index = st.anchorCursor++, [x, y] = anchorPoint(m, index);
      const r = room(st, m, x, y, w);
      if (r.ratio > 0 && (r.edge < 0 || r.ratio * localHalf(m, x, y) > m.p.snap * 2)) { origin = { x, y, edge: r.edge }; anchor = index; }
    }
    if (!origin) origin = candidate(st, m, ctx, streamId, w);
    if (!origin) {
      origin = sweepBand(st, m, st.sweep, w);
      if (!origin) { st.sweep += 1; if (st.sweep >= ROAD_LIMITS.sweepBands) { st.done = 1; st.doneAt = ctx.step; } }
    }
    if (origin && !growStreet(st, m, ctx, origin.x, origin.y, anchor, origin.edge, w)) {
      st.failed += 1;
      st.stalled.push(origin.x, origin.y, 0.75 * localHalf(m, origin.x, origin.y));
    }
    ctx.charge(w.units);
    return st;
  },
  project(st): RoadProgress {
    return { streets: st.routes, nodes: st.nodeX.length, edges: st.edgeA.length, failed: st.failed, done: st.done };
  },
};
