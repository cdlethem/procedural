import { dataScoresDefinition, categorySlots, measureSlots } from "../adapters/data-scores-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { atEach, createCompositionRun, inside, strokeWith } from "./core.js";
import { drawDataKey, dataKey, drawKeyText, keyLabel } from "./data-key.js";
import { latticeLayout, orderUnits, timelineLayout, treemapLayout } from "./data-layouts.js";
import type { DataLattice, DataRegion, DataSite, DataTimeline, DataTreemap, OrderMode } from "./data-layouts.js";
import { sampleTable } from "./data-samples.js";
import { continuousColumn, measureExtent, resolveData } from "./data-table.js";
import type { Aggregate, ChannelSpec, Curve, DataTable, DataTableInput, MissingPolicy, Outside, ResolvedData, UnitWindow } from "./data-table.js";
import { color, motif, pathMaterial, regionFill, regionGeometry, regionGeometryKey, retainPreparedRegions } from "./materials.js";
import type { PreparedRegionGeometry } from "./materials.js";
import { boundNestedWork } from "./reference.js";
import type { CompositionRun, CompositionSurface, PathMaterial, PathMaterialSpec, Region, RegionFillSpec } from "./types.js";

/**
 * Data Scores as a typed, JSON-compatible composition: a recorded table, named channel mappings
 * and one layout, drawn by the existing consumers.
 *
 * Pipeline (each stage is a cached, frozen producer; see `data-table.ts` and `data-layouts.ts`):
 * `table` → `resolveData` (window, merge, channels, missing-value policy) → layout (lattice,
 * treemap or timeline) → `atEach` / `inside` / `strokeWith` with `dataMark`, `dataFill` and
 * `pathMaterial` → optional key (`data-key.ts`).
 *
 * Inputs. `table` is a resolved value, never a URL: either the JSON `DataTableInput` a persisted
 * recipe stores, or a `DataTable` from `dataTable()`. Reload replays the recorded values. The
 * instrument selects one of three bundled sample tables by id; binding a user's own recording is
 * future host work, and the direct API already accepts it.
 *
 * Substitution. `drawDataScores(surface, recipe, consumers)` replaces the mark, the region fill
 * or the score-line material with ordinary callbacks while the resolved data and layout stay the
 * same cached objects; `dataScoresScene(recipe)` exposes them for any other consumer.
 */
export type DataMarkKind = "dot" | "rings" | "rosette" | "arrow";
export type DataFillKind = "hatch" | "motifs" | "contours";

export interface DataMarkSpec {
  /** One kind for every unit, or `by-role`: `roleKinds[role class index]`, wrapping. */
  vocabulary: DataMarkKind | "by-role";
  roleKinds: readonly DataMarkKind[];
  /** Diameter used when the `size` channel is unmapped. With a `size` channel the channel's range decides. */
  maxSize: number;
  petals: number;
  opening: number;
  weight: number;
}
export interface DataFillSpec {
  vocabulary: DataFillKind | "by-role";
  roleKinds: readonly DataFillKind[];
  /** Fill spacing when the `size` channel is unmapped (the channel's range is fill spacing otherwise). */
  spacing: number;
  angle: number;
  weight: number;
  /** Opacity of the flat tone laid under each region's fill. */
  underpaint: number;
  /** Removed from inside every region (half on each side); region bounds and areas are unchanged. */
  gap: number;
  frame: boolean;
  frameWeight: number;
}
export interface DataLineSpec {
  kind: "none" | "ink" | "stitch";
  weight: number;
  spacing: number;
  /** Faint rule through each lane's centre line. */
  guides: boolean;
}
export interface DataFootprint { centerX: number; centerY: number; width: number; height: number }
export type DataLayoutSpec =
  | { kind: "lattice"; footprint: DataFootprint; order: { mode: OrderMode; by: string | null; descending: boolean }; correlation: number; looseness: number }
  | { kind: "treemap"; footprint: DataFootprint; order: { mode: OrderMode; by: string | null; descending: boolean } }
  | { kind: "timeline"; footprint: DataFootprint; levelSpread: number; laneOrder: "declared" | "shuffled" };

