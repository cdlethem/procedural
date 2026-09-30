import assert from "node:assert/strict";
import test from "node:test";
import {
  boxMesh, bundledMesh, hiddenLines, icosphereMesh, isoContours, mergeMeshes, mesh, meshData, meshTopology, meshFace, planeFrame, sectionDomain, sectionMesh, sliceCurves,
  sliceMesh, slicePlanes, terrainMesh, torusMesh, transformMesh, vaseMesh, vaseProfiles, camera, DEFAULT_SECTION_WORK, SECTION_LIMITS,
  type Mesh, type MeshSection, type SectionPlane, type Vec3,
} from "../dist/index.js";

const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const horizontal = (y: number, id = "h"): SectionPlane => ({ id, point: [0, y, 0], normal: [0, 1, 0] });
const only = (section: MeshSection) => { assert.equal(section.loops.length, 1, `expected one loop, got ${section.loops.length}`); return section.loops[0]; };
function mulberry(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test("the plane frame is orthonormal and right-handed: u x v = n, u along the axis n is smallest on", () => {
  const flat = planeFrame({ point: [0, 0, 0], normal: [0, 5, 0] });
  assert.deepEqual([...flat.u], [1, 0, 0]);
  assert.deepEqual([...flat.v], [0, 0, -1]);
  assert.deepEqual([...flat.normal], [0, 1, 0]);
  for (const normal of [[1, 2, 3], [-0.3, 0.1, 0.9], [0, 0, -1], [1, 1, 0]] as Vec3[]) {
    const f = planeFrame({ point: [1, 2, 3], normal });
    near(Math.hypot(...f.u), 1, 1e-14); near(Math.hypot(...f.v), 1, 1e-14); near(Math.hypot(...f.normal), 1, 1e-14);
    near(dot(f.u, f.v), 0, 1e-14); near(dot(f.u, f.normal), 0, 1e-14);
    const c = cross(f.u, f.v);
    for (let k = 0; k < 3; k++) near(c[k], f.normal[k], 1e-14);
  }
  assert.throws(() => planeFrame({ point: [0, 0, 0], normal: [0, 0, 0] }), /zero vector/);
  assert.throws(() => planeFrame({ point: [0, NaN, 0], normal: [0, 1, 0] }), /point must be three finite numbers/);
});

test("a cube cut through its middle is a square: exact area, provenance on edges, diagonals and faces", () => {
  const cube = boxMesh([2, 2, 2]), section = sectionMesh(cube, horizontal(0)), loop = only(section);
  assert.equal(loop.closed, true);
  assert.equal(loop.ends, null);
  near(loop.area, 4, 1e-14);
  near(loop.length, 8, 1e-14);
  assert.equal(section.closedCount, 1);
  assert.equal(loop.points.length, 8, "four corners and the four side-face diagonal crossings");
  assert.equal(loop.nodes.filter((n) => n.diagonal).length, 4);
  for (const q of loop.points) { assert.equal(q[1], 0); assert.equal(Math.max(Math.abs(q[0]), Math.abs(q[2])), 1); }
  for (const node of loop.nodes) {
    assert.ok(node.edge[0] < node.edge[1]);
    assert.equal(node.vertex, -1, "no vertex lies on the plane");
    near(node.t, 0.5, 1e-15);
  }
  // each segment lies in a side face (the top and bottom faces are never crossed), two segments per face
  const counts = new Map<number, number>();
  for (const f of loop.faces) counts.set(f, (counts.get(f) ?? 0) + 1);
  assert.equal(loop.faces.length, 8);
  assert.equal(counts.size, 4);
  for (const [face, n] of counts) { assert.equal(n, 2); assert.equal(meshFace(cube, face).length, 4); }
  // every node's edge belongs to the face of the segment that leaves it
  loop.nodes.forEach((node, k) => { const face = meshFace(cube, loop.faces[k]); assert.ok(face.includes(node.edge[0]) && face.includes(node.edge[1])); });
  assert.equal(loop.id, `h/t${loop.id.split("/t")[1]}`);
  assert.equal(section.frame.normal[1], 1);
});

test("hexagon and corner cuts of a cube have the analytic areas", () => {
  const cube = boxMesh([2, 2, 2]);
  const hex = only(sectionMesh(cube, { point: [0, 0, 0], normal: [1, 1, 1] }));
  near(hex.area, 3 * Math.sqrt(3), 1e-13);
  for (const q of hex.points) { near(q[0] + q[1] + q[2], 0, 1e-15); assert.ok(Math.max(...q.map(Math.abs)) <= 1 + 1e-15); }
  // x + y + z = 3 - c cuts an equilateral triangle of side c sqrt(2) off the corner (1,1,1)
  for (const c of [0.5, 1, 2]) {
    const corner = only(sectionMesh(cube, { point: [1, 1, 1 - c], normal: [1, 1, 1] }));
    near(corner.area, Math.sqrt(3) / 2 * c * c, 1e-13);
    for (const expected of [[1, 1, 1 - c], [1, 1 - c, 1], [1 - c, 1, 1]])
      assert.ok(corner.points.some((q) => Math.hypot(q[0] - expected[0], q[1] - expected[1], q[2] - expected[2]) < 1e-14), `corner point ${expected}`);
  }
  // a cut that only touches the corner leaves nothing but a counted degenerate contact
  const touch = sectionMesh(cube, { point: [1, 1, 1], normal: [1, 1, 1] });
  assert.equal(touch.loops.length, 0);
  assert.equal(touch.degenerate, 1);
  assert.equal(sectionMesh(cube, { point: [2, 2, 2], normal: [1, 1, 1] }).loops.length, 0);
  // touching along an edge (plane x + y = 2) is also only a contact
  assert.equal(sectionMesh(cube, { point: [1, 1, 0], normal: [1, 1, 0] }).loops.length, 0);
});

test("vertices on the plane follow the stated tie policy; coplanar faces add no segments", () => {
  const cube = boxMesh([2, 2, 2]);
  const top = sectionMesh(cube, horizontal(1)), bottom = sectionMesh(cube, horizontal(-1));
  const outline = only(top);
  near(outline.area, 4, 1e-14);
  assert.ok(outline.points.every((q) => q[1] === 1), "the top face's boundary, through the neighbouring side faces");
  assert.ok(outline.nodes.every((n) => n.vertex >= 0 || n.diagonal), "corner nodes are the vertices themselves");
  assert.equal(outline.nodes.filter((n) => n.vertex >= 0).length, 4);
  assert.equal(bottom.loops.length, 0, "the plane in the bottom face is 'below' the cube");
  assert.equal(sectionMesh(cube, horizontal(1), { ties: "below" }).loops.length, 0);
  const lower = only(sectionMesh(cube, horizontal(-1), { ties: "below" }));
  near(lower.area, 4, 1e-14);
  assert.throws(() => sectionMesh(cube, horizontal(0), { ties: "beside" as never }), /ties must be/);
});

test("the plane test is exact: a vertex a float evaluation would call on the plane is classified by its true side", () => {
  // n = (0.1, -fl(0.3), 0) through the origin; A = (3, 1, 0) has 3 * 0.1 - fl(0.1 * 3) < 0 exactly although the float sum is 0
  const a = 0.1, b = -(0.1 * 3);
  assert.equal(a * 3 + b * 1, 0, "the float evaluation cannot see it");
  const tri = mesh({ id: "tri", positions: [3, 1, 0, 40, 1, 5, 30, -5, 9], triangles: [0, 1, 2] });
  for (const ties of ["above", "below"] as const) {
    const s = sectionMesh(tri, { point: [0, 0, 0], normal: [a, b, 0] }, { ties });
    assert.equal(s.openCount, 1, `A is strictly below (ties ${ties}), so the plane crosses the triangle`);
    assert.ok(s.loops[0].nodes.every((n) => n.vertex === -1));
  }
});

test("a sphere cut is one closed loop within the tangent-circle bounds; outside its extent there is none", () => {
  const R = 2, sphere = icosphereMesh(3, R);
  for (const h of [0, 0.7, -1.3, 1.9]) {
    const loop = only(sectionMesh(sphere, horizontal(h)));
    assert.equal(loop.closed, true);
    const rho = Math.sqrt(R * R - h * h);
    for (const q of loop.points) {
      const r = Math.hypot(q[0], q[2]);
      assert.ok(r <= rho + 1e-12, "inside the sphere");
      assert.ok(r >= rho * Math.cos(0.1) - 0.05, `radius ${r} against ${rho}`);
      near(q[1], h, 1e-12);
    }
    assert.ok(loop.area > 0);
    assert.ok(loop.area <= Math.PI * rho * rho && loop.area >= Math.PI * rho * rho * 0.8);
  }
  assert.equal(sectionMesh(sphere, horizontal(2.5)).loops.length, 0);
  assert.equal(sectionMesh(sphere, horizontal(-2.5)).loops.length, 0);
  // the icosahedron's four equatorial vertices lie exactly on y = 0 and are recognised as vertices
  const ico = icosphereMesh(0), equator = only(sectionMesh(ico, horizontal(0)));
  const onPlane = equator.nodes.filter((n) => n.vertex >= 0);
  assert.equal(onPlane.length, 4);
  for (const n of onPlane) assert.equal(meshData(ico).positions[n.vertex * 3 + 1], 0);
});

test("a torus cut across its axis is an annulus, along it two discs: exact loop counts, nesting and areas", () => {
  const R = 1.5, r = 0.5, u = 48, v = 24, torus = torusMesh({ major: R, minor: r, u, v });
  const across = sectionMesh(torus, horizontal(0)), loops = across.loops;
  assert.equal(loops.length, 2);
  assert.ok(loops.every((l) => l.closed));
  const outer = loops.find((l) => l.area > 0)!, inner = loops.find((l) => l.area < 0)!;
  const gon = (radius: number, n: number) => n / 2 * radius * radius * Math.sin(2 * Math.PI / n);
  near(outer.area, gon(R + r, u), 1e-12);
  near(-inner.area, gon(R - r, u), 1e-9);
  const domain = sectionDomain(across);
  assert.equal(domain.regions.length, 1);
  assert.equal(domain.regions[0].holes.length, 1, "the inner loop is a hole by containment");
  near(domain.area, gon(R + r, u) - gon(R - r, u), 1e-9);
  // through the axis: two separate tube cross-sections, each the regular v-gon of the tube at theta = 0 and pi
  const along = sectionMesh(torus, { id: "axis", point: [0, 0, 0], normal: [0, 0, 1] });
  assert.equal(along.loops.length, 2);
  assert.ok(along.loops.every((l) => l.closed && l.area > 0));
  const discs = sectionDomain(along);
  assert.equal(discs.regions.length, 2);
  assert.ok(discs.regions.every((region) => region.holes.length === 0));
  near(Math.max(...along.loops.map((l) => l.area)), gon(r, v), 1e-9);
  // Euler consistency: loops = boundary components; each region contributes 1 + its holes
  for (const [section, domainOf] of [[across, domain], [along, discs]] as const)
    assert.equal(section.loops.length, domainOf.regions.reduce((sum, region) => sum + 1 + region.holes.length, 0));
  // no section beyond the tube
  assert.equal(sectionMesh(torus, horizontal(0.6)).loops.length, 0);
});

test("a hollow shell gives an outer loop and a hole; the vase section is the regular polygon of its interpolated radius", () => {
  const outer = icosphereMesh(3, 2), innerData = meshData(icosphereMesh(3, 1));
  const inner = mesh({ id: "cavity", positions: innerData.positions, triangles: innerData.triangles.map((_, i, all) => all[i - (i % 3) + [0, 2, 1][i % 3]]) });
  const shell = mergeMeshes("shell", [outer, inner]);
  assert.equal(meshTopology(shell).counts.components, 2);
  const section = sectionMesh(shell, horizontal(0.3)), domain = sectionDomain(section);
  assert.equal(section.loops.length, 2);
  assert.equal(section.loops.filter((l) => l.area < 0).length, 1, "the cavity's loop runs clockwise");
  assert.equal(domain.regions.length, 1);
  assert.equal(domain.regions[0].holes.length, 1);
  near(domain.area, section.loops.reduce((sum, l) => sum + l.area, 0), 1e-12);
  // vase: profile row radii interpolate linearly along the vertical edges of a band, so the section is an exact regular polygon
  const slices = 24, height = 3, radius = 0.5, closed = vaseMesh({ profile: "urn", slices, height, radius, capBottom: true, capTop: true });
  const rows = vaseProfiles.urn.map(([axial, rr]) => [(axial - 0.5) * height, rr * radius]);
  for (const y of [-1.2, 0.15, 1.1]) {
    const band = rows.findIndex((row, i) => i + 1 < rows.length && y >= row[0] && y <= rows[i + 1][0]);
    const f = (y - rows[band][0]) / (rows[band + 1][0] - rows[band][0]), rr = rows[band][1] + f * (rows[band + 1][1] - rows[band][1]);
    const loop = only(sectionMesh(closed, horizontal(y)));
    near(loop.area, slices / 2 * rr * rr * Math.sin(2 * Math.PI / slices), 1e-12);
    const domainOf = sectionDomain(sectionMesh(closed, horizontal(y)));
    near(domainOf.area, loop.area, 1e-12);
  }
});

test("open meshes give open chains that stop at the boundary; the domain refuses them unless told to ignore", () => {
  const sheet = terrainMesh({ width: 4, depth: 2, columns: 8, rows: 4, height: (x, z) => 0.2 * x + 0.1 * z });
  const cut = sectionMesh(sheet, { id: "x", point: [0.3, 0, 0], normal: [1, 0, 0] }), chain = only(cut);
  assert.equal(chain.closed, false);
  assert.deepEqual([...chain.ends!], ["boundary", "boundary"]);
  assert.equal(cut.openCount, 1);
  for (const q of chain.points) near(q[0], 0.3, 1e-12);
  assert.equal(Math.abs(chain.points[0][2]), 1);
  assert.equal(Math.abs(chain.points[chain.points.length - 1][2]), 1);
  near(chain.length, Math.hypot(2, 0.2), 1e-12);
  assert.throws(() => sectionDomain(cut), /1 open chains/);
  assert.equal(sectionDomain(cut, { open: "ignore" }).regions.length, 0);
  // an open vase cut through its axis runs bottom cap to rim on both sides: one chain
  const vase = vaseMesh({ profile: "goblet", slices: 16 }), through = sectionMesh(vase, { point: [0, 0, 0], normal: [0, 0, 1] });
  assert.equal(through.openCount, 1);
  assert.equal(through.closedCount, 0);
});

test("a non-manifold edge stops the chains that meet there; nothing is joined across it", () => {
  const book = mesh({ id: "book", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1], triangles: [1, 2, 0, 0, 1, 3, 1, 0, 4] });
  const cut = sectionMesh(book, { point: [0.3, 0, 0], normal: [1, 0, 0] });
  assert.equal(cut.nonManifoldNodes, 1);
  assert.equal(cut.loops.length, 3);
  assert.ok(cut.loops.every((l) => !l.closed));
  const spine = cut.loops.map((l) => l.ends!.filter((e) => e === "non-manifold").length);
  assert.deepEqual(spine, [1, 1, 1], "each page's chain ends at the shared edge");
  for (const l of cut.loops) assert.ok(l.ends!.includes("boundary"));
});

