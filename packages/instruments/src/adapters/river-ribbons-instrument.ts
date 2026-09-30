import { RIVER_LIMITS, checkRiver, type RiverOptions } from "../composition/river.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
/** A slider interval `[min, max]` inside the hard limits of the producer (`RIVER_LIMITS`), or the documented hard limits of an appearance control. */
const n = (key: string, label: string, description: string, min: number, max: number, step: number, visibleWhen?: Condition,
  hard: readonly [number, number] = [RIVER_LIMITS[key][0], RIVER_LIMITS[key][1]], integer = RIVER_LIMITS[key]?.[2] ?? false): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin: hard[0], hardMax: hard[1], integer }), visibleWhen);
const appearance = (key: string, label: string, description: string, min: number, max: number, step: number, hard: readonly [number, number],
  visibleWhen?: Condition, integer = false): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin: hard[0], hardMax: hard[1], integer }), visibleWhen);
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, options), visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter =>
  withCondition(toggle(key, label, description), visibleWhen);

const wandering: Condition = { planform: ["wandering"] };
const sineGenerated: Condition = { planform: ["sine-generated"] };
const shown: Condition = { showChannel: [true] };
const banked: Condition = { banks: [true] };
const scarred: Condition = { scars: ["lines", "bands"] };
const lined: Condition = { scars: ["lines"] };
const ribboned: Condition = { oxbows: ["ribbon"] };
const marked: Condition = { oxbows: ["ink", "stitch", "beads"] };
const plain: Condition = { floodplain: [true] };

const parameters: Parameter[] = [
  select("planform", "Starting channel", "Wandering: a seeded, irregular offset from the valley axis. Sine-generated: the regular sine-generated curve of real meanders, the same for every seed.", ["wandering", "sine-generated"]),
  n("harmonics", "Wiggle harmonics", "The highest sine harmonic of the wandering start: more harmonics give more, tighter bends along the valley.", 2, 10, 1, wandering),
  n("amplitude", "Start amplitude", "How far the starting channel swings from the valley axis, as a fraction of the room between the valley walls; 0 is a straight channel that never moves.", 0.1, 1, 0.01, wandering),
  n("waves", "Start wavelengths", "Whole wavelengths of the sine-generated start along the valley; each wavelength is a bend each way.", 1, 6, 1, sineGenerated),
  n("turn", "Start turn", "Peak deviation of the sine-generated channel's direction from the valley axis, in degrees; larger is more sinuous (shrunk across the valley if it would not fit).", 10, 80, 1, sineGenerated),

  n("centerX", "Valley center X", "Horizontal canvas position of the middle of the valley.", 0, 640, 1),
  n("centerY", "Valley center Y", "Vertical canvas position of the middle of the valley.", 0, 640, 1),
  n("length", "Valley length", "Distance along the valley between the pinned inlet and outlet, in canvas units.", 240, 620, 1),
  n("confinement", "Valley half-width", "Distance from the valley axis to each wall, in canvas units. The banks are held inside; a narrow valley presses the channel into tight switchbacks and cuts it off often.", 50, 320, 1),
  n("angle", "Valley angle", "Rotation of the whole valley in degrees; 0 runs left to right.", -90, 90, 1),

  n("width", "Channel width", "Width of the channel at the inlet, in canvas units. Migration, spacing, smoothing and the cutoff all scale with it, so a different width is the same river at another scale.", 3, 14, 0.25),
  n("discharge", "Outlet discharge", "Discharge at the outlet relative to the inlet, growing along the channel; the channel widens with its square root. 1 keeps a constant width.", 0.4, 3, 0.05),

  n("steps", "Migration steps", "How many steps the channel migrates from the starting channel. Drag it to watch the river move, cut off and leave scars; every step is retained, so going back is cheap.", 0, 360, 1),
  n("mobility", "Bank mobility", "How fast the banks erode, in channel widths per step per unit of width times curvature. Higher bends and cuts off sooner; 0 leaves the channel where it started.", 0.02, 0.3, 0.005),
  n("smoothing", "Smoothing length", "Length, in channel widths, over which curvature is averaged along the channel before it drives erosion. Longer makes broad, rounded bends; shorter lets tight bends run away.", 1, 6, 0.25),
  n("skew", "Downstream lag", "0 averages curvature evenly both ways along the channel. 1 feels only the curvature upstream, so bends slide downstream as they grow.", 0, 1, 0.05),
  n("heterogeneity", "Bank resistance", "How unevenly the floodplain erodes: 0 is uniform; higher leaves resistant patches the channel bends around and soft ground where it swings. Seeded.", 0, 0.9, 0.05),
  n("cutoff", "Cutoff neck", "When two distant parts of the channel come closer than this many channel widths the bend between them is cut off into an oxbow. Lower lets bends grow into tighter loops first.", 1.6, 5, 0.1),
  n("spacing", "Node spacing", "Distance between the equally spaced nodes of the centerline, in channel widths. Finer follows tight bends; coarser is cheaper. It must not exceed half the cutoff neck.", 0.5, 0.8, 0.05),

  flag("showChannel", "Current channel", "Draw the current channel as a ribbon whose width follows the discharge."),
  appearance("channelOpacity", "Channel opacity", "Opacity of the current channel ribbon.", 0.2, 1, 0.01, [0, 1], shown),
  appearance("widening", "Bend widening", "How much the ribbon swells where the channel bends: 0 keeps the discharge width, 1 doubles it at the tightest bends. Drawing only; it does not change how the channel migrates.", 0, 1, 0.05, [0, 2], shown),
  flag("banks", "Bank lines", "Draw both banks as lines along the ribbon's edges.", shown),
  appearance("bankWeight", "Bank weight", "Stroke width of the bank lines.", 0.3, 3, 0.05, [0.05, 30], banked),

  select("scars", "Old channels", "How earlier channel positions are drawn: lines are thin centerlines, bands are full ribbons; both fade with age.", ["off", "lines", "bands"]),
  appearance("scarEvery", "Scar interval", "Draw the channel's position every this many steps, counted from step 0. Small gives dense scroll-bar scars; large a few clear positions.", 1, 40, 1, [1, 600], scarred, true),
  appearance("scarOpacity", "Scar opacity", "Opacity of the newest scars before they fade.", 0.1, 1, 0.01, [0, 1], scarred),
  appearance("scarWeight", "Scar weight", "Stroke width of scar lines before they narrow with age.", 0.3, 3, 0.05, [0.05, 30], lined),
  select("oxbows", "Oxbows", "How the abandoned bends left by cutoffs are drawn: as a ribbon narrowing with age, or along their centerline as ink, stitches or beads.", ["off", "ribbon", "ink", "stitch", "beads"]),
  appearance("oxbowOpacity", "Oxbow opacity", "Opacity of the newest oxbow ribbons before they fade.", 0.1, 1, 0.01, [0, 1], ribboned),
  appearance("oxbowWeight", "Oxbow mark size", "Line weight of ink and stitches, or bead diameter, along the oxbow centerlines.", 0.5, 6, 0.1, [0.05, 30], marked),
  appearance("fade", "Fade age", "Age in steps at which scars and oxbows reach their faintest and narrowest.", 20, 400, 5, [1, 100000], undefined, true),
  appearance("deposition", "Infilling", "How much sediment fills an abandoned channel by the fade age: 0 keeps its width, 1 fills it completely.", 0, 1, 0.05, [0, 1]),

  flag("floodplain", "Age field", "Tint the floodplain by how long ago the channel last occupied each cell, newest strongest."),
  appearance("plainCell", "Age cell", "Edge of one cell of the age field, in canvas units.", 3, 16, 0.5, [1, 64], plain),
  appearance("plainOpacity", "Age opacity", "Opacity of the newest cells of the age field.", 0.05, 0.8, 0.01, [0, 1], plain),
];

