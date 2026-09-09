import { gradientNoise2D01 } from "../../src/gradient-noise-2d-01.js";
import { orderedCircleFilter2D } from "../../src/circle-placements.js";
import { delaunay2D } from "../../src/delaunay.js";

const HORIZON_LAYERS = 3;
const PROPOSAL_COUNT = 50;
const TRIANGULATION_WORK = 50000000;

/**
 * Example-only java.util.Random emulation (nextDouble + the bound-based
 * nextInt, including its overflow-rejection loop), matching
 * LandscapeComposition's authored building-policy source. Duplicated per
 * module per the established convention (see city-marks.js's identical
 * class, itself verified bit-exact against real java.util.Random -- 20
 * nextDouble/nextInt(7) values, an interleaved sequence, and a 700,000-draw
 * nextInt(7) distribution exercising the overflow-rejection path).
 */
class JavaRandom {
  #state;
  static #MULT = 0x5deece66dn;
  static #MASK = (1n << 48n) - 1n;

  constructor(seed) {
    this.#state = (BigInt(seed >>> 0) ^ JavaRandom.#MULT) & JavaRandom.#MASK;
  }

  #next(bits) {
    this.#state = (this.#state * JavaRandom.#MULT + 11n) & JavaRandom.#MASK;
    return Number(this.#state >> BigInt(48 - bits));
  }

  nextDouble() {
    return (this.#next(26) * 134217728 + this.#next(27)) / 9007199254740992;
  }

  nextInt(bound) {
    if (bound <= 0) throw new RangeError("bound must be positive");
    let r = this.#next(31);
    const m = bound - 1;
    if ((bound & m) === 0) {
      r = Math.floor((bound * r) / 2147483648);
    } else {
      let u = r;
      for (;;) {
        r = u % bound;
        if (((u - r + m) | 0) >= 0) break;
        u = this.#next(31);
      }
    }
    return r;
  }
}

function stripeIndex(sky, side) {
  if (side < 0 || side >= 2) throw new RangeError("stripe side");
  return (sky ? 2 : 0) + side;
}

/**
 * Retained composition policies for the parapara landscape recreation. The
 * noise field (field.gradient-noise-2d-01), ordered circle filter
 * (sampling.ordered-circle-filter-2d), and Delaunay mesh
 * (topology.delaunay-2d) are reusable operations; this module owns only the
 * java.util.Random-driven retained distributions and palette-index choices,
 * matching LandscapeComposition.java line-for-line (not the library's
 * xoshiro stream). Independently composed from
 * survey/out/2019/generativos/parapara/notes.md; the seed, proposal count,
 * and policy formulas here are authored piece settings. See
 * catalog/validation/gradient-noise-2d-01.json,
 * catalog/validation/ordered-circle-filter-2d.json, and
 * catalog/validation/delaunay-2d.json.
 */
class LandscapeComposition {
  #horizon;
  #noise;
  #horizonFrequencies;
  #horizonColors;
  #stripeStarts;
  #stripeDrifts;
  #placements;
  #mesh;
  #diskColors;
  #haloColors;
  #innerColors;
  #speckSizes;
  #speckAngles;
  #speckStretches;
  #speckColors;

  constructor(horizon, noise, horizonFrequencies, horizonColors, stripeStarts, stripeDrifts,
    placements, mesh, diskColors, haloColors, innerColors, speckSizes, speckAngles, speckStretches, speckColors) {
    this.#horizon = horizon;
    this.#noise = noise;
    this.#horizonFrequencies = horizonFrequencies;
    this.#horizonColors = horizonColors;
    this.#stripeStarts = stripeStarts;
    this.#stripeDrifts = stripeDrifts;
    this.#placements = placements;
    this.#mesh = mesh;
    this.#diskColors = diskColors;
    this.#haloColors = haloColors;
    this.#innerColors = innerColors;
    this.#speckSizes = speckSizes;
    this.#speckAngles = speckAngles;
    this.#speckStretches = speckStretches;
    this.#speckColors = speckColors;
  }

