import { checkPaintBounds, MAX_PAINT_LAYERS } from "../composition/painterly.js";
import type { PaintFamily } from "../composition/painterly.js";
import { checkPaintMaterial } from "../composition/painterly-style.js";
import type { PaintMaterialKind } from "../composition/painterly-style.js";
import { bundledRasterIds, bundledRasterInfo } from "../composition/raster-samples.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
type Scalar = number | string | boolean;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, integer = false, visibleWhen?: Condition): Parameter => {
  const parameter = numeric(key, label, description, min, max, step, { hardMin, hardMax, integer });
  return visibleWhen ? { ...parameter, visibleWhen } : parameter;
};
const select = (key: string, label: string, description: string, options: readonly (readonly [string, string])[], visibleWhen?: Condition): Parameter => {
  const parameter = { ...choice(key, label, description, options.map(([value]) => value)), options: options.map(([value, text]) => ({ value, label: text })) };
  return visibleWhen ? { ...parameter, visibleWhen } : parameter;
};

/** Bundled subjects are rendered at this side length (pixels); a host raster keeps its own. */
export const PAINT_IMAGE_SIZE = 192;

const windowed: Condition = { subject: ["window"] };
const reduced: Condition = { colorMode: ["reduced"] };
const outlined: Condition = { material: ["rings", "rosette", "arrow"] };
const rosette: Condition = { material: ["rosette"] };

const materials: readonly (readonly [PaintMaterialKind, string])[] = [
  ["ink", "Ink stroke"], ["stitch", "Stitches"], ["beads", "Beads"], ["dot", "Dots"], ["rings", "Rings"], ["rosette", "Rosettes"], ["arrow", "Arrows"],
];
const families: readonly (readonly [PaintFamily, string])[] = [["dot", "Dots"], ["dab", "Dabs"], ["stroke", "Short strokes"], ["ribbon", "Ribbons"]];

const parameters: Parameter[] = [
  select("image", "Source image", "The bundled subject the marks are sampled from. Every image is synthetic and generated on the spot; a host's own pictures reach the library as a raster value, not as a setting.",
    bundledRasterIds.map((id): [string, string] => [id, bundledRasterInfo[id].title])),
  n("imageVariant", "Image variant", "Re-tints and re-arranges the chosen subject (a different sitter, ridge line, tile layout). It changes the source, not the marks' chance, so it is separate from the seed.", 0, 24, 1, 0, 4294967295, true),

  n("centerX", "Center X", "Horizontal canvas position of the middle of the picture.", 0, 640, 1, -4096, 4096),
  n("centerY", "Center Y", "Vertical canvas position of the middle of the picture.", 0, 640, 1, -4096, 4096),
  n("size", "Size", "Width and height of the picture on the canvas, in canvas units (the bundled subjects are square). Marks keep their sizes; a smaller picture gets more layers of detail per unit.", 120, 900, 1, 8, 4000),

  n("layers", "Layers", `How many passes of marks: the first lays down the coarsest brush everywhere, each later pass repaints only where the picture still differs from the source. At most ${MAX_PAINT_LAYERS}.`, 1, 6, 1, 1, MAX_PAINT_LAYERS, true),
  n("brush", "Coarsest brush", "Width of the marks in the first layer, in canvas units. Later layers shrink from it by the size ratio.", 4, 40, 0.5, 0.5, 100),
  n("ratio", "Size ratio", "Each layer's brush is the previous one divided by this. Near 1 the layers are close in size; large values jump from broad masses to fine marks.", 1.2, 3.2, 0.05, 1.1, 8),
  n("coverage", "Coverage", "The average number of marks covering each point of a layer (grid density; the marks are jittered and overlap). Under 1 leaves gaps that later layers may fill.", 0.6, 3, 0.05, 0.25, 8),
  n("threshold", "Error threshold", "A later layer paints a cell only if its current paint differs from the source there by more than this (0 is nothing, 1 is black against white; unpainted counts as fully different). Low values paint everywhere at every layer; high values leave the coarse layer to stand.", 0, 0.4, 0.005, 0, 1),

  select("family", "Mark family", "The shape of each mark's footprint: round dots, short dabs, strokes that bend with the picture's structure, or long ribbons. It sets the footprint and the plan; the material then draws it.",
    families.map(([value, text]): [string, string] => [value, text])),
  n("jitter", "Jitter", "How far each mark strays from its grid cell's center, as a fraction of the cell. 0 keeps a regular lattice; 1 places each mark anywhere in its cell.", 0, 1.2, 0.05, 0, 2),

  n("coherence", "Direction coherence", "0 lays every mark at the base angle (a hand hatching in one direction); 1 turns each along the picture's edges and contours wherever they are strong. Flat areas keep the base angle either way.", 0, 1, 0.01, 0, 1),
  n("baseAngle", "Base angle", "The direction of marks where the picture has no strong structure, or wherever coherence is below 1, in degrees clockwise from horizontal.", -90, 90, 1, -3600, 3600),
  n("smoothing", "Structure scale", "How widely the picture's edges are averaged before marks turn to follow them, in multiples of the layer's brush width. Small values follow every contour; large values follow only the big shapes.", 0.25, 3, 0.05, 0, 8),
  n("scatter", "Angle scatter", "Random turn of each mark either way from its direction, in degrees; stable per mark.", 0, 45, 1, 0, 180),

  n("paper", "Paper level", "Areas of the source lighter than this are left bare (transparent), so highlights and pale skies stay empty. 1 paints everything.", 0.5, 1, 0.01, 0, 1),
  n("retention", "Retention", "Keeps this fraction of the marks in every layer; which ones is fixed by the mark, so raising it never moves the others.", 0, 1, 0.01, 0, 1),
  select("subject", "Subject", "Paint the whole picture, or only an elliptical window on it and leave the rest bare.", [["all", "Whole picture"], ["window", "Window"]]),
  n("subjectX", "Window X", "Horizontal center of the window as a fraction of the picture's width.", 0, 1, 0.01, -4, 5, false, windowed),
  n("subjectY", "Window Y", "Vertical center of the window as a fraction of the picture's height.", 0, 1, 0.01, -4, 5, false, windowed),
  n("subjectWidth", "Window width", "Width of the window as a fraction of the picture's width.", 0.1, 1.5, 0.01, 0.001, 100, false, windowed),
  n("subjectHeight", "Window height", "Height of the window as a fraction of the picture's height.", 0.1, 1.5, 0.01, 0.001, 100, false, windowed),
  n("feather", "Window feather", "How much of the window's rim thins out, as a fraction of its radius: 0 is a hard edge; 1 fades from the center.", 0, 1, 0.01, 0, 1, false, windowed),

  select("material", "Material", "How each planned mark is drawn: a stroke along its path, stitches or beads along it, or a dot, ring, rosette or arrow at its center. Changing it never changes the plan.", materials.map(([value, text]): [string, string] => [value, text])),
  n("fill", "Mark fill", "Drawn width as a fraction of the planned brush width. 1 fills each footprint; less leaves paper between marks; more overpaints.", 0.2, 1.25, 0.05, 0.05, 2),
  n("lineWeight", "Line weight", "Outline width of rings, rosette petals and arrows, in canvas units.", 0.3, 4, 0.05, 0.1, 50, false, outlined),
  n("petals", "Petals", "Radial strokes in each rosette.", 3, 12, 1, 1, 48, true, rosette),

  select("colorMode", "Color", "Where mark colors come from. Source keeps the sampled colors; Reduced merges them into a few by median cut; Palette snaps each to its nearest palette color; Ramp maps lightness onto the palette from dark to light.",
    [["source", "Source colors"], ["reduced", "Reduced"], ["palette", "Nearest palette color"], ["ramp", "Palette ramp by lightness"]]),
  n("colors", "Reduced colors", "How many colors the marks are merged into.", 2, 24, 1, 1, 64, true, reduced),
  n("saturation", "Saturation", "Pushes each sampled color away from its gray before it is reduced or matched; 0 is gray, 1 is as sampled. The lightness ramp reads lightness only, so it is not affected.", 0, 2, 0.05, 0, 4, false, { colorMode: ["source", "reduced", "palette"] }),
];

