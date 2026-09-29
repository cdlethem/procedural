import { componentSeed } from "./core.js";
import { categoricalColumn, continuousColumn } from "./data-table.js";
import type { DataTable } from "./data-table.js";
import { MAX_EDGE_MARKERS, graphFromParts, selectGraph } from "./graph.js";
import type { Graph, GraphRoleOptions, GraphView } from "./graph.js";
import { memoized } from "./sources.js";
import type { Path, Point, Site } from "./types.js";

/**
 * Edge bundling on the existing `Graph` value: endpoints laid out by an explicit rule, edges routed
 * into readable families, paths that keep their edge ids. Nothing here is a new graph type.
 *
 * Pipeline
 *   tables → `relationsFromTables` → Graph + group assignment
 *   → `layoutEndpoints` (circle by category, line by category, or the graph's own positions)
 *   → `selectRelations` (the existing role selection plus scope and stable retention)
 *   → `bundleEdges` (paths, bundles)
 *
 * Algorithm: family bundling by hierarchical waypoints (force-free, deterministic)
 * - A *group* is a category of the node table. A *family* is the set of edges that join the same two
 *   groups (`families: "pair"`, unordered) or the same ordered pair (`"directed"`, so a → b and b → a
 *   are separate bundles). Only edges of one family share waypoints; edges of unrelated families
 *   share none, so unrelated edges cannot bundle. An edge's route depends only on its own endpoints,
 *   its family and the layout, never on which other edges exist, their order or the selection.
 * - Each group has a *hub*: its anchor (sector middle on a ring or line, centroid on a graph layout)
 *   pulled toward the interior by `inset` (0 stays at the anchor; 1 reaches the ring's centre, the
 *   line layout's full height, or the layout's centroid). Around its hub every group offers one
 *   *port* per other group (two, out and in, for directed families), ordered by the direction of the
 *   partner so neighbouring bundles never cross at the hub. `separation` spreads the ports across the
 *   group's extent (0 stacks them on the hub). Ports depend on the layout, not on the edges.
 * - A family's *trunk* is the midpoint of its two ports moved toward the interior by `lift` times half
 *   the port-to-port distance (0 is the chord midpoint; 1 bulges as far as half the chord).
 * - The control polygon is `[from, port, trunk, port, to]` (`[from, hub, to]` inside one group).
 *   Holten's straightening blends it with the chord by `strength`
 *   (`P′ᵢ = β·Pᵢ + (1−β)·(P₀ + i/(n−1)·(Pₙ₋₁−P₀))`), and a clamped uniform cubic B-spline with
 *   `detail` samples per span is drawn through the result. Strength 0 is exactly the two endpoints.
 *   Both end points are always the endpoint nodes' positions, exactly.
 * - Cost: O(G² log G) for ports, O(E·(detail)) for paths, memory O(E·detail). No iteration and no
 *   randomness: identical input gives identical output on any platform with IEEE doubles.
 *
 * Identity. Path ids and seeds are the edge's own (`edge.id`, `edge.seed`), so filtering, reordering
 * and appearance edits never rename or move a path. Group bands are `band:<group name>`, direction
 * markers `<edge id>/arrow`; every seed is `componentSeed(graph seed, id, purpose)`.
 *
 * Limits (each names the option that controls it): at most `MAX_BUNDLED_EDGES` edges and
 * `MAX_BUNDLE_VERTICES` routed vertices per call. Nothing is silently truncated.
 */
export const MAX_BUNDLED_EDGES = 5_000;
export const MAX_BUNDLE_VERTICES = 400_000;
export const MAX_BUNDLE_DETAIL = 32;
const U32 = 0x1_0000_0000;
const DEGREE = Math.PI / 180;

/* --------------------------------------------------------------- relations */

/** Columns of the two tables that make a graph. `x`/`y` are optional map positions. */
export interface RelationColumns {
  /** Node table: categorical column naming each node's group. */
  readonly group: string;
  /** Node table: continuous position columns (any unit; a `graph` layout may fit them). */
  readonly x?: string;
  readonly y?: string;
  /** Edge table: categorical columns whose categories are node ids, and a positive continuous measure. */
  readonly from: string;
  readonly to: string;
  readonly flow: string;
}
/** Group of every node: `groupOf[i]` is the class index (into `names`) of `graph.nodes[i]`. */
export interface GroupAssignment {
  readonly column: string;
  readonly names: readonly string[];
  readonly groupOf: readonly number[];
}
export interface RelationData {
  readonly graph: Graph;
  readonly groups: GroupAssignment;
  /** Raw measure of each edge, aligned with `graph.edges`; edge weight is `flow / maxFlow`. */
  readonly flows: readonly number[];
  readonly maxFlow: number;
  readonly unit: string;
}

