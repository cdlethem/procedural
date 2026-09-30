import assert from "node:assert/strict";
import test from "node:test";
import {
  accumulateFlow, analyzeDrainage, basinColors, bedrockField, canPrepareInstrument, checkErosionWork, checkSimulation, createInstrument, creepSubsteps,
  definition, drainageBasins, drawInstrument, drainageErosionComposition, drainageErosionProducts, drainageFootprint, erodedTerrain, erosionCache, erosionParamsFor, erosionSimulation,
  fillDepressions, flowReceivers, FILL_EPSILON, gridContours, hasSettled, hillshadePatch, initialTerrain, inspectorItems, lakeDomain, MAX_EROSION_WORK, outletMask,
  prepareInstrument, rainField, streamNetwork, terrainContours, terrainVolume, usesSeed, validateInstrument, visibleParameters,
  type Drainage, type ErosionParams, type ErosionState, type InstrumentInput, type SimulationContext,
} from "../dist/index.js";
import { COAST, coastalRamp } from "../dist/composition/terrain.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.js";

const near = (actual: number, expected: number, tolerance = 1e-9, note = "") =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32; };
}
const smoothstep = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

const NB: readonly (readonly [number, number])[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/** Simulation parameters with everything off unless a test turns it on. */
const params = (over: Partial<ErosionParams> = {}): ErosionParams => ({
  columns: 12, rows: 12, shape: "noise", relief: 0.3, roughness: 1, frequency: 3, octaves: 4, outlets: "edges",
  rainMode: "uniform", rainVariation: 0, rainAngle: 0, storms: 1, bedrock: "uniform", bedrockContrast: 0, bedrockScale: 1, bedrockAngle: 0,
  erodibility: 0, areaExponent: 0.5, slopeExponent: 1, deposition: 0, carrying: 1, uplift: 0, creep: 0, ...over,
});
const context = (p: ErosionParams, step = 1, seed = 0): SimulationContext<ErosionParams> =>
  ({ params: p, seed, step, stream: () => { throw new Error("no streams"); }, charge() {} });
/** One step of the model from a hand-made terrain. */
function stepFrom(p: ErosionParams, heights: ArrayLike<number>): ErosionState {
  const state = erosionSimulation.initial(context(p, 0));
  state.height.set(heights);
  return erosionSimulation.step(state, context(p));
}
const volume = (p: ErosionParams, z: ArrayLike<number>) => terrainVolume(z, p.columns, p.rows);

/* ------------------------------------------------------------------------------------ flow routing */

/** Independent minimax: the lowest possible "highest point on a path from an outlet" for every cell. */
function minimax(z: Float64Array, columns: number, rows: number, outlets: Uint8Array): Float64Array {
  const value = new Float64Array(z.length).fill(Infinity);
  for (let c = 0; c < z.length; c++) if (outlets[c]) value[c] = z[c];
  for (let changed = true; changed;) {
    changed = false;
    for (let c = 0; c < z.length; c++) {
      if (outlets[c]) continue;
      const i = c % columns, j = (c - i) / columns;
      for (const [dx, dy] of NB) {
        const x = i + dx, y = j + dy;
        if (x < 0 || y < 0 || x >= columns || y >= rows) continue;
        const candidate = Math.max(z[c], value[y * columns + x]);
        if (candidate < value[c]) { value[c] = candidate; changed = true; }
      }
    }
  }
  return value;
}
function randomTerrain(columns: number, rows: number, seed: number): Float64Array {
  const random = mulberry(seed), z = new Float64Array(columns * rows);
  for (let c = 0; c < z.length; c++) z[c] = random();
  return z;
}

test("outlet masks: counts and positions of each mode", () => {
  const count = (mask: Uint8Array) => mask.reduce((sum, v) => sum + v, 0);
  assert.equal(count(outletMask(9, 7, "edges")), 2 * 9 + 2 * 7 - 4);
  assert.equal(count(outletMask(9, 7, "bottom")), 9);
  assert.equal(count(outletMask(9, 7, "sides")), 2 * 7);
  const single = outletMask(9, 7, "single");
  assert.equal(count(single), 1);
  assert.equal(single[6 * 9 + 4], 1);
  assert.throws(() => outletMask(3, 9, "edges"), /at least 4/);
});

test("priority flood: a pit inside a rim fills to the rim plus one epsilon per ring flooded inwards", () => {
  // 9 x 9: ring 0 (border) outlets at 0, ring 1 a rim at 1, rings 2-4 a pit at 0.1. Hand-derived: ring 1 stays 1, ring k >= 2 becomes 1 + (k - 1) eps.
  const n = 9, z = new Float64Array(n * n), ring = (i: number, j: number) => Math.min(i, j, n - 1 - i, n - 1 - j);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) z[j * n + i] = ring(i, j) === 0 ? 0 : ring(i, j) === 1 ? 1 : 0.1;
  const { filled } = fillDepressions(z, n, n, outletMask(n, n, "edges"));
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = ring(i, j), expected = k === 0 ? 0 : k === 1 ? 1 : 1 + (k - 1) * FILL_EPSILON;
    near(filled[j * n + i], expected, 1e-13, `cell ${i},${j}`);
  }
});

test("priority flood equals an independent minimax spill to within one epsilon per cell, and never lowers ground", () => {
  for (const seed of [1, 2, 3, 4]) {
    const columns = 14, rows = 11, z = randomTerrain(columns, rows, seed), outlets = outletMask(columns, rows, seed % 2 ? "edges" : "bottom");
    const { filled } = fillDepressions(z, columns, rows, outlets), spill = minimax(z, columns, rows, outlets);
    for (let c = 0; c < z.length; c++) {
      assert.ok(filled[c] >= z[c], "filled below the ground");
      assert.ok(filled[c] >= spill[c] - 1e-12, `cell ${c} below its spill level`);
      assert.ok(filled[c] <= spill[c] + z.length * FILL_EPSILON, `cell ${c} above its spill level by more than the epsilon budget`);
    }
  }
});

test("after filling, no cell is lower than its receiver and every cell drains to an outlet (all modes)", () => {
  for (const [seed, mode] of [[5, "edges"], [6, "bottom"], [7, "sides"], [8, "single"]] as const) {
    const columns = 15, rows = 13, z = randomTerrain(columns, rows, seed), outlets = outletMask(columns, rows, mode);
    const { filled, order } = fillDepressions(z, columns, rows, outlets), receivers = flowReceivers(filled, columns, rows, outlets);
    const position = new Int32Array(z.length);
    order.forEach((cell, k) => { position[cell] = k; });
    assert.equal(new Set(order).size, z.length, "the flood order visits every cell once");
    for (let k = 1; k < order.length; k++) assert.ok(filled[order[k]] >= filled[order[k - 1]], "flood order is non-decreasing");
    for (let c = 0; c < z.length; c++) {
      if (outlets[c]) { assert.equal(receivers[c], -1); continue; }
      const r = receivers[c], dx = Math.abs((r % columns) - (c % columns)), dy = Math.abs(Math.floor(r / columns) - Math.floor(c / columns));
      assert.ok(Math.max(dx, dy) === 1, "receiver is a neighbour");
      assert.ok(filled[c] > filled[r], "no upstream cell may be lower than or level with its receiver");
      assert.ok(position[r] < position[c], "receivers come first in the flood order");
      let at = c, hops = 0;
      while (!outlets[at]) { at = receivers[at]; assert.ok(++hops <= z.length, "cycle"); }
    }
  }
});

