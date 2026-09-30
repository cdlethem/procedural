import assert from "node:assert/strict";
import test from "node:test";
import {
  GROWTH_LIMITS, bundledGrowthSeed, canPrepareInstrument, checkSimulation, createInstrument, definitions, drawInstrument, gridGrowthField, growthField, growthSeed,
  grownSurface, hingeAngle, icosphereMesh, inspectorItems, mergeMeshes, mesh, meshAttribute, meshBoundaryEdges, meshTopology, prepareInstrument, prepareSurfaceGrowth,
  runSimulation, stateAt, surfaceGrowthCache, surfaceGrowthComposition, surfaceGrowthRun, surfaceGrowthSimulation, surfaceGrowthSnapshots, transformMesh,
  usesSeed, validateInstrument, validateParameters, visibleParameters, GROWTH_RETENTION,
  type CompositionSurface, type GrowthControls, type GrowthField, type GrowthSeed, type InstrumentInput,
} from "../dist/index.js";
import { meshStorage } from "../dist/composition/mesh.js";
import { meshEdgeVertices as edgeVertices } from "../dist/composition/mesh-topology.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";

const seedOf = (kind: "sheet" | "disc" | "strip" | "sphere", resolution: number): GrowthSeed => bundledGrowthSeed(kind, resolution);
const uniform = (seed: GrowthSeed, baseline = 0): GrowthField => growthField({ regions: [{ kind: "uniform" }], combine: "max", baseline }, seed, 1);
const controls = (seed: GrowthSeed, over: Partial<GrowthControls> = {}): GrowthControls => ({
  rate: 0.02, limit: 3, bending: 0.0004, sweeps: 12, pin: "none", perturb: 0, refine: false, edgeLimit: 1.6, maxVertices: seed.mesh.vertexCount, thickness: 0, ...over,
});
const positionsOf = (snaps: { steps: number }, step?: number) => (stateAt(snaps as never, step ?? snaps.steps) as { pos: Float64Array; n: number }).pos;
const smooth = (t: number): number => { const s = Math.min(1, Math.max(0, t)); return s * s * (3 - 2 * s); };

/* ------------------------------------------------------------------------------------- seeds */

test("bundled seeds have the counts, areas and orientation of their construction", () => {
  const n = 7, sheet = seedOf("sheet", n), t = meshTopology(sheet.mesh);
  assert.equal(sheet.mesh.vertexCount, (n + 1) ** 2);
  assert.equal(t.counts.faces, 2 * n * n);
  assert.equal(t.counts.edges, 3 * n * n + 2 * n);
  assert.equal(t.counts.euler, 1);
  assert.equal(meshBoundaryEdges(t).length, 4 * n);
  assert.equal(sheet.pins.rim.length, 4 * n);
  assert.equal(sheet.pins.side.length, n + 1);
  assert.equal(sheet.pins.center.length, 1, "the center pin is the vertex nearest the middle, lowest index among ties");
  assert.equal(sheet.pins.center[0], 3 * (n + 1) + 3, "of the four vertices around the middle of a 7-cell sheet, the first");
  const normals = meshStorage(sheet.mesh);
  assert.ok(normals.positions.every((v, i) => i % 3 !== 1 || v === 0), "the sheet lies in the XZ plane");
  const even = seedOf("sheet", 8);
  assert.deepEqual(Array.from(meshStorage(even.mesh).positions.slice(even.pins.center[0] * 3, even.pins.center[0] * 3 + 3)), [0, 0, 0]);

  const rings = 5, disc = seedOf("disc", 2 * rings), d = meshTopology(disc.mesh);
  assert.equal(disc.mesh.vertexCount, 1 + 3 * rings * (rings + 1));
  assert.equal(d.counts.faces, 6 * rings * rings);
  assert.equal(d.counts.euler, 1);
  // the triangles tile the regular polygon of the outermost ring
  const polygon = (6 * rings / 2) * Math.sin(2 * Math.PI / (6 * rings));
  let area = 0;
  const store = meshStorage(disc.mesh);
  for (let f = 0; f < disc.mesh.triangleCount; f++) {
    const [a, b, c] = [0, 1, 2].map((k) => store.triangles[f * 3 + k] * 3);
    const p = store.positions;
    const ux = p[b] - p[a], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vz = p[c + 2] - p[a + 2];
    const cross = uz * vx - ux * vz; // +Y normal of (u x v)
    assert.ok(cross > 0, "every disc triangle faces +Y");
    area += cross / 2;
  }
  assert.ok(Math.abs(area - polygon) < 1e-12, `${area} vs ${polygon}`);

  const sphere = seedOf("sphere", 10), s = meshTopology(sphere.mesh);
  assert.equal(s.kind, "closed-manifold");
  assert.equal(sphere.mesh.vertexCount, 42);
  assert.equal(s.counts.euler, 2);
  assert.equal(sphere.boundary.length, 0);
  assert.equal(sphere.pins.rim.length, 0);
});

test("a caller's mesh is accepted only when growth can give every edge a rest length", () => {
  const box = mesh({ id: "box", positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], quads: [0, 1, 2, 3] });
  assert.throws(() => growthSeed(box), /quads/);
  const fan = mesh({ id: "fan", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1], triangles: [0, 1, 2, 1, 0, 3, 0, 1, 4] });
  assert.throws(() => growthSeed(fan), /non-manifold/);
  const flipped = mesh({ id: "flip", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], triangles: [0, 1, 2, 1, 2, 3] });
  assert.throws(() => growthSeed(flipped), /inconsistent-orientation/);
  const loose = mesh({ id: "loose", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 5, 5], triangles: [0, 1, 2] });
  assert.throws(() => growthSeed(loose), /no face uses/);
  assert.throws(() => bundledGrowthSeed("sheet", 3), /Resolution/);
});

/* ------------------------------------------------------------------------------------ fields */

