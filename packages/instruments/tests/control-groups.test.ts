import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTROL_STAGES, createInstrument, definitions, featuredControls, inspectorItems, stageItems, validateControlGroups, validateFeatured, visibilityDrivers, visibleParameters,
  type ControlGroup, type ControlStage, type InspectorItem, type InstrumentDefinition, type Parameter,
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
  rejects([a, b], [{ label: "One", stage: "form", controls: ["a"] }], /leaves b ungrouped/);
  rejects([a, b], [{ label: "One", stage: "form", controls: ["a", "b"] }, { label: "Two", stage: "form", controls: ["a"] }], /a belongs to more than one group/);
  rejects([a, b], [{ label: "One", stage: "form", controls: ["a", "b", "c"] }], /unknown control c/);
  rejects([{ ...a, group: "Other" }, b], [{ label: "One", stage: "form", controls: ["a", "b"] }], /control a authors group "Other"/);
  rejects([a, b], [{ label: "One", stage: "form", controls: "ab" as unknown as string[] }], /One has no controls/);
  // A published definition (group already derived) validates again.
  validateControlGroups(probe([{ ...a, group: "One" }, b], [{ label: "One", stage: "form", controls: ["a", "b"] }]));
  rejects([a, b], [{ label: "One", stage: "form", controls: ["a", "b"] }, { label: "Two", stage: "form", controls: [] }], /Two has no controls/);
  rejects([a, b], [], /at least one group/);
});

test("labels are unique among siblings, free of the path separator, and nest at most three deep", () => {
  const [a, b] = [length("a"), length("b")];
  rejects([a, b], [{ label: "One", stage: "form", controls: ["a"] }, { label: "One", stage: "form", controls: ["b"] }], /repeats group One/);
  rejects([a, b], [{ label: "A/B", stage: "form", controls: ["a", "b"] }], /free of "\/"/);
  rejects([a, b], [{ label: " One", stage: "form", controls: ["a", "b"] }], /trimmed/);
  rejects([a, b], [{ label: "1", stage: "form", controls: ["a", { label: "2", controls: [{ label: "3", controls: [{ label: "4", controls: ["b"] }] }] }] }],
    /1\/2\/3\/4 is nested deeper than 3/);
  // The same label under different parents is fine.
  validateControlGroups(probe([a, b], [{ label: "One", stage: "form", controls: [{ label: "Size", controls: ["a"] }] }, { label: "Two", stage: "form", controls: [{ label: "Size", controls: ["b"] }] }]));
});

test("proportional groups hold two or more non-negative numbers and nothing else", () => {
  const [a, b] = [length("a"), length("b")];
  rejects([a, b], [{ label: "Size", stage: "form", controls: ["a"], proportional: true }, { label: "Rest", stage: "form", controls: ["b"] }], /at least two controls/);
  rejects([a, select("b", ["x", "y"])], [{ label: "Size", stage: "form", controls: ["a", "b"], proportional: true }], /b, which is not a number/);
  rejects([a, length("b", { min: 0, hardMin: -10 })], [{ label: "Size", stage: "form", controls: ["a", "b"], proportional: true }], /b, which can be negative/);
  rejects([a, b, length("c")], [{ label: "Size", stage: "form", controls: ["a", "b", { label: "Inner", controls: ["c"] }], proportional: true }], /cannot contain a nested group/);
  validateControlGroups(probe([a, b], [{ label: "Size", stage: "form", controls: ["a", "b"], proportional: true }]));
});

