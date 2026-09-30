import assert from "node:assert/strict";
import test from "node:test";
import {
  CYCLIC_LIMITS, CYCLIC_WALL, canPrepareInstrument, createInstrument, cyclicFrontsComposition, cyclicFrontsProducts, cyclicGrid, cyclicSimulation, cyclicSnapshots,
  drawCyclicFronts, finalState, frontPaths, gridGeometry, hasCyclicSnapshots, neighbourOffsets, obstacleRuns, prepareInstrument, runSimulation, spiralCores,
  stateAt, stateRegions, statePalette, stateHatch, checkSimulation, usesSeed, validateInstrument, visibleParameters,
  type CompositionSurface, type CyclicConstruction, type CyclicGrid, type CyclicRule, type CyclicState, type GridGeometry, type InitialSpec, type NeighbourhoodShape, type ObstacleSpec,
} from "../dist/index.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.js";

const W = CYCLIC_WALL;
const rule = (states: number, threshold: number, range: number, neighbourhood: NeighbourhoodShape): CyclicRule => ({ states, threshold, range, neighbourhood });
const construction = (columns: number, rows: number, r: CyclicRule, initial: InitialSpec, obstacles: ObstacleSpec = { kind: "none" }): CyclicConstruction =>
  ({ columns, rows, rule: r, initial, obstacles });
const stripes = (width: number, angle = 0): InitialSpec => ({ kind: "stripes", width, angle, noise: 0 });

/** One or more synchronous steps applied to hand-written cells through the model's own step function. */
function stepCells(c: CyclicConstruction, cells: number[], steps = 1): CyclicState {
  const state: CyclicState = { cells: Uint8Array.from(cells), last: new Uint16Array(cells.length), mark: Uint8Array.from(cells), markStep: 0, power: 1, changed: 0, fixedFrom: -1, period: 0, periodAt: 0 };
  for (let k = 1; k <= steps; k++)
    cyclicSimulation.step(state, { params: c, seed: 0, step: k, stream: () => { throw new Error("no draws"); }, charge() {} });
  return state;
}
const cellsOf = (state: CyclicState) => [...state.cells];

/** An independent oracle: the rule written the most direct way, on nested arrays, sharing no code with the model. */
function oracleStep(cells: number[][], n: number, threshold: number, range: number, shape: NeighbourhoodShape): number[][] {
  const rows = cells.length, columns = cells[0].length;
  return cells.map((row, y) => row.map((s, x) => {
    if (s === W) return W;
    const succ = (s + 1) % n;
    let seen = 0;
    for (let dy = -range; dy <= range; dy++) for (let dx = -range; dx <= range; dx++) {
      if (dx === 0 && dy === 0) continue;
      const member = shape === "moore" || (shape === "neumann" ? Math.abs(dx) + Math.abs(dy) <= range : Math.round(Math.sqrt(dx * dx + dy * dy)) === range);
      if (!member) continue;
      const ny = y + dy, nx = x + dx;
      if (ny >= 0 && ny < rows && nx >= 0 && nx < columns && cells[ny][nx] === succ) seen++;
    }
    return seen >= threshold ? succ : s;
  }));
}
const toRows = (flat: ArrayLike<number>, columns: number) => Array.from({ length: flat.length / columns }, (_, y) => Array.from({ length: columns }, (_, x) => flat[y * columns + x]));

const grid = (rowsOfStates: number[][], states: number, step = 0): CyclicGrid => {
  const columns = rowsOfStates[0].length, rows = rowsOfStates.length, cells = Uint8Array.from(rowsOfStates.flat());
  return { step, columns, rows, states, cells, last: new Uint16Array(cells.length), changed: 0, walls: cells.filter((v) => v === W).length };
};
const at = (_columns: number, _rows: number, left = 0, top = 0, cell = 1): GridGeometry => ({ left, top, cell });

/* ------------------------------------------------------------------ the rule */

test("neighbourhood sizes: Moore (2r+1)^2-1, von Neumann 2r(r+1), the ring annulus 8, 12, 16 for r = 1, 2, 3", () => {
  for (const r of [1, 2, 3, 4]) {
    assert.equal(neighbourOffsets("moore", r).length, (2 * r + 1) ** 2 - 1);
    assert.equal(neighbourOffsets("neumann", r).length, 2 * r * (r + 1));
  }
  assert.deepEqual([1, 2, 3].map((r) => neighbourOffsets("ring", r).length), [8, 12, 16]);
  assert.ok(neighbourOffsets("ring", 3).every(([dx, dy]) => Math.abs(Math.hypot(dx, dy) - 3) <= 0.5 && Math.abs(Math.hypot(dx, dy) - 3) < 0.5 + 1e-9));
  assert.ok(neighbourOffsets("ring", 3).every(([dx, dy]) => !(dx === 0 && dy === 0)) && !neighbourOffsets("ring", 3).some(([dx, dy]) => dx === 0 && dy === 1), "a hollow ring: the cells next door do not vote");
});

test("a front invades one state per step, hand-computed on a one-dimensional train of stripes until it settles", () => {
  const c = construction(6, 2, rule(3, 1, 1, "neumann"), stripes(1));
  const snaps = runSimulation(cyclicSimulation, c, 0, { steps: 8 });
  const expected = [[0, 1, 2, 0, 1, 2], [1, 2, 0, 1, 2, 2], [2, 0, 1, 2, 2, 2], [0, 1, 2, 2, 2, 2], [1, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 2]];
  expected.forEach((row, k) => assert.deepEqual(toRows(stateAt(snaps, k).cells, 6), [row, row], `step ${k}`));
  const summary = snaps.history.map((entry) => [entry.step, entry.value.changed, entry.value.fixed]);
  assert.deepEqual(summary, [[0, 0, 0], [1, 10, 0], [2, 8, 0], [3, 6, 0], [4, 4, 0], [5, 2, 0], [6, 0, 1], [7, 0, 1], [8, 0, 1]], "changed cells per step (two rows), and the settled flag from step 6 on");
});

