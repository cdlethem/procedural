import { oklabRamp } from "@procedurals/javascript";
import type { ControlGroup, Layer } from "../types.js";
import { choice, numeric, text, toggle, type StudioDefinition } from "./types.js";
import { rampStops } from "./color-source.js";

type Params = Layer["params"];
type Point = [number, number];
type Painter = {
  CLOSE: unknown;
  noStroke(): void; noFill(): void;
  fill(r: number, g: number, b: number): void;
  stroke(r: number, g: number, b: number): void; strokeWeight(weight: number): void;
  beginShape(): void; vertex(x: number, y: number): void; endShape(mode?: unknown): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
};
export type BandPolygon = { rank: number; points: Point[] };
export type OrbitArc = { rank: number; points: Point[] };
const radians = Math.PI / 180;
const profileDefault = "[[0,-210,100],[0.3,-170,220],[0.65,-230,150],[1,-80,190]]";
const colorStopsDefault = '["#182940","#74b8a6","#f2bd70"]';
const control = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, integer = false) =>
  numeric(key, label, description, min, max, step, { hardMin, hardMax, integer });
const colorControls = () => [
  choice("colorSource", "Color source", "Use every palette color, or edit independent custom Oklab ramp stops.", ["palette", "custom"]),
  text("colorStops", "Custom color stops", "For custom source: JSON array of 2–32 #RGB or #RRGGBB colors in order.", 1024, true),
  toggle("reverse", "Reverse colors", "Reverse the ramp along band, orbit or arc rank; geometry does not change."),
];
/** Both studies choose their ramp the same way; the orbits' color axis leads it. */
const colorGroup = (...lead: string[]): ControlGroup => ({ label: "Color", controls: [...lead, "colorSource", "colorStops", "reverse"] });

