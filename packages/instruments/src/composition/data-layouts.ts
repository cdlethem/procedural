/**
 * Layout producers for resolved data units. Each takes `ResolvedData` (the frozen output of
 * `resolveData`) and returns frozen typed values that the existing consumers draw:
 * `latticeLayout` and `timelineLayout` return `Site`s for `atEach`, `treemapLayout` returns
 * `Region`s for `inside`, and the timeline's score lines are `Path`s for `strokeWith`.
 *
 * Identity. A site or region keeps its unit's id (a table row id, or `group:<category>`), so
 * ordering, windows, sorting, appearance and omission never rename anything. Seeds are
 * `componentSeed(seed, id, purpose)`; no stream is shared in traversal order.
 *
 * Channels read (names are fixed; the recipe builder decides which are mapped):
 * `loose` (lattice: 0..1 weight of the shared disorder field), `area` (treemap: a `quantity`
 * channel; required), `time` (timeline x; required), `level` (timeline y inside a lane), `lane`
 * (timeline category channel), `tone` (category → `Site.tone`). Size, role and fill are read by
 * the consumers in `data-scores.ts`, not here.
 */
import { componentSeed } from "./core.js";
import { applyMeasure, categoricalColumn, continuousColumn } from "./data-table.js";
import type { ResolvedData, ResolvedUnit } from "./data-table.js";
import { latticeSites, memoized } from "./sources.js";
import type { Path, Point, Region, Site } from "./types.js";

/** A site that remembers the unit (with every raw and mapped attribute) it stands for. */
export interface DataSite extends Site {
  readonly unit: ResolvedUnit;
}
export interface DataRegion extends Region {
  readonly unit: ResolvedUnit;
  /** The unit's area quantity; the region's area is exactly `weight / total × footprint area`. */
  readonly weight: number;
}


function finite(label: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}

/** Results are keyed by the (already cached) units array's identity plus the option values. */
const layoutCaches = new WeakMap<object, Map<string, unknown>>();
function layoutCached<T>(data: ResolvedData, key: string, make: () => T): T {
  let inner = layoutCaches.get(data);
  if (!inner) layoutCaches.set(data, inner = new Map());
  return memoized(inner as Map<string, T>, key, make);
}

export type OrderMode = "table" | "sorted" | "shuffled";
export interface OrderOptions {
  mode: OrderMode;
  /** A continuous column name (the unit's raw or aggregated value); required for `sorted`. */
  by: string | null;
  descending: boolean;
  seed: number;
}
/**
 * The order in which units take lattice cells or treemap splits. `table` keeps source order.
 * `sorted` orders by a measure (stable; missing values last in either direction). `shuffled`
 * orders by `componentSeed(seed, unit id, "order")`, so each unit's place depends only on its own
 * id and the seed.
 */
export function orderUnits(units: readonly ResolvedUnit[], order: OrderOptions): readonly ResolvedUnit[] {
  if (order.mode === "table") return units;
  if (order.mode === "shuffled") {
    const keyed = units.map((unit) => [componentSeed(order.seed, unit.id, "order"), unit] as const);
    keyed.sort((a, b) => a[0] - b[0] || (a[1].id < b[1].id ? -1 : 1));
    return Object.freeze(keyed.map(([, unit]) => unit));
  }
  if (order.mode !== "sorted") throw new Error(`Unknown order "${String(order.mode)}"`);
  const by = order.by;
  if (by === null) throw new Error("Sorted order needs a measure column");
  const direction = order.descending ? -1 : 1;
  const indexed = units.map((unit, index) => ({ unit, index, value: unit.measures[by] }));
  if (indexed.length > 0 && !(by in units[0].measures)) throw new Error(`Cannot sort by "${by}": it is not a continuous column of the table`);
  indexed.sort((a, b) => {
    if (a.value === null || b.value === null) return a.value === b.value ? a.index - b.index : a.value === null ? 1 : -1;
    return (a.value - b.value) * direction || a.index - b.index;
  });
  return Object.freeze(indexed.map((item) => item.unit));
}

// ---------------------------------------------------------------- lattice

export interface LatticeLayoutOptions {
  seed: number;
  centerX: number; centerY: number; width: number; height: number;
  /** Correlation length of the shared disorder field, in cells (1 to 64). */
  correlation: number;
  /** Largest displacement as a fraction of the cell size (0 to 1). */
  looseness: number;
  /** Read each site's `loose` channel (clamped to 0..1) as its share of that displacement; missing means 0. Otherwise every site takes all of it. */
  looseByData: boolean;
}
export interface DataLattice {
  readonly sites: readonly DataSite[];
  readonly columns: number;
  readonly rows: number;
  /** Cell width and height in canvas units. */
  readonly cell: Point;
}

