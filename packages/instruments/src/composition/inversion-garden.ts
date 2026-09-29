import { componentSeed } from "./core.js";
import { arcSteps, circleCline, circleIntervals, sampleArc } from "./inversion.js";
import type { Constraint } from "./inversion.js";
import { apollonianGasket, GASKET_LIMITS } from "./inversion-gasket.js";
import { orbitImages, ORBIT_LIMITS } from "./inversion-orbit.js";
import type { Arrangement, GardenDisc, GardenPath, GardenSite, OrbitImage, OrbitOptions, OrbitRule } from "./inversion-orbit.js";
import type { SourceKind } from "./inversion-sources.js";
import { memoized } from "./sources.js";
import type { Point } from "./types.js";

/**
 * The garden: one producer value for both constructions, ready for consumers.
 *
 *   gasket  Apollonian packing by Descartes' theorem (`inversion-gasket.ts`)
 *   orbit   the orbit of a source under a group of circle inversions (`inversion-orbit.ts`)
 *
 * OUTPUT (deeply frozen, cached by construction only, never by colour, material or marks):
 * `images` (one per element: a gasket circle, or a word applied to the source; generation 0 is the
 * seed triple or the source itself), `paths` (clipped circles and arcs as polylines, ready for a path
 * material), `discs` (bounded proper discs, ready for a disc fill), `sites` (oriented frames, ready
 * for a mark: `size` is the natural mark diameter, a negative `scale` means the frame is mirrored),
 * `guides` (the inversion circles or the gasket's dual circles, and the clip rim, as clipped paths).
 * Every coordinate lies in the clip disc; the clip disc is centred on the frame and has radius
 * `clipShare` × `radius`.
 *
 * Attributes on each element: `generation`, `branch` (the seed subtree, or the last circle applied),
 * `parity` (0 for an even number of inversions, 1 for an odd one: the orientation of the image) and
 * `octave` (how many halvings of size). Colour is chosen from them by the consumer.
 *
 * Failure: invalid values throw naming the field; work above the limits (`GARDEN_LIMITS`) throws
 * naming the controls to change. Empty output (everything clipped) is valid.
 */
export const GARDEN_LIMITS = Object.freeze({ maxVertices: 500_000, ...GASKET_LIMITS, orbit: ORBIT_LIMITS });

export type Construction = "gasket" | "orbit";

export interface GardenOptions {
  seed: number;
  construction: Construction;
  centerX: number;
  centerY: number;
  radius: number;
  /** Degrees, clockwise on screen. */
  rotation: number;
  clipShare: number;
  generations: number;
  minRadius: number;
  retention: number;
  tolerance: number;
  gasket: { first: number; second: number };
  group: {
    circles: number;
    arrangement: Arrangement;
    ringRadius: number;
    circleRadius: number;
    spread: number;
    twist: number;
    jitter: number;
    rule: OrbitRule;
    word: string;
    exclusion: number;
    source: { kind: SourceKind; density: number; glyph: string; size: number; x: number; y: number; turn: number };
  };
}

export interface GardenImage {
  readonly id: string;
  readonly generation: number;
  readonly branch: number;
  readonly parity: 0 | 1;
  readonly octave: number;
}

export interface Garden {
  readonly construction: Construction;
  readonly clip: { readonly cx: number; readonly cy: number; readonly r: number };
  readonly images: readonly GardenImage[];
  readonly paths: readonly GardenPath[];
  readonly discs: readonly GardenDisc[];
  readonly sites: readonly GardenSite[];
  readonly guides: readonly GardenPath[];
  readonly counts: readonly number[];
  readonly stats: { readonly vertices: number; readonly pieces: number; readonly sitesDropped: number };
}

const cache = new Map<string, Garden>();

