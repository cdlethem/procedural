/**
 * Uniform-grid index of moving points for stateful systems (aggregation, agents, cells): insert, remove,
 * move, nearest and radius queries whose answers never depend on insertion order or hash iteration.
 * Ties are broken by id. Bounded: the grid has at most `MAX_GRID_CELLS` cells and at most `maxPoints`
 * points, and every query reports its cell and point visits to an optional `onWork` so a simulation can
 * charge them against its per-step bound.
 *
 * For a one-off set of pairs use the existing `spatial.radius-pairs-2d` operation (`radiusPairs2D`);
 * this index is for repeated queries against a changing point set.
 */

export const MAX_GRID_CELLS = 4_000_000;

export interface PointGridOptions {
  /** `[minX, minY, maxX, maxY]`; points must lie inside (edges included). */
  readonly bounds: readonly [number, number, number, number];
  /** Cell side in the same units. Choose about the typical query radius. */
  readonly cellSize: number;
  /** Most points the index accepts (default 1,000,000). */
  readonly maxPoints?: number;
  /** Called once per query with the cells and points it visited. */
  readonly onWork?: (units: number) => void;
}

export interface PointHit { readonly id: number; readonly distance: number }

interface Entry { x: number; y: number; cell: number }

export class PointGrid {
  private readonly minX: number; private readonly minY: number; private readonly maxX: number; private readonly maxY: number;
  private readonly cellSize: number;
  private readonly columns: number; private readonly rows: number;
  private readonly maxPoints: number;
  private readonly onWork: ((units: number) => void) | undefined;
  private readonly points = new Map<number, Entry>();
  private readonly cells = new Map<number, number[]>();

  constructor(options: PointGridOptions) {
    const { bounds, cellSize } = options;
    if (bounds.length !== 4 || !bounds.every(Number.isFinite) || !(bounds[2] > bounds[0]) || !(bounds[3] > bounds[1]))
      throw new Error("bounds must be finite [minX, minY, maxX, maxY] with maxX > minX and maxY > minY");
    if (!Number.isFinite(cellSize) || cellSize <= 0) throw new Error("cellSize must be a positive finite number");
    this.columns = Math.max(1, Math.ceil((bounds[2] - bounds[0]) / cellSize));
    this.rows = Math.max(1, Math.ceil((bounds[3] - bounds[1]) / cellSize));
    if (this.columns * this.rows > MAX_GRID_CELLS)
      throw new Error(`${this.columns} × ${this.rows} cells exceeds ${MAX_GRID_CELLS}; raise cellSize or shrink bounds`);
    [this.minX, this.minY, this.maxX, this.maxY] = bounds;
    this.cellSize = cellSize;
    this.maxPoints = options.maxPoints ?? 1_000_000;
    if (!Number.isSafeInteger(this.maxPoints) || this.maxPoints < 1) throw new Error("maxPoints must be a positive integer");
    this.onWork = options.onWork;
  }

  get size(): number { return this.points.size; }
  has(id: number): boolean { return this.points.has(id); }
  position(id: number): readonly [number, number] | undefined {
    const at = this.points.get(id);
    return at ? [at.x, at.y] : undefined;
  }

  private column(x: number): number { return Math.min(this.columns - 1, Math.max(0, Math.floor((x - this.minX) / this.cellSize))); }
  private row(y: number): number { return Math.min(this.rows - 1, Math.max(0, Math.floor((y - this.minY) / this.cellSize))); }

