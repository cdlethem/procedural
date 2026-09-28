import { chaikinPolyline2D, convexHull2D, resamplePolyline2D } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { Layer, Parameter } from "../types.js";
import { strokeWith } from "../composition/core.js";
import type { Path as CompositionPath } from "../composition/types.js";
import { sourcePaths } from "./paths-a-gestures.js";
import { channels, choice, numeric, toggle, type StudioDefinition } from "./types.js";

type Point = [number, number];
type Params = Layer["params"];
type PathId = "stitched-contours" | "fragmented-lines" | "stitched-paths";
type HullId = "scatter-envelopes" | "terraced-islands";
type Painter = {
  push(): void; pop(): void;
  ROUND: unknown; CLOSE: unknown;
  noFill(): void; noStroke(): void; strokeCap(cap: unknown): void;
  strokeWeight(weight: number): void;
  stroke(r: number, g: number, b: number, alpha: number): void;
  fill(r: number, g: number, b: number, alpha: number): void;
  beginShape(): void; vertex(x: number, y: number): void; endShape(mode?: unknown): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  circle(x: number, y: number, size: number): void;
};
const n = (q: Params, key: string) => Number(q[key]);
const num = (key: string, label: string, description: string, low: number, high: number,
  hardLow: number, hardHigh: number, step = 1, integer = false) =>
  numeric(key, label, description, low, high, step, { hardMin: hardLow, hardMax: hardHigh, integer });

const pathParameters: Parameter[] = [num("lines", "Paths", "Independent trajectories across the local source.", 1, 22, 1, 100, 1, true),
  num("waves", "Bend cycles", "Frequency of the trajectory's bend; zero gives a straight run.", 0, 3, -100, 100, .05),
  num("gaps", "Gap rhythm", "Keep this many sample slots, then leave one out; zero disables rhythmic gaps.", 0, 12, 0, 1000, 1, true),
  num("weight", "Stroke weight", "Line and bar stroke width.", 0, 7, 0, 100, .25),
  num("sourceSpan", "Path span", "Long runs or short local tufts.", 15, 580, 0, 10000),
  num("amplitude", "Crosswise bend", "Reach across the path direction.", -100, 100, -10000, 10000),
  num("forwardBend", "Travel fold", "Push and pull along the direction for loops and folds.", -100, 100, -10000, 10000),
  num("disorder", "Seeded disorder", "Blend coherent noise into each trajectory.", 0, 1, 0, 1, .01),
  num("sourcePoints", "Source samples", "Samples before one corner-cut smoothing pass.", 4, 55, 2, 1000, 1, true),
  num("direction", "Direction", "Travel angle in degrees; path spacing follows its normal.", -180, 180, -1000000, 1000000),
  num("sourceCenterX", "Center X", "Local source center, without fitting to the page.", 0, 720, -10000, 10000),
  num("sourceCenterY", "Center Y", "Local source center.", 0, 720, -10000, 10000),
  num("spacing", "Path separation", "Signed distance between trajectory centers.", -100, 100, -10000, 10000),
  num("variation", "Placement variation", "Seeded displacement and phase variation for each path.", 0, 70, 0, 10000),
  num("sampleSpacing", "Mark spacing", "Approximate arc distance between marks; independent of source vertices.", 4, 42, .5, 2000, .5),
  choice("material", "Material", "Continuous line, short dash, paired stitch, cross-bar or tapered leaf.", ["line", "dash", "paired-stitch", "bar", "leaf"]),
  num("markLength", "Mark length", "Length of each dash, stitch, bar or leaf.", 2, 28, 0, 1000, .5),
  num("markWidth", "Mark width", "Spacing between paired stitches or leaf breadth.", 1, 14, 0, 1000, .5),
  num("markAngle", "Mark angle", "Degrees relative to the local path tangent.", -90, 90, -3600, 3600),
  num("omitChance", "Seeded omission", "Probability of omitting each mark; random sequence is independent of material.", 0, .7, 0, 1, .01)];