test("D8: steepest descent, diagonals weighed by 1/sqrt(2), ties to the first neighbour in the order E SE S SW W NW N NE", () => {
  const n = 4, outlets = new Uint8Array(n * n).fill(1);
  outlets[1 * n + 1] = 0; // only the centre cell routes; the rest are outlets
  const pick = (values: Record<string, number>) => {
    // Cell (1,1) sits at 10; the named neighbours get the given heights, others are higher.
    const filled = new Float64Array(n * n).fill(20);
    filled[1 * n + 1] = 10;
    const at: Record<string, number> = { E: 1 * n + 2, SE: 2 * n + 2, S: 2 * n + 1, SW: 2 * n + 0, W: 1 * n + 0, NW: 0, N: 1, NE: 2 };
    for (const [name, h] of Object.entries(values)) filled[at[name]] = h;
    return { receivers: flowReceivers(filled, n, n, outlets), at };
  };
  let r = pick({ S: 9, SE: 8.6 });                       // S: drop 1; SE: 1.4 / sqrt(2) = 0.99 < 1
  assert.equal(r.receivers[5], r.at.S);
  r = pick({ S: 9, SE: 8.5 });                           // SE: 1.5 / sqrt(2) = 1.06 > 1
  assert.equal(r.receivers[5], r.at.SE);
  r = pick({ W: 8, E: 8 });                              // tie: E comes before W
  assert.equal(r.receivers[5], r.at.E);
  r = pick({ N: 8, NW: 8 });                             // N (drop 2) beats NW (drop 2 over sqrt(2))
  assert.equal(r.receivers[5], r.at.N);
  const tie = pick({ SW: 6, NE: 6 });                    // tie among diagonals: SW is earlier than NE
  assert.equal(tie.receivers[5], tie.at.SW);
});

test("accumulation equals an independent per-cell walk and conserves the source at the outlets", () => {
  const random = mulberry(9);
  for (const mode of ["edges", "bottom", "single"] as const) {
    const columns = 16, rows = 12, z = randomTerrain(columns, rows, 11), outlets = outletMask(columns, rows, mode);
    const { filled, order } = fillDepressions(z, columns, rows, outlets), receivers = flowReceivers(filled, columns, rows, outlets);
    const source = Array.from({ length: z.length }, () => 1 + Math.floor(random() * 5)), flow = accumulateFlow(receivers, order, source);
    const expected = new Float64Array(z.length);
    for (let c = 0; c < z.length; c++) for (let at = c; ; at = receivers[at]) { expected[at] += source[c]; if (receivers[at] < 0) break; }
    assert.deepEqual(Array.from(flow), Array.from(expected));
    let outletTotal = 0;
    for (let c = 0; c < z.length; c++) if (outlets[c]) outletTotal += flow[c];
    assert.equal(outletTotal, source.reduce((a, b) => a + b, 0), "everything that falls leaves through the outlets");
  }
});

/* ------------------------------------------------------------------------ terrain, rain and bedrock */

test("terrain: plane and dome match their closed forms; outlets are exactly base level; the same seed repeats", () => {
  for (const outlets of ["bottom", "edges"] as const) {
    const columns = 20, rows = 16, h = 1 / 20, p = { columns, rows, shape: "plane" as const, relief: 0.4, roughness: 0, frequency: 3, octaves: 3, outlets };
    const z = initialTerrain(p, 1), mask = outletMask(columns, rows, outlets);
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const c = j * columns + i, x = (i + 0.5) * h, y = (j + 0.5) * h;
      let distance = rows * h - y;
      if (outlets === "edges") distance = Math.min(distance, x, columns * h - x, y);
      const expected = mask[c] ? 0 : 0.4 * (1 - (j + 0.5) / rows) * smoothstep(0, COAST, distance);
      near(z[c], expected, 1e-12, `plane ${outlets} ${i},${j}`);
    }
  }
  const dome = initialTerrain({ columns: 18, rows: 18, shape: "dome", relief: 0.5, roughness: 0, frequency: 3, octaves: 3, outlets: "edges" }, 3);
  for (let j = 1; j < 17; j++) for (let i = 1; i < 17; i++) {
    const u = (i + 0.5) / 18, v = (j + 0.5) / 18, x = (i + 0.5) / 18, y = (j + 0.5) / 18;
    const d2 = (2 * u - 1) ** 2 + (2 * v - 1) ** 2, ramp = smoothstep(0, COAST, Math.min(x, y, 1 - x, 1 - y));
    near(dome[j * 18 + i], 0.5 * Math.max(0, 1 - d2) * ramp, 1e-12, `dome ${i},${j}`);
  }
  const noise = { columns: 24, rows: 24, shape: "noise" as const, relief: 0.3, roughness: 1, frequency: 4, octaves: 4, outlets: "edges" as const };
  assert.deepEqual(initialTerrain(noise, 7), initialTerrain(noise, 7));
  assert.notDeepEqual(initialTerrain(noise, 7), initialTerrain(noise, 8));
  const z = initialTerrain(noise, 7);
  assert.ok(Math.max(...z) <= 0.3 && Math.min(...z) >= 0);
});

test("coastal ramp is 0 on outlets, 1 far inland and increases away from the outlet side", () => {
  const ramp = coastalRamp(30, 30, "bottom");
  for (let i = 0; i < 30; i++) near(ramp[29 * 30 + i], smoothstep(0, COAST, 0.5 / 30), 1e-12, "the row next to the outlets");

  for (let j = 29; j > 0; j--) assert.ok(ramp[(j - 1) * 30 + 5] >= ramp[j * 30 + 5], "monotone inland");
  assert.equal(ramp[5], 1);
  const single = coastalRamp(30, 30, "single");
  assert.equal(single[29 * 30 + 15], 0, "the outlet");
  near(single[28 * 30 + 15], smoothstep(0, 0.3, 1 / 30), 1e-12);
  assert.equal(single[5], 1);
});

