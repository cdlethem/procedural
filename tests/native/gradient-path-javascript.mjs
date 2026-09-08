import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { gradientPath2D, GradientPathError } from "../../packages/javascript/src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const fixturePath = resolve(root, "fixtures/operations/gradient-path.json");
const catalogPath = resolve(root, "catalog/operations/gradient-path.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const results = [];
const nativeChecks = [];
let failures = 0;

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const catalogSha256 = sha256(catalogPath);
const longCasesSourcePath = resolve(root, fixture.long_cases_source.path);
const longCasesSourceSha256 = sha256(longCasesSourcePath);
const fixtureBindings = {
  catalog: { path: "catalog/operations/gradient-path.json", expected: fixture.catalog_sha256, actual: catalogSha256,
    passed: fixture.catalog_sha256 === catalogSha256 },
  longCasesSource: { path: fixture.long_cases_source.path, expected: fixture.long_cases_source.sha256, actual: longCasesSourceSha256,
    passed: fixture.long_cases_source.sha256 === longCasesSourceSha256 },
};
for (const binding of Object.values(fixtureBindings)) if (!binding.passed) failures += 1;

function record(id, actual, expected, passed) {
  results.push({ id, actual, expected, passed });
  if (!passed) failures += 1;
}

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

function bits64(value) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  return view.getBigUint64(0, false).toString(16).padStart(16, "0");
}

function sameNumber(actual, expected, tolerance) {
  if (typeof actual !== "number" || typeof expected !== "number") return false;
  return tolerance === 0 ? Object.is(actual, expected) : Math.abs(actual - expected) <= tolerance;
}

function samePoint(actual, expected, tolerance) {
  return Array.isArray(actual) && actual.length === 2 &&
    sameNumber(actual[0], expected[0], tolerance) && sameNumber(actual[1], expected[1], tolerance);
}

function errorOutcome(action) {
  try {
    action();
    return null;
  } catch (error) {
    if (!(error instanceof GradientPathError)) return { code: `UNEXPECTED:${error?.name ?? "unknown"}` };
    const outcome = { code: error.code };
    if (error.stepIndex !== undefined) outcome.stepIndex = error.stepIndex;
    if (error.stage !== undefined) outcome.stage = error.stage;
    return outcome;
  }
}

function expectedError(testCase) {
  if (testCase.error_detail === undefined) return { code: testCase.error };
  return { code: testCase.error, stepIndex: testCase.error_detail.stepIndex, stage: testCase.error_detail.stage };
}

function sameError(actual, expected) {
  return actual !== null && actual.code === expected.code && actual.stepIndex === expected.stepIndex && actual.stage === expected.stage;
}

function serializedMatches(path, input) {
  const serialized = path.serialize();
  const expected = {
    field: { seed: input.field.seed === 0 ? 0 : input.field.seed },
    start: input.start.map((value) => value === 0 ? 0 : value),
    steps: input.steps === 0 ? 0 : input.steps,
    stepDistance: input.stepDistance === 0 ? 0 : input.stepDistance,
    fieldScale: input.fieldScale === 0 ? 0 : input.fieldScale,
    fieldOffset: input.fieldOffset.map((value) => value === 0 ? 0 : value),
    angleBase: input.angleBase === 0 ? 0 : input.angleBase,
    angleScale: input.angleScale === 0 ? 0 : input.angleScale,
  };
  return JSON.stringify(serialized) === JSON.stringify(expected) && JSON.stringify(path) === JSON.stringify(expected);
}

