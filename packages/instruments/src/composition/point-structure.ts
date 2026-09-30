/**
 * Local structure of a point cloud (brief 54): k nearest neighbours and the per-point values estimated from them.
 *
 * Input: a `PointCloud` (F8). Output: frozen values cached by the cloud's content key and the neighbour count; nothing
 * here depends on a camera, a palette or a mark.
 *
 * `nearestNeighbors(cloud, k)` is exact: the `k` closest other points of every point, ascending by distance, ties by
 * point index, found with a uniform grid whose cell size is refined until a non-empty cell holds about three points.
 * Work is linear in `count * k` for roughly even clouds; an isolated point searches more cells but never more than the
 * grid holds. `k` is clamped to `count - 1` (the result reports the k it used).
 *
 * `describePointCloud(cloud, { neighbors })` returns the SAME points (ids, seeds) with these attributes added, all
 * estimated from each point and its `k` nearest neighbours:
 *
 * | attribute | size | meaning |
 * |---|---|---|
 * | `spacing` | 1 | distance to the k-th neighbour, in world units (floored at 1e-9 of the cloud diagonal) |
 * | `density` | 1 | `k / (4/3 pi spacing^3)`: points per world unit^3 by the ball estimate (relative crowding on surfaces) |
 * | `curvature` | 1 | surface variation `l0 / (l0 + l1 + l2)` of the neighbourhood covariance eigenvalues: 0 on a plane or line-free flat patch, up to 1/3 for an isotropic blob |
 * | `principal` | 3 | unit eigenvector of the largest eigenvalue (the local tangent direction of most spread), sign fixed so its first non-zero component is positive |
 * | `height` | 1 | `(y - minY) / (maxY - minY)` over the cloud, 0.5 when the cloud is flat in y |
 * | `curvatureRank`, `densityRank` | 1 | tie-averaged rank of the value among all points in [0, 1] (uniformly distributed whatever the distribution of values; the drivers of colour and thinning) |
 *
 * A cloud without normals gains estimated ones: the eigenvector of the smallest eigenvalue, turned to point away from
 * the centroid (a heuristic that is right for convex-ish subjects and wrong for a shell seen from inside; supply
 * normals when it matters). The cloud may hold at most `POINT_LIMITS.maxAttributes - 7` attributes of its own.
 * Failure: more than `STRUCTURE_LIMITS.maxPoints` points, `k` outside 3..16, or a name clash, each naming the input.
 */
import { cloudStorage, derivePointCloud, POINT_LIMITS, type PointCloud } from "./mesh-sample.js";
import { memoized } from "./sources.js";

export const STRUCTURE_LIMITS = Object.freeze({ maxPoints: 60_000, minNeighbors: 3, maxNeighbors: 16, maxGridCells: 4_000_000 });

export interface NeighborTable {
  /** Neighbours found per point (`min(requested, count - 1)`). */
  readonly k: number;
  readonly count: number;
  /** Row-major `count * k` point indices, ascending by distance then index. */
  readonly index: Int32Array;
  /** Matching distances. */
  readonly distance: Float64Array;
}

const tables = new Map<string, NeighborTable>();
const described = new Map<string, PointCloud>();

function checkNeighbors(label: string, k: number): void {
  if (!Number.isInteger(k) || k < STRUCTURE_LIMITS.minNeighbors || k > STRUCTURE_LIMITS.maxNeighbors)
    throw new Error(`${label}: neighbors must be an integer in ${STRUCTURE_LIMITS.minNeighbors}..${STRUCTURE_LIMITS.maxNeighbors} (got ${String(k)}); change Neighbors`);
}

