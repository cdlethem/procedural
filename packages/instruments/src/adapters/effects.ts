import type { ControlGroup, Layer } from "../types.js";
import { clipSegmentsSimplePolygon2D, radialPull2D, sequentialDiscProjection2D } from "@procedurals/javascript";
import { numeric, toggle, choice, type StudioDefinition } from "./types.js";

const SIDE = 640;
const TAU = Math.PI * 2;
type Query = Record<string, number | string | boolean>;
const q = (layer: Layer) => layer.params as Query;
const palette = (layer: Layer): number[] => layer.palette;
const n = (query: Query, key: string) => query[key] as number;

const color = (value: number): [number, number, number] => [
  (value >>> 16) & 255,
  (value >>> 8) & 255,
  value & 255,
];
const paletteAt = (layer: Layer, index: number) => {
  const colors = palette(layer);
  return color(colors[index % colors.length]);
};
const rng = (seed: number) => {
  let state = seed >>> 0;
  return () =>
    ((state = (state + 0x6d2b79f5) >>> 0),
    (Math.imul(state ^ (state >>> 15), 1 | state) ^
      Math.imul(state ^ (state >>> 7), 61 | state) ^
      state) >>>
      0) / 4294967296;
};
function line(
  p: any,
  points: readonly number[],
  rgb: readonly number[],
  weight = 1,
): void {
  p.stroke(rgb[0], rgb[1], rgb[2]);
  p.strokeWeight(weight);
  p.noFill();
  p.beginShape();
  for (let i = 0; i < points.length; i += 2) p.vertex(points[i], points[i + 1]);
  p.endShape();
}
const PATH_SAMPLES = 96;
const PATH_WORK_LIMIT = 16_000;
type SourceMode = "rows" | "columns" | "spokes";
function modernPathSettings(layer: Layer, pull: boolean) {
  const x = q(layer), sourceMode = x.sourceMode as SourceMode;
  if (!["rows", "columns", "spokes"].includes(sourceMode)) throw Error("Unknown source path mode");
  const pathCount = n(x, "pathCount"), count = n(x, "influenceCount"), jitter = n(x, "jitter"), weight = n(x, "weight");
  if (!Number.isInteger(pathCount) || pathCount < 4 || pathCount > 80 ||
      !Number.isInteger(count) || count < 1 || count > 2 ||
      !Number.isFinite(jitter) || jitter < 0 || jitter > 40 ||
      !Number.isFinite(weight) || weight < .1 || weight > 12 ||
      pathCount * PATH_SAMPLES * count > PATH_WORK_LIMIT)
    throw Error("Invalid path or influence work settings");
  const influences: number[][] = [];
  for (let i = 1; i <= count; i++) {
    const cx = n(x, `centerX${i}`), cy = n(x, `centerY${i}`), radius = n(x, `radius${i}`);
    if (![cx, cy, radius].every(Number.isFinite) || cx < 0 || cx > SIDE || cy < 0 || cy > SIDE || radius < 10 || radius > 450)
      throw Error(`Invalid influence ${i} geometry`);
    const power = pull ? n(x, `power${i}`) : undefined;
    if (pull && (!Number.isFinite(power) || power! < .2 || power! > 6)) throw Error(`Invalid influence ${i} power`);
    influences.push(pull ? [cx, cy, radius, power!] : [cx, cy, radius]);
  }
  if (!pull && (!Number.isFinite(n(x, "strength")) || n(x, "strength") < 0 || n(x, "strength") > 1))
    throw Error("Invalid projection strength");
  return { sourceMode, pathCount, jitter, weight, influences };
}
function sourcePaths(seed: number, mode: SourceMode, count: number, jitter: number): number[][] {
  const random = rng(seed), paths: number[][] = [];
  for (let path = 0; path < count; path++) {
    const points: number[] = [];
    const across = count === 1 ? .5 : path / (count - 1);
    const angle = -Math.PI / 2 + path * TAU / count;
    for (let sample = 0; sample < PATH_SAMPLES; sample++) {
      const t = sample / (PATH_SAMPLES - 1), offset = (random() - .5) * jitter;
      if (mode === "rows") points.push(40 + t * 560, 48 + across * 544 + offset);
      else if (mode === "columns") points.push(48 + across * 544 + offset, 40 + t * 560);
      else {
        const r = 20 + 330 * t;
        points.push(320 + Math.cos(angle) * r - Math.sin(angle) * offset,
          320 + Math.sin(angle) * r + Math.cos(angle) * offset);
      }
    }
    paths.push(points);
  }
  return paths;
}
function drawPull(p: any, layer: Layer): void {
  
  const { sourceMode, pathCount, jitter, weight, influences } = modernPathSettings(layer, true);
  const field = radialPull2D({ influences });
  const paths = sourcePaths(layer.seed, sourceMode, pathCount, jitter), point = [0, 0];
  p.noFill(); p.strokeCap(p.ROUND);
  paths.forEach((source, index) => {
    const drawn: number[] = [];
    for (let i = 0; i < source.length; i += 2) {
      field.transformInto(source[i], source[i + 1], point);
      drawn.push(point[0], point[1]);
    }
    line(p, drawn, paletteAt(layer, index), weight);
  });
}
function drawProjection(p: any, layer: Layer): void {
  
  const { sourceMode, pathCount, jitter, weight, influences } = modernPathSettings(layer, false);
  const paths = sourcePaths(layer.seed, sourceMode, pathCount, jitter);
  const points = paths.flatMap(path => {
    const pairs: number[][] = [];
    for (let i = 0; i < path.length; i += 2) pairs.push([path[i], path[i + 1]]);
    return pairs;
  });
  const output = sequentialDiscProjection2D({ points, discs: influences,
    strength: n(q(layer), "strength"), maxTests: points.length * influences.length }).points();
  for (let path = 0; path < pathCount; path++) {
    const drawn: number[] = [];
    for (let sample = 0; sample < PATH_SAMPLES; sample++) {
      const index = 2 * (path * PATH_SAMPLES + sample);
      drawn.push(output[index], output[index + 1]);
    }
    line(p, drawn, paletteAt(layer, path), weight);
  }
}

