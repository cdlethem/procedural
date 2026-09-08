#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { mapTriangleCoordinates2D, seededTrianglePoints2D, TrianglePointsError } from "../../packages/javascript/src/triangle-points.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = join(ROOT, "packages/javascript/src/triangle-points.js");
const seededFile = join(ROOT, "fixtures/operations/seeded-triangle-points.json");
const mappingFile = join(ROOT, "fixtures/operations/triangle-coordinate-map.json");
const seeded = JSON.parse(readFileSync(seededFile)), mapping = JSON.parse(readFileSync(mappingFile));
const bits = (value) => { const b = new ArrayBuffer(8), d = new DataView(b); d.setFloat64(0, value); return d.getBigUint64(0).toString(16).padStart(16, "0"); };
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const before = sha(source);
const inputs = [source, fileURLToPath(import.meta.url), seededFile, mappingFile,
 join(ROOT,"catalog/operations/seeded-triangle-points.json"),join(ROOT,"catalog/operations/triangle-coordinate-map.json")];
const bindings = () => Object.fromEntries(inputs.map(p=>[p.slice(ROOT.length+1),sha(p)]));
const inputBefore = bindings();
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=="--output")throw new Error("Usage: --output FRESH_FILE");
const output=resolve(args[1]);
if(!output.startsWith(join(ROOT,".work")+sep)||existsSync(output))throw new Error("Output must be fresh under .work");
function errorCode(action) { try { action(); return null; } catch (error) { return error instanceof TrianglePointsError ? error.code : `UNEXPECTED:${error?.name}`; } }
function exact(actual, expected, label = "value") { assert.equal(JSON.stringify(actual, (_, value) => typeof value === "number" ? bits(value) : value), JSON.stringify(expected, (_, value) => typeof value === "number" ? bits(value) : value), label); }
function pointBits(points) { return points.map(point => point.map(bits)); }
function runCases(fixture, factory) {
  const outputs = new Map();
  for (const item of fixture.cases) {
    if (item.error) assert.equal(errorCode(() => factory(item.input)), item.error, item.id);
    else { const result = factory(item.input); exact(result.toValues(), item.output, item.id); assert.deepEqual(pointBits(result.toValues().points), item.points_bits_hex, item.id); outputs.set(item.id, result); }
  }
  return outputs;
}
assert.equal(seeded.catalog_sha256, sha(join(ROOT, "catalog/operations/seeded-triangle-points.json")));
assert.equal(mapping.catalog_sha256, sha(join(ROOT, "catalog/operations/triangle-coordinate-map.json")));
const seededResults = runCases(seeded, seededTrianglePoints2D), mappingResults = runCases(mapping, mapTriangleCoordinates2D);

