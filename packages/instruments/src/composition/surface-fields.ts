/**
 * Scalar, direction and spacing fields on a mesh, for surface strands (brief 52).
 *
 * All three are PER-VERTEX arrays computed from the mesh and a small scalar spec, cached by mesh content key and spec
 * (never by palette, camera or drawing). They are interpolated barycentrically inside triangles by `mesh-trace.ts`.
 *
 * SCALAR (`scalarField`): one of `height` (y), `axis` (distance from the vertical line through the bounds centre),
 * `centre` (distance from the bounds centre), `plane` (signed distance along the horizontal direction `angle` degrees
 * from +x toward +z), `waves` (a seeded sum of three sinusoids with random 3D directions; `frequency` cycles across the
 * bounds diagonal), each affinely normalised to [0, 1] over the vertices the triangles use (a constant field is 0.5
 * everywhere). Normalising makes every field independent of the mesh's size; 0 and 1 are the field's own extremes.
 *
 * DIRECTION (`flowVectors`): a unit tangent vector per vertex, zero where undefined.
 *  - source `isolines`: the direction of the isolines of a scalar, `n x grad s` at each vertex. `grad s` is the exact
 *    gradient of the piecewise-linear scalar in each triangle (`sum s_i grad lambda_i`), averaged over the vertex's
 *    triangles weighted by their interior angle there and projected to the tangent plane. It is zero (so undefined) at
 *    a critical point (peak, pit, saddle) and wherever the scalar is constant (under 1e-4 of the largest gradient).
 *  - source `guide`: the projection of a fixed world direction (`yaw`, `pitch` in degrees, yaw 0 = +z, positive yaw toward
 *    +x) on the tangent plane; undefined where it is nearly along the normal.
 *  The primary direction is then turned about the vertex normal by `angle + cross + swirl * (2 h - 1)` degrees, where `cross`
 *  is 0 for family A and the weave angle for family B, `h` in [0, 1] is a second scalar (`swirlScalar`) and `swirl` its
 *  amplitude: the orientation varies smoothly over the surface, from `angle - swirl` where `h = 0` to `angle + swirl` where
 *  `h = 1`. Positive angles turn from the primary direction toward `n x primary` (counter-clockwise seen from outside).
 *
 * SPACING (`spacingField`): the target thread spacing at each vertex in world units: `base * ratio^(0.5 - h)` for the
 * density scalar `h` (or `1 - h` when reversed), so a ratio of 1 is uniform, and larger ratios make `h = 1` the dense end
 * (`base / sqrt(ratio)`) and `h = 0` the sparse end (`base sqrt(ratio)`). Spacing is a surface distance in world units: a
 * uniform field on any surface means equal threads per surface length, never per UV cell.
 */
import { componentSeed } from "./core.js";
import { traceGraph, type TraceGraph } from "./mesh-trace.js";
import { meshStorage, type Mesh } from "./mesh.js";

export const scalarKinds = ["height", "axis", "centre", "plane", "waves"] as const;
export type ScalarKind = (typeof scalarKinds)[number];
export interface ScalarSpec {
  readonly kind: ScalarKind;
  /** Degrees; `plane` only. */
  readonly angle: number;
  /** Cycles across the bounds diagonal; `waves` only. */
  readonly frequency: number;
  /** Uint32; `waves` only. */
  readonly seed: number;
}

export interface FlowSpec {
  readonly source: "isolines" | "guide";
  readonly scalar: ScalarSpec;
  /** World direction of the guide, degrees; `guide` only. */
  readonly yaw: number;
  readonly pitch: number;
  /** Degrees added to every direction. */
  readonly angle: number;
  /** Amplitude in degrees of the direction change driven by `swirlScalar`. */
  readonly swirl: number;
  readonly swirlScalar: ScalarSpec;
}
export interface DensitySpec { readonly scalar: ScalarSpec | null; readonly ratio: number; readonly reverse: boolean }

