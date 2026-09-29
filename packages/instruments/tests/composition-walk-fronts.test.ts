import assert from "node:assert/strict";
import test from "node:test";
import {
  bandCount, bandDomains, canPrepareInstrument, cellRuns, checkSimulation, createInstrument, definitions, drawInstrument, frontContours, frontSites,
  frontsField, frontsSimulation, inspectorItems, prepareInstrument, randomWalkFrontsComposition, randomWalkFrontsProducts, runWalkFronts,
  stateAt, territoryDomains, territoryHatching, territoryOutlines, validateParameters, walkFronts, walkGrid, walkRegions, nearestAllowedCell,
  prepareWalkFrontsSnapshots, type CompositionSurface, type FrontsField, type InspectorItem, type WalkBarrier, type WalkGrid, type WalkRules,
} from "../dist/index.js";
import { frontsCache } from "../dist/composition/walk-fronts.js";

const none: WalkBarrier = { kind: "none" };
/** `#` is an allowed cell, anything else is not. Rows must be equally long, at least 4 x 4. */
function gridOf(rows: string[], barrier: WalkBarrier = none) {
  const width = rows[0].length, height = rows.length;
  const data = new Uint8Array(width * height);
  rows.forEach((row, y) => { for (let x = 0; x < width; x++) data[y * width + x] = row[x] === "#" ? 1 : 0; });
  return walkGrid({ kind: "mask", mask: { width, height, data } }, barrier, width, height);
}
const rulesOf = (over: Partial<WalkRules> & { cells?: [number, number][] } = {}): WalkRules => {
  const { cells, ...rest } = over;
  return {
    neighbourhood: 4, persistence: 0.3, explore: 1, revisit: "any", branching: 0, maxWalkers: 50, patience: 100_000, walkersPerSeed: 1,
    colors: 2, transition: "inherit", shift: 0, coverage: 1, seeding: { layout: "cells", cells: cells ?? [[1, 1]] }, ...rest,
  };
};
const owner = (field: FrontsField, x: number, y: number) => field.owner[y * field.columns + x];
const age = (field: FrontsField, x: number, y: number) => field.age[y * field.columns + x];
const fieldOf = (grid: WalkGrid, rules: WalkRules, seed: number, steps: number) => {
  const snaps = runWalkFronts(grid, rules, seed, steps);
  return frontsField(snaps, grid);
};
const shoelace = (points: readonly (readonly [number, number])[]) => {
  let sum = 0;
  for (let i = 0; i < points.length; i++) { const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length]; sum += x1 * y2 - x2 * y1; }
  return sum / 2;
};

/* ------------------------------------------------------------------------------------- the grid */

test("a rectangle domain allows exactly the cells whose centres it contains; a hole removes its cells", () => {
  const solid = walkGrid({ kind: "domain", domain: { outer: [[2, 1], [7, 1], [7, 4], [2, 4]] } }, none, 12, 8);
  assert.equal(solid.count, 15); // centres x = 2.5..6.5 (5 columns), y = 1.5..3.5 (3 rows)
  assert.equal(solid.isAllowed(2, 1), true); assert.equal(solid.isAllowed(6, 3), true);
  assert.equal(solid.isAllowed(7, 1), false); assert.equal(solid.isAllowed(1, 1), false); assert.equal(solid.isAllowed(2, 4), false);
  const holed = walkGrid({ kind: "domain", domain: { outer: [[2, 1], [7, 1], [7, 4], [2, 4]], holes: [[[4, 2], [5, 2], [5, 3], [4, 3]]] } }, none, 12, 8);
  assert.equal(holed.count, 14);
  assert.equal(holed.isAllowed(4, 2), false);
});

test("a wall subtracts exactly its cells and a gap gives them back; content, not route, decides identity", () => {
  const open = { kind: "shape", shape: "open", size: 1, islands: 1, ringWidth: 0.5 } as const;
  const closed = walkGrid(open, { kind: "wall", position: 0.5, width: 2, gap: 0 }, 20, 10);
  assert.equal(closed.count, 20 * 10 - 2 * 10); // wall covers x in [9, 11]: columns 9 and 10
  assert.equal(closed.isAllowed(9, 0), false); assert.equal(closed.isAllowed(10, 9), false); assert.equal(closed.isAllowed(8, 5), true);
  const gapped = walkGrid(open, { kind: "wall", position: 0.5, width: 2, gap: 4 }, 20, 10);
  assert.equal(gapped.count, 20 * 10 - 2 * (10 - 4)); // the gap [3, 7] frees rows 3..6
  assert.equal(gapped.isAllowed(9, 4), true); assert.equal(gapped.isAllowed(9, 2), false);
  // the same allowed cells through a raster mask are the same frozen object
  const bits = closed.cells();
  const again = walkGrid({ kind: "mask", mask: { width: 20, height: 10, data: bits } }, none, 20, 10);
  assert.equal(again, closed);
  assert.notEqual(gapped, closed);
});

