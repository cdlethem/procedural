#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { fdlibmPow } from "../../packages/javascript/src/internal/fdlibm-pow.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
assert.equal(args[0], "--output");
assert.ok(args.length === 2 || (args.length === 4 && args[2] === "--java-home"));
const output = resolve(args[1]);
assert.ok(output.startsWith(join(ROOT, ".work") + sep) && !existsSync(output));
const jdk = resolve(args[3] || join(ROOT, ".work/toolchains/jdk-17.0.20.1+1"));
const classes = output + ".classes";
assert.ok(!existsSync(classes));
mkdirSync(classes, { recursive: true });

const files = ["packages/javascript/src/internal/fdlibm-pow.js", "tests/native/fdlibm-pow-javascript.mjs", "tests/native/FdlibmPowOracle.java"]
  .map((path) => join(ROOT, path));
files.push(...["bin/java", "bin/javac", "release", "lib/modules"].map((path) => join(jdk, path)));
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const hashes = () => Object.fromEntries(files.map((path) => [relative(ROOT, path), digest(path)]));
const before = hashes();
const run = (exe, command, input) => {
  const result = spawnSync(exe, command, { input, encoding: "utf8", timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr); return result.stdout;
};
const view = new DataView(new ArrayBuffer(8));
const bits = (value) => { view.setFloat64(0, value); return view.getBigUint64(0).toString(16).padStart(16, "0"); };
const value = (word) => { view.setBigUint64(0, BigInt("0x" + word)); return view.getFloat64(0); };
const word = (x) => x.toString(16).padStart(16, "0");

// Special values, negative-base parity, near-one reductions, under/overflow, and
// the constants previously mistyped during the first port are all covered by Java.
const boundary = [
  ["0000000000000000", "0000000000000000"], ["8000000000000000", "3fe0000000000000"],
  ["8000000000000000", "bff0000000000000"], ["fff0000000000000", "3fe0000000000000"],
  ["bff0000000000000", "4008000000000000"], ["bff0000000000000", "4000000000000000"],
  ["bff0000000000000", "3ff8000000000000"], ["3ff0000000000001", "41e0000000000001"],
  ["3fefffffffffffff", "c1e0000000000001"], ["3ff0000000000001", "c1e0000000000001"],
  ["0000000000000001", "3ff0000000000000"], ["0000000000000001", "bff0000000000000"],
  ["7fefffffffffffff", "3ff0000000000000"], ["7fefffffffffffff", "4000000000000000"],
  ["3ff8000000000000", "3ff0000000000000"], ["3ff8000000000000", "3fe0000000000000"],
  ["7ff0000000000000", "bff0000000000000"], ["3ff0000000000000", "7ff0000000000000"],
  ["7ff8000000000001", "0000000000000000"], ["7ff8000000000001", "3ff0000000000000"],
];
const moderate = [0.01, 0.125, 0.5, 0.9, 0.99, 1.01, 1.5, 2, 4]
  .flatMap((x) => [0.01, 0.125, 0.5, 0.9, 1.01, 1.5, 2, 7, 16].map((y) => [bits(x), bits(y)]));
let state = 0x9e3779b97f4a7c15n;
function next() { state = BigInt.asUintN(64, state ^ (state << 13n)); state ^= state >> 7n; state = BigInt.asUintN(64, state ^ (state << 17n)); return state; }
function finite(exponent) { return word((next() & 0x800fffffffffffffn) | (BigInt(exponent) << 52n)); }
const pairs = boundary.concat(moderate);
for (let index = 0; index < 512; index += 1) pairs.push([finite(Number(next() % 2047n)), finite(Number(next() % 2047n))]);
for (let index = 0; index < 128; index += 1) pairs.push([word(0x3ff0000000000000n + (next() & 0xfffffn)), finite(Number(next() % 2047n))]);

run(join(jdk, "bin/javac"), ["--release", "8", "-d", classes, join(ROOT, "tests/native/FdlibmPowOracle.java")]);
const expected = run(join(jdk, "bin/java"), ["-cp", classes, "FdlibmPowOracle"], pairs.map((pair) => pair.join(" ")).join("\n") + "\n").trim().split(/\r?\n/);
assert.equal(expected.length, pairs.length);
for (let index = 0; index < pairs.length; index += 1) {
  assert.equal(bits(fdlibmPow(value(pairs[index][0]), value(pairs[index][1]))), expected[index], `pair ${index}: ${pairs[index]}`);
}
const after = hashes(); assert.deepEqual(after, before);
writeFileSync(output, JSON.stringify({
  status: "passed", scope: "Fresh JDK 17 StrictMath.pow binary64 oracle; direct netlib e_pow.c translation only.",
  input_sha256_before: before, input_sha256_after: after,
  scenarios: { boundary: boundary.length, moderate_l3_lg2_regression: moderate.length, seeded_full_range: 512, seeded_near_one: 128, total: pairs.length },
  java_release: readFileSync(join(jdk, "release"), "utf8"), oracle_input_sha256: createHash("sha256").update(JSON.stringify(pairs)).digest("hex"),
}, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: "passed", pairs: pairs.length, output }));
