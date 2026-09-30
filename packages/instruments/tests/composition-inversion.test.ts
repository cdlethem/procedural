import assert from "node:assert/strict";
import test from "node:test";
import {
  apollonianGasket, arcThrough, circleCline, createCompositionRun, drawInversionGardens, circleInversion, circleIntervals, clineDot, clineShape, clineValue, createInstrument, gardenProducts,
  GASKET_LIMITS, inWordDomain, invertCline, invertFrame, invertPoint, inversionGardensComposition, inversionGardensProducts, inversionGardensUsesSeed,
  lineCline, markSites, orbitCircles, orbitImages, orbitOptions, ORBIT_LIMITS, parseWord, segmentIntervals, tangencyPoint, usesSeed, validateInstrument,
  warpPoint, wordConstraints,
  type Cline, type CircleInversion, type GardenOptions, type InstrumentInput, type Point,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";

const near = (actual: number, expected: number, tolerance = 1e-9, message = "") =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${message} ${actual} != ${expected}`);
const random = (seed: number) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 0x100000000; };
const range = (rnd: () => number, low: number, high: number) => low + (high - low) * rnd();

/** Independent: signed distance of a point from an oriented circle's boundary, negative inside the disc. */
const circleSide = (c: { cx: number; cy: number; r: number }, p: Point) => Math.hypot(p[0] - c.cx, p[1] - c.cy) - c.r;

/* ------------------------------------------------------------- inversion algebra */

test("point inversion is an involution with |p-o||p'-o| = r², lies on the same ray, and matches Fold Atlas's spherical map", () => {
  const rnd = random(1);
  for (let i = 0; i < 200; i++) {
    const inv = circleInversion(range(rnd, -50, 50), range(rnd, -50, 50), range(rnd, 5, 200));
    const p: Point = [range(rnd, -300, 300), range(rnd, -300, 300)];
    const q = invertPoint(inv, p[0], p[1])!, back = invertPoint(inv, q[0], q[1])!;
    near(back[0], p[0], 1e-7); near(back[1], p[1], 1e-7);
    near(Math.hypot(p[0] - inv.cx, p[1] - inv.cy) * Math.hypot(q[0] - inv.cx, q[1] - inv.cy), inv.r * inv.r, 1e-6 * inv.r * inv.r);
    const cross = (p[0] - inv.cx) * (q[1] - inv.cy) - (p[1] - inv.cy) * (q[0] - inv.cx);
    const dot = (p[0] - inv.cx) * (q[0] - inv.cx) + (p[1] - inv.cy) * (q[1] - inv.cy);
    assert.ok(Math.abs(cross) < 1e-9 * Math.abs(dot) + 1e-9 && dot > 0, "same ray from the pole");
  }
  // Fold Atlas's `spherical` at amount 1 is u / (k·|u|²) on ((x − cx)/radius): inversion about the centre with r² = radius² / k.
  for (const [radius, k] of [[100, 1], [180, 0.64], [70, 2.5]]) {
    const inv = circleInversion(320, 300, radius / Math.sqrt(k));
    for (const p of [[400, 350], [250, 210], [330, 305]] as Point[]) {
      const warped = warpPoint({ centerX: 320, centerY: 300, radius, bound: 50, iterations: 1, stages: [{ map: "spherical", amount: 1, frequency: k }] }, p[0], p[1])!;
      const mine = invertPoint(inv, p[0], p[1])!;
      near(mine[0], warped[0], 1e-9); near(mine[1], warped[1], 1e-9);
    }
  }
  assert.equal(invertPoint(circleInversion(10, 10, 5), 10, 10), null, "the pole has no image");
});

test("image type rules: a circle through the centre becomes a line, a line missing it becomes a circle through it, a line through it is fixed", () => {
  const unit = circleInversion(0, 0, 1);
  // The circle centred (1, 0) with radius 1 passes through the pole; its antipode (2, 0) maps to (1/2, 0): the line x = 1/2, and the disc becomes the half plane x > 1/2.
  const line = clineShape(invertCline(circleCline(1, 0, 1), unit));
  assert.equal(line.kind, "line");
  if (line.kind === "line") {
    near(Math.abs(line.nx), 1); near(line.ny, 0, 1e-12); near(Math.abs(line.offset), 0.5);
  }
  const image = invertCline(circleCline(1, 0, 1), unit);
  assert.ok(clineValue(image, 1, 0) < 0 && clineValue(image, 0.75, 0.1) < 0, "the disc's interior lands on the x > 1/2 side");
  assert.ok(clineValue(image, 0.25, 0) > 0, "the pole's side is the other side");
  // The line x = 2 (region x < 2) does not pass through the pole: its image is the circle centred (1/4, 0), radius 1/4, through the pole; the pole's side is now inside... region x < 2 contains the pole, so it maps to the exterior of the circle plus the pole.
  const circle = clineShape(invertCline(lineCline(1, 0, 2), unit));
  assert.equal(circle.kind, "circle");
  if (circle.kind === "circle") { near(circle.cx, 0.25); near(circle.cy, 0); near(circle.r, 0.25); assert.equal(circle.disc, false); }
  // A line through the pole is its own image, including which side is which.
  const through = lineCline(1, 1, 0);
  const same = invertCline(through, circleInversion(0, 0, 3));
  near(same.a, 0, 1e-12); near(same.bx, through.bx); near(same.by, through.by); near(same.d, through.d, 1e-12);
  // A circle orthogonal to the inversion circle is fixed as a set: centre (2, 0) radius √3 is orthogonal to the unit circle.
  const fixed = clineShape(invertCline(circleCline(2, 0, Math.sqrt(3)), unit));
  assert.equal(fixed.kind, "circle");
  if (fixed.kind === "circle") { near(fixed.cx, 2); near(fixed.r, Math.sqrt(3)); assert.equal(fixed.disc, true); }
});

test("random clines: the image contains the images of their points, keeps interior on the interior side, and is an involution", () => {
  const rnd = random(2);
  for (let i = 0; i < 200; i++) {
    const inv = circleInversion(range(rnd, -40, 40), range(rnd, -40, 40), range(rnd, 10, 120));
    const c = { cx: range(rnd, -150, 150), cy: range(rnd, -150, 150), r: range(rnd, 5, 120) };
    const cline = circleCline(c.cx, c.cy, c.r);
    const image = invertCline(cline, inv);
    for (let k = 0; k < 12; k++) {
      const theta = range(rnd, 0, 2 * Math.PI);
      const onCircle: Point = [c.cx + c.r * Math.cos(theta), c.cy + c.r * Math.sin(theta)];
      const mapped = invertPoint(inv, onCircle[0], onCircle[1]);
      if (!mapped) continue;
      near(clineValue(image, mapped[0], mapped[1]) / (Math.abs(image.a) * (mapped[0] ** 2 + mapped[1] ** 2) + 1 + Math.abs(image.d)), 0, 1e-8, "boundary maps to boundary");
      const inside: Point = [c.cx + 0.6 * c.r * Math.cos(theta), c.cy + 0.6 * c.r * Math.sin(theta)];
      const insideImage = invertPoint(inv, inside[0], inside[1]);
      if (insideImage) assert.ok(clineValue(image, insideImage[0], insideImage[1]) < 0, "interior maps to the image's interior side");
    }
    const twice = invertCline(image, inv);
    for (const key of ["a", "bx", "by", "d"] as const) near(twice[key], cline[key], 1e-6 * (1 + Math.abs(cline[key])), key);
    near(image.bx ** 2 + image.by ** 2 - image.a * image.d, 1, 1e-8, "normalization");
  }
});

test("tangency and the complex cross ratio survive inversion", () => {
  const rnd = random(3);
  for (let i = 0; i < 100; i++) {
    const inv = circleInversion(range(rnd, -20, 20), range(rnd, -20, 20), range(rnd, 20, 90));
    // Two externally tangent circles away from the pole.
    const a = { cx: range(rnd, 60, 200), cy: range(rnd, -100, 100), r: range(rnd, 10, 40) };
    const angle = range(rnd, 0, 2 * Math.PI), r2 = range(rnd, 8, 50);
    const b = { cx: a.cx + (a.r + r2) * Math.cos(angle), cy: a.cy + (a.r + r2) * Math.sin(angle), r: r2 };
    const ia = clineShape(invertCline(circleCline(a.cx, a.cy, a.r), inv)), ib = clineShape(invertCline(circleCline(b.cx, b.cy, b.r), inv));
    assert.ok(ia.kind === "circle" && ib.kind === "circle");
    if (ia.kind === "circle" && ib.kind === "circle") {
      const d = Math.hypot(ia.cx - ib.cx, ia.cy - ib.cy);
      const tangent = Math.abs(d - (ia.r + ib.r)) < 1e-7 * d || Math.abs(d - Math.abs(ia.r - ib.r)) < 1e-7 * d;
      assert.ok(tangent, "images of tangent circles are tangent (independent distance test)");
    }
    near(Math.abs(clineDot(circleCline(a.cx, a.cy, a.r), circleCline(b.cx, b.cy, b.r))), 1, 1e-9, "tangent circles have <u,v> = ±1");
    // Cross ratio (z1, z2; z3, z4) of four points maps to its complex conjugate: inversion reverses orientation.
    const z = Array.from({ length: 4 }, () => [range(rnd, -200, 200), range(rnd, -200, 200)] as Point);
    const w = z.map((p) => invertPoint(inv, p[0], p[1])!);
    const cr = (p: Point[]) => {
      const sub = (u: Point, v: Point): [number, number] => [u[0] - v[0], u[1] - v[1]];
      const mul = ([a1, b1]: [number, number], [a2, b2]: [number, number]): [number, number] => [a1 * a2 - b1 * b2, a1 * b2 + b1 * a2];
      const div = (u: [number, number], v: [number, number]): [number, number] => { const m = v[0] ** 2 + v[1] ** 2; return [(u[0] * v[0] + u[1] * v[1]) / m, (u[1] * v[0] - u[0] * v[1]) / m]; };
      return div(mul(sub(p[0], p[2]), sub(p[1], p[3])), mul(sub(p[0], p[3]), sub(p[1], p[2])));
    };
    const before = cr(z), after = cr(w);
    near(after[0], before[0], 1e-6 * (1 + Math.abs(before[0])), "real part");
    near(after[1], -before[1], 1e-6 * (1 + Math.abs(before[1])), "imaginary part negates");
  }
});

test("frames: the analytic image frame agrees with the numeric Jacobian, flips the mirror and scales by r²/ρ²", () => {
  const rnd = random(4);
  for (let i = 0; i < 100; i++) {
    const inv = circleInversion(range(rnd, -30, 30), range(rnd, -30, 30), range(rnd, 20, 90));
    const frame = { x: range(rnd, 60, 200), y: range(rnd, -100, 100), angle: range(rnd, -3, 3), scale: rnd() < 0.5 ? -1 : 1 };
    const out = invertFrame(inv, frame)!;
    const rho2 = (frame.x - inv.cx) ** 2 + (frame.y - inv.cy) ** 2;
    near(Math.abs(out.scale), inv.r2 / rho2, 1e-9 * inv.r2 / rho2, "magnification");
    assert.equal(Math.sign(out.scale), -Math.sign(frame.scale), "orientation reverses");
    // A tiny local step u maps through the frame's matrix; its image must equal the map applied to the world point.
    const local = (f: { x: number; y: number; angle: number; scale: number }, ux: number, uy: number): Point => {
      const s = Math.abs(f.scale), m = f.scale < 0 ? -1 : 1;
      const lx = s * ux, ly = s * m * uy;
      return [f.x + Math.cos(f.angle) * lx - Math.sin(f.angle) * ly, f.y + Math.sin(f.angle) * lx + Math.cos(f.angle) * ly];
    };
    for (const [ux, uy] of [[1, 0], [0, 1], [0.7, -0.7]]) {
      const h = 1e-4 / Math.abs(frame.scale);
      const world = local(frame, ux * h, uy * h), mapped = invertPoint(inv, world[0], world[1])!;
      const predicted = local(out, ux * h, uy * h);
      near(mapped[0], predicted[0], 1e-9 * Math.max(1, Math.abs(out.scale)) + 1e-4 * Math.abs(out.scale) * h, "x");
      near(mapped[1], predicted[1], 1e-9 * Math.max(1, Math.abs(out.scale)) + 1e-4 * Math.abs(out.scale) * h, "y");
    }
  }
});

test("a segment's image is the circular arc through its endpoints' images; a segment through the pole stays straight", () => {
  const rnd = random(5);
  for (let i = 0; i < 100; i++) {
    const inv = circleInversion(0, 0, range(rnd, 20, 80));
    const a: Point = [range(rnd, 50, 150), range(rnd, -50, 50)], b: Point = [a[0] + range(rnd, 10, 60), a[1] + range(rnd, -60, 60)];
    const at = (t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const arc = arcThrough(invertPoint(inv, ...a)!, invertPoint(inv, ...at(0.5))!, invertPoint(inv, ...b)!);
    if (arc.kind !== "arc") continue;
    for (let k = 0; k <= 20; k++) {
      const q = invertPoint(inv, ...at(k / 20))!;
      near(Math.hypot(q[0] - arc.cx, q[1] - arc.cy), arc.r, 1e-7 * arc.r, "every image point is on the arc's circle");
    }
  }
  const inv = circleInversion(0, 0, 40);
  const straight = arcThrough(invertPoint(inv, 100, 50)!, invertPoint(inv, 150, 75)!, invertPoint(inv, 200, 100)!);
  assert.equal(straight.kind, "segment", "the line y = x/2 passes through the pole");
});

test("interval cutting agrees with dense sampling of the constraint on segments and circles", () => {
  const rnd = random(6);
  // For a normalized cline |F| is about twice the distance from its boundary, so samples within 0.1 unit of a boundary are skipped.
  const clear = (constraints: { region: Cline }[], p: Point) => constraints.every(({ region }) => Math.abs(clineValue(region, p[0], p[1])) > 0.2);
  let compared = 0;
  for (let i = 0; i < 150; i++) {
    const constraints = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => ({
      region: rnd() < 0.7 ? circleCline(range(rnd, -80, 80), range(rnd, -80, 80), range(rnd, 10, 90), rnd() < 0.7) : lineCline(range(rnd, -1, 1), range(rnd, -1, 1), range(rnd, -50, 50)),
      inside: rnd() < 0.5,
    }));
    const holds = (p: Point) => constraints.every(({ region, inside }) => (clineValue(region, p[0], p[1]) < 0) === inside);
    const seg = { kind: "segment" as const, x0: range(rnd, -100, 100), y0: range(rnd, -100, 100), x1: range(rnd, -100, 100), y1: range(rnd, -100, 100) };
    const cuts = segmentIntervals(seg, constraints);
    for (let k = 0; k <= 400; k++) {
      const t = (k + 0.5) / 401, p: Point = [seg.x0 + (seg.x1 - seg.x0) * t, seg.y0 + (seg.y1 - seg.y0) * t];
      if (!clear(constraints, p)) continue;
      assert.equal(cuts.some(([t0, t1]) => t > t0 && t < t1), holds(p), `segment sample ${t}`);
      compared++;
    }
    const c = { kind: "circle" as const, cx: range(rnd, -60, 60), cy: range(rnd, -60, 60), r: range(rnd, 10, 90) };
    const arcs = circleIntervals(c, constraints);
    for (let k = 0; k < 720; k++) {
      const theta = (k + 0.5) * Math.PI / 360, p: Point = [c.cx + c.r * Math.cos(theta), c.cy + c.r * Math.sin(theta)];
      if (!clear(constraints, p)) continue;
      const kept = arcs.some(([s0, e0]) => (((theta - s0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) < e0 - s0);
      assert.equal(kept, holds(p), `circle sample ${theta}`);
      compared++;
    }
  }
  assert.ok(compared > 50_000);
});

/* ------------------------------------------------------------------- gasket */

const gasketOptions = (over: Record<string, number> = {}) => ({ seed: 1, centerX: 0, centerY: 0, radius: 1, rotation: 0, first: 0.5, second: 1,
  generations: 4, minRadius: 0, retention: 1, maxCircles: 20000, ...over });

test("gasket counts: 3 seed circles, 2 in generation 1, then 2·3^(g−1); total 2 + 3^g", () => {
  const gasket = apollonianGasket(gasketOptions({ generations: 6 }));
  assert.deepEqual(gasket.counts, [3, 2, 6, 18, 54, 162, 486]);
  assert.equal(gasket.circles.length, 2 + 3 ** 6);
  for (let g = 0; g <= 6; g++) assert.equal(gasket.circles.filter((c) => c.generation === g).length, gasket.counts[g]);
  assert.equal(new Set(gasket.circles.map((c) => c.id)).size, gasket.circles.length, "ids are unique");
});

test("classic 1/2/2 gasket has exact integer curvatures and the Descartes relation holds for every gap it fills", () => {
  const gasket = apollonianGasket(gasketOptions({ generations: 5 }));
  for (const c of gasket.circles) near(Math.abs(c.curvature - Math.round(c.curvature)), 0, 1e-9, `${c.id} curvature ${c.curvature}`);
  assert.deepEqual(gasket.circles.slice(0, 5).map((c) => Math.round(c.curvature)), [-1, 2, 2, 3, 3]);
  assert.deepEqual(gasket.circles.filter((c) => c.generation === 2).map((c) => Math.round(c.curvature)).sort((p, q) => p - q), [6, 6, 6, 6, 15, 15]);
  const byId = new Map(gasket.circles.map((c) => [c.id, c]));
  // Each circle from generation 2 on is tangent to its parent and its recorded neighbour, and to one more older circle:
  // together with the circle it replaced, its four curvatures satisfy (Σk)² = 2Σk².
  for (const c of gasket.circles.filter((circle) => circle.generation >= 2)) {
    const parent = byId.get(c.parent!)!, neighbour = byId.get(c.neighbour!)!;
    const touching = gasket.circles.filter((o) => o !== c && o.generation < c.generation &&
      Math.abs(Math.hypot(o.cx - c.cx, o.cy - c.cy) - Math.abs(1 / o.curvature + 1 / c.curvature)) < 1e-9);
    assert.ok(touching.includes(parent) && touching.includes(neighbour));
    assert.equal(touching.length, 3, `${c.id} touches exactly the three circles bounding its gap`);
    const four = [c, ...touching].map((o) => o.curvature);
    // The other solution for the same three touching circles: the circle this one replaced.
    const sum = four.reduce((s, k) => s + k, 0);
    near(sum * sum, 2 * four.reduce((s, k) => s + k * k, 0), 1e-6 * sum * sum + 1e-9, `${c.id} Descartes`);
  }
});

test("gasket circles never overlap, all touch as recorded, and the packing fills the bounding disc", () => {
  const gasket = apollonianGasket(gasketOptions({ generations: 7, first: 0.35, second: 0.7 }));
  const bound = gasket.circles[0], inside = gasket.circles.slice(1);
  near(bound.r, 1, 1e-12);
  for (const c of inside) assert.ok(Math.hypot(c.cx, c.cy) + c.r <= bound.r + 1e-9, `${c.id} is inside the bound`);
  const sample = inside.filter((c, i) => i % 7 === 0);
  for (const c of sample) for (const o of inside) if (o !== c) assert.ok(Math.hypot(c.cx - o.cx, c.cy - o.cy) >= c.r + o.r - 1e-9, `${c.id} overlaps ${o.id}`);
  const area = (generations: number) => apollonianGasket(gasketOptions({ generations, first: 0.35, second: 0.7 })).circles.slice(1).reduce((s, c) => s + c.r * c.r, 0);
  const covered = [3, 5, 7, 9].map(area);
  assert.ok(covered.every((a, i) => i === 0 || a > covered[i - 1]) && covered[3] < 1 && covered[3] > 0.93, `covered ${covered}`);
});

test("each Descartes step equals inversion in the circle through the other three tangency points", () => {
  const gasket = apollonianGasket(gasketOptions({ generations: 3, first: 0.35, second: 0.7 }));
  let checked = 0;
  for (const c of gasket.circles.filter((circle) => circle.generation >= 2)) {
    // The three older circles that bound c's gap.
    const three = gasket.circles.filter((o) => o !== c && o.generation < c.generation &&
      Math.abs(Math.hypot(o.cx - c.cx, o.cy - c.cy) - Math.abs(1 / o.curvature + 1 / c.curvature)) < 1e-9);
    assert.equal(three.length, 3);
    // The dual circle passes through their three tangency points (computed here from the circumcircle formula, independently of the producer).
    const points = [[0, 1], [1, 2], [0, 2]].map(([i, j]) => tangencyPoint(three[i].curvature, three[i].cx, three[i].cy, three[j].curvature, three[j].cx, three[j].cy));
    const bx = points[1][0] - points[0][0], by = points[1][1] - points[0][1], cx = points[2][0] - points[0][0], cy = points[2][1] - points[0][1];
    const d = 2 * (bx * cy - by * cx);
    if (Math.abs(d) < 1e-9) continue;
    const ux = (cy * (bx * bx + by * by) - by * (cx * cx + cy * cy)) / d, uy = (bx * (cx * cx + cy * cy) - cx * (bx * bx + by * by)) / d;
    const dual = circleInversion(points[0][0] + ux, points[0][1] + uy, Math.hypot(ux, uy));
    // Reflection in the dual fixes each of the three circles (they are orthogonal to it) …
    for (const t of three) {
      const image = clineShape(invertCline(circleCline(t.cx, t.cy, t.r, t.curvature > 0), dual));
      assert.equal(image.kind, "circle");
      if (image.kind === "circle") { near(image.cx, t.cx, 1e-7); near(image.cy, t.cy, 1e-7); near(image.r, t.r, 1e-7); assert.equal(image.disc, t.curvature > 0); }
    }
    // … and swaps c with the other circle touching all three: curvature 2Σk − k_c by Descartes.
    const partner = clineShape(invertCline(circleCline(c.cx, c.cy, c.r), dual));
    assert.equal(partner.kind, "circle");
    if (partner.kind === "circle") near(1 / partner.r, Math.abs(2 * three.reduce((s, t) => s + t.curvature, 0) - c.curvature), 1e-6 / partner.r, `${c.id} partner curvature`);
    checked++;
  }
  assert.ok(checked > 20);
});

test("gasket cutoffs: minimum radius stops at radius, retention is stable per address and never renames, limits name the controls", () => {
  const full = apollonianGasket(gasketOptions({ generations: 6, minRadius: 0.02 }));
  assert.ok(full.circles.every((c) => c.generation < 2 || c.r >= 0.02));
  assert.ok(full.circles.length < 2 + 3 ** 6);
  const short = apollonianGasket(gasketOptions({ generations: 4, retention: 0.7, seed: 9 })), long = apollonianGasket(gasketOptions({ generations: 6, retention: 0.7, seed: 9 }));
  const longIds = new Set(long.circles.map((c) => c.id));
  for (const c of short.circles) assert.ok(longIds.has(c.id), `${c.id} survives deeper generations`);
  const other = apollonianGasket(gasketOptions({ generations: 6, retention: 0.7, seed: 10 }));
  assert.notDeepEqual(other.circles.map((c) => c.id), long.circles.map((c) => c.id), "seed changes which gaps stay open");
  assert.throws(() => apollonianGasket(gasketOptions({ generations: 9, maxCircles: 500 })), /Generations.*Minimum radius/);
});

/* -------------------------------------------------------------------- orbit */

const baseGarden = (over: Partial<GardenOptions> = {}, group: Partial<GardenOptions["group"]> = {}, source: Partial<GardenOptions["group"]["source"]> = {}): GardenOptions => ({
  seed: 7, construction: "orbit", centerX: 320, centerY: 320, radius: 270, rotation: 0, clipShare: 1, generations: 3, minRadius: 0.5, retention: 1, tolerance: 0.2,
  gasket: { first: 0.5, second: 1 },
  group: { circles: 3, arrangement: "orthogonal", ringRadius: 0.8, circleRadius: 0.45, spread: 1, twist: 0, jitter: 0, rule: "tree", word: "ABC", exclusion: 0.1,
    source: { kind: "glyph", density: 4, glyph: "k", size: 0.22, x: 0, y: 0, turn: 0, ...source }, ...group },
  ...over,
});

test("every reduced word is an image: n(n−1)^(g−1) words of length g, ids in order, no letter beside itself", () => {
  for (const n of [3, 4, 5]) {
    const orbit = orbitImages({ ...orbitOptions(baseGarden({ generations: 4, minRadius: 0 }, { circles: n, spread: 0.6 })) });
    assert.deepEqual(orbit.counts, [1, n, n * (n - 1), n * (n - 1) ** 2, n * (n - 1) ** 3], `${n} circles`);
    for (const image of orbit.images) {
      assert.equal(image.generation, image.word.length);
      for (let i = 1; i < image.word.length; i++) assert.notEqual(image.word[i], image.word[i - 1]);
      assert.equal(image.parity, image.generation % 2);
    }
    assert.equal(new Set(orbit.images.map((i) => i.id)).size, orbit.images.length);
  }
});

test("the word rule applies letters in order, cycling: AB and BA give different, analytically composed images", () => {
  const options = (word: string) => orbitOptions(baseGarden({ generations: 4, minRadius: 0 }, { circles: 3, arrangement: "ring", ringRadius: 0.7, circleRadius: 0.5, rule: "word", word, exclusion: 0.05 },
    { kind: "rings", size: 0.16, x: 0.05, y: 0.02 }));
  const ab = orbitImages(options("AB")), ba = orbitImages(options("BA"));
  assert.deepEqual(ab.images.map((i) => i.word), ["", "A", "AB", "ABA", "ABAB"]);
  assert.deepEqual(ba.images.map((i) => i.word), ["", "B", "BA", "BAB", "BABA"]);
  // Independent composition: the first source site's position after A then B is B(A(p)).
  const circles = orbitCircles(options("AB"));
  const first = ab.sites.find((s) => s.image === "w:AB" && s.id.endsWith("/site:0"))!;
  const source = ab.source.sites.find((s) => s.id === "site:0")!;
  const stepA = invertPoint(circles[0].inversion, source.x, source.y)!, stepB = invertPoint(circles[1].inversion, stepA[0], stepA[1])!;
  near(first.position[0], stepB[0], 1e-9); near(first.position[1], stepB[1], 1e-9);
  const reversed = ba.sites.find((s) => s.image === "w:BA" && s.id.endsWith("/site:0"))!;
  assert.ok(Math.hypot(reversed.position[0] - first.position[0], reversed.position[1] - first.position[1]) > 1, "order moves the image");
  assert.throws(() => parseWord("AA", 3), /next to itself/);
  assert.throws(() => parseWord("ABA", 3), /next to itself/, "the wrap from the last letter back to the first also cancels");
  assert.throws(() => parseWord("ABD", 3), /not an inversion circle/);
  assert.throws(() => parseWord("A", 3), /two to/);
});

const area = (points: readonly Point[]) => points.reduce((s, p, i) => { const q = points[(i + 1) % points.length]; return s + (p[0] * q[1] - q[0] * p[1]) / 2; }, 0);

test("images keep exact orientation: closed outlines flip winding with every inversion; sites flip their mirror flag", () => {
  const orbit = orbitImages(orbitOptions(baseGarden({ generations: 3, minRadius: 0 }, { circles: 3, spread: 0.9 }, { glyph: "k", size: 0.2 })));
  const source = orbit.paths.find((p) => p.image === "src" && p.closed)!;
  const sign = Math.sign(area(source.points));
  let closedSeen = 0;
  for (const path of orbit.paths.filter((p) => p.closed)) {
    assert.equal(Math.sign(area(path.points)), sign * (path.generation % 2 ? -1 : 1), `${path.id}`);
    closedSeen++;
  }
  assert.ok(closedSeen > 10);
  for (const site of orbit.sites) assert.equal(Math.sign(site.scale), site.generation % 2 ? -1 : 1, site.id);
});

test("every vertex of an image maps back onto the source outline; no vertex leaves the clip disc", () => {
  const options = orbitOptions(baseGarden({ generations: 2, minRadius: 0, tolerance: 0.1 }, { circles: 3, spread: 0.8 }, { glyph: "R", size: 0.2 }));
  const orbit = orbitImages(options);
  const source = orbit.source.chains[0].points;
  const distanceToOutline = (p: Point) => {
    let best = Infinity;
    for (const chain of orbit.source.chains) for (let i = 0; i < chain.points.length; i++) {
      const a = chain.points[i], b = chain.points[(i + 1) % chain.points.length];
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)));
      best = Math.min(best, Math.hypot(p[0] - a[0] - t * (b[0] - a[0]), p[1] - a[1] - t * (b[1] - a[1])));
    }
    return best;
  };
  void source;
  const circles = orbitCircles(options);
  let checked = 0;
  for (const path of orbit.paths) {
    const image = orbit.images.find((i) => i.id === path.image)!;
    if (image.generation === 0) continue;
    const letters = [...image.word].map((l) => "ABCDEFGH".indexOf(l));
    for (const point of path.points) {
      assert.ok(Math.hypot(point[0] - options.centerX, point[1] - options.centerY) <= orbit.clip.r + 1e-6, "inside the clip disc");
      let back: Point | null = point;
      for (let i = letters.length - 1; i >= 0 && back; i--) back = invertPoint(circles[letters[i]].inversion, back[0], back[1]);
      assert.ok(back, "no vertex is a pole image");
      assert.ok(distanceToOutline(back!) < 1e-6 * 270, `${path.id} vertex maps back ${distanceToOutline(back!)} from the outline`);
      checked++;
    }
  }
  assert.ok(checked > 500);
});

test("pole clearance: nothing within the clearance of a pole survives, images stay in the clip disc, and the domain matches its analytic form", () => {
  // A ring circle centred on the source: its pole sits inside the glyph. The clip disc is large (4 × the frame), so the
  // clearance (r × 0.15) rather than the clip (r² / clip radius) decides how close a source point may come.
  const options = orbitOptions(baseGarden({ generations: 1, minRadius: 0, clipShare: 4 }, { circles: 2, arrangement: "ring", ringRadius: 0, circleRadius: 0.4, exclusion: 0.15 }, { glyph: "R", size: 0.5 }));
  const circles = orbitCircles(options), orbit = orbitImages(options);
  const pole = circles[0];
  assert.ok(orbit.paths.some((p) => p.generation === 1));
  assert.ok(pole.r * pole.r / orbit.clip.r < pole.clearance, "test geometry: the clearance is the binding limit");
  let nearest = Infinity;
  for (const path of orbit.paths.filter((p) => p.image === "w:A")) for (const q of path.points) {
    assert.ok(Math.hypot(q[0] - orbit.clip.cx, q[1] - orbit.clip.cy) <= orbit.clip.r + 1e-6, "inside the clip disc");
    const p = invertPoint(pole.inversion, q[0], q[1])!;
    nearest = Math.min(nearest, Math.hypot(p[0] - pole.cx, p[1] - pole.cy));
    assert.ok(Math.hypot(p[0] - pole.cx, p[1] - pole.cy) >= pole.clearance - 1e-6, "its source point was at least the clearance from the pole");
  }
  near(nearest, pole.clearance, 1e-6, "the cut lands exactly on the clearance circle");
  // Domain along a ray from the pole (the pole is the clip centre): valid iff d ≥ clearance and the image r²/d lies within the clip radius.
  const constraints = wordConstraints(circles, [0], orbit.clip);
  for (let k = 1; k <= 60; k++) {
    const d = k * 0.05 * pole.r, expected = d >= pole.clearance && pole.r * pole.r / d <= orbit.clip.r;
    if (Math.abs(d - pole.clearance) < 1e-6 || Math.abs(pole.r * pole.r / d - orbit.clip.r) < 1e-6) continue;
    assert.equal(inWordDomain(constraints, pole.cx + d, pole.cy), expected, `distance ${d}`);
  }
});

test("images that leave the clip disc are cut exactly at its rim: no vertex is outside and open ends sit on the rim", () => {
  // Circles covering the source enlarge it far past the frame; only the clip constraint keeps the result finite.
  const options = orbitOptions(baseGarden({ generations: 2, minRadius: 0, clipShare: 0.8 }, { circles: 3, arrangement: "ring", ringRadius: 0.3, circleRadius: 0.5, exclusion: 0.08 },
    { kind: "net", density: 3, size: 0.4 }));
  const orbit = orbitImages(options);
  let ends = 0;
  for (const path of orbit.paths) {
    for (const [x, y] of path.points) assert.ok(Math.hypot(x - orbit.clip.cx, y - orbit.clip.cy) <= orbit.clip.r + 1e-6, `${path.id} inside the clip disc`);
    if (!path.closed && path.generation > 0) for (const p of [path.points[0], path.points[path.points.length - 1]]) {
      const d = Math.hypot(p[0] - orbit.clip.cx, p[1] - orbit.clip.cy);
      if (d > orbit.clip.r - 1e-6) ends++;
    }
  }
  assert.ok(ends > 20, `only ${ends} arc ends reached the rim`);
});

test("the tree cutoff loses nothing large for disjoint circles: every omitted image fits inside a disc of the minimum radius", () => {
  const cutoff = orbitImages(orbitOptions(baseGarden({ generations: 6, minRadius: 3 }, { circles: 4, spread: 0.7 })));
  const exhaustive = orbitImages(orbitOptions(baseGarden({ generations: 6, minRadius: 0 }, { circles: 4, spread: 0.7 })));
  assert.ok(cutoff.images.length < exhaustive.images.length);
  // Everything the exhaustive orbit drew that the cutoff omitted lies in a disc of radius under minRadius (3), so it spans at most 6 units.
  const kept = new Set(cutoff.images.map((i) => i.id));
  for (const path of exhaustive.paths.filter((p) => !kept.has(p.image))) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of path.points) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    assert.ok(Math.max(maxX - minX, maxY - minY) <= 2 * 3 + 1e-6, `${path.id} spans ${Math.max(maxX - minX, maxY - minY)}`);
  }
});

test("orbit work limits throw naming the controls to change", () => {
  const big = orbitOptions(baseGarden({ generations: 9, minRadius: 0 }, { circles: 8, spread: 0.5 }, { glyph: "R" }));
  assert.throws(() => orbitImages(big), /Generations|Circles|Source density/);
  assert.throws(() => orbitImages(orbitOptions(baseGarden({ generations: 8, minRadius: 0 }, { circles: 8, spread: 0.5 }, { kind: "rings", density: 2 }))), /Generations.*Circles/);
  assert.throws(() => orbitImages(orbitOptions(baseGarden({}, { circles: 2, arrangement: "orthogonal" }))), /at least 3 Circles/);
  assert.ok(ORBIT_LIMITS.maxImages >= 1000 && GASKET_LIMITS.maxCircles >= 1000);
});

/* ---------------------------------------------------------------- instrument */

const layer = (over: Record<string, number | string | boolean> = {}, seed = 42): InstrumentInput => {
  const input = createInstrument("inversion-gardens");
  input.seed = seed;
  Object.assign(input.params, over);
  return validateInstrument(input);
};

test("the garden is frozen and shared: appearance edits reuse it and move nothing, structural edits build another", () => {
  const base = inversionGardensProducts(inversionGardensComposition(layer()));
  assert.ok(Object.isFrozen(base) && Object.isFrozen(base.paths) && Object.isFrozen(base.paths[0]) && Object.isFrozen(base.paths[0].points));
  const restyled = inversionGardensProducts(inversionGardensComposition(layer({ colorBy: "parity", stroke: "beads", weight: 3, fill: "rings", marks: "arrow", guides: false, original: "faint", spacing: 5 })));
  assert.equal(restyled, base, "same cached value");
  const deeper = inversionGardensProducts(inversionGardensComposition(layer({ generations: 6 })));
  assert.notEqual(deeper, base);
  const ids = new Set(deeper.paths.map((p) => p.id));
  for (const path of base.paths) assert.ok(ids.has(path.id), `${path.id} survives a deeper garden`);
  const gasketBase = inversionGardensProducts(inversionGardensComposition(layer({ construction: "gasket" })));
  const hiddenOrbit = inversionGardensProducts(inversionGardensComposition(layer({ construction: "gasket", circles: 6, jitter: 0.3, source: "net", exclusion: 0.3 })));
  assert.deepEqual(hiddenOrbit.paths.map((p) => p.id), gasketBase.paths.map((p) => p.id));
  assert.equal(JSON.stringify(hiddenOrbit.paths), JSON.stringify(gasketBase.paths), "orbit controls are inert for a gasket");
});

test("seeds change structure only where chance belongs: retention and circle jitter", () => {
  const print = (over: Record<string, number | string | boolean>, seed: number) => drawFingerprint(layer(over, seed));
  for (const over of [{}, { construction: "gasket" }, { rule: "word", circles: 3, arrangement: "ring", ringRadius: 0.7, circleRadius: 0.5 }]) {
    assert.equal(usesSeed(layer(over)), false);
    assert.equal(print(over, 1), print(over, 2), JSON.stringify(over));
  }
  for (const over of [{ retention: 0.6 }, { construction: "gasket", retention: 0.6 }, { jitter: 0.3 }, { jitter: 0.3, circles: 4, arrangement: "ring", ringRadius: 0.7, circleRadius: 0.4 }]) {
    assert.equal(usesSeed(layer(over)), true, JSON.stringify(over));
    assert.notEqual(print(over, 1), print(over, 2), JSON.stringify(over));
  }
  assert.equal(inversionGardensUsesSeed({ retention: 1, construction: "gasket", jitter: 0.4 }), false, "a hidden jitter is not chance");
});

test("hidden controls are inert: rule tree ignores the word, ring ignores spread, orthogonal ignores ring size, glyph source ignores density", () => {
  const fp = (over: Record<string, number | string | boolean>) => drawFingerprint(layer(over));
  assert.equal(fp({ rule: "tree", word: "AB" }), fp({ rule: "tree", word: "not even valid!" }));
  assert.equal(fp({ arrangement: "orthogonal", ringRadius: 0.3, circleRadius: 0.9 }), fp({ arrangement: "orthogonal", ringRadius: 1.2 }));
  assert.equal(fp({ arrangement: "ring", spread: 0.4 }), fp({ arrangement: "ring", spread: 0.95 }));
  assert.equal(fp({ source: "glyph", density: 2 }), fp({ source: "glyph", density: 7 }));
  assert.equal(fp({ source: "rings", glyph: "R" }), fp({ source: "rings", glyph: "G" }));
  assert.equal(fp({ construction: "gasket", generations: 4, word: "AC" }), fp({ construction: "gasket", generations: 4, word: "BA" }));
  assert.notEqual(fp({ rule: "word", word: "AB" }), fp({ rule: "word", word: "BA", circles: 3 }), "the word decides the drawing when it is visible");
});

test("marks are oriented sites: size follows the map and mirrored frames flip", () => {
  const recipe = inversionGardensComposition(layer({ marks: "arrow", markSize: 0.9, original: "full" }));
  const garden = inversionGardensProducts(recipe), sites = markSites(recipe, garden);
  assert.ok(sites.length > 20);
  for (const site of sites) {
    const source = garden.sites.find((s) => s.id === site.id)!;
    assert.equal(Math.sign(site.scale), Math.sign(source.scale));
    near(Math.abs(site.scale) * 16, 0.9 * source.size, 1e-9);
  }
  const hidden = markSites(inversionGardensComposition(layer({ marks: "arrow", original: "none" })), garden);
  assert.ok(hidden.every((s) => !s.id.startsWith("src/")));
  assert.ok(hidden.length < sites.length);
});

test("gasket sites sit at circle centres, size two radii, and alternate mirrors by generation", () => {
  const recipe = inversionGardensComposition(layer({ construction: "gasket", marks: "dot", generations: 3, minRadius: 0.5 }));
  const garden = inversionGardensProducts(recipe);
  const gasket = apollonianGasket({ seed: 42, centerX: 320, centerY: 320, radius: 270, rotation: 0, first: 0.5, second: 1, generations: 3, minRadius: 0.5, retention: 1, maxCircles: 20000 });
  for (const site of garden.sites) {
    const c = gasket.circles.find((circle) => circle.id === site.id)!;
    near(site.position[0], c.cx, 1e-9); near(site.position[1], c.cy, 1e-9); near(site.size, 2 * c.r, 1e-9);
    assert.equal(Math.sign(site.scale), c.generation % 2 ? -1 : 1);
    near(Math.hypot(Math.cos(site.angle) - Math.cos(c.anchor!), Math.sin(site.angle) - Math.sin(c.anchor!)), 0, 1e-12);
  }
  assert.equal(garden.sites.length, gasket.circles.filter((c) => c.curvature > 0).length, "the bounding circle carries no mark");
  // The anchor points at the tangency with the recorded neighbour: that point lies on both circles.
  const byId = new Map(gasket.circles.map((c) => [c.id, c]));
  for (const c of gasket.circles.filter((circle) => circle.neighbour && circle.curvature > 0)) {
    const n = byId.get(c.neighbour!)!, tip: Point = [c.cx + c.r * Math.cos(c.anchor!), c.cy + c.r * Math.sin(c.anchor!)];
    near(Math.abs(Math.hypot(tip[0] - n.cx, tip[1] - n.cy) - n.r), 0, 1e-8, `${c.id} anchor touches ${n.id}`);
  }
});

test("a clip disc smaller than the frame cuts gasket circles exactly at its rim and drops circles outside it", () => {
  const options: GardenOptions = { ...baseGarden({ construction: "gasket", generations: 5, clipShare: 0.5, minRadius: 1 }) };
  const garden = gardenProducts(options);
  const rim = 0.5 * 270;
  for (const path of garden.paths) for (const [x, y] of path.points) assert.ok(Math.hypot(x - 320, y - 320) <= rim + 1e-6);
  assert.ok(garden.paths.some((p) => !p.closed), "circles crossing the rim become open arcs");
  const openEnds = garden.paths.filter((p) => !p.closed).flatMap((p) => [p.points[0], p.points[p.points.length - 1]]);
  for (const [x, y] of openEnds) near(Math.hypot(x - 320, y - 320), rim, 1e-6, "arc ends on the rim");
});

test("a mark is never cut: every kept mark's diameter circle lies inside the clip disc", () => {
  for (const over of [{ construction: "gasket", clipShare: 0.7, marks: "arrow", markSize: 0.9, generations: 6 }, { clipShare: 0.9, marks: "rosette", markSize: 1.2, source: "wallpaper", generations: 4 }]) {
    const recipe = inversionGardensComposition(layer({ minRadius: 1, ...over }));
    const garden = inversionGardensProducts(recipe), sites = markSites(recipe, garden);
    assert.ok(sites.length > 5 && sites.length < garden.sites.length, "some marks are dropped, some kept");
    const clip = garden.clip, byId = new Map(garden.sites.map((site) => [site.id, site]));
    for (const site of sites) {
      const diameter = Math.abs(site.scale) * 16;
      assert.ok(Math.hypot(site.position[0] - clip.cx, site.position[1] - clip.cy) + diameter / 2 <= clip.r + 1e-9, site.id);
      near(diameter, recipe.marks.size * byId.get(site.id)!.size, 1e-9);
    }
  }
});

test("drawing over the work budget names the controls; cancellation passes through unchanged", () => {
  const surface = new Proxy({ CLOSE: 1, ROUND: 2 } as Record<string, unknown>, { get: (target, key: string) => key in target ? target[key] : () => {} }) as never;
  const recipe = inversionGardensComposition(layer({ stroke: "beads", spacing: 3 }));
  assert.throws(() => drawInversionGardens(surface, recipe, {}, createCompositionRun({ maxWork: 50 })), /Station spacing.*Generations/);
  assert.throws(() => drawInversionGardens(surface, recipe, {}, createCompositionRun({ cancelled: () => true })), /cancelled/);
  drawInversionGardens(surface, inversionGardensComposition(layer({ stroke: "ink" })));
});
