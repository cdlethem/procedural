import type { CompartmentsComposition } from "../composition/compartments-draw.js";
import { bundledRasterIds } from "../composition/raster-samples.js";
import type { BundledRasterId } from "../composition/raster-samples.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
type Scalar = number | string | boolean;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, integer = false, visibleWhen?: Condition): Parameter => {
  const parameter = numeric(key, label, description, min, max, step, { hardMin, hardMax, integer });
  return visibleWhen ? { ...parameter, visibleWhen } : parameter;
};
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter => {
  const parameter = choice(key, label, description, options);
  return visibleWhen ? { ...parameter, visibleWhen } : parameter;
};

const detail: Condition = { filler: ["detail"] };
const marked: Condition = { filler: ["detail", "hatch", "dots", "motif"] };
const spaced: Condition = { filler: ["detail", "hatch", "dots"] };
const stroked: Condition = { filler: ["detail", "hatch", "motif"] };
const toned: Condition = { filler: ["detail", "hatch"] };
const glyphed: Condition = { filler: ["detail", "motif"] };
const bordered: Condition = { border: ["ink", "stitch", "beads"] };

const controlGroups: readonly ControlGroup[] = [
  { label: "Source", stage: "form", controls: ["image", "variant", "resolution", "measure",
    { label: "Crop", controls: ["zoom", "focusX", "focusY"] }] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }] },
  { label: "Partition", stage: "form", controls: ["metric", "threshold", "split", { label: "Cell size", controls: ["minCell", "maxCell"], proportional: true }] },
  { label: "Negative space", stage: "material", controls: ["retained", "keepBy", "gutter"] },
  { label: "Filler", stage: "material", controls: ["filler", "color", "body",
    { label: "Size classes", controls: ["hatchBelow", "glyphBelow"], proportional: true }, "mixing",
    { label: "Lines and dots", controls: ["spacing", "weight", "angle", "toneResponse", "dotMax", "smoothing"] },
    { label: "Glyph", controls: ["glyphKind", "glyphFit", "petals", "opening"] },
    { label: "Border", controls: ["border", "borderWeight", "borderSpacing", "borderMin"] }] },
];

