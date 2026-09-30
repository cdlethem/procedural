import { adjacencyTileCollapse2D } from "@procedurals/javascript";

import type { ControlGroup, Layer } from "../types.js";
import { channels, choice, numeric, text, toggle, type StudioDefinition } from "./types.js";

// N=1, E=2, S=4, W=8. The tile ID itself is its connector mask.
const WEIGHTS = ["blankWeight", "endWeight", "straightWeight", "turnWeight", "teeWeight", "crossWeight"] as const;
const category = (mask: number): number => {
  const degree = (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1) + ((mask >> 3) & 1);
  return degree === 2 ? (mask === 5 || mask === 10 ? 2 : 3) : degree === 0 ? 0 : degree === 1 ? 1 : degree === 3 ? 4 : 5;
};
const n = (q: Layer["params"], key: string): number => Number(q[key]);
const num = (key: string, label: string, description: string, min: number, max: number,
  step: number, hardMin: number, hardMax: number, integer = false) =>
  numeric(key, label, description, min, max, step, { hardMin, hardMax, integer });
const parameters = [
  num("columns", "Columns", "Number of horizontal cells (at most 400 cells total).", 3, 20, 1, 1, 32, true),
  num("rows", "Rows", "Number of vertical cells (at most 400 cells total).", 3, 20, 1, 1, 32, true),
  num("size", "Horizontal pitch", "Distance between cell centers in canvas pixels; not fitted to the canvas.", 16, 48, 1, 2, 160),
  num("pitchY", "Vertical pitch", "Distance between cell centers in canvas pixels, independently of horizontal pitch.", 16, 48, 1, 2, 160),
  num("centerX", "Center X", "Center of the tile field in canvas pixels; off-canvas patches remain possible.", 80, 560, 1, -1000, 1600),
  num("centerY", "Center Y", "Center of the tile field in canvas pixels.", 80, 560, 1, -1000, 1600),
  num("angle", "Grid angle", "Rotate the entire field about its center in degrees.", -90, 90, 1, -360, 360),
  choice("boundary", "Boundary connectors", "Closed forbids outward-facing connectors at the field perimeter; open leaves them possible.", ["open", "closed"]),
  text("pins", "Pinned cells", "Optional col,row,mask on each line, zero-based coordinates, mask integer 0–15 (N=1 E=2 S=4 W=8).", 4096, true),
  ...WEIGHTS.map((key, index) => num(key, ["Blank", "End", "Straight", "Turn", "Tee", "Cross"][index] + " weight",
    "Relative tile weight within the enabled connector category; zero removes this category from all domains.", 0, 8, .25, 0, 100)),
  toggle("showBody", "Tile body", "Draw a small mark at each nonblank tile; never paint a solid tile board."),
  num("bodySize", "Body size", "Diameter of the optional nonblank body mark as a fraction of the smaller pitch.", .1, .6, .02, 0, 1),
  toggle("showConnectors", "Connectors", "Ink every actual connector from junction to its corresponding cell edge."),
  num("lineWeight", "Connector weight", "Stroke width of connector arms; zero hides them.", .5, 5, .1, 0, 20),
  toggle("showJunctions", "Junctions", "Ink centers of nonblank tiles separately from connector arms."),
  num("junctionSize", "Junction size", "Diameter of nonblank junction marks; zero hides them.", 1, 7, .25, 0, 24),
];
const controlGroups: ControlGroup[] = [
  { label: "Lattice", stage: "form", controls: ["columns", "rows"], proportional: true },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Spacing", controls: ["size", "pitchY"], proportional: true }, "angle"] },
  { label: "Tiles", stage: "material", controls: ["boundary", "pins", { label: "Weights", controls: [...WEIGHTS] }] },
  { label: "Drawing", stage: "material", controls: [
    { label: "Body", controls: ["showBody", "bodySize"] },
    { label: "Connectors", controls: ["showConnectors", "lineWeight"] },
    { label: "Junctions", controls: ["showJunctions", "junctionSize"] }] },
];
const common = {pitchY: 36,
  centerX: 320,
  centerY: 320,
  angle: 0,
  boundary: "open",
  pins: "",
  blankWeight: 1,
  endWeight: 2,
  straightWeight: 3,
  turnWeight: 4,
  teeWeight: 1,
  crossWeight: .4,
  showBody: false,
  bodySize: .3,
  showConnectors: true,
  lineWeight: 2.4,
  showJunctions: true,
  junctionSize: 3};
