import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { bundledPathTexts } from "../composition/type-glyphs.js";
import { bundledRecordingIds, bundledRecordingInfo } from "../composition/recording-samples.js";
import { bundledBranchTree } from "../composition/path-type-supply.js";
import { growthParams } from "../composition/branch-tree.js";
import { attractorGrowthDefinitions, validateAttractorGrowth } from "./attractor-growth.js";
import { choice, numeric } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
type Scalar = number | string | boolean;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, integer = false, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly (readonly [string, string])[], visibleWhen?: Condition): Parameter =>
  withCondition({ ...choice(key, label, description, options.map(([value]) => value)), options: options.map(([value, text]) => ({ value, label: text })) }, visibleWhen);
/** The growth study's own domain for a control the branch supply shares with it. */
function growth(key: string, visibleWhen: Condition): Parameter {
  const found = attractorGrowthDefinitions[0].parameters.find((parameter) => parameter.key === key);
  if (!found) throw new Error(`Attractor growth has no control ${key}`);
  return withCondition({ ...found, integer: key === "sourceCount" || key === "ticks" || key === "branches" }, visibleWhen);
}

const contour: Condition = { supply: ["contour"] };
const waved: Condition = { supply: ["contour"], field: ["noise", "waves"] };
const branch: Condition = { supply: ["branch"] };
const gesture: Condition = { supply: ["gesture"] };
const several: Condition = { supply: ["contour", "branch"] };
const turned: Condition = { supply: ["contour", "gesture"] };
const repeated: Condition = { repeat: ["whole", "fill"] };
const disrupted: Condition = { disruption: ["correlated"] };
const outlined: Condition = { style: ["outline"] };
const guided: Condition = { guide: ["path", "baseline"] };

