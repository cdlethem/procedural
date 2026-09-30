import { cachedBy, componentSeed } from "./core.js";
import { WALL } from "./cyclic-rule.js";
import type { CyclicState } from "./cyclic-rule.js";
import { stateAt } from "./snapshots.js";
import type { Snapshots } from "./snapshots.js";
import type { Path, Point, Region, Site } from "./types.js";

/**
 * Producers over the snapshots of the cyclic automaton (`cyclic-rule.ts`): each takes a grid (the state after
 * some step) and returns frozen, cached-by-construction values with stable element ids. Nothing here reads a
 * palette or a material; drawing lives in `cyclic-fronts.ts`.
 *
 * COORDINATES. Cell (x, y), x = 0 .. columns-1 left to right and y = 0 .. rows-1 top to bottom, is the canvas
 * square [left + x c, left + (x+1) c] x [top + y c, top + (y+1) c] with c the cell size. Lattice vertex
 * (i, j) is the corner at (left + i c, top + j c). All lengths are canvas units; ids are functions of the grid.
 *
 * OWNERSHIP. Results are frozen and cached on the grid they were built from; the grid is a copy of the
 * snapshot's state that nobody else holds. A consumer must not write the typed arrays.
 */

/** The grid after `step` steps: a read-only copy of the retained state plus its dimensions. */
export interface CyclicGrid {
  readonly step: number;
  readonly columns: number;
  readonly rows: number;
  readonly states: number;
  /** Row-major: a state 0 .. states-1, or WALL. */
  readonly cells: Readonly<Uint8Array>;
  /** Step at which each cell last changed (0 = never). */
  readonly last: Readonly<Uint16Array>;
  /** Cells changed by the step that made this grid. */
  readonly changed: number;
  /** Wall cells. */
  readonly walls: number;
}

/** Where the grid sits on the canvas: centre and size in canvas units; cells are square. */
export interface CyclicFrame { centerX: number; centerY: number; width: number; height: number }
export interface GridGeometry { readonly left: number; readonly top: number; readonly cell: number }

/** The square cell size `width / columns`, with the `columns x rows` grid centred on the frame's centre. */
export function gridGeometry(columns: number, rows: number, frame: CyclicFrame): GridGeometry {
  const cell = frame.width / columns;
  return Object.freeze({ left: frame.centerX - frame.width / 2, top: frame.centerY - rows * cell / 2, cell });
}

type Snap = Snapshots<CyclicState, unknown, unknown>;
const gridCache = new WeakMap<object, Map<string, CyclicGrid>>();
const structureCache = new WeakMap<object, Map<string, unknown>>();

/** The grid after `step` steps (default the last), replayed from the nearest checkpoint and cached per snapshot. */
export function cyclicGrid(snaps: Snapshots<CyclicState, any, any>, step: number = snaps.steps): CyclicGrid {
  if (!Number.isInteger(step) || step < 0 || step > snaps.steps) throw new Error(`Step must be an integer in [0, ${snaps.steps}]`);
  return cachedBy(gridCache, snaps as Snap, String(step), () => {
    const state = stateAt(snaps, step);
    const params = snaps.params as { columns: number; rows: number; rule: { states: number } };
    let walls = 0;
    for (const value of state.cells) if (value === WALL) walls++;
    return Object.freeze({ step, columns: params.columns, rows: params.rows, states: params.rule.states, cells: state.cells, last: state.last, changed: state.changed, walls });
  });
}

const frozenPoint = (x: number, y: number): Point => Object.freeze([x, y] as const);
const mod = (value: number, n: number): number => ((value % n) + n) % n;

/* ------------------------------------------------------------------------------------ state regions */

/** A merged rectangle of equal-valued cells. `state` is WALL for an obstacle run. */
export interface StateRegion extends Region {
  readonly state: number;
  readonly column: number;
  readonly row: number;
  readonly spanColumns: number;
  readonly spanRows: number;
}

