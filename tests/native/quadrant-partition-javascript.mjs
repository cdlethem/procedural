#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { seededQuadrantPartition2D } from "../../packages/javascript/src/quadrant-partition.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = join(ROOT, "catalog/operations/seeded-quadrant-partition.json");
const FIXTURE = join(ROOT, "fixtures/operations/seeded-quadrant-partition.json");
const SOURCE = join(ROOT, "packages/javascript/src/quadrant-partition.js");
const SELF = fileURLToPath(import.meta.url);
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([CATALOG, FIXTURE, SOURCE, SELF].map((file) => [name(file), sha(file)]));
const errorCode = (action, code) => assert.throws(action, (error) => error.code === code);

function checkCase(item, generate = seededQuadrantPartition2D) {
  if (!item.error) {
    const result = generate(item.input);
    assert.deepEqual(result.toValues(), item.output, item.id);
    return result;
  }
  assert.throws(() => generate(item.input), (error) => {
    assert.equal(error.code, item.error, item.id);
    if (item.error_detail) {
      assert.equal(error.replacementIndex, item.error_detail.replacementIndex);
      assert.equal(error.stage, item.error_detail.stage);
    }
    return true;
  });
}

function ownershipChecks() {
  const config = { seed: 42, replacements: 2, origin: [0, 0], extent: [16, 16], selectionFraction: 1 };
  const result = seededQuadrantPartition2D(config), baseline = result.toValues();
  config.origin[0] = 99; config.origin[1] = 99;
  config.extent[0] = 1; config.extent[1] = 1;
  config.seed = 0; config.replacements = 0; config.selectionFraction = 0.5;
  assert.deepEqual(result.toValues(), baseline);
  result.boundsAt(0).fill(77);
  const detached = result.toValues();
  detached.bounds[0].fill(77); detached.ids.fill(77); detached.bounds.length = 0;
  detached.replacements = 99;
  assert.deepEqual(result.toValues(), baseline);
  assert.equal(result.size, baseline.ids.length);
  assert.equal(result.replacements, baseline.replacements);
  for (const out of [Array(6).fill(9), new Float64Array(6).fill(9), Array(6)]) {
    assert.equal(result.boundsInto(0, out, 1), out);
    assert.deepEqual(Array.from(out).slice(1, 5), baseline.bounds[0]);
  }
  const mixed = [9, 9, 9, 9];
  Object.defineProperty(mixed, "2", { writable: false });
  const badOutputs = [mixed, Object.freeze([1, 2, 3, 4]), [1, 2, 3],
    new Float32Array(5), {}, null];
  for (const out of badOutputs) {
    const before = out === null ? null : Object.getOwnPropertyDescriptors(out);
    errorCode(() => result.boundsInto(0, out), "INVALID_OUTPUT");
    assert.deepEqual(out === null ? null : Object.getOwnPropertyDescriptors(out), before);
  }
  for (const index of [-1, true, NaN, Infinity, 0.5, 9007199254740992, 1n, "0"]) {
    for (const access of [() => result.idAt(index), () => result.boundsAt(index),
      () => result.boundsInto(index, mixed, -1)]) errorCode(access, "INVALID_INDEX");
  }
  for (const index of [result.size, Number.MAX_SAFE_INTEGER]) {
    for (const access of [() => result.idAt(index), () => result.boundsAt(index),
      () => result.boundsInto(index, mixed, -1)]) errorCode(access, "INDEX_OUT_OF_RANGE");
  }
  for (const offset of [-1, true, NaN, Infinity, 0.5, 1n, "0", 2]) {
    const out = [9, 9, 9, 9, 9];
    errorCode(() => result.boundsInto(0, out, offset), "INVALID_OUTPUT");
    assert.deepEqual(out, [9, 9, 9, 9, 9]);
  }
  assert.deepEqual(result.toValues(), baseline);
  return ["all input containers detached", "bounds/export detached", "ordinary/sparse/Float64 outputs",
    "mixed/frozen/short/wrong outputs atomic", "all accessor index/range precedence", "invalid offsets atomic"];
}

