import assert from "node:assert/strict";
import test from "node:test";
import { atEach, componentSeed, createCompositionRun, inside, strokeWith,
  contourPaths, partitionRegions, poissonSites, type Path, type Region, type Site } from "../dist/index.js";

const poisson = { seed: 42, width: 180, height: 160, centerX: 320, centerY: 320,
  separation: 18, maxPoints: 70, support: "annulus" as const, opening: .3, rotation: 15 };
const contours = { seed: 42, source: "hills" as const, width: 280, height: 280,
  centerX: 320, centerY: 320, resolution: 39, frequency: 1.6, aspect: 1,
  hillCount: 3, hillRadius: .23, levelBase: .22, levelStep: .22, levels: 3, rotation: 18 };
const partition = { seed: 42, width: 300, height: 270, centerX: 320, centerY: 320,
  columns: 30, rows: 27, attempts: 35, axis: "RANDOM" as const, bias: .5 };

test("uint32 child seed fixtures distinguish ambiguous IDs and UTF-16 code units", () => {
  assert.equal(componentSeed(0, "", ""), 414626237);
  assert.equal(componentSeed(42, "site:0", "petal"), 4010179641);
  assert.equal(componentSeed(0xffffffff, "a:b", "c"), 1196394719);
  assert.equal(componentSeed(0xffffffff, "a", "b:c"), 3648999608);
  assert.equal(componentSeed(23, "é𝄞", "ink"), 3972976992);
  for (const seed of [-1, 2 ** 32, NaN, 1.5])
    assert.throws(() => componentSeed(seed, "site", "mark"), /uint32/);
});

test("source identities cache only geometry and every nested value is immutable", () => {
  const sites = poissonSites(poisson), paths = contourPaths(contours), regions = partitionRegions(partition);
  assert.ok(sites.length > 0 && paths.length > 0 && regions.length > 0);
  assert.strictEqual(poissonSites({ ...poisson }), sites);
  assert.strictEqual(contourPaths({ ...contours }), paths);
  assert.strictEqual(partitionRegions({ ...partition }), regions);
  for (const source of [sites, paths, regions]) {
    assert.ok(Object.isFrozen(source));
    assert.ok(Object.isFrozen(source[0]));
  }
  assert.ok(Object.isFrozen(sites[0].position));
  assert.ok(Object.isFrozen(paths[0].points));
  assert.ok(Object.isFrozen(paths[0].points[0]));
  assert.ok(Object.isFrozen(regions[0].bounds));
  assert.throws(() => { (sites[0].position as number[])[0] = -99; }, TypeError);
  assert.equal(poissonSites(poisson)[0].position[0], sites[0].position[0]);
});

test("zero contour levels preserve empty geometry while still rejecting invalid source work", () => {
  const empty = contourPaths({ ...contours, levels: 0 });
  assert.deepEqual(empty, []);
  assert.ok(Object.isFrozen(empty));
  assert.strictEqual(contourPaths({ ...contours, levels: 0 }), empty);
  assert.throws(() => contourPaths({ ...contours, levels: 0, resolution: 200 }), /columns/);
});

test("chain closure, level and IDs survive repeated source reads and frame rotation", () => {
  const source = contourPaths({ ...contours, rotation: 0 });
  const turned = contourPaths({ ...contours, rotation: 90 });
  assert.ok(source.some(path => path.closed));
  assert.deepEqual(turned.map(path => [path.id, path.level, path.closed]),
    source.map(path => [path.id, path.level, path.closed]));
  const closed = source.find(path => path.closed)!;
  assert.ok(closed.points.length >= 3);
  assert.notDeepEqual(closed.points[0], closed.points[closed.points.length - 1]);
  const a = source[0].points[0], b = turned[0].points[0];
  assert.ok(Math.abs(b[0] - (contours.centerX - (a[1] - contours.centerY))) < 1e-9);
  assert.ok(Math.abs(b[1] - (contours.centerY + (a[0] - contours.centerX))) < 1e-9);
});

