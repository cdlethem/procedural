import assert from "node:assert/strict";
import test from "node:test";
import { controlIsVisible, createInstrument, validateVisibility, visibilityAlternatives, visibilityDrivers, type InstrumentDefinition, type Parameter } from "../dist/index.js";
import { applyControlDependencies } from "../dist/control-dependencies.js";
import { inspectorItems } from "../dist/control-groups.js";
import { controlIsVisible as itemVisible, visibleParameters as visibleFor } from "../dist/visibility.js";

const select = (key: string, values: string[], extra: Partial<Parameter> = {}): Parameter =>
  ({ key, label: key, description: key, type: "select", options: values.map((value) => ({ value, label: value })), ...extra });
const toggle = (key: string, extra: Partial<Parameter> = {}): Parameter => ({ key, label: key, description: key, type: "boolean", ...extra });
const amount = (key: string, extra: Partial<Parameter> = {}): Parameter =>
  ({ key, label: key, description: key, type: "number", min: 0, max: 1, step: .1, ...extra });
const count = (key: string, extra: Partial<Parameter> = {}): Parameter =>
  ({ key, label: key, description: key, type: "number", min: 1, max: 8, step: 1, integer: true, ...extra });
const text = (key: string): Parameter => ({ key, label: key, description: key, type: "text", maxLength: 20 });
const item = (parameters: Parameter[]): InstrumentDefinition =>
  ({ id: "probe", title: "Probe", description: "", parameters, controlGroups: [{ label: "All", controls: parameters.map((parameter) => parameter.key) }], defaults: {} });
type Values = Record<string, string | number | boolean>;
const shown = (definition: InstrumentDefinition, values: Values) => visibleFor(definition, values).map((parameter) => parameter.key);
const rejects = (parameters: Parameter[], pattern: RegExp) => assert.throws(() => validateVisibility(item(parameters)), pattern);

test("alternatives are an OR of conjunctions", () => {
  const either = item([toggle("a"), toggle("b"), amount("x", { visibleWhen: [{ a: [true] }, { b: [true] }] })]);
  const table = [[false, false], [true, false], [false, true], [true, true]]
    .map(([a, b]) => shown(either, { a, b, x: .5 }).includes("x"));
  assert.deepEqual(table, [false, true, true, true]);

  const mixed = item([toggle("a"), toggle("b"), select("m", ["p", "q", "r"]),
    amount("x", { visibleWhen: [{ a: [true], b: [true] }, { m: ["q", "r"] }] })]);
  const cases: [boolean, boolean, string, boolean][] = [
    [false, false, "p", false], [true, false, "p", false], [false, true, "p", false], [true, true, "p", true],
    [false, false, "q", true], [true, false, "r", true], [false, false, "r", true],
  ];
  for (const [a, b, m, expected] of cases)
    assert.equal(shown(mixed, { a, b, m, x: .5 }).includes("x"), expected, `a=${a} b=${b} m=${m}`);
});

test("a one-element array behaves exactly like the object it wraps", () => {
  const wrapped = item([toggle("a"), amount("x", { visibleWhen: [{ a: [true] }] })]);
  const bare = item([toggle("a"), amount("x", { visibleWhen: { a: [true] } })]);
  for (const a of [true, false]) assert.deepEqual(shown(wrapped, { a, x: 0 }), shown(bare, { a, x: 0 }));
});

test("float comparisons: every operator at and around its boundary", () => {
  const values = [0, .25, .5, .75, 1];
  const table: [Record<string, number>, boolean[]][] = [
    [{ lt: .5 }, [true, true, false, false, false]],
    [{ lte: .5 }, [true, true, true, false, false]],
    [{ gt: .5 }, [false, false, false, true, true]],
    [{ gte: .5 }, [false, false, true, true, true]],
    [{ eq: .5 }, [false, false, true, false, false]],
    [{ ne: .5 }, [true, true, false, true, true]],
    [{ gte: .25, lt: .75 }, [false, true, true, false, false]],
    [{ gt: .25, lte: .75 }, [false, false, true, true, false]],
    [{ gte: .5, lte: .5 }, [false, false, true, false, false]],
  ];
  for (const [comparison, expected] of table) {
    const probe = item([amount("driver"), amount("x", { visibleWhen: { driver: comparison } })]);
    assert.deepEqual(values.map((driver) => shown(probe, { driver, x: 0 }).includes("x")), expected, JSON.stringify(comparison));
  }
});

