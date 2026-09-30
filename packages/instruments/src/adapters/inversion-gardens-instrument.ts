import { GLYPHS } from "../composition/inversion-sources.js";
import { parseWord } from "../composition/inversion-orbit.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric, text, toggle } from "./types.js";

type Condition = NonNullable<Parameter["visibleWhen"]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["circles", "generations", "density", "fillRings"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: [string, string][], visibleWhen?: Condition): Parameter =>
  withCondition({ ...choice(key, label, description, options.map(([value]) => value)), options: options.map(([value, name]) => ({ value, label: name })) }, visibleWhen);

const gasket: Condition = { construction: ["gasket"] }, group: Condition = { construction: ["orbit"] };
const ring: Condition = { arrangement: ["ring"] }, orthogonal: Condition = { arrangement: ["orthogonal"] };
const worded: Condition = { rule: ["word"] };
const counted: Condition = { source: ["rings", "net", "grid", "wallpaper"] }, lettered: Condition = { source: ["glyph"] };
const dashed: Condition = { stroke: ["stitch", "beads"] }, beaded: Condition = { stroke: ["beads"] };
const filled: Condition = { fill: ["flat", "rings"] }, nested: Condition = { fill: ["rings"] };
const marked: Condition = { marks: ["dot", "rings", "arrow", "rosette"] };

