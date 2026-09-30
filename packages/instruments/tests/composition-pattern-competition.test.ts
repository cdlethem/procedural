import assert from "node:assert/strict";
import test from "node:test";
import {
  canPrepareInstrument, checkSimulation, createInstrument, drawPatternCompetition, patternBands, patternCompetingFields, patternCompetitionComposition,
  patternContours, patternFrame, patternProducts, patternRecipeSnapshots, patternScales, patternSimulation, patternSites, patternSnapshots, patternView,
  prepareInstrument, preparePatternSnapshots, runSimulation, stateAt, usesSeed, validateInstrument, visibleParameters, PATTERN_LIMITS,
  type CompositionSurface, type PatternModel, type PatternSnapshots, type PatternState, type PatternSymmetry,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.js";

const near = (actual: number, expected: number, tolerance = 1e-9, note = "") =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);
const model = (over: Partial<PatternModel> = {}): PatternModel => ({
  resolution: 24, scales: 3, smallest: 1, ratio: 2, inhibitor: 2, increment: 0.05, tilt: 0.5, boundary: "wrap", symmetry: "none", tiles: 1,
  start: "noise", startSize: 0.5, startCount: 6, noise: 0.3, ...over,
});
const inputWith = (params: Record<string, number | string | boolean> = {}, seed = 42) => {
  const input = createInstrument("pattern-competition");
  input.seed = seed;
  Object.assign(input.params, params);
  return input;
};
const recipeWith = (params: Record<string, number | string | boolean> = {}, seed = 42) => patternCompetitionComposition(inputWith(params, seed));
const stateOf = (snaps: PatternSnapshots, step: number): PatternState => stateAt(snaps, step);

// ---------------------------------------------------------------------------------------------- an independent reference
// A deliberately naive statement of the rule in the header of pattern-competition.ts: nested loops, no running sums, orbits as sets.
const PASSES = 3;
const wrapIndex = (i: number, n: number, boundary: string): number | null => {
  if (i >= 0 && i < n) return i;
  if (boundary === "wrap") return ((i % n) + n) % n;
  if (boundary === "mirror") { let j = i; while (j < 0 || j >= n) j = j < 0 ? -j - 1 : 2 * n - 1 - j; return j; }
  return null;
};
function boxOnce(field: number[], n: number, r: number, boundary: string, axis: "x" | "y"): number[] {
  const out = new Array<number>(n * n).fill(0);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let sum = 0;
    for (let k = -r; k <= r; k++) {
      const at = wrapIndex((axis === "x" ? x : y) + k, n, boundary);
      if (at !== null) sum += axis === "x" ? field[y * n + at] : field[at * n + x];
    }
    out[y * n + x] = sum / (2 * r + 1);
  }
  return out;
}
function refBlur(field: number[], n: number, r: number, boundary: string): number[] {
  let f = field;
  for (let pass = 0; pass < PASSES; pass++) { f = boxOnce(f, n, r, boundary, "x"); f = boxOnce(f, n, r, boundary, "y"); }
  return f;
}
function refOrbits(n: number, tiles: number, symmetry: PatternSymmetry): number[][] {
  const w = n / tiles, centre = (w - 1) / 2;
  const rotate = (dx: number, dy: number, k: number): [number, number] => { for (let s = 0; s < k; s++) [dx, dy] = [-dy, dx]; return [dx, dy]; };
  const elements: ((dx: number, dy: number) => [number, number])[] = {
    none: [(dx: number, dy: number): [number, number] => [dx, dy]],
    mirror: [(dx: number, dy: number): [number, number] => [dx, dy], (dx: number, dy: number): [number, number] => [-dx, dy]],
    turn2: [0, 2].map((k) => (dx: number, dy: number) => rotate(dx, dy, k)),
    quad: [(dx: number, dy: number): [number, number] => [dx, dy], (dx: number, dy: number): [number, number] => [-dx, dy], (dx: number, dy: number): [number, number] => [dx, -dy], (dx: number, dy: number): [number, number] => [-dx, -dy]],
    turn4: [0, 1, 2, 3].map((k) => (dx: number, dy: number) => rotate(dx, dy, k)),
    dihedral: [0, 1, 2, 3].flatMap((k) => [(dx: number, dy: number) => rotate(dx, dy, k), (dx: number, dy: number) => { const [a, b] = rotate(dx, dy, k); return [-a, b] as [number, number]; }]),
  }[symmetry];
  const orbits: number[][] = new Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const tx = Math.floor(x / w) * w, ty = Math.floor(y / w) * w, members = new Set<number>();
    for (const e of elements) { const [a, b] = e(x - tx - centre, y - ty - centre); members.add((ty + Math.round(b + centre)) * n + tx + Math.round(a + centre)); }
    orbits[y * n + x] = [...members].sort((a, b) => a - b);
  }
  return orbits;
}
interface RefState { field: number[]; label: number[]; sign: number[] }
function refDominant(field: number[], n: number, m: PatternModel): { label: number[]; sign: number[] } {
  const scales = patternScales(m), label = new Array<number>(n * n).fill(0), sign = new Array<number>(n * n).fill(1), best = new Array<number>(n * n).fill(Infinity);
  for (const s of scales) {
    const a = refBlur(field, n, s.radius, m.boundary), b = refBlur(field, n, s.inhibitorRadius, m.boundary);
    for (let c = 0; c < n * n; c++) {
      const v = a[c] - b[c], magnitude = Math.abs(v) <= 1e-12 ? 0 : Math.abs(v);
      if (magnitude < best[c]) { best[c] = magnitude; label[c] = s.index; sign[c] = v >= -1e-12 ? 1 : -1; }
    }
  }
  return { label, sign };
}
function refFinish(field: number[], n: number, m: PatternModel): RefState {
  const orbits = refOrbits(n, m.tiles, m.symmetry);
  const mean = field.map((_, c) => orbits[c].reduce((sum, member) => sum + field[member], 0) / orbits[c].length);
  const lo = Math.min(...mean), hi = Math.max(...mean);
  const norm = mean.map((v) => 2 * (v - lo) / (hi - lo) - 1);
  const { label, sign } = refDominant(norm, n, m);
  return { field: norm, label: label.map((_, c) => label[orbits[c][0]]), sign: sign.map((_, c) => sign[orbits[c][0]]) };
}
function refStep(state: RefState, n: number, m: PatternModel): RefState {
  const scales = patternScales(m);
  return refFinish(state.field.map((v, c) => v + state.sign[c] * scales[state.label[c]].increment), n, m);
}

