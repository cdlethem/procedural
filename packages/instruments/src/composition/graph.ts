import { gradientNoise2D01 } from "@procedurals/javascript";
import { buildBranchTrees } from "../adapters/constructed-geometry-instruments.js";
import { graphForest, latticeVertexPosition } from "../adapters/graph-grammar-instruments.js";
import { buildProximityReplay, proximityReplayInstrumentDefinitions } from "../adapters/proximity-replay-instruments.js";
import { componentSeed } from "./core.js";
import { memoized } from "./sources.js";
import type { BranchTree } from "./branch-tree.js";
import type { Path, Point, Site } from "./types.js";

/**
 * Graph values for the graph-role drawings.
 *
 * A `Graph` is a small typed, deeply frozen value: nodes carrying `degree`, `weight` and `age`, edges
 * carrying `weight`, `age` and a stored `from → to` orientation, and the maxima needed to express
 * filters as fractions. It is not a graph database: there is no query language, no mutation and no
 * multigraph. Producers below build it from the existing contact network replay, the lattice
 * spanning forest and the seeded branch tree; `graphFromParts` admits a supplied graph.
 *
 * Units and domains (all producers and `graphFromParts`)
 * - Positions are canvas units. Edge `length` is the Euclidean distance between its end nodes.
 * - Edge `weight` is a dimensionless strength in [0, 1]. Node `weight` is the sum of its incident
 *   edge weights (unbounded above, at most `degree`).
 * - `age` is a positive integer count of source steps the element has existed as of the final
 *   state (contact: ticks of unbroken contact; lattice and branches: growth steps, oldest at the
 *   root). A node's age is the largest age among its incident edges; an isolated node has age 0.
 * - `degree` is the number of incident edges in the source graph. Selecting a view never renumbers it.
 *
 * Identity and seeds. Ids come from source structure, never from draw order: `a:<agent>` and
 * `e:<a>:<b>` (contact), `n:<col>:<row>` and `e:<nodeA>|<nodeB>` (lattice), `t<k>:o`, `t<k>:<segment>`
 * and `t<k>:e<segment>` (branches). Every element seed is `componentSeed(graph seed, id, purpose)`.
 * Palette, material, filters, direction and route edits never change ids, positions or seeds;
 * structural edits may replace ids of the elements they change.
 *
 * Direction. `Graph.directed` says whether `from → to` is meaningful. Every producer stores its
 * natural orientation either way (contact: pursuer → pursued, the agent whose velocity closes on the
 * other faster, ties to the lower index; lattice and branches: older → younger, ties to the lower
 * node order), so switching direction on adds arrowheads and route constraints and moves nothing.
 * Failure: every producer and `graphFromParts` throws an `Error` naming the invalid input; work is
 * bounded by MAX_GRAPH_NODES / MAX_GRAPH_EDGES and by the sources' own budgets.
 */
export interface GraphNode {
  readonly id: string;
  readonly seed: number;
  readonly position: Point;
  readonly degree: number;
  readonly weight: number;
  readonly age: number;
}
export interface GraphEdge {
  readonly id: string;
  readonly seed: number;
  readonly from: string;
  readonly to: string;
  readonly weight: number;
  readonly age: number;
  readonly length: number;
}
export interface GraphStats {
  readonly maxDegree: number;
  readonly maxNodeWeight: number;
  readonly maxEdgeWeight: number;
  readonly maxAge: number;
}
export interface Graph {
  readonly seed: number;
  readonly directed: boolean;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly stats: GraphStats;
}
export interface GraphParts {
  readonly seed: number;
  readonly directed?: boolean;
  readonly nodes: readonly { readonly id: string; readonly position: Point }[];
  readonly edges: readonly { readonly id: string; readonly from: string; readonly to: string;
    readonly weight: number; readonly age: number }[];
}
/** Role selection: which part of a graph a treatment sees. Weight and age are fractions of the graph maxima. */
export interface GraphRoleOptions {
  readonly minDegree: number;
  readonly maxDegree: number;
  readonly minWeight: number;
  readonly maxWeight: number;
  readonly minAge: number;
  readonly maxAge: number;
  /** Keep nodes with no surviving edge. */
  readonly isolated: boolean;
}
/** A filtered graph view: the same element values, in source order, plus the parent graph. */
export interface GraphView {
  readonly graph: Graph;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}
export type RouteMode = "shortest" | "longest";
export type RouteMetric = "length" | "hops" | "weight";
export interface RouteOptions {
  readonly from: string;
  readonly to: string;
  readonly mode: RouteMode;
  /** Edge cost: Euclidean length, 1 per edge, or `1 - weight` (strong edges are short). */
  readonly metric: RouteMetric;
  /** Traverse edges only from → to; ignored unless the graph is directed. */
  readonly followDirection: boolean;
}
export interface GraphRoute {
  readonly id: string;
  readonly mode: RouteMode;
  readonly metric: RouteMetric;
  readonly nodes: readonly string[];
  /** Edge ids in traversal order. */
  readonly edges: readonly string[];
  readonly total: number;
  /** False only when a longest-route search stopped at its work bound and returned the best route found. */
  readonly exact: boolean;
  readonly path: Path;
}
export interface GraphFace extends Path {
  readonly nodes: readonly string[];
  readonly edges: readonly string[];
  readonly area: number;
}
export interface FaceExtraction {
  readonly faces: readonly GraphFace[];
  /** Edges that cross, touch or overlap another edge (sorted ids); they never bound a face. */
  readonly crossingEdges: readonly string[];
  readonly prunedEdges: number;
  readonly rejected: { readonly pinched: number; readonly crossed: number; readonly island: number; readonly degenerate: number };
}

export const MAX_GRAPH_NODES = 20_000;
export const MAX_GRAPH_EDGES = 60_000;
/** Most direction markers `edgeMarkers` will place; denser networks get a stable subset. */
export const MAX_EDGE_MARKERS = 400;
const ROUTE_SEARCH_LIMIT = 100_000;
const FACE_WORK_LIMIT = 5_000_000;
const U32 = 0x1_0000_0000;
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;

