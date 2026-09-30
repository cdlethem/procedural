import assert from "node:assert/strict";
import test from "node:test";
import { gradientNoise3D01 } from "@procedurals/javascript";
import {
  MAX_POINT_LINKS, POINT_LIMITS, STRUCTURE_LIMITS, bundledMesh, canPrepareInstrument, createInstrument, cutMesh, cutPoints, definition, describePointCloud, dispersePoints,
  drawPointClouds, eigenSymmetric3, faceArea, inspectorItems, keepPoints, meshComponentOfFace, meshData, meshTopology, mixHash, nearestNeighbors, pointCamera,
  pointCloud, pointCloudData, pointCloudProducts, pointCloudScene, pointCloudsComposition, pointFrame, pointId, pointLinks, pointSubject, prepareInstrument, rampIndex,
  rankValues, sampleSurface, thinPointCloud, usesSeed, validateInstrument, validateParameters, viewPoints, visibleParameters, drawInstrument, linkPaths,
  pointMarkSites, pointPaletteRamp, selectPoints, discSides,
  type CompositionSurface, type InstrumentInput, type PointCloud, type PointFrame, type PointMarkStyle, type PointSubjectSpec,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";

const ID = "point-clouds";
const near = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const flat = (points: readonly (readonly number[])[]): number[] => points.flatMap((p) => [...p]);
function cloudOf(points: number[][], extra: { normals?: number[][]; seed?: number; id?: string; attributes?: { name: string; size: 1 | 2 | 3 | 4; values: number[] }[] } = {}): PointCloud {
  return pointCloud({ id: extra.id ?? "hand", positions: flat(points), ...(extra.normals ? { normals: flat(extra.normals) } : {}), seed: extra.seed ?? 5, attributes: extra.attributes });
}
const randomPoints = (n: number, seed: number, scale = 1): number[][] => { const r = lcg(seed); return Array.from({ length: n }, () => [r() * scale, r() * scale, r() * scale]); };
const data = (cloud: PointCloud) => pointCloudData(cloud);
const attr = (cloud: PointCloud, name: string) => data(cloud).attributes.find((a) => a.name === name)!.values as Float64Array;
const ids = (cloud: PointCloud): string[] => Array.from({ length: cloud.count }, (_, i) => pointId(cloud, i));

function spec(over: Partial<PointSubjectSpec> & { kind: PointSubjectSpec["kind"] }): PointSubjectSpec {
  return { seed: 4, count: 400, distribution: "even", vase: "amphora", terrain: "hills",
    galaxy: { arms: 3, twist: 1, bulge: 0.25, thickness: 0.3, looseness: 0.7 }, noise: { scale: 1.5, contrast: 0.5, octaves: 2 }, ...over };
}

// ---------------------------------------------------------------------------------------------
// Neighbours and structure

test("nearest neighbours equal brute force exactly, ties by index, including clustered clouds that force wide shell searches", () => {
  const clouds: number[][][] = [
    randomPoints(700, 11),
    [...randomPoints(120, 12, 0.01), ...randomPoints(120, 13, 0.01).map(([x, y, z]) => [x + 50, y, z]), [200, 200, 200]],
    Array.from({ length: 125 }, (_, i) => [i % 5, Math.floor(i / 5) % 5, Math.floor(i / 25)]),
  ];
  for (const points of clouds) for (const k of [3, 7]) {
    const cloud = cloudOf(points), table = nearestNeighbors(cloud, k), n = points.length;
    assert.equal(table.k, k);
    for (let i = 0; i < n; i++) {
      const expected = points.map((q, j) => ({ j, d: Math.hypot(q[0] - points[i][0], q[1] - points[i][1], q[2] - points[i][2]) })).filter((e) => e.j !== i)
        .sort((a, b) => a.d - b.d || a.j - b.j).slice(0, k);
      assert.deepEqual(Array.from(table.index.subarray(i * k, i * k + k)), expected.map((e) => e.j), `point ${i}`);
      expected.forEach((e, at) => near(table.distance[i * k + at], e.d, 1e-12));
    }
  }
});

test("neighbour counts above the cloud clamp, and the limits name the control", () => {
  const four = cloudOf([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  assert.equal(nearestNeighbors(four, 10).k, 3);
  assert.throws(() => nearestNeighbors(four, 2), /Neighbors/);
  assert.throws(() => nearestNeighbors(four, STRUCTURE_LIMITS.maxNeighbors + 1), /Neighbors/);
  assert.throws(() => describePointCloud(four, { neighbors: 2.5 }), /Neighbors/);
});

test("a cubic lattice interior has exact estimates: spacing 1, ball density 6/(4/3 pi), isotropic curvature 1/3", () => {
  const points: number[][] = [];
  for (let z = 0; z < 5; z++) for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) points.push([x, y, z]);
  const described = describePointCloud(cloudOf(points), { neighbors: 6 });
  const centre = 2 + 5 * 2 + 25 * 2;
  near(attr(described, "spacing")[centre], 1);
  near(attr(described, "density")[centre], 6 / (4 / 3 * Math.PI));
  near(attr(described, "curvature")[centre], 1 / 3, 1e-12);
  near(attr(described, "height")[centre], 0.5);
  assert.equal(attr(described, "height")[0], 0);
  assert.equal(attr(described, "height")[124], 1);
});

test("a planar lattice has zero curvature, the long-spacing axis as its principal direction and a normal along z", () => {
  const points: number[][] = [];
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) points.push([x, y * 1.2, 0]);
  const described = describePointCloud(cloudOf(points), { neighbors: 4 }), interior = 3 + 7 * 3;
  near(attr(described, "curvature")[interior], 0, 1e-12);
  const principal = attr(described, "principal");
  near(Math.abs(principal[interior * 3 + 1]), 1, 1e-12);
  assert.ok(principal[interior * 3 + 1] > 0, "sign fixed: first non-zero component positive");
  near(attr(described, "spacing")[interior], 1.2);
  const normals = data(described).normals!;
  near(Math.abs(normals[interior * 3 + 2]), 1, 1e-12);
});

test("estimated normals point away from the centroid for a sphere of points", () => {
  const r = lcg(3), points: number[][] = [];
  for (let i = 0; i < 800; i++) { const z = 2 * r() - 1, t = 2 * Math.PI * r(), s = Math.sqrt(1 - z * z); points.push([s * Math.cos(t), s * Math.sin(t), z]); }
  const cloud = describePointCloud(cloudOf(points), { neighbors: 10 }), normals = data(cloud).normals!;
  let aligned = 0;
  for (let i = 0; i < 800; i++) if (normals[i * 3] * points[i][0] + normals[i * 3 + 1] * points[i][1] + normals[i * 3 + 2] * points[i][2] > 0.9) aligned++;
  assert.ok(aligned > 780, `${aligned} of 800 normals within 26 degrees of radial`);
});

test("the symmetric eigen-solver reproduces A v = l v with orthonormal vectors, ascending values and the trace", () => {
  const r = lcg(21);
  for (let trial = 0; trial < 60; trial++) {
    const m = Array.from({ length: 6 }, () => (r() - 0.5) * 10), { values, vectors } = eigenSymmetric3(m);
    const A = [[m[0], m[1], m[2]], [m[1], m[3], m[4]], [m[2], m[4], m[5]]];
    assert.ok(values[0] <= values[1] && values[1] <= values[2]);
    near(values[0] + values[1] + values[2], m[0] + m[3] + m[5], 1e-12);
    vectors.forEach((v, e) => {
      for (let row = 0; row < 3; row++) near(A[row][0] * v[0] + A[row][1] * v[1] + A[row][2] * v[2], values[e] * v[row], 1e-9);
      near(Math.hypot(v[0], v[1], v[2]), 1, 1e-12);
      vectors.forEach((w, f) => { if (f > e) near(v[0] * w[0] + v[1] * w[1] + v[2] * w[2], 0, 1e-9); });
    });
  }
});

test("ranks are tie-averaged fractions", () => {
  assert.deepEqual(Array.from(rankValues([5, 5, 5, 9])), [1 / 3, 1 / 3, 1 / 3, 1]);
  assert.deepEqual(Array.from(rankValues([3, 1, 2])), [1, 0, 0.5]);
  assert.deepEqual(Array.from(rankValues([7])), [0.5]);
});

test("describing keeps ids and seeds and refuses a cloud that leaves no room for the estimates", () => {
  const cloud = cloudOf(randomPoints(50, 2), { seed: 9 }), described = describePointCloud(cloud, { neighbors: 5 });
  assert.deepEqual(ids(described), ids(cloud));
  assert.equal(described.seed, 9);
  assert.equal(describePointCloud(cloud, { neighbors: 5 }), described, "cached by content");
  const crowded = cloudOf(randomPoints(10, 2), { attributes: Array.from({ length: 2 }, (_, i) => ({ name: `a${i}`, size: 1 as const, values: new Array(10).fill(0) })) });
  assert.throws(() => describePointCloud(crowded, { neighbors: 3 }), /attributes/);
});

// ---------------------------------------------------------------------------------------------
// Subjects

test("every subject is a prefix-stable function of its seed: the first n points of a longer subject are the n-point subject", () => {
  for (const kind of ["figure", "vase", "terrain", "torus", "galaxy", "noise-volume"] as const) for (const distribution of ["even", "random"] as const) {
    const small = pointSubject(spec({ kind, count: 150, distribution })), large = pointSubject(spec({ kind, count: 400, distribution }));
    const a = data(small.cloud), b = data(large.cloud);
    assert.deepEqual(Array.from(a.positions), Array.from(b.positions.subarray(0, 450)), `${kind} positions`);
    assert.deepEqual(Array.from(a.normals!), Array.from(b.normals!.subarray(0, 450)), `${kind} normals`);
    assert.deepEqual(Array.from(attr(small.cloud, "part")), Array.from(attr(large.cloud, "part").subarray(0, 150)), `${kind} parts`);
  }
});

test("subject normals are unit vectors, and fields a kind does not read neither key nor change the result", () => {
  for (const kind of ["figure", "vase", "terrain", "torus", "galaxy", "noise-volume"] as const) {
    const subject = pointSubject(spec({ kind, count: 300 })), normals = data(subject.cloud).normals!;
    for (let i = 0; i < 300; i++) near(Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]), 1, 1e-9);
    assert.ok(subject.radius > 0);
  }
  const vase = pointSubject(spec({ kind: "vase" }));
  assert.equal(pointSubject(spec({ kind: "vase", terrain: "dunes", galaxy: { arms: 5, twist: 2, bulge: 0.5, thickness: 0.1, looseness: 1 }, noise: { scale: 4, contrast: 1, octaves: 4 } })), vase);
  assert.notEqual(pointSubject(spec({ kind: "vase", vase: "goblet" })), vase);
  const galaxy = pointSubject(spec({ kind: "galaxy" }));
  assert.equal(pointSubject(spec({ kind: "galaxy", distribution: "random", vase: "urn" })), galaxy);
});

