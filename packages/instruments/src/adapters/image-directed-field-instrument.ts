import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { FIELD_LIMITS } from "../composition/image-field.js";
import { bundledRasterIds, bundledRasterInfo } from "../composition/raster-samples.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const integerKeys = new Set(["imageVariant", "resolution", "beadPetals", "markPetals"]);
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter =>
  visibleWhen ? { ...parameter, visibleWhen } : parameter;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, options), visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter =>
  withCondition(toggle(key, label, description), visibleWhen);

const pointMarks = ["dot", "rings", "rosette", "arrow"];
const lined: Condition = { lines: [true] };
const ambient: Condition = { mode: ["blend"] };
const masked: Condition = { maskTones: [true] };
const strokeMaterial: Condition = { lines: [true], material: ["ink", "stitch"] };
const stationed: Condition = { lines: [true], material: ["stitch", "beads"] };
const beaded: Condition = { lines: [true], material: ["beads"] };
const marked: Condition = { mark: pointMarks };

const imageSelect: Parameter = {
  ...choice("image", "Source image", "Which bundled sample picture the field is read from. The lines and marks follow its edges and textures; a host can supply its own picture through the typed API.", [...bundledRasterIds]),
  options: bundledRasterIds.map((value) => ({ value, label: bundledRasterInfo[value].title })),
};

