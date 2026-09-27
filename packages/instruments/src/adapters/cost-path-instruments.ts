import { costGridPaths2D, gradientNoise2D01, marchingSquares2D } from "@procedurals/javascript";
import type { Layer } from "../types.js";;
import { channels, choice, numeric, text, type StudioDefinition } from "./types.js";;

type Params = Layer["params"];
type Kind = "obstacle-roads" | "arrival-contours";
type Painter = {
  noStroke(): void; noFill(): void;
  stroke(r: number, g: number, b: number, alpha: number): void;
  fill(r: number, g: number, b: number, alpha: number): void;
  strokeWeight(weight: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  rect(x: number, y: number, width: number, height: number): void;
  circle(x: number, y: number, diameter: number): void;
};

const sourceParameters = [
  numeric("columns", "Columns", "Number of raster cells across the local grid.", 8, 40, 1, { hardMin: 2, hardMax: 50, integer: true }),
  numeric("rows", "Rows", "Number of raster cells down the local grid.", 8, 40, 1, { hardMin: 2, hardMax: 50, integer: true }),
  numeric("originX", "Origin X", "Left grid edge in canvas units; no automatic fitting.", 0, 640, 1, { hardMin: -1280, hardMax: 1920 }),
  numeric("originY", "Origin Y", "Top grid edge in canvas units; no automatic fitting.", 0, 640, 1, { hardMin: -1280, hardMax: 1920 }),
  numeric("extentX", "Grid width", "Total horizontal grid extent in canvas units.", 40, 600, 1, { hardMin: 1, hardMax: 2400 }),
  numeric("extentY", "Grid height", "Total vertical grid extent in canvas units.", 40, 600, 1, { hardMin: 1, hardMax: 2400 }),
  numeric("startColumn", "Start column", "Exact zero-based source cell column; blocked starts are errors.", 0, 39, 1, { hardMin: 0, hardMax: 49, integer: true }),
  numeric("startRow", "Start row", "Exact zero-based source cell row; blocked starts are errors.", 0, 39, 1, { hardMin: 0, hardMax: 49, integer: true }),
  choice("costMode", "Cost source", "Noise, stripes, or an exact numeric grid override.", ["noise", "stripes", "grid"]),
  text("costGrid", "Numeric grid", "For grid mode: one row per line, comma or space separated nonnegative costs; x denotes an obstacle.", 30000, true),
  numeric("density", "Obstacle density", "Fractional cutoff for independent noise obstacles, or striped blocked portions.", 0, .8, .01, { hardMin: 0, hardMax: .95 }),
  numeric("frequency", "Source frequency", "Noise cycles or stripe cycles across the grid extent.", .25, 12, .05, { hardMin: .05, hardMax: 40 }),
  numeric("contrast", "Cost contrast", "Difference between low-cost and high-cost traversable cells; zero makes uniform cost 1.", 0, 10, .1, { hardMin: 0, hardMax: 100 }),
  choice("goalLayout", "Goal placement", "Goals spread along the far edge, on a ring, or specified as cell coordinates.", ["edge", "ring", "explicit"]),
  numeric("goalCount", "Goals", "Number of evenly spaced goal cells for edge and ring placement.", 1, 32, 1, { hardMin: 1, hardMax: 96, integer: true }),
  text("goalCells", "Explicit goals", "For explicit placement, one zero-based column,row pair per line. Blocked and disconnected goals have no road.", 2048, true),
];
const treatmentParameters = [
  numeric("weight", "Stroke weight", "Path or contour line width; zero hides lines without changing computed paths.", 0, 5, .1, { hardMin: 0, hardMax: 40 }),
  numeric("nodeSize", "Path node size", "Diameter at reachable goal-to-start path nodes; zero hides nodes.", 0, 10, .1, { hardMin: 0, hardMax: 40 }),
  numeric("obstacleInk", "Obstacle ink", "Fraction of each blocked cell painted with transparent colored ink; zero hides blocked cells.", 0, 1, .05, { hardMin: 0, hardMax: 1 }),
  numeric("contourCount", "Contour count", "Number of arrival-cost isolines; only the contour treatment draws them.", 1, 16, 1, { hardMin: 1, hardMax: 32, integer: true }),
  numeric("contourBase", "First arrival", "First isoline cost, in the same units as grid entry costs.", 1, 200, 1, { hardMin: 0, hardMax: 100000000 }),
  numeric("contourSpacing", "Arrival spacing", "Strictly positive cost difference between isolines.", 1, 40, 1, { hardMin: .000001, hardMax: 100000000 }),
];
const sharedDefaults = {columns: 28,
  rows: 28,
  originX: 68,
  originY: 68,
  extentX: 504,
  extentY: 504,
  startColumn: 5,
  startRow: 14,
  costMode: "noise",
  costGrid: "",
  density: .17,
  frequency: 5,
  contrast: 3,
  obstacleInk: 0};
export const costPathInstrumentDefinitions: StudioDefinition[] = [
  { id: "obstacle-roads", title: "Obstacle roads",
    description: "Editable weighted four-neighbor paths from one fixed start to actual goals; blocked destinations remain blocked.",
    parameters: [...sourceParameters, ...treatmentParameters.filter(parameter =>
      !["contourCount", "contourBase", "contourSpacing"].includes(parameter.key))],
    defaults: { ...sharedDefaults, columns: 24, rows: 24, startColumn: 3, startRow: 12,
      goalLayout: "edge", goalCount: 12, goalCells: "", weight: 1.8, nodeSize: 2, obstacleInk: .65 },
    validate: q => validateCostPathInstrument(q, "obstacle-roads") },
  { id: "arrival-contours", title: "Arrival contours",
    description: "Arrival-cost isolines only where all four source samples are finite and reachable.",
    parameters: [...sourceParameters.filter(parameter =>
      !["goalLayout", "goalCount", "goalCells"].includes(parameter.key)),
      ...treatmentParameters.filter(parameter => parameter.key !== "nodeSize")],
    defaults: { ...sharedDefaults, weight: 1.4, density: .08, contrast: 2.3,
      contourCount: 12, contourBase: 7, contourSpacing: 6 },
    validate: q => validateCostPathInstrument(q, "arrival-contours") },
];
function checked(q: Params, key: string, min: number, max: number, integer = false): number {
  const value = q[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value)))
    throw Error(`${key} must be ${integer ? "an integer" : "a finite number"} in [${min}, ${max}]`);
  return value;
}
function gridLines(input: string): string[][] {
  return input.trim().split(/\r?\n/).map(line => line.trim().split(/[\s,]+/));
}
function readCosts(q: Params, columns: number, rows: number): (number | null)[] {
  const lines = gridLines(String(q.costGrid));
  if (lines.length !== rows || lines.some(line => line.length !== columns))
    throw Error(`costGrid must contain exactly ${rows} rows of ${columns} entries`);
  return lines.flatMap((line, y) => line.map((token, x) => {
    if (token.toLowerCase() === "x") return null;
    const value = Number(token);
    if (!/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(token) || !Number.isFinite(value) || value < 0 || value > 1000000)
      throw Error(`costGrid entry at column ${x}, row ${y} must be a nonnegative finite cost <= 1000000 or x`);
    return value;
  }));
}
function goals(q: Params, columns: number, rows: number): number[] {
  if (q.goalLayout === "explicit") {
    const lines = String(q.goalCells).trim().split(/\r?\n/);
    if (lines.length > 96) throw Error("At most 96 explicit goals are allowed");
    return lines.map((line, lineNumber) => {
      const match = /^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(line);
      if (!match) throw Error(`Goal line ${lineNumber + 1} must contain column,row`);
      const x = Number(match[1]), y = Number(match[2]);
      if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x >= columns || y >= rows)
        throw Error(`Goal line ${lineNumber + 1} is outside the grid`);
      return y * columns + x;
    });
  }
  const count = Number(q.goalCount), positions: number[] = [];
  for (let i = 0; i < count; i++) {
    if (q.goalLayout === "edge") positions.push(Math.round((i + .5) * rows / count - .5) * columns + columns - 1);
    else {
      const angle = 2 * Math.PI * i / count;
      positions.push(Math.round((rows - 1) * (.5 + .44 * Math.sin(angle))) * columns +
        Math.round((columns - 1) * (.5 + .44 * Math.cos(angle))));
    }
  }
  if (new Set(positions).size !== count)
    throw Error("Goal count cannot fit distinct cells in the selected arrangement and grid");
  return positions;
}
export function validateCostPathInstrument(q: Params, kind: Kind): void {
  
  const columns = checked(q, "columns", 2, 50, true), rows = checked(q, "rows", 2, 50, true);
  const count = columns * rows;
  if (count > 2500) throw Error("Cost grid exceeds 2500 cells");
  for (const [key, lo, hi] of [
    ["originX", -1280, 1920], ["originY", -1280, 1920], ["extentX", 1, 2400], ["extentY", 1, 2400],
    ["density", 0, .95], ["frequency", .05, 40], ["contrast", 0, 100],
    ["weight", 0, 40], ["obstacleInk", 0, 1],
  ] as const) checked(q, key, lo, hi);
  const startColumn = checked(q, "startColumn", 0, 49, true), startRow = checked(q, "startRow", 0, 49, true);
  if (startColumn >= columns || startRow >= rows) throw Error("Requested start cell is outside the grid");
  if (!["noise", "stripes", "grid"].includes(String(q.costMode))) throw Error("Unknown cost source");
  if (typeof q.costGrid !== "string" || q.costGrid.length > 30000) throw Error("Grid text exceeds its length limit");
  if (q.costMode === "grid") {
    const costs = readCosts(q, columns, rows);
    if (costs[startRow * columns + startColumn] === null) throw Error("Requested start cell is blocked");
  }
  let contourWork = 0;
  if (kind === "arrival-contours") {
    const levels = checked(q, "contourCount", 1, 32, true);
    const base = checked(q, "contourBase", 0, 100000000), spacing = checked(q, "contourSpacing", .000001, 100000000);
    if (base + (levels - 1) * spacing > 100000000) throw Error("Contour levels exceed supported arrival costs");
    contourWork = levels * (count + (columns - 1) * (rows - 1));
  } else {
    checked(q, "nodeSize", 0, 40);
    if (!["edge", "ring", "explicit"].includes(String(q.goalLayout))) throw Error("Unknown goal placement");
    checked(q, "goalCount", 1, 96, true);
    if (typeof q.goalCells !== "string" || q.goalCells.length > 2048) throw Error("Goal text exceeds its length limit");
    goals(q, columns, rows);
  }
  // Core shortest-path preflight is n²+5n; only the contour view adds marching work.
  if (count * count + 5 * count + contourWork > 6500000)
    throw Error("Cost path and contour work budget exceeded");
}
export type CostPathSource = {
  columns: number; rows: number; costs: (number | null)[]; start: number; goalIndices: number[];
  distances: (number | null)[]; predecessors: (number | null)[];
};
let cached: { key: string; source: CostPathSource } | undefined;
/** The only retained source is keyed by construction inputs; palette and materials do not rerun shortest paths. */
export function costPathSource(q: Params, seed: number, kind: Kind): CostPathSource {
  validateCostPathInstrument(q, kind);
  const columns = Number(q.columns), rows = Number(q.rows), count = columns * rows;
  const start = Number(q.startRow) * columns + Number(q.startColumn);
  const key = JSON.stringify([kind, columns, rows, start, q.costMode, q.costMode === "grid" ? q.costGrid :
    [q.density, q.frequency, q.contrast, q.costMode === "noise" && (Number(q.density) > 0 || Number(q.contrast) > 0) ? seed : null],
    kind === "obstacle-roads" ? [q.goalLayout, q.goalLayout === "explicit" ? q.goalCells : q.goalCount] : null]);
  if (cached?.key === key) return cached.source;
  let costs: (number | null)[];
  if (q.costMode === "grid") costs = readCosts(q, columns, rows);
  else {
    const density = Number(q.density), frequency = Number(q.frequency), contrast = Number(q.contrast);
    const noise = q.costMode === "noise" && (density > 0 || contrast > 0) ? gradientNoise2D01({ seed }) : undefined;
    costs = Array.from({ length: count }, (_, index) => {
      if (density === 0 && contrast === 0) return 1;
      const x = index % columns, y = Math.floor(index / columns);
      const u = (x + .5) / columns, v = (y + .5) / rows;
      const obstacleSignal = density === 0 ? 1 : noise ? noise.sample(u * frequency + 103.51, v * frequency + 85.93) :
        (u * frequency) % 1;
      if (obstacleSignal < density) return null;
      const costSignal = contrast === 0 ? 0 : noise ? noise.sample(u * frequency + 17.13, v * frequency + 31.77) :
        .5 + .5 * Math.sin(2 * Math.PI * u * frequency);
      return 1 + contrast * costSignal;
    });
  }
  if (costs[start] === null) throw Error("Requested start cell is blocked");
  const result = costGridPaths2D({ columns, rows, costs, start, maxWork: count * count + 5 * count });
  const source: CostPathSource = { columns, rows, costs, start,
    goalIndices: kind === "obstacle-roads" ? goals(q, columns, rows) : [],
    distances: result.distances, predecessors: result.predecessors };
  cached = { key, source };
  return source;
}
/** A contour quad is eligible only if all four corners have actual finite arrival distances. */
export function costPathContours(source: CostPathSource, base: number, spacing: number, count: number,
  originX: number, originY: number, extentX: number, extentY: number): [number, number, number, number][][] {
  const { columns, rows, distances } = source;
  const cellX = extentX / columns, cellY = extentY / rows;
  const runs: { values: number[]; width: number; x: number; y: number }[] = [];
  for (let y = 0; y < rows - 1; y++) {
    const eligible = (col: number) => distances[y * columns + col] !== null &&
      distances[y * columns + col + 1] !== null &&
      distances[(y + 1) * columns + col] !== null && distances[(y + 1) * columns + col + 1] !== null;
    let x = 0;
    while (x < columns - 1) {
      if (!eligible(x)) { x++; continue; }
      const first = x;
      while (x < columns - 1 && eligible(x)) x++;
      const width = x - first + 1;
      const values: number[] = [];
      for (let row = y; row <= y + 1; row++)
        for (let col = first; col < first + width; col++) {
          const value = distances[row * columns + col];
          if (value === null) throw Error("Invalid contour quad");
          values.push(value);
        }
      runs.push({ values, width, x: first, y });
    }
  }
  const output: [number, number, number, number][][] = [];
  for (let level = 0; level < count; level++) {
    const segments: [number, number, number, number][] = [];
    const threshold = base + level * spacing;
    for (const { values, width, x, y } of runs) {
      const result = marchingSquares2D({ values, columns: width, rows: 2,
        origin: [originX + (x + .5) * cellX, originY + (y + .5) * cellY], spacing: [cellX, cellY],
        threshold, maxWork: width * 2 + width - 1 });
      for (const [x1, y1, x2, y2] of result.segments) segments.push([x1, y1, x2, y2]);
    }
    output.push(segments);
  }
  return output;
}
export function drawCostPathInstrument(p: Painter, layer: Layer): void {
  const q = layer.params;
  
  const kind: Kind = layer.technique === "arrival-contours" ? "arrival-contours" : "obstacle-roads";
  const weight = Number(q.weight), nodeSize = kind === "obstacle-roads" ? Number(q.nodeSize) : 0, obstacleInk = Number(q.obstacleInk);
  if (weight === 0 && (kind === "arrival-contours" || nodeSize === 0) && obstacleInk === 0) {
    validateCostPathInstrument(q, kind);
    return;
  }
  const source = costPathSource(q, layer.seed, kind);
  const { columns, rows } = source;
  const cellX = Number(q.extentX) / columns, cellY = Number(q.extentY) / rows;
  const xAt = (index: number) => Number(q.originX) + (index % columns + .5) * cellX;
  const yAt = (index: number) => Number(q.originY) + (Math.floor(index / columns) + .5) * cellY;
  const palette = layer.palette.length ? layer.palette : [0x242424];
  if (obstacleInk > 0) {
    p.noStroke(); p.fill(...channels(palette[1 % palette.length]), 155);
    for (let i = 0; i < source.costs.length; i++) if (source.costs[i] === null)
      p.rect(xAt(i) - cellX * obstacleInk / 2, yAt(i) - cellY * obstacleInk / 2,
        cellX * obstacleInk, cellY * obstacleInk);
  }
  if (kind === "arrival-contours") {
    if (weight === 0) return;
    p.noFill(); p.strokeWeight(weight);
    const levels = costPathContours(source, Number(q.contourBase), Number(q.contourSpacing), Number(q.contourCount),
      Number(q.originX), Number(q.originY), Number(q.extentX), Number(q.extentY));
    levels.forEach((segments, level) => {
      p.stroke(...channels(palette[level % palette.length]), 225);
      for (const [x1, y1, x2, y2] of segments) p.line(x1, y1, x2, y2);
    });
    return;
  }
  const drawnEdges = new Set<number>();
  for (let goalNumber = 0; goalNumber < source.goalIndices.length; goalNumber++) {
    const goal = source.goalIndices[goalNumber];
    if (source.distances[goal] === null) continue;
    const color = channels(palette[goalNumber % palette.length]);
    if (weight > 0) { p.noFill(); p.stroke(...color, 225); p.strokeWeight(weight); }
    if (nodeSize > 0) { p.noStroke(); p.fill(...color, 230); }
    let current = goal;
    for (let traversed = 0; traversed < source.costs.length; traversed++) {
      const parent = source.predecessors[current];
      if (nodeSize > 0) p.circle(xAt(current), yAt(current), nodeSize);
      if (parent === null) break;
      if (weight > 0 && !drawnEdges.has(current)) {
        p.stroke(...color, 225); p.strokeWeight(weight);
        p.line(xAt(current), yAt(current), xAt(parent), yAt(parent));
        drawnEdges.add(current);
      }
      current = parent;
    }
  }
}