test("letters keep their counters and shapes are independent of canvas size", () => {
  const o = walkGrid({ kind: "text", text: "O", size: 1 }, none, 64, 64);
  assert.equal(o.isAllowed(32, 32), false); // the counter
  assert.ok(Array.from({ length: 31 }, (_, k) => 33 + k).some((y) => o.isAllowed(32, y) && y > 40)); // the bowl below the counter
  assert.ok(o.count > 300 && o.count < 64 * 64 * 0.7);
  const disc = walkGrid({ kind: "shape", shape: "disc", size: 0.5, islands: 1, ringWidth: 0.5 }, none, 40, 40);
  // radius 10 cells: centres within 10 of (20, 20); count is within the perimeter's rounding of the area
  assert.ok(Math.abs(disc.count - Math.PI * 100) < 12, `${disc.count}`);
  assert.equal(disc.isAllowed(20, 20), true); assert.equal(disc.isAllowed(20, 8), false); assert.equal(disc.isAllowed(20, 11), true);
});

test("an empty mask is an input error that names the control", () => {
  assert.throws(() => walkGrid({ kind: "domain", domain: { outer: [[30, 30], [31, 30], [31, 31], [30, 31]] } }, none, 12, 8), /no cell for the walk/);
  assert.throws(() => walkGrid({ kind: "shape", shape: "open", size: 1, islands: 1, ringWidth: 0.5 }, { kind: "wall", position: 0.5, width: 100, gap: 0 }, 20, 10), /barrier/);
  assert.throws(() => walkGrid({ kind: "shape", shape: "open", size: 1, islands: 1, ringWidth: 0.5 }, none, 500, 10), /Columns/);
  assert.throws(() => walkGrid({ kind: "shape", shape: "open", size: 1, islands: 1, ringWidth: 0.5 }, none, 400, 401), /Rows/);
  assert.throws(() => walkGrid({ kind: "shape", shape: "open", size: 1, islands: 1, ringWidth: 0.5 }, none, 400, 400), /limit is 100000/);
});

test("regions and seed snapping follow the stated order and tie rules", () => {
  const grid = gridOf(["##..###", "##..###", "....###", "#......"]);
  const regions = walkRegions(grid, 4);
  assert.equal(regions.count, 3);
  assert.deepEqual([...regions.sizes], [9, 4, 1]); // largest first
  assert.equal(regions.regionOf(4, 1), 0); assert.equal(regions.regionOf(0, 0), 1); assert.equal(regions.regionOf(0, 3), 2); assert.equal(regions.regionOf(3, 0), -1);
  assert.deepEqual([...regions.anchors[0]], [5, 1]); // nearest cell to the centroid (5, 1.0) of the 3 x 3 block
  // diagonal contact joins under 8 neighbours only
  const diagonal = gridOf(["#...", ".#..", "....", "...."]);
  assert.equal(walkRegions(diagonal, 4).count, 2); assert.equal(walkRegions(diagonal, 8).count, 1);
  // equidistant cells: the lowest raster index wins (left of (1.0, 0.5) is cell 0, right is cell 1)
  assert.deepEqual([...nearestAllowedCell(gridOf(["##..", "....", "....", "...."]), 1.0, 0.5)], [0, 0]);
});

/* ------------------------------------------------------------------------------ the model rules */

test("a piece of the region that no seed reaches stays unfilled, and the walk says why it ended", () => {
  const grid = gridOf(["######.#####", "######.#####", "######.#####", "######.#####"]);
  const left = fieldOf(grid, rulesOf({ cells: [[2, 1]] }), 3, 2000);
  assert.equal(left.claimed, 24);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 12; x++) assert.equal(owner(left, x, y) !== 0, x < 6, `cell ${x},${y}`);
  assert.equal(left.ended?.reason, "saturated");
  assert.ok(left.ended!.step < 2000);
  assert.equal(left.open, 0);
  const both = fieldOf(grid, rulesOf({ cells: [[2, 1], [8, 2]] }), 3, 2000);
  assert.equal(both.claimed, grid.count);
  assert.equal(both.ended?.reason, "full");
  assert.equal(owner(both, 8, 2), 2); assert.equal(owner(both, 2, 1), 1); // seed k has colour k
});

test("walkers avoiding claimed cells die boxed in; crossing rules decide whether a strip is finished", () => {
  const strip = gridOf(["..........", "##########", "..........", ".........."]);
  const seeds = { cells: [[4, 1]] as [number, number][], explore: 1, persistence: 0.5 };
  for (const seed of [1, 2, 3, 4, 5]) {
    const avoid = fieldOf(strip, rulesOf({ ...seeds, revisit: "avoid" }), seed, 500);
    assert.equal(avoid.ended?.reason, "extinct", `seed ${seed}`);
    assert.ok(avoid.claimed === 6 || avoid.claimed === 5, `seed ${seed}: ${avoid.claimed}`); // one side only: x 5..9 or x 3..0 plus the seed
    assert.equal(avoid.walkers.length, 0);
    assert.ok(avoid.open >= 1);
    const any = fieldOf(strip, rulesOf({ ...seeds, revisit: "any" }), seed, 5000);
    assert.equal(any.claimed, 10, `seed ${seed}`);
    assert.equal(any.ended?.reason, "full");
  }
});

