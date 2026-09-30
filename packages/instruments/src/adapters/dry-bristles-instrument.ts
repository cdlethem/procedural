import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { pressureProfiles, tipShapes } from "../composition/bristle.js";
import { contourFields, traceFigures } from "../composition/bristle-sources.js";
import { bundledRecordingIds, bundledRecordingInfo } from "../composition/recording-samples.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter =>
  visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["hairs", "traceCount", "contourLevels", "tufts", "pulses"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, [...options]), visibleWhen);

const traced: Condition = { source: ["traces"] };
const contoured: Condition = { source: ["contours"] };
const scribbled: Condition = { source: ["scribble"] };
const evenPressure: Condition = { pressureProfile: ["even"] };
const pulsing: Condition = { pressureProfile: ["pulses"] };
const tapered: Condition = { tip: ["round", "pointed", "dragged"] };
const papered: Condition = { paper: [true] };
const drawn: Condition = { line: ["ink", "stitch"] };
const stitched: Condition = { line: ["stitch"] };

const recordingSelect: Parameter = {
  ...choice("recording", "Hand", "Which bundled hand movement is replayed and cut into strokes. Each has its own rhythm and reach; the seed performs it differently.", [...bundledRecordingIds]),
  options: bundledRecordingIds.map((value) => ({ value, label: bundledRecordingInfo[value].title })),
  visibleWhen: scribbled,
};

