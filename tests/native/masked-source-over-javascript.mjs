#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { maskedSourceOver2D } from "../../packages/javascript/src/masked-source-over.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/masked-source-over.json");
const FIXTURE = join(ROOT, "fixtures/operations/masked-source-over.json");
const SOURCE = join(ROOT, "packages/javascript/src/masked-source-over.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkCase(item) {
  if (!item.error) {
    const result = maskedSourceOver2D(item.input);
    assert.deepEqual(result.toValues(), item.output, item.id);
    return result;
  }
  assert.throws(() => maskedSourceOver2D(item.input), (error) => {
    assert.equal(error.code, item.error, item.id);
    return true;
  });
  return null;
}

function ownershipChecks() {
  const config = { source: { width: 1, height: 1, pixels: [0xff112233] }, destination: { width: 1, height: 1, pixels: [0xffaabbcc] }, mask: [0.5] };
  const result = maskedSourceOver2D(config), baseline = result.toValues();
  config.source.pixels[0] = 0; config.mask[0] = 0; config.mask.push(1);
  assert.deepEqual(result.toValues(), baseline, "input record detached after construction");
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
  for (const index of [1, Number.MAX_SAFE_INTEGER]) {
    errorCode(() => result.pixelAt(index), "INDEX_OUT_OF_RANGE");
  }
  assert.deepEqual(result.toValues(), baseline);
  return ["input containers detached", "pixels()/toValues() detached", "index precedence: INVALID_INDEX before INDEX_OUT_OF_RANGE"];
}

function nativeChecks() {
  const base = { source: { width: 1, height: 1, pixels: [0xff112233] }, destination: { width: 1, height: 1, pixels: [0xffaabbcc] }, mask: [0.5] };
  errorCode(() => maskedSourceOver2D(null), "INVALID_INPUT");
  errorCode(() => maskedSourceOver2D({ ...base, extra: 1 }), "INVALID_INPUT");
  errorCode(() => maskedSourceOver2D({ ...base, destination: { width: 2, height: 1, pixels: [1, 2] } }), "INVALID_INPUT");
  errorCode(() => maskedSourceOver2D({ ...base, mask: [0.5, 0.5] }), "INVALID_INPUT");
  errorCode(() => maskedSourceOver2D({ ...base, mask: [-0.1] }), "INVALID_INPUT");
  errorCode(() => maskedSourceOver2D({ ...base, mask: [1.1] }), "INVALID_INPUT");
  errorCode(() => maskedSourceOver2D({ ...base, source: { width: 1, height: 1, pixels: [4294967296] } }), "INVALID_INPUT");
  errorCode(() => maskedSourceOver2D({ ...base, source: { width: 0, height: 1, pixels: [] } }), "INVALID_INPUT");
  // Zero mask and transparent-source identity branches must preserve destination exactly.
  const zeroMask = maskedSourceOver2D({ ...base, mask: [0] });
  assert.deepEqual(zeroMask.toValues().pixels, [0xffaabbcc]);
  const transparentSource = maskedSourceOver2D({ ...base, source: { width: 1, height: 1, pixels: [0x00112233] } });
  assert.deepEqual(transparentSource.toValues().pixels, [0xffaabbcc]);
  const nz = maskedSourceOver2D({ ...base, mask: [-0] });
  assert.deepEqual(nz.toValues().pixels, [0xffaabbcc]);
  return ["non-record/extra-key/mismatched-dims/wrong-mask-count/out-of-range-mask/oversized-pixel/degenerate-dims",
    "zero-mask and transparent-source identity branches preserve destination", "negative-zero mask equals zero"];
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
