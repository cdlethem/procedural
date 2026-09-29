import { attractorGrowthDefinitions, growthModel, prepareGrowthModel } from "../adapters/attractor-growth.js";
import type { GrowthModel } from "../adapters/attractor-growth.js";
import { componentSeed } from "./core.js";
import { memoized } from "./sources.js";
import type { Path, Point, Site } from "./types.js";

/**
 * Branch trees: the existing attractor growth read as a graph.
 *
 * Producer. `branchTree(options)` runs (or reuses) the attractor growth
 * (`adapters/attractor-growth.ts`, the same cached computation the Attractor Growth study draws)
 * and publishes its lineage as a frozen tree of nodes and edges. `attachmentSites(tree, options)`
 * and `branchOutline(tree, options)` are separate producers over that tree. Consumers are the
 * ordinary `atEach` / `strokeWith` with any mark or path material.
 *
 * Input. `BranchTreeOptions` is the growth construction (attractor footprint, roots, growth
 * ticks, step, reach, branching) plus `routing`. Growth keeps its own validated domains and its
 * own work budget (tips, segments, tip-attractor queries); an over-budget or out-of-domain
 * construction throws the growth's own message. Positions are canvas units; option angles are
 * degrees, published frames are radians (canvas axes: +x right, +y down, so positive turns are
 * clockwise on screen).
 *
 * Topology. The native step gives every tip one segment per tick. A tip that reaches an attractor
 * ends its segment on it and spawns `branches` tips, `step` away from it; otherwise the tip
 * advances by `step`. A node is a place where the structure changes: the base of a root tip
 * (`trunk`), a point where two or more grown branches leave (`fork`), and the end of a branch
 * that grew no further (`terminal`). An edge is the whole run between two nodes, a polyline
 * (bridging the `step` gap that the native step leaves after each consumed attractor, so every
 * edge is one connected path). Roles describe the published tree: a consumed attractor whose
 * siblings never grew is a bend inside an edge, not a fork. `depth` counts forks between the
 * trunk and an edge (trunk edges are 0; both children of a fork are one deeper). A node's
 * `depth` is that of the edge that arrives at it (0 for trunk). A root tip that never grew
 * (every attractor was taken first) is omitted and counted in `barrenRoots`; zero ticks give the
 * valid empty tree.
 *
 * Frames. Each node has `heading`, the direction of travel arriving at it (leaving it for a
 * trunk), and `angle`, the axis a mark attaches along. Terminal and trunk: `angle` is the
 * heading. Fork: the mean of the unit directions of the outgoing edges' first steps is the
 * children's direction. When that mean resultant is at least `FORK_RESULTANT` (0.25) of a unit
 * vector, `angle` points that way; when the branches spread widely enough that they nearly
 * cancel (two children at a right angle to the heading, three at 120 degrees), the mean is
 * meaningless and `angle` is the arriving heading, which always exists. So a fork frame is
 * defined for every spread and never depends on an ill-conditioned sum. Routing changes edge
 * geometry, so frames are computed from the routed polylines.
 *
 * Identity and seeds. Edge ids are `edge:<tick>.<k>` (the tick and tip position of the edge's
 * first segment), nodes `root:<n>` or `end:<tick>.<k>` (the node an edge ends on). They depend
 * only on growth up to that segment, so raising `ticks` keeps every id and only extends or
 * subdivides the frontier; routing never renames anything. Seeds are
 * `componentSeed(seed, id, "edge" | "node")`.
 *
 * Routing (edge geometry between the same nodes): `grown` keeps every growth vertex; `smooth`
 * cuts its corners twice (Chaikin, ends and end directions kept); `straight` joins the two
 * nodes; `octilinear` routes each edge with one 45-degree elbow (diagonal first or
 * last, chosen from the edge id). Neither alternative changes ids, topology, depth or the node
 * positions.
 *
 * Ownership. Results are deeply frozen and cached; the growth cache is shared with the drawing
 * study, so appearance choices (marks, materials, palette) never regrow the tree and routing
 * changes reuse the growth.
 */
