#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { radiusPairs2D } from "../../packages/javascript/src/radius-pairs-2d.js";
import { pairForceStep2D } from "../../packages/javascript/src/pair-force-step-2d.js";
import { fdlibmHypot } from "../../packages/javascript/src/internal/fdlibm-hypot.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RADIUS_CATALOG = join(ROOT, "catalog/operations/radius-pairs-2d.json");
const FORCE_CATALOG = join(ROOT, "catalog/operations/pair-force-step-2d.json");
const RADIUS_FIXTURE = join(ROOT, "fixtures/operations/radius-pairs-2d.json");
const FORCE_FIXTURE = join(ROOT, "fixtures/operations/pair-force-step-2d.json");
const RADIUS_SOURCE = join(ROOT, "packages/javascript/src/radius-pairs-2d.js");
const FORCE_SOURCE = join(ROOT, "packages/javascript/src/pair-force-step-2d.js");
const HYPOT_SOURCE = join(ROOT, "packages/javascript/src/internal/fdlibm-hypot.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const files = [RADIUS_CATALOG, FORCE_CATALOG, RADIUS_FIXTURE, FORCE_FIXTURE, RADIUS_SOURCE, FORCE_SOURCE, HYPOT_SOURCE, SELF];
const hashes = () => Object.fromEntries(files.map((file) => [name(file), sha(file)]));
const outputHash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function fixtureChecks(radiusFixture, forceFixture) {
  assert.equal(radiusFixture.catalog_sha256, sha(RADIUS_CATALOG), "radius fixture catalog binding");
  assert.equal(forceFixture.catalog_sha256, sha(FORCE_CATALOG), "force fixture catalog binding");
  for (const item of radiusFixture.cases) {
    if (item.error) {
      assert.equal(typeof item.error, "string", `${item.id} frozen error form`);
      errorCode(() => radiusPairs2D(item.input), item.error);
    } else assert.deepStrictEqual(radiusPairs2D(item.input), item.output, item.id);
  }
  for (const item of forceFixture.cases) {
    if (item.error) {
      assert.equal(typeof item.error, "string", `${item.id} frozen error form`);
      errorCode(() => pairForceStep2D(item.input), item.error);
    } else assert.deepStrictEqual(pairForceStep2D(item.input), item.output, item.id);
  }
  return radiusFixture.cases.length + forceFixture.cases.length;
}

function bruteRadiusPairs(points, radius) {
  const pairs = [];
  for (let left = 0; left < points.length; left += 1) for (let right = left + 1; right < points.length; right += 1) {
    const dx = Math.abs(points[right][0] - points[left][0]);
    if (dx > radius) continue;
    const dy = Math.abs(points[right][1] - points[left][1]);
    if (dy > radius) continue;
    if (radius === 0 ? dx === 0 && dy === 0 : fdlibmHypot(dx, dy) <= radius) pairs.push([left, right]);
  }
  return pairs;
}

function randomPoints(count, seed, scale = 100) {
  const result = new Array(count);
  let state = seed >>> 0;
  for (let index = 0; index < count; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const x = ((state / 0x100000000) * 2 - 1) * scale;
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const y = ((state / 0x100000000) * 2 - 1) * scale;
    result[index] = [x, y];
  }
  return result;
}

function sweepOracleChecks() {
  const cases = [
    { id: "horizontal", points: Array.from({ length: 37 }, (_, index) => [index * 0.75, (index % 3) - 1]), radius: 1.25 },
    { id: "vertical", points: Array.from({ length: 37 }, (_, index) => [0, index * 4]), radius: 1.1 },
    { id: "clustered", points: Array.from({ length: 48 }, (_, index) => [(index % 8) * 0.125, Math.floor(index / 8) * 0.125]), radius: 0.27 },
    { id: "extreme", points: [[-1e308, 0], [1e308, 0], [0, -1e308], [0, 1e308], [0, 0], [5e-324, 0]], radius: 1e308 },
  ];
  for (let seed = 1; seed <= 12; seed += 1) cases.push({ id: `random-${seed}`, points: randomPoints(31, seed), radius: 34.5 });
  for (const item of cases) {
    const maxWork = item.points.length + item.points.length * (item.points.length - 1) / 2;
    assert.deepStrictEqual(radiusPairs2D({ points: item.points, radius: item.radius, maxWork }).pairs, bruteRadiusPairs(item.points, item.radius), item.id);
  }
  const vertical = Array.from({ length: 9 }, (_, index) => [0, index * 10]);
  const candidates = vertical.length * (vertical.length - 1) / 2;
  assert.deepStrictEqual(radiusPairs2D({ points: vertical, radius: 1, maxWork: vertical.length + candidates }), { pairs: [] }, "vertical candidate budget");
  errorCode(() => radiusPairs2D({ points: vertical, radius: 1, maxWork: vertical.length + candidates - 1 }), "WORK_LIMIT");
  return { independent_bruteforce_cases: cases.length, candidate_budget_case: { points: vertical.length, candidates } };
}

function ownershipAndCarrierChecks() {
  const radiusValid = () => ({ points: [[0, 0], [1, 0]], radius: 1, maxWork: 3 });
  const forceValid = () => ({ points: [[0, 0], [2, 0]], velocities: [[0, 0], [0, 0]], pairs: [[0, 1]], attraction: 0.5, repulsion: 0, repulsionRadius: 0, damping: 1, dt: 1, maxSpeed: 10, maxWork: 3 });
  const deepFreeze = (value) => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); }
    return value;
  };
  const radiusInput = deepFreeze(radiusValid());
  const radiusInputBefore = structuredClone(radiusInput);
  const radiusOutput = radiusPairs2D(radiusInput);
  assert.deepStrictEqual(radiusInput, radiusInputBefore, "radius input unchanged during call");
  const radiusBaseline = structuredClone(radiusOutput);
  radiusOutput.pairs[0][0] = 99;
  assert.deepStrictEqual(radiusPairs2D(radiusValid()), radiusBaseline, "radius pairs freshly allocated");

  const forceInput = deepFreeze(forceValid());
  const forceInputBefore = structuredClone(forceInput);
  const forceOutput = pairForceStep2D(forceInput);
  assert.deepStrictEqual(forceInput, forceInputBefore, "force input unchanged during call");
  const forceBaseline = structuredClone(forceOutput);
  forceOutput.points[0][0] = 99; forceOutput.velocities[0][0] = 99; forceOutput.forces[0][0] = 99;
  assert.deepStrictEqual(pairForceStep2D(forceValid()), forceBaseline, "force output arrays freshly allocated");
  const output = pairForceStep2D(forceValid());
  assert.notStrictEqual(output.points, output.velocities, "distinct output containers");
  assert.notStrictEqual(output.points[0], output.points[1], "distinct output point pairs");
  assert.notStrictEqual(output.points[0], output.velocities[0], "position and velocity pairs do not alias");
  assert.notStrictEqual(output.points[0], output.forces[0], "position and force pairs do not alias");

  class Carrier {}
  errorCode(() => radiusPairs2D(Object.assign(new Carrier(), radiusValid())), "INVALID_INPUT");
  const radiusAccessor = { points: [[0, 0]], radius: 0, maxWork: 1 };
  let getterReads = 0;
  Object.defineProperty(radiusAccessor, "radius", { enumerable: true, get() { getterReads += 1; return 0; } });
  errorCode(() => radiusPairs2D(radiusAccessor), "INVALID_INPUT");
  assert.equal(getterReads, 0, "accessor getter remains unread");
  errorCode(() => radiusPairs2D({ points: [[0, 0]], radius: NaN, maxWork: 0 }), "INVALID_INPUT");
  const sparsePoints = { points: new Array(1), radius: 0, maxWork: 0 };
  errorCode(() => radiusPairs2D(sparsePoints), "INVALID_INPUT");
  const radiusSymbol = radiusValid(); radiusSymbol[Symbol("extra")] = true;
  errorCode(() => radiusPairs2D(radiusSymbol), "INVALID_INPUT");
  const radiusArrayExtra = radiusValid(); radiusArrayExtra.points.extra = true;
  errorCode(() => radiusPairs2D(radiusArrayExtra), "INVALID_INPUT");
  errorCode(() => radiusPairs2D({ ...radiusValid(), points: new Float64Array([0, 0]) }), "INVALID_INPUT");
  const forceExtra = { ...forceValid(), extra: true };
  errorCode(() => pairForceStep2D(forceExtra), "INVALID_INPUT");
  errorCode(() => pairForceStep2D({ ...forceValid(), pairs: [[0, 1n]] }), "INVALID_INPUT");
  const sparseVelocity = { ...forceValid(), velocities: [new Array(2), [0, 0]] };
  errorCode(() => pairForceStep2D(sparseVelocity), "INVALID_INPUT");
  errorCode(() => pairForceStep2D({ ...forceValid(), points: [[NaN, 0], [2, 0]] }), "INVALID_INPUT");
  errorCode(() => pairForceStep2D({ ...forceValid(), points: [[0, 0]], velocities: [], pairs: [], maxWork: 0 }), "INVALID_INPUT");
  return ["frozen input remains unchanged", "fresh non-aliased nested output arrays", "class/accessor/symbol/extra-array/typed/sparse/nonfinite/bigint carriers", "static validation precedes work"];
}

