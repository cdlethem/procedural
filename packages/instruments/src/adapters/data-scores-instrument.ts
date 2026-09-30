import { sampleInputs, sampleTable } from "../composition/data-samples.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
type Option = readonly [value: string, label: string];
const control = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition, integer = false): Parameter =>
  control(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly Option[], visibleWhen?: Condition): Parameter =>
  control({ key, label, description, type: "select", options: options.map(([value, text]) => ({ value, label: text })) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter =>
  control(toggle(key, label, description), visibleWhen);

/** Columns are addressed by position: every bundled table has three measures and two categories. */
export const measureSlots = ["first", "second", "third"] as const;
export const categorySlots = ["first", "second"] as const;
/**
 * Options carry human labels that name the column each slot resolves to in every bundled table
 * (the stored values stay `first`/`second`/`third`). Labels are generated from the tables themselves,
 * so they cannot drift from what the drawing reads.
 */
const columnNames = (kind: "continuous" | "categorical") => sampleInputs.map((input) =>
  sampleTable(input.id).columns.filter((column) => column.kind === kind).map((column) => column.name));
const ordinals = ["1st", "2nd", "3rd"];
const slotLabel = (kind: "continuous" | "categorical", slot: number) =>
  `${ordinals[slot]} ${kind === "continuous" ? "numeric" : "category"} column (${columnNames(kind).map((names) => names[slot]).join(" · ")})`;
const resolution = (kind: "continuous" | "categorical") => ` Picks a column by position, so what it reads depends on the Table: ${
  sampleInputs.map((input, index) => `${input.title ?? input.id}: ${columnNames(kind)[index].join(", ")}`).join("; ")} (columns listed 1st, 2nd, 3rd).`;
const measureOptions: readonly Option[] = measureSlots.map((slot, index): Option => [slot, slotLabel("continuous", index)]);
const optionalMeasure: readonly Option[] = [["none", "None"], ...measureOptions];
const categoryOptions: readonly Option[] = categorySlots.map((slot, index): Option => [slot, slotLabel("categorical", index)]);
const optionalCategory: readonly Option[] = [["none", "None"], ...categoryOptions];
const requiredCategory: readonly Option[] = categoryOptions;
const numericPick = resolution("continuous"), categoryPick = resolution("categorical");

const grid: Condition = { layout: ["lattice"] };
const tree: Condition = { layout: ["treemap"] };
const score: Condition = { layout: ["timeline"] };
const merging: Condition = { layout: ["lattice", "treemap"] };
const merged: Condition = { layout: ["lattice", "treemap"], groupBy: ["first", "second"] };
const sorted: Condition = { layout: ["lattice", "treemap"], order: ["sorted"] };
const marked: Condition = { layout: ["lattice", "timeline"] };
const sizeMapped: Condition = { sizeBy: ["first", "second", "third"] };
const markSized: Condition = { layout: ["lattice", "timeline"], sizeBy: ["first", "second", "third"] };
const filled: Condition = { layout: ["treemap"] };
const framed: Condition = { layout: ["treemap"], frame: [true] };
const lined: Condition = { layout: ["timeline"], line: ["ink", "stitch"] };
const keyed: Condition = { parts: ["both", "key"] };
const drawing: Condition = { parts: ["both", "drawing"] };

export const dataScoresDefinition: InstrumentDefinition = {
  id: "data-scores",
  title: "Data Scores",
  description: "Recorded values decide structure: which cell, how large, how loose, how much area, when along a score. Three bundled tables with missing values, a lattice, an exact-area treemap and a timeline, and a small key generated from the mapping.",
  procedure: "A table of monthly library loans is read row by row, and each month becomes a mark in its genre's lane. The mark is lifted by loan count, sized by the share returned late and coloured by season, with hollow rings where a value is missing.",
  renderer: "2d",
  parameters: [
    select("dataset", "Table", "The recorded table. All three have three numeric columns and two category columns, with some values missing, so any column choice below works with any table; columns are chosen by position and the labels list what each position is in every table.",
      sampleInputs.map((input): Option => [input.id, input.title ?? input.id])),
    select("timeBy", "Time measure", "The measure that orders the rows in time. It sets the window and, in a timeline, the horizontal position of every row." + numericPick, measureOptions),
    n("windowStart", "Window start", "Where the temporal window opens, as a fraction of the time measure's range. Rows before it are left out of everything, including merged groups.", 0, 1, .01, 0, .99),
    n("windowLength", "Window length", "How much of the time range the window spans, as a fraction. In a timeline the window fills the whole width, so a short window zooms in.", .05, 1, .01, .01, 1),
    select("missing", "Missing values", "How a row with a missing value in a mapped channel is drawn. Gap draws nothing; ghost draws a pale ring or region outline, so absence stays visible. Either way the row keeps its place, and a timeline line breaks where the height is missing. A row missing its time or area has no place and is always left out.",
      [["gap", "Leave a gap"], ["ghost", "Show a ghost"]]),
    select("groupBy", "Merge rows by", "Merge every row of a category into one unit, so a cell or a region stands for a whole category. None keeps one unit per row." + categoryPick,
      [["none", "Keep every row"], ...categoryOptions], merging),
    select("aggregate", "Merge with", "How measures combine within a merged category. Missing values are skipped; a category with no value stays missing rather than becoming zero.",
      [["sum", "Sum"], ["mean", "Mean"], ["median", "Median"], ["max", "Largest"], ["min", "Smallest"], ["count", "Count of values"]], merged),

    select("layout", "Layout", "Lattice: one cell per unit, some cells drifting. Treemap: one region per unit with area exactly proportional to a measure. Timeline: rows placed along time, one lane per category.",
      [["lattice", "Lattice"], ["treemap", "Treemap"], ["timeline", "Timeline"]]),
    select("order", "Order", "How units take their cells or splits. Table keeps the recorded order, sorted orders by a measure, shuffled is a stable seeded permutation.",
      [["table", "Table order"], ["sorted", "Sorted"], ["shuffled", "Shuffled"]], merging),
    select("sortBy", "Sort by", "The measure that orders the units, lowest first (missing values last)." + numericPick, measureOptions, sorted),
    flag("descending", "Largest first", "Reverse the sort.", sorted),
    select("looseBy", "Drift by", "The measure that decides how far each cell drifts: high values drift furthest, low ones stay on the grid. None lets every cell drift." + numericPick, optionalMeasure, grid),
    n("looseness", "Looseness", "Largest drift as a fraction of a cell. Zero is the exact grid.", 0, 1, .01, 0, 1, grid),
    n("correlation", "Drift correlation", "How many cells share a drift direction; small values scatter neighbours, large ones move whole patches together.", 1, 12, .5, 1, 64, grid),
    select("areaBy", "Area measure", "The measure whose value is each region's area. Areas are exactly proportional; rows without a value have no region." + numericPick, measureOptions, tree),
    select("laneBy", "Lanes", "One lane per category, stacked in category order; None draws a single lane." + categoryPick, optionalCategory, score),
    select("laneOrder", "Lane order", "Stack lanes in the table's category order, or re-deal them with the seed. Categories have no natural order, so a new seed gives a different stack; every mark keeps its own lane.",
      [["declared", "Category order"], ["shuffled", "Seeded shuffle"]], { layout: ["timeline"], laneBy: ["first", "second"] }),
    select("levelBy", "Height measure", "The measure that lifts each mark inside its lane; missing values sit on the lane's centre line and break the line." + numericPick, optionalMeasure, score),
    n("levelSpread", "Lane spread", "How much of a lane's height the height measure uses.", 0, 1, .01, 0, 1, score),

    n("centerX", "Center X", "Horizontal centre of the footprint.", 0, 640, 1, -4096, 4096, drawing),
    n("centerY", "Center Y", "Vertical centre of the footprint.", 0, 640, 1, -4096, 4096, drawing),
    n("width", "Width", "Width of the footprint that the layout fills.", 100, 640, 1, 1, 8192, drawing),
    n("height", "Height", "Height of the footprint that the layout fills.", 100, 640, 1, 1, 8192, drawing),

    select("sizeBy", "Size measure", "The measure that sets mark size (lattice, timeline) or fill spacing (treemap). None draws every mark at the same size." + numericPick, optionalMeasure),
    n("domainStart", "Domain start", "Where the response starts, as a fraction of the measure's range: values at or below it get the smallest size.", 0, 1, .01, -4, 4, sizeMapped),
    n("domainSpan", "Domain span", "How much of the range the response covers. A narrow span exaggerates differences and pushes the rest to the ends.", .1, 1, .01, .001, 8, sizeMapped),
    select("curve", "Response curve", "How value becomes size: linear, square-root (lifts small values) or square (favours large ones).", [["linear", "Linear"], ["sqrt", "Square root"], ["square", "Square"]], sizeMapped),
    select("outside", "Outside the domain", "Values beyond the domain: clamp to the end sizes, extrapolate the curve (marks can vanish or grow), or leave that mark out (the row keeps its place).", [["clamp", "Clamp"], ["extrapolate", "Extrapolate"], ["omit", "Leave out"]], sizeMapped),
    select("toneBy", "Color by", "The category that picks each unit's palette color. Categories beyond the palette reuse colors; None uses the first color." + categoryPick, optionalCategory),

    select("vocabulary", "Marks", "One mark for every unit, or a different one per category.",
      [["dots", "Dots"], ["rings", "Rings"], ["rosettes", "Rosettes"], ["arrows", "Arrows"], ["by-category", "By category"]], marked),
    select("markRole", "Form by", "The category that picks dot, ring, rosette or arrow, in that order." + categoryPick, requiredCategory, { layout: ["lattice", "timeline"], vocabulary: ["by-category"] }),
    n("maxSize", "Largest mark", "Mark diameter at the top of the domain (or for every mark when no size measure is chosen).", 4, 60, .5, 0, 500, marked),
    n("minSize", "Smallest mark", "Mark diameter at the bottom of the domain.", 0, 30, .5, 0, 500, markSized),
    n("markWeight", "Mark line weight", "Stroke width of rings, rosette petals and arrows.", .2, 4, .05, 0, 50,
      { layout: ["lattice", "timeline"], vocabulary: ["rings", "rosettes", "arrows", "by-category"] }),
    n("petals", "Petals", "Radial strokes in each rosette.", 3, 14, 1, 1, 48, { layout: ["lattice", "timeline"], vocabulary: ["rosettes", "by-category"] }, true),
    n("opening", "Opening", "Open centre of rosettes or the inner ring offset of rings.", 0, .9, .01, 0, 1,
      { layout: ["lattice", "timeline"], vocabulary: ["rings", "rosettes", "by-category"] }),

    select("fill", "Fill", "How every region is filled, or a different vocabulary per category.",
      [["hatch", "Hatch"], ["motifs", "Dots"], ["contours", "Contours"], ["by-category", "By category"]], filled),
    select("fillRole", "Fill by", "The category that picks hatch, dots or contours, in that order." + categoryPick, requiredCategory, { layout: ["treemap"], fill: ["by-category"] }),
    n("spacingDense", "Densest spacing", "Distance between hatch lines or dots for the largest values (or everywhere when no size measure is chosen).", 3, 24, .5, 1, 1000, filled),
    n("spacingSparse", "Sparsest spacing", "Spacing at the bottom of the domain.", 3, 40, .5, 1, 1000, { layout: ["treemap"], sizeBy: ["first", "second", "third"] }),
    n("angle", "Hatch angle", "Direction of hatch lines, in degrees.", -90, 90, 1, -3600, 3600, { layout: ["treemap"], fill: ["hatch", "by-category"] }),
    n("fillWeight", "Fill line weight", "Stroke width of hatch lines and contours.", .2, 3, .05, 0, 50, { layout: ["treemap"], fill: ["hatch", "contours", "by-category"] }),
    n("underpaint", "Tint", "Opacity of the flat color laid under each region's fill.", 0, 1, .01, 0, 1, filled),
    n("gap", "Gap", "Space left between neighbouring regions. Areas stay exact; the gap is taken from inside each region.", 0, 20, .5, 0, 200, filled),
    flag("frame", "Outline regions", "Draw a fine outline around every region.", filled),
    n("frameWeight", "Outline weight", "Stroke width of the region outlines.", .2, 3, .05, 0, 20, framed),

    select("line", "Score line", "Join consecutive marks of a lane in time order with ink or stitches. The line breaks wherever a reading is missing.",
      [["none", "None"], ["ink", "Ink"], ["stitch", "Stitches"]], score),
    n("lineWeight", "Line weight", "Stroke width of the score lines.", .2, 4, .05, 0, 50, lined),
    n("lineSpacing", "Stitch spacing", "Distance between stitch stations along a score line.", 3, 30, .5, .5, 1000, { layout: ["timeline"], line: ["stitch"] }),
    flag("guides", "Lane guides", "Draw a faint rule through every lane's centre, with the lane's category name at its left end.", score),

    select("parts", "Draw", "The drawing and its key, only the drawing, or only the key. Add the same table twice, once as key only, to place the key as its own layer.",
      [["both", "Drawing and key"], ["drawing", "Drawing only"], ["key", "Key only"]]),
    n("keyX", "Key X", "Left edge of the key.", 0, 640, 1, -4096, 4096, keyed),
    n("keyY", "Key Y", "Top edge of the key.", 0, 640, 1, -4096, 4096, keyed),
    n("keyScale", "Key scale", "Size of the key.", .5, 2, .05, .3, 4, keyed),
  ],
  controlGroups: [
    { label: "Data", stage: "form", controls: ["dataset", "timeBy", { label: "Window", controls: ["windowStart", "windowLength"] }, "missing",
      { label: "Merge", controls: ["groupBy", "aggregate"] }] },
    { label: "Layout", stage: "form", controls: ["layout", { label: "Order", controls: ["order", "sortBy", "descending"] },
      { label: "Lattice", controls: ["looseBy", "looseness", "correlation"] }, { label: "Treemap", controls: ["areaBy"] },
      { label: "Timeline", controls: ["laneBy", "laneOrder", "levelBy", "levelSpread"] }] },
    { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }] },
    { label: "Mapping", stage: "process", controls: ["sizeBy", { label: "Response", controls: ["domainStart", "domainSpan", "curve", "outside"] }, "toneBy"] },
    { label: "Marks", stage: "material", controls: ["vocabulary", "markRole", { label: "Scale", controls: ["maxSize", "minSize", "markWeight"], proportional: true },
      { label: "Shape", controls: ["petals", "opening"] }] },
    { label: "Fill", stage: "material", controls: ["fill", "fillRole", { label: "Spacing", controls: ["spacingDense", "spacingSparse"] }, "angle", "fillWeight",
      "underpaint", "gap", { label: "Outline", controls: ["frame", "frameWeight"] }] },
    { label: "Score line", stage: "material", controls: ["line", "lineWeight", "lineSpacing", "guides"] },
    { label: "Key", stage: "material", controls: ["parts", "keyX", "keyY", "keyScale"] },
  ] satisfies ControlGroup[],
  defaults: {
    dataset: "loans", timeBy: "first", windowStart: 0, windowLength: 1, missing: "ghost", groupBy: "none", aggregate: "sum",
    layout: "timeline", order: "table", sortBy: "first", descending: false,
    looseBy: "none", looseness: .4, correlation: 3, areaBy: "second",
    laneBy: "first", laneOrder: "shuffled", levelBy: "second", levelSpread: .8,
    centerX: 340, centerY: 235, width: 470, height: 360,
    sizeBy: "third", domainStart: 0, domainSpan: 1, curve: "linear", outside: "clamp", toneBy: "second",
    vocabulary: "dots", markRole: "first", maxSize: 26, minSize: 6, markWeight: 1.2, petals: 8, opening: .3,
    fill: "hatch", fillRole: "first", spacingDense: 5, spacingSparse: 16, angle: 45, fillWeight: 1, underpaint: .3, gap: 3,
    frame: true, frameWeight: .8,
    line: "ink", lineWeight: 1.2, lineSpacing: 7, guides: true,
    parts: "both", keyX: 28, keyY: 438, keyScale: 1,
  },
};
