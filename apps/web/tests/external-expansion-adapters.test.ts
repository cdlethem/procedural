import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  drawExternalExpansion,
  externalExpansionDefinitions,
  externalExpansionPalette,
} from "../lib/adapters/external-expansion";
import { createLayer } from "../lib/studio";
import type { Layer } from "../lib/studio-types";

/** Command replay verifies the adapter's bounded p5 composition without claiming pixels. */
function commands(layer: Layer) {
  const styled = createHash("sha256");
  const geometry = createHash("sha256");
  const geometryCalls = new Set([
    "line",
    "circle",
    "ellipse",
    "rect",
    "triangle",
    "quad",
    "vertex",
    "point",
  ]);
  let marks = 0;
  const record = (name: string, args: unknown[]) => {
    for (const value of args)
      if (typeof value === "number")
        assert.ok(Number.isFinite(value), `${name} has a finite argument`);
    const encoded = JSON.stringify([name, ...args]);
    styled.update(encoded);
    if (geometryCalls.has(name)) {
      geometry.update(encoded);
      marks += 1;
    }
  };
  const p = new Proxy(
    {
      CLOSE: "close",
      ROUND: "round",
      SQUARE: "square",
      CENTER: "center",
      BOLD: "bold",
      NORMAL: "normal",
      HALF_PI: Math.PI / 2,
      drawingContext: {
        save: () => record("context.save", []),
        restore: () => record("context.restore", []),
        beginPath: () => record("context.beginPath", []),
        rect: (...args: unknown[]) => record("context.rect", args),
        clip: () => record("context.clip", []),
      },
    } as Record<string, any>,
    {
      get(target, name: string) {
        if (name in target) return target[name];
        return (...args: unknown[]) => record(name, args);
      },
    },
  );
  drawExternalExpansion(p, layer);
  return {
    styled: styled.digest("hex"),
    geometry: geometry.digest("hex"),
    marks,
  };
}

for (const definition of externalExpansionDefinitions) {
  test(`${definition.id}: retains replay, supports all declared edits, and keeps default palettes detached`, () => {
    const layer = createLayer(definition.id);
    const before = structuredClone(layer);
    assert.deepEqual(
      Object.keys(layer.params).sort(),
      definition.parameters.map((parameter) => parameter.key).sort(),
    );
    const baseline = commands(layer);
    assert.ok(baseline.marks > 0);
    assert.deepEqual(commands(layer), baseline, "same input replays exactly");
    assert.deepEqual(layer, before, "drawing does not mutate layer state");

    const recolored = commands({
      ...layer,
      palette: [0x123456, 0xabcdef, 0x654321, 0xffcc00, 0x111111, 0xf2eee2],
    });
    assert.equal(recolored.geometry, baseline.geometry, "palette edits retain geometry");
    assert.notEqual(recolored.styled, baseline.styled, "palette edits recolor marks");

    for (const parameter of definition.parameters) {
      const params = { ...layer.params };
      if (parameter.type === "boolean") params[parameter.key] = !Boolean(params[parameter.key]);
      else if (parameter.type === "select") params[parameter.key] = parameter.options![1].value;
      else params[parameter.key] = parameter.max!;
      assert.notEqual(
        commands({ ...layer, params }).styled,
        baseline.styled,
        `${parameter.label} visibly changes the composition`,
      );
    }

    const first = externalExpansionPalette(definition.id)!;
    const second = externalExpansionPalette(definition.id)!;
    assert.deepEqual(first, layer.palette, "layer starts with its shipped default palette");
    first[0] ^= 0xffffff;
    assert.notDeepEqual(first, second, "palette copies are detached from palette data");
  });
}