function requireSeed(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Graph seed must be a uint32 integer");
}
function finite(label: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}
function integer(label: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer in [${min}, ${max}]`);
}

/** Admit a supplied graph. Validates ids, endpoints, simplicity, weights and ages, then derives every attribute. */
export function graphFromParts(parts: GraphParts): Graph {
  requireSeed(parts.seed);
  if (parts.nodes.length > MAX_GRAPH_NODES) throw new Error(`Graph has ${parts.nodes.length} nodes; limit ${MAX_GRAPH_NODES}`);
  if (parts.edges.length > MAX_GRAPH_EDGES) throw new Error(`Graph has ${parts.edges.length} edges; limit ${MAX_GRAPH_EDGES}`);
  const order = new Map<string, number>();
  parts.nodes.forEach((node, index) => {
    if (typeof node.id !== "string" || node.id === "") throw new Error("Graph node ids must be non-empty strings");
    if (order.has(node.id)) throw new Error(`Graph node id ${node.id} is repeated`);
    if (!Number.isFinite(node.position[0]) || !Number.isFinite(node.position[1])) throw new Error(`Graph node ${node.id} needs a finite position`);
    order.set(node.id, index);
  });
  const degree = new Int32Array(parts.nodes.length), strength = new Float64Array(parts.nodes.length), oldest = new Int32Array(parts.nodes.length);
  const seenEdges = new Set<string>(), seenPairs = new Map<string, string>();
  const edges = parts.edges.map((edge): GraphEdge => {
    if (typeof edge.id !== "string" || edge.id === "") throw new Error("Graph edge ids must be non-empty strings");
    if (seenEdges.has(edge.id)) throw new Error(`Graph edge id ${edge.id} is repeated`);
    seenEdges.add(edge.id);
    const a = order.get(edge.from), b = order.get(edge.to);
    if (a === undefined || b === undefined) throw new Error(`Graph edge ${edge.id} names a node that does not exist`);
    if (a === b) throw new Error(`Graph edge ${edge.id} is a self-loop`);
    const pair = a < b ? `${a}:${b}` : `${b}:${a}`, other = seenPairs.get(pair);
    if (other !== undefined) throw new Error(`Graph edge ${edge.id} duplicates ${other} between the same nodes`);
    seenPairs.set(pair, edge.id);
    finite(`Graph edge ${edge.id} weight`, edge.weight, 0, 1);
    if (!Number.isSafeInteger(edge.age) || edge.age < 1) throw new Error(`Graph edge ${edge.id} age must be a positive integer`);
    degree[a]++; degree[b]++; strength[a] += edge.weight; strength[b] += edge.weight;
    oldest[a] = Math.max(oldest[a], edge.age); oldest[b] = Math.max(oldest[b], edge.age);
    const p = parts.nodes[a].position, q = parts.nodes[b].position;
    return Object.freeze({ id: edge.id, seed: componentSeed(parts.seed, edge.id, "edge"), from: edge.from, to: edge.to,
      weight: edge.weight, age: edge.age, length: Math.hypot(p[0] - q[0], p[1] - q[1]) });
  });
  const nodes = parts.nodes.map((node, index): GraphNode => Object.freeze({ id: node.id,
    seed: componentSeed(parts.seed, node.id, "node"), position: Object.freeze([node.position[0], node.position[1]] as const),
    degree: degree[index], weight: strength[index], age: oldest[index] }));
  let maxEdgeWeight = 0, maxAge = 0;
  for (const edge of edges) { maxEdgeWeight = Math.max(maxEdgeWeight, edge.weight); maxAge = Math.max(maxAge, edge.age); }
  return Object.freeze({ seed: parts.seed, directed: parts.directed === true, nodes: Object.freeze(nodes), edges: Object.freeze(edges),
    stats: Object.freeze({ maxDegree: Math.max(0, ...degree), maxNodeWeight: Math.max(0, ...strength), maxEdgeWeight, maxAge }) });
}

/** The same nodes and edges with `from → to` declared meaningful or not. No element changes. */
export function withDirection(graph: Graph, directed: boolean): Graph {
  return graph.directed === directed ? graph : Object.freeze({ ...graph, directed });
}

/* ---------------------------------------------------------------- producers */

export interface ContactGraphOptions {
  seed: number;
  count: number;
  startShape: "area" | "line" | "ring" | "grid";
  centerX: number;
  centerY: number;
  /** Extent of the starting shape; height/width is its aspect. */
  width: number;
  height: number;
  /** Degrees, rotation of the starting layout. */
  rotation: number;
  disorder: number;
  ticks: number;
  radius: number;
  force: number;
  avoidance: number;
  speed: number;
  /** Velocity multiplier per tick; near 1 the agents keep drifting and the network keeps evolving. */
  damping: number;
}
const contactCache = new Map<string, Graph>();
/**
 * Contact network graph: agents are nodes at their final positions; an edge joins two agents within
 * `radius` of each other after `ticks` synchronous pair-force steps (the existing contact-network
 * replay). Edge weight is closeness `1 - distance / radius`. Edge age is the number of consecutive
 * ticks, ending at the final tick, in which the pair has been in contact. Ids `a:<i>`, `e:<a>:<b>`
 * with a < b. Structure depends on the seed only through starting disorder and heading spread.
 */
export function contactGraph(options: ContactGraphOptions): Graph {
  const { seed, count, startShape, centerX, centerY, width, height, rotation, disorder, ticks, radius, force, avoidance, speed, damping } = options;
  requireSeed(seed);
  integer("Contact agents", count, 1, 160);
  integer("Contact ticks", ticks, 0, 180);
  finite("Contact width", width, 1, 2000); finite("Contact height", height, 0, 20000);
  const key = JSON.stringify([seed, count, startShape, centerX, centerY, width, height, rotation, disorder, ticks, radius, force, avoidance, speed, damping]);
  return memoized(contactCache, key, () => {
    const base = proximityReplayInstrumentDefinitions[0].defaults;
    const replay = buildProximityReplay({ ...base, count, sourceMode: startShape, centerX, centerY, extent: width,
      aspect: height / width, angle: rotation, disorder, ticks, radius, force, avoidance, speed, damping, openChains: false }, seed);
    const runStart = new Map<number, number>();
    const stride = count;
    for (let tick = 0; tick < replay.pairHistory.length; tick++) {
      const present = new Set<number>();
      const flat = replay.pairHistory[tick];
      for (let i = 0; i < flat.length; i += 2) present.add(Math.min(flat[i], flat[i + 1]) * stride + Math.max(flat[i], flat[i + 1]));
      for (const pairKey of [...runStart.keys()]) if (!present.has(pairKey)) runStart.delete(pairKey);
      for (const pairKey of present) if (!runStart.has(pairKey)) runStart.set(pairKey, tick);
    }
    const last = replay.pairHistory.length - 1;
    const points = replay.points, velocities = replay.velocities;
    const edges = replay.pairs.map(([p, q]) => {
      const a = Math.min(p, q), b = Math.max(p, q);
      const dx = points[b][0] - points[a][0], dy = points[b][1] - points[a][1], distance = Math.hypot(dx, dy);
      // Pursuit: the agent closing on the other faster is the tail; ties keep the lower index first.
      const closeA = distance > 0 ? (velocities[a][0] * dx + velocities[a][1] * dy) / distance : 0;
      const closeB = distance > 0 ? -(velocities[b][0] * dx + velocities[b][1] * dy) / distance : 0;
      const [from, to] = closeB > closeA ? [b, a] : [a, b];
      return { id: `e:${a}:${b}`, from: `a:${from}`, to: `a:${to}`,
        weight: radius > 0 ? Math.max(0, Math.min(1, 1 - distance / radius)) : 1,
        age: last - runStart.get(a * stride + b)! + 1, order: [a, b] as const };
    }).sort((x, y) => x.order[0] - y.order[0] || x.order[1] - y.order[1]);
    return graphFromParts({ seed, nodes: points.map(([x, y], i) => ({ id: `a:${i}`, position: [x, y] as const })),
      edges: edges.map(({ id, from, to, weight, age }) => ({ id, from, to, weight, age })) });
  });
}

export interface LatticeGraphOptions {
  seed: number;
  columns: number;
  rows: number;
  region: "rectangle" | "disc" | "annulus";
  innerRadius: number;
  /** Seeded fraction of sites removed before growth. */
  blocked: number;
  /** Fraction of the lattice edges outside the spanning forest that are kept (loops). */
  braid: number;
  /** Probability that each cell diagonal between kept sites exists; both diagonals of a cell cross. */
  diagonals: number;
  /** Stable per-site displacement, as a fraction of 0.4 lattice spacings in the lattice frame. */
  wobble: number;
  /** Preferred growth root, normalized across the full lattice. */
  rootX: number;
  rootY: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  /** Degrees. */
  rotation: number;
}
const latticeCache = new Map<string, Graph>();
/**
 * Lattice growth graph: kept sites of a rotated grid, the existing seeded depth-first spanning forest
 * over them (tree edges, parent → child), plus `braid` of the remaining grid edges and `diagonals`
 * of the cell diagonals (older endpoint → younger). Ids `n:<col>:<row>`, `e:<A>|<B>` with A before B
 * in (row, column) order. Edge birth is the child's depth for tree edges and the deeper endpoint's
 * depth otherwise; age = last birth − birth + 1. Edge weight is smooth seeded value noise sampled
 * at the edge midpoint (neighbouring edges have similar weights, so strong corridors form).
 * Blocked sites are decided by the existing sequential stream, so changing the lattice size may
 * rename ids; every other control leaves ids untouched.
 */
export function latticeGraph(options: LatticeGraphOptions): Graph {
  const { seed, columns, rows, region, innerRadius, blocked, braid, diagonals, wobble, rootX, rootY, centerX, centerY, width, height, rotation } = options;
  requireSeed(seed);
  integer("Lattice columns", columns, 2, 60); integer("Lattice rows", rows, 2, 60);
  finite("Lattice braid", braid, 0, 1); finite("Lattice diagonals", diagonals, 0, 1); finite("Lattice wobble", wobble, 0, 1);
  finite("Lattice width", width, 1, 8192); finite("Lattice height", height, 1, 8192);
  const key = JSON.stringify([seed, columns, rows, region, innerRadius, blocked, braid, diagonals, wobble, rootX, rootY, centerX, centerY, width, height, rotation]);
  return memoized(latticeCache, key, () => {
    const forest = graphForest({ columns, rows, spacing: 1, centerX: 0, centerY: 0, orientation: 0, shape: region, innerRadius,
      blocked, rootX, rootY, minDepth: 0, maxDepth: 8000, branchRetention: 1, weight: 1, dotSize: 1, nodes: false }, seed);
    const spacingX = width / (columns - 1), spacingY = height / (rows - 1);
    const turn = rotation * Math.PI / 180, cos = Math.cos(turn), sin = Math.sin(turn);
    const depth = new Map<number, number>(), tree = new Map<string, number>(), parentOf = new Map<number, number>();
    const vertexOrder: number[] = [];
    const pairKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;
    for (const part of forest) {
      part.vertices.forEach((vertex, local) => {
        depth.set(vertex, part.depths[local]); vertexOrder.push(vertex);
        if (part.parents[local] >= 0) parentOf.set(vertex, part.vertices[part.parents[local]]);
      });
      for (const [a, b] of part.edges) tree.set(pairKey(part.vertices[a], part.vertices[b]), 1);
    }
    vertexOrder.sort((a, b) => a - b);
    const col = (v: number) => v % columns, row = (v: number) => Math.floor(v / columns);
    const nodeId = (v: number) => `n:${col(v)}:${row(v)}`;
    const nodes = vertexOrder.map((v) => {
      const id = nodeId(v), at = latticeVertexPosition(v, columns, rows, spacingX, spacingY, centerX, centerY, rotation);
      const jx = wobble > 0 ? (unit(seed, id, "wobble-x") * 2 - 1) * .4 * wobble * spacingX : 0;
      const jy = wobble > 0 ? (unit(seed, id, "wobble-y") * 2 - 1) * .4 * wobble * spacingY : 0;
      return { id, position: [at[0] + jx * cos - jy * sin, at[1] + jx * sin + jy * cos] as Point };
    });
    // Rows first, then columns, so an id's A is always the earlier of the pair.
    const ordered = (a: number, b: number): [number, number] => (row(a) - row(b) || col(a) - col(b)) <= 0 ? [a, b] : [b, a];
    const noise = gradientNoise2D01({ seed: componentSeed(seed, "lattice-graph", "weight") });
    const raw: { a: number; b: number; from: number; to: number; birth: number; weight: number }[] = [];
    const retained = new Set(vertexOrder);
    const consider = (u: number, v: number, kind: "grid" | "diagonal"): void => {
      if (!retained.has(u) || !retained.has(v)) return;
      const [a, b] = ordered(u, v);
      const id = `e:${nodeId(a)}|${nodeId(b)}`;
      const inTree = tree.has(pairKey(a, b));
      if (!inTree && kind === "grid" && !(unit(seed, id, "braid") < braid)) return;
      if (kind === "diagonal" && !(unit(seed, id, "diagonal") < diagonals)) return;
      const da = depth.get(a)!, db = depth.get(b)!;
      let from = a, to = b, birth = Math.max(da, db);
      if (inTree) { const childIsB = parentOf.get(b) === a; from = childIsB ? a : b; to = childIsB ? b : a; birth = depth.get(to)!; }
      else if (db < da) { from = b; to = a; }
      const sample = noise.sample(((col(a) + col(b)) / 2) / 4, ((row(a) + row(b)) / 2) / 4);
      raw.push({ a, b, from, to, birth, weight: Math.max(0, Math.min(1, (sample - .5) * 3.2 + .5)) });
    };
    for (const v of vertexOrder) {
      if (col(v) + 1 < columns) consider(v, v + 1, "grid");
      if (row(v) + 1 < rows) consider(v, v + columns, "grid");
      if (col(v) + 1 < columns && row(v) + 1 < rows) consider(v, v + columns + 1, "diagonal");
      if (col(v) > 0 && row(v) + 1 < rows) consider(v, v + columns - 1, "diagonal");
    }
    const lastBirth = raw.reduce((most, edge) => Math.max(most, edge.birth), 0);
    return graphFromParts({ seed, nodes, edges: raw.map((edge) => ({ id: `e:${nodeId(edge.a)}|${nodeId(edge.b)}`,
      from: nodeId(edge.from), to: nodeId(edge.to), weight: edge.weight, age: lastBirth - edge.birth + 1 })) });
  });
}

export interface BranchGraphOptions {
  seed: number;
  roots: number;
  generations: number;
  children: 2 | 3;
  angle: number;
  angleSpread: number;
  contraction: number;
  survival: number;
  rootLength: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  /** Degrees; the whole structure turns about (centerX, centerY). */
  rotation: number;
}
const branchCache = new Map<string, Graph>();
/**
 * Branch tree graph: each root grows the existing seeded breadth-first endpoint tree upward from a line
 * of roots `width` wide, and the whole forest is then fitted into the placement footprint (see the
 * fit rule below: uniform scale to fit width × height, centered, then rotated); a node is a segment end (plus each root origin) and an edge is a
 * segment, parent → child. Edge weight is the segment's share of its tree's segments (the trunk is
 * 1); edge age is `last generation − generation + 1`. Ids `t<k>:o`, `t<k>:<segment>`, `t<k>:e<segment>`.
 * The result is a forest: it has no cycles, hence no faces.
 */
export function branchGraph(options: BranchGraphOptions): Graph {
  const { seed, roots, generations, children, angle, angleSpread, contraction, survival, rootLength, centerX, centerY, width, height, rotation } = options;
  requireSeed(seed);
  finite("Branch width", width, 1, 4096); finite("Branch height", height, 1, 4096);
  const key = JSON.stringify([seed, roots, generations, children, angle, angleSpread, contraction, survival, rootLength, centerX, centerY, width, height, rotation]);
  return memoized(branchCache, key, () => {
    const trees = buildBranchTrees({ rootCount: roots, layout: "line", columns: 1, centerX, centerY: centerY + height / 2, extent: width,
      aspect: 1, heading: -90, headingSpread: 0, rootLength, generations, children: String(children), angle, angleSpread,
      contraction, survival, strokes: true, weight: 1, tipSize: 0 }, seed);
    // Fit rule: the grown forest (any tree lengths, however far branches spread) is scaled uniformly, about
    // its bounding-box center, so that its bounding box fits inside width × height and touches at least one
    // of them, then centered on (centerX, centerY) and finally turned by `rotation` about that center.
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const tree of trees) for (let i = 0; i < tree.size; i++) {
      const segment = tree.segmentAt(i);
      for (const [x, y] of i === 0 ? [[segment[0], segment[1]], [segment[2], segment[3]]] : [[segment[2], segment[3]]]) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    const spanX = x1 - x0, spanY = y1 - y0;
    const fit = Math.min(spanX > 0 ? width / spanX : Infinity, spanY > 0 ? height / spanY : Infinity);
    const scale = Number.isFinite(fit) ? fit : 1;
    const turn = rotation * Math.PI / 180, cos = Math.cos(turn), sin = Math.sin(turn);
    const place = (x: number, y: number): Point => {
      const dx = (x - (x0 + x1) / 2) * scale, dy = (y - (y0 + y1) / 2) * scale;
      return [centerX + dx * cos - dy * sin, centerY + dx * sin + dy * cos];
    };
    const nodes: { id: string; position: Point }[] = [], edges: GraphParts["edges"][number][] = [];
    trees.forEach((tree, k) => {
      const size = new Float64Array(tree.size).fill(1);
      for (let i = tree.size - 1; i > 0; i--) size[tree.parentAt(i)] += size[i];
      let lastGeneration = 0;
      for (let i = 0; i < tree.size; i++) lastGeneration = Math.max(lastGeneration, tree.generationAt(i));
      const root = tree.segmentAt(0);
      nodes.push({ id: `t${k}:o`, position: place(root[0], root[1]) });
      for (let i = 0; i < tree.size; i++) {
        const segment = tree.segmentAt(i), parent = tree.parentAt(i);
        nodes.push({ id: `t${k}:${i}`, position: place(segment[2], segment[3]) });
        edges.push({ id: `t${k}:e${i}`, from: parent < 0 ? `t${k}:o` : `t${k}:${parent}`, to: `t${k}:${i}`,
          weight: size[i] / size[0], age: lastGeneration - tree.generationAt(i) + 1 });
      }
    });
    return graphFromParts({ seed, nodes, edges });
  });
}

/**
 * The attractor-growth branch tree (`branchTree`) as a `Graph`, so every graph role (selection, routes,
 * faces, edge/node treatments) applies to it. It is a pure conversion of the frozen tree: nothing is
 * regrown, and the tree's routing, growth and seeds are untouched.
 *
 * - **Ids.** Node and edge ids are the tree's own (`root:<n>`, `end:<tick>.<k>`, `edge:<tick>.<k>`), so
 *   they keep the tree's stability: raising the growth `ticks` keeps every id; routing never renames.
 *   Element seeds follow the graph convention, `componentSeed(tree.seed, id, "node" | "edge")`, which
 *   is exactly the tree's own seed derivation.
 * - **Direction.** Edges run trunk → tip (`from` is the node the edge leaves, `to` the node it ends on);
 *   `directed` defaults to true and can be switched with `withDirection` without moving anything.
 * - **Roles.** Not stored: derive them from direction. A trunk has no incoming edge, a terminal no
 *   outgoing edge, a fork two or more outgoing edges; so trunk and terminal are the degree-1 nodes told
 *   apart by which end they are, and a fork is any node of degree three or more (one in, two or more out).
 * - **Weight.** The edge's share of its tree's terminals: terminals beyond the edge divided by the
 *   terminals of its whole tree, so a trunk edge is 1 and a lone tip edge is 1 / (tree terminals).
 * - **Age.** `lastTick − tick + 1` where `tick` is the growth tick of the edge's first segment and
 *   `lastTick` the greatest such tick over the whole tree: the trunk is oldest, and a child is always
 *   younger than its parent edge. Unlike the branch tree's own `age` (the raw tick) this follows the
 *   graph convention that a larger age is older.
 * - **Geometry.** Node positions are the tree's. Graph `length` is the straight distance between the two
 *   nodes; the tree's polyline length stays on the tree's edge.
 * - **Failure / bounds.** An over-large tree throws the graph limits' error; the empty tree gives the
 *   empty graph. Several roots make several components.
 */
export function graphFromBranchTree(tree: BranchTree, options: { directed?: boolean } = {}): Graph {
  const terminals = new Map<string, number>();
  // Children follow their parent in tree order, so a reverse pass sees every child first.
  for (let i = tree.edges.length - 1; i >= 0; i--) {
    const edge = tree.edges[i];
    terminals.set(edge.id, edge.children.length === 0 ? 1 : edge.children.reduce((sum, child) => sum + terminals.get(child)!, 0));
  }
  const rootShare = new Map<number, number>();
  for (const edge of tree.edges) if (edge.parent === null) rootShare.set(edge.tree, (rootShare.get(edge.tree) ?? 0) + terminals.get(edge.id)!);
  let lastTick = 0;
  for (const edge of tree.edges) lastTick = Math.max(lastTick, edge.age);
  return graphFromParts({ seed: tree.seed, directed: options.directed ?? true,
    nodes: tree.nodes.map((node) => ({ id: node.id, position: node.position })),
    edges: tree.edges.map((edge) => ({ id: edge.id, from: edge.from, to: edge.to,
      weight: terminals.get(edge.id)! / rootShare.get(edge.tree)!, age: lastTick - edge.age + 1 })) });
}

/* ---------------------------------------------------------- role selection */

/** The part of the graph the treatments see. Attributes are the source graph's; nothing is renumbered. */
export function selectGraph(graph: Graph, roles: GraphRoleOptions): GraphView {
  integer("minDegree", roles.minDegree, 0, MAX_GRAPH_EDGES); integer("maxDegree", roles.maxDegree, 0, MAX_GRAPH_EDGES);
  if (roles.minDegree > roles.maxDegree) throw new Error("minDegree must not exceed maxDegree");
  for (const [low, high, name] of [[roles.minWeight, roles.maxWeight, "weight"], [roles.minAge, roles.maxAge, "age"]] as const) {
    finite(`min ${name}`, low, 0, 1); finite(`max ${name}`, high, 0, 1);
    if (low > high) throw new Error(`min ${name} must not exceed max ${name}`);
  }
  const byId = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const degreeOk = (node: GraphNode) => node.degree >= roles.minDegree && node.degree <= roles.maxDegree;
  const { maxEdgeWeight, maxAge } = graph.stats;
  const tolerance = 1e-12;
  const edges = graph.edges.filter((edge) => {
    if (!degreeOk(byId.get(edge.from)!) || !degreeOk(byId.get(edge.to)!)) return false;
    const weight = maxEdgeWeight > 0 ? edge.weight / maxEdgeWeight : 0, age = maxAge > 0 ? edge.age / maxAge : 0;
    return weight >= roles.minWeight - tolerance && weight <= roles.maxWeight + tolerance &&
      age >= roles.minAge - tolerance && age <= roles.maxAge + tolerance;
  });
  const touched = new Set<string>();
  for (const edge of edges) { touched.add(edge.from); touched.add(edge.to); }
  const nodes = graph.nodes.filter((node) => degreeOk(node) && (roles.isolated || touched.has(node.id)));
  return Object.freeze({ graph, nodes: Object.freeze(nodes), edges: Object.freeze(edges) });
}

/**
 * The nearest node of a view to a canvas point; the earliest in source order wins a tie. With `within`
 * (a set of node ids, e.g. one connected component) only those nodes are considered.
 */
export function nearestNode(view: GraphView, point: Point, within?: ReadonlySet<string>): GraphNode | undefined {
  let best: GraphNode | undefined, bestDistance = Infinity;
  for (const node of view.nodes) {
    if (within && !within.has(node.id)) continue;
    const distance = Math.hypot(node.position[0] - point[0], node.position[1] - point[1]);
    if (distance < bestDistance) { best = node; bestDistance = distance; }
  }
  return best;
}

/** Ids of the nodes connected to `id` through the view's edges, ignoring direction (includes `id`). */
export function connectedNodes(view: GraphView, id: string): ReadonlySet<string> {
  const adjacent = new Map<string, string[]>();
  for (const edge of view.edges) {
    (adjacent.get(edge.from) ?? adjacent.set(edge.from, []).get(edge.from)!).push(edge.to);
    (adjacent.get(edge.to) ?? adjacent.set(edge.to, []).get(edge.to)!).push(edge.from);
  }
  const seen = new Set<string>([id]), queue = [id];
  for (let head = 0; head < queue.length; head++)
    for (const next of adjacent.get(queue[head]) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  return seen;
}

/* ------------------------------------------------------------------ routes */

type Arc = { readonly to: number; readonly edge: number };
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
class Heap {
  private readonly items: [number, number, number][] = [];
  get size(): number { return this.items.length; }
  private static before(a: [number, number, number], b: [number, number, number]): boolean {
    return near(a[0], b[0]) ? (a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2]) : a[0] < b[0];
  }
  push(item: [number, number, number]): void {
    const items = this.items; items.push(item);
    for (let i = items.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (!Heap.before(items[i], items[parent])) break;
      [items[i], items[parent]] = [items[parent], items[i]]; i = parent;
    }
  }
  pop(): [number, number, number] {
    const items = this.items, top = items[0], last = items.pop()!;
    if (items.length) {
      items[0] = last;
      for (let i = 0;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < items.length && Heap.before(items[l], items[m])) m = l;
        if (r < items.length && Heap.before(items[r], items[m])) m = r;
        if (m === i) break;
        [items[i], items[m]] = [items[m], items[i]]; i = m;
      }
    }
    return top;
  }
}

/**
 * The route between two nodes of a view, as a `Path` through the nodes' positions in traversal order.
 *
 * `shortest` minimizes the total edge cost of `metric`. Ties are broken by an explicit, deterministic
 * rule: among routes of equal cost (relative tolerance 1e-9) the one with fewer edges, then the one
 * whose node sequence is lexicographically smallest in graph node order.
 *
 * `longest` maximizes the same total over simple routes (no node repeated). That problem is
 * NP-hard in general, so the depth-first search visits neighbours with the fewest onward options
 * first, replaces its best only when strictly longer (the first route found wins a tie), and stops
 * after 100,000 expansions. When it stops early the best route found so far is returned with
 * `exact: false`; if it found none, the shortest route is returned (also `exact: false`).
 *
 * Returns null when no route exists (a disconnected view, or directions that forbid it). Throws when
 * an endpoint is not in the view. A directed graph is traversed only forward when `followDirection`.
 */
export function graphRoute(view: GraphView, options: RouteOptions): GraphRoute | null {
  const index = new Map(view.nodes.map((node, i) => [node.id, i] as const));
  const source = index.get(options.from), target = index.get(options.to);
  if (source === undefined) throw new Error(`Route start ${options.from} is not in the selected view`);
  if (target === undefined) throw new Error(`Route end ${options.to} is not in the selected view`);
  const cost = (edge: number): number => {
    const value = view.edges[edge];
    return options.metric === "length" ? value.length : options.metric === "hops" ? 1 : 1 - value.weight;
  };
  const forward: Arc[][] = view.nodes.map(() => []), backward: Arc[][] = view.nodes.map(() => []);
  const oneWay = options.followDirection && view.graph.directed;
  view.edges.forEach((edge, e) => {
    const a = index.get(edge.from)!, b = index.get(edge.to)!;
    forward[a].push({ to: b, edge: e }); backward[b].push({ to: a, edge: e });
    if (!oneWay) { forward[b].push({ to: a, edge: e }); backward[a].push({ to: b, edge: e }); }
  });
  for (const list of [...forward, ...backward]) list.sort((x, y) => x.to - y.to || x.edge - y.edge);
  const finish = (nodes: number[], edges: number[], exact: boolean): GraphRoute => {
    const id = `route:${options.from}>${options.to}`;
    let total = 0;
    for (const edge of edges) total += cost(edge);
    const points = nodes.map((node) => view.nodes[node].position);
    return Object.freeze({ id, mode: options.mode, metric: options.metric, exact, total,
      nodes: Object.freeze(nodes.map((node) => view.nodes[node].id)), edges: Object.freeze(edges.map((edge) => view.edges[edge].id)),
      path: Object.freeze({ id, seed: componentSeed(view.graph.seed, id, "route"), points: Object.freeze(points), closed: false,
        level: 0, levelFraction: 0, tone: 1 }) });
  };
  if (source === target) return finish([source], [], true);

  // Backward Dijkstra from the target on (cost, edge count).
  const dist = new Float64Array(view.nodes.length).fill(Infinity), hops = new Int32Array(view.nodes.length);
  dist[target] = 0;
  const heap = new Heap(); heap.push([0, 0, target]);
  while (heap.size) {
    const [d, h, u] = heap.pop();
    if (d > dist[u] && !near(d, dist[u]) || (near(d, dist[u]) && h > hops[u])) continue;
    for (const { to: v, edge } of backward[u]) {
      const nd = d + cost(edge), nh = h + 1;
      const better = !Number.isFinite(dist[v]) || (near(nd, dist[v]) ? nh < hops[v] : nd < dist[v]);
      if (better) { dist[v] = nd; hops[v] = nh; heap.push([nd, nh, v]); }
    }
  }
  if (!Number.isFinite(dist[source])) return null;
  const shortest = (): GraphRoute => {
    const nodes = [source], edges: number[] = [];
    for (let u = source; u !== target;) {
      const step = forward[u].find(({ to: v, edge }) => Number.isFinite(dist[v]) && hops[v] + 1 === hops[u] && near(dist[v] + cost(edge), dist[u]))!;
      nodes.push(step.to); edges.push(step.edge); u = step.to;
    }
    return finish(nodes, edges, true);
  };
  if (options.mode === "shortest") return shortest();

  // Longest simple route: bounded depth-first search, fewest-onward-options first.
  const visited = new Uint8Array(view.nodes.length);
  const onward = (u: number): Arc[] => forward[u].filter(({ to }) => !visited[to])
    .map((arc) => ({ arc, free: forward[arc.to].reduce((count, next) => count + (visited[next.to] ? 0 : 1), 0) }))
    .sort((x, y) => x.free - y.free || x.arc.to - y.arc.to || x.arc.edge - y.arc.edge).map(({ arc }) => arc);
  interface Frame { node: number; arcs: Arc[]; next: number; total: number }
  const frames: Frame[] = [{ node: source, arcs: [], next: 0, total: 0 }];
  const nodeStack = [source], edgeStack: number[] = [];
  visited[source] = 1; frames[0].arcs = onward(source);
  let best: { nodes: number[]; edges: number[] } | undefined, bestTotal = -Infinity, expansions = 0, exact = true;
  while (frames.length) {
    const frame = frames[frames.length - 1];
    if (frame.next >= frame.arcs.length) {
      frames.pop(); visited[frame.node] = 0; nodeStack.pop(); edgeStack.pop();
      continue;
    }
    const arc = frame.arcs[frame.next++];
    if (visited[arc.to]) continue;
    const total = frame.total + cost(arc.edge);
    if (arc.to === target) {
      if (best === undefined || (total > bestTotal && !near(total, bestTotal))) {
        bestTotal = total; best = { nodes: [...nodeStack, arc.to], edges: [...edgeStack, arc.edge] };
      }
      continue;
    }
    if (++expansions > ROUTE_SEARCH_LIMIT) { exact = false; break; }
    visited[arc.to] = 1; nodeStack.push(arc.to); edgeStack.push(arc.edge);
    frames.push({ node: arc.to, arcs: onward(arc.to), next: 0, total });
  }
  if (!best) return Object.freeze({ ...shortest(), exact: false });
  return finish(best.nodes, best.edges, exact);
}

/* ------------------------------------------------- roles as sites and paths */

export type GraphAttribute = "degree" | "weight" | "age";
/** A node attribute as a fraction of the graph maximum, in [0, 1] (0 for a graph whose maximum is 0). */
export function nodeFraction(node: GraphNode, graph: Graph, attribute: GraphAttribute): number {
  const [value, max] = attribute === "degree" ? [node.degree, graph.stats.maxDegree]
    : attribute === "weight" ? [node.weight, graph.stats.maxNodeWeight] : [node.age, graph.stats.maxAge];
  return max > 0 ? value / max : 0;
}
/** An edge attribute as a fraction of the graph maximum, in [0, 1]. */
export function edgeFraction(edge: GraphEdge, graph: Graph, attribute: "weight" | "age"): number {
  const [value, max] = attribute === "weight" ? [edge.weight, graph.stats.maxEdgeWeight] : [edge.age, graph.stats.maxAge];
  return max > 0 ? value / max : 0;
}

/**
 * One two-point `Path` per view edge, ordered from → to (so beads and stitches run with the edge's
 * direction and arrow beads point along it). `level` is the age; `levelFraction` is 0 for the oldest
 * edge toward 1 for the newest. `tone` is chosen by the caller and never changes structure.
 */
export function edgePaths(view: GraphView, tone: (edge: GraphEdge, graph: Graph) => number = () => 0): readonly Path[] {
  const at = new Map(view.nodes.map((node) => [node.id, node.position] as const));
  const { maxAge } = view.graph.stats;
  return Object.freeze(view.edges.map((edge): Path => Object.freeze({ id: edge.id, seed: edge.seed,
    points: Object.freeze([at.get(edge.from)!, at.get(edge.to)!]),
    closed: false, level: edge.age, levelFraction: maxAge > 0 ? 1 - edge.age / maxAge : 0, tone: tone(edge, view.graph) })));
}

/** Nodes as upright sites. `scale` and `tone` are the caller's mappings from role to size and colour. */
export function nodeSites(view: GraphView, options: {
  scale?: (node: GraphNode, graph: Graph) => number; tone?: (node: GraphNode, graph: Graph) => number } = {}): readonly Site[] {
  const { scale = () => 1, tone = () => 0 } = options;
  return Object.freeze(view.nodes.map((node): Site => {
    const value = scale(node, view.graph);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Node scale for ${node.id} must be positive and finite`);
    return Object.freeze({ id: node.id, seed: node.seed, position: node.position, angle: 0, scale: value, tone: tone(node, view.graph) });
  }));
}

