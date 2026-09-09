import { loadRun, requestCancel } from "@/lib/harness/runs";
import { startRun } from "@/lib/harness/loop";
import { HarnessError, requestId, snapshotHash } from "@/lib/harness/core";
import type { CandidateScope } from "@/lib/studio-document";

/** Coordinator transport: start, observe and cancel a prompt run. */
export const dynamic = "force-dynamic";

const failure = (error: unknown, status = 422): Response => {
  if (error instanceof HarnessError)
    return Response.json({ ok: false, requestId: requestId(), snapshotHash: snapshotHash(), error: error.diagnostic }, { status });
  return Response.json(
    {
      ok: false,
      requestId: requestId(),
      snapshotHash: snapshotHash(),
      error: {
        stage: "request",
        code: "MALFORMED_REQUEST",
        message: error instanceof Error ? error.message : String(error),
        retryable: false,
      },
    },
    { status },
  );
};
export async function POST(request: Request): Promise<Response> {
  if ((request.headers.get("sec-fetch-site") ?? "same-origin").toLowerCase() === "cross-site")
    return failure(new Error("cross-site calls are not allowed"), 403);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await request.text());
  } catch (error) {
    return failure(error, 400);
  }
  if (!parsed || typeof parsed !== "object") return failure(new Error("the body must be an object"), 400);
  const prompt = "prompt" in parsed && typeof parsed.prompt === "string" ? parsed.prompt : "",
    documentHandle =
      "documentHandle" in parsed && typeof parsed.documentHandle === "string" ? parsed.documentHandle : "",
    scopeValue = "scope" in parsed ? parsed.scope : "",
    selectedLayerId =
      "selectedLayerId" in parsed && typeof parsed.selectedLayerId === "string" ? parsed.selectedLayerId : null,
    target = "p5js" as const;
  if (prompt.trim().length < 3) return failure(new Error("prompt must describe the requested artwork"), 400);
  if (scopeValue !== "add-layer" && scopeValue !== "edit-layer" && scopeValue !== "composition")
    return failure(new Error("scope must be add-layer, edit-layer or composition"), 400);
  try {
    const run = await startRun({
      prompt,
      documentHandle,
      scope: scopeValue satisfies CandidateScope,
      selectedLayerId,
      target,
    });
    return Response.json({ ok: true, requestId: requestId(), snapshotHash: snapshotHash(), run });
  } catch (error) {
    return failure(error);
  }
}
export async function GET(request: Request): Promise<Response> {
  const runId = new URL(request.url).searchParams.get("runId") ?? "";
  try {
    return Response.json({ ok: true, requestId: requestId(), snapshotHash: snapshotHash(), run: loadRun(runId) });
  } catch (error) {
    return failure(error, 404);
  }
}
export async function DELETE(request: Request): Promise<Response> {
  const runId = new URL(request.url).searchParams.get("runId") ?? "";
  try {
    return Response.json({ ok: true, requestId: requestId(), snapshotHash: snapshotHash(), run: requestCancel(runId) });
  } catch (error) {
    return failure(error, 404);
  }
}
