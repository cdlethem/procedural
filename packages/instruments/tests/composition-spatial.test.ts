import assert from "node:assert/strict";
import test from "node:test";
import {
  boxMesh, bundledMesh, bundledMeshIds, bundledMeshInfo, camera, cropPointCloud, faceArea, faceNormal, figureMesh, pointCloudData, findMeshEdge, hiddenLines, icosphereMesh, mergeMeshes,
  mesh, meshAttribute, pointAttribute, meshComponentOfFace, meshComponents, meshCreaseEdges, meshEdgeAngle, meshEdgeClass, meshEdgeCurves, meshEdgeFaces, meshEdgeVertices, meshFace,
  meshFaceNeighbors, meshFeatureEdges, meshBoundaryEdges, meshCornerAttributes, vertexNormals, resolveMeshSource, resolvePointSource, meshMeasures, meshSilhouetteEdges, meshTopology, meshVertex, meshVertexClass, meshVertexFanCount, meshVertexCloud, paintOrder,
  pointCloud, pointId, pointPosition, pointSeed, projectPoints, sampleSource, sampleSurface, selectPoints, terrainMesh, thinPointCloud, torusMesh, transformMesh,
  vaseMesh, vaseProfiles, visiblePoints, componentSeed, POINT_LIMITS, MESH_LIMITS,
  type Mesh, type Vec3,
} from "../dist/index.js";

const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);

const nearPoints = (actual: readonly (readonly number[])[], expected: readonly (readonly number[])[], tolerance = 1e-8) => {
  assert.equal(actual.length, expected.length, `${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`);
  actual.forEach((point, i) => point.forEach((v, k) => assert.ok(Math.abs(v - expected[i][k]) <= tolerance, `${JSON.stringify(actual)} != ${JSON.stringify(expected)}`)));
};
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a: readonly number[], b: readonly number[]): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// ------------------------------------------------------------------------------------------------ Mesh value

test("a mesh admits only valid indices and coordinates, and names the face or vertex that is not", () => {
  const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
  const bad = (input: Parameters<typeof mesh>[0], pattern: RegExp) => assert.throws(() => mesh(input), pattern);
  bad({ id: "m", positions, triangles: [0, 1, 3] }, /triangles face 0 corner 2 is 3; expected an integer in 0\.\.2/);
  bad({ id: "m", positions, triangles: [0, 1, 1.5] }, /face 0 corner 2 is 1\.5/);
  bad({ id: "m", positions: [0, 0, 0, 1, 0, Infinity, 0, 1, 0], triangles: [0, 1, 2] }, /positions\[5\] \(vertex 1, z\)/);
  bad({ id: "m", positions: [0, 0, 0, 1, 0], triangles: [0, 1, 2] }, /multiple of 3/);
  bad({ id: "m", positions, triangles: [] }, /at least one triangle or quad/);
  bad({ id: "m", positions: [0, 0, 1e60, 1, 0, 0, 0, 1, 0], triangles: [0, 1, 2] }, /coordinate limit/);
  bad({ id: "m", positions, triangles: [0, 1, 2], extra: 1 } as never, /unknown field: extra/);
  bad({ id: "", positions, triangles: [0, 1, 2] }, /non-empty id/);
  bad({ id: "m", positions, triangles: [0, 1, 2], attributes: [{ name: "a", domain: "vertex", size: 1, values: [1, 2] }] }, /attribute "a" has 2 values; expected 3/);
  bad({ id: "m", positions, triangles: [0, 1, 2], attributes: [{ name: "a", domain: "face", size: 1, values: [1] }, { name: "a", domain: "face", size: 1, values: [1] }] }, /repeated/);
  bad({ id: "m", positions: new Array(3 * (MESH_LIMITS.maxVertices + 1)).fill(0), triangles: [0, 1, 2] }, /limit is 200000; reduce positions/);
});

test("degenerate faces are rejected by name or dropped with face attributes following", () => {
  // vertices 0..3 form a unit square in z = 0; vertex 4 is collinear with 0 and 1
  const positions = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0.5, 0, 0];
  const triangles = [0, 1, 2, 0, 1, 4, 0, 2, 3, 2, 2, 3];
  assert.throws(() => mesh({ id: "m", positions, triangles }), /face 1 \(triangle\) has zero area.*degenerate: "drop"/);
  assert.throws(() => mesh({ id: "m", positions, triangles: [0, 1, 2, 2, 2, 3] }), /face 1 \(triangle\) repeats a vertex index/);
  const dropped = mesh({ id: "m", positions, triangles, degenerate: "drop", attributes: [{ name: "tag", domain: "face", size: 1, values: [10, 11, 12, 13] }] });
  assert.deepEqual([...dropped.dropped], [1, 3]);
  assert.equal(dropped.faceCount, 2);
  assert.deepEqual([...meshAttribute(dropped, "tag").values], [10, 12]);
  assert.throws(() => mesh({ id: "m", positions, triangles: [0, 1, 4], degenerate: "drop" }), /every face is degenerate/);
});

test("quads: bow-tie rejected, unit square split evenly, and a dart whose shorter diagonal lies outside falls back to the other", () => {
  // A(-3,-3) R(0,-2) B(3,-3) C(0,9): counter-clockwise with a reflex vertex at R. A-B (length 6) is shorter than R-C
  // (length 11) but lies outside the quad, so the split must use R-C. Area = triangle ABC (36) minus the dent ARB (3) = 33.
  const dart = mesh({ id: "dart", positions: [-3, -3, 0, 0, -2, 0, 3, -3, 0, 0, 9, 0], quads: [0, 1, 2, 3] });
  assert.equal(dart.triangleCount, 2);
  near(meshMeasures(dart).area, 33);
  assert.throws(() => mesh({ id: "bow", positions: [0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0], quads: [0, 1, 2, 3] }), /folded|non-convex/);
  const square = mesh({ id: "sq", positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], quads: [0, 1, 2, 3] });
  near(meshMeasures(square).area, 1);
  assert.equal(square.quadCount, 1);
  assert.equal(meshTopology(square).counts.edges, 4, "the diagonal is not an edge");
});

test("meshes copy their input, ignore the id in the content key and expose only copies", () => {
  const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0];
  const triangles = [0, 1, 2, 1, 3, 2];
  const a = mesh({ id: "first", positions: positions.slice(), triangles });
  const b = mesh({ id: "second", positions: positions.slice(), triangles });
  assert.equal(a.key, b.key);
  const source = new Float64Array(positions);
  const c = mesh({ id: "c", positions: source, triangles });
  source[0] = 99;
  assert.equal(c.key, a.key, "the caller's array is not retained");
  assert.deepEqual([...meshVertex(c, 0)], [0, 0, 0]);
  assert.notEqual(mesh({ id: "d", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1e-12], triangles }).key, a.key);
  assert.notEqual(mesh({ id: "e", positions, triangles, attributes: [{ name: "w", domain: "vertex", size: 1, values: [0, 0, 0, 0] }] }).key, a.key);
  assert.equal(mesh(a), a, "a validated mesh is returned unchanged");
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.bounds));
});

test("box, transform and merge agree with closed-form area, volume and orientation", () => {
  const box = boxMesh([2, 3, 4]);
  near(meshMeasures(box).area, 2 * (2 * 3 + 2 * 4 + 3 * 4));
  near(meshMeasures(box).signedVolume, 24);
  const mirrored = transformMesh(box, { scale: [-1, 1, 1] });
  near(meshMeasures(mirrored).signedVolume, 24);
  assert.equal(meshTopology(mirrored).kind, "closed-manifold", "a mirror reverses faces so normals still point outward");
  const turned = transformMesh(box, { rotate: [0, 90, 0], translate: [1, 0, 0] });
  // rotating 90 degrees about y turns extents (2,3,4) into (4,3,2); exact sines and cosines
  assert.deepEqual([...turned.bounds.min], [1 - 2, -1.5, -1]);
  assert.deepEqual([...turned.bounds.max], [1 + 2, 1.5, 1]);
  const two = mergeMeshes("two", [box, transformMesh(box, { translate: [10, 0, 0] })]);
  near(meshMeasures(two).signedVolume, 48);
  assert.equal(meshTopology(two).counts.components, 2);
  assert.throws(() => transformMesh(box, { scale: 0 }), /must not be 0/);
});

test("faces have outward unit normals and their exact areas", () => {
  const box = boxMesh([2, 2, 2]);
  const normals = Array.from({ length: 6 }, (_, f) => faceNormal(box, f));
  for (const e of [[0, 1, 0], [0, -1, 0], [0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]]) assert.ok(normals.some((n) => dot(n, e) > 1 - 1e-12), `no face looks along ${e}`);
  for (let f = 0; f < 6; f++) { near(faceArea(box, f), 4); assert.ok(dot(normals[f], meshVertex(box, meshFace(box, f)[0])) > 0, "the normal points away from the centre"); }
});

// ------------------------------------------------------------------------------------------------ Bundled meshes, closed forms