test("torus samples lie on the torus within the faceting error, and the figure's seven parts get area-proportional shares", () => {
  const torus = pointSubject(spec({ kind: "torus", count: 3000 })), p = data(torus.cloud).positions;
  for (let i = 0; i < 3000; i++) near(Math.hypot(Math.hypot(p[i * 3], p[i * 3 + 2]) - 1, p[i * 3 + 1]), 0.4, 0.02);
  const figure = pointSubject(spec({ kind: "figure", count: 30000 })), mesh = figure.mesh!, topology = meshTopology(mesh), area = new Map<number, number>();
  let total = 0;
  for (let f = 0; f < mesh.faceCount; f++) { const c = meshComponentOfFace(topology, f); area.set(c, (area.get(c) ?? 0) + faceArea(mesh, f)); total += faceArea(mesh, f); }
  assert.equal(area.size, 7);
  const share = new Map<number, number>(), parts = attr(figure.cloud, "part");
  for (const c of parts) share.set(c, (share.get(c) ?? 0) + 1 / parts.length);
  for (const [c, a] of area) near(share.get(c)!, a / total, 0.01 / Math.max(a / total, 0.01) * (a / total) + 0.005);
});

test("the galaxy's bulge share and arm shares match its controls", () => {
  const n = 20000, galaxy = pointSubject(spec({ kind: "galaxy", count: n, galaxy: { arms: 4, twist: 1, bulge: 0.3, thickness: 0.2, looseness: 0.5 } }));
  const part = attr(galaxy.cloud, "part"), counts = [0, 0, 0, 0, 0];
  for (const c of part) counts[c]++;
  near(counts[0] / n, 0.3, 0.015);
  for (let a = 1; a <= 4; a++) near(counts[a] / (n - counts[0]), 0.25, 0.03);
  const noBulge = pointSubject(spec({ kind: "galaxy", count: n, galaxy: { arms: 2, twist: 0, bulge: 0, thickness: 0, looseness: 0 } }));
  assert.ok(Array.from(attr(noBulge.cloud, "part")).every((c) => c === 1 || c === 2));
  // With no twist, no looseness and no thickness the 12% of points that ignore the arms aside, arm points are on two straight spokes.
  const p = data(noBulge.cloud).positions;
  let onSpoke = 0;
  for (let i = 0; i < n; i++) { const angle = Math.atan2(p[i * 3 + 2], p[i * 3]), k = Math.abs(Math.sin(angle)); if (k < 0.02) onSpoke++; }
  assert.ok(onSpoke / n > 0.85, `${onSpoke / n} of points within 0.02 rad of the two spokes`);
});

test("noise-volume points stay in the unit ball and concentrate on high noise as contrast rises", () => {
  const field = gradientNoise3D01({ seed: 4 });
  const meanField = (contrast: number): number => {
    const s = pointSubject(spec({ kind: "noise-volume", count: 3000, noise: { scale: 1.5, contrast, octaves: 1 } })), p = data(s.cloud).positions;
    let sum = 0;
    for (let i = 0; i < 3000; i++) { assert.ok(Math.hypot(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]) <= 1 + 1e-12); sum += field.sample(p[i * 3] * 1.5, p[i * 3 + 1] * 1.5, p[i * 3 + 2] * 1.5); }
    return sum / 3000;
  };
  const r = lcg(1);
  let uniform = 0, drawn = 0;
  while (drawn < 3000) { const x = 2 * r() - 1, y = 2 * r() - 1, z = 2 * r() - 1; if (x * x + y * y + z * z <= 1) { uniform += field.sample(x * 1.5, y * 1.5, z * 1.5); drawn++; } }
  near(meanField(0), uniform / 3000, 0.04);
  assert.ok(meanField(0.95) > meanField(0) + 0.08, `${meanField(0.95)} vs ${meanField(0)}`);
});

test("a seed changes the form of the terrain and the galaxy, and the deal of a fixed subject", () => {
  const terrain = (seed: number) => data(pointSubject(spec({ kind: "terrain", seed, count: 500 })).mesh ? pointSubject(spec({ kind: "terrain", seed, count: 500 })).cloud : (undefined as never)).positions;
  const a = terrain(1), b = terrain(2);
  let dy = 0;
  for (let i = 0; i < 500; i++) dy = Math.max(dy, Math.abs(a[i * 3 + 1] - b[i * 3 + 1]));
  assert.ok(dy > 0.05, `relief differs by ${dy}`);
  const fig = (seed: number) => Array.from(data(pointSubject(spec({ kind: "figure", seed, count: 200 })).cloud).positions.subarray(0, 30));
  assert.notDeepEqual(fig(1), fig(2));
  assert.throws(() => pointSubject(spec({ kind: "galaxy", galaxy: { arms: 0, twist: 1, bulge: 0.2, thickness: 0.2, looseness: 0.5 } })), /Arms/);
  assert.throws(() => pointSubject(spec({ kind: "vase", count: POINT_LIMITS.maxPoints + 1 })), /Points/);
  assert.throws(() => pointSubject(spec({ kind: "vase", count: 0 })), /Points/);
});