test("simultaneous update: a cell reads the old grid, never a neighbour already changed this step", () => {
  // A train whose successor sits on the LEFT: 2 1 0 2 1 0. Synchronously every cell but the first advances at once.
  const c = construction(6, 2, rule(3, 1, 1, "neumann"), stripes(1));
  const next = stepCells(c, [2, 1, 0, 2, 1, 0, 2, 1, 0, 2, 1, 0]);
  assert.deepEqual(toRows(next.cells, 6), [[2, 2, 1, 0, 2, 1], [2, 2, 1, 0, 2, 1]]);
  assert.equal(next.changed, 10);
});

test("threshold: a cell needs at least that many successor neighbours (>=, not >)", () => {
  const cells = [1, 1, 0, 0, 0, 0, 0, 0, 0]; // centre (1,1) has exactly two neighbours in state 1
  for (const [threshold, expected] of [[1, 1], [2, 1], [3, 0]] as const)
    assert.equal(stepCells(construction(3, 3, rule(3, threshold, 1, "moore"), stripes(1)), cells).cells[4], expected, `threshold ${threshold}`);
});

test("range and shape decide who can vote: the cells one lone state-1 cell converts are counted by hand", () => {
  const cells = Array(25).fill(0); cells[2 * 5 + 4] = 1; // 5 x 5, state 1 at (4, 2) on the right edge
  const converted = (shape: NeighbourhoodShape, range: number) => stepCells(construction(5, 5, rule(3, 1, range, shape), stripes(1)), cells).cells.filter((v) => v === 1).length - 1;
  assert.equal(converted("moore", 2), 14, "Moore r2: x 2..4, y 0..4 is 15 cells, minus the source");
  assert.equal(converted("neumann", 2), 8, "diamond of radius 2, the part inside the grid");
  assert.equal(converted("ring", 2), 7, "annulus r2: (0,±2), (-1,±2), (-2,0), (-2,±1)");
  assert.equal(converted("moore", 1), 5, "Moore r1: x 3..4, y 1..3, minus the source");
});

test("obstacles never change and are never counted: a front stops at a wall", () => {
  const c = construction(6, 2, rule(3, 1, 1, "neumann"), stripes(1), { kind: "cells", runs: [3, 1, 9, 1] });
  const start = [0, 1, 2, W, 1, 2, 0, 1, 2, W, 1, 2];
  const next = stepCells(c, start);
  assert.deepEqual(toRows(next.cells, 6), [[1, 2, 2, W, 2, 2], [1, 2, 2, W, 2, 2]], "the 2 beside the wall does not see the wall as a 0");
  const later = stepCells(c, start, 12);
  assert.deepEqual([later.cells[3], later.cells[9]], [W, W]);
  assert.deepEqual(toRows(later.cells, 6).map((row) => row.slice(0, 3)), [[2, 2, 2], [2, 2, 2]]);
  assert.ok(later.fixedFrom >= 0);
});

test("the model agrees with an independent direct implementation over rules, shapes, obstacles and 25 steps", () => {
  const configs: [CyclicConstruction, number][] = [
    [construction(16, 12, rule(5, 2, 2, "neumann"), { kind: "random", density: 1 }), 7],
    [construction(17, 13, rule(8, 3, 2, "moore"), { kind: "spirals", count: 3, radius: 5, noise: 0.02 }, { kind: "blocks", count: 3, size: 2 }), 8],
    [construction(15, 15, rule(6, 2, 3, "ring"), { kind: "random", density: 0.5 }), 9],
    [construction(20, 9, rule(3, 4, 2, "moore"), { kind: "stamp", stamp: "triad", radius: 3, x: 0.5, y: 0.5, noise: 0 }, { kind: "bars", count: 2, size: 1, gap: 0.3 }), 10],
    [construction(12, 12, rule(12, 1, 1, "moore"), stripes(2, 30)), 11],
  ];
  for (const [c, seed] of configs) {
    const snaps = runSimulation(cyclicSimulation, c, seed, { steps: 25, checkpointEvery: 7 });
    let expected = toRows(stateAt(snaps, 0).cells, c.columns);
    for (let k = 1; k <= 25; k++) {
      expected = oracleStep(expected, c.rule.states, c.rule.threshold, c.rule.range, c.rule.neighbourhood);
      assert.deepEqual(toRows(stateAt(snaps, k).cells, c.columns), expected, `${JSON.stringify(c.rule)} ${c.initial.kind} step ${k}`);
    }
  }
});

test("cyclic order: a cell only ever holds or moves to the next state, and walls never move", () => {
  for (const [c, seed] of [
    [construction(24, 18, rule(7, 2, 2, "moore"), { kind: "random", density: 1 }, { kind: "blocks", count: 4, size: 3 }), 1],
    [construction(24, 18, rule(3, 1, 1, "neumann"), { kind: "spirals", count: 4, radius: 6, noise: 0 }), 2],
    [construction(24, 18, rule(16, 3, 3, "ring"), { kind: "random", density: 0.3 }, { kind: "ring", size: 2, gap: 0.2 }), 3],
  ] as [CyclicConstruction, number][]) {
    const snaps = runSimulation(cyclicSimulation, c, seed, { steps: 30 });
    let previous = stateAt(snaps, 0).cells;
    for (let k = 1; k <= 30; k++) {
      const now = stateAt(snaps, k).cells;
      for (let i = 0; i < now.length; i++) {
        if (previous[i] === W) assert.equal(now[i], W);
        else assert.ok(now[i] === previous[i] || now[i] === (previous[i] + 1) % c.rule.states, `cell ${i} step ${k}: ${previous[i]} -> ${now[i]}`);
      }
      previous = now;
    }
  }
});