/**
 * Cover the grid exactly with rectangles of equal cells (walls included, as `state` WALL): each row is cut
 * into runs of equal value, and a run whose columns and value repeat the one above it extends that rectangle
 * downwards. The rectangles are disjoint, their areas add up to `columns x rows`, and each id `run:<state>:<column>,<row>`
 * names its top-left cell, so it is stable while that cell keeps its rectangle. Order: by top row, then left.
 */
export function stateRegions(grid: CyclicGrid, geometry: GridGeometry, seed: number): readonly StateRegion[] {
  const key = `runs:${seed}:${geometry.left}:${geometry.top}:${geometry.cell}`;
  return cachedBy(structureCache as WeakMap<object, Map<string, readonly StateRegion[]>>, grid, key, () => {
    const { columns, rows, cells } = grid;
    const rects: { state: number; column: number; row: number; spanColumns: number; spanRows: number }[] = [];
    let open = new Map<number, number>(); // column * 256 + value + span * 2^20 -> rect index
    for (let y = 0; y < rows; y++) {
      const next = new Map<number, number>();
      for (let x = 0; x < columns;) {
        const value = cells[y * columns + x];
        let end = x + 1;
        while (end < columns && cells[y * columns + end] === value) end++;
        const runKey = (x * 4096 + (end - x)) * 256 + value;
        const above = open.get(runKey);
        if (above !== undefined) { rects[above].spanRows++; next.set(runKey, above); }
        else { rects.push({ state: value, column: x, row: y, spanColumns: end - x, spanRows: 1 }); next.set(runKey, rects.length - 1); }
        x = end;
      }
      open = next;
    }
    rects.sort((a, b) => a.row - b.row || a.column - b.column);
    const { left, top, cell } = geometry;
    return Object.freeze(rects.map((r): StateRegion => {
      const id = `run:${r.state === WALL ? "wall" : r.state}:${r.column},${r.row}`;
      return Object.freeze({ id, seed: componentSeed(seed, id, "run"), ...r,
        bounds: Object.freeze([left + r.column * cell, top + r.row * cell, left + (r.column + r.spanColumns) * cell, top + (r.row + r.spanRows) * cell] as const) });
    }));
  });
}

/* ------------------------------------------------------------------------------------ fronts */

/** An interface between two states. `to` is the invader on the left of the direction of travel (canvas, y down). */
export interface FrontPath extends Path {
  /** "advance": the states are neighbours on the cycle (`to` is `from` + 1 mod n), the interface moves. "defect": they are not. */
  readonly kind: "advance" | "defect";
  readonly from: number;
  readonly to: number;
  /** Lattice edges (cell sides) the path is made of. */
  readonly edges: number;
  /** Lattice vertex of the first point. */
  readonly start: readonly [number, number];
}

export interface FrontOptions {
  /** Which interfaces: advancing ones only, or defects as well. */
  readonly kinds: "advance" | "all";
  /** Smoothing strength 0..3 (0 keeps the exact cell sides, merged into straight runs; each unit is 4 shrink-free filter passes). */
  readonly smoothing: number;
  readonly seed: number;
}

export const MAX_SMOOTHING = 3;
/** Filter pairs per unit of smoothing. */
export const SMOOTHING_PAIRS = 4;
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1]; // E, S, W, N

interface Edges { tail: Int32Array; head: Int32Array; dir: Uint8Array; cls: Int32Array; count: number }

