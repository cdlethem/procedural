/**
 * Planar sections and iso-contours of a mesh (F8): exact level-set curves on the triangulated surface, assembled into
 * polylines with vertex/edge/face provenance, and closed sections turned into planar domains with holes.
 *
 * ONE tracer serves both. A plane section is the level 0 of the signed distance to the plane; an iso-contour is the level
 * `c` of a per-vertex scalar. Both classify every vertex once as ABOVE or BELOW the level, and every later decision uses
 * only those classifications, so two triangles sharing an edge always agree about it (no crack, no duplicate, no missing
 * segment) and the result on a closed manifold mesh is always closed loops.
 *
 * Classification and ties.
 * - A plane section classifies a vertex by the EXACT sign of `n . (p - q)` for the plane's own point `q` and normal `n`
 *   (a floating-point filter, then exact BigInt arithmetic on the dyadic inputs, as the planar-domain kernel does), so a
 *   vertex on the plane is recognised as such however the plane was computed.
 * - An iso-contour compares the stored value with the level exactly.
 * - A vertex EXACTLY on the level belongs to `ties` (default `"above"`): the section is that of the level moved an
 *   infinitesimal amount below (or, with `"below"`, above) it. Consequences, all deliberate: a face lying in the plane
 *   is above and contributes no segment, its outline appears through the neighbouring faces; a cube whose top face is in
 *   the plane has a square section at the top and one whose bottom face is in the plane has none (`"below"` reverses
 *   this); touching the mesh at a vertex or along an edge leaves no section (a loop of fewer than three distinct points,
 *   or an open chain of one point, is dropped and counted in `degenerate`); a closed manifold mesh never yields an open chain.
 * - Saddles: the surface is the mesh's TRIANGULATION (a quad is two triangles along its shorter diagonal, see `mesh.ts`).
 *   Inside a triangle the field is linear, so there is no ambiguity; at a quad the diagonal decides, the same for every
 *   level. Points where a curve crosses a quad's diagonal are ordinary nodes (`diagonal: true`).
 *
 * Nodes and points. A node lies on a mesh (or diagonal) edge `{a < b}`: `t` is the parameter from `a`, computed once per
 * edge from the two vertex values (`t = w_a / (w_a - w_b)`, clamped to [0, 1]), so both faces sharing the edge read the
 * same bits; a vertex exactly on the level is the point itself (`vertex` >= 0, `t` 0 or 1). Nodes are per edge, not per
 * position, so a curve that passes through a vertex keeps the pairing of its fan (the section of a saddle vertex
 * stays two arcs); consecutive nodes with identical coordinates collapse into one point in the output.
 *
 * Assembly. Segments join at edge nodes. A node has as many segments as triangles on its edge: 2 in a manifold (also
 * across a quad diagonal), 1 on a boundary edge, 3 or more on a non-manifold edge. Chains run through nodes of degree 2
 * and stop at every other node: boundary ends and non-manifold ends are reported per chain in `ends`
 * (`"boundary"` / `"non-manifold"`); nothing is guessed across a non-manifold edge. Cycles of degree-2 nodes are closed
 * loops.
 *
 * Orientation. Each triangle's segment runs with the ABOVE side on its left seen from outside the surface (in the
 * plane's frame seen from the normal side: the solid interior on the left), so on a closed, consistently oriented mesh
 * outer loops are counter-clockwise (positive `area` in the frame) and holes clockwise. A chain is oriented by the
 * majority of its segments; orientation is reliable only where `meshTopology(mesh).kind` is `closed-manifold` or
 * `open-manifold`.
 *
 * Ids. A curve is `<plane id>/t<k>` (sections) or `L<level>/t<k>` (contours) where `k` is the LOWEST triangle index the
 * curve uses; each triangle hosts at most one segment of a level, so ids are unique, independent of traversal, and
 * survive small movements of the level that do not change which triangle is lowest.
 *
 * Plane frame (`planeFrame`): origin the plane's point; `n` the unit normal; `u` the unit projection onto the plane of the
 * coordinate axis along which `n` is smallest (first of x, y, z on ties); `v = n x u`. `(u, v, n)` is right-handed, so a
 * loop that is counter-clockwise seen from the normal side is counter-clockwise in `(u, v)` coordinates.
 *
 * Domains. `sectionDomain` turns the closed loops of a section into a `PlanarDomain` in `(u, v)` by the even-odd fill of
 * the planar-domain foundation, so nested loops become holes by containment (a torus cut across its axis is an annulus, a
 * hollow shell a ring). Open chains are rejected by default (`open: "ignore"` leaves them out).
 *
 * Work is bounded: every plane or level charges its vertices, triangles and nodes; over `maxWork` (default
 * `DEFAULT_SECTION_WORK`) the call throws naming `maxWork` and what to reduce, and more than `SECTION_LIMITS` planes or
 * levels throws naming the control. Results are cached by mesh key and construction (up to 512 sections, 6 contour sets).
 */
