import { componentSeed } from "./core.js";
import {
  arcSteps, arcThrough, circleCline, circleIntervals, circumcircle, circleInversion, clineShape, invertCline, invertFrame, invertPoint, sampleArc,
  segmentIntervals,
} from "./inversion.js";
import type { Cline, CircleInversion, Constraint } from "./inversion.js";
import { sourceGeometry } from "./inversion-sources.js";
import type { Source, SourceOptions } from "./inversion-sources.js";
import { memoized } from "./sources.js";
import type { Path, Point } from "./types.js";

/**
 * The orbit of a source under a group of circle inversions.
 *
 * INPUT. Up to eight inversion circles named A, B, …; a bundled source (`inversion-sources.ts`);
 * a rule; a generation count. The circles are placed on a ring (free centre distance and radius)
 * or orthogonal to the frame disc, each tangent to its neighbours at `spread` 1 and separate below
 * it, which makes the group a hyperbolic reflection group at 1 and a free (Schottky-like) group
 * below. Circles that overlap still give a well-defined orbit; only the cutoffs below then lose
 * their nesting guarantee, and the documentation says so.
 *
 * IMAGES. A word applies its letters in order: the image of a piece under `AB` is B(A(piece)).
 * `tree` enumerates every reduced word (no letter next to itself: each inversion is its own
 * inverse) up to `generations` letters, n(n−1)^(g−1) words of length g. `word` applies the given
 * word repeatedly, one image per prefix, so order visibly matters: AB and BA differ. Generation 0
 * is the source itself (id `src`). Ids are `w:<letters>` and `<image>/<piece>#<n>`; raising
 * generations or changing appearance renames nothing.
 *
 * EXACTNESS. Straight edges map to circular arcs and circles to circles, so pieces are cut in the
 * SOURCE plane by the pulled-back constraints and then mapped: the arc through three images is the
 * image of the piece. Sampling to polylines (chord error `tolerance`) is the only approximation.
 *
 * VALID DOMAIN. Source points within `exclusion`·r of a pole at the moment they meet it, and points
 * whose final image lies outside the clip disc, are removed. Both are half spaces/discs in the
 * source plane obtained by pulling their regions back through the word (`wordConstraints`), so the
 * removal is exact and no coordinate is ever unbounded. A site is dropped by the same rules and when
 * its natural size would exceed twice the clip radius. Nothing is clamped or interpolated across.
 *
 * CUTOFFS. In the tree, a word whose enclosing disc (the image of its first letter's disc under the
 * rest of the word) is smaller than `minRadius` or misses the clip disc is not expanded; with
 * disjoint circles every descendant lies inside that disc, so nothing visible is lost. Retention keeps
 * a word when its own id draws below it; a dropped word takes its extensions with it in the tree and
 * only itself in `word`. Work is bounded before drawing (`ORBIT_LIMITS`); exceeding a bound throws an
 * error naming the controls to change.
 */
export const ORBIT_LIMITS = Object.freeze({ maxImages: 6_000, maxPieces: 150_000, maxVertices: 500_000, maxCircles: 8, maxGenerations: 12, maxWord: 16 });

export type Arrangement = "ring" | "orthogonal";
export type OrbitRule = "tree" | "word";

export interface OrbitOptions {
  seed: number;
  centerX: number;
  centerY: number;
  /** Frame radius, canvas units; the orthogonal arrangement is orthogonal to this circle. */
  radius: number;
  /** Degrees, clockwise on screen: turns the ring of circles about the centre. */
  rotation: number;
  /** Clip disc radius as a share of `radius`. */
  clipShare: number;
  circles: number;
  arrangement: Arrangement;
  /** Ring arrangement: distance of the circle centres and their radius, as shares of `radius`. */
  ringRadius: number;
  circleRadius: number;
  /** Orthogonal arrangement: circle size as a share of the tangent size, in (0, 1]. */
  spread: number;
  /** Extra turn of the ring, degrees. */
  twist: number;
  /** Seeded wobble of every circle's position and size, as a share of its radius. */
  jitter: number;
  rule: OrbitRule;
  word: string;
  generations: number;
  /** Pole clearance as a share of each circle's radius. */
  exclusion: number;
  minRadius: number;
  retention: number;
  tolerance: number;
  source: SourceOptions;
}