  static create(seed) {
    const policy = new JavaRandom(seed);
    const horizon = 0.15 + 0.15 * policy.nextDouble();
    const noise = gradientNoise2D01({ seed });

    const horizonFrequencies = new Array(HORIZON_LAYERS);
    const horizonColors = new Array(HORIZON_LAYERS);
    for (let layer = 0; layer < HORIZON_LAYERS; layer += 1) {
      horizonFrequencies[layer] = 0.01 * policy.nextDouble();
      horizonColors[layer] = policy.nextInt(9);
    }

    const stripeStarts = new Array(4);
    const stripeDrifts = new Array(4);
    for (let skyIndex = 0; skyIndex < 2; skyIndex += 1) {
      const sky = skyIndex !== 0;
      for (let side = 0; side < 2; side += 1) {
        const index = stripeIndex(sky, side);
        stripeStarts[index] = 9 * policy.nextDouble();
        stripeDrifts[index] = 0.1 * policy.nextDouble() * (0.4 + 0.6 * policy.nextDouble()) * horizon * (sky ? 0.1 : 1);
      }
    }

    const centres = new Array(PROPOSAL_COUNT);
    const radii = new Array(PROPOSAL_COUNT);
    for (let proposal = 0; proposal < PROPOSAL_COUNT; proposal += 1) {
      const depth = 0.98 * policy.nextDouble() * policy.nextDouble();
      const x = 960 * policy.nextDouble();
      const y = 960 * (horizon + depth * (1 - horizon));
      const diameter = (0.06 + Math.pow(depth, 1.4)) * 120;
      centres[proposal] = [x, y];
      radii[proposal] = diameter * 0.5;
    }
    const placements = orderedCircleFilter2D({ centres, radii, separationScale: 1.2 });
    const acceptedCentres = new Array(placements.size);
    const point = new Float64Array(2);
    for (let index = 0; index < placements.size; index += 1) {
      placements.pointInto(index, point, 0);
      acceptedCentres[index] = [point[0], point[1]];
    }
    const mesh = delaunay2D({ points: acceptedCentres, maxWork: TRIANGULATION_WORK });

    const accepted = placements.size;
    const diskColors = new Array(accepted);
    const haloColors = new Array(accepted);
    const innerColors = new Array(accepted);
    for (let index = 0; index < accepted; index += 1) {
      diskColors[index] = policy.nextInt(9);
      haloColors[index] = policy.nextInt(9);
      innerColors[index] = policy.nextInt(9);
    }

    const faces = mesh.faceCount;
    const speckSizes = new Array(faces);
    const speckAngles = new Array(faces);
    const speckStretches = new Array(faces);
    const speckColors = new Array(faces);
    for (let face = 0; face < faces; face += 1) {
      speckSizes[face] = 3 * policy.nextDouble();
      speckAngles[face] = Math.PI * policy.nextDouble();
      speckStretches[face] = 200 * policy.nextDouble();
      speckColors[face] = policy.nextInt(9);
    }

    return new LandscapeComposition(horizon, noise, horizonFrequencies, horizonColors,
      stripeStarts, stripeDrifts, placements, mesh, diskColors, haloColors, innerColors,
      speckSizes, speckAngles, speckStretches, speckColors);
  }

  get horizon() { return this.#horizon; }
  get noise() { return this.#noise; }
  horizonFrequency(layer) { return this.#horizonFrequencies[layer]; }
  horizonColor(layer) { return this.#horizonColors[layer]; }
  stripeStart(sky, side) { return this.#stripeStarts[stripeIndex(sky, side)]; }
  stripeDrift(sky, side) { return this.#stripeDrifts[stripeIndex(sky, side)]; }
  get placements() { return this.#placements; }
  get mesh() { return this.#mesh; }
  diskColor(index) { return this.#diskColors[index]; }
  haloColor(index) { return this.#haloColors[index]; }
  innerColor(index) { return this.#innerColors[index]; }
  speckSize(face) { return this.#speckSizes[face]; }
  speckAngle(face) { return this.#speckAngles[face]; }
  speckStretch(face) { return this.#speckStretches[face]; }
  speckColor(face) { return this.#speckColors[face]; }
}

export function createLandscapeComposition(seed) {
  return LandscapeComposition.create(seed);
}

export { JavaRandom };
