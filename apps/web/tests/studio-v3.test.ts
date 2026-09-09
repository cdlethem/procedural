import assert from "node:assert/strict";
import test from "node:test";
import { createDocument } from "../lib/studio";
import { renderHarness, computeRebaseDelta } from "../lib/harness-render";
import { createDocumentV3, STUDIO_BINDING, P5_RUNNER_PROFILE, validateStudioDocument, type StudioDocumentV3 } from "../lib/studio-document";

const hash = "0".repeat(64);
const graphics = () => ({ width: 640, height: 640, pixelDensity: () => 1, drawingContext: {}, background() {}, push() {}, pop() {}, tint() {}, noTint() {}, clear() {}, image() {}, remove() {} });
const p = { P2D: "p2d", WEBGL: "webgl", createGraphics: graphics, clear() {}, image() {} };

test("app documents migrate to harness-v1 workflow layers", () => {
  const migrated = validateStudioDocument(createDocument());
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.bindingVersion, STUDIO_BINDING);
  assert.ok(migrated.layers.every((layer) => layer.kind === "workflow"));
});

test("unknown layer kinds are rejected", () => {
  const document = createDocumentV3();
  const unknown = { ...document, layers: [{ ...document.layers[0], kind: "mystery" }] };
  assert.throws(() => validateStudioDocument(unknown), /kind must be workflow, source or recipe/);
});

test("null source preview is admitted by validation but rejected by render", () => {
  const document: StudioDocumentV3 = {
    ...createDocumentV3(),
    layers: [{
      id: "source-layer",
      kind: "source",
      visible: true,
      opacity: 1,
      content: {
        language: "p5js",
        sourceArtifactHash: hash,
        previewArtifactHash: null,
        runnerProfile: P5_RUNNER_PROFILE,
        entrypoint: "sketch.js",
        background: "transparent",
        randomSeed: 1,
        noiseSeed: 2,
        tick: 1,
        controls: {},
      },
    }],
  };
  assert.equal(validateStudioDocument(document).layers[0].kind, "source");
  assert.throws(() => renderHarness(p, document, {}), /Source layer source-layer has no preview artifact/);
});

test("rebase delta returns added, edited, and complete composition layers", () => {
  const base = createDocumentV3();
  const baseLayer = base.layers[0];
  assert.equal(baseLayer.kind, "workflow");
  if (baseLayer.kind !== "workflow") throw new Error("fixture must start with a workflow");
  const extra = { ...baseLayer, id: "added" };
  const added = { ...base, layers: [...base.layers, extra] };
  assert.deepEqual(computeRebaseDelta(base, added, "add-layer"), [extra]);
  const editedLayer = { ...baseLayer, content: { ...baseLayer.content, seed: baseLayer.content.seed + 1 } };
  const edited = { ...base, layers: [editedLayer] };
  assert.deepEqual(computeRebaseDelta(base, edited, "edit-layer", baseLayer.id), [editedLayer]);
  assert.deepEqual(computeRebaseDelta(base, added, "composition"), added.layers);
});