test("the icosahedron and its subdivisions match Euler counts and the closed forms", () => {
  const edge = 4 / Math.sqrt(10 + 2 * Math.sqrt(5));
  const base = icosphereMesh(0);
  near(meshMeasures(base).area, 5 * Math.sqrt(3) * edge * edge);
  near(meshMeasures(base).signedVolume, 5 / 12 * (3 + Math.sqrt(5)) * edge ** 3);
  let previous = 0;
  for (let level = 0; level <= 4; level++) {
    const m = icosphereMesh(level, 2), t = meshTopology(m), n = 4 ** level;
    assert.equal(m.vertexCount, 10 * n + 2);
    assert.equal(m.faceCount, 20 * n);
    assert.equal(t.counts.edges, 30 * n);
    assert.equal(t.counts.euler, 2);
    assert.equal(t.kind, "closed-manifold");
    for (let v = 0; v < m.vertexCount; v++) near(Math.hypot(...meshVertex(m, v)), 2, 1e-12);
    const area = meshMeasures(m).area;
    assert.ok(area > previous && area < 4 * Math.PI * 4, "area increases toward the sphere's 4 pi r^2 from below");
    previous = area;
  }
  near(previous / (4 * Math.PI * 4), 1, 2e-3);
});

test("a revolved vase matches the frustum-stack formulas exactly", () => {
  const slices = 24, height = 3, radius = 0.5, name = "urn" as const;
  const closed = vaseMesh({ profile: name, slices, height, radius, capBottom: true, capTop: true });
  const profile = vaseProfiles[name].map(([axial, r]) => [axial * height, r * radius]);
  const gon = (r: number) => slices / 2 * r * r * Math.sin(2 * Math.PI / slices);
  let volume = 0, area = gon(profile[0][1]) + gon(profile[profile.length - 1][1]);
  for (let i = 0; i + 1 < profile.length; i++) {
    const h = profile[i + 1][0] - profile[i][0], r0 = profile[i][1], r1 = profile[i + 1][1];
    volume += h / 3 * (gon(r0) + gon(r1) + Math.sqrt(gon(r0) * gon(r1)));
    const slant = Math.hypot(h, (r0 - r1) * Math.cos(Math.PI / slices));
    area += slices * (2 * r0 * Math.sin(Math.PI / slices) + 2 * r1 * Math.sin(Math.PI / slices)) / 2 * slant;
  }
  near(meshMeasures(closed).signedVolume, volume, 1e-12);
  near(meshMeasures(closed).area, area, 1e-12);
  assert.equal(meshTopology(closed).kind, "closed-manifold");
  assert.equal(meshTopology(closed).counts.euler, 2);
  const [minY, maxY] = [closed.bounds.min[1], closed.bounds.max[1]];
  near(minY, -height / 2); near(maxY, height / 2);
  // the open vessel keeps its rim: one boundary loop of `slices` edges
  const open = vaseMesh({ profile: name, slices, height, radius });
  const t = meshTopology(open);
  assert.equal(t.kind, "open-manifold");
  assert.equal(t.counts.boundaryEdges, slices);
  assert.equal(t.counts.euler, 1);
  // band, cell and kind attributes come from the shared revolved-profile source
  assert.equal(meshAttribute(open, "kind").values.filter((k) => k === 1).length, slices, "bottom cap fan");
});

test("a torus has Euler characteristic 0 and its surface area and volume converge to 4 pi^2 R r and 2 pi^2 R r^2 as 1 / n^2", () => {
  const R = 1.5, r = 0.5, error = (u: number, v: number) => {
    const m = torusMesh({ major: R, minor: r, u, v }), t = meshTopology(m);
    assert.equal(t.kind, "closed-manifold");
    assert.equal(t.counts.euler, 0);
    assert.equal(t.counts.edges, 2 * u * v);
    assert.equal(m.quadCount, u * v);
    return [1 - meshMeasures(m).area / (4 * Math.PI ** 2 * R * r), 1 - meshMeasures(m).signedVolume / (2 * Math.PI ** 2 * R * r * r)];
  };
  const coarse = error(48, 24), fine = error(96, 48);
  for (let k = 0; k < 2; k++) {
    assert.ok(fine[k] > 0 && fine[k] < 5e-3, `an inscribed polyhedron is smaller than its torus, by ${fine[k]}`);
    assert.ok(coarse[k] / fine[k] > 3.5 && coarse[k] / fine[k] < 4.5, `halving the segment size quarters the error (${coarse[k] / fine[k]})`);
  }
  const m = torusMesh({ major: R, minor: r, u: 12, v: 6 });
  assert.throws(() => torusMesh({ major: 1, minor: 1 }), /smaller than the major radius/);
});

test("a tilted terrain plane has the exact planar area and boundary of an open sheet", () => {
  const a = 0.3, b = -0.2, w = 5, d = 3, columns = 7, rows = 5;
  const m = terrainMesh({ width: w, depth: d, columns, rows, height: (x, z) => a * x + b * z });
  near(meshMeasures(m).area, w * d * Math.sqrt(1 + a * a + b * b), 1e-12);
  const t = meshTopology(m);
  assert.equal(t.kind, "open-manifold");
  assert.equal(t.counts.boundaryEdges, 2 * (columns + rows));
  assert.equal(t.counts.euler, 1);
  assert.equal(t.counts.faces, columns * rows);
  // every face normal is (-a, 1, -b) normalized: faces look up
  const n = Math.hypot(a, 1, b);
  for (let f = 0; f < t.counts.faces; f++) { const fn = faceNormal(m, f); near(fn[0], -a / n, 1e-12); near(fn[1], 1 / n, 1e-12); near(fn[2], -b / n, 1e-12); }
  assert.throws(() => terrainMesh({ width: 1, depth: 1, columns: 2, rows: 2, height: (x) => (x > 0 ? NaN : 0) }), /vertex \(2, 0\).*must return finite/);
  // the bundled height fields are deterministic in (variant, seed) and differ between seeds
  const h1 = bundledMesh("terrain", { seed: 1, variant: "ridges" }), h2 = bundledMesh("terrain", { seed: 2, variant: "ridges" });
  assert.equal(h1.key, bundledMesh("terrain", { seed: 1, variant: "ridges" }).key);
  assert.notEqual(h1.key, h2.key);
});

test("the faceted figure is seven closed components mixing quads and triangles; every bundled id builds", () => {
  const figure = figureMesh(), t = meshTopology(figure);
  assert.equal(t.kind, "closed-manifold");
  assert.equal(t.counts.components, 7);
  assert.equal(t.counts.euler, 14);
  assert.ok(figure.quadCount > 0 && figure.quadCount < figure.faceCount);
  assert.ok(meshMeasures(figure).signedVolume > 0);
  const summaries = meshComponents(figure, t);
  assert.ok(summaries.every((s) => s.euler === 2 && s.boundaryEdges === 0));
  assert.equal(summaries.reduce((sum, s) => sum + s.faces, 0), figure.faceCount);
  for (const id of bundledMeshIds) {
    const info = bundledMeshInfo(id), m = bundledMesh(id);
    assert.equal(meshTopology(m).kind, info.closed ? "closed-manifold" : "open-manifold", id);
    assert.equal(m, bundledMesh(id), "cached by construction");
  }
  assert.throws(() => bundledMesh("torus", { detail: 99 }), /torus detail must be an integer in 1\.\.8/);
  assert.throws(() => bundledMesh("vase", { variant: "cup" }), /vase variant must be one of/);
});

// ------------------------------------------------------------------------------------------------ Topology

test("a cube's topology: 8 - 12 + 6, every edge manifold, no diagonals, adjacency of four", () => {
  const cube = boxMesh([2, 2, 2]), t = meshTopology(cube);
  assert.deepEqual({ v: t.counts.usedVertices, e: t.counts.edges, f: t.counts.faces, x: t.counts.euler }, { v: 8, e: 12, f: 6, x: 2 });
  assert.equal(t.kind, "closed-manifold");
  for (let e = 0; e < 12; e++) { assert.equal(meshEdgeClass(t, e), "manifold"); assert.equal(meshEdgeFaces(t, e).length, 2); }
  for (let f = 0; f < 6; f++) assert.equal(meshFaceNeighbors(t, f).length, 4);
  for (let v = 0; v < 8; v++) { assert.equal(meshVertexClass(t, v), "interior"); assert.equal(meshVertexFanCount(t, v), 1); }
  // a cube triangulated into 12 triangles has 18 edges: the six diagonals are real there
  const tri = mesh({ id: "tri-cube", positions: Array.from({ length: 8 }, (_, i) => [(i & 1) * 2 - 1, ((i >> 2) & 1) * 2 - 1, ((i >> 1) & 1) * 2 - 1]).flat(),
    triangles: [4, 6, 7, 4, 7, 5, 0, 1, 3, 0, 3, 2, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3] });
  const tt = meshTopology(tri);
  assert.equal(tt.counts.edges, 18);
  assert.equal(tt.counts.euler, 2);
  assert.equal(tt.kind, "closed-manifold");
  // and its flat diagonals are not creases
  assert.equal(meshCreaseEdges(tt, 45).length, 12);
});