const parameters: Parameter[] = [
  select("supply", "Path supply", "What the type rides: contour lines of a landscape, chains of a grown branching tree (the longest runs root to tip), or a recorded hand stroke.",
    [["contour", "Contour"], ["branch", "Branch chains"], ["gesture", "Gesture stroke"]]),
  select("field", "Landscape", "Which sampled landscape the contours are cut from.", [["noise", "Noise"], ["hills", "Hills"], ["waves", "Waves"], ["saddle", "Saddle"]], contour),
  n("frequency", "Frequency", "Wave cycles or noise scale across the landscape; higher gives more, tighter contours.", 0.5, 5, 0.05, 0, 20, false, waved),
  n("level", "First threshold", "Which bands of the landscape produce contours; sliding it moves every contour.", -1, 1, 0.05, -16, 16, false, contour),
  n("levelStep", "Threshold interval", "Distance in landscape value between successive contours; wider spacing keeps neighbouring lines of type apart.", 0.05, 0.5, 0.005, 0.001, 16, false, contour),
  n("levels", "Threshold count", "Number of contour levels; more levels give more paths to letter.", 1, 10, 1, 1, 32, true, contour),
  select("recording", "Recording", "Which bundled hand movement to follow; each seed is a slightly different take.",
    bundledRecordingIds.map((id) => [id, bundledRecordingInfo[id].title] as const), gesture),
  n("gestureSmoothing", "Hand smoothing", "Softens the hand's tremor before the type is laid on it, in milliseconds of recorded time.", 0, 200, 5, 0, 5000, false, gesture),
  growth("sourceCount", branch), growth("ticks", branch), growth("branches", branch), growth("branchSpread", branch),
  select("routing", "Branch routing", "How each branch runs between junctions: as grown, softened, straight chords, or 45° elbows.",
    [["grown", "As grown"], ["smooth", "Softened"], ["straight", "Straight"], ["octilinear", "Elbows"]], branch),
  n("pick", "Path", "Which path carries the type, longest first: 0 is the longest.", 0, 9, 1, 0, 199, true),
  n("count", "Paths lettered", "How many consecutive paths from the chosen one carry the text; fewer are lettered when the supply has fewer.", 1, 8, 1, 1, 64, true, several),
  n("smooth", "Smoothing", "Rounds of corner cutting on the path before layout. Faceted paths turn letters in jerks; 0 keeps the source polyline.", 0, 3, 1, 0, 4, true),

  n("centerX", "Center X", "Horizontal center of the supply in canvas units.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical center of the supply in canvas units.", 0, 640, 1, -4096, 4096),
  n("extent", "Size", "Width of the landscape or attractor area, or the larger side of the stroke, in canvas units.", 120, 600, 1, 8, 4000),
  n("rotation", "Rotation", "Turns the landscape or stroke about its center, in degrees.", -180, 180, 1, -3600, 3600, false, turned),

  select("phrase", "Phrase", "Bundled line of text. Changing it never moves or reshapes the path.",
    Object.values(bundledPathTexts).map((text) => [text.id, text.text] as const)),
  n("size", "Type size", "Cap height in canvas units.", 8, 60, 0.5, 4, 400),
  select("kerning", "Kerning", "Metric uses the font's own advances. Optical adjusts each pair so the white between its facing outlines matches H beside H. Monospaced centres every glyph in equal cells.",
    [["metric", "Metric"], ["optical", "Optical"], ["mono", "Monospaced"]]),
  n("tracking", "Tracking", "Extra space after every glyph, in cap heights; negative tightens.", -0.15, 1.2, 0.01, -0.3, 4),

  select("direction", "Reading direction", "Forward follows the path as drawn, reverse runs against it, upright (the default) cuts each path where it turns from running rightward to leftward and reads every piece left to right, so no arm of a U-turn or loop is upside down; each piece starts its own text.",
    [["upright", "Upright"], ["forward", "Forward"], ["reverse", "Reverse"]]),
  n("start", "Start", "Where the text begins along the path, as a fraction of its length in the reading direction; on a closed contour it wraps but never passes its own start.", 0, 1, 0.005, 0, 1),
  n("baseline", "Baseline offset", "Distance of the baseline from the path in canvas units; positive lifts the text above the path, negative hangs it below.", -60, 60, 0.5, -1000, 1000),
  select("repeat", "Repeat", "Once sets the text a single time (letters past the end are dropped). Whole phrases repeats only while a complete phrase fits. Fill repeats until the path is used up, cutting the last phrase.",
    [["once", "Once"], ["whole", "Whole phrases"], ["fill", "Fill the path"]]),
  n("gap", "Repeat gap", "Space between one repeat and the next, in cap heights.", 0, 8, 0.05, 0, 100, false, repeated),
  select("curves", "Tight curves", "What happens where neighbouring letters would overlap on the inside of a bend. Ignore leaves the overlap, skip drops the letter, compress narrows it, rotate turns it back toward its neighbour. A fold inside one letter, where the path turns back on itself, always drops it.",
    [["compress", "Compress"], ["skip", "Skip"], ["rotate", "Rotate"], ["ignore", "Ignore"]]),

  select("crowding", "Crowding", "Avoid drops a whole repeat that would overlap type already set on another path or an earlier repeat, and stops a run where it would run into itself, so crossing or crowded lines of text yield to the first one; allow sets everything.",
    [["avoid", "Avoid"], ["allow", "Allow"]]),

  n("clearance", "Clearance", "Space kept empty around type already set when crowding is avoided, in cap heights; more thins out lines that run close together.", 0, 1, 0.01, 0, 10, false, { crowding: ["avoid"] }),

  select("disruption", "Disruption", "Off keeps every letter exactly on the path. Correlated moves, tilts, resizes and omits letters by smooth noise along the path, so neighbours drift together in runs.",
    [["off", "Off"], ["correlated", "Correlated"]]),
  n("disruptLength", "Correlation length", "Distance over which neighbouring letters are disrupted alike, in cap heights.", 0.5, 12, 0.25, 0.25, 500, false, disrupted),
  n("disruptShift", "Shift", "Largest sideways move off the baseline, in cap heights.", 0, 1.5, 0.01, 0, 10, false, disrupted),
  n("disruptTilt", "Tilt", "Largest extra turn of a letter, in degrees.", 0, 60, 1, 0, 180, false, disrupted),
  n("disruptGrow", "Size drift", "Largest change of a letter's size as a fraction of its size.", 0, 0.8, 0.01, 0, 0.8, false, disrupted),
  n("disruptDropout", "Dropout", "Share of the noise range in which a letter is omitted; letters go missing in runs, and raising it never brings different ones back.", 0, 0.8, 0.01, 0, 1, false, disrupted),

  select("style", "Letter style", "Fill paints the letters solid; outline strokes their edges.", [["fill", "Fill"], ["outline", "Outline"]]),
  n("weight", "Outline weight", "Stroke width of outlined letters in canvas units.", 0.3, 4, 0.1, 0.05, 50, false, outlined),
  select("colorBy", "Color by", "Ink uses one color. Repeat, word and adapted cycle the palette by structure: which repeat, which word, or whether tight-curve handling changed the letter.",
    [["ink", "Ink"], ["repeat", "Repeat"], ["word", "Word"], ["adapted", "Adapted"]]),
  select("guide", "Guide line", "Also stroke the supplied path, or the offset baseline the letters stand on.", [["none", "None"], ["path", "Path"], ["baseline", "Baseline"]]),
  n("guideWeight", "Guide weight", "Stroke width of the guide line in canvas units.", 0.3, 4, 0.1, 0.05, 50, false, guided),
];

