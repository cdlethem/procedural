import assert from "node:assert/strict";
import test from "node:test";
import {
  EDGE_TOLERANCE, MAX_HYPERBOLIC_TILES, addressMatrix, composeHyperbolic, createInstrument, definition, drawHyperbolicGardens, drawInstrument, hatchPolygon,
  hyperbolicCellPaths, hyperbolicDeterminant, hyperbolicEdgePaths, hyperbolicFrames, hyperbolicGardensComposition, hyperbolicProducts, hyperbolicRings,
  hyperbolicTiling, hyperbolicTone, inspectorItems, mirrorAddress, applyHyperbolic, retainCells, triangleGroup, usesSeed, validateInstrument,
  validateParameters, visibleParameters, type CompositionSurface, type HyperbolicOptions, type HyperbolicTiling, type Point,
} from "../dist/index.js";

const ID = "hyperbolic-gardens";
const CX = 320, CY = 320, RADIUS = 300;
const options = (overrides: Partial<HyperbolicOptions> = {}): HyperbolicOptions => ({
  seed: 42, p: 5, q: 4, center: "polygon", generations: 3, diskRadius: 0.9999, minSize: 0.05, centerX: CX, centerY: CY, radius: RADIUS, rotation: 0, ...overrides,
});
const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);

// ---- Independent complex-plane helpers (Poincare disk, no hyperboloid): everything the producer claims is re-derived here.
type C = [number, number];
const cadd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const csub = (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]];
const cmul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const conj = (a: C): C => [a[0], -a[1]];
const cdiv = (a: C, b: C): C => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const cabs = (a: C) => Math.hypot(a[0], a[1]);
const disk = (p: Point): C => [(p[0] - CX) / RADIUS, (p[1] - CY) / RADIUS];
/** Hyperbolic distance from the Mobius formula d = 2 atanh |(z - w)/(1 - conj(z) w)|. */
const hdist = (z: C, w: C) => 2 * Math.atanh(cabs(cdiv(csub(z, w), csub([1, 0], cmul(conj(z), w)))));
/** Interior angle at v between the geodesics to a and b: move v to 0 by a Mobius map, which preserves angles and straightens both geodesics. */
function angleAt(v: C, a: C, b: C): number {
  const move = (z: C) => cdiv(csub(z, v), csub([1, 0], cmul(conj(v), z)));
  const ma = move(a), mb = move(b);
  let angle = Math.abs(Math.atan2(ma[1], ma[0]) - Math.atan2(mb[1], mb[0]));
  if (angle > Math.PI) angle = 2 * Math.PI - angle;
  return angle;
}
/** Hyperbolic area of the triangle with vertices a, b, c by Girard from the hyperbolic law of cosines. */
function triangleArea(a: C, b: C, c: C): number {
  const sa = hdist(b, c), sb = hdist(a, c), sc = hdist(a, b);
  const angle = (x: number, y: number, z: number) => Math.acos(Math.max(-1, Math.min(1, (Math.cosh(y) * Math.cosh(z) - Math.cosh(x)) / (Math.sinh(y) * Math.sinh(z)))));
  return Math.PI - angle(sa, sb, sc) - angle(sb, sa, sc) - angle(sc, sa, sb);
}
/** Reflection across the geodesic through a and b (a circle orthogonal to the unit circle, or a diameter). Returns the map and its derivative direction. */
function geodesicReflection(a: C, b: C): { map: (z: C) => C; turn: (z: C, angle: number) => number } {
  const det = a[0] * b[1] - a[1] * b[0];
  if (Math.abs(det) < 1e-9) {
    const phi = Math.atan2(a[1], a[0]);
    return { map: (z) => cmul([Math.cos(2 * phi), Math.sin(2 * phi)], conj(z)), turn: (_z, angle) => 2 * phi - angle };
  }
  const ra = (a[0] * a[0] + a[1] * a[1] + 1) / 2, rb = (b[0] * b[0] + b[1] * b[1] + 1) / 2;
  const c: C = [(ra * b[1] - rb * a[1]) / det, (a[0] * rb - b[0] * ra) / det];
  const r2 = c[0] * c[0] + c[1] * c[1] - 1;
  return {
    map: (z) => cadd(c, cdiv([r2, 0], conj(csub(z, c)))),
    // d(inversion)(v) = -r^2 conj(v) / conj(z - c)^2, so a direction at angle t goes to angle pi + 2 arg(z - c) - t.
    turn: (z, angle) => Math.PI + 2 * Math.atan2(z[1] - c[1], z[0] - c[0]) - angle,
  };
}
const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
const rotate = (z: C, phi: number): C => cmul(z, [Math.cos(phi), Math.sin(phi)]);

/** Independent tiling: reflect polygons across their edge circles, deduplicating by centre. Returns centres per generation. */
function independentTiling(p: number, q: number, generations: number, turn: number): { centres: C[][]; vertices: number[] } {
  const R = Math.acosh(1 / (Math.tan(Math.PI / p) * Math.tan(Math.PI / q)));
  const rho = Math.tanh(R / 2);
  const vertices0: C[] = Array.from({ length: p }, (_, k) => rotate([rho, 0], turn + 2 * Math.PI * k / p));
  type Poly = { centre: C; verts: C[] };
  const known: C[] = [[0, 0]];
  const seen = (z: C) => known.some((k) => cabs(csub(k, z)) < 1e-8);
  let frontier: Poly[] = [{ centre: [0, 0], verts: vertices0 }];
  const centres: C[][] = [[[0, 0]]];
  const vertexIds = new Set<string>();
  const vertexKey = (z: C) => `${Math.round(z[0] * 1e7)},${Math.round(z[1] * 1e7)}`;
  const firstSeen = [new Set<string>()];
  for (const v of vertices0) { vertexIds.add(vertexKey(v)); firstSeen[0].add(vertexKey(v)); }
  for (let g = 1; g <= generations; g++) {
    const next: Poly[] = [];
    firstSeen.push(new Set());
    for (const poly of frontier) for (let k = 0; k < p; k++) {
      const { map } = geodesicReflection(poly.verts[k], poly.verts[(k + 1) % p]);
      const centre = map(poly.centre);
      if (seen(centre)) continue;
      known.push(centre);
      const verts = poly.verts.map(map);
      next.push({ centre, verts });
      for (const v of verts) if (!vertexIds.has(vertexKey(v))) { vertexIds.add(vertexKey(v)); firstSeen[g].add(vertexKey(v)); }
    }
    centres.push(next.map((n) => n.centre));
    frontier = next;
  }
  return { centres, vertices: firstSeen.map((s) => s.size) };
}

/**
 * Independent combinatorial oracle for cells and new vertices per generation: the boundary of the grown region is a cyclic
 * list of "cells here" counts d (1 <= d < q). A boundary vertex with d = q - 1 is closed by one cell that also covers both of
 * its boundary edges; otherwise every boundary edge gets its own cell. No geometry is involved.
 */