import { meshStorage, type Mesh, type Vec3 } from "./mesh.js";
import { ringsDomain, type PlanarDomain } from "./domains.js";
import { sha256Hex } from "./raster.js";
import type { SpatialCurve } from "./visibility.js";
import type { CompositionRun } from "./types.js";

export const SECTION_LIMITS = Object.freeze({ maxPlanes: 512, maxLevels: 512 });
export const DEFAULT_SECTION_WORK = 30_000_000;

export type ContourEnd = "boundary" | "non-manifold";
export type LevelTies = "above" | "below";

export interface ContourNode {
  /** Mesh (or quad-diagonal) edge `[a, b]`, `a < b`, the point lies on. */
  readonly edge: readonly [number, number];
  /** Parameter from `a` toward `b`. */
  readonly t: number;
  /** The mesh vertex the point coincides with (exactly on the level), else -1. */
  readonly vertex: number;
  /** The edge is the diagonal of a quad face, not a mesh edge. */
  readonly diagonal: boolean;
}
export interface ContourCurve extends SpatialCurve {
  readonly closed: boolean;
  /** One per point. */
  readonly nodes: readonly ContourNode[];
  /** Source face of the segment leaving each point (the last one closes a closed curve; none after the last point of an open one). */
  readonly faces: readonly number[];
  /** Polyline length in world units. */
  readonly length: number;
  /** Why an open curve stops at its first and last point; null for closed curves. */
  readonly ends: readonly [ContourEnd, ContourEnd] | null;
}

// ---------------------------------------------------------------------------------------------
// Planes and frames

export interface SectionPlane {
  /** Stable name; default `p<index>` by position in the list. */
  readonly id?: string;
  readonly point: Vec3;
  /** Any nonzero finite vector; the section is on its positive side's boundary. */
  readonly normal: Vec3;
}
export interface PlaneFrame {
  readonly origin: Vec3;
  readonly u: Vec3;
  readonly v: Vec3;
  readonly normal: Vec3;
}
export function planeFrame(plane: SectionPlane): PlaneFrame {
  const [nx, ny, nz] = checkPlane(plane, "plane");
  const length = Math.hypot(nx, ny, nz), n: Vec3 = [nx / length, ny / length, nz / length];
  const axis = Math.abs(n[0]) <= Math.abs(n[1]) && Math.abs(n[0]) <= Math.abs(n[2]) ? 0 : Math.abs(n[1]) <= Math.abs(n[2]) ? 1 : 2;
  const e: Vec3 = axis === 0 ? [1, 0, 0] : axis === 1 ? [0, 1, 0] : [0, 0, 1], along = e[0] * n[0] + e[1] * n[1] + e[2] * n[2];
  const raw: Vec3 = [e[0] - along * n[0], e[1] - along * n[1], e[2] - along * n[2]], l = Math.hypot(...raw);
  const u: Vec3 = [raw[0] / l + 0, raw[1] / l + 0, raw[2] / l + 0];
  const v: Vec3 = [n[1] * u[2] - n[2] * u[1] + 0, n[2] * u[0] - n[0] * u[2] + 0, n[0] * u[1] - n[1] * u[0] + 0];
  return Object.freeze({ origin: Object.freeze([...plane.point]) as Vec3, u: Object.freeze(u) as Vec3, v: Object.freeze(v) as Vec3, normal: Object.freeze(n) as Vec3 });
}
function checkPlane(plane: SectionPlane, label: string): Vec3 {
  if (plane === null || typeof plane !== "object") throw new Error(`${label} must be an object with a point and a normal`);
  for (const [name, value] of [["point", plane.point], ["normal", plane.normal]] as const)
    if (!Array.isArray(value) || value.length !== 3 || value.some((c) => typeof c !== "number" || !Number.isFinite(c) || Math.abs(c) > 1e50))
      throw new Error(`${label}: ${name} must be three finite numbers of magnitude at most 1e50`);
  const [x, y, z] = plane.normal;
  if (x === 0 && y === 0 && z === 0) throw new Error(`${label}: normal must not be the zero vector`);
  if (!Number.isFinite(Math.hypot(x, y, z)) || Math.hypot(x, y, z) === 0) throw new Error(`${label}: normal is too small or too large to normalize`);
  return plane.normal;
}

