import { closedSpline2D } from "../../src/closed-spline.js";

/**
 * Example composition motivated by databol and blobs; not source replay. These
 * constants (centers, radii base/spread, subdivisions, tile spacing/size,
 * fan count) describe this piece, not public defaults or recommended ranges.
 */
export const COLORS = Object.freeze([0xde6b48, 0x3b8d91, 0xd3a73b, 0x71619a]);
export const OTHER_COLORS = Object.freeze([0x366a8c, 0xa95478, 0x678c49, 0xc87632]);
export const BACKGROUND_RGB = 0xf5f0e6;
const CURVE_COUNT = 4;
const CONTROL_COUNT = 6;
const RADIUS_BASE = 82;
const RADIUS_SPREAD = 36; // exclusive upper bound for the LCG draw, matching Java's nextInt(36)
const SUBDIVISIONS = 32;
const OUTLINE_SAMPLES = 192;
const TILE_SPACING = 18;
const TILE_WIDTH = 12, TILE_HEIGHT = 22, TIP_WIDTH = 4, TIP_HEIGHT = 10;
const FAN_SAMPLES = 192;

// Example-only java.util.Random(seed) sequence (nextInt included), matching the Java
// LoopMarks composition's control-point radii. This does not expose or alter the
// library's private xoshiro sampling stream.
function javaExampleRandom(seed) {
  const multiplier = 0x5deece66dn, mask = (1n << 48n) - 1n;
  let state = (BigInt(seed) ^ multiplier) & mask;
  function next(bits) {
    state = (state * multiplier + 11n) & mask;
    return Number(state >> BigInt(48 - bits));
  }
  return {
    nextInt(bound) {
      if ((bound & -bound) === bound) return Math.floor((bound * next(31)) / 2147483648);
      let bits, value;
      do {
        bits = next(31);
        value = bits % bound;
      } while (bits - value + (bound - 1) < 0);
      return value;
    },
  };
}

function center(index) {
  return [170 + (index % 2) * 300, 170 + Math.floor(index / 2) * 300];
}

/** Retained curves for style-only recolor/fan-mode edits; T rebuilds geometry. */
export function createLoopMarks(moved = false) {
  const random = javaExampleRandom(42);
  const curves = new Array(CURVE_COUNT);
  for (let i = 0; i < CURVE_COUNT; i += 1) {
    const [cx, cy] = center(i);
    const controls = new Array(CONTROL_COUNT);
    for (let j = 0; j < CONTROL_COUNT; j += 1) {
      const angle = (j * Math.PI) / 3.0;
      const radius = RADIUS_BASE + random.nextInt(RADIUS_SPREAD);
      controls[j] = [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
    }
    if (moved) { controls[1][0] += 42; controls[1][1] -= 32; }
    curves[i] = closedSpline2D({ controls, subdivisions: SUBDIVISIONS });
  }
  return Object.freeze({ moved, curves: Object.freeze(curves) });
}

function rotatedRectVertices(cx, cy, heading, halfWidth, halfHeight) {
  const cos = Math.cos(heading), sin = Math.sin(heading);
  const corners = [[-halfWidth, -halfHeight], [halfWidth, -halfHeight], [halfWidth, halfHeight], [-halfWidth, halfHeight]];
  return corners.map(([lx, ly]) => [cx + lx * cos - ly * sin, cy + lx * sin + ly * cos]);
}

function segment(from, to, rgb, opacity8, width) {
  return { kind: "segment2", from, to, rgb, opacity8, width, cap: "round" };
}
function quad(vertices, rgb, opacity8) {
  return { kind: "quad2", vertices, rgb, opacity8 };
}

/**
 * Yield the "tiles" view: a translucent 192-segment outline stroke, plus rotated
 * two-layer tile glyphs every 18 distance units. Rounded corners (radius 3/1 in
 * the Java source) are drawn as plain rectangles here: the shared fresh-raster-2d
 * command vocabulary is exactly segment2 (capped line) and quad2 (convex fill),
 * with no rounded-rect primitive.
 */
export function* loopTileCommands(model, alternate) {
  const palette = alternate ? OTHER_COLORS : COLORS;
  for (let i = 0; i < model.curves.length; i += 1) {
    const curve = model.curves[i];
    const rgb = palette[i];
    const points = new Array(OUTLINE_SAMPLES);
    for (let j = 0; j < OUTLINE_SAMPLES; j += 1) {
      const { x, y } = curve.sampleParameter((j * curve.controlCount) / OUTLINE_SAMPLES);
      points[j] = [x, y];
    }
    for (let j = 0; j < OUTLINE_SAMPLES; j += 1) {
      const from = points[j], to = points[(j + 1) % OUTLINE_SAMPLES];
      if (from[0] === to[0] && from[1] === to[1]) continue;
      yield segment(from, to, rgb, 95, 0.8);
    }
    for (let distance = 0; distance < curve.length; distance += TILE_SPACING) {
      const { x, y, tangentX, tangentY } = curve.sampleDistance(distance);
      if (tangentX === 0 && tangentY === 0) continue;
      const heading = Math.atan2(tangentY, tangentX);
      yield quad(rotatedRectVertices(x, y, heading, TILE_WIDTH / 2, TILE_HEIGHT / 2), rgb, 255);
      yield quad(rotatedRectVertices(x, y, heading, TIP_WIDTH / 2, TIP_HEIGHT / 2), BACKGROUND_RGB, 255);
    }
  }
}

/**
 * Yield the "fans" view: FAN_SAMPLES colored triangles per curve, fanning from
 * its center to consecutive perimeter samples. Fan drawing is an artistic use of
 * the selected outline, not polygon triangulation, and (like the Java source)
 * is not expressed through the shared quad2 vocabulary, which admits only
 * strictly-convex four-vertex fills, not triangles.
 */
export function* loopFanTriangles(model, alternate) {
  const palette = alternate ? OTHER_COLORS : COLORS;
  for (let i = 0; i < model.curves.length; i += 1) {
    const curve = model.curves[i];
    const [cx, cy] = center(i);
    const rgb = palette[i];
    let next = curve.sampleParameter(0);
    for (let j = 0; j < FAN_SAMPLES; j += 1) {
      const current = next;
      next = curve.sampleParameter(((j + 1) * curve.controlCount) / FAN_SAMPLES);
      yield { cx, cy, x1: current.x, y1: current.y, x2: next.x, y2: next.y, rgb, opacity8: 110 + (j % 16) * 8 };
    }
  }
}
