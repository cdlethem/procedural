import assert from "node:assert/strict";
import test from "node:test";
import {
  MARCH, camera, cachedSdfView, componentSeed, createInstrument, definition, drawInstrument, hiddenLines, implicitSculptureComposition, inspectorItems, marchRays, marchWork,
  meshMeasures, meshTopology, meshVertex, pointCloudData, prepareInstrument, quantizeTone, releasedScene, sculptureCamera, sculptureProducts, sculptureSdf, sculptureTree, sdf, sdfBend, sdfBox,
  sdfCapsule, sdfCylinder, sdfField, sdfFold, sdfIntersection, sdfMesh, sdfPlace, sdfRepeat, sdfShell, sdfSmoothUnion, sdfSphere, sdfSubtract, sdfSurfacePoints, sdfTorus, sdfTwist,
  sdfUnion, sdfView, shadeView, toneColor, twistLipschitz, usesSeed, validateInstrument, visibleParameters,
  type CompositionSurface, type InstrumentInput, type SdfNode, type Vec3,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.js";

const ID = "implicit-sculpture";
const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const near = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const norm = (v: readonly number[]) => Math.hypot(v[0], v[1], v[2]);

const layer = (params: Record<string, number | string | boolean> = {}, seed = 42): InstrumentInput => {
  const input = createInstrument(ID);
  input.seed = seed; Object.assign(input.params, params);
  validateInstrument(input);
  return input;
};
const recipe = (params: Record<string, number | string | boolean> = {}, seed = 42) => implicitSculptureComposition(layer(params, seed));

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

// ---- Independent references --------------------------------------------------------------------------------------

const boxDistance = (p: Vec3, half: Vec3): number => {
  // Distance to the solid box: Euclid to the clamped point outside, minus the smallest face gap inside.
  const q = p.map((v, i) => Math.abs(v) - half[i]);
  if (q.every((v) => v <= 0)) return Math.max(...q);
  return Math.hypot(...q.map((v) => Math.max(v, 0)));
};
const cylinderDistance = (p: Vec3, r: number, h: number): number => {
  const rho = Math.hypot(p[0], p[2]), a = rho - r, b = Math.abs(p[1]) - h;
  return a <= 0 && b <= 0 ? Math.max(a, b) : Math.hypot(Math.max(a, 0), Math.max(b, 0));
};
const capsuleDistance = (p: Vec3, a: Vec3, b: Vec3, r: number): number => {
  let best = Infinity;
  for (let i = 0; i <= 4000; i++) {
    const t = i / 4000;
    best = Math.min(best, Math.hypot(p[0] - (a[0] + t * (b[0] - a[0])), p[1] - (a[1] + t * (b[1] - a[1])), p[2] - (a[2] + t * (b[2] - a[2]))));
  }
  return best - r;
};
const randomPoint = (next: () => number, r: number): Vec3 => [(next() * 2 - 1) * r, (next() * 2 - 1) * r, (next() * 2 - 1) * r];

// ---- The field: exact primitives ---------------------------------------------------------------------------------

test("primitives are the exact signed distance against independent formulas", () => {
  const next = rng(1);
  const sphere = sdf(sdfSphere(0.7, [0.1, -0.2, 0.3])), box = sdf(sdfBox([0.5, 0.8, 0.3])), rounded = sdf(sdfBox([0.5, 0.8, 0.3], 0.2));
  const torus = sdf(sdfTorus(0.8, 0.25)), capsule = sdf(sdfCapsule([-0.4, 0.1, 0.2], [0.5, -0.3, 0.6], 0.2)), cylinder = sdf(sdfCylinder(0.45, 0.6));
  for (let i = 0; i < 300; i++) {
    const p = randomPoint(next, 1.6);
    near(sphere.distance(...p), Math.hypot(p[0] - 0.1, p[1] + 0.2, p[2] - 0.3) - 0.7);
    near(box.distance(...p), boxDistance(p, [0.5, 0.8, 0.3]));
    near(rounded.distance(...p), boxDistance(p, [0.3, 0.6, 0.1]) - 0.2);
    near(torus.distance(...p), Math.hypot(Math.hypot(p[0], p[2]) - 0.8, p[1]) - 0.25);
    near(capsule.distance(...p), capsuleDistance(p, [-0.4, 0.1, 0.2], [0.5, -0.3, 0.6], 0.2), 1e-6);
    near(cylinder.distance(...p), cylinderDistance(p, 0.45, 0.6));
  }
  for (const s of [sphere, box, rounded, torus, capsule, cylinder]) assert.equal(s.class, "exact");
  // Placement keeps exactness: uniform scale 2 and a quarter turn about Z put the cylinder's axis on X.
  const placed = sdf(sdfPlace(sdfCylinder(0.45, 0.6), { rotate: [0, 0, 90], translate: [1, 0, 0], scale: 2 }));
  assert.equal(placed.class, "exact");
  for (let i = 0; i < 100; i++) {
    const p = randomPoint(next, 3);
    // World point -> local: subtract translation, undo the turn (x' = y-axis of the cylinder lies along -x), divide by scale.
    const q: Vec3 = [(p[1]) / 2, -(p[0] - 1) / 2, p[2] / 2];
    near(placed.distance(...p), 2 * cylinderDistance(q, 0.45, 0.6), 1e-9);
  }
});

test("bounds contain every interior point and are exact for primitives", () => {
  const next = rng(2);
  const torus = sdf(sdfTorus(0.8, 0.25));
  assert.deepEqual(torus.bounds.min, [-1.05, -0.25, -1.05]); assert.deepEqual(torus.bounds.max, [1.05, 0.25, 1.05]);
  for (const s of [sculptureSdf(recipe({ form: "coral" }).sculpt), sculptureSdf(recipe({ form: "carved-block", twist: 1, bend: 0.4 }).sculpt), sculptureSdf(recipe({ hollow: true, cut: "half" }).sculpt),
    sculptureSdf(recipe({ form: "fractal-fragment", fold: "tetra", iterations: 3 }).sculpt), sculptureSdf(recipe({ repeatX: 2, repeatZ: 3, repeatGap: 0.3 }).sculpt)]) {
    let inside = 0;
    for (let i = 0; i < 6000; i++) {
      const p: Vec3 = [s.center[0] + (next() * 2 - 1) * s.radius, s.center[1] + (next() * 2 - 1) * s.radius, s.center[2] + (next() * 2 - 1) * s.radius];
      if (s.distance(...p) >= 0) continue;
      inside++;
      for (let a = 0; a < 3; a++) assert.ok(p[a] >= s.bounds.min[a] - 1e-9 && p[a] <= s.bounds.max[a] + 1e-9, `interior point ${p} outside the bounds`);
    }
    assert.ok(inside > 50, "the sample must reach the solid");
    assert.ok(s.radius >= Math.hypot(...[0, 1, 2].map((a) => (s.bounds.max[a] - s.bounds.min[a]) / 2)));
  }
});

// ---- The field: bounds, not estimates ----------------------------------------------------------------------------

function lipschitzViolation(s: ReturnType<typeof sdf>, next: () => number, trials = 4000): number {
  let worst = 0;
  for (let i = 0; i < trials; i++) {
    const p = randomPoint(next, s.radius * 0.95), q: Vec3 = [p[0] + (next() - 0.5) * 0.3, p[1] + (next() - 0.5) * 0.3, p[2] + (next() - 0.5) * 0.3];
    const dp = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    if (dp < 1e-9) continue;
    const c = (v: Vec3): Vec3 => [v[0] + s.center[0], v[1] + s.center[1], v[2] + s.center[2]];
    worst = Math.max(worst, Math.abs(s.distance(...c(p)) - s.distance(...c(q))) / dp);
  }
  return worst;
}

test("every operator and every bundled tree is 1-Lipschitz, so its field never exceeds the true distance", () => {
  const next = rng(3);
  const a = sdfSphere(0.6, [-0.3, 0, 0]), b = sdfBox([0.5, 0.4, 0.6]);
  const trees: [string, SdfNode][] = [
    ["union", sdfUnion(a, b)], ["intersection", sdfIntersection(a, b)], ["subtract", sdfSubtract(b, a, sdfCylinder(0.2, 1))], ["smooth", sdfSmoothUnion(0.4, a, b, sdfTorus(0.7, 0.15))],
    ["shell", sdfShell(sdfUnion(a, b), 0.2)], ["twist", sdfTwist(sdfBox([0.3, 0.9, 0.3]), 2.2)], ["bend", sdfBend(sdfBox([0.9, 0.2, 0.2]), 1.4)],
    ["repeat", sdfRepeat(sdfSphere(0.3), [0.7, 0.8, 0.9], [3, 2, 2], { seed: 5, probability: 0.6 })], ["menger", sdfFold(sdfBox([1, 1, 1]), "menger", 3)], ["tetra", sdfFold(sdfSphere(1.3), "tetra", 4)],
    ["scaled place", sdfPlace(sdfUnion(a, b), { rotate: [20, 30, 40], translate: [0.1, 0.2, 0], scale: 1.7 })],
  ];
  for (const [name, tree] of trees) assert.ok(lipschitzViolation(sdf(tree), next) <= 1 + 1e-9, `${name} exceeds slope 1`);
  for (const params of [{ form: "carved-block" }, { form: "lattice-cavity" }, { form: "coral" }, { form: "fractal-fragment" }, { form: "lattice-cavity", hollow: true, cut: "quarter", twist: 1.5, bend: 0.5 },
    { form: "coral", repeatX: 2, repeatY: 2, blend: 0.9 }])
    assert.ok(lipschitzViolation(sculptureSdf(recipe(params).sculpt), next) <= 1 + 1e-9, `${JSON.stringify(params)} exceeds slope 1`);
});

test("a lens and a carved slab underestimate the true distance, never overestimate it", () => {
  // Intersection of two unit spheres at +-0.5 on x: the lens boundary is two spherical caps; sample them densely for the true distance.
  const lens = sdf(sdfIntersection(sdfSphere(1, [-0.5, 0, 0]), sdfSphere(1, [0.5, 0, 0])));
  const boundary: Vec3[] = [];
  for (let i = 0; i <= 160; i++) for (let j = 0; j < 160; j++) {
    const theta = (i / 160) * Math.PI, phi = (j / 160) * 2 * Math.PI, p: Vec3 = [Math.cos(theta), Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi)];
    if (p[0] + 0.5 >= 0 - 1e-12 && Math.hypot(p[0] + 0.5 - 1, p[1], p[2]) >= 0) { /* sphere at +0.5 centre: keep the part of it inside the other sphere */ }
    const onRight: Vec3 = [0.5 + p[0], p[1], p[2]], onLeft: Vec3 = [-0.5 + p[0], p[1], p[2]];
    if (Math.hypot(onRight[0] + 0.5, onRight[1], onRight[2]) <= 1 + 1e-9) boundary.push(onRight);
    if (Math.hypot(onLeft[0] - 0.5, onLeft[1], onLeft[2]) <= 1 + 1e-9) boundary.push(onLeft);
  }
  const next = rng(4);
  let strict = 0;
  for (let i = 0; i < 300; i++) {
    const p = randomPoint(next, 2.6);
    let trueDistance = Infinity;
    for (const q of boundary) trueDistance = Math.min(trueDistance, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
    const f = lens.distance(...p);
    assert.ok(Math.abs(f) <= trueDistance + 0.02, `|field| ${Math.abs(f)} exceeds the true distance ${trueDistance}`);
    if (Math.abs(f) < trueDistance - 0.02) strict++;
    assert.equal(f < 0, Math.hypot(p[0] + 0.5, p[1], p[2]) < 1 && Math.hypot(p[0] - 0.5, p[1], p[2]) < 1, "sign is the lens membership");
  }
  assert.ok(strict > 10, "the intersection really is only a bound somewhere");
  assert.equal(lens.class, "bound");
});

test("twist and bend divide by a Lipschitz constant derived from the marching region; without it the slope exceeds 1", () => {
  const rate = 2.5, child = sdfBox([0.3, 0.9, 0.3]);
  const s = sdf(sdfTwist(child, rate)), plain = sdf(child);
  const L = twistLipschitz(rate, s.region);
  assert.ok(L > 2, `constant ${L} should be well above 1 for this rate and region`);
  // The raw twisted field child(T(p)) is NOT 1-Lipschitz: find a pair whose slope exceeds 1, but never L.
  const raw = (x: number, y: number, z: number) => { const t = rate * y, c = Math.cos(t), sn = Math.sin(t); return plain.distance(c * x + sn * z, y, -sn * x + c * z); };
  const next = rng(5);
  let worst = 0;
  for (let i = 0; i < 20000; i++) {
    const p = randomPoint(next, s.region * 0.6), q: Vec3 = [p[0] + (next() - 0.5) * 0.05, p[1] + (next() - 0.5) * 0.05, p[2] + (next() - 0.5) * 0.05];
    worst = Math.max(worst, Math.abs(raw(...p) - raw(...q)) / Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
  }
  assert.ok(worst > 1.2, `the undivided twist reaches slope ${worst}`);
  assert.ok(worst <= L * (1 + 1e-9), `the constant ${L} must bound the observed slope ${worst}`);
  for (let i = 0; i < 300; i++) { const p = randomPoint(next, s.region * 0.6); near(s.distance(...p) * L, raw(...p), 1e-9); }
});

test("bounded repeat: the field bounds the union of copies, is exact beside a copy, and refuses overlapping copies", () => {
  const spacing: Vec3 = [1, 1.2, 1.4], counts = [3, 2, 2] as const, r = 0.35;
  const tree = sdf(sdfRepeat(sdfSphere(r), spacing, counts));
  const centres: Vec3[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) centres.push([(i - 1) * spacing[0], (j - 0.5) * spacing[1], (k - 0.5) * spacing[2]]);
  const truth = (p: Vec3) => Math.min(...centres.map((c) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - r));
  const next = rng(6);
  let exactNear = 0;
  for (let i = 0; i < 4000; i++) {
    const p = randomPoint(next, 2.4), t = truth(p), f = tree.distance(...p);
    assert.ok(f <= t + 1e-12, `field ${f} exceeds the distance ${t}`);
  }
  for (let i = 0; i < 600; i++) {
    // Points a hair outside one copy: its own cell holds the nearest surface, so the field equals the distance there.
    const c = centres[Math.floor(next() * centres.length)], d = randomPoint(next, 1), l = norm(d), gap = next() * 0.05, p: Vec3 = [c[0] + d[0] / l * (r + gap), c[1] + d[1] / l * (r + gap), c[2] + d[2] / l * (r + gap)];
    near(tree.distance(...p), truth(p), 1e-9); exactNear++;
  }
  assert.equal(exactNear, 600);
  // An off-centre child (sphere 0.2 from its cell centre) makes the nearest copy differ from the own cell near a cell face: the slab bound matters.
  const lopsided = sdf(sdfRepeat(sdfSphere(0.25, [0.2, 0, 0]), [1, 1, 1], [4, 1, 1])), copies = [-1.5, -0.5, 0.5, 1.5].map((c) => c + 0.2);
  for (let i = 0; i < 3000; i++) {
    const p = randomPoint(next, 2.2), t = Math.min(...copies.map((c) => Math.hypot(p[0] - c, p[1], p[2]) - 0.25));
    assert.ok(lopsided.distance(...p) <= t + 1e-12, `lopsided repeat overestimates at ${p}: ${lopsided.distance(...p)} > ${t}`);
  }
  assert.throws(() => sdf(sdfRepeat(sdfSphere(0.6), [1, 1, 1], [2, 1, 1])), /SDF node 0 \(repeat\).*along x, more than half the spacing 1/);
  sdf(sdfRepeat(sdfSphere(0.5), [1, 1, 1], [2, 2, 2])); // touching copies are allowed
  assert.equal(sdf(sdfRepeat(sdfSphere(5), [1, 1, 1], [1, 1, 1])).class, "exact", "one copy keeps exactness");
});

test("repeat keep omits cells by the componentSeed hash of the cell index", () => {
  const seed = 99, probability = 0.5, n = 5, cell = 1;
  const tree = sdf(sdfRepeat(sdfSphere(0.3), [cell, cell, cell], [n, n, n], { seed, probability }));
  let present = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    const expected = componentSeed(seed, `${i},${j},${k}`, "keep") / 4294967296 < probability;
    const centre: Vec3 = [i - 2, j - 2, k - 2];
    assert.equal(tree.distance(...centre) < 0, expected, `cell ${i},${j},${k}`);
    if (expected) present++;
  }
  assert.ok(present > 30 && present < 95, `about half the cells are present (${present} of 125)`);
});

test("bounded fractal folds are the union of 20^n and 4^n copies, verified by cell membership", () => {
  // Menger sponge: the n-level sponge is the union of the cells (at scale 3^-n) that no cross removes.
  const kept = (cx: number, cy: number, cz: number, n: number): boolean => {
    for (let level = 1; level <= n; level++) {
      const ternary = [cx, cy, cz].map((c) => Math.floor(((c + 1) / 2) * 3 ** level) % 3);
      if (ternary.filter((d) => d === 1).length >= 2) return false;
    }
    return true;
  };
  for (const n of [1, 2, 3]) {
    const tree = sdf(sdfFold(sdfBox([1, 1, 1]), "menger", n)), cells = 3 ** n;
    let count = 0, wrong = 0;
    for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) for (let k = 0; k < cells; k++) {
      const c = [i, j, k].map((v) => -1 + (2 * v + 1) / cells) as [number, number, number], expected = kept(...c, n), inside = tree.distance(...c) < 0;
      if (inside) count++;
      if (inside !== expected) wrong++;
    }
    assert.equal(wrong, 0, `Menger level ${n}: cell membership disagrees`);
    assert.equal(count, 20 ** n, `Menger level ${n} keeps 20^${n} cells`);
    assert.equal(tree.class, "bound");
  }
  // Tetrahedral arrangement: 4^n cubes of half-size 2^-n; the grid has cells of size 2^-n / 2, so each cube covers eight.
  for (const n of [1, 2]) {
    const tree = sdf(sdfFold(sdfBox([1, 1, 1]), "tetra", n)), cells = 2 ** (n + 1);
    let count = 0;
    for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) for (let k = 0; k < cells; k++)
      if (tree.distance(-1 + (2 * i + 1) / cells, -1 + (2 * j + 1) / cells, -1 + (2 * k + 1) / cells) < 0) count++;
    assert.equal(count, 4 ** n * 8, `tetra level ${n}: 4^${n} cubes of 2 x 2 x 2 cells`);
  }
  assert.equal(sdf(sdfFold(sdfBox([1, 1, 1]), "menger", 0)).class, "exact", "zero iterations are the plain child");
  assert.throws(() => sdf(sdfFold(sdfBox([1, 1, 1]), "menger", 6)), /iterations must be an integer in \[0, 5\].*cap/);
  assert.throws(() => sdf(sdfFold(sdfBox([1, 1, 1]), "menger", 2.5)), /iterations/);
});

