import assert from "node:assert/strict";
import test from "node:test";
import { sensorMotorStep2D } from "@procedurals/javascript";
import {
  barrierMask, barrierThickness, bundledBarrier, canPrepareInstrument, checkChemotaxis, checkSimulation, chemicalField, chemotacticProducts, chemotacticSnapshots,
  chemotacticTrailsComposition, chemotaxisAgents, colonyGeometry, barrierBlocks, chemotaxisCache, chemotaxisRunOptions, chemotaxisSimulation, chemotaxisSnapshots, chemotaxisTrails,
  contourLevels, createInstrument, drawChemotacticTrails, drawInstrument, emitterLayout, fieldContourPaths, inspectorItems, prepareChemotaxis, prepareInstrument,
  definition, validateInstrument, relaxField, runChemotaxis, chemotaxisStepWork, totalAgents, sampleField, stateAt, visibleParameters, CHEMOTAXIS_ARENA, CHEMOTAXIS_LIMITS, SENSE_FLOOR,
  type ChemotaxisConstruction, type ChemotaxisSnapshots, type CompositionSurface, type DrawingContext,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.js";

class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  ops: string[] = [];
  #note(name: string, args: unknown[]) { this.ops.push(`${name}(${args.map((v) => typeof v === "number" ? Number(v.toFixed(9)) : String(v)).join(",")})`); }
  push() { this.#note("push", []); } pop() { this.#note("pop", []); }
  translate(...a: number[]) { this.#note("translate", a); } rotate(...a: number[]) { this.#note("rotate", a); }
  scale(...a: number[]) { this.#note("scale", a); }
  noFill() { this.#note("noFill", []); } noStroke() { this.#note("noStroke", []); }
  fill(...a: number[]) { this.#note("fill", a); } stroke(...a: number[]) { this.#note("stroke", a); }
  strokeWeight(...a: number[]) { this.#note("strokeWeight", a); } strokeCap(...a: unknown[]) { this.#note("strokeCap", a); }
  circle(...a: number[]) { this.#note("circle", a); } line(...a: number[]) { this.#note("line", a); }
  rect(...a: number[]) { this.#note("rect", a); } beginShape() { this.#note("beginShape", []); }
  vertex(...a: number[]) { this.#note("vertex", a); } endShape(...a: unknown[]) { this.#note("endShape", a); }
}

const near = (actual: number, expected: number, tolerance = 1e-9, note = "") =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);

/** One agent on a 64-cell grid with no chemistry: the simplest colony. */
const colony = (over: Partial<ChemotaxisConstruction> = {}): ChemotaxisConstruction => ({
  emitters: [{ x: 320, y: 320, agents: 1, strength: 1 }], spawnRadius: 0, release: 0, lifespan: 0, deposit: 0, beacon: 0, diffusion: 0, decay: 0,
  reach: 20, sensorAngle: 40, turnRate: 60, attraction: 1, wander: 0, speed: 2, edge: "wall", grid: 64, barrier: [], ...over,
});
const instrumentWith = (params: Record<string, number | string | boolean> = {}, seed = 42) => {
  const input = createInstrument("chemotactic-trails");
  return { ...input, seed, params: { ...input.params, ...params } };
};
const recipeFor = (params: Record<string, number | string | boolean> = {}, seed = 42) => chemotacticTrailsComposition(instrumentWith(params, seed));
const cellOf = (v: number, grid: number) => Math.floor(v / (CHEMOTAXIS_ARENA / grid));

test("relaxation moves exactly a quarter of the diffusion share to each open neighbour and loses exactly the decay share", () => {
  const grid = 16, wall = new Uint8Array(grid * grid), field = new Float64Array(grid * grid);
  field[8 * grid + 8] = 100;
  const out = relaxField(field, wall, grid, "wall", 0.4, 0.1);
  near(out[8 * grid + 8], 100 * (1 - 0.4) * 0.9, 1e-12);
  for (const k of [7 * grid + 8, 9 * grid + 8, 8 * grid + 7, 8 * grid + 9]) near(out[k], 100 * (0.4 / 4) * 0.9, 1e-12);
  near(out.reduce((a, b) => a + b, 0), 90, 1e-12);
  // A corner cell has two open neighbours (wall mode) or four (torus); the total is conserved either way.
  const corner = new Float64Array(grid * grid); corner[0] = 100;
  const boxed = relaxField(corner, wall, grid, "wall", 0.4, 0);
  near(boxed[0], 100 - 2 * 10, 1e-12); near(boxed[1], 10, 1e-12); near(boxed[grid], 10, 1e-12);
  const torus = relaxField(corner, wall, grid, "wrap", 0.4, 0);
  near(torus[0], 60, 1e-12); near(torus[grid - 1], 10, 1e-12); near(torus[grid * (grid - 1)], 10, 1e-12);
});

test("chemical does not cross a barrier: a wall cell stays zero and its neighbours exchange nothing with it, whichever side it is on", () => {
  const grid = 16;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const wall = new Uint8Array(grid * grid), field = new Float64Array(grid * grid);
    wall[(8 + dy) * grid + 8 + dx] = 1; field[8 * grid + 8] = 100;
    const out = relaxField(field, wall, grid, "wall", 0.4, 0);
    assert.equal(out[(8 + dy) * grid + 8 + dx], 0);
    near(out[8 * grid + 8], 100 - 3 * 10, 1e-12); // three open neighbours
    near(out.reduce((a, b) => a + b, 0), 100, 1e-12);
  }
});

test("the bilinear sampler equals sensorMotorStep2D's probes and samples, in clamp and wrap boundaries", () => {
  const grid = 24, cell = CHEMOTAXIS_ARENA / grid;
  const values = Float64Array.from({ length: grid * grid }, (_, k) => Math.sin(k * 0.37) * 3 + (k % 7));
  for (const [edge, boundary] of [["wall", "clamp"], ["wrap", "wrap"]] as const) {
    for (const [x, y, h] of [[100, 200, 0.13], [5, 630, 0.9], [631, 7, 0.4], [320.5, 320.25, 0.66]] as const) {
      const op = sensorMotorStep2D({
        agents: [{ position: [x, y], headingTurns: h, speed: 0 }],
        field: { values: Array.from(values), columns: grid, rows: grid, origin: [cell / 2, cell / 2], spacing: [cell, cell], boundary },
        sensorDistance: 37, sensorAngleTurns: 0.11, turnGain: 0, dt: 1, maxWork: 3,
      });
      const { left, right } = op.probes[0], mine = (p: readonly number[]) => sampleField(values, grid, edge, p[0], p[1]);
      near(mine(left), op.samples[0].left, 1e-9, `${edge} left`); near(mine(right), op.samples[0].right, 1e-9, `${edge} right`);
    }
  }
});

test("update order: every step senses the OLD field at the OLD position, turns, then moves along the new heading", () => {
  const c = colony({
    emitters: [{ x: 300, y: 320, agents: 1, strength: 0 }, { x: 335, y: 335, agents: 0, strength: 1 }], spawnRadius: 20,
    beacon: 6, diffusion: 0.3, decay: 0.02, reach: 22, sensorAngle: 40, turnRate: 60, attraction: 0.9,
  });
  const snaps = runChemotaxis(c, 7, 24, { checkpointEvery: 1_000 });
  let turned = 0;
  for (let k = 1; k <= 24; k++) {
    const before = stateAt(snaps, k - 1), after = stateAt(snaps, k), field = chemicalField(snaps, k - 1);
    const cell = field.cell;
    const op = sensorMotorStep2D({
      agents: [{ position: [before.x[0], before.y[0]], headingTurns: before.heading[0], speed: 0 }],
      field: { values: Array.from(field.values), columns: 64, rows: 64, origin: [cell / 2, cell / 2], spacing: [cell, cell], boundary: "clamp" },
      sensorDistance: 22, sensorAngleTurns: 40 / 360, turnGain: 0, dt: 1, maxWork: 3,
    });
    const { left, right } = op.samples[0];
    const turn = 0.9 * 60 / 360 * (right - left) / (right + left + SENSE_FLOOR);
    const heading = (before.heading[0] + turn) - Math.floor(before.heading[0] + turn);
    near(after.heading[0], heading, 1e-12, `heading at step ${k}`);
    near(after.x[0], before.x[0] + 2 * Math.cos(2 * Math.PI * heading), 1e-9, `x at step ${k}`);
    near(after.y[0], before.y[0] + 2 * Math.sin(2 * Math.PI * heading), 1e-9, `y at step ${k}`);
    if (k === 1) near(after.heading[0], before.heading[0], 0, "nothing to sense at step 1");
    if (Math.abs(turn) > 1e-4) turned++;
  }
  assert.ok(turned >= 10, `only ${turned} steps were steered by the chemical`);
});

test("agents lay chemical after moving and never sense their own current deposit", () => {
  // Wide diffusion and short probes would read a fresh deposit at once if sensing came after depositing.
  const c = colony({ deposit: 50, diffusion: 0.5, reach: 6, sensorAngle: 45, turnRate: 90, grid: 48, spawnRadius: 0 });
  const snaps = runChemotaxis(c, 3, 1);
  const first = stateAt(snaps, 0), second = stateAt(snaps, 1);
  assert.equal(second.heading[0], first.heading[0]);
  near(chemicalField(snaps, 1).total, 50, 1e-9, "the deposit lands in full and is only spread by relaxation");
  // The chemical sits at the agent's NEW position.
  const field = chemicalField(snaps, 1);
  let best = 0;
  for (let k = 0; k < field.values.length; k++) if (field.values[k] > field.values[best]) best = k;
  assert.equal(best % 48, cellOf(second.x[0], 48)); assert.equal(Math.floor(best / 48), cellOf(second.y[0], 48));
});

test("agents respond to deposited signal: without chemical they walk straight, with it they turn", () => {
  const emitters = [{ x: 200, y: 320, agents: 40, strength: 1 }];
  const still = runChemotaxis(colony({ emitters, spawnRadius: 30, deposit: 0, beacon: 0 }), 11, 30);
  for (let s = 0; s < 40; s++) near(stateAt(still, 30).heading[s], stateAt(still, 0).heading[s], 0, `agent ${s} keeps its heading`);
  const laying = runChemotaxis(colony({ emitters, spawnRadius: 30, deposit: 1, diffusion: 0.3, decay: 0.05, attraction: 1 }), 11, 30);
  let changed = 0;
  for (let s = 0; s < 40; s++) if (Math.abs(stateAt(laying, 30).heading[s] - stateAt(laying, 0).heading[s]) > 0.01) changed++;
  assert.ok(changed >= 20, `${changed} of 40 agents turned`);
  // Same seed, so the difference is the chemical alone: zero attraction turns nobody even with the field present.
  const blind = runChemotaxis(colony({ emitters, spawnRadius: 30, deposit: 1, diffusion: 0.3, decay: 0.05, attraction: 0 }), 11, 30);
  for (let s = 0; s < 40; s++) near(stateAt(blind, 30).heading[s], stateAt(blind, 0).heading[s], 0);
});

test("attraction follows the chemical toward a beacon and negative attraction flees it", () => {
  const emitters = [{ x: 320, y: 320, agents: 0, strength: 1 }, { x: 320, y: 380, agents: 80, strength: 0 }];
  const spread = (attraction: number) => {
    const snaps = runChemotaxis(colony({ emitters, beacon: 6, diffusion: 0.4, decay: 0.03, reach: 30, turnRate: 60, attraction }), 5, 45);
    const s = stateAt(snaps, 45);
    let sum = 0;
    for (let i = 0; i < 80; i++) sum += Math.hypot(s.x[i] - 320, s.y[i] - 320);
    return sum / 80;
  };
  const follow = spread(1), ignore = spread(0), flee = spread(-1);
  assert.ok(follow + 15 < ignore, `following ${follow} vs ignoring ${ignore}`);
  assert.ok(ignore + 15 < flee, `ignoring ${ignore} vs fleeing ${flee}`);
});

test("a leaking emitter with no agents holds exactly the closed-form total: B (1-d)(1 - (1-d)^k) / d", () => {
  const B = 3, d = 0.07;
  const walls = bundledBarrier({ kind: "island", centerX: 480, centerY: 480, size: 70, gap: 0, pillars: 0, grid: 64, seed: 1, avoid: [] });
  for (const barrier of [[], walls]) {
    const snaps = runChemotaxis(colony({ emitters: [{ x: 200, y: 200, agents: 0, strength: 1 }], beacon: B, diffusion: 0.3, decay: d, barrier }), 1, 40);
    for (const k of [1, 7, 40]) near(chemicalField(snaps, k).total, B * (1 - d) * (1 - (1 - d) ** k) / d, 1e-9, `step ${k}`);
  }
});

test("agents lay exactly deposit x strength x steps acted: birth schedule, lifespan and total chemical", () => {
  // 3 agents (two from a strength-2 emitter), lifespan 5, no chemistry losses: total = sum over agents of deposit * strength * 5.
  const emitters = [{ x: 200, y: 200, agents: 2, strength: 2 }, { x: 440, y: 440, agents: 1, strength: 0.5 }];
  const snaps = runChemotaxis(colony({ emitters, deposit: 1.5, lifespan: 5, diffusion: 0.2, spawnRadius: 10 }), 9, 30);
  near(chemicalField(snaps).total, 1.5 * 5 * (2 + 2 + 0.5), 1e-9);
  assert.equal(snaps.final.alive, 0);
  // With release the agent born at step b acts b .. b+4: the last one is born at step ceil-schedule 6 and acts to step 10.
  const streamed = runChemotaxis(colony({ emitters, deposit: 1.5, lifespan: 5, release: 6 }), 9, 30);
  near(chemicalField(streamed).total, 1.5 * 5 * (2 + 2 + 0.5), 1e-9);
  assert.equal(projectionAliveAt(streamed, 5) + projectionAliveAt(streamed, 12), projectionAliveAt(streamed, 5));
  assert.equal(projectionAliveAt(streamed, 12), 0);
});
const projectionAliveAt = (snaps: ChemotaxisSnapshots, step: number) => snaps.history.find((h) => h.step === step)!.value.alive;

test("births follow the counter: agent:n ids, emitter round robin and the release schedule", () => {
  const emitters = [{ x: 150, y: 150, agents: 10, strength: 1 }, { x: 500, y: 500, agents: 10, strength: 1 }];
  const snaps = runChemotaxis(colony({ emitters, release: 10, speed: 2, spawnRadius: 0 }), 3, 14);
  // Slot s is born at step 1 + floor(s * 10 / 20), so 2k agents exist after step k, up to 20.
  for (let k = 0; k <= 14; k++) assert.equal(snaps.history[k].value.count, Math.min(20, 2 * k), `count at step ${k}`);
  const agents = chemotaxisAgents(snaps);
  assert.deepEqual(agents.map((a) => a.id), Array.from({ length: 20 }, (_, s) => `agent:${s}`));
  assert.deepEqual(agents.map((a) => a.origin), Array.from({ length: 20 }, (_, s) => s % 2));
  // A newborn acted once in its birth step, so it is within one speed of its emitter.
  const born = stateAt(snaps, 3);
  for (let s = 0; s < 6; s++) {
    const e = emitters[s % 2];
    assert.ok(Math.hypot(born.x[s] - e.x, born.y[s] - e.y) <= (3 - (1 + Math.floor(s * 10 / 20)) + 1) * 2 + 1e-9);
  }
  // Release 0: everyone exists at step 0, exactly on their emitter when the spawn radius is 0.
  const all = runChemotaxis(colony({ emitters, spawnRadius: 0 }), 3, 0);
  assert.equal(all.history[0].value.count, 20);
  for (let s = 0; s < 20; s++) { near(all.history[0].value.x[s], emitters[s % 2].x, 1e-4); near(all.history[0].value.y[s], emitters[s % 2].y, 1e-4); }
});

test("a colony that died out and cannot be refed halts: later steps return the identical state", () => {
  const c = colony({ emitters: [{ x: 300, y: 300, agents: 5, strength: 1 }], deposit: 1, lifespan: 3, diffusion: 0.3, decay: 0.5, spawnRadius: 20 });
  const short = runChemotaxis(c, 4, 80), long = runChemotaxis(c, 4, 160);
  assert.equal(short.final.halted, true);
  assert.equal(short.final.fieldMax, 0);
  const halted = short.history.findIndex((h) => h.value.halted);
  assert.ok(halted > 3 && halted < 60, `halted at step ${halted}`); // three acting steps, then 0.5^n decay below 1e-9 takes about 30 more
  for (let k = halted; k <= 160; k += 20) assert.deepEqual(stateAt(long, k), stateAt(long, halted));
  // A leaking emitter never halts; a colony with nobody to bear is halted from the start.
  const leaking = runChemotaxis({ ...c, beacon: 0.1 }, 4, 120);
  assert.equal(leaking.final.halted, false);
  const nobody = runChemotaxis(colony({ emitters: [{ x: 300, y: 300, agents: 0, strength: 1 }] }), 1, 10);
  assert.equal(nobody.history[0].value.halted, true);
  assert.equal(nobody.final.count, 0);
});

test("checkpoint replay, prefix, resume and spacing invariance hold for colonies with barriers, release, lifespan and wrap", () => {
  const barrier = bundledBarrier({ kind: "pillars", centerX: 320, centerY: 320, size: 20, gap: 0, pillars: 4, grid: 48, seed: 5, avoid: [{ x: 320, y: 320, radius: 60 }] });
  checkSimulation(chemotaxisSimulation, colony({ emitters: [{ x: 320, y: 320, agents: 12, strength: 1 }], deposit: 1, beacon: 1, diffusion: 0.3, decay: 0.05, wander: 10, spawnRadius: 30, release: 6, barrier, grid: 48 }), 21, 24);
  checkSimulation(chemotaxisSimulation, colony({ emitters: [{ x: 100, y: 100, agents: 6, strength: 1 }, { x: 500, y: 400, agents: 6, strength: 0.4 }], deposit: 1, diffusion: 0.2, decay: 0.1, wander: 5, lifespan: 9, edge: "wrap", grid: 32, speed: 5 }), 8, 26);
});

test("a cancelled colony leaves nothing in the cache and a retry equals a clean run", async () => {
  const c = colony({ emitters: [{ x: 320, y: 320, agents: 30, strength: 1 }], deposit: 1, diffusion: 0.3, decay: 0.05, wander: 9, spawnRadius: 25 });
  let polls = 0;
  assert.equal(await prepareChemotaxis(c, 77, 60, () => ++polls > 20), false);
  assert.equal(chemotaxisCache.has(chemotaxisSimulation, c, 77, chemotaxisRunOptions(60, {})), false);
  assert.equal(await prepareChemotaxis(c, 77, 60, () => false), true);
  assert.equal(chemotaxisCache.has(chemotaxisSimulation, c, 77, chemotaxisRunOptions(60, {})), true);
  assert.deepEqual(stateAt(chemotaxisSnapshots(c, 77, 60), 60), stateAt(runChemotaxis(c, 77, 60), 60));
});

test("no agent ever enters a barrier cell, and the wall cells match the barrier geometry", () => {
  const barrier = bundledBarrier({ kind: "wall", centerX: 320, centerY: 320, size: 200, gap: 60, pillars: 0, grid: 64, seed: 1, avoid: [] });
  const walker = (attraction: number) => colony({ emitters: [{ x: 150, y: 320, agents: 60, strength: 1 }], deposit: 1, diffusion: 0.3, decay: 0, wander: 15, spawnRadius: 40, speed: 5, attraction, barrier });
  const mask = barrierMask(barrier, 64), t = barrierThickness(64);
  for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) {
    const x = (i + 0.5) * 10, y = (j + 0.5) * 10;
    const inside = Math.abs(x - 320) <= t / 2 && y >= 120 && y <= 320 - 30 || Math.abs(x - 320) <= t / 2 && y >= 350 && y <= 520;
    assert.equal(mask[j * 64 + i], inside ? 1 : 0, `cell ${i},${j}`);
  }
  for (const attraction of [1, 0]) {
    const snaps = runChemotaxis(walker(attraction), 13, 120);
    for (const { value } of snaps.history) for (let s = 0; s < value.count; s++) assert.equal(mask[cellOf(value.y[s], 64) * 64 + cellOf(value.x[s], 64)], 0, `agent ${s} at step ${value.step}`);
    const field = chemicalField(snaps);
    for (let k = 0; k < mask.length; k++) if (mask[k]) assert.equal(field.values[k], 0);
    // Every deposit lands in full even beside a wall (60 agents, 120 acting steps, no decay).
    near(field.total, 60 * 120, 1e-6, `chemical with attraction ${attraction}`);
    // Wandering agents find the door (some end right of the wall); a self-following colony stays a comet on its side.
    const across = Array.from(stateAt(snaps, 120).x).filter((x) => x > 320 + t).length;
    if (attraction === 0) assert.ok(across >= 5, `${across} agents crossed through the door`); else assert.equal(across, 0);
  }
});

test("an emitter inside a barrier is an error naming the emitter and the controls to change", () => {
  const barrier = bundledBarrier({ kind: "island", centerX: 320, centerY: 320, size: 80, gap: 0, pillars: 0, grid: 64, seed: 1, avoid: [] });
  assert.throws(() => runChemotaxis(colony({ barrier }), 1, 1), /Emitter 1 lies inside the barrier.*Center X\/Y/);
});

test("trajectories are the retained history: prefix property, ids, death, and torus cuts", () => {
  const c = colony({ emitters: [{ x: 320, y: 320, agents: 8, strength: 1 }], deposit: 1, diffusion: 0.3, decay: 0.05, wander: 10, spawnRadius: 30, lifespan: 40 });
  const a = runChemotaxis(c, 6, 50), b = runChemotaxis(c, 6, 80);
  const memoryAll = { memory: 0, minLength: 0 };
  const shortTrails = chemotaxisTrails(a, memoryAll), longTrails = chemotaxisTrails(b, memoryAll);
  assert.equal(shortTrails.length, 8); assert.equal(longTrails.length, 8);
  shortTrails.forEach((trail, s) => {
    assert.equal(trail.id, `trail:agent:${s}`);
    // Lifespan 40 acted steps end at step 40: the trail holds the positions at steps 0..40, 41 points, whichever run made it.
    assert.equal(longTrails[s].points.length, 41); assert.equal(trail.points.length, 41);
    assert.deepEqual(longTrails[s].points, trail.points);
    near(trail.points[0][0], stateAt(a, 0).x[s], 1e-4);
    near(trail.points[40][1], stateAt(a, 40).y[s], 1e-4);
  });
  // A memory window keeps the most recent steps only: 10 steps back from step 30 is 11 points, steps 20 to 30.
  const young = runChemotaxis(c, 6, 30);
  const windowed = chemotaxisTrails(young, { memory: 10, minLength: 0 });
  assert.equal(windowed.length, 8);
  windowed.forEach((t, s) => { assert.equal(t.points.length, 11); assert.equal(t.from, 20); assert.equal(t.to, 30); near(t.points[0][0], stateAt(young, 20).x[s], 1e-4); });
  // On a torus every piece is continuous: no consecutive points farther apart than a step.
  const wrapSnaps = runChemotaxis(colony({ emitters: [{ x: 620, y: 20, agents: 6, strength: 1 }], deposit: 0, speed: 6, edge: "wrap", spawnRadius: 5 }), 2, 150);
  const pieces = chemotaxisTrails(wrapSnaps, { memory: 0, minLength: 0 });
  assert.ok(pieces.length > 6, "trails crossed the seam and were cut");
  for (const piece of pieces) for (let i = 1; i < piece.points.length; i++)
    assert.ok(Math.hypot(piece.points[i][0] - piece.points[i - 1][0], piece.points[i][1] - piece.points[i - 1][1]) <= 6 + 1e-3);
  assert.ok(pieces.some((p) => /#1$/.test(p.id)));
});

test("emitter layouts: ring, line and scatter positions, stable scatter under count, strength taper", () => {
  const o = { agents: 5, centerX: 300, centerY: 200, radius: 100, angle: 0, taper: 0, seed: 9 } as const;
  const ring = emitterLayout({ ...o, layout: "ring", count: 4 });
  const expected = [[400, 200], [300, 300], [200, 200], [300, 100]];
  ring.forEach((e, k) => { near(e.x, expected[k][0], 1e-9); near(e.y, expected[k][1], 1e-9); });
  const line = emitterLayout({ ...o, layout: "line", count: 3, angle: 90 });
  near(line[0].x, 300, 1e-9); near(line[0].y, 100, 1e-9); near(line[1].y, 200, 1e-9); near(line[2].y, 300, 1e-9);
  const six = emitterLayout({ ...o, layout: "scatter", count: 6 }), three = emitterLayout({ ...o, layout: "scatter", count: 3 });
  assert.deepEqual(six.slice(0, 3).map((e) => [e.x, e.y]), three.map((e) => [e.x, e.y]));
  for (const e of six) assert.ok(Math.hypot(e.x - 300, e.y - 200) <= 100 + 1e-9);
  assert.deepEqual([emitterLayout({ ...o, layout: "ring", count: 1 })[0].x, emitterLayout({ ...o, layout: "ring", count: 1 })[0].y], [300, 200]);
  assert.deepEqual(emitterLayout({ ...o, layout: "ring", count: 5, taper: 0.6 }).map((e) => e.strength), [1, 0.85, 0.7, 0.55, 0.4]);
});

test("contour rings close around the chemical: linear crossings equal the level, areas shrink with level", () => {
  const snaps = runChemotaxis(colony({ emitters: [{ x: 320, y: 320, agents: 0, strength: 1 }, { x: 420, y: 300, agents: 0, strength: 0.6 }], beacon: 4, diffusion: 0.4, decay: 0.05, grid: 64 }), 1, 60);
  const field = chemicalField(snaps);
  const levels = contourLevels(field.max, 4, 0.05);
  assert.deepEqual(levels.map((v) => Number((v / field.max).toFixed(6))), [0.05, 0.05 * (0.85 / 0.05) ** (1 / 3), 0.05 * (0.85 / 0.05) ** (2 / 3), 0.85].map((v) => Number(v.toFixed(6))));
  const paths = fieldContourPaths(field, levels, 5);
  const areas = levels.map(() => 0);
  for (const path of paths) {
    assert.equal(path.closed, true);
    const i = levels.indexOf(path.level);
    let area = 0;
    for (let a = 0, b = path.points.length - 1; a < path.points.length; b = a++) area += (path.points[b][0] * path.points[a][1] - path.points[a][0] * path.points[b][1]) / 2;
    areas[i] += area;
    for (const [x, y] of path.points) if (x >= 5 && x <= 635 && y >= 5 && y <= 635) near(sampleField(field.values, 64, "wall", x, y), path.level, 1e-7 * field.max, `vertex of ${path.id}`);
  }
  for (let i = 1; i < areas.length; i++) assert.ok(areas[i] > 0 && areas[i] < areas[i - 1], `area at level ${i}`);
});

test("bounds fail before any work and name the control to lower", () => {
  const big = colony({ emitters: Array.from({ length: 8 }, (_, k) => ({ x: 80 + 60 * k, y: 300, agents: 301, strength: 1 })) });
  assert.throws(() => checkChemotaxis(big, 10), /Emitters × Agents per emitter = 2408.*Lower Agents per emitter or Emitters/);
  const dense = colony({ emitters: Array.from({ length: 8 }, (_, k) => ({ x: 80 + 60 * k, y: 300, agents: 300, strength: 1 })) });
  assert.throws(() => checkChemotaxis(dense, 400), /Agents × Steps.*Lower Steps, Agents per emitter or Emitters/);
  checkChemotaxis(dense, 370);
  assert.throws(() => checkChemotaxis(colony({ grid: 256 }), 1000), /Steps × \(agents and field cells\).*Field resolution/);
  assert.throws(() => checkChemotaxis(colony({ grid: 8 }), 1), /Field resolution/);
  assert.throws(() => checkChemotaxis(colony({ speed: 9 }), 1), /Speed/);
  assert.throws(() => checkChemotaxis(colony({ emitters: [{ x: 700, y: 1, agents: 1, strength: 1 }] }), 1), /Emitter 1 X/);
  assert.throws(() => createInstrument("chemotactic-trails") && chemotacticTrailsComposition({ ...instrumentWith({ emitters: 8, agents: 300, steps: 500 }) }), /Agents × Steps/);
  assert.throws(() => recipeFor({ barrier: "pillars", pillars: 24, pillarRadius: 40 }), /pillars fit clear of the emitters/);
  assert.throws(() => recipeFor({ barrier: "enclosure", barrierSize: 12 }), /Barrier size must exceed/);
});

test("appearance never reaches the cache key: recolor and every drawing edit reuse the same snapshots, structure edits do not", () => {
  const base = recipeFor();
  const first = chemotacticSnapshots(base);
  const products = chemotacticProducts(base);
  const restyled = chemotacticTrailsComposition({ ...instrumentWith({ contourLine: "beads", contourWeight: 2.5, trailLine: "stitch", trailWeight: 2, mark: "rosette", markSize: 20, fieldMode: "both", washOpacity: 0.3, trailMemory: 20, barrierOpacity: 0.9 }), palette: [0x111111, 0x222222, 0x333333] });
  assert.equal(chemotacticSnapshots(restyled), first);
  assert.equal(chemotacticProducts(restyled).snapshots, first);
  assert.equal(chemotacticProducts(restyled).field, products.field);
  assert.equal(chemotacticProducts(restyled).contours, products.contours); // contour geometry is the same whatever draws it
  assert.notEqual(chemotacticProducts(chemotacticTrailsComposition(instrumentWith({ lowestContour: 0.2 }))).contours, products.contours);
  // Contours of the same display are the same objects.
  assert.equal(chemotacticProducts(chemotacticTrailsComposition({ ...instrumentWith(), palette: [1, 2, 3, 4] })).contours, products.contours);
  // A construction edit builds new snapshots; a longer or shorter run extends or replays the same colony.
  for (const edit of [{ centerX: 340 }, { agents: 151 }, { decay: 0.051 }, { wander: 13 }, { reach: 25 }, { emitters: 3 }, { grid: 97 }]) assert.notEqual(chemotacticSnapshots(recipeFor(edit)), first, JSON.stringify(edit));
  assert.notEqual(chemotacticSnapshots(recipeFor({}, 43)), first);
  const longer = chemotacticSnapshots(recipeFor({ steps: 190 }));
  assert.notEqual(longer, first);
  assert.deepEqual(stateAt(longer, 140), stateAt(first, 140));
});

test("moving an emitter genuinely moves the colony: the chemical's centroid follows it", () => {
  const centroid = (centerX: number) => {
    const snaps = runChemotaxis(colony({ emitters: [{ x: centerX, y: 320, agents: 0, strength: 1 }], beacon: 2, diffusion: 0.3, decay: 0.05 }), 1, 80);
    const f = chemicalField(snaps);
    let sx = 0;
    for (let k = 0; k < f.values.length; k++) sx += f.values[k] * ((k % 64) + 0.5) * f.cell;
    return sx / f.total;
  };
  near(centroid(220) - centroid(180), 40, 1, "centroid follows the emitter");
  // With agents the colony differs beyond the shift: a moved colony does not reproduce the old field shifted.
  const a = runChemotaxis(colony({ emitters: [{ x: 300, y: 320, agents: 40, strength: 1 }], deposit: 1, diffusion: 0.3, decay: 0.05, wander: 12, spawnRadius: 30 }), 8, 120);
  const b = runChemotaxis(colony({ emitters: [{ x: 300, y: 350, agents: 40, strength: 1 }], deposit: 1, diffusion: 0.3, decay: 0.05, wander: 12, spawnRadius: 30 }), 8, 120);
  let differ = 0;
  for (let s = 0; s < 40; s++) if (Math.hypot(stateAt(a, 120).x[s] - stateAt(b, 120).x[s], stateAt(a, 120).y[s] - stateAt(b, 120).y[s]) > 30) differ++;
  assert.ok(differ >= 25, `${differ} of 40 agents ended more than 30 units apart`);
});

test("trail materials draw the same trajectories: paths are shared objects across ink, stitch and bristles", () => {
  const ink = chemotacticProducts(recipeFor({ trailLine: "ink" })), stitch = chemotacticProducts(recipeFor({ trailLine: "stitch", trailWeight: 3 })), brush = chemotacticProducts(recipeFor({ trailLine: "bristles", trailShare: 0.3 }));
  assert.equal(stitch.trails, ink.trails);
  assert.deepEqual(brush.trails.map((t) => t.points), ink.trails.filter((t) => brush.trails.some((b) => b.id === t.id)).map((t) => t.points));
  for (const t of brush.trails) assert.ok(ink.trails.includes(t));
  assert.ok(brush.trails.length > 0 && brush.trails.length < ink.trails.length);
  // Raising the share only adds trails.
  const more = chemotacticProducts(recipeFor({ trailLine: "bristles", trailShare: 0.6 }));
  for (const t of brush.trails) assert.ok(more.trails.includes(t));
});

test("the instrument draws through the registry, is preparable and cancellable, and stays transparent", async () => {
  assert.equal(canPrepareInstrument("chemotactic-trails"), true);
  const input = instrumentWith({ steps: 60 });
  assert.equal(await prepareInstrument(input, () => true), false);
  assert.equal(await prepareInstrument(input, () => false), true);
  const recorder = new Recorder();
  let backgrounds = 0;
  drawInstrument(Object.assign(recorder, { background: () => backgrounds++ }) as unknown as DrawingContext, input);
  assert.equal(backgrounds, 0);
  assert.ok(recorder.ops.some((o) => o.startsWith("vertex")) || recorder.ops.length > 0);
  // Direct API with an ordinary callback replaces the contour consumer only.
  const custom = new Recorder();
  let contourCalls = 0;
  drawChemotacticTrails(custom, recipeFor({ steps: 60 }), { contour: () => { contourCalls++; } });
  assert.ok(contourCalls > 0);
});

test("controls hidden by a selection do not change the drawing", () => {
  const cases: [Record<string, number | string | boolean>, Record<string, number | string | boolean>][] = [
    [{ layout: "scatter" }, { layoutAngle: 77 }],
    [{ barrier: "none" }, { barrierSize: 200, barrierGap: 10, pillars: 3, pillarRadius: 30, barrierOpacity: 0.9 }],
    [{ barrier: "wall", barrierSize: 100 }, { pillars: 3, pillarRadius: 30 }],
    [{ barrier: "island" }, { barrierGap: 10 }],
    [{ fieldMode: "none" }, { contours: 9, lowestContour: 0.3, contourLine: "beads", contourWeight: 3, washOpacity: 0.4 }],
    [{ fieldMode: "contours" }, { washOpacity: 0.4 }],
    [{ fieldMode: "wash" }, { contourLine: "stitch", contourWeight: 3 }],
    [{ trailLine: "none" }, { trailShare: 0.2, trailMemory: 15, trailMinLength: 80, trailWeight: 3, trailColor: "single", brushWidth: 25, hairs: 15 }],
    [{ trailLine: "ink" }, { brushWidth: 25, hairs: 15 }],
    [{ trailLine: "bristles" }, { trailWeight: 3 }],
    [{ mark: "none" }, { markShare: 0.9, markSize: 30, markColor: "single" }],
  ];
  for (const [selection, hidden] of cases) {
    const base = { ...selection, steps: 50 };
    const shown = new Set(visibleParameters("chemotactic-trails", { ...createInstrument("chemotactic-trails").params, ...base }).map((p) => p.key));
    for (const key of Object.keys(hidden)) assert.equal(shown.has(key), false, `${key} should be hidden under ${JSON.stringify(selection)}`);
    assert.equal(drawFingerprint(instrumentWith({ ...base, ...hidden })), drawFingerprint(instrumentWith(base)), JSON.stringify([selection, hidden]));
  }
});

test("control groups follow construction order and only the two radii are proportional", () => {
  const tree = inspectorItems("chemotactic-trails", createInstrument("chemotactic-trails").params);
  const labels = tree.map((item) => item.kind === "group" ? item.label : item.parameter.key);
  assert.deepEqual(labels, ["Colony", "Placement", "Chemistry", "Sensing", "Arena", "Time", "Field", "Trails", "Agent marks"]);
  const proportional: string[][] = [];
  const walk = (items: typeof tree) => items.forEach((item) => { if (item.kind === "group") { if (item.proportional) proportional.push(item.items.map((i) => i.kind === "control" ? i.parameter.key : "?")); walk(item.items); } });
  walk(tree);
  assert.deepEqual(proportional, [["layoutRadius", "spawnRadius"]]);
  assert.equal(CHEMOTAXIS_LIMITS.maxAgents, 2400);
});

test("scatter emitters keep clear of a solid barrier, pillars keep clear of the emitters, and a ring through the barrier is an error", () => {
  const q = { ...createInstrument("chemotactic-trails").params, layout: "scatter", emitters: 8, layoutRadius: 260, barrier: "island", barrierSize: 150 } as never;
  for (let seed = 0; seed < 25; seed++) {
    const { emitters, barrier } = colonyGeometry(q, seed);
    const blocked = barrierBlocks(barrier, 96);
    for (const e of emitters) assert.equal(blocked(e.x, e.y), false, `seed ${seed}`);
    assert.ok(emitters.some((e) => Math.hypot(e.x - 320, e.y - 320) < 260) && emitters.length === 8);
  }
  const pillared = { ...createInstrument("chemotactic-trails").params, barrier: "pillars", pillars: 12, pillarRadius: 20, spawnRadius: 30 } as never;
  for (let seed = 0; seed < 10; seed++) {
    const { emitters, barrier } = colonyGeometry(pillared, seed);
    assert.equal(barrier.length, 12);
    for (const pillar of barrier) {
      const cx = pillar.outer.reduce((a, p) => a + p[0], 0) / pillar.outer.length, cy = pillar.outer.reduce((a, p) => a + p[1], 0) / pillar.outer.length;
      for (const e of emitters) assert.ok(Math.hypot(e.x - cx, e.y - cy) >= 20 + 30 + 24 - 1e-6, `pillar near an emitter, seed ${seed}`);
    }
  }
  assert.throws(() => colonyGeometry({ ...createInstrument("chemotactic-trails").params, barrier: "island", barrierSize: 200 } as never, 1), /Emitter 1 lies inside the barrier/);
});

test("every numeric control at its slider minimum and maximum (each alone, all together) is admitted, draws, and stays within the declared work bound", () => {
  const item = definition("chemotactic-trails");
  const numeric = item.parameters.filter((p) => p.type === "number");
  const base = createInstrument("chemotactic-trails");
  const check = (label: string, values: Record<string, number>) => {
    const input = { ...base, params: { ...base.params, ...values } };
    validateInstrument(input);
    const recipe = chemotacticTrailsComposition(input);
    const snaps = chemotacticSnapshots(recipe);
    const c = recipe.construction;
    const bound = 4 * c.grid * c.grid + 8 * totalAgents(c) + 8 + recipe.steps * chemotaxisStepWork(c);
    assert.ok(snaps.work <= bound && bound <= CHEMOTAXIS_LIMITS.maxWork, `${label}: work ${snaps.work} vs declared ${bound}`);
    drawChemotacticTrails(new Recorder(), recipe);
  };
  const allMin: Record<string, number> = {}, allMax: Record<string, number> = {};
  for (const p of numeric) {
    allMin[p.key] = p.min!; allMax[p.key] = p.max!;
    check(`${p.key} at min`, { [p.key]: p.min! });
    check(`${p.key} at max`, { [p.key]: p.max! });
  }
  check("all minimums", allMin);
  check("all maximums", allMax);
});
