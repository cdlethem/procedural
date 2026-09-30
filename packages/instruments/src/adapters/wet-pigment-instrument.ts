import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { WET_LIMITS, wetWork } from "../composition/wet-pigment.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = NonNullable<Parameter["visibleWhen"]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter =>
  visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["sites", "backruns", "backrunStep", "backrunGap", "steps", "grid", "bands", "frontEvery"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, options), visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter =>
  withCondition(toggle(key, label, description), visibleWhen);

/** Words of the bundled letterform masks (licensed outline font, capitals). */
export const WET_WORDS = ["WET", "BLOOM", "RAIN", "INK", "FLOW", "DRIP"] as const;
/** Palette roles: wash tint, deep pigment, drying fronts, water film, outline. */
export const wetPigmentPalette = [0xa9cfd8, 0x1c3f73, 0xb5482f, 0x7fb0c4, 0x2b2118];

const shaped: Condition = { maskShape: ["blob", "ring"] };
const ringed: Condition = { maskShape: ["ring"] };
const lettered: Condition = { maskShape: ["letters"] };
const late: Condition = { lateWater: [true] };
const pigmented: Condition = { showPigment: [true] };
const fronted: Condition = { showFronts: [true] };
const filmed: Condition = { showFilm: [true] };
const outlined: Condition = { showOutline: [true] };

