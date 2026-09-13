import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { chaikinPolyline2D } from "../../packages/javascript/src/chaikin-polyline-2d.js";
import { simplifyPolyline2D } from "../../packages/javascript/src/simplify-polyline-2d.js";
import { offsetPolyline2D } from "../../packages/javascript/src/offset-polyline-2d.js";
import { convexHull2D } from "../../packages/javascript/src/convex-hull-2d.js";
import { triangulateSimplePolygon2D } from "../../packages/javascript/src/triangulate-simple-polygon-2d.js";

const ROOT = resolve(new URL("../..", import.meta.url).pathname);
const EVIDENCE = resolve(ROOT, "evidence/conformance/p5-tenfold-geometry-a.json");
const operations = [["chaikin-polyline-2d", chaikinPolyline2D], ["simplify-polyline-2d", simplifyPolyline2D], ["offset-polyline-2d", offsetPolyline2D], ["convex-hull-2d", convexHull2D], ["triangulate-simple-polygon-2d", triangulateSimplePolygon2D]];
const sourceFiles = ["internal/geometry-a-utils.js", ...operations.map(([stem]) => `${stem}.js`)];
const fixtureFile = (stem) => resolve(ROOT, "fixtures/operations", `${stem}.json`);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const checksum = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fixture = (stem) => JSON.parse(readFileSync(fixtureFile(stem)));
function errorCode(action, code) { assert.throws(action, (error) => error instanceof Error && error.code === code); }
function area(points, indices = points.map((_, i) => i)) { let sum = 0; for (let i = 0; i < indices.length; i += 1) { const a = points[indices[i]], b = points[indices[(i + 1) % indices.length]]; sum += a[0] * b[1] - a[1] * b[0]; } return sum / 2; }
const clone = (value) => JSON.parse(JSON.stringify(value));

