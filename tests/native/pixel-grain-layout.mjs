#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { pixelGrainLayout } from "./pixel-grain-reproduction/layout.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LAYOUT = join(ROOT, "tests/native/pixel-grain-reproduction/layout.mjs");
const ORACLE = join(ROOT, "tests/native/PixelGrainLayoutOracle.java");
const SELF = fileURLToPath(import.meta.url);
const JDK = join(ROOT, ".work/toolchains/jdk-17.0.20.1+1");
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const name = (file) => relative(ROOT, file).split(sep).join("/");
const hashes = () => Object.fromEntries([
  LAYOUT, ORACLE, SELF,
  ...["bin/java", "bin/javac", "release", "lib/modules"].map((path) => join(JDK, path)),
].map((file) => [name(file), sha(file)]));

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
  return result.stdout;
}

function oracleOutput(build) {
  run(join(JDK, "bin/javac"), ["--release", "8", "-d", build, ORACLE]);
  return JSON.parse(run(join(JDK, "bin/java"), ["-cp", build, "PixelGrainLayoutOracle"]));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output") throw new Error("Usage: --output FRESH_JSON_PATH");
  const output = resolve(args[1]);
  if (!output.startsWith(join(ROOT, ".work") + sep) || existsSync(output)) throw new Error("Output must be fresh and under .work");
  const before = hashes();
  const build = join(ROOT, ".work", "pixel-grain-layout-oracle");
  rmSync(build, { recursive: true, force: true });
  mkdirSync(build, { recursive: true });
  const oracle = oracleOutput(build);
  assert.deepStrictEqual(oracle.cases.map((item) => item.seed), [42, 0], "oracle seed order");
  const observed = [];
  for (const expected of oracle.cases) {
    const seed = expected.seed;
    const actual = pixelGrainLayout(seed);
    assert.equal(seed, expected.seed, "primitive seed is unchanged");
    assert.deepStrictEqual(actual, { points: expected.points, consumedDraws: expected.consumedDraws }, "ordered Java layout for seed " + seed);
    assert.equal(actual.consumedDraws, 2688, "fixed draw count for seed " + seed);
    observed.push({ seed, retainedPoints: actual.points.length, consumedDraws: actual.consumedDraws });
  }
  assert.throws(() => pixelGrainLayout(NaN), TypeError);
  assert.throws(() => pixelGrainLayout(1.5), TypeError);
  assert.throws(() => pixelGrainLayout(-1), TypeError);
  assert.throws(() => pixelGrainLayout(4294967296), TypeError);
  const after = hashes();
  assert.deepStrictEqual(after, before, "source stability");
  const report = {
    status: "passed",
    scope: "Private pixel-grain reproduction layout parity with real java.util.Random only; no renderer, library API or acceptance claim.",
    node_version: process.version,
    input_sha256_before: before,
    input_sha256_after: after,
    observed,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, observed }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
