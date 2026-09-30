/**
 * Differential surface growth: a triangulated skin whose edges are allowed to lengthen unevenly, relaxed
 * in 3-D, refined where it stretches. The producer of brief 50; it draws nothing.
 *
 * ## Model (what is, and is not, simulated)
 *
 * The surface is an indexed triangle mesh. Each vertex `v` carries MATERIAL coordinates `m_v` (the seed's
 * positions, never changed), a cumulative growth scale `S_v >= 1` and a driving value `G_v` in [0, 1] from
 * the growth field evaluated at `m_v`. The REST length of an edge `{a, b}` is
 *
 *     r_ab = |m_a - m_b| * (S_a + S_b) / 2
 *
 * so growth is one number per vertex and every edge follows from it. Energy, summed over edges and
 * interior edges ("hinges"):
 *
 *     E = sum_e  (len_e - r_e)^2 / (2 r_e)                       (stretch; stiffness 1)
 *       + sum_h  k_h (theta_h - theta0_h)^2 / 2                  (bending)
 *
 * with `theta` the signed dihedral deviation of the two faces at a hinge (0 = coplanar), `theta0` the
 * dihedral of the same four vertices in MATERIAL space (0 for a flat seed, so a sheet rests flat and a
 * sphere rests round), and `k_h = bending * 3 r_e^2 / (A_1 + A_2)` (the discrete-shell hinge stiffness
 * of Grinspun et al., with areas from the rest lengths by Heron's formula), so bending resistance does
 * not change with resolution: `bending` is a rigidity in stretch-modulus times seed-length-squared
 * (an equivalent plate thickness of about sqrt(12 * bending) seed units). This is a spring-and-hinge skin: it is neither cloth physics, nor a
 * finite-element membrane, nor a model of any living tissue. No claim of physical or biological accuracy.
 *
 * ## One step (fixed order)
 *
 * 1. Growth. `S_v <- min(limit, S_v * (1 + rate * G_v))`, vertices in index order. A vertex stops at
 *    `limit`; once every driven vertex is there growth has ended ("grown" in the frame) and the surface
 *    only relaxes.
 * 2. Refinement (when on). Edges longer than `edgeLimit * meanEdge` (the seed's mean edge length) are
 *    candidates; in at most `REFINE_PASSES` passes per step, candidates are taken longest first (ties by
 *    edge id) such that no triangle splits twice in a pass, and each is bisected at its current midpoint
 *    with BOTH adjacent triangles, so the mesh stays conforming and every triangle keeps its winding
 *    (orientation is preserved by construction). The new vertex takes `m` = the midpoint of its parents'
 *    material positions, `S` = their mean, `G` = the field evaluated at the new `m`. The two halves of a
 *    split edge have rest lengths summing exactly to the parent's. Splits stop when the vertex budget
 *    (`maxVertices`) would be exceeded; every candidate then deferred is counted in the frame
 *    (`deferred`), never hidden.
 * 3. Relaxation. Up to `sweeps` Jacobi sweeps of the Gauss-Newton-preconditioned gradient of E: each
 *    unpinned vertex moves by `omega * F_i / K_i` (`K_i` the diagonal of the Gauss-Newton Hessian),
 *    clamped to a quarter of a seed edge; a sweep whose largest move is under `SETTLED * meanEdge` ends
 *    the step early. Pinned vertices never move.
 * 4. A triangle that has collapsed to a sliver (|cross| <= 1e-9 of its longest edge squared) throws,
 *    naming the step, the triangle's vertex ids and the controls that cause it.
 *
 * ## Identity, bounds, units
 *
 * Vertices are born in order and never removed: vertex index `i` IS its birth serial, id `v:<i>`. Seed
 * vertices are `v:0 ... v:N-1`; later ones record their two parents (`parentA < parentB`), birth step and
 * generation as mesh attributes. Faces are re-derived and carry no stable identity (a split replaces a
 * triangle by two). Random draws (the initial normal perturbation) come from
 * `ctx.stream("v:<i>", "perturb")`, so a vertex's draw does not depend on how many others exist. The step
 * count is an F7 simulation: `steps` is scrubbable, checkpoints every `CHECKPOINT_EVERY`, the prefix
 * property holds (`checkSimulation` proves it), and only construction enters the cache key (never palette,
 * camera or treatment). Units: material units of the seed (radius about 1); angles in radians inside.
 * Every limit throws naming the control to lower (`GROWTH_LIMITS`). Self-contact is NOT modelled: a
 * ruffle may pass through a neighbour; `thickness` adds a bounded vertex-vertex repulsion that reduces
 * but does not exclude interpenetration (faces can still cross between vertices).
 */
import { mesh, meshStorage, vertexNormals, type Mesh } from "./mesh.js";
import { createSimulationCache, elementId, finalState, stateAt, type Simulation, type SimulationContext, type Snapshots } from "./snapshots.js";
import type { CompositionRun } from "./types.js";
import type { GrowthField } from "./growth-field.js";
import type { GrowthSeed } from "./growth-seeds.js";
import { memoized } from "./sources.js";