test("resolution orders controls by group and derives each slash path", () => {
  const resolved = resolveControlGroups(probe([length("w"), select("mode", ["x", "y"]), length("h"), length("gap")], [
    { label: "Form", stage: "form", controls: ["mode", { label: "Size", controls: ["w", "h"], proportional: true }, "gap"] },
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

test("every top-level group states one of the ordered stages; nested groups inherit it", () => {
  const [a, b] = [length("a"), length("b")];
  rejects([a, b], [{ label: "One", controls: ["a", "b"] } as ControlGroup], /top-level group One must state its stage/);
  rejects([a, b], [{ label: "One", stage: "shape" as ControlStage, controls: ["a", "b"] }], /stage "shape" is not one of form, process, material, color, frame/);
  rejects([a, b], [{ label: "One", stage: "form", controls: ["a", { label: "Inner", stage: "form", controls: ["b"] }] }], /nested group One\/Inner cannot state a stage/);
  rejects([{ ...a, stage: "material" }, b], [{ label: "One", stage: "form", controls: ["a", "b"] }], /control a authors stage "material"/);
  assert.deepEqual(CONTROL_STAGES.map((stage) => stage.id), ["form", "process", "material", "color", "frame"]);
  const resolved = resolveControlGroups(probe([a, b, length("c")], [
    { label: "Marks", stage: "material", controls: ["a", { label: "Scale", controls: ["b"] }] },
    { label: "Sites", stage: "form", controls: ["c"] },
  ]));
  assert.deepEqual(resolved.parameters.map((parameter) => [parameter.key, parameter.stage]), [["a", "material"], ["b", "material"], ["c", "form"]]);
});

test("stageItems buckets the visible tree by stage order, keeping declared order inside a stage and omitting empty stages", () => {
  const input = createInstrument("cell-mosaic");
  const stages = stageItems("cell-mosaic", input.params);
  assert.deepEqual(stages.map((stage) => stage.stage), ["form", "process", "material", "frame"]);
  const labels = Object.fromEntries(stages.map((stage) => [stage.stage, stage.items.map((item) => item.kind === "group" ? item.label : item.parameter.key)]));
  assert.deepEqual(labels.form, ["Sites", "Cells"]);
  assert.deepEqual(labels.frame, ["Placement"]);
  assert.ok(stages.every((stage) => stage.items.every((item) => item.kind === "group" && item.stage === stage.stage)));
  // A stage whose only group hides every control disappears with it.
  const lace = createInstrument("crossing-lace");
  const noDiagnostics = stageItems("crossing-lace", { ...lace.params, overlay: "none" });
  assert.ok(!noDiagnostics.some((stage) => stage.items.some((item) => item.kind === "group" && item.label === "Diagnostics")) ||
    inspectorItems("crossing-lace", { ...lace.params, overlay: "none" }).some((item) => item.kind === "group" && item.label === "Diagnostics"));
});

test("featured controls are one to four existing numbers or selects, and fall back to the first form group", () => {
  const [a, b] = [length("a"), select("b", ["x", "y"])];
  const groups: ControlGroup[] = [{ label: "One", stage: "form", controls: ["a", "b"] }];
  const featuredProbe = (featured: string[]) => ({ ...probe([a, b], groups), featured });
  assert.throws(() => validateFeatured(featuredProbe([])), /one to 4 control keys/);
  assert.throws(() => validateFeatured(featuredProbe(["a", "b", "a"])), /repeats a/);
  assert.throws(() => validateFeatured(featuredProbe(["zzz"])), /unknown control zzz/);
  const toggle: Parameter = { key: "t", label: "t", description: "t", type: "boolean" };
  assert.throws(() => validateFeatured({ id: "probe", parameters: [a, b, toggle], featured: ["t"] }), /t, which is a boolean/);
  validateFeatured(featuredProbe(["b", "a"]));
  for (const item of definitions) {
    const featured = featuredControls(item.id);
    assert.ok(featured.length >= 1 && featured.length <= 4, `${item.id} has ${featured.length} featured controls`);
    for (const parameter of featured) assert.ok(parameter.type === "number" || parameter.type === "select", `${item.id} features ${parameter.key}`);
    if (!item.featured) for (const parameter of featured) assert.equal(parameter.stage, "form", `${item.id} fallback ${parameter.key} is not a form control`);
  }
});

test("every published definition re-validates", () => {
  for (const item of definitions) validateControlGroups(item);
});

test("a proportional group has some reachable setting where two or more of its members are visible", () => {
  // A number driver is tried at its default and both range ends, which is where a threshold sits.
  const combos = (drivers: Parameter[], defaults: InstrumentDefinition["defaults"]): Record<string, string | number | boolean>[] => drivers.reduce<Record<string, string | number | boolean>[]>(
    (acc, driver) => acc.flatMap((base) => (driver.type === "boolean" ? [true, false] : driver.type === "number"
      ? [...new Set([defaults[driver.key] as number, driver.hardMin ?? driver.min!, driver.hardMax ?? driver.max!])] : driver.options!.map((o) => o.value)).map((value) => ({ ...base, [driver.key]: value }))), [{}]);
  const walk = (groups: readonly ControlGroup[]): ControlGroup[] =>
    groups.flatMap((g) => [g, ...walk(g.controls.filter((m): m is ControlGroup => typeof m !== "string"))]);
  const dead: string[] = [];
  for (const item of definitions) for (const group of walk(item.controlGroups)) {
    if (!group.proportional) continue;
    const members = group.controls as string[];
    const drivers = new Set<string>();
    for (const key of members) for (const k of visibilityDrivers(item.parameters.find((p) => p.key === key)!)) drivers.add(k);
    // Drivers of drivers matter for effective visibility.
    for (let grew = true; grew;) { grew = false; for (const k of [...drivers]) for (const d of visibilityDrivers(item.parameters.find((p) => p.key === k)!)) if (!drivers.has(d)) { drivers.add(d); grew = true; } }
    const list = combos([...drivers].map((k) => item.parameters.find((p) => p.key === k)!), item.defaults);
    const ok = list.some((choice) => {
      const shown = new Set(visibleParameters(item.id, { ...item.defaults, ...choice }).map((p) => p.key));
      return members.filter((key) => shown.has(key)).length >= 2;
    });
    if (!ok) dead.push(`${item.id}:${group.label}`);
  }
  assert.deepEqual(dead, []);
});