export interface GrowthConstruction {
  sourceCount: number;
  sourceMode: "area" | "ring" | "two-lobe";
  extent: number;
  aspect: number;
  /** Degrees. */
  direction: number;
  centerX: number;
  centerY: number;
  disorder: number;
  exclusion: number;
  band: number;
  lobeGap: number;
  lobeBias: number;
  rootCount: number;
  rootSpread: number;
  rootJitter: number;
  rootX: number;
  rootY: number;
  /** Degrees. */
  rootHeading: number;
  ticks: number;
  step: number;
  reach: number;
  branches: number;
  /** Degrees. */
  branchSpread: number;
}
export type BranchRouting = "grown" | "smooth" | "straight" | "octilinear";
export interface BranchTreeOptions extends GrowthConstruction {
  seed: number;
  routing: BranchRouting;
}
export type BranchRole = "trunk" | "fork" | "terminal";
export interface BranchNode {
  readonly id: string;
  readonly seed: number;
  readonly role: BranchRole;
  readonly position: Point;
  /** Radians. Axis a mark attaches along; defined for every node (see the frame rule above). */
  readonly angle: number;
  /** Radians. Direction of travel arriving at the node (leaving it, for a trunk). */
  readonly heading: number;
  /** Forks between the trunk and the edge arriving at this node. */
  readonly depth: number;
  /** Index of the root tip this node grew from. */
  readonly tree: number;
  readonly edgeIn: string | null;
  readonly edgesOut: readonly string[];
}
/** An edge is a `Path`, so any path material strokes it. `level` is its depth. */
export interface BranchEdge extends Path {
  readonly from: string;
  readonly to: string;
  readonly parent: string | null;
  readonly children: readonly string[];
  readonly depth: number;
  readonly tree: number;
  /** Polyline length in canvas units. */
  readonly length: number;
  /** Growth tick of the edge's first segment. */
  readonly age: number;
}
export interface BranchTree {
  readonly seed: number;
  readonly nodes: readonly BranchNode[];
  readonly edges: readonly BranchEdge[];
  /** Deepest edge; 0 for a single unbranched trunk (and for the empty tree). */
  readonly maxDepth: number;
  /** Root tips that grew. */
  readonly roots: number;
  /** Root tips that never grew a segment. */
  readonly barrenRoots: number;
}

/** Below this mean resultant of the outgoing unit directions, a fork's axis is its arriving heading. */
export const FORK_RESULTANT = 0.25;

const GROWTH_KEYS = ["sourceCount", "sourceMode", "extent", "aspect", "direction", "centerX", "centerY", "disorder",
  "exclusion", "band", "lobeGap", "lobeBias", "rootCount", "rootSpread", "rootJitter", "rootX", "rootY",
  "rootHeading", "ticks", "step", "reach", "branches", "branchSpread"] as const;
const ROUTINGS: readonly string[] = ["grown", "smooth", "straight", "octilinear"];
const treeCache = new Map<string, BranchTree>();

/** Growth parameters in the attractor study's own vocabulary; drawing-only keys take its defaults. */
export function growthParams(options: GrowthConstruction): Record<string, number | string | boolean> {
  const q: Record<string, number | string | boolean> = { ...attractorGrowthDefinitions[0].defaults };
  for (const key of GROWTH_KEYS) q[key] = options[key];
  return q;
}

function checkSeed(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Source seed must be a uint32 integer");
}

type Vector = readonly [number, number];
/** Unit direction of the first positive-length step, or of the last (`fromEnd`). */
function tangent(points: readonly Point[], fromEnd: boolean): Vector {
  const count = points.length;
  for (let i = 1; i < count; i++) {
    const a = fromEnd ? points[count - i - 1] : points[i - 1], b = fromEnd ? points[count - i] : points[i];
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    if (length > 0) return [dx / length, dy / length];
  }
  throw new Error("Branch edge has zero length");
}

/**
 * Axis of a fork: the mean direction of the outgoing unit vectors when they do not nearly cancel,
 * otherwise the arriving heading. `arriving` and every entry of `outgoing` are unit vectors.
 */