export type GrowthPin = "none" | "rim" | "center" | "side";
export const GROWTH_PINS: readonly GrowthPin[] = Object.freeze(["none", "rim", "center", "side"]);

/** Everything the model computes from (no appearance, no step count). Plain numbers and strings. */
export interface GrowthControls {
  /** Growth per step for a vertex with field value 1 (a fraction of its scale). */
  readonly rate: number;
  /** Largest cumulative expansion of any vertex (`S <= limit`). */
  readonly limit: number;
  /** Bending rigidity in units of the stretch modulus times seed length squared (0 leaves the skin limp). */
  readonly bending: number;
  /** Relaxation sweeps per step, at most. */
  readonly sweeps: number;
  readonly pin: GrowthPin;
  /** Initial random displacement along the surface normal, as a fraction of the seed's mean edge. */
  readonly perturb: number;
  readonly refine: boolean;
  /** Longest edge allowed before splitting, in seed mean edges. */
  readonly edgeLimit: number;
  /** Vertex budget of the refined surface. */
  readonly maxVertices: number;
  /** Contact distance in seed mean edges; 0 turns the repulsion off. */
  readonly thickness: number;
}

export const GROWTH_LIMITS = Object.freeze({
  maxSteps: 1200,
  maxVertices: 16_000,
  minEdgeLimit: 1.1,
  maxEdgeLimit: 4,
  maxSweeps: 60,
  maxRate: 0.2,
  maxScale: 8,
  maxBending: 1,
  maxThickness: 1.5,
  /** Work units (see `growthStepWork`) one run may declare: steps x the worst-case step. */
  maxWork: 400_000_000,
});
export const REFINE_PASSES = 2;
export const CHECKPOINT_EVERY = 25;
/** Largest move, in seed mean edges, under which a sweep counts as settled. */
export const SETTLED = 2e-5;
const MOVE_FRACTION = 0.25;
const OMEGA = 0.5;
const SHIFT = 524_288;

interface State {
  n: number;
  limit: number;
  pos: Float64Array;
  mat: Float64Array;
  scale: Float64Array;
  drive: Float64Array;
  birth: Int32Array;
  parentA: Int32Array;
  parentB: Int32Array;
  generation: Int32Array;
  pinned: Uint8Array;
  tri: Uint32Array;
  splits: number;
  deferred: number;
  residual: number;
  stretchEnergy: number;
  bendEnergy: number;
}

/** What each retained step publishes (plain numbers). */
export interface GrowthFrame {
  readonly step: number;
  readonly vertices: number;
  readonly triangles: number;
  /** Edge splits so far, and candidates deferred by the vertex budget so far. */
  readonly splits: number;
  readonly deferred: number;
  /** Largest move of the last relaxation sweep, in seed mean edges. */
  readonly residual: number;
  readonly stretchEnergy: number;
  readonly bendEnergy: number;
  /** Driven vertices still below `limit`; 0 means growth has ended. */
  readonly growing: number;
}

// ---------------------------------------------------------------------------------------- checks

const fail = (message: string): never => { throw new Error(message); };
const inRange = (name: string, value: unknown, low: number, high: number, integer = false): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high || (integer && !Number.isInteger(value)))
    fail(`${name} must be ${integer ? "an integer" : "a number"} in ${low}..${high} (got ${String(value)})`);
  return value as number;
};

/** Validate controls against a seed; every failure names the control to change. */
export function checkGrowth(seed: GrowthSeed, c: GrowthControls, steps: number): void {
  const L = GROWTH_LIMITS;
  inRange("Steps", steps, 0, L.maxSteps, true);
  inRange("Growth rate", c.rate, 0, L.maxRate); inRange("Growth limit", c.limit, 1, L.maxScale);
  inRange("Bending", c.bending, 0, L.maxBending); inRange("Relaxation", c.sweeps, 1, L.maxSweeps, true);
  inRange("Perturbation", c.perturb, 0, 1); inRange("Edge limit", c.edgeLimit, L.minEdgeLimit, L.maxEdgeLimit);
  inRange("Contact distance", c.thickness, 0, L.maxThickness);
  if (!GROWTH_PINS.includes(c.pin)) fail(`Pin must be one of ${GROWTH_PINS.join(", ")} (got ${String(c.pin)})`);
  if (typeof c.refine !== "boolean") fail("Refine must be true or false");
  const n = seed.mesh.vertexCount;
  if (n > L.maxVertices) fail(`Seed surface "${seed.id}" has ${n} vertices; the limit is ${L.maxVertices}; lower Resolution`);
  if (!Number.isInteger(c.maxVertices) || c.maxVertices < n || c.maxVertices > L.maxVertices)
    fail(`Vertex limit must be an integer from ${n} (the seed surface's own vertices) to ${L.maxVertices} (got ${String(c.maxVertices)}); raise Vertex limit or lower Resolution`);
  if (c.pin !== "none" && seed.pins[c.pin].length === 0)
    fail(`Pin "${c.pin}" has no vertices on the closed surface "${seed.id}"; choose another pin or an open seed surface`);
  const work = growthStepWork(seed, c) * steps + initialWork(seed);
  if (work > L.maxWork)
    fail(`Steps x the worst-case step would cost ${Math.round(work / 1e6)}M work units; the limit is ${Math.round(L.maxWork / 1e6)}M. Lower Steps, Relaxation or Vertex limit`);
}

