#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { radialPull2D } from "../../packages/javascript/src/radial-pull.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/radial-pull-2d.json");
const FIXTURE = join(ROOT, "fixtures/operations/radial-pull-2d.json");
const SOURCE = join(ROOT, "packages/javascript/src/radial-pull.js");
const POW_SOURCE = join(ROOT, "packages/javascript/src/internal/fdlibm-pow.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, POW_SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkCreationCase(item) {
  if (!item.error) {
    const field = radialPull2D(item.input);
    assert.deepEqual(field.serialize(), item.serialized, item.id);
    for (const query of item.queries) {
      assert.deepEqual(field.transform(query.input), query.output, item.id + " " + JSON.stringify(query.input));
    }
    return field;
  }
  assert.throws(() => radialPull2D(item.input), (error) => {
    assert.equal(error.code, item.error, item.id);
    return true;
  });
  return null;
}

function checkQueryCase(item, field) {
  assert.throws(() => field.transform(item.input), (error) => {
    assert.equal(error.code, item.error, item.id);
    return true;
  });
}

function ownershipChecks() {
  const config = { influences: [[0, 0, 10, 2]] };
  const field = radialPull2D(config);
  config.influences[0][0] = 99; config.influences.push([1, 1, 1, 1]);
  assert.deepEqual(field.serialize(), { influences: [[0, 0, 10, 2]] }, "input record detached after construction");
  const query = [5, 0];
  const before = field.transform(query);
  query[0] = 99;
  assert.deepEqual(field.transform([5, 0]), before, "query array not retained");
  assert.equal(field.influenceCount, 1);
  const target = [9, 9];
  field.transformInto(5, 0, target);
  assert.deepEqual(target, before);
  return ["input containers detached after construction", "query array not retained", "transformInto matches transform"];
}

function nativeChecks() {
  errorCode(() => radialPull2D(null), "INVALID_INPUT");
  errorCode(() => radialPull2D({ influences: [], extra: 1 }), "INVALID_INPUT");
  errorCode(() => radialPull2D({ influences: [[0, 0, 1, 1n]] }), "INVALID_INPUT");
  const field = radialPull2D({ influences: [[0, 0, 10, 2]] });
  errorCode(() => field.transform({}), "INVALID_QUERY");
  errorCode(() => field.transform([0]), "INVALID_QUERY");
  errorCode(() => field.transformInto(0, 0, [1]), "INVALID_QUERY");
  return ["non-record/bigint-coordinate carriers", "wrong-shape query tuples"];
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output") throw new Error("Usage: --output FRESH_JSON_PATH");
  const output = resolve(args[1]);
  if (!output.startsWith(join(ROOT, ".work") + sep) || existsSync(output)) throw new Error("Output must be fresh and under .work");
  const fixture = JSON.parse(readFileSync(FIXTURE));
  assert.equal(fixture.catalog_sha256, sha(CATALOG), "fixture catalog binding");
  const before = hashes();
  let sampleField = null;
  for (const item of fixture.cases) {
    const field = checkCreationCase(item);
    if (field) sampleField = field;
  }
  for (const item of fixture.query_cases) checkQueryCase(item, sampleField);
  const ownership = ownershipChecks(), native = nativeChecks();
  const after = hashes();
  assert.deepEqual(after, before, "source stability");
  const report = {
    status: "passed", operation: fixture.operation, node_version: process.version,
    scope: "Actual JS module fixture/carrier/ownership checks against a bit-exact fdlibm pow/hypot port. No renderer/acceptance claim.",
    input_sha256_before: before, input_sha256_after: after,
    scenarios: {
      creation_cases: fixture.cases.length, query_cases: fixture.query_cases.length,
      ownership_access: ownership, native_only: native,
    },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