function ringOracle(p: number, q: number, center: "polygon" | "vertex" | "edge", generations: number): { cells: number[]; vertices: number[] } {
  let ring: number[], cells = 1, vertices: number;
  if (center === "polygon") { ring = Array(p).fill(1); vertices = p; }
  else if (center === "vertex") {
    ring = []; for (let i = 0; i < q; i++) ring.push(2, ...Array(p - 3).fill(1));
    cells = q; vertices = 1 + q * (p - 2);
  } else { ring = [2, ...Array(p - 2).fill(1), 2, ...Array(p - 2).fill(1)]; cells = 2; vertices = 2 * p - 2; }
  const outCells = [cells], outVertices = [vertices];
  for (let g = 1; g <= generations; g++) {
    const m = ring.length;
    // Rotate so that the ring starts right after a vertex that is not closed by a single cell.
    let start = ring.findIndex((d) => d < q - 1);
    assert.ok(start >= 0, "ring closed");
    ring = [...ring.slice(start), ...ring.slice(0, start)];
    // Runs of edges e_i (from vertex i to i+1) joined through vertices with d = q - 1.
    const runs: number[] = [];
    let length = 0;
    for (let i = 0; i < m; i++) {
      length++;
      const next = ring[(i + 1) % m];
      if (next < q - 1) { runs.push(length); length = 0; }
    }
    // For each run, its outer vertices: p - k - 1 with k edges; joined at every old boundary vertex with q - d - 2 = 0.
    const items: ({ d: number } | "merge")[] = [];
    let created = 0, merges = 0;
    let index = 0;
    for (const k of runs) {
      const outer = p - k - 1;
      assert.ok(outer >= 1, "cell covers the whole ring");
      for (let j = 0; j < outer; j++) items.push({ d: 1 });
      created += outer;
      index += k;
      const old = ring[index % m];
      if (q - old - 2 === 0) { items.push("merge"); merges++; } else items.push({ d: old + 2 });
    }
    // Collapse merges cyclically.
    const wraps = items[items.length - 1] === "merge";
    const next: number[] = [];
    let pendingMerge = false;
    for (const item of wraps ? items.slice(0, -1) : items) {
      if (item === "merge") { pendingMerge = true; continue; }
      if (pendingMerge) { next[next.length - 1] += item.d; pendingMerge = false; } else next.push(item.d);
    }
    if (wraps) next[0] += next.pop()!;
    cells = runs.length;
    vertices = created - merges;
    ring = next.filter((d) => d < q);
    outCells.push(cells);
    outVertices.push(vertices);
  }
  return { cells: outCells, vertices: outVertices };
}

/** Coefficients of the reflection group's growth series 1/(sum over finite parabolic subgroups T of (-1)^|T| u^N_T / W_T(u)) (Steinberg). */
function growthSeries(p: number, q: number, terms: number): number[] {
  const mulSeries = (a: number[], b: number[]) => { const r = Array(terms).fill(0); a.forEach((x, i) => b.forEach((y, j) => { if (i + j < terms) r[i + j] += x * y; })); return r; };
  const invSeries = (a: number[]) => { const r = Array(terms).fill(0); r[0] = 1 / a[0]; for (let n = 1; n < terms; n++) { let s = 0; for (let k = 1; k <= n; k++) s += (a[k] ?? 0) * r[n - k]; r[n] = -s / a[0]; } return r; };
  const poly = (c: number[]) => [...c, ...Array(Math.max(0, terms - c.length)).fill(0)];
  const bracket = (m: number) => poly(Array(m).fill(1));
  const one = poly([1, 1]);
  const subgroups: { size: number; w: number[]; degree: number }[] = [
    { size: 0, w: poly([1]), degree: 0 },
    ...[0, 1, 2].map(() => ({ size: 1, w: one, degree: 1 })),
    { size: 2, w: mulSeries(one, one), degree: 2 }, // s0, s1 commute
    { size: 2, w: mulSeries(one, bracket(p)), degree: p }, // s1, s2 at the cell centre
    { size: 2, w: mulSeries(one, bracket(q)), degree: q }, // s0, s2 at a vertex
  ];
  const total = Array(terms).fill(0);
  for (const { size, w, degree } of subgroups) {
    const term = mulSeries(invSeries(w), poly([...Array(degree).fill(0), 1]));
    term.forEach((x, i) => { total[i] += (size % 2 ? -1 : 1) * x; });
  }
  return invSeries(total).map(Math.round);
}

interface IdSets { cells: Set<string>; vertices: Set<string>; edges: Set<string> }
const CASES: readonly (readonly [number, number])[] = [[5, 4], [7, 3], [4, 5], [3, 7], [6, 4]];

test("tilings that are not hyperbolic fail validation naming both controls", () => {
  for (const [p, q] of [[3, 3], [3, 4], [3, 5], [3, 6], [4, 3], [4, 4], [5, 3], [6, 3]])
    assert.throws(() => hyperbolicTiling(options({ p, q })), (e: Error) => /\(p-2\)\(q-2\)/.test(e.message) && /Polygon sides/.test(e.message) && /Cells at a vertex/.test(e.message), `{${p},${q}}`);
  for (const [p, q] of [[3, 7], [7, 3], [5, 4], [4, 5], [8, 3], [3, 8], [24, 24]]) assert.doesNotThrow(() => triangleGroup(p, q), `{${p},${q}}`);
  assert.throws(() => hyperbolicTiling(options({ p: 5.5 })), /Polygon sides/);
  assert.throws(() => hyperbolicTiling(options({ q: 2 })), /Cells at a vertex/);
  const bad = { ...createInstrument(ID).params, p: 6, q: 3 };
  assert.throws(() => validateParameters(ID, bad), /not a hyperbolic tiling/);
  assert.throws(() => validateInstrument({ ...createInstrument(ID), params: bad }), /not a hyperbolic tiling/);
  assert.throws(() => hyperbolicTiling(options({ diskRadius: 1 })), /Disk radius/);
  assert.throws(() => hyperbolicTiling(options({ minSize: 0 })), /Smallest cell/);
});

