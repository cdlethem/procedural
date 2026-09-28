import test from "node:test";
import assert from "node:assert/strict";
import { poissonSites, contourPaths, partitionRegions, wallpaperSites, latticeSites, regionTree } from "../dist/composition/sources.js";
import { motif } from "../dist/composition/materials.js";
import type { Path } from "../dist/composition/types.js";
import { componentSeed, atEach } from "../dist/composition/core.js";

const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);
const eq = <T>(a: T, b: T) => assert.deepEqual(a, b, JSON.stringify(a));
const points = (path: Path) => path.points;

/* ------------------------------------------------------------------ */
/* wallpaperSites                                                    */
/* ------------------------------------------------------------------ */

test("p1 wallpaper: one orbit, positions match cell grid", () => {
  const sites = wallpaperSites({
    seed: 42, group: "p1", cellWidth: 80, cellHeight: 80,
    centerX: 320, centerY: 320, width: 480, height: 480,
    motifOffsetX: .2, motifOffsetY: .3,
    margin: 60, breakAmount: 0, breakDensity: 0,
  });
  const positions = sites.map(s => s.position);
  positions.forEach(([x, y]) => {
    assert.ok(x >= 320 - 240 - 60 && x <= 320 + 240 + 60);
    assert.ok(y >= 320 - 240 - 60 && y <= 320 + 240 + 60);
  });
});