type ClipSourceMode = "rows" | "wander" | "fan";
type ClipRegionMode = "rectangle" | "portal" | "bay" | "regular";
interface ClipSettings {
  sourceMode: ClipSourceMode; regionMode: ClipRegionMode;
  pathCount: number; steps: number; wander: number;
  cx: number; cy: number; width: number; height: number;
  notchWidth: number; notchDepth: number; sides: number;
  angle: number; weight: number; showOutline: boolean;
}
const CLIP_WORK_LIMIT = 4_000_000;
const CLIP_OUTPUT_LIMIT = 50_000;
function clipSettings(layer: Layer): ClipSettings {
  const x = q(layer), sourceMode = x.sourceMode as ClipSourceMode, regionMode = x.regionMode as ClipRegionMode;
  if (!["rows", "wander", "fan"].includes(sourceMode) ||
      !["rectangle", "portal", "bay", "regular"].includes(regionMode)) throw Error("Unknown clip source or region mode");
  const pathCount = n(x, "pathCount"), steps = n(x, "steps"), wander = n(x, "wander"),
    cx = n(x, "centerX"), cy = n(x, "centerY"), width = n(x, "regionWidth"), height = n(x, "regionHeight"),
    notchWidth = n(x, "notchWidth"), notchDepth = n(x, "notchDepth"), sides = n(x, "sides"),
    angle = n(x, "angle"), weight = n(x, "weight"), showOutline = x.showOutline;
  if (!Number.isInteger(pathCount) || pathCount < 1 || pathCount > 80 ||
      !Number.isInteger(steps) || steps < 2 || steps > 160 ||
      !Number.isFinite(wander) || wander < 0 || wander > 80 ||
      !Number.isFinite(cx) || cx < -320 || cx > 960 || !Number.isFinite(cy) || cy < -320 || cy > 960 ||
      !Number.isFinite(width) || width < 10 || width > 1000 || !Number.isFinite(height) || height < 10 || height > 1000 ||
      !Number.isFinite(notchWidth) || notchWidth < 0 || notchWidth > 1000 ||
      !Number.isFinite(notchDepth) || notchDepth < 0 || notchDepth > 1000 ||
      !Number.isInteger(sides) || sides < 3 || sides > 12 ||
      !Number.isFinite(angle) || angle < -180 || angle > 180 ||
      !Number.isFinite(weight) || weight < .1 || weight > 12 || typeof showOutline !== "boolean")
    throw Error("Invalid clip construction settings");
  return { sourceMode, regionMode, pathCount, steps, wander, cx, cy, width, height,
    notchWidth, notchDepth, sides, angle, weight, showOutline };
}
function clipRegion(x: ClipSettings): number[][] {
  const { cx, cy, width, height, notchWidth, notchDepth, regionMode } = x;
  const left = cx - width / 2, right = cx + width / 2, top = cy - height / 2, bottom = cy + height / 2;
  const rect = [[left, top], [right, top], [right, bottom], [left, bottom]];
  if (regionMode === "rectangle") return rect;
  if (regionMode === "regular") {
    const start = x.angle * Math.PI / 180;
    return Array.from({ length: x.sides }, (_, i) => {
      const a = start + i * TAU / x.sides;
      return [cx + Math.cos(a) * width / 2, cy + Math.sin(a) * height / 2];
    });
  }
  const span = regionMode === "portal" ? width : height;
  const reach = regionMode === "portal" ? height : width;
  if (notchWidth > span) throw Error("Notch opening exceeds region span");
  if (notchWidth === 0 || notchDepth === 0) return rect;
  if (notchDepth >= reach) throw Error("Full-depth notch would disconnect the simple polygon");
  if (regionMode === "portal") {
    const innerTop = bottom - notchDepth;
    if (notchWidth === width) return [[left, top], [right, top], [right, innerTop], [left, innerTop]];
    return [[left, top], [right, top], [right, bottom], [cx + notchWidth / 2, bottom],
      [cx + notchWidth / 2, innerTop], [cx - notchWidth / 2, innerTop],
      [cx - notchWidth / 2, bottom], [left, bottom]];
  }
  const innerLeft = right - notchDepth;
  if (notchWidth === height) return [[left, top], [innerLeft, top], [innerLeft, bottom], [left, bottom]];
  return [[left, top], [right, top], [right, cy - notchWidth / 2],
    [innerLeft, cy - notchWidth / 2], [innerLeft, cy + notchWidth / 2],
    [right, cy + notchWidth / 2], [right, bottom], [left, bottom]];
}
function clipSource(x: ClipSettings, seed: number): number[][] {
  const random = rng(seed), segments: number[][] = [];
  for (let path = 0; path < x.pathCount; path++) {
    const across = x.pathCount === 1 ? .5 : path / (x.pathCount - 1);
    let px = 20, py = x.sourceMode === "fan" ? 320 : 80 + across * 480;
    for (let step = 1; step <= x.steps; step++) {
      const t = step / x.steps, nx = 20 + t * 600;
      const ny = x.sourceMode === "fan" ? 320 + (across - .5) * 480 * t :
        x.sourceMode === "wander" ? py + (random() - .5) * x.wander : py;
      segments.push([px, py, nx, ny]);
      px = nx; py = ny;
    }
  }
  return segments;
}
function drawClip(p: any, layer: Layer): void {
  
  const settings = clipSettings(layer), polygon = clipRegion(settings), edges = polygon.length;
  const segmentCount = settings.pathCount * settings.steps;
  const work = edges * edges + segmentCount * (edges * edges * 8 + edges * 16 + 8);
  const potentialOutput = segmentCount * (Math.floor(edges / 2) + 1);
  if (work > CLIP_WORK_LIMIT || potentialOutput > CLIP_OUTPUT_LIMIT)
    throw Error("Clip construction exceeds combined work or output limit");
  const segments = clipSource(settings, layer.seed);
  const clipped = clipSegmentsSimplePolygon2D({ polygon, segments,
    maxWork: work, maxOutputSegments: CLIP_OUTPUT_LIMIT }).toValues();
  p.noFill(); p.strokeWeight(settings.weight);
  for (let i = 0; i < clipped.segments.length; i++) {
    const sourcePath = Math.floor(clipped.sourceIndices[i] / settings.steps);
    p.stroke(...paletteAt(layer, sourcePath));
    p.line(...clipped.segments[i]);
  }
  if (settings.showOutline) {
    p.stroke(...paletteAt(layer, layer.palette.length - 1), 150);
    p.strokeWeight(Math.min(settings.weight, 2));
    p.beginShape();
    for (const point of polygon) p.vertex(point[0], point[1]);
    p.endShape(p.CLOSE);
  }
}












