import assert from "node:assert/strict";
import test from "node:test";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";
import {
  MAX_BUNDLED_EDGES, bundleEdges, bundledRelationsComposition, bundledStructure, canPrepareInstrument, createCompositionRun, createInstrument,
  dataTable, drawBundledRelations, drawInstrument, graphFromParts, groupBands, highlightedEdges, layoutEndpoints, pathMarkers, prepareInstrument, relationColumns,
  relationSample, relationSampleIds, relationsFromTables, selectRelations, usesSeed, validateInstrument,
  type BundleOptions, type BundledEdges, type BundledRelationsRecipe, type CompositionSurface, type DrawingContext, type EndpointLayout, type EndpointLayoutOptions,
  type GraphRoleOptions, type GroupAssignment, type InstrumentInput, type Point,
} from "../dist/index.js";

const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const nearPoint = (actual: Point, expected: Point, tolerance = 1e-9) => { near(actual[0], expected[0], tolerance); near(actual[1], expected[1], tolerance); };
const ALL: GraphRoleOptions = { minDegree: 0, maxDegree: 60_000, minWeight: 0, maxWeight: 1, minAge: 0, maxAge: 1, isolated: true };
const FRAME = { centerX: 0, centerY: 0, width: 200, height: 200, rotation: 0 };
const circle = (extra: Partial<Extract<EndpointLayoutOptions, { kind: "circle" }>> = {}): EndpointLayoutOptions =>
  ({ kind: "circle", frame: FRAME, startAngle: 0, gap: 0, sectorBy: "count", order: "table", ...extra });
const BUNDLE: BundleOptions = { strength: 1, inset: .5, lift: .5, separation: .3, detail: 6, families: "pair" };

/** Four groups of two nodes; edges chosen so families are parallel, opposite and disjoint. */
function fixture(directed = true, edgeOrder?: readonly number[]) {
  const nodes = ["a1", "a2", "b1", "b2", "c1", "c2", "d1", "d2"].map((id) => ({ id, position: [0, 0] as const }));
  const all = [
    { id: "ab-1", from: "a1", to: "b1", weight: 1 }, { id: "ab-2", from: "a2", to: "b2", weight: .5 },   // parallel: same family
    { id: "ba-1", from: "b2", to: "a1", weight: .8 },                                                   // opposite: B → A
    { id: "cd-1", from: "c1", to: "d1", weight: .6 },                                                   // unrelated family (C, D)
    { id: "ac-1", from: "a2", to: "c1", weight: .4 }, { id: "aa-1", from: "a1", to: "a2", weight: .3 }, // A–C and inside A
  ].map((edge) => ({ ...edge, age: 1 }));
  const edges = edgeOrder ? edgeOrder.map((i) => all[i]) : all;
  const graph = graphFromParts({ seed: 7, directed, nodes, edges });
  const groups: GroupAssignment = { column: "g", names: ["A", "B", "C", "D"], groupOf: [0, 0, 1, 1, 2, 2, 3, 3] };
  return { graph, groups };
}
const laidOut = (options: EndpointLayoutOptions = circle(), directed = true, edgeOrder?: readonly number[]) => layoutEndpoints(fixture(directed, edgeOrder), options);
const bundle = (layout: EndpointLayout, options: Partial<BundleOptions> = {}, retention = 1) =>
  bundleEdges(layout, selectRelations(layout, ALL, { scope: "all", retention }), { ...BUNDLE, ...options });
const pathOf = (result: BundledEdges, id: string) => result.paths.find((path) => path.id === id)!;
const nodeAt = (layout: EndpointLayout, id: string) => layout.graph.nodes.find((node) => node.id === id)!.position;

test("circle layout: nodes lie on the ring, sectors keep declared order and are proportional to their size, gaps are exact", () => {
  const graph = graphFromParts({ seed: 1, nodes: ["p", "q", "r", "s", "t", "u"].map((id) => ({ id, position: [0, 0] as const })), edges: [] });
  const groups: GroupAssignment = { column: "g", names: ["one", "two", "three"], groupOf: [0, 0, 0, 1, 2, 2] };  // sizes 3, 1, 2
  const layout = layoutEndpoints({ graph, groups }, circle({ gap: .3, startAngle: -90 }));
  const gap = .3 * 2 * Math.PI / 3, room = 2 * Math.PI - 3 * gap;
  const spans = layout.placements.map((placement) => placement.span[1] - placement.span[0]);
  spans.forEach((span, index) => near(span, room * [3, 1, 2][index] / 6));
  near(layout.placements[0].span[0], -Math.PI / 2 + gap / 2);
  near(layout.placements[1].span[0] - layout.placements[0].span[1], gap);
  near(layout.placements[2].span[0] - layout.placements[1].span[1], gap);
  layout.graph.nodes.forEach((node) => near(Math.hypot(node.position[0], node.position[1]), 100));
  // Within the first sector the three nodes take equal slots at (k + 1/2)/3 of the span.
  const [start] = layout.placements[0].span;
  layout.placements[0].nodes.forEach((id, k) => {
    const theta = start + (k + .5) / 3 * spans[0];
    nearPoint(nodeAt(layout, id), [100 * Math.cos(theta), 100 * Math.sin(theta)]);
  });
  // An ellipse footprint scales each axis independently; rotation turns everything about the center.
  const wide = layoutEndpoints({ graph, groups }, { ...circle(), frame: { ...FRAME, width: 300, height: 100, rotation: 90 } });
  const plain = layoutEndpoints({ graph, groups }, { ...circle(), frame: { ...FRAME, width: 300, height: 100 } });
  layout.graph.nodes.forEach((_, i) => nearPoint(wide.graph.nodes[i].position, [-plain.graph.nodes[i].position[1], plain.graph.nodes[i].position[0]]));
});

