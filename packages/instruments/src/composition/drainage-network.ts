import { cachedBy, componentSeed } from "./core.js";
import { accumulateFlow, fillDepressions, flowReceivers, gridSpacing, outletMask, type OutletMode } from "./drainage-flow.js";
import { graphFromParts, MAX_GRAPH_EDGES, MAX_GRAPH_NODES, type Graph } from "./graph.js";
import { rainField, type RainMode } from "./terrain.js";
import type { Path, Point } from "./types.js";

/**
 * Drainage products of a terrain snapshot: routing, the stream network as a directed graph with reaches,
 * and drainage basins as a label grid. Every product is a frozen value cached on the height array of the
 * snapshot it was derived from (the arrays are private copies made by the snapshot runner) and on its
 * extraction options, so a stream-threshold or contour edit never touches the simulation.
 *
 * ROUTING. `analyzeDrainage` fills the depressions of a height grid (`drainage-flow.ts`), routes D8 and
 * accumulates the rain field of the construction. `flow[c]` is in cells of average rain (dimensionless); `area
 * = flow × h²` in domain units. Lakes: `depth[c] = filled[c] - height[c]`, the water a depression holds at its
 * spill level.
 *
 * STREAMS. A cell is a stream cell when `flow >= threshold × total rain` (a share in (0, 1]; `total rain` is the
 * cell count because the rain field has mean 1). Every stream cell's receiver is a stream cell or none, so stream
 * cells form a forest directed to the outlets. Nodes are the stream cells where the forest branches or
 * ends: SOURCES (no stream cell drains into them), CONFLUENCES (two or more do) and MOUTHS (outlet cells). A
 * REACH is the chain of stream cells from a source or confluence down to the next node (or mouth), inclusive.
 * Ids come from cells, never from order: node `n:<cell>`, reach and graph edge `e:<cell of its upstream node>`,
 * basin `b:<reach id>`. Reaches partition the stream cells (a node cell belongs to the reach it starts, except a
 * mouth, which belongs to the reach that ends there). The graph is directed downstream, edge `weight` is the
 * flow at the reach's last cell over the largest, `age` the Strahler order (sources 1; two equal-order tributaries
 * raise it by 1). Reach paths follow cell centres in canvas units and are smoothed by `smooth` rounds of corner
 * cutting with fixed ends, so reaches still meet exactly at their nodes; `flow` gives the flow share at every path
 * point (interpolated across the cut corners).
 *
 * BASINS. Every cell is assigned to the stream reach it first drains into (a cell that never meets a stream
 * cell has label 0). `depth` chooses how finely the network divides them: basins are the reaches with tree
 * depth at most `depth` (depth 0: reaches that end at an outlet, one basin per main river; depth 1 adds the
 * tributaries that join them, ...); a cell belongs to the basin of its reach's ancestor at that depth. Labels are 1.. in
 * the order of the basin reaches' ids by cell. The label grid is a `MaskRaster`, which `labelDomains` turns into
 * planar regions with holes whose shared boundaries coincide exactly. A basin holding less than `MIN_BASIN_THRESHOLDS` (3) stream
 * thresholds of the rain is merged into the basin downstream of it; a root basin that small is left unlabelled, so a fringe of tiny catchments
 * along the outlets does not shatter the map.
 *
 * Bounds: routing O(n log n); streams and basins O(n); reaches, vertices and graph size are bounded by the
 * threshold (the stream cell count is at most `1 / threshold` times the cells of the largest river) and by
 * `MAX_STREAM_CELLS`, which throws naming the stream threshold.
 */
export const MAX_STREAM_CELLS = 60_000;

