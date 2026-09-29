import type { InstrumentDefinition, Parameter } from "./types.js";

/**
 * Conditional controls.
 *
 * `Parameter.visibleWhen` names the controls a parameter depends on. It is a conjunction: every
 * named driver must currently hold one of its allowed values. Drivers must be `select` or
 * `boolean` controls of the same instrument, so a condition always reads a discrete choice the
 * artist made. A control is *effectively* visible only when its own condition holds and every
 * driver it names is itself effectively visible, so a chain of dependencies never needs to be
 * flattened by hand and a control can never appear under a hidden choice.
 *
 * Hidden controls keep their values and stay valid; only their inspector row is hidden. The
 * guarantee this contract makes, and the property tests check, is the converse: while a control
 * is hidden, changing it does not change what is drawn.
 */
type Values = InstrumentDefinition["defaults"];

function driverOf(item: InstrumentDefinition, key: string): Parameter | undefined {
  return item.parameters.find((parameter) => parameter.key === key);
}

/** Throw a precise error if any condition is malformed, self-referential, cyclic or unsatisfiable. */
export function validateVisibility(item: InstrumentDefinition): void {
  const edges = new Map<string, string[]>();
  for (const parameter of item.parameters) {
    const condition = parameter.visibleWhen;
    if (condition === undefined) continue;
    const where = `Instrument ${item.id} control ${parameter.key} visibleWhen`;
    const keys = Object.keys(condition);
    if (keys.length === 0) throw new Error(`${where} must name at least one control`);
    for (const key of keys) {
      if (key === parameter.key) throw new Error(`${where} cannot depend on itself`);
      const driver = driverOf(item, key);
      if (!driver) throw new Error(`${where} names unknown control ${key}`);
      if (driver.type !== "select" && driver.type !== "boolean")
        throw new Error(`${where} may only depend on a select or boolean control, not ${key} (${driver.type})`);
      const allowed = condition[key];
      if (!Array.isArray(allowed) || allowed.length === 0) throw new Error(`${where}.${key} must list at least one value`);
      if (new Set(allowed).size !== allowed.length) throw new Error(`${where}.${key} repeats a value`);
      const legal: readonly (string | boolean)[] = driver.type === "boolean"
        ? [true, false] : (driver.options ?? []).map((option) => option.value);
      for (const value of allowed)
        if (!legal.includes(value as string | boolean)) throw new Error(`${where}.${key} lists ${JSON.stringify(value)}, which ${key} cannot take`);
      if (legal.every((value) => allowed.includes(value)))
        throw new Error(`${where}.${key} allows every value of ${key}; drop the condition`);
    }
    edges.set(parameter.key, keys);
  }
  // Depth-first cycle check over the dependency graph.
  const state = new Map<string, 1 | 2>();
  const visit = (key: string, path: string[]): void => {
    if (state.get(key) === 2) return;
    if (state.get(key) === 1) throw new Error(`Instrument ${item.id} has a visibleWhen cycle: ${[...path, key].join(" -> ")}`);
    state.set(key, 1);
    for (const next of edges.get(key) ?? []) visit(next, [...path, key]);
    state.set(key, 2);
  };
  for (const key of edges.keys()) visit(key, []);
}

/** The controls the inspector should show for these values, in definition order. */
export function visibleParameters(item: InstrumentDefinition, values: Values): Parameter[] {
  const shown = new Map<string, boolean>();
  const isShown = (parameter: Parameter): boolean => {
    const known = shown.get(parameter.key);
    if (known !== undefined) return known;
    const condition = parameter.visibleWhen;
    let visible = true;
    if (condition) for (const [key, allowed] of Object.entries(condition)) {
      const driver = driverOf(item, key);
      if (!driver || !isShown(driver) || !allowed.some((value) => value === values[key])) { visible = false; break; }
    }
    shown.set(parameter.key, visible);
    return visible;
  };
  return item.parameters.filter(isShown);
}
