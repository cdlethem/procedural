/**
 * Flow routing on a height grid: depression filling, D8 receivers and accumulation.
 *
 * GRID. `height[j * columns + i]` is the elevation of cell `(i, j)`, row-major, row 0 at the top. Cells are
 * square. Elevations and drainage areas are in DOMAIN UNITS: the longer side of the grid is 1, so the
 * spacing between cell centres is `h = 1 / max(columns, rows)` and a cell has area `h²`. Nothing here knows
 * canvas coordinates.
 *
 * OUTLETS. A boolean mask of cells that hold the base level. They are never routed anywhere: water that
 * reaches one leaves the model. Every other cell is an ordinary cell, including cells on a closed border
 * (nothing crosses a closed border).
 *
 * DEPRESSIONS. `fillDepressions` is Priority-Flood with an epsilon (Barnes, Lehman and Mulla 2014), seeded at
 * the outlets and flooding inwards over the 8-neighbourhood. A neighbour `n` of the cell `c` just taken from
 * the queue becomes `filled[n] = max(height[n], filled[c] + EPSILON)`. Consequences, each tested:
 *   - `filled >= height` everywhere and `filled === height` where no depression was filled;
 *   - a depression fills exactly to its spill elevation (the lowest pass to an outlet) plus a rise of EPSILON
 *     per cell along the flood order, so flat lakes drain, they are never left flat;
 *   - every non-outlet cell has a neighbour that is STRICTLY lower on `filled` (the cell it was flooded from),
 *     so no cell is a sink, there are no flats and routing cannot cycle.
 * TIE RULE. The queue orders by `filled` value, then by the order in which cells were queued (first in, first
 * out). Outlets are queued in ascending index; neighbours in the fixed order E, SE, S, SW, W, NW, N, NE.
 * The pop order is non-decreasing in `filled`, is returned as `order`, and is a valid topological order
 * (every receiver comes before the cells that drain to it).
 *
 * D8. A cell's receiver is the neighbour of steepest descent on `filled`, slope `(filled[c] - filled[n]) / d`
 * with `d = h` (edge neighbour) or `h √2` (diagonal). Ties keep the first neighbour in the same fixed order
 * E, SE, S, SW, W, NW, N, NE. Outlets have receiver -1.
 *
 * ACCUMULATION. `accumulateFlow(receivers, order, source)` sums `source` over each cell and everything that
 * drains to it (dimensionless when `source` is the rain weight; multiply by `h²` for area in domain units).
 * Conservation: the accumulation of the outlets sums to the total source, exactly for integer sources.
 *
 * Work is O(n log n) for the filling queue and O(n) for the rest (n = cells). Buffers are allocated per call;
 * results are plain typed arrays that the caller owns.
 */
export const EPSILON = 1e-7;
export const MAX_GRID_CELLS = 262_144;
export type OutletMode = "edges" | "bottom" | "sides" | "single";
export const outletModes: readonly OutletMode[] = Object.freeze(["edges", "bottom", "sides", "single"]);

/** Neighbour offsets in the fixed tie-breaking order E, SE, S, SW, W, NW, N, NE. */
export const NEIGHBOR_X: readonly number[] = Object.freeze([1, 1, 0, -1, -1, -1, 0, 1]);
export const NEIGHBOR_Y: readonly number[] = Object.freeze([0, 1, 1, 1, 0, -1, -1, -1]);

/** Domain spacing between cell centres. */
export const gridSpacing = (columns: number, rows: number): number => 1 / Math.max(columns, rows);

function checkGrid(columns: number, rows: number): void {
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 4 || rows < 4)
    throw new Error(`Grid needs integer columns and rows of at least 4 (got ${columns} × ${rows}); raise the resolution`);
  if (columns * rows > MAX_GRID_CELLS)
    throw new Error(`Grid ${columns} × ${rows} has ${columns * rows} cells, above ${MAX_GRID_CELLS}; lower the resolution`);
}

/** The outlet cells of a mode. `edges`: the whole border; `bottom`: the bottom row; `sides`: left and right columns; `single`: the middle of the bottom row. */
export function outletMask(columns: number, rows: number, mode: OutletMode): Uint8Array {
  checkGrid(columns, rows);
  if (!outletModes.includes(mode)) throw new Error(`Unknown outlet mode: ${String(mode)}`);
  const mask = new Uint8Array(columns * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const outlet = mode === "edges" ? i === 0 || j === 0 || i === columns - 1 || j === rows - 1
      : mode === "bottom" ? j === rows - 1
      : mode === "sides" ? i === 0 || i === columns - 1
      : j === rows - 1 && i === columns >> 1;
    if (outlet) mask[j * columns + i] = 1;
  }
  return mask;
}