// ---------------------------------------------------------------------------------------------
// Selection: cut, thinning, focus, dispersion

const frameOf = (cloud: PointCloud) => pointFrame(cloud);

test("a cut keeps exactly the closed half-space, keeps ids, and flips to the other side", () => {
  const cloud = cloudOf(randomPoints(400, 31, 2)), frame = frameOf(cloud), p = data(cloud).positions;
  for (const axis of ["x", "y", "z"] as const) for (const at of [-0.5, 0, 0.7]) for (const flip of [false, true]) {
    const k = { x: 0, y: 1, z: 2 }[axis], plane = frame.center[k] + at * frame.half[k];
    const kept = cutPoints(cloud, { axis, at, flip }, frame);
    const expected = Array.from({ length: 400 }, (_, i) => i).filter((i) => (flip ? p[i * 3 + k] >= plane : p[i * 3 + k] <= plane));
    assert.deepEqual(ids(kept), expected.map((i) => `p:${i}`), `${axis} ${at} ${flip}`);
  }
  assert.equal(cutPoints(cloud, { axis: "none", at: 0.4, flip: true }, frame), cloud);
});

test("the cut occluder keeps exactly the faces whose centroid is on the kept side", () => {
  const mesh = bundledMesh("torus", { detail: 4 }), frame = { center: [0, 0, 0] as const, half: [1.4, 0.4, 1.4] as const, radius: 1.5 }, d = meshData(mesh);
  const cut = cutMesh(mesh, { axis: "x", at: 0.2, flip: false }, frame), plane = 0.2 * 1.4;
  let expected = 0;
  for (let f = 0; f < d.quads.length; f += 4) if ((d.positions[d.quads[f] * 3] + d.positions[d.quads[f + 1] * 3] + d.positions[d.quads[f + 2] * 3] + d.positions[d.quads[f + 3] * 3]) / 4 <= plane) expected++;
  assert.equal(cut.faceCount, expected);
  assert.ok(cut.faceCount > 0 && cut.faceCount < mesh.faceCount);
  assert.equal(cutMesh(mesh, { axis: "none", at: 0, flip: false }, frame), mesh);
});

test("kept sets are nested in Keep for every rule, with and without a dense region", () => {
  const cloud = describePointCloud(pointSubject(spec({ kind: "figure", count: 1500 })).cloud, { neighbors: 8 }), frame = frameOf(cloud);
  for (const rule of ["uniform", "even-out", "features"] as const) for (const focus of [null, { center: [0.2, 0.4, 0.5] as const, radius: 0.4, falloff: 0.5 }]) {
    let previous = new Set<number>();
    for (const fraction of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const kept = keepPoints(cloud, { fraction, rule, bias: 0.8, focus }, frame), now = new Set(kept.indices);
      for (const i of previous) assert.ok(now.has(i), `${rule} ${fraction}: point ${i} was kept at a lower fraction and dropped`);
      previous = now;
    }
    assert.equal(previous.size, 1500, "Keep 1 keeps every point");
  }
  assert.equal(keepPoints(cloud, { fraction: 0, rule: "uniform", bias: 0, focus: null }, frame).cloud.count, 0);
});

test("the uniform rule keeps the points with the smallest fixed ranks, the same set as the foundation's seeded thinning", () => {
  const cloud = describePointCloud(pointSubject(spec({ kind: "torus", count: 2000 })).cloud, { neighbors: 6 }), frame = frameOf(cloud);
  const kept = keepPoints(cloud, { fraction: 0.37, rule: "uniform", bias: 0, focus: null }, frame);
  const reference = thinPointCloud(cloud, { seed: cloud.seed, count: kept.cloud.count });
  // thinPointCloud hashes with the same construction; equal sets show the rule is a rank threshold, not a per-call shuffle.
  assert.deepEqual(new Set(ids(kept.cloud)), new Set(ids(reference)));
  const n = 2000, expected = 0.37 * n, sigma = Math.sqrt(n * 0.37 * 0.63);
  assert.ok(Math.abs(kept.cloud.count - expected) < 4 * sigma, `${kept.cloud.count} of ${n}`);
});

test("uniform thinning of a prefix equals the prefix of the thinned longer cloud", () => {
  const frameA = { center: [0, 0, 0] as const, half: [1, 1, 1] as const, radius: 1 };
  const short = describePointCloud(pointSubject(spec({ kind: "vase", count: 1500 })).cloud, { neighbors: 6 });
  const long = describePointCloud(pointSubject(spec({ kind: "vase", count: 3000 })).cloud, { neighbors: 6 });
  const a = new Set(ids(keepPoints(short, { fraction: 0.4, rule: "uniform", bias: 0, focus: null }, frameA).cloud));
  const b = new Set(ids(keepPoints(long, { fraction: 0.4, rule: "uniform", bias: 0, focus: null }, frameA).cloud).filter((id) => Number(id.slice(2)) < 1500));
  assert.deepEqual(a, b);
});

test("keep probability follows t^(2^(2b(1-2a))) exactly for crafted rule weights, and the dense region adds w(1-p)", () => {
  const n = 9, weights = Array.from({ length: n }, (_, i) => i / (n - 1));
  const points = Array.from({ length: n }, (_, i) => [i, 0, 0]);
  const cloud = cloudOf(points, { attributes: [{ name: "curvatureRank", size: 1, values: weights }, { name: "densityRank", size: 1, values: weights }] });
  const frame = { center: [4, 0, 0] as const, half: [4, 1, 1] as const, radius: 4 };
  for (const [fraction, bias] of [[0.3, 0.5], [0.8, 1.2], [0.05, 2]] as const) {
    const features = keepPoints(cloud, { fraction, rule: "features", bias, focus: null }, frame), crowded = keepPoints(cloud, { fraction, rule: "even-out", bias, focus: null }, frame);
    weights.forEach((a, i) => {
      near(features.probability[i], Math.pow(fraction, Math.pow(2, 2 * bias * (1 - 2 * a))), 1e-12);
      near(crowded.probability[i], Math.pow(fraction, Math.pow(2, 2 * bias * (1 - 2 * (1 - a)))), 1e-12);
    });
    assert.ok(features.probability[n - 1] > features.probability[0], "flat-first thinning favours the high-curvature end");
  }
  // Focus: a ball of radius 2 (falloff 0.5) about x = 4. Inside 1 the weight is 1; at distance 1.5 it is 1 - smoothstep(0.5).
  const focused = keepPoints(cloud, { fraction: 0.2, rule: "uniform", bias: 0, focus: { center: [0, 0, 0], radius: 0.5, falloff: 0.5 } }, frame);
  points.forEach((_, i) => {
    const d = Math.abs(i - 4), inner = 1, w = d <= inner ? 1 : d >= 2 ? 0 : 1 - (() => { const t = (d - inner) / (2 - inner); return t * t * (3 - 2 * t); })();
    near(focused.probability[i], 0.2 + w * 0.8, 1e-12);
  });
});