export function forkAxis(arriving: Vector, outgoing: readonly Vector[]): number {
  if (outgoing.length === 0) throw new Error("A fork needs outgoing directions");
  let x = 0, y = 0;
  for (const [dx, dy] of outgoing) { x += dx; y += dy; }
  x /= outgoing.length; y /= outgoing.length;
  return Math.hypot(x, y) >= FORK_RESULTANT ? Math.atan2(y, x) : Math.atan2(arriving[1], arriving[0]);
}

function route(points: readonly Point[], routing: BranchRouting, id: string, seed: number): readonly Point[] {
  if (routing === "grown") return points;
  const a = points[0], b = points[points.length - 1];
  if (routing === "straight") return [a, b];
  if (routing === "smooth") {
    // Two rounds of corner cutting; the ends and their directions are kept.
    let line = points;
    for (let round = 0; round < 2 && line.length > 2; round++) {
      const cut: Point[] = [line[0]];
      for (let i = 0; i < line.length - 1; i++) {
        const p = line[i], q = line[i + 1];
        cut.push([p[0] * .75 + q[0] * .25, p[1] * .75 + q[1] * .25], [p[0] * .25 + q[0] * .75, p[1] * .25 + q[1] * .75]);
      }
      cut.push(line[line.length - 1]);
      line = cut;
    }
    return line;
  }
  const dx = b[0] - a[0], dy = b[1] - a[1], ax = Math.abs(dx), ay = Math.abs(dy);
  const sx = Math.sign(dx), sy = Math.sign(dy), diagonal = Math.min(ax, ay), straight = Math.abs(ax - ay);
  if (diagonal === 0 || straight === 0) return [a, b];
  // The straight run goes along the longer axis; which end it sits at is a stable per-edge choice.
  const diagonalFirst = componentSeed(seed, id, "route") % 2 === 0;
  const corner: Point = diagonalFirst
    ? [a[0] + sx * diagonal, a[1] + sy * diagonal]
    : ax > ay ? [a[0] + sx * straight, a[1]] : [a[0], a[1] + sy * straight];
  return [a, corner, b];
}

interface RawEdge { segments: number[]; parentEdge: number; root: number; depth: number; id: string; tick: number }

