import assert from "node:assert/strict";
import test from "node:test";
import legacyV3 from "../lib/legacy-v3.json";
import legacyV3Dynamics from "../lib/legacy-v3-dynamics.json";
import { createDocument, validateDocument } from "../lib/studio";
import { renderHarness, computeRebaseDelta } from "../lib/harness-render";
import { createDocumentV3, STUDIO_BINDING, P5_RUNNER_PROFILE, validateStudioDocument, type StudioDocumentV3 } from "../lib/studio-document";

const hash = "0".repeat(64);
const graphics = () => ({ width: 640, height: 640, pixelDensity: () => 1, drawingContext: {}, background() {}, push() {}, pop() {}, tint() {}, noTint() {}, clear() {}, image() {}, remove() {} });
const p = { P2D: "p2d", WEBGL: "webgl", createGraphics: graphics, clear() {}, image() {} };

test("saved mixed Studio documents migrate the exact previous catalog without changing layer content", () => {
  const current = createDocumentV3();
  current.layers.push({
    id: "saved-source", kind: "source", visible: true, opacity: 0.6,
    content: {
      language: "p5js", sourceArtifactHash: hash, previewArtifactHash: "1".repeat(64),
      runnerProfile: P5_RUNNER_PROFILE, entrypoint: "sketch.js", background: "transparent",
      randomSeed: 91, noiseSeed: 5, tick: 3, controls: { density: 18 },
    },
  });
  const saved = { ...current, catalogSha256: legacyV3.catalogSha256 };
  const imported = validateStudioDocument(saved);
  assert.deepEqual(imported, current);
  assert.notEqual(imported.layers[1].content, saved.layers[1].content);
  assert.throws(() => validateStudioDocument({ ...saved, catalogSha256: "unknown" }), /stale or unsupported/);
  const forged = validateStudioDocument(createDocument("orbit-beads"));
  forged.catalogSha256 = legacyV3.catalogSha256;
  assert.throws(() => validateStudioDocument(forged), /not available in the previous studio-v3 binding/);
});

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

test("pre-expansion dynamics documents admit and migrate every revised study shape", () => {
  const saved = createDocumentV3("neighborhood-growth");
  saved.catalogSha256 = legacyV3Dynamics.catalogSha256;
  const savedLayer = saved.layers[0];
  if (savedLayer.kind !== "workflow") throw new Error("fixture must start with a workflow");
  savedLayer.content.params = { ticks: 24, chain: false, minLength: 38, step: 0.5 };
  const imported = validateStudioDocument(saved);
  const importedLayer = imported.layers[0];
  const fresh = createDocumentV3("neighborhood-growth");
  const freshLayer = fresh.layers[0];
  if (importedLayer.kind !== "workflow" || freshLayer.kind !== "workflow") throw new Error("migrated layer must stay a workflow");
  assert.deepEqual(importedLayer.content.params, {
    ...freshLayer.content.params,
    ticks: 24,
    chain: false,
    minLength: 38,
    step: 0.5,
    insert: 0,
  });
  assert.equal(imported.catalogSha256, fresh.catalogSha256);

  const appSaved = createDocument("neighborhood-growth");
  appSaved.catalogSha256 = legacyV3Dynamics.catalogSha256;
  appSaved.layers[0].params = { ticks: 24, chain: false, minLength: 38, step: 0.5 };
  const appImported = validateDocument(appSaved);
  assert.equal(appImported.layers[0].params.insert, 0);
  assert.equal(appImported.catalogSha256, createDocument().catalogSha256);

  const defaults = (technique: string) =>
    createDocument(technique).layers[0].params as Record<string, unknown>;
  const migrate = (technique: string, params: Record<string, unknown>) => {
    const document = createDocument(technique);
    document.catalogSha256 = legacyV3Dynamics.catalogSha256;
    document.layers[0].params = params as never;
    return validateDocument(document).layers[0].params as Record<string, unknown>;
  };
  // pre-revision shapes migrate to the revised defaults with saved settings preserved
  assert.deepEqual(
    migrate("neighborhood-growth", { ticks: 8, chain: true, largeMarks: true, minLength: 16 }),
    { ...defaults("neighborhood-growth"), ticks: 8, chain: true, minLength: 16, step: 0.35, insert: 0 },
  );
  assert.deepEqual(
    migrate("sensing-trails", { ticks: 43, field: "lower-left", gain: -0.05, dotMarks: true }),
    { ...defaults("sensing-trails"), ticks: 43, field: "lower-left", gain: -0.05, dotMarks: true, reach: 13 },
  );
  assert.deepEqual(
    migrate("bridge-web", { ticks: 26, weave: true, candidate: true }),
    { ...defaults("bridge-web"), ticks: 26, candidate: true, strain: 25, slant: -31, stride: 5 },
  );
  assert.deepEqual(
    migrate("elastic-loops", { ticks: 13, reverseCurl: true, windX: 2, structure: false }),
    { ...defaults("elastic-loops"), ticks: 13, windX: 2, structure: false, growth: 0.018, curl: -0.09, range: 55, strength: 18 },
  );
  assert.deepEqual(
    migrate("hatched-islands", { angle: true, dense: true, transfer: true, outline: false }),
    { ...defaults("hatched-islands"), spacing: 14, cross: 27, rotation: 71, twist: -85, region: "island-b", outline: false },
  );
  // post-revision shapes pass through unchanged
  assert.deepEqual(
    migrate("sensing-trails", { ticks: 40, field: "upper-right", gain: 0.1, reach: 30, dotMarks: false }),
    { ...defaults("sensing-trails"), ticks: 40, field: "upper-right", gain: 0.1, reach: 30, dotMarks: false },
  );
  assert.deepEqual(
    migrate("bridge-web", { ticks: 42, strain: 60, slant: -31, stride: 2, candidate: false }),
    { ...defaults("bridge-web"), ticks: 42, strain: 60, slant: -31, stride: 2, candidate: false },
  );
  assert.deepEqual(
    migrate("elastic-loops", { ticks: 36, growth: 0.04, curl: 0.15, windX: -2, range: 120, strength: 24, structure: true }),
    { ...defaults("elastic-loops"), ticks: 36, growth: 0.04, curl: 0.15, windX: -2, range: 120, strength: 24, structure: true },
  );
  assert.deepEqual(
    migrate("hatched-islands", { spacing: 8, cross: 80, rotation: 360, twist: -180, region: "island-b", outline: true }),
    { ...defaults("hatched-islands"), spacing: 8, cross: 80, rotation: 360, twist: -180, region: "island-b", outline: true },
  );
});