test("sectors sized by flow follow each group's total flow, and an empty group takes no place", () => {
  const nodes = ["x", "y", "z"].map((id) => ({ id, position: [0, 0] as const }));
  const graph = graphFromParts({ seed: 1, nodes, edges: [{ id: "e1", from: "x", to: "y", weight: 1, age: 1 }, { id: "e2", from: "y", to: "z", weight: 1, age: 1 }] });
  const groups: GroupAssignment = { column: "g", names: ["hub", "unused", "leaves"], groupOf: [0, 0, 2] };
  const layout = layoutEndpoints({ graph, groups }, circle({ sectorBy: "flow" }));
  assert.deepEqual(layout.placements.map((placement) => placement.name), ["hub", "leaves"]);
  // node weights: x = 1, y = 2, z = 1; a quarter of the mean (4/3) is added per node so isolated places keep a slot.
  const floor = (4 / 3) * .25, hub = 1 + 2 + 2 * floor, leaves = 1 + floor;
  near(layout.placements[0].span[1] - layout.placements[0].span[0], 2 * Math.PI * hub / (hub + leaves));
});

test("line layout sits on the frame's bottom edge, and graph layout keeps or fits the source positions", () => {
  const line = laidOut({ kind: "line", frame: FRAME, gap: 0, sectorBy: "count", order: "table" });
  line.graph.nodes.forEach((node, i) => { near(node.position[1], 100); near(node.position[0], -100 + (i + .5) * 25); });
  assert.deepEqual(line.up, [0, -1]);
  const turned = laidOut({ kind: "line", frame: { ...FRAME, rotation: 90 }, gap: 0, sectorBy: "count", order: "table" });
  nearPoint(turned.up!, [1, 0]);
  const sample = relationSample("ferries");
  const relations = relationsFromTables(sample.nodes, sample.edges, relationColumns, { seed: 3, directed: true });
  const kept = layoutEndpoints(relations, { kind: "graph", frame: FRAME, fit: false });
  kept.graph.nodes.forEach((node, i) => assert.deepEqual(node.position, relations.graph.nodes[i].position));
  const fitted = layoutEndpoints(relations, { kind: "graph", frame: { ...FRAME, centerX: 300, centerY: 200, width: 400, height: 120 }, fit: true });
  const xs = fitted.graph.nodes.map((node) => node.position[0]), ys = fitted.graph.nodes.map((node) => node.position[1]);
  near(Math.min(...xs), 100); near(Math.max(...xs), 500); near(Math.min(...ys), 140); near(Math.max(...ys), 260);
  // The layout replaces positions only: ids, seeds, edges, weights and lengths follow the new positions.
  assert.deepEqual(fitted.graph.edges.map((edge) => [edge.id, edge.seed, edge.weight]), relations.graph.edges.map((edge) => [edge.id, edge.seed, edge.weight]));
});

test("order within a group: largest flow first, a seeded permutation, and by partners", () => {
  const fx = fixture();
  const flow = layoutEndpoints(fx, circle({ order: "flow" }));
  // a1 carries ab-1 (1) + ba-1 (.8) + aa-1 (.3); a2 carries ab-2 (.5) + ac-1 (.4) + aa-1 (.3): a1 first.
  assert.deepEqual(flow.placements[0].nodes, ["a1", "a2"]);
  const heavyLast = { ...fx, graph: graphFromParts({ seed: 7, directed: true, nodes: fx.graph.nodes.map((n) => ({ id: n.id, position: n.position })),
    edges: fx.graph.edges.map((e) => ({ ...e, weight: e.id === "ab-2" ? 1 : e.id === "ab-1" ? .1 : e.weight })) }) };
  assert.deepEqual(layoutEndpoints(heavyLast, circle({ order: "flow" })).placements[0].nodes, ["a2", "a1"]);
  const orders = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => layoutEndpoints({ ...fx, graph: graphFromParts({ seed, directed: true, nodes: fx.graph.nodes.map((n) => ({ id: n.id, position: n.position })),
    edges: fx.graph.edges.map((e) => ({ id: e.id, from: e.from, to: e.to, weight: e.weight, age: e.age })) }) }, circle({ order: "shuffled" })).placements[0].nodes.join());
  assert.ok(orders.every((order) => order === "a1,a2" || order === "a2,a1"));
  assert.ok(new Set(orders).size === 2, "a new seed re-deals the order");
  const again = layoutEndpoints(fx, circle({ order: "shuffled" })).placements[0].nodes.join();
  assert.equal(again, layoutEndpoints(fx, circle({ order: "shuffled" })).placements[0].nodes.join(), "the same seed gives the same order");
  // Partners: in group C, c2 links only to the group before it (A is two sectors counter-clockwise), c1 only to D (the next one clockwise).
  const nodes = fx.graph.nodes.map((n) => ({ id: n.id, position: n.position }));
  const pulled = graphFromParts({ seed: 7, directed: true, nodes, edges: [
    { id: "c2-a", from: "c2", to: "a1", weight: 1, age: 1 }, { id: "c1-d", from: "c1", to: "d1", weight: 1, age: 1 }] });
  const groups = fx.groups;
  assert.deepEqual(layoutEndpoints({ graph: pulled, groups }, circle({ order: "table" })).placements[2].nodes, ["c1", "c2"]);
  assert.deepEqual(layoutEndpoints({ graph: pulled, groups }, circle({ order: "partners" })).placements[2].nodes, ["c2", "c1"]);
});