test("field regions take the analytic values of their definitions", () => {
  const sheet = seedOf("sheet", 8);
  const edge = growthField({ regions: [{ kind: "edge", width: 0.5 }], combine: "max", baseline: 0 }, sheet, 1);
  assert.equal(edge.sample(1, 0, 0.3), 1, "on the boundary");
  assert.equal(edge.sample(0, 0, 0), 0, "farther than the width from every side");
  const d = 0.2; // distance from the side x = 1
  assert.ok(Math.abs(edge.sample(1 - d, 0, 0.1) - smooth(1 - d / 0.5)) < 1e-12);
  assert.ok(Math.abs(edge.sample(0.9, 0, 0.95) - smooth(1 - 0.05 / 0.5)) < 1e-12, "the nearer side decides in a corner");

  const ring = growthField({ regions: [{ kind: "radial", centerX: 0.25, centerY: -0.25, radius: 0.5, width: 0.2 }], combine: "max", baseline: 0 }, sheet, 1);
  assert.ok(Math.abs(ring.sample(0.25 + 0.5, 0, -0.25) - 1) < 1e-15, "on the ring");
  assert.ok(Math.abs(ring.sample(0.25 + 0.5 + 0.2, 0, -0.25) - Math.exp(-0.5)) < 1e-15, "one width outside");
  assert.ok(Math.abs(ring.sample(0.25, 0, -0.25) - Math.exp(-0.5 * (0.5 / 0.2) ** 2)) < 1e-15, "at the center");

  const sphere = seedOf("sphere", 10);
  const cap = growthField({ regions: [{ kind: "radial", centerX: 0, centerY: 0, radius: 0, width: 0.3 }], combine: "max", baseline: 0 }, sphere, 1);
  assert.equal(cap.sample(0, 1, 0), 1, "on a sphere the center sits on the surface above its point (the pole)");
  assert.ok(Math.abs(cap.sample(0, -1, 0) - Math.exp(-0.5 * (2 / 0.3) ** 2)) < 1e-15);

  const smoothStripes = growthField({ regions: [{ kind: "stripes", count: 4, angle: 0, sharpness: 0 }], combine: "max", baseline: 0 }, sheet, 1);
  assert.equal(smoothStripes.sample(0, 0, 0.7), 1, "the crest of a stripe");
  assert.ok(Math.abs(smoothStripes.sample(1 / 8, 0, 0) - 0.5) < 1e-15, "a quarter period along");
  assert.ok(Math.abs(smoothStripes.sample(0.25, 0, 0) - 0) < 1e-15, "the trough, half a period along");
  const sharp = growthField({ regions: [{ kind: "stripes", count: 4, angle: 90, sharpness: 1 }], combine: "max", baseline: 0 }, sheet, 1);
  assert.equal(sharp.sample(0.3, 0, 0), 1); assert.equal(sharp.sample(0.3, 0, 0.25), 0);
});

test("regions combine by max, clamped sum or product, then lift by the baseline", () => {
  const sheet = seedOf("sheet", 8);
  const build = (combine: "max" | "sum" | "multiply", baseline = 0) => growthField({
    regions: [{ kind: "uniform", weight: 0.3 }, { kind: "stripes", count: 4, angle: 0, sharpness: 0, weight: 0.6 }], combine, baseline }, sheet, 1);
  const at = { x: 1 / 8 }; // stripe value 0.5: layers 0.3 and 0.3
  assert.ok(Math.abs(build("max").sample(at.x, 0, 0) - 0.3) < 1e-15);
  assert.ok(Math.abs(build("sum").sample(at.x, 0, 0) - 0.6) < 1e-15);
  assert.ok(Math.abs(build("multiply").sample(at.x, 0, 0) - (0.7 + 0.3) * (0.4 + 0.3)) < 1e-15);
  assert.ok(Math.abs(build("sum", 0.25).sample(at.x, 0, 0) - (0.25 + 0.75 * 0.6)) < 1e-15);
  assert.ok(Math.abs(build("sum").sample(0, 0, 0) - 0.9) < 1e-15, "a crest: 0.3 + 0.6");
  const over = growthField({ regions: [{ kind: "uniform" }, { kind: "uniform" }], combine: "sum", baseline: 0 }, sheet, 1);
  assert.equal(over.sample(0, 0, 0), 1, "the sum is clamped to 1");
});

test("a sampled field is exactly bilinear, clamps at its border and is keyed by its content", () => {
  const values = new Float64Array(5 * 4);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) values[j * 5 + i] = 0.1 * (i / 4 * 2 - 1 + 1) + 0.2 * (j / 3); // linear in (x, z)
  const field = gridGrowthField({ id: "g", bounds: [-1, -1, 1, 1], columns: 5, rows: 4, values });
  const linear = (x: number, z: number) => 0.1 * (x + 1) + 0.2 * ((z + 1) / 2);
  for (const [x, z] of [[-1, -1], [0.3, 0.2], [0.77, -0.91], [1, 1]]) assert.ok(Math.abs(field.sample(x, 0, z) - linear(x, z)) < 1e-12, `${x},${z}`);
  assert.equal(field.sample(5, 0, -7), field.sample(1, 0, -1), "outside the grid the nearest border value holds");
  const other = gridGrowthField({ id: "g", bounds: [-1, -1, 1, 1], columns: 5, rows: 4, values: values.map((v, i) => i === 7 ? v + 0.01 : v) });
  assert.notEqual(other.key, field.key);
  assert.equal(gridGrowthField({ id: "h", bounds: [-1, -1, 1, 1], columns: 5, rows: 4, values }).key, field.key, "the id is a label, not content");
  assert.throws(() => gridGrowthField({ id: "g", bounds: [-1, -1, 1, 1], columns: 5, rows: 4, values: values.slice(1) }), /values/);
  assert.throws(() => gridGrowthField({ id: "g", bounds: [-1, -1, 1, 1], columns: 2, rows: 2, values: [0, 0, NaN, 0] }), /finite/);
});

test("field identity follows content: a region, the seed surface or (for noise only) the seed changes it", () => {
  const sheet = seedOf("sheet", 8), disc = seedOf("disc", 8);
  const make = (seed: GrowthSeed, width: number, noise: number) => growthField({ regions: [{ kind: "edge", width }], combine: "max", baseline: 0 }, seed, noise);
  assert.equal(make(sheet, 0.5, 1).key, make(sheet, 0.5, 2).key, "no noise region: the seed is not part of the field");
  assert.notEqual(make(sheet, 0.5, 1).key, make(sheet, 0.6, 1).key);
  assert.notEqual(make(sheet, 0.5, 1).key, make(disc, 0.5, 1).key);
  const noisy = (seed: number) => growthField({ regions: [{ kind: "noise", scale: 2, contrast: 3 }], combine: "max", baseline: 0 }, sheet, seed);
  assert.notEqual(noisy(1).key, noisy(2).key);
  assert.notEqual(noisy(1).sample(0.3, 0, 0.4), noisy(2).sample(0.3, 0, 0.4));
  const values = Array.from({ length: 200 }, (_, i) => noisy(1).sample(Math.sin(i) , 0, Math.cos(i * 1.7)));
  assert.ok(values.every((v) => v >= 0 && v <= 1) && Math.max(...values) - Math.min(...values) > 0.5, "noise spans the range");
  assert.throws(() => growthField({ regions: [{ kind: "edge", width: 0.3 }], combine: "max", baseline: 0 }, seedOf("sphere", 10), 1), /closed/);
  assert.throws(() => growthField({ regions: [{ kind: "radial", centerX: 0, centerY: 0, radius: -1, width: 0.3 }], combine: "max", baseline: 0 }, sheet, 1), /Growth region 1 radius/);
  assert.throws(() => growthField({ regions: [], combine: "max", baseline: 2 }, sheet, 1), /Growth baseline/);
});

/* ------------------------------------------------------------------------------------ hinges */