test("termination: a settled grid is reported from the step it settles, later steps cost one unit, and the grid stays put", () => {
  const c = construction(6, 2, rule(3, 1, 1, "neumann"), stripes(1));
  const short = runSimulation(cyclicSimulation, c, 0, { steps: 6 }), long = runSimulation(cyclicSimulation, c, 0, { steps: 60 });
  const settled = finalState(long);
  assert.equal(settled.fixedFrom, 5, "the grid after step 5 is the first that no step can change");
  assert.deepEqual([...settled.cells], [...stateAt(short, 5).cells]);
  assert.equal(long.work - short.work, 54, "each of the 54 later steps charges exactly one unit");
  assert.deepEqual(long.history.slice(6).map((entry) => entry.value.fixed), Array(55).fill(1));
});

test("period detection on a hand-checked cycle (a 2 x 2 grid whose states all advance each step: period n) and against brute force", () => {
  const c = construction(2, 2, rule(3, 1, 1, "moore"), stripes(1));
  const state: CyclicState = { cells: Uint8Array.from([0, 1, 2, 0]), last: new Uint16Array(4), mark: Uint8Array.from([0, 1, 2, 0]), markStep: 0, power: 1, changed: 0, fixedFrom: -1, period: 0, periodAt: 0 };
  const seen: string[] = [];
  for (let k = 1; k <= 8; k++) {
    cyclicSimulation.step(state, { params: c, seed: 0, step: k, stream: () => { throw new Error("no"); }, charge() {} });
    seen.push([...state.cells].join(""));
  }
  assert.deepEqual(seen.slice(0, 4), ["1201", "2012", "0120", "1201"], "each cell advances every step");
  assert.equal(state.period, 3);
  assert.ok(state.periodAt >= 3 && state.periodAt <= 6, `confirmed at step ${state.periodAt}`);
  assert.equal(state.fixedFrom, -1);
  // Brute force on small random grids: the reported period is the true minimal period of the orbit and a fixed point is reported as one.
  let periodic = 0, fixed = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const grids = construction(4, 4, rule(3 + seed % 3, 1 + seed % 2, 1, seed % 2 ? "moore" : "neumann"), { kind: "random", density: 1 });
    const snaps = runSimulation(cyclicSimulation, grids, seed, { steps: 120, checkpointEvery: 30 });
    const orbit = Array.from({ length: 121 }, (_, k) => [...stateAt(snaps, k).cells].join(","));
    let first = -1, length = 0;
    for (let k = 0; k <= 120 && first < 0; k++) for (let j = 0; j < k; j++) if (orbit[j] === orbit[k]) { first = j; length = k - j; break; }
    const end = finalState(snaps);
    if (length === 1) { fixed++; assert.equal(end.fixedFrom, first, `seed ${seed}: fixed from`); }
    else if (length > 1) { periodic++; assert.equal(end.period, length, `seed ${seed}: period`); assert.equal(orbit[end.periodAt], orbit[end.periodAt - length]); }
  }
  assert.ok(periodic > 0 && fixed > 0, `the brute-force sample must contain both kinds (${periodic} periodic, ${fixed} fixed)`);
});

test("the foundation's guarantees hold for the model: replay, prefix, checkpoint spacing, resume, cancellation", () => {
  for (const [c, seed] of [
    [construction(14, 10, rule(6, 2, 2, "moore"), { kind: "random", density: 1 }), 3],
    [construction(12, 12, rule(5, 1, 1, "neumann"), { kind: "spirals", count: 2, radius: 4, noise: 0.03 }, { kind: "ring", size: 1, gap: 0.2 }), 4],
    [construction(9, 9, rule(4, 2, 1, "ring"), { kind: "stamp", stamp: "target", radius: 4, x: 0.5, y: 0.5, noise: 0 }), 5],
  ] as [CyclicConstruction, number][]) checkSimulation(cyclicSimulation, c, seed, 21);
});

/* ------------------------------------------------------------------ initial conditions */

test("random cells: per-cell seeded draws do not depend on the grid width, density is honoured, and seeds differ", () => {
  const r = rule(6, 3, 1, "moore");
  const narrow = stateAt(runSimulation(cyclicSimulation, construction(20, 40, r, { kind: "random", density: 0.6 }), 5, { steps: 0 }), 0);
  const wide = stateAt(runSimulation(cyclicSimulation, construction(60, 40, r, { kind: "random", density: 0.6 }), 5, { steps: 0 }), 0);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 20; x++) assert.equal(narrow.cells[y * 20 + x], wide.cells[y * 60 + x]);
  const cells = 60 * 40, live = [...wide.cells].filter((v) => v > 0).length;
  const p = 0.6 * 5 / 6, sd = Math.sqrt(cells * p * (1 - p));
  assert.ok(Math.abs(live - cells * p) < 4 * sd, `non-zero cells ${live}, expected ${cells * p} ± ${(4 * sd).toFixed(0)}`);
  const other = stateAt(runSimulation(cyclicSimulation, construction(60, 40, r, { kind: "random", density: 0.6 }), 6, { steps: 0 }), 0);
  assert.notDeepEqual([...other.cells], [...wide.cells]);
  const empty = stateAt(runSimulation(cyclicSimulation, construction(30, 30, r, { kind: "random", density: 0 }), 5, { steps: 0 }), 0);
  assert.ok([...empty.cells].every((v) => v === 0));
});