for (const testCase of fixture.cases) {
  if (testCase.error !== undefined) {
    const actual = errorOutcome(() => gradientPath2D(testCase.input));
    const expected = expectedError(testCase);
    record(testCase.id, actual, expected, sameError(actual, expected));
    continue;
  }
  try {
    const path = gradientPath2D(testCase.input);
    const actual = path.toValues();
    const positionsPass = actual.positions.length === testCase.output.positions.length &&
      actual.positions.every((point, index) => samePoint(point, testCase.output.positions[index], testCase.comparison.positions_abs));
    const headingsPass = actual.headings.length === testCase.output.headings.length &&
      actual.headings.every((heading, index) => sameNumber(heading, testCase.output.headings[index], testCase.comparison.headings_abs));
    record(testCase.id, { output: actual, serialized: path.serialize(), steps: path.steps },
      { output: testCase.output, serialized: testCase.input, steps: testCase.input.steps },
      positionsPass && headingsPass && path.steps === testCase.input.steps && serializedMatches(path, testCase.input));
  } catch (error) {
    record(testCase.id, { code: `UNEXPECTED:${error?.code ?? error?.name ?? "unknown"}` }, testCase.output, false);
  }
}

for (const testCase of fixture.long_cases) {
  try {
    const path = gradientPath2D(testCase.input);
    const selected = testCase.selected.map((expected) => {
      const actual = { pointIndex: expected.pointIndex, position: path.pointAt(expected.pointIndex) };
      if (expected.headingIndex !== undefined) actual.headingIndex = expected.headingIndex;
      if (expected.heading !== undefined) actual.heading = path.headingAt(expected.headingIndex);
      return actual;
    });
    const passed = selected.every((actual, index) => {
      const expected = testCase.selected[index];
      return samePoint(actual.position, expected.position, testCase.comparison.positions_abs) &&
        (expected.heading === undefined || sameNumber(actual.heading, expected.heading, testCase.comparison.headings_abs));
    });
    record(testCase.id, selected, testCase.selected, passed);
  } catch (error) {
    record(testCase.id, { code: `UNEXPECTED:${error?.code ?? error?.name ?? "unknown"}` }, testCase.selected, false);
  }
}

for (const check of fixture.cross_case_checks) {
  let passed = false;
  let actual = null;
  if (check.kind === "raw-binary64-prefix") {
    const prefix = fixture.cases.find((testCase) => testCase.id === check.prefix_case);
    const extended = fixture.cases.find((testCase) => testCase.id === check.extended_case);
    if (prefix !== undefined && extended !== undefined) {
      const first = gradientPath2D(prefix.input).toValues();
      const second = gradientPath2D(extended.input).toValues();
      const positionBits = first.positions.every((point, index) =>
        bits64(point[0]) === bits64(second.positions[index][0]) && bits64(point[1]) === bits64(second.positions[index][1]));
      const headingBits = first.headings.every((heading, index) => bits64(heading) === bits64(second.headings[index]));
      actual = { kind: check.kind, positions: positionBits, headings: headingBits };
      passed = positionBits && headingBits;
    }
  }
  record(`cross-${check.id}`, actual, check, passed);
}

native("positive-zero", () => {
  const zero = gradientPath2D(fixture.cases.find((testCase) => testCase.id === "canonical-negative-zero").input).toValues();
  const cardinal = gradientPath2D(fixture.cases.find((testCase) => testCase.id === "cardinal-zero-heading").input).toValues();
  return zero.positions.every((point) => point.every((value) => Object.is(value, 0) && !Object.is(value, -0))) &&
    cardinal.positions.flat().filter((value) => value === 0).every((value) => Object.is(value, 0) && !Object.is(value, -0)) &&
    cardinal.headings.every((value) => Object.is(value, 0) && !Object.is(value, -0));
});

native("detached-input-output-and-replay", () => {
  const config = { field: { seed: 42 }, start: [-0.25, 0.5], steps: 3, stepDistance: 0.4, fieldScale: 0.01,
    fieldOffset: [0.125, -0.25], angleBase: -0.7, angleScale: 2.5 };
  const path = gradientPath2D(config);
  const baseline = path.toValues();
  config.field.seed = 1; config.start[0] = 99; config.fieldOffset[0] = 99; config.steps = 0;
  const pair = path.pointAt(1); pair[0] = 99;
  const serialized = path.serialize(); serialized.start[0] = 99; serialized.field.seed = 1;
  const values = path.toValues(); values.positions[1][0] = 99; values.headings[0] = 99;
  const replay = gradientPath2D(path.serialize()).toValues();
  return Object.isFrozen(path) && JSON.stringify(path.toValues()) === JSON.stringify(baseline) &&
    JSON.stringify(replay) === JSON.stringify(baseline) && path.pointAt(1)[0] !== 99 &&
    path.serialize().start[0] !== 99 && path.serialize().field.seed === 42;
});