export interface DrainageSpec {
  columns: number; rows: number; outlets: OutletMode;
  rainMode: RainMode; rainVariation: number; rainAngle: number; storms: number;
}
export interface Drainage {
  readonly columns: number;
  readonly rows: number;
  /** Domain spacing between cell centres (the longer side of the grid is 1). */
  readonly spacing: number;
  readonly height: Float64Array;
  readonly filled: Float64Array;
  /** Flood order: ascending `filled`, receivers before the cells that drain to them. */
  readonly order: Int32Array;
  readonly receivers: Int32Array;
  readonly outlets: Uint8Array;
  /** The rain multiplier of each cell (mean 1). */
  readonly rain: Float64Array;
  /** Rain accumulated over each cell and everything that drains to it, in cells of average rain. */
  readonly flow: Float64Array;
  /** Water held by each cell's depression, `filled - height` (domain units), 0 outside lakes. */
  readonly depth: Float64Array;
  readonly totalRain: number;
}

const drainageCache = new WeakMap<object, Map<string, Drainage>>();
/** Route `height` (which must stay unmodified) with the outlets and rain of `spec`; cached on the height array. */
export function analyzeDrainage(height: Float64Array, spec: DrainageSpec, seed: number, control: { cancelled?: () => boolean } = {}): Drainage {
  const key = JSON.stringify([spec.columns, spec.rows, spec.outlets, spec.rainMode, spec.rainVariation, spec.rainAngle, spec.storms, seed]);
  return cachedBy(drainageCache, height, key, () => {
    const { columns, rows } = spec, n = columns * rows;
    const outlets = outletMask(columns, rows, spec.outlets);
    const rain = rainField({ columns, rows, mode: spec.rainMode, variation: spec.rainVariation, angle: spec.rainAngle, storms: spec.storms }, seed);
    const { filled, order } = fillDepressions(height, columns, rows, outlets, control.cancelled);
    const receivers = flowReceivers(filled, columns, rows, outlets);
    const flow = accumulateFlow(receivers, order, rain);
    const depth = new Float64Array(n);
    let total = 0;
    for (let c = 0; c < n; c++) { depth[c] = filled[c] - height[c]; total += rain[c]; }
    return Object.freeze({ columns, rows, spacing: gridSpacing(columns, rows), height, filled, order, receivers, outlets, rain, flow, depth, totalRain: total });
  });
}

/** Canvas placement of a grid: cell `(i, j)` has its centre at `(left + (i + 1/2) cell, top + (j + 1/2) cell)`. */
export interface GridFrame { readonly left: number; readonly top: number; readonly cell: number }
const centre = (frame: GridFrame, columns: number, cell: number): Point => [frame.left + ((cell % columns) + 0.5) * frame.cell, frame.top + (Math.floor(cell / columns) + 0.5) * frame.cell];

export interface StreamNode {
  readonly id: string;
  readonly cell: number;
  readonly kind: "source" | "confluence" | "mouth";
  readonly position: Point;
  /** Flow at the node's cell as a share of the largest flow on the network, in (0, 1]. */
  readonly flowShare: number;
  /** Direction of the reach leaving the node downstream in radians (canvas axes, y down); 0 for a mouth with no downstream reach. */
  readonly angle: number;
}
export interface StreamReach extends Path {
  readonly edge: string;
  readonly from: string;
  readonly to: string;
  /** Strahler order, 1 for a reach that starts at a source. */
  readonly order: number;
  /** Tree depth: 0 for a reach that ends at an outlet. */
  readonly depth: number;
  /** Grid cells of the reach from upstream to downstream. */
  readonly cells: readonly number[];
  /** Flow share of every path point, in (0, 1] of the largest flow on the network. */
  readonly flow: readonly number[];
}
export interface StreamOptions { threshold: number; smooth: number }
export interface StreamNetwork {
  readonly graph: Graph;
  readonly nodes: readonly StreamNode[];
  readonly reaches: readonly StreamReach[];
  /** Reach index of each cell's first stream cell downstream (-1 where a cell never meets a stream). */
  readonly reachOf: Int32Array;
  readonly streamCells: number;
  /** The largest flow on the network, in cells of average rain (0 when there is no stream). */
  readonly maxFlow: number;
  readonly threshold: number;
}

