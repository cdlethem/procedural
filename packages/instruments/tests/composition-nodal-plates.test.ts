import assert from "node:assert/strict";
import test from "node:test";
import {
  besselJ, besselJPrime, besselZero, circleMode, createInstrument, nodalBands, nodalDistance, nodalField, nodalPaths, nodalPlateComposition,
  nodalProximity, nodalSites, rectangleMode, validateInstrument, NODAL_LIMITS,
  type NodalFieldOptions, type NodalMode, type Path,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.js";

const near = (actual: number, expected: number, tolerance: number, note = "") =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);
const mode = (n: number, m: number, weight = 1, phase = 0, orient = 0): NodalMode => ({ n, m, weight, phase, orient });
const plate = (over: Partial<NodalFieldOptions> = {}): NodalFieldOptions => ({
  shape: "rectangle", edge: "free", centerX: 320, centerY: 320, width: 400, height: 300, rotation: 0,
  modes: [mode(3, 0)], time: 0, resolution: 200, ...over,
});
const inputWith = (params: Record<string, number | string | boolean> = {}, seed = 42) => {
  const input = createInstrument("nodal-plates");
  input.seed = seed;
  Object.assign(input.params, params);
  return input;
};

// Reference values from an independent 80-digit power-series evaluation (Decimal), not from the code under test.
test("Bessel J and J′ match independent high-precision values, including negative arguments", () => {
  const table: [number, number, number, number][] = [
    [0, 1, 0.76519768655796661, -0.4400505857449335], [1, 1, 0.4400505857449335, 0.32514710081303305],
    [3, 10, 0.058379379305186815, 0.23711649989356459], [7, 25, -0.010168168212703074, -0.15585325375695577],
    [12, 40, -0.12697799611784807, 0.024284974588832397], [0, 60.5, -0.10255272478099084, 0.0031323643677641962],
    [16, 55, 0.10998464927012684, -0.0018616074406069549], [2, 0.5, 0.030604023458682642, 0.11985236384014332],
  ];
  for (const [n, x, value, slope] of table) {
    near(besselJ(n, x), value, 1e-13, `J${n}(${x})`);
    near(besselJPrime(n, x), slope, 1e-13, `J${n}'(${x})`);
    near(besselJ(n, -x), n % 2 ? -value : value, 1e-13, `J${n}(-${x})`);
  }
});

test("Bessel zeros of J and J′ match independent values and are ordered", () => {
  const zeros: [number, number, boolean, number][] = [
    [0, 1, false, 2.40482555769577], [0, 2, false, 5.52007811028631], [0, 3, false, 8.65372791291101],
    [1, 1, false, 3.83170597020751], [1, 2, false, 7.01558666981562], [5, 3, false, 15.7001740797117], [12, 1, false, 16.6982499338482],
    [1, 1, true, 1.84118378134066], [1, 2, true, 5.33144277352503], [2, 1, true, 3.05423692822714],
    [0, 1, true, 3.83170597020751], [0, 2, true, 7.01558666981562], [9, 3, true, 19.0045935379461],
  ];
  for (const [n, k, derivative, expected] of zeros) near(besselZero(n, k, derivative), expected, 2e-13, `zero ${k} of J${derivative ? "'" : ""}_${n}`);
});

test("edge conditions hold: fixed modes vanish on the edge, free modes have zero normal slope, peak is 1", () => {
  const R = 100, e = 1e-4;
  for (const [n, m] of [[0, 0], [2, 1], [5, 2], [0, 3]] as const) {
    const fixed = circleMode("fixed", n, m, R, 0.3), free = circleMode("free", n, m, R, 0.3);
    for (const angle of [0.1, 1.3, 2.9]) {
      near(fixed.at(R * Math.cos(angle), R * Math.sin(angle)), 0, 1e-8, `fixed (${n},${m}) at edge`);
      const slope = (free.at((R + e) * Math.cos(angle), (R + e) * Math.sin(angle)) - free.at((R - e) * Math.cos(angle), (R - e) * Math.sin(angle))) / (2 * e);
      near(slope, 0, 1e-6, `free (${n},${m}) normal slope`);
    }
    let peak = 0;
    for (let i = 0; i < 4000; i++) for (const angle of n ? [0.3 / n, 0.3] : [0]) peak = Math.max(peak, Math.abs(fixed.at(R * i / 4000 * Math.cos(angle), R * i / 4000 * Math.sin(angle))));
    near(peak, 1, 1e-3, `fixed (${n},${m}) peak`);
  }
  // A rectangle: fixed sin modes vanish on all four edges; free cosines have zero normal derivative.
  const fixed = rectangleMode("fixed", 2, 1, 400, 300), free = rectangleMode("free", 2, 1, 400, 300);
  for (const t of [-1, -0.3, 0.6, 1]) {
    near(fixed.at(-200, 150 * t), 0, 1e-12); near(fixed.at(200, 150 * t), 0, 1e-12);
    near(fixed.at(200 * t, -150), 0, 1e-12); near(fixed.at(200 * t, 150), 0, 1e-12);
  }
  near((free.at(-200 + e, 40) - free.at(-200 - e, 40)) / (2 * e), 0, 1e-9);
  near(fixed.k, Math.hypot(3 * Math.PI / 400, 2 * Math.PI / 300), 1e-15, "fixed (2,1) wavenumber counts n+1, m+1");
  near(free.k, Math.hypot(2 * Math.PI / 400, 1 * Math.PI / 300), 1e-15, "free (2,1) wavenumber");
});

