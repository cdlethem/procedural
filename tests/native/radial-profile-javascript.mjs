#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { RadialProfile3D, RadialProfileError } from "../../packages/javascript/src/radial-profile.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = join(ROOT, "packages/javascript/src/radial-profile.js"), fixtureFile = join(ROOT, "fixtures/operations/radial-profile-surface.json"), catalogFile = join(ROOT, "catalog/operations/radial-profile-surface.json");
const fixture = JSON.parse(readFileSync(fixtureFile));
const sha = file => createHash("sha256").update(readFileSync(file)).digest("hex");
const bits = value => { const data = new DataView(new ArrayBuffer(8)); data.setFloat64(0, value); return data.getBigUint64(0).toString(16).padStart(16, "0"); };
const args = process.argv.slice(2); if (args.length !== 2 || args[0] !== "--output") throw new Error("Usage: --output FRESH_FILE");
const output = resolve(args[1]); if (!output.startsWith(join(ROOT, ".work") + sep) || existsSync(output)) throw new Error("Output must be fresh under .work");
const inputs = [source, fileURLToPath(import.meta.url), fixtureFile, catalogFile];
const bindings = () => Object.fromEntries(inputs.map(file => [file.slice(ROOT.length + 1), sha(file)]));
const before = bindings();
function caught(action) { try { action(); return null; } catch (error) { return error instanceof RadialProfileError ? { code: error.code, faceIndex: error.faceIndex, stage: error.stage } : { code: `UNEXPECTED:${error?.name}` }; } }
function outputFor(case_) { return { positions: case_.output.positions.map(row => row.map(value => value.value)), triangles: case_.output.triangles, normals: case_.output.normals.map(row => row.map(value => value.value)), faceKinds: case_.output.faceKinds, bands: case_.output.bands, cells: case_.output.cells }; }
function checkSuccess(case_, result) {
  const actual = result.toValues(), expected = outputFor(case_);
  assert.deepEqual(Object.keys(actual), ["positions", "triangles", "normals", "faceKinds", "bands", "cells"], `${case_.id} output keys`);
  for (const key of ["positions", "triangles", "normals", "faceKinds", "bands", "cells"]) assert.equal(actual[key].length, expected[key].length, `${case_.id} ${key} length`);
  for (const key of ["triangles", "faceKinds", "bands", "cells"]) assert.deepEqual(actual[key], expected[key], `${case_.id} ${key}`);
  for (const key of ["positions", "normals"]) for (let i = 0; i < expected[key].length; i += 1) for (let axis = 0; axis < 3; axis += 1) {
    assert.equal(actual[key][i].length, 3, `${case_.id} ${key} triple`);
    const value = actual[key][i][axis], target = case_.output[key][i][axis], allowance = case_.comparison[`${key}_abs`][i][axis];
    assert.ok(Number.isFinite(value), `${case_.id} ${key} finite`); if (value === 0) assert.equal(bits(value), "0000000000000000", `${case_.id} ${key} +0`);
    if (allowance === 0) assert.equal(bits(value), target.bits_hex, `${case_.id} ${key} exact`); else assert.ok(Math.abs(value - target.value) <= allowance, `${case_.id} ${key} allowance`);
  }
}
assert.equal(fixture.catalog_sha256, sha(catalogFile), "fixture catalog binding");
const results = new Map();
for (const case_ of fixture.cases) {
  if (case_.error) { const error = caught(() => RadialProfile3D.generate(case_.input)); assert.equal(error.code, case_.error, case_.id); if (case_.error_detail) assert.deepEqual({ faceIndex: error.faceIndex, stage: error.stage }, case_.error_detail, `${case_.id} detail`); }
  else { const result = RadialProfile3D.generate(case_.input); checkSuccess(case_, result); results.set(case_.id, result); }
}
const config = { profile: [[0, 2], [1, .75], [3, 2]], slices: 4, capStart: true, capEnd: true, maxFaces: 1000 };
const mesh = RadialProfile3D.generate(config), baseline = mesh.toValues(), replay = RadialProfile3D.generate(config);
assert.deepEqual(mesh.toValues().positions.map(row => row.map(bits)), replay.toValues().positions.map(row => row.map(bits)), "same-runtime positions"); assert.deepEqual(mesh.toValues().normals.map(row => row.map(bits)), replay.toValues().normals.map(row => row.map(bits)), "same-runtime normals");
config.profile[0][0] = 99; config.profile.length = 0; config.slices = 3; assert.deepEqual(mesh.toValues(), baseline, "input detached");
const vertex = mesh.vertexAt(0), triangle = mesh.triangleAt(0), normal = mesh.normalAt(0), values = mesh.toValues(); vertex[0] = 99; triangle[0] = 99; normal[0] = 99; values.positions[0][0] = 99; values.triangles[0][0] = 99; values.normals[0][0] = 99; values.faceKinds.length = 0; values.bands.length = 0; values.cells.length = 0; assert.deepEqual(mesh.toValues(), baseline, "output detached");
assert.equal(mesh.vertexCount(), baseline.positions.length, "vertex count"); assert.equal(mesh.faceCount(), baseline.triangles.length, "face count");
for (let i = 0; i < mesh.vertexCount(); i += 1) assert.deepEqual(mesh.vertexAt(i), baseline.positions[i], "vertex accessor");
for (let i = 0; i < mesh.faceCount(); i += 1) { assert.deepEqual(mesh.triangleAt(i), baseline.triangles[i], "triangle accessor"); assert.deepEqual(mesh.normalAt(i), baseline.normals[i], "normal accessor"); assert.equal(mesh.faceKindAt(i), baseline.faceKinds[i], "kind accessor"); assert.equal(mesh.bandAt(i), baseline.bands[i], "band accessor"); assert.equal(mesh.cellAt(i), baseline.cells[i], "cell accessor"); }
for (const [method, count] of [["vertexAt", mesh.vertexCount()], ["triangleAt", mesh.faceCount()], ["normalAt", mesh.faceCount()], ["faceKindAt", mesh.faceCount()], ["bandAt", mesh.faceCount()], ["cellAt", mesh.faceCount()]]) for (const index of [-1, true, NaN, Infinity, .5, SAFE(), 1n, "0"]) assert.equal(caught(() => mesh[method](index)).code, "INVALID_INDEX", `${method} index`);
function SAFE() { return Number.MAX_SAFE_INTEGER + 1; }
for (const [method, count] of [["vertexAt", mesh.vertexCount()], ["triangleAt", mesh.faceCount()], ["normalAt", mesh.faceCount()], ["faceKindAt", mesh.faceCount()], ["bandAt", mesh.faceCount()], ["cellAt", mesh.faceCount()]]) assert.equal(caught(() => mesh[method](count)).code, "INDEX_OUT_OF_RANGE", `${method} range`);
for (const [method, index, out, accessor] of [["vertexInto", 0, new Float64Array(6).fill(9), "vertexAt"], ["normalInto", 0, [9, 9, 9, 9, 9, 9], "normalAt"], ["triangleInto", 0, new Int32Array(6).fill(9), "triangleAt"], ["triangleInto", 0, [9, 9, 9, 9, 9, 9], "triangleAt"]]) { const original = Array.from(out); assert.equal(mesh[method](index, out, 2), out, `${method} result`); assert.deepEqual(Array.from(out).slice(2, 5), mesh[accessor](index), `${method} triple`); assert.deepEqual(Array.from(out).slice(0, 2).concat(Array.from(out).slice(5)), original.slice(0, 2).concat(original.slice(5)), `${method} sentinels`); }
for (const method of ["vertexInto", "normalInto", "triangleInto"]) { const out = method === "triangleInto" ? [9, 9, 9, 9] : [9, 9, 9, 9]; const beforeOut = out.slice(); assert.equal(caught(() => mesh[method](-1, out, -1)).code, "INVALID_INDEX"); assert.deepEqual(out, beforeOut); assert.equal(caught(() => mesh[method](mesh.faceCount() + (method === "vertexInto" ? mesh.vertexCount() - mesh.faceCount() : 0), out, -1)).code, "INDEX_OUT_OF_RANGE"); assert.deepEqual(out, beforeOut); assert.equal(caught(() => mesh[method](0, null, 0)).code, "INVALID_OUTPUT"); assert.deepEqual(out, beforeOut); }
for (const method of ["vertexInto", "normalInto", "triangleInto"]) for (const out of [new Float32Array(3), [9], Object.freeze([9, 9, 9]), {}, null]) assert.equal(caught(() => mesh[method](0, out, 0)).code, "INVALID_OUTPUT", `${method} type`);
const locked = [9, 9, 9, 9]; Object.defineProperty(locked, "2", { writable: false }); const lockedBefore = Object.getOwnPropertyDescriptors(locked); assert.equal(caught(() => mesh.vertexInto(0, locked, 0)).code, "INVALID_OUTPUT"); assert.deepEqual(Object.getOwnPropertyDescriptors(locked), lockedBefore, "atomic writable slots");
const inherited = [9, , 9]; Object.defineProperty(Array.prototype, "1", { configurable: true, writable: false, value: 9 }); try { const inheritedBefore = Object.getOwnPropertyDescriptors(inherited); assert.equal(caught(() => mesh.vertexInto(0, inherited, 0)).code, "INVALID_OUTPUT"); assert.deepEqual(Object.getOwnPropertyDescriptors(inherited), inheritedBefore, "inherited unwritable slot atomic"); } finally { delete Array.prototype["1"]; }
const mixed = [9, , 9]; Object.defineProperty(Array.prototype, "1", { configurable: true, writable: true, value: 9 }); try { Object.preventExtensions(mixed); const mixedBefore = Object.getOwnPropertyDescriptors(mixed); assert.equal(caught(() => mesh.vertexInto(0, mixed, 0)).code, "INVALID_OUTPUT"); assert.deepEqual(Object.getOwnPropertyDescriptors(mixed), mixedBefore, "non-extensible inherited hole atomic"); } finally { delete Array.prototype["1"]; }
const sparse = new Array(5); sparse[0] = 9; sparse[4] = 9; assert.equal(mesh.vertexInto(0, sparse, 1), sparse, "sparse writable output"); assert.deepEqual(sparse.slice(1, 4), mesh.vertexAt(0), "sparse writable triple");
for (const offset of [-1, true, NaN, Infinity, .5, 1n, "0"]) assert.equal(caught(() => mesh.vertexInto(0, [9, 9, 9], offset)).code, "INVALID_OUTPUT", "offset");
const valid = () => ({ profile: [[0, 1], [1, 1]], slices: 3, capStart: false, capEnd: false, maxFaces: 100 });
const nullPrototype = Object.assign(Object.create(null), valid()); assert.equal(RadialProfile3D.generate(nullPrototype).faceCount(), 6, "null-prototype config");
for (const scalar of [NaN, Infinity, -Infinity, true, "0", new Number(0)]) for (const change of [x => { x.profile[0][0] = scalar; }, x => { x.profile[0][1] = scalar; }, x => { x.slices = scalar; }, x => { x.maxFaces = scalar; }]) { const bad = valid(); change(bad); assert.equal(caught(() => RadialProfile3D.generate(bad)).code, "INVALID_INPUT", "scalar"); }
class Alias {} class ListAlias extends Array {}
for (const bad of [new Alias(), { ...valid(), profile: new Float64Array(4) }, { ...valid(), profile: [new ListAlias(0, 1), [1, 1]] }, { ...valid(), profile: new ListAlias([0, 1], [1, 1]) }]) assert.equal(caught(() => RadialProfile3D.generate(bad)).code, "INVALID_INPUT", "passive carrier");
let reads = 0; const getter = valid(); Object.defineProperty(getter, "profile", { enumerable: true, get() { reads += 1; return []; } }); assert.equal(caught(() => RadialProfile3D.generate(getter)).code, "INVALID_INPUT"); assert.equal(reads, 0, "getter not read");
const zeroMesh = RadialProfile3D.generate({ profile: [[-0, -0], [1, 1]], slices: 3, capStart: true, capEnd: false, maxFaces: 100 }); for (const value of [...zeroMesh.toValues().positions.flat(), ...zeroMesh.toValues().normals.flat()]) assert.ok(!Object.is(value, -0), "completed +0");
mkdirSync(dirname(output), { recursive: true }); const after = bindings(); assert.deepEqual(after, before, "input stability");
const report = { status: "passed", operation: fixture.operation, fixture_cases: fixture.cases.length, successful_cases: fixture.cases.filter(item => item.output).length, error_cases: fixture.cases.filter(item => item.error).length, source_sha256: sha(source), input_sha256_before: before, input_sha256_after: after, runtime: { node: process.version, platform: process.platform, architecture: process.arch }, scope: "JavaScript CP7 core fixture, topology/normal allowance, exact same-runtime bits, passive carrier, ownership and atomic retained-access checks; no rendering or support claim." };
writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" }); console.log(JSON.stringify({ status: report.status, output, fixture_cases: report.fixture_cases }));