test("bundle strength 0 is exactly the straight edge between the two endpoint positions", () => {
  const layout = laidOut();
  const straight = bundle(layout, { strength: 0 });
  assert.equal(straight.paths.length, 6);
  for (const path of straight.paths) {
    assert.deepEqual(path.points, [nodeAt(layout, path.from), nodeAt(layout, path.to)], path.id);
    assert.equal(path.closed, false);
  }
  // A tiny strength already bends the edge, continuously: the deviation grows in proportion to the strength.
  const deviation = (strength: number) => {
    const routed = pathOf(bundle(layout, { strength }), "ab-1");
    const [a, b] = [routed.points[0], routed.points[routed.points.length - 1]];
    return Math.max(...routed.points.map(([x, y]) => Math.abs((b[0] - a[0]) * (a[1] - y) - (a[0] - x) * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1])));
  };
  assert.ok(deviation(.01) > 0 && deviation(.01) < deviation(.5));
  near(deviation(.5) / deviation(.25), 2, 1e-6);
  near(deviation(1) / deviation(.5), 2, 1e-6);
});

test("routes are linear in bundle strength (Holten's straightening) and always end on the endpoint nodes exactly", () => {
  const layout = laidOut();
  for (const id of ["ab-1", "ab-2", "ba-1", "cd-1", "ac-1", "aa-1"]) {
    const [quarter, half, three, full] = [.25, .5, .75, 1].map((strength) => pathOf(bundle(layout, { strength }), id));
    assert.equal(quarter.points.length, full.points.length);
    half.points.forEach((point, i) => nearPoint(point, [(quarter.points[i][0] + three.points[i][0]) / 2, (quarter.points[i][1] + three.points[i][1]) / 2]));
    for (const routed of [quarter, half, three, full]) {
      assert.deepEqual(routed.points[0], nodeAt(layout, routed.from));
      assert.deepEqual(routed.points[routed.points.length - 1], nodeAt(layout, routed.to));
    }
  }
});

test("a B-spline stays inside the convex hull of its control polygon: every routed vertex is inside the ring", () => {
  const layout = laidOut();
  for (const path of bundle(layout, { strength: 1, lift: 1, inset: 1 }).paths)
    for (const [x, y] of path.points) assert.ok(Math.hypot(x, y) <= 100 + 1e-9, `${path.id} leaves the ring`);
});

test("only edges that join the same two groups share a bundle; opposite and parallel edges keep their identity", () => {
  const layout = laidOut();
  const pair = bundle(layout, { families: "pair" });
  const families = Object.fromEntries(pair.bundles.map((b) => [b.id, [...b.edges]]));
  assert.deepEqual(families, { "0-0": ["aa-1"], "0-1": ["ab-1", "ab-2", "ba-1"], "0-2": ["ac-1"], "2-3": ["cd-1"] });
  // Unrelated families (A–B and C–D) share no waypoint at all.
  const waypoints = (id: string) => pair.bundles.find((b) => b.id === id)!.waypoints.map(([x, y]) => `${x},${y}`);
  assert.equal(waypoints("0-1").filter((w) => waypoints("2-3").includes(w)).length, 0);
  // Edges of one family share exactly the same waypoint list.
  assert.equal(pair.bundles.find((b) => b.id === "0-1")!.waypoints.length, 3);
  // Directed families separate the opposite flow, B → A, from A → B; parallel edges stay together.
  const directed = bundle(layout, { families: "directed" });
  assert.deepEqual(Object.fromEntries(directed.bundles.map((b) => [b.id, [...b.edges]])), { "0-0": ["aa-1"], "0>1": ["ab-1", "ab-2"], "0>2": ["ac-1"], "1>0": ["ba-1"], "2>3": ["cd-1"] });
  const forward = directed.bundles.find((b) => b.id === "0>1")!.waypoints, backward = directed.bundles.find((b) => b.id === "1>0")!.waypoints;
  assert.ok(forward.every((w, i) => Math.hypot(w[0] - backward[i][0], w[1] - backward[i][1]) > 1e-6 || i === 1), "opposite bundles run side by side, not on top of each other");
  // Identity: ids, seeds, endpoints and direction come from the graph's edges.
  for (const path of directed.paths) {
    const edge = layout.graph.edges.find((e) => e.id === path.id)!;
    assert.equal(path.edge, edge.id); assert.equal(path.seed, edge.seed); assert.equal(path.from, edge.from); assert.equal(path.to, edge.to);
  }
  assert.throws(() => bundle(laidOut(circle(), false), { families: "directed" }), /directed graph/);
});