const maxVerticesOf = (seed: GrowthSeed, c: GrowthControls): number => c.refine ? Math.max(c.maxVertices, seed.mesh.vertexCount) : seed.mesh.vertexCount;
/** Declared worst case of one step: the work units it may charge (edges about 3V, hinges 3V, triangles 2V). */
export const growthStepWork = (seed: GrowthSeed, c: GrowthControls): number => {
  const v = maxVerticesOf(seed, c);
  return 16 * v * c.sweeps + 70 * v * (c.refine ? 1 + REFINE_PASSES : 1) + (c.thickness > 0 ? 40 * v * c.sweeps / 4 : 0);
};
const initialWork = (seed: GrowthSeed): number => 40 * seed.mesh.vertexCount + 1000;

// -------------------------------------------------------------------------------------- tables

interface Tables {
  edges: number;
  edgeA: Uint32Array;
  edgeB: Uint32Array;
  /** Corners (3 * triangle + k) of the triangle holding the directed edge a->b, and of the one holding b->a (-1 on the boundary). */
  cornerFwd: Int32Array;
  cornerBack: Int32Array;
  hinges: number;
  hinge: Uint32Array;
}

/** Edge and hinge tables of a triangle list: one sort of packed edge keys, linear in the corners. */
export function growthTables(n: number, tri: Uint32Array): Tables {
  const C = tri.length, keys = new Float64Array(C);
  for (let c = 0; c < C; c++) {
    const t = Math.floor(c / 3), k = c - t * 3, a = tri[c], b = tri[t * 3 + (k + 1) % 3];
    keys[c] = ((a < b ? a : b) * n + (a < b ? b : a)) * SHIFT + c;
  }
  keys.sort();
  const edgeA: number[] = [], edgeB: number[] = [], fwd: number[] = [], back: number[] = [];
  for (let i = 0; i < C;) {
    const first = keys[i], c1 = first % SHIFT, key = (first - c1) / SHIFT;
    let j = i + 1, c2 = -1;
    if (j < C) { const second = keys[j], cc = second % SHIFT; if ((second - cc) / SHIFT === key) { c2 = cc; j++; } }
    if (j < C) { const third = keys[j]; if ((third - (third % SHIFT)) / SHIFT === key) fail(`Surface growth: edge ${Math.floor(key / n)}-${key % n} has three faces; the surface is not manifold`); }
    const lo = Math.floor(key / n), hi = key - lo * n;
    const t1 = Math.floor(c1 / 3), a1 = tri[c1], b1 = tri[t1 * 3 + (c1 - t1 * 3 + 1) % 3];
    const forward = a1 === lo && b1 === hi;
    edgeA.push(lo); edgeB.push(hi);
    if (c2 < 0) { fwd.push(forward ? c1 : -1); back.push(forward ? -1 : c1); } else {
      const t2 = Math.floor(c2 / 3), a2 = tri[c2], b2 = tri[t2 * 3 + (c2 - t2 * 3 + 1) % 3];
      if ((a2 === lo && b2 === hi) === forward) fail(`Surface growth: faces ${t1} and ${t2} traverse edge ${lo}-${hi} the same way; the orientation is inconsistent`);
      fwd.push(forward ? c1 : c2); back.push(forward ? c2 : c1);
    }
    i = j;
  }
  const hingeList: number[] = [];
  for (let e = 0; e < edgeA.length; e++) {
    if (fwd[e] < 0 || back[e] < 0) continue;
    const cf = fwd[e], cb = back[e], tf = Math.floor(cf / 3), tb = Math.floor(cb / 3);
    hingeList.push(edgeA[e], edgeB[e], tri[tf * 3 + (cf - tf * 3 + 2) % 3], tri[tb * 3 + (cb - tb * 3 + 2) % 3], e);
  }
  return {
    edges: edgeA.length, edgeA: Uint32Array.from(edgeA), edgeB: Uint32Array.from(edgeB), cornerFwd: Int32Array.from(fwd), cornerBack: Int32Array.from(back),
    hinges: hingeList.length / 5, hinge: Uint32Array.from(hingeList),
  };
}

// ------------------------------------------------------------------------------------ geometry

/**
 * Signed dihedral deviation of the hinge `x1 x2 | x3 x4` (triangles `(x1, x2, x3)` and `(x2, x1, x4)`,
 * both counter-clockwise): 0 when coplanar, positive when face 2's normal turns counter-clockwise
 * about `x1 -> x2` relative to face 1's. `gradient` (12 numbers: x1, x2, x3, x4) receives its derivative
 * with respect to the four positions. Returns NaN for a collapsed face.
 */