function synchronousAndOverflowChecks() {
  const chain = { points: [[0, 0], [2, 0], [4, 0]], velocities: [[0, 0], [0, 0], [0, 0]], pairs: [[0, 1], [1, 2]], attraction: 0.5, repulsion: 0, repulsionRadius: 0, damping: 1, dt: 1, maxSpeed: 100, maxWork: 5 };
  const result = pairForceStep2D(chain);
  assert.deepStrictEqual(result.points, [[1, 0], [2, 0], [3, 0]], "all positions use old-state force sums");
  assert.deepStrictEqual(result.forces, [[1, 0], [0, 0], [-1, 0]], "reciprocal chain forces");
  const pair = pairForceStep2D({ ...chain, points: [[0, 0], [3, 4]], velocities: [[0, 0], [0, 0]], pairs: [[0, 1]], maxWork: 3 });
  assert.equal(pair.forces[0][0], -pair.forces[1][0], "single pair x force symmetry");
  assert.equal(pair.forces[0][1], -pair.forces[1][1], "single pair y force symmetry");
  const extremePoints = [[-1e308, 0], [1e308, 0]];
  assert.deepStrictEqual(radiusPairs2D({ points: extremePoints, radius: 1e308, maxWork: 3 }), { pairs: [] }, "query treats overflow screen as outside");
  errorCode(() => pairForceStep2D({ points: extremePoints, velocities: [[0, 0], [0, 0]], pairs: [[0, 1]], attraction: 0, repulsion: 0, repulsionRadius: 0, damping: 1, dt: 1, maxSpeed: 1, maxWork: 3 }), "NUMERIC_OVERFLOW");
  return ["synchronous chain", "single-pair reciprocal force symmetry", "query-screen versus force-step overflow distinction"];
}

