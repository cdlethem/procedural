import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = NonNullable<Parameter["visibleWhen"]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["columns", "rows", "depth", "anchors"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: [string, string][], visibleWhen?: Condition): Parameter =>
  withCondition({ ...choice(key, label, description, options.map(([value]) => value)), options: options.map(([value, name]) => ({ value, label: name })) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter =>
  withCondition(toggle(key, label, description), visibleWhen);

const gridded: Condition = { source: ["square", "triangle", "brick"] };
const penrose: Condition = { source: ["penrose"] };
const signed: Condition = { rule: ["uniform", "stripes", "radial"] };
const waved: Condition = { rule: ["stripes", "radial", "checker"] };
const phased: Condition = { rule: ["stripes", "radial"] };
const ordered: Condition = { rule: ["uniform", "stripes", "radial", "checker"] };
const axised: Condition = { hinges: ["axis"] };
const shared: Condition = { hinges: ["share"] };
const folded: Condition = { treatment: ["folded"] };
const perspective: Condition = { treatment: ["folded"], projection: ["perspective"] };
const painted: Condition = { fill: ["flat", "shaded"] };
const shaded: Condition = { treatment: ["folded"], fill: ["shaded"] };
const hatched: Condition = { hatch: [true] };
const marked: Condition = { motif: ["dot", "rings", "rosette", "arrow"] };
const stroked: Condition = { motif: ["rings", "rosette", "arrow"] };

const parameters: Parameter[] = [
  select("source", "Panel source", "The flat tiling that is folded: a square grid, a triangle grid, offset bricks (2 x 1), or Penrose rhombs. Every panel keeps its own name through folding; a shared edge is a hinge.",
    [["square", "Squares"], ["triangle", "Triangles"], ["brick", "Bricks"], ["penrose", "Penrose rhombs"]]),
  n("columns", "Columns", "Panels across: columns of squares or bricks, or of two-triangle cells. A triangle cell holds two triangles.", 2, 24, 1, 1, 200, gridded),
  n("rows", "Rows", "Panels up the sheet.", 2, 24, 1, 1, 200, gridded),
  select("patch", "Seed patch", "The Penrose patch the substitution grows from: the five-fold sun, the decagon, or a single thick or thin rhomb.",
    [["sun", "Sun"], ["decagon", "Decagon"], ["thick", "Thick"], ["thin", "Thin"]], penrose),
  n("depth", "Substitution depth", "Generations of Penrose substitution: each divides every rhomb, so panels multiply by about 2.6 per step.", 1, 5, 1, 0, 8, penrose),
  n("retention", "Panel retention", "Share of panels kept. Panels left out leave bare paper and cut the hinge graph; a piece cut loose from the anchor stays flat where it started. The same panels are omitted whatever the fold or drawing.", 0.3, 1, 0.01, 0.01, 1),

  select("rule", "Fold rule", "How each hinge's angle is decided: every hinge the same, a wave across the sheet, a wave in distance from the centre, a checkerboard of mountains and valleys, or a random angle per hinge.",
    [["uniform", "Uniform"], ["stripes", "Stripes"], ["radial", "Radial"], ["checker", "Checker mountain/valley"], ["seeded", "Seeded"]]),
  n("angle", "Fold angle", "The largest fold at any hinge, in degrees: the angle between two panels' fronts turned away from flat. Fully folded (180) would lay one panel on another, so 179 is the limit.", 0, 150, 1, 0, 179),
  select("direction", "Fold direction", "Whether the base fold is a mountain (panels dip away from the viewer either side of the hinge) or a valley (they rise).",
    [["mountain", "Mountain"], ["valley", "Valley"]], signed),
  n("period", "Period", "Length of one wave (stripes, radial) or of one checker cell, in panel edges. Two panel edges with a quarter-wave phase alternates mountain and valley every hinge row.", 0.5, 16, 0.25, 0.01, 1000, waved),
  n("stripeAngle", "Stripe direction", "The direction the stripe wave runs across the sheet, degrees from the panel's own horizontal. Hinges lying across it fold most.", -90, 90, 1, -3600, 3600, { rule: ["stripes"] }),
  n("phase", "Wave phase", "Slides the wave. At 0 a crest (the full angle) sits at the wave's origin: the sheet's lower-left corner for stripes, the centre for radial. 90 degrees puts a flat hinge there instead.", -180, 180, 1, -3600, 3600, phased),
  n("disorder", "Disorder", "Blends the rule toward a random angle per hinge: 0 keeps the rule exact, 1 replaces it with seeded chance. Structure survives low values; a new seed reshuffles the chance.", 0, 1, 0.01, 0, 1, ordered),
  n("amount", "Fold progress", "Every angle is multiplied by this: 0 is the flat sheet exactly, 1 the full fold. The same hinge graph and closure at every value.", 0, 1, 0.01, 0, 1),
  select("hinges", "Folding hinges", "Which hinges fold. The others stay rigid flat joints. All; the family whose axis runs near one direction (within 18 degrees); or a random share.",
    [["all", "All"], ["axis", "One direction"], ["share", "Random share"]]),
  n("hingeAxis", "Hinge direction", "Direction of the hinge axis chosen, in degrees from the panel's horizontal (hinges within 18 degrees of it fold).", -90, 90, 1, -3600, 3600, axised),
  n("hingeShare", "Folding share", "Chance that a hinge folds; chosen independently per hinge, so lowering it only un-folds hinges.", 0, 1, 0.01, 0, 1, shared),

  select("tree", "Closure", "A tiling has more hinges than a folded sheet can honour, so only a spanning tree folds and the rest are checked. Nearest first keeps folds close to the anchors; Strongest first honours the biggest folds and lets weaker ones open.",
    [["breadth", "Nearest first"], ["strongest", "Strongest first"]]),
  select("anchor", "Anchor panel", "The panel that stays where it started: the centre one, the one nearest a corner, or one picked by the seed.",
    [["center", "Centre"], ["corner", "Corner"], ["seeded", "Seeded"]]),
  n("anchors", "Anchored panels", "How many panels are held flat. Extra ones are spread as far apart as possible; folds between their trees rarely meet, and the mismatch shows as cracks.", 1, 6, 1, 1, 16),

  n("gap", "Gap between panels", "Each panel is drawn shrunk toward its own centre by this share, which leaves paper between panels. Hinge lines keep their true place.", 0, 0.5, 0.01, 0, 0.9),
  n("thickness", "Thickness", "Panels become slabs this deep behind their front, in panel edges: sides and backs are then drawn, and slabs hide what is behind them.", 0, 0.5, 0.01, 0, 4, folded),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the sheet.", 80, 560, 1, -100000, 100000),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the sheet.", 80, 560, 1, -100000, 100000),
  n("size", "Sheet size", "Canvas length of the diagonal chosen by Scale to. Scaling to the flat sheet keeps one scale while it folds, so the fold shrinks.", 100, 620, 1, 1, 100000),
  select("fit", "Scale to", "What Sheet size measures: the flat sheet's diagonal, so the folded form shrinks as it folds and Fold progress scrubs at one scale; or the folded form's own bounding diagonal, so any fold fills the same room.",
    [["sheet", "Flat sheet"], ["form", "Folded form"]], folded),
  n("roll", "Rotation", "Turns the picture about its centre, clockwise in degrees.", -180, 180, 1, -3600, 3600),

  select("projection", "Projection", "Orthographic keeps parallel edges parallel; perspective foreshortens with distance.", [["orthographic", "Orthographic"], ["perspective", "Perspective"]], folded),
  n("yaw", "Yaw", "Turns the view about the vertical axis, degrees. Positive swings the eye toward the sheet's right.", -180, 180, 1, -3600, 3600, folded),
  n("pitch", "Pitch", "Raises the eye above the sheet, degrees: 0 sees it edge-on, 90 looks straight down at the flat pattern.", -90, 90, 1, -90, 90, folded),
  n("perspective", "Perspective strength", "Eye distance in sheet diagonals; smaller is stronger foreshortening.", 1.2, 8, 0.1, 0.5, 100, perspective),

  select("treatment", "Treatment", "Folded draws the posed sheet through the camera; crease pattern draws the same panels and hinges flat, with mountains, valleys and cracks marked, as a layer of its own.",
    [["folded", "Folded"], ["crease", "Crease pattern"]]),
  select("fill", "Panel fill", "None leaves only lines; flat paints each panel one colour; shaded lights it from a fixed direction so folds read as form.",
    [["none", "None"], ["flat", "Flat"], ["shaded", "Shaded"]]),
  select("colorBy", "Color by", "What picks a panel's palette entry: its tile class, its distance from the anchor along the hinges, whether its own fold is a mountain or valley, its tilt from flat, its height, one panel at a time by name, or one accent.",
    [["class", "Tile class"], ["depth", "Hinge depth"], ["fold", "Mountain / valley"], ["tilt", "Tilt"], ["height", "Height"], ["panel", "Panel name"], ["single", "One accent"]], { fill: ["flat", "shaded"] }),
  n("opacity", "Fill opacity", "Paint strength of panel fills.", 0, 1, 0.01, 0, 1, painted),
  n("shade", "Shading", "How much the light changes a panel's colour: 0 is flat colour, 1 is from dark to lit.", 0, 1, 0.01, 0, 1, shaded),
  n("lightAzimuth", "Light direction", "Where the light comes from around the vertical axis, degrees; fixed in the world, so moving the camera does not move it.", -180, 180, 1, -3600, 3600, shaded),
  n("lightElevation", "Light height", "How high the light is above the horizon, degrees.", 5, 90, 1, 0, 90, shaded),
  flag("hatch", "Hatching", "Draw hatch lines in every panel's own flat coordinates, then fold them with the panel: the lines continue across neighbouring panels in the flat sheet and foreshorten where it folds."),
  n("hatchAngle", "Hatch angle", "Direction of the hatch lines in the flat sheet, degrees from the panel's horizontal.", -90, 90, 1, -3600, 3600, hatched),
  n("hatchSpacing", "Hatch spacing", "Distance between hatch lines in panel edges.", 0.06, 0.6, 0.01, 0.02, 10, hatched),
  n("hatchWeight", "Hatch weight", "Line thickness of hatching on the canvas.", 0.2, 2, 0.05, 0, 50, hatched),

  select("lines", "Lines", "Which edges are inked: folds (mountain solid, valley dashed), every hinge including the flat ones, or hinges plus the sheet's outline. Hidden lengths follow the hidden-line choice.",
    [["none", "None"], ["folds", "Folds"], ["hinges", "All hinges"], ["panels", "Hinges and outline"]]),
  n("lineWeight", "Line weight", "Line thickness of inked hinges and outline.", 0.2, 4, 0.05, 0, 50),
  select("hidden", "Hidden lines", "Lengths of a line behind a panel: dropped, or kept as faint lines.", [["drop", "Drop"], ["faint", "Faint"]], folded),
  flag("open", "Mark cracks", "Draw the two sides of every hinge the fold could not honour in the accent colour. They are the conflicts of the tiling, where panels no longer meet."),

  select("motif", "Panel motif", "One mark on every panel, mapped onto it: it turns and foreshortens with the panel and reads mirrored from behind. Hidden panels lose theirs.",
    [["none", "None"], ["dot", "Dot"], ["rings", "Rings"], ["rosette", "Rosette"], ["arrow", "Arrow"]]),
  n("motifSize", "Motif size", "Diameter of the mark in panel edges.", 0.1, 1.2, 0.01, 0, 5, marked),
  n("motifWeight", "Motif line weight", "Thickness of motif strokes on the canvas.", 0.2, 3, 0.05, 0, 50, stroked),
  n("motifTurn", "Motif turn", "Rotation of the mark inside its panel, degrees from the panel's horizontal.", -180, 180, 1, -3600, 3600, marked),
  n("motifVariation", "Size variation", "Stable random shrinkage of individual motifs by panel name; a new seed reshuffles it.", 0, 1, 0.01, 0, 1, marked),
];

const controlGroups: ControlGroup[] = [
  { label: "Panels", stage: "form", controls: ["source", { label: "Grid", controls: ["columns", "rows"], proportional: true }, "patch", "depth", "retention"] },
  { label: "Fold", stage: "process", controls: ["rule", "angle", "direction", "period", "stripeAngle", "phase", "disorder", "amount", "hinges", "hingeAxis", "hingeShare"] },
  { label: "Closure", stage: "process", controls: ["tree", "anchor", "anchors"] },
  { label: "Body", stage: "form", controls: ["gap", "thickness"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", "size", "fit", "roll"] },
  { label: "View", stage: "frame", controls: ["projection", "yaw", "pitch", "perspective"] },
  { label: "Drawing", stage: "material", controls: ["treatment", "fill", "colorBy", "opacity", { label: "Light", controls: ["shade", "lightAzimuth", "lightElevation"] },
    { label: "Hatch", controls: ["hatch", "hatchAngle", "hatchSpacing", "hatchWeight"] }] },
  { label: "Lines", stage: "material", controls: ["lines", "lineWeight", "hidden", "open"] },
  { label: "Motif", stage: "material", controls: ["motif", "motifSize", "motifWeight", "motifTurn", "motifVariation"] },
];

type Values = Record<string, number | string | boolean>;

/** The stored values alone decide these; geometry-dependent limits are checked when the tiling is built, with controls named. */
export function validateHingedPanels(q: Values): void {
  const angle = q.angle as number, amount = q.amount as number;
  if (angle * amount > 179) throw new Error(`Fold angle ${angle} x Fold progress ${amount} exceeds 179 degrees: lower Fold angle`);
  if (q.source !== "penrose" && Number.isInteger(q.columns) && Number.isInteger(q.rows)) {
    const count = (q.columns as number) * (q.rows as number) * (q.source === "triangle" ? 2 : 1);
    if (count > 4000) throw new Error(`${q.columns} x ${q.rows} ${q.source} panels is ${count}; the limit is 4000. Reduce Columns and Rows`);
  }
}

export const hingedPanelsDefinition: InstrumentDefinition = {
  id: "hinged-panels", title: "Hinged Panels",
  description: "A flat tiling of panels folds along its shared edges into spatial fragments: every hinge has an editable fold angle, panels move as rigid bodies from an anchored panel, conflicts the tiling cannot close are reported, and the flat crease pattern is a layer of its own.",
  procedure: "A sheet of square panels is joined by hinges, each hinge folded to its own angle out from one anchored panel. The rigid sheet curls into a dome with strips hanging loose, and each panel is lit and inked along its folds.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    source: "square", columns: 12, rows: 12, patch: "sun", depth: 3, retention: 1,
    rule: "uniform", angle: 38, direction: "mountain", period: 2, stripeAngle: 90, phase: 0, disorder: 0.45, amount: 1, hinges: "all", hingeAxis: 0, hingeShare: 0.6,
    tree: "breadth", anchor: "center", anchors: 1,
    gap: 0, thickness: 0,
    centerX: 320, centerY: 330, size: 500, fit: "form", roll: 0,
    projection: "perspective", yaw: 28, pitch: 38, perspective: 3,
    treatment: "folded", fill: "shaded", colorBy: "depth", opacity: 1, shade: 0.7, lightAzimuth: -50, lightElevation: 55,
    hatch: false, hatchAngle: 45, hatchSpacing: 0.18, hatchWeight: 0.7,
    lines: "hinges", lineWeight: 1.1, hidden: "drop", open: false,
    motif: "none", motifSize: 0.5, motifWeight: 1, motifTurn: 0, motifVariation: 0.2,
  },
  validate: validateHingedPanels,
};
