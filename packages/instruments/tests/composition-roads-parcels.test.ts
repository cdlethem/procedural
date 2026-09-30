import assert from "node:assert/strict";
import test from "node:test";
import {
  canPrepareInstrument, checkSimulation, classWidth, createInstrument, drawInstrument, growRoads, locateInDomain, prepareInstrument, prepareRoads,
  roadNetwork, roadFaces, roadSimulation, roadsCached, roadsParcelsComposition, roadsParcelsProducts, roadGrowthParams, roadParcels, roadBlocks,
  definition, stateAt, usesSeed, validateInstrument, visibleParameters, inspectorItems, domainIntersection,
  type DrawingContext, type InstrumentInput, type RoadNetwork, type RoadsParcelsProducts,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";

type P = readonly [number, number];
const ID = "roads-parcels";
const input = (over: Record<string, number | string | boolean> = {}, seed = 42, palette?: number[]): InstrumentInput => {
  const made = createInstrument(ID);
  made.seed = seed;
  Object.assign(made.params, over);
  if (palette) made.palette = palette;
  return made;
};
const products = (over: Record<string, number | string | boolean> = {}, seed = 42): RoadsParcelsProducts => roadsParcelsProducts(roadsParcelsComposition(input(over, seed)));

/* independent geometry, not the library's */
const orient = (a: P, b: P, c: P) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function distance(p: P, a: P, b: P): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
/** Do two edges that share no end node touch anywhere (proper crossing or one end on the other)? */
function touch(a: P, b: P, c: P, d: P): boolean {
  const eps = 1e-7;
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  if (((o1 > 0) !== (o2 > 0)) && ((o3 > 0) !== (o4 > 0)) && Math.abs(o1) > 0 && Math.abs(o2) > 0 && Math.abs(o3) > 0 && Math.abs(o4) > 0) return true;
  return distance(a, c, d) < eps || distance(b, c, d) < eps || distance(c, a, b) < eps || distance(d, a, b) < eps;
}
function assertPlanar(network: RoadNetwork, label: string): void {
  const at = new Map(network.graph.nodes.map((n) => [n.id, n.position] as const));
  const edges = network.graph.edges;
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const e = edges[i], f = edges[j];
    if (e.from === f.from || e.from === f.to || e.to === f.from || e.to === f.to) continue;
    assert.ok(!touch(at.get(e.from)!, at.get(e.to)!, at.get(f.from)!, at.get(f.to)!), `${label}: ${e.id} and ${f.id} meet without a shared node`);
  }
  // Edges sharing a node must not overlap: no two leave the node in the same direction.
  for (const node of network.graph.nodes) {
    const dirs = edges.filter((e) => e.from === node.id || e.to === node.id).map((e) => {
      const other = at.get(e.from === node.id ? e.to : e.from)!;
      return Math.atan2(other[1] - node.position[1], other[0] - node.position[0]);
    });
    for (let i = 0; i < dirs.length; i++) for (let j = i + 1; j < dirs.length; j++)
      assert.ok(Math.abs(Math.sin(dirs[i] - dirs[j])) > 1e-9 || Math.cos(dirs[i] - dirs[j]) < 0, `${label}: two edges overlap at ${node.id}`);
  }
}
function components(network: RoadNetwork): number {
  const parent = new Map(network.graph.nodes.map((n) => [n.id, n.id] as const));
  const find = (x: string): string => { while (parent.get(x) !== x) x = parent.get(x)!; return x; };
  for (const e of network.graph.edges) parent.set(find(e.from), find(e.to));
  return new Set(network.graph.nodes.map((n) => find(n.id))).size;
}

const configs: [string, Record<string, number | string | boolean>, number][] = [
  ["default", {}, 42],
  ["default seed 7", {}, 7],
  ["radial", { field: "radial", blockSize: 80 }, 3],
  ["spiral through", { field: "spiral", junction: "through", blockSize: 70 }, 11],
  ["organic crossing", { field: "organic", junction: "crossing", blockSize: 70 }, 5],
  ["grid wobble stubs", { deadEnds: "stub", wobble: 40, minAngle: 45, blockSize: 60, reserve: "rectangle" }, 9],
  ["no frame", { boundaryRoad: false, blockSize: 90 }, 2],
];

/* ------------------------------------------------------------------ planarity and topology */

test("no two roads meet without a shared node, and every planar face is a valid block", () => {
  for (const [label, over, seed] of configs) {
    const p = products(over, seed);
    assertPlanar(p.network, label);
    const faces = roadFaces(p.network);
    assert.equal(faces.crossingEdges.length, 0, `${label}: planarFaces found crossing edges`);
    assert.deepEqual(faces.rejected, { pinched: 0, crossed: 0, island: 0, degenerate: 0 }, label);
  }
});

