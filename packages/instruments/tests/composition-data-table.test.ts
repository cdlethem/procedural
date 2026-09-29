import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateValues, applyMeasure, buildUnits, componentSeed, dataTable, latticeLayout, orderUnits, resolveChannel, resolveData,
  timelineLayout, treemapLayout, MAX_TABLE_ROWS,
  type ChannelSpec, type DataTableInput, type ResolvedData, type ResolveOptions,
} from "../dist/index.js";

const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);

/** Eight rows: an ordering column, two measures with missing values, and two categories. */
const small: DataTableInput = {
  id: "small", title: "Small",
  rowIds: ["a", "b", "c", "d", "e", "f", "g", "h"],
  columns: [
    { name: "t", kind: "continuous", unit: "s", values: [0, 1, 2, 3, 4, 5, 6, 7] },
    { name: "x", kind: "continuous", unit: "m", values: [10, 20, null, 40, 0, 60, 70, null] },
    { name: "y", kind: "continuous", values: [1, 2, 3, 4, 5, 6, 7, 8] },
    { name: "kind", kind: "categorical", categories: ["10", "2", "1"], values: ["2", "2", "10", null, "1", "1", "1", "10"] },
    { name: "flag", kind: "categorical", categories: ["no", "yes"], values: ["no", "yes", "yes", "yes", null, "no", "no", "yes"] },
  ],
};
const options = (overrides: Partial<ResolveOptions> = {}): ResolveOptions => ({
  groupBy: null, aggregate: "sum", window: null, missing: "keep", channels: {}, ...overrides,
});
const measure = (column: string, extra: Partial<Extract<ChannelSpec, { kind: "measure" }>> = {}): ChannelSpec =>
  ({ kind: "measure", column, domain: [10, 20], curve: "linear", outside: "clamp", range: [0, 100], ...extra });

test("a table admits only well-typed columns and names the row that is not", () => {
  const bad = (columns: DataTableInput["columns"], pattern: RegExp, extra: Partial<DataTableInput> = {}) =>
    assert.throws(() => dataTable({ id: "bad", columns, ...extra }), pattern);
  bad([{ name: "v", kind: "continuous", values: [1, Infinity] }], /column "v" row "row:1".*not a finite number/);
  bad([{ name: "v", kind: "continuous", values: [1, NaN as number] }], /row "row:1"/);
  bad([{ name: "v", kind: "continuous", values: [1, "2" as unknown as number] }], /row "row:1"/);
  bad([{ name: "c", kind: "categorical", categories: ["a"], values: ["a", "b"] }], /column "c" row "row:1": "b" is not one of its categories/);
  bad([{ name: "c", kind: "categorical", categories: ["a", "a"], values: ["a"] }], /distinct non-empty/);
  bad([{ name: "c", kind: "categorical", categories: [], values: [] }], /1 to 64 categories/);
  bad([{ name: "v", kind: "continuous", values: [1] }, { name: "v", kind: "continuous", values: [2] }], /repeats column "v"/);
  bad([{ name: "v", kind: "continuous", values: [1, 2] }, { name: "w", kind: "continuous", values: [1] }], /column "w" has 1 values; expected 2/);
  bad([{ name: "v", kind: "continuous", values: [1, 2] }], /repeats row id "z"/, { rowIds: ["z", "z"] });
  bad([{ name: "v", kind: "continuous", values: Array(MAX_TABLE_ROWS + 1).fill(1) }], /limit is 2000/);
  bad([], /at least one column/);
});

test("a table is deeply frozen, keyed by its content, and a JSON reload is the same table", () => {
  const table = dataTable(small);
  assert.throws(() => { (table.columns[1].values as (number | null)[])[0] = 99; }, TypeError);
  assert.throws(() => { (table as { rows: number }).rows = 3; }, TypeError);
  assert.equal(dataTable(table), table, "an admitted table is returned as is");
  const reloaded = dataTable(JSON.parse(JSON.stringify(table)));
  assert.equal(reloaded.key, table.key);
  assert.deepEqual(JSON.parse(JSON.stringify(reloaded)), JSON.parse(JSON.stringify(table)));
  const tweaked = structuredClone(small) as DataTableInput;
  (tweaked.columns[0] as { values: number[] }).values[3] = 3.5;
  assert.notEqual(dataTable(tweaked).key, table.key);
  const options2 = options({ channels: { m: measure("x", { domain: "extent" }) } });
  assert.deepEqual(resolveData(JSON.parse(JSON.stringify(table)), options2).units.map((unit) => unit.channels.m),
    resolveData(table, options2).units.map((unit) => unit.channels.m));
});

