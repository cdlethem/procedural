import { bayerDither, binaryMorphology2D, floydSteinbergDither, gradientNoise2D01, medianCutQuantize } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { Layer } from "../types.js";
import { channels, choice, numeric, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
const get = (q: Params, key: string): number => Number(q[key]);
const pi = Math.PI;
const bound = (x: number) => Math.max(0, Math.min(1, x));
const MAX_SOURCE_WORK = 700_000;
const MAX_MORPH_WORK = 1_200_000;
const MAX_QUANTIZE_WORK = 15_000_000;

const n = (key: string, label: string, description: string, min: number, max: number, hardMin = min, hardMax = max, step = .01, integer = false) =>
  numeric(key, label, description, min, max, step, { hardMin, hardMax, integer });
const common = [
  n("scale", "Sample cell", "Raster sampling pitch in canvas units; independent of source dimensions and printed marks.", 9, 30, 4, 120, 1),
  n("centerX", "Source X", "Center of the local sampling footprint, as a canvas fraction.", 0, 1, -1, 2),
  n("centerY", "Source Y", "Center of the local sampling footprint, as a canvas fraction.", 0, 1, -1, 2),
  n("footprintWidth", "Footprint width", "Horizontal source sampling extent in canvas units; zero removes the source.", 0, 600, 0, 1200, 1),
  n("footprintHeight", "Footprint height", "Vertical source sampling extent in canvas units; zero removes the source.", 0, 600, 0, 1200, 1),
  n("featureCount", "Source features", "Independently seeded compact marks in the footprint; zero removes the source.", 0, 18, 0, 48, 1, true),
  n("spread", "Feature spread", "Dispersal of seeded feature centers within the footprint.", 0, 1.3, 0, 2),
  n("featureSize", "Feature radius", "Typical feature radius as a fraction of the footprint, not the raster cell.", .025, .65, .005, 1),
  n("aspect", "Feature aspect", "Stretch features along their individual axes while preserving approximate area.", .3, 3, .1, 8),
  n("featureAngle", "Feature angle", "Mean feature rotation in degrees; each feature retains a seeded variation.", -180, 180, -360, 360, 1),
  n("featureWeight", "Solid source", "Solid density in each feature; mix continuously with stripes and grain.", 0, 1),
  n("waveWeight", "Wave source", "Amount of directional waves within the same compact features.", 0, 1),
  n("waveContrast", "Wave contrast", "Amplitude of the ordered modulation at its chosen wave source weight; zero flattens the stripes.", 0, 1),
  n("waveFrequency", "Wave frequency", "Number of directional cycles across the footprint.", 0, 22, 0, 50, .1),
  n("waveAngle", "Wave angle", "Direction of the wave normal in degrees.", -180, 180, -360, 360, 1),
  n("noiseAmount", "Noise source", "Amount of seeded portable noise within the feature support.", 0, 1),
  n("noiseScale", "Noise scale", "Noise coordinates per footprint; independent of printed cell size.", .2, 18, .01, 80, .1),
  n("sourceGain", "Source gain", "Scales the composed source before operation thresholding; zero leaves transparent paper.", 0, 3, 0, 5),
];
const marks = [
  choice("mark", "Mark shape", "Dots, short lines or filled cells only where the processed bit is retained.", ["dot", "line", "cell"]),
  n("markFill", "Mark fill", "Fraction of the local mark cell occupied by ink; zero draws nothing.", 0, 1),
  n("markAngle", "Mark angle", "Direction of line marks, separate from wave and feature angles.", -180, 180, -360, 360, 1),
  n("rowSpacing", "Row spacing", "Retain every nth sampled row of processed bits.", 1, 7, 1, 12, 1, true),
  n("stitchSpacing", "Stitch spacing", "Retain every nth sampled column of processed bits.", 1, 7, 1, 12, 1, true),
];
const weaveMarks = [
  n("markFill", "Bar fill", "Fraction of each retained cell occupied by a bar; zero draws nothing.", 0, 1),
  n("rowSpacing", "Row spacing", "Retain every nth sampled row of ordered bits.", 1, 7, 1, 12, 1, true),
  n("stitchSpacing", "Stitch spacing", "Retain every nth sampled column of ordered bits.", 1, 7, 1, 12, 1, true),
];
const print = [
  ...marks,
  n("lineLength", "Line length", "Length of each retained-bit stroke in cell widths, independent of sampling.", .15, 5, 0, 10, .05),
  n("lineWeight", "Line width", "Width of each stroke in cell widths; zero removes line ink.", 0, 1.5, 0, 4),
];
const morph = [
  n("sourceThreshold", "Mask cutoff", "Source values at or above this threshold form the binary mask; zero source remains off.", 0, 1),
  n("elementSize", "Element width", "Odd side length of the actual binary morphology structuring element.", 1, 7, 1, 15, 2, true),
  choice("elementShape", "Element shape", "Square, disk or cross-shaped active taps.", ["square", "disk", "cross"]),
  n("passes", "Passes", "Repeated shrink or growth of the same source mask; zero displays the source mask.", 0, 5, 0, 8, 1, true),
  choice("markShape", "Output mark", "Render surviving mask cells as dots or squares, independently of the element.", ["dot", "square"]),
  n("markFill", "Output size", "Fraction of each output cell occupied by ink; zero draws nothing.", 0, 1),
];
const mosaic = [
  n("count", "Colors", "Requested number of real median-cut RGB palette boxes.", 2, 9, 1, 10, 1, true),
  choice("fieldMask", "Show source values", "Show occupied cells only, or occupied high/low cells by source value.", ["all", "high", "low"]),
  n("maskThreshold", "Source cutoff", "Scalar cutoff for the high/low visibility view; never changes the quantized source.", 0, 1),
  n("cellSpacing", "Cell interval", "Retain every nth occupied sample column and row after quantization.", 1, 5, 1, 10, 1, true),
  n("markFill", "Cell fill", "Printed portion of an occupied mosaic cell; zero draws nothing.", 0, 1),
];
const sourceDefaults = {
  centerX: .5, centerY: .5, footprintWidth: 500, footprintHeight: 470,
  featureCount: 9, spread: .84, featureSize: .23, aspect: 1.45, featureAngle: 28,
  featureWeight: .65, waveWeight: .6, waveContrast: .9, waveFrequency: 5, waveAngle: 32,
  noiseAmount: .15, noiseScale: 7, sourceGain: 1.45,
};
const markDefaults = { mark: "dot", markFill: .78, markAngle: 30, rowSpacing: 1, stitchSpacing: 1, lineLength: 1.2, lineWeight: .28 };

const definitions: StudioDefinition[] = [
  { id: "diffusion-engraving", title: "Diffusion engraving", description: "Diffuse source error into retained dots, strokes or cells in a local print.", parameters: [...common, n("threshold", "Diffusion threshold", "Floyd–Steinberg bit threshold; blank source is always blank.", 0, 1), ...print], defaults: { scale: 9, threshold: .5, ...sourceDefaults, ...markDefaults } },
  { id: "dithered-ribbons", title: "Dithered ribbons", description: "Pull elongated independently oriented strokes through retained diffusion bits.", parameters: [...common, n("threshold", "Diffusion threshold", "Threshold before error diffusion into retained ribbon bits.", 0, 1), ...print], defaults: { scale: 10, threshold: .52, ...sourceDefaults, ...markDefaults, mark: "line", lineLength: 3, lineWeight: .26, rowSpacing: 2 } },
  { id: "ordered-halftone", title: "Ordered halftone", description: "An ordered Bayer screen prints local scalar source as independently sized marks.", parameters: [...common, n("order", "Bayer order", "Power of two Bayer threshold screen order.", 1, 5, 1, 6, 1, true), ...print], defaults: { scale: 10, order: 3, ...sourceDefaults, ...markDefaults } },
  { id: "bayer-weave", title: "Bayer weave", description: "Crossed independently weighted bars print only retained ordered-screen bits.", parameters: [...common, n("order", "Bayer order", "Power of two Bayer threshold screen order.", 1, 5, 1, 6, 1, true), ...weaveMarks, n("horizontalWeight", "Across weight", "Width of across bars relative to the cell; zero disables this direction.", 0, 1), n("verticalWeight", "Down weight", "Width of down bars relative to the cell; zero disables this direction.", 0, 1), n("barLength", "Bar reach", "Length of each woven bar in cell widths.", .25, 3, 0, 6)], defaults: { scale: 12, order: 4, ...sourceDefaults, markFill: .78, rowSpacing: 1, stitchSpacing: 1, horizontalWeight: .28, verticalWeight: .18, barLength: 1.25 } },
  { id: "eroded-lace", title: "Eroded lace", description: "Erode an editable binary source mask with a chosen actual structuring element.", parameters: [...common, ...morph], defaults: { scale: 10, ...sourceDefaults, sourceThreshold: .35, elementSize: 3, elementShape: "disk", passes: 1, markShape: "dot", markFill: .9 } },
  { id: "dilated-stamps", title: "Dilated stamps", description: "Dilate the same editable binary source mask without edge wrapping.", parameters: [...common, ...morph], defaults: { scale: 13, ...sourceDefaults, featureSize: .12, sourceThreshold: .55, elementSize: 3, elementShape: "disk", passes: 1, markShape: "square", markFill: .86 } },
  { id: "reduced-mosaic", title: "Reduced mosaic", description: "Median-cut local RGB samples into a spaced, transparent color mosaic.", parameters: [n("scale", "Sample cell", "Source sampling pitch, separate from footprint and printed tile size.", 17, 30, 4, 120, 1), ...common.slice(1), ...mosaic], defaults: { scale: 18, count: 5, ...sourceDefaults, fieldMask: "all", maskThreshold: .5, cellSpacing: 1, markFill: .88 } },
];

/** The indexed source sampler is independent of drawing style, palette, operation and cell resolution. */
export function rasterFeatures(q: Params, seed: number) {
  const random = new JavaRandom(seed >>> 0), features: { x: number; y: number; rx: number; ry: number; cos: number; sin: number }[] = [];
  const root = Math.sqrt(get(q, "aspect")), angle = get(q, "featureAngle") * pi / 180;
  for (let i = 0; i < get(q, "featureCount"); i++) {
    const x = (random.nextDouble() - .5) * get(q, "spread"), y = (random.nextDouble() - .5) * get(q, "spread");
    const size = get(q, "featureSize") * (.72 + random.nextDouble() * .56);
    const a = angle + (random.nextDouble() - .5) * .6;
    features.push({ x, y, rx: size * root, ry: size / root, cos: Math.cos(a), sin: Math.sin(a) });
  }
  return features;
}
export type RasterSource = { columns: number; rows: number; cell: number; values: number[] };
function preflight(q: Params, id: string): { columns: number; cell: number } {
  const size = get(q, "scale"), columns = Math.floor(600 / size);
  if (!Number.isFinite(size) || size < 4 || size > 120 || columns < 5 || columns > 150) throw Error("Sample cell must be between 4 and 120");
  const cells = columns * columns;
  if (cells * get(q, "featureCount") > MAX_SOURCE_WORK) throw Error("Raster source sampling budget exceeded");
  if (id === "eroded-lace" || id === "dilated-stamps") {
    const width = get(q, "elementSize"), passes = get(q, "passes");
    if (!Number.isSafeInteger(width) || width < 1 || width > 15 || width % 2 !== 1) throw Error("Morphology element width must be odd and between 1 and 15");
    let active = 0;
    const radius = (width - 1) / 2;
    for (let y = -radius; y <= radius; y++) for (let x = -radius; x <= radius; x++)
      if (q.elementShape === "square" || (q.elementShape === "cross" ? x === 0 || y === 0 : x * x + y * y <= (width / 2) ** 2)) active++;
    if (cells * active * passes > MAX_MORPH_WORK) throw Error("Morphology grid × kernel × passes budget exceeded");
  }
  if (id === "reduced-mosaic") {
    // Worst case: every sampled cell survives, so reject before allocating the source grid.
    const count = get(q, "count"), work = cells * cells * count + cells * count + cells;
    if (work > MAX_QUANTIZE_WORK) throw Error("Mosaic median-cut grid × grid × colors budget exceeded");
  }
  return { columns, cell: 600 / columns };
}
export function rasterSourceValues(layer: Layer): RasterSource {
  const q = layer.params, { columns, cell } = preflight(q, layer.technique);
  const values = new Array<number>(columns * columns).fill(0);
  const width = get(q, "footprintWidth"), height = get(q, "footprintHeight");
  const featureWeight = get(q, "featureWeight"), waveWeight = get(q, "waveWeight"), noiseAmount = get(q, "noiseAmount"), gain = get(q, "sourceGain");
  const total = featureWeight + waveWeight + noiseAmount;
  if (width === 0 || height === 0 || gain === 0 || total === 0 || get(q, "featureCount") === 0) return { columns, rows: columns, cell, values };
  const features = rasterFeatures(q, layer.seed), noise = noiseAmount ? gradientNoise2D01({ seed: (layer.seed ^ 0x6f23de18) >>> 0 }) : null;
  const a = get(q, "waveAngle") * pi / 180, wc = Math.cos(a), ws = Math.sin(a);
  const frequency = get(q, "waveFrequency"), contrast = get(q, "waveContrast"), noiseScale = get(q, "noiseScale"), cx = 600 * get(q, "centerX"), cy = 600 * get(q, "centerY");
  for (let y = 0; y < columns; y++) for (let x = 0; x < columns; x++) {
    const u = ((x + .5) * cell - cx) / width, v = ((y + .5) * cell - cy) / height;
    let envelope = 0;
    for (const f of features) {
      const dx = u - f.x, dy = v - f.y;
      const fx = (dx * f.cos + dy * f.sin) / f.rx, fy = (dy * f.cos - dx * f.sin) / f.ry;
      const r2 = fx * fx + fy * fy;
      if (r2 < 1) envelope = Math.max(envelope, (1 - r2) ** 2);
    }
    if (envelope === 0) continue;
    const stripe = waveWeight ? .5 + .5 * contrast * Math.cos(2 * pi * frequency * (wc * u + ws * v)) : 0;
    const grain = noise ? noise.sample((u + 3) * noiseScale, (v + 3) * noiseScale) : 0;
    values[y * columns + x] = bound(envelope * gain * (featureWeight + waveWeight * stripe + noiseAmount * grain) / total);
  }
  return { columns, rows: columns, cell, values };
}
function elementFor(q: Params): boolean[] {
  const width = get(q, "elementSize"), radius = (width - 1) / 2;
  const shape = q.elementShape;
  return Array.from({ length: width * width }, (_, i) => {
    const x = i % width - radius, y = Math.floor(i / width) - radius;
    return shape === "square" || (shape === "cross" ? x === 0 || y === 0 : x * x + y * y <= (width / 2) ** 2);
  });
}
export type RasterResult = RasterSource & { bits?: number[]; mask?: boolean[]; colors?: number[][]; palette?: number[][]; indices?: number[] };
export function rasterSourceResult(layer: Layer): RasterResult {
  const source = rasterSourceValues(layer), q = layer.params;
  const { values, columns, rows } = source, cells = values.length;
  if (layer.technique === "eroded-lace" || layer.technique === "dilated-stamps") {
    let mask = values.map(v => v > 0 && v >= get(q, "sourceThreshold"));
    const element = elementFor(q), size = get(q, "elementSize");
    const tapCount = element.reduce((sum, active) => sum + Number(active), 0);
    for (let i = 0; i < get(q, "passes"); i++) mask = binaryMorphology2D({ mask, columns, rows, element, elementColumns: size, elementRows: size,
      mode: layer.technique === "eroded-lace" ? "erode" : "dilate", boundary: "zero", maxWork: cells * tapCount }).mask;
    return { ...source, mask };
  }
  if (layer.technique === "reduced-mosaic") {
    const occupied: number[] = [];
    for (let i = 0; i < cells; i++) if (values[i] > 0) occupied.push(i);
    if (occupied.length === 0) return { ...source, colors: [], palette: [], indices: [] };
    const inkA = channels(layer.palette[0]), inkB = channels(layer.palette[1 % layer.palette.length]);
    const colors = occupied.map(i => { const v = values[i]; return [0, 1, 2].map(channel => (v * inkA[channel] + (1 - v) * inkB[channel]) / 255); });
    const count = get(q, "count"), len = colors.length;
    const reduced = medianCutQuantize({ colors, count, maxWork: len * len * count + len * count + len });
    return { ...source, colors, palette: reduced.palette, indices: reduced.indices };
  }
  if (layer.technique === "ordered-halftone" || layer.technique === "bayer-weave") {
    const order = get(q, "order");
    const bits = bayerDither({ values, columns, rows, order, maxWork: cells * order }).bits;
    for (let i = 0; i < cells; i++) if (values[i] === 0) bits[i] = 0;
    return { ...source, bits };
  }
  const threshold = get(q, "threshold");
  const bits = floydSteinbergDither({ values, columns, rows, threshold, maxWork: cells * 5 }).bits;
  for (let i = 0; i < cells; i++) if (values[i] === 0) bits[i] = 0;
  return { ...source, bits };
}
export function validateRasterSourceInstrument(q: Params, id: string): void {
  
  preflight(q, id);
}
for (const definition of definitions) definition.validate = q => validateRasterSourceInstrument(q, definition.id);
export const rasterSourceInstrumentDefinitions = definitions;

type Canvas = {
  push(): void; pop(): void; translate(x: number, y: number): void;
  noStroke(): void; stroke(r: number, g: number, b: number, alpha: number): void;
  strokeWeight(weight: number): void; fill(r: number, g: number, b: number, alpha: number): void;
  rect(x: number, y: number, width: number, height: number): void;
  circle(x: number, y: number, diameter: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
};
export function drawRasterSourceInstrument(p: Canvas, layer: Layer): void {
  const result = rasterSourceResult(layer), q = layer.params, { columns, cell, values } = result;
  const fill = get(q, "markFill");
  if (fill === 0) return;
  const mode = layer.technique;
  if (mode === "bayer-weave" && get(q, "horizontalWeight") === 0 && get(q, "verticalWeight") === 0) return;
  p.push(); p.translate(20, 20);
  let colorIndex = 0;
  for (let i = 0; i < values.length; i++) {
    const x = i % columns, y = Math.floor(i / columns), px = (x + .5) * cell, py = (y + .5) * cell;
    if (mode === "reduced-mosaic") {
      if (values[i] <= 0) continue;
      const fieldMask = q.fieldMask;
      if (fieldMask === "high" && values[i] < get(q, "maskThreshold") || fieldMask === "low" && values[i] >= get(q, "maskThreshold")) { colorIndex++; continue; }
      if (x % get(q, "cellSpacing") || y % get(q, "cellSpacing")) { colorIndex++; continue; }
      const c = result.palette![result.indices![colorIndex++]];
      p.noStroke(); p.fill(c[0] * 255, c[1] * 255, c[2] * 255, 255);
      p.rect(px - cell * fill / 2, py - cell * fill / 2, cell * fill, cell * fill);
      continue;
    }
    if (result.mask ? !result.mask[i] : !result.bits![i]) continue;
    if (!result.mask && (x % get(q, "stitchSpacing") || y % get(q, "rowSpacing"))) continue;
    const c = channels(layer.palette[(mode === "eroded-lace" || mode === "dilated-stamps" ? x + y : y) % layer.palette.length]);
    if (mode === "bayer-weave") {
      p.noStroke(); p.fill(c[0], c[1], c[2], 225);
      const reach = cell * get(q, "barLength") * fill;
      const horizontal = cell * get(q, "horizontalWeight") * fill, vertical = cell * get(q, "verticalWeight") * fill;
      if (horizontal > 0 && reach > 0) p.rect(px - reach / 2, py - horizontal / 2, reach, horizontal);
      if (vertical > 0 && reach > 0) p.rect(px - vertical / 2, py - reach / 2, vertical, reach);
      continue;
    }
    const mark = result.mask ? q.markShape : q.mark;
    if (mark === "line") {
      const length = cell * get(q, "lineLength") * fill, weight = cell * get(q, "lineWeight") * fill;
      if (length <= 0 || weight <= 0) continue;
      const a = get(q, "markAngle") * pi / 180;
      p.stroke(c[0], c[1], c[2], 225); p.strokeWeight(weight);
      p.line(px - Math.cos(a) * length / 2, py - Math.sin(a) * length / 2,
        px + Math.cos(a) * length / 2, py + Math.sin(a) * length / 2);
    } else {
      p.noStroke(); p.fill(c[0], c[1], c[2], 225);
      if (mark === "dot") p.circle(px, py, cell * fill);
      else p.rect(px - cell * fill / 2, py - cell * fill / 2, cell * fill, cell * fill);
    }
  }
  p.pop();
}
