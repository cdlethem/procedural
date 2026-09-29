import { harmonicTraceCurves } from "../adapters/harmonic-traces.js";
import { componentSeed } from "./core.js";
import { unit } from "./bristle.js";
import { gesturePath } from "./gesture.js";
import { bundledRecording, bundledRecordingIds } from "./recording-samples.js";
import type { BundledRecordingId } from "./recording-samples.js";
import { gestureTrack } from "./recording.js";
import { contourPaths } from "./sources.js";
import type { ContourOptions, Path, Point } from "./types.js";

/**
 * Source paths for a brush. Every source returns a frozen `Path[]` with stable ids, cached by its
 * construction (seed and source description; never brush, ink or line choices), so the path a brush
 * reads is the same object whatever the brush does. A bundled source is a deterministic stand-in for
 * a host's own paths; `{kind: "paths"}` accepts caller-resolved geometry (a traced image, another
 * instrument's paths) as plain data. The library never fetches or decodes: binding a user's own
 * geometry to a saved instrument is host work (instruments persist only a technique id, scalar
 * params and a palette, and so name a bundled source).
 *
 * - `traces`: phase-shifted copies of a sum of decaying-free axis oscillators, sampled by the
 *   existing Harmonic Traces computation. `figure` is the `a:b` frequency ratio of the two main
 *   terms; two small terms at `2a+1` and `2b+1` cycles add a second harmonic layer. The seed sets the
 *   phases and the small terms' amplitude, so it changes the figure's topology, not its noise.
 *   Ids `trace:<i>`; `levelFraction` `i / (count - 1)`. Open paths (a closed figure starts and ends at
 *   one point).
 * - `contours`: the existing sampled contour construction (`contourPaths`) over a footprint of
 *   `474 x 460` scaled by `frame.scale`. Ids are the contour ids.
 * - `scribble`: a bundled recording replayed by `gesturePath` (arc stations 3 units apart, speed
 *   pressure), cut into strokes where the hand turns hardest: the next cut is the sharpest bend
 *   (turning over 24 units of arc) between `strokeLength` and `1.6 x strokeLength` past the last one,
 *   while at least `2.1 x strokeLength` of path remains; every stroke is then `strokeLength` to
 *   `1.6 x strokeLength` long except the last (0.5 to 2.1 x). Ids `<recording id>/stroke:<k>`.
 * - `paths`: `PathData` validated and frozen. Ids must be unique; every path needs two finite points.
 *
 * Units and limits. Canvas units; angles in degrees. Data: 1,000 paths, 200,000 points, coordinates
 * within +-1e6.
 */
export interface SourceFrame { centerX: number; centerY: number; scale: number; rotation: number }
export const traceFigures = ["3:2", "5:4", "4:3", "2:1", "5:3", "7:4"] as const;
export type TraceFigure = (typeof traceFigures)[number];
export const contourFields = ["noise", "hills", "waves", "saddle"] as const;
export interface PathData { id: string; points: readonly (readonly [number, number])[]; closed?: boolean }
export type BristleSource =
  | { kind: "traces"; figure: TraceFigure; count: number; spread: number; frame: SourceFrame }
  | { kind: "contours"; field: ContourOptions["source"]; frequency: number; levels: number; interval: number; frame: SourceFrame }
  | { kind: "scribble"; recording: BundledRecordingId; strokeLength: number; frame: SourceFrame }
  | { kind: "paths"; paths: readonly PathData[] };

export const MAX_SOURCE_PATHS = 1_000;
export const MAX_SOURCE_POINTS = 200_000;
const cache = new Map<string, readonly Path[]>();

const freeze = (id: string, seed: number, points: readonly Point[], closed: boolean, levelFraction: number, level = 0): Path =>
  Object.freeze({ id, seed: componentSeed(seed, id, "path"), points: Object.freeze(points), closed, level, levelFraction });

function checkFrame(frame: SourceFrame): void {
  for (const [label, value, low, high] of [["center X", frame.centerX, -1e5, 1e5], ["center Y", frame.centerY, -1e5, 1e5], ["scale", frame.scale, 0.01, 100], ["rotation", frame.rotation, -3600, 3600]] as const)
    if (!Number.isFinite(value) || value < low || value > high) throw new Error(`Source ${label} must be a finite number in [${low}, ${high}]`);
}

function traces(seed: number, source: Extract<BristleSource, { kind: "traces" }>): Path[] {
  if (!(traceFigures as readonly string[]).includes(source.figure)) throw new Error(`Unknown trace figure: ${source.figure}`);
  if (!Number.isInteger(source.count) || source.count < 1 || source.count > 16) throw new Error("Trace count must be an integer in [1, 16]");
  const [a, b] = source.figure.split(":").map(Number);
  const u = (purpose: string) => unit(seed, "traces", purpose);
  const amplitude = 205 * source.frame.scale, small = amplitude * (0.16 + 0.3 * u("small"));
  const terms = [`x, ${amplitude}, ${a}, ${Math.round(360 * u("phase-x"))}, 0`, `y, ${amplitude}, ${b}, ${Math.round(360 * u("phase-y"))}, 0`,
    `x, ${small}, ${2 * a + 1}, ${Math.round(360 * u("phase-sx"))}, 0`, `y, ${small}, ${2 * b + 1}, ${Math.round(360 * u("phase-sy"))}, 0`].join("\n");
  const curves = harmonicTraceCurves({ terms, timeStart: 0, duration: 1, samples: 1200, traces: source.count, phaseStride: source.spread,
    centerX: source.frame.centerX, centerY: source.frame.centerY, rotation: source.frame.rotation, material: "line", spacing: 10, markSize: 0, weight: 1 });
  return curves.map((curve, i) => freeze(`trace:${i}`, seed, curve.map(([x, y]) => Object.freeze([x, y] as const)), false, source.count > 1 ? i / (source.count - 1) : 0));
}

