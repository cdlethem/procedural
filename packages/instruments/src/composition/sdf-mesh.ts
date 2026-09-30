/**
 * Mesh extraction from a scalar tree on a bounded grid (brief 56): the bridge from an implicit sculpture to the F8
 * visibility, section and point-cloud consumers.
 *
 * METHOD. DUAL CONTOURING on a regular grid (a marching-cubes-family extraction with one vertex per cell). Each grid point
 * is sampled once; a cell whose eight corners are not all on one side of the surface gets ONE vertex, and each grid edge
 * whose end samples differ in sign yields one QUAD joining the vertices of the four cells around it. Why not marching cubes
 * or tetrahedra: they place vertices on grid edges, so every sharp edge of a CSG tree (the rim of a bore, the corner of a
 * cut) becomes a staircase of chamfers as wide as a cell, and the crease and silhouette curves the visibility consumers
 * draw would zigzag. Dual contouring places each cell's vertex where the local surface planes meet: the least-squares point of
 * `sum (n_i . (x - p_i))^2` over the edge crossings `p_i` of the cell with their field gradients `n_i` (unit, by four samples at
 * a thousandth of a cell), taken as the crossings' mean `c` plus the pseudo-inverse step along the well-determined directions only
 * (eigenvalues under a hundredth of the largest are dropped), clamped into the cell. Flat faces stay flat, straight sharp edges land on the edge, corners on the corner. It works for
 * ANY scalar field with a gradient, not only distance bounds: the zero level of `sdf.distance`, negative inside.
 *
 * GRID. The tree's bounding box, padded by one cell on every side, cut into cubes of side `h = longest extent / detail`.
 * A sample exactly zero counts as OUTSIDE. Crossings sit at `t = f_lo / (f_lo - f_hi)` along the edge from the lower end.
 *
 * FACES AND ORIENTATION. Quads are wound so their normal points from the inside sample to the outside one (outward, signed
 * volume positive on a closed result). A quad that folds (its Newell normal is opposed by a triangle of the split) is split
 * into two triangles along the diagonal that keeps them consistent, so the mesh never loses a face to the foundation's quad
 * validation; a quad with coincident corners becomes a triangle. `provenance.splitQuads` counts them, `dropped` faces the
 * foundation still rejected as slivers. Two cells that a thin wall or a tangent contact make share a surface can yield a
 * pinched (non-manifold) vertex: `meshTopology(mesh).kind` reports it, and the consumers treat such a mesh as open.
 *
 * ACCURACY. Smooth surfaces are approximated to second order in `h`; a sharp feature is exact where a cell holds one
 * edge or corner and blurred where a cell holds several features closer than `h`. The mesh approximates the zero set; it is not
 * the field.
 *
 * LIMITS. `detail` in [4, 128]; over `SDF_MESH_LIMITS.maxSamples` grid points, over `DEFAULT_MESH_WORK` primitive
 * evaluations (samples plus four per crossing, worst case `samples * cost * 2`), over the mesh limits (200,000 vertices and
 * 200,000 faces) or with no surface at all the call throws naming Mesh detail; nothing is truncated. Results are frozen and
 * cached (4) by tree key and detail.
 *
 * PROVENANCE (`SdfMesh.provenance`): the tree key and class, method, level (0), grid origin, spacing and dimensions, and
 * counts (samples, surface cells, vertices, quads, split quads, dropped faces, clamped vertices). Positions are in world
 * units, as the tree's.
 */
import { pointCloud, pointCloudData, sampleSurface, type PointCloud } from "./mesh-sample.js";
import { mesh, type Mesh, type Vec3 } from "./mesh.js";
import type { Sdf } from "./sdf.js";
import type { CompositionRun } from "./types.js";

export const SDF_MESH_LIMITS = Object.freeze({ minDetail: 4, maxDetail: 128, maxSamples: 2_500_000, maxVertices: 200_000, maxFaces: 200_000 });
export const DEFAULT_MESH_WORK = 300_000_000;