test("patience kills a walker that cannot reach open ground; coverage stops at the stated fraction", () => {
  // a corridor of 20 cells, seed in the middle: the walker claims one side to the end, then must retrace nine claimed
  // cells to reach the open side, which takes at least nine idle steps
  const corridor = gridOf(["....................", "####################", "....................", "...................."]);
  const base = { cells: [[10, 1]] as [number, number][], explore: 1, persistence: 0, revisit: "any" as const };
  for (const seed of [1, 2, 3]) {
    const patient = fieldOf(corridor, rulesOf({ ...base, patience: 100_000 }), seed, 3000);
    assert.equal(patient.ended?.reason, "full", `seed ${seed}`);
    const impatient = fieldOf(corridor, rulesOf({ ...base, patience: 2 }), seed, 3000);
    assert.equal(impatient.ended?.reason, "extinct");
    assert.equal(impatient.deaths, 1);
    assert.ok(impatient.claimed === 10 || impatient.claimed === 11, `${impatient.claimed}`); // x 10..19 or x 0..10
    assert.ok(impatient.open >= 1);
  }
  const room = gridOf(Array.from({ length: 8 }, () => "########"));
  const half = fieldOf(room, rulesOf({ cells: [[0, 0], [7, 7], [0, 7], [7, 0]], coverage: 0.5 }), 5, 400);
  assert.equal(half.ended?.reason, "coverage");
  // four walkers each claim at most one cell a step, so the stop overshoots by fewer than four cells
  assert.ok(half.claimed >= 32 && half.claimed < 36, `${half.claimed}`);
});

test("every claimed cell is allowed, connected to a seed through claimed cells, and aged no earlier than a claimed neighbour", () => {
  const grid = gridOf(["...####...", "..######..", ".########.", "####..####", "####..####", ".########.", "..######..", "...####..."]);
  for (const revisit of ["avoid", "own", "any"] as const) for (const neighbourhood of [4, 8] as const) {
    const rules = rulesOf({ revisit, neighbourhood, branching: 0.2, colors: 3, transition: "cycle", shift: 0.2, explore: 0.7, cells: [[3, 0], [6, 7], [0, 3]] });
    const field = fieldOf(grid, rules, 11, 120), { columns, rows } = field;
    const dirs = neighbourhood === 8 ? 8 : 4, DX = [1, 0, -1, 0, 1, -1, -1, 1], DY = [0, 1, 0, -1, 1, 1, -1, -1];
    let claimed = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) if (owner(field, x, y) !== 0) {
      claimed++;
      assert.ok(grid.isAllowed(x, y), `claimed a forbidden cell ${x},${y}`);
      if (age(field, x, y) > 0) {
        let parent = false;
        for (let d = 0; d < dirs; d++) {
          const nx = x + DX[d], ny = y + DY[d];
          if (nx >= 0 && ny >= 0 && nx < columns && ny < rows && owner(field, nx, ny) !== 0 && age(field, nx, ny) <= age(field, x, y)) parent = true;
        }
        assert.ok(parent, `${revisit}/${neighbourhood}: cell ${x},${y} has no earlier-or-equal claimed neighbour`);
      }
      assert.ok(age(field, x, y) <= 120);
    }
    assert.equal(claimed, field.claimed);
    assert.deepEqual(field.seeds.map((s) => [s.x, s.y]), [[3, 0], [6, 7], [0, 3]]);
    for (const s of field.seeds) assert.equal(age(field, s.x, s.y), 0);
  }
});

test("the revisit rule is what each live walker stands on after every step", () => {
  const grid = walkGrid({ kind: "shape", shape: "disc", size: 0.95, islands: 1, ringWidth: 0.5 }, none, 28, 28);
  const seeds = { seeding: { layout: "cells" as const, cells: [[8, 14], [14, 8], [20, 14], [14, 20]] as [number, number][] }, colors: 4, branching: 0.15, explore: 0.6 };
  let onRival = 0;
  for (const revisit of ["avoid", "own", "any"] as const) {
    const snaps = runWalkFronts(grid, rulesOf({ ...seeds, revisit }), 12, 80);
    for (let k = 1; k <= 80; k++) {
      const before = stateAt(snaps, k - 1), after = stateAt(snaps, k);
      const colorOf = new Map(before.walkers.map((w) => [w.id, w.color]));
      for (const w of after.walkers) {
        const cell = w.y * 28 + w.x, mine = colorOf.get(w.id);
        if (mine === undefined) { assert.equal(after.age[cell], k); continue; } // a child stands where its parent just claimed
        const stands = after.cells[cell] & 15;
        if (revisit === "avoid") assert.equal(after.age[cell], k, `step ${k}: a walker stepped onto a cell claimed earlier`);
        else if (revisit === "own") assert.equal(stands, mine + 1, `step ${k}: a walker stepped onto a rival's cell`);
        else if (stands !== mine + 1) onRival++;
      }
    }
  }
  assert.ok(onRival > 0, "the 'any' rule never crossed a rival, so this test could not tell the rules apart");
});

