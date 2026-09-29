import type { Point } from "./types.js";

/**
 * Closed, oriented level-set rings of a sampled scalar field: the boundary of `{ field >= level }`
 * as polygons, in linear time, for fields too dense for the chain assembler that contour
 * paths use (`assembleSegmentChains2D` is quadratic and capped at 2,200 segments per level).
 *
 * FIELD. `values[j * columns + i]` is the sample at `(x0 + i dx, y0 + j dy)`. Every sample outside the grid
 * has the constant value `outside`, which MUST be below every level asked for; the rings of a
 * region that touches the grid border therefore still close, `outside`-ward of the border samples.
 * Crossings are linear along each grid edge: a crossing sits at `(level - a) / (b - a)` of the way from
 * the sample `a` to its neighbour `b`, so its position never depends on the cell case.
 *
 * RINGS. Each ring is closed implicitly (the first vertex is not repeated). Orientation is fixed by the
 * data: the region `field >= level` lies on the side that gives OUTER boundaries a POSITIVE
 * `sum (x_j y_i - x_i y_j) / 2` (j the previous vertex) and boundaries of holes a NEGATIVE one; this is
 * the convention of `keyholeRings`, which merges each hole into its outer ring for filling.
 * A saddle cell (two diagonal samples at or above the level) joins them when the mean of its four
 * samples is at least the level. Every crossing belongs to exactly two cells and is the end of one
 * oriented segment and the start of the next, so rings are assembled by table lookup, with no
 * geometric matching, and every ring closes. A sample exactly at the level counts as inside.
 *
 * Cost: `O(columns x rows)` per level (rows whose largest sample is below the level are skipped),
 * `O(segments)` for assembly. The returned points are frozen.
 */
type Edge = 0 | 1 | 2 | 3; // top, right, bottom, left
const MID: readonly (readonly [number, number])[] = [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]];
const CORNER: readonly (readonly [number, number])[] = [[0, 0], [1, 0], [1, 1], [0, 1]]; // a, b, c, d

/** Oriented segments of each of the 32 cases (16 corner patterns x saddle centre inside or not), as edge pairs. */
const CASES: readonly (readonly (readonly [Edge, Edge])[])[] = (() => {
  const cross = (px: number, py: number, qx: number, qy: number, xx: number, xy: number) => (qx - px) * (xy - py) - (qy - py) * (xx - px);
  const adjacent: Record<string, number> = { "0,3": 0, "0,1": 1, "1,2": 2, "2,3": 3 }; // edge pair -> shared corner
  const table: (readonly (readonly [Edge, Edge])[])[] = [];
  for (let code = 0; code < 32; code++) {
    const mask = code & 15, centre = (code & 16) !== 0;
    const inside = (k: number) => (mask >> k & 1) === 1;
    let raw: [Edge, Edge][] = [];
    switch (mask) {
      case 0: case 15: break;
      case 1: case 14: raw = [[0, 3]]; break;
      case 2: case 13: raw = [[0, 1]]; break;
      case 4: case 11: raw = [[1, 2]]; break;
      case 8: case 7: raw = [[2, 3]]; break;
      case 3: case 12: raw = [[3, 1]]; break;
      case 6: case 9: raw = [[0, 2]]; break;
      case 5: raw = centre ? [[0, 1], [3, 2]] : [[0, 3], [1, 2]]; break;
      case 10: raw = centre ? [[0, 3], [1, 2]] : [[0, 1], [3, 2]]; break;
    }
    table.push(raw.map(([e1, e2]) => {
      const key = `${Math.min(e1, e2)},${Math.max(e1, e2)}`, shared = adjacent[key];
      // An inside corner on the region's side of the segment: the cut-off corner if it is inside, else any inside corner.
      let corner = -1;
      if (shared !== undefined && inside(shared)) corner = shared;
      else for (let k = 0; k < 4 && corner < 0; k++) if (inside(k) && k !== shared) corner = k;
      const [px, py] = MID[e1], [qx, qy] = MID[e2], [xx, xy] = CORNER[corner];
      return (cross(px, py, qx, qy, xx, xy) > 0 ? [e1, e2] : [e2, e1]) as readonly [Edge, Edge];
    }));
  }
  return table;
})();

