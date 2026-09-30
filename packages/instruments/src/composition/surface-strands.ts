/**
 * Evenly spaced strands ON a mesh, and where they cross (brief 52; camera free).
 *
 * PRODUCER `traceStrands(mesh, family)`: given a per-vertex unit direction field and a per-vertex target spacing
 * (surface distance, world units), returns frozen `SurfaceStrand`s that follow the field, keep about the local spacing
 * from one another, and lie exactly on the surface.
 *
 * ALGORITHM (evenly spaced streamlines after Jobard and Lefer, on a triangle mesh):
 *  1. A strand is traced from a seed both ways with `stepRK2` (midpoint rule, unfolding across edges; see `mesh-trace.ts`),
 *     each step `STEP` = 0.35 of the local spacing long. Every step end is a SAMPLE; every edge crossing inside a step is
 *     also a vertex, so each segment of a strand lies in one known triangle.
 *  2. A strand stops (and `ends` says why) at a boundary edge (`boundary`), where the surface is nearer the boundary than
 *     the margin (`margin`), when a step end comes nearer than `TEST` = 0.5 of the local spacing to a sample of an
 *     EARLIER strand seen on the same side of the surface (`proximity`: unit normals agree by more than 0.3, so two sheets
 *     of a fold or the two walls of a thin vessel never stop each other), at a critical point of the field (`singular`), or
 *     after `MAX_STEPS` steps (`limit`). Returning to its own seed closes it (`closed`): a ring around a peak, the vase or the torus.
 *  3. New seeds come from the accepted strands: for every step end, the points 1 and 0.65 local spacings away on either side
 *     (walked across the surface perpendicular to the strand). A candidate nearer than 0.6 of the spacing to an existing sample
 *     is discarded (a seed drawn from the surface sample needs a full spacing). Where the strands diverge (a meridian family away from the poles) the first offset fills gaps of 1.6
 *     spacings or more and the second gaps of 1.25 or more, so neighbouring strands end up between 0.6 and about 1.25
 *     spacings apart, exactly one spacing on a developable surface where the field is parallel. When no candidate is left, seeds are drawn from `sampleSurface` (`even`, prefix property) so a region no
 *     strand reached (a second component, the far side of a critical point) is still covered.
 *  4. A strand shorter than `MIN_LENGTH` = 3 local spacings that is not closed is dropped.
 * The order of everything is fixed (queue order, then strand order), so the same input gives bit-identical strands, and ids
 * `A<k>` / `B<k>` are the acceptance order. Ids are NOT stable across structural edits (they are re-solved by design);
 * they never depend on the camera or on any drawing setting.
 *
 * EDGE TERMINATION. `margin` (world units) keeps strand ends that far from a boundary edge (graph distance to the
 * boundary; see `boundaryDistance`); 0 lets a strand run to the edge. With `fringe`, each strand end stops at a seeded
 * random distance of 0 to 2 `margin` instead (`componentSeed(seed, id, "fringe")`), the ragged edge of cloth. A closed mesh has no edge.
 *
 * WORK. Steps are counted; more than `STRAND_LIMITS.vertices` strand vertices in one construction throws naming the thread
 * spacing. `estimateStrandVertices` gives the same bound from the fields alone before anything is traced. Crossings are
 * limited to `STRAND_LIMITS.crossings`.
 *
 * CROSSINGS (`surfaceCrossings`). Two strands cross where their segments meet inside one triangle: found exactly in the
 * triangle's plane (a segment pair is tested only when both lie in the same triangle, so the search is linear in the
 * number of segments). Each crossing has its 3D position, triangle, the arc length along both strands (surface distance),
 * the angle between the strands ON the surface, and the id `<A>@<s>~<B>@<s>` (4 decimals). It is camera free: nothing
 * about the view enters. Crossings of one strand pair closer than 1e-7 of the surface scale in arc length are one (a crossing
 * exactly on an edge is met in both triangles). Parallel or collinear segments produce no crossing, and strands of one
 * family that touch are not reported. `surfaceCrossingSet` presents them as a `CrossingSet` whose paths are the strands
 * developed onto their own arc length (`(s, 0)`), so the order module can decide over and under with the exact rule and
 * seeded phase of Crossing Lace, independent of any camera.
 */
