import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { drawExpansion, expansionDefinitions } from "../lib/adapters/expansion";
import type { Layer } from "../lib/studio-types";

/** Command-only checks complement the separately leased real p5 browser review. */
function commands(layer: Layer) {
  const styled = createHash("sha256"), geometry = createHash("sha256");
  let marks = 0;
  const geometryCalls = new Set(["vertex", "triangle", "line", "circle"]);
  const p: Record<string, any> = { CLOSE: "close", ROUND: "round" };
  for (const name of ["beginShape", "endShape", "vertex", "triangle", "line", "circle", "fill", "stroke", "strokeWeight", "strokeCap", "noFill", "noStroke"]) {
    p[name] = (...args: unknown[]) => {
      for (const arg of args) if (typeof arg === "number") assert.ok(Number.isFinite(arg), `${name} has a nonfinite argument`);
      const encoded = JSON.stringify([name, ...args]);
      styled.update(encoded);
      if (geometryCalls.has(name)) { geometry.update(encoded); marks++; }
    };
  }
  drawExpansion(p, layer);
  return { styled: styled.digest("hex"), geometry: geometry.digest("hex"), marks };
}

for (const definition of expansionDefinitions) {
  test(`${definition.id}: defaults and simultaneous maximum controls stay within operation budgets and replay`, () => {
    const layer: Layer = {
      id: "study", technique: definition.id, visible: true, opacity: 1, seed: 42,
      palette: [0x102030, 0xb45e34, 0x308080, 0xd8b868, 0x823d68],
      cutEdits: [], transform: { x: 320, y: 320, scale: 1, rotation: 0 },
      params: { ...definition.defaults },
    };
    const before = structuredClone(layer);
    const baseline = commands(layer);
    assert.ok(baseline.marks > 0);
    assert.deepEqual(commands(layer), baseline);
    assert.deepEqual(layer, before, "drawing must not mutate its layer");
    const restyled = commands({ ...layer, palette: [0x123456, 0xabcdef, 0x654321] });
    assert.equal(restyled.geometry, baseline.geometry, "palette edit retains geometry");
    assert.notEqual(restyled.styled, baseline.styled, "palette edit affects drawing colors");
    const maximum = structuredClone(layer);
    for (const parameter of definition.parameters) {
      if (parameter.type === "number") maximum.params[parameter.key] = parameter.max!;
      if (parameter.type === "boolean") maximum.params[parameter.key] = true;
    }
    const stress = commands(maximum);
    assert.ok(stress.marks > 0);
    assert.deepEqual(commands(maximum), stress);
    assert.notEqual(stress.geometry, baseline.geometry, "structural controls change geometry");
  });
}
