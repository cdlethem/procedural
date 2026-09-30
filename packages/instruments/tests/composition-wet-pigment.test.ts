import assert from "node:assert/strict";
import test from "node:test";
import {
  bandAlpha, canPrepareInstrument, checkSimulation, createInstrument, createSimulationCache, dryingFronts, drawInstrument, finalState, inspectorItems,
  locateInDomain, pigmentBands, prepareInstrument, prepareWetPigmentSnapshots, runSimulation, stateAt, usesSeed, validateInstrument, visibleParameters,
  wetEnvironment, wetFilm, wetPigmentComposition, wetPigmentProducts, wetPigmentSimulation, wetPigmentSnapshots, WET_LIMITS,
  type CompositionSurface, type WetFrame, type WetModel, type WetPigmentProducts, type WetState,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.js";

const fingerprint = (params: Record<string, number | string | boolean>) => {
  const input = createInstrument("wet-pigment");
  return drawFingerprint({ ...input, params: { ...input.params, ...params } });
};
const near = (actual: number, expected: number, tolerance = 1e-9, note = "") =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);

/** A square wet region of `side` canvas units centred at (320, 320), as a supplied domain. */
const square = (side: number): WetModel["mask"] => {
  const a = 320 - side / 2, b = 320 + side / 2;
  return { kind: "domain", regions: [{ outer: [[a, a], [b, a], [b, b], [a, b]] }] };
};
/** Nothing happens unless a test switches it on: no drops, no drying, no paper, no transport. */
const inert = (over: Partial<{ [K in keyof WetModel]: Partial<WetModel[K]> }> & { grid?: number; mask?: WetModel["mask"] } = {}): WetModel => ({
  grid: over.grid ?? 24,
  mask: over.mask ?? square(440),
  frame: { centerX: 320, centerY: 320, width: 440, height: 440, rotation: 0, ...over.frame },
  paper: { variation: 0, grain: 30, absorbency: 0, ...over.paper },
  water: { prewet: 0, evaporation: 0, edgeDrying: 0, edgeReach: 1, ...over.water },
  transport: { strength: 0, pigmentSpread: 0, tilt: 0, tiltAngle: 0, boundary: "sealed", ...over.transport },
  pigment: { sites: 0, layout: "scattered", radius: 80, depth: 1, ratio: 2, depositRate: 0, redissolve: 0, ...over.pigment },
  backruns: { count: 0, step: 1, gap: 0, depth: 1, radius: 40, ...over.backruns },
});
const at = (model: WetModel, seed: number, step: number) => stateAt(wetPigmentSnapshots(model, seed, step), step) as WetState;
const sum = (a: ArrayLike<number>) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
const mixed = (over = {}): WetModel => inert({
  grid: 48, mask: { kind: "blob", roughness: 0.5 } as WetModel["mask"], frame: { width: 480, height: 440 },
  paper: { variation: 0.5, grain: 30, absorbency: 0.0008 }, water: { prewet: 0.3, evaporation: 0.002, edgeDrying: 2, edgeReach: 40 },
  transport: { strength: 1, pigmentSpread: 0.5, tilt: 0.03, tiltAngle: 30, boundary: "sealed" },
  pigment: { sites: 3, layout: "scattered", radius: 60, depth: 1.4, ratio: 1.5, depositRate: 0.02, redissolve: 0.02 },
  backruns: { count: 2, step: 40, gap: 10, depth: 1.2, radius: 45 }, ...over,
} as never);

/* ------------------------------------------------------------------------- the mask and the grid */

test("the wet cells are the cells whose centres lie in the mask: an ellipse and a ring have their analytic area", () => {
  const ellipse = wetEnvironment(inert({ grid: 128, mask: { kind: "blob", roughness: 0 }, frame: { width: 400, height: 300 } }), 1);
  const cellArea = ellipse.cell ** 2;
  // A 96-gon inscribed in the ellipse: area = ½·96·sin(2π/96)·a·b
  const polygon = 0.5 * 96 * Math.sin(2 * Math.PI / 96) * 200 * 150;
  near(ellipse.domain.area, polygon, 1e-6, "domain area");
  near(ellipse.cells.length * cellArea / polygon, 1, 0.01, "wet cell area against the polygon");
  const ring = wetEnvironment(inert({ grid: 128, mask: { kind: "ring", roughness: 0, inner: 0.5 }, frame: { width: 400, height: 400 } }), 1);
  near(ring.cells.length * ring.cell ** 2 / (Math.PI * 200 * 200 * (1 - 0.25)), 1, 0.02, "ring area against π a b (1 − f²)");
  for (const k of ring.cells) {
    const i = k % 128, j = (k - i) / 128;
    assert.notEqual(locateInDomain(ring.domain, (i + 0.5) * ring.cell, (j + 0.5) * ring.cell), "outside");
  }
});

test("a region off the canvas is cut, and one with no cell is a valid empty picture that has settled at step 0", () => {
  const off = inert({ mask: { kind: "domain", regions: [{ outer: [[900, 900], [1000, 900], [1000, 1000], [900, 1000]] }] }, pigment: { sites: 3 }, water: { prewet: 0.5 } });
  const state = at(off, 1, 5);
  assert.equal(state.settled, 0);
  assert.equal(state.sites.length, 0);
  assert.equal(sum(state.water), 0);
  const edge = inert({ mask: { kind: "domain", regions: [{ outer: [[600, 100], [800, 100], [800, 300], [600, 300]] }] }, water: { prewet: 0.5 } });
  const cells = wetEnvironment(edge, 1).cells.length;
  near(cells * (640 / 24) ** 2, 40 * 200 + 0, 40 * 200 * 0.35, "only the part of the mask inside the canvas is wet");
});

/* ------------------------------------------------------------------------------- water and drying */

