import { bundledControlSequenceIds, bundledControlSequenceInfo } from "../composition/control-sequence-samples.js";
import { MAX_FIELD_CELLS } from "../composition/grains.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter =>
  visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["isoLevels"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, options), visibleWhen);

const reserved: Condition = { protect: ["ellipse", "rectangle", "word"] };
const worded: Condition = { protect: ["word"] };
const grained: Condition = { material: ["grains", "both"] };
const lined: Condition = { material: ["isolines", "both"] };
const overlaid: Condition = { overlay: [true] };

const sequenceSelect: Parameter = {
  ...choice("sequence", "Sequence", "Which bundled evolving spline to deposit from. Each has its own control points, duration and timing; every seed performs it differently (a curtain lowered or raised, a rope whipped either way, a blob with two to four lobes).",
    [...bundledControlSequenceIds]),
  options: bundledControlSequenceIds.map((value) => ({ value, label: bundledControlSequenceInfo[value].title })),
};

const parameters: Parameter[] = [
  sequenceSelect,
  n("motion", "Control motion", "How far the control points travel about their own average positions: 0 freezes the spline at its average shape, so the sand falls from one still curve; 1 is the sequence as supplied; more exaggerates it.", 0, 2, 0.05, 0, 4),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the control points' extent.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the control points' extent.", 0, 640, 1, -4096, 4096),
  n("scale", "Scale", "Uniform scale of the whole sequence about its center; grain sizes keep their canvas sizes.", 0.4, 1.8, 0.01, 0.01, 100),
  n("rotation", "Rotation", "Turns the sequence about its center, in degrees.", -180, 180, 1, -3600, 3600),

  n("windowStart", "Window start", "Where the deposit begins, as a fraction of the sequence's duration. Grains released before it are gone; the rest stay exactly where they were.", 0, 1, 0.01, 0, 0.99),
  n("windowLength", "Window length", "How much of the sequence deposits after the start, as a fraction of its duration; it stops at the end of the sequence.", 0.05, 1, 0.01, 0.01, 1),

  n("deposit", "Deposit", "Sand released per unit of curve length per second, in area units. More deposit puts more grains on the canvas; the mass does not depend on how many grains stand for it.", 1, 12, 0.25, 0.001, 10000),
  n("grainMass", "Grain mass", "Mean mass of one grain, in area units. Halving it doubles the grains and keeps the same total mass and the same overall tone: it changes how fine the sand is, not how much of it there is.", 0.5, 3, 0.05, 0.01, 100),
  n("lag", "Fall time", "Longest delay before a grain lands, in milliseconds. Each grain draws its own fraction of it; 0 puts grains on the curve.", 0, 1500, 10, 0, 60000),
  n("fall", "Fall speed", "Speed at which grains fall while they are in the air, in canvas units per second.", 0, 400, 5, 0, 100000),
  n("fallAngle", "Fall direction", "Direction of the fall in degrees: 90 falls toward the bottom of the canvas, 0 toward the right.", -180, 180, 1, -3600, 3600),
  n("inherit", "Carried motion", "Share of the curve's own velocity, at the point a grain leaves, that it keeps while it falls: 0 drops straight, 1 throws along the motion.", 0, 1.5, 0.01, 0, 4),
  n("spread", "Grain spread", "Standard deviation of the random offset where each grain lands, in canvas units: small keeps sharp curtains, large lets the deposit bloom into a haze.", 0, 40, 0.5, 0, 5000),

  select("protect", "Protected space", "A region grains never land in: an ellipse, a rectangle or the outline of a word. Grains that would land there are dropped, not moved; the sand around it is unchanged.", ["none", "ellipse", "rectangle", "word"]),
  select("protectWord", "Protected word", "The word whose letters stay empty.", ["SAND", "VOID", "AIR", "DUNE"], worded),
  n("protectX", "Space center X", "Horizontal canvas position of the protected space.", 0, 640, 1, -4096, 4096, reserved),
  n("protectY", "Space center Y", "Vertical canvas position of the protected space.", 0, 640, 1, -4096, 4096, reserved),
  n("protectWidth", "Space width", "Width of the protected space, in canvas units; a word is fitted inside the box.", 20, 600, 1, 1, 10000, reserved),
  n("protectHeight", "Space height", "Height of the protected space, in canvas units.", 20, 600, 1, 1, 10000, reserved),

  n("exposure", "Exposure", "Photographic stops of exposure: each stop doubles how strongly a given amount of sand shows, so the same grains in the same places read fainter or denser. It never moves a grain.", -3, 3, 0.1, -10, 10),
  select("material", "Material", "Grains draws every grain as a mark; isolines traces where the accumulated sand reaches given densities; both draws the isolines beneath the grains.", ["grains", "isolines", "both"]),
  n("grainSize", "Grain size", "Diameter of each grain's mark, in canvas units. Larger grains cover more paper each and show fainter, so the tone of the deposit stays the same.", 0.6, 6, 0.1, 0.05, 500, grained),
  n("isoLevels", "Isolines", "Number of density contours, from a faint fringe to a dense core.", 1, 12, 1, 1, 32, lined),
  n("fieldCell", "Field cell", "Edge of one cell of the density grid the isolines are traced in, in canvas units; smaller follows individual grains, larger draws smoother, coarser lines.", 4, 16, 0.5, 1.5, 1000, lined),
  n("isoSmooth", "Isoline smoothing", "Standard deviation of the blur applied to the density before it is traced, in canvas units; it moves sand between neighbouring cells without changing the total.", 4, 30, 1, 0, 1000, lined),
  n("isoWeight", "Isoline weight", "Stroke width of the isolines.", 0.3, 4, 0.05, 0, 50, lined),

  toggle("overlay", "Curve overlay", "Draw the generating spline itself, crisp, at a few moments inside the window."),
  n("overlayEvery", "Overlay interval", "Time between the curves drawn, in milliseconds; they sit at multiples of it from the start of the sequence.", 40, 1500, 10, 1, 1000000, overlaid),
  n("overlayWeight", "Overlay weight", "Stroke width of the overlaid curves.", 0.3, 4, 0.05, 0, 50, overlaid),
];

