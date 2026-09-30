import { colonyOptionsOf, validateColony } from "../composition/cell-division.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter =>
  visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["seedCount", "maxCells", "relax", "steps", "nutrientLevels"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, options), visibleWhen);

const located: Condition = { source: ["edge", "point", "pair"] };
const spotted: Condition = { source: ["point", "pair"] };
const supplied: Condition = { source: ["edge", "point", "pair", "ring"] };
const fixedAxis: Condition = { orientation: ["fixed"] };
const steered: Condition = { orientation: ["gradient", "across", "radial", "tangential", "fixed"] };
const laid: Condition = { seedLayout: ["cluster", "ring", "line"] };
const marked: Condition = { cells: ["discs", "outlines", "nucleated"] };
const outlined: Condition = { cells: ["outlines", "nucleated"] };
const linked: Condition = { lineage: ["ink", "stitch", "beads"] };
const spaced: Condition = { lineage: ["stitch", "beads"] };
const beaded: Condition = { lineage: ["beads"] };
const contoured: Condition = { nutrient: ["contours"] };
const walled: Condition = { walls: ["outlines", "hatch", "both"] };
const wallLined: Condition = { walls: ["outlines", "both"] };
const hatched: Condition = { walls: ["hatch", "both"] };

const parameters: Parameter[] = [
  select("source", "Nutrient source", "Where nutrient enters: an edge of the dish, one spot, two opposite spots, a ring inside the wall, or nowhere (the colony lives on the reserve alone and stops when it is eaten). A source is held at full strength; cells eat what diffuses out of it, so the colony grows toward it.",
    ["ring", "edge", "point", "pair", "none"]),
  n("sourceAngle", "Source direction", "Direction from the dish centre to the source, in degrees: 0 is to the right, 90 toward the bottom.", -180, 180, 1, -3600, 3600, located),
  n("sourceOffset", "Source distance", "How far from the centre a spot source sits, as a fraction of the half width: 0 is in the middle, 1 at the wall.", 0, 1, 0.01, 0, 1, spotted),
  n("sourceSize", "Source size", "Thickness of an edge or ring source, or radius of a spot, as a fraction of the shorter side. A larger source feeds more of the dish at once.", 0.02, 0.3, 0.005, 0, 1, supplied),
  n("reserve", "Reserve", "Nutrient already spread through the dish at the start, as a fraction of a source's strength. 0 starts empty, so growth waits for the supply to arrive; higher lets the colony start at once and eat down its own surroundings.", 0, 1, 0.01, 0, 1),
  n("diffusion", "Diffusion", "How quickly nutrient spreads, in canvas units squared per step. Low keeps the food near its source, so the colony hugs it and thins away from it; high evens the dish out.", 10, 200, 5, 0, 100000),
  n("fieldCell", "Field cell", "Edge of one cell of the nutrient grid, in canvas units. Smaller resolves the food more finely and costs more per step; it does not change how fast the food spreads.", 8, 16, 0.5, 1, 200),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the dish.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the dish.", 0, 640, 1, -4096, 4096),
  n("width", "Width", "Width of the dish, in canvas units. The colony grows inside it; a wider dish holds more cells before it fills.", 200, 620, 1, 20, 2000),
  n("height", "Height", "Height of the dish, in canvas units.", 200, 620, 1, 20, 2000),

  select("seedLayout", "Seed layout", "How the first cells are placed: a packed cluster, a ring, a line, or scattered over a disc by the seed.", ["cluster", "ring", "line", "scatter"]),
  n("seedCount", "Seed cells", "How many cells the colony starts from. Each founds its own family, so several seeds grow separate clans that meet.", 1, 24, 1, 1, 2000),
  n("seedX", "Seed X", "Horizontal position of the seed cells' centre, as a fraction of the dish width.", 0, 1, 0.01, 0, 1),
  n("seedY", "Seed Y", "Vertical position of the seed cells' centre, as a fraction of the dish height.", 0, 1, 0.01, 0, 1),
  n("seedSpread", "Seed spread", "Radius of the seed cluster, ring or scatter, or half the length of the seed line, in canvas units.", 0, 150, 1, 0, 4000),
  n("seedAngle", "Seed angle", "Turns the seed line, or the ring or cluster pattern, in degrees.", -180, 180, 1, -3600, 3600, laid),

  n("startRadius", "Start radius", "Radius of a seed cell, in canvas units. Cells that never find food stay near this size. It cannot exceed the division radius.", 2, 8, 0.25, 0.05, 500),
  n("divideRadius", "Division radius", "A cell divides when it grows to this radius; no cell grows larger. Larger cells mean fewer, bolder cells in the same dish.", 8, 20, 0.25, 0.05, 500),
  n("uptake", "Uptake", "Share of the nutrient under a cell that it absorbs each step. Higher grows and divides faster and starves the neighbours behind a growing front sooner.", 0.02, 0.3, 0.005, 0.0001, 1),
  n("maxCells", "Cell limit", "Most cells the colony will hold. At the limit division stops, cells finish growing and the colony settles.", 30, 400, 10, 1, 2000),

  n("split", "Split", "Share of the mother's area that the larger daughter takes: 0.5 divides evenly, higher gives one big and one small daughter, so sizes differ from the first division on.", 0.5, 0.9, 0.01, 0.5, 0.95),
  select("orientation", "Division axis", "The line the daughters separate along: random, along or across the nutrient gradient (chains toward the food, or sheets across it), out from or around the colony's middle, or one fixed direction. With a slope the larger daughter leads toward the food or outward.",
    ["random", "gradient", "across", "radial", "tangential", "fixed"]),
  n("splitAngle", "Fixed axis", "Direction of the division axis in degrees when it is fixed.", -180, 180, 1, -3600, 3600, fixedAxis),
  n("orientJitter", "Axis jitter", "Random turn, up to this many degrees either way, added to each division axis. 0 follows the rule exactly.", 0, 90, 1, 0, 180, steered),

  select("boundary", "Boundary", "The dish wall: a rectangle, or the ellipse inside it. Cells and nutrient stay inside; cells pile up against the wall.", ["dish", "box"]),
  n("overlap", "Allowed overlap", "How far two cells may overlap before they are pushed apart, as a fraction of the sum of their radii. 0 keeps them touching but never overlapping; higher lets a crowded colony compress.", 0, 0.3, 0.01, 0, 0.5),
  n("stiffness", "Stiffness", "Share of an overlap resolved each relaxation pass. Low leaves soft, overlapping cells; 1 pushes them apart at once. At 0 cells never move apart.", 0.05, 1, 0.05, 0, 1),
  n("relax", "Relaxation", "Overlap-resolving passes per step. More passes spread the push through a crowd; fewer let daughters stay tucked where they were born. Each pass costs time in a large colony.", 1, 4, 1, 1, 16),

  n("steps", "Steps", "How long the colony has grown. Drag it to watch the colony grow and divide; the states before it never change, they are only extended.", 0, 250, 1, 0, 1000),

  n("ageMin", "Youngest shown", "Hide cells younger than this fraction of the run: 0 shows even the cells born at the last step, 1 only the founders. If it is above the oldest shown, nothing is drawn.", 0, 1, 0.01, 0, 1),
  n("ageMax", "Oldest shown", "Hide cells older than this fraction of the run: 1 shows the founders, lower shows only their descendants. Hiding never moves a cell.", 0, 1, 0.01, 0, 1),
  select("colorBy", "Color by", "What the palette encodes: generation (divisions since a founder), age (palette order, first colour the oldest), size (radius against the division radius, first colour the smallest), or which founder the cell descends from.",
    ["generation", "age", "size", "root"]),

  select("cells", "Cells", "How each cell is drawn at its own size: a filled disc, an outline, an outline with a nucleus ring, or not at all.", ["discs", "outlines", "nucleated", "none"]),
  n("cellFit", "Cell size", "Diameter of the drawn cell as a fraction of its true diameter. Below 1 leaves a visible gap between neighbours.", 0.4, 1, 0.01, 0.05, 1.5, marked),
  n("cellWeight", "Cell weight", "Stroke width of outlines and nuclei.", 0.3, 4, 0.05, 0, 50, outlined),

  select("lineage", "Lineage", "Draws the division tree: a line from where a mother stood when she divided to each daughter, in ink, as stitches or as beads.", ["none", "ink", "stitch", "beads"]),
  select("lineageColor", "Lineage color", "Whether every link takes the first palette colour, which keeps the family web legible over the cells, or each link takes its daughter's colour.", ["first", "cell"], linked),
  n("lineageWeight", "Lineage weight", "Stroke width of the lineage lines.", 0.3, 4, 0.05, 0, 50, linked),
  n("lineageSpacing", "Lineage spacing", "Distance between stitches or beads along a line, in canvas units.", 3, 20, 0.5, 0.5, 1000, spaced),
  n("lineageBead", "Lineage bead", "Diameter of a bead, in canvas units.", 1, 8, 0.25, 0, 500, beaded),

  select("nutrient", "Nutrient lines", "Draws contours of the nutrient concentration where the colony stopped: the food it has left and the fronts it is chasing.", ["none", "contours"]),
  n("nutrientLevels", "Nutrient levels", "How many concentration contours, evenly spaced between empty and full.", 1, 12, 1, 1, 32, contoured),
  n("nutrientWeight", "Nutrient weight", "Stroke width of the nutrient contours.", 0.3, 3, 0.05, 0, 50, contoured),

  select("walls", "Cell walls", "Divides the dish into each cell's nearest territory and draws it: outlines, hatching, or both. Territories are cut at Wall reach so cells at the colony's edge keep round walls.", ["none", "outlines", "hatch", "both"]),
  n("wallReach", "Wall reach", "How far a wall may reach from its cell, in cell radii. Around 1 wraps each cell closely; large values tile the whole dish.", 1, 4, 0.05, 0.1, 1000, walled),
  n("wallWeight", "Wall weight", "Stroke width of wall outlines.", 0.3, 3, 0.05, 0, 50, wallLined),
  n("hatchSpacing", "Hatch spacing", "Distance between hatch lines inside the cells, in canvas units.", 2, 12, 0.25, 0.5, 200, hatched),
  n("hatchAngle", "Hatch angle", "Direction of the hatch lines in the founding generation, in degrees.", -90, 90, 1, -3600, 3600, hatched),
  n("hatchTwist", "Hatch twist", "How many degrees the hatch direction turns with each generation: 0 hatches every cell alike, larger makes a cell's line direction tell its family depth.", -90, 90, 1, -3600, 3600, hatched),
  n("hatchWeight", "Hatch weight", "Stroke width of the hatch lines.", 0.2, 2, 0.05, 0, 50, hatched),
];

