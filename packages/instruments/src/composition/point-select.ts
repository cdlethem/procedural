/**
 * World-space selection and displacement of a point cloud (brief 54): cut, thin, focus, disperse. Nothing here reads a
 * camera, so none of it is recomputed by a view or appearance edit.
 *
 * All four keep every surviving point's id, seed and attributes (`selectPoints`, `derivePointCloud`), so a colour or
 * thinning edit never renames what remains.
 *
 * `PointFrame` is the fixed frame the artist's numbers refer to: the subject's bounds centre, per-axis half extents and
 * bounding-sphere radius. It comes from the subject, not from the points that survive earlier stages, so cutting or thinning
 * moves nothing else.
 *
 * `cutPoints` keeps the closed half-space `coordinate <= centre + at * halfExtent` on one axis (`flip`: `>=`). `cutMesh` does
 * the same to the source mesh for occlusion, keeping the faces whose CENTROID is kept, so the cut edge of the occluder is
 * as ragged as the source triangles (open at the cut; the interior of a cut solid is visible through it).
 *
 * `keepPoints` is the density rule. Every point has a fixed rank `r_i` in [0, 1), a hash of `(cloud seed, source index)`
 * that depends on nothing else. With `fraction` t in [0, 1], rule weight `a_i` in [0, 1] (importance: 1 keeps more) and
 * `bias` b, the keep probability is `p_i = t ^ e_i` with `e_i = 2 ^ (2 b (1 - 2 a_i))`, so p is monotone in t, is exactly
 * t at b = 0, is 0 at t = 0 and 1 at t = 1; a focus ball adds `w_i (1 - p_i)` (w_i = 1 inside the ball, a smoothstep to 0
 * across `falloff` of its radius). A point is kept when `r_i < p_i`.
 * Consequences (tested): kept sets are NESTED in `fraction` (t < t' keeps a subset), a point's rank never changes, and the
 * uniform rule at b = 0 with no focus keeps the same points whatever the point count above them (prefix stability with
 * the subject's prefix property). Rules: `uniform` (a = 0.5), `even-out` (a = 1 - densityRank: crowded points are
 * dropped first, leaving an even spread), `features` (a = curvatureRank: flat points are dropped first, edges stay). The
 * two rank rules read attributes of the FULL cloud (`describePointCloud`) and so change if the point count does; the
 * kept count is measured, not promised (it equals `round(t n)` only for the uniform rule in expectation).
 *
 * `dispersePoints` moves each point by `amount * spacing_i * ((1 - bias) * g_i + bias * t_i * n_i)`: `g_i` a seeded
 * point inside the unit ball, `t_i` a seeded value in [-1, 1] and `n_i` the point's normal, so every offset is at most
 * `amount` local spacings; `bias` 0 is isotropic fuzz and 1 pushes along the normal (a thick skin). `spacing` comes from
 * `describePointCloud`. Amount 0 returns the cloud itself. Normals and attributes are kept as estimated on the source.
 */
import type { Mesh, Vec3 } from "./mesh.js";
import { meshData, mesh as makeMesh } from "./mesh.js";
import { cloudStorage, derivePointCloud, mixHash, selectPoints, type PointCloud } from "./mesh-sample.js";

export interface PointFrame {
  readonly center: Vec3;
  readonly half: Vec3;
  readonly radius: number;
}