test("measure mapping: domain, curve, clamp, extrapolation, drop and descending ranges follow the closed forms", () => {
  const channel = (extra: Partial<Extract<ChannelSpec, { kind: "measure" }>> = {}) => {
    const resolved = resolveChannel(dataTable(small), "m", measure("x", extra));
    assert.equal(resolved.kind, "measure");
    return resolved as Extract<typeof resolved, { kind: "measure" }>;
  };
  near(applyMeasure(channel(), 15) as number, 50);
  near(applyMeasure(channel(), 25) as number, 100);   // clamped at the end
  near(applyMeasure(channel(), 5) as number, 0);
  near(applyMeasure(channel({ outside: "extrapolate" }), 25) as number, 150);
  near(applyMeasure(channel({ outside: "extrapolate" }), 5) as number, -50);
  assert.equal(applyMeasure(channel({ outside: "omit" }), 25), "outside");
  assert.equal(applyMeasure(channel({ outside: "omit" }), 20), 100, "the domain end itself is inside");
  near(applyMeasure(channel({ curve: "sqrt" }), 12.5) as number, 50);            // √0.25 = 0.5
  near(applyMeasure(channel({ curve: "sqrt", outside: "extrapolate" }), 7.5) as number, -50);   // odd extension
  near(applyMeasure(channel({ curve: "square" }), 15) as number, 25);
  near(applyMeasure(channel({ curve: "square", outside: "extrapolate" }), 25) as number, 225);
  near(applyMeasure(channel({ range: [100, 0] }), 12.5) as number, 75);
  // Extent domain is the present minimum and maximum: 0 and 70.
  const extent = channel({ domain: "extent" });
  assert.deepEqual([...extent.domain], [0, 70]);
  near(applyMeasure(extent, 35) as number, 50);
  assert.throws(() => resolveChannel(dataTable(small), "m", measure("x", { domain: [5, 5] })), /start < end/);
  assert.throws(() => resolveChannel(dataTable(small), "m", measure("x", { domain: [1, NaN] })), /finite/);
  assert.throws(() => resolveChannel(dataTable(small), "m", measure("x", { curve: "cubic" as never })), /unknown curve/);
  // A constant column has no extent: it is widened by 0.5 so its value maps to the middle.
  const flat = dataTable({ id: "flat", columns: [{ name: "k", kind: "continuous", values: [4, 4, 4] }] });
  const flatChannel = resolveChannel(flat, "m", { kind: "measure", column: "k", domain: "extent", curve: "linear", outside: "clamp", range: [0, 10] });
  near(applyMeasure(flatChannel as never, 4) as number, 5);
  const empty = dataTable({ id: "empty", columns: [{ name: "k", kind: "continuous", values: [null, null] }] });
  assert.throws(() => resolveChannel(empty, "m", { kind: "measure", column: "k", domain: "extent", curve: "linear", outside: "clamp", range: [0, 1] }), /no present value/);
});

test("categorical and continuous columns are never conflated", () => {
  const table = dataTable(small);
  assert.throws(() => resolveChannel(table, "m", measure("kind")), /categorical; a measure needs a continuous column/);
  assert.throws(() => resolveChannel(table, "c", { kind: "category", column: "x" }), /continuous; categories cannot be read/);
  assert.throws(() => resolveChannel(table, "q", { kind: "quantity", column: "kind" }), /categorical/);
  assert.throws(() => buildUnits(table, { groupBy: "x", aggregate: "sum", window: null, missing: "keep" }), /continuous; categories cannot be read/);
  assert.throws(() => buildUnits(table, { groupBy: null, aggregate: "sum", window: { column: "kind", from: 0, to: 1 }, missing: "keep" }), /categorical/);
  // A category's class is its declared position, never its numeric reading: "1" is class 2 here.
  const data = resolveData(table, options({ channels: { c: { kind: "category", column: "kind" } } }));
  assert.deepEqual(data.units.map((unit) => unit.channels.c), [1, 1, 0, null, 2, 2, 2, 0]);
  // Merged units carry sums of continuous columns and modes of categorical ones; no category is added up.
  const merged = buildUnits(table, { groupBy: "flag", aggregate: "sum", window: null, missing: "keep" }).units;
  assert.equal(merged[0].measures.t, 0 + 5 + 6, "flag=no rows a, f, g");
  assert.ok(merged.every((unit) => typeof unit.classes.kind === "number" || unit.classes.kind === null));
});