test("evaporation alone dries a sheet at the step the arithmetic says, and every cell of it at once", () => {
  // 0.503 − 0.01·k first falls below the dry limit 0.005 at k = 50
  const model = inert({ water: { prewet: 0.503, evaporation: 0.01 } });
  const env = wetEnvironment(model, 1), n = env.cells.length;
  const before = at(model, 1, 49), after = at(model, 1, 50);
  assert.equal(before.settled, -1);
  assert.equal(after.settled, 50, "settled at the first step with no water");
  for (const k of env.cells) { assert.ok(before.water[k] > 0.005); assert.equal(after.dried[k], 50); assert.equal(after.water[k], 0); }
  near(after.accounting.evaporated, 0.503 * n, 1e-9, "everything evaporated");
  assert.equal(after.accounting.absorbed, 0);
});

test("absorption alone dries a sheet at its own step and is accounted apart from evaporation", () => {
  // 0.503 − 0.005·k first falls below 0.005 at k = 100 (porosity is exactly 1 without variation)
  const model = inert({ water: { prewet: 0.503 }, paper: { absorbency: 0.005 } });
  const state = at(model, 1, 100), n = wetEnvironment(model, 1).cells.length;
  assert.equal(state.settled, 100);
  near(state.accounting.absorbed, 0.5 * n + 0.003 * n - 0.003 * n + 0.0, 0.003 * n + 1e-9, "absorbed about 0.5 per cell");
  near(state.accounting.absorbed + state.accounting.evaporated, 0.503 * n, 1e-9, "the film went somewhere");
  assert.ok(state.accounting.absorbed > 0.49 * n);
});

test("the edge dries first: the outer ring of cells by the edge-boosted rate, the rest by the plain rate", () => {
  // edge weight 1 for cells next to the outside, ~e^−27 beyond (edgeReach 1 unit); 0.503 − 0.01·4·k < 0.005 at k = 13
  const model = inert({ water: { prewet: 0.503, evaporation: 0.01, edgeDrying: 3, edgeReach: 1 } });
  const env = wetEnvironment(model, 1), state = at(model, 1, 60);
  let ring = 0, inner = 0;
  for (const k of env.cells) {
    if (env.edgeDistance[k] === 1) { assert.equal(state.dried[k], 13); ring++; }
    else { assert.equal(state.dried[k], 50); inner++; }
  }
  assert.ok(ring > 40 && inner > 100);
});

test("with no evaporation or absorption water is conserved exactly and never dries: no settling is reported", () => {
  const model = mixed({ water: { prewet: 0.3, evaporation: 0, edgeDrying: 0, edgeReach: 40 }, paper: { variation: 0.5, grain: 30, absorbency: 0 } });
  const state = at(model, 5, 200);
  assert.equal(state.settled, -1);
  near(sum(state.water), state.accounting.injectedWater, 1e-9 * state.accounting.injectedWater);
  assert.equal(state.accounting.evaporated, 0);
});

test("sealed water spreads until level: the field equals injected water over the wet cells, in water and in pigment", () => {
  const model = inert({ water: { prewet: 0.15 }, transport: { strength: 1, pigmentSpread: 1, tilt: 0, tiltAngle: 0, boundary: "sealed" },
    pigment: { sites: 1, layout: "core", radius: 300, depth: 4, ratio: 1, depositRate: 0, redissolve: 0 }, frame: { width: 300, height: 300 } });
  const state = at(model, 3, 1900), env = wetEnvironment(model, 3);
  const meanWater = state.accounting.injectedWater / env.cells.length, meanPigment = state.accounting.injectedPigment / env.cells.length;
  for (const k of env.cells) { near(state.water[k], meanWater, 1e-6, "water"); near(state.pigment[k], meanPigment, 1e-4, "pigment"); }
  assert.equal(sum(state.deposit), 0, "a film deeper than the thin-film depth with no settling rate deposits nothing");
});

test("a tilt drifts water downhill and piles it against the far wall; the centroid moves along the tilt only", () => {
  const model = inert({ water: { prewet: 0.4 }, transport: { strength: 1, pigmentSpread: 0, tilt: 0.05, tiltAngle: 0, boundary: "sealed" } });
  const env = wetEnvironment(model, 1), n = env.n;
  const centroid = (state: WetState) => {
    let x = 0, y = 0, w = 0;
    for (const k of env.cells) { x += state.water[k] * ((k % n) + 0.5) * env.cell; y += state.water[k] * (Math.floor(k / n) + 0.5) * env.cell; w += state.water[k]; }
    return [x / w, y / w, w];
  };
  const start = centroid(at(model, 1, 0)), later = centroid(at(model, 1, 60)), latest = centroid(at(model, 1, 240));
  near(start[0], 320, 1e-9); near(start[1], 320, 1e-9);
  assert.ok(later[0] > 320 + 5 && latest[0] > later[0], `centroid x ${start[0]} → ${later[0]} → ${latest[0]}`);
  near(later[1], 320, 1e-9, "no drift across the tilt"); near(latest[1], 320, 1e-9);
  near(latest[2], start[2], 1e-9, "sealed: water conserved");
});

/* ------------------------------------------------------------------------------- drops and pigment */

test("a pigment drop adds the water its kernel integrates to (πR²·depth/3 per cell area) and pigment in the stated ratio", () => {
  const model = inert({ grid: 96, pigment: { sites: 1, layout: "core", radius: 90, depth: 0.8, ratio: 2.5 }, frame: { width: 500, height: 500 } });
  const state = at(model, 4, 0), cell = 640 / 96;
  near(state.accounting.injectedWater * cell ** 2 / (Math.PI * 90 * 90 * 0.8 / 3), 1, 0.03, "kernel volume");
  near(state.accounting.injectedPigment, state.accounting.injectedWater / 2.5, 1e-12, "pigment = water / ratio");
  assert.equal(state.sites.length, 1);
  assert.deepEqual(state.sites.map((s) => s.id), ["site:0"]);
  near(sum(state.pigment), state.accounting.injectedPigment, 1e-12);
});