const parameters: Parameter[] = [
  select("construction", "Construction", "Descartes gasket: circles packed into the gaps between mutually tangent circles, each radius exact. Inversion group: a source shape reflected through a set of circles again and again, every image an exact circle or arc.",
    [["gasket", "Descartes gasket"], ["orbit", "Inversion group"]]),

  n("first", "First circle", "Radius of the first seed circle as a share of the bounding circle. It touches the bounding circle.", 0.15, 0.85, 0.01, 0.02, 0.98, gasket),
  n("second", "Second circle", "Radius of the second seed circle as a share of what the first leaves free along a diameter. 1 puts both seed circles on a diameter (the classic gasket at 0.5 / 1); less leaves a wider gap on one side.", 0.2, 1, 0.01, 0.02, 1, gasket),

  n("circles", "Circles", "How many inversion circles the group has. Each one reflects the plane through itself; the group is every sequence of them.", 2, 8, 1, 2, 8, group),
  select("arrangement", "Arrangement", "Ring: circles of a chosen size on a ring of a chosen radius. Orthogonal: circles that cross the frame circle at right angles and touch their neighbours, so every image stays inside the frame, as in a hyperbolic tiling.",
    [["ring", "Ring"], ["orthogonal", "Orthogonal to frame"]], group),
  n("ringRadius", "Ring radius", "Distance of the circle centres from the middle, as a share of the frame radius.", 0.2, 1.6, 0.01, 0, 10, ring),
  n("circleRadius", "Circle radius", "Radius of every inversion circle as a share of the frame radius. Circles that overlap still work but stop nesting.", 0.1, 1, 0.01, 0.01, 10, ring),
  n("spread", "Spread", "Size of the circles as a share of the size at which neighbours touch. 1 makes a reflection group tiling the frame; below 1 the circles separate and the images thin into a Cantor-like dust.", 0.3, 1, 0.01, 0.02, 1, orthogonal),
  n("twist", "Twist", "Turns the ring of circles about the middle, in degrees.", -90, 90, 1, -3600, 3600, group),
  n("jitter", "Jitter", "Seeded wobble of every circle's position and size, as a share of its radius. Zero keeps the symmetric arrangement.", 0, 0.5, 0.01, 0, 1, group),

  select("rule", "Words", "Every reduced word: all sequences of circles up to Generations, where no circle follows itself. Repeating word: one image per step of the word you type, cycled, so AB and BA differ.",
    [["tree", "Every reduced word"], ["word", "Repeating word"]], group),
  { ...text("word", "Word", "Circle letters in the order they are applied, such as \"AB\" or \"ABCA\": the first letter reflects the source first. No letter may follow itself, including from the end back to the start.", 16), visibleWhen: worded },
  n("generations", "Generations", "Gasket: how many rounds of circles fill the gaps. Group: how many inversions deep the images go (every word up to that length, or that many steps of the repeating word).", 1, 7, 1, 1, 12),
  n("minRadius", "Minimum radius", "Circles or image regions smaller than this many canvas units are not expanded any further. A cutoff, never a clamp.", 0.5, 8, 0.1, 0.05, 200),
  n("exclusion", "Pole clearance", "Source points that come this close to an inversion centre (as a share of that circle's radius) are removed rather than thrown to infinity.", 0.02, 0.4, 0.01, 0.001, 0.9, group),
  n("retention", "Retention", "Share of gaps (gasket) or words (group) that are kept, chosen per address by the seed. A dropped gap or word takes what lies inside it.", 0.3, 1, 0.01, 0, 1),

  select("source", "Source", "What is reflected: nested rings, a polar net, a square grid, a letter outline or a wallpaper motif (a p4g pattern of arrows over its cell grid). Every straight edge becomes an exact circular arc.",
    [["rings", "Rings"], ["net", "Polar net"], ["grid", "Grid"], ["glyph", "Letter"], ["wallpaper", "Wallpaper motif"]], group),
  n("density", "Density", "Rings, net circles, grid lines per direction, or wallpaper cells across the source diameter.", 2, 8, 1, 2, 8, counted),
  select("glyph", "Letter", "Which bundled outline is reflected. An asymmetric letter shows which images are mirrored.", GLYPHS.map((glyph) => [glyph, glyph] as [string, string]), lettered),
  n("sourceSize", "Source size", "Radius of the source as a share of the frame radius. Keep it inside the circles for a clean group; overlap makes images run into each other.", 0.05, 0.9, 0.01, 0.01, 3, group),
  n("sourceX", "Source X", "Horizontal offset of the source from the middle, as a share of the frame radius.", -0.8, 0.8, 0.01, -4, 4, group),
  n("sourceY", "Source Y", "Vertical offset of the source from the middle, as a share of the frame radius.", -0.8, 0.8, 0.01, -4, 4, group),
  n("sourceTurn", "Source turn", "Turns the source about its own centre, in degrees.", -180, 180, 1, -3600, 3600, group),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the garden.", 100, 540, 1, -4000, 4000),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the garden.", 100, 540, 1, -4000, 4000),
  n("radius", "Radius", "The bounding circle of the gasket, and the frame circle that the orthogonal arrangement crosses at right angles.", 100, 320, 1, 1, 4000),
  n("rotation", "Rotation", "Turns the whole construction about the middle, in degrees.", -90, 90, 1, -3600, 3600),
  n("clipShare", "Clip radius", "Radius of the disc every result is cut to, as a share of the frame radius. Images that leave it are cut exactly at its rim.", 0.3, 1.3, 0.01, 0.05, 4),

  select("stroke", "Line style", "Ink is a continuous stroke; stitch and beads read the same arcs as dashes or a chain.", [["ink", "Ink"], ["stitch", "Stitch"], ["beads", "Beads"]]),
  n("weight", "Line weight", "Stroke width of the circles, arcs and outlines.", 0.5, 5, 0.1, 0.1, 50),
  n("spacing", "Station spacing", "Distance between stitch centres or bead centres along each arc.", 3, 24, 0.5, 0.5, 1000, dashed),
  n("beadSize", "Bead size", "Diameter of each bead.", 2, 14, 0.5, 0.5, 200, beaded),
  n("tolerance", "Curve tolerance", "Largest distance a drawn chord may fall from the exact arc, in canvas units. Lower is smoother and costs more vertices; it never moves an arc.", 0.05, 1, 0.01, 0.005, 10),

  select("fill", "Disc fill", "Fills every bounded disc (gasket circles, or images of a source circle): a flat tone or concentric rings.", [["none", "None"], ["flat", "Flat"], ["rings", "Rings"]],
    [{ construction: ["gasket"] }, { source: ["rings", "net", "grid", "wallpaper"] }]),
  n("fillOpacity", "Fill opacity", "Strength of the fill or rings.", 0.05, 1, 0.01, 0, 1, filled),
  n("fillRings", "Rings per disc", "Concentric rings inside each disc.", 1, 8, 1, 1, 12, nested),

  select("marks", "Marks", "Places a mark at each circle's centre (gasket) or at each image of the source's anchor points (group). Arrows show orientation; a mirrored image flips it.",
    [["none", "None"], ["dot", "Dot"], ["rings", "Ring"], ["arrow", "Arrow"], ["rosette", "Rosette"]]),
  n("markSize", "Mark size", "Mark diameter as a share of the circle's diameter (gasket) or of the anchor's own extent (group); images grow and shrink with the map.", 0.1, 1.2, 0.01, 0.01, 4, marked),
  n("markWeight", "Mark weight", "Line weight of the mark in canvas units, never more than 12% of its diameter.", 0.5, 4, 0.1, 0, 50, marked),

  select("original", "Original", "The seed circles or untransformed source, drawn as any other image, as a faint outline, or not at all.", [["full", "Drawn"], ["faint", "Faint"], ["none", "Hidden"]]),
  toggle("guides", "Construction circles", "Draws the inversion circles (or the gasket's dual circles, through the tangency points) and the clip rim as faint outlines."),

  select("colorBy", "Colour by", "Generation: number of steps from the seed. Size: octave of shrinkage. Branch: which subtree or last circle. Orientation: even or odd number of inversions, so mirrored images take the second colour.",
    [["generation", "Generation"], ["size", "Size"], ["branch", "Branch"], ["parity", "Orientation"]]),
];