// Exercise the private stream only through a test-module copy, preserving the public surface.
const instrumented = await import("data:text/javascript;base64," + Buffer.from(readFileSync(source, "utf8") + "\nexport { Stream };").toString("base64"));
for (const vector of seeded.seed_vectors) {
  const stream = new instrumented.Stream(vector.seed);
  assert.deepEqual(stream.state(), vector.initial_state, `initial-${vector.seed}`);
  for (const expected of vector.first_10) { const output = stream.output(); assert.equal(output, expected.output_u32); assert.deepEqual(stream.state(), expected.post_state); assert.equal(output / 4294967296, expected.unit); }
}
const originalOutput = instrumented.Stream.prototype.output;
for (const item of seeded.cases) {
  const trace = [];
  instrumented.Stream.prototype.output = function () { const output = originalOutput.call(this); trace.push(output); return output; };
  const result = item.error ? errorCode(() => instrumented.seededTrianglePoints2D(item.input)) : instrumented.seededTrianglePoints2D(item.input);
  assert.equal(trace.length, item.error ? 0 : (item.input.count === 0 ? 0 : item.input.count * 2), `${item.id} draw count`);
  if (!item.error) {
    assert.deepEqual(Array.from({ length: trace.length / 2 }, (_, i) => trace.slice(i * 2, i * 2 + 2)), item.generated_unit_u32, `${item.id} generated u32`);
    assert.deepEqual(Array.from({ length: trace.length / 2 }, (_, i) => trace.slice(i * 2, i * 2 + 2).map(value => value / 4294967296)), item.generated_unit_coordinates, `${item.id} generated units`);
    assert.deepEqual(pointBits(result.toValues().points), item.points_bits_hex, `${item.id} instrumented output`);
  }
}
instrumented.Stream.prototype.output = originalOutput;
for (const check of seeded.cross_case_checks) {
  if (check.kind === "raw-binary64-prefix") {
    const short = seededResults.get(check.prefix_case).toValues().points, long = seededResults.get(check.extended_case).toValues().points;
    exact(long.slice(0, short.length), short);
  } else if (check.kind === "seeded-output-equals-explicit-map") {
    const a = seededResults.get(check.seeded_case).toValues(), b = mappingResults.get(check.mapping_case).toValues(); exact(a, b);
  } else throw new Error(`unhandled cross-case ${check.kind}`);
}
const accessConfig = { seed: 42, count: 4, triangle: [[0, 0], [16, 0], [0, 8]] };
const access = seededTrianglePoints2D(accessConfig), baseline = access.toValues();
accessConfig.triangle[0][0] = 99; accessConfig.count = 0; assert.deepEqual(access.toValues(), baseline);
const explicitConfig = { triangle: [[0, 0], [16, 0], [0, 8]], unitCoordinates: [[0.25, 0.5], [0.75, 0.25]] };
const explicit = mapTriangleCoordinates2D(explicitConfig), explicitBaseline = explicit.toValues();
explicitConfig.triangle[0][0] = 99; explicitConfig.unitCoordinates[0][0] = 1; assert.deepEqual(explicit.toValues(), explicitBaseline);
const detached = access.pointAt(0); detached[0] = 99; const exported = access.toValues(); exported.points[0][0] = 99; assert.deepEqual(access.toValues(), baseline);
for (const offset of [0, 1, 2, 3]) { const destination = new Float64Array(5).fill(9); assert.equal(access.pointInto(0, destination, offset), destination); assert.deepEqual(Array.from(destination).slice(offset, offset + 2), baseline.points[0]); }
for (const offset of [0, 1, 2, 3]) { const destination = [9, 9, 9, 9, 9]; assert.equal(access.pointInto(0, destination, offset), destination); assert.deepEqual(destination.slice(offset, offset + 2), baseline.points[0]); }
const unwritable = [9, 9, 9, 9]; Object.defineProperty(unwritable, "2", { writable: false }); const unwritableBefore = Object.getOwnPropertyDescriptors(unwritable); assert.equal(errorCode(() => access.pointInto(0, unwritable, 1)), "INVALID_OUTPUT"); assert.deepEqual(Object.getOwnPropertyDescriptors(unwritable), unwritableBefore);
for (const out of [new Float32Array(3), [9], Object.freeze([9, 9]), {}, null]) { const beforeOut = out === null ? null : (Array.from(out)); assert.equal(errorCode(() => access.pointInto(0, out, 0)), "INVALID_OUTPUT"); assert.deepEqual(out === null ? null : Array.from(out), beforeOut); }
for (const index of [-1, true, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1, 1n, "0"]) assert.equal(errorCode(() => access.pointAt(index)), "INVALID_INDEX");
for (const index of [access.size, Number.MAX_SAFE_INTEGER]) assert.equal(errorCode(() => access.pointAt(index)), "INDEX_OUT_OF_RANGE");
for (const offset of [-1, true, NaN, Infinity, 0.5, 1n, "0"]) assert.equal(errorCode(() => access.pointInto(0, [9, 9, 9], offset)), "INVALID_OUTPUT");
for (const index of [-1, access.size]) assert.equal(errorCode(() => access.pointInto(index, null, -1)), index < 0 ? "INVALID_INDEX" : "INDEX_OUT_OF_RANGE");
assert.equal(errorCode(() => access.pointInto(0, null, -1)), "INVALID_OUTPUT");

class Config {}
class Pair extends Array {}
for (const bad of [new Config(), { ...accessConfig, triangle: new Float64Array(6) },
  { ...accessConfig, triangle: [new Pair(0, 0), [16, 0], [0, 8]] },
  { ...accessConfig, seed: true }, { ...accessConfig, seed: Infinity },
  { ...accessConfig, count: -1 }, { ...accessConfig, count: 0.5 }]) assert.equal(errorCode(() => seededTrianglePoints2D(bad)), "INVALID_INPUT");
for (const bad of [{ triangle: [[0, 0], [1, 0], [0, 1]], unitCoordinates: new Float64Array(0) },
  { triangle: [[0, 0], [1, 0], [0, 1]], unitCoordinates: [[true, 0]] },
  { triangle: [[0, 0], [1, 0], [0, 1]], unitCoordinates: [[NaN, 0]] },
  { triangle: [[0, 0], [1, 0], [0, 1]], unitCoordinates: [[0, 0, 0]] }]) assert.equal(errorCode(() => mapTriangleCoordinates2D(bad)), "INVALID_INPUT");
mkdirSync(dirname(output), { recursive: true });
const inputAfter=bindings(); assert.deepEqual(inputAfter,inputBefore,"input stability");
const report = { input_sha256_before:inputBefore,input_sha256_after:inputAfter, status: "passed", operations: [seeded.operation, mapping.operation], scope: "Actual JavaScript triangle fixture, RNG, equivalence, ownership and access checks; no rendering or support claim.", contract_sha256: { seeded: sha(join(ROOT, "catalog/operations/seeded-triangle-points.json")), mapping: sha(join(ROOT, "catalog/operations/triangle-coordinate-map.json")) }, fixture_sha256: { seeded: sha(seededFile), mapping: sha(mappingFile) }, fixture_cases: { seeded: seeded.cases.length, mapping: mapping.cases.length }, seed_vectors: seeded.seed_vectors.length, cross_case_checks: seeded.cross_case_checks.length, source_sha256: { before, after: sha(source) }, ownership_access: true, allocation_failure: { executed: false, source_review: "No output-sized allocation precedes full validation; no per-point temporary arrays. Zero-count stream initialization absence is source-reviewed, draw absence executed. Host allocation failure is not injected." } };
assert.equal(report.source_sha256.after, before, "source stability");
writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: report.status, output, fixture_cases: report.fixture_cases }));
