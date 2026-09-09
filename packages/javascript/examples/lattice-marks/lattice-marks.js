import { occupiedLatticePaths2D } from "../../src/occupied-lattice-paths.js";
import { cyclicPalette } from "../../src/cyclic-palette.js";

/**
 * Example composition motivated by the LatticeMarks authored piece. Grows paths from
 * ordered starts across a 24x24 lattice; all cell-claiming, movement, and completion
 * logic is performed by the public path.occupied-lattice-paths-2d operation. These
 * constants (start layout, step/count budgets, palette) describe this piece, not
 * operation defaults or recommended ranges. See
 * catalog/validation/occupied-lattice-paths-2d.json, targets.processing-java.technique.
 */
export const BACKGROUND_RGB = 0xf3f0e8;
export const GRID_RGB = 0xcdc8be;
export const GUIDE_RGB = 0x1e1e1e;
export const ENDPOINT_RGB = 0xfffae6;
export const PALETTES = [
  cyclicPalette({ colors: [0x173f5f, 0xaf5441, 0xe9c46a, 0x347969] }),
  cyclicPalette({ colors: [0x493657, 0xb85065, 0xe6b89c, 0x467c89] }),
];
export const CELL_PIXEL_OFFSET = 44;
export const CELL_PIXEL_STEP = 24;
export const GRID_CELLS = 24;

/** Retained lattice paths for style-only colour/dot/width edits; N/L/R/0 all rebuild. */
export function createLatticeMarks(seed = 42, many = false, longPaths = false) {
  const count = many ? 36 : 12;
  const steps = longPaths ? 36 : 12;
  const starts = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const source = (13 * i) % 36;
    starts[i] = [2 + 4 * (source % 6), 2 + 4 * Math.floor(source / 6)];
  }
  const paths = occupiedLatticePaths2D({
    dimensions: [GRID_CELLS, GRID_CELLS],
    starts,
    maxSteps: steps,
    maxCells: count * (steps + 1),
    random: { seed },
  });
  return Object.freeze({ seed, many, longPaths, paths });
}

/** Converts a lattice cell coordinate to a pixel coordinate, matching LatticeComposition.pixel. */
export function cellPixel(index) {
  return CELL_PIXEL_OFFSET + CELL_PIXEL_STEP * index;
}

/** Samples the path colour from a palette by path index, matching the Java sample(path*.173) call. */
export function pathColour(paletteIndex, path) {
  return PALETTES[paletteIndex].sample(path * 0.173);
}