export interface DataScoresRecipe {
  kind: "data-scores";
  seed: number;
  palette: readonly number[];
  table: DataTableInput | DataTable;
  units: { groupBy: string | null; aggregate: Aggregate; window: UnitWindow | null; missing: MissingPolicy };
  /** Named channels: `size`, `tone`, `role`, `loose`, `area`, `time`, `lane`, `level`. See `data-layouts.ts`. */
  channels: Readonly<Record<string, ChannelSpec>>;
  layout: DataLayoutSpec;
  marks: DataMarkSpec;
  fill: DataFillSpec;
  line: DataLineSpec;
  /** `both`, the drawing alone, or the key alone (so a second layer can carry the key). */
  /**
   * How a unit kept with a missing mapped value is drawn: `ghost` (a pale ring, or a region outline)
   * or `gap` (nothing). Units stay in the layout either way, so this never moves anything.
   */
  absence: "ghost" | "gap";
  parts: "both" | "drawing" | "key";
  key: { x: number; y: number; scale: number };
}

export interface DataScoresConsumers {
  mark?: (surface: CompositionSurface, site: DataSite, run: CompositionRun) => void;
  fill?: (surface: CompositionSurface, region: DataRegion, run: CompositionRun) => void;
  line?: PathMaterial;
}

export type DataScene = { readonly data: ResolvedData } & (
  | { readonly kind: "lattice"; readonly layout: DataLattice }
  | { readonly kind: "treemap"; readonly layout: DataTreemap }
  | { readonly kind: "timeline"; readonly layout: DataTimeline });

const REQUIRED = { lattice: [], treemap: ["area"], timeline: ["time"] } as const;

function finite(label: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}
function validateSpecs(recipe: DataScoresRecipe): void {
  const { marks, fill, line, key } = recipe;
  finite("Mark size", marks.maxSize, 0, 500); finite("Mark petals", marks.petals, 1, 48);
  finite("Mark opening", marks.opening, 0, 1); finite("Mark weight", marks.weight, 0, 50);
  if (marks.vocabulary === "by-role" && marks.roleKinds.length === 0) throw new Error("Mark roles need at least one kind");
  finite("Fill spacing", fill.spacing, 1, 1000); finite("Fill weight", fill.weight, 0, 50);
  finite("Fill tint", fill.underpaint, 0, 1); finite("Fill gap", fill.gap, 0, 200); finite("Fill outline weight", fill.frameWeight, 0, 20);
  finite("Fill angle", fill.angle, -Infinity, Infinity);
  if (fill.vocabulary === "by-role" && fill.roleKinds.length === 0) throw new Error("Fill roles need at least one kind");
  finite("Line weight", line.weight, 0, 50); finite("Line spacing", line.spacing, .5, 1000);
  finite("Key x", key.x, -1e5, 1e5); finite("Key y", key.y, -1e5, 1e5); finite("Key scale", key.scale, .3, 4);
  if (!["both", "drawing", "key"].includes(recipe.parts)) throw new Error(`Unknown parts "${String(recipe.parts)}"`);
  if (recipe.absence !== "ghost" && recipe.absence !== "gap") throw new Error(`Unknown absence "${String(recipe.absence)}"`);
}

/**
 * Resolve the table, order its units and lay them out. Everything returned is frozen and cached
 * by content, so palette, marks, fills, lines and the key never recompute it.
 */
export function dataScoresScene(recipe: DataScoresRecipe): DataScene {
  const layout = recipe.layout;
  const data = resolveData(recipe.table, { ...recipe.units, channels: recipe.channels, required: REQUIRED[layout.kind] });
  const { centerX, centerY, width, height } = layout.footprint;
  if (layout.kind === "timeline")
    return { kind: "timeline", data, layout: timelineLayout(data, { seed: recipe.seed, centerX, centerY, width, height, levelSpread: layout.levelSpread, laneOrder: layout.laneOrder,
      laneTone: recipe.channels.tone !== undefined && recipe.channels.lane !== undefined && recipe.channels.tone.column === recipe.channels.lane.column }) };
  const units = orderUnits(data.units, { ...layout.order, seed: recipe.seed });
  if (layout.kind === "treemap")
    return { kind: "treemap", data, layout: treemapLayout(data, units, { seed: recipe.seed, centerX, centerY, width, height }) };
  return { kind: "lattice", data, layout: latticeLayout(data, units, { seed: recipe.seed, centerX, centerY, width, height,
    correlation: layout.correlation, looseness: layout.looseness, looseByData: recipe.channels.loose !== undefined }) };
}

