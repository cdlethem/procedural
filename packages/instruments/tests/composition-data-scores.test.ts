import assert from "node:assert/strict";
import test from "node:test";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";
import {
  createCompositionRun, createInstrument, dataKey, dataScoresComposition, dataScoresScene, dataTable, drawDataScores, drawInstrument,
  keyLabel, prepareInstrument, sampleIds, sampleTable, usesSeed, validateInstrument, visibleParameters, definition,
  type CompositionSurface, type DataScoresRecipe, type DrawingContext, type InstrumentInput,
} from "../dist/index.js";

const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const ID = "data-scores";
function input(params: Record<string, number | string | boolean> = {}, seed = 42): InstrumentInput {
  const base = createInstrument(ID);
  return { ...base, seed, params: { ...base.params, ...params } };
}
const recipeOf = (params: Record<string, number | string | boolean> = {}, seed = 42) => dataScoresComposition(input(params, seed));

/** Records every call with the fill and stroke actually in effect, so inert style edits do not register. */
function recorder(): { surface: CompositionSurface; ops: string[] } {
  const ops: string[] = [];
  const round = (value: unknown) => typeof value === "number" ? Math.round(value * 1e6) / 1e6 : value;
  const surface = new Proxy({ CLOSE: "close", ROUND: "round" } as Record<string, unknown>, {
    get(target, key: string) { return key in target ? target[key] : (...args: unknown[]) => { ops.push(JSON.stringify([key, ...args.map(round)])); }; },
  });
  return { surface: surface as unknown as CompositionSurface, ops };
}
const drawn = (recipe: DataScoresRecipe): string[] => { const { surface, ops } = recorder(); drawDataScores(surface, recipe); return ops; };
const drawnInput = (value: InstrumentInput): string[] => { const { surface, ops } = recorder(); drawInstrument(surface as unknown as DrawingContext, value); return ops; };
const count = (ops: string[], name: string) => ops.filter((op) => op.startsWith(`["${name}"`)).length;

test("bundled tables share one shape so any selection works with any table, and each records missing values", () => {
  assert.deepEqual([...sampleIds].sort(), ["harbour", "loans", "orchard"]);
  for (const id of sampleIds) {
    const table = sampleTable(id);
    const continuous = table.columns.filter((column) => column.kind === "continuous");
    const categorical = table.columns.filter((column) => column.kind === "categorical");
    assert.equal(continuous.length, 3, id); assert.equal(categorical.length, 2, id);
    assert.ok(continuous.some((column) => column.values.includes(null as never)), `${id} has a missing measure`);
    assert.ok(categorical.some((column) => column.values.includes(null as never)), `${id} has a missing category`);
    // The first measure is a complete ordering column.
    assert.ok(continuous[0].values.every((value) => value !== null), id);
  }
});

test("the persisted recipe embeds the recorded table by value: a JSON reload draws the identical picture", () => {
  for (const params of [{}, { layout: "lattice", dataset: "harbour" }, { layout: "treemap", dataset: "orchard", fill: "by-category" }]) {
    const recipe = recipeOf(params);
    const reloaded = JSON.parse(JSON.stringify(recipe)) as DataScoresRecipe;
    assert.deepEqual(drawn(reloaded), drawn(recipe), JSON.stringify(params));
    assert.equal(dataTable(reloaded.table).key, sampleTable(String(input(params).params.dataset)).key);
  }
  // A caller-owned table (no bundled id anywhere) draws through the same function.
  const custom = { ...recipeOf({ layout: "lattice" }), table: { id: "mine", columns: [
    { name: "month", kind: "continuous" as const, values: [1, 2, 3, 4] }, { name: "loans", kind: "continuous" as const, values: [4, 3, 2, 1] },
    { name: "late", kind: "continuous" as const, values: [1, 1, 2, null] }, { name: "genre", kind: "categorical" as const, categories: ["x", "y"], values: ["x", "y", "x", "y"] },
    { name: "season", kind: "categorical" as const, categories: ["m", "n"], values: ["m", "m", "n", null] }] } };
  const scene = dataScoresScene(custom);
  assert.equal(scene.data.units.length, 4);
  assert.deepEqual(scene.data.units.filter((unit) => unit.missing.length > 0).map((unit) => [unit.id, [...unit.missing]]), [["row:3", ["size", "tone"]]]);
  assert.ok(drawn(custom).length > 20);
});

