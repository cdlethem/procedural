import {
  validateStudioDocument,
  type CandidateScope,
  type StudioDocumentV3,
} from "./studio-document";

export type HarnessToolName =
  | "studio.context"
  | "catalog.search"
  | "catalog.describe"
  | "reference.lookup"
  | "candidate.create"
  | "candidate.validate"
  | "render.submit"
  | "render.status"
  | "render.cancel"
  | "artifact.read"
  | "candidate.apply"
  | "project.export";
export type HarnessDiagnostic = {
  stage: string;
  code: string;
  message: string;
  location?: string;
  retryable: boolean;
};
export type HarnessEnvelope<T extends object = Record<string, unknown>> = {
  ok: boolean;
  requestId: string;
  snapshotHash: string;
  error?: HarnessDiagnostic;
} & T;
export type HarnessRun = {
  id: string;
  state: "running" | "succeeded" | "failed" | "cancelled" | string;
  [key: string]: unknown;
};
export type HarnessClientOptions = {
  authorizeApplyScope?: CandidateScope;
  signal?: AbortSignal;
};

const jsonResponse = async <T extends object>(response: Response): Promise<HarnessEnvelope<T>> => {
  const body: unknown = await response.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error(`Harness returned an invalid JSON envelope (HTTP ${response.status})`);
  const parsed = body as Record<string, unknown>;
  const error = parsed.error;
  return {
    ...(parsed as T),
    ok: parsed.ok === true && !error,
    requestId: typeof parsed.requestId === "string" ? parsed.requestId : "",
    snapshotHash: typeof parsed.snapshotHash === "string" ? parsed.snapshotHash : "",
  };
};

/** Calls the same-origin harness transport and leaves diagnostic failures in-band. */
export async function callHarnessTool<T extends object = Record<string, unknown>>(
  tool: HarnessToolName,
  args: Record<string, unknown> = {},
  options: HarnessClientOptions = {},
): Promise<HarnessEnvelope<T>> {
  const body: Record<string, unknown> = { tool, arguments: args };
  if (options.authorizeApplyScope) body.authorizeApplyScope = options.authorizeApplyScope;
  const response = await fetch("/harness/tool", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  return jsonResponse<T>(response);
}

export async function startPromptRun(input: {
  prompt: string;
  documentHandle: string;
  scope: CandidateScope;
  selectedLayerId?: string | null;
  target: "p5js";
}, options: Pick<HarnessClientOptions, "signal"> = {}): Promise<HarnessEnvelope<{ run: HarnessRun }>> {
  const response = await fetch("/harness/run", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: options.signal,
  });
  return jsonResponse<{ run: HarnessRun }>(response);
}

export async function pollRun(
  runId: string,
  options: Pick<HarnessClientOptions, "signal"> = {},
): Promise<HarnessEnvelope<{ run: HarnessRun }>> {
  const response = await fetch(`/harness/run?runId=${encodeURIComponent(runId)}`, {
    credentials: "same-origin",
    signal: options.signal,
  });
  return jsonResponse<{ run: HarnessRun }>(response);
}

export async function cancelRun(
  runId: string,
  options: Pick<HarnessClientOptions, "signal"> = {},
): Promise<HarnessEnvelope<{ run: HarnessRun }>> {
  const response = await fetch(`/harness/run?runId=${encodeURIComponent(runId)}`, {
    method: "DELETE",
    credentials: "same-origin",
    signal: options.signal,
  });
  return jsonResponse<{ run: HarnessRun }>(response);
}

export const artifactUrl = (hash: string): string => `/harness/artifact/${encodeURIComponent(hash)}`;
export const exportUrl = (handle: string): string => `/harness/export/${encodeURIComponent(handle)}`;

const sourcePreviewHashes = (document: StudioDocumentV3): string[] => {
  const hashes = new Set<string>();
  for (const layer of document.layers) {
    if (layer.kind !== "source") continue;
    if (layer.content.previewArtifactHash === null)
      throw new Error(`Source layer ${layer.id} has no preview artifact`);
    hashes.add(layer.content.previewArtifactHash);
  }
  return [...hashes];
};

/** Fetches and decodes every source preview; errors remain visible to the caller. */
export async function preloadPreviews(
  document: StudioDocumentV3,
  options: Pick<HarnessClientOptions, "signal"> = {},
): Promise<Record<string, ImageBitmap>> {
  const validated = validateStudioDocument(document);
  const results = await Promise.allSettled(
    sourcePreviewHashes(validated).map(async (hash) => {
      const response = await fetch(artifactUrl(hash), {
        credentials: "same-origin",
        signal: options.signal,
      });
      if (!response.ok)
        throw new Error(`Could not load preview artifact ${hash} (HTTP ${response.status})`);
      const blob = await response.blob();
      try {
        return [hash, await createImageBitmap(blob)] as const;
      } catch (error) {
        throw new Error(
          `Could not decode preview artifact ${hash}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),
  );
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") {
    for (const result of results) if (result.status === "fulfilled") result.value[1].close();
    throw failed.reason;
  }
  return Object.fromEntries(results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []));
}
/** Returns only the layer delta that may be re-created against a newer revision. */
export function candidateDelta(
  published: StudioDocumentV3,
  current: StudioDocumentV3,
  scope: CandidateScope,
  selectedLayerId?: string | null,
): StudioDocumentV3["layers"] {
  const base = validateStudioDocument(published);
  const next = validateStudioDocument(current);
  if (scope === "composition") return next.layers;
  if (scope === "edit-layer") {
    if (!selectedLayerId) throw new Error("An edit-layer rebase requires selectedLayerId");
    const edited = next.layers.find((layer) => layer.id === selectedLayerId);
    if (!edited) throw new Error(`Selected layer ${selectedLayerId} is not in the current document`);
    return [edited];
  }
  const ids = new Set(base.layers.map((layer) => layer.id));
  return next.layers.filter((layer) => !ids.has(layer.id));
}
