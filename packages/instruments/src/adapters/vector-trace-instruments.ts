import { offsetPolyline2D, resamplePolyline2D, rk4VectorGridTrace2D } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { ControlGroup, Layer, Parameter } from "../types.js";
import { channels, choice, numeric, toggle, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
type Point = [number, number];
type Layout = "line" | "ring" | "area" | "grid";
type Id = "stream-ribbons" | "curved-trajectories";
type Painter = {
  CLOSE: unknown;
  noFill(): void; noStroke(): void;
  stroke(r: number, g: number, b: number, alpha: number): void;
  fill(r: number, g: number, b: number, alpha: number): void;
  strokeWeight(width: number): void;
  beginShape(): void; vertex(x: number, y: number): void; endShape(mode?: unknown): void;
  circle(x: number, y: number, diameter: number): void;
};
const num = (key: string, label: string, description: string, min: number, max: number,
  hardMin: number, hardMax: number, step = 1, integer = false): Parameter =>
  numeric(key, label, description, min, max, step, { hardMin, hardMax, integer });

const parameters: Parameter[] = [choice("sourceLayout", "Vector source arrangement", "Independent radial/rotational source centers: line, ring, area or grid.", ["line", "ring", "area", "grid"]),
  num("sourceCount", "Vector sources", "Number of radial/rotational centers; zero leaves pure uniform drift.", 0, 12, 0, 32, 1, true),
  num("sourceX", "Vector center X", "Center of the vector-source population in canvas units.", 0, 640, -2000, 2000),
  num("sourceY", "Vector center Y", "Center of the vector-source population in canvas units.", 0, 640, -2000, 2000),
  num("sourceExtent", "Source extent", "Population diameter, without page fitting.", 0, 480, 0, 2000),
  num("sourceAspect", "Source aspect", "Y extent divided by X extent before rotating the population.", .2, 2, .01, 10, .05),
  num("sourceAngle", "Source angle", "Population line/grid orientation in degrees.", -180, 180, -3600, 3600),
  num("sourceDisorder", "Source disorder", "Seeded source-center displacement as a fraction of inter-source spacing; zero is ordered and seed-independent.", 0, .8, 0, 1, .05),
  num("sourceRadius", "Influence radius", "Gaussian influence falloff in canvas units: smaller radius means finer spatial variation.", 25, 300, 1, 2000),
  num("rotation", "Rotational velocity", "Signed tangential source velocity in canvas units per integration time.", -24, 24, -100, 100, .25),
  num("radial", "Radial velocity", "Signed outward source velocity; negative values attract inward.", -24, 24, -100, 100, .25),
  num("driftX", "Horizontal drift", "Uniform vector component in canvas units per integration time.", -16, 16, -100, 100, .25),
  num("driftY", "Vertical drift", "Uniform vector component in canvas units per integration time.", -16, 16, -100, 100, .25),
  num("gridColumns", "Vector grid samples", "Square grid resolution; each RK4 trace copies the entire grid.", 17, 65, 2, 129, 1, true),
  num("fieldX", "Field center X", "Center of the sampled velocity grid; independent of source and start centers.", 0, 640, -2000, 2000),
  num("fieldY", "Field center Y", "Center of the sampled velocity grid.", 0, 640, -2000, 2000),
  num("fieldExtent", "Field extent", "Width/height of the square RK4 domain; STOP ends traces at its edge.", 400, 1000, 1, 4000),
  choice("startLayout", "Trace start arrangement", "Place starts separately from vector-field sources.", ["line", "ring", "area", "grid"]),
  num("startCount", "Trace starts", "Number of trajectories independently integrated from the start arrangement.", 2, 50, 1, 200, 1, true),
  num("startX", "Start center X", "Independent canvas-space center of trace starting positions.", 0, 640, -2000, 2000),
  num("startY", "Start center Y", "Independent canvas-space center of trace starting positions.", 0, 640, -2000, 2000),
  num("startExtent", "Start extent", "Trace-start population diameter; zero superimposes all starts.", 0, 480, 0, 2000),
  num("startAspect", "Start aspect", "Y extent divided by X extent before rotation.", .2, 2, .01, 10, .05),
  num("startAngle", "Start angle", "Start line/grid orientation in degrees.", -180, 180, -3600, 3600),
  num("startDisorder", "Start disorder", "Seeded start displacement as a fraction of inter-start spacing.", 0, .8, 0, 1, .05),
  num("steps", "Integration steps", "RK4 steps per trace; startCount × steps cannot exceed 30000 segments.", 1, 180, 0, 1000, 1, true),
  num("timeStep", "Integration time step", "Time per RK4 step; zero holds traces at their starting positions.", .1, 2, 0, 10, .05),
  toggle("showLine", "Centerlines", "Draw the unmodified trajectories as thin strokes."),
  toggle("showRibbon", "Filled ribbons", "Offset actual traced polylines on both sides; does not alter advection."),
  toggle("showStations", "Stations", "Uniform arc-distance marks along the traced polylines."),
  num("weight", "Line weight", "Centerline stroke width; zero omits the line.", 0, 6, 0, 100, .25),
  num("ribbonWidth", "Ribbon width", "Full width of the filled offset strip, independent of trace geometry.", 0, 26, 0, 100),
  num("stationSize", "Station diameter", "Diameter of equal-arc-distance dots; zero omits dots.", 0, 13, 0, 100),
  num("stationStride", "Station stride", "One station per approximately this many traced steps, resampled by arc length.", 2, 25, 1, 1000, 1, true)];
const controlGroups: ControlGroup[] = [
  { label: "Vector sources", stage: "form", controls: ["sourceLayout", "sourceCount", "sourceX", "sourceY", "sourceExtent", "sourceAspect", "sourceAngle", "sourceDisorder"] },
  { label: "Flow", stage: "process", controls: ["sourceRadius", "rotation", "radial", { label: "Drift", controls: ["driftX", "driftY"] }] },
  { label: "Velocity grid", stage: "process", controls: ["gridColumns", "fieldX", "fieldY", "fieldExtent"] },
  { label: "Trace starts", stage: "form", controls: ["startLayout", "startCount", "startX", "startY", "startExtent", "startAspect", "startAngle", "startDisorder"] },
  { label: "Integration", stage: "process", controls: ["steps", "timeStep"] },
  { label: "Drawing", stage: "material", controls: [
    { label: "Centerline", controls: ["showLine", "weight"] },
    { label: "Ribbon", controls: ["showRibbon", "ribbonWidth"] },
    { label: "Stations", controls: ["showStations", "stationSize", "stationStride"] },
  ] },
];
const defaults = {sourceLayout: "line",
  sourceCount: 3,
  sourceX: 320,
  sourceY: 315,
  sourceExtent: 360,
  sourceAspect: .6,
  sourceAngle: 55,
  sourceDisorder: .2,
  sourceRadius: 165,
  rotation: 15,
  radial: -4,
  driftX: 4,
  driftY: -1.5,
  gridColumns: 41,
  fieldX: 320,
  fieldY: 320,
  fieldExtent: 720,
  startLayout: "line",
  startCount: 18,
  startX: 200,
  startY: 370,
  startExtent: 380,
  startAspect: 1,
  startAngle: 78,
  startDisorder: .06,
  steps: 42,
  timeStep: .85,
  showLine: true,
  showRibbon: true,
  showStations: false,
  weight: 2,
  ribbonWidth: 8,
  stationSize: 5,
  stationStride: 7};
export const vectorTraceInstrumentDefinitions: StudioDefinition[] = [
  { id: "stream-ribbons", title: "Stream ribbons", description: "RK4 traces through an editable mixture of uniform drift and seeded radial/rotational sources, with independent ribbons, lines and stations.",
  procedure: "Three sources spin and push the space around them while a steady drift carries everything sideways. Traces released along a line are integrated through that current, and each path is drawn as a filled ribbon.",
    parameters, controlGroups, defaults, validate: q => validateVectorTraceInstrument("stream-ribbons", q) },
  { id: "curved-trajectories", title: "Curved trajectories", description: "The same explicit vector mixture and RK4 tracing with a different start geometry and sparse station material.",
  procedure: "Four sources set in a ring spin the space around them and draw it inward. Traces released from a squashed ring are carried through the current, and each path is drawn as a line beaded at even distances.",
    parameters, controlGroups, defaults: { ...defaults, sourceLayout: "ring", sourceCount: 4, sourceExtent: 260, sourceAngle: 0,
      sourceDisorder: 0, radial: -8, rotation: 18, driftX: 1.5, driftY: 2,
      startLayout: "ring", startX: 315, startY: 330, startExtent: 350, startAspect: .7,
      startAngle: 0, startDisorder: .12, startCount: 16, steps: 72, timeStep: .65,
      showRibbon: false, showStations: true, weight: 1.5, ribbonWidth: 6, stationSize: 5, stationStride: 9 },
    validate: q => validateVectorTraceInstrument("curved-trajectories", q) },
];
function checked(q: Params, key: string, min: number, max: number, integer = false): number {
  const v = q[key];
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isSafeInteger(v)))
    throw new Error(`${key} must be ${integer ? "an integer" : "a finite number"} in [${min}, ${max}]`);
  return v;
}
function layout(q: Params, key: string): Layout {
  const value = q[key];
  if (value === "line" || value === "ring" || value === "area" || value === "grid") return value;
  throw new Error(`${key} must be line, ring, area or grid`);
}
export function validateVectorTraceInstrument(_id: Id, q: Params): void {
  
  layout(q, "sourceLayout"); layout(q, "startLayout");
  checked(q, "sourceCount", 0, 32, true); checked(q, "startCount", 1, 200, true);
  for (const key of ["sourceX", "sourceY", "startX", "startY", "fieldX", "fieldY"])
    checked(q, key, -2000, 2000);
  for (const key of ["sourceExtent", "startExtent"]) checked(q, key, 0, 2000);
  for (const key of ["sourceAspect", "startAspect"]) checked(q, key, .01, 10);
  for (const key of ["sourceAngle", "startAngle"]) checked(q, key, -3600, 3600);
  for (const key of ["sourceDisorder", "startDisorder"]) checked(q, key, 0, 1);
  checked(q, "sourceRadius", 1, 2000);
  for (const key of ["rotation", "radial", "driftX", "driftY"]) checked(q, key, -100, 100);
  const columns = checked(q, "gridColumns", 2, 129, true);
  checked(q, "fieldExtent", 1, 4000);
  const count = checked(q, "startCount", 1, 200, true);
  const steps = checked(q, "steps", 0, 1000, true);
  checked(q, "timeStep", 0, 10);
  checked(q, "weight", 0, 100); checked(q, "ribbonWidth", 0, 100);
  checked(q, "stationSize", 0, 100); checked(q, "stationStride", 1, 1000, true);
  for (const key of ["showLine", "showRibbon", "showStations"])
    if (typeof q[key] !== "boolean") throw new Error(`${key} must be boolean`);
  if (count * steps > 30000) throw new Error("startCount × steps exceeds 30000 trace segments");
  // The released tracer copies every grid vector per trace and charges 17 units per RK4 step.
  if (count * (columns * columns + 17 * steps + 1) > 1_000_000)
    throw new Error("startCount × (gridColumns² + 17 × steps + 1) exceeds 1000000 RK4 work units");
}
function positions(mode: Layout, count: number, x: number, y: number, extent: number,
  aspect: number, angle: number, disorder: number, random: JavaRandom): Point[] {
  const result: Point[] = [], theta = angle * Math.PI / 180;
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const columns = Math.max(1, Math.ceil(Math.sqrt(count / aspect)));
  const rows = Math.ceil(count / columns);
  const jitter = extent * disorder / Math.max(1, Math.sqrt(count));
  for (let i = 0; i < count; i++) {
    let a = 0, b = 0;
    if (mode === "line") a = count === 1 ? 0 : (i / (count - 1) - .5) * extent;
    else if (mode === "ring") {
      const turn = 2 * Math.PI * i / count;
      a = Math.cos(turn) * extent / 2; b = Math.sin(turn) * extent / 2 * aspect;
    } else if (mode === "grid") {
      a = (i % columns - (columns - 1) / 2) * extent / Math.max(1, columns - 1);
      b = (Math.floor(i / columns) - (rows - 1) / 2) * extent * aspect / Math.max(1, rows - 1);
    } else {
      const turn = i * Math.PI * (3 - Math.sqrt(5)), radius = Math.sqrt((i + .5) / count);
      a = Math.cos(turn) * extent / 2 * radius;
      b = Math.sin(turn) * extent / 2 * aspect * radius;
    }
    if (disorder > 0) { a += (random.nextDouble() * 2 - 1) * jitter; b += (random.nextDouble() * 2 - 1) * jitter * aspect; }
    result.push([x + a * cos - b * sin, y + a * sin + b * cos]);
  }
  return result;
}
export type VectorTraceSource = { vectors: Point[]; sources: Point[]; starts: Point[]; trails: Point[][];
  origin: Point; spacing: Point };
