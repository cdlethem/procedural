import { componentSeed } from "./core.js";
import type { MapName, Path, Point, Site, WarpedSite, WarpOptions } from "./types.js";

/**
 * Documented coordinate maps on normalized coordinates (u, v) = ((x − cx) / r, (y − cy) / r).
 * `k` is the stage's frequency coefficient. Singular maps return non-finite values at their pole;
 * the caller's bound turns that into an explicit exclusion, never an unexplained interpolation.
 */
const maps: Record<MapName, (u: number, v: number, k: number) => readonly [number, number]> = {
  /** (sin ku, sin kv): folds the plane once |ku| passes π/2. */
  sinusoidal: (u, v, k) => [Math.sin(k * u), Math.sin(k * v)],
  /** Rotates by k·r²: a spiral twist that is strongest away from the center. */
  swirl: (u, v, k) => {
    const r2 = u * u + v * v, s = Math.sin(k * r2), c = Math.cos(k * r2);
    return [u * s - v * c, u * c + v * s];
  },
  /** Radial compression 2 / (1 + k·r). */
  fisheye: (u, v, k) => {
    const f = 2 / (1 + k * Math.hypot(u, v));
    return [f * u, f * v];
  },
  /** Circle inversion u / (k·r²); the origin is the pole. */
  spherical: (u, v, k) => {
    const d = k * (u * u + v * v);
    return [u / d, v / d];
  },
  /** (k·θ / π, r − 1): rectangular to polar; the branch cut is a real discontinuity. */
  polar: (u, v, k) => [k * Math.atan2(u, v) / Math.PI, Math.hypot(u, v) - 1],
  /** r·(sin(θ + kr), cos(θ − kr)): a folded, petal-like drape. */
  handkerchief: (u, v, k) => {
    const r = Math.hypot(u, v), t = Math.atan2(u, v);
    return [r * Math.sin(t + k * r), r * Math.cos(t - k * r)];
  },
  /** (u + 0.3 sin kv, v + 0.3 sin ku): a bounded ripple, never folds for small k. */
  waves: (u, v, k) => [u + .3 * Math.sin(k * v), v + .3 * Math.sin(k * u)],
  /** ((u − v)(u + v), 2uv) / r, scaled by k: reflects and stretches about the origin. */
  horseshoe: (u, v, k) => {
    const r = Math.hypot(u, v);
    return [k * (u - v) * (u + v) / r, k * 2 * u * v / r];
  },
};
export const mapNames: readonly MapName[] = Object.freeze(Object.keys(maps) as MapName[]);

const WARP_POINT_LIMIT = 200_000;

function finite(label: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}
function validate(options: WarpOptions): void {
  finite("Warp radius", options.radius, 1, 4096);
  finite("Warp bound", options.bound, 1, 50);
  if (!Number.isInteger(options.iterations) || options.iterations < 1 || options.iterations > 4)
    throw new Error("Warp iterations must be an integer in [1, 4]");
  if (options.stages.length < 1 || options.stages.length > 4) throw new Error("Warp needs one to four stages");
  for (const stage of options.stages) {
    if (!Object.hasOwn(maps, stage.map)) throw new Error(`Unknown coordinate map: ${String(stage.map)}`);
    finite("Warp amount", stage.amount, 0, 2);
    finite("Warp frequency", stage.frequency, .05, 12);
  }
}

/** Map one canvas point through the stage chain; null when it is singular or leaves the bound. */
export function warpPoint(options: WarpOptions, x: number, y: number): Point | null {
  validate(options);
  return mapPoint(options, x, y);
}
/** Validate `options` once and return the chain as a point function, for callers that map many points (raster consumers). */
export function warpMapper(options: WarpOptions): (x: number, y: number) => Point | null {
  validate(options);
  return (x, y) => mapPoint(options, x, y);
}
/** Unvalidated core for callers that have already validated `options` once. */
function mapPoint(options: WarpOptions, x: number, y: number): Point | null {
  let u = (x - options.centerX) / options.radius, v = (y - options.centerY) / options.radius;
  for (let pass = 0; pass < options.iterations; pass++) {
    for (const stage of options.stages) {
      const [fu, fv] = maps[stage.map](u, v, stage.frequency);
      const nu = u + stage.amount * (fu - u), nv = v + stage.amount * (fv - v);
      if (!Number.isFinite(nu) || !Number.isFinite(nv) || Math.hypot(nu, nv) > options.bound) return null;
      u = nu; v = nv;
    }
  }
  return [options.centerX + options.radius * u, options.centerY + options.radius * v];
}