export function hingeAngle(p: ArrayLike<number>, x1: number, x2: number, x3: number, x4: number, gradient?: Float64Array): number {
  const ex = p[x2 * 3] - p[x1 * 3], ey = p[x2 * 3 + 1] - p[x1 * 3 + 1], ez = p[x2 * 3 + 2] - p[x1 * 3 + 2];
  const ax = p[x3 * 3] - p[x1 * 3], ay = p[x3 * 3 + 1] - p[x1 * 3 + 1], az = p[x3 * 3 + 2] - p[x1 * 3 + 2];
  const bx = p[x4 * 3] - p[x1 * 3], by = p[x4 * 3 + 1] - p[x1 * 3 + 1], bz = p[x4 * 3 + 2] - p[x1 * 3 + 2];
  const n1x = ey * az - ez * ay, n1y = ez * ax - ex * az, n1z = ex * ay - ey * ax;
  const n2x = by * ez - bz * ey, n2y = bz * ex - bx * ez, n2z = bx * ey - by * ex;
  const l1 = Math.hypot(n1x, n1y, n1z), l2 = Math.hypot(n2x, n2y, n2z), L = Math.hypot(ex, ey, ez);
  if (!(l1 > 0) || !(l2 > 0) || !(L > 0)) return NaN;
  const u1x = n1x / l1, u1y = n1y / l1, u1z = n1z / l1, u2x = n2x / l2, u2y = n2y / l2, u2z = n2z / l2;
  const cx = u1y * u2z - u1z * u2y, cy = u1z * u2x - u1x * u2z, cz = u1x * u2y - u1y * u2x;
  const theta = Math.atan2((cx * ex + cy * ey + cz * ez) / L, u1x * u2x + u1y * u2y + u1z * u2z);
  if (gradient) {
    const s3 = -L / l1, s4 = -L / l2, L2 = L * L;
    const t3 = (ax * ex + ay * ey + az * ez) / L2, t4 = (bx * ex + by * ey + bz * ez) / L2;
    const g3x = s3 * u1x, g3y = s3 * u1y, g3z = s3 * u1z, g4x = s4 * u2x, g4y = s4 * u2y, g4z = s4 * u2z;
    gradient[6] = g3x; gradient[7] = g3y; gradient[8] = g3z; gradient[9] = g4x; gradient[10] = g4y; gradient[11] = g4z;
    gradient[0] = -(1 - t3) * g3x - (1 - t4) * g4x; gradient[1] = -(1 - t3) * g3y - (1 - t4) * g4y; gradient[2] = -(1 - t3) * g3z - (1 - t4) * g4z;
    gradient[3] = -t3 * g3x - t4 * g4x; gradient[4] = -t3 * g3y - t4 * g4y; gradient[5] = -t3 * g3z - t4 * g4z;
  }
  return theta;
}

const wrap = (angle: number): number => angle > Math.PI ? angle - 2 * Math.PI : angle < -Math.PI ? angle + 2 * Math.PI : angle;
const distance = (p: ArrayLike<number>, a: number, b: number): number => Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);
const restLength = (s: State, a: number, b: number): number => distance(s.mat, a, b) * (s.scale[a] + s.scale[b]) / 2;
function heron(a: number, b: number, c: number): number {
  const s = (a + b + c) / 2, q = s * (s - a) * (s - b) * (s - c);
  return q > 0 ? Math.sqrt(q) : 0;
}

/** Rest state of the current growth: edge rest lengths, hinge stiffnesses and rest angles. */
interface Rest { r: Float64Array; kh: Float64Array; theta0: Float64Array }
function restOf(s: State, t: Tables, bending: number): Rest {
  const r = new Float64Array(t.edges), kh = new Float64Array(t.hinges), theta0 = new Float64Array(t.hinges);
  for (let e = 0; e < t.edges; e++) r[e] = restLength(s, t.edgeA[e], t.edgeB[e]);
  for (let h = 0; h < t.hinges; h++) {
    const x1 = t.hinge[h * 5], x2 = t.hinge[h * 5 + 1], x3 = t.hinge[h * 5 + 2], x4 = t.hinge[h * 5 + 3], e = t.hinge[h * 5 + 4];
    const area = heron(r[e], restLength(s, x1, x3), restLength(s, x2, x3)) + heron(r[e], restLength(s, x1, x4), restLength(s, x2, x4));
    kh[h] = area > 0 ? bending * 3 * r[e] * r[e] / area : 0;
    const angle = hingeAngle(s.mat, x1, x2, x3, x4);
    theta0[h] = Number.isNaN(angle) ? 0 : angle;
  }
  return { r, kh, theta0 };
}

