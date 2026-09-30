import { componentSeed } from "./core.js";
import { graphFromParts, selectGraph, planarFaces } from "./graph.js";
import type { FaceExtraction, Graph, GraphView } from "./graph.js";
import { createSimulationCache, finalState, type AsyncRunOptions, type RunOptions, type Snapshots } from "./snapshots.js";
import { KIND_FRAME, KIND_HUB, KIND_LINK, KIND_RESERVE, KIND_ROUTE, ROAD_LIMITS, roadRings, roadSimulation } from "./road-growth.js";
import type { RoadGrowthParams, RoadProgress, RoadState } from "./road-growth.js";
import type { Path, Point } from "./types.js";

/**
 * The road network as a frozen value: a planar `Graph`, its streets and the growth facts a consumer
 * needs. It is derived once per `Snapshots` object and placement, and cached by that identity, so
 * everything that only restyles roads, lots or marks reads the same object.
 *
 * INPUT. `growRoads(params, seed, steps)` runs `roadSimulation` through the shared simulation cache
 * (retention fixed: a checkpoint every CHECKPOINT_EVERY steps, every step's counts in the history).
 * Palette, materials, hierarchy, widths, lots and the placement transform are not construction: they
 * never reach the key, so they return the same `Snapshots`.
 *
 * OUTPUT (`RoadNetwork`, all frozen, positions in canvas units after `placement`).
 * - `graph`: nodes `n:<serial>` and edges `e:<serial>` (append-only serials from the simulation, so a
 *   longer run never renames an earlier element; an edge shortened by a later junction keeps its id).
 *   Edge weight is 1 for the boundary, hub and zone rings and `1 − 0.8 × rank/streets` for a route
 *   street (older streets are stronger); edge age is `lastBirth − birth + 1` (graph convention: older
 *   is larger; ring streets, born at step 0, are the oldest). Planar by construction: no edge crosses
 *   another, so `planarFaces(view)` reports no crossing edges.
 * - `streets`: one entry per street in birth order (ring streets first): id `frame`, `zone`, `hub` or
 *   `street:<serial>`, its ordered `Path` (closed for rings), birth step, rank among route streets and
 *   the edge ids in order. Streets are what road materials stroke, so stitches and beads run
 *   continuously through junctions.
 * - `deadEnds` and `openEnds`: degree-1 nodes off / on the site boundary. A dead end is a street the
 *   growth could not finish (`deadEnds: "stub"`); an open end leaves the site (no boundary road).
 * - `progress`: steps run, streets grown, attempts that failed, whether growth finished and at which step.
 *
 * FAILURE. Parameters that cannot be built throw an Error naming the control (`validateRoadGrowth`);
 * exceeding the step, work or state bounds throws the runner's error naming `steps` (Steps) or the
 * model's size. Cancellation resolves `null` and caches nothing.
 */
export const CHECKPOINT_EVERY = 60;
export const MAX_CHECKPOINT_VALUES = 12_000_000;

export type RoadKind = "frame" | "zone" | "hub" | "link" | "route";

export interface RoadStreet {
  readonly id: string;
  readonly kind: RoadKind;
  readonly seed: number;
  readonly birth: number;
  /** 0-based order among route streets; −1 for ring streets. */
  readonly rank: number;
  readonly path: Path;
  readonly edges: readonly string[];
  readonly length: number;
  /** True for a stub kept after a failed trace. */
  readonly stub: boolean;
}

export interface RoadPlacement { readonly centerX: number; readonly centerY: number; readonly rotation: number }

export interface RoadNetwork {
  readonly id: string;
  readonly seed: number;
  readonly placement: RoadPlacement;
  readonly graph: Graph;
  /** Every node and edge of `graph` (no role filter), the form `planarFaces` reads. */
  readonly view: GraphView;
  readonly streets: readonly RoadStreet[];
  /** Street id of every edge id. */
  readonly edgeStreet: Readonly<Record<string, string>>;
  readonly deadEnds: readonly string[];
  readonly openEnds: readonly string[];
  readonly progress: { readonly steps: number; readonly streets: number; readonly failed: number; readonly done: boolean; readonly doneAt: number; readonly lastBirth: number };
  readonly construction: string;
}