// ---------------------------------------------------------------------------------------------
// Exact sign of n . (p - q)

const f64 = new Float64Array(1), u64 = new BigUint64Array(f64.buffer);
/** `x * 2^1074`, an integer for every finite double. */
function scaled(x: number): bigint {
  f64[0] = x;
  const bits = u64[0], exponent = Number((bits >> 52n) & 0x7ffn);
  let mantissa = bits & 0xfffffffffffffn, shift: number;
  if (exponent === 0) shift = 0; else { mantissa |= 1n << 52n; shift = exponent - 1; }
  const magnitude = mantissa << BigInt(shift);
  return bits >> 63n ? -magnitude : magnitude;
}
const EPS = 1.1102230246251565e-16;
function planeSign(n: Vec3, q: Vec3, px: number, py: number, pz: number): -1 | 0 | 1 {
  const ax = px - q[0], ay = py - q[1], az = pz - q[2];
  const d = n[0] * ax + n[1] * ay + n[2] * az;
  const bound = 16 * EPS * (Math.abs(n[0]) * (Math.abs(px) + Math.abs(q[0])) + Math.abs(n[1]) * (Math.abs(py) + Math.abs(q[1])) + Math.abs(n[2]) * (Math.abs(pz) + Math.abs(q[2])));
  if (d > bound) return 1;
  if (d < -bound) return -1;
  const exact = scaled(n[0]) * (scaled(px) - scaled(q[0])) + scaled(n[1]) * (scaled(py) - scaled(q[1])) + scaled(n[2]) * (scaled(pz) - scaled(q[2]));
  return exact > 0n ? 1 : exact < 0n ? -1 : 0;
}

// ---------------------------------------------------------------------------------------------
// The tracer

interface Guard { charge(units: number): void; used(): number }
function guardFor(what: string, maxWork: number | undefined): Guard {
  const max = maxWork ?? DEFAULT_SECTION_WORK;
  if (typeof max !== "number" || !Number.isFinite(max) || max < 0) throw new Error(`${what}: maxWork must be a finite non-negative number`);
  let used = 0;
  return {
    charge(units) {
      used += units;
      if (used > max) throw new Error(`${what} needs more than maxWork = ${max} units of work (used ${Math.round(used)}); reduce the planes or levels, or the mesh detail, or raise maxWork`);
    },
    used: () => used,
  };
}

interface Raw {
  readonly nodes: ContourNode[];
  readonly points: Vec3[];
  readonly faces: number[];
  readonly lowestTriangle: number;
  readonly closed: boolean;
  readonly ends: [ContourEnd, ContourEnd] | null;
  readonly length: number;
}
interface TraceResult {
  readonly curves: readonly Raw[];
  readonly degenerate: number;
  readonly nonManifoldNodes: number;
  readonly crossed: number;
}

/**
 * Trace one level. `above[v]` is the classification, `w[v]` the float value minus the level (only its magnitude
 * ratio is used, for `t`), `exactZero[v]` marks vertices exactly on the level.
 */
