import assert from "node:assert/strict";
import test from "node:test";
import {
  BLOCK_LIMITS, camera, createInstrument, geologicalBlock, geologicalCamera, geologicalCutawaysComposition, geologicalHiddenLines, geologicalPaintOrder,
  geologicalProducts, inspectorItems, locateInDomain, meshComponents, meshData, meshMeasures, meshTopology, planarDomain, strataModel, triangulatePolygon, usesSeed,
  definitions, drawInstrument, prepareInstrument, validateInstrument, viewGeometry, visibleParameters,
  type GeologicalBlock, type GeologicalCutOptions, type GeologicalView, type InstrumentInput, type StrataOptions,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";

const ID = "geological-cutaways";
const base: StrataOptions = {
  seed: 7, depth: 0.7, height: 0.5, strata: 8, sequence: "random", contrast: 3, stack: 0.9, trend: 0.3, tilt: 4, tiltAzimuth: 30,
  fold: "sinusoidal", foldAmplitude: 0.12, foldWavelength: 0.8, foldAxis: 20, foldPhase: 0, faultCount: 2, faultThrow: 0.12, faultDip: 60,
  faultStrike: "depth", faultDipDirection: "left", faultStyle: "stepped", faultShift: 0, faultScatter: 0.3, relief: 0.1, reliefScale: 0.8,
};
const flat = (o: Partial<StrataOptions> = {}): StrataOptions => ({ ...base, relief: 0, ...o });
const RES = 24;
const cutOf = (o: Partial<GeologicalCutOptions> = {}): GeologicalCutOptions =>
  ({ kind: "block", slicePosition: 0.5, sliceAzimuth: 0, sliceDip: 90, corner: "front-right", cutWidth: 0.5, cutDepth: 0.5, cutHeight: 0.5, gap: 0.2, ...o });
const LINES = { beds: 0, contours: 0 };

// ---- Independent helpers -----------------------------------------------------------------------

/** Deterministic generator so the property tests are reproducible. */
function lcg(seed: number) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 0x1_0000_0000); }

/** Signed volume of a triangle soup by the divergence theorem, and per-range for one brick. */
function volume(positions: ArrayLike<number>, triangles: ArrayLike<number>, from = 0, to = triangles.length / 3): number {
  let sum = 0;
  for (let t = from; t < to; t++) {
    const a = triangles[t * 3] * 3, b = triangles[t * 3 + 1] * 3, c = triangles[t * 3 + 2] * 3;
    sum += (positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1])
      - positions[a + 1] * (positions[b] * positions[c + 2] - positions[b + 2] * positions[c])
      + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c])) / 6;
  }
  return sum;
}

/** Ray parity: is `p` inside the closed triangle range `[from, to)`? Möller-Trumbore along an irrational direction. */
function inside(positions: ArrayLike<number>, triangles: ArrayLike<number>, from: number, to: number, p: readonly [number, number, number]): boolean {
  const d = [0.5793021, 0.3136112, 0.7519803];
  let crossings = 0;
  for (let t = from; t < to; t++) {
    const a = triangles[t * 3] * 3, b = triangles[t * 3 + 1] * 3, c = triangles[t * 3 + 2] * 3;
    const e1 = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]];
    const e2 = [positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]];
    const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
    const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (Math.abs(det) < 1e-14) continue;
    const s = [p[0] - positions[a], p[1] - positions[a + 1], p[2] - positions[a + 2]], u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
    if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
    const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
    if (v < 0 || u + v > 1) continue;
    if ((e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det > 0) crossings++;
  }
  return crossings % 2 === 1;
}

const build = (o: StrataOptions, res = RES) => { const model = strataModel(o); return { model, block: geologicalBlock(model, res) }; };
const tri = (block: GeologicalBlock) => meshData(block.mesh);
const signedArea = (r: readonly (readonly [number, number])[]) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + (p[0] * q[1] - q[0] * p[1]) / 2; }, 0);

// ---- Model: monotone horizons ------------------------------------------------------------------