const controlGroups: ControlGroup[] = [
  { label: "Starting channel", controls: ["planform", "harmonics", "amplitude", "waves", "turn"] },
  { label: "Placement", controls: ["centerX", "centerY", { label: "Size", proportional: true, controls: ["length", "confinement"] }, "angle"] },
  { label: "Channel", controls: ["width", "discharge"] },
  { label: "Migration", controls: ["steps", "mobility", { label: "Smoothing", controls: ["smoothing", "skew"] }, "heterogeneity", "cutoff", "spacing"] },
  { label: "Ribbon", controls: ["showChannel", "channelOpacity", "widening", { label: "Banks", controls: ["banks", "bankWeight"] }] },
  { label: "Scars", controls: ["scars", "scarEvery", "scarOpacity", "scarWeight", "oxbows", "oxbowOpacity", "oxbowWeight"] },
  { label: "Age", controls: ["fade", "deposition"] },
  { label: "Floodplain", controls: ["floodplain", "plainCell", "plainOpacity"] },
];

type Values = Record<string, number | string | boolean>;

/** Everything the producer reads from stored controls: `steps` and the construction, with the hidden planform's controls ignored. */
export function riverOptionsOf(q: Values, seed: number): RiverOptions {
  const num = (key: string) => q[key] as number;
  return { seed, steps: num("steps"), centerX: num("centerX"), centerY: num("centerY"), length: num("length"), angle: num("angle"), confinement: num("confinement"),
    planform: q.planform as RiverOptions["planform"], harmonics: num("harmonics"), amplitude: num("amplitude"), waves: num("waves"), turn: num("turn"),
    width: num("width"), discharge: num("discharge"), mobility: num("mobility"), smoothing: num("smoothing"), skew: num("skew"),
    heterogeneity: num("heterogeneity"), spacing: num("spacing"), cutoff: num("cutoff") };
}

/** Coupled bounds that follow from the stored values alone (the seed changes no bound). */
export function validateRiverRibbons(q: Values): void {
  checkRiver(riverOptionsOf(q, 0));
}

export const riverRibbonsDefinition: InstrumentDefinition = {
  id: "river-ribbons", title: "River Ribbons",
  description: "A river channel that migrates: bends erode toward their outsides at a rate set by smoothed curvature, tight necks cut off into oxbows, and every earlier position is kept. Drawn as a ribbon whose width follows the discharge, faded scars of old channels and oxbows, and an age tint of the floodplain.",
  renderer: "2d", parameters, controlGroups,
  defaults: {
    planform: "wandering", harmonics: 6, amplitude: 0.6, waves: 3, turn: 60,
    centerX: 320, centerY: 320, length: 600, confinement: 190, angle: 0,
    width: 8, discharge: 2, steps: 260, mobility: 0.22, smoothing: 3, skew: 0.5, heterogeneity: 0.4, cutoff: 3, spacing: 0.7,
    showChannel: true, channelOpacity: 0.9, widening: 0.35, banks: true, bankWeight: 0.8,
    scars: "lines", scarEvery: 3, scarOpacity: 0.85, scarWeight: 1, oxbows: "ribbon", oxbowOpacity: 0.55, oxbowWeight: 1.6,
    fade: 160, deposition: 0.5, floodplain: false, plainCell: 6, plainOpacity: 0.35,
  },
  validate: validateRiverRibbons,
};