test("thin rules favour what they name: flat points go first under 'features', crowded points under 'even-out'", () => {
  const cloud = describePointCloud(pointSubject(spec({ kind: "figure", count: 6000 })).cloud, { neighbors: 8 }), frame = frameOf(cloud);
  const mean = (kept: Set<number>, name: string, inside: boolean) => { const v = attr(cloud, name); let s = 0, c = 0; for (let i = 0; i < v.length; i++) if (kept.has(i) === inside) { s += v[i]; c++; } return s / c; };
  const features = new Set(keepPoints(cloud, { fraction: 0.3, rule: "features", bias: 1, focus: null }, frame).indices);
  assert.ok(mean(features, "curvatureRank", true) > mean(features, "curvatureRank", false) + 0.15);
  const even = new Set(keepPoints(cloud, { fraction: 0.3, rule: "even-out", bias: 1, focus: null }, frame).indices);
  assert.ok(mean(even, "densityRank", true) < mean(even, "densityRank", false) - 0.15);
  assert.throws(() => keepPoints(cloudOf(randomPoints(20, 1)), { fraction: 0.5, rule: "features", bias: 1, focus: null }, frame), /curvatureRank/);
  assert.throws(() => keepPoints(cloud, { fraction: 1.5, rule: "uniform", bias: 0, focus: null }, frame), /Keep/);
});

test("dense-region points survive Keep 0 and points beyond the ball are those the uniform rule keeps", () => {
  const cloud = describePointCloud(pointSubject(spec({ kind: "vase", count: 3000 })).cloud, { neighbors: 6 }), frame = frameOf(cloud), p = data(cloud).positions;
  const focus = { center: [0, 0.5, 0.5] as const, radius: 0.4, falloff: 0.3 };
  const c = [frame.center[0], frame.center[1] + 0.5 * frame.half[1], frame.center[2] + 0.5 * frame.half[2]], R = 0.4 * frame.radius;
  const kept = keepPoints(cloud, { fraction: 0, rule: "uniform", bias: 0, focus }, frame), keptSet = new Set(kept.indices);
  for (let i = 0; i < 3000; i++) {
    const d = Math.hypot(p[i * 3] - c[0], p[i * 3 + 1] - c[1], p[i * 3 + 2] - c[2]);
    if (d <= R * 0.7) assert.ok(keptSet.has(i), `point ${i} inside the solid core was dropped`);
    if (d >= R) assert.ok(!keptSet.has(i), `point ${i} outside the ball survived Keep 0`);
  }
  assert.ok(keptSet.size > 50);
});

test("dispersion is bounded by amount x spacing, is along the normal at bias 1, identity at 0, and stable per id", () => {
  const described = describePointCloud(pointSubject(spec({ kind: "torus", count: 800 })).cloud, { neighbors: 6 });
  assert.equal(dispersePoints(described, { amount: 0, bias: 0.5 }), described);
  const a = data(described), spacing = attr(described, "spacing");
  for (const bias of [0, 0.5, 1]) {
    const moved = data(dispersePoints(described, { amount: 1.7, bias }));
    let longest = 0;
    for (let i = 0; i < 800; i++) {
      const d = [0, 1, 2].map((c) => moved.positions[i * 3 + c] - a.positions[i * 3 + c]), length = Math.hypot(d[0], d[1], d[2]);
      assert.ok(length <= 1.7 * spacing[i] * (1 + 1e-12), `point ${i}: ${length} > ${1.7 * spacing[i]}`);
      longest = Math.max(longest, length / (1.7 * spacing[i]));
      if (bias === 1) {
        const n = [a.normals![i * 3], a.normals![i * 3 + 1], a.normals![i * 3 + 2]], cross = [d[1] * n[2] - d[2] * n[1], d[2] * n[0] - d[0] * n[2], d[0] * n[1] - d[1] * n[0]];
        near(Math.hypot(...cross), 0, 1e-9);
      }
    }
    assert.ok(longest > 0.6, `offsets use the allowed range (${longest})`);
  }
  const one = selectPoints(described, [5, 9, 100]), again = dispersePoints(one, { amount: 1, bias: 0.3 }), whole = dispersePoints(described, { amount: 1, bias: 0.3 });
  const s = data(whole).positions, t = data(again).positions;
  [5, 9, 100].forEach((from, at) => { for (let c = 0; c < 3; c++) near(t[at * 3 + c], s[from * 3 + c], 1e-12); });
  assert.throws(() => dispersePoints(cloudOf(randomPoints(10, 4)), { amount: 1, bias: 0 }), /spacing/);
  assert.throws(() => dispersePoints(described, { amount: -1, bias: 0 }), /Dispersion/);
});

// ---------------------------------------------------------------------------------------------
// Links

test("links of a full grid of nodes are exactly its edges, each once, with reach and side rules applied", () => {
  const m = 7, points: number[][] = [];
  for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) points.push([x, y, 0]);
  const up = points.map(() => [0, 0, 1]);
  const cloud = cloudOf(points, { normals: up }), set = pointLinks(cloud, { neighbors: 4, reach: 1.01, nodes: 1 });
  assert.equal(set.links.length, 2 * m * (m - 1));
  assert.equal(new Set(set.links.map((l) => l.id)).size, set.links.length);
  for (const l of set.links) { near(l.length, 1); assert.ok(l.a < l.b); }
  assert.equal(pointLinks(cloud, { neighbors: 4, reach: 0.99, nodes: 1 }).links.length, 0, "reach shorter than every gap");
  // Half the points face down: no link joins a point facing up to one facing down.
  const mixed = cloudOf(points, { normals: points.map(([x]) => [0, 0, x < 3 ? 1 : -1]) }), split = pointLinks(mixed, { neighbors: 4, reach: 1.01, nodes: 1 });
  assert.equal(split.links.length, 2 * m * (m - 1) - m);
  for (const l of split.links) assert.equal(points[l.a][0] < 3, points[l.b][0] < 3);
});

test("the node set is nested in Link nodes and limits name their control", () => {
  const cloud = describePointCloud(pointSubject(spec({ kind: "vase", count: 2000 })).cloud, { neighbors: 6 });
  const nodesOf = (share: number) => new Set(pointLinks(cloud, { neighbors: 2, reach: 50, nodes: share }).links.flatMap((l) => [l.a, l.b]));
  const small = nodesOf(0.05), large = nodesOf(0.2);
  for (const node of small) assert.ok(large.has(node));
  assert.ok(pointLinks(cloud, { neighbors: 3, reach: 2, nodes: 0.1 }).nodes > 100);
  assert.equal(pointLinks(cloud, { neighbors: 3, reach: 2, nodes: 0 }).links.length, 0);
  assert.throws(() => pointLinks(cloud, { neighbors: 13, reach: 2, nodes: 0.1 }), /Link neighbors/);
  assert.throws(() => pointLinks(cloud, { neighbors: 3, reach: 0, nodes: 0.1 }), /Link reach/);
  const r = lcg(8), big = cloudOf(Array.from({ length: 40000 }, () => [r(), r(), r()]));
  assert.throws(() => pointLinks(big, { neighbors: 12, reach: 100, nodes: 1 }), (e: Error) => /Link nodes/.test(e.message) && new RegExp(String(MAX_POINT_LINKS)).test(e.message));
});

// ---------------------------------------------------------------------------------------------
// Camera, depth, hidden points

const unitFrame = (): PointFrame => pointFrame(cloudOf([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]));
const view0 = { projection: "orthographic" as const, yaw: 0, pitch: 0, roll: 0, perspective: 3, fit: 0.5, centerX: 300, centerY: 310 };
const noOcclusion = { order: "index" as const, hideBack: false, occluder: null };

test("orthographic front view: canvas position, exact depth range and normalised depth", () => {
  const frame = unitFrame(), camera = pointCamera(frame, view0);
  const cloud = cloudOf([[1, 0, 0], [0, 0.5, 1], [0, 0, -1], [0, 0, 0]], { normals: [[1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 0, 1]] });
  const { points } = viewPoints(cloud, camera, frame, noOcclusion);
  near(points[0].position[0], 300 + 160); near(points[0].position[1], 310);
  near(points[1].position[1], 310 - 80);
  assert.deepEqual(points.map((p) => p.depth01), [0.5, 0, 1, 0.5], "target depth is mid range, the sphere's near and far surfaces are 0 and 1");
  assert.deepEqual(points.map((p) => p.perspective), [1, 1, 1, 1]);
  near(points[1].facing!, 1); near(points[2].facing!, -1);
});