/** The orbit's own options for these controls: shares become canvas units, the source turns with the picture. */
export function orbitOptions(g: GardenOptions): OrbitOptions {
  const { group } = g, tau = g.rotation * Math.PI / 180, c = Math.cos(tau), s = Math.sin(tau);
  const dx = group.source.x * g.radius, dy = group.source.y * g.radius;
  return {
    seed: g.seed, centerX: g.centerX, centerY: g.centerY, radius: g.radius, rotation: g.rotation, clipShare: g.clipShare,
    circles: group.circles, arrangement: group.arrangement, ringRadius: group.ringRadius, circleRadius: group.circleRadius, spread: group.spread,
    twist: group.twist, jitter: group.jitter, rule: group.rule, word: group.word, generations: g.generations, exclusion: group.exclusion,
    minRadius: g.minRadius, retention: g.retention, tolerance: g.tolerance,
    source: { kind: group.source.kind, density: group.source.density, glyph: group.source.glyph, size: group.source.size * g.radius,
      x: g.centerX + c * dx - s * dy, y: g.centerY + s * dx + c * dy, turn: group.source.turn + g.rotation },
  };
}

function finite(label: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}

function frozenPath(id: string, seed: number, points: Point[], closed: boolean, extra: Omit<GardenPath, "id" | "seed" | "points" | "closed" | "level" | "levelFraction">,
  levelFraction: number): GardenPath {
  return Object.freeze({ id, seed: componentSeed(seed, id, "path"), points: Object.freeze(points.map((p) => Object.freeze(p))), closed, level: extra.generation, levelFraction, ...extra });
}

/** A circle (or line chord) clipped to the clip disc as polylines; `budget.vertices` charges the samples. */
function clippedCircle(cx: number, cy: number, r: number, clip: Constraint[], tolerance: number): { points: Point[]; closed: boolean }[] {
  const out: { points: Point[]; closed: boolean }[] = [];
  for (const [s, e] of circleIntervals({ kind: "circle", cx, cy, r }, clip)) {
    if (e - s >= 2 * Math.PI - 1e-9) {
      const steps = arcSteps(r, 2 * Math.PI, tolerance, 8), points: Point[] = [];
      for (let i = 0; i < steps; i++) points.push([cx + r * Math.cos(2 * Math.PI * i / steps), cy + r * Math.sin(2 * Math.PI * i / steps)]);
      out.push({ points, closed: true });
    } else out.push({ points: sampleArc({ kind: "arc", cx, cy, r, start: s, sweep: e - s }, arcSteps(r, e - s, tolerance)), closed: false });
  }
  return out;
}

