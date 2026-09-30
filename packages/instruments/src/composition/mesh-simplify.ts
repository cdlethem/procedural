/**
 * Constrained mesh simplification by edge collapse (brief 55), run as an F7 stateful simulation so the collapse
 * COUNT is a scrubbable step: `stateAt(snapshots, k)` is the mesh after exactly `k` collapses, and more collapses
 * only append (the prefix property, proved by `checkSimulation`).
 *
 * Input. Any `Mesh` whose topology is `closed-manifold` or `open-manifold` (consistently oriented, no pinch
 * vertices, no edge shared by three faces); anything else throws naming the class. Quads are simplified as the two
 * triangles the mesh already uses for geometry (`meshStorage(mesh).triangles`), so the output is a TRIANGLE mesh. At
 * most `SIMPLIFY_LIMITS.maxTriangles` triangles; over that the call throws naming the source to reduce. Unused vertices
 * are never touched and are not in the output. The library never fetches a model: the instrument uses bundled meshes.
 *
 * The rule. One collapse merges an edge's two vertices `(u, v)` into ONE of them (the survivor keeps its ORIGINAL
 * vertex id; no vertex is ever born, so ids are stable and the birth counter is always the source vertex count).
 * Each vertex carries the quadric `Q` of the planes of the source triangles it now represents (Garland-Heckbert:
 * `Q(p)` is the sum of squared distances from `p` to those planes) plus `cnt`, their number, so that `sqrt(Q(p)/cnt)`
 * is the ROOT-MEAN-SQUARE distance to them, in world units: the `error` attribute. Constraint planes (boundary and
 * crease edges, weight `CONSTRAINT_WEIGHT`, counted in `cnt`) make leaving a preserved edge expensive.
 *   - Candidate positions for the merged vertex: the quadric optimum (rule `quadric`, when the 3x3 system is well
 *     conditioned and the optimum lies within twice the edge length of the edge midpoint), `u`, `v`, and the midpoint;
 *     the cheapest one that passes the fold test wins, ties in that order. A locked endpoint fixes the position.
 *   - Priority: `quadric`: `(Q(p) + 1e-3 |uv|^2) (1 + K w^2)`, the small length term orders the ties of a flat region
 *     shortest edge first; `length`: `|uv|^2 (1 + K w^2)`, `w` the larger endpoint importance, `K = IMPORTANCE_BIAS`.
 *     The collapse with the lowest priority goes first; equal priorities go to the lowest `(u, v)`. The order never
 *     depends on the number of collapses asked for, which is what makes it a prefix.
 * Rejection rule (an edge that fails is NOT collapsed; each is a named reason, counted by `blockedCensus`):
 *   locked (both endpoints locked, i.e. importance 1 or a frozen boundary), link (the link condition of the surface
 *   completed by one vertex at infinity joined to every boundary vertex: the endpoints' shared neighbours must be exactly
 *   the edge's opposite vertices, so a collapse can never pinch, tear or fuse a boundary), tetrahedron (a closed
 *   four-vertex component), component (the collapse would delete every face of a component), flip (some surviving
 *   triangle's normal would turn by more than 78.5 degrees, cosine below `MIN_NORMAL_DOT`, or shrink to a sliver of
 *   |cross| <= 1e-6 L^2: nothing can invert), valence (the merged vertex would exceed the source's largest valence,
 *   at least `MIN_VALENCE_CAP`, which also bounds the work of a step), error (the resulting RMS error exceeds the LOCAL
 *   target `maxError (1 - w)`; 0 means no target).
 * After every collapse the star of the survivor is checked to be one manifold fan (or one boundary chain); a violation
 * would throw (it cannot happen while the rejection rule holds).
 * Stop reasons of a run of `k` collapses: `target` (k done and more could follow), `error-limit` (no collapse is left
 * legal and some were refused for their error), `no-legal-collapse` (none left legal for structural reasons).
 * Counts. An interior collapse removes 2 faces, one along a boundary edge removes 1: a closed mesh of `F` faces has
 * `F - 2k` after `k` collapses; `simplifyMesh({targetFaces})` stops at the FIRST collapse count whose face count is
 * at most the target (equal for a closed mesh with matching parity; one below for the other parity).
 *
 * Determinism and work. Edges are visited in ascending `(u, v)` order; the priority queue is a binary heap with lazy
 * deletion whose entries carry per-vertex stamps and whose order is total; it lives in the STATE, so a checkpoint replay
 * is bit-identical. Work is charged as edge evaluations (one collapse re-evaluates the edges around the survivor's
 * ring: at most `(2 cap + 1) cap`, declared as `workPerStep`); the mesh size limit above is the measured bound
 * (see docs/composition-mesh-abstraction.md).
 *
 * Output (`Abstraction`). A frozen `Mesh` of alive vertices in ascending ORIGINAL id and alive triangles in ascending
 * original triangle index, with vertex attributes `error` (RMS distance, world units), `importance` (the field, the
 * larger of merged vertices), `origin` (original vertex id) and face attribute `source` (original triangle index);
 * `representative[v]` is the surviving original id that stands for source vertex `v`. Vertices with importance 1 are
 * bit-identical to the source. Results are cached per snapshots object.
 */
import { mesh, meshMeasures, meshStorage, type Mesh } from "./mesh.js";
import { meshTopology } from "./mesh-topology.js";
import { checkRegion, regionImportance, type MeshRegion } from "./mesh-region.js";
import { createSimulationCache, finalState, runSimulation, type Simulation, type Snapshots } from "./snapshots.js";

