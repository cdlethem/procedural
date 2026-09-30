import { bilinearRasterRemap2D, separableBlur2D } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { ControlGroup, Layer } from "../types.js";
import { choice, numeric, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
type Raster = { width: number; height: number; pixels: number[] };
type Mark = { x: number; y: number; halfLength: number; halfWidth: number; cos: number; sin: number; index: number };
const PI = Math.PI, TAU = 2 * PI;
const SOURCE_WORK_LIMIT = 2_000_000;
const FILTER_WORK_LIMIT = 1_600_000;
const n = (key: string, label: string, description: string, min: number, max: number,
  hardMin = min, hardMax = max, step = .01, integer = false) =>
  numeric(key, label, description, min, max, step, { hardMin, hardMax, integer });

const shared = [
  n("rasterSize", "Raster resolution", "Square source and output sample grid; not the displayed footprint in canvas units.", 96, 160, 64, 192, 1, true),
  choice("sourceShape", "Source mark", "Choose bars, discs, hollow rings or tiles before filtering.", ["bar", "disc", "ring", "tile"]),
  choice("arrangement", "Arrangement", "Regular line, open grid or scattered area within the source extent.", ["line", "grid", "area"]),
  n("sourceCount", "Marks", "Number of independent source marks; zero leaves clear canvas.", 0, 32, 0, 64, 1, true),
  n("sourceSeed", "Source seed offset", "Changes mark placement without changing deformation or color.", 0, 1000, 0, 2147483647, 1, true),
  n("sourceCenterX", "Source X", "Mark population center, fraction of the raster width.", 0, 1, -1, 2),
  n("sourceCenterY", "Source Y", "Mark population center, fraction of the raster height.", 0, 1, -1, 2),
  n("sourceExtentX", "Source width", "Horizontal spread of scattered marks or grid; zero collapses centers.", 0, 1, 0, 2),
  n("sourceExtentY", "Source height", "Vertical spread of scattered marks or grid; zero collapses centers.", 0, 1, 0, 2),
  n("sourceSpacing", "Line spacing", "Distance between line-arranged source marks in raster pixels.", 0, 24, 0, 48, .5),
  n("sourceDisorder", "Placement disorder", "Jitters grid and line positions by a fraction of cell spacing; scatters area positions.", 0, 1, 0, 1),
  n("markLength", "Mark length", "Length or diameter of each source shape in raster pixels.", 0, 44, 0, 80, .5),
  n("markWidth", "Mark width", "Width or diameter of each source shape in raster pixels.", 0, 24, 0, 60, .5),
  n("markAspect", "Mark aspect", "Stretches the long mark axis and narrows the other while preserving area.", .3, 3, .1, 8),
  n("markAngle", "Mark direction", "Orientation in degrees; source disorder also varies each mark's angle.", -180, 180, -360, 360, 1),
  n("sourceAlpha", "Ink alpha", "Actual source RGBA opacity; zero removes all source ink.", 0, 1, 0, 1),
  n("outputX", "Output X", "Displayed raster center in canvas pixels, independent of source mark placement.", 0, 640, -640, 1280, 1),
  n("outputY", "Output Y", "Displayed raster center in canvas pixels, independent of source mark placement.", 0, 640, -640, 1280, 1),
  n("outputWidth", "Output width", "Displayed raster width in canvas pixels; zero hides this layer.", 0, 640, 0, 1280, 1),
  n("outputHeight", "Output height", "Displayed raster height in canvas pixels; zero hides this layer.", 0, 640, 0, 1280, 1),
];
const warp = [
  n("warpCenterX", "Deformation X", "Deformation center in raster fractions, separate from mark center.", 0, 1, -1, 2),
  n("warpCenterY", "Deformation Y", "Deformation center in raster fractions, separate from mark center.", 0, 1, -1, 2),
  n("warpRadius", "Deformation reach", "Radius of the smooth local deformation envelope in raster pixels.", 8, 100, 1, 240, 1),
  n("swirl", "Swirl", "Signed angular displacement of source sampling, in radians at full envelope.", -3, 3, -8, 8),
  n("pull", "Pull", "Signed inward/outward source-sample displacement in raster pixels.", -40, 40, -120, 120, .5),
  n("wave", "Directional wave", "Signed transverse sample displacement in raster pixels.", -30, 30, -100, 100, .5),
  n("shear", "Directional shear", "Signed sample displacement along the chosen direction in raster pixels.", -30, 30, -100, 100, .5),
  n("waveFrequency", "Wave frequency", "Directional cycles across the raster width.", 0, 12, 0, 30, .1),
  n("wavePhase", "Wave phase", "Phase of the directional sampling wave in degrees.", -180, 180, -360, 360, 1),
  n("waveDirection", "Deformation direction", "Angle of the wave propagation and shear vector in degrees.", -180, 180, -360, 360, 1),
];
const blur = [
  n("kernelXRadius", "Horizontal blur", "Half-width of the normalized triangular horizontal kernel, in raster pixels.", 0, 12, 0, 24, 1, true),
  n("kernelYRadius", "Vertical blur", "Half-width of the normalized triangular vertical kernel, in raster pixels.", 0, 12, 0, 24, 1, true),
];
const sharedDefaults = {
  rasterSize: 144, sourceShape: "bar", arrangement: "grid", sourceCount: 14, sourceSeed: 0,
  sourceCenterX: .5, sourceCenterY: .5, sourceExtentX: .63, sourceExtentY: .49,
  sourceSpacing: 10, sourceDisorder: .3, markLength: 25, markWidth: 7,
  markAspect: 1.2, markAngle: 33, sourceAlpha: .88,
  outputX: 320, outputY: 320, outputWidth: 525, outputHeight: 525,
};
/** One mark population feeds both filters: how it is laid out, what a mark is, then where the raster is displayed. */
const sourceGroups: ControlGroup[] = [
  { label: "Source", stage: "form", controls: ["rasterSize", "arrangement", "sourceCount", "sourceSeed", "sourceCenterX", "sourceCenterY",
    { label: "Size", controls: ["sourceExtentX", "sourceExtentY"], proportional: true }, "sourceSpacing", "sourceDisorder"] },
  { label: "Mark", stage: "material", controls: ["sourceShape", { label: "Size", controls: ["markLength", "markWidth"], proportional: true },
    "markAspect", "markAngle", "sourceAlpha"] },
];
const outputGroup: ControlGroup = { label: "Placement", stage: "frame", controls: ["outputX", "outputY",
  { label: "Size", controls: ["outputWidth", "outputHeight"], proportional: true }] };
const definitions: StudioDefinition[] = [
  { id: "warp-marks", title: "Warp marks", description: "Bend a local RGBA population of marks through an editable directional deformation map.",
    parameters: [...shared,
      ...warp],
    controlGroups: [...sourceGroups,
      { label: "Focus", stage: "process", controls: ["warpCenterX", "warpCenterY", "warpRadius"] },
      { label: "Displacement", stage: "process", controls: ["swirl", "pull",
        { label: "Directional", controls: ["waveDirection", "wave", "shear", "waveFrequency", "wavePhase"] }] },
      outputGroup],
    defaults: {...sharedDefaults,
      warpCenterX: .5,
      warpCenterY: .5,
      warpRadius: 88,
      swirl: .55,
      pull: -5,
      wave: 8,
      shear: 0,
      waveFrequency: 3,
      wavePhase: 0,
      waveDirection: 45} },
  { id: "blur-marks", title: "Blur marks", description: "Filter the same editable transparent mark source with independent normalized horizontal and vertical kernels.",
    parameters: [...shared,
      ...blur],
    controlGroups: [...sourceGroups,
      { label: "Blur", stage: "process", controls: ["kernelXRadius", "kernelYRadius"], proportional: true },
      outputGroup],
    defaults: {...sharedDefaults,
      sourceShape: "disc",
      sourceCount: 8,
      markLength: 20,
      markWidth: 20,
      markAspect: 1,
      sourceAlpha: .86,
      kernelXRadius: 7,
      kernelYRadius: 8} },
];
export const rasterTransformInstrumentDefinitions = definitions;

function preflight(q: Params, id: string): number {
  if (id !== "warp-marks" && id !== "blur-marks") throw Error("Unknown raster transform instrument");
  const definition = definitions.find(item => item.id === id)!;
  for (const control of definition.parameters) {
    
    const value = q[control.key];
    if (control.type === "select") {
      if (typeof value !== "string" || !control.options?.some(option => option.value === value))
        throw Error(`Invalid ${control.key}`);
    } else if (control.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value) || value < control.hardMin! || value > control.hardMax! ||
        (control.integer && !Number.isSafeInteger(value))) throw Error(`Invalid ${control.key}`);
    }
  }
  if (typeof q.sourceSeed !== "number" || !Number.isSafeInteger(q.sourceSeed)) throw Error("Invalid sourceSeed");
  const size = q.rasterSize as number, count = q.sourceCount as number;
  if (size * size * count > SOURCE_WORK_LIMIT) throw Error("Raster source × marks budget exceeded");
  if (id === "blur-marks" && size * size * ((q.kernelXRadius as number) * 2 + 1 + (q.kernelYRadius as number) * 2 + 1) > FILTER_WORK_LIMIT)
    throw Error("Raster × kernel filter budget exceeded");
  return size;
}
export function validateRasterTransformInstrument(q: Params, id: string): void {
  
  
  preflight(q, id);
}
for (const definition of definitions) definition.validate = q => validateRasterTransformInstrument(q, definition.id);

