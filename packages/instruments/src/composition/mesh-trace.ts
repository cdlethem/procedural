/**
 * Marching curves across the triangles of a mesh (foundation F8 extension, first used by Surface Weave, brief 52).
 *
 * WHAT IT DOES. A curve is followed ON the surface: every point it produces lies inside a triangle of the mesh's
 * triangulation (a quad is its two triangles), never in the air above it and never in a parameter domain. There is no
 * UV: a periodic surface (vase, torus, sphere) has no seam and no pole to treat, because the walk only ever asks a
 * triangle for its neighbour across an edge. Where the walk cannot continue (a boundary edge, a critical point of the
 * field) it stops and says why.
 *
 * TRIANGLE WALK (`walk`). A point, its triangle and a unit heading in that triangle's plane are advanced by a travel
 * distance. Inside a triangle the path is a straight segment (the barycentric coordinates are affine along it, so the
 * exit edge and distance follow exactly: `t = lambda_i / -(grad lambda_i . d)`). At an edge the heading is UNFOLDED
 * into the neighbour: its component along the edge is kept and its component across the edge is turned onto the
 * neighbour's plane, which is the straightest path on the surface (a geodesic on a polyhedral surface; at a vertex the
 * fan is entered through the first exit edge, a fixed rule). Path length on the surface is therefore the sum of the
 * segment lengths, exactly, and the arc length of a strand is measured in surface distance.
 *
 * INTEGRATION (`stepRK2`). One step of a field-following curve is the explicit midpoint (second order) rule in the
 * unfolded surface: sample the direction field at the start, walk half a step, sample again there, turn the first
 * heading by the angle between the transported first heading and the second sample (measured in the tangent plane at
 * the midpoint), and walk the whole step with that heading. A field is one unit tangent vector per vertex (or zero
 * where it is undefined), interpolated barycentrically and projected on the triangle's plane; if the interpolated
 * vector is shorter than 0.25 the curve has reached a critical point and stops (`"singular"`). A line field has no sign,
 * so each sample is flipped to agree with the previous heading. The step is the caller's; the tests measure the error
 * against circles on a sphere and a torus and show it shrinks as the step does.
 *
 * INPUT: any `Mesh` whose topology is a consistently oriented manifold (open or closed); anything else throws naming
 * the mesh. OUTPUT: plain numbers written into a caller-owned `Walker`; the module keeps no state except a cache of the
 * per-mesh `TraceGraph` (triangle adjacency and per-triangle barycentric gradients, 13 doubles and 3 ints per
 * triangle) keyed by mesh identity. `walk` records the point and the triangle at each edge crossing when asked, so a
 * caller can publish a polyline in which EVERY SEGMENT LIES IN ONE KNOWN TRIANGLE.
 *
 * UNITS are the mesh's world units. A walk crosses at most `TRACE_LIMITS.crossingsPerWalk` edges; more ends it as
 * `"stuck"` (a triangle so small against the travel distance that the request is unreasonable).
 */
import { meshBoundaryEdges, meshEdgeVertices, meshTopology } from "./mesh-topology.js";
import { internalVertexNormals, meshDerived, meshStorage, type Mesh } from "./mesh.js";

export const TRACE_LIMITS = Object.freeze({ crossingsPerWalk: 20_000, singular: 0.25 });

export interface TraceGraph {
  readonly mesh: Mesh;
  /** Vertex positions, 3 per vertex (borrowed from the mesh; never mutate). */
  readonly positions: Float64Array;
  /** Triangle corners, 3 per triangle. */
  readonly triangles: Uint32Array;
  /** Neighbour across edge `k` of triangle `t` (corners `k` and `k + 1`), or -1 on the boundary; index `3 t + k`. */
  readonly neighbors: Int32Array;
  /** Unit normals, 3 per triangle. */
  readonly normals: Float64Array;
  /** Gradients of the three barycentric coordinates, 9 per triangle. Each is in the triangle's plane and points to its vertex. */
  readonly gradients: Float64Array;
  /** Unit vertex normals (angle weighted), 3 per vertex. */
  readonly vertexNormals: Float64Array;
  /** Whether any triangle edge is a boundary. */
  readonly open: boolean;
}

