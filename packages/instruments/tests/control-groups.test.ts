import assert from "node:assert/strict";
import test from "node:test";
import {
  createInstrument, definitions, inspectorItems, validateControlGroups, visibleParameters,
  type ControlGroup, type InspectorItem, type InstrumentDefinition, type Parameter,
} from "../dist/index.js";
import { resolveControlGroups } from "../dist/control-groups.js";

const length = (key: string, extra: Partial<Parameter> = {}): Parameter =>
  ({ key, label: key, description: key, type: "number", min: 0, max: 100, step: 1, ...extra });
const select = (key: string, values: string[], extra: Partial<Parameter> = {}): Parameter =>
  ({ key, label: key, description: key, type: "select", options: values.map((value) => ({ value, label: value })), ...extra });
const probe = (parameters: Parameter[], controlGroups: readonly ControlGroup[]): InstrumentDefinition =>
  ({ id: "probe", title: "Probe", description: "", parameters, controlGroups, defaults: {} });
const rejects = (parameters: Parameter[], groups: readonly ControlGroup[], pattern: RegExp) =>
  assert.throws(() => validateControlGroups(probe(parameters, groups)), pattern);

test("every control belongs to exactly one existing, non-empty group", () => {
  const [a, b] = [length("a"), length("b")];
  rejects([a, b], [{ label: "One", controls: ["a"] }], /leaves b ungrouped/);
  rejects([a, b], [{ label: "One", controls: ["a", "b"] }, { label: "Two", controls: ["a"] }], /a belongs to more than one group/);
  rejects([a, b], [{ label: "One", controls: ["a", "b", "c"] }], /unknown control c/);
  rejects([{ ...a, group: "Other" }, b], [{ label: "One", controls: ["a", "b"] }], /control a authors group "Other"/);
  rejects([a, b], [{ label: "One", controls: "ab" as unknown as string[] }], /One has no controls/);
  // A published definition (group already derived) validates again.
  validateControlGroups(probe([{ ...a, group: "One" }, b], [{ label: "One", controls: ["a", "b"] }]));
  rejects([a, b], [{ label: "One", controls: ["a", "b"] }, { label: "Two", controls: [] }], /Two has no controls/);
  rejects([a, b], [], /at least one group/);
});

test("labels are unique among siblings, free of the path separator, and nest at most three deep", () => {
  const [a, b] = [length("a"), length("b")];
  rejects([a, b], [{ label: "One", controls: ["a"] }, { label: "One", controls: ["b"] }], /repeats group One/);
  rejects([a, b], [{ label: "A/B", controls: ["a", "b"] }], /free of "\/"/);
  rejects([a, b], [{ label: " One", controls: ["a", "b"] }], /trimmed/);
  rejects([a, b], [{ label: "1", controls: ["a", { label: "2", controls: [{ label: "3", controls: [{ label: "4", controls: ["b"] }] }] }] }],
    /1\/2\/3\/4 is nested deeper than 3/);
  // The same label under different parents is fine.
  validateControlGroups(probe([a, b], [{ label: "One", controls: [{ label: "Size", controls: ["a"] }] }, { label: "Two", controls: [{ label: "Size", controls: ["b"] }] }]));
});

test("proportional groups hold two or more non-negative numbers and nothing else", () => {
  const [a, b] = [length("a"), length("b")];
  rejects([a, b], [{ label: "Size", controls: ["a"], proportional: true }, { label: "Rest", controls: ["b"] }], /at least two controls/);
  rejects([a, select("b", ["x", "y"])], [{ label: "Size", controls: ["a", "b"], proportional: true }], /b, which is not a number/);
  rejects([a, length("b", { min: 0, hardMin: -10 })], [{ label: "Size", controls: ["a", "b"], proportional: true }], /b, which can be negative/);
  rejects([a, b, length("c")], [{ label: "Size", controls: ["a", "b", { label: "Inner", controls: ["c"] }], proportional: true }], /cannot contain a nested group/);
  validateControlGroups(probe([a, b], [{ label: "Size", controls: ["a", "b"], proportional: true }]));
});

