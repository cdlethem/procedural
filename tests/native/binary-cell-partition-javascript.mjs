#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { binaryCellPartition2D } from "../../packages/javascript/src/binary-cell-partition.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/binary-cell-partition-2d.json");
const FIXTURE = join(ROOT, "fixtures/operations/binary-cell-partition-2d.json");
const SOURCE = join(ROOT, "packages/javascript/src/binary-cell-partition.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkCase(item) {
  if (!item.error) {
    const result = binaryCellPartition2D(item.input);
    assert.deepEqual(result.toValues(), item.output, item.id);
    return result;
  }
  assert.throws(() => binaryCellPartition2D(item.input), (error) => {
    assert.equal(error.code, item.error, item.id);
    return true;
  });
  return null;
}

function ownershipChecks() {
  const config = { seed: 42, columns: 8, rows: 8, attempts: 6, axisPolicy: "RANDOM" };
  const result = binaryCellPartition2D(config), baseline = result.toValues();
  config.seed = 0; config.columns = 1; config.rows = 1; config.attempts = 0; config.axisPolicy = "LONGEST";
  assert.deepEqual(result.toValues(), baseline, "input record detached after construction");
  result.boundsAt(0).fill(77);
  const detached = result.toValues();
  detached.bounds[0].fill(77); detached.bounds.length = 0; detached.splits = 99;
  assert.deepEqual(result.toValues(), baseline, "export detached; boundsAt copy detached");
  assert.equal(result.size, baseline.bounds.length);
  assert.equal(result.splits, baseline.splits);

  for (const out of [Array(4).fill(9), new Int32Array(4).fill(9)]) {
    assert.equal(result.boundsInto(0, out), out);
    assert.deepEqual(Array.from(out), baseline.bounds[0]);
  }
  const frozen = Object.freeze([9, 9, 9, 9]);
  const badOutputs = [frozen, [1, 2, 3], new Float64Array(4), {}, null];
  for (const out of badOutputs) {
    errorCode(() => result.boundsInto(0, out), "INVALID_OUTPUT");
  }
  for (const index of [-1, true, NaN, Infinity, 0.5, 9007199254740992, 1n, "0"]) {
    for (const access of [() => result.boundsAt(index), () => result.boundsInto(index, [9, 9, 9, 9])]) {
      errorCode(access, "INVALID_INDEX");
    }
  }
  for (const index of [result.size, Number.MAX_SAFE_INTEGER]) {
    for (const access of [() => result.boundsAt(index), () => result.boundsInto(index, [9, 9, 9, 9])]) {
      errorCode(access, "INDEX_OUT_OF_RANGE");
    }
  }
  assert.deepEqual(result.toValues(), baseline);
  return ["input record detached after construction", "boundsAt/export detached", "ordinary/Int32Array outputs",
    "frozen/short/wrong-typed outputs rejected", "index precedence: INVALID_INDEX before INDEX_OUT_OF_RANGE"];
}

function nativeChecks() {
  const base = { seed: 42, columns: 8, rows: 8, attempts: 6, axisPolicy: "RANDOM" };
  for (const value of [NaN, Infinity, -Infinity, 1.5, true]) {
    for (const key of ["seed", "columns", "rows", "attempts"]) {
      errorCode(() => binaryCellPartition2D({ ...base, [key]: value }), "INVALID_INPUT");
    }
  }
  errorCode(() => binaryCellPartition2D({ ...base, seed: 42n }), "INVALID_INPUT");
  errorCode(() => binaryCellPartition2D({ ...base, axisPolicy: "random" }), "INVALID_INPUT");
  errorCode(() => binaryCellPartition2D({ ...base, extra: 1 }), "INVALID_INPUT");
  errorCode(() => binaryCellPartition2D(null), "INVALID_INPUT");
  errorCode(() => binaryCellPartition2D([1, 2, 3, 4, 5]), "INVALID_INPUT");
  return ["nonfinite/fractional/boolean/bigint carriers", "unknown axisPolicy", "extra/missing keys", "non-record input"];
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output") throw new Error("Usage: --output FRESH_JSON_PATH");
  const output = resolve(args[1]);
  if (!output.startsWith(join(ROOT, ".work") + sep) || existsSync(output)) throw new Error("Output must be fresh and under .work");
  const fixture = JSON.parse(readFileSync(FIXTURE));
  assert.equal(fixture.catalog_sha256, sha(CATALOG), "fixture catalog binding");
  const before = hashes();
  for (const item of fixture.cases) checkCase(item);
  const ownership = ownershipChecks(), native = nativeChecks();
  const after = hashes();
  assert.deepEqual(after, before, "source stability");
  const report = {
    status: "passed", operation: fixture.operation, node_version: process.version,
    scope: "Actual JS module fixture/carrier/ownership checks. No renderer/acceptance claim.",
    input_sha256_before: before, input_sha256_after: after,
    scenarios: { fixture_cases: fixture.cases.length, ownership_access: ownership, native_only: native },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
