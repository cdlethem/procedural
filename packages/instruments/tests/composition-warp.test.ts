import assert from "node:assert/strict";
import test from "node:test";
import {
  contourPaths, createInstrument, gridPaths, gridSites, mapNames, poissonSites, referenceComposition, validateInstrument,
  warpPaths, warpPoint, warpSites, type MapName, type Path, type Site, type WarpOptions,
} from "../dist/index.js";

const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const stage = (map: MapName, amount = 1, frequency = 1) => ({ map, amount, frequency });
const warp = (stages: WarpOptions["stages"], overrides: Partial<WarpOptions> = {}): WarpOptions =>
  ({ centerX: 300, centerY: 200, radius: 100, stages, iterations: 1, bound: 8, ...overrides });
const at = (u: number, v: number) => [300 + 100 * u, 200 + 100 * v] as const;

test("every named map is the identity at amount zero", () => {
  for (const map of mapNames) {
    const options = warp([stage(map, 0)]);
    const [x, y] = at(.37, -.21), point = warpPoint(options, x, y)!;
    near(point[0], x); near(point[1], y);
  }
});

test("documented maps give their stated coordinates", () => {
  const [x, y] = at(.5, .25);
  const sinusoidal = warpPoint(warp([stage("sinusoidal", 1, 1.5)]), x, y)!;
  near(sinusoidal[0], 300 + 100 * Math.sin(.75)); near(sinusoidal[1], 200 + 100 * Math.sin(.375));
  const inverted = warpPoint(warp([stage("spherical")]), ...at(.5, 0))!;
  near(inverted[0], 300 + 100 * 2); near(inverted[1], 200);
  const fisheye = warpPoint(warp([stage("fisheye", 1, 1)]), ...at(1, 0))!;
  near(fisheye[0], 300 + 100 * 1); near(fisheye[1], 200);
  const waves = warpPoint(warp([stage("waves", 1, 2)]), ...at(.5, .25))!;
  near(waves[0], 300 + 100 * (.5 + .3 * Math.sin(.5))); near(waves[1], 200 + 100 * (.25 + .3 * Math.sin(1)));
  const swirlCenter = warpPoint(warp([stage("swirl", 1, 3)]), 300, 200)!;
  near(swirlCenter[0], 300); near(swirlCenter[1], 200);
  const half = warpPoint(warp([stage("sinusoidal", .5, 1)]), ...at(.8, 0))!;
  near(half[0], 300 + 100 * (.8 + .5 * (Math.sin(.8) - .8)));
});

test("stage order and repetition change the result", () => {
  const [x, y] = at(.6, .3);
  const ab = warpPoint(warp([stage("swirl", 1, 2), stage("sinusoidal", 1, 1.4)]), x, y)!;
  const ba = warpPoint(warp([stage("sinusoidal", 1, 1.4), stage("swirl", 1, 2)]), x, y)!;
  assert.ok(Math.hypot(ab[0] - ba[0], ab[1] - ba[1]) > 5, "order visibly matters");
  const once = warp([stage("swirl", 1, 2), stage("sinusoidal", 1, 1.4)]);
  const twice = warpPoint({ ...once, iterations: 2 }, x, y)!;
  const manual = warpPoint(once, ...warpPoint(once, x, y)!)!;
  near(twice[0], manual[0]); near(twice[1], manual[1]);
});

test("singular and out-of-bound points are excluded, never clamped or interpolated", () => {
  const inversion = warp([stage("spherical")]);
  assert.equal(warpPoint(inversion, 300, 200), null, "the pole itself");
  assert.equal(warpPoint(inversion, ...at(.05, 0)), null, "maps beyond the bound (1/0.05 = 20 > 8)");
  assert.notEqual(warpPoint(inversion, ...at(.2, 0)), null);
  const line: Path = { id: "through-pole", seed: 1, points: [[100, 200], [500, 200]], closed: false, level: 0, levelFraction: 0 };
  const parts = warpPaths([line], inversion, 4);
  assert.equal(parts.length, 2, "the line is cut on both sides of the pole, not joined");
  assert.deepEqual(parts.map((part) => part.id), ["through-pole#0", "through-pole#1"]);
  const site: Site = { id: "pole", seed: 1, position: [300, 200], angle: 0, scale: 1 };
  assert.equal(warpSites([site], inversion).length, 0);
});

test("mapped paths never join points across a seam or leave the bound", () => {
  const grid = gridPaths({ seed: 1, centerX: 300, centerY: 200, width: 300, height: 300, columns: 8, rows: 8, jitter: 0 });
  for (const map of mapNames) {
    const options = warp([stage(map, 1, 1.3)], { radius: 120 });
    const parts = warpPaths(grid, options, 5);
    assert.ok(parts.length >= grid.length, `${map} keeps at least one part per line`);
    for (const part of parts) for (let index = 0; index < part.points.length; index++) {
      const [x, y] = part.points[index];
      assert.ok(Math.hypot(x - 300, y - 200) <= options.bound * options.radius + 1e-6, `${map} bound`);
      if (index > 0) {
        const [px, py] = part.points[index - 1];
        assert.ok(Math.hypot(x - px, y - py) <= .6 * options.radius + 1e-6, `${map} seam jump`);
      }
    }
  }
  const polar = warpPaths(grid, warp([stage("polar", 1, 1)], { radius: 120 }), 5);
  assert.ok(polar.length > grid.length, "polar's branch cut splits lines");
});