test("the circle's radial table agrees with the exact Bessel integral", () => {
  const R = 50;
  for (const [edge, n, m] of [["fixed", 3, 4], ["free", 7, 2], ["free", 0, 5], ["fixed", 20, 6]] as const) {
    const f = circleMode(edge, n, m, R, 0), kappa = f.k * R;
    // Peak normalisation is the only unknown; compare ratios at two radii to remove it.
    const a = 0.31, b = 0.83;
    const exact = besselJ(n, kappa * a) / besselJ(n, kappa * b), table = f.at(R * a, 0) / f.at(R * b, 0);
    near(table, exact, 1e-6 * Math.max(1, Math.abs(exact)), `${edge} (${n},${m})`);
  }
});

const linesAt = (paths: readonly Path[], axis: 0 | 1): number[] => paths.map((p) => p.points.reduce((s, q) => s + q[axis], 0) / p.points.length).sort((a, b) => a - b);

test("a single free rectangle mode draws n straight lines at (2j+1)W/2n across the full height", () => {
  const field = nodalField(plate()), paths = nodalPaths(field, 1);
  assert.equal(paths.length, 3);
  const xs = linesAt(paths, 0);
  [0, 1, 2].forEach((j) => near(xs[j], 120 + 400 * (2 * j + 1) / 6, 0.02, `line ${j}`));
  for (const p of paths) {
    const ys = p.points.map((q) => q[1]), px = p.points.map((q) => q[0]);
    near(Math.min(...ys), 170, 1e-6); near(Math.max(...ys), 470, 1e-6);
    assert.ok(Math.max(...px) - Math.min(...px) < 0.02, "line is straight");
    assert.equal(p.closed, false);
  }
});

test("under a fixed edge the interior lines sit at uW/(n+1) and the edge itself is not reported as a line", () => {
  const field = nodalField(plate({ edge: "fixed", modes: [mode(2, 1)], resolution: 240 })), paths = nodalPaths(field, 1);
  // Crossings of two lines are resolved to one cell, so a crossing may join paths differently; the geometry is what is checked.
  const lines: [number, number, number, number][] = [[120 + 400 / 3, 170, 120 + 400 / 3, 470], [120 + 800 / 3, 170, 120 + 800 / 3, 470], [120, 320, 520, 320]];
  const distance = (x: number, y: number, [x1, y1, x2, y2]: [number, number, number, number]) => {
    const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2)));
    return Math.hypot(x - (x1 + t * (x2 - x1)), y - (y1 + t * (y2 - y1)));
  };
  let total = 0;
  for (const p of paths) {
    for (const [x, y] of p.points) {
      // A line meeting the edge is resolved to one cell there (marching squares treats the crossing as a saddle).
      const tolerance = Math.min(x - 120, 520 - x, y - 170, 470 - y) < 2 * field.grid.cell ? 1.8 * field.grid.cell : 0.1;
      assert.ok(Math.min(...lines.map((l) => distance(x, y, l))) < tolerance, `vertex ${x},${y} is off every expected line`);
    }
    for (let i = 1; i < p.points.length; i++) total += Math.hypot(p.points[i][0] - p.points[i - 1][0], p.points[i][1] - p.points[i - 1][1]);
  }
  near(total, 300 + 300 + 400, 12, "total line length (the 1400-unit edge would add more than that)");
  for (const l of lines) for (let t = 0; t <= 1; t += 0.05) {
    const x = l[0] + t * (l[2] - l[0]), y = l[1] + t * (l[3] - l[1]);
    assert.ok(paths.some((p) => p.points.some(([a, b]) => Math.hypot(a - x, b - y) < 1.5 * field.grid.cell)), `line point ${x},${y} is covered`);
  }
});

