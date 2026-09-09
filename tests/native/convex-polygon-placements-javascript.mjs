#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { orderedConvexPolygonFilter2D } from "../../packages/javascript/src/convex-polygon-placements.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/ordered-convex-polygon-filter-2d.json");
const FIXTURE = join(ROOT, "fixtures/operations/ordered-convex-polygon-filter-2d.json");
const SOURCE = join(ROOT, "packages/javascript/src/convex-polygon-placements.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkCase(item) {
  if (!item.error) {
    const result = orderedConvexPolygonFilter2D(item.input);
    assert.deepEqual(result.toValues(), item.output, item.id);
    return result;
  }
  assert.throws(() => orderedConvexPolygonFilter2D(item.input), (error) => {
    assert.equal(error.code, item.error, item.id);
    if (item.candidateIndex !== undefined) assert.equal(error.candidateIndex, item.candidateIndex, item.id + " candidateIndex");
    return true;
  });
  return null;
}

function ownershipChecks() {
  const config = { polygons: [[[0, 0], [4, 0], [4, 4], [0, 4]], [[10, 10], [14, 10], [14, 14]]] };
  const result = orderedConvexPolygonFilter2D(config), baseline = result.toValues();
  config.polygons[0][0][0] = 99; config.polygons.push([[1, 1], [2, 1], [2, 2]]);
  assert.deepEqual(result.toValues(), baseline, "input record detached after construction");
  const detached = result.toValues();
  detached.polygons[0][0][0] = 77; detached.polygons.length = 0; detached.sourceIndices.length = 0;
  assert.deepEqual(result.toValues(), baseline, "export detached");
  assert.equal(result.size, baseline.polygons.length);
  assert.equal(result.attempts, baseline.attempts);
  assert.equal(result.sourceIndexAt(0), baseline.sourceIndices[0]);
  assert.equal(result.vertexCountAt(0), baseline.polygons[0].length);
  assert.equal(result.xAt(0, 0), baseline.polygons[0][0][0]);
  assert.equal(result.yAt(0, 0), baseline.polygons[0][0][1]);
  for (const index of [-1, true, NaN, Infinity, 0.5, "0", result.size]) {
    for (const access of [() => result.sourceIndexAt(index), () => result.vertexCountAt(index),
      () => result.xAt(index, 0), () => result.yAt(index, 0)]) {
      errorCode(access, "INDEX_OUT_OF_RANGE");
    }
  }
  for (const index of [-1, true, NaN, 0.5, "0", result.vertexCountAt(0)]) {
    errorCode(() => result.xAt(0, index), "INDEX_OUT_OF_RANGE");
  }
  assert.deepEqual(result.toValues(), baseline);
  return ["input containers detached", "export detached", "accessors return baseline values", "all index domains rejected with INDEX_OUT_OF_RANGE"];
}

function nativeChecks() {
  errorCode(() => orderedConvexPolygonFilter2D(null), "INVALID_INPUT");
  errorCode(() => orderedConvexPolygonFilter2D({ polygons: [], extra: 1 }), "INVALID_INPUT");
  errorCode(() => orderedConvexPolygonFilter2D({ polygons: "nope" }), "INVALID_INPUT");
  errorCode(() => orderedConvexPolygonFilter2D({ polygons: [[[0, 0], [1, 0]]] }), "INVALID_INPUT");
  errorCode(() => orderedConvexPolygonFilter2D({ polygons: [[[0, 0], [1, 0], [1, 1n]]] }), "INVALID_INPUT");
  errorCode(() => orderedConvexPolygonFilter2D({ polygons: [[[0, 0], [3, 0], [1, 1], [0, 3]]] }), "INVALID_POLYGON");
  return ["non-record/extra-key/non-array/too-few-vertices/bigint-coordinate carriers", "concave polygon rejected"];
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
