#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gradientNoise3D01 } from "../../packages/javascript/src/gradient-noise-3d-01.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/gradient-noise-3d-01.json");
const FIXTURE = join(ROOT, "fixtures/operations/gradient-noise-3d-01.json");
const SOURCE = join(ROOT, "packages/javascript/src/gradient-noise-3d-01.js");
const HASH_SOURCE = join(ROOT, "packages/javascript/src/internal/noise-hash.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, HASH_SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkCreationCase(item) {
  if (!item.error) {
    const field = gradientNoise3D01(item.input);
    assert.deepEqual(field.serialize(), item.serialized, item.id);
    for (const query of item.queries) {
      assert.equal(field.sample(query.input), query.output, item.id + " " + JSON.stringify(query.input));
      assert.equal(field.sample(query.input[0], query.input[1], query.input[2]), query.output, item.id + " scalar form");
    }
    return field;
  }
  assert.throws(() => gradientNoise3D01(item.input), (error) => {
    assert.equal(error.code, item.error, item.id);
    return true;
  });
  return null;
}

function checkQueryCase(item, field) {
  assert.throws(() => field.sample(item.input), (error) => {
    assert.equal(error.code, item.error, item.id);
    return true;
  });
}

function ownershipChecks() {
  const params = { seed: 42 };
  const field = gradientNoise3D01(params);
  params.seed = 0;
  assert.deepEqual(field.serialize(), { seed: 42 }, "input record detached after construction");
  assert.deepEqual(field.serialize(), field.toJSON());
  assert.throws(() => { field.sample = null; }, TypeError, "field is frozen");

  const query = [1.5, 2.5, 3.5];
  const scalarValue = field.sample(1.5, 2.5, 3.5);
  const tupleValue = field.sample(query);
  assert.equal(scalarValue, tupleValue, "scalar and tuple forms agree");
  query[0] = 99;
  assert.equal(field.sample([1.5, 2.5, 3.5]), tupleValue, "query array not retained");
  return ["field frozen and seed-only serialize detached", "scalar/tuple call forms agree", "query array not retained"];
}

function nativeChecks() {
  errorCode(() => gradientNoise3D01(null), "INVALID_INPUT");
  errorCode(() => gradientNoise3D01({ seed: 42n }), "INVALID_INPUT");
  const field = gradientNoise3D01({ seed: 42 });
  errorCode(() => field.sample({}), "INVALID_QUERY");
  errorCode(() => field.sample([0, 0]), "INVALID_QUERY");
  errorCode(() => field.sample([0, 0, 0, 0]), "INVALID_QUERY");
  errorCode(() => field.sample([0, 0, true]), "INVALID_QUERY");
  errorCode(() => field.sample([0, null, 0]), "INVALID_QUERY");
  errorCode(() => field.sample(["0", 0, 0]), "INVALID_QUERY");
  assert.throws(() => field.sample(1, 2), TypeError, "wrong arity throws");
  return ["non-record/bigint seed carriers", "wrong-shape/length/typed query tuples", "wrong-arity sample() call"];
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
    if (field && item.id === "seed-42") sampleField = field;
  }
  for (const item of fixture.query_cases) checkQueryCase(item, sampleField ?? gradientNoise3D01({ seed: 42 }));
  const ownership = ownershipChecks(), native = nativeChecks();
  const after = hashes();
  assert.deepEqual(after, before, "source stability");
  const report = {
    status: "passed", operation: fixture.operation, node_version: process.version,
    scope: "Actual JS module fixture/carrier/ownership checks. No renderer/acceptance claim.",
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
