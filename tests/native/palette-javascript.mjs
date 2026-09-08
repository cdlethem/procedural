import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { cyclicPalette, CyclicPaletteError } from "../../packages/javascript/src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, "../../fixtures/operations/cyclic-palette.json");
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
    return error instanceof CyclicPaletteError ? error.code : `UNEXPECTED:${error?.name ?? "unknown"}`;
  }
}

for (const testCase of fixture.cases) {
  if (testCase.error) {
    const actual = errorCode(() => cyclicPalette(testCase.input));
    record(`constructor-${testCase.id}`, actual, testCase.error, actual === testCase.error);
    continue;
  }
  try {
    const palette = cyclicPalette(testCase.input);
    const outputs = testCase.queries.map((query) => ({
      input: query.input,
      actual: palette.sample(query.input),
      expected: query.output,
    }));
    const samplesPass = outputs.every((result) => sameNumber(result.actual, result.expected));
    const serialized = palette.serialize();
    const serializationPass = JSON.stringify(serialized) === JSON.stringify(testCase.serialized) &&
      JSON.stringify(palette) === JSON.stringify(testCase.serialized);
    record(testCase.id, { outputs, serialized }, { queries: testCase.queries, serialized: testCase.serialized },
      samplesPass && serializationPass);
  } catch (error) {
    record(testCase.id, `UNEXPECTED:${error?.code ?? error?.name ?? "unknown"}`, testCase.queries, false);
  }
}

const queryPalette = cyclicPalette({ colors: [0x31A151, 0xFFA71E, 0x05084C, 0xDE4638, 0x3DBDB7] });
for (const testCase of fixture.query_cases) {
  const actual = errorCode(() => queryPalette.sample(testCase.input));
  record(`query-${testCase.id}`, actual, testCase.error, actual === testCase.error);
}

native("passive-own-data-only", () => {
  const hidden = { colors: [0] };
  Object.defineProperty(hidden, "hidden", { value: 1 });
  const symbol = { colors: [0], [Symbol("extra")]: 1 };
  const accessor = {};
  Object.defineProperty(accessor, "colors", { get: () => [0] });
  const extraArrayEntry = { colors: [0] };
  Object.defineProperty(extraArrayEntry.colors, "extra", { value: 1 });
  const sparseArray = { colors: new Array(1) };
  return errorCode(() => cyclicPalette(hidden)) === "INVALID_INPUT" &&
    errorCode(() => cyclicPalette(symbol)) === "INVALID_INPUT" &&
    errorCode(() => cyclicPalette(accessor)) === "INVALID_INPUT" &&
    errorCode(() => cyclicPalette(extraArrayEntry)) === "INVALID_INPUT" &&
    errorCode(() => cyclicPalette(sparseArray)) === "INVALID_INPUT";
});

native("nonfinite-entries-and-queries", () =>
  errorCode(() => cyclicPalette({ colors: [NaN] })) === "INVALID_INPUT" &&
  errorCode(() => cyclicPalette({ colors: [Infinity] })) === "INVALID_INPUT" &&
  errorCode(() => cyclicPalette({ colors: [-Infinity] })) === "INVALID_INPUT" &&
  errorCode(() => queryPalette.sample(NaN)) === "INVALID_QUERY" &&
  errorCode(() => queryPalette.sample(Infinity)) === "INVALID_QUERY" &&
  errorCode(() => queryPalette.sample(-Infinity)) === "INVALID_QUERY");

native("input-and-serialization-ownership", () => {
  const colors = [-0, 0x112233, 0xabcdef];
  const input = { colors };
  const palette = cyclicPalette(input);
  const before = palette.sample(0.25);
  colors[0] = 0xffffff;
  input.colors = [0xffffff];
  const serialized = palette.serialize();
  serialized.colors[1] = 0;
  return Object.isFrozen(palette) && sameNumber(before, palette.sample(0.25)) &&
    Object.is(palette.serialize().colors[0], 0) && !Object.is(palette.serialize().colors[0], -0) &&
    palette.serialize().colors[1] === 0x112233;
});

native("single-palette-validates-every-query", () => {
  const single = cyclicPalette({ colors: [0x123456] });
  return fixture.query_cases.every((testCase) =>
    errorCode(() => single.sample(testCase.input)) === testCase.error) &&
    errorCode(() => single.sample(NaN)) === "INVALID_QUERY" &&
    sameNumber(single.sample(-0), 0x123456);
});

native("positive-zero-output-and-native-arity", () => {
  const black = cyclicPalette({ colors: [-0] });
  return Object.is(black.sample(0), 0) && !Object.is(black.sample(0), -0) &&
    errorCode(() => black.sample()) === "UNEXPECTED:TypeError" &&
    errorCode(() => black.sample(0, 1)) === "UNEXPECTED:TypeError";
});

native("repeated-and-interleaved-samples", () => {
  const first = cyclicPalette({ colors: [0, 0xff0000, 0xffffff] });
  const second = cyclicPalette({ colors: [0x010203, 0xabcdef] });
  const a = first.sample(-0.25);
  const b = second.sample(0.25);
  const c = first.sample(0.9999999999999999);
  return a === first.sample(-0.25) && b === second.sample(0.25) &&
    c === first.sample(0.9999999999999999);
});

const benchmarkPalette = cyclicPalette({ colors: [0x31A151, 0xFFA71E, 0x05084C, 0xDE4638, 0x3DBDB7] });
function benchmarkQueries() {
  let checksum = 0;
  for (let index = 0; index < 250_000; index += 1) {
    checksum += benchmarkPalette.sample(index * 0.001);
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
  palette: [0x31A151, 0xFFA71E, 0x05084C, 0xDE4638, 0x3DBDB7],
  phase: "i * 0.001",
  warmupTraversals: 2,
  timedTraversals: 1,
  checksum,
  elapsedMs,
};
record("performance-250000-scalar-queries", benchmark,
  { scalarQueries: 250000, checksum: "reported for cross-target comparison" },
  benchmark.scalarQueries === 250000 && Number.isFinite(checksum) && Number.isFinite(elapsedMs) && elapsedMs >= 0);

const counts = {
  fixtureCases: fixture.cases.length,
  fixtureSamples: fixture.cases.reduce((total, testCase) => total + (testCase.queries?.length ?? 0), 0),
  constructorErrorCases: fixture.cases.filter((testCase) => testCase.error).length,
  queryErrorCases: fixture.query_cases.length,
  oracleIndexVectorsNotNativeTested: fixture.index_vectors.length,
  nativeChecks: nativeChecks.length,
  resultChecks: results.length,
};
process.stdout.write(`${JSON.stringify({ operation: fixture.operation, version: fixture.version, runtime: { node: process.version }, failures, counts, results, nativeChecks, benchmark }, null, 2)}\n`);
process.exitCode = failures === 0 ? 0 : 1;
