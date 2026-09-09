import assert from "node:assert/strict";
import test from "node:test";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import {
  createDocumentV3,
  validateStudioDocument,
  validateDocumentV3,
  P5_RUNNER_PROFILE,
  STUDIO_BINDING,
} from "../lib/studio-document.ts";
import type { DocumentLayer, StudioDocumentV3 } from "../lib/studio-document.ts";
import { createDocument } from "../lib/studio.ts";
import { documentHash, LIMITS, snapshot } from "../lib/harness/core.ts";
import { HarnessError } from "../lib/harness/core.ts";
import {
  applyCandidate,
  checkCandidateScope,
  createCandidate,
  validateCandidate,
} from "../lib/harness/candidates.ts";
import { artifactFilePath, verifyArtifact } from "../lib/harness/store.ts";
import { publishContext } from "../lib/harness/documents.ts";
import { callTool } from "../lib/harness/tools.ts";
import type { Caller } from "../lib/harness/tools.ts";
import { exportBundle } from "../lib/harness/export.ts";

const WEB: Caller = { origin: "web-harness", applyScopes: [] };
const ARTIST: Caller = { origin: "web-harness", applyScopes: ["add-layer", "edit-layer", "composition"] };
const sourceLayer = (id: string, controls: Record<string, number | string | boolean> = {}): DocumentLayer => ({
  id,
  kind: "source",
  visible: true,
  opacity: 1,
  content: {
    language: "p5js",
    sourceArtifactHash: "0".repeat(64),
    previewArtifactHash: null,
    runnerProfile: P5_RUNNER_PROFILE,
    entrypoint: "Layer.js",
    background: "transparent",
    randomSeed: 42,
    noiseSeed: 7,
    tick: 1,
    controls,
  },
});
const payload = (layerId: string, text: string) => ({
  layerId,
  language: "p5js" as const,
  entrypoint: "Layer.js",
  files: [{ path: "Layer.js", text }],
  controls: [
    {
      key: "density",
      label: "Density",
      description: "Marks across the canvas",
      type: "number" as const,
      min: 10,
      max: 400,
      step: 1,
      value: 120,
    },
  ],
  operationIds: ["layout.regular-grid"],
  customAlgorithms: [],
  licenseReferences: [],
});
const SOURCE = `export function render(p, context) {
  for (let index = 0; index < context.controls.density; index += 1)
    p.point(p.random(context.width), p.random(context.height));
}
`;

test("the harness-v1 envelope admits artifact layers and rejects unknown kinds", () => {
  const document = createDocumentV3("field-marks");
  assert.equal(document.schemaVersion, 2);
  assert.equal(document.bindingVersion, STUDIO_BINDING);
  assert.equal(document.layers[0].kind, "workflow");
  const migrated = validateStudioDocument(createDocument("path-marks"));
  assert.equal(migrated.bindingVersion, STUDIO_BINDING);
  assert.equal(migrated.layers[0].kind, "workflow");
  const withSource: StudioDocumentV3 = { ...document, layers: [...document.layers, sourceLayer("layer-9")] };
  assert.equal(validateDocumentV3(withSource).layers[1].kind, "source");
  assert.throws(
    () =>
      validateDocumentV3({
        ...document,
        layers: [{ id: "layer-2", kind: "shader", visible: true, opacity: 1, content: {} }],
      }),
    /kind must be workflow, source or recipe/,
  );
  assert.throws(
    () => validateDocumentV3({ ...withSource, layers: [withSourceTick(withSource, 0)] }),
    /tick must be an integer from 1 to 600/,
  );
  assert.throws(
    () => validateDocumentV3({ ...withSource, layers: [withSourceBackground(withSource, "clear")] }),
    /background must be transparent or opaque/,
  );
});
function withSourceTick(document: StudioDocumentV3, tick: number): unknown {
  const layer = document.layers[1];
  if (layer.kind !== "source") throw new Error("fixture");
  return { ...layer, content: { ...layer.content, tick } };
}
function withSourceBackground(document: StudioDocumentV3, background: string): unknown {
  const layer = document.layers[1];
  if (layer.kind !== "source") throw new Error("fixture");
  return { ...layer, content: { ...layer.content, background } };
}

