import type { Layer } from "../studio-types";
import { defaultPalettes } from "../default-palettes";
import { weightedRasterPoints2D } from "@procedurals/javascript"
import { weightedRasterCentroids2D } from "@procedurals/javascript"
import { controlsAt, nonAudioFeatures, synthesizedFeatures } from "@procedurals/javascript/examples/word-echo/study.js"
import suppliedContours from "../../assets/word-echo-contours.json";
import { choice, numeric, toggle, channels, type StudioDefinition } from "./types";

const WIDTH = 80;
const HEIGHT = 100;
const RASTER_SIZE = WIDTH * HEIGHT;
const MODEL_LIMIT = 8;

export const imageAndControlsDefinitions: StudioDefinition[] = [
  {
    id: "weighted-image-atlas",
    title: "Weighted image atlas",
    description: "A source raster guides an editable field of dots or stitches.",
    parameters: [
      choice("source", "Source raster", "Switch between two authored density images.", ["relief", "thermal"]),
      toggle("invert", "Invert density", "Make light source areas attract marks instead of dark ones."),
      numeric("count", "Marks", "Draw this many deterministic weighted samples.", 140, 700, 20),
      toggle("relax", "Centroid step", "Move every sampled mark once toward its assigned weighted pixel center."),
      choice("marks", "Mark shape", "Draw the same positions as dots or short stitches.", ["dots", "stitches"]),
    ],
    defaults: { source: "relief", invert: false, count: 420, relax: false, marks: "dots" },
  },
  {
    id: "word-echo",
    title: "Word echo",
    description: "Recorded scalar controls animate supplied word outlines or an independent path.",
    parameters: [
      numeric("time", "Time", "Query an explicit time in the authored series.", 0, 4.875, 0.125),
      choice("word", "Word outline", "Use a supplied contour set extracted from the licensed font.", ["ECHO", "OPEN"]),
      choice("signal", "Input series", "Swap synthesized PCM-derived features for a non-audio series.", ["synth", "non-audio"]),
      choice("transfer", "Mark path", "Apply sampled controls to letter contours or a spiral path.", ["contour", "path"]),
      numeric("spacing", "Mark spacing", "Use every nth supplied contour or spiral sample.", 2, 8, 1),
      numeric("radiusScale", "Mark scale", "Scale mark radius independently of the input series.", 0.5, 1.5, 0.25),
    ],
    defaults: { time: 0, word: "ECHO", signal: "synth", transfer: "contour", spacing: 3, radiusScale: 1 },
  },
];

export function imageAndControlsPalette(id: string): number[] | null {
  const paletteId = ({ "weighted-image-atlas": "copper-patina", "word-echo": "fern-mauve" } as Record<string, string>)[id];
  if (!paletteId) return null;
  const palette = defaultPalettes.find((item) => item.id === paletteId);
  return palette ? palette.colors.map((hex) => Number.parseInt(hex.slice(1), 16)) : null;
}

type WeightedParams = {
  source: "relief" | "thermal";
  invert: boolean;
  count: number;
  relax: boolean;
};
type WeightedModel = {
  tones: number[];
  weights: number[];
  sampled: number[][];
  points: number[][];
  pixelIndices: number[];
  masses: number[] | null;
  rngState: number;
};
const models = new Map<string, WeightedModel>();
const clamp = (value: number) => Math.max(0, Math.min(1, value));

// These two raster fields are the ordinary authored source-image composition in
// packages/javascript/examples/weighted-image-atlas/sketch.js. The package
// operations consume only the resulting explicit integer pixel masses.
function toneAt(source: WeightedParams["source"], x: number, y: number): number {
  if (source === "relief") {
    const ridge = 0.42 + 0.17 * Math.sin(9 * y) + 0.05 * Math.sin(27 * y);
    const crest = Math.exp(-Math.pow((x - ridge) / 0.15, 2));
    const shoulder = 0.6 * Math.exp(-Math.pow((x - 0.78) / 0.2, 2) - Math.pow((y - 0.25) / 0.28, 2));
    const basin = 0.5 * Math.exp(-Math.pow((x - 0.23) / 0.11, 2) - Math.pow((y - 0.7) / 0.19, 2));
    return clamp(0.08 + 0.65 * crest + shoulder - basin);
  }
  const plumeA = Math.exp(-Math.pow((x - 0.23) / 0.18, 2) - Math.pow((y - 0.25) / 0.25, 2));
  const plumeB = 0.85 * Math.exp(-Math.pow((x - 0.73) / 0.16, 2) - Math.pow((y - 0.68) / 0.2, 2));
  const bridge = 0.3 * Math.exp(-Math.pow((y - (0.58 - 0.22 * x)) / 0.09, 2));
  return clamp(0.04 + plumeA + plumeB + bridge);
}