import { componentSeed } from "./core.js";
import type { CrossingSet, Crossing } from "./crossings.js";
import { sampleSource, sampleSurface } from "./mesh-sample.js";
import { boundaryDistance, fieldDirection, interpolate, lastStep, stepRK2, traceGraph, walk, walker, type TraceGraph, type Walker } from "./mesh-trace.js";
import { meshDerived, type Mesh, type Vec3 } from "./mesh.js";
import type { Path } from "./types.js";

export const STRAND_LIMITS = Object.freeze({ vertices: 300_000, crossings: 30_000, maxSteps: 5_000 });
const STEP = 0.35, TEST = 0.5, SEED_CLEAR = 0.6, OFFSETS = [1, 0.65], MIN_LENGTH = 3, CLOSE = 1.2, NORMAL_AGREEMENT = 0.3, U32 = 0x1_0000_0000;

export type StrandEnd = "boundary" | "margin" | "proximity" | "singular" | "limit" | "closed";
/** Internal: a curve that turned 1.5 times faster than one turn per 8 steps of radius without closing circles a critical point and is discarded. */
type TraceEnd = StrandEnd | "whirl";
export interface SurfaceStrand {
  /** `A<k>` or `B<k>`, `k` the acceptance order within its family. */
  readonly id: string;
  readonly family: 0 | 1;
  readonly seed: number;
  /** World-space vertices on the surface. A closed strand does not repeat its first vertex. */
  readonly points: readonly Vec3[];
  /** The triangle each segment lies in (`points.length - 1` entries, or `points.length` when closed: the last closes the ring). */
  readonly triangles: readonly number[];
  readonly closed: boolean;
  /** Arc length at each vertex (surface distance, world units); entry 0 is 0. */
  readonly cumulative: readonly number[];
  /** Total length, including the closing segment of a closed strand. */
  readonly length: number;
  /** Mean target spacing along the strand (world units): what its thread width is a share of. */
  readonly spacing: number;
  /** Why each end stopped (backward then forward); `"closed"` for both on a ring. */
  readonly ends: readonly [StrandEnd, StrandEnd];
}

export interface FamilyOptions {
  /** Unit direction per vertex (3 per vertex), or zero where undefined. */
  readonly vectors: Float64Array;
  /** Target spacing per vertex, world units. */
  readonly spacing: Float64Array;
  readonly family: 0 | 1;
  readonly seed: number;
  /** World units; 0 lets strands run to a boundary. */
  readonly margin: number;
  readonly fringe: boolean;
  /** Vertices still allowed in the construction (shared by both families). */
  readonly budget: number;
}

/** Vertices a construction needs at most, from the spacing field alone: `sum area / (STEP spacing^2)` per family. */
export function estimateStrandVertices(mesh: Mesh, spacing: readonly Float64Array[]): number {
  const g = traceGraph(mesh), d = meshDerived(mesh);
  let total = 0;
  for (const field of spacing) for (let t = 0; t < mesh.triangleCount; t++) {
    const s = (field[g.triangles[t * 3]] + field[g.triangles[t * 3 + 1]] + field[g.triangles[t * 3 + 2]]) / 3;
    total += d.triangleAreas[t] / (STEP * s * s);
  }
  return Math.ceil(total);
}

const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;

class SampleHash {
  private readonly cells = new Map<number, number[]>();
  readonly xs: number[] = [];
  readonly ys: number[] = [];
  readonly zs: number[] = [];
  readonly triangles: number[] = [];
  constructor(private readonly size: number) {}
  private key(ix: number, iy: number, iz: number): number { return ((ix + 65536) * 131072 + (iy + 65536)) * 131072 + (iz + 65536); }
  add(x: number, y: number, z: number, triangle: number): void {
    const k = this.key(Math.floor(x / this.size), Math.floor(y / this.size), Math.floor(z / this.size)), id = this.xs.length;
    this.xs.push(x); this.ys.push(y); this.zs.push(z); this.triangles.push(triangle);
    const cell = this.cells.get(k);
    if (cell) cell.push(id); else this.cells.set(k, [id]);
  }
  /** Whether a sample within `radius` lies on the same side of the surface as a point with unit normal `n`. */
  near(x: number, y: number, z: number, radius: number, normals: Float64Array, triangle: number): boolean {
    const r2 = radius * radius, nx = normals[triangle * 3], ny = normals[triangle * 3 + 1], nz = normals[triangle * 3 + 2];
    const x0 = Math.floor((x - radius) / this.size), x1 = Math.floor((x + radius) / this.size);
    const y0 = Math.floor((y - radius) / this.size), y1 = Math.floor((y + radius) / this.size);
    const z0 = Math.floor((z - radius) / this.size), z1 = Math.floor((z + radius) / this.size);
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) for (let iz = z0; iz <= z1; iz++) {
      const cell = this.cells.get(this.key(ix, iy, iz));
      if (!cell) continue;
      for (const id of cell) {
        const dx = this.xs[id] - x, dy = this.ys[id] - y, dz = this.zs[id] - z;
        if (dx * dx + dy * dy + dz * dz >= r2) continue;
        const t = this.triangles[id];
        if (normals[t * 3] * nx + normals[t * 3 + 1] * ny + normals[t * 3 + 2] * nz > NORMAL_AGREEMENT) return true;
      }
    }
    return false;
  }
}