function contours(seed: number, source: Extract<BristleSource, { kind: "contours" }>): readonly Path[] {
  return contourPaths({ seed, source: source.field, width: 474 * source.frame.scale, height: 460 * source.frame.scale, centerX: source.frame.centerX,
    centerY: source.frame.centerY, resolution: 54, frequency: source.frequency, aspect: 1.5, hillCount: 5, hillRadius: 0.23, levelBase: -0.55,
    levelStep: source.interval, levels: source.levels, rotation: source.frame.rotation });
}

/** Strokes of a replayed recording, cut at the hand's sharpest bends. */
function scribble(seed: number, source: Extract<BristleSource, { kind: "scribble" }>): Path[] {
  if (!(bundledRecordingIds as readonly string[]).includes(source.recording)) throw new Error(`Unknown bundled recording: ${source.recording}`);
  if (!Number.isFinite(source.strokeLength) || source.strokeLength < 20 || source.strokeLength > 5000) throw new Error("Stroke length must be a finite number in [20, 5000]");
  const recording = bundledRecording(source.recording, seed);
  const track = gestureTrack(recording, { smoothing: 25, frame: source.frame });
  const path = gesturePath(track, { seed, sampling: { kind: "arc", spacing: 3 }, window: { start: 0, end: recording.duration },
    pressure: { source: "speed", whenAbsent: "speed", level: 0.5 } });
  const { points, arcs } = path, n = points.length, reach = 24;
  const turning = new Array<number>(n).fill(0);
  for (let i = 0, before = 0, after = 0; i < n; i++) {
    while (arcs[i] - arcs[before] > reach) before++;
    while (after < n - 1 && arcs[after] - arcs[i] < reach) after++;
    if (before === i || after === i) continue;
    const change = Math.atan2(points[after][1] - points[i][1], points[after][0] - points[i][0]) - Math.atan2(points[i][1] - points[before][1], points[i][0] - points[before][0]);
    turning[i] = Math.abs(Math.atan2(Math.sin(change), Math.cos(change)));
  }
  const cuts = [0];
  for (let last = 0; ;) {
    const from = arcs[last] + source.strokeLength, to = arcs[last] + 1.6 * source.strokeLength;
    if (arcs[n - 1] - arcs[last] < 2.1 * source.strokeLength) break;
    let best = -1;
    for (let i = last + 1; i < n && arcs[i] <= to; i++) if (arcs[i] >= from && (best < 0 || turning[i] > turning[best])) best = i;
    if (best < 0) break;
    cuts.push(best); last = best;
  }
  cuts.push(n - 1);
  const strokes: Path[] = [];
  for (let k = 0; k + 1 < cuts.length; k++)
    strokes.push(freeze(`${path.id}/stroke:${k}`, seed, points.slice(cuts[k], cuts[k + 1] + 1), false, cuts.length > 2 ? k / (cuts.length - 2) : 0));
  return strokes;
}

/** Validate and freeze caller-resolved paths. Seeds are `componentSeed(seed, id, "path")`. */
export function pathSet(data: readonly PathData[], seed: number): readonly Path[] {
  if (!Array.isArray(data) || data.length === 0 || data.length > MAX_SOURCE_PATHS) throw new Error(`Path data must hold 1 to ${MAX_SOURCE_PATHS} paths`);
  const ids = new Set<string>();
  let points = 0;
  const paths = data.map((item, index) => {
    if (typeof item?.id !== "string" || item.id.length === 0) throw new Error(`Path ${index} needs a non-empty id`);
    if (ids.has(item.id)) throw new Error(`Duplicate path id: ${item.id}`);
    ids.add(item.id);
    const given: PathData["points"] = item.points;
    if (!Array.isArray(given) || given.length < 2) throw new Error(`Path ${item.id} needs at least two points`);
    points += given.length;
    if (points > MAX_SOURCE_POINTS) throw new Error(`Path data holds more than ${MAX_SOURCE_POINTS} points`);
    const copy = given.map((point, at) => {
      if (!Array.isArray(point) || point.length !== 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || Math.abs(point[0]) > 1e6 || Math.abs(point[1]) > 1e6)
        throw new Error(`Path ${item.id} point ${at} must be two finite coordinates within ±1e6`);
      return Object.freeze([point[0], point[1]] as const);
    });
    return freeze(item.id, seed, copy, item.closed === true, data.length > 1 ? index / (data.length - 1) : 0);
  });
  return Object.freeze(paths);
}

/** The frozen paths of a source; cached by construction. */
export function bristleSourcePaths(seed: number, source: BristleSource): readonly Path[] {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Source seed must be a uint32 integer");
  if (source.kind !== "paths") checkFrame(source.frame);
  const key = JSON.stringify([seed, source]);
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  let made: readonly Path[];
  switch (source.kind) {
    case "traces": made = Object.freeze(traces(seed, source)); break;
    case "contours": made = contours(seed, source); break;
    case "scribble": made = Object.freeze(scribble(seed, source)); break;
    case "paths": made = pathSet(source.paths, seed); break;
    default: throw new Error(`Unknown bristle source: ${(source as { kind: string }).kind}`);
  }
  cache.set(key, made);
  if (cache.size > 12) cache.delete(cache.keys().next().value!);
  return made;
}