test("horizons never cross: thickness is the stated positive closed form and every effective sheet rises by at least the floor", () => {
  // Uniform sequence: the thickness of stratum k at x is stack*H/(n-2) * (1 + trend*s_k*x/W) with s_k = +1 for even k, -1 for odd k.
  const o = flat({ sequence: "uniform", strata: 7, stack: 1.2, trend: 0.6, fold: "chevron", tilt: 9 });
  const model = strataModel(o);
  for (const [x, z] of [[-0.5, 0.1], [-0.2, -0.3], [0, 0], [0.31, 0.2], [0.5, -0.35]]) for (let k = 1; k <= 5; k++) {
    const expected = o.stack * o.height / 5 * (1 + o.trend * (k % 2 === 0 ? 1 : -1) * x);
    assert.ok(Math.abs(model.horizon(k + 1, x, z) - model.horizon(k, x, z) - expected) < 1e-12, `stratum ${k} at x=${x}`);
    assert.ok(Math.abs(model.thickness(k, x, z) - expected) < 1e-12);
  }
  // Random valid models: positive thickness everywhere, and in the built block every column's sheets are strictly ordered.
  const next = lcg(11);
  let checked = 0;
  for (let i = 0; i < 40; i++) {
    const r = (a: number, b: number) => a + (b - a) * next();
    const options: StrataOptions = {
      ...base, seed: Math.floor(next() * 1e6), strata: 2 + Math.floor(next() * 9), contrast: r(1, 8), stack: r(0.4, 1.8), trend: r(-0.9, 0.9), tilt: r(-20, 20), tiltAzimuth: r(-180, 180),
      fold: (["none", "sinusoidal", "chevron", "dome"] as const)[Math.floor(next() * 4)], foldAmplitude: r(0, 0.25), foldWavelength: r(0.4, 1.6), foldAxis: r(-90, 90),
      faultCount: Math.floor(next() * 3), faultThrow: r(-0.25, 0.25), faultDip: r(60, 90), relief: r(0, 0.3), sequence: (["uniform", "thinning", "thickening", "rhythmic", "random"] as const)[Math.floor(next() * 5)],
    };
    let built;
    try { built = build(options, 14); } catch (e) { assert.match((e as Error).message, /Fault|Horizons|erosion/); continue; }
    checked++;
    const { model: m, block } = built;
    for (let k = 1; k <= m.strata - 2; k++) for (let j = 0; j < 20; j++) {
      const x = r(-0.5, 0.5), z = r(-0.3, 0.3);
      assert.ok(m.thickness(k, x, z) > 0 && m.horizon(k + 1, x, z) > m.horizon(k, x, z));
    }
    for (const grid of block.grids) for (let w = 0; w < m.strata; w++) for (let v = 0; v < grid.sheets[w].y.length; v++)
      assert.ok(grid.sheets[w + 1].y[v] - grid.sheets[w].y[v] >= 1e-5 * m.height * 0.999, `compartment ${grid.compartment}, sheet ${w}, vertex ${v}`);
  }
  assert.ok(checked >= 25, `only ${checked} of 40 random models were valid`);
});

// ---- Faults: offset equals the declared throw ---------------------------------------------------

test("across every fault plane each horizon is offset vertically by exactly the declared throw and horizontally by cot(dip) times it, whatever the folds", () => {
  const cases: Partial<StrataOptions>[] = [
    { fold: "none", tilt: 0, trend: 0 },
    { fold: "sinusoidal", tilt: 6, trend: 0.4, faultStyle: "alternating", faultCount: 3 },
    { fold: "chevron", faultDipDirection: "right", faultThrow: 0.15 },
    { fold: "dome", faultStrike: "width", faultThrow: -0.1, faultDip: 70 },
    { fold: "sinusoidal", faultStyle: "mixed", faultScatter: 0.8, faultDip: 90, faultCount: 4, foldAmplitude: 0.2 },
  ];
  for (const [index, extra] of cases.entries()) {
    const { model, block } = build(flat(extra), 20);
    assert.ok(model.faults.length >= 2);
    const hangingLeft = model.kappa >= 0;
    let compared = 0;
    for (const fault of model.faults) {
      const left = block.grids[fault.index], right = block.grids[fault.index + 1];
      for (let w = 1; w < model.strata; w++) for (let b = 0; b <= left.nq; b++) {
        const yl = left.raw[w - 1][b * (left.nz + 1) + left.nz], yr = right.raw[w - 1][b * (right.nz + 1)];
        // The hanging wall (above the plane) drops by the throw: the footwall horizon is higher by exactly `throw`.
        const expected = hangingLeft ? fault.throw : -fault.throw;
        assert.ok(Math.abs((yr - yl) - expected) < 1e-9, `case ${index}, fault ${fault.index}, horizon ${w}, row ${b}: ${yr - yl} != ${expected}`);
        // Both points lie on the fault plane p = c + kappa (y - H/2): the slip vector is (kappa*throw, throw) in the plane.
        const A = left.place(yl, left.nz, b), B = right.place(yr, 0, b);
        const [pl] = model.toPQ(A[0], A[2]), [pr] = model.toPQ(B[0], B[2]);
        assert.ok(Math.abs(pl - (fault.position + model.kappa * (yl - model.height / 2))) < 1e-9);
        assert.ok(Math.abs(pr - (fault.position + model.kappa * (yr - model.height / 2))) < 1e-9);
        assert.ok(Math.abs((pr - pl) - model.kappa * (yr - yl)) < 1e-9);
        compared++;
      }
    }
    assert.ok(compared > 100);
  }
});

test("the inverse-map oracle agrees with the sheets: just below a horizon vertex is the stratum beneath it, just above the one over it, in the right compartment", () => {
  const { model, block } = build(flat({ fold: "chevron", faultCount: 3, faultStyle: "alternating", tilt: 3 }), 20);
  let checked = 0;
  for (const grid of block.grids) for (let w = 1; w < model.strata; w++) for (let b = 0; b <= grid.nq; b += 2) for (let a = 1; a < grid.nz; a++) {
    const y = grid.raw[w - 1][b * (grid.nz + 1) + a];
    if (y < 0.05 || y > model.height - 0.05) continue;
    const p = grid.place(y, a, b), eps = 3e-5;
    const below = model.stratumAt(p[0], y - eps, p[2]), above = model.stratumAt(p[0], y + eps, p[2]);
    assert.equal(below.stratum, w - 1, `compartment ${grid.compartment}, horizon ${w}, column ${a}, row ${b}`);
    assert.equal(above.stratum, w);
    assert.equal(below.compartment, grid.compartment);
    checked++;
  }
  assert.ok(checked > 200);
});