test("stripes and pinwheels have closed-form cells", () => {
  const bands = stateAt(runSimulation(cyclicSimulation, construction(24, 4, rule(4, 1, 1, "moore"), stripes(3)), 0, { steps: 0 }), 0);
  for (let x = 0; x < 24; x++) assert.equal(bands.cells[x], Math.floor((x + 0.5) / 3) % 4, `x ${x}`);
  const down = stateAt(runSimulation(cyclicSimulation, construction(4, 24, rule(4, 1, 1, "moore"), stripes(3, 90)), 0, { steps: 0 }), 0);
  for (let y = 0; y < 24; y++) assert.equal(down.cells[y * 4], Math.floor((y + 0.5) / 3) % 4, `y ${y}`);
  // A pinwheel of 8 states at (16, 16): states increase clockwise on the canvas, one per 45 degrees.
  const pin = stateAt(runSimulation(cyclicSimulation, construction(32, 32, rule(8, 3, 2, "moore"), { kind: "stamp", stamp: "pinwheel", radius: 8, x: 0.5, y: 0.5, noise: 0 }), 0, { steps: 0 }), 0);
  const cell = (x: number, y: number) => pin.cells[y * 32 + x];
  assert.deepEqual([cell(22, 16), cell(15, 22), cell(9, 15), cell(16, 9)], [0, 2, 4, 6], "right, below, left, above");
  assert.equal(cell(30, 30), 0, "background is state 0");
});

test("a pinwheel's core is found once, at its centre, with the winding its turn implies; a counter-rotating pair has both", () => {
  const start = (stamp: "pinwheel" | "counter-rotating") => cyclicGrid(runSimulation(cyclicSimulation,
    construction(40, 32, rule(8, 3, 2, "moore"), { kind: "stamp", stamp, radius: 9, x: 0.5, y: 0.5, noise: 0 }), 0, { steps: 0 }), 0);
  const geometry = at(40, 32, 100, 50, 10);
  const one = spiralCores(start("pinwheel"), geometry, 1);
  assert.equal(one.length, 1);
  assert.equal(one[0].winding, 1);
  assert.ok(Math.hypot(one[0].position[0] - (100 + 20 * 10), one[0].position[1] - (50 + 16 * 10)) < 10, "within one cell of the centre (20, 16)");
  const pair = spiralCores(start("counter-rotating"), geometry, 1);
  assert.deepEqual(pair.map((core) => core.winding).sort(), [-1, 1]);
  assert.ok(pair.find((core) => core.winding === 1)!.position[0] < pair.find((core) => core.winding === -1)!.position[0], "the clockwise pinwheel is the left one");
});

/* ------------------------------------------------------------------ producers on hand-made grids */

test("state regions cover every cell exactly once with equal cells, merged by equal rows, ids stable", () => {
  const g = grid([[0, 0, 1, W], [0, 0, 1, W], [2, 1, 1, 1]], 3);
  const regions = stateRegions(g, at(4, 3, 10, 20, 5), 7);
  assert.deepEqual(regions.map((r) => [r.id, r.state, r.bounds]), [
    ["run:0:0,0", 0, [10, 20, 20, 30]], ["run:1:2,0", 1, [20, 20, 25, 30]], ["run:wall:3,0", W, [25, 20, 30, 30]],
    ["run:2:0,2", 2, [10, 30, 15, 35]], ["run:1:1,2", 1, [15, 30, 30, 35]],
  ]);
  const coverage = new Uint8Array(12);
  for (const r of regions) for (let y = r.row; y < r.row + r.spanRows; y++) for (let x = r.column; x < r.column + r.spanColumns; x++) { coverage[y * 4 + x]++; assert.equal(g.cells[y * 4 + x], r.state); }
  assert.ok(coverage.every((v) => v === 1));
  assert.equal(stateRegions(g, at(4, 3, 10, 20, 5), 7), regions, "cached by construction");
  // Random grids: exact cover, and vertically stacked equal runs are always merged (no two rectangles with equal span, state and touching rows).
  const snaps = runSimulation(cyclicSimulation, construction(30, 20, rule(6, 2, 2, "moore"), { kind: "random", density: 1 }, { kind: "blocks", count: 4, size: 3 }), 3, { steps: 12 });
  const big = cyclicGrid(snaps), rects = stateRegions(big, at(30, 20), 1), mark = new Uint8Array(600);
  for (const r of rects) for (let y = r.row; y < r.row + r.spanRows; y++) for (let x = r.column; x < r.column + r.spanColumns; x++) { mark[y * 30 + x]++; assert.equal(big.cells[y * 30 + x], r.state); }
  assert.ok(mark.every((v) => v === 1));
  for (const a of rects) for (const b of rects) if (a !== b && a.state === b.state && a.column === b.column && a.spanColumns === b.spanColumns) assert.notEqual(a.row + a.spanRows, b.row, "stacked equal runs must be one rectangle");
  const columns = runSimulation(cyclicSimulation, construction(6, 2, rule(3, 1, 1, "neumann"), stripes(1)), 0, { steps: 0 });
  assert.equal(stateRegions(cyclicGrid(columns), at(6, 2), 1).length, 6, "six columns, each two equal cells tall, are six rectangles, not twelve");
});

/** Unit edges of a set of paths (smoothing 0: consecutive points differ along one axis by whole cells). */
function pathEdges(paths: readonly { points: readonly (readonly [number, number])[]; closed: boolean }[]) {
  const edges: string[] = [];
  for (const p of paths) {
    const m = p.points.length, last = p.closed ? m : m - 1;
    for (let i = 0; i < last; i++) {
      const [ax, ay] = p.points[i], [bx, by] = p.points[(i + 1) % m];
      assert.ok(ax === bx || ay === by, "smoothing 0 keeps axis-aligned runs");
      const steps = Math.round(Math.abs(bx - ax) + Math.abs(by - ay)), dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
      for (let s = 0; s < steps; s++) edges.push(`${ax + dx * s},${ay + dy * s}>${ax + dx * (s + 1)},${ay + dy * (s + 1)}`);
    }
  }
  return edges;
}
/** A side named by its two vertices in (y, x) order, whichever way it is walked. */
const side = (a: number[], b: number[]) => (a[1] - b[1] || a[0] - b[0]) < 0 ? `${a}|${b}` : `${b}|${a}`;
const undirected = (edge: string) => { const [a, b] = edge.split(">").map((v) => v.split(",").map(Number)); return side(a, b); };

