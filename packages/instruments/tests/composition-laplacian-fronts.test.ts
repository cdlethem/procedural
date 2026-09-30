import assert from "node:assert/strict";
import test from "node:test";
import {
  GROWTH_KIND_FREE, GROWTH_KIND_SINK, GROWTH_KIND_SOURCE, GROWTH_KIND_WALL, canPrepareInstrument, checkSimulation, createInstrument, drawLaplacianFronts,
  finalState, growthAgeSites, growthCached, growthDiagnostics, growthFrontPaths, growthFrontRates, growthFrontSteps, growthBandSteps, growthLastActiveStep, growthLayout,
  growthPillarCentres, growthSimulation, growthSnapshots, growthTipSites, laplacianFrontsComposition, laplacianFrontsProducts, prepareInstrument, solveLaplacePotential,
  stateAt, validateParameters, growthEquipotentialPaths, growthPotentialField, growthOccupiedRegion, usesSeed, drawInstrument,
  type GrowthSpec, type GrowthSnapshots, type LaplacianFrontsComposition,
} from "../src/index.js";
import { growthSpecOf } from "../src/adapters/laplacian-fronts-instrument.js";

type Values = Record<string, number | string | boolean>;
const defaults = (): Values => ({ ...createInstrument("laplacian-fronts").params });
const specWith = (params: Values = {}, patch: Partial<GrowthSpec> = {}): GrowthSpec => ({ ...growthSpecOf({ ...defaults(), ...params }), ...patch });
/** A plain disc grown with no bias, tension or disorder unless a test says otherwise. */
const disc = (patch: Partial<GrowthSpec> = {}): GrowthSpec => specWith({ seedShape: "disc", noise: 0, tension: 0, eta: 1, grid: 96 }, patch);
const near = (a: number, b: number, tol: number, label = ""): void => assert.ok(Math.abs(a - b) <= tol, `${label} ${a} vs ${b} (tol ${tol})`);
const recipe = (params: Values = {}, seed = 42): LaplacianFrontsComposition => {
  const input = createInstrument("laplacian-fronts");
  return laplacianFrontsComposition({ ...input, seed, params: { ...input.params, ...params } });
};

/** Polar radii of a frame's rings around the canvas point (cx, cy): [angle, radius] of every vertex of ring `k`. */
function polar(snaps: GrowthSnapshots, step: number, cx: number, cy: number, ring = 0): [number, number][] {
  const frame = snaps.history.find((entry) => entry.step === step)!.value;
  const out: [number, number][] = [];
  for (let k = frame.offsets[ring]; k < frame.offsets[ring + 1]; k++) {
    const dx = frame.points[2 * k] - cx, dy = frame.points[2 * k + 1] - cy;
    out.push([Math.atan2(dy, dx), Math.hypot(dx, dy)]);
  }
  return out;
}
/** Largest radius within `half` radians of `angle`. */
const radiusAt = (points: [number, number][], angle: number, half = 0.12): number => {
  let best = 0;
  for (const [a, r] of points) {
    const d = Math.abs(Math.atan2(Math.sin(a - angle), Math.cos(a - angle)));
    if (d <= half && r > best) best = r;
  }
  return best;
};
const ringAreas = (snaps: GrowthSnapshots, step: number): number[] => {
  const frame = snaps.history.find((entry) => entry.step === step)!.value, areas: number[] = [];
  for (let r = 0; r + 1 < frame.offsets.length; r++) {
    let sum = 0;
    const from = frame.offsets[r], to = frame.offsets[r + 1];
    for (let k = from; k < to; k++) {
      const next = k + 1 < to ? k + 1 : from;
      sum += frame.points[2 * k] * frame.points[2 * next + 1] - frame.points[2 * next] * frame.points[2 * k + 1];
    }
    areas.push(sum / 2);
  }
  return areas;
};

