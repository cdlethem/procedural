import { orderedConvexPolygonFilter2D } from "../../src/convex-polygon-placements.js";

// Example-only java.util.Random nextDouble sequence, matching PolygonComposition's
// authored pose source. This does not expose or alter the library's private
// xoshiro sampling stream. Duplicated per-module per the established convention
// (see facet-marks.js/grain-marks.js/cut-marks.js's identical helper).
function javaExampleRandom(seed) {
  const multiplier = 0x5deece66dn, mask = (1n << 48n) - 1n;
  let state = (BigInt(seed) ^ multiplier) & mask;
  function next(bits) {
    state = (state * multiplier + 11n) & mask;
    return Number(state >> BigInt(48 - bits));
  }
  return () => (next(26) * 134217728 + next(27)) / 9007199254740992;
}

export const COLORS = Object.freeze([0xef276b, 0xa14fbe, 0x1d43b8, 0xf8ca9c]);
const POSE_COUNT = 600;

function rebuildPoses(seed) {
  const random = javaExampleRandom(seed);
  const poses = new Array(POSE_COUNT);
  for (let i = 0; i < POSE_COUNT; i += 1) {
    poses[i] = [
      24 + 464 * random(),
      24 + 464 * random(),
      12 + 85 * random() * random(),
      2 * Math.PI * random(),
    ];
  }
  return poses;
}

function rebuildPlacements(poses, ratio, shape) {
  const proposals = new Array(poses.length);
  for (let i = 0; i < poses.length; i += 1) {
    const [x, y, length, angle] = poses[i];
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const count = shape === 0 ? 12 : 4;
    const polygon = new Array(count);
    for (let j = 0; j < count; j += 1) {
      let u, v;
      if (shape === 1) {
        const a = j * Math.PI / 2;
        u = length * Math.cos(a);
        v = length * ratio * Math.sin(a);
      } else {
        // Two semicircular ends sampled as the actual collision/drawing outline.
        const half = count / 2;
        const a = -Math.PI / 2 + (j % half) * Math.PI / (half - 1) + (j >= half ? Math.PI : 0);
        u = (j < half ? length / 2 : -length / 2) + length * ratio / 2 * Math.cos(a);
        v = length * ratio / 2 * Math.sin(a);
      }
      polygon[j] = [x + u * ca - v * sa, y + u * sa + v * ca];
    }
    proposals[i] = polygon;
  }
  return orderedConvexPolygonFilter2D({ polygons: proposals });
}

/**
 * Editable seeded convex-outline placement filter for PolygonMarks. Independently
 * composed from survey/out/2017/Generativos/celular/notes.md and celular2/notes.md's
 * outline-placement motivation. Seed, pose count, shape ratio, and colors here are
 * authored piece settings, not ConvexPolygonPlacements2D defaults or recommended
 * operation ranges. See catalog/validation/convex-polygon-placements.json,
 * targets.processing-java.technique.
 */
class PolygonComposition {
  #seed = 42;
  #ratio = 0.8;
  #shape = 0;
  #alternate = false;
  #poses;
  #placements;

  constructor() {
    this.#poses = rebuildPoses(this.#seed);
    this.#placements = rebuildPlacements(this.#poses, this.#ratio, this.#shape);
  }

  get seed() { return this.#seed; }
  get ratio() { return this.#ratio; }
  get shape() { return this.#shape; }
  get alternate() { return this.#alternate; }
  get placements() { return this.#placements; }

  toggleRatio() {
    this.#ratio = this.#ratio === 0.8 ? 0.2 : 0.8;
    this.#placements = rebuildPlacements(this.#poses, this.#ratio, this.#shape);
  }

  toggleShape() {
    this.#shape = 1 - this.#shape;
    this.#placements = rebuildPlacements(this.#poses, this.#ratio, this.#shape);
  }

  toggleAlternate() { this.#alternate = !this.#alternate; }

  nextSeed() {
    this.#seed += 1;
    this.#poses = rebuildPoses(this.#seed);
    this.#placements = rebuildPlacements(this.#poses, this.#ratio, this.#shape);
  }

  reset() {
    this.#seed = 42;
    this.#ratio = 0.8;
    this.#shape = 0;
    this.#alternate = false;
    this.#poses = rebuildPoses(this.#seed);
    this.#placements = rebuildPlacements(this.#poses, this.#ratio, this.#shape);
  }
}

export function createPolygonMarks() {
  return new PolygonComposition();
}
