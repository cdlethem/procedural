import { gradientNoise2D01, rk4VectorGridTrace2D, scalarGridCurl2D } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { Layer } from "../types.js";

type Params = Layer["params"];
type Point = [number, number];
type CurlStudy = "swirling-particles" | "flow-needles";
type CurlPainter = {
  noFill(): void;
  strokeWeight(value: number): void;
  stroke(red: number, green: number, blue: number, alpha: number): void;
  beginShape(): void;
  vertex(x: number, y: number): void;
  endShape(): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
};
const FRAME = 576;
const ORIGIN = 32;
const PATH_GRID = 33;
// The tracer charges a complete vector-grid copy for EACH path, plus 17 units per step.
const TRACE_WORK_LIMIT = 1_000_000;

function number(params: Params, key: string, min: number, max: number, integer = false): number {
  const value = params[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max ||
      (integer && !Number.isInteger(value)))
    throw new Error(`${key} must be a finite ${integer ? "integer" : "number"} in [${min}, ${max}]`);
  return value;
}

export function validateCurlStudy(id: CurlStudy, params: Params): void {
  
  const frequency = number(params, "fieldFrequency", .01, 6);
  const anisotropy = number(params, "anisotropy", 1 / 16, 16);
  number(params, "disorder", 0, 1);
  number(params, "sourceX", -100, 100);
  number(params, "sourceY", -100, 100);
  const spread = number(params, "sourceSpread", .0001, 10000);
  number(params, "weight", 0, 100);
  const columns = id === "swirling-particles" ? PATH_GRID : number(params, "columns", 8, 128, true);
  // At least four grid samples per shortest scalar wavelength, including cropped/expanded needle views.
  const cycles = frequency * Math.max(Math.sqrt(anisotropy), 1 / Math.sqrt(anisotropy)) *
    (id === "flow-needles" ? spread : 1);
  if (cycles > (columns - 1) / 4) throw new Error("Field frequency, anisotropy and sample spacing require four samples per wavelength");
  if (id === "swirling-particles") {
    if (!["area", "ring", "line"].includes(String(params.sourceMode))) throw new Error("Unknown particle source mode");
    number(params, "sourceAngle", -360000, 360000);
    const count = number(params, "count", 1, 10000, true);
    const steps = number(params, "steps", 1, 10000, true);
    number(params, "stepSize", 0, 10000);
    if (count * (PATH_GRID * PATH_GRID + 17 * steps + 1) > TRACE_WORK_LIMIT)
      throw new Error("Particle count × (grid copy + trail integration) exceeds the tracing work budget");
  } else {
    number(params, "scale", 0, 10000);
  }
}

// Field phase and starts each have their own same-seed JavaRandom stream: changing
// particle count or mark appearance cannot consume the field's phase decisions.

export function particleStarts(params: Params, seed: number): Point[] {
  validateCurlStudy("swirling-particles", params);
  const count = Number(params.count), extent = Number(params.sourceSpread) * FRAME;
  const cx = ORIGIN + Number(params.sourceX) * FRAME;
  const cy = ORIGIN + Number(params.sourceY) * FRAME;
  const angle = Number(params.sourceAngle) * Math.PI / 180;
  const starts: Point[] = [], random = new JavaRandom(seed);
  for (let i = 0; i < count; i++) {
    const a = random.nextDouble(), b = random.nextDouble();
    if (params.sourceMode === "area") starts.push([cx + (a - .5) * extent, cy + (b - .5) * extent]);
    else if (params.sourceMode === "ring") {
      const theta = a * 2 * Math.PI, radius = extent * (.46 + .08 * b);
      starts.push([cx + radius * Math.cos(theta), cy + radius * Math.sin(theta)]);
    } else {
      const along = (a - .5) * extent, across = (b - .5) * extent * .04;
      starts.push([cx + along * Math.cos(angle) - across * Math.sin(angle),
        cy + along * Math.sin(angle) + across * Math.cos(angle)]);
    }
  }
  return starts;
}