/** Every cell side between two different non-wall states, once, directed so the invader is on the left. */
function interfaceEdges(grid: CyclicGrid): Edges {
  const { columns, rows, cells, states: n } = grid, stride = columns + 1;
  const capacity = 2 * columns * rows;
  const tail = new Int32Array(capacity), head = new Int32Array(capacity), dir = new Uint8Array(capacity), cls = new Int32Array(capacity);
  let count = 0;
  const add = (a: number, b: number, vertical: boolean, x: number, y: number): void => {
    // (a, b) are the states of the cell before (left/above) and after (right/below) the side.
    if (a === b || a === WALL || b === WALL) return;
    const d = mod(b - a, n), advancing = d === 1 || d === n - 1;
    const invaderIsAfter = advancing ? d === 1 : b > a; // defect: the higher state is the "left" one, an arbitrary but fixed convention
    const lo = Math.min(a, b), hi = Math.max(a, b);
    // Vertical side (between cells x and x+1): vertices (x+1, y) and (x+1, y+1); heading south has the right-hand cell on its left.
    // Horizontal side (between rows y and y+1): vertices (x, y+1) and (x+1, y+1); heading east has the upper cell on its left.
    const v0 = vertical ? (x + 1) + y * stride : x + (y + 1) * stride, v1 = vertical ? (x + 1) + (y + 1) * stride : (x + 1) + (y + 1) * stride;
    const southOrEast = vertical ? invaderIsAfter : !invaderIsAfter;
    tail[count] = southOrEast ? v0 : v1; head[count] = southOrEast ? v1 : v0;
    dir[count] = vertical ? (southOrEast ? 1 : 3) : (southOrEast ? 0 : 2);
    cls[count] = lo * 32 + hi;
    count++;
  };
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const here = cells[y * columns + x];
    if (x + 1 < columns) add(here, cells[y * columns + x + 1], true, x, y);
    if (y + 1 < rows) add(here, cells[(y + 1) * columns + x], false, x, y);
  }
  return { tail, head, dir, cls, count };
}

/**
 * Chain the interface edges into paths. Edges of the same state pair join head to tail: where a chain meets
 * exactly one other edge of its pair it turns with it; where two chains of one pair cross (four edges of that
 * pair at a vertex) each goes straight through. A chain therefore ends only where a third state joins (a
 * triple point, shared exactly with the other pairs' paths that end at the same vertex) or at the grid edge or a wall;
 * a closed chain is a loop. Every edge is in exactly one path.
 */
function chainEdges(e: Edges): { edges: number[]; closed: boolean }[] {
  const outAt = new Map<number, number>(), inAt = new Map<number, number>();
  const slot = (vertex: number, cls: number, dir: number): number => ((vertex * 1024 + cls) * 4 + dir);
  for (let i = 0; i < e.count; i++) { outAt.set(slot(e.tail[i], e.cls[i], e.dir[i]), i); inAt.set(slot(e.head[i], e.cls[i], e.dir[i]), i); }
  const degree = (map: Map<number, number>, vertex: number, cls: number): number => {
    let count = 0;
    for (let d = 0; d < 4; d++) if (map.has(slot(vertex, cls, d))) count++;
    return count;
  };
  const next = new Int32Array(e.count).fill(-1), hasPrev = new Uint8Array(e.count);
  for (let i = 0; i < e.count; i++) {
    const v = e.head[i], cls = e.cls[i];
    let follow = -1;
    if (degree(inAt, v, cls) === 1 && degree(outAt, v, cls) === 1) {
      for (let d = 0; d < 4; d++) { const o = outAt.get(slot(v, cls, d)); if (o !== undefined) follow = o; }
    } else follow = outAt.get(slot(v, cls, e.dir[i])) ?? -1;
    if (follow >= 0) { next[i] = follow; hasPrev[follow] = 1; }
  }
  const used = new Uint8Array(e.count), chains: { edges: number[]; closed: boolean }[] = [];
  for (let i = 0; i < e.count; i++) {
    if (hasPrev[i] || used[i]) continue;
    const edges: number[] = [];
    for (let at = i; at >= 0 && !used[at]; at = next[at]) { used[at] = 1; edges.push(at); }
    chains.push({ edges, closed: false });
  }
  for (let i = 0; i < e.count; i++) {
    if (used[i]) continue;
    const edges: number[] = [];
    for (let at = i; at >= 0 && !used[at]; at = next[at]) { used[at] = 1; edges.push(at); }
    chains.push({ edges, closed: true });
  }
  return chains;
}

