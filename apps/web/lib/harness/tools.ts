/**
 * The tool boundary. One handler set serves the web harness (internal RPC) and the MCP
 * adapter; neither adds semantics. Every response carries `requestId` and the capability
 * snapshot hash. Handles are opaque and scoped: no filesystem paths, shell commands or
 * fetch URLs cross this boundary. Scope and authority are checked server-side.
 */
import { readFileSync, statSync } from "node:fs";
import { existsSync } from "node:fs";
import {
  fail,
  HarnessError,
  LIMITS,
  requestId as newRequestId,
  snapshot,
  snapshotHash,
} from "./core";
import type { CapabilitySnapshot, Diagnostic } from "./core";
import { describeHandles, searchCatalog } from "./catalog";
import { lookupReference } from "./reference";
import {
  applyCandidate,
  checkCandidateScope,
  createCandidate,
  validateCandidate,
} from "./candidates";
import type { SourcePayload } from "./candidates";
import { cancelJob, jobStatus, submitRender } from "./jobs";
import { commitRevision, loadContext, publishContext } from "./documents";
import { artifactFilePath, loadCandidate, readManifest, verifyArtifact } from "./store";
import type { ControlDeclaration } from "./store";
import { exportBundle } from "./export";
import type { CandidateScope } from "../studio-document";

