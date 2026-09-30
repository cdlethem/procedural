import assert from "node:assert/strict";
import test from "node:test";
import {
  meshBoundaryDistance as boundaryDistance, boxMesh, icosphereMesh, interpolateVertexValues, mesh, meshBarycentric, meshWalker, stepRK2, terrainMesh, traceGraph, walkMesh,
  type Mesh, type MeshWalker,
} from "../dist/index.js";

const flat = (columns = 20) => terrainMesh({ width: 4, depth: 4, columns, rows: columns, height: () => 0 });
const random = (seed: number) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 0x100000000; };
const near = (actual: number, expected: number, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

/** A walker standing at `p` in the first triangle of `m` that contains it, heading `d`. */
function start(m: Mesh, p: readonly number[], d: readonly number[]): MeshWalker {
  const g = traceGraph(m), lambda = new Float64Array(3), w = meshWalker(0);
  for (let t = 0; t < m.triangleCount; t++) {
    meshBarycentric(g, t, p, lambda);
    if (lambda[0] >= -1e-12 && lambda[1] >= -1e-12 && lambda[2] >= -1e-12) { w.tri = t; w.p.set(p); w.d.set(d); return w; }
  }
  throw new Error(`no triangle holds ${p}`);
}

test("a walk over a plane is the straight line, whatever triangles it crosses", () => {
  const m = flat(20), g = traceGraph(m), next = random(3), lambda = new Float64Array(3);
  for (let n = 0; n < 60; n++) {
    const a = next() * 2 * Math.PI, p = [next() - 0.5, 0, next() - 0.5], d = [Math.cos(a), 0, Math.sin(a)], length = 0.3 + 1.2 * next();
    const w = start(m, p, d), events: number[] = [];
    assert.equal(walkMesh(g, w, length, events), "length");
    for (let c = 0; c < 3; c++) near(w.p[c], p[c] + d[c] * length, 1e-12);
    assert.ok(events.length >= 4 * 2, "1.5 grid cells or more crosses several edges");
    for (let e = 0; e < events.length; e += 4) {
      // every event lies ON an edge of the triangle it leaves (one barycentric coordinate is zero) and on the line
      meshBarycentric(g, events[e + 3], [events[e], events[e + 1], events[e + 2]], lambda);
      assert.ok(Math.min(...lambda) < 1e-9 && Math.min(...lambda) > -1e-9);
      const t = ((events[e] - p[0]) * d[0] + (events[e + 2] - p[2]) * d[2]);
      near(events[e] - p[0], t * d[0], 1e-9); near(events[e + 2] - p[2], t * d[2], 1e-9);
    }
  }
});

test("a walk unfolds across edges: over the edge of a cube it goes on straight down the side and along the bottom", () => {
  const cube = boxMesh([2, 2, 2]), g = traceGraph(cube);
  const onSide = start(cube, [0, 1, 0], [1, 0, 0]);
  assert.equal(walkMesh(g, onSide, 1.5, null), "length");
  for (const [i, v] of [1, 0.5, 0].entries()) near(onSide.p[i], v);
  assert.deepEqual([...onSide.d].map((v) => Math.round(v * 1e9) / 1e9 + 0), [0, -1, 0], "the heading turned with the fold");
  const twice = start(cube, [0, 1, 0], [1, 0, 0]);
  assert.equal(walkMesh(g, twice, 3.5, null), "length");
  for (const [i, v] of [0.5, -1, 0].entries()) near(twice.p[i], v, 1e-9);
  assert.deepEqual([...twice.d].map((v) => Math.round(v * 1e9) / 1e9 + 0), [-1, 0, 0]);
});

test("a walk stops on a boundary edge and says so; the point is on the edge", () => {
  const m = flat(8), g = traceGraph(m), w = start(m, [0, 0, 0], [1, 0, 0]);
  assert.equal(walkMesh(g, w, 5, null), "boundary");
  near(w.p[0], 2); near(w.p[2], 0, 1e-12);
  const slanted = start(m, [-1, 0, 1], [Math.SQRT1_2, 0, Math.SQRT1_2]);
  assert.equal(walkMesh(g, slanted, 9, null), "boundary");
  near(slanted.p[0], 0, 1e-12); near(slanted.p[2], 2, 1e-12);
});

test("meshes that are not consistently oriented manifolds are refused by name", () => {
  const spine = mesh({ id: "spine", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1], triangles: [0, 1, 2, 1, 0, 3, 0, 1, 4] });
  assert.throws(() => traceGraph(spine), /"spine" is non-manifold/);
  const flipped = mesh({ id: "flip", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], triangles: [0, 1, 2, 0, 1, 3] });
  assert.throws(() => traceGraph(flipped), /"flip" is inconsistent-orientation/);
});

