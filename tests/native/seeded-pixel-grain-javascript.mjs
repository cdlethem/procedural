#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { seededPixelGrain } from "../../packages/javascript/src/seeded-pixel-grain.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/seeded-pixel-grain.json");
const FIXTURE = join(ROOT, "fixtures/operations/seeded-pixel-grain.json");
const SOURCE = join(ROOT, "packages/javascript/src/seeded-pixel-grain.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code = "INVALID_INPUT") => assert.throws(action, (error) => error.code === code);

function checkCase(item) {
  if (item.error) return errorCode(() => seededPixelGrain(item.input), item.error);
  assert.deepStrictEqual(seededPixelGrain(item.input), item.output, item.id);
}

function ownershipAndContinuation(fixture) {
  const first = fixture.cases.find((item) => item.id === "shared-rgb-straight-and-transparent");
  const continued = fixture.cases.find((item) => item.id === "continued-stream");
  const input = structuredClone(first.input);
  const result = seededPixelGrain(input);
  const baseline = structuredClone(result);
  input.source.pixels[0] = 0;
  input.range[0] = 0;
  assert.deepStrictEqual(result, baseline, "input mutation cannot affect returned result");
  result.raster.pixels[0] = 0;
  assert.deepStrictEqual(seededPixelGrain(first.input), first.output, "returned pixels are not retained");
  assert.deepStrictEqual(seededPixelGrain(continued.input), continued.output, "threaded continuation state");
  return ["input/output ownership", "continuation state"];
}

function carrierChecks() {
  const base = { source: { width: 1, height: 1, pixels: [0xff112233] }, mode: "RGB_ADD", range: [0, 1], exponent: 1, rngState: 0, maxWork: 1 };
  class Input {}
  errorCode(() => seededPixelGrain(Object.assign(new Input(), base)));
  const accessor = { ...base };
  Object.defineProperty(accessor, "mode", { enumerable: true, get() { return "RGB_ADD"; } });
  errorCode(() => seededPixelGrain(accessor));
  const sparse = structuredClone(base);
  sparse.source.pixels = new Array(1);
  errorCode(() => seededPixelGrain(sparse));
  const extra = structuredClone(base);
  extra.range.extra = 1;
  errorCode(() => seededPixelGrain(extra));
  for (const invalid of [NaN, Infinity, -Infinity]) {
    errorCode(() => seededPixelGrain({ ...base, exponent: invalid }));
    errorCode(() => seededPixelGrain({ ...base, range: [invalid, 1] }));
    errorCode(() => seededPixelGrain({ ...base, source: { ...base.source, pixels: [invalid] } }));
  }
  return ["passive records/arrays", "NaN and infinities rejected before work"];
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
  const ownership = ownershipAndContinuation(fixture);
  const carriers = carrierChecks();
  const after = hashes();
  assert.deepStrictEqual(after, before, "source stability");
  const report = {
    status: "passed", operation: fixture.operation, node_version: process.version,
    scope: "Actual JS seeded-pixel-grain core against frozen shared golden fixtures plus passive carrier, ownership and continuation checks. No renderer or acceptance claim.",
    input_sha256_before: before, input_sha256_after: after,
    scenarios: { fixture_cases: fixture.cases.length, ownership_continuation: ownership, javascript_only: carriers },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
