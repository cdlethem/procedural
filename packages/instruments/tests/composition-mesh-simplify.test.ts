import assert from "node:assert/strict";
import test from "node:test";
import {
  abstractionAt, bundledMesh, checkRegion, checkSimulation, finalState, identical, mesh, meshData, meshMeasures, meshTopology, regionImportance, runSimulation, simplifyMesh,
  simplifySimulation, simplifyRetention, terrainMesh, MIN_NORMAL_DOT, SIMPLIFY_LIMITS,
  type Abstraction, type Mesh, type MeshRegion, type SimplifyOptions, type SimplifyParams,
} from "../dist/index.js";

const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: readonly number[]) => Math.hypot(a[0], a[1], a[2]);

/** Positions and triangles of a (triangle) mesh, read independently through the public accessor. */
function tris(m: Mesh) {
  const d = meshData(m), p = d.positions, t = d.triangles;
  const at = (v: number): V3 => [p[v * 3], p[v * 3 + 1], p[v * 3 + 2]];
  const out: { ids: [number, number, number]; a: V3; b: V3; c: V3; normal: V3; area: number; centroid: V3 }[] = [];
  for (let i = 0; i < t.length; i += 3) {
    const a = at(t[i]), b = at(t[i + 1]), c = at(t[i + 2]), n = cross(sub(b, a), sub(c, a)), l = len(n);
    out.push({ ids: [t[i], t[i + 1], t[i + 2]], a, b, c, normal: [n[0] / l, n[1] / l, n[2] / l], area: l / 2, centroid: [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3] });
  }
  return { positions: p, triangles: out };
}
const attribute = (m: Mesh, name: string): number[] => Array.from(meshData(m).attributes.find((a) => a.name === name)!.values);
const sphereRegion: MeshRegion = { kind: "sphere", center: [0.5, 0.85, 0.5], radius: 0.25, falloff: 0.2 };

test("Euler characteristic, manifoldness and exact face counts survive collapses at every prefix (closed and open sources)", () => {
  const cases: [string, Mesh, "closed-manifold" | "open-manifold", number][] = [
    ["icosphere", bundledMesh("icosphere", { detail: 3 }), "closed-manifold", 2],
    ["torus", bundledMesh("torus", { detail: 2 }), "closed-manifold", 0],
    ["terrain", bundledMesh("terrain", { detail: 3, seed: 5, variant: "ridges" }), "open-manifold", 1],
    ["vase", bundledMesh("vase", { detail: 3, variant: "goblet" }), "open-manifold", 1],
    ["figure", bundledMesh("figure"), "closed-manifold", 14],
  ];
  for (const [name, source, kind, euler] of cases) {
    const F0 = source.triangleCount;
    for (const k of [0, 1, 2, 5, 17, 60, 140]) {
      const a = simplifyMesh(source, { collapses: k, region: sphereRegion, creaseAngle: 30 });
      const topology = meshTopology(a.mesh);
      assert.equal(topology.kind, kind, `${name} k=${k}`);
      assert.equal(topology.counts.euler, euler, `${name} k=${k} Euler`);
      assert.equal(a.mesh.triangleCount, a.faces);
      if (a.collapses < k) assert.notEqual(a.stop, "target", `${name}: fewer collapses than asked must say why`);
      if (kind === "closed-manifold") assert.equal(a.faces, F0 - 2 * a.collapses, `${name}: an interior collapse removes exactly two faces`);
      else assert.ok(a.faces <= F0 - a.collapses && a.faces >= F0 - 2 * a.collapses, `${name}: a collapse removes one face on the boundary and two elsewhere`);
      assert.equal(topology.counts.components, name === "figure" ? 7 : 1);
    }
  }
});

