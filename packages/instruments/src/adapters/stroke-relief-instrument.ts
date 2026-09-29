import { bundledStrokeIds, bundledStrokeInfo } from "../composition/stroke-samples.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter =>
  visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["hairs", "furrows"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, options), visibleWhen);

const dryIds = ["dry-sweep", "dry-spiral", "dry-loops"];
const dryTitles: Record<string, string> = { "dry-sweep": "Dry brush · broad sweep", "dry-spiral": "Dry brush · spiral", "dry-loops": "Dry brush · loops" };
const sourceIds = [...bundledStrokeIds, ...dryIds];
const ribbons: Condition = { source: [...bundledStrokeIds] };
const dry: Condition = { source: dryIds };
const relief: Condition = { view: ["relief", "both"] };
const furrowed: Condition = { view: ["relief", "both"], section: ["furrowed"] };
const pigmented: Condition = { view: ["flat", "both"] };

const sourceSelect: Parameter = {
  ...select("source", "Stroke set", "Which bundled strokes are deposited. The ribbons are closed-form variable-width strokes; the dry brush is the existing bristle producer, each hair one narrow stroke. A new seed is a different take of the same construction.", sourceIds),
  options: sourceIds.map((value) => ({ value, label: dryTitles[value] ?? bundledStrokeInfo[value as keyof typeof bundledStrokeInfo].title })),
};

const parameters: Parameter[] = [
  sourceSelect,
  n("strokeWidth", "Stroke width", "Multiplies the width of every ribbon; loads and paths stay. Below the resolving limit (two cells) a stroke aliases.", 0.4, 2, 0.01, 0.05, 5, ribbons),
  n("brushWidth", "Brush width", "Width of the dry brush at full pressure, in canvas units.", 24, 120, 1, 4, 400, dry),
  n("hairWidth", "Hair width", "Width of each hair's stroke. Wider than the spacing between hairs, neighbouring hairs fuse into one ridged mass.", 2, 14, 0.25, 0.5, 100, dry),
  n("hairs", "Hairs", "Number of hairs across the brush; each is deposited as its own stroke.", 4, 40, 1, 1, 100, dry),
  n("dryness", "Dryness", "How much light pressure lifts hairs from the paper: gaps in the relief where the brush ran dry.", 0, 1, 0.01, 0, 1, dry),
  n("depletion", "Depletion", "Hairs run out of paint along the stroke, each at its own point, so the end frays.", 0, 1, 0.01, 0, 1, dry),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the strokes' extent.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the strokes' extent.", 0, 640, 1, -4096, 4096),
  n("scale", "Scale", "Scales the strokes' geometry and widths about their center. The height and the light stay as set.", 0.3, 2.2, 0.01, 0.01, 100),
  n("rotation", "Rotation", "Turns the strokes about their center, in degrees. The light does not turn with them.", -180, 180, 1, -3600, 3600),

  select("section", "Cross-section", "The profile across a stroke: a round dome, a flat plateau with rounded shoulders, or a plateau furrowed by the grooves of individual bristles.", ["round", "flat", "furrowed"], relief),
  n("height", "Height", "Height of a fully loaded stroke, in canvas units. It changes how steep the flanks are, so how strongly the light reads them; it never moves a stroke.", 0, 30, 0.5, 0, 200, relief),
  n("edgeRidge", "Edge ridge", "A levee of extra paint along both edges of every stroke, as a fraction of the height. Zero leaves a clean dome or plateau.", 0, 1.5, 0.01, 0, 3, relief),
  n("furrows", "Hairs across", "Bristles across a furrowed stroke: it is cut by one fewer groove.", 3, 24, 1, 2, 32, furrowed),
  n("furrowDepth", "Furrow depth", "How deeply the grooves cut. They fade in and out along the stroke as the brush runs dry.", 0, 1, 0.01, 0, 1, furrowed),
  n("loadFloor", "Light-touch height", "Height of a barely loaded stroke as a fraction of a fully loaded one.", 0, 1, 0.01, 0, 1, relief),
  n("loadCurve", "Load curve", "Exponent applied to the load: below 1 even a light load builds height, above 1 only heavy loads do.", 0.3, 3, 0.05, 0.05, 20, relief),
  n("cell", "Cell size", "Side of one height-field cell in canvas units. Smaller cells resolve thinner strokes and furrows, at a cost that grows with the square of the resolution (2 units is about 100,000 cells).", 1.5, 6, 0.05, 1.25, 16, relief),

  select("overlap", "Overlap", "How strokes combine where they cross. Add stacks paint, so a crossing is higher than either stroke. Maximum keeps the taller stroke, so a crossing is no higher than the higher one. Displace lets the later stroke replace what is under it, leaving a wall along its edge.", ["add", "max", "displace"], relief),
  select("order", "Deposition order", "Which stroke goes on top: the order they were drawn, reversed, a stable shuffle or the most heavily loaded last. The top stroke owns the pigment at every crossing and, when displacing, the height.", ["drawn", "reversed", "shuffled", "heaviest-last"]),

  n("azimuth", "Light direction", "Where the light comes from, in degrees clockwise from the top of the canvas: 0 from above, 90 from the right, -45 from the upper left. Only the shading changes, never the strokes.", -180, 180, 1, -3600, 3600, relief),
  n("elevation", "Light height", "Angle of the light above the surface in degrees. Low light rakes across the ridges and makes long shadows; overhead light darkens every slope alike.", 8, 90, 1, 1, 90, relief),
  n("contrast", "Shading depth", "How strongly slopes darken or lighten. Flat tops and the paper stay clear at any value.", 0, 4, 0.05, 0, 50, relief),
  n("gloss", "Gloss", "Strength of the sharp highlight on slopes that face the light. Zero leaves only soft light and shadow.", 0, 3, 0.05, 0, 20, relief),
  n("shininess", "Highlight tightness", "Higher values make the glossy highlight a thinner line along the ridge.", 4, 200, 1, 1, 500, relief),

  select("view", "Show", "The flat pigment ribbons alone, the relief patch alone (light and shadow only, transparent elsewhere: it can sit over any other layer) or both.", ["both", "flat", "relief"]),
  select("colorBy", "Color by", "The stroke's own color, its place in the deposition order (the stack reads as a color sequence) or one color for all. The first palette color is the shadow; the others are the pigments.", ["stroke", "deposition", "single"], pigmented),
];

