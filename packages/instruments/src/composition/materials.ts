import { hatchRegionLines2D, resamplePolyline2D } from "@procedurals/javascript";
import { atEach, componentSeed, strokeWith } from "./core.js";
import { contourPaths, poissonSites } from "./sources.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, Path, PathMaterial, PathMaterialSpec,
  Point, Region, RegionFillSpec, RegionFiller, Site } from "./types.js";

const radians = Math.PI / 180;
const U32 = 0x1_0000_0000;
const MAX_SAMPLES = 12_000;
const MAX_HATCH_LINES = 3_000;
export type PreparedRegionGeometry = { mode: "hatch" | "motifs" | "contours";
  geometry: readonly Site[] | readonly Path[] | readonly (readonly Point[])[] };
const nestedCache = new Map<string, PreparedRegionGeometry["geometry"]>();
const preparedScenes = new Map<symbol, ReadonlyMap<string, PreparedRegionGeometry | undefined>>();

/** The key deliberately excludes material, palette, omission, underpaint and stroke weight. */
export function regionGeometryKey(spec: RegionFillSpec, region: Region): string {
  const mode = regionMode(spec, region);
  return JSON.stringify([region.id, region.seed, region.bounds, spec.inset, mode,
    mode === "contours" ? spec.contour : spec.spacing, mode === "hatch" ? spec.angle : null]);
}
/** Publish a complete preparation in one step; partial or cancelled work stays private. */
export function retainPreparedRegions(scene: ReadonlyMap<string, PreparedRegionGeometry | undefined>): void {
  if (preparedScenes.size >= 3) preparedScenes.delete(preparedScenes.keys().next().value!);
  preparedScenes.set(Symbol("prepared composition"), scene);
}

function cached<T extends PreparedRegionGeometry["geometry"]>(key: string, build: () => T): T {
  const hit = nestedCache.get(key);
  if (hit) return hit as T;
  const result = build();
  if (nestedCache.size >= 64) nestedCache.delete(nestedCache.keys().next().value!);
  nestedCache.set(key, result);
  return result;
}
function unit(seed: number, id: string, purpose: string): number {
  return componentSeed(seed, id, purpose) / U32;
}
function requireFinite(label: string, value: number, min = -Infinity, max = Infinity): void {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}
function color(surface: CompositionSurface, palette: readonly number[], index: number, alpha: number, fill: boolean): void {
  if (!palette.length) throw new Error("Composition palette must have at least one color");
  const rgb = palette[index % palette.length] >>> 0;
  if (fill) surface.fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, alpha);
  else surface.stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, alpha);
}
function motifValid(spec: MotifSpec): void {
  requireFinite("motif size", spec.size, 0, 500);
  requireFinite("motif petals", spec.petals, spec.kind === "arrow" ? 0 : 1, 48);
  requireFinite("motif opening", spec.opening, 0, 1);
  requireFinite("motif weight", spec.weight, 0, 50);
  requireFinite("motif rotation", spec.rotation);
  requireFinite("motif variation", spec.variation, 0, 1);
  requireFinite("motif retention", spec.retention, 0, 1);
}
function materialValid(spec: PathMaterialSpec): void {
  motifValid(spec.mark);
  requireFinite("material weight", spec.weight, 0, 50);
  requireFinite("material spacing", spec.spacing, 0.5, 1000);
  requireFinite("material phase", spec.phase, 0, 1);
  requireFinite("material phase spread", spec.phaseSpread, 0, 1);
  requireFinite("material level ramp", spec.levelRamp, 0, 1);
  requireFinite("material retention", spec.retention, 0, 1);
}

