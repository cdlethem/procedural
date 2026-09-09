#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { annularSolid3D, FaceLimitError, MeshArithmeticError, MeshError } from "../../packages/javascript/src/annular-mesh.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/annular-solid-3d.json");
const FIXTURE = join(ROOT, "fixtures/operations/annular-solid-3d.json");
const SOURCE = join(ROOT, "packages/javascript/src/annular-mesh.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkTriple(actual, expected, allowance, label) {
  for (let i = 0; i < 3; i += 1) {
    const diff = Math.abs(actual[i] - expected[i]);
    assert.ok(diff <= allowance[i], `${label}[${i}]: ${actual[i]} vs ${expected[i]} (allowance ${allowance[i]}, diff ${diff})`);
  }
}

function unwrap(triple) { return triple.map((component) => component.value); }

function checkCase(item) {
  if (!item.error) {
    const mesh = annularSolid3D(item.input);
    const values = mesh.toValues();
    assert.equal(values.positions.length, item.output.positions.length, item.id + " vertex count");
    assert.equal(values.triangles.length, item.output.triangles.length, item.id + " face count");
    for (let i = 0; i < values.positions.length; i += 1) {
      checkTriple(values.positions[i], unwrap(item.output.positions[i]), item.comparison.positions_abs[i], item.id + " position " + i);
    }
    for (let i = 0; i < values.normals.length; i += 1) {
      checkTriple(values.normals[i], unwrap(item.output.normals[i]), item.comparison.normals_abs[i], item.id + " normal " + i);
      assert.deepEqual(values.triangles[i], item.output.triangles[i], item.id + " triangle " + i);
      assert.equal(values.faceKinds[i], item.output.faceKinds[i], item.id + " faceKind " + i);
      assert.equal(values.cells[i], item.output.cells[i], item.id + " cell " + i);
    }
    return mesh;
  }
  assert.throws(() => annularSolid3D(item.input), (error) => {
    assert.equal(error.code, item.error, item.id);
    if (item.error_detail) {
      assert.equal(error.faceIndex, item.error_detail.faceIndex, item.id + " faceIndex");
      assert.equal(error.stage, item.error_detail.stage, item.id + " stage");
    }
    return true;
  });
  return null;
}

function ownershipChecks() {
  const mesh = annularSolid3D({ outerRadius: 2, innerRadius: 1, bottomZ: -1, topZ: 1, slices: 4, maxFaces: 32 });
  const baseline = mesh.toValues();
  assert.equal(mesh.vertexCount, 16);
  assert.equal(mesh.faceCount, 32);
  assert.deepEqual(mesh.vertexAt(0), baseline.positions[0]);
  assert.deepEqual(mesh.normalAt(0), baseline.normals[0]);
  assert.deepEqual(mesh.triangleAt(0), baseline.triangles[0]);
  assert.equal(mesh.faceKindAt(0), baseline.faceKinds[0]);
  assert.equal(mesh.cellAt(0), baseline.cells[0]);

  for (const out of [Array(5).fill(9), new Float64Array(5).fill(9)]) {
    mesh.vertexInto(0, out, 1);
    assert.deepEqual(Array.from(out).slice(1, 4), baseline.positions[0]);
  }
  const badOutputs = [Object.freeze([1, 2, 3]), [1], {}, null];
  for (const out of badOutputs) errorCode(() => mesh.vertexInto(0, out, 0), "INVALID_OUTPUT");
  for (const index of [-1, true, NaN, Infinity, 0.5, 9007199254740992, "0"]) {
    for (const access of [() => mesh.vertexAt(index), () => mesh.normalAt(index), () => mesh.triangleAt(index)]) {
      errorCode(access, "INVALID_INDEX");
    }
  }
  for (const index of [mesh.vertexCount, Number.MAX_SAFE_INTEGER]) {
    errorCode(() => mesh.vertexAt(index), "INDEX_OUT_OF_RANGE");
  }
  for (const index of [mesh.faceCount, Number.MAX_SAFE_INTEGER]) {
    errorCode(() => mesh.normalAt(index), "INDEX_OUT_OF_RANGE");
  }
  assert.deepEqual(mesh.toValues(), baseline);
  return ["accessors match toValues() baseline", "ordinary/Float64Array Into outputs",
    "frozen/short/wrong outputs rejected", "index precedence: INVALID_INDEX before INDEX_OUT_OF_RANGE"];
}

function nativeChecks() {
  errorCode(() => annularSolid3D(null), "INVALID_INPUT");
  const base = { outerRadius: 2, innerRadius: 1, bottomZ: -1, topZ: 1, slices: 3, maxFaces: 24 };
  errorCode(() => annularSolid3D({ ...base, extra: 1 }), "INVALID_INPUT");
  assert.throws(() => annularSolid3D({ ...base, maxFaces: 23 }), FaceLimitError);
  assert.throws(() => annularSolid3D({ ...base, bottomZ: -1.7976931348623157e+308, topZ: 1.7976931348623157e+308 }), MeshArithmeticError);
  return ["non-record/extra-key carriers", "FaceLimitError/MeshArithmeticError instance types"];
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
    scope: "Actual JS module fixture (per-element positions_abs/normals_abs tolerance, exact topology/kinds/cells) plus ownership/carrier checks. Trig uses JS-native Math.sin/cos/sqrt per the contract's per-target numerics policy; no cross-language bit-exactness claim. No renderer/acceptance claim.",
    input_sha256_before: before, input_sha256_after: after,
    scenarios: { fixture_cases: fixture.cases.length, ownership_access: ownership, native_only: native },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