function gasketGarden(g: GardenOptions): Garden {
  const clip = { cx: g.centerX, cy: g.centerY, r: g.clipShare * g.radius };
  const clipConstraint: Constraint[] = [{ region: circleCline(clip.cx, clip.cy, clip.r), inside: true }];
  const gasket = apollonianGasket({ seed: g.seed, centerX: g.centerX, centerY: g.centerY, radius: g.radius, rotation: g.rotation, first: g.gasket.first,
    second: g.gasket.second, generations: g.generations, minRadius: g.minRadius, retention: g.retention, maxCircles: GASKET_LIMITS.maxCircles });
  const images: GardenImage[] = [], paths: GardenPath[] = [], discs: GardenDisc[] = [], sites: GardenSite[] = [];
  let vertices = 0;
  const charge = (n: number) => {
    vertices += n;
    if (vertices > GARDEN_LIMITS.maxVertices)
      throw new Error(`The gasket needs more than ${GARDEN_LIMITS.maxVertices} vertices; raise Curve tolerance or Minimum radius, or lower Generations`);
  };
  for (const c of gasket.circles) {
    const parity = (c.generation % 2) as 0 | 1;
    images.push(Object.freeze({ id: c.id, generation: c.generation, branch: c.branch, parity, octave: c.octave }));
    const extra = { image: c.id, generation: c.generation, branch: c.branch, parity, octave: c.octave };
    clippedCircle(c.cx, c.cy, c.r, clipConstraint, g.tolerance).forEach((piece, n) => {
      charge(piece.points.length);
      paths.push(frozenPath(`${c.id}#${n}`, g.seed, piece.points, piece.closed, extra, c.generation / Math.max(1, g.generations)));
    });
    if (c.curvature > 0) {
      if (Math.hypot(c.cx - clip.cx, c.cy - clip.cy) < clip.r + c.r)
        discs.push(Object.freeze({ id: c.id, seed: c.seed, ...extra, cx: c.cx, cy: c.cy, r: c.r }));
      if (Math.hypot(c.cx - clip.cx, c.cy - clip.cy) <= clip.r)
        sites.push(Object.freeze({ id: c.id, seed: c.seed, ...extra, position: Object.freeze([c.cx, c.cy] as const), angle: c.anchor ?? 0,
          scale: parity ? -1 : 1, size: 2 * c.r }));
    }
  }
  const guides: GardenPath[] = [];
  const guideExtra = { image: "guide", generation: 0, branch: -1, parity: 0 as const, octave: 0 };
  const rim = clippedCircle(clip.cx, clip.cy, clip.r, [], g.tolerance)[0];
  charge(rim.points.length);
  guides.push(frozenPath("guide:clip", g.seed, rim.points, true, guideExtra, 0));
  gasket.duals.forEach((dual, i) => {
    if (dual.kind === "circle") {
      clippedCircle(dual.cx, dual.cy, dual.r, clipConstraint, g.tolerance).forEach((piece, n) => {
        charge(piece.points.length);
        guides.push(frozenPath(`guide:dual${i}#${n}`, g.seed, piece.points, piece.closed, guideExtra, 0));
      });
    } else {
      // The chord of the clip disc along the line: solve |p + t d − c|² = r².
      const dl = Math.hypot(dual.dx, dual.dy), ux = dual.dx / dl, uy = dual.dy / dl, px = dual.x - clip.cx, py = dual.y - clip.cy;
      const b = px * ux + py * uy, disc = b * b - (px * px + py * py - clip.r * clip.r);
      if (disc > 0) {
        const t0 = -b - Math.sqrt(disc), t1 = -b + Math.sqrt(disc);
        guides.push(frozenPath(`guide:dual${i}#0`, g.seed, [[dual.x + ux * t0, dual.y + uy * t0], [dual.x + ux * t1, dual.y + uy * t1]], false, guideExtra, 0));
      }
    }
  });
  return Object.freeze({ construction: "gasket" as const, clip: Object.freeze(clip), images: Object.freeze(images), paths: Object.freeze(paths), discs: Object.freeze(discs),
    sites: Object.freeze(sites), guides: Object.freeze(guides), counts: gasket.counts, stats: Object.freeze({ vertices, pieces: gasket.circles.length, sitesDropped: 0 }) });
}

function orbitGarden(g: GardenOptions): Garden {
  const options = orbitOptions(g), orbit = orbitImages(options);
  const clip = orbit.clip;
  const clipConstraint: Constraint[] = [{ region: circleCline(clip.cx, clip.cy, clip.r), inside: true }];
  const guides: GardenPath[] = [];
  const guideExtra = { image: "guide", generation: 0, branch: -1, parity: 0 as const, octave: 0 };
  const rim = clippedCircle(clip.cx, clip.cy, clip.r, [], g.tolerance)[0];
  guides.push(frozenPath("guide:clip", g.seed, rim.points, true, guideExtra, 0));
  for (const c of orbit.circles) clippedCircle(c.cx, c.cy, c.r, clipConstraint, g.tolerance).forEach((piece, n) =>
    guides.push(frozenPath(`guide:${c.id}#${n}`, g.seed, piece.points, piece.closed, guideExtra, 0)));
  const images = orbit.images.map((image: OrbitImage): GardenImage => Object.freeze({ id: image.id, generation: image.generation, branch: image.branch, parity: image.parity, octave: image.octave }));
  return Object.freeze({ construction: "orbit" as const, clip, images: Object.freeze(images), paths: orbit.paths, discs: orbit.discs, sites: orbit.sites, guides: Object.freeze(guides),
    counts: orbit.counts, stats: orbit.stats });
}

/** Build the garden for these structural options (cached). */
export function gardenProducts(options: GardenOptions): Garden {
  finite("Frame radius", options.radius, 1e-3, 1e6);
  finite("Clip radius", options.clipShare, 0.05, 4);
  finite("Curve tolerance", options.tolerance, 0.005, 10);
  if (options.construction !== "gasket" && options.construction !== "orbit") throw new Error(`Unknown construction: ${String(options.construction)}`);
  const key = options.construction === "gasket"
    ? JSON.stringify({ ...options, group: null })
    : JSON.stringify({ ...options, gasket: null });
  return memoized(cache, key, () => options.construction === "gasket" ? gasketGarden(options) : orbitGarden(options));
}

