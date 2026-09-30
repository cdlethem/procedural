import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { parseExceptions } from "./crossing-lace-instrument.js";
import { choice, numeric, text, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["detail", "colorA", "colorB", "inkColor", "veilColor"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: [string, string][], visibleWhen?: Condition): Parameter =>
  withCondition({ ...choice(key, label, description, options.map(([value]) => value)), options: options.map(([value, name]) => ({ value, label: name })) }, visibleWhen);

const edged: Condition = { surface: ["terrain", "vase", "sheet", "sphere"] };
const trimmed: Condition = { edge: ["inset", "fringe"], surface: ["terrain", "vase", "sheet", "sphere"] };
const drawn: Condition = { style: ["cased", "solid"] };
const shaded: Condition = { shade: ["facing", "depth"] };
const fieldChoices: [string, string][] = [["height", "Height"], ["axis", "Distance from the axis"], ["centre", "Distance from the centre"], ["diagonal", "Diagonal bands"], ["waves", "Seeded waves"]];
const densityValues = ["height", "axis", "centre", "diagonal", "waves"];

const parameters: Parameter[] = [
  select("surface", "Surface", "The bundled surface the threads follow. Terrain is a height field, the vase a revolved vessel, the torus a ring, the sphere an icosphere cap (a whole sphere at 180 degrees) and the sheet a parametric strip. Threads are traced on the mesh itself, so nothing depends on a UV layout.",
    [["vase", "Vase"], ["terrain", "Terrain"], ["torus", "Torus"], ["sphere", "Sphere cap"], ["sheet", "Parametric sheet"]]),
  select("terrain", "Terrain shape", "Seeded height field: rolling hills, ridged crests, a crater bowl or dune ripples.",
    [["hills", "Hills"], ["ridges", "Ridges"], ["crater", "Crater"], ["dunes", "Dunes"]], { surface: ["terrain"] }),
  select("vase", "Vase profile", "Silhouette of the revolved vessel: a belly and neck, a stemmed goblet, a bottle or an urn. Its base is closed and its rim open.",
    [["amphora", "Amphora"], ["goblet", "Goblet"], ["bottle", "Bottle"], ["urn", "Urn"]], { surface: ["vase"] }),
  select("sheet", "Sheet shape", "A saddle, seeded waves, a helicoid ribbon turned through three quarter turns, or a scroll rolled into a spiral. The last two overhang themselves, so they hide their own threads.",
    [["twist", "Twisted ribbon"], ["scroll", "Scroll"], ["saddle", "Saddle"], ["waves", "Waves"]], { surface: ["sheet"] }),
  n("detail", "Detail", "Resolution of the mesh: quads per side of a terrain or sheet (8 per step), slices around a vase or torus, subdivisions of the sphere (it stops at 6). Threads follow the mesh facets, so more detail rounds the curves and costs more.", 2, 6, 1, 1, 8),
  n("relief", "Relief", "Vertical scale of a terrain or sheet: low values flatten it toward a plane, high values pile it up.", 0.4, 1.8, 0.05, 0.05, 4, { surface: ["terrain", "sheet"] }),
  n("tube", "Tube radius", "Radius of the torus tube against a ring radius of 1: a thin ring or a fat doughnut.", 0.2, 0.65, 0.01, 0.05, 0.95, { surface: ["torus"] }),
  n("cap", "Cap angle", "Half-angle in degrees of the sphere cap around its pole. 180 is the whole sphere, which has no edge.", 45, 180, 1, 15, 180, { surface: ["sphere"] }),

  select("flow", "Direction from", "What orients the first thread family. Height, axis distance, centre distance, plane bands and seeded waves are scalar fields on the surface: threads run along their isolines. Guide combs the surface along a fixed world direction.",
    [["height", "Height"], ["axis", "Distance from the axis"], ["centre", "Distance from the centre"], ["plane", "Plane bands"], ["waves", "Seeded waves"], ["guide", "Guide direction"]]),
  n("flowAngle", "Band direction", "Direction in degrees, from +x toward +z, along which the plane field increases; its isolines are the planes across it.", 0, 180, 1, -3600, 3600, { flow: ["plane"] }),
  n("flowFrequency", "Wave frequency", "Cycles of the seeded waves across the model; more cycles make more winding isolines.", 0.5, 4, 0.05, 0.1, 16, { flow: ["waves"] }),
  n("guideYaw", "Guide yaw", "Horizontal direction of the guide in degrees (0 is +z, positive turns toward +x).", -180, 180, 1, -3600, 3600, { flow: ["guide"] }),
  n("guidePitch", "Guide pitch", "Elevation of the guide in degrees: 0 combs horizontally, 90 straight up the surface.", -90, 90, 1, -90, 90, { flow: ["guide"] }),
  n("angle", "Thread angle", "Turns every thread from its isoline (or guide) direction, in degrees, toward the surface's steepest direction: 0 follows the field, 90 crosses it.", -90, 90, 1, -3600, 3600),
  n("cross", "Weave angle", "Angle between the two families, in degrees on the surface. 90 is a square weave; smaller angles give a diagonal lattice and long shallow crossings.", 25, 90, 1, 10, 170),
  n("swirl", "Swirl", "Amplitude in degrees of an orientation change across the surface, driven by the swirl field: threads turn by up to this much each way. 0 keeps one angle everywhere.", 0, 60, 1, 0, 180),
  select("swirlField", "Swirl field", "The scalar that drives the swirl: the turn runs from minus to plus Swirl as it goes from its lowest to its highest value.", fieldChoices),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the model's bounds.", 100, 540, 1, -4000, 4000),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the model's bounds.", 100, 540, 1, -4000, 4000),
  n("size", "Size", "Canvas length of the model's bounding-box diagonal at the target depth. Threads scale with it.", 260, 620, 1, 20, 4000),

  n("spacing", "Thread spacing", "Distance between neighbouring threads of a family, as a share of the surface's linear size (the square root of its area). It is a distance measured on the surface, never in UV: equal threads per length however the surface bends.", 0.03, 0.12, 0.001, 0.012, 0.4),
  n("spacingB", "Second family spacing", "Spacing of the second family as a multiple of the first: below 1 makes it denser, above 1 sparser (a warp finer than its weft).", 0.5, 2, 0.05, 0.25, 4),
  select("density", "Density field", "A scalar on the surface that changes the spacing: threads crowd where it is high. None keeps the spacing uniform.",
    [["none", "None"], ...fieldChoices]),
  n("ratio", "Density ratio", "How much denser the crowded end is than the sparse end: spacing runs from spacing divided by the square root of the ratio to spacing times that root.", 1, 5, 0.05, 1, 8, { density: densityValues }),
  withCondition(toggle("reverse", "Reverse density", "Crowds threads where the density field is low instead of high."), { density: densityValues }),
  select("edge", "Edge", "How threads end at a boundary: run out to the edge, stop a margin short of it, or stop at a ragged random margin like a fringe. A closed surface has no edge.",
    [["flush", "Run to the edge"], ["inset", "Stop short"], ["fringe", "Fringe"]], edged),
  n("margin", "Edge margin", "Distance kept from the boundary, in thread spacings (a fringe stops between zero and twice this).", 0, 4, 0.05, 0, 20, trimmed),

  select("rule", "Over and under", "Alternate makes every thread go over, under, over along its length wherever that can be satisfied. Seeded flips a coin per crossing. Family B over lays the second family over the first everywhere.",
    [["alternate", "Alternate"], ["seeded", "Seeded"], ["rank", "Family B over"]]),
  toggle("invert", "Invert", "Swaps over and under at every crossing: the mirror weave on the same threads."),
  { ...text("exceptions", "Exceptions", "Crossing numbers to reverse after the rule, such as \"3, 7, 12-14\". Turn on Numbers in the overlay to read them.", 300) },
  n("clearance", "Clearance", "Extra empty travel each side of a crossing, on top of the thread widths, in canvas units.", 0, 8, 0.25, 0, 200),
  n("minAngle", "Shallowest woven crossing", "Crossings that meet, seen in the picture, at less than this angle (degrees) are left unwoven: both threads overlap with no gap. A near-tangent crossing would otherwise cut its whole thread away.", 0, 60, 1, 0, 89),

  select("style", "Thread style", "Cased threads are an outlined colour, solid ones a single colour, hairlines a single thin line (with small gaps): the edge-only drawing.",
    [["cased", "Cased"], ["solid", "Solid"], ["hairline", "Hairline"]]),
  select("section", "Cross-section", "Flat ribbons lie in the surface, so they narrow where it turns away from the view and vanish edge-on; round threads keep one width in the picture (keep them under about 0.55 of the spacing or crossings consume them).",
    [["round", "Round"], ["flat", "Flat ribbon"]], drawn),
  n("width", "Thread width", "Thread width as a share of the local spacing, so threads thin where the weave is dense.", 0.3, 0.95, 0.01, 0.05, 1.5, drawn),
  n("casing", "Casing", "Outline thickness on each side of a cased thread, in canvas units.", 0.5, 3, 0.1, 0, 50, { style: ["cased"] }),
  select("shade", "Shading", "Fades threads with distance from the viewer (depth) or as the surface turns away (facing); none draws every thread at full strength.",
    [["facing", "Facing"], ["depth", "Depth"], ["none", "None"]]),
  n("shadeAmount", "Shade amount", "How far the fade goes: 0 leaves every thread at full strength, 1 lets the weakest threads (edge-on or farthest) fade to transparent.", 0, 1, 0.01, 0, 1, shaded),
  select("hidden", "Hidden threads", "Threads behind the surface are removed, or drawn as faint hairlines so the far side can be read.", [["remove", "Remove"], ["faint", "Faint"]]),

  select("model", "Model drawn as", "Nothing, its silhouette and boundary edges only, or a pale translucent veil behind the threads (painted far to near) with the same edges.",
    [["outline", "Outline"], ["none", "Nothing"], ["veil", "Veil"]]),
  n("outlineWeight", "Outline weight", "Line weight of the silhouette and boundary edges, in canvas units.", 0.5, 3, 0.1, 0, 50, { model: ["outline", "veil"] }),
  n("veilOpacity", "Veil opacity", "Opacity of the veil behind the threads.", 0.1, 1, 0.01, 0, 1, { model: ["veil"] }),

  select("coloring", "Colouring", "Families colours the two families with the slots below; strands gives every thread its own palette entry so one can be followed through the weave.",
    [["families", "By family"], ["strands", "By strand"]]),
  n("colorA", "Colour A", "Palette entry (zero-based) of the first family.", 0, 4, 1, 0, 15, { coloring: ["families"] }),
  n("colorB", "Colour B", "Palette entry (zero-based) of the second family.", 0, 4, 1, 0, 15, { coloring: ["families"] }),
  n("inkColor", "Ink colour", "Palette entry (zero-based) of the casing and the model's edges.", 0, 4, 1, 0, 15),
  n("veilColor", "Veil colour", "Palette entry (zero-based) of the veil.", 0, 4, 1, 0, 15, { model: ["veil"] }),

  select("projection", "Projection", "Orthographic keeps parallel lines parallel; perspective draws nearer threads larger.", [["perspective", "Perspective"], ["orthographic", "Orthographic"]]),
  n("yaw", "Yaw", "Turns the view about the vertical axis, in degrees.", -180, 180, 1, -3600, 3600),
  n("pitch", "Pitch", "Raises the view above the model, in degrees; 90 looks straight down.", -90, 90, 1, -90, 90),
  n("roll", "Roll", "Turns the picture about the view direction, in degrees.", -90, 90, 1, -3600, 3600),
  n("distance", "Distance", "Eye distance from the model in bounding diagonals. Small values exaggerate perspective.", 1, 6, 0.05, 0.7, 40, { projection: ["perspective"] }),

  select("overlay", "Overlay", "Reading aids on top of the weave: crossing numbers (for Exceptions) or rings where over and under fail to alternate.",
    [["none", "None"], ["numbers", "Numbers"], ["breaks", "Breaks"]]),
];

const controlGroups: ControlGroup[] = [
  { label: "Surface", controls: ["surface", "terrain", "vase", "sheet", "detail", "relief", "tube", "cap"] },
  { label: "Placement", controls: ["centerX", "centerY", "size"] },
  { label: "Flow", controls: ["flow", "flowAngle", "flowFrequency", "guideYaw", "guidePitch", "angle", "cross", { label: "Swirl", controls: ["swirl", "swirlField"] }] },
  { label: "Threads", controls: [{ label: "Spacing", controls: ["spacing", "spacingB"] }, "density", "ratio", "reverse", "edge", "margin"] },
  { label: "Weave", controls: ["rule", "invert", "exceptions", "clearance", "minAngle"] },
  { label: "Strands", controls: ["style", "section", "width", { label: "Line weights", controls: ["casing", "outlineWeight"], proportional: true }, "shade", "shadeAmount", "hidden"] },
  { label: "Model", controls: ["model", "veilOpacity"] },
  { label: "Color", controls: ["coloring", { label: "Palette", controls: ["colorA", "colorB", "inkColor", "veilColor"] }] },
  { label: "View", controls: ["projection", "yaw", "pitch", "roll", "distance"] },
  { label: "Diagnostics", controls: ["overlay"] },
];

type Values = Record<string, number | string | boolean>;

/** Estimated strand vertices from the stored values alone (uniform spacing, both families); geometry-dependent limits are checked when built. */
export function surfaceWeaveVertexEstimate(q: Values): number {
  const s = q.spacing as number, sb = s * (q.spacingB as number);
  return Math.ceil(1 / (0.35 * s * s) + 1 / (0.35 * sb * sb));
}

export function validateSurfaceWeave(q: Values): void {
  parseExceptions(q.exceptions as string);
  const estimate = surfaceWeaveVertexEstimate(q);
  if (estimate > 300_000)
    throw new Error(`The threads would need about ${estimate} vertices; the limit is 300000. Raise Thread spacing or Second family spacing`);
}

export const surfaceWeaveDefinition: InstrumentDefinition = {
  id: "surface-weave", title: "Surface Weave",
  description: "Two families of threads traced across a curved surface and woven over and under where they cross: spacing measured on the surface, direction and density steered by fields, the whole thing seen through a camera with true occlusion.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    surface: "vase", terrain: "hills", vase: "amphora", sheet: "twist", detail: 4, relief: 1, tube: 0.42, cap: 120,
    flow: "height", flowAngle: 30, flowFrequency: 1.6, guideYaw: 0, guidePitch: 60, angle: 38, cross: 90, swirl: 22, swirlField: "height",
    centerX: 320, centerY: 335, size: 600,
    spacing: 0.052, spacingB: 1, density: "axis", ratio: 2.2, reverse: false, edge: "flush", margin: 1,
    rule: "alternate", invert: false, exceptions: "", clearance: 0.4, minAngle: 20,
    style: "cased", section: "flat", width: 0.8, casing: 1, shade: "facing", shadeAmount: 0.45, hidden: "remove",
    model: "outline", outlineWeight: 1.2, veilOpacity: 0.55,
    coloring: "families", colorA: 1, colorB: 2, inkColor: 0, veilColor: 3,
    projection: "perspective", yaw: 30, pitch: 16, roll: 0, distance: 2.6,
    overlay: "none",
  },
  validate: validateSurfaceWeave,
};