test("integer comparisons: lt versus lte and gt versus gte differ exactly at the literal", () => {
  const cases: [Record<string, number>, boolean[]][] = [ // values 1,2,3,4
    [{ lt: 3 }, [true, true, false, false]], [{ lte: 3 }, [true, true, true, false]],
    [{ gt: 2 }, [false, false, true, true]], [{ gte: 2 }, [false, true, true, true]],
    [{ eq: 3 }, [false, false, true, false]], [{ ne: 3 }, [true, true, false, true]],
    [{ gte: 2, lt: 4 }, [false, true, true, false]],
  ];
  for (const [comparison, expected] of cases) {
    const probe = item([count("passes"), amount("x", { visibleWhen: { passes: comparison } })]);
    assert.deepEqual([1, 2, 3, 4].map((passes) => shown(probe, { passes, x: 0 }).includes("x")), expected, JSON.stringify(comparison));
  }
});

test("a value that is not a finite number holds no comparison, not even ne", () => {
  const probe = item([amount("driver"), amount("x", { visibleWhen: { driver: { ne: .5 } } })]);
  for (const bad of ["0.2", true, NaN, Infinity, undefined as unknown as number])
    assert.equal(shown(probe, { driver: bad as number, x: 0 }).includes("x"), false, String(bad));
});

test("a satisfied alternative counts only while every driver it names is shown", () => {
  const definition = item([
    select("mode", ["a", "b", "c"]),
    toggle("detail", { visibleWhen: { mode: ["a"] } }),
    amount("weight", { visibleWhen: [{ detail: [true] }, { mode: ["c"] }] }),
  ]);
  const weight = (mode: string, detail: boolean) => shown(definition, { mode, detail, weight: .5 }).includes("weight");
  assert.equal(weight("a", true), true, "first alternative, driver shown");
  assert.equal(weight("a", false), false, "neither alternative holds");
  assert.equal(weight("b", true), false, "detail holds true but is hidden under mode b: that alternative counts for nothing");
  assert.equal(weight("c", true), true, "the second alternative holds and mode is always shown");
  assert.equal(weight("c", false), true);
  assert.equal(weight("b", false), false);
});

test("an alternative on a hidden numeric driver counts for nothing; a visible one still counts", () => {
  const definition = item([
    select("mode", ["a", "b"]),
    amount("retained", { visibleWhen: { mode: ["a"] } }),
    toggle("force"),
    amount("keepBy", { visibleWhen: [{ retained: { lt: 1 } }, { force: [true] }] }),
  ]);
  const keepBy = (mode: string, retained: number, force: boolean) => shown(definition, { mode, retained, force, keepBy: 0 }).includes("keepBy");
  assert.equal(keepBy("a", .5, false), true);
  assert.equal(keepBy("a", 1, false), false, "retained 1 is not below 1");
  assert.equal(keepBy("b", .5, false), false, "retained is hidden, so retained < 1 cannot justify keepBy");
  assert.equal(keepBy("b", .5, true), true, "the other alternative does");
});

test("effective visibility is a least fixpoint: on an unvalidated cycle, mutually justifying controls stay hidden", () => {
  const cyclic = item([
    toggle("root"),
    toggle("a", { visibleWhen: [{ b: [true] }, { root: [true] }] }),
    toggle("b", { visibleWhen: { a: [true] } }),
  ]);
  assert.deepEqual(shown(cyclic, { root: false, a: true, b: true }), ["root"]);
  assert.deepEqual(shown(cyclic, { root: true, a: true, b: true }), ["root", "a", "b"]);
});

test("cycles are found across alternatives, including through numeric drivers", () => {
  rejects([select("a", ["x", "y"], { visibleWhen: [{ c: [true] }, { b: ["p"] }] }), select("b", ["p", "q"], { visibleWhen: { a: ["x"] } }), toggle("c")],
    /cycle: a -> b -> a/);
  rejects([amount("n", { visibleWhen: [{ t: [true] }, { m: ["q"] }] }), toggle("t"), select("m", ["p", "q"], { visibleWhen: { n: { gt: .5 } } })],
    /cycle: n -> m -> n/);
  validateVisibility(item([select("a", ["x", "y"], { visibleWhen: [{ c: [true] }, { b: ["p"] }] }), select("b", ["p", "q"]), toggle("c")]));
});