function trace(mesh: Mesh, above: Uint8Array, w: Float64Array, exactZero: Uint8Array, guard: Guard, run: CompositionRun | undefined): TraceResult {
  const s = meshStorage(mesh), p = s.positions, T = mesh.triangleCount, V = mesh.vertexCount;
  guard.charge(T);
  const nodeOf = new Map<number, number>();
  const lo: number[] = [], hi: number[] = [];
  const segFrom: number[] = [], segTo: number[] = [], segTri: number[] = [];
  const nodeFace: number[] = [];
  const node = (a: number, b: number, face: number): number => {
    const l = a < b ? a : b, h = a < b ? b : a, key = l * V + h;
    let index = nodeOf.get(key);
    if (index === undefined) { index = lo.length; nodeOf.set(key, index); lo.push(l); hi.push(h); nodeFace.push(face); }
    return index;
  };
  for (let t = 0; t < T; t++) {
    if ((t & 8191) === 0) run?.check();
    const a = s.triangles[t * 3], b = s.triangles[t * 3 + 1], c = s.triangles[t * 3 + 2];
    const sa = above[a], sb = above[b], sc = above[c];
    if (sa === sb && sb === sc) continue;
    // walking the triangle counter-clockwise, the above region is left where the boundary goes above -> below and re-enters below -> above
    let from = -1, to = -1;
    for (let e = 0; e < 3; e++) {
      const x = e === 0 ? a : e === 1 ? b : c, y = e === 0 ? b : e === 1 ? c : a, sx = above[x], sy = above[y];
      if (sx === 1 && sy === 0) from = node(x, y, s.triangleFace[t]); else if (sx === 0 && sy === 1) to = node(x, y, s.triangleFace[t]);
    }
    segFrom.push(from); segTo.push(to); segTri.push(t);
  }
  const N = lo.length, S = segFrom.length;
  guard.charge(4 * N + 2 * S);
  // node positions and parameters
  const nodes: ContourNode[] = new Array(N), position = new Float64Array(N * 3);
  for (let n = 0; n < N; n++) {
    const l = lo[n], h = hi[n];
    let t: number, vertex = -1;
    if (exactZero[l]) { t = 0; vertex = l; } else if (exactZero[h]) { t = 1; vertex = h; }
    else {
      const den = w[l] - w[h];
      t = den === 0 || !Number.isFinite(den) ? 0.5 : w[l] / den;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
    }
    for (let k = 0; k < 3; k++) position[n * 3 + k] = vertex >= 0 ? p[vertex * 3 + k] : p[l * 3 + k] + t * (p[h * 3 + k] - p[l * 3 + k]);
    nodes[n] = { edge: [l, h], t, vertex, diagonal: false };
  }
  // a quad's diagonal: the two endpoints are not neighbours in the face (judged by the face that first met the edge)
  const diagonalOf = (n: number): boolean => {
    const face = nodeFace[n], start = s.faceStart[face], size = s.faceStart[face + 1] - start;
    if (size !== 4) return false;
    let ia = -1, ib = -1;
    for (let k = 0; k < 4; k++) { if (s.faceIndices[start + k] === lo[n]) ia = k; if (s.faceIndices[start + k] === hi[n]) ib = k; }
    return ia >= 0 && ib >= 0 && Math.abs(ia - ib) === 2;
  };
  for (let n = 0; n < N; n++) nodes[n] = Object.freeze({ ...nodes[n], diagonal: diagonalOf(n) });
  // adjacency
  const degree = new Uint32Array(N + 1);
  for (let g = 0; g < S; g++) { degree[segFrom[g] + 1]++; degree[segTo[g] + 1]++; }
  const start = degree.slice();
  for (let n = 0; n < N; n++) start[n + 1] += start[n];
  const fill = start.slice(0, N), incident = new Uint32Array(2 * S);
  for (let g = 0; g < S; g++) { incident[fill[segFrom[g]]++] = g; incident[fill[segTo[g]]++] = g; }
  const deg = (n: number): number => start[n + 1] - start[n];
  const visited = new Uint8Array(S);
  const chains: { nodes: number[]; tris: number[]; closed: boolean; ends: [ContourEnd, ContourEnd] | null }[] = [];
  let nonManifoldNodes = 0;
  for (let n = 0; n < N; n++) if (deg(n) > 2) nonManifoldNodes++;
  const reason = (n: number): ContourEnd => (deg(n) === 1 ? "boundary" : "non-manifold");
  const walk = (first: number, seg0: number, closed: boolean): void => {
    const chainNodes = [first], tris: number[] = [];
    let current = first, seg = seg0, along = 0, against = 0;
    for (;;) {
      visited[seg] = 1; tris.push(segTri[seg]);
      if (segFrom[seg] === current) along++; else against++;
      const next = segFrom[seg] === current ? segTo[seg] : segFrom[seg];
      chainNodes.push(next);
      current = next;
      if (closed ? current === first : deg(current) !== 2) break;
      const a = incident[start[current]], b = incident[start[current] + 1], following = a === seg ? b : a;
      if (visited[following]) break;
      seg = following;
    }
    if (closed) chainNodes.pop();
    let ends: [ContourEnd, ContourEnd] | null = closed ? null : [reason(first), reason(current)];
    if (against > along) {
      chainNodes.reverse();
      if (closed) { const m = tris.length; const flipped = tris.map((_, i) => tris[(m - 2 - i + 2 * m) % m]); tris.length = 0; tris.push(...flipped); }
      else tris.reverse();
      if (ends) ends = [ends[1], ends[0]];
    }
    chains.push({ nodes: chainNodes, tris, closed, ends });
  };
  for (let n = 0; n < N; n++) {
    if (deg(n) === 2) continue;
    for (let k = start[n]; k < start[n + 1]; k++) if (!visited[incident[k]]) walk(n, incident[k], false);
  }
  for (let g = 0; g < S; g++) if (!visited[g]) walk(segFrom[g], g, true);
  // points: consecutive nodes at identical coordinates collapse; the segment that moves the point names the face
  const curves: Raw[] = [];
  let degenerate = 0;
  const same = (a: number, b: number): boolean => position[a * 3] === position[b * 3] && position[a * 3 + 1] === position[b * 3 + 1] && position[a * 3 + 2] === position[b * 3 + 2];
  for (const chain of chains) {
    const list = chain.nodes, m = list.length, face = (k: number): number => s.triangleFace[chain.tris[k]];
    const kept = [list[0]], leaving: number[] = [];
    for (let k = 1; k < m; k++) if (!same(list[k], kept[kept.length - 1])) { leaving.push(face(k - 1)); kept.push(list[k]); }
    if (chain.closed) {
      if (kept.length > 1 && same(kept[kept.length - 1], kept[0])) kept.pop(); else leaving.push(face(m - 1));
      if (kept.length < 3) { degenerate++; continue; }
    } else if (kept.length < 2) { degenerate++; continue; }
    const points = kept.map((n) => Object.freeze([position[n * 3], position[n * 3 + 1], position[n * 3 + 2]] as const) as Vec3);
    let length = 0;
    for (let k = 1; k < points.length; k++) length += Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1], points[k][2] - points[k - 1][2]);
    if (chain.closed) length += Math.hypot(points[0][0] - points[points.length - 1][0], points[0][1] - points[points.length - 1][1], points[0][2] - points[points.length - 1][2]);
    curves.push({ nodes: kept.map((n) => nodes[n]), points, faces: leaving, lowestTriangle: Math.min(...chain.tris), closed: chain.closed, ends: chain.ends, length });
  }
  curves.sort((a, b) => a.lowestTriangle - b.lowestTriangle);
  return { curves, degenerate, nonManifoldNodes, crossed: S };
}

