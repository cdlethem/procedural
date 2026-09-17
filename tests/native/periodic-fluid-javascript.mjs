import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { projectPeriodicVelocity2D as project } from '../../packages/javascript/src/project-periodic-velocity-2d.js';
import { advectPeriodicScalar2D as advect } from '../../packages/javascript/src/advect-periodic-scalar-2d.js';
import { diffusePeriodicScalar2D as diffuse } from '../../packages/javascript/src/diffuse-periodic-scalar-2d.js';
const entries = [['project-periodic-velocity-2d', project], ['advect-periodic-scalar-2d', advect], ['diffuse-periodic-scalar-2d', diffuse]];
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
let vectors = 0;
for (const [slug, fn] of entries) {
  const fixture = JSON.parse(readFileSync(`fixtures/operations/${slug}.json`));
  assert.equal(fixture.catalog_sha256, sha(`catalog/operations/${slug}.json`));
  for (const item of fixture.cases) {
    const before = JSON.stringify(item.input);
    if (item.error) assert.throws(() => fn(item.input), e => e.code === item.error, item.id);
    else assert.deepEqual(fn(item.input), item.output, item.id);
    assert.equal(JSON.stringify(item.input), before);
    vectors++;
  }
}
const norm = a => Math.sqrt(a.reduce((sum, x) => sum + x * x, 0));
const close = (a, b, epsilon = 1e-10) => assert.ok(Math.abs(a - b) <= epsilon, `${a} vs ${b}`);
// Analytic low-frequency and highest-frequency modes challenge sign and checkerboard convergence.
const columns = 16, rows = 12, size = columns * rows;
const u = Array.from({ length: size }, (_, i) => Math.sin(2 * Math.PI * (i % columns) / columns) + ((i % columns) % 2 ? -1 : 1));
const v = Array.from({ length: size }, (_, i) => Math.cos(2 * Math.PI * Math.floor(i / columns) / rows));
const convergence = [0, 8, 64, 512].map(iterations => {
  const out = project({ columns, rows, u, v, iterations, maxWork: size * (iterations + 3) });
  assert.ok(norm(out.u) ** 2 + norm(out.v) ** 2 <= norm(u) ** 2 + norm(v) ** 2 + 1e-10);
  return { iterations, residual: norm(out.divergenceAfter) };
});
for (let i = 1; i < convergence.length; i++) assert.ok(convergence[i].residual < convergence[i - 1].residual);
assert.ok(convergence.at(-1).residual < 1e-4 * convergence[0].residual);
// A discrete curl is divergence-free under the same MAC incidence, independent of pressure iteration.
const psi = Array.from({ length: size }, (_, i) => (i * 17 % 23) / 8);
const at = (x, y) => psi[((y + rows) % rows) * columns + (x + columns) % columns];
const cu = psi.map((_, i) => at(i % columns, Math.floor(i / columns)) - at(i % columns, Math.floor(i / columns) - 1));
const cv = psi.map((_, i) => -(at(i % columns, Math.floor(i / columns)) - at(i % columns - 1, Math.floor(i / columns))));
const curl = project({ columns, rows, u: cu, v: cv, iterations: 40, maxWork: size * 43 });
assert.deepEqual(curl.u, cu.map(x => x === 0 ? 0 : x));
assert.deepEqual(curl.v, cv.map(x => x === 0 ? 0 : x));
assert.equal(norm(curl.divergenceAfter), 0);
// Staggered variable crossflow has independently derived expected samples.
const shift = { columns: 3, rows: 1, values: [10, 20, 30], u: [0, 2, 0], v: [0, 0, 0], dt: 1, maxWork: 9 };
assert.deepEqual(advect({ ...shift, offset: [0, 0] }).values, [10, 10, 20]);
assert.deepEqual(advect({ ...shift, offset: [.5, 0] }).values, [10, 30, 30]);
assert.deepEqual(advect({ ...shift, u: [Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE], offset: [0, 0] }).values, [10, 20, 30]);
// Periodic diffusion conserves mass with retention1; endpoint checkerboards alternate, not converge.
const initial = Array.from({ length: size }, (_, i) => (i * 29 % 31) / 16);
let massField = initial;
for (let t = 0; t < 30; t++) massField = diffuse({ columns, rows, values: massField, rate: .125, retention: 1, maxWork: size }).values;
close(massField.reduce((a, b) => a + b), initial.reduce((a, b) => a + b), 1e-9);
assert.deepEqual(diffuse({ columns: 2, rows: 2, values: [1, -1, -1, 1], rate: .25, retention: 1, maxWork: 4 }).values, [-1, 1, 1, -1]);
// Passive carriers are rejected without executing accessors; frozen inputs stay reusable.
for (const [slug, fn] of entries) {
  const fixture = JSON.parse(readFileSync(`fixtures/operations/${slug}.json`));
  const input = structuredClone(fixture.cases[0].input);
  for (const value of Object.values(input)) if (Array.isArray(value)) Object.freeze(value);
  Object.freeze(input); const first = fn(input), second = fn(input); assert.deepEqual(first, second);
  for (const [key, value] of Object.entries(first)) if (Array.isArray(value)) {
    assert.notEqual(value, second[key]); assert.ok(!Object.values(input).includes(value));
  }
  let getterCalls = 0;
  const bad = { ...input };
  Object.defineProperty(bad, 'columns', { enumerable: true, get() { getterCalls++; return 2; } });
  assert.throws(() => fn(bad), e => e.code === 'INVALID_INPUT'); assert.equal(getterCalls, 0);
  assert.throws(() => fn({ ...input, extra: true }), e => e.code === 'INVALID_INPUT');
  const badArray = { ...input }; const key = slug.startsWith('project') ? 'u' : 'values';
  badArray[key] = [...input[key]]; delete badArray[key][0];
  assert.throws(() => fn(badArray), e => e.code === 'INVALID_INPUT');
}
const timings = [];
for (const n of [8, 48, 128]) {
  const count = n * n, input = { columns: n, rows: n, u: Array.from({ length: count }, (_, i) => Math.sin(i)), v: new Array(count).fill(0), iterations: 64, maxWork: count * 67 };
  const start = performance.now(); const out = project(input);
  timings.push({ dimensions: [n, n], iterations: 64, elapsedMs: performance.now() - start, residual: norm(out.divergenceAfter), jsonBytes: Buffer.byteLength(JSON.stringify(out)) });
}
const sources = entries.flatMap(([slug]) => [`packages/javascript/src/${slug}.js`, `catalog/operations/${slug}.json`, `fixtures/operations/${slug}.json`]);
sources.push('packages/javascript/src/internal/periodic-grid.js', 'packages/javascript/src/internal/systems-a-utils.js', 'tests/native/periodic-fluid-javascript.mjs');
const report = { status: 'passed', scope: 'Pure periodic field computations; no native or artist recreation acceptance.', analyticalVectors: vectors, scenarios: ['MAC projection signs and checkerboard convergence', 'discrete-curl invariance', 'periodic and staggered transport', 'mass/retention and stable endpoint', 'carrier/ownership/work/overflow'], convergence, timings, implementation_sha256: Object.fromEntries(sources.map(p => [p, sha(p)])) };
const output = resolve(process.argv[2] ?? '.work/expansion-full/fluid/core.json'); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, analyticalVectors: vectors, convergence, timings, output }));