test("a general scalar field meshes but is never marched; a declared Lipschitz constant makes it a bound", () => {
  const bounds = { min: [-1.4, -1.4, -1.4] as Vec3, max: [1.4, 1.4, 1.4] as Vec3 };
  const f = (x: number, y: number, z: number) => x * x + y * y + z * z - 1; // gradient 2|p|: not a distance
  const scalar = sdf(sdfField("quadric", f, bounds));
  assert.equal(scalar.class, "scalar");
  const rays = { count: 1, origins: Float64Array.of(0, 0, 2.4), directions: Float64Array.of(0, 0, -1) };
  assert.throws(() => marchRays(scalar, rays, { maxSteps: 50, hitEpsilon: 1e-4, maxDistance: 8 }), /general scalar field.*sphere tracing needs a distance bound/);
  const m = sdfMesh(scalar, { detail: 32 });
  assert.equal(m.provenance.sdfClass, "scalar");
  const me = meshMeasures(m.mesh);
  assert.ok(Math.abs(me.signedVolume - (4 / 3) * Math.PI) / ((4 / 3) * Math.PI) < 0.03, `volume ${me.signedVolume}`);
  const declared = sdf(sdfField("quadric", f, bounds, 5.2)); // |grad f| = 2|p| <= 5.0 over the bounding sphere
  assert.equal(declared.class, "bound");
  const hit = marchRays(declared, rays, { maxSteps: 400, hitEpsilon: 1e-6, maxDistance: 8 });
  assert.equal(hit.kind[0], MARCH.HIT);
  near(hit.traveled[0], 1.4, 1e-4);
  assert.throws(() => sdf(sdfField("bad", () => NaN, bounds, 1)).distance(0, 0, 0), /returned NaN/);
});

