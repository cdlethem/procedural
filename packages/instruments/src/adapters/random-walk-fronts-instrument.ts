import { bundledRasterIds, bundledRasterInfo } from "../composition/raster-samples.js";
import { WALK_GRID_LIMITS } from "../composition/walk-grid.js";
import { WALK_FRONT_LIMITS } from "../composition/walk-fronts.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { numeric, text, toggle } from "./types.js";

type Condition = NonNullable<Parameter["visibleWhen"]>;
type Option = readonly [value: string, label: string];
const control = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition, integer = false): Parameter =>
  control(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly Option[], visibleWhen?: Condition): Parameter =>
  control({ key, label, description, type: "select", options: options.map(([value, name]) => ({ value, label: name })) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter => control(toggle(key, label, description), visibleWhen);

const shaped: Condition = { mask: ["disc", "ring", "islands", "chambers", "letters"] };
const ringed: Condition = { mask: ["ring"] };
const islanded: Condition = { mask: ["islands"] };
const lettered: Condition = { mask: ["letters"] };
const toned: Condition = { mask: ["tones"] };
const walled: Condition = { barrier: ["wall"] };
const enclosed: Condition = { barrier: ["enclosure"] };
const barred: Condition = { barrier: ["wall", "enclosure"] };
const pillared: Condition = { barrier: ["pillars"] };
const crossing: Condition = { revisit: ["own", "any"] };
const wandering: Condition = { transition: ["cycle", "random"] };
const filled: Condition = { fill: ["flat", "bands"] };
const banded: Condition = { fill: ["bands"] };
const lined: Condition = { lines: ["territory", "contours", "both"] };
const stitched: Condition = { lineMaterial: ["stitch", "beads"] };
const hatched: Condition = { hatch: [true] };
const marked: Condition = { marks: [true] };

const imageOptions: readonly Option[] = bundledRasterIds.map((id): Option => [id, `${bundledRasterInfo[id].title}: ${bundledRasterInfo[id].character}`]);

export const randomWalkFrontsParameters: Parameter[] = [
  select("mask", "Region", "The part of the canvas the walk may occupy. Open is the whole lattice; disc, ring, islands and chambers are shapes; letters are the outline of a word; tones are the pixels of a bundled image whose lightness lies in an interval. Cells outside the region are never claimed, and a piece of the region that no seed reaches stays empty.",
    [["open", "Open lattice"], ["disc", "Disc"], ["ring", "Ring"], ["islands", "Islands"], ["chambers", "Chambers"], ["letters", "Letters"], ["tones", "Image tones"]]),
  n("maskSize", "Region size", "Size of the shape as a fraction of the lattice's shorter side (a word is fitted inside that fraction of the lattice width and height).", 0.3, 1, 0.01, 0.05, 1, shaped),
  n("ringWidth", "Ring width", "Thickness of the ring as a fraction of its outer radius.", 0.1, 0.9, 0.01, 0.02, 0.98, ringed),
  n("islands", "Islands", "How many separate blobs; they sit on a spiral and may touch and merge at the largest counts. Seeds decide which of them fill.", 2, 24, 1, 1, 64, islanded, true),
  control(text("word", "Word", "Printable ASCII letters (1 to 20) fitted inside the region. Counters such as the hole of an A stay empty.", 20), lettered),
  select("image", "Source image", "The bundled sample image whose pixels are thresholded. Each is a deterministic synthetic picture, not a photograph, and a new seed draws a different variant. Binding your own image to a Studio layer is future host work; the library functions already accept any mask you construct." +
    " " + bundledRasterIds.map((id) => `${bundledRasterInfo[id].title}: ${bundledRasterInfo[id].character}.`).join(" "), imageOptions, toned),
  n("toneFrom", "Tone from", "Darkest lightness (CIE L*, 0 to 1) that belongs to the region.", 0, 1, 0.01, 0, 1, toned),
  n("toneTo", "Tone to", "Lightest lightness that belongs to the region. A narrow interval selects thin tone bands, often several separate pieces.", 0, 1, 0.01, 0, 1, toned),

  select("barrier", "Barrier", "Cells the walk may never enter, cut out of the region. A wall with a gap makes the front squeeze through; an enclosure with no gap makes a pocket that stays empty unless a seed falls inside; pillars leave a grid of holes.",
    [["none", "None"], ["wall", "Wall with a gap"], ["enclosure", "Enclosure"], ["pillars", "Pillars"]]),
  n("wallPosition", "Wall position", "Horizontal position of the wall as a fraction of the lattice width.", 0.1, 0.9, 0.01, 0, 1, walled),
  n("barrierWidth", "Wall thickness", "Thickness of the wall or the enclosure's ring, in cells.", 1, 8, 0.5, 0.5, 100, barred),
  n("barrierGap", "Gap", "Width of the opening in the wall (centred vertically) or in the enclosure (on its right), in cells. Zero closes it completely.", 0, 24, 1, 0, 400, barred),
  n("enclosureSize", "Enclosure size", "Outer diameter of the enclosure as a fraction of the lattice's shorter side.", 0.2, 0.9, 0.01, 0.05, 1, enclosed),
  n("pillarSpacing", "Pillar spacing", "Distance between pillar centres in cells.", 6, 30, 1, 3, 200, pillared),
  n("pillarRadius", "Pillar radius", "Radius of each pillar in cells; it must be less than half the spacing.", 1, 8, 0.5, 0.5, 100, pillared),

  n("centerX", "Center X", "Horizontal canvas position of the lattice centre. Moving or resizing the lattice repaints the same walk.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical canvas position of the lattice centre.", 0, 640, 1, -4096, 4096),
  n("columns", "Columns", "Lattice cells across. The walk is computed on the lattice, so more cells means finer fronts and more steps to fill them.", 24, 160, 1, WALK_GRID_LIMITS.minSide, WALK_GRID_LIMITS.maxSide, undefined, true),
  n("rows", "Rows", "Lattice cells down.", 24, 160, 1, WALK_GRID_LIMITS.minSide, WALK_GRID_LIMITS.maxSide, undefined, true),
  n("cell", "Cell size", "Canvas units per cell. It only scales the drawing: the walk is identical for any cell size.", 1.5, 12, 0.25, 0.5, 64),

  select("seedLayout", "Seed layout", "Where the walk starts. Scatter spreads seeds by seeded best-of-six spacing; grid and ring snap a regular pattern to the nearest allowed cell; region puts one seed in each connected piece of the region, largest first, so every island and letter gets a colour.",
    [["scatter", "Scatter"], ["grid", "Grid"], ["ring", "Ring"], ["region", "One per region"]]),
  n("seedCount", "Seeds", "How many seeds (with 'one per region': the most regions that get one). Seed k takes colour k modulo the colour count; two seeds that land on one cell make one.", 1, 16, 1, 1, WALK_FRONT_LIMITS.maxSeeds, undefined, true),
  n("walkersPerSeed", "Walkers per seed", "Walkers each seed starts with.", 1, 4, 1, 1, WALK_FRONT_LIMITS.maxWalkersPerSeed, undefined, true),

  select("neighbourhood", "Neighbours", "Cells a walker can step to: 4 (sides) or 8 (sides and corners). Eight also lets fronts creep across diagonal pinch points and joins diagonal pieces of the region.", [["4", "4 (sides)"], ["8", "8 (with corners)"]]),
  n("persistence", "Persistence", "Chance a walker keeps its previous direction when it is free. High values make long straight runs; zero is an unbiased random walk.", 0, 0.95, 0.01, 0, 1),
  n("explore", "Explore", "Chance that a walker next to unclaimed cells steps only onto them. One is a greedy front; zero lets it wander over claimed ground even when open cells are next to it, which makes fronts advance far more slowly and raggedly. It has no effect under Avoid, where walkers never enter claimed cells anyway.", 0, 1, 0.01, 0, 1, crossing),
  select("revisit", "Revisit rule", "What a walker does when its way lies over claimed cells. Avoid: never steps onto claimed cells, so it dies when boxed in, giving thin dendrites. Own colour: may walk over its own colour, never a rival's, so territories abut and stay separate. Anything: may cross any claimed cell, so every reachable cell is eventually filled. Only unclaimed cells are ever claimed.",
    [["avoid", "Avoid claimed cells"], ["own", "Cross own colour"], ["any", "Cross anything"]]),
  n("branching", "Branching", "Chance that a walker which claims a cell spawns a child there. Each child is a new walker with its own random stream; branching stops at Maximum walkers.", 0, 0.5, 0.005, 0, 1),
  n("maxWalkers", "Maximum walkers", "Most walkers alive at once. A birth that would exceed it does not happen (nothing is hidden or thinned). The work limit is steps × maximum walkers.", 8, 400, 1, 1, WALK_FRONT_LIMITS.maxWalkers, undefined, true),
  n("patience", "Patience", "A walker dies after this many steps in a row without claiming a cell. Walkers also die when they are boxed in.", 2, 400, 1, 0, WALK_FRONT_LIMITS.maxPatience, undefined, true),

  n("colors", "Colors", "How many palette colours seeds and walkers use; colour Colors (the next palette entry) is the ink for lines, hatching and marks when they are set to ink.", 1, 8, 1, 1, WALK_FRONT_LIMITS.maxColors, undefined, true),
  select("transition", "Colour transition", "How a walker's colour changes as it claims cells. Inherit: never, so each seed owns one colour. Cycle: moves to the next palette colour, so hue drifts along branches. Random: jumps to any other colour.",
    [["inherit", "Inherit (no change)"], ["cycle", "Cycle to the next colour"], ["random", "Jump to another colour"]]),
  n("shift", "Shift chance", "Probability per claimed cell that the walker's colour changes. Small values (0.005 to 0.03) give long same-colour runs that drift gradually; large values speckle.", 0, 0.2, 0.001, 0, 1, wandering),

  n("steps", "Steps", "Rounds of the walk; in each round every live walker takes one step. Drag it to scrub through the growth: a longer walk only ever adds to a shorter one, cell for cell. The walk ends earlier when the region is full, growth is impossible or every walker has died.", 0, 2000, 10, 0, WALK_FRONT_LIMITS.maxSteps, undefined, true),
  n("coverage", "Coverage stop", "The walk stops once this fraction of the region is claimed.", 0.05, 1, 0.01, 0.001, 1),

  select("fill", "Fill", "How claimed cells are painted. Flat: each colour's territory. Age bands: the same territories cut into bands by the step each cell was claimed, tinted so the youngest band stands out. None: leave the paper for lines, hatching and marks.",
    [["flat", "Flat colour"], ["bands", "Age bands"], ["none", "None"]]),
  select("fillShape", "Fill geometry", "Merged: exact polygons per colour (or per colour and band) with holes, one shape per territory. Runs: row-by-row rectangles, exactly the cells but with a pixel-art edge and many small shapes.", [["merged", "Merged polygons"], ["runs", "Row runs"]], filled),
  n("fillAlpha", "Fill opacity", "Opacity of the fill.", 0, 1, 0.01, 0, 1, filled),
  n("bandEvery", "Age interval", "Steps per age band, and per front-age contour. Bands are anchored at step 0, so a longer walk keeps every earlier band as it was. It must make at most 64 bands.", 5, 400, 5, 1, 20000, undefined, true),
  n("bandContrast", "Band contrast", "How far the youngest band's colour moves toward white (positive) or black (negative); older bands move less, the oldest not at all.", -1, 1, 0.01, -1, 1, banded),

  select("lines", "Lines", "Paths drawn from the same walk: territory borders (each colour's boundary), front-age contours (nested boundaries of everything claimed before step k times the age interval), or both.",
    [["none", "None"], ["territory", "Territory borders"], ["contours", "Front-age contours"], ["both", "Both"]]),
  select("lineMaterial", "Line material", "Ink strokes, stitches or beads along each path.", [["ink", "Ink"], ["stitch", "Stitches"], ["beads", "Beads"]], lined),
  n("lineWeight", "Line weight", "Stroke width of the lines, or bead size.", 0, 5, 0.1, 0, 50, lined),
  n("lineSpacing", "Stitch spacing", "Distance between stitches or beads along a path.", 2, 30, 0.5, 0.5, 1000, { ...lined, ...stitched }),
  select("lineTone", "Line colour", "Ink: the palette colour after the walk's colours. Colour: territory borders and hatching take their territory's colour; contours step through the walk's colours with age.",
    [["ink", "Ink"], ["colour", "Territory / age colour"]], [{ hatch: [true] }, { lines: ["territory", "contours", "both"] }]),

  flag("hatch", "Hatching", "Draw scan lines inside each colour's territory, at a different angle for each colour."),
  n("hatchSpacing", "Hatch spacing", "Distance between hatch lines in canvas units.", 2, 20, 0.5, 0.5, 400, hatched),
  n("hatchAngle", "Hatch angle", "Angle of the first colour's lines in degrees, counter-clockwise from horizontal.", -90, 90, 1, -3600, 3600, hatched),
  n("hatchTurn", "Hatch turn", "Extra degrees added to the angle for each successive colour, so neighbouring territories are hatched differently.", 0, 90, 1, -3600, 3600, hatched),
  n("hatchWeight", "Hatch weight", "Stroke width of the hatch lines.", 0.2, 3, 0.1, 0, 50, hatched),

  flag("marks", "Marks", "Place a dot at claimed cells, coloured by owner; the claimed region acts as a mask for the marks."),
  n("markStride", "Mark spacing", "Cells between marks in each direction (1 marks every claimed cell).", 1, 8, 1, 1, 64, marked, true),
  n("markSize", "Mark size", "Diameter of the dots in canvas units.", 0.5, 10, 0.1, 0.05, 200, marked),
  n("markAging", "Mark aging", "How much smaller the newest marks are than the oldest: 0 is one size, 1 is a point at the front. Marks carry the age of their cell.", 0, 1, 0.01, 0, 1, marked),

  flag("tips", "Growth tips", "Mark the cells where live walkers stand at this step, and the seeds; useful while scrubbing steps. Nothing is drawn once the walk has ended."),
];

const controlGroups: ControlGroup[] = [
  { label: "Region", controls: ["mask", "maskSize", "ringWidth", "islands", "word", "image", "toneFrom", "toneTo",
    { label: "Barrier", controls: ["barrier", "wallPosition", "barrierWidth", "barrierGap", "enclosureSize", "pillarSpacing", "pillarRadius"] }] },
  { label: "Placement", controls: ["centerX", "centerY", { label: "Lattice", controls: ["columns", "rows"], proportional: true }, "cell"] },
  { label: "Seeds", controls: ["seedLayout", "seedCount", "walkersPerSeed"] },
  { label: "Walk", controls: ["neighbourhood", "persistence", "explore", "revisit", "branching", "maxWalkers", "patience"] },
  { label: "Color", controls: ["colors", "transition", "shift"] },
  { label: "Growth", controls: ["steps", "coverage"] },
  { label: "Fill", controls: ["fill", "fillShape", "fillAlpha", "bandEvery", "bandContrast"] },
  { label: "Lines", controls: ["lines", "lineMaterial", "lineWeight", "lineSpacing", "lineTone"] },
  { label: "Hatching", controls: ["hatch", "hatchSpacing", "hatchAngle", "hatchTurn", "hatchWeight"] },
  { label: "Marks", controls: ["marks", "markStride", "markSize", "markAging"] },
  { label: "Tips", controls: ["tips"] },
];

type Values = Record<string, number | string | boolean>;

/** Checks that follow from the stored values alone; the mask and the walk are checked where they are built. */
export function validateRandomWalkFronts(q: Values): void {
  const columns = q.columns as number, rows = q.rows as number;
  if (columns * rows > WALK_GRID_LIMITS.maxCells)
    throw new Error(`Columns × rows is ${columns * rows}; the limit is ${WALK_GRID_LIMITS.maxCells} cells. Lower Columns or Rows`);
  if (!/^[\x20-\x7e]{1,20}$/.test(q.word as string) || (q.word as string).trim().length === 0)
    throw new Error("Word must be 1 to 20 printable ASCII characters with at least one visible letter");
  if ((q.toneFrom as number) > (q.toneTo as number)) throw new Error("Tone from must not exceed Tone to");
  if ((q.seedCount as number) * (q.walkersPerSeed as number) > (q.maxWalkers as number))
    throw new Error(`Seeds × Walkers per seed is ${(q.seedCount as number) * (q.walkersPerSeed as number)}, above Maximum walkers (${q.maxWalkers}); raise Maximum walkers or lower Seeds or Walkers per seed`);
  if ((q.pillarRadius as number) * 2 >= (q.pillarSpacing as number))
    throw new Error("Pillar radius must be less than half the Pillar spacing");
  const work = (q.steps as number) * ((q.maxWalkers as number) * (Number(q.neighbourhood) + 6) + 8) + 6 * columns * rows + 4096;
  if (work > WALK_FRONT_LIMITS.maxWork)
    throw new Error(`${q.steps} steps with up to ${q.maxWalkers} walkers is ${work} work units, above the limit ${WALK_FRONT_LIMITS.maxWork}; lower Steps or Maximum walkers`);
}

export const randomWalkFrontsDefinition: InstrumentDefinition = {
  id: "random-walk-fronts",
  title: "Random Walk Fronts",
  description: "Branching patches of colour that occupy only part of the canvas. Seeded walkers claim lattice cells for their colour, branch and die on stated rules inside a chosen region (a shape, a word, an image's tone band, with barriers), and the visited region, its colours and the step each cell was claimed are drawn as territories, age bands, front-age contours, hatching or marks.",
  renderer: "2d",
  parameters: randomWalkFrontsParameters, controlGroups,
  defaults: {
    mask: "disc", maskSize: 0.9, ringWidth: 0.45, islands: 9, word: "GROW", image: "portrait", toneFrom: 0.25, toneTo: 0.75,
    barrier: "none", wallPosition: 0.5, barrierWidth: 3, barrierGap: 10, enclosureSize: 0.5, pillarSpacing: 16, pillarRadius: 3,
    centerX: 320, centerY: 320, columns: 96, rows: 96, cell: 6,
    seedLayout: "scatter", seedCount: 6, walkersPerSeed: 2,
    neighbourhood: "4", persistence: 0.3, explore: 0.8, revisit: "own", branching: 0.08, maxWalkers: 120, patience: 60,
    colors: 4, transition: "cycle", shift: 0.004, steps: 100, coverage: 1,
    fill: "bands", fillShape: "merged", fillAlpha: 1, bandEvery: 10, bandContrast: 0.35,
    lines: "contours", lineMaterial: "ink", lineWeight: 0.8, lineSpacing: 6, lineTone: "ink",
    hatch: false, hatchSpacing: 5, hatchAngle: 45, hatchTurn: 30, hatchWeight: 0.7,
    marks: false, markStride: 2, markSize: 3, markAging: 0.5,
    tips: false,
  },
  validate: validateRandomWalkFronts,
};