test("the potential of a disc inside a source ring is the logarithm of the radius, and the reported residual is real", () => {
  const spec = disc({ grid: 128, seedRadius: 60, sourceRadius: 280, tolerance: 1e-9 });
  const snaps = growthSnapshots(spec, 1, 0);
  const state = finalState(snaps), layout = growthLayout(spec, 1), n = layout.n, cell = layout.cell;
  // The cell-decided disc and ring are not exactly circles: compare with the analytic solution at their effective radii.
  let seedCells = 0, sourceCells = 0;
  for (let c = 0; c < n * n; c++) { if (layout.seedCells[c]) seedCells++; if (layout.kind[c] === GROWTH_KIND_SOURCE) sourceCells++; }
  const a = Math.sqrt(seedCells * cell * cell / Math.PI);
  const b = Math.sqrt((640 * 640 - sourceCells * cell * cell) / Math.PI);
  let worst = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const c = j * n + i, r = Math.hypot((i + 0.5) * cell - 320, (j + 0.5) * cell - 320);
    if (layout.kind[c] !== GROWTH_KIND_FREE || layout.seedCells[c] || r < a + 3 * cell || r > b - 3 * cell) continue;
    worst = Math.max(worst, Math.abs(state.phi[c] - Math.log(r / a) / Math.log(b / a)));
  }
  assert.ok(worst < 0.02, `worst deviation from ln(r/a)/ln(b/a) was ${worst}`);
  // Independent residual: mean of open neighbours minus the value, over every unknown cell.
  let residual = 0;
  for (let c = 0; c < n * n; c++) {
    if (layout.kind[c] !== GROWTH_KIND_FREE || layout.seedCells[c]) continue;
    const j = Math.floor(c / n), i = c % n, values: number[] = [];
    if (j > 0) values.push(state.phi[c - n]); if (j < n - 1) values.push(state.phi[c + n]); if (i > 0) values.push(state.phi[c - 1]); if (i < n - 1) values.push(state.phi[c + 1]);
    residual = Math.max(residual, Math.abs(values.reduce((s, v) => s + v, 0) / values.length - state.phi[c]));
  }
  assert.ok(residual <= 1e-9, `independent residual ${residual}`);
  near(state.residual, residual, 1e-9, "reported residual");
  assert.ok(growthDiagnostics(snaps).residualMax <= 1e-9);
});

test("the potential obeys the maximum principle with sinks, walls and every source kind, and nothing enters a fixed cell", () => {
  const cases: Values[] = [
    { source: "ring", sinks: "discs" }, { source: "frame", barrier: "wall" }, { source: "edge", sourceSide: "left", barrier: "pillars" },
    { source: "points", sinks: "discs", barrier: "wall", barrierGaps: 3 },
  ];
  for (const params of cases) {
    const spec = specWith({ ...params, grid: 64, steps: 30 }), snaps = growthSnapshots(spec, 5, 30), layout = growthLayout(spec, 5);
    const state = finalState(snaps);
    for (let c = 0; c < layout.n ** 2; c++) {
      const kind = layout.kind[c];
      if (kind === GROWTH_KIND_SOURCE) assert.equal(state.phi[c], 1);
      if (kind === GROWTH_KIND_SINK || kind === GROWTH_KIND_WALL) { assert.equal(state.age[c], -1, `cell ${c} of kind ${kind} was entered`); assert.equal(state.fill[c], 0); }
      if (kind === GROWTH_KIND_FREE) assert.ok(state.phi[c] >= -1e-7 && state.phi[c] <= 1 + 1e-7, `phi ${state.phi[c]} outside [0, 1]`);
      if (state.age[c] >= 0) assert.equal(state.phi[c], 0);
    }
    assert.ok(growthDiagnostics(snaps).residualMax <= spec.tolerance);
  }
});

test("a solve that cannot reach the tolerance throws with the residual and the controls to change instead of returning", () => {
  const spec = disc({ grid: 160, maxIterations: 10, tolerance: 1e-9 });
  assert.throws(() => growthSnapshots(spec, 1, 0), (error: Error) => /residual/.test(error.message) && /Solver iterations/.test(error.message) && /Solver precision/.test(error.message) && /Grid/.test(error.message));
  const layout = growthLayout(spec, 1), fill = new Float32Array(160 * 160), phi = new Float64Array(160 * 160).fill(1);
  for (let c = 0; c < fill.length; c++) if (layout.seedCells[c]) { fill[c] = 1; phi[c] = 0; }
  const report = solveLaplacePotential(layout, phi, fill, 1e-9, 10);
  assert.equal(report.converged, false);
  assert.ok(report.residual > 1e-9 && report.iterations <= 10);
});