/** The frame of a cloud's bounds and its bounding sphere about the bounds centre. */
export function pointFrame(cloud: PointCloud): PointFrame {
  if (!cloud.bounds) throw new Error(`Point cloud "${cloud.id}" is empty and has no frame`);
  const { min, max } = cloud.bounds, p = cloudStorage(cloud).positions;
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  let radius = 0;
  for (let i = 0; i < cloud.count; i++) radius = Math.max(radius, Math.hypot(p[i * 3] - center[0], p[i * 3 + 1] - center[1], p[i * 3 + 2] - center[2]));
  return Object.freeze({ center: Object.freeze(center) as Vec3, half: Object.freeze([(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2]) as Vec3, radius: radius > 0 ? radius : 1 });
}

export type CutAxis = "none" | "x" | "y" | "z";
export interface CutSpec {
  readonly axis: CutAxis;
  /** Plane position as a fraction of the half extent about the centre, -1..1. */
  readonly at: number;
  /** Keep the far side instead of the near (low-coordinate) side. */
  readonly flip: boolean;
}
const AXIS: Record<string, number> = { x: 0, y: 1, z: 2 };

function checkCut(spec: CutSpec): void {
  if (spec.axis !== "none" && !(spec.axis in AXIS)) throw new Error(`Cut axis must be none, x, y or z (got ${String(spec.axis)})`);
  if (typeof spec.at !== "number" || !Number.isFinite(spec.at)) throw new Error(`Cut position must be a finite number (got ${String(spec.at)})`);
}
const planeOf = (spec: CutSpec, frame: PointFrame): number => frame.center[AXIS[spec.axis]] + spec.at * frame.half[AXIS[spec.axis]];

/** Keep the half-space of `spec`; `axis: "none"` returns the cloud itself. */
export function cutPoints(cloud: PointCloud, spec: CutSpec, frame: PointFrame): PointCloud {
  checkCut(spec);
  if (spec.axis === "none") return cloud;
  const axis = AXIS[spec.axis], plane = planeOf(spec, frame), p = cloudStorage(cloud).positions, keep: number[] = [];
  for (let i = 0; i < cloud.count; i++) if (spec.flip ? p[i * 3 + axis] >= plane : p[i * 3 + axis] <= plane) keep.push(i);
  return selectPoints(cloud, keep, `${cloud.id}[cut ${spec.axis}]`);
}

const cutMeshes = new Map<string, Mesh>();
/** The mesh faces whose centroid lies in the kept half-space; `axis: "none"` returns the mesh itself. */
export function cutMesh(source: Mesh, spec: CutSpec, frame: PointFrame): Mesh {
  checkCut(spec);
  if (spec.axis === "none") return source;
  const cacheKey = `${source.key}|${spec.axis}|${spec.at}|${spec.flip}|${frame.center}|${frame.half}`;
  const hit = cutMeshes.get(cacheKey);
  if (hit) return hit;
  const axis = AXIS[spec.axis], plane = planeOf(spec, frame), data = meshData(source);
  const keeps = (corners: readonly number[]): boolean => {
    let sum = 0;
    for (const v of corners) sum += data.positions[v * 3 + axis];
    const centroid = sum / corners.length;
    return spec.flip ? centroid >= plane : centroid <= plane;
  };
  const triangles: number[] = [], quads: number[] = [];
  for (let f = 0; f < data.triangles.length; f += 3) if (keeps(data.triangles.slice(f, f + 3))) triangles.push(...data.triangles.slice(f, f + 3));
  for (let f = 0; f < data.quads.length; f += 4) if (keeps(data.quads.slice(f, f + 4))) quads.push(...data.quads.slice(f, f + 4));
  const cut = makeMesh({ id: `${source.id}[cut ${spec.axis}]`, positions: data.positions, triangles, quads });
  if (cutMeshes.size >= 4) cutMeshes.delete(cutMeshes.keys().next().value!);
  cutMeshes.set(cacheKey, cut);
  return cut;
}

export type ThinRule = "uniform" | "even-out" | "features";
export const THIN_RULES: readonly ThinRule[] = ["uniform", "even-out", "features"];
export interface FocusSpec {
  /** Ball centre in frame units: each axis -1..1 of the half extent about the frame centre. */
  readonly center: Vec3;
  /** Ball radius as a fraction of the frame radius. */
  readonly radius: number;
  /** Width of the soft edge as a fraction of the radius, 0 (hard) to 1 (from the centre). */
  readonly falloff: number;
}
export interface KeepSpec {
  readonly fraction: number;
  readonly rule: ThinRule;
  /** Strength of the rule, 0 (uniform) up. */
  readonly bias: number;
  readonly focus: FocusSpec | null;
}
export interface Kept {
  readonly cloud: PointCloud;
  /** Index in the input cloud of every kept point, ascending. */
  readonly indices: Uint32Array;
  /** Probability each INPUT point was kept with (before the rank test), for diagnostics. */
  readonly probability: Float64Array;
}

const smooth = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/** Fixed rank of point `index` of `cloud` in [0, 1): a hash of the seed and the point's source index only. */
export function pointRank(cloud: PointCloud, index: number): number {
  const s = cloudStorage(cloud);
  return mixHash(cloud.seed, s.source ? s.source[index] : index, 0x7e1a);
}

export function keepPoints(cloud: PointCloud, spec: KeepSpec, frame: PointFrame): Kept {
  const { fraction, rule, bias, focus } = spec;
  if (typeof fraction !== "number" || !(fraction >= 0 && fraction <= 1)) throw new Error(`Keep must be a number in 0..1 (got ${String(fraction)}); change Keep`);
  if (!THIN_RULES.includes(rule)) throw new Error(`Thin rule must be one of ${THIN_RULES.join(", ")} (got ${String(rule)})`);
  if (typeof bias !== "number" || !(bias >= 0) || !Number.isFinite(bias)) throw new Error(`Rule strength must be a finite number >= 0 (got ${String(bias)}); change Rule strength`);
  const s = cloudStorage(cloud), n = cloud.count, p = s.positions;
  const attribute = (name: string): Float64Array => {
    const found = s.attributes.find((a) => a.name === name);
    if (!found) throw new Error(`Thin rule "${rule}" needs the attribute "${name}"; describe the cloud first (describePointCloud)`);
    return found.values;
  };
  const weight = rule === "even-out" ? attribute("densityRank") : rule === "features" ? attribute("curvatureRank") : null;
  const probability = new Float64Array(n), kept: number[] = [];
  let center: [number, number, number] | null = null, radius = 0;
  if (focus) {
    if (!(focus.radius >= 0) || !(focus.falloff >= 0 && focus.falloff <= 1)) throw new Error("Focus radius must be >= 0 and falloff in 0..1");
    center = [frame.center[0] + focus.center[0] * frame.half[0], frame.center[1] + focus.center[1] * frame.half[1], frame.center[2] + focus.center[2] * frame.half[2]];
    radius = focus.radius * frame.radius;
  }
  for (let i = 0; i < n; i++) {
    let prob: number;
    if (fraction === 0) prob = 0;
    else if (fraction === 1) prob = 1;
    else {
      const a = weight ? (rule === "even-out" ? 1 - weight[i] : weight[i]) : 0.5;
      prob = Math.pow(fraction, Math.pow(2, 2 * bias * (1 - 2 * a)));
    }
    if (center) {
      const d = Math.hypot(p[i * 3] - center[0], p[i * 3 + 1] - center[1], p[i * 3 + 2] - center[2]);
      const inner = radius * (1 - focus!.falloff), w = d <= inner ? 1 : d >= radius ? 0 : 1 - smooth((d - inner) / (radius - inner));
      prob += w * (1 - prob);
    }
    probability[i] = prob;
    if (pointRank(cloud, i) < prob) kept.push(i);
  }
  const indices = Uint32Array.from(kept);
  return Object.freeze({ cloud: selectPoints(cloud, kept, `${cloud.id}~keep`), indices, probability });
}

/** Displace points by seeded offsets of at most `amount` local spacings (see the module header). */
export function dispersePoints(cloud: PointCloud, options: { amount: number; bias: number }): PointCloud {
  const { amount, bias } = options;
  if (typeof amount !== "number" || !(amount >= 0) || !Number.isFinite(amount)) throw new Error(`Dispersion must be a finite number >= 0 (got ${String(amount)}); change Dispersion`);
  if (typeof bias !== "number" || !(bias >= 0 && bias <= 1)) throw new Error(`Along normals must be a number in 0..1 (got ${String(bias)}); change Along normals`);
  if (amount === 0 || cloud.count === 0) return cloud;
  const s = cloudStorage(cloud), spacing = s.attributes.find((a) => a.name === "spacing");
  if (!spacing) throw new Error("Dispersion needs the attribute \"spacing\"; describe the cloud first (describePointCloud)");
  if (!s.normals) throw new Error(`Point cloud "${cloud.id}" has no normals; Dispersion needs them`);
  const positions = s.positions.slice();
  for (let i = 0; i < cloud.count; i++) {
    const src = s.source ? s.source[i] : i, h = (stream: number): number => mixHash(cloud.seed, src, 0x5d00 + stream);
    const cosT = 2 * h(0) - 1, sinT = Math.sqrt(1 - cosT * cosT), phi = 2 * Math.PI * h(1), rho = Math.cbrt(h(2)), t = 2 * h(3) - 1;
    const scale = amount * spacing.values[i];
    const gx = sinT * Math.cos(phi) * rho, gy = cosT * rho, gz = sinT * Math.sin(phi) * rho;
    positions[i * 3] += scale * ((1 - bias) * gx + bias * t * s.normals[i * 3]);
    positions[i * 3 + 1] += scale * ((1 - bias) * gy + bias * t * s.normals[i * 3 + 1]);
    positions[i * 3 + 2] += scale * ((1 - bias) * gz + bias * t * s.normals[i * 3 + 2]);
  }
  return derivePointCloud(cloud, { id: `${cloud.id}~fuzz`, positions });
}
