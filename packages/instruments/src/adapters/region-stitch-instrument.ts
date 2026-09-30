import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { bundledRasterIds, bundledRasterInfo } from "../composition/raster-samples.js";
import type { BundledRasterId } from "../composition/raster-samples.js";
import { stitchWords } from "../composition/stitch-regions.js";
import type { RegionSourceSpec, StitchWord } from "../composition/stitch-regions.js";
import type { CrossingKind, FillChoice, OutlineKind, RegionOrder, StitchOptions, UnderlayKind } from "../composition/stitch.js";
import type { StitchFieldSpec } from "../composition/stitch-field.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = NonNullable<Parameter["visibleWhen"]>;
const integerKeys = new Set(["variant", "patches", "bands", "minRegion", "fieldVariant"]);
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => (visibleWhen ? { ...parameter, visibleWhen } : parameter);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, options), visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter =>
  withCondition(toggle(key, label, description), visibleWhen);
const labelled = (parameter: Parameter, labels: Record<string, string>): Parameter =>
  ({ ...parameter, options: parameter.options!.map((option) => ({ value: option.value, label: labels[option.value] ?? option.value })) });
const pictureLabels = Object.fromEntries(bundledRasterIds.map((id) => [id, bundledRasterInfo[id].title]));

const lettered: Condition = { source: ["letters"] };
const arranged: Condition = { source: ["blob", "quilt", "tones"] };
const quilted: Condition = { source: ["quilt"] };
const toned: Condition = { source: ["tones"] };
const centered: Condition = { field: ["radial", "swirl"] };
const twisted: Condition = { field: ["swirl"] };
const pictured: Condition = { field: ["image"] };
const staggered: Condition = { fill: ["running", "mixed"] };
const scattered: Condition = { fill: ["seed", "mixed"] };
const underlaid: Condition = { underlay: ["edge", "cross", "both"] };
const crossUnderlaid: Condition = { underlay: ["cross", "both"] };
const crossed: Condition = { crossing: ["over"] };
const outlined: Condition = { outline: ["running", "satin"] };
const satin: Condition = { outline: ["satin"] };
const dashed: Condition = { thread: ["stitch", "beads"] };