test("deposit and suspension: pigment is deposited at the stated rate while the film is deep, and all of it when a cell dries", () => {
  // uniform deep film 1.0 (≥ film depth, no thin-film share), no flow, no drying: suspended pigment decays as (1 − rate)^k
  const model = inert({ water: { prewet: 1 }, pigment: { sites: 1, layout: "core", radius: 300, depth: 1, ratio: 1, depositRate: 0.05, redissolve: 0 }, frame: { width: 200, height: 200 } });
  const env = wetEnvironment(model, 1), s0 = at(model, 1, 0), s20 = at(model, 1, 20);
  const k0 = env.cells.reduce((best, k) => s0.pigment[k] > s0.pigment[best] ? k : best, env.cells[0]);
  assert.ok(s0.pigment[k0] > 0.3);
  near(s20.pigment[k0] / s0.pigment[k0], 0.95 ** 20, 1e-12, "settling law");
  near(s20.deposit[k0], s0.pigment[k0] * (1 - 0.95 ** 20), 1e-12, "the rest is on the paper");
  // now let the sheet dry: every bit of suspended pigment lands
  const dry = inert({ water: { prewet: 0.503 }, pigment: { sites: 1, layout: "core", radius: 300, depth: 0.5, ratio: 1, depositRate: 0 }, frame: { width: 200, height: 200 }, paper: { absorbency: 0.01 } });
  const done = at(dry, 1, 150);
  assert.ok(done.settled >= 0);
  assert.equal(sum(done.pigment), 0);
  near(sum(done.deposit), done.accounting.injectedPigment, 1e-12, "a dried film keeps all its pigment");
});

test("pigment rides the water: with no pigment diffusion it still spreads past its drop, never thicker than the drop's own concentration", () => {
  const model = inert({ transport: { strength: 1, pigmentSpread: 0, tilt: 0, tiltAngle: 0, boundary: "sealed" },
    pigment: { sites: 1, layout: "core", radius: 50, depth: 1.5, ratio: 2, depositRate: 0, redissolve: 0 }, frame: { width: 500, height: 500 }, mask: square(500), grid: 48 });
  const env = wetEnvironment(model, 2);
  const start = at(model, 2, 0), later = at(model, 2, 40);
  const site = start.sites[0];
  const beyond = (state: WetState) => { let count = 0; for (const k of env.cells) if (state.pigment[k] > 0 && Math.hypot(((k % env.n) + 0.5) * env.cell - site.x, (Math.floor(k / env.n) + 0.5) * env.cell - site.y) > 50 + env.cell) count++; return count; };
  assert.equal(beyond(start), 0);
  assert.ok(beyond(later) > 20, `${beyond(later)} cells beyond the drop hold advected pigment`);
  for (const k of env.cells) assert.ok(later.pigment[k] <= later.water[k] / 2 + 1e-12, "mixing with clear water only dilutes");
  near(sum(later.pigment) + sum(later.deposit), later.accounting.injectedPigment, 1e-12);
});

test("pigment cannot diffuse into a dry cell even when the water is frozen", () => {
  const model = inert({ transport: { strength: 0, pigmentSpread: 1, tilt: 0, tiltAngle: 0, boundary: "sealed" },
    pigment: { sites: 1, layout: "core", radius: 60, depth: 1.5, ratio: 2, depositRate: 0.01, redissolve: 0 }, frame: { width: 500, height: 500 }, mask: square(500), grid: 48 });
  for (const step of [1, 5, 30]) {
    const state = at(model, 2, step);
    for (let k = 0; k < state.water.length; k++) if (state.water[k] === 0) assert.equal(state.pigment[k], 0, `dry cell ${k} at step ${step}`);
    assert.ok(sum(state.pigment) > 0);
  }
  const first = at(model, 2, 0), later = at(model, 2, 30);
  assert.deepEqual(Array.from(first.water), Array.from(later.water), "no transport strength: the water stays where it landed");
});

test("the paper is seeded correlated noise: porosity stays within 1 ± variation, is smooth over the grain, and follows the seed", () => {
  const paper = (variation: number, grain: number, seed: number) => wetEnvironment(inert({ grid: 64, mask: square(600), paper: { variation, grain, absorbency: 0 } }), seed);
  const flat = paper(0, 30, 3);
  for (const k of flat.cells) assert.equal(flat.porosity[k], 1);
  const a = paper(0.6, 80, 3), b = paper(0.6, 80, 3), c = paper(0.6, 80, 4);
  assert.deepEqual(Array.from(a.porosity), Array.from(b.porosity));
  assert.notDeepEqual(Array.from(a.porosity), Array.from(c.porosity));
  let mean = 0, count = 0, low = Infinity, high = -Infinity;
  for (const k of a.cells) { mean += a.porosity[k]; count++; low = Math.min(low, a.porosity[k]); high = Math.max(high, a.porosity[k]); }
  mean /= count;
  assert.ok(low >= 0.4 - 1e-12 && high <= 1.6 + 1e-12, `range ${low}…${high}`);
  near(mean, 1, 0.12, "mean porosity");
  let variance = 0, neighbour = 0, pairs = 0;
  for (const k of a.cells) { variance += (a.porosity[k] - mean) ** 2; if (a.wet[k + 1]) { neighbour += (a.porosity[k + 1] - a.porosity[k]) ** 2; pairs++; } }
  const std = Math.sqrt(variance / count), step = Math.sqrt(neighbour / pairs);
  assert.ok(std > 0.05, `the paper varies (std ${std})`);
  assert.ok(step < 0.4 * std, `neighbouring cells are correlated: step ${step}, std ${std}`);
});