export const edgeTileDefinitions: StudioDefinition[] = [
  { id: "compatible-mosaics", title: "Compatible Mosaics",
    description: "Arrange weighted edge-matched masks as sparse mosaics with editable perimeter and pins.",
    parameters, controlGroups, defaults: { ...common, columns: 12, rows: 12, size: 42,
      pitchY: 42, blankWeight: 7, endWeight: 4, straightWeight: 1, turnWeight: 2,
      teeWeight: .2, crossWeight: 0, showBody: true, bodySize: .24, lineWeight: 2 }, validate: validateEdgeTiles },
  { id: "tiled-circuits", title: "Tiled Circuits",
    description: "Collapse equal-facing connector bits into circuit paths with category weights and pins.",
    parameters, controlGroups, defaults: { ...common, columns: 13, rows: 13, size: 38, pitchY: 38,
      blankWeight: .4, endWeight: 1, straightWeight: 5, turnWeight: 6,
      teeWeight: 1, crossWeight: .3, lineWeight: 3, junctionSize: 4 }, validate: validateEdgeTiles },
];

function requireNumber(q: Layer["params"], key: string, low: number, high: number, integer = false): void {
  const value = q[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high || (integer && !Number.isInteger(value)))
    throw Error(`${key} must be ${integer ? "an integer" : "a finite number"} between ${low} and ${high}`);
}
function parsePins(q: Layer["params"]): Map<number, number> {
  if (typeof q.pins !== "string" || q.pins.length > 4096) throw Error("pins must be text of at most 4096 characters");
  const pins = new Map<number, number>(), columns = n(q, "columns"), rows = n(q, "rows");
  for (const [lineNumber, line] of q.pins.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const match = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/.exec(line);
    if (!match) throw Error(`Pin line ${lineNumber + 1}: expected col,row,mask (decimal integers)`);
    const col = Number(match[1]), row = Number(match[2]), mask = Number(match[3]);
    if (!Number.isSafeInteger(col) || !Number.isSafeInteger(row) || !Number.isSafeInteger(mask) || col >= columns || row >= rows || mask > 15)
      throw Error(`Pin line ${lineNumber + 1}: cell or mask outside grid and 0–15 alphabet`);
    const index = row * columns + col;
    if (pins.has(index)) throw Error(`Pin line ${lineNumber + 1}: duplicate cell ${col},${row}`);
    pins.set(index, mask);
  }
  return pins;
}
function checked(q: Layer["params"]): Map<number, number> {
  requireNumber(q, "columns", 1, 32, true); requireNumber(q, "rows", 1, 32, true);
  if (n(q, "columns") * n(q, "rows") > 400) throw Error("Tile field exceeds 400 cells");
  requireNumber(q, "size", 2, 160); requireNumber(q, "pitchY", 2, 160);
  requireNumber(q, "centerX", -1000, 1600); requireNumber(q, "centerY", -1000, 1600);
  requireNumber(q, "angle", -360, 360);
  requireNumber(q, "bodySize", 0, 1); requireNumber(q, "lineWeight", 0, 20); requireNumber(q, "junctionSize", 0, 24);
  for (const key of WEIGHTS) requireNumber(q, key, 0, 100);
  for (const key of ["showBody", "showConnectors", "showJunctions"])
    if (typeof q[key] !== "boolean") throw Error(`${key} must be a boolean`);
  if (q.boundary !== "open" && q.boundary !== "closed") throw Error("boundary must be open or closed");
  if (WEIGHTS.every(key => n(q, key) === 0)) throw Error("At least one tile category must have positive weight");
  const pins = parsePins(q);
  for (const [index, mask] of pins) {
    if (n(q, WEIGHTS[category(mask)]) === 0) throw Error(`Pinned mask ${mask} belongs to a disabled category`);
    const col = index % n(q, "columns"), row = Math.floor(index / n(q, "columns"));
    if (q.boundary === "closed" && ((col === 0 && (mask & 8)) || (col === n(q, "columns") - 1 && (mask & 2)) ||
      (row === 0 && (mask & 1)) || (row === n(q, "rows") - 1 && (mask & 4))))
      throw Error(`Pinned mask ${mask} points outside closed boundary at ${col},${row}`);
  }
  return pins;
}
export function validateEdgeTiles(q: Layer["params"]): void {
  
  checked(q);
}

// One successful structural source, independent of placement and ink controls.
let latestSource: { key: string; tiles: readonly number[] } | undefined;