test("crease detection on the cube follows the dihedral angle inclusively and signs ridges against valleys", () => {
  const cube = boxMesh([2, 2, 2]), t = meshTopology(cube);
  assert.equal(meshCreaseEdges(t, 45).length, 12);
  assert.equal(meshCreaseEdges(t, 90).length, 12, "90 degrees satisfies a 90 degree threshold");
  assert.equal(meshCreaseEdges(t, 90.01).length, 0);
  for (let e = 0; e < 12; e++) near(meshEdgeAngle(t, e), 90, 1e-9);
  assert.equal(meshCreaseEdges(t, 45, "concave").length, 0);
  // a V-shaped valley y = |x| and a ridge y = -|x| fold by 90 degrees along x = 0 with opposite signs
  for (const [sign, expected] of [[1, -90], [-1, 90]] as const) {
    const m = terrainMesh({ width: 2, depth: 2, columns: 2, rows: 2, height: (x) => sign * Math.abs(x) });
    const topo = meshTopology(m), creases = meshCreaseEdges(topo, 45);
    assert.equal(creases.length, 2, "two edges along the fold");
    for (const e of creases) { near(meshEdgeAngle(topo, e), expected, 1e-9); const [a, b] = meshEdgeVertices(topo, e); assert.equal(meshVertex(m, a)[0], 0); assert.equal(meshVertex(m, b)[0], 0); }
    assert.equal(meshCreaseEdges(topo, 45, sign > 0 ? "concave" : "convex").length, 2);
    assert.equal(meshCreaseEdges(topo, 45, sign > 0 ? "convex" : "concave").length, 0);
  }
  assert.throws(() => meshCreaseEdges(t, 0), /\(0, 180\]/);
});

test("classification: open, non-manifold edge, pinched vertex, inconsistent orientation, isolated vertices", () => {
  const one = mesh({ id: "one", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], triangles: [0, 1, 2] });
  assert.equal(meshTopology(one).kind, "open-manifold");
  assert.equal(meshTopology(one).counts.boundaryEdges, 3);
  // three triangles on one edge (a book with three pages)
  const book = mesh({ id: "book", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1], triangles: [0, 1, 2, 1, 0, 3, 0, 1, 4] });
  const tb = meshTopology(book);
  assert.equal(tb.kind, "non-manifold");
  assert.equal(tb.counts.nonManifoldEdges, 1);
  assert.equal(meshEdgeClass(tb, findMeshEdge(tb, 0, 1)), "non-manifold");
  assert.equal(Number.isNaN(meshEdgeAngle(tb, findMeshEdge(tb, 0, 1))), true);
  // two triangles touching at one vertex: every edge is a boundary but the vertex is a pinch
  const bow = mesh({ id: "bow", positions: [0, 0, 0, 1, 1, 0, 1, -1, 0, -1, 1, 0, -1, -1, 0], triangles: [0, 1, 2, 0, 4, 3] });
  const bt = meshTopology(bow);
  assert.equal(bt.kind, "non-manifold");
  assert.equal(bt.counts.nonManifoldEdges, 0);
  assert.equal(meshVertexFanCount(bt, 0), 2);
  assert.equal(meshVertexClass(bt, 0), "non-manifold");
  assert.equal(bt.counts.components, 1, "components connect through vertices");
  // two coplanar triangles sharing an edge but wound the same way
  const flipped = mesh({ id: "flip", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], triangles: [0, 1, 2, 1, 2, 3] });
  const ft = meshTopology(flipped);
  assert.equal(ft.kind, "inconsistent-orientation");
  assert.equal(meshEdgeClass(ft, findMeshEdge(ft, 1, 2)), "flipped");
  near(meshEdgeAngle(ft, findMeshEdge(ft, 1, 2)), 0, 1e-9);
  // unused vertices are reported, not removed, and excluded from the Euler count
  const spare = mesh({ id: "spare", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 5, 5], triangles: [0, 1, 2] });
  assert.equal(meshTopology(spare).counts.unusedVertices, 1);
  assert.equal(meshTopology(spare).counts.euler, 1);
  assert.equal(meshVertexClass(meshTopology(spare), 3), "unused");
});

test("components partition faces, with closed-form Euler characteristics per component", () => {
  const cubes = mergeMeshes("cubes", [boxMesh([1, 1, 1], [0, 0, 0]), torusMesh({ u: 12, v: 6 }), boxMesh([1, 1, 1], [9, 0, 0])]);
  const t = meshTopology(cubes), summaries = meshComponents(cubes, t);
  assert.deepEqual(summaries.map((s) => [s.faces, s.euler]), [[6, 2], [72, 0], [6, 2]]);
  assert.equal(meshComponentOfFace(t, 0), 0);
  assert.equal(meshComponentOfFace(t, 6), 1);
  assert.equal(meshComponentOfFace(t, 6 + 72), 2);
  assert.equal(summaries[1].id, "c:1");
});

test("silhouette edges of a sphere form one loop on the tangent cone or cylinder", () => {
  const sphere = icosphereMesh(3), t = meshTopology(sphere), bound = 0.14; // one edge subtends about 0.14 rad at this level
  for (const view of [camera({ projection: "orthographic", yaw: 37, pitch: 23, zoom: 100 }), camera({ projection: "perspective", yaw: -50, pitch: 15, distance: 6, zoom: 100 })]) {
    const edges = meshSilhouetteEdges(sphere, t, view);
    assert.ok(edges.length > 20);
    const degree = new Map<number, number>();
    for (const e of edges) for (const v of meshEdgeVertices(t, e)) degree.set(v, (degree.get(v) ?? 0) + 1);
    assert.ok([...degree.values()].every((d) => d === 2), "every silhouette vertex meets two silhouette edges: a single closed ring");
    for (const v of degree.keys()) {
      const p = meshVertex(sphere, v);
      if (view.options.projection === "orthographic") assert.ok(Math.abs(dot(p, view.forward)) <= bound, "on the great circle perpendicular to the view");
      else {
        const toEye = sub(view.eye, [0, 0, 0]), distance = Math.hypot(...toEye), e = toEye.map((c) => c / distance);
        assert.ok(Math.abs(dot(p, e) - 1 / distance) <= bound, "on the plane of tangency of the view cone");
      }
    }
    const curves = meshEdgeCurves(sphere, t, edges);
    assert.equal(curves.length, 1);
    assert.equal(curves[0].closed, true);
  }
});

test("a cube's silhouette from a generic angle is a hexagon and boundary edges are opt-in", () => {
  const cube = boxMesh([2, 2, 2]), t = meshTopology(cube);
  const view = camera({ projection: "orthographic", yaw: 30, pitch: 20 });
  assert.equal(meshSilhouetteEdges(cube, t, view).length, 6);
  const straight = camera({ projection: "orthographic", yaw: 0, pitch: 0 });
  const outline = meshSilhouetteEdges(cube, t, straight);
  assert.equal(outline.length, 4, "edge-on side faces count as back-facing: the outline is the square");
  assert.ok(outline.every((e) => meshEdgeVertices(t, e).every((v) => meshVertex(cube, v)[2] === 1)), "and it is the square of the face turned toward the camera, not the far one");
  const sheet = terrainMesh({ width: 1, depth: 1, columns: 1, rows: 1, height: () => 0 }), st = meshTopology(sheet);
  assert.equal(meshSilhouetteEdges(sheet, st, view).length, 0);
  assert.equal(meshSilhouetteEdges(sheet, st, view, { boundary: true }).length, 4);
  assert.throws(() => meshFeatureEdges(cube, t, null, { crease: null, silhouette: true, boundary: false }), /need a camera/);
  const features = meshFeatureEdges(cube, t, view, { crease: 45, silhouette: true, boundary: false });
  assert.equal(features.length, 12);
  assert.equal(features.filter((f) => f.silhouette).length, 6);
  assert.ok(features.every((f) => f.crease) && features.filter((f) => f.tone === 1).length === 6);
});

// ------------------------------------------------------------------------------------------------ Camera

test("orthographic axes, roll, depth and the perspective scale follow the documented conventions exactly", () => {
  const front = camera({ projection: "orthographic", yaw: 0, pitch: 0, roll: 0, zoom: 50, distance: 10, center: [200, 100] });
  assert.deepEqual([...front.right], [1, 0, 0]);
  assert.deepEqual([...front.forward], [0, 0, -1]);
  const p = front.project([1, 2, 0.5])!;
  assert.deepEqual([p.x, p.y, p.depth], [250, 0, 9.5]);
  // yaw 90 puts the eye on +X, so world -Z is on the screen's right
  const side = camera({ projection: "orthographic", yaw: 90, pitch: 0, zoom: 10, center: [0, 0] });
  assert.deepEqual([...side.eye], [10, 0, 0]);
  assert.equal(side.project([0, 0, -1])!.x, 10);
  assert.equal(side.project([0, 0, -1])!.depth, 10, "depth is exactly 10: multiples of 90 degrees are exact");
  // pitch 90 looks straight down; world -Z is then screen-up (smaller canvas y)
  const top = camera({ projection: "orthographic", yaw: 0, pitch: 90, zoom: 10, center: [0, 0] });
  assert.equal(top.project([0, 0, -1])!.y, -10);
  assert.equal(top.project([1, 0, 0])!.x, 10);
  // roll 90 turns the image clockwise on the canvas: the point at the screen's right moves down
  const rolled = camera({ projection: "orthographic", yaw: 0, pitch: 0, roll: 90, zoom: 10, center: [0, 0] });
  assert.deepEqual([rolled.project([1, 0, 0])!.x, rolled.project([1, 0, 0])!.y], [0, 10]);
  // perspective: unit scale at the target depth, doubling at half the distance
  const persp = camera({ projection: "perspective", yaw: 0, pitch: 0, zoom: 100, distance: 10, center: [0, 0] });
  near(persp.project([1, 0, 0])!.x, 100);
  near(persp.project([1, 0, 5])!.x, 200);
  assert.equal(persp.project([0, 0, 9.9]), null, "nearer than the default near plane (distance / 50)");
  assert.ok(persp.project([0, 0, 9.7]) !== null);
});

