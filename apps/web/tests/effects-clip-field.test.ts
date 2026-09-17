import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { drawEffects, effectsDefinitions } from "../lib/adapters/effects";
import type { Layer } from "../lib/studio-types";

type Call = [string, unknown[]];
const definition = effectsDefinitions.find(item => item.id === "path-clip-marks")!;
function layer(changes: Record<string, number | string | boolean> = {}): Layer {
  return { id: "clip-test", technique: "path-clip-marks" as Layer["technique"], visible: true, opacity: 1,
    seed: 42, palette: [0x173f5f, 0xe9c46a, 0xe76f51], cutEdits: [],
    transform: { x: 320, y: 320, scale: 1, rotation: 0 }, params: { ...definition.defaults, ...changes } };
}
function commands(input: Layer): Call[] {
  const calls: Call[] = [];
  const p = new Proxy({ CLOSE: "close" } as Record<string, unknown>, { get(target, name: string) {
    return name in target ? target[name] : (...args: unknown[]) => {
      for (const value of args) if (typeof value === "number") assert.ok(Number.isFinite(value));
      calls.push([name, args]);
    };
  } });
  drawEffects(p, input);
  return calls;
}
const by = (calls: Call[], method: string) => calls.filter(([name]) => name === method);
const digest = (calls: Call[]) => createHash("sha256").update(JSON.stringify(calls)).digest("hex");

test("boundary modes pass distinct simple polygons through the real effect dispatcher", () => {
  const common = { sourceMode: "rows", pathCount: 10, steps: 40, showOutline: true };
  const rectangle = commands(layer({ ...common, regionMode: "rectangle" }));
  const portal = commands(layer({ ...common, regionMode: "portal" }));
  const bay = commands(layer({ ...common, regionMode: "bay" }));
  const regular = commands(layer({ ...common, regionMode: "regular", sides: 6 }));
  assert.equal(by(rectangle, "vertex").length, 4);
  assert.equal(by(portal, "vertex").length, 8);
  assert.equal(by(bay, "vertex").length, 8);
  assert.equal(by(regular, "vertex").length, 6);
  assert.notDeepEqual(by(portal, "vertex"), by(bay, "vertex"));
  assert.notDeepEqual(by(rectangle, "line"), by(portal, "line"));
  assert.notDeepEqual(by(portal, "line"), by(bay, "line"));
  assert.equal(by(commands(layer({ ...common, notchWidth: 0 })), "vertex").length, 4);
  assert.equal(by(commands(layer({ ...common, regionMode: "bay", notchDepth: 0 })), "vertex").length, 4);
  assert.equal(by(commands(layer({ ...common, notchWidth: 480 })), "vertex").length, 4);
});

test("source modes independently change retained paths; styling and outline do not regenerate clipping", () => {
  const shared = { regionMode: "rectangle", regionWidth: 600, regionHeight: 600,
    showOutline: false, pathCount: 8, steps: 30 };
  const rows = commands(layer({ ...shared, sourceMode: "rows" }));
  const wander = commands(layer({ ...shared, sourceMode: "wander", wander: 30 }));
  const fan = commands(layer({ ...shared, sourceMode: "fan" }));
  assert.ok(by(rows, "line").length > 0);
  assert.notDeepEqual(by(rows, "line"), by(wander, "line"));
  assert.notDeepEqual(by(rows, "line"), by(fan, "line"));
  assert.deepEqual(by(rows, "line"), by(commands(layer({ ...shared, sourceMode: "wander", wander: 0 })), "line"));
  assert.deepEqual(by(rows, "line"), by(commands(layer({ ...shared, sourceMode: "rows", weight: 4 })), "line"));
  assert.deepEqual(by(rows, "line"), by(commands(layer({ ...shared, sourceMode: "rows", showOutline: true })), "line"));
  assert.ok(!rows.some(([name]) => ["background", "rect", "image", "clear"].includes(name)), "no opaque-paper command");
});

test("topology and combined work reject invalid construction before core execution", () => {
  assert.throws(() => commands(layer({ notchWidth: 481 })), /Notch opening exceeds/);
  assert.throws(() => commands(layer({ notchDepth: 480 })), /Full-depth notch/);
  assert.throws(() => commands(layer({ regionMode: "bay", notchDepth: 480 })), /Full-depth notch/);
  assert.throws(() => commands(layer({ regionMode: "regular", sides: 12, pathCount: 80, steps: 160 })), /combined work/);
  assert.throws(() => commands(layer({ steps: 161 })), /Invalid clip construction/);
  assert.throws(() => commands(layer({ pathCount: 0 })), /Invalid clip construction/);
  assert.throws(() => commands(layer({ regionMode: "unknown" })), /Unknown clip/);
  const outside = commands(layer({ centerX: -320, centerY: -320, showOutline: false }));
  assert.equal(by(outside, "line").length, 0, "fully off-canvas source crop paints no paths");
});

test("earlier saved values keep a stable legacy command stream", () => {
  const old = commands(layer({ legacy: true, paths: 8, steps: 70, wander: 9, notch: 300, weight: 1 }));
  assert.ok(by(old, "line").length > 0);
  assert.equal(digest(old), "8ed6b8dd108f0c633f74f06eaaa0518cee451b687c54afb91c4b65f195ac8039");
});