const parameters: Parameter[] = [
  select("source", "Regions", "What is stitched: the letters of a word, a lobed blob with a hole and two separate islands, a Region Quilt of patches (some joined, some with windows), or the connected tone bands of a picture. Your own outlines and pictures arrive through the host; the library accepts resolved values.", ["letters", "blob", "quilt", "tones"]),
  select("word", "Word", "The word set in the licensed outline font. Counters (the holes in A, O, D) stay open.", [...stitchWords], lettered),
  n("letterWeight", "Letter weight", "Makes the strokes this much bolder on every side, in canvas units; the letters still fit the footprint. The font is light, so stitching a stroke needs a few units of weight.", 0, 14, 0.5, 0, 60, lettered),
  n("variant", "Arrangement", "Re-arranges the chosen regions (lobe phases, the quilt's cuts, the picture's parts) without touching the seed, so the stitching's own chance stays as it was.", 0, 40, 1, 0, 1000000, arranged),
  n("patches", "Patches", "How many cuts the quilt partition makes, so about this many patches.", 3, 30, 1, 1, 60, quilted),
  n("merge", "Joined patches", "The fraction of patches that join a neighbouring patch across a shared edge into an L, T or larger shape.", 0, 0.6, 0.01, 0, 1, quilted),
  n("windows", "Windows", "The fraction of the remaining rectangular patches given a rectangular hole the thread must leave open.", 0, 1, 0.01, 0, 1, quilted),
  labelled(select("image", "Source image", "Which bundled picture is cut into tone bands. Each generated picture has a different tonal character; your own pictures come through the host.", [...bundledRasterIds], toned), pictureLabels),
  n("bands", "Tone bands", "How many equal lightness bands the picture is divided into; each connected patch of a band is one region.", 2, 8, 1, 2, 8, toned),
  n("minRegion", "Smallest region", "Regions smaller than this many picture pixels (of 128 x 128) are absorbed by their longest-border neighbour, so specks do not become tiny stitched islands.", 10, 800, 5, 1, 4000, toned),
  flag("leaveLightest", "Leave lightest open", "Skip the regions of the lightest band so the paper shows through as negative space.", toned),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the regions.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the regions.", 0, 640, 1, -4096, 4096),
  n("width", "Width", "Width of the region footprint, in canvas units. Letters and pictures keep their proportions inside it.", 80, 640, 1, 8, 4096),
  n("height", "Height", "Height of the region footprint, in canvas units.", 80, 640, 1, 8, 4096),

  select("field", "Direction field", "Which way the thread lies: one constant angle, spokes from a center, a swirl that curls from spokes into rings, or the edges and stripes of a picture.", ["constant", "radial", "swirl", "image"]),
  n("angle", "Angle", "Direction in degrees, 0 along +x and positive clockwise on screen. For radial and swirl fields it turns the pattern from the spokes; for an image field it is the direction used where the picture has none.", -90, 90, 1, -3600, 3600),
  n("fieldX", "Center X offset", "Horizontal position of the field's center as a fraction of the footprint width from its middle.", -0.5, 0.5, 0.01, -2, 2, centered),
  n("fieldY", "Center Y offset", "Vertical position of the field's center as a fraction of the footprint height from its middle.", -0.5, 0.5, 0.01, -2, 2, centered),
  n("twist", "Twist", "Extra turn, in degrees per 100 canvas units of distance from the center: the thread starts on the spokes and curls as it goes outward.", -180, 180, 1, -10000, 10000, twisted),
  labelled(select("fieldImage", "Field image", "Which bundled picture's edges and stripes direct the thread. It need not be the picture the regions come from.", [...bundledRasterIds], pictured), pictureLabels),
  n("fieldVariant", "Field arrangement", "Re-arranges the field picture without touching the seed.", 0, 40, 1, 0, 1000000, pictured),
  n("follow", "Image direction", "How strongly the thread follows the picture where its structure is coherent: 0 ignores it and uses the angle, 1 follows it fully.", 0, 1, 0.01, 0, 1, pictured),
  n("smoothing", "Direction smoothing", "Averages the picture's directions over this length, in canvas units, so the thread follows shapes rather than pixel noise.", 0, 40, 0.5, 0, 300, pictured),
  n("angleSpread", "Angle spread", "Turns each region's field by its own amount within plus and minus this many degrees, drawn from the seed: 0 keeps one direction everywhere; a quilt of differently grained patches needs about 60.", 0, 90, 1, 0, 360),

  select("fill", "Fill", "Running fill: rows cut into stitches of one length, staggered. Satin: each row is a single long stitch across the shape. Seed: short stitches scattered over the region like moss. Mixed: each region draws its own choice from the seed.", ["running", "satin", "seed", "mixed"]),
  n("spacing", "Row spacing", "Distance between neighbouring rows, in canvas units (the cell size of the scatter for seed stitches). Below the thread width the rows overlap into solid cover.", 1.5, 10, 0.1, 0.8, 200),
  n("stitchLength", "Stitch length", "The longest stitch anywhere, in canvas units: running stitches are exactly this long, satin rows longer than it are cut into equal parts, seed stitches are between half of it and all of it. Connecting, outline and travel stitches obey it too.", 2, 24, 0.5, 1, 200),
  n("stagger", "Stagger", "How far the stitch ends in each row are shifted from their neighbours, drawn from the seed: 0 lines every penetration up into columns, 1 scatters them.", 0, 1, 0.01, 0, 1, staggered),
  n("scatter", "Scatter", "How far seed stitches turn away from the field: 0 lies every stitch along it, 1 lets each point in any direction.", 0, 1, 0.01, 0, 1, scattered),
  n("inset", "Region inset", "Pulls the stitching this far in from every region boundary, in canvas units. Holes grow by the same amount, so they stay open, and a region narrower than twice this vanishes.", 0, 14, 0.5, 0, 1000),

  select("underlay", "Underlay", "Thread laid first to hold the fill: along the edge, in rows across the fill direction, or both. The fill crosses it.", ["none", "edge", "cross", "both"]),
  n("underlaySpacing", "Underlay spacing", "Distance between underlay rows, in canvas units.", 3, 24, 0.5, 0.8, 200, crossUnderlaid),
  n("underlayInset", "Underlay inset", "How far inside the fill's edge the underlay stays, in canvas units.", 0, 12, 0.5, 0, 1000, underlaid),

  select("crossing", "Crossing layer", "A second layer of rows laid over the fill at another angle, so threads visibly cross.", ["none", "over"]),
  n("crossAngle", "Crossing angle", "How far the second layer turns from the fill direction, in degrees.", -90, 90, 1, -3600, 3600, crossed),
  n("crossSpacing", "Crossing spacing", "Distance between rows of the second layer, in canvas units.", 3, 30, 0.5, 0.8, 200, crossed),

  select("outline", "Outline", "Stitching along every boundary of each region (and around each hole): running stitches with a penetration at every corner, or a zigzag satin band.", ["none", "running", "satin"]),
  n("outlineWidth", "Band width", "Width of the satin outline band, measured inward from the boundary, in canvas units.", 1, 12, 0.5, 0.2, 200, satin),
  n("seam", "Seam position", "Where each outline and edge underlay begins and ends, and where each region's stitching starts: the extreme point of the boundary in this direction, in degrees (0 right, 90 down).", -180, 180, 1, -3600, 3600),
  n("lap", "Seam lap", "How far the outline thread continues past its start, overlapping itself, in canvas units.", 0, 30, 0.5, 0, 1000, outlined),
  select("order", "Region order", "Stitch regions in label order, or always continue with the nearest unstitched region.", ["label", "nearest"]),
  flag("travel", "Show travel stitches", "Draw the jumps between separate threads as visible stitches. Off, gaps and the space between regions stay empty."),

  select("thread", "Thread", "Continuous ink, dashes laid along each thread, or beads along it.", ["ink", "stitch", "beads"]),
  n("weight", "Thread width", "Stroke width of the thread, in canvas units.", 0.4, 4, 0.05, 0, 50),
  n("dash", "Dash spacing", "Distance between dashes or beads along a thread, in canvas units.", 2, 20, 0.5, 0.5, 1000, dashed),
  select("colorBy", "Color by", "Region gives each region a palette color; tone runs the palette from the lightest tone to the darkest; row alternates colors from row to row; stitch picks a color for every stitch from the seed. Underlay and travel use the first palette color; the rest use the others.", ["region", "tone", "row", "stitch"]),
  select("trim", "Outline and crossing color", "Ink uses the first palette color; region uses the region's own color; contrast uses the next palette color after it.", ["ink", "region", "contrast"],
    [{ crossing: ["over"] }, { outline: ["running", "satin"] }]),
];