let cached: { key: string; value: VectorTraceSource } | undefined;
const sourceKeys = ["sourceLayout", "sourceCount", "sourceX", "sourceY", "sourceExtent", "sourceAspect",
  "sourceAngle", "sourceDisorder", "sourceRadius", "rotation", "radial", "driftX", "driftY",
  "gridColumns", "fieldX", "fieldY", "fieldExtent", "startLayout", "startCount", "startX",
  "startY", "startExtent", "startAspect", "startAngle", "startDisorder", "steps", "timeStep"];
export function vectorTraceSources(q: Params, seed: number): VectorTraceSource {
  validateVectorTraceInstrument("stream-ribbons", q);
  const key = JSON.stringify([sourceKeys.map(name => q[name]),
    (Number(q.sourceDisorder) > 0 && Number(q.sourceCount) > 0) || Number(q.startDisorder) > 0 ? seed : 0]);
  if (cached?.key === key) return cached.value;
  const columns = Number(q.gridColumns), extent = Number(q.fieldExtent);
  const origin: Point = [Number(q.fieldX) - extent / 2, Number(q.fieldY) - extent / 2];
  const spacing: Point = [extent / (columns - 1), extent / (columns - 1)];
  const sources = positions(layout(q, "sourceLayout"), Number(q.sourceCount), Number(q.sourceX), Number(q.sourceY),
    Number(q.sourceExtent), Number(q.sourceAspect), Number(q.sourceAngle), Number(q.sourceDisorder),
    new JavaRandom(seed ^ 0x62529));
  const starts = positions(layout(q, "startLayout"), Number(q.startCount), Number(q.startX), Number(q.startY),
    Number(q.startExtent), Number(q.startAspect), Number(q.startAngle), Number(q.startDisorder),
    new JavaRandom(seed ^ 0x4873d));
  const vectors: Point[] = [];
  const radius = Number(q.sourceRadius), rotation = Number(q.rotation), radial = Number(q.radial);
  for (let j = 0; j < columns; j++) for (let i = 0; i < columns; i++) {
    const x = origin[0] + i * spacing[0], y = origin[1] + j * spacing[1];
    let vx = Number(q.driftX), vy = Number(q.driftY);
    for (const [sx, sy] of sources) {
      const dx = (x - sx) / radius, dy = (y - sy) / radius;
      const taper = Math.exp(-.5 * (dx * dx + dy * dy));
      vx += (radial * dx - rotation * dy) * taper;
      vy += (radial * dy + rotation * dx) * taper;
    }
    vectors.push([vx, vy]);
  }
  const trails: Point[][] = [];
  for (const start of starts) {
    const trace = rk4VectorGridTrace2D({ vectors, columns, rows: columns, origin, spacing,
      start, dt: Number(q.timeStep), steps: Number(q.steps), boundary: "STOP",
      maxWork: columns * columns + 17 * Number(q.steps) + 1 });
    trails.push(trace.points.map((point): Point => [point[0], point[1]]));
  }
  const value = { vectors, sources, starts, trails, origin, spacing };
  cached = { key, value };
  return value;
}
function distinct(points: Point[]): Point[] {
  const output: Point[] = [];
  for (const point of points) {
    const last = output[output.length - 1];
    if (!last || last[0] !== point[0] || last[1] !== point[1]) output.push(point);
  }
  return output;
}
function polygon(p: Painter, points: Point[]): void {
  p.beginShape(); for (const [x, y] of points) p.vertex(x, y); p.endShape(p.CLOSE);
}
export function drawVectorTraceInstrument(p: Painter, layer: Layer): void {
  const q = layer.params;
  validateVectorTraceInstrument(layer.technique === "curved-trajectories" ? "curved-trajectories" : "stream-ribbons", q);
  if (!q.showLine && !q.showRibbon && !q.showStations) return;
  const { trails } = vectorTraceSources(q, layer.seed);
  for (let i = 0; i < trails.length; i++) {
    const path = distinct(trails[i]);
    const color = channels(layer.palette[i % layer.palette.length] >>> 0);
    if (q.showRibbon && Number(q.ribbonWidth) > 0 && path.length >= 2) {
      const offset = Number(q.ribbonWidth) / 2;
      const left = offsetPolyline2D({ points: path, closed: false, distance: offset, miterLimit: 2,
        maxWork: path.length * 4 }).points;
      const right = offsetPolyline2D({ points: path, closed: false, distance: -offset, miterLimit: 2,
        maxWork: path.length * 4 }).points;
      p.noStroke(); p.fill(...color, 105);
      polygon(p, [...left.map((v): Point => [v[0], v[1]]), ...right.reverse().map((v): Point => [v[0], v[1]])]);
    }
    if (q.showLine && Number(q.weight) > 0 && path.length >= 2) {
      p.noFill(); p.stroke(...color, 195); p.strokeWeight(Number(q.weight));
      p.beginShape(); for (const [x, y] of path) p.vertex(x, y); p.endShape();
    }
    if (q.showStations && Number(q.stationSize) > 0) {
      const count = Math.max(2, Math.ceil((path.length - 1) / Number(q.stationStride)) + 1);
      const marks = path.length < 2 ? path : resamplePolyline2D({ points: path, closed: false,
        count, maxWork: path.length + count }).points;
      p.noStroke(); p.fill(...color, 230);
      for (const [x, y] of marks) p.circle(x, y, Number(q.stationSize));
    }
  }
}