/**
 * Shrink-free smoothing of a lattice path (Taubin's lambda | mu filter): `pairs` times, move each interior point by
 * +0.5 then -0.5263 of its offset from the midpoint of its neighbours. Zigzags of one-cell steps are damped and
 * long-range shape is kept, so a closed loop does not collapse and a lone cell keeps its size. An open path keeps
 * both ends exactly, so paths that share a triple point still meet there.
 */
function relax(points: readonly (readonly [number, number])[], closed: boolean, pairs: number): [number, number][] {
  let current = points.map((p): [number, number] => [p[0], p[1]]);
  const m = current.length;
  for (let pass = 0; pass < pairs * 2; pass++) {
    const factor = pass % 2 === 0 ? 0.5 : -0.5263;
    current = current.map((q, i): [number, number] => {
      if (!closed && (i === 0 || i === m - 1)) return q;
      const a = current[(i + m - 1) % m], b = current[(i + 1) % m];
      return [q[0] + factor * ((a[0] + b[0]) / 2 - q[0]), q[1] + factor * ((a[1] + b[1]) / 2 - q[1])];
    });
  }
  return current;
}

/**
 * Interface paths of a grid. Advancing interfaces are the moving fronts; `kinds: "all"` adds defects (borders between
 * states that are not neighbours on the cycle, which only appear from disordered starts and are stationary or brief).
 * Point coordinates are canvas units. With `smoothing` 0 the points are the cell corners with straight runs merged; with
 * smoothing k > 0 the full lattice path is relaxed by 4k Taubin passes (endpoints fixed). Path ids are
 * `front:<from>><to>:<column>,<row>` of the first vertex, tone is the invading state, `level` the invader, `levelFraction` invader / (states - 1).
 */
