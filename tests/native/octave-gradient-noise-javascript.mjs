#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { octaveGradientNoise, OctaveGradientNoiseError } from "../../packages/javascript/src/octave-gradient-noise.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/octave-gradient-noise.json");
const FIXTURE = join(ROOT, "fixtures/operations/octave-gradient-noise.json");
const SOURCE = join(ROOT, "packages/javascript/src/octave-gradient-noise.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code = "INVALID_INPUT") => assert.throws(action, (error) => error instanceof OctaveGradientNoiseError && error.code === code);

function close(actual, expected, label) {
  assert.deepStrictEqual(actual, expected, label);
}

function checkCase(item) {
  if (item.error) return errorCode(() => octaveGradientNoise(item.input), item.error);
  close(octaveGradientNoise(item.input), item.output, item.id);
}

function ownershipAndZeroChecks(fixture) {
  const first = fixture.cases.find((item) => item.id === "two-dimensional-raw");
  const input = structuredClone(first.input);
  const result = octaveGradientNoise(input);
  const baseline = structuredClone(result);
  input.points[0][0] = 99;
  assert.deepStrictEqual(result, baseline, "input mutation cannot affect returned values");
  result.values[0] = 99;
  close(octaveGradientNoise(first.input), first.output, "returned values are not retained");
  const zeros = octaveGradientNoise({ dimension: 2, points: [[-0, -0]], seed: -0, octaves: 1, frequency: 0, lacunarity: 1, amplitude: 0, persistence: 0, normalization: "NONE", maxWork: 2 });
  assert.ok(!Object.is(zeros.values[0], -0), "completed zero is positive");
  assert.ok(!Object.is(zeros.amplitudeSum, -0), "amplitude sum zero is positive");
  return ["input/output detachment", "canonical output zeros", "fresh returned values array"];
}

function carrierAndFullValidationChecks() {
  const base = { dimension: 2, points: [[1, 2], [3, 4]], seed: 42, octaves: 2, frequency: 1, lacunarity: 2, amplitude: 1, persistence: .5, normalization: "NONE", maxWork: 6 };
  class Input {}
  errorCode(() => octaveGradientNoise(Object.assign(new Input(), base)));
  const accessor = { ...base };
  Object.defineProperty(accessor, "points", { enumerable: true, get() { return base.points; } });
  errorCode(() => octaveGradientNoise(accessor));
  const sparse = structuredClone(base);
  sparse.points[1] = new Array(2);
  errorCode(() => octaveGradientNoise(sparse));
  const extra = structuredClone(base);
  extra.points[0].extra = true;
  errorCode(() => octaveGradientNoise(extra));
  for (const invalid of [NaN, Infinity, -Infinity]) {
    errorCode(() => octaveGradientNoise({ ...base, points: [[invalid, 2], [3, 4]], maxWork: 0 }));
    errorCode(() => octaveGradientNoise({ ...base, seed: invalid }));
    errorCode(() => octaveGradientNoise({ ...base, frequency: invalid }));
    errorCode(() => octaveGradientNoise({ ...base, lacunarity: invalid }));
    errorCode(() => octaveGradientNoise({ ...base, amplitude: invalid }));
    errorCode(() => octaveGradientNoise({ ...base, persistence: invalid }));
    errorCode(() => octaveGradientNoise({ ...base, maxWork: invalid }));
  }
  errorCode(() => octaveGradientNoise({ ...base, normalization: "WEIGHT_SUM", amplitude: 0 }));
  errorCode(() => octaveGradientNoise({ ...base, dimension: 3, points: [[1, 2], [3, 4]] }));
  errorCode(() => octaveGradientNoise({ ...base, octaves: 1.5 }));
  return ["passive records and dense arrays", "NaN/Infinity rejected", "complete static validation precedes budget"];
}

function domainAndBudgetChecks() {
  const base = { dimension: 2, points: [[1, 2]], seed: 42, octaves: 1, frequency: 1, lacunarity: 1, amplitude: 1, persistence: 1, normalization: "NONE", maxWork: 2 };
  errorCode(() => octaveGradientNoise({ ...base, points: [[9007199254740991, 0]] }), "QUERY_OUT_OF_RANGE");
  errorCode(() => octaveGradientNoise({ ...base, points: [[-9007199254740992, 0]] }), "QUERY_OUT_OF_RANGE");
  errorCode(() => octaveGradientNoise({ ...base, points: [[1e308, 0]], frequency: 1e308 }), "NUMERIC_OVERFLOW");
  errorCode(() => octaveGradientNoise({ ...base, maxWork: 1 }), "WORK_LIMIT");
  return ["half-open profile domain", "query multiplication overflow", "work limit"];
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output") throw new Error("Usage: --output FRESH_JSON_PATH");
  const output = resolve(args[1]);
  if (!output.startsWith(join(ROOT, ".work") + sep) || existsSync(output)) throw new Error("Output must be fresh and under .work");
  const fixture = JSON.parse(readFileSync(FIXTURE));
  assert.equal(fixture.comparison, "exact", "fixture comparison profile");
  assert.equal(fixture.catalog_sha256, sha(CATALOG), "fixture catalog binding");
  const before = hashes();
  for (const item of fixture.cases) checkCase(item);
  const ownership = ownershipAndZeroChecks(fixture);
  const carriers = carrierAndFullValidationChecks();
  const bounds = domainAndBudgetChecks();
  const after = hashes();
  assert.deepStrictEqual(after, before, "source stability");
  const report = {
    status: "passed", operation: fixture.operation, node_version: process.version,
    scope: "Actual JS octave-gradient-noise core against frozen shared fixtures plus passive carrier, ownership, signed-zero, full-static-validation, query-domain and work-budget checks. No renderer or acceptance claim.",
    input_sha256_before: before, input_sha256_after: after,
    scenarios: { fixture_cases: fixture.cases.length, ownership_signed_zero: ownership, javascript_only: [...carriers, ...bounds] },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