// ---- Marching ------------------------------------------------------------------------------------------------------

test("rays hit a sphere at the analytic distance and are classified by the released rule", () => {
  const ball = sdf(sdfSphere(1, [0.2, 0, 0]));
  const eps = 1e-6;
  const at = (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number) => { const l = Math.hypot(dx, dy, dz); return { origin: [ox, oy, oz], direction: [dx / l, dy / l, dz / l] }; };
  const list = [at(0.2, 0, 5, 0, 0, -1), at(0.2, 0.6, 5, 0, 0, -1), at(0.2, 1.5, 5, 0, 0, -1), at(-4, 0.3, 0.2, 1, 0, 0), at(0.2, 0, 0, 0, 0, 1)];
  const batch = { count: list.length, origins: Float64Array.from(list.flatMap((r) => r.origin)), directions: Float64Array.from(list.flatMap((r) => r.direction)) };
  for (const engine of ["released", "local"] as const) {
    const r = marchRays(ball, batch, { maxSteps: 200, hitEpsilon: eps, maxDistance: 30, engine });
    assert.equal(r.engine, engine);
    assert.equal(r.kind[0], MARCH.HIT); near(r.traveled[0], 4, 1e-5);
    assert.equal(r.kind[1], MARCH.HIT); near(r.traveled[1], 5 - Math.sqrt(1 - 0.36), 1e-5);
    assert.equal(r.kind[2], MARCH.MISS_RANGE, "a ray passing beside the sphere runs out of range");
    assert.equal(r.kind[3], MARCH.HIT); near(r.traveled[3], 4.2 - Math.sqrt(1 - 0.09 - 0.04), 1e-5);
    assert.equal(r.kind[4], MARCH.INSIDE);
  }
  // The step cap is a hard count: a ray that needs a second evaluation ends as MISS_STEPS after exactly one.
  const capped = marchRays(ball, { count: 1, origins: Float64Array.of(0.2, 0, 50), directions: Float64Array.of(0, 0, -1) }, { maxSteps: 1, hitEpsilon: eps, maxDistance: 100, engine: "local" });
  assert.equal(capped.kind[0], MARCH.MISS_STEPS); assert.equal(capped.steps[0], 1);
  const short = marchRays(ball, { count: 1, origins: Float64Array.of(0.2, 0, 50), directions: Float64Array.of(0, 0, -1) }, { maxSteps: 100, hitEpsilon: eps, maxDistance: 10, engine: "local" });
  assert.equal(short.kind[0], MARCH.MISS_RANGE);
  assert.throws(() => marchRays(ball, batch, { maxSteps: 200, hitEpsilon: eps, maxDistance: 30, maxWork: 100 }), /maxWork 100.*reduce the number of rays/);
  assert.equal(marchWork(ball, 10, 94), 10 * 100 * ball.cost);
});

