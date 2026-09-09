#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sequentialDiscProjection2D } from "../../packages/javascript/src/disc-projection.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/sequential-disc-projection-2d.json");
const FIXTURE = join(ROOT, "fixtures/operations/sequential-disc-projection-2d.json");
const SOURCE = join(ROOT, "packages/javascript/src/disc-projection.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkCase(item) {
  if (!item.error) {
    const result = sequentialDiscProjection2D(item.input);
    assert.deepEqual(result.toValues(), item.output, item.id);
    return result;
  }
  assert.throws(() => sequentialDiscProjection2D(item.input), (error) => {
    assert.equal(error.code, item.error, item.id);
    return true;
  });
  return null;
}

function ownershipChecks() {
  const config = { points: [[5, 0]], discs: [[0, 0, 10]], strength: 0.5, maxTests: 1 };
  const result = sequentialDiscProjection2D(config), baseline = result.toValues();
  config.points[0][0] = 99; config.discs[0][0] = 99; config.strength = 0;
  assert.deepEqual(result.toValues(), baseline, "input containers detached after construction");
  const detached = result.toValues();
  detached.points[0][0] = 77; detached.points.length = 0;
  assert.deepEqual(result.toValues(), baseline, "export detached");
  const pts = result.points(); pts[0] = 77;
  assert.deepEqual(result.points(), baseline.points.flat(), "points() detached");
  assert.equal(result.size, baseline.points.length);
  for (const out of [Array(4).fill(9), new Float64Array(4).fill(9)]) {
    result.pointInto(0, out, 1);
    assert.deepEqual(Array.from(out).slice(1, 3), baseline.points[0]);
  }
  const badOutputs = [Object.freeze([1, 2]), [1], {}, null];
  for (const out of badOutputs) errorCode(() => result.pointInto(0, out, 0), "INVALID_OUTPUT");
  for (const index of [-1, true, NaN, Infinity, 0.5, 9007199254740992, "0"]) {
    errorCode(() => result.pointInto(index, [9, 9], 0), "INVALID_INDEX");
  }
  for (const index of [result.size, Number.MAX_SAFE_INTEGER]) {
    errorCode(() => result.pointInto(index, [9, 9], 0), "INDEX_OUT_OF_RANGE");
  }
  assert.deepEqual(result.toValues(), baseline);
  return ["input containers detached", "export/points() detached", "ordinary/Float64Array Into outputs",
    "frozen/short/wrong outputs rejected", "index precedence: INVALID_INDEX before INDEX_OUT_OF_RANGE"];
}

function nativeChecks() {
  const base = { points: [[5, 0]], discs: [[0, 0, 10]], strength: 0.5, maxTests: 1 };
  errorCode(() => sequentialDiscProjection2D(null), "INVALID_INPUT");
  errorCode(() => sequentialDiscProjection2D({ ...base, extra: 1 }), "INVALID_INPUT");
  errorCode(() => sequentialDiscProjection2D({ ...base, discs: [[0, 0, -1]] }), "INVALID_INPUT");
  errorCode(() => sequentialDiscProjection2D({ ...base, strength: 1.5 }), "INVALID_INPUT");
  errorCode(() => sequentialDiscProjection2D({ ...base, maxTests: -1 }), "INVALID_INPUT");
  errorCode(() => sequentialDiscProjection2D({ ...base, points: [[0, 1n]] }), "INVALID_INPUT");
  return ["non-record/extra-key/nonpositive-radius/out-of-range-strength/negative-budget/bigint carriers"];
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
