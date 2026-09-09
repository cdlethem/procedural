/**
 * Candidate lifecycle: immutable proposals against a frozen base revision, staged
 * diagnostics, and one atomic application. Scope is enforced here, not in the client:
 * editing one layer cannot touch other layers or the background, adding a layer keeps
 * the existing ordered stack, and replacing the stack requires composition scope.
 */
import {
  canonicalJson,
  JAVA_RUNNER_PROFILE,
  P5_RUNNER_PROFILE,
  validateStudioDocument,
} from "../studio-document";
import type {
  CandidateScope,
  ControlValue,
  DocumentLayer,
  SourceContent,
  SourceLanguage,
  StudioDocumentV3,
} from "../studio-document";
import { definition } from "../studio";
import {
  documentHash,
  fail,
  HarnessError,
  LIMITS,
  requireRoute,
  snapshot,
  snapshotHash,
} from "./core";
import type { Diagnostic, RouteId } from "./core";
import {
  loadApply,
  loadCandidate,
  newCandidateId,
  readManifest,
  saveApply,
  saveCandidate,
  verifyArtifact,
  writeSourceArtifact,
} from "./store";
import type { ArtifactManifest, CandidateRecord, ControlDeclaration } from "./store";

export type SourcePayload = {
  layerId: string;
  language: SourceLanguage;
  entrypoint: string;
  files: { path: string; text: string }[];
  controls: ControlDeclaration[];
  operationIds: string[];
  customAlgorithms: string[];
  licenseReferences: string[];
};
export type CreateCandidateInput = {
  requestId: string;
  baseDocumentHash: string;
  scope: CandidateScope;
  selectedLayerId?: string | null;
  document: unknown;
  sourcePayloads?: SourcePayload[];
  intentPredicates?: string[];
  assumptions?: string[];
  origin: "web-harness" | "mcp-client";
  runId?: string | null;
  model?: string | null;
  toolCalls?: number;
  references?: string[];
};

export const routeForLayer = (layer: DocumentLayer): RouteId =>
  layer.kind === "workflow"
    ? "workflow"
    : layer.kind === "recipe"
      ? "recipe"
      : layer.content.language === "p5js"
        ? "source-p5js"
        : "source-processing-java";

/** Render identity of a source layer: any change here invalidates its preview raster. */
export const renderInputsHash = (content: SourceContent): string =>
  documentHash({
    sourceArtifactHash: content.sourceArtifactHash,
    controls: content.controls,
    randomSeed: content.randomSeed,
    noiseSeed: content.noiseSeed,
    tick: content.tick,
    runnerProfile: content.runnerProfile,
  });

const layerIdentity = (layer: DocumentLayer): string => canonicalJson(layer);

function checkScope(
  base: StudioDocumentV3,
  next: StudioDocumentV3,
  scope: CandidateScope,
  selectedLayerId: string | null,
): void {
  if (next.layers.length > LIMITS.maxLayers)
    fail(
      "scope",
      "LAYER_LIMIT",
      `A document holds at most ${LIMITS.maxLayers} layers; the candidate proposes ${next.layers.length}`,
      { location: "layers" },
    );
  if (scope === "composition") return;
  if (next.background !== base.background)
    fail("scope", "SCOPE_VIOLATION", `${scope} scope cannot change the document background`, {
      location: "background",
    });
  if (scope === "edit-layer") {
    if (!selectedLayerId)
      fail("scope", "SCOPE_VIOLATION", "edit-layer scope requires a selected layer", {
        location: "selectedLayerId",
      });
    if (next.layers.length !== base.layers.length)
      fail("scope", "SCOPE_VIOLATION", "edit-layer scope cannot add or remove layers", {
        location: "layers",
      });
    for (const [index, layer] of next.layers.entries()) {
      const original = base.layers[index];
      if (layer.id !== original.id)
        fail("scope", "SCOPE_VIOLATION", "edit-layer scope cannot reorder or rename layers", {
          location: `layers[${index}].id`,
        });
      if (layer.id !== selectedLayerId && layerIdentity(layer) !== layerIdentity(original))
        fail(
          "scope",
          "SCOPE_VIOLATION",
          `edit-layer scope changed unselected layer ${layer.id}`,
          { location: `layers[${index}]` },
        );
    }
    if (!base.layers.some((layer) => layer.id === selectedLayerId))
      fail("scope", "SCOPE_VIOLATION", `Selected layer ${selectedLayerId} is not in the base document`, {
        location: "selectedLayerId",
      });
    return;
  }
  if (next.layers.length !== base.layers.length + 1)
    fail("scope", "SCOPE_VIOLATION", "add-layer scope adds exactly one layer", {
      location: "layers",
    });
  const retained = next.layers.filter((layer) => base.layers.some((old) => old.id === layer.id));
  if (retained.length !== base.layers.length)
    fail("scope", "SCOPE_VIOLATION", "add-layer scope cannot remove an existing layer", {
      location: "layers",
    });
  for (const [index, layer] of retained.entries())
    if (layerIdentity(layer) !== layerIdentity(base.layers[index]))
      fail(
        "scope",
        "SCOPE_VIOLATION",
        `add-layer scope changed existing layer ${layer.id}`,
        { location: `layers[${index}]` },
      );
}

