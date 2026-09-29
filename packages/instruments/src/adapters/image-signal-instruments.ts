import type { Layer } from "../types.js";
import { weightedRasterPoints2D, weightedRasterCentroids2D } from "@procedurals/javascript";
import { controlsAt, nonAudioFeatures, synthesizedFeatures } from "@procedurals/javascript/examples/word-echo/study.js";
import suppliedGlyphs from "../assets/word-echo-glyphs.json" with { type: "json" };
import { channels, choice, numeric, text, toggle, type StudioDefinition } from "./types.js";

const SIZE = 40;
const RASTER_WORK = 500_000;
const rasterCache = new Map<string, WeightedAtlas>();
const signals = { synth: synthesizedFeatures(), "non-audio": nonAudioFeatures() };
type Point = [number, number];
type Painter = {
  push(): void; pop(): void; noFill(): void; noStroke(): void;
  fill(...rgb: number[]): void; stroke(...rgb: number[]): void; strokeWeight(weight: number): void;
  circle(x: number, y: number, diameter: number): void; line(x1: number, y1: number, x2: number, y2: number): void;
  beginShape(): void; vertex(x: number, y: number): void; endShape(mode?: string): void;
  CLOSE: string;
};

export const imageSignalInstrumentDefinitions: StudioDefinition[] = [
  {
    id: "weighted-image-atlas", title: "Weighted image atlas",
    description: "Seeded editable density fragments become local weighted dots, stitches or bars.",
    parameters: [choice("source", "Density source", "Relief ridge, thermal clusters, or a digit grid.", ["relief", "thermal", "grid"]),
      text("densityGrid", "Density grid", "For grid source: 2–32 equal-width digit rows; one terminal newline is allowed. Sampling mass is checked after floor, inversion and threshold.", 1100, true),
      numeric("features", "Source features", "Number of seeded ridges or clusters.", 2, 8, 1, { hardMin: 1, hardMax: 12, integer: true }),
      numeric("spread", "Feature spread", "Distance between source feature centers in source coordinates.", .08, .75, .01, { hardMin: 0, hardMax: 1.5 }),
      numeric("sourceSize", "Feature size", "Gaussian width of each ridge or cluster.", .04, .25, .01, { hardMin: .01, hardMax: .7 }),
      numeric("sourceAspect", "Feature aspect", "Stretches source features across their short axis.", .4, 2, .05, { hardMin: .2, hardMax: 5 }),
      numeric("sourceAngle", "Source angle", "Rotates the feature field in degrees.", -90, 90, 5, { hardMin: -180, hardMax: 180 }),
      numeric("sourceSeed", "Source seed", "Independent feature seed; does not alter sampling sequence.", 0, 200, 1, { hardMin: 0, hardMax: 1000000, integer: true }),
      numeric("samplingSeed", "Sampling seed", "Independent weighted sampling seed.", 0, 200, 1, { hardMin: 0, hardMax: 1000000, integer: true }),
      numeric("floor", "Background floor", "Minimum density behind constructed features.", 0, .4, .01, { hardMin: 0, hardMax: 1 }),
      numeric("threshold", "Threshold", "Density below this level has no sampling mass.", 0, .7, .01, { hardMin: 0, hardMax: .99 }),
      toggle("invert", "Invert density", "Sample the complementary density."),
      numeric("centerX", "Center X", "Local field center in layer coordinates.", 120, 520, 5, { hardMin: -800, hardMax: 1440 }),
      numeric("centerY", "Center Y", "Local field center in layer coordinates.", 120, 520, 5, { hardMin: -800, hardMax: 1440 }),
      numeric("footprintW", "Field width", "Local density field width; no page fit.", 90, 430, 5, { hardMin: 12, hardMax: 1600 }),
      numeric("footprintH", "Field height", "Local density field height; no page fit.", 90, 430, 5, { hardMin: 12, hardMax: 1600 }),
      numeric("count", "Samples", "Number of weighted draws (duplicates allowed).", 30, 220, 10, { hardMin: 0, hardMax: 600, integer: true }),
      numeric("relaxPasses", "Centroid passes", "Nearest-pixel weighted centroid moves; coupled work limit applies.", 0, 2, 1, { hardMin: 0, hardMax: 3, integer: true }),
      choice("marks", "Marks", "Change material without moving sampled sites.", ["dots", "stitches", "bars"]),
      numeric("markSize", "Mark size", "Diameter or stroke length in layer coordinates.", 1, 12, .25, { hardMin: .2, hardMax: 60 }),
      numeric("markAngle", "Mark angle", "Direction of stitches or bars in degrees.", -90, 90, 5, { hardMin: -180, hardMax: 180 }),
      toggle("fieldAlignment", "Field alignment", "Rotate marks toward the local density gradient."),
      toggle("showSource", "Show source", "Overlay the source raster as translucent pixel tiles.")],
    controlGroups: [
      { label: "Density", controls: ["source", "densityGrid",
        { label: "Features", controls: ["features", "spread", "sourceSize", "sourceAspect", "sourceAngle", "sourceSeed"] },
        "floor", "threshold", "invert", "showSource"] },
      { label: "Placement", controls: ["centerX", "centerY", { label: "Size", controls: ["footprintW", "footprintH"], proportional: true }] },
      { label: "Sampling", controls: ["count", "samplingSeed", "relaxPasses"] },
      { label: "Mark", controls: ["marks", "markSize", "markAngle", "fieldAlignment"] },
    ],
    defaults: {source: "relief",
      densityGrid: "09000\n09900\n00990\n00090\n00009",
      features: 4,
      spread: .42,
      sourceSize: .13,
      sourceAspect: 1,
      sourceAngle: -15,
      sourceSeed: 0,
      samplingSeed: 0,
      floor: .06,
      threshold: .12,
      invert: false,
      centerX: 320,
      centerY: 320,
      footprintW: 390,
      footprintH: 390,
      count: 140,
      relaxPasses: 0,
      marks: "dots",
      markSize: 4,
      markAngle: -35,
      fieldAlignment: false,
      showSource: false},
    validate: validateWeightedAtlas,
  },
  {
    id: "word-echo", title: "Word echo",
    description: "Editable licensed glyph contours or a shaped path receive independently sampled recorded controls.",
    parameters: [text("text", "Contour text", "1–20 printable ASCII characters from the licensed GlyphMarks font; unsupported characters are rejected.", 20),
      choice("signal", "Input series", "Synthesized PCM-derived RMS/accent or authored non-audio tide/gust readings.", ["synth", "non-audio"]),
      numeric("time", "Time (seconds)", "Explicit query in 40 recorded samples, every 0.125 seconds.", 0, 4.875, .125, { hardMin: 0, hardMax: 4.875 }),
      choice("transfer", "Source path", "Licensed glyph contours or an independent editable path.", ["contour", "path"]),
      choice("pathShape", "Path shape", "Spiral or wave, independent of text contours.", ["spiral", "wave"]),
      numeric("centerX", "Center X", "Placement in layer coordinates.", 120, 520, 5, { hardMin: -800, hardMax: 1440 }),
      numeric("centerY", "Center Y", "Placement in layer coordinates.", 120, 520, 5, { hardMin: -800, hardMax: 1440 }),
      numeric("footprint", "Contour size", "Physical font contour scale, without automatic fit.", .4, 1.25, .05, { hardMin: .15, hardMax: 2 }),
      numeric("direction", "Direction", "Source rotation in degrees.", -90, 90, 5, { hardMin: -180, hardMax: 180 }),
      numeric("pathRadius", "Path radius", "Spiral outer radius or half wave length.", 70, 220, 5, { hardMin: 12, hardMax: 400 }),
      numeric("pathTurns", "Path turns", "Spiral revolutions or wave cycles.", 1, 5, .25, { hardMin: .25, hardMax: 8 }),
      numeric("pathAspect", "Path aspect", "Vertical path extent relative to radius.", .25, 1, .05, { hardMin: .1, hardMax: 2 }),
      numeric("echoCount", "Echoes", "Number of explicit recorded queries.", 1, 7, 1, { hardMin: 1, hardMax: 10, integer: true }),
      numeric("echoInterval", "Echo interval", "Seconds between consecutive historical queries.", .125, .5, .125, { hardMin: 0, hardMax: 1 }),
      numeric("echoOffsetX", "Echo shift X", "X displacement between echoes.", -25, 25, 1, { hardMin: -90, hardMax: 90 }),
      numeric("echoOffsetY", "Echo shift Y", "Y displacement between echoes.", -25, 25, 1, { hardMin: -90, hardMax: 90 }),
      numeric("spacing", "Mark spacing", "Arc-length spacing along each contour or path, in pixels.", 4, 18, 1, { hardMin: 3, hardMax: 60 }),
      choice("marks", "Marks", "Dots, tangent short strokes, or open rings.", ["dots", "strokes", "rings"]),
      numeric("radiusScale", "Control radius scale", "Passed unchanged to the historical recorded-control mapping.", .5, 1.5, .05, { hardMin: .1, hardMax: 3 }),
      numeric("signalGain", "Signal gain", "Amplitude of signal-driven displacement, separate from contour source.", 0, 2, .1, { hardMin: 0, hardMax: 5 }),
      numeric("baseSize", "Base mark size", "Material-only mark radius/length multiplier.", .2, 2, .05, { hardMin: .05, hardMax: 5 }),
      toggle("showGuide", "Show source guide", "Draw original unshifted contour or path."),
      toggle("showWaveform", "Show waveform", "Add a small view of the recorded level series.")],
    controlGroups: [
      { label: "Source", controls: ["transfer", { label: "Contour", controls: ["text", "footprint"] },
        { label: "Path", controls: ["pathShape", "pathRadius", "pathTurns", "pathAspect"] }, "showGuide"] },
      { label: "Placement", controls: ["centerX", "centerY", "direction"] },
      { label: "Signal", controls: ["signal", "time", "signalGain", "radiusScale", "showWaveform"] },
      { label: "Echoes", controls: ["echoCount", "echoInterval", "echoOffsetX", "echoOffsetY"] },
      { label: "Mark", controls: ["marks", "spacing", "baseSize"] },
    ],
    defaults: {text: "ECHO",
      signal: "synth",
      time: 0,
      transfer: "contour",
      pathShape: "spiral",
      centerX: 320,
      centerY: 305,
      footprint: 1,
      direction: 0,
      pathRadius: 175,
      pathTurns: 2.3,
      pathAspect: .6,
      echoCount: 4,
      echoInterval: .125,
      echoOffsetX: 5,
      echoOffsetY: -6,
      spacing: 9,
      marks: "dots",
      radiusScale: 1,
      signalGain: 1,
      baseSize: 1.8,
      showGuide: false,
      showWaveform: false},
    validate: validateWordEcho,
  },
];