export interface SdfMeshOptions {
  /** Cubes along the tree's longest side, an integer in [4, 128]. */
  readonly detail: number;
  readonly maxWork?: number;
  readonly run?: CompositionRun;
}
export interface SdfMeshProvenance {
  readonly sdf: string;
  readonly sdfClass: Sdf["class"];
  readonly method: "dual-contouring";
  readonly level: 0;
  readonly detail: number;
  readonly spacing: number;
  readonly origin: Vec3;
  readonly dimensions: readonly [number, number, number];
  readonly samples: number;
  readonly surfaceCells: number;
  readonly vertices: number;
  readonly quads: number;
  readonly splitQuads: number;
  readonly dropped: number;
  readonly clamped: number;
}
export interface SdfMesh {
  readonly mesh: Mesh;
  readonly provenance: SdfMeshProvenance;
}

/** The twelve cube edges as pairs of corner bits (x = 1, y = 2, z = 4), lower corner first. */
const EDGES: readonly (readonly [number, number])[] = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
const cache = new Map<string, SdfMesh>();

/**
 * Least-squares step of the quadratic error `sum (n_i . (x - c - d))^2`: `d = A^+ r` with `A = sum n n^T` and `r = sum n (n . (p - c))`,
 * by the eigen-decomposition of the symmetric matrix `m` (xx, xy, xz, yy, yz, zz; cyclic Jacobi) with eigenvalues below a hundredth of the
 * largest (singular values below a tenth) treated as zero, so a flat face constrains one direction, an edge two, a corner three and nothing is invented along the rest.
 */
function solveTruncated(m: readonly number[], r: readonly number[]): [number, number, number] {
  const A = [[m[0], m[1], m[2]], [m[1], m[3], m[4]], [m[2], m[4], m[5]]], V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 12; sweep++) {
    const off = Math.abs(A[0][1]) + Math.abs(A[0][2]) + Math.abs(A[1][2]);
    if (off < 1e-14) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]] as const) {
      if (Math.abs(A[p][q]) < 1e-300) continue;
      const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
      for (let k = 0; k < 3; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < 3; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
  }
  const lambda = [A[0][0], A[1][1], A[2][2]], top = Math.max(...lambda), out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    if (!(lambda[i] > 0.01 * top) || !(top > 1e-12)) continue;
    const dot = (V[0][i] * r[0] + V[1][i] * r[1] + V[2][i] * r[2]) / lambda[i];
    out[0] += dot * V[0][i]; out[1] += dot * V[1][i]; out[2] += dot * V[2][i];
  }
  return out;
}

