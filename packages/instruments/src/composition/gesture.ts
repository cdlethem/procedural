import { componentSeed } from "./core.js";
import { checkWindow, gridRange, resolvePressure, stations, TrackCursor } from "./recording.js";
import type { GestureTrack, PressurePolicy, PressureSource, StationRule, TimeWindow } from "./recording.js";
import type { Path, Point, Site } from "./types.js";
import { cachedBy, checkMap, mapPressure, range, seedOf, unit } from "./bristle.js";
import type { PressureMap } from "./bristle.js";

/**
 * Consumers-ready values derived from one `GestureTrack` (see `recording.ts` for the recording,
 * reconstruction, smoothing, frame, window and station semantics). Every producer here returns a
 * frozen value cached by its construction; none of them stores palette, material or mark.
 *
 * - `gesturePath(track, ...)`: the stroke as one `Path` (so any `pathMaterial` strokes it) plus
 *   per-point time, arc, direction, speed and resolved pressure. Its points are the window's two
 *   end points and the stations of the sampling rule between them.
 * - `bristleBand(path, ...)` (in `bristle.ts`, which reads any path as a brush): a `GesturePath` carries
 *   its own pressure, arc and direction channels, so the brush uses them as given.
 * - `sandGrains(track, ...)`: grains released on a fixed clock from the recording start, delayed
 *   by a stable random lag during which they fall and carry a share of the hand's velocity.
 * - `gestureSites(track, ...)`: oriented sites at the stations of a rule, for any mark.
 *
 * The time window is applied by every producer to the same track, and all grids are anchored at
 * the recording start, so narrowing the window keeps each surviving station, grain and glyph at
 * the same place with the same id. Bristle runs are keyed by their start time; a run the window
 * cuts is a new run. Path point sets differ between windows only by their end points.
 *
 * Ids. Path `<track id>`; hair runs `<track id>/hair:<k>@<start ms>`; grains
 * `<track id>/grain:<j>` (j counts `1000 / rate` ms ticks from the start); glyphs
 * `<track id>/glyph:t<k>` (time rule) or `glyph:s<k>` (arc rule). Seeds are
 * `componentSeed(seed, id, purpose)`. Repetitions have their own track id, hence their own
 * ids and streams.
 *
 * Units and limits. Lengths canvas units, time ms, speed units per second, option angles degrees
 * and published angles radians. Stations are limited by `recording.ts` (60,000 per rule); hair
 * points (hairs x stations, see `bristle.ts`) to 600,000, grains to 60,000. Over a limit the producer throws a
 * message naming the control to change; nothing is truncated.
 */

const TAU = Math.PI * 2;
export const MAX_GRAINS = 60_000;

export interface GesturePathOptions {
  seed: number;
  sampling: StationRule;
  window: TimeWindow;
  pressure: PressurePolicy;
}
/** The stroke as a `Path` with per-point channels. All arrays have one entry per point. */
export interface GesturePath extends Path {
  /** Milliseconds from the recording start. */
  readonly times: readonly number[];
  /** Path length from the recording start, in canvas units (not from the window). */
  readonly arcs: readonly number[];
  /** Direction of travel, radians. */
  readonly angles: readonly number[];
  /** Canvas units per second. */
  readonly speeds: readonly number[];
  /** Resolved pressure in [0, 1]. */
  readonly pressure: readonly number[];
  /** What actually supplied the pressure. */
  readonly pressureSource: PressureSource;
  readonly window: readonly [number, number];
  /** Length of the whole track, the scale that ink depletion is measured against. */
  readonly trackLength: number;
}

const pathCache = new WeakMap<GestureTrack, Map<string, GesturePath>>();