test("targetFaces stops at the FIRST collapse count whose faces are at most the target: exact for a closed mesh, one below on the other parity", () => {
  const sphere = bundledMesh("icosphere", { detail: 3 });
  assert.equal(sphere.triangleCount, 1280);
  for (const [target, faces] of [[500, 500], [501, 500], [1279, 1278], [64, 64], [65, 64]] as const) {
    const a = simplifyMesh(sphere, { targetFaces: target });
    assert.equal(a.faces, faces, `target ${target}`);
    assert.equal(a.collapses, (1280 - faces) / 2);
    assert.equal(a.stop, "target");
  }
  const terrain = bundledMesh("terrain", { detail: 3, seed: 2, variant: "hills" });
  for (const target of [300, 150, 77]) {
    const a = simplifyMesh(terrain, { targetFaces: target });
    assert.ok(a.faces === target || a.faces === target - 1, `open mesh ${a.faces} vs ${target}`);
    assert.ok(simplifyMesh(terrain, { collapses: a.collapses - 1 }).faces > target, "one collapse fewer is still above the target");
  }
  assert.throws(() => simplifyMesh(sphere, { targetFaces: SIMPLIFY_LIMITS.minFaces - 1 }), /targetFaces must be an integer in 4\.\.1280/);
  assert.throws(() => simplifyMesh(sphere, { targetFaces: 1281 }), /targetFaces/);
  assert.throws(() => simplifyMesh(sphere, {}), /exactly one of targetFaces and collapses/);
  assert.throws(() => simplifyMesh(sphere, { targetFaces: 100, collapses: 3 }), /exactly one/);
  assert.throws(() => simplifyMesh(sphere, { collapses: -1 }), /collapses must be an integer/);
});

test("no triangle is ever inverted: outward normals on the sphere, a height field stays a height field, and every collapse turns each surviving facet less than the stated limit", () => {
  const sphere = bundledMesh("icosphere", { detail: 4 });
  for (const target of [3000, 1200, 400, 120]) {
    const { triangles } = tris(simplifyMesh(sphere, { targetFaces: target }).mesh);
    for (const t of triangles) assert.ok(dot(t.normal, t.centroid) > 0, `sphere facet turned inward at target ${target}`);
  }
  const rough = bundledMesh("terrain", { detail: 4, seed: 9, variant: "ridges" });
  for (const target of [800, 300, 100, 30]) {
    const a = simplifyMesh(rough, { targetFaces: target });
    for (const t of tris(a.mesh).triangles) assert.ok(t.normal[1] > 0, `terrain facet folded over at target ${target}`);
  }
  // per-collapse: compare consecutive prefixes by the surviving source triangle
  for (const [source, region] of [[rough, { kind: "none" } as MeshRegion], [sphere, sphereRegion], [bundledMesh("torus", { detail: 3 }), { kind: "none" } as MeshRegion]] as const) {
    let before = simplifyMesh(source, { collapses: 40, region });
    for (let k = 41; k <= 100; k++) {
      const after = simplifyMesh(source, { collapses: k, region });
      if (after.collapses === before.collapses) break;
      const beforeSources = attribute(before.mesh, "source");
      const old = new Map(tris(before.mesh).triangles.map((t, i) => [beforeSources[i], t] as const));
      const sources = attribute(after.mesh, "source");
      tris(after.mesh).triangles.forEach((t, i) => {
        const previous = old.get(sources[i]);
        assert.ok(previous, "a surviving facet existed before");
        assert.ok(dot(t.normal, previous.normal) >= MIN_NORMAL_DOT - 1e-9, `collapse ${k} turned facet ${sources[i]} by more than the limit`);
      });
      before = after;
    }
  }
});

/** Independent membership of a source vertex in a sphere region (importance exactly 1). */
function sphereMembership(source: Mesh, region: Extract<MeshRegion, { kind: "sphere" }>): (v: number) => boolean {
  const { min, max } = source.bounds, p = meshData(source).positions, diagonal = meshMeasures(source).diagonal;
  const c = [0, 1, 2].map((k) => min[k] + region.center[k] * (max[k] - min[k]));
  return (v) => Math.hypot(p[v * 3] - c[0], p[v * 3 + 1] - c[1], p[v * 3 + 2] - c[2]) <= region.radius * diagonal;
}