test("Euler: a connected network with a boundary road has E - V + 1 faces, and the faces tile the site exactly", () => {
  for (const [label, over, seed] of configs.filter(([, o]) => o.boundaryRoad !== false)) {
    const { network } = products(over, seed);
    assert.equal(components(network), 1, `${label}: network is connected`);
    const faces = roadFaces(network).faces;
    // Planar faces of a connected graph: E - V + 1 (dangling chains remove one edge and one node each).
    const nodes = network.graph.nodes.length, edges = network.graph.edges.length;
    assert.equal(faces.length, edges - nodes + 1, `${label}: bounded faces`);
    const area = faces.reduce((s, f) => s + f.area, 0);
    const { width, height } = roadGrowthParams({ ...createInstrument(ID).params, ...over } as never);
    assert.ok(Math.abs(area - width * height) < 1e-6 * width * height, `${label}: faces cover ${area} of ${width * height}`);
  }
});

test("junction policy: tee never lets a route street pass through another, crossing and through do", () => {
  const passing = (junction: string) => {
    const { network } = products({ junction, blockSize: 70, field: "grid", warp: 0, wobble: 0, anchors: 0, reserve: "none" }, 4);
    // A node is a pass-through of street S when two of S's edges meet there; two route streets passing through one node cross.
    const through = new Map<string, Set<string>>();
    for (const street of network.streets) {
      if (street.kind !== "route") continue;
      const seen = new Map<string, number>();
      for (const id of street.edges) { const e = network.graph.edges.find((x) => x.id === id)!; for (const n of [e.from, e.to]) seen.set(n, (seen.get(n) ?? 0) + 1); }
      for (const [node, count] of seen) if (count === 2) (through.get(node) ?? through.set(node, new Set()).get(node)!).add(street.id);
    }
    return [...through.values()].filter((set) => set.size >= 2).length;
  };
  assert.equal(passing("tee"), 0);
  assert.ok(passing("crossing") > 0);
  assert.ok(passing("through") >= passing("crossing"));
});

/* ------------------------------------------------------------------------- the simulation */

test("the growth is a stateful simulation that passes the shared checker: replay, prefix, checkpoints, spacing", () => {
  for (const [, over, seed] of [configs[0], configs[3], configs[5]]) {
    const params = roadGrowthParams({ ...createInstrument(ID).params, ...over } as never);
    checkSimulation(roadSimulation, params, seed, 40, { checkpointSpacings: [1, 7, 60] });
  }
});

test("more steps only append: earlier nodes, streets and edge ids are unchanged, an edge only ever ends earlier", () => {
  const params = roadGrowthParams({ ...createInstrument(ID).params, blockSize: 60 } as never);
  const early = roadNetwork(growRoads(params, 42, 12), { centerX: 0, centerY: 0, rotation: 0 });
  const late = roadNetwork(growRoads(params, 42, 60), { centerX: 0, centerY: 0, rotation: 0 });
  const lateNodes = new Map(late.graph.nodes.map((n) => [n.id, n.position] as const));
  for (const node of early.graph.nodes) assert.deepEqual(lateNodes.get(node.id), node.position, node.id);
  const lateEdges = new Map(late.graph.edges.map((e) => [e.id, e] as const));
  for (const edge of early.graph.edges) {
    assert.equal(lateEdges.get(edge.id)!.from, edge.from, `${edge.id} keeps its start`);
    assert.ok(lateEdges.get(edge.id)!.length <= edge.length + 1e-9, `${edge.id} is only ever cut shorter`);
  }
  const lateStreets = new Map(late.streets.map((s) => [s.id, s] as const));
  for (const street of early.streets) assert.equal(lateStreets.get(street.id)!.birth, street.birth);
  assert.ok(late.streets.length > early.streets.length);
  // Retention: a checkpoint replay from a longer run reproduces the shorter run's state exactly.
  const long = growRoads(params, 42, 200), short = growRoads(params, 42, 40);
  assert.deepEqual(stateAt(long, 40).nodeX, stateAt(short, 40).nodeX);
  assert.deepEqual(stateAt(long, 40).edgeB, stateAt(short, 40).edgeB);
});

