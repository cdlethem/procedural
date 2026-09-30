import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { MAX_HAIR_POINTS } from "../composition/bristle.js";
import { MAX_GRAINS } from "../composition/gesture.js";
import { bundledRecordingIds, bundledRecordingInfo } from "../composition/recording-samples.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = NonNullable<Parameter["visibleWhen"]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter =>
  visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["hairs", "echoes", "glyphPetals"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, options), visibleWhen);

const kinds = ["none", "dot", "rings", "rosette", "arrow"];
const sandKinds = ["none", "dot", "rings", "arrow"];
const drawn: Condition = { line: ["ink", "stitch"] };
const stitched: Condition = { line: ["stitch"] };
const bristled: Condition = { bristles: [true] };
const sanded: Condition = { sandMark: ["dot", "rings", "arrow"] };
const glyphed: Condition = { glyphMark: ["dot", "rings", "rosette", "arrow"] };

const recordingSelect: Parameter = {
  ...choice("recording", "Recording", "Which bundled hand movement to replay. Each has its own duration, event rate, rests and pressure (or none); the wandering hand differs for every seed.",
    [...bundledRecordingIds]),
  options: bundledRecordingIds.map((value) => ({ value, label: bundledRecordingInfo[value].title })),
};

const parameters: Parameter[] = [
  recordingSelect,
  n("smoothing", "Smoothing", "Gaussian smoothing of the replayed hand, as a standard deviation in milliseconds of recorded time. The recording itself is never changed; 0 replays the reconstruction as captured.", 0, 200, 5, 0, 5000),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the recording's extent.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the recording's extent.", 0, 640, 1, -4096, 4096),
  n("scale", "Scale", "Uniform scale of the whole gesture about its center; stroke width, spacing and marks keep their canvas sizes.", 0.3, 2.2, 0.01, 0.01, 100),
  n("rotation", "Rotation", "Turns the gesture about its center, in degrees.", -180, 180, 1, -3600, 3600),

  n("windowStart", "Window start", "Where the replay begins, as a fraction of the recording's duration. Every consumer sees the same window.", 0, 1, 0.01, 0, 0.99),
  n("windowLength", "Window length", "How much of the recording is replayed after the start, as a fraction of its duration; it stops at the end of the recording.", 0.05, 1, 0.01, 0.01, 1),

  select("sampling", "Sample by", "Distance places stations evenly along the path. Time places them at equal moments, so they crowd where the hand slowed or rested and thin out where it moved fast.", ["distance", "time"],
    [{ bristles: [true] }, { glyphMark: ["dot", "rings", "rosette", "arrow"] }, { line: ["ink", "stitch"] }]),
  n("pathSpacing", "Stroke spacing", "Distance between the vertices of the stroke, in canvas units.", 0.5, 12, 0.1, 0.2, 500, { sampling: ["distance"] }),
  n("pathInterval", "Stroke interval", "Time between the vertices of the stroke, in milliseconds. Long intervals show as corners where the hand moved fast.", 4, 120, 1, 1, 2000, { sampling: ["time"] }),

  select("pressureSource", "Pressure source", "Recorded uses the captured pressure (a recording without a pressure channel falls back to speed). Speed presses hard where the hand is slow and lightly where it is fast. Constant ignores the hand.", ["recorded", "speed", "constant"]),
  n("pressureLevel", "Constant pressure", "Pressure used for every moment.", 0, 1, 0.01, 0, 1, { pressureSource: ["constant"] }),
  n("pressureFloor", "Light-touch size", "Size factor at zero pressure, relative to full pressure. Applies to brush width, glyph size and sand release.", 0, 1, 0.01, 0, 1),
  n("pressureCurve", "Pressure curve", "Exponent applied to pressure: below 1 makes light pressure count for more, above 1 makes only hard pressure count.", 0.3, 3, 0.05, 0.05, 20),

  n("echoes", "Repeats", "Copies of the whole gesture, each moved by the steps below from the one before. Every copy has its own bristle and sand randomness.", 1, 8, 1, 1, 16),
  n("echoX", "Step X", "Horizontal offset between successive repeats, in canvas units.", -200, 200, 1, -2000, 2000, { echoes: { gte: 2 } }),
  n("echoY", "Step Y", "Vertical offset between successive repeats, in canvas units.", -200, 200, 1, -2000, 2000, { echoes: { gte: 2 } }),
  n("echoTurn", "Step turn", "Rotation between successive repeats about the gesture's center, in degrees.", -90, 90, 1, -3600, 3600, { echoes: { gte: 2 } }),

  toggle("bristles", "Bristles", "Draw the stroke as a broad brush of separate hairs."),
  n("brushWidth", "Brush width", "Width of the brush at full pressure, in canvas units.", 6, 120, 1, 0, 2000, bristled),
  n("hairWeight", "Hair weight", "Stroke width of each hair.", 0.3, 3, 0.05, 0, 50, bristled),
  n("hairs", "Hairs", "Number of hairs across the brush.", 3, 80, 1, 1, 400, bristled),
  n("dryness", "Dryness", "How much light pressure lifts hairs: 0 keeps every hair down, 1 lets only the hardest pressure keep the outer hairs on the paper.", 0, 1, 0.01, 0, 1, bristled),
  n("depletion", "Depletion", "How soon hairs run out of ink along the stroke, each at its own point: 0 never, 1 from the start to most of the way along.", 0, 1, 0.01, 0, 1, bristled),
  n("hairWander", "Hair waver", "Sideways drift of each hair as a fraction of the half width.", 0, 1, 0.01, 0, 1, bristled),

  select("line", "Line", "A single thin line through the middle of the stroke: continuous ink, stitches, or none.", ["none", "ink", "stitch"]),
  n("lineWeight", "Line weight", "Stroke width of the line or stitches.", 0.3, 6, 0.1, 0, 50, drawn),
  n("stitchSpacing", "Stitch spacing", "Distance between stitch centers along the path.", 3, 30, 0.5, 0.5, 1000, stitched),
  n("stitchPhase", "Stitch phase", "Slides the stitches along the path by a fraction of their spacing.", 0, 1, 0.01, 0, 1, stitched),

  select("sandMark", "Grain", "Mark for each grain of sand released by the hand: dots, small rings, or arrows that show the way each grain travels. None turns the sand off.", sandKinds),
  n("sandRate", "Release rate", "Grains released per second of recorded time. Because the clock is time, slow or resting parts of the gesture release more grains per unit of length.", 20, 800, 5, 0.01, 100000, sanded),
  n("sandGate", "Pressure gating", "0 releases every grain; 1 releases grains with probability equal to the pressure, so light strokes go sparse.", 0, 1, 0.01, 0, 1, sanded),
  n("sandLag", "Fall time", "Longest delay before a grain lands, in milliseconds. Each grain draws its own fraction of it; 0 puts grains on the stroke.", 0, 1500, 10, 0, 60000, sanded),
  n("sandFall", "Fall speed", "Speed at which grains fall while they are in the air, in canvas units per second.", 0, 400, 5, 0, 100000, sanded),
  n("sandFallAngle", "Fall direction", "Direction of the fall in degrees: 90 falls toward the bottom of the canvas, 0 toward the right.", -180, 180, 1, -3600, 3600, sanded),
  n("sandInherit", "Carried motion", "Share of the hand's velocity a grain keeps while it falls: 0 drops straight, 1 throws along the stroke.", 0, 1.5, 0.01, 0, 4, sanded),
  n("sandSpread", "Scatter", "Standard deviation of the random offset where each grain lands, in canvas units.", 0, 30, 0.5, 0, 5000, sanded),
  n("sandSize", "Grain size", "Diameter of each grain.", 1, 14, 0.25, 0, 500, sanded),
  n("sandWeight", "Grain line weight", "Outline width of ring and arrow grains.", 0.2, 3, 0.05, 0, 50, { sandMark: ["rings", "arrow"] }),
  n("sandVariation", "Grain size variation", "Stable random size variation.", 0, 1, 0.01, 0, 1, sanded),
  n("sandRetention", "Grain retention", "Stable omission of grains without moving the rest.", 0, 1, 0.01, 0, 1, sanded),

  select("glyphMark", "Glyph", "Mark placed along the stroke: dot, ring, rosette or arrow. None turns the glyphs off.", kinds),
  n("glyphSpacing", "Glyph spacing", "Distance between glyphs along the path, in canvas units.", 8, 120, 0.5, 1, 1000, { sampling: ["distance"], glyphMark: ["dot", "rings", "rosette", "arrow"] }),
  n("glyphInterval", "Glyph interval", "Time between glyphs, in milliseconds. They crowd where the hand slowed or rested.", 30, 600, 5, 5, 60000, { sampling: ["time"], glyphMark: ["dot", "rings", "rosette", "arrow"] }),
  n("glyphOffset", "Glyph offset", "Moves each glyph across the path; positive is to the right of the direction of travel as seen on the canvas, negative to the left. Beyond half the brush width the glyphs sit beside the stroke.", -60, 60, 0.5, -5000, 5000, glyphed),
  n("glyphFollow", "Direction follow", "0 keeps every glyph upright; 1 turns each along the direction of travel; between blends the angle.", 0, 1, 0.01, 0, 1, glyphed),
  n("glyphSizeFollow", "Pressure size", "How much each glyph's size follows the pressure: 0 uniform, 1 as much as the brush width does.", 0, 1, 0.01, 0, 1, glyphed),
  n("glyphSize", "Glyph size", "Nominal diameter of a glyph at full size.", 4, 60, 0.5, 0, 500, glyphed),
  n("glyphWeight", "Glyph line weight", "Outline width of rings, rosette petals and arrows.", 0.2, 4, 0.05, 0, 50, { glyphMark: ["rings", "rosette", "arrow"] }),
  n("glyphPetals", "Petals", "Radial strokes in each rosette.", 3, 16, 1, 1, 48, { glyphMark: ["rosette"] }),
  n("glyphOpening", "Opening", "Empty center of a rosette or inner ring offset.", 0, 0.9, 0.01, 0, 1, { glyphMark: ["rings", "rosette"] }),
  n("glyphVariation", "Glyph size variation", "Stable random size variation.", 0, 1, 0.01, 0, 1, glyphed),
  n("glyphRetention", "Glyph retention", "Stable omission of glyphs without moving the rest.", 0, 1, 0.01, 0, 1, glyphed),
];