/** A local-origin mark; omission and variation are stable under population reorder. */
export function motif(spec: MotifSpec, palette: readonly number[]): Mark {
  motifValid(spec);
  return (surface, site) => {
    if (spec.retention === 0 || spec.size === 0 || unit(site.seed, site.id, "keep") >= spec.retention) return;
    const radius = spec.size * (1 - spec.variation * unit(site.seed, site.id, "size")) / 2;
    const ink = site.tone === undefined ? Math.floor(unit(site.seed, site.id, "ink") * palette.length) : Math.floor(site.tone);
    surface.rotate(spec.rotation * radians);
    surface.strokeWeight(spec.weight);
    if (spec.kind === "dot") {
      surface.noStroke(); color(surface, palette, ink, 225, true);
      surface.circle(0, 0, radius * 2);
    } else if (spec.kind === "rings") {
      surface.noFill(); color(surface, palette, ink, 220, false);
      surface.circle(0, 0, radius * 2);
      if (spec.opening > 0 && spec.opening < 1) {
        color(surface, palette, ink + 1, 170, false);
        surface.circle(0, 0, radius * 2 * (1 - spec.opening));
      }
    } else if (spec.kind === "rosette") {
      surface.noFill(); color(surface, palette, ink, 225, false);
      const gap = spec.opening * radius;
      const length = radius - gap;
      if (length > 0) for (let i = 0; i < spec.petals; i++) {
        const theta = 2 * Math.PI * i / spec.petals;
        const c = Math.cos(theta), s = Math.sin(theta);
        surface.line(c * gap, s * gap, c * radius, s * radius);
        surface.circle(c * (gap + length * .7), s * (gap + length * .7), Math.min(length * .24, spec.weight * 2.7));
      }
      if (gap > 0) { color(surface, palette, ink + 1, 180, false); surface.circle(0, 0, gap * .62); }
    } else if (spec.kind === "arrow") {
      // Head plus a one-sided tail flag: the flag makes mirrors and glides readable.
      surface.noFill(); color(surface, palette, ink, 225, false);
      const length = radius;
      surface.line(-length, 0, length, 0);
      surface.line(length, 0, length - length * .45, -length * .42);
      surface.line(length, 0, length - length * .45, length * .42);
      surface.line(-length, 0, -length + length * .5, -length * .5);
    } else throw new Error(`Unknown motif kind: ${spec.kind}`);
  };
}

function measure(path: Path): number {
  let length = 0;
  for (let i = 1; i < path.points.length; i++) length += Math.hypot(path.points[i][0] - path.points[i - 1][0], path.points[i][1] - path.points[i - 1][1]);
  if (path.closed && path.points.length > 1) {
    const a = path.points[0], b = path.points[path.points.length - 1];
    length += Math.hypot(a[0] - b[0], a[1] - b[1]);
  }
  return length;
}
/** Full-path ink or arc-length-spaced tangent stitches/beads. Phase offsets stations along each path. */
function materialWithin(spec: PathMaterialSpec, palette: readonly number[],
  bounds?: readonly [number, number, number, number]): PathMaterial {
  materialValid(spec);
  const bead = motif(spec.mark, palette);
  return (surface, path, run) => {
    if (spec.retention === 0 || path.points.length < 2) return;
    if (spec.kind === "ink") {
      if (unit(path.seed, path.id, "keep") >= spec.retention) return;
      if (spec.weight === 0) return;
      surface.noFill(); color(surface, palette, Math.floor(unit(path.seed, path.id, "ink") * palette.length), 215, false);
      surface.strokeWeight(spec.weight); surface.strokeCap(surface.ROUND);
      surface.beginShape(); for (const [x, y] of path.points) surface.vertex(x, y);
      surface.endShape(path.closed ? surface.CLOSE : undefined);
      return;
    }
    if (spec.kind !== "stitch" && spec.kind !== "beads") throw new Error(`Unknown path material: ${spec.kind}`);
    const length = measure(path);
    if (length <= 0) return;
    const intervals = Math.max(1, Math.ceil(length / spec.spacing));
    const count = path.closed ? intervals : intervals + 1;
    if (count > MAX_SAMPLES) throw new Error(`Path material needs ${count} stations; limit ${MAX_SAMPLES}`);
    // The core accepts frozen ordinary arrays and makes its own detached result.
    run.enter(path.points.length + count);
    let samples: { points: number[][]; sourceSegments: number[]; totalLength: number };
    try {
      samples = resamplePolyline2D({ points: path.points, closed: path.closed,
        count, maxWork: path.points.length + count });
    } finally { run.leave(); }
    const scratchPosition: [number, number] = [0, 0];
    const scratchSite: { id: string; seed: number; position: [number, number]; angle: number; scale: number } =
      { id: "", seed: 0, position: scratchPosition, angle: 0, scale: 1 };
    const scratchSites = [scratchSite];
    const stitch: Mark = (p, station) => {
      p.noFill(); color(p, palette, Math.floor(unit(station.seed, station.id, "ink") * palette.length), 225, false);
      p.strokeWeight(spec.weight); p.strokeCap(p.ROUND);
      p.line(-spec.spacing * .27, 0, spec.spacing * .27, 0);
    };
    for (let i = 0; i < intervals; i++) {
      run.check();
      const a = samples.points[i];
      let x = a[0], y = a[1], segment = samples.sourceSegments[i];
      let offset = samples.totalLength / intervals * (spec.phase + (spec.phaseSpread > 0 ? unit(path.seed, path.id, "phase") * spec.phaseSpread : 0) % 1), dx = 0, dy = 0;
      // Advance on the original edges, not the chord between adjacent stations.
      // The source segment supplies the tangent even for a single closed-loop station.
      for (let remaining = path.points.length; remaining > 0; remaining--) {
        const start = path.points[segment], end = path.points[(segment + 1) % path.points.length];
        dx = end[0] - start[0]; dy = end[1] - start[1];
        const available = Math.hypot(end[0] - x, end[1] - y);
        if (offset < available || (!path.closed && segment === path.points.length - 2)) {
          if (available > 0) {
            const fraction = offset / available;
            x += (end[0] - x) * fraction; y += (end[1] - y) * fraction;
          }
          break;
        }
        offset -= available; x = end[0]; y = end[1];
        segment = (segment + 1) % path.points.length;
      }
      const id = `${path.id}/station:${i}`;
      if (unit(path.seed, id, "keep") >= spec.retention) continue;
      const seed = componentSeed(path.seed, id, "station");
      if (bounds) {
        const radius = spec.kind === "beads"
          ? (spec.mark.size * (1 - spec.mark.variation * unit(seed, id, "size")) +
            (spec.mark.kind === "dot" ? 0 : spec.mark.weight)) / 2
          : spec.spacing * .27 + spec.weight / 2;
        if (x - radius < bounds[0] || y - radius < bounds[1] ||
            x + radius > bounds[2] || y + radius > bounds[3]) continue;
      }
      scratchPosition[0] = x; scratchPosition[1] = y;
      scratchSite.id = id;
      scratchSite.seed = seed;
      scratchSite.angle = Math.atan2(dy, dx);
      scratchSite.scale = spec.kind === "beads" ? 1 - spec.levelRamp * path.levelFraction : 1;
      atEach(surface, scratchSites, spec.kind === "stitch" ? stitch : bead, run);
    }
  };
}