test("the scale set follows its stated rule: whole-cell radii at least one apart, inhibitors wider, increments 4^tilt coarse to fine", () => {
  const a = patternScales(model({ scales: 4, smallest: 2, ratio: 2, inhibitor: 2, resolution: 96 }));
  assert.deepEqual(a.map((s) => s.radius), [2, 4, 8, 16]);
  assert.deepEqual(a.map((s) => s.inhibitorRadius), [4, 8, 16, 32]);
  // 1, ceil(1.4) = 2, ceil(1.96) = 2 pushed to 3, ceil(2.744) = 3 pushed to 4.
  assert.deepEqual(patternScales(model({ scales: 4, smallest: 1, ratio: 1.4, inhibitor: 1.1, resolution: 48 })).map((s) => s.radius), [1, 2, 3, 4]);
  // A tiny inhibitor multiple still leaves the inhibitor one cell wider than its activator.
  assert.deepEqual(patternScales(model({ scales: 2, smallest: 2, ratio: 2, inhibitor: 1.1 })).map((s) => s.inhibitorRadius), [3, 5]);
  const flat = patternScales(model({ tilt: 0 })).map((s) => s.increment);
  assert.ok(flat.every((v) => v === 0.05));
  const tilted = patternScales(model({ tilt: 1, scales: 3, increment: 0.04 })).map((s) => s.increment);
  near(tilted[0], 0.02, 1e-15); near(tilted[1], 0.04, 1e-15); near(tilted[2], 0.08, 1e-15);
  near(tilted[2] / tilted[0], 4, 1e-12);
  const fine = patternScales(model({ tilt: -1, scales: 3, increment: 0.04 })).map((s) => s.increment);
  near(fine[0] / fine[2], 4, 1e-12);
});

test("every step equals an independent naive statement of the rule, for each boundary rule and symmetry", () => {
  const cases: Partial<PatternModel>[] = [
    { boundary: "wrap" }, { boundary: "mirror" }, { boundary: "void" },
    { boundary: "wrap", symmetry: "dihedral", tiles: 1 }, { boundary: "mirror", symmetry: "quad", tiles: 2 },
    { boundary: "void", symmetry: "turn4", tiles: 3 }, { boundary: "wrap", symmetry: "turn2", tiles: 4 }, { boundary: "mirror", symmetry: "mirror", tiles: 1, scales: 2 },
  ];
  for (const [index, over] of cases.entries()) {
    const m = model({ ...over, resolution: 24 }), n = m.resolution, snaps = patternSnapshots(m, 100 + index, 6);
    let ref: RefState = { field: Array.from(stateOf(snaps, 0).field), label: Array.from(stateOf(snaps, 0).label), sign: [] };
    // The reference starts from the published initial field; its own labels and signs must equal the published labels.
    ref = refFinish(ref.field, n, m);
    for (let k = 0; k <= 6; k++) {
      const got = stateOf(snaps, k);
      for (let c = 0; c < n * n; c++) near(got.field[c], ref.field[c], 1e-9, `${JSON.stringify(over)} step ${k} cell ${c}`);
      assert.deepEqual(Array.from(got.label), ref.label, `${JSON.stringify(over)} labels at step ${k}`);
      if (k < 6) ref = refStep(ref, n, m);
    }
  }
});

test("published competing fields are the activator-minus-inhibitor differences and the labels are their smallest magnitudes", () => {
  const m = model({ resolution: 32, scales: 4, smallest: 1, ratio: 1.6, boundary: "mirror" }), n = 32, snaps = patternSnapshots(m, 5, 12), view = patternView(snaps);
  const fields = patternCompetingFields(snaps);
  assert.equal(fields.length, 4);
  view.scales.forEach((s, i) => {
    const a = refBlur(Array.from(view.values), n, s.radius, "mirror"), b = refBlur(Array.from(view.values), n, s.inhibitorRadius, "mirror");
    for (let c = 0; c < n * n; c++) near(fields[i][c], a[c] - b[c], 1e-10, `scale ${i} cell ${c}`);
  });
  for (let c = 0; c < n * n; c++) {
    let best = 0;
    for (let i = 1; i < 4; i++) if (Math.abs(fields[i][c]) < Math.abs(fields[best][c]) - 1e-12) best = i;
    assert.equal(view.labels[c], best, `cell ${c}`);
  }
  near(view.shares.reduce((x, y) => x + y, 0), 1, 1e-12);
  assert.equal(patternCompetingFields(snaps), fields, "cached on the snapshot");
});

test("every non-constant state spans exactly [-1, 1] after every step, whatever the increments", () => {
  for (const over of [{}, { increment: 0.5 }, { increment: 0.0002, tilt: 3 }, { start: "spots" as const, boundary: "void" as const }, { symmetry: "quad" as const }]) {
    const snaps = patternSnapshots(model(over), 3, 10);
    for (let k = 0; k <= 10; k++) {
      const { field } = stateOf(snaps, k);
      assert.equal(Math.min(...field), -1, `${JSON.stringify(over)} min at ${k}`);
      assert.equal(Math.max(...field), 1, `${JSON.stringify(over)} max at ${k}`);
    }
  }
});