  insert(id: number, x: number, y: number): void {
    if (!Number.isSafeInteger(id) || id < 0) throw new Error("Point id must be a nonnegative safe integer");
    if (this.points.has(id)) throw new Error(`Point ${id} is already in the index`);
    if (this.points.size >= this.maxPoints) throw new Error(`The index already holds maxPoints (${this.maxPoints}) points; raise maxPoints`);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < this.minX || x > this.maxX || y < this.minY || y > this.maxY)
      throw new Error(`Point ${id} at (${x}, ${y}) lies outside bounds [${this.minX}, ${this.minY}, ${this.maxX}, ${this.maxY}]; enlarge bounds`);
    const cell = this.row(y) * this.columns + this.column(x);
    this.points.set(id, { x, y, cell });
    const list = this.cells.get(cell);
    if (list) list.push(id); else this.cells.set(cell, [id]);
  }

  remove(id: number): boolean {
    const at = this.points.get(id);
    if (!at) return false;
    this.points.delete(id);
    const list = this.cells.get(at.cell)!;
    list.splice(list.indexOf(id), 1);
    if (list.length === 0) this.cells.delete(at.cell);
    return true;
  }

  /** Same as remove + insert. */
  move(id: number, x: number, y: number): void {
    if (!this.points.has(id)) throw new Error(`Point ${id} is not in the index`);
    const before = this.position(id)!;
    this.remove(id);
    try { this.insert(id, x, y); } catch (error) { this.insert(id, before[0], before[1]); throw error; }
  }

  /**
   * The nearest point to (x, y), lowest id first among equal distances. `maxDistance` (inclusive) and
   * `exclude` narrow the search. The query point may lie outside the bounds.
   */
  nearest(x: number, y: number, options: { maxDistance?: number; exclude?: number } = {}): PointHit | null {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Query point must be finite");
    const limit = options.maxDistance ?? Infinity;
    if (!(limit >= 0)) throw new Error("maxDistance must be nonnegative");
    const cx = this.column(x), cy = this.row(y);
    const reach = Math.max(this.columns, this.rows);
    let bestId = -1, bestSquared = Infinity, visited = 0;
    for (let ring = 0; ring <= reach; ring++) {
      // Every point in a ring-r cell is at least (r - 1) cells from the query (the query is inside cell cx, cy).
      const lower = Math.max(0, ring - 1) * this.cellSize;
      if (lower > limit || (bestId >= 0 && lower * lower > bestSquared)) break;
      const x0 = cx - ring, x1 = cx + ring, y0 = cy - ring, y1 = cy + ring;
      for (let gy = Math.max(0, y0); gy <= Math.min(this.rows - 1, y1); gy++) {
        const edgeRow = gy === y0 || gy === y1;
        const step = edgeRow ? 1 : Math.max(1, x1 - x0);
        for (let gx = x0; gx <= x1; gx += step) {
          if (gx < 0 || gx >= this.columns) continue;
          visited++;
          const list = this.cells.get(gy * this.columns + gx);
          if (!list) continue;
          for (const id of list) {
            visited++;
            if (id === options.exclude) continue;
            const at = this.points.get(id)!;
            const dx = at.x - x, dy = at.y - y, squared = dx * dx + dy * dy;
            if (squared < bestSquared || (squared === bestSquared && id < bestId)) { bestSquared = squared; bestId = id; }
          }
        }
      }
    }
    this.onWork?.(visited);
    if (bestId < 0) return null;
    const distance = Math.sqrt(bestSquared);
    return distance > limit ? null : { id: bestId, distance };
  }

  /** Points with `dx² + dy² ≤ radius²` (inclusive), ascending by (distance, id). */
  within(x: number, y: number, radius: number, options: { exclude?: number } = {}): PointHit[] {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Query point must be finite");
    if (!Number.isFinite(radius) || radius < 0) throw new Error("radius must be a nonnegative finite number");
    const found: { id: number; squared: number }[] = [];
    const limit = radius * radius;
    let visited = 0;
    const c0 = this.column(x - radius), c1 = this.column(x + radius), r0 = this.row(y - radius), r1 = this.row(y + radius);
    for (let gy = r0; gy <= r1; gy++) for (let gx = c0; gx <= c1; gx++) {
      visited++;
      const list = this.cells.get(gy * this.columns + gx);
      if (!list) continue;
      for (const id of list) {
        visited++;
        if (id === options.exclude) continue;
        const at = this.points.get(id)!;
        const dx = at.x - x, dy = at.y - y, squared = dx * dx + dy * dy;
        if (squared <= limit) found.push({ id, squared });
      }
    }
    this.onWork?.(visited);
    found.sort((a, b) => a.squared - b.squared || a.id - b.id);
    return found.map((hit) => ({ id: hit.id, distance: Math.sqrt(hit.squared) }));
  }

  /** Ids in ascending order. */
  ids(): number[] { return [...this.points.keys()].sort((a, b) => a - b); }

  /** `[id, x, y]` in ascending id order: the plain form to keep in a simulation state and rebuild from. */
  entries(): [number, number, number][] { return this.ids().map((id) => { const at = this.points.get(id)!; return [id, at.x, at.y]; }); }

  /** Rebuild an index from `entries()`. */
  static from(options: PointGridOptions, entries: Iterable<readonly [number, number, number]>): PointGrid {
    const grid = new PointGrid(options);
    for (const [id, x, y] of entries) grid.insert(id, x, y);
    return grid;
  }

  /** Independent copy (the `clone()` protocol that `cloneState` calls, so a state may hold a grid). */
  clone(): PointGrid {
    return PointGrid.from({ bounds: [this.minX, this.minY, this.maxX, this.maxY], cellSize: this.cellSize, maxPoints: this.maxPoints, onWork: this.onWork }, this.entries());
  }

  /** Stored values for the memory bounds (`countValues` calls this). */
  valueCount(): number { return 3 * this.points.size + 1; }
}
