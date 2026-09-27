import { chaikinPolyline2D, gradientNoise2D01, simplifyPolyline2D } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { Layer } from "../types.js";

type Point = [number, number];
type Params = Layer["params"];
type Study = "flowing-brushes" | "contour-abstraction" | "gesture-skeletons";
type PathPainter = {
  ROUND: unknown;
  noFill(): void;
  noStroke(): void;
  strokeCap(cap: unknown): void;
  strokeWeight(weight: number): void;
  stroke(red: number, green: number, blue: number, alpha: number): void;
  fill(red: number, green: number, blue: number, alpha: number): void;
  beginShape(): void;
  vertex(x: number, y: number): void;
  endShape(): void;
  circle(x: number, y: number, diameter: number): void;
};
const WORK_LIMIT = 200_000;
const COUNT_KEYS: Record<Study, "rows" | "layers" | "gestures"> = {
  "flowing-brushes": "rows",
  "contour-abstraction": "layers",
  "gesture-skeletons": "gestures",
};
const value = (params: Params, key: string) => Number(params[key]);

function checked(params: Params, key: string, min: number, max: number, integer = false): number {
  const entry = params[key];
  if (typeof entry !== "number" || !Number.isFinite(entry) || entry < min || entry > max ||
      (integer && !Number.isSafeInteger(entry)))
    throw new Error(`${key} must be ${integer ? "an integer" : "a finite number"} in [${min}, ${max}]`);
  return entry;
}

export function validatePathGestures(id: Study, params: Params): void {
  
  const count = checked(params, COUNT_KEYS[id], 1, 1000, true);
  const points = checked(params, "sourcePoints", 2, 1000, true);
  checked(params, "sourceSpan", 0, 10000);
  checked(params, "amplitude", -10000, 10000);
  checked(params, "forwardBend", -10000, 10000);
  checked(params, "frequency", -1000, 1000);
  checked(params, "disorder", 0, 1);
  checked(params, "direction", -1_000_000, 1_000_000);
  checked(params, "sourceCenterX", -10000, 10000);
  checked(params, "sourceCenterY", -10000, 10000);
  checked(params, "spacing", -10000, 10000);
  checked(params, "variation", 0, 10000);
  checked(params, "weight", 0, 100);
  checked(params, "nodeSize", 0, 1000);
  if (typeof params.showNodes !== "boolean") throw new Error("showNodes must be boolean");
  if (id === "flowing-brushes") {
    const passes = checked(params, "iterations", 0, 16, true);
    // Chaikin reads each successive array and returns a fresh refined path; include
    // generation, drawing, and optional source-node drawing for every copy.
    const expanded = points * 2 ** passes;
    if (!Number.isSafeInteger(expanded) || count * (points * (2 ** (passes + 1) - 1) + expanded + points) > WORK_LIMIT)
      throw new Error("Path source points × smoothing expansion × copies exceeds generation budget");
  } else {
    checked(params, "tolerance", 0, 10000);
    // Simplification is quadratic in source points in its documented worst case.
    if (count * (points ** 2 + 2 * points) > WORK_LIMIT)
      throw new Error("Path source points × simplification worst case × copies exceeds generation budget");
  }
}