// ---------------------------------------------------------------------------------------------
// Plane sections

export interface SectionOptions {
  /** Side that vertices exactly on the plane belong to (see the module header); default `"above"`. */
  readonly ties?: LevelTies;
  readonly maxWork?: number;
  readonly run?: CompositionRun;
}
export interface SectionLoop extends ContourCurve {
  /** Points in the plane's frame `(u, v)`. */
  readonly uv: readonly (readonly [number, number])[];
  /** Signed shoelace area in the frame for a closed loop (positive counter-clockwise), else 0. */
  readonly area: number;
}
export interface MeshSection {
  readonly id: string;
  readonly frame: PlaneFrame;
  readonly ties: LevelTies;
  /** Loops and chains, ordered by their lowest triangle. */
  readonly loops: readonly SectionLoop[];
  readonly closedCount: number;
  readonly openCount: number;
  /** Contacts dropped for having fewer than three distinct points (closed) or one point (open). */
  readonly degenerate: number;
  /** Nodes on edges of three or more faces, where chains stop. */
  readonly nonManifoldNodes: number;
  /** Triangles the plane crosses. */
  readonly crossed: number;
}
export interface MeshSlices {
  readonly sections: readonly MeshSection[];
  readonly work: number;
}

/** Least-recently-used memo; a stack of planes needs more than the shared 6-entry helper keeps. */
function remember<T>(cache: Map<string, T>, key: string, limit: number, make: () => T): T {
  const hit = cache.get(key);
  if (hit !== undefined) { cache.delete(key); cache.set(key, hit); return hit; }
  const value = make();
  cache.set(key, value);
  if (cache.size > limit) cache.delete(cache.keys().next().value!);
  return value;
}
const sectionCache = new Map<string, MeshSection>();

function ties(options: { readonly ties?: LevelTies }): LevelTies {
  const t = options.ties ?? "above";
  if (t !== "above" && t !== "below") throw new Error('ties must be "above" or "below"');
  return t;
}

