import assert from "node:assert/strict";
import test from "node:test";
import {
  createInstrument, definitions, validateParameters, validateVisibility, visibleParameters,
  type InstrumentDefinition, type Parameter,
} from "../dist/index.js";
import { applyControlDependencies } from "../dist/control-dependencies.js";
import { visibleParameters as visibleFor } from "../dist/visibility.js";
import { drawFingerprint } from "./helpers/draw-fingerprint.ts";

const select = (key: string, values: string[], extra: Partial<Parameter> = {}): Parameter =>
  ({ key, label: key, description: key, type: "select", options: values.map((value) => ({ value, label: value })), ...extra });
const toggle = (key: string, extra: Partial<Parameter> = {}): Parameter => ({ key, label: key, description: key, type: "boolean", ...extra });
const amount = (key: string, extra: Partial<Parameter> = {}): Parameter =>
  ({ key, label: key, description: key, type: "number", min: 0, max: 1, step: .1, ...extra });
const item = (parameters: Parameter[], defaults: InstrumentDefinition["defaults"] = {}): InstrumentDefinition =>
  ({ id: "probe", title: "Probe", description: "", parameters, defaults });
const rejects = (parameters: Parameter[], pattern: RegExp) => assert.throws(() => validateVisibility(item(parameters)), pattern);

test("conditions must name a select or boolean control of the same instrument", () => {
  rejects([select("mark", ["dot", "ring"]), amount("size", { visibleWhen: { missing: ["a"] } })], /unknown control missing/);
  rejects([amount("count"), amount("size", { visibleWhen: { count: [1] } })], /select or boolean/);
  rejects([select("mark", ["dot", "ring"], { visibleWhen: { mark: ["dot"] } })], /cannot depend on itself/);
  rejects([select("mark", ["dot", "ring"]), amount("size", { visibleWhen: {} })], /at least one control/);
  rejects([select("mark", ["dot", "ring"]), amount("size", { visibleWhen: { mark: [] } })], /at least one value/);
});

test("allowed values must be real, distinct and actually restrict the driver", () => {
  rejects([select("mark", ["dot", "ring"]), amount("size", { visibleWhen: { mark: ["star"] } })], /cannot take/);
  rejects([toggle("show"), amount("size", { visibleWhen: { show: ["yes"] } })], /cannot take/);
  rejects([select("mark", ["dot", "ring"]), amount("size", { visibleWhen: { mark: ["dot", "dot"] } })], /repeats/);
  rejects([select("mark", ["dot", "ring"]), amount("size", { visibleWhen: { mark: ["dot", "ring"] } })], /allows every value/);
  rejects([toggle("show"), amount("size", { visibleWhen: { show: [true, false] } })], /allows every value/);
  validateVisibility(item([select("mark", ["dot", "ring"]), amount("size", { visibleWhen: { mark: ["ring"] } })]));
  validateVisibility(item([toggle("show"), amount("size", { visibleWhen: { show: [true] } })]));
});

test("dependency cycles are rejected with the cycle named", () => {
  rejects([select("a", ["x", "y"], { visibleWhen: { b: ["p"] } }), select("b", ["p", "q"], { visibleWhen: { a: ["x"] } })], /cycle: [ab] -> [ab] -> [ab]/);
});

test("a control is shown only when its own condition holds and every driver it names is shown", () => {
  const chain = item([
    select("material", ["ink", "beads"]),
    select("beadMark", ["dot", "rosette"], { visibleWhen: { material: ["beads"] } }),
    amount("beadPetals", { visibleWhen: { beadMark: ["rosette"] } }),
    amount("weight"),
  ]);
  const shown = (values: Record<string, string | number | boolean>) => visibleFor(chain, values).map((parameter) => parameter.key);
  assert.deepEqual(shown({ material: "beads", beadMark: "rosette" }), ["material", "beadMark", "beadPetals", "weight"]);
  // beadMark still holds "rosette" while hidden; petals must not resurface under a hidden driver.
  assert.deepEqual(shown({ material: "ink", beadMark: "rosette" }), ["material", "weight"]);
  assert.deepEqual(shown({ material: "beads", beadMark: "dot" }), ["material", "beadMark", "weight"]);
});

test("conditions on several drivers all have to hold", () => {
  const both = item([toggle("a"), toggle("b"), amount("x", { visibleWhen: { a: [true], b: [false] } })]);
  const shown = (a: boolean, b: boolean) => visibleFor(both, { a, b }).some((parameter) => parameter.key === "x");
  assert.deepEqual([shown(true, false), shown(true, true), shown(false, false), shown(false, true)], [true, false, false, false]);
});

