import { at, integer } from "./internal/geometry-b-utils.js";
import { RASTER_LIMIT, UINT32_MAX, weightedRaster } from "./internal/weighted-raster-utils.js";

export class WeightedRasterPoints2DError extends Error {
  constructor(code) { super(code); this.name = "WeightedRasterPoints2DError"; this.code = code; }
}

/** Select jittered pixel positions from explicit integer mass and LCG32 state. */
export function weightedRasterPoints2D(input) {
  const E = WeightedRasterPoints2DError;
  const { width, size, weights, total } = weightedRaster(input, ["width", "height", "weights", "count", "rngState", "maxWork"], E);
  const count = integer(E, at(E, input, "count"), 0, RASTER_LIMIT);
  let state = integer(E, at(E, input, "rngState"), 0, UINT32_MAX);
  const maxWork = integer(E, at(E, input, "maxWork"), 0, Number.MAX_SAFE_INTEGER);
  const baseline = size + (total > 0 ? 4 * count : 0);
  if (!Number.isSafeInteger(baseline) || baseline > maxWork) throw new E("WORK_LIMIT");
  if (total === 0 || count === 0) return { points: [], pixelIndices: [], rngState: state };

  const prefix = new Array(size);
  let running = 0;
  for (let i = 0; i < size; i += 1) {
    running += at(E, weights, i);
    prefix[i] = running;
  }
  const totalBig = BigInt(total);
  const points = [], pixelIndices = [];
  let spent = baseline;
  const draw = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state; };
  for (let i = 0; i < count; i += 1) {
    const high = draw(), low = draw();
    const ticket = (BigInt(high) << 32n) | BigInt(low);
    const q = Number((ticket * totalBig) >> 64n);
    let lo = 0, hi = size;
    while (lo < hi) {
      spent += 1;
      if (spent > maxWork) throw new E("WORK_LIMIT");
      const mid = Math.floor((lo + hi) / 2);
      if (prefix[mid] > q) hi = mid;
      else lo = mid + 1;
    }
    const ux = draw(), uy = draw();
    const column = lo % width, row = Math.floor(lo / width);
    points.push([column + (ux + 0.5) / 4294967296, row + (uy + 0.5) / 4294967296]);
    pixelIndices.push(lo);
  }
  return { points, pixelIndices, rngState: state };
}