function sectionOne(mesh: Mesh, plane: SectionPlane, id: string, index: number, tie: LevelTies, guard: Guard, run: CompositionRun | undefined): MeshSection {
  const label = `Section plane "${id}"`;
  const normal = checkPlane(plane, label);
  return remember(sectionCache, JSON.stringify([mesh.key, id, plane.point, plane.normal, tie, index]), SECTION_LIMITS.maxPlanes, () => {
    const frame = planeFrame(plane), s = meshStorage(mesh), V = mesh.vertexCount, [nx, ny, nz] = frame.normal, [ox, oy, oz] = plane.point;
    guard.charge(V);
    const above = new Uint8Array(V), zero = new Uint8Array(V), w = new Float64Array(V);
    for (let v = 0; v < V; v++) {
      const x = s.positions[v * 3], y = s.positions[v * 3 + 1], z = s.positions[v * 3 + 2], sign = planeSign(normal, plane.point, x, y, z);
      w[v] = nx * (x - ox) + ny * (y - oy) + nz * (z - oz);
      zero[v] = sign === 0 ? 1 : 0;
      above[v] = sign > 0 || (sign === 0 && tie === "above") ? 1 : 0;
    }
    const traced = trace(mesh, above, w, zero, guard, run);
    const loops = traced.curves.map((curve): SectionLoop => {
      const uv = curve.points.map((q) => Object.freeze([(q[0] - ox) * frame.u[0] + (q[1] - oy) * frame.u[1] + (q[2] - oz) * frame.u[2],
        (q[0] - ox) * frame.v[0] + (q[1] - oy) * frame.v[1] + (q[2] - oz) * frame.v[2]] as const));
      let area = 0;
      if (curve.closed) for (let k = 0; k < uv.length; k++) { const a = uv[k], b = uv[(k + 1) % uv.length]; area += a[0] * b[1] - b[0] * a[1]; }
      return Object.freeze({
        id: `${id}/t${curve.lowestTriangle}`, closed: curve.closed, points: Object.freeze(curve.points), tone: index, nodes: Object.freeze(curve.nodes), faces: Object.freeze(curve.faces),
        length: curve.length, ends: curve.ends === null ? null : Object.freeze(curve.ends), uv: Object.freeze(uv), area: area / 2,
      });
    });
    return Object.freeze({
      id, frame, ties: tie, loops: Object.freeze(loops), closedCount: loops.filter((l) => l.closed).length, openCount: loops.filter((l) => !l.closed).length,
      degenerate: traced.degenerate, nonManifoldNodes: traced.nonManifoldNodes, crossed: traced.crossed,
    });
  });
}

/** The section of a mesh by one plane (see the module header for classification, ties, assembly and ids). */
export function sectionMesh(mesh: Mesh, plane: SectionPlane, options: SectionOptions = {}): MeshSection {
  const guard = guardFor("sectionMesh", options.maxWork);
  return sectionOne(mesh, plane, plane.id ?? "p0", 0, ties(options), guard, options.run);
}

/** Sections by several planes at once; plane ids (default `p<index>`) must be distinct and name each section and its loops. */
export function sliceMesh(mesh: Mesh, planes: readonly SectionPlane[], options: SectionOptions = {}): MeshSlices {
  if (!Array.isArray(planes)) throw new Error("sliceMesh: planes must be an array");
  if (planes.length > SECTION_LIMITS.maxPlanes) throw new Error(`sliceMesh: ${planes.length} planes; the limit is ${SECTION_LIMITS.maxPlanes}; reduce planes (or raise the spacing that made them)`);
  const tie = ties(options), guard = guardFor("sliceMesh", options.maxWork), seen = new Set<string>();
  const sections = planes.map((plane, i) => {
    const id = plane?.id ?? `p${i}`;
    if (typeof id !== "string" || id.length === 0) throw new Error(`sliceMesh: plane ${i} needs a non-empty string id`);
    if (seen.has(id)) throw new Error(`sliceMesh: plane id "${id}" is repeated`);
    seen.add(id);
    options.run?.check();
    return sectionOne(mesh, plane, id, i, tie, guard, options.run);
  });
  return Object.freeze({ sections: Object.freeze(sections), work: guard.used() });
}