test("front speed follows the flux: the speed exponent relation and the staircase weight hold at every front cell", () => {
  // Tips at 22.5 + 90k degrees, notches at 67.5 + 90k: mirror images of each other on the square grid, so grid bias cannot separate them.
  const base = disc({ seedShape: "lobed", seedLobes: 4, seedDepth: 0.25, seedRadius: 60, seedAngle: 22.5 } as Partial<GrowthSpec>);
  const layout = growthLayout(base, 1), snaps = growthSnapshots(base, 1, 0), state = stateAt(snaps, 0);
  const one = growthFrontRates(layout, { ...base, eta: 1 }, state.fill, state.phi), two = growthFrontRates(layout, { ...base, eta: 2 }, state.fill, state.phi);
  const zero = growthFrontRates(layout, { ...base, eta: 0 }, state.fill, state.phi);
  let cells = 0, peak = 0;
  for (let c = 0; c < one.rate.length; c++) {
    if (one.rate[c] <= 0) { assert.equal(two.rate[c], 0); continue; }
    cells++;
    // rate = ĝ^η w, so w = rate(1)² / rate(2) is the staircase weight in [1, √2] and rate(0) = w.
    const w = one.rate[c] ** 2 / two.rate[c];
    assert.ok(w >= 1 - 1e-4 && w <= Math.SQRT2 + 1e-4, `weight ${w}`);
    near(zero.rate[c], w, 1e-4 * w, "rate at eta 0 is the weight alone");
    peak = Math.max(peak, one.rate[c]);
  }
  assert.ok(cells > 40);
  const n = layout.n, angleOf = (c: number): number => Math.atan2(((Math.floor(c / n) + 0.5) * layout.cell) - 320, ((c % n) + 0.5) * layout.cell - 320);
  const fromTip = (c: number): number => { const t = (((angleOf(c) - Math.PI / 8) % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2); return Math.min(t, Math.PI / 2 - t); };
  let tipSum = 0, tipCount = 0, notchSum = 0, notchCount = 0;
  for (let c = 0; c < one.rate.length; c++) {
    if (one.rate[c] <= 0) continue;
    if (fromTip(c) < 0.2) { tipSum += one.rate[c]; tipCount++; }
    if (fromTip(c) > Math.PI / 4 - 0.2) { notchSum += one.rate[c]; notchCount++; }
  }
  assert.ok(tipCount > 5 && notchCount > 5);
  assert.ok(tipSum / tipCount > 1.15 * (notchSum / notchCount), `tips ${tipSum / tipCount} against notches ${notchSum / notchCount}`);
  const flat = { tip: 0, notch: 0 };
  for (let c = 0; c < zero.rate.length; c++) { if (zero.rate[c] <= 0) continue; if (fromTip(c) < 0.2) flat.tip += zero.rate[c] / tipCount; if (fromTip(c) > Math.PI / 4 - 0.2) flat.notch += zero.rate[c] / notchCount; }
  near(flat.tip, flat.notch, 0.08 * flat.notch, "an offset (eta 0) moves tips and notches alike");
  void peak;
});

test("a perturbed circle grows its tips faster than its notches under flux and does not under an offset, and surface tension removes it", () => {
  const seed: Partial<GrowthSpec> = { seedShape: "lobed", seedLobes: 4, seedDepth: 0.2, seedRadius: 50, seedAngle: 22.5, grid: 128, stepScale: 0.5 };
  const amplitude = (patch: Partial<GrowthSpec>, steps: number): { start: number; end: number; tip: number } => {
    const snaps = growthSnapshots(disc({ ...seed, ...patch }), 1, steps);
    const measure = (step: number): number => {
      const points = polar(snaps, step, 320, 320);
      return radiusAt(points, Math.PI / 8) - Math.min(...[(3 * Math.PI) / 8, -Math.PI / 8].map((a) => radiusAt(points, a)));
    };
    return { start: measure(0), end: measure(steps), tip: radiusAt(polar(snaps, steps, 320, 320), Math.PI / 8) };
  };
  const offset = amplitude({ eta: 0 }, 60), flux = amplitude({ eta: 1 }, 60), sharp = amplitude({ eta: 2 }, 60), damped = amplitude({ eta: 1, tension: 40 }, 60);
  near(flux.start, 0.4 * 50, 8, "seed lobe amplitude");
  assert.ok(offset.end < offset.start + 3, `an offset never amplifies the lobes (${offset.start} to ${offset.end})`);
  assert.ok(flux.end > flux.start + 25, `flux amplifies the tips: ${flux.start} to ${flux.end}`);
  assert.ok(sharp.end > flux.end, `a higher bias amplifies more: ${flux.end} vs ${sharp.end}`);
  assert.ok(damped.end < flux.end - 25, `surface tension damps the amplification: ${damped.end} vs ${flux.end}`);
});

test("area added by a step equals the fill handed out, whatever cells fill (nothing is dropped)", () => {
  const spec = disc({ seedShape: "lobed", seedLobes: 5, seedDepth: 0.2, seedRadius: 40, stepScale: 1, grid: 80 } as Partial<GrowthSpec>);
  const snaps = growthSnapshots(spec, 3, 6), layout = growthLayout(spec, 3), cell2 = layout.cell ** 2;
  for (let k = 0; k < 6; k++) {
    const before = stateAt(snaps, k), after = stateAt(snaps, k + 1);
    let handed = 0;
    for (let c = 0; c < before.rate.length; c++) handed += (spec.stepScale * before.rate[c]) / before.rateMax;
    near(after.area - before.area, cell2 * (handed - (after.lost - before.lost)), 1e-3 * cell2, `step ${k + 1}`);
    let sum = 0;
    for (const v of after.fill) sum += v;
    near(after.area, sum * cell2, 1e-6 * after.area, "area is the total fill");
    assert.ok(after.time > before.time, "normalized time advances");
  }
});

test("merging fronts stay valid: two discs become one ring, a necklace closes a pocket as a negative ring, and no ring self-intersects", () => {
  const two = growthSnapshots(disc({ seedShape: "necklace", seedCount: 2, seedSpread: 50, seedRadius: 30, grid: 96, eta: 0.5 } as Partial<GrowthSpec>), 1, 80);
  const outers = two.history.map((entry) => ringAreas(two, entry.step).filter((a) => a > 0).length);
  assert.equal(outers[0], 2, "two discs, two outer rings");
  assert.equal(outers[outers.length - 1], 1, "merged into one outer ring");
  const merge = outers.findIndex((c) => c === 1);
  assert.ok(merge > 0 && outers.slice(merge).every((c) => c === 1), "once merged the front stays one outer loop");
  const ring = disc({ seedShape: "necklace", seedCount: 7, seedSpread: 90, seedRadius: 22, grid: 112, eta: 0.5, sourceRadius: 300 } as Partial<GrowthSpec>);
  const snaps = growthSnapshots(ring, 1, 90);
  let pockets = 0;
  for (const entry of snaps.history) {
    if (entry.value.repeat) continue;
    const areas = ringAreas(snaps, entry.step);
    for (const a of areas) assert.ok(Math.abs(a) > 0, "no zero-area ring");
    pockets = Math.max(pockets, areas.filter((a) => a < 0).length);
    // Signed ring areas add to the enclosed area, to the accuracy of the contour against the fill.
    near(areas.reduce((s, a) => s + a, 0), entry.value.area, 0.06 * entry.value.area + 200, `signed area at ${entry.step}`);
  }
  assert.ok(pockets >= 1, "a pocket appeared");
  const last = snaps.history[snaps.history.length - 1];
  for (const path of growthFrontPaths(snaps, last.step)) {
    const seen = new Set(path.points.map((p) => `${p[0]},${p[1]}`));
    assert.equal(seen.size, path.points.length, "no repeated vertex within a front");
  }
});

test("growth stops explicitly: a seed the tension holds stalls, a filled domain is exhausted, and later fronts equal the last", () => {
  const stalled = growthSnapshots(disc({ seedRadius: 8, tension: 30, grid: 64 }), 1, 40);
  const info = growthDiagnostics(stalled);
  assert.equal(info.stopped, "stalled");
  assert.equal(info.lastActiveStep, 0);
  assert.equal(stalled.final.stopStep, 0);
  assert.equal(growthFrontPaths(stalled, 40), growthFrontPaths(stalled, 0), "the last front is reused after growth ended");
  assert.equal(stalled.history[40].value.repeat, true);
  assert.equal(stalled.history[40].value.points.length, 0);
  // A solid wall seals the seed's half of the canvas from the only source: the sealed region fills completely and the frontier empties.
  const sealed = growthSnapshots(specWith({ grid: 32, seedShape: "disc", seedX: 320, seedY: 150, seedRadius: 30, noise: 0, tension: 0, source: "edge", sourceSide: "bottom",
    sourceSize: 20, barrier: "wall", barrierAngle: 0, barrierOffset: 0, barrierWidth: 20, barrierGaps: 1, barrierGapWidth: 0, precision: 6, stepScale: 1 }), 1, 300);
  assert.equal(growthDiagnostics(sealed).stopped, "exhausted");
  const sealedState = finalState(sealed), sealedLayout = growthLayout(specWith({ grid: 32, seedShape: "disc", seedX: 320, seedY: 150, seedRadius: 30, source: "edge", sourceSide: "bottom",
    sourceSize: 20, barrier: "wall", barrierAngle: 0, barrierOffset: 0, barrierWidth: 20, barrierGaps: 1, barrierGapWidth: 0, noise: 0 }), 1);
  for (let c = 0; c < 32 * 32; c++) if (sealedLayout.kind[c] === GROWTH_KIND_FREE && Math.floor(c / 32) < 14) assert.ok(sealedState.age[c] >= 0, `cell ${c} of the sealed region was left empty`);
  // Touching the source stops growth at the step that first puts an occupied cell beside it.
  const touching = growthSnapshots(disc({ seedRadius: 500, grid: 48 }), 1, 5);
  assert.equal(growthDiagnostics(touching).stopped, "reached");
  assert.equal(growthDiagnostics(touching).lastActiveStep, 0);
  const near2 = disc({ seedRadius: 40, sourceRadius: 110, grid: 64, steps: 300 } as Partial<GrowthSpec>);
  const reach = growthSnapshots(near2, 1, 300), reachInfo = growthDiagnostics(reach), sourceLayout = growthLayout(near2, 1);
  assert.equal(reachInfo.stopped, "reached");
  const beside = (age: Int16Array, upTo: number): boolean => {
    for (let c = 0; c < 64 * 64; c++) {
      if (age[c] < 0 || age[c] > upTo) continue;
      const j = Math.floor(c / 64), i = c % 64;
      if ((j > 0 && sourceLayout.kind[c - 64] === GROWTH_KIND_SOURCE) || (j < 63 && sourceLayout.kind[c + 64] === GROWTH_KIND_SOURCE) ||
        (i > 0 && sourceLayout.kind[c - 1] === GROWTH_KIND_SOURCE) || (i < 63 && sourceLayout.kind[c + 1] === GROWTH_KIND_SOURCE)) return true;
    }
    return false;
  };
  const ages = finalState(reach).age;
  assert.equal(beside(ages, reachInfo.lastActiveStep), true, "at the stop an occupied cell touches the source");
  assert.equal(beside(ages, reachInfo.lastActiveStep - 1), false, "one step earlier none did");
  assert.ok(reachInfo.lastActiveStep > 5 && reachInfo.lastActiveStep < 300);
  const grown = growthSnapshots(disc({ seedRadius: 40, tension: 10, grid: 64, steps: 400 } as Partial<GrowthSpec>), 1, 400);
  const g = growthDiagnostics(grown);
  assert.ok(g.stopped !== "running" && g.lastActiveStep > 5 && g.lastActiveStep < 400, `stopped at ${g.lastActiveStep} (${g.stopped})`);
  const stop = g.lastActiveStep;
  assert.equal(grown.history[stop + 1].value.repeat, true, "frames after the stop are marked as repeats");
  assert.equal(stateAt(grown, 400).area, stateAt(grown, stop).area, "nothing grows after the stop");
});

test("stateful guarantees: deterministic replay, prefix, checkpoints, cancellation and element independence", () => {
  checkSimulation(growthSimulation, disc({ grid: 40, seedShape: "lobed", noise: 0.3, tension: 3 } as Partial<GrowthSpec>), 7, 12);
  checkSimulation(growthSimulation, specWith({ grid: 32, barrier: "pillars", source: "frame", sinks: "discs" }), 3, 9);
});

test("prefix property: more steps only append and never change an earlier front or age", () => {
  const spec = specWith({ grid: 64 });
  const short = growthSnapshots(spec, 9, 10), long = growthSnapshots(spec, 9, 30);
  for (const entry of short.history) {
    const later = long.history.find((e) => e.step === entry.step)!.value;
    assert.deepEqual(Array.from(later.points), Array.from(entry.value.points));
    assert.equal(later.area, entry.value.area);
  }
  const a = stateAt(short, 10), b = stateAt(long, 10);
  assert.deepEqual(Array.from(a.age), Array.from(b.age));
  assert.deepEqual(Array.from(finalState(long).age).filter((v) => v >= 0 && v <= 10), Array.from(a.age).filter((v) => v >= 0));
});

test("palette, material, fill, marks, front window and potential edits repaint the SAME snapshot; structural edits recompute", () => {
  const one = laplacianFrontsProducts(recipe({ grid: 64 }));
  const edits: Values[] = [{ frontMaterial: "beads" }, { fill: "flat" }, { fillBands: 4 }, { marks: "tips" }, { marks: "age", markKind: "rosette" }, { frontEvery: 9 },
    { frontTo: 0.5 }, { potential: "lines" }, { frontWeight: 2.5 }, { frontSmooth: 0 }];
  for (const edit of edits) assert.equal(laplacianFrontsProducts(recipe({ grid: 64, ...edit })).snapshots, one.snapshots, JSON.stringify(edit));
  const input = createInstrument("laplacian-fronts");
  const recolour = laplacianFrontsComposition({ ...input, params: { ...input.params, grid: 64 }, palette: [0x111111, 0x222222, 0x333333, 0x444444] });
  assert.equal(laplacianFrontsProducts(recolour).snapshots, one.snapshots);
  for (const edit of [{ seedX: 330 }, { eta: 1.5 }, { tension: 5 }, { stepScale: 0.4 }, { noise: 0.2 }, { source: "frame" }, { sinks: "discs" }, { barrier: "wall" }, { seedRadius: 50 }, { precision: 6 }])
    assert.notEqual(laplacianFrontsProducts(recipe({ grid: 64, ...edit })).snapshots, one.snapshots, `${JSON.stringify(edit)} must recompute`);
  assert.notEqual(laplacianFrontsProducts(recipe({ grid: 64 }, 43)).snapshots, one.snapshots, "the seed matters with noise");
  // Hidden controls (a lobed seed's lobes for a disc, the wall's angle without a wall) cannot change the construction.
  const disc1 = laplacianFrontsProducts(recipe({ grid: 64, seedShape: "disc" })).snapshots;
  assert.equal(laplacianFrontsProducts(recipe({ grid: 64, seedShape: "disc", seedLobes: 9, seedDepth: 0.4, seedCount: 3, barrierAngle: 33, pillarSize: 40, sinkRing: 100 })).snapshots, disc1);
  const still = laplacianFrontsProducts(recipe({ grid: 64, noise: 0, seedShape: "disc" })).snapshots;
  assert.equal(laplacianFrontsProducts(recipe({ grid: 64, noise: 0, seedShape: "disc" }, 99)).snapshots, still, "with nothing seeded every seed shares one run");
  assert.equal(usesSeed({ ...createInstrument("laplacian-fronts"), params: { ...defaults(), noise: 0, seedShape: "disc" } }), false);
  assert.equal(usesSeed(createInstrument("laplacian-fronts")), true);
});

test("changing the steps extends the cached run and a smaller count replays from a checkpoint with identical fronts", () => {
  const spec = specWith({ grid: 48 });
  const long = growthSnapshots(spec, 4, 60), short = growthSnapshots(spec, 4, 33), back = growthSnapshots(spec, 4, 60);
  assert.equal(back, long);
  assert.equal(short.steps, 33);
  assert.deepEqual(Array.from(short.final.points), Array.from(long.history.find((e) => e.step === 33)!.value.points));
  assert.ok(growthCached(spec, 4, 60) && !growthCached(spec, 4, 61));
});

test("preparation is cooperative, honours cancellation, and a cancelled preparation leaves nothing cached", async () => {
  assert.equal(canPrepareInstrument("laplacian-fronts"), true);
  const input = createInstrument("laplacian-fronts");
  input.params = { ...input.params, grid: 56, steps: 25, noise: 0.11 };
  const spec = growthSpecOf(input.params as Values);
  assert.equal(await prepareInstrument(input, () => true), false);
  let polls = 0;
  assert.equal(await prepareInstrument(input, () => ++polls > 6), false, "cancelled between steps");
  assert.equal(growthCached(spec, input.seed, 25), false, "no partial result is cached");
  assert.equal(await prepareInstrument(input, () => false), true);
  assert.equal(growthCached(spec, input.seed, 25), true);
  const calls: string[] = [];
  const surface = new Proxy({ CLOSE: 1, ROUND: 2 } as Record<string, unknown>, { get: (t, k: string) => (k in t ? t[k] : () => { calls.push(k); }) });
  const before = laplacianFrontsProducts(laplacianFrontsComposition(input)).snapshots;
  drawInstrument(surface as never, input);
  assert.ok(calls.includes("endShape"));
  assert.equal(laplacianFrontsProducts(laplacianFrontsComposition(input)).snapshots, before);
});

test("boundary layout: cells classify exactly, the seed yields to boundaries, pillars are a stable prefix, seeds move only what is seeded", () => {
  const spec = specWith({ grid: 64, source: "ring", sourceRadius: 250, sinks: "discs", sinkRing: 120, sinkSize: 30, sinkCount: 1, sinkAngle: 0 });
  const layout = growthLayout(spec, 1), cell = layout.cell;
  for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) {
    const x = (i + 0.5) * cell, y = (j + 0.5) * cell, c = j * 64 + i;
    if (Math.hypot(x - 320, y - 320) >= 250) assert.equal(layout.kind[c], GROWTH_KIND_SOURCE);
    else if (Math.hypot(x - (320 + 120), y - 320) <= 30) assert.equal(layout.kind[c], GROWTH_KIND_SINK);
    else assert.equal(layout.kind[c], GROWTH_KIND_FREE);
  }
  // A seed placed on the sink is dropped where the sink is.
  const onSink = growthLayout({ ...spec, seedX: 440, seedY: 320, seedRadius: 45, seedShape: "disc" }, 1);
  for (let c = 0; c < 64 * 64; c++) if (onSink.seedCells[c]) assert.equal(onSink.kind[c], GROWTH_KIND_FREE);
  assert.throws(() => growthLayout({ ...spec, seedX: 440, seedY: 320, seedRadius: 6, sinkSize: 40, seedShape: "disc" }, 1), /seed region is empty/);
  assert.throws(() => growthLayout({ ...spec, sourceRadius: 1000 }, 1), /no source cells/);
  const three = growthPillarCentres({ pillarCount: 3, pillarSize: 20, seedX: 320, seedY: 320, seedRadius: 40, seedDepth: 0, seedSpread: 0, seedShape: "disc" }, 8);
  const four = growthPillarCentres({ pillarCount: 4, pillarSize: 20, seedX: 320, seedY: 320, seedRadius: 40, seedDepth: 0, seedSpread: 0, seedShape: "disc" }, 8);
  assert.deepEqual(four.slice(0, 3), three);
  const other = growthPillarCentres({ pillarCount: 3, pillarSize: 20, seedX: 320, seedY: 320, seedRadius: 40, seedDepth: 0, seedSpread: 0, seedShape: "disc" }, 9);
  assert.notDeepEqual(other, three);
  // Mobility (noise) is a smooth value noise around 1 bounded by the noise amount.
  const noisy = growthLayout({ ...spec, noise: 0.4 }, 5);
  let lo = Infinity, hi = -Infinity;
  for (const v of noisy.mobility!) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  assert.ok(lo >= 0.6 - 1e-6 && hi <= 1.4 + 1e-6 && hi - lo > 0.3);
  assert.equal(growthLayout({ ...spec, noise: 0 }, 5).mobility, null);
});