export function frontPaths(grid: CyclicGrid, geometry: GridGeometry, options: FrontOptions): readonly FrontPath[] {
  if (!Number.isInteger(options.smoothing) || options.smoothing < 0 || options.smoothing > MAX_SMOOTHING) throw new Error(`Smoothing must be an integer in [0, ${MAX_SMOOTHING}]`);
  const key = `fronts:${options.kinds}:${options.smoothing}:${options.seed}:${geometry.left}:${geometry.top}:${geometry.cell}`;
  return cachedBy(structureCache as WeakMap<object, Map<string, readonly FrontPath[]>>, grid, key, () => {
    const all = interfaceEdges(grid), stride = grid.columns + 1, n = grid.states;
    let keep = all;
    if (options.kinds === "advance") {
      // Advancing pairs only: keep the edges whose classes are neighbours on the cycle.
      const wanted: number[] = [];
      for (let i = 0; i < all.count; i++) { const lo = all.cls[i] >> 5, hi = all.cls[i] & 31; const d = hi - lo; if (d === 1 || d === n - 1) wanted.push(i); }
      keep = { tail: Int32Array.from(wanted, (i) => all.tail[i]), head: Int32Array.from(wanted, (i) => all.head[i]),
        dir: Uint8Array.from(wanted, (i) => all.dir[i]), cls: Int32Array.from(wanted, (i) => all.cls[i]), count: wanted.length };
    }
    const paths: FrontPath[] = [];
    for (const chain of chainEdges(keep)) {
      const first = chain.edges[0], lo = keep.cls[first] >> 5, hi = keep.cls[first] & 31;
      const advancing = (hi - lo === 1 || hi - lo === n - 1);
      // The invader is the state on the left; recover it from the geometry: for an advancing pair it is the successor.
      const invader = advancing ? (mod(hi - lo, n) === 1 ? hi : lo) : hi;
      const from = invader === hi ? lo : hi;
      const lattice: [number, number][] = chain.edges.map((edge) => [keep.tail[edge] % stride, Math.floor(keep.tail[edge] / stride)]);
      const tailOfLast = chain.edges[chain.edges.length - 1];
      if (!chain.closed) lattice.push([keep.head[tailOfLast] % stride, Math.floor(keep.head[tailOfLast] / stride)]);
      let points: [number, number][];
      if (options.smoothing > 0) points = relax(lattice, chain.closed, options.smoothing * SMOOTHING_PAIRS);
      else {
        points = [];
        const m = lattice.length;
        for (let i = 0; i < m; i++) {
          const a = lattice[(i + m - 1) % m], b = lattice[i], c = lattice[(i + 1) % m];
          const straight = (b[0] - a[0]) * (c[1] - b[1]) === (b[1] - a[1]) * (c[0] - b[0]) && (chain.closed || (i > 0 && i < m - 1));
          if (!straight) points.push(b);
        }
      }
      const id = `front:${from}>${invader}:${lattice[0][0]},${lattice[0][1]}`;
      paths.push(Object.freeze({
        id, seed: componentSeed(options.seed, id, "front"), closed: chain.closed, level: invader, levelFraction: invader / (n - 1), tone: invader,
        kind: advancing ? "advance" as const : "defect" as const, from, to: invader, edges: chain.edges.length, start: Object.freeze([lattice[0][0], lattice[0][1]] as const),
        points: Object.freeze(points.map((p) => frozenPoint(geometry.left + p[0] * geometry.cell, geometry.top + p[1] * geometry.cell))),
      }));
    }
    paths.sort((a, b) => a.start[1] - b.start[1] || a.start[0] - b.start[0] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return Object.freeze(paths);
  });
}

/* ------------------------------------------------------------------------------------ spiral cores */

/** A spiral core: a place where all the states wind round one point. `winding` +1: states increase clockwise on the canvas. */
export interface CoreSite extends Site {
  readonly winding: 1 | -1;
  /** Lattice vertex (column, row) that first found the core in raster order; the id is built from it. */
  readonly column: number;
  readonly row: number;
  /** Lattice vertices of the cluster whose loops all wind the same way; the site sits at their centroid. */
  readonly support: number;
}

export const MAX_CORE_REACH = 4;

/**
 * Spiral cores by winding number. For every interior lattice vertex, walk clockwise (on the canvas) along the outer
 * ring of the (2r x 2r)-cell block centred on it and sum the cyclic differences of consecutive cells (each in
 * (-n/2, n/2], the shortest way round the cycle). The sum is a multiple of n; +n or -n is a topological vortex: every
 * state occurs around the vertex in cyclic order and no smooth relabelling removes it, which is what a spiral wave's
 * core is. The four cells round one vertex (r = 1) sample a spiral coarsely and miss most real cores, so `reach` r widens
 * the loop (default 2); every vertex within about r of one core winds, so vertices with the same winding that touch
 * (8-connected) form one cluster and the core is reported once, at the cluster's centroid. Loops with a wall cell in the block,
 * or with a difference of exactly n/2 (even n, direction undefined), are skipped, so a core is only reported on unambiguous
 * evidence and never around an obstacle. Ids are `core:<column>,<row>` of the cluster's first vertex in raster order; tone is 0 for
 * winding +1 and 1 for -1.
 */
export function spiralCores(grid: CyclicGrid, geometry: GridGeometry, seed: number, reach = 2): readonly CoreSite[] {
  if (!Number.isInteger(reach) || reach < 1 || reach > MAX_CORE_REACH) throw new Error(`Core reach must be an integer in [1, ${MAX_CORE_REACH}]`);
  const key = `cores:${reach}:${seed}:${geometry.left}:${geometry.top}:${geometry.cell}`;
  return cachedBy(structureCache as WeakMap<object, Map<string, readonly CoreSite[]>>, grid, key, () => {
    const { columns, rows, cells, states: n } = grid, r = reach, stride = columns + 1;
    const turn = (from: number, to: number): number => { const d = mod(to - from, n); return 2 * d > n ? d - n : d; };
    // Ring of the 2r x 2r block, clockwise from its top-left cell, as cell offsets from the block's top-left corner.
    const ring: [number, number][] = [];
    for (let x = 0; x < 2 * r; x++) ring.push([x, 0]);
    for (let y = 1; y < 2 * r; y++) ring.push([2 * r - 1, y]);
    for (let x = 2 * r - 2; x >= 0; x--) ring.push([x, 2 * r - 1]);
    for (let y = 2 * r - 2; y >= 1; y--) ring.push([0, y]);
    const winding = new Int8Array(stride * (rows + 1));
    for (let j = r; j + r <= rows; j++) for (let i = r; i + r <= columns; i++) {
      let clear = true;
      for (let y = j - r; y < j + r && clear; y++) for (let x = i - r; x < i + r; x++) if (cells[y * columns + x] === WALL) { clear = false; break; }
      if (!clear) continue;
      let sum = 0, ambiguous = false, previous = cells[(j - r + ring[ring.length - 1][1]) * columns + i - r + ring[ring.length - 1][0]];
      for (const [dx, dy] of ring) {
        const value = cells[(j - r + dy) * columns + i - r + dx], step = turn(previous, value);
        if (n % 2 === 0 && 2 * Math.abs(step) === n) { ambiguous = true; break; }
        sum += step; previous = value;
      }
      if (ambiguous) continue;
      const w = sum / n;
      if (w === 1 || w === -1) winding[j * stride + i] = w;
    }
    // Cluster touching vertices of equal winding, scanning in raster order so the first vertex names the cluster.
    const seen = new Uint8Array(winding.length), sites: CoreSite[] = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
      const w = winding[j * stride + i];
      if (w === 0 || seen[j * stride + i]) continue;
      const queue = [j * stride + i];
      seen[j * stride + i] = 1;
      let sx = 0, sy = 0, count = 0;
      for (let head = 0; head < queue.length; head++) {
        const v = queue[head], vx = v % stride, vy = Math.floor(v / stride);
        sx += vx; sy += vy; count++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = vx + dx, ny = vy + dy;
          if (nx < 0 || ny < 0 || nx > columns || ny > rows) continue;
          const u = ny * stride + nx;
          if (!seen[u] && winding[u] === w) { seen[u] = 1; queue.push(u); }
        }
      }
      const id = `core:${i},${j}`;
      sites.push(Object.freeze({ id, seed: componentSeed(seed, id, "core"), position: frozenPoint(geometry.left + sx / count * geometry.cell, geometry.top + sy / count * geometry.cell),
        angle: 0, scale: 1, tone: w === 1 ? 0 : 1, winding: w as 1 | -1, column: i, row: j, support: count }));
    }
    return Object.freeze(sites);
  });
}