native("passive-own-data-and-static-access-order", () => {
  const valid = { field: { seed: 42 }, start: [0, 0], steps: 1, stepDistance: 1, fieldScale: 1,
    fieldOffset: [0, 0], angleBase: 0, angleScale: 0 };
  const hidden = { ...valid }; Object.defineProperty(hidden, "hidden", { value: 1 });
  const symbol = { ...valid, [Symbol("extra")]: 1 };
  const accessor = { ...valid }; Object.defineProperty(accessor, "start", { get: () => [0, 0] });
  let laterReads = 0;
  const ordered = { ...valid, field: { seed: -1 } };
  Object.defineProperty(ordered, "start", { get: () => { laterReads += 1; return [0, 0]; } });
  return errorOutcome(() => gradientPath2D(hidden))?.code === "INVALID_INPUT" &&
    errorOutcome(() => gradientPath2D(symbol))?.code === "INVALID_INPUT" &&
    errorOutcome(() => gradientPath2D(accessor))?.code === "INVALID_INPUT" &&
    errorOutcome(() => gradientPath2D(ordered))?.code === "INVALID_INPUT" && laterReads === 0;
});

native("access-order-and-binary64-output-buffers", () => {
  const path = gradientPath2D({ field: { seed: 42 }, start: [0, 0], steps: 2, stepDistance: 1, fieldScale: 1,
    fieldOffset: [0, 0], angleBase: 0, angleScale: 0 });
  const unchanged = [17, 19, 23];
  const locked = [17, 19]; Object.defineProperty(locked, "1", { writable: false });
  const binary = new Float64Array(4); path.pointInto(2, binary, 1);
  const ordinary = ["old", "old", "old"]; path.pointInto(1, ordinary, 1);
  return errorOutcome(() => path.pointAt(Infinity))?.code === "INVALID_INDEX" &&
    errorOutcome(() => path.pointAt(3))?.code === "INDEX_OUT_OF_RANGE" &&
    errorOutcome(() => path.pointInto(3, new Float32Array(2), -1))?.code === "INDEX_OUT_OF_RANGE" &&
    errorOutcome(() => path.pointInto(1, new Float32Array(2)))?.code === "INVALID_OUTPUT" &&
    errorOutcome(() => path.pointInto(1, locked))?.code === "INVALID_OUTPUT" && locked[0] === 17 && locked[1] === 19 &&
    errorOutcome(() => path.pointInto(1, unchanged, 2))?.code === "INVALID_OUTPUT" && JSON.stringify(unchanged) === JSON.stringify([17, 19, 23]) &&
    binary[1] === 2 && binary[2] === 0 && ordinary[1] === 1 && ordinary[2] === 0;
});

native("dynamic-failure-and-host-resource-classification", () => {
  const dynamic = fixture.cases.find((testCase) => testCase.id === "query-invalid-late");
  const dynamicOutcome = errorOutcome(() => gradientPath2D(dynamic.input));
  const originalFloat64 = globalThis.Float64Array;
  let resource;
  try {
    globalThis.Float64Array = function forcedResourceFailure() { throw new Error("forced-resource-failure"); };
    try { gradientPath2D({ field: { seed: 42 }, start: [0, 0], steps: 1, stepDistance: 1, fieldScale: 1,
      fieldOffset: [0, 0], angleBase: 0, angleScale: 0 }); } catch (error) { resource = error; }
  } finally {
    globalThis.Float64Array = originalFloat64;
  }
  return dynamicOutcome?.code === "TRACE_QUERY_INVALID" && dynamicOutcome.stepIndex === 1 && dynamicOutcome.stage === "query_x" &&
    resource instanceof Error && !(resource instanceof GradientPathError) && resource.message === "forced-resource-failure";
});

