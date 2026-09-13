import assert from "node:assert/strict";
import test from "node:test";
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { createExplorationDocument } from "../lib/explorations";
import { insertSavedLayer } from "../lib/saved-layers";
import { saveLayer, readSavedLayer, listSavedLayers, SAVED_LAYER_ROOT } from "../lib/harness/layers";
import { revisionSources } from "../lib/harness/revision-context";
import { writeSourceArtifact, writeImageArtifact } from "../lib/harness/store";
import { renderInputsHash } from "../lib/harness/candidates";
import { P5_RUNNER_PROFILE, type SourceContent } from "../lib/studio-document";

function fixture() {
  const source = writeSourceArtifact({
    language: "p5js", entrypoint: "Layer.js", files: [{ path: "Layer.js", text: 'export function render(p, c) { p.circle(320, 320, c.controls.radius); }' }, { path: "Notes.js", text: "// Keep the hand-drawn circle." }],
    controls: [{ key: "radius", label: "Radius", description: "Circle size", type: "number", min: 1, max: 500, value: 40 }],
    dependencyHashes: [], operationIdsAndVersions: [], runtimeHash: "1".repeat(64), renderer: P5_RUNNER_PROFILE,
    randomSeed: 42, noiseSeed: 7, tick: 1, licenseReferences: ["Original test source"], customAlgorithms: [],
  });
  const content: SourceContent = {
    language: "p5js", entrypoint: "Layer.js", sourceArtifactHash: source.contentHash, previewArtifactHash: null,
    runnerProfile: P5_RUNNER_PROFILE, randomSeed: 42, noiseSeed: 7, tick: 1, background: "transparent", controls: { radius: 60 },
  };
  // Storage identity fixture only; native rendering is exercised by the browser pipeline.
  const preview = writeImageArtifact({ bytes: Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.from(renderInputsHash(content))]),
    renderer: P5_RUNNER_PROFILE, randomSeed: 42, noiseSeed: 7, tick: 1, dependencyHashes: [], operationIdsAndVersions: [], runtimeHash: "1".repeat(64), licenseReferences: [], inputsHash: renderInputsHash(content) });
  content.previewArtifactHash = preview.contentHash;
  return { ...createExplorationDocument(), layers: [{ id: "original", kind: "source" as const, visible: true, opacity: 0.8, content }] };
}

test("saved layers persist replay inputs and insert independent copies into other sketches", () => {
  const document = fixture();
  const saved = saveLayer({ title: "  Circle study  ", description: "A reusable circle", document });
  try {
    assert.equal(readSavedLayer(saved.id).title, "Circle study");
    assert.deepEqual(readSavedLayer(saved.id).document, document);
    assert.ok(listSavedLayers().some((item) => item.id === saved.id));
    const next = insertSavedLayer(document, saved, "copy");
    assert.deepEqual(next.layers[0], document.layers[0]);
    assert.equal(next.layers[1].id, "copy");
    if (next.layers[1].kind !== "source") throw Error("fixture");
    next.layers[1].content.controls.radius = 100;
    assert.equal(document.layers[0].content.controls.radius, 60);
    assert.deepEqual(readSavedLayer(saved.id).document, document);
    assert.throws(() => insertSavedLayer(document, saved, "original"), /unique/);
    const full = { ...document, layers: Array.from({ length: 8 }, (_, i) => ({ ...document.layers[0], id: `full-${i}` })) };
    assert.throws(() => insertSavedLayer(full, saved, "extra"), /up to 8/);
  } finally { unlinkSync(join(SAVED_LAYER_ROOT, `${saved.id}.json`)); }
});

test("saving rejects missing or stale previews, invalid controls, and non-layer documents", () => {
  const document = fixture();
  const save = () => saveLayer({ title: "Test", description: "", document });
  document.layers[0].content.tick = 2;
  assert.throws(save, /preview is stale/);
  document.layers[0].content.tick = 1;
  document.layers[0].content.controls.radius = 501;
  assert.throws(save, /above 500/);
  document.layers[0].content.controls.radius = 60;
  document.layers[0].content.previewArtifactHash = null;
  assert.throws(save, /Render the layer/);
  assert.throws(() => saveLayer({ title: " ", description: "", document }), /Name the layer/);
  assert.throws(() => saveLayer({ title: "Test", description: "", document: createExplorationDocument() }), /exactly one/);
  assert.throws(() => readSavedLayer("../../escape"), /Unknown/);
});

test("follow-up context includes exact files, declarations and provenance only for affected sources", () => {
  const document = fixture();
  document.layers.push({ ...structuredClone(document.layers[0]), id: "other" });
  assert.deepEqual(revisionSources(document, "add-layer", null), []);
  const sources = revisionSources(document, "edit-layer", "original");
  assert.equal(sources.length, 1);
  assert.equal(sources[0].layerId, "original");
  assert.equal(sources[0].files.length, 2);
  assert.match(sources[0].files[0].text, /c.controls.radius/);
  assert.deepEqual(sources[0].manifest.licenseReferences, ["Original test source"]);
  assert.equal(sources[0].manifest.controls[0].key, "radius");
  assert.equal(revisionSources(document, "composition", null).length, 2);
});