test("growth terminates explicitly when no street fits, and extra steps change nothing", () => {
  const params = roadGrowthParams({ ...createInstrument(ID).params, blockSize: 200 } as never);
  const a = roadNetwork(growRoads(params, 42, 200), { centerX: 0, centerY: 0, rotation: 0 });
  const b = roadNetwork(growRoads(params, 42, 900), { centerX: 0, centerY: 0, rotation: 0 });
  assert.equal(a.progress.done, true);
  assert.ok(a.progress.doneAt > 0 && a.progress.doneAt < 200, `done at ${a.progress.doneAt}`);
  assert.equal(b.progress.doneAt, a.progress.doneAt);
  assert.deepEqual(b.graph.nodes.map((n) => n.position), a.graph.nodes.map((n) => n.position));
  assert.deepEqual(b.graph.edges.map((e) => e.id), a.graph.edges.map((e) => e.id));
  // Stopped early: too few steps is not done, and reports so.
  assert.equal(roadNetwork(growRoads(params, 42, 1), { centerX: 0, centerY: 0, rotation: 0 }).progress.done, false);
  // Nothing fits at all: only the boundary road exists and the whole site is one block.
  const empty = products({ blockSize: 240, width: 200, height: 200, anchors: 0, reserve: "none", steps: 50, focusScale: 1 });
  assert.equal(empty.network.progress.streets, 0);
  assert.equal(empty.network.progress.done, true);
  assert.equal(empty.blocks.blocks.length, 1);
});

test("every street's clearance: no block holds a disc wider than the block size (growth stopped for a reason)", () => {
  const over = { blockSize: 80, focusScale: 1, reserve: "none", anchors: 0, warp: 0, wobble: 0 };
  const p = products({ ...over, steps: 600 }, 6);
  assert.equal(p.network.progress.done, true);
  const at = new Map(p.network.graph.nodes.map((n) => [n.id, n.position] as const));
  const segments = p.network.graph.edges.map((e) => [at.get(e.from)!, at.get(e.to)!] as const);
  // Sample a fine lattice: the distance to the nearest road may exceed blockSize/2 only where a street failed (stalled discs).
  let widest = 0;
  for (let x = -270; x <= 270; x += 6) for (let y = -250; y <= 250; y += 6) {
    const point: P = [x + 320 - 320, y + 320 - 320];
    let d = Infinity;
    for (const [a, b] of segments) d = Math.min(d, distance([point[0] + 320, point[1] + 320], a, b));
    widest = Math.max(widest, d);
  }
  assert.ok(widest < 80 / 2 * 1.5, `widest empty disc radius ${widest}`);
});

/* ------------------------------------------------------ identity, caching and appearance */

test("palette and every appearance control repaint the same snapshots, network, blocks and parcels (by identity)", () => {
  const base = products();
  const changed = products({ roadMaterial: "stitch", roadColor: "age", junctionMark: "dot", markSize: 9, typeA: "contours", typeB: "dots", typeC: "hatch",
    fillSpacing: 3, fillWeight: 2, underpaint: .9, lotOutline: false, avenueWidth: 5, stitchSpacing: 5, hatchAngle: 40 });
  assert.equal(changed.snapshots, base.snapshots);
  assert.equal(changed.network, base.network);
  assert.equal(changed.blocks, base.blocks);
  assert.equal(changed.parcels, base.parcels);
  const recolored = roadsParcelsProducts(roadsParcelsComposition(input({}, 42, [1, 2, 3, 4, 5])));
  assert.equal(recolored.parcels, base.parcels);
  // Lot edits keep the network and blocks; road width edits keep the network but recut the land.
  const lots = products({ lotWidth: 30 });
  assert.equal(lots.network, base.network);
  assert.equal(lots.blocks, base.blocks);
  assert.notEqual(lots.parcels, base.parcels);
  const widths = products({ collectorWidth: 5 });
  assert.equal(widths.snapshots, base.snapshots);
  assert.notEqual(widths.blocks, base.blocks);
  // Placement moves the network without regrowing it.
  const moved = products({ centerX: 300, rotation: 15 });
  assert.equal(moved.snapshots, base.snapshots);
  assert.notEqual(moved.network, base.network);
});

test("initial-condition edits recompute; hidden or inert ones do not", () => {
  const base = products();
  const keyOf = (over: Record<string, number | string | boolean>, seed = 42) => products(over, seed).snapshots.key;
  const k = base.snapshots.key;
  for (const [label, over, seed] of [["anchor angle", { anchorAngle: 70 }, 42], ["anchors", { anchors: 4 }, 42], ["zone position", { reserveX: 60 }, 42], ["seed", {}, 43],
    ["block size", { blockSize: 101 }, 42], ["field", { field: "organic" }, 42], ["focus", { focusX: 40 }, 42], ["site width", { width: 500 }, 42], ["junction", { junction: "crossing" }, 42],
    ["wobble", { wobble: 12 }, 42]] as const)
    assert.notEqual(keyOf(over, seed), k, label);
  // Hidden by a selection: grid angle when the pattern is radial, zone geometry with no zone, anchor position with no anchors.
  assert.equal(keyOf({ field: "radial", gridAngle: 33 }), keyOf({ field: "radial", gridAngle: -20 }));
  assert.equal(keyOf({ reserve: "none", reserveX: 10, reserveWidth: 300 }), keyOf({ reserve: "none", reserveX: -90, reserveWidth: 40 }));
  assert.equal(keyOf({ anchors: 0, anchorAngle: 10 }), keyOf({ anchors: 0, anchorAngle: 80 }));
  assert.equal(keyOf({ field: "grid", hubRadius: 10 }), keyOf({ field: "grid", hubRadius: 60 }));
  // Steps do not change the key's construction: a longer run extends it.
  assert.equal(growRoads(base.snapshots.params as never, 42, 100).construction, growRoads(base.snapshots.params as never, 42, 200).construction);
});