const controlGroups: ControlGroup[] = [
  { label: "Regions", stage: "form", controls: ["source", "word", "letterWeight", "variant", "patches", "merge", "windows", "image", "bands", "minRegion", "leaveLightest"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }] },
  { label: "Direction", stage: "process", controls: ["field", "angle", "fieldX", "fieldY", "twist", "fieldImage", "fieldVariant", "follow", "smoothing", "angleSpread"] },
  { label: "Stitches", stage: "material", controls: ["fill", { label: "Scale", controls: ["spacing", "stitchLength"], proportional: true }, "stagger", "scatter", "inset"] },
  { label: "Underlay", stage: "material", controls: ["underlay", "underlaySpacing", "underlayInset"] },
  { label: "Crossing", stage: "material", controls: ["crossing", "crossAngle", "crossSpacing"] },
  { label: "Outline", stage: "material", controls: ["outline", "outlineWidth", "lap"] },
  { label: "Seam and routing", stage: "material", controls: ["seam", "order", "travel"] },
  { label: "Thread", stage: "material", controls: ["thread", "weight", "dash", "colorBy", "trim"] },
];

export type ThreadKind = "ink" | "stitch" | "beads";
export type StitchColorBy = "region" | "tone" | "row" | "stitch";
export type StitchTrim = "ink" | "region" | "contrast";
export interface StitchThreadSpec { kind: ThreadKind; weight: number; dash: number; colorBy: StitchColorBy; trim: StitchTrim }
/** The typed, JSON-compatible composition value: a bundled region source, the stitch construction and the thread material. */
export type StitchComposition = Omit<StitchOptions, "regions"> & { kind: "region-stitch"; palette: readonly number[]; source: RegionSourceSpec; thread: StitchThreadSpec };

type Values = Record<string, number | string | boolean>;
const BUNDLED_FIELD_SIZE = 128;