function build(model: GrowthModel, options: BranchTreeOptions): BranchTree {
  const { segments, lineage } = model;
  if (!lineage) throw new Error("Branch tree unavailable: the growth step could not be matched to its tips (a growing tip landed exactly on an attractor consumed in the same tick); change the seed or the attractor construction");
  const count = segments.length, parents = lineage.parents;
  const childCount = new Int32Array(count);
  for (let k = 0; k < count; k++) if (parents[k] >= 0) childCount[parents[k]]++;
  const tickStart = new Map<number, number>();
  for (let k = 0; k < count; k++) if (!tickStart.has(segments[k][4])) tickStart.set(segments[k][4], k);

  // An edge continues its parent's run while the parent had exactly one child segment.
  const raw: RawEdge[] = [], edgeOf = new Int32Array(count);
  for (let k = 0; k < count; k++) {
    const parent = parents[k];
    if (parent >= 0 && childCount[parent] === 1) { edgeOf[k] = edgeOf[parent]; raw[edgeOf[k]].segments.push(k); continue; }
    const parentEdge = parent >= 0 ? edgeOf[parent] : -1, tick = segments[k][4];
    edgeOf[k] = raw.length;
    raw.push({ segments: [k], parentEdge, root: parent >= 0 ? raw[parentEdge].root : -1 - parent,
      depth: parent >= 0 ? raw[parentEdge].depth + 1 : 0, id: `edge:${tick}.${k - tickStart.get(tick)!}`, tick });
  }

  const polylines: (readonly Point[])[] = [], children: number[][] = raw.map(() => []);
  raw.forEach((edge, index) => {
    if (edge.parentEdge >= 0) children[edge.parentEdge].push(index);
    const first = segments[edge.segments[0]];
    const line: Point[] = [edge.parentEdge >= 0 ? polylines[edge.parentEdge].at(-1)! : [first[0], first[1]]];
    // The native step leaves a `step` gap after each consumed attractor; consecutive segments that
    // do not touch are bridged by the edge's own polyline.
    for (const k of edge.segments) {
      const [x0, y0, x1, y1] = segments[k], last = line[line.length - 1];
      if (x0 !== last[0] || y0 !== last[1]) line.push([x0, y0]);
      line.push([x1, y1]);
    }
    polylines.push(line);
  });
  // A child starts at its parent's end node; routing keeps every edge's endpoints, so routed
  // edges still meet at the same node positions.
  const routed = raw.map((edge, index) => Object.freeze(route(polylines[index], options.routing, edge.id, options.seed).map((p) => Object.freeze([p[0], p[1]] as const))));

  let maxDepth = 0;
  for (const edge of raw) maxDepth = Math.max(maxDepth, edge.depth);
  const edges: BranchEdge[] = [], nodes: BranchNode[] = [];
  const nodeId = (index: number) => `end:${raw[index].id.slice(5)}`;
  const rootIndices = new Set<number>();
  for (const edge of raw) if (edge.parentEdge < 0) rootIndices.add(edge.root);
  const barrenRoots = options.rootCount - rootIndices.size;
  raw.forEach((edge, index) => {
    const points = routed[index];
    let length = 0;
    for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    if (!(length > 0) || !Number.isFinite(length)) throw new Error(`Branch edge ${edge.id} has no finite length`);
    const from = edge.parentEdge >= 0 ? nodeId(edge.parentEdge) : `root:${edge.root}`;
    const id = edge.id;
    edges.push(Object.freeze({
      id, seed: componentSeed(options.seed, id, "edge"), points, closed: false, level: edge.depth,
      levelFraction: maxDepth > 0 ? edge.depth / maxDepth : 0, tone: 0,
      from, to: nodeId(index), parent: edge.parentEdge >= 0 ? raw[edge.parentEdge].id : null,
      children: Object.freeze(children[index].map((child) => raw[child].id)), depth: edge.depth, tree: edge.root, length, age: edge.tick,
    }));
  });
  const nodeSeed = (id: string) => componentSeed(options.seed, id, "node");
  raw.forEach((edge, index) => {
    if (edge.parentEdge >= 0) return;
    const points = routed[index], id = `root:${edge.root}`, head = tangent(points, false);
    nodes.push(Object.freeze({ id, seed: nodeSeed(id), role: "trunk" as const, position: points[0],
      angle: Math.atan2(head[1], head[0]), heading: Math.atan2(head[1], head[0]), depth: 0, tree: edge.root,
      edgeIn: null, edgesOut: Object.freeze([edge.id]) }));
  });
  raw.forEach((edge, index) => {
    const points = routed[index], id = nodeId(index), arriving = tangent(points, true);
    const heading = Math.atan2(arriving[1], arriving[0]);
    const out = children[index];
    const angle = out.length === 0 ? heading : forkAxis(arriving, out.map((child) => tangent(routed[child], false)));
    nodes.push(Object.freeze({ id, seed: nodeSeed(id), role: out.length === 0 ? "terminal" as const : "fork" as const,
      position: points[points.length - 1], angle, heading, depth: edge.depth, tree: edge.root, edgeIn: edge.id,
      edgesOut: Object.freeze(out.map((child) => raw[child].id)) }));
  });
  return Object.freeze({ seed: options.seed, nodes: Object.freeze(nodes), edges: Object.freeze(edges), maxDepth,
    roots: rootIndices.size, barrenRoots });
}

/** The frozen tree for this construction; see the module comment for semantics and failure. */
export function branchTree(options: BranchTreeOptions): BranchTree {
  checkSeed(options.seed);
  if (!ROUTINGS.includes(options.routing)) throw new Error(`Unknown branch routing: ${String(options.routing)}`);
  const q = growthParams(options);
  const key = JSON.stringify([options.seed, ...GROWTH_KEYS.map((name) => options[name]), options.routing]);
  return memoized(treeCache, key, () => build(growthModel(q, options.seed), options));
}