/**
 * Direction markers: one site at the midpoint of a view edge, turned along from → to. Ids `<edge id>/arrow`.
 * Legibility rules: an edge shorter than three times `size` gets no marker (it would swallow the edge);
 * `share` (0–1, default 1) keeps a stable, id-selected fraction of the eligible edges; and at most
 * `MAX_EDGE_MARKERS` (400) are drawn, by lowering the share to fit. The kept set is always the eligible
 * edges with the smallest id-derived draws, so raising the share or the cap only adds markers.
 */
export function edgeMarkers(view: GraphView, size: number, tone: (edge: GraphEdge, graph: Graph) => number = () => 0, share = 1): readonly Site[] {
  finite("Marker size", size, 0.001, 1000);
  finite("Marker share", share, 0, 1);
  const at = new Map(view.graph.nodes.map((node) => [node.id, node.position] as const));
  const eligible = view.edges.map((edge) => ({ edge, id: `${edge.id}/arrow` }))
    .filter(({ edge }) => edge.length >= 3 * size)
    .map((item) => ({ ...item, seed: componentSeed(view.graph.seed, item.id, "arrow") }));
  const limit = Math.min(share, MAX_EDGE_MARKERS / Math.max(1, eligible.length));
  const sites: Site[] = [];
  for (const { edge, id, seed } of eligible) {
    if (limit < 1 && seed / U32 >= limit) continue;
    const a = at.get(edge.from)!, b = at.get(edge.to)!;
    sites.push(Object.freeze({ id, seed, position: Object.freeze([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const),
      angle: Math.atan2(b[1] - a[1], b[0] - a[0]), scale: 1, tone: tone(edge, view.graph) }));
  }
  return Object.freeze(sites);
}

/* -------------------------------------------------------------- planar faces */

const faceCache = new WeakMap<GraphView, FaceExtraction>();
/**
 * Bounded faces of the view, and only genuine planar ones.
 *
 * Rule. The view is drawn with straight edges between node positions. (1) An edge that properly
 * crosses another edge, touches another edge's interior with an endpoint, or overlaps it collinearly
 * (within 1e-9 of the drawing's extent) is a crossing edge, and so is the edge it meets; no crossing
 * point becomes a node. Crossing edges never bound a face. Edges sharing an end node only meet
 * there. (2) Dangling chains (degree ≤ 1, repeatedly) are pruned: they bound nothing. (3) Faces of
 * the remaining planar edges are traced on the embedding, turning to the neighbour next clockwise
 * from the edge just walked, so every bounded face is walked counter-clockwise (positive area) and
 * each component's outer boundary clockwise (dropped). (4) A walk is filled only when it is a simple
 * polygon of at least three distinct nodes with positive area (a repeated node means a pinch or a
 * bridge: `pinched`), with no crossing edge running through it (`crossed`: a face pierced by an X of
 * diagonals is not a face) and with no other connected structure inside it (`island`: a face with a
 * hole is not a simple polygon). Zero-area or two-node walks are `degenerate`. Edge direction plays
 * no part: faces are undirected regions. Faces are `Path`s (closed, counter-clockwise, `level` =
 * side count, `levelFraction` = position of the face's area between the smallest (0) and the
 * largest (1) face on a log scale, 0 when all faces are equal), so any path material can outline them.
 *
 * Face ids are `face:` plus the node ids around the face, counter-clockwise, starting at the smallest
 * id (code-unit order), so they survive any change that does not alter the face's boundary,
 * including reordering the graph's nodes or edges. Work is counted (edge-cell
 * insertions, pair tests, point-in-polygon tests; pairs of edges that both already cross something are
 * skipped almost for free) against `maxWork` (default 5,000,000); exceeding it throws instead of
 * returning a partial answer.
 */
export function planarFaces(view: GraphView, options: { maxWork?: number } = {}): FaceExtraction {
  if (options.maxWork === undefined) { const hit = faceCache.get(view); if (hit) return hit; }
  const result = extractFaces(view, options.maxWork ?? FACE_WORK_LIMIT);
  if (options.maxWork === undefined) faceCache.set(view, result);
  return result;
}
function extractFaces(view: GraphView, maxWork: number): FaceExtraction {
  const nodeCount = view.nodes.length, edgeCount = view.edges.length;
  const none = (): FaceExtraction => Object.freeze({ faces: Object.freeze([]), crossingEdges: Object.freeze([]),
    prunedEdges: 0, rejected: Object.freeze({ pinched: 0, crossed: 0, island: 0, degenerate: 0 }) });
  if (edgeCount < 3) return none();
  const index = new Map(view.nodes.map((node, i) => [node.id, i] as const));
  const px = new Float64Array(nodeCount), py = new Float64Array(nodeCount);
  view.nodes.forEach((node, i) => { px[i] = node.position[0]; py[i] = node.position[1]; });
  const ea = new Int32Array(edgeCount), eb = new Int32Array(edgeCount);
  view.edges.forEach((edge, i) => { ea[i] = index.get(edge.from)!; eb[i] = index.get(edge.to)!; });
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < nodeCount; i++) { minX = Math.min(minX, px[i]); minY = Math.min(minY, py[i]); maxX = Math.max(maxX, px[i]); maxY = Math.max(maxY, py[i]); }
  const extent = Math.max(maxX - minX, maxY - minY, 1);
  const eps = 1e-9 * extent;
  let work = 0;
  const spend = (units: number): void => {
    work += units;
    if (work > maxWork) throw new Error(`Face extraction exceeds its work bound of ${maxWork} steps; use a sparser view, filter edges, or turn faces off`);
  };
  // Uniform grid over edge bounding boxes; each pair is tested once, in the cell holding the
  // maximum of the two boxes' minimum corners.
  let totalLength = 0;
  for (let i = 0; i < edgeCount; i++) totalLength += Math.hypot(px[ea[i]] - px[eb[i]], py[ea[i]] - py[eb[i]]);
  let cell = Math.max(totalLength / edgeCount, extent / 2048, eps * 4);
  // Boxes are inflated by eps, so the grid starts a little before the first node.
  const originX = minX - 2 * eps, originY = minY - 2 * eps;
  while (((maxX - originX) / cell + 2) * ((maxY - originY) / cell + 2) > 4_000_000) cell *= 2;
  const gridW = Math.floor((maxX - originX) / cell) + 2;
  const cellOf = (x: number, y: number): [number, number] => [Math.floor((x - originX) / cell), Math.floor((y - originY) / cell)];
  const boxes = new Float64Array(edgeCount * 4);
  const cells = new Map<number, number[]>();
  for (let i = 0; i < edgeCount; i++) {
    const x0 = Math.min(px[ea[i]], px[eb[i]]) - eps, x1 = Math.max(px[ea[i]], px[eb[i]]) + eps;
    const y0 = Math.min(py[ea[i]], py[eb[i]]) - eps, y1 = Math.max(py[ea[i]], py[eb[i]]) + eps;
    boxes[4 * i] = x0; boxes[4 * i + 1] = y0; boxes[4 * i + 2] = x1; boxes[4 * i + 3] = y1;
    const [c0, r0] = cellOf(x0, y0), [c1, r1] = cellOf(x1, y1);
    spend((c1 - c0 + 1) * (r1 - r0 + 1));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const key = r * gridW + c, list = cells.get(key);
      if (list) list.push(i); else cells.set(key, [i]);
    }
  }
  const conflict = new Uint8Array(edgeCount);
  const signed = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number =>
    ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / Math.hypot(bx - ax, by - ay);
  const onSegment = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean => {
    const length = Math.hypot(bx - ax, by - ay), t = ((cx - ax) * (bx - ax) + (cy - ay) * (by - ay)) / (length * length);
    return t >= -eps / length && t <= 1 + eps / length;
  };
  const crosses = (i: number, j: number): boolean => {
    const a1 = ea[i], a2 = eb[i], b1 = ea[j], b2 = eb[j];
    let shared = -1, oa = -1, ob = -1;
    if (a1 === b1) { shared = a1; oa = a2; ob = b2; } else if (a1 === b2) { shared = a1; oa = a2; ob = b1; }
    else if (a2 === b1) { shared = a2; oa = a1; ob = b2; } else if (a2 === b2) { shared = a2; oa = a1; ob = b1; }
    if (shared >= 0) {
      const ux = px[oa] - px[shared], uy = py[oa] - py[shared], vx = px[ob] - px[shared], vy = py[ob] - py[shared];
      // Edges leaving one node in the same direction overlap along their common length.
      return Math.abs(ux * vy - uy * vx) / Math.hypot(ux, uy) <= eps && ux * vx + uy * vy > 0;
    }
    const d1 = signed(px[b1], py[b1], px[b2], py[b2], px[a1], py[a1]), d2 = signed(px[b1], py[b1], px[b2], py[b2], px[a2], py[a2]);
    const d3 = signed(px[a1], py[a1], px[a2], py[a2], px[b1], py[b1]), d4 = signed(px[a1], py[a1], px[a2], py[a2], px[b2], py[b2]);
    const z1 = Math.abs(d1) <= eps, z2 = Math.abs(d2) <= eps, z3 = Math.abs(d3) <= eps, z4 = Math.abs(d4) <= eps;
    if (z1 || z2 || z3 || z4)
      return (z1 && onSegment(px[b1], py[b1], px[b2], py[b2], px[a1], py[a1])) || (z2 && onSegment(px[b1], py[b1], px[b2], py[b2], px[a2], py[a2])) ||
        (z3 && onSegment(px[a1], py[a1], px[a2], py[a2], px[b1], py[b1])) || (z4 && onSegment(px[a1], py[a1], px[a2], py[a2], px[b2], py[b2]));
    return (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0);
  };
  // Zero-length edges (coincident nodes) cannot be embedded.
  const degenerateEdge = new Uint8Array(edgeCount);
  for (let i = 0; i < edgeCount; i++)
    if (Math.hypot(px[ea[i]] - px[eb[i]], py[ea[i]] - py[eb[i]]) <= eps) { conflict[i] = 1; degenerateEdge[i] = 1; }
  // A pair of edges that are both already known to conflict tells us nothing new, so dense fabrics,
  // where nearly every edge crosses something, cost little more than one pass over their pairs.
  for (const [key, list] of cells) {
    const r = Math.floor(key / gridW), c = key - r * gridW;
    for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
      const i = list[x], j = list[y];
      if (conflict[i] && conflict[j]) { spend(.02); continue; }
      const [cc, rr] = cellOf(Math.max(boxes[4 * i], boxes[4 * j]), Math.max(boxes[4 * i + 1], boxes[4 * j + 1]));
      if (cc !== c || rr !== r) continue;
      spend(1);
      if (boxes[4 * i] > boxes[4 * j + 2] || boxes[4 * j] > boxes[4 * i + 2] || boxes[4 * i + 1] > boxes[4 * j + 3] || boxes[4 * j + 1] > boxes[4 * i + 3]) continue;
      if (degenerateEdge[i] || degenerateEdge[j]) continue;
      if (crosses(i, j)) { conflict[i] = 1; conflict[j] = 1; }
    }
  }
  const crossingEdges = view.edges.filter((_, i) => conflict[i]).map((edge) => edge.id).sort();

  // Planar subgraph, pruned of dangling chains.
  const alive = new Uint8Array(edgeCount), degree = new Int32Array(nodeCount);
  const incident: number[][] = Array.from({ length: nodeCount }, () => []);
  for (let i = 0; i < edgeCount; i++) if (!conflict[i]) { alive[i] = 1; degree[ea[i]]++; degree[eb[i]]++; incident[ea[i]].push(i); incident[eb[i]].push(i); }
  const queue: number[] = [];
  for (let i = 0; i < nodeCount; i++) if (degree[i] === 1) queue.push(i);
  let pruned = 0;
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head];
    if (degree[u] !== 1) continue;
    const e = incident[u].find((edge) => alive[edge])!;
    alive[e] = 0; pruned++;
    const v = ea[e] === u ? eb[e] : ea[e];
    degree[u]--; degree[v]--;
    if (degree[v] === 1) queue.push(v);
  }
  // Rotation system: outgoing half-edges 2e (a → b) and 2e + 1 (b → a), ascending by angle at their origin.
  const rotation: number[][] = Array.from({ length: nodeCount }, () => []);
  const angle = new Float64Array(edgeCount * 2), slot = new Int32Array(edgeCount * 2);
  for (let e = 0; e < edgeCount; e++) {
    if (!alive[e]) continue;
    angle[2 * e] = Math.atan2(py[eb[e]] - py[ea[e]], px[eb[e]] - px[ea[e]]);
    angle[2 * e + 1] = Math.atan2(py[ea[e]] - py[eb[e]], px[ea[e]] - px[eb[e]]);
    rotation[ea[e]].push(2 * e); rotation[eb[e]].push(2 * e + 1);
  }
  for (const list of rotation) { list.sort((x, y) => angle[x] - angle[y] || x - y); list.forEach((half, i) => { slot[half] = i; }); }
  const origin = (half: number) => (half & 1) === 0 ? ea[half >> 1] : eb[half >> 1];
  const target = (half: number) => (half & 1) === 0 ? eb[half >> 1] : ea[half >> 1];
  const seen = new Uint8Array(edgeCount * 2);
  const walks: { nodes: number[]; halves: number[]; area: number }[] = [];
  for (let start = 0; start < edgeCount * 2; start++) {
    if (!alive[start >> 1] || seen[start]) continue;
    const nodes: number[] = [], halves: number[] = [];
    let half = start, area = 0;
    do {
      seen[half] = 1; halves.push(half); nodes.push(origin(half));
      const u = origin(half), v = target(half);
      area += px[u] * py[v] - px[v] * py[u];
      const around = rotation[v], back = half ^ 1;
      half = around[(slot[back] - 1 + around.length) % around.length];
      spend(1);
    } while (half !== start);
    walks.push({ nodes, halves, area: area / 2 });
  }

  // Points that a valid face must not contain: crossing-edge midpoints and planar nodes off its boundary.
  const points: { x: number; y: number; node: number }[] = [];
  for (let e = 0; e < edgeCount; e++) if (conflict[e] && !degenerateEdge[e])
    points.push({ x: (px[ea[e]] + px[eb[e]]) / 2, y: (py[ea[e]] + py[eb[e]]) / 2, node: -1 });
  for (let i = 0; i < nodeCount; i++) if (degree[i] > 0) points.push({ x: px[i], y: py[i], node: i });
  const pointCells = new Map<number, number[]>();
  points.forEach((point, i) => {
    const [c, r] = cellOf(point.x, point.y), key = r * gridW + c, list = pointCells.get(key);
    if (list) list.push(i); else pointCells.set(key, [i]);
  });
  const contains = (nodes: readonly number[], x: number, y: number): boolean => {
    let inside = false;
    for (let i = 0, j = nodes.length - 1; i < nodes.length; j = i++) {
      const xi = px[nodes[i]], yi = py[nodes[i]], xj = px[nodes[j]], yj = py[nodes[j]];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const rejected = { pinched: 0, crossed: 0, island: 0, degenerate: 0 };
  const valid: { nodes: number[]; halves: number[]; area: number }[] = [];
  for (const walk of walks) {
    if (walk.area < -eps * eps) continue; // a component's outer boundary
    if (walk.nodes.length < 3 || walk.area <= eps * extent) { rejected.degenerate++; continue; }
    if (new Set(walk.nodes).size !== walk.nodes.length) { rejected.pinched++; continue; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const node of walk.nodes) { x0 = Math.min(x0, px[node]); y0 = Math.min(y0, py[node]); x1 = Math.max(x1, px[node]); y1 = Math.max(y1, py[node]); }
    const [c0, r0] = cellOf(x0, y0), [c1, r1] = cellOf(x1, y1);
    spend((c1 - c0 + 1) * (r1 - r0 + 1));
    const onBoundary = new Set(walk.nodes);
    let crossed = false, island = false;
    for (let r = r0; r <= r1 && !crossed; r++) for (let c = c0; c <= c1 && !crossed; c++) {
      const list = pointCells.get(r * gridW + c);
      if (!list) continue;
      for (const id of list) {
        const point = points[id];
        if (point.node >= 0 && onBoundary.has(point.node)) continue;
        if (point.x < x0 || point.x > x1 || point.y < y0 || point.y > y1) continue;
        spend(walk.nodes.length);
        if (!contains(walk.nodes, point.x, point.y)) continue;
        if (point.node < 0) { crossed = true; break; }
        island = true;
      }
    }
    if (crossed) rejected.crossed++; else if (island) rejected.island++; else valid.push(walk);
  }
  let largest = 0, smallest = Infinity;
  for (const walk of valid) { largest = Math.max(largest, walk.area); smallest = Math.min(smallest, walk.area); }
  const span = Math.log(largest / smallest);
  const faces = valid.map((walk): GraphFace => {
    let first = 0;
    for (let i = 1; i < walk.nodes.length; i++) if (view.nodes[walk.nodes[i]].id < view.nodes[walk.nodes[first]].id) first = i;
    const rotate = <T>(items: readonly T[]): T[] => [...items.slice(first), ...items.slice(0, first)];
    const nodes = rotate(walk.nodes), halves = rotate(walk.halves);
    const ids = nodes.map((node) => view.nodes[node].id), id = `face:${ids.join(">")}`;
    return Object.freeze({ id, seed: componentSeed(view.graph.seed, id, "face"), closed: true, level: nodes.length,
      levelFraction: span > 0 ? Math.log(walk.area / smallest) / span : 0, area: walk.area, nodes: Object.freeze(ids),
      edges: Object.freeze(halves.map((half) => view.edges[half >> 1].id)),
      points: Object.freeze(nodes.map((node) => view.nodes[node].position)) });
  });
  return Object.freeze({ faces: Object.freeze(faces), crossingEdges: Object.freeze(crossingEdges), prunedEdges: pruned,
    rejected: Object.freeze(rejected) });
}
