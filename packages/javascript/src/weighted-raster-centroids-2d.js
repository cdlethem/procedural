import { array, at, finite, integer } from "./internal/geometry-b-utils.js";
import { ExactRational } from "./internal/exact-rational.js";
import { RASTER_LIMIT, weightedRaster } from "./internal/weighted-raster-utils.js";

export class WeightedRasterCentroids2DError extends Error {
  constructor(code) { super(code); this.name = "WeightedRasterCentroids2DError"; this.code = code; }
}

function dyadic(value) {
  const exact = ExactRational.of(value);
  return { numerator: exact.n, shift: exact.d.toString(2).length - 1 };
}

/** Move each site once to the exact pixel-mass centroid of its original nearest pixels. */
export function weightedRasterCentroids2D(input) {
  const E = WeightedRasterCentroids2DError;
  const { width, height, size, weights, total, active } = weightedRaster(input, ["width", "height", "weights", "sites", "maxWork"], E);
  const rawSites = array(E, at(E, input, "sites"));
  if (rawSites.length > RASTER_LIMIT) throw new E("INVALID_INPUT");
  for (let i = 0; i < rawSites.length; i += 1) {
    const pair = array(E, at(E, rawSites, i), 2);
    const x = finite(E, at(E, pair, 0)), y = finite(E, at(E, pair, 1));
    if (x < 0 || x > width || y < 0 || y > height) throw new E("INVALID_INPUT");
  }
  const maxWork = integer(E, at(E, input, "maxWork"), 0, Number.MAX_SAFE_INTEGER);
  if (rawSites.length === 0 && total > 0) throw new E("INVALID_INPUT");
  const required = size + active * rawSites.length;
  if (!Number.isSafeInteger(required) || required > maxWork) throw new E("WORK_LIMIT");
  const sites = new Array(rawSites.length);
  for (let i = 0; i < rawSites.length; i += 1) {
    const pair = at(E, rawSites, i);
    sites[i] = [finite(E, at(E, pair, 0)), finite(E, at(E, pair, 1))];
  }
  if (total === 0) return { sites: sites.map((site) => site.slice()), masses: sites.map(() => 0) };

  const coordinates = sites.map(([x, y]) => [dyadic(x), dyadic(y)]);
  let scale = 1;
  for (const [x, y] of coordinates) scale = Math.max(scale, x.shift, y.shift);
  const scaledSites = coordinates.map(([x, y]) => [x.numerator << BigInt(scale - x.shift), y.numerator << BigInt(scale - y.shift)]);
  const halfShift = BigInt(scale - 1);
  const mass = sites.map(() => 0n), sumX = sites.map(() => 0n), sumY = sites.map(() => 0n);
  const rowDistance = new Array(sites.length);
  for (let row = 0; row < height; row += 1) {
    // Avoid O(rows*sites) cached-distance work on empty rows: the contract
    // bounds the search by positive-weight pixels, including sparse rasters.
    let hasMass = false;
    for (let column = 0; column < width; column += 1) {
      if (at(E, weights, row * width + column) > 0) { hasMass = true; break; }
    }
    if (!hasMass) continue;
    const centerY = BigInt(2 * row + 1) << halfShift;
    for (let j = 0; j < sites.length; j += 1) {
      const difference = centerY - scaledSites[j][1];
      rowDistance[j] = difference * difference;
    }
    for (let column = 0; column < width; column += 1) {
      const weight = at(E, weights, row * width + column);
      if (weight === 0) continue;
      const centerX = BigInt(2 * column + 1) << halfShift;
      let selected = 0, best = null;
      for (let j = 0; j < sites.length; j += 1) {
        const difference = centerX - scaledSites[j][0];
        const distance = difference * difference + rowDistance[j];
        if (best === null || distance < best) { best = distance; selected = j; }
      }
      const amount = BigInt(weight);
      mass[selected] += amount;
      sumX[selected] += amount * BigInt(column);
      sumY[selected] += amount * BigInt(row);
    }
  }
  const moved = sites.map((site, j) => mass[j] === 0n ? site.slice() : [
    new ExactRational(2n * sumX[j] + mass[j], 2n * mass[j]).value(),
    new ExactRational(2n * sumY[j] + mass[j], 2n * mass[j]).value(),
  ]);
  return { sites: moved, masses: mass.map(Number) };
}