test("the default is a valid stored instrument, transparent, and paints only within its own marks", () => {
  const value = createInstrument(ID);
  assert.deepEqual(validateInstrument(value), value);
  const ops = drawnInput(value);
  assert.ok(ops.length > 200);
  assert.equal(count(ops, "background"), 0);
  assert.equal(count(ops, "clear"), 0);
  // No rectangle can cover the canvas.
  for (const op of ops.filter((item) => item.startsWith('["rect"'))) assert.ok(JSON.parse(op)[3] < 640 && JSON.parse(op)[4] < 640);
  for (const rejected of [{ windowStart: 1 }, { windowLength: 0 }, { correlation: 100 }, { keyScale: 9 }, { petals: 2.5 }, { layout: "sunburst" }, { dataset: "mine" }])
    assert.throws(() => validateInstrument({ ...value, params: { ...value.params, ...rejected } }), /params/, JSON.stringify(rejected));
  // Exact entry outside the slider interval is admitted (slider 0..1, hard limits -4..4).
  assert.doesNotThrow(() => validateInstrument({ ...value, params: { ...value.params, domainStart: -1.5, domainSpan: 3 } }));
});

test("a missing value keeps its unit in place: ghost draws a ring, gap draws nothing, and neither moves anything", () => {
  const table = sampleTable("loans");
  const column = (name: string) => table.columns.find((item) => item.name === name)!.values as (number | string | null)[];
  // Default mapping reads late (size), season (color), genre (lane), loans (height) and month (time).
  const absent = table.rowIds.filter((_, row) => column("late")[row] === null || column("season")[row] === null);
  assert.ok(absent.length >= 4);
  const ghost = dataScoresScene(recipeOf({ missing: "ghost" }));
  const gap = dataScoresScene(recipeOf({ missing: "gap" }));
  assert.equal(ghost.data, gap.data, "the policy is a drawing decision, not a resolution one");
  assert.equal(ghost.layout, gap.layout);
  assert.deepEqual(ghost.data.units.filter((unit) => unit.missing.length > 0).map((unit) => unit.id).sort(), [...absent].sort());
  assert.equal(ghost.data.units.length, table.rows);
  const plain = { vocabulary: "dots", line: "none", parts: "drawing" };
  const ghostOps = drawn(recipeOf({ ...plain, missing: "ghost" })), gapOps = drawn(recipeOf({ ...plain, missing: "gap" }));
  assert.equal(count(ghostOps, "circle") - count(gapOps, "circle"), absent.length);
  assert.equal(count(gapOps, "circle"), table.rows - absent.length);
  // Ghost marks keep the unit's own position.
  const positions = new Map((ghost.layout as { sites: { id: string; position: readonly number[] }[] }).sites.map((site) => [site.id, site.position]));
  for (const id of absent) assert.ok(positions.has(id));
});

test("a treemap gives every parcel exactly its share of the footprint, measured from the raw table", () => {
  const table = sampleTable("orchard");
  const column = (name: string) => table.columns.find((item) => item.name === name)!.values;
  const area = column("area") as number[], crop = column("crop") as string[];
  const recipe = recipeOf({ layout: "treemap", dataset: "orchard", areaBy: "second", width: 500, height: 300 });
  const scene = dataScoresScene(recipe);
  assert.equal(scene.kind, "treemap");
  if (scene.kind !== "treemap") return;
  const total = area.reduce((a, b) => a + b, 0);
  assert.equal(scene.layout.regions.length, table.rows);
  for (const region of scene.layout.regions) {
    const row = table.rowIds.indexOf(region.id);
    near((region.bounds[2] - region.bounds[0]) * (region.bounds[3] - region.bounds[1]), area[row] / total * 500 * 300);
  }
  // Merging by crop: each crop's region is the sum of its parcels' areas.
  const merged = dataScoresScene(recipeOf({ layout: "treemap", dataset: "orchard", areaBy: "second", groupBy: "first", aggregate: "sum", width: 500, height: 300 }));
  if (merged.kind !== "treemap") throw new Error("treemap expected");
  const crops = [...new Set(crop)];
  assert.equal(merged.layout.regions.length, crops.length);
  for (const region of merged.layout.regions) {
    const name = region.id.replace("group:", "");
    const expected = area.reduce((sum, value, row) => sum + (crop[row] === name ? value : 0), 0) / total * 500 * 300;
    near((region.bounds[2] - region.bounds[0]) * (region.bounds[3] - region.bounds[1]), expected);
  }
  // The gap is taken from inside each region: bounds and areas do not change with it.
  const gapped = dataScoresScene(recipeOf({ layout: "treemap", dataset: "orchard", areaBy: "second", width: 500, height: 300, gap: 12 }));
  if (gapped.kind !== "treemap") throw new Error("treemap expected");
  assert.deepEqual(gapped.layout.regions.map((region) => region.bounds), scene.layout.regions.map((region) => region.bounds));
});

