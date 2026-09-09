import assert from "node:assert/strict";
import test from "node:test";
import {
  IDENTITY_LAYER_TRANSFORM,
  inverseTransformPoint,
  transformPoint,
} from "../lib/layer-transform.ts";

test("identity layer transform preserves every local point exactly", () => {
  for (const point of [
    [0, 0],
    [320, 320],
    [640, 640],
    [23.125, 511.75],
  ] as const) {
    assert.deepEqual(transformPoint(point, IDENTITY_LAYER_TRANSFORM), point);
    assert.deepEqual(
      inverseTransformPoint(point, IDENTITY_LAYER_TRANSFORM),
      point,
    );
  }
});

test("layer transform maps through canvas position, rotation, and uniform scale", () => {
  const transform = { x: 100, y: 200, scale: 2, rotation: 90 };
  assert.deepEqual(transformPoint([320, 320], transform), [100, 200]);
  const mapped = transformPoint([330, 320], transform);
  assert.ok(Math.abs(mapped[0] - 100) < 1e-12);
  assert.ok(Math.abs(mapped[1] - 220) < 1e-12);
  const restored = inverseTransformPoint(mapped, transform);
  assert.ok(Math.abs(restored[0] - 330) < 1e-12);
  assert.ok(Math.abs(restored[1] - 320) < 1e-12);
});
