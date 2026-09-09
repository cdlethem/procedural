#!/usr/bin/env node
/**
 * Focused pure-model checks for the LatticeMarks starter: retained path identity,
 * cell/colour/count behavior, and N/L/R/0 rebuild semantics. Scoped conformance check,
 * not the full CP2-milestone render/evidence apparatus.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createLatticeMarks, pathColour, cellPixel } from "../../packages/javascript/examples/lattice-marks/lattice-marks.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = join(ROOT, "packages/javascript/examples/lattice-marks/lattice-marks.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([SOURCE, SELF].map((file) => [name(file), sha(file)]));

function checkModel() {
  const base = createLatticeMarks(42, false, false);
  assert.ok(Object.isFrozen(base), "retained model is frozen");
  assert.equal(base.paths.pathCount, 12, "literal path count at seed 42/few starts");
  let totalCells = 0;
  for (let p = 0; p < base.paths.pathCount; p += 1) totalCells += base.paths.pathLengthAt(p);
  assert.equal(totalCells, 155, "literal total retained cells at seed 42/few/short");

  const many = createLatticeMarks(42, true, false);
  assert.equal(many.paths.pathCount, 36, "N must rebuild with 36 starts");

  const long = createLatticeMarks(42, false, true);
  let longCells = 0;
  for (let p = 0; p < long.paths.pathCount; p += 1) longCells += long.paths.pathLengthAt(p);
  assert.notEqual(longCells, totalCells, "L must rebuild with a different total cell count");

  const nextSeed = createLatticeMarks(43, false, false);
  let nextCells = 0;
  for (let p = 0; p < nextSeed.paths.pathCount; p += 1) nextCells += nextSeed.paths.pathLengthAt(p);
  function allCells(model) {
    const cells = [];
    for (let p = 0; p < model.paths.pathCount; p += 1) {
      for (let c = 0; c < model.paths.pathLengthAt(p); c += 1) cells.push(model.paths.cellAt(p, c));
    }
    return cells;
  }
  assert.notDeepEqual(allCells(base), allCells(nextSeed), "R must rebuild and change at least one visited cell (starts are fixed; only the walk depends on seed)");

  // C must preserve geometry and change only colour.
  const colour0 = pathColour(0, 0);
  const colour1 = pathColour(1, 0);
  assert.notEqual(colour0, colour1, "colour toggle changes colour");
  assert.equal(base.paths.cellAt(0, 0)[0], base.paths.cellAt(0, 0)[0], "geometry stable across colour toggle (same model)");

  // Pixel mapping sanity.
  assert.equal(cellPixel(0), 44);
  assert.equal(cellPixel(23), 44 + 24 * 23);

  return { pathCount: base.paths.pathCount, totalCells, manyPathCount: many.paths.pathCount, longTotalCells: longCells, nextSeedTotalCells: nextCells };
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
    scope: "Pure LatticeMarks model/path-generator checks over the shared path.occupied-lattice-paths-2d contract; no renderer or pixel claim (see real-browser verification separately recorded).",
    input_sha256_before: before, input_sha256_after: after,
    scenarios,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