test("fronts: every interface side exactly once, invader on the left, defects separate from advancing fronts", () => {
  const n = 5;
  const snaps = runSimulation(cyclicSimulation, construction(26, 18, rule(n, 2, 2, "neumann"), { kind: "random", density: 1 }, { kind: "blocks", count: 3, size: 2 }), 4, { steps: 3 });
  const g = cyclicGrid(snaps), geometry = at(26, 18);
  const expected = new Map<string, "advance" | "defect">();
  for (let y = 0; y < 18; y++) for (let x = 0; x < 26; x++) {
    const here = g.cells[y * 26 + x];
    const consider = (there: number, key: string) => {
      if (here === there || here === W || there === W) return;
      const d = (there - here + n) % n;
      expected.set(key, d === 1 || d === n - 1 ? "advance" : "defect");
    };
    if (x + 1 < 26) consider(g.cells[y * 26 + x + 1], side([x + 1, y], [x + 1, y + 1]));
    if (y + 1 < 18) consider(g.cells[(y + 1) * 26 + x], side([x, y + 1], [x + 1, y + 1]));
  }
  const all = frontPaths(g, geometry, { kinds: "all", smoothing: 0, seed: 1 }), advancing = frontPaths(g, geometry, { kinds: "advance", smoothing: 0, seed: 1 });
  const seenAll = pathEdges(all).map(undirected), seenAdvance = pathEdges(advancing).map(undirected);
  assert.equal(new Set(seenAll).size, seenAll.length, "no side is drawn twice");
  assert.deepEqual([...seenAll].sort(), [...expected.keys()].sort());
  assert.deepEqual([...seenAdvance].sort(), [...expected].filter(([, kind]) => kind === "advance").map(([key]) => key).sort());
  assert.ok(all.some((p) => p.kind === "defect") && all.some((p) => p.kind === "advance"));
  for (const path of all) {
    assert.equal(path.edges, pathEdges([path]).length);
    for (const edge of pathEdges([path])) {
      const [a, b] = edge.split(">").map((v) => v.split(",").map(Number)), dx = b[0] - a[0], dy = b[1] - a[1];
      const cellAt = (px: number, py: number) => g.cells[Math.floor(py) * 26 + Math.floor(px)];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      assert.equal(cellAt(mx + dy / 2, my - dx / 2), path.to, `left of ${edge} holds the invader ${path.to}`);
      if (path.kind === "advance") assert.equal(cellAt(mx - dy / 2, my + dx / 2), path.from);
      if (path.kind === "advance") assert.equal((path.from + 1) % n, path.to);
    }
  }
});

test("fronts: a lone invader is a closed loop of four corners; a triple point is shared exactly by the three paths that end there", () => {
  const island = frontPaths(grid([[0, 0, 0], [0, 1, 0], [0, 0, 0]], 3), at(3, 3, 30, 40, 10), { kinds: "advance", smoothing: 0, seed: 1 });
  assert.equal(island.length, 1);
  assert.ok(island[0].closed && island[0].from === 0 && island[0].to === 1 && island[0].edges === 4);
  assert.deepEqual([...island[0].points].map((p) => [...p]).sort(), [[40, 50], [40, 60], [50, 50], [50, 60]]);
  for (const smoothing of [0, 3]) {
    const paths = frontPaths(grid([[0, 1], [2, 2]], 3), at(2, 2, 0, 0, 10), { kinds: "advance", smoothing, seed: 1 });
    assert.equal(paths.length, 3);
    for (const p of paths) assert.ok(!p.closed);
    const endsAtTriple = paths.map((p) => [p.points[0], p.points[p.points.length - 1]].some(([x, y]) => x === 10 && y === 10));
    assert.deepEqual(endsAtTriple, [true, true, true], `smoothing ${smoothing}: all three reach the vertex (10, 10) exactly`);
  }
  assert.equal(frontPaths(grid([[0, 2]], 8), at(2, 1), { kinds: "advance", smoothing: 0, seed: 1 }).length, 0, "0 and 2 of 8 are not neighbours on the cycle: a defect");
  assert.equal(frontPaths(grid([[0, 2]], 8), at(2, 1), { kinds: "all", smoothing: 0, seed: 1 })[0].kind, "defect");
  assert.throws(() => frontPaths(grid([[0, 1]], 3), at(2, 1), { kinds: "all", smoothing: 4, seed: 1 }), /Smoothing/);
});

test("smoothing changes geometry but not topology: same ids, same ends, path lengths shrink by no more than the corners cut", () => {
  const snaps = runSimulation(cyclicSimulation, construction(30, 30, rule(8, 3, 2, "moore"), { kind: "spirals", count: 3, radius: 8, noise: 0 }), 2, { steps: 20 });
  const g = cyclicGrid(snaps), geometry = at(30, 30, 0, 0, 10);
  const raw = frontPaths(g, geometry, { kinds: "advance", smoothing: 0, seed: 1 }), smooth = frontPaths(g, geometry, { kinds: "advance", smoothing: 3, seed: 1 });
  assert.deepEqual(smooth.map((p) => p.id), raw.map((p) => p.id));
  const length = (p: { points: readonly (readonly [number, number])[]; closed: boolean }) => p.points.reduce((sum, q, i, all) => sum + (i > 0 ? Math.hypot(q[0] - all[i - 1][0], q[1] - all[i - 1][1]) : 0), 0);
  for (let i = 0; i < raw.length; i++) {
    assert.deepEqual([smooth[i].points[0], smooth[i].points.at(-1)].map((q) => [...q]), raw[i].closed ? [[...smooth[i].points[0]], [...smooth[i].points.at(-1)!]] : [[...raw[i].points[0]], [...raw[i].points.at(-1)!]]);
    if (!raw[i].closed) assert.ok(length(smooth[i]) <= length(raw[i]) + 1e-9 && length(smooth[i]) >= 0.5 * length(raw[i]));
  }
});