/** Materializes proposed source files into immutable artifacts and binds their hashes. */
function bindSourcePayloads(
  document: StudioDocumentV3,
  payloads: SourcePayload[],
): { document: StudioDocumentV3; artifacts: string[] } {
  const known = new Set(snapshot().operations.map((operation) => operation.id)),
    artifacts: string[] = [],
    byLayer = new Map<string, SourcePayload>();
  for (const payload of payloads) {
    if (byLayer.has(payload.layerId))
      fail("schema", "MALFORMED_REQUEST", `Duplicate source payload for layer ${payload.layerId}`, {
        location: `sourcePayloads.${payload.layerId}`,
      });
    byLayer.set(payload.layerId, payload);
  }
  const layers = document.layers.map((layer): DocumentLayer => {
    if (layer.kind !== "source") {
      if (byLayer.has(layer.id))
        fail(
          "schema",
          "MALFORMED_REQUEST",
          `Layer ${layer.id} is not a source layer but carries a source payload`,
          { location: `sourcePayloads.${layer.id}` },
        );
      return layer;
    }
    const payload = byLayer.get(layer.id);
    if (!payload) {
      verifyArtifact(layer.content.sourceArtifactHash);
      return layer;
    }
    if (payload.language !== layer.content.language)
      fail("type", "MALFORMED_REQUEST", `Layer ${layer.id} language differs from its payload`, {
        location: `sourcePayloads.${layer.id}.language`,
      });
    if (payload.entrypoint !== layer.content.entrypoint)
      fail("type", "MALFORMED_REQUEST", `Layer ${layer.id} entrypoint differs from its payload`, {
        location: `sourcePayloads.${layer.id}.entrypoint`,
      });
    for (const id of payload.operationIds)
      if (!known.has(id))
        fail("binding", "UNKNOWN_OPERATION", `Unknown operation identifier: ${id}`, {
          location: `sourcePayloads.${layer.id}.operationIds`,
        });
    const versions = new Map(snapshot().operations.map((operation) => [operation.id, operation.version]));
    const manifest = writeSourceArtifact({
      language: payload.language,
      entrypoint: payload.entrypoint,
      files: payload.files,
      controls: payload.controls,
      dependencyHashes: [],
      operationIdsAndVersions: payload.operationIds.map((id) => ({
        id,
        version: versions.get(id) ?? "unknown",
        usage: "declared",
      })),
      runtimeHash: snapshotHash(),
      renderer: payload.language === "p5js" ? P5_RUNNER_PROFILE : JAVA_RUNNER_PROFILE,
      randomSeed: layer.content.randomSeed,
      noiseSeed: layer.content.noiseSeed,
      tick: layer.content.tick,
      licenseReferences: payload.licenseReferences,
      customAlgorithms: payload.customAlgorithms,
    });
    artifacts.push(manifest.contentHash);
    return {
      ...layer,
      content: {
        ...layer.content,
        sourceArtifactHash: manifest.contentHash,
        previewArtifactHash: null,
        controls: defaultControls(manifest, layer.content.controls),
      },
    };
  });
  for (const id of byLayer.keys())
    if (!document.layers.some((layer) => layer.id === id))
      fail("schema", "MALFORMED_REQUEST", `Source payload targets unknown layer ${id}`, {
        location: `sourcePayloads.${id}`,
      });
  return { document: { ...document, layers }, artifacts };
}
/** Declared control defaults win for keys the candidate left out; extra keys are rejected. */
function defaultControls(
  manifest: ArtifactManifest,
  supplied: Record<string, ControlValue>,
): Record<string, ControlValue> {
  const resolved: Record<string, ControlValue> = {};
  for (const declaration of manifest.controls)
    resolved[declaration.key] = declaration.key in supplied ? supplied[declaration.key] : declaration.value;
  for (const key of Object.keys(supplied))
    if (!manifest.controls.some((declaration) => declaration.key === key))
      fail("type", "INVALID_CONTROL", `Control ${key} is not declared by the source artifact`, {
        location: `controls.${key}`,
      });
  return resolved;
}

