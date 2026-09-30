import type { ControlGroup, ControlStage, InstrumentDefinition, Parameter } from "./types.js";
import { visibleParameters } from "./visibility.js";

/**
 * Control groups.
 *
 * Each instrument declares `controlGroups`: labelled clusters of related controls, in display
 * order, nested at most three deep. Every control belongs to exactly one group, so the tree is
 * the library's complete, opinionated organization of the inspector; hosts decide how to show it.
 *
 * Every top-level group states its `stage`: what the artist is deciding with it. The stages form
 * a fixed, ordered vocabulary (`CONTROL_STAGES`), so a host can lay the groups out as a path from
 * deciding the form to framing the result. Nested groups belong to their parent's stage. Groups
 * of one stage need not be contiguous in declared order; `stageItems` collects them.
 *
 * A `proportional` group holds only numeric controls that measure one quantity in one unit with
 * zero meaning none, so scaling them together is a meaningful edit (footprint width and height,
 * paired line weights). Signed controls such as positions and angles cannot be proportional.
 *
 * Loading derives each control's `Parameter.group` path and `Parameter.stage` and reorders
 * `parameters` to the group order, so a consumer that only reads the flat list still sees
 * contiguous sections.
 */
export const MAX_GROUP_DEPTH = 3;

/** The stages in the order an artist usually decides them. */
export const CONTROL_STAGES: readonly { id: ControlStage; label: string; purpose: string }[] = [
  { id: "form", label: "Form", purpose: "What is built" },
  { id: "process", label: "Process", purpose: "How it develops" },
  { id: "material", label: "Material", purpose: "How it is drawn" },
  { id: "color", label: "Color", purpose: "Which colors it takes" },
  { id: "frame", label: "Frame", purpose: "Where it sits and how it is viewed" },
];
const STAGE_KNOWN: Record<string, true> = Object.fromEntries(CONTROL_STAGES.map((stage) => [stage.id, true]));

export const MAX_FEATURED = 4;

type Values = InstrumentDefinition["defaults"];

/**
 * Throw a precise error if the groups are malformed or do not cover every control exactly once.
 * Accepts authored definitions and published ones: a control's `group` and `stage` may be absent
 * or equal to what its tree position derives, never anything else.
 */
export function validateControlGroups(item: Pick<InstrumentDefinition, "id" | "parameters" | "controlGroups">): void {
  const byKey = new Map(item.parameters.map((parameter) => [parameter.key, parameter]));
  const seen = new Map<string, string>();
  const where = `Instrument ${item.id} controlGroups`;
  if (!Array.isArray(item.controlGroups) || item.controlGroups.length === 0) throw new Error(`${where} must declare at least one group`);
  const visit = (groups: readonly ControlGroup[], parent: string, depth: number, stage: ControlStage | undefined): void => {
    const labels = new Set<string>();
    for (const group of groups) {
      const label = group.label;
      if (typeof label !== "string" || label.trim() !== label || label === "" || label.includes("/"))
        throw new Error(`${where}: group label ${JSON.stringify(label)} under ${parent || "the root"} must be non-empty, trimmed and free of "/"`);
      if (labels.has(label)) throw new Error(`${where}: ${parent || "the root"} repeats group ${label}`);
      labels.add(label);
      const path = parent ? `${parent}/${label}` : label;
      if (depth > MAX_GROUP_DEPTH) throw new Error(`${where}: ${path} is nested deeper than ${MAX_GROUP_DEPTH} levels`);
      if (depth === 1) {
        if (group.stage === undefined) throw new Error(`${where}: top-level group ${path} must state its stage`);
        if (!STAGE_KNOWN[group.stage])
          throw new Error(`${where}: ${path} stage ${JSON.stringify(group.stage)} is not one of ${CONTROL_STAGES.map((entry) => entry.id).join(", ")}`);
      } else if (group.stage !== undefined) {
        throw new Error(`${where}: nested group ${path} cannot state a stage; it belongs to its top-level group's`);
      }
      const groupStage = depth === 1 ? group.stage! : stage!;
      if (!Array.isArray(group.controls) || group.controls.length === 0) throw new Error(`${where}: ${path} has no controls`);
      for (const member of group.controls) {
        if (typeof member !== "string") continue;
        const parameter = byKey.get(member);
        if (!parameter) throw new Error(`${where}: ${path} names unknown control ${member}`);
        if (seen.has(member)) throw new Error(`${where}: control ${member} belongs to more than one group`);
        if (parameter.group !== undefined && parameter.group !== path)
          throw new Error(`${where}: control ${member} authors group ${JSON.stringify(parameter.group)}; declare it in controlGroups (derived: ${path})`);
        if (parameter.stage !== undefined && parameter.stage !== groupStage)
          throw new Error(`${where}: control ${member} authors stage ${JSON.stringify(parameter.stage)}; declare it on its top-level group (derived: ${groupStage})`);
        seen.set(member, path);
      }
      if (group.proportional !== undefined) {
        if (group.proportional !== true) throw new Error(`${where}: ${path} proportional must be true or omitted`);
        if (group.controls.length < 2) throw new Error(`${where}: proportional ${path} needs at least two controls`);
        for (const member of group.controls) {
          if (typeof member !== "string") throw new Error(`${where}: proportional ${path} cannot contain a nested group`);
          const parameter = byKey.get(member)!;
          if (parameter.type !== "number") throw new Error(`${where}: proportional ${path} contains ${member}, which is not a number`);
          if ((parameter.hardMin ?? parameter.min!) < 0)
            throw new Error(`${where}: proportional ${path} contains ${member}, which can be negative`);
        }
      }
      visit(group.controls.filter((member): member is ControlGroup => typeof member !== "string"), path, depth + 1, groupStage);
    }
  };
  visit(item.controlGroups, "", 1, undefined);
  const missing = item.parameters.filter((parameter) => !seen.has(parameter.key)).map((parameter) => parameter.key);
  if (missing.length) throw new Error(`${where} leaves ${missing.join(", ")} ungrouped`);
}