test("aggregation skips missing values and never turns 'no value' into 0", () => {
  assert.equal(aggregateValues("sum", [1, 2, 4]), 7);
  assert.equal(aggregateValues("mean", [1, 2, 6]), 3);
  assert.equal(aggregateValues("median", [9, 1, 5]), 5);
  assert.equal(aggregateValues("median", [1, 2, 3, 10]), 2.5);
  assert.equal(aggregateValues("min", [3, -2, 8]), -2);
  assert.equal(aggregateValues("max", [3, -2, 8]), 8);
  assert.equal(aggregateValues("count", [7, 7, 7]), 3);
  for (const fn of ["sum", "mean", "median", "min", "max", "count"] as const) assert.equal(aggregateValues(fn, []), null, fn);
  assert.throws(() => aggregateValues("mode" as never, [1]), /Unknown aggregate/);
  const table = dataTable(small);
  // flag=yes rows: b (x 20), c (x missing), d (x 40), h (x missing).
  const yes = (fn: "sum" | "mean" | "count") => buildUnits(table, { groupBy: "flag", aggregate: fn, window: null, missing: "keep" }).units.find((unit) => unit.id === "group:yes")!;
  assert.equal(yes("sum").measures.x, 60);
  assert.equal(yes("mean").measures.x, 30);
  assert.equal(yes("count").measures.x, 2, "count is the number of present values");
  assert.equal(yes("sum").count, 4, "count of merged rows");
  assert.deepEqual([...yes("sum").rowIds], ["b", "c", "d", "h"]);
  // A group whose every value is missing stays missing.
  const hole = dataTable({ id: "hole", columns: [{ name: "g", kind: "categorical", categories: ["p", "q"], values: ["p", "q", "p"] },
    { name: "v", kind: "continuous", values: [1, null, 2] }] });
  const units = buildUnits(hole, { groupBy: "g", aggregate: "sum", window: null, missing: "keep" }).units;
  assert.deepEqual(units.map((unit) => [unit.id, unit.measures.v]), [["group:p", 3], ["group:q", null]]);
});

test("a merged unit's other categories take the mode, ties to the lowest class index", () => {
  const table = dataTable(small);
  const units = buildUnits(table, { groupBy: "flag", aggregate: "sum", window: null, missing: "keep" }).units;
  const byId = Object.fromEntries(units.map((unit) => [unit.id, unit]));
  // flag=no rows a("2"→1), f("1"→2), g("1"→2): mode is class 2.
  assert.equal(byId["group:no"].classes.kind, 2);
  // flag=yes rows b("2"→1), c("10"→0), d(null), h("10"→0): mode is class 0.
  assert.equal(byId["group:yes"].classes.kind, 0);
  // The group column itself is exact, and the missing group is its own unit under keep.
  assert.equal(byId["group:yes"].classes.flag, 1);
  assert.equal(byId["group-missing"].classes.flag, null);
  assert.deepEqual([...byId["group-missing"].rowIds], ["e"]);
  // Tie (one row each) takes the lower index.
  const tie = dataTable({ id: "tie", columns: [{ name: "g", kind: "categorical", categories: ["only"], values: ["only", "only"] },
    { name: "c", kind: "categorical", categories: ["u", "v"], values: ["v", "u"] }] });
  assert.equal(buildUnits(tie, { groupBy: "g", aggregate: "sum", window: null, missing: "keep" }).units[0].classes.c, 0);
});