export function gesturePath(track: GestureTrack, options: GesturePathOptions): GesturePath {
  seedOf(options.seed);
  const window = checkWindow(track, options.window);
  const key = JSON.stringify([options.seed, options.sampling, window, options.pressure]);
  return cachedBy(pathCache, track, key, () => {
    const pressure = resolvePressure(track, options.pressure);
    const moments = stations(track, options.sampling, window, "The stroke");
    const times = [window.start];
    for (const time of moments.times) if (time > window.start + 1e-6 && time < window.end - 1e-6) times.push(time);
    times.push(window.end);
    const cursor = new TrackCursor(track, pressure.values);
    const points: Point[] = [], arcs: number[] = [], angles: number[] = [], speeds: number[] = [], levels: number[] = [];
    for (const time of times) {
      cursor.at(time);
      points.push(Object.freeze([cursor.x, cursor.y] as const));
      arcs.push(cursor.arc); angles.push(Math.atan2(cursor.ty, cursor.tx)); speeds.push(cursor.speed); levels.push(cursor.pressure);
    }
    const id = track.id;
    return Object.freeze({ id, seed: componentSeed(options.seed, id, "path"), points: Object.freeze(points), closed: false, level: 0, levelFraction: 0,
      times: Object.freeze(times), arcs: Object.freeze(arcs), angles: Object.freeze(angles), speeds: Object.freeze(speeds),
      pressure: Object.freeze(levels), pressureSource: pressure.source, window: Object.freeze([window.start, window.end] as const),
      trackLength: track.length });
  });
}


/** A site with the moment of the gesture it belongs to. */
export interface GestureSite extends Site {
  /** Milliseconds from the recording start at which the mark was placed or released. */
  readonly time: number;
  /** Resolved pressure at that moment. */
  readonly pressure: number;
  /** Arc length of the hand at that moment. */
  readonly arc: number;
}

export interface SandOptions {
  seed: number;
  window: TimeWindow;
  pressure: PressurePolicy;
  map: PressureMap;
  /** Grains released per second of recorded time. */
  rate: number;
  /** Longest fall delay in ms; each grain draws a stable fraction of it. */
  lag: number;
  /** Fall speed in canvas units per second, in direction `fallAngle`. */
  fall: number;
  /** Degrees; 90 falls toward the bottom of the canvas. */
  fallAngle: number;
  /** Share of the hand's velocity a grain keeps while it falls. */
  inherit: number;
  /** Standard deviation of the isotropic landing scatter, canvas units. */
  spread: number;
  /** 0: every release is kept; 1: release probability equals the mapped pressure. */
  gate: number;
}

const sandCache = new WeakMap<GestureTrack, Map<string, readonly GestureSite[]>>();

/**
 * Grain `j` is released at `t = j * 1000 / rate` ms from the recording start (a fixed clock, so
 * slow or resting hands release more per unit length) from the hand's position `P(t)`. It is kept
 * when a stable draw is below `(1 - gate) + gate * mapPressure(p(t))`. After a stable delay
 * `d = lag * u` it lands at `P(t) + (inherit * V(t) + F) * d + scatter`, `V` the hand's velocity
 * and `F` the fall velocity, so lag zero puts grains on the stroke and more lag carries them
 * along and down. The grain's frame points along `inherit * V + F` (the hand's direction when
 * both vanish). Grains released inside the window may land outside it.
 */
