import assert from "node:assert/strict";
import test from "node:test";
import { drawEffects, effectsDefinitions } from "../lib/adapters/effects";

const ids = [
  "pull-marks",
  "projection-marks",
  "path-clip-marks",
  "ramp-marks",
  "warp-marks",
  "blur-marks",
  "profile-marks",
  "annular-marks",
  "depth-marks",
  "spring-marks",
];

test("effect studio definitions expose bounded editable compositions", () => {
  assert.deepEqual(
    effectsDefinitions.map((definition) => definition.id),
    ids,
  );
  for (const definition of effectsDefinitions) {
    assert.ok(
      definition.parameters.length > 2,
      `${definition.id} needs more than two controls`,
    );
    assert.ok(
      definition.parameters.filter((parameter) => parameter.type === "number")
        .length >= 2,
      `${definition.id} needs two numeric controls`,
    );
    for (const parameter of definition.parameters) {
      if (parameter.type !== "number") continue;
      assert.ok(Number.isFinite(parameter.min));
      assert.ok(Number.isFinite(parameter.max));
      assert.ok(parameter.min! <= parameter.max!);
      assert.equal(typeof definition.defaults[parameter.key], "number");
      const value = definition.defaults[parameter.key] as number;
      assert.ok(
        value >= parameter.min! && value <= parameter.max!,
        `${definition.id}:${parameter.key} default is bounded`,
      );
      const step = parameter.step ?? 1;
      assert.ok(
        Math.abs(
          (value - parameter.min!) / step -
            Math.round((value - parameter.min!) / step),
        ) < 1e-9,
        `${definition.id}:${parameter.key} default is on its step grid`,
      );
    }
  }
  for (const id of ["profile-marks", "annular-marks", "depth-marks"]) {
    assert.equal(
      effectsDefinitions.find((definition) => definition.id === id)?.renderer,
      "webgl",
    );
  }
});

test("every effect constructs its package-backed composition on a transparent target", () => {
  let calls = 0;
  const p: any = new Proxy(
    {
      ROUND: "round",
      TRIANGLES: "triangles",
      pixels: new Uint8ClampedArray(640 * 640 * 4),
      loadPixels() {
        calls += 1;
      },
      updatePixels() {
        calls += 1;
      },
    },
    {
      get(target, key) {
        return key in target
          ? target[key as keyof typeof target]
          : (..._args: unknown[]) => {
              calls += 1;
            };
      },
    },
  );
  for (const definition of effectsDefinitions) {
    drawEffects(p, {
      id: `test-${definition.id}`,
      technique: definition.id,
      visible: true,
      opacity: 1,
      seed: 42,
      palette: [0x173f5f, 0xe9c46a, 0xe76f51],
      cutEdits: [],
      transform: { x: 320, y: 320, scale: 1, rotation: 0 },
      params: { ...definition.defaults },
    });
  }
  assert.ok(calls > 100, "adapters emitted drawing calls");
});