// ---------------------------------------------------------------- consumers

/**
 * The stock mark: a `motif` sized by the unit's `size` channel and shaped by its `role` class.
 * A unit with a value left out by an `omit` domain draws nothing. A unit with a missing mapped
 * value draws a pale ghost ring (`absence: "ghost"`) or nothing (`"gap"`). A diameter below zero
 * (extrapolation) draws nothing; above 500 it is capped.
 */
export function dataMark(spec: DataMarkSpec, palette: readonly number[], absence: DataScoresRecipe["absence"] = "ghost"): (surface: CompositionSurface, site: DataSite, run: CompositionRun) => void {
  return (surface, site, run) => {
    const { unit } = site;
    if (unit.outside.length > 0) return;
    if (unit.missing.length > 0) {
      if (absence === "gap") return;
      surface.noFill(); color(surface, palette, 0, 120, false); surface.strokeWeight(.8);
      surface.circle(0, 0, spec.maxSize * .55);
      return;
    }
    const diameter = unit.channels.size ?? spec.maxSize;
    if (!(diameter > 0)) return;
    const kind = spec.vocabulary === "by-role" ? spec.roleKinds[(unit.channels.role ?? 0) % spec.roleKinds.length] : spec.vocabulary;
    motif({ kind, size: Math.min(500, diameter), petals: spec.petals, opening: spec.opening, weight: spec.weight,
      rotation: 0, variation: 0, retention: 1 }, palette)(surface, site, run);
  };
}

const CONTOUR = { source: "noise", resolution: 23, aspect: 1, hillCount: 3, hillRadius: .23, levelBase: -.65, levelStep: .35, levels: 4 } as const;
/** Contour fields use frequency `14 / spacing`, so a smaller spacing gives denser contours. */
const contourFrequency = (spacing: number) => Math.min(12, Math.max(.3, 14 / spacing));

/**
 * The region-fill spec a region uses: kind from its `role` class, spacing from its `size`
 * channel, and the gap as fill inset. A region with a missing or left-out value has none.
 */
export function dataFillSpec(spec: DataFillSpec, region: DataRegion): RegionFillSpec | undefined {
  const { unit } = region;
  if (unit.missing.length > 0 || unit.outside.length > 0) return undefined;
  const kind = spec.vocabulary === "by-role" ? spec.roleKinds[(unit.channels.role ?? 0) % spec.roleKinds.length] : spec.vocabulary;
  const spacing = Math.max(1, Math.min(1000, unit.channels.size ?? spec.spacing));
  const dot = Math.max(1.5, Math.min(6, spacing * .3));
  return {
    kind, inset: spec.gap / 2, retention: 1, spacing, angle: spec.angle, weight: spec.weight, underpaint: spec.underpaint,
    mark: { kind: "dot", size: dot, petals: 6, opening: 0, weight: spec.weight, rotation: 0, variation: .25, retention: 1 },
    material: { kind: "ink", weight: spec.weight, spacing: 6, phase: .3, phaseSpread: 0, levelRamp: 0, retention: 1,
      mark: { kind: "dot", size: 3, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } } satisfies PathMaterialSpec,
    contour: { ...CONTOUR, frequency: contourFrequency(spacing) },
  };
}

/**
 * The stock region filler: `regionFill` per region in that region's tone, plus an optional outline.
 * A region with a missing value is an outline alone (`ghost`) or empty (`gap`); one whose value is
 * left out by an `omit` domain is empty.
 */