test("redissolve lifts deposit back into wet water; with none, deposit never decreases from step to step", () => {
  const still = mixed({ pigment: { sites: 3, layout: "scattered", radius: 60, depth: 1.4, ratio: 1.5, depositRate: 0.02, redissolve: 0 } });
  const a = at(still, 5, 70), b = at(still, 5, 71), c = at(still, 5, 130);
  for (let k = 0; k < a.deposit.length; k++) { assert.ok(b.deposit[k] >= a.deposit[k], `cell ${k}`); assert.ok(c.deposit[k] >= b.deposit[k]); }
  const lifting = mixed({ pigment: { sites: 3, layout: "scattered", radius: 60, depth: 1.4, ratio: 1.5, depositRate: 0.02, redissolve: 0.05 } });
  const p = at(lifting, 5, 70), q = at(lifting, 5, 71);
  assert.ok(Array.from(p.deposit).some((v, k) => q.deposit[k] < v), "somewhere deposit returned to suspension");
});

test("pigment accounting: injected = suspended + deposited + lost, water likewise, at every step, sealed or open", () => {
  for (const boundary of ["sealed", "open"] as const) for (const seed of [1, 42, 977]) {
    const model = mixed({ transport: { strength: 1, pigmentSpread: 0.5, tilt: 0.04, tiltAngle: 130, boundary } });
    const snaps = wetPigmentSnapshots(model, seed, 260);
    for (const step of [0, 1, 17, 60, 120, 260]) {
      const state = stateAt(snaps, step) as WetState, a = state.accounting;
      const suspended = sum(state.pigment), deposited = sum(state.deposit), water = sum(state.water);
      near(suspended + deposited + a.lostPigment, a.injectedPigment, 1e-9 * a.injectedPigment, `pigment ${boundary} seed ${seed} step ${step}`);
      near(water + a.evaporated + a.absorbed + a.lostWater, a.injectedWater, 1e-9 * a.injectedWater, `water ${boundary} seed ${seed} step ${step}`);
      for (let k = 0; k < state.water.length; k++) { assert.ok(state.water[k] >= 0 && state.pigment[k] >= 0 && state.deposit[k] >= 0, `negative at ${k}`); }
      if (boundary === "sealed") { assert.equal(a.lostPigment, 0); assert.equal(a.lostWater, 0); }
    }
    const frame = snaps.final as WetFrame;
    near(frame.totals.suspended + frame.totals.deposited + frame.totals.lostPigment, frame.totals.injectedPigment, 1e-9 * frame.totals.injectedPigment);
    if (boundary === "open") assert.ok(frame.totals.lostPigment > 0 && frame.totals.lostWater > 0, "an open edge drains");
  }
});

test("dry cells do not transport: an unreached wet-mask cell and a separate island stay exactly zero at every step", () => {
  // two squares far apart; the drops and pre-wet cannot start in the island because prewet 0 and sites land in either.
  const two: WetModel["mask"] = { kind: "domain", regions: [{ outer: [[60, 260], [200, 260], [200, 380], [60, 380]] }, { outer: [[440, 260], [580, 260], [580, 380], [440, 380]] }] };
  const model = inert({ mask: two, transport: { strength: 1, pigmentSpread: 1, tilt: 0.05, tiltAngle: 0, boundary: "sealed" },
    pigment: { sites: 1, layout: "core", radius: 50, depth: 1.5, ratio: 1, depositRate: 0.02, redissolve: 0.02 }, water: { evaporation: 0.003 } });
  const env = wetEnvironment(model, 9);
  const snaps = wetPigmentSnapshots(model, 9, 300);
  const site = (snaps.params as WetModel) && (stateAt(snaps, 0) as WetState).sites[0];
  const side = site.x < 320 ? "left" : "right";
  const other = (k: number) => (((k % env.n) + 0.5) * env.cell < 320) !== (side === "left");
  for (const step of [0, 1, 10, 50, 100, 200, 300]) {
    const state = stateAt(snaps, step) as WetState;
    for (const k of env.cells) if (other(k)) { assert.equal(state.water[k], 0); assert.equal(state.pigment[k], 0); assert.equal(state.deposit[k], 0); }
    for (let k = 0; k < state.water.length; k++) {
      if (!env.wet[k]) { assert.equal(state.water[k], 0); assert.equal(state.deposit[k], 0); }
      if (state.water[k] === 0) assert.equal(state.pigment[k], 0, `dry cell ${k} holds suspended pigment at step ${step}`);
    }
  }
});

test("a dry cell changes only by receiving water: every deposit change has water within the three passes of a step", () => {
  const model = mixed();
  const env = wetEnvironment(model, 11), n = env.n, snaps = wetPigmentSnapshots(model, 11, 150);
  let previous = stateAt(snaps, 60) as WetState;
  for (let step = 61; step <= 80; step++) {
    const state = stateAt(snaps, step) as WetState;
    for (const k of env.cells) if (state.deposit[k] !== previous.deposit[k] || state.pigment[k] !== previous.pigment[k]) {
      const i = k % n, j = (k - i) / n;
      // water moves one cell per pass, three passes a step: only a wet cell within three cells (Manhattan) can reach it
      let reached = false;
      for (let dj = -3; dj <= 3 && !reached; dj++) for (let di = -3; di <= 3 && !reached; di++) {
        const x = i + di, y = j + dj;
        if (Math.abs(di) + Math.abs(dj) <= 3 && x >= 0 && y >= 0 && x < n && y < n && previous.water[y * n + x] > 0) reached = true;
      }
      assert.ok(reached, `cell ${k} changed at step ${step} with no water within three cells at the start of the step`);
    }
    previous = state;
  }
});