test("unproject inverts project and the view direction is unit length toward the eye", () => {
  for (const projection of ["orthographic", "perspective"] as const) {
    const view = camera({ projection, yaw: 33, pitch: -21, roll: 12, zoom: 80, distance: 7, target: [1, 2, 3], center: [320, 240] });
    const world: Vec3 = [0.4, -1.1, 2.2], projected = view.project(world)!;
    const back = view.unproject(projected.x, projected.y, projected.depth);
    for (let k = 0; k < 3; k++) near(back[k], world[k], 1e-12);
    near(Math.hypot(...view.viewDirection(world)), 1, 1e-12);
    const target = view.project([1, 2, 3])!;
    near(target.x, 320, 1e-12); near(target.y, 240, 1e-12); near(target.depth, 7, 1e-12);
  }
  assert.throws(() => camera({ zoom: 0 }), /zoom must be a positive/);
  assert.throws(() => camera({ projection: "fisheye" as never }), /orthographic/);
});

// ------------------------------------------------------------------------------------------------ Sampling

test("surface samples: barycentric identity, plane membership, normals, and attribute interpolation", () => {
  const plane = terrainMesh({ width: 4, depth: 2, columns: 4, rows: 2, height: (x, z) => 0.5 * x - 0.25 * z });
  const samples = sampleSurface(plane, { seed: 5, count: 500, attributes: ["height"] });
  const normal = faceNormal(plane, 0), height = pointAttribute(samples, "height").values;
  for (let k = 0; k < samples.count; k++) {
    const source = sampleSource(samples, k), position = pointPosition(samples, k);
    const [w0, w1, w2] = source.barycentric;
    assert.ok(w0 >= 0 && w1 >= 0 && w2 >= 0);
    near(w0 + w1 + w2, 1, 1e-14);
    const tri = meshFace(plane, source.face);
    assert.ok(tri.length === 4);
    near(position[1], 0.5 * position[0] - 0.25 * position[2], 1e-12);
    near(height[k], position[1], 1e-12);
    assert.ok(Math.abs(dot(normal, sub(position, meshVertex(plane, tri[0])))) < 1e-12);
    assert.ok(position[0] >= -2 - 1e-12 && position[0] <= 2 + 1e-12 && position[2] >= -1 - 1e-12 && position[2] <= 1 + 1e-12);
  }
  assert.throws(() => sampleSurface(plane, { seed: 1, count: 3, attributes: ["nope"] }), /no attribute "nope"/);
  assert.throws(() => sampleSurface(plane, { seed: 1, count: POINT_LIMITS.maxPoints + 1 }), /reduce count/);
});

test("PREFIX PROPERTY: the first n samples of a longer run are exactly the shorter run", () => {
  const m = figureMesh();
  for (const distribution of ["even", "random"] as const) for (const normals of ["face", "smooth"] as const) {
    const long = sampleSurface(m, { seed: 11, count: 900, distribution, normals }), short = sampleSurface(m, { seed: 11, count: 137, distribution, normals });
    for (let k = 0; k < 137; k++) {
      assert.deepEqual([...pointPosition(short, k)], [...pointPosition(long, k)], `${distribution} sample ${k}`);
      assert.deepEqual(sampleSource(short, k), sampleSource(long, k));
      assert.equal(pointId(short, k), pointId(long, k));
      assert.equal(pointSeed(short, k), pointSeed(long, k));
    }
    assert.notDeepEqual([...pointPosition(sampleSurface(m, { seed: 12, count: 5, distribution, normals }), 0)], [...pointPosition(short, 0)]);
  }
});

test("samples are area weighted: per-face counts follow the areas and the even distribution is more regular than random", () => {
  // two triangles with areas 1 and 3 in one mesh
  const m = mesh({ id: "areas", positions: [0, 0, 0, 2, 0, 0, 0, 1, 0, 10, 0, 0, 16, 0, 0, 10, 1, 0], triangles: [0, 1, 2, 3, 4, 5] });
  near(meshMeasures(m).area, 3 + 1);
  const count = 4000, even = sampleSurface(m, { seed: 3, count, distribution: "even" }), random = sampleSurface(m, { seed: 3, count, distribution: "random" });
  const share = (s: typeof even) => Array.from({ length: count }, (_, k) => sampleSource(s, k).face).filter((f) => f === 1).length;
  assert.ok(Math.abs(share(even) - 3000) <= 3, `even split ${share(even)}`);
  assert.ok(Math.abs(share(random) - 3000) <= 5 * Math.sqrt(count * 0.75 * 0.25), `random split ${share(random)}`);
  // within a single unit right triangle, the four midpoint sub-triangles each get a quarter
  const unit = mesh({ id: "unit", positions: [0, 0, 0, 1, 0, 0, 0, 0, 1], triangles: [0, 1, 2] });
  const quarter = (s: typeof even) => {
    const bins = [0, 0, 0, 0];
    for (let k = 0; k < s.count; k++) {
      const [x, , z] = pointPosition(s, k);
      bins[x + z < 0.5 ? 0 : x > 0.5 ? 1 : z > 0.5 ? 2 : 3]++;
    }
    return bins;
  };
  const n = 4096, e = quarter(sampleSurface(unit, { seed: 9, count: n })), r = quarter(sampleSurface(unit, { seed: 9, count: n, distribution: "random" }));
  const spread = (b: number[]) => Math.max(...b.map((c) => Math.abs(c - n / 4)));
  assert.ok(spread(e) <= 12, `even quarters ${e}`);
  assert.ok(spread(r) <= 5 * Math.sqrt(n * 0.25 * 0.75), `random quarters ${r}`);
  assert.ok(spread(e) < spread(r));
});

test("sampling a sphere: samples lie on the polyhedron, face normals point outward and smooth normals are radial", () => {
  const sphere = icosphereMesh(3), samples = sampleSurface(sphere, { seed: 2, count: 800, normals: "smooth" }), smooth = pointCloudData(samples).normals!;
  for (let k = 0; k < samples.count; k++) {
    const p = pointPosition(samples, k), r = Math.hypot(...p);
    assert.ok(r <= 1 + 1e-12 && r >= Math.cos(0.1), "inside the unit sphere and outside its inscribed radius");
    assert.ok(dot([smooth[k * 3], smooth[k * 3 + 1], smooth[k * 3 + 2]], p.map((c) => c / r)) > 0.999, "the blended vertex normal is radial");
  }
  const flat = sampleSurface(sphere, { seed: 2, count: 800 });
  for (let k = 0; k < flat.count; k++) { const s = sampleSource(flat, k), n = faceNormal(sphere, s.face); assert.ok(dot(n, pointPosition(flat, k)) > 0.99, "face normals of a sphere point outward"); }
});

// ------------------------------------------------------------------------------------------------ Point clouds

test("point clouds validate, keep ids under thinning and cropping, and thin by a prefix-stable rank", () => {
  assert.throws(() => pointCloud({ id: "c", positions: [0, 0, 0, 1, 1] }), /multiple of 3/);
  assert.throws(() => pointCloud({ id: "c", positions: [0, 0, 0], normals: [0, 0, 2] }), /normal of point 0 is not a unit vector/);
  assert.throws(() => pointCloud({ id: "c", positions: [0, 0, NaN] }), /positions\[2\] \(point 0\)/);
  assert.throws(() => pointCloud({ id: "c", positions: [0, 0, 0], attributes: [{ name: "w", size: 1, values: [1, 2] }] }), /attribute "w" has 2 values/);
  const cloud = pointCloud({ id: "line", seed: 7, positions: Array.from({ length: 20 }, (_, i) => [i, 0, 0]).flat(), attributes: [{ name: "t", size: 1, values: Array.from({ length: 20 }, (_, i) => i / 19) }] });
  assert.equal(cloud.count, 20);
  assert.equal(pointId(cloud, 3), "p:3");
  assert.equal(pointSeed(cloud, 3), componentSeed(7, "p:3", "point"));
  const smaller = thinPointCloud(cloud, { seed: 4, count: 6 }), larger = thinPointCloud(cloud, { seed: 4, count: 7 });
  const ids = (c: typeof cloud) => Array.from({ length: c.count }, (_, i) => pointId(c, i));
  assert.equal(smaller.count, 6);
  assert.ok(ids(smaller).every((id) => ids(larger).includes(id)), "the count-6 set is inside the count-7 set");
  assert.notDeepEqual(ids(thinPointCloud(cloud, { seed: 5, count: 6 })), ids(smaller));
  const cropped = cropPointCloud(cloud, [4, -1, -1], [8, 1, 1]);
  assert.deepEqual(ids(cropped), ["p:4", "p:5", "p:6", "p:7", "p:8"]);
  assert.equal(pointSeed(cropped, 0), pointSeed(cloud, 4), "cropping never re-seeds");
  assert.deepEqual([...pointPosition(cropped, 2)], [6, 0, 0]);
  const chosen = selectPoints(cloud, [2, 9]);
  assert.deepEqual(ids(chosen), ["p:2", "p:9"]);
  assert.throws(() => selectPoints(cloud, [3, 2]), /strictly ascending/);
  const again = (id: string, seed: number) => pointCloud({ id, seed, positions: Array.from({ length: 20 }, (_, i) => [i, 0, 0]).flat(), attributes: [{ name: "t", size: 1, values: Array.from({ length: 20 }, (_, i) => i / 19) }] });
  assert.equal(again("other", 7).key, cloud.key, "the id is a label, not content");
  assert.notEqual(again("line", 8).key, cloud.key, "the seed is content: it names the points' streams");
});

