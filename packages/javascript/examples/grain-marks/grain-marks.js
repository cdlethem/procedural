import { seededTrianglePoints2D, mapTriangleCoordinates2D } from "../../src/triangle-points.js";
import { seededQuadrantPartition2D } from "../../src/quadrant-partition.js";

/** Editable grain composition motivated by puntis and puntis3.
 * Density, triangle construction and biased expressions are example choices.
 * Sampling/mapping operations retain points; content and style remain independent.
 */
export function createGrainComposition(seed, density, distribution, cells) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff
      || !Number.isFinite(density) || density < 0
      || !Number.isInteger(distribution) || distribution < 0 || distribution > 2
      || typeof cells !== "boolean") throw new Error("Invalid example configuration");
  const triangles = [];
  if (!cells) triangles.push([[40, 600], [320, 40], [600, 600]]);
  else {
    const layout = seededQuadrantPartition2D({seed, replacements: 4, selectionFraction: 0.5,
      origin: [0, 0], extent: [640, 640]});
    const bounds = new Float64Array(4);
    for (let i = 0; i < layout.size; i++) {
      layout.boundsInto(i, bounds);
      const [l, t, r, b] = bounds;
      triangles.push([[l, t], [r, t], [r, b]], [[l, t], [r, b], [l, b]]);
    }
  }
  let totalPoints = 0;
  const counts = triangles.map(([a, b, c]) => {
    const area = Math.abs((b[0] - a[0]) * (c[1] - a[1])
      - (b[1] - a[1]) * (c[0] - a[0])) * 0.5;
    const count = Math.ceil(area * density);
    if (!Number.isFinite(count) || count > 160000 - totalPoints)
      throw new Error("Example exceeds 160000-point work budget");
    totalPoints += count;
    return count;
  });
  const regions = triangles.map((triangle, index) => {
    const regionSeed = (seed + index) >>> 0;
    if (distribution === 0)
      return seededTrianglePoints2D({seed: regionSeed, count: counts[index], triangle});
    const random = javaExampleRandom(regionSeed);
    const unitCoordinates = [];
    for (let p = 0; p < counts[index]; p++) {
      let u, v;
      if (distribution === 1) {
        u = random() * random();
        v = random();
      } else {
        const side = random() < 0.5 ? 0 : 1;
        const lower = side * 0.8;
        v = (lower + (1 - lower) * random()) * (0.4 + 0.6 * random());
        u = random();
      }
      unitCoordinates.push([u, v]);
    }
    return mapTriangleCoordinates2D({triangle, unitCoordinates});
  });
  return Object.freeze({size: regions.length, totalPoints,
    regionAt(index) { return regions[index]; }});
}

// Example-only java.util.Random nextDouble sequence, matching GrainComposition.
// This does not expose or alter the library's private xoshiro sampling stream.
function javaExampleRandom(seed) {
  const multiplier = 0x5deece66dn, mask = (1n << 48n) - 1n;
  let state = (BigInt(seed) ^ multiplier) & mask;
  function next(bits) {
    state = (state * multiplier + 11n) & mask;
    return Number(state >> BigInt(48 - bits));
  }
  return () => (next(26) * 134217728 + next(27)) / 9007199254740992;
}