test("rain has mean exactly 1 in every mode, storms are seeded, and gradient rain increases along its angle", () => {
  for (const spec of [
    { mode: "uniform" as const, variation: 0.5, angle: 0, storms: 1 }, { mode: "gradient" as const, variation: 0.8, angle: 30, storms: 1 },
    { mode: "storms" as const, variation: 0.9, angle: 0, storms: 4 }, { mode: "storms" as const, variation: 0.3, angle: 0, storms: 1 },
  ]) {
    const rain = rainField({ columns: 20, rows: 14, ...spec }, 5);
    near(rain.reduce((a, b) => a + b, 0) / rain.length, 1, 1e-12, spec.mode);
    assert.ok(rain.every((v) => v >= 0));
  }
  assert.deepEqual(rainField({ columns: 20, rows: 14, mode: "storms", variation: 0.9, angle: 0, storms: 3 }, 5), rainField({ columns: 20, rows: 14, mode: "storms", variation: 0.9, angle: 0, storms: 3 }, 5));
  assert.notDeepEqual(rainField({ columns: 20, rows: 14, mode: "storms", variation: 0.9, angle: 0, storms: 3 }, 5), rainField({ columns: 20, rows: 14, mode: "storms", variation: 0.9, angle: 0, storms: 3 }, 6));
  const east = rainField({ columns: 20, rows: 20, mode: "gradient", variation: 0.6, angle: 0, storms: 1 }, 0);
  for (let j = 0; j < 20; j++) for (let i = 0; i + 1 < 20; i++) assert.ok(east[j * 20 + i + 1] > east[j * 20 + i], "wetter toward +x");
  const south = rainField({ columns: 20, rows: 20, mode: "gradient", variation: 0.6, angle: 90, storms: 1 }, 0);
  assert.ok(south[19 * 20 + 3] > south[3]);
  near(south[3 * 20 + 3], south[3 * 20 + 15], 1e-12, "constant across the wet direction");
});

test("bedrock hardness stays in [0, 1], uniform is 0 and layers are constant along their bands", () => {
  const uniform = bedrockField({ columns: 16, rows: 16, kind: "uniform", scale: 4, angle: 0 }, 1);
  assert.ok(uniform.every((v) => v === 0));
  for (const kind of ["layers", "blobs"] as const) {
    const hard = bedrockField({ columns: 24, rows: 24, kind, scale: 5, angle: 20 }, 2);
    assert.ok(hard.every((v) => v >= 0 && v <= 1));
    assert.ok(hard.some((v) => v > 0.9) && hard.some((v) => v < 0.1), `${kind} has both hard and soft rock`);
  }
});

/* ---------------------------------------------------------------------------------- the model, step */

/** A plane falling 0.4 per unit toward the bottom outlet row: every column drains straight down. */
const planeParams = (over: Partial<ErosionParams> = {}) => params({ columns: 6, rows: 8, shape: "plane", outlets: "bottom", ...over });
const planeHeights = (columns: number, rows: number, slope: number) => {
  const h = 1 / Math.max(columns, rows), z = new Float64Array(columns * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) z[j * columns + i] = slope * (rows - 1 - j) * h;
  return z;
};

test("stream power on a plane: elevation change is K A^m S^n per cell, and eroded mass leaves at the outlet", () => {
  for (const [m, n] of [[0.5, 1], [0.4, 1.5], [1, 2]] as const) {
    const p = planeParams({ erodibility: 0.01, areaExponent: m, slopeExponent: n }), h = 1 / 8, slope = 0.4, z0 = planeHeights(6, 8, slope);
    const state = stepFrom(p, z0);
    let eroded = 0;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 6; i++) {
      const area = (j + 1) * h * h, e = j === 7 ? 0 : 0.01 * area ** m * slope ** n;
      near(state.height[j * 6 + i], z0[j * 6 + i] - e, 1e-14, `m ${m} n ${n} cell ${i},${j}`);
      eroded += e * h * h;
    }
    near(state.eroded, eroded, 1e-14); near(state.exported, eroded, 1e-14, "no deposition: everything eroded is exported");
    near(state.deposited, 0, 0);
  }
});

test("a step never lowers a cell below its receiver: a huge erodibility moves each cell exactly to the old level of the cell below", () => {
  const p = planeParams({ erodibility: 1e3 }), z0 = planeHeights(6, 8, 0.4), state = stepFrom(p, z0);
  for (let j = 0; j < 7; j++) for (let i = 0; i < 6; i++) near(state.height[j * 6 + i], z0[(j + 1) * 6 + i], 1e-14, `cell ${i},${j}`);
  for (let i = 0; i < 6; i++) assert.equal(state.height[7 * 6 + i], 0);
});

test("deposition on a plane follows the carry-and-drop rule with the raise limit, cell by cell", () => {
  const h = 1 / 8, slope = 0.4, drop = slope * h, K = 0.5, p = planeParams({ erodibility: K, deposition: 1, carrying: 0 }), z0 = planeHeights(6, 8, slope);
  const state = stepFrom(p, z0), column = 2;
  let load = 0;
  for (let j = 0; j < 7; j++) {
    const area = (j + 1) * h * h, potential = K * Math.sqrt(area) * slope, erosion = Math.min(potential, drop);
    const out = load + erosion * h * h, room = j === 0 ? 0 : drop, deposit = Math.min(out / (h * h), room);
    near(state.height[j * 6 + column], z0[j * 6 + column] - erosion + deposit, 1e-13, `row ${j}`);
    load = out - deposit * h * h;
  }
  near(state.exported, 6 * load, 1e-13, "what the columns carry out");
  assert.ok(state.deposited > 0 && state.exported < state.eroded);
  near(state.exported, state.eroded - state.deposited, 1e-14);
});

test("lakes do not erode and trap sediment: a filled pit is never lowered and only rises with deposition", () => {
  // A slope falling to the bottom outlets with a sunken pit in the middle; the slope above drains into it.
  const columns = 12, rows = 12, z = new Float64Array(columns * rows), pit: number[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) z[j * columns + i] = 0.5 * (rows - 1 - j) / (rows - 1);
  for (let j = 5; j <= 6; j++) for (let i = 4; i <= 7; i++) { z[j * columns + i] = 0.01; pit.push(j * columns + i); }
  const outlets = outletMask(columns, rows, "bottom"), { filled } = fillDepressions(z, columns, rows, outlets);
  const level = filled[pit[0]];
  assert.ok(level > 0.15 && pit.every((c) => filled[c] > 0.15), "the pit is a lake filled to its lip");
  const dry = stepFrom(params({ columns, rows, outlets: "bottom", erodibility: 5 }), z);
  const wet = stepFrom(params({ columns, rows, outlets: "bottom", erodibility: 5, deposition: 1, carrying: 0 }), z);
  for (const c of pit) {
    assert.equal(dry.height[c], 0.01, "no erosion on a lake bed");
    assert.ok(wet.height[c] >= 0.01 && wet.height[c] <= filled[c] + 1e-12, "deposition only raises it, and not above the lake surface");
  }
  assert.ok(pit.some((c) => wet.height[c] > 0.01), "sediment from the slope above reaches the lake");
});