test("missing-value policy: error names the unit, omit reports it, keep retains an explicit null", () => {
  const channels = { m: measure("x", { domain: "extent" }) };
  assert.throws(() => resolveData(small, options({ missing: "error", channels })), /Unit "c" has no value for channel "m" \(column "x"\)/);
  const omitted = resolveData(small, options({ missing: "omit", channels }));
  assert.deepEqual(omitted.units.map((unit) => unit.id), ["a", "b", "d", "e", "f", "g"]);
  assert.deepEqual(omitted.omitted.map((item) => [item.id, item.reason, item.channel]), [["c", "missing", "m"], ["h", "missing", "m"]]);
  const kept = resolveData(small, options({ missing: "keep", channels }));
  assert.equal(kept.units.length, 8);
  const c = kept.units.find((unit) => unit.id === "c")!;
  assert.equal(c.channels.m, null);
  assert.deepEqual([...c.missing], ["m"]);
  // A genuine 0 and a missing value stay different: row e is 0 and maps to the range start.
  const e = kept.units.find((unit) => unit.id === "e")!;
  assert.equal(e.channels.m, 0);
  assert.equal(e.measures.x, 0);
  assert.deepEqual([...e.missing], []);
  // A required channel cannot be kept missing.
  const required = resolveData(small, options({ missing: "keep", channels, required: ["m"] }));
  assert.deepEqual(required.units.map((unit) => unit.id), ["a", "b", "d", "e", "f", "g"]);
  assert.throws(() => resolveData(small, options({ channels, required: ["nope"] })), /Required channel "nope"/);
});

test("a value outside an omit domain is left out of its channel but the unit keeps its place", () => {
  const data = resolveData(small, options({ channels: { m: measure("x", { outside: "omit" }) }, missing: "keep" }));
  // Domain 10..20: 10 and 20 map; 40, 0, 60, 70 lie outside; the two missing values are missing, not outside.
  assert.deepEqual(data.units.map((unit) => unit.id), ["a", "b", "c", "d", "e", "f", "g", "h"]);
  const state = (id: string) => { const unit = data.units.find((item) => item.id === id)!; return [unit.channels.m, [...unit.outside], [...unit.missing]]; };
  assert.deepEqual(state("a"), [0, [], []]);
  assert.deepEqual(state("b"), [100, [], []]);
  assert.deepEqual(state("d"), [null, ["m"], []]);
  assert.deepEqual(state("e"), [null, ["m"], []], "zero is a value below the domain, not a missing value");
  assert.deepEqual(state("c"), [null, [], ["m"]]);
  assert.deepEqual(data.omitted, []);
  // Under the omit policy the missing units leave, the outside ones still stay.
  const omitted = resolveData(small, options({ channels: { m: measure("x", { outside: "omit" }) }, missing: "omit" }));
  assert.deepEqual(omitted.units.map((unit) => unit.id), ["a", "b", "d", "e", "f", "g"]);
  // A required channel cannot hold a left-out value: the unit has no place, so it is omitted with the reason.
  const required = resolveData(small, options({ channels: { m: measure("x", { outside: "omit" }) }, required: ["m"] }));
  assert.deepEqual(required.units.map((unit) => unit.id), ["a", "b"]);
  assert.deepEqual(required.omitted.filter((item) => item.reason === "outside-domain").map((item) => item.id), ["d", "e", "f", "g"]);
});

test("a quantity channel is the raw non-negative value, zero included", () => {
  const data = resolveData(small, options({ channels: { area: { kind: "quantity", column: "x" } }, required: ["area"] }));
  assert.deepEqual(data.units.map((unit) => unit.channels.area), [10, 20, 40, 0, 60, 70]);
  const negative = dataTable({ id: "neg", columns: [{ name: "v", kind: "continuous", values: [1, -2] }] });
  assert.throws(() => resolveData(negative, options({ channels: { q: { kind: "quantity", column: "v" } } })), /Unit "row:1".*non-negative.*-2/);
});

test("the temporal window is inclusive, applied before merging, and reports why rows left", () => {
  const window = { column: "t", from: 2, to: 5 };
  const rows = buildUnits(dataTable(small), { groupBy: null, aggregate: "sum", window, missing: "keep" });
  assert.deepEqual(rows.units.map((unit) => unit.id), ["c", "d", "e", "f"]);
  assert.deepEqual(rows.omitted.map((item) => [item.id, item.reason]), ["a", "b", "g", "h"].map((id) => [id, "outside-window"]));
  const merged = buildUnits(dataTable(small), { groupBy: "flag", aggregate: "sum", window, missing: "omit" });
  // Rows c, d, e, f: yes = c, d (t 2 + 3); e has no flag and is omitted; no = f.
  assert.deepEqual(merged.units.map((unit) => [unit.id, unit.measures.t]), [["group:no", 5], ["group:yes", 5]]);
  assert.ok(merged.omitted.some((item) => item.id === "e" && item.reason === "missing-group"));
  assert.throws(() => buildUnits(dataTable(small), { groupBy: "flag", aggregate: "sum", window: { column: "t", from: 4, to: 4 }, missing: "error" }), /no value in group column "flag"/);
  assert.throws(() => buildUnits(dataTable(small), { groupBy: null, aggregate: "sum", window: { column: "t", from: 5, to: 2 }, missing: "keep" }), /must not exceed/);
  const gap = dataTable({ id: "gap", columns: [{ name: "t", kind: "continuous", values: [1, null, 3] }] });
  assert.deepEqual(buildUnits(gap, { groupBy: null, aggregate: "sum", window: { column: "t", from: 0, to: 9 }, missing: "omit" }).omitted.map((item) => item.reason), ["missing-time"]);
  assert.throws(() => buildUnits(gap, { groupBy: null, aggregate: "sum", window: { column: "t", from: 0, to: 9 }, missing: "error" }), /no value in window column/);
});

