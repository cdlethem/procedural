import {
  MAX_ARRAY,
  passiveArray,
  passiveRecord,
  positiveDimension,
  valueAt,
  number,
  workLimit,
  checkedWork,
} from "./internal/raster-study-utils.js";
import { fdlibmSin, fdlibmCos } from "./fdlibm-trig.js";

const UINT32_MODULUS = 4294967296;
const POWERS = new Set(["linear", "abs", "sin", "cos", "inv"]);

/** Error with a stable fractal.flame-accumulate-2d contract code. */
export class FractalFlameAccumulate2DError extends Error {
  constructor(code) {
    super(code);
    this.name = "FractalFlameAccumulate2DError";
    this.code = code;
  }
}

function invalid() {
  throw new FractalFlameAccumulate2DError("INVALID_INPUT");
}

/** Accepted seeded 32-bit LCG; one draw per iterate. */
function next(state) {
  return (Math.imul(1664525, state) + 1013904223) >>> 0;
}

/**
 * Element-wise flame "power". `inv` maps 0 to +Infinity by definition; that value
 * is a handled drop path in the iterate, not an arithmetic error.
 */
function powerEval(power, c) {
  switch (power) {
    case "linear":
      return c;
    case "abs":
      return c < 0 ? -c : c;
    case "sin":
      return fdlibmSin(c);
    case "cos":
      return fdlibmCos(c);
    case "inv":
      return c === 0 ? Infinity : 1 / c;
  }
  invalid();
  return 0;
}

function validate(input) {
  const E = FractalFlameAccumulate2DError;
  const root = passiveRecord(
    input,
    ["transforms", "seeds", "iterations", "density", "rngState", "maxWork"],
    E,
  );

  const rawTransforms = passiveArray(valueAt(root, "transforms", E), E);
  if (rawTransforms.length === 0) invalid();
  const transforms = [];
  for (let i = 0; i < rawTransforms.length; i += 1) {
    const t = rawTransforms[i];
    passiveRecord(t, ["a", "t", "power", "weight"], E);
    const a = passiveArray(valueAt(t, "a", E), E, 4);
    const a00 = number(valueAt(a, "0", E), E);
    const a01 = number(valueAt(a, "1", E), E);
    const a10 = number(valueAt(a, "2", E), E);
    const a11 = number(valueAt(a, "3", E), E);
    const tv = passiveArray(valueAt(t, "t", E), E, 2);
    const tx = number(valueAt(tv, "0", E), E);
    const ty = number(valueAt(tv, "1", E), E);
    const power = valueAt(t, "power", E);
    if (typeof power !== "string" || !POWERS.has(power)) invalid();
    const weight = number(valueAt(t, "weight", E), E);
    if (weight < 0) invalid();
    transforms.push({ a00, a01, a10, a11, tx, ty, power, weight });
  }
  const cumulative = [];
  let total = 0;
  for (const tr of transforms) {
    total += tr.weight;
    cumulative.push(total);
  }
  if (!Number.isFinite(total) || total <= 0) invalid();

  const rawSeeds = passiveArray(valueAt(root, "seeds", E), E);
  if (rawSeeds.length === 0) invalid();
  const seeds = [];
  for (let i = 0; i < rawSeeds.length; i += 1) {
    const s = passiveArray(rawSeeds[i], E, 2);
    seeds.push([
      number(valueAt(s, "0", E), E),
      number(valueAt(s, "1", E), E),
    ]);
  }

  const iterations = number(valueAt(root, "iterations", E), E);
  if (!Number.isSafeInteger(iterations) || iterations < 1) invalid();

  const density = passiveRecord(
    valueAt(root, "density", E),
    ["width", "height", "origin", "cell"],
    E,
  );
  const width = positiveDimension(valueAt(density, "width", E), E);
  const height = positiveDimension(valueAt(density, "height", E), E);
  const origin = passiveArray(valueAt(density, "origin", E), E, 2);
  const ox = number(valueAt(origin, "0", E), E);
  const oy = number(valueAt(origin, "1", E), E);
  const cell = passiveArray(valueAt(density, "cell", E), E, 2);
  const dx = number(valueAt(cell, "0", E), E);
  const dy = number(valueAt(cell, "1", E), E);
  if (!(dx > 0) || !(dy > 0)) invalid();
  const size = width * height;
  if (!Number.isSafeInteger(size) || size > MAX_ARRAY) invalid();

  const rngState = number(valueAt(root, "rngState", E), E);
  if (!Number.isSafeInteger(rngState) || rngState < 0 || rngState > MAX_ARRAY) invalid();
  const maxWork = workLimit(valueAt(root, "maxWork", E), E);

  return {
    transforms,
    cumulative,
    total,
    seeds,
    iterations,
    width,
    height,
    size,
    ox,
    oy,
    dx,
    dy,
    rngState,
    maxWork,
  };
}

/**
 * Accumulate one fractal-flame point process into a bilinear density buffer.
 * Implements fractal.flame-accumulate-2d 0.1.0.
 */
export function fractalFlameAccumulate2D(input) {
  const v = validate(input);
  checkedWork(v.iterations, v.maxWork, FractalFlameAccumulate2DError);

  const values = new Array(v.size).fill(0);
  let state = v.rngState;
  let plotted = 0;
  let dropped = 0;
  const S = v.seeds.length;
  let cursor = 0;
  let px = v.seeds[0][0];
  let py = v.seeds[0][1];
  const { transforms, cumulative, total, width, height, ox, oy, dx, dy } = v;

  for (let step = 0; step < v.iterations; step += 1) {
    state = next(state);
    const target = (state / UINT32_MODULUS) * total;
    let k = 0;
    while (k < transforms.length && target >= cumulative[k]) k += 1;
    const tr = transforms[k];

    const fx = powerEval(tr.power, px);
    const fy = powerEval(tr.power, py);
    const nx = tr.a00 * fx + tr.a01 * fy + tr.tx;
    const ny = tr.a10 * fx + tr.a11 * fy + tr.ty;

    if (!Number.isFinite(nx) || !Number.isFinite(ny)) {
      dropped += 1;
      cursor = (cursor + 1) % S;
      px = v.seeds[cursor][0];
      py = v.seeds[cursor][1];
      continue;
    }

    const gx = (nx - ox) / dx;
    const gy = (ny - oy) / dy;
    const i0 = Math.floor(gx);
    const j0 = Math.floor(gy);
    if (i0 < 0 || j0 < 0 || i0 >= width || j0 >= height) {
      dropped += 1;
      px = nx;
      py = ny;
      continue;
    }

    const sx = gx - i0;
    const sy = gy - j0;
    const w00 = (1 - sx) * (1 - sy);
    const w10 = sx * (1 - sy);
    const w01 = (1 - sx) * sy;
    const w11 = sx * sy;
    const base = j0 * width + i0;
    values[base] += w00;
    if (i0 + 1 < width) values[base + 1] += w10;
    if (j0 + 1 < height) values[base + width] += w01;
    if (i0 + 1 < width && j0 + 1 < height) values[base + width + 1] += w11;
    plotted += 1;
    px = nx;
    py = ny;
  }

  return { density: { width, height, values }, plotted, dropped, rngState: state };
}