const relationsCache = new Map<string, RelationData>();

/**
 * Nodes are the rows of `nodes` (ids are its row ids), edges the rows of `edges` (ids are its row
 * ids). Errors name the table, column and row. Edge weight is the row's flow as a fraction of the
 * largest flow, so weights lie in (0, 1]. A graph is simple: two rows may not join the same pair
 * of nodes (record net flow), and no row may join a node to itself.
 */
export function relationsFromTables(nodes: DataTable, edges: DataTable, columns: RelationColumns, options: { seed: number; directed: boolean }): RelationData {
  const key = JSON.stringify([nodes.key, edges.key, columns, options.seed, options.directed]);
  return memoized(relationsCache, key, () => {
    const label = `Relationship tables "${nodes.id}" and "${edges.id}"`;
    const groupColumn = categoricalColumn(nodes, columns.group);
    const nodeIndex = new Map(nodes.rowIds.map((id, index) => [id, index] as const));
    const groupOf = nodes.rowIds.map((id, row) => {
      const value = groupColumn.values[row];
      if (value === null) throw new Error(`${label}: node "${id}" has no ${columns.group}`);
      return groupColumn.categories.indexOf(value);
    });
    const position = (name: string | undefined): readonly (number | null)[] => name === undefined ? nodes.rowIds.map(() => 0) : continuousColumn(nodes, name).values;
    const xs = position(columns.x), ys = position(columns.y);
    const from = categoricalColumn(edges, columns.from), to = categoricalColumn(edges, columns.to), flow = continuousColumn(edges, columns.flow);
    let maxFlow = 0;
    const flows = edges.rowIds.map((id, row) => {
      const value = flow.values[row];
      if (value === null || !(value > 0)) throw new Error(`${label}: edge "${id}" needs a positive ${columns.flow}`);
      maxFlow = Math.max(maxFlow, value);
      return value;
    });
    const parts = {
      seed: options.seed, directed: options.directed,
      nodes: nodes.rowIds.map((id, row) => {
        const x = xs[row], y = ys[row];
        if (x === null || y === null) throw new Error(`${label}: node "${id}" has no position`);
        return { id, position: [x, y] as const };
      }),
      edges: edges.rowIds.map((id, row) => {
        const a = from.values[row], b = to.values[row];
        if (a === null || b === null) throw new Error(`${label}: edge "${id}" needs ${columns.from} and ${columns.to}`);
        if (!nodeIndex.has(a) || !nodeIndex.has(b)) throw new Error(`${label}: edge "${id}" names a node that is not a row of "${nodes.id}"`);
        return { id, from: a, to: b, weight: flows[row] / maxFlow, age: 1 };
      }),
    };
    return Object.freeze({ graph: graphFromParts(parts),
      groups: Object.freeze({ column: columns.group, names: groupColumn.categories, groupOf: Object.freeze(groupOf) }),
      flows: Object.freeze(flows), maxFlow, unit: flow.unit });
  });
}

/* ------------------------------------------------------------------ layout */

export type EndpointOrder = "table" | "flow" | "partners" | "shuffled";
export type SectorBasis = "count" | "flow";
/** Footprint of a layout: canvas units; `rotation` in degrees about the center. */
export interface LayoutFrame { readonly centerX: number; readonly centerY: number; readonly width: number; readonly height: number; readonly rotation: number }
export type EndpointLayoutOptions =
  | { readonly kind: "circle"; readonly frame: LayoutFrame; readonly startAngle: number; readonly gap: number; readonly sectorBy: SectorBasis; readonly order: EndpointOrder }
  | { readonly kind: "line"; readonly frame: LayoutFrame; readonly gap: number; readonly sectorBy: SectorBasis; readonly order: EndpointOrder }
  | { readonly kind: "graph"; readonly frame: LayoutFrame; readonly fit: boolean };

