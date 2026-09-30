import assert from "node:assert/strict";
import test from "node:test";
import {
  STRAND_LIMITS, meshBoundaryDistance as boundaryDistance, meshBarycentric, meshWalker, walkMesh, estimateStrandVertices, flowVectors, icosphereMesh, mergeMeshes, meshData, orderCrossings, scalarField, spacingField, surfaceCrossingSet,
  surfaceCrossings, surfaceWeaveStrands, terrainMesh, traceGraph, traceStrands, transformMesh, waveTerms,
  type FlowSpec, type Mesh, type ScalarSpec, type SurfaceStrand, type SurfaceWeaveStructure,
} from "../dist/index.js";

const near = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const plane = (columns = 20): Mesh => terrainMesh({ width: 4, depth: 4, columns, rows: columns, height: () => 0 });
const scalar = (kind: ScalarSpec["kind"], angle = 0, frequency = 2, seed = 1): ScalarSpec => ({ kind, angle, frequency, seed });
const flow = (over: Partial<FlowSpec> = {}): FlowSpec => ({ source: "isolines", scalar: scalar("plane", 90), yaw: 0, pitch: 0, angle: 0, swirl: 0, swirlScalar: scalar("height"), ...over });
const uniform = (m: Mesh, spacing: number) => spacingField(m, spacing, { scalar: null, ratio: 1, reverse: false });
const family = (m: Mesh, f: FlowSpec, cross: number, index: 0 | 1, spacing: number, extra: { margin?: number; fringe?: boolean; seed?: number } = {}) =>
  traceStrands(m, { vectors: flowVectors(m, f, cross), spacing: uniform(m, spacing), family: index, seed: extra.seed ?? 3, margin: extra.margin ?? 0, fringe: extra.fringe ?? false, budget: STRAND_LIMITS.vertices });

/* ------------------------------------------------------------------ fields */

test("a plane scalar is affine in x, normalised to [0, 1]; the isoline direction on a flat sheet is exactly n x grad", () => {
  const m = plane(8), g = traceGraph(m), values = scalarField(m, scalar("plane", 0));
  for (let v = 0; v < m.vertexCount; v++) near(values[v], (g.positions[v * 3] + 2) / 4, 1e-12);
  // The terrain faces +y, so isolines of x = const run along -z: (n x grad) = (0,1,0) x (1,0,0) = (0,0,-1).
  const along = flowVectors(m, flow({ scalar: scalar("plane", 0) }), 0);
  for (let v = 0; v < m.vertexCount; v++) { near(along[v * 3], 0, 1e-12); near(along[v * 3 + 1], 0, 1e-12); near(along[v * 3 + 2], -1, 1e-12); }
  // Turned 90 degrees toward n x primary, the direction runs along -x.
  const across = flowVectors(m, flow({ scalar: scalar("plane", 0), angle: 90 }), 0), viaCross = flowVectors(m, flow({ scalar: scalar("plane", 0) }), 90);
  for (let v = 0; v < m.vertexCount; v++) { near(across[v * 3], -1, 1e-12); near(across[v * 3 + 2], 0, 1e-12); near(viaCross[v * 3], across[v * 3], 1e-12); }
});

test("swirl turns the direction by swirl x (2h - 1) degrees where h is the swirl scalar", () => {
  const m = plane(8), g = traceGraph(m), vectors = flowVectors(m, flow({ scalar: scalar("plane", 0), swirl: 30, swirlScalar: scalar("plane", 0) }), 0);
  for (let v = 0; v < m.vertexCount; v++) {
    const h = (g.positions[v * 3] + 2) / 4, turn = 30 * (2 * h - 1) * Math.PI / 180;
    near(vectors[v * 3], -Math.sin(turn), 1e-12); near(vectors[v * 3 + 2], -Math.cos(turn), 1e-12);
  }
});

