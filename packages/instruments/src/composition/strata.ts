/**
 * Stratigraphic model (brief 46): a stack of horizon functions, a family of parallel planar faults and an erosion
 * surface, stated as closed forms and evaluated point by point. Nothing here draws or builds a mesh: `strata-block.ts`
 * turns the model into a block Mesh, `strata-cut.ts` into cutaway geometry, `strata-draw.ts` into a drawing.
 *
 * COORDINATES. World space of the mesh foundation: right-handed, +Y up, so a horizon is a height `y = Y(x, z)`. The block
 * occupies `x in [-W/2, W/2]`, `z in [-D/2, D/2]`, `y in [0, H]` with W = 1 (the unit of length) and D, H ratios of the
 * width. The FRONT face is +Z (toward a yaw-0 camera), the RIGHT face +X. Everything geological is a fraction of W or H so
 * one picture scales with the block, never with the canvas.
 *
 * STRATA. `strata` = n units, numbered 0 (oldest, at the base) to n-1 (youngest, at the surface); horizon `w` (1..n-1) is
 * the contact between stratum w-1 and w. Stratum 0 extends down to the base of the block and stratum n-1 up to the erosion
 * surface, the n-2 internal strata have thickness. Before faulting, horizon w is
 *
 *     Y_w(x, z) = level_w + trend_w * x / W + tilt(x, z) + fold(x, z),   level_1 = (H - stack*H) / 2,
 *     level_{w+1} = level_w + stack * H * r_w,   trend_w = trendAmount * stack * H * sum_{k<w} s_k r_k,
 *
 * where r_k are the relative thicknesses of the internal strata (sum 1) from the chosen sequence and contrast, s_k = +-1
 * alternates so that a lateral trend thins one stratum where it thickens the next. The thickness of stratum k at (x, z) is
 * `stack*H*r_k*(1 + trendAmount*s_k*x/W)` and is at least `(1 - |trendAmount|/2)` of its mean, so it is POSITIVE and the
 * horizons never cross (Y_{w+1} - Y_w = thickness > 0). `tilt` is a plane, `fold` is one of: `sinusoidal`
 * (A sin(2 pi a / lambda + phase)), `chevron` (A tri(...), a triangle wave: straight limbs, sharp hinges), `dome` (a
 * product of two sinusoids: closed domes and basins) with `a` measured across the fold axis.
 *
 * FAULTS. `faultCount` parallel planes share one strike (`faultStrike`) and one dip; plane j is
 * `p - kappa (y - H/2) = c_j` with `p` the horizontal coordinate across the strike and `kappa = cot(dip)` (signed by the dip
 * direction). The HANGING WALL is the side above the plane. A fault with signed throw T moves its hanging wall along the dip
 * vector `(kappa, 1)` DOWN by T (T > 0: normal fault; T < 0: reverse), so the displacement lies IN the plane, has vertical
 * component exactly T and leaves neither gap nor overlap. Because every plane is parallel and the slip is along the shared dip
 * vector, a fault never moves another fault's plane: the displacements ADD and the order of faults is irrelevant. Compartment i
 * (between planes) is displaced by `-S_i (kappa, 1)` with `S_i` the sum of the throws of the faults it is the hanging wall of,
 * so the final horizon there is `y = Y_w(p + kappa S_i, q) - S_i`. The offset of a horizon across fault j is therefore exactly
 * `T_j` vertically and `kappa T_j` horizontally, whatever the folds and tilt (tested from the meshes).
 *
 * EROSION. The block is cut by `ground(x, z) = H - relief*H*E(x, z)`, `E` in [0, 1] a smooth seeded sum of three sinusoids of
 * wavelength `reliefScale * W`. Strata are truncated by it (outcrop) and by the base plane y = 0.
 *
 * INVERSE MAP (`stratumAt`). A point is assigned by undoing the faults (add the throws of the faults it is hanging wall of, moving it
 * along the dip vector back) and counting the horizons at or below it. It is the oracle the meshes are tested against.
 *
 * VALIDITY. The block is built column by column, so a horizon must cross a fault plane at most once per column: its steepest slope
 * times `kappa` must stay under 0.92 (`MAX_SLOPE_TIMES_KAPPA`). Violations throw naming the controls to reduce (Tilt, Fold amplitude,
 * Fold wavelength, Ground relief) or to raise (Fault dip). Faults must leave every compartment at least 4% of the block across
 * the strike at every height; otherwise Faults, Fault dip or Fault position is named.
 *
 * SEEDS. Fold phase, random thicknesses, fault position jitter, throw variation, the sense of `mixed` faults and the relief are
 * `componentSeed(seed, <stable id>, <purpose>)` streams: adding a fault or a stratum never re-rolls another element's stream.
 * Cameras, palettes, cuts and materials never touch any value here.
 */
