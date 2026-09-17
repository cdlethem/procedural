import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { drawEffects, effectsDefinitions } from "../lib/adapters/effects";
import type { Layer } from "../lib/studio-types";

type Id = "pull-marks" | "projection-marks";
type Call = [string, unknown[]];
const definition = (id: Id) => effectsDefinitions.find(item => item.id === id)!;
function layer(id: Id, changes: Record<string, number | string | boolean> = {}): Layer {
  return { id: `test-${id}`, technique: id, visible: true, opacity: 1, seed: 42,
    palette: [0x173f5f, 0xe9c46a, 0xe76f51], cutEdits: [],
    transform: { x: 320, y: 320, scale: 1, rotation: 0 },
    params: { ...definition(id).defaults, ...changes } };
}
function commands(input: Layer): Call[] {
  const calls: Call[] = [];
  const p = new Proxy({ ROUND: "round" } as Record<string, unknown>, { get(target, key: string) {
    return key in target ? target[key] : (...args: unknown[]) => {
      for (const value of args) if (typeof value === "number") assert.ok(Number.isFinite(value));
      calls.push([key, args]);
    };
  } });
  drawEffects(p, input);
  return calls;
}
const vertices = (calls: Call[]) => calls.filter(([name]) => name === "vertex").map(([, args]) => args);
const hash = (calls: Call[]) => createHash("sha256").update(JSON.stringify(calls)).digest("hex");

test("shared source choices change path geometry through the actual effect dispatcher", () => {
  for (const id of ["pull-marks", "projection-marks"] as const) {
    const baseline = { influenceCount: 1, centerX1: 0, centerY1: 0, radius1: 10,
      ...(id === "projection-marks" ? { strength: 0 } : {}) };
    const rows = vertices(commands(layer(id, { ...baseline, sourceMode: "rows", pathCount: 9, jitter: 0 })));
    const columns = vertices(commands(layer(id, { ...baseline, sourceMode: "columns", pathCount: 9, jitter: 0 })));
    const spokes = vertices(commands(layer(id, { ...baseline, sourceMode: "spokes", pathCount: 9, jitter: 0 })));
    assert.equal(rows.length, 9 * 96);
    assert.equal(columns.length, rows.length);
    assert.equal(spokes.length, rows.length);
    assert.deepEqual(rows[0], [40, 48]);
    assert.deepEqual(columns[0], [48, 40]);
    assert.ok(Math.abs((spokes[0][0] as number) - 320) < 1e-12);
    assert.ok(Math.abs((spokes[0][1] as number) - 300) < 1e-12);
    assert.notDeepEqual(rows, columns);
    assert.notDeepEqual(columns, spokes);
  }
});

test("influences alter geometry independently of stroke style and leave alpha-clear canvas space", () => {
  for (const id of ["pull-marks", "projection-marks"] as const) {
    const one = commands(layer(id, { sourceMode: "rows", influenceCount: 1 }));
    const two = commands(layer(id, { sourceMode: "rows", influenceCount: 2 }));
    assert.notDeepEqual(vertices(one), vertices(two), `${id}: second influence changes positions`);
    const ink = commands(layer(id, { sourceMode: "rows", influenceCount: 2, weight: 4 }));
    assert.deepEqual(vertices(two), vertices(ink), `${id}: weight does not regenerate paths`);
    assert.ok(ink.some(([name]) => name === "strokeWeight"));
    assert.ok(!ink.some(([name]) => ["background", "rect", "image", "clear"].includes(name)), `${id}: no opaque paper commands`);
  }
});

test("combined work and geometry limits reject invalid controls without clamping", () => {
  for (const id of ["pull-marks", "projection-marks"] as const) {
    assert.throws(() => commands(layer(id, { pathCount: 81 })), /work settings/);
    assert.throws(() => commands(layer(id, { pathCount: 4.5 })), /work settings/);
    assert.throws(() => commands(layer(id, { influenceCount: 3 })), /work settings/);
    assert.throws(() => commands(layer(id, { radius2: 451 })), /influence 2 geometry/);
    assert.throws(() => commands(layer(id, { centerX1: -1 })), /influence 1 geometry/);
    assert.equal(vertices(commands(layer(id, { pathCount: 80, influenceCount: 2 }))).length, 80 * 96);
  }
  assert.throws(() => commands(layer("pull-marks", { power1: 0 })), /power/);
  assert.throws(() => commands(layer("projection-marks", { strength: 1.1 })), /strength/);
});

test("legacy parameter objects retain stable command streams", () => {
  const pull = commands(layer("pull-marks", { legacy: true, radius: 170, power: 1.5, lines: 26, jitter: 1, weight: 1 }));
  const projection = commands(layer("projection-marks", { legacy: true, radius: 105, strength: .6, lines: 18, weight: 1 }));
  assert.equal(vertices(pull).length, 26 * 97);
  assert.equal(vertices(projection).length, 18 * 91);
  assert.equal(hash(pull), "ef91c766720690c8ff00a4403c504e260cae96ebf1aab53366e280ba99a7e172");
  assert.equal(hash(projection), "aaaaf0e910be1a692fafcd69f3b10bcdc5c5aae8dabe4b2f8a15f78dbdd2b4c3");
});