/** Energy and its per-vertex force and Gauss-Newton diagonal at the current positions. */
function evaluate(s: State, t: Tables, rest: Rest, force: Float64Array, diagonal: Float64Array): { stretch: number; bend: number } {
  const p = s.pos;
  force.fill(0, 0, s.n * 3); diagonal.fill(0, 0, s.n);
  let stretch = 0, bend = 0;
  for (let e = 0; e < t.edges; e++) {
    const a = t.edgeA[e], b = t.edgeB[e], r = rest.r[e];
    const dx = p[b * 3] - p[a * 3], dy = p[b * 3 + 1] - p[a * 3 + 1], dz = p[b * 3 + 2] - p[a * 3 + 2];
    const len = Math.hypot(dx, dy, dz);
    if (!(r > 0)) continue;
    const extension = len - r;
    stretch += extension * extension / (2 * r);
    diagonal[a] += 1 / r; diagonal[b] += 1 / r;
    if (len > 0) {
      const k = extension / r / len;
      force[a * 3] += k * dx; force[a * 3 + 1] += k * dy; force[a * 3 + 2] += k * dz;
      force[b * 3] -= k * dx; force[b * 3 + 1] -= k * dy; force[b * 3 + 2] -= k * dz;
    }
  }
  const g = hingeScratch;
  for (let h = 0; h < t.hinges; h++) {
    const k = rest.kh[h];
    if (!(k > 0)) continue;
    const x1 = t.hinge[h * 5], x2 = t.hinge[h * 5 + 1], x3 = t.hinge[h * 5 + 2], x4 = t.hinge[h * 5 + 3];
    const theta = hingeAngle(p, x1, x2, x3, x4, g);
    if (Number.isNaN(theta)) continue;
    const d = wrap(theta - rest.theta0[h]);
    bend += 0.5 * k * d * d;
    const ids = [x1, x2, x3, x4];
    for (let q = 0; q < 4; q++) {
      const v = ids[q], gx = g[q * 3], gy = g[q * 3 + 1], gz = g[q * 3 + 2];
      force[v * 3] -= k * d * gx; force[v * 3 + 1] -= k * d * gy; force[v * 3 + 2] -= k * d * gz;
      diagonal[v] += k * (gx * gx + gy * gy + gz * gz);
    }
  }
  return { stretch, bend };
}
const hingeScratch = new Float64Array(12);

// ---------------------------------------------------------------------------------- simulation

const identifier = (index: number): string => elementId("v", index);

/** The model for one seed surface and growth field, as an F7 simulation (see the module header). */
export function surfaceGrowthSimulation(seed: GrowthSeed, field: GrowthField): Simulation<State, GrowthControls, GrowthFrame> {
  const meanEdge = seed.meanEdge;
  const sourceId = `surface-growth:${seed.key.slice(0, 24)}:${field.key.slice(0, 24)}`;
  const seedPositions = (): Float64Array => {
    const out = new Float64Array(seed.mesh.vertexCount * 3);
    out.set(meshStorage(seed.mesh).positions);
    return out;
  };

  const initial = (ctx: SimulationContext<GrowthControls>): State => {
    const c = ctx.params, n = seed.mesh.vertexCount, mat = seedPositions(), pos = mat.slice();
    const normals = vertexNormals(seed.mesh), pinned = new Uint8Array(n);
    if (c.pin !== "none") for (const v of seed.pins[c.pin]) pinned[v] = 1;
    const drive = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      drive[i] = field.sample(mat[i * 3], mat[i * 3 + 1], mat[i * 3 + 2]);
      if (c.perturb > 0 && !pinned[i]) {
        const amplitude = c.perturb * meanEdge * (2 * ctx.stream(identifier(i), "perturb").next() - 1);
        pos[i * 3] += normals[i * 3] * amplitude; pos[i * 3 + 1] += normals[i * 3 + 1] * amplitude; pos[i * 3 + 2] += normals[i * 3 + 2] * amplitude;
      }
    }
    ctx.charge(initialWork(seed));
    return {
      n, limit: c.limit, pos, mat, scale: new Float64Array(n).fill(1), drive, birth: new Int32Array(n), parentA: new Int32Array(n).fill(-1), parentB: new Int32Array(n).fill(-1),
      generation: new Int32Array(n), pinned, tri: meshStorage(seed.mesh).triangles.slice(), splits: 0, deferred: 0, residual: 0, stretchEnergy: 0, bendEnergy: 0,
    };
  };

  const step = (s: State, ctx: SimulationContext<GrowthControls>): State => {
    const c = ctx.params, limit = c.limit;
    // 1. growth
    for (let i = 0; i < s.n; i++) if (s.drive[i] > 0 && s.scale[i] < limit) s.scale[i] = Math.min(limit, s.scale[i] * (1 + c.rate * s.drive[i]));
    ctx.charge(s.n);
    // 2. refinement
    let tables = growthTables(s.n, s.tri);
    ctx.charge(6 * s.tri.length / 3 + 4 * tables.edges);
    if (c.refine) for (let pass = 0; pass < REFINE_PASSES; pass++) {
      if (!splitPass(s, tables, c, ctx.step, field, meanEdge)) break;
      tables = growthTables(s.n, s.tri);
      ctx.charge(6 * s.tri.length / 3 + 4 * tables.edges);
    }
    // 3. relaxation
    const rest = restOf(s, tables, c.bending), force = new Float64Array(s.n * 3), diagonal = new Float64Array(s.n);
    ctx.charge(4 * tables.hinges + 2 * tables.edges);
    const contacts = c.thickness > 0 ? contactPairs(s, tables, c.thickness * meanEdge) : null;
    if (contacts) ctx.charge(contacts.work);
    const maxMove = MOVE_FRACTION * meanEdge;
    let residual = 0, energy = { stretch: 0, bend: 0 };
    for (let sweep = 0; sweep < c.sweeps; sweep++) {
      energy = evaluate(s, tables, rest, force, diagonal);
      if (contacts) addContact(s, contacts.pairs, c.thickness * meanEdge, force, diagonal);
      ctx.charge(tables.edges + 4 * tables.hinges + s.n + (contacts ? contacts.pairs.length / 2 : 0));
      residual = 0;
      for (let i = 0; i < s.n; i++) {
        if (s.pinned[i] || !(diagonal[i] > 0)) continue;
        let dx = OMEGA * force[i * 3] / diagonal[i], dy = OMEGA * force[i * 3 + 1] / diagonal[i], dz = OMEGA * force[i * 3 + 2] / diagonal[i];
        const length = Math.hypot(dx, dy, dz);
        if (length > residual) residual = length;
        if (length > maxMove) { const k = maxMove / length; dx *= k; dy *= k; dz *= k; }
        s.pos[i * 3] += dx; s.pos[i * 3 + 1] += dy; s.pos[i * 3 + 2] += dz;
      }
      if (residual < SETTLED * meanEdge) break;
    }
    s.residual = residual / meanEdge; s.stretchEnergy = energy.stretch; s.bendEnergy = energy.bend;
    // 4. collapsed triangles
    checkCollapsed(s, ctx.step);
    return s;
  };

  const project = (s: State, at: number): GrowthFrame => {
    let growing = 0;
    for (let i = 0; i < s.n; i++) if (s.drive[i] > 0 && s.scale[i] < s.limit) growing++;
    return { step: at, vertices: s.n, triangles: s.tri.length / 3, splits: s.splits, deferred: s.deferred, residual: s.residual,
      stretchEnergy: s.stretchEnergy, bendEnergy: s.bendEnergy, growing };
  };

  return {
    id: sourceId,
    limits: (c) => ({ stepLimit: GROWTH_LIMITS.maxSteps, workPerStep: growthStepWork(seed, c), initialWork: initialWork(seed) }),
    initial, step, project,
  };
}

