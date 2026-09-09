#!/usr/bin/env -S npx tsx
/**
 * End-to-end harness check: real candidates, real isolated renders through the shared
 * native render lease, real artifact publication, application and export. Renders happen
 * inside the runners, which take the lease themselves, so do not wrap this script in it.
 */
import assert from "node:assert/strict";
import { createDocumentV3, P5_RUNNER_PROFILE, JAVA_RUNNER_PROFILE } from "../lib/studio-document.ts";
import type { DocumentLayer, SourceLanguage, StudioDocumentV3 } from "../lib/studio-document.ts";
import { callTool } from "../lib/harness/tools.ts";
import type { Caller, ToolFailure, ToolResult } from "../lib/harness/tools.ts";
import { publishContext } from "../lib/harness/documents.ts";
import { exportBundle } from "../lib/harness/export.ts";
import { snapshot } from "../lib/harness/core.ts";

const ARTIST: Caller = { origin: "web-harness", applyScopes: ["add-layer", "edit-layer", "composition"] };
const summary: Record<string, unknown> = {};
const ok = (result: ToolResult | ToolFailure): Record<string, unknown> => {
  if (!result.ok) throw new Error(`tool call failed: ${JSON.stringify(result.error)}`);
  return result;
};
const P5_SOURCE = `import { regularGrid, cyclicPalette } from "procedurals";

export function setup(p, context) {
  p.noStroke();
}
export function render(p, context) {
  const grid = regularGrid({ origin: [40, 40], spacing: [48, 48], columns: 12, rows: 12 });
  const palette = cyclicPalette({ colors: [0x05084c, 0xde4638, 0x3dbdb7] });
  const count = Math.round(context.controls.density);
  for (let index = 0; index < count; index += 1) {
    const point = grid.pointAt(index % grid.size);
    const packed = palette.sample(index / count);
    p.fill((packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 180);
    p.circle(point[0] + p.random(-8, 8), point[1] + p.random(-8, 8), 6 + p.noise(index * 0.1) * 10);
  }
}
`;
const JAVA_SOURCE = `void setupLayer(PGraphics g, LayerControls controls) {
  g.noStroke();
}
void renderFrame(PGraphics g, LayerControls controls, int tick) {
  int count = (int) controls.number("density");
  g.fill(20, 40, 90, 180);
  for (int index = 0; index < count; index++)
    g.ellipse(random(g.width), random(g.height), 8, 8);
}
`;
const FAILING_SOURCE = `export function render(p, context) {
  throw new Error("deliberate layer failure");
}
`;
const sourceLayer = (id: string, language: SourceLanguage): DocumentLayer => ({
  id,
  kind: "source",
  visible: true,
  opacity: 1,
  content: {
    language,
    sourceArtifactHash: "0".repeat(64),
    previewArtifactHash: null,
    runnerProfile: language === "p5js" ? P5_RUNNER_PROFILE : JAVA_RUNNER_PROFILE,
    entrypoint: language === "p5js" ? "Layer.js" : "Layer.pde",
    background: "transparent",
    randomSeed: 42,
    noiseSeed: 7,
    tick: 1,
    controls: {},
  },
});
const payload = (layerId: string, language: SourceLanguage, text: string) => ({
  layerId,
  language,
  entrypoint: language === "p5js" ? "Layer.js" : "Layer.pde",
  files: [{ path: language === "p5js" ? "Layer.js" : "Layer.pde", text }],
  controls: [
    {
      key: "density",
      label: "Mark density",
      description: "How many marks are placed across the canvas.",
      type: "number",
      min: 10,
      max: 600,
      step: 1,
      value: 180,
    },
  ],
  operationIds: language === "p5js" ? ["layout.regular-grid", "color.cyclic-palette"] : [],
  customAlgorithms: language === "p5js" ? [] : ["uniform random ellipse scatter"],
  licenseReferences: [],
});