test("circle modes put nodal circles and diameters where the Bessel zeros say", () => {
  const R = 230, base = plate({ shape: "circle", width: 2 * R, height: 2 * R, resolution: 240 });
  // Free (0, 1): κ = j′(0,1) = j(1,1); the nodal circle is J_0(κ s) = 0, s = j(0,1) / j(1,1).
  let paths = nodalPaths(nodalField({ ...base, modes: [mode(0, 1)] }), 1);
  assert.equal(paths.length, 1); assert.equal(paths[0].closed, true);
  for (const [x, y] of paths[0].points) near(Math.hypot(x - 320, y - 320), R * 2.40482555769577 / 3.83170597020751, 0.06);
  // Fixed (0, 2): κ = j(0,3); circles at s = j(0,1)/j(0,3) and j(0,2)/j(0,3).
  paths = nodalPaths(nodalField({ ...base, edge: "fixed", modes: [mode(0, 2)] }), 1);
  assert.equal(paths.length, 2);
  const radii = paths.map((p) => p.points.reduce((s, [x, y]) => s + Math.hypot(x - 320, y - 320), 0) / p.points.length).sort((a, b) => a - b);
  near(radii[0], R * 2.40482555769577 / 8.65372791291101, 0.08); near(radii[1], R * 5.52007811028631 / 8.65372791291101, 0.08);
  // Free (2, 0): two diameters at 45° and 135°, turned by the orientation: cos(2(θ − o)) = 0.
  for (const orient of [0, 20]) {
    paths = nodalPaths(nodalField({ ...base, modes: [mode(2, 0, 1, 0, orient)] }), 1);
    const o = orient * Math.PI / 180;
    let total = 0;
    for (const p of paths) {
      for (const [x, y] of p.points) {
        const d = Math.min(Math.abs(Math.sin(Math.atan2(y - 320, x - 320) - o - Math.PI / 4)), Math.abs(Math.cos(Math.atan2(y - 320, x - 320) - o - Math.PI / 4))) * Math.hypot(x - 320, y - 320);
        near(d, 0, Math.hypot(x - 320, y - 320) < 15 ? 0.5 : 0.1, `orient ${orient}`);
      }
      for (let i = 1; i < p.points.length; i++) total += Math.hypot(p.points[i][0] - p.points[i - 1][0], p.points[i][1] - p.points[i - 1][1]);
    }
    near(total, 4 * R, 4 * R * 0.01, `diameters at orient ${orient}`);
  }
});

test("mode parity and the swap-pair antisymmetry hold for the field and the drawn lines", () => {
  for (const [n, m] of [[1, 2], [2, 3], [3, 0]] as const) {
    const f = nodalField(plate({ modes: [mode(n, m)] }));
    for (const [x, y] of [[37, 21], [-90, 66], [140, -100]]) {
      near(f.amplitude(320 - x, 320 + y), (n % 2 ? -1 : 1) * f.amplitude(320 + x, 320 + y), 1e-12, `(${n},${m}) parity in x`);
      near(f.amplitude(320 + x, 320 - y), (m % 2 ? -1 : 1) * f.amplitude(320 + x, 320 + y), 1e-12, `(${n},${m}) parity in y`);
    }
  }
  const square = nodalField(plate({ shape: "square", width: 400, modes: [mode(3, 5), mode(5, 3, -1)], resolution: 240 }));
  for (const [x, y] of [[37, 21], [-90, 66], [140, -100], [5, 190]]) near(square.amplitude(320 + y, 320 + x), -square.amplitude(320 + x, 320 + y), 1e-12);
  const vertices = nodalPaths(square, 1).flatMap((p) => p.points);
  const near1 = (x: number, y: number) => vertices.some(([a, b]) => Math.hypot(a - x, b - y) < 1.2 * square.grid.cell);
  for (const [x, y] of vertices.filter((_, i) => i % 7 === 0)) assert.ok(near1(320 + (y - 320), 320 + (x - 320)), "line set is symmetric under transposition");
});

