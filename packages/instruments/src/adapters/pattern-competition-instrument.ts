import { PATTERN_LIMITS } from "../composition/pattern-competition.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { numeric } from "./types.js";

type Condition = NonNullable<Parameter["visibleWhen"]>;
type Option = readonly [value: string, label: string];
const control = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition, integer = false): Parameter =>
  control(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly Option[], visibleWhen?: Condition): Parameter =>
  control({ key, label, description, type: "select", options: options.map(([value, text]) => ({ value, label: text })) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter =>
  control({ key, label, description, type: "boolean" }, visibleWhen);

const shaped: Condition = { start: ["spots", "disc", "ring"] };
const symmetric: Condition = { symmetry: ["mirror", "turn2", "quad", "turn4", "dihedral"] };
const banded: Condition = { bands: [true] };
const lined: Condition = { contours: [true] };
const marked: Condition = { marks: [true] };
const markStroke: Condition = { marks: [true], markKind: ["rings", "rosette", "arrow"] };
// The field is drawn by at least one of the three drawings; placement and start only matter then.
const drawn: Condition = [{ bands: [true] }, { contours: [true] }, { marks: [true] }];
const evolvedDrawing: Condition = [{ bands: [true] }, { contours: [true], steps: { gte: 1 } }, { marks: [true], steps: { gte: 1 } }];

const parameters: Parameter[] = [
  n("scales", "Scales", "How many activator/inhibitor scale pairs compete, finest to coarsest (the slider stops at five so that every slider corner fits the smallest grid; type more, up to eight). Each cell is updated by the scale whose activator and inhibitor differ least there, so more scales give more levels of structure inside one another.", 2, 5, 1, PATTERN_LIMITS.minScales, PATTERN_LIMITS.maxScales, undefined, true),
  n("smallest", "Smallest scale", "Activator radius of the finest scale, in grid cells (a box half-width). The inhibitor is larger; this sets the size of the smallest features.", 1, 3, 1, 1, PATTERN_LIMITS.maxSmallest, undefined, true),
  n("ratio", "Scale ratio", "How much wider each scale's activator is than the one before. Radii are whole cells, at least one apart, so a small ratio on a small finest scale spaces them by one cell. The slider stops where the coarsest inhibitor still fits the smallest grid; type larger values, up to 4.", 1.3, 1.8, 0.05, 1.05, 4),
  n("inhibitor", "Inhibitor reach", "Inhibitor radius as a multiple of the activator radius (at least one cell wider). Near 1 the scales barely differ and patterns go grainy; near 3 they form broad, separated lobes.", 1.4, 3, 0.05, 1.1, 4),
  n("increment", "Increment", "Field change per step where a scale dominates. The field is renormalised to span -1 to 1 every step, so this sets how fast patterns form, and how coarse the flips are, not the contrast.", 0.005, 0.1, 0.005, 0.0001, 0.5, evolvedDrawing),
  n("tilt", "Weight tilt", "How the increment varies across the scales: 0 gives every scale the same, positive lets the coarse scales move the field further per step (the finest scale's increment times 4^tilt is the coarsest's), negative favours the fine texture.", -2, 2, 0.1, -3, 3, evolvedDrawing),

  select("start", "Start", "The field before the first step. Noise: uniform random per cell. Spots: a few seeded bumps of random sign. Disc and ring: one centred shape. The last three can carry noise.",
    [["noise", "Noise"], ["spots", "Spots"], ["disc", "Disc"], ["ring", "Ring"]], drawn),
  n("startSize", "Start size", "Size of the seeded shapes as a fraction of half the grid width: the spot radius, disc radius or ring radius. 0 makes an empty disc, which stays constant and is reported as inert.", 0.1, 1.2, 0.01, 0, 1.5, shaped),
  n("startCount", "Spots", "Number of seeded bumps; each has its own seeded position and sign.", 1, 24, 1, 0, 64, { start: ["spots"] }, true),
  n("noise", "Start noise", "Random noise added to spots, disc or ring, relative to their height of 1. With none, a disc or ring evolves in exact symmetry.", 0, 1, 0.01, 0, 2, shaped),

  n("steps", "Steps", "Update steps to run from the start; scrub it to watch the scales compete. 0 shows the start. Raising it only continues the same run.", 0, 400, 1, 0, PATTERN_LIMITS.maxSteps, undefined, true),
  n("resolution", "Resolution", "Cells along each side of the square grid the model runs on. More cells resolve finer features and cost in proportion to their square; scales are measured in cells, so a larger grid at the same scales gives smaller features.", 48, 120, 12, PATTERN_LIMITS.minResolution, PATTERN_LIMITS.maxResolution, undefined, true),
  select("boundary", "Boundary", "What lies beyond the edge when a scale is blurred. Wrap joins opposite edges (a torus, patterns continue across the seam), mirror reflects the field, void treats the outside as zero.",
    [["wrap", "Wrap"], ["mirror", "Mirror"], ["void", "Void"]], drawn),
  select("symmetry", "Symmetry", "Constrains the field, every step, to be exactly symmetric inside each tile: a mirror, a half turn, both mirrors, quarter turns, or quarter turns with mirrors (eight-fold). The scales still compete; symmetry only forces their result to repeat.",
    [["none", "None"], ["mirror", "Mirror"], ["turn2", "Half turn"], ["quad", "Both mirrors"], ["turn4", "Quarter turns"], ["dihedral", "Eight-fold"]], drawn),
  n("tiles", "Symmetry tiles", "Squares per side that are each symmetric about their own centre. 1 makes the whole field symmetric; more give many local symmetric motifs that the scales still couple across. Must divide the grid.", 1, 4, 1, 1, 4, symmetric, true),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the field.", 100, 540, 1, -4000, 4000, drawn),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the field.", 100, 540, 1, -4000, 4000, drawn),
  n("size", "Size", "Side of the square the grid is laid over, in canvas units. It scales the drawing only; the pattern does not change.", 160, 620, 1, 1, 100000, drawn),

  flag("bands", "Scale bands", "Fill flat polygons where the field is high, one colour per dominant scale, so the coarse lobes and the fine texture inside them read as different colours."),
  n("bandLevel", "Band level", "Cells at or above this field value are filled; below it stays paper. Higher gives thinner ridges.", -0.6, 0.6, 0.01, -1, 1, banded),
  n("bandSmoothing", "Band smoothing", "Thins the stair-stepped cell boundary of each band into straighter edges, up to this many cells of deviation. Shared edges between scales stay shared.", 0, 2, 0.05, 0, 4, banded),
  n("bandMinArea", "Smallest patch", "Bands and holes smaller than this many cells are dropped.", 0, 40, 1, 0, 10000, banded),
  n("bandOpacity", "Band opacity", "Opacity of the band fill.", 0.05, 1, 0.01, 0, 1, banded),

  flag("contours", "Contours", "Trace lines where the field crosses chosen values, with a path material."),
  n("levelCount", "Levels", "Number of contour values, spread evenly around Level center.", 1, 9, 1, 1, PATTERN_LIMITS.maxLevels, lined, true),
  n("levelCenter", "Level center", "Field value at the middle of the contour levels.", -0.5, 0.5, 0.01, -0.98, 0.98, lined),
  n("levelSpread", "Level spread", "Half the range between the outermost contour values (they stay inside it by one level step). Every level must stay strictly between -1 and 1, so typed values past the slider can be refused.", 0.05, 0.5, 0.01, 0, 0.98, lined),
  n("contourMin", "Smallest contour", "Contour pieces shorter than this many cells are dropped: the specks around single cells.", 0, 20, 0.5, 0, 1000, lined),
  select("contourColor", "Contour color", "Ink (palette color 0) for all lines, the dominant scale under most of each line, or one color per level.",
    [["single", "Ink"], ["scale", "By scale"], ["level", "By level"]], lined),
  select("lineKind", "Line material", "Solid ink, tangent stitches or beads along each contour.", [["ink", "Ink"], ["stitch", "Stitch"], ["beads", "Beads"]], lined),
  n("lineWeight", "Line weight", "Stroke weight of ink or stitches.", 0.3, 4, 0.1, 0, 50, { contours: [true], lineKind: ["ink", "stitch"] }),
  n("lineSpacing", "Station spacing", "Distance along a contour between stitches or beads.", 3, 24, 0.5, 0.5, 1000, { contours: [true], lineKind: ["stitch", "beads"] }),
  n("lineBead", "Bead size", "Diameter of a bead.", 1, 12, 0.1, 0, 500, { contours: [true], lineKind: ["beads"] }),

  flag("marks", "Marks by scale", "Place a mark on the field's peaks, sized by the scale that dominates there: large marks in the coarse lobes, small marks in the fine texture."),
  select("markKind", "Mark", "The mark drawn at each site.", [["dot", "Dot"], ["rings", "Ring"], ["rosette", "Rosette"], ["arrow", "Arrow"]], marked),
  n("markSize", "Mark size", "Diameter of the mark at the coarsest scale, in canvas units; a finer scale's mark is proportional to its activator radius.", 6, 40, 0.5, 0.01, 2000, marked),
  n("markWeight", "Mark line weight", "Stroke weight of ring, rosette and arrow marks at full size.", 0.3, 3, 0.1, 0, 50, markStroke),
  n("markGap", "Mark gap", "Least distance between two marks as a multiple of the mean of their diameters; below 1 they overlap.", 0.6, 2, 0.05, 0, 20, marked),
  n("markLevel", "Mark level", "Only cells at or above this field value can carry a mark.", -0.6, 0.9, 0.01, -1, 1, marked),
  n("markPetals", "Petals", "Spokes of a rosette.", 2, 12, 1, 1, 48, { marks: [true], markKind: ["rosette"] }, true),
  n("markOpening", "Opening", "Share of the radius left empty at the center of a ring or rosette.", 0, 1, 0.01, 0, 1, { marks: [true], markKind: ["rings", "rosette"] }),
  n("markVariation", "Size variation", "Stable per-mark shrinkage; 0 makes marks of one scale equal.", 0, 1, 0.01, 0, 1, marked),
  n("markRetention", "Mark retention", "Share of sites that are drawn, chosen per site; the others leave bare paper without moving any.", 0, 1, 0.01, 0, 1, marked),
  select("markColor", "Mark color", "One color per dominant scale, or ink (palette color 0) for all.", [["scale", "By scale"], ["single", "Ink"]], marked),
  flag("markAlign", "Follow contour", "Turn each mark along the level line through its cell, so arrows and rosettes show the flow of the pattern.", { marks: [true], markKind: ["rosette", "arrow"] }),
];

const controlGroups: ControlGroup[] = [
  { label: "Scales", controls: ["scales", "smallest", "ratio", "inhibitor", { label: "Weights", controls: ["increment", "tilt"] }] },
  { label: "Start", controls: ["start", "startSize", "startCount", "noise"] },
  { label: "Evolution", controls: ["steps", "resolution", "boundary", { label: "Symmetry", controls: ["symmetry", "tiles"] }] },
  { label: "Placement", controls: ["centerX", "centerY", "size"] },
  { label: "Bands", controls: ["bands", "bandLevel", "bandSmoothing", "bandMinArea", "bandOpacity"] },
  { label: "Contours", controls: ["contours", "levelCount", "levelCenter", "levelSpread", "contourMin", "contourColor", "lineKind", "lineWeight", "lineSpacing", "lineBead"] },
  { label: "Marks", controls: ["marks", "markKind", { label: "Scale", controls: ["markSize", "markWeight"], proportional: true }, "markGap", "markLevel",
    { label: "Shape", controls: ["markPetals", "markOpening"] }, "markVariation", "markRetention", "markColor", "markAlign"] },
];

export const patternCompetitionDefinition: InstrumentDefinition = {
  id: "pattern-competition",
  title: "Pattern Competition",
  description: "Several scales of activation and inhibition compete on one grid, and the scale with the smallest disagreement updates each cell: broad lobes hold finer patterns, which hold finer ones. Flat bands by scale, contours and scale-sized marks are three drawings of the same evolving field.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    scales: 4, smallest: 3, ratio: 1.7, inhibitor: 2, increment: 0.03, tilt: -0.5,
    start: "noise", startSize: 0.5, startCount: 8, noise: 0.2,
    steps: 120, resolution: 96, boundary: "wrap", symmetry: "none", tiles: 1,
    centerX: 320, centerY: 320, size: 520,
    bands: true, bandLevel: 0, bandSmoothing: 1, bandMinArea: 4, bandOpacity: 0.85,
    contours: true, levelCount: 3, levelCenter: 0, levelSpread: 0.5, contourMin: 6, contourColor: "single", lineKind: "ink", lineWeight: 0.9, lineSpacing: 8, lineBead: 3,
    marks: false, markKind: "dot", markSize: 16, markWeight: 1, markGap: 1, markLevel: 0.3, markPetals: 6, markOpening: 0.3, markVariation: 0, markRetention: 1, markColor: "scale", markAlign: false,
  },
};