export const perceptualColorDefinitions: StudioDefinition[] = [
  {
    id: "perceptual-bands", title: "Perceptual bands",
    description: "Sculpt an Oklab color field with an editable piecewise-linear edge profile and open rank-cell gaps.",
    parameters: [
      control("bands", "Bands", "Number of global ramp ranks; zero paints nothing.", 2, 80, 1, 0, 512, true),
      text("profile", "Edge profile", "JSON rows [height fraction, left X, right X]; include 0 and 1 with strictly increasing fractions. X is relative to Center X.", 4096, true),
      control("height", "Height", "Total source height in canvas units; zero paints nothing.", 0, 600, 1, 0, 10000),
      control("centerX", "Center X", "Profile origin in canvas units; does not alter the stored profile.", 0, 640, 1, -10000, 10000),
      control("centerY", "Center Y", "Vertical center of the untrimmed source in canvas units.", 0, 640, 1, -10000, 10000),
      control("rotation", "Rotation °", "Rotate the whole profile around its center.", -180, 180, 1, -36000, 36000),
      control("bandCoverage", "Band coverage", "Paint this centered fraction of each band cell, leaving transparent gaps.", 0, 1, .01, 0, 1),
      control("from", "From", "First retained global height fraction; does not restretch shape or colors.", 0, 1, .01, 0, 1),
      control("to", "To", "Last retained global height fraction; does not restretch shape or colors.", 0, 1, .01, 0, 1),
      ...colorControls(),
    ],
    controlGroups: [
      { label: "Profile", controls: ["profile", "height"] },
      { label: "Placement", controls: ["centerX", "centerY", "rotation"] },
      { label: "Bands", controls: ["bands", "bandCoverage", { label: "Range", controls: ["from", "to"] }] },
      colorGroup(),
    ],
    defaults: { bands: 24, profile: profileDefault, height: 420, centerX: 320, centerY: 320,
      rotation: -15, bandCoverage: .72, from: 0, to: 1, colorSource: "palette", colorStops: colorStopsDefault, reverse: false },
    validate: validatePerceptualBands,
  },
  {
    id: "oklab-orbits", title: "Oklab orbits",
    description: "Open elliptical arc stacks with eccentric centers and an Oklab gradient across ranks or along each arc.",
    parameters: [
      control("orbits", "Orbits", "Number of elliptical arc ranks; one uses the first radius and center.", 2, 80, 1, 0, 256, true),
      control("innerRadius", "Inner radius", "First orbit's horizontal radius in canvas units.", 0, 300, 1, 0, 10000),
      control("outerRadius", "Outer radius", "Last orbit's horizontal radius before rank spacing power.", 0, 500, 1, 0, 10000),
      control("spacingPower", "Spacing power", "Radius rank follows rank fraction raised to this power.", .1, 3, .05, .1, 10),
      control("aspect", "Ellipse aspect", "Vertical radius divided by horizontal radius before rotating the arc.", .1, 2, .01, .05, 20),
      control("driftX", "Total drift X", "Total unrotated center displacement from first to last orbit.", -250, 250, 1, -10000, 10000),
      control("driftY", "Total drift Y", "Total unrotated center displacement from first to last orbit.", -250, 250, 1, -10000, 10000),
      control("twist", "Total twist °", "Total rotation of arc orientation between first and last orbit.", -360, 360, 1, -36000, 36000),
      control("startAngle", "Arc start °", "Starting angle on the unrotated ellipse; sweep adds to it, with sign preserved.", -360, 360, 1, -36000, 36000),
      control("sweep", "Signed sweep °", "Signed arc span; ±360 closes a ring, zero paints nothing.", -360, 360, 1, -720, 720),
      control("segments", "Segments", "Straight segments per orbit; orbit count × segments must not exceed 60000.", 2, 256, 1, 2, 2048, true),
      control("weight", "Stroke weight", "Line width in canvas units; zero paints nothing.", 0, 8, .1, 0, 100),
      choice("colorAxis", "Color axis", "Color by orbit rank or by successive segments along each arc.", ["rank", "arc"]),
      control("centerX", "Center X", "First orbit's center in canvas units.", 0, 640, 1, -10000, 10000),
      control("centerY", "Center Y", "First orbit's center in canvas units.", 0, 640, 1, -10000, 10000),
      control("rotation", "Global rotation °", "Rotate drift and all elliptical arcs around the first center.", -180, 180, 1, -36000, 36000),
      ...colorControls(),
    ],
    controlGroups: [
      { label: "Orbits", controls: ["orbits", { label: "Radii", controls: ["innerRadius", "outerRadius"], proportional: true }, "spacingPower", "aspect"] },
      { label: "Arcs", controls: ["startAngle", "sweep", "segments", "weight"] },
      { label: "Placement", controls: ["centerX", "centerY", "rotation"] },
      { label: "Drift", controls: ["driftX", "driftY", "twist"] },
      colorGroup("colorAxis"),
    ],
    defaults: { orbits: 22, innerRadius: 32, outerRadius: 240, spacingPower: 1, aspect: .65,
      driftX: 90, driftY: -40, twist: 70, startAngle: -140, sweep: 250, segments: 96, weight: 2,
      colorAxis: "rank", centerX: 280, centerY: 340, rotation: 0,
      colorSource: "palette", colorStops: colorStopsDefault, reverse: false },
    validate: validateOklabOrbits,
  },
];