test("more steps only append: the shorter walk is the longer one restricted to cells claimed by its last step", () => {
  const grid = walkGrid({ kind: "shape", shape: "disc", size: 0.9, islands: 1, ringWidth: 0.5 }, none, 30, 30);
  const rules = rulesOf({ seeding: { layout: "scatter", count: 3 }, branching: 0.1, revisit: "own", explore: 0.8, colors: 3, transition: "cycle", shift: 0.05 });
  const long = fieldOf(grid, rules, 5, 90);
  for (const k of [0, 1, 7, 30, 60]) {
    const short = fieldOf(grid, rules, 5, k);
    for (let i = 0; i < long.owner.length; i++) {
      const kept = long.owner[i] !== 0 && long.age[i] <= k;
      assert.equal(short.owner[i], kept ? long.owner[i] : 0, `k ${k} cell ${i}`);
      if (kept) assert.equal(short.age[i], long.age[i]);
    }
  }
});

test("the foundation's guarantees hold for the model: replay, spacing, resume, prefix, cancellation-free identity", () => {
  const grid = walkGrid({ kind: "shape", shape: "islands", size: 1, islands: 5, ringWidth: 0.5 }, { kind: "pillars", spacing: 12, radius: 2 }, 36, 36);
  const rules = rulesOf({ seeding: { layout: "region", count: 8 }, branching: 0.12, revisit: "own", colors: 4, transition: "random", shift: 0.1, explore: 0.85, maxWalkers: 30, patience: 25 });
  for (const seed of [1, 2, 3]) checkSimulation(frontsSimulation(grid), rules, seed, 45);
  const snaps = runWalkFronts(grid, rules, 4, 80);
  const scratch = runWalkFronts(grid, rules, 4, 33);
  const replayed = stateAt(snaps, 33), fresh = stateAt(scratch, 33);
  assert.deepEqual([...replayed.cells], [...fresh.cells]);
  assert.deepEqual([...replayed.age], [...fresh.age]);
  assert.deepEqual(replayed.walkers, fresh.walkers);
});

test("walker ids are a birth counter: unique, ascending, and the counter equals seeds plus births", () => {
  const grid = walkGrid({ kind: "shape", shape: "open", size: 1, islands: 1, ringWidth: 0.5 }, none, 24, 24);
  const rules = rulesOf({ seeding: { layout: "cells", cells: [[3, 3], [20, 20]] }, walkersPerSeed: 2, branching: 0.3, maxWalkers: 40, revisit: "own" });
  const snaps = runWalkFronts(grid, rules, 8, 40);
  const field = frontsField(snaps, grid), state = stateAt(snaps, 40);
  const ids = field.walkers.map((w) => Number(w.id.split(":")[1]));
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(state.nextId, 4 + field.births);
  assert.ok(ids.every((id) => id < state.nextId));
  assert.ok(field.walkers.length <= 40);
  assert.equal(field.walkers.length, 4 + field.births - field.deaths);
});

test("a walker's path does not depend on other walkers: adding a walker elsewhere leaves the first region unchanged", () => {
  const grid = gridOf(["#########.#########", "#########.#########", "#########.#########", "#########.#########", "#########.#########"]);
  const alone = fieldOf(grid, rulesOf({ cells: [[2, 2]], revisit: "own", persistence: 0.6, explore: 0.5 }), 21, 60);
  const withOther = fieldOf(grid, rulesOf({ cells: [[2, 2], [15, 1]], revisit: "own", persistence: 0.6, explore: 0.5 }), 21, 60);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 9; x++) {
    assert.equal(owner(withOther, x, y), owner(alone, x, y));
    assert.equal(age(withOther, x, y), age(alone, x, y));
  }
  assert.ok(withOther.claimed > alone.claimed);
});

test("colour transition: inherit keeps one colour per seed; cycle only ever steps to the next colour", () => {
  const grid = gridOf(Array.from({ length: 6 }, () => "##############"));
  const inherit = fieldOf(grid, rulesOf({ cells: [[0, 0], [13, 5]], colors: 4, transition: "inherit", shift: 1, branching: 0.4 }), 3, 300);
  assert.ok([...inherit.owner].every((o) => o <= 2)); // colours 0 and 1 only: seed k has colour k, shifting is off
  assert.ok(inherit.owner.includes(1) && inherit.owner.includes(2));
  const cycle = fieldOf(grid, rulesOf({ cells: [[0, 0]], colors: 4, transition: "cycle", shift: 1, branching: 0, walkersPerSeed: 1, explore: 1, persistence: 1 }), 3, 300);
  // one walker whose colour advances after every claimed cell: its i-th claim (ages are distinct) has colour i mod 4
  const claims: [number, number][] = [];
  for (let i = 0; i < cycle.owner.length; i++) if (cycle.owner[i] !== 0 && cycle.age[i] > 0) claims.push([cycle.age[i], cycle.owner[i] - 1]);
  claims.sort((a, b) => a[0] - b[0]);
  assert.ok(claims.length > 20 && new Set(claims.map((c) => c[0])).size === claims.length);
  claims.forEach(([, color], i) => assert.equal(color, i % 4, `claim ${i}`));
});

