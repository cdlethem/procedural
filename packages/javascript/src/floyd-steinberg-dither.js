import { passiveRecord, passiveArray, valueAt, number, positiveDimension, workLimit, checkedProduct, checkedWork } from "./internal/raster-study-utils.js";
const KEYS = ["values", "columns", "rows", "threshold", "maxWork"];
export class FloydSteinbergDitherError extends Error { constructor(code) { super(code); this.name = "FloydSteinbergDitherError"; this.code = code; } }
const fail = (code) => { throw new FloydSteinbergDitherError(code); };
export function floydSteinbergDither(input) {
  const E = FloydSteinbergDitherError; passiveRecord(input, KEYS, E);
  const columns = positiveDimension(valueAt(input, "columns", E), E), rows = positiveDimension(valueAt(input, "rows", E), E), threshold = number(valueAt(input, "threshold", E), E), maxWork = workLimit(valueAt(input, "maxWork", E), E);
  if (threshold < 0 || threshold > 1) fail("INVALID_INPUT");
  const raw = passiveArray(valueAt(input, "values", E), E), cells = checkedProduct([columns, rows], E, "INVALID_INPUT");
  if (raw.length !== cells) fail("INVALID_INPUT");
  const values = new Array(cells); for (let i = 0; i < cells; i += 1) { const n = number(Object.getOwnPropertyDescriptor(raw, String(i)).value, E); if (n < 0 || n > 1) fail("INVALID_INPUT"); values[i] = n; }
  checkedWork(cells, maxWork, E);
  const bits = new Array(cells); let spent = cells;
  const write = (index, amount) => { spent += 1; checkedWork(spent, maxWork, E); const next = values[index] + amount; if (!Number.isFinite(next)) fail("NUMERIC_OVERFLOW"); values[index] = next === 0 ? 0 : next; };
  for (let y = 0; y < rows; y += 1) for (let x = 0; x < columns; x += 1) {
    const i = y * columns + x, emitted = values[i] >= threshold ? 1 : 0, error = values[i] - emitted; bits[i] = emitted;
    if (x + 1 < columns) write(i + 1, error * (7 / 16));
    if (y + 1 < rows && x > 0) write(i + columns - 1, error * (3 / 16));
    if (y + 1 < rows) write(i + columns, error * (5 / 16));
    if (y + 1 < rows && x + 1 < columns) write(i + columns + 1, error * (1 / 16));
  }
  return { bits };
}
