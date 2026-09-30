import { poissonDisc2D, skylinePack2D } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { ControlGroup, Layer, Parameter } from "../types.js";
import { atEach } from "../composition/core.js";
import type { Site } from "../composition/types.js";
import { channels, choice, numeric, toggle, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
type Point = [number, number];
type Painter = {
  push(): void; pop(): void; translate(x: number, y: number): void; rotate(angle: number): void;
  noStroke(): void; noFill(): void; fill(r: number, g: number, b: number, alpha: number): void;
  stroke(r: number, g: number, b: number, alpha: number): void; strokeWeight(weight: number): void;
  circle(x: number, y: number, diameter: number): void; rect(x: number, y: number, width: number, height: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  beginShape(): void; vertex(x: number, y: number): void; endShape(mode?: unknown): void;
  CLOSE: unknown;
};
const n = (q: Params, key: string) => Number(q[key]);

const pointParameters: Parameter[] = [
  numeric("radius", "Minimum separation", "Actual Euclidean distance between source sites, before support filtering.", 6, 45, 1, { hardMin: 1, hardMax: 1600 }),
  numeric("attempts", "Attempts", "Poisson candidate attempts per active site.", 2, 18, 1, { hardMin: 1, hardMax: 30, integer: true }),
  numeric("maxPoints", "Source cap", "Upper bound before support filtering; the displayed count may be lower.", 1, 500, 1, { hardMin: 0, hardMax: 600, integer: true }),
  choice("support", "Support", "Accept points in the rectangular, elliptical or annular local footprint.", ["rectangle", "ellipse", "annulus"]),
  numeric("innerRadius", "Annulus opening", "Inner radius as a fraction of the outer ellipse; only for annulus support.", 0, .9, .01, { hardMin: 0, hardMax: .99 }),
  numeric("footprintWidth", "Footprint width", "Sampling rectangle width, not a stretch of completed points.", 40, 640, 1, { hardMin: 1, hardMax: 1600 }),
  numeric("footprintHeight", "Footprint height", "Sampling rectangle height, not a stretch of completed points.", 40, 640, 1, { hardMin: 1, hardMax: 1600 }),
  numeric("centerX", "Center X", "Source center on the 720-unit canvas.", 0, 720, 1, { hardMin: -4000, hardMax: 4000 }),
  numeric("centerY", "Center Y", "Source center on the 720-unit canvas.", 0, 720, 1, { hardMin: -4000, hardMax: 4000 }),
  numeric("orientation", "Footprint angle", "Rotate the entire point arrangement rigidly, in degrees.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
  choice("mark", "Mark", "Independent vocabulary for each accepted site.", ["dot", "square", "diamond", "cross", "short-stroke"]),
  numeric("size", "Mark size", "Diameter or longest local mark dimension; zero paints nothing.", 0, 24, .5, { hardMin: 0, hardMax: 500 }),
  numeric("markAspect", "Mark aspect", "Height divided by width for non-dot marks.", .15, 4, .05, { hardMin: .01, hardMax: 20 }),
  numeric("markAngle", "Mark angle", "Base mark angle in degrees, independent of the source footprint.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
  numeric("angleSpread", "Angle spread", "Independent seeded angle variation in degrees either side of mark angle.", 0, 180, 1, { hardMin: 0, hardMax: 360 }),
];
const packingParameters: Parameter[] = [
  numeric("count", "Requested blocks", "Ordered packing proposals; some may be unplaced if the extent is full.", 0, 80, 1, { hardMin: 0, hardMax: 96, integer: true }),
  numeric("minWidth", "Minimum width", "Smallest unscaled source rectangle width.", 5, 150, 1, { hardMin: .1, hardMax: 3000 }),
  numeric("maxWidth", "Maximum width", "Largest unscaled source rectangle width.", 5, 180, 1, { hardMin: .1, hardMax: 3000 }),
  numeric("minHeight", "Minimum height", "Smallest unscaled source rectangle height.", 5, 150, 1, { hardMin: .1, hardMax: 3000 }),
  numeric("maxHeight", "Maximum height", "Largest unscaled source rectangle height.", 5, 180, 1, { hardMin: .1, hardMax: 3000 }),
  numeric("scale", "Dimension scale", "Multiply proposed widths and heights before packing; never shrink to fit.", .4, 1.4, .05, { hardMin: .01, hardMax: 20 }),
  numeric("swapChance", "Turn chance", "Seeded chance to swap a proposed rectangle's width and height before packing.", 0, 1, .05, { hardMin: 0, hardMax: 1 }),
  numeric("packWidth", "Packing width", "Width of the local skyline support.", 60, 640, 1, { hardMin: 1, hardMax: 1600 }),
  numeric("packHeight", "Packing height", "Height of the local skyline support.", 60, 640, 1, { hardMin: 1, hardMax: 1600 }),
  numeric("centerX", "Center X", "Center of the packing support on the 720-unit canvas.", 0, 720, 1, { hardMin: -4000, hardMax: 4000 }),
  numeric("centerY", "Center Y", "Center of the packing support.", 0, 720, 1, { hardMin: -4000, hardMax: 4000 }),
  numeric("rotation", "Group angle", "Rotate the complete packed arrangement rigidly, in degrees.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
  numeric("gutter", "Gutter", "Reserve this gap between placed rectangle cores using expanded skyline footprints.", 0, 55, 1, { hardMin: 0, hardMax: 1000 }),
  toggle("filled", "Filled cores", "Paint only placed rectangle cores."),
  numeric("outline", "Outline weight", "Stroke weight around placed cores; zero omits outlines.", 0, 5, .25, { hardMin: 0, hardMax: 50 }),
  numeric("inset", "Inner inset", "Inset a second palette-colored core; zero omits it.", 0, 32, 1, { hardMin: 0, hardMax: 1000 }),
];
const pointGroups: ControlGroup[] = [
  { label: "Population", stage: "form", controls: ["support", "innerRadius", "radius", "attempts", "maxPoints"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["footprintWidth", "footprintHeight"], proportional: true }, "orientation"] },
  { label: "Mark", stage: "material", controls: ["mark", "size", "markAspect", "markAngle", "angleSpread"] },
];
const packingGroups: ControlGroup[] = [
  { label: "Blocks", stage: "form", controls: ["count",
    { label: "Size", controls: ["minWidth", "maxWidth", "minHeight", "maxHeight"], proportional: true },
    "scale", "swapChance", "gutter"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["packWidth", "packHeight"], proportional: true }, "rotation"] },
  { label: "Drawing", stage: "material", controls: ["filled", "inset", "outline"] },
];
const pointsDefault = {radius: 18,
  attempts: 8,
  maxPoints: 400,
  support: "rectangle",
  innerRadius: .42,
  footprintWidth: 540,
  footprintHeight: 540,
  centerX: 360,
  centerY: 360,
  orientation: 0,
  mark: "dot",
  size: 4,
  markAspect: 1,
  markAngle: 0,
  angleSpread: 0};
const packingDefault = {count: 22,
  minWidth: 45,
  maxWidth: 125,
  minHeight: 40,
  maxHeight: 95,
  scale: 1,
  swapChance: 0,
  packWidth: 560,
  packHeight: 560,
  centerX: 360,
  centerY: 360,
  rotation: 0,
  gutter: 3,
  filled: true,
  outline: 2,
  inset: 0};
export const placementPackingInstrumentDefinitions: StudioDefinition[] = [
  { id: "blue-noise-stipple", title: "Blue-noise stipple", description: "One Poisson point-placement instrument with editable support and independent marks.",
  procedure: "Sample a rectangle by Poisson-disc so no two sites lie closer than a minimum separation, then keep only those inside the chosen support, such as an ellipse or ring. Stamp a small dot at each surviving site.",
    parameters: pointParameters, controlGroups: pointGroups, defaults: pointsDefault, validate: validatePointPlacement },
  { id: "spaced-symbols", title: "Spaced symbols", description: "The same Poisson instrument, starting with square sites; shape is freely editable.",
  procedure: "Sample sites by Poisson-disc so centres stay a minimum distance apart, then filter them through an ellipse or ring if chosen. Stamp a square at each surviving site, turned by a seeded angle, at a wider spacing than the stipple recipe.",
    parameters: pointParameters, controlGroups: pointGroups, defaults: { ...pointsDefault, radius: 26, attempts: 7, mark: "square", size: 10, angleSpread: 45 }, validate: validatePointPlacement },
  { id: "packed-posters", title: "Packed posters", description: "Seeded rectangles proposed to an ordered skyline; only placed cores are painted.",
  procedure: "Draw a seeded list of rectangles of varied width and height, some turned a quarter, and offer them in order to a skyline packer that keeps a gutter between cores. Those that fit are painted as blocks; the rest are dropped, never resized.",
    parameters: packingParameters, controlGroups: packingGroups, defaults: packingDefault, validate: validatePacking },
  { id: "aspect-tiles", title: "Aspect tiles", description: "The same skyline packing instrument, starting from a broader aspect population.",
  procedure: "Draw 25 seeded rectangles with widths and heights between 20 and 95, some turned a quarter, and offer them in order to a skyline packer. Each tile is placed only if its padded footprint fits; the rest are left out, and placed tiles are filled and outlined.",
    parameters: packingParameters, controlGroups: packingGroups, defaults: { ...packingDefault, count: 25, minWidth: 20, maxWidth: 95, minHeight: 20, maxHeight: 95, outline: 1 }, validate: validatePacking },
];
function number(q: Params, key: string, low: number, high: number, integer = false): number {
  const v = q[key];
  if (typeof v !== "number" || !Number.isFinite(v) || v < low || v > high || (integer && !Number.isSafeInteger(v)))
    throw new Error(`${key} must be ${integer ? "an integer" : "a finite number"} in [${low}, ${high}]`);
  return v;
}
function oneOf(q: Params, key: string, values: readonly string[]): void {
  if (!values.includes(String(q[key]))) throw new Error(`${key} must be one of ${values.join(", ")}`);
}
export function validatePointPlacement(q: Params): void {
  
  number(q, "radius", 1, 1600); number(q, "attempts", 1, 30, true);
  const cap = number(q, "maxPoints", 0, 600, true);
  oneOf(q, "support", ["rectangle", "ellipse", "annulus"]);
  for (const [key, low, high] of [["innerRadius", 0, .99], ["footprintWidth", 1, 1600],
    ["footprintHeight", 1, 1600], ["centerX", -4000, 4000], ["centerY", -4000, 4000],
    ["orientation", -3600, 3600], ["size", 0, 500], ["markAspect", .01, 20],
    ["markAngle", -3600, 3600], ["angleSpread", 0, 360]] as const) number(q, key, low, high);
  oneOf(q, "mark", ["dot", "square", "diamond", "cross", "short-stroke"]);
  if (cap * n(q, "attempts") > 18_000) throw new Error("Source cap × attempts exceeds the Poisson work budget");
}
export function validatePacking(q: Params): void {
  
  const count = number(q, "count", 0, 96, true);
  for (const [key, low, high] of [["minWidth", .1, 3000], ["maxWidth", .1, 3000],
    ["minHeight", .1, 3000], ["maxHeight", .1, 3000], ["scale", .01, 20],
    ["swapChance", 0, 1], ["packWidth", 1, 1600], ["packHeight", 1, 1600],
    ["centerX", -4000, 4000], ["centerY", -4000, 4000], ["rotation", -3600, 3600],
    ["gutter", 0, 1000], ["outline", 0, 50], ["inset", 0, 1000]] as const) number(q, key, low, high);
  if (n(q, "minWidth") > n(q, "maxWidth") || n(q, "minHeight") > n(q, "maxHeight"))
    throw new Error("Minimum rectangle dimensions cannot exceed maximum dimensions");
  if (typeof q.filled !== "boolean") throw new Error("filled must be boolean");
  if (8 * count ** 3 + count > 8_000_000) throw new Error("Requested count exceeds the skyline work budget");
}
function cached<T>(map: Map<string, T>, key: string, make: () => T): T {
  const hit = map.get(key);
  if (hit !== undefined) { map.delete(key); map.set(key, hit); return hit; }
  const value = make(); map.set(key, value);
  if (map.size > 6) map.delete(map.keys().next().value!);
  return value;
}
const pointCache = new Map<string, Point[]>();
const packCache = new Map<string, PackingSource>();
export function poissonPoints(q: Params, seed: number): Point[] {
  validatePointPlacement(q);
  const keys = ["radius", "attempts", "maxPoints", "support", "innerRadius", "footprintWidth",
    "footprintHeight", "centerX", "centerY", "orientation"];
  return cached(pointCache, JSON.stringify([seed, ...keys.map(k => q[k])]), () => {
    const w = n(q, "footprintWidth"), h = n(q, "footprintHeight");
    const source = poissonDisc2D({ bounds: [-w / 2, -h / 2, w / 2, h / 2], radius: n(q, "radius"),
      attemptsPerActive: n(q, "attempts"), maxPoints: n(q, "maxPoints"), rngState: seed >>> 0, maxWork: 3_000_000 });
    const angle = n(q, "orientation") * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    return source.points.filter(([x, y]) => {
      if (q.support === "rectangle") return true;
      const r2 = (2 * x / w) ** 2 + (2 * y / h) ** 2;
      return r2 <= 1 && (q.support === "ellipse" || r2 >= n(q, "innerRadius") ** 2);
    }).map(([x, y]): Point => [n(q, "centerX") + x * c - y * s, n(q, "centerY") + x * s + y * c]);
  });
}
export type PackingSource = {
  rectangles: { width: number; height: number }[];
  placed: { index: number; x: number; y: number; width: number; height: number }[];
  unplaced: number[];
};
export function packingSource(q: Params, seed: number): PackingSource {
  validatePacking(q);
  const keys = ["count", "minWidth", "maxWidth", "minHeight", "maxHeight", "scale", "swapChance",
    "packWidth", "packHeight", "centerX", "centerY", "rotation", "gutter"];
  return cached(packCache, JSON.stringify([seed, ...keys.map(k => q[k])]), () => {
    const random = new JavaRandom(seed >>> 0), scale = n(q, "scale"), gutter = n(q, "gutter");
    const rectangles = Array.from({ length: n(q, "count") }, () => {
      let width = (n(q, "minWidth") + random.nextDouble() * (n(q, "maxWidth") - n(q, "minWidth"))) * scale;
      let height = (n(q, "minHeight") + random.nextDouble() * (n(q, "maxHeight") - n(q, "minHeight"))) * scale;
      if (random.nextDouble() < n(q, "swapChance")) [width, height] = [height, width];
      return { width, height };
    });
    const output = skylinePack2D({ width: n(q, "packWidth"), height: n(q, "packHeight"),
      rectangles: rectangles.map(r => ({ width: r.width + gutter, height: r.height + gutter })),
      maxWork: 8 * n(q, "count") ** 3 + n(q, "count") });
    // Packing uses padded footprints. Expose/draw only the original, unshrunk cores.
    const placed = output.placements.map(p => ({ index: p.index, x: p.x + gutter / 2, y: p.y + gutter / 2,
      width: rectangles[p.index].width, height: rectangles[p.index].height }));
    return { rectangles, placed, unplaced: output.unplaced };
  });
}
function color(p: Painter, value: number, fill: boolean): void {
  const [r, g, b] = channels(value);
  if (fill) p.fill(r, g, b, 235); else p.stroke(r, g, b, 235);
}
const pointFrames = new WeakMap<Point[], readonly Site[]>();
function paintPoints(p: Painter, layer: Layer): void {
  const q = layer.params, points = poissonPoints(q, layer.seed), size = n(q, "size");
  if (size === 0 || !points.length) return;
  const colors = layer.palette.length ? layer.palette : [0x222222];
  const random = new JavaRandom((layer.seed ^ 0x7f4a7c15) >>> 0);
  let sites = pointFrames.get(points);
  if (!sites) {
    sites = points.map((position, index) => ({
      id: `site:${index}`, seed: layer.seed, position, angle: 0, scale: 1,
    }));
    pointFrames.set(points, sites);
  }
  let index = 0;
  p.noStroke();
  atEach(p, sites, (canvas) => {
    const colorIndex = index++ % colors.length;
    const variance = random.nextDouble() * 2 - 1;
    color(canvas, colors[colorIndex], true);
    if (q.mark === "dot") { canvas.circle(0, 0, size); return; }
    const aspect = n(q, "markAspect");
    canvas.rotate((n(q, "markAngle") + variance * n(q, "angleSpread")) * Math.PI / 180);
    if (q.mark === "square") canvas.rect(-size / 2, -size * aspect / 2, size, size * aspect);
    else if (q.mark === "diamond") {
      canvas.beginShape(); canvas.vertex(0, -size * aspect / 2); canvas.vertex(size / 2, 0);
      canvas.vertex(0, size * aspect / 2); canvas.vertex(-size / 2, 0); canvas.endShape(canvas.CLOSE);
    } else {
      canvas.noFill(); color(canvas, colors[colorIndex], false);
      canvas.strokeWeight(Math.max(.1, size / 7));
      canvas.line(-size / 2, 0, size / 2, 0);
      if (q.mark === "cross") canvas.line(0, -size * aspect / 2, 0, size * aspect / 2);
    }
  });
}
function paintPacking(p: Painter, layer: Layer): void {
  const q = layer.params, source = packingSource(q, layer.seed), colors = layer.palette.length ? layer.palette : [0x222222];
  if ((!q.filled && n(q, "outline") === 0) || !source.placed.length) return;
  p.push(); p.translate(n(q, "centerX"), n(q, "centerY")); p.rotate(n(q, "rotation") * Math.PI / 180);
  p.translate(-n(q, "packWidth") / 2, -n(q, "packHeight") / 2);
  for (const a of source.placed) {
    const primary = colors[a.index % colors.length], secondary = colors[(a.index + 1) % colors.length];
    if (q.filled) color(p, primary, true); else p.noFill();
    if (n(q, "outline") > 0) { color(p, secondary, false); p.strokeWeight(n(q, "outline")); } else p.noStroke();
    p.rect(a.x, a.y, a.width, a.height);
    const inset = n(q, "inset");
    if (q.filled && inset > 0 && 2 * inset < a.width && 2 * inset < a.height) {
      p.noStroke(); color(p, secondary, true);
      p.rect(a.x + inset, a.y + inset, a.width - 2 * inset, a.height - 2 * inset);
    }
  }
  p.pop();
}
export function drawPlacementPackingInstrument(p: Painter, layer: Layer): void {
  switch (layer.technique) {
    case "blue-noise-stipple": case "spaced-symbols": paintPoints(p, layer); return;
    case "packed-posters": case "aspect-tiles": paintPacking(p, layer); return;
    default: throw new Error("Unknown placement or packing instrument");
  }
}
