import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { cyclicParams } from "../composition/cyclic-params.js";
import { choice, numeric, text } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
type Option = readonly [value: string, label: string];
const control = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition, integer = false): Parameter =>
  control(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly Option[], visibleWhen?: Condition): Parameter =>
  control({ ...choice(key, label, description, options.map(([value]) => value)), options: options.map(([value, name]) => ({ value, label: name })) }, visibleWhen);

const random: Condition = { initial: ["random"] };
const seeded: Condition = { initial: ["spirals"] };
const sized: Condition = { initial: ["spirals", "stamp"] };
const stamped: Condition = { initial: ["stamp"] };
const striped: Condition = { initial: ["stripes"] };
const disturbed: Condition = { initial: ["spirals", "stripes", "stamp"] };
const walled: Condition = { obstacles: ["blocks", "ring", "bars", "letters"] };
const thick: Condition = { obstacles: ["blocks", "ring", "bars"] };
const counted: Condition = { obstacles: ["blocks", "bars"] };
const opened: Condition = { obstacles: ["ring", "bars"] };
const lettered: Condition = { obstacles: ["letters"] };
const flat: Condition = { fill: ["flat"] };
const hatched: Condition = { fill: ["hatch"] };
const marked: Condition = { cellMark: ["dot", "rings", "rosette", "arrow"] };
const fronted: Condition = { fronts: ["advancing", "all"] };
const beaded: Condition = { fronts: ["advancing", "all"], frontMaterial: ["stitch", "beads"] };
const cored: Condition = { coreMark: ["dot", "rings", "rosette", "arrow"] };

const markOptions: readonly Option[] = [["none", "None"], ["dot", "Dot"], ["rings", "Rings"], ["rosette", "Rosette"], ["arrow", "Arrow"]];

