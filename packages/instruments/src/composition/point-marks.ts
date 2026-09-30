/**
 * Mark sites and stock consumers for viewed points (brief 54).
 *
 * `markSites(cloud, viewed, camera, style)` turns the viewed points of the camera stage into `PointSite`s (a `Site` with
 * the projected geometry a mark needs), in the order of `viewed` (far to near when the view was ordered so). Sizes are
 * CANVAS units at the target depth. What each mark reads:
 *
 * - `grain`, `ring`, `rosette`: the stock `motif` (dot, rings, rosette) at the projected point, `scale` = depth size factor
 *   x local scale x perspective scale, so a grain shrinks with distance in a perspective view and by `sizeByDepth` in any.
 * - `arrow`: the stock `motif` arrow along the projected 3D axis: the arrow is the projection of a world segment of length
 *   `size / zoom`, so foreshortening is real (an arrow pointing at the eye vanishes; below 0.25 canvas units it is omitted).
 * - `stroke`: the same projected world segment drawn as a line of `weight`.
 * - `disc`: a disc (8 to 24 sides by screen radius, see `discSides`) of world radius `size / (2 zoom)` lying in the tangent plane of the point's normal, every vertex
 *   projected with the camera: a disc seen edge-on is a thin sliver, one facing the eye a full polygon, and perspective
 *   foreshortens it exactly. Edge lines are the fill colour darkened.
 *
 * Depth size factor `f = 1 + sizeByDepth (1 - 2 depth01)` (nearest 1 + s, farthest 1 - s). Local scale factor
 * `clamp((spacing / median spacing) ^ localScale, 0.4, 2.5)` from the estimated `spacing` attribute: 0 keeps every mark the
 * same size, 1 makes marks in sparse places as large as the gaps they must cover. Opacity `opacity x (1 - fade depth01)`;
 * a point that would draw fully transparent or at size 0 is omitted.
 *
 * Axes for `arrow` and `stroke` (3D unit vector, then turned about the normal by `axisTurn` degrees plus a seeded jitter of
 * up to +-`axisJitter`): `principal` (the local direction of most spread), `contour` (normal x world up: horizontal, around
 * the form; normal x world X at the poles), `fall` (world down projected onto the tangent plane; principal where the surface
 * is horizontal), or the world `x`, `y` or `z`.
 *
 * Colour: `colorBy` picks a value in [0, 1] and an index into a palette ramp (`paletteRamp`: the palette interpolated in
 * Oklab, 12 steps between neighbours): `height`, `depth` (near = 1), `curvature` and `density` (tie-averaged ranks, so
 * the whole ramp is used), `facing` ((cos + 1) / 2), and per-point picks `part` (the subject's component, one palette entry
 * each, cycling), `mixed` (a seeded palette entry per point), `single` (entry 0). `bands` snaps a continuous value to
 * whole palette entries. Tones index the ramp; the consumers receive it as their palette.
 */
import { oklabRamp } from "@procedurals/javascript";
import type { Camera } from "./camera.js";
import { color, motif } from "./materials.js";
import { cloudStorage, mixHash, type PointCloud } from "./mesh-sample.js";
import type { ViewedPoint } from "./point-view.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, Path, PathMaterial, Site } from "./types.js";

export type MarkKind = "none" | "grain" | "ring" | "rosette" | "arrow" | "disc" | "stroke";
export type AxisKind = "principal" | "contour" | "fall" | "x" | "y" | "z";
export type ColorBy = "height" | "depth" | "curvature" | "density" | "facing" | "part" | "mixed" | "single";
export type Blend = "smooth" | "bands";

export const RAMP_STEPS = 12;
/** Sides of a disc of screen radius `radius` canvas units: 8 below 4 units, two more per 4 units, at most 24. */
export const discSides = (radius: number): number => 8 + 2 * Math.min(8, Math.floor(Math.max(0, radius) / 4));

export interface MarkStyle {
  readonly mark: MarkKind;
  readonly size: number;
  readonly weight: number;
  readonly petals: number;
  readonly opening: number;
  readonly axis: AxisKind;
  readonly axisTurn: number;
  readonly axisJitter: number;
  readonly localScale: number;
  readonly opacity: number;
  readonly sizeByDepth: number;
  readonly fade: number;
  readonly colorBy: ColorBy;
  readonly blend: Blend;
}

