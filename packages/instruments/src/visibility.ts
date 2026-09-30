import type { InstrumentDefinition, NumberComparison, Parameter, VisibilityCondition, VisibleWhen } from "./types.js";

/**
 * Conditional controls.
 *
 * `Parameter.visibleWhen` names the controls a parameter depends on. It is either one
 * *alternative* (an object) or a non-empty array of alternatives that mean "shown if ANY of them
 * holds". An alternative is a conjunction: every driver it names must currently satisfy its entry.
 *
 * - A `select` or `boolean` driver's entry is a list of allowed values: `{ material: ["beads"] }`.
 * - A `number` driver's entry is a comparison object using `lt`, `lte`, `gt`, `gte`, `eq`, `ne`
 *   with finite numbers, one operator or one lower bound (`gt`/`gte`) with one upper bound
 *   (`lt`/`lte`): `{ retained: { lt: 1 } }`, `{ passes: { gte: 2, lt: 8 } }`. Text controls are
 *   never drivers. A number that is not a finite number holds no comparison.
 *
 * Effective visibility is the LEAST FIXPOINT of one rule: a control with no condition is shown; a
 * control with a condition is shown when at least one of its alternatives holds against the
 * current values AND every driver that alternative names is itself shown. An alternative whose
 * driver is hidden therefore counts for nothing, so a chain of dependencies never needs
 * flattening and a control can never appear under a hidden choice. `validateVisibility` rejects
 * cycles over the union of every alternative's edges; on a validated instrument the fixpoint
 * equals the obvious recursion, and on an unvalidated cyclic one controls that only justify each
 * other stay hidden.
 *
 * Hidden controls keep their values and stay valid; only their inspector row is hidden. The
 * guarantee this contract makes, and the property tests check, is the converse: while a control
 * is hidden, changing it does not change what is drawn.
 *
 * A host must call `visibleParameters`, `controlIsVisible` or `inspectorItems` and not re-derive
 * the rule: `visibleWhen` may be an array, comparisons are not value lists, and a satisfied
 * alternative is not enough while one of its drivers is hidden.
 */
type Values = InstrumentDefinition["defaults"];
type Entry = VisibilityCondition[string];
type Scalar = string | number | boolean;

const OPERATORS = ["lt", "lte", "gt", "gte", "eq", "ne"] as const;
type Operator = (typeof OPERATORS)[number];
const LOWER: readonly Operator[] = ["gt", "gte"], UPPER: readonly Operator[] = ["lt", "lte"];
/** Most cell combinations `validateVisibility` will enumerate when checking that alternatives are not jointly tautological. */
const MAX_COMBINATIONS = 50_000;

function driverOf(item: Pick<InstrumentDefinition, "parameters">, key: string): Parameter | undefined {
  return item.parameters.find((parameter) => parameter.key === key);
}

/** The alternatives of a condition: `[]` when the control is unconditional, otherwise one or more conjunctions. */
export function visibilityAlternatives(parameter: Pick<Parameter, "visibleWhen">): readonly VisibilityCondition[] {
  const condition = parameter.visibleWhen;
  if (condition === undefined) return [];
  return Array.isArray(condition) ? condition as readonly VisibilityCondition[] : [condition as VisibilityCondition];
}

/** Every driver named by any alternative of this control's condition, in first-seen order. */
export function visibilityDrivers(parameter: Pick<Parameter, "visibleWhen">): string[] {
  const seen = new Set<string>();
  for (const alternative of visibilityAlternatives(parameter)) for (const key of Object.keys(alternative)) seen.add(key);
  return [...seen];
}

function isComparison(entry: unknown): entry is NumberComparison {
  return entry !== null && typeof entry === "object" && !Array.isArray(entry);
}