interface Trace { pts: number[]; tris: number[]; steps: number[]; end: TraceEnd; closed: boolean }
interface Raw { pts: number[]; tris: number[]; steps: number[]; closed: boolean; ends: [StrandEnd, StrandEnd] }

/** Trace the strands of one family over the whole mesh. */
export function traceStrands(mesh: Mesh, options: FamilyOptions): readonly SurfaceStrand[] {
  const g = traceGraph(mesh), { vectors, spacing, family, seed, margin, fringe } = options;
  const V = mesh.vertexCount;
  if (vectors.length !== V * 3 || spacing.length !== V) throw new Error(`Strand fields need one entry per vertex (${V}); got ${vectors.length / 3} directions and ${spacing.length} spacings`);
  let low = Infinity, high = 0;
  for (let v = 0; v < V; v++) if (spacing[v] > 0) { low = Math.min(low, spacing[v]); high = Math.max(high, spacing[v]); }
  if (!(low > 0) || !Number.isFinite(high)) throw new Error("Strand spacing must be positive at every vertex");
  const edge = margin > 0 ? boundaryDistance(g) : null;
  const hash = new SampleHash(Math.sqrt(low * high));
  const raw: Raw[] = [], queue: number[] = [];
  let vertices = 0, head = 0;
  const w = walker(), probe = walker(), heading = new Float64Array(3), events: number[] = [];

  const spacingAt = (at: Walker): number => interpolate(g, spacing, at);
  const usable = (at: Walker, ds: number, edgeMargin: number, clear: number): boolean =>
    (edgeMargin <= 0 || edge === null || interpolate(g, edge, at) >= edgeMargin) && !hash.near(at.p[0], at.p[1], at.p[2], clear * ds, g.normals, at.tri);

  const closing = (at: Walker, start: Walker, h: number): boolean =>
    Math.hypot(at.p[0] - start.p[0], at.p[1] - start.p[1], at.p[2] - start.p[2]) < CLOSE * h && at.d[0] * start.d[0] + at.d[1] * start.d[1] + at.d[2] * start.d[2] > 0;

  function follow(start: Walker, sign: 1 | -1, index: number, side: number): Trace {
    const at = walker(start.tri);
    at.p.set(start.p); at.d[0] = sign * start.d[0]; at.d[1] = sign * start.d[1]; at.d[2] = sign * start.d[2];
    const trace: Trace = { pts: [], tris: [], steps: [], end: "limit", closed: false };
    const edgeMargin = margin > 0 && fringe ? margin * 2 * unit(seed, `${family}:${index}`, `fringe${side}`) : margin;
    let travelled = 0, wound = 0;
    for (let step = 0; step < STRAND_LIMITS.maxSteps; step++) {
      const ds = spacingAt(at), h = STEP * ds, before = trace.pts.length / 3;
      events.length = 0;
      const result = stepRK2(g, vectors, at, h, events);
      if (result === "singular" || result === "stuck") { trace.end = "singular"; return trace; }
      for (let e = 0; e < events.length; e += 4) { trace.pts.push(events[e], events[e + 1], events[e + 2]); trace.tris.push(events[e + 3]); }
      trace.pts.push(at.p[0], at.p[1], at.p[2]); trace.tris.push(at.tri);
      vertices += events.length / 4 + 1;
      if (vertices > options.budget) throw new Error(`Thread spacing is too fine for this surface: more than ${options.budget} strand vertices. Raise Thread spacing, lower Density ratio or lower the surface detail`);
      if (result === "boundary") { trace.steps.push(trace.pts.length / 3 - 1); trace.end = "boundary"; return trace; }
      const rollback = (end: TraceEnd): Trace => { trace.pts.length = before * 3; trace.tris.length = before; trace.end = end; return trace; };
      if (edgeMargin > 0 && edge !== null && interpolate(g, edge, at) < edgeMargin) return rollback("margin");
      if (hash.near(at.p[0], at.p[1], at.p[2], TEST * ds, g.normals, at.tri)) return rollback("proximity");
      trace.steps.push(trace.pts.length / 3 - 1);
      travelled += h; wound += lastStep.turn;
      if (Math.abs(wound) > 3 * Math.PI && travelled < 8 * h * Math.abs(wound) && !(sign === 1 && travelled > 3 * h && closing(at, start, h))) { trace.end = "whirl"; return trace; }
      if (sign === 1 && travelled > 3 * h) {
        if (closing(at, start, h)) { trace.closed = true; trace.end = "closed"; return trace; }
      }
    }
    return trace;
  }

  function accept(start: Walker, ds: number): void {
    const index = raw.length;
    const forward = follow(start, 1, index, 1);
    if (forward.end === "whirl") { vertices -= forward.pts.length / 3; return; }
    const backward: Trace = forward.closed ? { pts: [], tris: [], steps: [], end: "closed", closed: false } : follow(start, -1, index, 0);
    if (backward.end === "whirl") { vertices -= backward.pts.length / 3 + forward.pts.length / 3; return; }
    const nb = backward.pts.length / 3, pts: number[] = [], tris: number[] = [], steps: number[] = [];
    for (let j = nb - 1; j >= 0; j--) pts.push(backward.pts[j * 3], backward.pts[j * 3 + 1], backward.pts[j * 3 + 2]);
    for (let j = nb - 1; j >= 0; j--) tris.push(backward.tris[j]);
    for (const s of backward.steps) steps.push(nb - 1 - s);
    steps.reverse();
    pts.push(start.p[0], start.p[1], start.p[2]); steps.push(nb);
    for (let j = 0; j < forward.pts.length; j++) pts.push(forward.pts[j]);
    for (const t of forward.tris) tris.push(t);
    for (const s of forward.steps) steps.push(nb + 1 + s);
    if (forward.closed) tris.push(tris[tris.length - 1] ?? start.tri);
    const count = pts.length / 3;
    let length = 0;
    for (let k = 1; k < count; k++) length += Math.hypot(pts[k * 3] - pts[k * 3 - 3], pts[k * 3 + 1] - pts[k * 3 - 2], pts[k * 3 + 2] - pts[k * 3 - 1]);
    if (!forward.closed && (count < 2 || length < MIN_LENGTH * ds)) { vertices -= count - 1; return; }
    if (forward.closed && count < 3) { vertices -= count - 1; return; }
    raw.push({ pts, tris, steps, closed: forward.closed, ends: [backward.end as StrandEnd, forward.end as StrandEnd] });
    // Publish the samples and queue both flanks of every step end.
    for (const k of steps) hash.add(pts[k * 3], pts[k * 3 + 1], pts[k * 3 + 2], tris[Math.min(k, tris.length - 1)]);
    for (const k of steps) {
      const segment = Math.min(k, tris.length - 1), next = forward.closed ? (k + 1) % count : Math.min(k + 1, count - 1), from = next === k ? k - 1 : k;
      probe.tri = tris[segment];
      let dx = pts[next * 3] - pts[from * 3], dy = pts[next * 3 + 1] - pts[from * 3 + 1], dz = pts[next * 3 + 2] - pts[from * 3 + 2];
      const l = Math.hypot(dx, dy, dz);
      if (l === 0) continue;
      dx /= l; dy /= l; dz /= l;
      const nx = g.normals[probe.tri * 3], ny = g.normals[probe.tri * 3 + 1], nz = g.normals[probe.tri * 3 + 2];
      for (const sign of [1, -1]) {
        let reachable = true;
        for (const offset of OFFSETS) {
          if (!reachable) break;
          probe.p[0] = pts[k * 3]; probe.p[1] = pts[k * 3 + 1]; probe.p[2] = pts[k * 3 + 2]; probe.tri = tris[segment];
          probe.d[0] = sign * (ny * dz - nz * dy); probe.d[1] = sign * (nz * dx - nx * dz); probe.d[2] = sign * (nx * dy - ny * dx);
          const local = interpolate(g, spacing, probe);
          // The closer offset only fills a gap the full one would leave; where the full one runs off the surface there is no gap to fill.
          if (walk(g, probe, offset * local, null) === "length") queue.push(probe.p[0], probe.p[1], probe.p[2], probe.tri); else reachable = false;
        }
      }
    }
  }

  const tryStart = (tri: number, x: number, y: number, z: number, clear: number): void => {
    w.tri = tri; w.p[0] = x; w.p[1] = y; w.p[2] = z; w.d.fill(0);
    const ds = spacingAt(w);
    if (!usable(w, ds, margin, clear)) return;
    if (!fieldDirection(g, vectors, w, null, heading)) return;
    w.d.set(heading);
    accept(w, ds);
  };

  // Fill candidates: an even sample of the surface, in its own fixed order.
  let area = 0;
  const areas = meshDerived(mesh).triangleAreas;
  for (let t = 0; t < mesh.triangleCount; t++) {
    const s = (spacing[g.triangles[t * 3]] + spacing[g.triangles[t * 3 + 1]] + spacing[g.triangles[t * 3 + 2]]) / 3;
    area += areas[t] / (s * s);
  }
  const pool = sampleSurface(mesh, { seed: componentSeed(seed, `${family}`, "surface-strand-seeds"), count: Math.min(100_000, Math.max(200, Math.ceil(4 * area))), distribution: "even", normals: "face" });
  const P = g.positions, T = g.triangles;
  for (let k = 0; ; ) {
    if (head < queue.length) { tryStart(queue[head + 3], queue[head], queue[head + 1], queue[head + 2], SEED_CLEAR); head += 4; if (head > 1 << 20) { queue.splice(0, head); head = 0; } continue; }
    if (k >= pool.count) break;
    const source = sampleSource(pool, k++), t = source.triangle;
    const bary = source.barycentric;
    const x = bary[0] * P[T[t * 3] * 3] + bary[1] * P[T[t * 3 + 1] * 3] + bary[2] * P[T[t * 3 + 2] * 3];
    const y = bary[0] * P[T[t * 3] * 3 + 1] + bary[1] * P[T[t * 3 + 1] * 3 + 1] + bary[2] * P[T[t * 3 + 2] * 3 + 1];
    const z = bary[0] * P[T[t * 3] * 3 + 2] + bary[1] * P[T[t * 3 + 1] * 3 + 2] + bary[2] * P[T[t * 3 + 2] * 3 + 2];
    tryStart(t, x, y, z, 1);
  }

  const prefix = family === 0 ? "A" : "B";
  return Object.freeze(raw.map((r, index): SurfaceStrand => {
    const id = `${prefix}${index}`, count = r.pts.length / 3, points: Vec3[] = [], cumulative: number[] = [0];
    for (let k = 0; k < count; k++) points.push(Object.freeze([r.pts[k * 3], r.pts[k * 3 + 1], r.pts[k * 3 + 2]] as const) as Vec3);
    for (let k = 1; k < count; k++) cumulative.push(cumulative[k - 1] + Math.hypot(r.pts[k * 3] - r.pts[k * 3 - 3], r.pts[k * 3 + 1] - r.pts[k * 3 - 2], r.pts[k * 3 + 2] - r.pts[k * 3 - 1]));
    let spacingSum = 0;
    for (const k of r.steps) { probe.tri = r.tris[Math.min(k, r.tris.length - 1)]; probe.p[0] = r.pts[k * 3]; probe.p[1] = r.pts[k * 3 + 1]; probe.p[2] = r.pts[k * 3 + 2]; spacingSum += interpolate(g, spacing, probe); }
    const closing = r.closed ? Math.hypot(r.pts[0] - r.pts[count * 3 - 3], r.pts[1] - r.pts[count * 3 - 2], r.pts[2] - r.pts[count * 3 - 1]) : 0;
    return Object.freeze({
      id, family, seed: componentSeed(seed, id, "strand"), points: Object.freeze(points), triangles: Object.freeze(r.tris), closed: r.closed,
      cumulative: Object.freeze(cumulative), length: cumulative[count - 1] + closing, spacing: spacingSum / r.steps.length, ends: Object.freeze(r.ends) as readonly [StrandEnd, StrandEnd],
    });
  }));
}

