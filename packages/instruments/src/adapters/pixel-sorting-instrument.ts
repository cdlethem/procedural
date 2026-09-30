import { bundledRasterIds, bundledRasterInfo } from "../composition/raster-samples.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { numeric, toggle } from "./types.js";

type Condition = NonNullable<Parameter["visibleWhen"]>;
type Option = readonly [value: string, label: string];
const control = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition, integer = false): Parameter =>
  control(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly Option[], visibleWhen?: Condition): Parameter =>
  control({ key, label, description, type: "select", options: options.map(([value, text]) => ({ value, label: text })) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter =>
  control(toggle(key, label, description), visibleWhen);

/** Values a run can be selected or ordered by. All are read from the sRGB-encoded image, as sorters conventionally do. */
const valueOptions: readonly Option[] = [
  ["luma", "Brightness (luma)"], ["lightness", "Lightness (CIE L*)"], ["hue", "Hue"], ["saturation", "Saturation"],
];
const valueNote = " Brightness is the display gray (Rec. 709 weights on the encoded color), lightness is perceptual CIE L*, hue runs around the color wheel from red (0) with grays counted as 0, and saturation is HSV chroma over value.";

/** The bundled subjects; the library never fetches or decodes an image, so a host-supplied image binds through host work. */
const imageOptions: readonly Option[] = bundledRasterIds.map((id): Option => [id, `${bundledRasterInfo[id].title}: ${bundledRasterInfo[id].character}`]);

const masked: Condition = { protect: ["ellipse", "region", "edges", "field"] };
const focused: Condition = { protect: ["ellipse", "region"] };
const ellipse: Condition = { protect: ["ellipse"] };
const region: Condition = { protect: ["region"] };
const share: Condition = { protect: ["edges", "field"] };
const field: Condition = { protect: ["field"] };
const grown: Condition = { protect: ["region", "edges"] };
const limited: Condition = { limitRuns: [true] };
const ragged: Condition = { ragged: [true] };
const merging: Condition = { show: ["all", "sorted"] };
const stitched: Condition = { mark: ["stitches"] };
const outlined: Condition = { runLines: ["ink", "stitch"] };
const outlineStitch: Condition = { runLines: ["stitch"] };

export const pixelSortingDefinition: InstrumentDefinition = {
  id: "pixel-sorting",
  title: "Pixel Sorting",
  description: "Ordered streaks that selectively dissolve an image while a protected region stays exact: pick the scan direction, the value interval that decides which stretches are sorted, the sort key and order, and drawn as merged vector bars or stitch-like streaks.",
  renderer: "2d",
  parameters: [
    select("image", "Source image", "The bundled sample image that is scanned. Each is a deterministic synthetic picture, not a photograph; binding your own image to a Studio layer is future host work, and the library functions already accept any raster you construct." +
      " " + bundledRasterIds.map((id) => `${bundledRasterInfo[id].title}: ${bundledRasterInfo[id].character}.`).join(" "), imageOptions),
    n("resolution", "Resolution", "Pixels along each side of the working image. Every pixel is one unit of the sort, so a larger value gives finer streaks and more marks; the streak count is limited (40,000) and a larger image or a smaller merge tolerance can reach it.", 48, 192, 1, 16, 256, undefined, true),

    n("centerX", "Center X", "Horizontal centre of the image on the canvas.", 0, 640, 1, -4096, 4096),
    n("centerY", "Center Y", "Vertical centre of the image on the canvas.", 0, 640, 1, -4096, 4096),
    n("width", "Width", "Width the image is stretched to. Width and height are independent, so a different ratio stretches the picture; the sort itself is unchanged.", 100, 640, 1, 1, 8192),
    n("height", "Height", "Height the image is stretched to.", 100, 640, 1, 1, 8192),

    select("direction", "Scan direction", "The straight line along which pixels are visited and sorted. Right and left, down and up, and the four diagonals. A line is one row, one column or one diagonal of the image; direction decides where a sorted run starts and, with descending order, which end its light pixels collect at.",
      [["right", "Right (along rows)"], ["left", "Left"], ["down", "Down (along columns)"], ["up", "Up"],
        ["down-right", "Diagonal down-right"], ["down-left", "Diagonal down-left"], ["up-right", "Diagonal up-right"], ["up-left", "Diagonal up-left"]]),
    select("selectBy", "Select by", "The value that decides which pixels join a sorted run." + valueNote, valueOptions),
    n("selectFrom", "Interval start", "Lowest value (0 to 1) a pixel may have to be sorted. Pixels outside the interval, and the run they end, stay exactly where they are.", 0, 1, .01, 0, 1),
    n("selectSpan", "Interval width", "How much of the value range the interval covers above its start; the interval is inclusive at both ends and stops at 1. A narrow interval sorts only a slice of tones, so runs are short and scattered; the full range sorts every line completely.", .02, 1, .01, .005, 1),
    n("minRun", "Shortest run", "Runs shorter than this many pixels are left unsorted, which removes speckle and keeps short details intact.", 2, 40, 1, 1, 1000, undefined, true),
    flag("limitRuns", "Cap run length", "Cut long runs into pieces of nearly equal length so streaks stay short and the image dissolves into tiles rather than long smears."),
    n("maxRun", "Longest run", "A run longer than this many pixels is cut into the fewest nearly equal pieces that are each at most this long. Pieces can be shorter than the shortest run, never shorter than half this length.", 6, 120, 1, 2, 1000, limited, true),
    flag("ragged", "Ragged edges", "Bend the selection with a smooth seeded field so runs start and stop irregularly instead of exactly at the interval. A new seed gives a different pattern."),
    n("scatter", "Ragged amount", "How far the field can move a pixel's value before the interval test, up to about twice this in value. Zero would be an exact interval.", 0, .5, .01, 0, 1, ragged),
    n("scatterScale", "Ragged scale", "Size of the field's features in image pixels. Small values fray the edge of each run, large ones move whole regions in and out of the selection.", 2, 40, 1, 1, 500, ragged),

    select("keyBy", "Sort by", "The value each run is ordered by. Ties keep the order in which the pixels were visited, in both orders, so equal pixels never swap." + valueNote, valueOptions, merging),
    select("order", "Order", "Ascending puts the lowest values first along the scan direction, descending puts the highest first. The pixels of a run are only rearranged inside that run: nothing is moved between runs or into protected pixels.",
      [["ascending", "Ascending (low first)"], ["descending", "Descending (high first)"]], merging),

    select("protect", "Region", "What keeps a part of the image out of the sort. None sorts wherever the interval selects. Ellipse marks an ellipse you place; Connected region takes the piece of one tone band that lies under a point (like a magic wand); Strong edges marks the sharpest contours; Noise field marks seeded blobs.",
      [["none", "None"], ["ellipse", "Ellipse"], ["region", "Connected region"], ["edges", "Strong edges"], ["field", "Noise field"]]),
    select("maskRole", "Region acts as", "Protected pixels are never moved and split every run they touch; the alternative sorts only inside the region and leaves everything outside it exactly as it was.",
      [["protect", "Protected (stays exact)"], ["select", "The only place that sorts"]], masked),
    n("focusX", "Focus X", "Horizontal position of the ellipse centre, or of the point that picks the connected region, as a fraction of the image width.", 0, 1, .01, 0, 1, focused),
    n("focusY", "Focus Y", "Vertical position, as a fraction of the image height.", 0, 1, .01, 0, 1, focused),
    n("focusWidth", "Ellipse width", "Width of the ellipse as a fraction of the image width.", .05, 1, .01, .01, 4, ellipse),
    n("focusHeight", "Ellipse height", "Height of the ellipse as a fraction of the image height.", .05, 1, .01, .01, 4, ellipse),
    n("bands", "Tone bands", "How many equal value bands (lightness) split the image before the region under the focus point is taken. Few bands give a large region that spreads across gradients; many bands keep only a small patch of nearly one tone. Regions smaller than 0.4% of the image merge into their neighbours.", 2, 8, 1, 2, 64, region, true),
    n("share", "Share of the image", "For strong edges, the fraction of pixels with the strongest gradient that are marked (flat areas are never marked, however large this is). For the noise field, the fraction of the image the blobs cover.", 0, .8, .01, 0, 1, share),
    n("fieldScale", "Blob size", "Size of one noise blob in image pixels.", 4, 48, 1, 1, 1000, field),
    n("grow", "Grow", "Widen the region by this many pixels in every direction. Edges are one pixel wide, so a little growth makes them a real barrier that runs stop against.", 0, 6, 1, 0, 16, grown, true),

    select("show", "Draw", "Everything, only the streaks (transparent wherever the image was not sorted, so an unsorted copy underneath shows through), or only the pixels that were not sorted.",
      [["all", "Whole image"], ["sorted", "Sorted streaks only"], ["untouched", "Unsorted pixels only"]]),
    select("tint", "Color", "Use the image's own colors, or replace each pixel's color by its brightness on a gradient through the palette from its first to its last color.",
      [["image", "Image colors"], ["palette", "Palette gradient"]]),
    select("mark", "Streak mark", "Bars are flat rectangles that fill the pixels a streak covers, with a hairline in the same color so neighbours meet without seams. Stitches are short round-capped strokes with a gap between them, so the paper shows through.",
      [["bars", "Bars"], ["stitches", "Stitches"]]),
    n("merge", "Merge tolerance", "How far (in color, 0 to 1 per channel) a pixel may differ from the running average of its streak to join the same bar. Zero merges only identical colors; larger values give fewer, longer, flatter bars. Unsorted pixels are always drawn exactly, so this affects sorted streaks only.", 0, .2, .005, 0, 1, merging),
    n("stitchWidth", "Stitch thickness", "Stroke width of a stitch as a fraction of the pixel row it lies in.", .2, 1, .01, .05, 2, stitched),
    n("stitchGap", "Stitch gap", "Space left between successive stitches, as a fraction of one pixel step.", 0, .8, .01, 0, .95, stitched),

    select("runLines", "Run outlines", "Draw the outline of every sorted run with a path material: ink is a continuous line, stitches are short tangent dashes. A run is the exact set of pixels it covers, so a diagonal run is a staircase.",
      [["none", "None"], ["ink", "Ink"], ["stitch", "Stitches"]]),
    n("lineWeight", "Outline weight", "Stroke width of the run outlines.", .2, 3, .05, 0, 50, outlined),
    n("lineSpacing", "Outline stitch spacing", "Distance between stitch stations along a run outline.", 3, 24, .5, .5, 1000, outlineStitch),
  ],
  controlGroups: [
    { label: "Image", stage: "form", controls: ["image", "resolution"] },
    { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }] },
    { label: "Runs", stage: "process", controls: ["direction", { label: "Selection", controls: ["selectBy", "selectFrom", "selectSpan"] },
      { label: "Length", controls: ["minRun", "limitRuns", "maxRun"] }, { label: "Ragged edges", controls: ["ragged", "scatter", "scatterScale"] }] },
    { label: "Sort", stage: "process", controls: ["keyBy", "order"] },
    { label: "Protected region", stage: "process", controls: ["protect", "maskRole", { label: "Focus", controls: ["focusX", "focusY"] },
      { label: "Ellipse", controls: ["focusWidth", "focusHeight"], proportional: true }, "bands", "share", "fieldScale", "grow"] },
    { label: "Streaks", stage: "material", controls: ["show", "tint", "mark", "merge", { label: "Stitch", controls: ["stitchWidth", "stitchGap"] }] },
    { label: "Run outlines", stage: "material", controls: ["runLines", "lineWeight", "lineSpacing"] },
  ] satisfies ControlGroup[],
  defaults: {
    image: "portrait", resolution: 128,
    centerX: 320, centerY: 320, width: 480, height: 480,
    direction: "down", selectBy: "luma", selectFrom: 0, selectSpan: .68, minRun: 6, limitRuns: false, maxRun: 40,
    ragged: true, scatter: .12, scatterScale: 10,
    keyBy: "luma", order: "ascending",
    protect: "ellipse", maskRole: "protect", focusX: .5, focusY: .4, focusWidth: .6, focusHeight: .74, bands: 4, share: .2, fieldScale: 16, grow: 1,
    show: "all", tint: "image", mark: "bars", merge: .03, stitchWidth: .7, stitchGap: .3,
    runLines: "none", lineWeight: .8, lineSpacing: 6,
  },
};