/** Geometry consumes a source-only RNG. Appearance and deformation never change this sequence. */
export function rasterTransformMarks(q: Params, seed: number, id: string): Mark[] {
  const size = preflight(q, id), count = q.sourceCount as number;
  if (!Number.isSafeInteger(seed)) throw Error("Invalid raster seed");
  const rng = new JavaRandom(((((seed >>> 0) + ((q.sourceSeed as number) >>> 0)) >>> 0) ^ 0x5e4a1b32) >>> 0);
  const marks: Mark[] = [], columns = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / (columns || 1));
  const aspect = Math.sqrt(q.markAspect as number), disorder = q.sourceDisorder as number;
  for (let i = 0; i < count; i++) {
    const a = rng.nextDouble(), b = rng.nextDouble(), c = rng.nextDouble();
    let u: number, v: number;
    if (q.arrangement === "area") {
      u = (a - .5) * (q.sourceExtentX as number);
      v = (b - .5) * (q.sourceExtentY as number);
    } else if (q.arrangement === "line") {
      u = (i - (count - 1) / 2) * (q.sourceSpacing as number) / size +
        (a - .5) * disorder * (q.sourceSpacing as number) / size;
      v = (b - .5) * disorder * (q.sourceExtentY as number);
    } else {
      u = ((i % columns + .5) / columns - .5 + (a - .5) * disorder / columns) * (q.sourceExtentX as number);
      v = ((Math.floor(i / columns) + .5) / rows - .5 + (b - .5) * disorder / rows) * (q.sourceExtentY as number);
    }
    const angle = ((q.markAngle as number) + (c - .5) * disorder * 65) * PI / 180;
    marks.push({ x: (q.sourceCenterX as number + u) * size - .5, y: (q.sourceCenterY as number + v) * size - .5,
      halfLength: (q.markLength as number) * aspect / 2, halfWidth: (q.markWidth as number) / aspect / 2,
      cos: Math.cos(angle), sin: Math.sin(angle), index: i });
  }
  return marks;
}
function pack(a: number, r: number, g: number, b: number): number {
  return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
}
function compositeChannel(color: number, previous: number, a: number, oldA: number, nextA: number, shift: number): number {
  return Math.round(((color >>> shift & 255) * a +
    (previous >>> shift & 255) * oldA * (255 - a) / 255) / nextA);
}
/** Straight ARGB8; absent source is exactly zero, including RGB. */
export function rasterTransformSource(layer: Layer): Raster {
  const q = layer.params, size = preflight(q, layer.technique);
  if (!Number.isSafeInteger(layer.seed) || !layer.palette.length || layer.palette.some(c => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw Error("Invalid raster seed or palette");
  const pixels = new Array<number>(size * size).fill(0);
  if (!q.sourceCount || !q.markLength || !q.markWidth || !q.sourceAlpha) return { width: size, height: size, pixels };
  for (const mark of rasterTransformMarks(q, layer.seed, layer.technique)) {
    const extentX = Math.abs(mark.cos) * mark.halfLength + Math.abs(mark.sin) * mark.halfWidth + 1;
    const extentY = Math.abs(mark.sin) * mark.halfLength + Math.abs(mark.cos) * mark.halfWidth + 1;
    const color = layer.palette[mark.index % layer.palette.length];
    for (let y = Math.max(0, Math.floor(mark.y - extentY)); y <= Math.min(size - 1, Math.ceil(mark.y + extentY)); y++)
      for (let x = Math.max(0, Math.floor(mark.x - extentX)); x <= Math.min(size - 1, Math.ceil(mark.x + extentX)); x++) {
        let inside = 0;
        for (let yi = -1; yi <= 1; yi += 2) for (let xi = -1; xi <= 1; xi += 2) {
          const dx = x + xi * .25 - mark.x, dy = y + yi * .25 - mark.y;
          const localX = dx * mark.cos + dy * mark.sin, localY = dy * mark.cos - dx * mark.sin;
          const nx = localX / mark.halfLength, ny = localY / mark.halfWidth;
          if (q.sourceShape === "disc" ? nx * nx + ny * ny <= 1 :
            q.sourceShape === "ring" ? nx * nx + ny * ny <= 1 && nx * nx + ny * ny >= .37 :
            q.sourceShape === "bar" ? Math.max(Math.abs(nx) - .72, 0) ** 2 * 12.76 + ny * ny <= 1 :
            Math.abs(nx) <= 1 && Math.abs(ny) <= 1) inside++;
        }
        if (!inside) continue;
        const a = Math.round((q.sourceAlpha as number) * inside * 255 / 4), index = y * size + x;
        const previous = pixels[index], oldA = previous >>> 24, nextA = a + Math.round(oldA * (255 - a) / 255);
        if (nextA === 0) continue;
        pixels[index] = pack(nextA, compositeChannel(color, previous, a, oldA, nextA, 16),
          compositeChannel(color, previous, a, oldA, nextA, 8),
          compositeChannel(color, previous, a, oldA, nextA, 0));
      }
  }
  return { width: size, height: size, pixels };
}
function premultiply(source: Raster): Raster {
  return { width: source.width, height: source.height, pixels: source.pixels.map(pixel => {
    const a = pixel >>> 24;
    return pack(a, Math.round((pixel >>> 16 & 255) * a / 255),
      Math.round((pixel >>> 8 & 255) * a / 255), Math.round((pixel & 255) * a / 255));
  }) };
}
function unpremultiply(source: Raster): Raster {
  return { width: source.width, height: source.height, pixels: source.pixels.map(pixel => {
    const a = pixel >>> 24;
    if (a === 0) return 0;
    return pack(a, Math.min(255, Math.round((pixel >>> 16 & 255) * 255 / a)),
      Math.min(255, Math.round((pixel >>> 8 & 255) * 255 / a)), Math.min(255, Math.round((pixel & 255) * 255 / a)));
  }) };
}
function kernel(radius: number): number[] {
  return Array.from({ length: radius * 2 + 1 }, (_, i) => radius + 1 - Math.abs(i - radius));
}
/** Bilinear remap clamps source coordinates to the edge; blur uses normalized edge-clamped taps. */
export function rasterTransformResult(layer: Layer): Raster {
  const source = rasterTransformSource(layer), q = layer.params, size = source.width;
  if (layer.technique === "blur-marks") return separableBlur2D({ source,
    kernelX: kernel(q.kernelXRadius as number), kernelY: kernel(q.kernelYRadius as number),
    maxSamples: FILTER_WORK_LIMIT }).toValues();
  const identity = q.swirl === 0 && q.pull === 0 && q.wave === 0 && q.shear === 0;
  const radius = q.warpRadius as number, cx = (q.warpCenterX as number) * size - .5;
  const cy = (q.warpCenterY as number) * size - .5, direction = (q.waveDirection as number) * PI / 180;
  const dirX = Math.cos(direction), dirY = Math.sin(direction), phase = (q.wavePhase as number) * PI / 180;
  const coordinates: number[][] = new Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let sampleX = x, sampleY = y;
    if (!identity) {
      const dx = x - cx, dy = y - cy, distance = Math.hypot(dx, dy);
      const envelope = distance < radius ? (1 - distance / radius) ** 2 : 0;
      if (envelope > 0) {
        const angle = (q.swirl as number) * envelope;
        sampleX = cx + Math.cos(angle) * dx - Math.sin(angle) * dy;
        sampleY = cy + Math.sin(angle) * dx + Math.cos(angle) * dy;
        if (distance > 0) {
          sampleX += dx / distance * (q.pull as number) * envelope;
          sampleY += dy / distance * (q.pull as number) * envelope;
        }
        const wave = (q.wave as number) * Math.sin(TAU * (q.waveFrequency as number) *
          (dx * dirX + dy * dirY) / size + phase) * envelope;
        sampleX += -dirY * wave + dirX * (q.shear as number) * dy / size * envelope;
        sampleY += dirX * wave + dirY * (q.shear as number) * dy / size * envelope;
      }
    }
    coordinates[y * size + x] = [sampleX, sampleY];
  }
  const result = bilinearRasterRemap2D({ source: identity ? source : premultiply(source),
    outputWidth: size, outputHeight: size, sourceCoordinates: coordinates }).toValues();
  return identity ? result : unpremultiply(result);
}

type Image = { pixels: ArrayLike<number> & { [index: number]: number }; loadPixels(): void; updatePixels(): void };
type Canvas = {
  CORNER: number; push(): void; pop(): void; imageMode(mode: number): void; noTint(): void;
  createImage(width: number, height: number): Image;
  image(image: Image, x: number, y: number, width: number, height: number): void;
};
export function drawRasterTransformInstrument(p: Canvas, layer: Layer): void {
  const q = layer.params;
  validateRasterTransformInstrument(q, layer.technique);
  if (q.outputWidth === 0 || q.outputHeight === 0) return;
  const raster = rasterTransformResult(layer), image = p.createImage(raster.width, raster.height);
  image.loadPixels();
  for (let i = 0; i < raster.pixels.length; i++) {
    const pixel = raster.pixels[i], offset = 4 * i;
    image.pixels[offset] = pixel >>> 16 & 255;
    image.pixels[offset + 1] = pixel >>> 8 & 255;
    image.pixels[offset + 2] = pixel & 255;
    image.pixels[offset + 3] = pixel >>> 24;
  }
  image.updatePixels();
  p.push();
  try {
    p.imageMode(p.CORNER); p.noTint();
    p.image(image, (q.outputX as number) - (q.outputWidth as number) / 2,
      (q.outputY as number) - (q.outputHeight as number) / 2,
      q.outputWidth as number, q.outputHeight as number);
  } finally { p.pop(); }
}
