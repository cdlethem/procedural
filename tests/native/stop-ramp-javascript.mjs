#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { stopRamp } from "../../packages/javascript/src/stop-ramp.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/stop-ramp.json");
const FIXTURE = join(ROOT, "fixtures/operations/stop-ramp.json");
const SOURCE = join(ROOT, "packages/javascript/src/stop-ramp.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkCase(item) {
  if (item.error) {
    assert.throws(() => stopRamp(item.input), (error) => {
      assert.equal(error.code, item.error, item.id);
      return true;
    });
    return null;
  }
  const ramp = stopRamp(item.input);
  assert.deepStrictEqual(ramp.serialize(), item.serialized, item.id);
  for (const query of item.queries) {
    assert.equal(ramp.sample(query.input), query.output, item.id + " query " + query.input);
  }
  return ramp;
}

function checkQueryCases(fixture, baseRamp) {
  for (const item of fixture.query_cases) {
    assert.throws(() => baseRamp.sample(item.input), (error) => {
      assert.equal(error.code, item.error, item.id);
      return true;
    });
  }
  return fixture.query_cases.length;
}

function ownershipChecks(baseRamp) {
  const config = { stops: [{ position: 0.25, color: 0xff0000 }, { position: 0.75, color: 0x0000ff }] };
  const ramp = stopRamp(config);
  const baseline = ramp.serialize();
  config.stops[0].position = 0.99;
  config.stops.push({ position: 0.9, color: 1 });
  assert.deepStrictEqual(ramp.serialize(), baseline, "input detachment");
  const exported = ramp.serialize();
  exported.stops[0].position = 0.01;
  exported.stops.push({ position: 0.5, color: 9 });
  assert.deepStrictEqual(ramp.serialize(), baseline, "export detachment");
  assert.equal(ramp.sample(0), 0xff0000);
  assert.equal(ramp.sample(1), 0x0000ff);
  return ["input containers detached", "serialize export detached"];
}

function nativeChecks() {
  const base = { stops: [{ position: 0, color: 0 }, { position: 1, color: 0xffffff }] };
  for (const value of [NaN, Infinity, -Infinity]) {
    errorCode(() => stopRamp({ stops: [{ position: value, color: 0 }, base.stops[1]] }), "INVALID_INPUT");
    errorCode(() => stopRamp({ stops: [{ position: 0, color: value }, base.stops[1]] }), "INVALID_INPUT");
  }
  class Config {}
  class Pair extends Array {}
  for (const input of [
    Object.assign(new Config(), base),
    { stops: new Pair({ position: 0, color: 0 }, { position: 1, color: 1 }) },
    { stops: [new Config(), base.stops[1]] },
  ]) {
    errorCode(() => stopRamp(input), "INVALID_INPUT");
  }
  assert.deepStrictEqual(stopRamp(Object.assign(Object.create(null), base)).serialize(), stopRamp(base).serialize());
  return ["nonfinite-and-overflowing-numeric-carriers (JavaScript applicable carriers)", "passive-input-carriers-only"];
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output") throw new Error("Usage: --output FRESH_JSON_PATH");
  const output = resolve(args[1]);
  if (!output.startsWith(join(ROOT, ".work") + sep) || existsSync(output)) throw new Error("Output must be fresh and under .work");
  const fixture = JSON.parse(readFileSync(FIXTURE));
  assert.equal(fixture.catalog_sha256, sha(CATALOG), "fixture catalog binding");
  const before = hashes();
  let baseRamp = null;
  for (const item of fixture.cases) {
    const ramp = checkCase(item);
    if (ramp && baseRamp === null) baseRamp = ramp;
  }
  const queryCasesExecuted = checkQueryCases(fixture, baseRamp);
  const ownership = ownershipChecks(baseRamp);
  const native = nativeChecks();
  const after = hashes();
  assert.deepEqual(after, before, "source stability");
  const report = {
    status: "passed",
    operation: fixture.operation,
    node_version: process.version,
    scope: "Actual JS module golden, query, carrier and access checks against the frozen stop-ramp fixtures. No renderer/acceptance claim.",
    input_sha256_before: before,
    input_sha256_after: after,
    scenarios: {
      fixture_cases: fixture.cases.length,
      query_cases: queryCasesExecuted,
      ownership_access: ownership,
      native_only: native,
    },
    allocation_failure: { executed: false, source_review: "Output exports allocate detached arrays and do not mutate retained private arrays; a failed generation exposes no result. No controlled host allocation failure injected." },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