export const SIMPLIFY_LIMITS = Object.freeze({ maxTriangles: 40_000, minFaces: 4 });
export const MIN_NORMAL_DOT = 0.2;
export const MIN_VALENCE_CAP = 16;
export const CONSTRAINT_WEIGHT = 10;
export const IMPORTANCE_BIAS = 100;
const LENGTH_TERM = 1e-3;
const SLIVER_GUARD = 1e-6;
const RULES = ["quadric", "length"] as const;
const BOUNDARIES = ["hold", "free", "frozen"] as const;
export type SimplifyRule = (typeof RULES)[number];
export type BoundaryMode = (typeof BOUNDARIES)[number];
export type BlockReason = "locked" | "link" | "tetrahedron" | "component" | "flip" | "valence" | "error";
const REASONS: readonly BlockReason[] = ["locked", "link", "tetrahedron", "component", "flip", "valence", "error"];
const OK = -1;
export type StopReason = "target" | "error-limit" | "no-legal-collapse";

/** What the simulation reads (JSON-like; appearance never enters). `mesh` is the content key of a registered mesh. */
export interface SimplifyParams {
  readonly mesh: string;
  readonly region: MeshRegion & { readonly invert: boolean };
  readonly rule: SimplifyRule;
  readonly boundary: BoundaryMode;
  /** Degrees; edges folding at least this much get constraint planes. 0 keeps none. */
  readonly creaseAngle: number;
  /** World-unit RMS error target, tightened toward the preserved region; 0 is no target. */
  readonly maxError: number;
}

export interface SimplifyProjection { readonly faces: number; readonly collapses: number; readonly status: number; readonly error: number }

// ---------------------------------------------------------------------------------------------
// Mesh registry: params are JSON, meshes are not. A mesh is registered under its content key (a hash), so the
// lookup is a pure function of the params; `initial` is the only reader.

const registry = new Map<string, Mesh>();
function register(value: Mesh): string {
  const key = value.key;
  registry.delete(key); registry.set(key, value);
  while (registry.size > 8) registry.delete(registry.keys().next().value as string);
  return key;
}
function registered(key: string): Mesh {
  const found = registry.get(key);
  if (!found) throw new Error(`Simplification source ${key.slice(0, 12)} is not registered; call simplifyMesh with the mesh first`);
  return found;
}

// ---------------------------------------------------------------------------------------------
// State

interface State {
  V: number; T: number;
  cx: number; cy: number; cz: number;
  pos: Float64Array; tri: Int32Array; triAlive: Uint8Array; alive: Uint8Array;
  /** 10 per vertex: xx xy xz yy yz zz bx by bz c. */
  q: Float64Array; cnt: Float64Array;
  weight: Float64Array; lock: Uint8Array; bnd: Uint8Array; parent: Int32Array; stamp: Uint32Array;
  hPrio: Float64Array; hA: Int32Array; hB: Int32Array; hSA: Uint32Array; hSB: Uint32Array; hSize: number;
  faces: number; collapses: number; lastError: number; status: number;
  cap: number; rule: number; maxError: number;
}

/** Derived, order-insensitive helpers rebuilt from a state (never part of it). */
interface Side {
  vt: number[][];
  markA: Int32Array; markB: Int32Array; tokA: number; tokB: number;
  qsum: Float64Array;
  /** Up to four candidate positions (x, y, z) and their costs for one evaluation. */
  cand: Float64Array; costs: Float64Array;
}
const sides = new WeakMap<object, Side>();
function sideOf(S: State): Side {
  const hit = sides.get(S);
  if (hit) return hit;
  const vt: number[][] = Array.from({ length: S.V }, () => []);
  for (let t = 0; t < S.T; t++) if (S.triAlive[t]) for (let k = 0; k < 3; k++) vt[S.tri[t * 3 + k]].push(t);
  const side: Side = { vt, markA: new Int32Array(S.V), markB: new Int32Array(S.V), tokA: 0, tokB: 0, qsum: new Float64Array(10), cand: new Float64Array(12), costs: new Float64Array(4) };
  sides.set(S, side);
  return side;
}

interface Eval { survivor: number; x: number; y: number; z: number; prio: number; rms: number }

function costAt(q: Float64Array, x: number, y: number, z: number): number {
  return q[0] * x * x + 2 * q[1] * x * y + 2 * q[2] * x * z + q[3] * y * y + 2 * q[4] * y * z + q[5] * z * z + 2 * (q[6] * x + q[7] * y + q[8] * z) + q[9];
}

/** Normal turn and sliver test for every triangle that survives the collapse of (u, v) to p. */
function foldSafe(S: State, vt: number[][], u: number, v: number, px: number, py: number, pz: number): boolean {
  const tri = S.tri, pos = S.pos;
  for (let pass = 0; pass < 2; pass++) {
    const me = pass === 0 ? u : v, other = pass === 0 ? v : u, list = vt[me];
    for (let i = 0; i < list.length; i++) {
      const t = list[i], a = tri[t * 3], b = tri[t * 3 + 1], c = tri[t * 3 + 2];
      if (a === other || b === other || c === other) continue;
      const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2], bx = pos[b * 3], by = pos[b * 3 + 1], bz = pos[b * 3 + 2], cx = pos[c * 3], cy = pos[c * 3 + 1], cz = pos[c * 3 + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az, wx = cx - ax, wy = cy - ay, wz = cz - az;
      const n0x = uy * wz - uz * wy, n0y = uz * wx - ux * wz, n0z = ux * wy - uy * wx;
      const nax = a === me ? px : ax, nay = a === me ? py : ay, naz = a === me ? pz : az;
      const nbx = b === me ? px : bx, nby = b === me ? py : by, nbz = b === me ? pz : bz;
      const ncx = c === me ? px : cx, ncy = c === me ? py : cy, ncz = c === me ? pz : cz;
      const ex = nbx - nax, ey = nby - nay, ez = nbz - naz, fx = ncx - nax, fy = ncy - nay, fz = ncz - naz;
      const n1x = ey * fz - ez * fy, n1y = ez * fx - ex * fz, n1z = ex * fy - ey * fx;
      const l0 = Math.hypot(n0x, n0y, n0z), l1 = Math.hypot(n1x, n1y, n1z);
      const longest = Math.max(ex * ex + ey * ey + ez * ez, fx * fx + fy * fy + fz * fz, (nbx - ncx) ** 2 + (nby - ncy) ** 2 + (nbz - ncz) ** 2);
      if (!(l1 > SLIVER_GUARD * longest)) return false;
      if (n0x * n1x + n0y * n1y + n0z * n1z < MIN_NORMAL_DOT * l0 * l1) return false;
    }
  }
  return true;
}