test("modes: coefficients follow weight × cos(2π·time·k/k_ref + phase) and the overall sign is canonical", () => {
  const f = nodalField(plate({ modes: [mode(1, 0, 1), mode(2, 0, 0.5, 60)], time: 0.125 }));
  near(f.modes[1].ratio, 2, 1e-12);
  near(f.modes[0].coefficient, Math.cos(Math.PI / 4), 1e-12);
  near(f.modes[1].coefficient, 0.5 * Math.cos(2 * Math.PI * 0.125 * 2 + Math.PI / 3), 1e-12);
  const a = nodalField(plate({ modes: [mode(2, 1, 1), mode(1, 2, -0.6)] })), b = nodalField(plate({ modes: [mode(2, 1, -1), mode(1, 2, 0.6)] }));
  for (const [x, y] of [[300, 300], [410, 250], [200, 400]]) near(a.amplitude(x, y), b.amplitude(x, y), 1e-12);
  assert.ok(a.grid.peak <= 1 + 1e-12);
  for (const field of [a, b]) {
    const g = field.grid;
    for (const [i, j] of [[5, 7], [g.columns >> 1, g.rows >> 1], [g.columns - 6, 20]])
      near(g.values[j * g.columns + i], field.amplitudeLocal(g.x0 + i * g.cell, g.y0 + j * g.cell), 1e-12, "grid sample equals the analytic field");
    const top = Math.max(...g.values.map(Math.abs));
    assert.ok(g.values.find((v) => Math.abs(v) >= top * (1 - 1e-9))! > 0, "first sample at the peak is positive");
  }
});

test("sites: exact count, stable ids, prefix stability, seeds, and identity under appearance edits", () => {
  const field = nodalField(plate({ shape: "square", width: 400, modes: [mode(3, 5), mode(5, 3, -1)] }));
  const options = { seed: 5, tolerance: 0.05, particles: 1000, separation: 1.5 };
  const sites = nodalSites(field, options);
  assert.equal(sites.length, 1000);
  sites.forEach((s, i) => assert.equal(s.id, `grain:${i}`));
  const fewer = nodalSites(field, { ...options, particles: 400 });
  assert.equal(fewer.length, 400);
  fewer.forEach((s, i) => { assert.equal(s.id, sites[i].id); assert.deepEqual(s.position, sites[i].position); });
  assert.equal(nodalSites(field, options), sites, "cached by construction");
  assert.notDeepEqual(nodalSites(field, { ...options, seed: 6 })[0].position, sites[0].position);
  assert.ok(Object.isFrozen(sites) && Object.isFrozen(sites[0]) && Object.isFrozen(sites[0].position));
  assert.equal(nodalSites(field, { ...options, particles: 0 }).length, 0);
  // Appearance edits through the instrument never rebuild the field, paths or sites.
  const a = nodalPlateComposition(inputWith()), b = nodalPlateComposition({ ...inputWith({ grainKind: "rosette", grainSize: 9, lineKind: "beads", bandOpacity: 0.4, align: true }), palette: [1, 2, 3] });
  const fa = nodalField(a.plate), fb = nodalField(b.plate);
  assert.equal(fa, fb);
  assert.equal(nodalPaths(fa, 42), nodalPaths(fb, 42));
  assert.equal(nodalSites(fa, { seed: 42, tolerance: a.tolerance, particles: a.particles, separation: a.separation }), nodalSites(fb, { seed: 42, tolerance: b.tolerance, particles: b.particles, separation: b.separation }));
  // A structural edit to the grains alone keeps the lines.
  const c = nodalPlateComposition(inputWith({ tolerance: 0.09 }));
  assert.equal(nodalPaths(nodalField(c.plate), 42), nodalPaths(fa, 42));
});

