#!/usr/bin/env node
/**
 * Focused pure-model checks for the FacetMarks starter: retained mesh/grain identity,
 * disc/cell site sources, and N/X/R/0 rebuild semantics. Scoped conformance check, not
 * the full CP2-milestone render/evidence apparatus.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createFacetMarks } from "../../packages/javascript/examples/facet-marks/facet-marks.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = join(ROOT, "packages/javascript/examples/facet-marks/facet-marks.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([SOURCE, SELF].map((file) => [name(file), sha(file)]));

function checkModel() {
  const base = createFacetMarks(42, false, false);
  assert.ok(Object.isFrozen(base), "retained model is frozen");
  assert.equal(base.mesh.faceCount, 238, "literal disc-site face count at seed 42/coarse");
  assert.equal(base.grainCount, 9099, "literal grain count at seed 42/coarse/disc");
  assert.equal(base.grain.length, base.mesh.faceCount, "one grain batch per face");

  const fine = createFacetMarks(42, true, false);
  assert.notEqual(fine.mesh.faceCount, base.mesh.faceCount, "N must rebuild with a different face count");

  const cellsModel = createFacetMarks(42, false, true);
  assert.notEqual(cellsModel.mesh.faceCount, base.mesh.faceCount, "X must rebuild with a different site source");

  const nextSeed = createFacetMarks(43, false, false);
  const a0 = [0, 0]; base.mesh.pointInto(0, a0);
  const b0 = [0, 0]; nextSeed.mesh.pointInto(0, b0);
  assert.notDeepEqual(a0, b0, "R must rebuild with different site geometry");

  return { faceCount: base.mesh.faceCount, grainCount: base.grainCount, fineFaceCount: fine.mesh.faceCount, cellsFaceCount: cellsModel.mesh.faceCount, nextSeedFaceCount: nextSeed.mesh.faceCount };
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
    scope: "Pure FacetMarks model/mesh-generator checks over the shared delaunay-2d/triangle-points-2d/quadrant-partition-2d contracts; no renderer or pixel claim (see real-browser verification separately recorded).",
    input_sha256_before: before, input_sha256_after: after,
    scenarios,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