test("the released operation and the local tracer agree exactly on the shared subset, and the subset is stated", () => {
  const tree = sdf(sdfSubtract(sdfSmoothUnion(0.3, sdfSphere(0.6, [-0.3, 0, 0]), sdfPlace(sdfBox([0.4, 0.3, 0.5]), { translate: [0.3, 0.1, 0], scale: 1.2 })), sdfSphere(0.35, [0, 0.1, 0.5])));
  const lowered = releasedScene(tree);
  assert.ok("scene" in lowered);
  const next = rng(7), n = 400, origins = new Float64Array(n * 3), directions = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    const p = randomPoint(next, 1), d = randomPoint(next, 1), l = norm(d);
    origins.set([p[0] * 3, p[1] * 3, p[2] * 3], i * 3); directions.set([-p[0] * 3 + d[0] * 0.4, -p[1] * 3 + d[1] * 0.4, -p[2] * 3 + d[2] * 0.4].map((v, k, all) => v / norm(all)), i * 3);
    void l;
  }
  const options = { maxSteps: 120, hitEpsilon: 1e-4, maxDistance: 8 };
  const a = marchRays(tree, { count: n, origins, directions }, { ...options, engine: "released" }), b = marchRays(tree, { count: n, origins, directions }, { ...options, engine: "local" });
  let hits = 0;
  for (let i = 0; i < n; i++) {
    assert.equal(a.kind[i], b.kind[i], `ray ${i} kind`);
    assert.equal(a.steps[i], b.steps[i], `ray ${i} steps`);
    near(a.traveled[i], b.traveled[i], 1e-12);
    if (a.kind[i] === MARCH.HIT) hits++;
  }
  assert.ok(hits > 100 && hits < n, `a mixed batch (${hits} hits)`);
  assert.equal(marchRays(tree, { count: 1, origins: origins.slice(0, 3), directions: directions.slice(0, 3) }, options).engine, "released", "auto picks the released operation when it fits");
  for (const [name, node] of [["torus", sdfTorus(1, 0.2)], ["rotation", sdfPlace(sdfBox([1, 1, 1]), { rotate: [0, 30, 0] })], ["rounded box", sdfBox([1, 1, 1], 0.1)], ["repeat", sdfRepeat(sdfSphere(0.2), [1, 1, 1], [2, 2, 2])]] as [string, SdfNode][]) {
    const s = sdf(node), r = releasedScene(s);
    assert.ok("reason" in r, `${name} is outside the released scene`);
    assert.equal(marchRays(s, { count: 1, origins: Float64Array.of(0, 0, 5), directions: Float64Array.of(0, 0, -1) }, options).engine, "local");
    assert.throws(() => marchRays(s, { count: 1, origins: Float64Array.of(0, 0, 5), directions: Float64Array.of(0, 0, -1) }, { ...options, engine: "released" }), /released engine cannot evaluate/);
  }
});

// ---- The view --------------------------------------------------------------------------------------------------------

test("a sphere's view has the analytic silhouette area, depth, normal and no occlusion; perspective changes the disc by the analytic factor", () => {
  const ball = sdf(sdfSphere(1)), cellSize = 8, R = ball.radius;
  for (const projection of ["orthographic", "perspective"] as const) {
    const distance = projection === "orthographic" ? 3 * R : 4 * R, zoom = 100;
    const cam = camera({ projection, yaw: 0, pitch: 0, target: ball.center, zoom, distance, center: [320, 320] });
    const view = sdfView(ball, cam, { cellSize, maxSteps: 96, ao: true });
    let area = 0;
    for (let c = 0; c < view.coverage.length; c++) area += view.coverage[c] * cellSize * cellSize;
    // Ortho: radius zoom * r. Perspective: the silhouette is the tangent cone's circle at the target plane: zoom * distance * tan(asin(r / distance)) ... per the camera model, s = zoom * distance / depth.
    const radius = projection === "orthographic" ? zoom * 1 : zoom * distance * (1 / Math.sqrt(distance * distance - 1));
    near(area / (Math.PI * radius * radius), 1, 0.01);
    assert.ok(view.coverage.some((v) => v > 0.05 && v < 0.95), "silhouette cells carry fractional coverage from the refinement rays");
    // Central cell: depth is eye distance minus the radius; normal faces the viewer; a convex ball has no occlusion.
    const i = Math.round((320 - view.x0) / cellSize), j = Math.round((320 - view.y0) / cellSize), c = j * view.columns + i;
    assert.equal(view.hit[c], 1);
    near(view.depth[c], distance - 1, 5e-3); // the nearest cell centre is up to 5.7 canvas units off the axis
    assert.ok(view.normal[c * 3 + 2] > 0.99, "normal points at the eye");
    let minOcclusion = 1;
    for (let k = 0; k < view.occlusion.length; k++) if (view.hit[k]) minOcclusion = Math.min(minOcclusion, view.occlusion[k]);
    assert.ok(minOcclusion > 0.98, `a convex ball is not occluded (${minOcclusion})`);
  }
});

test("a bore darkens by occlusion and a nearer part hides a farther one in depth", () => {
  const block = sdf(sdfSubtract(sdfBox([1, 1, 1]), sdfCylinder(0.3, 1.5)));
  const cam = camera({ projection: "orthographic", yaw: 0, pitch: 90, target: block.center, zoom: 120, distance: 3 * block.radius, center: [320, 320] });
  const view = sdfView(block, cam, { cellSize: 4, maxSteps: 128, ao: true });
  const cell = (x: number, y: number) => Math.round((y - view.y0) / 4) * view.columns + Math.round((x - view.x0) / 4);
  const top = cell(320 + 100, 320), rim = cell(320 + 40, 320);
  // Looking straight down: the top face is 1 above the centre; the bore's walls are edge-on, so its floor is the far side (through hole: a miss).
  assert.equal(view.hit[top], 1); near(view.depth[top], 3 * block.radius - 1, 1e-3);
  assert.equal(view.hit[cell(320, 320)], 0, "the through-bore shows the background");
  assert.ok(view.occlusion[rim] < view.occlusion[top] + 1e-9, "near the bore wall the surface is at least as occluded as the open face");
  assert.ok(view.occlusion[top] > 0.9);
  // From an angle the bore's inside wall is hit deeper than the top face rim.
  const tilt = camera({ projection: "orthographic", yaw: 0, pitch: 60, target: block.center, zoom: 120, distance: 3 * block.radius, center: [320, 320] });
  const v2 = sdfView(block, tilt, { cellSize: 3, maxSteps: 128, ao: true });
  let minOcc = 1;
  for (let k = 0; k < v2.hit.length; k++) if (v2.hit[k]) minOcc = Math.min(minOcc, v2.occlusion[k]);
  assert.ok(minOcc < 0.8, `the bore interior is occluded (${minOcc})`);
});

