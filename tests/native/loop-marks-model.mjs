#!/usr/bin/env node
/**
 * Focused pure-model checks for the LoopMarks starter: retained curve identity across
 * style-only edits, command counts/shapes, palette/fan/move behavior, and command
 * validity against the shared drawing.fresh-raster-2d contract. This is a scoped
 * conformance check, not the full CP2-milestone render/evidence apparatus; it runs the
 * actual composition and command-generator code (no renderer or pixel claim here — see
 * the real-browser verification recorded in the porting checkpoint for that).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { COLORS, OTHER_COLORS, createLoopMarks, loopFanTriangles, loopTileCommands } from "../../packages/javascript/examples/loop-marks/loop-marks.js";
import { normalizeCommand } from "../../packages/javascript/src/internal/drawing.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = join(ROOT, "packages/javascript/examples/loop-marks/loop-marks.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([SOURCE, SELF].map((file) => [name(file), sha(file)]));
const ENV = { width: 640, height: 640, density: 1, background: 0xf5f0e6 };

function checkModel() {
  const baseline = createLoopMarks(false);
  assert.equal(baseline.curves.length, 4, "four curves");
  assert.ok(Object.isFrozen(baseline) && Object.isFrozen(baseline.curves), "retained model is frozen");
  for (const curve of baseline.curves) assert.equal(curve.controlCount, 6, "six controls per curve");

  const moved = createLoopMarks(true);
  const geometryChanged = baseline.curves.some((curve, index) =>
    curve.length !== moved.curves[index].length);
  assert.ok(geometryChanged, "T must rebuild every curve and change geometry");

  let tileCount = 0, quadCount = 0, segmentCount = 0;
  for (const command of loopTileCommands(baseline, false)) {
    normalizeCommand(command, ENV); // throws on any contract violation
    tileCount += 1;
    if (command.kind === "quad2") quadCount += 1; else segmentCount += 1;
  }
  assert.equal(tileCount, 1048, "tile command count: 4 curves * (192 outline segments + tile-glyph quads)");
  assert.equal(segmentCount, 768, "segment (outline) command count: 4 curves * 192 samples");
  assert.equal(quadCount, 280, "quad (glyph) command count: two quads per placed tile along each curve");

  let fanCount = 0;
  for (const triangle of loopFanTriangles(baseline, false)) fanCount += 1;
  assert.equal(fanCount, 768, "192 fan triangles * 4 curves");

  // C must preserve geometry (same curve object identities/lengths) and change only rgb.
  const baseTileFirst = loopTileCommands(baseline, false).next().value;
  const altTileFirst = loopTileCommands(baseline, true).next().value;
  assert.equal(baseTileFirst.from[0], altTileFirst.from[0], "palette swap preserves geometry");
  assert.notEqual(baseTileFirst.rgb, altTileFirst.rgb, "palette swap changes colour");
  assert.equal(baseTileFirst.rgb, COLORS[0], "literal base palette entry 0");
  assert.equal(altTileFirst.rgb, OTHER_COLORS[0], "literal alternate palette entry 0");

  // M (fans) reuses the same retained curve objects; no rebuild.
  const fanFirst = loopFanTriangles(baseline, false).next().value;
  assert.equal(fanFirst.rgb, COLORS[0], "fan mode uses the same palette entry");

  return { tileCount, quadCount, segmentCount, fanCount };
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
    scope: "Pure LoopMarks model/command-generator checks against the shared drawing.fresh-raster-2d contract; no renderer or pixel claim (see real-browser verification separately recorded).",
    input_sha256_before: before,
    input_sha256_after: after,
    scenarios,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