/** Full-path ink or arc-length-spaced tangent stitches/beads. */
export function pathMaterial(spec: PathMaterialSpec, palette: readonly number[]): PathMaterial {
  return materialWithin(spec, palette);
}

function interior(region: Region, inset: number): { width: number; height: number; left: number; top: number } | undefined {
  const width = region.bounds[2] - region.bounds[0] - inset * 2;
  const height = region.bounds[3] - region.bounds[1] - inset * 2;
  if (width <= 0 || height <= 0) return undefined;
  return { left: inset, top: inset, width, height };
}
export function regionMode(spec: RegionFillSpec, region: Region): "hatch" | "motifs" | "contours" {
  if (spec.kind !== "mixed") return spec.kind;
  return (["hatch", "motifs", "contours"] as const)[componentSeed(region.seed, region.id, "fill-choice") % 3];
}
export function regionFillValid(spec: RegionFillSpec): void {
  materialValid(spec.material);
  motifValid(spec.mark);
  requireFinite("region inset", spec.inset, 0, 500);
  requireFinite("region retention", spec.retention, 0, 1);
  requireFinite("region spacing", spec.spacing, 1, 1000);
  requireFinite("region angle", spec.angle);
  requireFinite("region weight", spec.weight, 0, 50);
  requireFinite("region underpaint", spec.underpaint, 0, 1);
  if (!["hatch", "motifs", "contours", "mixed"].includes(spec.kind)) throw new Error(`Unknown region filler: ${spec.kind}`);
}
/** Geometry preparation uses source identities and construction fields only, never palette or retention. */
export function regionGeometry(spec: RegionFillSpec, region: Region): PreparedRegionGeometry | undefined {
  const sceneKey = regionGeometryKey(spec, region);
  for (const scene of preparedScenes.values()) if (scene.has(sceneKey)) return scene.get(sceneKey);
  const box = interior(region, spec.inset);
  if (!box || box.width < 1 || box.height < 1) return undefined;
  const mode = regionMode(spec, region);
  const seed = componentSeed(region.seed, region.id, mode);
  if (mode === "motifs") {
    const separation = spec.spacing;
    const source = { seed, width: box.width, height: box.height, centerX: box.left + box.width / 2,
      centerY: box.top + box.height / 2, separation, maxPoints: 80, support: "rectangle" as const, opening: 0, rotation: 0 };
    const geometry = cached(`sites:${JSON.stringify(source)}`, () => poissonSites(source));
    return { mode, geometry };
  }
  if (mode === "contours") {
    const source = { ...spec.contour, seed, width: box.width, height: box.height,
      centerX: box.left + box.width / 2, centerY: box.top + box.height / 2, rotation: 0 };
    const geometry = cached(`paths:${JSON.stringify(source)}`, () => contourPaths(source));
    return { mode, geometry };
  }
  const theta = spec.angle * radians;
  const key = `hatch:${JSON.stringify([box.width, box.height, spec.inset, spec.spacing, spec.angle])}`;
  const geometry = cached(key, () => {
    const count = Math.ceil(Math.hypot(box.width, box.height) / spec.spacing) + 2;
    if (count > MAX_HATCH_LINES) throw new Error(`Hatch needs ${count} lines; limit ${MAX_HATCH_LINES}`);
    const result = hatchRegionLines2D({ region: { outer: [[box.left, box.top], [box.left + box.width, box.top],
      [box.left + box.width, box.top + box.height], [box.left, box.top + box.height]], holes: [] },
      // Center a symmetric stripe population in the leaf instead of forcing a scanline
      // through its corner, where binary64 endpoints can collapse an exact interval.
      origin: [box.left + box.width / 2, box.top + box.height / 2],
      direction: [Math.cos(theta), Math.sin(theta)],
      spacing: spec.spacing, phase: spec.spacing / 2, maxWork: 1_000_000, maxOutputPaths: MAX_HATCH_LINES });
    return Object.freeze(result.paths.map((line) => Object.freeze(line.map(([x, y]) => Object.freeze([x, y] as const)))));
  });
  return { mode, geometry };
}