test("views are cached by sdf, camera and sampling, never by light or palette", () => {
  const s = sculptureSdf(recipe().sculpt), cam = sculptureCamera(s, recipe().view);
  const options = { cellSize: 8, maxSteps: 64, ao: true };
  const first = sdfView(s, cam, options);
  assert.equal(sdfView(s, cam, options), first);
  assert.equal(cachedSdfView(s, cam, options), first);
  assert.notEqual(sdfView(s, sculptureCamera(s, { ...recipe().view, yaw: 37 }), options), first);
  assert.notEqual(sdfView(s, cam, { ...options, cellSize: 9 }), first);
  assert.ok(Object.isFrozen(first) && Object.isFrozen(first.stats));
  const dark = shadeView(first, cam, s, { azimuth: 0, elevation: 10, ambient: 0, aoStrength: 0, depthFade: 0 }), lit = shadeView(first, cam, s, { azimuth: 0, elevation: 10, ambient: 0.9, aoStrength: 0, depthFade: 0 });
  let differs = 0;
  for (let c = 0; c < dark.length; c++) if (first.hit[c] && dark[c] !== lit[c]) differs++;
  assert.ok(differs > 100);
  assert.equal(sdfView(s, cam, options), first, "shading does not disturb the view");
  const c = first.hit.findIndex((h) => h === 1);
  assert.ok(Number.isNaN(dark[first.hit.findIndex((h) => h === 0)]) && dark[c] >= 0 && dark[c] <= 1);
});

// ---- Stage separation --------------------------------------------------------------------------------------------

test("camera, appearance and sculpt edits recompute exactly what depends on them", () => {
  const base = recipe({ fill: "bands", silhouette: true, creases: true, slices: 4 });
  const p0 = sculptureProducts(base);
  assert.ok(p0.mesh && p0.view && p0.lines);
  // Appearance: palette, levels, opacity, weights, light, hidden-line policy, tone options. Every producer is the same object.
  const same = sculptureProducts(recipe({ fill: "bands", silhouette: true, creases: true, slices: 4, levels: 9, opacity: 0.5, lineWeight: 2.5, sliceWeight: 2, hiddenLines: "faint", lightAzimuth: 80, lightElevation: 10, ambient: 0.6, depthFade: 0.9 }));
  assert.equal(same.sdf, p0.sdf); assert.equal(same.mesh, p0.mesh); assert.equal(same.view, p0.view); assert.equal(same.lines, p0.lines);
  const palette = { ...layer(), palette: [0x111111, 0x222222] };
  assert.equal(sculptureProducts(implicitSculptureComposition(palette)).view, p0.view);
  // Camera: the tree and the mesh are the same objects; the view and lines are new.
  const moved = sculptureProducts(recipe({ fill: "bands", silhouette: true, creases: true, slices: 4, yaw: 80, pitch: 10, roll: 15, projection: "perspective", distance: 3, size: 500, centerX: 300 }));
  assert.equal(moved.sdf, p0.sdf); assert.equal(moved.mesh, p0.mesh);
  assert.notEqual(moved.view, p0.view); assert.notEqual(moved.lines, p0.lines);
  // Sampling: a new cell size re-marches but keeps the mesh; a new mesh detail extracts again but keeps the view.
  const coarse = sculptureProducts(recipe({ fill: "bands", silhouette: true, creases: true, slices: 4, cellSize: 9 }));
  assert.equal(coarse.mesh, p0.mesh); assert.notEqual(coarse.view, p0.view);
  const detail = sculptureProducts(recipe({ fill: "bands", silhouette: true, creases: true, slices: 4, meshDetail: 28 }));
  assert.equal(detail.view, p0.view); assert.notEqual(detail.mesh, p0.mesh);
  // Sculpt: everything downstream is new.
  const carved = sculptureProducts(recipe({ fill: "bands", silhouette: true, creases: true, slices: 4, cells: 4 }));
  assert.notEqual(carved.sdf, p0.sdf); assert.notEqual(carved.mesh, p0.mesh); assert.notEqual(carved.view, p0.view);
  // Only what a recipe needs is built.
  const linesOnly = sculptureProducts(recipe({ fill: "none", silhouette: true, creases: false, slices: 0 }));
  assert.equal(linesOnly.view, null); assert.ok(linesOnly.mesh && linesOnly.lines);
  const raysOnly = sculptureProducts(recipe({ fill: "cells", silhouette: false, creases: false, slices: 0 }));
  assert.equal(raysOnly.mesh, null); assert.equal(raysOnly.lines, null); assert.ok(raysOnly.view);
  // Camera fitting: `size` is the canvas diameter of the bounding sphere in both projections.
  for (const projection of ["orthographic", "perspective"] as const) {
    const r = recipe({ projection, size: 400, distance: 3 }), s = sculptureSdf(r.sculpt), cam = sculptureCamera(s, r.view);
    const right = cam.project([s.center[0] + s.radius * cam.right[0], s.center[1] + s.radius * cam.right[1], s.center[2] + s.radius * cam.right[2]])!;
    if (projection === "orthographic") near(right.x - 320, 200, 1e-9);
    else assert.ok(Math.abs(right.x - 320) <= 200 + 1e-6 && Math.abs(right.x - 320) > 150, "a perspective sphere's tangent rim is within the requested disc");
  }
});

// ---- Extraction ------------------------------------------------------------------------------------------------------

test("dual contouring: a box is exact (volume, area, corners), a sphere and a torus converge, orientation is outward", () => {
  const half: Vec3 = [1.1, 0.7, 0.9];
  const box = sdfMesh(sdf(sdfBox(half)), { detail: 24 }), bm = meshMeasures(box.mesh);
  near(bm.signedVolume, 8 * half[0] * half[1] * half[2], 1e-9);
  near(bm.area, 8 * (half[0] * half[1] + half[1] * half[2] + half[0] * half[2]), 1e-9);
  assert.equal(meshTopology(box.mesh).kind, "closed-manifold"); assert.equal(meshTopology(box.mesh).counts.euler, 2);
  const vertices = Array.from({ length: box.mesh.vertexCount }, (_, v) => meshVertex(box.mesh, v));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
    assert.ok(vertices.some((p) => Math.hypot(p[0] - sx * half[0], p[1] - sy * half[1], p[2] - sz * half[2]) < 1e-9), "every corner of the box is a vertex");
  const errors: number[] = [];
  for (const detail of [16, 32, 64]) {
    const m = meshMeasures(sdfMesh(sdf(sdfSphere(1)), { detail }).mesh);
    errors.push(Math.abs(m.signedVolume - (4 / 3) * Math.PI) / ((4 / 3) * Math.PI));
    assert.ok(m.signedVolume > 0);
  }
  assert.ok(errors[2] < 0.005 && errors[2] < errors[0], `sphere volume error should fall: ${errors}`);
  const ball = sdfMesh(sdf(sdfSphere(1)), { detail: 40 });
  assert.equal(meshTopology(ball.mesh).kind, "closed-manifold"); assert.equal(meshTopology(ball.mesh).counts.euler, 2);
  const ring = sdfMesh(sdf(sdfTorus(0.8, 0.3)), { detail: 48 }), rm = meshMeasures(ring.mesh);
  assert.equal(meshTopology(ring.mesh).counts.euler, 0);
  assert.ok(Math.abs(rm.signedVolume - 2 * Math.PI ** 2 * 0.8 * 0.09) / (2 * Math.PI ** 2 * 0.8 * 0.09) < 0.02, `torus volume ${rm.signedVolume}`);
  assert.ok(Math.abs(rm.area - 4 * Math.PI ** 2 * 0.8 * 0.3) / (4 * Math.PI ** 2 * 0.8 * 0.3) < 0.02, `torus area ${rm.area}`);
  const pr = ball.provenance;
  assert.equal(pr.method, "dual-contouring"); assert.equal(pr.level, 0); assert.equal(pr.sdf, sdf(sdfSphere(1)).key); assert.equal(pr.vertices, ball.mesh.vertexCount);
  assert.equal(sdfMesh(sdf(sdfSphere(1)), { detail: 40 }), ball, "cached by tree and detail");
});

