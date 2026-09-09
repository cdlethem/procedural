import { seededQuadrantPartition2D } from "../../src/quadrant-partition.js";
import { delaunay2D } from "../../src/delaunay.js";
import { regularGrid } from "../../src/regular-grid.js";
import { cyclicPalette } from "../../src/cyclic-palette.js";

const WALLS_PER_FACE = 3;

/**
 * Example-only java.util.Random emulation (nextDouble + the bound-based
 * nextInt, including its overflow-rejection loop), matching CityComposition's
 * authored building-policy source. This does not expose or alter the
 * library's private xoshiro sampling stream. Verified bit-exact against real
 * java.util.Random before this module was written: 20 nextDouble() and 20
 * nextInt(7) values from seed 42, an interleaved call sequence matching this
 * module's own usage, and a 700,000-draw nextInt(7) distribution from a
 * second seed (exercising the rejection path).
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
        // Mirrors Java's 32-bit signed overflow rejection check exactly.
        if (((u - r + m) | 0) >= 0) break;
        u = this.#next(31);
      }
    }
    return r;
  }
}

/**
 * Retained editable policies for the ciscis002 city composition. Partitioning
 * (layout.seeded-quadrant-partition-2d), triangulation (topology.delaunay-2d),
 * and window coordinates (layout.regular-grid) remain library operations;
 * this module owns only the per-face policy derivation (height, palette
 * phase, ground visibility/tone, window counts/lit state, wall proportions),
 * matching CityComposition.java's authored java.util.Random-driven building
 * policy exactly (not the library's xoshiro stream). Independently composed
 * from survey/out/2019/generativos/ciscis002/notes.md; the seed, partition
 * settings, and policy formulas here are authored piece settings. See
 * catalog/validation/seeded-quadrant-partition-2d.json and
 * catalog/validation/delaunay-2d.json.
 */
class CityComposition {
  #mesh;
  #leafCount;
  #heights;
  #phases;
  #groundVisible;
  #groundGrays;
  #verticalCounts;
  #horizontalCounts;
  #windowGrids;
  #wallWidths;
  #wallHeights;
  #wallOffsets;
  #litWindows;

  constructor(mesh, leafCount, heights, phases, groundVisible, groundGrays,
    verticalCounts, horizontalCounts, windowGrids, wallWidths, wallHeights,
    wallOffsets, litWindows) {
    this.#mesh = mesh;
    this.#leafCount = leafCount;
    this.#heights = heights;
    this.#phases = phases;
    this.#groundVisible = groundVisible;
    this.#groundGrays = groundGrays;
    this.#verticalCounts = verticalCounts;
    this.#horizontalCounts = horizontalCounts;
    this.#windowGrids = windowGrids;
    this.#wallWidths = wallWidths;
    this.#wallHeights = wallHeights;
    this.#wallOffsets = wallOffsets;
    this.#litWindows = litWindows;
  }

  static create(seed) {
    const partition = seededQuadrantPartition2D({
      seed, replacements: 100, origin: [-480, -480], extent: [960, 960], selectionFraction: 0.5,
    });
    const bounds = new Float64Array(4);
    const sites = new Array(partition.size);
    for (let face = 0; face < partition.size; face += 1) {
      partition.boundsInto(face, bounds, 0);
      sites[face] = [(bounds[0] + bounds[2]) * 0.5, (bounds[1] + bounds[3]) * 0.5];
    }
    const mesh = delaunay2D({ points: sites, maxWork: 50000000 });
    const faces = mesh.faceCount;
    const heights = new Array(faces);
    const phases = new Array(faces);
    const groundVisible = new Array(faces);
    const groundGrays = new Array(faces);
    const verticalCounts = new Array(faces);
    const horizontalCounts = new Array(faces);
    const windowGrids = new Array(faces);
    const wallWidths = new Array(faces * WALLS_PER_FACE);
    const wallHeights = new Array(faces * WALLS_PER_FACE);
    const wallOffsets = new Array(wallWidths.length + 1);
    wallOffsets[0] = 0;
    const retainedLit = [];

    const policy = new JavaRandom(seed);
    for (let face = 0; face < faces; face += 1) {
      heights[face] = policy.nextDouble() * policy.nextDouble();
      phases[face] = policy.nextDouble();
      groundVisible[face] = policy.nextDouble() >= 0.2;
      groundGrays[face] = Math.floor(200 * policy.nextDouble());
      verticalCounts[face] = 16 + policy.nextInt(7);
      horizontalCounts[face] = 16 + policy.nextInt(7);
      const vertical = verticalCounts[face];
      const horizontal = horizontalCounts[face];
      windowGrids[face] = regularGrid({
        origin: [0.5 / vertical, 0.5 / horizontal],
        spacing: [1 / vertical, 1 / horizontal],
        columns: vertical, rows: horizontal,
      });
      for (let wall = 0; wall < WALLS_PER_FACE; wall += 1) {
        const wallIndex = face * WALLS_PER_FACE + wall;
        const litProbability = (0.2 + 0.6 * policy.nextDouble()) * policy.nextDouble();
        wallWidths[wallIndex] = 0.2 + 0.7 * policy.nextDouble();
        wallHeights[wallIndex] = 0.2 + 0.7 * policy.nextDouble();
        const start = wallOffsets[wallIndex];
        // The source traverses rows (j) before columns (i).
        for (let j = 0; j < horizontal; j += 1) {
          for (let i = 0; i < vertical; i += 1) {
            retainedLit[start + j * vertical + i] = policy.nextDouble() < litProbability;
          }
        }
        wallOffsets[wallIndex + 1] = start + vertical * horizontal;
      }
    }
    const litWindows = retainedLit.slice(0, wallOffsets[wallOffsets.length - 1]);
    return new CityComposition(mesh, partition.size, heights, phases, groundVisible, groundGrays,
      verticalCounts, horizontalCounts, windowGrids, wallWidths, wallHeights, wallOffsets, litWindows);
  }

  get mesh() { return this.#mesh; }
  get leafCount() { return this.#leafCount; }
  get windowCount() { return this.#litWindows.length; }
  heightUnit(face) { return this.#heights[face]; }
  palettePhase(face) { return this.#phases[face]; }
  groundVisible(face) { return this.#groundVisible[face]; }
  groundGray(face) { return this.#groundGrays[face]; }
  verticalCount(face) { return this.#verticalCounts[face]; }
  horizontalCount(face) { return this.#horizontalCounts[face]; }
  wallWidthFraction(face, wall) { return this.#wallWidths[this.#wallIndex(face, wall)]; }
  wallHeightFraction(face, wall) { return this.#wallHeights[this.#wallIndex(face, wall)]; }
  windowLit(face, wall, index) {
    const wallIndex = this.#wallIndex(face, wall);
    const count = this.#verticalCounts[face] * this.#horizontalCounts[face];
    if (index < 0 || index >= count) throw new RangeError("window index");
    return this.#litWindows[this.#wallOffsets[wallIndex] + index];
  }
  windowGrid(face) { return this.#windowGrids[face]; }

  #wallIndex(face, wall) {
    if (wall < 0 || wall >= WALLS_PER_FACE) throw new RangeError("wall");
    if (face < 0 || face >= this.#heights.length) throw new RangeError("face");
    return face * WALLS_PER_FACE + wall;
  }
}

export function createCityComposition(seed) {
  return CityComposition.create(seed);
}

export { JavaRandom, cyclicPalette };