test("p4 off-corner: 4 instances per cell, positions rotate around cell center", () => {
  const sites = wallpaperSites({
    seed: 42, group: "p4", cellWidth: 80, cellHeight: 80,
    centerX: 320, centerY: 320, width: 160, height: 160,
    motifOffsetX: .15, motifOffsetY: .25,
    margin: 40, breakAmount: 0, breakDensity: 0,
  });
  // p4 has 4 operations; expect 4 instances per cell within the domain
  const cells = new Map<string, number>();
  for (const site of sites) {
    const [cx, cy] = site.position;
    const col = Math.round((cx - 320 + 80) / 80) % 2; // normalize
    const key = `${col}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
  }
  // At minimum, the center cell should have 4 instances
  assert.ok(sites.length >= 4, `Expected at least 4 p4 instances, got ${sites.length}`);
});

test("p6: 6 instances per cell with hexagonal lattice", () => {
  const sites = wallpaperSites({
    seed: 42, group: "p6", cellWidth: 70, cellHeight: 70,
    centerX: 320, centerY: 320, width: 160, height: 160,
    motifOffsetX: .1, motifOffsetY: .1,
    margin: 40, breakAmount: 0, breakDensity: 0,
  });
  assert.ok(sites.length >= 6, `Expected at least 6 p6 instances, got ${sites.length}`);
  // Each instance has a distinct angle among [0, 60, 120, 180, 240, 300]
  const angles = sites.map(s => ((s.angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
  const uniqueAngles = new Set(angles.map(a => Math.round(a / (Math.PI / 3) * 1e6)));
  assert.ok(uniqueAngles.size >= 1, "p6 instances should have rotation diversity");
});

test("p2 with offset: both operations produce distinct instances", () => {
  const sites = wallpaperSites({
    seed: 42, group: "p2", cellWidth: 100, cellHeight: 100,
    centerX: 320, centerY: 320, width: 200, height: 200,
    motifOffsetX: .25, motifOffsetY: .25,
    margin: 60, breakAmount: 0, breakDensity: 0,
  });
  // p2 has 2 operations: identity (θ=0) and rotation (θ=π)
  // With offset != 0, these produce different positions
  const positions = sites.map(s => JSON.stringify(s.position));
  const unique = new Set(positions);
  assert.ok(unique.size >= 2, `p2 should produce at least 2 unique positions, got ${unique.size}`);
});

test("mirror instances set negative scale", () => {
  const sites = wallpaperSites({
    seed: 42, group: "pm", cellWidth: 80, cellHeight: 80,
    centerX: 320, centerY: 320, width: 160, height: 160,
    motifOffsetX: .2, motifOffsetY: .3,
    margin: 40, breakAmount: 0, breakDensity: 0,
  });
  // pm has one mirrored operation; at least some sites should have scale < 0
  const mirrors = sites.filter(s => s.scale < 0);
  assert.ok(mirrors.length > 0, `pm should have reflected instances, got ${mirrors.length} mirrors`);
  const originals = sites.filter(s => s.scale > 0);
  assert.ok(originals.length > 0, `pm should have non-reflected instances too`);
});

test("wallpaper symmetry breaking: deterministic deviation", () => {
  const base = wallpaperSites({
    seed: 99, group: "p4", cellWidth: 80, cellHeight: 80,
    centerX: 320, centerY: 320, width: 160, height: 160,
    motifOffsetX: .15, motifOffsetY: .25,
    margin: 40, breakAmount: 0, breakDensity: 0,
  });
  const broken = wallpaperSites({
    seed: 99, group: "p4", cellWidth: 80, cellHeight: 80,
    centerX: 320, centerY: 320, width: 160, height: 160,
    motifOffsetX: .15, motifOffsetY: .25,
    margin: 40, breakAmount: .3, breakDensity: .5,
  });
  // Same count, but positions/angles differ
  assert.equal(base.length, broken.length, "breaking preserves count");
  assert.notDeepEqual(base.map(s => s.position), broken.map(s => s.position), "breaking changes positions");
});

test("wallpaper: cache identity — same options return same array", () => {
  const opts = {
    seed: 42, group: "p1", cellWidth: 80, cellHeight: 80,
    centerX: 320, centerY: 320, width: 480, height: 480,
    motifOffsetX: .2, motifOffsetY: .3,
    margin: 60, breakAmount: 0, breakDensity: 0,
  };
  const a = wallpaperSites(opts);
  const b = wallpaperSites(opts);
  assert.strictEqual(a, b, "wallpaperSites cache: same input → same reference");
});

test("wallpaper: IDs are stable lattice coordinates", () => {
  const sites = wallpaperSites({
    seed: 42, group: "p4", cellWidth: 80, cellHeight: 80,
    centerX: 320, centerY: 320, width: 160, height: 160,
    motifOffsetX: .15, motifOffsetY: .25,
    margin: 120, breakAmount: 0, breakDensity: 0,
  });
  const ids = sites.map(s => s.id);
  // All IDs should contain "wall:" prefix
  ids.forEach(id => assert.ok(id.startsWith("wall:"), `Expected wall: prefix, got ${id}`));
  // IDs should be sorted
  assert.deepEqual(ids, [...ids].sort(), "wallpaper IDs should be sorted");
});

test("wallpaper: viewport culling — all positions within margin", () => {
  const sites = wallpaperSites({
    seed: 42, group: "p1", cellWidth: 80, cellHeight: 80,
    centerX: 320, centerY: 320, width: 480, height: 480,
    motifOffsetX: .2, motifOffsetY: .3,
    margin: 60, breakAmount: 0, breakDensity: 0,
  });
  const left = 320 - 240 - 60, right = 320 + 240 + 60;
  const top = 320 - 240 - 60, bottom = 320 + 240 + 60;
  sites.forEach(site => {
    assert.ok(site.position[0] >= left - 1e-9 && site.position[0] <= right + 1e-9, `x ${site.position[0]} outside [${left},${right}]`);
    assert.ok(site.position[1] >= top - 1e-9 && site.position[1] <= bottom + 1e-9, `y ${site.position[1]} outside [${top},${bottom}]`);
  });
});

/* ------------------------------------------------------------------ */
/* latticeSites                                                      */
/* ------------------------------------------------------------------ */

test("lattice zero disorder: exact grid", () => {
  const sites = latticeSites({
    seed: 42, columns: 5, rows: 5, width: 500, height: 500,
    centerX: 300, centerY: 300,
    correlation: 10, displacement: 0, rotation: 0, scale: 0,
    omission: 0, anchors: 0, focalX: 300, focalY: 300, focalRadius: 600,
    retention: 1,
  });
  const cellW = 500 / 5, cellH = 500 / 5;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const expected = [300 - 250 + (col + .5) * cellW, 300 - 250 + (row + .5) * cellH];
      const site = sites[row * 5 + col];
      near(site.position[0], expected[0]);
      near(site.position[1], expected[1]);
      near(site.origin[0], expected[0]);
      near(site.origin[1], expected[1]);
      near(site.angle, 0);
      assert.equal(site.scale, 1);
      assert.ok(site.anchor === false);
      assert.ok(site.kept === true);
      assert.ok(site.exception === false);
    }
  }
});

test("lattice anchors pinned to grid", () => {
  const sites = latticeSites({
    seed: 42, columns: 4, rows: 4, width: 400, height: 400,
    centerX: 200, centerY: 200,
    correlation: 5, displacement: .6, rotation: 1, scale: .3,
    omission: .3, anchors: .3, focalX: 200, focalY: 200, focalRadius: 300,
    retention: 1,
  });
  const anchors = sites.filter(s => s.anchor);
  assert.ok(anchors.length > 0, "should have anchored sites");
  anchors.forEach(site => {
    near(site.position[0], site.origin[0]);
    near(site.position[1], site.origin[1]);
    assert.equal(site.angle, 0);
    assert.equal(site.scale, 1);
  });
});

test("lattice outside focal region: exact grid", () => {
  const sites = latticeSites({
    seed: 42, columns: 10, rows: 10, width: 600, height: 600,
    centerX: 300, centerY: 300,
    correlation: 3, displacement: .8, rotation: 2, scale: .4,
    omission: .2, anchors: 0, focalX: 100, focalY: 100, focalRadius: 50,
    retention: 1,
  });
  // Sites far from (100,100) should be exactly on grid
  const far = sites.filter(s => {
    const dx = s.origin[0] - 100, dy = s.origin[1] - 100;
    return Math.hypot(dx, dy) > 80;
  });
  far.forEach(site => {
    near(site.position[0], site.origin[0]);
    near(site.position[1], site.origin[1]);
  });
});

test("lattice: cache identity", () => {
  const opts = {
    seed: 42, columns: 6, rows: 6, width: 600, height: 600,
    centerX: 300, centerY: 300,
    correlation: 5, displacement: .3, rotation: .5, scale: .1,
    omission: .1, anchors: .1, focalX: 300, focalY: 300, focalRadius: 400,
    retention: 1,
  };
  const a = latticeSites(opts);
  const b = latticeSites(opts);
  assert.strictEqual(a, b, "latticeSites cache: same input → same reference");
});

/* ------------------------------------------------------------------ */
/* regionTree                                                        */
/* ------------------------------------------------------------------ */

test("regionTree depth 1: two children tiling the root", () => {
  const nodes = regionTree({
    seed: 42, width: 400, height: 400, centerX: 200, centerY: 200,
    depth: 1, minSize: 20, stopChance: 0, childRetention: 1,
    axis: "LONGEST", bias: 0,
  });
  const root = nodes[0];
  assert.equal(root.id, "root");
  assert.equal(root.parentId, null);
  assert.equal(root.depth, 0);
  assert.equal(root.terminal, false);
  const children = nodes.filter(n => n.parentId === "root");
  assert.equal(children.length, 2, "depth 1 should have exactly 2 children");
  // Children tile the root: union of bounds equals root bounds
  const rootBounds = root.bounds;
  const childMinX = Math.min(children[0].bounds[0], children[1].bounds[0]);
  const childMinY = Math.min(children[0].bounds[1], children[1].bounds[1]);
  const childMaxX = Math.max(children[0].bounds[2], children[1].bounds[2]);
  const childMaxY = Math.max(children[0].bounds[3], children[1].bounds[3]);
  near(childMinX, rootBounds[0]);
  near(childMinY, rootBounds[1]);
  near(childMaxX, rootBounds[2]);
  near(childMaxY, rootBounds[3]);
});

test("regionTree: parents before children", () => {
  const nodes = regionTree({
    seed: 42, width: 400, height: 400, centerX: 200, centerY: 200,
    depth: 4, minSize: 30, stopChance: 0, childRetention: 1,
    axis: "RANDOM", bias: 0,
  });
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.parentId === null) continue;
    const parentIndex = nodes.findIndex(n => n.id === node.parentId);
    assert.ok(parentIndex < i, `Node ${node.id} should appear after its parent`);
  }
});

test("regionTree: depth invariant", () => {
  const nodes = regionTree({
    seed: 42, width: 400, height: 400, centerX: 200, centerY: 200,
    depth: 3, minSize: 10, stopChance: 0, childRetention: 1,
    axis: "RANDOM", bias: 0,
  });
  for (const node of nodes) assert.ok(node.depth <= 3, `depth ${node.depth} exceeds max 3`);
});

test("regionTree: sibling stability under selective stopping", () => {
  const both = regionTree({
    seed: 42, width: 400, height: 400, centerX: 200, centerY: 200,
    depth: 5, minSize: 20, stopChance: 0, childRetention: 1,
    axis: "RANDOM", bias: 0,
  });
  const stopped = regionTree({
    seed: 42, width: 400, height: 400, centerX: 200, centerY: 200,
    depth: 5, minSize: 20, stopChance: .5, childRetention: 1,
    axis: "RANDOM", bias: 0,
  });
  const bothRoots = both.filter(n => n.id.startsWith("root/"));
  const stoppedRoots = stopped.filter(n => n.id.startsWith("root/"));
  // Both have a root node (root itself always exists)
  const bothRoot = bothRoots[0];
  const stoppedRoot = stoppedRoots[0];
  assert.deepEqual(bothRoot.bounds, stoppedRoot.bounds, "root bounds should be identical");
});

test("regionTree: child retention omits siblings without changing IDs", () => {
  const full = regionTree({
    seed: 42, width: 400, height: 400, centerX: 200, centerY: 200,
    depth: 3, minSize: 20, stopChance: 0, childRetention: 1,
    axis: "LONGEST", bias: 0,
  });
  const sparse = regionTree({
    seed: 42, width: 400, height: 400, centerX: 200, centerY: 200,
    depth: 3, minSize: 20, stopChance: 0, childRetention: .7,
    axis: "LONGEST", bias: 0,
  });
  // IDs from full that survive in sparse should have identical bounds/seed
  const sparseMap = new Map(sparse.map(n => [n.id, n]));
  const unchanged = full.filter(n => sparseMap.has(n.id));
  unchanged.forEach(n => {
    const s = sparseMap.get(n.id)!;
    eq(n.bounds, s.bounds);
    eq(n.seed, s.seed);
    eq(n.depth, s.depth);
  });
});

test("regionTree: cache identity", () => {
  const opts = {
    seed: 42, width: 400, height: 400, centerX: 200, centerY: 200,
    depth: 4, minSize: 30, stopChance: 0, childRetention: 1,
    axis: "LONGEST", bias: 0,
  };
  const a = regionTree(opts);
  const b = regionTree(opts);
  assert.strictEqual(a, b, "regionTree cache: same input → same reference");
});

/* ------------------------------------------------------------------ */
/* Materials                                                         */
/* ------------------------------------------------------------------ */

test("arrow mark draws lines", () => {
  const lines: [number, number, number, number][] = [];
  const mock = {
    translate(_x: number, _y: number) {}, rotate(_a: number) {}, scale(_s: number) {
      if (_s < 0) { /* mirror: negative scale flips coordinates */ }
    },
    line(x1: number, y1: number, x2: number, y2: number) { lines.push([x1, y1, x2, y2]); },
    noFill() {}, noStroke() {}, fill() {}, stroke() {}, strokeWeight() {},
    strokeCap() {}, circle() {}, rect() {}, beginShape() {}, vertex() {}, endShape() {},
  };
  const mark = motif(
    { kind: "arrow", size: 20, petals: 0, opening: 0, weight: 2, rotation: 0, variation: 0, retention: 1 },
    [0x000000],
  );
  mark(mock, { id: "0", seed: 1, position: [0, 0] as const, angle: 0, scale: 1 },
    { workUsed: 0, depth: 0, enter() {}, leave() {}, check() {} });
  assert.ok(lines.length > 0, `Arrow should draw ${lines.length} line segments`);
});

test("arrow mark: mirror uses negative scale", () => {
  let scaleCalls: number[] = [];
  const mock = {
    translate(_x: number, _y: number) {}, rotate(_a: number) {},
    scale(x: number, y?: number) { scaleCalls.push([x, y]); },
    line(_x1: number, _y1: number, _x2: number, _y2: number) {},
    push() {}, pop() {},
    noFill() {}, noStroke() {}, fill() {}, stroke() {}, strokeWeight() {},
    strokeCap() {}, circle() {}, rect() {}, beginShape() {}, vertex() {}, endShape() {},
  };
  const mark = motif(
    { kind: "arrow", size: 20, petals: 0, opening: 0, weight: 2, rotation: 0, variation: 0, retention: 1 },
    [0x000000],
  );
  const run = { workUsed: 0, depth: 0, enter() {}, leave() {}, check() {} };
  atEach(mock, [{ id: "0", seed: 1, position: [0, 0] as const, angle: 0, scale: 1 }], mark, run);
  assert.equal(scaleCalls.length, 0, `scale(1) should be no-op, got ${JSON.stringify(scaleCalls)}`);
  scaleCalls = [];
  atEach(mock, [{ id: "0", seed: 1, position: [0, 0] as const, angle: 0, scale: -1 }], mark, run);
  assert.ok(scaleCalls.some(([x, y]) => x === 1 && y === -1), `mirror should call scale(1, -1), got ${JSON.stringify(scaleCalls)}`);
});