const cache = new Map<string, unknown>();
function remember<T>(key: string, make: () => T): T {
  const hit = cache.get(key) as T | undefined;
  if (hit !== undefined) { cache.delete(key); cache.set(key, hit); return hit; }
  const value = make();
  cache.set(key, value);
  if (cache.size > 64) cache.delete(cache.keys().next().value!);
  return value;
}

function checkScalar(spec: ScalarSpec, what: string): void {
  if (!scalarKinds.includes(spec.kind)) throw new Error(`${what}: unknown scalar field ${String(spec.kind)}; choose one of ${scalarKinds.join(", ")}`);
  if (!Number.isFinite(spec.angle)) throw new Error(`${what}: angle must be finite`);
  if (!Number.isFinite(spec.frequency) || spec.frequency <= 0 || spec.frequency > 64) throw new Error(`${what}: frequency must be in (0, 64] cycles`);
  if (!Number.isSafeInteger(spec.seed) || spec.seed < 0 || spec.seed > 0xffffffff) throw new Error(`${what}: seed must be a uint32 integer`);
}

/** The used-vertex mask: a vertex with a zero normal belongs to no triangle. */
function usedVertices(g: TraceGraph): Uint8Array {
  const used = new Uint8Array(g.mesh.vertexCount), T = g.triangles;
  for (let i = 0; i < g.mesh.triangleCount * 3; i++) used[T[i]] = 1;
  return used;
}

/** The three sinusoids of a `waves` field as `[kx, ky, kz, phase]` per unit of world length. */
export function waveTerms(spec: ScalarSpec, diagonal: number): readonly (readonly [number, number, number, number])[] {
  const unit = (id: string): number => componentSeed(spec.seed, id, "surface-waves") / 0x1_0000_0000;
  return [0, 1, 2].map((i) => {
    const z = 2 * unit(`d${i}-z`) - 1, phi = 2 * Math.PI * unit(`d${i}-phi`), r = Math.sqrt(1 - z * z);
    const k = 2 * Math.PI * spec.frequency * (0.75 + 0.5 * unit(`d${i}-k`)) / diagonal;
    return [k * r * Math.cos(phi), k * z, k * r * Math.sin(phi), 2 * Math.PI * unit(`d${i}-phase`)] as const;
  });
}

/** Per-vertex scalar in [0, 1] (see the module header). */
export function scalarField(value: Mesh, spec: ScalarSpec): Float64Array {
  checkScalar(spec, "scalar field");
  return remember(`s|${value.key}|${spec.kind}|${spec.kind === "plane" ? spec.angle : 0}|${spec.kind === "waves" ? `${spec.frequency}|${spec.seed}` : 0}`, () => {
    const g = traceGraph(value), p = meshStorage(value).positions, used = usedVertices(g), V = value.vertexCount;
    const { min, max } = value.bounds, cx = (min[0] + max[0]) / 2, cy = (min[1] + max[1]) / 2, cz = (min[2] + max[2]) / 2;
    const diagonal = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    const a = spec.angle * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a), waves = spec.kind === "waves" ? waveTerms(spec, diagonal) : [];
    const raw = new Float64Array(V);
    let low = Infinity, high = -Infinity;
    for (let v = 0; v < V; v++) {
      if (!used[v]) continue;
      const x = p[v * 3] - cx, y = p[v * 3 + 1] - cy, z = p[v * 3 + 2] - cz;
      let f: number;
      switch (spec.kind) {
        case "height": f = y; break;
        case "axis": f = Math.hypot(x, z); break;
        case "centre": f = Math.hypot(x, y, z); break;
        case "plane": f = x * ux + z * uz; break;
        case "waves": f = 0; for (const [kx, ky, kz, phase] of waves) f += Math.sin(kx * x + ky * y + kz * z + phase); break;
      }
      raw[v] = f; low = Math.min(low, f); high = Math.max(high, f);
    }
    const out = new Float64Array(V), range = high - low;
    for (let v = 0; v < V; v++) if (used[v]) out[v] = range > 1e-12 * Math.max(1, Math.abs(high), Math.abs(low)) ? (raw[v] - low) / range : 0.5;
    return out;
  });
}

