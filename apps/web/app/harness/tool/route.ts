import { callTool } from "@/lib/harness/tools";
import type { Caller } from "@/lib/harness/tools";
import type { CandidateScope } from "@/lib/studio-document";

/** Internal RPC transport for the harness tools. The MCP adapter calls the same handlers. */
export const dynamic = "force-dynamic";
const MAX_BODY = 1 << 20;

const scopeOf = (value: unknown): CandidateScope | null =>
  value === "add-layer" || value === "edit-layer" || value === "composition" ? value : null;

export async function POST(request: Request): Promise<Response> {
  if ((request.headers.get("sec-fetch-site") ?? "same-origin").toLowerCase() === "cross-site")
    return Response.json(
      { error: { stage: "request", code: "NOT_AUTHORIZED", message: "cross-site calls are not allowed", retryable: false } },
      { status: 403 },
    );
  const text = await request.text();
  if (text.length > MAX_BODY)
    return Response.json(
      {
        error: {
          stage: "request",
          code: "RESOURCE_EXHAUSTED",
          message: "The request body exceeds 1 MB",
          retryable: false,
        },
      },
      { status: 413 },
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return Response.json(
      { error: { stage: "schema", code: "MALFORMED_REQUEST", message: "The body is not JSON", retryable: false } },
      { status: 400 },
    );
  }
  if (!parsed || typeof parsed !== "object" || !("tool" in parsed) || typeof parsed.tool !== "string")
    return Response.json(
      { error: { stage: "schema", code: "MALFORMED_REQUEST", message: "tool is required", retryable: false } },
      { status: 400 },
    );
  const authorized = "authorizeApplyScope" in parsed ? scopeOf(parsed.authorizeApplyScope) : null,
    caller: Caller = { origin: "web-harness", applyScopes: authorized ? [authorized] : [] },
    args = "arguments" in parsed ? parsed.arguments : {};
  const result = await callTool(parsed.tool, args, caller);
  return Response.json(result, { status: "error" in result ? 422 : 200 });
}