test("sinks bend the growth away from them and one-sided sources grow toward the source side", () => {
  const plain = growthSnapshots(disc({ seedRadius: 30, grid: 80 }), 1, 50);
  const sunk = growthSnapshots(disc({ seedRadius: 30, grid: 80, maxIterations: 2000, sinks: "discs", sinkCount: 1, sinkSize: 40, sinkRing: 110, sinkAngle: 0 }), 1, 50);
  const toward = (s: GrowthSnapshots): number => radiusAt(polar(s, 50, 320, 320), 0, 0.15);
  const away = (s: GrowthSnapshots): number => radiusAt(polar(s, 50, 320, 320), Math.PI, 0.15);
  assert.ok(toward(sunk) < toward(plain) - 8, "growth toward an absorber is suppressed");
  assert.ok(away(sunk) > away(plain) - 2, "growth away from the absorber is not");
  const top = growthSnapshots(disc({ seedRadius: 30, grid: 80, maxIterations: 2000, source: "edge", sourceSize: 20, sourceSide: "top" as GrowthSpec["sourceSide"] }), 1, 40);
  const up = radiusAt(polar(top, 40, 320, 320), -Math.PI / 2, 0.3), down = radiusAt(polar(top, 40, 320, 320), Math.PI / 2, 0.3);
  assert.ok(up > down + 20, `a source at the top pulls the front up (${up} against ${down})`);
});

