/**
 * Preserved regions as a per-vertex importance field (brief 55, "mask / importance field").
 *
 * A `MeshRegion` names a place on a mesh; `regionImportance` turns it into one number per vertex in [0, 1]:
 * 1 inside the region (the vertex is protected), falling linearly to 0 over `falloff` world units outside it,
 * 0 far away. `invert` swaps the roles (0 inside, rising toward 1 outside: "abstract only here").
 *
 * Inputs and units. Everything is measured against the MESH'S OWN BOUNDS, so the same recipe fits any source:
 * - `sphere`: `center` is a point in the bounds box as fractions (0 = min, 1 = max) per axis; `radius` is a
 *   fraction of the bounds diagonal. The distance is Euclidean, in world units.
 * - `box`: `center` as above; `size` is the HALF extent as a fraction of the bounds extent per axis (so 0.5 spans
 *   the whole bounds). The distance is the Euclidean distance to the box, 0 inside.
 * - `band`: everything between fractions `from` and `to` of the bounds along `axis`; the distance is the axial
 *   distance to the band. `from > to` is an error (a band is never silently swapped).
 * - `seeded`: `count` spheres of `radius` (fraction of the diagonal) centred on seeded, area-weighted points of the
 *   surface (`sampleSurface`, so raising `count` only ADDS spheres and never moves earlier ones; sample k depends on
 *   the mesh, `seed` and k only).
 * - `none`: importance 0 everywhere (with or without `invert`).
 * `falloff` is a fraction of the bounds diagonal; 0 gives a hard 0/1 mask (a vertex exactly on the boundary is inside).
 *
 * Failure. A non-finite or out-of-range number throws naming the field. Nothing is clamped silently.
 * Ownership. The field is a fresh `Float64Array`; the region value is plain JSON-like data (it can be stored).
 */
import { componentSeed } from "./core.js";
import type { Mesh } from "./mesh.js";
import { meshMeasures, meshStorage } from "./mesh.js";
import { pointPosition, sampleSurface } from "./mesh-sample.js";

export type Axis = "x" | "y" | "z";
export type MeshRegion =
  | { readonly kind: "none" }
  | { readonly kind: "sphere"; readonly center: readonly [number, number, number]; readonly radius: number; readonly falloff: number; readonly invert?: boolean }
  | { readonly kind: "box"; readonly center: readonly [number, number, number]; readonly size: number; readonly falloff: number; readonly invert?: boolean }
  | { readonly kind: "band"; readonly axis: Axis; readonly from: number; readonly to: number; readonly falloff: number; readonly invert?: boolean }
  | { readonly kind: "seeded"; readonly count: number; readonly radius: number; readonly falloff: number; readonly invert?: boolean };

export const MAX_SEEDED_REGIONS = 64;

function fraction(label: string, value: unknown, low: number, high: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high) throw new Error(`Region ${label} must be a number in ${low}..${high} (got ${String(value)})`);
  return value;
}

/** Validate a region and return it unchanged; throws naming the field. */
export function checkRegion(region: MeshRegion): MeshRegion {
  if (region === null || typeof region !== "object") throw new Error("Region must be an object with a kind");
  switch (region.kind) {
    case "none": return region;
    case "sphere":
      region.center.forEach((v, i) => fraction(`center ${"xyz"[i]}`, v, -2, 3));
      if (region.center.length !== 3) throw new Error("Region center must have three numbers");
      fraction("radius", region.radius, 0, 4); fraction("falloff", region.falloff, 0, 4); return region;
    case "box":
      region.center.forEach((v, i) => fraction(`center ${"xyz"[i]}`, v, -2, 3));
      if (region.center.length !== 3) throw new Error("Region center must have three numbers");
      fraction("size", region.size, 0, 4); fraction("falloff", region.falloff, 0, 4); return region;
    case "band":
      if (region.axis !== "x" && region.axis !== "y" && region.axis !== "z") throw new Error(`Region axis must be x, y or z (got ${String(region.axis)})`);
      fraction("from", region.from, -2, 3); fraction("to", region.to, -2, 3); fraction("falloff", region.falloff, 0, 4);
      if (region.from > region.to) throw new Error(`Region band runs from ${region.from} to ${region.to}; from must not exceed to`);
      return region;
    case "seeded":
      if (!Number.isInteger(region.count) || region.count < 0 || region.count > MAX_SEEDED_REGIONS) throw new Error(`Region count must be an integer in 0..${MAX_SEEDED_REGIONS} (got ${String(region.count)})`);
      fraction("radius", region.radius, 0, 4); fraction("falloff", region.falloff, 0, 4); return region;
    default: throw new Error(`Unknown region kind ${String((region as { kind: unknown }).kind)}`);
  }
}

/**
 * Importance of every vertex of `mesh` for `region`, in [0, 1] (see the module header). `seed` (uint32) only matters
 * for `seeded`. Unused vertices get the value their position would.
 */
export function regionImportance(mesh: Mesh, region: MeshRegion, seed: number): Float64Array {
  checkRegion(region);
  const V = mesh.vertexCount, out = new Float64Array(V);
  if (region.kind === "none") return out;
  const p = meshStorage(mesh).positions, { min, max } = mesh.bounds, diagonal = meshMeasures(mesh).diagonal;
  const at = (fractions: readonly number[], axis: number): number => min[axis] + fractions[axis] * (max[axis] - min[axis]);
  const falloff = region.falloff * diagonal;
  let distance: (i: number) => number;
  if (region.kind === "sphere") {
    const c = [at(region.center, 0), at(region.center, 1), at(region.center, 2)], r = region.radius * diagonal;
    distance = (i) => Math.max(0, Math.hypot(p[i * 3] - c[0], p[i * 3 + 1] - c[1], p[i * 3 + 2] - c[2]) - r);
  } else if (region.kind === "box") {
    const c = [at(region.center, 0), at(region.center, 1), at(region.center, 2)], h = [0, 1, 2].map((a) => region.size * (max[a] - min[a]));
    distance = (i) => Math.hypot(Math.max(0, Math.abs(p[i * 3] - c[0]) - h[0]), Math.max(0, Math.abs(p[i * 3 + 1] - c[1]) - h[1]), Math.max(0, Math.abs(p[i * 3 + 2] - c[2]) - h[2]));
  } else if (region.kind === "band") {
    const a = region.axis === "x" ? 0 : region.axis === "y" ? 1 : 2, lo = min[a] + region.from * (max[a] - min[a]), hi = min[a] + region.to * (max[a] - min[a]);
    distance = (i) => Math.max(0, lo - p[i * 3 + a], p[i * 3 + a] - hi);
  } else {
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Region seed must be a uint32 integer");
    const cloud = sampleSurface(mesh, { seed: componentSeed(seed, "mesh-region", "seeded-centres"), count: region.count, distribution: "even" });
    const centres = Array.from({ length: cloud.count }, (_, k) => pointPosition(cloud, k)), r = region.radius * diagonal;
    distance = (i) => {
      let best = Infinity;
      for (const c of centres) best = Math.min(best, Math.max(0, Math.hypot(p[i * 3] - c[0], p[i * 3 + 1] - c[1], p[i * 3 + 2] - c[2]) - r));
      return best;
    };
  }
  for (let i = 0; i < V; i++) {
    const d = distance(i);
    const inside = d <= 0 ? 1 : falloff > 0 ? Math.max(0, 1 - d / falloff) : 0;
    out[i] = region.invert ? 1 - inside : inside;
  }
  return out;
}
