import { componentSeed } from "./core.js";
import { contourPaths, memoized, poissonSites } from "./sources.js";
import { typeLine } from "./type-text.js";
import type { ContourOptions, Path, PoissonOptions, Point } from "./types.js";

/**
 * Scaffold paths for quilled strips.
 *
 * INPUT CONTRACT. A scaffold is a frozen list of ordinary composition `Path` values: a contour
 * family (`contourPaths`), the outline rings of a bundled word (`typeLine`, the licensed outline
 * font, unshaped Latin only), spiral arms, or short S-shaped strips placed by a Poisson
 * population (`poissonSites`, the Motif Ecologies producer). Any other `Path[]` (a graph route,
 * a gesture track, a warped grid) is an equally valid scaffold for `quillStrips`; only the four
 * constructions below are bundled and selectable in the instrument. Nothing is fetched.
 *
 * OUTPUT. Points are canvas units (y down), angles in options are degrees. A `closed` path has no
 * repeated closing point. Ids are stable per element and never depend on draw order:
 * `level:…` (contours), `letter:<ring>`, `spiral:<arm>`, `scroll:<site>`. Seeds come from
 * `componentSeed(seed, id, "path")`. `level` and `levelFraction` carry the structural
 * grouping the strips inherit: contour level, letter containment depth (0 outer, 1 counter),
 * arm index, or 0.
 *
 * FAILURE. Any invalid option throws an `Error` naming the option. Spiral sampling above
 * `MAX_SCAFFOLD_POINTS` points throws naming the turn and arm counts.
 */
export const MAX_SCAFFOLD_POINTS = 120_000;
const TAU = Math.PI * 2;
const U32 = 0x1_0000_0000;

export type SpiralFamily = "archimedean" | "logarithmic" | "fermat";
export const spiralFamilies: readonly SpiralFamily[] = Object.freeze(["archimedean", "logarithmic", "fermat"] as const);

export interface FrameOptions {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  /** Degrees, clockwise on the canvas. */
  rotation: number;
}
export interface SpiralOptions extends FrameOptions {
  seed: number;
  family: SpiralFamily;
  arms: number;
  /** Turns of each arm from its inner to its outer end. */
  turns: number;
  /** Inner radius as a fraction of the outer radius. */
  core: number;
  /** 0..1: stable per-arm change of turns and starting angle. */
  variation: number;
}
export interface LettersOptions extends FrameOptions {
  seed: number;
  word: string;
}
export interface ScrollOptions {
  seed: number;
  /** Where the strips are placed: the Poisson producer's own options. */
  sites: PoissonOptions;
  /** Nominal strip length in canvas units. */
  length: number;
  /** 0..1: stable per-strip shortening. */
  lengthVariation: number;
  /** Sideways swing of the S as a fraction of the length. */
  bend: number;
}
export type QuillScaffoldSpec =
  | { kind: "contours"; contour: ContourOptions }
  | ({ kind: "letters" } & LettersOptions)
  | ({ kind: "spirals" } & SpiralOptions)
  | ({ kind: "scrolls" } & ScrollOptions);