const graphs = new WeakMap<Mesh, TraceGraph>();

/** Adjacency and gradients of a manifold mesh, cached by mesh identity. */
export function traceGraph(value: Mesh): TraceGraph {
  const hit = graphs.get(value);
  if (hit) return hit;
  const topology = meshTopology(value);
  if (topology.kind !== "closed-manifold" && topology.kind !== "open-manifold")
    throw new Error(`Mesh "${value.id}" is ${topology.kind}; marching across triangles needs a manifold mesh with consistently oriented faces`);
  const s = meshStorage(value), T = value.triangleCount, V = value.vertexCount, d = meshDerived(value);
  const neighbors = new Int32Array(T * 3).fill(-1);
  const owner = new Map<number, number>();
  for (let t = 0; t < T; t++) for (let k = 0; k < 3; k++) {
    const a = s.triangles[t * 3 + k], b = s.triangles[t * 3 + (k + 1) % 3], key = Math.min(a, b) * V + Math.max(a, b), other = owner.get(key);
    if (other === undefined) { owner.set(key, t * 3 + k); continue; }
    if (other < 0) throw new Error(`Mesh "${value.id}": edge ${Math.min(a, b)}-${Math.max(a, b)} belongs to more than two triangles`);
    const ot = Math.floor(other / 3), ok = other % 3;
    if (s.triangles[ot * 3 + ok] === a) throw new Error(`Mesh "${value.id}": triangles ${ot} and ${t} traverse edge ${Math.min(a, b)}-${Math.max(a, b)} the same way (inconsistent orientation)`);
    neighbors[other] = t; neighbors[t * 3 + k] = ot;
    owner.set(key, -1);
  }
  const p = s.positions, gradients = new Float64Array(T * 9);
  for (let t = 0; t < T; t++) {
    const nx = d.triangleNormals[t * 3], ny = d.triangleNormals[t * 3 + 1], nz = d.triangleNormals[t * 3 + 2], inv = 1 / (2 * d.triangleAreas[t]);
    for (let i = 0; i < 3; i++) {
      // Gradient of the coordinate of corner i: the normal turned a quarter about the edge opposite i, over twice the area.
      const from = s.triangles[t * 3 + (i + 1) % 3], to = s.triangles[t * 3 + (i + 2) % 3];
      const ex = p[to * 3] - p[from * 3], ey = p[to * 3 + 1] - p[from * 3 + 1], ez = p[to * 3 + 2] - p[from * 3 + 2];
      gradients[t * 9 + i * 3] = (ny * ez - nz * ey) * inv;
      gradients[t * 9 + i * 3 + 1] = (nz * ex - nx * ez) * inv;
      gradients[t * 9 + i * 3 + 2] = (nx * ey - ny * ex) * inv;
    }
  }
  const graph: TraceGraph = Object.freeze({
    mesh: value, positions: p, triangles: s.triangles, neighbors, normals: d.triangleNormals, gradients,
    vertexNormals: internalVertexNormals(value), open: topology.kind === "open-manifold",
  });
  graphs.set(value, graph);
  return graph;
}

/** Position, triangle and unit heading (in the triangle's plane) of a marching point. The caller owns and mutates it. */
export interface Walker { tri: number; readonly p: Float64Array; readonly d: Float64Array }
export const walker = (tri = 0): Walker => ({ tri, p: new Float64Array(3), d: new Float64Array(3) });

export type WalkEnd = "length" | "boundary" | "stuck";

/**
 * Advance `w` along its heading by `length` on the surface. Returns why it stopped: `"length"` (arrived), `"boundary"`
 * (the point is on a boundary edge of `w.tri`) or `"stuck"`. `events`, when given, receives `x, y, z, triangle` for every
 * edge crossed (the triangle just left), so the polyline from the previous vertex to each event lies in that triangle.
 */
