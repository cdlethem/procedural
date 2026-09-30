import { MAX_LACE_VERTICES, laceVertexEstimate } from "../composition/lace-families.js";
import type { LaceShape } from "../composition/lace-families.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric, text, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["strands", "twists", "detail", "columns", "rows", "levels", "resolution", "loops", "smoothing", "colorA", "colorB", "casingColor"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: [string, string][], visibleWhen?: Condition): Parameter =>
  withCondition({ ...choice(key, label, description, options.map(([value]) => value)), options: options.map(([value, name]) => ({ value, label: name })) }, visibleWhen);

const braid: Condition = { family: ["knot"] }, plait: Condition = { family: ["celtic"] };
const fields: Condition = { family: ["contours"] }, loose: Condition = { family: ["loops"] };
const open: Condition = { family: ["contours", "loops"] };
const ranked: Condition = { rule: ["rank"] };
const cased: Condition = { style: ["cased"] }, dashed: Condition = { style: ["stitch", "beads"] };
const families: Condition = { coloring: ["families"] };
const ended: Condition = { terminal: ["dot", "rings", "arrow"] };
const fieldChoices: [string, string][] = [["noise", "Noise"], ["hills", "Hills"], ["waves", "Waves"], ["saddle", "Saddle"]];

const parameters: Parameter[] = [
  select("family", "Path family", "Which bundled set of interlacing paths is built: a braid closure (trefoil and its relatives), a Celtic plait, the contours of two fields, or seeded random loops. Everything after this only decides how the same crossings are woven and drawn.",
    [["knot", "Braid knot"], ["celtic", "Celtic plait"], ["contours", "Two-field contours"], ["loops", "Random loops"]]),
  n("strands", "Strands", "Times the curve winds around the centre. Two strands with three twists is the trefoil diagram; the crossing count is twists × (strands − 1), and gcd(strands, twists) separate loops appear.", 2, 7, 1, 2, 9, braid),
  n("twists", "Twists", "Radial oscillations of the curve per revolution set; more twists add crossings between neighbouring turns.", 1, 9, 1, 1, 12, braid),
  n("depth", "Radial depth", "How far the curve swings in and out from its middle radius; low depth crowds the crossings into a band, high depth opens the centre.", 0.2, 0.6, 0.01, 0.05, 0.6, braid),
  n("detail", "Vertices per turn", "Sample density of the braid curve before smoothing. Low values show straight facets unless corner cuts round them.", 12, 60, 1, 6, 120, braid),
  n("columns", "Columns", "Cell columns of the plait grid. Strands cross at the middle of every interior cell edge.", 2, 10, 1, 1, 24, plait),
  n("rows", "Rows", "Cell rows of the plait grid. gcd(columns, rows) separate strands weave through an unblocked plait.", 2, 10, 1, 1, 24, plait),
  n("blocked", "Blocked edges", "Share of interior cell edges where strands turn back instead of crossing. It removes crossings and reconnects strands, turning a plait into knotwork; raising it only blocks more edges.", 0, 0.5, 0.01, 0, 1, plait),
  select("field", "First field", "Height field whose contours make the first strand family.", fieldChoices, fields),
  select("fieldB", "Second field", "Height field for the second family (its own seed). Contours of one field never cross; the two families weave. Two identical unseeded fields need a frequency ratio other than 1.", fieldChoices, fields),
  n("frequency", "Frequency", "Wave cycles or noise scale of the first field across the footprint.", 0.5, 5, 0.05, 0.1, 20, fields),
  n("ratio", "Second frequency", "Frequency of the second field as a multiple of the first.", 0.5, 2, 0.05, 0.25, 4, fields),
  n("levels", "Levels", "Contour levels drawn from each field.", 2, 9, 1, 1, 12, fields),
  n("levelStep", "Level step", "Field-value distance between successive contours: small steps crowd the strands, large steps thin them.", 0.05, 0.3, 0.005, 0.02, 1, fields),
  n("resolution", "Grid resolution", "Field samples per side; changes contour detail and vertex count.", 24, 64, 1, 12, 70, fields),
  n("loops", "Loops", "Closed loops scattered on a seeded 6 × 6 cell grid; raising it adds loops without moving the others.", 3, 24, 1, 1, 24, loose),
  n("reach", "Reach", "Loop radius in cell widths: small loops sit apart, large ones overlap several neighbours.", 0.6, 2.4, 0.05, 0.3, 3, loose),
  n("wobble", "Wobble", "Harmonic distortion of each loop away from a circle.", 0, 1, 0.01, 0, 1, loose),
  n("openShare", "Open arcs", "Share of loops cut open into arcs with free ends. An open arc that enters a loop makes strict alternation impossible on that loop, which the overlay reports.", 0, 1, 0.01, 0, 1, loose),
  n("smoothing", "Corner cuts", "Chaikin corner-cutting passes on every path: 0 keeps the source polygon, each pass halves its corners. Crossing positions shift slightly; the topology of a plait or knot does not.", 0, 4, 1, 0, 5),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the lace.", 100, 540, 1, -4000, 4000),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the lace.", 100, 540, 1, -4000, 4000),
  n("width", "Width", "Width the family is stretched to; knots and plaits stretch, contour fields are sampled over it.", 160, 620, 1, 1, 4000),
  n("height", "Height", "Height the family is stretched to.", 160, 620, 1, 1, 4000),
  n("rotation", "Rotation", "Turns the whole lace about its centre, in degrees. Over/under relationships are unchanged.", -90, 90, 1, -3600, 3600),

  select("rule", "Crossing rule", "Alternate makes every strand go over, under, over, ... along its length wherever that can be satisfied. Seeded flips an independent coin at each crossing. Rank puts the higher-ranked strand over everywhere.",
    [["alternate", "Alternate"], ["seeded", "Seeded"], ["rank", "Rank"]]),
  select("rankBy", "Rank by", "Which strand is over at a crossing: the later one in the path list, the second colour family, or the longer strand. Equal ranks fall back to a seeded coin.",
    [["order", "Path order"], ["family", "Second family"], ["length", "Longer strand"]], ranked),
  toggle("invert", "Invert", "Swap over and under at every crossing: the mirror weave, with identical geometry."),
  { ...text("exceptions", "Exceptions", "Crossing numbers to reverse after the rule, such as \"3, 7, 12-14\". Turn on Numbers in the overlay to read the numbers. Under the alternate rule each exception breaks the alternation there.", 300), },

  select("style", "Strand style", "Ink is one solid stroke; cased adds an outline; stitch and beads read the same pieces as dashes or a chain. Every style has the same gaps at the under strand.",
    [["ink", "Ink"], ["cased", "Cased"], ["stitch", "Stitch"], ["beads", "Beads"]]),
  n("widthA", "Width A", "Full stroke width of the first strand family (even-numbered strands). It also sets the size of the gaps it cuts in others and of beads.", 3, 18, 0.5, 0, 200),
  n("widthB", "Width B", "Full stroke width of the second strand family; zero hides that family, which then opens no gaps.", 3, 18, 0.5, 0, 200),
  n("casing", "Casing", "Thickness of the outline on each side of a cased strand, inside its full width; the core is what remains.", 0.5, 4, 0.1, 0, 100, cased),
  n("clearance", "Clearance", "Extra empty travel each side of a crossing, on top of the stroke widths and round caps.", 0, 8, 0.25, 0, 200),
  n("minAngle", "Shallowest woven crossing", "Crossings where the strands meet at less than this angle (degrees) are left unwoven: both strokes overlap with no gap. Weaving a near-tangent crossing would cut the whole strand away.", 0, 60, 1, 0, 89),
  n("spacing", "Station spacing", "Distance between stitch centres or bead centres along each piece.", 3, 30, 0.5, 0.5, 1000, dashed),
  n("stitchPhase", "Station phase", "Slides stations along every piece by a fraction of the spacing.", 0, 1, 0.01, 0, 1, { style: ["stitch", "beads"] }),
  select("beadMark", "Bead mark", "Filled dots or open rings on the chain.", [["dot", "Dot"], ["rings", "Rings"]], { style: ["beads"] }),

  select("coloring", "Colouring", "Families colours the two families with the slots below; strands gives every strand its own palette entry so you can follow one strand through the weave.",
    [["families", "By family"], ["strands", "By strand"]]),
  n("colorA", "Colour A", "Palette entry (zero-based) of the first family.", 0, 4, 1, 0, 15, families),
  n("colorB", "Colour B", "Palette entry (zero-based) of the second family.", 0, 4, 1, 0, 15, families),
  n("casingColor", "Casing colour", "Palette entry (zero-based) of the outline.", 0, 4, 1, 0, 15, cased),

  select("terminal", "End mark", "Mark placed at each free end of an open strand.", [["none", "None"], ["dot", "Dot"], ["rings", "Ring"], ["arrow", "Arrow"]], open),
  n("terminalSize", "End size", "Diameter of the end mark.", 3, 20, 0.5, 0, 200, { ...open, ...ended }),
  n("trim", "End trim", "Length removed from each free end, so open strands stop short of the footprint edge.", 0, 30, 0.5, 0, 2000, open),

  select("overlay", "Overlay", "Reading aids drawn on top of the lace: crossing numbers (for Exceptions), rings on crossings where the alternation breaks, or rings on strands that pass close without crossing.",
    [["none", "None"], ["numbers", "Numbers"], ["breaks", "Breaks"], ["near", "Near misses"]]),
];