test("a symmetry constraint holds exactly, tile by tile, on both field and labels; without it the field is not symmetric", () => {
  const images: Record<Exclude<PatternSymmetry, "none">, ((x: number, y: number, w: number) => [number, number])[]> = {
    mirror: [(x, y, w) => [w - 1 - x, y]],
    turn2: [(x, y, w) => [w - 1 - x, w - 1 - y]],
    quad: [(x, y, w) => [w - 1 - x, y], (x, y, w) => [x, w - 1 - y]],
    turn4: [(x, y, w) => [w - 1 - y, x]],
    dihedral: [(x, y, w) => [w - 1 - y, x], (x, y, w) => [w - 1 - x, y]],
  };
  const symmetric = (field: ArrayLike<number>, n: number, tiles: number, symmetry: Exclude<PatternSymmetry, "none">): boolean => {
    const w = n / tiles;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (const g of images[symmetry]) {
      const tx = Math.floor(x / w) * w, ty = Math.floor(y / w) * w, [gx, gy] = g(x - tx, y - ty, w);
      if (!Object.is(field[y * n + x], field[(ty + gy) * n + tx + gx])) return false;
    }
    return true;
  };
  for (const symmetry of Object.keys(images) as Exclude<PatternSymmetry, "none">[]) for (const tiles of [1, 2]) {
    const snaps = patternSnapshots(model({ symmetry, tiles }), 8, 9);
    for (const k of [0, 1, 5, 9]) {
      const s = stateOf(snaps, k);
      assert.ok(symmetric(s.field, 24, tiles, symmetry), `${symmetry} x${tiles} field at ${k}`);
      assert.ok(symmetric(s.label, 24, tiles, symmetry), `${symmetry} x${tiles} labels at ${k}`);
    }
  }
  const free = stateOf(patternSnapshots(model(), 8, 9), 9).field;
  for (const symmetry of Object.keys(images) as Exclude<PatternSymmetry, "none">[]) assert.ok(!symmetric(free, 24, 1, symmetry), `unconstrained field is not ${symmetry}`);
});

test("the model respects a symmetry it is not forced to: a centred disc evolves alike with and without the constraint", () => {
  const free = model({ start: "disc", noise: 0, startSize: 0.6, boundary: "wrap", resolution: 32 });
  const forced = { ...free, symmetry: "dihedral" as const };
  const a = patternSnapshots(free, 1, 12), b = patternSnapshots(forced, 1, 12);
  for (const k of [1, 4, 12]) {
    const x = stateOf(a, k), y = stateOf(b, k);
    for (let c = 0; c < 32 * 32; c++) near(x.field[c], y.field[c], 1e-9, `step ${k} cell ${c}`);
  }
  assert.notEqual(patternSnapshots(free, 1, 12), patternSnapshots({ ...free, boundary: "void" }, 1, 12));
});

test("the update commutes with translation (wrap) and with reflection and transposition (every boundary rule)", () => {
  const n = 24;
  const run = (m: PatternModel, place: ((i: number, j: number) => [number, number]) | null) => {
    const sim = { ...patternSimulation, initial: (ctx: Parameters<typeof patternSimulation.initial>[0]): PatternState => {
      const s = patternSimulation.initial(ctx);
      if (!place) return s;
      const field = new Float64Array(n * n), label = new Uint8Array(n * n), sign = new Int8Array(n * n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const [a, b] = place(i, j); field[b * n + a] = s.field[j * n + i]; label[b * n + a] = s.label[j * n + i]; sign[b * n + a] = s.sign[j * n + i]; }
      return { ...s, field, label, sign };
    } };
    return stateAt(runSimulation(sim, m, 21, { steps: 7, checkpointEvery: 0, historyEvery: 0 }), 7);
  };
  const moves: [string, (i: number, j: number) => [number, number], string[]][] = [
    ["shift", (i, j) => [(i + 5) % n, (j + 9) % n], ["wrap"]],
    ["reflect", (i, j) => [n - 1 - i, j], ["wrap", "mirror", "void"]],
    ["transpose", (i, j) => [j, i], ["wrap", "mirror", "void"]],
  ];
  for (const [name, place, boundaries] of moves) for (const boundary of boundaries) {
    const m = model({ boundary: boundary as PatternModel["boundary"] }), base = run(m, null), moved = run(m, place);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const [a, b] = place(i, j);
      near(moved.field[b * n + a], base.field[j * n + i], 1e-8, `${name} ${boundary} (${i},${j})`);
      assert.equal(moved.label[b * n + a], base.label[j * n + i], `${name} ${boundary} label (${i},${j})`);
    }
  }
});

test("the foundation guarantees hold for the model: replay, prefix, resume, spacing and cancellation invariance", () => {
  checkSimulation(patternSimulation, model(), 7, 9, { checkpointSpacings: [0, 2, 4] });
  checkSimulation(patternSimulation, model({ symmetry: "dihedral", tiles: 2, boundary: "mirror", start: "spots" }), 1234567, 7, { checkpointSpacings: [1, 3] });
});

test("a flat region takes the finest scale and a positive sign; a symmetrised start is the normalised orbit mean of the free start", () => {
  // Far from a small disc every blur of the constant background agrees: the tie goes to scale 0 and +1, whatever rounding says.
  const m = model({ resolution: 96, scales: 2, smallest: 1, ratio: 2, inhibitor: 2, start: "disc", noise: 0, startSize: 0.15 });
  const s0 = stateOf(patternSnapshots(m, 1, 0), 0);
  for (const c of [0, 95, 96 * 95, 96 * 96 - 1, 96 * 90 + 3]) { assert.equal(s0.label[c], 0, `cell ${c}`); assert.equal(s0.sign[c], 1, `cell ${c}`); }
  assert.ok(s0.label.some((l) => l === 1), "near the disc the coarser scale does win somewhere");
  // Symmetrising is the orbit mean (then normalised), not a copy of one member: normalisation is affine, so it commutes with the mean.
  for (const symmetry of ["mirror", "turn2", "quad", "turn4", "dihedral"] as const) for (const tiles of [1, 2]) {
    const free = stateOf(patternSnapshots(model({ resolution: 24 }), 5, 0), 0).field, forced = stateOf(patternSnapshots(model({ resolution: 24, symmetry, tiles }), 5, 0), 0).field;
    const orbits = refOrbits(24, tiles, symmetry), mean = Array.from(free, (_, c) => orbits[c].reduce((sum, member) => sum + free[member], 0) / orbits[c].length);
    const lo = Math.min(...mean), hi = Math.max(...mean);
    for (let c = 0; c < 24 * 24; c++) near(forced[c], 2 * (mean[c] - lo) / (hi - lo) - 1, 1e-12, `${symmetry} x${tiles} cell ${c}`);
  }
});