test("structure errors name the instrument, control, alternative and driver", () => {
  rejects([toggle("t"), amount("x", { visibleWhen: [] })], /Instrument probe control x visibleWhen must list at least one alternative/);
  rejects([toggle("t"), amount("x", { visibleWhen: [{ t: [true] }, {}] })], /x visibleWhen\[1\] must name at least one control/);
  rejects([toggle("t"), amount("x", { visibleWhen: [{ t: [true] }, { zzz: [true] }] })], /x visibleWhen\[1\] names unknown control zzz/);
  rejects([toggle("t"), amount("x", { visibleWhen: [{ t: [true] }, { x: { gt: .5 } }] })], /x visibleWhen\[1\] cannot depend on itself/);
  rejects([text("label"), amount("x", { visibleWhen: [{ label: ["a"] }] })], /may only depend on a select, boolean or number control, not label \(text\)/);
  rejects([toggle("t"), amount("x", { visibleWhen: [null as never] })], /must be an object mapping/);
  rejects([toggle("t"), amount("x", { visibleWhen: "yes" as never })], /must be an object or a non-empty array/);
  rejects([toggle("t"), toggle("u"), amount("x", { visibleWhen: [{ t: [true] }, { u: [] }] })], /x visibleWhen\[1\]\.u must list at least one value/);
  rejects([select("m", ["p", "q"]), toggle("t"), amount("x", { visibleWhen: [{ t: [true] }, { m: ["nope"] }] })], /\[1\]\.m lists "nope", which m cannot take/);
});

test("comparison entries are only for number controls and must be well formed", () => {
  rejects([select("m", ["p", "q"]), amount("x", { visibleWhen: { m: { lt: 1 } } })], /x visibleWhen\.m is a comparison, but m is a select control/);
  rejects([toggle("t"), amount("x", { visibleWhen: { t: { eq: 1 } } })], /is a comparison, but t is a boolean control/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: [1] } })], /must be a comparison such as \{ gte: 1 \}, not a value list, because n is a number control/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: {} } })], /n must state at least one of lt, lte, gt, gte, eq, ne/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { above: .5 } as never } })], /unknown operator "above"/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { lt: NaN } } })], /n\.lt must be a finite number/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { gt: Infinity } } })], /n\.gt must be a finite number/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { lt: "1" as never } } })], /n\.lt must be a finite number/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { gt: .1, lt: .9, ne: .5 } } })], /cannot combine gt and lt and ne/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { lt: .9, lte: .8 } } })], /cannot combine lt and lte/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { gt: .1, gte: .2 } } })], /cannot combine gt and gte/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { eq: .5, lt: .9 } } })], /cannot combine eq and lt/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { ne: .5, gt: .1 } } })], /cannot combine ne and gt/);
});

test("numeric conditions are checked against the driver's HARD range", () => {
  rejects([amount("n"), amount("x", { visibleWhen: { n: { gt: 5 } } })], /n\.gt \(5\) is outside n's hard range 0 to 1/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { lt: -.5 } } })], /n\.lt \(-0\.5\) is outside n's hard range 0 to 1/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { ne: 2 } } })], /outside n's hard range/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { gt: .2, lt: 3 } } })], /n\.lt \(3\) is outside/);
  // The slider stops at 1 but exact entry goes to 10, so a threshold of 5 is meaningful.
  validateVisibility(item([amount("n", { hardMin: 0, hardMax: 10 }), amount("x", { visibleWhen: { n: { gt: 5 } } })]));
  rejects([amount("n", { hardMin: 0, hardMax: 10 }), amount("x", { visibleWhen: { n: { gt: 12 } } })], /outside n's hard range 0 to 10/);
  rejects([amount("n", { hardMin: 2, hardMax: 10 }), amount("x", { visibleWhen: { n: { lt: 1 } } })], /outside n's hard range 2 to 10/);
});