/** Cooperatively grow (yielding between ticks) and build; false when cancelled, publishing nothing. */
export async function prepareBranchTree(options: BranchTreeOptions, cancelled: () => boolean): Promise<boolean> {
  checkSeed(options.seed);
  if (!ROUTINGS.includes(options.routing)) throw new Error(`Unknown branch routing: ${String(options.routing)}`);
  if (!(await prepareGrowthModel(growthParams(options), options.seed, cancelled))) return false;
  branchTree(options);
  return !cancelled();
}

export type AttachmentRole = BranchRole | "flank";
export type FlankSides = "alternate" | "paired" | "single";
export interface AttachmentOptions {
  role: AttachmentRole;
  /** Inclusive window on node depth (edge depth for flanks). */
  minDepth: number;
  maxDepth: number;
  /** Canvas units along the site's frame axis. Negative pulls back along it. */
  offset: number;
  /** 0: mark stays upright (canvas up); 1: mark turns with the frame; between: shortest-arc blend. */
  inherit: number;
  /** 0..0.95: scale is `1 - falloff * depth / treeMaxDepth`, never below 0.05. */
  falloff: number;
  /** Required for `flank`, ignored otherwise. */
  flank?: { spacing: number; /** Degrees away from the edge tangent. */ angle: number; sides: FlankSides };
  /**
   * Attach to the tree as `visibleEdges(tree, visible)` shows it: a node needs its arriving edge
   * visible and its role is re-read from the visible edges (see `attachmentSites`); a flank needs
   * its edge visible. Omitted: roles and eligibility ignore visibility.
   */
  visible?: BranchVisibility;
}
export interface AttachmentSite extends Site {
  readonly role: AttachmentRole;
  /** Node depth, or edge depth for a flank. */
  readonly depth: number;
  /** `depth / tree.maxDepth`, 0 when the tree has no fork. */
  readonly depthFraction: number;
  readonly tree: number;
  /** Id of the node (or edge, for a flank) the site attaches to. */
  readonly owner: string;
}

/** Palette index carried in `Site.tone`: trunk 0, fork 1, terminal 2, flank 3. */
export const ROLE_TONE: Record<AttachmentRole, number> = { trunk: 0, fork: 1, terminal: 2, flank: 3 };
export const MAX_ATTACHMENTS = 30_000;
const UP = -Math.PI / 2;
const siteCaches = new WeakMap<BranchTree, Map<string, readonly AttachmentSite[]>>();
const outlineCaches = new WeakMap<BranchTree, Map<string, readonly Path[]>>();

function wrapPi(angle: number): number {
  const turn = 2 * Math.PI;
  const wrapped = angle - turn * Math.floor((angle + Math.PI) / turn);
  return wrapped === -Math.PI ? Math.PI : wrapped;
}
/** Shortest-arc blend from canvas-up (-pi/2) toward `frame`; exactly `frame` at 1. */
export function inheritAngle(frame: number, inherit: number): number {
  return inherit === 1 ? frame : UP + inherit * wrapPi(frame - UP);
}

function checkAttachment(options: AttachmentOptions): void {
  if (!["trunk", "fork", "terminal", "flank"].includes(options.role)) throw new Error(`Unknown attachment role: ${String(options.role)}`);
  for (const [name, value] of [["offset", options.offset], ["minDepth", options.minDepth], ["maxDepth", options.maxDepth]] as const)
    if (!Number.isFinite(value)) throw new Error(`Attachment ${name} must be finite`);
  if (!(options.inherit >= 0 && options.inherit <= 1)) throw new Error("Attachment inherit must be in [0,1]");
  if (!(options.falloff >= 0 && options.falloff <= 0.95)) throw new Error("Attachment falloff must be in [0,0.95]");
  if (options.role === "flank") {
    const flank = options.flank;
    if (!flank) throw new Error("Flank attachments need spacing, angle and sides");
    if (!(flank.spacing >= 1 && Number.isFinite(flank.spacing))) throw new Error("Flank spacing must be at least 1 canvas unit");
    if (!Number.isFinite(flank.angle)) throw new Error("Flank angle must be finite degrees");
    if (!["alternate", "paired", "single"].includes(flank.sides)) throw new Error(`Unknown flank sides: ${String(flank.sides)}`);
  }
}