export interface GroupPlacement {
  readonly index: number;
  readonly name: string;
  /** Node ids in placement order (along the ring or line). */
  readonly nodes: readonly string[];
  readonly anchor: Point;
  /** Length along which the group's ports may spread: arc or line length, or the diameter of a graph group. */
  readonly extent: number;
  /** Ring: start and end angle in radians (clockwise on screen from +x); line: start and end x before rotation; graph: `[0, 0]`. */
  readonly span: readonly [number, number];
}
export interface EndpointLayout {
  readonly kind: EndpointLayoutOptions["kind"];
  readonly options: EndpointLayoutOptions;
  /** The input graph with node positions replaced by the layout; ids, seeds, edges and weights are untouched. */
  readonly graph: Graph;
  readonly groups: GroupAssignment;
  /** Non-empty groups in declared order. */
  readonly placements: readonly GroupPlacement[];
  /** Interior reference: the ring's center, the graph's centroid, the line's center. */
  readonly center: Point;
  /** Line layouts: the unit direction arcs rise in; otherwise `null` (the interior is toward `center`). */
  readonly up: Point | null;
  /** Line layouts: the height arcs may rise to (the frame height). */
  readonly depth: number;
}

function requireFrame(frame: LayoutFrame): void {
  for (const [label, value] of [["width", frame.width], ["height", frame.height]] as const)
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Layout ${label} must be positive and finite`);
  for (const [label, value] of [["centerX", frame.centerX], ["centerY", frame.centerY], ["rotation", frame.rotation]] as const)
    if (!Number.isFinite(value)) throw new Error(`Layout ${label} must be finite`);
}
function turn(point: Point, frame: LayoutFrame): Point {
  if (frame.rotation === 0) return point;
  const angle = frame.rotation * DEGREE, c = Math.cos(angle), s = Math.sin(angle);
  const dx = point[0] - frame.centerX, dy = point[1] - frame.centerY;
  return [frame.centerX + dx * c - dy * s, frame.centerY + dx * s + dy * c];
}
const normalize = (dx: number, dy: number): Point | null => {
  const length = Math.hypot(dx, dy);
  return length > 1e-9 ? [dx / length, dy / length] : null;
};
/** Point of the ring at `theta`, `extra` canvas units outside it. */
function ringPoint(frame: LayoutFrame, theta: number, extra = 0): Point {
  return turn([frame.centerX + (frame.width / 2 + extra) * Math.cos(theta), frame.centerY + (frame.height / 2 + extra) * Math.sin(theta)], frame);
}

/** Mean signed direction (angle or x fraction) from each node's group to its partners' groups, weighted by edge weight; 0 without partners. */
function partnerKeys(graph: Graph, groups: GroupAssignment, anchorAt: readonly number[], slotOf: ReadonlyMap<number, number>, signed: (delta: number) => number): Float64Array {
  const pull = new Float64Array(graph.nodes.length), mass = new Float64Array(graph.nodes.length);
  const nodeIndex = new Map(graph.nodes.map((node, i) => [node.id, i] as const));
  for (const edge of graph.edges) {
    const a = nodeIndex.get(edge.from)!, b = nodeIndex.get(edge.to)!;
    for (const [own, other] of [[a, b], [b, a]] as const) {
      pull[own] += edge.weight * signed(anchorAt[slotOf.get(groups.groupOf[other])!] - anchorAt[slotOf.get(groups.groupOf[own])!]);
      mass[own] += edge.weight;
    }
  }
  return pull.map((value, n) => mass[n] > 0 ? value / mass[n] : 0);
}

/**
 * Place every node by an explicit rule and return the positioned graph with its group placements.
 * - `circle`: groups take sectors of the ring in declared category order, sized by node count or
 *   by total flow, separated by `gap` (the fraction of the turn left as gaps). Inside a sector
 *   nodes take equal slots in `order`: table order, largest flow first, a seeded shuffle, or
 *   `partners` (by where their partners sit, which removes most crossings).
 * - `line`: the same along the frame's bottom edge; arcs rise by up to the frame height.
 * - `graph`: keep the graph's own positions (any producer's graph: lattice, contact, branches).
 *   With `fit` the bounding box is stretched to the frame; without it positions are unchanged.
 * Empty groups take no place. The layout depends on the graph and options only, never on later
 * edge selection.
 */
export function layoutEndpoints(source: { readonly graph: Graph; readonly groups: GroupAssignment }, options: EndpointLayoutOptions): EndpointLayout {
  const { graph, groups } = source;
  requireFrame(options.frame);
  if (groups.groupOf.length !== graph.nodes.length) throw new Error("Group assignment must cover every node of the graph");
  const frame = options.frame;
  const members = groups.names.map((): number[] => []);
  groups.groupOf.forEach((group, index) => members[group].push(index));
  const present = members.map((list, index) => ({ list, index })).filter((item) => item.list.length > 0);
  if (present.length === 0) throw new Error("Layout needs at least one node");
  const positions: Point[] = graph.nodes.map((node) => node.position);
  const placements: GroupPlacement[] = [];
  let center: Point = [frame.centerX, frame.centerY], up: Point | null = null, depth = 0;

  if (options.kind === "graph") {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of positions) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const fit = (value: number, low: number, high: number, middle: number, size: number) => high > low ? middle + ((value - low) / (high - low) - .5) * size : middle;
    graph.nodes.forEach((node, index) => {
      const p = options.fit ? [fit(node.position[0], minX, maxX, frame.centerX, frame.width), fit(node.position[1], minY, maxY, frame.centerY, frame.height)] as const : node.position;
      positions[index] = turn(p, frame);
    });
    let sx = 0, sy = 0;
    for (const [x, y] of positions) { sx += x; sy += y; }
    center = [sx / positions.length, sy / positions.length];
    for (const { list, index } of present) {
      let ax = 0, ay = 0;
      for (const n of list) { ax += positions[n][0]; ay += positions[n][1]; }
      const anchor: Point = [ax / list.length, ay / list.length];
      let extent = 0;
      for (const n of list) extent = Math.max(extent, 2 * Math.hypot(positions[n][0] - anchor[0], positions[n][1] - anchor[1]));
      placements.push({ index, name: groups.names[index], nodes: list.map((n) => graph.nodes[n].id), anchor, extent, span: [0, 0] });
    }
  } else {
    if (!Number.isFinite(options.gap) || options.gap < 0 || options.gap > .9) throw new Error("Layout gap must be in [0, 0.9]");
    const meanWeight = graph.nodes.reduce((sum, node) => sum + node.weight, 0) / graph.nodes.length;
    const floor = meanWeight > 0 ? meanWeight * .25 : 1;
    const size = (list: readonly number[]) => options.sectorBy === "count" ? list.length : list.reduce((sum, n) => sum + graph.nodes[n].weight + floor, 0);
    const sizes = present.map((item) => size(item.list));
    const total = sizes.reduce((sum, value) => sum + value, 0);
    const circle = options.kind === "circle";
    const room = circle ? 2 * Math.PI : frame.width;
    const gapSize = options.gap * room / present.length, usable = room - gapSize * present.length;
    const start = circle ? options.startAngle * DEGREE : frame.centerX - frame.width / 2;
    const baseline = frame.centerY + frame.height / 2;
    const point = (t: number): Point => circle ? ringPoint(frame, t) : turn([t, baseline], frame);
    const spans: [number, number][] = [];
    let cursor = start + gapSize / 2;
    present.forEach((_, k) => { const span = usable * sizes[k] / total; spans.push([cursor, cursor + span]); cursor += span + gapSize; });
    // Where each group sits in its own coordinate (angle or x) tells `partners` which way a node's partners lie.
    const anchorAt = spans.map(([a, b]) => (a + b) / 2);
    const slotOf = new Map(present.map((item, k) => [item.index, k] as const));
    const signed = (delta: number) => circle ? Math.atan2(Math.sin(delta), Math.cos(delta)) : delta / frame.width;
    let partnerKey: Float64Array | undefined;
    present.forEach(({ list, index }, k) => {
      let ordered = list;
      if (options.order === "flow") ordered = [...list].sort((a, b) => graph.nodes[b].weight - graph.nodes[a].weight || a - b);
      else if (options.order === "shuffled") {
        const draw = (n: number) => componentSeed(graph.seed, graph.nodes[n].id, "order");
        ordered = [...list].sort((a, b) => draw(a) - draw(b) || a - b);
      } else if (options.order === "partners") {
        partnerKey ??= partnerKeys(graph, groups, anchorAt, slotOf, signed);
        const key = partnerKey;
        ordered = [...list].sort((a, b) => key[a] - key[b] || a - b);
      }
      const [a0, a1] = spans[k];
      ordered.forEach((n, slot) => { positions[n] = point(a0 + (slot + .5) / ordered.length * (a1 - a0)); });
      const anchor = point((a0 + a1) / 2);
      const extent = circle ? (a1 - a0) * (frame.width + frame.height) / 4 : a1 - a0;
      placements.push({ index, name: groups.names[index], nodes: ordered.map((n) => graph.nodes[n].id), anchor, extent, span: [a0, a1] });
    });
    if (!circle) {
      up = turn([frame.centerX, frame.centerY - 1], frame);
      up = [up[0] - center[0], up[1] - center[1]];
      depth = frame.height;
    }
  }
  const positioned = graphFromParts({ seed: graph.seed, directed: graph.directed,
    nodes: graph.nodes.map((node, index) => ({ id: node.id, position: positions[index] })),
    edges: graph.edges.map((edge) => ({ id: edge.id, from: edge.from, to: edge.to, weight: edge.weight, age: edge.age })) });
  return Object.freeze({ kind: options.kind, options, graph: positioned, groups, placements: Object.freeze(placements.map((item) => Object.freeze({
    ...item, nodes: Object.freeze(item.nodes), span: Object.freeze([...item.span] as [number, number]), anchor: Object.freeze([...item.anchor] as unknown as Point) }))),
    center: Object.freeze([...center] as unknown as Point), up: up && Object.freeze([...up] as unknown as Point), depth });
}

/* --------------------------------------------------------------- selection */

export type EdgeScope = "all" | "between" | "within";

/**
 * The existing role selection (`selectGraph`, with every node kept: the endpoint layout is part of the
 * drawing) narrowed by scope (all edges, only those joining two groups, only those inside a group) and
 * by stable retention: an edge is kept when its own `componentSeed` draw is below `retention`, so
 * raising retention only adds edges and no edge changes its route. Weight and age fractions are of the
 * whole graph's maxima.
 */
export function selectRelations(layout: EndpointLayout, roles: GraphRoleOptions, options: { scope: EdgeScope; retention: number }): GraphView {
  if (!Number.isFinite(options.retention) || options.retention < 0 || options.retention > 1) throw new Error("retention must be in [0, 1]");
  const base = selectGraph(layout.graph, { ...roles, isolated: true });
  const groupAt = new Map(layout.graph.nodes.map((node, index) => [node.id, layout.groups.groupOf[index]] as const));
  const edges = base.edges.filter((edge) => {
    const same = groupAt.get(edge.from) === groupAt.get(edge.to);
    if (options.scope === "between" && same || options.scope === "within" && !same) return false;
    return options.retention >= 1 || componentSeed(edge.seed, edge.id, "keep") / U32 < options.retention;
  });
  return Object.freeze({ graph: layout.graph, nodes: base.nodes, edges: Object.freeze(edges) });
}

/* ---------------------------------------------------------------- bundling */

export type BundleFamilies = "pair" | "directed";
export interface BundleOptions {
  /** Straightening β in [0, 1]: 0 is the unbundled straight edge, 1 follows the control polygon. */
  readonly strength: number;
  /** Hub distance toward the interior in [0, 1]. */
  readonly inset: number;
  /** Trunk bulge in [0, 1] of half the port-to-port distance. */
  readonly lift: number;
  /** Port spread in [0, 1] of each group's extent. */
  readonly separation: number;
  /** Samples per B-spline span, an integer in [1, MAX_BUNDLE_DETAIL]. */
  readonly detail: number;
  /** Which edges share a bundle; `"directed"` needs a directed graph. */
  readonly families: BundleFamilies;
}
export interface BundledPath extends Path {
  /** The source edge id (equal to `id`). */
  readonly edge: string;
  readonly from: string;
  readonly to: string;
  /** Class index of each end's group. */
  readonly fromGroup: number;
  readonly toGroup: number;
  /** `"<a>-<b>"` (ascending group indices) or `"<from>><to>"` for directed families. */
  readonly family: string;
  /** The edge's weight as a fraction of the graph's largest, in (0, 1]. */
  readonly weight: number;
  /** Polyline length in canvas units. */
  readonly length: number;
}
export interface EdgeBundle {
  readonly id: string;
  readonly from: number;
  readonly to: number;
  /** Member edge ids in view order. */
  readonly edges: readonly string[];
  /** Shared waypoints in from → to order (ascending group index for pair families): port, trunk, port; one hub inside a group. */
  readonly waypoints: readonly Point[];
}
export interface BundledEdges {
  readonly layout: EndpointLayout;
  readonly view: GraphView;
  readonly options: BundleOptions;
  readonly paths: readonly BundledPath[];
  readonly bundles: readonly EdgeBundle[];
}

function checkBundleOptions(options: BundleOptions, layout: EndpointLayout): void {
  for (const [label, value] of [["strength", options.strength], ["inset", options.inset], ["lift", options.lift], ["separation", options.separation]] as const)
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be finite and in [0, 1]`);
  if (!Number.isInteger(options.detail) || options.detail < 1 || options.detail > MAX_BUNDLE_DETAIL) throw new Error(`detail must be an integer in [1, ${MAX_BUNDLE_DETAIL}]`);
  if (options.families !== "pair" && options.families !== "directed") throw new Error(`families must be "pair" or "directed"`);
  if (options.families === "directed" && !layout.graph.directed) throw new Error(`families "directed" needs a directed graph`);
}