const controlGroups: ControlGroup[] = [
  { label: "Paths", stage: "form", controls: ["family",
    { label: "Braid", controls: ["strands", "twists", "depth", "detail"] },
    { label: "Plait", controls: [{ label: "Grid", controls: ["columns", "rows"], proportional: true }, "blocked"] },
    { label: "Fields", controls: ["field", "fieldB", "frequency", "ratio", "levels", "levelStep", "resolution"] },
    { label: "Loops", controls: ["loops", "reach", "wobble", "openShare"] },
    "smoothing"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }, "rotation"] },
  { label: "Crossings", stage: "process", controls: ["rule", "rankBy", "invert", "exceptions"] },
  { label: "Strands", stage: "material", controls: ["style", { label: "Line weights", controls: ["widthA", "widthB"], proportional: true }, "casing", "clearance", "minAngle",
    { label: "Stations", controls: ["spacing", "stitchPhase"] }, "beadMark"] },
  { label: "Color", stage: "color", controls: ["coloring", { label: "Palette", controls: ["colorA", "colorB", "casingColor"] }] },
  { label: "Ends", stage: "material", controls: ["terminal", "terminalSize", "trim"] },
  { label: "Diagnostics", stage: "process", controls: ["overlay"] },
];

type Values = Record<string, number | string | boolean>;

