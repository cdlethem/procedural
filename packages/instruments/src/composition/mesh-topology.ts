/**
 * Mesh topology (F8): edge table, face adjacency, manifold classification, crease and silhouette edges,
 * connected components.
 *
 * Everything is derived from the SOURCE faces of a `Mesh` (a quad is one face; its triangulating diagonal is
 * never an edge) in time linear in the number of face corners, and cached by the mesh content key.
 *
 * Edges. An edge is an unordered vertex pair `{a < b}` used by at least one face. Edges are numbered in
 * lexicographic (a, b) order, so numbering depends only on the mesh. Id `e:<a>-<b>`. Each edge lists its
 * incident faces (ascending) and its class:
 * - `boundary`: one face.
 * - `manifold`: two faces that traverse the edge in OPPOSITE directions (consistent orientation).
 * - `flipped`: two faces that traverse it in the SAME direction (inconsistent orientation).
 * - `non-manifold`: three or more faces.
 *
 * Vertex fans. The faces around a vertex are connected through shared edges through that vertex. One fan is
 * a manifold vertex; two or more fans (a bow-tie / pinch point) is non-manifold. A vertex is `interior`
 * (one fan, only manifold edges), `boundary` (one fan, exactly two boundary edges, otherwise manifold),
 * `non-manifold` (anything else), or `unused`.
 *
 * Mesh kind: `closed-manifold` (every edge manifold, every vertex interior), `open-manifold` (manifold
 * with boundary), `inconsistent-orientation` (a manifold surface with at least one flipped edge; volumes and
 * silhouettes are unreliable), `non-manifold`. Non-manifold wins over inconsistent.
 *
 * Euler characteristic V - E + F counts USED vertices, real edges and source faces (a cube is 8 - 12 + 6 = 2).
 *
 * Dihedral angle. For an edge with two faces the signed fold angle in degrees, in (-180, 180]:
 * magnitude is the angle between the two outward normals (0 = flat), positive = convex (a ridge, the faces
 * turn away from the viewer of the outside), negative = concave (a valley). For `flipped` edges the second
 * normal is negated first so the fold is geometric. Boundary and non-manifold edges have no angle (NaN).
 * A crease is an edge whose |angle| is at least a threshold (inclusive, with 1e-9 degree slack so a cube's
 * 90 degrees satisfies a 90 degree threshold in floating point).
 *
 * Silhouette. Faces are front-facing when their normal points toward the camera: `n . (eye - c) > 0` at the
 * face centroid `c` (perspective) or `n . (-forward) > 0` (orthographic), strictly; an exactly edge-on face
 * is back-facing. Facing is per source FACE, using the Newell normal; a strongly non-planar quad is
 * therefore classified as one unit. A silhouette edge is one whose faces are not all front or all back
 * (works for non-manifold edges too). Boundary edges are the contour of an open two-sided sheet and are
 * reported separately when asked. Silhouettes assume consistently oriented faces (`kind` reports this).
 *
 * Components. Faces are in the same component when connected through shared VERTICES (so two boxes that
 * touch at a corner are one component). Ordered by their smallest face index; id `c:<k>`.
 */
import { memoized } from "./sources.js";
import { meshDerived, meshStorage, type Mesh } from "./mesh.js";
import type { Camera } from "./camera.js";

export type MeshEdgeClass = "boundary" | "manifold" | "flipped" | "non-manifold";
export type MeshVertexClass = "unused" | "interior" | "boundary" | "non-manifold";
export type MeshKind = "closed-manifold" | "open-manifold" | "inconsistent-orientation" | "non-manifold";
const EDGE_CLASSES: readonly MeshEdgeClass[] = ["boundary", "manifold", "flipped", "non-manifold"];
const VERTEX_CLASSES: readonly MeshVertexClass[] = ["unused", "interior", "boundary", "non-manifold"];

export interface MeshComponentSummary {
  readonly id: string;
  readonly faces: number;
  readonly vertices: number;
  readonly edges: number;
  readonly boundaryEdges: number;
  readonly euler: number;
}

export interface MeshTopologyCounts {
  readonly usedVertices: number;
  readonly unusedVertices: number;
  readonly faces: number;
  readonly edges: number;
  readonly boundaryEdges: number;
  readonly manifoldEdges: number;
  readonly flippedEdges: number;
  readonly nonManifoldEdges: number;
  readonly nonManifoldVertices: number;
  readonly components: number;
  readonly euler: number;
}
export interface MeshTopology {
  readonly meshKey: string;
  readonly kind: MeshKind;
  readonly counts: MeshTopologyCounts;
}