test("the hinge angle is the dihedral deviation and its gradient matches finite differences", () => {
  const flat = [0, 0, 0, 1, 0, 0, 0.5, 1, 0, 0.5, -1, 0];
  assert.equal(hingeAngle(flat, 0, 1, 2, 3), 0);
  for (const phi of [0.3, 1.2, 2.5]) {
    const folded = [0, 0, 0, 1, 0, 0, 0.5, 1, 0, 0.5, -Math.cos(phi), Math.sin(phi)];
    assert.ok(Math.abs(Math.abs(hingeAngle(folded, 0, 1, 2, 3)) - phi) < 1e-12, `fold by ${phi}`);
  }
  // a wing of height h rotates by 1 / h per unit of push: raising x3 by d turns the hinge by -d / h3
  const lifted = flat.slice(); lifted[8] = 1e-6;
  assert.ok(Math.abs(hingeAngle(lifted, 0, 1, 2, 3) - (-1e-6)) < 1e-12);
  const g = new Float64Array(12);
  const generic = [0.1, -0.2, 0.05, 1.3, 0.1, -0.1, 0.4, 1.1, 0.2, 0.6, -0.9, 0.35];
  hingeAngle(generic, 0, 1, 2, 3, g);
  for (let k = 0; k < 12; k++) {
    const h = 1e-6, plus = generic.slice(), minus = generic.slice();
    plus[k] += h; minus[k] -= h;
    const numeric = (hingeAngle(plus, 0, 1, 2, 3) - hingeAngle(minus, 0, 1, 2, 3)) / (2 * h);
    assert.ok(Math.abs(numeric - g[k]) < 1e-7, `d theta / d x[${k}]: ${numeric} vs ${g[k]}`);
  }
  assert.ok(Number.isNaN(hingeAngle([0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 0], 0, 1, 2, 3)), "a collapsed face has no angle");
  // rigid motion leaves a hinge's forces balanced: gradients sum to zero
  for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs([0, 1, 2, 3].reduce((s, v) => s + g[v * 3 + axis], 0)) < 1e-12);
});

/* ---------------------------------------------------------------------------- the growth model */

test("an unstretched skin with nothing to grow does not move, to the bit", () => {
  const seed = seedOf("disc", 8), snaps = surfaceGrowthSnapshots(seed, uniform(seed), controls(seed, { rate: 0 }), 5, 20);
  assert.deepEqual(Array.from(positionsOf(snaps)), Array.from(meshStorage(seed.mesh).positions));
  assert.equal(snaps.final.stretchEnergy, 0); assert.equal(snaps.final.bendEnergy, 0);
});

test("uniform growth of a free flat sheet scales it by exactly the growth limit", () => {
  const seed = seedOf("sheet", 8), limit = 1.5;
  const snaps = surfaceGrowthSnapshots(seed, uniform(seed), controls(seed, { rate: 0.2, limit, sweeps: 40 }), 1, 120);
  const grown = grownSurface(snaps).mesh, p = meshStorage(grown).positions, q = meshStorage(seed.mesh).positions;
  let worst = 0, flat = 0;
  for (let i = 0; i < p.length; i += 3) {
    worst = Math.max(worst, Math.hypot(p[i] - limit * q[i], p[i + 2] - limit * q[i + 2]));
    flat = Math.max(flat, Math.abs(p[i + 1]));
  }
  assert.ok(worst < 1e-4, `positions are limit x the seed's (relaxation is iterative, settled to 1e-4 of the size): worst ${worst}`);
  assert.equal(flat, 0, "a skin with no out-of-plane push stays exactly flat");
  const measures = grown.bounds;
  assert.ok(Math.abs(measures.max[0] - limit) < 1e-4 && Math.abs(measures.min[2] + limit) < 1e-4);
  const growth = meshAttribute(grown, "growth").values, strain = meshAttribute(grown, "stretch").values;
  assert.ok(growth.every((v) => v === limit), "every vertex has reached the limit exactly");
  assert.ok(strain.every((v) => Math.abs(v) < 1e-4), "an isotropically grown free sheet carries no strain");
  assert.equal(snaps.final.growing, 0, "growth has ended");
});

test("a vertex's growth is min(limit, (1 + rate x field)^steps): where the field is zero nothing grows", () => {
  const seed = seedOf("sheet", 10), field = growthField({ regions: [{ kind: "edge", width: 0.5 }], combine: "max", baseline: 0 }, seed, 1);
  const rate = 0.05, limit = 3, steps = 30;
  const snaps = surfaceGrowthSnapshots(seed, field, controls(seed, { rate, limit }), 1, steps);
  const growth = meshAttribute(grownSurface(snaps).mesh, "growth").values, drive = meshAttribute(grownSurface(snaps).mesh, "field").values, q = meshStorage(seed.mesh).positions;
  let zero = 0, capped = 0;
  for (let v = 0; v < seed.mesh.vertexCount; v++) {
    const distance = 1 - Math.max(Math.abs(q[v * 3]), Math.abs(q[v * 3 + 2]));
    const g = smooth(1 - distance / 0.5);
    assert.ok(Math.abs(drive[v] - g) < 1e-12);
    const expected = Math.min(limit, (1 + rate * g) ** steps);
    assert.ok(Math.abs(growth[v] - expected) < 1e-12 * expected, `vertex ${v}: ${growth[v]} vs ${expected}`);
    if (g === 0) { zero++; assert.equal(growth[v], 1); }
    if (expected === limit) capped++;
  }
  assert.ok(zero > 20 && capped > 10, `${zero} still, ${capped} at the limit`);
});