/** App-private deterministic model; palette and mark treatment are drawing-only. */
export function weightedImageModel(params: WeightedParams): WeightedModel {
  const key = `${params.source}:${params.invert}:${params.count}:${params.relax}`;
  const existing = models.get(key);
  if (existing) {
    models.delete(key);
    models.set(key, existing);
    return existing;
  }
  const tones = new Array<number>(RASTER_SIZE);
  const weights = new Array<number>(RASTER_SIZE);
  for (let row = 0; row < HEIGHT; row += 1) for (let column = 0; column < WIDTH; column += 1) {
    const index = row * WIDTH + column;
    const tone = toneAt(params.source, (column + 0.5) / WIDTH, (row + 0.5) / HEIGHT);
    tones[index] = tone;
    weights[index] = Math.round(1200 * Math.max(0, ((params.invert ? 1 - tone : tone) - 0.12) / 0.88));
  }
  const sampled = weightedRasterPoints2D({
    width: WIDTH, height: HEIGHT, weights, count: params.count,
    rngState: 20260917, maxWork: 10_000_000,
  });
  const moved = params.relax
    ? weightedRasterCentroids2D({ width: WIDTH, height: HEIGHT, weights, sites: sampled.points, maxWork: 12_000_000 })
    : null;
  const model: WeightedModel = {
    tones, weights, sampled: sampled.points, points: moved?.sites ?? sampled.points,
    pixelIndices: sampled.pixelIndices, masses: moved?.masses ?? null, rngState: sampled.rngState,
  };
  models.set(key, model);
  if (models.size > MODEL_LIMIT) models.delete(models.keys().next().value!);
  return model;
}

const color = (layer: Layer, index: number) => channels(layer.palette[index % layer.palette.length]);

export function drawImageAndControls(p: any, layer: Layer): void {
  if (layer.technique === "word-echo") return drawWordEcho(p, layer);
  if (layer.technique !== "weighted-image-atlas") throw new Error(`Unknown image/control technique: ${String(layer.technique)}`);
  const params = layer.params as WeightedParams & { marks: "dots" | "stitches" };
  const model = weightedImageModel(params);
  p.push();
  p.noStroke();
  p.fill(...color(layer, 0));
  p.textSize(20);
  p.text("IMAGE MASS / EDITABLE MARKS", 38, 47);
  p.textSize(12);
  p.text(`SOURCE / ${params.source.toUpperCase()}`, 42, 101);
  p.text("WEIGHTED POSITIONS", 351, 101);
  p.stroke(...color(layer, 2));
  p.strokeWeight(1);
  p.noFill();
  p.rect(39, 117, 259, 335);
  p.rect(344, 117, 259, 335);
  const image = p.createImage(WIDTH, HEIGHT);
  image.loadPixels();
  for (let index = 0; index < RASTER_SIZE; index += 1) {
    const shade = Math.round(242 - 179 * model.tones[index]);
    const pixel = index * 4;
    image.pixels[pixel] = shade;
    image.pixels[pixel + 1] = shade + (params.source === "thermal" ? 0 : 3);
    image.pixels[pixel + 2] = shade + (params.source === "thermal" ? 2 : 5);
    image.pixels[pixel + 3] = 255;
  }
  image.updatePixels();
  p.noStroke();
  // The source image is real raster content. The result panel is marks over
  // transparent layer space so lower Studio layers remain visible between them.
  p.image(image, 40, 118, 257, 333);
  p.stroke(...color(layer, 3));
  p.fill(...color(layer, 0));
  for (const [x, y] of model.points) {
    const px = 345 + x * 257 / WIDTH;
    const py = 118 + y * 333 / HEIGHT;
    if (params.marks === "stitches") {
      p.strokeWeight(1.45);
      p.line(px - 3.5, py + 2.6, px + 3.5, py - 2.6);
    } else {
      p.noStroke();
      p.circle(px, py, 3.8);
    }
  }
  p.noStroke();
  p.fill(...color(layer, 0));
  p.textSize(12);
  p.text(params.invert ? "LIGHT AREAS ATTRACT MARKS" : "DARK AREAS ATTRACT MARKS", 42, 490);
  p.text(`${params.count} ${params.marks} / ${params.relax ? "ONE CENTROID STEP" : "WEIGHTED SAMPLE"}`, 350, 490);
  p.text("Source raster and mark shape remain independently editable.", 42, 532);
  p.pop();
}