test("initial fields: disc and ring are exact, spots and noise are seeded per cell, an empty start is constant", () => {
  const n = 32, centre = (n - 1) / 2;
  const disc = stateOf(patternSnapshots(model({ resolution: n, start: "disc", noise: 0, startSize: 0.5 }), 9, 0), 0).field;
  const R = 0.5 * n / 2;
  let inside = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const d = Math.hypot(i - centre, j - centre), want = d <= R ? 1 : -1;
    assert.equal(disc[j * n + i], want, `disc (${i},${j})`);
    inside += want > 0 ? 1 : 0;
  }
  assert.ok(Math.abs(inside - Math.PI * R * R) < 0.06 * Math.PI * R * R, `disc area ${inside}`);
  const ring = stateOf(patternSnapshots(model({ resolution: n, start: "ring", noise: 0, startSize: 0.8 }), 9, 0), 0).field, RR = 0.8 * n / 2, half = Math.max(1.5, 0.15 * RR);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) assert.equal(ring[j * n + i], Math.abs(Math.hypot(i - centre, j - centre) - RR) <= half ? 1 : -1, `ring (${i},${j})`);
  // Same construction, same bits; another seed or a different spot count is a different field; a disc without noise ignores the seed.
  const spots = (seed: number, count: number) => Array.from(stateOf(patternSnapshots(model({ start: "spots", startCount: count, noise: 0 }), seed, 0), 0).field).join();
  assert.equal(spots(4, 5), spots(4, 5));
  assert.notEqual(spots(4, 5), spots(5, 5));
  assert.notEqual(spots(4, 5), spots(4, 6));
  const noisy = (seed: number) => Array.from(stateOf(patternSnapshots(model(), seed, 3), 3).field).join();
  assert.notEqual(noisy(1), noisy(2));
  const flat = model({ start: "spots", startCount: 0, noise: 0 });
  assert.equal(patternView(patternSnapshots(flat, 1, 0)).inert, true);
});

test("a constant field is the explicit termination: frozen, inert, cheap and empty for every consumer", () => {
  const empty = model({ start: "disc", startSize: 0, noise: 0, resolution: 24 });
  const live = model({ resolution: 24 });
  const stopped = patternSnapshots(empty, 1, 40), running = patternSnapshots(live, 1, 40);
  const view = patternView(stopped);
  assert.equal(view.inert, true);
  assert.equal(view.activity, 0);
  for (const k of [0, 1, 17, 40]) assert.ok(stateOf(stopped, k).field.every((v) => v === 0) && stateOf(stopped, k).inert, `step ${k}`);
  assert.ok(stopped.work < running.work / 20, `inert steps charge a scan, not a step: ${stopped.work} against ${running.work}`);
  const frame = patternFrame(320, 320, 400);
  assert.equal(patternContours(stopped, frame, { levels: [-0.5, 0, 0.5], minLength: 0 }).length, 0);
  assert.equal(patternSites(stopped, frame, { level: -1, size: 10, gap: 1 }).length, 0);
  assert.equal(patternBands(stopped, frame, { level: -0.9, smoothing: 0, minArea: 0 }).length, 0);
  // A live field is never inert, and a noise start that normalises to +-1 keeps spanning both.
  assert.equal(patternView(running).inert, false);
  const painted: string[] = [];
  const spy = new Proxy({ CLOSE: 1, ROUND: 2 } as Record<string, unknown>, { get: (t, k: string) => k in t ? t[k] : (...a: unknown[]) => { painted.push(k); void a; } }) as unknown as CompositionSurface;
  drawPatternCompetition(spy, recipeWith({ start: "disc", startSize: 0, noise: 0, marks: true, markLevel: -1, bandLevel: -0.9 }));
  assert.ok(!painted.some((op) => ["circle", "line", "endShape", "rect", "vertex"].includes(op)), "nothing is drawn");
});

test("appearance edits repaint the same snapshot and products; initial conditions genuinely recompute", () => {
  const base = recipeWith();
  const snaps = patternRecipeSnapshots(base), products = patternProducts(base, snaps);
  const repaint = { ...inputWith(), palette: [0x111111, 0x222222, 0x333333], params: { ...inputWith().params, bandOpacity: 0.3, contourColor: "level", lineKind: "stitch", lineWeight: 2, marks: false, markColor: "single", bandSmoothing: 1 } };
  const again = patternCompetitionComposition(repaint);
  assert.equal(patternRecipeSnapshots(again), snaps, "same snapshot object");
  const second = patternProducts(again, snaps);
  assert.equal(second.paths, products.paths, "contours are not rebuilt for a colour or material edit");
  assert.equal(second.bands, products.bands, "bands are not rebuilt for an opacity edit");
  const marked = patternProducts(recipeWith({ marks: true }), snaps), other = patternProducts(recipeWith({ marks: true, markKind: "rings", markVariation: 0.5, markRetention: 0.5, markColor: "single" }), snaps);
  assert.equal(other.sites, marked.sites, "a mark edit keeps the same sites");
  // Steps extend the run rather than replacing its construction: earlier states are the same values.
  const longer = patternRecipeSnapshots(recipeWith({ steps: 150 }));
  assert.notEqual(longer, snaps);
  assert.deepEqual(stateOf(longer, 120).field, stateOf(snaps, 120).field);
  // Initial-condition edits change the key and the result.
  const finals = new Set<string>();
  for (const change of [{}, { seed: 9 }, { start: "spots" }, { start: "disc" }, { start: "ring" }, { noise: 0.5, start: "disc" }, { startSize: 0.8, start: "disc" }, { boundary: "mirror" }, { symmetry: "quad" }, { tilt: -1 }, { ratio: 2.2 }]) {
    const { seed = 42, ...params } = change as Record<string, number | string>;
    const r = recipeWith(params, seed);
    finals.add(Array.from(patternView(patternRecipeSnapshots(r)).values).join());
  }
  assert.equal(finals.size, 11, "each meaningful edit yields its own field");
  // A control hidden by the start kind is not read: a noise start ignores the shape settings and is one cached result.
  const fresh = patternRecipeSnapshots(recipeWith());
  assert.equal(patternRecipeSnapshots(recipeWith({ start: "noise", startSize: 1, startCount: 20, noise: 1 })), fresh);
  assert.equal(patternRecipeSnapshots(recipeWith({ symmetry: "none", tiles: 3 })), fresh);
});