// ---------------------------------------------------------------------------------- refinement

const extend = <T extends Float64Array | Int32Array | Uint8Array | Uint32Array>(array: T, length: number): T => {
  const out = new (array.constructor as new (n: number) => T)(length);
  out.set(array);
  return out;
};

/** One refinement pass; true when at least one edge was split. The state's arrays are replaced, never mutated in place. */
function splitPass(s: State, t: Tables, c: GrowthControls, step: number, field: GrowthField, meanEdge: number): boolean {
  const limit = c.edgeLimit * meanEdge, lengths = new Float64Array(t.edges), candidates: number[] = [];
  for (let e = 0; e < t.edges; e++) { lengths[e] = distance(s.pos, t.edgeA[e], t.edgeB[e]); if (lengths[e] > limit) candidates.push(e); }
  if (candidates.length === 0) return false;
  candidates.sort((x, y) => lengths[y] - lengths[x] || x - y);
  const used = new Uint8Array(s.tri.length / 3), chosen: number[] = [];
  let added = 0, refused = 0;
  for (const e of candidates) {
    const cf = t.cornerFwd[e], cb = t.cornerBack[e], tf = cf >= 0 ? Math.floor(cf / 3) : -1, tb = cb >= 0 ? Math.floor(cb / 3) : -1;
    if ((tf >= 0 && used[tf]) || (tb >= 0 && used[tb])) continue;
    if (s.n + chosen.length + 1 > c.maxVertices) { refused++; continue; }
    if (tf >= 0) { used[tf] = 1; added++; }
    if (tb >= 0) { used[tb] = 1; added++; }
    chosen.push(e);
  }
  s.deferred = Math.max(s.deferred, refused);
  if (chosen.length === 0) return false;
  const n0 = s.n, n1 = n0 + chosen.length, T0 = s.tri.length / 3;
  s.pos = extend(s.pos, n1 * 3); s.mat = extend(s.mat, n1 * 3); s.scale = extend(s.scale, n1); s.drive = extend(s.drive, n1);
  s.birth = extend(s.birth, n1); s.parentA = extend(s.parentA, n1); s.parentB = extend(s.parentB, n1); s.generation = extend(s.generation, n1);
  s.pinned = extend(s.pinned, n1);
  const tri = extend(s.tri, s.tri.length + added * 3);
  let next = T0;
  chosen.forEach((e, j) => {
    const a = t.edgeA[e], b = t.edgeB[e], v = n0 + j;
    for (let k = 0; k < 3; k++) {
      s.pos[v * 3 + k] = (s.pos[a * 3 + k] + s.pos[b * 3 + k]) / 2;
      s.mat[v * 3 + k] = (s.mat[a * 3 + k] + s.mat[b * 3 + k]) / 2;
    }
    s.scale[v] = (s.scale[a] + s.scale[b]) / 2;
    s.drive[v] = field.sample(s.mat[v * 3], s.mat[v * 3 + 1], s.mat[v * 3 + 2]);
    s.birth[v] = step; s.parentA[v] = a; s.parentB[v] = b;
    s.generation[v] = Math.max(s.generation[a], s.generation[b]) + 1;
    s.pinned[v] = s.pinned[a] && s.pinned[b] ? 1 : 0;
    for (const corner of [t.cornerFwd[e], t.cornerBack[e]]) {
      if (corner < 0) continue;
      const tt = Math.floor(corner / 3), k = corner - tt * 3;
      const q = tri[tt * 3 + (k + 1) % 3], r = tri[tt * 3 + (k + 2) % 3];
      tri[tt * 3 + (k + 1) % 3] = v;
      tri[next * 3] = v; tri[next * 3 + 1] = q; tri[next * 3 + 2] = r; next++;
    }
  });
  s.tri = tri; s.n = n1; s.splits += chosen.length;
  return true;
}