/** Resolve the stored scalar controls. Controls hidden by their conditions are dropped so they cannot reach a cache key or a drawing. */
export function regionStitchFromValues(q: Values, seed: number, palette: readonly number[]): StitchComposition {
  const v = (key: string): number => q[key] as number;
  const s = (key: string): string => q[key] as string;
  const footprint = { centerX: v("centerX"), centerY: v("centerY"), width: v("width"), height: v("height") };
  const source: RegionSourceSpec = s("source") === "letters" ? { ...footprint, kind: "letters", word: s("word") as StitchWord, weight: v("letterWeight") }
    : s("source") === "blob" ? { ...footprint, kind: "blob", variant: v("variant") }
    : s("source") === "quilt" ? { ...footprint, kind: "quilt", variant: v("variant"), patches: v("patches"), merge: v("merge"), windows: v("windows") }
    : { ...footprint, kind: "tones", image: s("image") as BundledRasterId, variant: v("variant"), bands: v("bands"), minRegion: v("minRegion"), leaveLightest: q.leaveLightest === true };
  const side = Math.min(v("width"), v("height"));
  const field: StitchFieldSpec = s("field") === "constant" ? { kind: "constant", angle: v("angle") }
    : s("field") === "radial" ? { kind: "radial", angle: v("angle"), centerX: v("centerX") + v("fieldX") * v("width"), centerY: v("centerY") + v("fieldY") * v("height") }
    : s("field") === "swirl" ? { kind: "swirl", angle: v("angle"), twist: v("twist"), centerX: v("centerX") + v("fieldX") * v("width"), centerY: v("centerY") + v("fieldY") * v("height") }
    : { kind: "image", angle: v("angle"), follow: v("follow"), smoothing: v("smoothing"), image: { kind: "bundled", id: s("fieldImage") as BundledRasterId, variant: v("fieldVariant"), size: BUNDLED_FIELD_SIZE },
      frame: { centerX: v("centerX"), centerY: v("centerY"), width: side, height: side, rotation: 0 } };
  const rule = s("fill") as FillChoice, underlay = s("underlay") as UnderlayKind, crossing = s("crossing") as CrossingKind, outline = s("outline") as OutlineKind;
  const thread = s("thread") as ThreadKind;
  return {
    kind: "region-stitch", seed, palette: [...palette], source, field, origin: [v("centerX"), v("centerY")],
    fill: { rule, spacing: v("spacing"), length: v("stitchLength"), stagger: rule === "running" || rule === "mixed" ? v("stagger") : 0,
      scatter: rule === "seed" || rule === "mixed" ? v("scatter") : 0, angleSpread: v("angleSpread"), inset: v("inset") },
    underlay: { kind: underlay, spacing: underlay === "cross" || underlay === "both" ? v("underlaySpacing") : 6, inset: underlay === "none" ? 0 : v("underlayInset") },
    crossing: { kind: crossing, angle: crossing === "over" ? v("crossAngle") : 0, spacing: crossing === "over" ? v("crossSpacing") : 6 },
    outline: { kind: outline, width: outline === "satin" ? v("outlineWidth") : 1, lap: outline === "none" ? 0 : v("lap") },
    seam: v("seam"), routing: { order: s("order") as RegionOrder, travel: q.travel === true },
    thread: { kind: thread, weight: v("weight"), dash: thread === "ink" ? 4 : v("dash"), colorBy: s("colorBy") as StitchColorBy,
      trim: outline === "none" && crossing === "none" ? "ink" : (s("trim") as StitchTrim) },
  };
}

// No stored-values-only validation exists: the stitch, thread, row and step bounds depend on the regions' area and are enforced
// exactly while building (`stitch.ts`), with messages naming Row spacing and Stitch length.

/** Whether the seed can change this construction. */
export function regionStitchUsesSeed(q: Values): boolean {
  return q.fill === "seed" || q.fill === "mixed" || Number(q.angleSpread) > 0 || (q.fill === "running" && Number(q.stagger) > 0) || q.crossing === "over" || q.colorBy === "stitch";
}

export const regionStitchDefinition: InstrumentDefinition = {
  id: "region-stitch", title: "Region Stitch",
  description: "Fill regions with directional stitching: rows or scattered stitches follow a field inside letters, blobs, quilt patches or picture tones, over underlay, with satin outlines, a seam and threads that visibly cross.",
  procedure: "Each patch of a quilt is filled with thread the way an embroiderer works, underlay first and then rows of short stitches with staggered ends. The thread hops to the nearest unfilled row, and a zigzag satin border runs around every edge.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    source: "quilt", word: "STITCH", letterWeight: 5, variant: 12, patches: 11, merge: 0.3, windows: 0.3, image: "portrait", bands: 4, minRegion: 60, leaveLightest: false,
    centerX: 320, centerY: 320, width: 520, height: 520,
    field: "constant", angle: -30, fieldX: 0, fieldY: 0, twist: 60, fieldImage: "portrait", fieldVariant: 3, follow: 0.8, smoothing: 6, angleSpread: 60,
    fill: "running", spacing: 3.2, stitchLength: 7, stagger: 0.5, scatter: 0.35, inset: 4,
    underlay: "cross", underlaySpacing: 12, underlayInset: 2,
    crossing: "none", crossAngle: 90, crossSpacing: 8,
    outline: "satin", outlineWidth: 3, seam: -45, lap: 6, order: "nearest", travel: false,
    thread: "ink", weight: 1.7, dash: 5, colorBy: "region", trim: "ink",
  },
};