export function sandGrains(track: GestureTrack, options: SandOptions): readonly GestureSite[] {
  seedOf(options.seed);
  const window = checkWindow(track, options.window);
  checkMap(options.map);
  range("sand rate", options.rate, 0.01, 100_000); range("sand lag", options.lag, 0, 60_000);
  range("sand fall", options.fall, 0, 100_000); range("sand fall angle", options.fallAngle, -1e6, 1e6);
  range("sand inherit", options.inherit, 0, 4); range("sand spread", options.spread, 0, 5000); range("sand gate", options.gate, 0, 1);
  const period = 1000 / options.rate;
  const [first, last] = gridRange(window.start, window.end, period);
  const count = Math.max(0, last - first + 1);
  if (count > MAX_GRAINS)
    throw new Error(`Sand would release ${count} grains; the limit is ${MAX_GRAINS}. Lower the release rate or narrow the window`);
  const key = JSON.stringify([options.seed, window, options.pressure, options.map, options.rate, options.lag, options.fall, options.fallAngle, options.inherit, options.spread, options.gate]);
  return cachedBy(sandCache, track, key, () => {
    const cursor = new TrackCursor(track, resolvePressure(track, options.pressure).values);
    const fallX = options.fall * Math.cos(options.fallAngle * Math.PI / 180), fallY = options.fall * Math.sin(options.fallAngle * Math.PI / 180);
    const grains: GestureSite[] = [];
    for (let j = first; j <= last; j++) {
      const time = Math.min(Math.max(j * period, window.start), window.end);
      const id = `${track.id}/grain:${j}`, seed = componentSeed(options.seed, id, "grain");
      cursor.at(time);
      const share = (1 - options.gate) + options.gate * mapPressure(cursor.pressure, options.map);
      if (unit(seed, id, "keep") >= share) continue;
      const delay = options.lag * unit(seed, id, "lag") / 1000;
      const vx = options.inherit * cursor.speed * cursor.tx + fallX, vy = options.inherit * cursor.speed * cursor.ty + fallY;
      const radius = options.spread * Math.sqrt(-2 * Math.log(1 - unit(seed, id, "radius"))), around = TAU * unit(seed, id, "around");
      grains.push(Object.freeze({ id, seed, time, pressure: cursor.pressure, arc: cursor.arc,
        position: Object.freeze([cursor.x + vx * delay + radius * Math.cos(around), cursor.y + vy * delay + radius * Math.sin(around)] as const),
        angle: Math.hypot(vx, vy) > 1e-9 ? Math.atan2(vy, vx) : Math.atan2(cursor.ty, cursor.tx), scale: 1, tone: 1 }));
    }
    return Object.freeze(grains);
  });
}

export interface GestureSiteOptions {
  seed: number;
  window: TimeWindow;
  sampling: StationRule;
  pressure: PressurePolicy;
  map: PressureMap;
  /** 0 keeps every frame upright (angle 0); 1 turns it along the direction of travel; between blends along the shortest arc. */
  follow: number;
  /** How much a site's scale follows the mapped pressure: `1 - amount + amount * mapPressure(p)`. */
  sizeFollow: number;
  /** Signed distance along the normal `(-ty, tx)`: positive is to the right of the direction of travel as seen on the canvas (y points down), canvas units. */
  offset: number;
}

const siteCache = new WeakMap<GestureTrack, Map<string, readonly GestureSite[]>>();

/** Sites at the stations of a rule: at the hand's position moved by `offset`, framed by the direction of travel. */
export function gestureSites(track: GestureTrack, options: GestureSiteOptions): readonly GestureSite[] {
  seedOf(options.seed);
  const window = checkWindow(track, options.window);
  checkMap(options.map);
  range("glyph follow", options.follow, 0, 1); range("glyph size follow", options.sizeFollow, 0, 1); range("glyph offset", options.offset, -5000, 5000);
  const key = JSON.stringify([options.seed, window, options.sampling, options.pressure, options.map, options.follow, options.sizeFollow, options.offset]);
  return cachedBy(siteCache, track, key, () => {
    const moments = stations(track, options.sampling, window, "Glyphs");
    const cursor = new TrackCursor(track, resolvePressure(track, options.pressure).values);
    const letter = options.sampling.kind === "time" ? "t" : "s";
    const sites: GestureSite[] = [];
    moments.times.forEach((time, index) => {
      cursor.at(time);
      const id = `${track.id}/glyph:${letter}${moments.indices[index]}`;
      const heading = Math.atan2(cursor.ty, cursor.tx);
      sites.push(Object.freeze({ id, seed: componentSeed(options.seed, id, "glyph"), time, pressure: cursor.pressure, arc: cursor.arc,
        position: Object.freeze([cursor.x - cursor.ty * options.offset, cursor.y + cursor.tx * options.offset] as const),
        angle: options.follow * heading,
        scale: Math.max(0.02, 1 - options.sizeFollow + options.sizeFollow * mapPressure(cursor.pressure, options.map)), tone: 2 }));
    });
    return Object.freeze(sites);
  });
}