export function sdfMesh(tree: Sdf, options: SdfMeshOptions): SdfMesh {
  const { detail } = options;
  if (!Number.isInteger(detail) || detail < SDF_MESH_LIMITS.minDetail || detail > SDF_MESH_LIMITS.maxDetail)
    throw new Error(`sdfMesh: Mesh detail must be an integer in [${SDF_MESH_LIMITS.minDetail}, ${SDF_MESH_LIMITS.maxDetail}] (got ${String(detail)})`);
  const key = `${tree.key}|${detail}`, hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const { min, max } = tree.bounds, extent = [0, 1, 2].map((a) => max[a] - min[a]), h = Math.max(...extent) / detail;
  const dims = extent.map((e) => Math.ceil(e / h - 1e-9) + 2) as [number, number, number];
  const origin: Vec3 = [min[0] - h, min[1] - h, min[2] - h];
  const [nx, ny, nz] = dims, sx = nx + 1, sy = ny + 1, sz = nz + 1, samples = sx * sy * sz;
  if (samples > SDF_MESH_LIMITS.maxSamples) throw new Error(`sdfMesh: ${samples} grid points exceed ${SDF_MESH_LIMITS.maxSamples}; lower Mesh detail (now ${detail})`);
  const worst = Math.ceil(samples * tree.cost * 2), limit = options.maxWork ?? DEFAULT_MESH_WORK;
  if (worst > limit) throw new Error(`sdfMesh: ${samples} grid points x cost ${tree.cost.toFixed(1)} exceed maxWork ${limit}; lower Mesh detail (now ${detail}) or simplify the sculpture`);
  const field = new Float64Array(samples), f = tree.distance;
  for (let k = 0; k < sz; k++) {
    options.run?.check();
    for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) field[(k * sy + j) * sx + i] = f(origin[0] + i * h, origin[1] + j * h, origin[2] + k * h);
  }
  const at = (i: number, j: number, k: number): number => (k * sy + j) * sx + i;
  const cellId = new Int32Array(nx * ny * nz).fill(-1), positions: number[] = [];
  const hn = h * 1e-3, off = new Int32Array(8);
  for (let c = 0; c < 8; c++) off[c] = (c >> 2 & 1) * sx * sy + (c >> 1 & 1) * sx + (c & 1);
  let surfaceCells = 0, clamped = 0;
  const px = [0, 0, 0];
  for (let k = 0; k < nz; k++) {
    options.run?.check();
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const base = at(i, j, k);
      let inside = 0;
      for (let c = 0; c < 8; c++) if (field[base + off[c]] < 0) inside++;
      if (inside === 0 || inside === 8) continue;
      let cx = 0, cy = 0, cz = 0, count = 0;
      const m = [0, 0, 0, 0, 0, 0], r = [0, 0, 0];
      const pts: number[] = [];
      for (const [ca, cb] of EDGES) {
        const fa = field[base + off[ca]], fb = field[base + off[cb]];
        if ((fa < 0) === (fb < 0)) continue;
        const ax = origin[0] + (i + (ca & 1)) * h, ay = origin[1] + (j + (ca >> 1 & 1)) * h, az = origin[2] + (k + (ca >> 2 & 1)) * h;
        const dx = (cb & 1) - (ca & 1), dy = (cb >> 1 & 1) - (ca >> 1 & 1), dz = (cb >> 2 & 1) - (ca >> 2 & 1);
        // Root of the field along the edge by the Illinois method: the field is not linear near a crease, so interpolation alone would
        // put the crossing off the surface by a fraction of a cell.
        let t0 = 0, t1 = 1, f0 = fa, f1 = fb, side = 0, t = f0 / (f0 - f1);
        for (let it = 0; it < 10; it++) {
          t = (t0 * f1 - t1 * f0) / (f1 - f0);
          const ft = f(ax + t * dx * h, ay + t * dy * h, az + t * dz * h);
          if (Math.abs(ft) < 1e-10 * h) break;
          if ((ft < 0) === (f0 < 0)) { t0 = t; f0 = ft; if (side === -1) f1 /= 2; side = -1; } else { t1 = t; f1 = ft; if (side === 1) f0 /= 2; side = 1; }
          if (Math.abs(t1 - t0) < 1e-9) break;
        }
        px[0] = ax + t * dx * h; px[1] = ay + t * dy * h; px[2] = az + t * dz * h;
        cx += px[0]; cy += px[1]; cz += px[2]; count++;
        const n = tree.normal(px[0], px[1], px[2], hn);
        if (n) pts.push(px[0], px[1], px[2], n[0], n[1], n[2]);
      }
      cx /= count; cy /= count; cz /= count;
      for (let q = 0; q < pts.length; q += 6) {
        const [ex, ey, ez, nX, nY, nZ] = [pts[q], pts[q + 1], pts[q + 2], pts[q + 3], pts[q + 4], pts[q + 5]];
        m[0] += nX * nX; m[1] += nX * nY; m[2] += nX * nZ; m[3] += nY * nY; m[4] += nY * nZ; m[5] += nZ * nZ;
        const d = nX * (ex - cx) + nY * (ey - cy) + nZ * (ez - cz);
        r[0] += nX * d; r[1] += nY * d; r[2] += nZ * d;
      }
      const solved = solveTruncated(m, r);
      const vx = cx + solved[0], vy = cy + solved[1], vz = cz + solved[2];
      const lox = origin[0] + i * h, loy = origin[1] + j * h, loz = origin[2] + k * h;
      const qx = Math.min(lox + h, Math.max(lox, vx)), qy = Math.min(loy + h, Math.max(loy, vy)), qz = Math.min(loz + h, Math.max(loz, vz));
      if (qx !== vx || qy !== vy || qz !== vz) clamped++;
      if (positions.length / 3 >= SDF_MESH_LIMITS.maxVertices) throw new Error(`sdfMesh: more than ${SDF_MESH_LIMITS.maxVertices} vertices; lower Mesh detail (now ${detail})`);
      cellId[(k * ny + j) * nx + i] = positions.length / 3;
      positions.push(qx, qy, qz);
      surfaceCells++;
    }
  }
  // Vertices of different cells that land on the same point (within a millionth of a cell) are welded, so a face that collapses leaves no crack.
  const canon = new Int32Array(positions.length / 3), welded = new Map<string, number>(), weld = h * 1e-6;
  for (let v = 0; v < canon.length; v++) {
    const id = `${Math.round(positions[v * 3] / weld)},${Math.round(positions[v * 3 + 1] / weld)},${Math.round(positions[v * 3 + 2] / weld)}`, known = welded.get(id);
    if (known === undefined) { welded.set(id, v); canon[v] = v; } else canon[v] = known;
  }
  const quads: number[] = [], triangles: number[] = [];
  let splitQuads = 0, collapsed = 0;
  const cross = (a: number, b: number, c: number, out: number[]): void => {
    const ux = positions[b * 3] - positions[a * 3], uy = positions[b * 3 + 1] - positions[a * 3 + 1], uz = positions[b * 3 + 2] - positions[a * 3 + 2];
    const vx = positions[c * 3] - positions[a * 3], vy = positions[c * 3 + 1] - positions[a * 3 + 1], vz = positions[c * 3 + 2] - positions[a * 3 + 2];
    out[0] = uy * vz - uz * vy; out[1] = uz * vx - ux * vz; out[2] = ux * vy - uy * vx;
  };
  const n0 = [0, 0, 0], n1 = [0, 0, 0], nq = [0, 0, 0];
  const emit = (a: number, b: number, c: number, d: number, axis: number, sign: number): void => {
    if (quads.length / 4 + triangles.length / 3 >= SDF_MESH_LIMITS.maxFaces) throw new Error(`sdfMesh: more than ${SDF_MESH_LIMITS.maxFaces} faces; lower Mesh detail (now ${detail})`);
    a = canon[a]; b = canon[b]; c = canon[c]; d = canon[d];
    if (sign < 0) { const t = b; b = d; d = t; }
    if (a === b || b === c || c === d || d === a || a === c || b === d) {
      // Welded corners: one repeated neighbour leaves a triangle; opposite corners welded (or two repeats) leave no area, and the
      // faces beside it meet along the collapsed edge, so nothing opens.
      const ring = [a, b, c, d].filter((v, i, all) => v !== all[(i + 1) % 4]);
      if (ring.length === 3 && new Set(ring).size === 3) { splitQuads++; triangles.push(ring[0], ring[1], ring[2]); } else collapsed++;
      return;
    }
    // Newell normal of the quad and the outward axis.
    const ux = positions[c * 3] - positions[a * 3], uy = positions[c * 3 + 1] - positions[a * 3 + 1], uz = positions[c * 3 + 2] - positions[a * 3 + 2];
    const vx = positions[d * 3] - positions[b * 3], vy = positions[d * 3 + 1] - positions[b * 3 + 1], vz = positions[d * 3 + 2] - positions[b * 3 + 2];
    nq[0] = uy * vz - uz * vy; nq[1] = uz * vx - ux * vz; nq[2] = ux * vy - uy * vx;
    const dot = (p: number[]) => p[0] * nq[0] + p[1] * nq[1] + p[2] * nq[2];
    cross(a, b, c, n0); cross(a, c, d, n1);
    const okAc = dot(n0) > 0 && dot(n1) > 0 && nq[axis] * sign > 0;
    cross(a, b, d, n0); cross(b, c, d, n1);
    const okBd = dot(n0) > 0 && dot(n1) > 0 && nq[axis] * sign > 0;
    if (okAc && okBd) { quads.push(a, b, c, d); return; }
    splitQuads++;
    if (okBd && !okAc) triangles.push(a, b, d, b, c, d); else triangles.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz; k++) {
    options.run?.check();
    for (let j = 1; j < ny; j++) for (let i = 1; i < nx; i++) {
      const s0 = field[at(i, j, k)] < 0;
      // x edge (i,j,k)-(i+1,j,k): cells (i, j-1..j, k-1..k)
      if (i < nx && s0 !== field[at(i + 1, j, k)] < 0)
        emit(cellId[((k - 1) * ny + j - 1) * nx + i], cellId[((k - 1) * ny + j) * nx + i], cellId[(k * ny + j) * nx + i], cellId[(k * ny + j - 1) * nx + i], 0, s0 ? 1 : -1);
      // y edge (i,j,k)-(i,j+1,k): cells (i-1..i, j, k-1..k)
      if (j < ny && s0 !== field[at(i, j + 1, k)] < 0)
        emit(cellId[((k - 1) * ny + j) * nx + i - 1], cellId[(k * ny + j) * nx + i - 1], cellId[(k * ny + j) * nx + i], cellId[((k - 1) * ny + j) * nx + i], 1, s0 ? 1 : -1);
      // z edge (i,j,k)-(i,j,k+1): cells (i-1..i, j-1..j, k)
      if (k < nz && s0 !== field[at(i, j, k + 1)] < 0)
        emit(cellId[(k * ny + j - 1) * nx + i - 1], cellId[(k * ny + j - 1) * nx + i], cellId[(k * ny + j) * nx + i], cellId[(k * ny + j) * nx + i - 1], 2, s0 ? 1 : -1);
    }
  }
  if (quads.length + triangles.length === 0) throw new Error(`sdfMesh: the sculpture has no surface at this grid (empty, or thinner than one cell of ${h}); raise Mesh detail (now ${detail})`);
  const built = mesh({ id: `sdf:${tree.key.slice(4, 16)}@${detail}`, positions, triangles, quads, degenerate: "drop" });
  const value: SdfMesh = Object.freeze({
    mesh: built,
    provenance: Object.freeze({ sdf: tree.key, sdfClass: tree.class, method: "dual-contouring" as const, level: 0 as const, detail, spacing: h, origin,
      dimensions: Object.freeze(dims) as readonly [number, number, number], samples, surfaceCells, vertices: built.vertexCount, quads: built.quadCount, splitQuads, dropped: built.dropped.length + collapsed, clamped }),
  });
  cache.set(key, value);
  if (cache.size > 4) cache.delete(cache.keys().next().value!);
  return value;
}