const parameters: Parameter[] = [
  select("source", "Paths", "What the brush follows: phase-shifted harmonic traces, a family of contour lines, or a hand scribble cut into strokes. The same brush, contact and line settings apply to every source.", ["traces", "contours", "scribble"]),
  select("figure", "Figure", "Frequency ratio of the two main oscillators of each trace. The seed sets their phases, so it changes the figure's shape, not just its position.", traceFigures, traced),
  n("traceCount", "Traces", "Copies of the figure, each phase-shifted from the one before.", 1, 8, 1, 1, 16, traced),
  n("traceSpread", "Trace spread", "Phase shift between neighbouring traces, in degrees. Small values give a bundle of near-parallel strokes.", 2, 60, 1, -360, 360, traced),
  select("contourField", "Field", "The landscape whose contour lines are brushed: seeded noise, hills, waves or a saddle.", contourFields, contoured),
  n("contourFrequency", "Field frequency", "Wave cycles, noise scale, saddle ripple or the scatter of the hills across the footprint.", 0.3, 5, 0.05, 0, 20, contoured),
  n("contourLevels", "Contour count", "Number of threshold slices; each yields its lines.", 1, 14, 1, 1, 24, contoured),
  n("contourInterval", "Contour interval", "Distance in field value between successive contours; wide intervals spread the lines apart.", 0.04, 0.4, 0.005, 0.001, 2, contoured),
  recordingSelect,
  n("strokeLength", "Stroke length", "Shortest stroke, in canvas units. A stroke ends at the hand's sharpest bend between this and 1.6 times this length, so long strokes are swoops and short ones are dabs.", 60, 900, 10, 20, 5000, scribbled),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the paths.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the paths.", 0, 640, 1, -4096, 4096),
  n("scale", "Scale", "Uniform scale of the whole path family about its center. Brush width and line weights keep their canvas sizes.", 0.4, 1.6, 0.01, 0.05, 8),
  n("rotation", "Rotation", "Turns the path family about its center, in degrees.", -180, 180, 1, -3600, 3600),

  n("brushShare", "Heavy share", "Share of the paths that become broad brush strokes; the rest stay fine lines. Raising it only adds strokes: the ones already brushed stay put.", 0, 1, 0.01, 0, 1),
  n("brushMinLength", "Shortest heavy path", "Paths shorter than this stay fine lines, however the share is set. Canvas units.", 0, 800, 5, 0, 100000),
  n("widthVariation", "Width variation", "How much thinner some strokes are than the nominal brush width: 0 gives every stroke the full width, 1 lets a stroke be almost a line.", 0, 1, 0.01, 0, 1),

  n("brushWidth", "Brush width", "Width of the brush at full pressure, in canvas units.", 6, 160, 1, 0, 2000),
  n("hairWeight", "Hair weight", "Stroke width of each hair.", 0.3, 3, 0.05, 0, 50),
  n("hairs", "Hairs", "Number of hairs across the brush. More hairs are a denser brush and cost proportionally more work.", 3, 120, 1, 1, 400),
  n("bias", "Center bias", "Where the hairs crowd: negative packs them at the edges (a ring of hairs with a hollow middle), positive toward the center.", -1, 1, 0.01, -1, 1),
  n("tufts", "Tufts", "Number of neighbouring groups the hairs are bundled into. Only clumping and cohesion make the groups visible.", 1, 16, 1, 1, 64),
  n("clumping", "Clumping", "How far each tuft's hairs are squeezed toward its center, opening gaps between tufts.", 0, 1, 0.01, 0, 1),
  n("cohesion", "Cohesion", "How much the hairs of a tuft share their contact, depletion and waver, so the tuft lifts and runs dry as one.", 0, 1, 0.01, 0, 1),
  select("hold", "Hold", "Path keeps the brush's edge at a fixed angle to the direction of travel. Canvas keeps one angle on the canvas, like a chisel nib: strokes along the edge go thin and strokes across it go broad.", ["path", "canvas"]),
  n("tilt", "Edge angle", "Path hold: turns the brush edge away from square to the path (staggering the hairs along it), in degrees. Canvas hold: the angle of the brush edge from horizontal, in degrees.", -80, 80, 1, -360, 360),
  n("step", "Path step", "Distance between the stations at which the brush is sampled, in canvas units. It sets the resolution of the stroke, not its ink: a larger step is cheaper and slightly more angular.", 1, 8, 0.25, 0.25, 100),

  select("pressureProfile", "Pressure", "How pressure runs along each path: even, swelling to the middle, pressed hard then lifting, or repeated presses. Broad-brush width and contact follow it.", pressureProfiles),
  n("pressureLevel", "Pressure level", "The constant pressure of an even stroke.", 0, 1, 0.01, 0, 1, evenPressure),
  n("pulses", "Presses", "Full presses along each path; each starts at its own stable phase.", 1, 10, 1, 1, 64, pulsing),
  n("pressureFloor", "Light-touch size", "Brush width at zero pressure, relative to full pressure.", 0, 1, 0.01, 0, 1),
  n("pressureCurve", "Pressure curve", "Exponent applied to pressure: below 1 makes light pressure count for more, above 1 makes only hard pressure count.", 0.3, 3, 0.05, 0.05, 20),
  select("tip", "Tip", "Shape of the brush at each end: blunt (full width at once), round (swells in and out), pointed (tapers to nothing) or dragged (blunt start, long tapering tail).", tipShapes),
  n("tipLength", "Tip length", "Distance over which the width grows from or fades to nothing at an end, in canvas units.", 0, 200, 1, 0, 5000, tapered),

  n("dryness", "Dryness", "How much light pressure lifts hairs: 0 keeps every hair down, 1 lets only the hardest pressure keep the outer hairs on the paper.", 0, 1, 0.01, 0, 1),
  n("depletion", "Depletion", "How soon hairs run out of ink along each path, each at its own point: 0 never, 1 from the start to most of the way along.", 0, 1, 0.01, 0, 1),
  n("hairWander", "Hair waver", "Sideways drift of each hair as a fraction of the half width.", 0, 1, 0.01, 0, 1),
  n("attack", "Entry", "Distance over which the hairs meet the paper at the start, each at its own point: ragged entry. Canvas units.", 0, 120, 1, 0, 5000),
  n("release", "Exit", "Distance before the end over which the hairs leave the paper, each at its own point. Canvas units.", 0, 120, 1, 0, 5000),
  toggle("paper", "Paper tooth", "Lets the paper's grain decide where light pressure reaches: hairs skip where the tooth is low. Every stroke shares the same paper, so gaps line up where strokes cross."),
  n("toothStrength", "Tooth strength", "How much the paper moves each hair's contact threshold; hard pressure fills the tooth first.", 0, 1.5, 0.01, 0, 2, papered),
  n("toothGrain", "Tooth grain", "Size of the paper's grain in canvas units.", 1, 20, 0.25, 0.5, 200, papered),

  n("hairMix", "Second pigment", "Share of hairs carrying the second palette colour, chosen by a stable per-hair draw. Raising it only recolours hairs.", 0, 1, 0.01, 0, 1),
  n("wash", "Footprint wash", "Opacity of the tint under each stroke where the brush touched; 0 draws none.", 0, 1, 0.01, 0, 1),

  select("line", "Line", "A fine line on the paths that are not brushed: continuous ink or stitches. None leaves them undrawn.", ["none", "ink", "stitch"]),
  n("lineWeight", "Line weight", "Stroke width of the line or stitches.", 0.3, 6, 0.1, 0, 50, drawn),
  n("stitchSpacing", "Stitch spacing", "Distance between stitch centers along the path.", 3, 30, 0.5, 0.5, 1000, stitched),
  n("stitchPhase", "Stitch phase", "Slides the stitches along the path by a fraction of their spacing.", 0, 1, 0.01, 0, 1, stitched),
  { ...toggle("lineOverBrush", "Trace heavy strokes", "Also draw the fine line along the brushed paths, over the hairs."), visibleWhen: drawn },
];