/** Throw a precise error if `featured` names controls that do not exist, repeat, or cannot be a first-touch knob. */
export function validateFeatured(item: Pick<InstrumentDefinition, "id" | "parameters" | "featured">): void {
  if (item.featured === undefined) return;
  const where = `Instrument ${item.id} featured`;
  if (!Array.isArray(item.featured) || item.featured.length === 0 || item.featured.length > MAX_FEATURED)
    throw new Error(`${where} must list one to ${MAX_FEATURED} control keys`);
  const byKey = new Map(item.parameters.map((parameter) => [parameter.key, parameter]));
  const seen = new Set<string>();
  for (const key of item.featured) {
    const parameter = byKey.get(key);
    if (!parameter) throw new Error(`${where} names unknown control ${String(key)}`);
    if (seen.has(key)) throw new Error(`${where} repeats ${key}`);
    if (parameter.type !== "number" && parameter.type !== "select")
      throw new Error(`${where} names ${key}, which is a ${parameter.type}; only numbers and selects can be featured`);
    seen.add(key);
  }
}

/** Validate, then return the definition with `parameters` in group order and each `group` path and `stage` set. */
export function resolveControlGroups(item: InstrumentDefinition): InstrumentDefinition {
  validateControlGroups(item);
  validateFeatured(item);
  const byKey = new Map(item.parameters.map((parameter) => [parameter.key, parameter]));
  const parameters: Parameter[] = [];
  const visit = (groups: readonly ControlGroup[], parent: string, stage: ControlStage): void => {
    for (const group of groups) {
      const path = parent ? `${parent}/${group.label}` : group.label;
      for (const member of group.controls) {
        if (typeof member === "string") parameters.push({ ...byKey.get(member)!, group: path, stage });
        else visit([member], path, stage);
      }
    }
  };
  for (const group of item.controlGroups) visit([group], "", group.stage!);
  return { ...item, parameters };
}

export type InspectorItem =
  | { kind: "control"; parameter: Parameter }
  | { kind: "group"; label: string; path: string; stage: ControlStage; proportional: boolean; items: InspectorItem[] };

/** One stage of the inspector: its top-level groups, in declared order, holding their visible controls. */
export type StageItems = { stage: ControlStage; label: string; purpose: string; items: InspectorItem[] };

/**
 * The inspector tree for these values: groups in declared order holding their visible controls
 * and subgroups. Hidden controls are omitted (see `visibility.ts`: alternatives, numeric
 * comparisons and effective visibility all apply); a group with nothing visible is omitted too.
 * A proportional group keeps its flag when only some members are visible. Every group carries
 * the stage of its top-level ancestor.
 */
export function inspectorItems(item: InstrumentDefinition, values: Values): InspectorItem[] {
  const shown = new Map(visibleParameters(item, values).map((parameter) => [parameter.key, parameter]));
  const build = (group: ControlGroup, parent: string, stage: ControlStage): InspectorItem | undefined => {
    const path = parent ? `${parent}/${group.label}` : group.label;
    const items: InspectorItem[] = [];
    for (const member of group.controls) {
      if (typeof member === "string") {
        const parameter = shown.get(member);
        if (parameter) items.push({ kind: "control", parameter });
      } else {
        const child = build(member, path, stage);
        if (child) items.push(child);
      }
    }
    return items.length ? { kind: "group", label: group.label, path, stage, proportional: group.proportional === true, items } : undefined;
  };
  return item.controlGroups.map((group) => build(group, "", group.stage!)).filter((entry): entry is InspectorItem => entry !== undefined);
}

/**
 * The inspector tree bucketed by stage, in `CONTROL_STAGES` order: each stage holds its visible
 * top-level groups in declared order. Stages with nothing visible are omitted.
 */
export function stageItems(item: InstrumentDefinition, values: Values): StageItems[] {
  const groups = inspectorItems(item, values);
  return CONTROL_STAGES.flatMap(({ id, label, purpose }) => {
    const items = groups.filter((entry) => entry.kind === "group" && entry.stage === id);
    return items.length ? [{ stage: id, label, purpose, items }] : [];
  });
}