export interface SurfacePointOptions {
  readonly detail: number;
  readonly count: number;
  readonly seed: number;
  /** Newton steps that pull each sample onto the exact zero set (0 to 8, default 3); ignored for a `scalar` tree. */
  readonly refine?: number;
}
/**
 * Area-weighted, prefix-stable surface points of the extracted mesh, pulled onto the exact zero set of the field by Newton
 * steps along its gradient, with unit gradient normals: an owned `PointCloud` for depth-aware grains (`projectPoints`,
 * `visiblePoints`). Point `k` depends only on the tree, detail, seed and `k`, so thinning is by prefix. A scalar tree is
 * sampled from the mesh without refinement (its normals are the mesh's).
 */
export function sdfSurfacePoints(tree: Sdf, options: SurfacePointOptions): PointCloud {
  const refine = options.refine ?? 3;
  if (!Number.isInteger(refine) || refine < 0 || refine > 8) throw new Error(`sdfSurfacePoints: refine must be an integer in [0, 8] (got ${String(refine)})`);
  const extracted = sdfMesh(tree, { detail: options.detail });
  const samples = sampleSurface(extracted.mesh, { seed: options.seed, count: options.count, distribution: "even", normals: "smooth" });
  const id = `sdf-points:${tree.key.slice(4, 16)}@${options.detail}`, data = pointCloudData(samples);
  if (tree.class === "scalar" || refine === 0 || samples.count === 0) return pointCloud({ id, positions: data.positions, normals: data.normals ?? undefined, seed: options.seed });
  const positions = Float64Array.from(data.positions), normals = new Float64Array(positions.length), step = 1e-3 * tree.radius;
  for (let p = 0; p < samples.count; p++) {
    let x = positions[p * 3], y = positions[p * 3 + 1], z = positions[p * 3 + 2];
    for (let r = 0; r < refine; r++) {
      const g = tree.normal(x, y, z, step);
      if (!g) break;
      const d = tree.distance(x, y, z);
      x -= d * g[0]; y -= d * g[1]; z -= d * g[2];
    }
    const g = tree.normal(x, y, z, step) ?? (data.normals ? [data.normals[p * 3], data.normals[p * 3 + 1], data.normals[p * 3 + 2]] as Vec3 : [0, 1, 0] as Vec3);
    positions[p * 3] = x; positions[p * 3 + 1] = y; positions[p * 3 + 2] = z;
    normals[p * 3] = g[0]; normals[p * 3 + 1] = g[1]; normals[p * 3 + 2] = g[2];
  }
  return pointCloud({ id, positions, normals, seed: options.seed });
}
