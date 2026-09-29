/**
 * Owned tabular data and the named, pure mappings that turn its columns into typed attributes.
 *
 * - A `DataTable` is resolved, immutable input: typed columns of equal length, never a URL and
 *   never fetched. Host-supplied binding of a user's own table is future host work; the library
 *   accepts the resolved value (`dataTable`) and the same JSON-compatible `DataTableInput` that
 *   a persisted recipe stores, so a reload replays the recorded values.
 * - A column is `continuous` (finite numbers) or `categorical` (an explicit ordered category
 *   list). The two are never converted implicitly: a measure channel refuses a categorical
 *   column, a category channel refuses a continuous one, and aggregation only ever applies
 *   numeric functions to continuous columns. A missing value is `null` and stays `null`.
 * - `buildUnits` selects rows by a temporal window and optionally merges them into one unit per
 *   category (`aggregate`). `resolveData` maps units to channels (`measure`, `quantity`,
 *   `category`) under an explicit missing-value policy and returns the attributes together with
 *   the mapping that produced them.
 *
 * All functions are pure. Results are deeply frozen and cached by construction (table content
 * hash plus options), so appearance-only edits never recompute them.
 */
import { memoized } from "./sources.js";

/** Bounds keep every table small enough to lay out and draw within the composition budget. */
export const MAX_TABLE_ROWS = 2000;
export const MAX_TABLE_COLUMNS = 24;
export const MAX_CATEGORIES = 64;

export interface ContinuousColumn {
  readonly name: string;
  readonly kind: "continuous";
  /** Free-text unit label for keys; carries no arithmetic meaning. */
  readonly unit: string;
  /** Finite numbers; `null` marks a missing value. */
  readonly values: readonly (number | null)[];
}
export interface CategoricalColumn {
  readonly name: string;
  readonly kind: "categorical";
  /** Distinct, non-empty, in their intended order. The order is the category's class index. */
  readonly categories: readonly string[];
  /** One of `categories`, or `null` for a missing value. */
  readonly values: readonly (string | null)[];
}
export type Column = ContinuousColumn | CategoricalColumn;

export type ColumnInput =
  | { name: string; kind: "continuous"; unit?: string; values: readonly (number | null)[] }
  | { name: string; kind: "categorical"; categories: readonly string[]; values: readonly (string | null)[] };
/** JSON-compatible table value; this is what a persisted recipe stores. */
export interface DataTableInput {
  id: string;
  title?: string;
  /** Distinct row identities; default `row:<index>`. Units keep these ids, so edits never rename them. */
  rowIds?: readonly string[];
  columns: readonly ColumnInput[];
}
export interface DataTable {
  readonly id: string;
  readonly title: string;
  readonly rows: number;
  readonly rowIds: readonly string[];
  readonly columns: readonly Column[];
  /** Content hash (64 bits, hex) of everything above; cache identity for derived values. */
  readonly key: string;
}

const made = new WeakSet<object>();

function hash(text: string): string {
  let a = 0x811c9dc5, b = 0x9e3779b9;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b + code, 0x85ebca6b) ^ (b >>> 13);
    b >>>= 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

/**
 * Validate and freeze a table. Errors name the table, column and row (by id) they concern.
 * A value already produced by this function is returned unchanged.
 */