// ------------------------------------------------------------------------------------- contact

interface Contacts { pairs: Uint32Array; work: number }

/** Vertex pairs closer than `range` that are neither neighbours nor share a neighbour, from a uniform 3-D hash grid. */
function contactPairs(s: State, t: Tables, range: number): Contacts {
  const near: number[][] = Array.from({ length: s.n }, () => []);
  for (let e = 0; e < t.edges; e++) { near[t.edgeA[e]].push(t.edgeB[e]); near[t.edgeB[e]].push(t.edgeA[e]); }
  const cells = new Map<number, number[]>(), cell = (x: number): number => Math.floor(x / range);
  const key = (i: number, j: number, k: number): number => ((i + 512) * 1024 + (j + 512)) * 1024 + (k + 512);
  for (let v = 0; v < s.n; v++) {
    const id = key(cell(s.pos[v * 3]), cell(s.pos[v * 3 + 1]), cell(s.pos[v * 3 + 2]));
    const list = cells.get(id);
    if (list) list.push(v); else cells.set(id, [v]);
  }
  const out: number[] = [], range2 = range * range;
  let work = s.n;
  for (let v = 0; v < s.n; v++) {
    const ci = cell(s.pos[v * 3]), cj = cell(s.pos[v * 3 + 1]), ck = cell(s.pos[v * 3 + 2]), found: number[] = [];
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (let k = ck - 1; k <= ck + 1; k++) {
      const list = cells.get(key(i, j, k));
      if (!list) continue;
      for (const w of list) {
        if (w <= v) continue;
        work++;
        const dx = s.pos[w * 3] - s.pos[v * 3], dy = s.pos[w * 3 + 1] - s.pos[v * 3 + 1], dz = s.pos[w * 3 + 2] - s.pos[v * 3 + 2];
        if (dx * dx + dy * dy + dz * dz >= range2) continue;
        const nv = near[v], nw = near[w];
        if (nv.includes(w) || nv.some((x) => nw.includes(x))) continue;
        found.push(w);
      }
    }
    found.sort((x, y) => x - y);
    for (const w of found) out.push(v, w);
  }
  return { pairs: Uint32Array.from(out), work };
}

/** Repulsion `k (range - d)^2 / 2` between the contact pairs, stiffness `2 / meanEdge`-scaled through `range`. */
function addContact(s: State, pairs: Uint32Array, range: number, force: Float64Array, diagonal: Float64Array): void {
  const k = 2 / range;
  for (let q = 0; q < pairs.length; q += 2) {
    const a = pairs[q], b = pairs[q + 1];
    const dx = s.pos[b * 3] - s.pos[a * 3], dy = s.pos[b * 3 + 1] - s.pos[a * 3 + 1], dz = s.pos[b * 3 + 2] - s.pos[a * 3 + 2];
    const d = Math.hypot(dx, dy, dz);
    if (!(d < range) || !(d > 0)) continue;
    const push = k * (range - d) / d;
    force[a * 3] -= push * dx; force[a * 3 + 1] -= push * dy; force[a * 3 + 2] -= push * dz;
    force[b * 3] += push * dx; force[b * 3 + 1] += push * dy; force[b * 3 + 2] += push * dz;
    diagonal[a] += k; diagonal[b] += k;
  }
}

function checkCollapsed(s: State, step: number): void {
  const p = s.pos;
  for (let t = 0; t < s.tri.length / 3; t++) {
    const a = s.tri[t * 3], b = s.tri[t * 3 + 1], c = s.tri[t * 3 + 2];
    const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
    const cross = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    const longest = Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), distance(p, b, c));
    if (!(cross > 1e-9 * longest * longest))
      throw new Error(`Surface growth: triangle ${t} (${identifier(a)}, ${identifier(b)}, ${identifier(c)}) collapsed at step ${step}; lower Growth rate or Growth limit, or raise Bending or Relaxation`);
  }
}

// -------------------------------------------------------------------------------------- results

