/**
 * Bundled point-cloud subjects (brief 54): the clouds the Point Clouds instrument reinterprets.
 *
 * `pointSubject(spec)` returns a frozen, construction-cached `PointSubject`: a `PointCloud` with unit normals and a `part`
 * attribute, the source mesh when there is one (the four mesh subjects), and the bounding sphere the camera fits.
 *
 * | kind | construction | normals | `part` |
 * |---|---|---|---|
 * | `figure`, `vase`, `terrain`, `torus` | `sampleSurface` of the bundled mesh (F8): area-weighted, prefix stable in `count` | smooth (angle-weighted vertex normals) | connected component of the source face (the figure has seven; the others 0) |
 * | `galaxy` | bulge (Plummer sphere) plus an exponentially falling disk with `arms` logarithmic-style spiral arms | radial in the bulge, the (slightly warped) disk normal elsewhere | 0 bulge, `arm + 1` |
 * | `noise-volume` | best-of-24 rejection sampling inside the unit ball against octave gradient noise | outward: minus the normalised noise gradient (radial where the gradient vanishes) | 0 |
 *
 * Every point `k` of every subject is a function of `(spec fields the kind uses, seed, k)` only, never of `count`, so the
 * first `n` points of a longer subject are the `count = n` subject (tested). Fields the kind does not use never enter the
 * cache key or the result. The meshes are the bundled ones (`bundledMesh`), at a fixed detail chosen so a point's normal
 * is smooth: vase 5 (40 slices), torus 5 (60 x 30), terrain 8 (64 x 64 cells), the figure fixed. `count` is 1 to
 * `POINT_LIMITS.maxPoints`; the instrument caps it lower (see `POINT_CLOUD_LIMITS`). Failures name the control to change.
 *
 * Host binding of a user's own mesh or scan is future work; a typed `PointCloud` reaches the later stages directly
 * (`describePointCloud`, `pointSelection`, ...) without a `PointSubject`. No scan reconstruction is offered.
 */
import { gradientNoise3D01 } from "@procedurals/javascript";
import { bundledMesh } from "./mesh-samples.js";
import type { TerrainVariant, VaseProfile } from "./mesh-samples.js";
import type { Mesh, Vec3 } from "./mesh.js";
import { cloudStorage, derivePointCloud, mixHash, POINT_LIMITS, pointCloud, sampleSource, sampleSurface, type PointCloud } from "./mesh-sample.js";
import { meshComponentOfFace, meshTopology } from "./mesh-topology.js";
import { memoized } from "./sources.js";

export const MESH_SUBJECTS = ["figure", "vase", "terrain", "torus"] as const;
export const SUBJECT_KINDS = [...MESH_SUBJECTS, "galaxy", "noise-volume"] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];
export const isMeshSubject = (kind: SubjectKind): boolean => (MESH_SUBJECTS as readonly string[]).includes(kind);

export interface GalaxySpec {
  /** Spiral arms, 1..8. */
  readonly arms: number;
  /** Turns an arm makes from the centre to the rim, 0..3. */
  readonly twist: number;
  /** Share of points in the central bulge, 0..0.9. */
  readonly bulge: number;
  /** Disk thickness as a fraction of its radius, 0..1. */
  readonly thickness: number;
  /** Angular scatter of points about an arm, 0..2 (1 is about half an arm spacing at four arms). */
  readonly looseness: number;
}
export interface NoiseSpec {
  /** Noise frequency across the unit ball, 0.25..8. */
  readonly scale: number;
  /** 0 fills the ball evenly, 1 keeps only the densest noise ridges. */
  readonly contrast: number;
  /** Octaves, 1..4. */
  readonly octaves: number;
}
export interface SubjectSpec {
  readonly kind: SubjectKind;
  readonly seed: number;
  readonly count: number;
  readonly distribution: "even" | "random";
  readonly vase: VaseProfile;
  readonly terrain: TerrainVariant;
  readonly galaxy: GalaxySpec;
  readonly noise: NoiseSpec;
}

export interface PointSubject {
  readonly id: string;
  readonly kind: SubjectKind;
  readonly cloud: PointCloud;
  /** The source surface of a mesh subject, else null. */
  readonly mesh: Mesh | null;
  /** Centre of the cloud's bounds. */
  readonly center: Vec3;
  /** Largest distance from `center` to a point: the sphere the camera fits. */
  readonly radius: number;
}

/** Fixed mesh detail per subject (see the module header). */
const DETAIL: Record<string, number> = { vase: 5, torus: 5, terrain: 8, figure: 1 };
export const GALAXY_RADIUS = 1.6;
const cache = new Map<string, PointSubject>();

function integerIn(label: string, value: number, low: number, high: number): void {
  if (!Number.isInteger(value) || value < low || value > high) throw new Error(`${label} must be an integer in ${low}..${high} (got ${String(value)})`);
}
function numberIn(label: string, value: number, low: number, high: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high) throw new Error(`${label} must be a number in ${low}..${high} (got ${String(value)})`);
}