function parameterValue(params: Layer["params"], key: string): number | string | boolean {
  const value = params[key];
  if (value === undefined) throw new Error(`Missing ${key}`);
  return value;
}
function checkDefinition(id: string, params: Layer["params"]): void {
  const definition = imageSignalInstrumentDefinitions.find(item => item.id === id)!;
  for (const parameter of definition.parameters) {
    
    const value = parameterValue(params, parameter.key);
    if (parameter.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value) ||
        value < (parameter.hardMin ?? parameter.min!) || value > (parameter.hardMax ?? parameter.max!) ||
        (parameter.integer && !Number.isInteger(value))) throw new Error(`Invalid ${parameter.key}`);
    } else if (parameter.type === "text") {
      if (typeof value !== "string" || value.length > parameter.maxLength!) throw new Error(`Invalid ${parameter.key}`);
    } else if (parameter.type === "boolean") {
      if (typeof value !== "boolean") throw new Error(`Invalid ${parameter.key}`);
    } else if (typeof value !== "string" || !parameter.options?.some(item => item.value === value)) {
      throw new Error(`Invalid ${parameter.key}`);
    }
  }
}
function digitGrid(source: string): number[][] {
  const rows = source.replace(/\r?\n$/, "").split(/\r?\n/);
  if (rows.length < 2 || rows.length > 32 || !rows.every(row => /^[0-9]{2,32}$/.test(row)) ||
    !rows.every(row => row.length === rows[0].length)) throw new Error("Density grid requires 2–32 equal-width digit rows");
  const values = rows.map(row => Array.from(row, Number));
  return values;
}
export function validateWeightedAtlas(params: Layer["params"]): void {
  
  checkDefinition("weighted-image-atlas", params);
  if (params.source === "grid") digitGrid(params.densityGrid as string);
  // The native centroid operation charges P + activePixels*sites for EACH pass.
  // All P pixels may be active, so preflight before raster allocation or BigInt loops.
  const count = params.count as number, passes = params.relaxPasses as number;
  if (count === 0 && passes > 0) throw new Error("Centroid passes require at least one sample");
  if (SIZE * SIZE * (1 + count * passes) > RASTER_WORK) throw new Error("Weighted atlas centroid work budget exceeded");
}
function randomStream(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}
function sourceWeights(params: Layer["params"], seed: number): { weights: number[]; tones: number[] } {
  const weights = new Array<number>(SIZE * SIZE), tones = new Array<number>(SIZE * SIZE);
  const grid = params.source === "grid" ? digitGrid(params.densityGrid as string) : null;
  const features = grid ? [] : (() => {
    const random = randomStream((seed ^ (params.sourceSeed as number) ^ 0xa31744d1) >>> 0);
    return Array.from({ length: params.features as number }, () => [random() * 2 - 1, random() * 2 - 1, .7 + random() * .6]);
  })();
  const angle = (params.sourceAngle as number) * Math.PI / 180, ca = Math.cos(angle), sa = Math.sin(angle);
  for (let row = 0; row < SIZE; row++) for (let column = 0; column < SIZE; column++) {
    const index = row * SIZE + column, x = (column + .5) / SIZE, y = (row + .5) / SIZE;
    let tone = 0;
    if (grid) {
      tone = grid[Math.min(grid.length - 1, Math.floor(y * grid.length))]
        [Math.min(grid[0].length - 1, Math.floor(x * grid[0].length))] / 9;
    } else {
      const spread = params.spread as number, size = params.sourceSize as number, aspect = params.sourceAspect as number;
      for (const [fx, fy, strength] of features) {
        const dx = x - (.5 + fx * spread * .5), dy = y - (.5 + fy * spread * .5);
        const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
        const radial = params.source === "relief" ?
          ((u - .12 * Math.sin(12 * v + fx * 4)) / size) ** 2 + (v / (size * aspect * 2.5)) ** 2 :
          (u / size) ** 2 + (v / (size * aspect)) ** 2;
        tone += strength * Math.exp(-radial * .5) / features.length * 2.4;
      }
    }
    tone = Math.min(1, Math.max(0, (params.floor as number) + tone));
    tones[index] = tone;
    const density = params.invert ? 1 - tone : tone;
    weights[index] = Math.round(900 * Math.max(0, density - (params.threshold as number)));
  }
  return { weights, tones };
}
export type WeightedAtlas = { weights: number[]; tones: number[]; sampled: Point[]; points: Point[]; pixelIndices: number[] };
/** Material, placement and the displayed source do not enter the sampling cache key. */
export function weightedAtlasModel(params: Layer["params"], seed: number): WeightedAtlas {
  validateWeightedAtlas(params);
  const fields = ["source", "densityGrid", "features", "spread", "sourceSize", "sourceAspect", "sourceAngle",
    "sourceSeed", "samplingSeed", "floor", "threshold", "invert", "count", "relaxPasses"];
  const key = JSON.stringify([seed, ...fields.map(field => params[field])]);
  const cached = rasterCache.get(key);
  if (cached) return cached;
  const { tones, weights } = sourceWeights(params, seed);
  if ((params.count as number) > 0 && !weights.some(weight => weight > 0))
    throw new Error("Density has zero sampling mass after threshold and inversion");
  const sampled = weightedRasterPoints2D({ width: SIZE, height: SIZE, weights, count: params.count as number,
    rngState: (seed ^ (params.samplingSeed as number) ^ 0x917625da) >>> 0, maxWork: 150_000 });
  let points = sampled.points as Point[];
  for (let pass = 0; pass < (params.relaxPasses as number); pass++) {
    points = weightedRasterCentroids2D({ width: SIZE, height: SIZE, weights, sites: points,
      maxWork: SIZE * SIZE * (1 + (params.count as number)) }) .sites as Point[];
  }
  const model = { weights, tones, sampled: sampled.points as Point[], points, pixelIndices: sampled.pixelIndices };
  if (rasterCache.size >= 5) rasterCache.delete(rasterCache.keys().next().value!);
  rasterCache.set(key, model);
  return model;
}