/** Exact k-nearest-neighbour table of raw positions (x, y, z per point). Not cached; see `nearestNeighbors`. */
export function neighborTable(positions: Float64Array, count: number, requested: number): NeighborTable {
  const k = Math.max(0, Math.min(requested, count - 1));
  const index = new Int32Array(count * k).fill(-1), distance = new Float64Array(count * k).fill(Infinity);
  if (k === 0) return Object.freeze({ k, count, index, distance });
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) for (let c = 0; c < 3; c++) { const v = positions[i * 3 + c]; if (v < min[c]) min[c] = v; if (v > max[c]) max[c] = v; }
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  let h = extent > 0 ? extent / Math.max(1, Math.ceil(Math.cbrt(count / 2))) : 1;
  let dims = [1, 1, 1], cells = 1, start = new Int32Array(0), order = new Int32Array(0), cellOf = new Int32Array(0);
  for (let attempt = 0; attempt < 6; attempt++) {
    dims = [0, 1, 2].map((c) => Math.floor((max[c] - min[c]) / h) + 1);
    cells = dims[0] * dims[1] * dims[2];
    if (cells > STRUCTURE_LIMITS.maxGridCells) { h *= Math.cbrt(cells / STRUCTURE_LIMITS.maxGridCells) * 1.01; attempt--; continue; }
    cellOf = new Int32Array(count);
    start = new Int32Array(cells + 1);
    for (let i = 0; i < count; i++) {
      const cx = Math.min(dims[0] - 1, Math.floor((positions[i * 3] - min[0]) / h)), cy = Math.min(dims[1] - 1, Math.floor((positions[i * 3 + 1] - min[1]) / h)), cz = Math.min(dims[2] - 1, Math.floor((positions[i * 3 + 2] - min[2]) / h));
      const cell = (cz * dims[1] + cy) * dims[0] + cx;
      cellOf[i] = cell; start[cell + 1]++;
    }
    let occupied = 0;
    for (let c = 0; c < cells; c++) if (start[c + 1] > 0) occupied++;
    if (count / occupied <= 5 || extent === 0 || attempt === 5) break;
    h /= 1.6;
  }
  for (let c = 0; c < cells; c++) start[c + 1] += start[c];
  order = new Int32Array(count);
  const fill = start.slice(0, cells);
  for (let i = 0; i < count; i++) order[fill[cellOf[i]]++] = i;
  const dist = new Float64Array(k), found = new Int32Array(k);
  const maxShell = Math.max(dims[0], dims[1], dims[2]);
  for (let i = 0; i < count; i++) {
    const px = positions[i * 3], py = positions[i * 3 + 1], pz = positions[i * 3 + 2];
    const cell = cellOf[i], cx = cell % dims[0], cy = Math.floor(cell / dims[0]) % dims[1], cz = Math.floor(cell / (dims[0] * dims[1]));
    let have = 0;
    for (let r = 0; r <= maxShell; r++) {
      for (let dz = -r; dz <= r; dz++) {
        const z = cz + dz;
        if (z < 0 || z >= dims[2]) continue;
        for (let dy = -r; dy <= r; dy++) {
          const y = cy + dy;
          if (y < 0 || y >= dims[1]) continue;
          const edge = Math.abs(dz) === r || Math.abs(dy) === r, step = edge ? 1 : Math.max(1, 2 * r);
          for (let dx = -r; dx <= r; dx += step) {
            const x = cx + dx;
            if (x < 0 || x >= dims[0]) continue;
            const c = (z * dims[1] + y) * dims[0] + x;
            for (let s = start[c]; s < start[c + 1]; s++) {
              const j = order[s];
              if (j === i) continue;
              const ex = positions[j * 3] - px, ey = positions[j * 3 + 1] - py, ez = positions[j * 3 + 2] - pz, d = ex * ex + ey * ey + ez * ez;
              if (have === k && (d > dist[k - 1] || (d === dist[k - 1] && j > found[k - 1]))) continue;
              let at = have < k ? have++ : k - 1;
              while (at > 0 && (dist[at - 1] > d || (dist[at - 1] === d && found[at - 1] > j))) { dist[at] = dist[at - 1]; found[at] = found[at - 1]; at--; }
              dist[at] = d; found[at] = j;
            }
          }
        }
      }
      if (have === k && dist[k - 1] <= r * h * r * h) break;
    }
    for (let e = 0; e < k; e++) { index[i * k + e] = found[e]; distance[i * k + e] = Math.sqrt(dist[e]); }
  }
  return Object.freeze({ k, count, index, distance });
}

/** Cached exact k-nearest-neighbour table of a cloud (see the module header). */
export function nearestNeighbors(cloud: PointCloud, k: number): NeighborTable {
  const label = `Point cloud "${cloud.id}"`;
  checkNeighbors(label, k);
  if (cloud.count > STRUCTURE_LIMITS.maxPoints) throw new Error(`${label}: ${cloud.count} points; neighbour search is limited to ${STRUCTURE_LIMITS.maxPoints}; reduce Points`);
  return memoized(tables, `${cloud.key}|${k}`, () => neighborTable(cloudStorage(cloud).positions, cloud.count, k));
}