/** A scalar potential sampled once; the portable curl operation provides every velocity. */
export function curlVectors(params: Params, seed: number, columns: number, origin: Point, spacing: Point): Point[] {
  const frequency = Number(params.fieldFrequency), stretch = Math.sqrt(Number(params.anisotropy));
  const mix = Number(params.disorder), noise = gradientNoise2D01({ seed: (seed ^ 0x632be59b) >>> 0 });
  const phase = new JavaRandom(seed), phaseX = phase.nextDouble(), phaseY = phase.nextDouble();
  const values = new Array<number>(columns * columns);
  for (let y = 0; y < columns; y++) for (let x = 0; x < columns; x++) {
    const u = (origin[0] + x * spacing[0] - ORIGIN) / FRAME;
    const v = (origin[1] + y * spacing[1] - ORIGIN) / FRAME;
    const sx = (u + phaseX) * frequency * stretch, sy = (v + phaseY) * frequency / stretch;
    const loops = Math.sin(2 * Math.PI * sx) * Math.cos(2 * Math.PI * sy);
    const turbulence = (noise.sample(sx + 12.75, sy + 9.25) - .5) * 4;
    values[y * columns + x] = (1 - mix) * loops + mix * turbulence;
  }
  const curl = scalarGridCurl2D({ values, columns, rows: columns, spacing,
    boundary: "ONE_SIDED", maxWork: 5 * columns * columns });
  return curl.vectors.map(([vx, vy]: Point): Point => [vx * 700, vy * 700]);
}

export function particleTrails(params: Params, seed: number): Point[][] {
  validateCurlStudy("swirling-particles", params);
  const spacing: Point = [FRAME / (PATH_GRID - 1), FRAME / (PATH_GRID - 1)];
  const vectors = curlVectors(params, seed, PATH_GRID, [ORIGIN, ORIGIN], spacing);
  const trails: Point[][] = [];
  for (const start of particleStarts(params, seed)) {
    const trace = rk4VectorGridTrace2D({ vectors, columns: PATH_GRID, rows: PATH_GRID,
      origin: [ORIGIN, ORIGIN], spacing, start, dt: Number(params.stepSize),
      steps: Number(params.steps), boundary: "STOP",
      maxWork: PATH_GRID * PATH_GRID + 17 * Number(params.steps) + 1 });
    // Toolkit declarations omit tuple types; the tracer contract returns [x, y] pairs.
    trails.push(trace.points as Point[]);
  }
  return trails;
}

export function needleSegments(params: Params, seed: number): [Point, Point][] {
  validateCurlStudy("flow-needles", params);
  const columns = Number(params.columns), extent = FRAME * Number(params.sourceSpread);
  const spacing: Point = [extent / (columns - 1), extent / (columns - 1)];
  const origin: Point = [ORIGIN + FRAME * Number(params.sourceX) - extent / 2,
    ORIGIN + FRAME * Number(params.sourceY) - extent / 2];
  const vectors = curlVectors(params, seed, columns, origin, spacing);
  const length = Number(params.scale), segments: [Point, Point][] = [];
  for (let i = 0; i < vectors.length; i++) {
    const [vx, vy] = vectors[i], magnitude = Math.hypot(vx, vy);
    if (magnitude < 1e-10) continue;
    const x = origin[0] + (i % columns) * spacing[0];
    const y = origin[1] + Math.floor(i / columns) * spacing[1];
    segments.push([[x, y], [x + vx / magnitude * length, y + vy / magnitude * length]]);
  }
  return segments;
}

function color(p: CurlPainter, layer: Layer, index: number): void {
  const value = layer.palette[index % layer.palette.length] >>> 0;
  p.stroke((value >>> 16) & 255, (value >>> 8) & 255, value & 255, 185);
}
export function drawCurlStudy(p: CurlPainter, layer: Layer): void {
  if (Number(layer.params.weight) === 0) return;
  p.noFill();
  p.strokeWeight(Number(layer.params.weight));
  if (layer.technique === "swirling-particles") {
    particleTrails(layer.params, layer.seed).forEach((trail, i) => {
      if (trail.length < 2) return;
      color(p, layer, i);
      p.beginShape();
      for (const [x, y] of trail) p.vertex(x, y);
      p.endShape();
    });
  } else {
    needleSegments(layer.params, layer.seed).forEach((segment, i) => {
      color(p, layer, i);
      p.line(...segment[0], ...segment[1]);
    });
  }
}