test("unit ids are row ids or category names, and never change with window, order or omission", () => {
  const rowsOf = (window: { column: string; from: number; to: number } | null) =>
    resolveData(small, options({ window })).units.map((unit) => unit.id);
  assert.deepEqual(rowsOf(null), ["a", "b", "c", "d", "e", "f", "g", "h"]);
  assert.deepEqual(rowsOf({ column: "t", from: 3, to: 6 }), ["d", "e", "f", "g"]);
  const merged = resolveData(small, options({ groupBy: "kind", window: null }));
  assert.deepEqual(merged.units.map((unit) => unit.id), ["group:10", "group:2", "group:1", "group-missing"], "declared category order, missing last");
  const narrowed = resolveData(small, options({ groupBy: "kind", window: { column: "t", from: 4, to: 7 } }));
  assert.deepEqual(narrowed.units.map((unit) => unit.id), ["group:10", "group:1"]);
});

test("resolved data is cached by construction and frozen; the mapping travels with the attributes", () => {
  const channels = { m: measure("x", { domain: "extent" }), c: { kind: "category", column: "flag" } as ChannelSpec };
  const first = resolveData(small, options({ channels }));
  const second = resolveData(dataTable(small), options({ channels }));
  assert.equal(first, second);
  assert.throws(() => { (first.units as unknown[]).push(1); }, TypeError);
  assert.throws(() => { (first.units[0].channels as Record<string, number>).m = 1; }, TypeError);
  assert.deepEqual(first.mapping.channels.c, { kind: "category", column: "flag", categories: ["no", "yes"] });
  const resolved = first.mapping.channels.m;
  assert.equal(resolved.kind === "measure" && resolved.unit, "m");
  assert.equal(resolveData(small, options({ channels, missing: "omit" })) === first, false);
});

// ---------------------------------------------------------------- layouts

function stream(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
function weightedData(weights: (number | null)[]): ResolvedData {
  const table = dataTable({ id: "w", columns: [{ name: "w", kind: "continuous", values: weights },
    { name: "cls", kind: "categorical", categories: ["p", "q", "r"], values: weights.map((_, index) => ["p", "q", "r"][index % 3]) }] });
  return resolveData(table, options({ channels: { area: { kind: "quantity", column: "w" }, tone: { kind: "category", column: "cls" } }, required: ["area"] }));
}
const area = (bounds: readonly number[]) => (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]);

test("treemap regions have exactly proportional areas, tile the footprint and keep unit ids", () => {
  const random = stream(5);
  for (const count of [1, 2, 7, 30, 120]) {
    const weights = Array.from({ length: count }, () => Math.round(random() ** 3 * 500) / 10 + 0.1);
    const data = weightedData(weights);
    const [centerX, centerY, width, height] = [300, 240, 500, 310];
    const map = treemapLayout(data, data.units, { seed: 1, centerX, centerY, width, height });
    const total = weights.reduce((a, b) => a + b, 0);
    assert.equal(map.regions.length, count);
    near(map.total, total);
    let covered = 0;
    map.regions.forEach((region, index) => {
      const expected = weights[data.units.findIndex((unit) => unit.id === region.id)] / total * width * height;
      near(area(region.bounds), expected, 1e-9);
      near(region.weight, weights[data.units.findIndex((unit) => unit.id === region.id)]);
      covered += area(region.bounds);
      const [l, t, r, b] = region.bounds;
      assert.ok(l >= centerX - width / 2 - 1e-9 && r <= centerX + width / 2 + 1e-9 && t >= centerY - height / 2 - 1e-9 && b <= centerY + height / 2 + 1e-9);
      for (let other = index + 1; other < count; other++) {
        const o = map.regions[other].bounds;
        const overlap = Math.min(r, o[2]) - Math.max(l, o[0]) > 1e-9 && Math.min(b, o[3]) - Math.max(t, o[1]) > 1e-9;
        assert.equal(overlap, false, `${region.id} overlaps ${map.regions[other].id}`);
      }
    });
    near(covered, width * height);
    assert.deepEqual(map.regions.map((region) => region.id).sort(), data.units.map((unit) => unit.id).sort());
  }
});