test("a late clear-water drop pushes pigment out: a backrun leaves the drop's centre paler than the deposit around it", () => {
  const base = inert({ mask: square(500), frame: { width: 500, height: 500 }, water: { evaporation: 0.0015, edgeDrying: 0, prewet: 0.2 },
    paper: { variation: 0.3, grain: 30, absorbency: 0.0006 }, transport: { strength: 1, pigmentSpread: 0.4, tilt: 0, tiltAngle: 0, boundary: "sealed" },
    pigment: { sites: 1, layout: "core", radius: 70, depth: 1.6, ratio: 1.2, depositRate: 0.02, redissolve: 0.02 } });
  const plain = { ...base, grid: 48 }, late = { ...base, grid: 48, backruns: { count: 1, step: 100, gap: 0, depth: 1.8, radius: 60 } } as WetModel;
  const env = wetEnvironment(late, 21), a = at(plain, 21, 500), b = at(late, 21, 500);
  const site = (stateAt(wetPigmentSnapshots(late, 21, 0), 0) as WetState).sites;
  const drop = site.find((s) => s.kind === "water")!, pigmentSite = site.find((s) => s.kind === "pigment")!;
  assert.equal(drop.parent, pigmentSite.id, "the backrun lands beside its pigment site");
  const inside = (state: WetState, r0: number, r1: number) => {
    let total = 0, count = 0;
    for (const k of env.cells) {
      const d = Math.hypot(((k % env.n) + 0.5) * env.cell - drop.x, (Math.floor(k / env.n) + 0.5) * env.cell - drop.y);
      if (d >= r0 && d < r1) { total += state.deposit[k]; count++; }
    }
    return total / count;
  };
  assert.ok(inside(b, 0, 25) < 0.65 * inside(a, 0, 25), `deposit under the drop ${inside(a, 0, 25)} → ${inside(b, 0, 25)}`);
  assert.ok(inside(b, 95, 170) > inside(a, 95, 170), `deposit farther out ${inside(a, 95, 170)} → ${inside(b, 95, 170)}`);
  near(sum(a.deposit), sum(b.deposit), 1e-9 * sum(a.deposit), "the same pigment, moved");
});

test("an open edge drains: the pigment that leaves is exactly the pigment missing from the paper, and a sealed wall keeps all", () => {
  const cfg = (boundary: "sealed" | "open") => mixed({ transport: { strength: 1, pigmentSpread: 0.5, tilt: 0, tiltAngle: 0, boundary } });
  const sealed = at(cfg("sealed"), 8, 400), open = at(cfg("open"), 8, 400);
  near(sum(sealed.deposit), sealed.accounting.injectedPigment, 1e-9 * sealed.accounting.injectedPigment, "a sealed wall keeps everything");
  assert.ok(open.accounting.lostPigment > 0.2 * open.accounting.injectedPigment, "an open edge loses a real share");
  near(sum(open.deposit) + open.accounting.lostPigment, open.accounting.injectedPigment, 1e-9 * open.accounting.injectedPigment);
  assert.ok(sum(open.deposit) < 0.8 * sum(sealed.deposit));
});

/* ---------------------------------------------------------------------------- termination and ids */

test("a settled system is a fixed point: the first step with no water, and no later step changes anything", () => {
  const model = mixed();
  const snaps = wetPigmentSnapshots(model, 6, 700), final = snaps.final as WetFrame;
  const settled = final.settled;
  assert.ok(settled > 100 && settled < 700, `settled at ${settled}`);
  const first = stateAt(snaps, settled) as WetState, last = stateAt(snaps, 700) as WetState, before = stateAt(snaps, settled - 1) as WetState;
  assert.equal(sum(first.water), 0);
  assert.ok(sum(before.water) > 0 || first.sites.some((s) => s.step > settled - 1));
  assert.deepEqual(Array.from(first.deposit), Array.from(last.deposit));
  assert.deepEqual(first.dried, last.dried);
  // a drop still due keeps the system alive even while nothing is wet
  const waiting = mixed({ backruns: { count: 1, step: 500, gap: 0, depth: 1.2, radius: 45 } });
  const w = wetPigmentSnapshots(waiting, 6, 700).final as WetFrame;
  assert.ok(w.settled > 500, `a pending drop at 500 delays settling: ${w.settled}`);
});

test("site ids are birth-order serials and a site's place depends on the seed and its own history, not on later sites", () => {
  const three = at(mixed({ backruns: { count: 0, step: 40, gap: 10, depth: 1.2, radius: 45 }, pigment: { sites: 3 } as never }), 13, 0).sites;
  const five = at(mixed({ backruns: { count: 0, step: 40, gap: 10, depth: 1.2, radius: 45 }, pigment: { sites: 5 } as never }), 13, 0).sites;
  assert.deepEqual(five.slice(0, 3), three);
  assert.deepEqual(five.map((s) => s.id), ["site:0", "site:1", "site:2", "site:3", "site:4"]);
  const withLate = at(mixed({ pigment: { sites: 3 } as never }), 13, 0).sites;
  assert.deepEqual(withLate.slice(0, 3), three, "adding backruns does not move a pigment site");
  assert.deepEqual(withLate.slice(3).map((s) => s.id), ["site:3", "site:4"]);
  assert.notDeepEqual(at(mixed({ pigment: { sites: 3 } as never }), 14, 0).sites.slice(0, 3), three, "another seed places them elsewhere");
  for (const s of withLate) assert.ok(locateInDomain(wetEnvironment(mixed({ pigment: { sites: 3 } as never }), 13).domain, s.x, s.y) !== "outside");
});

/* ------------------------------------------------------------------------------ stateful guarantees */

