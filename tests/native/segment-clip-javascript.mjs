#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { clipSegmentsSimplePolygon2D } from "../../packages/javascript/src/segment-clip.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/clip-segments-simple-polygon-2d.json");
const FIXTURE = join(ROOT, "fixtures/operations/clip-segments-simple-polygon-2d.json");
const SOURCE = join(ROOT, "packages/javascript/src/segment-clip.js");
const RATIONAL_SOURCE = join(ROOT, "packages/javascript/src/internal/exact-rational.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, RATIONAL_SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

const BIT_BUFFER = new ArrayBuffer(8);
const BIT_FLOAT = new Float64Array(BIT_BUFFER);
const BIT_UINT = new BigUint64Array(BIT_BUFFER);
function bitsHex(value) { BIT_FLOAT[0] = value; return BIT_UINT[0].toString(16).padStart(16, "0"); }

function checkCase(item) {
  if (!item.error) {
    const result = clipSegmentsSimplePolygon2D(item.input);
    assert.deepEqual(result.toValues(), item.output, item.id);
    if (item.output_bits) {
      const values = result.toValues();
      for (let i = 0; i < values.segments.length; i += 1) {
        for (let c = 0; c < 4; c += 1) assert.equal(bitsHex(values.segments[i][c]), item.output_bits.segments[i][c], item.id + " segment bits");
      }
      for (let i = 0; i < values.intervals.length; i += 1) {
        for (let c = 0; c < 2; c += 1) assert.equal(bitsHex(values.intervals[i][c]), item.output_bits.intervals[i][c], item.id + " interval bits");
      }
    }
    return result;
  }
  assert.throws(() => clipSegmentsSimplePolygon2D(item.input), (error) => {
    assert.equal(error.code, item.error, item.id);
    if (item.error_detail) {
      if ("sourceIndex" in item.error_detail) assert.equal(error.sourceIndex, item.error_detail.sourceIndex, item.id + " sourceIndex");
      if ("intervalIndex" in item.error_detail) assert.equal(error.intervalIndex, item.error_detail.intervalIndex, item.id + " intervalIndex");
      if ("stage" in item.error_detail) assert.equal(error.stage, item.error_detail.stage, item.id + " stage");
    }
    return true;
  });
  return null;
}

function ownershipChecks() {
  const config = { polygon: [[0, 0], [4, 0], [4, 4], [0, 4]], segments: [[-1, 2, 5, 2]], maxWork: 216, maxOutputSegments: 16 };
  const result = clipSegmentsSimplePolygon2D(config), baseline = result.toValues();
  config.polygon[0][0] = 99; config.segments[0][0] = 99; config.maxWork = 0;
  assert.deepEqual(result.toValues(), baseline, "input record detached after construction");
  const detached = result.toValues();
  detached.segments[0][0] = 77; detached.segments.length = 0; detached.sourceIndices.length = 0;
  assert.deepEqual(result.toValues(), baseline, "export detached");
  assert.equal(result.size, baseline.segments.length);
  assert.equal(result.sourceIndexAt(0), baseline.sourceIndices[0]);
  assert.deepEqual(result.segmentAt(0), baseline.segments[0]);
  assert.deepEqual(result.intervalAt(0), baseline.intervals[0]);
  for (const out of [Array(6).fill(9), new Float64Array(6).fill(9)]) {
    result.segmentInto(0, out, 1);
    assert.deepEqual(Array.from(out).slice(1, 5), baseline.segments[0]);
  }
  for (const out of [Array(4).fill(9), new Float64Array(4).fill(9)]) {
    result.intervalInto(0, out, 1);
    assert.deepEqual(Array.from(out).slice(1, 3), baseline.intervals[0]);
  }
  const badOutputs = [Object.freeze([1, 2, 3, 4]), [1, 2], {}, null];
  for (const out of badOutputs) errorCode(() => result.segmentInto(0, out, 0), "INVALID_OUTPUT");
  for (const index of [-1, true, NaN, Infinity, 0.5, 9007199254740992, "0"]) {
    for (const access of [() => result.sourceIndexAt(index), () => result.segmentAt(index), () => result.intervalAt(index)]) {
      errorCode(access, "INVALID_INDEX");
    }
  }
  for (const index of [result.size, Number.MAX_SAFE_INTEGER]) {
    for (const access of [() => result.sourceIndexAt(index), () => result.segmentAt(index), () => result.intervalAt(index)]) {
      errorCode(access, "INDEX_OUT_OF_RANGE");
    }
  }
  assert.deepEqual(result.toValues(), baseline);
  return ["input containers detached", "export detached", "ordinary/Float64Array Into outputs", "frozen/short/wrong outputs rejected", "index precedence: INVALID_INDEX before INDEX_OUT_OF_RANGE"];
}

function nativeChecks() {
  const base = { polygon: [[0, 0], [4, 0], [4, 4], [0, 4]], segments: [[-1, 2, 5, 2]], maxWork: 216, maxOutputSegments: 16 };
  errorCode(() => clipSegmentsSimplePolygon2D(null), "INVALID_INPUT");
  errorCode(() => clipSegmentsSimplePolygon2D({ ...base, extra: 1 }), "INVALID_INPUT");
  errorCode(() => clipSegmentsSimplePolygon2D({ ...base, polygon: [[0, 0], [1, 0]] }), "INVALID_INPUT");
  errorCode(() => clipSegmentsSimplePolygon2D({ ...base, segments: [[0, 0, true, 1]] }), "INVALID_INPUT");
  return ["non-record/extra-key/too-few-vertices/boolean-coordinate carriers"];
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