test("hillslope creep of a spike: neighbours gain the diffusion share, the centre loses four shares, and mass is exact", () => {
  const columns = 11, h = 1 / 11, kappaOverH2 = 0.05, creep = kappaOverH2 * h * h / 1e-5;
  const p = params({ columns, rows: columns, creep }), spike = new Float64Array(columns * columns);
  spike[5 * columns + 5] = 0.2;
  assert.equal(creepSubsteps(p), 1);
  const state = stepFrom(p, spike);
  near(state.height[5 * columns + 5], 0.2 * (1 - 4 * kappaOverH2), 1e-14);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) near(state.height[(5 + dy) * columns + 5 + dx], 0.2 * kappaOverH2, 1e-14);
  near(state.height[6 * columns + 6], 0, 0, "diagonal cells are untouched by one 4-neighbour sub-step");
  near(volume(p, state.height), volume(p, spike), 1e-15);
});

test("creep in several sub-steps equals an independent explicit diffusion and conserves mass exactly", () => {
  const columns = 16, rows = 12, p = params({ columns, rows, creep: 100 }), random = mulberry(4);
  const z0 = new Float64Array(columns * rows);
  for (let c = 0; c < z0.length; c++) z0[c] = random();
  const outlets = outletMask(columns, rows, "edges");
  for (let c = 0; c < z0.length; c++) if (outlets[c]) z0[c] = 0;
  const h = 1 / 16, factor = 4 * 100 * 1e-5 / (h * h), substeps = Math.ceil(factor / 0.5);
  assert.equal(creepSubsteps(p), substeps);
  assert.ok(substeps > 1);
  let z = Float64Array.from(z0);
  for (let s = 0; s < substeps; s++) {
    const next = Float64Array.from(z);
    for (let j = 1; j < rows - 1; j++) for (let i = 1; i < columns - 1; i++) {
      const c = j * columns + i;
      let sum = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nb = (j + dy) * columns + i + dx; if (!outlets[nb]) sum += z[nb] - z[c]; }
      next[c] = z[c] + factor / substeps / 4 * sum;
    }
    z = next;
  }
  const state = stepFrom(p, z0);
  for (let c = 0; c < z.length; c++) near(state.height[c], z[c], 1e-13, `cell ${c}`);
  near(volume(p, state.height), volume(p, z0), 1e-14);
  const rough = (a: ArrayLike<number>) => { let s = 0; for (let c = 0; c + 1 < a.length; c++) s += (a[c + 1] - a[c]) ** 2; return s; };
  assert.ok(rough(state.height) < rough(z0), "diffusion smooths");
});

test("mass ledger: change in volume is uplift - eroded + deposited, and exported = eroded - deposited, over many steps and settings", () => {
  const configs: Partial<ErosionParams>[] = [
    { erodibility: 0.05 }, { erodibility: 0.05, deposition: 0.6, carrying: 0.5 },
    { erodibility: 0.03, deposition: 0.3, uplift: 0.001, creep: 20, bedrock: "layers", bedrockContrast: 0.8, bedrockScale: 3, bedrockAngle: 20 },
    { erodibility: 0.04, deposition: 1, carrying: 0.2, outlets: "single", rainMode: "storms", rainVariation: 0.9, storms: 3 },
    { erodibility: 0.08, slopeExponent: 2, areaExponent: 0.4, outlets: "bottom", rainMode: "gradient", rainVariation: 0.7, rainAngle: 45, uplift: 0.0005, deposition: 0.2 },
  ];
  for (const [index, over] of configs.entries()) {
    const p = params({ columns: 20, rows: 16, shape: "dome", roughness: 0.6, ...over }), snaps = erodedTerrain(p, 10 + index, 40);
    const start = snaps.history[0].value, end = snaps.final;
    const change = volume(p, end.height) - volume(p, start.height);
    near(change, end.uplifted - end.eroded + end.deposited, 1e-12, `config ${index} volume balance`);
    near(end.exported, end.eroded - end.deposited, 1e-12, `config ${index} exported`);
    assert.ok(end.eroded > 0 && end.deposited >= 0 && end.exported >= 0);
    assert.ok(Math.min(...end.height) >= 0, "nothing goes below base level");
  }
});

test("erosion alone never raises ground and settles; with nothing to do the first step is already a fixed point", () => {
  const still = erodedTerrain(params({ columns: 16, rows: 16 }), 3, 3);
  assert.deepEqual(Array.from(still.final.height), Array.from(still.history[0].value.height));
  assert.ok(hasSettled(still.final) && still.final.change === 0);
  assert.equal(hasSettled(erodedTerrain(params({ columns: 16, rows: 16 }), 3, 0).final), false, "step 0 has not taken a step");
  const p = params({ columns: 16, rows: 16, shape: "dome", roughness: 0.5, erodibility: 0.3 });
  let previous = erodedTerrain(p, 4, 0).final;
  let settledAt = -1;
  for (let steps = 1; steps <= 300; steps++) {
    const next = erodedTerrain(p, 4, steps).final;
    for (let c = 0; c < next.height.length; c++) assert.ok(next.height[c] <= previous.height[c] + 1e-15, `cell ${c} rose at step ${steps}`);
    if (settledAt < 0 && hasSettled(next, 1e-6)) settledAt = steps;
    previous = next;
  }
  assert.ok(settledAt > 0 && settledAt < 300, `settled at step ${settledAt}`);
});

test("the model satisfies the stateful guarantees: replay, prefix, checkpoint spacing, resume", () => {
  checkSimulation(erosionSimulation, params({ columns: 14, rows: 11, shape: "dome", roughness: 0.5, erodibility: 0.05, deposition: 0.4, uplift: 0.0005, creep: 10 }), 21, 9);
  checkSimulation(erosionSimulation, params({ columns: 10, rows: 12, outlets: "single", rainMode: "storms", rainVariation: 0.8, storms: 2, bedrock: "blobs", bedrockContrast: 0.5, bedrockScale: 3, erodibility: 0.08 }), 22, 8);
});

test("work and creep bounds throw naming the control to change", () => {
  const big = params({ columns: 300, rows: 300 });
  assert.throws(() => checkErosionWork(big, 400), /lower steps or the resolution/);
  assert.throws(() => checkErosionWork(params(), 9999), /steps/);
  assert.throws(() => creepSubsteps(params({ columns: 384, rows: 384, creep: 40 })), /lower creep or the resolution/);
  assert.ok(MAX_EROSION_WORK > 1e8);
  const input = createInstrument("drainage-erosion");
  input.params = { ...input.params, resolution: 384, steps: 300 };
  assert.throws(() => validateInstrument(input), /steps|resolution/);
  input.params = { ...input.params, resolution: 384, steps: 10, creep: 40 };
  assert.throws(() => validateInstrument(input), /creep/);
});