export interface IsoGrid {
  values: ArrayLike<number>;
  columns: number;
  rows: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  /** Value of every sample beyond the grid; below every level. */
  outside: number;
}

/** Reusable working arrays for one grid size: build once, ask for many levels. */
export class IsoField {
  readonly #grid: IsoGrid;
  readonly #w: number;
  readonly #h: number;
  readonly #start: Int32Array;
  readonly #rowMax: Float64Array;
  #from = new Int32Array(1024);
  #to = new Int32Array(1024);

  constructor(grid: IsoGrid) {
    if (!Number.isInteger(grid.columns) || !Number.isInteger(grid.rows) || grid.columns < 1 || grid.rows < 1 || grid.values.length !== grid.columns * grid.rows)
      throw new Error("Iso field needs positive integer columns and rows and exactly columns x rows values");
    this.#grid = grid;
    this.#w = grid.columns + 2; this.#h = grid.rows + 2;
    this.#start = new Int32Array(2 * this.#w * this.#h).fill(-1);
    this.#rowMax = new Float64Array(this.#h).fill(grid.outside);
    for (let j = 0; j < grid.rows; j++) {
      let max = grid.outside;
      for (let i = 0; i < grid.columns; i++) if (grid.values[j * grid.columns + i] > max) max = grid.values[j * grid.columns + i];
      this.#rowMax[j + 1] = max;
    }
  }