test("cores: winding by hand on 2 x 2 blocks, ambiguity and walls are skipped, mirror flips the sign", () => {
  const cores = (rows: number[][], states: number, reach = 1) => spiralCores(grid(rows, states), at(rows[0].length, rows.length, 0, 0, 10), 1, reach);
  const clockwise = cores([[0, 2], [6, 4]], 8);
  assert.equal(clockwise.length, 1);
  assert.equal(clockwise[0].winding, 1);
  assert.deepEqual([...clockwise[0].position], [10, 10]);
  assert.equal(clockwise[0].id, "core:1,1");
  assert.equal(cores([[0, 6], [2, 4]], 8)[0].winding, -1, "mirrored: states increase counter-clockwise");
  assert.equal(cores([[0, 4], [4, 0]], 8).length, 0, "a difference of exactly n/2 has no direction");
  assert.equal(cores([[0, 1], [1, 2]], 3).length, 0, "a smooth gradient has winding zero");
  assert.equal(cores([[0, 1], [2, 2]], 3)[0].winding, 1, "n = 3: 0, 1, 2 meet with one repeat");
  assert.equal(cores([[0, 2], [W, 4]], 8).length, 0, "a wall in the loop disables it");
  assert.equal(cores([[0, 2, 0], [6, 4, 0]], 8, 2).length, 0, "the loop for reach 2 needs a 4 x 4 block");
  // Reach 2 on a 4 x 4 block whose middle 2 x 2 is a pinwheel: the outer ring winds once as well.
  const block = [[5, 6, 7, 0], [4, 0, 2, 1], [3, 6, 4, 2], [2, 3, 3, 3]];
  assert.equal(cores(block, 8, 2).length, 1);
});

/* ------------------------------------------------------------------ the instrument */

const recipeFor = (params: Record<string, number | string | boolean> = {}, seed = 42, palette?: number[]) => {
  const input = createInstrument("cyclic-fronts");
  return cyclicFrontsComposition({ ...input, seed, palette: palette ?? input.palette, params: { ...input.params, ...params } });
};
const inputFor = (params: Record<string, number | string | boolean> = {}, seed = 42) => {
  const input = createInstrument("cyclic-fronts");
  return { ...input, seed, params: { ...input.params, ...params } };
};

test("one snapshot serves every drawing: appearance, palette and placement edits reuse it; model and seed-relevant edits do not", () => {
  const base = cyclicSnapshots(recipeFor());
  assert.equal(cyclicSnapshots(recipeFor()), base);
  for (const change of [{ fill: "hatch" }, { fronts: "all", frontWeight: 2, smoothing: 0, echoes: 3 }, { cellMark: "arrow" }, { coreMark: "none" }, { colors: "cycle" },
    { centerX: 200, centerY: 300, width: 400, height: 400 }, { obstacleDraw: "hidden" }, { frontMaterial: "beads", frontColor: "light" }, { hatchAngle: 40 }] as Record<string, number | string | boolean>[])
    assert.equal(cyclicSnapshots(recipeFor(change)), base, JSON.stringify(change));
  assert.equal(cyclicSnapshots(recipeFor({}, 42, [0x111111, 0xeeeeee])), base, "palette");
  for (const change of [{ threshold: 4 }, { states: 9 }, { neighbourhood: "ring" }, { range: 3 }, { columns: 97 }, { seedCount: 6 }, { obstacles: "blocks" }, { initial: "random" }] as Record<string, number | string | boolean>[])
    assert.notEqual(cyclicSnapshots(recipeFor(change)), base, JSON.stringify(change));
  assert.notEqual(cyclicSnapshots(recipeFor({}, 43)), base, "spirals are placed by the seed");
  const fixed = { initial: "stripes", stripeWidth: 3, noise: 0 };
  assert.equal(cyclicSnapshots(recipeFor(fixed, 1)), cyclicSnapshots(recipeFor(fixed, 2)), "a seedless construction shares one snapshot across seeds");
  assert.equal(usesSeed(inputFor(fixed)), false);
  assert.equal(usesSeed(inputFor()), true);
});

test("scrubbing: a shorter run is a prefix of a longer one, and the grid at k is the same object whatever steps is asked", () => {
  const long = cyclicSnapshots(recipeFor({ steps: 60 })), short = cyclicSnapshots(recipeFor({ steps: 25 }));
  assert.deepEqual([...cyclicGrid(long, 25).cells], [...cyclicGrid(short).cells]);
  assert.equal(cyclicGrid(long, 25), cyclicGrid(long, 25));
  assert.deepEqual([...short.history.map((e) => e.value.changed)], [...long.history.slice(0, 26).map((e) => e.value.changed)]);
  assert.equal(long.history.length, 61);
  assert.throws(() => cyclicGrid(short, 26), /Step must be an integer in \[0, 25\]/);
});