/** Binary min-heap of cell indices ordered by (key, insertion serial). Each cell is queued at most once. */
class CellQueue {
  readonly #heap: Int32Array;
  #size = 0;
  #serial = 0;
  readonly #order: Int32Array;
  constructor(cells: number, private readonly key: Float64Array) { this.#heap = new Int32Array(cells); this.#order = new Int32Array(cells); }
  get size(): number { return this.#size; }
  #before(a: number, b: number): boolean { return this.key[a] < this.key[b] || (this.key[a] === this.key[b] && this.#order[a] < this.#order[b]); }
  push(cell: number): void {
    this.#order[cell] = this.#serial++;
    let at = this.#size++;
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (!this.#before(cell, this.#heap[parent])) break;
      this.#heap[at] = this.#heap[parent];
      at = parent;
    }
    this.#heap[at] = cell;
  }
  pop(): number {
    const top = this.#heap[0];
    const last = this.#heap[--this.#size];
    if (this.#size > 0) {
      let at = 0;
      for (;;) {
        let child = 2 * at + 1;
        if (child >= this.#size) break;
        if (child + 1 < this.#size && this.#before(this.#heap[child + 1], this.#heap[child])) child++;
        if (!this.#before(this.#heap[child], last)) break;
        this.#heap[at] = this.#heap[child];
        at = child;
      }
      this.#heap[at] = last;
    }
    return top;
  }
}

export interface FilledSurface {
  /** Elevation after depression filling, same layout as the input. */
  readonly filled: Float64Array;
  /** Cells in the order the flood reached them: ascending `filled`, a topological order (receivers first). */
  readonly order: Int32Array;
}

/** Priority-Flood with epsilon from the outlets (see the header for the rule, the tie rule and the guarantees). */
export function fillDepressions(height: ArrayLike<number>, columns: number, rows: number, outlets: Uint8Array, cancelled?: () => boolean): FilledSurface {
  checkGrid(columns, rows);
  const n = columns * rows;
  if (height.length !== n || outlets.length !== n) throw new Error(`Height and outlets need ${columns} × ${rows} = ${n} values`);
  const filled = new Float64Array(n), order = new Int32Array(n), closed = new Uint8Array(n);
  const queue = new CellQueue(n, filled);
  let seeds = 0;
  for (let c = 0; c < n; c++) {
    if (!Number.isFinite(height[c])) throw new Error(`Height[${c}] must be finite`);
    if (outlets[c]) { closed[c] = 1; filled[c] = height[c]; queue.push(c); seeds++; }
  }
  if (seeds === 0) throw new Error("The grid needs at least one outlet cell");
  let count = 0;
  while (queue.size > 0) {
    if ((count & 4095) === 0) cancelled?.();
    const c = queue.pop();
    order[count++] = c;
    const ci = c % columns, cj = (c - ci) / columns, rise = filled[c] + EPSILON;
    for (let k = 0; k < 8; k++) {
      const i = ci + NEIGHBOR_X[k], j = cj + NEIGHBOR_Y[k];
      if (i < 0 || j < 0 || i >= columns || j >= rows) continue;
      const nb = j * columns + i;
      if (closed[nb]) continue;
      closed[nb] = 1;
      filled[nb] = height[nb] > rise ? height[nb] : rise;
      queue.push(nb);
    }
  }
  if (count !== n) throw new Error("Priority flood did not reach every cell");
  return { filled, order };
}

/** Receiver of every cell (steepest D8 descent on `filled`, fixed tie order); -1 for outlets. */
export function flowReceivers(filled: ArrayLike<number>, columns: number, rows: number, outlets: Uint8Array): Int32Array {
  checkGrid(columns, rows);
  const n = columns * rows, receivers = new Int32Array(n).fill(-1), diagonal = Math.SQRT2;
  for (let c = 0; c < n; c++) {
    if (outlets[c]) continue;
    const ci = c % columns, cj = (c - ci) / columns;
    let best = -1, bestSlope = 0;
    for (let k = 0; k < 8; k++) {
      const i = ci + NEIGHBOR_X[k], j = cj + NEIGHBOR_Y[k];
      if (i < 0 || j < 0 || i >= columns || j >= rows) continue;
      const nb = j * columns + i, slope = (filled[c] - filled[nb]) / (NEIGHBOR_X[k] !== 0 && NEIGHBOR_Y[k] !== 0 ? diagonal : 1);
      if (slope > bestSlope) { bestSlope = slope; best = nb; }
    }
    if (best < 0) throw new Error(`Cell ${c} has no lower neighbour on the filled surface`);
    receivers[c] = best;
  }
  return receivers;
}

/** Sum of `source` over each cell and all cells draining to it. `order` is the flood order of `fillDepressions`. */
export function accumulateFlow(receivers: Int32Array, order: Int32Array, source: ArrayLike<number>): Float64Array {
  const n = receivers.length;
  if (order.length !== n || source.length !== n) throw new Error("Receivers, order and source must have one entry per cell");
  const flow = new Float64Array(n);
  for (let c = 0; c < n; c++) flow[c] = source[c];
  for (let k = n - 1; k >= 0; k--) {
    const c = order[k], r = receivers[c];
    if (r >= 0) flow[r] += flow[c];
  }
  return flow;
}

/** Distance between the centres of two cells in cell units: 1 for an edge neighbour, √2 for a diagonal. */
export function stepLength(columns: number, from: number, to: number): number {
  return (Math.abs((from % columns) - (to % columns)) === 1 && Math.abs(Math.floor(from / columns) - Math.floor(to / columns)) === 1) ? Math.SQRT2 : 1;
}