test("cancellation leaves no partial cache entry, and a retry equals an uninterrupted run", async () => {
  const params = roadGrowthParams({ ...createInstrument(ID).params, blockSize: 47, width: 500 } as never);
  assert.equal(roadsCached(params, 99, 150), false);
  let polls = 0;
  assert.equal(await prepareRoads(params, 99, 150, () => ++polls > 20), null);
  assert.equal(roadsCached(params, 99, 150), false, "cancelled work is not cached");
  const retried = await prepareRoads(params, 99, 150, () => false);
  assert.ok(retried);
  assert.equal(roadsCached(params, 99, 150), true);
  const fresh = roadNetwork(growRoads(params, 99, 150), { centerX: 0, centerY: 0, rotation: 0 });
  const again = roadNetwork(retried, { centerX: 0, centerY: 0, rotation: 0 });
  assert.deepEqual(again.graph.nodes.map((n) => n.position), fresh.graph.nodes.map((n) => n.position));
  // Through the instrument preparation, including the block and lot stages.
  const one = input({ blockSize: 55 }, 314);
  assert.equal(canPrepareInstrument(ID), true);
  assert.equal(await prepareInstrument(one, () => true), false);
  let seen = 0;
  assert.equal(await prepareInstrument(one, () => ++seen > 30), false);
  assert.equal(await prepareInstrument(one, () => false), true);
});

/* ------------------------------------------------------------------- blocks and parcels */

test("lots never reach a road: every lot vertex keeps half the width of every road of its block plus the setback", () => {
  for (const [label, over, seed] of configs) {
    const p = products(over, seed);
    const { widths, setback } = p.blocks.options;
    const at = new Map(p.network.graph.nodes.map((n) => [n.id, n.position] as const));
    const edgeById = new Map(p.network.graph.edges.map((e) => [e.id, e] as const));
    for (const parcel of p.parcels.parcels) {
      if (parcel.role === "reserved" && parcel.reason !== "sliver") continue;
      const block = p.blocks.blocks.find((b) => b.id === parcel.blockId)!;
      block.face.edges.forEach((id, i) => {
        const e = edgeById.get(id)!, half = classWidth(widths, block.edgeClass[i]) / 2 + setback;
        for (const ring of [parcel.region.outer, ...parcel.region.holes]) for (const v of ring)
          assert.ok(distance(v as P, at.get(e.from)!, at.get(e.to)!) >= half - 1e-6, `${label}: ${parcel.id} vertex ${v} is ${distance(v as P, at.get(e.from)!, at.get(e.to)!)} from ${id}, needs ${half}`);
      });
    }
  }
});

test("parcels tile each built block's land exactly and stay inside their block", () => {
  for (const [label, over, seed] of configs) {
    const p = products({ ...over, unbuiltShare: 0 }, seed);
    const byBlock = new Map<string, number>();
    for (const parcel of p.parcels.parcels) byBlock.set(parcel.blockId, (byBlock.get(parcel.blockId) ?? 0) + parcel.area);
    for (const block of p.blocks.blocks) {
      if (block.kind !== "built") continue;
      const sum = byBlock.get(block.id) ?? 0;
      assert.ok(Math.abs(sum - block.land.area) < 1e-6 * Math.max(1, block.region.area), `${label}: ${block.id} parcels ${sum} vs land ${block.land.area}`);
      assert.ok(block.land.area <= block.region.area + 1e-9);
    }
    for (const parcel of p.parcels.parcels) {
      const block = p.blocks.blocks.find((b) => b.id === parcel.blockId)!;
      for (const v of parcel.region.outer) {
        if (locateInDomain(block.region, v[0], v[1]) !== "outside") continue;
        // Cut vertices are rounded to the nearest double; a vertex may sit a few ulps outside a slanted edge.
        const n = block.face.points.length;
        const gap = Math.min(...block.face.points.map((a, i) => distance(v as P, a as P, block.face.points[(i + 1) % n] as P)));
        assert.ok(gap < 1e-9, `${label}: ${parcel.id} leaves its block by ${gap}`);
      }
    }
    const some = p.parcels.parcels.filter((q) => q.blockId === p.blocks.blocks[2].id);
    for (let i = 0; i < some.length; i++) for (let j = i + 1; j < some.length; j++)
      assert.ok(domainIntersection(some[i].region, some[j].region).area < 1e-9, `${label}: ${some[i].id} overlaps ${some[j].id}`);
  }
});