/** Clamped uniform cubic B-spline through Holten-straightened controls; both ends are exactly the end controls. */
function spline(controls: readonly Point[], strength: number, detail: number): Point[] {
  const n = controls.length, a = controls[0], b = controls[n - 1];
  const straightened = controls.map((p, i): Point => {
    const t = i / (n - 1);
    return [strength * p[0] + (1 - strength) * (a[0] + t * (b[0] - a[0])), strength * p[1] + (1 - strength) * (a[1] + t * (b[1] - a[1]))];
  });
  const padded = [straightened[0], straightened[0], ...straightened, straightened[n - 1], straightened[n - 1]];
  const points: Point[] = [];
  for (let span = 0; span < padded.length - 3; span++) {
    const [p0, p1, p2, p3] = [padded[span], padded[span + 1], padded[span + 2], padded[span + 3]];
    for (let j = span === 0 ? 0 : 1; j <= detail; j++) {
      const t = j / detail, u = 1 - t;
      const w0 = u * u * u, w1 = 3 * t * t * t - 6 * t * t + 4, w2 = -3 * t * t * t + 3 * t * t + 3 * t + 1, w3 = t * t * t;
      points.push([(w0 * p0[0] + w1 * p1[0] + w2 * p2[0] + w3 * p3[0]) / 6, (w0 * p0[1] + w1 * p1[1] + w2 * p2[1] + w3 * p3[1]) / 6]);
    }
  }
  points[0] = a; points[points.length - 1] = b;
  return points;
}

