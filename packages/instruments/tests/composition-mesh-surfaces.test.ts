import assert from "node:assert/strict";
import test from "node:test";
import {
  HELICOID, SCROLL, icospherePatchMesh, icosphereMesh, meshBoundaryEdges, meshData, meshMeasures, meshTopology, meshVertex, parametricSheetMesh,
  sheetKinds, sheetWaves, vaseMesh, vaseProfiles, vertexNormals,
} from "../dist/index.js";

const asinh = Math.asinh;

test("the helicoid strip has the closed-form area and the area error falls as 1/n^2", () => {
  const { halfWidth: w, height: h, turns: k } = HELICOID;
  const exact = 2 * (w * Math.sqrt(h * h + k * k * w * w) + (h * h / k) * asinh(k * w / h));
  const errors = [40, 80, 160].map((n) => Math.abs(meshMeasures(parametricSheetMesh({ kind: "twist", columns: n, rows: n })).area - exact) / exact);
  assert.ok(errors[2] < 2e-3, `relative error ${errors[2]}`);
  assert.ok(errors[1] < errors[0] / 3 && errors[2] < errors[1] / 3, `errors ${errors.join(", ")} should shrink about 4x per doubling`);
});

test("the scroll has area height x spiral length and its layers keep the stated gap", () => {
  const b = SCROLL.gap / (2 * Math.PI), r0 = SCROLL.inner, r1 = SCROLL.inner + SCROLL.gap * SCROLL.turns;
  const arc = (r: number) => (r * Math.sqrt(r * r + b * b) + b * b * asinh(r / b)) / (2 * b);
  const exact = SCROLL.height * (arc(r1) - arc(r0));
  const m = parametricSheetMesh({ kind: "scroll", columns: 400, rows: 4 });
  assert.ok(Math.abs(meshMeasures(m).area - exact) / exact < 2e-3, `${meshMeasures(m).area} vs ${exact}`);
  // Every vertex sits on the spiral: its radius is inner + gap * (turn count), where the turn count is theta / 2 pi.
  for (let i = 0; i < m.vertexCount; i += 5) {
    const [x, , z] = meshVertex(m, i), theta = Math.atan2(-z, x), turns = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI);
    const radius = Math.hypot(x, z), layer = (radius - SCROLL.inner) / SCROLL.gap - turns;
    assert.ok(Math.abs(layer - Math.round(layer)) < 1e-9, `vertex ${i} is off the spiral by ${layer}`);
  }
});

test("saddle and waves are height fields with the stated formulas; every sheet is an open disc", () => {
  const saddle = parametricSheetMesh({ kind: "saddle", columns: 8, rows: 8 });
  const at = (i: number, j: number) => meshVertex(saddle, j * 9 + i);
  assert.deepEqual(at(8, 4), [2, 1, 0], "x = 2, z = 0: y = 1");
  assert.deepEqual(at(4, 8), [0, -1, 2], "x = 0, z = 2: y = -1");
  assert.deepEqual(at(8, 8), [2, 0, 2]);
  const terms = sheetWaves(5), waves = parametricSheetMesh({ kind: "waves", columns: 6, rows: 6, seed: 5 });
  for (let v = 0; v < waves.vertexCount; v += 3) {
    const [x, y, z] = meshVertex(waves, v);
    const expected = terms.reduce((sum, [amp, kx, kz, phase]) => sum + amp * Math.sin(kx * x + kz * z + phase), 0);
    assert.ok(Math.abs(y - expected) < 1e-12);
  }
  assert.notEqual(parametricSheetMesh({ kind: "waves", columns: 6, rows: 6, seed: 6 }).key, waves.key, "the seed changes the waves");
  assert.equal(parametricSheetMesh({ kind: "saddle", columns: 6, rows: 6, seed: 6 }).key, parametricSheetMesh({ kind: "saddle", columns: 6, rows: 6, seed: 7 }).key, "only waves reads the seed");
  const centre = (kind: (typeof sheetKinds)[number]) => { const m = parametricSheetMesh({ kind, columns: 8, rows: 8 }), n = vertexNormals(m); return [n[40 * 3], n[40 * 3 + 1], n[40 * 3 + 2]].map((v) => Math.round(v * 100) / 100); };
  assert.deepEqual(centre("saddle"), [0, 1, 0]);
  assert.deepEqual(centre("twist"), [0, 0, -1]);
  assert.deepEqual(centre("scroll"), [-0.03, 0, 1], "the roll faces its axis: at the vertex on the -z side the normal is +z");
  for (const kind of sheetKinds) {
    const m = parametricSheetMesh({ kind, columns: 12, rows: 7 }), t = meshTopology(m);
    assert.equal(t.kind, "open-manifold", kind);
    assert.equal(t.counts.euler, 1, kind);
    assert.equal(meshBoundaryEdges(t).length, 2 * (12 + 7), kind);
    assert.equal(m.quadCount, 12 * 7);
  }
});

