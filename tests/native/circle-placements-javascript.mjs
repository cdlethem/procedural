/** Consume frozen CP3 placement fixtures against the JavaScript core; no renderer is started. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CirclePlacementError, orderedCircleFilter2D, seededCirclePlacement2D } from "../../packages/javascript/src/circle-placements.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const orderedPath = path.join(root, "fixtures/operations/ordered-circle-filter.json");
const seededPath = path.join(root, "fixtures/operations/seeded-circle-placement.json");
const orderedCatalog = path.join(root, "catalog/operations/ordered-circle-filter.json");
const seededCatalog = path.join(root, "catalog/operations/seeded-circle-placement.json");
const output = path.join(root, ".work/conformance/circle-placements-javascript.json");
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const bits = value => {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  return view.getBigUint64(0, false);
};
const same = (actual, expected) => bits(actual) === bits(expected);
const sha = async name => digest(await fs.readFile(name));

function equalValues(actual, expected) {
  assert.equal(actual.attempts, expected.attempts);
  assert.equal(actual.centres.length, expected.centres.length);
  assert.deepEqual(actual.sourceIndices, expected.sourceIndices);
  for (let index = 0; index < actual.centres.length; index += 1) {
    assert(same(actual.centres[index][0], expected.centres[index][0]));
    assert(same(actual.centres[index][1], expected.centres[index][1]));
    assert(same(actual.radii[index], expected.radii[index]));
  }
}

function expectError(work, expected, detail = undefined) {
  assert.throws(work, error => {
    assert(error instanceof CirclePlacementError);
    assert.equal(error.code, expected);
    if (detail === undefined) {
      assert.equal(Object.hasOwn(error, "candidateIndex"), false);
      assert.equal(Object.hasOwn(error, "stage"), false);
    } else {
      assert.equal(error.candidateIndex, detail.candidateIndex);
      assert.equal(error.stage, detail.stage);
    }
    return true;
  });
}

function invoke(kind, input) { return kind === "ordered" ? orderedCircleFilter2D(input) : seededCirclePlacement2D(input); }

function runFixture(kind, fixture) {
  const results = new Map();
  for (const item of fixture.cases) {
    if (item.error !== undefined) {
      expectError(() => invoke(kind, item.input), item.error, item.error_detail);
      continue;
    }
    const result = invoke(kind, item.input);
    const values = result.toValues();
    equalValues(values, item.output);
    assert.equal(result.size, item.output.radii.length);
    assert.equal(result.attempts, item.output.attempts);
    for (let index = 0; index < result.size; index += 1) {
      const point = result.pointAt(index);
      assert(same(point[0], item.output.centres[index][0]));
      assert(same(point[1], item.output.centres[index][1]));
      assert(same(result.radiusAt(index), item.output.radii[index]));
      assert.equal(result.sourceIndexAt(index), item.output.sourceIndices[index]);
    }
    results.set(item.id, result);
  }
  return results;
}

function hostChecks() {
  const config = { centres: [[-0, 0], [2, 0]], radii: [1, 1], separationScale: 1 };
  const result = orderedCircleFilter2D(config);
  config.centres[0][0] = 99; config.radii[0] = 99;
  assert(same(result.pointAt(0)[0], 0));
  assert(same(result.radiusAt(0), 1));
  const values = result.toValues();
  values.centres[0][0] = 88; values.radii[0] = 88; values.sourceIndices[0] = 88;
  assert(same(result.pointAt(0)[0], 0));
  assert(same(result.radiusAt(0), 1));
  assert.equal(result.sourceIndexAt(0), 0);
  expectError(() => result.pointAt(true), "INVALID_INDEX");
  expectError(() => result.pointAt(2), "INDEX_OUT_OF_RANGE");
  const destination = [7, 7, 7];
  expectError(() => result.pointInto(true, destination), "INVALID_INDEX");
  expectError(() => result.pointInto(2, destination), "INDEX_OUT_OF_RANGE");
  expectError(() => result.pointInto(0, destination, 2), "INVALID_OUTPUT");
  assert.deepEqual(destination, [7, 7, 7]);
  const typed = new Float64Array(3);
  assert.equal(result.pointInto(1, typed, 1), typed);
  assert(same(typed[1], 2) && same(typed[2], 0));
  expectError(() => orderedCircleFilter2D({ centres: [[NaN, 0]], radii: [1], separationScale: 1 }), "INVALID_INPUT");
  expectError(() => orderedCircleFilter2D({ centres: [[0, 0]], radii: [new Number(1)], separationScale: 1 }), "INVALID_INPUT");
  expectError(() => seededCirclePlacement2D({ seed: 42, attempts: 1, origin: [0, 0], extent: [1, Infinity], radiusRange: [1, 2], separationScale: 1 }), "INVALID_INPUT");
}

async function main() {
  await fs.mkdir(path.dirname(output), { recursive: true });
  try { await fs.access(output); throw new Error("preserve existing JavaScript conformance attempt"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const [ordered, seeded] = await Promise.all([orderedPath, seededPath].map(async item => JSON.parse(await fs.readFile(item, "utf8"))));
  assert.equal(ordered.catalog_sha256, "d4e93aa0dc219b0730af1e3eecad5cb9a8be3030e9f0761b9b23d0886f6c2083");
  assert.equal(seeded.catalog_sha256, "04de90b19cbd39a5aa4840dfd1ee80cbeb96b69b9981af95b176be7bc0480267");
  assert.equal(await sha(orderedCatalog), ordered.catalog_sha256);
  assert.equal(await sha(seededCatalog), seeded.catalog_sha256);
  const sources = [orderedPath, seededPath, orderedCatalog, seededCatalog, fileURLToPath(import.meta.url),
    path.join(root, "packages/javascript/src/circle-placements.js")];
  const before = Object.fromEntries(await Promise.all(sources.map(async item => [path.relative(root, item), await sha(item)])));
  const coreSource = await fs.readFile(path.join(root, "packages/javascript/src/circle-placements.js"), "utf8");
  const internals = await import("data:text/javascript," + encodeURIComponent(coreSource +
    "\nexport { Xoshiro128StarStar11 as fixtureXoshiro, mapCandidate as fixtureMapCandidate, seededInput as fixtureSeededInput };"));
  const orderedResults = runFixture("ordered", ordered);
  const seededResults = runFixture("seeded", seeded);
  for (const vector of seeded.seed_vectors) {
    const stream = new internals.fixtureXoshiro(vector.seed);
    assert.deepEqual([stream.s0, stream.s1, stream.s2, stream.s3], vector.initial_state);
    for (const step of vector.first_10) {
      assert.equal(stream.nextU32(), step.output_u32);
      assert.deepEqual([stream.s0, stream.s1, stream.s2, stream.s3], step.post_state);
      assert(same(step.unit, step.output_u32 / 4_294_967_296));
    }
  }
  for (const vector of seeded.mapping_vectors) {
    const candidate = internals.fixtureMapCandidate(internals.fixtureSeededInput(vector.config), ...vector.units, 0);
    assert(same(candidate.x, vector.mapped.centre[0]));
    assert(same(candidate.y, vector.mapped.centre[1]));
    assert(same(candidate.radius, vector.mapped.radius));
  }
  for (const check of seeded.cross_case_checks) {
    if (check.kind === "accepted-binary64-prefix") {
      const left = seededResults.get(check.prefix_case).toValues();
      const right = seededResults.get(check.extended_case).toValues();
      for (let index = 0; index < left.radii.length; index += 1) {
        assert(same(left.centres[index][0], right.centres[index][0]));
        assert(same(left.centres[index][1], right.centres[index][1]));
        assert(same(left.radii[index], right.radii[index]));
        assert.equal(left.sourceIndices[index], right.sourceIndices[index]);
      }
    } else if (check.kind === "independently-materialized-proposals-share-filter-output") {
      equalValues(seededResults.get(check.seeded_case).toValues(), orderedResults.get(check.filter_case).toValues());
    } else throw new Error("unknown cross-case check");
  }
  hostChecks();
  const after = Object.fromEntries(await Promise.all(sources.map(async item => [path.relative(root, item), await sha(item)])));
  assert.deepEqual(after, before);
  const report = { status: "passed", scope: "JavaScript pure core fixtures and host ownership/access only; no p5 renderer claim.",
    source_sha256_before: before, source_sha256_after: after,
    fixtures: { ordered_cases: ordered.cases.length, seeded_cases: seeded.cases.length,
      seeded_cross_case_checks: seeded.cross_case_checks.length, seeded_seed_vectors_consumed: seeded.seed_vectors.length,
      seeded_mapping_vectors_consumed: seeded.mapping_vectors.length, ordered_native_only_cases: ordered.native_only_cases.length,
      seeded_native_only_cases: seeded.native_only_cases.length }, host_access_ownership: "passed" };
  await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, ordered_cases: ordered.cases.length, seeded_cases: seeded.cases.length }));
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
