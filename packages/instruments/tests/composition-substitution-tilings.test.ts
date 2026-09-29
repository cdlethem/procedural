import assert from "node:assert/strict";
import test from "node:test";
import {
  atEach, createCompositionRun, createInstrument, drawReferenceComposition, insetPolygon, referenceComposition, selectedVertices,
  shownTiles, substitutionTiling, tileAncestorId, tileFill, tileTone, tilingEdgePaths, tilingRules, tonedEdges,
  usesSeed, MAX_TILING_PIECES, type CompositionSurface, type InstrumentInput, type Point, type TileFillSpec, type TilingOptions, type TilingView,
} from "../dist/index.js";

const PHI = (1 + Math.sqrt(5)) / 2;
const RAD = Math.PI / 180;
const options = (overrides: Partial<TilingOptions> = {}): TilingOptions => ({
  seed: 42, rule: "penrose-p3", patch: "decagon", depth: 3, centerX: 320, centerY: 320, radius: 290, rotation: 0,
  boundary: "half-tiles", crop: "none", cropX: 320, cropY: 320, cropWidth: 200, cropHeight: 200, ...overrides,
});
const near = (actual: number, expected: number, tolerance = 1e-7) =>
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const length = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const PATCHES: readonly (readonly [TilingOptions["rule"], string])[] = [
  ["penrose-p3", "sun"], ["penrose-p3", "decagon"], ["penrose-p3", "thick"], ["penrose-p3", "thin"],
  ["chair", "chair"], ["chair", "rectangle"], ["chair", "block"],
];

/** Independent closed forms for each seed patch of radius R: [area, perimeter, edge length at depth 0, boundary polygon, cell]. */
function patchFacts(rule: string, patch: string, R: number, cx = 320, cy = 320) {
  const polar = (r: number, degrees: number): Point => [cx + r * Math.cos(degrees * RAD), cy + r * Math.sin(degrees * RAD)];
  if (rule === "penrose-p3") {
    if (patch === "decagon") {
      const edge = R; // acute half-tiles have legs equal to the circumradius
      return { area: 5 * R * R * Math.sin(36 * RAD), perimeter: 10 * 2 * R * Math.sin(18 * RAD), edge,
        polygon: Array.from({ length: 10 }, (_, i) => polar(R, 36 * i)) };
    }
    if (patch === "sun") {
      const s = R / PHI, star: Point[] = [];
      for (let j = 0; j < 5; j++) star.push(polar(s, 72 * j), polar(R, 72 * j + 36));
      return { area: 5 * s * s * Math.sin(72 * RAD), perimeter: 10 * s, edge: s, polygon: star };
    }
    // A lone rhombus centered on its centroid; the farthest vertex is half the long diagonal away.
    const half = patch === "thick" ? PHI / 2 : Math.cos(18 * RAD), s = R / half;
    const angle = patch === "thick" ? 72 : 36;
    return { area: s * s * Math.sin(angle * RAD), perimeter: 4 * s, edge: s, polygon: undefined as Point[] | undefined };
  }
  // Chairs: the ring polygon has extents 2 cells; k is the canvas length of one cell.
  const extent = patch === "chair" ? [2, 2, 3] : patch === "rectangle" ? [2, 3, 6] : [4, 3, 12];
  const reach = Math.hypot(extent[0] / 2, extent[1] / 2);
  const k = R / (patch === "chair" ? Math.SQRT2 : reach);
  const perimeter = patch === "chair" ? 8 : patch === "rectangle" ? 10 : 14;
  return { area: (patch === "chair" ? 3 : extent[2]) * k * k, perimeter: perimeter * k, edge: k, polygon: undefined as Point[] | undefined };
}

function contains(polygon: readonly Point[], [x, y]: Point): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const perimeterOf = (points: readonly Point[]) => points.reduce((sum, p, i) => sum + length(p, points[(i + 1) % points.length]), 0);