test("cancellation, in slices or at the start, publishes and caches nothing; the retry equals a fresh run", async () => {
  const m = model({ resolution: 32, scales: 4, smallest: 1, ratio: 1.6 });
  assert.equal(await preparePatternSnapshots(m, 77, 30, () => true), null);
  let polls = 0;
  assert.equal(await preparePatternSnapshots(m, 77, 30, () => ++polls > 12), null);
  assert.ok(polls > 12);
  const once = await preparePatternSnapshots(m, 77, 30, () => false);
  assert.ok(once);
  assert.equal(patternSnapshots(m, 77, 30), once, "now cached");
  const fresh = runSimulation(patternSimulation, m, 77, { steps: 30, checkpointEvery: 25, historyEvery: 0 });
  assert.deepEqual(Array.from(patternView(once!).values), Array.from((fresh.final as { field: Float64Array }).field));
});

test("contours: every vertex lies where the field equals its level; a disc's level line is one loop of the right length", () => {
  const m = model({ resolution: 48, scales: 3, smallest: 2, ratio: 2, boundary: "wrap", tilt: 0 }), snaps = patternSnapshots(m, 6, 25), view = patternView(snaps), n = 48;
  const frame = patternFrame(300, 340, 480), h = frame.size / n;
  const levels = [-0.4, 0, 0.35];
  const paths = patternContours(snaps, frame, { levels, minLength: 0 });
  assert.ok(paths.length > 5);
  const at = (i: number, j: number): number => {
    const ci = ((i % n) + n) % n, cj = ((j % n) + n) % n;
    return view.values[cj * n + ci];
  };
  let checked = 0;
  for (const path of paths) for (const [x, y] of path.points) {
    if (Math.abs(x - frame.left) < 1e-6 || Math.abs(y - frame.top) < 1e-6 || Math.abs(x - frame.left - frame.size) < 1e-6 || Math.abs(y - frame.top - frame.size) < 1e-6) continue;
    const fx = (x - frame.left) / h - 0.5, fy = (y - frame.top) / h - 0.5;
    const onRow = Math.abs(fy - Math.round(fy)) < 1e-7, onColumn = Math.abs(fx - Math.round(fx)) < 1e-7;
    assert.ok(onRow || onColumn, `vertex ${x},${y} is on a grid line`);
    let value: number;
    if (onRow) { const j = Math.round(fy), i = Math.floor(fx), t = fx - i; value = at(i, j) * (1 - t) + at(i + 1, j) * t; }
    else { const i = Math.round(fx), j = Math.floor(fy), t = fy - j; value = at(i, j) * (1 - t) + at(i, j + 1) * t; }
    near(value, path.level, 1e-9, `${path.id} at ${x},${y}`);
    checked++;
  }
  assert.ok(checked > 1000);
  assert.ok(paths.every((p) => levels.includes(p.level)) && paths.every((p) => p.tone === p.scale && p.scale >= 0 && p.scale < 3));
  assert.equal(new Set(paths.map((p) => p.id)).size, paths.length, "ids are unique");
  // A binary disc at step 0: the level 0 line is one closed loop around it, of about the digital circle's perimeter.
  const disc = patternSnapshots(model({ resolution: 64, start: "disc", noise: 0, startSize: 0.5, scales: 2 }), 1, 0), f = patternFrame(320, 320, 640);
  const loops = patternContours(disc, f, { levels: [0], minLength: 0 });
  assert.equal(loops.length, 1);
  assert.equal(loops[0].closed, true);
  let length = 0;
  const pts = loops[0].points;
  for (let i = 0; i < pts.length; i++) length += Math.hypot(pts[i][0] - pts[(i + 1) % pts.length][0], pts[i][1] - pts[(i + 1) % pts.length][1]);
  const perimeter = 2 * Math.PI * (0.5 * 64 / 2) * (640 / 64);
  assert.ok(Math.abs(length - perimeter) < 0.07 * perimeter, `loop ${length} against circle ${perimeter}`);
  // Levels outside (-1, 1) name the control.
  assert.throws(() => patternContours(disc, f, { levels: [1], minLength: 0 }), /Level spread or Level center/);
  // minLength drops pieces below that many cells and keeps the rest unchanged.
  const long = patternContours(snaps, frame, { levels, minLength: 6 });
  assert.ok(long.length < paths.length && long.length > 0);
});