/** A radial influence: its center, reach and, for pulls, how the effect decays toward the reach. */
const influenceGroup = (label: string, suffix: "1" | "2", falloff: boolean): ControlGroup => ({ label,
  controls: [`centerX${suffix}`, `centerY${suffix}`, `radius${suffix}`, ...(falloff ? [`power${suffix}`] : [])] });

export const effectsDefinitions: StudioDefinition[] = [
  {
    id: "pull-marks" as any,
    title: "Pull marks",
    description: "Arrange source paths and pull them toward one or two editable radial influences.",
    parameters: [choice("sourceMode", "Source paths", "Choose horizontal rows, vertical columns or radial spokes before deformation.", ["rows", "columns", "spokes"]),
      numeric("pathCount", "Paths", "Number of independent source paths.", 4, 80, 1, { hardMin: 4, hardMax: 80, integer: true }),
      numeric("jitter", "Source jitter", "Random displacement perpendicular to each source path.", 0, 12, .5, { hardMin: 0, hardMax: 40, integer: false }),
      numeric("influenceCount", "Influences", "Use the first pull or both independent pulls.", 1, 2, 1, { hardMin: 1, hardMax: 2, integer: true }),
      numeric("centerX1", "First center X", "Horizontal position of the first pull.", 0, 640, 1, { hardMin: 0, hardMax: 640, integer: false }),
      numeric("centerY1", "First center Y", "Vertical position of the first pull.", 0, 640, 1, { hardMin: 0, hardMax: 640, integer: false }),
      numeric("radius1", "First radius", "Reach of the first pull.", 10, 350, 5, { hardMin: 10, hardMax: 450, integer: false }),
      numeric("power1", "First falloff", "How the first pull decays toward its radius.", .2, 6, .1, { hardMin: .2, hardMax: 6, integer: false }),
      numeric("centerX2", "Second center X", "Horizontal position of the optional second pull.", 0, 640, 1, { hardMin: 0, hardMax: 640, integer: false }),
      numeric("centerY2", "Second center Y", "Vertical position of the optional second pull.", 0, 640, 1, { hardMin: 0, hardMax: 640, integer: false }),
      numeric("radius2", "Second radius", "Reach of the optional second pull.", 10, 350, 5, { hardMin: 10, hardMax: 450, integer: false }),
      numeric("power2", "Second falloff", "How the second pull decays toward its radius.", .2, 6, .1, { hardMin: .2, hardMax: 6, integer: false }),
      numeric("weight", "Stroke weight", "Thickness of the transformed paths.", .1, 6, .1, { hardMin: .1, hardMax: 12, integer: false })],
    controlGroups: [
      { label: "Source", stage: "form", controls: ["sourceMode", "pathCount", "jitter"] },
      { label: "Influences", stage: "process", controls: ["influenceCount", influenceGroup("First pull", "1", true), influenceGroup("Second pull", "2", true)] },
      { label: "Stroke", stage: "material", controls: ["weight"] },
    ],
    defaults: {sourceMode: "rows",
      pathCount: 28,
      jitter: 0,
      influenceCount: 2,
      centerX1: 245,
      centerY1: 280,
      radius1: 225,
      power1: 1.3,
      centerX2: 410,
      centerY2: 380,
      radius2: 185,
      power2: 1.8,
      weight: 1.3},
  },
  {
    id: "projection-marks" as any,
    title: "Projection marks",
    description: "Arrange source paths and project them away from one or two ordered discs.",
    parameters: [choice("sourceMode", "Source paths", "Choose horizontal rows, vertical columns or radial spokes before projection.", ["rows", "columns", "spokes"]),
      numeric("pathCount", "Paths", "Number of independent source paths.", 4, 80, 1, { hardMin: 4, hardMax: 80, integer: true }),
      numeric("jitter", "Source jitter", "Random displacement perpendicular to each source path.", 0, 12, .5, { hardMin: 0, hardMax: 40, integer: false }),
      numeric("influenceCount", "Discs", "Use the first disc or both ordered discs.", 1, 2, 1, { hardMin: 1, hardMax: 2, integer: true }),
      numeric("centerX1", "First center X", "Horizontal position of the first disc.", 0, 640, 1, { hardMin: 0, hardMax: 640, integer: false }),
      numeric("centerY1", "First center Y", "Vertical position of the first disc.", 0, 640, 1, { hardMin: 0, hardMax: 640, integer: false }),
      numeric("radius1", "First radius", "Reach of the first disc.", 10, 350, 5, { hardMin: 10, hardMax: 450, integer: false }),
      numeric("centerX2", "Second center X", "Horizontal position of the optional second disc.", 0, 640, 1, { hardMin: 0, hardMax: 640, integer: false }),
      numeric("centerY2", "Second center Y", "Vertical position of the optional second disc.", 0, 640, 1, { hardMin: 0, hardMax: 640, integer: false }),
      numeric("radius2", "Second radius", "Reach of the optional second disc.", 10, 350, 5, { hardMin: 10, hardMax: 450, integer: false }),
      numeric("strength", "Projection strength", "How far source samples move away from discs.", 0, 1, .05, { hardMin: 0, hardMax: 1, integer: false }),
      numeric("weight", "Stroke weight", "Thickness of the transformed paths.", .1, 6, .1, { hardMin: .1, hardMax: 12, integer: false })],
    controlGroups: [
      { label: "Source", stage: "form", controls: ["sourceMode", "pathCount", "jitter"] },
      { label: "Influences", stage: "process", controls: ["influenceCount", influenceGroup("First disc", "1", false), influenceGroup("Second disc", "2", false), "strength"] },
      { label: "Stroke", stage: "material", controls: ["weight"] },
    ],
    defaults: {sourceMode: "rows",
      pathCount: 24,
      jitter: 0,
      influenceCount: 2,
      centerX1: 230,
      centerY1: 250,
      radius1: 160,
      centerX2: 410,
      centerY2: 350,
      radius2: 110,
      strength: .75,
      weight: 1.2},
  },
  {
    id: "path-clip-marks" as any,
    title: "Path clip marks",
    description: "Clip rows, wandering paths or a fan through an editable simple boundary.",
    parameters: [choice("sourceMode", "Source paths", "Choose straight rows, seeded wander or rays fanning from the left.", ["rows", "wander", "fan"]),
      numeric("pathCount", "Paths", "Number of paths supplied to the clipping operation.", 1, 40, 1, { hardMin: 1, hardMax: 80, integer: true }),
      numeric("steps", "Segments per path", "Number of straight source segments in each path.", 2, 100, 1, { hardMin: 2, hardMax: 160, integer: true }),
      numeric("wander", "Wander", "Seeded vertical variation in wander mode; rows and fan ignore it.", 0, 30, .5, { hardMin: 0, hardMax: 80, integer: false }),
      choice("regionMode", "Clip boundary", "Choose a rectangle, bottom portal, right bay or regular polygon.", ["rectangle", "portal", "bay", "regular"]),
      numeric("centerX", "Boundary center X", "Horizontal position of the clip boundary.", 0, 640, 5, { hardMin: -320, hardMax: 960, integer: false }),
      numeric("centerY", "Boundary center Y", "Vertical position of the clip boundary.", 0, 640, 5, { hardMin: -320, hardMax: 960, integer: false }),
      numeric("regionWidth", "Boundary width", "Horizontal extent before a portal or bay cut.", 100, 640, 10, { hardMin: 10, hardMax: 1000, integer: false }),
      numeric("regionHeight", "Boundary height", "Vertical extent before a portal or bay cut.", 100, 640, 10, { hardMin: 10, hardMax: 1000, integer: false }),
      numeric("notchWidth", "Notch opening", "Opening along the bottom portal or right bay edge; zero gives a rectangle.", 0, 400, 5, { hardMin: 0, hardMax: 1000, integer: false }),
      numeric("notchDepth", "Notch depth", "How far the portal or bay enters the boundary; zero gives a rectangle.", 0, 400, 5, { hardMin: 0, hardMax: 1000, integer: false }),
      numeric("sides", "Polygon sides", "Number of corners in regular boundary mode.", 3, 12, 1, { hardMin: 3, hardMax: 12, integer: true }),
      numeric("angle", "Polygon angle", "Rotates the regular polygon around its center.", -180, 180, 5, { hardMin: -180, hardMax: 180, integer: false }),
      numeric("weight", "Stroke weight", "Thickness of retained path marks.", .1, 6, .1, { hardMin: .1, hardMax: 12, integer: false }),
      toggle("showOutline", "Show boundary", "Trace the actual clip boundary over the retained paths.")],
    controlGroups: [
      { label: "Source", stage: "form", controls: ["sourceMode", "pathCount", "steps", "wander"] },
      { label: "Boundary", stage: "form", controls: ["regionMode", { label: "Notch", controls: ["notchWidth", "notchDepth"], proportional: true }, "sides"] },
      { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["regionWidth", "regionHeight"], proportional: true }, "angle"] },
      { label: "Stroke", stage: "material", controls: ["weight", "showOutline"] },
    ],
    defaults: {sourceMode: "rows",
      pathCount: 16,
      steps: 70,
      wander: 9,
      regionMode: "portal",
      centerX: 320,
      centerY: 320,
      regionWidth: 480,
      regionHeight: 480,
      notchWidth: 160,
      notchDepth: 220,
      sides: 6,
      angle: 0,
      weight: 1.5,
      showOutline: true},
  }
];

export function drawEffects(p: any, layer: Layer): void {
  switch (layer.technique as string) {
    case "pull-marks":
      return drawPull(p, layer);
case "projection-marks":
      return drawProjection(p, layer);
case "path-clip-marks":
      return drawClip(p, layer);
default:
      throw new Error(`Unknown effects technique: ${String(layer.technique)}`);
  }
}