export function dataFill(spec: DataFillSpec, palette: readonly number[], absence: DataScoresRecipe["absence"] = "ghost"): (surface: CompositionSurface, region: DataRegion, run: CompositionRun) => void {
  return (surface, region, run) => {
    if (region.unit.outside.length > 0 || (absence === "gap" && region.unit.missing.length > 0)) return;
    const tone = palette[Math.floor(region.unit.channels.tone ?? 0) % palette.length];
    const [left, top, right, bottom] = region.bounds;
    const width = right - left, height = bottom - top, inset = spec.gap / 2;
    const filler = dataFillSpec(spec, region);
    if (filler && width > spec.gap && height > spec.gap) regionFill(filler, [tone])(surface, region, run);
    if ((spec.frame || filler === undefined) && width > spec.gap && height > spec.gap) {
      surface.noFill(); color(surface, [tone], 0, filler ? 220 : 130, false);
      surface.strokeWeight(spec.frame ? spec.frameWeight : .8);
      surface.rect(inset, inset, width - spec.gap, height - spec.gap);
    }
  };
}

function lineSpec(line: DataLineSpec): PathMaterialSpec {
  return { kind: line.kind === "stitch" ? "stitch" : "ink", weight: line.weight, spacing: line.spacing, phase: .3, phaseSpread: 0, levelRamp: 0,
    retention: 1, mark: { kind: "dot", size: 3, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } };
}

/** Work bound for nested region geometry, checked per fill kind before anything is built. */
function boundFills(regions: readonly DataRegion[], spec: DataFillSpec): void {
  const groups = new Map<DataFillKind, DataRegion[]>();
  for (const region of regions) {
    const filler = dataFillSpec(spec, region);
    if (filler) (groups.get(filler.kind as DataFillKind) ?? groups.set(filler.kind as DataFillKind, []).get(filler.kind as DataFillKind)!).push(region);
  }
  for (const [kind, group] of groups) {
    const finest = Math.min(...group.map((region) => dataFillSpec(spec, region)!.spacing));
    try { boundNestedWork(group, { ...dataFillSpec(spec, group[0])!, kind, spacing: finest }); }
    catch (error) {
      throw new Error(`Data Scores fills exceed the nested geometry budget: ${group.length} ${kind} regions at spacing ${finest} (${(error as Error).message}). Merge rows, narrow the window, use a coarser spacing or the hatch fill.`);
    }
  }
}

/**
 * Draw the recipe into a caller-owned surface: guides, score lines, marks (lattice, timeline) or
 * region fills (treemap), then the key. Every callback is isolated by the shared consumers and
 * charged to `run`. Nothing clears the canvas or paints a full-canvas fill.
 */
export function drawDataScores(surface: CompositionSurface, recipe: DataScoresRecipe, consumers: DataScoresConsumers = {},
  run: CompositionRun = createCompositionRun()): void {
  run.check();
  validateSpecs(recipe);
  const scene = dataScoresScene(recipe);
  if (recipe.parts !== "key") {
    if (scene.kind === "treemap") {
      boundFills(scene.layout.regions, recipe.fill);
      inside(surface, scene.layout.regions, consumers.fill ?? dataFill(recipe.fill, recipe.palette, recipe.absence), run);
    } else {
      if (scene.kind === "timeline") {
        const { footprint } = recipe.layout;
        if (recipe.line.guides) {
          surface.push();
          try {
            surface.strokeWeight(.6); color(surface, recipe.palette, 0, 70, false); surface.noFill();
            for (const lane of scene.layout.lanes) surface.line(footprint.centerX - footprint.width / 2, lane.y, footprint.centerX + footprint.width / 2, lane.y);
            if (scene.data.mapping.channels.lane)
              for (const lane of scene.layout.lanes)
                drawKeyText(surface, keyLabel(lane.category ?? "no value"), footprint.centerX - footprint.width / 2, lane.y - 4, 1.1, recipe.palette, .6, 200);
          } finally { surface.pop(); }
        }
        if (recipe.line.kind !== "none" || consumers.line)
          strokeWith(surface, scene.layout.paths, consumers.line ?? pathMaterial(lineSpec(recipe.line), recipe.palette), run);
      }
      atEach(surface, scene.layout.sites, consumers.mark ?? dataMark(recipe.marks, recipe.palette, recipe.absence), run);
    }
  }
  if (recipe.parts !== "drawing") drawDataKey(surface, dataKey(recipe, scene.data), recipe, recipe.key.x, recipe.key.y, recipe.key.scale);
}