/** Parse "3, 7, 12-14" into sorted unique positive integers; anything else is an error naming the control. */
export function parseExceptions(source: string): number[] {
  const numbers = new Set<number>();
  for (const token of source.split(/[\s,;]+/).filter(Boolean)) {
    const range = /^(\d+)(?:-(\d+))?$/.exec(token);
    if (!range) throw new Error(`Exceptions: "${token}" is not a crossing number or range such as 12-14`);
    const low = Number(range[1]), high = range[2] === undefined ? low : Number(range[2]);
    if (low < 1 || high < low || high - low > 5000) throw new Error(`Exceptions: "${token}" is not a valid range of crossing numbers (from 1)`);
    for (let value = low; value <= high; value++) numbers.add(value);
    if (numbers.size > 5000) throw new Error("Exceptions lists more than 5000 crossings; clear some of them");
  }
  return [...numbers].sort((a, b) => a - b);
}

/** The bundled family's shape from the stored values. */
export function laceShape(q: Values): LaceShape {
  switch (q.family) {
    case "knot": return { kind: "knot", strands: q.strands as number, twists: q.twists as number, depth: q.depth as number, detail: q.detail as number };
    case "celtic": return { kind: "celtic", columns: q.columns as number, rows: q.rows as number, breaks: q.blocked as number };
    case "contours": return { kind: "contours", field: q.field as "noise", fieldB: q.fieldB as "noise", frequency: q.frequency as number,
      ratio: q.ratio as number, levels: q.levels as number, levelStep: q.levelStep as number, resolution: q.resolution as number };
    case "loops": return { kind: "loops", count: q.loops as number, reach: q.reach as number, wobble: q.wobble as number, openShare: q.openShare as number };
    default: throw new Error(`Unknown path family: ${String(q.family)}`);
  }
}

/** Work that follows from the stored values alone; geometry-dependent limits are checked when built, with controls named. */
export function validateCrossingLace(q: Values): void {
  parseExceptions(q.exceptions as string);
  const estimate = laceVertexEstimate(laceShape(q), q.smoothing as number);
  if (estimate !== null && estimate > MAX_LACE_VERTICES)
    throw new Error(`The lace would have ${estimate} vertices after smoothing; the limit is ${MAX_LACE_VERTICES}. Lower Corner cuts or the family's size (Vertices per turn, Strands, Columns, Rows, Loops)`);
  if (q.family === "contours" && q.field === q.fieldB && (q.field === "waves" || q.field === "saddle") && q.ratio === 1)
    throw new Error("First field and Second field are the same unseeded field; their contours would coincide. Choose a different Second field or a Second frequency other than 1");
  const visible = [q.widthA as number, q.widthB as number].filter((width) => width > 0);
  if (q.style === "cased" && visible.length && (q.casing as number) * 2 > Math.min(...visible))
    throw new Error("Casing is thicker than half the narrowest visible strand; lower Casing or raise Width A / Width B");
}

export const crossingLaceDefinition: InstrumentDefinition = {
  id: "crossing-lace", title: "Crossing Lace",
  description: "Interlacing paths woven wherever they really cross: every crossing is found, given an over and an under strand by an explicit rule you can override, and the under strand is cut open around it. A braid knot, a Celtic plait, two contour families or random loops.",
  renderer: "2d",
  parameters, controlGroups,
  procedure: "Diagonal strands wind across a grid of cells, turning back where an edge is blocked, and every point where two strands cross is found. At each crossing one strand passes over and the other is cut open beneath it, so the lines read as thread woven over and under.",
  featured: ["columns", "rows", "blocked"],
  defaults: {
    family: "celtic", strands: 3, twists: 4, depth: 0.42, detail: 30,
    columns: 6, rows: 4, blocked: 0.14,
    field: "noise", fieldB: "hills", frequency: 2.2, ratio: 1, levels: 6, levelStep: 0.13, resolution: 44,
    loops: 9, reach: 1.05, wobble: 0.5, openShare: 0.2,
    smoothing: 3,
    centerX: 320, centerY: 320, width: 540, height: 400, rotation: 0,
    rule: "alternate", rankBy: "order", invert: false, exceptions: "",
    style: "cased", widthA: 13, widthB: 13, casing: 2.4, clearance: 1.8, minAngle: 20, spacing: 9, stitchPhase: 0.35, beadMark: "dot",
    coloring: "strands", colorA: 1, colorB: 2, casingColor: 0,
    terminal: "none", terminalSize: 8, trim: 0,
    overlay: "none",
  },
  validate: validateCrossingLace,
};