test("the simulation is deterministic, prefix-stable, checkpoint-replayable and resumable (checkSimulation, three constructions)", () => {
  for (const [model, seed] of [[mixed({ grid: 24 }), 3], [mixed({ grid: 24, transport: { strength: 1, pigmentSpread: 0.5, tilt: 0, tiltAngle: 0, boundary: "open" } }), 8],
    [inert({ grid: 24, mask: { kind: "letters", word: "WET" }, water: { prewet: 0.3, evaporation: 0.004 }, pigment: { sites: 2, layout: "rim", radius: 60, depth: 1, ratio: 2, depositRate: 0.02, redissolve: 0.01 }, transport: { strength: 1, pigmentSpread: 0.3, tilt: 0, tiltAngle: 0, boundary: "sealed" } }), 5]] as [WetModel, number][])
    checkSimulation(wetPigmentSimulation, model, seed, 45);
});

test("cancellation publishes nothing and cannot change a later result", async () => {
  const model = mixed({ grid: 32 });
  const cache = createSimulationCache({ capacity: 2 });
  const options = { steps: 60, checkpointEvery: 50, historyEvery: 0 };
  let polls = 0;
  const cancelled = await cache.prepare(wetPigmentSimulation, model, 4, { ...options, cancelled: () => ++polls > 20 });
  assert.equal(cancelled, null);
  assert.equal(cache.size, 0, "no partial entry");
  assert.equal(await prepareWetPigmentSnapshots(model, 4, 60, () => true), null);
  const done = await cache.prepare(wetPigmentSimulation, model, 4, { ...options, cancelled: () => false });
  const fresh = runSimulation(wetPigmentSimulation, model, 4, options);
  assert.deepEqual(Array.from((done!.final as WetFrame).deposit), Array.from((fresh.final as WetFrame).deposit));
  const input = { ...createInstrument("wet-pigment"), seed: 4, params: { ...createInstrument("wet-pigment").params, steps: 80, grid: 48 } };
  assert.equal(await prepareInstrument(input, () => true), false);
  let calls = 0;
  assert.equal(await prepareInstrument(input, () => ++calls > 30), false, "cancelled while the steps run");
  assert.equal(await prepareInstrument(input, () => false), true);
});

test("more steps only append: a longer run extends a cached shorter one and equals a run from scratch", () => {
  const model = mixed({ grid: 40 });
  const short = wetPigmentSnapshots(model, 15, 90), long = wetPigmentSnapshots(model, 15, 200);
  const scratch = runSimulation(wetPigmentSimulation, model, 15, { steps: 200, checkpointEvery: WET_LIMITS.checkpointEvery, historyEvery: 0 });
  assert.deepEqual(Array.from((long.final as WetFrame).deposit), Array.from((scratch.final as WetFrame).deposit));
  assert.deepEqual(Array.from(stateAt(long, 90).deposit), Array.from(finalState(short).deposit), "the earlier state is the prefix");
  assert.equal(wetPigmentSnapshots(model, 15, 200), long, "the same construction is the same object");
});

/* ------------------------------------------------------------------- construction, appearance, keys */

const recipeFor = (params: Record<string, number | string | boolean> = {}, seed = 42, palette?: number[]) => {
  const input = createInstrument("wet-pigment");
  return wetPigmentComposition({ ...input, seed, palette: palette ?? input.palette, params: { ...input.params, grid: 40, steps: 120, ...params } });
};

test("appearance edits repaint the same snapshot and the same band geometry; display levels rebuild geometry but not the model", () => {
  const a = wetPigmentProducts(recipeFor()), b = wetPigmentProducts(recipeFor({ opacity: 0.4, colorMode: "single" }, 42, [0x112233, 0x445566, 0x778899]));
  assert.equal(b.snapshots, a.snapshots);
  assert.equal(b.frame, a.frame);
  assert.equal(b.bands, a.bands, "band geometry is cached per frame and display level");
  const more = wetPigmentProducts(recipeFor({ bands: 4, gain: 3 }));
  assert.equal(more.snapshots, a.snapshots);
  assert.notEqual(more.bands, a.bands);
  assert.equal(more.bands!.levels.length, 4);
  const shown = wetPigmentProducts(recipeFor({ showFronts: true, showFilm: true, frontEvery: 12 }));
  assert.equal(shown.snapshots, a.snapshots, "fronts and film read the same snapshot as the bands");
  assert.equal(shown.frame, a.frame);
  assert.ok(shown.fronts && shown.film && shown.bands);
});

test("a meaningful initial-condition edit recomputes: water, sites, mask, paper, seed and step count each give another result", () => {
  const base = wetPigmentProducts(recipeFor());
  const same = (p: WetPigmentProducts) => Buffer.compare(Buffer.from((p.frame.deposit as Float64Array).buffer.slice(0)), Buffer.from((base.frame.deposit as Float64Array).buffer.slice(0))) === 0;
  for (const [what, edit, seed] of [["prewet", { prewet: 0.6 }, 42], ["evaporation", { evaporation: 0.004 }, 42], ["sites", { sites: 6 }, 42], ["dropRadius", { dropRadius: 90 }, 42],
    ["mask", { centerX: 250 }, 42], ["roughness", { roughness: 0.9 }, 42], ["shape", { maskShape: "letters" }, 42], ["paper", { paperVariation: 0.9 }, 42], ["transport", { transport: 0.3 }, 42],
    ["seed", {}, 43], ["tilt", { tilt: 0.05 }, 42]] as [string, Record<string, number | string>, number][]) {
    const changed = wetPigmentProducts(recipeFor(edit, seed));
    assert.notEqual(changed.snapshots, base.snapshots, `${what}: another snapshot`);
    assert.ok(!same(changed), `${what}: another field`);
  }
  const later = wetPigmentProducts(recipeFor({ steps: 200 }));
  assert.notEqual(later.snapshots, base.snapshots);
  assert.equal(later.snapshots.construction, base.snapshots.construction, "steps change the run, not the construction");
});

