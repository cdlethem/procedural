import { gradientNoise2D01, gradientPath2D, occupiedLatticePaths2D, orderedCircleFilter2D, seededCirclePlacement2D } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { ControlGroup, Layer, Parameter } from "../types.js";
import { channels, choice, numeric, toggle, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
type Point = [number, number];
type Canvas = {
  ROUND: unknown; CLOSE: unknown;
  noFill(): void; noStroke(): void; strokeWeight(n: number): void;
  stroke(r: number, g: number, b: number, a?: number): void;
  fill(r: number, g: number, b: number, a?: number): void;
  strokeCap(cap: unknown): void; strokeJoin(join: unknown): void;
  line(x: number, y: number, x2: number, y2: number): void;
  circle(x: number, y: number, diameter: number): void;
  beginShape(): void; vertex(x: number, y: number): void; endShape(mode?: unknown): void;
};
const n = (q: Params, key: string): number => Number(q[key]);
function number(q: Params, key: string, min: number, max: number, integer = false): number {
  const value = q[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value)))
    throw new Error(`${key} must be ${integer ? "an integer" : "a number"} in [${min}, ${max}]`);
  return value;
}
function oneOf(q: Params, key: string, values: string[]): void {
  if (!values.includes(String(q[key]))) throw new Error(`${key} must be one of ${values.join(", ")}`);
}
function bool(q: Params, key: string): void {
  if (typeof q[key] !== "boolean") throw new Error(`${key} must be boolean`);
}
const num = (key: string, label: string, tip: string, min: number, max: number, step = 1, hardMin = min, hardMax = max, integer = false): Parameter =>
  numeric(key, label, tip, min, max, step, { hardMin, hardMax, integer });
const center = [
  num("centerX", "Source X", "Horizontal center in canvas coordinates.", 0, 640, 1, -4000, 4000),
  num("centerY", "Source Y", "Vertical center in canvas coordinates.", 0, 640, 1, -4000, 4000),
];
const footprint = [
  num("extentX", "Source width", "Width of the source distribution, not a clipping window.", 10, 600, 1, 0, 4000),
  num("extentY", "Source height", "Height of the source distribution, not a clipping window.", 10, 600, 1, 0, 4000),
];
/** The source footprint every basic source instrument positions the same way. */
const sourcePlacement = (...rotation: string[]): ControlGroup =>
  ({ label: "Placement", controls: ["centerX", "centerY", { label: "Size", controls: ["extentX", "extentY"], proportional: true }, ...rotation] });