test("timeline x follows the time measure exactly; a window zooms and keeps ids", () => {
  const recipe = recipeOf({ width: 440, centerX: 320 });
  const scene = dataScoresScene(recipe);
  if (scene.kind !== "timeline") throw new Error("timeline expected");
  const table = sampleTable("loans");
  const month = table.columns[0].values as number[];
  for (const site of scene.layout.sites) near(site.position[0], 100 + (month[table.rowIds.indexOf(site.id)] - 1) / 11 * 440);
  // A window over the middle quarter: months 1 + 5.5 .. 1 + 8.25 → 7, 8 and 9 for each genre.
  const zoomed = dataScoresScene(recipeOf({ width: 440, centerX: 320, windowStart: .5, windowLength: .25 }));
  if (zoomed.kind !== "timeline") throw new Error("timeline expected");
  const kept = zoomed.layout.sites.map((site) => site.id).sort();
  assert.deepEqual(kept, ["fic-07", "fic-08", "fic-09", "sci-07", "sci-08", "sci-09", "trv-07", "trv-08", "trv-09"]);
  for (const site of zoomed.layout.sites) near(site.position[0], 100 + (month[table.rowIds.indexOf(site.id)] - 6.5) / 2.75 * 440);
  const before = new Map(scene.layout.sites.map((site) => [site.id, site.seed]));
  for (const site of zoomed.layout.sites) assert.equal(site.seed, before.get(site.id), "seeds belong to ids");
});

test("a lattice sorted by a measure places units in that order, missing last", () => {
  const scene = dataScoresScene(recipeOf({ layout: "lattice", dataset: "orchard", order: "sorted", sortBy: "third", descending: true, looseness: 0 }));
  if (scene.kind !== "lattice") throw new Error("lattice expected");
  const values = scene.layout.sites.map((site) => site.unit.measures.yield);
  const present = values.filter((value): value is number => value !== null);
  assert.deepEqual(present, [...present].sort((a, b) => b - a));
  assert.deepEqual(values.slice(present.length).map((value) => value), values.slice(present.length).map(() => null));
  // Zero looseness is the exact grid: consecutive sites in a row share y and step by one cell.
  const { columns, cell } = scene.layout;
  scene.layout.sites.forEach((site, index) => near(site.position[0], 340 - 235 + (index % columns + .5) * cell[0]));
});

test("appearance edits reuse the resolved data and layout; a mapping range edit moves nothing; structural edits replace what depends on them", () => {
  const scene = (params: Record<string, number | string | boolean>, seed = 42) => dataScoresScene(recipeOf(params, seed));
  const base = scene({});
  for (const appearance of [{ markWeight: 3 }, { line: "stitch" }, { lineWeight: 3 }, { vocabulary: "rings" }, { keyX: 300 }, { keyScale: 1.5 }, { parts: "drawing" },
    { guides: false }, { opening: .7 }, { missing: "gap" }]) {
    const next = scene(appearance);
    assert.equal(next.data, base.data, `${JSON.stringify(appearance)} resolves the same data`);
    assert.equal(next.layout, base.layout, `${JSON.stringify(appearance)} reuses the layout`);
  }
  const palette = dataScoresScene({ ...recipeOf({}), palette: [1, 2, 3] });
  assert.equal(palette.data, base.data); assert.equal(palette.layout, base.layout);
  // A size range is part of the mapping, so the attributes change; ids and positions never do.
  const bigger = scene({ maxSize: 40 });
  assert.notEqual(bigger.data, base.data);
  const places = (built: typeof base) => (built.layout as { sites: { id: string; position: readonly number[]; seed: number }[] }).sites.map((site) => [site.id, site.position, site.seed]);
  assert.deepEqual(places(bigger), places(base));
  const rescaled = scene({ levelSpread: .5 });
  assert.equal(rescaled.data, base.data, "a layout edit keeps resolved data");
  assert.notEqual(rescaled.layout, base.layout);
  const windowed = scene({ windowLength: .5 });
  assert.notEqual(windowed.data, base.data);
  assert.notEqual(windowed.layout, base.layout);
  const lattice = scene({ layout: "lattice" });
  const looser = scene({ layout: "lattice", looseness: .9 });
  assert.equal(looser.data, lattice.data);
  assert.notEqual(looser.layout, lattice.layout);
});

