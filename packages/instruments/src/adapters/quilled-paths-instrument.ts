import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import type { QuillGeometryOptions } from "../composition/quill-geometry.js";
import { validateStripOptions } from "../composition/quill-strips.js";
import type { QuillStripOptions } from "../composition/quill-strips.js";
import { choice, numeric } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
type Values = Record<string, number | string | boolean>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter =>
  visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["contourHills", "contourLevels", "arms", "nest"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, options), visibleWhen);

/** The words an instrument layer can select; the library accepts any printable word through `letterPaths`. */
export const quillWords: readonly string[] = Object.freeze(["QUILL", "CURL", "ROLL", "SWIRL", "Scroll", "paper"]);
export const quillSources: readonly string[] = Object.freeze(["contours", "letters", "spirals", "scrolls"]);

const contoured: Condition = { source: ["contours"] };
const closedSources: Condition = { source: ["contours", "letters"] };
const openSources: Condition = { source: ["contours", "spirals", "scrolls"] };
const rolled: Condition = { source: ["contours", "spirals", "scrolls"], terminals: ["start", "end", "both"] };
const tilted: Condition = { view: ["tilted"] };

const parameters: Parameter[] = [
  select("source", "Scaffold", "The paths the strips follow: a contour family, the outline rings of a word, spiral arms, or short S-shaped strips scattered by a Poisson population.", [...quillSources]),
  select("contourShape", "Contour field", "The scalar landscape whose level lines are the scaffold.", ["noise", "hills", "waves", "saddle"], contoured),
  n("contourFrequency", "Contour frequency", "Wave cycles or noise scale across the footprint; for hills and the saddle it shifts the field's phase.", 0.5, 5, 0.05, 0.05, 20, contoured),
  n("contourHills", "Hill count", "Number of seeded hills.", 1, 10, 1, 1, 24, { source: ["contours"], contourShape: ["hills"] }),
  n("contourHillRadius", "Hill radius", "Width of each hill as a fraction of the footprint. Wide hills merge into one landscape; narrow ones stay separate summits with their own rings.", 0.06, 0.3, 0.005, 0.02, 1, { source: ["contours"], contourShape: ["hills"] }),
  n("contourLevels", "Contour levels", "Number of level lines; levels above the highest crest are empty.", 1, 12, 1, 1, 24, contoured),
  n("contourLevel", "First threshold", "Field value of the first level line; shifts which part of the landscape is drawn.", -1, 1, 0.05, -16, 16, contoured),
  n("contourStep", "Threshold interval", "Field distance between successive level lines. Small steps crowd the lines together, where overlapping strips are trimmed.", 0.04, 0.4, 0.005, 0.001, 16, contoured),
  select("word", "Word", "The outline font's word whose letter outlines and counters become closed strips.", [...quillWords], { source: ["letters"] }),
  select("spiralFamily", "Spiral", "Archimedean arms keep an even gap between turns, logarithmic arms open outward, fermat arms open quickly and then even out.", ["archimedean", "logarithmic", "fermat"], { source: ["spirals"] }),
  n("arms", "Arms", "Spiral arms, evenly spread around the center.", 1, 8, 1, 1, 32, { source: ["spirals"] }),
  n("turns", "Turns", "Turns of each arm from its inner to its outer end. More turns at one size pack the strips closer, so turns beyond what the paper fits are trimmed.", 1, 8, 0.25, 0.25, 60, { source: ["spirals"] }),
  n("spiralCore", "Core size", "Inner radius of each arm as a fraction of the outer radius.", 0.04, 0.5, 0.01, 0.01, 0.95, { source: ["spirals"] }),
  n("armVariation", "Arm variation", "Stable per-arm change of the number of turns and the starting angle; a new seed changes it.", 0, 1, 0.01, 0, 1, { source: ["spirals"] }),
  n("scrollSeparation", "Scroll separation", "Least distance between the centers of neighbouring strips (Poisson disc radius).", 28, 160, 1, 4, 2000, { source: ["scrolls"] }),
  n("scrollLength", "Strip length", "Length of each strip before its ends are rolled.", 30, 220, 1, 2, 5000, { source: ["scrolls"] }),
  n("lengthVariation", "Length variation", "Stable per-strip shortening.", 0, 0.8, 0.01, 0, 1, { source: ["scrolls"] }),
  n("scrollBend", "S bend", "Sideways swing of each strip as a fraction of its length; 0 leaves it straight.", 0, 0.7, 0.01, 0, 2, { source: ["scrolls"] }),

  n("centerX", "Center X", "Horizontal canvas position of the scaffold and of the camera's pivot.", 80, 560, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical canvas position of the scaffold and of the camera's pivot.", 80, 560, 1, -4096, 4096),
  n("width", "Width", "Width of the scaffold's footprint.", 80, 600, 1, 1, 4000),
  n("height", "Height", "Height of the scaffold's footprint.", 80, 600, 1, 1, 4000),
  n("rotation", "Rotation", "Turns the scaffold about its center, in degrees.", -180, 180, 1, -3600, 3600),

  n("wallHeight", "Wall height", "How tall every strip stands, in canvas units. Tilt the camera to see the walls; the flat view shows only the tops.", 4, 90, 1, 0.1, 1000, tilted),
  n("thickness", "Paper thickness", "Width of each strip seen from above, in canvas units.", 0.8, 9, 0.1, 0.05, 200),
  n("heightVariation", "Height variation", "Stable per-path shortening of the walls; a new seed changes which paths are lower.", 0, 1, 0.01, 0, 1),
  n("clearance", "Clearance", "Least gap between two strips. A stretch of a strip closer than this to a higher-ranked one is trimmed away, so crowded paths lose their later strips first.", 0, 6, 0.1, 0, 100),
  n("resolution", "Path resolution", "Longest straight piece of a strip's centerline. Finer paths are smoother and cost proportionally more.", 2, 10, 0.25, 0.5, 100),

  n("nest", "Nest rings", "Extra strips inside (or outside) each closed path, one every strip spacing; a ring stops where the offset would cross itself, so narrow parts nest less.", 0, 8, 1, 0, 64, closedSources),
  select("nestSide", "Nest toward", "Nest toward each path's interior, its exterior or both.", ["inward", "outward", "both"], closedSources),
  n("spacing", "Strip spacing", "Distance between a closed path and its nest rings, centerline to centerline. It cannot be smaller than the paper thickness plus the clearance.", 2, 30, 0.5, 0.1, 500, closedSources),
  n("nestHeight", "Nest height step", "Each nest ring is this much taller (positive) or shorter (negative) than the ring before it, so nests read as a stair or a crater.", -0.5, 0.6, 0.01, -0.95, 4, closedSources),

  select("terminals", "Rolled ends", "Which ends of open strips roll into a spiral. Closed strips have no ends.", ["none", "start", "end", "both"], openSources),
  select("curl", "Curl direction", "The side each end rolls toward: left or right for both ends (a C scroll), opposite (an S scroll) or a stable random choice per end.", ["left", "right", "opposite", "random"], rolled),
  n("curlRadius", "Curl radius", "Outer radius of a roll where the strip leaves its path. Larger rolls make more turns.", 6, 60, 0.5, 0.1, 1000, rolled),
  n("curlGap", "Curl gap", "Gap between successive turns of a roll; turns are one paper thickness plus this apart. It cannot be smaller than the clearance.", 0, 8, 0.1, 0, 200, rolled),

  select("view", "View", "Tilted shows the walls with depth; flat is the plan view of the paper's top edge, useful without a camera.", ["tilted", "flat"]),
  n("yaw", "Camera yaw", "Turns the sculpture about the vertical axis, in degrees.", -180, 180, 1, -3600, 3600, tilted),
  n("pitch", "Camera pitch", "Tilt away from looking straight down, in degrees. Near 0 the walls are edge-on; near 85 the tops nearly vanish.", 5, 80, 1, 0, 85, tilted),
  n("zoom", "Zoom", "Scale of the whole picture about the center; line weights keep their size.", 0.5, 2, 0.01, 0.05, 20),

  select("tone", "Colour by", "Strip: one colour per scaffold path and its nests. Ring: by nest ring. Level: along the palette by contour level or arm. Height: along the palette by wall height. Single: one colour.", ["strip", "ring", "level", "height", "single"]),
  n("light", "Shading", "How strongly the walls are lit from one side; 0 paints each face its plain colour.", 0, 1, 0.01, 0, 1),
  n("lightAngle", "Light direction", "Direction the light comes from on the canvas, in degrees (0 from the right, 90 from the bottom).", -180, 180, 1, -3600, 3600, tilted),
  n("edgeWeight", "Edge line", "Width of the dark line along the top edges of the paper; 0 leaves none.", 0, 3, 0.1, 0, 20),
];

const controlGroups: ControlGroup[] = [
  { label: "Scaffold", controls: ["source",
    { label: "Contours", controls: ["contourShape", "contourFrequency", "contourHills", "contourHillRadius", "contourLevels", "contourLevel", "contourStep"] },
    "word",
    { label: "Spirals", controls: ["spiralFamily", "arms", "turns", "spiralCore", "armVariation"] },
    { label: "Scrolls", controls: ["scrollSeparation", "scrollLength", "lengthVariation", "scrollBend"] }] },
  { label: "Placement", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }, "rotation"] },
  { label: "Paper", controls: [{ label: "Size", controls: ["wallHeight", "thickness"], proportional: true }, "heightVariation", "clearance", "resolution"] },
  { label: "Nesting", controls: ["nest", "nestSide", "spacing", "nestHeight"] },
  { label: "Terminals", controls: ["terminals", "curl", { label: "Roll", controls: ["curlRadius", "curlGap"], proportional: true }] },
  { label: "View", controls: ["view", "yaw", "pitch", "zoom"] },
  { label: "Material", controls: ["tone", "light", "lightAngle", "edgeWeight"] },
];

