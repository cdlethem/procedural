#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { BranchTreeError, seededEndpointBranches2D } from "../../packages/javascript/src/branch-tree.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = join(ROOT, "packages/javascript/src/branch-tree.js");
const fixtureFile = join(ROOT, "fixtures/operations/seeded-endpoint-branches.json");
const catalogFile = join(ROOT, "catalog/operations/seeded-endpoint-branches.json");
const fixture = JSON.parse(readFileSync(fixtureFile));
const sha = file => createHash("sha256").update(readFileSync(file)).digest("hex");
const bits = value => { const buffer = new ArrayBuffer(8), view = new DataView(buffer); view.setFloat64(0, value); return view.getBigUint64(0).toString(16).padStart(16, "0"); };
const args = process.argv.slice(2); if (args.length !== 2 || args[0] !== "--output") throw new Error("Usage: --output FRESH_FILE");
const output = resolve(args[1]); if (!output.startsWith(join(ROOT, ".work") + sep) || existsSync(output)) throw new Error("Output must be fresh under .work");
const inputs = [source, fileURLToPath(import.meta.url), fixtureFile, catalogFile];
const bindings = () => Object.fromEntries(inputs.map(file => [file.slice(ROOT.length + 1), sha(file)]));
const before = bindings();
function error(action) { try { action(); return null; } catch (caught) { return caught instanceof BranchTreeError || caught?.name === "BranchTreeError" ? { code: caught.code, parentIndex: caught.parentIndex, slotIndex: caught.slotIndex, stage: caught.stage } : { code: `UNEXPECTED:${caught?.name}` }; } }
function exact(actual, expected, label) { assert.equal(JSON.stringify(actual, (_, v) => typeof v === "number" ? bits(v) : v), JSON.stringify(expected, (_, v) => typeof v === "number" ? bits(v) : v), label); }
function checkOutput(item, result) {
  const actual = result.toValues(), comparison = item.comparison;
  assert.deepEqual(actual.parents, item.output.parents, `${item.id} parents`); assert.deepEqual(actual.generations, item.output.generations, `${item.id} generations`); assert.deepEqual(actual.childCounts, item.output.childCounts, `${item.id} child counts`);
  for (const key of ["headings", "lengths"]) assert.deepEqual(actual[key].map(bits), item.exact_attribute_bits[key], `${item.id} ${key}`);
  if (comparison.mode === "binary64-exact") exact(actual.segments, item.output.segments, `${item.id} segments`);
  else if (comparison.mode === "bounded-trig") {
    assert.equal(actual.segments.length, item.output.segments.length, `${item.id} segment count`);
    for (let i = 0; i < actual.segments.length; i += 1) for (let j = 0; j < 4; j += 1) assert.ok(Math.abs(actual.segments[i][j] - item.output.segments[i][j]) <= comparison.segments_abs[i][j], `${item.id} segment ${i}/${j}`);
  } else throw new Error(`unknown comparison ${comparison.mode}`);
  for (let i = 1; i < actual.segments.length; i += 1) { const parent = actual.parents[i]; assert.equal(bits(actual.segments[i][0]), bits(actual.segments[parent][2]), `${item.id} x ancestry ${i}`); assert.equal(bits(actual.segments[i][1]), bits(actual.segments[parent][3]), `${item.id} y ancestry ${i}`); }
}
assert.equal(fixture.catalog_sha256, sha(catalogFile));
const results = new Map();
for (const item of fixture.cases) {
  if (item.error) { const caught = error(() => seededEndpointBranches2D(item.input)); assert.equal(caught.code, item.error, item.id); if (item.error_detail) assert.deepEqual({ parentIndex: caught.parentIndex, slotIndex: caught.slotIndex, ...(caught.stage === undefined ? {} : { stage: caught.stage }) }, item.error_detail, `${item.id} detail`); }
  else { const result = seededEndpointBranches2D(item.input); checkOutput(item, result); results.set(item.id, result); }
}
const instrumented = await import("data:text/javascript;base64," + Buffer.from(readFileSync(source, "utf8") + "\nexport { Stream };").toString("base64"));
for (const vector of fixture.seed_vectors) { const stream = new instrumented.Stream(vector.seed); assert.deepEqual(stream.state(), vector.initial_state, `initial ${vector.seed}`); for (const expected of vector.first_10) { assert.equal(stream.output(), expected.output_u32, `word ${vector.seed}/${expected.index}`); assert.deepEqual(stream.state(), expected.post_state, `state ${vector.seed}/${expected.index}`); } }
const originalOutput = instrumented.Stream.prototype.output;
for (const item of fixture.cases) {
  const trace = []; instrumented.Stream.prototype.output = function () { const word = originalOutput.call(this); trace.push({ word, state: this.state() }); return word; };
  const caught = item.error ? error(() => instrumented.seededEndpointBranches2D(item.input)) : null;
  if (!item.error) instrumented.seededEndpointBranches2D(item.input);
  assert.deepEqual(trace, (item.rng_trace ?? []).map(entry => ({ word: entry.word, state: entry.state })), `${item.id} RNG trace`);
  if (item.error) assert.equal(caught.code, item.error, `${item.id} instrumented error`);
}
instrumented.Stream.prototype.output = originalOutput;
const prefix5 = results.get("prefix-rules-5").toValues(), prefix7 = results.get("prefix-rules-7").toValues(), prefix8 = results.get("prefix-rules-8").toValues();
for (const key of ["segments", "headings", "lengths", "parents", "generations"]) { exact(prefix7[key].slice(0, prefix5[key].length), prefix5[key], `prefix 5/7 ${key}`); exact(prefix8[key].slice(0, prefix7[key].length), prefix7[key], `prefix 7/8 ${key}`); }
const validConfig = () => ({ seed: 42, root: { origin: [0, 0], heading: 0, length: 16 }, rules: [{ lengthScale: [1, 1], slots: [{ probability: 1, turn: [0, 0] }] }], maxSegments: 3 });
const config = validConfig(), access = seededEndpointBranches2D(config), baseline = access.toValues(); config.root.origin[0] = 99; config.rules[0].slots[0].turn[0] = 2; assert.deepEqual(access.toValues(), baseline, "input detached"); const segment = access.segmentAt(0); segment[0] = 99; const values = access.toValues(); values.segments[0][0] = 99; values.headings[0] = 99; assert.deepEqual(access.toValues(), baseline, "output detached");
for (const destination of [new Float64Array(6).fill(9), [9, 9, 9, 9, 9, 9]]) { const beforeDestination = Array.from(destination); assert.equal(access.segmentInto(1, destination, 1), destination); exact(Array.from(destination).slice(1, 5), baseline.segments[1], "segment into"); assert.deepEqual(Array.from(destination).filter((_, index) => index === 0 || index === 5), [beforeDestination[0], beforeDestination[5]], "segmentInto touches four slots"); }
const locked = [9, 9, 9, 9, 9]; Object.defineProperty(locked, "3", { writable: false }); const lockedBefore = Object.getOwnPropertyDescriptors(locked); assert.equal(error(() => access.segmentInto(0, locked, 1)).code, "INVALID_OUTPUT"); assert.deepEqual(Object.getOwnPropertyDescriptors(locked), lockedBefore, "atomic output");
const accessors = ["segmentAt", "headingAt", "lengthAt", "parentAt", "generationAt", "childCountAt"];
for (const index of [-1, true, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1, 1n, "0"]) for (const method of accessors) assert.equal(error(() => access[method](index)).code, "INVALID_INDEX", `${method} invalid index`);
for (const index of [access.size, Number.MAX_SAFE_INTEGER]) for (const method of accessors) assert.equal(error(() => access[method](index)).code, "INDEX_OUT_OF_RANGE", `${method} bounds`);
assert.equal(error(() => access.segmentInto(-1, null, -1)).code, "INVALID_INDEX"); assert.equal(error(() => access.segmentInto(access.size, null, -1)).code, "INDEX_OUT_OF_RANGE");
for (const out of [new Float32Array(4), [9], Object.freeze([9, 9, 9, 9]), {}, null]) assert.equal(error(() => access.segmentInto(0, out, 0)).code, "INVALID_OUTPUT");
for (const offset of [-1, true, NaN, Infinity, 0.5, 1n, "0"]) assert.equal(error(() => access.segmentInto(0, [9, 9, 9, 9], offset)).code, "INVALID_OUTPUT");
const badScalars = [NaN, Infinity, -Infinity, true, "0", new Number(0)];
for (const scalar of badScalars) {
  for (const change of [config => { config.seed = scalar; }, config => { config.maxSegments = scalar; }, config => { config.root.origin[0] = scalar; }, config => { config.root.origin[1] = scalar; }, config => { config.root.heading = scalar; }, config => { config.root.length = scalar; }, config => { config.rules[0].lengthScale[0] = scalar; }, config => { config.rules[0].lengthScale[1] = scalar; }, config => { config.rules[0].slots[0].probability = scalar; }, config => { config.rules[0].slots[0].turn[0] = scalar; }, config => { config.rules[0].slots[0].turn[1] = scalar; }]) { const bad = validConfig(); change(bad); assert.equal(error(() => seededEndpointBranches2D(bad)).code, "INVALID_INPUT", `scalar ${String(scalar)}`); }
}
class RecordAlias {} class ListAlias extends Array {}
for (const bad of [new RecordAlias(), { ...validConfig(), root: new RecordAlias() }, { ...validConfig(), rules: new ListAlias() }, { ...validConfig(), root: { ...validConfig().root, origin: new Float64Array(2) } }, { ...validConfig(), rules: [new RecordAlias()] }, { ...validConfig(), rules: [{ lengthScale: new ListAlias(1, 1), slots: [] }] }, { ...validConfig(), rules: [{ lengthScale: [1, 1], slots: new ListAlias() }] }, { ...validConfig(), rules: [{ lengthScale: [1, 1], slots: [new RecordAlias()] }] }, { ...validConfig(), rules: [{ lengthScale: [1, 1], slots: [{ probability: 1, turn: new Float64Array(2) }] }] }]) assert.equal(error(() => seededEndpointBranches2D(bad)).code, "INVALID_INPUT", "container aliases");
let getterReads = 0; const getterConfig = validConfig(); Object.defineProperty(getterConfig, "seed", { enumerable: true, get() { getterReads += 1; return 42; } }); assert.equal(error(() => seededEndpointBranches2D(getterConfig)).code, "INVALID_INPUT"); assert.equal(getterReads, 0, "record getter not executed"); const getterList = validConfig(); Object.defineProperty(getterList.root.origin, "0", { get() { getterReads += 1; return 0; } }); assert.equal(error(() => seededEndpointBranches2D(getterList)).code, "INVALID_INPUT"); assert.equal(getterReads, 0, "list getter not executed");
const negativeZero = seededEndpointBranches2D({ seed: -0, root: { origin: [-0, -0], heading: -0, length: -0 }, rules: [{ lengthScale: [-0, -0], slots: [{ probability: -0, turn: [-0, -0] }] }], maxSegments: 2 }); for (const value of [...negativeZero.toValues().segments.flat(), ...negativeZero.toValues().headings, ...negativeZero.toValues().lengths]) assert.ok(!Object.is(value, -0), "negative zero canonicalized");
const cap = seededEndpointBranches2D({ seed: 0, root: { origin: [0, 0], heading: 0, length: 0 }, rules: [], maxSegments: 357913941 }); assert.equal(cap.size, 1, "large cap is not preallocated");
const longRules = Array.from({ length: 512 }, () => ({ lengthScale: [1, 1], slots: [{ probability: 1, turn: [0, 0] }] })); assert.equal(seededEndpointBranches2D({ seed: 0, root: { origin: [0, 0], heading: 0, length: 1 }, rules: longRules, maxSegments: 513 }).size, 513, "iterative chain");
mkdirSync(dirname(output), { recursive: true }); const after = bindings(); assert.deepEqual(after, before, "input stability");
const report = { status: "passed", runtime: { node: process.version, platform: process.platform, architecture: process.arch }, operation: fixture.operation, fixture_cases: fixture.cases.length, seed_vectors: fixture.seed_vectors.length, executed_native_only_requirements: fixture.native_only_cases.map(item => item.id), source_reviewed_limitations: ["Host allocation failure is not injected; constructor validates statics before storage/RNG and uses packed growable arrays."], fixture_sha256: sha(fixtureFile), catalog_sha256: sha(catalogFile), input_sha256_before: before, input_sha256_after: after, source_sha256: sha(source), scope: "JavaScript CP6 fixture output, per-case trig tolerance, private stream traces, scalar/carrier validation, errors, ownership, atomic access, large-cap and iterative-chain checks; no rendering or support claim." };
writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" }); console.log(JSON.stringify({ status: report.status, output, fixture_cases: report.fixture_cases }));