export type Caller = {
  origin: "web-harness" | "mcp-client";
  /** Explicit edit authority; the web session grants it only for the artist's action. */
  applyScopes: CandidateScope[];
};
export const TOOL_NAMES = [
  "studio.context",
  "catalog.search",
  "catalog.describe",
  "reference.lookup",
  "candidate.create",
  "candidate.validate",
  "render.submit",
  "render.status",
  "render.cancel",
  "artifact.read",
  "candidate.apply",
  "project.export",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export type ToolEnvelope = { requestId: string; snapshotHash: string };

const field = (args: Record<string, unknown>, key: string): unknown => args[key];
function requireObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("schema", "MALFORMED_REQUEST", `${name} must be an object`, { location: name });
  return value as Record<string, unknown>;
}
function requireString(args: Record<string, unknown>, key: string): string {
  const value = field(args, key);
  if (typeof value !== "string" || !value.length)
    fail("schema", "MALFORMED_REQUEST", `${key} must be a non-empty string`, { location: key });
  return value as string;
}
function optionalString(args: Record<string, unknown>, key: string): string | null {
  const value = field(args, key);
  if (value === undefined || value === null) return null;
  if (typeof value !== "string")
    fail("schema", "MALFORMED_REQUEST", `${key} must be a string`, { location: key });
  return value as string;
}
function requireInteger(args: Record<string, unknown>, key: string, min: number, max: number): number {
  const value = field(args, key);
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max)
    fail("schema", "MALFORMED_REQUEST", `${key} must be an integer from ${min} to ${max}`, {
      location: key,
    });
  return value as number;
}
function requireStringArray(args: Record<string, unknown>, key: string, limit: number): string[] {
  const value = field(args, key);
  if (!Array.isArray(value))
    fail("schema", "MALFORMED_REQUEST", `${key} must be an array of strings`, { location: key });
  const list = value as unknown[];
  if (list.length > limit)
    fail("schema", "MALFORMED_REQUEST", `${key} accepts at most ${limit} entries`, { location: key });
  return list.map((entry, index) => {
    if (typeof entry !== "string")
      fail("schema", "MALFORMED_REQUEST", `${key}[${index}] must be a string`, {
        location: `${key}[${index}]`,
      });
    return entry as string;
  });
}
function optionalStringArray(args: Record<string, unknown>, key: string, limit: number): string[] {
  return field(args, key) === undefined ? [] : requireStringArray(args, key, limit);
}
function requireScope(args: Record<string, unknown>): CandidateScope {
  const value = requireString(args, "scope");
  if (value !== "add-layer" && value !== "edit-layer" && value !== "composition")
    fail("schema", "MALFORMED_REQUEST", "scope must be add-layer, edit-layer or composition", {
      location: "scope",
    });
  return value as CandidateScope;
}
function requireRuntime(args: Record<string, unknown>): "p5js" | "processing-java" {
  const value = requireString(args, "runtime");
  if (value !== "p5js" && value !== "processing-java")
    fail("schema", "MALFORMED_REQUEST", "runtime must be p5js or processing-java", {
      location: "runtime",
    });
  return value as "p5js" | "processing-java";
}
function controlDeclarations(value: unknown, location: string): ControlDeclaration[] {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    fail("schema", "MALFORMED_REQUEST", `${location} must be an array`, { location });
  const list = value as unknown[];
  if (list.length > LIMITS.maxSearchResults)
    fail("schema", "MALFORMED_REQUEST", `${location} declares too many controls`, { location });
  return list.map((entry, index) => {
    const record = requireObject(entry, `${location}[${index}]`),
      key = requireString(record, "key"),
      type = requireString(record, "type");
    if (type !== "number" && type !== "boolean" && type !== "select")
      fail("schema", "MALFORMED_REQUEST", `${location}[${index}].type is not supported`, {
        location: `${location}[${index}].type`,
      });
    const declaration: ControlDeclaration = {
      key,
      label: optionalString(record, "label") ?? key,
      description: optionalString(record, "description") ?? "",
      type: type as ControlDeclaration["type"],
      value: record.value as ControlDeclaration["value"],
    };
    if (type === "number") {
      if (typeof record.min !== "number" || typeof record.max !== "number")
        fail("schema", "MALFORMED_REQUEST", `${location}[${index}] needs numeric min and max`, {
          location: `${location}[${index}]`,
        });
      declaration.min = record.min as number;
      declaration.max = record.max as number;
      declaration.step = typeof record.step === "number" ? (record.step as number) : 1;
      if (typeof declaration.value !== "number")
        fail("schema", "MALFORMED_REQUEST", `${location}[${index}].value must be a number`, {
          location: `${location}[${index}].value`,
        });
    } else if (type === "boolean") {
      if (typeof declaration.value !== "boolean")
        fail("schema", "MALFORMED_REQUEST", `${location}[${index}].value must be a boolean`, {
          location: `${location}[${index}].value`,
        });
    } else {
      declaration.options = requireStringArray(record, "options", 24);
      if (typeof declaration.value !== "string" || !declaration.options.includes(declaration.value))
        fail("schema", "MALFORMED_REQUEST", `${location}[${index}].value must be one of its options`, {
          location: `${location}[${index}].value`,
        });
    }
    return declaration;
  });
}
function sourcePayloads(value: unknown): SourcePayload[] {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    fail("schema", "MALFORMED_REQUEST", "sourcePayloads must be an array", {
      location: "sourcePayloads",
    });
  const list = value as unknown[];
  if (list.length > LIMITS.maxLayers)
    fail("schema", "MALFORMED_REQUEST", "sourcePayloads exceeds the layer limit", {
      location: "sourcePayloads",
    });
  return list.map((entry, index) => {
    const location = `sourcePayloads[${index}]`,
      record = requireObject(entry, location),
      language = requireString(record, "language");
    if (language !== "p5js" && language !== "processing-java")
      fail("schema", "MALFORMED_REQUEST", `${location}.language is not supported`, {
        location: `${location}.language`,
      });
    const files = field(record, "files");
    if (!Array.isArray(files) || files.length === 0)
      fail("schema", "MALFORMED_REQUEST", `${location}.files must be a non-empty array`, {
        location: `${location}.files`,
      });
    return {
      layerId: requireString(record, "layerId"),
      language: language as SourcePayload["language"],
      entrypoint: requireString(record, "entrypoint"),
      files: (files as unknown[]).map((file, fileIndex) => {
        const fileRecord = requireObject(file, `${location}.files[${fileIndex}]`);
        return {
          path: requireString(fileRecord, "path"),
          text: requireString(fileRecord, "text"),
        };
      }),
      controls: controlDeclarations(field(record, "controls"), `${location}.controls`),
      operationIds: optionalStringArray(record, "operationIds", 64),
      customAlgorithms: optionalStringArray(record, "customAlgorithms", 32),
      licenseReferences: optionalStringArray(record, "licenseReferences", 32),
    };
  });
}

export type ToolResult = Record<string, unknown> & ToolEnvelope & { ok: true };
export type ToolFailure = ToolEnvelope & { ok: false; error: Diagnostic };

/** Allowed scopes for a context: composition replacement needs composition authority. */
function allowedScopes(selectedLayerId: string | null, layerCount: number): CandidateScope[] {
  const scopes: CandidateScope[] = [];
  if (layerCount < LIMITS.maxLayers) scopes.push("add-layer");
  if (selectedLayerId) scopes.push("edit-layer");
  scopes.push("composition");
  return scopes;
}