const controlGroups: ControlGroup[] = [
  { label: "Paths", stage: "form", controls: ["source", "figure", "traceCount", "traceSpread", "contourField", "contourFrequency", "contourLevels", "contourInterval", "recording", "strokeLength"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", "scale", "rotation"] },
  { label: "Heavy strokes", stage: "material", controls: ["brushShare", "brushMinLength", "widthVariation"] },
  { label: "Brush", stage: "material", controls: [{ label: "Scale", controls: ["brushWidth", "hairWeight"], proportional: true }, "hairs",
    { label: "Distribution", controls: ["bias", "tufts", "clumping", "cohesion"] }, { label: "Hold", controls: ["hold", "tilt"] }, "step"] },
  { label: "Pressure", stage: "process", controls: ["pressureProfile", "pressureLevel", "pulses", { label: "Light touch", controls: ["pressureFloor", "pressureCurve"] }, "tip", "tipLength"] },
  { label: "Dry contact", stage: "process", controls: ["dryness", "depletion", "hairWander", { label: "Ends", controls: ["attack", "release"] }, "paper", "toothStrength", "toothGrain"] },
  { label: "Color", stage: "color", controls: ["hairMix", "wash"] },
  { label: "Fine line", stage: "material", controls: ["line", "lineWeight", "stitchSpacing", "stitchPhase", "lineOverBrush"] },
];

const optionLabels: Record<string, Record<string, string>> = {
  source: { traces: "Harmonic traces", contours: "Contour family", scribble: "Hand scribble" },
  hold: { path: "Along the path", canvas: "Fixed on canvas" },
  pressureProfile: { even: "Even", swell: "Swell", "press-lift": "Press and lift", pulses: "Repeated presses" },
  line: { none: "None", ink: "Ink", stitch: "Stitch" },
};
const labelled = (parameter: Parameter): Parameter => {
  const labels = optionLabels[parameter.key];
  return labels ? { ...parameter, options: parameter.options!.map((option) => ({ value: option.value, label: labels[option.value] ?? option.value })) } : parameter;
};

export const dryBristlesDefinition: InstrumentDefinition = {
  id: "dry-bristles", title: "Dry Bristles",
  description: "Broad strokes of separate hairs with gaps, tapered ends and depleted ink, carried along any path: harmonic traces, a contour family or a hand scribble. A few heavy strokes sit beside fine stitched contours.",
  renderer: "2d",
  parameters: parameters.map(labelled), controlGroups,
  procedure: "Contour lines are traced through a noise field, and a brush of separate hairs is dragged along a few of them. It lays down dark ink where it presses and splits into pale, broken hairs where it lifts or runs dry, while the other contours stay as fine stitches.",
  featured: ["contourLevels", "contourFrequency", "dryness"],
  defaults: {
    source: "contours", figure: "3:2", traceCount: 3, traceSpread: 14,
    contourField: "noise", contourFrequency: 2.2, contourLevels: 9, contourInterval: 0.1, recording: "scribble", strokeLength: 320,
    centerX: 320, centerY: 320, scale: 1, rotation: 12,
    brushShare: 0.3, brushMinLength: 240, widthVariation: 0.35,
    brushWidth: 52, hairWeight: 1.1, hairs: 58, bias: 0, tufts: 7, clumping: 0.45, cohesion: 0.6, hold: "path", tilt: 0, step: 3,
    pressureProfile: "swell", pressureLevel: 0.7, pulses: 3, pressureFloor: 0.25, pressureCurve: 1, tip: "round", tipLength: 70,
    dryness: 0.8, depletion: 0.65, hairWander: 0.25, attack: 30, release: 40, paper: true, toothStrength: 0.7, toothGrain: 5,
    hairMix: 0.18, wash: 0.08,
    line: "stitch", lineWeight: 1.3, stitchSpacing: 8, stitchPhase: 0.35, lineOverBrush: false,
  },
};