const eigA = new Float64Array(9), eigV = new Float64Array(9);
/**
 * Cyclic Jacobi eigen-decomposition of a symmetric 3x3 matrix `[xx, xy, xz, yy, yz, zz]` into caller-owned buffers:
 * `values[0..2]` ascending, `vectors[3e..3e+2]` the unit eigenvector of value `e`. Allocation-free.
 */
export function eigenSymmetricInto(m: ArrayLike<number>, values: Float64Array, vectors: Float64Array): void {
  const a = eigA, v = eigV;
  a[0] = m[0]; a[1] = m[1]; a[2] = m[2]; a[3] = m[1]; a[4] = m[3]; a[5] = m[4]; a[6] = m[2]; a[7] = m[4]; a[8] = m[5];
  v.fill(0); v[0] = v[4] = v[8] = 1;
  for (let sweep = 0; sweep < 24; sweep++) {
    const off = Math.abs(a[1]) + Math.abs(a[2]) + Math.abs(a[5]);
    if (off < 1e-300 || off < 1e-15 * (Math.abs(a[0]) + Math.abs(a[4]) + Math.abs(a[8]))) break;
    for (let pair = 0; pair < 3; pair++) {
      const p = pair === 2 ? 1 : 0, q = pair === 0 ? 1 : 2;
      const apq = a[p * 3 + q];
      if (apq === 0) continue;
      const theta = (a[q * 3 + q] - a[p * 3 + p]) / (2 * apq);
      const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const akp = a[k * 3 + p], akq = a[k * 3 + q]; a[k * 3 + p] = c * akp - s * akq; a[k * 3 + q] = s * akp + c * akq; }
      for (let k = 0; k < 3; k++) { const apk = a[p * 3 + k], aqk = a[q * 3 + k]; a[p * 3 + k] = c * apk - s * aqk; a[q * 3 + k] = s * apk + c * aqk; }
      for (let k = 0; k < 3; k++) { const vkp = v[k * 3 + p], vkq = v[k * 3 + q]; v[k * 3 + p] = c * vkp - s * vkq; v[k * 3 + q] = s * vkp + c * vkq; }
    }
  }
  let lo = 0, mid = 1, hi = 2;
  if (a[0] > a[4]) { lo = 1; mid = 0; }
  if (a[hi * 4] < a[mid * 4]) { const t = hi; hi = mid; mid = t; }
  if (a[mid * 4] < a[lo * 4]) { const t = mid; mid = lo; lo = t; }
  const order = [lo, mid, hi];
  for (let e = 0; e < 3; e++) { values[e] = a[order[e] * 4]; for (let k = 0; k < 3; k++) vectors[e * 3 + k] = v[k * 3 + order[e]]; }
}

/** Eigen-decomposition of a symmetric 3x3 matrix given as [xx, xy, xz, yy, yz, zz]: ascending values, unit vectors as rows. */
export function eigenSymmetric3(m: readonly number[]): { values: [number, number, number]; vectors: [number[], number[], number[]] } {
  const values = new Float64Array(3), vectors = new Float64Array(9);
  eigenSymmetricInto(m, values, vectors);
  return { values: [values[0], values[1], values[2]], vectors: [0, 1, 2].map((e) => [vectors[e * 3], vectors[e * 3 + 1], vectors[e * 3 + 2]]) as [number[], number[], number[]] };
}

/** Tie-averaged rank in [0, 1] of every value (1 value: 0.5). */
export function rankValues(values: ArrayLike<number>): Float64Array {
  const n = values.length, out = new Float64Array(n);
  if (n === 1) { out[0] = 0.5; return out; }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => values[a] - values[b] || a - b);
  for (let s = 0; s < n;) {
    let e = s;
    while (e + 1 < n && values[order[e + 1]] === values[order[s]]) e++;
    const rank = (s + e) / 2 / (n - 1);
    for (let t = s; t <= e; t++) out[order[t]] = rank;
    s = e + 1;
  }
  return out;
}

/** Attributes `describePointCloud` adds. */
export const DESCRIBED_ATTRIBUTES = Object.freeze(["spacing", "density", "curvature", "principal", "height", "curvatureRank", "densityRank"] as const);