test("the icosphere patch keeps exactly the triangles inside the cap and measures the cap's area", () => {
  assert.equal(icospherePatchMesh(3, 180).key, icosphereMesh(3).key, "180 degrees is the whole sphere");
  const half = 60, patch = icospherePatchMesh(5, half), whole = icosphereMesh(5), data = meshData(patch), all = meshData(whole);
  const centroidCos = (positions: Float64Array, triangles: number[], t: number) => {
    let x = 0, y = 0, z = 0;
    for (let c = 0; c < 3; c++) { const v = triangles[t * 3 + c]; x += positions[v * 3]; y += positions[v * 3 + 1]; z += positions[v * 3 + 2]; }
    return y / Math.hypot(x, y, z);
  };
  const limit = Math.cos(half * Math.PI / 180);
  let expected = 0;
  for (let t = 0; t < all.triangles.length / 3; t++) if (centroidCos(all.positions, all.triangles, t) >= limit) expected++;
  assert.equal(data.triangles.length / 3, expected);
  for (let t = 0; t < data.triangles.length / 3; t++) assert.ok(centroidCos(data.positions, data.triangles, t) >= limit);
  const topology = meshTopology(patch);
  assert.equal(topology.kind, "open-manifold");
  assert.equal(topology.counts.euler, 1, "a cap is a disc");
  const cap = 2 * Math.PI * (1 - Math.cos(half * Math.PI / 180));
  assert.ok(Math.abs(meshMeasures(patch).area - cap) / cap < 0.03, `${meshMeasures(patch).area} vs the cap ${cap}`);
  assert.throws(() => icospherePatchMesh(0, 5), /selects no triangle/);
  assert.throws(() => icospherePatchMesh(3, 0), /half angle/);
});

test("vase smooth = 1 is the original profile; k > 1 keeps every knot exactly and turns the profile smoothly", () => {
  assert.equal(vaseMesh({ profile: "urn", slices: 12, smooth: 1 }).key, vaseMesh({ profile: "urn", slices: 12 }).key);
  const k = 4, height = 2, radius = 0.6, refined = vaseMesh({ profile: "urn", slices: 12, smooth: k });
  const rings = new Map<number, number>();
  for (let v = 0; v < refined.vertexCount; v++) {
    const [x, y, z] = meshVertex(refined, v);
    if (Math.hypot(x, z) > 1e-9) rings.set(Math.round(y * 1e9), Math.hypot(x, z));
  }
  const knots = vaseProfiles.urn;
  assert.equal(rings.size, k * (knots.length - 1) + 1, "k rings per band plus the last knot");
  for (const [axial, r] of knots) {
    const found = rings.get(Math.round((axial - 0.5) * height * 1e9));
    assert.ok(found !== undefined && Math.abs(found - r * radius) < 1e-12, `knot at ${axial}`);
  }
  // Slope continuity at interior knots (the unrefined profile has corners there): the slopes of the last and next ring segments agree.
  const levels = [...rings.entries()].sort((a, b) => a[0] - b[0]).map(([y, r]) => [y / 1e9, r] as const);
  const smooth = 8, fine = vaseMesh({ profile: "urn", slices: 12, smooth });
  const fineRings = new Map<number, number>();
  for (let v = 0; v < fine.vertexCount; v++) { const [x, y, z] = meshVertex(fine, v); if (Math.hypot(x, z) > 1e-9) fineRings.set(Math.round(y * 1e9), Math.hypot(x, z)); }
  const ordered = [...fineRings.entries()].sort((a, b) => a[0] - b[0]).map(([y, r]) => [y / 1e9, r] as const);
  let worst = 0;
  for (let band = 1; band < knots.length - 1; band++) {
    const i = band * smooth, before = (ordered[i][1] - ordered[i - 1][1]) / (ordered[i][0] - ordered[i - 1][0]), after = (ordered[i + 1][1] - ordered[i][1]) / (ordered[i + 1][0] - ordered[i][0]);
    worst = Math.max(worst, Math.abs(after - before));
  }
  const rawSlope = (band: number) => { const a = knots[band], b = knots[band + 1]; return (b[1] - a[1]) * radius / ((b[0] - a[0]) * height); };
  const corner = Math.max(...[1, 2, 3, 4].map((band) => Math.abs(rawSlope(band) - rawSlope(band - 1))));
  assert.ok(worst < corner / 4, `refined slope jump ${worst} vs the unrefined corner ${corner}`);
  assert.ok(levels.every(([, r]) => r > 0));
  assert.throws(() => vaseMesh({ profile: "urn", smooth: 9 }), /smooth/);
});