/**
 * The strip options the stored values mean. A control the current selections hide is neutral here
 * (nesting on a source with no closed paths, rolls on letters), so hidden values can never
 * change the drawing or fail its validation.
 */
export function quillStripOptions(q: Values, seed: number): QuillStripOptions {
  const closed = q.source === "contours" || q.source === "letters", open = q.source !== "letters";
  return {
    seed, spacing: q.spacing as number, nest: closed ? q.nest as number : 0, nestSide: q.nestSide as QuillStripOptions["nestSide"],
    thickness: q.thickness as number, clearance: q.clearance as number, resolution: q.resolution as number,
    overlap: "trim", terminals: open ? q.terminals as QuillStripOptions["terminals"] : "none",
    curl: q.curl as QuillStripOptions["curl"], curlRadius: q.curlRadius as number, curlGap: q.curlGap as number,
  };
}
export const quillGeometryOptions = (q: Values): QuillGeometryOptions =>
  ({ height: q.wallHeight as number, heightVariation: q.heightVariation as number, nestHeight: closedSourceStep(q) });
const closedSourceStep = (q: Values): number => q.source === "contours" || q.source === "letters" ? q.nestHeight as number : 0;

/** Relations between stored values; the work measured from geometry is bounded where it is built. */
export function validateQuilledPaths(q: Values): void {
  validateStripOptions(quillStripOptions(q, 0));
}

