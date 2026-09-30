import { complexEscapeDistance2D, fractalFlameAccumulate2D, marchingSquares2D } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { ControlGroup, Layer } from "../types.js";
import { channels, choice, numeric, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
type Image = { pixels: Uint8ClampedArray; loadPixels(): void; updatePixels(): void };
type Canvas = {
  createImage(width: number, height: number): Image;
  image(image: Image, x: number, y: number, width: number, height: number): void;
  noFill(): void;
  stroke(r: number, g: number, b: number, alpha: number): void;
  strokeWeight(weight: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
};
type FlameTransform = { a: [number, number, number, number]; t: [number, number]; power: "linear" | "sin" | "abs"; weight: number };
const GRID = 216;
const TAU = Math.PI * 2;
const flameSourceKeys = ["maps", "arrangement", "contraction", "rotationSpread", "translationSpread", "translationAspect", "biasX", "biasY", "disorder", "linearWeight", "sinWeight", "absWeight", "iterations", "worldCenterX", "worldCenterY", "worldWidth", "worldAspect"] as const;
const escapeSourceKeys = ["mapping", "constantReal", "constantImag", "worldCenterX", "worldCenterY", "worldWidth", "worldAspect", "resolution", "iterations"] as const;

const footprint = [
  numeric("footprintX", "Output X", "Center of the marks on the canvas; independent of the sampled world center.", -100, 740, 1, { hardMin: -2000, hardMax: 2600 }),
  numeric("footprintY", "Output Y", "Center of the marks on the canvas.", -100, 740, 1, { hardMin: -2000, hardMax: 2600 }),
  numeric("footprintWidth", "Output width", "Width of the local rendered footprint, not a painted rectangle.", 100, 600, 5, { hardMin: 1, hardMax: 2400 }),
  numeric("footprintHeight", "Output height", "Height of the local rendered footprint.", 100, 600, 5, { hardMin: 1, hardMax: 2400 }),
];
const windowControls = [
  numeric("worldCenterX", "World center X", "Center of the sampled complex / flame world window, independent of output position.", -3, 3, .05, { hardMin: -100, hardMax: 100 }),
  numeric("worldCenterY", "World center Y", "Center of the sampled world window.", -3, 3, .05, { hardMin: -100, hardMax: 100 }),
  numeric("worldWidth", "World width", "Width of the sampled world window; zooms the geometry without resizing its output.", .5, 10, .05, { hardMin: .00001, hardMax: 100 }),
  numeric("worldAspect", "World aspect", "World width divided by world height.", .4, 2.5, .05, { hardMin: .05, hardMax: 20 }),
];
const flameDefaults = {
  maps: 6, arrangement: "ring", contraction: .56, rotationSpread: 100, translationSpread: 1.85,
  translationAspect: 1.15, biasX: 0, biasY: .15, disorder: .24,
  linearWeight: 1, sinWeight: .42, absWeight: .2,
  iterations: 180000, worldCenterX: 0, worldCenterY: .15, worldWidth: 9.8, worldAspect: 1,
  footprintX: 320, footprintY: 320, footprintWidth: 530, footprintHeight: 530,
  exposure: 8, threshold: .1,
};
const escapeDefaults = {
  mapping: "mandelbrot", constantReal: -.4, constantImag: .6,
  worldCenterX: -.5, worldCenterY: 0, worldWidth: 3.1, worldAspect: 1,
  resolution: 210, iterations: 140,
  contourStart: 4.5, contourInterval: 4, contourCount: 9, weight: 1.1,
  footprintX: 320, footprintY: 320, footprintWidth: 550, footprintHeight: 550,
};
/** Both fractal studies sample a world window and place the result on the canvas. */
const worldGroup: ControlGroup = { label: "World window", stage: "frame", controls: ["worldCenterX", "worldCenterY", "worldWidth", "worldAspect"] };
const outputGroup: ControlGroup = { label: "Placement", stage: "frame", controls: ["footprintX", "footprintY",
  { label: "Size", controls: ["footprintWidth", "footprintHeight"], proportional: true }] };
export const fractalFieldDefinitions: StudioDefinition[] = [
  {
    id: "flame-clouds", title: "Flame Clouds",
    description: "Seeded populations of contractive affine maps and mixed variations leave translucent accumulated density marks.",
    procedure: "Build several contractive affine maps, each with mixed linear, sine and absolute-value variations, and run a random point through them for a fixed number of iterations. Accumulate hits into a 216 by 216 density grid, then tone it into soft translucent marks.",
    parameters: [
      choice("arrangement", "Map arrangement", "Ordered centers along a ring, paired arc, or line before seeded disorder.", ["ring", "arc", "line"]),
      numeric("maps", "Map count", "Number of authored affine map centers; variation weights create real alternate maps at each center.", 3, 9, 1, { hardMin: 2, hardMax: 12, integer: true }),
      numeric("contraction", "Contraction", "Strict contraction for each affine map, including sin/abs variants.", .25, .75, .01, { hardMin: .05, hardMax: .9 }),
      numeric("rotationSpread", "Rotation spread", "Angular span in degrees of the map rotations around the arrangement.", 0, 180, 1, { hardMin: 0, hardMax: 360 }),
      numeric("translationSpread", "Translation spread", "World-space separation of the map centers.", .1, 3, .05, { hardMin: 0, hardMax: 12 }),
      numeric("translationAspect", "Translation aspect", "Stretch translation centers horizontally versus vertically.", .4, 2.5, .05, { hardMin: .05, hardMax: 20 }),
      numeric("biasX", "Translation bias X", "Shift all authored map translations in world space.", -2, 2, .05, { hardMin: -20, hardMax: 20 }),
      numeric("biasY", "Translation bias Y", "Shift all authored map translations in world space.", -2, 2, .05, { hardMin: -20, hardMax: 20 }),
      numeric("disorder", "Map disorder", "Seeded deviations in rotation and translation; zero preserves regular spacing.", 0, 1, .01, { hardMin: 0, hardMax: 1 }),
      numeric("linearWeight", "Linear variation", "Relative selection weight of the linear map at each center; zero omits this variation.", 0, 3, .05, { hardMin: 0, hardMax: 10 }),
      numeric("sinWeight", "Sine variation", "Relative selection weight of the component-wise sin map at each center.", 0, 3, .05, { hardMin: 0, hardMax: 10 }),
      numeric("absWeight", "Absolute variation", "Relative selection weight of the component-wise abs map at each center.", 0, 3, .05, { hardMin: 0, hardMax: 10 }),
      numeric("iterations", "Point iterations", "Exact native kernel iterate count; one sampling RNG step per iterate.", 60000, 220000, 10000, { hardMin: 10000, hardMax: 280000, integer: true }),
      ...windowControls, ...footprint,
      numeric("exposure", "Density exposure", "Logarithmic density tone mapping. Changing this does not rerun accumulation.", .5, 20, .25, { hardMin: .01, hardMax: 200 }),
      numeric("threshold", "Density threshold", "Hide bins below this raw accumulated density; empty bins remain transparent.", 0, 3, .05, { hardMin: 0, hardMax: 1000 }),
    ],
    controlGroups: [
      { label: "Maps", stage: "form", controls: ["arrangement", "maps", "contraction", "rotationSpread", "translationSpread", "translationAspect",
        { label: "Bias", controls: ["biasX", "biasY"] }, "disorder"] },
      { label: "Variations", stage: "process", controls: ["linearWeight", "sinWeight", "absWeight"] },
      worldGroup,
      outputGroup,
      { label: "Density", stage: "material", controls: ["iterations", "exposure", "threshold"] },
    ],
    defaults: flameDefaults,
    validate: q => validateFractalField(q, "flame-clouds"),
  },
  {
    id: "escape-contours", title: "Escape Contours",
    description: "Isolines of actual quadratic complex-map escape counts, not a filled rendering of the set.",
    procedure: "For each point in a window of the complex plane, iterate z squared plus c and record the step at which it escapes, using the Mandelbrot or a Julia map. Run marching squares over that escape-count field and draw each chosen level as contour strokes.",
    parameters: [
      choice("mapping", "Complex mapping", "Mandelbrot samples c; Julia samples starting z for the editable fixed c.", ["mandelbrot", "julia"]),
      numeric("constantReal", "Julia c real", "Real component of Julia's constant; ignored by Mandelbrot mapping.", -1.5, 1.5, .005, { hardMin: -4, hardMax: 4 }),
      numeric("constantImag", "Julia c imaginary", "Imaginary component of Julia's constant.", -1.5, 1.5, .005, { hardMin: -4, hardMax: 4 }),
      ...windowControls,
      numeric("resolution", "Sample resolution", "Samples on each world axis; combined with iteration budget is preflighted.", 120, 260, 10, { hardMin: 48, hardMax: 320, integer: true }),
      numeric("iterations", "Escape iterations", "Exact quadratic-map escape depth per sample.", 50, 180, 10, { hardMin: 8, hardMax: 450, integer: true }),
      numeric("contourStart", "First contour", "First escape-count isoline; counts equal to the iteration budget are interior, not a signed distance.", 1.5, 32.5, 1, { hardMin: .1, hardMax: 450 }),
      numeric("contourInterval", "Contour interval", "Additional escape counts between isolines.", .5, 16, .5, { hardMin: .01, hardMax: 450 }),
      numeric("contourCount", "Contour count", "Number of successive isolines from first contour.", 1, 14, 1, { hardMin: 1, hardMax: 24, integer: true }),
      numeric("weight", "Contour weight", "Local stroke width; zero leaves no marks.", 0, 5, .1, { hardMin: 0, hardMax: 30 }),
      ...footprint,
    ],
    controlGroups: [
      { label: "Map", stage: "form", controls: ["mapping", "constantReal", "constantImag", "resolution", "iterations"] },
      worldGroup,
      { label: "Contours", stage: "material", controls: ["contourCount", { label: "Counts", controls: ["contourStart", "contourInterval"], proportional: true }, "weight"] },
      outputGroup,
    ],
    defaults: escapeDefaults,
    validate: q => validateFractalField(q, "escape-contours"),
  },
];

type Kind = "flame-clouds" | "escape-contours";
function checked(q: Params, key: string, min: number, max: number, integer = false): number {
  const v = q[key];
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isSafeInteger(v)))
    throw Error(`${key} must be ${integer ? "an integer" : "a finite number"} in [${min}, ${max}]`);
  return v;
}
export function validateFractalField(q: Params, kind: Kind): void {
  if (kind !== "flame-clouds" && kind !== "escape-contours") throw Error("Unknown fractal field");
  for (const [key, low, high] of [["worldCenterX", -100, 100], ["worldCenterY", -100, 100],
    ["worldWidth", .00001, 100], ["worldAspect", .05, 20], ["footprintX", -2000, 2600],
    ["footprintY", -2000, 2600], ["footprintWidth", 1, 2400], ["footprintHeight", 1, 2400]] as const)
    checked(q, key, low, high);
  if (kind === "flame-clouds") {
    if (!["ring", "arc", "line"].includes(String(q.arrangement))) throw Error("Unknown map arrangement");
    checked(q, "maps", 2, 12, true);
    for (const [key, low, high] of [["contraction", .05, .9], ["rotationSpread", 0, 360],
      ["translationSpread", 0, 12], ["translationAspect", .05, 20], ["biasX", -20, 20],
      ["biasY", -20, 20], ["disorder", 0, 1], ["linearWeight", 0, 10],
      ["sinWeight", 0, 10], ["absWeight", 0, 10], ["exposure", .01, 200],
      ["threshold", 0, 1000]] as const) checked(q, key, low, high);
    if (Number(q.linearWeight) + Number(q.sinWeight) + Number(q.absWeight) <= 0)
      throw Error("At least one flame variation must have positive weight");
    checked(q, "iterations", 10000, 280000, true);
    // Native work counts iterates; bound the full app cost of transform choices and 216² bins as well.
    if (Number(q.iterations) * (1 + Number(q.maps) / 12) + GRID * GRID > 500000)
      throw Error("Flame iterations × map count exceeds the 500,000-step app budget");
  } else {
    if (q.mapping !== "mandelbrot" && q.mapping !== "julia") throw Error("Unknown complex mapping");
    checked(q, "constantReal", -4, 4); checked(q, "constantImag", -4, 4);
    const size = checked(q, "resolution", 48, 320, true);
    const iterations = checked(q, "iterations", 8, 450, true);
    checked(q, "contourStart", .1, 450); checked(q, "contourInterval", .01, 450);
    const levels = checked(q, "contourCount", 1, 24, true);
    checked(q, "weight", 0, 30);
    // Native escape upper bound plus each marching-squares scan. A contour can emit <=2 segments/cell.
    if (size * size * (iterations + 2 * levels) > 10_000_000)
      throw Error("Resolution × (escape iterations + contours) exceeds the 10,000,000-step work budget");
  }
}
function retain<T>(cache: Map<string, T>, key: string, compute: () => T): T {
  const existing = cache.get(key);
  if (existing) { cache.delete(key); cache.set(key, existing); return existing; }
  const value = compute();
  cache.set(key, value);
  if (cache.size > 3) cache.delete(cache.keys().next().value!);
  return value;
}
export function flameTransforms(q: Params, seed: number): FlameTransform[] {
  validateFractalField(q, "flame-clouds");
  const rng = new JavaRandom(seed >>> 0);
  const count = Number(q.maps), aspect = Math.sqrt(Number(q.translationAspect));
  const spread = Number(q.translationSpread), disorder = Number(q.disorder);
  const rotation = Number(q.rotationSpread) * Math.PI / 180;
  const phase = rng.nextDouble() * TAU;
  const transforms: FlameTransform[] = [];
  const variants = [["linear", Number(q.linearWeight)], ["sin", Number(q.sinWeight)], ["abs", Number(q.absWeight)]] as const;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const angle = phase + TAU * i / count;
    const position = q.arrangement === "ring" ? [Math.cos(angle), Math.sin(angle)] :
      q.arrangement === "arc" ? [Math.cos(phase + (t - .5) * Math.PI * 1.5), Math.sin(phase + (t - .5) * Math.PI * 1.5)] :
      [(t - .5) * 2 * Math.cos(phase), (t - .5) * 2 * Math.sin(phase)];
    const noiseX = (rng.nextDouble() * 2 - 1) * disorder;
    const noiseY = (rng.nextDouble() * 2 - 1) * disorder;
    const noiseAngle = (rng.nextDouble() * 2 - 1) * disorder;
    const theta = phase + (t - .5) * rotation + noiseAngle * .65;
    const scale = Number(q.contraction);
    const cos = scale * Math.cos(theta), sin = scale * Math.sin(theta);
    const a: [number, number, number, number] = [cos, -sin, sin, cos];
    const offset: [number, number] = [Number(q.biasX) + spread * (position[0] + noiseX * .35) * aspect,
      Number(q.biasY) + spread * (position[1] + noiseY * .35) / aspect];
    for (const [power, weight] of variants) if (weight > 0)
      transforms.push({ a, t: offset, power, weight });
  }
  return transforms;
}
export type FlameField = { density: { width: number; height: number; values: number[] }; plotted: number; dropped: number; rngState: number };
export type EscapeField = { width: number; height: number; iteration: number[]; distance: number[] };
const flames = new Map<string, FlameField>();
const escapes = new Map<string, EscapeField>();
export function flameField(q: Params, seed: number): FlameField {
  validateFractalField(q, "flame-clouds");
  const key = JSON.stringify([seed, ...flameSourceKeys.map(name => q[name])]);
  return retain(flames, key, () => {
    const width = Number(q.worldWidth), height = width / Number(q.worldAspect);
    return fractalFlameAccumulate2D({
      transforms: flameTransforms(q, seed), seeds: [[0, 0]], iterations: Number(q.iterations),
      density: { width: GRID, height: GRID,
        origin: [Number(q.worldCenterX) - width / 2, Number(q.worldCenterY) - height / 2],
        cell: [width / GRID, height / GRID] },
      // Native LCG is a distinct, explicit sampling stream from JavaRandom map construction.
      rngState: (seed ^ 0x9e3779b9) >>> 0, maxWork: Number(q.iterations),
    });
  });
}
export function escapeField(q: Params): EscapeField {
  validateFractalField(q, "escape-contours");
  const key = JSON.stringify(escapeSourceKeys.map(name =>
    q.mapping === "mandelbrot" && (name === "constantReal" || name === "constantImag") ? 0 : q[name]));
  return retain(escapes, key, () => {
    const size = Number(q.resolution), width = Number(q.worldWidth), height = width / Number(q.worldAspect);
    const iterations = Number(q.iterations);
    return complexEscapeDistance2D({ mapping: q.mapping, constant: [Number(q.constantReal), Number(q.constantImag)],
      grid: { width: size, height: size,
        origin: [Number(q.worldCenterX) - width / 2, Number(q.worldCenterY) - height / 2],
        cell: [width / (size - 1), height / (size - 1)] },
      iterations, maxWork: size * size * iterations });
  });
}
function bounds(q: Params): [number, number, number, number] {
  const width = Number(q.footprintWidth), height = Number(q.footprintHeight);
  return [Number(q.footprintX) - width / 2, Number(q.footprintY) - height / 2, width, height];
}
export function drawFractalField(p: Canvas, layer: Layer): void {
  const q = layer.params;
  if (layer.technique === "flame-clouds") {
    const field = flameField(q, layer.seed), image = p.createImage(GRID, GRID);
    image.loadPixels();
    const exposure = Number(q.exposure), threshold = Number(q.threshold), colors = layer.palette.map(channels);
    for (let i = 0; i < field.density.values.length; i++) {
      const density = field.density.values[i];
      if (density <= 0 || density < threshold) {
        image.pixels[4 * i + 3] = 0;
        continue;
      }
      const tone = Math.min(1, Math.log1p(density) / exposure);
      const position = tone * (colors.length - 1), stop = Math.min(colors.length - 1, Math.floor(position));
      const next = Math.min(colors.length - 1, stop + 1), mix = position - stop;
      const color = colors[stop]; const end = colors[next];
      image.pixels[4 * i] = Math.round(color[0] * (1 - mix) + end[0] * mix);
      image.pixels[4 * i + 1] = Math.round(color[1] * (1 - mix) + end[1] * mix);
      image.pixels[4 * i + 2] = Math.round(color[2] * (1 - mix) + end[2] * mix);
      image.pixels[4 * i + 3] = Math.round(255 * tone);
    }
    image.updatePixels();
    p.image(image, ...bounds(q));
  } else if (layer.technique === "escape-contours") {
    const field = escapeField(q);
    if (q.weight === 0) return;
    const size = field.width, [left, top, width, height] = bounds(q);
    p.noFill(); p.strokeWeight(Number(q.weight));
    const n = Number(q.contourCount);
    for (let level = 0; level < n; level++) {
      const threshold = Number(q.contourStart) + level * Number(q.contourInterval);
      if (threshold > Number(q.iterations)) break;
      const { segments } = marchingSquares2D({ values: field.iteration, columns: size, rows: size,
        origin: [left, top], spacing: [width / (size - 1), height / (size - 1)], threshold,
        maxWork: size * size + (size - 1) * (size - 1) });
      p.stroke(...channels(layer.palette[level % layer.palette.length]), 210);
      for (const [x1, y1, x2, y2] of segments) p.line(x1, y1, x2, y2);
    }
  } else throw Error("Unknown fractal field");
}