  #value(pi: number, pj: number): number {
    const g = this.#grid;
    return pi < 1 || pj < 1 || pi > g.columns || pj > g.rows ? g.outside : g.values[(pj - 1) * g.columns + pi - 1];
  }

  /** The rings of `{ field >= level }`; `level` must exceed `outside` and every ring must fit `maxVertices`. */
  rings(level: number, maxVertices = Infinity): Point[][] {
    const g = this.#grid, w = this.#w, h = this.#h;
    if (!(level > g.outside)) throw new Error("Iso level must exceed the outside value");
    let count = 0;
    const add = (from: number, to: number) => {
      if (count === this.#from.length) {
        const bigger = (old: Int32Array) => { const next = new Int32Array(old.length * 2); next.set(old); return next; };
        this.#from = bigger(this.#from); this.#to = bigger(this.#to);
      }
      this.#from[count] = from; this.#to[count] = to; this.#start[from] = count; count++;
    };
    for (let pj = 0; pj + 1 < h; pj++) {
      if (this.#rowMax[pj] < level && this.#rowMax[pj + 1] < level) continue;
      for (let pi = 0; pi + 1 < w; pi++) {
        const a = this.#value(pi, pj), b = this.#value(pi + 1, pj), c = this.#value(pi + 1, pj + 1), d = this.#value(pi, pj + 1);
        const mask = (a >= level ? 1 : 0) | (b >= level ? 2 : 0) | (c >= level ? 4 : 0) | (d >= level ? 8 : 0);
        if (mask === 0 || mask === 15) continue;
        const code = mask | ((mask === 5 || mask === 10) && (a + b + c + d) / 4 >= level ? 16 : 0), here = pj * w + pi;
        // Edge keys: 2 * (row * w + column) is the horizontal edge to the right, +1 the vertical edge below.
        const keys = [here * 2, (here + 1) * 2 + 1, (here + w) * 2, here * 2 + 1];
        for (const [e1, e2] of CASES[code]) add(keys[e1], keys[e2]);
      }
    }
    const rings: Point[][] = [];
    let vertices = 0;
    const used = new Uint8Array(count);
    const cross = (key: number): Point => {
      const cell = key >> 1, pi = cell % w, pj = (cell - pi) / w, vertical = (key & 1) === 1;
      const a = this.#value(pi, pj), b = vertical ? this.#value(pi, pj + 1) : this.#value(pi + 1, pj), p = (level - a) / (b - a);
      return Object.freeze([g.x0 + (pi - 1 + (vertical ? 0 : p)) * g.dx, g.y0 + (pj - 1 + (vertical ? p : 0)) * g.dy] as const);
    };
    for (let s = 0; s < count; s++) {
      if (used[s]) continue;
      const ring: Point[] = [];
      let at = s;
      do {
        used[at] = 1;
        ring.push(cross(this.#from[at]));
        at = this.#start[this.#to[at]];
        if (at < 0) throw new Error("Iso ring did not close (a crossing has no continuing segment)");
      } while (at !== s);
      vertices += ring.length;
      if (vertices > maxVertices) { this.#reset(count); throw new Error(`Iso rings would exceed ${maxVertices} vertices`); }
      rings.push(ring);
    }
    this.#reset(count);
    return rings;
  }

  #reset(count: number): void {
    for (let s = 0; s < count; s++) this.#start[this.#from[s]] = -1;
  }
}

export type FilledRing = readonly Point[];
const areaOf = (ring: readonly Point[]): number => {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return sum / 2;
};
function containsPoint(ring: readonly Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Polygons that can be filled with no contour call: each hole (negative area) is merged into its
 * parent outer ring (positive area) by one out-and-back cut, exactly as `keyholeRings` does. The
 * difference is the search. Level-set rings of one level never touch, so the parent of a hole is the
 * smallest outer ring that contains ONE of its vertices, and the cut runs from that vertex to the
 * nearest vertex of the parent: linear in the parent's size per hole, where `keyholeRings`
 * compares every vertex pair and every hole vertex against every overlapping ring. Rings with a
 * few thousand vertices and dozens of holes, the shape of dense shading contours, make that
 * quadratic search take seconds. A cut encloses no area whatever it crosses, so the choice of
 * cut affects only rasterizer hairlines. A hole with no parent (impossible for rings from
 * `IsoField`) is dropped, as are rings of no area.
 */
export function fillableRings(rings: readonly (readonly Point[])[]): FilledRing[] {
  const outers: { ring: readonly Point[]; area: number; box: readonly [number, number, number, number]; holes: (readonly Point[])[] }[] = [];
  const holes: (readonly Point[])[] = [];
  for (const ring of rings) {
    const area = areaOf(ring);
    if (Math.abs(area) < 1e-12) continue;
    if (area > 0) {
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      for (const [x, y] of ring) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
      outers.push({ ring, area, box: [l, t, r, b], holes: [] });
    } else holes.push(ring);
  }
  const bySize = outers.slice().sort((a, b) => a.area - b.area);
  for (const hole of holes) {
    const [x, y] = hole[0];
    const parent = bySize.find((o) => x >= o.box[0] && x <= o.box[2] && y >= o.box[1] && y <= o.box[3] && containsPoint(o.ring, x, y));
    if (parent) parent.holes.push(hole);
  }
  return outers.map(({ ring, holes: inner }): FilledRing => {
    if (inner.length === 0) return ring;
    const cuts = new Map<number, (readonly Point[])[]>();
    for (const hole of inner) {
      const [x, y] = hole[0];
      let best = 0, bestDistance = Infinity;
      for (let i = 0; i < ring.length; i++) {
        const distance = (ring[i][0] - x) ** 2 + (ring[i][1] - y) ** 2;
        if (distance < bestDistance) { bestDistance = distance; best = i; }
      }
      const at = cuts.get(best);
      if (at) at.push(hole); else cuts.set(best, [hole]);
    }
    const merged: Point[] = [];
    ring.forEach((p, i) => {
      merged.push(p);
      for (const hole of cuts.get(i) ?? []) {
        for (let step = 0; step <= hole.length; step++) merged.push(hole[step % hole.length]);
        merged.push(p);
      }
    });
    return Object.freeze(merged);
  });
}