/** Cell sites for a per-cell mark: centre of each non-wall cell, angle = state / states of a turn, tone = state. Ids `cell:<column>,<row>`. */
export function cellSites(grid: CyclicGrid, geometry: GridGeometry, seed: number): readonly Site[] {
  const key = `cells:${seed}:${geometry.left}:${geometry.top}:${geometry.cell}`;
  return cachedBy(structureCache as WeakMap<object, Map<string, readonly Site[]>>, grid, key, () => {
    const sites: Site[] = [];
    for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.columns; x++) {
      const state = grid.cells[y * grid.columns + x];
      if (state === WALL) continue;
      const id = `cell:${x},${y}`;
      sites.push(Object.freeze({ id, seed: componentSeed(seed, id, "cell"), position: frozenPoint(geometry.left + (x + 0.5) * geometry.cell, geometry.top + (y + 0.5) * geometry.cell),
        angle: 2 * Math.PI * state / grid.states, scale: 1, tone: state }));
    }
    return Object.freeze(sites);
  });
}

/** How many cells hold each state (index 0 .. states-1); walls are not counted. */
export function stateCounts(grid: CyclicGrid): readonly number[] {
  const counts = new Array<number>(grid.states).fill(0);
  for (const value of grid.cells) if (value !== WALL) counts[value]++;
  return Object.freeze(counts);
}

