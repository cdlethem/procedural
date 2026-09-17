import type { Layer } from "../studio-types";
import { grayScottStep2D } from "../../../../packages/javascript/src/gray-scott-step-2d.js";
import { lifeLikeStep2D } from "../../../../packages/javascript/src/life-like-step-2d.js";

type CellularStudy = "reaction-spots" | "reaction-stripes" | "organic-cells" | "geometric-generations";
type Source = "disc" | "bands" | "checker" | "speckle";
type Rule = "life" | "highlife" | "seeds" | "day-night";
type Params = Layer["params"];
const CELL_UPDATES_LIMIT = 147_456;
const SOURCE_TYPES = ["disc", "bands", "checker", "speckle"];
const RULES: Record<Rule, { birth: number[]; survival: number[] }> = {
  life: { birth: [3], survival: [2, 3] },
  highlife: { birth: [3, 6], survival: [2, 3] },
  seeds: { birth: [2], survival: [] },
  "day-night": { birth: [3, 6, 7, 8], survival: [3, 4, 6, 7, 8] },
};

function number(params: Params, key: string, min: number, max: number, integer = false): number {
  const value = params[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max ||
      (integer && !Number.isInteger(value)))
    throw new Error(`${key} must be ${integer ? "an integer" : "a finite number"} between ${min} and ${max}`);
  return value;
}
function dimensions(id: CellularStudy): [number, number] {
  return id === "reaction-spots" || id === "reaction-stripes" ? [24, 24] : [20, 20];
}
export function validateSystemsAQuality(id: CellularStudy, params: Params): void {
  if (params.legacy === true) return;
  const [columns, rows] = dimensions(id);
  const passes = number(params, "passes", 0, 256, true);
  if (columns * rows * passes > CELL_UPDATES_LIMIT) throw new Error("Cellular study combined generation budget exceeded");
  if (!SOURCE_TYPES.includes(String(params.source)) ||
      (id === "reaction-stripes" && params.source === "checker"))
    throw new Error("Invalid initial source field");
  number(params, "sourceX", -100, 100);
  number(params, "sourceY", -100, 100);
  number(params, "frequency", 1, Math.floor(Math.min(columns, rows) / 2), true);
  number(params, "occupancy", 0, 1);
  number(params, "weight", 0, 100);
  if (id === "reaction-spots" || id === "reaction-stripes") {
    number(params, "scale", .01, 10000);
    number(params, "feed", .02, .06);
    number(params, "kill", .04, .08);
  } else {
    number(params, "cellSize", .01, 10000);
    if (!Object.hasOwn(RULES, String(params.rule))) throw new Error("Invalid Life-like rule");
    if (params.boundary !== "WRAP" && params.boundary !== "DEAD") throw new Error("Invalid Life-like boundary");
  }
}

function hash(x: number, y: number, seed: number): number {
  let value = Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca6b) ^ (seed >>> 0);
  value = Math.imul(value ^ (value >>> 16), 0xc2b2ae35);
  value = Math.imul(value ^ (value >>> 13), 0x27d4eb2f);
  return ((value ^ (value >>> 16)) >>> 0) / 0x100000000;
}
const smooth = (t: number) => t * t * (3 - 2 * t);
function speckle(u: number, v: number, seed: number): number {
  const x = Math.floor(u), y = Math.floor(v), tx = smooth(u - x), ty = smooth(v - y);
  const a = hash(x, y, seed), b = hash(x + 1, y, seed);
  const c = hash(x, y + 1, seed), d = hash(x + 1, y + 1, seed);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}
function sourceValue(source: Source, u: number, v: number, seed: number): number {
  if (source === "disc") {
    const dx = u - Math.round(u), dy = v - Math.round(v);
    return Math.exp(-12 * (dx * dx + dy * dy));
  }
  if (source === "bands") return .5 + .5 * Math.cos(2 * Math.PI * (.8 * u + .6 * v));
  if (source === "checker")
    return .5 + .5 * Math.cos(2 * Math.PI * u) * Math.cos(2 * Math.PI * v);
  return speckle(u, v, seed);
}