const networkCache = new WeakMap<object, Map<string, StreamNetwork>>();

function chaikin(points: readonly Point[], flow: readonly number[], rounds: number): { points: Point[]; flow: number[] } {
  let p = points.slice() as Point[], f = flow.slice();
  for (let r = 0; r < rounds && p.length > 2; r++) {
    const np: Point[] = [p[0]], nf: number[] = [f[0]];
    for (let i = 0; i + 1 < p.length; i++) {
      const [ax, ay] = p[i], [bx, by] = p[i + 1];
      if (i > 0) { np.push([0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by]); nf.push(0.75 * f[i] + 0.25 * f[i + 1]); }
      if (i + 2 < p.length) { np.push([0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by]); nf.push(0.25 * f[i] + 0.75 * f[i + 1]); }
    }
    np.push(p[p.length - 1]); nf.push(f[f.length - 1]);
    p = np; f = nf;
  }
  return { points: p, flow: f };
}

/** The stream network of a routed terrain (see the header). Cached by drainage and options. */
export function streamNetwork(drainage: Drainage, frame: GridFrame, options: StreamOptions, seed: number): StreamNetwork {
  const { threshold, smooth } = options;
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) throw new Error(`Stream threshold must be a share in (0, 1] (got ${String(threshold)})`);
  if (!Number.isInteger(smooth) || smooth < 0 || smooth > 4) throw new Error(`Stream smoothing must be an integer from 0 to 4 (got ${String(smooth)})`);
  const key = JSON.stringify([frame.left, frame.top, frame.cell, threshold, smooth, seed]);
  return cachedBy(networkCache, drainage, key, () => build(drainage, frame, threshold, smooth, seed));
}

