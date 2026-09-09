#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { delaunay2D } from "../../packages/javascript/src/delaunay.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/delaunay-2d.json");
const FIXTURE = join(ROOT, "fixtures/operations/delaunay-2d.json");
const SOURCE = join(ROOT, "packages/javascript/src/delaunay.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

const BIT_BUFFER = new ArrayBuffer(8);
const BIT_FLOAT = new Float64Array(BIT_BUFFER);
const BIT_UINT = new BigUint64Array(BIT_BUFFER);
function bitsHex(value) { BIT_FLOAT[0] = value; return BIT_UINT[0].toString(16).padStart(16, "0"); }
function checkCase(item) {
  if (!item.error) {
    const result = delaunay2D(item.input);
    assert.deepEqual(result.toValues(), item.output, item.id);
    if (item.comparison && item.comparison.points_bits_hex) {
      const values = result.toValues();
      for (let i = 0; i < values.points.length; i += 1) {
        for (let axis = 0; axis < 2; axis += 1) {
          assert.equal(bitsHex(values.points[i][axis]), item.comparison.points_bits_hex[i][axis], item.id);
        }
      }
    }
    return result;
  }
  assert.throws(() => delaunay2D(item.input), (error) => {
    assert.equal(error.code, item.error, item.id);
    if (item.error_detail) {
      assert.equal(error.workUsed, item.error_detail.workUsed, item.id);
      assert.equal(error.stage, item.error_detail.stage, item.id);
    }
    return true;
  });
  return null;
}

function crossChecks(fixture, results) {
  const executed = [];
  for (const check of fixture.cross_case_checks) {
    if (check.kind === "same-coordinate-topology") {
      const expected = fixture.cases.find((item) => item.id === check.cases[0]).output;
      for (const id of check.cases.slice(1)) {
        const values = results.get(id).toValues();
        for (const field of ["points", "triangles", "edges", "edgeFaces", "workUsed"]) {
          assert.deepEqual(values[field], expected[field], check.id);
        }
      }
    } else if (check.kind === "canonical-positive-zero") {
      const values = results.get(check.case).toValues();
      for (const index of check.point_indices) {
        for (const axis of [0, 1]) {
          assert.equal(bitsHex(values.points[index][axis]), "0000000000000000", check.id);
        }
      }
    } else if (check.kind === "exact-work-threshold") {
      assert.equal(results.get(check.success_case).toValues().workUsed, check.work_used, check.id);
      const failure = fixture.cases.find((item) => item.id === check.failure_case);
      assert.equal(failure.error_detail.workUsed, check.work_used - 1, check.id);
    } else if (check.kind === "one-short-stage-witnesses") {
      for (const [stage, id] of Object.entries(check.stages)) {
        const item = fixture.cases.find((c) => c.id === id);
        assert.equal(item.error, "WORK_LIMIT_EXCEEDED", check.id);
        assert.equal(item.input.maxWork, check.thresholds.one_short_max_work[stage], check.id);
        assert.equal(item.error_detail.stage, stage, check.id);
      }
      const canonicalizeCase = fixture.cases.find((c) => c.id === check.stages.canonicalize);
      assert.equal(canonicalizeCase.input.points.length, check.thresholds.first_charge_after.canonicalize, check.id);
    } else throw new Error("Unhandled cross-case kind: " + check.kind);
    executed.push(check.id);
  }
  return executed;
}

function ownershipChecks() {
  const config = { points: [[0, 0], [1, 0], [1, 1], [0, 1], [0.25, 0.25]], maxWork: 9007199254740991 };
  const result = delaunay2D(config), baseline = result.toValues();
  config.points[0][0] = 99;
  config.points[4] = [5, 5];
  config.maxWork = 0;
  assert.deepEqual(result.toValues(), baseline);
  result.pointAt(0).fill(77);
  result.triangleAt(0).fill(77);
  result.edgeAt(0).fill(77);
  result.edgeFacesAt(0).fill(77);
  const detached = result.toValues();
  detached.points[0].fill(77); detached.inputToVertex.fill(77); detached.sourceIndices.fill(77);
  detached.triangles[0].fill(77); detached.edges[0].fill(77); detached.edgeFaces[0].fill(77);
  detached.workUsed = 99;
  assert.deepEqual(result.toValues(), baseline);
  assert.equal(result.inputCount, baseline.inputToVertex.length);
  assert.equal(result.vertexCount, baseline.points.length);
  assert.equal(result.faceCount, baseline.triangles.length);
  assert.equal(result.edgeCount, baseline.edges.length);
  assert.equal(result.workUsed, baseline.workUsed);
  for (const out of [Array(6).fill(9), new Float64Array(6).fill(9), Array(6)]) {
    assert.equal(result.pointInto(0, out, 1), out);
    assert.deepEqual(Array.from(out).slice(1, 3), baseline.points[0]);
  }
  for (const out of [Array(8).fill(9), new Int32Array(8).fill(9), Array(8)]) {
    assert.equal(result.triangleInto(0, out, 1), out);
    assert.deepEqual(Array.from(out).slice(1, 4), baseline.triangles[0]);
  }
  for (const out of [Array(6).fill(9), new Int32Array(6).fill(9), Array(6)]) {
    assert.equal(result.edgeInto(0, out, 1), out);
    assert.deepEqual(Array.from(out).slice(1, 3), baseline.edges[0]);
    assert.equal(result.edgeFacesInto(0, out, 1), out);
    assert.deepEqual(Array.from(out).slice(1, 3), baseline.edgeFaces[0]);
  }
  assert.equal(result.inputVertexAt(0), baseline.inputToVertex[0]);
  assert.equal(result.sourceIndexAt(0), baseline.sourceIndices[0]);
  const mixed = [9, 9, 9, 9];
  Object.defineProperty(mixed, "1", { writable: false });
  const badPointOutputs = [mixed, Object.freeze([1, 2]), [1], new Float32Array(5), new Int32Array(5), {}, null];
  for (const out of badPointOutputs) {
    const before = out === null ? null : Object.getOwnPropertyDescriptors(out);
    errorCode(() => result.pointInto(0, out), "INVALID_OUTPUT");
    assert.deepEqual(out === null ? null : Object.getOwnPropertyDescriptors(out), before);
  }
  const badIntOutputs = [mixed, Object.freeze([1, 2, 3]), [1], new Float64Array(5), new Float32Array(5), {}, null];
  for (const out of badIntOutputs) {
    const before = out === null ? null : Object.getOwnPropertyDescriptors(out);
    for (const access of [() => result.triangleInto(0, out), () => result.edgeInto(0, out), () => result.edgeFacesInto(0, out)]) {
      errorCode(access, "INVALID_OUTPUT");
    }
    assert.deepEqual(out === null ? null : Object.getOwnPropertyDescriptors(out), before);
  }
  for (const index of [-1, true, NaN, Infinity, 0.5, 9007199254740992, 1n, "0"]) {
    for (const access of [
      () => result.pointAt(index), () => result.triangleAt(index),
      () => result.edgeAt(index), () => result.edgeFacesAt(index),
      () => result.inputVertexAt(index), () => result.sourceIndexAt(index),
      () => result.pointInto(index, [0, 0]), () => result.triangleInto(index, [0, 0, 0]),
      () => result.edgeInto(index, [0, 0]), () => result.edgeFacesInto(index, [0, 0]),
    ]) errorCode(access, "INVALID_INDEX");
  }
  const rangeAccesses = [
    () => result.pointAt(result.vertexCount), () => result.sourceIndexAt(result.vertexCount),
    () => result.pointInto(result.vertexCount, [0, 0]),
    () => result.triangleAt(result.faceCount), () => result.triangleInto(result.faceCount, [0, 0, 0]),
    () => result.edgeAt(result.edgeCount), () => result.edgeFacesAt(result.edgeCount),
    () => result.edgeInto(result.edgeCount, [0, 0]), () => result.edgeFacesInto(result.edgeCount, [0, 0]),
    () => result.inputVertexAt(result.inputCount),
    () => result.pointAt(Number.MAX_SAFE_INTEGER), () => result.inputVertexAt(Number.MAX_SAFE_INTEGER),
  ];
  for (const access of rangeAccesses) errorCode(access, "INDEX_OUT_OF_RANGE");
  for (const offset of [-1, true, NaN, Infinity, 0.5, 1n, "0"]) {
    const out = [9, 9];
    errorCode(() => result.pointInto(0, out, offset), "INVALID_OUTPUT");
    assert.deepEqual(out, [9, 9]);
  }
  const shortOut = [9, 9];
  errorCode(() => result.pointInto(0, shortOut, 2), "INVALID_OUTPUT");
  assert.deepEqual(shortOut, [9, 9]);
  assert.deepEqual(result.toValues(), baseline);
  return ["input containers detached", "At carriers and export detached", "ordinary/sparse/typed Into outputs",
    "mixed/frozen/short/wrong outputs atomic", "all accessor index/range precedence", "invalid offsets atomic"];
}

function nativeChecks() {
  const base = { points: [[0, 0], [1, 0], [0, 1]], maxWork: 5 };
  for (const value of [NaN, Infinity, -Infinity]) {
    for (const axis of [0, 1]) {
      const points = base.points.map((pair) => [pair[0], pair[1]]);
      points[0][axis] = value;
      errorCode(() => delaunay2D({ points, maxWork: base.maxWork }), "INVALID_INPUT");
    }
    errorCode(() => delaunay2D({ points: base.points, maxWork: value }), "INVALID_INPUT");
  }
  class Config {}
  class Pair extends Array {}
  for (const input of [
    Object.assign(new Config(), base),
    { points: [new Float64Array([0, 0]), [1, 0], [0, 1]], maxWork: 5 },
    { points: [[0, 0], new Pair(1, 0), [0, 1]], maxWork: 5 },
    { points: [[0, 0], [1, 0], [0, 1]], maxWork: 5n },
    { points: [[0, 0], [1, 0], [0, 1]], maxWork: new Number(5) },
  ]) {
    errorCode(() => delaunay2D(input), "INVALID_INPUT");
  }
  assert.deepEqual(delaunay2D(Object.assign(Object.create(null), base)).toValues(),
    delaunay2D(base).toValues());
  return ["nonfinite-and-overflowing-numeric-carriers (JavaScript applicable carriers)", "passive-input-carriers-only"];
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output") throw new Error("Usage: --output FRESH_JSON_PATH");
  const output = resolve(args[1]);
  if (!output.startsWith(join(ROOT, ".work") + sep) || existsSync(output)) throw new Error("Output must be fresh and under .work");
  const fixture = JSON.parse(readFileSync(FIXTURE));
  assert.equal(fixture.catalog_sha256, sha(CATALOG), "fixture catalog binding");
  const before = hashes(), results = new Map();
  for (const item of fixture.cases) results.set(item.id, checkCase(item));
  const cross = crossChecks(fixture, results);
  const ownership = ownershipChecks(), native = nativeChecks();
  const after = hashes();
  assert.deepEqual(after, before, "source stability");
  const report = {
    status: "passed",
    operation: fixture.operation,
    node_version: process.version,
    scope: "Actual JS module golden, carrier, access and cross-case checks against the frozen delaunay-2d fixtures. No renderer/acceptance claim.",
    input_sha256_before: before,
    input_sha256_after: after,
    scenarios: {
      fixture_cases: fixture.cases.length,
      cross_case_checks: cross,
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
