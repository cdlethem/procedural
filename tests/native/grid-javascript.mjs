import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { regularGrid, RegularGridError } from "../../packages/javascript/src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, "../../fixtures/operations/regular-grid.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const results = [];
let failures = 0;

function record(id, actual, expected, passed) {
  results.push({ id, actual, expected, passed });
  if (!passed) failures += 1;
}

function sameNumber(actual, expected) {
  return typeof actual === "number" && typeof expected === "number" && Object.is(actual, expected);
}

function samePoint(actual, expected) {
  return Array.isArray(actual) && actual.length === 2 && sameNumber(actual[0], expected[0]) && sameNumber(actual[1], expected[1]);
}

function canonicalInput(input) {
  const normalizeZero = (value) => value === 0 ? 0 : value;
  return {
    origin: [normalizeZero(input.origin[0]), normalizeZero(input.origin[1])],
    spacing: [input.spacing[0], input.spacing[1]],
    columns: normalizeZero(input.columns),
    rows: normalizeZero(input.rows),
  };
}

function sameSerialized(actual, expected) {
  const expectedKeys = ["columns", "origin", "rows", "spacing"];
  return actual !== null && typeof actual === "object" &&
    JSON.stringify(Object.keys(actual).sort()) === JSON.stringify(expectedKeys) &&
    samePoint(actual.origin, expected.origin) && samePoint(actual.spacing, expected.spacing) &&
    sameNumber(actual.columns, expected.columns) && sameNumber(actual.rows, expected.rows);
}

function errorCode(action) {
  try {
    action();
    return null;
  } catch (error) {
    return error instanceof RegularGridError ? error.code : `UNEXPECTED:${error?.name ?? "unknown"}`;
  }
}

for (const testCase of fixture.cases) {
  if (testCase.error) {
    const actual = errorCode(() => regularGrid(testCase.input));
    record(testCase.id, actual, testCase.error, actual === testCase.error);
    continue;
  }
  let grid;
  try {
    grid = regularGrid(testCase.input);
    const actualPoints = testCase.indices.map((index) => grid.pointAt(index));
    const pointsPass = actualPoints.every((point, index) => samePoint(point, testCase.points[index]));
    const serialization = grid.serialize();
    const canonical = canonicalInput(testCase.input);
    const actual = { size: grid.size, points: actualPoints, serialization };
    record(testCase.id, actual, { size: testCase.size, points: testCase.points, serialization: canonical },
      grid.size === testCase.size && pointsPass && sameSerialized(serialization, canonical));
  } catch (error) {
    record(testCase.id, `UNEXPECTED:${error?.code ?? error?.name ?? "unknown"}`, { size: testCase.size, points: testCase.points }, false);
  }
}

const accessGrid = regularGrid({ origin: [0, 0], spacing: [1, 1], columns: 3, rows: 2 });
for (const testCase of fixture.access_cases) {
  const actual = errorCode(() => accessGrid.pointAt(testCase.index));
  record(`access-${testCase.id}`, actual, testCase.error, actual === testCase.error);
}

const nativeChecks = [];
function native(id, action) {
  try {
    const actual = action();
    nativeChecks.push({ id, actual, passed: actual === true });
    if (actual !== true) failures += 1;
  } catch (error) {
    nativeChecks.push({ id, actual: `UNEXPECTED:${error?.code ?? error?.name ?? "unknown"}`, passed: false });
    failures += 1;
  }
}

native("nonfinite-input-and-index", () =>
  errorCode(() => regularGrid({ origin: [NaN, 0], spacing: [1, 1], columns: 1, rows: 1 })) === "INVALID_INPUT" &&
  errorCode(() => accessGrid.pointAt(Infinity)) === "INVALID_INDEX");

native("json-only-own-shape", () => {
  const withHiddenField = { origin: [0, 0], spacing: [1, 1], columns: 1, rows: 1 };
  Object.defineProperty(withHiddenField, "hidden", { value: 1 });
  const withSymbolField = { origin: [0, 0], spacing: [1, 1], columns: 1, rows: 1, [Symbol("extra")]: 1 };
  return errorCode(() => regularGrid(withHiddenField)) === "INVALID_INPUT" &&
    errorCode(() => regularGrid(withSymbolField)) === "INVALID_INPUT";
});

native("writable-array-slots-ignore-previous-content", () => {
  for (const out of [new Array(2), [undefined, undefined], [null, null], ["old", "old"]]) {
    accessGrid.pointInto(4, out);
    if (!samePoint(out, [1, 1])) return false;
  }
  const locked = [17, 19];
  Object.defineProperty(locked, "1", { writable: false });
  return errorCode(() => accessGrid.pointInto(4, locked)) === "INVALID_OUTPUT" && samePoint(locked, [17, 19]);
});