test("a walk on an icosphere follows a great circle to within the mesh's own error", () => {
  const sphere = icosphereMesh(5), g = traceGraph(sphere);
  // start at a vertex, head toward +y along the great circle through it and the pole
  const p = [g.positions[10 * 3], g.positions[10 * 3 + 1], g.positions[10 * 3 + 2]];
  const w = meshWalker(0), lambda = new Float64Array(3);
  for (let t = 0; t < sphere.triangleCount; t++) { meshBarycentric(g, t, p, lambda); if (Math.min(...lambda) > -1e-12) { w.tri = t; break; } }
  w.p.set(p);
  const n = [g.normals[w.tri * 3], g.normals[w.tri * 3 + 1], g.normals[w.tri * 3 + 2]], up = [0, 1, 0];
  const dot = up[1] * n[1], tangent = [-n[0] * dot, 1 - n[1] * dot, -n[2] * dot], l = Math.hypot(...tangent);
  w.d.set(tangent.map((v) => v / l));
  const heading = [...w.d];
  assert.equal(walkMesh(g, w, 1.1, null), "length");
  // the point at arc angle theta on the great circle through p with direction `heading` (heading is tangent to the facet, so it is within one facet angle of the sphere's tangent)
  const radius = Math.hypot(...w.p);
  assert.ok(Math.abs(radius - 1) < 2e-3, `the walk stays on the sphere (radius ${radius})`);
  const cosAngle = (w.p[0] * p[0] + w.p[1] * p[1] + w.p[2] * p[2]) / radius;
  assert.ok(Math.abs(Math.acos(cosAngle) - 1.1) < 8e-3, `arc angle ${Math.acos(cosAngle)} vs 1.1`);
  // and stays in the plane of the start point, the start heading and the origin
  const plane = [p[1] * heading[2] - p[2] * heading[1], p[2] * heading[0] - p[0] * heading[2], p[0] * heading[1] - p[1] * heading[0]], pl = Math.hypot(...plane);
  assert.ok(Math.abs((w.p[0] * plane[0] + w.p[1] * plane[1] + w.p[2] * plane[2]) / pl) < 4e-3, "out of the great-circle plane");
});

test("the midpoint step is second order: following a circle field, radius error falls at least 3.5x per halving", () => {
  const m = flat(200), g = traceGraph(m), vec = new Float64Array(m.vertexCount * 3);
  for (let v = 0; v < m.vertexCount; v++) { const x = g.positions[v * 3], z = g.positions[v * 3 + 2], r = Math.hypot(x, z); if (r > 1e-9) { vec[v * 3] = -z / r; vec[v * 3 + 2] = x / r; } }
  const drift = (h: number) => {
    const w = start(m, [1, 0, 0], [0, 0, 1]), steps = Math.round(Math.PI / 2 / h);
    for (let i = 0; i < steps; i++) assert.equal(stepRK2(g, vec, w, h, null), "ok");
    return Math.abs(Math.hypot(w.p[0], w.p[2]) - 1);
  };
  const errors = [0.5, 0.25, 0.125].map(drift);
  assert.ok(errors[0] < 0.02, `h = 0.5 drifts ${errors[0]}; explicit Euler would drift 0.40`);
  assert.ok(errors[1] < errors[0] / 3.5 && errors[2] < errors[1] / 3.5, `errors ${errors.join(", ")}`);
  assert.ok(drift(0.0625) < 1e-4);
});

test("a field that vanishes stops the curve as singular, without moving it", () => {
  const m = flat(10), g = traceGraph(m), vec = new Float64Array(m.vertexCount * 3);
  const w = start(m, [0.3, 0, 0.3], [1, 0, 0]);
  assert.equal(stepRK2(g, vec, w, 0.1, null), "singular");
  near(w.p[0], 0.3, 0); near(w.p[2], 0.3, 0);
});

test("boundary distance on a plane is the grid distance to the border, and is infinite on a closed mesh", () => {
  const m = flat(20), g = traceGraph(m), dist = boundaryDistance(g), cell = 0.2;
  for (let j = 0; j <= 20; j++) for (let i = 0; i <= 20; i++) near(dist[j * 21 + i], cell * Math.min(i, j, 20 - i, 20 - j), 1e-12);
  // interpolation of a per-vertex array at a vertex returns that vertex's value, and midway along an edge the mean of its ends
  const at = start(m, [-1.2, 0, -0.6], [1, 0, 0]);
  near(interpolateVertexValues(g, dist, at), dist[7 * 21 + 4], 1e-12);
  const between = start(m, [-1.1, 0, -0.6], [1, 0, 0]);
  near(interpolateVertexValues(g, dist, between), (dist[7 * 21 + 4] + dist[7 * 21 + 5]) / 2, 1e-12);
  assert.equal(boundaryDistance(traceGraph(icosphereMesh(2))).every((d) => d === Infinity), true);
});