test("a comparison that never holds, always holds, or contradicts itself is rejected", () => {
  rejects([amount("n"), amount("x", { visibleWhen: { n: { lt: 0 } } })], /can never hold: n ranges over 0 to 1/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { gt: 1 } } })], /can never hold/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { gte: 0 } } })], /allows every value of n; drop the condition/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { lte: 1 } } })], /allows every value of n/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { gte: 0, lte: 1 } } })], /allows every value of n/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { gt: .6, lt: .4 } } })], /is contradictory: gt 0\.6 with lt 0\.4 holds for no value/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { gt: .5, lte: .5 } } })], /is contradictory: gt 0\.5 with lte 0\.5/);
  rejects([amount("n"), amount("x", { visibleWhen: { n: { gte: .5, lt: .5 } } })], /is contradictory/);
  // Integers: nothing lies strictly between 1 and 2, and 1.5 is not an integer.
  rejects([count("k"), amount("x", { visibleWhen: { k: { gt: 1, lt: 2 } } })], /can never hold: k ranges over 1 to 8 in whole numbers/);
  rejects([count("k"), amount("x", { visibleWhen: { k: { eq: 1.5 } } })], /can never hold/);
  rejects([count("k"), amount("x", { visibleWhen: { k: { lt: 1 } } })], /can never hold/);
  rejects([count("k"), amount("x", { visibleWhen: { k: { gte: 1 } } })], /allows every value/);
  // A point interval and a boundary literal that still restrict are fine.
  validateVisibility(item([amount("n"), amount("x", { visibleWhen: { n: { gte: .5, lte: .5 } } })]));
  validateVisibility(item([amount("n"), amount("x", { visibleWhen: { n: { lt: 1 } } })]));
  validateVisibility(item([amount("n"), amount("x", { visibleWhen: { n: { gt: 0 } } })]));
  validateVisibility(item([count("k"), amount("x", { visibleWhen: { k: { gt: 1, lt: 3 } } })]));
});

test("alternatives may not be tautological, unsatisfiable, duplicated, redundant or jointly exhaustive", () => {
  // Any single entry that allows every value of its driver is a tautology, even inside an array.
  rejects([toggle("t"), toggle("u"), amount("x", { visibleWhen: [{ t: [true] }, { u: [true, false] }] })], /visibleWhen\[1\]\.u allows every value of u/);
  rejects([select("m", ["p", "q"]), toggle("t"), amount("x", { visibleWhen: [{ t: [true] }, { m: ["p", "q"] }] })], /allows every value of m/);
  // Unsatisfiable: a select value outside its options, a contradictory interval.
  rejects([select("m", ["p", "q"]), toggle("t"), amount("x", { visibleWhen: [{ t: [true] }, { m: ["z"] }] })], /cannot take/);
  rejects([amount("n"), toggle("t"), amount("x", { visibleWhen: [{ t: [true] }, { n: { gt: .9, lt: .1 } }] })], /\[1\]\.n is contradictory/);
  // Exact duplicates, whatever the order of values or keys.
  rejects([toggle("t"), amount("x", { visibleWhen: [{ t: [true] }, { t: [true] }] })], /alternatives \[0\] and \[1\] are identical/);
  rejects([select("m", ["p", "q", "r"]), toggle("t"), amount("x", { visibleWhen: [{ m: ["p", "q"], t: [true] }, { t: [true], m: ["q", "p"] }] })], /alternatives \[0\] and \[1\] are identical/);
  rejects([amount("n"), toggle("t"), amount("x", { visibleWhen: [{ t: [true] }, { n: { lt: .5 } }, { n: { lt: .5 } }] })], /alternatives \[1\] and \[2\] are identical/);
  // A narrower alternative adds nothing to a wider one.
  rejects([select("m", ["p", "q", "r"]), toggle("t"), amount("x", { visibleWhen: [{ m: ["p", "q"] }, { m: ["p"] }] })], /visibleWhen\[1\] is redundant: \[0\] already shows the control whenever it holds/);
  rejects([select("m", ["p", "q", "r"]), toggle("t"), amount("x", { visibleWhen: [{ m: ["p"], t: [true] }, { m: ["p"] }] })], /visibleWhen\[0\] is redundant: \[1\]/);
  rejects([amount("n"), toggle("t"), amount("x", { visibleWhen: [{ n: { lt: .6 } }, { n: { lte: .2 } }] })], /visibleWhen\[1\] is redundant: \[0\]/);
  // Alternatives that jointly allow everything are a tautology too.
  rejects([toggle("t"), amount("x", { visibleWhen: [{ t: [true] }, { t: [false] }] })], /alternatives together allow every combination of t; drop the condition/);
  rejects([amount("n"), amount("x", { visibleWhen: [{ n: { lt: .5 } }, { n: { gte: .5 } }] })], /alternatives together allow every combination of n/);
  rejects([count("k"), toggle("t"), amount("x", { visibleWhen: [{ k: { lte: 3 } }, { k: { gt: 3 } }] })], /together allow every combination/);
  // Overlapping but distinct alternatives are legitimate.
  validateVisibility(item([amount("n"), toggle("t"), amount("x", { visibleWhen: [{ n: { gte: .2, lt: .6 } }, { n: { gt: .4, lte: .8 } }, { t: [true] }] })]));
  validateVisibility(item([select("m", ["p", "q", "r"]), toggle("t"), amount("x", { visibleWhen: [{ m: ["p"], t: [true] }, { m: ["q"] }] })]));
});