test("projecting points: far-to-near painter order, crop, facing, back-face culling and the near plane", () => {
  const cloud = pointCloud({ id: "p", positions: [0, 0, 0, 0, 0, 2, 0, 0, -3, 5, 0, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, -1, 1, 0, 0] });
  const view = camera({ projection: "orthographic", yaw: 0, pitch: 0, zoom: 10, distance: 10, center: [100, 100] });
  const all = projectPoints(cloud, view);
  assert.deepEqual(all.map((p) => p.index), [0, 1, 2, 3]);
  assert.deepEqual(all.map((p) => p.depth), [10, 8, 13, 10]);
  assert.deepEqual(projectPoints(cloud, view, { order: "far-to-near" }).map((p) => p.index), [2, 0, 3, 1], "farthest first; ties by index");
  assert.deepEqual(projectPoints(cloud, view, { order: "near-to-far" }).map((p) => p.index), [1, 0, 3, 2]);
  assert.deepEqual(projectPoints(cloud, view, { crop: [90, 90, 120, 110] }).map((p) => p.index), [0, 1, 2]);
  assert.deepEqual(all.map((p) => p.facing), [1, 1, -1, 0]);
  assert.deepEqual(projectPoints(cloud, view, { cullBackFacing: true }).map((p) => p.index), [0, 1]);
  assert.equal(all[0].seed, pointSeed(cloud, 0));
  const persp = camera({ projection: "perspective", yaw: 0, pitch: 0, zoom: 10, distance: 10, center: [0, 0] });
  assert.deepEqual(projectPoints(cloud, persp).map((p) => p.index), [0, 1, 2, 3]);
  const close = pointCloud({ id: "close", positions: [0, 0, 9.95, 0, 0, 9.7, 0, 0, 12] });
  assert.deepEqual(projectPoints(close, persp).map((p) => p.index), [1], "depth 0.05 is inside the near plane (0.2) and depth -2 is behind the eye");
});

// ------------------------------------------------------------------------------------------------ Hidden lines

const orthoFront = camera({ projection: "orthographic", yaw: 0, pitch: 0, zoom: 1, distance: 20, center: [0, 0] });
const edgesOf = (m: Mesh, view = orthoFront) => { const t = meshTopology(m); return meshEdgeCurves(m, t, meshFeatureEdges(m, t, view, { crease: 45, silhouette: false, boundary: false })); };


const between = (curves: readonly { id: string; points: readonly Vec3[] }[], a: Vec3, b: Vec3) => {
  const same = (p: Vec3, q: Vec3) => p[0] === q[0] && p[1] === q[1] && p[2] === q[2];
  const found = curves.filter((c) => (same(c.points[0], a) && same(c.points[c.points.length - 1], b)) || (same(c.points[0], b) && same(c.points[c.points.length - 1], a)));
  assert.equal(found.length, 1, `curve from ${a} to ${b}`);
  return found[0];
};

test("cube behind cube: orthographic hidden lines equal the analytic occlusion", () => {
  const front = boxMesh([2, 2, 2]), back = boxMesh([2, 2, 2], [1, 0, -4]);
  const curves = edgesOf(back);
  assert.equal(curves.length, 12);
  const result = hiddenLines(front, curves, orthoFront), paths = result.paths;
  // seen from +z the eye is at z = 20; depth = 20 - z. The front cube covers x, y in [-1, 1].
  for (const y of [1, -1]) for (const z of [-3, -5]) {
    const edge = between(curves, [0, y, z], [2, y, z]);
    const mine = paths.filter((p) => p.curve === edge.id);
    assert.equal(mine.length, 2, "one hidden run and one visible run");
    const [first, second] = mine[0].points[0][0] < mine[1].points[0][0] ? mine : [mine[1], mine[0]];
    assert.equal(first.visible, false); assert.equal(second.visible, true);
    nearPoints(first.points, [[0, -y], [1, -y]]);
    nearPoints(second.points, [[1, -y], [2, -y]]);
    assert.deepEqual([...first.depths], [20 - z, 20 - z]);
  }
  // the vertical edge at x = 0 lies wholly inside the covered square, the one at x = 2 wholly outside
  for (const z of [-3, -5]) {
    const inside = paths.filter((p) => p.curve === between(curves, [0, -1, z], [0, 1, z]).id), outside = paths.filter((p) => p.curve === between(curves, [2, -1, z], [2, 1, z]).id);
    assert.deepEqual(inside.map((p) => p.visible), [false]);
    assert.deepEqual(outside.map((p) => p.visible), [true]);
  }
  assert.equal(paths.length, 12);
  assert.equal(paths.filter((p) => p.visible).length, 6);
  assert.equal(result.stats.edgeOnRuns, 4, "the four edges along the view axis project to points and are dropped, not returned as dots");
  // a cube against itself, straight on: its front edges lie on its own front face (visible); the back edges are exactly
  // behind that silhouette, so by the closed-region policy they are hidden rather than drawn a second time
  const own = hiddenLines(front, edgesOf(front), orthoFront);
  assert.equal(own.paths.length, 8);
  assert.deepEqual(own.paths.filter((p) => p.visible).map((p) => p.depths[0]).sort(), [19, 19, 19, 19]);
  assert.deepEqual(own.paths.filter((p) => !p.visible).map((p) => p.depths[0]).sort(), [21, 21, 21, 21]);
  // seen from the other side, the roles swap: the far cube's edges are now nearest, the covered part is on the front cube
  const behind = camera({ projection: "orthographic", yaw: 180, pitch: 0, zoom: 1, distance: 20, center: [0, 0] });
  assert.ok(hiddenLines(front, curves, behind).paths.every((p) => p.visible), "the second cube is now in front of the first");
  const swapped = hiddenLines(back, edgesOf(front, behind), behind), horizontals = edgesOf(front, behind);
  for (const y of [1, -1]) for (const z of [1, -1]) {
    const edge = between(horizontals, [-1, y, z], [1, y, z]);
    const mine = swapped.paths.filter((p) => p.curve === edge.id);
    // yaw 180 mirrors x on the screen: the covered world range x in [0, 1] is the screen range [-1, 0]
    nearPoints(mine.filter((p) => !p.visible).map((p) => p.points.map((q) => q[0]).sort((a, b) => a - b)), [[-1, 0]]);
    nearPoints(mine.filter((p) => p.visible).map((p) => p.points.map((q) => q[0]).sort((a, b) => a - b)), [[0, 1]]);
  }
});

test("perspective hidden lines split at the exact central-projection boundary", () => {
  const front = boxMesh([2, 2, 2]), back = boxMesh([2, 2, 2], [1, 0, -4]);
  const view = camera({ projection: "perspective", yaw: 0, pitch: 0, zoom: 1, distance: 20, center: [0, 0], near: 1 });
  const curves = edgesOf(back, view);
  // the front cube's nearest right edge (x = 1, z = 1) projects to 20 / 19; the far cube's edge at depth 20 - z hits it at x = (20 - z) / 19
  for (const z of [-3, -5]) {
    const edge = between(curves, [0, 1, z], [2, 1, z]);
    const runs = hiddenLines(front, [edge], view).paths;
    const visible = runs.filter((p) => p.visible);
    assert.equal(visible.length, 1);
    const scale = 20 / (20 - z), boundary = (20 - z) / 19;
    near(visible[0].points[0][0], boundary * scale, 1e-6);
    near(visible[0].points[1][0], 2 * scale, 1e-9);
    assert.equal(runs.filter((p) => !p.visible).length, 1);
  }
});