test("cells and vertices per generation equal an independent combinatorial count, for every centre", () => {
  const known: Record<string, { cells: number[]; vertices: number[] }> = {
    "5,4,polygon": { cells: [1, 5, 15, 40, 105], vertices: [5, 15, 40, 105, 275] },
    "7,3,polygon": { cells: [1, 7, 21, 56, 147], vertices: [7, 28, 77, 203, 532] },
    "4,5,polygon": { cells: [1, 4, 12, 28, 64], vertices: [4, 8, 20, 48, 108] },
    "5,4,vertex": { cells: [4, 12, 32, 84, 220], vertices: [13, 32, 84, 220, 576] },
    "5,4,edge": { cells: [2, 8, 22, 58, 152], vertices: [8, 22, 58, 152, 398] },
  };
  // The oracle needs every new cell to bring at least one new vertex, which fails only for triangles.
  for (const [p, q] of CASES.filter(([p]) => p >= 4)) for (const center of ["polygon", "vertex", "edge"] as const) {
    const t = hyperbolicTiling(options({ p, q, center, generations: 4 }));
    const expected = ringOracle(p, q, center, 4);
    assert.deepEqual([...t.layers], expected.cells, `cells {${p},${q}} ${center}`);
    const vertices = Array(5).fill(0);
    for (const v of t.vertices) vertices[v.generation]++;
    assert.deepEqual(vertices, expected.vertices, `vertices {${p},${q}} ${center}`);
    const literal = known[`${p},${q},${center}`];
    if (literal) { assert.deepEqual(expected.cells, literal.cells); assert.deepEqual(expected.vertices, literal.vertices); }
  }
  // {7,3}: seven cells around the first, then 7 * 3 = 21 (closed at each old vertex by one cell), checked by hand.
  assert.deepEqual([...hyperbolicTiling(options({ p: 7, q: 3, generations: 2 })).layers], [1, 7, 21]);
});

test("the region is a disk: Euler characteristic, valence, and edge sharing", () => {
  for (const [p, q] of CASES) for (const center of ["polygon", "vertex", "edge"] as const) {
    const t = hyperbolicTiling(options({ p, q, center, generations: 4 }));
    assert.equal(t.vertices.length - t.edges.length + t.tiles.length, 1, `{${p},${q}} ${center}`);
    assert.ok(t.edges.every((e) => e.a !== e.b && (e.tiles[1] === null || e.tiles[1] !== e.tiles[0])));
    const boundary = t.edges.filter((e) => e.tiles[1] === null).length;
    assert.equal(2 * t.edges.length, p * t.tiles.length + boundary);
    for (const cell of t.tiles) {
      assert.equal(new Set(cell.vertices).size, p);
      assert.equal(new Set(cell.edges).size, p);
    }
    for (const v of t.vertices) {
      assert.ok(v.valence >= 1 && v.valence <= q);
      assert.equal(v.interior, v.valence === q);
      assert.equal(v.tiles.length, v.valence);
    }
    // Interior vertices are exactly those whose q cells are all kept: the boundary of the region has no interior vertex.
    const onBoundary = new Set(t.edges.filter((e) => e.tiles[1] === null).flatMap((e) => [e.a, e.b]));
    assert.ok(t.vertices.every((v) => v.interior !== onBoundary.has(v.id)));
    // Neighbours are symmetric and match the edge's two cells.
    const byId = new Map(t.tiles.map((c) => [c.id, c]));
    for (const cell of t.tiles) cell.neighbors.forEach((other, k) => {
      const edge = t.edges.find((e) => e.id === cell.edges[k])!;
      assert.deepEqual([...edge.tiles].filter(Boolean).sort(), other === null ? [cell.id] : [cell.id, other].sort());
      if (other) assert.ok(byId.get(other)!.neighbors.includes(cell.id));
    });
  }
});

test("angles and Gauss-Bonnet: every corner is 2pi/q, every cell has the closed-form area, measured by an independent Mobius construction", () => {
  for (const [p, q] of CASES) {
    const t = hyperbolicTiling(options({ p, q, generations: 2 }));
    const byId = new Map(t.vertices.map((v) => [v.id, v]));
    const expected = Math.PI * (p * q - 2 * p - 2 * q) / q;
    near(t.cellArea, expected);
    for (const cell of t.tiles) {
      const corners = cell.vertices.map((id) => disk(byId.get(id)!.position));
      const angles = corners.map((v, k) => angleAt(v, corners[(k + p - 1) % p], corners[(k + 1) % p]));
      angles.forEach((a) => near(a, 2 * Math.PI / q, 1e-9));
      near((p - 2) * Math.PI - angles.reduce((s, a) => s + a, 0), expected, 1e-9);
      // Area again by triangulating from the centre with Girard's formula: no angle sum involved.
      const centre = disk(cell.position);
      let area = 0;
      for (let k = 0; k < p; k++) area += triangleArea(centre, corners[k], corners[(k + 1) % p]);
      near(area, expected, 1e-9);
      // The circumradius and the edge length are the same for every cell.
      corners.forEach((v, k) => { near(hdist(centre, v), t.circumradius, 1e-9); near(hdist(v, corners[(k + 1) % p]), t.edgeLength, 1e-9); });
    }
  }
});

test("edges are geodesics: circles orthogonal to the unit circle or diameters, sampled within the stated tolerance, of the exact hyperbolic length", () => {
  let curved = 0, straight = 0;
  // With an odd q every cell-edge mirror is conjugate to a mirror through the cell centre, so some edges lie on diameters; with an even q none do.
  for (const [p, q] of [[5, 4], [7, 3]] as const) {
    const t = hyperbolicTiling(options({ p, q, generations: 3 }));
    for (const edge of t.edges) {
      const pts = edge.points.map(disk);
      const [a, b] = [pts[0], pts[pts.length - 1]];
      if (Math.abs(a[0] * b[1] - a[1] * b[0]) < 1e-9) {
        straight++;
        assert.equal(q % 2, 1, "only odd q puts edges on diameters");
        assert.ok(pts.every((z) => Math.abs(z[0] * a[1] - z[1] * a[0]) < 1e-9), "diameter edge stays on its line");
        assert.equal(pts.length, 2, "a straight edge needs no interior samples");
      } else {
        curved++;
        const { map } = geodesicReflection(a, b);
        // Points on the orthogonal circle are fixed by its inversion.
        for (const z of pts) assert.ok(cabs(csub(map(z), z)) * RADIUS <= 1e-6, "sample lies on the geodesic circle");
        // Each chord's midpoint is within the tolerance of the true arc (the arc point over the chord midpoint is the inversion-fixed circle).
        for (let i = 1; i < pts.length; i++) {
          const mid: C = [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2];
          assert.ok(cabs(csub(map(mid), mid)) * RADIUS / 2 <= EDGE_TOLERANCE * 1.05 + 1e-6, `polyline within ${EDGE_TOLERANCE}`);
        }
      }
      // Hyperbolic length of the polyline (sum of exact chord lengths) is the edge length up to the sampling error.
      let length = 0;
      for (let i = 1; i < pts.length; i++) length += hdist(pts[i - 1], pts[i]);
      near(length, t.edgeLength, 1e-3);
    }
  }
  assert.ok(curved > 10 && straight >= 1, "the sample has both kinds");
});