test("piece counts follow the substitution matrices, exactly", () => {
  // acute → acute + obtuse; obtuse → acute + 2 obtuse (Robinson triangles).
  const decagon = [10, 20, 50, 130, 340, 890, 2330], sun = [10, 30, 80, 210, 550, 1440, 3770];
  decagon.forEach((count, depth) => assert.equal(substitutionTiling(options({ patch: "decagon", depth })).pieces, count, `decagon ${depth}`));
  sun.forEach((count, depth) => assert.equal(substitutionTiling(options({ patch: "sun", depth })).pieces, count, `sun ${depth}`));
  for (const [patch, roots] of [["chair", 1], ["rectangle", 2], ["block", 4]] as const)
    for (let depth = 0; depth <= 5; depth++)
      assert.equal(substitutionTiling(options({ rule: "chair", patch, depth })).pieces, roots * 4 ** depth, `${patch} ${depth}`);
  // Whole tiles plus lone halves account for every piece, and thick/thin follow the class recurrence.
  const t = substitutionTiling(options({ patch: "decagon", depth: 5 }));
  const complete = t.tiles.filter((tile) => tile.complete);
  assert.equal(2 * complete.length + (t.tiles.length - complete.length), t.pieces);
  const halves = (cls: string) => t.tiles.filter((tile) => tile.class === cls).reduce((sum, tile) => sum + tile.pieces.length, 0);
  assert.equal(halves("thin"), 340);
  assert.equal(halves("thick"), 550);
  assert.equal(tilingRules["penrose-p3"].ratio, PHI);
  assert.equal(tilingRules.chair.ratio, 2);
});

test("substitution conserves area and the seed boundary at every depth; a crack anywhere would lengthen the boundary", () => {
  for (const [rule, patch] of PATCHES) for (let depth = 0; depth <= 5; depth++) {
    const R = 240, t = substitutionTiling(options({ rule, patch, depth, radius: R }));
    const facts = patchFacts(rule, patch, R);
    near(t.tiles.reduce((sum, tile) => sum + tile.area, 0), facts.area, 1e-9);
    const oneSided = t.edges.filter((edge) => edge.tiles[1] === null);
    near(oneSided.reduce((sum, edge) => sum + length(edge.points[0], edge.points[1]), 0), facts.perimeter, 1e-9);
    assert.ok(t.edges.every((edge) => edge.tiles[0] !== null), "every edge has a first side");
  }
});

test("the tiles cover the seed patch exactly once (no overlap, no gap), for every construction and generation", () => {
  for (const [rule, patch] of [["penrose-p3", "sun"], ["penrose-p3", "decagon"], ["chair", "chair"]] as const) for (const depth of [1, 3, 5]) {
    const R = 250, t = substitutionTiling(options({ rule, patch, depth, radius: R }));
    const polygon = rule === "chair"
      ? (() => { const k = R / Math.SQRT2, ox = 320 - k, oy = 320 - k; return [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]].map(([x, y]): Point => [ox + x * k, oy + y * k]); })()
      : patchFacts(rule, patch, R).polygon!;
    let worst = 0;
    for (let i = 0; i < 90; i++) for (let j = 0; j < 90; j++) {
      const p: Point = [320 - R * 1.05 + (i + .3711) * 2.1 * R / 90, 320 - R * 1.05 + (j + .6127) * 2.1 * R / 90];
      const covering = t.tiles.filter((tile) => contains(tile.points, p)).length;
      const expected = contains(polygon, p) ? 1 : 0;
      if (covering !== expected) worst++;
    }
    assert.equal(worst, 0, `${rule} ${patch} depth ${depth}: points covered the wrong number of times`);
  }
});

test("tile area scales by exactly the substitution ratio squared per generation", () => {
  const R = 300;
  for (let depth = 0; depth <= 5; depth++) {
    const t = substitutionTiling(options({ patch: "decagon", depth, radius: R }));
    const edge = R * PHI ** -depth;
    near(t.edgeLength, edge, 1e-10);
    for (const tile of t.tiles.filter((x) => x.complete)) {
      near(tile.area, (tile.class === "thick" ? Math.sin(72 * RAD) : Math.sin(36 * RAD)) * edge * edge, 1e-9);
      for (let i = 0; i < 4; i++) near(length(tile.points[i], tile.points[(i + 1) % 4]), edge, 1e-9);
    }
    const c = substitutionTiling(options({ rule: "chair", patch: "chair", depth, radius: R }));
    const cell = R / Math.SQRT2 / 2 ** depth;
    for (const tile of c.tiles) near(tile.area, 3 * cell * cell, 1e-9);
    near(c.edgeLength, cell, 1e-10);
  }
});