test("a zero-area unit gets no region; order changes place regions but never their areas", () => {
  const data = weightedData([5, 0, 3, 2, 10]);
  const forward = treemapLayout(data, data.units, { seed: 1, centerX: 100, centerY: 100, width: 200, height: 100 });
  assert.deepEqual([...forward.empty], ["row:1"]);
  assert.equal(forward.regions.length, 4);
  const reversed = treemapLayout(data, [...data.units].reverse(), { seed: 1, centerX: 100, centerY: 100, width: 200, height: 100 });
  const areas = (map: typeof forward) => Object.fromEntries(map.regions.map((region) => [region.id, area(region.bounds)]));
  const a = areas(forward), b = areas(reversed);
  for (const id of Object.keys(a)) near(a[id], b[id]);
  assert.notDeepEqual(forward.regions.map((region) => region.bounds), reversed.regions.slice().sort((p, q) => forward.regions.findIndex((r) => r.id === p.id) - forward.regions.findIndex((r) => r.id === q.id)).map((region) => region.bounds));
  // Seeds derive from the region id, not from position.
  for (const region of forward.regions) assert.equal(region.seed, componentSeed(1, region.id, "region"));
  const twin = treemapLayout(data, data.units, { seed: 2, centerX: 100, centerY: 100, width: 200, height: 100 });
  assert.deepEqual(twin.regions.map((region) => region.bounds), forward.regions.map((region) => region.bounds), "the treemap has no random element");
});

test("shuffled order depends only on each unit's id and the seed; sorted order is stable with missing values last", () => {
  const data = resolveData(small, options());
  const shuffled = orderUnits(data.units, { mode: "shuffled", by: null, descending: false, seed: 9 }).map((unit) => unit.id);
  const expected = data.units.map((unit) => [componentSeed(9, unit.id, "order"), unit.id] as const).sort((p, q) => p[0] - q[0]).map(([, id]) => id);
  assert.deepEqual(shuffled, expected);
  const subset = orderUnits(data.units.filter((unit) => unit.id !== "d" && unit.id !== "a"), { mode: "shuffled", by: null, descending: false, seed: 9 }).map((unit) => unit.id);
  assert.deepEqual(subset, expected.filter((id) => id !== "d" && id !== "a"), "removing units never reorders the others");
  assert.notDeepEqual(orderUnits(data.units, { mode: "shuffled", by: null, descending: false, seed: 10 }).map((unit) => unit.id), shuffled);
  // Sort by x: values a10 b20 c-null d40 e0 f60 g70 h-null.
  const up = orderUnits(data.units, { mode: "sorted", by: "x", descending: false, seed: 0 }).map((unit) => unit.id);
  assert.deepEqual(up, ["e", "a", "b", "d", "f", "g", "c", "h"]);
  const down = orderUnits(data.units, { mode: "sorted", by: "x", descending: true, seed: 0 }).map((unit) => unit.id);
  assert.deepEqual(down, ["g", "f", "d", "b", "a", "e", "c", "h"]);
  assert.throws(() => orderUnits(data.units, { mode: "sorted", by: "kind", descending: false, seed: 0 }), /not a continuous column/);
  assert.throws(() => orderUnits(data.units, { mode: "sorted", by: null, descending: false, seed: 0 }), /needs a measure/);
});