/**
 * Attachment sites of one role, in tree order, frozen and cached per tree.
 *
 * `trunk`/`fork`/`terminal` produce one site per eligible node, at the node position moved
 * `offset` along the node's `angle`. `flank` produces sites along every eligible edge at
 * arc-length stations `(i + 1/2) * spacing` (none within half a spacing of either end), on the
 * sides the mode names: `alternate` flips the side each station, `paired` places both, `single`
 * the positive side. The frame axis is the edge tangent turned by `+-angle`; a negative side
 * mirrors across it (negative `scale`), so chiral marks such as arrows stay symmetric about the
 * stem. Ids are `<role>@<owner>` for nodes and `flank@<edge>#<i><+|->`; they do not depend on
 * depth window, offset, inheritance or falloff, and a station keeps its id and sign across the
 * three side modes. The rendered angle is `inheritAngle(frame, inherit)`; `offset` is measured
 * along the frame axis regardless of inheritance.
 *
 * With `visible`, sites follow what `visibleEdges` shows. A node is eligible only when the edge
 * arriving at it is visible (the trunk: when its first edge is). Its role is then read from the
 * visible edges leaving it: none is a pruned end and becomes a `terminal` (frame: arriving
 * heading); one is a bend and takes no site; two or more is a `fork` (frame: `forkAxis` of the
 * visible outgoing directions, so a fork that lost a branch is re-framed). A flank needs its own
 * edge visible. Ids follow the role, so pruning a fork's branches renames `fork@n` to `terminal@n`.
 */