test("a carved block keeps its bore rim sharp: rim vertices lie exactly in the face plane on the bore circle", () => {
  const block = sdf(sdfSubtract(sdfBox([1, 1, 1]), sdfCylinder(0.4, 1.5)));
  const m = sdfMesh(block, { detail: 40 }), topo = meshTopology(m.mesh);
  assert.equal(topo.kind, "closed-manifold"); assert.equal(topo.counts.euler, 0, "a block with one through-bore is a solid torus");
  const me = meshMeasures(m.mesh);
  assert.ok(Math.abs(me.signedVolume - (8 - Math.PI * 0.16 * 2)) / (8 - Math.PI * 0.16 * 2) < 0.01, `volume ${me.signedVolume}`);
  const h = m.provenance.spacing;
  const rim = Array.from({ length: m.mesh.vertexCount }, (_, v) => meshVertex(m.mesh, v)).filter((p) => Math.abs(p[1] - 1) < 1e-9 && Math.abs(Math.hypot(p[0], p[2]) - 0.4) < 0.5 * h);
  assert.ok(rim.length >= 30, `${rim.length} vertices near the rim`);
  for (const p of rim) assert.ok(Math.abs(Math.hypot(p[0], p[2]) - 0.4) < 0.05 * h, `rim vertex at radius ${Math.hypot(p[0], p[2])} is not on the 0.4 circle`);
});

test("extraction failures name Mesh detail and nothing is truncated", () => {
  const s = sdf(sdfSphere(1));
  assert.throws(() => sdfMesh(s, { detail: 3 }), /Mesh detail must be an integer in \[4, 128\]/);
  assert.throws(() => sdfMesh(s, { detail: 12.5 }), /Mesh detail/);
  // A checkerboard field changes sign in nearly every cell: the vertex limit stops it, naming Mesh detail.
  const noisy = sdf(sdfField("checker", (x, y, z) => Math.sin(97 * x) * Math.sin(89 * y) * Math.sin(83 * z), { min: [-1, -1, -1], max: [1, 1, 1] }));
  assert.throws(() => sdfMesh(noisy, { detail: 80 }), /more than 200000 vertices; lower Mesh detail \(now 80\)/);
  assert.throws(() => sdfMesh(s, { detail: 61, maxWork: 1000 }), /exceed maxWork 1000; lower Mesh detail/);
  assert.throws(() => sdfMesh(sdf(sdfField("empty", () => 1, { min: [-1, -1, -1], max: [1, 1, 1] })), { detail: 8 }), /no surface at this grid/);
});

test("surface points lie on the exact surface with gradient normals, and thinning is by prefix", () => {
  const tree = sdf(sdfSubtract(sdfSphere(1), sdfBox([0.5, 0.5, 0.5], 0.1))), pts = sdfSurfacePoints(tree, { detail: 32, count: 400, seed: 3 });
  const data = pointCloudData(pts);
  assert.equal(pts.count, 400);
  for (let i = 0; i < pts.count; i++) {
    assert.ok(Math.abs(tree.distance(data.positions[i * 3], data.positions[i * 3 + 1], data.positions[i * 3 + 2])) < 2e-3, `point ${i} is off the surface`);
    near(norm([data.normals![i * 3], data.normals![i * 3 + 1], data.normals![i * 3 + 2]]), 1, 1e-6);
  }
  const more = pointCloudData(sdfSurfacePoints(tree, { detail: 32, count: 800, seed: 3 }));
  assert.deepEqual(Array.from(data.positions), Array.from(more.positions.slice(0, 1200)), "the first n of a longer run are the same points");
  const other = pointCloudData(sdfSurfacePoints(tree, { detail: 32, count: 400, seed: 4 }));
  assert.notDeepEqual(Array.from(other.positions.slice(0, 30)), Array.from(data.positions.slice(0, 30)));
  assert.throws(() => sdfSurfacePoints(tree, { detail: 32, count: 10, seed: 1, refine: 9 }), /refine/);
});

// ---- Hidden lines against the ray march -------------------------------------------------------------------------

test("visible and hidden line runs agree with the ray-marched depth (two independent occlusion solutions)", () => {
  const r = recipe({ form: "lattice-cavity", cut: "quarter", fill: "cells", cellSize: 3, slices: 6, sliceAxis: "y", silhouette: true, creases: true, hiddenLines: "faint", voidKeep: 1 });
  const p = sculptureProducts(r), view = p.view!, spacing = p.mesh!.provenance.spacing;
  const cellWorld = view.cellSize / p.camera.options.zoom;
  let visibleChecked = 0, visibleBad = 0, hiddenChecked = 0, hiddenBad = 0;
  for (const set of [p.lines!.slices, p.lines!.features]) for (const path of set) {
    path.points.forEach(([x, y], k) => {
      const i = Math.round((x - view.x0) / view.cellSize), j = Math.round((y - view.y0) / view.cellSize);
      if (i < 1 || j < 1 || i >= view.columns - 1 || j >= view.rows - 1) return;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (!view.hit[(j + dj) * view.columns + i + di]) return; // interior cells only
      const depthMax = Math.max(...[-1, 0, 1].flatMap((dj) => [-1, 0, 1].map((di) => view.depth[(j + dj) * view.columns + i + di])));
      const depthMin = Math.min(...[-1, 0, 1].flatMap((dj) => [-1, 0, 1].map((di) => view.depth[(j + dj) * view.columns + i + di])));
      const depth = path.depths[k], slack = 2 * spacing + 4 * cellWorld;
      if (path.visible) { visibleChecked++; if (depth > depthMax + slack) visibleBad++; }
      else { hiddenChecked++; if (depth < depthMin - slack * 0.25) hiddenBad++; }
    });
  }
  assert.ok(visibleChecked > 500 && hiddenChecked > 100, `samples: ${visibleChecked} visible, ${hiddenChecked} hidden`);
  assert.ok(visibleBad / visibleChecked < 0.02, `${visibleBad} of ${visibleChecked} visible points lie behind the marched surface`);
  assert.ok(hiddenBad / hiddenChecked < 0.05, `${hiddenBad} of ${hiddenChecked} hidden points lie in front of the marched surface`);
});