test("lattice: zero looseness is the exact grid in unit order; data decides each site's share of the drift", () => {
  const table = dataTable({ id: "l", columns: [{ name: "drift", kind: "continuous", values: [0, 1, 0.5, null] },
    { name: "c", kind: "categorical", categories: ["u", "v"], values: ["v", "u", "v", "u"] }] });
  const data = resolveData(table, options({ channels: {
    loose: { kind: "measure", column: "drift", domain: [0, 1], curve: "linear", outside: "clamp", range: [0, 1] },
    tone: { kind: "category", column: "c" } } }));
  const base = { seed: 3, centerX: 200, centerY: 100, width: 400, height: 200, correlation: 2 };
  const flat = latticeLayout(data, data.units, { ...base, looseness: 0, looseByData: true });
  // 4 units on a 400×200 footprint: ceil(√(4·2)) = 3 columns, 2 rows; cells 133.33 × 100.
  assert.equal(flat.columns, 3); assert.equal(flat.rows, 2);
  flat.sites.forEach((site, index) => {
    near(site.position[0], (index % 3 + .5) * 400 / 3);
    near(site.position[1], (Math.floor(index / 3) + .5) * 100);
    assert.equal(site.id, data.units[index].id);
    assert.equal(site.tone, [1, 0, 1, 0][index]);
  });
  const loose = latticeLayout(data, data.units, { ...base, looseness: .8, looseByData: true });
  const everyone = latticeLayout(data, data.units, { ...base, looseness: .8, looseByData: false });
  const shift = (layout: typeof loose, index: number) => [layout.sites[index].position[0] - flat.sites[index].position[0], layout.sites[index].position[1] - flat.sites[index].position[1]];
  // Weight 0 stays on the grid; weight 1 takes the whole drift; 0.5 takes half; a missing weight takes none.
  assert.deepEqual(shift(loose, 0), [0, 0]);
  near(shift(loose, 1)[0], shift(everyone, 1)[0]); near(shift(loose, 1)[1], shift(everyone, 1)[1]);
  near(shift(loose, 2)[0], shift(everyone, 2)[0] / 2); near(shift(loose, 2)[1], shift(everyone, 2)[1] / 2);
  assert.deepEqual(shift(loose, 3), [0, 0]);
  assert.ok(Math.abs(shift(everyone, 1)[0]) + Math.abs(shift(everyone, 1)[1]) > 1, "the disorder field really moves cells");
  // Another seed drifts differently.
  const other = latticeLayout(data, data.units, { ...base, seed: 4, looseness: .8, looseByData: false });
  assert.notDeepEqual(other.sites.map((site) => site.position), everyone.sites.map((site) => site.position));
  assert.throws(() => latticeLayout(data, data.units, { ...base, looseness: 2, looseByData: false }), /looseness/);
});

const scoreTable = dataTable({
  id: "score", rowIds: ["p0", "p1", "p2", "p3", "q0", "q1", "q2", "q3", "r0"],
  columns: [
    { name: "time", kind: "continuous", values: [0, 1, 2, 3, 0, 1, 2, 3, 2] },
    { name: "level", kind: "continuous", values: [0, 5, null, 10, 4, 4, 4, 4, 2] },
    { name: "lane", kind: "categorical", categories: ["p", "q", "r"], values: ["p", "p", "p", "p", "q", "q", "q", "q", null] },
  ],
});
const scoreOptions = (missing: "omit" | "keep", extra: Partial<ResolveOptions> = {}) => options({ missing, required: ["time"], window: null, ...extra, channels: {
  time: { kind: "measure", column: "time", domain: [0, 3], curve: "linear", outside: "clamp", range: [0, 1] },
  lane: { kind: "category", column: "lane" },
  level: { kind: "measure", column: "level", domain: [0, 10], curve: "linear", outside: "clamp", range: [0, 1] }, ...(extra.channels ?? {}) } });
const frame = { seed: 1, centerX: 200, centerY: 150, width: 300, height: 300, levelSpread: 1, laneTone: true, laneOrder: "declared" as const };

test("timeline: time sets x, lanes stack in category order, level lifts inside a lane", () => {
  const data = resolveData(scoreTable, scoreOptions("keep"));
  const line = timelineLayout(data, frame);
  // Four lanes: p, q, r and the extra lane for the unit with no category; each 75 tall.
  assert.equal(line.lanes.length, 4);
  assert.deepEqual(line.lanes.map((lane) => [lane.y, lane.category]), [[37.5, "p"], [112.5, "q"], [187.5, "r"], [262.5, null]]);
  const at = (id: string) => line.sites.find((site) => site.id === id)!.position;
  // x = 50 + 300·t/3; y = laneCentre + (0.5 − level/10)·75.
  assert.deepEqual(at("p0"), [50, 37.5 + .5 * 75]);
  assert.deepEqual(at("p1"), [150, 37.5 + 0 * 75]);
  near(at("p3")[0], 350); near(at("p3")[1], 37.5 - .5 * 75);
  near(at("q1")[1], 112.5 + .1 * 75);
  assert.deepEqual(at("r0"), [250, 262.5 + .3 * 75], "no lane value: the final lane");
  assert.deepEqual(at("p2"), [250, 37.5], "a missing level sits on the lane's centre line");
  assert.equal(line.sites.find((site) => site.id === "p1")!.tone, 0);
});

