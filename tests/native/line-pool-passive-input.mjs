#!/usr/bin/env node
import assert from "node:assert/strict";
import { seededLinePool2D } from "../../packages/javascript/src/line-pool.js";

const base = {
  seed: 12,
  segment: [0, 0, 1, 0],
  attempts: 0,
  firstCutAngleScale: 1,
  minCutLength: 1,
  maxSegments: 2,
};

function invalid(segment, message) {
  assert.throws(() => seededLinePool2D({ ...base, segment }),
    (error) => error?.code === "INVALID_INPUT", message);
}

const getter = [0, 0, 1, 0];
let getterCalls = 0;
Object.defineProperty(getter, "0", {
  get() { getterCalls += 1; throw new Error("must not execute"); },
  configurable: true,
});
invalid(getter, "indexed accessor is invalid");
assert.equal(getterCalls, 0, "indexed accessor was not invoked");

const hole = [0, 0, 1, 0];
delete hole[2];
invalid(hole, "indexed hole is invalid");

assert.deepEqual(seededLinePool2D(base).toValues(), {
  segments: [[0, 0, 1, 0]], divided: [false], attempts: 0, successfulCuts: 0, skips: 0,
}, "ordinary indexed data values remain accepted");

console.log(JSON.stringify({ status: "passed", scenarios: ["indexed getter not executed", "hole rejected", "ordinary array accepted"] }));