function nativeChecks() {
  const base = { seed: 42, replacements: 2, origin: [0, 0], extent: [16, 16], selectionFraction: 1 };
  for (const value of [NaN, Infinity, -Infinity]) {
    for (const key of ["seed", "replacements", "selectionFraction"]) {
      errorCode(() => seededQuadrantPartition2D({ ...base, [key]: value }), "INVALID_INPUT");
    }
    for (const key of ["origin", "extent"]) for (const axis of [0, 1]) {
      const pair = [...base[key]]; pair[axis] = value;
      errorCode(() => seededQuadrantPartition2D({ ...base, [key]: pair }), "INVALID_INPUT");
    }
  }
  class Config {}
  class Pair extends Array {}
  for (const input of [Object.assign(new Config(), base),
    { ...base, origin: new Float64Array([0, 0]) }, { ...base, extent: new Pair(16, 16) },
    { ...base, seed: 42n }, { ...base, seed: new Number(42) }]) {
    errorCode(() => seededQuadrantPartition2D(input), "INVALID_INPUT");
  }
  assert.deepEqual(seededQuadrantPartition2D(Object.assign(Object.create(null), base)).toValues(),
    seededQuadrantPartition2D(base).toValues());
  return ["nonfinite-and-overflowing-numeric-carriers (JavaScript applicable carriers)", "passive-input-carriers-only"];
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output") throw new Error("Usage: --output FRESH_JSON_PATH");
  const output = resolve(args[1]);
  if (!output.startsWith(join(ROOT, ".work") + sep) || existsSync(output)) throw new Error("Output must be fresh and under .work");
  const fixture = JSON.parse(readFileSync(FIXTURE));
  assert.equal(fixture.catalog_sha256, sha(CATALOG), "fixture catalog binding");
  const before = hashes(), results = new Map();
  for (const item of fixture.cases) results.set(item.id, checkCase(item));

  // Append access only in a test module copy: no production public RNG API.
  const source = readFileSync(SOURCE, "utf8") + "\nexport { Stream };";
  const tested = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
  for (const vector of fixture.seed_vectors) {
    const stream = new tested.Stream(vector.seed), units = new tested.Stream(vector.seed);
    assert.deepEqual(stream.state(), vector.initial_state);
    for (const expected of vector.first_10) {
      assert.equal(stream.output(), expected.output_u32);
      assert.deepEqual(stream.state(), expected.post_state);
      assert.equal(units.unit(), expected.unit);
    }
  }
  const originalUnit = tested.Stream.prototype.unit, traces = new Map();
  try {
    for (const item of fixture.cases) {
      const trace = [];
      tested.Stream.prototype.unit = function () {
        const unit = originalUnit.call(this);
        trace.push({ unit, post_state: this.state() });
        return unit;
      };
      checkCase(item, tested.seededQuadrantPartition2D);
      traces.set(item.id, trace);
      const expectedCount = item.error_detail ? item.error_detail.replacementIndex + 1
        : item.error ? 0 : item.input.replacements + 0;
      assert.equal(trace.length, expectedCount, item.id + " attempted draw count");
      if (item.selection_trace) {
        assert.equal(trace.length, item.selection_trace.length);
        for (let i = 0; i < trace.length; i += 1) {
          assert.equal(trace[i].unit, item.selection_trace[i].unit);
          assert.deepEqual(trace[i].post_state, item.selection_trace[i].post_state);
        }
      }
    }
  } finally { tested.Stream.prototype.unit = originalUnit; }
  const executedCross = [];
  for (const check of fixture.cross_case_checks) {
    if (check.kind === "empty-selection-trace") assert.equal(traces.get(check.case).length, 0);
    else if (check.kind === "selection-trace-count-equals-attempted-replacements-including-failing-draw") {
      for (const id of check.cases) {
        const item = fixture.cases.find((item) => item.id === id);
        assert.equal(traces.get(id).length, item.selection_trace.length);
      }
    } else if (check.kind === "stable-ids-in-mutation-ordered-result") {
      const expected = fixture.cases.find((item) => item.id === check.case).output.ids;
      assert.deepEqual(results.get(check.case).toValues().ids, expected);
    } else if (check.kind === "explicit-non-prefix") {
      const short = results.get(check.short_case).toValues(), long = results.get(check.long_case).toValues();
      assert.ok(long.ids.length > short.ids.length);
      assert.notDeepEqual({ ids: long.ids.slice(0, short.ids.length), bounds: long.bounds.slice(0, short.ids.length) },
        { ids: short.ids, bounds: short.bounds });
    } else throw new Error("Unhandled cross-case kind: " + check.kind);
    executedCross.push(check.id);
  }
  const ownership = ownershipChecks(), native = nativeChecks();
  const after = hashes(); assert.deepEqual(after, before, "source stability");
  const report = {
    status: "passed", operation: fixture.operation, node_version: process.version,
    scope: "Actual JS module golden/native carrier checks; private test-copy RNG instrumentation. No renderer/acceptance claim.",
    input_sha256_before: before, input_sha256_after: after,
    scenarios: { fixture_cases: fixture.cases.length, seed_vectors: fixture.seed_vectors.length,
      instrumented_draw_traces: fixture.cases.length, cross_case_checks: executedCross,
      ownership_access: ownership, native_only: native },
    allocation_failure: { executed: false, source_review: "Output exports allocate detached arrays and do not mutate retained private arrays; failed generation exposes no result. No controlled host allocation failure injected." },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: report.scenarios }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