const controlGroups: readonly ControlGroup[] = [
  { label: "Path", controls: ["supply", "field", "frequency", "level", "levelStep", "levels", "recording", "gestureSmoothing",
    { label: "Growth", controls: ["sourceCount", "ticks", "branches", "branchSpread"] }, "routing", "pick", "count", "smooth"] },
  { label: "Placement", controls: ["centerX", "centerY", "extent", "rotation"] },
  { label: "Text", controls: ["phrase", "size", "kerning", "tracking"] },
  { label: "Layout", controls: ["direction", "start", "baseline", "repeat", "gap", "curves", "crowding", "clearance"] },
  { label: "Disruption", controls: ["disruption", "disruptLength", { label: "Amount", controls: ["disruptShift", "disruptTilt", "disruptGrow", "disruptDropout"] }] },
  { label: "Ink", controls: ["style", "weight", "colorBy", "guide", "guideWeight"] },
];

export const pathTypographyDefinition: InstrumentDefinition = {
  id: "path-typography", title: "Path Typography",
  description: "Set a line of text along contours, a branch lineage or a recorded stroke: letters keep their spacing along the path, follow its direction, and are dropped, narrowed or turned where a tight bend would make them collide, or deliberately disrupted in runs.",
  renderer: "2d",
  parameters,
  controlGroups,
  defaults: {
    supply: "contour", field: "noise", frequency: 2.2, level: -0.1, levelStep: 0.15, levels: 5, recording: "loops", gestureSmoothing: 40,
    sourceCount: 90, ticks: 34, branches: 2, branchSpread: 40, routing: "smooth", pick: 0, count: 6, smooth: 2,
    centerX: 320, centerY: 320, extent: 520, rotation: 12,
    phrase: "road", size: 17, kerning: "optical", tracking: 0.04,
    direction: "upright", start: 0, baseline: 2, repeat: "fill", gap: 1.2, curves: "compress", crowding: "avoid", clearance: 0.2,
    disruption: "off", disruptLength: 4, disruptShift: 0.25, disruptTilt: 12, disruptGrow: 0.2, disruptDropout: 0.15,
    style: "fill", weight: 1, colorBy: "ink", guide: "path", guideWeight: 0.6,
  },
  validate: validatePathTypography,
};

/** The branch supply's growth must respect the Attractor Growth domains and work budget. */
export function validatePathTypography(q: Record<string, Scalar>): void {
  if (q.supply !== "branch") return;
  validateAttractorGrowth(growthParams(bundledBranchTree({ seed: 0, centerX: q.centerX as number, centerY: q.centerY as number, extent: q.extent as number,
    attractors: q.sourceCount as number, ticks: q.ticks as number, branches: q.branches as number, spread: q.branchSpread as number,
    routing: q.routing as "grown" | "smooth" | "straight" | "octilinear" })));
}

/** Whether the seed can change this construction. */
export function pathTypographyUsesSeed(q: Record<string, Scalar>): boolean {
  return q.supply !== "contour" || q.field === "noise" || q.field === "hills" ||
    q.disruption === "correlated" && [q.disruptShift, q.disruptTilt, q.disruptGrow, q.disruptDropout].some((amount) => (amount as number) > 0);
}