// All printable ASCII glyph outlines and advance widths are deterministically
// generated from the pinned licensed font; neither browser nor system font is used.
const glyphs = Object.fromEntries(Object.entries(suppliedGlyphs.glyphs).map(([letter, glyph]) => {
  const perimeter = glyph.contours.reduce((sum, contour) => sum + contour.reduce((distance, point, index) => {
    if (index === 0) return distance;
    return distance + Math.hypot(point[0] - contour[index - 1][0], point[1] - contour[index - 1][1]);
  }, 0), 0);
  return [letter, { ...glyph, perimeter }];
})) as Record<string, { advance: number; contours: number[][][]; perimeter: number }>;

export function validateWordEcho(params: Layer["params"]): void {
  
  checkDefinition("word-echo", params);
  if (!/^[\x20-\x7E]{1,20}$/.test(params.text as string) || !(params.text as string).trim())
    throw new Error("Contour text supports only 1–20 printable ASCII characters (U+0020–U+007E)");
  const spacing = params.spacing as number, echoes = params.echoCount as number;
  let expected: number;
  if (params.transfer === "contour") {
    expected = [...(params.text as string)].reduce((sum, letter) =>
      sum + glyphs[letter].perimeter * (params.footprint as number) / spacing +
      glyphs[letter].contours.length, 0);
  } else {
    const radius = params.pathRadius as number, turns = params.pathTurns as number, aspect = params.pathAspect as number;
    // Conservative upper bounds from |d(spiral)/dt| and |d(wave)/dt|, including the endpoints.
    const lengthBound = params.pathShape === "spiral" ?
      radius * (1 + 2 * Math.PI * turns * Math.max(1, aspect)) :
      radius * (2 + .65 * aspect * 2 * Math.PI * turns);
    expected = lengthBound / spacing + 1;
  }
  if (echoes * expected > 10_000) throw new Error("Word echo mark work budget exceeded");
}