/* ----------------------------------------------------------------------------------------- contours */

test("contours of a linear ramp are straight open chains exactly on the level", () => {
  const columns = 9, rows = 7, values = new Float64Array(columns * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) values[j * columns + i] = i / 8;
  const paths = gridContours({ values, columns, rows, x0: 10, y0: 20, dx: 4, dy: 5 }, [0.25, 0.5, 0.8125], 1);
  assert.equal(paths.length, 3);
  for (const path of paths) {
    assert.equal(path.closed, false);
    assert.equal(path.points.length, rows - 1 + 1, "one crossing per row edge of the column pair");
    for (const [x] of path.points) near(x, 10 + 32 * path.level, 1e-12);
    assert.deepEqual(path.points.map(([, y]) => y), [20, 25, 30, 35, 40, 45, 50]);
  }
  assert.equal(new Set(paths.map((p) => p.id)).size, 3);
});

test("contours of a cone are closed loops at the right radius; vertex count equals the number of crossed grid edges", () => {
  const columns = 41, rows = 41, values = new Float64Array(columns * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) values[j * columns + i] = Math.hypot(i - 20, j - 20);
  const levels = [5, 9.5, 14];
  const paths = gridContours({ values, columns, rows, x0: 0, y0: 0, dx: 1, dy: 1 }, levels, 2);
  assert.equal(paths.length, 3);
  paths.forEach((path, k) => {
    assert.ok(path.closed);
    for (const [x, y] of path.points) near(Math.hypot(x - 20, y - 20), levels[k], 0.06, "on the circle");
    let crossings = 0;
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      if (i + 1 < columns && (values[j * columns + i] >= levels[k]) !== (values[j * columns + i + 1] >= levels[k])) crossings++;
      if (j + 1 < rows && (values[j * columns + i] >= levels[k]) !== (values[(j + 1) * columns + i] >= levels[k])) crossings++;
    }
    assert.equal(path.points.length, crossings, "every crossed edge is a vertex of exactly one chain");
  });
});

test("contour saddles: the cell centre decides which corners are joined", () => {
  const level = 0.5;
  // a = top-left, c = bottom-right high (1), b = top-right, d = bottom-left low (0): centre mean 0.5 >= level joins a and c, cutting off b and d.
  const joined = gridContours({ values: [1, 0, 0, 1], columns: 2, rows: 2, x0: 0, y0: 0, dx: 1, dy: 1 }, [level], 1);
  assert.equal(joined.length, 2);
  const corners = joined.map((p) => p.points.map(([x, y]) => `${x},${y}`).sort().join("|")).sort();
  assert.deepEqual(corners, ["0,0.5|0.5,1", "0.5,0|1,0.5"]);
  // Raise the level above the mean: a and c are separated instead, each cut off in its own corner.
  const split = gridContours({ values: [1, 0, 0, 1], columns: 2, rows: 2, x0: 0, y0: 0, dx: 1, dy: 1 }, [0.6], 1);
  assert.equal(split.length, 2);
  const cut = split.map((p) => p.points.map(([x, y]) => `${x},${y}`).sort().join("|")).sort();
  assert.deepEqual(cut, ["0,0.4|0.4,0", "0.6,1|1,0.6"]);
});

test("contour assembly is linear: a noisy field with tens of thousands of segments on one level is assembled", () => {
  const columns = 220, rows = 220, values = randomTerrain(columns, rows, 3);
  const paths = gridContours({ values, columns, rows, x0: 0, y0: 0, dx: 1, dy: 1 }, [0.5], 1);
  const vertices = paths.reduce((sum, p) => sum + p.points.length, 0);
  assert.ok(vertices > 20_000, `${vertices} vertices`);
  assert.throws(() => terrainContours(new Float64Array(16), 4, 4, { left: 0, top: 0, cell: 1 }, 1e-9, 10, 1), /raise the contour interval/);
});

/* -------------------------------------------------------------------------------- hillshade, lakes */

test("hillshade: ground facing the light is lit, ground facing away is shaded, flat ground draws nothing", () => {
  const columns = 12, rows = 12, frame = { left: 0, top: 0, cell: 10 }, light = { azimuth: 90, elevation: 30 };
  const ramp = (sign: number) => { const z = new Float64Array(columns * rows); for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) z[j * columns + i] = sign * 0.05 * i; return z; };
  const flat = hillshadePatch(new Float64Array(columns * rows), columns, rows, frame, light, 3, 0.1);
  assert.equal(flat.bands.length, 0);
  const facing = hillshadePatch(ramp(-1), columns, rows, frame, light, 3, 0.1), away = hillshadePatch(ramp(1), columns, rows, frame, light, 3, 0.1);
  assert.ok(facing.bands.length > 0 && facing.bands.every((b) => b.side === "light"));
  assert.ok(away.bands.length > 0 && away.bands.every((b) => b.side === "shadow"));
});

test("lakes: depressions deeper than the threshold become regions, and dry terrain has none", () => {
  const columns = 14, rows = 14, frame = { left: 0, top: 0, cell: 10 }, outlets = outletMask(columns, rows, "edges");
  const z = new Float64Array(columns * rows).fill(1);
  for (let c = 0; c < z.length; c++) if (outlets[c]) z[c] = 0;
  for (let j = 5; j <= 8; j++) for (let i = 5; i <= 8; i++) z[j * columns + i] = 0.4;
  const spec = { columns, rows, outlets: "edges" as const, rainMode: "uniform" as const, rainVariation: 0, rainAngle: 0, storms: 1 };
  const drainage = analyzeDrainage(z, spec, 1);
  const lake = lakeDomain(z, drainage.depth, columns, rows, 1, 0.3, frame);
  assert.equal(lake.regions.length, 1);
  const [x0, y0, x1, y1] = lake.bounds!;
  assert.ok(x0 > 40 && x1 < 100 && y0 > 40 && y1 < 100, "the lake sits over the pit cells only");
  assert.equal(lakeDomain(z, drainage.depth, columns, rows, 1, 0.7, frame).regions.length, 0, "a lake deeper than the pit is empty");
  const slope = planeHeights(columns, rows, 0.4), dry = analyzeDrainage(slope, { ...spec, outlets: "bottom" }, 1);
  assert.equal(lakeDomain(slope, dry.depth, columns, rows, 0.4, 0.01, frame).regions.length, 0);
});

test("basin colours differ across shared borders while colours last", () => {
  const columns = 12, rows = 6, labels = new Int32Array(columns * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) labels[j * columns + i] = 1 + Math.floor(i / 2);
  const colors = basinColors(labels, columns, rows, 6, 3);
  for (let b = 0; b + 1 < 6; b++) assert.notEqual(colors[b], colors[b + 1]);
  const star = new Int32Array(9 * 9);
  for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) star[j * 9 + i] = j < 3 && i < 3 ? 1 : j < 3 ? 2 + Math.min(2, Math.floor((i - 3) / 2)) : 2 + Math.min(4, Math.floor(i / 2) % 5);
  const overfull = basinColors(star, 9, 9, 6, 2);
  assert.ok(overfull.every((color) => color === 0 || color === 1));
  assert.deepEqual(Array.from(basinColors(labels, columns, rows, 6, 3)), Array.from(colors));
});

