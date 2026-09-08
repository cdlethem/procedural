import { mix32, cornerHash } from "../../packages/javascript/src/internal/noise-hash.js";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { gradientNoise2D01, GradientNoise2D01Error } from "../../packages/javascript/src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, "../../fixtures/operations/gradient-noise-2d-01.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const results = [];
const nativeChecks = [];
let failures = 0;

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

function sameNumber(actual, expected) {
  return typeof actual === "number" && typeof expected === "number" && Object.is(actual, expected);
}

function errorCode(action) {
  try {
    action();
    return null;
  } catch (error) {
    return error instanceof GradientNoise2D01Error ? error.code : `UNEXPECTED:${error?.name ?? "unknown"}`;
  }
}

for (const testCase of fixture.cases) {
  if (testCase.error) {
    const actual = errorCode(() => gradientNoise2D01(testCase.input));
    record(`constructor-${testCase.id}`, actual, testCase.error, actual === testCase.error);
    continue;
  }
  try {
    const field = gradientNoise2D01(testCase.input);
    const outputs = testCase.queries.map((query) => ({
      tuple: field.sample(query.input),
      scalars: field.sample(query.input[0], query.input[1]),
      expected: query.output,
    }));
    const samplesPass = outputs.every((output) =>
      sameNumber(output.tuple, output.expected) && sameNumber(output.scalars, output.expected));
    const serialized = field.serialize();
    const serializedPass = JSON.stringify(serialized) === JSON.stringify(testCase.serialized) &&
      JSON.stringify(field) === JSON.stringify(testCase.serialized);
    record(testCase.id, { outputs, serialized }, { outputs: testCase.queries, serialized: testCase.serialized },
      samplesPass && serializedPass);
  } catch (error) {
    record(testCase.id, `UNEXPECTED:${error?.code ?? error?.name ?? "unknown"}`, testCase.queries, false);
  }
}

for (const vector of fixture.mix_vectors) {
  const actual = mix32(vector.input);
  record(`mix-${vector.input}`, actual, vector.output, sameNumber(actual, vector.output));
}
for (const vector of fixture.corner_vectors) {
  const actual = cornerHash(vector.seed, vector.i, vector.j);
  record(`corner-${vector.seed}-${vector.i}-${vector.j}`, actual, vector.output, sameNumber(actual, vector.output));
}

const queryField = gradientNoise2D01({ seed: 42 });
for (const testCase of fixture.query_cases) {
  const actual = errorCode(() => queryField.sample(testCase.input));
  record(`query-${testCase.id}`, actual, testCase.error, actual === testCase.error);
}

native("constructor-and-query-nonfinite", () =>
  errorCode(() => gradientNoise2D01({ seed: NaN })) === "INVALID_INPUT" &&
  errorCode(() => queryField.sample(NaN, 0)) === "INVALID_QUERY" &&
  errorCode(() => queryField.sample(0, Infinity)) === "INVALID_QUERY" &&
  errorCode(() => queryField.sample([0, -Infinity])) === "INVALID_QUERY");

native("tuple-shape-and-data", () =>
  errorCode(() => queryField.sample([0, 0, 0])) === "INVALID_QUERY" &&
  errorCode(() => queryField.sample([0])) === "INVALID_QUERY" &&
  errorCode(() => queryField.sample([0, true])) === "INVALID_QUERY" &&
  errorCode(() => queryField.sample([0, ,])) === "INVALID_QUERY" &&
  errorCode(() => queryField.sample({ 0: 0, 1: 0, length: 2 })) === "INVALID_QUERY");

native("immutable-seed-only-and-positive-zero-serialization", () => {
  const input = { seed: 42 };
  const field = gradientNoise2D01(input);
  const before = field.sample(0.25, 0.75);
  input.seed = 1;
  const serialized = field.serialize();
  serialized.seed = 1;
  const negativeZero = gradientNoise2D01({ seed: -0 });
  return Object.isFrozen(field) && sameNumber(before, field.sample(0.25, 0.75)) &&
    field.serialize().seed === 42 && Object.is(negativeZero.serialize().seed, 0) &&
    !Object.is(negativeZero.serialize().seed, -0);
});

native("repeated-and-interleaved-samples", () => {
  const zero = gradientNoise2D01({ seed: 0 });
  const one = gradientNoise2D01({ seed: 1 });
  const fortyTwo = gradientNoise2D01({ seed: 42 });
  const a = zero.sample(0.25, 0.75);
  const b = one.sample(-0.25, 0.75);
  const c = fortyTwo.sample(0.1, 0.2);
  return sameNumber(a, zero.sample(0.25, 0.75)) &&
    sameNumber(b, one.sample([-0.25, 0.75])) && sameNumber(c, fortyTwo.sample(0.1, 0.2));
});

const benchmarkField = gradientNoise2D01({ seed: 42 });
function benchmarkQueries() {
  let checksum = 0;
  for (let index = 0; index < 250_000; index += 1) {
    const x = index * 0.001;
    const y = index * 0.002;
    checksum += benchmarkField.sample(x, y);
  }
  return checksum;
}

benchmarkQueries();
benchmarkQueries();
const started = performance.now();
const checksum = benchmarkQueries();
const elapsedMs = performance.now() - started;
const benchmark = {
  scalarQueries: 250000,
  queryForm: "sample(x, y)",
  tupleAllocation: "none in timed loop",
  warmupTraversals: 2,
  timedTraversals: 1,
  checksum,
  elapsedMs,
};
record("performance-250000-scalar-queries", benchmark, { scalarQueries: 250000, checksum: 123399.9596239042 },
  benchmark.scalarQueries === 250000 && checksum === 123399.9596239042);

const counts = {
  fixtureCases: fixture.cases.length,
  mixVectors: fixture.mix_vectors.length,
  cornerVectors: fixture.corner_vectors.length,
  fixtureSamples: fixture.cases.reduce((total, testCase) => total + (testCase.queries?.length ?? 0), 0),
  queryErrorCases: fixture.query_cases.length,
  nativeChecks: nativeChecks.length,
  resultChecks: results.length,
};
process.stdout.write(`${JSON.stringify({ operation: fixture.operation, version: fixture.version, runtime: { node: process.version }, failures, counts, results, nativeChecks, benchmark }, null, 2)}\n`);
process.exitCode = failures === 0 ? 0 : 1;