export interface OrbitCircle {
  readonly id: string;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly inversion: CircleInversion;
  /** The clearance disc around the pole. */
  readonly exclusion: Cline;
  readonly clearance: number;
}

export interface OrbitImage {
  readonly id: string;
  /** Letters in application order; empty for the source. */
  readonly word: string;
  readonly generation: number;
  /** Index of the last applied circle, −1 for the source. */
  readonly branch: number;
  readonly parity: 0 | 1;
  /** floor(−log₂ m), at least 0, where m is the image's magnification at the source centre. */
  readonly octave: number;
  readonly seed: number;
}

export interface GardenPath extends Path {
  readonly image: string;
  readonly generation: number;
  readonly branch: number;
  readonly parity: 0 | 1;
  readonly octave: number;
}
/** A proper disc: region of a source circle that stays bounded. */
export interface GardenDisc {
  readonly id: string;
  readonly seed: number;
  readonly image: string;
  readonly generation: number;
  readonly branch: number;
  readonly parity: 0 | 1;
  readonly octave: number;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}
export interface GardenSite {
  readonly id: string;
  readonly seed: number;
  readonly image: string;
  readonly generation: number;
  readonly branch: number;
  readonly parity: 0 | 1;
  readonly octave: number;
  readonly position: Point;
  readonly angle: number;
  /** Signed: negative when an odd number of inversions has mirrored the frame. */
  readonly scale: number;
  /** Natural size of the mark: `extent × |scale|`, canvas units. */
  readonly size: number;
  readonly tone?: number;
}

export interface Orbit {
  readonly circles: readonly OrbitCircle[];
  readonly images: readonly OrbitImage[];
  readonly paths: readonly GardenPath[];
  readonly discs: readonly GardenDisc[];
  readonly sites: readonly GardenSite[];
  /** Images per generation, generation 0 first. */
  readonly counts: readonly number[];
  readonly clip: { readonly cx: number; readonly cy: number; readonly r: number };
  readonly source: Source;
  readonly stats: { readonly pieces: number; readonly vertices: number; readonly sitesDropped: number };
}

const U32 = 0x1_0000_0000;
const LETTERS = "ABCDEFGH";
const orbitCache = new Map<string, Orbit>();

function finite(label: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}

/** Parse the Word control: two to sixteen letters from the circles' names, no letter next to itself (cyclically). */
export function parseWord(text: string, count: number): number[] {
  const letters = [...text.trim().toUpperCase()];
  if (letters.length < 2 || letters.length > ORBIT_LIMITS.maxWord)
    throw new Error(`Word needs two to ${ORBIT_LIMITS.maxWord} letters, such as "AB" or "ABC"`);
  const word = letters.map((letter) => LETTERS.indexOf(letter));
  const bad = letters.find((_, i) => word[i] < 0 || word[i] >= count);
  if (bad !== undefined) throw new Error(`Word letter "${bad}" is not an inversion circle; with ${count} circles use ${LETTERS.slice(0, count).split("").join(", ")}`);
  for (let i = 0; i < word.length; i++)
    if (word[i] === word[(i + 1) % word.length]) throw new Error(`Word repeats "${letters[i]}" next to itself; an inversion applied twice in a row undoes itself`);
  return word;
}