const controlGroups: ControlGroup[] = [
  { label: "Recording", stage: "form", controls: ["recording", "smoothing"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", "scale", "rotation"] },
  { label: "Time window", stage: "process", controls: ["windowStart", "windowLength"] },
  { label: "Sampling", stage: "process", controls: ["sampling", "pathSpacing", "pathInterval"] },
  { label: "Pressure", stage: "process", controls: ["pressureSource", "pressureLevel", "pressureFloor", "pressureCurve"] },
  { label: "Repetition", stage: "process", controls: ["echoes", "echoX", "echoY", "echoTurn"] },
  { label: "Bristles", stage: "material", controls: ["bristles", { label: "Scale", controls: ["brushWidth", "hairWeight"], proportional: true },
    "hairs", "dryness", "depletion", "hairWander"] },
  { label: "Line", stage: "material", controls: ["line", "lineWeight", "stitchSpacing", "stitchPhase"] },
  { label: "Sand", stage: "material", controls: ["sandMark", { label: "Release", controls: ["sandRate", "sandGate"] },
    { label: "Fall", controls: ["sandLag", "sandFall", "sandFallAngle", "sandInherit", "sandSpread"] },
    { label: "Scale", controls: ["sandSize", "sandWeight"], proportional: true }, "sandVariation", "sandRetention"] },
  { label: "Glyphs", stage: "material", controls: ["glyphMark", { label: "Spacing", controls: ["glyphSpacing", "glyphInterval"] },
    "glyphOffset", "glyphFollow", "glyphSizeFollow", { label: "Scale", controls: ["glyphSize", "glyphWeight"], proportional: true },
    { label: "Shape", controls: ["glyphPetals", "glyphOpening"] }, "glyphVariation", "glyphRetention"] },
];

type Values = Record<string, number | string | boolean>;

/**
 * Work that follows from the stored values alone. Stroke and glyph counts by distance depend on the
 * path's length, hence on the seed for the wandering hand; those are checked when they are
 * built, with the same messages (`gesture.ts`, `recording.ts`).
 */
export function validateGestureScores(q: Values): void {
  const info = bundledRecordingInfo[q.recording as keyof typeof bundledRecordingInfo];
  const end = Math.min(1, (q.windowStart as number) + (q.windowLength as number)), seconds = info.duration * (end - (q.windowStart as number)) / 1000;
  const copies = q.echoes as number;
  if (q.sandMark !== "none") {
    const grains = Math.ceil((q.sandRate as number) * seconds) * copies;
    if (grains > MAX_GRAINS)
      throw new Error(`Sand would release ${grains} grains; the limit is ${MAX_GRAINS}. Lower the release rate, the repeats or the window`);
  }
  if (q.bristles && q.sampling === "time") {
    const points = Math.ceil(seconds * 1000 / (q.pathInterval as number) + 2) * (q.hairs as number) * copies;
    if (points > MAX_HAIR_POINTS)
      throw new Error(`Bristles would need ${points} hair points (hairs × stroke stations × repeats); the limit is ${MAX_HAIR_POINTS}. Lower the hair count, raise the interval or narrow the window`);
  }
}

export const gestureScoresDefinitions: InstrumentDefinition[] = [{
  id: "gesture-scores", title: "Gesture Scores",
  description: "Replay a recorded hand movement, with its timing and pressure, as a broad bristle brush, a lagging fall of sand and glyphs placed along the path. One time window and one smoothing reshape all three.",
  procedure: "A recorded hand movement is smoothed and replayed three ways at once. A bristle brush drags along its path, sand falls thickest where the hand slowed, and a row of arrows follows the stroke's direction.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    recording: "sweep", smoothing: 30,
    centerX: 320, centerY: 320, scale: 1, rotation: 0,
    windowStart: 0, windowLength: 1,
    sampling: "distance", pathSpacing: 2, pathInterval: 16,
    pressureSource: "recorded", pressureLevel: 0.6, pressureFloor: 0.18, pressureCurve: 1,
    echoes: 1, echoX: 24, echoY: 30, echoTurn: 4,
    bristles: true, brushWidth: 64, hairWeight: 1.3, hairs: 60, dryness: 0.75, depletion: 0.6, hairWander: 0.2,
    line: "none", lineWeight: 1.4, stitchSpacing: 9, stitchPhase: 0.35,
    sandMark: "dot", sandRate: 380, sandGate: 0.8, sandLag: 700, sandFall: 120, sandFallAngle: 90, sandInherit: 0.35, sandSpread: 5,
    sandSize: 3.4, sandWeight: 0.8, sandVariation: 0.4, sandRetention: 0.9,
    glyphMark: "arrow", glyphSpacing: 44, glyphInterval: 200, glyphOffset: 54, glyphFollow: 1, glyphSizeFollow: 0.8,
    glyphSize: 24, glyphWeight: 1.3, glyphPetals: 6, glyphOpening: 0.3, glyphVariation: 0.2, glyphRetention: 1,
  },
  validate: validateGestureScores,
}];
