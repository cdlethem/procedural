#!/usr/bin/env node
/**
 * Focused pure-model checks for the CutBranchMarks starter: retained pool identity,
 * command counts/shapes, colour/angle/work/seed-stroke behavior, and command validity
 * against the shared drawing.fresh-raster-2d contract. Scoped conformance check, not
 * the full CP2-milestone render/evidence apparatus.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { COLORS, createCutBranchMarks, cutBranchCommands } from "../../packages/javascript/examples/cut-branch-marks/cut-branch-marks.js";
import { normalizeCommand } from "../../packages/javascript/src/internal/drawing.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = join(ROOT, "packages/javascript/examples/cut-branch-marks/cut-branch-marks.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([SOURCE, SELF].map((file) => [name(file), sha(file)]));
const ENV = { width: 960, height: 960, density: 1, background: 0x0a0a15 };

function checkModel() {
  const base = createCutBranchMarks(42, false, false, false);
  assert.ok(Object.isFrozen(base), "retained model is frozen");
  assert.equal(base.pool.size, 12616, "literal retained cut count at seed 42/wide/dense/base");

  const narrow = createCutBranchMarks(42, true, false, false);
  const narrowCommands = [...cutBranchCommands(narrow, 0)];
  const baseCommands = [...cutBranchCommands(base, 0)];
  const anyDifferent = narrowCommands.length !== baseCommands.length ||
    narrowCommands.some((command, index) => command.to[0] !== baseCommands[index].to[0] || command.to[1] !== baseCommands[index].to[1]);
  assert.ok(anyDifferent, "A must rebuild and change at least one traced endpoint (children depend on firstCutAngleScale)");

  const sparse = createCutBranchMarks(42, false, true, false);
  assert.ok(sparse.pool.size < base.pool.size, "W sparse must rebuild with fewer retained cuts");

  const nextSeed = createCutBranchMarks(43, false, false, false);
  assert.notEqual(nextSeed.pool.size, base.pool.size, "R must rebuild with a different pool");

  let commandCount = 0;
  for (const command of cutBranchCommands(base, 0)) {
    normalizeCommand(command, ENV); // throws on any contract violation
    commandCount += 1;
  }
  assert.ok(commandCount <= base.pool.size, "commands never exceed retained cuts (degenerate segments are skipped)");

  // C must preserve geometry and change only rgb.
  const colour0 = cutBranchCommands(base, 0).next().value;
  const colour1 = cutBranchCommands(base, 1).next().value;
  assert.deepEqual(colour0.from, colour1.from, "colour cycle preserves geometry");
  assert.notEqual(colour0.rgb, colour1.rgb, "colour cycle changes colour");
  assert.equal(colour0.rgb, COLORS[0], "literal colour entry 0");
  assert.equal(colour1.rgb, COLORS[1], "literal colour entry 1");

  return { poolSize: base.pool.size, commandCount, narrowPoolSize: narrow.pool.size, sparsePoolSize: sparse.pool.size };
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
    scope: "Pure CutBranchMarks model/command-generator checks against the shared drawing.fresh-raster-2d contract; no renderer or pixel claim (see real-browser verification separately recorded).",
    input_sha256_before: before,
    input_sha256_after: after,
    scenarios,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
