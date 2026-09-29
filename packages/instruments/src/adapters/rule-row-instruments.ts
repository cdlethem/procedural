import { elementaryCellularRows } from "@procedurals/javascript";
import type { ControlGroup, Layer } from "../types.js";
import { channels, choice, numeric, text, toggle, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
type RowState = { columns: number; rows: number; cells: number[] };
type Ink = {
  push(): void; pop(): void; translate(x: number, y: number): void; rotate(angle: number): void;
  noStroke(): void; fill(red: number, green: number, blue: number, alpha: number): void;
  rect(x: number, y: number, width: number, height: number): void;
  ellipse(x: number, y: number, width: number, height: number): void;
  triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void;
};
const num = (key: string, label: string, description: string, low: number, high: number,
  step: number, hardLow = low, hardHigh = high, integer = false) =>
  numeric(key, label, description, low, high, step, { hardMin: hardLow, hardMax: hardHigh, integer });


const parameters = [num("columns", "Columns", "Number of cells in the initial binary row; columns × rows must not exceed 16384.", 12, 100, 1, 1, 16384, true),
  num("rows", "Rows", "Number of synchronous generations including the initial row; columns × rows must not exceed 16384.", 8, 80, 1, 1, 16384, true),
  num("rule", "Elementary rule", "Eight-bit left/center/right neighborhood lookup, 0–255.", 0, 255, 1, 0, 255, true),
  choice("initialMode", "Initial row", "Single live center, alternating cells, seeded random density, or repeated authored binary word.", ["single", "alternating", "random", "repeated"]),
  text("binaryWord", "Binary word", "For repeated mode: 1–64 digits of 0 and 1. Repeats across the initial row.", 64),
  num("density", "Random live density", "Probability of an initial live cell in random mode only; zero may yield an all-dead field.", 0, 1, .01, 0, 1),
  num("phase", "Initial phase", "Whole-cell shift of the single seed, alternating pattern, authored word or random field; wraps at the row edge.", -20, 20, 1, -16384, 16384, true),
  choice("boundary", "Boundary", "WRAP connects the ends; ZERO treats neighbors outside the row as dead.", ["ZERO", "WRAP"]),
  num("pitchX", "Column pitch", "Horizontal cell-center separation in canvas pixels; independent of glyph size.", 4, 24, .25, .1, 1000),
  num("pitchY", "Row pitch", "Vertical cell-center separation in canvas pixels; independent of glyph size.", 4, 24, .25, .1, 1000),
  num("centerX", "Center X", "Local grid center in canvas pixels; can be off-canvas.", 0, 640, 1, -10000, 10000),
  num("centerY", "Center Y", "Local grid center in canvas pixels; can be off-canvas.", 0, 640, 1, -10000, 10000),
  num("angle", "Orientation", "Rotate the whole local grid about its center in degrees.", -90, 90, 1, -360000, 360000),
  choice("mark", "Active mark", "Bar, disc or triangle glyph, independent of the elementary rule.", ["bar", "disc", "triangle"]),
  num("markScale", "Mark scale", "Glyph size as a fraction of each cell's pitch; zero removes all glyph ink.", .2, 1.2, .025, 0, 2),
  num("activeColor", "Live palette slot", "Zero-based palette index for live cells.", 0, 4, 1, 0, 15, true),
  num("activeAlpha", "Live opacity", "Per-glyph alpha, 0–255; zero removes live ink.", 80, 255, 1, 0, 255),
  toggle("showInactive", "Ink dead cells", "Optionally render dead cells as faint glyphs instead of leaving them blank."),
  num("inactiveColor", "Dead palette slot", "Zero-based palette index for dead cells.", 0, 4, 1, 0, 15, true),
  num("inactiveAlpha", "Dead opacity", "Alpha for optional dead glyphs, 0–255.", 0, 120, 1, 0, 255)];
const controlGroups: ControlGroup[] = [
  { label: "Grid", controls: ["columns", "rows"], proportional: true },
  { label: "Rule", controls: ["rule", "boundary"] },
  { label: "Initial row", controls: ["initialMode", "binaryWord", "density", "phase"] },
  { label: "Placement", controls: ["centerX", "centerY", { label: "Spacing", controls: ["pitchX", "pitchY"], proportional: true }, "angle"] },
  { label: "Ink", controls: ["mark", "markScale",
    { label: "Live cells", controls: ["activeColor", "activeAlpha"] },
    { label: "Dead cells", controls: ["showInactive", "inactiveColor", "inactiveAlpha"] }] },
];
const shared = {columns: 56,
  rows: 28,
  rule: 90,
  initialMode: "repeated",
  binaryWord: "1001000",
  density: .5,
  phase: 0,
  boundary: "ZERO",
  pitchX: 10,
  pitchY: 12,
  centerX: 320,
  centerY: 320,
  angle: 0,
  mark: "bar",
  markScale: .88,
  activeColor: 0,
  activeAlpha: 215,
  showInactive: false,
  inactiveColor: 1,
  inactiveAlpha: 35};
export const ruleRowDefinitions: StudioDefinition[] = [
  { id: "woven-rows", title: "Woven Rows", description: "Editable elementary automaton generations as separated woven bars.",
    parameters, controlGroups, defaults: {...shared}, validate: validateRuleRows },
  { id: "triangle-glyphs", title: "Triangle Glyphs", description: "The same true automaton source drawn with triangular ink.",
    parameters, controlGroups, defaults: {...shared,
      columns: 49,
      rows: 25,
      rule: 110,
      initialMode: "single",
      binaryWord: "1",
      pitchX: 11,
      pitchY: 12,
      mark: "triangle",
      markScale: .91,
      activeAlpha: 220},
    validate: validateRuleRows },
];
function range(q: Params, key: string, min: number, max: number, integer = false): number {
  const value = q[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    throw Error(`${key} must be ${integer ? "an integer" : "a finite number"} between ${min} and ${max}`);
  return value;
}
export function validateRuleRows(q: Params): void {
  
  const columns = range(q, "columns", 1, 16384, true), rows = range(q, "rows", 1, 16384, true);
  if (columns * rows > 16384) throw Error("Rule rows exceed the 16384-cell work and output budget");
  range(q, "rule", 0, 255, true);
  if (!["single", "alternating", "random", "repeated"].includes(String(q.initialMode))) throw Error("Unknown initial row mode");
  if (q.initialMode === "repeated" && (typeof q.binaryWord !== "string" || !/^[01]{1,64}$/.test(q.binaryWord)))
    throw Error("Binary word must contain 1–64 digits, only 0 and 1");
  range(q, "density", 0, 1); range(q, "phase", -16384, 16384, true);
  if (q.boundary !== "WRAP" && q.boundary !== "ZERO") throw Error("Boundary must be WRAP or ZERO (dead)");
  range(q, "pitchX", .1, 1000); range(q, "pitchY", .1, 1000);
  range(q, "centerX", -10000, 10000); range(q, "centerY", -10000, 10000);
  range(q, "angle", -360000, 360000);
  if (!["bar", "disc", "triangle"].includes(String(q.mark))) throw Error("Unknown active mark");
  range(q, "markScale", 0, 2);
  range(q, "activeColor", 0, 15, true); range(q, "inactiveColor", 0, 15, true);
  range(q, "activeAlpha", 0, 255); range(q, "inactiveAlpha", 0, 255);
  if (typeof q.showInactive !== "boolean") throw Error("showInactive must be boolean");
}
const mod = (value: number, width: number): number => ((value % width) + width) % width;
function randomCell(seed: number, index: number): number {
  let h = Math.imul(index ^ (seed >>> 0), 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 0x100000000;
}
let cachedKey = "";
let cachedState: RowState | undefined;
/** Source cache keys omit pitch, placement, palette and ink; nonrandom modes ignore seed. */
export function ruleRowState(q: Params, seed: number): RowState {
  validateRuleRows(q);
  const columns = Number(q.columns), rows = Number(q.rows), phase = Number(q.phase), word = String(q.binaryWord);
  const density = Number(q.density), random = q.initialMode === "random";
  const key = JSON.stringify([columns, rows, q.rule, q.initialMode,
    q.initialMode === "repeated" ? q.binaryWord : null,
    random ? density : null, phase, q.boundary,
    random && density > 0 && density < 1 ? seed : null]);
  if (key === cachedKey && cachedState) return cachedState;
  const initial = Array<number>(columns);
  for (let x = 0; x < columns; x++) {
    const offset = mod(x - phase, columns);
    initial[x] = q.initialMode === "single" ? Number(offset === Math.floor(columns / 2))
      : q.initialMode === "alternating" ? Number(offset % 2 === 0)
      : q.initialMode === "repeated" ? Number(word[offset % word.length])
      : density === 0 ? 0 : density === 1 ? 1 : Number(randomCell(seed, offset) < density);
  }
  // The released operation charges columns + 4 * columns * (rows - 1).
  const state = elementaryCellularRows({ initial, rule: q.rule, rows,
    boundary: q.boundary, maxWork: columns + 4 * columns * (rows - 1) });
  cachedKey = key; cachedState = state;
  return state;
}
function mark(p: Ink, kind: Params["mark"], x: number, y: number, width: number, height: number): void {
  if (kind === "bar") p.rect(x - width / 2, y - height * .32, width, height * .64);
  else if (kind === "disc") p.ellipse(x, y, width, height);
  else p.triangle(x, y - height / 2, x - width / 2, y + height / 2, x + width / 2, y + height / 2);
}
export function drawRuleRows(p: Ink, layer: Layer): void {
  const q = layer.params;
  const state = ruleRowState(q, layer.seed);
  const scale = Number(q.markScale), activeAlpha = Number(q.activeAlpha);
  const inactiveAlpha = q.showInactive ? Number(q.inactiveAlpha) : 0;
  if (scale === 0 || (activeAlpha === 0 && inactiveAlpha === 0)) return;
  const active = channels(layer.palette[Number(q.activeColor) % layer.palette.length] ?? 0);
  const inactive = channels(layer.palette[Number(q.inactiveColor) % layer.palette.length] ?? 0);
  const pitchX = Number(q.pitchX), pitchY = Number(q.pitchY);
  p.push();
  try {
    p.translate(Number(q.centerX), Number(q.centerY));
    p.rotate(Number(q.angle) * Math.PI / 180);
    p.noStroke();
    let last = -1;
    for (let i = 0; i < state.cells.length; i++) {
      const live = state.cells[i] === 1;
      if (live ? activeAlpha === 0 : inactiveAlpha === 0) continue;
      const group = live ? 1 : 0;
      if (group !== last) {
        const color = live ? active : inactive;
        p.fill(color[0], color[1], color[2], live ? activeAlpha : inactiveAlpha);
        last = group;
      }
      const x = (i % state.columns - (state.columns - 1) / 2) * pitchX;
      const y = (Math.floor(i / state.columns) - (state.rows - 1) / 2) * pitchY;
      mark(p, q.mark, x, y, pitchX * scale, pitchY * scale);
    }
  } finally { p.pop(); }
}