const controlGroups: ControlGroup[] = [
  { label: "Strokes", controls: ["source", "strokeWidth",
    { label: "Dry brush", controls: [{ label: "Widths", controls: ["brushWidth", "hairWidth"], proportional: true }, "hairs", "dryness", "depletion"] }] },
  { label: "Placement", controls: ["centerX", "centerY", "scale", "rotation"] },
  { label: "Relief", controls: ["section", "height", "edgeRidge", { label: "Furrows", controls: ["furrows", "furrowDepth"] },
    { label: "Load", controls: ["loadFloor", "loadCurve"] }, "cell"] },
  { label: "Deposition", controls: ["overlap", "order"] },
  { label: "Light", controls: ["azimuth", "elevation", "contrast", "gloss", "shininess"] },
  { label: "Drawing", controls: ["view", "colorBy"] },
];

export const strokeReliefDefinition: InstrumentDefinition = {
  id: "stroke-relief", title: "Stroke Relief",
  description: "Deposit variable-width, pressure-loaded strokes into a height field with an explicit rule for crossings, then light it: ridges, levees and bristle furrows catch a movable light. The flat pigment layer and the transparent light-and-shadow patch are separate layers.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    source: "crossing", strokeWidth: 1, brushWidth: 72, hairWidth: 6, hairs: 14, dryness: 0.7, depletion: 0.5,
    centerX: 320, centerY: 320, scale: 1, rotation: 0,
    section: "furrowed", height: 9, edgeRidge: 0.5, furrows: 6, furrowDepth: 0.75, loadFloor: 0.25, loadCurve: 1, cell: 2,
    overlap: "displace", order: "drawn",
    azimuth: -50, elevation: 32, contrast: 1.9, gloss: 0.6, shininess: 36,
    view: "both", colorBy: "stroke",
  },
};