export function regionFill(spec: RegionFillSpec, palette: readonly number[]): RegionFiller {
  regionFillValid(spec);
  const mark = motif(spec.mark, palette);
  // This callback varies only in its local bounds, not in point source construction.
  const material = pathMaterial(spec.material, palette);
  return (surface, region, run) => {
    if (spec.retention === 0 || unit(region.seed, region.id, "keep") >= spec.retention) return;
    const box = interior(region, spec.inset);
    if (!box) return;
    if (spec.underpaint > 0) {
      surface.noStroke(); color(surface, palette, componentSeed(region.seed, region.id, "underpaint") % palette.length,
        Math.round(spec.underpaint * 100), true);
      surface.rect(box.left, box.top, box.width, box.height);
    }
    const source = regionGeometry(spec, region);
    if (!source) return;
    if (source.mode === "motifs") {
      const within: Mark = (p, site, shared) => {
        const radius = (spec.mark.size * (1 - spec.mark.variation * unit(site.seed, site.id, "size")) +
          (spec.mark.kind === "dot" ? 0 : spec.mark.weight)) / 2;
        const x = site.position[0], y = site.position[1];
        if (x - radius >= box.left && y - radius >= box.top &&
            x + radius <= box.left + box.width && y + radius <= box.top + box.height) mark(p, site, shared);
      };
      atEach(surface, source.geometry as readonly Site[], within, run);
    } else if (source.mode === "contours") {
      const bounded = spec.material.kind === "ink" ? material : materialWithin(spec.material, palette,
        [box.left, box.top, box.left + box.width, box.top + box.height]);
      strokeWith(surface, source.geometry as readonly Path[], bounded, run);
    }
    else {
      surface.noFill(); color(surface, palette, componentSeed(region.seed, region.id, "hatch-ink") % palette.length, 205, false);
      surface.strokeWeight(spec.weight); surface.strokeCap(surface.ROUND);
      const lines = source.geometry as readonly (readonly Point[])[];
      run.enter(lines.length);
      try { for (const line of lines) { run.check(); surface.line(line[0][0], line[0][1], line[1][0], line[1][1]); } }
      finally { run.leave(); }
    }
  };
}