/* ----------------------------------------------------------------------------- streams and basins */

/** A hand-made drainage: a Y of nine stream cells on a 5 x 5 grid. Cell index = 5 row + column. */
function handDrainage(): Drainage {
  const n = 25, receivers = new Int32Array(n).fill(-1), flow = new Float64Array(n).fill(1), rain = new Float64Array(n).fill(1);
  const link = (from: number, to: number) => { receivers[from] = to; };
  link(0, 6); link(6, 12); link(4, 8); link(8, 12); link(12, 17); link(17, 22);
  Object.assign(flow, { 6: 2, 8: 2, 12: 5, 17: 6, 22: 7 });
  const outlets = new Uint8Array(n); outlets[22] = 1;
  const order = Int32Array.from([22, 17, 12, 6, 8, 0, 4, ...[1, 2, 3, 5, 7, 9, 10, 11, 13, 14, 15, 16, 18, 19, 20, 21, 23, 24]]);
  return { columns: 5, rows: 5, spacing: 0.2, height: new Float64Array(n), filled: new Float64Array(n), order, receivers, outlets, rain, flow, depth: new Float64Array(n), totalRain: 25 };
}

test("stream network of a hand-made Y: nodes, reaches, ids, Strahler order and graph weights", () => {
  const net = streamNetwork(handDrainage(), { left: 100, top: 200, cell: 10 }, { threshold: 0.06, smooth: 0 }, 7);
  // limit = 0.06 * 25 = 1.5: cells 6, 8, 12, 17, 22 are streams; 0 and 4 (flow 1) are not.
  assert.equal(net.streamCells, 5);
  assert.deepEqual(net.nodes.map((n) => [n.id, n.kind]), [["n:6", "source"], ["n:8", "source"], ["n:12", "confluence"], ["n:22", "mouth"]]);
  assert.deepEqual(net.reaches.map((r) => [r.id, r.from, r.to, r.order, r.depth, [...r.cells]]), [
    ["e:6", "n:6", "n:12", 1, 1, [6, 12]], ["e:8", "n:8", "n:12", 1, 1, [8, 12]], ["e:12", "n:12", "n:22", 2, 0, [12, 17, 22]],
  ]);
  assert.deepEqual(net.reaches[2].points.map((p) => [...p]), [[125, 225], [125, 235], [125, 245]], "cell centres in canvas units");
  assert.equal(net.graph.directed, true);
  assert.deepEqual(net.graph.edges.map((e) => [e.id, e.from, e.to, e.age]), [["e:6", "n:6", "n:12", 1], ["e:8", "n:8", "n:12", 1], ["e:12", "n:12", "n:22", 2]]);
  near(net.graph.edges[0].weight, 5 / 7); near(net.graph.edges[2].weight, 1);
  assert.equal(net.maxFlow, 7);
});

test("smoothing keeps reaches attached to their nodes and their flow between the end values", () => {
  const drainage = handDrainage();
  const rough = streamNetwork(drainage, { left: 0, top: 0, cell: 10 }, { threshold: 0.06, smooth: 0 }, 1);
  const smooth = streamNetwork(drainage, { left: 0, top: 0, cell: 10 }, { threshold: 0.06, smooth: 3 }, 1);
  assert.ok(smooth.reaches[2].points.length > rough.reaches[2].points.length);
  const position = new Map(smooth.nodes.map((n) => [n.id, n.position]));
  for (const reach of smooth.reaches) {
    assert.deepEqual([...reach.points[0]], [...position.get(reach.from)!]);
    assert.deepEqual([...reach.points[reach.points.length - 1]], [...position.get(reach.to)!]);
    assert.equal(reach.flow.length, reach.points.length);
    assert.ok(reach.flow.every((f) => f >= Math.min(...rough.reaches.find((r) => r.id === reach.id)!.flow) - 1e-12 && f <= 1 + 1e-12));
  }
});

test("hand-made basins: small tributary basins merge into the basin downstream of them", () => {
  const drainage = handDrainage(), net = streamNetwork(drainage, { left: 0, top: 0, cell: 10 }, { threshold: 0.06, smooth: 0 }, 1);
  // minimum = 3 * 0.06 * 25 = 4.5 rain units; each tributary basin holds 2 (its cells plus the cell above), so both merge into the trunk basin.
  for (const depth of [0, 1, 3]) {
    const map = drainageBasins(drainage, net, depth);
    assert.equal(map.basins.length, 1);
    assert.equal(map.basins[0].id, "b:e:12");
    assert.equal(map.basins[0].cells, 7, "the five stream cells plus the two cells above the tributaries");
    assert.equal(map.unassigned, 18);
    for (const c of [0, 4, 6, 8, 12, 17, 22]) assert.equal(map.labels[c], 1);
  }
});

function realWorld(over: Partial<ErosionParams> = {}, steps = 60) {
  const p = params({ columns: 40, rows: 34, shape: "plane", outlets: "bottom", roughness: 0.75, relief: 0.25, frequency: 3.5, octaves: 5, erodibility: 0.02, uplift: 0.0005, creep: 0.2, deposition: 0.3, ...over });
  const snaps = erodedTerrain(p, 42, steps), height = snaps.final.height as Float64Array;
  const spec = { columns: p.columns, rows: p.rows, outlets: p.outlets, rainMode: p.rainMode, rainVariation: p.rainVariation, rainAngle: p.rainAngle, storms: p.storms };
  return { p, snaps, drainage: analyzeDrainage(height, spec, 42) };
}