test("a route depends on its own edge only: dropping unrelated edges, reordering or selecting leaves every route bit-identical", () => {
  const full = bundle(laidOut());
  const reversed = bundle(laidOut(circle(), true, [5, 4, 3, 2, 1, 0]));
  for (const path of reversed.paths) assert.deepEqual(path.points, pathOf(full, path.id).points, path.id);
  // Retention-selected subsets keep exactly the routes they keep, and keep them for every strength.
  const layout = laidOut();
  for (const retention of [.3, .45]) {
    const some = bundle(layout, {}, retention);
    assert.ok(some.paths.length < full.paths.length);
    for (const path of some.paths) assert.deepEqual(path.points, pathOf(full, path.id).points, path.id);
  }
  // A graph holding only the C–D edge routes it identically (the other families cannot have influenced it).
  const only = graphFromParts({ seed: 7, directed: true, nodes: fixture().graph.nodes.map((n) => ({ id: n.id, position: n.position })), edges: [{ id: "cd-1", from: "c1", to: "d1", weight: .6, age: 1 }] });
  const alone = layoutEndpoints({ graph: only, groups: fixture().groups }, circle());
  assert.deepEqual(pathOf(bundle(alone), "cd-1").points, pathOf(full, "cd-1").points);
});

test("bundling gathers a family: its edges are far closer together mid-route than at their endpoints, unrelated families are not pulled in", () => {
  const sample = relationSample("commuters");
  const relations = relationsFromTables(sample.nodes, sample.edges, relationColumns, { seed: 1, directed: true });
  const layout = layoutEndpoints(relations, { kind: "circle", frame: { ...FRAME, width: 400, height: 400 }, startAngle: -90, gap: .06, sectorBy: "count", order: "partners" });
  const view = selectRelations(layout, ALL, { scope: "between", retention: 1 });
  const result = bundleEdges(layout, view, { strength: 1, inset: .6, lift: .5, separation: .1, detail: 8, families: "pair" });
  const middle = (path: { points: readonly Point[] }) => path.points[Math.floor(path.points.length / 2)];
  const spread = (points: readonly Point[]) => Math.max(...points.flatMap((p) => points.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))));
  let checked = 0;
  for (const b of result.bundles) {
    if (b.edges.length < 4) continue;
    const members = result.paths.filter((path) => b.edges.includes(path.id));
    const ends = spread(members.flatMap((path) => [path.points[0], path.points[path.points.length - 1]]));
    assert.ok(spread(members.map(middle)) < .25 * ends, `${b.id} is not gathered`);
    checked++;
  }
  assert.ok(checked >= 4);
  // The straight drawing does not gather: mid-route spread of the same family stays about as wide as its ends.
  const straight = bundleEdges(layout, view, { strength: 0, inset: .6, lift: .5, separation: .1, detail: 8, families: "pair" });
  const widest = result.bundles.reduce((a, b) => a.edges.length >= b.edges.length ? a : b);
  const members = straight.paths.filter((path) => widest.edges.includes(path.id));
  assert.ok(spread(members.map(middle)) > .4 * spread(members.flatMap((path) => [path.points[0], path.points[path.points.length - 1]])));
});

test("edge selection: scope partitions the edges, retention only adds edges as it rises, weight is a fraction of the graph maximum", () => {
  const layout = laidOut();
  const ids = (options: Parameters<typeof selectRelations>[2], roles = ALL) => selectRelations(layout, roles, options).edges.map((edge) => edge.id);
  assert.deepEqual(ids({ scope: "within", retention: 1 }), ["aa-1"]);
  assert.deepEqual(ids({ scope: "between", retention: 1 }), ["ab-1", "ab-2", "ba-1", "cd-1", "ac-1"]);
  assert.deepEqual(ids({ scope: "all", retention: 1 }, { ...ALL, minWeight: .55 }), ["ab-1", "ba-1", "cd-1"]);   // weights .5 and below are under .55 of the maximum 1
  let previous = new Set<string>();
  for (const retention of [0, .2, .4, .6, .8, 1]) {
    const current = new Set(ids({ scope: "all", retention }));
    for (const id of previous) assert.ok(current.has(id), `${id} disappeared as retention rose`);
    previous = current;
  }
  assert.equal(previous.size, 6);
  assert.equal(selectRelations(layout, ALL, { scope: "all", retention: 0 }).edges.length, 0);
  // Every place is kept: the endpoint layout is part of the drawing.
  assert.equal(selectRelations(layout, ALL, { scope: "all", retention: 0 }).nodes.length, 8);
  assert.throws(() => selectRelations(layout, ALL, { scope: "all", retention: 1.5 }), /retention/);
});