/**
 * One unit per cell of a regular lattice, in `units` order, row by row. Uses `latticeSites` (the
 * existing shared correlated disorder field); each site moves along its own disturbance vector
 * by its `loose` share, so data decides where the grid stays exact and where it drifts.
 * Columns are `ceil(√(n·width/height))` (at least 2); trailing cells stay empty.
 */
export function latticeLayout(data: ResolvedData, units: readonly ResolvedUnit[], options: LatticeLayoutOptions): DataLattice {
  const { seed, centerX, centerY, width, height, correlation, looseness, looseByData } = options;
  finite("Lattice width", width, 1, 8192); finite("Lattice height", height, 1, 8192);
  finite("Lattice looseness", looseness, 0, 1); finite("Lattice correlation", correlation, 1, 64);
  if (looseByData && units.some((unit) => !("loose" in unit.channels))) throw new Error("Lattice looseness by data needs a \"loose\" channel");
  const n = units.length;
  const columns = Math.max(2, Math.ceil(Math.sqrt(n * width / height))), rows = Math.max(2, Math.ceil(n / columns));
  const key = JSON.stringify([units.map((unit) => unit.id), options]);
  return layoutCached(data, `lattice:${key}`, () => {
    const cell = Object.freeze([width / columns, height / rows] as const);
    if (n === 0) return Object.freeze({ sites: Object.freeze([]), columns, rows, cell });
    const grid = latticeSites({ seed, columns, rows, width, height, centerX, centerY, correlation, displacement: looseness,
      rotation: 0, scale: 0, omission: 0, anchors: 0, focalX: centerX, focalY: centerY, focalRadius: 0, retention: 1 });
    const sites = units.map((unit, index): DataSite => {
      const cellSite = grid[index];
      const weight = looseByData ? Math.min(1, Math.max(0, unit.channels.loose ?? 0)) : 1;
      const [ox, oy] = cellSite.origin, [px, py] = cellSite.position;
      const tone = unit.channels.tone;
      return Object.freeze({ id: unit.id, seed: componentSeed(seed, unit.id, "site"), unit,
        position: Object.freeze([ox + (px - ox) * weight, oy + (py - oy) * weight] as const), angle: 0, scale: 1,
        tone: tone ?? 0 });
    });
    return Object.freeze({ sites: Object.freeze(sites), columns, rows, cell });
  });
}

// ---------------------------------------------------------------- treemap

export interface TreemapLayoutOptions {
  seed: number;
  centerX: number; centerY: number; width: number; height: number;
}
export interface DataTreemap {
  readonly regions: readonly DataRegion[];
  /** Units whose area quantity is 0: a zero-area boundary is not a region, so they have none. */
  readonly empty: readonly string[];
  /** Sum of every region's weight. */
  readonly total: number;
}

/**
 * A binary treemap with exact areas. Units keep the order given; each level splits the run of
 * units where the running weight is nearest half and cuts the rectangle across its longer side in
 * proportion to the two halves, so every region's area is `weight / total × width·height`
 * (floating-point rounding only) and regions tile the footprint without gaps or overlaps.
 * Each unit needs an `area` quantity channel; a unit without one is not in `data.units`
 * (`area` is a required channel), and a negative value was rejected by `resolveData`.
 */