test("a hidden control cannot change the construction: late-drop, ring and word settings are ignored while their driver is off", () => {
  const base = wetPigmentProducts(recipeFor({ lateWater: false }));
  const hidden = wetPigmentProducts(recipeFor({ lateWater: false, backruns: 7, backrunStep: 300, backrunGap: 50, backrunDepth: 0.3, backrunRadius: 80, inner: 0.7, word: "RAIN" }));
  assert.equal(hidden.snapshots, base.snapshots);
  const noTilt = wetPigmentProducts(recipeFor({ tilt: 0, tiltAngle: 10 }));
  assert.equal(noTilt.snapshots, wetPigmentProducts(recipeFor({ tilt: 0, tiltAngle: 170 })).snapshots, "the tilt direction means nothing without a tilt");
  const off = wetPigmentProducts(recipeFor({ paperVariation: 0, paperGrain: 60 }));
  assert.equal(off.snapshots, wetPigmentProducts(recipeFor({ paperVariation: 0, paperGrain: 11 })).snapshots);
  const words = wetPigmentProducts(recipeFor({ maskShape: "letters", word: "INK", roughness: 0.2 }));
  assert.equal(words.snapshots, wetPigmentProducts(recipeFor({ maskShape: "letters", word: "INK", roughness: 0.9, inner: 0.6 })).snapshots, "letters ignore outline roughness and island size");
  const lines = ["showFronts", "showFilm", "showPigment"].map((key) => fingerprint({ showPigment: false, showFronts: false, showFilm: false, showOutline: false, [key]: false, frontEvery: 33, frontWeight: 2, filmOpacity: 0.5, filmEdge: 2, bands: 3, gain: 2, opacity: 0.5, colorMode: "single", showSuspended: false }));
  assert.equal(new Set(lines).size, 1, "with every treatment off nothing is drawn, whatever their settings");
});

test("the seed matters exactly when something is drawn from it", () => {
  const input = createInstrument("wet-pigment");
  const fix = (params: Record<string, number | string | boolean>) => ({ ...input, params: { ...input.params, ...params } });
  assert.equal(usesSeed(fix({})), true);
  assert.equal(usesSeed(fix({ maskShape: "letters", paperVariation: 0, sites: 0, lateWater: false })), false);
  assert.equal(usesSeed(fix({ maskShape: "letters", paperVariation: 0, sites: 0, lateWater: true, backruns: 2 })), true);
  assert.equal(usesSeed(fix({ maskShape: "blob", roughness: 0, paperVariation: 0, sites: 0, lateWater: false })), false);
});

test("the seed changes structure: three seeds give three different outlines, drop places and deposits", () => {
  const seen = new Set<string>();
  for (const seed of [42, 7, 1234567]) {
    const p = wetPigmentProducts(recipeFor({}, seed)), sites = (stateAt(p.snapshots, 0) as WetState).sites;
    seen.add(JSON.stringify([sites.slice(0, 2).map((s) => [s.x.toFixed(3), s.y.toFixed(3)]), Math.round(p.environment.domain.area)]));
  }
  assert.equal(seen.size, 3);
});

/* -------------------------------------------------------------------------------- the treatments */

test("band levels and opacities follow their formulas, bands nest, and each band covers the cells at or above its level", () => {
  const p = wetPigmentProducts(recipeFor({ steps: 250, grid: 64, bands: 5, gain: 5, opacity: 0.9, showSuspended: true }));
  const bands = p.bands!;
  bands.levels.forEach((level, index) => near(level, -Math.log(1 - (index + 1) / 6) / 5, 1e-12));
  let product = 1;
  for (let k = 1; k <= 5; k++) { product *= 1 - bandAlpha(k, 5, 0.9); near(1 - product, 0.9 * k / 5, 1e-12, `cumulative opacity after band ${k}`); }
  const frame = p.frame, cell2 = p.environment.cell ** 2;
  let previous = Infinity;
  bands.domains.forEach((domain, index) => {
    let cellArea = 0;
    for (const k of p.environment.cells) if (frame.deposit[k] + frame.pigment[k] >= bands.levels[index]) cellArea += cell2;
    assert.ok(domain.area <= previous + 1e-9, "nested by area");
    previous = domain.area;
    if (cellArea > 40 * cell2) near(domain.area / cellArea, 1, 0.2, `band ${index} area against the cells at or above its level`);
  });
  assert.ok(bands.domains[0].area > bands.domains[4].area * 1.2 || bands.domains[4].area === 0);
});

test("drying fronts lie inside the wet region, and a front at step s separates cells dried by s from later ones", () => {
  const p = wetPigmentProducts(recipeFor({ steps: 360, grid: 64, showFronts: true, frontEvery: 30 }));
  const fronts = p.fronts!, env = p.environment, frame = p.frame;
  assert.ok(fronts.steps.length >= 3 && fronts.paths.length > 0, `${fronts.steps.length} fronts`);
  fronts.steps.forEach((s, index) => assert.equal(s, 30 * (index + 1)));
  for (const path of fronts.paths) {
    assert.ok(fronts.steps.includes(path.level));
    for (const [x, y] of path.points) assert.equal(locateInDomain(env.domain, x, y), "inside");
  }
  // sample across one front: just inside it the cells dried before its step, just outside they dried later (or never)
  const path = fronts.paths.find((q) => q.points.length > 12)!;
  let earlier = 0, later = 0, total = 0;
  for (let i = 0; i + 1 < path.points.length; i += 3) {
    const [x1, y1] = path.points[i], [x2, y2] = path.points[i + 1];
    const nx = -(y2 - y1), ny = x2 - x1, len = Math.hypot(nx, ny) || 1;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const at = (sign: number) => { const cx = Math.floor((mx + sign * nx / len * env.cell * 1.2) / env.cell), cy = Math.floor((my + sign * ny / len * env.cell * 1.2) / env.cell); return cy * env.n + cx; };
    const a = frame.dried[at(1)], b = frame.dried[at(-1)];
    if (a < 0 && b < 0) continue;
    total++;
    const dry = (v: number) => v >= 0 && v <= path.level + 2;
    if (dry(a) !== dry(b)) earlier++; else later++;
  }
  assert.ok(total >= 4 && earlier >= 0.6 * total, `${earlier} of ${total} samples straddle the front (chance would be about half or fewer)`);
});

