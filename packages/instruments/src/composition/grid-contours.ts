import { componentSeed } from "./core.js";
import type { Path } from "./types.js";

/**
 * Contour lines of a sampled scalar grid as open and closed chains, in linear time.
 *
 * Why a second contour assembler: `contourChains` (Contour Scores, sand isolines) matches segment ends
 * geometrically and is quadratic, capped at 2,200 segments per level. A terrain of 100,000 cells has
 * thousands of segments on one level, so this module assembles chains by table lookup over grid edges.
 *
 * FIELD. `values[j * columns + i]` is the sample at `(x0 + i dx, y0 + j dy)`. A sample `>= level` is inside
 * (a sample exactly at the level counts as inside, so a contour never runs along a flat exactly at the
 * level). A contour crosses a grid edge where exactly one end is inside, at the linear position
 * `(level - a) / (b - a)` from the first end; the crossing therefore does not depend on the cell case.
 * A cell whose diagonal corners are the two inside samples (a saddle) joins them when the mean of its four
 * samples is at least the level, otherwise it keeps them apart. Grid edges are shared, so chains are
 * exactly watertight; a chain that meets the grid boundary is open there (nothing is drawn beyond the
 * grid), every other chain is closed.
 *
 * IDENTITY. `contour:<levelIndex>:<edge>` where `edge` is the smallest crossing id on the chain (its
 * first end for an open chain): horizontal edge `(i,j)-(i+1,j)` is `j (columns - 1) + i`, vertical edge
 * `(i,j)-(i,j+1)` is `(columns - 1) rows + j columns + i`. It depends on the grid and the field only, not
 * on the order levels are asked for. Seeds are `componentSeed(seed, id, "path")`.
 *
 * ORIENTATION. Open chains run from the smaller end id; closed chains start at their smallest edge id and go
 * toward its lower-id neighbour. `Path.level` is the level, `levelFraction` its position in `levels`.
 *
 * BOUNDS. `O(columns × rows)` per level plus the segments. At most `MAX_CONTOUR_VERTICES` vertices in all;
 * exceeding it throws `advice` appended to the message (name the control that raises the level spacing).
 */
export const MAX_CONTOUR_VERTICES = 1_500_000;

export interface ContourGrid {
  readonly values: ArrayLike<number>;
  readonly columns: number;
  readonly rows: number;
  readonly x0: number; readonly y0: number; readonly dx: number; readonly dy: number;
}

/** Segments of a 4-bit corner mask (a=1 top-left, b=2 top-right, c=4 bottom-right, d=8 bottom-left) as edge pairs; edges 0 top, 1 right, 2 bottom, 3 left. */
const PAIRS: readonly (readonly (readonly [number, number])[])[] = [
  [], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [], [[0, 2]], [[3, 2]],
  [[3, 2]], [[0, 2]], [], [[1, 2]], [[3, 1]], [[0, 1]], [[3, 0]], [],
];
/** The saddle cases, by whether the cell centre is inside. */
const SADDLE: Record<number, readonly (readonly [number, number])[][]> = {
  5: [[[0, 1], [3, 2]], [[3, 0], [1, 2]]],
  10: [[[3, 0], [1, 2]], [[0, 1], [3, 2]]],
};

/** Chains of every level of `levels`. `advice` is appended to the vertex-bound message. */
export function gridContours(grid: ContourGrid, levels: readonly number[], seed: number, advice = ""): readonly Path[] {
  const { values, columns, rows } = grid;
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 2 || rows < 2 || values.length !== columns * rows)
    throw new Error("Contours need integer columns and rows of at least 2 and exactly columns × rows values");
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Contour seed must be a uint32 integer");
  const horizontal = (columns - 1) * rows, edges = horizontal + columns * (rows - 1);
  const linkA = new Int32Array(edges), linkB = new Int32Array(edges);
  const paths: Path[] = [];
  let vertices = 0;
  levels.forEach((level, levelIndex) => {
    if (!Number.isFinite(level)) throw new Error(`Contour level ${levelIndex} must be finite`);
    linkA.fill(-1); linkB.fill(-1);
    const touched: number[] = [];
    const link = (p: number, q: number) => {
      if (linkA[p] < 0) linkA[p] = q; else linkB[p] = q;
      if (linkA[q] < 0) linkA[q] = p; else linkB[q] = p;
      touched.push(p, q);
    };
    for (let j = 0; j + 1 < rows; j++) for (let i = 0; i + 1 < columns; i++) {
      const a = values[j * columns + i], b = values[j * columns + i + 1], c = values[(j + 1) * columns + i + 1], d = values[(j + 1) * columns + i];
      const mask = (a >= level ? 1 : 0) | (b >= level ? 2 : 0) | (c >= level ? 4 : 0) | (d >= level ? 8 : 0);
      if (mask === 0 || mask === 15) continue;
      const ids = [j * (columns - 1) + i, horizontal + j * columns + i + 1, (j + 1) * (columns - 1) + i, horizontal + j * columns + i];
      const pairs = mask === 5 || mask === 10 ? SADDLE[mask][(a + b + c + d) / 4 >= level ? 0 : 1] : PAIRS[mask];
      for (const [e1, e2] of pairs) link(ids[e1], ids[e2]);
    }
    const crossing = (edge: number): readonly [number, number] => {
      if (edge < horizontal) {
        const i = edge % (columns - 1), j = (edge - i) / (columns - 1), a = values[j * columns + i], b = values[j * columns + i + 1];
        return [grid.x0 + (i + (level - a) / (b - a)) * grid.dx, grid.y0 + j * grid.dy];
      }
      const local = edge - horizontal, i = local % columns, j = (local - i) / columns, a = values[j * columns + i], b = values[(j + 1) * columns + i];
      return [grid.x0 + i * grid.dx, grid.y0 + (j + (level - a) / (b - a)) * grid.dy];
    };
    const seen = new Set<number>();
    const walk = (start: number, first: number): number[] => {
      const chain = [start];
      seen.add(start);
      let previous = start, at = first;
      while (at >= 0 && at !== start && !seen.has(at)) {
        chain.push(at); seen.add(at);
        const next = linkA[at] !== previous ? linkA[at] : linkB[at];
        previous = at; at = next;
      }
      return chain;
    };
    const emit = (chain: number[], closed: boolean) => {
      vertices += chain.length;
      if (vertices > MAX_CONTOUR_VERTICES) throw new Error(`Contours would exceed ${MAX_CONTOUR_VERTICES} vertices${advice}`);
      const id = `contour:${levelIndex}:${closed ? Math.min(...chain) : Math.min(chain[0], chain[chain.length - 1])}`;
      const ordered = closed || chain[0] <= chain[chain.length - 1] ? chain : chain.slice().reverse();
      paths.push(Object.freeze({ id, seed: componentSeed(seed, id, "path"), closed, level,
        levelFraction: levels.length > 1 ? levelIndex / (levels.length - 1) : 0,
        points: Object.freeze(ordered.map((edge) => Object.freeze(crossing(edge)))) }));
    };
    const ends = [...new Set(touched)].sort((p, q) => p - q);
    for (const edge of ends) {
      if (seen.has(edge) || (linkA[edge] >= 0 && linkB[edge] >= 0)) continue;
      emit(walk(edge, linkA[edge]), false);
    }
    for (const edge of ends) {
      if (seen.has(edge)) continue;
      emit(walk(edge, Math.min(linkA[edge], linkB[edge])), true);
    }
  });
  return Object.freeze(paths);
}