/** A replaceable, deterministic binary input shared by Gray–Scott and Life-like studies. */
export function cellularInitialCells(id: CellularStudy, params: Params, seed: number): number[] {
  validateSystemsAQuality(id, params);
  const [columns, rows] = dimensions(id), frequency = Number(params.frequency);
  const phaseX = (hash(0, 0, seed) - .5) * .3;
  const phaseY = (hash(1, 0, seed) - .5) * .3;
  const source = params.source as Source, occupancy = Number(params.occupancy);
  const values = Array.from({ length: columns * rows }, (_, index) => {
    const x = (index % columns + .5) / columns - .5;
    const y = (Math.floor(index / columns) + .5) / rows - .5;
    const u = (x - Number(params.sourceX) + phaseX) * frequency;
    const v = (y - Number(params.sourceY) + phaseY) * frequency;
    return sourceValue(source, u, v, seed);
  });
  if (id !== "reaction-stripes") return values.map(value => value >= 1 - occupancy ? 1 : 0);
  const activeCount = Math.round(occupancy * values.length);
  const ranked = values.map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value || a.index - b.index);
  const cells = Array<number>(values.length).fill(0);
  for (let i = 0; i < activeCount; i++) cells[ranked[i].index] = 1;
  return cells;
}

export function cellularState(id: CellularStudy, params: Params, seed: number): { cells: number[]; concentration?: number[] } {
  validateSystemsAQuality(id, params);
  const initial = cellularInitialCells(id, params, seed);
  if (id === "reaction-spots" || id === "reaction-stripes") {
    const columns = 24, rows = 24;
    let state = { u: Array(columns * rows).fill(1), v: initial.map(active => active ? .8 : 0) };
    for (let i = 0; i < Number(params.passes); i++)
      state = grayScottStep2D({ state, columns, rows, spacing: [1, 1], diffusionU: .16, diffusionV: .08,
        feed: Number(params.feed), kill: Number(params.kill), dt: 1, boundary: "WRAP", maxWork: 9 * columns * rows });
    return { cells: initial, concentration: state.v };
  }
  const columns = 20, rows = 20, rule = RULES[params.rule as Rule];
  let cells = initial;
  for (let i = 0; i < Number(params.passes); i++)
    cells = lifeLikeStep2D({ cells, columns, rows, birth: rule.birth, survival: rule.survival,
      boundary: params.boundary as "WRAP" | "DEAD", maxWork: 9 * columns * rows }).cells;
  return { cells };
}

function color(p: any, layer: Layer, index: number, alpha: number, kind: "stroke" | "fill"): void {
  const value = layer.palette[((index % layer.palette.length) + layer.palette.length) % layer.palette.length] >>> 0;
  p[kind]((value >>> 16) & 255, (value >>> 8) & 255, value & 255, alpha);
}
export function drawSystemsAQuality(p: any, layer: Layer): void {
  const id = layer.technique as CellularStudy;
  const params = layer.params, result = cellularState(id, params, layer.seed);
  const weight = Number(params.weight);
  if (weight > 0) { color(p, layer, 0, 120, "stroke"); p.strokeWeight(weight); }
  else p.noStroke();
  if (id === "reaction-spots" || id === "reaction-stripes") {
    const scale = Number(params.scale), concentration = result.concentration!;
    for (let i = 0; i < concentration.length; i++) {
      const value = concentration[i];
      if (value <= (id === "reaction-spots" ? .12 : .08)) continue;
      color(p, layer, id === "reaction-spots" ? Math.floor(value * 8) : i % 24 + Math.floor(value * 12),
        id === "reaction-spots" ? 180 : 160, "fill");
      const x = 320 + (i % 24 - (id === "reaction-spots" ? 11.5 : 12)) * scale;
      const y = 320 + (Math.floor(i / 24) - (id === "reaction-spots" ? 11.5 : 12)) * scale;
      if (id === "reaction-spots") p.circle(x, y, scale * Math.min(1, value));
      else p.rect(x, y, scale, scale);
    }
  } else {
    const size = Number(params.cellSize);
    for (let i = 0; i < result.cells.length; i++) if (result.cells[i]) {
      color(p, layer, i, id === "organic-cells" ? 200 : 190, "fill");
      if (id === "organic-cells")
        p.circle(320 + (i % 20 - 9.5) * size, 320 + (Math.floor(i / 20) - 9.5) * size, size * .9);
      else
        p.rect(320 + (i % 20 - 10) * size, 320 + (Math.floor(i / 20) - 10) * size, size - 1, size - 1);
    }
  }
}