function timed(label, input, operation, descriptor) {
  const warmups = [];
  for (let round = 0; round < 2; round += 1) { const start = performance.now(); const output = operation(input); const serialized = JSON.stringify(output); warmups.push({ elapsed_ms: Number((performance.now() - start).toFixed(3)), checksum: outputHash(output), retained_json_bytes: Buffer.byteLength(serialized) }); }
  const repetitions = [];
  for (let round = 0; round < 3; round += 1) { const start = performance.now(); const output = operation(input); const serialized = JSON.stringify(output); repetitions.push({ elapsed_ms: Number((performance.now() - start).toFixed(3)), checksum: outputHash(output), retained_json_bytes: Buffer.byteLength(serialized) }); }
  const checksum = repetitions[0].checksum;
  const retainedJsonBytes = repetitions[0].retained_json_bytes;
  assert.ok([...warmups, ...repetitions].every((sample) => sample.checksum === checksum && sample.retained_json_bytes === retainedJsonBytes), `${label} stable output`);
  return { label, input: descriptor, warmups, repetitions, checksum };
}

function performanceChecks() {
  const queryCases = [
    ["tiny", randomPoints(16, 31, 100), 22, 31, 100],
    ["study", randomPoints(256, 32, 1000), 55, 32, 1000],
    ["stress", randomPoints(2048, 33, 100000), 20, 33, 100000],
  ];
  const query = queryCases.map(([label, points, radius, seed, scale]) => {
    const maxWork = points.length + points.length * (points.length - 1) / 2;
    return timed(`query-${label}`, { points, radius, maxWork }, radiusPairs2D, { points: { generator: "lcg32", count: points.length, seed, scale }, radius, max_work: maxWork });
  });
  const step = queryCases.map(([label, points, , seed, scale]) => {
    const pairs = Array.from({ length: points.length - 1 }, (_, index) => [index, index + 1]);
    const input = { points, velocities: points.map(() => [0, 0]), pairs, attraction: 0.001, repulsion: 0.1, repulsionRadius: 20, damping: 0.99, dt: 1, maxSpeed: 10, maxWork: points.length + pairs.length };
    return timed(`step-${label}`, input, pairForceStep2D, { points: { generator: "lcg32", count: points.length, seed, scale }, velocities: "positive-zero pairs", pairs: { topology: "ascending-chain", count: pairs.length }, attraction: input.attraction, repulsion: input.repulsion, repulsion_radius: input.repulsionRadius, damping: input.damping, dt: input.dt, max_speed: input.maxSpeed, max_work: input.maxWork });
  });
  const count = 512, dense = Array.from({ length: count }, () => [0, 0]);
  const candidateCount = count * (count - 1) / 2;
  const worstCase = timed("query-dense-worstcase", { points: dense, radius: 0, maxWork: count + candidateCount }, radiusPairs2D, { points: { generator: "constant", count, value: [0, 0] }, radius: 0, max_work: count + candidateCount });
  assert.equal(radiusPairs2D({ points: dense, radius: 0, maxWork: count + candidateCount }).pairs.length, candidateCount, "dense output count");
  return { runtime: { node: process.version, platform: process.platform, architecture: process.arch }, methodology: "Two warmups and three timed fresh calls per workload; checksum is SHA-256 of exact JSON output. Timings cover validation, sorting/query or pair stepping, and retained output construction.", query, step, worst_case: { ...worstCase, count, candidate_count: candidateCount, work_budget: count + candidateCount } };
}