/** Judge the collapse of edge (u < v): the reason index, or OK with `out` filled. */
function evaluate(S: State, sc: Side, u: number, v: number, out: Eval): number {
  const lock = S.lock;
  if (lock[u] && lock[v]) return REASONS.indexOf("locked");
  const vt = sc.vt, tri = S.tri, tu = vt[u], tv = vt[v];
  const ta = ++sc.tokA, tb = ++sc.tokB, markA = sc.markA, markB = sc.markB;
  let ru = 0, rv = 0, real = 0, shared = 0, o1 = -1, o2 = -1;
  for (let i = 0; i < tu.length; i++) {
    const t = tu[i], a = tri[t * 3], b = tri[t * 3 + 1], c = tri[t * 3 + 2];
    const has = a === v || b === v || c === v;
    if (has) { shared++; const o = a !== u && a !== v ? a : b !== u && b !== v ? b : c; if (o1 < 0) o1 = o; else o2 = o; }
    for (let k = 0; k < 3; k++) { const w = tri[t * 3 + k]; if (w !== u && w !== v && markA[w] !== ta) { markA[w] = ta; ru++; } }
  }
  for (let i = 0; i < tv.length; i++) {
    const t = tv[i];
    for (let k = 0; k < 3; k++) { const w = tri[t * 3 + k]; if (w !== u && w !== v && markB[w] !== tb) { markB[w] = tb; rv++; if (markA[w] === ta) real++; } }
  }
  const bnd = S.bnd;
  if (shared < 1 || shared > 2 || real + (bnd[u] && bnd[v] ? 1 : 0) !== 2) return REASONS.indexOf("link");
  if (shared === 2 && !bnd[u] && !bnd[v] && !bnd[o1] && !bnd[o2] && tu.length === 3 && tv.length === 3 && vt[o1].length === 3 && vt[o2].length === 3) return REASONS.indexOf("tetrahedron");
  if (shared === tu.length + tv.length - shared) return REASONS.indexOf("component");
  if (ru + rv - real > S.cap) return REASONS.indexOf("valence");

  const pos = S.pos, q = S.q, sum = sc.qsum;
  for (let k = 0; k < 10; k++) sum[k] = q[u * 10 + k] + q[v * 10 + k];
  const ux = pos[u * 3], uy = pos[u * 3 + 1], uz = pos[u * 3 + 2], vx = pos[v * 3], vy = pos[v * 3 + 1], vz = pos[v * 3 + 2];
  const len2 = (ux - vx) ** 2 + (uy - vy) ** 2 + (uz - vz) ** 2;
  const cx = S.cx, cy = S.cy, cz = S.cz;
  // candidates in order optimum, u, v, midpoint (a locked endpoint: only its own position), stored flat in `cand`
  const cand = sc.cand, costs = sc.costs;
  let n = 0;
  const add = (x: number, y: number, z: number): void => { cand[n * 3] = x; cand[n * 3 + 1] = y; cand[n * 3 + 2] = z; costs[n] = Math.max(0, costAt(sum, x - cx, y - cy, z - cz)); n++; };
  if (lock[u]) add(ux, uy, uz);
  else if (lock[v]) add(vx, vy, vz);
  else {
    if (S.rule === 0) {
      const a11 = sum[0], a12 = sum[1], a13 = sum[2], a22 = sum[3], a23 = sum[4], a33 = sum[5];
      const det = a11 * (a22 * a33 - a23 * a23) - a12 * (a12 * a33 - a23 * a13) + a13 * (a12 * a23 - a22 * a13);
      const scale = (a11 + a22 + a33) / 3;
      if (scale > 0 && Math.abs(det) > 1e-9 * scale * scale * scale) {
        const bx = -sum[6], by = -sum[7], bz = -sum[8];
        const x = ((a22 * a33 - a23 * a23) * bx + (a13 * a23 - a12 * a33) * by + (a12 * a23 - a13 * a22) * bz) / det + cx;
        const y = ((a13 * a23 - a12 * a33) * bx + (a11 * a33 - a13 * a13) * by + (a12 * a13 - a11 * a23) * bz) / det + cy;
        const z = ((a12 * a23 - a13 * a22) * bx + (a12 * a13 - a11 * a23) * by + (a11 * a22 - a12 * a12) * bz) / det + cz;
        if (Number.isFinite(x + y + z) && (x - (ux + vx) / 2) ** 2 + (y - (uy + vy) / 2) ** 2 + (z - (uz + vz) / 2) ** 2 <= 4 * len2) add(x, y, z);
      }
    }
    add(ux, uy, uz); add(vx, vy, vz); add((ux + vx) / 2, (uy + vy) / 2, (uz + vz) / 2);
  }
  // the cheapest candidate that passes the fold test (ties in candidate order)
  let chosen = -1, tried = 0;
  for (let pass = 0; pass < n && chosen < 0; pass++) {
    let best = -1;
    for (let i = 0; i < n; i++) if ((tried & (1 << i)) === 0 && (best < 0 || costs[i] < costs[best])) best = i;
    if (foldSafe(S, vt, u, v, cand[best * 3], cand[best * 3 + 1], cand[best * 3 + 2])) chosen = best;
    else tried |= 1 << best;
  }
  if (chosen < 0) return REASONS.indexOf("flip");
  const cost = costs[chosen], count = S.cnt[u] + S.cnt[v], rms = Math.sqrt(cost / count), w = Math.max(S.weight[u], S.weight[v]);
  if (S.maxError > 0 && rms > S.maxError * (1 - w)) return REASONS.indexOf("error");
  const bias = 1 + IMPORTANCE_BIAS * w * w;
  const prio = (S.rule === 0 ? (cost + LENGTH_TERM * len2) : len2) * bias;
  if (!Number.isFinite(prio)) return REASONS.indexOf("flip");
  out.survivor = lock[v] && !lock[u] ? v : u; out.x = cand[chosen * 3]; out.y = cand[chosen * 3 + 1]; out.z = cand[chosen * 3 + 2]; out.prio = prio; out.rms = rms;
  return OK;
}

