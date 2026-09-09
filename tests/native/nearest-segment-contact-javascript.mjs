#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { nearestSegmentContact2D } from "../../packages/javascript/src/nearest-segment-contact.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/nearest-segment-contact-2d.json");
const FIXTURE = join(ROOT, "fixtures/operations/nearest-segment-contact-2d.json");
const SOURCE = join(ROOT, "packages/javascript/src/nearest-segment-contact.js");
const RATIONAL_SOURCE = join(ROOT, "packages/javascript/src/internal/exact-rational.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, RATIONAL_SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkCase(item) {
  if (!item.error) {
    const result = nearestSegmentContact2D(item.input);
    assert.deepEqual(result.toValues(), item.output, item.id);
    return result;
  }
  assert.throws(() => nearestSegmentContact2D(item.input), (error) => {
    assert.equal(error.code, item.error, item.id);
    if (item.error_details) {
      assert.equal(error.queryIndex, item.error_details.queryIndex, item.id + " queryIndex");
      assert.equal(error.stage, item.error_details.stage, item.id + " stage");
    }
    return true;
  });
  return null;
}

function ownershipChecks() {
  const config = { queries: [[0, 0, 10, 0]], obstacles: [[3, -2, 3, 2]], maxWork: 1 };
  const result = nearestSegmentContact2D(config), baseline = result.toValues();
  config.queries[0][0] = 99; config.obstacles[0][0] = 99; config.maxWork = 0;
  assert.deepEqual(result.toValues(), baseline, "input containers detached after construction");
  const detached = result.toValues();
  detached.hits[0].point[0] = 77; detached.hits[0].obstacleIndex = 99; detached.hits.length = 0;
  assert.deepEqual(result.toValues(), baseline, "export detached");
  const hitBaseline = result.hitAt(0);
  const hit = result.hitAt(0);
  hit.x = 77; hit.y = 77; hit.t = 99;
  assert.deepEqual(result.hitAt(0), hitBaseline, "hitAt result detached");
  assert.equal(result.size, baseline.hits.length);
  for (const index of [-1, true, NaN, Infinity, 0.5, "0"]) {
    errorCode(() => result.hitAt(index), "INVALID_INDEX");
  }
  for (const index of [result.size, 9007199254740992]) {
    errorCode(() => result.hitAt(index), "INDEX_OUT_OF_RANGE");
  }
  const miss = nearestSegmentContact2D({ queries: [[0, 0, 1, 1]], obstacles: [], maxWork: 0 });
  assert.equal(miss.hitAt(0), null, "explicit miss returns null");
  assert.deepEqual(miss.toValues(), { hits: [null] });
  return ["input containers detached after construction", "export/hitAt detached", "index precedence: INVALID_INDEX before INDEX_OUT_OF_RANGE", "explicit miss returns null"];
}

function nativeChecks() {
  errorCode(() => nearestSegmentContact2D(null), "INVALID_INPUT");
  errorCode(() => nearestSegmentContact2D({ queries: [], obstacles: [], maxWork: 0, extra: 1 }), "INVALID_INPUT");
  errorCode(() => nearestSegmentContact2D({ queries: [[0, 0, 1n, 1]], obstacles: [], maxWork: 0 }), "INVALID_INPUT");
  errorCode(() => nearestSegmentContact2D({ queries: [[0, 0, 1, 1]], obstacles: [[0, 0, 1]], maxWork: 0 }), "INVALID_INPUT");
  return ["non-record/extra-key/bigint-coordinate/wrong-length-row carriers"];
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
    scope: "Actual JS module fixture/carrier/ownership checks against the shared exact-rational geometry kernel. No renderer/acceptance claim.",
    input_sha256_before: before, input_sha256_after: after,
    scenarios: { fixture_cases: fixture.cases.length, ownership_access: ownership, native_only: native },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
