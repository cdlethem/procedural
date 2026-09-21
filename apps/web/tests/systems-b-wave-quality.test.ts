import assert from "node:assert/strict";
import test from "node:test";
import { drawSystems } from "../lib/adapters/systems";
import { systemsBDefinitions } from "../lib/adapters/systems-b";
import { waveInitialState, waveQualityState } from "../lib/adapters/systems-b-wave-quality";
import { drawRippleInterference, drawPinnedWaves } from "@procedurals/javascript/examples/systems-b-studies.js"
import type { Layer } from "../lib/studio-types";

type WaveId = "ripple-interference" | "pinned-waves";
const ids: WaveId[] = ["ripple-interference", "pinned-waves"];
const definition = (id: WaveId) => systemsBDefinitions.find(item => item.id === id)!;
function layer(id: WaveId, edits: Record<string, number | string | boolean> = {}): Layer {
  return { id: "wave-test", technique: id, visible: true, opacity: 1, seed: 42,
    palette: [0x175d7a, 0xeb9c40, 0xce5552, 0x3e8867, 0x8c60a4], cutEdits: [],
    transform: { x: 320, y: 320, scale: 1, rotation: 0 },
    params: { ...definition(id).defaults, ...edits } };
}
function commands(input: Layer, direct?: (p: any, layer: Layer) => void) {
  const output: { name: string; values: unknown[] }[] = [];
  const p = new Proxy({} as Record<string, unknown>, {
    get(_target, name: string) { return (...values: unknown[]) => {
      for (const value of values) if (typeof value === "number") assert.ok(Number.isFinite(value));
      output.push({ name, values });
    }; },
  });
  (direct ?? drawSystems)(p, input);
  return output;
}
const snapshot = (input: Layer) => JSON.stringify(commands(input));

test("both wave studies expose sources and pins through the real systems dispatcher", () => {
  for (const id of ids) {
    const item = definition(id), base = layer(id);
    for (const key of ["impulseCount", "impulseX1", "impulseY1", "impulseSpread1",
      "impulseAmplitude1", "impulseX2", "impulseY2", "impulseSpread2", "impulseAmplitude2",
      "impulseX3", "impulseY3", "impulseSpread3", "impulseAmplitude3",
      "pinMode", "pinX", "pinY", "pinRadius", "showPins", "passes", "scale", "weight"])
      assert.ok(item.parameters.some(parameter => parameter.key === key), `${id}: ${key}`);
    assert.ok(item.parameters.some(parameter => parameter.key === "legacy" && parameter.hidden));
    item.validate?.(base.params);
    const marks = commands(base);
    assert.ok(marks.some(mark => mark.name === "vertex"), `${id}: contour vertices`);
    assert.ok(!marks.some(mark => ["background", "image", "rect"].includes(mark.name)), `${id}: no opaque paper`);
  }
});

test("initial impulses are independently placed and signed; disabled sites are intentional no-ops", () => {
  const base = layer("ripple-interference", { passes: 0 });
  const initial = waveInitialState(base.params).displacement;
  for (const edit of ([{ impulseX1: 0 }, { impulseY1: 1 }, { impulseSpread1: 7 },
    { impulseAmplitude1: -1 }, { impulseCount: 1 }, { impulseCount: 3, impulseAmplitude3: 2 }] as Record<string, number>[]))
    assert.notDeepEqual(waveInitialState({ ...base.params, ...edit }).displacement, initial, JSON.stringify(edit));
  const disabled = { ...base.params, impulseCount: 3, impulseAmplitude3: 0 };
  assert.deepEqual(waveInitialState(disabled).displacement, initial);
  assert.deepEqual(waveInitialState({ ...disabled, impulseX3: -1, impulseY3: 2 }).displacement, initial,
    "moving a zero-amplitude site does not change the field");
  const empty = { ...base.params, impulseAmplitude1: 0, impulseAmplitude2: 0, passes: 0 };
  assert.ok(waveInitialState(empty).displacement.every(value => value === 0));
  assert.notEqual(snapshot(base), snapshot(layer("ripple-interference", { passes: 0, impulseAmplitude1: -1 })),
    "source reaches the actual draw dispatcher");
});

test("pin geometry zeros constrained cells and changes evolution independently of source", () => {
  const base = layer("pinned-waves", { passes: 24 });
  const source = waveInitialState(base.params).displacement;
  for (const pinMode of ["none", "vertical", "horizontal", "disc"] as const) {
    const edited = { ...base.params, pinMode };
    const { displacement, pins } = waveQualityState(edited);
    assert.ok(displacement.every((value, index) => !pins[index] || value === 0), pinMode);
    assert.notDeepEqual(pins, waveQualityState(base.params).pins, `${pinMode} changes pin mask`);
    assert.notDeepEqual(displacement, waveQualityState(base.params).displacement, `${pinMode} reaches evolution`);
  }
  const vertical = { ...base.params, pinMode: "vertical", passes: 0 };
  assert.notDeepEqual(waveInitialState({ ...vertical, pinX: 0 }).pins,
    waveInitialState({ ...vertical, pinX: 1 }).pins, "pin slider endpoints move the line");
  assert.deepEqual(waveInitialState({ ...base.params, pinMode: "none" }).displacement,
    waveInitialState({ ...base.params, pinMode: "none", pinX: 0, pinY: 1 }).displacement,
    "pin coordinates do not alter the source when pins are disabled");
  assert.ok(source.some(value => value !== 0));
});

test("passes and unrestricted display scale stay consequential; work and domains fail before drawing", () => {
  for (const id of ids) {
    const base = layer(id);
    assert.notEqual(snapshot(layer(id, { passes: 0 })), snapshot(base));
    assert.notEqual(snapshot(layer(id, { scale: 24 })), snapshot(layer(id, { scale: 100 })),
      "scale has no fit-to-frame plateau");
    for (const edits of ([{ passes: 81 }, { passes: -1 }, { impulseCount: 4 },
      { impulseSpread1: .1 }, { impulseAmplitude1: 4 }, { pinRadius: 13 }, { scale: 0 }, { weight: 13 }] as Record<string, number>[]))
      assert.throws(() => commands(layer(id, edits)), `${id}: ${JSON.stringify(edits)}`);
    assert.doesNotThrow(() => commands(layer(id, { passes: 80, scale: 100, impulseX1: -1, impulseY1: 2 })));
  }
});

test("exact legacy branch keeps earlier draw commands for both wave studies", () => {
  for (const [id, draw] of [["ripple-interference", drawRippleInterference],
    ["pinned-waves", drawPinnedWaves]] as const) {
    const earlier = layer(id, { ...definition(id).defaults, ...{
      "ripple-interference": { passes: 18, scale: 22, weight: 1.2 },
      "pinned-waves": { passes: 22, scale: 20, weight: 1.5 },
    }[id], legacy: true });
    assert.deepEqual(commands(earlier), commands(earlier, draw));
  }
});
