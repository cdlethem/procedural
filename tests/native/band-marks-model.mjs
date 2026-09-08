#!/usr/bin/env node
/**
 * Focused pure-model checks for the BandMarks starter: retained path count/identity,
 * command counts/shapes, palette/mode/tolerance behavior, and command validity against
 * the shared drawing.fresh-raster-2d contract. Scoped conformance check, not the full
 * CP2-milestone render/evidence apparatus.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { COLORS, OTHER_COLORS, bandPathCommands, createBandMarks } from "../../packages/javascript/examples/band-marks/band-marks.js";
import { normalizeCommand } from "../../packages/javascript/src/internal/drawing.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = join(ROOT, "packages/javascript/examples/band-marks/band-marks.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([SOURCE, SELF].map((file) => [name(file), sha(file)]));
const ENV = { width: 640, height: 640, density: 1, background: 0xf5f0e6 };

function checkModel() {
  const narrow = createBandMarks(false);
  assert.equal(narrow.paths.length, 64, "64 retained paths");
  assert.ok(Object.isFrozen(narrow) && Object.isFrozen(narrow.paths), "retained model is frozen");
  assert.equal(narrow.paths[0].attempts, 2048, "literal attempt budget");

  const wide = createBandMarks(true);
  assert.notEqual(narrow.paths[0].size, wide.paths[0].size, "T must rebuild with a different tolerance and change path length");

  let pathCommandCount = 0;
  for (const command of bandPathCommands(narrow, false, false)) {
    normalizeCommand(command, ENV); // throws on any contract violation
    pathCommandCount += 1;
  }
  let markCommandCount = 0;
  for (const command of bandPathCommands(narrow, false, true)) {
    normalizeCommand(command, ENV);
    markCommandCount += 1;
  }
  assert.ok(pathCommandCount > markCommandCount, "connected path must emit far more segments than sparse tick marks");

  // C must preserve geometry and change only rgb.
  const baseFirst = bandPathCommands(narrow, false, false).next().value;
  const altFirst = bandPathCommands(narrow, true, false).next().value;
  assert.deepEqual(baseFirst.from, altFirst.from, "palette swap preserves geometry");
  assert.notEqual(baseFirst.rgb, altFirst.rgb, "palette swap changes colour");
  assert.equal(baseFirst.rgb, COLORS[0], "literal base palette entry 0");
  assert.equal(altFirst.rgb, OTHER_COLORS[0], "literal alternate palette entry 0");

  return { pathCommandCount, markCommandCount, pathCount: 64 };
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
    scope: "Pure BandMarks model/command-generator checks against the shared drawing.fresh-raster-2d contract; no renderer or pixel claim (see real-browser verification separately recorded).",
    input_sha256_before: before,
    input_sha256_after: after,
    scenarios,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