test("a long curve behind a many-triangle wall is one hidden run: no cracks at shared edges or diagonals", () => {
  const wall = terrainMesh({ width: 4, depth: 4, columns: 8, rows: 8, height: () => 0 });
  const top = camera({ projection: "orthographic", yaw: 0, pitch: 90, zoom: 1, distance: 20, center: [0, 0] });
  const across = { id: "across", points: [[-1.5, -1, -1.7], [1.5, -1, 1.3]] as Vec3[] };
  const inside = hiddenLines(wall, [across], top);
  assert.deepEqual(inside.paths.map((p) => p.visible), [false]);
  const beyond = hiddenLines(wall, [{ id: "long", points: [[-3, -1, 0.3], [3, -1, 0.3]] }], top).paths;
  assert.deepEqual(beyond.map((p) => p.visible), [true, false, true]);
  // top-down: screen x = world x. The wall spans [-2, 2]
  nearPoints(beyond.map((p) => p.points.map((q) => q[0])), [[-3, -2], [-2, 2], [2, 3]]);
  // a zig-zag polyline crossing the wall's boundary keeps runs continuous through its vertices
  const zig = hiddenLines(wall, [{ id: "zig", points: [[-3, -1, 0], [-1, -1, 1], [1, -1, -1], [3, -1, 0]] }], top).paths;
  assert.deepEqual(zig.map((p) => p.visible), [true, false, true]);
  assert.equal(zig[1].points.length, 4, "the hidden run passes through both interior vertices");
});

test("the tolerance policy: on-surface curves are never hidden by their own faces; depth beyond the tolerance hides", () => {
  const sheet = terrainMesh({ width: 4, depth: 4, columns: 4, rows: 4, height: (x, z) => 0.2 * x + 0.1 * z });
  const top = camera({ projection: "orthographic", yaw: 0, pitch: 90, zoom: 1, distance: 20, center: [0, 0] });
  const t = meshTopology(sheet);
  const surface = meshEdgeCurves(sheet, t, Array.from({ length: t.counts.edges }, (_, e) => e));
  const drawn = hiddenLines(sheet, surface, top);
  assert.ok(drawn.paths.every((p) => p.visible), "every mesh edge, diagonal-free, is visible against its own mesh");
  assert.equal(new Set(drawn.paths.map((p) => p.curve)).size, surface.length);
  const plane = (y: number) => [{ id: "c", points: [[-1, 0.2 * -1 + y, 0], [1, 0.2 + y, 0]] as Vec3[] }];
  const options = { tolerance: 1e-3 };
  assert.deepEqual(hiddenLines(sheet, plane(-1e-4), top, options).paths.map((p) => p.visible), [true], "closer than the tolerance: on the surface");
  assert.deepEqual(hiddenLines(sheet, plane(-1e-2), top, options).paths.map((p) => p.visible), [false], "behind by more than the tolerance");
  assert.deepEqual(hiddenLines(sheet, plane(0.5), top, options).paths.map((p) => p.visible), [true], "in front");
});

test("perspective near plane: segments are clipped, geometry behind the eye occludes nothing", () => {
  const view = camera({ projection: "perspective", yaw: 0, pitch: 0, zoom: 100, distance: 10, center: [0, 0] }); // eye at z = 10, near 0.2
  const floor = terrainMesh({ width: 100, depth: 100, columns: 2, rows: 2, height: () => -1 });
  const through = hiddenLines(boxMesh([0.1, 0.1, 0.1], [50, 50, 50]), [{ id: "through", points: [[0.5, 0, 0], [0.5, 0, 30]] }], view);
  assert.equal(through.stats.clippedSegments, 1);
  assert.equal(through.paths.length, 1);
  near(through.paths[0].depths[0], 10, 1e-12);
  near(through.paths[0].depths[1], 0.2, 1e-12);
  assert.equal(hiddenLines(boxMesh([0.1, 0.1, 0.1], [50, 50, 50]), [{ id: "behind", points: [[0, 0, 11], [0, 0, 30]] }], view).paths.length, 0, "wholly behind the eye");
  // an infinite-ish floor below the eye straddles the near plane and even lies behind the eye; a curve below it is hidden,
  // a curve above it is visible
  const below = hiddenLines(floor, [{ id: "below", points: [[-2, -3, -5], [2, -3, 3]] }], view).paths;
  assert.deepEqual(below.map((p) => p.visible), [false]);
  const above = hiddenLines(floor, [{ id: "above", points: [[-2, 0.5, -5], [2, 0.5, 3]] }], view).paths;
  assert.deepEqual(above.map((p) => p.visible), [true]);
});

test("occluders: open sheets hide from behind under 'all', not under 'front'; both agree on a closed mesh", () => {
  const sheet = terrainMesh({ width: 4, depth: 4, columns: 2, rows: 2, height: () => 0 });
  const underneath = camera({ projection: "orthographic", yaw: 0, pitch: -90, zoom: 1, distance: 20, center: [0, 0] });
  const above = { id: "above", points: [[-1, 1, 0], [1, 1, 0]] as Vec3[] };
  assert.deepEqual(hiddenLines(sheet, [above], underneath).paths.map((p) => p.visible), [false], "the sheet is opaque from both sides");
  assert.deepEqual(hiddenLines(sheet, [above], underneath, { occluders: "front" }).paths.map((p) => p.visible), [true], "back faces are not occluders under 'front'");
  const sphere = icosphereMesh(2);
  let state = 12345;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const curves = Array.from({ length: 30 }, (_, i) => ({ id: `r${i}`, points: Array.from({ length: 4 }, () => [random() * 4 - 2, random() * 4 - 2, random() * 4 - 2] as Vec3) }));
  for (const view of [camera({ projection: "orthographic", yaw: 40, pitch: 25, zoom: 50, distance: 10 }), camera({ projection: "perspective", yaw: -70, pitch: 10, zoom: 50, distance: 8 })]) {
    const all = hiddenLines(sphere, curves, view).paths, front = hiddenLines(sphere, curves, view, { occluders: "front" }).paths;
    assert.equal(all.length, front.length);
    all.forEach((p, i) => {
      assert.equal(p.visible, front[i].visible);
      p.points.forEach((q, k) => { near(q[0], front[i].points[k][0], 1e-9); near(q[1], front[i].points[k][1], 1e-9); });
    });
    assert.ok(all.some((p) => !p.visible) && all.some((p) => p.visible));
  }
});

test("a sphere hides exactly the part of a ring behind its silhouette", () => {
  const sphere = icosphereMesh(3), view = orthoFront;
  const R = 1.5, ring = Array.from({ length: 721 }, (_, i) => [R * Math.cos(i * Math.PI / 360), 0, R * Math.sin(i * Math.PI / 360)] as Vec3);
  const result = hiddenLines(sphere, [{ id: "ring", points: ring.slice(0, 720), closed: true }], view);
  const hidden = result.paths.filter((p) => !p.visible);
  assert.equal(hidden.length, 1);
  // the ring's far half (z < 0) is hidden where |x| is under the sphere's silhouette half-width at y = 0, which lies between
  // the polyhedron's inradius and the circumradius of 1
  const inradius = Math.min(...Array.from({ length: sphere.faceCount }, (_, f) => Math.abs(dot(faceNormal(sphere, f), meshVertex(sphere, meshFace(sphere, f)[0])))));
  const xs = hidden[0].points.map((q) => q[0]), reach = Math.max(...xs.map(Math.abs));
  assert.ok(reach <= 1 + 1e-9 && reach >= inradius - 1e-9, `hidden reach ${reach} not in [${inradius}, 1]`);
  assert.ok(hidden[0].depths.every((d) => d >= 20), "only ring points behind the centre plane are hidden");
  for (const p of result.paths.filter((q) => q.visible)) assert.ok(p.points.every(([x], i) => Math.abs(x) >= inradius - 1e-9 || p.depths[i] <= 20 + 1e-9));
});

test("a cube's edges against itself: nine visible, three hidden, none partial (ortho and perspective)", () => {
  const cube = boxMesh([2, 2, 2]);
  for (const view of [camera({ projection: "orthographic", yaw: 30, pitch: 20, zoom: 50 }), camera({ projection: "perspective", yaw: 30, pitch: 20, zoom: 50, distance: 9 })]) {
    const t = meshTopology(cube), curves = meshEdgeCurves(cube, t, meshFeatureEdges(cube, t, view, { crease: 45, silhouette: false, boundary: false }));
    const result = hiddenLines(cube, curves, view);
    assert.equal(result.paths.length, 12, "every edge is wholly one or the other");
    assert.equal(result.paths.filter((p) => p.visible).length, 9);
    assert.equal(result.paths.filter((p) => !p.visible).length, 3);
    // the three hidden edges meet at the corner farthest from the eye
    const far = curves.filter((c) => result.paths.find((p) => p.curve === c.id && !p.visible)).flatMap((c) => c.points);
    const counts = new Map<string, number>();
    for (const p of far) counts.set(p.join(), (counts.get(p.join()) ?? 0) + 1);
    assert.equal([...counts.values()].filter((n) => n === 3).length, 1);
  }
});

