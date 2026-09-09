import assert from "node:assert/strict";
import test from "node:test";
import { createExplorationDocument, sourceLayers } from "../lib/explorations.ts";

test("an exploration starts with an independent blank harness-v1 document", () => {
  const document = createExplorationDocument();
  assert.equal(document.bindingVersion, "harness-v1");
  assert.equal(document.width, 640);
  assert.equal(document.height, 640);
  assert.deepEqual(document.layers, []);
});

test("sourceLayers excludes workflow-only candidate output", () => {
  const document = createExplorationDocument();
  document.layers.push({ id: "workflow", kind: "workflow", visible: true, opacity: 1, content: { technique: "field-marks", seed: 1, palette: [0], cutEdits: [], transform: { x: 320, y: 320, scale: 1, rotation: 0 }, params: {} } });
  assert.deepEqual(sourceLayers(document), []);
});