test("perspective fits the sphere's silhouette, not its centre depth, to Size", () => {
  const frame = unitFrame(), D = 3;
  const camera = pointCamera(frame, { ...view0, projection: "perspective", perspective: D });
  const lateral = Math.sqrt(D * D - 1) / D, z = D - (D * D - 1) / D;
  const tangent = cloudOf([[lateral, 0, z]]);
  assert.ok(Math.abs(Math.hypot(lateral, z) - 1) < 1e-12);
  const { points } = viewPoints(tangent, camera, frame, noOcclusion);
  near(points[0].position[0], 300 + 0.5 * 320, 1e-9);
  const target = viewPoints(cloudOf([[0, 0, 0]]), camera, frame, noOcclusion).points[0];
  near(target.depth01, 0.5); near(target.perspective, 1);
  const front = viewPoints(cloudOf([[0.5, 0, 0.5]]), camera, frame, noOcclusion).points[0], back = viewPoints(cloudOf([[0.5, 0, -0.5]]), camera, frame, noOcclusion).points[0];
  assert.ok(front.position[0] - 300 > back.position[0] - 300, "nearer points spread further from the centre");
  near((front.position[0] - 300) / (back.position[0] - 300), (D + 0.5) / (D - 0.5), 1e-9);
  assert.throws(() => pointCamera(frame, { ...view0, projection: "perspective", perspective: 1.01 }), /Eye distance|Perspective/);
});

test("depth ordering: far-to-near is descending depth and thinning or cutting never changes a point's normalised depth", () => {
  const frame = unitFrame(), camera = pointCamera(frame, { ...view0, yaw: 33, pitch: 21, projection: "perspective" });
  const cloud = cloudOf(randomPoints(200, 6).map(([x, y, z]) => [x - 0.5, y - 0.5, z - 0.5]));
  const ordered = viewPoints(cloud, camera, frame, { ...noOcclusion, order: "far-to-near" }).points;
  for (let i = 1; i < ordered.length; i++) assert.ok(ordered[i - 1].depth >= ordered[i].depth);
  const some = selectPoints(cloud, [3, 40, 90, 150]), sub = viewPoints(some, camera, frame, noOcclusion).points;
  const full = new Map(viewPoints(cloud, camera, frame, noOcclusion).points.map((p) => [p.id, p.depth01]));
  for (const p of sub) near(p.depth01, full.get(p.id)!, 1e-12);
});

/** Moller-Trumbore ray/triangle test; hits beyond t = eps count. */
function hitsTriangle(o: number[], d: number[], a: number[], b: number[], c: number[]): boolean {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
  const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(det) < 1e-14) return false;
  const t0 = [o[0] - a[0], o[1] - a[1], o[2] - a[2]], u = (t0[0] * p[0] + t0[1] * p[1] + t0[2] * p[2]) / det;
  if (u < 0 || u > 1) return false;
  const q = [t0[1] * e1[2] - t0[2] * e1[1], t0[2] * e1[0] - t0[0] * e1[2], t0[0] * e1[1] - t0[1] * e1[0]];
  const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
  if (v < 0 || u + v > 1) return false;
  return (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det > 1e-6;
}

