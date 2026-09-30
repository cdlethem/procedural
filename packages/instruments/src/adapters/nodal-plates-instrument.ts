import { NODAL_LIMITS } from "../composition/nodal-plate.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { numeric } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
type Option = readonly [value: string, label: string];
type Values = Record<string, number | string | boolean>;
const control = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition, integer = false): Parameter =>
  control(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly Option[], visibleWhen?: Condition): Parameter =>
  control({ key, label, description, type: "select", options: options.map(([value, text]) => ({ value, label: text })) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter =>
  control({ key, label, description, type: "boolean" }, visibleWhen);

/** Modes 2–4 exist only when the mode count reaches them; mode 1 is always present. */
const from = (count: number): Condition => ({ modes: ["1", "2", "3", "4"].filter((v) => Number(v) >= count) });
const circle: Condition = { shape: ["circle"] };
const combined = from(2);
const markStroke: Condition = { grainKind: ["rings", "rosette", "arrow"] };
const turnable: Condition = { grainKind: ["rosette", "arrow"] };
const lineOn: Condition = { lines: [true] };

/** Per-mode controls; mode 1 is unconditional except that its weight and phase only matter beside another mode. */
function modeControls(i: number): Parameter[] {
  const when = i === 1 ? undefined : from(i);
  const beside = i === 1 ? combined : from(i);
  const spun: Condition = { ...when, ...circle };
  return [
    n(`n${i}`, "Index n", "Interior nodal lines across the width (square, rectangle) or nodal diameters (circle). 0 gives a mode that does not vary across the width.", 0, 10, 1, 0, NODAL_LIMITS.index, when, true),
    n(`m${i}`, "Index m", "Interior nodal lines across the height (square, rectangle) or nodal circles inside the edge (circle). Under a free edge, n = m = 0 is the uniform mode with no nodes.", 0, 10, 1, 0, NODAL_LIMITS.index, when, true),
    n(`weight${i}`, "Weight", "Signed share of this mode in the sum; only ratios matter, and a negative weight flips the mode. The classic figure is a mode minus its swapped partner.", -1, 1, 0.05, -1000, 1000, beside),
    n(`phase${i}`, "Phase", "Initial phase in degrees. It acts through the snapshot: with Time 0 each mode's share is weight × cos(phase), so 90° silences the mode; with Time above 0 different modes turn at different rates.", -180, 180, 1, -3600, 3600, beside),
    n(`orient${i}`, "Orientation", "Circle only: turns the mode's diameters about the center, in degrees clockwise. Modes with no diameters (n = 0) are round and do not change.", -180, 180, 1, -3600, 3600, spun),
  ];
}

const parameters: Parameter[] = [
  select("shape", "Plate", "Square, rectangle or disc. The mode functions and their wavenumbers follow the shape: cosines and sines of the width and height, or Bessel functions of the radius.",
    [["square", "Square"], ["rectangle", "Rectangle"], ["circle", "Circle"]]),
  select("edge", "Edge", "One boundary condition for every mode: free (the slope across the edge is zero, so nodal lines meet the edge squarely and the edge is not a node) or fixed (the edge is a node; the sign changes inside it). Modes of the two are never mixed. This is a scalar wave model, not a plate-vibration simulation.",
    [["free", "Free"], ["fixed", "Fixed"]]),
  flag("outline", "Outline", "Draw the plate's edge."),
  n("outlineWeight", "Outline weight", "Stroke weight of the plate edge.", 0.5, 4, 0.1, 0, 50, { outline: [true] }),

  n("centerX", "Center X", "Horizontal canvas position of the plate center.", 100, 540, 1, -4000, 4000),
  n("centerY", "Center Y", "Vertical canvas position of the plate center.", 100, 540, 1, -4000, 4000),
  n("width", "Width", "Width of a rectangle, side of a square, diameter of a circle.", 160, 620, 1, 1, NODAL_LIMITS.size),
  n("height", "Height", "Height of a rectangle. The wavenumbers of modes that swap n and m differ when the plate is not square, so the pair drifts apart in Time.", 160, 620, 1, 1, NODAL_LIMITS.size, { shape: ["rectangle"] }),
  n("rotation", "Rotation", "Turns the whole plate about its center, in degrees clockwise.", -90, 90, 1, -3600, 3600),

  select("modes", "Modes", "How many modes are added. One mode is a pure standing wave; two or more interfere.",
    [["1", "One"], ["2", "Two"], ["3", "Three"], ["4", "Four"]]),
  n("time", "Time", "Snapshot time in periods of the lowest mode. Each mode turns at a rate proportional to its wavenumber, so figures built from modes with different wavenumbers change with Time; a pair with equal wavenumbers (n and m swapped on a square) keeps its nodal figure.", 0, 2, 0.01, -1000, 1000, combined),
  ...[1, 2, 3, 4].flatMap(modeControls),

  n("tolerance", "Node width", "Half-width of the node band as a fraction of the peak amplitude. It sets how tightly grains cling to the nodal lines and how wide the band fill is.", 0.02, 0.2, 0.005, 0.002, 1),
  n("resolution", "Line resolution", "Sample cells across the plate's longest side for the nodal lines and bands. Crossings of two lines are resolved to one cell.", 60, 240, 1, NODAL_LIMITS.minResolution, NODAL_LIMITS.maxResolution, undefined, true),

  n("particles", "Particles", "Grains drawn toward the nodes. Raising it only adds grains; the earlier ones stay where they were.", 0, 6000, 50, 0, NODAL_LIMITS.particles, undefined, true),
  n("separation", "Separation", "Least distance between two grains in canvas units, so the sand does not pile into one blob. 0 lets them overlap.", 0, 12, 0.1, 0, 1000),
  select("grainKind", "Grain mark", "The mark drawn at each grain.", [["dot", "Dot"], ["rings", "Ring"], ["rosette", "Rosette"], ["arrow", "Arrow"]]),
  n("grainSize", "Grain size", "Diameter of a grain mark.", 1, 12, 0.1, 0, 500),
  n("grainWeight", "Grain line weight", "Stroke weight of ring, rosette and arrow grains.", 0.3, 3, 0.1, 0, 50, markStroke),
  n("grainPetals", "Petals", "Spokes of a rosette.", 2, 12, 1, 1, 48, { grainKind: ["rosette"] }, true),
  n("grainOpening", "Opening", "Share of the radius left empty at the center of a ring or rosette.", 0, 1, 0.01, 0, 1, { grainKind: ["rings", "rosette"] }),
  n("grainVariation", "Size variation", "Stable per-grain shrinkage; 0 makes every grain the same size.", 0, 1, 0.01, 0, 1),
  n("grainRetention", "Grain retention", "Share of grains that are drawn, chosen per grain; the others leave bare paper without moving any.", 0, 1, 0.01, 0, 1),
  select("grainColor", "Grain color", "One palette color for all grains, or two by the sign of the amplitude at the grain (the two lobes either side of a nodal line).", [["single", "Single"], ["sign", "By lobe"]]),
  flag("align", "Follow node", "Turn each grain to the direction of the nodal line beside it, so arrows and rosettes show the flow of the figure.", turnable),

  flag("lines", "Nodal lines", "Draw the lines where the amplitude is exactly zero."),
  select("lineKind", "Line material", "Solid ink, tangent stitches or beads along each line.", [["ink", "Ink"], ["stitch", "Stitch"], ["beads", "Beads"]], lineOn),
  n("lineWeight", "Line weight", "Stroke weight of ink or stitches.", 0.3, 4, 0.1, 0, 50, { lines: [true], lineKind: ["ink", "stitch"] }),
  n("lineSpacing", "Station spacing", "Distance along a line between stitches or beads.", 3, 24, 0.5, 0.5, 1000, { lines: [true], lineKind: ["stitch", "beads"] }),
  n("lineBead", "Bead size", "Diameter of a bead.", 1, 12, 0.1, 0, 500, { lines: [true], lineKind: ["beads"] }),

  flag("bands", "Node bands", "Fill the region within Node width of a nodal line: the voids and concentrations as one shape."),
  n("bandOpacity", "Band opacity", "Opacity of the band fill.", 0.05, 0.6, 0.01, 0, 1, { bands: [true] }),
];

const modeGroup = (i: number): ControlGroup => ({ label: `Mode ${i}`, controls: [`n${i}`, `m${i}`, `weight${i}`, `phase${i}`, `orient${i}`] });
const controlGroups: ControlGroup[] = [
  { label: "Plate", controls: ["shape", "edge", "outline", "outlineWeight"] },
  { label: "Placement", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }, "rotation"] },
  { label: "Modes", controls: ["modes", "time", modeGroup(1), modeGroup(2), modeGroup(3), modeGroup(4)] },
  { label: "Nodes", controls: ["tolerance", "resolution"] },
  { label: "Grains", controls: ["particles", "separation", "grainKind", { label: "Scale", controls: ["grainSize", "grainWeight"], proportional: true },
    { label: "Shape", controls: ["grainPetals", "grainOpening"] }, "grainVariation", "grainRetention", "grainColor", "align"] },
  { label: "Nodal lines", controls: ["lines", "lineKind", "lineWeight", "lineSpacing", "lineBead"] },
  { label: "Bands", controls: ["bands", "bandOpacity"] },
];