export function createCandidate(input: CreateCandidateInput): CandidateRecord {
  const raw = input.document;
  if (raw && typeof raw === "object" && "layers" in raw && Array.isArray(raw.layers) && raw.layers.length > LIMITS.maxLayers)
    fail(
      "scope",
      "LAYER_LIMIT",
      `A document holds at most ${LIMITS.maxLayers} layers; the candidate proposes ${raw.layers.length}`,
      { location: "layers" },
    );
  const proposed = validateStudioDocument(input.document);
  const bound = bindSourcePayloads(proposed, input.sourcePayloads ?? []);
  const candidate: CandidateRecord = {
    id: newCandidateId(),
    requestId: input.requestId,
    createdAt: new Date().toISOString(),
    baseDocumentHash: input.baseDocumentHash,
    scope: input.scope,
    selectedLayerId: input.selectedLayerId ?? null,
    bindingSnapshotHash: snapshotHash(),
    resultingDocument: validateStudioDocument(bound.document),
    artifacts: bound.artifacts,
    intentPredicates: (input.intentPredicates ?? []).slice(0, 32),
    assumptions: (input.assumptions ?? []).slice(0, 32),
    provenance: {
      origin: input.origin,
      runId: input.runId ?? null,
      model: input.model ?? null,
      toolCalls: input.toolCalls ?? 0,
      references: (input.references ?? []).slice(0, 32),
    },
    previewJobId: null,
    validation: null,
  };
  return saveCandidate(candidate);
}
/** Scope requires the base document; the caller supplies its detached copy. */
export function checkCandidateScope(candidate: CandidateRecord, base: unknown): void {
  const validated = validateStudioDocument(base);
  if (documentHash(validated) !== candidate.baseDocumentHash)
    fail("revision", "REVISION_CONFLICT", "The supplied base document is not the candidate's base revision", {
      location: "baseDocumentHash",
      retryable: true,
    });
  checkScope(validated, candidate.resultingDocument, candidate.scope, candidate.selectedLayerId);
}