test("the water film is the wet cells' area while wet and empty once dry", () => {
  const wet = wetPigmentProducts(recipeFor({ steps: 40, grid: 64, showFilm: true }));
  const cells = Array.from(wet.frame.water).filter((v) => v > 0).length;
  near(wet.film!.domain.area / (cells * wet.environment.cell ** 2), 1, 0.12, "film area against wet cells");
  const dry = wetPigmentProducts(recipeFor({ steps: 600, grid: 64, showFilm: true }));
  assert.ok(dry.frame.settled >= 0);
  assert.equal(dry.film!.domain.regions.length, 0);
});

test("front count beyond the limit is an error that names the interval, not a thinned drawing", () => {
  const env = wetEnvironment(recipeFor({ grid: 40, steps: 300 }).model, 42), frame = wetPigmentProducts(recipeFor({ grid: 40, steps: 300 })).frame;
  assert.throws(() => dryingFronts(frame, env, { every: 1 }), /front interval/);
  assert.throws(() => pigmentBands(frame, env, { bands: 0, gain: 4, suspended: true }), /bands must be an integer/);
});

/* ------------------------------------------------------------------------------------ the interface */

test("the instrument validates, prepares, groups and shows its controls by driver", () => {
  const input = createInstrument("wet-pigment");
  assert.equal(validateInstrument(input).technique, "wet-pigment");
  assert.equal(canPrepareInstrument("wet-pigment"), true);
  const keys = (params: Record<string, number | string | boolean>) => visibleParameters("wet-pigment", { ...input.params, ...params }).map((p) => p.key);
  assert.ok(keys({ maskShape: "letters" }).includes("word") && !keys({ maskShape: "blob" }).includes("word"));
  assert.ok(keys({ maskShape: "ring" }).includes("inner") && !keys({ maskShape: "letters" }).includes("roughness"));
  assert.ok(!keys({ lateWater: false }).includes("backrunStep") && keys({ lateWater: true }).includes("backrunStep"));
  assert.ok(!keys({ showFronts: false }).includes("frontEvery") && !keys({ showPigment: false }).includes("bands"));
  const top = inspectorItems("wet-pigment", input.params);
  assert.deepEqual(top.map((item) => item.kind === "group" && item.label), ["Wet region", "Placement", "Paper", "Water", "Transport", "Pigment", "Backruns", "Simulation", "Drawing"]);
  const placement = top.find((item) => item.kind === "group" && item.label === "Placement");
  assert.ok(placement && placement.kind === "group");
  const size = placement.items.find((item) => item.kind === "group" && item.label === "Size");
  assert.ok(size && size.kind === "group" && size.proportional);
  assert.deepEqual(size.items.map((item) => item.kind === "control" && item.parameter.key), ["width", "height"]);
});

test("costs are bounded before the first step and every failure names the control to change", () => {
  const input = createInstrument("wet-pigment");
  const bad = (params: Record<string, number | string | boolean>) => () => validateInstrument({ ...input, params: { ...input.params, ...params } });
  assert.throws(bad({ grid: 256, steps: 600 }), /Elapsed steps × grid cells².*Lower the elapsed steps or the grid cells/);
  assert.throws(bad({ prewet: 0.001 }), /Pre-wet must be 0 or at least 0.005/);
  assert.throws(bad({ grid: 10 }), /grid must be between 24 and 256/);
  assert.throws(bad({ tilt: 0.2 }), /tilt must be between 0 and 0.1/);
  assert.throws(() => wetPigmentSnapshots(mixed({ grid: 250 }), 1, 900), /steps × grid².*Lower steps or grid/);
  assert.throws(() => wetPigmentSnapshots({ ...mixed(), transport: { strength: 1, pigmentSpread: 0, tilt: 0, tiltAngle: 0, boundary: "sealed", } as WetModel["transport"], water: { prewet: 0.001, evaporation: 0, edgeDrying: 0, edgeReach: 1 } }, 1, 3), /prewet must be 0 or at least/);
  assert.throws(() => wetPigmentSnapshots(mixed(), 1, 2001), /steps must be an integer from 0 to 2000/);
  assert.throws(() => wetEnvironment(inert({ mask: { kind: "letters", word: "é" } }), 1), /word must be 1 to 20 printable ASCII/);
});

test("the drawing is transparent: it paints shapes only and never fills the canvas", () => {
  const calls: string[] = [];
  const surface = new Proxy({ CLOSE: "close", ROUND: "round" } as Record<string, unknown>, {
    get: (target, name: string) => name in target ? target[name] : (...args: unknown[]) => { calls.push(name === "fill" || name === "stroke" ? `${name}:${args.length > 3 ? "a" : ""}` : name); },
  }) as unknown as CompositionSurface;
  const input = createInstrument("wet-pigment");
  drawInstrument(surface as never, { ...input, params: { ...input.params, grid: 40, steps: 120, showFilm: true, showFronts: true, showOutline: true, frontEvery: 15 } });
  assert.ok(!calls.includes("rect") && !calls.includes("background"), "no full-canvas fill");
  assert.ok(calls.filter((call) => call === "beginShape").length > 5, "polygons were drawn");
});
