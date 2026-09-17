import { seededCirclePlacement2D } from "../../src/circle-placements.js";
import { regularGrid } from "../../src/regular-grid.js";

/** App/example composition records. These are not part of the portable core API. */
function hashUnit(index, salt) {
  let value = Math.imul(index ^ salt, 0x9e3779b1);
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return ((value ^ (value >>> 16)) >>> 0) / 0x100000000;
}

function weightedKind(index, entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) throw new Error("At least one mark family needs a positive weight");
  let ticket = hashUnit(index, 0x7a62d42f) * total;
  for (const [kind, weight] of entries) {
    ticket -= weight;
    if (ticket < 0) return kind;
  }
  return entries[entries.length - 1][0];
}

/** Identical retained mark computation to the modern Ornament Field web study. */
export function ornamentFieldRecords({ seed, params: q }) {
  const marks = [];
  const point = new Float64Array(2);
  const packed = q.layout === "packed";
  const packedPlacement = packed ? seededCirclePlacement2D({
    seed,
    attempts: 1800,
    origin: [88, 108],
    extent: [544, 510],
    radiusRange: [10, 38],
    separationScale: 1.18,
  }) : null;
  const gridPlacement = packed ? null : regularGrid({ origin: [72, 72], spacing: [576 / 11, 576 / 11], columns: 12, rows: 12 });
  const weights = [
    ["petals", Number(q.petalWeight)], ["leaves", Number(q.leafWeight)], ["emblems", Number(q.emblemWeight)],
  ];
  const size = packedPlacement?.size ?? gridPlacement?.size ?? 0;
  for (let ordinal = 0; ordinal < size; ordinal += 1) {
    const sourceIndex = packedPlacement ? packedPlacement.sourceIndexAt(ordinal) : ordinal;
    if (hashUnit(ordinal, 0x454f742d) * 100 >= Number(q.density)) continue;
    if (packedPlacement) packedPlacement.pointInto(ordinal, point);
    else gridPlacement.pointInto(ordinal, point);
    const radius = packedPlacement ? packedPlacement.radiusAt(ordinal) : 24;
    marks.push({
      sourceIndex,
      x: point[0] + Number(q.offsetX),
      y: point[1] + Number(q.offsetY),
      radius: radius * Number(q.scale),
      kind: weightedKind(ordinal, weights),
      angle: (Number(q.angle) + sourceIndex * Number(q.angleStride)) * Math.PI / 180,
    });
  }
  return marks;
}

/** Identical retained mark computation to the modern Shape Matrix web study. */
export function shapeMatrixRecords({ params: q }) {
  const columns = Number(q.columns), rows = Number(q.rows);
  if (!Number.isSafeInteger(columns) || !Number.isSafeInteger(rows) || columns < 1 || rows < 1 || columns * rows > 2048)
    throw new Error("Shape matrix has a 2048-cell drawing budget");
  const spacingX = columns === 1 ? 576 : 576 / (columns - 1);
  const spacingY = rows === 1 ? 576 : 576 / (rows - 1);
  const grid = regularGrid({
    origin: [columns === 1 ? 360 : 72, rows === 1 ? 360 : 72],
    spacing: [spacingX, spacingY], columns, rows,
  });
  const weights = [
    ["wedges", Number(q.wedgeWeight)], ["bars", Number(q.barWeight)],
    ["discs", Number(q.discWeight)], ["arcs", Number(q.arcWeight)],
  ];
  const cellX = columns === 1 ? 576 : spacingX;
  const cellY = rows === 1 ? 576 : spacingY;
  const base = Math.min(576 / columns, 576 / rows);
  const point = new Float64Array(2);
  const marks = [];
  for (let index = 0; index < grid.size; index += 1) {
    if (hashUnit(index, 0x454f742d) * 100 >= Number(q.density)) continue;
    grid.pointInto(index, point);
    const column = index % columns, row = Math.floor(index / columns);
    marks.push({
      sourceIndex: index, row, column,
      x: point[0] + (row % 2) * Number(q.rowShift) * cellX + Number(q.offsetX),
      y: point[1] + (column % 2) * Number(q.columnShift) * cellY + Number(q.offsetY),
      scale: base / 100 * Number(q.scale),
      kind: weightedKind(index, weights),
      angle: (Number(q.angle) + index * Number(q.angleStep)) * Math.PI / 180,
    });
  }
  return marks;
}