const scatterParameters: Parameter[] = [num("count", "Sites", "Total sites divided between groups, at least three per hull.", 3, 110, 3, 300, 1, true),
  num("weight", "Outline weight", "Perimeter stroke width.", 0, 6, 0, 100, .25),
  num("inset", "Source dot size", "Diameter of optional original site marks.", 0, 20, 0, 1000, .5),
  choice("support", "Population support", "Ellipse area, annulus or elongated line swath.", ["area", "ring", "line"]),
  num("extent", "Population radius", "Longitudinal radius of each group.", 20, 260, .01, 5000),
  num("aspect", "Crosswise aspect", "Transverse radius divided by longitudinal radius.", .1, 2, .01, 20, .01),
  num("innerRing", "Ring opening", "Inner radius as a fraction of the outer radius.", 0, .9, 0, .99, .01),
  num("centerX", "Center X", "Local population center.", 0, 720, -10000, 10000),
  num("centerY", "Center Y", "Local population center.", 0, 720, -10000, 10000),
  num("direction", "Direction", "Turn the long axis in degrees.", -180, 180, -3600, 3600),
  num("clusterCount", "Groups", "Separate independently populated hulls.", 1, 8, 1, 30, 1, true),
  num("clusterSpread", "Group spread", "Maximum seeded displacement of each group center from the common center.", 0, 220, 0, 5000),
  toggle("showDots", "Source dots", "Show the original, not just the hull sites."),
  toggle("filled", "Fill hulls", "Transparent palette fill under the optional outline."),
  toggle("outlined", "Outline hulls", "Draw convex perimeter separately from source dots.")];
const terraceParameters: Parameter[] = [num("count", "Sites per island", "Independent seeded sites for every island boundary.", 3, 55, 3, 300, 1, true),
  num("terraces", "Terrace levels", "Nested copies of each one stable source hull.", 1, 12, 1, 60, 1, true),
  num("weight", "Outline weight", "Terrace perimeter width.", 0, 6, 0, 100, .25),
  num("islands", "Islands", "Number of independently seeded contours.", 1, 8, 1, 30, 1, true),
  num("spread", "Island spread", "Maximum seeded displacement of island centers.", 0, 240, 0, 5000),
  num("radius", "Outer radius", "Initial island radius; no automatic page fitting.", 20, 240, .01, 5000),
  num("aspect", "Crosswise aspect", "Island height-to-width ratio before rotation.", .2, 2, .01, 20, .01),
  num("disorder", "Point disorder", "Seeded radial variation of site positions.", 0, 1, 0, 1, .01),
  num("centerX", "Center X", "Local island-group center.", 0, 720, -10000, 10000),
  num("centerY", "Center Y", "Local island-group center.", 0, 720, -10000, 10000),
  num("direction", "Direction", "Common orientation in degrees.", -180, 180, -3600, 3600),
  num("terraceScale", "Terrace scale", "Multiplicative scale applied to each next level.", .6, 1, .01, 1, .01),
  num("terraceSpacing", "Terrace inset", "Additional linear radius reduction per level; must leave a positive inner radius.", 0, 12, 0, 5000, .5),
  num("inset", "Source dot size", "Diameter of optional original sites.", 0, 16, 0, 1000, .5),
  toggle("showDots", "Source dots", "Reveal the stable original sites of each island."),
  toggle("filled", "Fill terraces", "Fill each nested level with translucent color."),
  toggle("outlined", "Outline terraces", "Outline all levels, independently of fill and dots.")];
const pathDefaults = {lines: 7,
  waves: 1.25,
  gaps: 0,
  weight: 1.5,
  sourceSpan: 400,
  amplitude: 55,
  forwardBend: 52,
  disorder: .28,
  sourcePoints: 24,
  direction: -16,
  sourceCenterX: 360,
  sourceCenterY: 360,
  spacing: 53,
  variation: 13,
  sampleSpacing: 12,
  material: "paired-stitch",
  markLength: 13,
  markWidth: 7,
  markAngle: 65,
  omitChance: .09};
const scatterDefaults = {count: 44,
  weight: 2,
  inset: 18,
  support: "area",
  extent: 195,
  aspect: .75,
  innerRing: .52,
  centerX: 360,
  centerY: 360,
  direction: 0,
  clusterCount: 1,
  clusterSpread: 180,
  showDots: true,
  filled: false,
  outlined: true};
const terraceDefaults = {count: 38,
  terraces: 6,
  weight: 2,
  islands: 1,
  spread: 160,
  radius: 230,
  aspect: .85,
  disorder: .55,
  centerX: 360,
  centerY: 360,
  direction: 0,
  terraceScale: .91,
  terraceSpacing: 4,
  inset: 4,
  showDots: false,
  filled: false,
  outlined: true};
