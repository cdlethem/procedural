#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { insertSegmentBridge2D } from "../../packages/javascript/src/insert-segment-bridge-2d.js";
import { relativeNeighborhoodPairs2D } from "../../packages/javascript/src/relative-neighborhood-pairs-2d.js";
import { thresholdEdgeRelaxation2D } from "../../packages/javascript/src/threshold-edge-relaxation-2d.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = resolve(process.argv[3] ?? "");
if (process.argv[2] !== "--output" || !output.startsWith(join(root, ".work") + sep) || existsSync(output)) throw Error("Usage: --output fresh .work path");
const operations = [
  ["insert-segment-bridge-2d", insertSegmentBridge2D],
  ["relative-neighborhood-pairs-2d", relativeNeighborhoodPairs2D],
  ["threshold-edge-relaxation-2d", thresholdEdgeRelaxation2D],
];
const error = (fn, code) => assert.throws(fn, thrown => thrown.code === code);
let fixtureCount = 0;
for (const [name, operation] of operations) {
  const fixtures = JSON.parse(readFileSync(join(root, "fixtures/operations", `${name}.json`)));
  for (const testCase of fixtures.cases) {
    fixtureCount++;
    if (testCase.error) error(() => operation(testCase.input), testCase.error);
    else assert.deepEqual(operation(testCase.input), testCase.output, `${name}/${testCase.id}`);
  }
}

const graph = (nodes, edges) => ({ nodes: nodes.map((point, id) => ({ id, point })),
  edges: edges.map(([a, b], id) => ({ id, a, b })), nextNodeId: nodes.length, nextEdgeId: edges.length });
const bridge = (g, candidate, overrides = {}) => ({ graph: g, candidate, gapIndex: 0,
  maxNodes: 16, maxEdges: 16, maxWork: 500, ...overrides });
const twoRails = graph([[0, -1], [0, 1], [2, -1], [2, 1]], [[0, 1], [2, 3]]);
const candidate = [[-1, 0], [3, 0]];
const before = structuredClone(twoRails);
const inserted = insertSegmentBridge2D(bridge(twoRails, candidate));
assert.deepEqual(twoRails, before, "input ownership");
error(() => insertSegmentBridge2D(bridge(inserted.graph, candidate, { maxNodes: 30, maxEdges: 30, maxWork: 1100 })), "AMBIGUOUS_OVERLAP");
inserted.graph.nodes[0].point[0] = 900;
assert.equal(twoRails.nodes[0].point[0], 0, "output ownership");
assert.deepEqual(insertSegmentBridge2D(bridge(twoRails, candidate)).events,
  [{ type: "split", parentEdgeId: 0, nodeId: 4, childEdgeIds: [2, 3], parentT: 0.5 },
   { type: "split", parentEdgeId: 1, nodeId: 5, childEdgeIds: [4, 5], parentT: 0.5 },
   { type: "link", edgeId: 6, nodeIds: [4, 5] }]);
error(() => insertSegmentBridge2D(bridge(twoRails, candidate, { maxWork: 49 })), "WORK_LIMIT");
const crossed = graph([[0, -1], [0, 1], [-1, 0], [1, 0]], [[0, 1], [2, 3]]);
error(() => insertSegmentBridge2D(bridge(crossed, candidate)), "INVALID_GEOMETRY");
error(() => insertSegmentBridge2D(bridge(crossed, candidate, { maxWork: 0 })), "WORK_LIMIT");
const collinear = graph([[5, 0], [15, 0]], [[0, 1]]);
error(() => insertSegmentBridge2D(bridge(collinear, [[0, 0], [10, 0]])), "AMBIGUOUS_OVERLAP");
assert.equal(insertSegmentBridge2D(bridge(collinear, [[0, 0], [5, 0]])).reason, "INSUFFICIENT_HITS");
assert.equal(insertSegmentBridge2D(bridge(collinear, [[0, 0], [4, 0]])).reason, "INSUFFICIENT_HITS");
const tJunction = graph([[0, 0], [2, 0], [1, 0], [1, 1]], [[0, 1], [2, 3]]);
error(() => insertSegmentBridge2D(bridge(tJunction, candidate)), "INVALID_GEOMETRY");
const overlappingOld = graph([[0, 0], [2, 0], [1, 0]], [[0, 1], [0, 2]]);
error(() => insertSegmentBridge2D(bridge(overlappingOld, candidate)), "INVALID_GEOMETRY");
const sharedVertex = graph([[0, 0], [0, 1], [0, -1], [2, -1], [2, 1]], [[0, 1], [0, 2], [3, 4]]);
const reused = insertSegmentBridge2D(bridge(sharedVertex, candidate));
assert.equal(reused.graph.nodes.length, 6, "multi-edge vertex is one reused hit");
assert.deepEqual(reused.events.map(event => event.type), ["split", "link"]);
assert.deepEqual(reused.events[1].nodeIds, [0, 5]);
error(() => insertSegmentBridge2D(bridge(twoRails, [1, 2])), "INVALID_INPUT");
const near = graph([[0, -1], [0, 1], [2, -1], [2, 1], [0, 0]], [[0, 1], [2, 3]]);
error(() => insertSegmentBridge2D(bridge(near, [[-1, 0], [3, Number.MIN_VALUE]])), "REPRESENTATION_COLLAPSE");
const withIsolate = graph([[0, -1], [0, 1], [2, -1], [2, 1], [20, 20]], [[0, 1], [2, 3]]);
assert.equal(insertSegmentBridge2D(bridge(withIsolate, candidate)).inserted, true);
error(() => insertSegmentBridge2D(bridge(twoRails, candidate, { maxNodes: 5 })), "OUTPUT_LIMIT");
error(() => insertSegmentBridge2D(bridge(twoRails, candidate, { gapIndex: 2 })), "INVALID_INPUT");
const missing = { points: [], maxWork: 0, extra: 1 };
error(() => relativeNeighborhoodPairs2D(missing), "INVALID_INPUT");
const getter = { points: [], maxWork: 0 };
Object.defineProperty(getter, "points", { enumerable: true, get() { throw Error("read"); } });
error(() => relativeNeighborhoodPairs2D(getter), "INVALID_INPUT");
assert.deepEqual(relativeNeighborhoodPairs2D({ points: [[0, 0], [1, 0], [0.5, Number.MIN_VALUE]], maxWork: 6 }).pairs,
  [[0, 2], [1, 2]], "exact near-degenerate witness");
error(() => thresholdEdgeRelaxation2D({ points: [[-1e308, 0], [1e308, 0]], pairs: [[0, 1]],
  pinned: [false, false], minLength: 0, stepScale: 0, maxWork: 3 }), "NUMERIC_OVERFLOW");
const relaxed = thresholdEdgeRelaxation2D({ points: [[0, 0], [2, 0]], pairs: [[0, 1]],
  pinned: [true, false], minLength: 1, stepScale: 1, maxWork: 3 });
assert.deepEqual(relaxed, { points: [[0, 0], [1, 0]], displacements: [[0, 0], [-1, 0]] });

const self = fileURLToPath(import.meta.url);
const hash = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const report = { status: "passed", fixture_cases: fixtureCount, scope: "Frozen fixtures and independent topology, exactness, precedence, ownership, overflow and ID oracles; no native acceptance.", self_sha256_before: hash(self), self_sha256_after: hash(self) };
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(report));
