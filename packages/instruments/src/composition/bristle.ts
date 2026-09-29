import { gradientNoise2D01, resamplePolyline2D } from "@procedurals/javascript";
import { componentSeed, strokeWith } from "./core.js";
import { color, pathMaterial } from "./materials.js";
import type { CompositionRun, CompositionSurface, Path, PathMaterial, Point } from "./types.js";

/**
 * Bristle strokes: any path read as the track of a brush. A coherent cross-section of hairs is carried
 * along the path's own frame; where a hair touches the paper is correlated state (hair, tuft and paper),
 * and the result is data (hair paths, footprint, coverage) that any consumer can draw.
 *
 * - `bristleTrack(path, frame)`: the producer. Resamples the path at a fixed ARC-LENGTH step (so the
 *   vertex density of the source cannot change the stroke), gives every station its travel direction (a
 *   chord across its neighbours, so a corner turns the frame through its bisector and never flips it) and
 *   the pressure of the path's own profile (`even`, `swell`, `press-lift`, `pulses` of `u = arc / length`).
 *   A path that already carries these channels (a `GesturePath`) is used as given.
 * - `bristleContact(track, options)` / `bristleBand(track, options)`: the brush. Hair `k` has a stable
 *   lateral offset `o` in (-1, 1), follows the frame at `o * halfWidth`, and touches at a station when the
 *   mapped pressure reaches its threshold. Everything a hair "decides" is a closed-form function of ARC
 *   LENGTH, never of the station index, so a different step changes where a run is cut by at most one step
 *   and leaves the apparent ink load (`inkLoad`, `hairLength`) unchanged in expectation.
 * - `bristleStroke(path, frame, options)`: both together. `bristleStrokes(paths, ...)` for a family, with
 *   one work bound for all of it.
 * - `hairMaterial`, `drawBristleStroke`, `bristleMaterial`: consumers. The hairs are stroked with the
 *   existing `pathMaterial` ink, an optional footprint wash lies under them.
 *
 * Ids and seeds. A stroke keeps its path's `id` and `seed`; hair runs are `<path id>/hair:<k>@<start>`
 * where `<start>` is the moment (`track.times`) or arc length of the run's first station; seeds are
 * `componentSeed(path.seed, id, purpose)`. Tuft draws use `tuft:<t>`. Palette, hair weight, tone mix, wash
 * and every drawing choice never enter a producer or a cache key.
 *
 * Units and limits. Canvas units, angles in degrees on options and radians on published channels. A path
 * is limited to 20,000 stations and hairs x stations (over a whole family) to 600,000. Over a limit the
 * producer throws naming what to lower; nothing is truncated. Measured cost is in the brief document.
 *
 * Failure. Non-finite coordinates and out-of-range options throw. A path with fewer than two distinct
 * positions is a valid EMPTY stroke (no hairs, no footprint). A closed path is opened at its first
 * vertex: the brush lifts at the seam.
 */

const U32 = 0x1_0000_0000;
const TAU = Math.PI * 2;
export const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
/** Hair vertices per composition (all repeats or strokes together); one path is limited by the same number. */
export const MAX_HAIR_POINTS = 600_000;
/** Stations along one path. */
export const MAX_STATIONS = 20_000;
/** Hairs meet the paper at different points: hair k first touches after a stable share of this many canvas units of the path. */
export const ATTACK = 36;

export function seedOf(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Gesture seed must be a uint32 integer");
}
export function range(label: string, value: number, low: number, high: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high)
    throw new Error(`${label} must be a finite number in [${low}, ${high}]`);
}
export function cachedBy<K extends object, V>(cache: WeakMap<K, Map<string, V>>, owner: K, key: string, make: () => V): V {
  let byKey = cache.get(owner);
  if (!byKey) { byKey = new Map(); cache.set(owner, byKey); }
  const hit = byKey.get(key);
  if (hit !== undefined) { byKey.delete(key); byKey.set(key, hit); return hit; }
  const value = make();
  byKey.set(key, value);
  if (byKey.size > 8) byKey.delete(byKey.keys().next().value!);
  return value;
}