test("limits name the control to change, before any work", () => {
  const grid = walkGrid({ kind: "shape", shape: "open", size: 1, islands: 1, ringWidth: 0.5 }, none, 40, 40);
  assert.throws(() => walkFronts(grid, rulesOf({ maxWalkers: 1000 }), 1, { steps: 20000 }), /lower Steps or Maximum walkers/);
  assert.throws(() => walkFronts(grid, rulesOf({ maxWalkers: 3, walkersPerSeed: 2, cells: [[1, 1], [5, 5]] }), 1, { steps: 3 }), /Seeds × Walkers per seed.*raise Maximum walkers/);
  assert.throws(() => walkFronts(grid, rulesOf({ cells: [[1, 1]], branching: 2 }), 1, { steps: 3 }), /Branching must be/);
  assert.throws(() => walkFronts(grid, rulesOf(), 1, { steps: 20001 }), /Steps must be an integer from 0 to 20000/);
  const holed = gridOf(["##..", "##..", "....", "...."]);
  assert.throws(() => walkFronts(holed, rulesOf({ cells: [[3, 3]] }), 1, { steps: 3 }), /not an allowed cell/);
});

/* -------------------------------------------------------------------- cache, identity, cancellation */

const inputWith = (params: Record<string, number | string | boolean>, seed = 42) => {
  const input = createInstrument("random-walk-fronts");
  input.seed = seed;
  Object.assign(input.params, params);
  return input;
};

test("palette and every drawing control repaint the same snapshots; construction edits recompute", () => {
  const base = inputWith({ steps: 30 });
  const first = randomWalkFrontsProducts(randomWalkFrontsComposition(base));
  const appearance: Record<string, number | string | boolean>[] = [
    { centerX: 200, centerY: 100, cell: 3 }, { fill: "flat" }, { fill: "none", lines: "both" }, { fillShape: "runs", fillAlpha: 0.4 }, { bandEvery: 5, bandContrast: -0.6 },
    { lines: "territory", lineMaterial: "beads" }, { hatch: true, hatchSpacing: 4 }, { marks: true, markStride: 3 }, { tips: true },
  ];
  for (const change of appearance) {
    const other = randomWalkFrontsProducts(randomWalkFrontsComposition({ ...inputWith({ steps: 30, ...change }), palette: [1, 2, 3, 4, 5, 6] }));
    assert.equal(other.snapshots, first.snapshots, JSON.stringify(change));
    assert.equal(other.field, first.field);
  }
  const construction: Record<string, number | string | boolean>[] = [
    { seedCount: 7 }, { persistence: 0.7 }, { explore: 0.5 }, { revisit: "any" }, { branching: 0.2 }, { maxWalkers: 90 }, { patience: 9 }, { colors: 3 },
    { neighbourhood: "8" }, { mask: "ring" }, { maskSize: 0.7 }, { barrier: "wall" }, { columns: 100 }, { steps: 31 }, { coverage: 0.8 }, { seedLayout: "ring" }, { walkersPerSeed: 1 },
  ];
  for (const change of construction) {
    const other = randomWalkFrontsProducts(randomWalkFrontsComposition(inputWith({ steps: 30, ...change })));
    assert.notEqual(other.snapshots, first.snapshots, JSON.stringify(change));
  }
  assert.notEqual(randomWalkFrontsProducts(randomWalkFrontsComposition(inputWith({ steps: 30 }, 43))).snapshots, first.snapshots);
});

test("a longer walk extends the cached shorter one and a shorter walk replays from a checkpoint, cell for cell", () => {
  const recipe = (steps: number) => randomWalkFrontsComposition(inputWith({ steps, seedCount: 3, columns: 60, rows: 60 }, 99));
  const short = randomWalkFrontsProducts(recipe(140)).field;
  const long = randomWalkFrontsProducts(recipe(260)).field;
  const back = randomWalkFrontsProducts(recipe(140)).field;
  assert.equal(back, short); // same construction, still cached
  const r = recipe(1), grid = walkGrid(r.mask, r.barrier, 60, 60);
  const scratch = frontsField(runWalkFronts(grid, r.rules, 99, 200), grid);
  for (let i = 0; i < long.owner.length; i++) {
    const kept = long.owner[i] !== 0 && long.age[i] <= 200;
    assert.equal(scratch.owner[i], kept ? long.owner[i] : 0);
  }
  assert.ok(long.claimed >= short.claimed);
});