test("resolution orders controls by group and derives each slash path", () => {
  const resolved = resolveControlGroups(probe([length("w"), select("mode", ["x", "y"]), length("h"), length("gap")], [
    { label: "Form", controls: ["mode", { label: "Size", controls: ["w", "h"], proportional: true }, "gap"] },
  ]));
  assert.deepEqual(resolved.parameters.map((parameter) => [parameter.key, parameter.group]),
    [["mode", "Form"], ["w", "Form/Size"], ["h", "Form/Size"], ["gap", "Form"]]);
});

const flatten = (items: InspectorItem[]): string[] =>
  items.flatMap((entry) => entry.kind === "control" ? [entry.parameter.key] : flatten(entry.items));
const groupPaths = (items: InspectorItem[]): string[] =>
  items.flatMap((entry) => entry.kind === "control" ? [] : [entry.path, ...groupPaths(entry.items)]);

test("the inspector tree drops hidden controls and groups left with nothing visible", () => {
  const input = createInstrument("contour-scores");
  const beads = inspectorItems("contour-scores", { ...input.params, material: "beads", beadMark: "rosette" });
  assert.ok(groupPaths(beads).includes("Material/Bead mark/Shape"));
  const ink = inspectorItems("contour-scores", { ...input.params, material: "ink" });
  const paths = groupPaths(ink);
  for (const hidden of ["Material/Stations", "Material/Bead mark", "Material/Bead mark/Scale"])
    assert.ok(!paths.includes(hidden), `${hidden} is empty for ink`);
  const size = ink.find((entry) => entry.kind === "group" && entry.label === "Placement");
  assert.ok(size?.kind === "group" && size.items.some((entry) => entry.kind === "group" && entry.label === "Size" && entry.proportional));
});

test("for every instrument the inspector tree shows exactly the visible controls, in published order", () => {
  let state = 7;
  const random = () => { state = (Math.imul(state, 1103515245) + 12345) >>> 0; return state / 2 ** 32; };
  for (const item of definitions) {
    const base = createInstrument(item.id).params;
    for (let trial = 0; trial < 6; trial++) {
      const values = { ...base };
      if (trial) for (const parameter of item.parameters) {
        if (parameter.type === "boolean") values[parameter.key] = random() < .5;
        else if (parameter.type === "select") values[parameter.key] = parameter.options![Math.floor(random() * parameter.options!.length)].value;
      }
      const expected = visibleParameters(item.id, values).map((parameter) => parameter.key);
      assert.deepEqual(flatten(inspectorItems(item.id, values)), expected, `${item.id} trial ${trial}`);
    }
  }
});

test("every published definition re-validates", () => {
  for (const item of definitions) validateControlGroups(item);
});

test("a proportional group has some reachable setting where two or more of its members are visible", () => {
  const combos = (drivers: Parameter[]): Record<string, string | boolean>[] => drivers.reduce<Record<string, string | boolean>[]>(
    (acc, driver) => acc.flatMap((base) => (driver.type === "boolean" ? [true, false] : driver.options!.map((o) => o.value)).map((value) => ({ ...base, [driver.key]: value }))), [{}]);
  const walk = (groups: readonly ControlGroup[]): ControlGroup[] =>
    groups.flatMap((g) => [g, ...walk(g.controls.filter((m): m is ControlGroup => typeof m !== "string"))]);
  const dead: string[] = [];
  for (const item of definitions) for (const group of walk(item.controlGroups)) {
    if (!group.proportional) continue;
    const members = group.controls as string[];
    const drivers = new Set<string>();
    for (const key of members) for (const k of Object.keys(item.parameters.find((p) => p.key === key)!.visibleWhen ?? {})) drivers.add(k);
    // Drivers of drivers matter for effective visibility.
    for (let grew = true; grew;) { grew = false; for (const k of [...drivers]) for (const d of Object.keys(item.parameters.find((p) => p.key === k)!.visibleWhen ?? {})) if (!drivers.has(d)) { drivers.add(d); grew = true; } }
    const list = combos([...drivers].map((k) => item.parameters.find((p) => p.key === k)!));
    const ok = list.some((choice) => {
      const shown = new Set(visibleParameters(item.id, { ...item.defaults, ...choice }).map((p) => p.key));
      return members.filter((key) => shown.has(key)).length >= 2;
    });
    if (!ok) dead.push(`${item.id}:${group.label}`);
  }
  assert.deepEqual(dead, []);
});