const parameters: Parameter[] = [
  imageSelect,
  n("imageVariant", "Image arrangement", "Which arrangement of the chosen sample picture (it moves and re-tints the parts). Independent of the seed: changing it replaces the subject, changing the seed only re-rolls the strokes.", 0, 99, 1, 0, 100000),
  n("resolution", "Image resolution", "Pixels on each side of the analysed picture. More pixels follow finer detail and cost more to analyse; the coherence scale stays in canvas units.", 48, 256, 8, 16, 512),
  select("channel", "Read structure from", "Which property of the picture carries the structure: lightness (equal perceptual steps), luminance (linear light) or saturation (finds colour edges that lightness misses).", ["lightness", "luminance", "saturation"]),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the picture.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the picture.", 0, 640, 1, -4096, 4096),
  n("width", "Width", "Width of the picture on the canvas. Width and height are independent, so a stretched picture gives a stretched field.", 120, 640, 1, 8, 2000),
  n("height", "Height", "Height of the picture on the canvas.", 120, 640, 1, 8, 2000),
  n("rotation", "Rotation", "Turns the picture, its field and everything drawn from it about its center, in degrees clockwise.", -180, 180, 1, -3600, 3600),

  select("mode", "Direction", "Follow runs along edges and contours. Resist runs across them. Blend follows the picture where its structure is coherent and an ambient direction where it is not.", ["follow", "resist", "blend"]),
  select("ambientKind", "Ambient field", "The direction that fills unstructured areas: one constant angle, a swirl around the picture's center, or rays from it.", ["angle", "swirl", "radial"], ambient),
  n("ambientAngle", "Ambient angle", "Angle of the ambient direction in degrees (0 is horizontal). For a swirl or rays it turns the pattern, so a swirl becomes a spiral.", -90, 90, 1, -3600, 3600, ambient),
  n("ambientWeight", "Ambient strength", "How strongly the ambient direction fills areas the picture leaves undefined. 0 leaves them empty; 1 fills them completely and lets it compete with strong edges at half strength.", 0, 1, 0.01, 0, 1, ambient),
  n("smoothing", "Coherence scale", "Size of the neighbourhood over which edge direction is averaged, in canvas units. Small values follow every fine edge and texture; large values give broad, calm flow.", 0, 40, 0.5, 0, 300),
  n("minConfidence", "Confidence threshold", "How coherent the local structure must be for a line or mark to exist. Lines stop where it falls below this; flat areas never draw at any setting.", 0, 1, 0.01, 0, 1),
  flag("maskTones", "Limit to tones", "Draw only where the picture's tone lies inside a window: for instance only its darks, as hair."),
  n("maskMin", "Darkest tone", "Lowest tone drawn, 0 black to 1 white.", 0, 1, 0.01, 0, 1, masked),
  n("maskMax", "Lightest tone", "Highest tone drawn.", 0, 1, 0.01, 0, 1, masked),

  flag("lines", "Streamlines", "Trace evenly spaced lines through the field."),
  n("separation", "Line separation", "Distance between neighbouring lines in canvas units. Small values give dense, hair-like fields.", 3, 40, 0.5, 0.5, 400, lined),
  n("stopFraction", "Crowding stop", "A line ends when it comes closer than this fraction of the separation to another. Near 1 gives even, shorter lines; lower lets lines crowd and run longer.", 0.3, 0.95, 0.01, 0.05, 1, lined),
  n("startSpacing", "Start spacing", "Spacing of the grid of starting points, in canvas units. Lines start here first; with fill off, this alone sets how many lines there are.", 8, 120, 1, 0.5, 2000, lined),
  n("startJitter", "Start scatter", "How far each start is displaced from its grid cell centre, as a fraction of the cell. The seed decides the displacement and the order the starts are tried in.", 0, 1, 0.01, 0, 1, lined),
  flag("fill", "Fill gaps", "After the starts, keep adding lines wherever there is room at the separation, so the field is evenly covered.", lined),
  n("minLength", "Shortest line", "Lines shorter than this are removed together with the room they took, in canvas units.", 0, 200, 1, 0, 100000, lined),
  n("maxLength", "Longest line", "A line ends at this length, both directions together, in canvas units.", 20, 1200, 5, 0.5, 100000, lined),
  n("minRadius", "Tightest turn", "Lines end where they turn more tightly than this radius, in canvas units. 0 lets lines curl freely.", 0, 80, 1, 0, 100000, lined),
  flag("clip", "Clip to image", "On, lines stop at the picture's border. Off, they run on past it (up to the longest length) through the border's own direction.", lined),

  select("material", "Line material", "Draw every line as continuous ink, stitches along its tangent, or beads.", ["ink", "stitch", "beads"], lined),
  n("weight", "Line weight", "Stroke width of ink or stitches.", 0.2, 5, 0.05, 0, 50, strokeMaterial),
  n("toneWeight", "Tone weight", "Thins lines toward the light parts of the picture: 0 keeps one weight, 1 makes the lightest lines vanish. Bead size follows.", 0, 1, 0.01, 0, 1, lined),
  n("spacing", "Station spacing", "Distance between stitch or bead centers along a line.", 3, 30, 0.5, 0.5, 1000, stationed),
  n("phase", "Station phase", "Slides stations along each line by a fraction of their spacing.", 0, 1, 0.01, 0, 1, stationed),
  n("phaseSpread", "Cross-line phase", "Stable spread of the phase between lines, so stitches do not line up across neighbours.", 0, 1, 0.01, 0, 1, stationed),
  n("retention", "Line retention", "Stable omission of lines (ink) or stations without moving the rest.", 0, 1, 0.01, 0, 1, lined),
  select("beadMark", "Bead mark", "Point mark on each bead station.", pointMarks, beaded),
  n("beadSize", "Bead diameter", "Size of each bead.", 1, 26, 0.5, 0, 500, beaded),
  n("beadWeight", "Bead line weight", "Outline width of ring, rosette and arrow beads.", 0.2, 3, 0.05, 0, 50, { lines: [true], material: ["beads"], beadMark: ["rings", "rosette", "arrow"] }),
  n("beadPetals", "Bead petals", "Radial strokes in rosette beads.", 3, 14, 1, 1, 48, { lines: [true], material: ["beads"], beadMark: ["rosette"] }),
  n("beadOpening", "Bead opening", "Open center of rosette beads or inner ring offset.", 0, 0.9, 0.01, 0, 1, { lines: [true], material: ["beads"], beadMark: ["rings", "rosette"] }),

  select("mark", "Oriented marks", "Marks placed across the picture and turned along the field, independent of the lines. None turns them off. An arrow shows the axis of the field, not a sense of travel.", ["none", ...pointMarks]),
  n("markSpacing", "Mark spacing", "Spacing of the grid the marks come from, in canvas units. Cells without enough confidence stay empty.", 6, 80, 1, 0.5, 2000, marked),
  n("markJitter", "Mark scatter", "Displacement of each mark from its cell center, as a fraction of the cell.", 0, 1, 0.01, 0, 1, marked),
  n("markSize", "Mark diameter", "Nominal size of a mark.", 2, 40, 0.5, 0, 500, marked),
  n("markWeight", "Mark line weight", "Outline width of ring, rosette and arrow marks.", 0.2, 3, 0.05, 0, 50, { mark: ["rings", "rosette", "arrow"] }),
  n("markPetals", "Petals", "Radial strokes in each rosette mark.", 3, 16, 1, 1, 48, { mark: ["rosette"] }),
  n("markOpening", "Opening", "Open center of rosette marks or inner ring offset.", 0, 0.9, 0.01, 0, 1, { mark: ["rings", "rosette"] }),
  n("markVariation", "Size variation", "Stable random size variation between marks.", 0, 1, 0.01, 0, 1, marked),
  n("markRetention", "Mark retention", "Stable omission of marks without moving the rest.", 0, 1, 0.01, 0, 1, marked),

  select("colorBy", "Color by", "What picks each line's and mark's palette color: one color, the picture's tone there (dark first), the drawn direction in equal turns of the palette, or a stable random choice.", ["single", "tone", "direction", "random"]),
];

