import { gradientPath2D } from "../../src/gradient-path.js";
import { cyclicPalette } from "../../src/cyclic-palette.js";

const PATHS = 48;
const STEPS = 160;
export const glyphPalette = cyclicPalette({ colors: [0x183E4A, 0x347969, 0xAF5441, 0xE9C46A] });

/** Example-only JDK17-compatible java.util.Random stream. */
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

  nextInt(bound) {
    if (!Number.isSafeInteger(bound) || bound <= 0 || bound > 0x7fffffff) throw new RangeError("bound");
    let value = this.#next(31);
    const mask = bound - 1;
    if ((bound & mask) === 0) return Math.floor((bound * value) / 2147483648);
    for (;;) {
      const reduced = value % bound;
      if (((value - reduced + mask) | 0) >= 0) return reduced;
      value = this.#next(31);
    }
  }
}

function validSeed(seed) {
  return typeof seed === "number" && Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff;
}
function positive(value) { return typeof value === "number" && Number.isFinite(value) && value > 0; }
function pathConfig(seed, x, y, distance, fieldScale) {
  return {
    field: { seed }, start: [x, y], steps: STEPS, stepDistance: distance,
    fieldScale, fieldOffset: [0, 0], angleBase: 0, angleScale: 2 * Math.PI,
  };
}

/**
 * GlyphMarks owns fixed artist settings and Java-compatible metadata draws;
 * GradientPath2D alone integrates each retained path. Native text/font loading
 * remains the p5 adapter boundary, not a portable operation.
 */
class GlyphComposition {
  #paths;
  #sizes;
  #symbols;

  constructor(paths, sizes, symbols) {
    this.#paths = paths;
    this.#sizes = sizes;
    this.#symbols = symbols;
    Object.freeze(this);
  }

  static create(seed, distance, fieldScale) {
    if (!validSeed(seed) || !positive(distance) || !positive(fieldScale)) throw new RangeError("invalid GlyphComposition input");
    const random = new JavaRandom(seed);
    const paths = new Array(PATHS);
    const sizes = new Float64Array(PATHS);
    const symbols = new Int32Array(PATHS);
    for (let index = 0; index < PATHS; index += 1) {
      const x = 40 + random.nextInt(560);
      const y = 40 + random.nextInt(560);
      sizes[index] = 16 + random.nextInt(24);
      symbols[index] = random.nextInt(10);
      paths[index] = gradientPath2D(pathConfig(seed, x, y, distance, fieldScale));
    }
    return new GlyphComposition(paths, sizes, symbols);
  }

  get pathCount() { return this.#paths.length; }
  pathAt(index) { return this.#paths[this.#index(index)]; }
  sizeAt(index) { return this.#sizes[this.#index(index)]; }
  symbolIndexAt(index) { return this.#symbols[this.#index(index)]; }

  #index(index) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= PATHS) throw new RangeError("path index");
    return index;
  }
}

export function createGlyphComposition(seed, distance, fieldScale) {
  return GlyphComposition.create(seed, distance, fieldScale);
}