test("cancelling a preparation publishes nothing and a retry equals a fresh run", async () => {
  const input = inputWith({ steps: 400, seedCount: 4, columns: 70, rows: 70, maxWalkers: 33 }, 314159);
  const recipe = randomWalkFrontsComposition(input);
  const grid = walkGrid(recipe.mask, recipe.barrier, recipe.columns, recipe.rows);
  let polls = 0;
  const cancelled = await prepareInstrument(input, () => ++polls > 40);
  assert.equal(cancelled, false);
  assert.equal(frontsCache.has(frontsSimulation(grid), recipe.rules, recipe.seed, { steps: 400, checkpointEvery: Math.max(100, Math.ceil(70 * 70 / 200)), historyEvery: 10 }), false);
  assert.equal(await prepareWalkFrontsSnapshots(grid, recipe.rules, recipe.seed, { steps: 400, cancelled: () => true }), null);
  assert.equal(await prepareInstrument(input, () => false), true);
  const cached = randomWalkFrontsProducts(recipe).field;
  const fresh = frontsField(runWalkFronts(grid, recipe.rules, recipe.seed, 400), grid);
  assert.deepEqual([...cached.owner], [...fresh.owner]);
  assert.deepEqual([...cached.age], [...fresh.age]);
  assert.equal(canPrepareInstrument("random-walk-fronts"), true);
});

/* ------------------------------------------------------------------------------------- treatments */

test("treatment geometry accounts for every claimed cell exactly", () => {
  const input = inputWith({ steps: 70, seedCount: 5, colors: 3, columns: 50, rows: 40, cell: 4, centerX: 300, centerY: 250, bandEvery: 7 });
  const recipe = randomWalkFrontsComposition(input), { field } = randomWalkFrontsProducts(recipe), frame = recipe.frame, cellArea = frame.cell * frame.cell;
  const perColor = [0, 0, 0];
  for (const o of field.owner) if (o) perColor[o - 1]++;
  // territories: one exact domain per colour, area = cells × cell²
  const territories = territoryDomains(field, frame);
  for (const t of territories) assert.ok(Math.abs(t.domain.area - perColor[t.color] * cellArea) < 1e-6, `colour ${t.color}`);
  assert.equal(territories.length, perColor.filter((c) => c > 0).length);
  // age bands: the pieces partition the claimed cells by (colour, floor(age / 7))
  const expected = new Map<string, number>();
  for (let i = 0; i < field.owner.length; i++) if (field.owner[i]) { const k = `${field.owner[i] - 1}/${Math.floor(field.age[i] / 7)}`; expected.set(k, (expected.get(k) ?? 0) + 1); }
  const bands = bandDomains(field, frame, 7);
  assert.equal(bands.length, expected.size);
  for (const b of bands) assert.ok(Math.abs(b.domain.area - expected.get(`${b.color}/${b.band}`)! * cellArea) < 1e-6);
  assert.equal(bandCount(field, 7), Math.max(...bands.map((b) => b.band)) + 1);
  // row runs: total length is the claimed count and no run crosses a colour or band change
  const runs = cellRuns(field, 7);
  let total = 0;
  for (let i = 0; i < runs.count; i++) {
    const x = runs.data[i * 5], y = runs.data[i * 5 + 1], length = runs.data[i * 5 + 2];
    total += length;
    for (let k = 0; k < length; k++) {
      const cell = y * field.columns + x + k;
      assert.equal(field.owner[cell] - 1, runs.data[i * 5 + 3]);
      assert.equal(Math.floor(field.age[cell] / 7), runs.data[i * 5 + 4]);
    }
  }
  assert.equal(total, field.claimed);
  // the last front-age contour outlines everything claimed: its rings' signed areas (holes negative) sum to the claimed area
  const contours = frontContours(field, frame, 7, 42, null);
  const last = contours.filter((p) => p.level === bandCount(field, 7));
  assert.ok(Math.abs(last.reduce((sum, p) => sum + shoelace(p.points), 0) - field.claimed * cellArea) < 1e-6);
  // contour k encloses exactly the cells with band < k
  for (const k of [1, 3]) {
    const want = [...field.owner].reduce((n, o, i) => n + (o && Math.floor(field.age[i] / 7) < k ? 1 : 0), 0);
    assert.ok(Math.abs(contours.filter((p) => p.level === k).reduce((sum, p) => sum + shoelace(p.points), 0) - want * cellArea) < 1e-6, `contour ${k}`);
  }
  // territory outlines: signed ring areas per colour equal that colour's area
  for (const t of territories) {
    const rings = territoryOutlines(field, frame, 42, null).filter((p) => p.tone === t.color);
    assert.ok(Math.abs(rings.reduce((sum, p) => sum + shoelace(p.points), 0) - perColor[t.color] * cellArea) < 1e-6);
  }
  // everything sits on the canvas where the lattice is placed: left = 300 - 50 * 4 / 2
  const xs = last.flatMap((p) => p.points.map((q) => q[0])), ys = last.flatMap((p) => p.points.map((q) => q[1]));
  assert.ok(Math.min(...xs) >= 200 && Math.max(...xs) <= 400 && Math.min(...ys) >= 250 - 80 && Math.max(...ys) <= 250 + 80);
});