test("hidden-point removal by the source surface agrees with brute-force ray casting to the eye, in both projections", () => {
  const mesh = bundledMesh("icosphere", { detail: 3 }), samples = sampleSurface(mesh, { seed: 2, count: 500, normals: "smooth" });
  const described = describePointCloud(samples, { neighbors: 5 }), frame = pointFrame(described), d = meshData(mesh);
  for (const projection of ["orthographic", "perspective"] as const) {
    const camera = pointCamera(frame, { ...view0, projection, yaw: 40, pitch: 25, perspective: 2.5 });
    const seen = new Set(viewPoints(described, camera, frame, { ...noOcclusion, occluder: mesh }).points.map((p) => p.index));
    const p = data(described).positions;
    let disagree = 0;
    for (let i = 0; i < 500; i++) {
      const o = [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
      const dir = projection === "orthographic" ? [-camera.forward[0], -camera.forward[1], -camera.forward[2]] : (() => { const v = [camera.eye[0] - o[0], camera.eye[1] - o[1], camera.eye[2] - o[2]], l = Math.hypot(...v); return v.map((x) => x / l); })();
      let hidden = false;
      for (let t = 0; t < d.triangles.length && !hidden; t += 3) {
        const [a, b, c] = [d.triangles[t], d.triangles[t + 1], d.triangles[t + 2]].map((v) => [d.positions[v * 3], d.positions[v * 3 + 1], d.positions[v * 3 + 2]]);
        hidden = hitsTriangle(o, dir, a, b, c);
      }
      if (seen.has(i) === hidden) disagree++;
    }
    assert.ok(disagree <= 2, `${projection}: ${disagree} of 500 points disagree with ray casting`);
    assert.ok(seen.size > 100 && seen.size < 350, `${projection}: about half of a sphere's points are visible (${seen.size})`);
  }
});

test("Hide back-facing drops exactly the points with facing <= 0, and a cut solid shows its interior only through the cut occluder", () => {
  const subject = pointSubject(spec({ kind: "torus", count: 2500 })), described = describePointCloud(subject.cloud, { neighbors: 6 }), frame = pointFrame(described);
  const camera = pointCamera(frame, { ...view0, yaw: 25, pitch: 30, projection: "perspective", perspective: 4 });
  const all = viewPoints(described, camera, frame, noOcclusion).points, facing = viewPoints(described, camera, frame, { ...noOcclusion, hideBack: true }).points;
  assert.deepEqual(new Set(facing.map((p) => p.index)), new Set(all.filter((p) => p.facing! > 0).map((p) => p.index)));
  const cut = { axis: "x" as const, at: 0, flip: false }, kept = cutPoints(described, cut, frame), sideView = pointCamera(frame, { ...view0, yaw: 90, pitch: 20, projection: "perspective", perspective: 3.5 });
  const uncut = viewPoints(kept, sideView, frame, { ...noOcclusion, occluder: subject.mesh }).points.length;
  const opened = viewPoints(kept, sideView, frame, { ...noOcclusion, occluder: cutMesh(subject.mesh!, cut, frame) }).points.length;
  assert.ok(opened > 2 * uncut && opened > 500, `${opened} interior points visible through the opening versus ${uncut} behind the uncut surface`);
});

// ---------------------------------------------------------------------------------------------
// Mark sites

const style = (over: Partial<PointMarkStyle> = {}): PointMarkStyle => ({ mark: "grain", size: 10, weight: 1, petals: 6, opening: 0.3, axis: "contour", axisTurn: 0, axisJitter: 0,
  localScale: 0, opacity: 1, sizeByDepth: 0, fade: 0, colorBy: "height", blend: "smooth", ...over });
/** One measured point at the origin of a frame, in a five-point described cloud, seen front-on and orthographic. */
function measured(normal: number[], over: Partial<PointMarkStyle>, position = [0, 0, 0]) {
  const points = [position, [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].filter((p, i) => i === 0 || Math.hypot(p[0] - position[0], p[1] - position[1], p[2] - position[2]) > 0.01);
  const normals = points.map((_, i) => (i === 0 ? normal : [0, 0, 1]));
  const cloud = describePointCloud(cloudOf(points, { normals }), { neighbors: 3 }), frame = unitFrame(), camera = pointCamera(frame, view0);
  const viewed = viewPoints(cloud, camera, frame, noOcclusion).points, sites = pointMarkSites(cloud, viewed, camera, style(over), 5);
  return { site: sites.find((s) => s.index === 0), zoom: camera.options.zoom, sites };
}

test("a stroke or arrow is the projection of a world segment: full length across the view, none along it", () => {
  const stroke = measured([0, 0, 1], { mark: "stroke", axis: "x", size: 10 });
  near(stroke.site!.length, 10, 1e-9);
  near(stroke.site!.angle, 0, 1e-12);
  const up = measured([0, 0, 1], { mark: "stroke", axis: "y", size: 10 });
  near(up.site!.angle, -Math.PI / 2, 1e-12);
  const along = measured([0, 1, 0], { mark: "stroke", axis: "z", size: 10 });
  near(along.site!.length, 0, 1e-9);
  const arrow = measured([0, 0, 1], { mark: "arrow", axis: "x", size: 10 });
  near(arrow.site!.scale, 1, 1e-9);
  assert.equal(measured([0, 1, 0], { mark: "arrow", axis: "z", size: 10 }).site, undefined, "an arrow pointing at the eye has no length and is omitted");
  const turned = measured([0, 0, 1], { mark: "stroke", axis: "x", size: 10, axisTurn: 90 });
  near(Math.abs(Math.sin(turned.site!.angle)), 1, 1e-12);
});

test("a disc is a true projected polygon: round facing the eye, area scaled by the cosine of the tilt, nothing edge-on", () => {
  const area = (ring: readonly number[]): number => {
    let sum = 0;
    for (let i = 0; i < ring.length; i += 2) { const j = (i + 2) % ring.length; sum += ring[i] * ring[j + 1] - ring[j] * ring[i + 1]; }
    return Math.abs(sum) / 2;
  };
  const facing = measured([0, 0, 1], { mark: "disc", size: 20 }).site!.ring!;
  for (let i = 0; i < facing.length; i += 2) near(Math.hypot(facing[i], facing[i + 1]), 10, 1e-9);
  const sides = discSides(10), full = sides / 2 * 100 * Math.sin(2 * Math.PI / sides);
  assert.equal(sides, 12);
  assert.deepEqual([0, 3.9, 4, 31.9, 32, 500].map(discSides), [8, 8, 10, 22, 24, 24]);
  assert.equal(facing.length, 2 * sides);
  near(area(facing), full, 1e-9);
  for (const degrees of [30, 60, 80]) {
    const angle = degrees * Math.PI / 180, tilted = measured([0, Math.sin(angle), Math.cos(angle)], { mark: "disc", size: 20 }).site!.ring!;
    near(area(tilted), full * Math.cos(angle), 1e-9);
  }
  near(area(measured([0, 1, 0], { mark: "disc", size: 20 }).site!.ring!), 0, 1e-9);
});

test("depth size factor, fade and local scale follow their formulas", () => {
  const frame = unitFrame(), camera = pointCamera(frame, view0);
  const cloud = describePointCloud(cloudOf([[0, 0, 1], [0, 0, -1], [0.5, 0, 0], [-0.5, 0, 0], [0, 0.5, 0.2]], { normals: Array.from({ length: 5 }, () => [0, 0, 1]) }), { neighbors: 3 });
  const viewed = viewPoints(cloud, camera, frame, noOcclusion).points;
  const sites = pointMarkSites(cloud, viewed, camera, style({ sizeByDepth: 0.4, fade: 0.5, opacity: 0.8 }), 5);
  const nearSite = sites.find((s) => s.index === 0)!, farSite = sites.find((s) => s.index === 1)!;
  near(nearSite.scale, 1.4); near(farSite.scale, 0.6);
  near(nearSite.opacity!, 0.8); near(farSite.opacity!, 0.8 * 0.5);
  const dead = pointMarkSites(cloud, viewed, camera, style({ fade: 1 }), 5);
  assert.ok(!dead.some((s) => s.index === 1), "a point that fades to nothing is omitted");
  const spacing = attr(cloud, "spacing"), sorted = Array.from(spacing).sort((a, b) => a - b), median = sorted[2];
  const local = pointMarkSites(cloud, viewed, camera, style({ localScale: 1 }), 5);
  for (const s of local) near(s.scale, Math.min(2.5, Math.max(0.4, spacing[s.index] / median)), 1e-12);
});

test("colour: ramp indices for height, bands, depth and per-point picks", () => {
  assert.equal(rampIndex(0, 5, "smooth"), 0);
  assert.equal(rampIndex(1, 5, "smooth"), 48);
  assert.equal(rampIndex(0.5, 5, "smooth"), 24);
  assert.equal(rampIndex(0.6, 5, "bands"), 24, "0.6 x 4 = 2.4 rounds to palette entry 2, ramp index 24");
  assert.equal(rampIndex(0.7, 5, "bands"), 36, "0.7 x 4 = 2.8 rounds to entry 3");
  assert.equal(rampIndex(-3, 5, "smooth"), 0);
  assert.equal(rampIndex(0.4, 1, "smooth"), 0);
  assert.equal(pointPaletteRamp([0x000000, 0xffffff]).length, 13);
  assert.equal(pointPaletteRamp([0x102030, 0xf0e0d0, 0x334455])[0], 0x102030);
  assert.equal(pointPaletteRamp([0x102030, 0xf0e0d0, 0x334455])[12], 0xf0e0d0);
  const { sites } = measured([0, 0, 1], { colorBy: "depth" });
  const byIndex = new Map(sites.map((s) => [s.index, s.tone]));
  assert.ok(byIndex.get(5)! > byIndex.get(6)!, "the nearer point (+z, index 5) gets the later colour than the far one (-z, index 6)");
  const parts = pointSubject(spec({ kind: "figure", count: 400 }));
  const described = describePointCloud(parts.cloud, { neighbors: 5 }), frame = pointFrame(described), camera = pointCamera(frame, view0);
  const viewed = viewPoints(described, camera, frame, noOcclusion).points, tones = new Set(pointMarkSites(described, viewed, camera, style({ colorBy: "part" }), 5).map((s) => s.tone));
  assert.ok(tones.size === 5 && [...tones].every((t) => t! % 12 === 0), "seven parts cycle through five whole palette entries");
});

// ---------------------------------------------------------------------------------------------
// Composition: caching, camera separation, drawing

function input(over: Record<string, number | string | boolean> = {}, seed = 42): InstrumentInput {
  const base = createInstrument(ID);
  return { ...base, seed, params: { ...base.params, ...over } };
}
function recorder() {
  const calls: { name: string; args: unknown[] }[] = [];
  const surface = new Proxy({ CLOSE: "close", ROUND: "round" }, {
    get(target, key) { return key in target ? (target as Record<string | symbol, unknown>)[key] : (...args: unknown[]) => { calls.push({ name: String(key), args }); }; },
  }) as unknown as CompositionSurface;
  return { surface, calls };
}

test("camera and appearance edits return the same frozen products; structural edits rebuild exactly what they touch", () => {
  const base = pointCloudProducts(pointCloudsComposition(input()));
  const same = (over: Record<string, number | string | boolean>, palette?: number[]) => {
    const i = input(over); if (palette) i.palette = palette;
    return pointCloudProducts(pointCloudsComposition(i));
  };
  for (const over of [{ yaw: 80 }, { pitch: -20 }, { roll: 30 }, { projection: "orthographic" }, { perspective: 2 }, { fit: 1.2 }, { centerX: 200 }, { mark: "stroke" }, { markSize: 3 },
    { colorBy: "depth" }, { blend: "bands" }, { fade: 0.9 }, { sizeByDepth: 0.5 }, { opacity: 0.3 }, { linkWeight: 2 }, { linkColor: "cloud" }, { outline: "features" }, { hideBack: true }, { sort: false }, { localScale: 1 }])
    assert.equal(same(over), base, JSON.stringify(over));
  assert.equal(same({}, [0x111111, 0xeeeeee]), base, "palette");
  assert.throws(() => (base.cloud as unknown as { count: number }).count = 3, TypeError);
  for (const over of [{ count: 3000 }, { keep: 0.5 }, { cut: "x" }, { dispersion: 0.5 }, { neighbors: 5 }, { subject: "torus" }, { linkNodes: 0.1 }, { linkReach: 4 }, { thinRule: "features", keep: 0.5 }, { focus: "ball", keep: 0.5 }]) {
    const other = same(over);
    assert.notEqual(other, base, JSON.stringify(over));
    assert.notEqual(other.cloud.key, base.cloud.key + "x");
  }
  assert.equal(same({ linkNodes: 0.06 }).subject, base.subject, "link edits keep the subject");
  assert.equal(same({ keep: 0.5 }).described, base.described, "thinning keeps the estimates");
  assert.equal(same({ links: "none" }).links, null);
  assert.equal(same({ subject: "vase", linkNeighbors: 5 }).kept, base.kept, "link edits keep the thinning");
});

test("the camera stage is reused for appearance edits and rebuilt for camera edits; nothing in it changes the points", () => {
  const recipe = pointCloudsComposition(input()), products = pointCloudProducts(recipe), scene = pointCloudScene(recipe, products);
  const recolored = pointCloudScene(pointCloudsComposition({ ...input({ colorBy: "depth", markSize: 5, mark: "grain" }), palette: [0x000000, 0x00ff00] }), products);
  assert.equal(recolored.view, scene.view, "same viewed points");
  assert.equal(recolored.camera.key, scene.camera.key);
  const turned = pointCloudScene(pointCloudsComposition(input({ yaw: 100 })), products);
  assert.notEqual(turned.view, scene.view);
  assert.deepEqual(new Set(turned.view.points.map((p) => p.id)).size > 0, true);
  assert.equal(pointCloudProducts(pointCloudsComposition(input({ yaw: 100 }))), products);
});

test("depth is real: turning the camera changes which points are hidden and their order, not the population", () => {
  const front = pointCloudScene(pointCloudsComposition(input({ yaw: 0, links: "none" })), pointCloudProducts(pointCloudsComposition(input({ yaw: 0, links: "none" }))));
  const back = pointCloudScene(pointCloudsComposition(input({ yaw: 180, links: "none" })), pointCloudProducts(pointCloudsComposition(input({ yaw: 180, links: "none" }))));
  const frontIds = new Set(front.sites.map((s) => s.id)), backIds = new Set(back.sites.map((s) => s.id));
  const shared = [...frontIds].filter((id) => backIds.has(id)).length;
  assert.ok(front.sites.length > 500 && back.sites.length > 500);
  assert.ok(shared < 0.35 * front.sites.length, `${shared} of ${front.sites.length} points are visible from both sides of a closed-ish vase`);
  for (let i = 1; i < front.sites.length; i++) assert.ok(front.sites[i - 1].depth >= front.sites[i].depth, "painter order");
});

test("drawing: one mark per visible point in far-to-near order with links between, a transparent layer, replaceable consumers", () => {
  const i = input({ mark: "disc", links: "nearest", linkNodes: 0.1 });
  const recipe = pointCloudsComposition(i), products = pointCloudProducts(recipe), scene = pointCloudScene(recipe, products);
  const { surface, calls } = recorder();
  drawInstrument(surface as never, i);
  assert.equal(calls.filter((c) => c.name === "endShape").length, scene.sites.length);
  assert.equal(calls.filter((c) => c.name === "line").length, scene.links.length);
  assert.ok(scene.links.length > 20);
  assert.ok(!calls.some((c) => c.name === "background" || c.name === "rect" || c.name === "clear"), "transparent layer");
  const seen: { id: string; depth: number }[] = [], linksSeen: string[] = [];
  const custom = recorder();
  drawPointClouds(custom.surface, recipe, { mark: (_s, site) => { seen.push({ id: site.id, depth: site.depth }); }, link: (_s, path) => { linksSeen.push(path.id); } });
  assert.deepEqual(seen.map((s) => s.id), scene.sites.map((s) => s.id));
  assert.deepEqual(linksSeen.sort(), scene.links.map((l) => l.id).sort());
  for (let k = 1; k < seen.length; k++) assert.ok(seen[k - 1].depth >= seen[k].depth);
  assert.ok(!custom.calls.some((c) => c.name === "endShape"), "no stock disc when the mark is replaced");
});

test("links are painted in the same far-to-near sequence as marks, lifted toward the eye", () => {
  const recipe = pointCloudsComposition(input({ links: "nearest", linkNodes: 0.2, mark: "grain" })), scene = pointCloudScene(recipe, pointCloudProducts(recipe));
  const order: string[] = [];
  drawPointClouds(recorder().surface, recipe, { mark: (_s, site) => { order.push(`s${site.depth}`); }, link: (_s, path) => { order.push(`l${(path as { order: number }).order}`); } });
  assert.equal(order.length, scene.sites.length + scene.links.length);
  const keys = order.map((o) => Number(o.slice(1)));
  for (let k = 1; k < keys.length; k++) assert.ok(keys[k - 1] >= keys[k], "interleaved keys never increase");
  assert.ok(order.some((o) => o[0] === "l") && order.some((o) => o[0] === "s"));
  for (const link of scene.links) assert.ok((link as { order: number }).order < link.depth, "lifted toward the eye");
});

test("a cut reaches the occluder: a cut solid shows its interior through the opening, the uncut one hides it", () => {
  const over = { subject: "torus", count: 3000, cut: "x", cutAt: 0, yaw: 90, pitch: 20, perspective: 3.5, links: "none", hideBehind: true };
  const recipe = pointCloudsComposition(input(over)), products = pointCloudProducts(recipe), mesh = products.subject.mesh!;
  assert.ok(products.occluder!.faceCount < mesh.faceCount && products.occluder!.faceCount > 0);
  assert.equal(pointCloudProducts(pointCloudsComposition(input({ ...over, cut: "none" }))).occluder, mesh, "no cut, the source surface itself");
  const scene = pointCloudScene(recipe, products);
  const behindUncut = viewPoints(products.cloud, scene.camera, products.frame, { order: "index", hideBack: false, occluder: mesh }).points.length;
  assert.ok(scene.view.points.length > 2 * behindUncut && scene.view.points.length > 500, `${scene.view.points.length} visible with the cut occluder, ${behindUncut} with the whole surface`);
  const back = { ...over, hideBehind: false }, all = pointCloudScene(pointCloudsComposition(input(back)), pointCloudProducts(pointCloudsComposition(input(back)))).view.points.length;
  assert.ok(all >= scene.view.points.length, "hiding never adds points");
});

test("the outline is drawn last, from the source surface, and is a separate switch", () => {
  const i = input({ subject: "figure", mark: "none", links: "none", outline: "features", outlineHidden: "dashed" });
  const { surface, calls } = recorder();
  drawInstrument(surface as never, i);
  assert.ok(calls.filter((c) => c.name === "endShape" || c.name === "line").length > 20, "outline runs alone are a drawing");
  const none = recorder();
  drawInstrument(none.surface as never, input({ subject: "figure", mark: "none", links: "none", outline: "none" }));
  assert.equal(none.calls.filter((c) => c.name === "endShape" || c.name === "line" || c.name === "circle").length, 0);
  const galaxy = recorder();
  drawInstrument(galaxy.surface as never, input({ subject: "galaxy", mark: "none", links: "none", outline: "features" }));
  assert.equal(galaxy.calls.filter((c) => c.name === "endShape" || c.name === "line").length, 0, "no surface, no outline");
});

test("empty results are valid drawings and tiny clouds work", () => {
  const empty = recorder();
  drawInstrument(empty.surface as never, input({ keep: 0, links: "none" }));
  assert.equal(empty.calls.filter((c) => ["circle", "endShape", "line", "rect"].includes(c.name)).length, 0);
  for (const count of [1, 2, 3]) {
    const c = recorder();
    assert.doesNotThrow(() => drawInstrument(c.surface as never, input({ count, links: "nearest", linkNodes: 1, neighbors: 4 })));
  }
  const focusOnly = recorder();
  drawInstrument(focusOnly.surface as never, input({ keep: 0, links: "none", focus: "ball", focusRadius: 0.2, focusFalloff: 0, focusY: 0.9, mark: "grain" }));
  const n = focusOnly.calls.filter((c) => c.name === "circle").length;
  assert.ok(n > 10 && n < 600, `only the dense region remains (${n})`);
});

// ---------------------------------------------------------------------------------------------
// The instrument

test("definition, groups, work bounds and admission", () => {
  const i = createInstrument(ID);
  assert.equal(definition(ID).title, "Point Clouds");
  assert.deepEqual(validateInstrument(i).params, i.params);
  assert.equal(canPrepareInstrument(ID), true);
  const groups = inspectorItems(ID, i.params).map((g) => ("label" in g ? g.label : ""));
  assert.deepEqual(groups.slice(0, 3), ["Subject", "Placement", "Thinning"]);
  assert.equal(groups.at(-1), "View");
  assert.throws(() => validateParameters(ID, { ...i.params, count: 40001 }), /count/);
  assert.throws(() => validateParameters(ID, { ...i.params, count: 3.5 }), /integer/);
  assert.throws(() => validateParameters(ID, { ...i.params, neighbors: 2 }), /neighbors/);
  assert.throws(() => validateParameters(ID, { ...i.params, count: 30000, linkNodes: 0.5, linkNeighbors: 12 }), (e: Error) => /Points/.test(e.message) && /Link nodes/.test(e.message) && /Link neighbors/.test(e.message));
  assert.doesNotThrow(() => validateParameters(ID, { ...i.params, count: 30000, linkNodes: 0.5, linkNeighbors: 12, links: "none" }));
  assert.equal(usesSeed(i), true);
  const proportional = JSON.stringify(definition(ID).controlGroups).match(/"proportional":true/g) ?? [];
  assert.equal(proportional.length, 1);
});

test("declared visibility follows the selections", () => {
  const values = { ...createInstrument(ID).params };
  const shown = (over: Record<string, number | string | boolean>) => new Set(visibleParameters(ID, { ...values, ...over }).map((p) => p.key));
  assert.ok(shown({ subject: "vase" }).has("vaseProfile") && !shown({ subject: "galaxy" }).has("vaseProfile"));
  assert.ok(shown({ subject: "galaxy" }).has("arms") && !shown({ subject: "vase" }).has("arms"));
  assert.ok(!shown({ subject: "galaxy" }).has("hideBehind") && !shown({ subject: "galaxy" }).has("outline") && !shown({ subject: "galaxy" }).has("distribution"));
  assert.ok(!shown({ subject: "galaxy", outline: "features" }).has("creaseAngle"), "a hidden driver hides its dependents");
  assert.ok(shown({ subject: "figure", outline: "features" }).has("creaseAngle") && !shown({ subject: "figure", outline: "silhouette" }).has("creaseAngle"));
  assert.ok(!shown({ thinRule: "uniform" }).has("thinBias") && shown({ thinRule: "features" }).has("thinBias"));
  assert.ok(!shown({ focus: "none" }).has("focusX") && shown({ focus: "ball" }).has("focusRadius"));
  assert.ok(!shown({ cut: "none" }).has("cutAt") && shown({ cut: "y" }).has("cutFlip"));
  assert.ok(!shown({ mark: "grain" }).has("axis") && shown({ mark: "stroke" }).has("axisJitter") && !shown({ mark: "disc" }).has("petals") && shown({ mark: "rosette" }).has("petals"));
  assert.ok(!shown({ mark: "none" }).has("markSize") && !shown({ links: "none" }).has("linkReach") && !shown({ projection: "orthographic" }).has("perspective"));
});

test("a hidden control never changes the drawing, and the same control changes it when shown", () => {
  const print = (over: Record<string, number | string | boolean>) => drawFingerprint(input(over));
  const pairs: [Record<string, number | string | boolean>, string, number | string | boolean][] = [
    [{ subject: "galaxy" }, "hideBehind", false], [{ subject: "galaxy" }, "outline", "features"], [{ subject: "galaxy" }, "vaseProfile", "urn"], [{ subject: "galaxy" }, "distribution", "random"],
    [{ subject: "vase" }, "arms", 5], [{ subject: "vase" }, "noiseScale", 4], [{ subject: "figure" }, "vaseProfile", "urn"], [{ subject: "figure" }, "terrainVariant", "dunes"],
    [{ thinRule: "uniform", keep: 0.6 }, "thinBias", 1.4], [{ focus: "none", keep: 0.6 }, "focusRadius", 0.9], [{ cut: "none" }, "cutAt", 0.6], [{ cut: "none" }, "cutFlip", true],
    [{ mark: "grain" }, "markWeight", 2.5], [{ mark: "grain" }, "axis", "fall"], [{ mark: "disc" }, "petals", 9], [{ mark: "disc" }, "axisJitter", 60], [{ mark: "stroke" }, "opening", 0.8],
    [{ links: "none" }, "linkReach", 5], [{ links: "none" }, "linkColor", "cloud"], [{ projection: "orthographic" }, "perspective", 2], [{ outline: "none", subject: "figure" }, "creaseAngle", 90],
    [{ mark: "none", links: "none" }, "markSize", 20], [{ mark: "none", links: "none" }, "localScale", 1],
  ];
  for (const [base, key, value] of pairs) {
    assert.ok(!new Set(visibleParameters(ID, { ...input(base).params }).map((p) => p.key)).has(key), `${key} is hidden under ${JSON.stringify(base)}`);
    assert.equal(print({ ...base, [key]: value }), print(base), `${key} changed the drawing while hidden under ${JSON.stringify(base)}`);
  }
  const shownPairs: [Record<string, number | string | boolean>, string, number | string | boolean][] = [
    [{ thinRule: "features", keep: 0.6 }, "thinBias", 1.4], [{ focus: "ball", keep: 0.4 }, "focusRadius", 0.9], [{ cut: "x" }, "cutAt", 0.6], [{ mark: "stroke" }, "axis", "fall"],
    [{ mark: "rosette" }, "petals", 9], [{ links: "nearest" }, "linkReach", 5], [{ projection: "perspective" }, "perspective", 2], [{ subject: "figure", outline: "features" }, "creaseAngle", 90],
  ];
  for (const [base, key, value] of shownPairs) assert.notEqual(print({ ...base, [key]: value }), print(base), `${key} does nothing while shown under ${JSON.stringify(base)}`);
});

test("structural seed variation and determinism", () => {
  const a = drawFingerprint(input({}, 1)), b = drawFingerprint(input({}, 2));
  assert.notEqual(a, b);
  assert.equal(drawFingerprint(input({}, 1)), a);
  for (const subject of ["terrain", "galaxy", "noise-volume"]) assert.notEqual(drawFingerprint(input({ subject }, 1)), drawFingerprint(input({ subject }, 2)), subject);
});

test("prepare warms the caches and honours cancellation", async () => {
  const i = input({ count: 1500 });
  assert.equal(await prepareInstrument(i, () => false), true);
  assert.equal(await prepareInstrument(input({ count: 1600 }), () => true), false);
  let calls = 0;
  assert.equal(await prepareInstrument(input({ count: 1700 }), () => ++calls > 1), false);
});