const controlGroups: ControlGroup[] = [
  { label: "Image", stage: "form", controls: ["image", "imageVariant", "resolution", "channel"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }, "rotation"] },
  { label: "Field", stage: "form", controls: ["mode", "ambientKind", "ambientAngle", "ambientWeight", "smoothing", "minConfidence",
    { label: "Tone mask", controls: ["maskTones", "maskMin", "maskMax"] }] },
  { label: "Streamlines", stage: "process", controls: ["lines", { label: "Spacing", controls: ["separation", "stopFraction", "startSpacing", "startJitter"] }, "fill",
    { label: "Extent", controls: ["minLength", "maxLength", "minRadius"] }, "clip"] },
  { label: "Line material", stage: "material", controls: ["material", "weight", "toneWeight", { label: "Stations", controls: ["spacing", "phase", "phaseSpread"] }, "retention",
    { label: "Bead mark", controls: ["beadMark", { label: "Scale", controls: ["beadSize", "beadWeight"], proportional: true }, { label: "Shape", controls: ["beadPetals", "beadOpening"] }] }] },
  { label: "Marks", stage: "material", controls: ["mark", { label: "Spacing", controls: ["markSpacing", "markJitter"] }, { label: "Scale", controls: ["markSize", "markWeight"], proportional: true },
    { label: "Shape", controls: ["markPetals", "markOpening"] }, "markVariation", "markRetention"] },
  { label: "Color", stage: "color", controls: ["colorBy"] },
];

type Values = Record<string, number | string | boolean>;

/**
 * Work that follows from the stored values alone. Line, vertex and step counts depend on the picture and
 * are checked while tracing (`image-field.ts`), with messages naming the same controls.
 */
export function validateImageDirectedField(q: Values): void {
  const area = (q.width as number) * (q.height as number);
  const starts = (spacing: number): number => Math.max(1, Math.round((q.width as number) / spacing)) * Math.max(1, Math.round((q.height as number) / spacing));
  if (q.lines && starts(q.startSpacing as number) > FIELD_LIMITS.starts)
    throw new Error(`Start spacing ${q.startSpacing} would make ${starts(q.startSpacing as number)} start cells; the limit is ${FIELD_LIMITS.starts}. Raise the start spacing or shrink the picture`);
  if (q.mark !== "none" && starts(q.markSpacing as number) > FIELD_LIMITS.starts)
    throw new Error(`Mark spacing ${q.markSpacing} would make ${starts(q.markSpacing as number)} mark cells; the limit is ${FIELD_LIMITS.starts}. Raise the mark spacing or shrink the picture`);
  if (q.lines && area / (q.separation as number) > FIELD_LIMITS.vertices * 2)
    throw new Error(`Line separation ${q.separation} over ${Math.round(area)} square units would need far more than ${FIELD_LIMITS.vertices} vertices. Raise the line separation or shrink the picture`);
  if (q.maskTones && (q.maskMin as number) > (q.maskMax as number))
    throw new Error("Darkest tone must not exceed lightest tone");
  if (q.lines && (q.minLength as number) > (q.maxLength as number))
    throw new Error("Shortest line must not exceed longest line");
}

export const imageDirectedFieldDefinition: InstrumentDefinition = {
  id: "image-directed-field", title: "Image Directed Field",
  description: "Lines and marks that follow or cross the structure of a picture: edges and contours become evenly spaced strokes of ink, stitches or beads, stopping where the picture stops having a direction.",
  procedure: "Measure the direction of edges and textures in a picture with a structure tensor, along with how one-sided that structure is. Trace evenly spaced streamlines that follow those directions, stopping at the border, another line, low confidence or a tight turn, and draw them heavier where the picture is dark.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    image: "portrait", imageVariant: 3, resolution: 128, channel: "lightness",
    centerX: 320, centerY: 320, width: 520, height: 520, rotation: 0,
    mode: "follow", ambientKind: "swirl", ambientAngle: 0, ambientWeight: 0.6, smoothing: 8, minConfidence: 0.25,
    maskTones: false, maskMin: 0, maskMax: 0.5,
    lines: true, separation: 7, stopFraction: 0.6, startSpacing: 40, startJitter: 0.8, fill: true, minLength: 24, maxLength: 320, minRadius: 0, clip: true,
    material: "ink", weight: 1, toneWeight: 0.5, spacing: 8, phase: 0.35, phaseSpread: 0.5, retention: 1,
    beadMark: "dot", beadSize: 5, beadWeight: 1, beadPetals: 6, beadOpening: 0.3,
    mark: "none", markSpacing: 30, markJitter: 0.7, markSize: 12, markWeight: 1, markPetals: 6, markOpening: 0.3, markVariation: 0.2, markRetention: 1,
    colorBy: "tone",
  },
  validate: validateImageDirectedField,
};