export const quilledPathsDefinition: InstrumentDefinition = {
  id: "quilled-paths", title: "Quilled Paths",
  description: "Paper strips stood on edge along contour lines, letter outlines, spirals or scattered scrolls, nested inside one another and rolled at the ends, drawn with thickness and occlusion from a tilted camera or flat.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    source: "contours",
    contourShape: "noise", contourFrequency: 2.4, contourHills: 7, contourHillRadius: 0.13, contourLevels: 6, contourLevel: -0.2, contourStep: 0.12,
    word: "QUILL",
    spiralFamily: "archimedean", arms: 3, turns: 3, spiralCore: 0.12, armVariation: 0.25,
    scrollSeparation: 78, scrollLength: 130, lengthVariation: 0.3, scrollBend: 0.3,
    centerX: 320, centerY: 330, width: 470, height: 400, rotation: 0,
    wallHeight: 30, thickness: 3, heightVariation: 0.3, clearance: 1, resolution: 4,
    nest: 2, nestSide: "inward", spacing: 9, nestHeight: -0.12,
    terminals: "both", curl: "opposite", curlRadius: 22, curlGap: 1.5,
    view: "tilted", yaw: 12, pitch: 52, zoom: 1,
    tone: "strip", light: 0.65, lightAngle: -60, edgeWeight: 0.7,
  },
  validate: validateQuilledPaths,
};