async function settle(jobId: string, seconds = 420): Promise<Record<string, unknown>> {
  const deadline = Date.now() + seconds * 1000;
  for (;;) {
    const status = ok(await callTool("render.status", { jobId }, ARTIST));
    const state = String(status.state);
    if (state === "succeeded" || state === "failed" || state === "cancelled") return status;
    if (Date.now() > deadline) throw new Error(`job ${jobId} never settled (last state ${state})`);
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 500);
    await promise;
  }
}
async function candidateFor(
  base: StudioDocumentV3,
  handle: string,
  layerId: string,
  language: SourceLanguage,
  text: string,
): Promise<string> {
  const created = ok(
    await callTool(
      "candidate.create",
      {
        documentHandle: handle,
        scope: "add-layer",
        document: { ...base, layers: [...base.layers, sourceLayer(layerId, language)] },
        sourcePayloads: [payload(layerId, language, text)],
      },
      ARTIST,
    ),
  );
  return String(created.candidateId);
}

async function main(): Promise<void> {
const routes = snapshot().routes;
summary.routes = routes.map((route) => ({ route: route.route, available: route.available }));
for (const route of ["source-p5js", "source-processing-java"])
  assert.equal(routes.find((entry) => entry.route === route)?.available, true, `${route} must be available here`);

const base = createDocumentV3("field-marks");
const context = publishContext(base, "web-session");

// 1. p5 source layer: create, validate, render, publish, apply.
const p5Candidate = await candidateFor(base, context.handle, "layer-p5", "p5js", P5_SOURCE);
const beforeRender = ok(await callTool("candidate.validate", { candidateId: p5Candidate }, ARTIST));
assert.equal((beforeRender.requiredRenders as { rendered: boolean }[])[0].rendered, false);
const p5Job = ok(
  await callTool("render.submit", { candidateId: p5Candidate, layerId: "layer-p5", frameContext: { tick: 1 } }, ARTIST),
);
const p5Settled = await settle(String(p5Job.jobId));
assert.equal(p5Settled.state, "succeeded", `p5 render failed: ${JSON.stringify(p5Settled.diagnostics)}`);
const p5Image = String(p5Settled.imageHandle);
summary.p5 = {
  jobId: p5Job.jobId,
  imageHandle: p5Image,
  manifest: p5Settled.manifest,
};
const afterRender = ok(await callTool("candidate.validate", { candidateId: p5Candidate }, ARTIST));
assert.equal((afterRender.requiredRenders as { rendered: boolean }[])[0].rendered, true);
assert.deepEqual(afterRender.diagnostics, []);
const read = ok(await callTool("artifact.read", { hash: p5Image }, ARTIST));
assert.equal(read.type, "image/png");
assert.ok(Number(read.bytes) > 1000);
const applied = ok(
  await callTool(
    "candidate.apply",
    {
      candidateId: p5Candidate,
      documentHandle: context.handle,
      currentBaseHash: context.revisionHash,
      idempotencyKey: `pipeline-p5-${p5Candidate}`,
    },
    ARTIST,
  ),
);
const appliedDocument = applied.document as StudioDocumentV3;
assert.equal(appliedDocument.layers.length, 2);
assert.equal(appliedDocument.layers[1].kind, "source");
summary.applied = { revisionHash: applied.revisionHash, undoDocumentHash: applied.undoDocumentHash };

// 2. A control change must produce a new render, not a reused preview.
const edited = ok(
  await callTool(
    "candidate.create",
    {
      documentHandle: context.handle,
      scope: "edit-layer",
      selectedLayerId: "layer-p5",
      document: {
        ...appliedDocument,
        layers: appliedDocument.layers.map((layer) =>
          layer.id === "layer-p5" && layer.kind === "source"
            ? { ...layer, content: { ...layer.content, controls: { density: 420 } } }
            : layer,
        ),
      },
    },
    ARTIST,
  ),
);
const editedReport = ok(await callTool("candidate.validate", { candidateId: String(edited.candidateId) }, ARTIST));
const staleDiagnostic = (editedReport.diagnostics as { code: string }[]).some((item) => item.code === "STALE_BINDING");
assert.ok(staleDiagnostic, "a control change must invalidate the previous preview");
const editedJob = ok(
  await callTool(
    "render.submit",
    { candidateId: String(edited.candidateId), layerId: "layer-p5", frameContext: { tick: 1 } },
    ARTIST,
  ),
);
const editedSettled = await settle(String(editedJob.jobId));
assert.equal(editedSettled.state, "succeeded");
assert.notEqual(String(editedSettled.imageHandle), p5Image, "a denser control value must change the raster");
summary.controlEdit = { imageHandle: editedSettled.imageHandle };

// 3. A runtime failure is reported as a failure and publishes nothing.
const failing = await candidateFor(appliedDocument, context.handle, "layer-bad", "p5js", FAILING_SOURCE);
const failingJob = ok(
  await callTool("render.submit", { candidateId: failing, layerId: "layer-bad", frameContext: { tick: 1 } }, ARTIST),
);
const failingSettled = await settle(String(failingJob.jobId));
assert.equal(failingSettled.state, "failed");
assert.equal(failingSettled.imageHandle, null);
const failureDiagnostic = (failingSettled.diagnostics as { code: string; message: string }[])[0];
assert.equal(failureDiagnostic.code, "RUNTIME_FAILURE");
assert.match(failureDiagnostic.message, /deliberate layer failure/);
summary.runtimeFailure = failureDiagnostic;

// 4. Cancellation terminates the job without a preview.
const cancellable = await candidateFor(appliedDocument, context.handle, "layer-cancel", "p5js", P5_SOURCE);
const cancelJob = ok(
  await callTool(
    "render.submit",
    { candidateId: cancellable, layerId: "layer-cancel", frameContext: { tick: 1 } },
    ARTIST,
  ),
);
const cancelled = ok(await callTool("render.cancel", { jobId: String(cancelJob.jobId) }, ARTIST));
assert.equal(cancelled.state, "cancelled");
const cancelledStatus = ok(await callTool("render.status", { jobId: String(cancelJob.jobId) }, ARTIST));
assert.equal(cancelledStatus.state, "cancelled");
assert.equal(cancelledStatus.imageHandle, null);
summary.cancelled = { jobId: cancelJob.jobId, diagnostics: cancelledStatus.diagnostics };

// 5. Processing Java layer renders through its own sandboxed profile.
const javaCandidate = await candidateFor(appliedDocument, context.handle, "layer-java", "processing-java", JAVA_SOURCE);
const javaJob = ok(
  await callTool(
    "render.submit",
    { candidateId: javaCandidate, layerId: "layer-java", frameContext: { tick: 1 } },
    ARTIST,
  ),
);
const javaSettled = await settle(String(javaJob.jobId));
assert.equal(javaSettled.state, "succeeded", `java render failed: ${JSON.stringify(javaSettled.diagnostics)}`);
summary.java = { jobId: javaJob.jobId, imageHandle: javaSettled.imageHandle, manifest: javaSettled.manifest };

// 6. Exports carry editable sources, controls, manifests and a compatibility report.
const javaValidated = ok(await callTool("candidate.validate", { candidateId: javaCandidate }, ARTIST));
assert.deepEqual(javaValidated.diagnostics, []);
const bundle = exportBundle(javaValidated.resultingDocument as StudioDocumentV3, "studio-bundle");
const paths = bundle.entries.map((entry) => entry.path);
for (const expected of [
  "document.json",
  "layers/layer-java/Layer.pde",
  "layers/layer-java/LayerControls.java",
  "layers/layer-java/preview.png",
  "layers/layer-p5/Layer.js",
  "layers/layer-p5/index.html",
])
  assert.ok(paths.includes(expected), `export bundle is missing ${expected}`);
summary.export = { bundleHandle: bundle.bundleHandle, bytes: bundle.bytes, entries: paths.length };

  console.log(JSON.stringify({ status: "passed", ...summary }, null, 2));
}
main().catch((error: unknown) => {
  console.error(JSON.stringify({ status: "failed", error: String(error), ...summary }, null, 2));
  process.exitCode = 1;
});