const parameters: Parameter[] = [
  select("maskShape", "Wet region", "The region the water may enter, everything outside stays dry paper: an irregular blob, the letters of a word, or a ring with a dry island in the middle. Water and pigment never cross a dry cell except as a spreading front that wets it.", ["blob", "letters", "ring"]),
  select("word", "Word", "The word whose letterforms are wet. Thin strokes hold little water, so they dry first.", [...WET_WORDS], lettered),
  n("roughness", "Outline roughness", "How far the outline wanders from an ellipse: 0 is a plain ellipse, 1 a lobed, irregular blot. A new seed draws a different outline.", 0, 1, 0.01, 0, 1, shaped),
  n("inner", "Island size", "Size of the dry island as a fraction of the region.", 0.2, 0.8, 0.01, 0.1, 0.9, ringed),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the wet region. Parts beyond the canvas are cut.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the wet region.", 0, 640, 1, -4096, 4096),
  n("width", "Width", "Width of the wet region in canvas units.", 120, 600, 1, 8, 4096),
  n("height", "Height", "Height of the wet region in canvas units.", 120, 600, 1, 8, 4096),
  n("rotation", "Rotation", "Turns the wet region about its center, in degrees.", -180, 180, 1, -3600, 3600),

  n("paperVariation", "Paper variation", "How unevenly the paper takes water: 0 is uniform paper, 1 varies its porosity by nearly its whole value. Porous patches soak water up and slow its spread, so fronts turn ragged and bloom edges become cauliflower lobes.", 0, 0.9, 0.01, 0, 0.95),
  n("paperGrain", "Paper grain", "Size of the patches of uniform porosity, in canvas units.", 8, 80, 1, 2, 400),
  n("absorbency", "Absorbency", "Water the paper soaks out of the surface film per step, per cell, times its porosity. The pigment stays behind, so absorbing paper concentrates and deposits it and stops fronts sooner.", 0, 0.003, 0.0001, 0, 0.5),

  n("prewet", "Pre-wet", "Depth of water laid over the whole wet region before any pigment: 0 paints onto dry paper, small blooms stay close to their drops, larger values let every drop flood far across the sheet.", 0, 1.5, 0.05, 0, 5),
  n("evaporation", "Drying rate", "Water lost to the air per step from every wet cell. Higher dries sooner and freezes blooms earlier. The elapsed steps slider must reach the moment the region dries to see the finished bloom.", 0.0005, 0.006, 0.0001, 0, 0.5),
  n("edgeDrying", "Edge drying", "How much faster the wet region's edge dries than its middle (a multiple of the drying rate). Water flows out to the drying edge and carries pigment with it, leaving a dark rim.", 0, 6, 0.1, 0, 20),
  n("edgeReach", "Edge reach", "Distance from the edge over which the faster drying fades, in canvas units.", 10, 120, 1, 1, 1000,
    [{ edgeDrying: { gt: 0 } }, { showFronts: [true], steps: { gte: 2 } }, { showPigment: [true], sites: { gte: 1 } }]),

  n("transport", "Transport strength", "How readily water spreads from deeper to shallower cells (a share of the depth difference moved per pass, three passes a step). Zero freezes the water where it lands.", 0, 1, 0.01, 0, 1),
  n("pigmentSpread", "Pigment diffusion", "How readily suspended pigment diffuses between wet cells on its own, on top of being carried by the water.", 0, 1, 0.01, 0, 1, { showPigment: [true] }),
  n("tilt", "Tilt", "Tips the sheet so water drifts downhill and pools at the low side, a share of each cell's water per pass. Zero is a flat board.", 0, 0.06, 0.001, 0, 0.1),
  n("tiltAngle", "Tilt direction", "Direction the water drifts, in degrees: 90 toward the bottom of the canvas, 0 toward the right.", -180, 180, 1, -3600, 3600, { tilt: { gt: 0 } }),
  select("boundary", "Edge", "Sealed: the region's edge is a wall, nothing leaves. Open: water and its pigment drain out through the edge into the surrounding dry paper and are lost from the picture, so the deposit fades toward the edge.", ["sealed", "open"]),

  n("sites", "Deposit sites", "Number of drops of pigmented water. Each lands at a seeded place in the region and never moves.", 0, 12, 1, 0, 24),
  select("layout", "Site layout", "Scattered spreads drops evenly over the region; rim puts them near its edge; core keeps them deep inside, as far from the edge as possible.", ["scattered", "rim", "core"]),
  n("dropRadius", "Drop radius", "Radius of each pigment drop in canvas units.", 20, 120, 1, 1, 1000),
  n("dropDepth", "Drop depth", "Water depth at the middle of a drop; it falls off smoothly to the rim. A deeper drop carries its pigment further.", 0.2, 2.5, 0.05, 0.005, 5),
  n("ratio", "Water per pigment", "Volume of water for each unit of pigment mass in a drop: high is a thin, dilute wash, low a heavy, dark charge.", 0.5, 8, 0.1, 0.05, 100, { showPigment: [true] }),
  n("depositRate", "Deposit rate", "Share of suspended pigment that settles onto the paper each step while the film is deep. As the film thins the share rises to 1: a cell that dries leaves all its pigment behind.", 0, 0.2, 0.005, 0, 1, { showPigment: [true] }),
  n("redissolve", "Redissolve", "Share of deposited pigment that lifts back into the water each step where the film is deep. This is what lets a late drop push old pigment outward to a new rim.", 0, 0.1, 0.002, 0, 1, { showPigment: [true] }),

  flag("lateWater", "Late water", "Drop clear water into the drying picture: each drop lifts and pushes pigment outward, leaving a pale bloom with a dark, feathered rim: a backrun."),
  n("backruns", "Late drops", "Number of clear-water drops. Each lands beside one of the pigment sites (in turn), or anywhere if there are none.", 1, 8, 1, 0, 24, late),
  n("backrunStep", "First drop at", "Step at which the first late drop lands. Before the region has dried and after it has settled it has little to push.", 20, 400, 1, 1, 2000, late),
  n("backrunGap", "Gap between drops", "Steps between successive late drops: 0 lands them together.", 0, 120, 1, 0, 2000, late),
  n("backrunDepth", "Late drop depth", "Water depth at the middle of a late drop.", 0.2, 2, 0.05, 0.005, 5, late),
  n("backrunRadius", "Late drop radius", "Radius of a late drop in canvas units.", 15, 100, 1, 1, 1000, late),

  n("steps", "Elapsed steps", "How far the wet paint has run: scrub it from the first drop, through spreading, blooming and drying, to the dried result. Once every cell is dry (and no drop is due) nothing changes any more.", 0, 600, 1, 0, 2000),
  n("grid", "Grid cells", "Cells across the canvas. More cells resolve thinner letters and finer fronts but cost the square of the count in time, and water spreads a fixed number of cells a step, so a finer grid also spreads less far in canvas units.", 48, 160, 1, 24, 256),

  flag("showPigment", "Pigment bands", "Draw the pigment on the paper (deposited and, optionally, still suspended) as nested translucent fills of increasing density."),
  n("bands", "Bands", "Number of density bands.", 2, 10, 1, 1, 24, pigmented),
  n("gain", "Pigment strength", "How dense the pigment must be to read as dark: higher fills more of the picture with dense bands. It is a display level only and never changes the model.", 0.5, 12, 0.1, 0.01, 100, pigmented),
  n("opacity", "Opacity", "Opacity of the densest band; the bands below it build up in equal steps.", 0.1, 1, 0.01, 0, 1, pigmented),
  select("colorMode", "Color", "Ramp shades from the wash tint (first palette color) in thin pigment to the deep pigment (second) where it is dense; single uses the deep pigment alone.", ["ramp", "single"], pigmented),
  flag("showSuspended", "Include wet pigment", "Also draw pigment that is still floating in the water, so scrubbing shows the paint moving; off draws only what has settled.", pigmented),

  flag("showFronts", "Drying fronts", "Draw lines where the wet paint had dried at regular times: the order in which the sheet dried, drawn as contours of drying time inside the wet region."),
  n("frontEvery", "Front interval", "Steps between drying fronts.", 5, 80, 1, 1, 1000, fronted),
  n("frontWeight", "Front weight", "Stroke width of the drying fronts.", 0.3, 3, 0.05, 0, 50, fronted),

  flag("showFilm", "Water film", "Fill the region that is still wet: a pale sheen that shows the water spreading and shrinking as you scrub the steps."),
  n("filmOpacity", "Film opacity", "Opacity of the water sheen.", 0, 0.6, 0.01, 0, 1, filmed),
  n("filmEdge", "Film edge", "Stroke width of a line along the advancing edge of the water (not along the region's own edge); 0 draws none.", 0, 3, 0.05, 0, 50, filmed),

  flag("showOutline", "Region outline", "Draw the outline of the wet region itself."),
  n("outlineWeight", "Outline weight", "Stroke width of the region outline.", 0.3, 3, 0.05, 0, 50, outlined),
];

