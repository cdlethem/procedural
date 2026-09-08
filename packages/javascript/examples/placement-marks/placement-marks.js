import { orderedCircleFilter2D, seededCirclePlacement2D } from "../../src/circle-placements.js";

export const BASE_PALETTE = Object.freeze([0x31a151, 0xffa71e, 0x05084c, 0xde4638, 0x3dbdb7]);
export const ALTERNATE_PALETTE = Object.freeze([0x2e0551, 0xff00c7, 0x01afc2, 0xfdbe03, 0xf4f9fd]);

/**
 * The inset rectangle and controls are choices for this composition, not public
 * defaults or recommended ranges. The placement result remains independent of
 * the motif and palette that later occupy it.
 */
export function createSeededPlacementMarks(seed = 42, attempts = 5000, minimum = 4, maximum = 64, separation = 1) {
  return Object.freeze({
    source: "seeded",
    placements: seededCirclePlacement2D({
      seed, attempts, origin: [64, 64], extent: [512, 512],
      radiusRange: [minimum, maximum], separationScale: separation,
    }),
  });
}

/**
 * An authored replacement for the seeded proposal source. It deliberately sends
 * its 5 × 32 proposals through the same public ordered exclusion operation.
 */
export function createRadialPlacementMarks(separation = 1) {
  const centres = [];
  const radii = [];
  const sizes = [8, 14, 20];
  for (let band = 0; band < 5; band += 1) {
    const distance = 48 * (band + 1);
    for (let index = 0; index < 32; index += 1) {
      const angle = (2 * Math.PI * index / 32) + (band * Math.PI / 32);
      centres.push([320 + distance * Math.cos(angle), 320 + distance * Math.sin(angle)]);
      radii.push(sizes[(band * 32 + index) % sizes.length]);
    }
  }
  return Object.freeze({
    source: "radial",
    placements: orderedCircleFilter2D({ centres, radii, separationScale: separation }),
  });
}

/** Rings and inscribed diamonds reuse the exact retained placement object. */
export function vertexInto(placements, circle, vertex, diamond, out) {
  const vertices = diamond ? 4 : 64;
  if (!Number.isInteger(vertex) || vertex < 0 || vertex >= vertices) {
    throw new RangeError("vertex");
  }
  placements.pointInto(circle, out, 0);
  const angle = 2 * Math.PI * vertex / vertices;
  const radius = placements.radiusAt(circle);
  out[0] += radius * Math.cos(angle);
  out[1] += radius * Math.sin(angle);
}