native("immutable-copies-and-fresh-points", () => {
  const origin = [-0, 2];
  const spacing = [3, 4];
  const grid = regularGrid({ origin, spacing, columns: 2, rows: 2 });
  origin[0] = 99;
  spacing[0] = 99;
  const first = grid.pointAt(0);
  first[0] = 99;
  const second = grid.pointAt(0);
  return Object.is(second[0], 0) && second[1] === 2 && first !== second && Object.isFrozen(grid);
});

native("serialization-is-detached-and-four-fields", () => {
  const grid = regularGrid({ origin: [-0, -0], spacing: [1, 2], columns: 2, rows: 3 });
  const serialized = grid.serialize();
  const keys = Object.keys(serialized).sort();
  serialized.origin[0] = 88;
  const restored = regularGrid(JSON.parse(JSON.stringify(grid)));
  return JSON.stringify(keys) === JSON.stringify(["columns", "origin", "rows", "spacing"]) &&
    Object.is(restored.pointAt(0)[0], 0) && grid.pointAt(0)[0] === 0 && restored.size === 6;
});

native("pointInto-binary64-and-numeric-array", () => {
  const grid = regularGrid({ origin: [-2, 4], spacing: [3, 0.5], columns: 3, rows: 2 });
  const binary = new Float64Array(4);
  const numeric = [-9, -9, -9, -9];
  return grid.pointInto(4, binary, 1) === binary && binary[1] === 1 && binary[2] === 4.5 &&
    grid.pointInto(5, numeric, 2) === numeric && numeric[2] === 4 && numeric[3] === 4.5;
});

native("pointInto-invalid-does-not-mutate", () => {
  const out = new Float64Array([7, 8, 9, 10]);
  const before = Array.from(out);
  const invalidIndex = errorCode(() => accessGrid.pointInto(6, out, 1));
  const invalidOffset = errorCode(() => accessGrid.pointInto(0, out, 3));
  return invalidIndex === "INDEX_OUT_OF_RANGE" && invalidOffset === "INVALID_OUTPUT" &&
    JSON.stringify(Array.from(out)) === JSON.stringify(before);
});

native("pointInto-rejects-float32-and-nonwritable", () => {
  const float32 = new Float32Array([7, 8]);
  const frozen = [7, 8];
  Object.freeze(frozen);
  const grid = accessGrid;
  return errorCode(() => grid.pointInto(0, float32)) === "INVALID_OUTPUT" &&
    errorCode(() => grid.pointInto(0, frozen)) === "INVALID_OUTPUT";
});

native("pointInto-index-errors-precede-storage", () =>
  errorCode(() => accessGrid.pointInto(6, new Float32Array(0))) === "INDEX_OUT_OF_RANGE" &&
  errorCode(() => accessGrid.pointInto(true, new Float32Array(0))) === "INVALID_INDEX");

native("huge-descriptor-indexed-without-materialization", () => {
  const grid = regularGrid({ origin: [0, 0], spacing: [1, 1], columns: 2_147_483_647, rows: 4_194_304 });
  const point = grid.pointAt(9_007_199_250_546_687);
  return grid.size === 9_007_199_250_546_688 && samePoint(point, [2_147_483_646, 4_194_303]);
});

const traversalGrid = regularGrid({ origin: [0, 0], spacing: [0.25, 0.5], columns: 500, rows: 500 });
const storage = new Float64Array(2);
function traverse() {
  let checksum = 0;
  for (let index = 0; index < traversalGrid.size; index += 1) {
    traversalGrid.pointInto(index, storage);
    checksum += storage[0] + storage[1];
  }
  return checksum;
}

traverse();
traverse();
const started = performance.now();
const checksum = traverse();
const elapsedMs = performance.now() - started;
const performanceResult = {
  points: traversalGrid.size,
  storage: "one Float64Array(2)",
  warmupTraversals: 2,
  timedTraversals: 1,
  checksum,
  elapsedMs,
};
record("performance-250000-reused-binary64", performanceResult, { points: 250000, checksum: 46_781_250 },
  traversalGrid.size === 250000 && sameNumber(checksum, 46_781_250));

process.stdout.write(`${JSON.stringify({ operation: fixture.operation, version: fixture.version, runtime: { node: process.version }, failures, results, nativeChecks }, null, 2)}\n`);
process.exitCode = failures === 0 ? 0 : 1;