// ---- The block mesh: closed bricks that tile the block --------------------------------------------

test("every brick is a closed manifold, the bricks tile the block exactly and each point belongs to exactly one brick", () => {
  for (const extra of [{}, { fold: "dome" as const, faultDip: 90, faultCount: 3 }, { faultStrike: "width" as const, faultDipDirection: "right" as const, fold: "chevron" as const }]) {
    const { model, block } = build(flat(extra), 18);
    const topology = meshTopology(block.mesh);
    assert.equal(topology.kind, "closed-manifold");
    assert.equal(topology.counts.nonManifoldEdges, 0);
    assert.equal(topology.counts.boundaryEdges, 0);
    assert.equal(topology.counts.unusedVertices, 0);
    const nonEmpty = block.bricks.filter((b) => b.faces[1] > b.faces[0]);
    assert.equal(meshComponents(block.mesh, topology).length, nonEmpty.length);
    const { positions, triangles } = tri(block);
    let total = 0;
    for (const brick of nonEmpty) {
      const v = volume(positions, triangles, brick.faces[0], brick.faces[1]);
      assert.ok(v > 0, `brick ${brick.id} has volume ${v}`);
      total += v;
    }
    // Flat ground: the layers fill the box, whatever the folds and faults did to them.
    assert.ok(Math.abs(total - model.width * model.depth * model.height) < 1e-9, `${total} != ${model.width * model.depth * model.height}`);
    // Point ownership by ray parity (independent of the construction) against the inverse-map oracle.
    const next = lcg(5);
    let clear = 0;
    for (let i = 0; i < 260; i++) {
      const p = [(next() - 0.5) * model.width, next() * model.height, (next() - 0.5) * model.depth] as const;
      const owners = nonEmpty.filter((brick) => inside(positions, triangles, brick.faces[0], brick.faces[1], p));
      assert.equal(owners.length, 1, `point ${p} is in ${owners.length} bricks`);
      const here = model.stratumAt(...p);
      const margin = 0.02;
      const shifted = [model.stratumAt(p[0], p[1] + margin, p[2]), model.stratumAt(p[0], p[1] - margin, p[2])];
      const [pp] = model.toPQ(p[0], p[2]);
      const near = model.faults.some((f) => Math.abs(pp - model.kappa * (p[1] - model.height / 2) - f.position) < margin);
      if (near || shifted.some((s) => s.stratum !== here.stratum)) continue;
      clear++;
      assert.equal(owners[0].stratum, here.stratum, `point ${p}`);
      assert.equal(owners[0].compartment, here.compartment);
    }
    assert.ok(clear > 90, `${clear} unambiguous points`);
  }
});

test("with an eroded surface the bricks tile the volume under the ground mesh", () => {
  const { block } = build(base, 22);
  const { positions, triangles } = tri(block), ground = meshData(block.ground.mesh);
  let underGround = 0;
  for (let t = 0; t < ground.triangles.length / 3; t++) {
    const i = [0, 1, 2].map((k) => ground.triangles[t * 3 + k] * 3);
    const [ax, az] = [ground.positions[i[0]], ground.positions[i[0] + 2]], [bx, bz] = [ground.positions[i[1]], ground.positions[i[1] + 2]], [cx, cz] = [ground.positions[i[2]], ground.positions[i[2] + 2]];
    underGround += Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2 * (ground.positions[i[0] + 1] + ground.positions[i[1] + 1] + ground.positions[i[2] + 1]) / 3;
  }
  assert.ok(Math.abs(volume(positions, triangles) - underGround) < 1e-9 * Math.max(1, underGround), `${volume(positions, triangles)} vs ${underGround}`);
});

// ---- Sections ---------------------------------------------------------------------------------

function sectionAgreement(view: GeologicalView, model: ReturnType<typeof build>["model"], seedValue = 3): { checked: number; wrong: number } {
  const next = lcg(seedValue), plane = view.caps[0];
  let checked = 0, wrong = 0;
  const bounds = view.caps.flatMap((c) => c.domain.regions.map((r) => r.bounds));
  const left = Math.min(...bounds.map((b) => b[0])), top = Math.min(...bounds.map((b) => b[1])), right = Math.max(...bounds.map((b) => b[2])), bottom = Math.max(...bounds.map((b) => b[3]));
  const { frame } = plane;
  for (let i = 0; i < 500; i++) {
    const u = left + next() * (right - left), v = top + next() * (bottom - top);
    const world: [number, number, number] = [frame.origin[0] + u * frame.u[0] + v * frame.v[0], frame.origin[1] + u * frame.u[1] + v * frame.v[1], frame.origin[2] + u * frame.u[2] + v * frame.v[2]];
    if (world[1] < 0 || world[1] > model.groundRange[0] - 1e-9) continue;
    if (Math.abs(world[0]) > model.width / 2 || Math.abs(world[2]) > model.depth / 2) continue;
    const margin = 0.012, here = model.stratumAt(...world);
    const ring = [[margin, 0, 0], [-margin, 0, 0], [0, margin, 0], [0, -margin, 0], [0, 0, margin], [0, 0, -margin]] as const;
    if (ring.some((d) => model.stratumAt(world[0] + d[0], world[1] + d[1], world[2] + d[2]).stratum !== here.stratum)) continue;
    const owners = view.caps.filter((c) => locateInDomain(c.domain, u, v) === "inside");
    checked++;
    if (owners.length !== 1 || owners[0].stratum !== here.stratum) wrong++;
  }
  return { checked, wrong };
}