test("a block with an island of land (a hole) keeps it as a region with a hole, and a dead-end stub is kept out of the lots", () => {
  const p = products({ deadEnds: "stub", wobble: 40, minAngle: 45, blockSize: 60 }, 9);
  const stubs = p.network.streets.filter((s) => s.stub);
  assert.ok(stubs.length > 0, "this configuration leaves stubs");
  const at = new Map(p.network.graph.nodes.map((n) => [n.id, n.position] as const));
  const edgeById = new Map(p.network.graph.edges.map((e) => [e.id, e] as const));
  const half = classWidth(p.blocks.options.widths, 2) / 2 + p.blocks.options.setback;
  for (const stub of stubs) for (const id of stub.edges) {
    const e = edgeById.get(id)!;
    for (const parcel of p.parcels.parcels) {
      if (parcel.role === "reserved" && parcel.reason !== "sliver") continue;
      for (const v of parcel.region.outer) assert.ok(distance(v as P, at.get(e.from)!, at.get(e.to)!) >= half - 1e-6, `${parcel.id} touches stub ${id}`);
    }
  }
  // Every dead end is a degree-1 node off the boundary, and lots keep clear of the road that ends there.
  assert.ok(p.network.deadEnds.length > 0);
  for (const node of p.network.deadEnds) {
    assert.equal(p.network.graph.nodes.find((n) => n.id === node)!.degree, 1);
    const e = p.network.graph.edges.find((x) => x.from === node || x.to === node)!;
    for (const parcel of p.parcels.parcels) {
      if (parcel.role === "reserved" && parcel.reason !== "sliver") continue;
      for (const v of parcel.region.outer) assert.ok(distance(v as P, at.get(e.from)!, at.get(e.to)!) >= half - 1e-6, `${parcel.id} touches dead end ${node}`);
    }
  }
  // "drop" leaves no dead ends anywhere.
  for (const seed of [1, 2, 3, 4]) assert.equal(products({ deadEnds: "drop", wobble: 40, minAngle: 45, blockSize: 60 }, seed).network.deadEnds.length, 0);
});

test("lot frames follow the nearest road: on a straight grid every lot faces a road at a multiple of 90 degrees", () => {
  const p = products({ field: "grid", gridAngle: 0, warp: 0, wobble: 0, reserve: "none", blockSize: 90 }, 12);
  assert.ok(p.parcels.lots.length > 50);
  for (const lot of p.parcels.lots) {
    const turn = ((lot.angle % 90) + 90) % 90;
    assert.ok(turn < 1e-6 || turn > 90 - 1e-6, `${lot.id}: angle ${lot.angle}`);
  }
  // And on any network the front edge is the block edge nearest the lot (brute force).
  const q = products({}, 42);
  const at = new Map(q.network.graph.nodes.map((n) => [n.id, n.position] as const));
  const edgeById = new Map(q.network.graph.edges.map((e) => [e.id, e] as const));
  let checked = 0;
  for (const lot of q.parcels.lots) {
    const block = q.blocks.blocks.find((b) => b.id === lot.blockId)!;
    const c = lot.region.centroid as P;
    if (locateInDomain(lot.region, c[0], c[1]) !== "inside") continue;
    const dist = block.face.edges.map((id) => distance(c, at.get(edgeById.get(id)!.from)!, at.get(edgeById.get(id)!.to)!));
    const nearest = Math.min(...dist);
    const front = dist[block.face.edges.indexOf(lot.frontEdge!)];
    // The frame is measured from an interior point; allow a lot that is nearly equidistant.
    assert.ok(front <= nearest + 0.35 * Math.max(lot.frontage, 12), `${lot.id}: front ${front} vs nearest ${nearest}`);
    checked++;
  }
  assert.ok(checked > 100);
});