const sourceBefore = Object.fromEntries(sourceFiles.map((file) => [file, sha(resolve(ROOT, "packages/javascript/src", file))]));
const fixtures = Object.fromEntries(operations.map(([stem]) => [stem, fixture(stem)]));
for (const [stem, operation] of operations) for (const test of fixtures[stem].cases) {
  if (test.error) errorCode(() => operation(test.input), test.error); else assert.deepEqual(operation(test.input), test.output, `${stem}/${test.id}`);
}
for (const [stem, operation] of operations) {
  errorCode(() => operation(null), "INVALID_INPUT"); errorCode(() => operation([]), "INVALID_INPUT");
  const getter = clone(fixtures[stem].cases.find((test) => test.output).input); let reads = 0;
  Object.defineProperty(getter, "points", { enumerable: true, configurable: true, get() { reads += 1; return []; } });
  errorCode(() => operation(getter), "INVALID_INPUT"); assert.equal(reads, 0, `${stem} rejects otherwise-valid getter without reading it`);
  const input = clone(fixtures[stem].cases.find((test) => test.output).input), before = clone(input), output = operation(input);
  if (output.points.length) output.points[0][0] = 999; if (output.sourceIndices?.length) output.sourceIndices[0] = 999; if (output.triangles?.length) output.triangles[0][0] = 999;
  assert.deepEqual(input, before, `${stem} does not mutate input`); assert.notEqual(JSON.stringify(operation(input)), JSON.stringify(output), `${stem} output is detached`);
}
const refineInput = { points: [[0, 0], [2, 3], [4, 0]], closed: false, iterations: 2, maxWork: 21 }, refined = chaikinPolyline2D(refineInput).points;
assert.equal(refined.length, 12); assert.deepEqual(refined[0], refineInput.points[0]); assert.deepEqual(refined.at(-1), refineInput.points.at(-1), "open refinement preserves endpoints per pass");
const refinedClosed = chaikinPolyline2D({ ...refineInput, closed: true, maxWork: 21 }).points; assert.equal(refinedClosed.length, 12); assert.notDeepEqual(refinedClosed[0], refinedClosed.at(-1), "closed refinement has no appended seam");
assert.deepEqual(simplifyPolyline2D({ points: [[0, 0], [1, 1], [2, 1], [3, 0]], tolerance: 0, maxWork: 16 }).sourceIndices, [0, 1, 2, 3], "left-first traversal returns ascending indices");
assert.deepEqual(convexHull2D({ points: [[0, 0], [1, 0], [2, 0], [1, 0]], maxWork: 20 }), { points: [[0, 0], [2, 0]], sourceIndices: [0, 2] }, "hull preserves earliest duplicate identity");
const signedZero = chaikinPolyline2D({ points: [[-0, -0], [4, 0]], closed: false, iterations: 0, maxWork: 2 }).points[0]; assert.equal(Object.is(signedZero[0], -0), false); assert.equal(Object.is(signedZero[1], -0), false, "outputs canonicalize signed zero");
const sparse = [[0, 0], [1, 0]]; delete sparse[1]; errorCode(() => convexHull2D({ points: sparse, maxWork: 6 }), "INVALID_INPUT");
errorCode(() => offsetPolyline2D({ points: [[0, 0], [1, 0], [0, 0]], closed: false, distance: 0, miterLimit: 1, maxWork: 12 }), "INVALID_INPUT");
errorCode(() => triangulateSimplePolygon2D({ points: [[0, 0], [1, 0], [2, 0]], maxWork: 36 }), "INVALID_TOPOLOGY");
errorCode(() => simplifyPolyline2D({ points: [[-Number.MAX_VALUE, 0], [0, 1], [Number.MAX_VALUE, 0]], tolerance: 0, maxWork: 9 }), "NUMERIC_OVERFLOW");
const ccw = [[0, 0], [4, 0], [4, 3], [2, 1], [0, 3]];
for (const polygon of [ccw, [...ccw].reverse()]) {
  const output = triangulateSimplePolygon2D({ points: polygon, maxWork: polygon.length ** 3 + polygon.length ** 2 });
  assert.equal(output.triangles.length, polygon.length - 2); assert.ok(output.triangles.every((triangle) => area(output.points, triangle) > 0), "all ears have positive orientation");
  assert.equal(output.triangles.reduce((sum, triangle) => sum + area(output.points, triangle), 0), Math.abs(area(polygon)), "triangles preserve polygon area");
}
function regular(count) { return Array.from({ length: count }, (_, i) => [Math.cos((i * Math.PI * 2) / count), Math.sin((i * Math.PI * 2) / count)]); }
const polyline = (count) => Array.from({ length: count }, (_, i) => [i, i % 7]);
const hullPoints = (count) => Array.from({ length: count }, (_, i) => [i % Math.ceil(Math.sqrt(count)), Math.floor(i / Math.ceil(Math.sqrt(count)))]);
const workloads = {
  chaikin: [chaikinPolyline2D, { tiny: { points: polyline(2), closed: false, iterations: 1, maxWork: 6 }, study: { points: polyline(16), closed: false, iterations: 2, maxWork: 112 }, stress: { points: polyline(32), closed: false, iterations: 3, maxWork: 480 } }],
  simplify: [simplifyPolyline2D, { tiny: { points: polyline(4), tolerance: .1, maxWork: 16 }, study: { points: polyline(40), tolerance: .1, maxWork: 1600 }, stress: { points: polyline(160), tolerance: .1, maxWork: 25600 } }],
  offset: [offsetPolyline2D, { tiny: { points: polyline(2), closed: false, distance: 1, miterLimit: 2, maxWork: 8 }, study: { points: polyline(40), closed: false, distance: 1, miterLimit: 2, maxWork: 160 }, stress: { points: polyline(200), closed: false, distance: 1, miterLimit: 2, maxWork: 800 } }],
  hull: [convexHull2D, { tiny: { points: hullPoints(4), maxWork: 20 }, study: { points: hullPoints(40), maxWork: 1640 }, stress: { points: hullPoints(160), maxWork: 25760 } }],
  triangulate: [triangulateSimplePolygon2D, { tiny: { points: regular(3), maxWork: 36 }, study: { points: regular(12), maxWork: 1872 }, stress: { points: regular(40), maxWork: 65600 } }],
};
const timing = Object.fromEntries(Object.entries(workloads).map(([name, [operation, stages]]) => [name, Object.fromEntries(Object.entries(stages).map(([stage, input]) => { operation(input); const started = performance.now(); let output; for (let i = 0; i < 3; i += 1) output = operation(input); return [stage, { repetitions: 3, elapsed_ms: Number((performance.now() - started).toFixed(3)), checksum: checksum(output) }]; }))]));
const sourceAfter = Object.fromEntries(sourceFiles.map((file) => [file, sha(resolve(ROOT, "packages/javascript/src", file))])); assert.deepEqual(sourceAfter, sourceBefore, "test does not change source");
const report = { status: "passed", runtime: { node: process.version, platform: process.platform, architecture: process.arch }, operations: operations.map(([stem]) => `geometry.${stem}`), fixture_cases: Object.fromEntries(operations.map(([stem]) => [stem, fixtures[stem].cases.length])), fixture_sha256: Object.fromEntries(operations.map(([stem]) => [stem, sha(fixtureFile(stem))])), source_sha256: { before: sourceBefore, after: sourceAfter }, scenarios: ["shared exact fixtures", "otherwise-valid getter rejection", "all-five input/output detachment", "Chaikin endpoint and seam properties", "simplification order", "hull identity", "strict topology and overflow", "CCW/CW triangle orientation and area"], timing, scope: "Pure JavaScript p5-target core conformance only: no renderer, native workflow, support, or acceptance claim." };
mkdirSync(dirname(EVIDENCE), { recursive: true }); writeFileSync(EVIDENCE, JSON.stringify(report, null, 2) + "\n");
console.log(`p5-tenfold geometry A: ${Object.values(report.fixture_cases).reduce((a, b) => a + b, 0)} fixture cases and core properties passed`);