function build(d: Drainage, frame: GridFrame, threshold: number, smooth: number, seed: number): StreamNetwork {
  const { columns, receivers, flow } = d, n = d.columns * d.rows, limit = threshold * d.totalRain;
  const isStream = new Uint8Array(n), donors = new Int32Array(n);
  let streamCells = 0, maxFlow = 0;
  for (let c = 0; c < n; c++) if (flow[c] >= limit) { isStream[c] = 1; streamCells++; if (flow[c] > maxFlow) maxFlow = flow[c]; }
  if (streamCells > MAX_STREAM_CELLS)
    throw new Error(`The stream threshold ${threshold} makes ${streamCells} stream cells, above ${MAX_STREAM_CELLS}; raise the stream threshold`);
  for (let c = 0; c < n; c++) if (isStream[c] && receivers[c] >= 0) donors[receivers[c]]++;
  const isNode = (c: number) => isStream[c] === 1 && (donors[c] !== 1 || receivers[c] < 0);
  const nodeCells: number[] = [];
  for (let c = 0; c < n; c++) if (isNode(c)) nodeCells.push(c);
  const kindOf = (c: number): StreamNode["kind"] => receivers[c] < 0 ? "mouth" : donors[c] === 0 ? "source" : "confluence";

  // Reaches start at every node that is not a mouth, in ascending cell order.
  interface Raw { start: number; cells: number[]; end: number }
  const raw: Raw[] = [], reachStartingAt = new Map<number, number>();
  for (const start of nodeCells) {
    if (receivers[start] < 0) continue;
    const cells = [start];
    let at = start;
    do { at = receivers[at]; cells.push(at); } while (!isNode(at));
    reachStartingAt.set(start, raw.length);
    raw.push({ start, cells, end: at });
  }
  // Tree depth and Strahler order.
  const down = raw.map((r) => receivers[r.end] < 0 ? -1 : (reachStartingAt.get(r.end) ?? -1));
  const depth = new Int32Array(raw.length).fill(-1);
  const depthOf = (i: number): number => {
    const chain: number[] = [];
    let at = i;
    while (depth[at] < 0 && down[at] >= 0) { chain.push(at); at = down[at]; }
    let value = depth[at] < 0 ? 0 : depth[at];
    if (depth[at] < 0) depth[at] = 0;
    for (let k = chain.length - 1; k >= 0; k--) depth[chain[k]] = ++value;
    return depth[i];
  };
  for (let i = 0; i < raw.length; i++) depthOf(i);
  const strahler = new Int32Array(raw.length);
  const byDepthDesc = raw.map((_, i) => i).sort((a, b) => depth[b] - depth[a] || a - b);
  const feeders = raw.map(() => [] as number[]);
  raw.forEach((_, i) => { if (down[i] >= 0) feeders[down[i]].push(i); });
  for (const i of byDepthDesc) {
    const fed = feeders[i];
    if (fed.length === 0) { strahler[i] = 1; continue; }
    let top = 0, count = 0;
    for (const f of fed) { if (strahler[f] > top) { top = strahler[f]; count = 1; } else if (strahler[f] === top) count++; }
    strahler[i] = count >= 2 ? top + 1 : top;
  }

  const reachOf = new Int32Array(n).fill(-1);
  const reaches: StreamReach[] = raw.map((r, index) => {
    const edge = `e:${r.start}`, id = edge;
    r.cells.forEach((c, k) => { if (k < r.cells.length - 1 || receivers[c] < 0) reachOf[c] = index; });
    const cellFlow = r.cells.map((c) => flow[c] / maxFlow);
    const line = chaikin(r.cells.map((c) => centre(frame, columns, c)), cellFlow, smooth);
    return Object.freeze({ id, seed: componentSeed(seed, id, "path"), closed: false, level: strahler[index], levelFraction: 0,
      points: Object.freeze(line.points.map((p) => Object.freeze(p))), edge, from: `n:${r.start}`, to: `n:${r.end}`, order: strahler[index], depth: depth[index],
      cells: Object.freeze(r.cells), flow: Object.freeze(line.flow) });
  });
  const maxOrder = Math.max(1, ...strahler);
  const finished = reaches.map((r) => Object.freeze({ ...r, levelFraction: maxOrder > 1 ? (r.order - 1) / (maxOrder - 1) : 0 }));
  const outgoing = new Map<number, number>();
  raw.forEach((r, i) => outgoing.set(r.start, i));
  const nodes: StreamNode[] = nodeCells.map((c) => {
    const out = outgoing.get(c), position = centre(frame, columns, c);
    let angle = 0;
    if (out !== undefined) { const next = centre(frame, columns, raw[out].cells[1]); angle = Math.atan2(next[1] - position[1], next[0] - position[0]); }
    return Object.freeze({ id: `n:${c}`, cell: c, kind: kindOf(c), position, flowShare: flow[c] / maxFlow, angle });
  });
  if (nodes.length > MAX_GRAPH_NODES || raw.length > MAX_GRAPH_EDGES)
    throw new Error(`The stream threshold ${threshold} makes a network of ${nodes.length} nodes and ${raw.length} reaches (limits ${MAX_GRAPH_NODES} and ${MAX_GRAPH_EDGES}); raise the stream threshold`);
  const graph = graphFromParts({ seed, directed: true,
    nodes: nodes.map((node) => ({ id: node.id, position: node.position })),
    edges: raw.map((r, i) => ({ id: `e:${r.start}`, from: `n:${r.start}`, to: `n:${r.end}`, weight: flow[r.cells[r.cells.length - 1]] / maxFlow, age: strahler[i] })) });
  return Object.freeze({ graph, nodes: Object.freeze(nodes), reaches: Object.freeze(finished), reachOf, streamCells, maxFlow, threshold });
}

export interface Basin {
  readonly id: string;
  /** The value of this basin in the label grid (1..). */
  readonly label: number;
  readonly reach: string;
  readonly depth: number;
  readonly cells: number;
  /** Area in domain units squared. */
  readonly area: number;
  /** Flow at the basin reach's last cell over the largest flow on the network. */
  readonly flowShare: number;
}
export interface BasinMap {
  readonly columns: number;
  readonly rows: number;
  /** Basin label of each cell; 0 where no stream is met. Row-major. */
  readonly labels: Int32Array;
  readonly basins: readonly Basin[];
  /** Cells with label 0. */
  readonly unassigned: number;
}
const basinCache = new WeakMap<object, Map<string, BasinMap>>();