test("source payloads become immutable artifacts with declared controls", () => {
  const base = createDocumentV3(),
    context = publishContext(base, "web-session"),
    candidate = createCandidate({
      requestId: "req-test",
      baseDocumentHash: context.revisionHash,
      scope: "add-layer",
      document: { ...base, layers: [...base.layers, sourceLayer("layer-7")] },
      sourcePayloads: [payload("layer-7", SOURCE)],
      origin: "web-harness",
    });
  assert.equal(candidate.artifacts.length, 1);
  const layer = candidate.resultingDocument.layers[1];
  assert.equal(layer.kind, "source");
  if (layer.kind !== "source") return;
  assert.notEqual(layer.content.sourceArtifactHash, "0".repeat(64));
  assert.equal(layer.content.controls.density, 120);
  const manifest = verifyArtifact(layer.content.sourceArtifactHash);
  assert.equal(manifest.kind, "source");
  assert.equal(manifest.entrypoint, "Layer.js");
  assert.equal(manifest.replayPolicy, "clean-setup-logical-ticks");
  assert.deepEqual(
    manifest.operationIdsAndVersions.map((entry) => entry.id),
    ["layout.regular-grid"],
  );
  assert.equal(readFileSync(artifactFilePath(manifest.contentHash, "Layer.js"), "utf8"), SOURCE);
  const repeated = createCandidate({
    requestId: "req-test-2",
    baseDocumentHash: context.revisionHash,
    scope: "add-layer",
    document: { ...base, layers: [...base.layers, sourceLayer("layer-7")] },
    sourcePayloads: [payload("layer-7", SOURCE)],
    origin: "web-harness",
  });
  assert.deepEqual(repeated.artifacts, candidate.artifacts);
});

test("unknown operation identifiers and undeclared controls are rejected", () => {
  const base = createDocumentV3(),
    context = publishContext(base, "web-session");
  assert.throws(
    () =>
      createCandidate({
        requestId: "req-test",
        baseDocumentHash: context.revisionHash,
        scope: "add-layer",
        document: { ...base, layers: [...base.layers, sourceLayer("layer-3")] },
        sourcePayloads: [{ ...payload("layer-3", SOURCE), operationIds: ["field.invented-noise"] }],
        origin: "web-harness",
      }),
    /Unknown operation identifier: field.invented-noise/,
  );
  assert.throws(
    () =>
      createCandidate({
        requestId: "req-test",
        baseDocumentHash: context.revisionHash,
        scope: "add-layer",
        document: { ...base, layers: [...base.layers, sourceLayer("layer-4", { unknownKnob: 3 })] },
        sourcePayloads: [payload("layer-4", SOURCE)],
        origin: "web-harness",
      }),
    /Control unknownKnob is not declared/,
  );
});

test("scope is enforced server-side for every mode", () => {
  const base = createDocumentV3(),
    withTwo: StudioDocumentV3 = {
      ...base,
      layers: [base.layers[0], { ...base.layers[0], id: "layer-2" }],
    },
    context = publishContext(withTwo, "web-session"),
    create = (scope: "add-layer" | "edit-layer" | "composition", document: unknown, selected?: string) =>
      createCandidate({
        requestId: "req-test",
        baseDocumentHash: context.revisionHash,
        scope,
        selectedLayerId: selected ?? null,
        document,
        origin: "web-harness",
      });
  const removed = create("edit-layer", { ...withTwo, layers: [withTwo.layers[0]] }, "layer-2");
  assert.throws(() => checkCandidateScope(removed, withTwo), /cannot add or remove layers/);
  const otherEdited = create(
    "edit-layer",
    { ...withTwo, layers: [{ ...withTwo.layers[0], opacity: 0.5 }, withTwo.layers[1]] },
    "layer-2",
  );
  assert.throws(() => checkCandidateScope(otherEdited, withTwo), /changed unselected layer/);
  const background = create("edit-layer", { ...withTwo, background: "#101010" }, "layer-2");
  assert.throws(() => checkCandidateScope(background, withTwo), /cannot change the document background/);
  const replaced = create("add-layer", {
    ...withTwo,
    layers: [
      withTwo.layers[0],
      { ...withTwo.layers[0], id: "layer-5" },
      { ...withTwo.layers[0], id: "layer-51" },
    ],
  });
  assert.throws(() => checkCandidateScope(replaced, withTwo), /cannot remove an existing layer/);
  const reordered = create("add-layer", {
    ...withTwo,
    layers: [withTwo.layers[1], withTwo.layers[0], { ...withTwo.layers[0], id: "layer-6" }],
  });
  assert.throws(() => checkCandidateScope(reordered, withTwo), /changed existing layer/);
  const added = create("add-layer", {
    ...withTwo,
    layers: [...withTwo.layers, { ...withTwo.layers[0], id: "layer-7" }],
  });
  checkCandidateScope(added, withTwo);
  const composed = create("composition", {
    ...withTwo,
    background: "#111111",
    layers: [{ ...withTwo.layers[0], id: "layer-8" }],
  });
  checkCandidateScope(composed, withTwo);
  const full: StudioDocumentV3 = {
    ...base,
    layers: Array.from({ length: LIMITS.maxLayers }, (_, index) => ({
      ...base.layers[0],
      id: `layer-${index + 10}`,
    })),
  };
  assert.throws(
    () =>
      createCandidate({
        requestId: "req-test",
        baseDocumentHash: documentHash(full),
        scope: "add-layer",
        document: { ...full, layers: [...full.layers, { ...base.layers[0], id: "layer-99" }] },
        origin: "web-harness",
      }),
    (error: unknown) => error instanceof HarnessError && error.diagnostic.code === "LAYER_LIMIT",
  );
});