export type ValidationReport = {
  candidateId: string;
  ok: boolean;
  diagnostics: Diagnostic[];
  requiredRenders: { layerId: string; route: RouteId; inputsHash: string; rendered: boolean }[];
  exportProfiles: { profile: string; supported: boolean; reason: string }[];
  scope: CandidateScope;
  selectedLayerId: string | null;
  baseDocumentHash: string;
  artifacts: string[];
  intentPredicates: string[];
  assumptions: string[];
  provenance: CandidateRecord["provenance"];
  resultingDocument: StudioDocumentV3;
};
const collect = (diagnostics: Diagnostic[], action: () => void): void => {
  try {
    action();
  } catch (error) {
    if (error instanceof HarnessError) diagnostics.push(error.diagnostic);
    else
      diagnostics.push({
        stage: "schema",
        code: "MALFORMED_REQUEST",
        message: error instanceof Error ? error.message : String(error),
        retryable: false,
      });
  }
};
/** Separate schema, type, binding, capability and budget diagnostics for one candidate. */
export function validateCandidate(
  candidateId: string,
  profiles: string[] = ["studio-preview"],
): ValidationReport {
  const candidate = loadCandidate(candidateId),
    diagnostics: Diagnostic[] = [],
    requiredRenders: ValidationReport["requiredRenders"] = [];
  collect(diagnostics, () => {
    validateStudioDocument(candidate.resultingDocument);
  });
  if (candidate.bindingSnapshotHash !== snapshotHash())
    diagnostics.push({
      stage: "binding",
      code: "STALE_BINDING",
      message: "The candidate was created against an older capability snapshot; rebuild it",
      retryable: true,
    });
  for (const layer of candidate.resultingDocument.layers) {
    const route = routeForLayer(layer);
    collect(diagnostics, () => {
      const capability = requireRoute(route);
      if (!capability.available)
        fail("capability", "UNSUPPORTED_CAPABILITY", `${route}: ${capability.reason}`, {
          location: `layers.${layer.id}`,
        });
    });
    if (layer.kind === "workflow")
      collect(diagnostics, () => {
        definition(layer.content.technique);
      });
    if (layer.kind === "source")
      collect(diagnostics, () => {
        const manifest = verifyArtifact(layer.content.sourceArtifactHash);
        if (manifest.kind !== "source" || manifest.language !== layer.content.language)
          fail("binding", "STALE_BINDING", `Layer ${layer.id} artifact is not ${layer.content.language} source`, {
            location: `layers.${layer.id}.sourceArtifactHash`,
          });
        if (manifest.entrypoint !== layer.content.entrypoint)
          fail("binding", "STALE_BINDING", `Layer ${layer.id} entrypoint differs from its artifact`, {
            location: `layers.${layer.id}.entrypoint`,
          });
        checkControls(manifest, layer.content.controls, layer.id);
        const inputsHash = renderInputsHash(layer.content);
        let rendered = false;
        if (layer.content.previewArtifactHash) {
          const preview = readManifest(layer.content.previewArtifactHash);
          rendered = preview.kind === "image" && preview.inputsHash === inputsHash;
          if (!rendered)
            diagnostics.push({
              stage: "render",
              code: "STALE_BINDING",
              message: `Layer ${layer.id} preview was rendered from different inputs; render again`,
              location: `layers.${layer.id}.previewArtifactHash`,
              retryable: true,
            });
        }
        requiredRenders.push({ layerId: layer.id, route, inputsHash, rendered });
      });
  }
  const exportProfiles = profiles.map((profile) => {
    if (profile === "studio-preview")
      return { profile, supported: true, reason: "Static 640x640 density-1 studio composition" };
    if (profile === "p5-standalone-html")
      return {
        profile,
        supported: candidate.resultingDocument.layers.every((layer) => layer.kind !== "recipe"),
        reason: "Standalone HTML/JS layer project with pinned dependencies and control values",
      };
    if (profile === "processing-java-tabs")
      return {
        profile,
        supported: candidate.resultingDocument.layers.some(
          (layer) => layer.kind === "source" && layer.content.language === "processing-java",
        ),
        reason: "Editable PDE/Java tabs for Processing Java source layers",
      };
    if (profile === "document-json")
      return { profile, supported: true, reason: "Portable studio-v3 document with artifact references" };
    return {
      profile,
      supported: false,
      reason: "Unknown export profile; portable single-sketch export is unsupported",
    };
  });
  for (const profile of exportProfiles)
    if (!profile.supported)
      diagnostics.push({
        stage: "capability",
        code: "UNSUPPORTED_CAPABILITY",
        message: `Export profile ${profile.profile} is unavailable: ${profile.reason}`,
        location: `profiles.${profile.profile}`,
        retryable: false,
      });
  const report: ValidationReport = {
    candidateId,
    ok: diagnostics.length === 0,
    diagnostics,
    requiredRenders,
    exportProfiles,
    scope: candidate.scope,
    selectedLayerId: candidate.selectedLayerId,
    baseDocumentHash: candidate.baseDocumentHash,
    artifacts: candidate.artifacts,
    intentPredicates: candidate.intentPredicates,
    assumptions: candidate.assumptions,
    provenance: candidate.provenance,
    resultingDocument: candidate.resultingDocument,
  };
  saveCandidate({
    ...candidate,
    validation: { diagnostics, validatedAt: new Date().toISOString() },
  });
  return report;
}
function checkControls(
  manifest: ArtifactManifest,
  values: Record<string, ControlValue>,
  layerId: string,
): void {
  for (const declaration of manifest.controls) {
    const value = values[declaration.key],
      location = `layers.${layerId}.controls.${declaration.key}`;
    if (value === undefined)
      fail("type", "INVALID_CONTROL", `Control ${declaration.key} has no value`, { location });
    if (declaration.type === "number") {
      const numeric =
        typeof value === "number" && Number.isFinite(value)
          ? value
          : fail("type", "INVALID_CONTROL", `Control ${declaration.key} must be a finite number`, {
              location,
            });
      if (declaration.min !== undefined && numeric < declaration.min)
        fail("type", "INVALID_CONTROL", `Control ${declaration.key} is below ${declaration.min}`, { location });
      if (declaration.max !== undefined && numeric > declaration.max)
        fail("type", "INVALID_CONTROL", `Control ${declaration.key} is above ${declaration.max}`, { location });
    } else if (declaration.type === "boolean") {
      if (typeof value !== "boolean")
        fail("type", "INVALID_CONTROL", `Control ${declaration.key} must be true or false`, { location });
    } else if (typeof value !== "string" || !(declaration.options ?? []).includes(value))
      fail("type", "INVALID_CONTROL", `Control ${declaration.key} is not one of its declared options`, {
        location,
      });
  }
  for (const key of Object.keys(values))
    if (!manifest.controls.some((declaration) => declaration.key === key))
      fail("type", "INVALID_CONTROL", `Control ${key} is not declared by the source artifact`, {
        location: `layers.${layerId}.controls.${key}`,
      });
}

