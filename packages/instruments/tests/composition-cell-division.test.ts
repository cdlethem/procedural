import assert from "node:assert/strict";
import test from "node:test";
import {
  agedCells, canPrepareInstrument, definition, MAX_COLONY_WORK, cellColony, cellDivisionComposition, cellDivisionSimulation, cellDivisionSites as cellSites, cellWalls, checkSimulation, colonyAt,
  colonyConstruction, colonyFrameAt, colonyUsesSeed, createInstrument, diffusionPlan, drawCellDivision, drawInstrument, fieldLayout, identical,
  lineagePaths, locateInDomain, nutrientPaths, planarRegion, prepareCellColony, prepareInstrument, stateAt, usesSeed, validateInstrument, wallHatch, wallPaths,
  colonyOptionsOf, type ColonyOptions, type CompositionSurface, type InstrumentInput,
} from "../dist/index.js";

/** Counts what a drawing does and remembers its translation; nothing else. */
class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  circles: [number, number, number][] = []; shapes = 0; lines = 0; offset: [number, number] = [0, 0];
  #depth: [number, number][] = [[0, 0]];
  push() { this.#depth.push([...this.#depth[this.#depth.length - 1]]); }
  pop() { this.#depth.pop(); }
  translate(x: number, y: number) { const top = this.#depth[this.#depth.length - 1]; top[0] += x; top[1] += y; }
  rotate() {} scale() {} noFill() {} noStroke() {} fill() {} stroke() {} strokeWeight() {} strokeCap() {} rect() {} vertex() {}
  circle(x: number, y: number, d: number) { const at = this.#depth[this.#depth.length - 1]; this.circles.push([x + at[0], y + at[1], d]); }
  line() { this.lines++; }
  beginShape() {} endShape() { this.shapes++; }
}

/** A small box, no sources, one seed at the centre, no relaxation and a fixed axis: every quantity has a closed form. */
const base: ColonyOptions = {
  width: 240, height: 240, boundary: "box", fieldCell: 10, source: "none", sourceAngle: 0, sourceOffset: 0, sourceSize: 0, reserve: 0.5, diffusion: 0,
  seedLayout: "cluster", seedCount: 1, seedX: 0.5, seedY: 0.5, seedSpread: 0, seedAngle: 0, startRadius: 4, divideRadius: 8, uptake: 0.1, maxCells: 50,
  split: 0.5, orientation: "fixed", splitAngle: 0, orientJitter: 0, overlap: 0, stiffness: 0, relax: 1,
};
const near = (actual: number, expected: number, tolerance: number, note = "") => assert.ok(Math.abs(actual - expected) <= tolerance, `${note} ${actual} != ${expected} (±${tolerance})`);
const sum = (values: ArrayLike<number>) => { let total = 0; for (let i = 0; i < values.length; i++) total += values[i]; return total; };

/** A dish fed from its rim with everything switched on: sources, diffusion, divisions, relaxation, walls. */
const fed: ColonyOptions = {
  ...base, width: 300, height: 300, boundary: "dish", source: "ring", sourceSize: 0.08, reserve: 0.1, diffusion: 80, uptake: 0.12, startRadius: 5,
  divideRadius: 9, seedCount: 3, seedSpread: 10, maxCells: 80, relax: 2, stiffness: 0.5, orientation: "random",
};

const params = (input: InstrumentInput, over: Record<string, number | string | boolean>): InstrumentInput => ({ ...input, params: { ...input.params, ...over } });

/* ------------------------------------------------------------------ closed forms of the model */

test("growth: the first step gives r sqrt(1 + uptake c) and takes exactly that area from the field", () => {
  const colony = cellColony(base, 1, 1);
  // Uniform concentration c = 0.5; a disc absorbs uptake * c * (its own area), whatever the field resolution.
  const expected = 4 * Math.sqrt(1 + 0.1 * 0.5);
  near(colony.cells[0].radius, expected, 1e-9, "radius");
  const gained = Math.PI * (expected ** 2 - 16);
  near(gained, 0.1 * 0.5 * Math.PI * 16, 1e-9, "the gain is the footprint's uptake");
  near(colony.totals.nutrient, 0.5 * 240 * 240 - gained, 1e-6, "field mass");
  near(colony.totals.absorbed, gained, 1e-9, "absorbed");
  // The same cell on a finer and a coarser grid absorbs the same amount.
  for (const fieldCell of [5, 8, 20]) near(cellColony({ ...base, fieldCell }, 1, 1).cells[0].radius, expected, 1e-9, `field cell ${fieldCell}`);
});

test("conservation: cell area plus field nutrient equals its start plus everything the sources added, at every retained step", () => {
  const snaps = cellColony(fed, 7, 90).snapshots;
  const area = (state: { r: number[] }) => sum(state.r.map((r) => Math.PI * r * r));
  const first = stateAt(snaps, 0);
  const total0 = area(first) + sum(first.field);
  for (const k of [1, 20, 45, 70, 90]) {
    const state = stateAt(snaps, k);
    near(area(state) + sum(state.field) - total0, state.inflow, 1e-6 * total0, `step ${k}`);
    assert.ok(state.field.every((v) => v >= 0), `nutrient never negative at ${k}`);
  }
  const last = stateAt(snaps, 90);
  assert.ok(last.inflow > 0 && last.id.length > 3, "the sources fed real growth");
});

test("division keeps area and the centre of area, places touching daughters on the axis, and names them from the birth counter", () => {
  const options: ColonyOptions = { ...base, width: 400, height: 400, uptake: 0.2, reserve: 1, split: 0.7, splitAngle: 30, maxCells: 5 };
  const colony = cellColony(options, 3, 60);
  const mother = colony.ancestors[0];
  assert.equal(mother.id, "cell:0");
  assert.deepEqual([...mother.position], [200, 200]);
  near(mother.radius, 8, 1e-9);
  const at = stateAt(colony.snapshots, mother.divided!);
  const [a, b] = [at.id.indexOf(1), at.id.indexOf(2)];
  assert.ok(a >= 0 && b >= 0 && at.birth[a] === mother.divided && at.parent[a] === 0 && at.parent[b] === 0, "daughters are cell:1 and cell:2, born at the division step");
  near(at.r[a] ** 2, 0.7 * 64, 1e-9, "larger daughter's area share");
  near(at.r[b] ** 2, 0.3 * 64, 1e-9, "smaller daughter's area share");
  const [ux, uy] = [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)], gap = at.r[a] + at.r[b];
  near(at.x[a], 200 + ux * gap * 0.3, 1e-9); near(at.y[a], 200 + uy * gap * 0.3, 1e-9);
  near(at.x[b], 200 - ux * gap * 0.7, 1e-9); near(at.y[b], 200 - uy * gap * 0.7, 1e-9);
  near(Math.hypot(at.x[a] - at.x[b], at.y[a] - at.y[b]), gap, 1e-9, "daughters touch");
  near((at.r[a] ** 2 * at.x[a] + at.r[b] ** 2 * at.x[b]) / 64, 200, 1e-9, "centre of area x");
  near((at.r[a] ** 2 * at.y[a] + at.r[b] ** 2 * at.y[b]) / 64, 200, 1e-9, "centre of area y");
});

test("ids are a birth counter: unique, dense, parents older than children, two births per division", () => {
  const colony = cellColony({ ...fed, maxCells: 40 }, 5, 120);
  const everyone = [...colony.cells, ...colony.ancestors].sort((p, q) => p.serial - q.serial);
  assert.deepEqual(everyone.map((cell) => cell.serial), Array.from({ length: colony.totals.births }, (_, k) => k));
  assert.equal(colony.totals.births, 3 + 2 * colony.ancestors.length);
  assert.equal(colony.cells.length, 3 + colony.ancestors.length, "each division adds exactly one live cell");
  assert.ok(colony.cells.every((cell, k, list) => k === 0 || list[k - 1].serial < cell.serial), "live cells ascend by id");
  const byId = new Map(everyone.map((cell) => [cell.id, cell] as const));
  for (const cell of everyone) {
    if (cell.parent === null) { assert.equal(cell.generation, 0); assert.equal(cell.root, cell.id); continue; }
    const parent = byId.get(cell.parent)!;
    assert.ok(parent.serial < cell.serial && parent.divided === cell.birth, `${cell.id} was born when ${parent.id} divided`);
    assert.equal(cell.generation, parent.generation + 1);
    assert.equal(cell.root, parent.root);
  }
});

test("relaxation: equal cells close their overlap by (1 - stiffness) per pass and stay centred", () => {
  // Two radius-5 cells 4 apart overlap by 6, and each pass removes the share `stiffness` of what is left.
  const still: ColonyOptions = { ...base, reserve: 0, seedLayout: "line", seedCount: 2, seedSpread: 2, startRadius: 5, divideRadius: 8, stiffness: 0.5 };
  for (const relax of [1, 2, 3, 4]) {
    const s = stateAt(cellColony({ ...still, relax }, 1, 1).snapshots, 1);
    near(Math.abs(s.x[1] - s.x[0]), 10 - 6 * 0.5 ** relax, 1e-9, `${relax} passes`);
    near(s.y[0], s.y[1], 1e-12);
    near((s.x[0] + s.x[1]) / 2, 120, 1e-9, "the pair's centre stays");
  }
  const loose = stateAt(cellColony({ ...still, overlap: 0.4, stiffness: 1, relax: 1 }, 1, 1).snapshots, 1);
  near(Math.abs(loose.x[1] - loose.x[0]), 10 * 0.6, 1e-9, "with 40% overlap allowed they settle at 0.6 (r1 + r2)");
});

test("relaxation: unequal cells split the correction by area, and the larger one yields less", () => {
  // Only the cells inside the source spot grow; a source off-centre makes the two seeds grow to different radii.
  const options: ColonyOptions = { ...base, source: "point", sourceAngle: 0, sourceOffset: 0, sourceSize: 0, reserve: 0, uptake: 0.5, seedLayout: "line", seedCount: 2,
    seedX: 0.5 - 0.02, seedSpread: 3, startRadius: 5, divideRadius: 20, stiffness: 0.25, relax: 1 };
  const s = stateAt(cellColony(options, 1, 1).snapshots, 1);
  const [m0, m1] = [s.r[0] ** 2, s.r[1] ** 2];
  assert.ok(Math.abs(s.r[0] - s.r[1]) > 0.05, `radii differ: ${s.r[0]} ${s.r[1]}`);
  const x0 = 115.2 - 3, x1 = 115.2 + 3, overlap = s.r[0] + s.r[1] - (x1 - x0);
  assert.ok(overlap > 0);
  near(s.x[0], x0 - 0.25 * overlap * m1 / (m0 + m1), 1e-9, "cell 0 moves by the other's share");
  near(s.x[1], x1 + 0.25 * overlap * m0 / (m0 + m1), 1e-9, "cell 1 moves by the other's share");
  const [big, small] = m0 > m1 ? [0, 1] : [1, 0], start = [x0, x1];
  assert.ok(Math.abs(s.x[big] - start[big]) < Math.abs(s.x[small] - start[small]), "the larger cell moves less");
});

/* ------------------------------------------------------------------ boundaries, collisions, termination */

test("cells never vanish: the count only grows, every earlier id survives as a cell or an ancestor, and all stay inside the box", () => {
  const crowded: ColonyOptions = { ...base, width: 120, height: 120, uptake: 0.3, reserve: 1, startRadius: 4, divideRadius: 7, maxCells: 80, stiffness: 0.5, relax: 4, orientation: "random" };
  const colony = cellColony(crowded, 2, 90);
  let previous = new Set<string>(), count = 0;
  for (const k of [0, 10, 25, 40, 60, 90]) {
    const state = stateAt(colony.snapshots, k);
    assert.ok(state.id.length >= count, `count at ${k}`);
    count = state.id.length;
    const known = new Set([...state.id, ...state.dead.id].map((serial) => `cell:${serial}`));
    for (const id of previous) assert.ok(known.has(id), `${id} survives to step ${k}`);
    previous = known;
    for (let c = 0; c < state.id.length; c++) {
      assert.ok(state.x[c] >= state.r[c] - 1e-9 && state.x[c] <= 120 - state.r[c] + 1e-9 && state.y[c] >= state.r[c] - 1e-9 && state.y[c] <= 120 - state.r[c] + 1e-9, `cell ${state.id[c]} inside at ${k}`);
    }
  }
  assert.ok(count > 30, "the box did fill");
});

test("the dish keeps every whole cell inside the inscribed ellipse", () => {
  const colony = cellColony({ ...fed, reserve: 0.6, source: "none", maxCells: 60 }, 4, 80);
  const o = colony.options;
  for (const cell of colony.cells) {
    const ax = o.width / 2 - cell.radius, ay = o.height / 2 - cell.radius;
    const e = ((cell.position[0] - o.width / 2) / ax) ** 2 + ((cell.position[1] - o.height / 2) / ay) ** 2;
    assert.ok(e <= 1 + 1e-9, `${cell.id} inside the dish (${e})`);
  }
});

test("the cell limit ends the colony: full, every cell grown to the division radius, then the same state for ever", () => {
  const options: ColonyOptions = { ...base, diffusion: 100, uptake: 0.3, reserve: 1, maxCells: 12, stiffness: 0.5, relax: 4, orientation: "random" };
  const colony = cellColony(options, 9, 200);
  assert.equal(colony.cells.length, 12);
  assert.equal(colony.status, "settled");
  assert.ok(colony.fullAt !== null && colony.haltedAt !== null && colony.fullAt <= colony.haltedAt && colony.haltedAt < 200);
  for (const cell of colony.cells) near(cell.radius, 8, 1e-8);
  const stopped = stateAt(colony.snapshots, colony.haltedAt!);
  for (const k of [colony.haltedAt! + 1, colony.haltedAt! + 9, 200]) assert.ok(identical(stateAt(colony.snapshots, k), stopped), `step ${k} equals the halt state`);
  assert.ok(colony.ancestors.length === 11 && colonyFrameAt(colony, colony.haltedAt! - 1).cells <= 12);
});

test("no nutrient and no source: the colony stops at once as starved and nothing grows", () => {
  const colony = cellColony({ ...base, reserve: 0 }, 1, 25);
  assert.equal(colony.status, "starved");
  assert.equal(colony.haltedAt, 1);
  assert.equal(colony.cells.length, 1);
  near(colony.cells[0].radius, 4, 0);
});

test("a finite reserve is eaten: the colony converts all of it to area and stops as starved", () => {
  const options: ColonyOptions = { ...base, width: 40, height: 40, fieldCell: 5, reserve: 0.3, uptake: 0.5, startRadius: 3, divideRadius: 6, maxCells: 100, diffusion: 20 };
  const colony = cellColony(options, 1, 1000);
  assert.equal(colony.status, "starved");
  assert.ok(colony.haltedAt !== null && colony.haltedAt < 1000, `halted at ${colony.haltedAt}`);
  assert.ok(colony.totals.nutrient < 1e-6);
  const area0 = Math.PI * 9, reserve = 0.3 * 40 * 40;
  near(colony.totals.area, area0 + reserve, 1e-5, "all the reserve became cell area");
  assert.equal(colony.totals.inflow, 0);
});

/* ------------------------------------------------------------------ orientation, structure, source */

test("division axis rules: along or across the gradient, outward from the colony, or fixed", () => {
  const edge: ColonyOptions = { ...base, source: "edge", sourceAngle: 0, sourceSize: 0.05, reserve: 0.2, diffusion: 200, uptake: 0.3, startRadius: 6, divideRadius: 7, maxCells: 3 };
  const direction = (options: ColonyOptions) => {
    const colony = cellColony(options, 1, 30), at = stateAt(colony.snapshots, colony.ancestors[0].divided!);
    const [a, b] = [at.id.indexOf(1), at.id.indexOf(2)];
    return { dx: at.x[a] - at.x[b], dy: at.y[a] - at.y[b] };
  };
  const along = direction({ ...edge, orientation: "gradient" });
  assert.ok(along.dx > 0 && Math.abs(along.dy) < 1e-6 * along.dx, `along the gradient toward the source: ${JSON.stringify(along)}`);
  const across = direction({ ...edge, orientation: "across" });
  assert.ok(Math.abs(across.dx) < 1e-6 * Math.abs(across.dy), `across: ${JSON.stringify(across)}`);
  const left = direction({ ...edge, orientation: "gradient", sourceAngle: 180 });
  assert.ok(left.dx < 0 && Math.abs(left.dy) < 1e-6 * Math.abs(left.dx), "source on the left flips the lead");
  const line: ColonyOptions = { ...base, source: "none", reserve: 1, uptake: 0.3, startRadius: 6, divideRadius: 7, seedLayout: "line", seedCount: 3, seedSpread: 60, maxCells: 4, orientation: "radial", split: 0.7 };
  const radial = cellColony(line, 1, 30), when = radial.ancestors.find((c) => c.id === "cell:0")!.divided!;
  const state = stateAt(radial.snapshots, when);
  const larger = state.id.indexOf(3), smaller = state.id.indexOf(4);
  assert.ok(state.x[larger] < state.x[smaller], "the left seed's larger daughter leads outward (left)");
  const twelve = direction({ ...edge, orientation: "fixed", splitAngle: 90 });
  assert.ok(Math.abs(twelve.dx) < 1e-9 && twelve.dy > 0, "fixed 90 degrees: straight down the canvas");
});

test("moving the nutrient source changes the colony: it leans toward the food", () => {
  const options = (sourceAngle: number): ColonyOptions => ({ ...base, width: 300, height: 300, source: "edge", sourceAngle, sourceSize: 0.1, reserve: 0, diffusion: 200,
    uptake: 0.2, startRadius: 6, divideRadius: 9, maxCells: 60, stiffness: 0.5, relax: 2, orientation: "random" });
  const meanX = (angle: number) => { const cells = cellColony(options(angle), 5, 260).cells; return sum(cells.map((c) => c.position[0])) / cells.length; };
  const right = meanX(0), left = meanX(180);
  assert.ok(right - left > 8, `right source ${right}, left source ${left}`);
});

test("split: the larger daughter takes exactly the stated area share", () => {
  for (const split of [0.5, 0.6, 0.9]) {
    const colony = cellColony({ ...base, uptake: 0.3, reserve: 1, split, maxCells: 3 }, 1, 30);
    const at = stateAt(colony.snapshots, colony.ancestors[0].divided!);
    const [a, b] = [at.id.indexOf(1), at.id.indexOf(2)];
    near(at.r[a] ** 2 / 64, split, 1e-9); near(at.r[b] ** 2 / 64, 1 - split, 1e-9);
  }
});

/* ------------------------------------------------------------------ the F7 guarantees and the cache */

test("the simulation obeys the snapshot guarantees for two constructions (checkSimulation)", () => {
  checkSimulation(cellDivisionSimulation, colonyConstruction(fed), 11, 30);
  checkSimulation(cellDivisionSimulation, colonyConstruction({ ...fed, boundary: "box", source: "edge", sourceAngle: 45, orientation: "gradient", orientJitter: 20 }), 3, 26);
});

test("scrubbing: the state at any earlier step equals a fresh run to that step, and more steps only append", () => {
  const long = cellColony(fed, 6, 70);
  for (const k of [0, 13, 25, 26, 50, 69]) {
    const scrubbed = colonyAt(long, k);
    assert.ok(identical(stateAt(long.snapshots, k), stateAt(scrubbed.snapshots, k)), `step ${k}`);
    assert.deepEqual(scrubbed.cells.map((c) => [c.id, c.position[0], c.position[1], c.radius]), cellColony(fed, 6, k).cells.map((c) => [c.id, c.position[0], c.position[1], c.radius]));
    assert.ok(scrubbed.cells.length <= long.cells.length + long.ancestors.length);
  }
  const prefix = cellColony(fed, 6, 40);
  for (const k of [0, 17, 40]) assert.ok(identical(stateAt(prefix.snapshots, k), stateAt(long.snapshots, k)));
});

test("cancellation publishes and caches nothing, and no step is re-run after a clean finish", async () => {
  const options: ColonyOptions = { ...fed, maxCells: 30 };
  let calls = 0;
  const step = cellDivisionSimulation.step;
  cellDivisionSimulation.step = (state, ctx) => { calls++; return step(state, ctx); };
  try {
    let polls = 0;
    assert.equal(await prepareCellColony(options, 21, 40, () => ++polls > 6), null);
    assert.ok(calls <= 6, `${calls} steps ran before the cancel`);
    calls = 0;
    const done = await prepareCellColony(options, 21, 40, () => false);
    assert.ok(done !== null && calls === 40, `a fresh run of 40 steps, not a reuse of the abandoned one: ${calls}`);
    calls = 0;
    assert.equal(cellColony(options, 21, 40), done);
    assert.equal(calls, 0, "the cached colony is returned as it is");
    const longer = cellColony(options, 21, 46);
    assert.equal(calls, 6, "extending a cached run costs only the new steps");
    assert.notEqual(longer, done);
  } finally { cellDivisionSimulation.step = step; }
});

test("appearance and placement reuse the very same snapshot; construction edits and seeds that matter recompute", () => {
  const input = createInstrument("cell-division");
  const snapshotOf = (over: Record<string, number | string | boolean>, seed = input.seed) => {
    const composition = cellDivisionComposition({ ...params(input, over), seed });
    return cellColony(composition.colony, composition.seed, composition.steps).snapshots;
  };
  const reference = snapshotOf({ steps: 40 });
  for (const over of [{ colorBy: "age" }, { colorBy: "size" }, { cells: "outlines" }, { cells: "none" }, { cellFit: 0.5 }, { lineage: "beads" }, { lineageColor: "cell" },
    { nutrient: "contours" }, { nutrientLevels: 9 }, { walls: "both" }, { wallReach: 3 }, { hatchAngle: 10 }, { ageMin: 0.2 }, { ageMax: 0.7 }, { centerX: 100 }, { centerY: 500 }])
    assert.equal(snapshotOf({ steps: 40, ...over }), reference, JSON.stringify(over));
  const palette = cellDivisionComposition({ ...input, palette: [0xffffff, 0x000000], params: { ...input.params, steps: 40 } });
  assert.equal(cellColony(palette.colony, palette.seed, palette.steps).snapshots, reference, "a new palette");
  for (const over of [{ sourceSize: 0.12 }, { seedX: 0.4 }, { uptake: 0.13 }, { split: 0.7 }, { maxCells: 100 }, { source: "edge" }, { boundary: "box" }, { relax: 3 }, { diffusion: 90 }, { fieldCell: 9 }, { width: 500 }])
    assert.notEqual(snapshotOf({ steps: 40, ...over }), reference, JSON.stringify(over));
  assert.notEqual(snapshotOf({ steps: 40 }, 43), reference, "a random division axis depends on the seed");
  // Hidden controls are pinned: an unused source direction or a jitter under a random axis is not a new construction.
  // (The cache holds six colonies, so ask again for the reference the construction edits above may have evicted.)
  const again = snapshotOf({ steps: 40 });
  assert.equal(snapshotOf({ steps: 40, source: "ring", sourceAngle: 77 }), again);
  assert.equal(snapshotOf({ steps: 40, orientation: "random", orientJitter: 40 }), again);
  const fixed = { orientation: "fixed", splitAngle: 20, steps: 40 };
  assert.equal(snapshotOf(fixed, 1), snapshotOf(fixed, 2), "with a fixed axis and a deterministic layout the seed is irrelevant");
  assert.equal(colonyUsesSeed({ seedLayout: "scatter", orientation: "fixed", orientJitter: 0 }), true);
  assert.equal(usesSeed({ ...input, params: { ...input.params, ...fixed } }), false);
  assert.equal(usesSeed(input), true);
});

test("moving the dish translates every mark and touches nothing else", () => {
  const input = createInstrument("cell-division");
  const draw = (over: Record<string, number>) => { const r = new Recorder(); drawCellDivision(r, cellDivisionComposition(params({ ...input, params: { ...input.params, steps: 60 } }, over))); return r.circles; };
  const a = draw({ centerX: 320, centerY: 320 }), b = draw({ centerX: 250, centerY: 400 });
  assert.equal(a.length, b.length);
  assert.ok(a.length > 5);
  a.forEach((circle, k) => { near(b[k][0] - circle[0], -70, 1e-9); near(b[k][1] - circle[1], 80, 1e-9); near(b[k][2], circle[2], 0); });
});

/* ------------------------------------------------------------------ bounds name their control */

test("every bound refuses by naming the control to change", () => {
  const bad = (over: Partial<ColonyOptions>, steps = 10) => () => cellColony({ ...base, ...over }, 1, steps);
  assert.throws(bad({ width: 2000, height: 2000, fieldCell: 1 }), /field cell/);
  assert.throws(bad({ maxCells: 2001 }), /Cell limit/);
  assert.throws(bad({}, 1001), /Steps/);
  assert.throws(bad({ startRadius: 9 }), /Start radius/);
  assert.throws(bad({ seedCount: 60 }), /Seed cells/);
  assert.throws(bad({ diffusion: 1_000_000 }), /Diffusion/);
  assert.throws(bad({ uptake: 0 }), /Uptake/);
  assert.throws(bad({ split: 0.4 }), /Split/);
  assert.throws(bad({ relax: 0 }), /Relaxation/);
  assert.throws(bad({ boundary: "ring" as never }), /Boundary/);
  const crowded: ColonyOptions = { ...base, width: 20, height: 20, fieldCell: 5, seedCount: 400, seedSpread: 4, startRadius: 3, maxCells: 400, stiffness: 0.5, relax: 1 };
  assert.throws(() => cellColony(crowded, 1, 2), /too crowded|Cell limit/);
  const input = createInstrument("cell-division");
  // An inverted age window is not an error: it selects nothing.
  const inverted = cellDivisionComposition(params(input, { steps: 40, ageMin: 0.8, ageMax: 0.2 }));
  assert.equal(cellSites(cellColony(inverted.colony, inverted.seed, inverted.steps), { colorBy: "age", palette: 3, min: 0.8, max: 0.2 }).length, 0);
  assert.throws(() => validateInstrument(params(input, { width: 620, height: 620, fieldCell: 1 })), /field cell/);
});

test("diffusion is spent in canvas units whatever the field resolution: passes * coefficient * cell^2 = diffusion, each pass convex", () => {
  for (const diffusion of [0, 3, 20, 100, 400]) for (const fieldCell of [4, 6, 8, 16]) {
    const { passes, coefficient } = diffusionPlan({ diffusion, fieldCell });
    near(passes * coefficient * fieldCell ** 2, diffusion, 1e-9 * Math.max(1, diffusion));
    assert.ok(coefficient <= 0.25 + 1e-15 && passes >= 1);
  }
});

/* ------------------------------------------------------------------ the treatments read one colony */

test("lineage graph: a node per cell that ever lived, an edge per birth weighted by the area share, aged from birth", () => {
  const colony = cellColony({ ...base, uptake: 0.3, reserve: 1, split: 0.7, maxCells: 9 }, 1, 60);
  const { lineage } = colony;
  assert.equal(lineage.nodes.length, colony.totals.births);
  assert.equal(lineage.edges.length, colony.totals.births - 1, "a tree from one founder");
  const born = new Map([...colony.cells, ...colony.ancestors].map((cell) => [cell.id, cell] as const));
  for (const edge of lineage.edges) {
    const child = born.get(edge.to)!;
    assert.equal(edge.from, child.parent);
    near(edge.weight, child.share, 0);
    assert.equal(edge.age, 60 - child.birth + 1);
    assert.ok(edge.weight === 0.7 || Math.abs(edge.weight - 0.3) < 1e-15);
  }
  const at = new Map(lineage.nodes.map((node) => [node.id, node.position] as const));
  for (const cell of born.values()) assert.deepEqual([...at.get(cell.id)!], [...cell.position]);
});

test("age selection keeps exactly the cells whose age (steps - birth) / steps lies in the window, and moves none", () => {
  const colony = cellColony(fed, 2, 80);
  const age = (birth: number) => (80 - birth) / 80;
  const all = cellSites(colony, { colorBy: "generation", palette: 5, min: 0, max: 1 });
  assert.equal(all.length, colony.cells.length);
  for (const [min, max] of [[0, 0.3], [0.3, 0.8], [0.9, 1], [0, 0]] as const) {
    const kept = agedCells(colony, min, max), sites = cellSites(colony, { colorBy: "generation", palette: 5, min, max });
    const expected = colony.cells.filter((cell) => age(cell.birth) >= min && age(cell.birth) <= max).map((cell) => cell.id);
    assert.deepEqual([...kept].sort(), expected.sort(), `window ${min}-${max}`);
    assert.deepEqual(sites.map((s) => s.id).sort(), expected.sort());
    for (const site of sites) assert.deepEqual([...site.position], [...colony.cells.find((cell) => cell.id === site.id)!.position]);
  }
  const oldest = cellSites(colony, { colorBy: "generation", palette: 5, min: 1, max: 1 });
  assert.deepEqual(oldest.map((s) => s.birth), oldest.map(() => 0), "only cells born at step 0 are as old as the run");
  const edges = lineagePaths(colony, { colorBy: "generation", palette: 5, min: 0, max: 0.2, color: "cell" });
  const keep = new Set([...agedCells(colony, 0, 0.2), ...colony.ancestors.filter((c) => age(c.birth) <= 0.2).map((c) => c.id)]);
  assert.deepEqual(edges.map((path) => path.id.split(">")[1]).sort(), [...keep].sort());
});

test("colour: ramps span the palette from founders to the deepest generation; palette edits move no site", () => {
  const colony = cellColony(fed, 8, 90);
  const five = cellSites(colony, { colorBy: "generation", palette: 5, min: 0, max: 1 });
  const byGeneration = new Map(five.map((s) => [s.generation, s.tone]));
  assert.ok(colony.generations >= 4, "a deep colony");
  const tones = [...byGeneration.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]!);
  assert.ok(tones.every((t, k) => k === 0 || t >= tones[k - 1]), "a ramp");
  for (const s of five) assert.equal(s.tone, Math.min(4, Math.floor(s.generation / Math.max(1, colony.generations) * 5)));
  const two = cellSites(colony, { colorBy: "generation", palette: 2, min: 0, max: 1 });
  five.forEach((s, k) => assert.deepEqual([...s.position], [...two[k].position]));
  const roots = cellSites(colony, { colorBy: "root", palette: 7, min: 0, max: 1 });
  for (const s of roots) assert.equal(s.tone, Number(s.root.slice(5)) % 7);
});

test("walls tile the dish: with a long reach the Voronoi areas add up to width x height and each holds only its own cell centre", () => {
  const colony = cellColony({ ...fed, boundary: "box" }, 3, 60);
  const walls = cellWalls(colony, 1000);
  assert.equal(walls.length, colony.cells.length);
  near(sum(walls.map((w) => w.area)), 300 * 300, 1e-6 * 300 * 300);
  for (const wall of walls.slice(0, 40)) {
    const region = planarRegion({ id: wall.id, outer: wall.polygon.map((p) => [p[0], p[1]] as [number, number]) });
    for (const cell of colony.cells) {
      const where = locateInDomain(region, cell.position[0], cell.position[1]);
      if (cell.id === wall.cell) assert.equal(where, "inside", `${cell.id} inside its wall`);
      else assert.notEqual(where, "inside", `${cell.id} is not inside ${wall.id}`);
    }
  }
  // A short reach bounds each wall by the 24-gon whose inradius is reach x radius: area <= 24 a^2 tan(pi/24).
  for (const wall of cellWalls(colony, 1.3)) {
    const a = 1.3 * colony.cells.find((cell) => cell.id === wall.cell)!.radius;
    assert.ok(wall.area <= 24 * a * a * Math.tan(Math.PI / 24) + 1e-9, wall.id);
  }
});

test("hatching covers each wall: total stroke length is close to area over spacing, and the direction turns per generation", () => {
  const colony = cellColony({ ...fed, boundary: "box", maxCells: 60 }, 3, 100);
  const spacing = 2;
  const strokes = wallHatch(colony, { reach: 1.5, spacing, angle: 0, twist: 0, colorBy: "generation", palette: 5, min: 0, max: 1 });
  const length = sum(strokes.map((p) => Math.hypot(p.points[1][0] - p.points[0][0], p.points[1][1] - p.points[0][1])));
  const area = sum(cellWalls(colony, 1.5).map((w) => w.area));
  near(length / (area / spacing), 1, 0.06, "hatch length against area / spacing");
  const twisted = wallHatch(colony, { reach: 1.5, spacing, angle: 10, twist: 25, colorBy: "generation", palette: 5, min: 0, max: 1 });
  // Direction as an undirected angle in [0, 180) degrees: lines at `angle + twist x generation`.
  const direction = (p: { points: readonly (readonly number[])[] }) => (((Math.atan2(p.points[1][1] - p.points[0][1], p.points[1][0] - p.points[0][0]) * 180 / Math.PI) % 180) + 180) % 180;
  const generation = new Map(colony.cells.map((c) => [c.id, c.generation] as const));
  const seen = new Set<number>();
  for (const path of twisted) {
    const g = generation.get(path.id.split("/")[0])!;
    seen.add(g);
    const expected = (10 + 25 * g) % 180, d = direction(path), gap = Math.abs(d - expected);
    assert.ok(Math.min(gap, 180 - gap) < 1e-6, `${path.id} generation ${g}: ${d} != ${expected}`);
  }
  assert.ok(seen.size >= 2, `several generations were hatched: ${[...seen]}`);
});

test("nutrient contours stay inside the wall, one family per level, and follow the concentration", () => {
  const colony = cellColony(fed, 1, 60);
  const paths = nutrientPaths(colony, 3);
  const o = colony.options;
  const levels = [...new Set(paths.map((p) => p.level))].sort();
  assert.ok(levels.length >= 2 && levels.every((level) => [0.25, 0.5, 0.75].includes(level)), `levels ${levels}`);
  for (const path of paths) for (const [x, y] of path.points)
    assert.ok(((x - o.width / 2) / (o.width / 2)) ** 2 + ((y - o.height / 2) / (o.height / 2)) ** 2 <= 1 + 1e-6, `${path.id} inside the dish`);
  // Sample the field: on a contour the concentration is the level (bilinear over the grid).
  const { columns } = fieldLayout(o), at = (x: number, y: number) => {
    const gx = x / o.fieldCell - 0.5, gy = y / o.fieldCell - 0.5, i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
    const v = (a: number, b: number) => colony.field.values[Math.min(colony.field.rows - 1, Math.max(0, b)) * columns + Math.min(columns - 1, Math.max(0, a))];
    return v(i, j) * (1 - fx) * (1 - fy) + v(i + 1, j) * fx * (1 - fy) + v(i, j + 1) * (1 - fx) * fy + v(i + 1, j + 1) * fx * fy;
  };
  const inner = paths.filter((p) => p.level === 0.5).flatMap((p) => p.points).filter(([x, y]) => Math.hypot(x - 150, y - 150) < 110);
  assert.ok(inner.length > 5);
  for (const [x, y] of inner) near(at(x, y), 0.5, 0.06, `concentration on the 0.5 contour at ${x.toFixed(1)},${y.toFixed(1)}`);
});

test("drawing: one disc per selected cell, one stroke per lineage link, and the same colony under every treatment", () => {
  const input = createInstrument("cell-division");
  const composition = cellDivisionComposition(params(input, { steps: 90, lineage: "ink", cells: "discs", cellFit: 0.5 }));
  const colony = cellColony(composition.colony, composition.seed, composition.steps);
  const r = new Recorder();
  drawCellDivision(r, composition);
  assert.equal(r.circles.length, colony.cells.length);
  assert.equal(r.shapes, colony.lineage.edges.length);
  const sorted = [...r.circles].sort((p, q) => p[2] - q[2]), radii = colony.cells.map((c) => c.radius * 2 * 0.5).sort((p, q) => p - q);
  sorted.forEach((circle, k) => near(circle[2], radii[k], 1e-9));
  // Every treatment on: still one colony, so the discs are where they were.
  const busy = cellDivisionComposition(params(input, { steps: 90, lineage: "ink", cells: "discs", cellFit: 0.5, nutrient: "contours", walls: "both" }));
  assert.equal(cellColony(busy.colony, busy.seed, busy.steps), colony);
  const r2 = new Recorder();
  drawCellDivision(r2, busy);
  assert.deepEqual(r2.circles, r.circles);
  assert.ok(r2.shapes > r.shapes && r2.lines >= 0);
  assert.ok(wallPaths(colony, { reach: 1.6, colorBy: "size", palette: 3, min: 0, max: 1 }).every((p) => p.closed));
});

test("a consumer callback replaces a treatment without changing the colony", () => {
  const input = createInstrument("cell-division");
  const composition = cellDivisionComposition(params(input, { steps: 60 }));
  const seen: string[] = [];
  drawCellDivision(new Recorder(), composition, { cell: (_surface, site) => { seen.push(site.id); } });
  assert.deepEqual(seen, cellColony(composition.colony, composition.seed, composition.steps).cells.map((c) => c.id));
});

/* ------------------------------------------------------------------ the instrument */

test("the instrument prepares cooperatively, draws from the prepared colony, and cancels cleanly", async () => {
  const input = params(createInstrument("cell-division"), { steps: 120, maxCells: 200 });
  assert.equal(canPrepareInstrument("cell-division"), true);
  let calls = 0;
  const step = cellDivisionSimulation.step;
  cellDivisionSimulation.step = (state, ctx) => { calls++; return step(state, ctx); };
  try {
    let polls = 0;
    assert.equal(await prepareInstrument(input, () => ++polls > 4), false);
    calls = 0;
    assert.equal(await prepareInstrument(input, () => false), true);
    assert.equal(calls, 120);
    calls = 0;
    drawInstrument(new Recorder() as never, input);
    assert.equal(calls, 0, "drawing reads the prepared colony");
  } finally { cellDivisionSimulation.step = step; }
});

test("slider ends of every numeric control are admitted, alone, all together and in seeded random corners, inside the work bound", () => {
  const item = definition("cell-division"), input = createInstrument("cell-division");
  const numbers = item.parameters.filter((p) => p.type === "number");
  let worst = 0, checked = 0;
  const admit = (over: Record<string, number>) => {
    const values = { ...input.params, ...over };
    assert.doesNotThrow(() => validateInstrument({ ...input, params: values }), JSON.stringify(over));
    const options = colonyOptionsOf(values), limits = cellDivisionSimulation.limits(options);
    const work = limits.initialWork! + (values.steps as number) * limits.workPerStep;
    worst = Math.max(worst, work); checked++;
    assert.ok(work <= MAX_COLONY_WORK, `slider corner ${JSON.stringify(over)} declares ${work} work units`);
  };
  const ends = (pick: (p: (typeof numbers)[number]) => number) => Object.fromEntries(numbers.map((p) => [p.key, pick(p)]));
  admit(ends((p) => p.min!)); admit(ends((p) => p.max!));
  for (const p of numbers) for (const end of [p.min!, p.max!]) { admit({ [p.key]: end }); admit({ ...ends((q) => q.max!), [p.key]: end }); admit({ ...ends((q) => q.min!), [p.key]: end }); }
  // Seeded random corners (each control at its min or max; xorshift, so the run is reproducible).
  let x = 0x9e3779b9;
  const bit = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x & 1; };
  for (let k = 0; k < 3000; k++) admit(Object.fromEntries(numbers.map((p) => [p.key, bit() ? p.max! : p.min!])));
  assert.ok(checked > 3000 && worst > 1e7, "the corners were actually expensive");
});