test("a flat skin under edge growth stays exactly flat without a perturbation and ruffles by actual evolution with one", () => {
  const seed = seedOf("disc", 14), field = growthField({ regions: [{ kind: "edge", width: 0.4 }], combine: "max", baseline: 0.03 }, seed, 3);
  const base = controls(seed, { rate: 0.03, limit: 2.5, sweeps: 15 });
  const flat = surfaceGrowthSnapshots(seed, field, base, 3, 80);
  assert.ok(Array.from(positionsOf(flat)).every((v, i) => i % 3 !== 1 || v === 0), "no perturbation: the compressed disc is an unstable but exactly flat state");
  const perturb = 0.2, bumped = surfaceGrowthSnapshots(seed, field, { ...base, perturb }, 3, 80);
  const bound = perturb * seed.meanEdge; // the initial displacement can be no larger than this
  const p = positionsOf(bumped);
  let amplitude = 0;
  for (let i = 1; i < p.length; i += 3) amplitude = Math.max(amplitude, Math.abs(p[i]));
  assert.ok(amplitude > 8 * bound && amplitude > 0.1, `out-of-plane amplitude ${amplitude} against an initial push of at most ${bound}`);
  // the rim has grown by the limit and the skin has folded to fit it: its length is near limit x the seed rim, not the flat circle's
  const grown = grownSurface(bumped).mesh, topology = meshTopology(grown), q = meshStorage(seed.mesh).positions;
  let seedRim = 0, rim = 0;
  const s = meshTopology(seed.mesh), store = meshStorage(grown).positions;
  for (const e of meshBoundaryEdges(s)) { const [a, b] = edgeVertices(s, e); seedRim += Math.hypot(q[a * 3] - q[b * 3], q[a * 3 + 2] - q[b * 3 + 2]); }
  for (const e of meshBoundaryEdges(topology)) { const [a, b] = edgeVertices(topology, e); rim += Math.hypot(store[a * 3] - store[b * 3], store[a * 3 + 1] - store[b * 3 + 1], store[a * 3 + 2] - store[b * 3 + 2]); }
  assert.ok(Math.abs(rim / (2.5 * seedRim) - 1) < 0.08, `rim ${rim} against ${2.5 * seedRim}`);
});
test("once growth has ended the skin only relaxes: its energy never rises", () => {
  const seed = seedOf("disc", 12), field = uniform(seed);
  const snaps = surfaceGrowthSnapshots(seed, field, controls(seed, { rate: 0.06, limit: 1.5, perturb: 0.2, sweeps: 6, pin: "rim" }), 3, 120);
  const after = snaps.history.filter((h) => h.value.growing === 0 && h.step > 0);
  assert.ok(after.length > 30, `${after.length} frames after growth ended`);
  for (let i = 1; i < after.length; i++) {
    const before = after[i - 1].value.stretchEnergy + after[i - 1].value.bendEnergy, now = after[i].value.stretchEnergy + after[i].value.bendEnergy;
    assert.ok(now <= before * (1 + 1e-9) + 1e-12, `step ${after[i].step}: ${now} > ${before}`);
  }
  const last = after[after.length - 1].value;
  assert.ok(last.residual < 5e-3, `settled: largest move ${last.residual} seed edges`);
});

test("refinement splits over-long edges without losing orientation, conformity or topology", () => {
  const flatSeed = seedOf("sheet", 6), field = uniform(flatSeed);
  const c = controls(flatSeed, { rate: 0.1, limit: 2, refine: true, edgeLimit: 1.3, maxVertices: 600, sweeps: 20 });
  const snaps = surfaceGrowthSnapshots(flatSeed, field, c, 1, 80);
  const grown = grownSurface(snaps).mesh, topology = meshTopology(grown);
  assert.equal(topology.kind, "open-manifold");
  assert.equal(topology.counts.euler, 1, "each split adds one vertex, three edges and two faces (one, two and one on the rim)");
  assert.equal(grown.vertexCount, flatSeed.mesh.vertexCount + snaps.final.splits);
  assert.ok(snaps.final.splits > 50);
  const normals = meshStorage(grown), p = normals.positions;
  let area = 0;
  for (let t = 0; t < grown.triangleCount; t++) {
    const [a, b, c] = [0, 1, 2].map((k) => normals.triangles[t * 3 + k] * 3);
    const cross = (p[b + 2] - p[a + 2]) * (p[c] - p[a]) - (p[b] - p[a]) * (p[c + 2] - p[a + 2]);
    assert.ok(cross > 0, `triangle ${t} keeps its winding`);
    area += cross / 2;
  }
  assert.ok(Math.abs(area - 4 * 4) < 2e-3 * 16, `area ${area} = limit^2 x 4`);
  // no edge is left longer than the limit once growth has ended and the passes have caught up (one more step of slack)
  const store = meshTopology(grown);
  let longest = 0;
  for (let e = 0; e < store.counts.edges; e++) { const [a, b] = edgeVertices(store, e); longest = Math.max(longest, Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 2] - p[b * 3 + 2])); }
  assert.ok(longest <= 1.3 * flatSeed.meanEdge * 1.0001, `longest ${longest} against ${1.3 * flatSeed.meanEdge}`);

  const sphereSeed = seedOf("sphere", 10);
  const s = surfaceGrowthSnapshots(sphereSeed, uniform(sphereSeed), controls(sphereSeed, { rate: 0.1, limit: 2, refine: true, edgeLimit: 1.3, maxVertices: 500, perturb: 0.1 }), 2, 15);
  const closed = meshTopology(grownSurface(s).mesh);
  assert.equal(closed.kind, "closed-manifold"); assert.equal(closed.counts.euler, 2);
});

test("a newborn vertex takes its position and rest state from its parents and its field value from the field", () => {
  const seed = seedOf("disc", 8), field = growthField({ regions: [{ kind: "radial", centerX: 0.3, centerY: 0, radius: 0.4, width: 0.25 }], combine: "max", baseline: 0.1 }, seed, 1);
  const c = controls(seed, { rate: 0.08, limit: 2.5, refine: true, edgeLimit: 1.25, maxVertices: 800, perturb: 0.1 });
  const snaps = surfaceGrowthSnapshots(seed, field, c, 9, 30);
  const first = snaps.history.find((h) => h.value.splits > 0)!.step;
  const before = stateAt(snaps, first - 1) as State, after = stateAt(snaps, first) as State;
  assert.ok(after.n > before.n);
  for (let v = before.n; v < after.n; v++) {
    const a = after.parentA[v], b = after.parentB[v];
    assert.ok(a >= 0 && a < b && b < v, "parents are older vertices, ascending");
    assert.equal(after.birth[v], first);
    assert.equal(after.generation[v], Math.max(after.generation[a], after.generation[b]) + 1);
    for (let k = 0; k < 3; k++) assert.equal(after.mat[v * 3 + k], (after.mat[a * 3 + k] + after.mat[b * 3 + k]) / 2);
    assert.equal(after.scale[v], (after.scale[a] + after.scale[b]) / 2);
    assert.equal(after.drive[v], field.sample(after.mat[v * 3], after.mat[v * 3 + 1], after.mat[v * 3 + 2]), "the field is evaluated at the new material point, not averaged");
    const rest = (i: number, j: number) => Math.hypot(after.mat[i * 3] - after.mat[j * 3], after.mat[i * 3 + 1] - after.mat[j * 3 + 1], after.mat[i * 3 + 2] - after.mat[j * 3 + 2]) * (after.scale[i] + after.scale[j]) / 2;
    assert.ok(Math.abs(rest(a, v) + rest(v, b) - rest(a, b)) < 1e-12, "the two halves keep the parent edge's rest length");
  }
  for (let v = 0; v < seed.mesh.vertexCount; v++) { assert.equal(after.parentA[v], -1); assert.equal(after.birth[v], 0); }
});
interface State { n: number; pos: Float64Array; mat: Float64Array; scale: Float64Array; drive: Float64Array; birth: Int32Array; parentA: Int32Array; parentB: Int32Array; generation: Int32Array; pinned: Uint8Array; tri: Uint32Array }

