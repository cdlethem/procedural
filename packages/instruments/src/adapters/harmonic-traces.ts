import { resamplePolyline2D } from "@procedurals/javascript";
import type { Layer } from "../types.js";
import { channels, choice, numeric, text, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
type Point = [number, number];
type Oscillator = { axis: "x" | "y"; amplitude: number; frequency: number; phase: number; decay: number };
type Painter = {
  ROUND: unknown;
  noFill(): void; noStroke(): void; strokeCap(cap: unknown): void;
  strokeWeight(weight: number): void;
  stroke(r: number, g: number, b: number, alpha: number): void;
  fill(r: number, g: number, b: number, alpha: number): void;
  beginShape(): void; vertex(x: number, y: number): void; endShape(): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  circle(x: number, y: number, diameter: number): void;
};
const radians = Math.PI / 180;
const numberControl = (key: string, label: string, tip: string, low: number, high: number,
  hardLow: number, hardHigh: number, step = 1, integer = false) =>
  numeric(key, label, tip, low, high, step, { hardMin: hardLow, hardMax: hardHigh, integer });
const defaultTerms = "x, 160, 3, 0, 0\ny, 160, 2, 90, 0\nx, 40, 7, 30, 0\ny, 40, 5, -20, 0";

export const harmonicTraceDefinitions: StudioDefinition[] = [{
  id: "harmonic-traces", title: "Harmonic traces",
  description: "Editable sums of decaying axis oscillators sampled as ordered parametric curves.",
  parameters: [
    text("terms", "Oscillator terms", "One axis, amplitude, frequency, phase degrees, decay per line, comma-separated.", 2048, true),
    numberControl("timeStart", "Start time", "Absolute parameter t at the first sample.", -5, 5, -10000, 10000, .01),
    numberControl("duration", "Duration", "Positive span of parameter t; decay starts at zero here.", .2, 5, .001, 1000, .01),
    numberControl("samples", "Samples per trace", "Includes both endpoints; at least eight samples per fastest cycle.", 100, 3000, 2, 20000, 1, true),
    numberControl("traces", "Phase traces", "Ordered copies, each phase-shifted from the oscillator sum.", 1, 12, 1, 32, 1, true),
    numberControl("phaseStride", "Phase stride", "Degrees added to every term's phase for each next trace.", -90, 90, -36000, 36000, .5),
    numberControl("centerX", "Center X", "Local origin in canvas units; no fit-to-page operation.", 0, 640, -10000, 10000),
    numberControl("centerY", "Center Y", "Local origin in canvas units.", 0, 640, -10000, 10000),
    numberControl("rotation", "Source rotation", "Rotation of both summed axes about the source origin, degrees.", -180, 180, -3600, 3600),
    choice("material", "Material", "Ordered line, equidistant dots, or perpendicular stitches.", ["line", "dots", "normal-stitches"]),
    numberControl("spacing", "Material spacing", "Approximate arc-length distance between dots or stitches.", 3, 30, .5, 1000, .5),
    numberControl("markSize", "Mark size", "Dot diameter or normal stitch length; zero hides sampled marks.", 0, 18, 0, 300, .5),
    numberControl("weight", "Stroke weight", "Line and stitch width; zero hides strokes, not dots.", 0, 5, 0, 80, .1),
  ],
  defaults: { terms: defaultTerms, timeStart: 0, duration: 1, samples: 1300, traces: 3, phaseStride: 18,
    centerX: 320, centerY: 320, rotation: 0, material: "line", spacing: 10, markSize: 7, weight: 1.3 },
  validate: validateHarmonicTraces,
}];

function finite(q: Params, key: string, low: number, high: number, integer = false): number {
  const value = q[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high ||
      (integer && !Number.isSafeInteger(value)))
    throw new Error(`${key} must be ${integer ? "an integer" : "a finite number"} in [${low}, ${high}]`);
  return value;
}
function parseTerms(value: Params["terms"]): Oscillator[] {
  if (typeof value !== "string" || value.length > 2048) throw new Error("terms must be text of at most 2048 characters");
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 1 || lines.length > 12) throw new Error("terms must contain 1 to 12 oscillator lines");
  const terms: Oscillator[] = [];
  for (const [index, line] of lines.entries()) {
    const parts = line.split(",").map(part => part.trim());
    if (parts.length !== 5 || (parts[0] !== "x" && parts[0] !== "y") ||
        parts.slice(1).some(part => !part || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(part)))
      throw new Error(`term ${index + 1} must be axis x/y, amplitude, frequency, phase, decay`);
    const [amplitude, frequency, phase, decay] = parts.slice(1).map(Number);
    if (!Number.isFinite(amplitude) || Math.abs(amplitude) > 3000 || !Number.isFinite(frequency) ||
        Math.abs(frequency) > 200 || !Number.isFinite(phase) || Math.abs(phase) > 36000 ||
        !Number.isFinite(decay) || decay < 0 || decay > 20)
      throw new Error(`term ${index + 1}: |amplitude| <= 3000, |frequency| <= 200, |phase| <= 36000, decay in [0, 20]`);
    terms.push({ axis: parts[0] as "x" | "y", amplitude, frequency, phase: phase * radians, decay });
  }
  if (!terms.some(term => term.amplitude !== 0)) throw new Error("At least one oscillator term must have nonzero amplitude");
  return terms;
}
/** Rejects coupled limits before allocating or drawing. Lines are deliberately polygonal samples of the formula. */
export function validateHarmonicTraces(q: Params): void {
  const terms = parseTerms(q.terms);
  finite(q, "timeStart", -10000, 10000);
  const duration = finite(q, "duration", .001, 1000);
  const samples = finite(q, "samples", 2, 20000, true);
  const traces = finite(q, "traces", 1, 32, true);
  if (samples * traces > 30000) throw new Error("Samples × phase traces exceeds 30,000 vertices");
  const fastestCycles = Math.max(...terms.filter(term => term.amplitude !== 0).map(term => Math.abs(term.frequency) * duration));
  if (samples - 1 < 8 * fastestCycles)
    throw new Error("Samples require at least eight segments per fastest oscillator cycle; increase samples or shorten duration");
  for (const [key, low, high] of [["phaseStride", -36000, 36000], ["centerX", -10000, 10000],
    ["centerY", -10000, 10000], ["rotation", -3600, 3600], ["spacing", .5, 1000],
    ["markSize", 0, 300], ["weight", 0, 80]] as const) finite(q, key, low, high);
  if (!["line", "dots", "normal-stitches"].includes(String(q.material)))
    throw new Error("material must be line, dots, or normal-stitches");
}
const sourceKeys = ["terms", "timeStart", "duration", "samples", "traces", "phaseStride", "centerX", "centerY", "rotation"];
let cached: { key: string; curves: Point[][] } | undefined;
/** Retained ordered curves: trace index then time index. Material and seed cannot alter the source. */
export function harmonicTraceCurves(q: Params): Point[][] {
  validateHarmonicTraces(q);
  const key = JSON.stringify(sourceKeys.map(name => q[name]));
  if (cached?.key === key) return cached.curves;
  const terms = parseTerms(q.terms);
  const count = Number(q.samples), traces = Number(q.traces), start = Number(q.timeStart);
  const duration = Number(q.duration), stride = Number(q.phaseStride) * radians;
  const theta = Number(q.rotation) * radians, cos = Math.cos(theta), sin = Math.sin(theta);
  const cx = Number(q.centerX), cy = Number(q.centerY);
  const curves: Point[][] = [];
  for (let trace = 0; trace < traces; trace++) {
    const points: Point[] = [];
    for (let i = 0; i < count; i++) {
      const elapsed = duration * i / (count - 1), t = start + elapsed;
      let x = 0, y = 0;
      for (const term of terms) {
        const offset = term.amplitude * Math.exp(-term.decay * elapsed) *
          Math.cos(2 * Math.PI * term.frequency * t + term.phase + trace * stride);
        if (term.axis === "x") x += offset; else y += offset;
      }
      points.push([cx + x * cos - y * sin, cy + x * sin + y * cos]);
    }
    curves.push(points);
  }
  cached = { key, curves };
  return curves;
}
function stations(curve: Point[], spacing: number): number {
  let length = 0;
  for (let i = 1; i < curve.length; i++) length += Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1]);
  return length === 0 ? 1 : Math.max(2, Math.floor(length / spacing) + 1);
}
export function drawHarmonicTraces(p: Painter, layer: Layer): void {
  const q = layer.params, curves = harmonicTraceCurves(q);
  const material = q.material, weight = Number(q.weight), markSize = Number(q.markSize);
  if (material === "line" && weight === 0 || material === "normal-stitches" && (weight === 0 || markSize === 0) ||
      material === "dots" && markSize === 0) return;
  // Check aggregate arc-length station work before the first SDK resampling buffer or stroke.
  const counts = material === "line" ? [] : curves.map(curve => stations(curve, Number(q.spacing)));
  if (counts.reduce((sum, count) => sum + count, 0) > 30000)
    throw new Error("Arc-length material exceeds 30,000 stations; increase spacing");
  p.strokeCap(p.ROUND);
  curves.forEach((curve, index) => {
    const [r, g, b] = channels((layer.palette.length ? layer.palette[index % layer.palette.length] : 0x222222) >>> 0);
    if (material === "line") {
      p.noFill(); p.stroke(r, g, b, 220); p.strokeWeight(weight);
      p.beginShape(); for (const [x, y] of curve) p.vertex(x, y); p.endShape();
      return;
    }
    if (counts[index] === 1) {
      // An open SDK resample requires two stations; a stationary source is one dot with no tangent.
      if (material === "dots") { p.noStroke(); p.fill(r, g, b, 220); p.circle(curve[0][0], curve[0][1], markSize); }
      return;
    }
    const result = resamplePolyline2D({ points: curve, closed: false, count: counts[index],
      maxWork: curve.length + counts[index] });
    if (material === "dots") { p.noStroke(); p.fill(r, g, b, 220); }
    else { p.noFill(); p.stroke(r, g, b, 220); p.strokeWeight(weight); }
    result.points.forEach(([x, y], stationIndex) => {
      if (material === "dots") { p.circle(x, y, markSize); return; }
      const segment = result.sourceSegments[stationIndex];
      let dx = curve[segment + 1][0] - curve[segment][0];
      let dy = curve[segment + 1][1] - curve[segment][1];
      if (dx === 0 && dy === 0) {
        const before = result.points[Math.max(0, stationIndex - 1)];
        const after = result.points[Math.min(result.points.length - 1, stationIndex + 1)];
        dx = after[0] - before[0]; dy = after[1] - before[1];
      }
      const length = Math.hypot(dx, dy);
      if (length === 0) return;
      const nx = -dy * markSize / (2 * length), ny = dx * markSize / (2 * length);
      p.line(x - nx, y - ny, x + nx, y + ny);
    });
  });
}