test("iso-contours of a linear field on a tilted plane are straight parallel lines; levels are independent", () => {
  const a = 0.3, b = -0.2, w = 5, d = 3, sheet = terrainMesh({ width: w, depth: d, columns: 10, rows: 6, height: (x, z) => a * x + b * z });
  const levels = [-0.4, 0.1, 0.35];
  const result = isoContours(sheet, { values: "height", levels });
  assert.equal(result.curves.length, 3);
  result.curves.forEach((curve) => {
    assert.equal(curve.closed, false);
    assert.deepEqual([...curve.ends!], ["boundary", "boundary"]);
    for (const q of curve.points) { near(a * q[0] + b * q[2], curve.level, 1e-12); near(q[1], curve.level, 1e-12); }
    // collinear: cross product of successive directions vanishes
    const p0 = curve.points[0], p1 = curve.points[curve.points.length - 1];
    for (const q of curve.points) near((q[0] - p0[0]) * (p1[2] - p0[2]) - (q[2] - p0[2]) * (p1[0] - p0[0]), 0, 1e-12);
    // both ends on the sheet's rectangle
    for (const q of [p0, p1]) assert.ok(Math.abs(Math.abs(q[0]) - w / 2) < 1e-12 || Math.abs(Math.abs(q[2]) - d / 2) < 1e-12);
    assert.equal(curve.tone, curve.levelIndex);
    assert.ok(curve.id.startsWith(`L${curve.level}/t`));
  });
  const fewer = isoContours(sheet, { values: "height", levels: [0.1] });
  assert.deepEqual(fewer.curves[0].points, result.curves[1].points);
  assert.equal(fewer.curves[0].id, result.curves[1].id);
  assert.throws(() => isoContours(sheet, { values: "height", levels: [0.1, 0.1] }), /distinct/);
  assert.throws(() => isoContours(sheet, { values: "nope", levels: [0] }), /no size-1 vertex attribute "nope"/);
  assert.throws(() => isoContours(sheet, { values: [1, 2], levels: [0] }), /one number per vertex/);
});