export function wordEchoSource(params: Layer["params"]): Point[][] {
  validateWordEcho(params);
  const centerX = params.centerX as number, centerY = params.centerY as number;
  const scale = params.footprint as number;
  let local: Point[][];
  if (params.transfer === "path") {
    const radius = params.pathRadius as number, turns = params.pathTurns as number, aspect = params.pathAspect as number;
    const path: Point[] = [];
    for (let i = 0; i <= 320; i++) {
      const t = i / 320, phase = 2 * Math.PI * turns * t;
      path.push(params.pathShape === "spiral" ?
        [Math.cos(phase) * radius * t, Math.sin(phase) * radius * t * aspect] :
        [(t * 2 - 1) * radius, Math.sin(phase) * radius * aspect * .65]);
    }
    local = [path];
  } else {
    const content = params.text as string;
    const width = [...content].reduce((sum, letter) => sum + glyphs[letter].advance, 0);
    let x = -width * .5;
    local = [];
    for (const letter of content) {
      const glyph = glyphs[letter];
      for (const contour of glyph.contours) local.push(contour.map(([px, py]): Point => [(x + px) * scale, (py + 56) * scale]));
      x += glyph.advance;
    }
  }
  const angle = (params.direction as number) * Math.PI / 180, ca = Math.cos(angle), sa = Math.sin(angle);
  return local.map(contour => contour.map(([x, y]) => [centerX + x * ca - y * sa, centerY + x * sa + y * ca]));
}