test("an independent tiling grown by circle inversion has the same cells, rotation included", () => {
  for (const [p, q] of [[5, 4], [7, 3], [4, 5]] as const) for (const rotation of [0, 37]) {
    const t = hyperbolicTiling(options({ p, q, generations: 3, rotation }));
    const turn = -Math.PI / 2 + rotation * Math.PI / 180;
    const oracle = independentTiling(p, q, 3, turn);
    assert.deepEqual(oracle.centres.map((c) => c.length), [...t.layers], `{${p},${q}} counts`);
    for (let g = 0; g <= 3; g++) {
      const mine = t.tiles.filter((c) => c.generation === g).map((c) => disk(c.position));
      for (const z of oracle.centres[g]) assert.ok(mine.some((m) => cabs(csub(m, z)) < 1e-9), `{${p},${q}} generation ${g} centre ${z}`);
    }
    const vertices = Array(4).fill(0);
    for (const v of t.vertices) vertices[v.generation]++;
    assert.deepEqual(vertices, oracle.vertices);
  }
  // Vertex- and edge-centred views are the same tiling seen from elsewhere: compare the sorted radii of the cell centres.
  for (const center of ["vertex", "edge"] as const) {
    const t = hyperbolicTiling(options({ p: 5, q: 4, center, generations: 3 }));
    const radii = t.tiles.map((c) => cabs(disk(c.position))).sort((a, b) => a - b);
    // Every cell centre is at hyperbolic distance a multiple-combination from the centre; the innermost cells surround the centre symmetrically.
    const inner = radii.filter((r) => Math.abs(r - radii[0]) < 1e-9).length;
    assert.equal(inner, center === "vertex" ? 4 : 2);
  }
});

test("isometry identities: Lorentz orthogonality, group relations, and reflection across a shared edge maps a cell onto its neighbour", () => {
  for (const [p, q] of CASES) {
    const g = triangleGroup(p, q);
    const J = [-1, 0, 0, 0, 1, 0, 0, 0, 1];
    const transpose = (m: readonly number[]) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
    const power = (m: readonly number[], n: number) => { let r: readonly number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1]; for (let i = 0; i < n; i++) r = composeHyperbolic(r, m); return r; };
    const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const close = (m: readonly number[], target: readonly number[], eps = 1e-12) => m.forEach((x, i) => assert.ok(Math.abs(x - target[i]) < eps, `entry ${i}: ${x} vs ${target[i]}`));
    const [s0, s1, s2] = g.mirrors;
    close(power(composeHyperbolic(s1, s2), p), identity);
    close(power(composeHyperbolic(s0, s2), q), identity);
    close(power(composeHyperbolic(s0, s1), 2), identity);
    for (const s of g.mirrors) { near(hyperbolicDeterminant(s), -1); close(composeHyperbolic(s, s), identity); }
    // Reflections fix their own mirror and the form: M^T J M = J.
    for (const m of [s0, s1, s2, g.turns[1]]) close(composeHyperbolic(composeHyperbolic(transpose(m), J), m), J);
  }
  const t = hyperbolicTiling(options({ p: 5, q: 4, generations: 3 }));
  const byId = new Map(t.tiles.map((c) => [c.id, c]));
  const vertexById = new Map(t.vertices.map((v) => [v.id, disk(v.position)]));
  for (const M of t.tiles) {
    // Cell transforms are orthogonal with determinant +1.
    const J = [-1, 0, 0, 0, 1, 0, 0, 0, 1];
    const transpose = [M.transform[0], M.transform[3], M.transform[6], M.transform[1], M.transform[4], M.transform[7], M.transform[2], M.transform[5], M.transform[8]];
    const gram = composeHyperbolic(composeHyperbolic(transpose, J), M.transform);
    gram.forEach((x, i) => assert.ok(Math.abs(x - J[i]) < 1e-9 * Math.max(1, M.transform[0] ** 2), "M^T J M = J"));
    near(hyperbolicDeterminant(M.transform), 1, 1e-9);
    M.neighbors.forEach((id, k) => {
      if (!id) return;
      const a = vertexById.get(M.vertices[k])!, b = vertexById.get((M.vertices[(k + 1) % 5]))!;
      const { map } = geodesicReflection(a, b);
      const reflected = M.vertices.map((v) => map(vertexById.get(v)!));
      const other = byId.get(id)!.vertices.map((v) => vertexById.get(v)!);
      for (const z of reflected) assert.ok(other.some((o) => cabs(csub(o, z)) < 1e-9), "the reflection of a cell is its neighbour");
    });
  }
});

test("mirror addresses: words of the group elements, and the chamber counts equal the reflection group's growth series", () => {
  for (const [p, q] of [[5, 4], [7, 3], [4, 5], [6, 4]] as const) {
    const g = triangleGroup(p, q);
    const expected = growthSeries(p, q, 9);
    assert.deepEqual(expected.slice(0, 4), p === 6 ? [1, 3, 5, 8] : p === 7 ? [1, 3, 5, 7] : [1, 3, 5, 8], "the series itself is sane");
    const seen = new Set<string>([""]);
    let frontier: number[][] = [[1, 0, 0, 0, 1, 0, 0, 0, 1]];
    const counts = [1];
    for (let length = 1; length <= 8; length++) {
      const next: number[][] = [];
      for (const m of frontier) for (const s of g.mirrors) {
        const child = composeHyperbolic(m, s);
        const address = mirrorAddress(g, applyHyperbolic(child, g.interior));
        if (seen.has(address.word)) continue;
        seen.add(address.word);
        assert.equal(address.word.length, length, `${p},${q}: a chamber first reached in ${length} steps has an address that long`);
        // The word rebuilds the element, and odd words reverse orientation.
        const rebuilt = addressMatrix(g, address.word);
        const back = applyHyperbolic(rebuilt, address.base);
        const there = applyHyperbolic(child, g.interior);
        back.forEach((x, i) => assert.ok(Math.abs(x - there[i]) < 1e-9 * Math.max(1, Math.abs(there[i])), "the word rebuilds the chamber"));
        assert.equal(Math.sign(hyperbolicDeterminant(rebuilt)), length % 2 ? -1 : 1);
        next.push(child);
      }
      counts.push(next.length);
      frontier = next;
    }
    assert.deepEqual(counts, expected.slice(0, 9), `{${p},${q}} chamber growth`);
  }
});

