import { seededCirclePlacement2D } from "../../src/circle-placements.js";
import { regularGrid } from "../../src/regular-grid.js";
import { resamplePolyline2D } from "../../src/resample-polyline-2d.js";
import { defaultPalettes } from "../../src/default-palettes.js";

export const CANVAS = 720;

/** Copy a shipped palette so a study can safely edit its local colors. */
export function palette(id) {
  const chosen = defaultPalettes.find((item) => item.id === id);
  if (!chosen) throw new Error(`Missing shipped palette: ${id}`);
  return chosen.colors.map((hex) => Number.parseInt(hex.slice(1), 16));
}

export function rgb(value) {
  return [(value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}

/** Retained packing positions for an original botanical ornament composition. */
export function botanicalLayout(dense = false) {
  const placements = seededCirclePlacement2D({
    seed: 811,
    attempts: dense ? 1800 : 1000,
    origin: [88, 108],
    extent: [544, 510],
    radiusRange: dense ? [10, 38] : [15, 52],
    separationScale: 1.18,
  });
  const point = new Float64Array(2);
  const rows = [];

  for (let i = 0; i < placements.size; i += 1) {
    placements.pointInto(i, point);
    rows.push(Object.freeze([
      point[0], point[1], placements.radiusAt(i), placements.sourceIndexAt(i),
    ]));
  }
  return Object.freeze({ kind: "botanical", dense, rows: Object.freeze(rows) });
}

/** A regular-grid record leaves the asymmetric panel's local marks replaceable. */
export function panelLayout(tight = false) {
  const columns = tight ? 8 : 6;
  const rowsCount = tight ? 10 : 8;
  const grid = regularGrid({
    origin: [98, 95],
    spacing: [524 / (columns - 1), 510 / (rowsCount - 1)],
    columns,
    rows: rowsCount,
  });
  const point = new Float64Array(2);
  const rows = [];

  for (let i = 0; i < grid.size; i += 1) {
    grid.pointInto(i, point);
    const column = i % columns;
    const row = Math.floor(i / columns);
    rows.push(Object.freeze([
      point[0],
      point[1],
      0.55 + ((column * 5 + row * 3) % 5) * 0.115,
      (column + 2 * row) % 4,
    ]));
  }
  return Object.freeze({
    kind: "panel", tight, columns, rowsCount, rows: Object.freeze(rows),
  });
}

function orbitPoints(cx, cy, rx, ry, tilt, count) {
  return Array.from({ length: count }, (_, index) => {
    const angle = index * Math.PI * 2 / count;
    const x = Math.cos(angle) * rx;
    const y = Math.sin(angle) * ry;
    return [
      cx + x * Math.cos(tilt) - y * Math.sin(tilt),
      cy + x * Math.sin(tilt) + y * Math.cos(tilt),
    ];
  });
}

/** Resampled, retained orbital paths for brush substitutions. */
export function orbitalLayout(more = false) {
  const centres = [[304, 340], [422, 286], [387, 448]];
  const paths = [];
  const orbitCount = more ? 15 : 10;

  for (let index = 0; index < orbitCount; index += 1) {
    const [cx, cy] = centres[index % centres.length];
    const raw = orbitPoints(
      cx, cy, 85 + (index % 5) * 45, 46 + (index % 4) * 29,
      -0.75 + index * 0.31, 64,
    );
    const sampled = resamplePolyline2D({
      points: raw,
      closed: true,
      count: more ? 126 : 96,
      maxWork: 400,
    });
    const points = Object.freeze(sampled.points.map((point) => Object.freeze(point.slice())));
    paths.push(Object.freeze({ points, colorIndex: index, width: 1 + (index % 3) * 0.75 }));
  }
  return Object.freeze({ kind: "orbital", more, paths: Object.freeze(paths) });
}