const controlGroups: ControlGroup[] = [
  { label: "Construction", controls: ["construction",
    { label: "Gasket", controls: ["first", "second"] },
    { label: "Inversion circles", controls: ["circles", "arrangement", { label: "Size", controls: ["ringRadius", "circleRadius"], proportional: true }, "spread", "twist", "jitter"] }] },
  { label: "Growth", controls: ["rule", "word", "generations", "minRadius", "exclusion", "retention"] },
  { label: "Source", controls: ["source", "density", "glyph", "sourceSize", "sourceX", "sourceY", "sourceTurn"] },
  { label: "Placement", controls: ["centerX", "centerY", "radius", "rotation", "clipShare"] },
  { label: "Lines", controls: ["stroke", "weight", { label: "Stations", controls: ["spacing", "beadSize"] }, "tolerance"] },
  { label: "Discs", controls: ["fill", "fillOpacity", "fillRings"] },
  { label: "Marks", controls: ["marks", "markSize", "markWeight"] },
  { label: "Reference", controls: ["original", "guides"] },
  { label: "Color", controls: ["colorBy"] },
];

type Values = Record<string, number | string | boolean>;

/** Failures that follow from the stored values alone; work limits are reported when the garden is built, naming controls. */
export function validateInversionGardens(q: Values): void {
  if (q.construction === "orbit") {
    if (q.arrangement === "orthogonal" && (q.circles as number) < 3)
      throw new Error("The orthogonal arrangement needs at least 3 Circles; choose Ring or raise Circles");
    if (q.rule === "word") parseWord(q.word as string, q.circles as number);
  }
}

/** Whether the seed can change this construction: only retention and circle jitter draw on it. */
export function inversionGardensUsesSeed(q: Values): boolean {
  return (q.retention as number) < 1 || q.construction === "orbit" && (q.jitter as number) > 0;
}

export const inversionGardensDefinition: InstrumentDefinition = {
  id: "inversion-gardens", title: "Inversion Gardens",
  description: "Circles, arcs and motifs repeated through exact circle inversion: a Descartes gasket packed with exactly measured circles, or a source shape reflected through a group of inversion circles, every straight edge becoming a true circular arc and every image keeping its correct mirroring.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    construction: "orbit",
    first: 0.5, second: 1,
    circles: 5, arrangement: "orthogonal", ringRadius: 0.8, circleRadius: 0.5, spread: 1, twist: 0, jitter: 0,
    rule: "tree", word: "ABC", generations: 5, minRadius: 0.8, exclusion: 0.1, retention: 1,
    source: "glyph", density: 4, glyph: "R", sourceSize: 0.42, sourceX: 0, sourceY: 0, sourceTurn: 0,
    centerX: 320, centerY: 320, radius: 270, rotation: 0, clipShare: 1,
    stroke: "ink", weight: 1.5, spacing: 8, beadSize: 5, tolerance: 0.2,
    fill: "none", fillOpacity: 0.35, fillRings: 3,
    marks: "none", markSize: 0.7, markWeight: 1.2,
    original: "full", guides: true,
    colorBy: "generation",
  },
  validate: validateInversionGardens,
};