export const pathMaterialInstrumentDefinitions: StudioDefinition[] = [
  { id: "stitched-contours", title: "Stitched contours", description: "Arc-length material sewn along independently seeded local trajectories.",
    parameters: pathParameters, defaults: pathDefaults, validate: q => validatePathMaterialInstrument("stitched-contours", q) },
  { id: "fragmented-lines", title: "Fragmented lines", description: "Broken, omittable traces on the same editable trajectories and material vocabulary.",
    parameters: pathParameters, defaults: { ...pathDefaults, lines: 12, waves: 1.7, gaps: 4, weight: 2, sourceSpan: 460,
      amplitude: 36, forwardBend: 35, spacing: 34, variation: 17, material: "dash", markLength: 20,
      markWidth: 5, markAngle: 0, omitChance: .28 }, validate: q => validatePathMaterialInstrument("fragmented-lines", q) },
  { id: "stitched-paths", title: "Stitched paths", description: "Arc-spaced transverse marks on editable local waves and folded trajectories.",
    parameters: [...pathParameters],
    defaults: {...pathDefaults,
      lines: 8,
      waves: 1.8,
      amplitude: 24,
      forwardBend: 0,
      disorder: 0,
      direction: -8,
      sourceCenterX: 320,
      sourceCenterY: 320,
      sourceSpan: 450,
      spacing: 38,
      variation: 14,
      material: "bar",
      markLength: 9,
      markWidth: 0,
      markAngle: 90,
      omitChance: 0,
      sampleSpacing: 9,
      weight: 1.2},
    validate: q => validatePathMaterialInstrument("stitched-paths", q) },
  { id: "scatter-envelopes", title: "Scatter envelopes", description: "Convex hulls around seeded sites in editable local supports and separate groups.",
    parameters: scatterParameters, defaults: scatterDefaults, validate: q => validatePathMaterialInstrument("scatter-envelopes", q) },
  { id: "terraced-islands", title: "Terraced islands", description: "Independently seeded islands, each with scaled nested copies of its actual convex hull.",
    parameters: terraceParameters, defaults: terraceDefaults, validate: q => validatePathMaterialInstrument("terraced-islands", q) },
];
function checked(q: Params, key: string, min: number, max: number, integer = false): number {
  const value = q[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max ||
    (integer && !Number.isSafeInteger(value)))
    throw new Error(`${key} must be ${integer ? "an integer" : "a finite number"} in [${min}, ${max}]`);
  return value;
}
function enumeration(q: Params, key: string, choices: readonly string[]): void {
  if (!choices.includes(String(q[key]))) throw new Error(`${key} must be one of ${choices.join(", ")}`);
}
function boolean(q: Params, key: string): void {
  if (typeof q[key] !== "boolean") throw new Error(`${key} must be boolean`);
}
const PATH_WORK = 200_000;
const HULL_WORK = 1_500_000;
export function validatePathMaterialInstrument(id: PathId | HullId, q: Params): void {
  
  if (id === "stitched-contours" || id === "fragmented-lines" || id === "stitched-paths") {
    const lines = checked(q, "lines", 1, 100, true), points = checked(q, "sourcePoints", 2, 1000, true);
    for (const [key, low, high] of [["waves", -100, 100], ["weight", 0, 100], ["sourceSpan", 0, 10000],
      ["amplitude", -10000, 10000], ["forwardBend", -10000, 10000], ["disorder", 0, 1],
      ["direction", -1000000, 1000000], ["sourceCenterX", -10000, 10000],
      ["sourceCenterY", -10000, 10000], ["spacing", -10000, 10000], ["variation", 0, 10000],
      ["sampleSpacing", .5, 2000], ["markLength", 0, 1000], ["markWidth", 0, 1000],
      ["markAngle", -3600, 3600], ["omitChance", 0, 1]] as const) checked(q, key, low, high);
    checked(q, "gaps", 0, 1000, true);
    enumeration(q, "material", ["line", "dash", "paired-stitch", "bar", "leaf"]);
    // The source builder's documented worst case is quadratic; one corner-cut pass doubles samples.
    if (lines * (points ** 2 + 7 * points) > PATH_WORK)
      throw new Error("Paths × source points × smoothing exceeds generation budget");
  } else {
    const count = checked(q, "count", 3, 300, true);
    checked(q, "weight", 0, 100); checked(q, "inset", 0, 1000);
    for (const key of ["showDots", "filled", "outlined"]) boolean(q, key);
    checked(q, "centerX", -10000, 10000); checked(q, "centerY", -10000, 10000);
    checked(q, "direction", -3600, 3600); checked(q, "aspect", .01, 20);
    if (id === "scatter-envelopes") {
      const groups = checked(q, "clusterCount", 1, 30, true);
      checked(q, "extent", .01, 5000); checked(q, "innerRing", 0, .99);
      checked(q, "clusterSpread", 0, 5000);
      enumeration(q, "support", ["area", "ring", "line"]);
      if (count < 3 * groups) throw new Error("Each hull group requires at least three sites");
      if (count ** 2 + count * groups > HULL_WORK) throw new Error("Sites × groups exceeds hull generation budget");
    } else {
      const islands = checked(q, "islands", 1, 30, true), terraces = checked(q, "terraces", 1, 60, true);
      const radius = checked(q, "radius", .01, 5000);
      checked(q, "spread", 0, 5000); checked(q, "disorder", 0, 1);
      checked(q, "terraceScale", .01, 1);
      const gap = checked(q, "terraceSpacing", 0, 5000);
      if (radius - (terraces - 1) * gap <= 0) throw new Error("Terrace inset must leave a positive innermost radius");
      if (islands * (count ** 2 + count * terraces + count) > HULL_WORK)
        throw new Error("Sites × islands × terraces exceeds hull generation budget");
    }
  }
}
function boundedCache<T>(cache: Map<string, T>, key: string, build: () => T): T {
  const hit = cache.get(key);
  if (hit !== undefined) { cache.delete(key); cache.set(key, hit); return hit; }
  const result = build(); cache.set(key, result);
  if (cache.size > 6) cache.delete(cache.keys().next().value!);
  return result;
}
const trajectoryCache = new Map<string, Point[][]>();
const pathKeys = ["lines", "waves", "sourceSpan", "amplitude", "forwardBend", "disorder", "sourcePoints",
  "direction", "sourceCenterX", "sourceCenterY", "spacing", "variation"];