function requireFinite(label: string, value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and in [${min}, ${max}]`);
  return value;
}
function requireSeed(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Scaffold seed must be a uint32 integer");
}
function checkFrame(f: FrameOptions): void {
  requireFinite("Scaffold center X", f.centerX, -1e5, 1e5);
  requireFinite("Scaffold center Y", f.centerY, -1e5, 1e5);
  requireFinite("Scaffold width", f.width, 1e-3, 1e5);
  requireFinite("Scaffold height", f.height, 1e-3, 1e5);
  requireFinite("Scaffold rotation", f.rotation, -3600, 3600);
}
const unit = (seed: number, id: string, purpose: string) => componentSeed(seed, id, purpose) / U32;

/** Drop consecutive duplicates and a repeated closing point; the result is frozen-ready. */
export function cleanPoints(points: readonly Point[], closed: boolean, epsilon = 1e-6): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > epsilon) out.push([p[0], p[1]]);
  }
  if (closed) while (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= epsilon) out.pop();
  return out;
}

const freezePath = (seed: number, id: string, points: readonly Point[], closed: boolean, level: number, levelFraction: number): Path =>
  Object.freeze({ id, seed: componentSeed(seed, id, "path"), closed, level, levelFraction,
    points: Object.freeze(points.map(([x, y]) => Object.freeze([x, y] as const))) });

/** Whether `point` lies inside `ring` by the even-odd rule. */
function inside(ring: readonly Point[], [x, y]: Point): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const lettersCache = new Map<string, readonly Path[]>();
/** The outline rings of a word fitted into the frame (uniform scale, centered, then rotated). */
export function letterPaths(options: LettersOptions): readonly Path[] {
  requireSeed(options.seed); checkFrame(options);
  const { seed, word, centerX, centerY, width, height, rotation } = options;
  return memoized(lettersCache, JSON.stringify([seed, word, centerX, centerY, width, height, rotation]), () => {
    const line = typeLine(word);
    const scale = Math.min(width / (line.right - line.left), height / (line.bottom - line.top));
    const cx = (line.left + line.right) / 2, cy = (line.top + line.bottom) / 2;
    const angle = rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const rings = line.rings.map((ring) => cleanPoints(ring.map(([x, y]): Point => {
      const dx = (x - cx) * scale, dy = (y - cy) * scale;
      return [centerX + dx * c - dy * s, centerY + dx * s + dy * c];
    }), true));
    const depth = rings.map((ring, i) => rings.reduce((sum, other, j) => sum + (i !== j && other.length >= 3 && inside(other, ring[0]) ? 1 : 0), 0));
    const deepest = Math.max(1, ...depth);
    return Object.freeze(rings.flatMap((ring, i) => ring.length < 3 ? [] :
      [freezePath(seed, `letter:${i}`, ring, true, depth[i], depth[i] / deepest)]));
  });
}

const spiralCache = new Map<string, readonly Path[]>();
/**
 * Spiral arms from the inner end outward. The radius as a function of the unit parameter u is
 * archimedean `core + (1−core)u`, logarithmic `core^(1−u)` or fermat `√(core² + (1−core²)u)`; the
 * angle is `2π·turns·u` plus the arm's own offset `2πk/arms`. The frame's width and height are
 * the outer ellipse diameters.
 */
export function spiralPaths(options: SpiralOptions): readonly Path[] {
  requireSeed(options.seed); checkFrame(options);
  const { seed, family, arms, turns, core, variation, centerX, centerY, width, height, rotation } = options;
  if (!spiralFamilies.includes(family)) throw new Error(`Unknown spiral family: ${String(family)}`);
  if (!Number.isInteger(arms) || arms < 1 || arms > 32) throw new Error("Spiral arms must be an integer in [1, 32]");
  requireFinite("Spiral turns", turns, 0.25, 60);
  requireFinite("Spiral core", core, 0.01, 0.95);
  requireFinite("Spiral variation", variation, 0, 1);
  return memoized(spiralCache, JSON.stringify([seed, family, arms, turns, core, variation, centerX, centerY, width, height, rotation]), () => {
    const rx = width / 2, ry = height / 2, span = Math.max(rx, ry);
    const angle = rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const radius = (u: number) => family === "archimedean" ? core + (1 - core) * u
      : family === "logarithmic" ? core ** (1 - u) : Math.sqrt(core * core + (1 - core * core) * u);
    const paths: Path[] = [];
    let total = 0;
    for (let arm = 0; arm < arms; arm++) {
      const id = `spiral:${arm}`;
      const armTurns = turns * (1 - variation * 0.45 * unit(seed, id, "turns"));
      const phase = TAU * arm / arms + variation * TAU / arms * (unit(seed, id, "phase") - 0.5);
      const end = TAU * armTurns, points: Point[] = [];
      for (let theta = 0; ; ) {
        const rho = radius(theta / end), a = theta + phase;
        const dx = rho * rx * Math.cos(a), dy = rho * ry * Math.sin(a);
        points.push([centerX + dx * c - dy * s, centerY + dx * s + dy * c]);
        if (theta >= end) break;
        // Chord ≤ ~2.5 canvas units keeps the wall smooth without a per-vertex angle limit.
        theta = Math.min(end, theta + Math.min(0.08, 2.5 / Math.max(rho * span, 1e-6)));
        if (points.length > MAX_SCAFFOLD_POINTS) throw new Error(`Spiral would need more than ${MAX_SCAFFOLD_POINTS} points; lower the turns or the arms`);
      }
      total += points.length;
      if (total > MAX_SCAFFOLD_POINTS) throw new Error(`Spirals would need ${total} points; the limit is ${MAX_SCAFFOLD_POINTS}. Lower the turns or the arms`);
      paths.push(freezePath(seed, id, cleanPoints(points, false), false, arm, arms > 1 ? arm / (arms - 1) : 0));
    }
    return Object.freeze(paths);
  });
}

const scrollCache = new Map<string, readonly Path[]>();
const SCROLL_STATIONS = 16;
/**
 * One short open strip per Poisson site: a sine S of the given length and bend, turned by a stable
 * random angle, swinging to a stable random side. Site ids and seeds come from `poissonSites`, so
 * this consumes the Motif Ecologies population exactly; the strips' rolled ends are added later by
 * `quillStrips`.
 */
export function scrollPaths(options: ScrollOptions): readonly Path[] {
  requireSeed(options.seed);
  const { seed, sites: siteOptions, length, lengthVariation, bend } = options;
  requireFinite("Scroll length", length, 1, 1e4);
  requireFinite("Scroll length variation", lengthVariation, 0, 1);
  requireFinite("Scroll bend", bend, 0, 2);
  const sites = poissonSites(siteOptions);
  return memoized(scrollCache, JSON.stringify([seed, siteOptions, length, lengthVariation, bend]), () =>
    Object.freeze(sites.map((site, index) => {
      const id = `scroll:${index}`;
      const long = length * (1 - lengthVariation * unit(seed, id, "length"));
      const turn = TAU * unit(seed, id, "angle"), swing = unit(seed, id, "side") < 0.5 ? -1 : 1;
      const c = Math.cos(turn), s = Math.sin(turn), points: Point[] = [];
      for (let i = 0; i <= SCROLL_STATIONS; i++) {
        const t = i / SCROLL_STATIONS, x = (t - 0.5) * long, y = swing * bend * long * Math.sin(TAU * t) / TAU * 2;
        points.push([site.position[0] + x * c - y * s, site.position[1] + x * s + y * c]);
      }
      return freezePath(seed, id, points, false, 0, sites.length > 1 ? index / (sites.length - 1) : 0);
    })));
}

/** Resolve a scaffold descriptor to its frozen path list. */
export function quillScaffold(spec: QuillScaffoldSpec): readonly Path[] {
  switch (spec.kind) {
    case "contours": return contourPaths(spec.contour);
    case "letters": return letterPaths(spec);
    case "spirals": return spiralPaths(spec);
    case "scrolls": return scrollPaths(spec);
    default: throw new Error(`Unknown scaffold kind: ${(spec as { kind: string }).kind}`);
  }
}