test("a vertical slice is a partition of the block face by stratum: areas add up to the face and each interior point lies in the region of its own stratum", () => {
  const { model, block } = build(flat({ fold: "chevron", faultCount: 2, faultStyle: "alternating" }), 30);
  const view = viewGeometry(block, cutOf({ kind: "slice", sliceAzimuth: 0, sliceDip: 90, slicePosition: 0.37 }), LINES);
  const areas = view.caps.reduce((sum, c) => sum + c.domain.area, 0);
  assert.ok(Math.abs(areas - model.depth * model.height) < 1e-9, `${areas} != ${model.depth * model.height}`);
  const { checked, wrong } = sectionAgreement(view, model);
  assert.ok(checked > 250);
  assert.ok(wrong <= checked * 0.01, `${wrong} of ${checked} points are in the wrong region`);
  // The plane sits 37% of the way across the width: the removed side is +x, so the kept volume is 0.37 W D H.
  const volumeKept = meshMeasures(view.mesh).signedVolume;
  assert.ok(Math.abs(volumeKept - 0.37 * model.width * model.depth * model.height) < 1e-7);
});

test("a horizontal slice through domes gives rings: a stratum region with a hole where an older stratum is exposed", () => {
  const { model, block } = build(flat({ fold: "dome", foldAmplitude: 0.16, foldWavelength: 0.9, faultCount: 0, tilt: 0, trend: 0 }), 44);
  const view = viewGeometry(block, cutOf({ kind: "slice", sliceDip: 1, sliceAzimuth: 0, slicePosition: 0.5 }), LINES);
  const holes = view.caps.flatMap((c) => c.domain.regions.filter((r) => r.holes.length > 0));
  assert.ok(holes.length > 0, "no stratum region has a hole");
  const cap = view.caps.find((c) => c.domain.regions.some((r) => r.holes.length > 0))!;
  const region = cap.domain.regions.find((r) => r.holes.length > 0)!, hole = region.holes[0];
  const cx = hole.reduce((a, p) => a + p[0], 0) / hole.length, cy = hole.reduce((a, p) => a + p[1], 0) / hole.length;
  const { frame } = cap;
  const at = (u: number, v: number): [number, number, number] => [frame.origin[0] + u * frame.u[0] + v * frame.v[0], frame.origin[1] + u * frame.u[1] + v * frame.v[1], frame.origin[2] + u * frame.u[2] + v * frame.v[2]];
  // The centre of the hole (a point inside the ring) is another stratum than the ring itself.
  const inner = model.stratumAt(...at(cx, cy)).stratum, ring = model.stratumAt(...at(region.outer[0][0] * 0.999 + cx * 0.001, region.outer[0][1] * 0.999 + cy * 0.001));
  void ring;
  assert.notEqual(inner, cap.stratum, "the centre of a hole belongs to the ring's own stratum");
  const { checked, wrong } = sectionAgreement(view, model, 9);
  assert.ok(wrong <= checked * 0.015, `${wrong} of ${checked}`);
});

test("cut faces tile the cut exactly: kept volume is the box minus the removed box, for every kind of cut, with faults and folds inside", () => {
  const { model, block } = build(flat({ fold: "chevron", faultCount: 3, faultStyle: "mixed", faultDip: 75 }), 26);
  const box = model.width * model.depth * model.height;
  const kept = (cut: Partial<GeologicalCutOptions>) => meshMeasures(viewGeometry(block, cutOf(cut), LINES).mesh).signedVolume;
  // Cut-face regions under SECTION_MIN_AREA (the floor-thickness slivers of eroded strata) are not drawn, so a cut may lose a few of them: under 5e-7 of the block.
  assert.ok(Math.abs(kept({}) - box) < 1e-9);
  assert.ok(Math.abs(kept({ kind: "corner", cutWidth: 0.4, cutDepth: 0.3, cutHeight: 0.55 }) - box * (1 - 0.4 * 0.3 * 0.55)) < 5e-7);
  assert.ok(Math.abs(kept({ kind: "corner", corner: "back-left", cutWidth: 0.25, cutDepth: 0.6, cutHeight: 0.8 }) - box * (1 - 0.25 * 0.6 * 0.8)) < 5e-7);
  // Any plane through the centre halves a box; an exploded block keeps both halves.
  assert.ok(Math.abs(kept({ kind: "slice", sliceAzimuth: 57, sliceDip: 63, slicePosition: 0.5 }) - box / 2) < 5e-7);
  assert.ok(Math.abs(kept({ kind: "exploded", sliceAzimuth: 57, sliceDip: 63, slicePosition: 0.5, gap: 0.3 }) - box) < 5e-7);
  // An oblique cut off the centre: the kept share follows the slice, and the exposed section is planar and inside the box.
  const oblique = viewGeometry(block, cutOf({ kind: "slice", sliceAzimuth: 35, sliceDip: 75, slicePosition: 0.3 }), LINES);
  const sectionArea = oblique.caps.reduce((a, c) => a + c.domain.area, 0);
  assert.ok(sectionArea > 0.1 && sectionArea < Math.hypot(model.width, model.depth, model.height) * Math.hypot(model.depth, model.height));
});