test("a hidden control never changes the drawing (many configurations, every hidden control changed)", () => {
  const definitionOf = definition(ID);
  let state = 12345;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const drivers = definitionOf.parameters.filter((parameter) => parameter.type === "select" || parameter.type === "boolean");
  let checked = 0;
  const failures: string[] = [];
  for (let attempt = 0; attempt < 60; attempt++) {
    const params: Record<string, number | string | boolean> = { ...definitionOf.defaults };
    for (const driver of drivers) {
      const pool = driver.type === "boolean" ? [false, true] : driver.options!.map((option) => option.value);
      params[driver.key] = pool[Math.floor(random() * pool.length)];
    }
    const shown = new Set(visibleParameters(ID, params).map((parameter) => parameter.key));
    const base = drawFingerprint({ ...createInstrument(ID), params });
    for (const parameter of definitionOf.parameters.filter((item) => !shown.has(item.key))) {
      let value: number | string | boolean;
      if (parameter.type === "boolean") value = !params[parameter.key];
      else if (parameter.type === "select") {
        const others = parameter.options!.map((option) => option.value).filter((option) => option !== params[parameter.key]);
        value = others[Math.floor(random() * others.length)];
      } else {
        value = parameter.min! + (parameter.max! - parameter.min!) * (.1 + .8 * random());
        value = parameter.integer ? Math.round(value) : Math.round(value * 100) / 100;
        if (value === params[parameter.key]) continue;
      }
      checked++;
      const changed = drawFingerprint({ ...createInstrument(ID), params: { ...params, [parameter.key]: value } });
      if (changed !== base) failures.push(`${parameter.key}=${String(value)} under ${JSON.stringify({ layout: params.layout, vocabulary: params.vocabulary, fill: params.fill, order: params.order, sizeBy: params.sizeBy, parts: params.parts, line: params.line, frame: params.frame })}`);
    }
  }
  assert.deepEqual(failures, []);
  assert.ok(checked > 400, `only ${checked} hidden changes exercised`);
});

test("usesSeed states the truth: without it the seed changes nothing; with it a real structural change follows", () => {
  const cases: [Record<string, number | string | boolean>, boolean][] = [
    [{}, true],
    [{ laneOrder: "declared" }, false],
    [{ laneOrder: "shuffled", laneBy: "none" }, false],
    [{ layout: "lattice", looseness: 0, order: "table" }, false],
    [{ layout: "lattice", looseness: .5, order: "table" }, true],
    [{ layout: "lattice", looseness: 0, order: "shuffled" }, true],
    [{ layout: "treemap", fill: "hatch", order: "table" }, false],
    [{ layout: "treemap", fill: "hatch", order: "shuffled" }, true],
    [{ layout: "treemap", fill: "motifs", order: "table" }, true],
    [{ layout: "treemap", fill: "contours", order: "table" }, true],
    [{ layout: "timeline", laneOrder: "declared", order: "shuffled", looseness: .9 }, false],
  ];
  for (const [params, expected] of cases) {
    const a = input(params, 1), b = input(params, 2);
    assert.equal(usesSeed(a), expected, JSON.stringify(params));
    assert.equal(drawnInput(a).join() !== drawnInput(b).join(), expected, `seed effect ${JSON.stringify(params)}`);
  }
});

test("shuffled lattice seeds change who sits where, not who exists or how large they are", () => {
  const scene = (seed: number) => {
    const built = dataScoresScene(recipeOf({ layout: "lattice", order: "shuffled", looseness: 0, dataset: "harbour" }, seed));
    if (built.kind !== "lattice") throw new Error("lattice expected");
    return built.layout.sites;
  };
  const one = scene(1), two = scene(2);
  assert.deepEqual(one.map((site) => site.id).sort(), two.map((site) => site.id).sort());
  assert.notDeepEqual(one.map((site) => site.id), two.map((site) => site.id));
  const size = (sites: typeof one) => Object.fromEntries(sites.map((site) => [site.id, site.unit.channels.size]));
  assert.deepEqual(size(one), size(two));
  const cells = (sites: typeof one) => sites.map((site) => site.position.join()).sort();
  assert.deepEqual(cells(one), cells(two), "the same cells are occupied");
});