import { componentSeed } from "./core.js";

export type ThicknessSequence = "uniform" | "thinning" | "thickening" | "rhythmic" | "random";
export type FoldType = "none" | "sinusoidal" | "chevron" | "dome";
export type FaultStrike = "depth" | "width";
export type FaultDipDirection = "left" | "right";
export type FaultStyle = "stepped" | "alternating" | "mixed";

export interface StrataOptions {
  readonly seed: number;
  /** Block depth (z extent) as a fraction of its width, and height (y extent) as a fraction of its width. */
  readonly depth: number;
  readonly height: number;
  readonly strata: number;
  readonly sequence: ThicknessSequence;
  /** Thickest to thinnest ratio of the internal strata (at least 1). */
  readonly contrast: number;
  /** Total thickness of the internal strata as a fraction of the block height. */
  readonly stack: number;
  /** Lateral thickness trend along x, -1..1 (one side thins where the other thickens, alternating by stratum). */
  readonly trend: number;
  /** Degrees: dip of the whole stack and the compass direction (degrees from +x toward +z) it descends toward. */
  readonly tilt: number;
  readonly tiltAzimuth: number;
  readonly fold: FoldType;
  /** Fraction of the block height (half the crest-to-trough range) and of the block width. */
  readonly foldAmplitude: number;
  readonly foldWavelength: number;
  /** Degrees from +x toward +z: direction of the hinge lines. */
  readonly foldAxis: number;
  /** Extra phase in degrees added to the seeded phase. */
  readonly foldPhase: number;
  readonly faultCount: number;
  /** Signed throw as a fraction of the block height: positive normal, negative reverse. */
  readonly faultThrow: number;
  /** Degrees from horizontal, 90 vertical. */
  readonly faultDip: number;
  readonly faultStrike: FaultStrike;
  readonly faultDipDirection: FaultDipDirection;
  readonly faultStyle: FaultStyle;
  /** Shift of the family across the strike, fraction of one spacing (-0.45..0.45). */
  readonly faultShift: number;
  /** Seeded scatter of fault positions and throws, 0..1. */
  readonly faultScatter: number;
  /** Erosion surface: depth of the valleys as a fraction of block height, and wavelength as a fraction of the width. */
  readonly relief: number;
  readonly reliefScale: number;
}

export const MAX_STRATA = 16;
export const MAX_FAULTS = 6;
/** A horizon's steepest slope times cot(dip) above which one column may cross a fault plane twice. */
export const MAX_SLOPE_TIMES_KAPPA = 0.92;
/** Smallest compartment width across the strike, as a fraction of the block extent across the strike. */
export const MIN_COMPARTMENT_FRACTION = 0.04;

/** A plane bound of a compartment: `p = p0 + kappa (y - H/2)`. */
export interface PlaneBound { readonly p0: number; readonly kappa: number }
export interface Fault {
  readonly id: string;
  readonly index: number;
  /** Position across the strike at mid height. */
  readonly position: number;
  /** Signed vertical throw in block units. */
  readonly throw: number;
}
export interface Compartment {
  readonly index: number;
  readonly id: string;
  /** Sum of the throws of the faults this compartment is hanging wall of; it moves by `-shift (kappa, 1)`. */
  readonly shift: number;
  readonly left: PlaneBound | null;
  readonly right: PlaneBound | null;
}

