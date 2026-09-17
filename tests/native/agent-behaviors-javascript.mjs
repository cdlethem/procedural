#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { contactHistory2D } from "../../packages/javascript/src/contact-history-2d.js";
import { sensorMotorStep2D } from "../../packages/javascript/src/sensor-motor-step-2d.js";
import { flockSteer2D } from "../../packages/javascript/src/flock-steer-2d.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SELF = fileURLToPath(import.meta.url);
const operations = [
  ["contact-history-2d", "spatial.contact-history-2d", contactHistory2D],
  ["sensor-motor-step-2d", "motion.sensor-motor-step-2d", sensorMotorStep2D],
  ["flock-steer-2d", "motion.flock-steer-2d", flockSteer2D],
];
const file = (folder, name) => join(ROOT, folder, `${name}.json`);
const sha = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const name = path => relative(ROOT, path).split(sep).join("/");
function expectError(action, code) { assert.throws(action, error => error instanceof Error && error.code === code); }
function close(actual, expected, absolute = 1e-12) {
  if (typeof expected === "number") { assert.equal(typeof actual, "number"); assert.ok(Math.abs(actual - expected) <= absolute, `${actual} differs from ${expected}`); return; }
  if (Array.isArray(expected)) { assert.equal(actual.length, expected.length); expected.forEach((value, i) => close(actual[i], value, absolute)); return; }
  for (const key of Object.keys(expected)) close(actual[key], expected[key], absolute);
}
function hashInputs() {
  const paths = [...operations.flatMap(([stem]) => [file("catalog/operations", stem), file("fixtures/operations", stem), join(ROOT, "packages/javascript/src", `${stem}.js`)]), join(ROOT, "packages/javascript/src/internal/agent-behavior-utils.js"), SELF];
  return Object.fromEntries(paths.map(path => [name(path), sha(path)]));
}
function fixtureChecks() {
  let cases = 0;
  for (const [stem, operation, fn] of operations) {
    const fixture = JSON.parse(readFileSync(file("fixtures/operations", stem)));
    assert.equal(fixture.operation, operation); assert.equal(fixture.catalog_sha256, sha(file("catalog/operations", stem)));
    for (const item of fixture.cases) { cases += 1; if (item.error) expectError(() => fn(item.input), item.error); else assert.deepEqual(fn(item.input), item.output, `${stem}/${item.id}`); }
  }
  const trig = JSON.parse(readFileSync(join(ROOT, "tests/native/fixtures/agent-behavior-oracles.json")));
  for (const item of trig.cases) {
    if (item.error) expectError(() => sensorMotorStep2D(item.input), item.error);
    else close(sensorMotorStep2D(item.input), item.output, trig.absoluteTolerance);
  }
  return { exact_fixture_cases: cases, tolerated_trig_cases: trig.cases.length };
}
function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
function carrierChecks() {
  const contact = () => ({ ids: [2, 5], pairs: [[0, 1]], contacts: [], lingerSteps: 1, maxWork: 3 });
  const sensor = () => ({ agents: [{ position: [0, 0], headingTurns: 0, speed: 0 }], field: { values: [1], columns: 1, rows: 1, origin: [0, 0], spacing: [1, 1], boundary: "clamp" }, sensorDistance: 0, sensorAngleTurns: 0, turnGain: 0, dt: 1, maxWork: 3 });
  const flock = () => ({ points: [[0, 0], [1, 0]], velocities: [[0, 0], [0, 0]], pairs: [[0, 1]], cohesion: 1, alignment: 0, separation: 0, maxSteer: 2, maxWork: 3 });
  for (const [fn, build] of [[contactHistory2D, contact], [sensorMotorStep2D, sensor], [flockSteer2D, flock]]) {
    const frozen = deepFreeze(build()), prior = structuredClone(frozen); const out = fn(frozen); assert.deepEqual(frozen, prior, "frozen input unchanged");
    const baseline = structuredClone(out); JSON.stringify(out); assert.deepEqual(fn(build()), baseline, "fresh output contents");
    const accessor = build(); let reads = 0; const key = Object.keys(accessor)[0]; Object.defineProperty(accessor, key, { enumerable: true, get() { reads += 1; return null; } }); expectError(() => fn(accessor), "INVALID_INPUT"); assert.equal(reads, 0, "accessor unread");
    const symbol = build(); symbol[Symbol("extra")] = true; expectError(() => fn(symbol), "INVALID_INPUT");
  }
  const contactOutput = contactHistory2D(contact()); assert.notStrictEqual(contactOutput.contacts[0], contactOutput.contacts[0].ids); contactOutput.contacts[0].ids[0] = 99; assert.equal(contactHistory2D(contact()).contacts[0].ids[0], 2);
  const sensorOutput = sensorMotorStep2D(sensor()); assert.notStrictEqual(sensorOutput.agents, sensorOutput.probes); assert.notStrictEqual(sensorOutput.probes[0].left, sensorOutput.probes[0].right); sensorOutput.agents[0].position[0] = 9; assert.equal(sensorMotorStep2D(sensor()).agents[0].position[0], 0);
  const flockOutput = flockSteer2D(flock()); flockOutput.steering[0][0] = 9; assert.equal(flockSteer2D(flock()).steering[0][0], 1);
  expectError(() => contactHistory2D({ ...contact(), ids: new Uint32Array([2, 5]) }), "INVALID_INPUT");
  const sparse = sensor(); sparse.field.values = new Array(1); expectError(() => sensorMotorStep2D(sparse), "INVALID_INPUT");
  const extraArray = flock(); extraArray.points.extra = true; expectError(() => flockSteer2D(extraArray), "INVALID_INPUT");
  return ["frozen inputs", "accessor-free passive validation", "symbol/typed/sparse/extra carriers", "detached nested outputs"];
}
function stateAndSubstitutionChecks() {
  let contacts = [];
  contacts = contactHistory2D({ ids: [7, 9], pairs: [[0, 1]], contacts, lingerSteps: 2, maxWork: 3 }).contacts;
  contacts = contactHistory2D({ ids: [9, 7], pairs: [], contacts, lingerSteps: 2, maxWork: 3 }).contacts;
  assert.deepEqual(contacts, [{ ids: [7, 9], activeTicks: 1, missingTicks: 1 }], "history keys survive caller reorder");
  contacts = contactHistory2D({ ids: [9, 7], pairs: [[0, 1]], contacts, lingerSteps: 2, maxWork: 4 }).contacts;
  assert.deepEqual(contacts, [{ ids: [7, 9], activeTicks: 2, missingTicks: 0 }], "consecutive history revival");
  const sensorInput = { agents: [{ position: [0.5, .5], headingTurns: 0, speed: 0 }], field: { values: [0, 0, 0, 4], columns: 2, rows: 2, origin: [0, 0], spacing: [1, 1], boundary: "clamp" }, sensorDistance: .5, sensorAngleTurns: .25, turnGain: .125, dt: 1, maxWork: 3 };
  const first = sensorMotorStep2D(sensorInput); const changed = sensorMotorStep2D({ ...sensorInput, field: { ...sensorInput.field, values: [4, 0, 0, 0] } });
  assert.notEqual(first.agents[0].headingTurns, changed.agents[0].headingTurns, "explicit field substitution changes sampling");
  const graph = { points: [[0, 0], [2, 0], [4, 0]], velocities: [[0, 0], [0, 0], [0, 0]], pairs: [[0, 1], [1, 2]], cohesion: 1, alignment: 0, separation: 0, maxSteer: 99, maxWork: 5 };
  assert.deepEqual(flockSteer2D(graph).steering, [[2, 0], [0, 0], [-2, 0]], "fixed supplied graph is the only neighborhood source");
  return ["three consecutive contact states", "scalar field substitution", "fixed supplied graph"];
}
function timed(label, input, fn) { const times = []; let output; for (let i = 0; i < 3; i += 1) { const start = performance.now(); output = fn(input); times.push(Number((performance.now() - start).toFixed(3))); } return { label, elapsed_ms: times, checksum: createHash("sha256").update(JSON.stringify(output)).digest("hex"), retained_json_bytes: Buffer.byteLength(JSON.stringify(output)) }; }
function performanceChecks() {
  const agentCount = 240, agents = Array.from({ length: agentCount }, (_, i) => ({ position: [i % 20, Math.floor(i / 20)], headingTurns: i / agentCount, speed: .5 })); const field = { values: Array.from({ length: 64 * 64 }, (_, i) => (i * 17) % 31), columns: 64, rows: 64, origin: [0, 0], spacing: [1, 1], boundary: "wrap" };
  const pairs = Array.from({ length: agentCount - 1 }, (_, i) => [i, i + 1]);
  return [timed("contact-study", { ids: Array.from({ length: agentCount }, (_, i) => i), pairs, contacts: [], lingerSteps: 3, maxWork: agentCount * 3 }, contactHistory2D), timed("sensor-study", { agents, field, sensorDistance: 2, sensorAngleTurns: .1, turnGain: .03, dt: 1, maxWork: agentCount * 3 }, sensorMotorStep2D), timed("flock-study", { points: agents.map(a => a.position), velocities: agents.map(() => [0, 0]), pairs, cohesion: .02, alignment: .1, separation: .2, maxSteer: 1, maxWork: agentCount + pairs.length }, flockSteer2D)];
}
async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--output") throw new Error("Usage: agent-behaviors-javascript.mjs --output FRESH_JSON_PATH");
  const output = resolve(process.argv[3]); if (!output.startsWith(join(ROOT, ".work") + sep) || existsSync(output)) throw new Error("Output must be fresh and under .work");
  const before = hashInputs(), fixtures = fixtureChecks(), carriers = carrierChecks(), scenarios = stateAndSubstitutionChecks(), performance = performanceChecks(), after = hashInputs(); assert.deepEqual(after, before, "source stability");
  const report = { status: "passed", node_version: process.version, scope: "Three p5-only pure cores: frozen fixtures, tolerated fdlibm trig vectors, passive carriers, state/substitution and bounded-output observations. No rendering or support acceptance claim.", operations: operations.map(([, id]) => id), input_sha256_before: before, input_sha256_after: after, scenarios: { ...fixtures, carriers, state_and_substitution: scenarios, performance } };
  mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" }); console.log(JSON.stringify({ status: report.status, output }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