export const compartmentsDefinition: InstrumentDefinition = {
  id: "adaptive-compartments", title: "Adaptive Compartments",
  description: "A picture divided into a mosaic whose cell size follows its detail: big quiet cells where the image is flat, small ones along its edges. Each cell is filled by a replaceable technique (flat color, hatching along the local direction, halftone dots, a nested glyph, a stitched border), and a retained fraction leaves the rest as open paper.",
  procedure: "Divide a picture into rectangles, splitting a cell while its detail score exceeds a threshold, so flat areas stay large and edges break into small cells. Fill each cell from its own image: flat colour, edge-aligned hatching or glyphs by size, keeping a share open.",
  renderer: "2d",
  parameters: [
    select("image", "Source image", "Bundled sample picture the mosaic is measured on: a soft portrait, a hard-edged geometric scene, a landscape, or worst-case grain. Your own images bind through the host when it supports them.", [...bundledRasterIds]),
    n("variant", "Image variant", "The sample's own seed: it re-arranges and re-tints the picture (a different head, a different horizon), not just the mosaic.", 0, 99, 1, 0, 9999, true),
    n("resolution", "Detail resolution", "Pixels across the sample. More pixels resolve finer edges, so small cells can follow them; fewer are faster and blunter. It never changes the picture's layout.", 48, 256, 8, 16, 512, true),
    select("measure", "Detail measured in", "Lightness splits wherever the picture changes brightness; saturation splits where its colorfulness changes.", ["lightness", "saturation"]),
    n("zoom", "Zoom", "How much closer than the whole picture the mosaic looks. Values above 1 crop into the subject.", 1, 4, .05, 1, 16),
    n("focusX", "Crop X", "Slides a zoomed crop across the picture, 0 at the left edge, 1 at the right. No effect at zoom 1.", 0, 1, .01, 0, 1),
    n("focusY", "Crop Y", "Slides a zoomed crop down the picture, 0 at the top, 1 at the bottom. No effect at zoom 1.", 0, 1, .01, 0, 1),
    n("centerX", "Center X", "Horizontal center of the mosaic in canvas units.", 80, 560, 1, -1000, 1600),
    n("centerY", "Center Y", "Vertical center of the mosaic in canvas units.", 80, 560, 1, -1000, 1600),
    n("width", "Width", "Width of the mosaic in canvas units. The cropped picture is fitted to it exactly.", 200, 620, 1, 32, 1000),
    n("height", "Height", "Height of the mosaic in canvas units.", 200, 620, 1, 32, 1000),
    select("metric", "Error metric", "How a cell's detail is scored: standard deviation averages over all its pixels; range is set by its two extremes, so a single hard edge or speck is enough to split it.", ["stddev", "range"]),
    n("threshold", "Error threshold", "A cell splits while its detail score is above this percentage of the full lightness range. Lower values split more: more, smaller cells. Cells that stop splitting are quiet at their own scale.", 1, 30, .5, 0, 100),
    select("split", "Split policy", "quad halves both sides, the square mosaic of a quadtree; longest halves only the longer side, keeping cells nearly square; best chooses the cut that separates dark from light most cleanly.", ["quad", "longest", "best"]),
    n("minCell", "Smallest cell", "Shortest side any cell may have, in canvas units. Detail finer than this is averaged into its cell. Must be larger than the gutter.", 3, 40, .5, 1, 200),
    n("maxCell", "Largest cell", "Cells with a side longer than this always split, even in flat areas, so the mosaic never has a huge blank compartment. At least twice the smallest cell.", 40, 400, 5, 8, 2000),
    n("retained", "Retained cells", "Share of cells drawn; the rest stay as open paper. 1 draws every cell.", 0, 1, .01, 0, 1),
    select("keepBy", "Retain by", "Which cells stay when some are dropped: chance draws them at random (the seed rearranges); detailed keeps the busiest, so flat areas open up; quiet keeps the flattest; dark or light keeps that tone.", ["chance", "detailed", "quiet", "dark", "light"]),
    n("gutter", "Gutter", "Clear space between neighbouring cells, in canvas units: each cell is drawn this much smaller than its slot. Less than the smallest cell.", 0, 12, .5, 0, 100),
    select("filler", "Filler", "detail picks by cell size (large flat, middle hatched, small glyphs); the others use one technique everywhere: flat color, hatching, halftone dots, or one glyph per cell.", ["detail", "flat", "hatch", "dots", "motif"]),
    select("color", "Color source", "image uses each cell's average color; palette snaps that to the nearest palette color; ink uses only the first palette color, darker cells inking more.", ["image", "palette", "ink"]),
    n("body", "Body opacity", "Opacity of the flat color under each cell's marks; flat cells are drawn at this opacity.", 0, 1, .01, 0, 1),
    n("hatchBelow", "Hatch below", "Cells whose shorter side is under this many canvas units get hatching; larger ones stay flat.", 10, 160, 1, 0, 2000, false, detail),
    n("glyphBelow", "Glyph below", "Cells whose shorter side is under this many canvas units get a glyph instead of hatching.", 4, 80, 1, 0, 2000, false, detail),
    n("mixing", "Class mixing", "How far each cell's size limits wander by a stable per-cell draw, so hatched, flat and glyph cells interleave at the borders between size classes. The seed changes which cells change class. 0 keeps strict size classes.", 0, 1, .01, 0, 1, false, detail),
    n("spacing", "Mark spacing", "Hatch line spacing at mid tone, and the pitch of the halftone dot lattice, in canvas units.", 2, 16, .5, 1.5, 200, false, spaced),
    n("weight", "Line weight", "Stroke width of hatch lines and glyph outlines.", .3, 4, .1, 0, 50, false, stroked),
    n("angle", "Angle offset", "Degrees added to the direction of the picture's edges in the cell (0 runs along them, 90 across); where the picture gives no direction it is the whole angle.", -90, 90, 1, -3600, 3600, false, marked),
    n("toneResponse", "Tone response", "How much darker cells hatch tighter and lighter cells looser, in octaves of line spacing between white and black. 0 spaces every cell alike.", 0, 2, .05, 0, 4, false, toned),
    n("dotMax", "Largest dot", "Diameter of the biggest halftone dot as a share of the lattice pitch. Above 1 dots in dark cells merge.", .2, 1.4, .05, 0, 1.5, false, { filler: ["dots"] }),
    n("smoothing", "Direction smoothing", "How widely, in canvas units, the picture's edge direction is averaged before a cell reads it. Larger values give calmer, more uniform directions.", 0, 30, .5, 0, 100, false, marked),
    select("glyphKind", "Glyph", "The mark nested in a glyph cell: a dot, rings, a rosette of petals or an arrow. It turns to the cell's direction.", ["dot", "rings", "rosette", "arrow"], glyphed),
    n("glyphFit", "Glyph size", "Glyph diameter as a share of the cell's shorter side.", .3, 1, .01, 0, 1, false, glyphed),
    n("petals", "Petals", "Petals of a rosette glyph.", 3, 12, 1, 1, 48, true, { filler: ["detail", "motif"], glyphKind: ["rosette"] }),
    n("opening", "Opening", "How hollow a rings or rosette glyph is at its center.", 0, .8, .05, 0, 1, false, { filler: ["detail", "motif"], glyphKind: ["rings", "rosette"] }),
    select("border", "Border", "A line drawn around each large-enough cell with the path material: solid ink, stitches or beads. none leaves the cell edges bare.", ["none", "ink", "stitch", "beads"]),
    n("borderWeight", "Border weight", "Stroke width of the border line, stitches or beads.", .3, 3, .1, 0, 50, false, bordered),
    n("borderSpacing", "Stitch spacing", "Distance between stitches or beads along the border.", 3, 16, .5, .5, 1000, false, { border: ["stitch", "beads"] }),
    n("borderMin", "Border from", "Cells whose shorter side is under this many canvas units get no border, so small detail cells stay uncluttered.", 8, 120, 1, 0, 2000, false, bordered),
  ],
  controlGroups,
  defaults: {
    image: "portrait", variant: 3, resolution: 128, measure: "lightness", zoom: 1, focusX: .5, focusY: .5,
    centerX: 320, centerY: 320, width: 560, height: 560,
    metric: "stddev", threshold: 4.5, split: "quad", minCell: 10, maxCell: 140,
    retained: 1, keepBy: "chance", gutter: 2,
    filler: "detail", color: "image", body: .85, hatchBelow: 44, glyphBelow: 15, mixing: .5,
    spacing: 5, weight: .9, angle: 0, toneResponse: 1, dotMax: 1, smoothing: 8,
    glyphKind: "rings", glyphFit: .7, petals: 6, opening: .3,
    border: "none", borderWeight: 1, borderSpacing: 6, borderMin: 40,
  },
  validate: validateCompartments,
};