test("coincident copies are removed exactly: cells, vertices and edges are unique and have the counts the group predicts", () => {
  const t = hyperbolicTiling(options({ p: 5, q: 4, generations: 3 }));
  const min = 2 * t.inradius;
  const centres = t.tiles.map((c) => disk(c.position));
  for (let i = 0; i < centres.length; i++) for (let j = i + 1; j < centres.length; j++)
    assert.ok(hdist(centres[i], centres[j]) > min - 1e-7, "distinct cells are at least two inradii apart");
  const vertexPositions = t.vertices.map((v) => disk(v.position));
  for (let i = 0; i < vertexPositions.length; i++) for (let j = i + 1; j < vertexPositions.length; j++)
    assert.ok(hdist(vertexPositions[i], vertexPositions[j]) > t.edgeLength - 1e-7, "distinct vertices are at least an edge apart");
  const seed = { seed: 42 };
  const count = (radial: number, along: number) => hyperbolicFrames(t, { ...seed, radial, along });
  const frames = { centre: count(0, 0.4), vertex: count(1, 0), midpoint: count(1, 1), ray: count(0.6, 0), axis: count(0.6, 1), edge: count(1, 0.3), generic: count(0.6, 0.4) };
  assert.equal(frames.centre.length, t.tiles.length, "on the centre all 2p chambers give one point per cell");
  assert.equal(frames.vertex.length, t.vertices.length);
  assert.equal(frames.midpoint.length, t.edges.length);
  assert.equal(frames.ray.length, 5 * t.tiles.length, "on a mirror, chamber pairs coincide");
  assert.equal(frames.axis.length, 5 * t.tiles.length);
  assert.equal(frames.edge.length, 2 * t.edges.length, "on a cell edge the two cells' copies coincide");
  assert.equal(frames.generic.length, 10 * t.tiles.length);
  for (const [name, list] of Object.entries(frames)) {
    assert.equal(new Set(list.map((f) => f.id)).size, list.length, `${name} ids unique`);
    const at = list.map((f) => disk(f.position));
    let closest = Infinity;
    for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) closest = Math.min(closest, cabs(csub(at[i], at[j])));
    assert.ok(closest > 1e-6, `${name}: no two frames coincide (closest ${closest})`);
    if (name !== "generic" && name !== "edge") assert.ok(list.every((f) => !f.mirrored), `${name}: the orientation-preserving copy is kept`);
  }
  assert.equal(frames.generic.filter((f) => f.mirrored).length, 5 * t.tiles.length, "half of the chambers are reflections");
});

test("frames carry the true local frame: the reflection across an edge maps a frame to its partner's position, turn, mirror flag and scale", () => {
  const t = hyperbolicTiling(options({ p: 5, q: 4, generations: 3 }));
  const frames = hyperbolicFrames(t, { seed: 1, radial: 0.55, along: 0.4 });
  const vertexById = new Map(t.vertices.map((v) => [v.id, disk(v.position)]));
  const inner = t.tiles.filter((c) => c.generation <= 1);
  let checked = 0;
  for (const cell of inner) {
    const own = frames.filter((f) => f.cell === cell.id);
    assert.equal(own.length, 10);
    for (let k = 0; k < 5; k++) {
      if (!cell.neighbors[k]) continue;
      const { map, turn } = geodesicReflection(vertexById.get(cell.vertices[k])!, vertexById.get(cell.vertices[(k + 1) % 5])!);
      for (const f of own) {
        const z = disk(f.position);
        const w = map(z);
        const partner = frames.find((g) => cabs(csub(disk(g.position), w)) < 1e-8);
        assert.ok(partner, "a reflected frame exists in the neighbouring cell");
        assert.notEqual(partner!.mirrored, f.mirrored, "reflecting an edge flips handedness");
        near(Math.abs(partner!.scale), 1 - cabs(w) ** 2, 1e-9);
        near(Math.abs(f.scale), 1 - cabs(z) ** 2, 1e-9);
        // The local +x axis of the partner is the image of the local +x axis of f (both are images of one base axis).
        near(wrap(partner!.angle - turn(z, f.angle)), 0, 1e-7);
        checked++;
      }
    }
  }
  assert.ok(checked > 100);
  // Handedness is the parity of the chamber's mirror count.
  for (const f of frames) assert.equal(f.mirrored, f.distance % 2 === 1);
});

test("scale is the conformal factor: a motif of fixed hyperbolic size shrinks like 1 - |z|^2", () => {
  const t = hyperbolicTiling(options({ p: 7, q: 3, generations: 5 }));
  for (const c of t.tiles) near(c.scale, 1 - cabs(disk(c.position)) ** 2, 1e-9);
  // Along one ray of cells the Euclidean size of a cell follows the conformal factor: size / (1 - |z|^2) is constant to first order.
  const rays = t.tiles.filter((c) => Math.abs(Math.atan2(disk(c.position)[1], disk(c.position)[0]) - (-Math.PI / 2)) < 1e-9 && c.generation >= 1);
  assert.ok(rays.length >= 3);
  const ratios = rays.map((c) => c.size / (RADIUS * (1 - cabs(disk(c.position)) ** 2)));
  const spread = (Math.max(...ratios) - Math.min(...ratios)) / Math.min(...ratios);
  assert.ok(spread < 0.5, `cell size tracks the conformal factor (spread ${spread})`);
  const sizes = rays.sort((a, b) => a.generation - b.generation).map((c) => c.size);
  assert.ok(sizes.every((s, i) => i === 0 || s < sizes[i - 1]), "cells shrink outward");
});

test("cutoffs are declared and exact: crop, smallest cell, connected component, and work bound", () => {
  const permissive = hyperbolicTiling(options({ p: 5, q: 4, generations: 6 }));
  for (const [diskRadius, minSize] of [[0.9, 0.05], [0.9999, 6], [0.95, 3]] as const) {
    const t = hyperbolicTiling(options({ p: 5, q: 4, generations: 6, diskRadius, minSize }));
    const vertexById = new Map(t.vertices.map((v) => [v.id, disk(v.position)]));
    for (const cell of t.tiles) {
      const vs = cell.vertices.map((id) => vertexById.get(id)!);
      assert.ok(vs.every((v) => cabs(v) <= diskRadius + 1e-12), "every corner is inside the crop");
      const mean: C = [vs.reduce((s, v) => s + v[0], 0) / 5, vs.reduce((s, v) => s + v[1], 0) / 5];
      const size = 2 * RADIUS * Math.max(...vs.map((v) => cabs(csub(v, mean))));
      assert.ok(size >= minSize - 1e-9, "no kept cell is below the smallest size");
    }
    // Brute force: filter the permissive tiling by the same tests, then take the component of the central cell.
    const pv = new Map(permissive.vertices.map((v) => [v.id, disk(v.position)]));
    const passes = (cell: (typeof permissive.tiles)[number]) => {
      const vs = cell.vertices.map((id) => pv.get(id)!);
      const mean: C = [vs.reduce((s, v) => s + v[0], 0) / 5, vs.reduce((s, v) => s + v[1], 0) / 5];
      return vs.every((v) => cabs(v) <= diskRadius) && 2 * RADIUS * Math.max(...vs.map((v) => cabs(csub(v, mean)))) >= minSize;
    };
    const byId = new Map(permissive.tiles.map((c) => [c.id, c]));
    const component = new Set<string>();
    const root = permissive.tiles.find((c) => c.generation === 0)!;
    if (passes(root)) {
      const queue = [root.id];
      component.add(root.id);
      while (queue.length) for (const n of byId.get(queue.shift()!)!.neighbors) if (n && !component.has(n) && passes(byId.get(n)!)) { component.add(n); queue.push(n); }
    }
    assert.deepEqual(new Set(t.tiles.map((c) => c.id)), component, `crop ${diskRadius}, size ${minSize}`);
    assert.ok(t.candidates <= 5 * t.tiles.length + 5, "each kept cell tests at most p neighbours");
  }
  // Raising a cutoff only removes cells.
  const ids = (o: Partial<HyperbolicOptions>) => new Set(hyperbolicTiling(options({ generations: 8, ...o })).tiles.map((c) => c.id));
  const loose = ids({ minSize: 1 }), tight = ids({ minSize: 4 });
  assert.ok(tight.size < loose.size && [...tight].every((id) => loose.has(id)));
  // The pixel-scale stop bounds work near the boundary; an absurdly small stop is refused rather than truncated.
  const near1 = hyperbolicTiling(options({ p: 7, q: 3, generations: 40, diskRadius: 0.9999, minSize: 1 }));
  assert.ok(near1.tiles.length < MAX_HYPERBOLIC_TILES && near1.tiles.every((c) => c.size >= 1));
  assert.throws(() => hyperbolicTiling(options({ p: 3, q: 7, generations: 40, diskRadius: 0.9999, minSize: 0.05 })), (e: Error) =>
    /Smallest cell/.test(e.message) && /Disk radius/.test(e.message) && /Generations/.test(e.message));
  // An empty result is a valid state.
  const empty = hyperbolicTiling(options({ diskRadius: 0.05 }));
  assert.equal(empty.tiles.length, 0);
  assert.equal(empty.edges.length, 0);
});