test("ids are birth serials: growing the step count only appends vertices, and a vertex keeps its parents", () => {
  const seed = seedOf("disc", 8), field = growthField({ regions: [{ kind: "edge", width: 0.5 }], combine: "max", baseline: 0.05 }, seed, 1);
  const c = controls(seed, { rate: 0.06, limit: 2.5, refine: true, edgeLimit: 1.3, maxVertices: 700, perturb: 0.1 });
  const short = surfaceGrowthSnapshots(seed, field, c, 4, 15), long = surfaceGrowthSnapshots(seed, field, c, 4, 30);
  const a = grownSurface(short).mesh, b = grownSurface(long).mesh;
  assert.ok(b.vertexCount > a.vertexCount);
  for (const name of ["parentA", "parentB", "birth", "generation"]) {
    const x = meshAttribute(a, name).values, y = meshAttribute(b, name).values;
    assert.deepEqual(Array.from(y.slice(0, x.length)), Array.from(x), `${name} of the first ${x.length} vertices`);
  }
  const birth = meshAttribute(b, "birth").values;
  for (let v = 1; v < birth.length; v++) assert.ok(birth[v] >= birth[v - 1], "birth order is index order");
});

test("the vertex budget stops refinement and says so; it never truncates silently", () => {
  const seed = seedOf("sheet", 6), c = controls(seed, { rate: 0.1, limit: 3, refine: true, edgeLimit: 1.2, maxVertices: seed.mesh.vertexCount + 10 });
  const snaps = surfaceGrowthSnapshots(seed, uniform(seed), c, 1, 30);
  assert.equal(snaps.final.vertices, seed.mesh.vertexCount + 10);
  assert.ok(snaps.final.deferred > 0, "longer edges were refused and counted");
  for (const h of snaps.history) assert.ok(h.value.vertices <= c.maxVertices);
  assert.throws(() => surfaceGrowthSnapshots(seed, uniform(seed), { ...c, maxVertices: seed.mesh.vertexCount - 1 }, 1, 3), /Vertex limit/);
  assert.throws(() => surfaceGrowthSnapshots(seed, uniform(seed), c, 1, GROWTH_LIMITS.maxSteps + 1), /Steps/);
  assert.throws(() => surfaceGrowthSnapshots(seed, uniform(seed), { ...c, maxVertices: GROWTH_LIMITS.maxVertices, sweeps: 60 }, 1, 1000), /Lower Steps, Relaxation or Vertex limit/);
});

test("every control names itself when it is out of range", () => {
  const seed = seedOf("sheet", 6), run = (over: Partial<GrowthControls>) => surfaceGrowthSnapshots(seed, uniform(seed), controls(seed, over), 1, 1);
  assert.throws(() => run({ rate: -0.1 }), /Growth rate/);
  assert.throws(() => run({ limit: 0.5 }), /Growth limit/);
  assert.throws(() => run({ bending: 2 }), /Bending/);
  assert.throws(() => run({ sweeps: 0 }), /Relaxation/);
  assert.throws(() => run({ perturb: 1.5 }), /Perturbation/);
  assert.throws(() => run({ edgeLimit: 1 }), /Edge limit/);
  assert.throws(() => run({ thickness: 2 }), /Contact distance/);
  assert.throws(() => run({ pin: "corner" as never }), /Pin must be/);
  const sphere = seedOf("sphere", 10);
  assert.throws(() => surfaceGrowthSnapshots(sphere, uniform(sphere), controls(sphere, { pin: "rim" }), 1, 1), /Pin "rim" has no vertices/);
});

test("pinned vertices never move; a pinned rim makes the free part buckle against it", () => {
  const seed = seedOf("sheet", 8), field = uniform(seed);
  for (const pin of ["rim", "side", "center"] as const) {
    const snaps = surfaceGrowthSnapshots(seed, field, controls(seed, { pin, rate: 0.05, limit: 1.6, perturb: 0.2 }), 2, 40);
    const p = positionsOf(snaps), q = meshStorage(seed.mesh).positions;
    assert.ok(seed.pins[pin].length > 0);
    for (const v of seed.pins[pin]) for (let k = 0; k < 3; k++) assert.equal(p[v * 3 + k], q[v * 3 + k], `${pin} vertex ${v}`);
    let moved = 0;
    for (let v = 0; v < seed.mesh.vertexCount; v++) if (!seed.pins[pin].includes(v) && Math.hypot(p[v * 3] - q[v * 3], p[v * 3 + 1], p[v * 3 + 2] - q[v * 3 + 2]) > 1e-3) moved++;
    assert.ok(moved > 10, `${pin}: ${moved} free vertices moved`);
  }
  const rim = surfaceGrowthSnapshots(seed, field, controls(seed, { pin: "rim", rate: 0.05, limit: 1.6, perturb: 0.2 }), 2, 60);
  let height = 0;
  const p = positionsOf(rim);
  for (let i = 1; i < p.length; i += 3) height = Math.max(height, Math.abs(p[i]));
  assert.ok(height > 0.15, `a sheet growing 60% inside a fixed frame domes or buckles: ${height}`);
});

test("contact distance holds two sheets apart and leaves a flat sheet exactly alone", () => {
  const base = seedOf("sheet", 6).mesh, gap = 0.3 * seedOf("sheet", 6).meanEdge;
  const pair = growthSeed(mergeMeshes("pair", [base, transformMesh(base, { translate: [0, gap, 0] })]));
  const half = base.vertexCount, h = pair.meanEdge;
  const separation = (snaps: { steps: number }) => {
    const p = positionsOf(snaps);
    let least = Infinity;
    for (let v = 0; v < half; v++) least = Math.min(least, Math.hypot(p[v * 3] - p[(v + half) * 3], p[v * 3 + 1] - p[(v + half) * 3 + 1], p[v * 3 + 2] - p[(v + half) * 3 + 2]));
    return least;
  };
  const still = surfaceGrowthSnapshots(pair, uniform(pair), controls(pair, { rate: 0 }), 1, 10);
  assert.ok(Math.abs(separation(still) - gap) < 1e-12, "no contact: nothing pushes them");
  const apart = surfaceGrowthSnapshots(pair, uniform(pair), controls(pair, { rate: 0, thickness: 1.2, sweeps: 20 }), 1, 30);
  assert.ok(separation(apart) > 0.97 * 1.2 * h && separation(apart) < 1.2 * h * 1.001, `separated to ${separation(apart)} of ${1.2 * h}`);
  // vertices two neighbours apart in a flat sheet are not in contact, however thick the skin
  const seed = seedOf("sheet", 8);
  const flat = surfaceGrowthSnapshots(seed, uniform(seed), controls(seed, { rate: 0, thickness: 1.5 }), 1, 10);
  assert.deepEqual(Array.from(positionsOf(flat)), Array.from(meshStorage(seed.mesh).positions));
});