test("value lists keep their existing meaning inside arrays and out", () => {
  rejects([toggle("t"), amount("x", { visibleWhen: [{ t: [true, true] }, { t: [false] }] })], /repeats a value/);
  validateVisibility(item([toggle("t"), select("m", ["p", "q"]), amount("x", { visibleWhen: [{ t: [true] }, { m: ["q"] }] })]));
});

test("helpers: controlIsVisible, visibilityAlternatives and visibilityDrivers", () => {
  const definition = item([select("mode", ["a", "b"]), amount("retained"), toggle("force"),
    amount("keepBy", { visibleWhen: [{ retained: { lt: 1 }, mode: ["a"] }, { force: [true] }] }), amount("plain"), amount("single", { visibleWhen: { mode: ["b"] } })]);
  assert.equal(itemVisible(definition, "keepBy", { mode: "a", retained: .5, force: false }), true);
  assert.equal(itemVisible(definition, "keepBy", { mode: "a", retained: 1, force: false }), false);
  assert.equal(itemVisible(definition, "plain", {}), true);
  assert.throws(() => itemVisible(definition, "nope", {}), /Unknown control nope/);
  assert.deepEqual(visibilityAlternatives(definition.parameters[3]).length, 2);
  assert.deepEqual(visibilityAlternatives(definition.parameters[5]), [{ mode: ["b"] }]);
  assert.deepEqual(visibilityAlternatives(definition.parameters[4]), []);
  assert.deepEqual(visibilityDrivers(definition.parameters[3]), ["retained", "mode", "force"]);
  assert.deepEqual(visibilityDrivers(definition.parameters[4]), []);
  // The id-based public form resolves a published instrument.
  assert.equal(controlIsVisible("motif-ecologies", "petals", { ...createInstrument("motif-ecologies").params, mark: "rosette" }), true);
  assert.equal(controlIsVisible("motif-ecologies", "petals", { ...createInstrument("motif-ecologies").params, mark: "dot" }), false);
});

test("the inspector tree follows array conditions and comparisons", () => {
  const definition = item([select("mode", ["a", "b"]), amount("retained"), amount("keepBy", { visibleWhen: [{ retained: { lt: 1 } }, { mode: ["b"] }] })]);
  const keys = (values: Values) => JSON.stringify(inspectorItems(definition, values));
  assert.ok(keys({ mode: "a", retained: .5, keepBy: 0 }).includes('"key":"keepBy"'));
  assert.ok(!keys({ mode: "a", retained: 1, keepBy: 0 }).includes('"key":"keepBy"'));
  assert.ok(keys({ mode: "b", retained: 1, keepBy: 0 }).includes('"key":"keepBy"'));
});

test("overlay conditions may be arrays and comparisons", () => {
  const base = item([select("mode", ["a", "b"]), amount("retained"), amount("keepBy")]);
  const [attached] = applyControlDependencies([base], { probe: { keepBy: [{ retained: { lt: 1 } }, { mode: ["b"] }] } });
  assert.deepEqual(visibilityAlternatives(attached.parameters[2]), [{ retained: { lt: 1 } }, { mode: ["b"] }]);
  validateVisibility(attached);
});