test("a nearer slab and the sphere itself hide a ring exactly where the analytic occlusion says", () => {
  // Orthographic view down -Z. A slab (x, y in [-0.5, 0.5] x [-1.5, 1.5], z in [1, 2]) stands in front of a unit sphere centred at z = -1.
  // A ring of radius 1.03 about the sphere's equator floats just outside it: its near half is visible except behind the slab (|x| < 0.5),
  // its far half is hidden by the sphere except beyond the sphere's outline (|x| > 1).
  const scene = sdf(sdfUnion(sdfSphere(1, [0, 0, -1]), sdfPlace(sdfBox([0.5, 1.5, 0.5]), { translate: [0, 0, 1.5] })));
  const m = sdfMesh(scene, { detail: 64 }), distance = 10, R = 1.03;
  const cam = camera({ projection: "orthographic", yaw: 0, pitch: 0, target: scene.center, zoom: 100, distance, center: [0, 0] });
  assert.deepEqual(scene.center, [0, 0, 0]);
  const ring: Vec3[] = Array.from({ length: 1441 }, (_, i) => [R * Math.cos((i / 1440) * 2 * Math.PI), 0, -1 + R * Math.sin((i / 1440) * 2 * Math.PI)]);
  const result = hiddenLines(m.mesh, [{ id: "ring", points: ring, closed: true }], cam);
  let hidden = 0, visible = 0, skipped = 0;
  for (const path of result.paths) path.points.forEach(([px], k) => {
    const x = Math.abs(px / 100), z = distance - path.depths[k];
    if (Math.abs(x - 0.5) < 0.012 || Math.abs(x - 1) < 0.012 || Math.abs(z + 1) < 0.012) { skipped++; return; }
    const expectVisible = x > 1 || (z > -1 && x > 0.5);
    assert.equal(path.visible, expectVisible, `ring point x=${x.toFixed(3)} z=${z.toFixed(3)}`);
    if (path.visible) visible++; else hidden++;
  });
  assert.ok(visible > 150 && hidden > 400 && skipped < 250, `${visible} visible, ${hidden} hidden, ${skipped} skipped`);
  // Visible runs end where the slab's edge (|x| = 0.5) crosses the ring.
  const ends = result.paths.filter((p) => p.visible).flatMap((p) => [p.points[0][0] / 100, p.points[p.points.length - 1][0] / 100]).map(Math.abs);
  assert.ok(ends.filter((x) => Math.abs(x - 0.5) < 0.01).length >= 2, "a visible run ends where the slab's edge crosses the ring");
});

// ---- The instrument -----------------------------------------------------------------------------------------------

test("the operation order is real: shell-then-cut opens a hollow, cut-then-shell skins the cut face", () => {
  const shellFirst = sculptureSdf(recipe({ form: "carved-block", roundness: 1, bores: 0, hollow: true, wall: 0.2, cut: "half", cutAt: 0, order: "shell-first" }).sculpt);
  const cutFirst = sculptureSdf(recipe({ form: "carved-block", roundness: 1, bores: 0, hollow: true, wall: 0.2, cut: "half", cutAt: 0, order: "cut-first" }).sculpt);
  // A unit-radius ball (box tangent, roundness 1): hollow wall 0.2 is the shell |d| < 0.1, cutter removes x > 0.
  const onCut: Vec3 = [-0.02, 0, 0];
  assert.ok(shellFirst.distance(...onCut) > 0, "shell first: the interior at the cut plane is empty");
  assert.ok(cutFirst.distance(...onCut) < 0, "cut first: the cut face itself is a skin");
  const wall: Vec3 = [-0.95, 0, 0];
  assert.ok(shellFirst.distance(...wall) < 0 && cutFirst.distance(...wall) < 0, "both keep the outer wall");
  const removed: Vec3 = [0.95, 0, 0];
  assert.ok(shellFirst.distance(...removed) > 0 && cutFirst.distance(...removed) > 0, "both remove the wall beyond the cut");
  assert.equal(shellFirst.class, "bound");
});

test("bundled sculptures: structure follows the controls and the seed only where it can", () => {
  const key = (params: Record<string, number | string | boolean>, seed = 42) => sculptureSdf(recipe(params, seed).sculpt).key;
  assert.equal(key({ form: "carved-block" }, 1), key({ form: "carved-block" }, 2), "a block has no seeded structure");
  assert.equal(key({ form: "fractal-fragment" }, 1), key({ form: "fractal-fragment" }, 2));
  assert.notEqual(key({ form: "coral" }, 1), key({ form: "coral" }, 2));
  assert.notEqual(key({ voidKeep: 0.6 }, 1), key({ voidKeep: 0.6 }, 2));
  assert.equal(key({ voidKeep: 1 }, 1), key({ voidKeep: 1 }, 2));
  assert.equal(key({ voidKeep: 0 }, 1), key({ voidKeep: 0 }, 2));
  // Hidden controls are not read: a coral's lattice settings and a block's growth settings change nothing.
  assert.equal(key({ form: "coral", cells: 5, voidSize: 0.3, bores: 1, iterations: 1 }), key({ form: "coral" }));
  assert.equal(key({ form: "carved-block", branches: 3, blend: 0.9, fold: "tetra" }), key({ form: "carved-block" }));
  for (const p of [{ cut: "half" }, { cut: "corner" }, { hollow: true }, { twist: 0.5 }, { bend: 0.3 }, { repeatX: 2 }, { form: "carved-block", bores: 2 }]) assert.notEqual(key(p), key({}), JSON.stringify(p));
  // Equal trees are one object.
  assert.equal(sculptureSdf(recipe().sculpt), sculptureSdf(recipe({ centerX: 100, yaw: 5 }).sculpt));
  assert.equal(sculptureTree(recipe({ cut: "none", hollow: false }).sculpt).kind, "subtract");
});

test("tones: the ramp interpolates the palette, quantises to level centres and a single colour shades by density", () => {
  const palette = [0x000000, 0x000000, 0xff8000];
  assert.deepEqual(toneColor(palette, 0, 1).map(Math.round), [0, 0, 0, 255]);
  assert.deepEqual(toneColor(palette, 1, 0.5).map(Math.round), [255, 128, 0, 128]);
  assert.deepEqual(toneColor(palette, 0.5, 1).map(Math.round), [128, 64, 0, 255]);
  near(quantizeTone(0.5, 5), 0.5); near(quantizeTone(0.99, 5), 0.9); near(quantizeTone(0, 5), 0.1); near(quantizeTone(1, 5), 0.9);
  const one = toneColor([0x336699], 0, 1), light = toneColor([0x336699], 1, 1);
  assert.ok(one[3] > light[3] * 5 && light[3] > 0, "a single colour is denser in shadow");
});

test("drawing: transparent layer, lines-only is useful, every fill draws, limits name their controls", () => {
  for (const fill of ["cells", "bands", "facets", "points", "none"]) {
    const { surface, calls } = recorder();
    drawInstrument(surface as never, layer({ fill, cut: "quarter" }));
    assert.equal(calls.filter((c) => c.name === "background").length, 0);
    const full = calls.filter((c) => c.name === "rect" && (c.args[2] as number) >= 640 && (c.args[3] as number) >= 640);
    assert.equal(full.length, 0, "no full-canvas rectangle");
    const painted = calls.filter((c) => ["rect", "circle", "endShape"].includes(c.name)).length;
    assert.ok(painted > 50, `${fill} draws (${painted} painting calls)`);
  }
  const { surface, calls } = recorder();
  drawInstrument(surface as never, layer({ fill: "none", silhouette: false, creases: false, slices: 0 }));
  assert.equal(calls.filter((c) => c.name === "endShape" || c.name === "rect").length, 0, "nothing selected draws nothing");
  const lines = recorder();
  drawInstrument(lines.surface as never, layer({ fill: "none", slices: 6 }));
  assert.ok(lines.calls.filter((c) => c.name === "endShape").length > 20, "an edge-only drawing still shows the form");
  assert.equal(lines.calls.filter((c) => c.name === "fill").length, 0, "edge-only sets no fill");
  assert.throws(() => drawInstrument(recorder().surface as never, layer({ cellSize: 1, size: 900, fill: "cells" })), /Cell size/);
  assert.throws(() => drawInstrument(recorder().surface as never, layer({ steps: 1000, cellSize: 2, size: 640, form: "coral", fill: "cells" })), /Cell size|March steps/);
  assert.throws(() => validateInstrument(layer({ iterations: 9 }) as never), /iterations|Iterations/);
});