test("the key is built from the resolved mapping and names exactly what was mapped", () => {
  const recipe = recipeOf({ sizeBy: "third", toneBy: "second", vocabulary: "by-category", markRole: "first", levelBy: "second", laneBy: "first" });
  const scene = dataScoresScene(recipe);
  const rows = dataKey(recipe, scene.data).rows;
  assert.deepEqual(rows.map((row) => row.kind), ["title", "line", "line", "line", "sizes", "classes", "classes", "ghost"]);
  assert.equal(rows.find((row) => row.kind === "ghost")!.kind === "ghost" && (rows.find((row) => row.kind === "ghost") as { text: string }).text, "ring = no value");
  const sizes = rows.find((row) => row.kind === "sizes");
  assert.ok(sizes && sizes.kind === "sizes");
  const late = sampleTable("loans").columns[2].values.filter((value): value is number => value !== null);
  // Samples sit at the domain start, middle and end of the recorded range, sized by the mapping itself.
  const [low, high] = [Math.min(...late), Math.max(...late)];
  assert.deepEqual(sizes.samples.map((sample) => Number(sample.label)), [low, (low + high) / 2, high].map((value) => Number(value.toPrecision(3))));
  near(sizes.samples[0].size, 6); near(sizes.samples[2].size, 26); near(sizes.samples[1].size, 16);
  const classes = rows.filter((row) => row.kind === "classes");
  assert.deepEqual(classes.map((row) => row.kind === "classes" && row.items.map((item) => item.name)), [["winter", "spring", "summer", "autumn"], ["fiction", "science", "travel"]]);
  assert.deepEqual(rows.map((row) => "text" in row && row.text).slice(0, 4), ["Library loans", "x month 1-12", "lanes genre", "y loans"]);
  // No missing value in a mapped channel → no ghost row; the gap policy also has no ghost.
  const complete = recipeOf({ sizeBy: "second", toneBy: "none" });
  assert.equal(dataKey(complete, dataScoresScene(complete).data).rows.some((row) => row.kind === "ghost"), false);
  const gap = recipeOf({ missing: "gap" });
  assert.equal(dataKey(gap, dataScoresScene(gap).data).rows.some((row) => row.kind === "ghost"), false);
  // Labels are unshaped printable ASCII, at most 20 characters, and never empty.
  assert.equal(keyLabel("naïve — a very long column name"), "na?ve ? a very long");
  assert.equal(keyLabel("   "), "?");
});

test("the key is its own element: drawing and key concatenate to the full layer", () => {
  for (const params of [{}, { layout: "lattice", dataset: "harbour" }, { layout: "treemap", dataset: "orchard" }]) {
    const both = drawnInput(input({ ...params, parts: "both" }));
    const drawing = drawnInput(input({ ...params, parts: "drawing" }));
    const key = drawnInput(input({ ...params, parts: "key" }));
    assert.deepEqual(both, [...drawing, ...key], JSON.stringify(params));
    assert.ok(drawing.length > 0 && key.length > 0);
  }
  // The key alone does not depend on the drawing controls that do not appear in it.
  assert.deepEqual(drawnInput(input({ parts: "key", guides: false, lineWeight: 3 })), drawnInput(input({ parts: "key" })));
});

test("consumers are replaceable while producers stay the same frozen objects", () => {
  const recipe = recipeOf({ layout: "lattice", dataset: "harbour" });
  const before = dataScoresScene(recipe);
  if (before.kind !== "lattice") throw new Error("lattice expected");
  const seen: unknown[] = [];
  const { surface } = recorder();
  drawDataScores(surface, { ...recipe, parts: "drawing" }, { mark: (_p, site) => { seen.push(site); } });
  assert.equal(seen.length, before.layout.sites.length);
  seen.forEach((site, index) => assert.equal(site, before.layout.sites[index], "the callback receives the cached site itself"));
  assert.equal(dataScoresScene(recipe).layout, before.layout);
  // A treemap region filler gets the region in local coordinates via the shared consumer.
  const tree = recipeOf({ layout: "treemap", dataset: "orchard" });
  const regions = dataScoresScene(tree);
  if (regions.kind !== "treemap") throw new Error("treemap expected");
  const translated: string[] = [];
  const recording = recorder();
  const inner = recording.surface;
  const spy = new Proxy(inner as object, { get: (target, key: string) => key === "translate" ? (x: number, y: number) => { translated.push(`${x},${y}`); } : (target as never)[key] });
  drawDataScores(spy as unknown as CompositionSurface, { ...tree, parts: "drawing" }, { fill: () => {} });
  assert.deepEqual(translated, regions.layout.regions.map((region) => `${region.bounds[0]},${region.bounds[1]}`));
});