test("a sphere's latitude contour equals the plane section; a level equal to vertex values follows the tie rule", () => {
  const sphere = icosphereMesh(3, 2), data = meshData(sphere);
  const ys = Array.from({ length: sphere.vertexCount }, (_, v) => data.positions[v * 3 + 1]);
  const withY = mesh({ id: "sphere-y", positions: data.positions, triangles: data.triangles, attributes: [{ name: "y", domain: "vertex", size: 1, values: ys }] });
  for (const h of [0.7, -1.1]) {
    const contour = isoContours(withY, { values: "y", levels: [h] }).curves;
    const section = sectionMesh(sphere, horizontal(h)).loops;
    assert.equal(contour.length, 1);
    assert.deepEqual(contour[0].points, section[0].points, "one tracer, identical points");
    assert.equal(contour[0].closed, true);
  }
  // a level equal to two vertex values: with ties above the contour is the edge between them, with ties below there is none
  const tri = mesh({ id: "tri", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], triangles: [0, 1, 2] });
  const edge = isoContours(tri, { values: [0, 1, 1], levels: [1] }).curves;
  assert.equal(edge.length, 1);
  assert.deepEqual(edge[0].nodes.map((n) => n.vertex).sort(), [1, 2]);
  assert.deepEqual(edge[0].points.map((q) => [...q]).sort(), [[0, 1, 0], [1, 0, 0]]);
  assert.equal(isoContours(tri, { values: [0, 1, 1], levels: [1], ties: "below" }).curves.length, 0);
  // scalar values quantised to the integers make many vertices sit exactly on level 1: value >= level is above
  const quantised = ys.map((y) => Math.round(y));
  const c = isoContours(sphere, { values: quantised, levels: [1] });
  assert.ok(c.curves.every((curve) => curve.closed));
  assert.ok(c.curves.every((curve) => curve.nodes.every((n) => n.vertex === -1 || quantised[n.vertex] === 1)));
  const below = isoContours(sphere, { values: quantised, levels: [1], ties: "below" });
  assert.notDeepEqual(below.curves.map((x) => x.points), c.curves.map((x) => x.points));
});

