#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { separableBlur2D } from "../../packages/javascript/src/separable-blur.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/separable-blur-2d.json");
const FIXTURE = join(ROOT, "fixtures/operations/separable-blur-2d.json");
const SOURCE = join(ROOT, "packages/javascript/src/separable-blur.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkCase(item) {
  if (!item.error) {
    const result = separableBlur2D(item.input);
    assert.deepEqual(result.toValues(), item.output, item.id);
    return result;
  }
  assert.throws(() => separableBlur2D(item.input), (error) => {
    assert.equal(error.code, item.error, item.id);
    return true;
  });
  return null;
}

function ownershipChecks() {
  const config = { source: { width: 2, height: 1, pixels: [0xff112233, 0xffaabbcc] }, kernelX: [1, 2, 1], kernelY: [1], maxSamples: 100 };
  const result = separableBlur2D(config), baseline = result.toValues();
  config.source.pixels[0] = 0; config.kernelX[0] = 99; config.maxSamples = 0;
  assert.deepEqual(result.toValues(), baseline, "input containers detached after construction");
  const detached = result.toValues();
  detached.pixels[0] = 99; detached.pixels.length = 0; detached.width = 99;
  assert.deepEqual(result.toValues(), baseline, "export detached");
  const px = result.pixels(); px[0] = 99;
  assert.deepEqual(result.pixels(), baseline.pixels, "pixels() detached");
  assert.equal(result.width, baseline.width);
  assert.equal(result.height, baseline.height);
  for (const index of [-1, true, NaN, Infinity, 0.5, 9007199254740992, 1n, "0"]) {
    errorCode(() => result.pixelAt(index), "INVALID_INDEX");
  }
  for (const index of [result.width * result.height, Number.MAX_SAFE_INTEGER]) {
    errorCode(() => result.pixelAt(index), "INDEX_OUT_OF_RANGE");
  }
  assert.deepEqual(result.toValues(), baseline);
  return ["input containers detached", "pixels()/toValues() detached", "index precedence: INVALID_INDEX before INDEX_OUT_OF_RANGE"];
}

function nativeChecks() {
  const base = { source: { width: 2, height: 1, pixels: [0xff112233, 0xffaabbcc] }, kernelX: [1, 2, 1], kernelY: [1], maxSamples: 100 };
  errorCode(() => separableBlur2D(null), "INVALID_INPUT");
  errorCode(() => separableBlur2D({ ...base, extra: 1 }), "INVALID_INPUT");
  errorCode(() => separableBlur2D({ ...base, kernelX: [1, 2] }), "INVALID_INPUT");
  errorCode(() => separableBlur2D({ ...base, kernelX: [0, 0, 0] }), "INVALID_INPUT");
  errorCode(() => separableBlur2D({ ...base, kernelX: [-1, 2, -1] }), "INVALID_INPUT");
  errorCode(() => separableBlur2D({ ...base, source: { width: 1, height: 1, pixels: [4294967296] } }), "INVALID_INPUT");
  return ["non-record/extra-key/even-kernel/all-zero-kernel/negative-weight/oversized-pixel carriers"];
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
  const ownership = ownershipChecks(), native = nativeChecks();
  const after = hashes();
  assert.deepEqual(after, before, "source stability");
  const report = {
    status: "passed", operation: fixture.operation, node_version: process.version,
    scope: "Actual JS module fixture/carrier/ownership checks. No renderer/acceptance claim.",
    input_sha256_before: before, input_sha256_after: after,
    scenarios: { fixture_cases: fixture.cases.length, ownership_access: ownership, native_only: native },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