export function dataTable(input: DataTableInput | DataTable): DataTable {
  if (made.has(input)) return input as DataTable;
  const source = input as DataTableInput;
  const id = source.id;
  if (typeof id !== "string" || id.length === 0) throw new Error("Data table needs a non-empty id");
  const label = `Data table "${id}"`;
  if (!Array.isArray(source.columns) || source.columns.length === 0) throw new Error(`${label} needs at least one column`);
  if (source.columns.length > MAX_TABLE_COLUMNS) throw new Error(`${label} has ${source.columns.length} columns; the limit is ${MAX_TABLE_COLUMNS}`);
  const rows = source.columns[0].values.length;
  if (!Number.isSafeInteger(rows) || rows > MAX_TABLE_ROWS) throw new Error(`${label} has ${rows} rows; the limit is ${MAX_TABLE_ROWS}`);
  const rowIds = source.rowIds ? [...source.rowIds] : Array.from({ length: rows }, (_, index) => `row:${index}`);
  if (rowIds.length !== rows) throw new Error(`${label} has ${rows} rows but ${rowIds.length} row ids`);
  const seenRows = new Set<string>();
  for (const rowId of rowIds) {
    if (typeof rowId !== "string" || rowId.length === 0) throw new Error(`${label} row ids must be non-empty strings`);
    if (seenRows.has(rowId)) throw new Error(`${label} repeats row id "${rowId}"`);
    seenRows.add(rowId);
  }
  const names = new Set<string>();
  const columns = source.columns.map((column): Column => {
    const name = column.name;
    if (typeof name !== "string" || name.length === 0) throw new Error(`${label} has a column without a name`);
    if (names.has(name)) throw new Error(`${label} repeats column "${name}"`);
    names.add(name);
    if (!Array.isArray(column.values) || column.values.length !== rows)
      throw new Error(`${label} column "${name}" has ${Array.isArray(column.values) ? column.values.length : "no"} values; expected ${rows}`);
    if (column.kind === "continuous") {
      column.values.forEach((value: number | null, row: number) => {
        if (value !== null && (typeof value !== "number" || !Number.isFinite(value)))
          throw new Error(`${label} column "${name}" row "${rowIds[row]}": ${String(value)} is not a finite number or null`);
      });
      return Object.freeze({ name, kind: "continuous" as const, unit: column.unit ?? "", values: Object.freeze([...column.values]) });
    }
    if (column.kind !== "categorical") throw new Error(`${label} column "${name}" must be "continuous" or "categorical"`);
    const categories = column.categories;
    if (!Array.isArray(categories) || categories.length === 0 || categories.length > MAX_CATEGORIES)
      throw new Error(`${label} column "${name}" needs 1 to ${MAX_CATEGORIES} categories`);
    if (categories.some((category) => typeof category !== "string" || category.length === 0) || new Set(categories).size !== categories.length)
      throw new Error(`${label} column "${name}" categories must be distinct non-empty strings`);
    const known = new Set(categories);
    column.values.forEach((value: string | null, row: number) => {
      if (value !== null && !known.has(value as string))
        throw new Error(`${label} column "${name}" row "${rowIds[row]}": "${String(value)}" is not one of its categories`);
    });
    return Object.freeze({ name, kind: "categorical" as const, categories: Object.freeze([...categories]),
      values: Object.freeze([...column.values as readonly (string | null)[]]) });
  });
  const title = source.title ?? id;
  const key = hash(JSON.stringify([id, title, rowIds, columns]));
  const table: DataTable = Object.freeze({ id, title, rows, rowIds: Object.freeze(rowIds),
    columns: Object.freeze(columns), key });
  made.add(table);
  return table;
}

export function column(table: DataTable, name: string): Column {
  const found = table.columns.find((item) => item.name === name);
  if (!found) throw new Error(`Data table "${table.id}" has no column "${name}"`);
  return found;
}
export function continuousColumn(table: DataTable, name: string): ContinuousColumn {
  const found = column(table, name);
  if (found.kind !== "continuous")
    throw new Error(`Column "${name}" is categorical; a measure needs a continuous column (categories are never read as numbers)`);
  return found;
}
export function categoricalColumn(table: DataTable, name: string): CategoricalColumn {
  const found = column(table, name);
  if (found.kind !== "categorical")
    throw new Error(`Column "${name}" is continuous; categories cannot be read from it (no implicit binning)`);
  return found;
}

/**
 * The smallest and largest present value. A constant column has no extent, so it is widened
 * symmetrically by 0.5: its value maps to the middle of the domain. A column with no present
 * value has no extent at all, which is an error.
 */
export function measureExtent(source: ContinuousColumn): readonly [number, number] {
  let low = Infinity, high = -Infinity;
  for (const value of source.values) if (value !== null) { low = Math.min(low, value); high = Math.max(high, value); }
  if (low === Infinity) throw new Error(`Column "${source.name}" has no present value, so it has no extent`);
  return low === high ? [low - .5, high + .5] : [low, high];
}