type Word = "ECHO" | "OPEN";
type WordParams = {
  time: number;
  word: Word;
  signal: "synth" | "non-audio";
  transfer: "contour" | "path";
  spacing: number;
  radiusScale: number;
};
const wordSignals = { synth: synthesizedFeatures(), "non-audio": nonAudioFeatures() };

/** Fixed, real p5-extracted contours; the caller receives a detached copy. */
export function wordEchoContours(word: Word): number[][][] {
  if (!(word in suppliedContours.contours)) throw new Error("WORD_OUTLINE_UNAVAILABLE");
  return suppliedContours.contours[word].map((contour) => contour.map((point) => [...point]));
}

/** The same ordered sampleRecordedControls mapping used by the native study. */
export function wordEchoControlsAt(signal: WordParams["signal"], time: number, radiusScale: number): number[] {
  return controlsAt(wordSignals[signal], time, radiusScale).values;
}

function drawWordEcho(p: any, layer: Layer): void {
  const q = layer.params as WordParams;
  const contours = suppliedContours.contours[q.word];
  if (!contours?.length) throw new Error("WORD_OUTLINE_UNAVAILABLE");
  const ink = color(layer, 0), mark = color(layer, 3), soft = color(layer, 4);
  p.push();
  p.noStroke();
  p.fill(...ink);
  p.textSize(18);
  p.text(`WORD / ${q.word}`, 44, 47);
  p.textSize(11);
  p.text(q.signal === "synth" ? "SYNTH PCM / RMS" : "NON-AUDIO SERIES", 432, 47);
  p.stroke(...ink);
  p.strokeWeight(1);
  p.line(44, 64, 596, 64);
  p.noStroke();
  p.fill(...mark);
  p.text(q.transfer === "contour" ? "SUPPLIED GLYPH CONTOURS" : "INDEPENDENT SPIRAL PATH", 44, 97);
  for (let layerIndex = 0; layerIndex < 5; layerIndex += 1) {
    const time = Math.max(0, q.time - (4 - layerIndex) * 0.125);
    const [radius, accent, alpha] = wordEchoControlsAt(q.signal, time, q.radiusScale);
    if (q.transfer === "path") {
      p.noFill(); p.stroke(...soft); p.strokeWeight(0.7 + alpha);
      p.beginShape();
      for (let i = 0; i < 80; i += 1) {
        const t = i / 79, a = 2 * Math.PI * (2.3 * t + layerIndex * 0.11), radial = 42 + 205 * t;
        p.vertex(320 + Math.cos(a) * radial, 278 + Math.sin(a) * radial * 0.52);
      }
      p.endShape();
      p.noStroke(); p.fill(...mark);
      for (let i = 0; i < 80; i += q.spacing) {
        const t = i / 79, a = 2 * Math.PI * (2.3 * t + layerIndex * 0.11), radial = 42 + 205 * t;
        p.circle(320 + Math.cos(a) * radial, 278 + Math.sin(a) * radial * 0.52, Math.max(1, radius * (0.5 + t) * (0.3 + alpha)));
      }
      p.stroke(...soft); p.strokeWeight(1); p.line(55, 410 + accent, 580, 410 + accent);
    } else {
      p.push(); p.translate((layerIndex - 2) * accent * 0.38, (2 - layerIndex) * accent * 0.25);
      p.noFill(); p.stroke(...ink); p.strokeWeight(0.8 + alpha * 0.65);
      for (const contour of contours) {
        if (contour.length < 2) continue;
        p.beginShape(); for (const [x, y] of contour) p.vertex(x, y); p.endShape(p.CLOSE);
      }
      p.noStroke(); p.fill(...(layerIndex % 2 ? soft : mark));
      for (const contour of contours) for (let i = 0; i < contour.length; i += q.spacing) {
        const [x, y] = contour[i], oscillation = Math.sin(i * 0.071 + layerIndex * 0.4);
        p.circle(x + oscillation * accent * 0.22, y + oscillation * accent * 0.18, Math.max(1, radius * (0.3 + alpha * 0.6)));
      }
      p.pop();
    }
  }
  const samples = wordSignals[q.signal].samples;
  p.stroke(...ink); p.strokeWeight(1); p.line(44, 440, 596, 440);
  p.noFill(); p.stroke(...mark); p.strokeWeight(2); p.beginShape();
  for (let i = 0; i < samples.length; i += 1) p.vertex(50 + i * 13.8, 555 - samples[i][0] * 125);
  p.endShape();
  p.noStroke(); p.fill(...ink); p.textSize(11);
  p.text(`TIME ${q.time.toFixed(3)}s`, 44, 585);
  p.text(`INPUT ${q.signal.toUpperCase()}`, 245, 585);
  p.text(`MARKS ${q.transfer.toUpperCase()}`, 448, 585);
  p.pop();
}