/** Resolve, lay out and (for a treemap) build every region's nested geometry, yielding between batches; false if cancelled. */
export async function prepareDataScores(recipe: DataScoresRecipe, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  validateSpecs(recipe);
  const scene = dataScoresScene(recipe);
  if (scene.kind !== "treemap" || recipe.parts === "key") return !cancelled();
  const regions = scene.layout.regions;
  boundFills(regions, recipe.fill);
  const prepared = new Map<string, PreparedRegionGeometry | undefined>();
  for (let index = 0; index < regions.length; index++) {
    if (cancelled()) return false;
    const filler = dataFillSpec(recipe.fill, regions[index]);
    if (filler) prepared.set(regionGeometryKey(filler, regions[index] as Region), regionGeometry(filler, regions[index] as Region));
    if ((index + 1) % 2 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  if (cancelled()) return false;
  retainPreparedRegions(prepared);
  return true;
}

// ---------------------------------------------------------------- named-instrument binding

type Scalar = number | string | boolean;
const markKinds: Record<string, DataMarkSpec["vocabulary"]> = { dots: "dot", rings: "rings", rosettes: "rosette", arrows: "arrow", "by-category": "by-role" };
const fillKinds: Record<string, DataFillSpec["vocabulary"]> = { hatch: "hatch", motifs: "motifs", contours: "contours", "by-category": "by-role" };
const ALL_MARKS: readonly DataMarkKind[] = ["dot", "rings", "rosette", "arrow"];
const ALL_FILLS: readonly DataFillKind[] = ["hatch", "motifs", "contours"];

/** Column names by position: the instrument addresses "first measure", "second category". */
export function sampleSlots(table: DataTable): { measures: readonly string[]; categories: readonly string[] } {
  return { measures: table.columns.filter((item) => item.kind === "continuous").map((item) => item.name),
    categories: table.columns.filter((item) => item.kind === "categorical").map((item) => item.name) };
}

/**
 * Resolve the stored scalar controls to the public recipe. The chosen bundled table is embedded
 * in the recipe by value. Controls that do not apply to the chosen layout never reach it.
 */
export function dataScoresComposition(input: InstrumentInput): DataScoresRecipe {
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((rgb) => !Number.isSafeInteger(rgb) || rgb < 0 || rgb > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(dataScoresDefinition, input.params) as Record<string, Scalar>;
  const table = sampleTable(q.dataset as string);
  const { measures, categories } = sampleSlots(table);
  const measure = (slot: unknown) => measures[measureSlots.indexOf(slot as typeof measureSlots[number])];
  const category = (slot: unknown) => categories[categorySlots.indexOf(slot as typeof categorySlots[number])];
  const layoutKind = q.layout as DataLayoutSpec["kind"];
  const footprint = { centerX: q.centerX as number, centerY: q.centerY as number, width: q.width as number, height: q.height as number };

  const timeColumn = continuousColumn(table, measure(q.timeBy));
  const [timeLow, timeHigh] = measureExtent(timeColumn);
  const startFraction = q.windowStart as number, endFraction = Math.min(1, startFraction + (q.windowLength as number));
  const from = startFraction <= 0 ? timeLow : timeLow + startFraction * (timeHigh - timeLow);
  const to = endFraction >= 1 ? timeHigh : timeLow + endFraction * (timeHigh - timeLow);

  const channels: Record<string, ChannelSpec> = {};
  if (q.sizeBy !== "none") {
    const name = measure(q.sizeBy), [low, high] = measureExtent(continuousColumn(table, name));
    const start = low + (q.domainStart as number) * (high - low);
    channels.size = { kind: "measure", column: name, domain: [start, start + (q.domainSpan as number) * (high - low)],
      curve: q.curve as Curve, outside: q.outside as Outside,
      range: layoutKind === "treemap" ? [q.spacingSparse as number, q.spacingDense as number] : [q.minSize as number, q.maxSize as number] };
  }
  if (q.toneBy !== "none") channels.tone = { kind: "category", column: category(q.toneBy) };
  if (layoutKind !== "treemap" && q.vocabulary === "by-category") channels.role = { kind: "category", column: category(q.markRole) };
  if (layoutKind === "treemap" && q.fill === "by-category") channels.role = { kind: "category", column: category(q.fillRole) };
  const unitRange = (name: string): ChannelSpec => ({ kind: "measure", column: name, domain: "extent", curve: "linear", outside: "clamp", range: [0, 1] });

  let layout: DataLayoutSpec;
  if (layoutKind === "lattice") {
    if (q.looseBy !== "none") channels.loose = unitRange(measure(q.looseBy));
    layout = { kind: "lattice", footprint, order: orderSpec(q, measure), correlation: q.correlation as number, looseness: q.looseness as number };
  } else if (layoutKind === "treemap") {
    channels.area = { kind: "quantity", column: measure(q.areaBy) };
    layout = { kind: "treemap", footprint, order: orderSpec(q, measure) };
  } else {
    channels.time = { kind: "measure", column: timeColumn.name, domain: [from, to], curve: "linear", outside: "clamp", range: [0, 1] };
    if (q.laneBy !== "none") channels.lane = { kind: "category", column: category(q.laneBy) };
    if (q.levelBy !== "none") channels.level = unitRange(measure(q.levelBy));
    layout = { kind: "timeline", footprint, levelSpread: q.levelSpread as number, laneOrder: q.laneOrder as "declared" | "shuffled" };
  }
  const merging = layoutKind !== "timeline" && q.groupBy !== "none";
  return {
    kind: "data-scores", seed: input.seed, palette: [...input.palette], table: table,
    units: { groupBy: merging ? category(q.groupBy) : null, aggregate: merging ? q.aggregate as Aggregate : "sum",
      window: { column: timeColumn.name, from, to }, missing: "keep" },
    channels, layout,
    marks: { vocabulary: markKinds[q.vocabulary as string], roleKinds: ALL_MARKS, maxSize: q.maxSize as number, petals: q.petals as number,
      opening: q.opening as number, weight: q.markWeight as number },
    fill: { vocabulary: fillKinds[q.fill as string], roleKinds: ALL_FILLS, spacing: q.spacingDense as number, angle: q.angle as number,
      weight: q.fillWeight as number, underpaint: q.underpaint as number, gap: q.gap as number, frame: q.frame as boolean,
      frameWeight: q.frameWeight as number },
    line: { kind: q.line as DataLineSpec["kind"], weight: q.lineWeight as number, spacing: q.lineSpacing as number, guides: q.guides as boolean },
    absence: q.missing as DataScoresRecipe["absence"], parts: q.parts as DataScoresRecipe["parts"], key: { x: q.keyX as number, y: q.keyY as number, scale: q.keyScale as number },
  };
}

function orderSpec(q: Record<string, Scalar>, measure: (slot: unknown) => string): { mode: OrderMode; by: string | null; descending: boolean } {
  const mode = q.order as OrderMode;
  return { mode, by: mode === "sorted" ? measure(q.sortBy) : null, descending: mode === "sorted" && q.descending === true };
}

/** Whether the seed can change this instrument's construction. */
export function dataScoresUsesSeed(q: InstrumentInput["params"]): boolean {
  if (q.layout === "timeline") return q.laneOrder === "shuffled" && q.laneBy !== "none";
  if (q.order === "shuffled") return true;
  if (q.layout === "lattice") return Number(q.looseness) > 0;
  const kinds = q.fill === "by-category" ? ["motifs", "contours"] : [q.fill];
  return kinds.includes("motifs") || kinds.includes("contours");
}
