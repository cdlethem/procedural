import { stopRamp } from "../../src/stop-ramp.js";

/**
 * Example composition motivated by the color.stop-ramp reference. These constants
 * (stop positions/colors, grid spacing/dot size, radial normalization) describe this
 * piece, not public defaults or recommended ranges.
 */
export const BASE_POSITIONS = Object.freeze([0.0, 0.25, 0.8, 1.0]);
export const SHIFTED_POSITIONS = Object.freeze([0.0, 0.6, 0.8, 1.0]);
export const BASE_COLORS = Object.freeze([0x173f5f, 0x2a9d8f, 0xe9c46a, 0xe76f51]);
export const ALTERNATE_COLORS = Object.freeze([0x352344, 0xb84a62, 0xf4e8c1, 0x477aab]);
export const BACKGROUND_RGB = 0xf8f5ee;
export const GRID_STEP = 24;
export const GRID_ORIGIN = 12;
export const DOT_DIAMETER = 16;
const CANVAS_SIZE = 640;

/** Retained ramp for style-only recolor/shift edits; the radial toggle draws only. */
export function createRampMarks(shifted = false, alternate = false) {
  const positions = shifted ? SHIFTED_POSITIONS : BASE_POSITIONS;
  const colors = alternate ? ALTERNATE_COLORS : BASE_COLORS;
  const stops = positions.map((position, index) => ({ position, color: colors[index] }));
  return Object.freeze({ shifted, alternate, ramp: stopRamp({ stops }) });
}

/** The exact scalar coordinate sampled at one grid dot, linear or radial. */
export function rampGridValue(x, y, radial) {
  if (radial) return Math.hypot(x - CANVAS_SIZE / 2, y - CANVAS_SIZE / 2) / (CANVAS_SIZE * 0.65);
  return x / (CANVAS_SIZE - 1);
}

/** Yield {x, y, rgb} for every grid dot; positions and dot size stay fixed across edits. */
export function* rampGridDots(model, radial) {
  for (let y = GRID_ORIGIN; y < CANVAS_SIZE; y += GRID_STEP) {
    for (let x = GRID_ORIGIN; x < CANVAS_SIZE; x += GRID_STEP) {
      const value = rampGridValue(x, y, radial);
      yield { x, y, rgb: model.ramp.sample(value) };
    }
  }
}