// ---------------------------------------------------------------------------------------------
// Heap (state-resident, lazy deletion, total order (priority, a, b))

function less(S: State, i: number, j: number): boolean {
  const p = S.hPrio;
  if (p[i] !== p[j]) return p[i] < p[j];
  if (S.hA[i] !== S.hA[j]) return S.hA[i] < S.hA[j];
  return S.hB[i] < S.hB[j];
}
function swap(S: State, i: number, j: number): void {
  let f = S.hPrio[i]; S.hPrio[i] = S.hPrio[j]; S.hPrio[j] = f;
  let n = S.hA[i]; S.hA[i] = S.hA[j]; S.hA[j] = n;
  n = S.hB[i]; S.hB[i] = S.hB[j]; S.hB[j] = n;
  let m = S.hSA[i]; S.hSA[i] = S.hSA[j]; S.hSA[j] = m;
  m = S.hSB[i]; S.hSB[i] = S.hSB[j]; S.hSB[j] = m;
}
function siftUp(S: State, i: number): void { while (i > 0) { const p = (i - 1) >> 1; if (!less(S, i, p)) break; swap(S, i, p); i = p; } }
function siftDown(S: State, i: number): void {
  for (;;) {
    const l = 2 * i + 1, r = l + 1; let m = i;
    if (l < S.hSize && less(S, l, m)) m = l;
    if (r < S.hSize && less(S, r, m)) m = r;
    if (m === i) return;
    swap(S, i, m); i = m;
  }
}
function grow(S: State, capacity: number): void {
  const f = new Float64Array(capacity); f.set(S.hPrio.subarray(0, S.hSize)); S.hPrio = f;
  const a = new Int32Array(capacity); a.set(S.hA.subarray(0, S.hSize)); S.hA = a;
  const b = new Int32Array(capacity); b.set(S.hB.subarray(0, S.hSize)); S.hB = b;
  const sa = new Uint32Array(capacity); sa.set(S.hSA.subarray(0, S.hSize)); S.hSA = sa;
  const sb = new Uint32Array(capacity); sb.set(S.hSB.subarray(0, S.hSize)); S.hSB = sb;
}
function push(S: State, prio: number, a: number, b: number): void {
  if (S.hSize === S.hPrio.length) grow(S, Math.max(64, S.hSize * 2));
  const i = S.hSize++;
  S.hPrio[i] = prio; S.hA[i] = a; S.hB[i] = b; S.hSA[i] = S.stamp[a]; S.hSB[i] = S.stamp[b];
  siftUp(S, i);
}
const valid = (S: State, i: number): boolean => S.alive[S.hA[i]] === 1 && S.alive[S.hB[i]] === 1 && S.stamp[S.hA[i]] === S.hSA[i] && S.stamp[S.hB[i]] === S.hSB[i];
function removeTop(S: State): void {
  S.hSize--;
  if (S.hSize > 0) {
    const l = S.hSize;
    S.hPrio[0] = S.hPrio[l]; S.hA[0] = S.hA[l]; S.hB[0] = S.hB[l]; S.hSA[0] = S.hSA[l]; S.hSB[0] = S.hSB[l];
    siftDown(S, 0);
  }
}
/** Drop stale entries from the top; true when a valid one remains. */
function settle(S: State): boolean {
  while (S.hSize > 0 && !valid(S, 0)) removeTop(S);
  return S.hSize > 0;
}
function compact(S: State): void {
  let n = 0;
  for (let i = 0; i < S.hSize; i++) {
    if (!valid(S, i)) continue;
    if (n !== i) { S.hPrio[n] = S.hPrio[i]; S.hA[n] = S.hA[i]; S.hB[n] = S.hB[i]; S.hSA[n] = S.hSA[i]; S.hSB[n] = S.hSB[i]; }
    n++;
  }
  S.hSize = n;
  for (let i = (n >> 1) - 1; i >= 0; i--) siftDown(S, i);
}

// ---------------------------------------------------------------------------------------------
// Building the initial state

const norm3 = (x: number, y: number, z: number): [number, number, number] => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
function addPlane(S: State, vertex: number, nx: number, ny: number, nz: number, px: number, py: number, pz: number, weight: number): void {
  const d = -(nx * (px - S.cx) + ny * (py - S.cy) + nz * (pz - S.cz)), q = S.q, o = vertex * 10;
  q[o] += weight * nx * nx; q[o + 1] += weight * nx * ny; q[o + 2] += weight * nx * nz; q[o + 3] += weight * ny * ny; q[o + 4] += weight * ny * nz; q[o + 5] += weight * nz * nz;
  q[o + 6] += weight * nx * d; q[o + 7] += weight * ny * d; q[o + 8] += weight * nz * d; q[o + 9] += weight * d * d;
  S.cnt[vertex] += weight;
}

