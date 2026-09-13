const KEYS = ["points", "closed", "count", "maxWork"];

/** Error with a stable geometry.resample-polyline-2d code. */
export class ResamplePolylineError extends Error {
  constructor(code) { super(code); this.name = "ResamplePolylineError"; this.code = code; }
}
function fail(code) { throw new ResamplePolylineError(code); }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function numeric(value) { if (!finite(value)) fail("INVALID_INPUT"); return value === 0 ? 0 : value; }
function computed(value) { if (!Number.isFinite(value)) fail("NUMERIC_OVERFLOW"); return value === 0 ? 0 : value; }
function plainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function plainArray(value) { return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype; }
function at(value, key) { const d = Object.getOwnPropertyDescriptor(value, key); if (d === undefined || !("value" in d)) fail("INVALID_INPUT"); return d.value; }
function array(value, length) { if (!plainArray(value) || (length !== undefined && value.length !== length)) fail("INVALID_INPUT"); for (let i = 0; i < value.length; i += 1) at(value, String(i)); }

/** Sample an open or closed explicit polyline at uniform traveled distances. */
export function resamplePolyline2D(input) {
  if (!plainObject(input) || Reflect.ownKeys(input).length !== KEYS.length) fail("INVALID_INPUT");
  for (const key of KEYS) at(input, key);
  const raw = at(input, "points"), closed = at(input, "closed");
  const count = numeric(at(input, "count")), maxWork = numeric(at(input, "maxWork"));
  if (typeof closed !== "boolean" || !Number.isSafeInteger(count) || count < 1 || count > 4294967295 || !Number.isSafeInteger(maxWork) || maxWork < 0) fail("INVALID_INPUT");
  array(raw); if (raw.length < 1 || (!closed && count < 2)) fail("INVALID_INPUT");
  const source = new Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) { const point = at(raw, String(i)); array(point, 2); source[i] = [numeric(at(point, "0")), numeric(at(point, "1"))]; }
  const work = raw.length + count;
  if (!Number.isSafeInteger(work) || work > maxWork) fail("WORK_LIMIT");
  const segmentCount = closed ? source.length : source.length - 1;
  const segments = [];
  let totalLength = 0;
  for (let i = 0; i < segmentCount; i += 1) {
    const start = source[i], end = source[(i + 1) % source.length];
    const dx = computed(end[0] - start[0]), dy = computed(end[1] - start[1]);
    const length = computed(Math.hypot(dx, dy));
    const endLength = computed(totalLength + length);
    if (length !== 0 && endLength !== totalLength) segments.push({ start, end, startLength: totalLength, endLength, index: i });
    totalLength = endLength;
  }
  const points = new Array(count), distances = new Array(count), sourceSegments = new Array(count);
  if (totalLength === 0) {
    for (let k = 0; k < count; k += 1) { points[k] = [source[0][0], source[0][1]]; distances[k] = 0; sourceSegments[k] = 0; }
    return { points, distances, sourceSegments, totalLength: 0 };
  }
  let cursor = 0;
  for (let k = 0; k < count; k += 1) {
    const distance = !closed && k === count - 1 ? totalLength : computed(totalLength * computed(k / (closed ? count : count - 1)));
    while (cursor + 1 < segments.length && segments[cursor].endLength <= distance) cursor += 1;
    const segment = segments[cursor];
    const t = computed(computed(distance - segment.startLength) / computed(segment.endLength - segment.startLength));
    const x = t === 0 ? segment.start[0] : t === 1 ? segment.end[0] : computed(segment.start[0] + computed(t * computed(segment.end[0] - segment.start[0])));
    const y = t === 0 ? segment.start[1] : t === 1 ? segment.end[1] : computed(segment.start[1] + computed(t * computed(segment.end[1] - segment.start[1])));
    points[k] = [x === 0 ? 0 : x, y === 0 ? 0 : y]; distances[k] = distance === 0 ? 0 : distance; sourceSegments[k] = segment.index;
  }
  if (!closed) points[count - 1] = [source[source.length - 1][0], source[source.length - 1][1]];
  return { points, distances, sourceSegments, totalLength: totalLength === 0 ? 0 : totalLength };
}