test("an exact saddle junction becomes four complete arms without dropping contour edges", () => {
  const arms = contourPaths({ ...contours, source: "saddle", frequency: 0, aspect: 1,
    resolution: 23, levelBase: 0, levels: 1, rotation: 0 });
  assert.equal(arms.length, 4);
  const corners: string[] = [];
  let length = 0;
  for (const arm of arms) {
    assert.equal(arm.closed, false);
    const ends = [arm.points[0], arm.points[arm.points.length - 1]];
    assert.ok(ends.some(([x, y]) => x === 320 && y === 320));
    corners.push(ends.find(([x, y]) => x !== 320 || y !== 320)!.join(","));
    for (let i = 1; i < arm.points.length; i++)
      length += Math.hypot(arm.points[i][0] - arm.points[i - 1][0], arm.points[i][1] - arm.points[i - 1][1]);
  }
  assert.deepEqual(corners.sort(), ["180,180", "180,460", "460,180", "460,460"]);
  assert.ok(Math.abs(length - 2 * Math.hypot(280, 280)) < 1e-9);
});

test("child streams produce identical per-site marks after omission and reordered traversal", () => {
  const sites = poissonSites(poisson);
  const draw = (population: readonly Site[]) => {
    const results = new Map<string, readonly number[]>();
    const surface = new Frame();
    atEach(surface, population, (_, site) => {
      let state = componentSeed(site.seed, site.id, "petal");
      const petals = Array.from({ length: 4 }, () => {
        state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
        return state >>> 0;
      });
      results.set(site.id, petals);
    });
    return results;
  };
  const all = draw(sites), sparse = draw(sites.filter((_, index) => index % 3 !== 0).reverse());
  for (const [id, petals] of sparse) assert.deepEqual(petals, all.get(id));
  assert.notDeepEqual(all.get(sites[0].id), all.get(sites[1].id));
});

class Frame {
  stack: { x: number; y: number; angle: number; scale: number }[] = [];
  current = { x: 0, y: 0, angle: 0, scale: 1 };
  push() { this.stack.push({ ...this.current }); }
  pop() { const frame = this.stack.pop(); if (!frame) throw Error("Unbalanced pop"); this.current = frame; }
  translate(x: number, y: number) { this.current.x += x; this.current.y += y; }
  rotate(angle: number) { this.current.angle += angle; }
  scale(value: number) { this.current.scale *= value; }
}

test("local mark and region frames restore after nested failure; path callback remains world-space", () => {
  const surface = new Frame(), run = createCompositionRun();
  const site: Site = { id: "a", seed: 1, position: [15, 22], angle: .3, scale: 2 };
  const region: Region = { id: "r", seed: 2, bounds: [100, 200, 120, 230] };
  const path: Path = { id: "p", seed: 3, points: [[0, 0], [10, 10]], closed: false, level: 0 };
  assert.throws(() => atEach(surface, [site], (paint, _site, shared) => {
    assert.deepEqual(paint.current, { x: 15, y: 22, angle: .3, scale: 2 });
    inside(paint, [region], (local, leaf, sameRun) => {
      assert.equal(shared, sameRun);
      assert.deepEqual(local.current, { x: 115, y: 222, angle: .3, scale: 2 });
      assert.deepEqual(leaf.bounds, [100, 200, 120, 230]);
      strokeWith(local, [path], (world, complete) => {
        assert.strictEqual(complete, path);
        assert.deepEqual(world.current, { x: 115, y: 222, angle: .3, scale: 2 });
        throw Error("material broke");
      }, sameRun);
    }, shared);
  }, run), /material broke/);
  assert.equal(surface.stack.length, 0);
  assert.deepEqual(surface.current, { x: 0, y: 0, angle: 0, scale: 1 });
  assert.equal(run.depth, 0);
  assert.equal(run.workUsed, 3);
});

test("shared budget, nesting limit and cancellation stop before excess callbacks without stack leaks", () => {
  const surface = new Frame();
  const sites: Site[] = ["a", "b"].map(id => ({ id, seed: 1, position: [0, 0], angle: 0, scale: 1 }));
  const budget = createCompositionRun({ maxWork: 1 });
  let painted = 0;
  assert.throws(() => atEach(surface, sites, () => { painted++; }, budget), /budget/);
  assert.equal(painted, 1);
  assert.equal(budget.depth, 0);
  assert.equal(surface.stack.length, 0);
  const depth = createCompositionRun({ maxDepth: 1 });
  assert.throws(() => atEach(surface, sites.slice(0, 1), (paint, _, shared) =>
    atEach(paint, sites, () => { throw Error("nested callback should not run"); }, shared), depth), /depth/);
  assert.equal(depth.depth, 0);
  assert.equal(surface.stack.length, 0);
  let cancelled = false;
  const run = createCompositionRun({ cancelled: () => cancelled });
  assert.throws(() => atEach(surface, sites, () => { cancelled = true; }, run), /cancelled/);
  assert.equal(run.workUsed, 1);
  assert.equal(run.depth, 0);
});
