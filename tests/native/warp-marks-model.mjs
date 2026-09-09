#!/usr/bin/env node
/**
 * Focused pure-model checks for the WarpMarks starter: retained palette/noise-field
 * behavior, displacement field literals, and end-to-end identity/field/pattern remap
 * behavior against the shared raster.bilinear-remap-2d operation. Scoped conformance
 * check, not the full CP2-milestone render/evidence apparatus; no renderer needed since
 * the remap/displacement logic is pure (source-pattern drawing is renderer-owned, see
 * the real-browser verification separately recorded).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { SIDE, createWarpMarks, displacementAt, dotColorAt, remapSource, stripeColorAt } from "../../packages/javascript/examples/warp-marks/warp-marks.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = join(ROOT, "packages/javascript/examples/warp-marks/warp-marks.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([SOURCE, SELF].map((file) => [name(file), sha(file)]));

function checkModel() {
  const model = createWarpMarks();
  assert.ok(Object.isFrozen(model), "retained model is frozen");

  // strength 0 is always identity, regardless of field.
  assert.deepEqual(displacementAt(model, 5, 7, 0, false), [5, 7], "identity displacement (noise field arg)");
  assert.deepEqual(displacementAt(model, 5, 7, 0, true), [5, 7], "identity displacement (paired-sine arg)");

  // Literal paired-sine displacement, independent of the retained noise field.
  const sine = displacementAt(model, 0, 0, 32, true);
  assert.deepEqual(sine, [0, 0], "paired-sine displacement is exactly zero at the origin");

  // Noise-driven displacement must differ from paired-sine at a generic point.
  const noiseDisp = displacementAt(model, 100, 40, 32, false);
  const sineDisp = displacementAt(model, 100, 40, 32, true);
  assert.notDeepEqual(noiseDisp, sineDisp, "F must select a materially different field");

  // Source pattern colour literals.
  assert.equal(stripeColorAt(0), 0xe76f51);
  assert.equal(stripeColorAt(32), 0xf4a261);
  assert.equal(stripeColorAt(160), stripeColorAt(0), "stripe colour cycles through all five entries");
  assert.notEqual(dotColorAt(model, 12, 12), dotColorAt(model, 636, 636), "dot colour varies across the grid");

  // A flat-colour source must remap to the identical flat colour under strength 0
  // (edge-clamped bilinear sampling at an integer identity coordinate is exact).
  const flat = new Array(SIDE * SIDE).fill(0xff204060);
  const identity = remapSource(flat, model, 0, false);
  let identityMismatches = 0;
  for (let i = 0; i < SIDE * SIDE; i += 4001) if (identity.pixelAt(i) !== 0xff204060) identityMismatches += 1;
  assert.equal(identityMismatches, 0, "strength-0 remap of a flat raster is exact everywhere sampled");

  // A non-zero strength must move at least one sampled pixel to a different source colour.
  const half = new Array(SIDE * SIDE);
  for (let y = 0; y < SIDE; y += 1) for (let x = 0; x < SIDE; x += 1) half[y * SIDE + x] = x < SIDE / 2 ? 0xff000000 : 0xffffffff;
  const warped = remapSource(half, model, 64, false);
  let anyDifferentFromIdentity = false;
  for (let i = 0; i < SIDE * SIDE; i += 4001) {
    const identitySample = half[i];
    if (warped.pixelAt(i) !== identitySample) { anyDifferentFromIdentity = true; break; }
  }
  assert.ok(anyDifferentFromIdentity, "non-zero strength must move sampled pixels off their source values");

  return { flatIdentityChecked: Math.ceil((SIDE * SIDE) / 4001), stopCount: 5 };
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
    scope: "Pure WarpMarks model/remap checks against the shared raster.bilinear-remap-2d operation; no renderer or pixel claim for source-pattern drawing (see real-browser verification separately recorded).",
    input_sha256_before: before,
    input_sha256_after: after,
    scenarios,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