/** Coupled bounds that no single control can state. */
export function validateCompartments(q: Record<string, Scalar>): void {
  if ((q.gutter as number) >= (q.minCell as number)) throw new Error(`Gutter ${q.gutter} must be smaller than the smallest cell ${q.minCell}: lower gutter or raise minCell`);
  if ((q.maxCell as number) < 2 * (q.minCell as number)) throw new Error(`Largest cell ${q.maxCell} must be at least twice the smallest cell ${q.minCell}: raise maxCell or lower minCell`);
}

/** Whether the seed can change this construction. */
export function compartmentsUsesSeed(q: Record<string, Scalar>): boolean {
  return (q.retained as number) < 1 && (q.keepBy as string) === "chance" || q.filler === "detail" && (q.mixing as number) > 0;
}

/** Resolve the validated named controls to the public descriptor. */
export function compartmentsComposition(q: Record<string, Scalar>, seed: number, palette: readonly number[]): CompartmentsComposition {
  if (!(bundledRasterIds as readonly string[]).includes(q.image as string)) throw new Error(`Unknown bundled image: ${String(q.image)}`);
  return { palette: [...palette],
    image: { kind: "bundled", id: q.image as BundledRasterId, variant: q.variant as number, resolution: q.resolution as number },
    view: { zoom: q.zoom as number, focusX: q.focusX as number, focusY: q.focusY as number },
    plan: { seed, centerX: q.centerX as number, centerY: q.centerY as number, width: q.width as number, height: q.height as number,
      measure: q.measure as "lightness" | "saturation", metric: q.metric as "stddev" | "range", threshold: (q.threshold as number) / 100,
      minCell: q.minCell as number, maxCell: q.maxCell as number, split: q.split as "quad" | "longest" | "best", smoothing: q.smoothing as number },
    select: { retained: q.retained as number, by: q.keepBy as "chance" | "detailed" | "quiet" | "dark" | "light", gutter: q.gutter as number },
    fill: { kind: q.filler as "detail" | "flat" | "hatch" | "dots" | "motif", color: q.color as "image" | "palette" | "ink", body: q.body as number,
      hatchBelow: q.hatchBelow as number, glyphBelow: q.glyphBelow as number, mixing: q.mixing as number, spacing: q.spacing as number,
      weight: q.weight as number, angle: q.angle as number, toneResponse: q.toneResponse as number, dotMax: q.dotMax as number,
      glyph: { kind: q.glyphKind as "dot" | "rings" | "rosette" | "arrow", fit: q.glyphFit as number, petals: q.petals as number, opening: q.opening as number },
      border: { kind: q.border as "none" | "ink" | "stitch" | "beads", weight: q.borderWeight as number, spacing: q.borderSpacing as number, minCell: q.borderMin as number } } };
}