export const basicSourceInstrumentDefinitions: StudioDefinition[] = [
  {
    id: "field-marks", title: "Field marks", description: "A positioned, retained field of seeded noise-directed dots, short strokes or bars.",
    parameters: [
      num("columns", "Columns", "Samples in each row.", 2, 120, 1, 1, 500, true),
      num("rows", "Rows", "Sample rows.", 2, 120, 1, 1, 500, true),
      num("pitch", "Pitch", "Sample spacing in grid mode; scatter uses the explicit footprint.", 2, 25, .5, .1, 100),
      num("maxLength", "Maximum length", "Longest mark; zero hides all marks.", 0, 45, .5, 0, 300),
      ...center, ...footprint,
      choice("distribution", "Samples", "Aligned grid or seeded scattered positions within the source footprint.", ["grid", "scatter"]),
      num("retention", "Retention", "Independent seeded probability of retaining each source sample.", 0, 1, .01, 0, 1),
      num("frequency", "Field frequency", "Noise cycles per canvas unit governing orientation and length.", .001, .06, .001, 0, 2),
      num("direction", "Direction", "Base mark direction, in degrees.", -180, 180, 1, -3600, 3600),
      num("variation", "Angular variation", "Noise-directed angle swing, in degrees.", 0, 360, 1, 0, 1440),
      num("minimumLength", "Shortest fraction", "Minimum mark length as a fraction of maximum.", 0, 1, .02, 0, 1),
      choice("mark", "Mark", "Dot, line or filled bar without moving samples.", ["line", "dot", "bar"]),
      num("weight", "Mark weight", "Thickness of strokes and bars; zero hides the drawing.", 0, 8, .1, 0, 80),
    ],
    controlGroups: [
      { label: "Samples", controls: ["distribution", "pitch",
        { label: "Grid", controls: ["columns", "rows"], proportional: true }, "retention"] },
      sourcePlacement(),
      { label: "Field", controls: ["frequency", "direction", "variation"] },
      { label: "Mark", controls: ["mark",
        { label: "Scale", controls: ["maxLength", "weight"], proportional: true }, "minimumLength"] },
    ],
    defaults: {columns: 80,
      rows: 80,
      pitch: 8,
      maxLength: 14,
      centerX: 320,
      centerY: 320,
      extentX: 632,
      extentY: 632,
      distribution: "grid",
      retention: 1,
      frequency: .009,
      direction: 0,
      variation: 360,
      minimumLength: .15,
      mark: "line",
      weight: 1},
    validate: validateFieldMarks,
  },
  {
    id: "path-marks", title: "Path marks", description: "Editable gradient-field trajectories, with independent marks at arc-length stations.",
    parameters: [
      num("steps", "Steps", "Movement steps per path.", 10, 1000, 1, 0, 4000, true),
      num("distance", "Step distance", "Travel per movement step.", .1, 3, .05, 0, 50),
      num("markLength", "Mark length", "Length of perpendicular marks or dot diameter.", 0, 32, .5, 0, 200),
      toggle("trace", "Trace", "Draw continuous trajectories rather than repeated marks."),
      num("pathCount", "Paths", "Number of independent starting points.", 1, 45, 1, 0, 500, true),
      ...center, ...footprint,
      choice("arrangement", "Start arrangement", "Grid, seeded area or seeded ring around the source center.", ["grid", "area", "ring"]),
      num("sourceColumns", "Grid columns", "Column count for starts when arranged on a grid.", 1, 12, 1, 1, 500, true),
      num("sourceRows", "Grid rows", "Row count for starts when arranged on a grid.", 1, 12, 1, 1, 500, true),
      num("sourceAngle", "Start direction", "Rotate the distribution of starts, in degrees.", -180, 180, 1, -3600, 3600),
      num("fieldScale", "Field scale", "Noise-coordinate scale applied to every path position.", 0, .03, .0001, -.2, .2),
      num("angleBase", "Field bias", "Base direction of travel in radians.", -7, 7, .1, -100, 100),
      num("angleScale", "Field response", "Noise contribution to travel direction in radians.", -80, 80, .5, -300, 300),
      num("spacing", "Mark spacing", "Arc-length distance between marks, independent of movement step size.", .5, 30, .5, .05, 1000),
      num("regularity", "Mark disorder", "Seeded displacement along the path, never changing its trajectory.", 0, 1, .02, 0, 1),
      num("drift", "Cross drift", "Seeded displacement across the path at mark stations.", 0, 20, .5, 0, 300),
      choice("mark", "Mark", "Perpendicular stroke, filled bar or dot.", ["line", "bar", "dot"]),
      num("gapEvery", "Gap cycle", "Number of marks per omission cycle; zero disables omissions.", 0, 32, 1, 0, 500, true),
      num("gapLength", "Omitted marks", "Skip this many marks in each cycle.", 0, 16, 1, 0, 500, true),
      num("weight", "Weight", "Stroke or bar thickness; zero hides marks.", 0, 6, .1, 0, 80),
    ],
    controlGroups: [
      { label: "Starts", controls: ["pathCount", "arrangement",
        { label: "Grid", controls: ["sourceColumns", "sourceRows"], proportional: true }] },
      sourcePlacement("sourceAngle"),
      { label: "Trajectory", controls: ["steps", "distance",
        { label: "Field", controls: ["fieldScale", "angleBase", "angleScale"] }] },
      { label: "Mark", controls: ["trace", "mark",
        { label: "Scale", controls: ["markLength", "weight"], proportional: true },
        { label: "Stations", controls: ["spacing", "regularity", "drift"] },
        { label: "Gaps", controls: ["gapEvery", "gapLength"] }] },
    ],
    defaults: {steps: 600,
      distance: .4,
      markLength: 12,
      trace: false,
      pathCount: 24,
      centerX: 320,
      centerY: 320,
      extentX: 520,
      extentY: 480,
      arrangement: "grid",
      sourceColumns: 6,
      sourceRows: 4,
      sourceAngle: 0,
      fieldScale: .002,
      angleBase: -20,
      angleScale: 40,
      spacing: 5,
      regularity: 0,
      drift: 0,
      mark: "line",
      gapEvery: 0,
      gapLength: 0,
      weight: 1},
    validate: validatePathMarks,
  },
  {
    id: "placement-marks", title: "Placement marks", description: "Ordered circle exclusion within an editable area or an explicit series of radial proposals.",
    parameters: [
      num("attempts", "Proposals", "Seeded candidates considered; accepted count may be smaller.", 20, 1500, 1, 0, 4000, true),
      num("minimum", "Minimum radius", "Smallest proposed exclusion radius.", 2, 32, .5, .01, 1000),
      num("maximum", "Maximum radius", "Largest proposed exclusion radius.", 4, 64, .5, .01, 1000),
      num("separation", "Separation", "Minimum center spacing relative to combined exclusion radii.", .5, 2, .05, .01, 20),
      toggle("radial", "Radial source", "Use rings of explicit ordered candidates instead of area sampling."),
      ...center, ...footprint,
      num("ringRadius", "Ring radius", "Distance of the first proposal ring from the source center.", 0, 200, 1, 0, 3000),
      num("ringSpacing", "Ring separation", "Radial distance between proposal rings.", 1, 90, 1, 0, 3000),
      num("ringCount", "Rings", "Number of proposal rings.", 1, 8, 1, 0, 50, true),
      num("ringSamples", "Points per ring", "Ordered proposals around each ring.", 3, 50, 1, 1, 500, true),
      num("phase", "Ring phase", "Angular orientation of the ring proposals in degrees.", -180, 180, 1, -3600, 3600),
      choice("mark", "Mark", "Outline, diamond, inner ring, circle or short tangent stroke.", ["outline", "diamond", "ring", "circle", "stroke"]),
      num("materialScale", "Material scale", "Fraction of each reserved exclusion circle used by the mark.", 0, 1, .02, 0, 1),
      num("orientation", "Mark angle", "Rotate diamonds and strokes inside their reserved circles.", -180, 180, 1, -3600, 3600),
      num("weight", "Stroke weight", "Outline and stroke width; zero removes stroke material.", 0, 6, .1, 0, 40),
    ],
    controlGroups: [
      { label: "Proposals", controls: ["radial", "attempts",
        { label: "Rings", controls: ["ringCount", "ringSamples", "phase",
          { label: "Size", controls: ["ringRadius", "ringSpacing"], proportional: true }] }] },
      sourcePlacement(),
      { label: "Exclusion", controls: [{ label: "Radii", controls: ["minimum", "maximum"], proportional: true }, "separation"] },
      { label: "Mark", controls: ["mark", "materialScale", "orientation", "weight"] },
    ],
    defaults: {attempts: 3000,
      minimum: 4,
      maximum: 48,
      separation: 1,
      radial: false,
      centerX: 320,
      centerY: 320,
      extentX: 512,
      extentY: 512,
      ringRadius: 48,
      ringSpacing: 48,
      ringCount: 5,
      ringSamples: 32,
      phase: 0,
      mark: "outline",
      materialScale: 1,
      orientation: 0,
      weight: 1},
    validate: validatePlacementMarks,
  },
  {
    id: "lattice-marks", title: "Lattice marks", description: "Ordered starts claim unoccupied cells in an editable oriented rectangular lattice.",
    parameters: [
      num("count", "Paths", "Ordered starting cells; occupied starts become empty routes.", 1, 50, 1, 0, 500, true),
      num("steps", "Moves", "Maximum cardinal moves; blocked routes stop early.", 0, 100, 1, 0, 1000, true),
      num("weight", "Stroke width", "Route width, zero hides route lines.", 0, 15, .1, 0, 80),
      num("dotSize", "Dot size", "Diameter of route dots or optional endpoints.", 0, 16, .5, 0, 80),
      toggle("dots", "Dots", "Use cell dots instead of connected route lines."),
      toggle("grid", "Grid", "Show the source lattice as optional construction lines."),
      num("columns", "Columns", "Number of columns sent to the path operation.", 2, 48, 1, 1, 200, true),
      num("rows", "Rows", "Number of rows sent to the path operation.", 2, 48, 1, 1, 200, true),
      num("spacingX", "Cell spacing X", "Local horizontal distance between cell centers.", 5, 40, .5, .1, 200),
      num("spacingY", "Cell spacing Y", "Local vertical distance between cell centers.", 5, 40, .5, .1, 200),
      ...center,
      num("orientation", "Source rotation", "Rotate the entire lattice about its center.", -180, 180, 1, -3600, 3600),
      choice("layout", "Start layout", "Seeded scattered, evenly spaced or concentrated center starts.", ["scatter", "spaced", "center"]),
      toggle("endpoints", "Endpoints", "Emphasize actual first and last claimed cells."),
      toggle("shadow", "Shadow", "Optional offset stroke beneath routes."),
    ],
    controlGroups: [
      { label: "Lattice", controls: [
        { label: "Grid", controls: ["columns", "rows"], proportional: true },
        { label: "Spacing", controls: ["spacingX", "spacingY"], proportional: true },
        "grid"] },
      { label: "Placement", controls: ["centerX", "centerY", "orientation"] },
      { label: "Routes", controls: ["layout", "count", "steps"] },
      { label: "Drawing", controls: ["dots",
        { label: "Scale", controls: ["weight", "dotSize"], proportional: true },
        "endpoints", "shadow"] },
    ],
    defaults: {count: 12,
      steps: 12,
      weight: 8.4,
      dotSize: 6,
      dots: false,
      grid: false,
      columns: 24,
      rows: 24,
      spacingX: 24,
      spacingY: 24,
      centerX: 320,
      centerY: 320,
      orientation: 0,
      layout: "spaced",
      endpoints: false,
      shadow: false},
    validate: validateLatticeMarks,
  },
];

