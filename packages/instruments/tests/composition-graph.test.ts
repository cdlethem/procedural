import assert from "node:assert/strict";
import test from "node:test";
import {
  atEach, branchGraph, branchOrnamentComposition, branchTree, graphFromBranchTree, componentSeed, connectedNodes, contactGraph, createInstrument, drawGraphComposition, drawReferenceComposition, edgeMarkers,
  edgePaths, graphFromParts, graphRoute, graphStructure, latticeGraph, nearestNode, nodeSites, planarFaces, referenceComposition,
  selectGraph, strokeWith, usesSeed, validateInstrument, withDirection,
  type BranchTreeOptions, type CompositionSurface, type Graph, type InstrumentInput, type GraphComposition, type GraphRoleOptions, type GraphView, type RouteOptions,
} from "../dist/index.js";
import { buildProximityReplay } from "../dist/adapters/proximity-replay-instruments.js";
import { proximityReplayInstrumentDefinitions } from "../dist/adapters/proximity-replay-instruments.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";

const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const ALL: GraphRoleOptions = { minDegree: 0, maxDegree: 1000, minWeight: 0, maxWeight: 1, minAge: 0, maxAge: 1, isolated: true };
type N = [id: string, x: number, y: number];
type E = [id: string, from: string, to: string, weight?: number, age?: number];
const build = (nodes: N[], edges: E[], directed = false, seed = 7): Graph => graphFromParts({ seed, directed,
  nodes: nodes.map(([id, x, y]) => ({ id, position: [x, y] as const })),
  edges: edges.map(([id, from, to, weight = 1, age = 1]) => ({ id, from, to, weight, age })) });
const view = (graph: Graph, roles: Partial<GraphRoleOptions> = {}): GraphView => selectGraph(graph, { ...ALL, ...roles });
const faces = (nodes: N[], edges: E[]) => planarFaces(view(build(nodes, edges)));
const SQUARE: N[] = [["a", 0, 0], ["b", 10, 0], ["c", 10, 10], ["d", 0, 10]];
const SIDES: E[] = [["ab", "a", "b"], ["bc", "b", "c"], ["cd", "c", "d"], ["da", "d", "a"]];

