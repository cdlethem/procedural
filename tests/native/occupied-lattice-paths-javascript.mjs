#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { occupiedLatticePaths2D } from "../../packages/javascript/src/occupied-lattice-paths.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/occupied-lattice-paths-2d.json");
const FIXTURE = join(ROOT, "fixtures/operations/occupied-lattice-paths-2d.json");
const SOURCE = join(ROOT, "packages/javascript/src/occupied-lattice-paths.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkCase(item) {
  if (item.error) {
    assert.throws(() => occupiedLatticePaths2D(item.input), (error) => {
      assert.equal(error.code, item.error, item.id);
      return true;
    });
    return null;
  }
  const result = occupiedLatticePaths2D(item.input);
  assert.deepStrictEqual(result.toValues(), item.output, item.id);
  return result;
}

function ownershipChecks() {
  const config = { dimensions: [3, 3], starts: [[1, 1]], maxSteps: 2, maxCells: 6, random: { seed: 42 } };
  const result = occupiedLatticePaths2D(config);
  const baseline = result.toValues();
  config.starts[0][0] = 99;
  config.dimensions[0] = 99;
  config.random.seed = 99;
  assert.deepStrictEqual(result.toValues(), baseline, "input detachment");
  const exported = result.toValues();
  exported.paths[0][0][0] = 77;
  exported.randomState[0] = 77;
  assert.deepStrictEqual(result.toValues(), baseline, "toValues export detachment");
  assert.equal(result.pathCount, baseline.paths.length);
  assert.equal(result.pathLengthAt(0), baseline.paths[0].length);
  assert.deepStrictEqual(result.cellAt(0, 0), baseline.paths[0][0]);
  assert.equal(result.completionReasonAt(0), baseline.completionReasons[0]);
  assert.deepStrictEqual(result.randomState(), baseline.randomState);
  const randomStateExported = result.randomState();
  randomStateExported[0] = 77;
  assert.deepStrictEqual(result.randomState(), baseline.randomState, "randomState export detachment");

  const target = [9, 9];
  assert.equal(result.cellInto(0, 0, target), target);
  assert.deepStrictEqual(target, baseline.paths[0][0]);

  class ReadOnlyArray extends Array {}
  const mixed = [9, 9];
  Object.defineProperty(mixed, "0", { writable: false });
  for (const out of [mixed, Object.freeze([1, 2]), [1], {}, null]) {
    errorCode(() => result.cellInto(0, 0, out), "INVALID_OUTPUT");
  }
  for (const out of [[9, 9], new Int32Array(2), new ReadOnlyArray(9, 9)]) {
    assert.equal(result.cellInto(0, 0, out), out);
    assert.deepStrictEqual(Array.from(out), baseline.paths[0][0]);
  }
  for (const index of [-1, true, NaN, Infinity, 0.5, 9007199254740992, 1n, "0"]) {
    errorCode(() => result.pathLengthAt(index), "INVALID_INDEX");
    errorCode(() => result.completionReasonAt(index), "INVALID_INDEX");
    errorCode(() => result.cellAt(index, 0), "INVALID_INDEX");
    errorCode(() => result.cellAt(0, index), "INVALID_INDEX");
  }
  errorCode(() => result.pathLengthAt(result.pathCount), "INDEX_OUT_OF_RANGE");
  errorCode(() => result.cellAt(0, result.pathLengthAt(0)), "INDEX_OUT_OF_RANGE");

  // Continuation: feed the returned randomState into a new call as random.state.
  const second = occupiedLatticePaths2D({ dimensions: [3, 3], starts: [[0, 0]], maxSteps: 1, maxCells: 2, random: { state: result.randomState() } });
  assert.equal(second.randomState().length, 4);

  return ["input containers detached", "toValues/randomState export detached", "at/into accessors",
    "invalid outputs rejected", "index/range precedence", "random.state continuation"];
}

function nativeChecks() {
  const base = { dimensions: [2, 2], starts: [[0, 0]], maxSteps: 1, maxCells: 2, random: { seed: 1 } };
  class Config {}
  for (const input of [
    Object.assign(new Config(), base),
    { ...base, random: { seed: 1, state: [1, 0, 0, 0] } },
    { ...base, starts: new (class extends Array {})([0, 0]) },
  ]) {
    errorCode(() => occupiedLatticePaths2D(input), "INVALID_INPUT");
  }
  assert.deepStrictEqual(occupiedLatticePaths2D(Object.assign(Object.create(null), base)).toValues(), occupiedLatticePaths2D(base).toValues());
  return ["nonfinite/wrong-shape carriers", "passive-input-carriers-only"];
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
    scope: "Actual JS module golden, carrier and access checks against the frozen occupied-lattice-paths-2d fixtures. No renderer/acceptance claim.",
    input_sha256_before: before,
    input_sha256_after: after,
    scenarios: {
      fixture_cases: fixture.cases.length,
      ownership_access: ownership,
      native_only: native,
    },
    allocation_failure: { executed: false, source_review: "Output exports allocate detached arrays and do not mutate retained private arrays; a rejected configuration exposes no result. No controlled host allocation failure injected." },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