function bounded(q: Params, key: string, min: number, max: number, integer = false): number {
  const value = q[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value)))
    throw Error(`${key} must be ${integer ? "an integer" : "a finite number"} in [${min}, ${max}]`);
  return value;
}
function validateColors(q: Params): void {
  if (q.colorSource !== "palette" && q.colorSource !== "custom") throw Error("colorSource must be palette or custom");
  if (typeof q.colorStops !== "string" || q.colorStops.length > 1024) throw Error("colorStops must be text of at most 1024 characters");
  if (typeof q.reverse !== "boolean") throw Error("reverse must be boolean");
  if (q.colorSource === "custom") rampStops([], "custom", q.colorStops);
}
export function bandProfile(q: Params): [number, number, number][] {
  if (typeof q.profile !== "string" || q.profile.length > 4096) throw Error("profile must be JSON text of at most 4096 characters");
  let rows: unknown;
  try { rows = JSON.parse(q.profile); }
  catch { throw Error("profile must be a JSON array of [t,leftX,rightX] rows"); }
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 64)
    throw Error("profile requires 2 to 64 rows");
  const knots: [number, number, number][] = rows.map((row: unknown, index) => {
    if (!Array.isArray(row) || row.length !== 3 || row.some(value => typeof value !== "number" || !Number.isFinite(value)))
      throw Error(`profile row ${index + 1} must contain three finite numbers`);
    const [t, left, right] = row;
    if (t < 0 || t > 1 || Math.abs(left) > 10000 || Math.abs(right) > 10000 || left > right)
      throw Error(`profile row ${index + 1} requires t in [0,1], X in [-10000,10000] and left <= right`);
    if (index && t <= (rows[index - 1] as number[])[0]) throw Error("profile t values must strictly increase");
    return [t, left, right];
  });
  if (knots[0][0] !== 0 || knots[knots.length - 1][0] !== 1) throw Error("profile endpoints must be 0 and 1");
  return knots;
}
function validateBandControls(q: Params): void {
  bounded(q, "bands", 0, 512, true);
  bounded(q, "height", 0, 10000);
  bounded(q, "centerX", -10000, 10000); bounded(q, "centerY", -10000, 10000);
  bounded(q, "rotation", -36000, 36000);
  bounded(q, "bandCoverage", 0, 1); bounded(q, "from", 0, 1); bounded(q, "to", 0, 1);
  if (Number(q.from) > Number(q.to)) throw Error("from must be <= to");
  validateColors(q);
}
export function validatePerceptualBands(q: Params): void {
  validateBandControls(q);
  bandProfile(q);
}
export function validateOklabOrbits(q: Params): void {
  const count = bounded(q, "orbits", 0, 256, true), segments = bounded(q, "segments", 2, 2048, true);
  if (count * segments > 60000) throw Error("orbits × segments must not exceed 60000");
  if (bounded(q, "innerRadius", 0, 10000) > bounded(q, "outerRadius", 0, 10000))
    throw Error("innerRadius must be <= outerRadius");
  bounded(q, "spacingPower", .1, 10); bounded(q, "aspect", .05, 20);
  bounded(q, "driftX", -10000, 10000); bounded(q, "driftY", -10000, 10000);
  bounded(q, "twist", -36000, 36000); bounded(q, "startAngle", -36000, 36000);
  bounded(q, "sweep", -720, 720); bounded(q, "weight", 0, 100);
  bounded(q, "centerX", -10000, 10000); bounded(q, "centerY", -10000, 10000);
  bounded(q, "rotation", -36000, 36000);
  if (q.colorAxis !== "rank" && q.colorAxis !== "arc") throw Error("colorAxis must be rank or arc");
  validateColors(q);
}
function rotated(x: number, y: number, cosine: number, sine: number): Point {
  return [x * cosine - y * sine, x * sine + y * cosine];
}
/** Original untrimmed rank cells determine geometry; each in-band profile knot becomes a polygon vertex. */
export function perceptualBandPolygons(q: Params): BandPolygon[] {
  validateBandControls(q);
  const knots = bandProfile(q);
  const count = q.bands as number, height = q.height as number, coverage = q.bandCoverage as number;
  if (!count || !height || !coverage || q.from === q.to) return [];
  const angle = (q.rotation as number) * radians;
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  const point = (t: number, x: number): Point => {
    const [dx, dy] = rotated(x, height * (t - .5), cosine, sine);
    return [(q.centerX as number) + dx, (q.centerY as number) + dy];
  };
  const knotTimes = knots.slice(1, -1).map(row => row[0]);
  const polygons: BandPolygon[] = [];
  for (let rank = 0; rank < count; rank++) {
    const low = Math.max(q.from as number, (rank + (1 - coverage) / 2) / count);
    const high = Math.min(q.to as number, (rank + (1 + coverage) / 2) / count);
    if (low >= high) continue;
    const stations = [low];
    for (const t of knotTimes) if (t > low && t < high) stations.push(t);
    stations.push(high);
    let interval = 0;
    const edges = stations.map(t => {
      while (interval < knots.length - 2 && t > knots[interval + 1][0]) interval++;
      const a = knots[interval], b = knots[interval + 1], u = (t - a[0]) / (b[0] - a[0]);
      return [a[1] + u * (b[1] - a[1]), a[2] + u * (b[2] - a[2])] as Point;
    });
    polygons.push({ rank, points: [
      ...stations.map((t, index) => point(t, edges[index][0])),
      ...stations.map((_, index) => stations.length - 1 - index)
        .map(index => point(stations[index], edges[index][1])),
    ] });
  }
  return polygons;
}