test("bands are clipped to the silhouette: the base region has the disc's area and every band lies inside it", () => {
  // A carved block with roundness 1 and no bores is the unit sphere; the orthographic camera scales the bounding sphere to `size`.
  const size = 500, input = layer({ form: "carved-block", roundness: 1, bores: 0, cut: "none", fill: "bands", levels: 4, silhouette: false, creases: false, size, cellSize: 4, projection: "orthographic" });
  const { surface, calls } = recorder();
  drawInstrument(surface as never, input);
  const shapes: [number, number][][] = [];
  for (const c of calls) {
    if (c.name === "beginShape") shapes.push([]);
    else if (c.name === "vertex") shapes[shapes.length - 1].push([c.args[0] as number, c.args[1] as number]);
  }
  const area = (ring: [number, number][]) => Math.abs(ring.reduce((sum, p, i) => sum + p[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * p[1], 0)) / 2;
  const tree = sculptureSdf(recipe({ form: "carved-block", roundness: 1, bores: 0, cut: "none" }).sculpt), radius = (size / (2 * tree.radius)) * 1;
  near(area(shapes[0]) / (Math.PI * radius * radius), 1, 0.02);
  assert.ok(shapes.length >= 3, "the base and at least two lighter bands");
  const centre = [320, 322];
  for (const ring of shapes) for (const [x, y] of ring) assert.ok(Math.hypot(x - centre[0], y - centre[1]) <= radius * 1.02 + 0.5, `a band vertex at (${x}, ${y}) pokes out of the silhouette`);
  assert.ok(shapes.slice(1).every((ring) => area(ring) < area(shapes[0]) * 1.001), "bands are inside the base");
});

test("a hidden-line policy of drop removes hidden runs and faint keeps them lighter", () => {
  const strokes = (hiddenLines: string) => {
    const { surface, calls } = recorder();
    drawInstrument(surface as never, layer({ fill: "none", hiddenLines, cut: "quarter", silhouette: true, creases: true }));
    return calls.filter((c) => c.name === "stroke").map((c) => c.args[3] as number);
  };
  const drop = strokes("drop"), faint = strokes("faint");
  assert.ok(drop.every((a) => a === 255));
  assert.ok(faint.length > drop.length && faint.some((a) => a < 255));
});

test("color and light are appearance only: the same marched cells, different pixels", () => {
  const base = drawFingerprint(layer({}));
  assert.notEqual(drawFingerprint(layer({ levels: 8 })), base);
  assert.notEqual(drawFingerprint(layer({ lightAzimuth: 60 })), base);
  assert.equal(drawFingerprint(layer({})), base, "deterministic");
  assert.equal(drawFingerprint(layer({}, 42)), drawFingerprint(layer({}, 42)));
  assert.notEqual(drawFingerprint(layer({}, 7)), base, "a new seed reshuffles the omitted voids");
  const block = (seed: number) => drawFingerprint(layer({ form: "carved-block" }, seed));
  assert.equal(block(1), block(2), "usesSeed is false for a block");
  assert.equal(usesSeed(layer({ form: "carved-block" })), false);
  assert.equal(usesSeed(layer({ form: "coral" })), true);
  assert.equal(usesSeed(layer({ form: "carved-block", fill: "points" })), true);
});

test("hidden controls never change the drawing (property test over random configurations)", () => {
  const next = rng(11);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(next() * list.length)];
  let changes = 0;
  for (let n = 0; n < 24; n++) {
    const params: Record<string, number | string | boolean> = {
      cellSize: 8, steps: 64, meshDetail: 20, pointCount: 800, form: pick(["carved-block", "lattice-cavity", "coral", "fractal-fragment"]), cut: pick(["none", "half", "quarter", "corner", "slot"]),
      hollow: next() < 0.4, projection: pick(["orthographic", "perspective"]), fill: pick(["none", "cells", "bands", "facets", "points"]), creases: next() < 0.5, silhouette: next() < 0.5,
      iterations: 1 + Math.floor(next() * 2), slices: next() < 0.3 ? 3 : 0,
    };
    const input = layer(params, Math.floor(next() * 1000));
    const before = drawFingerprint(input);
    const shown = new Set(visibleParameters(ID, input.params).map((p) => p.key));
    const hidden = definition(ID).parameters.filter((p) => !shown.has(p.key));
    assert.ok(hidden.length > 0);
    for (let k = 0; k < 6; k++) {
      const control = pick(hidden), changed = layer(params, input.seed);
      if (control.type === "number") {
        const lo = control.min ?? 0, hi = control.max ?? 1, v = lo + next() * (hi - lo);
        changed.params[control.key] = control.integer ? Math.round(v) : v;
      } else if (control.type === "boolean") changed.params[control.key] = !(input.params[control.key] as boolean);
      else changed.params[control.key] = pick((control.options ?? []).map((o) => o.value));
      assert.ok(!new Set(visibleParameters(ID, changed.params).map((p) => p.key)).has(control.key), "the control stays hidden");
      assert.equal(drawFingerprint(changed), before, `${control.key} is hidden for ${JSON.stringify(params)} but changed the drawing`);
      changes++;
    }
  }
  assert.ok(changes >= 100);
});

test("the inspector groups controls by construction with proportional line weights", () => {
  type Group = { kind: string; label: string; proportional: boolean; items: Group[] };
  const items = inspectorItems(ID, layer().params) as unknown as Group[];
  assert.deepEqual(items.map((g) => g.label), ["Form", "Placement", "Carve", "Deform", "Repeat", "View", "Light", "Fill", "Lines", "Quality"]);
  const lines = items.find((g) => g.label === "Lines")!;
  assert.ok(lines.items.some((c) => c.label === "Line weights" && c.proportional === true));
  const form = items.find((g) => g.label === "Form")!;
  assert.ok(form.items.some((c) => c.label === "Lattice") && !form.items.some((c) => ["Growth", "Fold", "Block"].includes(c.label)), "only the chosen form's group shows");
  const coral = inspectorItems(ID, { ...layer().params, form: "coral" }) as unknown as Group[];
  assert.ok(coral[0].items.some((c) => c.label === "Growth"));
});

test("prepare warms every stage, reports cancellation, and publishes nothing when cancelled", async () => {
  const input = layer({ cells: 5, cellSize: 4, fill: "cells", silhouette: false, creases: false });
  const r = implicitSculptureComposition(input), s = sculptureSdf(r.sculpt), cam = sculptureCamera(s, r.view);
  const options = { cellSize: 4, maxSteps: r.quality.steps, ao: true };
  assert.equal(await prepareInstrument(input, () => true), false);
  assert.equal(cachedSdfView(s, cam, options), undefined);
  let polls = 0;
  const cancelledLater = await prepareInstrument(input, () => ++polls > 5);
  assert.equal(cancelledLater, false);
  assert.equal(cachedSdfView(s, cam, options), undefined, "a cancelled march leaves no partial view");
  assert.equal(await prepareInstrument(input, () => false), true);
  const warmed = cachedSdfView(s, cam, options);
  assert.ok(warmed);
  assert.equal(sdfView(s, cam, options), warmed, "drawing after prepare reuses the prepared view");
});

test("the seed, palette and layer are plain scalars: no closure is persisted", () => {
  const input = layer();
  assert.deepEqual(Object.keys(input).sort(), ["cutEdits", "palette", "params", "seed", "technique"]);
  assert.ok(Object.values(input.params).every((v) => ["number", "string", "boolean"].includes(typeof v)));
  assert.throws(() => implicitSculptureComposition({ ...input, technique: "other" }), /Not a implicit-sculpture input/);
  assert.throws(() => implicitSculptureComposition({ ...input, palette: [] }), /packed RGB/);
});
