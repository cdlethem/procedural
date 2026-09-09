#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { RetainedRectangleCuts2D, retainedRectangleCuts2D } from "../../packages/javascript/src/retained-rectangle-cuts.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/retained-rectangle-cuts-2d.json");
const FIXTURE = join(ROOT, "fixtures/operations/retained-rectangle-cuts-2d.json");
const SOURCE = join(ROOT, "packages/javascript/src/retained-rectangle-cuts.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkCreationCase(item) {
  if (!item.error) {
    const model = retainedRectangleCuts2D(item.input);
    assert.deepEqual(model.toValues(), item.output, item.id);
    return;
  }
  assert.throws(() => retainedRectangleCuts2D(item.input), (error) => {
    assert.equal(error.code, item.error, item.id);
    return true;
  });
}

function runCommand(model, command) {
  if (command.op === "cut") return model.cut(command.id, command.axis, command.coordinate);
  if (command.op === "remove") return model.remove(command.id);
  throw new Error("Unhandled command op: " + command.op);
}

function checkCommandCase(item) {
  const model = retainedRectangleCuts2D(item.input);
  if (!item.error) {
    let lastReturn;
    for (const command of item.commands) lastReturn = runCommand(model, command);
    assert.deepEqual(model.toValues(), item.output, item.id);
    return lastReturn;
  }
  const allButLast = item.commands.slice(0, -1);
  const last = item.commands[item.commands.length - 1];
  for (const command of allButLast) runCommand(model, command);
  assert.throws(() => runCommand(model, last), (error) => {
    assert.equal(error.code, item.error, item.id);
    return true;
  });
  assert.deepEqual(model.toValues(), item.after_error, item.id + " after_error");
  if (item.recovery) {
    const result = runCommand(model, item.recovery.command);
    if (item.recovery.returns !== undefined) assert.deepEqual(result, item.recovery.returns, item.id + " recovery return");
    assert.deepEqual(model.toValues(), item.recovery.output, item.id + " recovery output");
  }
}

function ownershipChecks() {
  const config = { bounds: [0, 0, 10, 8] };
  const model = retainedRectangleCuts2D(config);
  config.bounds[0] = 99; config.bounds.push(1);
  assert.deepEqual(model.toValues(), { nextId: 1, leaves: [{ id: 0, bounds: [0, 0, 10, 8] }] }, "input record detached");

  const leaf0 = model.leaf(0);
  assert.throws(() => { leaf0.bounds[0] = 77; }, TypeError, "leaf value frozen");
  assert.throws(() => { leaf0.id = 77; }, TypeError, "leaf id frozen");

  const [lowId, highId] = model.cut(0, "X", 4);
  assert.equal(lowId, 1); assert.equal(highId, 2);
  const leaves = model.leaves();
  leaves.push("junk"); leaves[0] = "mutated";
  assert.equal(model.leaves().length, 2, "leaves() detached");

  const detached = model.toValues();
  detached.leaves[0].bounds[0] = 77; detached.leaves.length = 0; detached.nextId = 99;
  assert.deepEqual(model.toValues(), { nextId: 3, leaves: [{ id: 1, bounds: [0, 0, 4, 8] }, { id: 2, bounds: [4, 0, 10, 8] }] });

  errorCode(() => model.leaf(0), "UNKNOWN_ID");
  errorCode(() => model.cut(0, "X", 2), "UNKNOWN_ID");
  errorCode(() => model.remove(0), "UNKNOWN_ID");
  for (const id of [-1, 0.5, 9007199254740991, true, NaN, "1"]) {
    for (const access of [() => model.leaf(id), () => model.cut(id, "X", 1), () => model.remove(id)]) {
      errorCode(access, "INVALID_ID");
    }
  }
  return ["input record detached after construction", "leaf values immutable", "leaves()/toValues() detached",
    "stale id precedence: UNKNOWN_ID after removal", "id domain: INVALID_ID before UNKNOWN_ID"];
}

function nativeChecks() {
  errorCode(() => retainedRectangleCuts2D(null), "INVALID_INPUT");
  errorCode(() => retainedRectangleCuts2D({ bounds: [0, 0, 10, 8], extra: 1 }), "INVALID_INPUT");
  errorCode(() => retainedRectangleCuts2D({ bounds: [0, 0, 10] }), "INVALID_INPUT");
  errorCode(() => retainedRectangleCuts2D({ bounds: [0, 0, 10, 8n] }), "INVALID_INPUT");
  errorCode(() => retainedRectangleCuts2D({ bounds: [NaN, 0, 10, 8] }), "INVALID_INPUT");
  errorCode(() => retainedRectangleCuts2D({ bounds: [0, 0, 0, 8] }), "INVALID_INPUT");
  const model = retainedRectangleCuts2D({ bounds: [0, 0, 10, 8] });
  errorCode(() => model.cut(0, "Z", 4), "INVALID_INPUT");
  errorCode(() => model.cut(0, "X", NaN), "INVALID_INPUT");
  errorCode(() => model.cut(0, "X", 0), "INVALID_CUT");
  errorCode(() => model.cut(0, "X", 10), "INVALID_CUT");
  return ["non-record/wrong-length/bigint/nonfinite/degenerate creation inputs", "unknown axis/nonfinite/boundary cut coordinate"];
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output") throw new Error("Usage: --output FRESH_JSON_PATH");
  const output = resolve(args[1]);
  if (!output.startsWith(join(ROOT, ".work") + sep) || existsSync(output)) throw new Error("Output must be fresh and under .work");
  const fixture = JSON.parse(readFileSync(FIXTURE));
  assert.equal(fixture.catalog_sha256, sha(CATALOG), "fixture catalog binding");
  const before = hashes();
  for (const item of fixture.cases) checkCreationCase(item);
  for (const item of fixture.command_cases) checkCommandCase(item);
  const ownership = ownershipChecks(), native = nativeChecks();
  const after = hashes();
  assert.deepEqual(after, before, "source stability");
  const report = {
    status: "passed", operation: fixture.operation, node_version: process.version,
    scope: "Actual JS module creation/command/carrier/ownership checks. No renderer/acceptance claim.",
    input_sha256_before: before, input_sha256_after: after,
    scenarios: {
      creation_cases: fixture.cases.length, command_cases: fixture.command_cases.length,
      ownership_access: ownership, native_only: native,
    },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
