#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { closedSpline2D } from "../../packages/javascript/src/closed-spline.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/closed-spline-2d.json");
const FIXTURE = join(ROOT, "fixtures/operations/closed-spline-2d.json");
const SOURCE = join(ROOT, "packages/javascript/src/closed-spline.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkQuery(spline, entry, id) {
  const result = spline.sample(entry.input);
  assert.deepStrictEqual(result, entry.output, id);
}

function checkCase(item) {
  if (item.error) {
    assert.throws(() => closedSpline2D(item.input), (error) => {
      assert.equal(error.code, item.error, item.id);
      return true;
    });
    return null;
  }
  const spline = closedSpline2D(item.input);
  assert.deepStrictEqual(spline.serialize(), item.serialized, item.id);
  assert.equal(spline.length, item.metadata.length, item.id);
  assert.equal(spline.controlCount, item.metadata.controlCount, item.id);
  assert.equal(spline.subdivisions, item.metadata.subdivisions, item.id);
  assert.ok(Object.is(spline.length, item.metadata.length), item.id + " length sign");
  for (const query of item.queries) checkQuery(spline, query, item.id);
  return spline;
}

function checkQueryCases(fixture, baseSpline) {
  for (const item of fixture.query_cases) {
    assert.throws(() => baseSpline.sample(item.input), (error) => {
      assert.equal(error.code, item.error, item.id);
      return true;
    });
  }
  return fixture.query_cases.length;
}

function ownershipChecks(baseSpline) {
  const config = { controls: [[0, 0], [2, 0], [2, 2], [0, 2]], subdivisions: 2 };
  const spline = closedSpline2D(config);
  const baseline = spline.serialize();
  config.controls[0][0] = 99;
  config.controls.push([9, 9]);
  config.subdivisions = 999;
  assert.deepStrictEqual(spline.serialize(), baseline, "input detachment");
  const exported = spline.serialize();
  exported.controls[0][0] = 77;
  exported.subdivisions = 77;
  assert.deepStrictEqual(spline.serialize(), baseline, "export detachment");

  const target = [9, 9, 9, 9];
  const returned = spline.sampleParameterInto(0, target);
  assert.equal(returned, target, "sampleParameterInto returns target");
  assert.deepStrictEqual(target, [0, 0, 1, -1], "sampleParameterInto values");
  const dtarget = [9, 9, 9, 9];
  spline.sampleDistanceInto(0, dtarget);
  assert.deepStrictEqual(dtarget, [0, 0, 1, -1], "sampleDistanceInto values");

  class ReadOnlyArray extends Array {}
  const mixed = [9, 9, 9, 9];
  Object.defineProperty(mixed, "1", { writable: false });
  const badOutputs = [mixed, Object.freeze([1, 2, 3, 4]), [1, 2, 3], [1, 2, 3, 4, 5],
    new Float32Array(4), new Int32Array(4), {}, null];
  for (const out of badOutputs) {
    const before = out === null ? null : Object.getOwnPropertyDescriptors(out);
    errorCode(() => spline.sampleParameterInto(0, out), "INVALID_QUERY");
    errorCode(() => spline.sampleDistanceInto(0, out), "INVALID_QUERY");
    assert.deepStrictEqual(out === null ? null : Object.getOwnPropertyDescriptors(out), before, "atomic on invalid target");
  }
  for (const value of [NaN, Infinity, -Infinity, null, undefined, "0", true]) {
    errorCode(() => spline.sampleParameterInto(value, [0, 0, 0, 0]), "INVALID_QUERY");
    errorCode(() => spline.sampleDistanceInto(value, [0, 0, 0, 0]), "INVALID_QUERY");
  }
  const okOutputs = [[9, 9, 9, 9], new Float64Array(4), new ReadOnlyArray(9, 9, 9, 9)];
  for (const out of okOutputs) {
    assert.equal(spline.sampleParameterInto(0, out), out);
    assert.deepStrictEqual(Array.from(out), [0, 0, 1, -1]);
  }
  return ["input containers detached", "serialize export detached", "Into atomic on invalid target/value",
    "Into accepts ordinary array and Float64Array", "Into returns target"];
}

function nativeChecks() {
  const base = { controls: [[0, 0], [2, 0], [2, 2], [0, 2]], subdivisions: 1 };
  for (const value of [NaN, Infinity, -Infinity]) {
    for (const axis of [0, 1]) {
      const controls = base.controls.map((pair) => [pair[0], pair[1]]);
      controls[0][axis] = value;
      errorCode(() => closedSpline2D({ controls, subdivisions: base.subdivisions }), "INVALID_INPUT");
    }
    errorCode(() => closedSpline2D({ controls: base.controls, subdivisions: value }), "INVALID_INPUT");
  }
  class Config {}
  class Pair extends Array {}
  for (const input of [
    Object.assign(new Config(), base),
    { controls: [new Float64Array([0, 0]), [2, 0], [2, 2], [0, 2]], subdivisions: 1 },
    { controls: [[0, 0], new Pair(2, 0), [2, 2], [0, 2]], subdivisions: 1 },
    { controls: base.controls, subdivisions: 1n },
    { controls: base.controls, subdivisions: new Number(1) },
  ]) {
    errorCode(() => closedSpline2D(input), "INVALID_INPUT");
  }
  assert.deepStrictEqual(closedSpline2D(Object.assign(Object.create(null), base)).serialize(),
    closedSpline2D(base).serialize());
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
  let baseSpline = null;
  for (const item of fixture.cases) {
    const spline = checkCase(item);
    if (spline && baseSpline === null) baseSpline = spline;
  }
  const queryCasesExecuted = checkQueryCases(fixture, baseSpline);
  const ownership = ownershipChecks(baseSpline);
  const native = nativeChecks();
  const after = hashes();
  assert.deepEqual(after, before, "source stability");
  const report = {
    status: "passed",
    operation: fixture.operation,
    node_version: process.version,
    scope: "Actual JS module golden, query, carrier and access checks against the frozen closed-spline-2d fixtures, using a bit-exact ported fdlibm5.3 hypot verified against java.lang.StrictMath.hypot. No renderer/acceptance claim.",
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