export function validateFieldMarks(q: Params): void {
  
  const columns = number(q, "columns", 1, 500, true), rows = number(q, "rows", 1, 500, true);
  if (columns * rows > 80_000) throw new Error("Field columns × rows exceeds 80,000 samples");
  for (const [key, lo, hi] of [["pitch", .1, 100], ["maxLength", 0, 300], ["centerX", -4000, 4000], ["centerY", -4000, 4000], ["extentX", 0, 4000], ["extentY", 0, 4000], ["retention", 0, 1], ["frequency", 0, 2], ["direction", -3600, 3600], ["variation", 0, 1440], ["minimumLength", 0, 1], ["weight", 0, 80]] as const) number(q, key, lo, hi);
  oneOf(q, "distribution", ["grid", "scatter"]); oneOf(q, "mark", ["line", "dot", "bar"]);
}
export function validatePathMarks(q: Params): void {
  
  const steps = number(q, "steps", 0, 4000, true), count = number(q, "pathCount", 0, 500, true);
  if (count * (steps + 1) > 250_000) throw new Error("Path count × steps exceeds 250,000 points");
  for (const [key, lo, hi] of [["distance", 0, 50], ["markLength", 0, 200], ["centerX", -4000, 4000], ["centerY", -4000, 4000], ["extentX", 0, 4000], ["extentY", 0, 4000], ["sourceAngle", -3600, 3600], ["fieldScale", -.2, .2], ["angleBase", -100, 100], ["angleScale", -300, 300], ["spacing", .05, 1000], ["regularity", 0, 1], ["drift", 0, 300], ["weight", 0, 80]] as const) number(q, key, lo, hi);
  const cols = number(q, "sourceColumns", 1, 500, true), rows = number(q, "sourceRows", 1, 500, true);
  if (q.arrangement === "grid" && count > cols * rows) throw new Error("Grid starts require at least pathCount cells");
  const every = number(q, "gapEvery", 0, 500, true), length = number(q, "gapLength", 0, 500, true);
  if (every === 0 && length !== 0 || every > 0 && length >= every) throw new Error("Omitted marks must be fewer than a nonzero gap cycle");
  if (!q.trace && n(q, "weight") > 0 && n(q, "markLength") > 0 &&
      count * steps * n(q, "distance") / n(q, "spacing") > 350_000)
    throw new Error("Arc-length mark count exceeds 350,000");
  oneOf(q, "arrangement", ["grid", "area", "ring"]); oneOf(q, "mark", ["line", "bar", "dot"]); bool(q, "trace");
}
export function validatePlacementMarks(q: Params): void {
  
  number(q, "attempts", 0, 4000, true);
  const minimum = number(q, "minimum", .01, 1000), maximum = number(q, "maximum", .01, 1000);
  if (minimum > maximum) throw new Error("Minimum radius cannot exceed maximum radius");
  for (const [key, lo, hi] of [["separation", .01, 20], ["centerX", -4000, 4000], ["centerY", -4000, 4000], ["extentX", 0, 4000], ["extentY", 0, 4000], ["ringRadius", 0, 3000], ["ringSpacing", 0, 3000], ["phase", -3600, 3600], ["materialScale", 0, 1], ["orientation", -3600, 3600], ["weight", 0, 40]] as const) number(q, key, lo, hi);
  const rings = number(q, "ringCount", 0, 50, true), samples = number(q, "ringSamples", 1, 500, true);
  if (rings * samples > 4000) throw new Error("Radial proposals exceed 4,000 circles");
  if (!q.radial && (n(q, "extentX") <= 0 || n(q, "extentY") <= 0)) throw new Error("Seeded proposal footprint must have positive extents");
  oneOf(q, "mark", ["outline", "diamond", "ring", "circle", "stroke"]); bool(q, "radial");
  if (q.mark !== "circle" && n(q, "materialScale") > 0 &&
    n(q, "weight") > 2 * minimum * n(q, "materialScale") * Math.min(1, n(q, "separation")))
    throw new Error("Stroke weight exceeds the smallest reserved material circle");
}
export function validateLatticeMarks(q: Params): void {
  
  const count = number(q, "count", 0, 500, true), moves = number(q, "steps", 0, 1000, true);
  const columns = number(q, "columns", 1, 200, true), rows = number(q, "rows", 1, 200, true);
  if (count * (moves + 1) > 40_000 || columns * rows > 40_000) throw new Error("Routes or lattice cells exceed the 40,000-cell budget");
  for (const [key, lo, hi] of [["weight", 0, 80], ["dotSize", 0, 80], ["spacingX", .1, 200], ["spacingY", .1, 200], ["centerX", -4000, 4000], ["centerY", -4000, 4000], ["orientation", -3600, 3600]] as const) number(q, key, lo, hi);
  for (const key of ["dots", "grid", "endpoints", "shadow"]) bool(q, key);
  oneOf(q, "layout", ["scatter", "spaced", "center"]);
}