/** Replaceable input geometry shared by all three operations; independent of palette and treatment. */
export function sourcePaths(id: Study, params: Params, seed: number): Point[][] {
  validatePathGestures(id, params);
  const count = value(params, COUNT_KEYS[id]), points = value(params, "sourcePoints");
  const angle = value(params, "direction") * Math.PI / 180;
  const alongX = Math.cos(angle), alongY = Math.sin(angle);
  const normalX = -alongY, normalY = alongX;
  const span = value(params, "sourceSpan"), amp = value(params, "amplitude");
  const frequency = value(params, "frequency"), disorder = value(params, "disorder");
  const variation = value(params, "variation");
  const forwardBend = value(params, "forwardBend");
  const phase = new JavaRandom(seed).nextDouble() * 2 * Math.PI;
  const sharedNoise = disorder > 0 ? gradientNoise2D01({ seed: seed >>> 0 }) : null;
  const paths: Point[][] = [];
  for (let i = 0; i < count; i++) {
    // Each gesture owns its own random stream even with zero placement variation;
    // other studies can precisely register repeated contours when variation is zero.
    const independent = id === "gesture-skeletons";
    const random = new JavaRandom((seed + Math.imul(i + 1, 0x9e3779b9)) >>> 0);
    const shiftX = (random.nextDouble() * 2 - 1) * variation;
    const shiftY = (random.nextDouble() * 2 - 1) * variation;
    const localPhase = phase + (independent ? random.nextDouble() * 2 * Math.PI :
      id === "contour-abstraction" ? 0 : (random.nextDouble() * 2 - 1) * variation / 80 * 2 * Math.PI);
    const noise = disorder === 0 ? null : independent
      ? gradientNoise2D01({ seed: (seed + Math.imul(i + 1, 0x9e3779b9)) >>> 0 })
      : sharedNoise;
    const noiseShift = independent ? random.nextDouble() * 50 :
      id === "contour-abstraction" ? 0 : variation * random.nextDouble() / 80;
    const offset = (i - (count - 1) / 2) * value(params, "spacing");
    const cx = value(params, "sourceCenterX") + normalX * offset + shiftX;
    const cy = value(params, "sourceCenterY") + normalY * offset + shiftY;
    const path: Point[] = [];
    for (let j = 0; j < points; j++) {
      const t = j / (points - 1);
      const wave = disorder === 1 ? 0 : Math.sin(2 * Math.PI * frequency * t + localPhase);
      const turbulence = noise
        ? (noise.sample(2 * frequency * t + noiseShift + 11.5, 5.25 + noiseShift) - .5) * 2
        : 0;
      const across = amp * ((1 - disorder) * wave + disorder * turbulence);
      const forwardWave = disorder === 1 ? 0 : Math.cos(2 * Math.PI * frequency * t + localPhase);
      const forwardNoise = noise && forwardBend !== 0
        ? (noise.sample(2 * frequency * t + noiseShift + 37.5, 19.25 + noiseShift) - .5) * 2
        : 0;
      const forward = (t - .5) * span + forwardBend *
        ((1 - disorder) * forwardWave + disorder * forwardNoise);
      path.push([cx + forward * alongX + across * normalX,
        cy + forward * alongY + across * normalY]);
    }
    paths.push(path);
  }
  return paths;
}

function stroke(p: PathPainter, layer: Layer, index: number, alpha: number): void {
  const color = layer.palette[index % layer.palette.length] >>> 0;
  p.stroke((color >>> 16) & 255, (color >>> 8) & 255, color & 255, alpha);
}
function drawLine(p: PathPainter, points: Point[]): void {
  p.beginShape();
  for (const [x, y] of points) p.vertex(x, y);
  p.endShape();
}
function nodes(p: PathPainter, layer: Layer, points: Point[], index: number): void {
  if (!layer.params.showNodes || value(layer.params, "nodeSize") === 0) return;
  p.noStroke();
  const color = layer.palette[index % layer.palette.length] >>> 0;
  p.fill((color >>> 16) & 255, (color >>> 8) & 255, color & 255, 210);
  for (const [x, y] of points) p.circle(x, y, value(layer.params, "nodeSize"));
  p.noFill();
}

export function drawPathGestures(p: PathPainter, layer: Layer): void {
  const id = layer.technique as Study, params = layer.params;
  if (value(params, "weight") === 0 && (!params.showNodes || value(params, "nodeSize") === 0)) {
    validatePathGestures(id, params);
    return;
  }
  const paths = sourcePaths(id, params, layer.seed);
  p.noFill();
  p.strokeCap(p.ROUND);
  p.strokeWeight(value(params, "weight"));
  paths.forEach((source, i) => {
    if (id === "flowing-brushes") {
      if (value(params, "weight") > 0) {
        const passes = value(params, "iterations");
        const refined = chaikinPolyline2D({ points: source, closed: false, iterations: passes,
          maxWork: source.length * (2 ** (passes + 1) - 1) }).points as Point[];
        stroke(p, layer, i, 185);
        drawLine(p, refined);
      }
      nodes(p, layer, source, i);
    } else {
      const tolerance = value(params, "tolerance") *
        (id === "contour-abstraction" ? (paths.length - i) / paths.length : 1);
      const reduced = simplifyPolyline2D({ points: source, tolerance,
        maxWork: source.length ** 2 }).points as Point[];
      if (value(params, "weight") > 0) { stroke(p, layer, i, 190); drawLine(p, reduced); }
      nodes(p, layer, reduced, i);
    }
  });
}