test("bands: cell boundaries give exact areas, scales partition the high cells and smoothing keeps topology", () => {
  const n = 40, m = model({ resolution: n, scales: 3, smallest: 2, tilt: 0 }), snaps = patternSnapshots(m, 12, 40), view = patternView(snaps), frame = patternFrame(300, 300, 400), h = frame.size / n;
  const level = 0.1, bands = patternBands(snaps, frame, { level, smoothing: 0, minArea: 0 });
  const perScale = [0, 0, 0];
  for (let c = 0; c < n * n; c++) if (view.values[c] >= level) perScale[view.labels[c]]++;
  let total = 0;
  for (const band of bands) { near(band.domain.area, perScale[band.scale] * h * h, 1e-6 * h * h, `scale ${band.scale} area`); total += band.domain.area; }
  near(total, perScale.reduce((a, b) => a + b, 0) * h * h, 1e-6);
  assert.deepEqual(bands.map((b) => b.scale), [0, 1, 2].filter((s) => perScale[s] > 0));
  for (const band of bands) for (const region of band.domain.regions) for (const [x, y] of region.outer)
    assert.ok(x >= frame.left - 1e-9 && x <= frame.left + frame.size + 1e-9 && y >= frame.top - 1e-9 && y <= frame.top + frame.size + 1e-9);
  // Smoothing thins vertices without moving any by more than its tolerance in area terms; minArea drops specks and fills tiny holes.
  const smooth = patternBands(snaps, frame, { level, smoothing: 1, minArea: 0 });
  const count = (list: typeof bands) => list.reduce((s, b) => s + b.domain.regions.reduce((t, r) => t + r.outer.length + r.holes.reduce((u, ring) => u + ring.length, 0), 0), 0);
  assert.ok(count(smooth) < count(bands) * 0.7, `smoothing thins vertices: ${count(smooth)} of ${count(bands)}`);
  const cleaned = patternBands(snaps, frame, { level, smoothing: 0, minArea: 6 });
  assert.ok(cleaned.reduce((s, b) => s + b.domain.regions.length, 0) < bands.reduce((s, b) => s + b.domain.regions.length, 0));
  for (const band of cleaned) for (const region of band.domain.regions) assert.ok(region.area >= 6 * h * h - 1e-9);
});

test("marks: a maximal greedy packing on the peaks, sized by scale radius, with ids, tones and contour-following angles", () => {
  const n = 48, m = model({ resolution: n, scales: 4, smallest: 1, ratio: 1.7, boundary: "wrap" }), snaps = patternSnapshots(m, 3, 60), view = patternView(snaps);
  const frame = patternFrame(320, 320, 480), h = frame.size / n, options = { level: 0.2, size: 24, gap: 1.1 };
  const sites = patternSites(snaps, frame, options);
  assert.ok(sites.length > 30);
  const coarsest = view.scales[3].radius;
  const diameter = (k: number) => options.size * view.scales[k].radius / coarsest;
  for (const s of sites) {
    assert.equal(s.id, `cell:${s.cell}`);
    assert.ok(s.value >= options.level && s.value === view.values[s.cell]);
    assert.equal(s.tone, view.labels[s.cell]);
    near(s.diameter, diameter(s.scaleIndex), 1e-12);
    near(s.scale * options.size, s.diameter, 1e-12);
    near(s.position[0], frame.left + ((s.cell % n) + 0.5) * h, 1e-9);
  }
  assert.deepEqual(sites.map((s) => s.cell), [...sites.map((s) => s.cell)].sort((a, b) => a - b));
  const conflict = (a: { position: readonly [number, number] }, ka: number, b: { position: readonly [number, number] }, kb: number) =>
    Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1]) < options.gap * (diameter(ka) + diameter(kb)) / 2;
  for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++)
    assert.ok(!conflict(sites[i], sites[i].scaleIndex, sites[j], sites[j].scaleIndex), `sites ${i} and ${j} keep their gap`);
  // Maximal: every cell above the level that carries no mark lies within the gap of one that does.
  const chosen = new Set(sites.map((s) => s.cell));
  for (let c = 0; c < n * n; c++) {
    if (view.values[c] < options.level || chosen.has(c)) continue;
    const p = { position: [frame.left + ((c % n) + 0.5) * h, frame.top + (Math.floor(c / n) + 0.5) * h] as const };
    assert.ok(sites.some((s) => conflict(p, view.labels[c], s, s.scaleIndex)), `cell ${c} is blocked`);
  }
  // The highest cell is the first candidate and is always accepted.
  const top = view.values.indexOf(Math.max(...view.values));
  assert.ok(chosen.has(top));
  // Angle is the level line through the cell: perpendicular to the wrapped central-difference gradient.
  const v = (i: number, j: number) => view.values[((j + n) % n) * n + ((i + n) % n)];
  for (const s of sites.slice(0, 40)) {
    const i = s.cell % n, j = Math.floor(s.cell / n), gx = v(i + 1, j) - v(i - 1, j), gy = v(i, j + 1) - v(i, j - 1);
    if (Math.hypot(gx, gy) < 1e-12) { assert.equal(s.angle, 0); continue; }
    near(Math.cos(s.angle) * gx + Math.sin(s.angle) * gy, 0, 1e-9, "tangent is perpendicular to the gradient");
  }
  // A larger gap only removes marks it forbids: more room, fewer marks; the packing is deterministic.
  assert.ok(patternSites(snaps, frame, { ...options, gap: 1.6 }).length < sites.length);
  assert.equal(patternSites(snaps, frame, options), sites);
  assert.throws(() => patternSites(snaps, frame, { level: 0.2, size: 0, gap: 1 }), /Mark size/);
});