test("region vertices are untouched: bit-identical positions, own representative, every protected triangle kept; the rest is abstracted", () => {
  const source = bundledMesh("icosphere", { detail: 4 });
  const region = sphereRegion as Extract<MeshRegion, { kind: "sphere" }>;
  const a = simplifyMesh(source, { targetFaces: 1500, region });
  const before = meshData(source).positions, after = meshData(a.mesh).positions, origin = attribute(a.mesh, "origin"), member = sphereMembership(source, region);
  const inside = Array.from({ length: source.vertexCount }, (_, v) => v).filter(member);
  assert.ok(inside.length > 100 && inside.length < source.vertexCount / 2, "the region holds a real share of the vertices");
  for (const v of inside) {
    const at = origin.indexOf(v);
    assert.ok(at >= 0, `region vertex ${v} survives`);
    for (let k = 0; k < 3; k++) assert.ok(Object.is(after[at * 3 + k], before[v * 3 + k]), `region vertex ${v} did not move`);
    assert.equal(a.representative[v], v);
  }
  const s = tris(source).triangles, kept = new Set(attribute(a.mesh, "source"));
  s.forEach((t, i) => { if (t.ids.every(member)) assert.ok(kept.has(i), `protected triangle ${i} survives`); });
  assert.equal(a.faces, 1500, "the target counts the protected triangles too");
  assert.ok(a.faces < source.triangleCount / 3, "outside the region the surface really was abstracted");
  assert.equal(a.stop, "target");
  // the importance attribute is the field the protection came from
  const importance = attribute(a.mesh, "importance");
  for (const v of inside) assert.equal(importance[origin.indexOf(v)], 1);
});

test("boxes, bands and frozen boundaries protect exactly what they name", () => {
  const source = bundledMesh("terrain", { detail: 4, seed: 3, variant: "hills" });
  const p = meshData(source).positions, { min, max } = source.bounds;
  const box: MeshRegion = { kind: "box", center: [0.3, 0.5, 0.6], size: 0.2, falloff: 0 };
  const inBox = (v: number) => [0.3, 0.5, 0.6].every((c, k) => Math.abs(p[v * 3 + k] - (min[k] + c * (max[k] - min[k]))) <= 0.2 * (max[k] - min[k]));
  const b = simplifyMesh(source, { targetFaces: 120, region: box });
  const bo = attribute(b.mesh, "origin"), bp = meshData(b.mesh).positions;
  let protectedCount = 0;
  for (let v = 0; v < source.vertexCount; v++) if (inBox(v)) {
    protectedCount++;
    const at = bo.indexOf(v);
    assert.ok(at >= 0);
    for (let k = 0; k < 3; k++) assert.ok(Object.is(bp[at * 3 + k], p[v * 3 + k]));
  }
  assert.ok(protectedCount > 30);
  const band: MeshRegion = { kind: "band", axis: "x", from: 0.4, to: 0.6, falloff: 0 };
  const c = simplifyMesh(source, { targetFaces: 120, region: band }), co = attribute(c.mesh, "origin"), cp = meshData(c.mesh).positions;
  for (let v = 0; v < source.vertexCount; v++) if (p[v * 3] >= min[0] + 0.4 * (max[0] - min[0]) && p[v * 3] <= min[0] + 0.6 * (max[0] - min[0])) {
    const at = co.indexOf(v);
    assert.ok(at >= 0, `band vertex ${v}`);
    assert.ok(Object.is(cp[at * 3], p[v * 3]) && Object.is(cp[at * 3 + 2], p[v * 3 + 2]));
  }
  const frozen = simplifyMesh(source, { targetFaces: 60, boundary: "frozen" }), fo = attribute(frozen.mesh, "origin"), fp = meshData(frozen.mesh).positions;
  let rim = 0;
  for (let v = 0; v < source.vertexCount; v++) if (Math.abs(Math.abs(p[v * 3]) - 2) < 1e-12 || Math.abs(Math.abs(p[v * 3 + 2]) - 2) < 1e-12) {
    rim++;
    const at = fo.indexOf(v);
    assert.ok(at >= 0, `rim vertex ${v} survives a frozen boundary`);
    for (let k = 0; k < 3; k++) assert.ok(Object.is(fp[at * 3 + k], p[v * 3 + k]));
  }
  assert.equal(rim, 4 * 32, "a 32 x 32 terrain has 128 rim vertices");
});