test("a triangle that collapses is reported with its step, vertex ids and the controls to change", () => {
  const sliver = growthSeed(mesh({ id: "sliver", positions: [0, 0, 0, 1, 0, 0, 0.5, 5e-10, 0], triangles: [0, 1, 2] }));
  assert.throws(() => surfaceGrowthSnapshots(sliver, uniform(sliver), controls(sliver), 1, 1), /triangle 0 \(v:0, v:1, v:2\) collapsed at step 1; lower Growth rate or Growth limit, or raise Bending or Relaxation/);
});

test("the model satisfies the stateful-snapshot guarantees (prefix, resume, spacing, cancellation)", () => {
  const seed = seedOf("disc", 6), field = growthField({ regions: [{ kind: "edge", width: 0.5 }], combine: "max", baseline: 0.05 }, seed, 1);
  const c = controls(seed, { rate: 0.08, limit: 2.2, perturb: 0.2, refine: true, edgeLimit: 1.3, maxVertices: 300, pin: "center", thickness: 0.4, sweeps: 6 });
  checkSimulation(surfaceGrowthSimulation(seed, field), c, 11, 14);
});

test("extending a cached run equals a run from scratch, and cancelling leaves nothing behind", async () => {
  const seed = seedOf("disc", 8), field = growthField({ regions: [{ kind: "edge", width: 0.5 }], combine: "max", baseline: 0.05 }, seed, 1);
  const c = controls(seed, { rate: 0.05, limit: 2.2, perturb: 0.2, refine: true, edgeLimit: 1.3, maxVertices: 400 });
  surfaceGrowthSnapshots(seed, field, c, 21, 30);
  const extended = surfaceGrowthSnapshots(seed, field, c, 21, 55);
  const scratch = runSimulation(surfaceGrowthSimulation(seed, field), c, 21, { steps: 55, ...GROWTH_RETENTION, maxWork: GROWTH_LIMITS.maxWork });
  assert.deepEqual(Array.from(positionsOf(extended)), Array.from(positionsOf(scratch)));
  assert.deepEqual(extended.final, scratch.final);
  const before = surfaceGrowthCache.size;
  assert.equal(await prepareSurfaceGrowth(seed, field, c, 21, 70, () => true), null);
  assert.equal(surfaceGrowthCache.size, before, "a cancelled run stores nothing");
  const done = await prepareSurfaceGrowth(seed, field, c, 21, 70, () => false);
  assert.equal(done!.steps, 70);
});

/* ------------------------------------------------------------------- the instrument and its views */

class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  fillColor: number[] | null = [0, 0, 0, 255]; strokeColor: number[] | null = [0, 0, 0, 255];
  private stack: Array<[number[] | null, number[] | null]> = [];
  shapes: { points: [number, number][]; closed: boolean; fill: number[] | null; stroke: number[] | null }[] = [];
  private open: [number, number][] | null = null;
  push() { this.stack.push([this.fillColor, this.strokeColor]); } pop() { [this.fillColor, this.strokeColor] = this.stack.pop()!; }
  translate() {} rotate() {} scale() {}
  noFill() { this.fillColor = null; } noStroke() { this.strokeColor = null; }
  fill(...c: number[]) { this.fillColor = c; } stroke(...c: number[]) { this.strokeColor = c; }
  strokeWeight() {} strokeCap() {} circle() {} line() {} rect() {}
  beginShape() { this.open = []; } vertex(x: number, y: number) { this.open!.push([x, y]); }
  endShape(mode?: unknown) { this.shapes.push({ points: this.open!, closed: mode === this.CLOSE, fill: this.fillColor, stroke: this.strokeColor }); this.open = null; }
}
const input = (params: Record<string, number | string | boolean>, seed = 42): InstrumentInput => {
  const made = createInstrument("surface-growth");
  return { ...made, seed, params: { ...made.params, ...params } };
};
const recorded = (params: Record<string, number | string | boolean>) => { const r = new Recorder(); drawInstrument(r, input(params)); return r; };
const length = (points: readonly (readonly [number, number])[]) => { let sum = 0; for (let i = 1; i < points.length; i++) sum += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); return sum; };

/** An untouched icosphere drawn orthographically: the visible edges of a convex solid are those with a front-facing face. */
const sphereParams = { surface: "sphere", resolution: 10, field: "uniform", rate: 0.005, perturb: 0, refine: false, steps: 0, projection: "orthographic", yaw: 30, pitch: 25, roll: 0, size: 250, centerX: 320, centerY: 320, maxVertices: 300 };
function expectedSphere(yaw: number, pitch: number, size: number) {
  const sphere = icosphereMesh(1), s = meshStorage(sphere), p = s.positions, rad = Math.PI / 180;
  const sy = Math.sin(yaw * rad), cy = Math.cos(yaw * rad), sp = Math.sin(pitch * rad), cp = Math.cos(pitch * rad);
  const right = [cy, 0, -sy], up = [-sp * sy, cp, -sp * cy], back = [cp * sy, sp, cp * cy];
  const project = (v: number): [number, number] => [320 + size * (p[v * 3] * right[0] + p[v * 3 + 1] * right[1] + p[v * 3 + 2] * right[2]), 320 - size * (p[v * 3] * up[0] + p[v * 3 + 1] * up[1] + p[v * 3 + 2] * up[2])];
  const facing: boolean[] = [], faceArea: number[] = [];
  const tri = s.triangles;
  for (let t = 0; t < sphere.triangleCount; t++) {
    const [a, b, c] = [0, 1, 2].map((k) => tri[t * 3 + k] * 3);
    const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], w = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    facing.push(n[0] * back[0] + n[1] * back[1] + n[2] * back[2] > 0);
    const A = project(tri[t * 3]), B = project(tri[t * 3 + 1]), C = project(tri[t * 3 + 2]);
    faceArea.push(Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2);
  }
  const edges = new Map<string, { faces: number[]; length: number }>();
  for (let t = 0; t < sphere.triangleCount; t++) for (let k = 0; k < 3; k++) {
    const a = tri[t * 3 + k], b = tri[t * 3 + (k + 1) % 3], key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    const e = edges.get(key) ?? { faces: [], length: Math.hypot(project(a)[0] - project(b)[0], project(a)[1] - project(b)[1]) };
    e.faces.push(t); edges.set(key, e);
  }
  return { facing, faceArea, edges };
}