test("near-boundary numerics: a large tiling is still a consistent disk", () => {
  for (const center of ["polygon", "vertex", "edge"] as const) {
    const t = hyperbolicTiling(options({ p: 7, q: 3, center, generations: 40, diskRadius: 0.9999, minSize: 0.5 }));
    assert.ok(t.tiles.length > 2000, `deep tiling (${t.tiles.length})`);
    assert.equal(t.vertices.length - t.edges.length + t.tiles.length, 1);
    const byId = new Map(t.tiles.map((c) => [c.id, c]));
    for (const cell of t.tiles) for (const n of cell.neighbors) if (n) assert.ok(byId.get(n)!.neighbors.includes(cell.id));
    assert.ok(t.vertices.every((v) => v.valence <= 3));
  }
});

test("ids depend on {p,q} alone: cutoffs, view, placement and seed never rename an element", () => {
  const base = hyperbolicTiling(options({ generations: 3, minSize: 3 }));
  const ids = (t: HyperbolicTiling): IdSets => ({ cells: new Set(t.tiles.map((c) => c.id)), vertices: new Set(t.vertices.map((v) => v.id)), edges: new Set(t.edges.map((e) => e.id)) });
  const inside = (small: IdSets, large: IdSets) => (["cells", "vertices", "edges"] as const).every((k) => [...small[k]].every((id) => large[k].has(id)));
  for (const larger of [{ generations: 5 }, { diskRadius: 0.9999, generations: 5, minSize: 1 }, { minSize: 1 }, { radius: 200, minSize: 2 }])
    assert.ok(inside(ids(base), ids(hyperbolicTiling(options({ generations: 3, minSize: 3, ...larger })))), JSON.stringify(larger));
  // Rotation, placement and seed do not rename anything either (same cutoffs, so the same set).
  const same = (o: Partial<HyperbolicOptions>) => assert.deepEqual(ids(hyperbolicTiling(options({ generations: 3, minSize: 3, ...o }))), ids(base), JSON.stringify(o));
  same({ rotation: 33 }); same({ centerX: 100, centerY: 500 }); same({ seed: 7 });
  const other = hyperbolicTiling(options({ generations: 3, minSize: 3, seed: 7 }));
  assert.deepEqual(other.tiles.map((c) => [c.id, c.position]), base.tiles.map((c) => [c.id, c.position]));
  assert.notEqual(other.tiles[3].seed, base.tiles[3].seed);
  // The central cell of a polygon-centred tiling is the base cell; a vertex-centred one contains the same base cell among its q.
  assert.ok(hyperbolicTiling(options({ center: "vertex", generations: 1 })).tiles.some((c) => c.id === "cell:"));
  const anyCentre = hyperbolicTiling(options({ generations: 0 }));
  assert.equal(anyCentre.tiles[0].id, "cell:");
});

test("results are frozen, cached by construction, and appearance never rebuilds them", () => {
  const t = hyperbolicTiling(options());
  assert.equal(hyperbolicTiling(options()), t, "same construction, same object");
  assert.throws(() => (t.tiles as unknown as unknown[]).push(1), TypeError);
  assert.throws(() => ((t.tiles[0].points as unknown as Point[])[0] as unknown as number[])[0] = 0, TypeError);
  assert.ok(Object.isFrozen(t.edges[0]) && Object.isFrozen(t.vertices[0]) && Object.isFrozen(t.tiles[0]));
  const a = hyperbolicGardensComposition(createInstrument(ID));
  const styled = createInstrument(ID);
  Object.assign(styled.params, { edgeWeight: 2.5, opacity: 0.4, cellFill: "hatch", hatchSpacing: 6, edgeMaterial: "beads", motifWeight: 2.2, taper: 0.2, colorBy: "sector", motifColor: "ink", limit: false });
  styled.palette = [0x101010, 0xaa0000, 0x00aa00, 0x0000aa];
  const b = hyperbolicGardensComposition(styled);
  const pa = hyperbolicProducts({ ...a, edges: { ...a.edges, material: "ink" }, cells: { ...a.cells, fill: "flat" } });
  const pb = hyperbolicProducts({ ...b, edges: { ...b.edges, material: "ink" }, cells: { ...b.cells, fill: "flat", opacity: 0.9, inset: a.cells.inset } });
  assert.equal(pa.tiling, pb.tiling);
  assert.equal(pa.shown, pb.shown);
  assert.equal(pa.edges, pb.edges);
  assert.equal(pa.cells, pb.cells);
  assert.equal(pa.frames, pb.frames);
  // Retention rebuilds only the retained view; the anchor rebuilds only the frames.
  const kept = hyperbolicProducts({ ...a, retention: 0.6 });
  assert.equal(kept.tiling, pa.tiling);
  assert.notEqual(kept.shown, pa.shown);
  const moved = hyperbolicProducts({ ...a, motifs: { ...a.motifs, radial: 0.3 } });
  assert.equal(moved.cells, hyperbolicProducts(a).cells);
  assert.notEqual(moved.frames, hyperbolicProducts(a).frames);
});