/** The returned source contains no material, mark, palette or omission settings. */
export function pathMaterialSources(q: Params, seed: number): Point[][] {
  validatePathMaterialInstrument("stitched-contours", q);
  return boundedCache(trajectoryCache, JSON.stringify([seed, ...pathKeys.map(key => q[key])]), () => {
    const source = sourcePaths("gesture-skeletons", { ...q, gestures: q.lines, frequency: q.waves,
      tolerance: 0, showNodes: false, nodeSize: 0 }, seed);
    return source.map(points => chaikinPolyline2D({ points, closed: false, iterations: 1,
      maxWork: points.length * 3 }).points as Point[]);
  });
}
export type HullGroup = { center: Point; sites: Point[]; hull: Point[] };
const scatterCache = new Map<string, HullGroup[]>();
const scatterKeys = ["count", "support", "extent", "aspect", "innerRing", "centerX", "centerY",
  "direction", "clusterCount", "clusterSpread"];
function transform(x: number, y: number, cx: number, cy: number, angle: number): Point {
  return [cx + x * Math.cos(angle) - y * Math.sin(angle), cy + x * Math.sin(angle) + y * Math.cos(angle)];
}
export function scatterEnvelopeSources(q: Params, seed: number): HullGroup[] {
  validatePathMaterialInstrument("scatter-envelopes", q);
  return boundedCache(scatterCache, JSON.stringify([seed, ...scatterKeys.map(key => q[key])]), () => {
    const groups: HullGroup[] = [], count = n(q, "count"), total = n(q, "clusterCount");
    const angle = n(q, "direction") * Math.PI / 180;
    for (let group = 0; group < total; group++) {
      const random = new JavaRandom((seed + Math.imul(group + 1, 0x9e3779b9)) >>> 0);
      const displacement = total === 1 ? 0 : Math.sqrt(random.nextDouble()) * n(q, "clusterSpread");
      const theta = random.nextDouble() * Math.PI * 2;
      const center = transform(displacement * Math.cos(theta), displacement * Math.sin(theta),
        n(q, "centerX"), n(q, "centerY"), angle);
      const sites: Point[] = [];
      const siteCount = Math.floor(count / total) + (group < count % total ? 1 : 0);
      for (let i = 0; i < siteCount; i++) {
        let x: number, y: number;
        if (q.support === "line") {
          x = (random.nextDouble() * 2 - 1) * n(q, "extent");
          y = (random.nextDouble() + random.nextDouble() - 1) * n(q, "extent") * n(q, "aspect");
        } else {
          const phase = random.nextDouble() * Math.PI * 2;
          const inner = q.support === "ring" ? n(q, "innerRing") : 0;
          const radius = Math.sqrt(inner ** 2 + random.nextDouble() * (1 - inner ** 2)) * n(q, "extent");
          x = Math.cos(phase) * radius;
          y = Math.sin(phase) * radius * n(q, "aspect");
        }
        sites.push(transform(x, y, center[0], center[1], angle));
      }
      const hull = convexHull2D({ points: sites, maxWork: siteCount ** 2 + siteCount }).points as Point[];
      groups.push({ center, sites, hull });
    }
    return groups;
  });
}
const islandCache = new Map<string, HullGroup[]>();
const islandKeys = ["count", "islands", "spread", "radius", "aspect", "disorder", "centerX", "centerY", "direction"];
export function terracedIslandSources(q: Params, seed: number): HullGroup[] {
  validatePathMaterialInstrument("terraced-islands", q);
  return boundedCache(islandCache, JSON.stringify([seed, ...islandKeys.map(key => q[key])]), () => {
    const islands: HullGroup[] = [], total = n(q, "islands"), count = n(q, "count");
    const direction = n(q, "direction") * Math.PI / 180;
    for (let index = 0; index < total; index++) {
      const random = new JavaRandom((seed + Math.imul(index + 1, 0x51ed270b)) >>> 0);
      const shift = total === 1 ? 0 : Math.sqrt(random.nextDouble()) * n(q, "spread");
      const theta = random.nextDouble() * Math.PI * 2;
      const center = transform(shift * Math.cos(theta), shift * Math.sin(theta),
        n(q, "centerX"), n(q, "centerY"), direction);
      const phase = random.nextDouble() * Math.PI * 2;
      const sites: Point[] = [];
      for (let j = 0; j < count; j++) {
        const a = phase + j * 2 * Math.PI / count;
        const r = n(q, "radius") * (1 - n(q, "disorder") * .7 * random.nextDouble());
        sites.push(transform(Math.cos(a) * r, Math.sin(a) * r * n(q, "aspect"), center[0], center[1], direction));
      }
      const hull = convexHull2D({ points: sites, maxWork: count ** 2 + count }).points as Point[];
      islands.push({ center, sites, hull });
    }
    return islands;
  });
}
/** An inner level is a homothetic copy of the same island, so contours never cross. */
export function terraceLevel(group: HullGroup, q: Params, level: number): Point[] {
  const scale = n(q, "terraceScale") ** level * (1 - level * n(q, "terraceSpacing") / n(q, "radius"));
  return group.hull.map(([x, y]): Point => [group.center[0] + (x - group.center[0]) * scale,
    group.center[1] + (y - group.center[1]) * scale]);
}
function color(p: Painter, layer: Layer, index: number, fill: boolean, alpha: number): void {
  const [r, g, b] = channels((layer.palette.length ? layer.palette[index % layer.palette.length] : 0x222222) >>> 0);
  if (fill) p.fill(r, g, b, alpha); else p.stroke(r, g, b, alpha);
}
function polygon(p: Painter, points: readonly (readonly [number, number])[], close: boolean): void {
  p.beginShape(); for (const [x, y] of points) p.vertex(x, y);
  p.endShape(close ? p.CLOSE : undefined);
}
const materialPathFrames = new WeakMap<Point[][], readonly CompositionPath[]>();
function drawPaths(p: Painter, layer: Layer): void {
  const q = layer.params, paths = pathMaterialSources(q, layer.seed), material = q.material;
  // Budget actual arc lengths before allocating any resampling buffers or painting.
  const counts = paths.map(path => {
    let length = 0;
    for (let i = 1; i < path.length; i++) length += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    return Math.max(2, Math.floor(length / n(q, "sampleSpacing")) + 1);
  });
  if (counts.reduce((sum, count, index) => sum + count + paths[index].length, 0) > PATH_WORK)
    throw new Error("Arc-length marks × paths exceeds generation budget");
  p.strokeCap(p.ROUND); p.strokeWeight(n(q, "weight"));
  let index = 0;
  let frames = materialPathFrames.get(paths);
  if (!frames) {
    frames = paths.map((points, id) => ({
      id: `path:${id}`, seed: layer.seed, points, closed: false, level: 0, levelFraction: 0,
    }));
    materialPathFrames.set(paths, frames);
  }
  strokeWith(p, frames, (canvas, path) => {
    const pathIndex = index++;
    const points = path.points;
    color(canvas, layer, pathIndex, false, 220);
    if (material === "line") {
      if (n(q, "weight") > 0) { canvas.noFill(); polygon(canvas, points, false); }
      return;
    }
    const result = resamplePolyline2D({ points, closed: false, count: counts[pathIndex],
      maxWork: points.length + counts[pathIndex] });
    const random = new JavaRandom((layer.seed ^ Math.imul(pathIndex + 1, 0x7f4a7c15)) >>> 0);
    for (let i = 0; i < result.points.length; i++) {
      const chance = random.nextDouble();
      if (chance < n(q, "omitChance") || (n(q, "gaps") > 0 && i % (n(q, "gaps") + 1) === n(q, "gaps"))) continue;
      const [x, y] = result.points[i], segment = result.sourceSegments[i];
      let dx = points[segment + 1][0] - points[segment][0], dy = points[segment + 1][1] - points[segment][1];
      if (dx === 0 && dy === 0) {
        const next = result.points[Math.min(i + 1, result.points.length - 1)];
        const previous = result.points[Math.max(0, i - 1)];
        dx = next[0] - previous[0]; dy = next[1] - previous[1];
      }
      const theta = Math.atan2(dy, dx) + n(q, "markAngle") * Math.PI / 180;
      const vx = Math.cos(theta), vy = Math.sin(theta), nx = -vy, ny = vx;
      const half = n(q, "markLength") / 2, width = n(q, "markWidth") / 2;
      if (material === "leaf") {
        if (half === 0 || width === 0) continue;
        canvas.noStroke(); color(canvas, layer, pathIndex, true, 215);
        polygon(canvas, [[x - vx * half, y - vy * half], [x + nx * width, y + ny * width],
          [x + vx * half, y + vy * half], [x - nx * width, y - ny * width]], true);
        color(canvas, layer, pathIndex, false, 220);
      } else if (n(q, "weight") > 0 && half > 0) {
        canvas.noFill();
        if (material === "paired-stitch") {
          for (const sign of [-1, 1]) canvas.line(x - vx * half + nx * width * sign, y - vy * half + ny * width * sign,
            x + vx * half + nx * width * sign, y + vy * half + ny * width * sign);
        } else {
          canvas.line(x - vx * half, y - vy * half, x + vx * half, y + vy * half);
          if (material === "bar" && width > 0) canvas.line(x - nx * width, y - ny * width, x + nx * width, y + ny * width);
        }
      }
    }
  });
}
function drawHulls(p: Painter, layer: Layer): void {
  const q = layer.params, islands = layer.technique === "terraced-islands";
  const groups = islands ? terracedIslandSources(q, layer.seed) : scatterEnvelopeSources(q, layer.seed);
  p.strokeWeight(n(q, "weight"));
  groups.forEach((group, groupIndex) => {
    const levels = islands ? n(q, "terraces") : 1;
    // Paint large fills first. Each nested perimeter is then redrawn on top, including the outer one.
    if (q.filled) for (let level = 0; level < levels; level++) {
      p.noStroke(); color(p, layer, groupIndex + level, true, 55);
      polygon(p, islands ? terraceLevel(group, q, level) : group.hull, true);
    }
    if (q.outlined && n(q, "weight") > 0) for (let level = 0; level < levels; level++) {
      p.noFill(); color(p, layer, groupIndex + level, false, 220);
      polygon(p, islands ? terraceLevel(group, q, level) : group.hull, true);
    }
    if (q.showDots && n(q, "inset") > 0) {
      p.noStroke(); color(p, layer, groupIndex + 1, true, 190);
      for (const [x, y] of group.sites) p.circle(x, y, n(q, "inset"));
    }
  });
}
export function drawPathMaterialInstrument(p: Painter, layer: Layer): void {
  const id = layer.technique;
  if (id === "stitched-contours" || id === "fragmented-lines" || id === "stitched-paths") {
    validatePathMaterialInstrument(id, layer.params); drawPaths(p, layer);
  } else if (id === "scatter-envelopes" || id === "terraced-islands") {
    validatePathMaterialInstrument(id, layer.params); drawHulls(p, layer);
  } else throw new Error("Unknown path material instrument");
}