test("highlight rules: edges of a group, edges between two groups in either direction, and the heaviest share", () => {
  const result = bundle(laidOut());
  const set = (rule: Parameters<typeof highlightedEdges>[1]) => [...highlightedEdges(result, rule)].sort();
  assert.deepEqual(set({ kind: "group", group: 2 }), ["ac-1", "cd-1"]);
  assert.deepEqual(set({ kind: "pair", group: 1, partner: 0 }), ["ab-1", "ab-2", "ba-1"]);
  assert.deepEqual(set({ kind: "pair", group: 0, partner: 0 }), ["aa-1"]);
  assert.deepEqual(set({ kind: "heaviest", share: .3 }), ["ab-1", "ba-1"]);      // ceil(.3 × 6) = 2 of the weights 1, .8, .6, .5, .4, .3
  assert.deepEqual(set({ kind: "heaviest", share: .01 }), ["ab-1"]);              // a positive share highlights at least one
  assert.deepEqual(set({ kind: "heaviest", share: 0 }), []);
  assert.deepEqual(set({ kind: "none" }), []);
});

test("direction markers sit at the stated arc-length fraction, turn along from → to, and raising the share only adds markers", () => {
  const layout = laidOut();
  const straight = bundle(layout, { strength: 0 });
  const markers = pathMarkers(straight, { at: .75, size: 4, share: 1, tone: () => 3 });
  assert.equal(markers.length, 6);
  for (const site of markers) {
    const path = pathOf(straight, site.id.replace("/arrow", ""));
    const [a, b] = [path.points[0], path.points[1]];
    nearPoint(site.position, [a[0] + .75 * (b[0] - a[0]), a[1] + .75 * (b[1] - a[1])]);
    near(site.angle, Math.atan2(b[1] - a[1], b[0] - a[0]));
    assert.equal(site.tone, 3);
  }
  const some = pathMarkers(straight, { at: .75, size: 4, share: .5, tone: () => 0 }).map((site) => site.id);
  assert.ok(some.length > 0 && some.length < 6 && some.every((id) => markers.some((site) => site.id === id)));
  assert.equal(pathMarkers(straight, { at: .5, size: 300, share: 1, tone: () => 0 }).length, 0, "paths shorter than three markers get none");
  // A curved route is walked by arc length, not by vertex index.
  const curved = bundle(layout);
  const [site] = pathMarkers(curved, { at: .5, size: 4, share: 1, tone: () => 0 });
  const path = pathOf(curved, site.id.replace("/arrow", ""));
  let walked = 0;
  for (let i = 1; i < path.points.length; i++) walked += Math.hypot(path.points[i][0] - path.points[i - 1][0], path.points[i][1] - path.points[i - 1][1]);
  near(walked, path.length);
});

test("group bands follow each group's sector, and graph layouts have none", () => {
  const layout = laidOut();
  const bands = groupBands(layout, 10);
  assert.deepEqual(bands.map((band) => band.id), ["band:A", "band:B", "band:C", "band:D"]);
  near(Math.hypot(...bands[1].points[0] as [number, number]), 110);
  const start = layout.placements[1].span[0];
  nearPoint(bands[1].points[0], [110 * Math.cos(start), 110 * Math.sin(start)]);
  const relations = relationsFromTables(relationSample("ferries").nodes, relationSample("ferries").edges, relationColumns, { seed: 1, directed: true });
  assert.equal(groupBands(layoutEndpoints(relations, { kind: "graph", frame: FRAME, fit: true }), 10).length, 0);
});

test("work bounds throw naming the control that decides them, and nothing is truncated", () => {
  const count = MAX_BUNDLED_EDGES + 1;
  const nodes = Array.from({ length: 200 }, (_, i) => ({ id: `n${i}`, position: [i, 0] as const }));
  const edges: { id: string; from: string; to: string; weight: number; age: number }[] = [];
  for (let a = 0; a < 200 && edges.length < 3000; a++) for (let b = a + 1; b < 200 && edges.length < 3000; b++) edges.push({ id: `e${a}-${b}`, from: `n${a}`, to: `n${b}`, weight: 1, age: 1 });
  const groups: GroupAssignment = { column: "g", names: ["left", "right"], groupOf: nodes.map((_, i) => i % 2) };
  const dense = layoutEndpoints({ graph: graphFromParts({ seed: 1, nodes, edges }), groups }, circle());
  const view = selectRelations(dense, ALL, { scope: "all", retention: 1 });
  assert.throws(() => bundleEdges(dense, view, { ...BUNDLE, detail: 32 }), /detail/);
  assert.equal(bundleEdges(dense, view, { ...BUNDLE, detail: 8 }).paths.length, 3000);
  const bigEdges: typeof edges = [];
  for (let a = 0; a < 200 && bigEdges.length < count; a++) for (let b = a + 1; b < 200 && bigEdges.length < count; b++) bigEdges.push({ id: `b${a}-${b}`, from: `n${a}`, to: `n${b}`, weight: 1, age: 1 });
  const huge = layoutEndpoints({ graph: graphFromParts({ seed: 1, nodes, edges: bigEdges }), groups }, circle());
  assert.throws(() => bundleEdges(huge, selectRelations(huge, ALL, { scope: "all", retention: 1 }), BUNDLE), /minWeight or lower retention/);
  assert.equal(bundleEdges(huge, selectRelations(huge, ALL, { scope: "all", retention: .4 }), BUNDLE).paths.length > 0, true);
  for (const bad of [{ strength: 1.1 }, { inset: -.1 }, { lift: 2 }, { separation: NaN }, { detail: 0 }, { detail: 2.5 }, { detail: 33 }])
    assert.throws(() => bundle(laidOut(), bad), /must be/);
});