test("drainage of an eroded terrain: flow is rain plus the flow of every donor, and the stream forest is consistent", () => {
  const { p, drainage } = realWorld({ rainMode: "storms", rainVariation: 0.8, storms: 3 });
  const n = p.columns * p.rows, donors = new Float64Array(n);
  for (let c = 0; c < n; c++) if (drainage.receivers[c] >= 0) donors[drainage.receivers[c]] += drainage.flow[c];
  for (let c = 0; c < n; c++) near(drainage.flow[c], drainage.rain[c] + donors[c], 1e-9, `cell ${c}`);
  let outletFlow = 0;
  for (let c = 0; c < n; c++) if (drainage.outlets[c]) outletFlow += drainage.flow[c];
  near(outletFlow, drainage.totalRain, 1e-9, "all the rain leaves");
  const net = streamNetwork(drainage, { left: 0, top: 0, cell: 10 }, { threshold: 0.004, smooth: 2 }, 42);
  const mouths = net.nodes.filter((node) => node.kind === "mouth").length, ids = new Set(net.graph.nodes.map((node) => node.id));
  assert.ok(net.reaches.length > 10 && mouths > 0 && net.nodes.some((node) => node.kind === "confluence"));
  assert.equal(net.graph.edges.length, net.graph.nodes.length - mouths, "a directed forest: every node but a mouth has one edge out");
  const cells = new Set<number>();
  for (const reach of net.reaches) {
    assert.ok(ids.has(reach.from) && ids.has(reach.to));
    for (let k = 0; k + 1 < reach.cells.length; k++) {
      assert.ok(!cells.has(reach.cells[k]), "reaches partition the stream cells (the downstream node belongs to the next reach)");
      cells.add(reach.cells[k]);
      assert.equal(drainage.receivers[reach.cells[k]], reach.cells[k + 1]);
      assert.ok(drainage.flow[reach.cells[k + 1]] >= drainage.flow[reach.cells[k]], "flow never decreases downstream");
    }
  }
  const incoming = new Map<string, number[]>();
  for (const edge of net.graph.edges) incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge.age]);
  for (const edge of net.graph.edges) {
    const fed = incoming.get(edge.from) ?? [];
    const top = fed.length ? Math.max(...fed) : 0, expected = fed.length === 0 ? 1 : fed.filter((a) => a === top).length >= 2 ? top + 1 : top;
    assert.equal(edge.age, expected, `Strahler order of ${edge.id}`);
  }
});

test("basins partition the drained cells, and every cell of a basin drains to the mouth of its river", () => {
  const { p, drainage } = realWorld({}, 60);
  const net = streamNetwork(drainage, { left: 0, top: 0, cell: 10 }, { threshold: 0.006, smooth: 0 }, 42), n = p.columns * p.rows;
  const map = drainageBasins(drainage, net, 0);
  assert.ok(map.basins.length >= 2);
  let labeled = 0;
  for (const basin of map.basins) labeled += basin.cells;
  assert.equal(labeled + map.unassigned, n);
  const mouthOf = new Map(map.basins.map((b) => { const reach = net.reaches.find((r) => r.id === b.reach)!; return [b.label, reach.cells[reach.cells.length - 1]] as const; }));
  for (let c = 0; c < n; c++) {
    if (!map.labels[c]) continue;
    let at = c;
    while (drainage.receivers[at] >= 0) at = drainage.receivers[at];
    assert.equal(at, mouthOf.get(map.labels[c]), `cell ${c} drains to the mouth of its basin`);
  }
  const finer = drainageBasins(drainage, net, 2);
  assert.ok(finer.basins.length >= map.basins.length, "more depth never gives fewer basins");
  for (const basin of finer.basins) assert.ok(basin.cells >= 1 && basin.depth <= 2);
});

/* ---------------------------------------------------------------- the instrument and its snapshots */

const input = (params: Record<string, number | string | boolean> = {}, seed = 42, palette?: number[]): InstrumentInput => {
  const made = createInstrument("drainage-erosion");
  made.seed = seed; Object.assign(made.params, { resolution: 56, ...params });
  if (palette) made.palette = palette;
  return validateInstrument(made);
};
const products = (i: InstrumentInput) => drainageErosionProducts(drainageErosionComposition(i));

test("palette and view edits repaint the same snapshot object and the same extracted values", () => {
  const base = products(input({ steps: 25 }));
  const repainted = products(input({ steps: 25, washAlpha: 0.5, contourWeight: 1.4, streamWidth: 9, basins: "hatch" }, 42, [0x102030, 0xaa3300, 0x33aa00, 0x0033aa]));
  // Identity checks use ok(a === b): assert.equal would deep-diff these large frozen values on failure.
  assert.ok(repainted.snapshots === base.snapshots, "the retained run is reused");
  assert.ok(repainted.contours === base.contours && repainted.network === base.network && repainted.patch === base.patch, "extracted values are reused");
  assert.ok(products(input({ steps: 25, shadeDepth: 2 })).patch !== base.patch, "a shading edit re-derives only the shading");
  assert.ok(products(input({ steps: 25, shadeDepth: 2 })).snapshots === base.snapshots);
  const finer = products(input({ steps: 25, contourInterval: 0.02, streamThreshold: 0.9 }));
  assert.ok(finer.snapshots === base.snapshots, "extraction edits never touch the simulation");
  assert.ok(finer.contours !== base.contours && finer.network !== base.network);
});

test("a treatment reads the same state as its siblings: routing, contours and shading all derive from the published height", () => {
  const p = products(input({ steps: 25, lakes: true, marks: "both" }));
  assert.ok(p.drainage!.height === p.terrain.height, "routing reads the published height array");
  assert.ok(p.contours!.length > 0 && p.network!.reaches.length > 0 && p.basins!.map.basins.length > 0 && p.patch!.bands.length > 0 && p.lakes !== null);
  const top = Math.max(...p.terrain.height);
  for (const path of p.contours!) assert.ok(path.level > 0 && path.level <= top + 1e-12);
  for (const reach of p.network!.reaches) for (const c of reach.cells) assert.ok(p.drainage!.flow[c] >= 0.003 * p.drainage!.totalRain - 1e-9, "every stream cell carries at least the threshold");
});

test("meaningful initial-condition edits recompute, hidden ones do not", () => {
  const base = products(input({ steps: 20 }));
  for (const edit of [{ relief: 0.3 }, { erodibility: 0.03 }, { rainMode: "gradient" }, { outlets: "sides" }, { shape: "ridge" }, { bedrock: "layers" }, { deposition: 0.5 }, { uplift: 0.001 }, { creep: 0.5 }, { resolution: 60 }]) {
    const other = products(input({ steps: 20, ...edit }));
    assert.ok(other.snapshots !== base.snapshots, JSON.stringify(edit));
    assert.notEqual(other.snapshots.key, base.snapshots.key, JSON.stringify(edit));
  }
  assert.notDeepEqual(Array.from(products(input({ steps: 20 }, 43)).terrain.height), Array.from(base.terrain.height), "the seed changes the terrain");
  for (const edit of [{ bedrockScale: 9 }, { bedrockAngle: -40 }, { bedrockContrast: 0.2 }, { rainVariation: 0.1 }, { rainAngle: 10 }, { storms: 5 }]) {
    assert.ok(products(input({ steps: 20, ...edit })).snapshots === products(input({ steps: 20 })).snapshots, `hidden ${JSON.stringify(edit)} reuses the run`);
    assert.equal(drawFingerprint(input({ steps: 20, ...edit })), drawFingerprint(input({ steps: 20 })), `hidden ${JSON.stringify(edit)} does not change the drawing`);
  }
  const noiseShape = drawFingerprint(input({ shape: "noise", steps: 20, roughness: 0.1 }));
  assert.equal(noiseShape, drawFingerprint(input({ shape: "noise", steps: 20, roughness: 0.9 })), "roughness is hidden for pure noise");
  assert.ok(products(input({ steps: 20, deposition: 0, carrying: 2.5 })).snapshots === products(input({ steps: 20, deposition: 0, carrying: 0.3 })).snapshots, "carrying has no effect at zero deposition");
});