test("triangulation of regions with holes covers them exactly", () => {
  const annulus = triangulatePolygon([[0, 0], [10, 0], [10, 10], [0, 10]], [[[3, 3], [3, 7], [7, 7], [7, 3]]]);
  assert.ok(Math.abs(annulus.reduce((a, t) => a + Math.abs(signedArea(t)), 0) - 84) < 1e-12);
  const next = lcg(17);
  for (let trial = 0; trial < 25; trial++) {
    const k = 8 + Math.floor(next() * 20);
    const star = Array.from({ length: k }, (_, i): [number, number] => { const r = 6 + 3 * next(), a = (2 * Math.PI * i) / k; return [r * Math.cos(a), r * Math.sin(a)]; });
    const hole = Array.from({ length: 6 }, (_, i): [number, number] => { const a = (2 * Math.PI * i) / 6, r = 1 + 1.5 * next(); return [2 + r * Math.cos(a), 0.5 + r * Math.sin(a)]; }).reverse();
    const region = planarDomain({ outer: star, holes: [hole] }).regions[0];
    const triangles = triangulatePolygon(region.outer, region.holes);
    assert.ok(Math.abs(triangles.reduce((a, t) => a + Math.abs(signedArea(t)), 0) - region.area) < 1e-9 * region.area, `trial ${trial}`);
    for (const t of triangles) assert.ok(signedArea(t) > 0, "triangles are counter-clockwise");
  }
});

