#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { noiseBandPath2D } from "../../packages/javascript/src/noise-band-path.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/noise-band-path.json");
const FIXTURE = join(ROOT, "fixtures/operations/noise-band-path.json");
const SOURCES = [
  join(ROOT, "packages/javascript/src/noise-band-path.js"),
  join(ROOT, "packages/javascript/src/gradient-noise-2d-01.js"),
  join(ROOT, "packages/javascript/src/fdlibm-trig.js"),
  join(ROOT, "packages/javascript/src/internal/noise-hash.js"),
];
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, ...SOURCES, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkCase(item) {
  if (item.error) {
    assert.throws(() => noiseBandPath2D(item.input), (error) => {
      assert.equal(error.code, item.error, item.id);
      if (item.error_detail && Object.keys(item.error_detail).length > 0) {
        assert.equal(error.attemptIndex, item.error_detail.attemptIndex, item.id);
        assert.equal(error.stage, item.error_detail.stage, item.id);
      }
      return true;
    });
    return null;
  }
  const path = noiseBandPath2D(item.input);
  assert.deepStrictEqual(path.toValues(), item.output, item.id);
  return path;
}

function ownershipChecks() {
  const config = {
    field: { seed: 177 }, start: [320.0, 320.0], heading: 0.0, seed: 0, attempts: 12,
    stepDistance: 1.0, fieldScale: 0.006, fieldOffset: [7.3, 11.7], tolerance: 0.002, maxVertices: 13,
  };
  const path = noiseBandPath2D(config);
  const baseline = path.toValues();
  config.start[0] = 99;
  config.field.seed = 99;
  config.fieldOffset[0] = 99;
  assert.deepStrictEqual(path.toValues(), baseline, "input detachment");
  const exported = path.toValues();
  exported.positions[0][0] = 77;
  exported.headings[0] = 77;
  assert.deepStrictEqual(path.toValues(), baseline, "toValues export detachment");
  const serialized = path.serialize();
  const serializedBaseline = JSON.parse(JSON.stringify(serialized));
  serialized.start[0] = 77;
  serialized.field.seed = 77;
  assert.deepStrictEqual(path.serialize(), serializedBaseline, "serialize export detachment");

  assert.equal(path.size, baseline.positions.length);
  assert.equal(path.attempts, baseline.attempts);
  assert.equal(path.accepted, baseline.accepted);
  assert.equal(path.rejected, baseline.rejected);
  assert.deepStrictEqual(path.pointAt(0), baseline.positions[0]);
  assert.equal(path.headingAt(0), baseline.headings[0]);
  const target = [9, 9];
  assert.equal(path.pointInto(0, target), target);
  assert.deepStrictEqual(target, baseline.positions[0]);

  class ReadOnlyArray extends Array {}
  const mixed = [9, 9];
  Object.defineProperty(mixed, "1", { writable: false });
  for (const out of [mixed, Object.freeze([1, 2]), [1], new Float32Array(2), {}, null]) {
    const before = out === null ? null : Object.getOwnPropertyDescriptors(out);
    errorCode(() => path.pointInto(0, out), "INVALID_OUTPUT");
    assert.deepStrictEqual(out === null ? null : Object.getOwnPropertyDescriptors(out), before);
  }
  for (const out of [[9, 9], new Float64Array(2), new ReadOnlyArray(9, 9)]) {
    assert.equal(path.pointInto(0, out), out);
    assert.deepStrictEqual(Array.from(out), baseline.positions[0]);
  }
  for (const index of [-1, true, NaN, Infinity, 0.5, 9007199254740992, 1n, "0"]) {
    errorCode(() => path.pointAt(index), "INVALID_INDEX");
    errorCode(() => path.headingAt(index), "INVALID_INDEX");
    errorCode(() => path.pointInto(index, [0, 0]), "INVALID_INDEX");
  }
  errorCode(() => path.pointAt(path.size), "INDEX_OUT_OF_RANGE");
  errorCode(() => path.headingAt(baseline.accepted), "INDEX_OUT_OF_RANGE");
  return ["input containers detached", "toValues/serialize export detached", "pointInto atomic/typed outputs", "index/range precedence"];
}

function nativeChecks() {
  const base = { field: { seed: 1 }, start: [0, 0], heading: 0, seed: 1, attempts: 3,
    stepDistance: 1, fieldScale: 0.01, fieldOffset: [0, 0], tolerance: 0.5, maxVertices: 10 };
  for (const value of [NaN, Infinity, -Infinity]) {
    errorCode(() => noiseBandPath2D({ ...base, heading: value }), "INVALID_INPUT");
  }
  class Config {}
  for (const input of [Object.assign(new Config(), base), { ...base, start: new (class extends Array {})(0, 0) }]) {
    errorCode(() => noiseBandPath2D(input), "INVALID_INPUT");
  }
  assert.deepStrictEqual(noiseBandPath2D(Object.assign(Object.create(null), base)).toValues(), noiseBandPath2D(base).toValues());
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
    scope: "Actual JS module golden, carrier and access checks against the frozen noise-band-path fixtures, using a bit-exact ported fdlibm5.3 sin/cos verified against java.lang.StrictMath.sin/cos and the existing gradient-noise-2d-01 field. No renderer/acceptance claim.",
    input_sha256_before: before,
    input_sha256_after: after,
    scenarios: {
      fixture_cases: fixture.cases.length,
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