test("tables bind by named columns and every error names the table and row", () => {
  const nodes = dataTable({ id: "n", rowIds: ["a", "b", "c"], columns: [{ name: "grp", kind: "categorical", categories: ["x", "y"], values: ["x", "y", null] }] });
  const edges = (from: (string | null)[], to: (string | null)[], flow: (number | null)[], ids = ["e1", "e2"]) => dataTable({ id: "e", rowIds: ids, columns: [
    { name: "from", kind: "categorical", categories: ["a", "b", "c", "zz"], values: from }, { name: "to", kind: "categorical", categories: ["a", "b", "c", "zz"], values: to },
    { name: "flow", kind: "continuous", values: flow }] });
  const cols = { group: "grp", from: "from", to: "to", flow: "flow" };
  const bind = (n: typeof nodes, e: ReturnType<typeof edges>) => relationsFromTables(n, e, cols, { seed: 1, directed: true });
  assert.throws(() => bind(nodes, edges(["a", "b"], ["b", "a"], [1, 2])), /node "c" has no grp/);
  const full = dataTable({ id: "n2", rowIds: ["a", "b", "c"], columns: [{ name: "grp", kind: "categorical", categories: ["x", "y"], values: ["x", "y", "y"] }] });
  assert.throws(() => bind(full, edges(["a", "zz"], ["b", "a"], [1, 2])), /edge "e2" names a node/);
  assert.throws(() => bind(full, edges(["a", "b"], ["b", "c"], [1, 0])), /edge "e2" needs a positive flow/);
  assert.throws(() => bind(full, edges(["a", "b"], ["b", "c"], [1, null])), /edge "e2" needs a positive flow/);
  assert.throws(() => bind(full, edges(["a", null], ["b", "c"], [1, 1])), /edge "e2" needs from and to/);
  assert.throws(() => bind(full, edges(["a", "b"], ["b", "a"], [1, 2])), /duplicates e1/);   // a graph is simple: record net flow
  assert.throws(() => bind(full, edges(["a", "a"], ["a", "b"], [1, 1])), /self-loop/);
  assert.throws(() => relationsFromTables(full, edges(["a"], ["b"], [1], ["e1"]), { ...cols, group: "missing" }, { seed: 1, directed: true }), /missing/);
  const ok = bind(full, edges(["a", "b"], ["b", "c"], [10, 5]));
  assert.deepEqual(ok.graph.edges.map((edge) => [edge.id, edge.weight]), [["e1", 1], ["e2", .5]]);   // weight = flow / largest flow
  assert.deepEqual([ok.maxFlow, [...ok.flows]], [10, [10, 5]]);
  assert.deepEqual([...ok.groups.groupOf], [0, 1, 1]);
});

/* ------------------------------------------------------ the named instrument */

const ID = "bundled-relations";
const input = (params: Record<string, number | string | boolean> = {}, seed = 42): InstrumentInput => {
  const base = createInstrument(ID);
  return { ...base, seed, params: { ...base.params, ...params } };
};
const recipeOf = (params: Record<string, number | string | boolean> = {}, seed = 42) => bundledRelationsComposition(input(params, seed));
function recorder(): { surface: CompositionSurface; ops: string[] } {
  const ops: string[] = [];
  const round = (value: unknown) => typeof value === "number" ? Math.round(value * 1e6) / 1e6 : value;
  const surface = new Proxy({ CLOSE: "close", ROUND: "round" } as Record<string, unknown>, {
    get(target, key: string) { return key in target ? target[key] : (...args: unknown[]) => { ops.push(JSON.stringify([key, ...args.map(round)])); }; },
  });
  return { surface: surface as unknown as CompositionSurface, ops };
}
const drawn = (recipe: BundledRelationsRecipe): string[] => { const { surface, ops } = recorder(); drawBundledRelations(surface, recipe); return ops; };

test("bundled samples share one shape, are deterministic, and are valid simple graphs", () => {
  assert.deepEqual([...relationSampleIds].sort(), ["citations", "commuters", "ferries"]);
  for (const id of relationSampleIds) {
    const sample = relationSample(id);
    assert.equal(sample, relationSample(id));
    const relations = relationsFromTables(sample.nodes, sample.edges, relationColumns, { seed: 1, directed: sample.directed });
    assert.equal(relations.groups.names.length, 6, id);
    assert.ok(relations.groups.groupOf.length <= 64 && relations.graph.edges.length >= 60 && relations.graph.edges.length <= 250, id);
    const inside = relations.graph.edges.filter((edge) => relations.groups.groupOf[relations.graph.nodes.findIndex((n) => n.id === edge.from)] === relations.groups.groupOf[relations.graph.nodes.findIndex((n) => n.id === edge.to)]).length;
    assert.ok(inside > 20 && inside < relations.graph.edges.length - 20, `${id} has both within-group and between-group edges`);
    assert.ok(new Set(relations.graph.edges.map((edge) => Math.round(edge.weight * 20))).size >= 5, `${id} weights spread`);
  }
  assert.equal(relationSample("citations").directed, false);
  assert.throws(() => relationSample("nope"), /available: ferries, commuters, citations/);
});