function comparisonHolds(comparison: NumberComparison, value: number): boolean {
  return (comparison.lt === undefined || value < comparison.lt) && (comparison.lte === undefined || value <= comparison.lte)
    && (comparison.gt === undefined || value > comparison.gt) && (comparison.gte === undefined || value >= comparison.gte)
    && (comparison.eq === undefined || value === comparison.eq) && (comparison.ne === undefined || value !== comparison.ne);
}

function entryHolds(entry: Entry, value: unknown): boolean {
  if (isComparison(entry)) return typeof value === "number" && Number.isFinite(value) && comparisonHolds(entry, value);
  return (entry as readonly Scalar[]).some((allowed) => allowed === value);
}

function alternativeHolds(alternative: VisibilityCondition, values: Values): boolean {
  for (const key of Object.keys(alternative)) if (!entryHolds(alternative[key], values[key])) return false;
  return true;
}

/** A number control's admissible values: its hard range and whether it takes integers only. */
function numberDomain(driver: Parameter): { low: number; high: number; integer: boolean } {
  return { low: driver.hardMin ?? driver.min!, high: driver.hardMax ?? driver.max!, integer: driver.integer ?? driver.step === 1 };
}

/**
 * Representative values of a number control: a condition built from these literals is constant
 * between consecutive literals, so probing every literal, every gap between literals and the ends
 * of the range decides whether it can hold, always holds, or is contained in another.
 */
function numberCells(driver: Parameter, comparisons: readonly NumberComparison[]): number[] {
  const { low, high, integer } = numberDomain(driver);
  const literals = new Set<number>([low, high]);
  for (const comparison of comparisons) for (const operator of OPERATORS) {
    const literal = comparison[operator];
    if (literal !== undefined && literal >= low && literal <= high) literals.add(literal);
  }
  const sorted = [...literals].sort((a, b) => a - b);
  const cells = new Set<number>(sorted);
  if (!integer) {
    for (let index = 1; index < sorted.length; index++) cells.add((sorted[index - 1] + sorted[index]) / 2);
    return [...cells];
  }
  const first = Math.ceil(low), last = Math.floor(high);
  const integers = new Set<number>([first, last]);
  for (const literal of sorted) for (let offset = -1; offset <= 1; offset++) {
    integers.add(Math.floor(literal) + offset); integers.add(Math.ceil(literal) + offset);
  }
  return [...integers].filter((value) => value >= first && value <= last);
}

function cellsFor(driver: Parameter, entries: readonly Entry[]): Scalar[] {
  if (driver.type === "boolean") return [true, false];
  if (driver.type === "select") return (driver.options ?? []).map((option) => option.value);
  return numberCells(driver, entries.filter(isComparison));
}

function describeEntry(entry: Entry): string {
  return isComparison(entry) ? OPERATORS.filter((operator) => entry[operator] !== undefined).map((operator) => `${operator} ${entry[operator]}`).join(" and ")
    : (entry as readonly Scalar[]).map((value) => JSON.stringify(value)).join(", ");
}