/** Equidistant interpolation along real contour edges, not every nth font vertex. */
export function contourSamples(contour: Point[], spacing: number, closed: boolean): { position: Point; tangent: number }[] {
  if (contour.length < 2) return [];
  const segments: { start: Point; dx: number; dy: number; length: number }[] = [];
  let length = 0;
  const end = closed ? contour.length : contour.length - 1;
  for (let i = 0; i < end; i++) {
    const start = contour[i], next = contour[(i + 1) % contour.length], dx = next[0] - start[0], dy = next[1] - start[1];
    const distance = Math.hypot(dx, dy);
    if (distance <= 1e-8) continue;
    segments.push({ start, dx, dy, length: distance });
    length += distance;
  }
  const result: { position: Point; tangent: number }[] = [];
  let segment = 0, before = 0;
  for (let target = 0; target < length; target += spacing) {
    while (segment < segments.length - 1 && before + segments[segment].length < target) before += segments[segment++].length;
    const edge = segments[segment], t = (target - before) / edge.length;
    result.push({ position: [edge.start[0] + t * edge.dx, edge.start[1] + t * edge.dy], tangent: Math.atan2(edge.dy, edge.dx) });
  }
  return result;
}

export type EchoMark = { x: number; y: number; size: number; tangent: number; alpha: number; echo: number; time: number };
export function wordEchoMarks(params: Layer["params"], source = wordEchoSource(params)): EchoMark[] {
  const positions = source.flatMap(contour => contourSamples(contour, params.spacing as number, params.transfer === "contour"));
  const result: EchoMark[] = [];
  for (let echo = 0; echo < (params.echoCount as number); echo++) {
    const time = Math.max(0, (params.time as number) - ((params.echoCount as number) - echo - 1) * (params.echoInterval as number));
    const [radius, accent, alpha] = controlsAt(signals[params.signal as keyof typeof signals], time, params.radiusScale as number).values;
    for (let i = 0; i < positions.length; i++) {
      const { position: [x, y], tangent } = positions[i];
      const displacement = (params.signalGain as number) * accent * Math.sin(i * .41 + echo * .62) * .25;
      result.push({ x: x + echo * (params.echoOffsetX as number) - Math.sin(tangent) * displacement,
        y: y + echo * (params.echoOffsetY as number) + Math.cos(tangent) * displacement,
        tangent, size: radius * (params.baseSize as number) * (.3 + alpha * .6), alpha, echo, time });
    }
  }
  return result;
}