export function treemapLayout(data: ResolvedData, units: readonly ResolvedUnit[], options: TreemapLayoutOptions): DataTreemap {
  const { seed, centerX, centerY, width, height } = options;
  finite("Treemap width", width, 1, 8192); finite("Treemap height", height, 1, 8192);
  const key = JSON.stringify([units.map((unit) => unit.id), options]);
  return layoutCached(data, `treemap:${key}`, () => {
    const items: { unit: ResolvedUnit; weight: number }[] = [];
    const empty: string[] = [];
    for (const unit of units) {
      const weight = unit.channels.area;
      if (weight === undefined || weight === null) throw new Error(`Treemap unit "${unit.id}" has no area quantity`);
      if (weight > 0) items.push({ unit, weight }); else empty.push(unit.id);
    }
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    const regions: DataRegion[] = [];
    const place = (from: number, to: number, x: number, y: number, w: number, h: number, sum: number): void => {
      if (to - from === 1) {
        const { unit, weight } = items[from];
        regions.push(Object.freeze({ id: unit.id, seed: componentSeed(seed, unit.id, "region"), unit, weight,
          bounds: Object.freeze([x, y, x + w, y + h] as const) }));
        return;
      }
      let split = from + 1, running = items[from].weight, best = Math.abs(sum / 2 - running);
      for (let index = from + 1; index < to - 1; index++) {
        running += items[index].weight;
        const miss = Math.abs(sum / 2 - running);
        if (miss < best) { best = miss; split = index + 1; }
      }
      let left = 0;
      for (let index = from; index < split; index++) left += items[index].weight;
      const share = left / sum;
      if (w >= h) {
        place(from, split, x, y, w * share, h, left);
        place(split, to, x + w * share, y, w - w * share, h, sum - left);
      } else {
        place(from, split, x, y, w, h * share, left);
        place(split, to, x, y + h * share, w, h - h * share, sum - left);
      }
    };
    if (items.length > 0) place(0, items.length, centerX - width / 2, centerY - height / 2, width, height, total);
    return Object.freeze({ regions: Object.freeze(regions), empty: Object.freeze(empty), total });
  });
}

// ---------------------------------------------------------------- timeline

export interface TimelineLayoutOptions {
  seed: number;
  centerX: number; centerY: number; width: number; height: number;
  /** Fraction of a lane's height the level channel spans (0 to 1). */
  levelSpread: number;
  /** Give each lane's score line its category's class index as `tone` (otherwise tone 0). */
  laneTone: boolean;
  /** `declared`: lanes stack in category order. `shuffled`: a seeded permutation, each category's rank depending only on its own name and the seed. */
  laneOrder: "declared" | "shuffled";
}
export interface TimelineLane {
  /** Stacking position, 0 at the top. */
  readonly index: number;
  /** The category's class index (declared order); `null` for the single lane, `categories.length` for the lane of units with no category. */
  readonly class: number | null;
  /** Lane centre line, canvas y. */
  readonly y: number;
  /** The category name, or `null` for the single lane and for the lane of units with no category. */
  readonly category: string | null;
}
export interface DataTimeline {
  readonly sites: readonly DataSite[];
  /** Score lines: consecutive units of one lane in time order, broken at gaps. See `timelineLayout`. */
  readonly paths: readonly Path[];
  readonly lanes: readonly TimelineLane[];
}

/**
 * A score: time (required `time` channel) runs left to right across the footprint, categories
 * (`lane` channel) stack as equal lanes in declared or seeded category order (`laneOrder`; the
 * lane of units with no category is always last), and the `level` channel
 * places each unit vertically inside its lane. Axis positions are `(value - range[0]) /
 * (range[1] - range[0])`, so the channels decide the axis extent (the recipe maps time to 0..1
 * over its window). A channel-less lane gives one lane; units with a missing lane take one extra
 * final lane (policy `keep`).
 *
 * Score lines connect consecutive units of a lane in time order. They break (a) at a unit whose
 * level is missing (drawn at the lane centre, not connected), and (b) wherever the table has a
 * row of that lane between two kept units that was left out for a missing or out-of-domain value,
 * so an omitted reading is a visible gap and never bridged. Rows outside the window lie outside
 * the drawn extent and break nothing.
 */