test("scrubbing steps extends the cached run, and earlier steps are a prefix of later ones", () => {
  const short = products(input({ steps: 20 })), long = products(input({ steps: 50 }));
  assert.equal(short.snapshots.construction, long.snapshots.construction);
  assert.ok(long.snapshots.work > short.snapshots.work);
  const again = products(input({ steps: 20 }));
  assert.ok(again.snapshots === short.snapshots);
  assert.deepEqual(Array.from(products(input({ steps: 20 })).terrain.height), Array.from(short.terrain.height));
  const back = erodedTerrain(short.snapshots.params as ErosionParams, 42, 35);
  const scratch = (() => { erosionCache.clear(); return erodedTerrain(short.snapshots.params as ErosionParams, 42, 35); })();
  assert.deepEqual(Array.from(back.final.height), Array.from(scratch.final.height), "replay from a checkpoint equals a run from scratch");
});

test("the drawing is deterministic, follows the seed and paints no background", () => {
  const a = drawFingerprint(input({ steps: 15 })), b = drawFingerprint(input({ steps: 15 }));
  assert.equal(a, b);
  assert.notEqual(a, drawFingerprint(input({ steps: 15 }, 7)));
  assert.notEqual(a, drawFingerprint(input({ steps: 45 })), "later steps look different");
  assert.notEqual(drawFingerprint(input({ steps: 15, streams: "none" })), a);
  const calls: string[] = [];
  const surface = new Proxy({ CLOSE: "close", ROUND: "round" } as Record<string, unknown>, { get: (t, k: string) => k in t ? t[k] : (...args: unknown[]) => { calls.push(k); void args; } });
  drawInstrument(surface as never, input({ steps: 10 }));
  assert.ok(calls.length > 100 && !calls.includes("background") && !calls.includes("rect"), "only polygons and lines: the host owns the paper");
});

test("cancelled preparation publishes and caches nothing; an uncancelled one retains the run", async () => {
  assert.equal(canPrepareInstrument("drainage-erosion"), true);
  const fresh = input({ steps: 30, relief: 0.2731 });
  const composition = drainageErosionComposition(fresh), terrain = composition.terrain;
  const cached = () => erosionCache.has(erosionSimulation, terrain, 42, { steps: 30, checkpointEvery: 25, historyEvery: 0 });
  assert.equal(await prepareInstrument(fresh, () => true), false);
  assert.equal(cached(), false);
  let polls = 0;
  assert.equal(await prepareInstrument(fresh, () => ++polls > 12), false, "cancelled between steps");
  assert.ok(polls > 12);
  assert.equal(cached(), false, "no partial cache");
  assert.equal(await prepareInstrument(fresh, () => false), true);
  assert.equal(cached(), true);
});

test("definition: control groups, conditional controls and slider intervals inside hard limits", () => {
  const item = definition("drainage-erosion");
  assert.ok(item.parameters.length > 40);
  for (const p of item.parameters.filter((q) => q.type === "number")) {
    assert.ok((p.hardMin ?? p.min!) <= p.min! && (p.hardMax ?? p.max!) >= p.max!, `${p.key} slider inside hard limits`);
    assert.ok(Number(item.defaults[p.key]) >= p.min! && Number(item.defaults[p.key]) <= p.max!, `${p.key} default on its slider`);
  }
  const shown = (values: Record<string, string | boolean>) => visibleParameters("drainage-erosion", { ...item.defaults, ...values }).map((p) => p.key);
  assert.ok(!shown({ bedrock: "uniform" }).includes("bedrockScale") && shown({ bedrock: "layers" }).includes("bedrockAngle") && !shown({ bedrock: "blobs" }).includes("bedrockAngle"));
  assert.ok(!shown({ shape: "noise" }).includes("roughness") && shown({ shape: "dome" }).includes("roughness"));
  assert.ok(!shown({ contours: false }).includes("ghost") && !shown({ streams: "none" }).includes("streamSmooth") && shown({ streams: "ribbon" }).includes("streamWidth"));
  assert.ok(shown({ streams: "beads" }).includes("streamSpacing") && !shown({ streams: "ink" }).includes("streamSpacing"));
  const tree = inspectorItems("drainage-erosion", { ...item.defaults });
  assert.deepEqual(tree.map((entry) => entry.label).slice(0, 2), ["Terrain", "Placement"]);
  assert.equal(usesSeed(createInstrument("drainage-erosion")), true);
  const plain = createInstrument("drainage-erosion");
  Object.assign(plain.params, { shape: "dome", roughness: 0, rainMode: "uniform", bedrock: "uniform" });
  assert.equal(usesSeed(plain), false);
  assert.equal(drawFingerprint({ ...plain, params: { ...plain.params, steps: 8, resolution: 48 }, seed: 1 }), drawFingerprint({ ...plain, params: { ...plain.params, steps: 8, resolution: 48 }, seed: 2 }));
});

test("every slider corner is admitted: the largest resolution, steps and creep together stay inside the work bound", () => {
  const item = definition("drainage-erosion"), top = Object.fromEntries(["resolution", "steps", "creep"].map((key) => [key, item.parameters.find((p) => p.key === key)!.max!]));
  const corner = createInstrument("drainage-erosion");
  Object.assign(corner.params, top);
  assert.doesNotThrow(() => validateInstrument(corner));
  const p = erosionParamsFor(corner.params);
  assert.ok(creepSubsteps(p) <= 3, "creep sub-steps at the slider corner");
  const work = p.columns * p.rows * (6 + 250 * (8 + creepSubsteps(p)));
  assert.ok(work < 0.5 * MAX_EROSION_WORK, `slider corner costs ${work} units, well inside the ${MAX_EROSION_WORK} bound`);
});

test("footprint: the longer side is exact, cells are square and the shorter side snaps to whole cells", () => {
  const f = drainageFootprint({ ...definition("drainage-erosion").defaults, width: 500, height: 300, resolution: 100, centerX: 300, centerY: 250 });
  near(f.cell, 5, 1e-12); assert.equal(f.columns, 100); assert.equal(f.rows, 60);
  near(f.left, 300 - 250, 1e-12); near(f.top, 250 - 150, 1e-12);
  const g = drainageFootprint({ ...definition("drainage-erosion").defaults, width: 333, height: 501, resolution: 90 });
  near(g.cell * g.rows, 501, 1e-9); assert.equal(g.columns, Math.round(333 / g.cell));
  assert.deepEqual(erosionParamsFor({ ...definition("drainage-erosion").defaults }).columns, 112);
});