const controlGroups: ControlGroup[] = [
  { label: "Nutrient", stage: "form", controls: ["source", "sourceAngle", "sourceOffset", "sourceSize", "reserve", "diffusion", "fieldCell"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }] },
  { label: "Seed cells", stage: "form", controls: ["seedLayout", "seedCount", "seedX", "seedY", "seedSpread", "seedAngle"] },
  { label: "Growth", stage: "process", controls: [{ label: "Radii", controls: ["startRadius", "divideRadius"], proportional: true }, "uptake", "maxCells"] },
  { label: "Division", stage: "process", controls: ["split", "orientation", "splitAngle", "orientJitter"] },
  { label: "Mechanics", stage: "process", controls: ["boundary", "overlap", "stiffness", "relax"] },
  { label: "Time", stage: "process", controls: ["steps"] },
  { label: "Age selection", stage: "process", controls: ["ageMin", "ageMax"] },
  { label: "Color", stage: "color", controls: ["colorBy"] },
  { label: "Cells", stage: "form", controls: ["cells", "cellFit", "cellWeight"] },
  { label: "Lineage", stage: "material", controls: ["lineage", "lineageColor", "lineageWeight", "lineageSpacing", "lineageBead"] },
  { label: "Nutrient lines", stage: "material", controls: ["nutrient", "nutrientLevels", "nutrientWeight"] },
  { label: "Walls", stage: "material", controls: ["walls", "wallReach", "wallWeight", "hatchSpacing", "hatchAngle", "hatchTwist", "hatchWeight"] },
];