export function walk(g: TraceGraph, w: Walker, length: number, events: number[] | null): WalkEnd {
  const T = g.triangles, P = g.positions, G = g.gradients, N = g.neighbors, p = w.p, d = w.d;
  let remaining = length;
  for (let guard = 0; guard < TRACE_LIMITS.crossingsPerWalk; guard++) {
    const t = w.tri, i0 = T[t * 3], i1 = T[t * 3 + 1], i2 = T[t * 3 + 2], o = t * 9;
    const l0 = G[o] * (p[0] - P[i1 * 3]) + G[o + 1] * (p[1] - P[i1 * 3 + 1]) + G[o + 2] * (p[2] - P[i1 * 3 + 2]);
    const l1 = G[o + 3] * (p[0] - P[i2 * 3]) + G[o + 4] * (p[1] - P[i2 * 3 + 1]) + G[o + 5] * (p[2] - P[i2 * 3 + 2]);
    const l2 = G[o + 6] * (p[0] - P[i0 * 3]) + G[o + 7] * (p[1] - P[i0 * 3 + 1]) + G[o + 8] * (p[2] - P[i0 * 3 + 2]);
    const g0 = G[o] * d[0] + G[o + 1] * d[1] + G[o + 2] * d[2], g1 = G[o + 3] * d[0] + G[o + 4] * d[1] + G[o + 5] * d[2], g2 = G[o + 6] * d[0] + G[o + 7] * d[1] + G[o + 8] * d[2];
    let best = Infinity, edge = -1;
    if (g0 < -1e-13) { const ti = Math.max(l0, 0) / -g0; if (ti < best) { best = ti; edge = 0; } }
    if (g1 < -1e-13) { const ti = Math.max(l1, 0) / -g1; if (ti < best) { best = ti; edge = 1; } }
    if (g2 < -1e-13) { const ti = Math.max(l2, 0) / -g2; if (ti < best) { best = ti; edge = 2; } }
    if (edge < 0 || best >= remaining) { p[0] += d[0] * remaining; p[1] += d[1] * remaining; p[2] += d[2] * remaining; return "length"; }
    p[0] += d[0] * best; p[1] += d[1] * best; p[2] += d[2] * best;
    remaining -= best;
    // The exit edge is opposite corner `edge`: edge index k = edge + 1 joins corners k and k + 1.
    const k = (edge + 1) % 3, nb = N[t * 3 + k], a = T[t * 3 + k], b = T[t * 3 + (k + 1) % 3];
    const nx = g.normals[t * 3], ny = g.normals[t * 3 + 1], nz = g.normals[t * 3 + 2];
    const off = (p[0] - P[a * 3]) * nx + (p[1] - P[a * 3 + 1]) * ny + (p[2] - P[a * 3 + 2]) * nz;
    p[0] -= nx * off; p[1] -= ny * off; p[2] -= nz * off;
    if (nb < 0) return "boundary";
    if (events) events.push(p[0], p[1], p[2], t);
    // Unfold: keep the part of the heading along the edge, turn the part across it from t's plane into nb's plane.
    let ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2];
    const el = Math.hypot(ex, ey, ez); ex /= el; ey /= el; ez /= el;
    const oe = o + edge * 3, ol = Math.hypot(G[oe], G[oe + 1], G[oe + 2]);
    const across = -(G[oe] * d[0] + G[oe + 1] * d[1] + G[oe + 2] * d[2]) / ol, along = d[0] * ex + d[1] * ey + d[2] * ez;
    const c0 = T[nb * 3], c1 = T[nb * 3 + 1];
    const j = c0 !== a && c0 !== b ? 0 : c1 !== a && c1 !== b ? 1 : 2, oj = nb * 9 + j * 3, jl = Math.hypot(G[oj], G[oj + 1], G[oj + 2]);
    const dx = along * ex + across * G[oj] / jl, dy = along * ey + across * G[oj + 1] / jl, dz = along * ez + across * G[oj + 2] / jl, dl = Math.hypot(dx, dy, dz);
    d[0] = dx / dl; d[1] = dy / dl; d[2] = dz / dl;
    w.tri = nb;
  }
  return "stuck";
}

