#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { fieldDisplace2D } from "../../packages/javascript/src/field-displace-2d.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/field-displace-2d.json");
const FIXTURE = join(ROOT, "fixtures/operations/field-displace-2d.json");
const SOURCE = join(ROOT, "packages/javascript/src/field-displace-2d.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code = "INVALID_INPUT") => assert.throws(action, (error) => error.code === code);

function close(actual, expected, label) {
  assert.deepStrictEqual(actual, expected, label);
}

function checkCase(item) {
  if (item.error) return errorCode(() => fieldDisplace2D(item.input), item.error);
  close(fieldDisplace2D(item.input), item.output, item.id);
}

function ownershipAndZeroChecks(fixture) {
  const first = fixture.cases.find((item) => item.id === "cartesian-channel-pairing");
  const input = structuredClone(first.input);
  const result = fieldDisplace2D(input);
  const baseline = structuredClone(result);
  input.points[0][0] = 99;
  input.samples[0][0] = 99;
  assert.deepStrictEqual(result, baseline, "input mutation cannot affect result");
  result.points[0][0] = 99;
  result.offsets[0][0] = 99;
  close(fieldDisplace2D(first.input), first.output, "returned pairs are not retained");
  const zero = fieldDisplace2D({ points: [[-0, -0]], samples: [[-0, -1]], mode: "POLAR", bias: [0, 0], gain: [1, 1], maxWork: 1 });
  for (const value of [...zero.points[0], ...zero.offsets[0]]) assert.ok(!Object.is(value, -0), "completed zero is positive");
  assert.notStrictEqual(zero.points[0], zero.offsets[0], "point and offset pairs are distinct");
  return ["input/result detachment", "fresh point and offset pairs", "canonical positive output zeros"];
}

function carrierAndFullValidationChecks() {
  const base = { points: [[1, 2], [3, 4]], samples: [[0, 0], [0, 0]], mode: "CARTESIAN", bias: [0, 0], gain: [1, 1], maxWork: 2 };
  class Input {}
  errorCode(() => fieldDisplace2D(Object.assign(new Input(), base)));
  const accessor = { ...base };
  Object.defineProperty(accessor, "points", { enumerable: true, get() { return base.points; } });
  errorCode(() => fieldDisplace2D(accessor));
  const sparse = structuredClone(base);
  sparse.points[1] = new Array(2);
  errorCode(() => fieldDisplace2D(sparse));
  const extra = structuredClone(base);
  extra.samples[0].extra = true;
  errorCode(() => fieldDisplace2D(extra));
  for (const invalid of [NaN, Infinity, -Infinity]) {
    errorCode(() => fieldDisplace2D({ ...base, points: [[invalid, 2], [3, 4]] }));
    errorCode(() => fieldDisplace2D({ ...base, samples: [[0, 0], [invalid, 0]], maxWork: 0 }));
    errorCode(() => fieldDisplace2D({ ...base, gain: [invalid, 1] }));
  }
  return ["passive records and dense arrays", "NaN/Infinity rejected", "late invalid sample precedes work budget"];
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
  const after = hashes();
  assert.deepStrictEqual(after, before, "source stability");
  const report = {
    status: "passed", operation: fixture.operation, node_version: process.version,
    scope: "Actual JS field-displace-points core against frozen shared fixtures plus carrier, ownership, signed-zero and complete-static-validation checks. No renderer or acceptance claim.",
    input_sha256_before: before, input_sha256_after: after,
    scenarios: { fixture_cases: fixture.cases.length, ownership_signed_zero: ownership, javascript_only: carriers },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
