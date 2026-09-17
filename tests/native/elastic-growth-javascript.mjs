#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { elasticCurveGrowStep2D } from "../../packages/javascript/src/elastic-curve-grow-step-2d.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = resolve(process.argv[2] ?? "");
if (!output.startsWith(join(root, ".work") + sep) || existsSync(output)) throw Error("Fresh .work output required");
const cases = JSON.parse(readFileSync(join(root, "fixtures/operations/elastic-curve-grow-step-2d.json"))).cases;
const oracles = JSON.parse(readFileSync(join(root, "tests/native/fixtures/growth-oracles.json"))).cases;
const error = (fn, code) => assert.throws(fn, thrown => thrown.code === code);
function close(actual, expected, absolute, path = "result") {
  if (typeof expected === "number") {
    assert.equal(typeof actual, "number", path);
    assert.ok(Math.abs(actual - expected) <= absolute, `${path}: ${actual} vs ${expected}`);
  } else if (Array.isArray(expected)) {
    assert.equal(actual.length, expected.length, path);
    expected.forEach((item, i) => close(actual[i], item, absolute, `${path}[${i}]`));
  } else if (expected !== null && typeof expected === "object") {
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), path);
    for (const [key, value] of Object.entries(expected)) close(actual[key], value, absolute, `${path}.${key}`);
  } else assert.deepEqual(actual, expected, path);
}
for (const testCase of cases) {
  if (testCase.error) error(() => elasticCurveGrowStep2D(testCase.input), testCase.error);
  else assert.deepEqual(elasticCurveGrowStep2D(testCase.input), testCase.output, testCase.id);
}
for (const testCase of oracles) close(elasticCurveGrowStep2D(testCase.input), testCase.output, testCase.tolerance.absolute, testCase.id);
const base = structuredClone(cases.find(testCase => testCase.id === "straight-rest-equilibrium").input);
const before = structuredClone(base);
const after = elasticCurveGrowStep2D(base);
assert.deepEqual(base, before, "input is unchanged");
after.state.nodes[0].position[0] = 999;
assert.equal(base.state.nodes[0].position[0], 0, "output is detached");
const wrongOrder = structuredClone(base);
wrongOrder.state.curves[0].nodeIds.reverse();
assert.notDeepEqual(elasticCurveGrowStep2D(wrongOrder).state.curves[0].nodeIds, base.state.curves[0].nodeIds);
const badCarrier = { ...base, surprise: true };
error(() => elasticCurveGrowStep2D(badCarrier), "INVALID_INPUT");
const accessor = structuredClone(base);
Object.defineProperty(accessor.state.nodes[0], "position", { enumerable: true, get() { throw Error("read"); } });
error(() => elasticCurveGrowStep2D(accessor), "INVALID_INPUT");
const invalidGeometry = structuredClone(base);
invalidGeometry.state.nodes[1].position = [...invalidGeometry.state.nodes[0].position];
error(() => elasticCurveGrowStep2D(invalidGeometry), "INVALID_GEOMETRY");
invalidGeometry.maxWork = 0;
error(() => elasticCurveGrowStep2D(invalidGeometry), "WORK_LIMIT");
const half = structuredClone(base);
half.state.curves[0].restLengths[0] = Number.MIN_VALUE; half.stretchStiffness = 0;
half.maxSegmentLength = 0.5; half.maxNodes = 10; half.maxEdges = 10; half.maxWork = 1000;
error(() => elasticCurveGrowStep2D(half), "REPRESENTATION_COLLAPSE");
const budget = structuredClone(base);
budget.maxBacktracks = Number.MAX_SAFE_INTEGER;
budget.maxWork = Number.MAX_SAFE_INTEGER;
error(() => elasticCurveGrowStep2D(budget), "WORK_LIMIT");
const pinned = structuredClone(cases.find(testCase => testCase.id === "pin-zero-velocity").input);
pinned.externalAccelerations[0] = [100, 100];
const pinnedResult = elasticCurveGrowStep2D(pinned);
assert.deepEqual(pinnedResult.state.nodes[0].position, pinned.state.nodes[0].position);
assert.deepEqual(pinnedResult.state.nodes[0].velocity, [0, 0]);
const parallel = {
  state: { nodes: [
    { id: 0, position: [0, 0], velocity: [0, 0], pinned: false },
    { id: 1, position: [2, 0], velocity: [0, 0], pinned: false },
    { id: 2, position: [0, 1], velocity: [0, 0], pinned: false },
    { id: 3, position: [2, 1], velocity: [0, 0], pinned: false },
  ], curves: [
    { id: 0, closed: false, nodeIds: [0, 1], edgeIds: [0], restLengths: [2], restTurns: [] },
    { id: 1, closed: false, nodeIds: [2, 3], edgeIds: [1], restLengths: [2], restTurns: [] },
  ], nextNodeId: 4, nextEdgeId: 2 },
  restGrowth: [[0], [0]], turnRates: [[], []], externalAccelerations: [[0, 0], [0, 0], [0, 0], [0, 0]],
  stretchStiffness: 0, bendStiffness: 0, contactRange: 2, contactStrength: 2,
  damping: 1, dt: 1, maxSpeed: 100, maxSegmentLength: 100,
  maxNodes: 4, maxEdges: 2, maxWork: 64, maxBacktracks: 0,
};
const repelled = elasticCurveGrowStep2D(parallel);
assert.deepEqual(repelled.state.nodes.map(node => node.position), [[0, -1], [2, 0], [0, 2], [2, 1]],
  "parallel closest-point ties select least first and second parameters");
const self = fileURLToPath(import.meta.url), hash = () => createHash("sha256").update(readFileSync(self)).digest("hex");
const report = { status: "passed", exact_cases: cases.length, tolerant_cases: oracles.length,
  scope: "Frozen vectors, independent bend oracle, static/passive validation, ownership, geometry/work precedence, representable material, parallel contact ties and pins; no target acceptance.",
  self_sha256_before: hash(), self_sha256_after: hash() };
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(report));