/** Barycentric coordinates of `p` in triangle `t` (unclamped: a point a little outside gives a small negative). */
export function barycentric(g: TraceGraph, t: number, p: ArrayLike<number>, out: Float64Array): void {
  const T = g.triangles, P = g.positions, G = g.gradients, i0 = T[t * 3], i1 = T[t * 3 + 1], i2 = T[t * 3 + 2], o = t * 9;
  out[0] = G[o] * (p[0] - P[i1 * 3]) + G[o + 1] * (p[1] - P[i1 * 3 + 1]) + G[o + 2] * (p[2] - P[i1 * 3 + 2]);
  out[1] = G[o + 3] * (p[0] - P[i2 * 3]) + G[o + 4] * (p[1] - P[i2 * 3 + 1]) + G[o + 5] * (p[2] - P[i2 * 3 + 2]);
  out[2] = G[o + 6] * (p[0] - P[i0 * 3]) + G[o + 7] * (p[1] - P[i0 * 3 + 1]) + G[o + 8] * (p[2] - P[i0 * 3 + 2]);
}

const lambda = new Float64Array(3);

/**
 * Unit direction of a per-vertex vector field at the walker's point, in its triangle's plane, written into `out`.
 * False at a critical point (interpolated length under `TRACE_LIMITS.singular`). With `ref`, the sign is chosen to agree with it.
 */
export function fieldDirection(g: TraceGraph, vectors: Float64Array, w: Walker, ref: Float64Array | null, out: Float64Array): boolean {
  const t = w.tri, T = g.triangles;
  barycentric(g, t, w.p, lambda);
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < 3; i++) {
    const v = T[t * 3 + i] * 3, l = Math.max(lambda[i], 0);
    x += l * vectors[v]; y += l * vectors[v + 1]; z += l * vectors[v + 2];
  }
  const sum = Math.max(lambda[0], 0) + Math.max(lambda[1], 0) + Math.max(lambda[2], 0);
  if (sum <= 0) return false;
  x /= sum; y /= sum; z /= sum;
  const nx = g.normals[t * 3], ny = g.normals[t * 3 + 1], nz = g.normals[t * 3 + 2], dot = x * nx + y * ny + z * nz;
  x -= nx * dot; y -= ny * dot; z -= nz * dot;
  const length = Math.hypot(x, y, z);
  if (length < TRACE_LIMITS.singular) return false;
  const sign = ref && x * ref[0] + y * ref[1] + z * ref[2] < 0 ? -1 : 1;
  out[0] = sign * x / length; out[1] = sign * y / length; out[2] = sign * z / length;
  return true;
}

export type StepEnd = "ok" | "boundary" | "singular" | "stuck";
const mid = walker(), heading = new Float64Array(3), second = new Float64Array(3);
/**
 * Turning of the last successful `stepRK2`, in radians (positive counter-clockwise seen from outside): twice the angle the midpoint
 * sample turned the heading. Summing it along a curve measures how far the curve has wound around; a curve that has turned
 * through more than a turn and a half without returning is circling a critical point.
 */
export const lastStep = { turn: 0 };

/**
 * One midpoint step of length `h` of the curve that follows `vectors`, starting from `w` with `w.d` as the previous heading
 * (used only for sign agreement). On `"ok"` `w` is the new point and `w.d` the transported final heading. On `"boundary"`
 * `w` is on the boundary edge; on `"singular"` and `"stuck"` `w` is unchanged (`"stuck"` may have moved it).
 */
export function stepRK2(g: TraceGraph, vectors: Float64Array, w: Walker, h: number, events: number[] | null): StepEnd {
  if (!fieldDirection(g, vectors, w, w.d, heading)) return "singular";
  mid.tri = w.tri; mid.p.set(w.p); mid.d.set(heading);
  const half = walk(g, mid, h / 2, null);
  if (half === "length") {
    if (!fieldDirection(g, vectors, mid, mid.d, second)) return "singular";
    const n = g.normals, m = mid.tri * 3, cx = mid.d[1] * second[2] - mid.d[2] * second[1], cy = mid.d[2] * second[0] - mid.d[0] * second[2], cz = mid.d[0] * second[1] - mid.d[1] * second[0];
    const delta = Math.atan2(n[m] * cx + n[m + 1] * cy + n[m + 2] * cz, mid.d[0] * second[0] + mid.d[1] * second[1] + mid.d[2] * second[2]);
    const q = w.tri * 3, s = Math.sin(delta), c = Math.cos(delta);
    // heading turned by delta about the normal at the start.
    const rx = n[q + 1] * heading[2] - n[q + 2] * heading[1], ry = n[q + 2] * heading[0] - n[q] * heading[2], rz = n[q] * heading[1] - n[q + 1] * heading[0];
    heading[0] = heading[0] * c + rx * s; heading[1] = heading[1] * c + ry * s; heading[2] = heading[2] * c + rz * s;
    lastStep.turn = 2 * delta;
  } else lastStep.turn = 0;
  w.d.set(heading);
  const end = walk(g, w, h, events);
  return end === "length" ? "ok" : end;
}