test("defaults show the idea: spirals wind, fronts separate the states, and the same grid feeds fills, fronts and cores", () => {
  const recipe = recipeFor(), products = cyclicFrontsProducts(recipe);
  assert.ok(products.summary.cores >= 3, `cores ${products.summary.cores}`);
  assert.ok(products.summary.states.every((count) => count > 0), "every state is present");
  assert.ok(products.summary.advancingEdges > 300);
  assert.equal(products.summary.fixedFrom, -1);
  const fills: unknown[] = [], paths: unknown[] = [], marks: unknown[] = [];
  class Quiet implements CompositionSurface {
    CLOSE = "c"; ROUND = "r"; push() {} pop() {} translate() {} rotate() {} scale() {} noFill() {} noStroke() {} fill() {} stroke() {} strokeWeight() {} strokeCap() {}
    circle() {} line() {} rect() {} beginShape() {} vertex() {} endShape() {}
  }
  drawCyclicFronts(new Quiet(), recipe, { fill: (_p, region) => { fills.push(region); }, front: (_p, path) => { paths.push(path); }, core: (_p, site) => { marks.push(site); } });
  assert.deepEqual(fills, products.regions.filter((r) => r.state !== CYCLIC_WALL), "the consumers receive the cached producer objects themselves");
  assert.equal(fills[0], products.regions[0]);
  assert.equal(paths.length, frontPaths(products.grid, products.geometry, { kinds: "advance", smoothing: 2, seed: recipe.seed }).length);
  assert.equal(marks.length, products.cores.length);
  assert.deepEqual(marks, [...products.cores]);
});

test("palette and material edits repaint without touching the state; structural edits change the picture", () => {
  const base = inputFor();
  const fingerprint = drawFingerprint(base);
  assert.equal(drawFingerprint(base), fingerprint, "deterministic");
  assert.notEqual(drawFingerprint({ ...base, palette: [0x101010, 0xf0c040, 0x2060a0] }), fingerprint);
  assert.notEqual(drawFingerprint(inputFor({ fill: "hatch" })), fingerprint);
  assert.notEqual(drawFingerprint(inputFor({ threshold: 4 })), fingerprint);
  assert.notEqual(drawFingerprint(inputFor({ steps: 71 })), fingerprint);
  assert.notEqual(drawFingerprint(inputFor({}, 7)), fingerprint);
  assert.notEqual(drawFingerprint(inputFor({ echoes: 2, echoSpacing: 6 })), fingerprint, "earlier fronts add paths of earlier grids");
  assert.equal(drawFingerprint(inputFor({ echoes: 2, echoSpacing: 6, fronts: "none" })), drawFingerprint(inputFor({ fronts: "none" })), "no fronts, so nothing to echo");
});

test("a control that is hidden does not change the drawing", () => {
  const choices: Record<string, (number | string | boolean)[]> = {
    initial: ["random", "spirals", "stripes", "stamp"], obstacles: ["none", "blocks", "ring", "bars", "letters"], fill: ["flat", "hatch", "none"],
    cellMark: ["none", "dot", "arrow"], fronts: ["advancing", "all", "none"], frontMaterial: ["ink", "stitch", "beads"], coreMark: ["none", "rings"],
  };
  const others: Record<string, (number | string | boolean)[]> = {
    density: [0.2, 0.7], seedCount: [2, 7], seedSize: [5, 14], stamp: ["target", "triad"], stampX: [0.3, 0.6], stampY: [0.3, 0.6], stripeWidth: [2, 6], stripeAngle: [-40, 80],
    noise: [0, 0.05], obstacleSize: [2, 5], obstacleCount: [2, 7], obstacleGap: [0.1, 0.5], obstacleText: ["AB", "WAVE"], obstacleDraw: ["dark", "light", "hidden"],
    fillOpacity: [0.4, 1], hatchSpacing: [2, 7], hatchWeight: [0.5, 2], hatchAngle: [-30, 60], cellMarkSize: [0.3, 1], cellMarkWeight: [0.4, 2],
    frontColor: ["state", "dark", "light"], frontWeight: [0.5, 2.5], frontSpacing: [3, 12], smoothing: [0, 3], echoes: [0, 3], echoSpacing: [2, 9],
    coreReach: [1, 3], coreSize: [4, 20], coreWeight: [0.5, 2.5],
  };
  let checked = 0;
  for (const [driver, values] of Object.entries(choices)) for (const value of values) {
    const params = { ...createInstrument("cyclic-fronts").params, [driver]: value, columns: 40, steps: 12 };
    const input = { ...createInstrument("cyclic-fronts"), params };
    const shown = new Set(visibleParameters("cyclic-fronts", params).map((p) => p.key));
    const reference = drawFingerprint(input);
    for (const [key, options] of Object.entries(others)) {
      if (shown.has(key)) continue;
      for (const other of options) {
        if (other === params[key]) continue;
        assert.equal(drawFingerprint({ ...input, params: { ...params, [key]: other } }), reference, `${driver}=${value}: hidden ${key}=${other} changed the drawing`);
        checked++;
      }
    }
  }
  assert.ok(checked > 300, `${checked} hidden-control changes checked`);
  const params = createInstrument("cyclic-fronts").params;
  assert.equal(visibleParameters("cyclic-fronts", { ...params, initial: "random" }).some((p) => p.key === "seedCount"), false);
  assert.equal(visibleParameters("cyclic-fronts", { ...params, obstacles: "letters" }).some((p) => p.key === "obstacleText"), true);
});