const syntheticTable = (rows: number) => ({ id: "big", columns: [
    { name: "month", kind: "continuous" as const, values: Array.from({ length: rows }, (_, i) => i) },
    { name: "loans", kind: "continuous" as const, values: Array.from({ length: rows }, (_, i) => 1 + (i * 7) % 13) },
    { name: "late", kind: "continuous" as const, values: Array.from({ length: rows }, (_, i) => i % 5) },
    { name: "genre", kind: "categorical" as const, categories: ["x", "y"], values: Array.from({ length: rows }, (_, i) => i % 2 ? "x" : "y") },
    { name: "season", kind: "categorical" as const, categories: ["m", "n"], values: Array.from({ length: rows }, (_, i) => i % 3 ? "m" : "n") }] });

test("work is bounded before drawing and the error names the controlling parameters", () => {
  const rows = 400;
  const table = syntheticTable(rows);
  // The recipe's window belongs to the bundled table, so drop it for this synthetic one.
  const whole = (recipe: DataScoresRecipe): DataScoresRecipe => ({ ...recipe, table, units: { ...recipe.units, window: null } });
  const tree = whole(recipeOf({ layout: "treemap", areaBy: "second", fill: "motifs" }));
  assert.throws(() => drawDataScores(recorder().surface, tree), /nested geometry budget: \d+ motifs regions at spacing .*Merge rows, narrow the window/);
  // The same table as a lattice or a timeline is cheap and unbounded by that budget.
  const lattice = whole(recipeOf({ layout: "lattice" }));
  assert.doesNotThrow(() => drawDataScores(recorder().surface, lattice));
  assert.equal(dataScoresScene(lattice).data.units.length, rows);
  assert.doesNotThrow(() => drawDataScores(recorder().surface, whole(recipeOf({}))));
  // Sites are charged to the shared run budget.
  assert.throws(() => drawDataScores(recorder().surface, lattice, {}, createCompositionRun({ maxWork: 10 })), /work budget exceeded/);
  // Fewer rows fit the same fill: the budget is about regions times spacing, not a fixed row limit.
  const few = syntheticTable(60);
  assert.doesNotThrow(() => drawDataScores(recorder().surface, { ...whole(recipeOf({ layout: "treemap", areaBy: "second", fill: "hatch", sizeBy: "none", spacingDense: 12, gap: 0, parts: "drawing" })), table: few }));
});

test("preparation completes for every layout and yields to cancellation without painting", async () => {
  for (const layout of ["timeline", "lattice", "treemap"]) {
    assert.equal(await prepareInstrument(input({ layout, fill: "by-category" }), () => false), true, layout);
  }
  let calls = 0;
  assert.equal(await prepareInstrument(input({ layout: "treemap", dataset: "orchard", fill: "contours" }), () => ++calls > 6), false);
  assert.equal(await prepareInstrument(input({ layout: "treemap" }), () => true), false);
});

test("each layout responds to every consequential mapping control", () => {
  const changes: [Record<string, number | string | boolean>, Record<string, number | string | boolean>][] = [
    [{}, { sizeBy: "second" }], [{}, { toneBy: "first" }], [{}, { laneBy: "second" }], [{}, { levelBy: "third" }], [{}, { timeBy: "second" }],
    [{}, { windowStart: .4 }], [{}, { missing: "gap" }], [{}, { domainStart: .4 }], [{}, { curve: "sqrt" }], [{}, { outside: "omit", domainStart: .5 }],
    [{ layout: "lattice" }, { order: "sorted" }], [{ layout: "lattice" }, { looseBy: "second" }], [{ layout: "lattice" }, { groupBy: "second" }],
    [{ layout: "lattice", groupBy: "first" }, { aggregate: "mean" }],
    [{ layout: "treemap" }, { areaBy: "third" }], [{ layout: "treemap" }, { fill: "motifs" }], [{ layout: "treemap" }, { groupBy: "second" }],
    [{ layout: "treemap", fill: "by-category" }, { fillRole: "second" }],
  ];
  for (const [base, change] of changes) {
    assert.notEqual(drawnInput(input({ ...base, ...change })).join(), drawnInput(input(base)).join(), JSON.stringify([base, change]));
  }
});