/** The construction key: only the fields the kind reads. */
function key(spec: SubjectSpec): string {
  const shared = [spec.kind, spec.seed, spec.count];
  switch (spec.kind) {
    case "vase": return JSON.stringify([...shared, spec.distribution, spec.vase]);
    case "terrain": return JSON.stringify([...shared, spec.distribution, spec.terrain]);
    case "figure": case "torus": return JSON.stringify([...shared, spec.distribution]);
    case "galaxy": return JSON.stringify([...shared, spec.galaxy.arms, spec.galaxy.twist, spec.galaxy.bulge, spec.galaxy.thickness, spec.galaxy.looseness]);
    case "noise-volume": return JSON.stringify([...shared, spec.noise.scale, spec.noise.contrast, spec.noise.octaves]);
  }
}

/** Build (or fetch) a subject. */
export function pointSubject(spec: SubjectSpec): PointSubject {
  if (!SUBJECT_KINDS.includes(spec.kind)) throw new Error(`Subject must be one of ${SUBJECT_KINDS.join(", ")} (got ${String(spec.kind)})`);
  if (!Number.isSafeInteger(spec.seed) || spec.seed < 0 || spec.seed > 0xffffffff) throw new Error("Subject seed must be a uint32 integer");
  if (!Number.isInteger(spec.count) || spec.count < 1 || spec.count > POINT_LIMITS.maxPoints) throw new Error(`Points must be an integer in 1..${POINT_LIMITS.maxPoints} (got ${String(spec.count)}); change Points`);
  if (spec.kind === "galaxy") {
    const g = spec.galaxy;
    integerIn("Arms", g.arms, 1, 8); numberIn("Twist", g.twist, 0, 3); numberIn("Bulge", g.bulge, 0, 0.9); numberIn("Thickness", g.thickness, 0, 1); numberIn("Looseness", g.looseness, 0, 2);
  } else if (spec.kind === "noise-volume") {
    const v = spec.noise;
    numberIn("Noise scale", v.scale, 0.25, 8); numberIn("Contrast", v.contrast, 0, 1); integerIn("Octaves", v.octaves, 1, 4);
  }
  return memoized(cache, key(spec), () => build(spec));
}

function finish(kind: SubjectKind, id: string, cloud: PointCloud, mesh: Mesh | null): PointSubject {
  const p = cloudStorage(cloud).positions, b = cloud.bounds!;
  const center: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  let radius = 0;
  for (let i = 0; i < cloud.count; i++) radius = Math.max(radius, Math.hypot(p[i * 3] - center[0], p[i * 3 + 1] - center[1], p[i * 3 + 2] - center[2]));
  return Object.freeze({ id, kind, cloud, mesh, center: Object.freeze(center) as Vec3, radius: radius > 0 ? radius : 1 });
}

function build(spec: SubjectSpec): PointSubject {
  if (spec.kind === "galaxy") return galaxy(spec);
  if (spec.kind === "noise-volume") return noiseVolume(spec);
  const variant = spec.kind === "vase" ? spec.vase : spec.kind === "terrain" ? spec.terrain : undefined;
  const mesh = bundledMesh(spec.kind, { detail: DETAIL[spec.kind], seed: spec.seed, variant });
  const samples = sampleSurface(mesh, { seed: spec.seed, count: spec.count, distribution: spec.distribution, normals: "smooth" });
  const topology = meshTopology(mesh), part = new Float64Array(spec.count);
  for (let i = 0; i < spec.count; i++) part[i] = meshComponentOfFace(topology, sampleSource(samples, i).face);
  const cloud = derivePointCloud(samples, { id: `subject:${spec.kind}${variant ? `:${variant}` : ""}`, attributes: [{ name: "part", size: 1, values: part }] });
  return finish(spec.kind, cloud.id, cloud, mesh);
}

const TAU = 2 * Math.PI;
/** Standard normal from two uniforms (Box-Muller); u1 is kept off zero. */
const gauss = (u1: number, u2: number): number => Math.sqrt(-2 * Math.log(Math.max(u1, 1e-12))) * Math.cos(TAU * u2);

