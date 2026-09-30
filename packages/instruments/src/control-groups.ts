import type { ControlGroup, InstrumentDefinition, Parameter } from "./types.js";
import { visibleParameters } from "./visibility.js";

/**
 * Control groups.
 *
 * Each instrument declares `controlGroups`: labelled clusters of related controls, in display
 * order, nested at most three deep. Every control belongs to exactly one group, so the tree is
 * the library's complete, opinionated organization of the inspector; hosts decide how to show it.
 *
 * A `proportional` group holds only numeric controls that measure one quantity in one unit with
 * zero meaning none, so scaling them together is a meaningful edit (footprint width and height,
 * paired line weights). Signed controls such as positions and angles cannot be proportional.
 *
 * Loading derives each control's `Parameter.group` path and reorders `parameters` to the group
 * order, so a consumer that only reads the flat list still sees contiguous sections.
 */
export const MAX_GROUP_DEPTH = 3;

type Values = InstrumentDefinition["defaults"];

/**
 * Throw a precise error if the groups are malformed or do not cover every control exactly once.
 * Accepts authored definitions and published ones: a control's `group` may be absent or equal to
 * the path its tree position derives, never anything else.
 */
export function validateControlGroups(item: Pick<InstrumentDefinition, "id" | "parameters" | "controlGroups">): void {
  const byKey = new Map(item.parameters.map((parameter) => [parameter.key, parameter]));
  const seen = new Map<string, string>();
  const where = `Instrument ${item.id} controlGroups`;
  if (!Array.isArray(item.controlGroups) || item.controlGroups.length === 0) throw new Error(`${where} must declare at least one group`);
  const visit = (groups: readonly ControlGroup[], parent: string, depth: number): void => {
    const labels = new Set<string>();
    for (const group of groups) {
      const label = group.label;
      if (typeof label !== "string" || label.trim() !== label || label === "" || label.includes("/"))
        throw new Error(`${where}: group label ${JSON.stringify(label)} under ${parent || "the root"} must be non-empty, trimmed and free of "/"`);
      if (labels.has(label)) throw new Error(`${where}: ${parent || "the root"} repeats group ${label}`);
      labels.add(label);
      const path = parent ? `${parent}/${label}` : label;
      if (depth > MAX_GROUP_DEPTH) throw new Error(`${where}: ${path} is nested deeper than ${MAX_GROUP_DEPTH} levels`);
      if (!Array.isArray(group.controls) || group.controls.length === 0) throw new Error(`${where}: ${path} has no controls`);
      for (const member of group.controls) {
        if (typeof member !== "string") continue;
        const parameter = byKey.get(member);
        if (!parameter) throw new Error(`${where}: ${path} names unknown control ${member}`);
        if (seen.has(member)) throw new Error(`${where}: control ${member} belongs to more than one group`);
        if (parameter.group !== undefined && parameter.group !== path)
          throw new Error(`${where}: control ${member} authors group ${JSON.stringify(parameter.group)}; declare it in controlGroups (derived: ${path})`);
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
      visit(group.controls.filter((member): member is ControlGroup => typeof member !== "string"), path, depth + 1);
    }
  };
  visit(item.controlGroups, "", 1);
  const missing = item.parameters.filter((parameter) => !seen.has(parameter.key)).map((parameter) => parameter.key);
  if (missing.length) throw new Error(`${where} leaves ${missing.join(", ")} ungrouped`);
}

/** Validate, then return the definition with `parameters` in group order and each `group` path set. */
export function resolveControlGroups(item: InstrumentDefinition): InstrumentDefinition {
  validateControlGroups(item);
  const byKey = new Map(item.parameters.map((parameter) => [parameter.key, parameter]));
  const parameters: Parameter[] = [];
  const visit = (groups: readonly ControlGroup[], parent: string): void => {
    for (const group of groups) {
      const path = parent ? `${parent}/${group.label}` : group.label;
      for (const member of group.controls) {
        if (typeof member === "string") parameters.push({ ...byKey.get(member)!, group: path });
        else visit([member], path);
      }
    }
  };
  visit(item.controlGroups, "");
  return { ...item, parameters };
}

export type InspectorItem =
  | { kind: "control"; parameter: Parameter }
  | { kind: "group"; label: string; path: string; proportional: boolean; items: InspectorItem[] };

/**
 * The inspector tree for these values: groups in declared order holding their visible controls
 * and subgroups. Hidden controls are omitted (see `visibility.ts`: alternatives, numeric
 * comparisons and effective visibility all apply); a group with nothing visible is omitted too.
 * A proportional group keeps its flag when only some members are visible.
 */
export function inspectorItems(item: InstrumentDefinition, values: Values): InspectorItem[] {
  const shown = new Map(visibleParameters(item, values).map((parameter) => [parameter.key, parameter]));
  const build = (group: ControlGroup, parent: string): InspectorItem | undefined => {
    const path = parent ? `${parent}/${group.label}` : group.label;
    const items: InspectorItem[] = [];
    for (const member of group.controls) {
      if (typeof member === "string") {
        const parameter = shown.get(member);
        if (parameter) items.push({ kind: "control", parameter });
      } else {
        const child = build(member, path);
        if (child) items.push(child);
      }
    }
    return items.length ? { kind: "group", label: group.label, path, proportional: group.proportional === true, items } : undefined;
  };
  return item.controlGroups.map((group) => build(group, "")).filter((entry): entry is InspectorItem => entry !== undefined);
}