test("timeline score lines break at a missing level and at an omitted reading, never bridge one", () => {
  const kept = timelineLayout(resolveData(scoreTable, scoreOptions("keep")), frame);
  // Lane p: p0, p1 joined; p2 (level missing) breaks; p3 alone. Lane q joined through all four.
  const byLane = (layout: typeof kept, lane: number) => layout.paths.filter((path) => path.level === lane);
  assert.deepEqual(byLane(kept, 0).map((path) => path.points.length), [2]);
  assert.deepEqual(byLane(kept, 1).map((path) => path.points.length), [4]);
  assert.equal(byLane(kept, 2).length, 0, "a single reading has no line");
  // Under omit the missing row leaves; the line must still break where it was, not join p1 to p3.
  const omitted = timelineLayout(resolveData(scoreTable, scoreOptions("omit")), frame);
  assert.deepEqual(byLane(omitted, 0).map((path) => path.points.length), [2], "p1 and p3 are not bridged over the omitted p2");
  assert.equal(omitted.sites.some((site) => site.id === "p2"), false);
  // A row outside the window breaks nothing and is not drawn.
  const window = resolveData(scoreTable, scoreOptions("omit", { window: { column: "time", from: 1, to: 3 } }));
  const windowed = timelineLayout(window, frame);
  assert.deepEqual(windowed.paths.filter((path) => path.level === 1).map((path) => path.points.length), [3]);
  // Path ids and lane tones are structural.
  assert.deepEqual(kept.paths.map((path) => path.id), ["lane:0:0", "lane:1:0"]);
  assert.deepEqual(kept.paths.map((path) => path.tone), [0, 1]);
  // No lane channel: one lane spanning the footprint.
  const single = resolveData(scoreTable, options({ missing: "keep", required: ["time"], channels: { time: scoreOptions("keep").channels.time } }));
  const one = timelineLayout(single, frame);
  assert.deepEqual(one.lanes.map((lane) => lane.y), [150]);
  assert.throws(() => timelineLayout(resolveData(scoreTable, options({ channels: {} })), frame), /named "time"/);
});

test("a seeded lane order re-deals lanes by category name; marks, lines and tones keep their category", () => {
  const data = resolveData(scoreTable, scoreOptions("keep"));
  const declared = timelineLayout(data, frame);
  const deal = (seed: number) => timelineLayout(data, { ...frame, seed, laneOrder: "shuffled" });
  const order = (layout: typeof declared) => layout.lanes.map((lane) => lane.class);
  // Each category's rank depends only on its own name and the seed; the unit with no category stays last.
  for (const seed of [1, 2, 3, 4, 5]) {
    const expected = ["p", "q", "r"].map((name, index) => [componentSeed(seed, `lane:${name}`, "lane-order"), index] as const)
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, index]) => index);
    assert.deepEqual(order(deal(seed)), [...expected, null === null ? 3 : 3], `seed ${seed}`);
  }
  assert.ok([1, 2, 3, 4, 5, 6, 7, 8].some((seed) => JSON.stringify(order(deal(seed))) !== JSON.stringify(order(declared))), "some seed re-orders the lanes");
  const other = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => deal(seed)).find((layout) => JSON.stringify(order(layout)) !== JSON.stringify(order(declared)))!;
  // A mark keeps its own lane: its y sits in the lane band of its category's new position, x is unchanged.
  const laneHeight = 300 / 4;
  for (const site of other.sites) {
    const home = declared.sites.find((item) => item.id === site.id)!;
    assert.equal(site.position[0], home.position[0]);
    const cls = site.unit.channels.lane ?? 3;
    const position = order(other).indexOf(cls);
    assert.ok(Math.abs(site.position[1] - other.lanes[position].y) <= laneHeight / 2 + 1e-9, site.id);
  }
  // Path ids and tones follow the category, not the stack position.
  assert.deepEqual(other.paths.map((path) => [path.id, path.tone]).sort(), declared.paths.map((path) => [path.id, path.tone]).sort());
  assert.throws(() => timelineLayout(data, { ...frame, laneOrder: "random" as never }), /Unknown lane order/);
});