test("a stale base revision is a retryable revision conflict", () => {
  const base = createDocumentV3(),
    context = publishContext(base, "web-session"),
    candidate = createCandidate({
      requestId: "req-test",
      baseDocumentHash: context.revisionHash,
      scope: "add-layer",
      document: { ...base, layers: [...base.layers, { ...base.layers[0], id: "layer-20" }] },
      origin: "web-harness",
    });
  const moved: StudioDocumentV3 = { ...base, background: "#0a0a0a" };
  assert.throws(
    () => checkCandidateScope(candidate, moved),
    (error: unknown) =>
      error instanceof HarnessError &&
      error.diagnostic.code === "REVISION_CONFLICT" &&
      error.diagnostic.retryable,
  );
});

test("applying twice with one idempotency key replays the first revision", () => {
  const base = createDocumentV3(),
    context = publishContext(base, "web-session"),
    candidate = createCandidate({
      requestId: "req-test",
      baseDocumentHash: context.revisionHash,
      scope: "add-layer",
      document: { ...base, layers: [...base.layers, { ...base.layers[0], id: "layer-30" }] },
      origin: "web-harness",
    }),
    key = `test-${candidate.id}`;
  const first = applyCandidate(candidate.id, base, key),
    second = applyCandidate(candidate.id, base, key);
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.revisionHash, first.revisionHash);
  assert.equal(first.undoDocumentHash, context.revisionHash);
});

test("an unrendered source layer cannot be applied", () => {
  const base = createDocumentV3(),
    context = publishContext(base, "web-session"),
    candidate = createCandidate({
      requestId: "req-test",
      baseDocumentHash: context.revisionHash,
      scope: "add-layer",
      document: { ...base, layers: [...base.layers, sourceLayer("layer-40")] },
      sourcePayloads: [payload("layer-40", SOURCE)],
      origin: "web-harness",
    });
  const report = validateCandidate(candidate.id);
  assert.equal(report.requiredRenders.length, 1);
  assert.equal(report.requiredRenders[0].rendered, false);
  assert.throws(
    () => applyCandidate(candidate.id, base, `test-unrendered-${candidate.id}`),
    /current rendered preview/,
  );
});

test("artifact verification detects tampering with stored source", () => {
  const base = createDocumentV3(),
    context = publishContext(base, "web-session"),
    candidate = createCandidate({
      requestId: "req-test",
      baseDocumentHash: context.revisionHash,
      scope: "add-layer",
      document: { ...base, layers: [...base.layers, sourceLayer("layer-50")] },
      sourcePayloads: [payload("layer-50", `${SOURCE}// unique ${Date.now()}\n`)],
      origin: "web-harness",
    }),
    hash = candidate.artifacts[0],
    path = artifactFilePath(hash, "Layer.js"),
    original = readFileSync(path);
  try {
    chmodSync(path, 0o644);
    writeFileSync(path, `${original.toString("utf8")}// tampered\n`);
    assert.throws(() => verifyArtifact(hash), /is missing|changed on disk/);
  } finally {
    writeFileSync(path, original);
    chmodSync(path, 0o444);
  }
  assert.equal(verifyArtifact(hash).contentHash, hash);
});

test("the recipe route stays discoverable and unavailable with its reason", () => {
  const recipe = snapshot().routes.find((route) => route.route === "recipe");
  assert.ok(recipe);
  assert.equal(recipe.available, false);
  assert.match(recipe.reason, /draft/);
  assert.match(recipe.reason, /source route/);
});

test("every catalog operation is searchable and reports executability separately", async () => {
  const result = await callTool("catalog.search", { visualTask: "noise field of marks", limit: 6 }, WEB);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const hits = result.hits;
  assert.ok(Array.isArray(hits) && hits.length > 0);
  for (const hit of hits as { capabilityReason: string; executableHere: boolean }[])
    assert.ok(hit.capabilityReason.length > 0);
  const described = await callTool(
    "catalog.describe",
    { handles: ["field.gradient-noise-2d-01", "workflow:field-marks"] },
    WEB,
  );
  assert.equal(described.ok, true);
  if (!described.ok) return;
  const operations = described.operations as { id: string; javascript: { export: string } | null }[];
  assert.equal(operations[0].id, "field.gradient-noise-2d-01");
  assert.equal(operations[0].javascript?.export, "gradientNoise2D01");
  assert.equal((described.workflows as { id: string }[])[0].id, "field-marks");
  const unknown = await callTool("catalog.describe", { handles: ["field.invented"] }, WEB);
  assert.equal(unknown.ok, false);
  if (unknown.ok) return;
  assert.equal(unknown.error.code, "UNKNOWN_OPERATION");
});