interface TopologyStorage {
  edges: Uint32Array;              // 2 per edge
  edgeFaceStart: Uint32Array;      // E + 1
  edgeFaces: Uint32Array;
  edgeClass: Uint8Array;
  dihedral: Float64Array;          // degrees; NaN when undefined
  faceNeighborStart: Uint32Array;  // F + 1
  faceNeighbors: Uint32Array;
  vertexClass: Uint8Array;
  vertexFans: Uint32Array;
  componentOfFace: Uint32Array;
  componentCount: number;
  summaries?: readonly MeshComponentSummary[];
}
const storages = new WeakMap<object, TopologyStorage>();
const cache = new Map<string, MeshTopology>();

function storage(topology: MeshTopology): TopologyStorage {
  const s = storages.get(topology);
  if (!s) throw new Error("Not a topology produced by meshTopology()");
  return s;
}

/** Union-find over `n` items with path halving. */
class Sets {
  readonly parent: Uint32Array;
  constructor(n: number) { this.parent = new Uint32Array(n); for (let i = 0; i < n; i++) this.parent[i] = i; }
  find(x: number): number {
    const p = this.parent;
    while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; }
    return x;
  }
  union(a: number, b: number): void {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return;
    if (ra < rb) this.parent[rb] = ra; else this.parent[ra] = rb;
  }
}

export function meshTopology(value: Mesh): MeshTopology {
  return memoized(cache, value.key, () => buildTopology(value));
}