export function timelineLayout(data: ResolvedData, options: TimelineLayoutOptions): DataTimeline {
  const { centerX, centerY, width, height, levelSpread, laneTone, laneOrder, seed } = options;
  if (laneOrder !== "declared" && laneOrder !== "shuffled") throw new Error(`Unknown lane order "${String(laneOrder)}"`);
  finite("Timeline width", width, 1, 8192); finite("Timeline height", height, 1, 8192);
  finite("Timeline level spread", levelSpread, 0, 1);
  const time = data.mapping.channels.time, lane = data.mapping.channels.lane, level = data.mapping.channels.level;
  if (!time || time.kind !== "measure") throw new Error("Timeline needs a measure channel named \"time\"");
  if (lane && lane.kind !== "category") throw new Error("Timeline lane channel must be a category channel");
  if (level && level.kind !== "measure") throw new Error("Timeline level channel must be a measure channel");
  const key = JSON.stringify([options]);
  return layoutCached(data, `timeline:${key}`, () => {
    const left = centerX - width / 2, top = centerY - height / 2;
    const along = (channel: { range: readonly [number, number] }, value: number) => (value - channel.range[0]) / (channel.range[1] - channel.range[0]);
    const missingLane = lane !== undefined && data.units.some((unit) => unit.channels.lane === null);
    const laneCount = lane ? lane.categories.length + (missingLane ? 1 : 0) : 1;
    const laneHeight = height / laneCount;
    const classCount = lane ? lane.categories.length : 0;
    // Stack position → class (the lane of unit with no category is class `classCount`, always last).
    const classAt = Array.from({ length: laneCount }, (_, index) => index);
    if (lane && laneOrder === "shuffled") {
      const keys = lane.categories.map((category, index) => [componentSeed(seed, `lane:${category}`, "lane-order"), index] as const);
      keys.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      keys.forEach(([, index], position) => { classAt[position] = index; });
    }
    const stackOf = classAt.map((_, position) => classAt.indexOf(position));
    const laneOf = (value: number | null | undefined): number => lane ? stackOf[value ?? classCount] : 0;
    const lanes = Array.from({ length: laneCount }, (_, index): TimelineLane => Object.freeze({ index,
      class: lane ? classAt[index] : null, y: top + (index + .5) * laneHeight,
      category: lane ? (lane.categories[classAt[index]] ?? null) : null }));
    const stops: { lane: number; x: number; site?: DataSite; gap: boolean }[] = [];
    const sites: DataSite[] = [];
    for (const unit of data.units) {
      const t = unit.channels.time;
      if (t === null || t === undefined) throw new Error(`Timeline unit "${unit.id}" has no time value`);
      const laneIndex = laneOf(unit.channels.lane);
      const x = left + Math.min(1, Math.max(0, along(time, t))) * width;
      const levelValue = level ? unit.channels.level : null;
      const y = levelValue === null || levelValue === undefined ? lanes[laneIndex].y
        : lanes[laneIndex].y + (.5 - Math.min(1, Math.max(0, along(level!, levelValue)))) * laneHeight * levelSpread;
      const tone = unit.channels.tone;
      const site: DataSite = Object.freeze({ id: unit.id, seed: componentSeed(seed, unit.id, "site"), unit,
        position: Object.freeze([x, y] as const), angle: 0, scale: 1, tone: tone ?? 0 });
      sites.push(site);
      stops.push({ lane: laneIndex, x, site, gap: level !== undefined && levelValue === null });
    }
    // Omitted rows that sit between kept units of a lane are gaps in that lane's line.
    const timeColumn = continuousColumn(data.table, time.column);
    const laneColumn = lane ? categoricalColumn(data.table, lane.column) : null;
    const rowIndex = new Map(data.table.rowIds.map((id, index) => [id, index]));
    for (const omitted of data.omitted) {
      if (omitted.reason !== "missing" && omitted.reason !== "outside-domain") continue;
      if (omitted.channel === "time") continue;
      for (const id of omitted.rowIds) {
        const row = rowIndex.get(id)!;
        const raw = timeColumn.values[row];
        if (raw === null) continue;
        const mapped = applyMeasure(time, raw);
        if (mapped === "outside") continue;
        const laneName = laneColumn ? laneColumn.values[row] : null;
        const laneClass = laneColumn ? (laneName === null ? laneColumn.categories.length : laneColumn.categories.indexOf(laneName)) : 0;
        if (laneClass >= laneCount) continue;
        const laneIndex = laneOf(laneColumn ? laneClass : null);
        stops.push({ lane: laneIndex, x: left + Math.min(1, Math.max(0, along(time, mapped))) * width, gap: true });
      }
    }
    const paths: Path[] = [];
    for (let laneIndex = 0; laneIndex < laneCount; laneIndex++) {
      const own = stops.filter((stop) => stop.lane === laneIndex).sort((a, b) => a.x - b.x);
      let run: Point[] = [], segment = 0;
      const flush = () => {
        const id = `lane:${classAt[laneIndex]}:${segment}`;
        if (run.length >= 2) paths.push(Object.freeze({ id, seed: componentSeed(seed, id, "path"),
          points: Object.freeze(run), closed: false, level: laneIndex, levelFraction: laneCount > 1 ? laneIndex / (laneCount - 1) : 0,
          tone: laneTone ? classAt[laneIndex] : 0 }));
        if (run.length > 0) segment++;
        run = [];
      };
      for (const stop of own) {
        if (stop.gap || !stop.site) { flush(); continue; }
        run.push(stop.site.position);
      }
      flush();
    }
    return Object.freeze({ sites: Object.freeze(sites), paths: Object.freeze(paths), lanes: Object.freeze(lanes) });
  });
}