test("every dataset draws in every endpoint layout, transparently, and the recorded recipe replays exactly from JSON", () => {
  for (const dataset of relationSampleIds) for (const endpoints of ["circle", "line", "map"]) {
    const recipe = recipeOf({ dataset, endpoints });
    const ops = drawn(recipe);
    assert.ok(ops.length > 200, `${dataset}/${endpoints}`);
    assert.ok(!ops.some((op) => op.startsWith('["background"')));
    assert.ok(!ops.some((op) => { const args = JSON.parse(op); return args[0] === "rect" && args[3] >= 640 && args[4] >= 640; }));
    assert.deepEqual(drawn(JSON.parse(JSON.stringify(recipe))), ops, `${dataset}/${endpoints}`);
  }
});

test("appearance edits reuse every cached stage; structural edits replace exactly the stages they change", () => {
  const base = recipeOf();
  const structure = bundledStructure(base);
  // Materials, colours, arrows, marks and place sizes never rebuild relations, layout, selection or bundles.
  const appearance = recipeOf({ edgeMaterial: "beads", edgeBead: "arrow", edgeWeight: 3, weightContrast: 0, edgeTone: "target", arrows: false, highlightTone: "edge",
    highlightMaterial: "stitch", nodeMark: "rosette", nodeSize: 14, nodeScaleBy: "uniform", groupBands: false, bandWeight: 9, edgeSpacing: 14 });
  assert.equal(bundledStructure(appearance), structure);
  assert.equal(bundledStructure({ ...base, palette: [1, 2, 3] }), structure);
  // The highlight rule changes the highlighted set only; bundle strength replaces bundles but keeps the layout and selection.
  const highlighted = bundledStructure(recipeOf({ highlight: "heaviest" }));
  assert.equal(highlighted.bundled, structure.bundled);
  assert.notDeepEqual([...highlighted.highlighted], [...structure.highlighted]);
  const loose = bundledStructure(recipeOf({ strength: .4 }));
  assert.equal(loose.layout, structure.layout); assert.equal(loose.view, structure.view); assert.notEqual(loose.bundled, structure.bundled);
  assert.deepEqual(loose.bundled.paths.map((p) => [p.id, p.seed, p.family]), structure.bundled.paths.map((p) => [p.id, p.seed, p.family]));
  const shown = bundledStructure(recipeOf({ minWeight: .3 }));
  assert.equal(shown.layout, structure.layout); assert.ok(shown.view.edges.length < structure.view.edges.length);
  for (const path of shown.bundled.paths) assert.deepEqual(path.points, structure.bundled.paths.find((p) => p.id === path.id)!.points);
  // A different dataset replaces ids.
  assert.notEqual(bundledStructure(recipeOf({ dataset: "ferries" })).bundled.paths[0].id, structure.bundled.paths[0].id);
});

test("appearance-only edits change what is drawn but never where the paths are", () => {
  const fingerprint = (params: Record<string, number | string | boolean>) => drawFingerprint({ ...createInstrument(ID), params: { ...createInstrument(ID).params, ...params } });
  const base = fingerprint({});
  assert.notEqual(fingerprint({ edgeTone: "source" }), base);
  assert.notEqual(fingerprint({ edgeWeight: 2.5 }), base);
  assert.equal(fingerprint({}), base);
  // Same structure, so the routed points are the same objects.
  assert.equal(bundledStructure(recipeOf({ edgeWeight: 2.5 })).bundled.paths, bundledStructure(recipeOf()).bundled.paths);
});

test("weight bands encode flow: heavier edges are drawn with wider strokes, zero contrast draws them alike", () => {
  const weights = (params: Record<string, number | string | boolean>) => {
    const widths = new Set<number>();
    for (const op of drawn(recipeOf({ highlight: "none", arrows: false, nodeSize: 0, groupBands: false, edgeTone: "flat", ...params })))
      if (op.startsWith('["strokeWeight"')) widths.add(JSON.parse(op)[1]);
    return [...widths].sort((a, b) => a - b);
  };
  const banded = weights({ edgeWeight: 2, weightContrast: .75 });
  assert.equal(banded.length, 5);
  near(banded[4], 2); near(banded[0], 2 * (1 - .75 * .8));
  assert.deepEqual(weights({ edgeWeight: 2, weightContrast: 0 }), [2]);
});