test("importance falls off gradually: facets are as fine as the source in the region, larger in the falloff band, largest beyond it", () => {
  const source = bundledMesh("icosphere", { detail: 5 });
  const region = { kind: "sphere", center: [0.5, 0.5, 1], radius: 0.12, falloff: 0.2 } as const;
  const a = simplifyMesh(source, { targetFaces: 2500, region });
  assert.equal(a.stop, "target");
  const { min, max } = source.bounds, diagonal = meshMeasures(source).diagonal;
  const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, max[2]];
  assert.deepEqual(c, [0, 0, 1]);
  const bands: number[][] = [[], [], []];
  for (const t of tris(a.mesh).triangles) {
    const d = Math.hypot(t.centroid[0] - c[0], t.centroid[1] - c[1], t.centroid[2] - c[2]) - region.radius * diagonal;
    bands[d <= 0 ? 0 : d <= region.falloff * diagonal ? 1 : 2].push(t.area);
  }
  const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
  assert.ok(bands.every((b) => b.length > 30));
  const sourceMean = meshMeasures(source).area / source.triangleCount;
  near(mean(bands[0]), sourceMean, 0.25);
  assert.ok(mean(bands[1]) > 2 * mean(bands[0]) && mean(bands[2]) > 2 * mean(bands[1]), `${mean(bands[0])} < ${mean(bands[1])} < ${mean(bands[2])}`);
});

test("a flat surface collapses at zero error and keeps its outline: area, corners and heights are exact", () => {
  const flat = terrainMesh({ width: 4, depth: 4, columns: 8, rows: 8, height: () => 0 });
  const a = simplifyMesh(flat, { targetFaces: 6 });
  assert.ok(a.faces === 6 || a.faces === 5);
  assert.ok(a.maxVertexError < 1e-12);
  near(meshMeasures(a.mesh).area, 16, 1e-12);
  const { positions } = tris(a.mesh);
  for (let i = 1; i < positions.length; i += 3) assert.equal(positions[i], 0);
  for (const corner of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    assert.ok(Array.from({ length: positions.length / 3 }, (_, v) => v).some((v) => positions[v * 3] === corner[0] && positions[v * 3 + 2] === corner[1]), `corner ${corner} kept`);
  }
  assert.equal(meshTopology(a.mesh).counts.euler, 1);
});

/** Expected RMS error of every output vertex: distances to the planes of the source triangles at each source vertex it represents. */
function expectedErrors(source: Mesh, a: Abstraction): number[] {
  const s = tris(source).triangles, position = tris(a.mesh), origin = attribute(a.mesh, "origin");
  const incident: number[][] = Array.from({ length: source.vertexCount }, () => []);
  s.forEach((t, i) => t.ids.forEach((v) => incident[v].push(i)));
  return origin.map((w, at) => {
    const point: V3 = [position.positions[at * 3], position.positions[at * 3 + 1], position.positions[at * 3 + 2]];
    let sum = 0, count = 0;
    for (let v = 0; v < source.vertexCount; v++) if (a.representative[v] === w) for (const i of incident[v]) { sum += dot(s[i].normal, sub(point, s[i].a)) ** 2; count++; }
    return Math.sqrt(sum / count);
  });
}

test("the error attribute is the RMS distance from the vertex to the planes of the source triangles it now stands for", () => {
  const source = bundledMesh("icosphere", { detail: 3 });
  const a = simplifyMesh(source, { collapses: 250, boundary: "free" });
  const error = attribute(a.mesh, "error"), origin = attribute(a.mesh, "origin");
  let positive = 0;
  const expected = expectedErrors(source, a);
  origin.forEach((_, i) => { near(error[i], expected[i], 1e-7); if (error[i] > 1e-6) positive++; });
  assert.ok(positive > 20, "the sphere curves, so merged vertices really carry error");
  assert.ok(a.maxVertexError === Math.max(...error));
  const untouched = simplifyMesh(source, { collapses: 0 });
  assert.ok(untouched.maxVertexError < 1e-6, "the source is exactly on its own planes");
});