function outputPath(value) {
  const path = resolve(value);
  if (!path.startsWith(join(ROOT, ".work") + sep) || existsSync(path)) throw new Error("Outputs must be fresh paths under .work");
  return path;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--core-output" || args[2] !== "--performance-output") throw new Error("Usage: --core-output FRESH_JSON_PATH --performance-output FRESH_JSON_PATH");
  const coreOutput = outputPath(args[1]), performanceOutput = outputPath(args[3]);
  const radiusFixture = JSON.parse(readFileSync(RADIUS_FIXTURE));
  const forceFixture = JSON.parse(readFileSync(FORCE_FIXTURE));
  const before = hashes();
  const fixtureCases = fixtureChecks(radiusFixture, forceFixture);
  const sweep = sweepOracleChecks();
  const ownership = ownershipAndCarrierChecks();
  const semantic = synchronousAndOverflowChecks();
  const afterCore = hashes();
  assert.deepStrictEqual(afterCore, before, "core input stability");
  const core = { status: "passed", operations: [radiusFixture.operation, forceFixture.operation], node_version: process.version, scope: "Actual independent JavaScript proximity cores against frozen analytical fixtures, brute-force sweep oracle, passive-carrier, ownership, synchronous-force and overflow-semantics checks. No renderer or acceptance claim.", input_sha256_before: before, input_sha256_after: afterCore, scenarios: { fixture_cases: fixtureCases, sweep_oracle: sweep, ownership_carriers: ownership, force_semantics: semantic } };
  mkdirSync(dirname(coreOutput), { recursive: true });
  writeFileSync(coreOutput, JSON.stringify(core, null, 2) + "\n", { flag: "wx" });
  const performanceResult = performanceChecks();
  const afterPerformance = hashes();
  assert.deepStrictEqual(afterPerformance, before, "performance input stability");
  const performanceReport = { status: "observed", operations: core.operations, input_sha256_before: before, input_sha256_after: afterPerformance, ...performanceResult, host_allocation_scope: "The contract's finite-domain limits and maxWork govern validation; this observation adds no hidden allocation quota. A host allocation failure at a permitted descriptor remains a host failure outside these measurements.", scope: "Node pure-core observation only; it does not claim browser/native-renderer performance, target support, or acceptance." };
  mkdirSync(dirname(performanceOutput), { recursive: true });
  writeFileSync(performanceOutput, JSON.stringify(performanceReport, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: core.status, core_output: coreOutput, performance_output: performanceOutput, fixture_cases: fixtureCases }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
