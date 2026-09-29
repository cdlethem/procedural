import { MIN_PERIOD } from "../composition/patterns.js";
import type { TypeRhythmComposition } from "../composition/type-rhythm-draw.js";
import { bundledTextSources } from "../composition/type-text.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
type Scalar = number | string | boolean;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, integer = false, visibleWhen?: Condition): Parameter => {
  const parameter = numeric(key, label, description, min, max, step, { hardMin, hardMax, integer });
  return visibleWhen ? { ...parameter, visibleWhen } : parameter;
};
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter => {
  const parameter = choice(key, label, description, options);
  return visibleWhen ? { ...parameter, visibleWhen } : parameter;
};

const partition: Condition = { slicing: ["partition"] };
const anchored: Condition = { anchorSide: ["top", "bottom"] };
const lineStyles: Condition = { textStyle: ["outline", "lined"] };

const controlGroups: readonly ControlGroup[] = [
  { label: "Modules", controls: ["slicing", { label: "Divisions", controls: ["columns", "rows"], proportional: true },
    "cuts", "axis", "bias", "gutter"] },
  { label: "Placement", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }] },
  { label: "Anchor", controls: ["anchorSide", "anchorHeight"] },
  { label: "Type", controls: ["phrase", "size", "leading", "repeatGap", "rowsPerLine", "phase"] },
  { label: "Mix", controls: ["blank", "screens", "flats", "turned"] },
  { label: "Disruption", controls: ["displacement", "stretch", "zoom", "correlation", "pinned",
    { label: "Focus", controls: ["focalX", "focalY", "focalRadius"] }] },
  { label: "Ink", controls: ["textStyle", "weight"] },
  { label: "Screens", controls: ["screenPeriod", "screenAngle", "screenAngles", "screenWeight"] },
];

export const typeRhythmDefinition: InstrumentDefinition = {
  id: "typographic-rhythm", title: "Typographic Rhythm",
  description: "A phrase set huge and repeated, then seen through a grid of modules: neighbouring windows slide, stretch and turn the type, some modules become screens or flat colour or stay blank, and a small legible caption sits outside the fragments.",
  renderer: "2d",
  parameters: [
    select("slicing", "Slicing", "Grid cuts equal rows and columns; partition cuts uneven blocks by seeded binary subdivision. Either way the modules tile the area exactly.", ["grid", "partition"]),
    n("columns", "Columns", "Columns of the grid, or the resolution of the partition and of the disruption field.", 2, 16, 1, 2, 24, true),
    n("rows", "Rows", "Rows of the grid, or the resolution of the partition and of the disruption field.", 2, 16, 1, 2, 24, true),
    n("cuts", "Cuts", "Seeded partition cuts; more cuts give more, smaller blocks. Zero leaves one module.", 0, 80, 1, 0, 400, true, partition),
    select("axis", "Cut axis", "Longest splits each block across its long side; random may cut either way.", ["LONGEST", "RANDOM"], partition),
    n("bias", "Size bias", "Negative favors blocks of even area; positive favors contrasting large and small blocks.", -1, 1, .05, -1, 1, false, partition),
    n("gutter", "Gutter", "Clear space between neighbouring modules; each module is clipped this much inside its slice.", 0, 24, .5, 0, 200),
    n("centerX", "Center X", "Horizontal center of the composition in canvas units.", 80, 560, 1, -1000, 1600),
    n("centerY", "Center Y", "Vertical center of the composition in canvas units.", 80, 560, 1, -1000, 1600),
    n("width", "Width", "Width of the composition, anchor strip included.", 200, 620, 1, 16, 1000),
    n("height", "Height", "Height of the composition, anchor strip included.", 200, 620, 1, 16, 1000),
    select("anchorSide", "Anchor side", "Where the caption sits. It is set once, at one size, and never cropped or displaced; modules never cover it. None gives the whole area to modules.", ["none", "top", "bottom"]),
    n("anchorHeight", "Anchor height", "Thickness of the strip reserved for the caption; the caption is fitted inside it.", 24, 160, 1, 8, 500, false, anchored),
    select("phrase", "Phrase", "Bundled phrase: its lines are repeated across the type field and its caption becomes the anchor. Changing it never moves a module.", Object.keys(bundledTextSources)),
    n("size", "Type size", "Cap height of the type in canvas units. Larger than a module, letters are cropped to slices; smaller, whole words fit in one module.", 40, 260, 1, 8, 600),
    n("leading", "Leading", "Row pitch as a multiple of the type size.", .7, 2, .05, .5, 4),
    n("repeatGap", "Repeat gap", "Space between repeats of a line along its row, as a multiple of the type size.", 0, 2, .05, 0, 8),
    n("rowsPerLine", "Rows per line", "Rows that repeat one phrase line before the next line begins.", 1, 4, 1, 1, 8, true),
    n("phase", "Row phase", "Each row slides this many repeat periods further than the row above, staggering the letters diagonally.", -.5, .5, .01, -2, 2),
    n("blank", "Blank modules", "Share of modules left empty. Blanks cluster where the disruption field is high; zero leaves none.", 0, .6, .01, 0, 1),
    n("screens", "Screens", "Share of the remaining modules filled with a line screen from the same field, not with type.", 0, 1, .01, 0, 1),
    n("flats", "Flat colour", "Share of the remaining modules filled with one flat colour.", 0, 1, .01, 0, 1),
    n("turned", "Turned type", "Share of type modules turned a quarter turn, in the accent colour.", 0, 1, .01, 0, 1),
    n("displacement", "Displacement", "How far each module slides its view of the type, as a fraction of the module's own size. Neighbours slide alike; zero keeps the poster continuous.", 0, 1, .01, 0, 2),
    n("stretch", "Stretch", "Peak horizontal stretch or squeeze of the type in a module, in octaves (2 doubles the width).", 0, 1.2, .01, 0, 2),
    n("zoom", "Zoom", "Peak size change of the type in a module, in octaves; larger than one octave overlaps the same type many times.", 0, .8, .01, 0, 1.5),
    n("correlation", "Correlation", "Length in cells over which neighbouring modules share their displacement, stretch and blanks.", 1, 8, .25, 1, 64),
    n("pinned", "Pinned modules", "Share of modules held exactly in line with the poster, so runs of undisturbed type remain.", 0, .6, .01, 0, 1),
    n("focalX", "Focus X", "Horizontal center of the disruption in canvas units.", 80, 560, 1, -1000, 1600),
    n("focalY", "Focus Y", "Vertical center of the disruption in canvas units.", 80, 560, 1, -1000, 1600),
    n("focalRadius", "Focus radius", "Disruption is strongest at the focus and fades to none at this radius; zero disrupts everywhere.", 0, 640, 1, 0, 4096),
    select("textStyle", "Type style", "Solid fills the glyphs; outline strokes their edges; lined fills them with the module's line screen.", ["solid", "outline", "lined"]),
    n("weight", "Line weight", "Stroke width of outline and lined type.", .3, 6, .1, 0, 50, false, lineStyles),
    n("screenPeriod", "Screen period", "Distance between the field's screen lines before a module stretches it. Also the line spacing of lined type.", 12, 60, .5, 3, 400),
    n("screenAngle", "Screen angle", "Direction of the field's screen lines in degrees.", -90, 90, 1, -3600, 3600),
    select("screenAngles", "Angle variation", "Every module the same angle; crossed adds quarter turns per module; fanned adds eighth turns.", ["aligned", "crossed", "fanned"]),
    n("screenWeight", "Screen weight", "Stroke width of screen modules.", .3, 4, .1, 0, 50),
  ],
  controlGroups,
  defaults: {
    slicing: "partition", columns: 8, rows: 8, cuts: 34, axis: "LONGEST", bias: -.5, gutter: 5,
    centerX: 320, centerY: 320, width: 560, height: 560,
    anchorSide: "bottom", anchorHeight: 72,
    phrase: "rhythm", size: 130, leading: 1.1, repeatGap: .35, rowsPerLine: 1, phase: .12,
    blank: .12, screens: .14, flats: .07, turned: .14,
    displacement: .5, stretch: .7, zoom: .5, correlation: 2, pinned: .15,
    focalX: 480, focalY: 150, focalRadius: 0,
    textStyle: "solid", weight: 1.2,
    screenPeriod: 14, screenAngle: 0, screenAngles: "crossed", screenWeight: 1.6,
  },
  validate: validateTypeRhythm,
};