// ---------------------------------------------------------------- measure mapping

/**
 * Named response curves on the normalized position `t` (0 at the domain start, 1 at its end).
 * `sqrt` and `square` are odd extensions (`sign(t)·√|t|`, `sign(t)·t²`), so extrapolated
 * positions stay finite and monotone.
 */
export const curves = {
  linear: (t: number) => t,
  sqrt: (t: number) => Math.sign(t) * Math.sqrt(Math.abs(t)),
  square: (t: number) => Math.sign(t) * t * t,
} as const;
export type Curve = keyof typeof curves;
export const curveNames = Object.keys(curves) as readonly Curve[];

/** What a value outside the domain does: clamp to the end, continue the curve, or leave the value out (the unit stays, with that channel listed in `unit.outside`). */
export type Outside = "clamp" | "extrapolate" | "omit";
export const outsidePolicies: readonly Outside[] = ["clamp", "extrapolate", "omit"];

export interface MeasureMapping {
  /** A continuous column. */
  column: string;
  /** Absolute `[start, end]` with `start < end`, or the column's own extent. */
  domain: readonly [number, number] | "extent";
  curve: Curve;
  outside: Outside;
  /** Output at curve position 0 and 1; may run downward. */
  range: readonly [number, number];
}
/** A raw, non-negative aggregated measure: no domain, curve or range (areas, proportional splits). */
export interface QuantityMapping { column: string }

export type ChannelSpec =
  | ({ kind: "measure" } & MeasureMapping)
  | ({ kind: "quantity" } & QuantityMapping)
  | { kind: "category"; column: string };

/** The mapping as resolved against a table: absolute domains and the column's unit and categories. */
export type ResolvedChannel =
  | { readonly kind: "measure"; readonly column: string; readonly unit: string; readonly domain: readonly [number, number];
      readonly curve: Curve; readonly outside: Outside; readonly range: readonly [number, number] }
  | { readonly kind: "quantity"; readonly column: string; readonly unit: string }
  | { readonly kind: "category"; readonly column: string; readonly categories: readonly string[] };

function finiteNumber(label: string, value: number): void {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
}

/** Resolve one channel against a table; every argument error is raised here, not during drawing. */
export function resolveChannel(table: DataTable, name: string, spec: ChannelSpec): ResolvedChannel {
  if (spec.kind === "category") {
    const source = categoricalColumn(table, spec.column);
    return Object.freeze({ kind: "category", column: source.name, categories: source.categories });
  }
  const source = continuousColumn(table, spec.column);
  if (spec.kind === "quantity") return Object.freeze({ kind: "quantity", column: source.name, unit: source.unit });
  if (!(spec.curve in curves)) throw new Error(`Channel "${name}": unknown curve "${String(spec.curve)}"`);
  if (!outsidePolicies.includes(spec.outside)) throw new Error(`Channel "${name}": unknown outside-domain policy "${String(spec.outside)}"`);
  finiteNumber(`Channel "${name}" range start`, spec.range[0]);
  finiteNumber(`Channel "${name}" range end`, spec.range[1]);
  let domain: readonly [number, number];
  if (spec.domain === "extent") domain = measureExtent(source);
  else {
    finiteNumber(`Channel "${name}" domain start`, spec.domain[0]);
    finiteNumber(`Channel "${name}" domain end`, spec.domain[1]);
    if (!(spec.domain[0] < spec.domain[1])) throw new Error(`Channel "${name}" domain must have start < end`);
    domain = [spec.domain[0], spec.domain[1]];
  }
  return Object.freeze({ kind: "measure", column: source.name, unit: source.unit, domain: Object.freeze(domain),
    curve: spec.curve, outside: spec.outside, range: Object.freeze([spec.range[0], spec.range[1]] as const) });
}

/**
 * Map one present value through a measure channel: normalize against the domain, clamp or
 * extrapolate, apply the curve, then interpolate the range. `"outside"` means the value lies
 * beyond the domain and the channel's policy is to leave it out.
 */