test("obstacle masks: a planar shape becomes wall runs by cell centre, independent of where the grid is drawn", () => {
  const square = { id: "s", outer: [[2, 1], [5, 1], [5, 3], [2, 3]] as [number, number][], holes: [] };
  const spec = obstacleRuns(square, 8, 4);
  assert.deepEqual(spec, { kind: "cells", runs: [10, 3, 18, 3] }, "cells (2..4, 1..2) have centres inside; row-major runs of length 3");
  const c = construction(8, 4, rule(3, 2, 1, "moore"), stripes(1), spec);
  const cells = stateAt(runSimulation(cyclicSimulation, c, 0, { steps: 3 }), 3).cells;
  assert.deepEqual([10, 11, 12, 18, 19, 20].map((i) => cells[i]), Array(6).fill(W));
  assert.equal([...cells].filter((v) => v === W).length, 6);
  assert.throws(() => runSimulation(cyclicSimulation, construction(8, 4, rule(3, 2, 1, "moore"), stripes(1), { kind: "cells", runs: [30, 5] }), 0, { steps: 1 }), /inside the grid/);
  const letters = recipeFor({ obstacles: "letters", obstacleText: "HI" });
  assert.equal(letters.construction.obstacles.kind, "cells");
  assert.ok((letters.construction.obstacles as { runs: number[] }).runs.length > 20);
  assert.deepEqual(recipeFor({ obstacles: "letters", obstacleText: "HI", centerX: 100 }).construction, letters.construction, "moving the grid does not change which cells are walls");
});

test("every limit names the control to change", () => {
  const message = (params: Record<string, number | string | boolean>) => { try { validateInstrument(inputFor(params)); cyclicFrontsComposition(inputFor(params)); return "no error"; } catch (error) { return (error as Error).message; } };
  assert.match(message({ threshold: 25 }), /Threshold must be an integer in \[1, 24\]/, "Moore range 2 has 24 neighbours");
  assert.match(message({ neighbourhood: "neumann", range: 1, threshold: 5 }), /Threshold must be an integer in \[1, 4\]/);
  assert.match(message({ steps: 2000, columns: 240, width: 640, height: 640 }), /lower Steps, Columns or Range/);
  assert.match(message({ columns: 240, width: 300, height: 400 }), /would have 320 rows, outside \[2, 240\]: lower Columns or the height-to-width ratio of Size/);
  assert.match(message({ obstacles: "letters", obstacleText: "é" }), /Obstacle text must be 1 to 20 printable ASCII/);
  assert.match(message({ obstacles: "bars", obstacleCount: 41 }), /Obstacle count must be an integer in \[0, 40\]/);
  assert.match(message({ states: 2 }), /params.states must be between 3 and 24/);
  assert.match(message({ initial: "stripes", noise: 1.5 }), /params.noise must be between 0 and 1/);
  const hatchy = recipeFor({ columns: 240, fill: "hatch", hatchSpacing: 0.5, initial: "random", steps: 3, echoes: 0 });
  assert.throws(() => drawCyclicFronts(new (class implements CompositionSurface {
    CLOSE = "c"; ROUND = "r"; push() {} pop() {} translate() {} rotate() {} scale() {} noFill() {} noStroke() {} fill() {} stroke() {} strokeWeight() {} strokeCap() {}
    circle() {} line() {} rect() {} beginShape() {} vertex() {} endShape() {}
  })(), { ...hatchy, ink: { ...hatchy.ink, fronts: { ...hatchy.ink.fronts, kinds: "all", material: "stitch", spacing: 1, echoes: 7, echoSpacing: 1 }, cellMark: { kind: "dot", size: 1, weight: 1 } } }),
  /mark operations, above 900000: lower Columns, Echoes or Steps of fronts/);
  assert.equal(CYCLIC_LIMITS.maxWork, 800_000_000);
});

test("preparation is cooperative: cancelled runs cache nothing, a finished one is cached, and the drawing equals a synchronous one", async () => {
  const input = inputFor({ steps: 45, columns: 60 });
  assert.equal(canPrepareInstrument("cyclic-fronts"), true);
  const recipe = cyclicFrontsComposition(input);
  assert.equal(hasCyclicSnapshots(recipe), false);
  assert.equal(await prepareInstrument(input, () => true), false);
  assert.equal(hasCyclicSnapshots(recipe), false, "cancelled before the first step");
  let polls = 0;
  assert.equal(await prepareInstrument(input, () => ++polls > 20), false);
  assert.ok(polls > 20);
  assert.equal(hasCyclicSnapshots(recipe), false, "cancelled part-way leaves no partial snapshot");
  assert.equal(await prepareInstrument(input, () => false), true);
  assert.equal(hasCyclicSnapshots(recipe), true);
  const prepared = drawFingerprint(input);
  const fresh = runSimulation(cyclicSimulation, recipe.construction, 42, { steps: 45, checkpointEvery: CYCLIC_LIMITS.checkpointEvery, maxCheckpointValues: CYCLIC_LIMITS.maxCheckpointValues });
  assert.deepEqual([...cyclicGrid(cyclicSnapshots(recipe)).cells], [...finalState(fresh).cells]);
  assert.equal(drawFingerprint(input), prepared);
});

test("colors: the ramp is a closed loop through the palette and cycle repeats entries; hatching lines are anchored to the origin", () => {
  assert.deepEqual(statePalette([0xff0000, 0x0000ff], 4, "ramp"), [0xff0000, 0x800080, 0x0000ff, 0x800080]);
  assert.deepEqual(statePalette([0xff0000, 0x00ff00, 0x0000ff], 5, "cycle"), [0xff0000, 0x00ff00, 0x0000ff, 0xff0000, 0x00ff00]);
  assert.deepEqual(statePalette([0x123456], 3, "ramp"), [0x123456, 0x123456, 0x123456]);
  const lines = stateHatch([10, 10, 20, 20], 0, 4);
  assert.deepEqual(lines.map((l) => l.map((v) => Math.round(v * 1e9) / 1e9)), [[10, 12, 20, 12], [10, 16, 20, 16], [10, 20, 20, 20]].map((l) => l), "horizontal lines at multiples of 4: y = 12, 16, 20 (the rectangle's edges at 10 and 20; 8 and 12 ...)");
});