test("the painted outer surface agrees with the oracle: outcrops on the ground, strata on the walls, bedding lines inside their own stratum", () => {
  const { model, block } = build(base, 34);
  const view = viewGeometry(block, cutOf({ kind: "block" }), { beds: 2, contours: 0 });
  const { positions, triangles } = meshData(view.mesh);
  const next = lcg(23);
  const clear = (x: number, y: number, z: number, stratum: number, margin: number) =>
    [[margin, 0, 0], [-margin, 0, 0], [0, 0, margin], [0, 0, -margin], [0, -margin, 0], [0, margin, 0]].every((d) => model.stratumAt(x + d[0], y + d[1], z + d[2]).stratum === stratum);
  const tally = { ground: [0, 0], wall: [0, 0] };
  for (let i = 0; i < 1500; i++) {
    const t = Math.floor(next() * view.mesh.triangleCount), kind = view.triKind[t];
    if (kind !== 0 && kind !== 1) continue;
    const a = triangles[t * 3] * 3, b = triangles[t * 3 + 1] * 3, c = triangles[t * 3 + 2] * 3;
    // Floor-thin slivers of eroded strata (under 2e-3 tall) are invisible and not what is being checked.
    if (kind === 1 && Math.max(positions[a + 1], positions[b + 1], positions[c + 1]) - Math.min(positions[a + 1], positions[b + 1], positions[c + 1]) < 2e-3) continue;
    const cx = (positions[a] + positions[b] + positions[c]) / 3, cy = (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3, cz = (positions[a + 2] + positions[b + 2] + positions[c + 2]) / 3;
    // Step a hair inside the block: below the ground, or inward from a wall.
    const inward: [number, number, number] = kind === 0 ? [0, -1e-4, 0] : [Math.abs(cx) > model.width / 2 - 1e-6 ? -Math.sign(cx) * 1e-4 : 0, 0, Math.abs(cz) > model.depth / 2 - 1e-6 ? -Math.sign(cz) * 1e-4 : 0];
    const p: [number, number, number] = [cx + inward[0], cy + inward[1], cz + inward[2]];
    const here = model.stratumAt(...p).stratum;
    if (!clear(p[0], p[1], p[2], here, 0.012)) continue;
    const row = kind === 0 ? tally.ground : tally.wall;
    row[0]++;
    if (view.triStratum[t] !== here) row[1]++;
  }
  assert.ok(tally.ground[0] > 300 && tally.wall[0] > 100, JSON.stringify(tally));
  assert.equal(tally.ground[1], 0, `${tally.ground[1]} of ${tally.ground[0]} ground triangles are the wrong stratum`);
  assert.equal(tally.wall[1], 0, `${tally.wall[1]} of ${tally.wall[0]} wall triangles are the wrong stratum`);
  // Bedding lines on a cut face sit inside the stratum they are drawn for.
  const sliced = viewGeometry(block, cutOf({ kind: "slice", sliceAzimuth: 90, sliceDip: 90, slicePosition: 0.5 }), { beds: 2, contours: 0 });
  let on = 0, right = 0;
  for (const curve of sliced.curves) if (curve.kind === "bed" && curve.id.startsWith("bed:slice")) for (let k = 0; k + 1 < curve.points.length; k++) {
    const m = [0, 1, 2].map((d) => (curve.points[k][d] + curve.points[k + 1][d]) / 2) as [number, number, number];
    if (Math.hypot(...[0, 1, 2].map((d) => curve.points[k][d] - curve.points[k + 1][d])) < 1e-9) continue;
    on++;
    if (model.stratumAt(...m).stratum === curve.tone) right++;
  }
  assert.ok(on > 100 && right >= on * 0.97, `${right} of ${on} bedding segments are in their stratum`);
});

// ---- Separation of stages, seeds and limits ---------------------------------------------------

const input = (params: Record<string, number | string | boolean> = {}, seed = 42, palette?: number[]): InstrumentInput => {
  const item = createInstrument(ID);
  return { ...item, seed, params: { ...item.params, ...params }, ...(palette ? { palette } : {}) };
};
const products = (params: Record<string, number | string | boolean> = {}, seed = 42, palette?: number[]) => geologicalProducts(geologicalCutawaysComposition(input(params, seed, palette)));

test("camera, palette and material edits reuse the block and the section geometry; a cut edit reuses the strata; only structure rebuilds", () => {
  const reference = products({ resolution: 20 });
  const moved = products({ resolution: 20, yaw: -70, pitch: 45, projection: "perspective", distance: 2, size: 300, centerX: 200 });
  const painted = products({ resolution: 20, fill: "flat", colorBy: "ramp", shade: 0.9, outlineWeight: 3, lineColor: "stratum", hidden: "dashed" }, 42, [0x102030, 0xff0000, 0x00ff00, 0x0000ff]);
  assert.equal(moved.block, reference.block);
  assert.equal(moved.view, reference.view);
  assert.equal(painted.block, reference.block);
  assert.equal(painted.view, reference.view);
  const recut = products({ resolution: 20, cut: "slice", sliceAzimuth: 80, slicePosition: 0.6 });
  assert.equal(recut.block, reference.block);
  assert.notEqual(recut.view, reference.view);
  assert.equal(recut.block.grids[0].sheets[3].y, reference.block.grids[0].sheets[3].y, "a section edit re-solved the strata");
  const restructured = products({ resolution: 20, foldAmplitude: 0.05 });
  assert.notEqual(restructured.block, reference.block);
  // The camera fits the block the same way whatever the cut, so a cut edit does not move the picture.
  const a = geologicalCamera(geologicalCutawaysComposition(input({ resolution: 20 })), reference.view), b = geologicalCamera(geologicalCutawaysComposition(input({ resolution: 20, cut: "block" })), products({ resolution: 20, cut: "block" }).view);
  assert.equal(a.key, b.key);
});

test("a hidden control never changes the drawing, and the seed changes the drawing exactly when usesSeed says it can", () => {
  const drawing = (params: Record<string, number | string | boolean>, seed = 42) => drawFingerprint(input({ resolution: 16, ...params }, seed));
  // Hidden by 'fold: none', 'faulted: false', 'ground: flat', 'cut: block', orthographic projection, fill none.
  const quiet = { fold: "none", faulted: false, ground: "flat", cut: "block", sequence: "uniform" };
  const reference = drawing(quiet);
  for (const hiddenChange of [{ foldAmplitude: 0.3, foldAxis: 40 }, { faultCount: 4, faultThrow: -0.2, faultDip: 40, faultScatter: 1, faultStyle: "mixed" }, { relief: 0.3, reliefScale: 0.4 },
    { sliceAzimuth: 120, slicePosition: 0.2, cutWidth: 0.7, gap: 0.5 }, { distance: 2 }, { contrast: 6 }])
    assert.equal(drawing({ ...quiet, ...hiddenChange }), reference, JSON.stringify(hiddenChange));
  assert.equal(drawing({ ...quiet, fill: "none" }, 1), drawing({ ...quiet, fill: "none", opacity: 0.3, shade: 0.9 }, 1));
  for (const q of [quiet, { ...quiet, fold: "chevron" }, { ...quiet, faulted: true, faultScatter: 0.5 }, { ...quiet, ground: "eroded" }, { ...quiet, sequence: "random" }, { ...quiet, faulted: true, faultScatter: 0, faultStyle: "stepped" }]) {
    const spec = input({ resolution: 16, ...q });
    const changed = drawing(q, 1) !== drawing(q, 2);
    assert.equal(changed, usesSeed(spec), JSON.stringify(q));
  }
  assert.ok(usesSeed(input({ resolution: 16 })));
});

test("errors name the control to change and nothing is truncated", () => {
  const throwing = (params: Record<string, number | string | boolean>) => () => geologicalProducts(geologicalCutawaysComposition(input(params)));
  assert.throws(throwing({ strata: 16, faultCount: 4, resolution: 72 }), /Grid resolution/);
  assert.throws(throwing({ beds: 6, strata: 16, resolution: 60, faultCount: 2, cut: "slice" }), /Beds|Grid resolution/);
  assert.throws(() => geologicalBlock(strataModel(flat()), 7), /Grid resolution must be a whole number from 8 to 120/);
  assert.throws(() => strataModel(flat({ strata: 1 })), /Strata must be a whole number from 2 to 16/);
  assert.throws(() => viewGeometry(build(flat(), 16).block, cutOf({ kind: "slice", slicePosition: 1 }), LINES), /Slice position must be between 0 and 1/);
  assert.ok(BLOCK_LIMITS.maxVertices > 100_000);
});

// ---- Lines, faults and depth ------------------------------------------------------------------

test("a dip the geology forbids is steepened to the shallowest that works, and every offset then holds for the dip used", () => {
  const gentle = strataModel(flat({ fold: "none", tilt: 0, trend: 0, faultDip: 50, faultCount: 2 }));
  assert.ok(Math.abs(gentle.dip - 50) < 1e-9 && Math.abs(gentle.kappa - 1 / Math.tan(50 * Math.PI / 180)) < 1e-12, "a dip that fits is honoured exactly");
  // Steep folds against a shallow dip: cot(dip) times the steepest slope across the strike is held under 0.92.
  const folded = strataModel(flat({ fold: "sinusoidal", foldAmplitude: 0.4, foldWavelength: 0.3, faultDip: 35, faultCount: 2 }));
  assert.ok(folded.dip > 35 + 5 && folded.dip < 90);
  // Independently: the steepest slope of any horizon across the strike (finite differences on a fine window) times cot(dip) stays under 0.92.
  const [x0, z0] = folded.toWorld(0, 0), [x1, z1] = folded.toWorld(1, 0), eX = x1 - x0, eZ = z1 - z0;
  let steepest = 0;
  for (let w = 1; w < folded.strata; w++) for (let i = 0; i <= 80; i++) for (let j = 0; j <= 40; j++) {
    const x = -0.5 + i / 80, z = -0.4 + 0.8 * j / 40, h = 1e-6;
    steepest = Math.max(steepest, Math.abs(eX * (folded.horizon(w, x + h, z) - folded.horizon(w, x - h, z)) + eZ * (folded.horizon(w, x, z + h) - folded.horizon(w, x, z - h))) / (2 * h));
  }
  assert.ok(Math.abs(folded.kappa) * steepest <= 0.92, `${Math.abs(folded.kappa) * steepest}`);
  assert.ok(Math.abs(folded.kappa) * steepest > 0.6, "steepened only as far as needed");
  // A tall block with four faults in a shallow block across the strike: the traces stay inside the walls.
  const tall = strataModel(flat({ fold: "none", tilt: 0, faultCount: 4, faultDip: 35, depth: 0.4, height: 0.9, faultStrike: "width" }));
  assert.ok(tall.dip > 60);
  for (const f of tall.faults) for (const y of [0, tall.height]) {
    const p = f.position + tall.kappa * (y - tall.height / 2);
    assert.ok(Math.abs(p) < tall.extentP / 2 - 0.04 * tall.extentP * 0.99, `fault ${f.id} leaves the block at height ${y}`);
  }
  // The block still builds and the throw across a fault is exact at the dip used.
  const block = geologicalBlock(folded, 20);
  const fault = folded.faults[0], left = block.grids[0], right = block.grids[1];
  for (let b = 0; b <= left.nq; b += 3) {
    const yl = left.raw[2][b * (left.nz + 1) + left.nz], yr = right.raw[2][b * (right.nz + 1)];
    assert.ok(Math.abs(Math.abs(yr - yl) - Math.abs(fault.throw)) < 1e-9);
  }
});

test("fault traces lie on their planes on the ground, the walls, the base and the cut faces", () => {
  const { model, block } = build(flat({ fold: "sinusoidal", faultCount: 3, faultDip: 65, relief: 0.1 }), 22);
  const view = viewGeometry(block, cutOf({ kind: "slice", sliceAzimuth: 90, sliceDip: 80, slicePosition: 0.6 }), LINES);
  const [x1, z1] = model.toWorld(1, 0), [x0, z0] = model.toWorld(0, 0), eP = [x1 - x0, z1 - z0];
  const distance = (p: readonly number[], j: number) => Math.abs(eP[0] * p[0] + eP[1] * p[2] - model.kappa * (p[1] - model.height / 2) - model.faults[j].position);
  const faults = view.curves.filter((c) => c.kind === "fault");
  assert.ok(faults.length >= 6);
  for (const curve of faults) {
    // A curve belongs to exactly one plane: the one all its points are on.
    const on = model.faults.map((_, j) => curve.points.every((p) => distance(p, j) < 1e-7));
    assert.equal(on.filter(Boolean).length, 1, `curve ${curve.id} lies on ${on.filter(Boolean).length} planes`);
  }
  const wallsAndGround = faults.filter((c) => !c.id.startsWith("fault:slice"));
  assert.ok(wallsAndGround.length >= 3 * 4 / 2);
  // Section faults are on the cut plane as well.
  const cut = faults.filter((c) => c.id.startsWith("fault:slice"));
  assert.ok(cut.length >= 2);
});

test("hidden lines respect occlusion: from the front no line on the back wall is visible, and an oblique perspective view differs from orthographic", () => {
  const recipe = geologicalCutawaysComposition(input({ resolution: 18, cut: "block", yaw: 0, pitch: 12, beds: 1 }));
  const { view, model } = geologicalProducts(recipe);
  const cam = geologicalCamera(recipe, view);
  const result = geologicalHiddenLines(view, cam);
  const back = new Set(view.curves.filter((c) => c.kind === "contact" && c.points.every((p) => Math.abs(p[2] + model.depth / 2) < 1e-9)).map((c) => c.id));
  const front = new Set(view.curves.filter((c) => c.kind === "contact" && c.points.every((p) => Math.abs(p[2] - model.depth / 2) < 1e-9)).map((c) => c.id));
  assert.ok(back.size > 5 && front.size > 5);
  for (const p of result.paths) if (back.has(p.curve)) assert.equal(p.visible, false, `back-wall curve ${p.curve} is visible from the front`);
  assert.ok(result.paths.some((p) => front.has(p.curve) && p.visible));
  const orthographic = geologicalPaintOrder(view, cam);
  const perspective = camera({ ...cam.options, projection: "perspective", distance: cam.options.distance / 3 });
  const p0 = cam.project([0.5, 0.5, 0.3])!, p1 = cam.project([0.5, 0.5, -0.3])!, q0 = perspective.project([0.5, 0.5, 0.3])!, q1 = perspective.project([0.5, 0.5, -0.3])!;
  assert.ok(Math.abs(p0.x - p1.x) < 1e-9, "orthographic: a line along the view axis is a point");
  assert.ok(Math.hypot(q0.x - q1.x, q0.y - q1.y) > 0.01 && q0.depth < q1.depth);
  assert.ok(orthographic.order.length > 100);
});

// ---- Instrument contract ------------------------------------------------------------------

test("controls: groups are proportional only where scaling together is one edit, conditions hide only what does not matter, and the authored default validates", () => {
  const item = createInstrument(ID);
  validateInstrument(item);
  const tree = inspectorItems(ID, item.params);
  const labels = (items: readonly { label: string; items?: unknown }[]) => items.map((i) => i.label);
  assert.ok(labels(tree as never).includes("Strata") && labels(tree as never).includes("View"));
  const shown = (params: Record<string, number | string | boolean>) => new Set(visibleParameters(ID, { ...item.params, ...params }).map((p) => p.key));
  assert.ok(shown({ cut: "slice" }).has("slicePosition") && !shown({ cut: "slice" }).has("cutWidth") && !shown({ cut: "slice" }).has("gap"));
  assert.ok(shown({ cut: "corner" }).has("cutWidth") && !shown({ cut: "corner" }).has("slicePosition"));
  assert.ok(shown({ cut: "exploded" }).has("gap") && shown({ cut: "exploded" }).has("sliceDip"));
  assert.ok(!shown({ faulted: false }).has("faultDip") && !shown({ fold: "none" }).has("foldAmplitude") && !shown({ ground: "flat" }).has("relief"));
  assert.ok(!shown({ fill: "none" }).has("opacity") && shown({ fill: "shaded" }).has("shade") && !shown({ fill: "flat" }).has("shade"));
});

// ---- Slider ends: every combination of slider limits is a picture, never a refusal -----------------

test("every numeric control at its slider minimum and maximum, alone and all together, in every cutaway, validates and draws", async () => {
  const definition = definitions.find((d) => d.id === ID)!;
  const numbers = definition.parameters.filter((p) => p.type === "number");
  assert.ok(numbers.length >= 30);
  const nullSurface = new Proxy({ CLOSE: 1, ROUND: 2 } as Record<string, unknown>, { get: (t, k: string) => (k in t ? t[k] : () => {}) }) as never;
  const attempt = (label: string, params: Record<string, number | string | boolean>) => {
    const spec = input(params);
    try { validateInstrument(spec); drawInstrument(nullSurface, spec); } catch (e) { assert.fail(`${label}: ${(e as Error).message}`); }
  };
  for (const p of numbers) for (const end of ["min", "max"] as const) attempt(`${p.key} at slider ${end}`, { [p.key]: end === "min" ? p.min! : p.max! });
  const all = (end: "min" | "max") => Object.fromEntries(numbers.map((p) => [p.key, end === "min" ? p.min! : p.max!]));
  for (const cut of ["block", "slice", "corner", "exploded"]) for (const end of ["min", "max"] as const)
    for (const extra of [{}, { faultStrike: "width", faultDipDirection: "right", fold: "dome", projection: "perspective", faultStyle: "alternating" }])
      attempt(`all ${end}, cut ${cut}, ${JSON.stringify(extra)}`, { ...all(end), cut, ...extra });
  assert.ok(await prepareInstrument(input(all("max")), () => false));
});
