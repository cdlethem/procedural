const MAX_AXIS_COUNT = 2_147_483_647;
const MAX_SAFE_SIZE = Number.MAX_SAFE_INTEGER;
const MAX_SAFE_SIZE_BIGINT = BigInt(MAX_SAFE_SIZE);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

/** Error with one of the stable regular-grid contract codes. */
export class RegularGridError extends Error {
  constructor(code) {
    super(code);
    this.name = "RegularGridError";
    this.code = code;
  }
}

function fail(code) {
  throw new RegularGridError(code);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveFiniteNumber(value) {
  return finiteNumber(value) && value > 0;
}

function axisCount(value) {
  return finiteNumber(value) && Number.isSafeInteger(value) && value >= 0 && value <= MAX_AXIS_COUNT;
}

function normalizedZero(value) {
  return value === 0 ? 0 : value;
}

function validateVector(value, predicate) {
  return Array.isArray(value) && value.length === 2 && predicate(value[0]) && predicate(value[1]);
}

function validateInput(params) {
  if (params === null || typeof params !== "object" || Array.isArray(params)) {
    fail("INVALID_INPUT");
  }
  // Inputs are JSON-like records: every own field, including non-enumerable or
  // symbol fields that JSON would otherwise hide, must belong to the four-field shape.
  const keys = Reflect.ownKeys(params);
  if (keys.length !== 4 || !hasOwn(params, "origin") || !hasOwn(params, "spacing") ||
      !hasOwn(params, "columns") || !hasOwn(params, "rows")) {
    fail("INVALID_INPUT");
  }
  if (!validateVector(params.origin, finiteNumber)) {
    fail("INVALID_INPUT");
  }
  if (!validateVector(params.spacing, positiveFiniteNumber)) {
    fail("INVALID_INPUT");
  }
  if (!axisCount(params.columns) || !axisCount(params.rows)) {
    fail("INVALID_INPUT");
  }

  return {
    originX: normalizedZero(params.origin[0]),
    originY: normalizedZero(params.origin[1]),
    spacingX: params.spacing[0],
    spacingY: params.spacing[1],
    columns: normalizedZero(params.columns),
    rows: normalizedZero(params.rows),
  };
}

function coordinate(origin, spacing, axisIndex) {
  const product = axisIndex * spacing;
  const result = origin + product;
  if (!Number.isFinite(product) || !Number.isFinite(result)) {
    fail("COORDINATE_OVERFLOW");
  }
  return normalizedZero(result);
}

function validateIndex(index) {
  if (typeof index !== "number" || !Number.isSafeInteger(index) || index < 0) {
    fail("INVALID_INDEX");
  }
}

function writableNumericArrayAt(out, offset) {
  if (!Array.isArray(out) || out.length < offset + 2) {
    return false;
  }
  function writableSlot(index) {
    const key = String(index);
    const own = Object.getOwnPropertyDescriptor(out, key);
    if (own !== undefined) return "value" in own && own.writable === true;
    if (!Object.isExtensible(out)) return false;
    // Ordinary holes are writable; inherited indexed behavior is outside this route.
    for (let proto = Object.getPrototypeOf(out); proto !== null; proto = Object.getPrototypeOf(proto)) {
      if (Object.getOwnPropertyDescriptor(proto, key) !== undefined) return false;
    }
    return true;
  }
  return writableSlot(offset) && writableSlot(offset + 1);
}

function validateOutput(out, offset) {
  if (typeof offset !== "number" || !Number.isSafeInteger(offset) || offset < 0) {
    fail("INVALID_OUTPUT");
  }
  if (out instanceof Float64Array) {
    if (out.length < offset + 2) {
      fail("INVALID_OUTPUT");
    }
    return;
  }
  if (!writableNumericArrayAt(out, offset)) {
    fail("INVALID_OUTPUT");
  }
}

/**
 * Create an immutable row-major sequence of binary64 planar points.
 * The descriptor stores only origin, spacing, columns, and rows; point storage is caller-owned.
 *
 * Motivating sketches: `2017/Generativos/circlesAlpha` and
 * `2019/generativos/paraisooscuro`. This operation has no approved artistic
 * default or encouraged parameter range: origin, spacing, and point counts are
 * explicit caller choices.
 */
export function regularGrid(params) {
  const values = validateInput(params);
  const exactSize = BigInt(values.columns) * BigInt(values.rows);
  if (exactSize > MAX_SAFE_SIZE_BIGINT) {
    fail("GRID_SIZE_OVERFLOW");
  }
  const size = Number(exactSize);

  if (size !== 0) {
    coordinate(values.originX, values.spacingX, values.columns - 1);
    coordinate(values.originY, values.spacingY, values.rows - 1);
  }

  function coordinatesAt(index) {
    validateIndex(index);
    if (index >= size) {
      fail("INDEX_OUT_OF_RANGE");
    }
    const column = index % values.columns;
    const row = (index - column) / values.columns;
    return [
      coordinate(values.originX, values.spacingX, column),
      coordinate(values.originY, values.spacingY, row),
    ];
  }

  function pointAt(index) {
    return coordinatesAt(index);
  }

  function pointInto(index, out, offset = 0) {
    validateIndex(index);
    if (index >= size) {
      fail("INDEX_OUT_OF_RANGE");
    }
    validateOutput(out, offset);
    const column = index % values.columns;
    const row = (index - column) / values.columns;
    const x = coordinate(values.originX, values.spacingX, column);
    const y = coordinate(values.originY, values.spacingY, row);
    out[offset] = x;
    out[offset + 1] = y;
    return out;
  }

  function serialize() {
    return {
      origin: [values.originX, values.originY],
      spacing: [values.spacingX, values.spacingY],
      columns: values.columns,
      rows: values.rows,
    };
  }

  const sequence = { size, pointAt, pointInto, serialize };
  Object.defineProperty(sequence, "toJSON", { value: serialize });
  return Object.freeze(sequence);
}