const controlGroups: readonly ControlGroup[] = [
  { label: "Source", controls: ["image", "imageVariant"] },
  { label: "Placement", controls: ["centerX", "centerY", "size"] },
  { label: "Layers", controls: ["layers", "brush", "ratio", "coverage", "threshold"] },
  { label: "Marks", controls: ["family", "jitter"] },
  { label: "Direction", controls: ["coherence", "baseAngle", "smoothing", "scatter"] },
  { label: "Negative space", controls: ["paper", "retention", "subject", "subjectX", "subjectY",
    { label: "Window size", controls: ["subjectWidth", "subjectHeight"], proportional: true }, "feather"] },
  { label: "Material", controls: ["material", "fill", "lineWeight", "petals"] },
  { label: "Color", controls: ["colorMode", "colors", "saturation"] },
];

/** Work and material limits that follow from the stored values alone. */
export function validatePainterlySource(q: Record<string, Scalar>): void {
  const size = q.size as number, family = q.family as PaintFamily;
  checkPaintBounds({ layers: q.layers as number, brush: q.brush as number, ratio: q.ratio as number, coverage: q.coverage as number, family, width: size, height: size });
  checkPaintMaterial(q.brush as number, q.ratio as number, q.layers as number, family,
    { kind: q.material as PaintMaterialKind, fill: q.fill as number, lineWeight: q.lineWeight as number, petals: q.petals as number });
}

export const painterlySourceDefinition: InstrumentDefinition = {
  id: "painterly-source", title: "Painterly Source",
  description: "A picture assembled from marks in coarse-to-fine layers: broad strokes first, finer ones only where the paint still differs from the source, turned along its edges and colored from it. Mark family, material and color are separate choices over one plan.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    image: "portrait", imageVariant: 3,
    centerX: 320, centerY: 320, size: 560,
    layers: 4, brush: 30, ratio: 1.8, coverage: 1.6, threshold: 0.05,
    family: "stroke", jitter: 0.8,
    coherence: 0.9, baseAngle: 35, smoothing: 1, scatter: 8,
    paper: 1, retention: 1, subject: "all", subjectX: 0.5, subjectY: 0.45, subjectWidth: 0.7, subjectHeight: 0.8, feather: 0.3,
    material: "ink", fill: 1, lineWeight: 1, petals: 6,
    colorMode: "reduced", colors: 10, saturation: 1.1,
  },
  validate: validatePainterlySource,
};