/** Tangent gradient of a per-vertex scalar, unit or zero, 3 per vertex; zero where the gradient is under 1e-4 of the largest. */
export function tangentGradients(g: TraceGraph, values: ArrayLike<number>): Float64Array {
  const V = g.mesh.vertexCount, T = g.mesh.triangleCount, P = g.positions, tri = g.triangles, G = g.gradients;
  const sum = new Float64Array(V * 3);
  for (let t = 0; t < T; t++) {
    const s0 = values[tri[t * 3]], s1 = values[tri[t * 3 + 1]], s2 = values[tri[t * 3 + 2]], o = t * 9;
    const gx = s0 * G[o] + s1 * G[o + 3] + s2 * G[o + 6], gy = s0 * G[o + 1] + s1 * G[o + 4] + s2 * G[o + 7], gz = s0 * G[o + 2] + s1 * G[o + 5] + s2 * G[o + 8];
    for (let k = 0; k < 3; k++) {
      const v = tri[t * 3 + k], a = tri[t * 3 + (k + 1) % 3], b = tri[t * 3 + (k + 2) % 3];
      const ax = P[a * 3] - P[v * 3], ay = P[a * 3 + 1] - P[v * 3 + 1], az = P[a * 3 + 2] - P[v * 3 + 2];
      const bx = P[b * 3] - P[v * 3], by = P[b * 3 + 1] - P[v * 3 + 1], bz = P[b * 3 + 2] - P[v * 3 + 2];
      const angle = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by + az * bz) / (Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz)))));
      sum[v * 3] += angle * gx; sum[v * 3 + 1] += angle * gy; sum[v * 3 + 2] += angle * gz;
    }
  }
  const out = new Float64Array(V * 3), lengths = new Float64Array(V), N = g.vertexNormals;
  let largest = 0;
  for (let v = 0; v < V; v++) {
    const dot = sum[v * 3] * N[v * 3] + sum[v * 3 + 1] * N[v * 3 + 1] + sum[v * 3 + 2] * N[v * 3 + 2];
    const x = sum[v * 3] - N[v * 3] * dot, y = sum[v * 3 + 1] - N[v * 3 + 1] * dot, z = sum[v * 3 + 2] - N[v * 3 + 2] * dot;
    out[v * 3] = x; out[v * 3 + 1] = y; out[v * 3 + 2] = z;
    lengths[v] = Math.hypot(x, y, z); largest = Math.max(largest, lengths[v]);
  }
  for (let v = 0; v < V; v++) {
    if (lengths[v] <= 1e-4 * largest || lengths[v] === 0) { out[v * 3] = out[v * 3 + 1] = out[v * 3 + 2] = 0; continue; }
    out[v * 3] /= lengths[v]; out[v * 3 + 1] /= lengths[v]; out[v * 3 + 2] /= lengths[v];
  }
  return out;
}

/** The primary direction per vertex before any turn: isolines or the projected guide. */
function primaryDirections(value: Mesh, spec: FlowSpec): Float64Array {
  const g = traceGraph(value), V = value.vertexCount, N = g.vertexNormals, out = new Float64Array(V * 3);
  if (spec.source === "guide") {
    const yaw = spec.yaw * Math.PI / 180, pitch = spec.pitch * Math.PI / 180;
    const wx = Math.cos(pitch) * Math.sin(yaw), wy = Math.sin(pitch), wz = Math.cos(pitch) * Math.cos(yaw);
    for (let v = 0; v < V; v++) {
      const dot = wx * N[v * 3] + wy * N[v * 3 + 1] + wz * N[v * 3 + 2];
      const x = wx - N[v * 3] * dot, y = wy - N[v * 3 + 1] * dot, z = wz - N[v * 3 + 2] * dot, l = Math.hypot(x, y, z);
      if (l < 1e-3 || (N[v * 3] === 0 && N[v * 3 + 1] === 0 && N[v * 3 + 2] === 0)) continue;
      out[v * 3] = x / l; out[v * 3 + 1] = y / l; out[v * 3 + 2] = z / l;
    }
    return out;
  }
  const grad = tangentGradients(g, scalarField(value, spec.scalar));
  for (let v = 0; v < V; v++) {
    const gx = grad[v * 3], gy = grad[v * 3 + 1], gz = grad[v * 3 + 2];
    out[v * 3] = N[v * 3 + 1] * gz - N[v * 3 + 2] * gy;
    out[v * 3 + 1] = N[v * 3 + 2] * gx - N[v * 3] * gz;
    out[v * 3 + 2] = N[v * 3] * gy - N[v * 3 + 1] * gx;
  }
  return out;
}