const controlGroups: ControlGroup[] = [
  { label: "Sequence", stage: "form", controls: ["sequence", "motion"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", "scale", "rotation"] },
  { label: "Time window", stage: "process", controls: ["windowStart", "windowLength"] },
  { label: "Deposition", stage: "process", controls: ["deposit", "grainMass",
    { label: "Fall", controls: ["lag", "fall", "fallAngle", "inherit", "spread"] }] },
  { label: "Protected space", stage: "process", controls: ["protect", "protectWord", "protectX", "protectY",
    { label: "Size", controls: ["protectWidth", "protectHeight"], proportional: true }] },
  { label: "Exposure", stage: "process", controls: ["exposure", "material"] },
  { label: "Grains", stage: "material", controls: ["grainSize"] },
  { label: "Isolines", stage: "material", controls: ["isoLevels", "fieldCell", "isoSmooth", "isoWeight"] },
  { label: "Curve overlay", stage: "material", controls: ["overlay", "overlayEvery", "overlayWeight"] },
];

type Values = Record<string, number | string | boolean>;

/**
 * Work that follows from the stored values alone. The grain count depends on the curve's length, hence on the
 * sequence and seed; that is checked where the grains are built, with the same messages (`deposition.ts`).
 */
export function validateSandDeposition(q: Values): void {
  if (q.material !== "grains") {
    const cell = q.fieldCell as number, columns = Math.ceil(640 / cell);
    if (columns * columns > MAX_FIELD_CELLS)
      throw new Error(`The density field would need ${columns * columns} cells; the limit is ${MAX_FIELD_CELLS}. Raise the field cell`);
    const radius = Math.ceil(3 * (q.isoSmooth as number) / cell);
    if (radius > 60) throw new Error(`Smoothing spans ${radius} cells; the limit is 60. Lower the isoline smoothing or raise the field cell`);
  }
}

export const sandDepositionDefinitions: InstrumentDefinition[] = [{
  id: "sand-deposition", title: "Sand Deposition",
  description: "Sand falls from a moving spline: the control points travel through time, grains are released along the curve and land with a delay, and their accumulated density is drawn as exposed grains, isolines, or both. A protected region stays empty; a sparse crisp copy of the generating curve can lie on top.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    sequence: "curtain", motion: 1,
    centerX: 320, centerY: 320, scale: 1, rotation: 0,
    windowStart: 0.04, windowLength: 0.56,
    deposit: 8, grainMass: 1.2, lag: 900, fall: 200, fallAngle: 90, inherit: 0.3, spread: 3.5,
    protect: "ellipse", protectWord: "SAND", protectX: 320, protectY: 410, protectWidth: 170, protectHeight: 110,
    exposure: 1, material: "grains", grainSize: 2.2,
    isoLevels: 5, fieldCell: 5, isoSmooth: 8, isoWeight: 1,
    overlay: false, overlayEvery: 700, overlayWeight: 1.2,
  },
  validate: validateSandDeposition,
}];