function outputChecksum(path) {
  const view = new DataView(new ArrayBuffer(8));
  let hash = 0xcbf29ce484222325n;
  const update = (value) => {
    view.setFloat64(0, value, false);
    for (let offset = 0; offset < 8; offset += 1) {
      hash ^= BigInt(view.getUint8(offset));
      hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    }
  };
  const point = new Float64Array(2);
  for (let index = 0; index <= path.steps; index += 1) {
    path.pointInto(index, point);
    update(point[0]); update(point[1]);
  }
  for (let index = 0; index < path.steps; index += 1) update(path.headingAt(index));
  return hash.toString(16).padStart(16, "0");
}

const benchmarkCases = fixture.long_cases.map((testCase) => ({ id: testCase.id, input: testCase.input, steps: testCase.input.steps }));
const benchmarkCasesResult = [];
for (const testCase of benchmarkCases) {
  const warmups = [];
  const repetitions = [];
  for (let warmup = 0; warmup < 3; warmup += 1) {
    const started = performance.now();
    const checksum = outputChecksum(gradientPath2D(testCase.input));
    warmups.push({ iteration: warmup + 1, elapsedMs: performance.now() - started, checksum });
  }
  for (let repetition = 0; repetition < 5; repetition += 1) {
    const started = performance.now();
    const checksum = outputChecksum(gradientPath2D(testCase.input));
    repetitions.push({ iteration: repetition + 1, elapsedMs: performance.now() - started, checksum });
  }
  const checksum = repetitions[0].checksum;
  const stable = [...warmups, ...repetitions].every((sample) => sample.checksum === checksum);
  benchmarkCasesResult.push({ id: testCase.id, steps: testCase.steps, checksum, warmups, repetitions,
    retainedBinary64Bytes: (3 * testCase.steps + 2) * 8, retainedBinary64BytesMeaning: "final packed positions/headings only; peak process memory is not measured", stable });
  if (!stable) failures += 1;
}
const benchmark = {
  workloads: benchmarkCases.length,
  steps: [...new Set(benchmarkCases.map((testCase) => testCase.steps))].sort((left, right) => left - right),
  warmupTraversalsPerWorkload: 3,
  timedTraversalsPerWorkload: 5,
  checksumAlgorithm: "FNV-1a-64 over big-endian binary64 positions then headings, traversed through pointInto/headingAt",
  cases: benchmarkCasesResult,
};

const counts = {
  shortCases: fixture.cases.length,
  longCases: fixture.long_cases.length,
  successfulShortCases: fixture.cases.filter((testCase) => testCase.output !== undefined).length,
  errorShortCases: fixture.cases.filter((testCase) => testCase.error !== undefined).length,
  crossCaseChecks: fixture.cross_case_checks.length,
  nativeChecks: nativeChecks.length,
  resultChecks: results.length,
};
const sourceSha256 = {};
for (const path of [fixturePath, catalogPath, resolve(root, "packages/javascript/src/gradient-path.js"),
  resolve(root, "packages/javascript/src/gradient-noise-2d-01.js"), resolve(root, "packages/javascript/src/internal/noise-hash.js"),
  resolve(root, "packages/javascript/src/index.js"), resolve(root, "tests/native/gradient-path-javascript.mjs"), longCasesSourcePath]) {
  sourceSha256[path.slice(root.length + 1)] = sha256(path);
}
process.stdout.write(`${JSON.stringify({
  operation: fixture.operation, version: fixture.version,
  scope: "JavaScript portable core only; no renderer, browser/p5, Processing, py5, Android, or reproduction claim.",
  runtime: { node: process.version }, fixtureBindings, catalogSha256, fixtureSha256: sha256(fixturePath), sourceSha256,
  failures, counts, results, nativeChecks, benchmark,
}, null, 2)}\n`);
process.exitCode = failures === 0 ? 0 : 1;
