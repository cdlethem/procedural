import { stopRamp, targetSprings2D } from "@procedurals/javascript";
import type { Layer } from "../types.js";;
import { channels, choice, numeric, text, toggle, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
type Painter = {
  noFill(): void; noStroke(): void;
  stroke(r: number, g: number, b: number, a?: number): void;
  fill(r: number, g: number, b: number, a?: number): void;
  strokeWeight(value: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  circle(x: number, y: number, diameter: number): void;
};
const tau = Math.PI * 2;
const radians = (degrees: number) => degrees * Math.PI / 180;
const value = (q: Params, key: string) => q[key] as number;



export const rampSpringInstrumentDefinitions: StudioDefinition[] = [
  {
    id: "ramp-marks", title: "Ramp marks", description: "Position a local field of dots, bars or strokes and sample an editable palette ramp.",
    procedure: "A tilted grid of marks is laid down, and each mark looks up its colour by its distance from a separate colour origin. Colour sweeps across the grid as a ramp, while the marks themselves stay fixed.",
    parameters: [numeric("columns", "Columns", "Marks across the local grid.", 2, 50, 1, { hardMin: 1, hardMax: 10000, integer: true }),
      numeric("rows", "Rows", "Marks down the local grid.", 2, 50, 1, { hardMin: 1, hardMax: 10000, integer: true }),
      numeric("pitchX", "Column spacing", "Independent horizontal local spacing, in canvas units.", 3, 50, .1, { hardMin: .01, hardMax: 2000 }),
      numeric("pitchY", "Row spacing", "Independent vertical local spacing, in canvas units.", 3, 50, .1, { hardMin: .01, hardMax: 2000 }),
      numeric("centerX", "Source X", "Center of the mark grid in canvas coordinates; no automatic fit.", 0, 640, 1, { hardMin: -2000, hardMax: 2000 }),
      numeric("centerY", "Source Y", "Center of the mark grid in canvas coordinates; no automatic fit.", 0, 640, 1, { hardMin: -2000, hardMax: 2000 }),
      numeric("rotation", "Grid rotation", "Rotate local mark positions and bar/stroke directions in degrees.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
      choice("mark", "Mark", "Dot, thick bar or thin stroke.", ["dot", "bar", "stroke"]),
      numeric("width", "Mark width", "Dot diameter or bar thickness; zero makes dots and bars empty.", 0, 30, .1, { hardMin: 0, hardMax: 200 }),
      numeric("length", "Mark length", "Length of bars and strokes, in canvas units.", 0, 55, .1, { hardMin: 0, hardMax: 2000 }),
      numeric("weight", "Stroke weight", "Stroke thickness independent of the bar width; zero hides strokes.", 0, 8, .1, { hardMin: 0, hardMax: 200 }),
      numeric("retention", "Retention", "Probability of retaining each mark; one retains the complete field.", 0, 1, .01, { hardMin: 0, hardMax: 1 }),
      numeric("disorder", "Position disorder", "Seeded positional jitter as a fraction of each cell's spacing.", 0, 1, .01, { hardMin: 0, hardMax: 1 }),
      choice("coordinate", "Color coordinate", "Linear projection, radial distance or angle about a separate field center.", ["linear", "radial", "angular"]),
      numeric("fieldX", "Color-field X", "Color-field center in canvas coordinates, independent of the grid center.", 0, 640, 1, { hardMin: -2000, hardMax: 2000 }),
      numeric("fieldY", "Color-field Y", "Color-field center in canvas coordinates, independent of the grid center.", 0, 640, 1, { hardMin: -2000, hardMax: 2000 }),
      numeric("axis", "Color axis", "Angle of zero color phase / linear projection in degrees.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
      numeric("span", "Color span", "Canvas units per full ramp for linear/radial; degrees per ramp for angular.", 20, 640, 1, { hardMin: .001, hardMax: 10000 }),
      numeric("phase", "Color phase", "Additive phase in ramp cycles before mapping.", -1, 1, .01, { hardMin: -100, hardMax: 100 }),
      text("stopPositions", "Stop positions", "Blank spaces palette colors evenly; otherwise supply one strictly ascending 0..1 position per color, comma-separated.", 1000),
      choice("mapping", "Ramp mapping", "Hold endpoint colors, wrap each cycle, or reflect alternate cycles.", ["clamp", "repeat", "mirror"])],
    controlGroups: [
      { label: "Grid", stage: "form", controls: [
        { label: "Divisions", controls: ["columns", "rows"], proportional: true },
        { label: "Spacing", controls: ["pitchX", "pitchY"], proportional: true }] },
      { label: "Placement", stage: "frame", controls: ["centerX", "centerY", "rotation"] },
      { label: "Disorder", stage: "process", controls: ["disorder", "retention"] },
      { label: "Mark", stage: "material", controls: ["mark", { label: "Scale", controls: ["width", "length", "weight"], proportional: true }] },
      { label: "Color", stage: "color", controls: ["coordinate", "fieldX", "fieldY", "axis", "span", "phase",
        { label: "Ramp", controls: ["stopPositions", "mapping"] }] },
    ],
    defaults: {columns: 23,
      rows: 16,
      pitchX: 19,
      pitchY: 22,
      centerX: 320,
      centerY: 320,
      rotation: -16,
      mark: "dot",
      width: 10,
      length: 23,
      weight: 1.8,
      retention: 1,
      disorder: 0,
      coordinate: "linear",
      fieldX: 320,
      fieldY: 320,
      axis: 12,
      span: 440,
      phase: .5,
      stopPositions: "",
      mapping: "clamp"},
    validate: (q) => validateRamp(q),
  },
  {
    id: "spring-marks", title: "Spring marks", description: "Retained independent target-spring histories with separate paths, bodies, targets and spokes.",
    procedure: "Each body is tied by a spring to its own fixed target, and at every step the spring pulls, the body moves and damping bleeds off speed. The overshoots and settling are kept, and each body's path is drawn as a converging trail.",
    parameters: [numeric("count", "Bodies", "Number of independent springs.", 6, 72, 1, { hardMin: 1, hardMax: 256, integer: true }),
      numeric("ticks", "Ticks", "Exact number of core spring updates (zero shows initial bodies).", 0, 180, 1, { hardMin: 0, hardMax: 600, integer: true }),
      numeric("strength", "Strength", "Attraction toward each body's own target.", .005, .25, .005, { hardMin: 0, hardMax: 2 }),
      numeric("damping", "Damping", "Velocity retention after each step.", .5, .99, .01, { hardMin: 0, hardMax: 1 }),
      choice("initialMode", "Initial arrangement", "Ordered sunflower area, ring, line or grid.", ["area", "ring", "line", "grid"]),
      numeric("initialExtent", "Initial extent", "Initial layout radius (or half-length), in canvas units.", 10, 280, 1, { hardMin: 0, hardMax: 1500 }),
      numeric("initialAspect", "Initial aspect", "X stretch divided by Y stretch, keeping area approximately constant.", .25, 4, .05, { hardMin: .05, hardMax: 20 }),
      numeric("initialX", "Initial X", "Center of the initial population in canvas coordinates.", 0, 640, 1, { hardMin: -2000, hardMax: 2000 }),
      numeric("initialY", "Initial Y", "Center of the initial population in canvas coordinates.", 0, 640, 1, { hardMin: -2000, hardMax: 2000 }),
      numeric("initialAngle", "Initial angle", "Rotation of initial distribution in degrees.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
      numeric("initialDisorder", "Initial disorder", "Seeded displacement of starting positions, relative to initial extent.", 0, 1, .01, { hardMin: 0, hardMax: 1 }),
      choice("targetMode", "Target arrangement", "Independent target ring, line, grid or common point.", ["ring", "line", "grid", "point"]),
      numeric("radius", "Target extent", "Target ring radius, line half-length or grid half-width in canvas units (historical radius key).", 60, 250, 1, { hardMin: 0, hardMax: 1500 }),
      numeric("targetAspect", "Target aspect", "X stretch divided by Y stretch of the target distribution.", .25, 4, .05, { hardMin: .05, hardMax: 20 }),
      numeric("targetX", "Target X", "Independent target center in canvas coordinates.", 0, 640, 1, { hardMin: -2000, hardMax: 2000 }),
      numeric("targetY", "Target Y", "Independent target center in canvas coordinates.", 0, 640, 1, { hardMin: -2000, hardMax: 2000 }),
      numeric("targetAngle", "Target angle", "Orientation of target arrangement in degrees.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
      numeric("velocityHeading", "Velocity heading", "Starting direction in degrees.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
      numeric("velocitySpeed", "Velocity speed", "Initial speed in canvas units per tick.", 0, 20, .1, { hardMin: 0, hardMax: 500 }),
      numeric("velocitySpread", "Velocity spread", "Seeded initial heading variation in degrees around the given heading.", 0, 180, 1, { hardMin: 0, hardMax: 360 }),
      toggle("showTrails", "Trails", "Draw retained actual step histories."),
      numeric("trailStride", "Trail stride", "Connect every Nth retained position plus the final position.", 1, 20, 1, { hardMin: 1, hardMax: 600, integer: true }),
      numeric("trailWeight", "Trail weight", "Width of history paths; zero hides them.", 0, 7, .1, { hardMin: 0, hardMax: 100 }),
      toggle("showBodies", "Body dots", "Show final actual body positions."),
      numeric("bodySize", "Body size", "Final dot diameter; zero hides dots.", 0, 15, .1, { hardMin: 0, hardMax: 200 }),
      toggle("showTargets", "Target dots", "Show each body's actual fixed target."),
      numeric("targetSize", "Target size", "Target dot diameter; zero hides dots.", 0, 15, .1, { hardMin: 0, hardMax: 200 }),
      toggle("showSpokes", "Spokes", "Draw final body-to-target displacement segments."),
      numeric("weight", "Spoke weight", "Width of optional body-to-target spokes; zero hides them.", .5, 4, .1, { hardMin: 0, hardMax: 100 })],
    controlGroups: [
      { label: "Population", stage: "form", controls: ["count", "initialMode", "initialExtent", "initialAspect", "initialX", "initialY", "initialAngle", "initialDisorder"] },
      { label: "Targets", stage: "form", controls: ["targetMode", "radius", "targetAspect", "targetX", "targetY", "targetAngle"] },
      { label: "Velocity", stage: "process", controls: ["velocityHeading", "velocitySpeed", "velocitySpread"] },
      { label: "Simulation", stage: "process", controls: ["ticks", "strength", "damping"] },
      { label: "Drawing", stage: "material", controls: [
        { label: "Trails", controls: ["showTrails", "trailStride", "trailWeight"] },
        { label: "Bodies", controls: ["showBodies", "bodySize"] },
        { label: "Target dots", controls: ["showTargets", "targetSize"] },
        { label: "Spokes", controls: ["showSpokes", "weight"] }] },
    ],
    defaults: {count: 28,
      ticks: 48,
      strength: .06,
      damping: .86,
      initialMode: "ring",
      initialExtent: 120,
      initialAspect: 1,
      initialX: 320,
      initialY: 320,
      initialAngle: -24,
      initialDisorder: .22,
      targetMode: "ring",
      radius: 190,
      targetAspect: 1.25,
      targetX: 330,
      targetY: 302,
      targetAngle: 23,
      velocityHeading: -90,
      velocitySpeed: 1.5,
      velocitySpread: 32,
      showTrails: true,
      trailStride: 2,
      trailWeight: 1.5,
      showBodies: true,
      bodySize: 4.5,
      showTargets: false,
      targetSize: 4,
      showSpokes: false,
      weight: 1},
    validate: (q) => validateSpring(q),
  },
];

function checked(q: Params, key: string, min: number, max: number, integer = false): number {
  const x = q[key];
  if (typeof x !== "number" || !Number.isFinite(x) || x < min || x > max || (integer && !Number.isSafeInteger(x)))
    throw Error(`${key} must be ${integer ? "an integer" : "a finite number"} in [${min}, ${max}]`);
  return x;
}
function select(q: Params, key: string, choices: readonly string[]): void {
  if (typeof q[key] !== "string" || !choices.includes(q[key])) throw Error(`${key} must be one of: ${choices.join(", ")}`);
}
function flag(q: Params, key: string): void {
  if (typeof q[key] !== "boolean") throw Error(`${key} must be boolean`);
}
function validatePalette(palette: readonly number[]): void {
  if (!Array.isArray(palette) || palette.length < 1 || palette.length > 256 ||
    palette.some(color => !Number.isSafeInteger(color) || color < 0 || color > 0xffffff))
    throw Error("Palette must contain 1..256 RGB24 colors");
}
function paletteStops(q: Params, palette: readonly number[]): number[] {
  validatePalette(palette);
  const textValue = q.stopPositions;
  if (typeof textValue !== "string" || textValue.length > 1000) throw Error("stopPositions must be text at most 1000 characters");
  if (!textValue.trim()) return palette.map((_, i) => palette.length === 1 ? 0 : i / (palette.length - 1));
  const tokens = textValue.split(/[,\s]+/).filter(Boolean);
  if (tokens.length !== palette.length) throw Error("Stop positions must match palette color count");
  const positions = tokens.map(token => {
    if (!/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(token)) throw Error("Stop positions must be finite numbers in [0, 1]");
    const n = Number(token);
    if (!Number.isFinite(n) || n < 0 || n > 1) throw Error("Stop positions must be finite numbers in [0, 1]");
    return n;
  });
  if (positions.some((position, index) => index > 0 && position <= positions[index - 1]))
    throw Error("Stop positions must be strictly ascending in palette order");
  return positions;
}
export function validateRamp(q: Params, palette?: readonly number[]): void {
  
  const columns = checked(q, "columns", 1, 10000, true), rows = checked(q, "rows", 1, 10000, true);
  if (columns * rows > 10000) throw Error("Grid exceeds 10,000 marks");
  for (const key of ["pitchX", "pitchY"] as const) checked(q, key, .01, 2000);
  for (const key of ["centerX", "centerY", "fieldX", "fieldY"] as const) checked(q, key, -2000, 2000);
  for (const key of ["rotation", "axis"] as const) checked(q, key, -3600, 3600);
  for (const key of ["width", "weight"] as const) checked(q, key, 0, 200);
  checked(q, "length", 0, 2000); checked(q, "retention", 0, 1); checked(q, "disorder", 0, 1);
  checked(q, "span", .001, 10000); checked(q, "phase", -100, 100);
  select(q, "mark", ["dot", "bar", "stroke"]); select(q, "coordinate", ["linear", "radial", "angular"]);
  select(q, "mapping", ["clamp", "repeat", "mirror"]);
  if (typeof q.stopPositions !== "string" || q.stopPositions.length > 1000) throw Error("stopPositions must be short text");
  if (palette) paletteStops(q, palette);
}

/** Independent structural hash streams: retention does not shift jitter and neither consumes style randomness. */
function random(seed: number, index: number, stream: number): number {
  let x = ((seed >>> 0) ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(stream + 1, 0x85ebca6b)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
export type RampMark = { x: number; y: number; colorPosition: number };
export function rampMarks(q: Params, seed: number): RampMark[] {
  validateRamp(q);
  const marks: RampMark[] = [], count = value(q, "columns"), rows = value(q, "rows");
  const angle = radians(value(q, "rotation")), ca = Math.cos(angle), sa = Math.sin(angle);
  const axis = radians(value(q, "axis")), ax = Math.cos(axis), ay = Math.sin(axis);
  const jitter = value(q, "disorder"), retain = value(q, "retention"), span = value(q, "span");
  for (let row = 0; row < rows; row++) for (let col = 0; col < count; col++) {
    const i = row * count + col;
    if (retain < 1 && random(seed, i, 0) >= retain) continue;
    const u = (col - (count - 1) / 2 + (jitter ? (random(seed, i, 1) - .5) * jitter : 0)) * value(q, "pitchX");
    const v = (row - (rows - 1) / 2 + (jitter ? (random(seed, i, 2) - .5) * jitter : 0)) * value(q, "pitchY");
    const x = value(q, "centerX") + ca * u - sa * v, y = value(q, "centerY") + sa * u + ca * v;
    const dx = x - value(q, "fieldX"), dy = y - value(q, "fieldY");
    let t: number;
    if (q.coordinate === "linear") t = .5 + (ax * dx + ay * dy) / span;
    else if (q.coordinate === "radial") t = Math.hypot(dx, dy) / span;
    else t = .5 + ((Math.atan2(dy, dx) - axis) * 180 / Math.PI) / span;
    t += value(q, "phase");
    if (q.mapping === "clamp") t = Math.max(0, Math.min(1, t));
    else if (q.mapping === "repeat") t = ((t % 1) + 1) % 1;
    else { t = ((t % 2) + 2) % 2; t = t > 1 ? 2 - t : t; }
    marks.push({ x, y, colorPosition: t });
  }
  return marks;
}
export function drawRampSpringInstrument(p: Painter, layer: Layer): void {
  if (layer.technique === "ramp-marks") return drawRamp(p, layer);
  if (layer.technique === "spring-marks") return drawSpring(p, layer);
  throw Error(`Unknown ramp/spring instrument ${layer.technique}`);
}
function drawRamp(p: Painter, layer: Layer): void {
  const q = layer.params;
  validateRamp(q, layer.palette);
  const positions = paletteStops(q, layer.palette);
  const ramp = stopRamp({ stops: layer.palette.map((color, i) => ({ color, position: positions[i] })) });
  if (value(q, "retention") === 0 || (q.mark === "dot" && value(q, "width") === 0) ||
      (q.mark === "bar" && (value(q, "width") === 0 || value(q, "length") === 0)) ||
      (q.mark === "stroke" && (value(q, "weight") === 0 || value(q, "length") === 0))) return;
  const angle = radians(value(q, "rotation")), dx = Math.cos(angle) * value(q, "length") / 2;
  const dy = Math.sin(angle) * value(q, "length") / 2;
  if (q.mark === "dot") p.noStroke(); else p.noFill();
  if (q.mark !== "dot") p.strokeWeight(q.mark === "bar" ? value(q, "width") : value(q, "weight"));
  for (const mark of rampMarks(q, layer.seed)) {
    const [r, g, b] = channels(ramp.sample(mark.colorPosition));
    if (q.mark === "dot") { p.fill(r, g, b); p.circle(mark.x, mark.y, value(q, "width")); }
    else { p.stroke(r, g, b); p.line(mark.x - dx, mark.y - dy, mark.x + dx, mark.y + dy); }
  }
}

function arrangement(mode: string, i: number, count: number): [number, number] {
  if (mode === "point") return [0, 0];
  if (mode === "ring") { const angle = tau * i / count; return [Math.cos(angle), Math.sin(angle)]; }
  if (mode === "line") return [count === 1 ? 0 : 2 * i / (count - 1) - 1, 0];
  if (mode === "area") { const angle = i * Math.PI * (3 - Math.sqrt(5)); const r = Math.sqrt((i + .5) / count); return [Math.cos(angle) * r, Math.sin(angle) * r]; }
  const columns = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / columns);
  return [(i % columns - (columns - 1) / 2) * (columns === 1 ? 0 : 2 / (columns - 1)),
    (Math.floor(i / columns) - (rows - 1) / 2) * (rows === 1 ? 0 : 2 / (rows - 1))];
}
function located(u: number, v: number, extent: number, aspect: number, angle: number, x: number, y: number): [number, number] {
  const a = radians(angle), c = Math.cos(a), s = Math.sin(a), stretch = Math.sqrt(aspect);
  const dx = u * extent * stretch, dy = v * extent / stretch;
  return [x + c * dx - s * dy, y + s * dx + c * dy];
}
export function validateSpring(q: Params): void {
  
  const count = checked(q, "count", 1, 256, true), ticks = checked(q, "ticks", 0, 600, true);
  if (count * ticks > 80000) throw Error("Spring count × ticks exceeds 80,000 core steps");
  checked(q, "strength", 0, 2); checked(q, "damping", 0, 1);
  select(q, "initialMode", ["area", "ring", "line", "grid"]);
  select(q, "targetMode", ["ring", "line", "grid", "point"]);
  checked(q, "initialExtent", 0, 1500); checked(q, "radius", 0, 1500);
  checked(q, "initialAspect", .05, 20); checked(q, "targetAspect", .05, 20);
  for (const key of ["initialX", "initialY", "targetX", "targetY"] as const) checked(q, key, -2000, 2000);
  for (const key of ["initialAngle", "targetAngle", "velocityHeading"] as const) checked(q, key, -3600, 3600);
  checked(q, "initialDisorder", 0, 1); checked(q, "velocitySpeed", 0, 500);
  checked(q, "velocitySpread", 0, 360);
  checked(q, "trailStride", 1, 600, true); checked(q, "trailWeight", 0, 100);
  checked(q, "bodySize", 0, 200); checked(q, "targetSize", 0, 200); checked(q, "weight", 0, 100);
  for (const key of ["showTrails", "showBodies", "showTargets", "showSpokes"] as const) flag(q, key);
}
type SpringHistory = { positions: [number, number][][]; targets: [number, number][] };
const springKeys = ["count", "ticks", "strength", "damping", "initialMode", "initialExtent", "initialAspect",
  "initialX", "initialY", "initialAngle", "initialDisorder", "targetMode", "radius", "targetAspect",
  "targetX", "targetY", "targetAngle", "velocityHeading", "velocitySpeed", "velocitySpread"] as const;
let previous: { key: string; history: SpringHistory } | undefined;
/** Full retained trajectory: each consecutive frame is one real targetSprings2D transition. */
export function springHistory(q: Params, seed: number): SpringHistory {
  validateSpring(q);
  const seeded = value(q, "initialDisorder") > 0 || value(q, "velocitySpread") > 0;
  const key = JSON.stringify([seeded ? seed : 0, ...springKeys.map(k => q[k])]);
  if (previous?.key === key) return previous.history;
  const count = value(q, "count"), targets: [number, number][] = [], bodies = [];
  const positions: [number, number][][] = [];
  for (let i = 0; i < count; i++) {
    const [u, v] = arrangement(String(q.initialMode), i, count);
    const disorder = value(q, "initialDisorder");
    const position = located(u + (disorder ? (random(seed, i, 3) - .5) * disorder : 0),
      v + (disorder ? (random(seed, i, 4) - .5) * disorder : 0), value(q, "initialExtent"),
      value(q, "initialAspect"), value(q, "initialAngle"), value(q, "initialX"), value(q, "initialY"));
    const [tx, ty] = arrangement(String(q.targetMode), i, count);
    targets.push(located(tx, ty, value(q, "radius"), value(q, "targetAspect"), value(q, "targetAngle"),
      value(q, "targetX"), value(q, "targetY")));
    const heading = radians(value(q, "velocityHeading") +
      (value(q, "velocitySpread") ? (random(seed, i, 5) * 2 - 1) * value(q, "velocitySpread") : 0));
    bodies.push({ position, velocity: [Math.cos(heading) * value(q, "velocitySpeed"),
      Math.sin(heading) * value(q, "velocitySpeed")], strength: value(q, "strength"), retention: value(q, "damping") });
    positions.push([position]);
  }
  let state: { bodies: { position: number[]; velocity: number[]; strength: number; retention: number }[] } = { bodies };
  for (let tick = 0; tick < value(q, "ticks"); tick++) {
    state = targetSprings2D({ state, targets }).toValues();
    for (let i = 0; i < count; i++) positions[i].push(state.bodies[i].position as [number, number]);
  }
  const history = { positions, targets };
  previous = { key, history };
  return history;
}
function drawSpring(p: Painter, layer: Layer): void {
  const q = layer.params;
  validateSpring(q);
  validatePalette(layer.palette);
  const trails = q.showTrails && value(q, "trailWeight") > 0;
  const bodies = q.showBodies && value(q, "bodySize") > 0;
  const targets = q.showTargets && value(q, "targetSize") > 0;
  const spokes = q.showSpokes && value(q, "weight") > 0;
  if (!trails && !bodies && !targets && !spokes) return;
  const history = springHistory(q, layer.seed);
  p.noFill();
  const stride = value(q, "trailStride");
  for (let i = 0; i < history.targets.length; i++) {
    const [r, g, b] = channels(layer.palette[i % layer.palette.length]);
    const path = history.positions[i], final = path[path.length - 1], target = history.targets[i];
    if (trails) {
      p.stroke(r, g, b); p.strokeWeight(value(q, "trailWeight"));
      let last = 0;
      for (let j = stride; j < path.length; j += stride) {
        p.line(path[last][0], path[last][1], path[j][0], path[j][1]); last = j;
      }
      if (last !== path.length - 1) p.line(path[last][0], path[last][1], final[0], final[1]);
    }
    if (spokes) {
      p.stroke(r, g, b); p.strokeWeight(value(q, "weight"));
      p.line(final[0], final[1], target[0], target[1]);
    }
    if (bodies || targets) {
      p.noStroke(); p.fill(r, g, b);
      if (bodies) p.circle(final[0], final[1], value(q, "bodySize"));
      if (targets) p.circle(target[0], target[1], value(q, "targetSize"));
    }
  }
}