test("hidden-line work is bounded and inputs are validated by name", () => {
  const sphere = icosphereMesh(3);
  const curves = Array.from({ length: 200 }, (_, i) => ({ id: `c${i}`, points: [[-2, -1 + i / 100, -2], [2, -1 + i / 100, 2]] as Vec3[] }));
  assert.throws(() => hiddenLines(sphere, curves, orthoFront, { maxWork: 100 }), /maxWork = 100/);
  assert.throws(() => hiddenLines(sphere, [curves[0], curves[0]], orthoFront), /"c0" is repeated/);
  assert.throws(() => hiddenLines(sphere, [{ id: "x", points: [[0, 0, 0]] }], orthoFront), /needs at least two points/);
  assert.throws(() => hiddenLines(sphere, [{ id: "x", points: [[0, 0, 0], [0, NaN, 0]] }], orthoFront), /point 1 must be three finite numbers/);
  assert.throws(() => hiddenLines(sphere, curves, orthoFront, { tolerance: -1 }), /non-negative/);
  assert.deepEqual(hiddenLines(sphere, curves.slice(0, 5), orthoFront).paths.map((p) => p.id), hiddenLines(sphere, curves.slice(0, 5), orthoFront).paths.map((p) => p.id));
});

test("which points a mesh hides: samples on a sphere are visible exactly where they face the eye", () => {
  const sphere = icosphereMesh(3), samples = sampleSurface(sphere, { seed: 8, count: 600, normals: "smooth" });
  for (const view of [camera({ projection: "orthographic", yaw: 25, pitch: 35, zoom: 50, distance: 10 }), camera({ projection: "perspective", yaw: -100, pitch: 5, zoom: 50, distance: 7 })]) {
    const seen = visiblePoints(sphere, samples, view), projected = projectPoints(samples, view);
    let checked = 0;
    for (const p of projected) {
      if (p.facing! > 0.2) { assert.equal(seen[p.index], 1, `sample ${p.index} faces the eye`); checked++; }
      if (p.facing! < -0.2) { assert.equal(seen[p.index], 0, `sample ${p.index} faces away`); checked++; }
    }
    assert.ok(checked > 400);
  }
});

// ------------------------------------------------------------------------------------------------ Painter order

const triangles = (id: string, ...tris: number[][]) => mesh({ id, positions: tris.flat(), triangles: tris.map((_, i) => [i * 3, i * 3 + 1, i * 3 + 2]).flat() });

test("painter order: the farther of two overlapping triangles is painted first, whatever the mesh order", () => {
  const nearTri = [-1, -1, 1, 1, -1, 1, 0, 1, 1], farTri = [-1, -1, -1, 1, -1, -1, 0, 1, -1];
  for (const parts of [[nearTri, farTri], [farTri, nearTri]]) {
    const m = triangles("two", ...parts), result = paintOrder(m, orthoFront);
    const nearIndex = parts.indexOf(nearTri);
    assert.deepEqual([...result.order], [1 - nearIndex, nearIndex]);
    assert.equal(result.exact, true);
    assert.equal(result.constraints, 1);
  }
  assert.equal(paintOrder(triangles("apart", nearTriAt(0), nearTriAt(5)), orthoFront).overlapping, 0);
});
function nearTriAt(x: number) { return [x - 1, -1, 1, x + 1, -1, 1, x, 1, 1]; }

test("painter order reports what it cannot order: intersecting pairs and cyclic overlaps", () => {
  // two triangles piercing each other: no consistent order exists over the overlap
  const pierce = paintOrder(mesh({ id: "pierce", positions: [-1, -1, -1, 1, -1, -1, 0, 1, 1, -1, 1, -1, 1, 1, -1, 0, -1, 1], triangles: [0, 1, 2, 3, 4, 5] }), orthoFront);
  assert.equal(pierce.undecided, 1);
  assert.equal(pierce.exact, false);
  // three bars laid along a triangle's sides, each tilted so it is in front of the next at their shared corner: A over B, B over C,
  // C over A. No painting order exists; the rule must say so instead of pretending.
  const corners = [0, 1, 2].map((k) => [2 * Math.cos(k * 2 * Math.PI / 3), 2 * Math.sin(k * 2 * Math.PI / 3)]);
  const bars: number[][] = [];
  for (let k = 0; k < 3; k++) {
    const [a, b] = [corners[k], corners[(k + 1) % 3]], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    const nx = -dy / len * 0.25, ny = dx / len * 0.25, ex = dx / len * 0.3, ey = dy / len * 0.3;
    const p0 = [a[0] - ex + nx, a[1] - ey + ny, 1], p1 = [b[0] + ex + nx, b[1] + ey + ny, -1], p2 = [b[0] + ex - nx, b[1] + ey - ny, -1], p3 = [a[0] - ex - nx, a[1] - ey - ny, 1];
    bars.push(p0, p1, p2, p0, p2, p3);
  }
  const cyc = paintOrder(mesh({ id: "cycle", positions: bars.flat(), triangles: bars.map((_, i) => i) }), orthoFront);
  assert.ok(cyc.constraints >= 3 && cyc.undecided === 0, "every overlapping pair has a definite order");
  assert.ok(cyc.cycleBreaks >= 1);
  assert.equal(cyc.exact, false);
  assert.equal(cyc.order.length, 6);
});

/** Möller-Trumbore ray hits of one triangle, independent of the library's own depth interpolation. */
function rayHit(origin: Vec3, direction: Vec3, a: Vec3, b: Vec3, c: Vec3): number | null {
  const e1 = sub(b, a), e2 = sub(c, a), p = cross(direction, e2), det = dot(e1, p);
  if (Math.abs(det) < 1e-14) return null;
  const inv = 1 / det, tv = sub(origin, a), u = dot(tv, p) * inv;
  if (u < 1e-9 || u > 1 - 1e-9) return null;
  const q = cross(tv, e1), v = dot(direction, q) * inv;
  if (v < 1e-9 || u + v > 1 - 1e-9) return null;
  return dot(e2, q) * inv;
}

test("painter order is far-to-near along every ray for convex, multi-part and non-convex meshes (independent ray casting)", () => {
  const steep = camera({ projection: "orthographic", yaw: 25, pitch: 32, zoom: 100, distance: 12, center: [0, 0] });
  const grazing = camera({ projection: "orthographic", yaw: 25, pitch: 6, zoom: 100, distance: 12, center: [0, 0] });
  for (const [name, m, view] of [["sphere", icosphereMesh(2), steep], ["figure", figureMesh(), steep], ["terrain", bundledMesh("terrain", { detail: 2, seed: 4, variant: "ridges" }), grazing], ["torus", torusMesh({ u: 24, v: 12 }), steep]] as const) {
    const result = paintOrder(m, view);
    assert.equal(result.exact, true, `${name} is exactly orderable at this view`);
    const rank = new Map<number, number>();
    result.order.forEach((t, i) => rank.set(t, i));
    const data = (m as Mesh), stored = Array.from({ length: data.faceCount }, (_, f) => meshFace(data, f));
    // triangulate faces the same way the mesh does (shorter diagonal) by reading the mesh's own triangle list through vertex triples
    const tris: [number, number, number][] = [];
    for (const face of stored) {
      if (face.length === 3) tris.push([face[0], face[1], face[2]]);
      else {
        const p = (i: number) => meshVertex(data, face[i]), d = (i: number, j: number) => Math.hypot(...sub(p(i), p(j)));
        if (d(0, 2) <= d(1, 3)) tris.push([face[0], face[1], face[2]], [face[0], face[2], face[3]]); else tris.push([face[0], face[1], face[3]], [face[1], face[2], face[3]]);
      }
    }
    assert.equal(tris.length, m.triangleCount);
    let state = 99, pairs = 0;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    for (let r = 0; r < 300; r++) {
      const origin = view.unproject((random() - 0.5) * 300, (random() - 0.5) * 300, 0), hits: { t: number; tri: number }[] = [];
      tris.forEach(([a, b, c], tri) => { const t = rayHit(origin, view.forward, meshVertex(data, a), meshVertex(data, b), meshVertex(data, c)); if (t !== null) hits.push({ t, tri }); });
      hits.sort((x, y) => y.t - x.t);
      for (let i = 0; i + 1 < hits.length; i++) if (hits[i].t - hits[i + 1].t > 1e-7) { assert.ok(rank.get(hits[i].tri)! < rank.get(hits[i + 1].tri)!, `${name}: triangle ${hits[i].tri} is farther than ${hits[i + 1].tri}`); pairs++; }
    }
    assert.ok(pairs > 20, `${name}: enough overlapping pairs were checked (${pairs})`);
  }
});

test("painter order can drop back faces of a closed mesh and reports the counts", () => {
  const cube = boxMesh([2, 2, 2]), view = camera({ projection: "orthographic", yaw: 30, pitch: 20 });
  const all = paintOrder(cube, view), culled = paintOrder(cube, view, { cull: "back" });
  assert.equal(all.order.length, 12);
  assert.equal(culled.order.length, 6);
  assert.equal(culled.culled, 6);
  assert.equal(all.exact && culled.exact, true);
  assert.throws(() => paintOrder(cube, view, { maxWork: 3 }), /maxWork = 3/);
});