test("retention leaves a consistent smaller tiling with the same ids", () => {
  const t = hyperbolicTiling(options({ generations: 4 }));
  const dropped = retainCells(t, "test", (cell) => cell.generation !== 2 || cell.sector % 2 === 0);
  assert.ok(dropped.tiles.length < t.tiles.length);
  const ids = new Set(dropped.tiles.map((c) => c.id));
  assert.ok([...ids].every((id) => t.tiles.some((c) => c.id === id)));
  for (const e of dropped.edges) assert.ok(e.tiles[0] !== null && ids.has(e.tiles[0]) && (e.tiles[1] === null || ids.has(e.tiles[1])));
  for (const cell of dropped.tiles) cell.neighbors.forEach((n) => assert.ok(n === null || ids.has(n)));
  assert.equal(retainCells(t, "keep-none", () => false).tiles.length, 0);
  assert.equal(retainCells(t, "keep-all", () => true).tiles.length, t.tiles.length);
});

test("rings are hyperbolic circles: closed chains join across mirrors by exact endpoint identity", () => {
  const t = hyperbolicTiling(options({ p: 5, q: 4, generations: 3 }));
  const group = triangleGroup(5, 4);
  const cellRings = hyperbolicRings(t, { seed: 1, around: "cell", count: 3, radius: 0.8, round: 1 });
  assert.equal(cellRings.length, 3 * t.tiles.length);
  assert.ok(cellRings.every((r) => r.closed), "every cell ring closes inside its own cell");
  for (const ring of cellRings) {
    const cell = t.tiles.find((c) => c.id === ring.cell)!;
    const centre = disk(cell.position);
    const expected = 0.8 * group.inradius * ring.ring / 3;
    for (const p of ring.points) assert.ok(Math.abs(hdist(centre, disk(p)) - expected) < 2e-3 * Math.max(1, expected), `ring ${ring.ring} radius ${hdist(centre, disk(p))} vs ${expected}`);
  }
  // Around vertices and edge midpoints, closed rings are exactly those whose chambers are all kept.
  const vertexRings = hyperbolicRings(t, { seed: 1, around: "vertex", count: 2, radius: 0.9, round: 1 });
  assert.equal(vertexRings.filter((r) => r.closed).length, 2 * t.vertices.filter((v) => v.interior).length);
  const edgeRings = hyperbolicRings(t, { seed: 1, around: "edge", count: 2, radius: 0.9, round: 1 });
  assert.equal(edgeRings.filter((r) => r.closed).length, 2 * t.edges.filter((e) => e.tiles[1] !== null).length);
  // Roundness 0 gives geodesic chords: the midpoint of a chord is nearer the centre than the circle, by tanh(m) = tanh(rho) cos(pi/2p).
  const polygon = hyperbolicRings(t, { seed: 1, around: "cell", count: 1, radius: 0.8, round: 0 })[0];
  const centre = disk(t.tiles.find((c) => c.id === polygon.cell)!.position);
  const rho = 0.8 * group.inradius, mid = Math.atanh(Math.tanh(rho) * Math.cos(Math.PI / 10));
  const radii = polygon.points.map((p) => hdist(centre, disk(p)));
  assert.ok(radii.every((r) => r <= rho + 1e-6 && r >= mid - 1e-6), "every point is between the chord midpoint and the circle");
  near(Math.max(...radii), rho, 1e-6);
  assert.ok(Math.min(...radii) - mid < 5e-3, "the samples reach the chord midpoints");
  // Touching rings (radius 1) meet at points shared by four arcs; chains stop there instead of guessing.
  const touching = hyperbolicRings(t, { seed: 1, around: "cell", count: 1, radius: 1, round: 1 });
  assert.ok(touching.every((r) => !r.closed) && touching.length > t.tiles.length);
  assert.throws(() => hyperbolicRings(t, { seed: 1, around: "cell", count: 0, radius: 0.5, round: 1 }), /Rings/);
  assert.throws(() => hyperbolicRings(t, { seed: 1, around: "cell", count: 1, radius: 0, round: 1 }), /Ring radius/);
});

test("cell paths, edge paths and the inset are consistent with the tiling", () => {
  const t = hyperbolicTiling(options({ generations: 2 }));
  const edges = hyperbolicEdgePaths(t), cells = hyperbolicCellPaths(t);
  assert.equal(edges.length, t.edges.length);
  assert.equal(cells.length, t.tiles.length);
  assert.ok(cells.every((c, i) => c.closed && c.id === t.tiles[i].id && c.level === t.tiles[i].generation));
  assert.equal(hyperbolicCellPaths(t), cells, "cached");
  const inset = hyperbolicCellPaths(t, 0.3);
  // The inset polygon is the cell shrunk toward its centre by hyperbolic fraction 0.3 of the circumradius: a corner sits at 0.7 R.
  const first = t.tiles[0], corners = inset[0].points;
  const centre = disk(first.position);
  near(Math.max(...corners.map((p) => hdist(centre, disk(p)))), 0.7 * t.circumradius, 1e-3);
  assert.throws(() => hyperbolicCellPaths(t, 1), /Inset/);
});

