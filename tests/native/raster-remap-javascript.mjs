#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { bilinearRasterRemap2D } from "../../packages/javascript/src/raster-remap.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/bilinear-raster-remap.json");
const FIXTURE = join(ROOT, "fixtures/operations/bilinear-raster-remap.json");
const SOURCE = join(ROOT, "packages/javascript/src/raster-remap.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkCase(item) {
  if (item.error) {
    assert.throws(() => bilinearRasterRemap2D(item.input), (error) => {
      assert.equal(error.code, item.error, item.id);
      return true;
    });
    return null;
  }
  const raster = bilinearRasterRemap2D(item.input);
  assert.deepStrictEqual(raster.toValues(), item.output, item.id);
  return raster;
}

function ownershipChecks() {
  const config = { source: { width: 2, height: 2, pixels: [0, 0xff000000, 0x00ff0000, 0x0000ff00] },
    outputWidth: 2, outputHeight: 2, sourceCoordinates: [[0, 0], [1, 0], [0, 1], [1, 1]] };
  const raster = bilinearRasterRemap2D(config);
  const baseline = raster.toValues();
  config.source.pixels[0] = 99;
  config.source.width = 99;
  config.sourceCoordinates[0][0] = 99;
  assert.deepStrictEqual(raster.toValues(), baseline, "input detachment");
  const exportedPixels = raster.pixels();
  exportedPixels[0] = 77;
  assert.deepStrictEqual(raster.toValues(), baseline, "pixels() export detachment");
  const exported = raster.toValues();
  exported.pixels[0] = 77;
  exported.width = 77;
  assert.deepStrictEqual(raster.toValues(), baseline, "toValues() export detachment");
  assert.equal(raster.width, 2);
  assert.equal(raster.height, 2);
  assert.equal(raster.pixelAt(0), baseline.pixels[0]);
  for (const index of [-1, true, NaN, Infinity, 0.5, 9007199254740992, 1n, "0"]) {
    errorCode(() => raster.pixelAt(index), "INVALID_INDEX");
  }
  errorCode(() => raster.pixelAt(4), "INDEX_OUT_OF_RANGE");
  return ["input containers detached", "pixels/toValues export detached", "pixelAt index/range precedence"];
}

function nativeChecks() {
  const base = { source: { width: 1, height: 1, pixels: [0] }, outputWidth: 1, outputHeight: 1, sourceCoordinates: [[0, 0]] };
  for (const value of [NaN, Infinity, -Infinity]) {
    errorCode(() => bilinearRasterRemap2D({ ...base, sourceCoordinates: [[value, 0]] }), "INVALID_INPUT");
  }
  class Config {}
  for (const input of [
    Object.assign(new Config(), base),
    { ...base, source: Object.assign(new Config(), base.source) },
  ]) {
    errorCode(() => bilinearRasterRemap2D(input), "INVALID_INPUT");
  }
  assert.deepStrictEqual(bilinearRasterRemap2D(Object.assign(Object.create(null), base)).toValues(),
    bilinearRasterRemap2D(base).toValues());
  return ["nonfinite-coordinate-carriers (JavaScript applicable carriers)", "passive-input-carriers-only"];
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
    scope: "Actual JS module golden, carrier and access checks against the frozen bilinear-raster-remap fixtures. No renderer/acceptance claim.",
    input_sha256_before: before,
    input_sha256_after: after,
    scenarios: {
      fixture_cases: fixture.cases.length,
      ownership_access: ownership,
      native_only: native,
    },
    allocation_failure: { executed: false, source_review: "Output exports allocate detached arrays and do not mutate retained private arrays; a failed generation exposes no result. No controlled host allocation failure injected." },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