const parameters: Parameter[] = [
  n("states", "States", "Number of states on the cycle. A cell in state s can only become s + 1 (the last wraps to the first); the higher the count, the more colors interleave and the longer a wave takes to come round.", 3, 16, 1, 3, 24, undefined, true),
  select("neighbourhood", "Neighbourhood", "Which cells vote: the full square (Moore), the diamond (von Neumann) or a hollow ring at the chosen range. The shape decides whether fronts are round, diagonal or lumpy.", [["moore", "Square (Moore)"], ["neumann", "Diamond (von Neumann)"], ["ring", "Ring"]]),
  n("range", "Range", "How far the neighbourhood reaches, in cells. Longer reach smooths fronts and makes domains larger.", 1, 4, 1, 1, 6, undefined, true),
  n("threshold", "Threshold", "How many neighbours must already be in the next state before a cell advances. Low values make every front sweep on; high values freeze thin fronts and leave only strong domains to grow. A value above the neighbourhood size is an error.", 1, 12, 1, 1, 60, undefined, true),
  n("columns", "Columns", "Cells across the width; rows follow the height-to-width ratio of Size, so cells are square. More columns are finer fronts and more work per step.", 24, 160, 1, 8, 240, undefined, true),
  n("steps", "Steps", "Synchronous updates applied to the initial grid. Drag to watch domains grow and spirals wind; step 0 is the start. A grid that stops changing stays as it is.", 0, 300, 1, 0, 2000, undefined, true),
  n("centerX", "Center X", "Horizontal center of the grid in canvas units.", 0, 640, 1, -4000, 4000),
  n("centerY", "Center Y", "Vertical center of the grid in canvas units.", 0, 640, 1, -4000, 4000),
  n("width", "Width", "Grid width in canvas units; the cell side is this divided by Columns.", 80, 640, 1, 16, 4000),
  n("height", "Height", "Grid height in canvas units; rows are chosen so cells stay square.", 80, 640, 1, 16, 4000),
  select("initial", "Start", "How the grid is filled at step 0: random cells, seeded pinwheels, straight stripes or one designed stamp.", [["random", "Random cells"], ["spirals", "Seeded pinwheels"], ["stripes", "Stripes"], ["stamp", "Designed stamp"]]),
  n("density", "Density", "Chance a cell starts in a random state; the rest start in state 0. Below 1 the random cells nucleate separate domains on a quiet ground.", 0, 1, 0.01, 0, 1, random),
  n("seedCount", "Pinwheels", "Number of seeded pinwheels. Each has a seed-chosen position, turning direction and starting color; adding one leaves the others where they were.", 1, 24, 1, 0, 64, seeded, true),
  n("seedSize", "Seed size", "Radius in cells of each pinwheel or of the stamp.", 3, 30, 0.5, 1, 200, sized),
  select("stamp", "Stamp", "The designed start: one pinwheel, two counter-rotating pinwheels, concentric rings, or three pinwheels braided around the center.", [["pinwheel", "Pinwheel"], ["counter-rotating", "Counter-rotating pair"], ["target", "Target rings"], ["triad", "Three pinwheels"]], stamped),
  n("stampX", "Stamp X", "Horizontal position of the stamp as a fraction of the grid width.", 0, 1, 0.01, 0, 1, stamped),
  n("stampY", "Stamp Y", "Vertical position of the stamp as a fraction of the grid height.", 0, 1, 0.01, 0, 1, stamped),
  n("stripeWidth", "Stripe width", "Width of each state's band in cells.", 1, 20, 0.5, 0.5, 200, striped),
  n("stripeAngle", "Stripe angle", "Direction in which the states increase, in degrees (0 = left to right, 90 = downward).", -180, 180, 1, -3600, 3600, striped),
  n("noise", "Disturbance", "Share of cells reset to a random state after the pattern is drawn. A little of it nucleates spirals along straight stripes and around stamps.", 0, 0.2, 0.005, 0, 1, disturbed),
  select("obstacles", "Obstacles", "Cells that never change and are never counted, so fronts stop and bend around them: seeded blocks, a ring wall, walls with gaps, or a word.", [["none", "None"], ["blocks", "Blocks"], ["ring", "Ring wall"], ["bars", "Barred walls"], ["letters", "Lettering"]]),
  n("obstacleSize", "Obstacle size", "Block side or wall thickness in cells.", 1, 12, 0.5, 1, 60, thick),
  n("obstacleCount", "Obstacle count", "Number of blocks or vertical walls.", 1, 20, 1, 0, 400, counted, true),
  n("obstacleGap", "Opening", "Share of the ring's circumference, or of each wall's height, left open. Fronts pass through openings and curl into spirals behind them.", 0, 0.9, 0.01, 0, 1, opened),
  control(text("obstacleText", "Lettering", "One to twenty printable characters, fitted across the grid as walls.", 20), lettered),
  select("obstacleDraw", "Obstacle color", "Obstacle cells painted darker than the darkest palette color, lighter than the lightest, or not painted (the gaps stay empty and fronts simply stop).", [["dark", "Darker than the palette"], ["light", "Lighter than the palette"], ["hidden", "Not drawn"]], walled),
  select("fill", "Cell fill", "How each state's cells are painted: merged flat rectangles, hatching whose angle turns with the state, or nothing.", [["flat", "Flat color"], ["hatch", "Hatching by state"], ["none", "None"]]),
  n("fillOpacity", "Fill opacity", "Opacity of the flat cell color. Below 1 hairline seams can show between merged rectangles.", 0, 1, 0.01, 0, 1, flat),
  n("hatchSpacing", "Hatch spacing", "Distance between hatch lines in canvas units.", 1.5, 12, 0.1, 0.5, 200, hatched),
  n("hatchWeight", "Hatch weight", "Stroke width of the hatch lines in canvas units.", 0.3, 4, 0.05, 0, 30, hatched),
  n("hatchAngle", "Hatch angle", "Angle of state 0's hatching in degrees; each following state turns by 180 / States, so the cycle reads as a slow rotation.", -90, 90, 1, -3600, 3600, hatched),
  select("cellMark", "Cell mark", "A mark at the center of every cell, colored by its state and turned by it (arrows and rosettes show the phase as a direction).", markOptions),
  n("cellMarkSize", "Mark size", "Mark diameter as a fraction of the cell side.", 0.1, 1.5, 0.05, 0, 4, marked),
  n("cellMarkWeight", "Mark weight", "Line width of ring, rosette and arrow marks in canvas units.", 0.2, 3, 0.05, 0, 30, marked),
  select("fronts", "Fronts", "Interface paths between neighboring cells of different states. Advancing fronts are the moving edges (a state and its successor); all adds defects between states that are not neighbors on the cycle, which random starts leave behind.", [["advancing", "Advancing fronts"], ["all", "Fronts and defects"], ["none", "None"]]),
  select("frontMaterial", "Front material", "Solid ink, stitches or beads along the fronts, colored by the state that is invading.", [["ink", "Ink"], ["stitch", "Stitches"], ["beads", "Beads"]], fronted),
  select("frontColor", "Front color", "Color fronts by the state that is invading (they blend into the fill), or in the darkest or lightest palette color so they stand out over it.", [["state", "By invading state"], ["dark", "Darkest color"], ["light", "Lightest color"]], fronted),
  n("frontWeight", "Front weight", "Line width of the fronts in canvas units.", 0.3, 4, 0.05, 0, 30, fronted),
  n("frontSpacing", "Stitch spacing", "Distance between stitches or beads along a front.", 2, 16, 0.5, 1, 500, beaded),
  n("smoothing", "Smoothing", "Corner-cutting passes on the fronts. 0 follows the cell sides exactly; 3 is a flowing curve. Ends stay put, so fronts still meet at junctions.", 0, 3, 1, 0, 3, fronted, true),
  n("echoes", "Earlier fronts", "How many earlier positions of the fronts to draw, thinner the older they are, like ripples left behind.", 0, 6, 1, 0, 7, fronted, true),
  n("echoSpacing", "Steps between", "Steps between one earlier front and the next. It only matters with earlier fronts.", 1, 12, 1, 1, 2000, fronted, true),
  select("coreMark", "Core mark", "A mark at every spiral core: a corner where all the states meet in cyclic order. Winding one way uses the first palette color, the other way the second.", markOptions),
  n("coreReach", "Core reach", "Radius in cells of the loop that tests each corner for winding states. Small values find only tight pinwheels; larger ones find real spiral cores and merge cores that sit close together.", 1, 4, 1, 1, 4, cored, true),
  n("coreSize", "Core size", "Diameter of a core mark in canvas units.", 3, 24, 0.5, 0, 200, cored),
  n("coreWeight", "Core weight", "Line width of ring, rosette and arrow core marks.", 0.3, 3, 0.05, 0, 30, cored),
  select("colors", "Colors", "How the palette maps onto states: a smooth loop through the palette (neighbors are similar, the cycle has no seam) or palette entries repeated in order.", [["ramp", "Loop through the palette"], ["cycle", "Repeat entries"]]),
];