test("the hierarchy is real: the coarsest scale's patches are larger than the finest's, and scale coupling changes the field independently of colour", () => {
  const n = 96, patchAreas = (seed: number) => {
    const view = patternView(patternSnapshots(model({ resolution: n, scales: 4, smallest: 2, ratio: 2, inhibitor: 2, increment: 0.03, tilt: 0.5 }), seed, 120));
    const seen = new Uint8Array(n * n), areas: number[][] = [[], [], [], []];
    for (let c0 = 0; c0 < n * n; c0++) {
      if (seen[c0]) continue;
      const k = view.labels[c0], stack = [c0];
      let area = 0;
      seen[c0] = 1;
      while (stack.length) {
        const c = stack.pop()!;
        area++;
        const i = c % n, j = Math.floor(c / n);
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const next = ((j + b + n) % n) * n + (i + a + n) % n;
          if (!seen[next] && view.labels[next] === k) { seen[next] = 1; stack.push(next); }
        }
      }
      areas[k].push(area);
    }
    return { view, mean: areas.map((list) => list.reduce((s, v) => s + v, 0) / list.length) };
  };
  for (const seed of [1, 2, 3, 42]) {
    const { view, mean } = patchAreas(seed);
    assert.ok(mean[3] > 1.5 * mean[0], `seed ${seed}: coarsest patches average ${mean[3].toFixed(1)} cells, finest ${mean[0].toFixed(1)}`);
    assert.ok(view.shares.every((s) => s > 0.05), `seed ${seed}: every scale holds ground: ${view.shares.map((s) => s.toFixed(2))}`);
  }
  // Structure depends on the coupling (weights, reach, ratio) and not on any colour setting.
  const key = (over: Partial<PatternModel>) => Array.from(patternView(patternSnapshots(model({ resolution: 48, ...over }), 5, 60)).labels).join("");
  const base = key({});
  for (const over of [{ tilt: -1.5 }, { tilt: 2 }, { inhibitor: 3 }, { ratio: 3 }, { increment: 0.1 }]) assert.notEqual(key(over), base, JSON.stringify(over));
  assert.equal(drawFingerprint({ ...inputWith(), palette: [1, 2, 3, 4, 5] }) === drawFingerprint(inputWith()), false, "colours are drawn");
  const a = patternRecipeSnapshots(recipeWith()), b = patternRecipeSnapshots(patternCompetitionComposition({ ...inputWith(), palette: [9, 8, 7, 6, 5] }));
  assert.equal(a, b);
});

test("limits and failures name the control to change", () => {
  assert.throws(() => patternSnapshots(model({ resolution: 20 }), 1, 1), /Resolution must be an integer between 24 and 192/);
  assert.throws(() => patternSnapshots(model({ symmetry: "quad", tiles: 5 }), 1, 1), /Symmetry tiles must be an integer between 1 and 4/);
  assert.throws(() => patternSnapshots(model({ resolution: 50, symmetry: "quad", tiles: 4 }), 1, 1), /Symmetry tiles 4 must divide Resolution 50/);
  assert.throws(() => patternScales(model({ scales: 1 })), /Scales must be an integer between 2 and 8/);
  assert.throws(() => patternScales(model({ resolution: 24, scales: 6, smallest: 2, ratio: 2 })), /Scale \d needs an inhibitor radius of \d+ cells, more than twice Resolution 24; lower Scales/);
  assert.throws(() => patternSnapshots(model(), 1, PATTERN_LIMITS.maxSteps + 1), /Steps must be an integer between 0 and 2000/);
  assert.throws(() => patternSnapshots(model({ increment: 0 }), 1, 1), /Increment/);
  assert.throws(() => patternSnapshots(model({ ratio: 9 }), 1, 1), /Scale ratio/);
  assert.throws(() => patternSnapshots(model({ resolution: 192, scales: 8, smallest: 1, ratio: 1.3, inhibitor: 2 }), 1, 2000), /Steps|Resolution|Scales/);
  assert.throws(() => patternSnapshots(model({ start: "hexagon" as never }), 1, 1), /Start must be one of/);
  assert.throws(() => recipeWith({ resolution: 90, symmetry: "quad", tiles: 4 }) && patternRecipeSnapshots(recipeWith({ resolution: 90, symmetry: "quad", tiles: 4 })), /must divide Resolution 90/);
  assert.throws(() => validateInstrument({ ...inputWith(), params: { ...inputWith().params, steps: 5000 } }), /steps/);
  assert.throws(() => patternCompetitionComposition({ ...inputWith(), technique: "nodal-plates" }), /Not a pattern-competition input/);
  assert.throws(() => drawFingerprint(inputWith({ levelCenter: 0.9, levelSpread: 0.9, levelCount: 9 })), /strictly between -1 and 1/);
});