test("ids and correspondence: origins ascend, sources ascend, and each output facet's corners are the representatives of its source facet's corners", () => {
  const source = bundledMesh("vase", { detail: 3, variant: "amphora" });
  const a = simplifyMesh(source, { targetFaces: 90, region: { kind: "seeded", count: 2, radius: 0.1, falloff: 0.1 }, seed: 5 });
  const origin = attribute(a.mesh, "origin"), sources = attribute(a.mesh, "source"), s = tris(source).triangles, out = tris(a.mesh).triangles;
  for (let i = 1; i < origin.length; i++) assert.ok(origin[i] > origin[i - 1]);
  for (let i = 1; i < sources.length; i++) assert.ok(sources[i] > sources[i - 1]);
  out.forEach((t, i) => assert.deepEqual(t.ids.map((v) => origin[v]), s[sources[i]].ids.map((v) => a.representative[v])));
  for (let v = 0; v < source.vertexCount; v++) assert.equal(a.representative[a.representative[v]], a.representative[v], "a representative represents itself");
  assert.equal(new Set(origin).size, a.mesh.vertexCount);
  for (const w of origin) assert.equal(a.representative[w], w);
});

test("PREFIX PROPERTY: fewer collapses are a prefix of more, scrubbing in any order gives the same mesh, and the simulation passes the snapshot checker", () => {
  const source = bundledMesh("terrain", { detail: 3, seed: 4, variant: "hills" });
  const options: SimplifyOptions = { region: { kind: "sphere", center: [0.4, 0.5, 0.5], radius: 0.15, falloff: 0.15 }, creaseAngle: 30, seed: 4, maxError: 0.05 };
  const long = simplifyMesh(source, { ...options, collapses: 400 });
  const scratch = (k: number) => finalState(runSimulation(simplifySimulation, long.snapshots.params as unknown as SimplifyParams, 4, { steps: k, checkpointEvery: 0, maxWork: Number.MAX_SAFE_INTEGER, maxStateValues: 1e8, maxCheckpointValues: 1e9 }));
  for (const k of [400, 37, 205, 205, 0, 399, 1, 250]) {
    const a = simplifyMesh(source, { ...options, collapses: k });
    assert.ok(identical(finalState(a.snapshots), scratch(a.snapshots.steps)), `k=${k} equals a run from scratch`);
    assert.equal(abstractionAt(long, k).mesh.key, a.mesh.key, `abstractionAt(${k})`);
  }
  // structure: merged sets only grow and surviving facets only shrink
  const early = simplifyMesh(source, { ...options, collapses: 60 }), late = simplifyMesh(source, { ...options, collapses: 200 });
  for (let v = 0; v < source.vertexCount; v++) assert.equal(late.representative[early.representative[v]], late.representative[v]);
  const lateSources = new Set(attribute(late.mesh, "source"));
  for (const t of lateSources) assert.ok(new Set(attribute(early.mesh, "source")).has(t), "a facet that survives later existed earlier");
  for (const [region, steps] of [[{ kind: "none" }, 40], [options.region, 50]] as const) {
    checkSimulation(simplifySimulation, simplifyMesh(source, { ...options, region: region as MeshRegion, collapses: 1 }).snapshots.params as unknown as SimplifyParams, 4, steps);
  }
  const closed = simplifyMesh(bundledMesh("icosphere", { detail: 2 }), { collapses: 5, rule: "length", creaseAngle: 20 });
  checkSimulation(simplifySimulation, closed.snapshots.params as unknown as SimplifyParams, 0, 60);
  const figure = simplifyMesh(bundledMesh("figure"), { collapses: 5, creaseAngle: 30 });
  checkSimulation(simplifySimulation, figure.snapshots.params as unknown as SimplifyParams, 0, 60);
  assert.deepEqual(simplifyRetention(1000, 500), simplifyRetention(1000, 500));
});

