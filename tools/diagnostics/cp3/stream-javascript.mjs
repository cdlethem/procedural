#!/usr/bin/env node
/** Private CP3 JavaScript feasibility check; not a public RNG or target port. */

import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import process from 'node:process';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '../../..');
const MASK32 = 0xffff_ffff;
const MASK64 = (1n << 64n) - 1n;
const GAMMA = 0x9e37_79b9_7f4a_7c15n;
const MIX_A = 0xbf58_476d_1ce4_e5b9n;
const MIX_B = 0x94d0_49bb_1331_11ebn;
const UNIT_DENOMINATOR = 4_294_967_296;
const EXPECTED_SEEDS = [0, 1, 42, 2_147_483_648, 4_294_967_295];

function fail(message) {
  throw new Error(message);
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sha256File(path) {
  return sha256Bytes(readFileSync(path));
}

function rootPath(pathText) {
  if (typeof pathText !== 'string' || pathText.length === 0) fail('bound path must be a nonempty string');
  const path = resolve(ROOT, pathText);
  if (relative(ROOT, path).startsWith('..')) fail(`bound path escapes repository: ${pathText}`);
  return path;
}

function equalArrays(actual, expected) {
  return Array.isArray(actual) && Array.isArray(expected)
    && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function rotl32(value, count) {
  value >>>= 0;
  return ((value << count) | (value >>> (32 - count))) >>> 0;
}

/** Published SplitMix64 transition. It is invoked only during stream construction. */
function splitMix64Next(state) {
  state = (state + GAMMA) & MASK64;
  let mixed = state;
  mixed = ((mixed ^ (mixed >> 30n)) * MIX_A) & MASK64;
  mixed = ((mixed ^ (mixed >> 27n)) * MIX_B) & MASK64;
  return [state, (mixed ^ (mixed >> 31n)) & MASK64];
}

function expandSeed(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > MASK32) fail(`seed is not uint32: ${seed}`);
  let state = BigInt(seed); // BigInt startup only; never used in nextU32().
  let first;
  let second;
  [state, first] = splitMix64Next(state);
  [state, second] = splitMix64Next(state);
  const words = [
    Number(first & 0xffff_ffffn),
    Number((first >> 32n) & 0xffff_ffffn),
    Number(second & 0xffff_ffffn),
    Number((second >> 32n) & 0xffff_ffffn),
  ];
  if (!words.some((word) => word !== 0)) fail('forbidden xoshiro all-zero state');
  return words;
}

class Xoshiro128StarStar11 {
  #s;

  constructor(seed) {
    this.#s = expandSeed(seed);
  }

  state() {
    return [...this.#s];
  }

  nextU32() {
    let [s0, s1, s2, s3] = this.#s;
    const result = Math.imul(rotl32(Math.imul(s1, 5), 7), 9) >>> 0;
    const transient = (s1 << 9) >>> 0;
    s2 = (s2 ^ s0) >>> 0;
    s3 = (s3 ^ s1) >>> 0;
    s1 = (s1 ^ s2) >>> 0;
    s0 = (s0 ^ s3) >>> 0;
    s2 = (s2 ^ transient) >>> 0;
    s3 = rotl32(s3, 11);
    this.#s = [s0, s1, s2, s3];
    return result;
  }

  nextUnit() {
    return this.nextU32() / UNIT_DENOMINATOR;
  }
}

function verifyBoundFile(binding, label) {
  if (!binding || typeof binding !== 'object') fail(`${label} binding missing`);
  const path = rootPath(binding.path);
  const actual = sha256File(path);
  if (actual !== binding.sha256) fail(`${label} SHA-256 differs: ${binding.path}`);
  return { path: binding.path, sha256: actual };
}

function readOracle(oraclePath) {
  const oracle = JSON.parse(readFileSync(oraclePath, 'utf8'));
  if (oracle.schema !== 'cp3-stream-oracle/v1' || oracle.status !== 'completed-private-numeric-oracle') {
    fail('unexpected private oracle schema or status');
  }
  if (oracle.stream?.algorithm !== 'xoshiro128** 1.1') fail('oracle stream algorithm differs');
  const verifiedBindings = {};
  for (const key of ['script', 'rng_options', 'prototype_experiment']) {
    verifiedBindings[key] = verifyBoundFile(oracle.source_bindings?.[key], `oracle ${key}`);
  }
  return { oracle, verifiedBindings };
}

function verifySeedVectors(oracle) {
  const failures = [];
  const vectors = oracle.seed_vectors ?? [];
  if (!equalArrays(vectors.map((vector) => vector.seed), EXPECTED_SEEDS)) {
    failures.push('oracle seed vector identities or order');
  }
  for (const expected of vectors) {
    const stream = new Xoshiro128StarStar11(expected.seed);
    if (!equalArrays(stream.state(), expected.initial_state)) {
      failures.push(`seed ${expected.seed}: initial state`);
      continue;
    }
    for (const sample of expected.first_10 ?? []) {
      const output = stream.nextU32();
      if (output !== sample.output_u32) failures.push(`seed ${expected.seed}: output ${sample.index}`);
      if (!Object.is(output / UNIT_DENOMINATOR, sample.unit)) failures.push(`seed ${expected.seed}: unit ${sample.index}`);
      if (!equalArrays(stream.state(), sample.post_state)) failures.push(`seed ${expected.seed}: post-state ${sample.index}`);
    }
  }
  if (vectors.length !== EXPECTED_SEEDS.length) failures.push('oracle does not contain five seed vectors');
  return failures;
}

function candidate(stream, config) {
  const { origin, size } = config.centre_rectangle;
  const [originX, originY] = origin;
  const [width, height] = size;
  const ux = stream.nextUnit();
  const uy = stream.nextUnit();
  const u = stream.nextUnit();
  const v = stream.nextUnit();
  const x = (width * ux) + originX;
  const y = (height * uy) + originY;
  const span = config.radius_max - config.radius_min;
  const scaled = span * u;
  const tapered = scaled * v;
  const radius = tapered + config.radius_min;
  return [x, y, radius];
}

function hashesFor(config, attempts) {
  const stream = new Xoshiro128StarStar11(config.seed);
  const full = createHash('sha256');
  const centres = createHash('sha256');
  const triple = Buffer.allocUnsafe(24);
  const pair = Buffer.allocUnsafe(16);
  let first;
  let last;
  for (let index = 0; index < attempts; index += 1) {
    const point = candidate(stream, config);
    if (index === 0) first = point;
    last = point;
    triple.writeDoubleBE(point[0], 0);
    triple.writeDoubleBE(point[1], 8);
    triple.writeDoubleBE(point[2], 16);
    pair.writeDoubleBE(point[0], 0);
    pair.writeDoubleBE(point[1], 8);
    full.update(triple);
    centres.update(pair);
  }
  return {
    attempts,
    first_proposal: first,
    last_proposal: last,
    candidates_sha256_struct_be_f64_xyz: full.digest('hex'),
    centres_sha256_struct_be_f64_xy: centres.digest('hex'),
    final_state: stream.state(),
  };
}

function compareReference(actual, expected, label, includeFirstLast = true) {
  const fields = [
    'candidates_sha256_struct_be_f64_xyz',
    'centres_sha256_struct_be_f64_xy',
    'final_state',
  ];
  if (includeFirstLast) fields.push('first_proposal', 'last_proposal');
  const failures = [];
  for (const field of fields) {
    const equal = Array.isArray(expected[field])
      ? equalArrays(actual[field], expected[field])
      : actual[field] === expected[field];
    if (!equal) failures.push(`${label}: ${field}`);
  }
  return failures;
}

function workload(seed, proposalCount) {
  const stream = new Xoshiro128StarStar11(seed);
  const digest = createHash('sha256');
  const chunk = Buffer.allocUnsafe(16_384);
  const totalOutputs = proposalCount * 4;
  let position = 0;
  const started = performance.now();
  for (let index = 0; index < totalOutputs; index += 1) {
    chunk.writeUInt32BE(stream.nextU32(), position);
    position += 4;
    if (position === chunk.length) {
      digest.update(chunk);
      position = 0;
    }
  }
  if (position !== 0) digest.update(chunk.subarray(0, position));
  const elapsedMs = performance.now() - started;
  return {
    proposals: proposalCount,
    outputs: totalOutputs,
    elapsed_ms: elapsedMs,
    checksum_sha256_u32_be: digest.digest('hex'),
    final_state: stream.state(),
    scope: 'One bounded runtime observation of stream generation plus an order-sensitive SHA-256 checksum. It is not a distribution-quality claim or production benchmark.',
  };
}

function buildReport() {
  const oraclePath = ROOT + '/evidence/investigations/cp3-stream-oracle.json';
  const { oracle, verifiedBindings } = readOracle(oraclePath);
  const failures = verifySeedVectors(oracle);
  const baseExpected = oracle.prototype_candidates?.baseline_5000;
  const smallExpected = oracle.prototype_candidates?.rmax_32_5000;
  const prefixExpected = oracle.prototype_candidates?.baseline_prefix_10000;
  if (!baseExpected || !smallExpected || !prefixExpected) fail('oracle candidate references missing');

  const baseline = hashesFor(baseExpected.config, 5_000);
  const smaller = hashesFor(smallExpected.config, 5_000);
  failures.push(...compareReference(baseline, baseExpected, 'baseline 5000'));
  failures.push(...compareReference(smaller, smallExpected, 'rmax32 5000'));

  const extended = hashesFor(baseExpected.config, 10_000);
  const extendedExpected = {
    candidates_sha256_struct_be_f64_xyz: prefixExpected.extended_sha256_struct_be_f64_xyz,
    centres_sha256_struct_be_f64_xy: prefixExpected.extended_centres_sha256_struct_be_f64_xy,
    final_state: prefixExpected.final_state_after_extended,
  };
  if (typeof extendedExpected.centres_sha256_struct_be_f64_xy !== 'string') fail('oracle lacks 10000 centre digest');
  failures.push(...compareReference(extended, extendedExpected, 'baseline 10000', false));
  if (baseline.candidates_sha256_struct_be_f64_xyz !== prefixExpected.first_prefix_sha256_struct_be_f64_xyz) {
    failures.push('prefix 5000 full digest');
  }
  if (!equalArrays(baseline.final_state, prefixExpected.state_after_prefix)) failures.push('prefix 5000 state');

  const workloadResult = workload(42, 200_000);
  return {
    schema: 'cp3-stream-javascript/v1',
    status: failures.length === 0 ? 'passed-private-feasibility' : 'failed-private-feasibility',
    scope: 'Node JavaScript feasibility evidence for the private CP3 stream only. It is neither a public RNG admission nor a target-port, distribution-quality, renderer, or production-performance claim.',
    runtime: { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch },
    implementation: {
      algorithm: 'xoshiro128** 1.1',
      startup: 'two SplitMix64 outputs via BigInt, packed [low32(q0), high32(q0), low32(q1), high32(q1)]',
      inner_loop: 'uint32 operations with Math.imul and logical shifts; no BigInt in nextU32 or unit generation',
      unit: 'nextU32 / 2^32 as binary64',
    },
    source_bindings: {
      script: { path: relative(ROOT, resolve(new URL(import.meta.url).pathname)), sha256: sha256File(resolve(new URL(import.meta.url).pathname)) },
      oracle: { path: relative(ROOT, oraclePath), sha256: sha256File(oraclePath) },
      oracle_inputs_verified: verifiedBindings,
    },
    verification: {
      seed_vectors: { expected_seeds: 5, samples_per_seed: 10, passed: !failures.some((entry) => entry.startsWith('seed ')) },
      baseline_5000: baseline,
      rmax_32_5000: smaller,
      baseline_10000: extended,
      failures,
    },
    workload_200000: workloadResult,
  };
}

function outputPathFromArgs() {
  const argument = process.argv.indexOf('--output');
  if (argument === -1) return resolve(ROOT, 'evidence/investigations/cp3-stream-javascript.json');
  if (argument + 1 >= process.argv.length) fail('--output requires a path');
  const path = resolve(process.argv[argument + 1]);
  if (relative(ROOT, path).startsWith('..')) fail('output must remain inside the repository');
  return path;
}

const outputPath = outputPathFromArgs();
let report;
try {
  report = buildReport();
} catch (error) {
  report = {
    schema: 'cp3-stream-javascript/v1',
    status: 'failed-private-feasibility',
    error: error instanceof Error ? error.message : String(error),
  };
}
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output: relative(ROOT, outputPath), status: report.status }));
if (report.status !== 'passed-private-feasibility') process.exitCode = 1;