function buildTopology(value: Mesh): MeshTopology {
  const s = meshStorage(value), V = value.vertexCount, F = value.faceCount;
  const H = s.faceIndices.length;
  // ---- half edges, bucketed by their smaller vertex
  const lo = new Uint32Array(H), hi = new Uint32Array(H), halfFace = new Uint32Array(H), forward = new Uint8Array(H);
  const bucket = new Uint32Array(V + 1);
  for (let f = 0; f < F; f++) {
    const start = s.faceStart[f], size = s.faceStart[f + 1] - start;
    for (let k = 0; k < size; k++) {
      const a = s.faceIndices[start + k], b = s.faceIndices[start + (k + 1) % size], h = start + k;
      lo[h] = a < b ? a : b; hi[h] = a < b ? b : a; forward[h] = a < b ? 1 : 0; halfFace[h] = f;
      bucket[lo[h] + 1]++;
    }
  }
  for (let v = 0; v < V; v++) bucket[v + 1] += bucket[v];
  const fill = bucket.slice(0, V), order = new Uint32Array(H);
  for (let h = 0; h < H; h++) order[fill[lo[h]]++] = h;
  for (let v = 0; v < V; v++) {
    const from = bucket[v], to = bucket[v + 1];
    if (to - from < 2) continue;
    if (to - from <= 24) {
      for (let i = from + 1; i < to; i++) {
        const h = order[i]; let j = i - 1;
        while (j >= from && (hi[order[j]] > hi[h] || (hi[order[j]] === hi[h] && halfFace[order[j]] > halfFace[h]))) { order[j + 1] = order[j]; j--; }
        order[j + 1] = h;
      }
    } else {
      const part = Array.from(order.subarray(from, to)).sort((x, y) => hi[x] - hi[y] || halfFace[x] - halfFace[y]);
      order.set(part, from);
    }
  }
  // ---- edges
  let E = 0;
  for (let i = 0; i < H; i++) if (i === 0 || lo[order[i]] !== lo[order[i - 1]] || hi[order[i]] !== hi[order[i - 1]]) E++;
  const edges = new Uint32Array(E * 2), edgeFaceStart = new Uint32Array(E + 1), edgeFaces = new Uint32Array(H);
  const edgeClass = new Uint8Array(E), edgeForward = new Uint8Array(H);
  let e = -1;
  for (let i = 0; i < H; i++) {
    const h = order[i];
    if (i === 0 || lo[h] !== lo[order[i - 1]] || hi[h] !== hi[order[i - 1]]) { e++; edges[e * 2] = lo[h]; edges[e * 2 + 1] = hi[h]; edgeFaceStart[e] = i; }
    edgeFaces[i] = halfFace[h]; edgeForward[i] = forward[h];
  }
  edgeFaceStart[E] = H;
  const counts = { boundary: 0, manifold: 0, flipped: 0, nonManifold: 0 };
  for (let k = 0; k < E; k++) {
    const n = edgeFaceStart[k + 1] - edgeFaceStart[k];
    let cls = 0;
    if (n === 1) { cls = 0; counts.boundary++; }
    else if (n === 2) {
      if (edgeForward[edgeFaceStart[k]] !== edgeForward[edgeFaceStart[k] + 1]) { cls = 1; counts.manifold++; } else { cls = 2; counts.flipped++; }
    } else { cls = 3; counts.nonManifold++; }
    edgeClass[k] = cls;
  }
  // ---- dihedral angles
  const d = meshDerived(value), p = s.positions;
  const dihedral = new Float64Array(E).fill(NaN);
  for (let k = 0; k < E; k++) {
    if (edgeClass[k] !== 1 && edgeClass[k] !== 2) continue;
    const f1 = edgeFaces[edgeFaceStart[k]], f2 = edgeFaces[edgeFaceStart[k] + 1];
    const sign = edgeClass[k] === 1 ? 1 : -1;
    const n1x = d.faceNormals[f1 * 3], n1y = d.faceNormals[f1 * 3 + 1], n1z = d.faceNormals[f1 * 3 + 2];
    const n2x = sign * d.faceNormals[f2 * 3], n2y = sign * d.faceNormals[f2 * 3 + 1], n2z = sign * d.faceNormals[f2 * 3 + 2];
    const cx = n1y * n2z - n1z * n2y, cy = n1z * n2x - n1x * n2z, cz = n1x * n2y - n1y * n2x;
    const magnitude = Math.atan2(Math.hypot(cx, cy, cz), n1x * n2x + n1y * n2y + n1z * n2z) * 180 / Math.PI;
    // Edge direction as face f1 traverses it.
    const a = edges[k * 2], b = edges[k * 2 + 1], dir = edgeForward[edgeFaceStart[k]] ? 1 : -1;
    const dx = dir * (p[b * 3] - p[a * 3]), dy = dir * (p[b * 3 + 1] - p[a * 3 + 1]), dz = dir * (p[b * 3 + 2] - p[a * 3 + 2]);
    dihedral[k] = magnitude === 0 ? 0 : (cx * dx + cy * dy + cz * dz > 0 ? magnitude : -magnitude);
  }
  // ---- face adjacency (through any shared edge)
  const degree = new Uint32Array(F + 1);
  for (let k = 0; k < E; k++) {
    const from = edgeFaceStart[k], to = edgeFaceStart[k + 1];
    for (let i = from; i < to; i++) degree[edgeFaces[i] + 1] += to - from - 1;
  }
  for (let f = 0; f < F; f++) degree[f + 1] += degree[f];
  const cursor = degree.slice(0, F), raw = new Uint32Array(degree[F]);
  for (let k = 0; k < E; k++) {
    const from = edgeFaceStart[k], to = edgeFaceStart[k + 1];
    for (let i = from; i < to; i++) for (let j = from; j < to; j++) if (i !== j) raw[cursor[edgeFaces[i]]++] = edgeFaces[j];
  }
  // sort and dedupe each list (two faces can share more than one edge)
  const neighborStart = new Uint32Array(F + 1), neighbors: number[] = [];
  for (let f = 0; f < F; f++) {
    const list = Array.from(raw.subarray(degree[f], degree[f + 1])).sort((x, y) => x - y);
    neighborStart[f] = neighbors.length;
    for (let i = 0; i < list.length; i++) if (i === 0 || list[i] !== list[i - 1]) neighbors.push(list[i]);
  }
  neighborStart[F] = neighbors.length;
  // ---- vertex fans: union corners of faces that share an edge through the vertex
  const fans = new Sets(H);
  const cornerAt = (face: number, vertex: number): number => {
    for (let c = s.faceStart[face]; c < s.faceStart[face + 1]; c++) if (s.faceIndices[c] === vertex) return c;
    throw new Error("internal: corner not found");
  };
  for (let k = 0; k < E; k++) {
    const from = edgeFaceStart[k], to = edgeFaceStart[k + 1];
    for (let i = from + 1; i < to; i++) for (const vertex of [edges[k * 2], edges[k * 2 + 1]]) fans.union(cornerAt(edgeFaces[i - 1], vertex), cornerAt(edgeFaces[i], vertex));
  }
  const fanCount = new Uint32Array(V), used = new Uint8Array(V), seenRoot = new Uint8Array(H);
  for (let c = 0; c < H; c++) {
    used[s.faceIndices[c]] = 1;
    const root = fans.find(c);
    if (!seenRoot[root]) { seenRoot[root] = 1; fanCount[s.faceIndices[c]]++; }
  }
  const boundaryAt = new Uint32Array(V), badAt = new Uint32Array(V);
  for (let k = 0; k < E; k++) for (const v of [edges[k * 2], edges[k * 2 + 1]]) {
    if (edgeClass[k] === 0) boundaryAt[v]++; else if (edgeClass[k] === 3) badAt[v]++;
  }
  const vertexClass = new Uint8Array(V);
  let nonManifoldVertices = 0, usedVertices = 0;
  for (let v = 0; v < V; v++) {
    if (!used[v]) continue;
    usedVertices++;
    let cls: number;
    if (fanCount[v] !== 1 || badAt[v] > 0 || (boundaryAt[v] !== 0 && boundaryAt[v] !== 2)) cls = 3;
    else cls = boundaryAt[v] === 2 ? 2 : 1;
    if (cls === 3) nonManifoldVertices++;
    vertexClass[v] = cls;
  }
  // ---- components through vertices
  const vertexSets = new Sets(V);
  for (let f = 0; f < F; f++) {
    const start = s.faceStart[f], end = s.faceStart[f + 1];
    for (let c = start; c < end; c++) vertexSets.union(s.faceIndices[start], s.faceIndices[c]);
  }
  const rootIndex = new Int32Array(V).fill(-1), componentOfFace = new Uint32Array(F);
  let componentCount = 0;
  for (let f = 0; f < F; f++) {
    const root = vertexSets.find(s.faceIndices[s.faceStart[f]]);
    if (rootIndex[root] < 0) rootIndex[root] = componentCount++;
    componentOfFace[f] = rootIndex[root];
  }
  let kind: MeshKind;
  if (counts.nonManifold > 0 || nonManifoldVertices > 0) kind = "non-manifold";
  else if (counts.flipped > 0) kind = "inconsistent-orientation";
  else kind = counts.boundary > 0 ? "open-manifold" : "closed-manifold";
  const topology: MeshTopology = Object.freeze({
    meshKey: value.key, kind,
    counts: Object.freeze({
      usedVertices, unusedVertices: V - usedVertices, faces: F, edges: E, boundaryEdges: counts.boundary, manifoldEdges: counts.manifold,
      flippedEdges: counts.flipped, nonManifoldEdges: counts.nonManifold, nonManifoldVertices, components: componentCount, euler: usedVertices - E + F,
    }),
  });
  storages.set(topology, { edges, edgeFaceStart, edgeFaces, edgeClass, dihedral, faceNeighborStart: neighborStart, faceNeighbors: Uint32Array.from(neighbors),
    vertexClass, vertexFans: fanCount, componentOfFace, componentCount });
  return topology;
}