test("hatching: an analytic square, and a concave polygon splits each line", () => {
  const square: Point[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const lines = hatchPolygon(square, 0, 2);
  assert.deepEqual(lines.map((l) => l[1]), [1, 3, 5, 7, 9]);
  lines.forEach((l) => { near(l[0], 0); near(l[2], 10); });
  const notch: Point[] = [[0, 0], [10, 0], [10, 10], [6, 10], [6, 4], [4, 4], [4, 10], [0, 10]];
  const across = hatchPolygon(notch, 0, 2).filter((l) => l[1] === 7 || l[1] === 9);
  assert.equal(across.length, 4, "lines above the notch floor give two pieces");
  const turned = hatchPolygon(square, 90, 2);
  assert.equal(turned.length, 5);
  turned.forEach((l) => near(Math.abs(l[3] - l[1]), 10));
  assert.throws(() => hatchPolygon(square, 0, 0.001), /Hatch spacing/);
});

/** A recording surface for drawing tests. */
function recorder() {
  const calls: { name: string; args: unknown[] }[] = [];
  const surface = new Proxy({ CLOSE: "close", ROUND: "round" }, {
    get(target, key) {
      if (key in target) return (target as Record<string | symbol, unknown>)[key];
      return (...args: unknown[]) => { calls.push({ name: String(key), args }); };
    },
  }) as unknown as CompositionSurface;
  return { surface, calls };
}

test("drawing: mirrored frames reflect the mark, the layer is transparent, and consumers can be replaced", () => {
  const input = createInstrument(ID);
  Object.assign(input.params, { retention: 1, motifVariation: 0, cellFill: "none", edgeMaterial: "none", limit: false, generations: 3, minSize: 3, minMark: 0 });
  const recipe = hyperbolicGardensComposition(input);
  const products = hyperbolicProducts(recipe);
  const { surface, calls } = recorder();
  drawInstrument(surface as never, input);
  const scales = calls.filter((c) => c.name === "scale");
  const flips = scales.filter((c) => (c.args[1] as number) < 0);
  assert.equal(scales.length, products.frames.length);
  assert.equal(flips.length, products.frames.filter((f) => f.mirrored).length);
  scales.forEach((c, i) => near(Math.abs(c.args[0] as number), Math.abs(products.frames[i].scale)));
  assert.ok(!calls.some((c) => c.name === "background" || c.name === "rect" || c.name === "clear"), "transparent layer");
  // A caller's own mark receives the cached, toned frames.
  const seen: string[] = [];
  const custom = recorder();
  drawHyperbolicGardens(custom.surface, recipe, { mark: (_s, site) => { seen.push(site.id); } });
  assert.deepEqual(seen, products.frames.map((f) => f.id));
  // Retention zero leaves only the boundary circle; the limit toggle draws exactly one closed shape.
  const none = createInstrument(ID);
  Object.assign(none.params, { retention: 0, limit: true });
  const empty = recorder();
  drawInstrument(empty.surface as never, none);
  assert.equal(empty.calls.filter((c) => c.name === "endShape").length, 1);
});

test("weight taper thins lines toward the boundary and leaves them constant at zero", () => {
  const weights = (taper: number) => {
    const input = createInstrument(ID);
    Object.assign(input.params, { cellFill: "none", motif: "none", limit: false, edgeMaterial: "ink", edgeWeight: 2, taper, generations: 5, minSize: 2, retention: 1 });
    const { surface, calls } = recorder();
    drawInstrument(surface as never, input);
    return calls.filter((c) => c.name === "strokeWeight").map((c) => c.args[0] as number);
  };
  const flat = weights(0), tapered = weights(1);
  assert.ok(flat.length > 50 && flat.every((w) => w === 2));
  assert.ok(Math.max(...tapered) <= 2 + 1e-9 && Math.min(...tapered) < 0.3 * 2, "outer edges are far thinner than inner ones");
});

test("tones follow the structure they are named for", () => {
  const e = { generation: 5, distance: 7, sector: 3 };
  assert.equal(hyperbolicTone("ink", 5, e), 0);
  assert.equal(hyperbolicTone("single", 5, e), 1);
  assert.equal(hyperbolicTone("generation", 5, e), 1 + 5 % 4);
  assert.equal(hyperbolicTone("distance", 5, e), 1 + 7 % 4);
  assert.equal(hyperbolicTone("sector", 5, e), 1 + 3 % 4);
  assert.equal(hyperbolicTone("parity", 5, e), 1 + 5 % 2, "cells: generation parity");
  assert.equal(hyperbolicTone("parity", 5, { ...e, mirrored: true }), 2);
  assert.equal(hyperbolicTone("parity", 5, { ...e, mirrored: false }), 1);
  assert.equal(hyperbolicTone("generation", 1, e), 0, "a one-colour palette is all ink");
});

test("the instrument: controls, groups, seed use and declared visibility", () => {
  const input = createInstrument(ID);
  assert.equal(definition(ID).title, "Hyperbolic Gardens");
  assert.deepEqual(validateInstrument(input).params, input.params);
  const values = { ...input.params };
  const shown = (v: Record<string, number | string | boolean>) => new Set(visibleParameters(ID, v).map((p) => p.key));
  assert.ok(shown({ ...values, cellFill: "none" }).has("cellFill") && !shown({ ...values, cellFill: "none" }).has("inset"));
  assert.ok(!shown({ ...values, cellFill: "flat" }).has("hatchSpacing") && shown({ ...values, cellFill: "flat-hatch" }).has("hatchSpacing"));
  assert.ok(!shown({ ...values, motif: "none" }).has("anchorRadial") && shown({ ...values, motif: "sprig" }).has("twigs") && !shown({ ...values, motif: "arrow" }).has("twigs"));
  assert.ok(!shown({ ...values, motif: "dot" }).has("motifWeight") && !shown({ ...values, motif: "rings" }).has("motifTurn"));
  assert.ok(!shown({ ...values, edgeMaterial: "none" }).has("edgeColor") && shown({ ...values, edgeMaterial: "beads" }).has("beadSize"));
  const groups = inspectorItems(ID, values).map((g) => ("label" in g ? g.label : ""));
  assert.deepEqual(groups.slice(0, 3), ["Tiling", "Placement", "Cells"]);
  // The seed matters only where chance enters.
  const seeded = (over: Record<string, number | string | boolean>): boolean =>
    usesSeed({ ...input, params: { ...values, ...over } });
  assert.equal(seeded({ retention: 1, motifVariation: 0 }), false);
  assert.equal(seeded({ retention: 0.5, motif: "none" }), true);
  assert.equal(seeded({ retention: 1, motif: "arrow", motifVariation: 0.3 }), true);
  assert.equal(seeded({ retention: 1, motif: "none", motifVariation: 0.3 }), false);
  // An over-large motif is refused with the control named.
  const big = createInstrument(ID);
  Object.assign(big.params, { p: 12, q: 12, motif: "dot", motifFit: 3 });
  assert.throws(() => drawInstrument(recorder().surface as never, big), /Motif size/);
});

test("every slider end, and all ends together, validate and draw", () => {
  const numeric = definition(ID).parameters.filter((parameter) => parameter.type === "number");
  const pick = (which: "min" | "max") => Object.fromEntries(numeric.map((parameter) => [parameter.key, which === "min" ? parameter.min! : parameter.max!]));
  const trial = (label: string, params: Record<string, number>, motifs: readonly string[] = ["sprig"]) => {
    for (const motif of motifs) {
      const input = createInstrument(ID);
      Object.assign(input.params, { motif, edgeMaterial: "beads", cellFill: "flat-hatch", ringsAround: "vertex", limit: true }, params);
      assert.doesNotThrow(() => validateInstrument(input), `${label} validates`);
      assert.doesNotThrow(() => drawInstrument(recorder().surface as never, input), `${label} draws (${motif})`);
    }
  };
  for (const parameter of numeric) {
    trial(`${parameter.key} at min`, { [parameter.key]: parameter.min! });
    trial(`${parameter.key} at max`, { [parameter.key]: parameter.max! });
  }
  const allMotifs = ["arrow", "sprig", "dot", "rings", "rosette"];
  trial("all at min", pick("min"), allMotifs);
  trial("all at max", pick("max"), allMotifs);
  for (const center of ["vertex", "edge"]) for (const which of ["min", "max"] as const) {
    const input = createInstrument(ID);
    Object.assign(input.params, { center, motif: "sprig" }, pick(which));
    assert.doesNotThrow(() => validateInstrument(input), `${center} ${which}`);
    assert.doesNotThrow(() => drawInstrument(recorder().surface as never, input), `${center} ${which} draws`);
  }
});