/** Records painting calls in canvas space; nothing here transforms, since graph values are world-space. */
class Log implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  calls: [string, ...unknown[]][] = [];
  polygons: number[][][] = [];
  #shape: number[][] = [];
  #record(name: string, args: unknown[]) { this.calls.push([name, ...args]); }
  push() { this.#record("push", []); } pop() { this.#record("pop", []); }
  translate(x: number, y: number) { this.#record("translate", [x, y]); }
  rotate(r: number) { this.#record("rotate", [r]); }
  scale(x: number, y?: number) { this.#record("scale", [x, y]); }
  noFill() { this.#record("noFill", []); } noStroke() { this.#record("noStroke", []); }
  fill(...c: number[]) { this.#record("fill", c); } stroke(...c: number[]) { this.#record("stroke", c); }
  strokeWeight(w: number) { this.#record("strokeWeight", [w]); } strokeCap(c: unknown) { this.#record("strokeCap", [c]); }
  circle(x: number, y: number, d: number) { this.#record("circle", [x, y, d]); }
  line(a: number, b: number, c: number, d: number) { this.#record("line", [a, b, c, d]); }
  rect(a: number, b: number, c: number, d: number) { this.#record("rect", [a, b, c, d]); }
  beginShape() { this.#shape = []; this.#record("beginShape", []); }
  vertex(x: number, y: number) { this.#shape.push([x, y]); this.#record("vertex", [x, y]); }
  endShape(mode?: unknown) { if (mode === this.CLOSE) this.polygons.push(this.#shape); this.#record("endShape", [mode]); }
}
const random = (seed: number) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 0x100000000; };

/* ------------------------------------------------------------------ values */

test("graphFromParts derives degree, strength, age and length exactly, and freezes everything", () => {
  const graph = build([["p", 0, 0], ["q", 3, 4], ["r", 3, 0], ["s", 9, 9], ["t", 50, 50]],
    [["pq", "p", "q", .5, 3], ["qr", "q", "r", 1, 7], ["pr", "r", "p", .25, 2], ["rs", "r", "s", .1, 5]]);
  const byId = Object.fromEntries(graph.nodes.map((node) => [node.id, node]));
  assert.deepEqual(graph.nodes.map((node) => [node.id, node.degree]), [["p", 2], ["q", 2], ["r", 3], ["s", 1], ["t", 0]]);
  near(byId.p.weight, .75); near(byId.q.weight, 1.5); near(byId.r.weight, 1.35); near(byId.s.weight, .1); assert.equal(byId.t.weight, 0);
  assert.deepEqual(graph.nodes.map((node) => node.age), [3, 7, 7, 5, 0], "a node is as old as its oldest edge; an isolated node has age 0");
  near(graph.edges[0].length, 5); near(graph.edges[2].length, 3);
  assert.deepEqual(graph.stats, { maxDegree: 3, maxNodeWeight: 1.5, maxEdgeWeight: 1, maxAge: 7 });
  for (const value of [graph, graph.nodes, graph.edges, graph.stats, graph.nodes[0], graph.nodes[0].position, graph.edges[0]])
    assert.ok(Object.isFrozen(value));
});

test("element seeds come from ids, so node and edge order cannot move them", () => {
  const nodes: N[] = [["u", 0, 0], ["v", 5, 0], ["w", 5, 5]], edges: E[] = [["uv", "u", "v"], ["vw", "v", "w"]];
  const forward = build(nodes, edges), reversed = build([...nodes].reverse(), [...edges].reverse());
  for (const node of forward.nodes) assert.equal(reversed.nodes.find((item) => item.id === node.id)!.seed, node.seed);
  for (const edge of forward.edges) assert.equal(reversed.edges.find((item) => item.id === edge.id)!.seed, edge.seed);
  assert.equal(forward.nodes[0].seed, componentSeed(7, "u", "node"));
  assert.notEqual(build(nodes, edges, false, 8).nodes[0].seed, forward.nodes[0].seed);
});

test("graphFromParts rejects malformed graphs with precise messages", () => {
  const two: N[] = [["a", 0, 0], ["b", 1, 1]];
  assert.throws(() => build([...two, ["a", 2, 2]], []), /node id a is repeated/);
  assert.throws(() => build(two, [["e", "a", "a"]]), /self-loop/);
  assert.throws(() => build(two, [["e", "a", "b"], ["f", "b", "a"]]), /duplicates e between the same nodes/);
  assert.throws(() => build(two, [["e", "a", "z"]]), /names a node that does not exist/);
  assert.throws(() => build(two, [["e", "a", "b", 1.5]]), /weight must be finite and in \[0, 1\]/);
  assert.throws(() => build(two, [["e", "a", "b", 1, 0]]), /age must be a positive integer/);
  assert.throws(() => build(two, [["e", "a", "b"], ["e", "b", "a"]]), /edge id e is repeated/);
  assert.throws(() => graphFromParts({ seed: -1, nodes: [], edges: [] }), /uint32/);
  assert.throws(() => graphFromParts({ seed: 1, nodes: Array.from({ length: 20_001 }, (_, i) => ({ id: `n${i}`, position: [0, 0] as const })), edges: [] }), /limit 20000/);
});

/* ----------------------------------------------------------------- sources */

const lattice = (overrides: Partial<Parameters<typeof latticeGraph>[0]> = {}) => latticeGraph({ seed: 5, columns: 6, rows: 5, region: "rectangle",
  innerRadius: 0, blocked: 0, braid: 0, diagonals: 0, wobble: 0, rootX: 0, rootY: 0, centerX: 300, centerY: 250, width: 500, height: 400, rotation: 0, ...overrides });

test("lattice edge counts follow the grid: a spanning tree, the full grid, then both diagonals", () => {
  const tree = lattice(), grid = lattice({ braid: 1 }), diagonal = lattice({ braid: 1, diagonals: 1 });
  assert.equal(tree.nodes.length, 30);
  assert.equal(tree.edges.length, 29, "one spanning tree over 30 connected sites");
  assert.equal(grid.edges.length, 5 * 5 + 6 * 4, "horizontal 5×5 plus vertical 6×4");
  assert.equal(diagonal.edges.length, 49 + 2 * 5 * 4);
  assert.equal(lattice({ braid: 1, blocked: .3 }).nodes.length < 30, true);
});

test("lattice geometry: exact grid positions without wobble, and rotation about the center", () => {
  const flat = lattice();
  const at = Object.fromEntries(flat.nodes.map((node) => [node.id, node.position]));
  near(at["n:0:0"][0], 300 - 250); near(at["n:0:0"][1], 250 - 200);
  near(at["n:5:4"][0], 300 + 250); near(at["n:5:4"][1], 250 + 200);
  near(at["n:2:3"][0], 300 - 250 + 2 * 100); near(at["n:2:3"][1], 250 - 200 + 3 * 100);
  const turned = lattice({ rotation: 90 });
  const corner = turned.nodes.find((node) => node.id === "n:0:0")!.position;
  near(corner[0], 300 + 200); near(corner[1], 250 - 250, 1e-9);
});

test("lattice tree edges run parent → child and age by growth order", () => {
  const graph = withDirection(lattice({ rootX: 0, rootY: 0 }), true);
  const incoming = new Map(graph.edges.map((edge) => [edge.to, edge]));
  const root = graph.nodes.find((node) => !incoming.has(node.id))!.id;
  assert.equal(root, "n:0:0", "growth begins at the preferred root");
  const depth = new Map<string, number>([[root, 0]]);
  for (let changed = true; changed;) {
    changed = false;
    for (const edge of graph.edges) if (depth.has(edge.from) && !depth.has(edge.to)) { depth.set(edge.to, depth.get(edge.from)! + 1); changed = true; }
  }
  assert.equal(depth.size, 30);
  const last = Math.max(...depth.values());
  for (const edge of graph.edges) assert.equal(edge.age, last - depth.get(edge.to)! + 1, `edge ${edge.id}: age = last depth − child depth + 1`);
  for (const edge of graph.edges) assert.ok(incoming.get(edge.from) === undefined || incoming.get(edge.from)!.age > edge.age, "older edges precede younger ones along direction");
});

test("changing only loops, direction or roles keeps every node id, position and shared edge id", () => {
  const a = lattice({ wobble: .6, braid: .2 }), b = lattice({ wobble: .6, braid: .9 });
  assert.deepEqual(a.nodes.map((node) => [node.id, node.position]), b.nodes.map((node) => [node.id, node.position]));
  const shared = new Set(b.edges.map((edge) => edge.id));
  for (const edge of a.edges) assert.ok(shared.has(edge.id), `${edge.id} survives more loops`);
  assert.ok(b.edges.length > a.edges.length);
  const directed = withDirection(a, true);
  assert.equal(directed.nodes, a.nodes); assert.equal(directed.edges, a.edges);
  assert.equal(directed.directed, true); assert.equal(a.directed, false);
  const other = lattice({ wobble: .6, braid: .2, seed: 6 });
  assert.notDeepEqual(other.edges.map((edge) => edge.id), a.edges.map((edge) => edge.id), "a new seed regrows the maze");
});

test("lattice wobble never crosses two grid edges", () => {
  const graph = lattice({ wobble: 1, braid: 1, columns: 14, rows: 12, rotation: 37 });
  assert.deepEqual(planarFaces(view(graph)).crossingEdges, []);
  assert.equal(planarFaces(view(graph)).faces.length, 13 * 11);
});

test("contact graph is the replay's proximity network with independent closeness weights and run-length ages", () => {
  const options = { seed: 6, count: 60, startShape: "area" as const, centerX: 320, centerY: 320, width: 300, height: 270, rotation: 10,
    disorder: .2, ticks: 40, radius: 45, force: .004, avoidance: .22, speed: 2.5, damping: .985 };
  const graph = contactGraph(options);
  const replay = buildProximityReplay({ ...proximityReplayInstrumentDefinitions[0].defaults, count: 60, sourceMode: "area", centerX: 320, centerY: 320,
    extent: 300, aspect: .9, angle: 10, disorder: .2, ticks: 40, radius: 45, force: .004, avoidance: .22, speed: 2.5, damping: .985, openChains: false }, 6);
  assert.deepEqual(graph.nodes.map((node) => node.position), replay.points);
  const within = (points: readonly (readonly number[])[], i: number, j: number) => Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]) <= 45;
  const expected: string[] = [];
  for (let i = 0; i < 60; i++) for (let j = i + 1; j < 60; j++) if (within(replay.points, i, j)) expected.push(`e:${i}:${j}`);
  assert.deepEqual(graph.edges.map((edge) => edge.id), expected);
  let interrupted = 0;
  for (const edge of graph.edges) {
    const [, a, b] = edge.id.split(":").map(Number);
    near(edge.weight, 1 - Math.hypot(replay.points[a][0] - replay.points[b][0], replay.points[a][1] - replay.points[b][1]) / 45, 1e-12);
    let run = 0, present = 0;
    for (let tick = replay.history.length - 1; tick >= 0 && within(replay.history[tick], a, b); tick--) run++;
    for (const points of replay.history) if (within(points, a, b)) present++;
    if (present > run) interrupted++;
    assert.equal(edge.age, run, `${edge.id} has been in contact for ${run} consecutive ticks`);
  }
  assert.ok(interrupted > 0, "some pairs lost contact and regained it, so consecutive and total counts differ");
  assert.ok(new Set(graph.edges.map((edge) => edge.age)).size > 8, "ages differ once agents move");
  assert.ok(graph.edges.some((edge) => edge.age === 1), "a contact that formed at the last tick is age 1");
  assert.deepEqual(contactGraph({ ...options, ticks: 0 }).edges.map((edge) => edge.age).filter((age) => age !== 1), [], "no history, no age");
});

test("contact direction points from the agent closing faster; lower index on a tie", () => {
  const graph = contactGraph({ seed: 3, count: 50, startShape: "ring", centerX: 320, centerY: 320, width: 320, height: 320, rotation: 0,
    disorder: 0, ticks: 30, radius: 70, force: .002, avoidance: .22, speed: 1, damping: .985 });
  const replay = buildProximityReplay({ ...proximityReplayInstrumentDefinitions[0].defaults, count: 50, sourceMode: "ring", centerX: 320, centerY: 320,
    extent: 320, aspect: 1, angle: 0, disorder: 0, ticks: 30, radius: 70, force: .002, avoidance: .22, speed: 1, damping: .985, openChains: false }, 3);
  let flipped = 0;
  for (const edge of graph.edges) {
    const from = Number(edge.from.slice(2)), to = Number(edge.to.slice(2));
    const dx = replay.points[to][0] - replay.points[from][0], dy = replay.points[to][1] - replay.points[from][1], d = Math.hypot(dx, dy);
    const closeFrom = (replay.velocities[from][0] * dx + replay.velocities[from][1] * dy) / d;
    const closeTo = -(replay.velocities[to][0] * dx + replay.velocities[to][1] * dy) / d;
    assert.ok(closeFrom >= closeTo - 1e-12, `${edge.id} tail is the faster closer`);
    if (from > to) flipped++;
  }
  assert.ok(flipped > 0 && flipped < graph.edges.length, "orientation is not just index order");
});

test("branch graph is a forest whose weights are subtree shares and whose ages fall with generation", () => {
  const graph = branchGraph({ seed: 4, roots: 2, generations: 5, children: 2, angle: 30, angleSpread: 10, contraction: .8, survival: .85,
    rootLength: 90, centerX: 320, centerY: 320, width: 400, height: 400, rotation: 0 });
  assert.equal(graph.nodes.length, graph.edges.length + 2, "two trees: one origin node each plus one end node per segment");
  const children = new Map<string, string[]>();
  for (const edge of graph.edges) children.set(edge.from, [...(children.get(edge.from) ?? []), edge.to]);
  const byTo = new Map(graph.edges.map((edge) => [edge.to, edge]));
  const size = (id: string): number => 1 + (children.get(id) ?? []).reduce((sum, child) => sum + size(child), 0);
  for (const root of ["t0:o", "t1:o"]) {
    const trunk = graph.edges.find((edge) => edge.from === root)!;
    near(trunk.weight, 1);
    const total = size(trunk.to);
    for (const edge of graph.edges.filter((item) => item.id.startsWith(root.slice(0, 2)))) near(edge.weight, size(edge.to) / total, 1e-12);
    for (const edge of graph.edges.filter((item) => item.id.startsWith(root.slice(0, 2)) && item.from !== root))
      assert.equal(edge.age, byTo.get(edge.from)!.age - 1, "each generation is one step younger than its parent");
  }
  const straight = branchGraph({ seed: 4, roots: 1, generations: 3, children: 2, angle: 30, angleSpread: 0, contraction: .8, survival: 1,
    rootLength: 100, centerX: 320, centerY: 320, width: 400, height: 400, rotation: 0 });
  const trunk = straight.nodes.find((node) => node.id === "t0:0")!.position, origin = straight.nodes.find((node) => node.id === "t0:o")!.position;
  near(trunk[0], origin[0], 1e-9);
  const trunkLength = origin[1] - trunk[1], generationOne = straight.nodes.find((node) => node.id === "t0:1")!.position;
  near(Math.hypot(generationOne[0] - trunk[0], generationOne[1] - trunk[1]) / trunkLength, .8, 1e-9);
});

test("branch forests are fitted into Placement: bounding box inside width × height, touching one, centered, rotation about the center", () => {
  const base = { seed: 4, roots: 3, generations: 5, children: 2 as const, angle: 30, angleSpread: 10, contraction: .82, survival: .9, rootLength: 90 };
  for (const [width, height, centerX, centerY] of [[400, 400, 320, 320], [200, 500, 100, 350], [520, 130, 400, 90]] as const) {
    const graph = branchGraph({ ...base, centerX, centerY, width, height, rotation: 0 });
    const xs = graph.nodes.map((node) => node.position[0]), ys = graph.nodes.map((node) => node.position[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    near((x0 + x1) / 2, centerX, 1e-9); near((y0 + y1) / 2, centerY, 1e-9);
    assert.ok(x1 - x0 <= width + 1e-9 && y1 - y0 <= height + 1e-9);
    assert.ok(Math.abs(x1 - x0 - width) < 1e-9 || Math.abs(y1 - y0 - height) < 1e-9, "the footprint is used, not just respected");
    const turned = branchGraph({ ...base, centerX, centerY, width, height, rotation: 90 });
    for (const node of graph.nodes) {
      const other = turned.nodes.find((item) => item.id === node.id)!.position;
      near(other[0] - centerX, -(node.position[1] - centerY), 1e-9); near(other[1] - centerY, node.position[0] - centerX, 1e-9);
    }
  }
  const canvas = branchGraph({ ...base, centerX: 320, centerY: 320, width: 500, height: 420, rotation: 0 });
  assert.ok(canvas.nodes.every((node) => node.position[0] >= 70 - 1e-9 && node.position[0] <= 570 + 1e-9 && node.position[1] >= 110 - 1e-9 && node.position[1] <= 530 + 1e-9));
});

/* --------------------------------------------------------------- selection */

test("role selection filters by source degree, weight and age fractions without renumbering", () => {
  const graph = build([["h", 0, 0], ["l1", 10, 0], ["l2", 0, 10], ["l3", -10, 0], ["m", 20, 0], ["z", 99, 99]],
    [["hl1", "h", "l1", 1, 2], ["hl2", "h", "l2", .5, 8], ["hl3", "h", "l3", .2, 4], ["l1m", "l1", "m", .8, 6]]);
  assert.deepEqual(view(graph, { isolated: false }).nodes.map((node) => node.id), ["h", "l1", "l2", "l3", "m"]);
  const hubs = view(graph, { minDegree: 2, isolated: false });
  assert.deepEqual(hubs.nodes.map((node) => node.id), ["h", "l1"]);
  assert.deepEqual(hubs.edges.map((edge) => edge.id), ["hl1"], "an edge needs both ends kept");
  assert.equal(hubs.nodes[0].degree, 3, "degree is the source graph's, not the view's");
  assert.deepEqual(view(graph, { maxDegree: 1, isolated: false }).edges.map((edge) => edge.id), [], "the leaves share no edge");
  assert.deepEqual(view(graph, { minWeight: .5 }).edges.map((edge) => edge.id), ["hl1", "hl2", "l1m"]);
  assert.deepEqual(view(graph, { maxWeight: .5 }).edges.map((edge) => edge.id), ["hl2", "hl3"]);
  assert.deepEqual(view(graph, { minAge: .5 }).edges.map((edge) => edge.id), ["hl2", "hl3", "l1m"], "age fractions are relative to the oldest edge (8)");
  assert.deepEqual(view(graph, { maxAge: .5 }).edges.map((edge) => edge.id), ["hl1", "hl3"]);
  assert.deepEqual(view(graph, { minWeight: .5, minAge: .5, isolated: false }).edges.map((edge) => edge.id), ["hl2", "l1m"]);
  assert.throws(() => view(graph, { minAge: .8, maxAge: .2 }), /min age must not exceed max age/);
  assert.throws(() => view(graph, { minDegree: 5, maxDegree: 2 }), /minDegree must not exceed maxDegree/);
  assert.equal(nearestNode(view(graph), [8, 1])!.id, "l1");
  assert.equal(nearestNode(view(graph, { isolated: false, minDegree: 2 }), [99, 99])!.id, "l1", "the far isolated node is not in the view");
});

/* ------------------------------------------------------------------ routes */

const route = (graph: Graph, from: string, to: string, options: Partial<RouteOptions> = {}, roles: Partial<GraphRoleOptions> = {}) =>
  graphRoute(view(graph, roles), { from, to, mode: "shortest", metric: "length", followDirection: false, ...options });

test("shortest routes minimize each metric; hops, length and weight disagree where they should", () => {
  // Direct edge a–d is long; a–b–c–d is three short hops but the strong edges are elsewhere.
  const graph = build([["a", 0, 0], ["b", 4, 0], ["c", 8, 0], ["d", 12, 0], ["m", 6, 20]],
    [["ad", "a", "d", .1, 1], ["ab", "a", "b", .3, 1], ["bc", "b", "c", .3, 1], ["cd", "c", "d", .3, 1], ["am", "a", "m", 1, 1], ["md", "m", "d", 1, 1]]);
  assert.deepEqual(route(graph, "a", "d", { metric: "length" })!.nodes, ["a", "d"], "12 beats 3 × 4 only when equal; here 12 = 12 and fewer edges wins");
  assert.deepEqual(route(graph, "a", "d", { metric: "hops" })!.nodes, ["a", "d"]);
  const byWeight = route(graph, "a", "d", { metric: "weight" })!;
  assert.deepEqual(byWeight.nodes, ["a", "m", "d"], "cost 1 − weight: the two strong edges cost 0, the direct edge 0.9");
  near(byWeight.total, 0);
  near(route(graph, "a", "d")!.total, 12);
  const routed = route(graph, "a", "m", { metric: "length" })!;
  assert.equal(routed.path.points.length, 2); assert.deepEqual(routed.path.points[0], [0, 0]); assert.deepEqual(routed.path.points[1], [6, 20]);
  assert.equal(routed.path.tone, 1); assert.equal(routed.id, "route:a>m");
});

test("shortest ties: equal cost prefers fewer edges, then the lexicographically first node sequence in graph order", () => {
  const diamond = (order: string[]): Graph => build(order.map((id) => ({ a: ["a", 0, 0], b: ["b", 10, 10], c: ["c", 10, -10], d: ["d", 20, 0] } as Record<string, N>)[id]),
    [["ab", "a", "b"], ["bd", "b", "d"], ["ac", "a", "c"], ["cd", "c", "d"]]);
  assert.deepEqual(route(diamond(["a", "b", "c", "d"]), "a", "d")!.nodes, ["a", "b", "d"]);
  assert.deepEqual(route(diamond(["a", "c", "b", "d"]), "a", "d")!.nodes, ["a", "c", "d"], "node order, not edge order or name, decides");
  assert.deepEqual(route(diamond(["d", "c", "b", "a"]), "a", "d")!.nodes, ["a", "c", "d"], "earlier in graph order: c precedes b here");
  const same = route(diamond(["a", "b", "c", "d"]), "d", "a")!;
  assert.deepEqual(same.nodes, ["d", "b", "a"], "reverse direction applies the same rule");
});

test("routes respect direction only when asked, may be absent, and reject unknown endpoints", () => {
  const nodes: N[] = [["a", 0, 0], ["b", 10, 0], ["c", 20, 0]];
  const oneWay = build(nodes, [["ab", "a", "b"], ["cb", "c", "b"]], true);
  assert.equal(route(oneWay, "a", "c", { followDirection: true }), null, "b → c does not exist");
  assert.deepEqual(route(oneWay, "a", "c", { followDirection: false })!.nodes, ["a", "b", "c"]);
  assert.deepEqual(route(oneWay, "a", "b", { followDirection: true })!.edges, ["ab"]);
  assert.equal(route(oneWay, "b", "a", { followDirection: true }), null);
  assert.equal(route(withDirection(oneWay, false), "b", "a", { followDirection: true })!.nodes.length, 2, "an undirected graph ignores the flag");
  assert.deepEqual(route(oneWay, "b", "b")!.nodes, ["b"]);
  assert.equal(route(build([...nodes, ["z", 90, 90]], [["ab", "a", "b"]]), "a", "z"), null);
  assert.throws(() => route(oneWay, "a", "nope"), /Route end nope is not in the selected view/);
  assert.throws(() => route(oneWay, "nope", "a"), /Route start nope is not in the selected view/);
  assert.throws(() => route(build(nodes, [["ab", "a", "b"], ["bc", "b", "c"]]), "a", "c", {}, { minWeight: 1, maxWeight: 1, isolated: false, maxAge: 0 }), /not in the selected view/);
});

test("endpoints in different components: the end snaps to the nearest node of the start's component, deterministically", () => {
  // Two separate triangles; the end point sits on the far one.
  const graph = build([["a", 0, 0], ["b", 10, 0], ["c", 5, 8], ["x", 100, 0], ["y", 110, 0], ["z", 105, 8]],
    [["ab", "a", "b"], ["bc", "b", "c"], ["ca", "c", "a"], ["xy", "x", "y"], ["yz", "y", "z"], ["zx", "z", "x"]]);
  const v = view(graph);
  assert.deepEqual([...connectedNodes(v, "a")].sort(), ["a", "b", "c"]);
  assert.equal(nearestNode(v, [104, 6])!.id, "z");
  assert.equal(nearestNode(v, [104, 6], connectedNodes(v, "a"))!.id, "b", "restricted to a's component: b (10,0) is nearer than c (5,8)");
  assert.equal(graphRoute(v, { from: "a", to: "z", mode: "shortest", metric: "length", followDirection: false }), null, "the raw route is still absent");
  const item = input({ source: "branches", roots: 3, route: "shortest", startX: 120, startY: 520, endX: 520, endY: 120 });
  const recipe = referenceComposition(item) as GraphComposition & { kind: "graph" };
  const { route, view: selected } = graphStructure(recipe);
  assert.ok(route && route.nodes.length > 2, "trees are separate components, yet a route is drawn");
  const tree = (id: string) => id.split(":")[0];
  assert.equal(new Set(route!.nodes.map(tree)).size, 1, "the whole route stays in the start's tree");
  assert.equal(route!.nodes[0], nearestNode(selected, [120, 520])!.id, "the start is still the nearest node to its point");
  assert.deepEqual(graphStructure(recipe).route!.nodes, route!.nodes, "deterministic");
  const walled = graphStructure(referenceComposition(input({ source: "branches", roots: 2, route: "shortest", startX: 120, startY: 520, endX: 120, endY: 520, minAge: 1 })) as GraphComposition & { kind: "graph" });
  assert.ok(walled.route === null || walled.route.nodes.length >= 1);
});

test("routes agree with brute-force enumeration of simple paths on small random graphs", () => {
  for (let seed = 1; seed <= 24; seed++) {
    const next = random(seed), count = 7, nodes: N[] = Array.from({ length: count }, (_, i) => [`n${i}`, Math.round(next() * 90), Math.round(next() * 90)] as N);
    const edges: E[] = [];
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) if (next() < .45) {
      const flip = next() < .4;
      edges.push([`e${i}-${j}`, flip ? `n${j}` : `n${i}`, flip ? `n${i}` : `n${j}`, Math.round(next() * 10) / 10, 1 + Math.floor(next() * 5)]);
    }
    const directed = seed % 3 === 0, graph = build(nodes, edges, directed);
    const positions = new Map(graph.nodes.map((node) => [node.id, node.position]));
    for (const metric of ["length", "hops", "weight"] as const) {
      const cost = (edge: (typeof graph.edges)[number]) => metric === "length" ? Math.hypot(positions.get(edge.from)![0] - positions.get(edge.to)![0], positions.get(edge.from)![1] - positions.get(edge.to)![1]) : metric === "hops" ? 1 : 1 - edge.weight;
      const totals: number[] = [];
      const walk = (at: string, seen: Set<string>, total: number) => {
        if (at === "n6") { totals.push(total); return; }
        for (const edge of graph.edges) {
          const forward = edge.from === at ? edge.to : !directed && edge.to === at ? edge.from : undefined;
          if (forward !== undefined && !seen.has(forward)) walk(forward, new Set([...seen, forward]), total + cost(edge));
        }
      };
      walk("n0", new Set(["n0"]), 0);
      for (const mode of ["shortest", "longest"] as const) {
        const found = route(graph, "n0", "n6", { mode, metric, followDirection: directed });
        if (totals.length === 0) { assert.equal(found, null, `seed ${seed} ${metric}: unreachable`); continue; }
        assert.ok(found, `seed ${seed} ${metric} ${mode}: a route exists`);
        near(found!.total, mode === "shortest" ? Math.min(...totals) : Math.max(...totals), 1e-9);
        assert.equal(found!.exact, true);
        assert.equal(new Set(found!.nodes).size, found!.nodes.length, "simple route");
        assert.equal(found!.nodes[0], "n0"); assert.equal(found!.nodes.at(-1), "n6");
      }
    }
  }
});

test("the longest route takes the long way round a cycle and reports when its search is bounded", () => {
  const ring = build([["a", 0, 0], ["b", 10, 0], ["c", 10, 10], ["d", 0, 10]], SIDES.map((edge) => [...edge] as E));
  assert.deepEqual(route(ring, "a", "b", { mode: "shortest" })!.nodes, ["a", "b"]);
  const around = route(ring, "a", "b", { mode: "longest" })!;
  assert.deepEqual(around.nodes, ["a", "d", "c", "b"]);
  near(around.total, 30); assert.equal(around.exact, true);
  const grid: N[] = [], links: E[] = [];
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) grid.push([`g${x}_${y}`, x * 10, y * 10]);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    if (x < 8) links.push([`h${x}_${y}`, `g${x}_${y}`, `g${x + 1}_${y}`]);
    if (y < 8) links.push([`v${x}_${y}`, `g${x}_${y}`, `g${x}_${y + 1}`]);
  }
  const big = build(grid, links);
  const bounded = route(big, "g0_0", "g8_8", { mode: "longest", metric: "hops" })!;
  assert.equal(bounded.exact, false, "9 × 9 grid has far more simple routes than the search bound");
  assert.equal(new Set(bounded.nodes).size, bounded.nodes.length);
  assert.ok(bounded.total >= 16, "never worse than the shortest route (16 hops)");
  for (let i = 1; i < bounded.nodes.length; i++) {
    const [ax, ay] = bounded.nodes[i - 1].slice(1).split("_").map(Number), [bx, by] = bounded.nodes[i].slice(1).split("_").map(Number);
    assert.equal(Math.abs(ax - bx) + Math.abs(ay - by), 1, "consecutive nodes are grid neighbours");
  }
  const again = route(big, "g0_0", "g8_8", { mode: "longest", metric: "hops" })!;
  assert.deepEqual(again.nodes, bounded.nodes, "the bounded search is deterministic");
});

/* ------------------------------------------------------------------- faces */

const area = (points: readonly (readonly number[])[]) => points.reduce((sum, p, i) => sum + p[0] * points[(i + 1) % points.length][1] - points[(i + 1) % points.length][0] * p[1], 0) / 2;

test("a cycle bounds one counter-clockwise face and the outside is not a face", () => {
  const result = faces(SQUARE, SIDES);
  assert.equal(result.faces.length, 1);
  assert.deepEqual(result.faces[0].nodes, ["a", "b", "c", "d"]);
  assert.equal(result.faces[0].id, "face:a>b>c>d");
  near(result.faces[0].area, 100); near(area(result.faces[0].points), 100);
  assert.deepEqual(result.faces[0].edges, ["ab", "bc", "cd", "da"]);
  assert.equal(result.faces[0].closed, true); assert.equal(result.faces[0].level, 4);
  assert.deepEqual(result.crossingEdges, []);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.faces[0]) && Object.isFrozen(result.faces[0].points));
});

test("faces are identified by their boundary and survive changes elsewhere", () => {
  const one = faces(SQUARE, SIDES).faces[0];
  const shifted = faces([["z", 500, 500], ...SQUARE.map(([id, x, y]) => [id, x, y] as N), ["y", 600, 600]], [...SIDES, ["zy", "z", "y"]]).faces[0];
  assert.equal(shifted.id, one.id); assert.equal(shifted.seed, one.seed);
  assert.equal(faces([...SQUARE].reverse(), [...SIDES].reverse()).faces[0].id, one.id, "ids start at the smallest node id, whatever the listing order");
});

test("a diagonal splits a square into two triangles; the center of a wheel gives four", () => {
  const split = faces(SQUARE, [...SIDES, ["ac", "a", "c"]]);
  assert.deepEqual(split.faces.map((face) => [face.id, face.area]), [["face:a>b>c", 50], ["face:a>c>d", 50]]);
  const wheel = faces([...SQUARE, ["e", 5, 5]], [...SIDES, ["ea", "e", "a"], ["eb", "e", "b"], ["ec", "e", "c"], ["ed", "e", "d"]]);
  assert.equal(wheel.faces.length, 4);
  for (const face of wheel.faces) near(face.area, 25);
});

test("crossing diagonals never become faces, nor does the square they pierce", () => {
  const x = faces(SQUARE, [...SIDES, ["ac", "a", "c"], ["bd", "b", "d"]]);
  assert.deepEqual(x.crossingEdges, ["ac", "bd"]);
  assert.equal(x.faces.length, 0, "not the four quarter-triangles (the crossing is no node), not the square");
  assert.equal(x.rejected.crossed, 1);
  const one = faces(SQUARE, [...SIDES, ["ac", "a", "c"]]);
  assert.equal(one.faces.length, 2);
});

test("a concave face is filled exactly, and a crossing beside it does not disturb it", () => {
  const L: N[] = [["p0", 0, 0], ["p1", 20, 0], ["p2", 20, 10], ["p3", 10, 10], ["p4", 10, 20], ["p5", 0, 20]];
  const edges: E[] = L.map((_, i) => [`l${i}`, `p${i}`, `p${(i + 1) % 6}`]);
  const alone = faces(L, edges);
  assert.equal(alone.faces.length, 1); near(alone.faces[0].area, 300);
  const notch: N[] = [["q0", 12, 12], ["q1", 19, 19], ["q2", 12, 19], ["q3", 19, 12]];
  const withCrossing = faces([...L, ...notch], [...edges, ["x1", "q0", "q1"], ["x2", "q2", "q3"]]);
  assert.deepEqual(withCrossing.crossingEdges, ["x1", "x2"]);
  assert.equal(withCrossing.faces.length, 1, "the X sits in the notch's bounding box but outside the L");
  near(withCrossing.faces[0].area, 300);
  const inside: N[] = [["r0", 2, 2], ["r1", 8, 8], ["r2", 2, 8], ["r3", 8, 2]];
  const pierced = faces([...L, ...inside], [...edges, ["y1", "r0", "r1"], ["y2", "r2", "r3"]]);
  assert.equal(pierced.faces.length, 0, "an X inside the L makes it unfillable");
  assert.equal(pierced.rejected.crossed, 1);
  const chord = faces(L, [...edges, ["notch", "p2", "p4"]]);
  assert.deepEqual(chord.faces.map((face) => face.area).sort((a, b) => a - b), [50, 300]);
});

test("degenerate faces: pinches, bridges, dangling chains, islands and overlaps", () => {
  const twoSquares = faces([...SQUARE, ["e", 20, 10], ["f", 20, 20], ["g", 10, 20]], [...SIDES, ["ce", "c", "e"], ["ef", "e", "f"], ["fg", "f", "g"], ["gc", "g", "c"]]);
  assert.equal(twoSquares.faces.length, 2, "squares meeting at one node are both simple");
  const bridged = faces([...SQUARE, ["e", 30, 0], ["f", 40, 0], ["g", 40, 10], ["h", 30, 10]],
    [...SIDES, ["ef", "e", "f"], ["fg", "f", "g"], ["gh", "g", "h"], ["he", "h", "e"], ["bridge", "b", "e"]]);
  assert.equal(bridged.faces.length, 2); assert.equal(bridged.prunedEdges, 0);
  const dangling = faces([...SQUARE, ["t1", 4, 4], ["t2", 6, 6]], [...SIDES, ["st1", "a", "t1"], ["t1t2", "t1", "t2"]]);
  assert.equal(dangling.prunedEdges, 2); assert.equal(dangling.faces.length, 1); near(dangling.faces[0].area, 100);
  const island = faces([...SQUARE, ["i0", 4, 4], ["i1", 6, 4], ["i2", 6, 6], ["i3", 4, 6]],
    [...SIDES, ["ia", "i0", "i1"], ["ib", "i1", "i2"], ["ic", "i2", "i3"], ["id", "i3", "i0"]]);
  assert.deepEqual(island.faces.map((face) => face.area), [4], "the ring around an island has a hole, so only the island's own face is filled");
  assert.equal(island.rejected.island, 1);
  const tied = faces([...SQUARE, ["i0", 4, 4], ["i1", 6, 4], ["i2", 6, 6], ["i3", 4, 6]],
    [...SIDES, ["ia", "i0", "i1"], ["ib", "i1", "i2"], ["ic", "i2", "i3"], ["id", "i3", "i0"], ["tie", "a", "i0"]]);
  assert.deepEqual(tied.faces.map((face) => face.area), [4]);
  assert.equal(tied.rejected.pinched, 1, "a face reached over a bridge repeats its endpoints");
  const touching = faces([...SQUARE, ["m", 5, 0], ["k", 5, 5]], [...SIDES, ["mk", "m", "k"]]);
  assert.deepEqual(touching.crossingEdges, ["ab", "mk"], "a node resting on another edge's interior is a crossing");
  const overlap = faces([...SQUARE, ["h", 5, 0]], [...SIDES, ["ah", "a", "h"]]);
  assert.deepEqual(overlap.crossingEdges, ["ab", "ah"], "two edges leaving a node the same way overlap");
  const coincident = faces([...SQUARE, ["dup", 10, 0]], [...SIDES, ["zero", "b", "dup"]]);
  assert.ok(coincident.crossingEdges.includes("zero"));
});

test("a bounded planar lattice has E − V + 1 faces that tile its boundary", () => {
  const graph = lattice({ braid: 1, wobble: .6, rotation: 20 });
  const result = planarFaces(view(graph));
  assert.equal(result.faces.length, graph.edges.length - graph.nodes.length + 1);
  const position = new Map(graph.nodes.map((node) => [node.id, node.position]));
  const ring = [...Array.from({ length: 6 }, (_, c) => `n:${c}:0`), ...[1, 2, 3, 4].map((r) => `n:5:${r}`),
    ...[4, 3, 2, 1, 0].map((c) => `n:${c}:4`), ...[3, 2, 1].map((r) => `n:0:${r}`)].map((id) => position.get(id)!);
  near(result.faces.reduce((sum, face) => sum + face.area, 0), Math.abs(area(ring)), 1e-6);
  for (const face of result.faces) assert.ok(face.area > 0 && face.levelFraction >= 0 && face.levelFraction <= 1);
});

test("with diagonals, no face is pierced by any edge and none uses a crossing edge", () => {
  const graph = lattice({ braid: 1, diagonals: .5, wobble: .3, columns: 9, rows: 7 });
  const result = planarFaces(view(graph));
  assert.ok(result.crossingEdges.length > 0 && result.faces.length > 0);
  const crossing = new Set(result.crossingEdges);
  const position = new Map(graph.nodes.map((node) => [node.id, node.position]));
  const inside = (polygon: readonly (readonly number[])[], [x, y]: readonly number[]) => {
    let hit = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++)
      if ((polygon[i][1] > y) !== (polygon[j][1] > y) && x < (polygon[j][0] - polygon[i][0]) * (y - polygon[i][1]) / (polygon[j][1] - polygon[i][1]) + polygon[i][0]) hit = !hit;
    return hit;
  };
  for (const face of result.faces) {
    for (const id of face.edges) assert.ok(!crossing.has(id), `${face.id} is bounded by non-crossing edges only`);
    for (const edge of graph.edges) {
      const a = position.get(edge.from)!, b = position.get(edge.to)!;
      for (const t of [.25, .5, .75])
        if (!face.edges.includes(edge.id) && !face.nodes.includes(edge.from) && !face.nodes.includes(edge.to))
          assert.ok(!inside(face.points, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]), `${edge.id} runs through ${face.id}`);
    }
  }
});

test("face extraction stops at its work bound instead of answering partially", () => {
  const graph = lattice({ braid: 1, diagonals: .5, columns: 20, rows: 20 });
  assert.throws(() => planarFaces(view(graph), { maxWork: 200 }), /work bound of 200 steps/);
  assert.doesNotThrow(() => planarFaces(view(graph)));
});

/* ------------------------------------------------------------ consumers */

test("direction survives into edge paths, arrow markers and node roles", () => {
  const graph = withDirection(build([["a", 0, 0], ["b", 30, 40], ["c", 100, 0]], [["ba", "b", "a", .5, 2], ["bc", "b", "c", .5, 1]], false), true);
  const v = view(graph);
  const paths = edgePaths(v);
  assert.deepEqual(paths[0].points, [[30, 40], [0, 0]], "the path runs tail to head");
  assert.deepEqual(paths[1].points, [[30, 40], [100, 0]]);
  assert.equal(paths[0].level, 2); near(paths[0].levelFraction, 0); near(paths[1].levelFraction, .5);
  const markers = edgeMarkers(v, 10);
  near(markers[0].angle, Math.atan2(-40, -30)); near(markers[1].angle, Math.atan2(-40, 70));
  assert.deepEqual(markers[0].position, [15, 20]);
  assert.equal(markers[1].id, "bc/arrow");
  assert.equal(edgeMarkers(view(build([["p", 0, 0], ["q", 29, 0]], [["pq", "p", "q"]])), 10).length, 0, "an edge shorter than three markers gets none");
  assert.equal(edgeMarkers(view(build([["p", 0, 0], ["q", 31, 0]], [["pq", "p", "q"]])), 10).length, 1);
  const many = view(lattice({ braid: 1, columns: 12, rows: 10 }));
  const half = edgeMarkers(many, 5, () => 0, .5).map((site) => site.id), third = edgeMarkers(many, 5, () => 0, .3).map((site) => site.id);
  assert.ok(half.length > many.edges.length * .3 && half.length < many.edges.length * .7, `${half.length} of ${many.edges.length}`);
  assert.ok(third.every((id) => half.includes(id)), "raising the share only adds arrows");
  assert.equal(edgeMarkers(many, 5, () => 0, 0).length, 0);
  const big = view(lattice({ braid: 1, diagonals: 1, columns: 30, rows: 30, width: 900, height: 900 }));
  const capped = edgeMarkers(big, 5, () => 0, 1);
  assert.ok(big.edges.length > 2000 && capped.length <= 400 && capped.length > 300, `${capped.length} markers on ${big.edges.length} edges`);
  const sites = nodeSites(v, { scale: (node) => node.degree, tone: (node) => node.degree === 2 ? 2 : 0 });
  assert.deepEqual(sites.map((site) => [site.id, site.scale, site.tone]), [["a", 1, 0], ["b", 2, 2], ["c", 1, 0]]);
  assert.throws(() => nodeSites(v, { scale: () => 0 }), /must be positive/);
});

test("ordinary callbacks replace every role on the same frozen values", () => {
  const graph = lattice({ braid: .6, diagonals: .1, columns: 7, rows: 6 });
  const v = view(graph, { isolated: false });
  const seenEdges: string[] = [], seenNodes: string[] = [], seenFaces: string[] = [];
  const surface = new Log();
  strokeWith(surface, edgePaths(v), (_p, path) => { seenEdges.push(`${path.id}:${path.points.length}`); });
  atEach(surface, nodeSites(v), (_p, site) => { seenNodes.push(site.id); });
  strokeWith(surface, planarFaces(v).faces, (_p, face) => { seenFaces.push(face.id); });
  assert.deepEqual(seenEdges, v.edges.map((edge) => `${edge.id}:2`));
  assert.deepEqual(seenNodes, v.nodes.map((node) => node.id));
  assert.deepEqual(seenFaces, planarFaces(v).faces.map((face) => face.id));
  assert.equal(edgePaths(v)[0].points[0], edgePaths(v)[0].points[0], "positions are shared, not copied");
});

/* ------------------------------------------------------ the named instrument */

const input = (params: Record<string, string | number | boolean> = {}, seed = 42): InstrumentInput => {
  const item = createInstrument("graph-roles"); item.seed = seed; item.params = { ...item.params, ...params }; return item;
};

test("the typed descriptor is JSON and draws exactly what the instrument draws", () => {
  for (const params of [{}, { source: "contact", direction: "source" }, { source: "branches", route: "longest", metric: "hops" },
    { region: "annulus", arrows: false, edgeMaterial: "beads", routeMaterial: "stitch" }]) {
    const item = input(params);
    const recipe = referenceComposition(item);
    assert.equal(recipe.kind, "graph");
    const revived = JSON.parse(JSON.stringify(recipe)) as GraphComposition & { kind: "graph" };
    assert.deepEqual(revived, recipe, "no functions or shared state inside the descriptor");
    const direct = new Log(); drawReferenceComposition(direct, revived);
    const named = new Log();
    (named as unknown as Record<string, unknown>).background = undefined;
    drawGraphComposition(named, revived);
    assert.deepEqual(direct.calls, named.calls);
    assert.ok(direct.calls.length > 20);
  }
});

test("appearance edits reuse the same graph, view and faces; route edits reuse graph and faces", () => {
  const base = referenceComposition(input()) as GraphComposition & { kind: "graph" };
  const one = graphStructure(base);
  const styled = referenceComposition(input({ edgeMaterial: "stitch", nodeMark: "rings", faceTint: "varied", routeWeight: 6, edgeTone: "flat", faceOpacity: .2 })) as GraphComposition & { kind: "graph" };
  const two = graphStructure({ ...styled, palette: [0x111111, 0x222222] });
  assert.equal(two.graph, one.graph); assert.equal(two.view, one.view); assert.equal(two.route, one.route);
  assert.equal(two.faces, one.faces);
  const moved = graphStructure(referenceComposition(input({ endX: 300, endY: 200 })) as GraphComposition & { kind: "graph" });
  assert.equal(moved.graph, one.graph); assert.equal(moved.view, one.view); assert.equal(moved.faces, one.faces);
  assert.notDeepEqual(moved.route!.nodes, one.route!.nodes);
  const filtered = graphStructure(referenceComposition(input({ minWeight: .3 })) as GraphComposition & { kind: "graph" });
  assert.equal(filtered.graph, one.graph);
  assert.notEqual(filtered.view, one.view);
  const seeded = graphStructure(referenceComposition(input({}, 43)) as GraphComposition & { kind: "graph" });
  assert.notEqual(seeded.graph, one.graph);
});

test("thin support and bold focal route are separately editable; endpoints toggle on their own", () => {
  const base = drawFingerprint(input());
  const thin = (params: Record<string, string | number | boolean>) => drawFingerprint(input(params));
  assert.notEqual(thin({ routeWeight: 6 }), base, "the route restyles");
  assert.notEqual(thin({ edgeWeight: 2 }), base, "the support restyles");
  const routeLog = (params: Record<string, string | number | boolean>) => { const log = new Log(); drawReferenceComposition(log, referenceComposition(input(params))); return log; };
  const strokeCalls = (log: Log) => log.calls.filter((call) => call[0] === "strokeWeight").map((call) => call[1]);
  const heavy = strokeCalls(routeLog({ routeWeight: 6, edgeWeight: .4 })), light = strokeCalls(routeLog({ routeWeight: 2, edgeWeight: .4 }));
  assert.equal(heavy.filter((w) => w === 6).length, 1, "exactly one route stroke, at the route's weight");
  assert.equal(light.filter((w) => w === 6).length, 0);
  assert.equal(heavy.filter((w) => w === .4).length, light.filter((w) => w === .4).length, "the support drew the same edges");
  const circles = (log: Log) => log.calls.filter((call) => call[0] === "circle").length;
  assert.equal(circles(routeLog({ endpoints: true })) - circles(routeLog({ endpoints: false })), 4, "each endpoint ring is two circles");
  assert.equal(circles(routeLog({ route: "off" })), circles(routeLog({ endpoints: false })), "route off draws no endpoints");
  const noSupport = routeLog({ edgeRetention: 0, faces: false, nodeSize: 0, endpoints: false });
  assert.equal(strokeCalls(noSupport).length, 1, "with the support omitted only the route remains");
});

test("isolated nodes appear only when asked, and never gain edges", () => {
  const sparse = { source: "contact", radius: 25, agents: 60, faces: false };
  const count = (params: Record<string, string | number | boolean>) => graphStructure(referenceComposition(input({ ...sparse, ...params })) as GraphComposition & { kind: "graph" }).view;
  const without = count({ isolated: false }), withAll = count({ isolated: true });
  assert.equal(withAll.nodes.length, 60);
  assert.ok(without.nodes.length < 45, `${without.nodes.length} nodes touch an edge`);
  assert.deepEqual(withAll.edges.map((edge) => edge.id), without.edges.map((edge) => edge.id));
  const dots = (isolated: boolean) => { const log = new Log(); drawReferenceComposition(log, referenceComposition(input({ ...sparse, isolated, route: "off" }))); return log.calls.filter((call) => call[0] === "circle").length; };
  assert.equal(dots(true) - dots(false), 60 - without.nodes.length);
});

test("the default roles keep every connected node, however dense the network", () => {
  const dense = graphStructure(referenceComposition(input({ source: "contact", agents: 120, ticks: 120, radius: 90, faces: false })) as GraphComposition & { kind: "graph" });
  assert.ok(dense.graph.stats.maxDegree > 60, "a near-complete graph has degrees far beyond any slider limit");
  assert.equal(dense.view.edges.length, dense.graph.edges.length);
  assert.equal(dense.view.nodes.length, dense.graph.nodes.filter((node) => node.degree > 0).length);
});

test("faces drawn by the instrument are exactly the valid planar faces", () => {
  const item = input({ braid: 1, diagonals: .5, wobble: .3, columns: 9, rows: 7, faceRetention: 1, faceOpacity: 1, faceMaxArea: 1e6, region: "rectangle", blocked: 0 });
  const recipe = referenceComposition(item) as GraphComposition & { kind: "graph" };
  const structure = graphStructure(recipe);
  const log = new Log(); drawReferenceComposition(log, recipe);
  const polygons = log.polygons.map((polygon) => JSON.stringify(polygon));
  assert.deepEqual(polygons, structure.faces.map((face) => JSON.stringify(face.points.map((point) => [...point]))));
  assert.ok(structure.faces.length > 10 && planarFaces(structure.view).crossingEdges.length > 0);
  const strict = input({ braid: 1, diagonals: 1, wobble: 0, columns: 6, rows: 5, faceRetention: 1, region: "rectangle", blocked: 0 });
  const full = new Log(); drawReferenceComposition(full, referenceComposition(strict));
  assert.equal(full.polygons.length, 0, "every cell has both diagonals, so nothing is a face");
  const off = new Log(); drawReferenceComposition(off, referenceComposition(input({ faces: false })));
  assert.equal(off.polygons.length, 0);
});

test("face area limits and retention leave faces open without moving the rest", () => {
  const base = { braid: 1, diagonals: 0, wobble: 0, columns: 8, rows: 6, region: "rectangle", blocked: 0, faceOpacity: 1, faceRetention: 1, faceMaxArea: 1e6 };
  const count = (params: Record<string, string | number | boolean>) => { const log = new Log(); drawReferenceComposition(log, referenceComposition(input({ ...base, ...params }))); return log.polygons.length; };
  assert.equal(count({}), 7 * 5);
  const cell = 500 / 7 * 420 / 5;
  assert.equal(count({ faceMinArea: cell + 1 }), 0);
  assert.equal(count({ faceMaxArea: cell - 1 }), 0);
  assert.equal(count({ faceMinArea: cell - 1, faceMaxArea: cell + 1 }), 35);
  assert.equal(count({ faceRetention: 0 }), 0);
  const some = count({ faceRetention: .5 });
  assert.ok(some > 5 && some < 30, `${some} of 35 kept`);
  assert.equal(count({ faceRetention: .5 }), some, "the same seed keeps the same faces");
});

test("seed dependence is declared honestly", () => {
  const still = input({ source: "contact", disorder: 0, speed: 0, edgeRetention: 1, faceRetention: 1 });
  assert.equal(usesSeed(still), false);
  assert.equal(drawFingerprint({ ...still, seed: 1 }), drawFingerprint({ ...still, seed: 2 }));
  const moving = input({ source: "contact", disorder: 0, speed: .5 });
  assert.equal(usesSeed(moving), true);
  assert.notEqual(drawFingerprint({ ...moving, seed: 1 }), drawFingerprint({ ...moving, seed: 2 }));
  assert.equal(usesSeed(input({ source: "lattice" })), true);
  assert.notEqual(drawFingerprint(input({}, 1)), drawFingerprint(input({}, 2)));
  const trees = input({ source: "branches", survival: 1, angleSpread: 0, edgeRetention: 1, faceRetention: 1 });
  assert.equal(usesSeed(trees), false);
  assert.equal(drawFingerprint({ ...trees, seed: 3 }), drawFingerprint({ ...trees, seed: 4 }));
  assert.equal(usesSeed(input({ source: "branches", faceRetention: .5 })), true);
});

test("appearance edits never move structure: palette, materials and tints keep every position", () => {
  const nodesOf = (item: InstrumentInput) => graphStructure(referenceComposition(item) as GraphComposition & { kind: "graph" }).view.nodes.map((node) => [node.id, node.position]);
  const base = nodesOf(input());
  assert.deepEqual(nodesOf({ ...input({ edgeMaterial: "beads", routeMaterial: "stitch", nodeMark: "rosette", faceTint: "flat", edgeTone: "weight" }), palette: [0xffffff, 0x000000] }), base);
});

test("the instrument rejects inverted ranges and unbounded work, and its limits are real", () => {
  const rejects = (params: Record<string, string | number | boolean>, pattern: RegExp) => assert.throws(() => validateInstrument(input(params)), pattern);
  rejects({ minDegree: 5, maxDegree: 3 }, /degree range is inverted/);
  assert.doesNotThrow(() => validateInstrument(input({ minDegree: 5, maxDegree: 0 })), "zero is no upper limit");
  rejects({ minWeight: .8, maxWeight: .2 }, /weight range is inverted/);
  rejects({ minAge: .9, maxAge: .1 }, /age range is inverted/);
  rejects({ faceMinArea: 500, faceMaxArea: 100 }, /Face area range is inverted/);
  rejects({ source: "branches", roots: 24, generations: 9, children: "3" }, /could grow .* segments/);
  rejects({ source: "contact", agents: 160, ticks: 180 }, /pair-work budget/);
  rejects({ columns: 61 }, /between 2 and 60/);
  rejects({ nodeScaleAmount: 1 }, /between 0 and 0.95/);
  assert.doesNotThrow(() => validateInstrument(input({ source: "branches", roots: 6, generations: 6, children: "3" })));
  const dense = input({ columns: 60, rows: 60, braid: 1, diagonals: 1, region: "rectangle", blocked: 0, edgeMaterial: "beads", edgeSpacing: 4 });
  assert.throws(() => drawReferenceComposition(new Log(), referenceComposition(dense)), /work budget exceeded/);
});

/* ------------------------------------------- bridge from the attractor branch tree */

const growth = (patch: Partial<BranchTreeOptions> = {}): BranchTreeOptions => ({ ...branchOrnamentComposition(createInstrument("branch-ornament")).tree, ...patch });

test("graphFromBranchTree keeps the tree's nodes, edges, ids, seeds, positions and trunk → tip direction", () => {
  const tree = branchTree(growth()), graph = graphFromBranchTree(tree);
  assert.ok(tree.edges.length > 10 && tree.nodes.length === tree.edges.length + tree.roots);
  assert.equal(graph.nodes.length, tree.nodes.length); assert.equal(graph.edges.length, tree.edges.length);
  assert.equal(graph.directed, true); assert.equal(graphFromBranchTree(tree, { directed: false }).directed, false);
  assert.deepEqual(graph.nodes.map((node) => node.id), tree.nodes.map((node) => node.id));
  assert.deepEqual(graph.edges.map((edge) => [edge.id, edge.from, edge.to]), tree.edges.map((edge) => [edge.id, edge.from, edge.to]));
  graph.nodes.forEach((node, i) => { assert.deepEqual(node.position, tree.nodes[i].position); assert.equal(node.seed, tree.nodes[i].seed); });
  graph.edges.forEach((edge, i) => assert.equal(edge.seed, tree.edges[i].seed));
  const incoming = new Map<string, number>();
  for (const edge of graph.edges) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  assert.ok([...incoming.values()].every((count) => count === 1), "every node has at most one parent edge: a forest directed away from the trunks");
  assert.ok(Object.isFrozen(graph) && Object.isFrozen(graph.edges[0]));
});

test("branch-tree roles are the degree classes: trunk = source, terminal = sink, fork = degree 3+", () => {
  const tree = branchTree(growth()), graph = graphFromBranchTree(tree);
  const out = new Map<string, number>(), inn = new Map<string, number>();
  for (const edge of graph.edges) { out.set(edge.from, (out.get(edge.from) ?? 0) + 1); inn.set(edge.to, (inn.get(edge.to) ?? 0) + 1); }
  const counts = { trunk: 0, fork: 0, terminal: 0 };
  for (const node of graph.nodes) {
    const role = (inn.get(node.id) ?? 0) === 0 ? "trunk" : (out.get(node.id) ?? 0) === 0 ? "terminal" : "fork";
    assert.equal(role, tree.nodes.find((item) => item.id === node.id)!.role, node.id);
    if (role === "fork") assert.ok(node.degree >= 3 && (out.get(node.id) ?? 0) >= 2); else assert.equal(node.degree, 1);
    counts[role]++;
  }
  assert.equal(counts.trunk, tree.roots);
  assert.ok(counts.fork > 0 && counts.terminal > counts.fork, "a branching tree has more tips than forks");
});

test("branch-tree weight is the terminal share of the tree and age is older toward the trunk", () => {
  const tree = branchTree(growth()), graph = graphFromBranchTree(tree);
  const byId = new Map(tree.edges.map((edge) => [edge.id, edge]));
  const tips = (id: string): number => byId.get(id)!.children.length === 0 ? 1 : byId.get(id)!.children.reduce((sum, child) => sum + tips(child), 0);
  const total = new Map<number, number>();
  for (const edge of tree.edges) if (edge.parent === null) total.set(edge.tree, tips(edge.id));
  const lastTick = Math.max(...tree.edges.map((edge) => edge.age));
  for (const edge of graph.edges) {
    const source = byId.get(edge.id)!;
    near(edge.weight, tips(edge.id) / total.get(source.tree)!, 1e-12);
    assert.equal(edge.age, lastTick - source.age + 1);
    if (source.parent) {
      assert.ok(edge.weight <= graph.edges.find((item) => item.id === source.parent)!.weight + 1e-12);
      assert.ok(edge.age < graph.edges.find((item) => item.id === source.parent)!.age, "a child edge is younger than its parent");
    } else near(edge.weight, 1);
  }
  assert.ok(graph.edges.some((edge) => edge.age === 1), "the newest edge has age 1");
  assert.equal(graph.stats.maxAge, lastTick - Math.min(...tree.edges.map((edge) => edge.age)) + 1);
});

test("branch-tree graph ids survive more growth ticks and any routing", () => {
  const short = graphFromBranchTree(branchTree(growth({ ticks: 20 }))), long = graphFromBranchTree(branchTree(growth({ ticks: 30 })));
  const longNodes = new Map(long.nodes.map((node) => [node.id, node])), longEdges = new Map(long.edges.map((edge) => [edge.id, edge]));
  assert.ok(long.edges.length > short.edges.length);
  for (const node of short.nodes) { assert.ok(longNodes.has(node.id), `${node.id} survives`); assert.equal(longNodes.get(node.id)!.seed, node.seed); }
  for (const edge of short.edges) assert.deepEqual([longEdges.get(edge.id)!.from, longEdges.get(edge.id)!.to], [edge.from, edge.to]);
  const grown = graphFromBranchTree(branchTree(growth({ routing: "grown" }))), straight = graphFromBranchTree(branchTree(growth({ routing: "straight" })));
  assert.deepEqual(straight.nodes.map((node) => [node.id, node.position]), grown.nodes.map((node) => [node.id, node.position]));
  assert.deepEqual(straight.edges.map((edge) => edge.id), grown.edges.map((edge) => edge.id));
  assert.deepEqual(graphFromBranchTree(branchTree(growth({ ticks: 0 }))).nodes, [], "the empty tree is the empty graph");
});

test("graph roles work on a branch tree: filters, a directed route, and no faces in a forest", () => {
  const graph = graphFromBranchTree(branchTree(growth())), everything = view(graph);
  const tip = graph.nodes.find((node) => node.degree === 1 && graph.edges.some((edge) => edge.to === node.id))!;
  const trunk = graph.nodes.find((node) => !graph.edges.some((edge) => edge.to === node.id))!;
  const found = graphRoute(everything, { from: trunk.id, to: tip.id, mode: "shortest", metric: "hops", followDirection: true })!;
  assert.equal(found.nodes[0], trunk.id); assert.equal(found.nodes.at(-1), tip.id);
  const ages = found.edges.map((id) => graph.edges.find((edge) => edge.id === id)!.age);
  assert.deepEqual(ages, [...ages].sort((a, b) => b - a), "walking trunk to tip goes from old to young");
  assert.equal(graphRoute(everything, { from: tip.id, to: trunk.id, mode: "shortest", metric: "hops", followDirection: true }), null, "cannot walk tip to trunk against direction");
  assert.deepEqual(planarFaces(everything).faces, []);
  assert.ok(view(graph, { minWeight: .5, isolated: false }).edges.every((edge) => edge.weight >= .5 * graph.stats.maxEdgeWeight - 1e-12));
});
