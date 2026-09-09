import { noiseBandPath2D } from "../../src/noise-band-path.js";

/**
 * Example composition motivated by 2018/Generativos/venas, not source replay. These
 * constants (path grid, seeds, field scale/offset, tolerance, palette) describe this
 * piece, not public defaults or recommended ranges.
 */
export const PATH_COUNT = 64;
export const COLORS = Object.freeze([0x224b63, 0x3a7d7c, 0x6b8e23, 0xc17c3d, 0x8b3d5c, 0x4f5d95]);
export const OTHER_COLORS = Object.freeze([0xe76f51, 0x264653, 0xb84a62, 0x457b9d, 0x8a5a44, 0x606c38]);
export const BACKGROUND_RGB = 0xf5f0e6;
const FIELD_SEED = 0x6a09e667;
const NARROW_TOLERANCE = 0.002;
const WIDE_TOLERANCE = 0.008;

/** Retained paths for style-only recolor/mark edits; T rebuilds with a new tolerance. */
export function createBandMarks(wider = false) {
  const paths = new Array(PATH_COUNT);
  for (let i = 0; i < PATH_COUNT; i += 1) {
    paths[i] = noiseBandPath2D({
      field: { seed: FIELD_SEED },
      start: [40.0 + 80.0 * (i % 8), 40.0 + 80.0 * Math.floor(i / 8)],
      heading: 0.0,
      seed: 1000 + i,
      attempts: 2048,
      stepDistance: 1.0,
      fieldScale: 0.006,
      fieldOffset: [7.3, 11.7],
      tolerance: wider ? WIDE_TOLERANCE : NARROW_TOLERANCE,
      maxVertices: 2049,
    });
  }
  return Object.freeze({ wider, paths: Object.freeze(paths) });
}

function segment(from, to, rgb, opacity8, width) {
  return { kind: "segment2", from, to, rgb, opacity8, width, cap: "round" };
}

/**
 * Yield the "path" view: connected line segments through every retained vertex, or
 * (marks=true) a short perpendicular tick every 8th vertex. Matches the shared
 * drawing.fresh-raster-2d vocabulary exactly (segment2 only; no fill primitive needed).
 */
export function* bandPathCommands(model, alternate, marks) {
  const palette = alternate ? OTHER_COLORS : COLORS;
  const point = [0, 0];
  const next = [0, 0];
  for (let i = 0; i < model.paths.length; i += 1) {
    const path = model.paths[i];
    const rgb = palette[i % palette.length];
    if (marks) {
      for (let j = 1; j < path.size; j += 8) {
        path.pointInto(j, point);
        const heading = path.headingAt(j - 1);
        const dx = -Math.sin(heading) * 2.0, dy = Math.cos(heading) * 2.0;
        const from = [point[0] - dx, point[1] - dy], to = [point[0] + dx, point[1] + dy];
        if (from[0] === to[0] && from[1] === to[1]) continue;
        yield segment(from, to, rgb, 150, 0.8);
      }
    } else {
      path.pointInto(0, point);
      let x = point[0], y = point[1];
      for (let j = 1; j < path.size; j += 1) {
        path.pointInto(j, next);
        if (x !== next[0] || y !== next[1]) yield segment([x, y], [next[0], next[1]], rgb, 150, 0.8);
        x = next[0]; y = next[1];
      }
    }
  }
}
