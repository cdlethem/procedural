import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { MAX_VERTICES, estimateEngraving } from "../composition/engraving.js";
import type { ClipMode, EngravingOptions, FootprintShape } from "../composition/engraving.js";
import type { CarrierFamily } from "../composition/engraving-carriers.js";
import type { FitMode, ToneEncoding } from "../composition/engraving-tone.js";
import type { BundledRasterId } from "../composition/raster-samples.js";
import { bundledRasterIds, bundledRasterInfo } from "../composition/raster-samples.js";
import { choice, numeric } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => (visibleWhen ? { ...parameter, visibleWhen } : parameter);
const integerKeys = new Set(["variant"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter =>
  withCondition(choice(key, label, description, options), visibleWhen);
const labelled = (parameter: Parameter, labels: Record<string, string>): Parameter =>
  ({ ...parameter, options: parameter.options!.map((option) => ({ value: option.value, label: labels[option.value] ?? option.value })) });

const ruled: Condition = { family: ["straight", "curved", "flow"] };
const curved: Condition = { family: ["curved"] };
const radial: Condition = { family: ["rings", "spiral"] };
const flowing: Condition = { family: ["flow"] };
const inked: Condition = { line: ["ink"] };
const stitched: Condition = { line: ["stitch"] };

const parameters: Parameter[] = [
  labelled(choice("image", "Source image", "Which bundled picture is engraved. Each is a generated stand-in for a photograph with a different tonal character; your own images arrive through the host, not this control.", [...bundledRasterIds]),
    Object.fromEntries(bundledRasterIds.map((id) => [id, bundledRasterInfo[id].title]))),
  n("variant", "Sample variant", "Re-arranges the chosen picture (its parts move and re-tint) without touching the seed, so the engraving's own chance stays as it was.", 0, 40, 1, 0, 1000000),
  select("fit", "Fit", "Contain shows the whole picture inside the footprint; cover fills the footprint and crops the picture; stretch distorts the picture onto the footprint.", ["contain", "cover", "stretch"]),
  select("clip", "Clip to", "Image stops the lines at the picture's edge; footprint lets them continue over the extended edge tone to the footprint's edge.", ["image", "footprint"], { fit: ["contain"] }),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the footprint.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the footprint.", 0, 640, 1, -4096, 4096),
  n("width", "Width", "Width of the footprint, in canvas units, before rotation.", 80, 640, 1, 1, 4096),
  n("height", "Height", "Height of the footprint, in canvas units, before rotation.", 80, 640, 1, 1, 4096),
  n("rotation", "Rotation", "Turns the whole picture, footprint and lines about its center, in degrees.", -180, 180, 1, -3600, 3600),
  select("shape", "Shape", "Rectangle clips the lines to the footprint's rectangle; ellipse clips them to the ellipse inscribed in it.", ["rectangle", "ellipse"]),

  select("encode", "Lines encode", "Dark makes shadows the strongest lines, on paper that stays empty; light does the reverse, engraving the highlights.", ["dark", "light"]),
  n("smoothing", "Tone smoothing", "Averages the picture over cells this wide, in canvas units, before it is read. Detail finer than the line spacing cannot be carried, so this keeps it from turning into noise; 0 reads the picture's own pixels.", 0, 30, 0.5, 0, 200),
  n("toneCurve", "Tone curve", "Exponent applied to the tone: below 1 lets light tones count for more, above 1 saves modulation for the darkest places.", 0.4, 2.5, 0.05, 0.2, 5),
  n("threshold", "Negative space", "Tones below this level draw nothing, so highlights stay paper; the modulation starts from zero at the edge of the open area.", 0, 0.8, 0.01, 0, 0.98),
  n("minLength", "Shortest line", "Drops line fragments shorter than this, in canvas units, so open areas do not fill with specks.", 0, 60, 0.5, 0, 2000),

  select("family", "Scan lines", "The carriers the waves ride on: straight parallel lines, lines bent by one wave, concentric rings, one spiral, or streamlines that follow the picture's own directions.", ["straight", "curved", "rings", "spiral", "flow"]),
  n("angle", "Scan angle", "Direction of the lines in degrees, 0 along the picture's x axis. In flow it is the direction used where the picture has no clear direction.", -90, 90, 1, -3600, 3600, ruled),
  n("spacing", "Line spacing", "Gap between neighbouring lines, in canvas units, where the tone is light.", 5, 20, 0.5, 1, 200),
  n("spacingGain", "Spacing gain", "How much dark tones crowd the lines: 0 keeps the spacing constant; 0.5 halves it in the darkest places.", 0, 0.4, 0.01, 0, 0.9),
  n("bend", "Bend", "Amplitude, in canvas units, of the sine that bends every line the same way.", 0, 40, 0.5, 0, 1000, curved),
  n("bendLength", "Bend length", "Wavelength of that bend, in canvas units.", 40, 400, 5, 4, 10000, curved),
  n("radialX", "Radial center X", "Horizontal position of the rings' or spiral's center, as a fraction of the footprint width from its middle.", -0.25, 0.25, 0.01, -2, 2, radial),
  n("radialY", "Radial center Y", "Vertical position of the rings' or spiral's center, as a fraction of the footprint height from its middle.", -0.25, 0.25, 0.01, -2, 2, radial),
  n("follow", "Image direction", "How strongly the lines follow the picture's edges and stripes: 0 ignores them (straight lines), 1 follows wherever the picture has a clear direction.", 0, 1, 0.01, 0, 1, flowing),
  n("flowSmoothing", "Direction smoothing", "Blurs the picture's directions over this length, in canvas units, so lines follow shapes rather than pixel noise.", 0, 60, 0.5, 0, 200, flowing),

  n("baseFrequency", "Base frequency", "Waves per 100 canvas units where the tone is lightest (just above the negative-space level).", 0, 10, 0.5, 0, 50),
  n("frequencyGain", "Frequency gain", "Extra waves per 100 units at the darkest tone: shadows get shorter waves. Base plus gain is at most 50, a 2-unit wavelength; the sliders stop at 22 together, and typing beyond them is allowed.", 0, 12, 0.5, 0, 50),
  n("baseAmplitude", "Base amplitude", "Height of the waves in the lightest lines, in line spacings; 0 leaves them straight.", 0, 0.6, 0.01, 0, 2),
  n("amplitudeGain", "Amplitude gain", "Extra wave height at the darkest tone, in line spacings. Base plus gain is at most 4; above about 0.5 neighbouring lines overlap.", 0, 1, 0.01, 0, 3),
  n("phaseSpread", "Phase spread", "How far each line's wave starts from a common phase, as a fraction of a cycle, drawn from the seed: 0 lines the crests up, 1 scatters them.", 0, 1, 0.01, 0, 1),

  select("line", "Line", "Continuous ink, or stitches laid along each wave.", ["ink", "stitch"]),
  n("lineWeight", "Line weight", "Stroke width of the line or stitches, in canvas units.", 0.3, 4, 0.05, 0, 50),
  n("widthGain", "Tone to width", "How much tone thickens the ink: 0 keeps one weight; 1 runs from a hairline at the lightest tone to twice the weight at the darkest.", 0, 1, 0.01, 0, 1, inked),
  n("stitchSpacing", "Stitch spacing", "Distance between stitch centers along each wave.", 3, 30, 0.5, 0.5, 1000, stitched),
  n("stitchPhase", "Stitch phase", "Slides the stitches along each wave by a fraction of their spacing.", 0, 1, 0.01, 0, 1, stitched),
  select("colorBy", "Color by", "Ink uses the first palette color; tone runs the palette from the lightest tone to the darkest; line alternates palette colors from line to line.", ["ink", "tone", "line"]),
];

const controlGroups: ControlGroup[] = [
  { label: "Source image", stage: "form", controls: ["image", "variant", "fit", "clip"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }, "rotation", "shape"] },
  { label: "Tone", stage: "color", controls: ["encode", "smoothing", "toneCurve", "threshold", "minLength"] },
  { label: "Scan lines", stage: "material", controls: ["family", "angle", { label: "Spacing", controls: ["spacing", "spacingGain"] }, "bend", "bendLength", "radialX", "radialY", "follow", "flowSmoothing"] },
  { label: "Waves", stage: "form", controls: [{ label: "Frequency", controls: ["baseFrequency", "frequencyGain"], proportional: true },
    { label: "Amplitude", controls: ["baseAmplitude", "amplitudeGain"], proportional: true }, "phaseSpread"] },
  { label: "Line", stage: "material", controls: ["line", "lineWeight", "widthGain", "stitchSpacing", "stitchPhase", "colorBy"] },
];


export type LineKind = "ink" | "stitch";
export type ColorBy = "ink" | "tone" | "line";
export interface EngravingLineSpec { kind: LineKind; weight: number; widthGain: number; stitchSpacing: number; stitchPhase: number; colorBy: ColorBy }
/** The typed, JSON-compatible composition value: engraving options plus the line material. */
export type EngravingComposition = { kind: "fm-engraving"; palette: readonly number[]; line: EngravingLineSpec } & EngravingOptions;

type Values = Record<string, number | string | boolean>;

export function engravingFromValues(q: Values, seed: number, palette: readonly number[]): EngravingComposition {
  const n = (key: string): number => q[key] as number;
  return {
    kind: "fm-engraving", seed, palette: [...palette],
    source: { kind: "bundled", id: q.image as BundledRasterId, variant: n("variant") },
    footprint: { centerX: n("centerX"), centerY: n("centerY"), width: n("width"), height: n("height"), rotation: n("rotation"), shape: q.shape as FootprintShape },
    image: { fit: q.fit as FitMode, clip: q.clip as ClipMode, encode: q.encode as ToneEncoding, smoothing: n("smoothing") },
    tone: { curve: n("toneCurve"), threshold: n("threshold") },
    scan: { family: q.family as CarrierFamily, spacing: n("spacing"), spacingGain: n("spacingGain"), angle: n("angle"), bend: n("bend"), bendLength: n("bendLength"),
      radialX: n("radialX"), radialY: n("radialY"), follow: n("follow"), flowSmoothing: n("flowSmoothing") },
    wave: { baseFrequency: n("baseFrequency"), frequencyGain: n("frequencyGain"), baseAmplitude: n("baseAmplitude"), amplitudeGain: n("amplitudeGain"), phaseSpread: n("phaseSpread") },
    minLength: n("minLength"),
    line: { kind: q.line as LineKind, weight: n("lineWeight"), widthGain: n("widthGain"), stitchSpacing: n("stitchSpacing"), stitchPhase: n("stitchPhase"), colorBy: q.colorBy as ColorBy },
  };
}


/** Work that follows from the stored values alone; the same bounds are enforced exactly while building. */
export function validateFmEngraving(q: Values): void {
  if (Number(q.baseFrequency) + Number(q.frequencyGain) > 50)
    throw new Error(`Base frequency ${q.baseFrequency} + frequency gain ${q.frequencyGain} exceeds 50 waves per 100 units (a 2-unit wavelength); lower either`);
  if (Number(q.baseAmplitude) + Number(q.amplitudeGain) > 4)
    throw new Error(`Base amplitude ${q.baseAmplitude} + amplitude gain ${q.amplitudeGain} exceeds 4 line spacings; lower either`);
  const o = engravingFromValues(q, 0, [0]);
  const { vertices } = estimateEngraving(o);
  if (vertices > 2 * MAX_VERTICES)
    throw new Error(`Engraving would need about ${vertices} modulated vertices; the limit is ${MAX_VERTICES}. Raise the line spacing, lower the base frequency and frequency gain, or shrink the footprint`);
}

/** Whether the seed can change this construction: only phase spread and flow lines use it. */
export const fmEngravingUsesSeed = (q: Values): boolean => Number(q.phaseSpread) > 0 || q.family === "flow";

export const fmEngravingDefinition: InstrumentDefinition = {
  id: "fm-engraving", title: "FM Engraving",
  description: "Engrave a picture as wavy line bands: scan lines run across its tones, and where it is dark the waves grow taller and quicker while the lines crowd or thicken; light places stay open paper.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    image: "portrait", variant: 3, fit: "contain", clip: "image",
    centerX: 320, centerY: 320, width: 500, height: 500, rotation: 0, shape: "rectangle",
    encode: "dark", smoothing: 5, toneCurve: 1, threshold: 0.46, minLength: 6,
    family: "straight", angle: -15, spacing: 6, spacingGain: 0.3, bend: 14, bendLength: 160, radialX: 0, radialY: 0, follow: 0.7, flowSmoothing: 10,
    baseFrequency: 5, frequencyGain: 11, baseAmplitude: 0.12, amplitudeGain: 0.34, phaseSpread: 0.3,
    line: "ink", lineWeight: 1.1, widthGain: 0.4, stitchSpacing: 8, stitchPhase: 0.3, colorBy: "ink",
  },
  validate: validateFmEngraving,
};