export interface StrataModel {
  readonly key: string;
  readonly options: StrataOptions;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly strata: number;
  /** `kappa = cot(dip)` with the sign of the dip direction (0 for vertical faults). */
  readonly kappa: number;
  readonly faults: readonly Fault[];
  readonly compartments: readonly Compartment[];
  /** Relative thicknesses `r_k` of the internal strata 1..n-2 (sum 1); empty when n = 2. */
  readonly thicknessShares: readonly number[];
  /** Coordinates across (p) and along (q) the fault strike, and their extents. */
  readonly extentP: number;
  readonly extentQ: number;
  readonly toWorld: (p: number, q: number) => readonly [number, number];
  readonly toPQ: (x: number, z: number) => readonly [number, number];
  /** Pre-fault height of horizon w (1..n-1) at (x, z). */
  readonly horizon: (w: number, x: number, z: number) => number;
  /** Pre-fault thickness of internal stratum k (1..n-2). */
  readonly thickness: (k: number, x: number, z: number) => number;
  readonly ground: (x: number, z: number) => number;
  /** Bounds on every pre-fault horizon (lowest and highest value anywhere) and on the ground. */
  readonly horizonRange: readonly [number, number];
  readonly groundRange: readonly [number, number];
  /** Upper bounds on the gradient magnitude of the horizons and of the ground. */
  readonly slopeBound: { readonly horizon: number; readonly ground: number };
  /** The stratum (0..n-1), compartment and elevation-above-nothing of a point by the inverse map (see the module header). */
  readonly stratumAt: (x: number, y: number, z: number) => { readonly stratum: number; readonly compartment: number };
  /** Final horizon height of horizon w in compartment i at across/along coordinates (p, q). */
  readonly finalHorizon: (w: number, compartment: number, p: number, q: number) => number;
}

const U32 = 0x1_0000_0000;
const radians = Math.PI / 180;
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;

const cache = new Map<string, StrataModel>();

function finite(name: string, value: number, low: number, high: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high)
    throw new Error(`${name} must be a number from ${low} to ${high} (got ${String(value)})`);
}
function whole(name: string, value: number, low: number, high: number): void {
  if (!Number.isInteger(value) || value < low || value > high) throw new Error(`${name} must be a whole number from ${low} to ${high} (got ${String(value)})`);
}

/** Triangle wave with amplitude 1 and period 2 pi (continuous, slope +-2/pi * 1). */
const triangle = (t: number): number => (2 / Math.PI) * Math.asin(Math.sin(t));

export function strataModel(options: StrataOptions): StrataModel {
  const key = JSON.stringify(options);
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const model = build(options, key);
  cache.set(key, model);
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
  return model;
}