export type GrowthSnapshots = Snapshots<State, GrowthControls, GrowthFrame>;
export const GROWTH_RETENTION = Object.freeze({ checkpointEvery: CHECKPOINT_EVERY, historyEvery: 1 });
/** The shared content-keyed cache of grown surfaces (four runs). */
export const surfaceGrowthCache = createSimulationCache({ capacity: 4, maxStoredValues: 10_000_000 });
const simulations = new Map<string, Simulation<State, GrowthControls, GrowthFrame>>();

export interface GrowthRunOptions { cancelled?: () => boolean; run?: CompositionRun }
const runOptions = (steps: number, options: GrowthRunOptions) =>
  ({ steps, ...GROWTH_RETENTION, maxWork: GROWTH_LIMITS.maxWork, maxStateValues: 2_000_000, maxCheckpointValues: 10_000_000, maxHistoryValues: 4_000_000, ...options });
const simulationFor = (seed: GrowthSeed, field: GrowthField): Simulation<State, GrowthControls, GrowthFrame> => {
  const sim = surfaceGrowthSimulation(seed, field);
  return memoized(simulations, sim.id, () => sim);
};

/**
 * The cached snapshots of `seed` grown under `field` for `steps` steps (uint32 `noiseSeed` seeds the initial
 * perturbation). A longer request extends a cached run; a shorter one replays from its nearest checkpoint.
 */
export function surfaceGrowthSnapshots(seed: GrowthSeed, field: GrowthField, controls: GrowthControls, noiseSeed: number, steps: number, options: GrowthRunOptions = {}): GrowthSnapshots {
  checkGrowth(seed, controls, steps);
  return surfaceGrowthCache.get(simulationFor(seed, field), { ...controls }, noiseSeed, runOptions(steps, options));
}

/** Cooperative version; null when cancelled (nothing is stored). */
export async function prepareSurfaceGrowth(seed: GrowthSeed, field: GrowthField, controls: GrowthControls, noiseSeed: number, steps: number, cancelled: () => boolean): Promise<GrowthSnapshots | null> {
  checkGrowth(seed, controls, steps);
  return surfaceGrowthCache.prepare(simulationFor(seed, field), { ...controls }, noiseSeed, runOptions(steps, { cancelled }));
}

/** The grown surface at one step: a validated `Mesh` with attributes, and the frame that produced it. */
export interface GrownSurface {
  readonly mesh: Mesh;
  readonly step: number;
  readonly frame: GrowthFrame;
}

const surfaces = new WeakMap<GrowthSnapshots, Map<number, GrownSurface>>();

/**
 * The mesh at `step` (default the last). Vertex `i` is `v:<i>`, born in index order. Attributes (per vertex):
 * `growth` (S, cumulative expansion), `field` (G, the driving value), `stretch` (mean over incident edges of
 * length / rest length - 1: positive in tension, negative in compression), `birth` (step), `generation`
 * (split depth) and `parentA`, `parentB` (parent vertex indices, -1 for seed vertices). Cached per snapshots.
 */
export function grownSurface(snaps: GrowthSnapshots, step = snaps.steps): GrownSurface {
  let byStep = surfaces.get(snaps);
  if (!byStep) { byStep = new Map(); surfaces.set(snaps, byStep); }
  const hit = byStep.get(step);
  if (hit) return hit;
  const state = step === snaps.steps ? finalState(snaps) : stateAt(snaps, step);
  const tables = growthTables(state.n, state.tri), rest = restOf(state, tables, 0);
  const strain = new Float64Array(state.n), degree = new Float64Array(state.n);
  for (let e = 0; e < tables.edges; e++) {
    const a = tables.edgeA[e], b = tables.edgeB[e], value = rest.r[e] > 0 ? distance(state.pos, a, b) / rest.r[e] - 1 : 0;
    strain[a] += value; strain[b] += value; degree[a]++; degree[b]++;
  }
  for (let i = 0; i < state.n; i++) if (degree[i] > 0) strain[i] /= degree[i];
  const built = mesh({
    id: `surface-growth-${step}`, positions: state.pos, triangles: state.tri,
    attributes: [
      { name: "growth", domain: "vertex", size: 1, values: state.scale }, { name: "field", domain: "vertex", size: 1, values: state.drive },
      { name: "stretch", domain: "vertex", size: 1, values: strain }, { name: "birth", domain: "vertex", size: 1, values: state.birth },
      { name: "generation", domain: "vertex", size: 1, values: state.generation },
      { name: "parentA", domain: "vertex", size: 1, values: state.parentA }, { name: "parentB", domain: "vertex", size: 1, values: state.parentB },
    ],
  });
  const frame = step === snaps.steps ? snaps.final as GrowthFrame : (snaps.history.find((entry) => entry.step === step)?.value as GrowthFrame | undefined) ?? snaps.simulation.project!(state, step);
  const result = Object.freeze({ mesh: built, step, frame });
  byStep.set(step, result);
  if (byStep.size > 6) byStep.delete(byStep.keys().next().value!);
  return result;
}