/** The same points with the estimated attributes of the module header. Cached by content and `neighbors`. */
export function describePointCloud(cloud: PointCloud, options: { neighbors: number }): PointCloud {
  const label = `Point cloud "${cloud.id}"`;
  checkNeighbors(label, options.neighbors);
  if (cloud.count > STRUCTURE_LIMITS.maxPoints) throw new Error(`${label}: ${cloud.count} points; structure estimation is limited to ${STRUCTURE_LIMITS.maxPoints}; reduce Points`);
  if (cloud.attributes.length + DESCRIBED_ATTRIBUTES.length > POINT_LIMITS.maxAttributes)
    throw new Error(`${label}: ${cloud.attributes.length} attributes leave no room for the ${DESCRIBED_ATTRIBUTES.length} estimated ones (limit ${POINT_LIMITS.maxAttributes})`);
  return memoized(described, `${cloud.key}|${options.neighbors}`, () => build(cloud, options.neighbors));
}

function build(cloud: PointCloud, neighbors: number): PointCloud {
  const n = cloud.count, s = cloudStorage(cloud), p = s.positions;
  const table = nearestNeighbors(cloud, neighbors), k = table.k;
  const spacing = new Float64Array(n), density = new Float64Array(n), curvature = new Float64Array(n), principal = new Float64Array(n * 3), height = new Float64Array(n);
  const bounds = cloud.bounds;
  const diagonal = bounds ? Math.hypot(bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]) : 0;
  const floor = 1e-9 * (diagonal > 0 ? diagonal : 1);
  let centroid = [0, 0, 0];
  if (!s.normals) { for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) centroid[c] += p[i * 3 + c] / n; }
  const estimated = s.normals ? null : new Float64Array(n * 3), eigValues = new Float64Array(3), eigVectors = new Float64Array(9);
  for (let i = 0; i < n; i++) {
    const r = k > 0 ? Math.max(floor, table.distance[i * k + k - 1]) : floor;
    spacing[i] = r; density[i] = k / (4 / 3 * Math.PI * r * r * r);
    const mean = [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
    for (let e = 0; e < k; e++) { const j = table.index[i * k + e]; for (let c = 0; c < 3; c++) mean[c] += p[j * 3 + c]; }
    for (let c = 0; c < 3; c++) mean[c] /= k + 1;
    const cov = [0, 0, 0, 0, 0, 0];
    for (let e = -1; e < k; e++) {
      const j = e < 0 ? i : table.index[i * k + e];
      const dx = p[j * 3] - mean[0], dy = p[j * 3 + 1] - mean[1], dz = p[j * 3 + 2] - mean[2];
      cov[0] += dx * dx; cov[1] += dx * dy; cov[2] += dx * dz; cov[3] += dy * dy; cov[4] += dy * dz; cov[5] += dz * dz;
    }
    eigenSymmetricInto(cov, eigValues, eigVectors);
    const trace = eigValues[0] + eigValues[1] + eigValues[2];
    curvature[i] = trace > 0 ? Math.max(0, eigValues[0]) / trace : 0;
    const flip = eigVectors[6] !== 0 ? eigVectors[6] < 0 : eigVectors[7] !== 0 ? eigVectors[7] < 0 : eigVectors[8] < 0;
    for (let c = 0; c < 3; c++) principal[i * 3 + c] = flip ? -eigVectors[6 + c] : eigVectors[6 + c];
    if (estimated) {
      const nrm = [eigVectors[0], eigVectors[1], eigVectors[2]], out = nrm[0] * (p[i * 3] - centroid[0]) + nrm[1] * (p[i * 3 + 1] - centroid[1]) + nrm[2] * (p[i * 3 + 2] - centroid[2]);
      for (let c = 0; c < 3; c++) estimated[i * 3 + c] = out < 0 ? -nrm[c] : nrm[c];
    }
  }
  const low = bounds ? bounds.min[1] : 0, span = bounds ? bounds.max[1] - bounds.min[1] : 0;
  for (let i = 0; i < n; i++) height[i] = span > 0 ? (p[i * 3 + 1] - low) / span : 0.5;
  return derivePointCloud(cloud, {
    ...(estimated ? { normals: estimated } : {}),
    attributes: [
      { name: "spacing", size: 1, values: spacing }, { name: "density", size: 1, values: density }, { name: "curvature", size: 1, values: curvature },
      { name: "principal", size: 3, values: principal }, { name: "height", size: 1, values: height },
      { name: "curvatureRank", size: 1, values: rankValues(curvature) }, { name: "densityRank", size: 1, values: rankValues(density) },
    ],
  });
}

