#!/usr/bin/env node
/**
 * Focused pure-model checks for the RampMarks starter: retained ramp behavior across
 * style-only edits, grid dot count/positions, and endpoint/stop-color literals. Scoped
 * conformance check, not the full CP2-milestone render/evidence apparatus.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE_COLORS, ALTERNATE_COLORS, createRampMarks, rampGridDots, rampGridValue } from "../../packages/javascript/examples/ramp-marks/ramp-marks.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = join(ROOT, "packages/javascript/examples/ramp-marks/ramp-marks.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([SOURCE, SELF].map((file) => [name(file), sha(file)]));

function checkModel() {
  const base = createRampMarks(false, false);
  assert.ok(Object.isFrozen(base), "retained model is frozen");
  assert.equal(base.ramp.sample(0), BASE_COLORS[0], "literal first stop color");
  assert.equal(base.ramp.sample(1), BASE_COLORS[3], "literal last stop color");

  const shifted = createRampMarks(true, false);
  assert.notEqual(shifted.ramp.sample(0.4), base.ramp.sample(0.4), "T must change an interior sample");
  assert.equal(shifted.ramp.sample(0), base.ramp.sample(0), "T preserves the first stop");
  assert.equal(shifted.ramp.sample(1), base.ramp.sample(1), "T preserves the last stop");

  const alternate = createRampMarks(false, true);
  assert.equal(alternate.ramp.sample(0), ALTERNATE_COLORS[0], "literal alternate first stop color");
  assert.notEqual(alternate.ramp.sample(0), base.ramp.sample(0), "C must change colour");

  const dots = [...rampGridDots(base, false)];
  assert.equal(dots.length, 729, "27x27 fixed grid");
  assert.equal(dots[0].x, 12); assert.equal(dots[0].y, 12);
  assert.equal(dots[1].x, 36); assert.equal(dots[1].y, 12);

  // F changes only the coordinate/colour per dot, never dot count or position.
  const radialDots = [...rampGridDots(base, true)];
  assert.equal(radialDots.length, dots.length, "F preserves dot count");
  assert.equal(radialDots[0].x, dots[0].x, "F preserves dot positions");
  assert.notEqual(rampGridValue(12, 12, false), rampGridValue(12, 12, true), "F changes the sampled coordinate");

  return { dotCount: dots.length, stopCount: 4 };
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
    scope: "Pure RampMarks model/grid checks; no renderer or pixel claim (see real-browser verification separately recorded).",
    input_sha256_before: before,
    input_sha256_after: after,
    scenarios,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
