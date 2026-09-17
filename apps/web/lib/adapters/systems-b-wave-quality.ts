import { dampedWaveStep2D } from "../../../../packages/javascript/src/damped-wave-step-2d.js";
import type { Layer } from "../studio-types";

const GRID = 26;
const CELLS = GRID * GRID;
const MAX_UPDATES = CELLS * 80;
type PinMode = "none" | "perimeter" | "vertical" | "horizontal" | "disc";
type Query = Record<string, number | string | boolean>;

const value = (query: Query, key: string) => query[key] as number;
const finiteRange = (number: number, min: number, max: number) =>
  Number.isFinite(number) && number >= min && number <= max;

export function validateWaveQuality(query: Query): void {
  if (!Number.isInteger(value(query, "impulseCount")) || !finiteRange(value(query, "impulseCount"), 1, 3) ||
      !Number.isInteger(value(query, "passes")) || !finiteRange(value(query, "passes"), 0, 80) ||
      CELLS * value(query, "passes") > MAX_UPDATES ||
      !finiteRange(value(query, "scale"), .1, 100) || !finiteRange(value(query, "weight"), .1, 12) ||
      !["none", "perimeter", "vertical", "horizontal", "disc"].includes(String(query.pinMode)) ||
      typeof query.showPins !== "boolean" ||
      !finiteRange(value(query, "pinX"), -1, 2) || !finiteRange(value(query, "pinY"), -1, 2) ||
      !finiteRange(value(query, "pinRadius"), .2, 12))
    throw Error("Invalid wave construction or work settings");
  for (let site = 1; site <= 3; site += 1) {
    if (!finiteRange(value(query, `impulseX${site}`), -1, 2) ||
        !finiteRange(value(query, `impulseY${site}`), -1, 2) ||
        !finiteRange(value(query, `impulseSpread${site}`), .2, 12) ||
        !finiteRange(value(query, `impulseAmplitude${site}`), -3, 3))
      throw Error(`Invalid wave impulse ${site}`);
  }
}

/** Caller-owned initial field and pins; geometry is sampled at grid cell centers. */
export function waveInitialState(query: Query): { displacement: number[]; pins: number[] } {
  validateWaveQuality(query);
  const displacement = new Array<number>(CELLS), pins = new Array<number>(CELLS);
  const pinMode = query.pinMode as PinMode;
  const px = value(query, "pinX") * (GRID - 1), py = value(query, "pinY") * (GRID - 1);
  const pinColumn = Math.round(px), pinRow = Math.round(py), pinRadius = value(query, "pinRadius");
  for (let y = 0; y < GRID; y += 1) for (let x = 0; x < GRID; x += 1) {
    const index = y * GRID + x;
    const pinned = pinMode === "perimeter" ? x === 0 || y === 0 || x === GRID - 1 || y === GRID - 1
      : pinMode === "vertical" ? x === pinColumn
      : pinMode === "horizontal" ? y === pinRow
      : pinMode === "disc" ? Math.hypot(x - px, y - py) <= pinRadius
      : false;
    pins[index] = pinned ? 1 : 0;
    let height = 0;
    for (let site = 1; site <= value(query, "impulseCount"); site += 1) {
      const amplitude = value(query, `impulseAmplitude${site}`);
      if (amplitude === 0) continue;
      const dx = x - value(query, `impulseX${site}`) * (GRID - 1);
      const dy = y - value(query, `impulseY${site}`) * (GRID - 1);
      const spread = value(query, `impulseSpread${site}`);
      height += amplitude * Math.exp(-(dx * dx + dy * dy) / (2 * spread * spread));
    }
    displacement[index] = pinned ? 0 : height;
  }
  return { displacement, pins };
}

export function waveQualityState(query: Query): { displacement: number[]; velocity: number[]; pins: number[] } {
  const { displacement, pins } = waveInitialState(query);
  let state = { displacement, velocity: Array<number>(CELLS).fill(0) };
  for (let step = 0; step < value(query, "passes"); step += 1) {
    state = dampedWaveStep2D({ state, columns: GRID, rows: GRID, spacing: [1, 1],
      speed: .34, damping: .055, dt: 1, pinned: pins, boundary: "CLAMP", maxWork: 7 * CELLS });
  }
  return { ...state, pins };
}

export function drawWaveQuality(p: any, layer: Layer): void {
  const query = layer.params as Query;
  const state = waveQualityState(query), cell = value(query, "scale");
  const colors = layer.palette;
  const channels = (index: number): [number, number, number] => {
    const color = colors[index % colors.length] >>> 0;
    return [(color >>> 16) & 255, (color >>> 8) & 255, color & 255];
  };
  p.noFill();
  p.strokeWeight(value(query, "weight"));
  for (let y = 1; y < GRID - 1; y += 1) {
    p.stroke(...channels(y), 190);
    p.beginShape();
    for (let x = 1; x < GRID - 1; x += 1) {
      const index = y * GRID + x;
      p.vertex(320 + (x - GRID / 2) * cell,
        320 + (y - GRID / 2) * cell + state.displacement[index] * cell * 3);
    }
    p.endShape();
  }
  if (query.showPins) {
    p.noStroke();
    for (let index = 0; index < CELLS; index += 1) if (state.pins[index]) {
      p.fill(...channels(index), 150);
      p.circle(320 + (index % GRID - GRID / 2) * cell,
        320 + (Math.floor(index / GRID) - GRID / 2) * cell, 4);
    }
  }
}