/** Scalar rules only; geometry-dependent limits are checked when built, naming their controls. */
export function validateNodalPlates(q: Values): void {
  const count = Number(q.modes);
  let total = 0;
  for (let i = 1; i <= count; i++) total += i === 1 && count === 1 ? 1 : Math.abs(q[`weight${i}`] as number);
  if (!(total > 0)) throw new Error("All mode weights are zero. Give at least one visible mode a nonzero Weight");
}

export const nodalPlatesDefinition: InstrumentDefinition = {
  id: "nodal-plates",
  title: "Nodal Plates",
  description: "Grains gather along the nodes of combined standing waves: the sand-on-a-plate figures. Choose square, rectangle or disc, one edge condition, and up to four modes with weights and phases; the nodal lines, node bands and grains all come from the same field.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    shape: "square", edge: "free", outline: true, outlineWeight: 1.2,
    centerX: 320, centerY: 320, width: 500, height: 500, rotation: 0,
    modes: "2", time: 0,
    n1: 3, m1: 5, weight1: 1, phase1: 0, orient1: 0,
    n2: 5, m2: 3, weight2: -1, phase2: 0, orient2: 0,
    n3: 2, m3: 1, weight3: 0.5, phase3: 0, orient3: 0,
    n4: 1, m4: 4, weight4: 0.4, phase4: 0, orient4: 0,
    tolerance: 0.05, resolution: 160,
    particles: 3200, separation: 2.6, grainKind: "dot", grainSize: 3.2, grainWeight: 1.2, grainPetals: 6, grainOpening: 0.3,
    grainVariation: 0.35, grainRetention: 1, grainColor: "sign", align: false,
    lines: true, lineKind: "ink", lineWeight: 0.8, lineSpacing: 8, lineBead: 4,
    bands: false, bandOpacity: 0.18,
  },
  validate: validateNodalPlates,
};
