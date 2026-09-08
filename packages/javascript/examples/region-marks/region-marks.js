import { seededQuadrantPartition2D } from "../../src/quadrant-partition.js";
import { regularGrid } from "../../src/regular-grid.js";

/** Editable RegionMarks composition, matching the accepted Java example.
 * Motivated by mosaic02 and chinasseForms; canvas and content are example choices,
 * not operation defaults. The seeded partition owns geometry; drawing stays outside it.
 */
export function createSeededRegions(seed, replacements, selectionFraction) {
  return composition(seededQuadrantPartition2D({
    seed, replacements, origin: [0, 0], extent: [640, 640], selectionFraction,
  }), null);
}

/** Authored alternative: two explicit rectangular-grid replacements.
 * This deliberately ordinary example code can be replaced with an artist's own cells.
 */
export function createAuthoredRegions() {
  const cells = [[0, 0, 640, 640, 0]];
  replaceGrid(cells, 0, 2, 3, 1);
  replaceGrid(cells, 3, 2, 3, 7);
  return composition(null, cells);
}

function replaceGrid(cells, id, columns, rows, nextId) {
  const selected = cells.findIndex((cell) => cell[4] === id);
  if (selected < 0) throw new Error("Missing authored cell");
  const [parent] = cells.splice(selected, 1);
  const width = parent[2] - parent[0], height = parent[3] - parent[1];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      cells.push([
        parent[0] + width * column / columns,
        parent[1] + height * row / rows,
        column + 1 === columns ? parent[2] : parent[0] + width * (column + 1) / columns,
        row + 1 === rows ? parent[3] : parent[1] + height * (row + 1) / rows,
        nextId++,
      ]);
    }
  }
}

function composition(partition, cells) {
  const marks = regularGrid({
    origin: [1 / 6, 1 / 6], spacing: [1 / 3, 1 / 3], columns: 3, rows: 3,
  });
  return Object.freeze({
    partition,
    size: partition === null ? cells.length : partition.size,
    idAt(index) { return partition === null ? cells[index][4] : partition.idAt(index); },
    boundsInto(index, out) {
      if (partition !== null) partition.boundsInto(index, out, 0);
      else for (let slot = 0; slot < 4; slot += 1) out[slot] = cells[index][slot];
    },
    markInto(index, bounds, out) {
      marks.pointInto(index, out, 0);
      out[0] = bounds[0] + (bounds[2] - bounds[0]) * out[0];
      out[1] = bounds[1] + (bounds[3] - bounds[1]) * out[1];
    },
  });
}