const controlGroups: ControlGroup[] = [
  { label: "Wet region", stage: "form", controls: ["maskShape", "word", "roughness", "inner"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }, "rotation"] },
  { label: "Paper", stage: "material", controls: ["paperVariation", "paperGrain", "absorbency"] },
  { label: "Water", stage: "process", controls: ["prewet", "evaporation", { label: "Edge", controls: ["edgeDrying", "edgeReach"] }] },
  { label: "Transport", stage: "process", controls: ["transport", "pigmentSpread", { label: "Tilt", controls: ["tilt", "tiltAngle"] }, "boundary"] },
  { label: "Pigment", stage: "material", controls: [{ label: "Drops", controls: ["sites", "layout", "dropRadius", "dropDepth"] }, "ratio", "depositRate", "redissolve"] },
  { label: "Backruns", stage: "process", controls: ["lateWater", "backruns", "backrunStep", "backrunGap", { label: "Drop", controls: ["backrunDepth", "backrunRadius"] }] },
  { label: "Simulation", stage: "process", controls: ["steps", "grid"] },
  { label: "Drawing", stage: "material", controls: [
    { label: "Pigment", controls: ["showPigment", "colorMode", "bands", "gain", "opacity", "showSuspended"] },
    { label: "Drying fronts", controls: ["showFronts", "frontEvery", "frontWeight"] },
    { label: "Water film", controls: ["showFilm", "filmOpacity", "filmEdge"] },
    { label: "Outline", controls: ["showOutline", "outlineWeight"] },
  ] },
];

/** Work that follows from the stored values alone: the same bounds the run enforces, naming the controls. */
export function validateWetPigment(q: Record<string, number | string | boolean>): void {
  const prewet = q.prewet as number;
  if (prewet > 0 && prewet < WET_LIMITS.dryWater) throw new Error(`Pre-wet must be 0 or at least ${WET_LIMITS.dryWater}: a thinner film is dry`);
  const work = wetWork(q.grid as number, q.steps as number);
  if (work > WET_LIMITS.maxWork)
    throw new Error(`Elapsed steps × grid cells² would take ${work} cell updates; the limit is ${WET_LIMITS.maxWork}. Lower the elapsed steps or the grid cells`);
}

export const wetPigmentDefinition: InstrumentDefinition = {
  id: "wet-pigment", title: "Wet Pigment",
  description: "Pigmented water dropped into an artist-defined wet region spreads, is soaked up by uneven paper and dries from the edge in. Suspended pigment is carried out with the water and left where it dries, so drops bloom into feathered rims, late clear water pushes old pigment outward into backruns, and drying fronts record the order the sheet dried. Drawn as banded pigment fills, drying-front contours and the wet film, all from one stepped simulation. A 2D cellular model, not physical paint.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    maskShape: "blob", word: "BLOOM", roughness: 0.5, inner: 0.45,
    centerX: 320, centerY: 320, width: 500, height: 440, rotation: 0,
    paperVariation: 0.45, paperGrain: 26, absorbency: 0.0006,
    prewet: 0.25, evaporation: 0.0018, edgeDrying: 2.5, edgeReach: 45,
    transport: 1, pigmentSpread: 0.4, tilt: 0, tiltAngle: 90, boundary: "sealed",
    sites: 4, layout: "scattered", dropRadius: 60, dropDepth: 1.6, ratio: 1.2, depositRate: 0.02, redissolve: 0.02,
    lateWater: true, backruns: 4, backrunStep: 110, backrunGap: 20, backrunDepth: 1.6, backrunRadius: 55,
    steps: 360, grid: 96,
    showPigment: true, colorMode: "ramp", bands: 6, gain: 6, opacity: 0.85, showSuspended: true,
    showFronts: false, frontEvery: 20, frontWeight: 0.8,
    showFilm: false, filmOpacity: 0.25, filmEdge: 0.8,
    showOutline: false, outlineWeight: 1,
  },
  validate: validateWetPigment,
};
