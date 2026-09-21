import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { materialsADefinitions } from "../lib/adapters/materials-a";
import { drawEmbossedField, drawSignedEdgePrint } from "@procedurals/javascript/examples/materials-a-studies.js"
import { createDocument, validateDocument } from "../lib/studio";
import type { Layer } from "../lib/studio-types";

const palette = [0x173f5f, 0x20639b, 0x3caea3, 0xf6d55c, 0xed553b];
function layerFor(id: "embossed-field" | "signed-edge-print"): Layer {
  const item = materialsADefinitions.find((entry) => entry.id === id)!;
  return {
    id: `quality-${id}`, technique: id, visible: true, opacity: 1, seed: 42,
    palette: [...palette], cutEdits: [], transform: { x: 320, y: 320, scale: 1, rotation: 0 },
    params: { ...item.defaults },
  };
}
function record(layer: Layer) {
  const styled = createHash("sha256"), geometry = createHash("sha256");
  let marks = 0;
  const callbacks: Record<string, (...args: unknown[]) => void> = {};
  const p = new Proxy(callbacks, { get(_, key: string) { return (...args: unknown[]) => {
    for (const arg of args) if (typeof arg === "number") assert.ok(Number.isFinite(arg), `${key} receives finite numbers`);
    const command = JSON.stringify([key, ...args]);
    styled.update(command);
    if (key === "rect" || key === "circle") { geometry.update(command); marks++; }
    assert.notEqual(key, "background", "the reusable layer does not paint the document background");
  }; } });
  const before = structuredClone(layer);
  (layer.technique === "embossed-field" ? drawEmbossedField : drawSignedEdgePrint)(p, layer);
  assert.deepEqual(layer, before, "the source layer remains caller-owned");
  return { styled: styled.digest("hex"), geometry: geometry.digest("hex"), marks };
}

test("relief controls match stored defaults and offer real numeric domains", () => {
  for (const id of ["embossed-field", "signed-edge-print"] as const) {
    const item = materialsADefinitions.find((entry) => entry.id === id)!;
    assert.deepEqual(Object.keys(item.defaults).sort(), item.parameters.map((entry) => entry.key).sort());
    const pixelSize = item.parameters.find((entry) => entry.key === "scale")!;
    assert.deepEqual([pixelSize.min, pixelSize.max, pixelSize.hardMin, pixelSize.hardMax], [6, 48, 4, 120]);
    assert.equal(record(layerFor(id)).marks > 0, true);
  }
});

for (const id of ["embossed-field", "signed-edge-print"] as const) test(`${id}: controls change actual draw records and palette leaves geometry alone`, () => {
  const layer = layerFor(id), baseline = record(layer);
  assert.deepEqual(record(layer), baseline, "replay is deterministic");
  const recolored = record({ ...layer, palette: [0x123456, 0xabcdef, 0x654321, 0x994400] });
  assert.equal(recolored.geometry, baseline.geometry);
  assert.notEqual(recolored.styled, baseline.styled);
  for (const [key, value] of Object.entries({ source: "waves", axis: "vertical", scale: 18, treatment: "tiles", [id === "embossed-field" ? "gain" : "cutoff"]: id === "embossed-field" ? 2.4 : 0.4 })) {
    const changed = record({ ...layer, params: { ...layer.params, [key]: value } });
    assert.notEqual(changed.styled, baseline.styled, `${key} changes the rendered composition`);
  }
  assert.notEqual(record({ ...layer, params: { ...layer.params, source: "mounds" }, seed: 71 }).styled,
    record({ ...layer, params: { ...layer.params, source: "mounds" }, seed: 42 }).styled, "seed shifts the mounds source");
  assert.ok(record({ ...layer, params: { ...layer.params, scale: 4 } }).marks > 0);
  assert.ok(record({ ...layer, params: { ...layer.params, scale: 120 } }).marks > 0);
});

test("saved gain migration preserves signed edge mark membership", () => {
  const document = createDocument("signed-edge-print");
  document.layers[0].params = { scale: 10, gain: 2.4 };
  const restored = validateDocument(document).layers[0];
  assert.deepEqual(restored.params, { scale: 10, cutoff: .1, source: "waves", axis: "vertical", treatment: "tiles" });
  assert.deepEqual(record({ ...restored, params: { scale: 10, gain: 2.4 } }), record(restored));
});