function galaxy(spec: SubjectSpec): PointSubject {
  const g = spec.galaxy, n = spec.count, seed = spec.seed, R = GALAXY_RADIUS, scale = 0.42, cut = 1 - Math.exp(-R / scale);
  const positions = new Float64Array(n * 3), normals = new Float64Array(n * 3), part = new Float64Array(n);
  const warp = (x: number, z: number): number => 0.1 * g.thickness * Math.hypot(x, z) * z / (R * R) * 4;
  for (let k = 0; k < n; k++) {
    const h = (stream: number): number => mixHash(seed, k, 0x6a00 + stream);
    let x: number, y: number, z: number, nx: number, ny: number, nz: number;
    if (h(0) < g.bulge) {
      const a = 0.22, u = Math.max(h(1), 1e-9), r = Math.min(0.75, a / Math.sqrt(Math.pow(u, -2 / 3) - 1));
      const cosT = 2 * h(2) - 1, sinT = Math.sqrt(1 - cosT * cosT), phi = TAU * h(3);
      x = r * sinT * Math.cos(phi); y = r * cosT * 0.8; z = r * sinT * Math.sin(phi);
      const l = Math.hypot(x, y / 0.8, z) || 1;
      nx = x / l; ny = y / 0.8 / l; nz = z / l;
      const m = Math.hypot(nx, ny, nz); nx /= m; ny /= m; nz /= m;
      part[k] = 0;
    } else {
      const r = -scale * Math.log(1 - h(4) * cut);
      const arm = Math.min(g.arms - 1, Math.floor(h(5) * g.arms));
      const loose = h(6) < 0.12 ? TAU * h(7) : gauss(h(7), h(8)) * g.looseness * 0.28;
      const theta = TAU * arm / g.arms + TAU * g.twist * (r / R) + loose;
      x = r * Math.cos(theta); z = r * Math.sin(theta);
      y = g.thickness * 0.18 * gauss(h(9), h(10)) * (0.25 + 0.75 * Math.exp(-r / 0.8)) + warp(x, z);
      const e = 1e-3, dx = (warp(x + e, z) - warp(x - e, z)) / (2 * e), dz = (warp(x, z + e) - warp(x, z - e)) / (2 * e);
      const m = Math.hypot(dx, 1, dz); nx = -dx / m; ny = 1 / m; nz = -dz / m;
      part[k] = arm + 1;
    }
    positions[k * 3] = x; positions[k * 3 + 1] = y; positions[k * 3 + 2] = z;
    normals[k * 3] = nx; normals[k * 3 + 1] = ny; normals[k * 3 + 2] = nz;
  }
  const cloud = pointCloud({ id: "subject:galaxy", positions, normals, seed, attributes: [{ name: "part", size: 1, values: part }] });
  return finish("galaxy", cloud.id, cloud, null);
}

const smoothstep = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function noiseVolume(spec: SubjectSpec): PointSubject {
  const v = spec.noise, n = spec.count, seed = spec.seed, field = gradientNoise3D01({ seed });
  const density = (x: number, y: number, z: number): number => {
    let sum = 0, total = 0, amplitude = 1, frequency = v.scale;
    for (let o = 0; o < v.octaves; o++) { sum += amplitude * field.sample(x * frequency + 17.3 * o, y * frequency - 5.1 * o, z * frequency + 9.7 * o); total += amplitude; amplitude *= 0.5; frequency *= 2; }
    return sum / total;
  };
  const low = v.contrast * 0.62, ATTEMPTS = 24;
  const positions = new Float64Array(n * 3), normals = new Float64Array(n * 3);
  for (let k = 0; k < n; k++) {
    let best = -1, bx = 0, by = 0, bz = 0;
    for (let a = 0; a < ATTEMPTS; a++) {
      const cosT = 2 * mixHash(seed, k, 0x7000 + a * 4) - 1, sinT = Math.sqrt(1 - cosT * cosT), phi = TAU * mixHash(seed, k, 0x7001 + a * 4), r = Math.cbrt(mixHash(seed, k, 0x7002 + a * 4));
      const x = r * sinT * Math.cos(phi), y = r * cosT, z = r * sinT * Math.sin(phi), d = density(x, y, z);
      if (d > best) { best = d; bx = x; by = y; bz = z; }
      if (mixHash(seed, k, 0x7003 + a * 4) < smoothstep(low, low + 0.25, d)) { bx = x; by = y; bz = z; break; }
    }
    positions[k * 3] = bx; positions[k * 3 + 1] = by; positions[k * 3 + 2] = bz;
    const e = 0.02 / v.scale, gx = density(bx - e, by, bz) - density(bx + e, by, bz), gy = density(bx, by - e, bz) - density(bx, by + e, bz), gz = density(bx, by, bz - e) - density(bx, by, bz + e);
    let m = Math.hypot(gx, gy, gz), nx = gx, ny = gy, nz = gz;
    if (!(m > 1e-9)) { nx = bx; ny = by; nz = bz; m = Math.hypot(nx, ny, nz); if (!(m > 1e-9)) { nx = 0; ny = 1; nz = 0; m = 1; } }
    normals[k * 3] = nx / m; normals[k * 3 + 1] = ny / m; normals[k * 3 + 2] = nz / m;
  }
  const cloud = pointCloud({ id: "subject:noise-volume", positions, normals, seed, attributes: [{ name: "part", size: 1, values: new Float64Array(n) }] });
  return finish("noise-volume", cloud.id, cloud, null);
}
