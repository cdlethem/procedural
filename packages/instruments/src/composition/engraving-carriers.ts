import { componentSeed } from "./core.js";
import { IMAGE_STRUCTURE_LIMITS, orientationAt, orientationField } from "./image-structure.js";
import type { OrientationField } from "./image-structure.js";
import type { ToneField } from "./engraving-tone.js";

/**
 * Scan carriers: the unmodulated centre lines of an engraving, in the footprint's LOCAL frame (origin at the
 * footprint centre, x right, y down, canvas units; angles in degrees at the option boundary, radians published).
 *
 * A carrier is an arc-length parameterised polyline (`x`, `y`, cumulative `s`, `length`). Families:
 *
 * - `straight`: parallel lines at `angle` (0 = along +x, positive clockwise on screen). Line `k` (any integer, 0 through
 *   the footprint centre) lies at perpendicular offset `k * spacing` from it. Enlarging the footprint adds lines at
 *   its edge and never renames or moves the others.
 * - `curved`: the same lines, all sheared by one sine, `bend * sin(2 pi a / bendLength)` along the normal, where `a` is
 *   the position along the line: parallel wavy carriers that never cross.
 * - `rings`: concentric circles about `radial` (a point given as fractions of the footprint size from its centre);
 *   ring `j` (>= 1) has radius `j * spacing`. Rings smaller than radius 6 are omitted (see the limit note below).
 *   A ring is a CLOSED carrier whose last vertex repeats its first.
 * - `spiral`: one Archimedean spiral about `radial`, radius advancing `spacing` per turn, from the centre outward.
 * - `flow`: streamlines of the image's orientation field, evenly spaced (Jobard and Lefer 1997). The direction at a
 *   point blends the local level-line direction with the scan `angle`: in doubled-angle vector form
 *   `c * (cos 2 t, sin 2 t) + (1 - c) * (cos 2 angle, sin 2 angle)` with `c = follow * coherence`, so flat or
 *   incoherent places (and `follow = 0`) continue in the scan angle and directions never flip. Streamlines are
 *   integrated by the midpoint rule with step 1.5, seeded at a point derived from the seed, then from candidate
 *   points one local spacing to either side of accepted lines (first in, first out), and stop when they come within
 *   half a local spacing of another line, leave the footprint's bounding rectangle (plus one spacing), or meet
 *   their own earlier course. Lines shorter than one spacing are removed. Ids `flow:n` are creation order.
 *
 * Tone-driven spacing. With `spacingGain` g > 0 the gap between neighbours becomes `spacing * (1 - g * tau)`, where
 * `tau` is the shaped tone at the line being left (dark crowds lines). For `straight`, `curved` and `rings` the next line is
 * the previous one advanced along the fixed normal (or radius) by that gap at every station, so lines never cross;
 * for `spiral` the same gap is the radial advance per turn; for `flow` it is the local separation distance. With
 * g = 0 the lines sit at exactly `k * spacing` and tone is not consulted.
 *
 * Extent. Straight and curved lines cover the projection of the footprint plus a pad of `PAD_SPACINGS` spacings and the
 * bend; rings and the spiral reach the farthest footprint corner plus the same pad. Lines are not trimmed here.
 *
 * Limits (each names the control to change): at most `MAX_LINES` carriers and `MAX_STATIONS` stations in all.
 * Rings smaller than radius 6 are not emitted so that a ring is long enough for its phase to close (engraving.ts).
 */
export const STATION = 1.5;
export const PAD_SPACINGS = 4;
export const MAX_LINES = 6000;
export const MAX_STATIONS = 1_000_000;
export const RING_MIN_RADIUS = 6;
export const carrierFamilies = ["straight", "curved", "rings", "spiral", "flow"] as const;
export type CarrierFamily = (typeof carrierFamilies)[number];

export interface Carrier {
  /** `straight:k`, `curved:k`, `ring:j`, `spiral:0` or `flow:n`. */
  readonly id: string;
  /** k, j or n: the family index. */
  readonly index: number;
  readonly x: readonly number[];
  readonly y: readonly number[];
  /** Cumulative arc length at each vertex; `s[0] = 0`, `s[last] = length`. */
  readonly s: readonly number[];
  readonly length: number;
  readonly closed: boolean;
}