// ---------------------------------------------------------------------------------------------
// Accessors

function edgeIndex(topology: MeshTopology, edge: number): void {
  if (!Number.isInteger(edge) || edge < 0 || edge >= topology.counts.edges) throw new Error(`Edge ${edge} is outside 0..${topology.counts.edges - 1}`);
}
export const meshEdgeId = (topology: MeshTopology, edge: number): string => {
  edgeIndex(topology, edge);
  const s = storage(topology);
  return `e:${s.edges[edge * 2]}-${s.edges[edge * 2 + 1]}`;
};
export function meshEdgeVertices(topology: MeshTopology, edge: number): readonly [number, number] {
  edgeIndex(topology, edge);
  const s = storage(topology);
  return [s.edges[edge * 2], s.edges[edge * 2 + 1]];
}
export function meshEdgeFaces(topology: MeshTopology, edge: number): readonly number[] {
  edgeIndex(topology, edge);
  const s = storage(topology);
  return Array.from(s.edgeFaces.subarray(s.edgeFaceStart[edge], s.edgeFaceStart[edge + 1]));
}
export function meshEdgeClass(topology: MeshTopology, edge: number): MeshEdgeClass {
  edgeIndex(topology, edge);
  return EDGE_CLASSES[storage(topology).edgeClass[edge]];
}
/** Signed fold angle in degrees (see the module header); NaN for boundary and non-manifold edges. */
export function meshEdgeAngle(topology: MeshTopology, edge: number): number {
  edgeIndex(topology, edge);
  return storage(topology).dihedral[edge];
}
/** The edge joining two vertices, or -1. */
export function findMeshEdge(topology: MeshTopology, a: number, b: number): number {
  const s = storage(topology), lo = Math.min(a, b), hi = Math.max(a, b);
  let from = 0, to = topology.counts.edges - 1;
  while (from <= to) {
    const mid = (from + to) >> 1, ma = s.edges[mid * 2], mb = s.edges[mid * 2 + 1];
    if (ma === lo && mb === hi) return mid;
    if (ma < lo || (ma === lo && mb < hi)) from = mid + 1; else to = mid - 1;
  }
  return -1;
}
/** Faces sharing at least one edge with `face`, ascending. */
export function meshFaceNeighbors(topology: MeshTopology, face: number): readonly number[] {
  const s = storage(topology);
  if (!Number.isInteger(face) || face < 0 || face >= topology.counts.faces) throw new Error(`Face ${face} is outside 0..${topology.counts.faces - 1}`);
  return Array.from(s.faceNeighbors.subarray(s.faceNeighborStart[face], s.faceNeighborStart[face + 1]));
}
export function meshVertexClass(topology: MeshTopology, vertex: number): MeshVertexClass {
  const s = storage(topology);
  if (!Number.isInteger(vertex) || vertex < 0 || vertex >= s.vertexClass.length) throw new Error(`Vertex ${vertex} is outside 0..${s.vertexClass.length - 1}`);
  return VERTEX_CLASSES[s.vertexClass[vertex]];
}
/** Number of connected fans of faces around a vertex (0 for an unused vertex). */
export function meshVertexFanCount(topology: MeshTopology, vertex: number): number {
  const s = storage(topology);
  if (!Number.isInteger(vertex) || vertex < 0 || vertex >= s.vertexFans.length) throw new Error(`Vertex ${vertex} is outside 0..${s.vertexFans.length - 1}`);
  return s.vertexFans[vertex];
}
export function meshComponentOfFace(topology: MeshTopology, face: number): number {
  const s = storage(topology);
  if (!Number.isInteger(face) || face < 0 || face >= topology.counts.faces) throw new Error(`Face ${face} is outside 0..${topology.counts.faces - 1}`);
  return s.componentOfFace[face];
}
/** One summary per component, in component order. */
export function meshComponents(value: Mesh, topology: MeshTopology): readonly MeshComponentSummary[] {
  const s = storage(topology);
  if (s.summaries) return s.summaries;
  const m = meshStorage(value), n = s.componentCount;
  const faces = new Uint32Array(n), edgeCount = new Uint32Array(n), boundary = new Uint32Array(n), vertexSeen = new Uint8Array(value.vertexCount), vertices = new Uint32Array(n);
  for (let f = 0; f < topology.counts.faces; f++) faces[s.componentOfFace[f]]++;
  for (let f = 0; f < topology.counts.faces; f++) for (let c = m.faceStart[f]; c < m.faceStart[f + 1]; c++) {
    const v = m.faceIndices[c];
    if (!vertexSeen[v]) { vertexSeen[v] = 1; vertices[s.componentOfFace[f]]++; }
  }
  for (let k = 0; k < topology.counts.edges; k++) {
    const component = s.componentOfFace[s.edgeFaces[s.edgeFaceStart[k]]];
    edgeCount[component]++;
    if (s.edgeClass[k] === 0) boundary[component]++;
  }
  const summaries = Object.freeze(Array.from({ length: n }, (_, c): MeshComponentSummary => Object.freeze({
    id: `c:${c}`, faces: faces[c], vertices: vertices[c], edges: edgeCount[c], boundaryEdges: boundary[c], euler: vertices[c] - edgeCount[c] + faces[c] })));
  s.summaries = summaries;
  return summaries;
}

