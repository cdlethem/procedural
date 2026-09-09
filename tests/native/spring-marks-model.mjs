#!/usr/bin/env node
/**
 * Focused pure-model checks for the SpringMarks starter: retained connectivity
 * identity, disturb/step/reset/response semantics. Scoped conformance check, not the
 * full CP2-milestone render/evidence apparatus.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createSpringMarks } from "../../packages/javascript/examples/spring-marks/spring-marks.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = join(ROOT, "packages/javascript/examples/spring-marks/spring-marks.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([SOURCE, SELF].map((file) => [name(file), sha(file)]));

function checkModel() {
  const model = createSpringMarks();
  assert.equal(model.motion.size, 49, "literal 7x7 body count");
  assert.equal(model.mesh.faceCount, 72, "literal Delaunay face count over the 49-point grid");
  assert.equal(model.tick, 0, "starts paused at tick 0");
  assert.equal(model.sampleCount, 1, "starts with exactly one history sample");

  const out = [0, 0];
  model.initialInto(24, out, 0);
  assert.deepEqual(out, [320, 320], "literal center-body (index 24) initial position");

  // Corner body (distance > 200 from centre) is unaffected by disturb.
  model.initialInto(0, out, 0);
  assert.deepEqual(out, [128, 128], "literal corner-body (index 0) initial position");
  model.disturb();
  const cornerTarget = [0, 0];
  model.targetInto(0, cornerTarget, 0);
  assert.deepEqual(cornerTarget, [128, 128], "corner body beyond disturb radius is unaffected");

  // Center body (distance 0) receives the full +80x,-40y impulse.
  const centerTarget = [0, 0];
  model.targetInto(24, centerTarget, 0);
  assert.deepEqual(centerTarget, [400, 280], "literal full-weight disturb impulse at the exact centre");

  for (let i = 0; i < 10; i += 1) model.step();
  assert.equal(model.tick, 10, "tick advances once per step()");
  assert.equal(model.sampleCount, 11, "sampleCount grows with each step up to the history cap");
  assert.equal(model.oldestTick, 0, "oldestTick tracks the retained trail window");

  const oldest = [0, 0], newest = [0, 0];
  model.historyInto(0, 24, oldest, 0);
  model.motion.positionInto(24, newest, 0);
  assert.deepEqual(oldest, [320, 320], "history[0] is the pre-disturb initial position");
  assert.notDeepEqual(newest, oldest, "current position has moved from the initial after stepping");

  // response() must change spring behavior without altering the current retained position.
  const beforeResponse = [0, 0];
  model.motion.positionInto(24, beforeResponse, 0);
  model.response(0.05, 0.7);
  const afterResponse = [0, 0];
  model.motion.positionInto(24, afterResponse, 0);
  assert.deepEqual(afterResponse, beforeResponse, "response() preserves the current position (only coefficients change)");
  assert.equal(model.motion.strengthAt(24), 0.05, "response() replaces retained strength");

  // reset() must restore the exact initial state without rebuilding connectivity.
  const meshBefore = model.mesh;
  model.reset();
  assert.equal(model.tick, 0, "reset restores tick to 0");
  assert.equal(model.sampleCount, 1, "reset restores sampleCount to 1");
  assert.strictEqual(model.mesh, meshBefore, "reset does not rebuild the fixed Delaunay connectivity");
  const afterReset = [0, 0];
  model.motion.positionInto(24, afterReset, 0);
  assert.deepEqual(afterReset, [320, 320], "reset restores the exact initial position");

  return {
    bodyCount: model.motion.size, faceCount: model.mesh.faceCount,
    tickAfterSteps: 10, sampleCountAfterSteps: 11,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output") throw new Error("Usage: --output FRESH_JSON_PATH");
  const output = resolve(args[1]);
  if (!output.startsWith(join(ROOT, ".work") + sep) || existsSync(output)) throw new Error("Output must be fresh and under .work");
  const before = hashes();
  const scenarios = checkModel();
  const after = hashes();
  assert.deepEqual(after, before, "source stability");
  const report = {
    status: "passed",
    node_version: process.version,
    scope: "Pure SpringMarks model checks over the shared motion.target-springs-2d/topology.delaunay-2d/layout.regular-grid contracts; no renderer or pixel claim (see real-browser verification separately recorded).",
    input_sha256_before: before, input_sha256_after: after,
    scenarios,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