const controlGroups: ControlGroup[] = [
  { label: "Rule", stage: "form", controls: ["states", "neighbourhood", "range", "threshold"] },
  { label: "Grid and time", stage: "process", controls: ["columns", "steps"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }] },
  { label: "Start", stage: "form", controls: ["initial", "density", "seedCount", "seedSize", "stamp", "stampX", "stampY", "stripeWidth", "stripeAngle", "noise"] },
  { label: "Obstacles", stage: "process", controls: ["obstacles", "obstacleSize", "obstacleCount", "obstacleGap", "obstacleText", "obstacleDraw"] },
  { label: "Cells", stage: "form", controls: ["fill", "fillOpacity", { label: "Hatching", controls: ["hatchSpacing", "hatchWeight", "hatchAngle"] },
    { label: "Cell mark", controls: ["cellMark", "cellMarkSize", "cellMarkWeight"] }] },
  { label: "Fronts", stage: "material", controls: ["fronts", "frontMaterial", "frontColor", "frontWeight", "frontSpacing", "smoothing", { label: "Earlier fronts", controls: ["echoes", "echoSpacing"] }] },
  { label: "Cores", stage: "material", controls: ["coreMark", "coreReach", { label: "Scale", controls: ["coreSize", "coreWeight"], proportional: true }] },
  { label: "Color", stage: "color", controls: ["colors"] },
];

export const cyclicFrontsDefinition: InstrumentDefinition = {
  id: "cyclic-fronts",
  title: "Cyclic Fronts",
  description: "Expanding domains, interleaved fronts and spiral waves from a cyclic cellular automaton: every cell steps to the next of n states when enough neighbors already are, and the state cells, the fronts between them and the spiral cores can each be drawn on their own.",
  renderer: "2d",
  parameters,
  controlGroups,
  defaults: {
    states: 8, neighbourhood: "moore", range: 2, threshold: 3, columns: 96, steps: 70,
    centerX: 320, centerY: 320, width: 560, height: 560,
    initial: "spirals", density: 1, seedCount: 5, seedSize: 12, stamp: "pinwheel", stampX: 0.5, stampY: 0.5, stripeWidth: 4, stripeAngle: 30, noise: 0,
    obstacles: "none", obstacleSize: 3, obstacleCount: 6, obstacleGap: 0.2, obstacleText: "CYCLE", obstacleDraw: "dark",
    fill: "flat", fillOpacity: 1, hatchSpacing: 4, hatchWeight: 1, hatchAngle: 0, cellMark: "none", cellMarkSize: 0.6, cellMarkWeight: 0.8,
    fronts: "advancing", frontMaterial: "ink", frontColor: "dark", frontWeight: 1.1, frontSpacing: 6, smoothing: 2, echoes: 0, echoSpacing: 4,
    coreMark: "rings", coreReach: 2, coreSize: 12, coreWeight: 1.2, colors: "ramp",
  },
  validate(params) { cyclicParams(params as Record<string, number | string | boolean>); },
};
