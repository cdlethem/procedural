import { noiseBandPath2D, seededEndpointBranches2D, seededLinePool2D } from "@procedurals/javascript";
import type { ControlGroup, Layer } from "../types.js";
import { channels, choice, numeric, toggle, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
type Point = [number, number];
type Canvas = {
  push(): void; pop(): void; noFill(): void; noStroke(): void;
  stroke(...values: number[]): void; fill(...values: number[]): void;
  strokeWeight(value: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  circle(x: number, y: number, diameter: number): void;
};
export interface BandPath {
  readonly size: number;
  readonly attempts: number;
  readonly accepted: number;
  readonly rejected: number;
  pointInto(index: number, out: Float64Array): Float64Array;
  headingAt(index: number): number;
  pointAt(index: number): number[];
  toValues(): { positions: number[][]; attempts: number; accepted: number; rejected: number };
}
export interface BranchTree {
  readonly size: number;
  segmentInto(index: number, out: Float64Array): Float64Array;
  segmentAt(index: number): number[];
  generationAt(index: number): number;
  /** Index of the parent segment, or -1 for a root segment. */
  parentAt(index: number): number;
  childCountAt(index: number): number;
}
export interface CutBranchPool {
  readonly size: number;
  readonly attempts: number;
  readonly successfulCuts: number;
  readonly skips: number;
  segmentInto(index: number, out: Float64Array): Float64Array;
  segmentAt(index: number): number[];
  toValues(): { segments: number[][]; attempts: number; successfulCuts: number; skips: number };
}
const radians = Math.PI / 180;
const MAX_BAND_WORK = 60_000;
const MAX_BRANCH_SEGMENTS = 12_000;
const MAX_CUT_SEGMENTS = 12_001;

function number(q: Params, key: string, low: number, high: number, integer = false): number {
  const v = q[key];
  if (typeof v !== "number" || !Number.isFinite(v) || v < low || v > high || (integer && !Number.isInteger(v)))
    throw new Error(`${key} must be ${integer ? "an integer" : "a finite number"} between ${low} and ${high}`);
  return v;
}
function select<T extends string>(q: Params, key: string, options: readonly T[]): T {
  const v = q[key];
  for (const option of options) if (v === option) return option;
  throw new Error(`${key} must be one of ${options.join(", ")}`);
}
function flag(q: Params, key: string): boolean {
  if (typeof q[key] !== "boolean") throw new Error(`${key} must be a boolean`);
  return q[key];
}
function seed(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new Error("seed must be a uint32");
  return value;
}
// Arrangement randomness is independent of the core's own retained-geometry streams.
function random(seedValue: number): () => number {
  let state = seedValue >>> 0;
  return () => { state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}
function starts(layout: "line" | "grid" | "area" | "ring", count: number, columns: number,
  cx: number, cy: number, extent: number, aspect: number, heading: number, spread: number, seedValue: number) {
  const rng = random(seedValue ^ 0x6ee8d72d);
  const result: { position: Point; heading: number }[] = [];
  const rows = Math.ceil(count / columns);
  for (let i = 0; i < count; i++) {
    let x = 0, y = 0;
    if (layout === "line") x = count === 1 ? 0 : (i / (count - 1) - .5) * extent;
    else if (layout === "grid") {
      const row = Math.floor(i / columns), rowCount = Math.min(columns, count - row * columns);
      x = (i % columns - (rowCount - 1) / 2) * extent / Math.max(1, columns - 1);
      y = (row - (rows - 1) / 2) * extent * aspect / Math.max(1, rows - 1);
    } else if (layout === "ring") {
      const angle = 2 * Math.PI * i / count;
      x = Math.cos(angle) * extent / 2; y = Math.sin(angle) * extent * aspect / 2;
    } else { x = (rng() - .5) * extent; y = (rng() - .5) * extent * aspect; }
    result.push({ position: [cx + x, cy + y], heading: (heading + (rng() * 2 - 1) * spread) * radians });
  }
  return result;
}

/** Band and branch instruments place their start/root arrangement the same way. */
const rootPlacement: ControlGroup = { label: "Placement", stage: "frame", controls: ["centerX", "centerY", "extent", "aspect"] };

const bandDefinition: StudioDefinition = {
  id: "band-marks", title: "Band marks",
  description: "Attempt-bounded noise-band traces with independently painted retained paths and marks.",
  procedure: "Walkers wander through seeded noise, and a step is allowed only if the noise there stays close to where they started. Refused steps turn them instead, so each walker traces a contour of its own starting level.",
  parameters: [numeric("count", "Start count", "Independent noise-band paths.", 1, 48, 1, { integer: true, hardMin: 1, hardMax: 96 }),
    choice("layout", "Start layout", "Line, grid, random area or ring.", ["line", "grid", "area", "ring"]),
    numeric("columns", "Grid columns", "Number of start columns for grid layout.", 1, 12, 1, { integer: true, hardMin: 1, hardMax: 96 }),
    numeric("centerX", "Center X", "Canvas X of the starts.", -320, 960, 1),
    numeric("centerY", "Center Y", "Canvas Y of the starts.", -320, 960, 1),
    numeric("extent", "Extent", "Horizontal span of the start arrangement.", 0, 600, 1),
    numeric("aspect", "Aspect", "Vertical span as a multiple of extent.", 0, 3, .05),
    numeric("heading", "Heading", "Initial direction in degrees.", -180, 180, 1),
    numeric("spread", "Heading spread", "Random starting heading deviation, degrees.", 0, 180, 1),
    numeric("attempts", "Attempts per path", "Proposals, NOT guaranteed retained vertices.", 0, 1200, 1, { integer: true, hardMin: 0, hardMax: 2000 }),
    numeric("stepDistance", "Step distance", "Length of each proposed step.", 0, 12, .1),
    numeric("fieldScale", "Field frequency", "Noise coordinate scale; zero is a spatially constant field.", 0, .04, .001),
    numeric("fieldOffsetX", "Field offset X", "Noise sampling offset X.", -30, 30, .1),
    numeric("fieldOffsetY", "Field offset Y", "Noise sampling offset Y.", -30, 30, .1),
    numeric("tolerance", "Band tolerance", "Strict distance from the initial scalar level.", 0, .08, .001),
    toggle("pathLines", "Path strokes", "Connect successive retained vertices."),
    choice("pointMaterial", "Retained marks", "No marks, retained-node dots or perpendicular ticks on accepted steps.", ["none", "nodes", "ticks"]),
    numeric("markStride", "Mark stride", "Sample every nth retained vertex, not every nth attempt.", 1, 16, 1, { integer: true }),
    numeric("tickLength", "Tick length", "Perpendicular tick length in canvas units.", 0, 20, .5),
    numeric("nodeSize", "Node size", "Diameter of retained-node dots.", 0, 12, .25),
    numeric("weight", "Stroke weight", "Path/tick stroke width.", .1, 5, .05)],
  controlGroups: [
    { label: "Starts", stage: "form", controls: ["layout", "columns", "count",
      { label: "Heading", controls: ["heading", "spread"] }] },
    rootPlacement,
    { label: "Trace", stage: "process", controls: ["attempts", "stepDistance", "tolerance"] },
    { label: "Field", stage: "form", controls: ["fieldScale", "fieldOffsetX", "fieldOffsetY"] },
    { label: "Drawing", stage: "material", controls: ["pathLines", "pointMaterial", "markStride",
      { label: "Scale", controls: ["tickLength", "nodeSize", "weight"], proportional: true }] },
  ],
  defaults: {count: 24,
    tolerance: .005,
    fieldScale: .006,
    weight: 1.2,
    layout: "grid",
    columns: 6,
    centerX: 320,
    centerY: 260,
    extent: 390,
    aspect: .75,
    heading: 0,
    spread: 25,
    attempts: 360,
    stepDistance: 2,
    fieldOffsetX: 7.3,
    fieldOffsetY: 11.7,
    pathLines: true,
    pointMaterial: "none",
    markStride: 8,
    tickLength: 7,
    nodeSize: 3},
  validate: validateBandMarks,
};
const branchDefinition: StudioDefinition = {
  id: "branch-marks", title: "Branch marks",
  description: "Seeded breadth-first endpoint branches from editable local roots and per-slot survival.",
  procedure: "Each root grows generation by generation, every segment offering a few child slots that survive or die by chance. Surviving children turn away and shorten, and the dead slots leave gaps that make each tree its own.",
  parameters: [numeric("rootCount", "Roots", "Number of independent source trees.", 1, 12, 1, { integer: true, hardMin: 1, hardMax: 24 }),
    choice("layout", "Root layout", "Line, grid, random area or ring.", ["line", "grid", "area", "ring"]),
    numeric("columns", "Grid columns", "Root columns for grid layout.", 1, 8, 1, { integer: true, hardMin: 1, hardMax: 24 }),
    numeric("centerX", "Center X", "Canvas X of the root arrangement.", -320, 960, 1),
    numeric("centerY", "Center Y", "Canvas Y of the root arrangement.", -320, 960, 1),
    numeric("extent", "Extent", "Horizontal root span.", 0, 600, 1),
    numeric("aspect", "Aspect", "Root vertical span as multiple of extent.", 0, 3, .05),
    numeric("heading", "Root heading", "Degrees, 0 points right, -90 points up.", -180, 180, 1),
    numeric("headingSpread", "Root spread", "Seeded root heading variation, degrees.", 0, 180, 1),
    numeric("rootLength", "Root length", "Initial segment length in canvas units.", 1, 240, 1),
    numeric("generations", "Generations", "Additional child generations beyond root generation zero.", 0, 7, 1, { integer: true, hardMin: 0, hardMax: 9 }),
    choice("children", "Child slots", "Two or three independent potential children per parent.", ["2", "3"]),
    numeric("angle", "Branch angle", "Outer child turn relative to parent heading, degrees.", 0, 100, 1),
    numeric("angleSpread", "Turn spread", "Seeded turn variation around each child slot, degrees.", 0, 60, 1),
    numeric("contraction", "Length contraction", "Per-generation child/root length ratio.", .2, 1, .01, { hardMin: .05, hardMax: 1.2 }),
    numeric("survival", "Child survival", "Independent probability per child slot; pruned branches have no descendants.", 0, 1, .01),
    toggle("strokes", "Branch strokes", "Paint retained segment strokes."),
    numeric("weight", "Base weight", "Root stroke weight; subsequent generations taper.", .3, 5, .1),
    numeric("tipSize", "Tip size", "Diameter of retained leaf-tip dots; zero hides dots.", 0, 10, .5)],
  controlGroups: [
    { label: "Roots", stage: "form", controls: ["layout", "columns", "rootCount",
      { label: "Heading", controls: ["heading", "headingSpread"] }] },
    rootPlacement,
    { label: "Growth", stage: "process", controls: ["rootLength", "generations", "children", "contraction", "survival",
      { label: "Turn", controls: ["angle", "angleSpread"] }] },
    { label: "Drawing", stage: "material", controls: ["strokes", { label: "Scale", controls: ["weight", "tipSize"], proportional: true }] },
  ],
  defaults: {generations: 5,
    weight: 2,
    tipSize: 4,
    rootCount: 1,
    layout: "line",
    columns: 3,
    centerX: 320,
    centerY: 510,
    extent: 320,
    aspect: .7,
    heading: -90,
    headingSpread: 0,
    rootLength: 105,
    children: "3",
    angle: 29,
    angleSpread: 14,
    contraction: .75,
    survival: .7,
    strokes: true},
  validate: validateBranchMarks,
};
const cutDefinition: StudioDefinition = {
  id: "cut-branch-marks", title: "Cut branch marks",
  description: "A retained line pool whose source endpoints are split by seeded cut attempts.",
  procedure: "A single line segment is picked at random and cut, sprouting up to two new segments where it splits. Repeated many times, the stem shatters into a spray of twigs.",
  parameters: [numeric("startX", "Start X", "Initial source segment start X in canvas units.", -320, 960, 1),
    numeric("startY", "Start Y", "Initial source segment start Y.", -320, 960, 1),
    numeric("endX", "End X", "Initial source segment end X.", -320, 960, 1),
    numeric("endY", "End Y", "Initial source segment end Y.", -320, 960, 1),
    numeric("minCutLength", "Minimum cut length", "Selected segments shorter than this are skipped.", .1, 20, .1),
    numeric("attempts", "Cut attempts", "Attempts include skips; each successful cut adds at most two segments.", 0, 6000, 1, { integer: true, hardMin: 0, hardMax: 6000 }),
    numeric("angle", "First-cut angle scale", "Spread of the first children from an undivided segment.", 0, 2.5, .05),
    toggle("segments", "Final segments", "Paint the actual retained line-pool segments."),
    numeric("weight", "Stroke weight", "Retained segment stroke width.", .15, 2, .05),
    numeric("opacity", "Opacity", "Segment alpha, 0 is invisible.", 0, 255, 1)],
  controlGroups: [
    { label: "Segment", stage: "form", controls: [
      { label: "Start", controls: ["startX", "startY"] },
      { label: "End", controls: ["endX", "endY"] }] },
    { label: "Cuts", stage: "form", controls: ["attempts", "minCutLength", "angle"] },
    { label: "Drawing", stage: "material", controls: ["segments", "weight", "opacity"] },
  ],
  defaults: {attempts: 6000,
    angle: 1.1,
    weight: 1,
    opacity: 170,
    startX: 180,
    startY: 550,
    endX: 440,
    endY: 200,
    minCutLength: 4,
    segments: true},
  validate: validateCutBranchMarks,
};
export const constructedGeometryDefinitions: StudioDefinition[] = [bandDefinition, branchDefinition, cutDefinition];
for (const definition of constructedGeometryDefinitions)
  for (const parameter of definition.parameters)
    if (parameter.type === "number" && parameter.integer === undefined) parameter.integer = false;

function bandOptions(q: Params) {
  const options = {
    count: number(q, "count", 1, 96, true),
    layout: select(q, "layout", ["line", "grid", "area", "ring"] as const),
    columns: number(q, "columns", 1, 96, true),
    centerX: number(q, "centerX", -10000, 10000), centerY: number(q, "centerY", -10000, 10000),
    extent: number(q, "extent", 0, 1000), aspect: number(q, "aspect", 0, 4),
    heading: number(q, "heading", -360, 360), spread: number(q, "spread", 0, 180),
    attempts: number(q, "attempts", 0, 2000, true), stepDistance: number(q, "stepDistance", 0, 40),
    fieldScale: number(q, "fieldScale", -1, 1),
    fieldOffsetX: number(q, "fieldOffsetX", -10000, 10000), fieldOffsetY: number(q, "fieldOffsetY", -10000, 10000),
    tolerance: number(q, "tolerance", 0, 1),
    pathLines: flag(q, "pathLines"), pointMaterial: select(q, "pointMaterial", ["none", "nodes", "ticks"] as const),
    markStride: number(q, "markStride", 1, 1000, true), tickLength: number(q, "tickLength", 0, 200),
    nodeSize: number(q, "nodeSize", 0, 200), weight: number(q, "weight", 0, 100),
  };
  if (options.count * (options.attempts + 1) > MAX_BAND_WORK)
    throw new Error(`Band attempt/output budget exceeded (count × (attempts + 1) ≤ ${MAX_BAND_WORK})`);
  return options;
}
function branchOptions(q: Params) {
  const options = {
    rootCount: number(q, "rootCount", 1, 24, true),
    layout: select(q, "layout", ["line", "grid", "area", "ring"] as const),
    columns: number(q, "columns", 1, 24, true),
    centerX: number(q, "centerX", -10000, 10000), centerY: number(q, "centerY", -10000, 10000),
    extent: number(q, "extent", 0, 1000), aspect: number(q, "aspect", 0, 4),
    heading: number(q, "heading", -360, 360), headingSpread: number(q, "headingSpread", 0, 180),
    rootLength: number(q, "rootLength", 0.001, 1000),
    generations: number(q, "generations", 0, 9, true),
    children: select(q, "children", ["2", "3"] as const),
    angle: number(q, "angle", 0, 180), angleSpread: number(q, "angleSpread", 0, 180),
    contraction: number(q, "contraction", .05, 1.2), survival: number(q, "survival", 0, 1),
    strokes: flag(q, "strokes"), weight: number(q, "weight", 0, 100), tipSize: number(q, "tipSize", 0, 100),
  };
  const slots = Number(options.children);
  let width = options.rootCount, bound = width;
  for (let i = 0; i < options.generations; i++) {
    width *= slots; bound += width;
    if (bound > MAX_BRANCH_SEGMENTS) throw new Error(`Branch potential segment budget exceeded (${MAX_BRANCH_SEGMENTS})`);
  }
  return options;
}
function cutOptions(q: Params) {
  const options = {
    startX: number(q, "startX", -10000, 10000), startY: number(q, "startY", -10000, 10000),
    endX: number(q, "endX", -10000, 10000), endY: number(q, "endY", -10000, 10000),
    minCutLength: number(q, "minCutLength", .001, 1000),
    attempts: number(q, "attempts", 0, 6000, true), angle: number(q, "angle", 0, 10),
    segments: flag(q, "segments"), weight: number(q, "weight", 0, 100), opacity: number(q, "opacity", 0, 255),
  };
  if (options.attempts * 2 + 1 > MAX_CUT_SEGMENTS) throw new Error("Cut output budget exceeded");
  return options;
}
export function validateBandMarks(q: Params): void {  bandOptions(q); }
export function validateBranchMarks(q: Params): void {  branchOptions(q); }
export function validateCutBranchMarks(q: Params): void {  cutOptions(q); }

// One recent source of each kind; the key excludes material/palette so repainting does not regenerate geometry.
let bandCache: { key: string; paths: BandPath[] } | undefined;
let branchCache: { key: string; trees: BranchTree[] } | undefined;
let cutCache: { key: string; pool: CutBranchPool } | undefined;

export function buildBandPaths(q: Params, seedValue: number): BandPath[] {
  const o = bandOptions(q), s = seed(seedValue);
  const key = JSON.stringify([s, o.count, o.layout, o.columns, o.centerX, o.centerY, o.extent, o.aspect,
    o.heading, o.spread, o.attempts, o.stepDistance, o.fieldScale, o.fieldOffsetX, o.fieldOffsetY, o.tolerance]);
  if (bandCache?.key === key) return bandCache.paths;
  const origins = starts(o.layout, o.count, o.columns, o.centerX, o.centerY, o.extent, o.aspect, o.heading, o.spread, s);
  const paths = origins.map((origin, i) => noiseBandPath2D({
    field: { seed: (s + 17) >>> 0 }, start: origin.position, heading: origin.heading,
    seed: (s + i) >>> 0, attempts: o.attempts, stepDistance: o.stepDistance,
    fieldScale: o.fieldScale, fieldOffset: [o.fieldOffsetX, o.fieldOffsetY],
    tolerance: o.tolerance, maxVertices: o.attempts + 2,
  }));
  bandCache = { key, paths };
  return paths;
}
export function buildBranchTrees(q: Params, seedValue: number): BranchTree[] {
  const o = branchOptions(q), s = seed(seedValue);
  const key = JSON.stringify([s, o.rootCount, o.layout, o.columns, o.centerX, o.centerY, o.extent,
    o.aspect, o.heading, o.headingSpread, o.rootLength, o.generations, o.children,
    o.angle, o.angleSpread, o.contraction, o.survival]);
  if (branchCache?.key === key) return branchCache.trees;
  const slots = Number(o.children);
  const rules = Array.from({ length: o.generations }, () => ({ lengthScale: [o.contraction, o.contraction],
    slots: Array.from({ length: slots }, (_, i) => {
      const center = slots === 2 ? (i === 0 ? -o.angle : o.angle) : (i - 1) * o.angle;
      return { probability: o.survival, turn: [(center - o.angleSpread) * radians, (center + o.angleSpread) * radians] };
    }),
  }));
  const roots = starts(o.layout, o.rootCount, o.columns, o.centerX, o.centerY, o.extent,
    o.aspect, o.heading, o.headingSpread, s);
  const trees = roots.map((root, i) => seededEndpointBranches2D({ seed: (s + i) >>> 0,
    root: { origin: root.position, heading: root.heading, length: o.rootLength },
    rules, maxSegments: MAX_BRANCH_SEGMENTS }));
  branchCache = { key, trees };
  return trees;
}
export function buildCutBranchPool(q: Params, seedValue: number): CutBranchPool {
  const o = cutOptions(q), s = seed(seedValue);
  const key = JSON.stringify([s, o.startX, o.startY, o.endX, o.endY, o.minCutLength, o.attempts, o.angle]);
  if (cutCache?.key === key) return cutCache.pool;
  const pool = seededLinePool2D({ seed: s, segment: [o.startX, o.startY, o.endX, o.endY],
    minCutLength: o.minCutLength, attempts: o.attempts, firstCutAngleScale: o.angle,
    maxSegments: o.attempts * 2 + 1 });
  cutCache = { key, pool };
  return pool;
}
function paint(p: Canvas, layer: Layer, i: number, alpha: number, fill = false): void {
  const rgb = channels(layer.palette[i % layer.palette.length] >>> 0);
  if (fill) p.fill(...rgb, alpha); else p.stroke(...rgb, alpha);
}
export function drawConstructedGeometry(p: Canvas, layer: Layer): void {
  p.push();
  try {
    if (layer.technique === "band-marks") {
      const o = bandOptions(layer.params);
      if (!(o.pathLines && o.weight > 0) &&
          !(o.pointMaterial === "ticks" && o.tickLength > 0 && o.weight > 0) &&
          !(o.pointMaterial === "nodes" && o.nodeSize > 0)) return;
      const paths = buildBandPaths(layer.params, layer.seed);
      p.noFill(); p.strokeWeight(o.weight);
      const a = new Float64Array(2), b = new Float64Array(2);
      for (let i = 0; i < paths.length; i++) {
        const path = paths[i]; paint(p, layer, i, 170);
        if (o.pathLines && o.weight > 0) for (let j = 1; j < path.size; j++) {
          path.pointInto(j - 1, a); path.pointInto(j, b);
          p.line(a[0], a[1], b[0], b[1]);
        }
        if (o.pointMaterial === "ticks" && o.tickLength > 0 && o.weight > 0)
          for (let j = o.markStride; j < path.size; j += o.markStride) {
            path.pointInto(j, a);
            const h = path.headingAt(j - 1), dx = -Math.sin(h) * o.tickLength / 2,
              dy = Math.cos(h) * o.tickLength / 2;
            p.line(a[0] - dx, a[1] - dy, a[0] + dx, a[1] + dy);
          }
        if (o.pointMaterial === "nodes" && o.nodeSize > 0) {
          p.noStroke(); paint(p, layer, i, 195, true);
          for (let j = 0; j < path.size; j += o.markStride) {
            path.pointInto(j, a); p.circle(a[0], a[1], o.nodeSize);
          }
          paint(p, layer, i, 170);
        }
      }
      return;
    }
    if (layer.technique === "branch-marks") {
      const o = branchOptions(layer.params);
      if (!(o.strokes && o.weight > 0) && o.tipSize === 0) return;
      const trees = buildBranchTrees(layer.params, layer.seed);
      const segment = new Float64Array(4);
      const weights = new Float64Array(o.generations + 1);
      weights[0] = o.weight;
      for (let i = 1; i < weights.length; i++) weights[i] = weights[i - 1] * o.contraction;
      p.noFill();
      for (let t = 0; t < trees.length; t++) {
        const tree = trees[t];
        for (let i = 0; i < tree.size; i++) {
          tree.segmentInto(i, segment);
          const generation = tree.generationAt(i);
          if (o.strokes && o.weight > 0) {
            paint(p, layer, generation + t, 235);
            p.strokeWeight(weights[generation]);
            p.line(segment[0], segment[1], segment[2], segment[3]);
          }
          if (o.tipSize > 0 && tree.childCountAt(i) === 0) {
            p.noStroke(); paint(p, layer, generation + t + 1, 235, true);
            p.circle(segment[2], segment[3], o.tipSize);
          }
        }
      }
      return;
    }
    if (layer.technique === "cut-branch-marks") {
      const o = cutOptions(layer.params);
      if (!o.segments || o.weight === 0 || o.opacity === 0) return;
      const pool = buildCutBranchPool(layer.params, layer.seed);
      p.noFill(); p.strokeWeight(o.weight); paint(p, layer, 0, o.opacity);
      const segment = new Float64Array(4);
      for (let i = 0; i < pool.size; i++) {
        pool.segmentInto(i, segment);
        p.line(segment[0], segment[1], segment[2], segment[3]);
      }
      return;
    }
    throw new Error(`Unknown constructed geometry technique: ${layer.technique}`);
  } finally { p.pop(); }
}
