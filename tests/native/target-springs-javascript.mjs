#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { targetSprings2D } from "../../packages/javascript/src/target-springs.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/target-springs-2d.json");
const FIXTURE = join(ROOT, "fixtures/operations/target-springs-2d.json");
const SOURCE = join(ROOT, "packages/javascript/src/target-springs.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkCase(item) {
  if (item.error) {
    assert.throws(() => targetSprings2D(item.input), (error) => {
      assert.equal(error.code, item.error, item.id);
      if (item.error_details) {
        assert.equal(error.bodyIndex, item.error_details.bodyIndex, item.id);
        assert.equal(error.axis, item.error_details.axis, item.id);
        assert.equal(error.stage, item.error_details.stage, item.id);
      }
      return true;
    });
    return;
  }
  const result = targetSprings2D(item.input);
  assert.deepStrictEqual(result.toValues(), item.output, item.id);
}

function ownershipChecks() {
  const config = {
    state: { bodies: [{ position: [3, -2], velocity: [1, -0.5], strength: 0.125, retention: 0.75 }] },
    targets: [[10, -4]],
  };
  const result = targetSprings2D(config);
  const baseline = result.toValues();
  config.state.bodies[0].position[0] = 99;
  config.targets[0][0] = 99;
  assert.deepStrictEqual(result.toValues(), baseline, "input detachment");
  const exported = result.toValues();
  exported.bodies[0].position[0] = 77;
  assert.deepStrictEqual(result.toValues(), baseline, "toValues export detachment");
  assert.equal(result.size, 1);
  assert.deepStrictEqual(result.positionAt(0), baseline.bodies[0].position);
  assert.deepStrictEqual(result.velocityAt(0), baseline.bodies[0].velocity);
  assert.equal(result.strengthAt(0), baseline.bodies[0].strength);
  assert.equal(result.retentionAt(0), baseline.bodies[0].retention);
  const target = [9, 9];
  assert.equal(result.positionInto(0, target), target);
  assert.deepStrictEqual(target, baseline.bodies[0].position);

  class ReadOnlyArray extends Array {}
  const mixed = [9, 9];
  Object.defineProperty(mixed, "1", { writable: false });
  for (const out of [mixed, Object.freeze([1, 2]), [1], new Float32Array(2), {}, null]) {
    const before = out === null ? null : Object.getOwnPropertyDescriptors(out);
    errorCode(() => result.positionInto(0, out), "INVALID_OUTPUT");
    errorCode(() => result.velocityInto(0, out), "INVALID_OUTPUT");
    assert.deepStrictEqual(out === null ? null : Object.getOwnPropertyDescriptors(out), before);
  }
  for (const out of [[9, 9], new Float64Array(2), new ReadOnlyArray(9, 9)]) {
    assert.equal(result.positionInto(0, out), out);
    assert.deepStrictEqual(Array.from(out), baseline.bodies[0].position);
  }
  for (const index of [-1, true, NaN, Infinity, 0.5, 9007199254740992, 1n, "0"]) {
    errorCode(() => result.positionAt(index), "INVALID_INDEX");
    errorCode(() => result.velocityAt(index), "INVALID_INDEX");
    errorCode(() => result.strengthAt(index), "INVALID_INDEX");
    errorCode(() => result.retentionAt(index), "INVALID_INDEX");
  }
  errorCode(() => result.positionAt(result.size), "INDEX_OUT_OF_RANGE");

  // Feeding a returned state back in as the next call's state is the animation pattern.
  const second = targetSprings2D({ state: result.toValues(), targets: [[10, -4]] });
  assert.notDeepEqual(second.toValues(), result.toValues());

  return ["input containers detached", "toValues export detached", "at/into accessors", "invalid outputs atomic",
    "index/range precedence", "state feeds back as next input"];
}

function nativeChecks() {
  const base = { state: { bodies: [{ position: [0, 0], velocity: [0, 0], strength: 1, retention: 1 }] }, targets: [[1, 1]] };
  for (const value of [NaN, Infinity, -Infinity]) {
    errorCode(() => targetSprings2D({ state: { bodies: [{ ...base.state.bodies[0], strength: value }] }, targets: base.targets }), "INVALID_INPUT");
  }
  class Config {}
  for (const input of [
    Object.assign(new Config(), base),
    { state: { bodies: new (class extends Array {})(base.state.bodies[0]) }, targets: base.targets },
  ]) {
    errorCode(() => targetSprings2D(input), "INVALID_INPUT");
  }
  assert.deepStrictEqual(targetSprings2D(Object.assign(Object.create(null), base)).toValues(), targetSprings2D(base).toValues());
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
    scope: "Actual JS module golden, carrier and access checks against the frozen target-springs-2d fixtures. No renderer/acceptance claim.",
    input_sha256_before: before,
    input_sha256_after: after,
    scenarios: {
      fixture_cases: fixture.cases.length,
      ownership_access: ownership,
      native_only: native,
    },
    allocation_failure: { executed: false, source_review: "Output exports allocate detached arrays and do not mutate retained private arrays; a failed call exposes no result. No controlled host allocation failure injected." },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
