#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { seededLinePool2D } from "../../packages/javascript/src/line-pool.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/seeded-line-pool-2d.json");
const FIXTURE = join(ROOT, "fixtures/operations/seeded-line-pool-2d.json");
const SOURCE = join(ROOT, "packages/javascript/src/line-pool.js");
const FDLIBM = join(ROOT, "packages/javascript/src/fdlibm-trig.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, FDLIBM, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkCase(item) {
  if (item.error) {
    assert.throws(() => seededLinePool2D(item.input), (error) => {
      assert.equal(error.code, item.error, item.id);
      const detail = item.error_detail || {};
      for (const key of ["attempt", "stage", "childOrdinal", "selectedIndex"]) {
        if (key in detail) assert.equal(error[key], detail[key], item.id + "." + key);
      }
      return true;
    });
    return;
  }
  const result = seededLinePool2D(item.input);
  assert.deepStrictEqual(result.toValues(), item.output, item.id);
}

function ownershipChecks() {
  const config = { seed: 12, segment: [0, 0, 1, 0], attempts: 1, firstCutAngleScale: 1.0, minCutLength: 1.0, maxSegments: 3 };
  const result = seededLinePool2D(config);
  const baseline = result.toValues();
  config.segment[0] = 99;
  config.seed = 99;
  assert.deepStrictEqual(result.toValues(), baseline, "input detachment");
  const exported = result.toValues();
  exported.segments[0][0] = 77;
  exported.divided[0] = true;
  assert.deepStrictEqual(result.toValues(), baseline, "toValues export detachment");
  assert.equal(result.size, baseline.segments.length);
  assert.deepStrictEqual(result.segmentAt(0), baseline.segments[0]);
  assert.equal(result.dividedAt(0), baseline.divided[0]);
  const target = [9, 9, 9, 9];
  assert.equal(result.segmentInto(0, target), target);
  assert.deepStrictEqual(target, baseline.segments[0]);

  class ReadOnlyArray extends Array {}
  const mixed = [9, 9, 9, 9];
  Object.defineProperty(mixed, "2", { writable: false });
  for (const out of [mixed, Object.freeze([1, 2, 3, 4]), [1, 2, 3], new Float32Array(4), {}, null]) {
    const before = out === null ? null : Object.getOwnPropertyDescriptors(out);
    errorCode(() => result.segmentInto(0, out), "INVALID_OUTPUT");
    assert.deepStrictEqual(out === null ? null : Object.getOwnPropertyDescriptors(out), before);
  }
  for (const out of [[9, 9, 9, 9], new Float64Array(4), new ReadOnlyArray(9, 9, 9, 9)]) {
    assert.equal(result.segmentInto(0, out), out);
    assert.deepStrictEqual(Array.from(out), baseline.segments[0]);
  }
  const wide = [0, 0, 0, 0, 0, 0];
  assert.equal(result.segmentInto(0, wide, 2), wide);
  assert.deepStrictEqual(wide.slice(2), baseline.segments[0]);
  errorCode(() => result.segmentInto(0, [0, 0, 0, 0], 1), "INVALID_OUTPUT");

  for (const index of [-1, true, NaN, Infinity, 0.5, 9007199254740992, 1n, "0"]) {
    errorCode(() => result.segmentAt(index), "INVALID_INDEX");
    errorCode(() => result.dividedAt(index), "INVALID_INDEX");
    errorCode(() => result.segmentInto(index, [0, 0, 0, 0]), "INVALID_INDEX");
  }
  errorCode(() => result.segmentAt(result.size), "INDEX_OUT_OF_RANGE");
  // -0 is a valid safe nonnegative integer index, equivalent to 0.
  assert.deepStrictEqual(result.segmentAt(-0), result.segmentAt(0));

  return ["input containers detached", "toValues export detached", "at/into accessors", "offset precedence",
    "invalid outputs atomic", "index/range precedence"];
}

function nativeChecks() {
  const base = { seed: 12, segment: [0, 0, 1, 0], attempts: 1, firstCutAngleScale: 1.0, minCutLength: 1.0, maxSegments: 3 };
  for (const value of [NaN, Infinity, -Infinity]) {
    errorCode(() => seededLinePool2D({ ...base, minCutLength: value }), "INVALID_INPUT");
  }
  class Config {}
  for (const input of [
    Object.assign(new Config(), base),
    { ...base, segment: new (class extends Array {})(...base.segment) },
  ]) {
    errorCode(() => seededLinePool2D(input), "INVALID_INPUT");
  }
  assert.deepStrictEqual(seededLinePool2D(Object.assign(Object.create(null), base)).toValues(), seededLinePool2D(base).toValues());
  return ["nonfinite-carriers (JavaScript applicable carriers)", "passive-input-carriers-only"];
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
  const ownership = ownershipChecks();
  const native = nativeChecks();
  const after = hashes();
  assert.deepEqual(after, before, "source stability");
  const report = {
    status: "passed",
    operation: fixture.operation,
    node_version: process.version,
    scope: "Actual JS module golden, carrier and access checks against the frozen seeded-line-pool-2d fixtures, including the shared fdlibm5.3 sin/cos/atan2 numeric dependency. No renderer/acceptance claim.",
    input_sha256_before: before,
    input_sha256_after: after,
    scenarios: {
      fixture_cases: fixture.cases.length,
      ownership_access: ownership,
      native_only: native,
    },
    allocation_failure: { executed: false, source_review: "Output exports allocate detached arrays and do not mutate retained private storage; a failed call exposes no result. No controlled host allocation failure injected." },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