/** Vertex valence of a mesh: distinct neighbours (largest over vertices). */
export function maxValence(source: Mesh): number {
  const s = meshStorage(source), seen = new Set<number>(), degree = new Int32Array(source.vertexCount), V = source.vertexCount;
  for (let t = 0; t < source.triangleCount; t++) for (let k = 0; k < 3; k++) {
    const a = s.triangles[t * 3 + k], b = s.triangles[t * 3 + (k + 1) % 3], key = Math.min(a, b) * V + Math.max(a, b);
    if (!seen.has(key)) { seen.add(key); degree[a]++; degree[b]++; }
  }
  return degree.reduce((m, d) => Math.max(m, d), 0);
}

function buildState(source: Mesh, params: SimplifyParams, seed: number, charge: (units: number) => void): State {
  const topology = meshTopology(source);
  if (topology.kind !== "closed-manifold" && topology.kind !== "open-manifold")
    throw new Error(`Mesh "${source.id}" is ${topology.kind}: simplification needs a consistently oriented manifold surface (closed or with boundary)`);
  const T = source.triangleCount, V = source.vertexCount;
  if (T > SIMPLIFY_LIMITS.maxTriangles) throw new Error(`Mesh "${source.id}" has ${T} triangles; simplification is bounded to ${SIMPLIFY_LIMITS.maxTriangles}; reduce the source detail`);
  const s = meshStorage(source), { min, max } = source.bounds;
  const S: State = {
    V, T, cx: (min[0] + max[0]) / 2, cy: (min[1] + max[1]) / 2, cz: (min[2] + max[2]) / 2,
    pos: s.positions.slice(), tri: Int32Array.from(s.triangles), triAlive: new Uint8Array(T).fill(1), alive: new Uint8Array(V).fill(1),
    q: new Float64Array(V * 10), cnt: new Float64Array(V), weight: regionImportance(source, params.region, seed), lock: new Uint8Array(V), bnd: new Uint8Array(V),
    parent: Int32Array.from({ length: V }, (_, i) => i), stamp: new Uint32Array(V),
    hPrio: new Float64Array(0), hA: new Int32Array(0), hB: new Int32Array(0), hSA: new Uint32Array(0), hSB: new Uint32Array(0), hSize: 0,
    faces: T, collapses: 0, lastError: 0, status: 0, cap: MIN_VALENCE_CAP, rule: params.rule === "quadric" ? 0 : 1, maxError: params.maxError,
  };
  const pos = S.pos, tri = S.tri;
  // edges of the triangulation, sorted by (lo, hi): group size 1 boundary, 2 interior
  const keys = new Float64Array(T * 3), lo = new Int32Array(T * 3), hi = new Int32Array(T * 3);
  for (let t = 0; t < T; t++) for (let k = 0; k < 3; k++) {
    const a = tri[t * 3 + k], b = tri[t * 3 + (k + 1) % 3], h = t * 3 + k;
    lo[h] = Math.min(a, b); hi[h] = Math.max(a, b); keys[h] = lo[h] * V + hi[h];
  }
  const order = Uint32Array.from({ length: T * 3 }, (_, i) => i).sort((i, j) => keys[i] - keys[j] || i - j);
  const edges: { a: number; b: number; f0: number; f1: number }[] = [];
  for (let i = 0; i < order.length;) {
    let j = i + 1;
    while (j < order.length && keys[order[j]] === keys[order[i]]) j++;
    if (j - i > 2) throw new Error(`Mesh "${source.id}": edge ${lo[order[i]]}-${hi[order[i]]} is shared by ${j - i} triangles`);
    edges.push({ a: lo[order[i]], b: hi[order[i]], f0: Math.floor(order[i] / 3), f1: j - i === 2 ? Math.floor(order[i + 1] / 3) : -1 });
    i = j;
  }
  const normal = (t: number): [number, number, number] => {
    const a = tri[t * 3], b = tri[t * 3 + 1], c = tri[t * 3 + 2];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2], wx = pos[c * 3] - pos[a * 3], wy = pos[c * 3 + 1] - pos[a * 3 + 1], wz = pos[c * 3 + 2] - pos[a * 3 + 2];
    return norm3(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx);
  };
  for (let t = 0; t < T; t++) {
    const [nx, ny, nz] = normal(t);
    for (let k = 0; k < 3; k++) { const v = tri[t * 3 + k]; addPlane(S, v, nx, ny, nz, pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], 1); }
  }
  const constrain = (a: number, b: number, face: number): void => {
    const n = normal(face), ex = pos[b * 3] - pos[a * 3], ey = pos[b * 3 + 1] - pos[a * 3 + 1], ez = pos[b * 3 + 2] - pos[a * 3 + 2];
    const [mx, my, mz] = norm3(ey * n[2] - ez * n[1], ez * n[0] - ex * n[2], ex * n[1] - ey * n[0]);
    for (const v of [a, b]) addPlane(S, v, mx, my, mz, pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2], CONSTRAINT_WEIGHT);
  };
  const degree = new Int32Array(V), cosCrease = params.creaseAngle > 0 ? Math.cos(params.creaseAngle * Math.PI / 180) : 2;
  for (const e of edges) {
    degree[e.a]++; degree[e.b]++;
    if (e.f1 < 0) {
      S.bnd[e.a] = 1; S.bnd[e.b] = 1;
      if (params.boundary === "hold") constrain(e.a, e.b, e.f0);
      else if (params.boundary === "frozen") { S.lock[e.a] = 1; S.lock[e.b] = 1; }
    } else if (params.creaseAngle > 0) {
      const n0 = normal(e.f0), n1 = normal(e.f1);
      if (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2] <= cosCrease + 1e-12) { constrain(e.a, e.b, e.f0); constrain(e.a, e.b, e.f1); }
    }
  }
  for (let v = 0; v < V; v++) { if (S.weight[v] >= 1) S.lock[v] = 1; S.cap = Math.max(S.cap, degree[v]); }
  // initial queue: every edge in ascending order
  const sc = sideOf(S), out: Eval = { survivor: 0, x: 0, y: 0, z: 0, prio: 0, rms: 0 };
  grow(S, Math.max(64, edges.length * 2));
  charge(edges.length);
  for (const e of edges) if (evaluate(S, sc, e.a, e.b, out) === OK) push(S, out.prio, e.a, e.b);
  updateStatus(S, sc);
  return S;
}