function build(o: StrataOptions, key: string): StrataModel {
  if (!Number.isSafeInteger(o.seed) || o.seed < 0 || o.seed > 0xffffffff) throw new Error("Seed must be a uint32 integer");
  finite("Block depth", o.depth, 0.2, 4); finite("Block height", o.height, 0.1, 3);
  whole("Strata", o.strata, 2, MAX_STRATA);
  finite("Thickness contrast", o.contrast, 1, 40); finite("Stack depth", o.stack, 0.2, 3);
  finite("Thickness trend", o.trend, -1, 1);
  finite("Tilt", o.tilt, -60, 60); finite("Tilt direction", o.tiltAzimuth, -1e6, 1e6);
  finite("Fold amplitude", o.foldAmplitude, 0, 2); finite("Fold wavelength", o.foldWavelength, 0.05, 20);
  finite("Fold axis", o.foldAxis, -1e6, 1e6); finite("Fold phase", o.foldPhase, -1e6, 1e6);
  whole("Faults", o.faultCount, 0, MAX_FAULTS);
  finite("Fault throw", o.faultThrow, -3, 3); finite("Fault dip", o.faultDip, 5, 90);
  finite("Fault position", o.faultShift, -0.45, 0.45); finite("Fault scatter", o.faultScatter, 0, 1);
  finite("Ground relief", o.relief, 0, 0.9); finite("Ground relief scale", o.reliefScale, 0.05, 20);
  for (const [name, value, allowed] of [
    ["Thickness sequence", o.sequence, ["uniform", "thinning", "thickening", "rhythmic", "random"]],
    ["Fold type", o.fold, ["none", "sinusoidal", "chevron", "dome"]],
    ["Fault strike", o.faultStrike, ["depth", "width"]],
    ["Fault dip direction", o.faultDipDirection, ["left", "right"]],
    ["Fault style", o.faultStyle, ["stepped", "alternating", "mixed"]],
  ] as const) if (!(allowed as readonly string[]).includes(value)) throw new Error(`${name} must be one of ${allowed.join(", ")} (got ${String(value)})`);

  const W = 1, D = o.depth, H = o.height, n = o.strata;
  const strikeDepth = o.faultStrike === "depth";
  // depth strike: p = x, q = -z. width strike: p = -z, q = x. Both keep (p, q) right-handed seen from above.
  const toPQ = (x: number, z: number): readonly [number, number] => (strikeDepth ? [x, -z] : [-z, x]);
  const toWorld = (p: number, q: number): readonly [number, number] => (strikeDepth ? [p, -q] : [q, -p]);
  const P = strikeDepth ? W : D, Q = strikeDepth ? D : W;

  // Thickness sequence of the internal strata.
  const m = n - 2, lambda = Math.log(o.contrast);
  const raw: number[] = [];
  for (let k = 1; k <= m; k++) {
    const t = m === 1 ? 0.5 : (k - 1) / (m - 1);
    raw.push(o.sequence === "uniform" ? 1
      : o.sequence === "thinning" ? Math.exp(-lambda * t)
      : o.sequence === "thickening" ? Math.exp(lambda * t)
      : o.sequence === "rhythmic" ? (k % 2 === 1 ? o.contrast : 1)
      : Math.exp(lambda * unit(o.seed, `stratum:${k}`, "thickness")));
  }
  const total = raw.reduce((a, b) => a + b, 0);
  const shares = raw.map((v) => v / total);
  const stackHeight = o.stack * H;
  const sign = (k: number) => (k % 2 === 0 ? 1 : -1);
  const level: number[] = [0, (H - stackHeight) / 2], trendCoef: number[] = [0, 0];
  for (let w = 1; w < n - 1; w++) {
    level[w + 1] = level[w] + stackHeight * shares[w - 1];
    trendCoef[w + 1] = trendCoef[w] + o.trend * stackHeight * sign(w) * shares[w - 1];
  }

  // Tilt and folds.
  const tiltSlope = Math.tan(o.tilt * radians), tiltDir = o.tiltAzimuth * radians;
  const tx = tiltSlope * Math.cos(tiltDir), tz = tiltSlope * Math.sin(tiltDir);
  const axis = o.foldAxis * radians, ax = Math.cos(axis), az = Math.sin(axis);
  const A = o.foldAmplitude * H, lambdaF = o.foldWavelength * W;
  const phase = 2 * Math.PI * unit(o.seed, "fold", "phase") + o.foldPhase * radians;
  const phase2 = 2 * Math.PI * unit(o.seed, "fold", "phase2");
  const lambdaAlong = lambdaF * 1.35, kAcross = 2 * Math.PI / lambdaF, kAlong = 2 * Math.PI / lambdaAlong;
  const fold = (x: number, z: number): number => {
    if (o.fold === "none" || A === 0) return 0;
    const across = -x * az + z * ax;
    if (o.fold === "sinusoidal") return A * Math.sin(kAcross * across + phase);
    if (o.fold === "chevron") return A * triangle(kAcross * across + phase);
    return A * Math.sin(kAcross * across + phase) * Math.sin(kAlong * (x * ax + z * az) + phase2);
  };
  const foldSlope = o.fold === "none" ? 0 : o.fold === "sinusoidal" ? A * kAcross : o.fold === "chevron" ? A * kAcross * 2 / Math.PI
    : A * Math.hypot(kAcross, kAlong);
  const foldBound = o.fold === "none" ? 0 : A;
  const tiltBound = Math.abs(tx) * W / 2 + Math.abs(tz) * D / 2;
  const trendBound = Math.max(...trendCoef.map(Math.abs)) / 2;
  const horizon = (w: number, x: number, z: number): number => {
    if (!Number.isInteger(w) || w < 1 || w > n - 1) throw new Error(`Horizon ${String(w)} does not exist: horizons run from 1 to ${n - 1}`);
    return level[w] + trendCoef[w] * (x / W) + tx * x + tz * z + fold(x, z);
  };
  const thickness = (k: number, x: number, z: number): number => {
    if (!Number.isInteger(k) || k < 1 || k > n - 2) throw new Error(`Stratum ${String(k)} has no thickness: internal strata run from 1 to ${n - 2}`);
    return stackHeight * shares[k - 1] * (1 + o.trend * sign(k) * (x / W));
  };
  const horizonRange: [number, number] = [level[1] - trendBound - tiltBound - foldBound - 1e-9, level[n - 1] + trendBound + tiltBound + foldBound + 1e-9];
  // |x/W| <= 1/2 gives the bound above; the slope of the trend along x is trendCoef / W.
  const trendSlope = Math.max(...trendCoef.map(Math.abs)) / W;
  const horizonSlope = Math.hypot(tx, tz) + foldSlope + trendSlope;

  // Erosion surface.
  const waves = [0, 1, 2].map((i) => ({
    weight: [1, 0.6, 0.35][i], theta: 2 * Math.PI * unit(o.seed, `relief:${i}`, "direction"), phase: 2 * Math.PI * unit(o.seed, `relief:${i}`, "phase"),
    k: 2 * Math.PI / (o.reliefScale * W) * [1, 1.7, 2.9][i],
  }));
  const weightSum = waves.reduce((a, b) => a + b.weight, 0);
  const ground = (x: number, z: number): number => {
    if (o.relief === 0) return H;
    let e = 0;
    for (const w of waves) e += w.weight * Math.sin(w.k * (x * Math.cos(w.theta) + z * Math.sin(w.theta)) + w.phase);
    return H - o.relief * H * (0.5 + 0.5 * e / weightSum);
  };
  const groundRange: [number, number] = [H - o.relief * H, H];
  const groundSlope = o.relief === 0 ? 0 : o.relief * H * 0.5 * waves.reduce((a, b) => a + b.weight * b.k, 0) / weightSum;

  // Faults.
  const kappa = o.faultDip === 90 ? 0 : (o.faultDipDirection === "left" ? 1 : -1) / Math.tan(o.faultDip * radians);
  const M = o.faultCount, spacing = P / (M + 1);
  const faults: Fault[] = [];
  for (let j = 0; j < M; j++) {
    const jitter = (unit(o.seed, `fault:${j}`, "position") - 0.5) * 0.8 * o.faultScatter * spacing;
    const size = 1 + (unit(o.seed, `fault:${j}`, "throw") * 2 - 1) * 0.6 * o.faultScatter;
    const sense = o.faultStyle === "stepped" ? 1 : o.faultStyle === "alternating" ? (j % 2 === 0 ? 1 : -1) : (unit(o.seed, `fault:${j}`, "sense") < 0.5 ? 1 : -1);
    faults.push(Object.freeze({ id: `f${j}`, index: j, position: -P / 2 + spacing * (j + 1 + o.faultShift) + jitter, throw: sense * o.faultThrow * H * size }));
  }
  const hangingLeft = kappa >= 0;
  const compartments: Compartment[] = [];
  for (let i = 0; i <= M; i++) {
    let shift = 0;
    for (let j = 0; j < M; j++) if (hangingLeft ? j >= i : j < i) shift += faults[j].throw;
    compartments.push(Object.freeze({
      index: i, id: `c${i}`, shift,
      left: i === 0 ? null : Object.freeze({ p0: faults[i - 1].position, kappa }),
      right: i === M ? null : Object.freeze({ p0: faults[i].position, kappa }),
    }));
  }
  // Every compartment keeps a workable width at the base and at the top of the block.
  for (const c of compartments) for (const y of [0, H]) {
    const left = c.left ? c.left.p0 + c.left.kappa * (y - H / 2) : -P / 2, right = c.right ? c.right.p0 + c.right.kappa * (y - H / 2) : P / 2;
    if (!(right - left >= MIN_COMPARTMENT_FRACTION * P))
      throw new Error(`Fault compartment ${c.index} is ${(right - left).toFixed(3)} wide across the strike at height ${y === 0 ? "0 (the base)" : "H (the top)"}; each needs at least ${(MIN_COMPARTMENT_FRACTION * P).toFixed(3)}. Raise Fault dip, lower Faults, or reduce Fault position`);
  }
  if (M > 0 && Math.abs(kappa) * horizonSlope >= MAX_SLOPE_TIMES_KAPPA)
    throw new Error(`Horizons are too steep for faults dipping ${o.faultDip} degrees: their steepest slope ${horizonSlope.toFixed(2)} times cot(dip) ${Math.abs(kappa).toFixed(2)} must stay under ${MAX_SLOPE_TIMES_KAPPA}. Lower Tilt, Fold amplitude or Thickness trend, raise Fold wavelength, or raise Fault dip`);
  if (M > 0 && Math.abs(kappa) * groundSlope >= MAX_SLOPE_TIMES_KAPPA)
    throw new Error(`The erosion surface is too steep for faults dipping ${o.faultDip} degrees: slope ${groundSlope.toFixed(2)} times cot(dip) ${Math.abs(kappa).toFixed(2)} must stay under ${MAX_SLOPE_TIMES_KAPPA}. Lower Ground relief, raise Ground relief scale or Fault dip`);

  const stratumAt = (x: number, y: number, z: number) => {
    const [p, q] = toPQ(x, z);
    let shift = 0, right = 0;
    for (const f of faults) {
      const side = p - kappa * (y - H / 2) - f.position;
      if (side >= 0) right++;
      if (hangingLeft ? side < 0 : side > 0) shift += f.throw;
    }
    const [x0, z0] = toWorld(p + kappa * shift, q), y0 = y + shift;
    let stratum = 0;
    for (let w = 1; w <= n - 1; w++) if (horizon(w, x0, z0) <= y0) stratum = w;
    return { stratum, compartment: right };
  };
  const finalHorizon = (w: number, compartment: number, p: number, q: number): number => {
    const c = compartments[compartment];
    if (!c) throw new Error(`Compartment ${String(compartment)} does not exist: compartments run from 0 to ${M}`);
    const [x, z] = toWorld(p + kappa * c.shift, q);
    return horizon(w, x, z) - c.shift;
  };

  return Object.freeze({
    key, options: Object.freeze({ ...o }), width: W, depth: D, height: H, strata: n, kappa,
    faults: Object.freeze(faults), compartments: Object.freeze(compartments), thicknessShares: Object.freeze(shares),
    extentP: P, extentQ: Q, toWorld, toPQ, horizon, thickness, ground, horizonRange: Object.freeze(horizonRange), groundRange: Object.freeze(groundRange),
    slopeBound: Object.freeze({ horizon: horizonSlope, ground: groundSlope }), stratumAt, finalHorizon,
  });
}