/** Width/size factor of a pressure: `floor + (1 - floor) * p^curve`. Zero pressure gives `floor`, full pressure 1. */
export interface PressureMap { floor: number; curve: number }
export function mapPressure(pressure: number, map: PressureMap): number {
  return map.floor + (1 - map.floor) * Math.min(1, Math.max(0, pressure)) ** map.curve;
}
export function checkMap(map: PressureMap): void {
  range("pressure floor", map.floor, 0, 1);
  range("pressure curve", map.curve, 0.05, 20);
}

// ---------------------------------------------------------------------------------------------------
// Producer: the brush's track along a path.

export const pressureProfiles = ["even", "swell", "press-lift", "pulses"] as const;
export type PressureProfile = (typeof pressureProfiles)[number];
/**
 * Pressure along a path that carries none, as a function of `u = arc / length` in [0, 1]:
 * `even` is `level`; `swell` is `sin(pi u)^0.8` (light at both ends, hardest in the middle); `press-lift`
 * is `1 - u^1.6` (down hard, lifting away); `pulses` is `pulses` full presses with a stable per-path
 * phase, `0.5 + 0.5 cos(2 pi (pulses u + phase))`.
 */
export interface PressureShape { profile: PressureProfile; level: number; pulses: number }
export interface BristleFrame {
  /** Distance between stations along the path, canvas units. Sets the resolution of the stroke, not its ink. */
  step: number;
  pressure: PressureShape;
}

/** A path with the channels a brush reads. `GesturePath` satisfies this structurally. */
export interface BristleTrack extends Path {
  /** Arc length at each point, from the stroke's start. */
  readonly arcs: readonly number[];
  /** Direction of travel, radians. */
  readonly angles: readonly number[];
  /** Pressure in [0, 1]. */
  readonly pressure: readonly number[];
  /** Length the stroke's progress and taper are measured against (a windowed recording keeps its whole track's length). */
  readonly trackLength: number;
  /** Moments (ms) used to name hair runs; arc length is used when absent. */
  readonly times?: readonly number[];
}

export function isBristleTrack(path: Path): path is BristleTrack {
  const t = path as Partial<BristleTrack>;
  return Array.isArray(t.arcs) && Array.isArray(t.angles) && Array.isArray(t.pressure) && typeof t.trackLength === "number" &&
    t.arcs.length === path.points.length && t.angles.length === path.points.length && t.pressure.length === path.points.length;
}

function checkFrame(frame: BristleFrame): void {
  range("path step", frame.step, 0.25, 100);
  if (!(pressureProfiles as readonly string[]).includes(frame.pressure.profile)) throw new Error(`Unknown pressure profile: ${frame.pressure.profile}`);
  range("pressure level", frame.pressure.level, 0, 1);
  if (!Number.isInteger(frame.pressure.pulses) || frame.pressure.pulses < 1 || frame.pressure.pulses > 64) throw new Error("Pressure pulses must be an integer in [1, 64]");
}

const trackCache = new WeakMap<Path, Map<string, BristleTrack>>();

/** Pressure of the path's profile at fraction `u` of its length. */
export function profilePressure(shape: PressureShape, u: number, phase: number): number {
  switch (shape.profile) {
    case "even": return shape.level;
    case "swell": return Math.sin(Math.PI * Math.min(1, Math.max(0, u))) ** 0.8;
    case "press-lift": return 1 - Math.min(1, Math.max(0, u)) ** 1.6;
    case "pulses": return 0.5 + 0.5 * Math.cos(TAU * (shape.pulses * u + phase));
  }
}