test("an error limit stops the sequence with a stated reason and every executed collapse respects it (tightened toward the region)", () => {
  const source = bundledMesh("terrain", { detail: 4, seed: 6, variant: "ridges" });
  const limit = 0.02;
  const limited = simplifyMesh(source, { targetFaces: 8, maxError: limit });
  assert.equal(limited.stop, "error-limit");
  assert.ok(limited.blockedCensus().error > 0);
  const free = simplifyMesh(source, { targetFaces: 8 });
  assert.ok(free.faces < limited.faces, "with no limit the facet count decides");
  const history = runSimulation(simplifySimulation, limited.snapshots.params as unknown as SimplifyParams, 0, { steps: limited.collapses, checkpointEvery: 0, historyEvery: 1, maxWork: Number.MAX_SAFE_INTEGER, maxStateValues: 1e8, maxCheckpointValues: 1e9 }).history;
  assert.equal(history.length, limited.collapses + 1);
  for (const h of history) assert.ok(h.value.error <= limit + 1e-12, `collapse ${h.step} moved the surface by ${h.value.error}`);
  // the limit tightens to zero toward the region: everything inside the falloff band was collapsed less
  const region = { kind: "band", axis: "x", from: 0.4, to: 0.6, falloff: 0.2 } as const;
  const local = simplifyMesh(source, { targetFaces: 8, maxError: limit, region });
  const sources = attribute(local.mesh, "importance");
  assert.ok(sources.some((w) => w === 1));
  for (const h of runSimulation(simplifySimulation, local.snapshots.params as unknown as SimplifyParams, 0, { steps: local.collapses, checkpointEvery: 0, historyEvery: 1, maxWork: Number.MAX_SAFE_INTEGER, maxStateValues: 1e8, maxCheckpointValues: 1e9 }).history) assert.ok(h.value.error <= limit + 1e-12);
});

test("every remaining edge is blocked for exactly one named reason when nothing more can collapse", () => {
  const tetra = mesh({ id: "tetra", positions: [1, 1, 1, -1, -1, 1, -1, 1, -1, 1, -1, -1], triangles: [0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2] });
  const t = simplifyMesh(tetra, { collapses: 3 });
  assert.equal(t.collapses, 0); assert.equal(t.stop, "no-legal-collapse");
  assert.equal(t.blockedCensus().tetrahedron, 6);
  const single = mesh({ id: "one", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], triangles: [0, 1, 2] });
  const s = simplifyMesh(single, { collapses: 1 });
  assert.equal(s.collapses, 0); assert.equal(s.blockedCensus().component, 3);
  const square = mesh({ id: "square", positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], triangles: [0, 1, 2, 0, 2, 3] });
  const start = simplifyMesh(square, { collapses: 0 });
  assert.deepEqual(start.blockedCensus(), { locked: 0, link: 1, tetrahedron: 0, component: 0, flip: 0, valence: 0, error: 0 }, "only the diagonal joins two boundary vertices through the interior");
  const q = simplifyMesh(square, { collapses: 2 });
  assert.equal(q.collapses, 1); assert.equal(q.faces, 1); assert.equal(q.stop, "no-legal-collapse");
  // nothing legal, every edge blocked by one reason
  const rough = bundledMesh("terrain", { detail: 2, seed: 1, variant: "ridges" });
  const done = simplifyMesh(rough, { collapses: rough.triangleCount });
  assert.equal(done.stop, "no-legal-collapse");
  const census = done.blockedCensus(), edges = meshTopology(done.mesh).counts.edges;
  assert.equal(Object.values(census).reduce((sum, n) => sum + n, 0), edges);
  const locked = simplifyMesh(rough, { collapses: 10, region: { kind: "box", center: [0.5, 0.5, 0.5], size: 2, falloff: 0 } });
  assert.equal(locked.collapses, 0);
  assert.equal(locked.blockedCensus().locked, meshTopology(rough).counts.edges + rough.quadCount, "every edge of the triangulation (the quad diagonals too) is locked");
});

