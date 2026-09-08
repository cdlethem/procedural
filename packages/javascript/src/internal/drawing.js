const MAX_SURFACE_AXIS = 2_048;
const MAX_RGB24 = 0xff_ff_ff;
const MIN_CONVERTED_WIDTH = 1 / 256;
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const binary64View = new DataView(new ArrayBuffer(8));

/** Error with a stable fresh-raster validation code. */
export class DrawingError extends Error {
  constructor(code) {
    super(code);
    this.name = "DrawingError";
    this.code = code;
  }
}

function fail(code) {
  throw new DrawingError(code);
}

function normalizedZero(value) {
  return value === 0 ? 0 : value;
}

function dataProperty(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function hasOnlyOwnDataKeys(value, expected) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length && expected.every((key) => hasOwn(value, key));
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function boundedInteger(value, minimum, maximum) {
  return finiteNumber(value) && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function exactArray(value, length) {
  if (!Array.isArray(value) || value.length !== length) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== length + 1 || !keys.includes("length")) return false;
  for (let index = 0; index < length; index += 1) {
    if (!hasOwn(value, index) || !finiteNumber(dataProperty(value, String(index)))) return false;
  }
  return true;
}

function normalizedPoint(value) {
  if (!exactArray(value, 2)) fail("INVALID_COMMAND");
  return [normalizedZero(dataProperty(value, "0")), normalizedZero(dataProperty(value, "1"))];
}

// An exact represented-binary64 value is significand * 2 ** exponent. Keeping
// the exponent separate makes orientation signs exact without decimal conversion
// or an epsilon, including subnormals and large cancellation-prone coordinates.
function binary64Rational(value) {
  binary64View.setFloat64(0, value, false);
  const bits = binary64View.getBigUint64(0, false);
  const sign = (bits >> 63n) === 0n ? 1n : -1n;
  const exponentBits = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & ((1n << 52n) - 1n);
  if (exponentBits === 0) return { significand: sign * fraction, exponent: -1074 };
  return { significand: sign * ((1n << 52n) | fraction), exponent: exponentBits - 1075 };
}

function subtractExact(left, right) {
  const exponent = Math.min(left.exponent, right.exponent);
  return {
    significand: (left.significand << BigInt(left.exponent - exponent)) -
      (right.significand << BigInt(right.exponent - exponent)),
    exponent,
  };
}

function multiplyExact(left, right) {
  return { significand: left.significand * right.significand, exponent: left.exponent + right.exponent };
}

function orientSign(a, b, c) {
  const ax = binary64Rational(a[0]);
  const ay = binary64Rational(a[1]);
  const bx = binary64Rational(b[0]);
  const by = binary64Rational(b[1]);
  const cx = binary64Rational(c[0]);
  const cy = binary64Rational(c[1]);
  const first = multiplyExact(subtractExact(bx, ax), subtractExact(cy, ay));
  const second = multiplyExact(subtractExact(by, ay), subtractExact(cx, ax));
  const result = subtractExact(first, second).significand;
  return result > 0n ? 1 : result < 0n ? -1 : 0;
}

/**
 * Return whether four cyclic binary64 points have one nonzero exact turn sign.
 * Internal-only: it is exported from this module for native numeric conformance,
 * never from the package entry point.
 */
export function strictlyConvex(points) {
  let sign = 0;
  for (let index = 0; index < 4; index += 1) {
    const turn = orientSign(points[index], points[(index + 1) % 4], points[(index + 2) % 4]);
    if (turn === 0 || (sign !== 0 && turn !== sign)) return false;
    sign = turn;
  }
  return true;
}

function binary32(value) {
  const converted = Math.fround(value);
  if (!Number.isFinite(converted)) fail("INVALID_COMMAND");
  return normalizedZero(converted);
}

function convertedPoint(point) {
  return [binary32(point[0]), binary32(point[1])];
}

/** Validate and detach the fresh density-1 drawing environment. */
export function validateEnvironment(value) {
  const expected = ["width", "height", "density", "background"];
  if (!hasOnlyOwnDataKeys(value, expected)) fail("INVALID_ENVIRONMENT");
  const width = dataProperty(value, "width");
  const height = dataProperty(value, "height");
  const density = dataProperty(value, "density");
  const background = dataProperty(value, "background");
  if (!boundedInteger(width, 1, MAX_SURFACE_AXIS) || !boundedInteger(height, 1, MAX_SURFACE_AXIS) ||
      density !== 1 || !boundedInteger(background, 0, MAX_RGB24)) {
    fail("INVALID_ENVIRONMENT");
  }
  return { width, height, density: 1, background: normalizedZero(background) };
}

function validateStyle(command) {
  const rgb = dataProperty(command, "rgb");
  const opacity8 = dataProperty(command, "opacity8");
  if (!boundedInteger(rgb, 0, MAX_RGB24) || !boundedInteger(opacity8, 0, 255)) {
    fail("INVALID_COMMAND");
  }
  return { rgb: normalizedZero(rgb), opacity8: normalizedZero(opacity8) };
}

function validateSegment(command) {
  if (!hasOnlyOwnDataKeys(command, ["kind", "from", "to", "rgb", "opacity8", "width", "cap"]) ||
      dataProperty(command, "kind") !== "segment2" || dataProperty(command, "cap") !== "round") {
    fail("INVALID_COMMAND");
  }
  const from = normalizedPoint(dataProperty(command, "from"));
  const to = normalizedPoint(dataProperty(command, "to"));
  const width = dataProperty(command, "width");
  if (!finiteNumber(width) || width <= 0 || (from[0] === to[0] && from[1] === to[1])) {
    fail("INVALID_COMMAND");
  }
  return { kind: "segment2", points: [from, to], width: normalizedZero(width), cap: "round", ...validateStyle(command) };
}

function validateQuad(command) {
  if (!hasOnlyOwnDataKeys(command, ["kind", "vertices", "rgb", "opacity8"]) ||
      dataProperty(command, "kind") !== "quad2") {
    fail("INVALID_COMMAND");
  }
  const vertices = dataProperty(command, "vertices");
  if (!Array.isArray(vertices) || vertices.length !== 4) fail("INVALID_COMMAND");
  const keys = Reflect.ownKeys(vertices);
  if (keys.length !== 5 || !keys.includes("length")) fail("INVALID_COMMAND");
  const points = new Array(4);
  for (let index = 0; index < 4; index += 1) {
    if (!hasOwn(vertices, index)) fail("INVALID_COMMAND");
    points[index] = normalizedPoint(dataProperty(vertices, String(index)));
  }
  if (!strictlyConvex(points)) fail("INVALID_COMMAND");
  return { kind: "quad2", points, ...validateStyle(command) };
}

function inConvertedDomain(points, width, environment) {
  const margin = Math.max(environment.width, environment.height);
  for (const point of points) {
    if (point[0] < -margin || point[0] > environment.width + margin ||
        point[1] < -margin || point[1] > environment.height + margin) {
      return false;
    }
  }
  return width === undefined || (width >= MIN_CONVERTED_WIDTH && width <= margin);
}

/**
 * Normalize one command against an explicitly supplied fresh-raster environment.
 * The result is detached canonical data for a later renderer adapter; no surface,
 * state machine, host colour state, or raster operation is involved here.
 * The environment is revalidated here so this standalone internal helper remains
 * safe when called without a prior `validateEnvironment` step.
 */
export function normalizeCommand(command, environment) {
  const env = validateEnvironment(environment);
  if (!hasOnlyOwnDataKeys(command, ["kind", "from", "to", "rgb", "opacity8", "width", "cap"]) &&
      !hasOnlyOwnDataKeys(command, ["kind", "vertices", "rgb", "opacity8"])) {
    fail("INVALID_COMMAND");
  }

  const kind = dataProperty(command, "kind");
  const canonical = kind === "segment2" ? validateSegment(command) :
    kind === "quad2" ? validateQuad(command) : fail("INVALID_COMMAND");
  const points = canonical.points.map(convertedPoint);
  const width = canonical.kind === "segment2" ? binary32(canonical.width) : undefined;
  if (!inConvertedDomain(points, width, env) || (canonical.kind === "quad2" && !strictlyConvex(points))) {
    fail("INVALID_COMMAND");
  }

  const alpha64 = canonical.opacity8 / 255;
  const result = {
    outcome: canonical.kind === "segment2" && points[0][0] === points[1][0] && points[0][1] === points[1][1] ? "noop" : "emit",
    kind: canonical.kind,
    points,
    rgb: canonical.rgb,
    channels: [(canonical.rgb >>> 16) & 0xff, (canonical.rgb >>> 8) & 0xff, canonical.rgb & 0xff],
    opacity8: canonical.opacity8,
    alpha64: normalizedZero(alpha64),
  };
  if (canonical.kind === "segment2") {
    result.width = width;
    result.cap = "round";
  }
  return result;
}
