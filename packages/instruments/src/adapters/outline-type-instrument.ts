import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { bundledOutlineTexts } from "../composition/outline-type.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
type Scalar = number | string | boolean;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, integer = false, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly (readonly [string, string])[], visibleWhen?: Condition): Parameter =>
  withCondition({ ...choice(key, label, description, options.map(([value]) => value)), options: options.map(([value, text]) => ({ value, label: text })) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter => withCondition(toggle(key, label, description), visibleWhen);

/** The fill techniques that draw lines, ring or dot geometry, by driver value. */
const lined = ["hatch", "waves", "rings", "contours", "mixed"];
const strokes = { fill: lined };
const spaced = { fill: [...lined, "dots"] };
const drawn = { fill: ["solid", ...lined, "dots", "bands"] };
const angled = { fill: ["hatch", "waves", "dots", "bands", "mixed"] };
const framed = { fill: ["hatch", "waves", "rings", "dots", "mixed"] };
const hatched = { fill: ["hatch", "mixed"] };
const waved = { fill: ["waves", "mixed"] };
const drifted = { fill: ["waves", "rings", "mixed"] };
const dotted = { fill: ["dots", "mixed"] };
const stepped = { fill: ["contours", "bands", "mixed"] };
const washed = { fill: ["bands", "mixed"] };
const stitched = { stroke: ["stitch", "beads"] };
const displaced = { displace: ["noise", "wave"] };
const outlined = { outline: ["edge", "halo", "inline", "edge-halo", "edge-inline", "halo-inline", "all"] };
const offset = { outline: ["halo", "inline", "edge-halo", "edge-inline", "halo-inline", "all"] };
const haloed = { outline: ["halo", "edge-halo", "halo-inline", "all"] };
const inlined = { outline: ["inline", "edge-inline", "halo-inline", "all"] };
const shadowed = { shadow: ["cast", "extrude"] };

const parameters: Parameter[] = [
  select("phrase", "Phrase", "Bundled text, one to two lines of capitals or mixed case, chosen for its counters. Changing it never changes how the letters are filled.",
    Object.values(bundledOutlineTexts).map((text) => [text.id, text.lines.join(" / ")] as const)),
  select("kerning", "Kerning", "Metric uses the font's own advances. Optical closes or opens each pair so the white between facing outlines matches H beside H. Monospaced centres every letter in equal cells.",
    [["metric", "Metric"], ["optical", "Optical"], ["mono", "Monospaced"]]),
  n("tracking", "Tracking", "Extra space after every letter, in cap heights; negative tightens until letters touch (near −0.06 with optical kerning, −0.15 with metric) and, with a word or larger fill unit, merge into one shape.", -0.2, 0.5, 0.01, -0.5, 4),
  n("leading", "Leading", "Distance from one baseline to the next, in cap heights.", 0.9, 2, 0.01, 0.5, 4, false, { phrase: Object.values(bundledOutlineTexts).filter((text) => text.lines.length > 1).map((text) => text.id) }),

  n("centerX", "Center X", "Horizontal center of the text block in canvas units.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical center of the text block in canvas units.", 0, 640, 1, -4096, 4096),
  n("size", "Type size", "Cap height in canvas units; every line stands on its own baseline at this size.", 40, 260, 1, 8, 1000),
  n("rotation", "Rotation", "Turns the whole block about its center, in degrees clockwise.", -45, 45, 1, -3600, 3600),

  select("unit", "Fill unit", "What one filler treats as a region: each letter, each word (touching letters become one shape), each line, or the whole block. Changes where lines break and how far outlines and shadows merge.",
    [["glyph", "Letter"], ["word", "Word"], ["line", "Line"], ["block", "Block"]]),
  select("displace", "Displacement", "Moves the outline of every unit by a smooth field before anything is filled. Noise wanders in two directions; wave ripples vertically along the line.",
    [["none", "None"], ["noise", "Noise"], ["wave", "Wave"]]),
  n("displaceAmount", "Displacement amount", "Largest move in either direction, in cap heights. Past about one sixth of the correlation length the outline folds over itself and counters can close.", 0, 0.25, 0.005, 0, 2, false, displaced),
  n("displaceLength", "Correlation length", "Distance over which the field changes, in cap heights; short lengths crinkle the outline, long ones sway whole letters together.", 0.6, 4, 0.05, 0.05, 40, false, displaced),

  select("fill", "Fill", "What goes inside every letter: nothing, solid colour, parallel hatching, wavy lines, concentric rings, contour rings following the outline inward, a dot lattice, stacked washes, or one seeded technique per unit. Counters stay empty in all of them.",
    [["none", "None"], ["solid", "Solid"], ["hatch", "Hatching"], ["waves", "Wavy lines"], ["rings", "Rings"], ["contours", "Contours"], ["dots", "Dots"], ["bands", "Washes"], ["mixed", "Mixed"]]),
  n("share", "Share filled", "Fraction of units that receive the fill; the rest keep only their outlines. Raising it only adds filled units.", 0, 1, 0.01, 0, 1, false, drawn),
  n("spacing", "Line spacing", "Distance between hatch lines, waves, rings and contour rings, and the dot lattice period, in canvas units.", 5, 24, 0.5, 3, 200, false, spaced),
  n("weight", "Line weight", "Stroke width of fill lines and ring marks in canvas units.", 0.3, 4, 0.05, 0.05, 30, false, spaced),
  n("angle", "Angle", "Direction of hatching, waves, the dot lattice and the wash bands, in degrees clockwise.", -90, 90, 1, -3600, 3600, false, angled),
  n("angleSpread", "Angle variation", "Each unit turns by up to this many degrees either way, drawn from its own id, so neighbours hatch differently.", 0, 90, 1, 0, 360, false, angled),
  flag("cross", "Cross-hatch", "Adds a second family of lines at 90° to the first.", hatched),
  select("origin", "Pattern origin", "Shared counts every unit's lines and rings from the middle of the block, so neighbours continue each other. Unit starts each from its own center.",
    [["shared", "Shared"], ["unit", "Each unit"]], framed),
  n("chirp", "Frequency drift", "How much the line frequency changes from the pattern origin to the farthest edge of each unit, as a fraction: positive tightens outward, negative opens. The slider range suits every size and spacing; typed values beyond it are refused where they would shrink the spacing below 3 units.", -0.15, 0.15, 0.005, -0.8, 0.8, false, drifted),
  n("waveAmplitude", "Wave amplitude", "Peak sideways swing of wavy lines in canvas units; 0 makes them straight.", 0, 8, 0.5, 0, 200, false, waved),
  n("waveLength", "Wavelength", "Length of one wave along its line in canvas units.", 16, 120, 1, 4, 2000, false, waved),
  select("lattice", "Lattice", "Square or staggered (hexagonal) rows of marks.", [["square", "Square"], ["hex", "Hexagonal"]], dotted),
  select("markKind", "Mark", "A filled dot, a ring or a small rosette at every lattice site that fits wholly inside the letter.", [["dot", "Dot"], ["rings", "Ring"], ["rosette", "Rosette"]], dotted),
  n("markSize", "Mark size", "Mark diameter as a share of the lattice period; near 1 the marks touch.", 0.15, 0.9, 0.01, 0.05, 1, false, dotted),
  n("ramp", "Size ramp", "Share of the mark's size lost from one side of a unit to the other, along the angle: a halftone gradient across each letter.", 0, 0.9, 0.01, 0, 0.95, false, dotted),
  n("steps", "Steps", "Number of contour rings inside each letter, or of stacked wash layers; contour rings stop early where the letter is used up.", 1, 20, 1, 1, 64, true, stepped),
  n("wash", "Wash strength", "Opacity of each wash layer; layers overlap, so the tone deepens by steps across each unit.", 0.05, 0.6, 0.01, 0.01, 1, false, washed),
  select("stroke", "Line style", "Draw fill lines as continuous ink, as running stitches, or as beads spaced along them. Stitches and beads stay inside the letter.",
    [["line", "Line"], ["stitch", "Stitch"], ["beads", "Beads"]], strokes),
  n("pitch", "Stitch pitch", "Distance between stitches or beads along a line in canvas units.", 3, 14, 0.5, 2, 100, false, stitched),
  select("colorBy", "Color by", "Ink uses one fill colour. Unit cycles the palette through the units, line through the lines of text, technique by which fill each unit got.",
    [["ink", "Ink"], ["unit", "Unit"], ["line", "Line"], ["technique", "Technique"]], drawn),

  select("outline", "Outline", "Which boundaries are stroked: the letter's edge, a halo outside it, an inline inside it, or any combination.",
    [["none", "None"], ["edge", "Edge"], ["halo", "Halo"], ["inline", "Inline"], ["edge-halo", "Edge + halo"], ["edge-inline", "Edge + inline"], ["halo-inline", "Halo + inline"], ["all", "Edge + halo + inline"]]),
  n("outlineWeight", "Outline weight", "Stroke width of edge, halo and inline in canvas units.", 0.4, 5, 0.1, 0.05, 40, false, outlined),
  n("haloDistance", "Halo distance", "How far outside the letter the halo runs, in cap heights; halos of touching letters merge and counters shrink.", 0.01, 0.2, 0.005, 0, 2, false, haloed),
  n("inlineDistance", "Inline distance", "How far inside the letter the inline runs, in cap heights; thin strokes narrower than twice this have no inline.", 0.01, 0.2, 0.005, 0, 1, false, inlined),
  select("join", "Corners", "How halos and insets turn a corner: round arcs, sharp mitred points (bevelled beyond four times the distance) or a straight chamfer.",
    [["round", "Round"], ["miter", "Mitre"], ["bevel", "Bevel"]], offset),

  select("shadow", "Shadow", "Cast is a single offset copy seen only outside the letter. Extrude sweeps the letter along the shadow vector, a solid block behind it.",
    [["none", "None"], ["cast", "Cast"], ["extrude", "Extrude"]]),
  n("shadowDistance", "Shadow distance", "Length of the shadow vector, in cap heights.", 0.02, 0.5, 0.01, 0, 3, false, shadowed),
  n("shadowAngle", "Shadow direction", "Direction the shadow falls, in degrees clockwise from the right.", -180, 180, 1, -3600, 3600, false, shadowed),
  n("shadowOpacity", "Shadow opacity", "Opacity of the shadow in the ink colour.", 0, 1, 0.01, 0, 1, false, shadowed),
];

const controlGroups: readonly ControlGroup[] = [
  { label: "Text", controls: ["phrase", "kerning", "tracking", "leading"] },
  { label: "Placement", controls: ["centerX", "centerY", "size", "rotation"] },
  { label: "Regions", controls: ["unit", "displace", { label: "Field", controls: ["displaceAmount", "displaceLength"] }] },
  { label: "Fill", controls: ["fill", "share", { label: "Lines", controls: ["spacing", "weight"], proportional: true }, "angle", "angleSpread", "cross", "origin",
    "chirp", "waveAmplitude", "waveLength", { label: "Marks", controls: ["lattice", "markKind", "markSize", "ramp"] }, "steps", "wash"] },
  { label: "Ink", controls: ["stroke", "pitch", "colorBy"] },
  { label: "Outline", controls: ["outline", "outlineWeight", { label: "Offsets", controls: ["haloDistance", "inlineDistance"], proportional: true }, "join"] },
  { label: "Shadow", controls: ["shadow", "shadowDistance", "shadowAngle", "shadowOpacity"] },
];

export const outlineTypeDefinition: InstrumentDefinition = {
  id: "outline-type", title: "Outline Type",
  description: "Set large type as regions and fill each letter with another technique, exactly clipped to its outline with the counters kept open: hatching, waves, rings, contour rings, dot lattices, washes or a different technique per letter. Outline halos, insets and shadows come from exact offsets, and a correlated field can displace the letters first.",
  renderer: "2d",
  parameters,
  controlGroups,
  defaults: {
    phrase: "bold", kerning: "optical", tracking: 0.02, leading: 1.25,
    centerX: 320, centerY: 320, size: 140, rotation: 0,
    unit: "glyph", displace: "noise", displaceAmount: 0.05, displaceLength: 0.9,
    fill: "mixed", share: 1, spacing: 6, weight: 1.5, angle: 35, angleSpread: 40, cross: false, origin: "shared", chirp: 0,
    waveAmplitude: 2.5, waveLength: 26, lattice: "hex", markKind: "dot", markSize: 0.55, ramp: 0.5, steps: 8, wash: 0.22,
    stroke: "line", pitch: 5, colorBy: "technique",
    outline: "edge-halo", outlineWeight: 1.6, haloDistance: 0.045, inlineDistance: 0.06, join: "round",
    shadow: "none", shadowDistance: 0.12, shadowAngle: 45, shadowOpacity: 0.25,
  },
};

/** Whether the seed can change this construction. */
export function outlineTypeUsesSeed(q: Record<string, Scalar>): boolean {
  if (q.displace !== "none" && (q.displaceAmount as number) > 0) return true;
  if (q.fill === "none") return false;
  return q.fill === "mixed" || (q.share as number) < 1 || (["hatch", "waves", "dots", "bands"].includes(q.fill as string) && (q.angleSpread as number) > 0);
}