test("a guide is the world direction projected on the surface, and vanishes where the surface is normal to it", () => {
  const m = plane(6);
  const east = flowVectors(m, flow({ source: "guide", yaw: 90, pitch: 0 }), 0), south = flowVectors(m, flow({ source: "guide", yaw: 0, pitch: 0 }), 0);
  for (let v = 0; v < m.vertexCount; v++) { near(east[v * 3], 1, 1e-12); near(south[v * 3 + 2], 1, 1e-12); }
  assert.ok(flowVectors(m, flow({ source: "guide", yaw: 0, pitch: 90 }), 0).every((c) => c === 0), "straight up the normal has no tangent part");
});

test("spacing runs from base / sqrt(ratio) at the dense end to base x sqrt(ratio) at the sparse end and reverses exactly", () => {
  const m = plane(10), g = traceGraph(m), h = scalarField(m, scalar("plane", 0));
  const dense = spacingField(m, 0.3, { scalar: scalar("plane", 0), ratio: 4, reverse: false }), flipped = spacingField(m, 0.3, { scalar: scalar("plane", 0), ratio: 4, reverse: true });
  for (let v = 0; v < m.vertexCount; v++) {
    near(dense[v], 0.3 * Math.pow(4, 0.5 - h[v]), 1e-12);
    near(flipped[v], 0.3 * Math.pow(4, h[v] - 0.5), 1e-12);
    if (g.positions[v * 3] === 2) near(dense[v], 0.15, 1e-12);
    if (g.positions[v * 3] === -2) near(dense[v], 0.6, 1e-12);
  }
  assert.ok(uniform(m, 0.3).every((s) => s === 0.3));
  assert.throws(() => spacingField(m, 0.3, { scalar: null, ratio: 0.5, reverse: false }), /ratio/);
});

test("seeded waves depend on the seed only, span [0, 1] and are smooth sums of three sinusoids", () => {
  const m = icosphereMesh(3), a = scalarField(m, scalar("waves", 0, 2, 1)), b = scalarField(m, scalar("waves", 0, 2, 2)), again = scalarField(m, scalar("waves", 0, 2, 1));
  assert.deepEqual(a, again);
  assert.notDeepEqual(a, b);
  near(Math.min(...a), 0, 1e-12); near(Math.max(...a), 1, 1e-12);
  const terms = waveTerms(scalar("waves", 0, 2, 1), Math.hypot(2, 2, 2));
  assert.equal(terms.length, 3);
  for (const [kx, ky, kz] of terms) { const k = Math.hypot(kx, ky, kz); assert.ok(k > 2 * Math.PI * 2 * 0.75 / Math.hypot(2, 2, 2) - 1e-9 && k < 2 * Math.PI * 2 * 1.25 / Math.hypot(2, 2, 2) + 1e-9); }
});

/* ----------------------------------------------------------------- strands */

test("on a plane the families are straight, parallel, chained exactly one spacing apart and end on the boundary", () => {
  const m = plane(20), spacing = 0.2, A = family(m, flow(), 0, 0, spacing), B = family(m, flow(), 90, 1, spacing);
  for (const [strands, along, across] of [[A, 0, 2], [B, 2, 0]] as const) {
    for (const s of strands) {
      assert.equal(s.closed, false);
      assert.deepEqual(s.ends, ["boundary", "boundary"]);
      near(s.length, 4, 1e-9);
      for (const p of s.points) { near(p[1], 0, 1e-12); near(p[across], s.points[0][across], 1e-9); }
      const ends = [s.points[0][along], s.points[s.points.length - 1][along]].map(Math.abs);
      near(ends[0], 2, 1e-9); near(ends[1], 2, 1e-9);
    }
    const lines = strands.map((s) => s.points[0][across]).sort((a, b) => a - b);
    for (let i = 1; i < lines.length; i++) near(lines[i] - lines[i - 1], spacing, 1e-9);
    assert.ok(lines.length >= 19 && lines.length <= 21, `${lines.length} lines for 4 / 0.2`);
    assert.ok(lines[0] < -2 + spacing + 1e-9 && lines[lines.length - 1] > 2 - spacing - 1e-9, "the whole sheet is covered");
  }
  // Crossings: every A meets every B exactly once, at (x of B, z of A), at a right angle.
  const strands = [...A, ...B], crossings = surfaceCrossings(m, strands);
  assert.equal(crossings.length, A.length * B.length);
  for (const c of crossings) {
    near(c.sine, 1, 1e-9);
    const a = strands[c.first.strand], b = strands[c.second.strand];
    near(c.position[0], b.points[0][0], 1e-9); near(c.position[2], a.points[0][2], 1e-9);
    assert.ok(a.family === 0 && b.family === 1);
  }
  assert.equal(new Set(crossings.map((c) => c.id)).size, crossings.length, "ids are unique");
});