export function attachmentSites(tree: BranchTree, options: AttachmentOptions): readonly AttachmentSite[] {
  checkAttachment(options);
  const cache = siteCaches.get(tree) ?? new Map<string, readonly AttachmentSite[]>();
  siteCaches.set(tree, cache);
  return memoized(cache, JSON.stringify(options), () => {
    const sites: AttachmentSite[] = [];
    const scaleAt = (depth: number) => Math.max(0.05, 1 - options.falloff * (tree.maxDepth > 0 ? depth / tree.maxDepth : 0));
    const fraction = (depth: number) => (tree.maxDepth > 0 ? depth / tree.maxDepth : 0);
    const window = (depth: number) => depth >= options.minDepth && depth <= options.maxDepth;
    const kept = options.visible ? new Set(visibleEdges(tree, options.visible).map((item) => item.id)) : undefined;
    const eligibleEdge = (item: BranchEdge) => window(item.depth) && (kept === undefined || kept.has(item.id));
    if (options.role !== "flank") {
      const edgeById = new Map(tree.edges.map((item) => [item.id, item]));
      for (const node of tree.nodes) {
        let role: BranchRole = node.role, axis = node.angle;
        if (kept) {
          // Roles of the visible tree: a node needs its arriving edge; what it does depends on how
          // many visible edges leave it (none: a pruned end; one: a bend, no site; several: a fork).
          const out = node.edgesOut.filter((id) => kept.has(id));
          if (node.role === "trunk") { if (out.length === 0) continue; }
          else if (!kept.has(node.edgeIn!)) continue;
          else if (out.length === 0) { role = "terminal"; axis = node.heading; }
          else if (out.length === 1) continue;
          else {
            role = "fork";
            axis = out.length === node.edgesOut.length ? node.angle
              : forkAxis([Math.cos(node.heading), Math.sin(node.heading)], out.map((id) => tangent(edgeById.get(id)!.points, false)));
          }
        }
        if (role !== options.role || !window(node.depth)) continue;
        const id = `${role}@${node.id}`;
        sites.push(Object.freeze({ id, seed: componentSeed(node.seed, id, "site"), role,
          position: Object.freeze([node.position[0] + options.offset * Math.cos(axis), node.position[1] + options.offset * Math.sin(axis)] as const),
          angle: inheritAngle(axis, options.inherit), scale: scaleAt(node.depth), tone: ROLE_TONE[role],
          depth: node.depth, depthFraction: fraction(node.depth), tree: node.tree, owner: node.id }));
      }
      return Object.freeze(sites);
    }
    const { spacing, angle, sides } = options.flank!;
    const turn = angle * Math.PI / 180, perStation = sides === "paired" ? 2 : 1;
    let planned = 0;
    for (const edge of tree.edges) if (eligibleEdge(edge)) planned += Math.floor(edge.length / spacing) * perStation;
    if (planned > MAX_ATTACHMENTS)
      throw new Error(`Flank attachments would create ${planned} sites; limit ${MAX_ATTACHMENTS}. Increase flank spacing or narrow the eligible depth`);
    for (const edge of tree.edges) {
      if (!eligibleEdge(edge)) continue;
      const stations = Math.floor(edge.length / spacing);
      let segment = 0, walked = 0;
      for (let i = 0; i < stations; i++) {
        const at = (i + 0.5) * spacing;
        while (segment < edge.points.length - 2 &&
          walked + Math.hypot(edge.points[segment + 1][0] - edge.points[segment][0], edge.points[segment + 1][1] - edge.points[segment][1]) <= at) {
          walked += Math.hypot(edge.points[segment + 1][0] - edge.points[segment][0], edge.points[segment + 1][1] - edge.points[segment][1]);
          segment++;
        }
        const a = edge.points[segment], b = edge.points[segment + 1];
        const run = Math.hypot(b[0] - a[0], b[1] - a[1]), t = run > 0 ? Math.min(1, (at - walked) / run) : 0;
        const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, along = Math.atan2(b[1] - a[1], b[0] - a[0]);
        for (const side of sides === "paired" ? [1, -1] : sides === "single" ? [1] : [i % 2 === 0 ? 1 : -1]) {
          const frame = along + side * turn, id = `flank@${edge.id}#${i}${side > 0 ? "+" : "-"}`;
          sites.push(Object.freeze({ id, seed: componentSeed(edge.seed, id, "site"), role: "flank" as const,
            position: Object.freeze([x + options.offset * Math.cos(frame), y + options.offset * Math.sin(frame)] as const),
            angle: inheritAngle(frame, options.inherit), scale: side * scaleAt(edge.depth), tone: ROLE_TONE.flank,
            depth: edge.depth, depthFraction: fraction(edge.depth), tree: edge.tree, owner: edge.id }));
        }
      }
    }
    return Object.freeze(sites);
  });
}

/** Which edges the edge and outline layers show: inclusive depth window plus stable retention. */
export interface BranchVisibility {
  minDepth: number;
  maxDepth: number;
  /** 0..1: an edge is kept when its own stable draw, from its id and seed, is below this. */
  retention: number;
}
export interface OutlineShape {
  /** Half-width at the start of a trunk edge, canvas units. */
  width: number;
  /** Half-width multiplier per depth, 0..1. */
  falloff: number;
  /** 0: parallel sides; 1: the half-width narrows linearly to a point at the end of each edge. */
  taper: number;
  /** Structural palette index carried by the ribbons. */
  tone: number;
}
export type OutlineOptions = BranchVisibility & OutlineShape;

const visibleCaches = new WeakMap<BranchTree, Map<string, readonly BranchEdge[]>>();
/** Whether `retention` keeps this edge; independent of traversal order, depth window and appearance. */
export function edgeKept(edge: BranchEdge, retention: number): boolean {
  return componentSeed(edge.seed, edge.id, "keep") / 0x1_0000_0000 < retention;
}
/** The edges inside the window that retention keeps, in tree order; frozen and cached per tree. */
export function visibleEdges(tree: BranchTree, visibility: BranchVisibility): readonly BranchEdge[] {
  const { minDepth, maxDepth, retention } = visibility;
  if (!Number.isFinite(minDepth) || !Number.isFinite(maxDepth)) throw new Error("Branch visibility depths must be finite");
  if (!(retention >= 0 && retention <= 1)) throw new Error("Branch retention must be in [0,1]");
  const cache = visibleCaches.get(tree) ?? new Map<string, readonly BranchEdge[]>();
  visibleCaches.set(tree, cache);
  return memoized(cache, JSON.stringify([minDepth, maxDepth, retention]), () => Object.freeze(
    tree.edges.filter((edge) => edge.depth >= minDepth && edge.depth <= maxDepth && edgeKept(edge, retention))));
}