export type ApplyResult = {
  candidateId: string;
  revisionHash: string;
  document: StudioDocumentV3;
  undoDocumentHash: string;
  appliedAt: string;
  replayed: boolean;
};
/** One atomic revision. A duplicate idempotency key returns the original result. */
export function applyCandidate(
  candidateId: string,
  base: unknown,
  idempotencyKey: string,
): ApplyResult {
  const candidate = loadCandidate(candidateId);
  if (!/^[A-Za-z0-9_.:-]{8,128}$/.test(idempotencyKey))
    fail("request", "MALFORMED_REQUEST", "An idempotency key uses 8 to 128 safe characters", {
      location: "idempotencyKey",
    });
  const previous = loadApply(idempotencyKey);
  if (previous) {
    if (previous.candidateId !== candidateId)
      fail("request", "MALFORMED_REQUEST", "This idempotency key belongs to another candidate", {
        location: "idempotencyKey",
      });
    return {
      candidateId,
      revisionHash: previous.revisionHash,
      document: candidate.resultingDocument,
      undoDocumentHash: previous.undoDocumentHash,
      appliedAt: previous.appliedAt,
      replayed: true,
    };
  }
  checkCandidateScope(candidate, base);
  const report = validateCandidate(candidateId);
  if (report.diagnostics.length) throw new HarnessError(report.diagnostics[0]);
  const unrendered = report.requiredRenders.filter((item) => !item.rendered);
  if (unrendered.length)
    fail(
      "render",
      "RUNTIME_FAILURE",
      `Source layers must have a current rendered preview before application: ${unrendered
        .map((item) => item.layerId)
        .join(", ")}`,
      { location: "layers", retryable: true },
    );
  const applied = saveApply({
    idempotencyKey,
    candidateId,
    revisionHash: documentHash(candidate.resultingDocument),
    appliedAt: new Date().toISOString(),
    undoDocumentHash: candidate.baseDocumentHash,
  });
  return {
    candidateId,
    revisionHash: applied.revisionHash,
    document: candidate.resultingDocument,
    undoDocumentHash: applied.undoDocumentHash,
    appliedAt: applied.appliedAt,
    replayed: false,
  };
}