test("hidden-line wire of a closed convex skin draws exactly the edges with a front-facing face; faded ink covers the rest", () => {
  const { facing, edges } = expectedSphere(30, 25, 250);
  assert.equal(edges.size, 120);
  let visible = 0, hidden = 0;
  for (const e of edges.values()) { if (e.faces.some((f) => facing[f])) visible += e.length; else hidden += e.length; }
  const removed = recorded({ ...sphereParams, faces: "none", lines: "wire", hidden: "remove", contourWeight: 1 });
  const strokes = removed.shapes.filter((s) => s.fill === null);
  const drawn = strokes.reduce((sum, s) => sum + length(s.points), 0);
  assert.ok(Math.abs(drawn - visible) < 1e-6 * visible, `visible wire ${drawn} vs ${visible}`);
  const faded = recorded({ ...sphereParams, faces: "none", lines: "wire", hidden: "fade", hiddenOpacity: 0.3 });
  const ghost = faded.shapes.filter((s) => s.fill === null && s.stroke && Math.abs(s.stroke[3] - 215 * 0.3) < 1e-9);
  assert.ok(Math.abs(ghost.reduce((sum, s) => sum + length(s.points), 0) - hidden) < 1e-6 * hidden, "the hidden edges are drawn faintly");
  assert.ok(ghost.length > 0 && faded.shapes.length === strokes.length + ghost.length);
});

test("faces are painted once each, far to near, and hidden undersides are not painted", () => {
  const { facing, faceArea } = expectedSphere(30, 25, 250);
  const front = facing.filter(Boolean).length;
  const shapes = recorded({ ...sphereParams, faces: "flat", backFaces: "hidden", lines: "none" }).shapes;
  assert.equal(shapes.length, front);
  assert.ok(Math.abs(shapes.reduce((s, sh) => s + Math.abs(sh.points[0][0] * (sh.points[1][1] - sh.points[2][1]) + sh.points[1][0] * (sh.points[2][1] - sh.points[0][1]) + sh.points[2][0] * (sh.points[0][1] - sh.points[1][1])) / 2, 0)
    - faceArea.reduce((s, a, t) => s + (facing[t] ? a : 0), 0)) < 1e-6);
  const all = recorded({ ...sphereParams, faces: "flat", backFaces: "same", lines: "none" }).shapes;
  assert.equal(all.length, facing.length);
  // a disc pinned at its rim and grown into a dome: far faces are painted before the near faces that hide them
  const dome = recorded({ surface: "disc", resolution: 12, field: "uniform", pin: "rim", rate: 0.04, limit: 1.5, perturb: 0.3, steps: 60, faces: "flat", backFaces: "same", lines: "none", pitch: 10, yaw: 0, projection: "orthographic", refine: false, maxVertices: 400 });
  assert.ok(dome.shapes.length > 0);
});

test("a camera or palette edit never rebuilds the growth; a growth edit does", () => {
  const a = surfaceGrowthComposition(input({ steps: 25 })), b = surfaceGrowthComposition({ ...input({ steps: 25, yaw: 77, pitch: 12, projection: "orthographic", size: 180 }), palette: [0x112233, 0x445566, 0x778899, 0xaabbcc, 0xddeeff] });
  const snapsA = surfaceGrowthRun(a), snapsB = surfaceGrowthRun(b);
  assert.equal(snapsA, snapsB, "the same Snapshots object");
  assert.equal(grownSurface(snapsA), grownSurface(snapsB), "the same mesh object");
  assert.equal(grownSurface(snapsA).mesh.key, grownSurface(snapsB).mesh.key);
  const c = surfaceGrowthComposition(input({ steps: 25, fieldWidth: 0.6 })), d = surfaceGrowthComposition(input({ steps: 25, bending: 0.0009 })), e = surfaceGrowthComposition(input({ steps: 25 }, 43));
  for (const other of [c, d, e]) assert.notEqual(surfaceGrowthRun(other).key, snapsA.key);
  assert.notEqual(grownSurface(surfaceGrowthRun(c)).mesh.key, grownSurface(snapsA).mesh.key);
  // and every camera produces a different picture from the same mesh
  assert.notEqual(drawFingerprint(input({ steps: 25, yaw: 0 })), drawFingerprint(input({ steps: 25, yaw: 90 })));
});

test("controls that a choice hides do not change the drawing", () => {
  const small = { resolution: 8, steps: 12, maxVertices: 400 };
  const cases: Array<[string, Record<string, number | string | boolean>, Record<string, number | string | boolean>]> = [
    ["pin", { surface: "sphere", field: "uniform" }, { pin: "rim" }],
    ["edgeLimit", { refine: false }, { edgeLimit: 2.4 }],
    ["maxVertices", { refine: false }, { maxVertices: 2500 }],
    ["fieldWidth", { field: "stripes" }, { fieldWidth: 0.9 }],
    ["fieldRadius", { field: "edge" }, { fieldRadius: 1.1 }],
    ["fieldX", { field: "noise" }, { fieldX: 0.8 }],
    ["stripeCount", { field: "edge" }, { stripeCount: 8 }],
    ["stripeSharp", { field: "radial" }, { stripeSharp: 1 }],
    ["noiseScale", { field: "uniform" }, { noiseScale: 4 }],
    ["noiseContrast", { field: "edge" }, { noiseContrast: 7 }],
    ["spotX", { spot: false }, { spotX: -0.7 }],
    ["spotWidth", { spot: false }, { spotWidth: 0.6 }],
    ["faceOpacity", { faces: "none" }, { faceOpacity: 0.3 }],
    ["backFaces", { faces: "none" }, { backFaces: "hidden" }],
    ["lightAzimuth", { faces: "flat" }, { lightAzimuth: 90 }],
    ["lightStrength", { faces: "none" }, { lightStrength: 0.1 }],
    ["creaseAngle", { lines: "wire" }, { creaseAngle: 40 }],
    ["contourWeight", { lines: "wire" }, { contourWeight: 2.5 }],
    ["wireWeight", { lines: "contour" }, { wireWeight: 1.8 }],
    ["hiddenOpacity", { lines: "both", hidden: "remove" }, { hiddenOpacity: 0.5 }],
    ["levels", { levelBy: "none" }, { levels: 20 }],
    ["levelWeight", { levelBy: "none" }, { levelWeight: 1.9 }],
    ["distance", { projection: "orthographic" }, { distance: 9 }],
  ];
  for (const [key, given, change] of cases) {
    const base = { ...small, faces: "shaded", lines: "contour", ...given };
    assert.equal(drawFingerprint(input({ ...base, ...change })), drawFingerprint(input(base)), `${key} while hidden`);
    const shown = visibleParameters("surface-growth", { ...createInstrument("surface-growth").params, ...base }).map((p) => p.key);
    assert.ok(!shown.includes(key), `${key} is hidden under ${JSON.stringify(given)}`);
  }
  // visible ones do matter
  const base = { ...small, faces: "shaded", lines: "contour" };
  for (const change of [{ yaw: 70 }, { pitch: 60 }, { size: 200 }, { lightAzimuth: 80 }, { bending: 0.004 }, { fieldWidth: 0.9 }, { colorBy: "stretch" }, { creaseAngle: 30 }, { grains: 300 }])
    assert.notEqual(drawFingerprint(input({ ...base, ...change })), drawFingerprint(input(base)), JSON.stringify(change));
});