test("seeded random closed meshes never leave open chains; loops agree with the domain of their signed areas", () => {
  const random = mulberry(20260929);
  for (let trial = 0; trial < 12; trial++) {
    const base = meshData(icosphereMesh(2 + (trial % 2)));
    const positions = Array.from(base.positions, (x) => x);
    for (let v = 0; v < positions.length / 3; v++) { const s = 0.6 + 0.8 * random(); for (let k = 0; k < 3; k++) positions[v * 3 + k] *= s; }
    const m = mesh({ id: `star-${trial}`, positions, triangles: base.triangles });
    assert.equal(meshTopology(m).kind, "closed-manifold");
    // planes through a random vertex's coordinate: an exact tie at that vertex (and at any other that shares the value)
    for (let k = 0; k < 20; k++) {
      const v = Math.floor(random() * m.vertexCount), axis = k % 3, normal: Vec3 = axis === 0 ? [1, 0, 0] : axis === 1 ? [0, 1, 0] : [0, 0, 1];
      const y = positions[v * 3 + axis], point: Vec3 = axis === 0 ? [y, 0, 0] : axis === 1 ? [0, y, 0] : [0, 0, y];
      for (const ties of ["above", "below"] as const) {
        const section = sectionMesh(m, { id: `q${k}`, point, normal }, { ties });
        assert.equal(section.openCount, 0, `trial ${trial} plane ${k}: a closed mesh leaves no open chain`);
        assert.equal(section.nonManifoldNodes, 0);
        for (const loop of section.loops) loop.nodes.forEach((node, i) => {
          const face = meshFace(m, loop.faces[i]);
          if (node.vertex >= 0) assert.ok(face.includes(node.vertex), "a point at a vertex leaves through a face around that vertex");
          else assert.ok(face.includes(node.edge[0]) && face.includes(node.edge[1]), "provenance: the segment's face owns the node's edge");
        });
        if (section.loops.length > 0) {
          const domain = sectionDomain(section);
          near(domain.area, section.loops.reduce((sum, l) => sum + l.area, 0), 1e-9);
          assert.ok(domain.area >= -1e-12);
        }
      }
    }
    // random scalar with ties: levels on and between the values
    const values = Array.from({ length: m.vertexCount }, () => Math.floor(random() * 4));
    const iso = isoContours(m, { values, levels: [0.5, 1, 2, 3] });
    assert.ok(iso.curves.every((curve) => curve.closed), `trial ${trial}: contours of a closed mesh close`);
    assert.equal(iso.nonManifoldNodes, 0);
  }
});

