/**
 * Seed surfaces for differential growth: the triangulated starting skin of `surface-growth.ts`.
 *
 * A `GrowthSeed` wraps an indexed triangle `Mesh` (the F8 foundation) with what growth needs and the mesh
 * alone does not say: whether the surface is closed, its mean edge length (the unit of refinement), its
 * boundary as material segments (for edge growth regions) and the vertex sets a constraint can pin. The
 * seed's positions are the MATERIAL coordinates of the model: rest lengths are measured on them, growth
 * fields are evaluated on them, and lineage refers back to them.
 *
 * Bundled seeds (chosen by the instrument through a validated select) are deterministic and cached:
 *
 * | kind     | shape                                                                          | resolution means      |
 * |----------|--------------------------------------------------------------------------------|-----------------------|
 * | `sheet`  | square [-1, 1]^2 in the XZ plane, alternating-diagonal triangles               | cells per side        |
 * | `disc`   | unit disc, rings of 6k vertices (near-equilateral triangles)                   | rings = round(res/2)  |
 * | `strip`  | rectangle 3 x 0.75 (4:1), alternating diagonals                                | cells per 2 units     |
 * | `sphere` | unit icosphere, `round(log2(res / 5))` subdivisions, at most 4                 | see left              |
 *
 * Flat seeds lie in the XZ plane with normal +Y (counter-clockwise seen from above, the F8 convention);
 * the sphere's normals point outward. A caller's own mesh goes through `growthSeed(mesh)`: triangles only,
 * manifold, consistently oriented, every vertex used; anything else throws naming the fault. Hosts binding
 * a user's own mesh to the instrument is future work; the direct API accepts any such `Mesh` today.
 */
import { icosphereMesh } from "./mesh-samples.js";
import { mesh, meshStorage, type Mesh } from "./mesh.js";
import { meshBoundaryEdges, meshEdgeVertices, meshTopology, meshVertexClass } from "./mesh-topology.js";
import { memoized } from "./sources.js";

export const GROWTH_SEED_KINDS = Object.freeze(["sheet", "disc", "strip", "sphere"] as const);
export type GrowthSeedKind = (typeof GROWTH_SEED_KINDS)[number];
export const GROWTH_SEED_LIMITS = Object.freeze({ minResolution: 4, maxResolution: 60 });

/** Vertex sets a constraint can hold fixed (ascending vertex indices; empty for a closed surface). */
export interface GrowthPins {
  readonly rim: readonly number[];
  readonly center: readonly number[];
  readonly side: readonly number[];
}

export interface GrowthSeed {
  /** Content identity: the mesh key. */
  readonly key: string;
  readonly id: string;
  readonly mesh: Mesh;
  readonly closed: boolean;
  /** Mean edge length of the seed, material units: refinement compares edges with this. */
  readonly meanEdge: number;
  /** Boundary edges as material segments `x0 y0 z0 x1 y1 z1`; empty when closed. */
  readonly boundary: Float64Array;
  readonly pins: GrowthPins;
}

const cache = new Map<string, GrowthSeed>();

/** Validate a triangle mesh as a growth seed. `side` optionally names the vertices the `side` pin holds. */
export function growthSeed(input: Mesh, side?: (x: number, y: number, z: number, bounds: Mesh["bounds"]) => boolean): GrowthSeed {
  if (input.quadCount > 0) throw new Error(`Growth seed "${input.id}" has ${input.quadCount} quads; growth needs a triangulated mesh (quads have no diagonal edge to carry a rest length)`);
  const topology = meshTopology(input);
  if (topology.kind !== "open-manifold" && topology.kind !== "closed-manifold")
    throw new Error(`Growth seed "${input.id}" is ${topology.kind}; growth needs a manifold surface with consistently oriented faces`);
  if (topology.counts.unusedVertices > 0) throw new Error(`Growth seed "${input.id}" has ${topology.counts.unusedVertices} vertices no face uses; remove them`);
  const p = meshStorage(input).positions, count = input.vertexCount;
  let total = 0;
  for (let e = 0; e < topology.counts.edges; e++) {
    const [a, b] = meshEdgeVertices(topology, e);
    total += Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);
  }
  const meanEdge = total / topology.counts.edges;
  const closed = topology.kind === "closed-manifold";
  const rim: number[] = [], boundary: number[] = [];
  for (const edge of meshBoundaryEdges(topology)) {
    const [a, b] = meshEdgeVertices(topology, edge);
    boundary.push(p[a * 3], p[a * 3 + 1], p[a * 3 + 2], p[b * 3], p[b * 3 + 1], p[b * 3 + 2]);
  }
  for (let v = 0; v < count; v++) if (meshVertexClass(topology, v) === "boundary") rim.push(v);
  const { min, max } = input.bounds;
  const centre = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  let center = -1, best = Infinity;
  if (!closed) for (let v = 0; v < count; v++) {
    const d = Math.hypot(p[v * 3] - centre[0], p[v * 3 + 1] - centre[1], p[v * 3 + 2] - centre[2]);
    if (d < best - 1e-12) { best = d; center = v; }
  }
  const eps = 1e-9 * Math.max(max[0] - min[0], max[2] - min[2], 1e-9);
  const sideTest = side ?? ((x: number) => x <= min[0] + eps);
  const sides = closed ? [] : rim.filter((v) => sideTest(p[v * 3], p[v * 3 + 1], p[v * 3 + 2], input.bounds));
  return Object.freeze({
    key: input.key, id: input.id, mesh: input, closed, meanEdge, boundary: Float64Array.from(boundary),
    pins: Object.freeze({ rim: Object.freeze(closed ? [] : rim), center: Object.freeze(center < 0 ? [] : [center]), side: Object.freeze(sides) }),
  });
}