export function applyMeasure(channel: Extract<ResolvedChannel, { kind: "measure" }>, value: number): number | "outside" {
  const [start, end] = channel.domain;
  let t = (value - start) / (end - start);
  if (t < 0 || t > 1) {
    if (channel.outside === "omit") return "outside";
    if (channel.outside === "clamp") t = Math.min(1, Math.max(0, t));
  }
  const mapped = channel.range[0] + curves[channel.curve](t) * (channel.range[1] - channel.range[0]);
  if (!Number.isFinite(mapped)) throw new Error(`Channel on column "${channel.column}" produced a non-finite value for ${value}; narrow the domain or clamp`);
  return mapped;
}

// ---------------------------------------------------------------- units and aggregation

export type Aggregate = "sum" | "mean" | "median" | "min" | "max" | "count";
export const aggregateNames: readonly Aggregate[] = ["sum", "mean", "median", "min", "max", "count"];
/** Numeric aggregation of the present values only; no present value gives `null`, never 0. */
export function aggregateValues(fn: Aggregate, values: readonly number[]): number | null {
  if (!aggregateNames.includes(fn)) throw new Error(`Unknown aggregate "${String(fn)}"`);
  if (values.length === 0) return null;
  if (fn === "count") return values.length;
  if (fn === "min") return values.reduce((a, b) => Math.min(a, b));
  if (fn === "max") return values.reduce((a, b) => Math.max(a, b));
  const sum = values.reduce((a, b) => a + b, 0);
  if (fn === "sum") return sum;
  if (fn === "mean") return sum / values.length;
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** What happens to a unit with a missing value in a mapped channel. */
export type MissingPolicy = "error" | "omit" | "keep";
export const missingPolicies: readonly MissingPolicy[] = ["error", "omit", "keep"];

export interface UnitWindow {
  /** Continuous column selecting rows; both ends inclusive. */
  column: string;
  from: number;
  to: number;
}
export interface UnitOptions {
  /** Categorical column whose categories each become one merged unit, or `null` for one unit per row. */
  groupBy: string | null;
  /** How measures merge within a group; ignored without `groupBy`. */
  aggregate: Aggregate;
  window: UnitWindow | null;
  missing: MissingPolicy;
}
/** One row, or one group of rows. Measures and classes cover every column of the table. */
export interface DataUnit {
  /** The row id, or `group:<category>` (`group-missing` collects rows without a group value). */
  readonly id: string;
  readonly rowIds: readonly string[];
  /** Number of source rows merged into this unit. */
  readonly count: number;
  /** Per continuous column: the row value, or the aggregate over present values (`null` if none). */
  readonly measures: Readonly<Record<string, number | null>>;
  /** Per categorical column: class index, or `null`. A group's other categories take the mode (ties: lowest index). */
  readonly classes: Readonly<Record<string, number | null>>;
}
export type OmitReason = "outside-window" | "missing-time" | "missing-group" | "missing" | "outside-domain";
export interface OmittedUnit {
  readonly id: string;
  readonly rowIds: readonly string[];
  readonly reason: OmitReason;
  /** The channel that caused `missing` and `outside-domain`. */
  readonly channel?: string;
}

/** Row and category bookkeeping shared by `buildUnits` for one table. */
export function buildUnits(table: DataTable, options: UnitOptions): { units: readonly DataUnit[]; omitted: readonly OmittedUnit[] } {
  if (!missingPolicies.includes(options.missing)) throw new Error(`Unknown missing policy "${String(options.missing)}"`);
  const omitted: OmittedUnit[] = [];
  const measures = table.columns.filter((item): item is ContinuousColumn => item.kind === "continuous");
  const categoricals = table.columns.filter((item): item is CategoricalColumn => item.kind === "categorical");
  const indexOf = new Map(categoricals.map((item) => [item.name, new Map(item.categories.map((category, index) => [category, index]))]));
  const rowsKept: number[] = [];
  const time = options.window ? continuousColumn(table, options.window.column) : null;
  if (options.window) {
    finiteNumber("Window start", options.window.from); finiteNumber("Window end", options.window.to);
    if (options.window.from > options.window.to) throw new Error("Window start must not exceed its end");
  }
  for (let row = 0; row < table.rows; row++) {
    if (time) {
      const value = time.values[row];
      if (value === null) {
        if (options.missing === "error") throw new Error(`Row "${table.rowIds[row]}" has no value in window column "${time.name}"`);
        omitted.push({ id: table.rowIds[row], rowIds: [table.rowIds[row]], reason: "missing-time", channel: time.name });
        continue;
      }
      if (value < options.window!.from || value > options.window!.to) {
        omitted.push({ id: table.rowIds[row], rowIds: [table.rowIds[row]], reason: "outside-window", channel: time.name });
        continue;
      }
    }
    rowsKept.push(row);
  }
  const classAt = (source: CategoricalColumn, row: number): number | null => {
    const value = source.values[row];
    return value === null ? null : indexOf.get(source.name)!.get(value)!;
  };
  const rowUnit = (row: number): DataUnit => Object.freeze({
    id: table.rowIds[row], rowIds: Object.freeze([table.rowIds[row]]), count: 1,
    measures: Object.freeze(Object.fromEntries(measures.map((item) => [item.name, item.values[row]]))),
    classes: Object.freeze(Object.fromEntries(categoricals.map((item) => [item.name, classAt(item, row)]))),
  });
  if (options.groupBy === null) return Object.freeze({ units: Object.freeze(rowsKept.map(rowUnit)), omitted: Object.freeze(omitted) });

  const groupColumn = categoricalColumn(table, options.groupBy);
  if (!aggregateNames.includes(options.aggregate)) throw new Error(`Unknown aggregate "${String(options.aggregate)}"`);
  const groups = new Map<number | null, number[]>();
  for (const row of rowsKept) {
    const index = classAt(groupColumn, row);
    if (index === null && options.missing !== "keep") {
      if (options.missing === "error") throw new Error(`Row "${table.rowIds[row]}" has no value in group column "${groupColumn.name}"`);
      omitted.push({ id: table.rowIds[row], rowIds: [table.rowIds[row]], reason: "missing-group", channel: groupColumn.name });
      continue;
    }
    (groups.get(index) ?? groups.set(index, []).get(index)!).push(row);
  }
  const order = [...groupColumn.categories.keys(), null].filter((index) => groups.has(index));
  const units = order.map((index): DataUnit => {
    const rows = groups.get(index)!;
    const merged = Object.fromEntries(measures.map((item) => [item.name, aggregateValues(options.aggregate,
      rows.map((row) => item.values[row]).filter((value): value is number => value !== null))]));
    const classes = Object.fromEntries(categoricals.map((item): [string, number | null] => {
      if (item === groupColumn) return [item.name, index];
      const counts = new Map<number, number>();
      for (const row of rows) { const c = classAt(item, row); if (c !== null) counts.set(c, (counts.get(c) ?? 0) + 1); }
      let best: number | null = null, bestCount = 0;
      for (const [c, n] of [...counts].sort((a, b) => a[0] - b[0])) if (n > bestCount) { best = c; bestCount = n; }
      return [item.name, best];
    }));
    return Object.freeze({ id: index === null ? "group-missing" : `group:${groupColumn.categories[index]}`,
      rowIds: Object.freeze(rows.map((row) => table.rowIds[row])), count: rows.length,
      measures: Object.freeze(merged), classes: Object.freeze(classes) });
  });
  return Object.freeze({ units: Object.freeze(units), omitted: Object.freeze(omitted) });
}

// ---------------------------------------------------------------- resolved attributes

export interface ResolveOptions extends UnitOptions {
  /** Named channels; a layout reads the ones it knows (`size`, `tone`, `role`, `area`, `time`...). */
  channels: Readonly<Record<string, ChannelSpec>>;
  /**
   * Channels a unit cannot exist without (a position or an area). A unit missing one is omitted
   * (or an error under the `error` policy) whatever the missing-value policy is.
   */
  required?: readonly string[];
}
export interface ResolvedUnit extends DataUnit {
  /** Per channel: measure output, raw quantity, or class index; `null` where the value is missing (policy `keep`). */
  readonly channels: Readonly<Record<string, number | null>>;
  /** Names of channels whose value is missing on this unit; empty when complete. */
  readonly missing: readonly string[];
  /** Names of channels whose value lies outside a domain with policy `omit`; the mapped value is `null`. */
  readonly outside: readonly string[];
}
/** The source mapping: everything needed to explain (and redraw a key for) the attributes. */
export interface ResolvedMapping {
  readonly table: string;
  readonly groupBy: string | null;
  readonly aggregate: Aggregate;
  readonly window: UnitWindow | null;
  readonly missing: MissingPolicy;
  readonly required: readonly string[];
  readonly channels: Readonly<Record<string, ResolvedChannel>>;
}
export interface ResolvedData {
  readonly table: DataTable;
  readonly units: readonly ResolvedUnit[];
  readonly omitted: readonly OmittedUnit[];
  readonly mapping: ResolvedMapping;
}

const resolvedCache = new Map<string, ResolvedData>();

/**
 * Table → window → units → channels. A unit missing a required channel is omitted (in `omitted`,
 * with the channel); any other missing value follows `missing`: `error` throws naming the unit and
 * channel, `omit` drops the unit, `keep` retains it with `null` and lists the channel in
 * `unit.missing`. A value outside an `omit` domain never removes the unit: its channel becomes
 * `null` and is listed in `unit.outside` (on a required channel the unit is omitted with reason
 * `outside-domain`). Nothing is ever replaced by 0 or by a midpoint.
 */
export function resolveData(tableInput: DataTableInput | DataTable, options: ResolveOptions): ResolvedData {
  const table = dataTable(tableInput);
  const required = options.required ?? [];
  const key = `${table.key}|${JSON.stringify([options.groupBy, options.aggregate, options.window, options.missing, options.channels, required])}`;
  return memoized(resolvedCache, key, () => {
    for (const name of required) if (!(name in options.channels)) throw new Error(`Required channel "${name}" has no mapping`);
    const channels = Object.fromEntries(Object.entries(options.channels).map(([name, spec]) => [name, resolveChannel(table, name, spec)]));
    if (options.groupBy !== null) categoricalColumn(table, options.groupBy);
    const built = buildUnits(table, options);
    const omitted = [...built.omitted];
    const units: ResolvedUnit[] = [];
    unit: for (const source of built.units) {
      const values: Record<string, number | null> = {};
      const missing: string[] = [], outside: string[] = [];
      for (const [name, channel] of Object.entries(channels)) {
        const raw = channel.kind === "category" ? source.classes[channel.column] : source.measures[channel.column];
        if (raw === null) {
          if (options.missing === "error") throw new Error(`Unit "${source.id}" has no value for channel "${name}" (column "${channel.column}")`);
          if (options.missing === "omit" || required.includes(name)) {
            omitted.push({ id: source.id, rowIds: source.rowIds, reason: "missing", channel: name });
            continue unit;
          }
          values[name] = null; missing.push(name);
          continue;
        }
        if (channel.kind === "measure") {
          const mapped = applyMeasure(channel, raw);
          if (mapped === "outside") {
            if (required.includes(name)) { omitted.push({ id: source.id, rowIds: source.rowIds, reason: "outside-domain", channel: name }); continue unit; }
            values[name] = null; outside.push(name);
            continue;
          }
          values[name] = mapped;
        } else if (channel.kind === "quantity") {
          if (raw < 0) throw new Error(`Unit "${source.id}": quantity channel "${name}" needs non-negative values, found ${raw} in column "${channel.column}"`);
          values[name] = raw;
        } else values[name] = raw;
      }
      units.push(Object.freeze({ ...source, channels: Object.freeze(values), missing: Object.freeze(missing), outside: Object.freeze(outside) }));
    }
    const mapping: ResolvedMapping = Object.freeze({ table: table.key, groupBy: options.groupBy, aggregate: options.aggregate,
      window: options.window ? Object.freeze({ ...options.window }) : null, missing: options.missing,
      required: Object.freeze([...required]), channels: Object.freeze(channels) });
    return Object.freeze({ table, units: Object.freeze(units), omitted: Object.freeze(omitted), mapping });
  });
}