// ---------------------------------------------------------------------------------------------
// Feature edges

/** Edges with a fold of at least `angle` degrees (0 < angle <= 180), ascending. `convexity` filters ridges/valleys. */
export function meshCreaseEdges(topology: MeshTopology, angle: number, convexity: "both" | "convex" | "concave" = "both"): readonly number[] {
  if (typeof angle !== "number" || !(angle > 0 && angle <= 180)) throw new Error(`creaseEdges: angle must be in (0, 180] degrees (got ${String(angle)})`);
  const s = storage(topology), out: number[] = [];
  for (let e = 0; e < topology.counts.edges; e++) {
    const a = s.dihedral[e];
    if (Number.isNaN(a) || Math.abs(a) < angle - 1e-9) continue;
    if (convexity === "convex" && a < 0) continue;
    if (convexity === "concave" && a > 0) continue;
    out.push(e);
  }
  return Object.freeze(out);
}
/** Edges with exactly one face, ascending. */
export function meshBoundaryEdges(topology: MeshTopology): readonly number[] {
  const s = storage(topology), out: number[] = [];
  for (let e = 0; e < topology.counts.edges; e++) if (s.edgeClass[e] === 0) out.push(e);
  return Object.freeze(out);
}
/** Front (1) or back (0) facing of every source face for a camera. */
export function meshFaceFacing(value: Mesh, camera: Camera): Uint8Array {
  const d = meshDerived(value), out = new Uint8Array(value.faceCount);
  const view = [-camera.forward[0], -camera.forward[1], -camera.forward[2]] as const;
  const perspective = camera.options.projection === "perspective";
  for (let f = 0; f < value.faceCount; f++) {
    const nx = d.faceNormals[f * 3], ny = d.faceNormals[f * 3 + 1], nz = d.faceNormals[f * 3 + 2];
    let dot: number;
    if (perspective) dot = nx * (camera.eye[0] - d.faceCentroids[f * 3]) + ny * (camera.eye[1] - d.faceCentroids[f * 3 + 1]) + nz * (camera.eye[2] - d.faceCentroids[f * 3 + 2]);
    else dot = nx * view[0] + ny * view[1] + nz * view[2];
    out[f] = dot > 0 ? 1 : 0;
  }
  return out;
}
/** Edges between front- and back-facing faces for a camera (see the module header), ascending. */
export function meshSilhouetteEdges(value: Mesh, topology: MeshTopology, camera: Camera, options: { boundary?: boolean } = {}): readonly number[] {
  const s = storage(topology), facing = meshFaceFacing(value, camera), out: number[] = [];
  for (let e = 0; e < topology.counts.edges; e++) {
    const from = s.edgeFaceStart[e], to = s.edgeFaceStart[e + 1];
    if (to - from === 1) { if (options.boundary) out.push(e); continue; }
    let front = 0;
    for (let i = from; i < to; i++) front += facing[s.edgeFaces[i]];
    if (front !== 0 && front !== to - from) out.push(e);
  }
  return Object.freeze(out);
}