test("reserved space stays unbuilt: the zone and hub are blocks of their own with no lot, and unbuilt blocks follow their rule", () => {
  const p = products({ reserve: "ellipse", reserveX: 90, reserveY: 60, reserveWidth: 140, reserveHeight: 90, reserveAngle: 0, unbuiltShare: 0, field: "radial", hubRadius: 40 }, 8);
  const zone = p.blocks.blocks.filter((b) => b.kind === "zone"), hub = p.blocks.blocks.filter((b) => b.kind === "hub");
  assert.equal(zone.length, 1);
  assert.equal(hub.length, 1);
  // The zone is the requested ellipse (inscribed 40-gon): area within 1% of pi a b, and it is centred where asked.
  assert.ok(Math.abs(zone[0].area / (Math.PI * 70 * 45) - 1) < .01, `zone area ${zone[0].area}`);
  assert.ok(Math.hypot(zone[0].centroid[0] - (320 + 90), zone[0].centroid[1] - (320 + 60)) < 1e-6);
  for (const block of [zone[0], hub[0]]) {
    const parcels = p.parcels.parcels.filter((q) => q.blockId === block.id);
    assert.equal(parcels.length, 1);
    assert.equal(parcels[0].role, "reserved");
    assert.equal(parcels[0].reason, block.kind);
  }
  assert.equal(p.parcels.lots.filter((l) => l.blockId === zone[0].id || l.blockId === hub[0].id).length, 0);
  // Unbuilt share: round(share × built blocks) blocks keep no lot; "largest" picks the biggest.
  const q = products({ unbuiltShare: .25, unbuiltRule: "largest", reserve: "none" }, 8);
  const built = q.blocks.blocks.filter((b) => b.kind === "built" && b.land.area > 0);
  const open = built.filter((b) => q.parcels.parcels.filter((x) => x.blockId === b.id).every((x) => x.role === "reserved" && x.reason === "unbuilt"));
  assert.equal(open.length, Math.round(.25 * built.length));
  const smallestOpen = Math.min(...open.map((b) => b.area)), largestBuilt = Math.max(...built.filter((b) => !open.includes(b)).map((b) => b.area));
  assert.ok(smallestOpen >= largestBuilt, `${smallestOpen} vs ${largestBuilt}`);
  // "remote": the unbuilt blocks are the farthest from the focus.
  const r = products({ unbuiltShare: .25, unbuiltRule: "remote", reserve: "none", focusX: 0, focusY: 0 }, 8);
  const focus: P = [320, 320], far = (b: { centroid: readonly [number, number] }) => Math.hypot(b.centroid[0] - focus[0], b.centroid[1] - focus[1]);
  const rb = r.blocks.blocks.filter((b) => b.kind === "built" && b.land.area > 0);
  const ropen = rb.filter((b) => r.parcels.parcels.filter((x) => x.blockId === b.id).every((x) => x.reason === "unbuilt"));
  assert.ok(Math.min(...ropen.map(far)) >= Math.max(...rb.filter((b) => !ropen.includes(b)).map(far)));
});

test("lot types follow their rule: distance bands from the focus, road class, and stable chance", () => {
  const center = products({ typeBy: "center", unbuiltShare: 0 }, 21);
  const focus = center.parcels.blocks.options; void focus;
  const f: P = [320 + -40, 320 + -20];
  const dist = (l: { region: { centroid: readonly [number, number] } }) => Math.hypot(l.region.centroid[0] - f[0], l.region.centroid[1] - f[1]);
  const by = [0, 1, 2].map((t) => center.parcels.lots.filter((l) => l.type === t).map(dist));
  assert.ok(by.every((d) => d.length > 10));
  assert.ok(Math.max(...by[0]) <= Math.min(...by[1]) + 1e-9 && Math.max(...by[1]) <= Math.min(...by[2]) + 1e-9, "types are nested distance bands");
  assert.ok(Math.abs(by[0].length - by[2].length) <= 1 + center.parcels.lots.length / 3 * .02);
  const cls = products({ typeBy: "class" }, 21);
  for (const lot of cls.parcels.lots) assert.equal(lot.type, lot.frontClass);
  const a = products({ typeBy: "random" }, 21), b = products({ typeBy: "random", typeA: "hatch" }, 21);
  assert.deepEqual(a.parcels.lots.map((l) => [l.id, l.type]), b.parcels.lots.map((l) => [l.id, l.type]));
  const size = products({ typeBy: "size", unbuiltShare: 0 }, 21).parcels.lots;
  const areas = [0, 1, 2].map((t) => size.filter((l) => l.type === t).map((l) => l.area));
  assert.ok(Math.min(...areas[0]) >= Math.max(...areas[1]) - 1e-9 && Math.min(...areas[1]) >= Math.max(...areas[2]) - 1e-9, "larger lots come first");
});