test("hatching lies inside its territory at the requested angle; sites carry age and colour", () => {
  const recipe = randomWalkFrontsComposition(inputWith({ steps: 60, seedCount: 3, colors: 2, columns: 40, rows: 40, cell: 5, centerX: 320, centerY: 320 }));
  const { field } = randomWalkFrontsProducts(recipe), frame = recipe.frame;
  const hatch = territoryHatching(field, frame, { spacing: 4, angle: 0, turn: 45 }, 7, null);
  assert.ok(hatch.length > 20);
  const left = 320 - 100, top = 320 - 100;
  for (const path of hatch) {
    const [a, b] = path.points;
    const color = path.tone!;
    if (color % 2 === 0) near(a[1], b[1]); // colour 0: horizontal
    else near(Math.abs((b[1] - a[1]) / (b[0] - a[0])), 1, 1e-6); // colour 1: 45 degrees
    // the midpoint of a stroke is inside a cell of the stroke's colour
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    assert.equal(field.owner[Math.floor((my - top) / 5) * 40 + Math.floor((mx - left) / 5)], color + 1);
  }
  const sites = frontSites(field, frame, { stride: 3, aging: 0.5 }, 7);
  let oldest = 0;
  for (let i = 0; i < field.owner.length; i++) if (field.owner[i] && field.age[i] > oldest) oldest = field.age[i];
  for (const s of sites) {
    const [, x, y] = s.id.match(/cell:(\d+),(\d+)/)!.map(Number);
    assert.ok(x % 3 === 0 && y % 3 === 0);
    assert.equal(s.tone, field.owner[y * 40 + x] - 1);
    near(s.scale, 1 - 0.5 * (1 - field.age[y * 40 + x] / oldest), 1e-12);
    near(s.position[0], left + (x + 0.5) * 5); near(s.position[1], top + (y + 0.5) * 5);
  }
  assert.throws(() => frontSites(field, frame, { stride: 0, aging: 0 }, 1), /Mark spacing/);
  assert.throws(() => bandCount(field, 0), /Age interval/);
});
function near(actual: number, expected: number, tolerance = 1e-9) { assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`); }

/** Records geometry and colours separately, so a recolour can be compared vertex for vertex. */
class Recorder implements CompositionSurface {
  CLOSE = "close"; ROUND = "round";
  geometry: string[] = []; colors: string[] = [];
  push() {} pop() {} translate() {} rotate() {} scale() {} noFill() {} noStroke() {} strokeWeight() {} strokeCap() {}
  fill(...a: number[]) { this.colors.push(`f${a.join(",")}`); } stroke(...a: number[]) { this.colors.push(`s${a.join(",")}`); }
  circle(x: number, y: number, d: number) { this.geometry.push(`c${x},${y},${d}`); }
  line(a: number, b: number, c: number, d: number) { this.geometry.push(`l${a},${b},${c},${d}`); }
  rect(x: number, y: number, w: number, h: number) { this.geometry.push(`r${x},${y},${w},${h}`); }
  beginShape() { this.geometry.push("["); } vertex(x: number, y: number) { this.geometry.push(`v${x},${y}`); } endShape() { this.geometry.push("]"); }
}

test("a recolour draws the same geometry with different colours, and the drawing is transparent", () => {
  const a = inputWith({ steps: 40, fill: "bands", lines: "both", hatch: true, marks: true });
  const b = { ...a, palette: [0x101010, 0x202020, 0x303030, 0x404040, 0x505050, 0x606060] };
  const ra = new Recorder(), rb = new Recorder();
  drawInstrument(ra, a); drawInstrument(rb, b);
  assert.deepEqual(rb.geometry, ra.geometry);
  assert.notDeepEqual(rb.colors, ra.colors);
  assert.ok(ra.geometry.length > 500);
  // no full-canvas paper: no shape starts at the canvas corner or spans 640
  assert.ok(!ra.geometry.some((g) => g.startsWith("r0,0,640")));
});

test("the direct API takes a caller-resolved domain and an explicit seed cell; the named instrument is the same functions", () => {
  const grid = walkGrid({ kind: "domain", domain: { outer: [[1, 1], [15, 1], [15, 11], [1, 11]] } }, none, 16, 12);
  const field = fieldOf(grid, rulesOf({ cells: [[3, 3]], branching: 0.1, revisit: "any" }), 17, 600);
  assert.equal(field.claimed, 14 * 10);
  assert.equal(field.ended?.reason, "full");
  assert.equal(owner(field, 0, 0), 0); // outside the domain
  const recipe = randomWalkFrontsComposition(inputWith({ mask: "tones", image: "landscape", toneFrom: 0.3, toneTo: 0.6, seedLayout: "region", seedCount: 6, steps: 50 }));
  assert.equal(recipe.mask.kind, "tones");
  const { field: tones } = randomWalkFrontsProducts(recipe);
  assert.ok(tones.claimed > 0 && tones.claimed <= tones.allowed);
});

/* -------------------------------------------------------------------------------- the instrument */

test("controls: every dependency is inline, hidden controls do not change the drawing, groups are complete", () => {
  const definition = definitions.find((d) => d.id === "random-walk-fronts")!;
  assert.ok(definition.parameters.every((p) => p.group));
  const sample = (values: Record<string, number | string | boolean>, hidden: string) => {
    const a = new Recorder(), b = new Recorder();
    drawInstrument(a, { ...inputWith(values) });
    const parameter = definition.parameters.find((p) => p.key === hidden)!;
    const move = (v: number) => { const up = v + (parameter.step ?? 1) * 3; return up <= (parameter.hardMax ?? parameter.max!) ? up : v - (parameter.step ?? 1) * 3; };
    const other = parameter.type === "number" ? move(Number(values[hidden] ?? definition.defaults[hidden]))
      : parameter.type === "boolean" ? !(values[hidden] ?? definition.defaults[hidden])
      : parameter.type === "text" ? "ZZ" : parameter.options!.find((o) => o.value !== (values[hidden] ?? definition.defaults[hidden]))!.value;
    drawInstrument(b, { ...inputWith({ ...values, [hidden]: other }) });
    assert.deepEqual(b.geometry, a.geometry, `${hidden} changed the drawing while hidden under ${JSON.stringify(values)}`);
  };
  const cases: [Record<string, number | string | boolean>, string[]][] = [
    [{ mask: "disc", barrier: "none", steps: 25 }, ["ringWidth", "islands", "word", "image", "toneFrom", "toneTo", "wallPosition", "barrierWidth", "barrierGap", "enclosureSize", "pillarSpacing", "pillarRadius"]],
    [{ mask: "open", barrier: "wall", steps: 25 }, ["maskSize", "ringWidth", "islands", "word", "enclosureSize", "pillarSpacing", "pillarRadius"]],
    [{ mask: "tones", barrier: "pillars", steps: 25 }, ["maskSize", "wallPosition", "barrierWidth", "barrierGap", "enclosureSize", "word", "islands"]],
    [{ transition: "inherit", fill: "none", lines: "none", hatch: false, marks: false, steps: 25 }, ["shift", "fillShape", "fillAlpha", "bandContrast", "lineMaterial", "lineWeight", "lineSpacing", "hatchSpacing", "hatchAngle", "hatchTurn", "hatchWeight", "markStride", "markSize", "markAging"]],
    [{ lines: "territory", lineMaterial: "ink", fill: "flat", steps: 25 }, ["lineSpacing", "bandContrast"]],
    [{ revisit: "avoid", steps: 60 }, ["explore"]],
  ];
  for (const [values, hiddens] of cases) {
    const shown = new Set<string>();
    const collect = (items: InspectorItem[]) => { for (const item of items) if (item.kind === "control") shown.add(item.parameter.key); else collect(item.items); };
    collect(inspectorItems("random-walk-fronts", { ...definition.defaults, ...values }));
    for (const hidden of hiddens) {
      assert.ok(!shown.has(hidden), `${hidden} should be hidden under ${JSON.stringify(values)}`);
      sample(values, hidden);
    }
  }
  assert.throws(() => validateParameters("random-walk-fronts", { ...definition.defaults, word: "" }), /Word/);
  assert.throws(() => validateParameters("random-walk-fronts", { ...definition.defaults, pillarRadius: 8, pillarSpacing: 12 }), /Pillar radius/);
  assert.throws(() => validateParameters("random-walk-fronts", { ...definition.defaults, seedCount: 16, walkersPerSeed: 4, maxWalkers: 20 }), /Maximum walkers/);
  assert.throws(() => validateParameters("random-walk-fronts", { ...definition.defaults, steps: 20000, maxWalkers: 1000 }), /lower Steps or Maximum walkers/);
});

test("the authored default shows growth in progress on a shape, in several colours, with age bands and contours", () => {
  const recipe = randomWalkFrontsComposition(createInstrument("random-walk-fronts"));
  const { field } = randomWalkFrontsProducts(recipe);
  assert.equal(field.ended, null); // the front is still moving
  assert.ok(field.claimed / field.allowed > 0.25 && field.claimed / field.allowed < 0.95, `${field.claimed / field.allowed}`);
  assert.ok(new Set(field.owner).size >= 4); // several colours plus unclaimed
  assert.ok(bandCount(field, recipe.view.bandEvery) >= 5);
});