// Independent brute-force reference: the amplitude sampled on a fine grid, no sites code involved.
test("sites concentrate at the nodes: half-normal statistics and a rejection-rule check against numerical integration", () => {
  const tau = 0.05, W = 400;
  const field = nodalField(plate({ shape: "square", width: W, modes: [mode(3, 5), mode(5, 3, -1)], resolution: 240 }));
  const sites = nodalSites(field, { seed: 11, tolerance: tau, particles: 3000, separation: 0 });
  const peak = field.grid.peak;
  let siteMean = 0, far = 0;
  for (const s of sites) { const u = Math.abs(field.amplitude(s.position[0], s.position[1])) / peak; siteMean += u / sites.length; if (u > 3 * tau) far++; near(s.amplitude, field.amplitude(s.position[0], s.position[1]), 1e-12); }
  let plateMean = 0, count = 0;
  for (let i = 0; i < 300; i++) for (let j = 0; j < 300; j++) { plateMean += Math.abs(field.amplitude(120 + (i + 0.5) * W / 300, 120 + (j + 0.5) * W / 300)) / peak; count++; }
  plateMean /= count;
  assert.ok(plateMean > 0.2, `plate mean ${plateMean}`);
  assert.ok(siteMean < 0.06, `site mean |u|/peak ${siteMean}`);
  assert.ok(siteMean < plateMean / 4);
  assert.ok(far / sites.length < 0.02, `${far} of ${sites.length} beyond 3 tau`);
  // Single mode cos(πx/W): the accepted |u| has density ∝ exp(−½(u/τ)²) over the plate; compare its mean to the integral.
  const single = nodalField(plate({ width: 400, height: 300, modes: [mode(1, 0)], resolution: 240 }));
  const drawn = nodalSites(single, { seed: 3, tolerance: 0.2, particles: 8000, separation: 0 });
  const measured = drawn.reduce((s, q) => s + Math.abs(q.amplitude), 0) / drawn.length;
  let num = 0, den = 0;
  for (let i = 0; i < 200_000; i++) { const c = Math.abs(Math.cos(Math.PI * (i + 0.5) / 200_000)), w = Math.exp(-0.5 * (c / 0.2) ** 2); num += c * w; den += w; }
  near(measured, num / den, 0.006, "mean |u| under the stated density");
  // Mean acceptance probability equals the integral of ρ (checked through the placement statistics: fraction near the line).
  const inBand = drawn.filter((q) => Math.abs(q.amplitude) <= 0.2).length / drawn.length;
  let inside = 0; for (let i = 0; i < 200_000; i++) { const c = Math.abs(Math.cos(Math.PI * (i + 0.5) / 200_000)), w = Math.exp(-0.5 * (c / 0.2) ** 2); if (c <= 0.2) inside += w; }
  near(inBand, inside / den, 0.02, "share within one tau");
});

test("sites: separation is respected, angles follow the nodal tangent, lobes follow the sign", () => {
  const field = nodalField(plate({ modes: [mode(3, 0)] }));
  const sites = nodalSites(field, { seed: 2, tolerance: 0.08, particles: 600, separation: 4 });
  for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++)
    assert.ok(Math.hypot(sites[i].position[0] - sites[j].position[0], sites[i].position[1] - sites[j].position[1]) >= 4 - 1e-9);
  for (const s of sites) {
    near(Math.abs(Math.cos(s.angle)), 0, 0.05, "tangent of a vertical line is vertical");
    assert.equal(s.lobe, s.amplitude >= 0 ? 0 : 1);
    assert.ok(s.proximity > 0 && s.proximity <= 1);
    near(s.nodeDistance, Math.abs(s.amplitude) / (3 * Math.PI / 400 * Math.abs(Math.sin(3 * Math.PI * (s.position[0] - 120) / 400))), 0.01 * Math.max(1, s.nodeDistance) + 1e-6);
  }
  const turned = nodalField(plate({ modes: [mode(3, 0)], rotation: 90 }));
  for (const s of nodalSites(turned, { seed: 2, tolerance: 0.08, particles: 100, separation: 0 })) near(Math.abs(Math.sin(s.angle)), 0, 0.05, "rotated plate: horizontal tangents");
});

test("the node band of one mode has the analytic area H · (2W/π) · asin(τ)", () => {
  const tau = 0.1, field = nodalField(plate({ modes: [mode(1, 0)], resolution: 300 }));
  near(nodalBands(field, tau).area, 300 * (2 * 400 / Math.PI) * Math.asin(tau), 0.02 * 300 * (2 * 400 / Math.PI) * Math.asin(tau));
  near(nodalProximity(field, tau, 320, 320), 1, 1e-12); // on the line x = W/2
  assert.ok(Number.isNaN(nodalProximity(field, tau, 0, 0)));
  near(nodalDistance(field, 320 + 5, 320), 5, 0.3, "first-order distance from the line");
  const rotated = nodalField(plate({ shape: "circle", width: 400, modes: [mode(2, 1)], rotation: 37 }));
  const b = nodalBands(rotated, 0.1);
  assert.ok(b.area > 0 && b.area < rotated.outline.area);
  for (const region of b.regions) for (const [x, y] of region.outer) assert.ok(Math.hypot(x - 320, y - 320) <= 200 + 1e-6, "clipped to the disc");
});