export function bristleTrack(path: Path, frame: BristleFrame): BristleTrack {
  if (isBristleTrack(path)) return path;
  checkFrame(frame);
  const key = JSON.stringify(frame);
  return cachedBy(trackCache, path, key, () => {
    const points = path.closed && path.points.length > 1 ? [...path.points, path.points[0]] : path.points;
    for (const [x, y] of points) if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Path ${path.id} has a non-finite coordinate`);
    let length = 0;
    for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    const empty = length < 1e-9;
    const count = empty ? 0 : Math.ceil(length / frame.step) + 1;
    if (count > MAX_STATIONS)
      throw new Error(`Path ${path.id} would need ${count} brush stations (length ${Math.round(length)} at step ${frame.step}); the limit is ${MAX_STATIONS}. Raise the path step`);
    const stations: Point[] = [], arcs: number[] = [], angles: number[] = [], pressure: number[] = [];
    if (!empty) {
      const sampled = resamplePolyline2D({ points, closed: false, count, maxWork: points.length + count });
      const phase = unit(path.seed, path.id, "press");
      const n = sampled.points.length;
      let previous = Math.atan2(sampled.points[1][1] - sampled.points[0][1], sampled.points[1][0] - sampled.points[0][0]);
      for (let i = 0; i < n; i++) {
        const [x, y] = sampled.points[i];
        // Central chord across the neighbours: a corner turns the frame through its bisector. The ends use
        // second-order one-sided differences (a first-order end tangent lags the true direction on a curve).
        const p = sampled.points;
        let dx = p[Math.min(n - 1, i + 1)][0] - p[Math.max(0, i - 1)][0], dy = p[Math.min(n - 1, i + 1)][1] - p[Math.max(0, i - 1)][1];
        if (n >= 3 && i === 0) { dx = 4 * p[1][0] - 3 * p[0][0] - p[2][0]; dy = 4 * p[1][1] - 3 * p[0][1] - p[2][1]; }
        if (n >= 3 && i === n - 1) { dx = 3 * p[n - 1][0] - 4 * p[n - 2][0] + p[n - 3][0]; dy = 3 * p[n - 1][1] - 4 * p[n - 2][1] + p[n - 3][1]; }
        // A hairpin folds the chord to nothing; the incoming direction is kept.
        if (Math.hypot(dx, dy) > 1e-9 * Math.max(1, length)) previous = Math.atan2(dy, dx);
        stations.push(Object.freeze([x, y] as const));
        arcs.push(sampled.distances[i]);
        angles.push(previous);
        pressure.push(Math.min(1, Math.max(0, profilePressure(frame.pressure, sampled.distances[i] / length, phase))));
      }
    }
    return Object.freeze({ id: path.id, seed: path.seed, points: Object.freeze(stations), closed: false, level: path.level, levelFraction: path.levelFraction,
      ...(path.tone === undefined ? {} : { tone: path.tone }),
      arcs: Object.freeze(arcs), angles: Object.freeze(angles), pressure: Object.freeze(pressure), trackLength: empty ? 0 : length });
  });
}

// ---------------------------------------------------------------------------------------------------
// The brush: correlated contact state along a track.

export const tipShapes = ["blunt", "round", "pointed", "dragged"] as const;
export type TipShape = (typeof tipShapes)[number];
export const brushHolds = ["path", "canvas"] as const;
export type BrushHold = (typeof brushHolds)[number];

export interface BristleOptions {
  /** Number of hairs across the brush. */
  hairs: number;
  /** Brush width in canvas units at pressure factor 1. */
  width: number;
  map: PressureMap;
  /** 0: every hair touches whatever the pressure; 1: light pressure lifts most hairs. */
  dryness: number;
  /** 0: hairs never run out; 1: hairs run dry from the start of the stroke to about 85% of it, at stable different points. */
  depletion: number;
  /** Lateral waver of each hair as a fraction of the half width. */
  wander: number;
  /**
   * Hair layout and correlation. `bias` (-1 edge-heavy .. 1 centre-heavy) reshapes the density across the
   * brush; `tufts` bundles hairs into that many neighbouring groups, `clumping` squeezes each group's hairs
   * toward its centre (gaps open between groups) and `cohesion` shares each group's contact, depletion and
   * waver state among its hairs (groups lift together). All zero: evenly stratified, independent hairs.
   */
  distribution?: { bias: number; tufts: number; clumping: number; cohesion: number };
  /** `path`: the cross-section is square to the path, turned by `tilt` degrees, and carried on its frame. `canvas`: it keeps one canvas angle (`tilt` from the x axis), as a chisel nib does. */
  hold?: { mode: BrushHold; tilt: number };
  /** Width taper at both ends over `length` canvas units (`dragged`: blunt entry, tapering exit). */
  tip?: { shape: TipShape; length: number };
  /** Canvas units of path over which hairs first meet the paper (ragged entry). Default `ATTACK`. */
  attack?: number;
  /** Canvas units before the path's end over which hairs leave the paper. Default 0. */
  release?: number;
  /** A paper tooth shared by every stroke: hairs on light pressure skip where the tooth is low. `grain` is the tooth size in canvas units. */
  paper?: { seed: number; strength: number; grain: number };
}

interface Normalized {
  hairs: number; width: number; map: PressureMap; dryness: number; depletion: number; wander: number;
  bias: number; tufts: number; clumping: number; cohesion: number; hold: BrushHold; tilt: number;
  tip: TipShape; tipLength: number; attack: number; release: number; paper: { seed: number; strength: number; grain: number } | null;
}

function normalize(options: BristleOptions): Normalized {
  if (!Number.isInteger(options.hairs) || options.hairs < 1 || options.hairs > 400) throw new Error("Bristle hairs must be an integer in [1, 400]");
  range("brush width", options.width, 0, 2000);
  checkMap(options.map);
  for (const [label, value] of [["dryness", options.dryness], ["depletion", options.depletion], ["wander", options.wander]] as const) range(`bristle ${label}`, value, 0, 1);
  const d = options.distribution ?? { bias: 0, tufts: 1, clumping: 0, cohesion: 0 };
  range("bristle bias", d.bias, -1, 1);
  if (!Number.isInteger(d.tufts) || d.tufts < 1 || d.tufts > 64) throw new Error("Bristle tufts must be an integer in [1, 64]");
  range("bristle clumping", d.clumping, 0, 1); range("bristle cohesion", d.cohesion, 0, 1);
  const hold = options.hold ?? { mode: "path" as BrushHold, tilt: 0 };
  if (!(brushHolds as readonly string[]).includes(hold.mode)) throw new Error(`Unknown brush hold: ${hold.mode}`);
  range("brush tilt", hold.tilt, -360, 360);
  const tip = options.tip ?? { shape: "blunt" as TipShape, length: 0 };
  if (!(tipShapes as readonly string[]).includes(tip.shape)) throw new Error(`Unknown tip shape: ${tip.shape}`);
  range("tip length", tip.length, 0, 5000);
  const attack = options.attack ?? ATTACK, release = options.release ?? 0;
  range("bristle attack", attack, 0, 5000); range("bristle release", release, 0, 5000);
  if (options.paper) { range("paper strength", options.paper.strength, 0, 2); range("paper grain", options.paper.grain, 0.5, 200); seedOf(options.paper.seed); }
  return { hairs: options.hairs, width: options.width, map: options.map, dryness: options.dryness, depletion: options.depletion, wander: options.wander,
    bias: d.bias, tufts: d.tufts, clumping: d.clumping, cohesion: d.cohesion, hold: hold.mode, tilt: hold.tilt,
    tip: tip.length > 0 ? tip.shape : "blunt", tipLength: tip.length, attack, release, paper: options.paper && options.paper.strength > 0 ? { ...options.paper } : null };
}

const paperFields = new Map<number, (x: number, y: number) => number>();
/**
 * The paper tooth at a canvas point in [0, 1]: two octaves of gradient noise (grain and about 0.43 of it),
 * stretched about 0.5 because raw gradient noise rarely leaves the middle. Depends on the seed and the
 * position only, so strokes that cross share it.
 */
export function paperTooth(seed: number, grain: number, x: number, y: number): number {
  let field = paperFields.get(seed);
  if (!field) {
    const fine = gradientNoise2D01({ seed: componentSeed(seed, "paper", "fine") }), coarse = gradientNoise2D01({ seed: componentSeed(seed, "paper", "coarse") });
    field = (u, v) => 0.65 * coarse.sample(u, v) + 0.35 * fine.sample(u * 2.3 + 17.1, v * 2.3 - 9.7);
    paperFields.set(seed, field);
    if (paperFields.size > 8) paperFields.delete(paperFields.keys().next().value!);
  }
  const raw = field(x / grain, y / grain);
  return Math.min(1, Math.max(0, 0.5 + (raw - 0.5) * 2.4));
}

/** A hair run: `hair` is the hair's index (0 at the left of the direction of travel), `tuft` its group, `shade` a stable draw in [0, 1). */
export interface BristleHair extends Path {
  readonly hair: number;
  readonly tuft: number;
  readonly shade: number;
}

/** Everything a consumer may read about one stroke. Frozen; identical for identical construction. */
export interface BristleContact {
  readonly track: BristleTrack;
  readonly hairs: readonly BristleHair[];
  /** Fraction of the hairs on the paper at each station, in [0, 1]. */
  readonly contact: readonly number[];
  /** Outline of the touched extent for each stretch of at least two touching stations: one side forward, the other back. Not necessarily simple on the inside of a tight turn. */
  readonly footprint: readonly (readonly Point[])[];
  /** Total canvas length of all hair runs. */
  readonly hairLength: number;
  /** Arc-weighted mean of `contact` over the stroke: the share of the brush's ink actually laid down. */
  readonly inkLoad: number;
  /** Touched span (distance between the outermost touching hairs) integrated along the path, canvas units squared. */
  readonly area: number;
}

const contactCache = new WeakMap<BristleTrack, Map<string, BristleContact>>();

/** Hair points (hairs x stations, summed over the paths of a family) must stay within `MAX_HAIR_POINTS`. `advice` names what a caller can change. */
export function checkBristleWork(total: number, paths = 1, advice = "Lower the hair count, raise the sampling spacing or narrow the window"): void {
  if (total > MAX_HAIR_POINTS)
    throw new Error(`Bristles would need ${total} hair points (hairs × stroke stations${paths > 1 ? ` over ${paths} paths` : ""}); the limit is ${MAX_HAIR_POINTS}. ${advice}`);
}

const tipAt = (shape: TipShape, distance: number, length: number): number => {
  if (shape === "blunt" || distance >= length) return 1;
  const s = Math.max(0, distance) / length;
  return shape === "round" ? Math.sqrt(1 - (1 - s) * (1 - s)) : s;
};

/**
 * Hair `k` of `n` sits at a stable offset `o` (a jittered stratified draw, then reshaped by `distribution`)
 * and follows the path at `o * halfWidth(p)` with `halfWidth = width * mapPressure(p) * taper(arc) / 2`, plus a
 * closed-form waver in the arc length. It touches at a station when the mapped pressure (moved by the paper
 * tooth at its position) reaches the threshold `dryness * (0.65 u + 0.35 |o|) * (0.55 + 0.9 g(arc))` (edge hairs lift
 * first; `g` is a per-hair streak, a sine of the path's own arc length), the stroke has not passed the hair's
 * depletion point, and the hair has met (and not yet left) the paper: `attack` and `release` are stable shares
 * of their lengths. On the inside of a turn the offset is limited to 90% of the local radius of curvature
 * (from the direction change between neighbouring stations), so the hairs bunch up rather than cross into a
 * fan; the side is fixed by the frame's normal, which never flips. Only runs of at least two touching stations
 * are published.
 */
export function bristleContact(track: BristleTrack, options: BristleOptions): BristleContact {
  const o = normalize(options);
  const n = track.points.length;
  checkBristleWork(o.hairs * n);
  const key = JSON.stringify(o);
  return cachedBy(contactCache, track, key, () => {
    const hairs: BristleHair[] = [];
    // Turning rate (radians per unit) at each station from the direction change between its neighbours; 0
    // where the hand rests. The end stations take their neighbour's (their own tangent is one-sided).
    const turning = track.points.map((_, i) => {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), ds = track.arcs[b] - track.arcs[a];
      if (ds < 1e-9) return 0;
      const change = track.angles[b] - track.angles[a];
      return Math.atan2(Math.sin(change), Math.cos(change)) / ds;
    });
    if (n > 2) { turning[0] = turning[1]; turning[n - 1] = turning[n - 2]; }
    const progress = (i: number) => track.trackLength > 0 ? track.arcs[i] / track.trackLength : 0;
    const clock = track.times ?? track.arcs;
    const tilt = o.tilt * Math.PI / 180;
    // In `path` hold the cross-section keeps a fixed angle to the frame (cosine constant); in `canvas` hold it varies with the direction.
    const frameCos = Math.cos(o.hold === "path" ? tilt : 0);
    const entryShape: TipShape = o.tip === "dragged" ? "blunt" : o.tip, exitShape: TipShape = o.tip === "dragged" ? "pointed" : o.tip;
    const count = new Float64Array(n), lowLat = new Float64Array(n).fill(Infinity), highLat = new Float64Array(n).fill(-Infinity);
    const lowX = new Float64Array(n), lowY = new Float64Array(n), highX = new Float64Array(n), highY = new Float64Array(n);
    let hairLength = 0;
    const exponent = o.bias === 0 ? 1 : 2 ** (o.bias * 1.5);
    for (let k = 0; k < o.hairs; k++) {
      const hair = `hair:${k}`;
      const stratum = (k + unit(track.seed, hair, "offset")) / o.hairs;
      const tuft = Math.min(o.tufts - 1, Math.floor(stratum * o.tufts));
      const group = `tuft:${tuft}`;
      let offset = stratum * 2 - 1;
      if (o.clumping > 0) offset += 0.9 * o.clumping * (((tuft + 0.5) / o.tufts) * 2 - 1 - offset);
      if (exponent !== 1) offset = Math.sign(offset) * Math.abs(offset) ** exponent;
      const draw = (purpose: string) => o.cohesion === 0 ? unit(track.seed, hair, purpose)
        : unit(track.seed, hair, purpose) * (1 - o.cohesion) + unit(track.seed, group, purpose) * o.cohesion;
      const threshold = 0.65 * draw("threshold") + 0.35 * Math.abs(offset);
      const runsOut = 1 - o.depletion * (0.15 + 0.85 * draw("depletion"));
      const streak = 22 + 78 * draw("streak"), streakPhase = TAU * draw("streakPhase");
      const waver = 60 + 140 * draw("waver"), waverPhase = TAU * draw("waverPhase");
      const attack = o.attack * draw("attack");
      const leaves = o.release > 0 ? track.trackLength - o.release * draw("release") : Infinity;
      let run: Point[] = [], start = 0, runLength = 0;
      const flush = () => {
        if (run.length >= 2) {
          const id = `${track.id}/${hair}@${start.toFixed(3)}`;
          hairs.push(Object.freeze({ id, seed: componentSeed(track.seed, id, "hair"), points: Object.freeze(run), closed: false, level: 0,
            levelFraction: (offset + 1) / 2, tone: 0, hair: k, tuft, shade: unit(track.seed, hair, "shade") }));
          hairLength += runLength;
        }
        run = []; runLength = 0;
      };
      for (let i = 0; i < n; i++) {
        const factor = mapPressure(track.pressure[i], o.map), arc = track.arcs[i];
        let gate = o.dryness * threshold * (0.55 + 0.9 * (0.5 + 0.5 * Math.sin(TAU * arc / streak + streakPhase)));
        if (factor < gate || progress(i) > runsOut || arc < attack || arc > leaves) { flush(); continue; }
        const half = o.width * (o.tip === "blunt" ? factor
          : factor * Math.min(tipAt(entryShape, arc, o.tipLength), tipAt(exitShape, track.trackLength - arc, o.tipLength))) / 2;
        let lateral = half * (offset + o.wander * 0.35 * Math.sin(TAU * arc / waver + waverPhase));
        const angle = track.angles[i], frame = o.hold === "path" ? angle + tilt : tilt - Math.PI / 2;
        const cosine = o.hold === "path" ? frameCos : Math.cos(frame - angle);
        // Inside a turn the offset is limited to 90% of the local radius of curvature, so hairs bunch up instead of crossing into a fan.
        const turn = turning[i];
        if (turn * (lateral * cosine) > 0 && Math.abs(lateral * cosine) * Math.abs(turn) > 0.9) lateral = Math.sign(lateral) * 0.9 / (Math.abs(turn) * Math.abs(cosine));
        const [px, py] = track.points[i];
        const x = px - Math.sin(frame) * lateral, y = py + Math.cos(frame) * lateral;
        if (o.paper) {
          gate = gate + o.paper.strength * (0.5 - paperTooth(o.paper.seed, o.paper.grain, x, y));
          if (factor < gate) { flush(); continue; }
        }
        if (run.length === 0) start = clock[i];
        else runLength += Math.hypot(x - run[run.length - 1][0], y - run[run.length - 1][1]);
        run.push(Object.freeze([x, y] as const));
        count[i]++;
        if (lateral < lowLat[i]) { lowLat[i] = lateral; lowX[i] = x; lowY[i] = y; }
        if (lateral > highLat[i]) { highLat[i] = lateral; highX[i] = x; highY[i] = y; }
      }
      flush();
    }
    // Footprint: the touched extent, one ring per stretch of touching stations.
    const footprint: (readonly Point[])[] = [];
    let first = -1;
    const close = (last: number) => {
      if (last <= first) return;
      const ring: Point[] = [];
      for (let i = first; i <= last; i++) ring.push(Object.freeze([highX[i], highY[i]] as const));
      for (let i = last; i >= first; i--) ring.push(Object.freeze([lowX[i], lowY[i]] as const));
      footprint.push(Object.freeze(ring));
    };
    for (let i = 0; i < n; i++) {
      if (count[i] > 0) { if (first < 0) first = i; }
      else { if (first >= 0) close(i - 1); first = -1; }
    }
    if (first >= 0) close(n - 1);
    let load = 0, area = 0;
    for (let i = 0; i < n; i++) {
      const weight = ((i < n - 1 ? track.arcs[i + 1] : track.arcs[i]) - (i > 0 ? track.arcs[i - 1] : track.arcs[i])) / 2;
      load += count[i] / o.hairs * weight;
      if (count[i] > 0) area += (highLat[i] - lowLat[i]) * weight;
    }
    const span = n > 1 ? track.arcs[n - 1] - track.arcs[0] : 0;
    return Object.freeze({ track, hairs: Object.freeze(hairs), contact: Object.freeze(Array.from(count, (c) => c / o.hairs)), footprint: Object.freeze(footprint),
      hairLength, inkLoad: span > 0 ? load / span : 0, area });
  });
}

/** The hair runs of a track: the published form of `bristleContact(track, options).hairs`. */
export function bristleBand(track: BristleTrack, options: BristleOptions): readonly BristleHair[] {
  return bristleContact(track, options).hairs;
}

/** A path read as a brush stroke: its track and the contact state of the brush along it. */
export function bristleStroke(path: Path, frame: BristleFrame, options: BristleOptions): BristleContact {
  return bristleContact(bristleTrack(path, frame), options);
}

/** The tracks and per-path options of a family, after the one work bound for all of it: nothing is expanded before this passes. */
export function planBristles(paths: readonly Path[], frame: BristleFrame, options: BristleOptions | ((path: Path) => BristleOptions),
  advice?: string): { tracks: readonly BristleTrack[]; options: readonly BristleOptions[] } {
  const tracks = paths.map((path) => bristleTrack(path, frame));
  const each = paths.map((path) => typeof options === "function" ? options(path) : options);
  let total = 0;
  tracks.forEach((track, index) => { total += each[index].hairs * track.points.length; });
  checkBristleWork(total, paths.length, advice);
  return { tracks, options: each };
}

/** A family of paths under one work bound. `options` may depend on the path (a stable per-path width, say). */
export function bristleStrokes(paths: readonly Path[], frame: BristleFrame, options: BristleOptions | ((path: Path) => BristleOptions)): readonly BristleContact[] {
  const plan = planBristles(paths, frame, options);
  return plan.tracks.map((track, index) => bristleContact(track, plan.options[index]));
}

// ---------------------------------------------------------------------------------------------------
// Consumers.

/** How a stroke is drawn. Appearance only: none of it reaches a producer. */
export interface BristleInk {
  /** Stroke width of each hair. */
  weight: number;
  /** Share of hairs (by stable `shade`) drawn in `mixTone`; 0 draws every hair in `inkTone`. */
  mix: number;
  inkTone: number;
  mixTone: number;
  /** Footprint wash opacity in [0, 1] drawn in `washTone` under the hairs; 0 draws none. */
  wash: number;
  washTone: number;
}

const hairSpec = (weight: number) => ({ kind: "ink", weight, spacing: 4, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
  mark: { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } }) as const;

/** Hairs as ink through the existing path material. With `mix` 0 the hairs' own tone (0) is used untouched. */
export function hairMaterial(ink: Pick<BristleInk, "weight" | "mix" | "inkTone" | "mixTone">, palette: readonly number[]): PathMaterial {
  const draw = pathMaterial(hairSpec(ink.weight), palette);
  if (ink.mix === 0 && ink.inkTone === 0) return draw;
  return (surface, path, run) => {
    const shade = (path as Partial<BristleHair>).shade ?? 0;
    return draw(surface, { ...path, tone: shade < ink.mix ? ink.mixTone : ink.inkTone }, run);
  };
}

/** The footprint wash of one stroke: the touched extent tinted with `ink.washTone`. Nothing when the wash is 0. */
export function drawFootprint(surface: CompositionSurface, stroke: BristleContact, ink: Pick<BristleInk, "wash" | "washTone">, palette: readonly number[], run: CompositionRun): void {
  if (!(ink.wash > 0) || stroke.footprint.length === 0) return;
  run.enter(stroke.footprint.length);
  try {
    surface.push();
    try {
      surface.noStroke(); color(surface, palette, ink.washTone, 255 * ink.wash, true);
      for (const ring of stroke.footprint) {
        surface.beginShape();
        for (const [x, y] of ring) surface.vertex(x, y);
        surface.endShape(surface.CLOSE);
      }
    } finally { surface.pop(); }
  } finally { run.leave(); }
}

/** Draw one stroke into a caller-owned surface: the footprint wash, then the hairs. */
export function drawBristleStroke(surface: CompositionSurface, stroke: BristleContact, ink: BristleInk, palette: readonly number[],
  run: CompositionRun, hair: PathMaterial = hairMaterial(ink, palette)): void {
  drawFootprint(surface, stroke, ink, palette, run);
  strokeWith(surface, stroke.hairs, hair, run);
}

export interface BristleMaterialSpec {
  /** Used for paths that carry no frame of their own. */
  frame: BristleFrame;
  brush: BristleOptions;
  ink: BristleInk;
}

/** Any path as a bristle stroke. The stroke is the cached `bristleStroke(path, ...)`, so a producer and this material share it. */
export function bristleMaterial(spec: BristleMaterialSpec, palette: readonly number[]): PathMaterial {
  const hair = hairMaterial(spec.ink, palette);
  return (surface, path, run) => drawBristleStroke(surface, bristleStroke(path, spec.frame, spec.brush), spec.ink, palette, run, hair);
}
