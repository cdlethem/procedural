import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { DrawingError, normalizeCommand, strictlyConvex, validateEnvironment } from "../../packages/javascript/src/internal/drawing.js";

const here = dirname(fileURLToPath(import.meta.url));
const normalizedFixture = JSON.parse(readFileSync(resolve(here, "../../fixtures/drawing/fresh-raster-normalized.json"), "utf8"));
const geometryFixture = JSON.parse(readFileSync(resolve(here, "../../fixtures/drawing/geometry-investigation.json"), "utf8"));
const schemaFixture = JSON.parse(readFileSync(resolve(here, "../../fixtures/drawing/fresh-raster-schema.json"), "utf8"));
const results = [];
let failures = 0;

function record(id, actual, expected, passed) {
  results.push({ id, actual, expected, passed });
  if (!passed) failures += 1;
}

function errorCode(action) {
  try {
    action();
    return null;
  } catch (error) {
    return error instanceof DrawingError ? error.code : `UNEXPECTED:${error?.name ?? "unknown"}`;
  }
}

function bits32(value) {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, false);
  return view.getUint32(0, false).toString(16).padStart(8, "0");
}

function bits64(value) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  return view.getBigUint64(0, false).toString(16).padStart(16, "0");
}

function enrich(result) {
  const enriched = {
    ...result,
    point_bits_hex: result.points.map((point) => point.map(bits32)),
    alpha64_bits_hex: bits64(result.alpha64),
  };
  if (result.width !== undefined) enriched.width_bits_hex = bits32(result.width);
  return enriched;
}

function sameValue(actual, expected) {
  if (typeof actual === "number" || typeof expected === "number") return Object.is(actual, expected);
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return Array.isArray(actual) && Array.isArray(expected) && actual.length === expected.length &&
      actual.every((value, index) => sameValue(value, expected[index]));
  }
  if (actual !== null && expected !== null && typeof actual === "object" && typeof expected === "object") {
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();
    return actualKeys.length === expectedKeys.length && actualKeys.every((key, index) =>
      key === expectedKeys[index] && sameValue(actual[key], expected[key]));
  }
  return actual === expected;
}

for (const testCase of normalizedFixture.cases) {
  const environment = validateEnvironment(testCase.environment);
  let actual;
  try {
    actual = enrich(normalizeCommand(testCase.command, environment));
  } catch (error) {
    actual = { outcome: error instanceof DrawingError ? error.code : `UNEXPECTED:${error?.name ?? "unknown"}` };
  }
  record(testCase.id, actual, testCase.expected, sameValue(actual, testCase.expected));
}

for (const testCase of geometryFixture.quads) {
  const actual = {
    canonical_strictly_convex: strictlyConvex(testCase.vertices),
    binary32_strictly_convex: strictlyConvex(testCase.binary32_vertices),
  };
  const expected = {
    canonical_strictly_convex: testCase.canonical_strictly_convex,
    binary32_strictly_convex: testCase.binary32_strictly_convex,
  };
  record(`geometry-${testCase.id}`, actual, expected, sameValue(actual, expected));
}

const geometryEnvironment = { width: 2048, height: 2048, density: 1, background: 0 };
for (const vector of geometryFixture.conversion) {
  const command = { kind: "segment2", from: [0, 0], to: [vector.input, 1], rgb: 0, opacity8: 180, width: 1, cap: "round" };
  const actual = errorCode(() => normalizeCommand(command, geometryEnvironment));
  if (actual !== null) {
    record(`conversion-${vector.id}`, actual, vector.output_bits_hex, false);
    continue;
  }
  const normalized = normalizeCommand(command, geometryEnvironment);
  record(`conversion-${vector.id}`, bits32(normalized.points[1][0]), vector.output_bits_hex,
    bits32(normalized.points[1][0]) === vector.output_bits_hex);
}

const nativeChecks = [];
function native(id, action) {
  try {
    const actual = action();
    const passed = actual === true;
    nativeChecks.push({ id, actual, passed });
    if (!passed) failures += 1;
  } catch (error) {
    nativeChecks.push({ id, actual: `UNEXPECTED:${error?.code ?? error?.name ?? "unknown"}`, passed: false });
    failures += 1;
  }
}

native("environment-detached-and-positive-zero", () => {
  const environment = { width: 640, height: 480, density: 1, background: -0 };
  const normalized = validateEnvironment(environment);
  environment.width = 1;
  return normalized.width === 640 && Object.is(normalized.background, 0) && !Object.is(normalized.background, -0);
});

native("environment-schema-errors", () =>
  errorCode(() => validateEnvironment({ width: 640, height: 480, density: 2, background: 0 })) === "INVALID_ENVIRONMENT" &&
  errorCode(() => validateEnvironment({ width: 640, height: 480, density: 1, background: 0, extra: 1 })) === "INVALID_ENVIRONMENT" &&
  errorCode(() => validateEnvironment({ width: Infinity, height: 480, density: 1, background: 0 })) === "INVALID_ENVIRONMENT");

native("command-own-data-and-errors", () => {
  const command = { kind: "segment2", from: [0, 0], to: [1, 1], rgb: 0, opacity8: 180, width: 1, cap: "round" };
  Object.defineProperty(command, "hidden", { value: 1 });
  return errorCode(() => normalizeCommand(command, geometryEnvironment)) === "INVALID_COMMAND" &&
    errorCode(() => normalizeCommand({ kind: "segment2", from: [0, 0], to: [1, 1], rgb: 0, opacity8: 180, width: NaN, cap: "round" }, geometryEnvironment)) === "INVALID_COMMAND";
});

native("command-result-is-detached", () => {
  const from = [0, 0];
  const command = { kind: "segment2", from, to: [1, 1], rgb: 0x123456, opacity8: 180, width: 1, cap: "round" };
  const normalized = normalizeCommand(command, geometryEnvironment);
  from[0] = 99;
  normalized.points[0][1] = 99;
  const repeated = normalizeCommand(command, geometryEnvironment);
  return normalized.points !== repeated.points && repeated.points[0][0] === 99 && repeated.points[0][1] === 0;
});

native("schema-invalid-native-inputs", () => schemaFixture.cases
  .filter((testCase) => testCase.surface === "command" && !testCase.valid)
  .every((testCase) => errorCode(() => normalizeCommand(testCase.value, geometryEnvironment)) === "INVALID_COMMAND"));

const counts = {
  normalizedCases: normalizedFixture.cases.length,
  geometryCases: geometryFixture.quads.length,
  conversionCases: geometryFixture.conversion.length,
  schemaCases: schemaFixture.cases.length,
  nativeChecks: nativeChecks.length,
  resultChecks: results.length,
};
process.stdout.write(`${JSON.stringify({ profile: normalizedFixture.profile, version: normalizedFixture.version, failures, counts, results, nativeChecks }, null, 2)}\n`);
process.exitCode = failures === 0 ? 0 : 1;