/**
 * Route every edge of `view` (selected from `layout.graph`) as a bundled path. See the module notes for
 * the algorithm. Throws naming `minWeight`/`retention` when more than `MAX_BUNDLED_EDGES` edges are
 * selected and `detail` when the routed vertices would exceed `MAX_BUNDLE_VERTICES`.
 */
export function bundleEdges(layout: EndpointLayout, view: GraphView, options: BundleOptions): BundledEdges {
  if (view.graph !== layout.graph) throw new Error("The view must be selected from the layout's graph (selectRelations(layout, …))");
  checkBundleOptions(options, layout);
  const edges = view.edges;
  if (edges.length > MAX_BUNDLED_EDGES) throw new Error(`Bundling ${edges.length} edges; the limit is ${MAX_BUNDLED_EDGES} (raise minWeight or lower retention to select fewer)`);
  const graph = layout.graph;
  const nodeIndex = new Map(graph.nodes.map((node, i) => [node.id, i] as const));
  const groupOf = (id: string) => layout.groups.groupOf[nodeIndex.get(id)!];
  const straight = options.strength === 0;
  let vertices = 0;
  for (const edge of edges) vertices += straight ? 2 : ((groupOf(edge.from) === groupOf(edge.to) ? 3 : 5) + 1) * options.detail + 1;
  if (vertices > MAX_BUNDLE_VERTICES) throw new Error(`Bundling would build ${vertices} vertices; the limit is ${MAX_BUNDLE_VERTICES} (lower detail or select fewer edges)`);

  const center = layout.center, up = layout.up;
  const inwardAt = (p: Point): Point => up ?? normalize(center[0] - p[0], center[1] - p[1]) ?? [0, -1];
  const hubs = new Map<number, { hub: Point; inner: Point; t: Point; ports: Map<string, Point> }>();
  const directed = options.families === "directed";
  for (const group of layout.placements) {
    const u = inwardAt(group.anchor);
    const target: Point = up ? [group.anchor[0] + up[0] * layout.depth, group.anchor[1] + up[1] * layout.depth] : center;
    const hub: Point = [group.anchor[0] + (target[0] - group.anchor[0]) * options.inset, group.anchor[1] + (target[1] - group.anchor[1]) * options.inset];
    const t: Point = [-u[1], u[0]];
    const partners = layout.placements.filter((other) => other.index !== group.index).map((other) => {
      const vx = other.anchor[0] - group.anchor[0], vy = other.anchor[1] - group.anchor[1];
      return { index: other.index, angle: Math.atan2(u[0] * vy - u[1] * vx, u[0] * vx + u[1] * vy) };
    }).sort((a, b) => a.angle - b.angle || a.index - b.index);
    const slots = partners.flatMap((partner) => directed ? [`${partner.index}:out`, `${partner.index}:in`] : [`${partner.index}`]);
    const ports = new Map<string, Point>();
    slots.forEach((slot, i) => {
      const offset = slots.length === 1 ? 0 : (2 * i / (slots.length - 1) - 1) * options.separation * group.extent / 2;
      ports.set(slot, [hub[0] + t[0] * offset, hub[1] + t[1] * offset]);
    });
    // A bundle inside one group turns back halfway to the hub, so groups read as petals rather than deep loops.
    const inner: Point = [group.anchor[0] + (hub[0] - group.anchor[0]) / 2, group.anchor[1] + (hub[1] - group.anchor[1]) / 2];
    hubs.set(group.index, { hub, inner, t, ports });
  }

  const trunkOf = (a: Point, b: Point, lowGroup: number): Point => {
    const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], half = Math.hypot(a[0] - b[0], a[1] - b[1]) / 2;
    const toward = up ?? normalize(center[0] - mid[0], center[1] - mid[1]) ?? hubs.get(lowGroup)!.t;
    return [mid[0] + toward[0] * options.lift * half, mid[1] + toward[1] * options.lift * half];
  };
  const families = new Map<string, { from: number; to: number; waypoints: Point[]; edges: string[] }>();
  const family = (gf: number, gt: number) => {
    const key = gf === gt ? `${gf}-${gt}` : directed ? `${gf}>${gt}` : `${Math.min(gf, gt)}-${Math.max(gf, gt)}`;
    let found = families.get(key);
    if (!found) {
      let waypoints: Point[];
      if (gf === gt) waypoints = [hubs.get(gf)!.inner];
      else {
        const lo = directed ? gf : Math.min(gf, gt), hi = directed ? gt : Math.max(gf, gt);
        const a = hubs.get(lo)!.ports.get(directed ? `${hi}:out` : `${hi}`)!, b = hubs.get(hi)!.ports.get(directed ? `${lo}:in` : `${lo}`)!;
        waypoints = [a, trunkOf(a, b, Math.min(gf, gt)), b];
      }
      found = { from: directed ? gf : Math.min(gf, gt), to: directed ? gt : Math.max(gf, gt), waypoints, edges: [] };
      families.set(key, found);
    }
    return { key, found };
  };

  const at = (id: string): Point => graph.nodes[nodeIndex.get(id)!].position;
  const { maxAge } = graph.stats;
  const paths = edges.map((edge): BundledPath => {
    const gf = groupOf(edge.from), gt = groupOf(edge.to);
    const { key, found } = family(gf, gt);
    found.edges.push(edge.id);
    const start = at(edge.from), end = at(edge.to);
    let points: Point[];
    if (straight) points = [start, end];
    else {
      const way = !directed && gf > gt ? [...found.waypoints].reverse() : found.waypoints;
      points = spline([start, ...way, end], options.strength, options.detail);
    }
    let length = 0;
    for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    return Object.freeze({ id: edge.id, seed: edge.seed, points: Object.freeze(points.map((p) => Object.freeze([p[0], p[1]] as const))), closed: false,
      level: edge.age, levelFraction: maxAge > 0 ? 1 - edge.age / maxAge : 0, tone: 1 + gf,
      edge: edge.id, from: edge.from, to: edge.to, fromGroup: gf, toGroup: gt, family: key, weight: graph.stats.maxEdgeWeight > 0 ? edge.weight / graph.stats.maxEdgeWeight : 0, length });
  });
  const bundles = [...families.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([id, item]): EdgeBundle => Object.freeze({
    id, from: item.from, to: item.to, edges: Object.freeze(item.edges), waypoints: Object.freeze(item.waypoints.map((p) => Object.freeze([p[0], p[1]] as const))) }));
  return Object.freeze({ layout, view, options, paths: Object.freeze(paths), bundles: Object.freeze(bundles) });
}