test("controls are grouped, conditions are inline and the seed matters only where it is used", () => {
  const definition = definitions.find((d) => d.id === "surface-growth")!;
  assert.ok(definition.parameters.every((p) => p.group));
  const tree = inspectorItems("surface-growth", createInstrument("surface-growth").params);
  const names = tree.filter((item) => item.kind === "group").map((item) => item.label);
  assert.deepEqual(names, ["Seed surface", "Placement", "Growth field", "Growth", "Skin", "Refinement", "Faces", "Color", "Lines", "Grains", "View"]);
  const proportional: Array<[string, string[]]> = [];
  const walk = (items: typeof tree, path: string) => {
    for (const item of items) if (item.kind === "group") {
      if (item.proportional) proportional.push([path + item.label, item.items.map((entry) => entry.kind === "control" ? entry.parameter.key : "")]);
      walk(item.items as typeof tree, `${path}${item.label}/`);
    }
  };
  walk(inspectorItems("surface-growth", { ...createInstrument("surface-growth").params, field: "radial", lines: "both", levelBy: "growth" }), "");
  assert.deepEqual(proportional, [["Growth field/Ring", ["fieldRadius", "fieldWidth"]], ["Lines/Line weights", ["contourWeight", "wireWeight", "levelWeight"]]]);
  assert.equal(canPrepareInstrument("surface-growth"), true);
  const q = createInstrument("surface-growth").params;
  assert.equal(usesSeed(input({ perturb: 0, field: "edge", grains: 0 })), false);
  assert.equal(usesSeed(input({ perturb: 0.2 })), true);
  assert.equal(usesSeed(input({ perturb: 0, field: "noise" })), true);
  assert.equal(usesSeed(input({ perturb: 0, grains: 100 })), true);
  assert.doesNotThrow(() => validateParameters("surface-growth", { ...q, surface: "sphere", field: "edge" }), "Edge on a closed surface falls back rather than refusing");
  const sphere = seedOf("sphere", 16);
  assert.throws(() => growthField({ regions: [{ kind: "edge", width: 0.3 }], combine: "max", baseline: 0 }, sphere, 1), /closed/, "the typed API still refuses, by name");
  assert.throws(() => validateParameters("surface-growth", { ...q, resolution: 8, maxVertices: 20 }), /Vertex limit/);
  assert.throws(() => validateParameters("surface-growth", { ...q, steps: 1100, sweeps: 40, maxVertices: 5000 }), /Lower Steps, Relaxation or Vertex limit/);
});

test("a cancelled preparation paints nothing stale and a later one matches a direct draw", async () => {
  const params = { resolution: 8, steps: 20, maxVertices: 400, rate: 0.03 };
  assert.equal(await prepareInstrument(input(params), () => true), false);
  assert.equal(await prepareInstrument(input(params), () => false), true);
  const direct = drawFingerprint(input(params));
  assert.equal(drawFingerprint(input(params)), direct);
});

test("every numeric control at its slider minimum and maximum, alone and all together, validates and draws inside the declared work bound", () => {
  const definition = definitions.find((d) => d.id === "surface-growth")!;
  const numeric = definition.parameters.filter((p) => p.type === "number");
  assert.ok(numeric.length > 40);
  const silent = new Proxy({ CLOSE: "close", ROUND: "round" } as Record<string, unknown>, { get: (target, key) => (key in target ? target[key] : () => {}) }) as unknown as CompositionSurface;
  const check = (label: string, params: Record<string, number | string | boolean>) => {
    const candidate = { ...createInstrument("surface-growth"), params: { ...createInstrument("surface-growth").params, ...params } };
    assert.doesNotThrow(() => validateInstrument(candidate), `${label} validates`);
    assert.doesNotThrow(() => drawInstrument(silent, candidate), `${label} draws`);
    const run = surfaceGrowthRun(surfaceGrowthComposition(candidate));
    assert.ok(run.work <= GROWTH_LIMITS.maxWork, `${label}: ${run.work} units charged against the bound ${GROWTH_LIMITS.maxWork}`);
    assert.equal(run.steps, candidate.params.steps);
  };
  for (const p of numeric) { check(`${p.key} = min`, { [p.key]: p.min! }); check(`${p.key} = max`, { [p.key]: p.max! }); }
  check("all minimums", Object.fromEntries(numeric.map((p) => [p.key, p.min!])));
  check("all maximums", Object.fromEntries(numeric.map((p) => [p.key, p.max!])));
  // and the most expensive reachable setting the sliders allow: every maximum with the finest edge limit, contact on, every line pass
  check("all maximums, finest edge limit", { ...Object.fromEntries(numeric.map((p) => [p.key, p.max!])), edgeLimit: numeric.find((p) => p.key === "edgeLimit")!.min!, lines: "both", levelBy: "growth" });
  // the hard maximum of every control together is refused by name, not attempted
  const hard = Object.fromEntries(numeric.map((p) => [p.key, p.hardMax ?? p.max!]));
  assert.throws(() => validateParameters("surface-growth", { ...createInstrument("surface-growth").params, ...hard }), /Steps|Vertex limit|Relaxation|Pin|must be/);
});

test("every option of every select, chosen alone from the defaults, validates and draws; Edge on a sphere is a pole cap of the same width", () => {
  const definition = definitions.find((d) => d.id === "surface-growth")!;
  const silent = new Proxy({ CLOSE: "close", ROUND: "round" } as Record<string, unknown>, { get: (target, key) => (key in target ? target[key] : () => {}) }) as unknown as CompositionSurface;
  let tried = 0;
  for (const p of definition.parameters.filter((q) => q.type === "select")) for (const option of p.options!) {
    const candidate = { ...createInstrument("surface-growth"), params: { ...createInstrument("surface-growth").params, [p.key]: option.value } };
    assert.doesNotThrow(() => validateInstrument(candidate), `${p.key} = ${option.value} validates`);
    assert.doesNotThrow(() => drawInstrument(silent, candidate), `${p.key} = ${option.value} draws`);
    tried++;
  }
  assert.ok(tried > 30);
  // the sphere under Edge grows exactly like a sphere under a radial cap at the pole, and the cap width is the visible Band width
  const a = surfaceGrowthComposition(input({ surface: "sphere", field: "edge", fieldWidth: 0.3 })), b = surfaceGrowthComposition(input({ surface: "sphere", field: "radial", fieldX: 0, fieldY: 0, fieldRadius: 0, fieldWidth: 0.3 }));
  assert.equal(surfaceGrowthRun(a), surfaceGrowthRun(b), "the same cached run");
  assert.notEqual(surfaceGrowthRun(a).key, surfaceGrowthRun(surfaceGrowthComposition(input({ surface: "sphere", field: "edge", fieldWidth: 0.6 }))).key);
  const top = meshAttribute(grownSurface(surfaceGrowthRun(a)).mesh, "field").values;
  assert.ok(Math.max(...top) === 1 && Math.abs(Math.min(...top) - 0.04) < 1e-9, "growth gathers at the pole and falls to the baseline (0.04) across the sphere");
});
