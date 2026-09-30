import { bundledRasterIds, bundledRasterInfo } from "../composition/raster-samples.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
type Option = readonly [value: string, label: string];
type Scalar = number | string | boolean;
const control = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition, integer = false): Parameter =>
  control(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly Option[], visibleWhen?: Condition): Parameter =>
  control({ key, label, description, type: "select", options: options.map(([value, text]) => ({ value, label: text })) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter =>
  control(toggle(key, label, description), visibleWhen);

const imageOptions: readonly Option[] = bundledRasterIds.map((id): Option => [id, `${bundledRasterInfo[id].title}: ${bundledRasterInfo[id].character}`]);

const toned: Condition = { bandMode: ["equal", "balanced"] };
const manual: Condition = { bandMode: ["manual"] };
const filled: Condition = { fill: ["flat", "hatch", "nested"] };
const hatched: Condition = { fill: ["hatch"] };
const nested: Condition = { fill: ["nested"] };
const motifs: Condition = { fill: ["nested"], nestedKind: ["motifs", "mixed"] };
const contours: Condition = { fill: ["nested"], nestedKind: ["contours", "mixed"] };
const outlined: Condition = { outline: ["ink", "stitch", "beads"] };
const stitched: Condition = { outline: ["stitch", "beads"] };

export const valueRegionsDefinition: InstrumentDefinition = {
  id: "connected-value-regions",
  title: "Value Regions",
  description: "A picture reduced to a handful of coherent shapes: pixels are grouped into value bands, split into connected regions (diagonal contact joined or not), small regions are merged into their neighbours, and every region becomes a polygon with holes whose shared edges are drawn once. Each region is filled by a replaceable technique (flat color, hatching by tone, nested marks or contours) and outlined in ink, stitches or beads; a retained share leaves the rest as open paper.",
  procedure: "Measure one value per pixel of a picture, cut the values into bands, and split each band into its connected pieces. Merge pieces that are too small into a neighbour, trace shared boundaries once as polygons with holes, and fill each region with hatching whose spacing follows its tone.",
  renderer: "2d",
  parameters: [
    select("image", "Source image", "Bundled sample picture the regions are cut from. Each is a deterministic synthetic picture, not a photograph; binding your own image to a Studio layer is future host work, and the library functions already accept any raster you construct." +
      " " + bundledRasterIds.map((id) => `${bundledRasterInfo[id].title}: ${bundledRasterInfo[id].character}.`).join(" "), imageOptions),
    n("variant", "Image variant", "The sample's own seed: it re-arranges and re-tints the picture (a different head, a different horizon), not only the regions.", 0, 99, 1, 0, 9999, undefined, true),
    n("resolution", "Detail resolution", "Pixels across the sample. Regions are traced on this grid: more pixels resolve narrower shapes and give more regions to merge; fewer are faster and blunter. It never changes the picture's layout.", 48, 192, 8, 16, 384, undefined, true),
    select("measure", "Grouped by", "The value that is cut into bands: lightness (perceptual, equal steps look equal), luma (the display gray) or saturation (how colorful).",
      [["lightness", "Lightness"], ["luma", "Brightness (luma)"], ["saturation", "Saturation"]]),
    n("zoom", "Zoom", "How much closer than the whole picture the regions look. Values above 1 crop into the subject.", 1, 4, .05, 1, 16),
    n("focusX", "Crop X", "Slides a zoomed crop across the picture, 0 at the left edge, 1 at the right. No effect at zoom 1.", 0, 1, .01, 0, 1),
    n("focusY", "Crop Y", "Slides a zoomed crop down the picture, 0 at the top, 1 at the bottom. No effect at zoom 1.", 0, 1, .01, 0, 1),

    n("centerX", "Center X", "Horizontal center of the picture in canvas units.", 80, 560, 1, -1000, 1600),
    n("centerY", "Center Y", "Vertical center of the picture in canvas units.", 80, 560, 1, -1000, 1600),
    n("width", "Width", "Width of the picture in canvas units. The cropped picture is fitted to it exactly.", 200, 620, 1, 32, 1000),
    n("height", "Height", "Height of the picture in canvas units.", 200, 620, 1, 32, 1000),

    select("bandMode", "Band rule", "How values are cut into bands. Equal splits the value range into equal widths; balanced puts about the same number of pixels in every band, so a picture that is mostly dark or mostly light still yields shapes of every tone; manual takes three cuts you place (four bands).",
      [["equal", "Equal value widths"], ["balanced", "Equal pixel shares"], ["manual", "Manual cuts"]]),
    n("bands", "Bands", "Number of value bands. Two bands give a silhouette; more bands give more, smaller shapes. Every connected piece of one band is a candidate region.", 2, 8, 1, 2, 64, toned, true),
    n("cut1", "First cut", "Value (0 dark to 1 light) below which pixels form the darkest band. A value equal to a cut is in the band above it.", 0, 1, .01, 0, 1, manual),
    n("cut2", "Second cut", "Value between the darkest and lightest bands. Must lie above the first cut.", 0, 1, .01, 0, 1, manual),
    n("cut3", "Third cut", "Value above which pixels form the lightest band. Must lie above the second cut.", 0, 1, .01, 0, 1, manual),
    n("smoothing", "Smoothing", "Blurs the picture's values before they are banded, in canvas units (a Gaussian standard deviation). It removes grain and speckle, so bands meet in calmer shapes and fewer small regions appear. 0 bands the raw pixels.", 0, 12, .5, 0, 200),
    flag("corners", "Join across corners", "Off: pixels of one band are connected only across shared edges, so a diagonal line of pixels is a row of separate regions. On: corner contact also connects them, so thin diagonal features stay whole but a region can be linked to pieces that touch it at a single point."),
    n("minArea", "Smallest region", "Regions smaller than this share of the picture's area are merged into a neighbour, so the picture keeps only shapes of real size. Raise it for fewer, larger shapes.", 0, 10, .1, 0, 60),
    select("merge", "Merge into", "Which neighbour absorbs a region that is too small: the one it shares the longest border with, or the one whose average value is closest.",
      [["longest-border", "Longest shared border"], ["nearest-value", "Nearest average value"]]),

    n("simplify", "Simplification", "Boundary thinning tolerance in canvas units: how far a boundary may be straightened. Neighbouring regions share each edge, so both change together and never open a gap or overlap. 0 keeps every pixel step; the picture's four corners always stay.", 0, 12, .25, 0, 200),

    n("retained", "Retained regions", "Share of regions drawn; the rest stay as open paper, so their neighbours read as shapes against negative space. 1 draws every region.", 0, 1, .01, 0, 1),
    select("keepBy", "Retain by", "Which regions stay when some are dropped: chance draws them at random (the seed rearranges); largest or smallest by area; dark or light by tone; enclosed keeps the ones inside others' holes first, outer the outermost first.",
      [["chance", "Chance (seeded)"], ["largest", "Largest"], ["smallest", "Smallest"], ["dark", "Darkest"], ["light", "Lightest"], ["enclosed", "Most enclosed"], ["outer", "Outermost"]]),
    n("gutter", "Gutter", "Clear space between neighbouring fills, in canvas units: each region's fill is pulled back by half of it from the boundary (the outline stays on the boundary). Regions thinner than the gutter disappear.", 0, 12, .5, 0, 200, filled),

    select("fill", "Filler", "How each retained region is filled: flat color, parallel hatching whose spacing follows the region's tone, marks or contour lines nested in the polygon (the region-fill machinery clipped to the shape), or nothing so that only the outline remains.",
      [["flat", "Flat color"], ["hatch", "Hatching by tone"], ["nested", "Nested marks or contours"], ["none", "None (outline only)"]]),
    select("color", "Color source", "image uses each region's average color; palette snaps that to the nearest palette color; ramp maps the region's tone along the palette from its first color (dark) to its last (light); ink uses only the first palette color, darker regions inking more.",
      [["image", "Image average"], ["palette", "Nearest palette color"], ["ramp", "Palette ramp by tone"], ["ink", "Ink by darkness"]], filled),
    n("body", "Body opacity", "Opacity of the flat color: the whole fill for flat regions, the underpaint beneath hatching or nested marks.", 0, 1, .01, 0, 1, filled),
    select("hatchDirection", "Hatch direction", "fixed uses the angle below for every region; along also turns the lines to each region's long axis, so elongated shapes are hatched along their length (round regions keep the fixed angle).",
      [["fixed", "Fixed angle"], ["along", "Along the shape"]], hatched),
    n("hatchSpacing", "Hatch spacing", "Distance between hatch lines at mid tone, in canvas units. Lines are anchored to the canvas, so neighbouring regions with the same spacing and angle continue each other's lines.", 2, 16, .5, 1.2, 200, hatched),
    n("hatchWeight", "Hatch weight", "Stroke width of the hatch lines.", .3, 3, .1, 0, 50, hatched),
    n("hatchAngle", "Hatch angle", "Degrees added to the base direction (clockwise on the canvas).", -90, 90, 1, -3600, 3600, hatched),
    n("toneResponse", "Tone response", "How much darker regions hatch tighter and lighter regions looser, in octaves of line spacing between white and black. 0 spaces every region alike.", 0, 2, .05, 0, 4, hatched),
    n("crossBelow", "Cross-hatch below", "Regions with a tone below this (0 dark to 1 light) get a second layer of lines. 0 never crosses.", 0, 1, .01, 0, 1, hatched),
    n("crossAngle", "Cross angle", "Degrees between the first and second layer of a cross-hatched region.", -90, 90, 1, -180, 180, hatched),
    n("bandTurn", "Turn per band", "Degrees the hatch direction turns for each band up from the darkest, so tones are told apart by direction as well as spacing.", -90, 90, 1, -180, 180, hatched),
    n("jitter", "Direction jitter", "Largest stable random turn given to each region's hatch direction, in degrees either way. The seed draws it.", 0, 45, 1, 0, 90, hatched),
    select("nestedKind", "Nested content", "Motifs stamps marks at random sites inside each region; contours draw the level lines of a seeded field fitted to it; mixed gives each region one or the other by a stable draw.",
      [["motifs", "Motifs"], ["contours", "Contour lines"], ["mixed", "Mixed"]], nested),
    select("mark", "Mark", "The motif stamped in a region: a dot, rings, a rosette of petals or an arrow.", [["dot", "Dot"], ["rings", "Rings"], ["rosette", "Rosette"], ["arrow", "Arrow"]], motifs),
    n("markSize", "Mark size", "Diameter of a stamped mark in canvas units. Marks that would cross the region's edge are left out.", 3, 30, .5, .5, 200, motifs),
    n("markSpacing", "Mark spacing", "Least distance between stamped marks. Each region takes at most 80 marks.", 6, 60, 1, 1, 1000, motifs),
    n("contourLevels", "Contour levels", "Number of contour lines of the field nested in each region.", 2, 12, 1, 1, 24, contours, true),
    select("contourMaterial", "Contour material", "Contour lines as solid ink, stitches or beads. Stitch and bead pitch is five line weights.", [["ink", "Ink"], ["stitch", "Stitches"], ["beads", "Beads"]], contours),
    n("nestedWeight", "Nested weight", "Stroke width of nested marks and contour lines.", .3, 3, .1, 0, 50, nested),
    n("nestedInset", "Nested clearance", "Space kept between nested marks or lines and the region's edge, in canvas units.", 0, 12, .5, 0, 200, nested),

    select("outline", "Outline", "A line along every region boundary drawn with the path material: solid ink, stitches or beads. A boundary shared by two regions is drawn once. none leaves the edges bare.",
      [["none", "None"], ["ink", "Ink"], ["stitch", "Stitches"], ["beads", "Beads"]]),
    select("outlineColor", "Outline color", "The first palette color, or the second (an accent).", [["ink", "First palette color"], ["accent", "Second palette color"]], outlined),
    n("outlineWeight", "Outline weight", "Stroke width of the outline, stitches or beads.", .3, 4, .1, 0, 50, outlined),
    n("outlineSpacing", "Stitch spacing", "Distance between stitches or beads along the boundary.", 3, 16, .5, .5, 1000, stitched),
  ],
  controlGroups: [
    { label: "Source", stage: "form", controls: ["image", "variant", "resolution", "measure", { label: "Crop", controls: ["zoom", "focusX", "focusY"] }] },
    { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }] },
    { label: "Regions", stage: "form", controls: ["bandMode", "bands", { label: "Cuts", controls: ["cut1", "cut2", "cut3"] }, "smoothing", "corners",
      { label: "Merging", controls: ["minArea", "merge"] }] },
    { label: "Boundary", stage: "process", controls: ["simplify"] },
    { label: "Negative space", stage: "material", controls: ["retained", "keepBy", "gutter"] },
    { label: "Filler", stage: "material", controls: ["fill", "color", "body",
      { label: "Hatching", controls: ["hatchDirection", "hatchSpacing", "hatchWeight", "hatchAngle", "toneResponse", "crossBelow", "crossAngle", "bandTurn", "jitter"] },
      { label: "Nested", controls: ["nestedKind", "mark", "markSize", "markSpacing", "contourLevels", "contourMaterial", "nestedWeight", "nestedInset"] }] },
    { label: "Outline", stage: "material", controls: ["outline", "outlineColor", "outlineWeight", "outlineSpacing"] },
  ] satisfies ControlGroup[],
  defaults: {
    image: "portrait", variant: 3, resolution: 128, measure: "lightness", zoom: 1, focusX: .5, focusY: .5,
    centerX: 320, centerY: 320, width: 560, height: 560,
    bandMode: "balanced", bands: 4, cut1: .3, cut2: .55, cut3: .8, smoothing: 2, corners: false, minArea: .7, merge: "longest-border",
    simplify: 4,
    retained: 1, keepBy: "chance", gutter: 0,
    fill: "hatch", color: "image", body: .9,
    hatchDirection: "along", hatchSpacing: 6, hatchWeight: .9, hatchAngle: 35, toneResponse: 1, crossBelow: .3, crossAngle: 70, bandTurn: 25, jitter: 0,
    nestedKind: "motifs", mark: "rings", markSize: 10, markSpacing: 16, contourLevels: 6, contourMaterial: "ink", nestedWeight: .9, nestedInset: 3,
    outline: "ink", outlineColor: "ink", outlineWeight: 1.6, outlineSpacing: 6,
  },
  validate: validateValueRegions,
};

/** Coupled bounds that no single control can state. */
export function validateValueRegions(q: Record<string, Scalar>): void {
  if (q.bandMode === "manual" && !((q.cut1 as number) < (q.cut2 as number) && (q.cut2 as number) < (q.cut3 as number)))
    throw new Error(`Manual cuts must rise: cut1 ${q.cut1}, cut2 ${q.cut2}, cut3 ${q.cut3}: raise cut2 above cut1 and cut3 above cut2`);
}