type Values = Record<string, number | string | boolean>;

/** Everything that follows from the stored values alone (the colony itself is built, and bounded again, where it runs). */
export function validateCellDivision(q: Values): void {
  validateColony(colonyOptionsOf(q), q.steps as number);
}

export const cellDivisionDefinitions: InstrumentDefinition[] = [{
  id: "cell-division", title: "Cell Division",
  description: "A colony of cells eats a diffusing nutrient, grows, and divides in two when it is big enough, pushing its neighbours aside. Cells near the food grow large and divide; starved ones stay small, so the colony's sizes and generations record where the food was. Draw the cells, their family tree, the nutrient left in the dish and each cell's territory, all from the same colony.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    source: "ring", sourceAngle: 0, sourceOffset: 0.5, sourceSize: 0.06, reserve: 0.3, diffusion: 100, fieldCell: 8,
    centerX: 320, centerY: 320, width: 560, height: 560,
    seedLayout: "cluster", seedCount: 3, seedX: 0.5, seedY: 0.5, seedSpread: 16, seedAngle: 0,
    startRadius: 7, divideRadius: 13, uptake: 0.12, maxCells: 400,
    split: 0.6, orientation: "random", splitAngle: 0, orientJitter: 0,
    boundary: "dish", overlap: 0.05, stiffness: 0.5, relax: 4,
    steps: 230,
    ageMin: 0, ageMax: 1, colorBy: "generation",
    cells: "discs", cellFit: 0.85, cellWeight: 1,
    lineage: "ink", lineageColor: "first", lineageWeight: 0.8, lineageSpacing: 6, lineageBead: 2.5,
    nutrient: "none", nutrientLevels: 5, nutrientWeight: 0.8,
    walls: "none", wallReach: 1.6, wallWeight: 0.8, hatchSpacing: 4, hatchAngle: 45, hatchTwist: 30, hatchWeight: 0.6,
  },
  validate: validateCellDivision,
}];