/* -------------------------------------------------------- derived products */

/** One ring arc (or line segment) per non-empty group, `offset` canvas units outside the endpoints. `graph` layouts have none. */
export function groupBands(layout: EndpointLayout, offset: number): readonly Path[] {
  if (!Number.isFinite(offset)) throw new Error("Band offset must be finite");
  const options = layout.options;
  if (options.kind === "graph") return Object.freeze([]);
  const frame = options.frame;
  return Object.freeze(layout.placements.map((group): Path => {
    const [a0, a1] = group.span;
    let points: Point[];
    if (options.kind === "circle") {
      const steps = Math.max(2, Math.ceil((a1 - a0) / (3 * DEGREE)) + 1);
      points = Array.from({ length: steps }, (_, i) => ringPoint(frame, a0 + (a1 - a0) * i / (steps - 1), offset));
    } else {
      const y = frame.centerY + frame.height / 2 + offset;
      points = [turn([a0, y], frame), turn([a1, y], frame)];
    }
    const id = `band:${group.name}`;
    return Object.freeze({ id, seed: componentSeed(layout.graph.seed, id, "band"), points: Object.freeze(points.map((p) => Object.freeze([p[0], p[1]] as const))),
      closed: false, level: 0, levelFraction: 0, tone: 1 + group.index });
  }));
}