/** Coupled bounds that no single control can state. */
export function validateTypeRhythm(q: Record<string, Scalar>): void {
  const room = (q.height as number) - (q.anchorSide === "none" ? 0 : (q.anchorHeight as number));
  if (room < 16) throw new Error(`Modules need at least 16 units of height; the anchor strip leaves ${room}`);
  const screens = (q.screens as number) > 0 || q.textStyle === "lined";
  // The mapped screen period is at least period × 2^−(zoom + stretch).
  if (screens && (q.screenPeriod as number) < MIN_PERIOD * 2 ** ((q.zoom as number) + (q.stretch as number)))
    throw new Error(`Screen period ${q.screenPeriod} would be stretched below ${MIN_PERIOD} units at this zoom and stretch; raise the period or lower them`);
}

/** Whether the seed can change this construction. */
export function typeRhythmUsesSeed(q: Record<string, Scalar>): boolean {
  return q.slicing === "partition" && (q.cuts as number) > 0 || [q.blank, q.screens, q.flats, q.turned, q.displacement, q.stretch, q.zoom]
    .some((amount) => (amount as number) > 0);
}

/** Resolve the validated named controls to the public JSON-compatible descriptor. */
export function typeRhythmComposition(q: Record<string, Scalar>, seed: number, palette: readonly number[]): TypeRhythmComposition {
  const text = bundledTextSources[q.phrase as string];
  if (!text) throw new Error(`Unknown bundled phrase: ${String(q.phrase)}`);
  return { palette: [...palette], text,
    layout: { seed, centerX: q.centerX as number, centerY: q.centerY as number, width: q.width as number, height: q.height as number,
      anchorSide: q.anchorSide as "none" | "top" | "bottom", anchorHeight: q.anchorHeight as number,
      slicing: q.slicing as "grid" | "partition", columns: q.columns as number, rows: q.rows as number,
      cuts: q.cuts as number, axis: q.axis as "LONGEST" | "RANDOM", bias: q.bias as number, gutter: q.gutter as number,
      correlation: q.correlation as number, displacement: q.displacement as number, stretch: q.stretch as number, zoom: q.zoom as number,
      focalX: q.focalX as number, focalY: q.focalY as number, focalRadius: q.focalRadius as number,
      pinned: q.pinned as number, blank: q.blank as number, turned: q.turned as number, screens: q.screens as number,
      flats: q.flats as number, screenAngles: q.screenAngles as "aligned" | "crossed" | "fanned" },
    field: { size: q.size as number, leading: q.leading as number, gap: q.repeatGap as number,
      rowsPerLine: q.rowsPerLine as number, phase: q.phase as number },
    ink: { style: q.textStyle as "solid" | "outline" | "lined", weight: q.weight as number },
    screen: { period: q.screenPeriod as number, angle: q.screenAngle as number, weight: q.screenWeight as number } };
}