/** After each step: 0 when a legal collapse remains, else 1 (some were refused for their error) or 2. */
function updateStatus(S: State, sc: Side): void {
  if (settle(S)) { S.status = 0; return; }
  const census = blockedOf(S, sc);
  S.status = census.error > 0 ? 1 : 2;
}

/** Why every remaining edge of a state is blocked (only meaningful when no collapse is legal). */
function blockedOf(S: State, sc: Side): Record<BlockReason, number> {
  const counts = Object.fromEntries(REASONS.map((r) => [r, 0])) as Record<BlockReason, number>, out: Eval = { survivor: 0, x: 0, y: 0, z: 0, prio: 0, rms: 0 };
  for (const [a, b] of liveEdges(S, sc)) { const r = evaluate(S, sc, a, b, out); if (r !== OK) counts[REASONS[r]]++; }
  return counts;
}
function liveEdges(S: State, sc: Side): [number, number][] {
  const keys: number[] = [];
  for (let v = 0; v < S.V; v++) for (const t of sc.vt[v]) for (let k = 0; k < 3; k++) {
    const w = S.tri[t * 3 + k];
    if (w > v) keys.push(v * S.V + w);
  }
  const sorted = Float64Array.from(keys).sort(), out: [number, number][] = [];
  for (let i = 0; i < sorted.length; i++) if (i === 0 || sorted[i] !== sorted[i - 1]) out.push([Math.floor(sorted[i] / S.V), sorted[i] % S.V]);
  return out;
}

// ---------------------------------------------------------------------------------------------
// One collapse

function ringOf(S: State, sc: Side, s: number, out: number[]): void {
  const token = ++sc.tokA;
  out.length = 0;
  for (const t of sc.vt[s]) for (let k = 0; k < 3; k++) { const w = S.tri[t * 3 + k]; if (w !== s && sc.markA[w] !== token) { sc.markA[w] = token; out.push(w); } }
}

/** The survivor's star must be one manifold fan or one boundary chain of distinct triangles. */
function checkStar(S: State, sc: Side, s: number): void {
  const next = new Map<number, number>(), prev = new Map<number, number>();
  for (const t of sc.vt[s]) {
    const a = S.tri[t * 3], b = S.tri[t * 3 + 1], c = S.tri[t * 3 + 2];
    if (a === b || b === c || a === c) throw new Error(`Simplification produced a degenerate triangle ${t} at vertex ${s}`);
    const at = a === s ? 0 : b === s ? 1 : 2, x = S.tri[t * 3 + (at + 1) % 3], y = S.tri[t * 3 + (at + 2) % 3];
    if (next.has(x) || prev.has(y)) throw new Error(`Simplification broke the manifold at vertex ${s}: triangles overlap`);
    next.set(x, y); prev.set(y, x);
  }
  const starts = [...next.keys()].filter((x) => !prev.has(x));
  if (starts.length > 1) throw new Error(`Simplification broke the manifold at vertex ${s}: the star has ${starts.length} chains`);
  const first = starts.length === 1 ? starts[0] : (next.keys().next().value as number);
  let seen = 0, at = first;
  while (next.has(at) && seen <= next.size) { at = next.get(at)!; seen++; if (at === first) break; }
  if (seen !== next.size) throw new Error(`Simplification broke the manifold at vertex ${s}: the star is not one fan`);
}

function collapseOnce(S: State, sc: Side): number {
  if (!settle(S)) { updateStatus(S, sc); return 0; }
  const a = S.hA[0], b = S.hB[0], out: Eval = { survivor: 0, x: 0, y: 0, z: 0, prio: 0, rms: 0 };
  removeTop(S);
  if (evaluate(S, sc, a, b, out) !== OK) throw new Error(`Simplification queue held edge ${a}-${b} that is no longer legal`);
  let evals = 1;
  const s = out.survivor, o = s === a ? b : a, vt = sc.vt;
  // faces
  let removed = 0;
  for (const t of vt[o].slice()) {
    const has = S.tri[t * 3] === s || S.tri[t * 3 + 1] === s || S.tri[t * 3 + 2] === s;
    if (has) {
      S.triAlive[t] = 0; removed++;
      for (let k = 0; k < 3; k++) { const w = S.tri[t * 3 + k]; const list = vt[w]; const at = list.indexOf(t); if (at >= 0) list.splice(at, 1); }
    } else {
      for (let k = 0; k < 3; k++) if (S.tri[t * 3 + k] === o) S.tri[t * 3 + k] = s;
      vt[o].splice(vt[o].indexOf(t), 1); vt[s].push(t);
    }
  }
  S.pos[s * 3] = out.x; S.pos[s * 3 + 1] = out.y; S.pos[s * 3 + 2] = out.z;
  for (let k = 0; k < 10; k++) S.q[s * 10 + k] += S.q[o * 10 + k];
  S.cnt[s] += S.cnt[o];
  S.weight[s] = Math.max(S.weight[s], S.weight[o]);
  S.lock[s] = S.lock[s] | S.lock[o]; S.bnd[s] = S.bnd[s] | S.bnd[o];
  S.parent[o] = s; S.alive[o] = 0; S.stamp[o]++;
  S.faces -= removed; S.collapses++; S.lastError = out.rms;
  checkStar(S, sc, s);
  const ring: number[] = [];
  ringOf(S, sc, s, ring);
  S.stamp[s]++; for (const w of ring) S.stamp[w]++;
  const keys: number[] = [], V = S.V;
  for (const w of [s, ...ring]) for (const t of vt[w]) for (let k = 0; k < 3; k++) {
    const x = S.tri[t * 3 + k];
    if (x !== w) keys.push(Math.min(w, x) * V + Math.max(w, x));
  }
  const sorted = Float64Array.from(keys).sort();
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] === sorted[i - 1]) continue;
    const x = Math.floor(sorted[i] / V), y = sorted[i] % V;
    evals++;
    if (evaluate(S, sc, x, y, out) === OK) push(S, out.prio, x, y);
  }
  if (S.hSize > 2.5 * S.faces + 1024) compact(S);
  updateStatus(S, sc);
  return evals;
}