/**
 * Direction markers: one site per bundled path at arc-length fraction `at` from its start, turned along
 * the path there. Ids `<edge id>/arrow`. A path shorter than three times `size` gets none; `share` keeps
 * a stable, id-selected fraction (raising it only adds markers) and at most `MAX_EDGE_MARKERS` are placed,
 * by lowering the share to fit. `tone` is the caller's palette-index choice.
 */
export function pathMarkers(bundled: BundledEdges, options: { at: number; size: number; share: number; tone: (path: BundledPath) => number }): readonly Site[] {
  const { at, size, share } = options;
  if (!Number.isFinite(size) || size <= 0 || size > 1000) throw new Error("Marker size must be in (0, 1000]");
  for (const [label, value] of [["at", at], ["share", share]] as const) if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`Marker ${label} must be in [0, 1]`);
  const seed = bundled.layout.graph.seed;
  const eligible = bundled.paths.filter((path) => path.length >= 3 * size).map((path) => {
    const id = `${path.id}/arrow`;
    return { path, id, seed: componentSeed(seed, id, "arrow") };
  });
  const limit = Math.min(share, MAX_EDGE_MARKERS / Math.max(1, eligible.length));
  const sites: Site[] = [];
  for (const { path, id, seed: markerSeed } of eligible) {
    if (limit < 1 && markerSeed / U32 >= limit) continue;
    let remaining = at * path.length, position: Point = path.points[0], angle = 0;
    for (let i = 1; i < path.points.length; i++) {
      const p = path.points[i - 1], q = path.points[i], step = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (step === 0) continue;
      angle = Math.atan2(q[1] - p[1], q[0] - p[0]);
      if (remaining <= step || i === path.points.length - 1) {
        const f = Math.min(1, remaining / step);
        position = [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
        break;
      }
      remaining -= step;
    }
    sites.push(Object.freeze({ id, seed: markerSeed, position: Object.freeze([position[0], position[1]] as const), angle, scale: 1, tone: options.tone(path) }));
  }
  return Object.freeze(sites);
}

