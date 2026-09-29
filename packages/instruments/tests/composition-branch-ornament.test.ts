import assert from "node:assert/strict";
import test from "node:test";
import {
  atEach, attachmentSites, branchOrnamentComposition, branchOutline, branchTree, canPrepareInstrument, componentSeed,
  createInstrument, drawBranchOrnament, fitRoots, forkAxis, inheritAngle, motif, pathMaterial, prepareInstrument, removeLoops, strokeWith, visibleEdges,
  type AttachmentOptions, type BranchOrnamentComposition, type BranchTree, type BranchTreeOptions, type CompositionSurface, type Site,
} from "../dist/index.js";
import { growthModel } from "../dist/adapters/attractor-growth.js";
import { growthParams } from "../dist/composition/branch-tree.js";

/** Records every drawing call so two ways of drawing can be compared operation for operation. */
class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  ops: string[] = [];
  #note(name: string, args: unknown[]) { this.ops.push(`${name}(${args.map((value) => typeof value === "number" ? Number(value.toFixed(9)) : String(value)).join(",")})`); }
  push() { this.#note("push", []); } pop() { this.#note("pop", []); }
  translate(...a: number[]) { this.#note("translate", a); } rotate(...a: number[]) { this.#note("rotate", a); }
  scale(...a: number[]) { this.#note("scale", a); }
  noFill() { this.#note("noFill", []); } noStroke() { this.#note("noStroke", []); }
  fill(...a: number[]) { this.#note("fill", a); } stroke(...a: number[]) { this.#note("stroke", a); }
  strokeWeight(...a: number[]) { this.#note("strokeWeight", a); } strokeCap(...a: unknown[]) { this.#note("strokeCap", a); }
  circle(...a: number[]) { this.#note("circle", a); } line(...a: number[]) { this.#note("line", a); }
  rect(...a: number[]) { this.#note("rect", a); } beginShape() { this.#note("beginShape", []); }
  vertex(...a: number[]) { this.#note("vertex", a); } endShape(...a: unknown[]) { this.#note("endShape", a); }
}

const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const turn = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const base = branchOrnamentComposition(createInstrument("branch-ornament"));
const options = (patch: Partial<BranchTreeOptions> = {}): BranchTreeOptions => ({ ...base.tree, ...patch });

/** One attractor 93 units straight ahead of one root: a single straight trunk that ends on it. */
const single = options({ sourceCount: 1, extent: 1, aspect: 1, direction: 0, centerX: 320, centerY: 447, disorder: 0, exclusion: 0,
  rootCount: 1, rootJitter: 0, rootSpread: 0, rootX: 320, rootY: 540, rootHeading: 0, step: 10, reach: 5, ticks: 30, routing: "grown" });
const node = (tree: BranchTree, id: string) => tree.nodes.find((item) => item.id === id)!;
const edge = (tree: BranchTree, id: string) => tree.edges.find((item) => item.id === id)!;
const attach = (role: AttachmentOptions["role"], patch: Partial<AttachmentOptions> = {}): AttachmentOptions =>
  ({ role, minDepth: 0, maxDepth: 450, offset: 0, inherit: 1, falloff: 0, ...patch });
const flank = (spacing: number, angle: number, sides: "alternate" | "paired" | "single", patch: Partial<AttachmentOptions> = {}): AttachmentOptions =>
  attach("flank", { flank: { spacing, angle, sides }, ...patch });

test("a lone attractor ahead of a lone root gives one straight trunk that ends on it", () => {
  const tree = branchTree(single), source = growthModel(growthParams(single), single.seed).sources[0];
  assert.equal(tree.edges.length, 1);
  assert.deepEqual(tree.nodes.map((item) => item.role), ["trunk", "terminal"]);
  const [trunk, tip] = tree.nodes;
  assert.deepEqual([...trunk.position], [320, 540]);
  assert.deepEqual([...tip.position], [...source]);
  const line = tree.edges[0];
  near(line.length, Math.hypot(source[0] - 320, source[1] - 540), 1e-9);
  assert.equal(line.depth, 0);
  assert.equal(tree.maxDepth, 0);
  // Heading is the direction of travel; a trunk and its tip share it on a straight run.
  near(trunk.angle, Math.atan2(source[1] - 540, source[0] - 320), 1e-9);
  near(tip.heading, trunk.heading, 1e-9);
});

test("topology: incidence, depth and coverage of every grown segment", () => {
  const tree = branchTree(options({ routing: "grown" }));
  const model = growthModel(growthParams(options()), 42);
  const edges = new Map(tree.edges.map((item) => [item.id, item])), nodes = new Map(tree.nodes.map((item) => [item.id, item]));
  assert.equal(edges.size, tree.edges.length);
  assert.equal(nodes.size, tree.nodes.length);
  assert.equal(tree.nodes.length, tree.edges.length + tree.roots, "one arrival node per edge plus one base per root");
  let children = 0;
  for (const item of tree.edges) {
    const from = nodes.get(item.from)!, to = nodes.get(item.to)!;
    assert.deepEqual([...item.points[0]], [...from.position]);
    assert.deepEqual([...item.points.at(-1)!], [...to.position]);
    assert.equal(to.edgeIn, item.id);
    assert.deepEqual(item.children, to.edgesOut);
    assert.equal(item.depth, item.parent === null ? 0 : edges.get(item.parent)!.depth + 1);
    assert.equal(item.level, item.depth);
    children += item.children.length;
    for (const child of item.children) assert.equal(edges.get(child)!.parent, item.id);
    assert.equal(to.role, item.children.length === 0 ? "terminal" : "fork");
    if (to.role === "fork") assert.ok(item.children.length >= 2, "a fork has at least two outgoing edges");
  }
  assert.equal(tree.edges.length, tree.roots + children, "every non-root edge is somebody's child");
  assert.equal(tree.maxDepth, Math.max(...tree.edges.map((item) => item.depth)));
  // Independent coverage: each grown segment is a consecutive vertex pair of some edge.
  const pairs = new Set<string>();
  for (const item of tree.edges) for (let i = 1; i < item.points.length; i++)
    pairs.add(`${item.points[i - 1]}|${item.points[i]}`);
  for (const [x0, y0, x1, y1] of model.segments) assert.ok(pairs.has(`${x0},${y0}|${x1},${y1}`), `segment ${x0},${y0}→${x1},${y1} is on the tree`);
});

test("without branching there are no forks: one edge per root, ending in a terminal", () => {
  const tree = branchTree(options({ branches: 1, rootCount: 3, rootSpread: 120, ticks: 40 }));
  assert.equal(tree.roots, 3);
  assert.equal(tree.edges.length, 3);
  assert.ok(tree.nodes.every((item) => item.role !== "fork"));
  assert.equal(tree.maxDepth, 0);
});

test("ids and geometry are stable: cache identity, routing, growth length and seeds", () => {
  const a = branchTree(options()), b = branchTree(options());
  assert.equal(a, b, "identical construction returns the cached tree");
  assert.notEqual(branchTree({ ...options(), seed: 43 }), a, "a new seed is a new tree");
  for (const routing of ["smooth", "straight", "octilinear"] as const) {
    const routed = branchTree(options({ routing }));
    assert.deepEqual(routed.nodes.map((item) => item.id), a.nodes.map((item) => item.id));
    assert.deepEqual(routed.edges.map((item) => [item.id, item.depth, item.parent, item.from, item.to]),
      a.edges.map((item) => [item.id, item.depth, item.parent, item.from, item.to]));
    for (let i = 0; i < a.nodes.length; i++) assert.deepEqual([...routed.nodes[i].position], [...a.nodes[i].position]);
  }
  // Growing longer only appends: every earlier fork survives with the same id and position.
  const early = branchTree(options({ ticks: 18 })), late = branchTree(options({ ticks: 34 }));
  for (const item of early.nodes.filter((entry) => entry.role !== "terminal")) {
    const kept = node(late, item.id);
    assert.equal(kept.role === "terminal", false);
    assert.deepEqual([...kept.position], [...item.position]);
  }
  for (const item of early.edges) assert.ok(edge(late, item.id), `${item.id} survives`);
  assert.equal(a.nodes[0].seed, componentSeed(42, a.nodes[0].id, "node"));
  assert.equal(a.edges[3].seed, componentSeed(42, a.edges[3].id, "edge"));
  assert.throws(() => (a.edges as unknown as unknown[]).push(1), TypeError);
  assert.throws(() => { (a.nodes[0].position as unknown as number[])[0] = 0; }, TypeError);
});

test("routing changes edge geometry between the same nodes", () => {
  const straight = branchTree(options({ routing: "straight" }));
  assert.ok(straight.edges.every((item) => item.points.length === 2));
  const octilinear = branchTree(options({ routing: "octilinear" }));
  for (const item of octilinear.edges) {
    assert.ok(item.points.length === 2 || item.points.length === 3);
    for (let i = 1; i < item.points.length; i++) {
      const dx = Math.abs(item.points[i][0] - item.points[i - 1][0]), dy = Math.abs(item.points[i][1] - item.points[i - 1][1]);
      assert.ok(dx < 1e-9 || dy < 1e-9 || Math.abs(dx - dy) < 1e-9, "each leg is horizontal, vertical or 45°");
    }
  }
  const grown = branchTree(options({ routing: "grown" })), smooth = branchTree(options({ routing: "smooth" }));
  assert.ok(smooth.edges.some((item, i) => item.points.length > grown.edges[i].points.length));
  for (let i = 0; i < grown.edges.length; i++) {
    assert.deepEqual([...smooth.edges[i].points[0]], [...grown.edges[i].points[0]]);
    assert.deepEqual([...smooth.edges[i].points.at(-1)!], [...grown.edges[i].points.at(-1)!]);
  }
});

/** Independent proper-crossing test between segments (p1,p2) and (p3,p4). */
const crosses = (p1: readonly number[], p2: readonly number[], p3: readonly number[], p4: readonly number[]) => {
  const side = (a: readonly number[], b: readonly number[], c: readonly number[]) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  return side(p1, p2, p3) * side(p1, p2, p4) < 0 && side(p3, p4, p1) * side(p3, p4, p2) < 0;
};
const selfCrossings = (line: readonly (readonly [number, number])[]) => {
  let count = 0;
  for (let i = 0; i < line.length - 1; i++) for (let j = i + 2; j < line.length - 1; j++)
    if (crosses(line[i], line[i + 1], line[j], line[j + 1])) count++;
  return count;
};

test("removeLoops cuts a loop at its crossing and keeps both ends", () => {
  const line = [[0, 0], [10, 0], [10, 10], [5, 10], [5, -5], [20, -5]] as const;
  assert.equal(selfCrossings(line), 1);
  const cut = removeLoops(line);
  assert.deepEqual(cut.map((p) => [...p]), [[0, 0], [5, 0], [5, -5], [20, -5]]);
  const open = [[0, 0], [4, 1], [8, 0], [12, 3]] as const;
  assert.deepEqual(removeLoops(open).map((p) => [...p]), open.map((p) => [...p]));
  // Two loops in one run, and a double crossing, all resolve: no crossings remain, ends kept, never longer.
  let state = 12345;
  const next = () => (state = (state * 1664525 + 1013904223) >>> 0) / 0x1_0000_0000;
  const length = (points: readonly (readonly [number, number])[]) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);
  let cutSome = 0;
  for (let trial = 0; trial < 200; trial++) {
    const random = Array.from({ length: 4 + Math.floor(next() * 12) }, () => [next() * 100, next() * 100] as const);
    const result = removeLoops(random);
    assert.equal(selfCrossings(result), 0);
    assert.deepEqual([...result[0]], [...random[0]]);
    assert.deepEqual([...result.at(-1)!], [...random.at(-1)!]);
    assert.ok(length(result) <= length(random) + 1e-9);
    if (selfCrossings(random) > 0) cutSome++;
  }
  assert.ok(cutSome > 100, "the property was exercised on crossing polylines");
});

test("smooth routing never lets a run cross itself, and only the loops are removed from the grown run", () => {
  let grownCrossings = 0;
  for (const seed of [42, 7, 19, 3, 11, 23]) {
    const grown = branchTree({ ...options({ routing: "grown", ticks: 46 }), seed }), smooth = branchTree({ ...options({ routing: "smooth", ticks: 46 }), seed });
    grown.edges.forEach((item, i) => {
      grownCrossings += selfCrossings(item.points);
      assert.equal(selfCrossings(smooth.edges[i].points), 0, `${item.id} of seed ${seed}`);
      assert.deepEqual([...smooth.edges[i].points[0]], [...item.points[0]]);
      assert.deepEqual([...smooth.edges[i].points.at(-1)!], [...item.points.at(-1)!]);
    });
  }
  assert.ok(grownCrossings > 0, "grown edges do loop, so the rule is doing work");
});

test("auto roots fit the footprint: one under an area or ring, one under each lobe, along its direction", () => {
  const area = fitRoots({ sourceMode: "area", extent: 400, aspect: 1.5, direction: 0, centerX: 300, centerY: 200, lobeGap: .3 });
  assert.deepEqual(area, { rootCount: 1, rootSpread: 0, rootJitter: 0, rootX: 300, rootY: 200 + 300 + 70, rootHeading: 0 });
  // Turned a quarter, the footprint's vertical half-extent is its width's radius.
  near(fitRoots({ sourceMode: "ring", extent: 400, aspect: 1.5, direction: 90, centerX: 300, centerY: 200, lobeGap: 0 }).rootY, 200 + 200 + 70, 1e-9);
  const lobes = fitRoots({ sourceMode: "two-lobe", extent: 400, aspect: 1, direction: 0, centerX: 300, centerY: 200, lobeGap: .5 });
  assert.equal(lobes.rootCount, 2);
  near(lobes.rootSpread, 200 * 1.5, 1e-9);
  near(lobes.rootY, 200 + 200 * .5 / 2 + 70, 1e-9);
  assert.equal(fitRoots({ sourceMode: "area", extent: 1000, aspect: 1, direction: 0, centerX: 300, centerY: 500, lobeGap: 0 }).rootY, 600);
  assert.equal(fitRoots({ sourceMode: "two-lobe", extent: 400, aspect: 1, direction: 30, centerX: 300, centerY: 200, lobeGap: .3 }).rootHeading, 30);
});

test("root placement: auto reaches both lobes and ignores the manual root controls; manual uses them", () => {
  const input = createInstrument("branch-ornament");
  Object.assign(input.params, { sourceMode: "two-lobe", lobeGap: .3 });
  const auto = branchOrnamentComposition(input);
  assert.equal(auto.tree.rootCount, 2);
  const tree = branchTree(auto.tree);
  const ends = tree.nodes.filter((item) => item.role === "terminal");
  assert.ok(ends.some((item) => item.position[0] < 320 - 20) && ends.some((item) => item.position[0] > 320 + 20), "growth reaches both lobes");
  const other = createInstrument("branch-ornament");
  Object.assign(other.params, { sourceMode: "two-lobe", lobeGap: .3, rootX: 50, rootY: 20, rootCount: 5, rootSpread: 3, rootHeading: 77, rootJitter: 9 });
  assert.deepEqual(branchOrnamentComposition(other).tree, auto.tree, "hidden manual values change nothing in auto");
  const manual = createInstrument("branch-ornament");
  Object.assign(manual.params, { rootPlacement: "manual", rootCount: 3, rootSpread: 150, rootX: 200, rootY: 500, rootHeading: 10, rootJitter: 0 });
  const tree3 = branchOrnamentComposition(manual).tree;
  assert.deepEqual([tree3.rootCount, tree3.rootSpread, tree3.rootX, tree3.rootY, tree3.rootHeading], [3, 150, 200, 500, 10]);
  Object.assign(manual.params, { rootCount: 2, rootSpread: 0 });
  assert.throws(() => branchOrnamentComposition(manual), /positive root spread/);
});

test("a fork frame is defined even when its outgoing edges nearly cancel", () => {
  // Unit-level: opposite branches cancel exactly; the arriving heading decides.
  near(forkAxis([1, 0], [[0, 1], [0, -1]]), 0);
  near(forkAxis([0, 1], [[1, 0], [-1, 0]]), Math.PI / 2);
  near(forkAxis([-1, 0], [[Math.cos(0), Math.sin(0)], [Math.cos(2 * Math.PI / 3), Math.sin(2 * Math.PI / 3)], [Math.cos(-2 * Math.PI / 3), Math.sin(-2 * Math.PI / 3)]]), Math.PI);
  near(Math.abs(forkAxis([0, 1], [[1e-9, 1], [1e-9, -1]])), Math.PI / 2, 1e-12);
  // Otherwise the children's mean direction.
  near(forkAxis([0, 1], [[1, 0], [Math.SQRT1_2, Math.SQRT1_2]]), Math.atan2(Math.SQRT1_2, 1 + Math.SQRT1_2));
  assert.throws(() => forkAxis([1, 0], []));
  // Whole trees: children a right angle either side of the heading sum to zero.
  const tree = branchTree(options({ routing: "grown", branchSpread: 90 }));
  const forks = tree.nodes.filter((item) => item.role === "fork");
  assert.ok(forks.length > 10);
  for (const item of forks) {
    assert.ok(Number.isFinite(item.angle));
    const [first, second] = item.edgesOut.map((id) => edge(tree, id).points);
    const a = Math.atan2(first[1][1] - first[0][1], first[1][0] - first[0][0]);
    const b = Math.atan2(second[1][1] - second[0][1], second[1][0] - second[0][0]);
    near(Math.abs(turn(a - b)), Math.PI, 1e-6);
    near(turn(item.angle - item.heading), 0, 1e-9);
  }
  // A wide-open fork with non-cancelling children follows their mean (straight routing makes them uneven).
  for (const item of branchTree(options({ routing: "straight" })).nodes.filter((entry) => entry.role === "fork")) {
    const routed = branchTree(options({ routing: "straight" }));
    let x = 0, y = 0;
    for (const id of item.edgesOut) {
      const points = edge(routed, id).points, dx = points[1][0] - points[0][0], dy = points[1][1] - points[0][1], length = Math.hypot(dx, dy);
      x += dx / length; y += dy / length;
    }
    x /= item.edgesOut.length; y /= item.edgesOut.length;
    if (Math.hypot(x, y) >= .25) near(turn(item.angle - Math.atan2(y, x)), 0, 1e-9);
    else near(turn(item.angle - item.heading), 0, 1e-9);
  }
});

test("terminal and trunk frames follow the branch direction", () => {
  const tree = branchTree(options({ routing: "straight" }));
  for (const item of tree.nodes) {
    if (item.role === "fork") continue;
    const line = edge(tree, item.role === "trunk" ? item.edgesOut[0] : item.edgeIn!), points = line.points;
    const [a, b] = item.role === "trunk" ? [points[0], points[1]] : [points.at(-2)!, points.at(-1)!];
    near(turn(item.angle - Math.atan2(b[1] - a[1], b[0] - a[0])), 0, 1e-9);
  }
});

test("attachment sites: identity, window, offset, inheritance and falloff", () => {
  const tree = branchTree(options());
  const plain = attachmentSites(tree, attach("terminal"));
  assert.equal(plain.length, tree.nodes.filter((item) => item.role === "terminal").length);
  assert.ok(plain.every((site, i) => site.id === `terminal@${tree.nodes.filter((item) => item.role === "terminal")[i].id}`));
  assert.equal(attachmentSites(tree, attach("terminal")), plain, "cached per tree and options");
  const moved = attachmentSites(tree, attach("terminal", { offset: 7, inherit: .25, falloff: .5 }));
  assert.deepEqual(moved.map((site) => site.id), plain.map((site) => site.id));
  const tips = tree.nodes.filter((item) => item.role === "terminal");
  moved.forEach((site, i) => {
    near(site.position[0], tips[i].position[0] + 7 * Math.cos(tips[i].angle));
    near(site.position[1], tips[i].position[1] + 7 * Math.sin(tips[i].angle));
    near(site.scale, Math.max(.05, 1 - .5 * tips[i].depth / tree.maxDepth));
    assert.equal(site.depth, tips[i].depth);
    assert.equal(site.tone, 2);
  });
  // A depth window filters without renaming or moving the rest.
  const window = attachmentSites(tree, attach("terminal", { minDepth: 4, maxDepth: 6 }));
  assert.ok(window.length > 0 && window.length < plain.length);
  for (const site of window) {
    const same = plain.find((item) => item.id === site.id)!;
    assert.deepEqual([...site.position], [...same.position]);
    assert.ok(site.depth >= 4 && site.depth <= 6);
  }
  assert.equal(attachmentSites(tree, attach("trunk", { minDepth: 1 })).length, 0, "the trunk sits at depth 0");
  assert.equal(attachmentSites(tree, attach("fork")).length, tree.nodes.filter((item) => item.role === "fork").length);
  // Falloff never reaches zero, and is 1 - falloff * depth / maxDepth in between.
  const deepest = attachmentSites(tree, attach("terminal", { falloff: .95 })).reduce((least, site) => Math.min(least, site.scale), 1);
  assert.ok(deepest >= .05 && deepest < .5);
  assert.throws(() => attachmentSites(tree, attach("terminal", { falloff: .96 })), /falloff/);
  assert.throws(() => attachmentSites(tree, attach("terminal", { inherit: 1.1 })), /inherit/);
  assert.throws(() => attachmentSites(tree, attach("flank")), /Flank/);
});

test("following branch visibility re-reads roles from the visible edges", () => {
  const tree = branchTree(options({ routing: "grown", branches: 3, ticks: 30 }));
  const visible = { minDepth: 0, maxDepth: 450, retention: .6 };
  const shown = new Set(visibleEdges(tree, visible).map((item) => item.id));
  assert.ok(shown.size > 10 && shown.size < tree.edges.length);
  const out = (item: BranchTree["nodes"][number]) => item.edgesOut.filter((id) => shown.has(id));
  const eligible = tree.nodes.filter((item) => item.role === "trunk" ? out(item).length > 0 : shown.has(item.edgeIn!));
  const expected = (role: string) => eligible.filter((item) => item.role === "trunk" ? role === "trunk"
    : role === "terminal" ? out(item).length === 0 : role === "fork" ? out(item).length >= 2 : false);
  for (const role of ["trunk", "fork", "terminal"] as const) {
    const sites = attachmentSites(tree, attach(role, { visible }));
    assert.deepEqual(sites.map((site) => site.id), expected(role).map((item) => `${role}@${item.id}`), `${role} sites`);
  }
  // A pruned end is a tip: cutting at depth 2 turns every fork there into a terminal, framed by its arriving heading.
  const cut = { minDepth: 0, maxDepth: 2, retention: 1 };
  const pruned = tree.nodes.filter((item) => item.role === "fork" && item.depth === 2);
  assert.ok(pruned.length > 0);
  const tips = attachmentSites(tree, attach("terminal", { visible: cut }));
  for (const item of pruned) near(turn(tips.find((site) => site.owner === item.id)!.angle - item.heading), 0, 1e-9);
  assert.deepEqual(tips.map((site) => site.owner), tree.nodes.filter((item) => item.depth <= 2 && item.role !== "trunk" && (item.role === "terminal" || item.depth === 2)).map((item) => item.id));
  // A fork that lost a branch is re-framed from the branches that remain.
  const forks = attachmentSites(tree, attach("fork", { visible }));
  let reframed = 0;
  for (const site of forks) {
    const item = node(tree, site.owner), children = out(item);
    let x = 0, y = 0;
    for (const id of children) {
      const points = edge(tree, id).points, dx = points[1][0] - points[0][0], dy = points[1][1] - points[0][1], length = Math.hypot(dx, dy);
      x += dx / length; y += dy / length;
    }
    x /= children.length; y /= children.length;
    near(turn(site.angle - (Math.hypot(x, y) >= .25 ? Math.atan2(y, x) : item.heading)), 0, 1e-9);
    if (children.length < item.edgesOut.length) reframed++;
  }
  assert.ok(reframed > 0, "some fork lost a branch but kept two");
  // Flanks need their own edge; without `visible` they ignore it.
  const flanks = attachmentSites(tree, flank(30, 40, "single", { visible }));
  assert.ok(flanks.every((site) => shown.has(site.owner)));
  assert.ok(attachmentSites(tree, flank(30, 40, "single")).length > flanks.length);
  // With everything visible the visible-tree roles are the full tree's.
  const all = { minDepth: 0, maxDepth: 450, retention: 1 };
  for (const role of ["trunk", "fork", "terminal"] as const)
    assert.deepEqual(attachmentSites(tree, attach(role, { visible: all })).map((site) => site.id), attachmentSites(tree, attach(role)).map((site) => site.id));
});

test("angle inheritance blends from canvas-up along the shortest arc", () => {
  near(inheritAngle(0, 0), -Math.PI / 2);
  near(inheritAngle(1.234, 1), 1.234);
  near(inheritAngle(0, .5), -Math.PI / 4);
  near(inheritAngle(-Math.PI / 2, .3), -Math.PI / 2);
  near(inheritAngle(Math.PI, .5), -Math.PI / 2 + .5 * (Math.PI + Math.PI / 2 - 2 * Math.PI), 1e-12);
  const tree = branchTree(options());
  const none = attachmentSites(tree, attach("terminal", { inherit: 0 }));
  assert.ok(none.every((site) => Math.abs(site.angle + Math.PI / 2) < 1e-12));
});

test("flank stations: arc-length spacing, sides, mirrors and stable ids", () => {
  const tree = branchTree(single), [a, b] = [tree.nodes[0].position, tree.nodes[1].position];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]), heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const spacing = 20, count = Math.floor(length / spacing);
  assert.equal(count, 4);
  const alternate = attachmentSites(tree, flank(spacing, 50, "alternate"));
  assert.equal(alternate.length, count);
  alternate.forEach((site, i) => {
    const s = (i + .5) * spacing, side = i % 2 === 0 ? 1 : -1;
    near(site.position[0], a[0] + s * Math.cos(heading), 1e-9);
    near(site.position[1], a[1] + s * Math.sin(heading), 1e-9);
    near(turn(site.angle - (heading + side * 50 * Math.PI / 180)), 0, 1e-12);
    assert.equal(Math.sign(site.scale), side, "the negative side is mirrored");
    assert.equal(site.id, `flank@${tree.edges[0].id}#${i}${side > 0 ? "+" : "-"}`);
  });
  const paired = attachmentSites(tree, flank(spacing, 50, "paired")), oneSide = attachmentSites(tree, flank(spacing, 50, "single"));
  assert.equal(paired.length, 2 * count);
  assert.equal(oneSide.length, count);
  assert.ok(oneSide.every((site) => site.id.endsWith("+") && site.scale > 0));
  const ids = new Set(paired.map((site) => site.id));
  for (const site of [...alternate, ...oneSide]) assert.ok(ids.has(site.id), "a station keeps its id across the side modes");
  // Offset moves along the flank's own axis.
  const out = attachmentSites(tree, flank(spacing, 50, "single", { offset: 9 }));
  near(out[0].position[0], oneSide[0].position[0] + 9 * Math.cos(heading + 50 * Math.PI / 180));
  // No station sits within half a spacing of either end.
  const first = Math.hypot(alternate[0].position[0] - a[0], alternate[0].position[1] - a[1]);
  const last = Math.hypot(alternate[count - 1].position[0] - b[0], alternate[count - 1].position[1] - b[1]);
  assert.ok(first >= spacing / 2 - 1e-9 && last >= spacing / 2 - 1e-9);
  assert.equal(attachmentSites(tree, flank(200, 50, "paired")).length, 0, "an edge shorter than a spacing has no stations");
  assert.throws(() => attachmentSites(tree, flank(.5, 50, "single")), /spacing/);
  assert.throws(() => attachmentSites(branchTree(options({ sourceCount: 150, ticks: 60, step: 10, reach: 16, branchSpread: 60 })), flank(1, 50, "paired")), /Flank attachments would create/);
});

test("outline ribbons have the analytic area of their branch", () => {
  const tree = branchTree(single), length = tree.edges[0].length;
  const area = (ring: readonly (readonly [number, number])[]) => {
    let sum = 0;
    for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; sum += p[0] * q[1] - q[0] * p[1]; }
    return Math.abs(sum) / 2;
  };
  const shape = { minDepth: 0, maxDepth: 450, retention: 1, width: 6, falloff: .8, tone: 3 };
  const [parallel] = branchOutline(tree, { ...shape, taper: 0 });
  near(area(parallel.points), 2 * 6 * length, 1e-6);
  assert.equal(parallel.closed, true);
  assert.equal(parallel.id, `outline:${tree.edges[0].id}`);
  const [blade] = branchOutline(tree, { ...shape, taper: 1 });
  near(area(blade.points), 6 * length, 1e-6);
  const [half] = branchOutline(tree, { ...shape, taper: .5 });
  near(area(half.points), 2 * 6 * length * .75, 1e-6);
  // Every vertex of a parallel ribbon is exactly the half-width from the branch line.
  const [ax, ay, bx, by] = [320, 540, tree.nodes[1].position[0], tree.nodes[1].position[1]];
  for (const [x, y] of parallel.points) near(Math.abs((x - ax) * (by - ay) - (y - ay) * (bx - ax)) / length, 6, 1e-9);
  assert.equal(branchOutline(tree, { ...shape, width: 0, taper: 0 }).length, 0);
  assert.throws(() => branchOutline(tree, { ...shape, taper: 2 }), /taper/);
  // Half-width falls by `falloff` per depth: straight edges give exact rectangles.
  const deep = branchTree(options({ routing: "straight" }));
  const fall = branchOutline(deep, { ...shape, falloff: .5, taper: 0 });
  assert.equal(fall.length, deep.edges.length);
  assert.ok(deep.maxDepth >= 3);
  fall.forEach((ribbon, i) => near(area(ribbon.points), 2 * (6 * .5 ** deep.edges[i].depth) * deep.edges[i].length, 1e-6));
});

test("visibility filters by depth and stable retention without touching the tree", () => {
  const tree = branchTree(options());
  const all = visibleEdges(tree, { minDepth: 0, maxDepth: 450, retention: 1 });
  assert.equal(all.length, tree.edges.length);
  assert.equal(visibleEdges(tree, { minDepth: 0, maxDepth: 450, retention: 1 }), all);
  const shallow = visibleEdges(tree, { minDepth: 0, maxDepth: 2, retention: 1 });
  assert.deepEqual(shallow.map((item) => item.id), tree.edges.filter((item) => item.depth <= 2).map((item) => item.id));
  const some = visibleEdges(tree, { minDepth: 0, maxDepth: 450, retention: .5 }), fewer = visibleEdges(tree, { minDepth: 0, maxDepth: 450, retention: .25 });
  assert.ok(fewer.length < some.length && some.length < all.length);
  const kept = new Set(some.map((item) => item.id));
  assert.ok(fewer.every((item) => kept.has(item.id)), "raising retention only adds edges");
  assert.equal(visibleEdges(tree, { minDepth: 0, maxDepth: 450, retention: 0 }).length, 0);
  assert.throws(() => visibleEdges(tree, { minDepth: 0, maxDepth: 3, retention: 1.5 }), /retention/);
});

test("switching marks, materials and palette leaves the tree and its sites untouched", () => {
  const input = createInstrument("branch-ornament");
  const recipe = branchOrnamentComposition(input);
  const tree = branchTree(recipe.tree), sites = attachmentSites(tree, recipe.ornaments.find((item) => item.attach.role === "terminal")!.attach);
  const changed = createInstrument("branch-ornament");
  Object.assign(changed.params, { terminalMark: "arrow", terminalSize: 30, edgeMaterial: "stitch", edgeWeight: 1, outlineWidth: 0, flankMark: "none", forkMark: "rings" });
  changed.palette = [0x102030, 0x405060, 0x708090, 0xa0b0c0];
  const other = branchOrnamentComposition(changed);
  assert.equal(branchTree(other.tree), tree);
  assert.equal(attachmentSites(branchTree(other.tree), other.ornaments.find((item) => item.attach.role === "terminal")!.attach), sites);
  // A structural edit builds a different tree.
  const grown = createInstrument("branch-ornament");
  grown.params.branchSpread = 41;
  assert.notEqual(branchTree(branchOrnamentComposition(grown).tree), tree);
});

test("the descriptor draws exactly what the ordinary functions draw", () => {
  const recipe = branchOrnamentComposition(createInstrument("branch-ornament"));
  const viaDescriptor = new Recorder();
  drawBranchOrnament(viaDescriptor, recipe);
  const tree = branchTree(recipe.tree), manual = new Recorder();
  const visible = { ...recipe.visibility };
  strokeWith(manual, branchOutline(tree, { ...visible, ...recipe.outline!.shape }), pathMaterial(recipe.outline!.material, recipe.palette));
  const edgeSpec = recipe.edges!;
  strokeWith(manual, visibleEdges(tree, visible), (surface, path, run) => {
    const weight = Math.max(edgeSpec.material.weight * edgeSpec.falloff ** path.level, Math.min(edgeSpec.material.weight, .25));
    pathMaterial({ ...edgeSpec.material, weight }, recipe.palette)(surface, path, run);
  });
  for (const { mark, attach: options } of recipe.ornaments)
    atEach(manual, attachmentSites(tree, options), motif(mark, recipe.palette));
  assert.ok(viaDescriptor.ops.length > 500);
  assert.deepEqual(viaDescriptor.ops, manual.ops);
});

test("consumers are substitutable: custom callbacks see the same immutable sites and paths", () => {
  const recipe = branchOrnamentComposition(createInstrument("branch-ornament"));
  const tree = branchTree(recipe.tree);
  const seen: Record<string, string[]> = { terminal: [], fork: [], trunk: [], flank: [] };
  const paths: string[] = [], outlines: string[] = [];
  const record = (role: string) => (surface: CompositionSurface, site: Site) => { seen[role].push(site.id); surface.circle(0, 0, 1); };
  const recorder = new Recorder();
  drawBranchOrnament(recorder, { ...recipe, visibility: { minDepth: 0, maxDepth: 1, retention: 1 } }, {
    edge: (_surface, path) => { paths.push(path.id); },
    outline: (_surface, path) => { outlines.push(path.id); },
    marks: { terminal: record("terminal"), fork: record("fork"), trunk: record("trunk"), flank: record("flank") },
  });
  assert.deepEqual(paths, tree.edges.filter((item) => item.depth <= 1).map((item) => item.id));
  assert.deepEqual(outlines, tree.edges.filter((item) => item.depth <= 1).map((item) => `outline:${item.id}`));
  for (const item of recipe.ornaments)
    assert.deepEqual(seen[item.attach.role], attachmentSites(tree, item.attach).map((site) => site.id));
  // Branch visibility hides edges, never the marks attached to hidden branches.
  assert.ok(seen.terminal.length > tree.nodes.filter((item) => item.role === "terminal" && item.depth <= 1).length);
  assert.equal(recorder.ops.filter((op) => op.startsWith("circle")).length,
    seen.terminal.length + seen.fork.length + seen.trunk.length + seen.flank.length);
});

test("bounded work and errors are explicit", () => {
  const recipe: BranchOrnamentComposition = branchOrnamentComposition(createInstrument("branch-ornament"));
  assert.throws(() => branchTree({ ...recipe.tree, routing: "curly" as never }), /Unknown branch routing/);
  assert.throws(() => branchTree({ ...recipe.tree, seed: -1 }), /uint32/);
  assert.throws(() => branchTree({ ...recipe.tree, sourceCount: 450, branches: 5, ticks: 100 }), /budget exceeded/);
  assert.throws(() => branchTree({ ...recipe.tree, rootCount: 2, rootSpread: 0 }), /positive root spread/);
  assert.throws(() => branchTree({ ...recipe.tree, step: 0 }), /outside supported domain/);
  const empty = branchTree({ ...recipe.tree, ticks: 0 });
  assert.equal(empty.nodes.length, 0);
  assert.equal(empty.edges.length, 0);
  assert.equal(empty.maxDepth, 0);
  assert.equal(attachmentSites(empty, attach("terminal")).length, 0);
  const drawn = new Recorder();
  drawBranchOrnament(drawn, { ...recipe, tree: { ...recipe.tree, ticks: 0 } });
  assert.deepEqual(drawn.ops, [], "an empty tree is a valid empty drawing");
  // A second root that finds every attractor already taken never grows and is reported.
  const barren = branchTree(options({ sourceCount: 1, extent: 1, centerX: 320, centerY: 540, disorder: 0, exclusion: 0, rootCount: 2, rootSpread: 2, rootJitter: 0, rootX: 320, rootY: 540, reach: 30, ticks: 5 }));
  assert.equal(barren.roots, 1);
  assert.equal(barren.barrenRoots, 1);
  assert.equal(barren.edges.length, 1);
  const stale = createInstrument("branch-ornament");
  assert.throws(() => branchOrnamentComposition({ ...stale, params: { ...stale.params, ticks: 999 } }), /between 0 and 160/);
});

test("the named instrument resolves, validates and prepares cooperatively", async () => {
  const input = createInstrument("branch-ornament");
  assert.equal(canPrepareInstrument("branch-ornament"), true);
  assert.equal(await prepareInstrument(input, () => true), false, "cancellation publishes nothing");
  assert.equal(await prepareInstrument(input, () => false), true);
  const recipe = branchOrnamentComposition(input);
  assert.equal(recipe.kind, "branch-ornament");
  assert.deepEqual(recipe.palette, input.palette);
  assert.equal(recipe.tree.seed, input.seed);
  assert.equal(recipe.ornaments.length, 4);
  assert.equal(recipe.outline?.shape.width, input.params.outlineWidth);
  const off = createInstrument("branch-ornament");
  Object.assign(off.params, { edgeMaterial: "none", outlineWidth: 0, terminalMark: "none", forkMark: "none", trunkMark: "none", flankMark: "none" });
  const bare = branchOrnamentComposition(off);
  assert.equal(bare.edges, null);
  assert.equal(bare.outline, null);
  assert.equal(bare.ornaments.length, 0);
  assert.throws(() => branchOrnamentComposition({ ...input, technique: "fold-atlas" }), /Not a branch-ornament/);
  assert.throws(() => branchOrnamentComposition({ ...input, palette: [] }), /packed RGB/);
  assert.throws(() => branchOrnamentComposition({ ...input, params: { ...input.params, routing: "bad" } }), /not an available option/);
});