export function edgeTileMasks(q: Layer["params"], seed: number): readonly number[] {
  const pins = checked(q), columns = n(q, "columns"), rows = n(q, "rows");
  if (!Number.isSafeInteger(seed)) throw Error("Tile seed must be a safe integer");
  const key = JSON.stringify([columns, rows, q.boundary, WEIGHTS.map(weight => q[weight]),
    [...pins].sort((a, b) => a[0] - b[0]), seed >>> 0]);
  if (latestSource?.key === key) return latestSource.tiles;
  const masks: number[] = [], weights: number[] = [];
  for (let mask = 0; mask < 16; mask++) {
    const weight = n(q, WEIGHTS[category(mask)]);
    if (weight > 0) { masks.push(mask); weights.push(weight); }
  }
  const right = masks.map(a => masks.flatMap((b, i) => Boolean(a & 2) === Boolean(b & 8) ? [i] : []));
  const down = masks.map(a => masks.flatMap((b, i) => Boolean(a & 4) === Boolean(b & 1) ? [i] : []));
  const domains: number[][] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const index = row * columns + col, pinned = pins.get(index);
    const domain: number[] = [];
    for (let tile = 0; tile < masks.length; tile++) {
      const mask = masks[tile];
      if (pinned !== undefined && mask !== pinned) continue;
      if (q.boundary === "closed" && ((col === 0 && (mask & 8)) || (col === columns - 1 && (mask & 2)) ||
        (row === 0 && (mask & 1)) || (row === rows - 1 && (mask & 4)))) continue;
      domain.push(tile);
    }
    if (!domain.length) throw Error(`No enabled masks for cell ${col},${row} under the boundary restrictions`);
    domains.push(domain);
  }
  // The released core has no backtracking. Propagate and report its CONTRADICTION as-is;
  // changing the seed is an explicit user action, never an automatic retry.
  const result = adjacencyTileCollapse2D({ columns, rows, right, down, weights, domains,
    rngState: seed >>> 0, maxWork: 3_000_000 });
  const tiles: number[] = result.tiles.map((tile: number) => masks[tile]);
  latestSource = { key, tiles };
  return tiles;
}

type TileInk = {
  noStroke(): void; noFill(): void; fill(r: number, g: number, b: number): void;
  stroke(r: number, g: number, b: number): void; strokeWeight(weight: number): void;
  circle(x: number, y: number, diameter: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
};
export function drawEdgeTiles(p: TileInk, layer: Layer): void {
  
  if (layer.technique !== "compatible-mosaics" && layer.technique !== "tiled-circuits") throw Error("Unknown edge tile technique");
  const q = layer.params, colors = layer.palette;
  if (!colors.length) throw Error("Edge tiles require at least one palette color");
  const tiles = edgeTileMasks(q, layer.seed);
  const ink = (slot: number, fill: boolean) => {
    const [r, g, b] = channels(colors[slot % colors.length]);
    if (fill) p.fill(r, g, b); else p.stroke(r, g, b);
  };
  const columns = n(q, "columns"), rows = n(q, "rows"), pitchX = n(q, "size"), pitchY = n(q, "pitchY");
  const theta = n(q, "angle") * Math.PI / 180, cos = Math.cos(theta), sin = Math.sin(theta);
  const x0 = (columns - 1) / 2, y0 = (rows - 1) / 2;
  const centerX = n(q, "centerX"), centerY = n(q, "centerY");
  const point = (x: number, y: number): [number, number] => [centerX + x * cos - y * sin,
    centerY + x * sin + y * cos];
  for (let index = 0; index < tiles.length; index++) {
    const mask = tiles[index];
    if (mask === 0) continue;
    const x = ((index % columns) - x0) * pitchX, y = (Math.floor(index / columns) - y0) * pitchY;
    const [cx, cy] = point(x, y);
    if (q.showBody && n(q, "bodySize") > 0) {
      ink(1, true); p.noStroke(); p.circle(cx, cy, Math.min(pitchX, pitchY) * n(q, "bodySize"));
    }
    if (q.showConnectors && n(q, "lineWeight") > 0) {
      p.noFill(); ink(0, false); p.strokeWeight(n(q, "lineWeight"));
      if (mask & 1) p.line(cx, cy, ...point(x, y - pitchY / 2));
      if (mask & 2) p.line(cx, cy, ...point(x + pitchX / 2, y));
      if (mask & 4) p.line(cx, cy, ...point(x, y + pitchY / 2));
      if (mask & 8) p.line(cx, cy, ...point(x - pitchX / 2, y));
    }
    if (q.showJunctions && n(q, "junctionSize") > 0) {
      ink(2, true); p.noStroke(); p.circle(cx, cy, n(q, "junctionSize"));
    }
  }
}