test("bounds fail before expansion and name the control", () => {
  const field = nodalField(plate({ shape: "square", width: 400, modes: [mode(3, 5), mode(5, 3, -1)] }));
  assert.throws(() => nodalSites(nodalField(plate({ modes: [mode(3, 0)] })), { seed: 1, tolerance: 0.002, particles: NODAL_LIMITS.particles, separation: 0 }), /Particles.*Node width/);
  assert.throws(() => nodalSites(field, { seed: 1, tolerance: 0.05, particles: 6000, separation: 30 }), /Separation/);
  assert.throws(() => nodalField(plate({ resolution: 481 })), /Resolution/);
  assert.throws(() => nodalField(plate({ modes: [mode(25, 0)] })), /index n/);
  assert.throws(() => nodalField(plate({ modes: [mode(0, 0)] })), /uniform/);
  assert.throws(() => nodalField(plate({ modes: [mode(1, 0, 0)] })), /Weight/);
  assert.throws(() => nodalField(plate({ modes: [mode(2, 1, 1, 90)] })), /cancel/);
  assert.throws(() => nodalPaths(nodalField(plate({ shape: "circle", width: 400, modes: [mode(24, 24)], resolution: 480 })), 1), /Resolution/);
  assert.throws(() => nodalField(plate({ edge: "sticky" as never })), /edge/);
});

test("the instrument: hidden controls never change the drawing, visible ones do", () => {
  const same = (base: Record<string, number | string | boolean>, hidden: Record<string, number | string | boolean>) =>
    assert.equal(drawFingerprint(inputWith({ ...base, ...hidden })), drawFingerprint(inputWith(base)), JSON.stringify(hidden));
  same({ modes: "1" }, { weight1: -0.3, phase1: 77, time: 1.3, n2: 9, m2: 1, weight2: 1, n3: 4, phase4: 33, orient2: 40 });
  same({ modes: "2" }, { n3: 7, m3: 6, weight3: 1, phase3: 20, n4: 2, orient4: 12 });
  same({ shape: "square" }, { height: 250, orient1: 40, orient2: 90 });
  same({ shape: "rectangle", width: 500, height: 300 }, { orient1: 33 });
  same({ grainKind: "dot" }, { align: true, grainWeight: 2.5, grainPetals: 3, grainOpening: 0.8 });
  same({ grainKind: "rings" }, { align: true, grainPetals: 9 });
  same({ lines: false }, { lineKind: "beads", lineWeight: 3, lineSpacing: 20, lineBead: 9 });
  same({ lines: true, lineKind: "ink" }, { lineSpacing: 20, lineBead: 9 });
  same({ lines: true, lineKind: "beads" }, { lineWeight: 3 });
  same({ bands: false }, { bandOpacity: 0.5 });
  same({ outline: false }, { outlineWeight: 3 });
  const base = drawFingerprint(inputWith());
  for (const change of [{ weight2: -0.7 }, { n1: 4 }, { time: 0.2 }, { edge: "fixed" }, { shape: "circle" }, { tolerance: 0.1 }, { grainKind: "rings" }, { lines: false }, { bands: true }, { particles: 3000 }])
    assert.notEqual(drawFingerprint(inputWith(change)), base, JSON.stringify(change));
  const time = { modes: "2", time: 0.3 };
  assert.notEqual(drawFingerprint(inputWith(time)), drawFingerprint(inputWith({ ...time, phase2: 40 })));
});

test("the seed changes the drawing only where it is read", () => {
  const quiet = { particles: 0 };
  assert.equal(drawFingerprint(inputWith(quiet, 1)), drawFingerprint(inputWith(quiet, 2)));
  assert.notEqual(drawFingerprint(inputWith({}, 1)), drawFingerprint(inputWith({}, 2)));
});

test("admission: invalid weights, indices and shapes are refused with the control named", () => {
  assert.throws(() => validateInstrument({ ...inputWith({ weight1: 0, weight2: 0 }) }), /weights/);
  validateInstrument(inputWith({ modes: "1", weight1: 0 })); // hidden weight: the mode still draws
  assert.throws(() => validateInstrument(inputWith({ n1: 2.5 })), /n1/);
  assert.throws(() => validateInstrument(inputWith({ shape: "oval" })), /shape/);
});