test("marks and potential lines read the same run: tips are speed maxima at the front, ages increase outward, equipotentials nest", () => {
  const snaps = laplacianFrontsProducts(recipe({ grid: 80, noise: 0.3, steps: 50 })).snapshots;
  const state = finalState(snaps), n = 80, cell = 640 / n;
  const tips = growthTipSites(snaps, 0.5);
  assert.ok(tips.length >= 2 && tips.length < 40);
  for (const t of tips) {
    assert.ok(t.amount >= 0.5 - 1e-6 && t.amount <= 1 + 1e-6);
    const c = Number(t.id.slice(5));
    assert.ok(state.rate[c] > 0 && state.fill[c] >= 0 && state.fill[c] < 1, "a tip is a frontier cell");
    const i = c % n, j = (c - i) / n;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const k = (j + dj) * n + i + di;
      if (k !== c && k >= 0 && k < n * n) assert.ok(state.rate[k] <= state.rate[c] + 1e-12, "no neighbour is faster");
    }
    // The outward normal points along increasing potential: away from the seed for a ring source.
    assert.ok(Math.cos(t.angle) * (t.position[0] - 320) + Math.sin(t.angle) * (t.position[1] - 320) > 0, "tips point outward");
    assert.ok(Math.abs(t.position[0] - (i + 0.5) * cell) <= cell && Math.abs(t.position[1] - (j + 0.5) * cell) <= cell);
  }
  const fast = growthTipSites(snaps, 0.9);
  assert.ok(fast.length <= tips.length && fast.every((t) => tips.some((u) => u.id === t.id)), "a higher threshold keeps a subset");
  const sites = growthAgeSites(snaps, 20);
  assert.ok(sites.length > 30);
  const last = growthLastActiveStep(snaps);
  for (const s of sites) {
    const c = Math.floor(s.position[1] / cell) * n + Math.floor(s.position[0] / cell);
    assert.ok(state.age[c] >= 0);
    near(s.amount, Math.min(1, state.age[c] / last), 1e-12);
    assert.equal(s.scale, 0.45 + 0.55 * s.amount);
  }
  const radius = (s: { position: readonly [number, number] }): number => Math.hypot(s.position[0] - 320, s.position[1] - 320);
  const inner = sites.filter((s) => radius(s) < 60), outer = sites.filter((s) => radius(s) > 110);
  const mean = (xs: typeof sites): number => xs.reduce((s, x) => s + x.amount, 0) / xs.length;
  assert.ok(inner.length && outer.length && mean(outer) > mean(inner) + 0.2, "the oldest cells lie inside");
  const lines = growthEquipotentialPaths(snaps, [0.25, 0.5, 0.75]);
  const region = growthOccupiedRegion(snaps), field = growthPotentialField(snaps);
  assert.ok(region.area > 1000 && field.n === n);
  const meanRadius = (level: number): number => {
    const own = lines.filter((p) => p.level === level).flatMap((p) => p.points);
    return own.reduce((s, p) => s + Math.hypot(p[0] - 320, p[1] - 320), 0) / own.length;
  };
  assert.ok(meanRadius(0.25) < meanRadius(0.5) && meanRadius(0.5) < meanRadius(0.75), "higher potential lies farther from the region");
  assert.equal(growthEquipotentialPaths(snaps, [0.25, 0.5, 0.75]), lines, "cached per run");
});