test("closed curves come back closed when wholly visible and merge across their start vertex when a run spans it", () => {
  const wall = terrainMesh({ width: 4, depth: 4, columns: 4, rows: 4, height: () => 0 });
  const top = camera({ projection: "orthographic", yaw: 0, pitch: 90, zoom: 1, distance: 20, center: [0, 0] });
  // a square loop of side 2 at y = -1, its first vertex at the corner (-1, -1): entirely under the wall
  const under = hiddenLines(wall, [{ id: "under", closed: true, points: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] }], top).paths;
  assert.equal(under.length, 1);
  assert.equal(under[0].visible, false);
  assert.equal(under[0].closed, true);
  assert.equal(under[0].points.length, 4, "no duplicated closing point");
  const above = hiddenLines(wall, [{ id: "above", closed: true, points: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]] }], top).paths;
  assert.deepEqual(above.map((p) => [p.visible, p.closed, p.points.length]), [[true, true, 4]]);
  // a loop poking out of the wall's edge x = 2 on the right: two runs of the same kind that meet at vertex 0 are one path
  const poke = hiddenLines(wall, [{ id: "poke", closed: true, points: [[0, -1, 0], [3, -1, 0], [3, -1, 1], [0, -1, 1]] }], top).paths;
  assert.deepEqual(poke.map((p) => p.visible).sort(), [false, true]);
  const hidden = poke.find((p) => !p.visible)!;
  assert.equal(hidden.closed, false);
  // the hidden part is the piece of the loop inside x <= 2, which passes through the start vertex: (2,1) -> (0,1) -> (0,0) -> (2,0)
  assert.equal(hidden.points.length, 4);
  assert.equal(hidden.points.filter((q) => Math.abs(q[0]) < 1e-9).length, 2, "both vertices at x = 0 are inside one run");
});

test("edge curves chain through degree-two vertices only, split by tone, with stable ids", () => {
  const cube = boxMesh([2, 2, 2]), t = meshTopology(cube);
  const twelve = meshEdgeCurves(cube, t, Array.from({ length: 12 }, (_, e) => e));
  assert.equal(twelve.length, 12, "every vertex has three edges: no chain runs through one");
  assert.ok(twelve.every((c) => c.points.length === 2 && !c.closed));
  const grid = terrainMesh({ width: 2, depth: 2, columns: 3, rows: 3, height: () => 0 }), gt = meshTopology(grid);
  const rim = meshEdgeCurves(grid, gt, meshBoundaryEdges(gt));
  assert.equal(rim.length, 1);
  assert.equal(rim[0].closed, true);
  assert.equal(rim[0].points.length, 12, "a 3 x 3 sheet has twelve rim vertices");
  assert.equal(rim[0].id, meshEdgeCurves(grid, gt, [...meshBoundaryEdges(gt)].reverse())[0].id, "ids do not depend on the order edges are supplied");
  // grouping by tone: the same rim split into two tones is two open chains that each carry their tone
  const edges = meshBoundaryEdges(gt), tones = meshEdgeCurves(grid, gt, edges.map((edge, i) => ({ edge, tone: (i < 6 ? 0 : 1) as 0 | 1, crease: false, silhouette: false, boundary: true })));
  assert.deepEqual(tones.map((c) => c.tone).sort(), [0, 1]);
  assert.ok(tones.every((c) => !c.closed));
  // features picked for a camera carry tones: silhouette 1 over crease 0
  const view = camera({ projection: "orthographic", yaw: 30, pitch: 20 });
  const features = meshEdgeCurves(cube, t, meshFeatureEdges(cube, t, view, { crease: 45, silhouette: true, boundary: false }));
  assert.deepEqual([...new Set(features.map((c) => c.tone))].sort(), [0, 1]);
  const outline = features.filter((c) => c.tone === 1);
  assert.deepEqual(outline.map((c) => [c.closed, c.points.length]), [[true, 6]], "the six silhouette edges are one closed loop");
  assert.equal(features.filter((c) => c.tone === 0).length, 6, "the other six edges meet only at the two corners");
});

test("merging keeps attributes aligned, refuses mismatched sets, and vertex clouds keep vertex identity", () => {
  const a = vaseMesh({ profile: "urn", slices: 8 }), b = transformMesh(a, { translate: [5, 0, 0] });
  const merged = mergeMeshes("pair", [a, b]);
  assert.deepEqual([...meshAttribute(merged, "band").values], [...meshAttribute(a, "band").values, ...meshAttribute(b, "band").values]);
  assert.throws(() => mergeMeshes("bad", [a, boxMesh([1, 1, 1])]), /has attributes \[\] but "vase-urn-8" has \[band:face:1,cell:face:1,kind:face:1\]|has attributes/);
  const cloud = meshVertexCloud(boxMesh([2, 2, 2]));
  assert.equal(cloud.count, 8);
  assert.equal(pointId(cloud, 5), "p:5");
  const [x, y, z] = pointCloudData(cloud).normals!.slice(0, 3);
  near(Math.hypot(x, y, z), 1, 1e-12);
  near(Math.abs(x) + Math.abs(y) + Math.abs(z), Math.sqrt(3), 1e-12), "a cube corner's vertex normal points along a body diagonal";
  // slivers below the documented relative area threshold are degenerate, slightly fatter ones are not
  const sliver = (h: number) => mesh({ id: "s", positions: [0, 0, 0, 1, 0, 0, 0.5, h, 0], triangles: [0, 1, 2] });
  assert.throws(() => sliver(1e-13), /zero area/);
  assert.equal(sliver(1e-9).faceCount, 1);
});

test("renderer corner attributes come from the retained surface-attribute operation", () => {
  const cube = boxMesh([2, 2, 2]), flat = meshCornerAttributes(cube, { normals: "flat" }), smooth = meshCornerAttributes(cube, { normals: "smooth" });
  assert.equal(flat.positions.length, 3 * 3 * 12, "twelve triangles, three unwelded corners each");
  assert.equal(smooth.positions.length, 3 * 8, "one output vertex per cube corner");
  for (let c = 0; c < 8; c++) {
    const n = [smooth.normals[c * 3], smooth.normals[c * 3 + 1], smooth.normals[c * 3 + 2]];
    near(Math.hypot(...n), 1, 1e-12);
    for (const k of [0, 1, 2]) assert.ok(Math.abs(Math.abs(n[k]) - 1 / Math.sqrt(3)) < 0.35, "each corner normal leans along a body diagonal or close to it");
    assert.ok(dot(n, [smooth.positions[c * 3], smooth.positions[c * 3 + 1], smooth.positions[c * 3 + 2]]) > 0, "and points away from the centre");
  }
  // flat normals equal the face normals of the quads that own each triangle
  for (let t = 0; t < 12; t++) {
    const face = Math.floor(t / 2), n = faceNormal(cube, face) as Vec3;
    for (let k = 0; k < 3; k++) near(dot([flat.normals[(t * 3 + k) * 3], flat.normals[(t * 3 + k) * 3 + 1], flat.normals[(t * 3 + k) * 3 + 2]], n), 1, 1e-12);
  }
  // the analysis normal is angle weighted, so on a cube corner it is exactly the body diagonal; the renderer's sum of
  // triangle normals double counts the quad diagonal's end corners, so it is skewed there (documented, not a defect)
  const analysis = vertexNormals(cube);
  for (let v = 0; v < 8; v++) for (let k = 0; k < 3; k++) near(Math.abs(analysis[v * 3 + k]), 1 / Math.sqrt(3), 1e-12);
  let skewed = 0;
  for (let c = 0; c < 8; c++) {
    const v = smooth.sourceVertex[c];
    assert.deepEqual([smooth.positions[c * 3], smooth.positions[c * 3 + 1], smooth.positions[c * 3 + 2]], [...meshVertex(cube, v)]);
    if (dot([analysis[v * 3], analysis[v * 3 + 1], analysis[v * 3 + 2]], [smooth.normals[c * 3], smooth.normals[c * 3 + 1], smooth.normals[c * 3 + 2]]) < 1 - 1e-9) skewed++;
  }
  assert.ok(skewed > 0);
});

test("descriptors round-trip through JSON and resolve to the same content; bad ones fail by name", () => {
  const bundled = { kind: "bundled", id: "terrain", detail: 2, seed: 7, variant: "dunes" } as const;
  const again = JSON.parse(JSON.stringify(bundled));
  assert.equal(resolveMeshSource(again).key, resolveMeshSource(bundled).key);
  const owned = { kind: "data", data: { id: "tri", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], triangles: [0, 1, 2] } } as const;
  assert.equal(resolveMeshSource(JSON.parse(JSON.stringify(owned))).faceCount, 1);
  const samples = { kind: "samples", mesh: bundled, sampling: { seed: 3, count: 50, distribution: "even" } } as const;
  const cloud = resolvePointSource(JSON.parse(JSON.stringify(samples)));
  assert.equal(cloud.count, 50);
  assert.equal(cloud.key, resolvePointSource(samples).key);
  assert.throws(() => resolveMeshSource({ kind: "file", path: "x.obj" } as never), /"bundled" or "data" \(got file\)/);
  assert.throws(() => resolveMeshSource({ kind: "bundled", id: "teapot" } as never), /Unknown bundled mesh "teapot"/);
  assert.throws(() => resolvePointSource({ kind: "samples", mesh: bundled, sampling: { seed: 1, count: -1 } }), /count must be an integer in 0\.\.200000/);
  assert.equal(resolvePointSource({ kind: "data", data: { id: "p", positions: [0, 0, 0] } }).count, 1);
});