// ---------------------------------------------------------------------------------------------
// The simulation

/** Upper estimate of the values a state holds: 20 per vertex, 19 per triangle (the heap holds at most 3 T entries of 5) and slack for tiny meshes. */
function stateValues(T: number, V: number): number { return 20 * V + 19 * T + 20_000; }
const checkpointCount = (T: number, V: number): number => Math.max(2, Math.min(12, Math.floor(3_000_000 / stateValues(T, V))));

export const simplifySimulation: Simulation<State, SimplifyParams, SimplifyProjection> = {
  id: "mesh-simplify/1",
  limits(params) {
    const source = registered(params.mesh), cap = Math.max(MIN_VALENCE_CAP, maxValence(source));
    return { stepLimit: source.triangleCount, workPerStep: (2 * cap + 1) * cap + 1, initialWork: 3 * source.triangleCount + source.vertexCount };
  },
  initial(ctx) { return buildState(registered(ctx.params.mesh), ctx.params, ctx.seed, ctx.charge); },
  step(state, ctx) {
    if (state.status !== 0) return state;
    ctx.charge(collapseOnce(state, sideOf(state)));
    return state;
  },
  project: (state) => ({ faces: state.faces, collapses: state.collapses, status: state.status, error: state.lastError }),
};

// ---------------------------------------------------------------------------------------------
// Public results

export interface Abstraction {
  /** The source mesh and the simplified TRIANGLE mesh (attributes: vertex `error`, `importance`, `origin`; face `source`). */
  readonly source: Mesh;
  readonly mesh: Mesh;
  readonly sourceFaces: number;
  readonly faces: number;
  readonly collapses: number;
  readonly stop: StopReason;
  /** RMS error (world units) of the last collapse, and the largest vertex error of the result. */
  readonly lastError: number;
  readonly maxVertexError: number;
  /** For every source vertex, the source id of the vertex that stands for it now (itself if it survives). */
  readonly representative: Int32Array;
  readonly snapshots: Snapshots<State, SimplifyParams, SimplifyProjection>;
  /** Why the remaining edges cannot be collapsed (counts by reason), computed on first use. */
  blockedCensus(): Readonly<Record<BlockReason, number>>;
}

const abstractions = new WeakMap<object, Abstraction>();

function build(source: Mesh, snaps: Snapshots<State, SimplifyParams, SimplifyProjection>): Abstraction {
  const hit = abstractions.get(snaps);
  if (hit) return hit;
  const S = finalState(snaps), V = S.V;
  const used = new Int32Array(V).fill(-1), vertices: number[] = [];
  for (let t = 0; t < S.T; t++) if (S.triAlive[t]) for (let k = 0; k < 3; k++) used[S.tri[t * 3 + k]] = 0;
  for (let v = 0; v < V; v++) if (used[v] === 0) { used[v] = vertices.length; vertices.push(v); }
  const positions: number[] = [], error: number[] = [], importance: number[] = [], origin: number[] = [];
  let worst = 0;
  for (const v of vertices) {
    positions.push(S.pos[v * 3], S.pos[v * 3 + 1], S.pos[v * 3 + 2]);
    const rms = Math.sqrt(Math.max(0, costAt(S.q.subarray(v * 10, v * 10 + 10), S.pos[v * 3] - S.cx, S.pos[v * 3 + 1] - S.cy, S.pos[v * 3 + 2] - S.cz)) / S.cnt[v]);
    error.push(rms); worst = Math.max(worst, rms); importance.push(S.weight[v]); origin.push(v);
  }
  const triangles: number[] = [], sourceFace: number[] = [];
  for (let t = 0; t < S.T; t++) if (S.triAlive[t]) { triangles.push(used[S.tri[t * 3]], used[S.tri[t * 3 + 1]], used[S.tri[t * 3 + 2]]); sourceFace.push(t); }
  const result = mesh({
    id: `${source.id}~${S.collapses}`, positions, triangles,
    attributes: [
      { name: "error", domain: "vertex", size: 1, values: error }, { name: "importance", domain: "vertex", size: 1, values: importance }, { name: "origin", domain: "vertex", size: 1, values: origin },
      { name: "source", domain: "face", size: 1, values: sourceFace },
    ],
  });
  const representative = new Int32Array(V);
  for (let v = 0; v < V; v++) { let at = v; while (S.parent[at] !== at) at = S.parent[at]; representative[v] = at; }
  let census: Record<BlockReason, number> | undefined;
  const abstraction: Abstraction = Object.freeze({
    source, mesh: result, sourceFaces: S.T, faces: S.faces, collapses: S.collapses,
    stop: (S.status === 1 ? "error-limit" : S.status === 2 ? "no-legal-collapse" : "target") as StopReason,
    lastError: S.lastError, maxVertexError: worst, representative, snapshots: snaps,
    blockedCensus: () => (census ??= Object.freeze(blockedOf(S, sideOf(S)))),
  });
  abstractions.set(snaps, abstraction);
  return abstraction;
}

export interface SimplifyOptions {
  /** Stop at the first collapse count whose face count is at most this (at least `SIMPLIFY_LIMITS.minFaces`). Exclusive with `collapses`. */
  readonly targetFaces?: number;
  /** Exactly this many collapses (fewer if none is legal). */
  readonly collapses?: number;
  readonly seed?: number;
  readonly region?: MeshRegion;
  readonly rule?: SimplifyRule;
  readonly boundary?: BoundaryMode;
  readonly creaseAngle?: number;
  readonly maxError?: number;
  readonly cancelled?: () => boolean;
}