export interface PointSite extends Site {
  /** Index in the viewed cloud. */
  readonly index: number;
  /** The `p:<n>` number of the point. */
  readonly source: number;
  readonly depth: number;
  readonly depth01: number;
  readonly facing: number | null;
  /** Projected length of the world segment (arrow, stroke), else 0. */
  readonly length: number;
  /** Line weight after depth, local and perspective scaling, in canvas units. */
  readonly weight: number;
  /** Disc outline as x, y pairs relative to `position` (canvas units), else null. */
  readonly ring: readonly number[] | null;
}
export type PointMark = (surface: CompositionSurface, site: PointSite, run: CompositionRun) => void;

const rgb = (c: number): number[] => [((c >>> 16) & 255) / 255, ((c >>> 8) & 255) / 255, (c & 255) / 255];
const pack = (r: number, g: number, b: number): number => (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
const rampCache = new Map<string, number[]>();

/** The palette as an Oklab ramp of `(n - 1) * RAMP_STEPS + 1` packed colours; palette entry `i` sits at `i * RAMP_STEPS`. */
export function paletteRamp(palette: readonly number[]): readonly number[] {
  if (palette.length === 0) throw new Error("Point clouds need a palette of at least one colour");
  if (palette.length === 1) return [palette[0]];
  const key = palette.join(",");
  let hit = rampCache.get(key);
  if (!hit) {
    const count = (palette.length - 1) * RAMP_STEPS + 1;
    hit = oklabRamp({ stops: palette.map(rgb), count, maxWork: palette.length + count }).colors.map(([r, g, b]: number[]) => pack(r, g, b));
    if (rampCache.size >= 16) rampCache.delete(rampCache.keys().next().value!);
    rampCache.set(key, hit);
  }
  return hit;
}
/** Every colour of a ramp multiplied by `factor` (edge lines). */
export const darken = (ramp: readonly number[], factor: number): number[] => ramp.map((c) => pack(((c >>> 16) & 255) / 255 * factor, ((c >>> 8) & 255) / 255 * factor, (c & 255) / 255 * factor));

/** Ramp index of a value in [0, 1]. */
export function rampIndex(t: number, paletteLength: number, blend: Blend): number {
  const clamped = Math.min(1, Math.max(0, t));
  if (paletteLength === 1) return 0;
  return blend === "bands" ? Math.round(clamped * (paletteLength - 1)) * RAMP_STEPS : Math.round(clamped * (paletteLength - 1) * RAMP_STEPS);
}

const medians = new WeakMap<PointCloud, number>();
/** Median of the cloud's `spacing` attribute (1 for an empty cloud): the unit local scale and link lift are measured in. */
export function medianSpacing(cloud: PointCloud): number {
  let hit = medians.get(cloud);
  if (hit === undefined) { const a = Float64Array.from(attribute(cloud, "spacing")).sort(); hit = a.length ? a[a.length >> 1] : 1; medians.set(cloud, hit); }
  return hit;
}
const attribute = (cloud: PointCloud, name: string): Float64Array => {
  const found = cloudStorage(cloud).attributes.find((a) => a.name === name);
  if (!found) throw new Error(`The cloud has no attribute "${name}"; describe it first (describePointCloud)`);
  return found.values;
};

function axisVector(kind: AxisKind, n: readonly number[], principal: readonly number[]): [number, number, number] {
  const unit = (v: number[]): [number, number, number] | null => { const l = Math.hypot(v[0], v[1], v[2]); return l > 1e-6 ? [v[0] / l, v[1] / l, v[2] / l] : null; };
  if (kind === "x") return [1, 0, 0];
  if (kind === "y") return [0, 1, 0];
  if (kind === "z") return [0, 0, 1];
  if (kind === "contour") {
    const c = unit([-n[2], 0, n[0]]) ?? unit([0, n[2], -n[1]]);
    return c ?? [1, 0, 0];
  }
  if (kind === "fall") {
    const d = n[1], f = unit([n[0] * d, -1 + n[1] * d, n[2] * d]);
    if (f) return f;
  }
  return [principal[0], principal[1], principal[2]];
}

/** A function from a viewed point to its ramp index under `colorBy` (attributes fetched once). */
export function pointToner(cloud: PointCloud, colorBy: ColorBy, blend: Blend, paletteLength: number): (v: ViewedPoint) => number {
  const step = paletteLength > 1 ? RAMP_STEPS : 0;
  const values = colorBy === "height" ? attribute(cloud, "height") : colorBy === "curvature" ? attribute(cloud, "curvatureRank") : colorBy === "density" ? attribute(cloud, "densityRank") : colorBy === "part" ? attribute(cloud, "part") : null;
  return (v) => {
    switch (colorBy) {
      case "height": case "curvature": case "density": return rampIndex(values![v.index], paletteLength, blend);
      case "depth": return rampIndex(1 - v.depth01, paletteLength, blend);
      case "facing": return rampIndex(((v.facing ?? 0) + 1) / 2, paletteLength, blend);
      case "part": return (values![v.index] % paletteLength) * step;
      case "mixed": return Math.floor(mixHash(cloud.seed, Number(v.id.slice(2)), 0xc010) * paletteLength) * step;
      default: return 0;
    }
  };
}

/** The mark sites of a viewed cloud (see the module header). */
export function markSites(cloud: PointCloud, viewed: readonly ViewedPoint[], view: Camera, style: MarkStyle, paletteLength: number): readonly PointSite[] {
  if (style.mark === "none") return Object.freeze([]);
  const s = cloudStorage(cloud), spacing = attribute(cloud, "spacing"), principal = attribute(cloud, "principal");
  if (!s.normals) throw new Error(`Point cloud "${cloud.id}" has no normals; marks need them`);
  const unitSpacing = medianSpacing(cloud);
  const toneOf = pointToner(cloud, style.colorBy, style.blend, paletteLength);
  const zoom = view.options.zoom, oriented = style.mark === "arrow" || style.mark === "stroke", disc = style.mark === "disc";
  const out: PointSite[] = [];
  for (const v of viewed) {
    const i = v.index, source = Number(v.id.slice(2));
    const factor = (1 + style.sizeByDepth * (1 - 2 * v.depth01)) * Math.min(2.5, Math.max(0.4, Math.pow(spacing[i] / unitSpacing, style.localScale)));
    const opacity = style.opacity * Math.max(0, 1 - style.fade * v.depth01);
    if (!(factor * style.size > 0) || opacity < 0.004) continue;
    const tone = toneOf(v);
    const weight = style.weight * factor * v.perspective;
    const base = { id: v.id, seed: v.seed, tone, opacity, index: i, source, depth: v.depth, depth01: v.depth01, facing: v.facing, weight, position: v.position };
    if (oriented || disc) {
      const p = [s.positions[i * 3], s.positions[i * 3 + 1], s.positions[i * 3 + 2]], n = [s.normals[i * 3], s.normals[i * 3 + 1], s.normals[i * 3 + 2]];
      const pr = [principal[i * 3], principal[i * 3 + 1], principal[i * 3 + 2]];
      const world = style.size * factor / zoom;
      if (oriented) {
        let d = axisVector(style.axis, n, pr);
        const turn = (style.axisTurn + style.axisJitter * (2 * mixHash(cloud.seed, source, 0xa71) - 1)) * Math.PI / 180;
        if (turn !== 0) {
          const c = Math.cos(turn), sn = Math.sin(turn), dot = n[0] * d[0] + n[1] * d[1] + n[2] * d[2];
          const cross = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]];
          d = [0, 1, 2].map((k) => d[k] * c + cross[k] * sn + n[k] * dot * (1 - c)) as [number, number, number];
        }
        const a = view.project([p[0] - d[0] * world / 2, p[1] - d[1] * world / 2, p[2] - d[2] * world / 2]);
        const b = view.project([p[0] + d[0] * world / 2, p[1] + d[1] * world / 2, p[2] + d[2] * world / 2]);
        if (!a || !b) continue;
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        if (style.mark === "arrow" && length < 0.25) continue;
        out.push(Object.freeze({ ...base, position: Object.freeze([(a.x + b.x) / 2, (a.y + b.y) / 2] as const), angle: Math.atan2(b.y - a.y, b.x - a.x),
          scale: style.mark === "arrow" ? length / style.size : 1, length, ring: null }));
      } else {
        // Tangent basis: u along the principal direction projected onto the tangent plane, v = n x u.
        let ux = pr[0] - n[0] * (pr[0] * n[0] + pr[1] * n[1] + pr[2] * n[2]), uy = pr[1] - n[1] * (pr[0] * n[0] + pr[1] * n[1] + pr[2] * n[2]), uz = pr[2] - n[2] * (pr[0] * n[0] + pr[1] * n[1] + pr[2] * n[2]);
        let ul = Math.hypot(ux, uy, uz);
        if (ul < 1e-6) { const k = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], dk = k[0] * n[0] + k[1] * n[1] + k[2] * n[2]; ux = k[0] - n[0] * dk; uy = k[1] - n[1] * dk; uz = k[2] - n[2] * dk; ul = Math.hypot(ux, uy, uz); }
        ux /= ul; uy /= ul; uz /= ul;
        const vx = n[1] * uz - n[2] * uy, vy = n[2] * ux - n[0] * uz, vz = n[0] * uy - n[1] * ux, r = world / 2;
        const ring: number[] = [], sides = discSides(style.size * factor * v.perspective / 2);
        let ok = true;
        for (let q = 0; q < sides && ok; q++) {
          const th = 2 * Math.PI * q / sides, c = Math.cos(th) * r, sn = Math.sin(th) * r;
          const pt = view.project([p[0] + c * ux + sn * vx, p[1] + c * uy + sn * vy, p[2] + c * uz + sn * vz]);
          if (!pt) ok = false; else ring.push(pt.x - v.position[0], pt.y - v.position[1]);
        }
        if (!ok) continue;
        out.push(Object.freeze({ ...base, angle: 0, scale: 1, length: 0, ring: Object.freeze(ring) }));
      }
    } else {
      out.push(Object.freeze({ ...base, angle: 0, scale: factor * v.perspective, length: 0, ring: null }));
    }
  }
  return Object.freeze(out);
}

