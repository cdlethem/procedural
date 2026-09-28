import assert from "node:assert/strict";
import test from "node:test";
import {
  atEach, createInstrument, definitions, developmentDefinitions, latticeSites, motif, pathMaterial,
  referenceComposition, regionTree, strokeWith, wallpaperOperations, wallpaperSites, wallpaperUsesCellHeight,
  type CompositionSurface, type Path, type PathMaterialSpec, type WallpaperGroup, type WallpaperOptions,
} from "../dist/index.js";

/** World-space recorder with a full 2x3 transform stack, so mirrors are observable. */
class MatrixSurface implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  lines: number[][] = []; circles: number[][] = [];
  m = [1, 0, 0, 1, 0, 0]; stack: number[][] = [];
  push() { this.stack.push([...this.m]); }
  pop() { this.m = this.stack.pop()!; }
  #mul(a: number, b: number, c: number, d: number, e: number, f: number) {
    const [A, B, C, D, E, F] = this.m;
    this.m = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F];
  }
  translate(x: number, y: number) { this.#mul(1, 0, 0, 1, x, y); }
  rotate(r: number) { this.#mul(Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0); }
  scale(x: number, y = x) { this.#mul(x, 0, 0, y, 0, 0); }
  #pt(x: number, y: number): [number, number] { const [a, b, c, d, e, f] = this.m; return [a * x + c * y + e, b * x + d * y + f]; }
  line(x1: number, y1: number, x2: number, y2: number) { this.lines.push([...this.#pt(x1, y1), ...this.#pt(x2, y2)]); }
  circle(x: number, y: number, diameter: number) {
    const [a, b] = this.m; this.circles.push([...this.#pt(x, y), diameter * Math.hypot(a, b)]);
  }
  noFill() {} noStroke() {} fill() {} stroke() {} strokeWeight() {} strokeCap() {}
  rect() {} beginShape() {} vertex() {} endShape() {}
}

const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const GROUPS: readonly WallpaperGroup[] = ["p1", "p2", "pm", "pg", "cm", "pmm", "pmg", "pgg", "cmm",
  "p4", "p4m", "p4g", "p3", "p3m1", "p31m", "p6", "p6m"];
const ORDER: Record<WallpaperGroup, number> = { p1: 1, p2: 2, pm: 2, pg: 2, cm: 2, pmm: 4, pmg: 4, pgg: 4,
  cmm: 4, p4: 4, p4m: 8, p4g: 8, p3: 3, p3m1: 6, p31m: 6, p6: 6, p6m: 12 };
const wall = (overrides: Partial<WallpaperOptions> = {}): WallpaperOptions => ({
  seed: 42, group: "p4g", cellWidth: 140, cellHeight: 140, centerX: 320, centerY: 320, width: 640, height: 640,
  motifOffsetX: .22, motifOffsetY: .12, margin: 40, breakAmount: 0, breakDensity: 0, ...overrides,
});

test("every wallpaper group closes to its known point-group order, identity first", () => {
  for (const group of GROUPS) {
    const ops = wallpaperOperations(group);
    assert.equal(ops.length, ORDER[group], `${group} operation count`);
    assert.deepEqual([ops[0][0], ops[0][1], ops[0][2], ops[0][3]], [0, false, 0, 0], `${group} identity first`);
    assert.equal(new Set(ops.map((op) => op.join())).size, ops.length, `${group} operations are distinct`);
  }
});

test("mirror axes distinguish groups that share a point group", () => {
  const throughOrigin = (group: WallpaperGroup) =>
    wallpaperOperations(group).filter(([, mirror, u, v]) => mirror && u === 0 && v === 0).length;
  assert.equal(throughOrigin("p4m"), 4, "p4m has mirrors through its four-fold centre");
  assert.equal(throughOrigin("p4g"), 0, "p4g has only glides through that centre");
  assert.equal(throughOrigin("pmm"), 2);
  assert.equal(throughOrigin("pgg"), 0);
});

test("a generic motif produces exactly one instance per group element in the home cell", () => {
  for (const group of GROUPS) {
    const sites = wallpaperSites(wall({ group, cellHeight: 140, motifOffsetX: .17, motifOffsetY: .29, margin: 400 }));
    const home = sites.filter((site) => site.id.startsWith("wall:0:0:"));
    assert.equal(home.length, ORDER[group], `${group} home-cell orbit`);
  }
});

test("mirror operations reflect the motif offset and carry a negative scale", () => {
  const options = wall({ group: "pm", cellWidth: 100, cellHeight: 100, motifOffsetX: .3, motifOffsetY: .2, margin: 400 });
  const [identity, mirror] = ["wall:0:0:0", "wall:0:0:1"].map((id) => wallpaperSites(options).find((site) => site.id === id)!);
  assert.deepEqual([identity.scale, mirror.scale], [1, -1]);
  near(identity.position[0], 320 + 30); near(identity.position[1], 320 + 20);
  near(mirror.position[0], 320 + 30); near(mirror.position[1], 320 - 20);
});

test("wallpaper ids and positions are stable when only the margin changes", () => {
  const narrow = wallpaperSites(wall({ margin: 0 }));
  const wide = new Map(wallpaperSites(wall({ margin: 120 })).map((site) => [site.id, site]));
  assert.ok(wide.size > narrow.length);
  for (const site of narrow) assert.deepEqual(wide.get(site.id), site);
});

test("square and hexagonal groups ignore cell height, rectangular groups do not", () => {
  assert.equal(wallpaperUsesCellHeight("p4"), false);
  assert.equal(wallpaperUsesCellHeight("p6m"), false);
  assert.equal(wallpaperUsesCellHeight("pmg"), true);
  assert.strictEqual(wallpaperSites(wall({ group: "p6", cellHeight: 60 })), wallpaperSites(wall({ group: "p6", cellHeight: 200 })));
  assert.notStrictEqual(wallpaperSites(wall({ group: "pmg", cellHeight: 90 })), wallpaperSites(wall({ group: "pmg", cellHeight: 130 })));
});

test("wallpaper covers non-square viewports and refuses unbounded instance counts", () => {
  const sites = wallpaperSites(wall({ group: "p1", cellWidth: 100, cellHeight: 100, width: 640, height: 200, margin: 0, motifOffsetX: 0, motifOffsetY: 0 }));
  const ys = sites.map((site) => site.position[1]);
  assert.ok(Math.min(...ys) >= 220 - 1e-9 && Math.max(...ys) <= 420 + 1e-9);
  assert.ok(sites.length >= 12, "both extents are covered");
  assert.throws(() => wallpaperSites(wall({ cellWidth: 6, cellHeight: 6 })), /instance limit/);
});

test("symmetry breaking is stable: raising the amount never changes which instances break", () => {
  const exact = new Map(wallpaperSites(wall()).map((site) => [site.id, site]));
  const light = wallpaperSites(wall({ breakAmount: .05, breakDensity: .3 }));
  const heavy = new Map(wallpaperSites(wall({ breakAmount: .3, breakDensity: .3 })).map((site) => [site.id, site]));
  const moved = (site: { id: string; position: readonly number[] }) => {
    const base = exact.get(site.id)!.position;
    return Math.hypot(site.position[0] - base[0], site.position[1] - base[1]) > 1e-9;
  };
  const brokenLight = light.filter(moved).map((site) => site.id);
  const brokenHeavy = [...heavy.values()].filter(moved).map((site) => site.id);
  assert.ok(brokenLight.length > 0 && brokenLight.length < light.length);
  assert.deepEqual(brokenLight, brokenHeavy);
});

test("zero disorder is an exact grid with no exceptions", () => {
  const sites = latticeSites({ seed: 42, columns: 5, rows: 5, width: 500, height: 500, centerX: 300, centerY: 300,
    correlation: 10, displacement: 0, rotation: 0, scale: 0, omission: 0, anchors: 0, focalX: 300, focalY: 300,
    focalRadius: 600, retention: 1 });
  sites.forEach((site, index) => {
    const col = index % 5, row = Math.floor(index / 5);
    near(site.position[0], 100 + col * 100); near(site.position[1], 100 + row * 100);
    near(site.angle, 0); near(site.scale, 1);
    assert.deepEqual([site.kept, site.exception, site.anchor, site.tone], [true, false, false, 0]);
  });
});

const field = { seed: 42, columns: 16, rows: 16, width: 640, height: 640, centerX: 320, centerY: 320, correlation: 4,
  displacement: .8, rotation: 0, scale: 0, omission: 0, anchors: 0, focalX: 320, focalY: 320, focalRadius: 0, retention: 1 };

test("disorder is spatially correlated: neighbours move alike, distant sites do not", () => {
  const sites = latticeSites(field);
  const shift = (site: (typeof sites)[number]) => [site.position[0] - site.origin[0], site.position[1] - site.origin[1]];
  const gap = (a: (typeof sites)[number], b: (typeof sites)[number]) => Math.hypot(shift(a)[0] - shift(b)[0], shift(a)[1] - shift(b)[1]);
  let near1 = 0, nearCount = 0, far = 0, farCount = 0;
  for (let row = 0; row < 16; row++) for (let col = 0; col < 16; col++) {
    const site = sites[row * 16 + col];
    if (col < 15) { near1 += gap(site, sites[row * 16 + col + 1]); nearCount++; }
    if (col + 8 < 16) { far += gap(site, sites[row * 16 + col + 8]); farCount++; }
  }
  assert.ok(near1 / nearCount < 0.75 * (far / farCount), `${near1 / nearCount} vs ${far / farCount}`);
});

test("omissions form runs rather than independent gaps", () => {
  const omitted = latticeSites({ ...field, displacement: 0, omission: .4 }).map((site) => !site.kept);
  const rate = omitted.filter(Boolean).length / omitted.length;
  let pairs = 0, total = 0;
  for (let row = 0; row < 16; row++) for (let col = 0; col < 15; col++) {
    total++; if (omitted[row * 16 + col] && omitted[row * 16 + col + 1]) pairs++;
  }
  assert.ok(rate > .1 && rate < .6);
  assert.ok(pairs / total > 1.5 * rate * rate, `${pairs / total} vs independent ${rate * rate}`);
});

test("anchors, the region outside the focus, and tone carry structure", () => {
  const anchored = latticeSites({ ...field, anchors: .3 });
  const pinned = anchored.filter((site) => site.anchor);
  assert.ok(pinned.length > 0 && pinned.length < anchored.length);
  for (const site of pinned) { assert.deepEqual(site.position, site.origin); assert.equal(site.tone, 2); }
  const focused = latticeSites({ ...field, focalX: 100, focalY: 100, focalRadius: 120 });
  for (const site of focused) if (Math.hypot(site.origin[0] - 100, site.origin[1] - 100) >= 120)
    assert.deepEqual(site.position, site.origin);
  assert.ok(focused.some((site) => site.position[0] !== site.origin[0]), "the focus itself is disturbed");
  for (const site of latticeSites({ ...field, rotation: 1, scale: .5, omission: .2 }))
    if (!site.anchor) assert.equal(site.tone, site.exception ? 1 : 0);
});

const tree = { seed: 42, width: 560, height: 560, centerX: 320, centerY: 320, depth: 4, minSize: 0, stopChance: 0,
  childRetention: 1, axis: "LONGEST" as const, bias: 0 };
const area = (bounds: readonly number[]) => (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]);

test("cell trees are pre-ordered and children exactly tile their parent", () => {
  const nodes = regionTree(tree);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  nodes.forEach((node, index) => {
    if (node.parentId === null) { assert.equal(index, 0); return; }
    assert.ok(nodes.findIndex((other) => other.id === node.parentId) < index, "parent precedes child");
  });
  for (const node of nodes.filter((item) => !item.terminal)) {
    const children = nodes.filter((item) => item.parentId === node.id);
    near(children.reduce((sum, child) => sum + area(child.bounds), 0), area(node.bounds), 1e-6);
    for (const child of children) assert.equal(byId.get(child.id)!.depth, node.depth + 1);
  }
});

test("LONGEST cuts across a wide node's length and RANDOM uses both axes", () => {
  const wide = regionTree({ ...tree, width: 400, height: 100, centerX: 200, centerY: 50, depth: 1, seed: 1 })
    .filter((node) => node.parentId === "root");
  assert.equal(wide.length, 2);
  for (const child of wide) { near(child.bounds[1], 0); near(child.bounds[3], 100); }
  const axes = new Set<string>();
  for (let seed = 1; seed < 40; seed++) {
    const [first] = regionTree({ ...tree, width: 300, height: 300, centerX: 150, centerY: 150, depth: 1, axis: "RANDOM", seed })
      .filter((node) => node.parentId === "root");
    axes.add(first.bounds[2] - first.bounds[0] < 299 ? "X" : "Y");
  }
  assert.deepEqual([...axes].sort(), ["X", "Y"]);
});

test("subdivision bias trades even leaves for contrast", () => {
  const spread = (bias: number) => {
    const areas = regionTree({ ...tree, bias }).filter((node) => node.terminal).map((node) => area(node.bounds));
    return Math.max(...areas) / Math.min(...areas);
  };
  assert.ok(spread(-1) < 6 && spread(1) > 100, `${spread(-1)} and ${spread(1)}`);
});

test("branch omission never reseeds siblings and never removes the root's children", () => {
  const full = new Map(regionTree(tree).map((node) => [node.id, node]));
  const sparse = regionTree({ ...tree, childRetention: .6, stopChance: .2 });
  assert.ok(sparse.length < full.size);
  const stopped = new Set(sparse.filter((node) => node.terminal).map((node) => node.id));
  for (const node of sparse) {
    const original = full.get(node.id)!;
    assert.deepEqual([node.bounds, node.seed], [original.bounds, original.seed], node.id);
    // A stopped branch keeps its own bounds; only an unstopped parent's children are comparable.
    if (!stopped.has(node.parentId ?? "")) assert.equal(node.depth, original.depth);
  }
  const none = regionTree({ ...tree, childRetention: 0 });
  assert.equal(none.filter((node) => node.parentId === "root").length, 2);
  assert.ok(none.filter((node) => node.parentId === "root").every((node) => node.terminal));
});

const matrixArrow = (scale: number, angle = 0) => {
  const surface = new MatrixSurface();
  const mark = motif({ kind: "arrow", size: 20, petals: 0, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 }, [0]);
  atEach(surface, [{ id: "a", seed: 1, position: [100, 50] as const, angle, scale }], mark);
  return surface.lines;
};

test("the arrow's tail flag distinguishes a mirror from a rotation", () => {
  const plain = matrixArrow(1), mirrored = matrixArrow(-1);
  assert.equal(plain.length, 4);
  const tail = (lines: number[][]) => lines[3];
  // Local flag ends at (-5, -5) relative to the site (radius 10): above the shaft, unmirrored.
  near(tail(plain)[3], 50 - 5); near(tail(mirrored)[3], 50 + 5);
  near(tail(plain)[2], tail(mirrored)[2]);
  const turned = matrixArrow(1, Math.PI);
  near(tail(turned)[2], 100 + 5); near(tail(turned)[3], 50 + 5);
});

const beads: PathMaterialSpec = { kind: "beads", weight: 1, spacing: 20, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
  mark: { kind: "dot", size: 8, petals: 5, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } };
const straight = (id: string, levelFraction: number): Path =>
  ({ id, seed: 3, points: [[0, 0], [200, 0]], closed: false, level: 0, levelFraction });

test("level ramp scales beads by contour band and cross-path phase separates paths", () => {
  const draw = (spec: PathMaterialSpec, paths: Path[]) => {
    const surface = new MatrixSurface(); strokeWith(surface, paths, pathMaterial(spec, [0]));
    return surface.circles;
  };
  const flat = draw(beads, [straight("a", 1)]);
  const ramped = draw({ ...beads, levelRamp: .5 }, [straight("a", 1)]);
  assert.equal(flat.length, ramped.length);
  ramped.forEach((circle, index) => near(circle[2], flat[index][2] * .5, 1e-9));
  const firstBand = draw({ ...beads, levelRamp: .5 }, [straight("a", 0)]);
  firstBand.forEach((circle, index) => near(circle[2], flat[index][2], 1e-9));

  const aligned = draw(beads, [straight("a", 0), straight("b", 0)]);
  assert.deepEqual(aligned.slice(0, aligned.length / 2).map((c) => c[0]), aligned.slice(aligned.length / 2).map((c) => c[0]));
  const spread = draw({ ...beads, phaseSpread: 1 }, [straight("a", 0), straight("b", 0)]);
  const half = spread.length / 2;
  assert.notDeepEqual(spread.slice(0, half).map((c) => c[0]), spread.slice(half).map((c) => c[0]));
  const again = draw({ ...beads, phaseSpread: 1 }, [straight("a", 0), straight("b", 0)]);
  assert.deepEqual(again, spread, "the spread is stable per path id");
});

test("studies under construction are resolvable but absent from every released inventory", () => {
  const released = new Set(definitions.map((item) => item.id));
  for (const item of developmentDefinitions) {
    assert.ok(!released.has(item.id), `${item.id} must not be in definitions`);
    assert.equal(createInstrument(item.id).technique, item.id);
  }
  assert.deepEqual(developmentDefinitions.map((item) => item.id).sort(), ["ordered-disorder", "recursive-cells", "wallpaper-motifs"]);
  const kinds = Object.fromEntries(developmentDefinitions.map((item) => [item.id, referenceComposition(createInstrument(item.id)).kind]));
  assert.deepEqual(kinds, { "wallpaper-motifs": "wallpaper", "ordered-disorder": "lattice", "recursive-cells": "cells" });
});

test("invalid structural parameters are rejected rather than clamped", () => {
  assert.throws(() => regionTree({ ...tree, depth: 0 }), /depth/);
  assert.throws(() => latticeSites({ ...field, columns: 1 }), /columns/);
  assert.throws(() => wallpaperSites(wall({ motifOffsetX: 2 })), /offset/);
});