function validateEntry(where: string, driver: Parameter, key: string, entry: unknown): void {
  const here = `${where}.${key}`;
  if (driver.type === "number") {
    if (!isComparison(entry)) throw new Error(`${here} must be a comparison such as { gte: 1 }, not a value list, because ${key} is a number control`);
    const present = Object.keys(entry);
    if (present.length === 0) throw new Error(`${here} must state at least one of ${OPERATORS.join(", ")}`);
    for (const operator of present) {
      if (!(OPERATORS as readonly string[]).includes(operator)) throw new Error(`${here} has unknown operator ${JSON.stringify(operator)}; use ${OPERATORS.join(", ")}`);
      const literal = (entry as Record<string, unknown>)[operator];
      if (typeof literal !== "number" || !Number.isFinite(literal)) throw new Error(`${here}.${operator} must be a finite number`);
    }
    const used = present as Operator[];
    const lower = used.filter((operator) => LOWER.includes(operator)), upper = used.filter((operator) => UPPER.includes(operator));
    if (used.length > 2 || (used.length === 2 && !(lower.length === 1 && upper.length === 1)))
      throw new Error(`${here} cannot combine ${used.join(" and ")}; use one operator, or one lower bound (gt, gte) with one upper bound (lt, lte)`);
    const { low, high } = numberDomain(driver);
    for (const operator of used) {
      const literal = entry[operator]!;
      if (literal < low || literal > high) throw new Error(`${here}.${operator} (${literal}) is outside ${key}'s hard range ${low} to ${high}`);
    }
    if (lower.length === 1 && upper.length === 1) {
      const from = entry[lower[0]]!, to = entry[upper[0]]!;
      if (from > to || (from === to && (lower[0] === "gt" || upper[0] === "lt")))
        throw new Error(`${here} is contradictory: ${lower[0]} ${from} with ${upper[0]} ${to} holds for no value`);
    }
    const cells = numberCells(driver, [entry]).map((cell) => comparisonHolds(entry, cell));
    if (!cells.some(Boolean)) throw new Error(`${here} (${describeEntry(entry)}) can never hold: ${key} ranges over ${low} to ${high}${numberDomain(driver).integer ? " in whole numbers" : ""}`);
    if (cells.every(Boolean)) throw new Error(`${here} allows every value of ${key}; drop the condition`);
    return;
  }
  if (isComparison(entry)) throw new Error(`${here} is a comparison, but ${key} is a ${driver.type} control; comparisons only apply to number controls`);
  if (!Array.isArray(entry) || entry.length === 0) throw new Error(`${here} must list at least one value`);
  if (new Set(entry).size !== entry.length) throw new Error(`${here} repeats a value`);
  const legal: readonly Scalar[] = driver.type === "boolean" ? [true, false] : (driver.options ?? []).map((option) => option.value);
  for (const value of entry)
    if (!legal.includes(value as Scalar)) throw new Error(`${here} lists ${JSON.stringify(value)}, which ${key} cannot take`);
  if (legal.every((value) => (entry as readonly Scalar[]).includes(value))) throw new Error(`${here} allows every value of ${key}; drop the condition`);
}

/** Whether every value an alternative can hold at is also accepted by `outer`. */
function contained(item: InstrumentDefinition, inner: VisibilityCondition, outer: VisibilityCondition): boolean {
  for (const key of Object.keys(outer)) {
    if (!(key in inner)) return false; // the outer entry restricts this driver (it never allows every value), the inner does not
    const driver = driverOf(item, key)!;
    if (!cellsFor(driver, [inner[key], outer[key]]).every((cell) => !entryHolds(inner[key], cell) || entryHolds(outer[key], cell))) return false;
  }
  return true;
}

const sameEntry = (a: Entry, b: Entry): boolean => isComparison(a) || isComparison(b)
  ? isComparison(a) && isComparison(b) && OPERATORS.every((operator) => a[operator] === b[operator])
  : a.length === b.length && a.every((value) => b.includes(value));
const sameAlternative = (a: VisibilityCondition, b: VisibilityCondition): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => key in b && sameEntry(a[key], b[key]));
};

/**
 * Throw a precise error if any condition is malformed, self-referential, cyclic, unsatisfiable,
 * tautological or redundant. Every check reads the whole instrument, so it reports the first
 * problem with the instrument, control, alternative and driver named.
 */