function ink(layer: Layer, index: number): [number, number, number] {
  return channels(layer.palette[index % layer.palette.length]);
}
export function drawImageSignalInstrument(p: Painter, layer: Layer): void {
  const q = layer.params;
  p.push();
  try {
    if (layer.technique === "weighted-image-atlas") {
      const model = weightedAtlasModel(q, layer.seed);
      const scaleX = (q.footprintW as number) / SIZE, scaleY = (q.footprintH as number) / SIZE;
      const left = (q.centerX as number) - (q.footprintW as number) / 2, top = (q.centerY as number) - (q.footprintH as number) / 2;
      if (q.showSource) {
        const sourceInk = ink(layer, 2);
        for (let i = 0; i < model.tones.length; i++) {
          if (!model.weights[i]) continue;
          p.noStroke(); p.fill(...sourceInk, Math.round(model.tones[i] * 110));
          p.circle(left + ((i % SIZE) + .5) * scaleX, top + (Math.floor(i / SIZE) + .5) * scaleY, Math.min(scaleX, scaleY) * 1.2);
        }
      }
      p.stroke(...ink(layer, 0)); p.fill(...ink(layer, 0));
      for (const [x, y] of model.points) {
        const px = left + x * scaleX, py = top + y * scaleY;
        if (q.marks === "dots") { p.noStroke(); p.circle(px, py, q.markSize as number); continue; }
        let angle = (q.markAngle as number) * Math.PI / 180;
        if (q.fieldAlignment) {
          const column = Math.min(SIZE - 2, Math.max(1, Math.floor(x)));
          const row = Math.min(SIZE - 2, Math.max(1, Math.floor(y)));
          const base = row * SIZE + column;
          angle += Math.atan2((model.tones[base + SIZE] - model.tones[base - SIZE]) / scaleY,
            (model.tones[base + 1] - model.tones[base - 1]) / scaleX);
        }
        const half = (q.markSize as number) * (q.marks === "bars" ? 1.3 : .5);
        p.strokeWeight(q.marks === "bars" ? Math.max(1, half * .38) : Math.max(.5, half * .18));
        p.line(px - half * Math.cos(angle), py - half * Math.sin(angle), px + half * Math.cos(angle), py + half * Math.sin(angle));
      }
    } else if (layer.technique === "word-echo") {
      const source = wordEchoSource(q);
      if (q.showGuide) {
        p.noFill(); p.stroke(...ink(layer, 1)); p.strokeWeight(.9);
        for (const contour of source) {
          p.beginShape();
          for (const [x, y] of contour) p.vertex(x, y);
          p.endShape(q.transfer === "contour" ? p.CLOSE : undefined);
        }
      }
      p.stroke(...ink(layer, 0)); p.fill(...ink(layer, 0));
      for (const mark of wordEchoMarks(q, source)) {
        if (q.marks === "strokes") {
          const half = mark.size * .6;
          p.strokeWeight(Math.max(.4, mark.size * .13));
          p.line(mark.x - Math.cos(mark.tangent) * half, mark.y - Math.sin(mark.tangent) * half,
            mark.x + Math.cos(mark.tangent) * half, mark.y + Math.sin(mark.tangent) * half);
        } else if (q.marks === "rings") {
          p.noFill(); p.strokeWeight(Math.max(.5, mark.size * .12)); p.circle(mark.x, mark.y, mark.size);
        } else { p.noStroke(); p.circle(mark.x, mark.y, mark.size); }
      }
      if (q.showWaveform) {
        const samples = signals[q.signal as keyof typeof signals].samples;
        p.noFill(); p.stroke(...ink(layer, 2)); p.strokeWeight(1);
        p.beginShape();
        for (let i = 0; i < samples.length; i++) p.vertex((q.centerX as number) - 80 + i * 160 / (samples.length - 1),
          (q.centerY as number) + (q.pathRadius as number) + 30 - samples[i][0] * 45);
        p.endShape();
      }
    } else throw new Error(`Unknown image/signal instrument: ${layer.technique}`);
  } finally { p.pop(); }
}