/** The inversion circles, in letter order. */
export function orbitCircles(options: OrbitOptions): readonly OrbitCircle[] {
  const { seed, centerX, centerY, radius: R, rotation, circles: n, arrangement, ringRadius, circleRadius, spread, twist, jitter, exclusion } = options;
  finite("Frame radius", R, 1e-3, 1e6);
  finite("Rotation", rotation, -1e6, 1e6);
  finite("Twist", twist, -1e6, 1e6);
  finite("Jitter", jitter, 0, 1);
  finite("Pole clearance", exclusion, 1e-3, 0.9);
  if (!Number.isInteger(n) || n < 2 || n > ORBIT_LIMITS.maxCircles) throw new Error(`Circles must be an integer in [2, ${ORBIT_LIMITS.maxCircles}]`);
  let distance: number, r: number;
  if (arrangement === "orthogonal") {
    if (n < 3) throw new Error("The orthogonal arrangement needs at least 3 Circles; choose Ring or raise Circles");
    finite("Spread", spread, 1e-3, 1);
    r = spread * R * Math.tan(Math.PI / n);
    distance = Math.sqrt(R * R + r * r);
  } else if (arrangement === "ring") {
    finite("Ring radius", ringRadius, 0, 10); finite("Circle radius", circleRadius, 1e-3, 10);
    distance = ringRadius * R; r = circleRadius * R;
  } else throw new Error(`Unknown arrangement: ${String(arrangement)}`);
  return Object.freeze(Array.from({ length: n }, (_, i) => {
    const id = LETTERS[i], theta = (rotation + twist + 360 * i / n) * Math.PI / 180;
    const wobble = (purpose: string) => (componentSeed(seed, `inv:${id}`, purpose) / U32 - 0.5) * 2;
    const ri = jitter > 0 ? r * (1 + 0.5 * jitter * wobble("size")) : r;
    const cx = centerX + distance * Math.cos(theta) + (jitter > 0 ? jitter * r * wobble("x") : 0);
    const cy = centerY + distance * Math.sin(theta) + (jitter > 0 ? jitter * r * wobble("y") : 0);
    const clearance = exclusion * ri;
    return Object.freeze({ id, cx, cy, r: ri, inversion: circleInversion(cx, cy, ri), exclusion: circleCline(cx, cy, clearance), clearance });
  }));
}

/**
 * The valid domain of a word in the source plane, as constraints: the pulled-back clearance disc of
 * each step must be avoided (`inside: false`) and the pulled-back clip disc must contain the point.
 */
export function wordConstraints(circles: readonly OrbitCircle[], word: readonly number[], clip: { cx: number; cy: number; r: number }): Constraint[] {
  const out: Constraint[] = [];
  for (let j = 0; j < word.length; j++) {
    let v = circles[word[j]].exclusion;
    for (let m = j - 1; m >= 0; m--) v = invertCline(v, circles[word[m]].inversion);
    out.push({ region: v, inside: false });
  }
  let v = circleCline(clip.cx, clip.cy, clip.r);
  for (let m = word.length - 1; m >= 0; m--) v = invertCline(v, circles[word[m]].inversion);
  out.push({ region: v, inside: true });
  return out;
}

/** Whether a source point survives a word: it never meets a pole within the clearance and lands in the clip disc. */
export function inWordDomain(constraints: readonly Constraint[], x: number, y: number): boolean {
  return constraints.every(({ region, inside }) => {
    const value = region.a * (x * x + y * y) + 2 * (region.bx * x + region.by * y) + region.d;
    return inside ? value < 0 : value >= 0;
  });
}

function letters(word: readonly number[]): string {
  return word.map((i) => LETTERS[i]).join("");
}

function applyWord(circles: readonly OrbitCircle[], word: readonly number[], x: number, y: number): Point | null {
  let p: Point | null = [x, y];
  for (const i of word) { p = invertPoint(circles[i].inversion, p[0], p[1]); if (!p) return null; }
  return p;
}

interface Budget { pieces: number; vertices: number; images: number; sitesDropped: number }

function overPieces(): Error {
  return new Error(`The images need more than ${ORBIT_LIMITS.maxPieces} pieces; lower Generations, Circles or Source density, raise Minimum radius, or choose a simpler Source`);
}