export function validateVisibility(item: InstrumentDefinition): void {
  const edges = new Map<string, string[]>();
  for (const parameter of item.parameters) {
    const condition = parameter.visibleWhen as unknown;
    if (condition === undefined) continue;
    const where = `Instrument ${item.id} control ${parameter.key} visibleWhen`;
    const many = Array.isArray(condition);
    if (many && condition.length === 0) throw new Error(`${where} must list at least one alternative`);
    if (condition === null || typeof condition !== "object") throw new Error(`${where} must be an object or a non-empty array of objects`);
    const alternatives = (many ? condition : [condition]) as VisibilityCondition[];
    const drivers = new Set<string>();
    alternatives.forEach((alternative, index) => {
      const here = many ? `${where}[${index}]` : where;
      if (alternative === null || typeof alternative !== "object" || Array.isArray(alternative))
        throw new Error(`${here} must be an object mapping control keys to allowed values or comparisons`);
      const keys = Object.keys(alternative);
      if (keys.length === 0) throw new Error(`${here} must name at least one control`);
      for (const key of keys) {
        if (key === parameter.key) throw new Error(`${here} cannot depend on itself`);
        const driver = driverOf(item, key);
        if (!driver) throw new Error(`${here} names unknown control ${key}`);
        if (driver.type === "text") throw new Error(`${here} may only depend on a select, boolean or number control, not ${key} (text)`);
        validateEntry(here, driver, key, alternative[key]);
        drivers.add(key);
      }
    });
    for (let later = 1; later < alternatives.length; later++) for (let earlier = 0; earlier < later; earlier++)
      if (sameAlternative(alternatives[earlier], alternatives[later]))
        throw new Error(`${where} alternatives [${earlier}] and [${later}] are identical`);
    for (let inner = 0; inner < alternatives.length; inner++) for (let outer = 0; outer < alternatives.length; outer++)
      if (inner !== outer && contained(item, alternatives[inner], alternatives[outer]))
        throw new Error(`${where}[${inner}] is redundant: [${outer}] already shows the control whenever it holds`);
    if (alternatives.length > 1) {
      const keys = [...drivers];
      const cells = keys.map((key) => cellsFor(driverOf(item, key)!, alternatives.flatMap((alternative) => key in alternative ? [alternative[key]] : [])));
      if (cells.reduce((product, list) => product * list.length, 1) <= MAX_COMBINATIONS) {
        const every = (position: number, chosen: Record<string, Scalar>): boolean => position === keys.length
          ? alternatives.some((alternative) => alternativeHolds(alternative, chosen))
          : cells[position].every((cell) => every(position + 1, { ...chosen, [keys[position]]: cell }));
        if (every(0, {})) throw new Error(`${where} alternatives together allow every combination of ${keys.join(", ")}; drop the condition`);
      }
    }
    edges.set(parameter.key, [...drivers]);
  }
  // Depth-first cycle check over the union of every alternative's edges.
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

/** Keys of every effectively visible control: the least fixpoint described above. */
function shownKeys(item: Pick<InstrumentDefinition, "parameters">, values: Values): Set<string> {
  const shown = new Set<string>();
  const pending = item.parameters.filter((parameter) => {
    if (parameter.visibleWhen === undefined) { shown.add(parameter.key); return false; }
    return true;
  });
  for (let changed = true; changed && pending.length > 0;) {
    changed = false;
    for (let index = pending.length - 1; index >= 0; index--) {
      const parameter = pending[index];
      const visible = visibilityAlternatives(parameter).some((alternative) =>
        Object.keys(alternative).every((key) => shown.has(key)) && alternativeHolds(alternative, values));
      if (visible) { shown.add(parameter.key); pending.splice(index, 1); changed = true; }
    }
  }
  return shown;
}

/** The controls the inspector should show for these values, in definition order. */
export function visibleParameters(item: Pick<InstrumentDefinition, "parameters">, values: Values): Parameter[] {
  const shown = shownKeys(item, values);
  return item.parameters.filter((parameter) => shown.has(parameter.key));
}

/** Whether the named control is effectively visible for these values; throws for a key the instrument does not have. */
export function controlIsVisible(item: Pick<InstrumentDefinition, "parameters">, key: string, values: Values): boolean {
  if (!driverOf(item, key)) throw new Error(`Unknown control ${key}`);
  return shownKeys(item, values).has(key);
}

export type { NumberComparison, VisibilityCondition, VisibleWhen };
