const KEYS = ["values", "columns", "rows", "origin", "spacing", "threshold", "maxWork"];

/** Error with a stable geometry.marching-squares-2d code. */
export class MarchingSquaresError extends Error {
  constructor(code) { super(code); this.name = "MarchingSquaresError"; this.code = code; }
}
function fail(code) { throw new MarchingSquaresError(code); }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function numeric(value) { if (!finite(value)) fail("INVALID_INPUT"); return value === 0 ? 0 : value; }
function computed(value) { if (!Number.isFinite(value)) fail("NUMERIC_OVERFLOW"); return value === 0 ? 0 : value; }
function plainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function plainArray(value) { return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype; }
function at(value, key) { const d = Object.getOwnPropertyDescriptor(value, key); if (d === undefined || !("value" in d)) fail("INVALID_INPUT"); return d.value; }
function array(value, length) { if (!plainArray(value) || (length !== undefined && value.length !== length)) fail("INVALID_INPUT"); for (let i = 0; i < value.length; i += 1) at(value, String(i)); }

/** Extract independent, ordered isoline segments from a row-major scalar grid. */
export function marchingSquares2D(input) {
  if (!plainObject(input) || Reflect.ownKeys(input).length !== KEYS.length) fail("INVALID_INPUT");
  for (const key of KEYS) at(input, key);
  const rawValues = at(input, "values"), columns = numeric(at(input, "columns")), rows = numeric(at(input, "rows"));
  const rawOrigin = at(input, "origin"), rawSpacing = at(input, "spacing"), threshold = numeric(at(input, "threshold")), maxWork = numeric(at(input, "maxWork"));
  if (!Number.isSafeInteger(columns) || columns < 2 || !Number.isSafeInteger(rows) || rows < 2 || !Number.isSafeInteger(maxWork) || maxWork < 0) fail("INVALID_INPUT");
  array(rawValues);
  array(rawOrigin, 2); array(rawSpacing, 2);
  const origin = [numeric(at(rawOrigin, "0")), numeric(at(rawOrigin, "1"))];
  const spacing = [numeric(at(rawSpacing, "0")), numeric(at(rawSpacing, "1"))];
  if (!(spacing[0] > 0 && spacing[1] > 0)) fail("INVALID_INPUT");
  for (let i = 0; i < rawValues.length; i += 1) numeric(at(rawValues, String(i)));
  const gridSize = columns * rows, cells = (columns - 1) * (rows - 1), work = gridSize + cells;
  if (!Number.isSafeInteger(gridSize) || !Number.isSafeInteger(cells) || !Number.isSafeInteger(work)) fail("WORK_LIMIT");
  if (rawValues.length !== gridSize) fail("INVALID_INPUT");
  const values = new Array(gridSize); for (let i = 0; i < gridSize; i += 1) values[i] = numeric(at(rawValues, String(i)));
  if (work > maxWork) fail("WORK_LIMIT");
  const xs = new Array(columns), ys = new Array(rows);
  for (let x = 0; x < columns; x += 1) xs[x] = computed(origin[0] + computed(x * spacing[0]));
  for (let y = 0; y < rows; y += 1) ys[y] = computed(origin[1] + computed(y * spacing[1]));
  const segments = [], cellIndices = [];
  for (let y = 0; y < rows - 1; y += 1) for (let x = 0; x < columns - 1; x += 1) {
    const ids = [y * columns + x, y * columns + x + 1, (y + 1) * columns + x + 1, (y + 1) * columns + x];
    const high = ids.map((id) => values[id] >= threshold);
    const crossings = [];
    for (let edge = 0; edge < 4; edge += 1) if (high[edge] !== high[(edge + 1) % 4]) crossings.push(edge);
    if (crossings.length === 0) continue;
    const edgePoint = (edge) => {
      const next = (edge + 1) % 4;
      const corners = [[xs[x], ys[y]], [xs[x + 1], ys[y]], [xs[x + 1], ys[y + 1]], [xs[x], ys[y + 1]]];
      // Edges 2 and 3 are explicitly interpolated left-to-right/top-to-bottom.
      const starts = edge === 2 ? corners[3] : edge === 3 ? corners[0] : corners[edge];
      const ends = edge === 2 ? corners[2] : edge === 3 ? corners[3] : corners[next];
      const va = edge === 2 ? values[ids[3]] : edge === 3 ? values[ids[0]] : values[ids[edge]];
      const vb = edge === 2 ? values[ids[2]] : edge === 3 ? values[ids[3]] : values[ids[next]];
      const t = computed(computed(threshold - va) / computed(vb - va));
      return [t === 0 ? starts[0] : t === 1 ? ends[0] : computed(starts[0] + computed(t * computed(ends[0] - starts[0]))), t === 0 ? starts[1] : t === 1 ? ends[1] : computed(starts[1] + computed(t * computed(ends[1] - starts[1])))];
    };
    const pairs = crossings.length === 2 ? [[crossings[0], crossings[1]]] : [];
    if (crossings.length === 4) for (let corner = 0; corner < 4; corner += 1) if (high[corner]) pairs.push(corner === 0 ? [0, 3] : corner === 1 ? [0, 1] : corner === 2 ? [1, 2] : [2, 3]);
    pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const pair of pairs) {
      const first = edgePoint(pair[0]), second = edgePoint(pair[1]);
      if (first[0] !== second[0] || first[1] !== second[1]) { segments.push([first[0] === 0 ? 0 : first[0], first[1] === 0 ? 0 : first[1], second[0] === 0 ? 0 : second[0], second[1] === 0 ? 0 : second[1]]); cellIndices.push(y * (columns - 1) + x); }
    }
  }
  return { segments, cellIndices };
}