/** Each arc is an explicit signed path; layout is independent of palette and color axis. */
export function oklabOrbitArcs(q: Params): OrbitArc[] {
  validateOklabOrbits(q);
  const count = q.orbits as number, segments = q.segments as number;
  if (!count || !q.sweep || !q.weight) return [];
  const global = (q.rotation as number) * radians, cosGlobal = Math.cos(global), sinGlobal = Math.sin(global);
  const arcs: OrbitArc[] = [];
  for (let rank = 0; rank < count; rank++) {
    const t = count === 1 ? 0 : rank / (count - 1);
    const radius = (q.innerRadius as number) + ((q.outerRadius as number) - (q.innerRadius as number)) * Math.pow(t, q.spacingPower as number);
    const [dx, dy] = rotated(t * (q.driftX as number), t * (q.driftY as number), cosGlobal, sinGlobal);
    const angle = global + t * (q.twist as number) * radians, cosine = Math.cos(angle), sine = Math.sin(angle);
    const points: Point[] = [];
    for (let station = 0; station <= segments; station++) {
      const theta = ((q.startAngle as number) + (q.sweep as number) * station / segments) * radians;
      const [x, y] = rotated(radius * Math.cos(theta), radius * (q.aspect as number) * Math.sin(theta), cosine, sine);
      points.push([(q.centerX as number) + dx + x, (q.centerY as number) + dy + y]);
    }
    arcs.push({ rank, points });
  }
  return arcs;
}

/** SDK handles every multi-station ramp; a sole rank takes the first source stop. */
export function perceptualRampColors(layer: Layer, count: number): number[][] {
  if (!Number.isSafeInteger(count) || count < 0) throw Error("Ramp count must be a nonnegative integer");
  const q = layer.params, stops = rampStops(layer.palette, q.colorSource as string, q.colorStops as string);
  if (q.reverse) stops.reverse();
  return count === 0 ? [] : count === 1 ? [stops[0].slice()] :
    oklabRamp({ stops, count, maxWork: stops.length + count }).colors;
}
function ink(p: Painter, rgb: number[], kind: "fill" | "stroke"): void {
  p[kind](rgb[0] * 255, rgb[1] * 255, rgb[2] * 255);
}
export function drawPerceptualColor(p: Painter, layer: Layer): void {
  if (layer.technique === "perceptual-bands") {
    const polygons = perceptualBandPolygons(layer.params);
    if (!polygons.length) return;
    const colors = perceptualRampColors(layer, layer.params.bands as number);
    p.noStroke();
    for (const polygon of polygons) {
      ink(p, colors[polygon.rank], "fill");
      p.beginShape();
      for (const [x, y] of polygon.points) p.vertex(x, y);
      p.endShape(p.CLOSE);
    }
    return;
  }
  if (layer.technique === "oklab-orbits") {
    const arcs = oklabOrbitArcs(layer.params);
    if (!arcs.length) return;
    const q = layer.params, axis = q.colorAxis;
    const colors = perceptualRampColors(layer, axis === "rank" ? q.orbits as number : q.segments as number);
    p.noFill(); p.strokeWeight(q.weight as number);
    for (const arc of arcs) {
      if (axis === "rank") {
        ink(p, colors[arc.rank], "stroke");
        p.beginShape();
        for (const [x, y] of arc.points) p.vertex(x, y);
        p.endShape();
      } else {
        for (let index = 0; index < arc.points.length - 1; index++) {
          ink(p, colors[index], "stroke");
          p.line(...arc.points[index], ...arc.points[index + 1]);
        }
      }
    }
    return;
  }
  throw Error(`Unknown perceptual color instrument ${layer.technique}`);
}