export interface SurfaceCrossing {
  readonly id: string;
  /** Index in the crossing table (by first strand, then arc length). */
  readonly index: number;
  readonly position: Vec3;
  readonly triangle: number;
  /** Indices into the strand list given to `surfaceCrossings`; `first` is the lower. */
  readonly first: { readonly strand: number; readonly s: number; readonly segment: number; readonly t: number };
  readonly second: { readonly strand: number; readonly s: number; readonly segment: number; readonly t: number };
  /** |sin| of the angle between the strands on the surface, in (0, 1]. */
  readonly sine: number;
}

/** Every crossing of the given strands (see the module header). */
export function surfaceCrossings(mesh: Mesh, strands: readonly SurfaceStrand[]): readonly SurfaceCrossing[] {
  const g = traceGraph(mesh), P = g.positions, T = g.triangles;
  const scale = Math.sqrt(meshDerived(mesh).area), tolerance = 1e-7 * scale;
  const byTriangle = new Map<number, number[]>();
  const segmentStrand: number[] = [], segmentIndex: number[] = [];
  strands.forEach((strand, si) => {
    const count = strand.closed ? strand.points.length : strand.points.length - 1;
    for (let j = 0; j < count; j++) {
      const tri = strand.triangles[j], id = segmentStrand.length, list = byTriangle.get(tri);
      segmentStrand.push(si); segmentIndex.push(j);
      if (list) list.push(id); else byTriangle.set(tri, [id]);
    }
  });
  const found: SurfaceCrossing[] = [];
  const pointOf = (strand: SurfaceStrand, k: number): Vec3 => strand.points[k % strand.points.length];
  for (const [tri, list] of byTriangle) {
    if (list.length < 2) continue;
    const a = T[tri * 3], nx = g.normals[tri * 3], ny = g.normals[tri * 3 + 1], nz = g.normals[tri * 3 + 2];
    const ox = P[a * 3], oy = P[a * 3 + 1], oz = P[a * 3 + 2], b = T[tri * 3 + 1];
    let e1x = P[b * 3] - ox, e1y = P[b * 3 + 1] - oy, e1z = P[b * 3 + 2] - oz;
    const el = Math.hypot(e1x, e1y, e1z); e1x /= el; e1y /= el; e1z /= el;
    const e2x = ny * e1z - nz * e1y, e2y = nz * e1x - nx * e1z, e2z = nx * e1y - ny * e1x;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      let si = segmentStrand[list[i]], sj = segmentStrand[list[j]], ki = segmentIndex[list[i]], kj = segmentIndex[list[j]];
      if (si === sj) continue;
      if (si > sj) { [si, sj] = [sj, si]; [ki, kj] = [kj, ki]; }
      const A = strands[si], B = strands[sj], p0 = pointOf(A, ki), p1 = pointOf(A, ki + 1), q0 = pointOf(B, kj), q1 = pointOf(B, kj + 1);
      const p0x = (p0[0] - ox) * e1x + (p0[1] - oy) * e1y + (p0[2] - oz) * e1z, p0y = (p0[0] - ox) * e2x + (p0[1] - oy) * e2y + (p0[2] - oz) * e2z;
      const p1x = (p1[0] - ox) * e1x + (p1[1] - oy) * e1y + (p1[2] - oz) * e1z, p1y = (p1[0] - ox) * e2x + (p1[1] - oy) * e2y + (p1[2] - oz) * e2z;
      const q0x = (q0[0] - ox) * e1x + (q0[1] - oy) * e1y + (q0[2] - oz) * e1z, q0y = (q0[0] - ox) * e2x + (q0[1] - oy) * e2y + (q0[2] - oz) * e2z;
      const q1x = (q1[0] - ox) * e1x + (q1[1] - oy) * e1y + (q1[2] - oz) * e1z, q1y = (q1[0] - ox) * e2x + (q1[1] - oy) * e2y + (q1[2] - oz) * e2z;
      const rx = p1x - p0x, ry = p1y - p0y, sx = q1x - q0x, sy = q1y - q0y, denominator = rx * sy - ry * sx;
      const rl = Math.hypot(rx, ry), sl = Math.hypot(sx, sy);
      if (rl === 0 || sl === 0 || Math.abs(denominator) <= 1e-12 * rl * sl) continue;
      const t = ((q0x - p0x) * sy - (q0y - p0y) * sx) / denominator, u = ((q0x - p0x) * ry - (q0y - p0y) * rx) / denominator;
      const slack = 1e-9;
      if (t < -slack || t > 1 + slack || u < -slack || u > 1 + slack) continue;
      const tc = Math.min(1, Math.max(0, t)), uc = Math.min(1, Math.max(0, u));
      const lengthA = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), lengthB = Math.hypot(q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]);
      const s1 = A.cumulative[ki] + tc * lengthA, s2 = B.cumulative[kj] + uc * lengthB;
      found.push({
        id: "", index: 0, triangle: tri,
        position: [p0[0] + tc * (p1[0] - p0[0]), p0[1] + tc * (p1[1] - p0[1]), p0[2] + tc * (p1[2] - p0[2])],
        first: { strand: si, s: s1, segment: ki, t: tc }, second: { strand: sj, s: s2, segment: kj, t: uc },
        sine: Math.min(1, Math.abs(rx * sy - ry * sx) / (rl * sl)),
      });
    }
  }
  found.sort((x, y) => x.first.strand - y.first.strand || x.first.s - y.first.s || x.second.strand - y.second.strand || x.second.s - y.second.s);
  const unique: SurfaceCrossing[] = [];
  for (const c of found) {
    const previous = unique[unique.length - 1];
    if (previous && previous.first.strand === c.first.strand && previous.second.strand === c.second.strand && Math.abs(previous.first.s - c.first.s) < tolerance) continue;
    unique.push(c);
  }
  if (unique.length > STRAND_LIMITS.crossings) throw new Error(`The strands cross ${unique.length} times; the limit is ${STRAND_LIMITS.crossings}. Raise Thread spacing or lower Density ratio`);
  return Object.freeze(unique.map((c, index) => Object.freeze({
    ...c, index, id: `${strands[c.first.strand].id}@${c.first.s.toFixed(4)}~${strands[c.second.strand].id}@${c.second.s.toFixed(4)}`,
  })));
}