const MOTIF_KIND: Record<string, MotifSpec["kind"]> = { grain: "dot", ring: "rings", rosette: "rosette", arrow: "arrow" };

/** The stock consumer of `style.mark`; `ramp` is the palette ramp its tones index. */
export function stockMark(style: MarkStyle, ramp: readonly number[]): PointMark {
  if (style.mark === "none") return () => {};
  if (style.mark === "disc") {
    const edge = darken(ramp, 0.55);
    return (surface, site) => {
      const ring = site.ring;
      if (!ring) return;
      const tone = Math.floor(site.tone ?? 0), opacity = site.opacity ?? 1;
      color(surface, ramp, tone, 235 * opacity, true);
      if (site.weight > 0) { surface.strokeWeight(site.weight); color(surface, edge, tone, 255 * Math.min(1, opacity * 1.15), false); } else surface.noStroke();
      surface.beginShape();
      for (let q = 0; q < ring.length; q += 2) surface.vertex(ring[q], ring[q + 1]);
      surface.endShape(surface.CLOSE);
    };
  }
  if (style.mark === "stroke") {
    return (surface, site) => {
      const tone = Math.floor(site.tone ?? 0), opacity = site.opacity ?? 1;
      if (site.weight <= 0 || site.length <= 0) return;
      surface.noFill(); color(surface, ramp, tone, 235 * opacity, false);
      surface.strokeWeight(site.weight); surface.strokeCap(surface.ROUND);
      surface.line(-site.length / 2, 0, site.length / 2, 0);
    };
  }
  const spec: MotifSpec = { kind: MOTIF_KIND[style.mark], size: style.size, petals: style.petals, opening: style.opening, weight: style.weight, rotation: 0, variation: 0, retention: 1 };
  const draw: Mark = motif(spec, ramp);
  return (surface, site, run) => draw(surface, site, run);
}

/** A link path as the depth-aware stock material draws it: the palette tone of `path.tone` at `weight` scaled by its perspective. */
export interface LinkStyle { readonly weight: number; readonly opacity: number; readonly fade: number; readonly sizeByDepth: number }
export function linkMaterial(style: LinkStyle, ramp: readonly number[]): PathMaterial {
  return (surface, path: Path & { depth01?: number; perspective?: number }, _run) => {
    if (path.points.length < 2) return;
    const d = path.depth01 ?? 0, persp = path.perspective ?? 1;
    const opacity = style.opacity * Math.max(0, 1 - style.fade * d);
    const weight = style.weight * Math.max(0, 1 + style.sizeByDepth * (1 - 2 * d)) * persp;
    if (opacity < 0.004 || weight <= 0) return;
    surface.noFill(); color(surface, ramp, Math.floor(path.tone ?? 0), 210 * opacity, false);
    surface.strokeWeight(weight); surface.strokeCap(surface.ROUND);
    surface.line(path.points[0][0], path.points[0][1], path.points[1][0], path.points[1][1]);
  };
}