test("a square weave on a plane alternates perfectly: no breaks, a checkerboard in the strand ranks", () => {
  const m = plane(20), A = family(m, flow(), 0, 0, 0.2), B = family(m, flow(), 90, 1, 0.2), strands = [...A, ...B];
  const crossings = surfaceCrossings(m, strands), set = surfaceCrossingSet(strands, crossings), order = orderCrossings(set, { rule: "alternate", seed: 5 });
  assert.equal(order.breaks.length, 0);
  assert.equal(order.feasible, true);
  const rank = (index: number, axis: number) => strands.filter((s) => s.family === strands[index].family).map((s) => s.points[0][axis]).sort((x, y) => x - y).indexOf(strands[index].points[0][axis]);
  const parities = new Set<number>();
  for (const c of crossings) {
    const a = strands[c.first.strand].family === 0 ? c.first : c.second, b = strands[c.first.strand].family === 0 ? c.second : c.first;
    const aOver = (order.over[c.index] === 0) === (strands[c.first.strand].family === 0);
    parities.add((rank(a.strand, 2) + rank(b.strand, 0) + (aOver ? 1 : 0)) % 2);
  }
  assert.equal(parities.size, 1, "over/under is (i + j) parity of the two strand ranks, up to one global flip");
});

test("a set of parallel closed strands is deterministic, seed dependent and never starts a strand nearer than the spacing", () => {
  const m = icosphereMesh(4), f = flow({ scalar: scalar("height") });
  const a = family(m, f, 0, 0, 0.16, { seed: 4 }), b = family(m, f, 0, 0, 0.16, { seed: 4 }), c = family(m, f, 0, 0, 0.16, { seed: 5 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.map((s) => s.points[0]), c.map((s) => s.points[0]));
  assert.ok(a.length >= 17 && a.length <= 24, `${a.length} rings for pi / 0.16 = 19.6`);
  for (const s of a) {
    assert.equal(s.closed, true);
    assert.deepEqual(s.ends, ["closed", "closed"]);
    const ys = s.points.map((p) => p[1]);
    assert.ok(Math.max(...ys) - Math.min(...ys) < 0.012, `ring drifts by ${Math.max(...ys) - Math.min(...ys)} in height`);
  }
});

test("thread density is measured on the surface: meridian counts follow the circumference 2 pi cos(latitude) / spacing", () => {
  const m = icosphereMesh(5), spacing = 0.1, f = flow({ scalar: scalar("height") });
  const rings = family(m, f, 0, 0, spacing), meridians = family(m, f, 90, 1, spacing), strands = [...rings, ...meridians], crossings = surfaceCrossings(m, strands);
  const perRing = new Map<number, number>();
  for (const c of crossings) { const ring = strands[c.first.strand].family === 0 ? c.first.strand : c.second.strand; perRing.set(ring, (perRing.get(ring) ?? 0) + 1); }
  const rows = [...perRing].map(([index, count]) => {
    const ys = strands[index].points.map((p) => p[1]), latitude = Math.asin(ys.reduce((a, b) => a + b, 0) / ys.length);
    return { latitude, count, expected: 2 * Math.PI * Math.cos(latitude) / spacing };
  });
  const at = (degrees: number) => rows.reduce((best, row) => Math.abs(row.latitude - degrees * Math.PI / 180) < Math.abs(best.latitude - degrees * Math.PI / 180) ? row : best);
  for (const degrees of [0, 30, 55, 70]) {
    const row = at(degrees);
    assert.ok(row.count > 0.78 * row.expected && row.count < 1.45 * row.expected, `latitude ${degrees}: ${row.count} meridians against ${row.expected.toFixed(1)}`);
  }
  assert.ok(at(0).count > 1.25 * at(60).count && at(0).count > 2.5 * at(80).count, "a uv-uniform layout would put the same number at every latitude");
  // Adjacent rings are one spacing apart on the surface (great-circle distance between latitudes): usually exactly, never outside the stated 0.5 to 1.3 band.
  const heights = rings.map((s) => Math.asin(s.points.reduce((a, p) => a + p[1], 0) / s.points.length)).sort((a, b) => a - b), gaps = heights.slice(1).map((h, i) => h - heights[i]);
  for (const gap of gaps) assert.ok(gap > 0.5 * spacing - 1e-3 && gap < 1.3 * spacing, `ring gap ${gap}`);
  const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  assert.ok(Math.abs(median - spacing) < 0.03 * spacing, `median ring gap ${median}`);
});

test("edge treatment: an inset keeps every vertex the margin from the boundary; a fringe ends strands at scattered distances", () => {
  const m = plane(20), spacing = 0.2, margin = 0.3, step = 0.35 * spacing;
  const inset = family(m, flow(), 0, 0, spacing, { margin }), edge = (s: SurfaceStrand) => [s.points[0], s.points[s.points.length - 1]].map((p) => 2 - Math.abs(p[0]));
  for (const s of inset) {
    for (const p of s.points) assert.ok(2 - Math.max(Math.abs(p[0]), Math.abs(p[2])) >= margin - 1e-9, "no vertex inside the margin");
    for (const e of edge(s)) assert.ok(e >= margin - 1e-9 && e < margin + step + 1e-9, `strand end ${e} from the edge`);
    assert.deepEqual(s.ends, ["margin", "margin"]);
  }
  // Strands within twice the margin of the transverse edge may be stopped at once by their own fringe; judge the others.
  const fringe = family(m, flow(), 0, 0, spacing, { margin, fringe: true }).filter((s) => 2 - Math.abs(s.points[0][2]) > 2 * margin + step), distances = fringe.flatMap(edge);
  assert.ok(new Set(distances.map((d) => d.toFixed(2))).size >= 8, "fringe ends are scattered");
  assert.ok(distances.every((d) => d >= -1e-9 && d <= 2 * margin + step + 1e-9), "and within zero to twice the margin");
  assert.ok(Math.max(...distances) > 1.3 * margin && Math.min(...distances) < 0.5 * margin);
});

test("a strand is not stopped by another sheet of the surface that merely lies close by (normals disagree)", () => {
  const top = plane(20), bottom = transformMesh(plane(20), { rotate: [180, 0, 0], translate: [0, 0.05, 0] }, "under");
  const both = mergeMeshes("pair", [top, bottom]);
  assert.equal(meshData(both).triangles.length, 2 * meshData(top).triangles.length);
  const single = family(top, flow(), 0, 0, 0.2), pair = family(both, flow(), 0, 0, 0.2);
  assert.ok(pair.length >= 2 * single.length - 1, `${pair.length} strands on two sheets against ${single.length} on one`);
});

test("critical points do not trap a curve: the hills terrain builds quickly for many seeds without spirals", () => {
  const base = {
    surface: { kind: "terrain", variant: "hills", detail: 4, relief: 1 }, flow: { field: "height", bandAngle: 30, frequency: 1.6, yaw: 0, pitch: 60 }, angle: 0, cross: 90,
    swirl: { amount: 0, field: "height" }, threads: { spacing: 0.05, spacingB: 1, density: { field: "none", ratio: 2, reverse: false } }, edge: { mode: "flush", margin: 1 },
  } as SurfaceWeaveStructure;
  const started = performance.now();
  for (let seed = 1; seed <= 6; seed++) {
    const built = surfaceWeaveStrands(base, seed);
    assert.ok(built.strands.every((s) => !s.ends.includes("limit" as never)), `seed ${seed}: a strand ran to the step limit`);
    assert.ok(built.stats.vertices < 25_000, `seed ${seed}: ${built.stats.vertices} vertices`);
    assert.ok(built.strands.every((s) => s.length < 40), "no strand is a runaway");
  }
  assert.ok(performance.now() - started < 6000, "six seeds in well under a second each");
});

test("crossings agree with an independent brute-force search of every segment pair on a sphere", () => {
  const m = icosphereMesh(3), f = flow({ scalar: scalar("height"), angle: 20 });
  const strands = [...family(m, f, 0, 0, 0.3), ...family(m, f, 70, 1, 0.3)], crossings = surfaceCrossings(m, strands);
  // closest approach of two 3D segments, sampled analytically
  const segments = strands.flatMap((s, si) => s.points.slice(0, s.closed ? undefined : -1).map((p, k) => ({ si, k, a: p, b: s.points[(k + 1) % s.points.length] })));
  const found: [number, number, number][] = [];
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const s = segments[i], t = segments[j];
    if (s.si === t.si) continue;
    const u = [s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]], v = [t.b[0] - t.a[0], t.b[1] - t.a[1], t.b[2] - t.a[2]], w = [s.a[0] - t.a[0], s.a[1] - t.a[1], s.a[2] - t.a[2]];
    const dot = (p: number[], q: number[]) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
    const a = dot(u, u), b = dot(u, v), c = dot(v, v), d = dot(u, w), e = dot(v, w), denom = a * c - b * b;
    if (denom < 1e-18) continue;
    const sc = (b * e - c * d) / denom, tc = (a * e - b * d) / denom;
    if (sc < -1e-9 || sc > 1 + 1e-9 || tc < -1e-9 || tc > 1 + 1e-9) continue;
    const gap = Math.hypot(w[0] + u[0] * sc - v[0] * tc, w[1] + u[1] * sc - v[1] * tc, w[2] + u[2] * sc - v[2] * tc);
    if (gap < 1e-9) found.push([s.a[0] + u[0] * sc, s.a[1] + u[1] * sc, s.a[2] + u[2] * sc]);
  }
  // one crossing may be met by several adjoining segment pairs (at a vertex or on an edge): merge by position
  const merged: [number, number, number][] = [];
  for (const p of found) if (!merged.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-6)) merged.push(p);
  assert.equal(crossings.length, merged.length);
  for (const c of crossings) assert.ok(merged.some((q) => Math.hypot(c.position[0] - q[0], c.position[1] - q[1], c.position[2] - q[2]) < 1e-6), `crossing ${c.id} not found by brute force`);
});