/**
 * The tree as a separate outline layer: each visible edge becomes one closed ribbon around its
 * polyline (`outline:<edge id>`, seed from that id, `level`/`levelFraction` of its edge, `tone`
 * from the options), frozen and cached per tree. Half-width at arc fraction `t` is
 * `width * falloff^depth * (1 - taper * t)`; sides are offset along the mitred vertex normal
 * (miter scale capped at 2 so sharp bends cannot spike). It reads the same visible edges the
 * edge material strokes, so the two layers agree by construction and neither regenerates the tree.
 */
export function branchOutline(tree: BranchTree, options: OutlineOptions): readonly Path[] {
  for (const [name, value] of Object.entries(options)) if (!Number.isFinite(value)) throw new Error(`Outline ${name} must be finite`);
  if (options.width < 0) throw new Error("Outline width must not be negative");
  if (!(options.falloff >= 0 && options.falloff <= 1) || !(options.taper >= 0 && options.taper <= 1)) throw new Error("Outline falloff and taper must be in [0,1]");
  const cache = outlineCaches.get(tree) ?? new Map<string, readonly Path[]>();
  outlineCaches.set(tree, cache);
  return memoized(cache, JSON.stringify(options), () => {
    const paths: Path[] = [];
    if (options.width === 0) return Object.freeze(paths);
    for (const edge of visibleEdges(tree, options)) {
      const points = edge.points, n = points.length;
      const normals: Vector[] = [], lengths: number[] = [0];
      const segmentNormal = (i: number): Vector => {
        const dx = points[i + 1][0] - points[i][0], dy = points[i + 1][1] - points[i][1], length = Math.hypot(dx, dy);
        return length > 0 ? [-dy / length, dx / length] : [0, 0];
      };
      for (let i = 0; i < n; i++) {
        const before = i > 0 ? segmentNormal(i - 1) : segmentNormal(i), after = i < n - 1 ? segmentNormal(i) : before;
        let x = before[0] + after[0], y = before[1] + after[1];
        const length = Math.hypot(x, y);
        if (length < 1e-9) { normals.push(after); }
        else {
          x /= length; y /= length;
          const scale = Math.min(2, 1 / Math.max(0.5, x * after[0] + y * after[1]));
          normals.push([x * scale, y * scale]);
        }
        if (i > 0) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
      }
      const base = options.width * options.falloff ** edge.depth;
      const left: Point[] = [], right: Point[] = [];
      for (let i = 0; i < n; i++) {
        const half = base * (1 - options.taper * (lengths[i] / edge.length));
        left.push([points[i][0] + normals[i][0] * half, points[i][1] + normals[i][1] * half]);
        right.push([points[i][0] - normals[i][0] * half, points[i][1] - normals[i][1] * half]);
      }
      const ring: Point[] = [];
      for (const point of [...left, ...right.reverse()]) {
        const last = ring[ring.length - 1];
        if (!last || last[0] !== point[0] || last[1] !== point[1]) ring.push(point);
      }
      if (ring.length > 2 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
      if (ring.length < 3) continue;
      const id = `outline:${edge.id}`;
      paths.push(Object.freeze({ id, seed: componentSeed(edge.seed, id, "outline"), closed: true, level: edge.level,
        levelFraction: edge.levelFraction, tone: options.tone, points: Object.freeze(ring.map((p) => Object.freeze([p[0], p[1]] as const))) }));
    }
    return Object.freeze(paths);
  });
}