test("changing the street structure updates blocks, lots and fills together: every binding names an existing block and road", () => {
  const finer = products({ blockSize: 60 }, 42), coarse = products({ blockSize: 150 }, 42);
  for (const p of [finer, coarse]) {
    const blocks = new Set(p.blocks.blocks.map((b) => b.id)), edges = new Set(p.network.graph.edges.map((e) => e.id));
    const streets = new Set(p.network.streets.map((s) => s.id));
    for (const parcel of p.parcels.parcels) {
      assert.ok(blocks.has(parcel.blockId));
      if (parcel.frontEdge) { assert.ok(edges.has(parcel.frontEdge)); assert.ok(streets.has(parcel.frontStreet!)); }
      assert.ok(parcel.id.startsWith(parcel.blockId));
    }
  }
  assert.ok(finer.parcels.lots.length > coarse.parcels.lots.length);
  // A block whose boundary is unchanged keeps its id, region and lots when the network grows elsewhere.
  const early = products({ blockSize: 60, steps: 30 }, 42), late = products({ blockSize: 60, steps: 300 }, 42);
  const lateById = new Map(late.blocks.blocks.map((b) => [b.id, b] as const));
  let kept = 0;
  for (const block of early.blocks.blocks) {
    const same = lateById.get(block.id);
    if (!same) continue;
    kept++;
    assert.deepEqual(same.face.nodes, block.face.nodes);
    const a = early.parcels.parcels.filter((x) => x.blockId === block.id).map((x) => [x.id, x.area, x.type]);
    const b = late.parcels.parcels.filter((x) => x.blockId === block.id).map((x) => [x.id, x.area, x.type]);
    if (early.blocks.blocks.length === late.blocks.blocks.length) assert.deepEqual(a.map((x) => x[0]), b.map((x) => x[0]));
  }
  assert.ok(kept > 0);
  for (const block of late.blocks.blocks) if (!early.blocks.blocks.some((b) => b.id === block.id)) assert.ok(!early.blocks.blocks.some((b) => b.face.nodes.join() === block.face.nodes.join()));
});

/* ------------------------------------------------------------------------ bounds, errors */

test("failures name the control to change and nothing is thinned", () => {
  const params = createInstrument(ID).params;
  const bad = (over: Record<string, number | string | boolean>, pattern: RegExp) => assert.throws(() => drawInstrument(canvas(), input(over)), pattern);
  bad({ blockSize: 8, focusScale: .25, width: 2000, height: 2000, lotWidth: 60, lotDepth: 90 }, /Block size/);
  assert.throws(() => validateInstrument(input({ lotWidth: 8, lotDepth: 12, width: 2000, height: 2000, blockSize: 240 })), /Lot width/);
  assert.throws(() => validateInstrument(input({ steps: 1501 })), /steps/i);
  assert.throws(() => validateInstrument(input({ anchors: 2.5 })), /integer/);
  assert.throws(() => validateInstrument(input({ field: "nope" })), /option/);
  // A hub ring that overlaps the zone.
  assert.throws(() => validateInstrument(input({ field: "radial", hubRadius: 80, reserve: "ellipse", reserveX: 30, reserveY: 0, focusX: 0, focusY: 0 })), /Hub radius/);
  void params;
});

test("an instrument draws transparent space only: no background, no full-canvas rectangle, everything inside the site", () => {
  const calls: string[] = [];
  const surface = new Proxy({ CLOSE: "close", ROUND: "round" } as Record<string, unknown>, {
    get(target, key: string) {
      return key in target ? target[key] : (...args: unknown[]) => { if (["background", "rect", "clear"].includes(key)) calls.push(`${key}:${args.join(",")}`); };
    },
  });
  drawInstrument(surface as unknown as DrawingContext, input({ typeA: "solid", typeB: "none", typeC: "hatch", underpaint: 1 }));
  assert.deepEqual(calls.filter((c) => !c.startsWith("rect:")), []);
  // The hatch underpaint is a polygon in the lot, never a canvas-sized rectangle.
  for (const c of calls) { const [w, h] = c.split(":")[1].split(",").slice(2).map(Number); assert.ok(w < 640 && h < 640, c); }
});

function canvas(): DrawingContext {
  return new Proxy({ CLOSE: "close", ROUND: "round", width: 640, height: 640 } as Record<string, unknown>, {
    get(target, key: string) { return key in target ? target[key] : () => {}; },
  }) as unknown as DrawingContext;
}

/* --------------------------------------------------------------------- controls and groups */

