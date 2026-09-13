#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { voronoiCells2D } from "../../packages/javascript/src/voronoi-cells-2d.js";
import { resamplePolyline2D } from "../../packages/javascript/src/resample-polyline-2d.js";
import { marchingSquares2D } from "../../packages/javascript/src/marching-squares-2d.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SELF = fileURLToPath(import.meta.url);
const operations = [
  ["voronoi-cells-2d", "geometry.voronoi-cells-2d", voronoiCells2D],
  ["resample-polyline-2d", "geometry.resample-polyline-2d", resamplePolyline2D],
  ["marching-squares-2d", "geometry.marching-squares-2d", marchingSquares2D],
];
const path = (stem, folder) => join(ROOT, folder, `${stem}.json`);
const source = (stem) => join(ROOT, "packages/javascript/src", `${stem}.js`);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const inputHashes = () => Object.fromEntries([...operations.flatMap(([stem]) => [path(stem, "catalog/operations"), path(stem, "fixtures/operations"), source(stem)]), SELF].map((file) => [name(file), sha(file)]));
function expectError(action, code) { assert.throws(action, (error) => error instanceof Error && error.code === code); }

function fixtureChecks() {
  for (const [stem, operation, fn] of operations) {
    const fixture = JSON.parse(readFileSync(path(stem, "fixtures/operations")));
    assert.equal(fixture.operation, operation);
    assert.equal(fixture.catalog_sha256, sha(path(stem, "catalog/operations")));
    for (const item of fixture.cases) {
      if (item.error) expectError(() => fn(item.input), item.error);
      else assert.deepEqual(fn(item.input), item.output, `${stem}/${item.id}`);
    }
  }
}
function nativeChecks() {
  for (const [, , fn] of operations) {
    expectError(() => fn(null), "INVALID_INPUT");
    expectError(() => fn([]), "INVALID_INPUT");
  }
  const frozen = { sites: [[0, 0]], bounds: [0, 0, 1, 1], maxWork: 20 };
  const output = voronoiCells2D(frozen); frozen.sites[0][0] = 99; output.cells[0][0][0] = 88;
  assert.equal(voronoiCells2D({ sites: [[0, 0]], bounds: [0, 0, 1, 1], maxWork: 20 }).cells[0][0][0], 0, "Voronoi input and output detached");
  const accessor = { sites: [], bounds: [0, 0, 1, 1], maxWork: 1 };
  Object.defineProperty(accessor, "sites", { enumerable: true, get() { throw new Error("accessed"); } });
  expectError(() => voronoiCells2D(accessor), "INVALID_INPUT");
  expectError(() => voronoiCells2D({ sites: [[-Number.MAX_VALUE, 0], [Number.MAX_VALUE, 0]], bounds: [0, 0, 1, 1], maxWork: 100 }), "NUMERIC_OVERFLOW");
  const tiled = voronoiCells2D({ sites: [[1, 1], [3, 1], [1, 3], [3, 3]], bounds: [0, 0, 4, 4], maxWork: 1000 });
  const area = (polygon) => Math.abs(polygon.reduce((sum, point, i) => sum + point[0] * polygon[(i + 1) % polygon.length][1] - point[1] * polygon[(i + 1) % polygon.length][0], 0) / 2);
  assert.equal(tiled.cells.reduce((sum, polygon) => sum + area(polygon), 0), 16, "Voronoi cells tile bounds");
  for (let i = 0; i < tiled.cells.length; i += 1) for (const point of tiled.cells[i]) for (let j = 0; j < 4; j += 1) {
    const own = (point[0] - [[1, 1], [3, 1], [1, 3], [3, 3]][i][0]) ** 2 + (point[1] - [[1, 1], [3, 1], [1, 3], [3, 3]][i][1]) ** 2;
    const other = (point[0] - [[1, 1], [3, 1], [1, 3], [3, 3]][j][0]) ** 2 + (point[1] - [[1, 1], [3, 1], [1, 3], [3, 3]][j][1]) ** 2;
    assert.ok(own <= other, "Voronoi vertex is nearest to its owner");
  }
  assert.deepEqual(voronoiCells2D({ sites: [[0, 0], [-0, -0]], bounds: [-1, -1, 1, 1], maxWork: 20 }).cells[1], [], "signed-zero duplicate belongs to first site");
  expectError(() => voronoiCells2D({ sites: [[0, 0], [1, 0]], bounds: [0, 0, 1, 1], maxWork: 7 }), "WORK_LIMIT");
  expectError(() => resamplePolyline2D({ points: [[-Number.MAX_VALUE, 0], [Number.MAX_VALUE, 0]], closed: false, count: 2, maxWork: 10 }), "NUMERIC_OVERFLOW");
  assert.deepEqual(resamplePolyline2D({ points: [[4, 0], [0, 0]], closed: false, count: 3, maxWork: 5 }).points, [[4, 0], [2, 0], [0, 0]], "reversed open path");
  const trailing = resamplePolyline2D({ points: [[0, 0], [4, 0], [4, 0]], closed: false, count: 3, maxWork: 6 });
  assert.deepEqual(trailing.points[2], [4, 0], "trailing duplicate preserves supplied endpoint"); assert.equal(trailing.sourceSegments[2], 0, "trailing duplicate retains positive source index");
  const seam = resamplePolyline2D({ points: [[0, 0], [3, 0], [0, 3]], closed: true, count: 3, maxWork: 6 });
  assert.notDeepEqual(seam.points[2], seam.points[0], "closed sampling does not append a seam point");
  assert.equal(resamplePolyline2D({ points: [[0, 0], [3, 4]], closed: false, count: 2, maxWork: 4 }).totalLength, 5, "3-4-5 traveled length");
  const resampleInput = { points: [[0, 0], [2, 0]], closed: false, count: 2, maxWork: 4 };
  const resampleOutput = resamplePolyline2D(resampleInput); resampleOutput.points[0][0] = 7;
  assert.deepEqual(resampleInput.points, [[0, 0], [2, 0]], "resample input unchanged"); assert.equal(resamplePolyline2D(resampleInput).points[0][0], 0, "resample output detached");
  expectError(() => marchingSquares2D({ values: [0, 0, 0, 0], columns: 2, rows: 2, origin: [Number.MAX_VALUE, 0], spacing: [Number.MAX_VALUE, 1], threshold: 0, maxWork: 10 }), "NUMERIC_OVERFLOW");
  const end = 1e15 + 4;
  assert.equal(resamplePolyline2D({ points: [[1e15, 0], [end, 0]], closed: false, count: 2, maxWork: 4 }).points[1][0], end, "open endpoint exact");
  const contour = marchingSquares2D({ values: [-1, 0, -1, 0], columns: 2, rows: 2, origin: [1e15, 0], spacing: [4, 1], threshold: 0, maxWork: 10 });
  assert.equal(contour.segments[0][0], 1e15 + 4, "edge t=1 endpoint exact");
  const shared = marchingSquares2D({ values: [0, 0, 0, 1, 1, 1], columns: 3, rows: 2, origin: [0, 0], spacing: [1, 1], threshold: .5, maxWork: 20 });
  assert.deepEqual(shared.segments, [[1, .5, 0, .5], [2, .5, 1, .5]], "multi-cell segment ordering and shared endpoint");
  assert.deepEqual(marchingSquares2D({ values: [0, 1, 0, 1], columns: 2, rows: 2, origin: [10, 20], spacing: [2, 3], threshold: .5, maxWork: 10 }).segments, [[11, 20, 11, 23]], "affine grid coordinates");
  const marchingInput = { values: [0, 1, 0, 1], columns: 2, rows: 2, origin: [0, 0], spacing: [1, 1], threshold: .5, maxWork: 10 };
  const marchingOutput = marchingSquares2D(marchingInput); marchingOutput.segments[0][0] = 7;
  assert.deepEqual(marchingInput.values, [0, 1, 0, 1], "marching input unchanged"); assert.equal(marchingSquares2D(marchingInput).segments[0][0], .5, "marching output detached");
  expectError(() => resamplePolyline2D({ points: [[Infinity, 0]], closed: false, count: 1, maxWork: 0 }), "INVALID_INPUT");
  expectError(() => marchingSquares2D({ values: [Infinity, 0, 0, 0], columns: 2, rows: 2, origin: [0, 0], spacing: [1, 1], threshold: 0, maxWork: 0 }), "INVALID_INPUT");
  expectError(() => marchingSquares2D({ values: [Infinity], columns: Number.MAX_SAFE_INTEGER, rows: 2, origin: [0, 0], spacing: [1, 1], threshold: 0, maxWork: Number.MAX_SAFE_INTEGER }), "INVALID_INPUT");
  expectError(() => marchingSquares2D({ values: [0], columns: Number.MAX_SAFE_INTEGER, rows: 2, origin: [0, 0], spacing: [1, 1], threshold: 0, maxWork: Number.MAX_SAFE_INTEGER }), "WORK_LIMIT");
  return ["plain-data carriers", "detached input and output", "Voronoi tiling and nearest-site inequality", "polyline direction, seam and length", "contour shared endpoints and affine coordinates", "invalid data before budget", "computed overflow", "exact t=1 endpoints"];
}
function checksum(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function timed(input, fn) {
  fn(input); const started = performance.now(); let output;
  for (let i = 0; i < 3; i += 1) output = fn(input);
  return { elapsed_ms: Number((performance.now() - started).toFixed(3)), checksum: checksum(output) };
}
function performanceChecks() {
  const cases = {
    voronoi: [voronoiCells2D, (n) => ({ sites: Array.from({ length: n }, (_, i) => [i % Math.ceil(Math.sqrt(n)) * 4 + 1, Math.floor(i / Math.ceil(Math.sqrt(n))) * 4 + 1]), bounds: [0, 0, Math.ceil(Math.sqrt(n)) * 4, Math.ceil(Math.sqrt(n)) * 4], maxWork: n * n * n + n * n })],
    resample: [resamplePolyline2D, (n) => ({ points: Array.from({ length: n }, (_, i) => [i, i % 7]), closed: false, count: n * 10, maxWork: n * 11 })],
    marching: [marchingSquares2D, (n) => ({ values: Array.from({ length: n * n }, (_, i) => i % n - Math.floor(i / n)), columns: n, rows: n, origin: [0, 0], spacing: [1, 1], threshold: 0, maxWork: n * n + (n - 1) * (n - 1) })],
  };
  const sizes = { voronoi: [["tiny", 4], ["study", 64], ["stress", 144]], resample: [["tiny", 4], ["study", 160], ["stress", 2000]], marching: [["tiny", 4], ["study", 81], ["stress", 128]] };
  return Object.fromEntries(Object.entries(cases).map(([name, [fn, build]]) => [name, Object.fromEntries(sizes[name].map(([stage, n]) => [stage, { n, ...timed(build(n), fn), repetitions: 3 }]))]));
}

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--output") throw new Error("Usage: --output FRESH_JSON_PATH");
  const output = resolve(process.argv[3]);
  if (!output.startsWith(join(ROOT, ".work") + sep) || existsSync(output)) throw new Error("Output must be fresh and under .work");
  const before = inputHashes(); fixtureChecks(); const native = nativeChecks(); const performance = performanceChecks(); const after = inputHashes();
  assert.deepEqual(after, before, "source stability");
  const fixtureCases = operations.reduce((sum, [stem]) => sum + JSON.parse(readFileSync(path(stem, "fixtures/operations"))).cases.length, 0);
  const report = { status: "passed", node_version: process.version, scope: "Three p5-only pure cores: exact analytical fixtures plus validation, ownership, overflow, endpoint and bounded-work checks. No rendering or support acceptance claim.", operations: operations.map(([, operation]) => operation), input_sha256_before: before, input_sha256_after: after, scenarios: { fixture_cases: fixtureCases, native_only: native, performance } };
  mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" }); console.log(JSON.stringify({ status: report.status, output, performance }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
