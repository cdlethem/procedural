import {
  MAX_ARRAY,
  passiveArray,
  passiveRecord,
  positiveDimension,
  valueAt,
  number,
  workLimit,
  checkedProduct,
  checkedWork,
} from "./internal/raster-study-utils.js";

const MAPPINGS = new Set(["mandelbrot", "julia"]);
const ESCAPE_SQUARED = 4; // |z| > 2, compared as |z|^2 > 4

/** Error with a stable complex.escape-distance-2d contract code. */
export class ComplexEscapeDistance2DError extends Error {
  constructor(code) {
    super(code);
    this.name = "ComplexEscapeDistance2DError";
    this.code = code;
  }
}

function invalid() {
  throw new ComplexEscapeDistance2DError("INVALID_INPUT");
}

function validate(input) {
  const E = ComplexEscapeDistance2DError;
  const root = passiveRecord(
    input,
    ["mapping", "constant", "grid", "iterations", "maxWork"],
    E,
  );

  const mapping = valueAt(root, "mapping", E);
  if (typeof mapping !== "string" || !MAPPINGS.has(mapping)) invalid();

  const constantRaw = passiveArray(valueAt(root, "constant", E), E, 2);
  const cx = number(valueAt(constantRaw, "0", E), E);
  const cy = number(valueAt(constantRaw, "1", E), E);

  const grid = passiveRecord(
    valueAt(root, "grid", E),
    ["width", "height", "origin", "cell"],
    E,
  );
  const width = positiveDimension(valueAt(grid, "width", E), E);
  const height = positiveDimension(valueAt(grid, "height", E), E);
  const origin = passiveArray(valueAt(grid, "origin", E), E, 2);
  const ox = number(valueAt(origin, "0", E), E);
  const oy = number(valueAt(origin, "1", E), E);
  const cell = passiveArray(valueAt(grid, "cell", E), E, 2);
  const dx = number(valueAt(cell, "0", E), E);
  const dy = number(valueAt(cell, "1", E), E);
  if (!(dx > 0) || !(dy > 0)) invalid();
  const size = checkedProduct([width, height], E);
  if (size > MAX_ARRAY) invalid();

  const iterations = number(valueAt(root, "iterations", E), E);
  if (!Number.isSafeInteger(iterations) || iterations < 1) invalid();

  const maxWork = workLimit(valueAt(root, "maxWork", E), E);

  return { mapping, cx, cy, width, height, ox, oy, dx, dy, size, iterations, maxWork };
}

/**
 * Escape-time iteration and derivative distance estimate for z -> z^2 + c.
 * Implements complex.escape-distance-2d 0.1.0.
 */
export function complexEscapeDistance2D(input) {
  const v = validate(input);
  const work = checkedProduct([v.iterations, v.size], ComplexEscapeDistance2DError, "WORK_LIMIT");
  checkedWork(work, v.maxWork, ComplexEscapeDistance2DError);

  const { width, height, ox, oy, dx, dy, size, iterations, mapping, cx, cy } = v;
  const julia = mapping === "julia";
  const iteration = new Array(size);
  const distance = new Array(size);

  for (let j = 0; j < height; j += 1) {
    const wy = oy + j * dy;
    for (let i = 0; i < width; i += 1) {
      const wx = ox + i * dx;
      // julia: z0 = sampled point, c = constant. mandelbrot: z0 = 0, c = sampled point.
      let zx, zy, ccx, ccy;
      if (julia) { zx = wx; zy = wy; ccx = cx; ccy = cy; }
      else { zx = 0; zy = 0; ccx = wx; ccy = wy; }
      let dzx = julia ? 1 : 0, dzy = 0; // zder real/imag
      let count = 0;
      let escaped = false;
      for (let k = 0; k < iterations; k += 1) {
        // zder update uses the pre-update z (z_k).
        // 2 * z * zder, complex.
        const ndzx = 2 * (zx * dzx - zy * dzy) + (julia ? 0 : 1);
        const ndzy = 2 * (zx * dzy + zy * dzx);
        dzx = ndzx; dzy = ndzy;
        // z update: z^2 + c.
        const nzx = zx * zx - zy * zy + ccx;
        const nzy = 2 * zx * zy + ccy;
        zx = nzx; zy = nzy;
        count += 1;
        if (zx * zx + zy * zy > ESCAPE_SQUARED) { escaped = true; break; }
      }
      const idx = j * width + i;
      iteration[idx] = count;
      if (escaped) {
        const mag = Math.sqrt(zx * zx + zy * zy);
        const zderMag = Math.sqrt(dzx * dzx + dzy * dzy);
        distance[idx] = zderMag === 0 ? 0 : Math.log(mag) * mag / zderMag;
      } else {
        distance[idx] = 0;
      }
    }
  }

  return { width, height, iteration, distance };
}