test("shared edges are crossed at identical points from both sides", () => {
  // walk every closed loop of a cut torus: consecutive points are the two nodes of ONE face, and each shared-edge node
  // appears exactly once in the output (two faces, one node), so total nodes = crossed triangles per loop
  const torus = torusMesh({ u: 30, v: 14 }), section = sectionMesh(torus, { point: [0.2, 0.05, 0.1], normal: [0.3, 1, 0.2] });
  assert.ok(section.loops.length >= 1);
  const seen = new Set<string>();
  for (const loop of section.loops) for (const node of loop.nodes) { const key = node.edge.join("-"); assert.ok(!seen.has(key), `node ${key} appears twice`); seen.add(key); }
  const topology = meshTopology(torus);
  assert.ok(topology.counts.edges > 0);
  // each node's point is the same combination of its edge's endpoints whichever face it came from
  const data = meshData(torus);
  for (const loop of section.loops) loop.nodes.forEach((node, i) => {
    const [x, y] = node.edge, p = loop.points[i];
    for (let k = 0; k < 3; k++) near(p[k], data.positions[x * 3 + k] + node.t * (data.positions[y * 3 + k] - data.positions[x * 3 + k]), 1e-14);
  });
});

test("slice planes have stable ids; slicing gives per-plane, per-loop ids that survive a small move of the plane", () => {
  const sphere = icosphereMesh(3, 2), planes = slicePlanes(sphere, { normal: [0, 1, 0], spacing: 0.5, offset: 0.1 });
  assert.deepEqual(planes.map((p) => p.id), ["s-4", "s-3", "s-2", "s-1", "s0", "s1", "s2", "s3"]);
  near(planes[0].point[1], 0.1 - 2, 1e-15);
  // a larger mesh keeps the same plane ids at the same positions
  const bigger = slicePlanes(transformMesh(sphere, { scale: 1.6 }), { normal: [0, 1, 0], spacing: 0.5, offset: 0.1 });
  assert.ok(planes.every((p) => bigger.some((q) => q.id === p.id && q.point[1] === p.point[1])));
  const slices = sliceMesh(sphere, planes);
  assert.deepEqual(slices.sections.map((s) => s.id), planes.map((p) => p.id));
  const curves = sliceCurves(slices);
  assert.equal(new Set(curves.map((c) => c.id)).size, curves.length, "loop ids are unique");
  assert.ok(curves.every((c) => c.id.startsWith(c.id.split("/")[0] + "/t")));
  assert.ok(slices.sections.every((s) => s.loops.length === 1 && s.loops[0].closed));
  // moving one plane by 1e-7 keeps every loop id (no vertex is crossed)
  const nudged = sliceMesh(sphere, planes.map((p) => ({ ...p, point: [p.point[0], p.point[1] + 1e-7, p.point[2]] as Vec3 })));
  assert.deepEqual(sliceCurves(nudged).map((c) => c.id), curves.map((c) => c.id));
  // loops are ordinary spatial curves: they go straight into the hidden-line solver
  const view = camera({ projection: "orthographic", yaw: 30, pitch: 25, zoom: 100, distance: 12, center: [320, 320] });
  const drawn = hiddenLines(sphere, curves, view);
  assert.ok(drawn.paths.some((p) => p.visible) && drawn.paths.some((p) => !p.visible));
  assert.throws(() => sliceMesh(sphere, [horizontal(0, "a"), horizontal(1, "a")]), /"a" is repeated/);
  assert.throws(() => slicePlanes(sphere, { normal: [0, 1, 0], spacing: 0.001 }), /increase spacing/);
  assert.throws(() => slicePlanes(sphere, { normal: [0, 1, 0], spacing: 0 }), /spacing must be a positive/);
  assert.throws(() => sliceMesh(sphere, Array.from({ length: SECTION_LIMITS.maxPlanes + 1 }, (_, i) => horizontal(i * 1e-3, `x${i}`))), /reduce planes/);
});