test("work is bounded before anything is traced, and the error names the controls", () => {
  const m = plane(20);
  assert.ok(estimateStrandVertices(m, [uniform(m, 0.2)]) < 2000);
  assert.ok(estimateStrandVertices(m, [uniform(m, 0.002)]) > STRAND_LIMITS.vertices);
  const structure = {
    surface: { kind: "terrain", variant: "hills", detail: 2, relief: 1 }, flow: { field: "height", bandAngle: 0, frequency: 1, yaw: 0, pitch: 0 }, angle: 0, cross: 90,
    swirl: { amount: 0, field: "height" }, threads: { spacing: 0.005, spacingB: 0.5, density: { field: "none", ratio: 1, reverse: false } }, edge: { mode: "flush", margin: 0 },
  } as SurfaceWeaveStructure;
  const started = performance.now();
  assert.throws(() => surfaceWeaveStrands(structure, 1), /Thread spacing/);
  assert.ok(performance.now() - started < 1000, "refused from the fields alone");
  assert.throws(() => surfaceWeaveStrands({ ...structure, cross: 178 }, 1), /Weave angle/);
  assert.ok(boundaryDistance(traceGraph(plane(4))).length === 25);
});

test("the alternation solves agree where alternation is possible, and `fewest` keeps the better one on a frustrated lattice", () => {
  const m = plane(20), A = family(m, flow(), 0, 0, 0.2), B = family(m, flow(), 90, 1, 0.2), strands = [...A, ...B];
  const set = surfaceCrossingSet(strands, surfaceCrossings(m, strands));
  const chains = orderCrossings(set, { rule: "alternate", seed: 5 }), breadth = orderCrossings(set, { rule: "alternate", seed: 5, solve: "breadth" });
  assert.equal(breadth.breaks.length, 0);
  assert.equal(chains.breaks.length, 0);
  assert.deepEqual(breadth.over, chains.over, "a perfect square weave has exactly two solutions and the same coin picks one");
  assert.throws(() => orderCrossings(set, { rule: "alternate", seed: 5, solve: "sideways" as never }), /Unknown crossing solve/);
  // A ring crossed an odd number of times cannot alternate: one contradiction is unavoidable, whichever way it is solved.
  const sphere = icosphereMesh(3), f = flow({ scalar: scalar("height") }), lattice = [...family(sphere, f, 0, 0, 0.3), ...family(sphere, f, 90, 1, 0.3)];
  const frustrated = surfaceCrossingSet(lattice, surfaceCrossings(sphere, lattice));
  const g = orderCrossings(frustrated, { rule: "alternate", seed: 5 }), r = orderCrossings(frustrated, { rule: "alternate", seed: 5, solve: "breadth" });
  const b = orderCrossings(frustrated, { rule: "alternate", seed: 5, solve: "fewest" });
  assert.equal(b.breaks.length, Math.min(g.breaks.length, r.breaks.length), "fewest keeps the better of the two solves");
  assert.ok(g.breaks.length > 0 && r.breaks.length > 0, "a lattice of rings and meridians on a sphere cannot alternate everywhere");
  assert.equal(b.unavoidable.length, b.breaks.length, "under the alternate rule every break is unavoidable");
  // every pair of neighbours along a strand that is not listed as a break alternates: recount independently
  let equal = 0;
  b.occurrences.forEach((list) => { for (let k = 1; k < list.length; k++) if ((b.over[list[k].crossing] === list[k].side) === (b.over[list[k - 1].crossing] === list[k - 1].side)) equal++; });
  assert.equal(equal, b.breaks.length);
});