const cacheable = (id: string, make: () => GrowthSeed): GrowthSeed => memoized(cache, id, make);

/** Flip every triangle of a planar layout so the normals point +Y. */
function upward(positions: number[], triangles: number[]): number[] {
  let ny = 0;
  for (let t = 0; t < triangles.length; t += 3) {
    const [a, b, c] = [triangles[t] * 3, triangles[t + 1] * 3, triangles[t + 2] * 3];
    ny += (positions[b + 2] - positions[a + 2]) * (positions[c] - positions[a]) - (positions[b] - positions[a]) * (positions[c + 2] - positions[a + 2]);
  }
  if (ny >= 0) return triangles;
  const out = triangles.slice();
  for (let t = 0; t < out.length; t += 3) { const s = out[t + 1]; out[t + 1] = out[t + 2]; out[t + 2] = s; }
  return out;
}

function grid(id: string, columns: number, rows: number, halfWidth: number, halfDepth: number): GrowthSeed {
  const positions: number[] = [], triangles: number[] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) positions.push(-halfWidth + 2 * halfWidth * i / columns, 0, -halfDepth + 2 * halfDepth * j / rows);
  const at = (i: number, j: number): number => j * (columns + 1) + i;
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    if ((i + j) % 2 === 0) triangles.push(a, b, c, a, c, d); else triangles.push(a, b, d, b, c, d);
  }
  return growthSeed(mesh({ id, positions, triangles: upward(positions, triangles) }));
}

function disc(id: string, rings: number): GrowthSeed {
  const positions: number[] = [0, 0, 0], triangles: number[] = [], start: number[] = [0];
  for (let k = 1; k <= rings; k++) {
    start.push(positions.length / 3);
    for (let j = 0; j < 6 * k; j++) { const angle = 2 * Math.PI * j / (6 * k); positions.push(k / rings * Math.cos(angle), 0, k / rings * Math.sin(angle)); }
  }
  for (let k = 1; k <= rings; k++) {
    const outer = 6 * k, inner = k === 1 ? 1 : 6 * (k - 1);
    let o = 0, i = 0;
    const vo = (index: number): number => start[k] + index % outer, vi = (index: number): number => k === 1 ? 0 : start[k - 1] + index % inner;
    while (k === 1 ? o < outer : o < outer || i < inner) {
      const advanceOuter = i >= inner || (o < outer && (o + 1) / outer <= (i + 1) / inner);
      if (advanceOuter) { triangles.push(vi(i), vo(o), vo(o + 1)); o++; } else { triangles.push(vi(i), vo(o), vi(i + 1)); i++; }
    }
  }
  const limit = -0.5;
  return growthSeed(mesh({ id, positions, triangles: upward(positions, triangles) }), (x) => x <= limit);
}

function checkResolution(resolution: number): void {
  const { minResolution, maxResolution } = GROWTH_SEED_LIMITS;
  if (!Number.isInteger(resolution) || resolution < minResolution || resolution > maxResolution)
    throw new Error(`Resolution must be an integer in ${minResolution}..${maxResolution} (got ${String(resolution)})`);
}

/** Subdivision levels of the bundled sphere for a resolution. */
export const sphereLevels = (resolution: number): number => Math.min(4, Math.max(0, Math.round(Math.log2(resolution / 5))));

/** A bundled seed, cached by kind and resolution. */
export function bundledGrowthSeed(kind: GrowthSeedKind, resolution: number): GrowthSeed {
  if (!GROWTH_SEED_KINDS.includes(kind)) throw new Error(`Seed surface must be one of ${GROWTH_SEED_KINDS.join(", ")} (got ${String(kind)})`);
  checkResolution(resolution);
  return cacheable(`${kind}:${resolution}`, () => {
    switch (kind) {
      case "sheet": return grid(`sheet-${resolution}`, resolution, resolution, 1, 1);
      case "strip": return grid(`strip-${resolution}`, Math.max(4, Math.round(1.5 * resolution)), Math.max(2, Math.round(0.375 * resolution)), 1.5, 0.375);
      case "disc": return disc(`disc-${resolution}`, Math.max(2, Math.round(resolution / 2)));
      case "sphere": return growthSeed(icosphereMesh(sphereLevels(resolution)));
    }
  });
}