/**
 * Carry each site through the map with its local frame: position is mapped, the frame axis follows
 * the map's local linear part, size follows √|det|, and a negative determinant (a fold) mirrors the
 * mark and sets `flipped`. `tone` is never changed: the caller decides what a fold looks like.
 * Sites the map sends to a singularity or out of bounds are dropped.
 */
export function warpSites(sites: readonly Site[], options: WarpOptions): readonly WarpedSite[] {
  validate(options);
  const h = options.radius * 1e-3, out: WarpedSite[] = [];
  for (const site of sites) {
    const [x, y] = site.position;
    const p = mapPoint(options, x, y), px = mapPoint(options, x + h, y), py = mapPoint(options, x, y + h);
    if (!p || !px || !py) continue;
    const exx = (px[0] - p[0]) / h, exy = (px[1] - p[1]) / h, eyx = (py[0] - p[0]) / h, eyy = (py[1] - p[1]) / h;
    const det = exx * eyy - eyx * exy;
    const cos = Math.cos(site.angle), sin = Math.sin(site.angle);
    const magnitude = Math.min(3, Math.max(.2, Math.sqrt(Math.abs(det)))) * Math.abs(site.scale);
    const flipped = det < 0;
    const mirrored = (site.scale < 0) !== flipped;
    const tone = site.tone;
    out.push(Object.freeze({ id: site.id, seed: site.seed, position: Object.freeze([p[0], p[1]] as const),
      angle: Math.atan2(exy * cos + eyy * sin, exx * cos + eyx * sin), scale: mirrored ? -magnitude : magnitude,
      flipped, ...(tone === undefined ? {} : { tone }) }));
  }
  return Object.freeze(out);
}

/**
 * Subdivide every path to at most `segment` canvas units, map the vertices, and split the result
 * wherever a vertex is excluded or two neighbours land farther apart than 0.6 × radius (a fold seam
 * or branch cut). Parts are named `<id>#<n>`; nothing is interpolated across a break.
 */
export function warpPaths(paths: readonly Path[], options: WarpOptions, segment = 6): readonly Path[] {
  validate(options);
  finite("Warp segment", segment, 1, 100);
  const jump = .6 * options.radius, out: Path[] = [];
  let budget = 0;
  for (const path of paths) {
    let run: Point[] = [], part = 0;
    const flush = () => {
      if (run.length >= 2) out.push(Object.freeze({ id: `${path.id}#${part++}`, seed: componentSeed(path.seed, path.id, "warp"),
        points: Object.freeze(run.map((point) => Object.freeze(point))), closed: false, level: path.level,
        levelFraction: path.levelFraction, ...(path.tone === undefined ? {} : { tone: path.tone }) }));
      run = [];
    };
    const emit = (x: number, y: number) => {
      if (++budget > WARP_POINT_LIMIT) throw new Error("Warp exceeds 200000 mapped points; enlarge the segment or use fewer lines");
      const q = mapPoint(options, x, y);
      if (!q) { flush(); return; }
      const last = run[run.length - 1];
      if (last && Math.hypot(q[0] - last[0], q[1] - last[1]) > jump) flush();
      run.push(q);
    };
    const points = path.closed ? [...path.points, path.points[0]] : path.points;
    emit(points[0][0], points[0][1]);
    for (let index = 1; index < points.length; index++) {
      const [ax, ay] = points[index - 1], [bx, by] = points[index];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / segment));
      for (let step = 1; step <= steps; step++) emit(ax + (bx - ax) * step / steps, ay + (by - ay) * step / steps);
    }
    flush();
  }
  return Object.freeze(out);
}
