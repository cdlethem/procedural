import { cyclicPalette, gradientPath2D, regularGrid } from "../../src/index.js";

export const BASE_PALETTE = Object.freeze([0x31a151, 0xffa71e, 0x05084c, 0xde4638, 0x3dbdb7]);
export const ALTERNATE_PALETTE = Object.freeze([0x2e0551, 0xff00c7, 0x01afc2, 0xfdbe03, 0xf4f9fd]);
const PALETTE_LENGTH = 5;

/**
 * Example composition motivated by ciserp, mantel, natalata, and limo002.
 * These constants describe this piece, not public defaults or recommended ranges.
 */
export function createPathMarks(seed = 42, steps = 2000, distance = 0.4) {
  const starts = regularGrid({ origin: [60, 80], spacing: [104, 160], columns: 6, rows: 4 });
  const paths = new Array(starts.size);
  const start = new Float64Array(2);
  for (let index = 0; index < starts.size; index += 1) {
    starts.pointInto(index, start);
    paths[index] = gradientPath2D({
      field: { seed }, start: [start[0], start[1]], steps, stepDistance: distance,
      fieldScale: 0.002, fieldOffset: [0, 0], angleBase: -20, angleScale: 40,
    });
  }
  return Object.freeze({ seed, steps, distance, paths: Object.freeze(paths) });
}

/** Invent another mark here; the heading is the movement arriving at the endpoint. */
export function pathMark(x, y, heading, length, rgb) {
  const perpendicular = heading + Math.PI / 2;
  const half = length * 0.5;
  const dx = half * Math.cos(perpendicular);
  const dy = half * Math.sin(perpendicular);
  return segment(x - dx, y - dy, x + dx, y + dy, rgb);
}

function segment(fromX, fromY, toX, toY, rgb) {
  return {
    kind: "segment2", from: [fromX, fromY], to: [toX, toY],
    rgb, opacity8: 150, width: 1, cap: "round",
  };
}

/**
 * Lazily produce drawing commands. The frame sink consumes bounded batches, so this
 * generator never retains the composition's full command stream.
 */
export function* pathMarkCommands(movement, trace, markLength, colors) {
  if (!Array.isArray(colors) || colors.length !== PALETTE_LENGTH) {
    throw new TypeError("path-marks uses exactly five palette entries");
  }
  const palette = cyclicPalette({ colors });
  const from = new Float64Array(2);
  const to = new Float64Array(2);
  for (let pathIndex = 0; pathIndex < movement.paths.length; pathIndex += 1) {
    const path = movement.paths[pathIndex];
    // The literal five-entry phase selects an unblended supplied entry for each path.
    const rgb = palette.sample((pathIndex % PALETTE_LENGTH) / PALETTE_LENGTH);
    for (let stepIndex = 0; stepIndex < path.steps; stepIndex += trace ? 1 : 4) {
      path.pointInto(stepIndex + 1, to);
      if (trace) {
        path.pointInto(stepIndex, from);
        yield segment(from[0], from[1], to[0], to[1], rgb);
      } else {
        yield pathMark(to[0], to[1], path.headingAt(stepIndex), markLength, rgb);
      }
    }
  }
}

/**
 * Canvas-specific view of the raw stream. It preserves command values and order,
 * omitting only a segment whose full bounding box misses the 640px canvas padded
 * by one pixel. It is intentionally not clipping and does not alter the retained
 * paths or `pathMarkCommands()`.
 */
export function* visiblePathMarkCommands(movement, trace, markLength, colors) {
  for (const command of pathMarkCommands(movement, trace, markLength, colors)) {
    const [fromX, fromY] = command.from;
    const [toX, toY] = command.to;
    if (Math.max(fromX, toX) < -1 || Math.min(fromX, toX) > 641 ||
        Math.max(fromY, toY) < -1 || Math.min(fromY, toY) > 641) continue;
    yield command;
  }
}

export function commandCount(movement, trace) {
  return movement.paths.reduce((total, path) => total + (trace ? path.steps : Math.ceil(path.steps / 4)), 0);
}