test("tile frames: positive winding, corner angles match the polygon, congruent tiles share one outline", () => {
  for (const [rule, patch] of PATCHES) {
    const t = substitutionTiling(options({ rule, patch, depth: 3, rotation: 17, radius: 260 }));
    const firstOutline = new Map<string, readonly Point[]>();
    for (const tile of t.tiles) {
      const n = tile.points.length;
      let signed = 0;
      for (let i = 0; i < n; i++) signed += tile.points[i][0] * tile.points[(i + 1) % n][1] - tile.points[(i + 1) % n][0] * tile.points[i][1];
      assert.ok(signed > 0, "positive winding");
      near(signed / 2, tile.area, 1e-9);
      assert.equal(tile.corners.reduce((a, b) => a + b, 0), (n - 2) * t.unitsPerTurn / 2, "polygon angle sum");
      for (let i = 0; i < n; i++) {
        const p = tile.points[(i + n - 1) % n], q = tile.points[i], r = tile.points[(i + 1) % n];
        let turn = Math.atan2(r[1] - q[1], r[0] - q[0]) - Math.atan2(q[1] - p[1], q[0] - p[0]);
        turn = ((turn + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; // exterior angle, signed
        near((Math.PI - turn) / (2 * Math.PI) * t.unitsPerTurn, tile.corners[i], 1e-7);
      }
      const c = Math.cos(tile.angle), s = Math.sin(tile.angle);
      tile.outline.forEach(([x, y], i) => {
        near(tile.position[0] + c * x - s * y, tile.points[i][0], 1e-7);
        near(tile.position[1] + s * x + c * y, tile.points[i][1], 1e-7);
      });
      const key = `${tile.class}:${tile.complete}`, seen = firstOutline.get(key);
      if (!seen) firstOutline.set(key, tile.outline);
      else tile.outline.forEach((p, i) => { near(p[0], seen[i][0], 1e-6); near(p[1], seen[i][1], 1e-6); });
    }
  }
});

test("chair classes name the real direction each tile's elbow points, so substitution turns children correctly", () => {
  // With no rotation the axis runs from the reflex corner to the elbow: up-left, up-right, down-right, down-left.
  const expected: Record<string, number> = { nw: -135, ne: -45, se: 45, sw: 135 };
  const t = substitutionTiling(options({ rule: "chair", patch: "block", depth: 3 }));
  const counts: Record<string, number> = {};
  for (const tile of t.tiles) {
    counts[tile.class] = (counts[tile.class] ?? 0) + 1;
    const turn = ((tile.angle / RAD - expected[tile.class]) % 360 + 540) % 360 - 180;
    assert.ok(Math.abs(turn) < 1e-6, `${tile.id}: ${tile.class} axis is ${tile.angle / RAD}`);
    // The reflex corner (vertex 3) lies on the axis, one cell diagonal from the elbow (vertex 0) in the seed frame.
    const [reflex, elbow] = [tile.points[3], tile.points[0]];
    assert.ok(Math.abs(Math.atan2(elbow[1] - reflex[1], elbow[0] - reflex[0]) - tile.angle) < 1e-9);
    near(length(reflex, elbow), Math.SQRT2 * t.edgeLength, 1e-9);
  }
  assert.deepEqual(counts, { nw: 64, ne: 64, se: 64, sw: 64 }, "each orientation appears equally");
});

test("interior Penrose vertices are exactly the seven legal configurations", () => {
  const seen = new Set<string>();
  for (const patch of ["sun", "decagon", "thick", "thin"]) {
    const t = substitutionTiling(options({ patch, depth: 6, radius: 300 }));
    for (const v of t.vertices) if (v.interior) {
      seen.add(v.signature);
      assert.equal(v.signature.split(".").reduce((sum, x) => sum + Number(x), 0), 10, "corners close a turn");
    }
  }
  assert.deepEqual([...seen].sort(), ["1.1.1.1.2.2.2", "1.1.2.2.2.2", "1.1.2.3.3", "2.2.2.2.2", "2.2.2.4", "2.4.4", "3.3.4"]);
});

test("shared edges are deduplicated: at most two tiles per edge, no vertex inside an edge, Euler characteristic one", () => {
  for (const [rule, patch] of PATCHES) {
    const t = substitutionTiling(options({ rule, patch, depth: 3, radius: 250 }));
    const keys = new Set(t.edges.map((edge) => [edge.a, edge.b].sort().join("|")));
    assert.equal(keys.size, t.edges.length, "no duplicated edge");
    assert.ok(t.edges.every((edge) => edge.a !== edge.b));
    assert.equal(t.vertices.length - t.edges.length + t.tiles.length, 1, `${rule} ${patch} V-E+F`);
    for (const edge of t.edges) for (const v of t.vertices) {
      if (v.id === edge.a || v.id === edge.b) continue;
      const [a, b] = edge.points, dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      const along = ((v.position[0] - a[0]) * dx + (v.position[1] - a[1]) * dy) / len;
      const across = Math.abs((v.position[0] - a[0]) * dy - (v.position[1] - a[1]) * dx) / len;
      assert.ok(!(across < 1e-6 && along > 1e-6 && along < len - 1e-6), `${rule} ${patch}: vertex inside edge ${edge.id}`);
    }
    // A tile's perimeter is exactly the sum of the edges that list it, however T-junctions split its sides.
    const total = new Map<string, number>();
    for (const edge of t.edges) for (const id of edge.tiles) if (id !== null)
      total.set(id, (total.get(id) ?? 0) + length(edge.points[0], edge.points[1]));
    for (const tile of t.tiles) near(total.get(tile.id) ?? 0, perimeterOf(tile.points), 1e-9);
  }
});

test("edge levels record where two sides' ancestries diverge", () => {
  const t = substitutionTiling(options({ patch: "sun", depth: 5 }));
  const byId = new Map(t.tiles.map((tile) => [tile.id, tile]));
  let deepest = 0;
  for (const edge of t.edges) {
    if (edge.tiles[1] === null) { assert.equal(edge.level, 0); continue; }
    const p = byId.get(edge.tiles[0])!.path, q = byId.get(edge.tiles[1])!.path;
    for (let i = 0; i < edge.level; i++) assert.equal(p[i], q[i]);
    assert.notEqual(p[edge.level], q[edge.level]);
    deepest = Math.max(deepest, edge.level);
  }
  assert.ok(deepest >= 4, "sibling-level boundaries exist");
  const paths = tilingEdgePaths(t);
  assert.equal(paths.length, t.edges.length);
  paths.forEach((path, i) => { assert.equal(path.id, t.edges[i].id); near(path.levelFraction, t.edges[i].level / 5); });
});

test("ancestry paths agree with the substitution contract, and ids survive depth, radius, rotation and crop", () => {
  const t = substitutionTiling(options({ patch: "sun", depth: 4 }));
  for (const tile of t.tiles) {
    assert.equal(tile.path.length, 5);
    assert.equal(tile.id, `t:${tile.path.join("/")}`);
    assert.equal(tile.parentId, `p:${tile.path.slice(0, 4).join("/")}`);
    assert.equal(tile.pieces[0], `p:${tile.path.join("/")}`, "the smaller half names the tile");
    assert.equal(tile.classIndex, tile.lineage[4]);
    for (let g = 1; g <= 4; g++) { // slot → class: acute(0) → [acute, obtuse]; obtuse(1) → [obtuse, obtuse, acute]
      const expected = tile.lineage[g - 1] === 0 ? [0, 1][tile.path[g]] : [1, 1, 0][tile.path[g]];
      assert.equal(tile.lineage[g], expected, `generation ${g}`);
    }
    assert.equal(tileAncestorId(tile, 2), `p:${tile.path.slice(0, 3).join("/")}`);
  }
  assert.throws(() => tileAncestorId(t.tiles[0], 5), /Ancestor generation/);
  const deeper = substitutionTiling(options({ patch: "sun", depth: 5, radius: 200, rotation: 33 }));
  const ids = new Set(deeper.vertices.map((v) => v.id));
  assert.ok(t.vertices.every((v) => ids.has(v.id)), "coarser vertices survive as vertices of the finer tiling");
  const full = substitutionTiling(options({ patch: "decagon", depth: 6 }));
  const cropped = substitutionTiling(options({ patch: "decagon", depth: 6, crop: "rectangle", cropX: 300, cropY: 340, cropWidth: 180, cropHeight: 140 }));
  const fullById = new Map(full.tiles.map((tile) => [tile.id, tile]));
  assert.ok(cropped.tiles.length > 20 && cropped.tiles.length < full.tiles.length / 4);
  for (const tile of cropped.tiles) {
    const same = fullById.get(tile.id)!;
    assert.deepEqual(tile.points, same.points);
    assert.equal(tile.complete, same.complete, "no half-tile is invented by the crop");
    assert.ok(Math.abs(tile.position[0] - 300) <= 90 && Math.abs(tile.position[1] - 340) <= 70);
  }
  const inCrop = full.tiles.filter((tile) => Math.abs(tile.position[0] - 300) <= 90 && Math.abs(tile.position[1] - 340) <= 70);
  assert.equal(cropped.tiles.length, inCrop.length, "every tile whose center is inside is kept");
  const ellipse = substitutionTiling(options({ patch: "decagon", depth: 6, crop: "ellipse", cropX: 320, cropY: 320, cropWidth: 300, cropHeight: 120 }));
  for (const tile of ellipse.tiles) assert.ok(((tile.position[0] - 320) / 150) ** 2 + ((tile.position[1] - 320) / 60) ** 2 <= 1 + 1e-9);
  assert.ok(ellipse.tiles.length > 10);
});

test("boundary 'whole' removes exactly the lone half-tiles; a different seed changes no geometry", () => {
  const halves = substitutionTiling(options({ patch: "sun", depth: 5 }));
  const whole = substitutionTiling(options({ patch: "sun", depth: 5, boundary: "whole" }));
  const lone = halves.tiles.filter((tile) => !tile.complete);
  assert.ok(lone.length > 0);
  assert.equal(whole.tiles.length, halves.tiles.length - lone.length);
  assert.ok(whole.tiles.every((tile) => tile.complete));
  const other = substitutionTiling(options({ patch: "sun", depth: 5, seed: 7 }));
  assert.deepEqual(other.tiles.map((tile) => tile.points), halves.tiles.map((tile) => tile.points));
  assert.notEqual(other.tiles[0].seed, halves.tiles[0].seed);
  assert.equal(halves.tiles[0].seed, substitutionTiling(options({ patch: "sun", depth: 5 })).tiles[0].seed);
});

test("results are deeply frozen and cached by construction", () => {
  const t = substitutionTiling(options({ depth: 3 }));
  assert.equal(substitutionTiling(options({ depth: 3 })), t);
  assert.notEqual(substitutionTiling(options({ depth: 4 })), t);
  assert.ok(Object.isFrozen(t) && Object.isFrozen(t.tiles) && Object.isFrozen(t.tiles[0]) && Object.isFrozen(t.tiles[0].points[0]));
  assert.ok(Object.isFrozen(t.edges[0].points) && Object.isFrozen(t.vertices[0]) && Object.isFrozen(t.tiles[0].lineage));
  assert.throws(() => { (t.tiles as unknown as unknown[]).push(1); });
});

test("invalid input and unbounded work fail with precise errors", () => {
  assert.throws(() => substitutionTiling(options({ rule: "pinwheel" as never })), /Unknown tiling rule/);
  assert.throws(() => substitutionTiling(options({ patch: "block" })), /Unknown penrose-p3 patch/);
  assert.throws(() => substitutionTiling(options({ rule: "chair", patch: "sun" })), /Unknown chair patch/);
  assert.throws(() => substitutionTiling(options({ depth: 2.5 })), /Tiling depth/);
  assert.throws(() => substitutionTiling(options({ depth: -1 })), /Tiling depth/);
  assert.throws(() => substitutionTiling(options({ depth: 17 })), /Tiling depth/);
  assert.throws(() => substitutionTiling(options({ radius: 0 })), /Tiling radius/);
  assert.throws(() => substitutionTiling(options({ radius: Number.NaN })), /Tiling radius/);
  assert.throws(() => substitutionTiling(options({ seed: -1 })), /uint32/);
  assert.throws(() => substitutionTiling(options({ crop: "ellipse", cropWidth: 0 })), /crop width/);
  assert.equal(substitutionTiling(options({ depth: 0, patch: "thin" })).tiles.length, 1, "depth 0 is the seed itself");
  // 109,450 decagon pieces at depth 10 (and 65,536 chair pieces at depth 8) exceed the limit before any expansion happens...
  const started = performance.now();
  assert.throws(() => substitutionTiling(options({ patch: "decagon", depth: 9 })), new RegExp(`limit ${MAX_TILING_PIECES}`));
  assert.throws(() => substitutionTiling(options({ rule: "chair", patch: "block", depth: 8 })), /substitution pieces/);
  assert.ok(performance.now() - started < 50, "rejected without expanding");
  // ...but the same depth is fine when a small crop prunes what cannot be seen.
  const cropped = substitutionTiling(options({ patch: "decagon", depth: 12, radius: 4000, crop: "rectangle", cropX: 320, cropY: 320, cropWidth: 300, cropHeight: 300 }));
  assert.ok(cropped.tiles.length > 100 && cropped.pieces <= MAX_TILING_PIECES);
  assert.throws(() => substitutionTiling(options({ patch: "decagon", depth: 14, radius: 4000, crop: "rectangle", cropWidth: 3000, cropHeight: 3000 })), /substitution pieces/);
});

// ── consumers ────────────────────────────────────────────────────────────────────────────────
class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  lines: number[][] = []; shapes: Point[][] = []; fills: number[][] = [];
  m = [1, 0, 0, 1, 0, 0]; stack: number[][] = []; open: Point[] | null = null; fillColor: number[] = [];
  push() { this.stack.push([...this.m]); }
  pop() { this.m = this.stack.pop()!; }
  #mul(a: number, b: number, c: number, d: number, e: number, f: number) {
    const [A, B, C, D, E, F] = this.m;
    this.m = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F];
  }
  translate(x: number, y: number) { this.#mul(1, 0, 0, 1, x, y); }
  rotate(r: number) { this.#mul(Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0); }
  scale(x: number, y = x) { this.#mul(x, 0, 0, y, 0, 0); }
  #pt(x: number, y: number): Point { const [a, b, c, d, e, f] = this.m; return [a * x + c * y + e, b * x + d * y + f]; }
  line(x1: number, y1: number, x2: number, y2: number) { this.lines.push([...this.#pt(x1, y1), ...this.#pt(x2, y2)]); }
  circle() {}
  beginShape() { this.open = []; }
  vertex(x: number, y: number) { this.open!.push(this.#pt(x, y)); }
  endShape() { this.shapes.push(this.open!); this.fills.push(this.fillColor); this.open = null; }
  fill(...c: number[]) { this.fillColor = c; }
  noFill() {} noStroke() {} stroke() {} strokeWeight() {} strokeCap() {} rect() {}
}
const spec = (overrides: Partial<TileFillSpec> = {}): TileFillSpec => ({ kind: "hatch", inset: 1, opacity: 1, spacing: 3, angle: 0, classTurn: 0,
  weight: 1, layers: 3, bleed: .3, retention: 1, mark: { kind: "arrow", size: .5, petals: 6, opening: .3, weight: 1, rotation: 0, variation: 0, retention: 1 }, ...overrides });
const palette = [0x111111, 0xaa3322, 0xddaa33, 0x227766, 0x664488];

test("insetPolygon keeps uniform clearance on convex and concave tiles and refuses to collapse", () => {
  const square: Point[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.deepEqual(insetPolygon(square, 1)!.map(([x, y]) => [Math.round(x * 1e9) / 1e9, Math.round(y * 1e9) / 1e9]), [[1, 1], [9, 1], [9, 9], [1, 9]]);
  const chair: Point[] = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]];
  const inset = insetPolygon(chair, 2)!;
  assert.deepEqual(inset.map(([x, y]) => [Math.round(x * 1e9) / 1e9, Math.round(y * 1e9) / 1e9]), [[2, 2], [18, 2], [18, 8], [8, 8], [8, 18], [2, 18]]);
  assert.equal(insetPolygon(square, 5), undefined, "a square of side 10 vanishes at 5");
  assert.equal(insetPolygon(chair, 5), undefined, "the chair's arms are 10 wide");
  assert.ok(insetPolygon(chair, 4.9));
  assert.deepEqual(insetPolygon(square, 0), square);
});

test("hatching stays inside its tile, follows the tile's own axis and differs per class", () => {
  const t = substitutionTiling(options({ patch: "sun", depth: 3, rotation: 23, boundary: "whole" }));
  const surface = new Recorder();
  atEach(surface, t.tiles, tileFill(spec({ classTurn: 90 }), palette), createCompositionRun({ maxWork: 1e6 }));
  assert.ok(surface.lines.length > t.tiles.length, "several lines per tile");
  const owner = (line: number[]) => t.tiles.find((tile) => contains(tile.points, [(line[0] + line[2]) / 2, (line[1] + line[3]) / 2]))!;
  const angles = new Map<string, Set<number>>();
  for (const line of surface.lines) {
    const tile = owner(line);
    assert.ok(tile, "the line's midpoint is inside a tile");
    for (const p of [[line[0], line[1]], [line[2], line[3]]] as Point[]) {
      const others = t.tiles.filter((x) => contains(x.points, p)).length;
      assert.ok(others <= 1);
    }
    // hatch direction relative to the tile axis: 0 degrees plus 90 per class index.
    const relative = Math.atan2(line[3] - line[1], line[2] - line[0]) - tile.angle;
    const turned = (((relative / RAD - 90 * tile.classIndex) % 180) + 180) % 180;
    assert.ok(Math.min(turned, 180 - turned) < 1e-6, `direction ${turned}`);
    (angles.get(tile.class) ?? angles.set(tile.class, new Set()).get(tile.class)!).add(Math.round(((relative / RAD % 180) + 180) % 180));
  }
  assert.deepEqual([...angles.keys()].sort(), ["thick", "thin"]);
  assert.notDeepEqual([...angles.get("thick")!], [...angles.get("thin")!]);
});

test("omitting a tile class leaves bare paper and its edges follow only the tiles that remain", () => {
  const t = substitutionTiling(options({ patch: "sun", depth: 4, boundary: "whole" }));
  const view = (classes: string[], retention = 1): TilingView => ({ classes, retention, colorBy: "class", colorLevel: 1, fill: spec(), edges: "visible",
    edgeColor: "uniform", edgeMaterial: { kind: "ink", weight: 1, spacing: 5, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark: spec().mark },
    vertices: "none", vertexMark: spec().mark });
  const thick = shownTiles(t.tiles, view(["thick"]));
  assert.ok(thick.length > 0 && thick.every((tile) => tile.class === "thick"));
  assert.equal(shownTiles(t.tiles, view([])).length, 0);
  assert.equal(shownTiles(t.tiles, view(["thin", "thick"])).length, t.tiles.length);
  // Stable omission: a lower retention keeps a subset of a higher one, whatever the order.
  const few = new Set(shownTiles(t.tiles, view(["thin", "thick"], .3)).map((tile) => tile.id));
  const more = new Set(shownTiles(t.tiles, view(["thin", "thick"], .6)).map((tile) => tile.id));
  assert.ok(few.size > 0 && few.size < more.size && more.size < t.tiles.length);
  for (const id of few) assert.ok(more.has(id));
  const reversed = [...t.tiles].reverse();
  assert.deepEqual(new Set(shownTiles(reversed, view(["thin", "thick"], .3)).map((tile) => tile.id)), few);
});

test("hierarchical tone follows ancestry, and edge tone follows the boundary level", () => {
  const t = substitutionTiling(options({ patch: "decagon", depth: 5 }));
  const seed = 42;
  // 'supertile' groups: tiles with the same ancestor `level` generations up share one tone.
  const groups = new Map<string, Set<number>>();
  const tones = new Set<number>();
  for (const tile of t.tiles) {
    const tone = tileTone(tile, seed, "supertile", 3, 5);
    tones.add(tone);
    assert.ok(tone >= 1 && tone <= 4);
    const key = tileAncestorId(tile, 2);
    (groups.get(key) ?? groups.set(key, new Set()).get(key)!).add(tone);
  }
  for (const set of groups.values()) assert.equal(set.size, 1);
  assert.ok(tones.size >= 3, "different supertiles get different colors");
  assert.notDeepEqual(t.tiles.map((tile) => tileTone(tile, 43, "supertile", 3, 5)), t.tiles.map((tile) => tileTone(tile, seed, "supertile", 3, 5)));
  for (const tile of t.tiles) {
    assert.equal(tileTone(tile, seed, "class", 1, 5), 1 + tile.classIndex);
    assert.equal(tileTone(tile, seed, "ancestor", 2, 5), 1 + tile.lineage[3]);
    assert.equal(tileTone(tile, seed, "slot", 1, 5), 1 + tile.path[4] % 4);
    assert.equal(tileTone(tile, seed, "slot", 99, 5), 1 + tile.path[0] % 4, "levels above the seed clamp to the seed piece");
    assert.equal(tileTone(tile, seed, "class", 1, 1), 0, "one color: no reserved ink");
  }
  const uniform = tonedEdges(t, "uniform", 5), hierarchy = tonedEdges(t, "hierarchy", 5);
  assert.ok(uniform.every((path) => path.tone === 0));
  hierarchy.forEach((path, i) => assert.equal(path.tone, t.edges[i].level < 4 ? t.edges[i].level + 1 : 0));
  assert.ok(new Set(hierarchy.map((path) => path.tone)).size === 5);
});

test("vertex selection: the regular vertices are the Penrose suns and the chair's four-corner points", () => {
  const p = substitutionTiling(options({ patch: "sun", depth: 5 }));
  const suns = selectedVertices(p, "regular", 5);
  assert.ok(suns.length > 10 && suns.every((v) => v.signature === "2.2.2.2.2" && v.interior && v.valence === 5));
  assert.equal(suns.length, p.vertices.filter((v) => v.signature === "2.2.2.2.2" && v.interior).length);
  const c = substitutionTiling(options({ rule: "chair", patch: "chair", depth: 4 }));
  const four = selectedVertices(c, "regular", 5);
  assert.ok(four.length > 50 && four.every((v) => v.signature === "1.1.1.1"));
  assert.ok(selectedVertices(c, "interior", 5).length > four.length, "T-junctions and reflex points are interior but not regular");
  assert.deepEqual(selectedVertices(c, "none", 5), []);
});

test("the named recipe draws exactly what the direct functions draw, and appearance edits never rebuild the tiling", () => {
  const input = createInstrument("substitution-tilings");
  const recipe = referenceComposition(input);
  assert.equal(recipe.kind, "tiling");
  const built = substitutionTiling((recipe as Extract<typeof recipe, { kind: "tiling" }>).source);
  const restyled = referenceComposition({ ...input, palette: [1, 2, 3], params: { ...input.params, interior: "hatch", edges: "all", edgeMaterial: "stitch",
    vertices: "none", colorBy: "supertile", inset: 3, opacity: .4, showThin: false, retention: .5 } });
  assert.equal(substitutionTiling((restyled as Extract<typeof recipe, { kind: "tiling" }>).source), built, "same construction, same frozen tiling");
  const deeper = referenceComposition({ ...input, params: { ...input.params, depth: 6 } });
  assert.notEqual(substitutionTiling((deeper as Extract<typeof recipe, { kind: "tiling" }>).source), built);
  const a = new Recorder(), b = new Recorder();
  drawReferenceComposition(a, recipe);
  const view = (recipe as Extract<typeof recipe, { kind: "tiling" }>).view;
  assert.ok(view.fill.kind === "wash" && a.shapes.length > 1000, "wash polygons and outlines were drawn");
  drawReferenceComposition(b, recipe);
  assert.deepEqual(b.shapes, a.shapes, "drawing is deterministic");
  // Unknown recipe bindings and out-of-range values are actionable errors, not fallbacks.
  assert.throws(() => referenceComposition({ ...input, params: { ...input.params, depth: 20 } }), /depth/i);
  assert.throws(() => referenceComposition({ ...input, params: { ...input.params, rule: "pinwheel" } }));
  assert.equal(usesSeedFor(input, { interior: "flat", bleed: .5 }), false);
  assert.equal(usesSeedFor(input, { interior: "wash", bleed: .5 }), true);
  assert.equal(usesSeedFor(input, { interior: "wash", bleed: 0, retention: .5 }), true);
  assert.equal(usesSeedFor(input, { interior: "hatch", colorBy: "supertile" }), true);
});
function usesSeedFor(input: InstrumentInput, params: Record<string, string | number>): boolean {
  return usesSeed({ ...input, params: { ...input.params, retention: 1, colorBy: "slot", ...params } });
}

test("tiling interiors are drawn in tile-local frames: a tile's own arrow follows its axis", () => {
  const t = substitutionTiling(options({ patch: "thick", depth: 2, rotation: 40 }));
  const surface = new Recorder();
  atEach(surface, t.tiles, tileFill(spec({ kind: "mark", mark: { ...spec().mark, size: .8 } }), palette), createCompositionRun({ maxWork: 1e6 }));
  assert.equal(surface.lines.length, t.tiles.length * 4, "one four-line arrow per tile");
  for (let i = 0; i < t.tiles.length; i++) {
    const [x1, y1, x2, y2] = surface.lines[i * 4];
    near(Math.atan2(y2 - y1, x2 - x1), Math.atan2(Math.sin(t.tiles[i].angle), Math.cos(t.tiles[i].angle)), 1e-7);
    near((x1 + x2) / 2, t.tiles[i].position[0], 1e-7);
    near((y1 + y2) / 2, t.tiles[i].position[1], 1e-7);
  }
});