const distances = new WeakMap<TraceGraph, Float64Array>();

/**
 * Distance from every vertex to the nearest boundary vertex, along mesh edges (Dijkstra; it exceeds the surface distance
 * by at most the edge zigzag, under about 8 percent on the bundled meshes). Infinity everywhere on a closed mesh.
 */
export function boundaryDistance(g: TraceGraph): Float64Array {
  const hit = distances.get(g);
  if (hit) return hit;
  const V = g.mesh.vertexCount, out = new Float64Array(V).fill(Infinity);
  if (g.open) {
    const topology = meshTopology(g.mesh), P = g.positions, T = g.triangles, count = g.mesh.triangleCount;
    // Vertex adjacency in CSR form from the triangles.
    const degree = new Uint32Array(V + 1);
    for (let t = 0; t < count; t++) for (let k = 0; k < 3; k++) degree[T[t * 3 + k] + 1] += 2;
    for (let v = 0; v < V; v++) degree[v + 1] += degree[v];
    const fill = degree.slice(0, V), links = new Uint32Array(degree[V]);
    for (let t = 0; t < count; t++) for (let k = 0; k < 3; k++) {
      const a = T[t * 3 + k], b = T[t * 3 + (k + 1) % 3];
      links[fill[a]++] = b; links[fill[b]++] = a;
    }
    // Binary heap of (distance, vertex).
    const heapD: number[] = [], heapV: number[] = [];
    const push = (dist: number, v: number): void => {
      let i = heapD.length; heapD.push(dist); heapV.push(v);
      while (i > 0) { const up = (i - 1) >> 1; if (heapD[up] <= heapD[i]) break; [heapD[up], heapD[i]] = [heapD[i], heapD[up]]; [heapV[up], heapV[i]] = [heapV[i], heapV[up]]; i = up; }
    };
    const pop = (): [number, number] => {
      const top: [number, number] = [heapD[0], heapV[0]], lastD = heapD.pop()!, lastV = heapV.pop()!;
      if (heapD.length > 0) {
        heapD[0] = lastD; heapV[0] = lastV;
        for (let i = 0; ;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < heapD.length && heapD[l] < heapD[m]) m = l;
          if (r < heapD.length && heapD[r] < heapD[m]) m = r;
          if (m === i) break;
          [heapD[m], heapD[i]] = [heapD[i], heapD[m]]; [heapV[m], heapV[i]] = [heapV[i], heapV[m]]; i = m;
        }
      }
      return top;
    };
    for (const e of meshBoundaryEdges(topology)) for (const v of meshEdgeVertices(topology, e)) if (out[v] !== 0) { out[v] = 0; push(0, v); }
    while (heapD.length > 0) {
      const [dist, v] = pop();
      if (dist > out[v]) continue;
      for (let k = degree[v]; k < degree[v + 1]; k++) {
        const u = links[k], next = dist + Math.hypot(P[u * 3] - P[v * 3], P[u * 3 + 1] - P[v * 3 + 1], P[u * 3 + 2] - P[v * 3 + 2]);
        if (next < out[u]) { out[u] = next; push(next, u); }
      }
    }
  }
  distances.set(g, out);
  return out;
}

/** Interpolate a per-vertex scalar array at the walker's point. */
export function interpolate(g: TraceGraph, values: Float64Array, w: Walker): number {
  barycentric(g, w.tri, w.p, lambda);
  const T = g.triangles, t = w.tri;
  let sum = 0, weight = 0;
  for (let i = 0; i < 3; i++) { const l = Math.max(lambda[i], 0); sum += l * values[T[t * 3 + i]]; weight += l; }
  return weight > 0 ? sum / weight : values[T[t * 3]];
}