export interface MeshFeatureOptions {
  /** Crease threshold in degrees, or null for none. */
  readonly crease: number | null;
  readonly convexity?: "both" | "convex" | "concave";
  readonly silhouette: boolean;
  readonly boundary: boolean;
}
export interface MeshFeatureEdge {
  readonly edge: number;
  /** Tone for a path drawn along it: 0 crease, 1 silhouette, 2 boundary (boundary over silhouette over crease). */
  readonly tone: 0 | 1 | 2;
  readonly crease: boolean;
  readonly silhouette: boolean;
  readonly boundary: boolean;
}
/** The union of the selected feature edges, ascending, each labelled with every class it belongs to. */
export function meshFeatureEdges(value: Mesh, topology: MeshTopology, camera: Camera | null, options: MeshFeatureOptions): readonly MeshFeatureEdge[] {
  if (options.silhouette && camera === null) throw new Error("featureEdges: silhouette edges need a camera");
  const crease = new Set(options.crease === null ? [] : meshCreaseEdges(topology, options.crease, options.convexity ?? "both"));
  const silhouette = new Set(options.silhouette ? meshSilhouetteEdges(value, topology, camera!, { boundary: false }) : []);
  const boundary = new Set(options.boundary ? meshBoundaryEdges(topology) : []);
  const out: MeshFeatureEdge[] = [];
  for (let e = 0; e < topology.counts.edges; e++) {
    const isCrease = crease.has(e), isSilhouette = silhouette.has(e), isBoundary = boundary.has(e);
    if (!isCrease && !isSilhouette && !isBoundary) continue;
    out.push(Object.freeze({ edge: e, tone: isBoundary ? 2 : isSilhouette ? 1 : 0, crease: isCrease, silhouette: isSilhouette, boundary: isBoundary }));
  }
  return Object.freeze(out);
}