test("a crossing exactly on a triangle edge is met in both triangles and reported once", () => {
  const m = plane(20), g = traceGraph(m), lambda = new Float64Array(3);
  // A straight strand along an axis, built from the walk's own edge events so every segment lies in one known triangle.
  const strand = (id: string, family: 0 | 1, from: [number, number], along: 0 | 2): SurfaceStrand => {
    const w = meshWalker(0), p = [from[0], 0, from[1]], d = along === 0 ? [1, 0, 0] : [0, 0, 1];
    for (let t = 0; t < m.triangleCount; t++) { meshBarycentric(g, t, p, lambda); if (Math.min(...lambda) >= -1e-12) { w.tri = t; break; } }
    w.p.set(p); w.d.set(d);
    const events: number[] = [], length = 3.6;
    assert.equal(walkMesh(g, w, length, events), "length");
    const points = [p as [number, number, number]], triangles: number[] = [];
    for (let e = 0; e < events.length; e += 4) { points.push([events[e], events[e + 1], events[e + 2]]); triangles.push(events[e + 3]); }
    points.push([w.p[0], w.p[1], w.p[2]]); triangles.push(w.tri);
    const cumulative = points.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]));
    return { id, family, seed: 0, points, triangles, closed: false, cumulative, length, spacing: 0.4, ends: ["boundary", "boundary"] };
  };
  // Crossings at (x0 + 0.05, z0 + 0.05) inside cells of 0.2: on the diagonal a-c of each quad, which is an edge shared by two triangles.
  const strands = [5, 7, 9, 11, 13].map((j, k) => strand(`A${k}`, 0, [-1.8, -2 + 0.2 * j + 0.05], 0)).concat([4, 6, 8, 10, 12].map((i, k) => strand(`B${k}`, 1, [-2 + 0.2 * i + 0.05, -1.8], 2)));
  const crossings = surfaceCrossings(m, strands);
  assert.equal(crossings.length, 25, "5 x 5 crossings, each once");
  for (const c of crossings) { near(c.position[0] + 2 - 0.05, Math.round((c.position[0] + 2 - 0.05) / 0.2) * 0.2, 1e-9); near(c.sine, 1, 1e-9); }
});