/**
 * The crossings as a `CrossingSet` over strands developed onto `(arc length, 0)`, for `orderCrossings` (see the module header).
 * Every path is presented OPEN, a closed strand cut at its first vertex: alternation is then a set of chains along the strands,
 * which a square weave always satisfies, instead of a cycle around each ring, which is impossible whenever a ring has an odd
 * number of crossings (and a greedy solve then scatters its violations over the whole surface). The price is at most one
 * unavoidable defect per closed strand, at its seam, which `seamBreaks` reports.
 */
export function surfaceCrossingSet(strands: readonly SurfaceStrand[], crossings: readonly SurfaceCrossing[]): CrossingSet {
  const paths: Path[] = strands.map((strand) => Object.freeze({
    id: strand.id, seed: strand.seed, points: Object.freeze([Object.freeze([0, 0] as const), Object.freeze([strand.length, 0] as const)]), closed: false,
    level: strand.family, levelFraction: strand.family, tone: strand.family,
  }));
  const side = (strand: number, part: SurfaceCrossing["first"]) => Object.freeze({
    path: strand, pathId: strands[strand].id, s: part.s, segment: part.segment, t: part.t, tangent: Object.freeze([1, 0] as const),
  });
  const table: Crossing[] = crossings.map((c) => Object.freeze({
    id: c.id, index: c.index, kind: "transversal" as const, point: Object.freeze([c.first.s, c.second.s] as const), first: side(c.first.strand, c.first),
    second: side(c.second.strand, c.second), sine: c.sine, self: false,
  }));
  return Object.freeze({
    paths: Object.freeze(paths), lengths: Object.freeze(strands.map((s) => s.length)), crossings: Object.freeze(table),
    contacts: Object.freeze([]), nearMisses: Object.freeze([]), nearMiss: 0,
  });
}