function rng(seed: number, index: number, salt: number): JavaRandom {
  return new JavaRandom((seed ^ Math.imul(index + 1, 0x9e3779b9) ^ salt) >>> 0);
}
export type FieldSample = { x: number; y: number; heading: number; length: number; color: number; index: number };
export type GradientTrajectory = { headingAt(index: number): number; pointInto(index: number, out: Float64Array): Float64Array };
export type CircleSites = { size: number; pointInto(index: number, out: Float64Array): Float64Array; radiusAt(index: number): number; sourceIndexAt(index: number): number; toValues(): { centres: number[][]; radii: number[]; sourceIndices: number[]; attempts: number } };
export type OccupiedRoutes = { pathCount: number; pathLengthAt(index: number): number; cellAt(path: number, index: number): number[]; completionReasonAt(index: number): string; toValues(): { paths: number[][][]; completionReasons: string[]; randomState: number[] } };
export function fieldSource(q: Params, seed: number): FieldSample[] {
  validateFieldMarks(q);
  const out: FieldSample[] = [], columns = n(q, "columns"), rows = n(q, "rows");
  const field = gradientNoise2D01({ seed });
  for (let i = 0; i < columns * rows; i++) {
    const source = rng(seed, i, 0x146e94c7);
    const keep = source.nextDouble(), sx = source.nextDouble(), sy = source.nextDouble();
    if (keep >= n(q, "retention")) continue;
    const x = q.distribution === "grid"
      ? n(q, "centerX") + (i % columns - (columns - 1) / 2) * n(q, "pitch")
      : n(q, "centerX") + (sx - .5) * n(q, "extentX");
    const y = q.distribution === "grid"
      ? n(q, "centerY") + (Math.floor(i / columns) - (rows - 1) / 2) * n(q, "pitch")
      : n(q, "centerY") + (sy - .5) * n(q, "extentY");
    if (q.distribution === "grid" &&
      (Math.abs(x - n(q, "centerX")) > n(q, "extentX") / 2 ||
        Math.abs(y - n(q, "centerY")) > n(q, "extentY") / 2)) continue;
    const orientation = field.sample(17 + x * n(q, "frequency"), 17 + y * n(q, "frequency"));
    const length = field.sample(113 + x * n(q, "frequency") * 1.31, 113 + y * n(q, "frequency") * 1.31);
    out.push({ x, y, index: i, heading: (n(q, "direction") + (orientation - .5) * n(q, "variation")) * Math.PI / 180,
      length: n(q, "minimumLength") + (1 - n(q, "minimumLength")) * length,
      color: field.sample(271 + x * n(q, "frequency") * .67, 271 + y * n(q, "frequency") * .67) });
  }
  return out;
}
export function pathStarts(q: Params, seed: number): Point[] {
  validatePathMarks(q);
  const starts: Point[] = [], angle = n(q, "sourceAngle") * Math.PI / 180, ca = Math.cos(angle), sa = Math.sin(angle);
  for (let i = 0; i < n(q, "pathCount"); i++) {
    const random = rng(seed, i, 0x351c45b3);
    const u = random.nextDouble(), v = random.nextDouble();
    let x: number, y: number;
    if (q.arrangement === "grid") {
      x = (i % n(q, "sourceColumns") / Math.max(1, n(q, "sourceColumns") - 1) - .5) * n(q, "extentX");
      y = (Math.floor(i / n(q, "sourceColumns")) / Math.max(1, n(q, "sourceRows") - 1) - .5) * n(q, "extentY");
    } else {
      const radius = q.arrangement === "ring" ? 1 : Math.sqrt(u);
      const turn = q.arrangement === "ring" ? 2 * Math.PI * (i * .6180339887498949 + v * .04) : 2 * Math.PI * v;
      x = .5 * n(q, "extentX") * radius * Math.cos(turn);
      y = .5 * n(q, "extentY") * radius * Math.sin(turn);
    }
    starts.push([n(q, "centerX") + ca * x - sa * y, n(q, "centerY") + sa * x + ca * y]);
  }
  return starts;
}
export function pathSource(q: Params, seed: number): GradientTrajectory[] {
  const starts = pathStarts(q, seed);
  return starts.map(start => gradientPath2D({ field: { seed }, start, steps: n(q, "steps"), stepDistance: n(q, "distance"),
    fieldScale: n(q, "fieldScale"), fieldOffset: [0, 0], angleBase: n(q, "angleBase"), angleScale: n(q, "angleScale") }));
}
export function placementSource(q: Params, seed: number): CircleSites {
  validatePlacementMarks(q);
  if (!q.radial) return seededCirclePlacement2D({ seed, attempts: n(q, "attempts"),
    origin: [n(q, "centerX") - n(q, "extentX") / 2, n(q, "centerY") - n(q, "extentY") / 2],
    extent: [n(q, "extentX"), n(q, "extentY")], radiusRange: [n(q, "minimum"), n(q, "maximum")],
    separationScale: n(q, "separation") });
  const centres: Point[] = [], radii: number[] = [];
  for (let band = 0; band < n(q, "ringCount"); band++) {
    for (let i = 0; i < n(q, "ringSamples"); i++) {
      const angle = (n(q, "phase") * Math.PI / 180) + 2 * Math.PI * (i + band * .5) / n(q, "ringSamples");
      const distance = n(q, "ringRadius") + band * n(q, "ringSpacing");
      centres.push([n(q, "centerX") + distance * Math.cos(angle), n(q, "centerY") + distance * Math.sin(angle)]);
      const random = rng(seed, band * n(q, "ringSamples") + i, 0x2f503e71);
      radii.push(n(q, "minimum") + (n(q, "maximum") - n(q, "minimum")) * random.nextDouble());
    }
  }
  return orderedCircleFilter2D({ centres, radii, separationScale: n(q, "separation") });
}
export function latticeSource(q: Params, seed: number): OccupiedRoutes {
  validateLatticeMarks(q);
  const columns = n(q, "columns"), rows = n(q, "rows");
  const starts: Point[] = [];
  for (let i = 0; i < n(q, "count"); i++) {
    const random = rng(seed, i, 0x7aa1b362);
    if (q.layout === "scatter") starts.push([Math.floor(random.nextDouble() * columns), Math.floor(random.nextDouble() * rows)]);
    else if (q.layout === "center") {
      const angle = 2 * Math.PI * random.nextDouble(), radius = Math.sqrt(random.nextDouble()) * .25;
      starts.push([Math.min(columns - 1, Math.max(0, Math.floor(columns * (.5 + radius * Math.cos(angle))))),
        Math.min(rows - 1, Math.max(0, Math.floor(rows * (.5 + radius * Math.sin(angle)))))]);
    } else starts.push([((i * 7 + 2) % columns), (Math.floor(i * 7 / columns) * 5 + 2) % rows]);
  }
  return occupiedLatticePaths2D({ dimensions: [columns, rows], starts, maxSteps: n(q, "steps"),
    maxCells: n(q, "count") * (n(q, "steps") + 1), random: { seed } });
}
function color(p: Canvas, rgb: number): void { p.stroke(...channels(rgb)); }
function polygon(p: Canvas, x: number, y: number, radius: number, sides: number, angle = 0): void {
  p.beginShape();
  for (let i = 0; i < sides; i++) {
    const theta = angle + 2 * Math.PI * i / sides;
    p.vertex(x + radius * Math.cos(theta), y + radius * Math.sin(theta));
  }
  p.endShape(p.CLOSE);
}
export function drawBasicSourceInstrument(p: Canvas, l: Layer): void {
  const q = l.params;
  if (l.technique === "field-marks") {
    const marks = fieldSource(q, l.seed);
    if (n(q, "weight") === 0 || n(q, "maxLength") === 0) return;
    p.strokeCap(p.ROUND); p.strokeWeight(n(q, "weight"));
    for (const m of marks) {
      const rgb = l.palette[Math.min(l.palette.length - 1, Math.floor(m.color * l.palette.length))];
      const length = n(q, "maxLength") * m.length;
      const mark = q.mark;
      if (mark === "dot") { p.noStroke(); p.fill(...channels(rgb)); p.circle(m.x, m.y, length); continue; }
      if (mark === "bar") { p.noStroke(); p.fill(...channels(rgb)); }
      else { p.noFill(); color(p, rgb); }
      const ca = Math.cos(m.heading), sa = Math.sin(m.heading);
      if (mark === "line") p.line(m.x - ca * length / 2, m.y - sa * length / 2, m.x + ca * length / 2, m.y + sa * length / 2);
      else {
        const normal = n(q, "weight") / 2;
        p.beginShape();
        p.vertex(m.x - ca * length / 2 - sa * normal, m.y - sa * length / 2 + ca * normal);
        p.vertex(m.x + ca * length / 2 - sa * normal, m.y + sa * length / 2 + ca * normal);
        p.vertex(m.x + ca * length / 2 + sa * normal, m.y + sa * length / 2 - ca * normal);
        p.vertex(m.x - ca * length / 2 + sa * normal, m.y - sa * length / 2 - ca * normal);
        p.endShape(p.CLOSE);
      }
    }
    return;
  }
  if (l.technique === "path-marks") {
    const paths = pathSource(q, l.seed);
    if (n(q, "weight") === 0 || !q.trace && n(q, "markLength") === 0) return;
    p.strokeCap(p.ROUND); p.strokeWeight(n(q, "weight"));
    const a = new Float64Array(2), b = new Float64Array(2);
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i], rgb = l.palette[i % l.palette.length];
      color(p, rgb); p.noFill();
      if (q.trace) {
        for (let step = 0; step < n(q, "steps"); step++) {
          if (n(q, "gapEvery") && Math.floor(step * n(q, "distance") / n(q, "spacing")) % n(q, "gapEvery") < n(q, "gapLength")) continue;
          path.pointInto(step, a); path.pointInto(step + 1, b);
          p.line(a[0], a[1], b[0], b[1]);
        }
        continue;
      }
      const spacing = n(q, "spacing"), total = n(q, "steps") * n(q, "distance"), every = n(q, "gapEvery");
      for (let station = 0; (station + .5) * spacing <= total; station++) {
        if (every && station % every < n(q, "gapLength")) continue;
        const random = rng(l.seed, station, Math.imul(i + 1, 0x426901e7));
        const position = (station + .5 + (random.nextDouble() - .5) * n(q, "regularity") * .8) * spacing;
        if (position > total || n(q, "distance") === 0) continue;
        const step = Math.min(n(q, "steps") - 1, Math.floor(position / n(q, "distance")));
        if (step < 0) continue;
        path.pointInto(step, a); path.pointInto(step + 1, b);
        const t = position / n(q, "distance") - step;
        const angle = path.headingAt(step) + Math.PI / 2, ca = Math.cos(angle), sa = Math.sin(angle);
        const drift = (random.nextDouble() * 2 - 1) * n(q, "drift");
        const x = a[0] + (b[0] - a[0]) * t + ca * drift, y = a[1] + (b[1] - a[1]) * t + sa * drift;
        const length = n(q, "markLength");
        if (q.mark === "dot") { p.noStroke(); p.fill(...channels(rgb)); p.circle(x, y, length); color(p, rgb); continue; }
        if (q.mark === "bar") {
          p.noStroke(); p.fill(...channels(rgb));
          p.beginShape();
          const w = n(q, "weight") / 2;
          p.vertex(x - ca * length / 2 - sa * w, y - sa * length / 2 + ca * w);
          p.vertex(x + ca * length / 2 - sa * w, y + sa * length / 2 + ca * w);
          p.vertex(x + ca * length / 2 + sa * w, y + sa * length / 2 - ca * w);
          p.vertex(x - ca * length / 2 + sa * w, y - sa * length / 2 - ca * w);
          p.endShape(p.CLOSE); color(p, rgb);
        } else p.line(x - ca * length / 2, y - sa * length / 2, x + ca * length / 2, y + sa * length / 2);
      }
    }
    return;
  }
  if (l.technique === "placement-marks") {
    const placed = placementSource(q, l.seed), pt = new Float64Array(2), scale = n(q, "materialScale");
    if (scale === 0) return;
    p.strokeCap(p.ROUND); p.strokeJoin(p.ROUND); p.strokeWeight(n(q, "weight"));
    for (let i = 0; i < placed.size; i++) {
      placed.pointInto(i, pt);
      const allowance = placed.radiusAt(i) * scale * Math.min(1, n(q, "separation"));
      const radius = q.mark === "circle" ? allowance : allowance - n(q, "weight") / 2;
      const rgb = l.palette[placed.sourceIndexAt(i) % l.palette.length];
      color(p, rgb); p.noFill();
      const angle = n(q, "orientation") * Math.PI / 180;
      const mark = q.mark;
      if (mark === "circle") { p.noStroke(); p.fill(...channels(rgb)); p.circle(pt[0], pt[1], 2 * radius); }
      else if (mark === "stroke" && n(q, "weight") > 0) {
        const ca = Math.cos(angle), sa = Math.sin(angle);
        p.line(pt[0] - radius * ca, pt[1] - radius * sa, pt[0] + radius * ca, pt[1] + radius * sa);
      } else if (n(q, "weight") > 0) {
        if (mark === "diamond") polygon(p, pt[0], pt[1], radius, 4, angle);
        else { polygon(p, pt[0], pt[1], radius, 64); if (mark === "ring") polygon(p, pt[0], pt[1], radius * .55, 64); }
      }
    }
    return;
  }
  if (l.technique === "lattice-marks") {
    const paths = latticeSource(q, l.seed), cols = n(q, "columns"), rows = n(q, "rows");
    const angle = n(q, "orientation") * Math.PI / 180, ca = Math.cos(angle), sa = Math.sin(angle);
    const pt = (x: number, y: number): Point => {
      const dx = (x - (cols - 1) / 2) * n(q, "spacingX"), dy = (y - (rows - 1) / 2) * n(q, "spacingY");
      return [n(q, "centerX") + ca * dx - sa * dy, n(q, "centerY") + sa * dx + ca * dy];
    };
    if (q.grid) {
      p.stroke(205, 200, 190); p.strokeWeight(.5);
      for (let x = 0; x < cols; x++) { const a = pt(x, 0), b = pt(x, rows - 1); p.line(...a, ...b); }
      for (let y = 0; y < rows; y++) { const a = pt(0, y), b = pt(cols - 1, y); p.line(...a, ...b); }
    }
    p.strokeCap(p.ROUND); p.strokeJoin(p.ROUND);
    for (let i = 0; i < paths.pathCount; i++) {
      const size = paths.pathLengthAt(i);
      if (!size) continue;
      const rgb = l.palette[i % l.palette.length];
      if (q.dots && n(q, "dotSize") > 0) {
        p.noStroke(); p.fill(...channels(rgb));
        for (let j = 0; j < size; j++) { const cell = paths.cellAt(i, j); const point = pt(cell[0], cell[1]); p.circle(...point, n(q, "dotSize")); }
      } else if (!q.dots && n(q, "weight") > 0) {
        p.noFill(); p.strokeWeight(n(q, "weight"));
        for (const offset of q.shadow ? [3, 0] : [0]) {
          if (offset) p.stroke(30, 30, 30, 70); else color(p, rgb);
          for (let j = 1; j < size; j++) {
            const a = paths.cellAt(i, j - 1), b = paths.cellAt(i, j), from = pt(a[0], a[1]), to = pt(b[0], b[1]);
            p.line(from[0] + offset, from[1] + offset, to[0] + offset, to[1] + offset);
          }
        }
      }
      if (q.endpoints && n(q, "dotSize") > 0) {
        p.noStroke(); p.fill(...channels(rgb));
        for (const j of size === 1 ? [0] : [0, size - 1]) { const cell = paths.cellAt(i, j), point = pt(cell[0], cell[1]); p.circle(...point, n(q, "dotSize")); }
      }
    }
    return;
  }
  throw new Error("Unknown basic source instrument");
}