export type FamilyHighlight =
  | { readonly kind: "none" }
  | { readonly kind: "group"; readonly group: number }
  | { readonly kind: "pair"; readonly group: number; readonly partner: number }
  | { readonly kind: "heaviest"; readonly share: number };

/**
 * Ids of the highlighted edges: every edge touching a group, every edge between two groups (either
 * direction), or the heaviest `share` of the selected edges (at least one when share > 0; ties by id).
 */
export function highlightedEdges(bundled: BundledEdges, rule: FamilyHighlight): ReadonlySet<string> {
  const paths = bundled.paths;
  if (rule.kind === "none") return new Set();
  if (rule.kind === "group") return new Set(paths.filter((path) => path.fromGroup === rule.group || path.toGroup === rule.group).map((path) => path.id));
  if (rule.kind === "pair") return new Set(paths.filter((path) => path.fromGroup === rule.group && path.toGroup === rule.partner ||
    path.fromGroup === rule.partner && path.toGroup === rule.group).map((path) => path.id));
  if (!Number.isFinite(rule.share) || rule.share < 0 || rule.share > 1) throw new Error("Highlight share must be in [0, 1]");
  const ranked = [...paths].sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return new Set(ranked.slice(0, Math.ceil(rule.share * ranked.length)).map((path) => path.id));
}