test("direction is encoded: source-to-target color splits every edge at its middle, arrows and beads follow from → to", () => {
  const recipe = recipeOf({ highlight: "none" });
  const flowPaths: { id: string; tone: number }[] = [];
  const { surface } = recorder();
  drawBundledRelations(surface, recipe, { edge: (_s, path) => flowPaths.push({ id: path.id, tone: path.tone! }) });
  const structure = bundledStructure(recipe);
  const halves = flowPaths.filter((p) => p.id.endsWith("/from"));
  assert.equal(halves.length, structure.bundled.paths.length);
  for (const path of structure.bundled.paths) {
    assert.equal(flowPaths.find((p) => p.id === `${path.id}/from`)!.tone, 1 + path.fromGroup);
    assert.equal(flowPaths.find((p) => p.id === `${path.id}/to`)!.tone, 1 + path.toGroup);
  }
  // Undirected data ignores direction: no arrow is drawn and edges are not directed.
  assert.equal(recipeOf({ dataset: "citations", arrows: true }).relations.directed, false);
  assert.equal(recipeOf({ dataset: "citations", arrows: true }).arrows.mark.size, 0);
  // Direction "none" on a directed sample also drops arrows and directed bundles.
  const plain = recipeOf({ direction: "none", arrows: true, families: "directed" });
  assert.equal(plain.relations.directed, false); assert.equal(plain.bundle.families, "pair"); assert.equal(plain.arrows.mark.size, 0);
  // With arrows on, markers point along from → to at the chosen fraction.
  const arrowed = bundledStructure(recipeOf({ highlight: "none", arrows: true, arrowAt: .8, arrowShare: 1, arrowSize: 6 }));
  const [site] = pathMarkers(arrowed.bundled, { at: .8, size: 6, share: 1, tone: () => 0 });
  const path = arrowed.bundled.paths.find((p) => p.id === site.id.replace("/arrow", ""))!;
  const start = path.points[0], end = path.points[path.points.length - 1];
  assert.ok(Math.hypot(site.position[0] - end[0], site.position[1] - end[1]) < Math.hypot(site.position[0] - start[0], site.position[1] - start[1]));
});

test("custom consumers receive the same frozen paths and sites the stock materials draw", () => {
  const recipe = recipeOf();
  const seen: string[] = [], sites: string[] = [], hot: string[] = [];
  const { surface } = recorder();
  drawBundledRelations(surface, recipe, {
    edge: (_s, path) => seen.push(path.id), highlight: (_s, path) => hot.push(path.id),
    place: (_s, site) => sites.push(site.id), arrow: () => {}, band: () => {},
  });
  const structure = bundledStructure(recipe);
  assert.equal(new Set(hot.map((id) => id.replace(/\/(from|to)$/, ""))).size, structure.highlighted.size);
  assert.equal(new Set(seen.map((id) => id.replace(/\/(from|to)$/, ""))).size + structure.highlighted.size, structure.bundled.paths.length);
  assert.deepEqual(sites, structure.layout.graph.nodes.map((node) => node.id));
});

test("seed semantics: only a seeded shuffle or partial retention makes the seed matter", () => {
  const fingerprint = (params: Record<string, number | string | boolean>, seed: number) => drawFingerprint({ ...createInstrument(ID), seed, params: { ...createInstrument(ID).params, ...params } });
  assert.equal(usesSeed(input()), false);
  assert.equal(fingerprint({}, 1), fingerprint({}, 2));
  assert.equal(usesSeed(input({ nodeOrder: "shuffled" })), true);
  assert.notEqual(fingerprint({ nodeOrder: "shuffled" }, 1), fingerprint({ nodeOrder: "shuffled" }, 2));
  assert.equal(usesSeed(input({ nodeOrder: "shuffled", endpoints: "map" })), false);
  assert.equal(fingerprint({ nodeOrder: "shuffled", endpoints: "map" }, 1), fingerprint({ nodeOrder: "shuffled", endpoints: "map" }, 2));
  assert.equal(usesSeed(input({ arrows: true, arrowShare: .5 })), true);
  assert.notEqual(fingerprint({ arrows: true, arrowShare: .5 }, 1), fingerprint({ arrows: true, arrowShare: .5 }, 2));
  assert.equal(usesSeed(input({ arrows: true, arrowShare: 1 })), false);
  assert.equal(fingerprint({ arrows: true, arrowShare: 1 }, 1), fingerprint({ arrows: true, arrowShare: 1 }, 2));
  assert.equal(usesSeed(input({ retention: .5 })), true);
  assert.notEqual(fingerprint({ retention: .5 }, 1), fingerprint({ retention: .5 }, 2));
});

test("limits: groups are named by position within the dataset, spacing is bounded by measured drawing work, and the edited image is never partial", () => {
  assert.throws(() => validateInstrument({ ...input(), params: { ...input().params, focusGroup: 7 } }), /focusGroup/);
  assert.throws(() => validateInstrument({ ...input(), params: { ...input().params, detail: 33 } }), /detail/);
  const beads = recipeOf({ edgeMaterial: "beads", edgeSpacing: .5 });
  const { surface, ops } = recorder();
  assert.throws(() => drawBundledRelations(surface, beads), /edgeSpacing/);
  assert.equal(ops.length, 0, "the work check happens before anything is drawn");
  assert.throws(() => drawBundledRelations(recorder().surface, recipeOf({ highlight: "heaviest", heaviestShare: 1, highlightMaterial: "stitch", highlightSpacing: .5 })), /highlightSpacing/);
  assert.equal(drawn(recipeOf({ edgeMaterial: "beads", edgeSpacing: 3 })).length > 1000, true);
  assert.throws(() => drawBundledRelations(recorder().surface, recipeOf(), {}, createCompositionRun({ maxWork: 10 })), /budget/);
});

test("the instrument prepares cooperatively and can be cancelled", async () => {
  assert.equal(canPrepareInstrument(ID), true);
  assert.equal(await prepareInstrument(input(), () => false), true);
  assert.equal(await prepareInstrument(input(), () => true), false);
});

test("drawing through the public entry point matches the direct function", () => {
  const { surface, ops } = recorder();
  drawInstrument(surface as unknown as DrawingContext, input());
  assert.deepEqual(ops, drawn(recipeOf()));
});