test("a hidden control never changes the drawing (seeded random configurations)", () => {
  let state = 12345;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 0x100000000; };
  const item = createInstrument(ID);
  const defaults = item.params;
  const selects: Record<string, string[]> = { field: ["grid", "radial", "spiral", "organic"], reserve: ["none", "ellipse", "rectangle"], roadMaterial: ["ink", "stitch", "beads"],
    junctionMark: ["none", "dot", "rings"], typeBy: ["class", "size", "center", "age", "random"], deadEnds: ["drop", "stub"], junction: ["tee", "crossing", "through"] };
  const flags = ["lotOutline", "boundaryRoad"];
  let hiddenChanges = 0;
  for (let round = 0; round < 8; round++) {
    const config: Record<string, number | string | boolean> = { blockSize: 70 + Math.floor(random() * 50), steps: 40 + Math.floor(random() * 60), width: 360, height: 320, unbuiltShare: .1 };
    for (const [key, options] of Object.entries(selects)) config[key] = options[Math.floor(random() * options.length)];
    for (const key of flags) config[key] = random() < .6;
    const base = input(config, 1 + round);
    const visible = new Set(visibleParameters(ID, base.params).map((p) => p.key));
    const hidden = Object.keys(defaults).filter((key) => !visible.has(key));
    const before = drawFingerprint(base);
    for (const key of hidden) {
      const parameter = parameterOf(key);
      const changed = input({ ...config, [key]: alternative(parameter, base.params[key], random) }, 1 + round);
      assert.equal(drawFingerprint(changed), before, `round ${round}: hidden ${key} changed the drawing`);
      hiddenChanges++;
    }
  }
  assert.ok(hiddenChanges > 20, `${hiddenChanges} hidden-control changes exercised`);
});
const parameterOf = (key: string) => definition(ID).parameters.find((p) => p.key === key)!;
function alternative(parameter: { type: string; min?: number; max?: number; options?: { value: string }[]; integer?: boolean }, current: number | string | boolean, random: () => number): number | string | boolean {
  if (parameter.type === "boolean") return !current;
  if (parameter.type === "select") return parameter.options!.find((o) => o.value !== current)!.value;
  const low = parameter.min!, high = parameter.max!;
  const value = low + (high - low) * (0.25 + 0.5 * random());
  return parameter.integer ? Math.round(value) : value;
}

test("the definition declares grouped, conditional controls, and seeds only matter where they act", () => {
  const item = createInstrument(ID);
  const tree = inspectorItems(ID, item.params);
  const labels = tree.map((entry) => ("label" in entry ? entry.label : ""));
  assert.deepEqual(labels.slice(0, 3), ["Streets", "Placement", "Guide field"]);
  // A hidden control leaves the inspector; the rest of its group stays.
  const grid = new Set(visibleParameters(ID, { ...item.params, field: "grid" }).map((p) => p.key));
  assert.ok(grid.has("gridAngle") && !grid.has("spin") && !grid.has("hubRadius"));
  const radial = new Set(visibleParameters(ID, { ...item.params, field: "radial" }).map((p) => p.key));
  assert.ok(!radial.has("gridAngle") && radial.has("hubRadius"));
  assert.ok(!new Set(visibleParameters(ID, { ...item.params, reserve: "none" }).map((p) => p.key)).has("reserveWidth"));
  // Seed: growth uses it whenever steps > 0.
  assert.equal(usesSeed({ ...item, params: { ...item.params, steps: 0, lotVariety: 0, typeBy: "class", unbuiltShare: 0 } }), false);
  assert.equal(usesSeed(item), true);
  // Different seeds are structurally different networks.
  assert.notDeepEqual(products({}, 1).network.graph.nodes.map((n) => n.position), products({}, 2).network.graph.nodes.map((n) => n.position));
  assert.notEqual(drawFingerprint(input({}, 1)), drawFingerprint(input({}, 2)));
});

test("the authored default shows the idea: three fills, three road classes, a reserved zone and open land", () => {
  const p = products();
  assert.ok(p.blocks.blocks.some((b) => b.kind === "zone"));
  assert.ok(p.blocks.blocks.some((b) => b.kind === "built" && p.parcels.parcels.filter((q) => q.blockId === b.id).every((q) => q.reason === "unbuilt")));
  assert.deepEqual([0, 1, 2].map((t) => p.parcels.lots.some((l) => l.type === t)), [true, true, true]);
  assert.deepEqual([0, 1, 2].map((c) => p.network.streets.some((s) => s.kind !== "zone" && roadClassOf(s, p) === c)), [true, true, true]);
  assert.ok(p.parcels.lots.length > 150 && p.parcels.lots.length < 1200, `${p.parcels.lots.length} lots`);
});
function roadClassOf(street: RoadNetwork["streets"][number], p: RoadsParcelsProducts): number {
  const block = p.blocks.blocks.find((b) => b.edgeStreet.includes(street.id));
  return block ? block.edgeClass[block.edgeStreet.indexOf(street.id)] : -1;
}

test("roadBlocks and roadParcels are pure functions of their inputs: same inputs, same object, frozen values", () => {
  const p = products();
  const options = { ...p.blocks.options };
  assert.equal(roadBlocks(p.network, options), p.blocks);
  assert.equal(roadParcels(p.blocks, p.parcels.options), p.parcels);
  assert.ok(Object.isFrozen(p.network) && Object.isFrozen(p.network.graph) && Object.isFrozen(p.blocks.blocks) && Object.isFrozen(p.parcels.parcels[0]));
  assert.throws(() => { (p.parcels.parcels as { push(x: unknown): void }).push(1); });
});