/** A basin smaller than this many stream thresholds is merged into the basin downstream of it (unlabelled if it has none). */
export const MIN_BASIN_THRESHOLDS = 3;

/** Basins at `depth` (see the header). Cached on the network. */
export function drainageBasins(drainage: Drainage, network: StreamNetwork, depth: number): BasinMap {
  if (!Number.isInteger(depth) || depth < 0 || depth > 16) throw new Error(`Basin depth must be an integer from 0 to 16 (got ${String(depth)})`);
  return cachedBy(basinCache, network, String(depth), () => {
    const { columns, rows, receivers, order } = drainage, n = columns * rows, { reaches } = network;
    const startAt = new Map(reaches.map((r, i) => [r.from, i] as const));
    const parent = reaches.map((r) => startAt.get(r.to) ?? -1);
    // The reach each cell first drains into, downstream cells first (the flood order).
    const streamReach = new Int32Array(n).fill(-1), own = new Float64Array(reaches.length);
    for (let k = 0; k < n; k++) {
      const c = order[k];
      streamReach[c] = network.reachOf[c] >= 0 ? network.reachOf[c] : receivers[c] >= 0 ? streamReach[receivers[c]] : -1;
      if (streamReach[c] >= 0) own[streamReach[c]] += drainage.rain[c];
    }
    // Candidates are the reaches of depth <= `depth`; deeper reaches belong to their ancestor at that depth. Upstream candidates
    // smaller than the minimum merge into the candidate downstream of them.
    const rootOf = reaches.map((_, i) => i), total = new Float64Array(reaches.length);
    reaches.forEach((r, i) => {
      let at = i;
      while (reaches[at].depth > depth) at = parent[at];
      rootOf[i] = at; total[at] += own[i];
    });
    const minimum = MIN_BASIN_THRESHOLDS * network.threshold * drainage.totalRain, merged = reaches.map((_, i) => i);
    const candidates = reaches.map((_, i) => i).filter((i) => reaches[i].depth <= depth).sort((a, b) => reaches[b].depth - reaches[a].depth || a - b);
    const dropped = new Set<number>();
    for (const i of candidates) {
      if (total[i] >= minimum) continue;
      if (parent[i] >= 0) { total[parent[i]] += total[i]; merged[i] = parent[i]; } else dropped.add(i);
    }
    const resolve = (i: number): number => { let at = rootOf[i]; while (merged[at] !== at) at = merged[at]; return at; };
    const labelOfRoot = new Map<number, number>();
    const basins: { id: string; label: number; reach: string; depth: number; cells: number; flowShare: number }[] = [];
    for (const i of reaches.map((_, k) => k)) {
      if (reaches[i].depth > depth || merged[i] !== i || dropped.has(i)) continue;
      labelOfRoot.set(i, basins.length + 1);
      basins.push({ id: `b:${reaches[i].id}`, label: basins.length + 1, reach: reaches[i].id, depth: reaches[i].depth, cells: 0, flowShare: reaches[i].flow[reaches[i].flow.length - 1] });
    }
    const labels = new Int32Array(n);
    let unassigned = 0;
    for (let c = 0; c < n; c++) {
      const reach = streamReach[c], label = reach < 0 ? undefined : labelOfRoot.get(resolve(reach));
      if (label === undefined) { unassigned++; continue; }
      labels[c] = label; basins[label - 1].cells++;
    }
    const cellArea = drainage.spacing * drainage.spacing;
    return Object.freeze({ columns, rows, labels, unassigned,
      basins: Object.freeze(basins.map((b) => Object.freeze({ ...b, area: b.cells * cellArea }))) });
  });
}