export type RoadSnapshots = Snapshots<RoadState, RoadGrowthParams, RoadProgress>;

const cache = createSimulationCache({ capacity: 6 });
const options = (steps: number): RunOptions => ({ steps, checkpointEvery: CHECKPOINT_EVERY, historyEvery: 1, maxWork: 250_000_000, maxCheckpointValues: MAX_CHECKPOINT_VALUES, maxHistoryValues: 4_000_000 });

/** Snapshots for this construction and seed: the same object for the same construction, extended or replayed on a step change. */
export function growRoads(params: RoadGrowthParams, seed: number, steps: number): RoadSnapshots {
  return cache.get(roadSimulation, params, seed, options(steps));
}

/** Cooperative `growRoads`; `null` when cancelled (nothing cached). */
export function prepareRoads(params: RoadGrowthParams, seed: number, steps: number, cancelled: () => boolean, extra: Partial<AsyncRunOptions> = {}): Promise<RoadSnapshots | null> {
  return cache.prepare(roadSimulation, params, seed, { ...options(steps), ...extra, cancelled });
}

/** True when this construction is already cached (does not refresh recency). */
export function roadsCached(params: RoadGrowthParams, seed: number, steps: number): boolean {
  return cache.has(roadSimulation, params, seed, options(steps));
}

const KIND_NAMES: Record<number, RoadKind> = { [KIND_FRAME]: "frame", [KIND_RESERVE]: "zone", [KIND_HUB]: "hub", [KIND_LINK]: "link", [KIND_ROUTE]: "route" };
const networks = new WeakMap<object, Map<string, RoadNetwork>>();
const allRoles = Object.freeze({ minDegree: 0, maxDegree: 60_000, minWeight: 0, maxWeight: 1, minAge: 0, maxAge: 1, isolated: true });

/** The network of these snapshots under this placement (rotation in degrees about the site centre, then translation). Cached by identity. */
export function roadNetwork(snaps: RoadSnapshots, placement: RoadPlacement): RoadNetwork {
  const key = `${placement.centerX}|${placement.centerY}|${placement.rotation}`;
  let byPlacement = networks.get(snaps);
  if (!byPlacement) { byPlacement = new Map(); networks.set(snaps, byPlacement); }
  const hit = byPlacement.get(key);
  if (hit) return hit;
  const made = derive(snaps, placement);
  byPlacement.set(key, made);
  if (byPlacement.size > 4) byPlacement.delete(byPlacement.keys().next().value!);
  return made;
}