test("hidden controls never change a drawing, visible ones do, and the seed matters only where chance is used", () => {
  const small = { resolution: 48, steps: 30 };
  const same = (a: Record<string, number | string | boolean>, b: Record<string, number | string | boolean>, note: string, seedA = 42, seedB = 42) =>
    assert.equal(drawFingerprint(inputWith({ ...small, ...a }, seedA)), drawFingerprint(inputWith({ ...small, ...b }, seedB)), note);
  const differs = (a: Record<string, number | string | boolean>, b: Record<string, number | string | boolean>, note: string) =>
    assert.notEqual(drawFingerprint(inputWith({ ...small, ...a })), drawFingerprint(inputWith({ ...small, ...b })), note);
  const hidden = (params: Record<string, number | string | boolean>) => (key: string) => !visibleParameters("pattern-competition", { ...createInstrument("pattern-competition").params, ...params }).some((p) => p.key === key);
  const noise = hidden({ start: "noise" });
  assert.ok(noise("startSize") && noise("startCount") && noise("noise"));
  same({ start: "noise", startSize: 0.2, startCount: 3, noise: 0.9 }, { start: "noise" }, "shape settings under a noise start");
  same({ symmetry: "none", tiles: 4 }, { symmetry: "none", tiles: 1 }, "tiles without symmetry");
  same({ start: "disc", startCount: 3 }, { start: "disc", startCount: 17 }, "spot count for a disc");
  same({ bands: false, bandLevel: 0.4, bandSmoothing: 0, bandMinArea: 9, bandOpacity: 0.1 }, { bands: false }, "band settings with bands off");
  same({ contours: false, levelCount: 7, levelCenter: 0.2, contourMin: 9, contourColor: "level", lineKind: "beads", lineWeight: 3 }, { contours: false }, "contour settings with contours off");
  same({ marks: false, markKind: "arrow", markSize: 30, markGap: 2, markLevel: 0.7, markRetention: 0.3, markColor: "single" }, { marks: false }, "mark settings with marks off");
  same({ marks: true, markKind: "dot", markPetals: 12, markOpening: 0.9, markWeight: 3, markAlign: true }, { marks: true, markKind: "dot" }, "petals, opening, weight and follow for dots");
  same({ marks: true, markKind: "rings", markPetals: 12, markAlign: true }, { marks: true, markKind: "rings" }, "petals and follow for rings");
  same({ lineKind: "ink", lineSpacing: 20, lineBead: 9 }, { lineKind: "ink" }, "stitch spacing and beads for ink");
  // Visible controls reach the drawing.
  for (const change of [{ scales: 3 }, { smallest: 2 }, { ratio: 2.2 }, { inhibitor: 2.6 }, { increment: 0.06 }, { tilt: -1 }, { start: "ring" }, { steps: 45 }, { resolution: 36 }, { boundary: "void" },
    { symmetry: "turn4" }, { centerX: 300 }, { size: 400 }, { bandLevel: 0.3 }, { bandSmoothing: 0 }, { bandMinArea: 20 }, { bandOpacity: 0.4 }, { levelCount: 5 }, { levelCenter: 0.2 }, { levelSpread: 0.3 },
    { contourMin: 12 }, { contourColor: "scale" }, { lineKind: "stitch" }, { lineWeight: 2 }, { bands: false }, { contours: false }, { marks: true }])
    differs({}, change, JSON.stringify(change));
  differs({ start: "spots" }, { start: "spots", startCount: 3 }, "spot count");
  differs({ start: "disc" }, { start: "disc", startSize: 0.9 }, "disc size");
  differs({ start: "disc" }, { start: "disc", noise: 0.6 }, "disc noise");
  differs({ symmetry: "quad" }, { symmetry: "quad", tiles: 2 }, "tiles");
  differs({ marks: true }, { marks: true, markKind: "rings" }, "mark kind");
  differs({ marks: true }, { marks: true, markSize: 24 }, "mark size");
  differs({ marks: true }, { marks: true, markGap: 1.6 }, "mark gap");
  differs({ marks: true }, { marks: true, markLevel: 0.6 }, "mark level");
  differs({ marks: true, markKind: "arrow" }, { marks: true, markKind: "arrow", markAlign: true }, "arrow follow");
  differs({ marks: true, markKind: "rosette" }, { marks: true, markKind: "rosette", markPetals: 9 }, "petals");
  differs({ lineKind: "stitch" }, { lineKind: "stitch", lineSpacing: 16 }, "stitch spacing");
  differs({ lineKind: "beads" }, { lineKind: "beads", lineBead: 6 }, "bead size");
  // The seed is used exactly where the declaration says.
  for (const [params, uses] of [[{}, true], [{ start: "spots" }, true], [{ start: "disc", noise: 0 }, false], [{ start: "ring", noise: 0.2 }, true], [{ start: "spots", startCount: 3 }, true]] as const) {
    assert.equal(usesSeed(inputWith(params)), uses, JSON.stringify(params));
    assert.equal(drawFingerprint(inputWith({ ...small, ...params }, 1)) !== drawFingerprint(inputWith({ ...small, ...params }, 2)), uses, `seed effect ${JSON.stringify(params)}`);
  }
});

test("the layer is transparent and preparation warms exactly what drawing then reads", async () => {
  const painted: string[] = [];
  const spy = new Proxy({ CLOSE: 1, ROUND: 2 } as Record<string, unknown>, { get: (t, k: string) => k in t ? t[k] : (...a: unknown[]) => { painted.push(`${k}(${a.length})`); } }) as unknown as CompositionSurface;
  drawPatternCompetition(spy, recipeWith({ marks: true, markKind: "rosette" }));
  assert.ok(painted.some((op) => op.startsWith("beginShape")) && painted.some((op) => op.startsWith("line")) && painted.some((op) => op.startsWith("circle")));
  assert.ok(!painted.some((op) => op.startsWith("background") || op.startsWith("rect") || op.startsWith("clear")), "no paper, no full-canvas rectangle");
  assert.equal(canPrepareInstrument("pattern-competition"), true);
  const input = inputWith({ resolution: 60, scales: 3, steps: 37, marks: true }, 314);
  assert.equal(await prepareInstrument(input, () => true), false);
  const recipe = patternCompetitionComposition(input);
  let polls = 0;
  assert.equal(await prepareInstrument(input, () => ++polls > 6), false);
  assert.equal(await prepareInstrument(input, () => false), true);
  const snaps = patternRecipeSnapshots(recipe), products = patternProducts(recipe, snaps);
  assert.equal(patternProducts(recipe, patternRecipeSnapshots(recipe)).paths, products.paths, "drawing reuses what preparation built");
  assert.equal(products.sites.length > 0 && products.bands.length > 0 && products.paths.length > 0, true);
});

test("consumers are replaceable and receive the same frozen values", () => {
  const recipe = recipeWith({ marks: true, markLevel: 0.2 }), snaps = patternRecipeSnapshots(recipe), products = patternProducts(recipe, snaps);
  const bands: unknown[] = [], lines: unknown[] = [], marks: unknown[] = [];
  const surface = new Proxy({ CLOSE: 1, ROUND: 2 } as Record<string, unknown>, { get: (t, k: string) => k in t ? t[k] : () => {} }) as unknown as CompositionSurface;
  drawPatternCompetition(surface, recipe, {
    band: (_s, band) => { bands.push(band); },
    line: (_s, path) => { lines.push(path); },
    mark: (_s, site) => { marks.push(site); },
  });
  assert.deepEqual(bands, [...products.bands]);
  assert.equal(lines.length, products.paths.length);
  assert.equal(marks.length, products.sites.length);
  assert.ok((lines as { id: string }[]).every((p, i) => p.id === products.paths[i].id));
  assert.ok(Object.isFrozen(products.paths) && Object.isFrozen(products.paths[0]) && Object.isFrozen(products.sites[0]) && Object.isFrozen(products.bands));
});