test("consumers are replaceable: callbacks receive the run's own fronts, bands and sites", () => {
  const r = recipe({ grid: 64, steps: 40, frontEvery: 5, fill: "bands", fillBands: 4, marks: "tips", potential: "lines", potentialLines: 2 });
  const products = laplacianFrontsProducts(r), last = growthLastActiveStep(products.snapshots);
  const seen = { front: [] as string[], finalFront: [] as string[], potential: 0, marks: 0, bands: [] as number[] };
  const surface = new Proxy({ CLOSE: 1, ROUND: 2 } as Record<string, unknown>, { get: (t, k: string) => (k in t ? t[k] : () => {}) });
  drawLaplacianFronts(surface as never, r, {
    front: (_s, path) => { seen.front.push(path.id); }, finalFront: (_s, path) => { seen.finalFront.push(path.id); },
    potential: () => { seen.potential++; }, mark: () => { seen.marks++; }, fill: (_s, _o, band) => { seen.bands.push(band.step); },
  });
  const steps = growthFrontSteps(last, r.fronts!);
  const expected = steps.slice(0, -1).flatMap((s) => growthFrontPaths(products.snapshots, s).map((p) => p.id.replace(/~s\d+$/, "")));
  assert.deepEqual(seen.front.map((id) => id.replace(/~s\d+$/, "")), expected);
  assert.deepEqual(seen.finalFront.map((id) => id.replace(/~s\d+$/, "")), growthFrontPaths(products.snapshots, steps[steps.length - 1]).map((p) => p.id));
  assert.deepEqual(seen.bands, growthBandSteps(last, 4).reverse(), "newest band first");
  assert.equal(seen.marks, growthTipSites(products.snapshots, r.marks!.threshold).length);
  assert.equal(seen.potential, growthEquipotentialPaths(products.snapshots, [1 / 3, 2 / 3]).length);
  assert.deepEqual(growthFrontSteps(10, { every: 4, from: 0, to: 1 }), [0, 4, 8, 10]);
  assert.deepEqual(growthBandSteps(10, 4), [3, 5, 8, 10]);
});

test("bounds and failures name the control to change", () => {
  const q = defaults();
  assert.throws(() => validateParameters("laplacian-fronts", { ...q, grid: 160, maxIterations: 2000, steps: 240 }), /Steps 240 × Grid 160² × Solver iterations 2000.*Lower Steps, Grid or Solver iterations/);
  assert.throws(() => validateParameters("laplacian-fronts", { ...q, frontFrom: 0.8, frontTo: 0.2 }), /First front/);
  assert.throws(() => validateParameters("laplacian-fronts", { ...q, seedShape: "torus" }), /seedShape/);
  assert.throws(() => laplacianFrontsProducts(recipe({ seedX: 0, seedY: 0, seedRadius: 6 })), /seed region is empty/);
  assert.throws(() => growthSnapshots(specWith({ grid: 100 }, { stepScale: 5 }), 1, 3), /Step size/);
  assert.throws(() => growthSnapshots(specWith({}), 1, 3000), /Steps must be/);
});