const cache = createSimulationCache({ capacity: 6, maxStoredValues: 16_000_000 });

function resolve(source: Mesh, options: SimplifyOptions): { params: SimplifyParams; seed: number; T: number; V: number } {
  const region = checkRegion(options.region ?? { kind: "none" });
  const seed = options.seed ?? 0;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("simplifyMesh: seed must be a uint32 integer");
  const rule = options.rule ?? "quadric", boundary = options.boundary ?? "hold", creaseAngle = options.creaseAngle ?? 0, maxError = options.maxError ?? 0;
  if (!RULES.includes(rule)) throw new Error(`simplifyMesh: rule must be one of ${RULES.join(", ")} (got ${String(rule)})`);
  if (!BOUNDARIES.includes(boundary)) throw new Error(`simplifyMesh: boundary must be one of ${BOUNDARIES.join(", ")} (got ${String(boundary)})`);
  if (typeof creaseAngle !== "number" || !Number.isFinite(creaseAngle) || creaseAngle < 0 || creaseAngle > 180) throw new Error(`simplifyMesh: creaseAngle must be 0..180 degrees (got ${String(creaseAngle)})`);
  if (typeof maxError !== "number" || !Number.isFinite(maxError) || maxError < 0) throw new Error(`simplifyMesh: maxError must be a non-negative number of world units (got ${String(maxError)})`);
  if ((options.targetFaces === undefined) === (options.collapses === undefined)) throw new Error("simplifyMesh: give exactly one of targetFaces and collapses");
  const params: SimplifyParams = {
    mesh: register(source), region: { ...region, invert: region.kind === "none" ? false : Boolean((region as { invert?: boolean }).invert) } as SimplifyParams["region"],
    rule, boundary, creaseAngle, maxError,
  };
  return { params, seed, T: source.triangleCount, V: source.vertexCount };
}

/** Retention for a construction: enough checkpoints to scrub back cheaply while the stored values stay bounded. */
export function simplifyRetention(T: number, V: number): { checkpointEvery: number; historyEvery: number } {
  return { checkpointEvery: Math.max(1, Math.ceil(T / 2 / checkpointCount(T, V))), historyEvery: 0 };
}
function runOptions(T: number, V: number, steps: number, options: SimplifyOptions) {
  const values = stateValues(T, V);
  return { steps, ...simplifyRetention(T, V), maxWork: Number.MAX_SAFE_INTEGER, maxStateValues: 2 * values, maxCheckpointValues: values * (2 + 2 * checkpointCount(T, V)), maxHistoryValues: 1000, ...(options.cancelled ? { cancelled: options.cancelled } : {}) };
}
function checkTarget(source: Mesh, options: SimplifyOptions): number {
  if (options.collapses !== undefined) {
    if (!Number.isInteger(options.collapses) || options.collapses < 0 || options.collapses > source.triangleCount) throw new Error(`simplifyMesh: collapses must be an integer in 0..${source.triangleCount} (got ${String(options.collapses)})`);
    return options.collapses;
  }
  const target = options.targetFaces!;
  if (!Number.isInteger(target) || target < SIMPLIFY_LIMITS.minFaces || target > source.triangleCount)
    throw new Error(`simplifyMesh: targetFaces must be an integer in ${SIMPLIFY_LIMITS.minFaces}..${source.triangleCount} (got ${String(target)})`);
  return Math.ceil((source.triangleCount - target) / 2);
}

/**
 * Simplify `source` (see the module header). Repeated calls with the same construction and a different count
 * extend or replay the cached snapshots instead of starting over.
 */
export function simplifyMesh(source: Mesh, options: SimplifyOptions): Abstraction {
  const { params, seed, T, V } = resolve(source, options);
  let steps = checkTarget(source, options);
  for (;;) {
    const snaps = cache.get(simplifySimulation, params, seed, runOptions(T, V, steps, options));
    const now = snaps.final;
    if (options.collapses !== undefined || now.faces <= options.targetFaces! || now.status !== 0) return build(source, snaps);
    steps += Math.ceil((now.faces - options.targetFaces!) / 2);
  }
}

/** Cooperative `simplifyMesh` (time-sliced, cancellable); resolves `null` when cancelled and publishes nothing. */
export async function prepareSimplification(source: Mesh, options: SimplifyOptions & { cancelled: () => boolean }): Promise<Abstraction | null> {
  const { params, seed, T, V } = resolve(source, options);
  let steps = checkTarget(source, options);
  for (;;) {
    const snaps = await cache.prepare(simplifySimulation, params, seed, runOptions(T, V, steps, options));
    if (!snaps) return null;
    const now = snaps.final;
    if (options.collapses !== undefined || now.faces <= options.targetFaces! || now.status !== 0) return build(source, snaps);
    steps += Math.ceil((now.faces - options.targetFaces!) / 2);
  }
}

/** The mesh after exactly `collapses` collapses of an existing abstraction's construction (a scrub read, replayed from a checkpoint). */
export function abstractionAt(abstraction: Abstraction, collapses: number): Abstraction {
  const snaps = abstraction.snapshots;
  if (!Number.isInteger(collapses) || collapses < 0 || collapses > snaps.steps) throw new Error(`abstractionAt: collapses must be an integer in 0..${snaps.steps} (got ${String(collapses)})`);
  if (collapses === snaps.steps) return abstraction;
  const params = snaps.params as SimplifyParams;
  const run = runSimulation(simplifySimulation, params, snaps.seed, { ...runOptions(abstraction.source.triangleCount, abstraction.source.vertexCount, collapses, {}), from: snaps });
  return build(abstraction.source, run);
}