test("invalid sources and options are refused with the input named", () => {
  const spine = mesh({ id: "spine", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -1, 0], triangles: [0, 1, 2, 0, 3, 1, 1, 0, 4] });
  assert.throws(() => simplifyMesh(spine, { collapses: 1 }), /is non-manifold: simplification needs a consistently oriented manifold surface/);
  const flipped = mesh({ id: "flipped", positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], triangles: [0, 1, 2, 0, 3, 2] });
  assert.throws(() => simplifyMesh(flipped, { collapses: 1 }), /inconsistent-orientation/);
  const big = bundledMesh("icosphere", { detail: 6 });
  assert.ok(big.triangleCount > SIMPLIFY_LIMITS.maxTriangles);
  assert.throws(() => simplifyMesh(big, { collapses: 1 }), /81920 triangles; simplification is bounded to 40000; reduce the source detail/);
  const sphere = bundledMesh("icosphere", { detail: 2 });
  assert.throws(() => simplifyMesh(sphere, { collapses: 1, rule: "shortest" as never }), /rule must be one of quadric, length/);
  assert.throws(() => simplifyMesh(sphere, { collapses: 1, boundary: "x" as never }), /boundary must be one of/);
  assert.throws(() => simplifyMesh(sphere, { collapses: 1, maxError: -1 }), /maxError/);
  assert.throws(() => simplifyMesh(sphere, { collapses: 1, creaseAngle: 200 }), /creaseAngle/);
  assert.throws(() => simplifyMesh(sphere, { collapses: 1, seed: -1 }), /seed/);
});

test("regions: linear falloff from exactly 1 to exactly 0, inversion, and seeded spheres that only grow", () => {
  const plane = terrainMesh({ width: 4, depth: 4, columns: 8, rows: 8, height: () => 0 });
  const p = meshData(plane).positions;
  const band = regionImportance(plane, { kind: "band", axis: "x", from: 0.25, to: 0.5, falloff: 0.1 }, 0);
  const diagonal = meshMeasures(plane).diagonal;
  for (let v = 0; v < plane.vertexCount; v++) {
    const x = p[v * 3], distance = Math.max(0, -1 - x, x - 0);
    near(band[v], Math.max(0, 1 - distance / (0.1 * diagonal)), 1e-12);
  }
  const inverted = regionImportance(plane, { kind: "band", axis: "x", from: 0.25, to: 0.5, falloff: 0.1, invert: true }, 0);
  for (let v = 0; v < plane.vertexCount; v++) near(inverted[v], 1 - band[v], 1e-15);
  const hard = regionImportance(plane, { kind: "sphere", center: [0.5, 0.5, 0.5], radius: 0.25, falloff: 0 }, 0);
  assert.ok(hard.every((w) => w === 0 || w === 1));
  const none = regionImportance(plane, { kind: "none" }, 0);
  assert.ok(none.every((w) => w === 0));
  const sphere = bundledMesh("icosphere", { detail: 3 });
  const two = regionImportance(sphere, { kind: "seeded", count: 2, radius: 0.15, falloff: 0.05 }, 7), three = regionImportance(sphere, { kind: "seeded", count: 3, radius: 0.15, falloff: 0.05 }, 7);
  for (let v = 0; v < sphere.vertexCount; v++) assert.ok(three[v] >= two[v]);
  assert.ok(three.some((w, v) => w > two[v]) && two.some((w) => w === 1));
  const other = regionImportance(sphere, { kind: "seeded", count: 2, radius: 0.15, falloff: 0.05 }, 8);
  assert.notDeepEqual(Array.from(other), Array.from(two), "the seed moves the spheres");
  assert.deepEqual(Array.from(regionImportance(sphere, { kind: "seeded", count: 2, radius: 0.15, falloff: 0.05 }, 7)), Array.from(two));
  assert.throws(() => checkRegion({ kind: "band", axis: "y", from: 0.7, to: 0.3, falloff: 0 }), /from must not exceed to/);
  assert.throws(() => checkRegion({ kind: "sphere", center: [0.5, 0.5, 0.5], radius: Number.NaN, falloff: 0 }), /radius/);
  assert.throws(() => checkRegion({ kind: "seeded", count: 100, radius: 0.1, falloff: 0 }), /count must be an integer in 0\.\.64/);
});