export interface CarrierOptions {
  family: CarrierFamily;
  /** Gap between neighbouring lines, canvas units, 1..200. */
  spacing: number;
  /** Tone-driven spacing, 0..0.9 (0: constant). */
  spacingGain: number;
  /** Scan angle in degrees (straight, curved, flow). */
  angle: number;
  /** Sine bend amplitude (canvas units) and wavelength (curved). */
  bend: number;
  bendLength: number;
  /** Radial centre as a fraction of the footprint size from its centre (rings, spiral). */
  radialX: number;
  radialY: number;
  /** Flow only: how strongly lines follow the image's orientation, 0..1, and the orientation smoothing length. */
  follow: number;
  flowSmoothing: number;
  /** Flow only: derives the seed point. */
  seed: number;
}

/** The shaped tone tau in [0, 1] at a local point; required when `spacingGain > 0` or for flow. */
export type TauAt = (x: number, y: number) => number;

const freezeCarrier = (id: string, index: number, xs: number[], ys: number[], closed: boolean): Carrier => {
  const s = new Array<number>(xs.length);
  s[0] = 0;
  for (let i = 1; i < xs.length; i++) s[i] = s[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  return Object.freeze({ id, index, x: Object.freeze(xs), y: Object.freeze(ys), s: Object.freeze(s), length: s[s.length - 1], closed });
};

interface Budget { lines: number; stations: number }
function charge(budget: Budget, stations: number, spacing: number): void {
  budget.lines++; budget.stations += stations;
  if (budget.lines > MAX_LINES) throw new Error(`Engraving needs more than ${MAX_LINES} lines; raise the line spacing or shrink the footprint`);
  if (budget.stations > MAX_STATIONS) throw new Error(`Engraving needs more than ${MAX_STATIONS} carrier stations at spacing ${spacing}; raise the line spacing or shrink the footprint`);
}

function corners(width: number, height: number): [number, number][] {
  const hw = width / 2, hh = height / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
}
const gap = (spacing: number, gain: number, tau: number): number => spacing * (1 - gain * tau);

function ruledCarriers(o: CarrierOptions, width: number, height: number, tau: TauAt | null): Carrier[] {
  const a = (o.angle * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  let aMin = Infinity, aMax = -Infinity, uMin = Infinity, uMax = -Infinity;
  for (const [x, y] of corners(width, height)) {
    const p = x * dx + y * dy, q = x * nx + y * ny;
    aMin = Math.min(aMin, p); aMax = Math.max(aMax, p); uMin = Math.min(uMin, q); uMax = Math.max(uMax, q);
  }
  const bend = o.family === "curved" ? o.bend : 0, pad = PAD_SPACINGS * o.spacing + Math.abs(bend);
  const count = Math.max(2, Math.ceil((aMax - aMin) / STATION) + 1), step = (aMax - aMin) / (count - 1);
  const shear = new Float64Array(count);
  if (bend !== 0) for (let i = 0; i < count; i++) shear[i] = bend * Math.sin((2 * Math.PI * (aMin + i * step)) / o.bendLength);
  const toneDriven = o.spacingGain > 0 && tau !== null;
  const budget: Budget = { lines: 0, stations: 0 };
  const out: Carrier[] = [];
  const emit = (k: number, u: Float64Array | number): void => {
    const xs = new Array<number>(count), ys = new Array<number>(count);
    for (let i = 0; i < count; i++) {
      const t = aMin + i * step, v = (typeof u === "number" ? u : u[i]) + shear[i];
      xs[i] = t * dx + v * nx; ys[i] = t * dy + v * ny;
    }
    charge(budget, count, o.spacing);
    out.push(freezeCarrier(`${o.family}:${k}`, k, xs, ys, false));
  };
  const march = (direction: 1 | -1): void => {
    const u = new Float64Array(count);
    for (let k = direction; ; k += direction) {
      let inside = false;
      for (let i = 0; i < count; i++) {
        const t = aMin + i * step, v = u[i] + shear[i];
        u[i] += direction * gap(o.spacing, o.spacingGain, tau!(t * dx + v * nx, t * dy + v * ny));
        if (direction > 0 ? u[i] - Math.abs(bend) <= uMax + pad : u[i] + Math.abs(bend) >= uMin - pad) inside = true;
      }
      if (!inside) return;
      emit(k, u);
    }
  };
  if (toneDriven) {
    emit(0, 0);
    march(-1);
    march(1);
  } else {
    const kMin = Math.floor((uMin - pad) / o.spacing) - 1, kMax = Math.ceil((uMax + pad) / o.spacing) + 1;
    if (kMax - kMin + 1 > MAX_LINES) throw new Error(`Engraving needs more than ${MAX_LINES} lines; raise the line spacing or shrink the footprint`);
    for (let k = kMin; k <= kMax; k++) emit(k, k * o.spacing);
  }
  out.sort((p, q) => p.index - q.index);
  return out;
}

function radialExtent(o: CarrierOptions, width: number, height: number): { cx: number; cy: number; reach: number } {
  const cx = o.radialX * width, cy = o.radialY * height;
  let reach = 0;
  for (const [x, y] of corners(width, height)) reach = Math.max(reach, Math.hypot(x - cx, y - cy));
  return { cx, cy, reach: reach + PAD_SPACINGS * o.spacing };
}

function ringCarriers(o: CarrierOptions, width: number, height: number, tau: TauAt | null): Carrier[] {
  const { cx, cy, reach } = radialExtent(o, width, height);
  let master = 64;
  while (master < (2 * Math.PI * reach) / STATION) master *= 2;
  const cos = new Float64Array(master), sin = new Float64Array(master);
  for (let i = 0; i < master; i++) { cos[i] = Math.cos((2 * Math.PI * i) / master); sin[i] = Math.sin((2 * Math.PI * i) / master); }
  const r = new Float64Array(master), budget: Budget = { lines: 0, stations: 0 }, pad = PAD_SPACINGS * o.spacing;
  const toneDriven = o.spacingGain > 0 && tau !== null;
  const out: Carrier[] = [];
  for (let j = 1; ; j++) {
    let min = Infinity;
    for (let i = 0; i < master; i++) {
      r[i] = toneDriven ? r[i] + gap(o.spacing, o.spacingGain, tau!(cx + r[i] * cos[i], cy + r[i] * sin[i])) : j * o.spacing;
      min = Math.min(min, r[i]);
    }
    if (min > reach) break;
    if (min < RING_MIN_RADIUS) continue;
    const need = Math.max(48, Math.ceil((2 * Math.PI * min) / STATION));
    let stations = master;
    while (stations / 2 >= need) stations /= 2;
    const stride = master / stations, xs: number[] = [], ys: number[] = [];
    let touches = false;
    for (let i = 0; i <= stations; i++) {
      const m = (i % stations) * stride, x = cx + r[m] * cos[m], y = cy + r[m] * sin[m];
      xs.push(x); ys.push(y);
      if (Math.abs(x) <= width / 2 + pad && Math.abs(y) <= height / 2 + pad) touches = true;
    }
    if (!touches) continue;
    charge(budget, stations + 1, o.spacing);
    out.push(freezeCarrier(`ring:${j}`, j, xs, ys, true));
  }
  return out;
}

function spiralCarrier(o: CarrierOptions, width: number, height: number, tau: TauAt | null): Carrier[] {
  const { cx, cy, reach } = radialExtent(o, width, height);
  const toneDriven = o.spacingGain > 0 && tau !== null;
  const rate = (r: number, t: number): number => (toneDriven ? gap(o.spacing, o.spacingGain, tau!(cx + r * Math.cos(t), cy + r * Math.sin(t))) : o.spacing) / (2 * Math.PI);
  const xs: number[] = [cx], ys: number[] = [cy];
  let r = 0, t = 0;
  const limit = MAX_STATIONS;
  while (r <= reach) {
    const dt = STATION / Math.max(r, STATION);
    const mid = r + (rate(r, t) * dt) / 2;
    r += rate(mid, t + dt / 2) * dt;
    t += dt;
    xs.push(cx + r * Math.cos(t)); ys.push(cy + r * Math.sin(t));
    if (xs.length > limit) throw new Error(`Engraving needs more than ${MAX_STATIONS} carrier stations at spacing ${o.spacing}; raise the line spacing or shrink the footprint`);
  }
  return [freezeCarrier("spiral:0", 0, xs, ys, false)];
}

// ---------------------------------------------------------------------------------------------
// Flow: evenly spaced streamlines of the blended orientation field.

const FLOW_TEST_RATIO = 0.5;
const FLOW_SEED_RATIO = 0.95;
export const MAX_FLOW_POINTS = 600_000;
const MAX_FLOW_STEPS = 20_000;

function flowCarriers(o: CarrierOptions, tone: ToneField, tau: TauAt): Carrier[] {
  const { width, height } = tone;
  const angle = (o.angle * Math.PI) / 180, c2a = Math.cos(2 * angle), s2a = Math.sin(2 * angle);
  const kx = tone.image[2] - tone.image[0], ky = tone.image[3] - tone.image[1];
  const px = kx / tone.columns, py = ky / tone.rows;
  let field: OrientationField | null = null;
  if (o.follow > 0) {
    const sigma = o.flowSmoothing / Math.max(px, py);
    if (sigma > 64) throw new Error("Flow smoothing is too large for the tone resolution (over 64 cells); lower Flow smoothing or raise Tone smoothing");
    field = orientationField(tone.grid, { smoothing: sigma });
  }
  const direction = (x: number, y: number, hint: readonly [number, number] | null): [number, number] => {
    let vx = c2a, vy = s2a;
    if (field) {
      const [gx, gy] = tone.gridPoint(x, y);
      const sample = orientationAt(field, Math.min(tone.columns, Math.max(0, gx)), Math.min(tone.rows, Math.max(0, gy)));
      const local = Math.atan2(py * Math.sin(sample.direction), px * Math.cos(sample.direction));
      const c = sample.coherence * o.follow;
      vx = c * Math.cos(2 * local) + (1 - c) * c2a; vy = c * Math.sin(2 * local) + (1 - c) * s2a;
    }
    const b = 0.5 * Math.atan2(vy, vx);
    let dx = Math.cos(b), dy = Math.sin(b);
    if (hint && dx * hint[0] + dy * hint[1] < 0) { dx = -dx; dy = -dy; }
    return [dx, dy];
  };
  const separation = (x: number, y: number): number => gap(o.spacing, o.spacingGain, tau(x, y));
  const h = STATION, hw = width / 2 + o.spacing, hh = height / 2 + o.spacing;
  const inside = (x: number, y: number, m = 0): boolean => Math.abs(x) <= hw + m && Math.abs(y) <= hh + m;
  const cell = Math.max(0.5 * o.spacing * (1 - o.spacingGain), 0.25);
  const key = (x: number, y: number): number => (Math.floor(x / cell) + 8192) * 65536 + Math.floor(y / cell) + 8192;
  const bins = new Map<number, number[]>();
  const pointX: number[] = [], pointY: number[] = [], pointLine: number[] = [], pointOrd: number[] = [], dead: boolean[] = [];
  const skip = Math.ceil((3 * o.spacing) / h) + 2;
  const add = (x: number, y: number, line: number, ord: number): void => {
    const k = key(x, y), list = bins.get(k);
    pointX.push(x); pointY.push(y); pointLine.push(line); pointOrd.push(ord); dead.push(false);
    if (list) list.push(pointX.length - 1); else bins.set(k, [pointX.length - 1]);
    if (pointX.length > MAX_FLOW_POINTS) throw new Error(`Flow lines need more than ${MAX_FLOW_POINTS} points; raise the line spacing or shrink the footprint`);
  };
  const near = (x: number, y: number, radius: number, line: number, ord: number): boolean => {
    const reach = Math.ceil(radius / cell), ix = Math.floor(x / cell), iy = Math.floor(y / cell), r2 = radius * radius;
    for (let i = ix - reach; i <= ix + reach; i++) for (let j = iy - reach; j <= iy + reach; j++) {
      const list = bins.get((i + 8192) * 65536 + j + 8192);
      if (!list) continue;
      for (const p of list) {
        if (dead[p] || (pointLine[p] === line && Math.abs(pointOrd[p] - ord) <= skip)) continue;
        const ex = pointX[p] - x, ey = pointY[p] - y;
        if (ex * ex + ey * ey < r2) return true;
      }
    }
    return false;
  };
  const lines: { xs: number[]; ys: number[] }[] = [];
  const walk = (x0: number, y0: number, id: number, sign: 1 | -1, start: readonly [number, number]): [number, number][] => {
    const out: [number, number][] = [];
    let x = x0, y = y0, hint: readonly [number, number] = sign > 0 ? start : [-start[0], -start[1]];
    for (let step = 1; step <= MAX_FLOW_STEPS; step++) {
      const d = direction(x, y, hint), dm = direction(x + (d[0] * h) / 2, y + (d[1] * h) / 2, d);
      const nx = x + dm[0] * h, ny = y + dm[1] * h;
      if (!inside(nx, ny)) { out.push([nx, ny]); break; }
      if (near(nx, ny, FLOW_TEST_RATIO * separation(nx, ny), id, sign * step)) break;
      add(nx, ny, id, sign * step); out.push([nx, ny]);
      hint = dm; x = nx; y = ny;
    }
    return out;
  };
  const build = (x0: number, y0: number): boolean => {
    const id = lines.length, first = pointX.length;
    add(x0, y0, id, 0);
    const start = direction(x0, y0, null), fwd = walk(x0, y0, id, 1, start), bwd = walk(x0, y0, id, -1, start);
    bwd.reverse();
    const xs = [...bwd.map((p) => p[0]), x0, ...fwd.map((p) => p[0])], ys = [...bwd.map((p) => p[1]), y0, ...fwd.map((p) => p[1])];
    let length = 0;
    for (let i = 1; i < xs.length; i++) length += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    if (length < o.spacing) { for (let p = first; p < pointX.length; p++) dead[p] = true; return false; }
    lines.push({ xs, ys });
    return true;
  };
  const jitter = (purpose: string): number => componentSeed(o.seed, "flow", purpose) / 0x1_0000_0000 - 0.5;
  build(jitter("x") * width * 0.4, jitter("y") * height * 0.4);
  for (let queue = 0; queue < lines.length; queue++) {
    const line = lines[queue];
    for (let i = 0; i < line.xs.length; i++) {
      const a = Math.max(0, i - 1), b = Math.min(line.xs.length - 1, i + 1);
      const tx = line.xs[b] - line.xs[a], ty = line.ys[b] - line.ys[a], len = Math.hypot(tx, ty);
      if (len === 0) continue;
      const nx = -ty / len, ny = tx / len, here = separation(line.xs[i], line.ys[i]);
      for (const side of [1, -1]) {
        const x = line.xs[i] + side * nx * here, y = line.ys[i] + side * ny * here;
        if (!inside(x, y)) continue;
        if (near(x, y, FLOW_SEED_RATIO * Math.min(here, separation(x, y)), -1, 0)) continue;
        build(x, y);
        if (lines.length > MAX_LINES) throw new Error(`Engraving needs more than ${MAX_LINES} lines; raise the line spacing or shrink the footprint`);
      }
    }
  }
  return lines.map((line, n) => freezeCarrier(`flow:${n}`, n, line.xs, line.ys, false));
}

/**
 * The carriers of one family over a footprint. `tone` and `tau` are needed for `flow` and whenever
 * `spacingGain > 0`; other families ignore every option that does not apply to them.
 */
export function engravingCarriers(options: CarrierOptions, tone: ToneField, tau: TauAt | null): readonly Carrier[] {
  const o = options;
  if (!carrierFamilies.includes(o.family)) throw new Error(`Scan family must be one of ${carrierFamilies.join(", ")}`);
  const num = (name: string, v: number, lo: number, hi: number): void => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) throw new Error(`${name} must be a number in [${lo}, ${hi}]`);
  };
  num("Line spacing", o.spacing, 1, 200); num("Spacing gain", o.spacingGain, 0, 0.9); num("Scan angle", o.angle, -3600, 3600);
  num("Bend", o.bend, 0, 1000); num("Bend length", o.bendLength, 4, 10000); num("Radial center X", o.radialX, -2, 2); num("Radial center Y", o.radialY, -2, 2);
  num("Follow", o.follow, 0, 1); num("Flow smoothing", o.flowSmoothing, 0, 200);
  if ((o.spacingGain > 0 || o.family === "flow") && tau === null) throw new Error("Tone-driven spacing and flow need a tone function");
  const { width, height } = tone;
  let list: Carrier[];
  if (o.family === "flow") list = flowCarriers(o, tone, tau!);
  else if (o.family === "rings") list = ringCarriers(o, width, height, tau);
  else if (o.family === "spiral") list = spiralCarrier(o, width, height, tau);
  else list = ruledCarriers(o, width, height, tau);
  return Object.freeze(list);
}

/** The pad, in canvas units, that carriers extend beyond the footprint so a modulated crest still reaches its edge. */
export const carrierPad = (spacing: number): number => PAD_SPACINGS * spacing;
export const FLOW_LIMITS = Object.freeze({ points: MAX_FLOW_POINTS, orientationWork: IMAGE_STRUCTURE_LIMITS.orientationWork });