/** Unit direction vectors for one thread family: `cross` is the extra turn in degrees of this family (0 for A, the weave angle for B). */
export function flowVectors(value: Mesh, spec: FlowSpec, cross: number): Float64Array {
  if (spec.source !== "isolines" && spec.source !== "guide") throw new Error(`flow source must be "isolines" or "guide" (got ${String(spec.source)})`);
  for (const [name, v] of [["yaw", spec.yaw], ["pitch", spec.pitch], ["angle", spec.angle], ["swirl", spec.swirl], ["cross", cross]] as const)
    if (!Number.isFinite(v)) throw new Error(`flow ${name} must be finite`);
  checkScalar(spec.scalar, "flow scalar");
  checkScalar(spec.swirlScalar, "swirl scalar");
  const scalarKey = (s: ScalarSpec) => [s.kind, s.kind === "plane" ? s.angle : 0, s.kind === "waves" ? s.frequency : 0, s.kind === "waves" ? s.seed : 0];
  const primaryKey = JSON.stringify(spec.source === "guide" ? ["guide", spec.yaw, spec.pitch] : ["isolines", scalarKey(spec.scalar)]);
  return remember(`f|${value.key}|${primaryKey}|${spec.angle}|${spec.swirl}|${spec.swirl === 0 ? 0 : JSON.stringify(scalarKey(spec.swirlScalar))}|${cross}`, () => {
    const g = traceGraph(value), primary = remember(`p|${value.key}|${primaryKey}`, () => primaryDirections(value, spec));
    const h = spec.swirl === 0 ? null : scalarField(value, spec.swirlScalar), N = g.vertexNormals, V = value.vertexCount, out = new Float64Array(V * 3);
    for (let v = 0; v < V; v++) {
      const x = primary[v * 3], y = primary[v * 3 + 1], z = primary[v * 3 + 2];
      if (x === 0 && y === 0 && z === 0) continue;
      const turn = (spec.angle + cross + (h ? spec.swirl * (2 * h[v] - 1) : 0)) * Math.PI / 180, c = Math.cos(turn), s = Math.sin(turn);
      const qx = N[v * 3 + 1] * z - N[v * 3 + 2] * y, qy = N[v * 3 + 2] * x - N[v * 3] * z, qz = N[v * 3] * y - N[v * 3 + 1] * x;
      out[v * 3] = c * x + s * qx; out[v * 3 + 1] = c * y + s * qy; out[v * 3 + 2] = c * z + s * qz;
    }
    return out;
  });
}

/** Target thread spacing per vertex (world units); see the module header. */
export function spacingField(value: Mesh, base: number, density: DensitySpec): Float64Array {
  if (!Number.isFinite(base) || base <= 0) throw new Error("thread spacing must be a positive finite number");
  if (!Number.isFinite(density.ratio) || density.ratio < 1) throw new Error("density ratio must be at least 1");
  const out = new Float64Array(value.vertexCount);
  if (density.scalar === null || density.ratio === 1) { out.fill(base); return out; }
  const h = scalarField(value, density.scalar);
  for (let v = 0; v < out.length; v++) out[v] = base * Math.pow(density.ratio, 0.5 - (density.reverse ? 1 - h[v] : h[v]));
  return out;
}
