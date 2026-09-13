const KEYS = ["sites", "bounds", "maxWork"];

/** Error with a stable geometry.voronoi-cells-2d code. */
export class VoronoiCellsError extends Error {
  constructor(code) { super(code); this.name = "VoronoiCellsError"; this.code = code; }
}

function fail(code) { throw new VoronoiCellsError(code); }
function finite(value) { return typeof value === "number" && Number.isFinite(value); }
function numeric(value) { if (!finite(value)) fail("INVALID_INPUT"); return value === 0 ? 0 : value; }
function computed(value) { if (!Number.isFinite(value)) fail("NUMERIC_OVERFLOW"); return value === 0 ? 0 : value; }
function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function plainArray(value) { return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype; }
function valueAt(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !("value" in descriptor)) fail("INVALID_INPUT");
  return descriptor.value;
}
function validateRecord(value) {
  if (!plainObject(value) || Reflect.ownKeys(value).length !== KEYS.length) fail("INVALID_INPUT");
  for (const key of KEYS) valueAt(value, key);
}
function validateArray(value, length) {
  if (!plainArray(value) || (length !== undefined && value.length !== length)) fail("INVALID_INPUT");
  for (let i = 0; i < value.length; i += 1) valueAt(value, String(i));
}
function charge(work, budget) {
  if (!Number.isSafeInteger(work) || work > budget) fail("WORK_LIMIT");
  return work;
}
function same(a, b) { return a[0] === b[0] && a[1] === b[1]; }
function canonical(point) { return [point[0] === 0 ? 0 : point[0], point[1] === 0 ? 0 : point[1]]; }

function clean(polygon) {
  const result = [];
  for (const point of polygon) if (result.length === 0 || !same(result[result.length - 1], point)) result.push(point);
  if (result.length > 1 && same(result[0], result[result.length - 1])) result.pop();
  return result;
}
function areaIsZero(polygon) {
  let area = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    area = computed(area + computed(computed(a[0] * b[1]) - computed(a[1] * b[0])));
  }
  return area === 0;
}
function rotateMinimum(polygon) {
  let minimum = 0;
  for (let i = 1; i < polygon.length; i += 1) {
    if (polygon[i][0] < polygon[minimum][0] ||
        (polygon[i][0] === polygon[minimum][0] && polygon[i][1] < polygon[minimum][1])) minimum = i;
  }
  return polygon.slice(minimum).concat(polygon.slice(0, minimum)).map(canonical);
}

/** Return clipped nearest-site polygons in the input site order. */
export function voronoiCells2D(input) {
  validateRecord(input);
  const rawSites = valueAt(input, "sites");
  const rawBounds = valueAt(input, "bounds");
  const maxWork = numeric(valueAt(input, "maxWork"));
  if (!Number.isSafeInteger(maxWork) || maxWork < 0) fail("INVALID_INPUT");
  validateArray(rawSites);
  validateArray(rawBounds, 4);
  const bounds = [numeric(valueAt(rawBounds, "0")), numeric(valueAt(rawBounds, "1")),
    numeric(valueAt(rawBounds, "2")), numeric(valueAt(rawBounds, "3"))];
  if (!(bounds[0] < bounds[2] && bounds[1] < bounds[3])) fail("INVALID_INPUT");
  const sites = new Array(rawSites.length);
  for (let i = 0; i < rawSites.length; i += 1) {
    const row = valueAt(rawSites, String(i)); validateArray(row, 2);
    sites[i] = [numeric(valueAt(row, "0")), numeric(valueAt(row, "1"))];
  }
  const preflight = sites.length * sites.length;
  charge(preflight, maxWork);
  let work = preflight;
  const cells = new Array(sites.length);
  for (let source = 0; source < sites.length; source += 1) {
    const site = sites[source];
    let duplicate = false;
    for (let previous = 0; previous < source; previous += 1) if (same(site, sites[previous])) duplicate = true;
    if (duplicate) { cells[source] = []; continue; }
    let polygon = [[bounds[0], bounds[1]], [bounds[2], bounds[1]], [bounds[2], bounds[3]], [bounds[0], bounds[3]]];
    for (let otherIndex = 0; otherIndex < sites.length && polygon.length > 0; otherIndex += 1) {
      if (otherIndex === source || same(site, sites[otherIndex])) continue;
      const other = sites[otherIndex];
      const a = computed(other[0] - site[0]), b = computed(other[1] - site[1]);
      const midX = computed(site[0] + computed(a / 2)), midY = computed(site[1] + computed(b / 2));
      const clipped = [];
      let previous = polygon[polygon.length - 1];
      let previousDistance = computed(computed(a * computed(previous[0] - midX)) + computed(b * computed(previous[1] - midY)));
      for (const current of polygon) {
        work = charge(work + 1, maxWork);
        const currentDistance = computed(computed(a * computed(current[0] - midX)) + computed(b * computed(current[1] - midY)));
        const previousInside = previousDistance <= 0, currentInside = currentDistance <= 0;
        if (previousInside !== currentInside) {
          const denominator = computed(previousDistance - currentDistance);
          const t = computed(previousDistance / denominator);
          const x = computed(previous[0] + computed(t * computed(current[0] - previous[0])));
          const y = computed(previous[1] + computed(t * computed(current[1] - previous[1])));
          clipped.push([x, y]);
        }
        if (currentInside) clipped.push(current);
        previous = current; previousDistance = currentDistance;
      }
      polygon = clean(clipped);
    }
    cells[source] = polygon.length < 3 || areaIsZero(polygon) ? [] : rotateMinimum(polygon);
  }
  return { cells };
}