test("a fold mirrors the mark and marks it; ordinary regions scale and orient it", () => {
  const options = warp([stage("sinusoidal", 1, 1.5)]);
  const site = (id: string, [x, y]: readonly [number, number], extra: Partial<Site> = {}): Site =>
    ({ id, seed: 1, position: [x, y], angle: 0, scale: 1, tone: 0, ...extra });
  const [ordinary, folded] = warpSites([site("a", at(0, 0)), site("b", at(1.2, 0))], options);
  near(ordinary.scale, 1.5, 1e-4); near(ordinary.angle, 0, 1e-6); assert.equal(ordinary.flipped, false);
  assert.ok(folded.scale < 0, "u = 1.2 is past the fold (k·u > π/2)");
  assert.equal(folded.flipped, true);
  assert.deepEqual([ordinary.tone, folded.tone], [0, 0], "the map never rewrites a source's tone");
  const [mirrored] = warpSites([site("c", at(1.2, 0), { scale: -1 })], options);
  assert.ok(mirrored.scale > 0, "a mirrored mark folded once is upright again");
  const [quarter] = warpSites([site("d", at(.3, .2), { angle: Math.PI / 2 })], warp([stage("sinusoidal", 1, 1.5)]));
  near(quarter.angle, Math.PI / 2, 1e-6);
});

test("warping released sources preserves identities and reports what it drops", () => {
  const sites = poissonSites(referenceComposition(createInstrument("motif-ecologies")).source as never);
  // Put the pole exactly on one real site so the exclusion policy has something to drop.
  const options = warp([stage("spherical", 1, 1)], { centerX: sites[0].position[0], centerY: sites[0].position[1], radius: 120, bound: 6 });
  const warped = warpSites(sites, options);
  const known = new Map(sites.map((item) => [item.id, item]));
  assert.ok(warped.length > 0 && warped.length < sites.length, "the pole's neighbourhood is dropped");
  for (const item of warped) assert.equal(item.seed, known.get(item.id)!.seed);
  const paths = contourPaths(referenceComposition(createInstrument("contour-scores")).source as never);
  const parts = warpPaths(paths, warp([stage("swirl", 1, 2)], { centerX: 320, centerY: 320, radius: 200 }), 8);
  assert.ok(parts.length >= paths.length);
  const sources = new Map(paths.map((item) => [item.id, item]));
  for (const part of parts) {
    const source = sources.get(part.id.replace(/#\d+$/, ""))!;
    assert.deepEqual([part.level, part.levelFraction], [source.level, source.levelFraction]);
  }
});

test("mapping refuses unbounded work", () => {
  const grid = gridPaths({ seed: 1, centerX: 300, centerY: 300, width: 4000, height: 4000, columns: 60, rows: 60, jitter: 0 });
  assert.throws(() => warpPaths(grid, warp([stage("swirl")]), 1), /200000/);
  assert.throws(() => warpPoint(warp([stage("swirl")], { iterations: 9 }), 0, 0), /iterations|Warp/);
  assert.throws(() => warpSites([], warp([{ map: "nope" as MapName, amount: 1, frequency: 1 }])), /Unknown coordinate map/);
});

test("grid irregularity is seed-specific structure that keeps order and edges", () => {
  const options = { centerX: 300, centerY: 300, width: 400, height: 400, columns: 10, rows: 10 };
  const columns = (seed: number, jitter: number) => gridPaths({ ...options, seed, jitter })
    .filter((path) => path.id.startsWith("col:")).map((path) => path.points[0][0]);
  const a = columns(1, .8), b = columns(2, .8);
  assert.notDeepEqual(a, b, "a new seed reshuffles spacing");
  for (const xs of [a, b]) {
    near(xs[0], 100); near(xs[10], 500);
    xs.slice(1).forEach((x, index) => assert.ok(x >= xs[index], "lines stay in order"));
  }
  assert.deepEqual(columns(1, 0), columns(2, 0), "zero irregularity is seed-independent");
  near(columns(1, 0)[3], 100 + 400 * 3 / 10);
  const nodes = gridSites({ ...options, seed: 1, jitter: .8 });
  assert.equal(nodes.length, 121);
  const xs = new Set(gridPaths({ ...options, seed: 1, jitter: .8 }).filter((path) => path.id.startsWith("col:")).map((path) => path.points[0][0]));
  for (const node of nodes) assert.ok(xs.has(node.position[0]), "nodes sit exactly on their crossing lines");
});

test("fold atlas resolves to a warp composition and rejects unknown maps", () => {
  const input = createInstrument("fold-atlas");
  const recipe = referenceComposition(input);
  assert.equal(recipe.kind, "warp");
  if (recipe.kind !== "warp") return;
  assert.deepEqual(recipe.map.stages.map((item) => item.map), ["swirl", "sinusoidal", "fisheye"]);
  assert.throws(() => validateInstrument({ ...input, params: { ...input.params, stage1Map: "twirl" } }));
});