test("work is bounded and named", () => {
  const big = bundledMesh("terrain", { detail: 6, seed: 1, variant: "hills" });
  const planes = Array.from({ length: 30 }, (_, i) => horizontal(-0.3 + i * 0.02, `w${i}`));
  assert.throws(() => sliceMesh(big, planes, { maxWork: 10_000 }), /maxWork = 10000/);
  assert.throws(() => isoContours(big, { values: "height", levels: [0, 0.1], maxWork: 100 }), /maxWork = 100/);
  assert.ok(DEFAULT_SECTION_WORK >= 10_000_000);
  assert.throws(() => isoContours(big, { values: "height", levels: [] }), /non-empty/);
  assert.throws(() => isoContours(big, { values: "height", levels: Array.from({ length: SECTION_LIMITS.maxLevels + 1 }, (_, i) => i) }), /reduce levels/);
});

test("sections do not depend on how a quad was drawn: a planar quad wall gives the same line either way", () => {
  // a cube whose side faces are quads or split triangles has the same section area
  const quads: Mesh = boxMesh([2, 2, 2]);
  const data = meshData(quads), tris: number[] = [];
  for (let f = 0; f < data.quads.length / 4; f++) { const q = data.quads.slice(f * 4, f * 4 + 4); tris.push(q[0], q[1], q[2], q[0], q[2], q[3]); }
  const split = mesh({ id: "split", positions: data.positions, triangles: tris });
  near(only(sectionMesh(split, horizontal(0.3))).area, only(sectionMesh(quads, horizontal(0.3))).area, 1e-14);
  assert.equal(only(sectionMesh(split, horizontal(0.3))).nodes.filter((n) => n.diagonal).length, 0, "with real triangles there is no quad diagonal");
});