test("overlay conditions attach by instrument and control and never override an inline one", () => {
  const base = item([select("mark", ["dot", "ring"]), amount("size"), amount("weight", { visibleWhen: { mark: ["ring"] } })]);
  const [attached] = applyControlDependencies([base], { probe: { size: { mark: ["dot"] } } });
  assert.deepEqual(attached.parameters.find((parameter) => parameter.key === "size")?.visibleWhen, { mark: ["dot"] });
  assert.equal(base.parameters.find((parameter) => parameter.key === "size")?.visibleWhen, undefined, "the source definition is not mutated");
  assert.throws(() => applyControlDependencies([base], { probe: { weight: { mark: ["dot"] } } }), /already declares visibleWhen inline/);
  assert.throws(() => applyControlDependencies([base], { probe: { nope: { mark: ["dot"] } } }), /unknown control nope/);
  assert.throws(() => applyControlDependencies([base], { ghost: { size: { mark: ["dot"] } } }), /unknown instrument ghost/);
});

test("the public helper resolves an instrument by id", () => {
  const input = createInstrument("motif-ecologies");
  const shown = (values: typeof input.params) => visibleParameters("motif-ecologies", values).map((parameter) => parameter.key);
  assert.ok(shown({ ...input.params, mark: "rosette" }).includes("petals"));
  assert.ok(!shown({ ...input.params, mark: "dot" }).includes("petals"));
  assert.ok(shown({ ...input.params, support: "annulus" }).includes("opening"));
  assert.ok(!shown({ ...input.params, support: "rectangle" }).includes("opening"));
});

/**
 * The contract's testable converse: a control the inspector hides has no effect on the drawing.
 * Configurations and alternative values are drawn from a fixed stream, so a failure reproduces.
 * `tests/helpers/audit-controls.ts` runs the exhaustive measurement this samples.
 */
function stream(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function alternative(parameter: Parameter, current: unknown, random: () => number): string | number | boolean | undefined {
  if (parameter.type === "boolean") return !current;
  if (parameter.type === "select") { const options = parameter.options!.map((option) => option.value).filter((value) => value !== current); return options[Math.floor(random() * options.length)]; }
  if (parameter.type !== "number") return undefined;
  const low = parameter.min!, high = parameter.max!, step = parameter.integer || parameter.step === 1 ? 1 : 0;
  let value = low + (high - low) * (.15 + .8 * random());
  if (step) value = Math.round(value); else value = Math.round(value * 1e4) / 1e4;
  return value === current ? undefined : Math.min(parameter.hardMax ?? high, Math.max(parameter.hardMin ?? low, value));
}

test("changing a control the inspector hides never changes the drawing", () => {
  let checked = 0;
  const failures: string[] = [];
  for (const definition of definitions) {
    if (!definition.parameters.some((parameter) => parameter.visibleWhen)) continue;
    const random = stream([...definition.id].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 11));
    const drivers = definition.parameters.filter((parameter) => parameter.type === "select" || parameter.type === "boolean");
    let budget = 18;
    for (let attempt = 0; attempt < 6 && budget > 0; attempt++) {
      const values = { ...createInstrument(definition.id).params };
      for (const driver of drivers) {
        const pool = driver.type === "boolean" ? [false, true] : driver.options!.map((option) => option.value);
        values[driver.key] = pool[Math.floor(random() * pool.length)];
      }
      try { validateParameters(definition.id, values); } catch { continue; }
      const shown = new Set(visibleParameters(definition.id, values).map((parameter) => parameter.key));
      const hidden = definition.parameters.filter((parameter) => !shown.has(parameter.key));
      const base = drawFingerprint({ ...createInstrument(definition.id), params: values });
      for (const parameter of hidden.slice(0, 4)) {
        const value = alternative(parameter, values[parameter.key], random);
        if (value === undefined || budget-- <= 0) continue;
        const params = { ...values, [parameter.key]: value };
        try { validateParameters(definition.id, params); } catch { continue; }
        checked++;
        if (drawFingerprint({ ...createInstrument(definition.id), params }) !== base)
          failures.push(`${definition.id}.${parameter.key} changed the drawing while hidden (${JSON.stringify(Object.fromEntries(drivers.map((driver) => [driver.key, values[driver.key]])))})`);
      }
    }
  }
  assert.deepEqual(failures, []);
  assert.ok(checked > 40, `only ${checked} hidden-control changes were exercised`);
});