async function handle(name: ToolName, args: Record<string, unknown>, caller: Caller): Promise<Record<string, unknown>> {
  if (name === "studio.context") {
    const document = field(args, "document"),
      handleId = optionalString(args, "documentHandle"),
      selectedLayerId = optionalString(args, "selectedLayerId");
    const context =
      document !== undefined
        ? publishContext(document, caller.origin === "mcp-client" ? "mcp-client" : "web-session", handleId ?? undefined)
        : loadContext(handleId ?? fail("schema", "MALFORMED_REQUEST", "documentHandle or document is required"));
    if (selectedLayerId && !context.document.layers.some((layer) => layer.id === selectedLayerId))
      fail("request", "UNKNOWN_HANDLE", `Selected layer ${selectedLayerId} is not in this document`, {
        location: "selectedLayerId",
      });
    const capability: CapabilitySnapshot = snapshot();
    return {
      documentHandle: context.handle,
      revisionHash: context.revisionHash,
      document: context.document,
      selectedLayerId,
      allowedScopes: allowedScopes(selectedLayerId, context.document.layers.length),
      limits: capability.limits,
      routes: capability.routes,
      history: context.history.slice(-8),
    };
  }
  if (name === "catalog.search")
    return {
      ...searchCatalog(
        requireString(args, "visualTask"),
        (optionalString(args, "target") ?? "any") === "processing-java"
          ? "processing-java"
          : (optionalString(args, "target") ?? "any") === "p5js"
            ? "p5js"
            : "any",
        field(args, "cursor") === undefined ? 0 : requireInteger(args, "cursor", 0, 4096),
        field(args, "limit") === undefined ? 12 : requireInteger(args, "limit", 1, LIMITS.maxSearchResults),
      ),
    };
  if (name === "catalog.describe") {
    const expected = optionalString(args, "snapshotHash");
    if (expected && expected !== snapshotHash())
      fail("binding", "STALE_BINDING", "The requested capability snapshot is no longer current", {
        location: "snapshotHash",
        retryable: true,
      });
    const described = describeHandles(requireStringArray(args, "handles", LIMITS.maxSearchResults));
    if (described.unknown.length && !described.operations.length && !described.workflows.length)
      fail("binding", "UNKNOWN_OPERATION", `Unknown identifiers: ${described.unknown.join(", ")}`, {
        location: "handles",
      });
    return { ...described };
  }
  if (name === "reference.lookup")
    return {
      ...lookupReference(
        requireRuntime(args),
        requireString(args, "query"),
        field(args, "limit") === undefined ? 12 : requireInteger(args, "limit", 1, 40),
      ),
    };
  if (name === "candidate.create") {
    const context = loadContext(requireString(args, "documentHandle")),
      scope = requireScope(args),
      selectedLayerId = optionalString(args, "selectedLayerId"),
      candidate = createCandidate({
        requestId: newRequestId(),
        baseDocumentHash: context.revisionHash,
        scope,
        selectedLayerId,
        document: field(args, "document"),
        sourcePayloads: sourcePayloads(field(args, "sourcePayloads")),
        intentPredicates: optionalStringArray(args, "intentPredicates", 32),
        assumptions: optionalStringArray(args, "assumptions", 32),
        origin: caller.origin,
        runId: optionalString(args, "runId"),
        model: optionalString(args, "model"),
        references: optionalStringArray(args, "references", 32),
        toolCalls: field(args, "toolCalls") === undefined ? 0 : requireInteger(args, "toolCalls", 0, 1000),
      });
    checkCandidateScope(candidate, context.document);
    return {
      candidateId: candidate.id,
      baseDocumentHash: candidate.baseDocumentHash,
      scope: candidate.scope,
      artifacts: candidate.artifacts,
      pendingRenders: candidate.resultingDocument.layers
        .filter((layer) => layer.kind === "source" && layer.content.previewArtifactHash === null)
        .map((layer) => layer.id),
      resultingDocument: candidate.resultingDocument,
    };
  }
  if (name === "candidate.validate")
    return {
      ...validateCandidate(
        requireString(args, "candidateId"),
        field(args, "profiles") === undefined
          ? ["studio-preview"]
          : requireStringArray(args, "profiles", 8),
      ),
    };
  if (name === "render.submit") {
    const frameContext = requireObject(field(args, "frameContext"), "frameContext"),
      job = submitRender(
        requireString(args, "candidateId"),
        requireString(args, "layerId"),
        requireInteger(frameContext, "tick", 1, LIMITS.maxTick),
        optionalString(args, "runId"),
      );
    return {
      jobId: job.id,
      state: job.state,
      chargedRenders: job.chargedRenders,
      queuePosition: job.state === "queued" ? 1 : 0,
      limits: job.limits,
    };
  }
  if (name === "render.status") {
    const job = jobStatus(requireString(args, "jobId"));
    return {
      jobId: job.id,
      state: job.state,
      progress: job.progress,
      diagnostics: job.diagnostics,
      imageHandle: job.imageArtifactHash,
      manifest: job.imageArtifactHash ? readManifest(job.imageArtifactHash) : null,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    };
  }
  if (name === "render.cancel") {
    const job = cancelJob(requireString(args, "jobId"));
    return { jobId: job.id, state: job.state, partialOutput: null };
  }
  if (name === "artifact.read") {
    const hash = requireString(args, "hash"),
      manifest = verifyArtifact(hash),
      requested = optionalString(args, "path") ?? (manifest.kind === "image" ? "image.png" : manifest.entrypoint ?? ""),
      path = artifactFilePath(hash, requested),
      size = statSync(path).size;
    if (manifest.kind === "image")
      return {
        hash,
        path: requested,
        type: "image/png",
        bytes: size,
        content: readFileSync(path).toString("base64"),
        encoding: "base64",
        manifest,
      };
    if (size > LIMITS.maxArtifactTextBytes)
      fail("budget", "RESOURCE_EXHAUSTED", `Artifact file ${requested} exceeds the readable text budget`, {
        location: "path",
      });
    return {
      hash,
      path: requested,
      type: "text/plain",
      bytes: size,
      content: readFileSync(path, "utf8"),
      encoding: "utf8",
      manifest,
    };
  }
  if (name === "candidate.apply") {
    const candidateId = requireString(args, "candidateId"),
      contextHandle = requireString(args, "documentHandle"),
      currentBaseHash = requireString(args, "currentBaseHash"),
      idempotencyKey = requireString(args, "idempotencyKey"),
      candidate = loadCandidate(candidateId);
    if (!caller.applyScopes.includes(candidate.scope))
      fail(
        "request",
        "NOT_AUTHORIZED",
        `This session has no ${candidate.scope} edit authority; the artist's Add or Use action grants it`,
        { location: "scope" },
      );
    const context = loadContext(contextHandle);
    if (context.revisionHash !== currentBaseHash)
      fail("revision", "REVISION_CONFLICT", "The document advanced since this candidate was created; rebase it", {
        location: "currentBaseHash",
        retryable: true,
      });
    const applied = applyCandidate(candidateId, context.document, idempotencyKey);
    if (!applied.replayed) commitRevision(contextHandle, applied.document, candidateId);
    return {
      candidateId,
      documentHandle: contextHandle,
      revisionHash: applied.revisionHash,
      undoDocumentHash: applied.undoDocumentHash,
      document: applied.document,
      replayed: applied.replayed,
      appliedAt: applied.appliedAt,
    };
  }
  if (name === "project.export") {
    const format = requireString(args, "format"),
      candidateId = optionalString(args, "candidateId"),
      contextHandle = optionalString(args, "documentHandle"),
      revisionHash = optionalString(args, "revisionHash");
    const document = candidateId
      ? loadCandidate(candidateId).resultingDocument
      : loadContext(
          contextHandle ?? fail("schema", "MALFORMED_REQUEST", "documentHandle or candidateId is required"),
        ).document;
    if (contextHandle && revisionHash) {
      const context = loadContext(contextHandle);
      if (context.revisionHash !== revisionHash)
        fail("revision", "REVISION_CONFLICT", "Only the committed revision can be exported", {
          location: "revisionHash",
          retryable: true,
        });
    }
    return { ...exportBundle(document, format) };
  }
  return fail("request", "UNKNOWN_TOOL", `Unknown tool: ${name}`);
}
/** Single dispatch used by the internal RPC route and the MCP adapter. */
export async function callTool(
  name: string,
  args: unknown,
  caller: Caller,
): Promise<ToolResult | ToolFailure> {
  const envelope: ToolEnvelope = { requestId: newRequestId(), snapshotHash: snapshotHash() };
  if (!TOOL_NAMES.includes(name as ToolName))
    return {
      ...envelope,
      ok: false,
      error: {
        stage: "request",
        code: "UNKNOWN_TOOL",
        message: `Unknown tool: ${name}. Available: ${TOOL_NAMES.join(", ")}`,
        retryable: false,
      },
    };
  try {
    const result = await handle(name as ToolName, requireObject(args ?? {}, "arguments"), caller);
    return { ...envelope, ...result, ok: true };
  } catch (error) {
    if (error instanceof HarnessError) return { ...envelope, ok: false, error: error.diagnostic };
    return {
      ...envelope,
      ok: false,
      error: {
        stage: "request",
        code: "MALFORMED_REQUEST",
        message: error instanceof Error ? error.message : String(error),
        retryable: false,
      },
    };
  }
}
export const toolSchemas = (): { name: ToolName; description: string; arguments: string }[] => [
  {
    name: "studio.context",
    description:
      "Freeze the editable document context. Returns the detached document, its revision hash, allowed scopes and the renderer/limit profile.",
    arguments: '{ "documentHandle": string, "selectedLayerId"?: string }',
  },
  {
    name: "catalog.search",
    description:
      "Rank studio workflows and catalog operations for a visual task. Reports whether each is executable here and why.",
    arguments: '{ "visualTask": string, "target"?: "p5js"|"processing-java"|"any", "cursor"?: number, "limit"?: number }',
  },
  {
    name: "catalog.describe",
    description:
      "Exact operation/workflow detail: schemas, queries, errors, semantics, target support, audited JavaScript signature and recipe binding status.",
    arguments: '{ "handles": string[], "snapshotHash"?: string }',
  },
  {
    name: "reference.lookup",
    description:
      "Official API entries for the installed runtime: p5.js documentation comments or Processing core signatures, with capability caveats.",
    arguments: '{ "runtime": "p5js"|"processing-java", "query": string, "limit"?: number }',
  },
  {
    name: "candidate.create",
    description:
      "Submit a complete proposed studio-v3 document plus source-file payloads. Returns an immutable candidate id or located structural errors.",
    arguments:
      '{ "documentHandle": string, "scope": "add-layer"|"edit-layer"|"composition", "selectedLayerId"?: string, "document": StudioDocumentV3, "sourcePayloads"?: [{ "layerId": string, "language": "p5js"|"processing-java", "entrypoint": string, "files": [{ "path": string, "text": string }], "controls": [{ "key": string, "label": string, "description": string, "type": "number"|"boolean"|"select", "min"?: number, "max"?: number, "step"?: number, "options"?: string[], "value": number|boolean|string }], "operationIds"?: string[], "customAlgorithms"?: string[], "licenseReferences"?: string[] }], "intentPredicates"?: string[], "assumptions"?: string[], "runId"?: string }',
  },
  {
    name: "candidate.validate",
    description:
      "Separate schema, type, binding, capability and budget diagnostics for a candidate, plus the renders it still needs.",
    arguments: '{ "candidateId": string, "profiles"?: string[] }',
  },
  {
    name: "render.submit",
    description: "Queue one source layer of a validated candidate for rendering with an explicit frame context.",
    arguments: '{ "candidateId": string, "layerId": string, "frameContext": { "tick": number }, "runId"?: string }',
  },
  {
    name: "render.status",
    description: "Job state, bounded diagnostics and the image handle plus render manifest on success.",
    arguments: '{ "jobId": string }',
  },
  { name: "render.cancel", description: "Cancel a render job; no partial output is published.", arguments: '{ "jobId": string }' },
  {
    name: "artifact.read",
    description: "Read bounded artifact content by handle: source text or a base64 PNG, with its manifest.",
    arguments: '{ "hash": string, "path"?: string }',
  },
  {
    name: "candidate.apply",
    description:
      "Apply a candidate as one atomic revision. Requires edit authority for its scope, the current base hash and an idempotency key.",
    arguments:
      '{ "candidateId": string, "documentHandle": string, "currentBaseHash": string, "idempotencyKey": string }',
  },
  {
    name: "project.export",
    description:
      "Export a committed revision or candidate as document JSON, a standalone p5 project, Processing Java tabs or the full bundle.",
    arguments:
      '{ "documentHandle"?: string, "revisionHash"?: string, "candidateId"?: string, "format": "document-json"|"p5-standalone-html"|"processing-java-tabs"|"studio-bundle" }',
  },
];
export const artifactImagePath = (hash: string): string | null => {
  const path = artifactFilePath(hash, "image.png");
  return existsSync(path) ? path : null;
};