test("unknown tools and malformed arguments answer with located diagnostics", async () => {
  const unknown = await callTool("studio.destroy", {}, WEB);
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.error.code, "UNKNOWN_TOOL");
  const malformed = await callTool("catalog.search", { visualTask: "" }, WEB);
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.error.stage, "schema");
  const missing = await callTool("render.status", { jobId: "job-not-a-uuid" }, WEB);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error.code, "UNKNOWN_HANDLE");
});

test("candidate.apply needs the artist's explicit scope authority", async () => {
  const base = createDocumentV3(),
    context = publishContext(base, "web-session"),
    document = { ...base, layers: [...base.layers, { ...base.layers[0], id: "layer-60" }] },
    created = await callTool(
      "candidate.create",
      { documentHandle: context.handle, scope: "add-layer", document },
      WEB,
    );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const candidateId = String(created.candidateId),
    refused = await callTool(
      "candidate.apply",
      {
        candidateId,
        documentHandle: context.handle,
        currentBaseHash: context.revisionHash,
        idempotencyKey: `authority-${candidateId}`,
      },
      WEB,
    );
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.error.code, "NOT_AUTHORIZED");
  const applied = await callTool(
    "candidate.apply",
    {
      candidateId,
      documentHandle: context.handle,
      currentBaseHash: context.revisionHash,
      idempotencyKey: `authority-${candidateId}`,
    },
    ARTIST,
  );
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal((applied.document as StudioDocumentV3).layers.length, 2);
  const conflicted = await callTool(
    "candidate.apply",
    {
      candidateId,
      documentHandle: context.handle,
      currentBaseHash: context.revisionHash,
      idempotencyKey: `authority-second-${candidateId}`,
    },
    ARTIST,
  );
  assert.equal(conflicted.ok, false);
  if (!conflicted.ok) assert.equal(conflicted.error.code, "REVISION_CONFLICT");
});

test("reference lookup matches the installed runtime and marks denied capabilities", async () => {
  const p5 = await callTool("reference.lookup", { runtime: "p5js", query: "noise" }, WEB);
  assert.equal(p5.ok, true);
  if (!p5.ok) return;
  const installed = JSON.parse(readFileSync("node_modules/p5/package.json", "utf8")).version;
  assert.equal(p5.version, installed);
  const entries = p5.entries as { symbol: string; signature: string; caveat: string | null }[];
  assert.ok(entries.some((entry) => entry.symbol === "noise"));
  const loaders = await callTool("reference.lookup", { runtime: "p5js", query: "loadImage" }, WEB);
  assert.equal(loaders.ok, true);
  if (!loaders.ok) return;
  const loader = (loaders.entries as { symbol: string; caveat: string | null }[]).find(
    (entry) => entry.symbol === "loadImage",
  );
  assert.ok(loader?.caveat);
});

test("export bundles carry sources, controls, manifests and a compatibility report", () => {
  const base = createDocumentV3(),
    context = publishContext(base, "web-session"),
    candidate = createCandidate({
      requestId: "req-test",
      baseDocumentHash: context.revisionHash,
      scope: "add-layer",
      document: { ...base, layers: [...base.layers, sourceLayer("layer-70")] },
      sourcePayloads: [payload("layer-70", SOURCE)],
      origin: "web-harness",
    }),
    bundle = exportBundle(candidate.resultingDocument, "studio-bundle");
  const paths = bundle.entries.map((entry) => entry.path);
  assert.ok(paths.includes("document.json"));
  assert.ok(paths.includes("LICENSES.md"));
  assert.ok(paths.includes("layers/layer-70/Layer.js"));
  assert.ok(paths.includes("layers/layer-70/controls.json"));
  assert.ok(paths.includes("layers/layer-70/render-manifest.json"));
  assert.ok(paths.includes("layers/layer-70/index.html"));
  assert.ok(paths.some((path) => path.startsWith("layers/layer-70/pkg/")));
  const workflow = bundle.compatibility.find((entry) => entry.kind === "workflow");
  assert.equal(workflow?.supported, true);
  assert.match(bundle.notes.join(" "), /never an editable/);
  assert.throws(() => exportBundle(candidate.resultingDocument, "single-sketch"), /portable single-sketch/);
});