/** All geometry of one image; an empty word is the source cut by the clip disc. */
function buildImage(options: OrbitOptions, circles: readonly OrbitCircle[], source: Source, word: readonly number[], image: OrbitImage,
  clip: { cx: number; cy: number; r: number }, budget: Budget, maxGeneration: number,
  out: { paths: GardenPath[]; discs: GardenDisc[]; sites: GardenSite[] }): void {
  const constraints = wordConstraints(circles, word, clip);
  const tolerance = options.tolerance;
  const map = (x: number, y: number): Point => applyWord(circles, word, x, y) ?? [NaN, NaN];
  let counter = 0;
  const emit = (source$: string, points: Point[], closed: boolean) => {
    budget.vertices += points.length;
    if (budget.vertices > ORBIT_LIMITS.maxVertices)
      throw new Error(`The images need more than ${ORBIT_LIMITS.maxVertices} vertices; raise Curve tolerance or lower Generations, Circles or Source density`);
    const id = `${image.id}/${source$}#${counter++}`;
    out.paths.push(Object.freeze({ id, seed: componentSeed(options.seed, id, "path"), points: Object.freeze(points.map((p) => Object.freeze(p))), closed,
      level: image.generation, levelFraction: image.generation / Math.max(1, maxGeneration), image: image.id, generation: image.generation,
      branch: image.branch, parity: image.parity, octave: image.octave }));
  };
  /** Sample the image of the source curve from (x0, y0) through (xm, ym) to (x1, y1), appending to `into`. */
  const trace = (a: Point, m: Point, b: Point, into: Point[]) => {
    const p0 = map(a[0], a[1]), pm = map(m[0], m[1]), p1 = map(b[0], b[1]);
    if (!(Number.isFinite(p0[0]) && Number.isFinite(pm[0]) && Number.isFinite(p1[0]))) return;
    const curve = word.length === 0 ? null : arcThrough(p0, pm, p1);
    if (!curve || curve.kind === "segment") {
      if (into.length === 0) into.push(p0);
      into.push(p1);
      return;
    }
    const steps = arcSteps(curve.r, curve.sweep, tolerance);
    const points = sampleArc(curve, steps);
    // The endpoints are the exact images, whatever the arc's rounding was.
    points[0] = p0; points[points.length - 1] = p1;
    for (let i = into.length === 0 ? 0 : 1; i < points.length; i++) into.push(points[i]);
  };

  for (const chain of source.chains) {
    const pts = chain.points, edges = chain.closed ? pts.length : pts.length - 1;
    if (budget.pieces + edges > ORBIT_LIMITS.maxPieces) throw overPieces();
    budget.pieces += edges;
    type Run = { points: Point[]; fromStart: boolean; toEnd: boolean };
    const runs: Run[] = [];
    let run: Run | null = null, full = 0;
    const flush = () => { if (run) runs.push(run); run = null; };
    for (let e = 0; e < edges; e++) {
      const a = pts[e], b = pts[(e + 1) % pts.length];
      const intervals = segmentIntervals({ kind: "segment", x0: a[0], y0: a[1], x1: b[0], y1: b[1] }, constraints);
      if (intervals.length === 0) { flush(); continue; }
      for (const [t0, t1] of intervals) {
        const startsEdge = t0 <= 1e-12, endsEdge = t1 >= 1 - 1e-12;
        if (!(startsEdge && run)) flush();
        if (!run) run = { points: [], fromStart: e === 0 && startsEdge, toEnd: false };
        const at = (t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        trace(at(t0), at((t0 + t1) / 2), at(t1), run.points);
        run.toEnd = e === edges - 1 && endsEdge;
        if (startsEdge && endsEdge) full++;
        if (!endsEdge) flush();
      }
    }
    flush();
    if (runs.length === 0) continue;
    if (chain.closed && full === edges && runs.length === 1) {
      const points = runs[0].points;
      if (Math.hypot(points[0][0] - points[points.length - 1][0], points[0][1] - points[points.length - 1][1]) < 1e-9) points.pop();
      emit(chain.id, points, true);
      continue;
    }
    if (chain.closed && runs.length > 1 && runs[0].fromStart && runs[runs.length - 1].toEnd) {
      const last = runs.pop()!, first = runs.shift()!;
      runs.unshift({ points: [...last.points, ...first.points.slice(1)], fromStart: false, toEnd: false });
    }
    for (const r of runs) if (r.points.length >= 2) emit(chain.id, r.points, false);
  }

  for (const circle of source.circles) {
    budget.pieces += 1;
    if (budget.pieces > ORBIT_LIMITS.maxPieces) throw overPieces();
    for (const [s, e] of circleIntervals({ kind: "circle", cx: circle.cx, cy: circle.cy, r: circle.r }, constraints)) {
      const at = (theta: number): Point => [circle.cx + circle.r * Math.cos(theta), circle.cy + circle.r * Math.sin(theta)];
      if (e - s >= 2 * Math.PI - 1e-9) {
        const q = [at(0), at(2 * Math.PI / 3), at(4 * Math.PI / 3)].map((p) => map(p[0], p[1]));
        if (!q.every((p) => Number.isFinite(p[0]))) continue;
        if (word.length === 0) {
          emit(circle.id, sampleCircle(circle.cx, circle.cy, circle.r, tolerance), true);
          continue;
        }
        const c = circumcircle(q[0], q[1], q[2]);
        if (!c) continue;
        emit(circle.id, sampleCircle(c.cx, c.cy, c.r, tolerance, Math.atan2(q[0][1] - c.cy, q[0][0] - c.cx)), true);
      } else {
        const points: Point[] = [];
        trace(at(s), at((s + e) / 2), at(e), points);
        if (word.length === 0) {
          const arc = { kind: "arc" as const, cx: circle.cx, cy: circle.cy, r: circle.r, start: s, sweep: e - s };
          points.length = 0;
          sampleArc(arc, arcSteps(arc.r, arc.sweep, tolerance), points);
        }
        if (points.length >= 2) emit(circle.id, points, false);
      }
    }
    // Only bounded proper discs are fills: a disc holding a pole has an unbounded image.
    if (circle.disc) {
      let v = circleCline(circle.cx, circle.cy, circle.r);
      for (const i of word) v = invertCline(v, circles[i].inversion);
      const shape = clineShape(v);
      if (shape.kind === "circle" && shape.disc && Math.hypot(shape.cx - clip.cx, shape.cy - clip.cy) < clip.r + shape.r) {
        const id = `${image.id}/${circle.id}`;
        out.discs.push(Object.freeze({ id, seed: componentSeed(options.seed, id, "disc"), image: image.id, generation: image.generation, branch: image.branch,
          parity: image.parity, octave: image.octave, cx: shape.cx, cy: shape.cy, r: shape.r }));
      }
    }
  }

  for (const site of source.sites) {
    let frame: { x: number; y: number; angle: number; scale: number } | null = { x: site.x, y: site.y, angle: site.angle, scale: site.scale };
    for (const i of word) {
      const c = circles[i];
      if (Math.hypot(frame.x - c.cx, frame.y - c.cy) < c.clearance) { frame = null; break; }
      frame = invertFrame(c.inversion, frame);
      if (!frame) break;
    }
    if (!frame || Math.hypot(frame.x - clip.cx, frame.y - clip.cy) > clip.r) { budget.sitesDropped++; continue; }
    const size = site.extent * Math.abs(frame.scale);
    if (size > 2 * clip.r) { budget.sitesDropped++; continue; }
    const id = `${image.id}/${site.id}`;
    out.sites.push(Object.freeze({ id, seed: componentSeed(options.seed, id, "site"), image: image.id, generation: image.generation, branch: image.branch,
      parity: image.parity, octave: image.octave, position: Object.freeze([frame.x, frame.y] as const), angle: frame.angle, scale: frame.scale, size, tone: site.tone }));
  }
}

function sampleCircle(cx: number, cy: number, r: number, tolerance: number, start = 0): Point[] {
  const steps = arcSteps(r, 2 * Math.PI, tolerance, 8), points: Point[] = [];
  for (let i = 0; i < steps; i++) points.push([cx + r * Math.cos(start + 2 * Math.PI * i / steps), cy + r * Math.sin(start + 2 * Math.PI * i / steps)]);
  return points;
}

/** Magnification of the word at the source centre: how much the image shrinks or grows it. */
function octaveOf(circles: readonly OrbitCircle[], word: readonly number[], source: Source): number {
  let frame: { x: number; y: number; angle: number; scale: number } | null = { x: source.bound.cx, y: source.bound.cy, angle: 0, scale: 1 };
  for (const i of word) { frame = invertFrame(circles[i].inversion, frame); if (!frame) return 0; }
  return Math.max(0, Math.floor(-Math.log2(Math.abs(frame.scale))));
}

/** The enclosing disc of a word's whole subtree; null when it is not a bounded disc. */
function enclosing(circles: readonly OrbitCircle[], word: readonly number[]): { cx: number; cy: number; r: number } | null {
  const first = circles[word[0]];
  let v = circleCline(first.cx, first.cy, first.r);
  for (let i = 1; i < word.length; i++) v = invertCline(v, circles[word[i]].inversion);
  const shape = clineShape(v);
  return shape.kind === "circle" && shape.disc ? { cx: shape.cx, cy: shape.cy, r: shape.r } : null;
}

/** Build the orbit. Cached by construction; every value is frozen. */
export function orbitImages(options: OrbitOptions): Orbit {
  const { generations, rule, retention, minRadius, seed, clipShare } = options;
  finite("Clip radius", clipShare, 0.05, 4);
  finite("Minimum radius", minRadius, 0, 1e6);
  finite("Retention", retention, 0, 1);
  finite("Curve tolerance", options.tolerance, 0.005, 10);
  if (!Number.isInteger(generations) || generations < 1 || generations > ORBIT_LIMITS.maxGenerations)
    throw new Error(`Generations must be an integer in [1, ${ORBIT_LIMITS.maxGenerations}]`);
  const circles = orbitCircles(options);
  const cycle = rule === "word" ? parseWord(options.word, circles.length) : [];
  if (rule !== "word" && rule !== "tree") throw new Error(`Unknown rule: ${String(rule)}`);
  // Only the parsed word enters the key, and only when the rule reads it.
  return memoized(orbitCache, JSON.stringify({ ...options, word: cycle.join(",") }), () => {
    const source = sourceGeometry(options.source);
    const clip = { cx: options.centerX, cy: options.centerY, r: options.clipShare * options.radius };
    const budget: Budget = { pieces: 0, vertices: 0, images: 0, sitesDropped: 0 };
    const out = { paths: [] as GardenPath[], discs: [] as GardenDisc[], sites: [] as GardenSite[] };
    const images: OrbitImage[] = [];
    const counts: number[] = [1];
    const unit = (id: string) => componentSeed(seed, id, "keep") / U32;
    const admit = (word: number[]): OrbitImage => {
      if (++budget.images > ORBIT_LIMITS.maxImages)
        throw new Error(`The inversion group needs more than ${ORBIT_LIMITS.maxImages} images; lower Generations or Circles, or raise Minimum radius`);
      const id = word.length ? `w:${letters(word)}` : "src";
      const image: OrbitImage = Object.freeze({ id, word: letters(word), generation: word.length, branch: word.length ? word[word.length - 1] : -1,
        parity: (word.length % 2) as 0 | 1, octave: octaveOf(circles, word, source), seed: componentSeed(seed, id, "image") });
      images.push(image);
      return image;
    };
    const build = (word: number[]) => buildImage(options, circles, source, word, admit(word), clip, budget, generations, out);
    build([]);
    if (rule === "tree") {
      let level: number[][] = [[]];
      for (let g = 1; g <= generations; g++) {
        const next: number[][] = [];
        for (const parent of level) {
          for (let i = 0; i < circles.length; i++) {
            if (parent.length && parent[0] === i) continue;
            const word = [i, ...parent];
            const box = enclosing(circles, word);
            if (box && (box.r < minRadius || Math.hypot(box.cx - clip.cx, box.cy - clip.cy) > clip.r + box.r)) continue;
            if (retention < 1 && unit(`w:${letters(word)}`) >= retention) continue;
            next.push(word);
          }
        }
        next.sort((p, q) => letters(p) < letters(q) ? -1 : 1);
        for (const word of next) build(word);
        counts.push(next.length);
        level = next;
      }
    } else {
      for (let g = 1; g <= generations; g++) {
        const word = Array.from({ length: g }, (_, i) => cycle[i % cycle.length]);
        let keep = retention >= 1 || unit(`w:${letters(word)}`) < retention;
        const bound = circleCline(source.bound.cx, source.bound.cy, source.bound.r);
        let v = bound;
        for (const i of word) v = invertCline(v, circles[i].inversion);
        const shape = clineShape(v);
        if (shape.kind === "circle" && shape.disc && shape.r < minRadius) keep = false;
        if (keep) build(word);
        counts.push(keep ? 1 : 0);
      }
    }
    return Object.freeze({ circles, images: Object.freeze(images), paths: Object.freeze(out.paths), discs: Object.freeze(out.discs), sites: Object.freeze(out.sites),
      counts: Object.freeze(counts), clip: Object.freeze(clip), source,
      stats: Object.freeze({ pieces: budget.pieces, vertices: budget.vertices, sitesDropped: budget.sitesDropped }) });
  });
}