function derive(snaps: RoadSnapshots, placement: RoadPlacement): RoadNetwork {
  const st = finalState(snaps), seed = snaps.seed, params = snaps.params as RoadGrowthParams;
  const c = Math.cos(placement.rotation * Math.PI / 180), s = Math.sin(placement.rotation * Math.PI / 180);
  const at = (i: number): Point => Object.freeze([placement.centerX + c * st.nodeX[i] - s * st.nodeY[i], placement.centerY + s * st.nodeX[i] + c * st.nodeY[i]] as const);
  let lastBirth = 0;
  for (const birth of st.edgeBirth) lastBirth = Math.max(lastBirth, birth);
  const rankOf = new Map<number, number>(), linkOf = new Map<number, number>();
  let routes = 0;
  st.streetKind.forEach((kind, i) => { if (kind === KIND_ROUTE) rankOf.set(i, routes++); else if (kind === KIND_LINK) linkOf.set(i, linkOf.size); });
  const streetId = (i: number): string => st.streetKind[i] === KIND_ROUTE ? `street:${rankOf.get(i)}` : st.streetKind[i] === KIND_LINK ? `link:${linkOf.get(i)}` : KIND_NAMES[st.streetKind[i]];
  const nodes = st.nodeX.map((_, i) => ({ id: `n:${i}`, position: at(i) }));
  const edges = st.edgeA.map((a, e) => {
    const street = st.edgeStreet[e], kind = st.streetKind[street];
    return { id: `e:${e}`, from: `n:${a}`, to: `n:${st.edgeB[e]}`,
      weight: kind === KIND_ROUTE ? 1 - 0.8 * rankOf.get(street)! / Math.max(1, routes) : 1, age: lastBirth - st.edgeBirth[e] + 1 };
  });
  const graph = graphFromParts({ seed, nodes, edges });
  const view = selectGraph(graph, allRoles);

  // Streets: chain each street's edges into an ordered polyline.
  const byStreet: number[][] = st.streetKind.map(() => []);
  st.edgeA.forEach((_, e) => byStreet[st.edgeStreet[e]].push(e));
  const streets: RoadStreet[] = [];
  const edgeStreet: Record<string, string> = {};
  st.streetKind.forEach((kind, index) => {
    const list = byStreet[index];
    if (list.length === 0) return;
    const ends = new Map<number, number[]>();
    for (const e of list) for (const n of [st.edgeA[e], st.edgeB[e]]) (ends.get(n) ?? ends.set(n, []).get(n)!).push(e);
    let startNode = st.edgeA[list[0]];
    for (const [n, incident] of ends) if (incident.length === 1) { startNode = n; break; }
    const closed = ![...ends.values()].some((incident) => incident.length === 1);
    const order: number[] = [], nodeOrder = [startNode], used = new Set<number>();
    let here = startNode;
    for (;;) {
      const next = (ends.get(here) ?? []).find((e) => !used.has(e));
      if (next === undefined) break;
      used.add(next); order.push(next);
      here = st.edgeA[next] === here ? st.edgeB[next] : st.edgeA[next];
      if (here === startNode) break;
      nodeOrder.push(here);
    }
    const id = streetId(index), rank = kind === KIND_ROUTE ? rankOf.get(index)! : -1;
    const points = nodeOrder.map(at);
    let length = 0;
    for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    if (closed) length += Math.hypot(points[0][0] - points[points.length - 1][0], points[0][1] - points[points.length - 1][1]);
    const edgeIds = order.map((e) => `e:${e}`);
    for (const e of edgeIds) edgeStreet[e] = id;
    const path: Path = Object.freeze({ id, seed: componentSeed(seed, id, "street"), points: Object.freeze(points), closed,
      level: rank < 0 ? 0 : rank, levelFraction: rank < 0 ? 0 : routes > 1 ? rank / (routes - 1) : 0 });
    streets.push(Object.freeze({ id, kind: KIND_NAMES[kind], seed: path.seed, birth: st.streetBirth[index], rank, path, edges: Object.freeze(edgeIds), length, stub: st.streetDead[index] === 1 }));
  });
  const dead: string[] = [], open: string[] = [];
  for (const node of graph.nodes) {
    if (node.degree !== 1) continue;
    const i = Number(node.id.slice(2)), edge = Math.abs(Math.abs(st.nodeX[i]) - params.width / 2) < 1e-6 || Math.abs(Math.abs(st.nodeY[i]) - params.height / 2) < 1e-6;
    (edge ? open : dead).push(node.id);
  }
  const progress = Object.freeze({ steps: snaps.steps, streets: routes, failed: st.failed, done: st.done === 1, doneAt: st.doneAt, lastBirth });
  return Object.freeze({ id: `roads:${snaps.key}`, seed, placement: Object.freeze({ ...placement }), graph, view, streets: Object.freeze(streets),
    edgeStreet: Object.freeze(edgeStreet), deadEnds: Object.freeze(dead), openEnds: Object.freeze(open), progress, construction: snaps.construction });
}

/** The faces of the network's planar graph (every enclosed cycle a valid block); cached by view. */
export function roadFaces(network: RoadNetwork): FaceExtraction {
  return planarFaces(network.view);
}

export { roadRings, ROAD_LIMITS };