/** Every loop and chain of the slices as curves, ready for `hiddenLines`, `strokeWith` after projection, or point placement. */
export function sliceCurves(slices: MeshSlices | MeshSection): readonly SectionLoop[] {
  return Object.freeze(("sections" in slices ? slices.sections : [slices]).flatMap((section) => section.loops));
}

export interface SlicePlaneOptions {
  /** Direction the planes are stacked along (any nonzero vector). */
  readonly normal: Vec3;
  /** Distance between planes along the unit normal; positive. */
  readonly spacing: number;
  /** Where the stack starts: plane `k` is at `offset + k * spacing` along the unit normal from `origin`. Default 0. */
  readonly offset?: number;
  /** Default the world origin. */
  readonly origin?: Vec3;
}
/**
 * Evenly spaced parallel planes strictly inside the mesh's extent along the normal. Plane `k` has id `s<k>` (k may
 * be negative) and sits at `offset + k * spacing`, so widening the range or moving the mesh never renames a plane.
 */
export function slicePlanes(mesh: Mesh, options: SlicePlaneOptions): readonly SectionPlane[] {
  const { normal, spacing } = options, origin = options.origin ?? [0, 0, 0] as Vec3, offset = options.offset ?? 0;
  const frame = planeFrame({ point: origin, normal }), n = frame.normal;
  if (typeof spacing !== "number" || !Number.isFinite(spacing) || spacing <= 0) throw new Error(`slicePlanes: spacing must be a positive finite number (got ${String(spacing)})`);
  if (typeof offset !== "number" || !Number.isFinite(offset)) throw new Error("slicePlanes: offset must be finite");
  const p = meshStorage(mesh).positions;
  let low = Infinity, high = -Infinity;
  for (let v = 0; v < mesh.vertexCount; v++) {
    const d = n[0] * (p[v * 3] - origin[0]) + n[1] * (p[v * 3 + 1] - origin[1]) + n[2] * (p[v * 3 + 2] - origin[2]);
    if (d < low) low = d; if (d > high) high = d;
  }
  const first = Math.floor((low - offset) / spacing) + 1, last = Math.ceil((high - offset) / spacing) - 1;
  const count = last - first + 1;
  if (count > SECTION_LIMITS.maxPlanes) throw new Error(`slicePlanes: spacing ${spacing} gives ${count} planes across the mesh; the limit is ${SECTION_LIMITS.maxPlanes}; increase spacing`);
  const planes: SectionPlane[] = [];
  for (let k = first; k <= last; k++) {
    const h = offset + k * spacing;
    if (!(h > low && h < high)) continue;
    planes.push(Object.freeze({ id: `s${k}`, point: Object.freeze([origin[0] + n[0] * h, origin[1] + n[1] * h, origin[2] + n[2] * h]) as Vec3, normal: Object.freeze([...normal]) as Vec3 }));
  }
  return Object.freeze(planes);
}

// ---------------------------------------------------------------------------------------------
// Sections as planar domains

export interface SectionDomainOptions {
  readonly id?: string;
  /** `"reject"` (default) throws when the section has open chains; `"ignore"` builds the domain from the closed loops only. */
  readonly open?: "reject" | "ignore";
  readonly maxWork?: number;
}
/**
 * The closed loops of a section as a planar domain in the plane's `(u, v)` frame, by the even-odd fill of the
 * planar-domain foundation: a loop inside another becomes its hole, a loop inside a hole an island, whatever the
 * loops' orientation. Ids follow the foundation (`<id>/<k>` in canonical order).
 */
export function sectionDomain(section: MeshSection, options: SectionDomainOptions = {}): PlanarDomain {
  const open = options.open ?? "reject";
  if (open !== "reject" && open !== "ignore") throw new Error('sectionDomain: open must be "reject" or "ignore"');
  if (open === "reject" && section.openCount > 0)
    throw new Error(`sectionDomain: section "${section.id}" has ${section.openCount} open chains (the mesh is open or non-manifold where the plane crosses it); pass open: "ignore" or close the mesh`);
  const rings = section.loops.filter((l) => l.closed).map((l) => l.uv.map((q) => [q[0], q[1]] as [number, number]));
  return ringsDomain(rings, { fill: "evenodd", id: options.id ?? `${section.id}/domain`, ...(options.maxWork === undefined ? {} : { maxWork: options.maxWork }) });
}

// ---------------------------------------------------------------------------------------------
// Iso-contours of a per-vertex scalar

export interface IsoOptions {
  /** Distinct finite levels. */
  readonly levels: readonly number[];
  /** A size-1 vertex attribute of the mesh, or one finite number per vertex. */
  readonly values: string | ArrayLike<number>;
  /** Side a vertex whose value equals a level exactly belongs to; default `"above"` (value >= level is above). */
  readonly ties?: LevelTies;
  readonly maxWork?: number;
  readonly run?: CompositionRun;
}
export interface IsoCurve extends ContourCurve {
  readonly level: number;
  /** Position of the level in `levels`. */
  readonly levelIndex: number;
}
export interface IsoContours {
  /** Curves of every level, level by level in the order given, each level ordered by its lowest triangle. */
  readonly curves: readonly IsoCurve[];
  readonly degenerate: number;
  readonly nonManifoldNodes: number;
  readonly work: number;
}
const isoCache = new Map<string, IsoContours>();

/**
 * Triangle-exact linear contours of a per-vertex scalar on the mesh surface (module header: ties, saddles, nodes,
 * assembly, orientation and ids). Levels are independent: adding or removing a level never changes another's curves or ids.
 * `tone` of a curve is its level index. Crossing points are identical on both sides of every shared edge, so contours are
 * continuous across faces, and on a closed mesh they close.
 */
export function isoContours(mesh: Mesh, options: IsoOptions): IsoContours {
  const { levels } = options, tie = ties(options);
  if (!Array.isArray(levels) || levels.length === 0) throw new Error("isoContours: levels must be a non-empty array");
  if (levels.length > SECTION_LIMITS.maxLevels) throw new Error(`isoContours: ${levels.length} levels; the limit is ${SECTION_LIMITS.maxLevels}; reduce levels`);
  levels.forEach((level, i) => { if (typeof level !== "number" || !Number.isFinite(level)) throw new Error(`isoContours: level ${i} must be a finite number (got ${String(level)})`); });
  if (new Set(levels).size !== levels.length) throw new Error("isoContours: levels must be distinct");
  const V = mesh.vertexCount, s = meshStorage(mesh);
  let values: Float64Array, source: string;
  if (typeof options.values === "string") {
    const found = s.attributes.find((a) => a.name === options.values);
    if (!found || found.domain !== "vertex" || found.size !== 1) throw new Error(`isoContours: mesh "${mesh.id}" has no size-1 vertex attribute "${options.values}"`);
    values = found.values; source = `attribute:${options.values}`;
  } else {
    const given = options.values;
    if (given === null || typeof given !== "object" || given.length !== V) throw new Error(`isoContours: values must have one number per vertex (${V}); got ${given?.length}`);
    values = new Float64Array(V);
    for (let v = 0; v < V; v++) {
      const x = given[v];
      if (typeof x !== "number" || !Number.isFinite(x)) throw new Error(`isoContours: values[${v}] must be a finite number (got ${String(x)})`);
      values[v] = x === 0 ? 0 : x;
    }
    source = `values:${sha256Hex(new Uint8Array(values.buffer, values.byteOffset, values.byteLength))}`;
  }
  const guard = guardFor("isoContours", options.maxWork);
  return remember(isoCache, JSON.stringify([mesh.key, source, levels, tie]), 6, () => {
    const curves: IsoCurve[] = [];
    let degenerate = 0, nonManifoldNodes = 0;
    const above = new Uint8Array(V), zero = new Uint8Array(V), w = new Float64Array(V);
    levels.forEach((level, levelIndex) => {
      options.run?.check();
      guard.charge(V);
      for (let v = 0; v < V; v++) {
        const value = values[v];
        w[v] = value - level;
        zero[v] = value === level ? 1 : 0;
        above[v] = value > level || (value === level && tie === "above") ? 1 : 0;
      }
      const traced = trace(mesh, above, w, zero, guard, options.run);
      degenerate += traced.degenerate; nonManifoldNodes += traced.nonManifoldNodes;
      for (const curve of traced.curves) curves.push(Object.freeze({
        id: `L${level}/t${curve.lowestTriangle}`, closed: curve.closed, points: Object.freeze(curve.points), tone: levelIndex, nodes: Object.freeze(curve.nodes), faces: Object.freeze(curve.faces),
        length: curve.length, ends: curve.ends === null ? null : Object.freeze(curve.ends), level, levelIndex,
      }));
    });
    return Object.freeze({ curves: Object.freeze(curves), degenerate, nonManifoldNodes, work: guard.used() });
  });
}
