/**
 * MCP is deliberately only a transport adapter: all validation, authority and
 * budget semantics live in the shared harness tool handlers.
 */
import { createInterface } from "node:readline";
import { callTool, TOOL_NAMES, toolSchemas } from "../lib/harness/tools";
import type { Caller } from "../lib/harness/tools";
import type { CandidateScope } from "../lib/studio-document";

type JsonRpcId = string | number | null;
type JsonRpcRequest = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};
type JsonSchema = Record<string, unknown>;
type PropertySchemas = Record<string, JsonSchema>;

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_VERSION = "0.1.0";
const APPLY_SCOPE_NAMES: CandidateScope[] = ["add-layer", "edit-layer", "composition"];
const applyScopes = parseApplyScopes(process.env.PROCEDURALS_MCP_APPLY_SCOPES ?? "");
const caller: Caller = { origin: "mcp-client", applyScopes };

function parseApplyScopes(value: string): CandidateScope[] {
  const scopes = value
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  const invalid = scopes.filter((scope) => !APPLY_SCOPE_NAMES.includes(scope as CandidateScope));
  if (invalid.length)
    throw new Error(`Invalid PROCEDURALS_MCP_APPLY_SCOPES value: ${invalid.join(", ")}`);
  return [...new Set(scopes as CandidateScope[])];
}

/** Read top-level keys from the frozen, human-readable argument notation. */
function argumentSpec(text: string): { keys: string[]; required: string[] } {
  const keys: string[] = [],
    required: string[] = [];
  let objectDepth = 0,
    arrayDepth = 0,
    index = 0;
  while (index < text.length) {
    if (text[index] !== '"') {
      if (text[index] === "{") objectDepth++;
      if (text[index] === "}") objectDepth--;
      if (text[index] === "[") arrayDepth++;
      if (text[index] === "]") arrayDepth--;
      index++;
      continue;
    }
    const start = ++index;
    while (index < text.length) {
      if (text[index] === "\\") {
        index += 2;
        continue;
      }
      if (text[index] === '"') break;
      index++;
    }
    const key = text.slice(start, index);
    index++;
    let next = index;
    while (/\s/.test(text[next] ?? "")) next++;
    if (objectDepth === 1 && arrayDepth === 0 && (text[next] === ":" || text[next] === "?")) {
      keys.push(key);
      if (text[next] === ":") required.push(key);
    }
  }
  return { keys, required };
}

const object = (properties: PropertySchemas, required: string[] = []): JsonSchema => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
});
const string = (): JsonSchema => ({ type: "string" });
const integer = (minimum?: number, maximum?: number): JsonSchema => ({
  type: "integer",
  ...(minimum === undefined ? {} : { minimum }),
  ...(maximum === undefined ? {} : { maximum }),
});
const enumString = (values: string[]): JsonSchema => ({ type: "string", enum: values });
const arrayOfStrings = (): JsonSchema => ({ type: "array", items: string() });
const studioDocument = (): JsonSchema => ({
  type: "object",
  description: "studio-v3 document envelope",
  properties: {
    schemaVersion: { const: 2 },
    bindingVersion: { const: "studio-v3" },
    catalogSha256: string(),
    width: { const: 640 },
    height: { const: 640 },
    background: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    layers: { type: "array", minItems: 1, items: { type: "object" } },
  },
  required: ["schemaVersion", "bindingVersion", "catalogSha256", "width", "height", "background", "layers"],
});
const control = (): JsonSchema =>
  object(
    {
      key: string(),
      label: string(),
      description: string(),
      type: enumString(["number", "boolean", "select"]),
      min: { type: "number" },
      max: { type: "number" },
      step: { type: "number" },
      options: arrayOfStrings(),
      value: { type: ["number", "boolean", "string"] },
    },
    ["key", "label", "description", "type", "value"],
  );
const sourcePayload = (): JsonSchema =>
  object(
    {
      layerId: string(),
      language: enumString(["p5js", "processing-java"]),
      entrypoint: string(),
      files: { type: "array", items: object({ path: string(), text: string() }, ["path", "text"]) },
      controls: { type: "array", items: control() },
      operationIds: arrayOfStrings(),
      customAlgorithms: arrayOfStrings(),
      licenseReferences: arrayOfStrings(),
    },
    ["layerId", "language", "entrypoint", "files", "controls"],
  );

const DETAILS: Record<string, PropertySchemas> = {
  "studio.context": {
    documentHandle: string(),
    selectedLayerId: string(),
  },
  "catalog.search": {
    visualTask: string(),
    target: enumString(["p5js", "processing-java", "any"]),
    cursor: integer(0, 4096),
    limit: integer(1, 24),
  },
  "catalog.describe": { handles: arrayOfStrings(), snapshotHash: string() },
  "reference.lookup": {
    runtime: enumString(["p5js", "processing-java"]),
    query: string(),
    limit: integer(1, 40),
  },
  "candidate.create": {
    documentHandle: string(),
    scope: enumString(["add-layer", "edit-layer", "composition"]),
    selectedLayerId: string(),
    document: studioDocument(),
    sourcePayloads: { type: "array", items: sourcePayload() },
    intentPredicates: arrayOfStrings(),
    assumptions: arrayOfStrings(),
    runId: string(),
  },
  "candidate.validate": { candidateId: string(), profiles: arrayOfStrings() },
  "render.submit": {
    candidateId: string(),
    layerId: string(),
    frameContext: object({ tick: integer(1) }, ["tick"]),
    runId: string(),
  },
  "render.status": { jobId: string() },
  "render.cancel": { jobId: string() },
  "artifact.read": { hash: string(), path: string() },
  "candidate.apply": {
    candidateId: string(),
    documentHandle: string(),
    currentBaseHash: string(),
    idempotencyKey: string(),
  },
  "project.export": {
    documentHandle: string(),
    revisionHash: string(),
    candidateId: string(),
    format: enumString(["document-json", "p5-standalone-html", "processing-java-tabs", "studio-bundle"]),
  },
};

function buildToolDefinitions(): Array<{ name: string; description: string; inputSchema: JsonSchema }> {
  const docs = toolSchemas();
  const docNames = docs.map((tool) => tool.name);
  if (docNames.length !== TOOL_NAMES.length || docNames.some((name, index) => name !== TOOL_NAMES[index]))
    throw new Error("MCP tool schema names diverge from the harness tool names");
  const detailNames = Object.keys(DETAILS);
  if (detailNames.length !== docNames.length || docNames.some((name) => !detailNames.includes(name)))
    throw new Error("MCP hand-written schemas diverge from the harness tool names");
  return docs.map((doc) => {
    const spec = argumentSpec(doc.arguments);
    const details = DETAILS[doc.name];
    const detailKeys = Object.keys(details);
    if (detailKeys.length !== spec.keys.length || spec.keys.some((key) => !detailKeys.includes(key)))
      throw new Error(`MCP argument schema diverges for ${doc.name}`);
    return {
      name: doc.name,
      description: doc.description,
      inputSchema: object(Object.fromEntries(spec.keys.map((key) => [key, details[key]])), spec.required),
    };
  });
}
const TOOL_DEFINITIONS = buildToolDefinitions();

const renderRequestJobs = new Map<string, string>();
const pendingCancellations = new Set<string>();
const inFlight = new Set<string>();
const requestKey = (id: JsonRpcId): string => `${typeof id}:${String(id)}`;
const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isId = (value: unknown): value is JsonRpcId => value === null || typeof value === "string" || typeof value === "number";

function reply(id: JsonRpcId, result: unknown): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}
function errorReply(id: JsonRpcId, code: number, message: string): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}
function requireParams(request: JsonRpcRequest): Record<string, unknown> | null {
  if (request.params === undefined) return {};
  return isObject(request.params) ? request.params : null;
}

async function callHarness(id: JsonRpcId, params: Record<string, unknown>): Promise<void> {
  const key = requestKey(id);
  inFlight.add(key);
  try {
    const name = params.name;
    if (typeof name !== "string") {
      errorReply(id, -32602, "tools/call params.name must be a string");
      return;
    }
    const args = params.arguments === undefined ? {} : params.arguments;
    if (!isObject(args)) {
      errorReply(id, -32602, "tools/call params.arguments must be an object");
      return;
    }
    const result = await callTool(name, args, caller);
    if (name === "render.submit" && result.ok && typeof result.jobId === "string") {
      renderRequestJobs.set(key, result.jobId);
      if (pendingCancellations.delete(key)) {
        await callTool("render.cancel", { jobId: result.jobId }, caller);
        renderRequestJobs.delete(key);
      }
    }
    reply(id, {
      content: [{ type: "text", text: JSON.stringify(result) }],
      ...(result.ok ? {} : { isError: true }),
    });
  } catch (error) {
    errorReply(id, -32602, error instanceof Error ? error.message : String(error));
  } finally {
    inFlight.delete(key);
    if (!renderRequestJobs.has(key)) pendingCancellations.delete(key);
  }
}

async function handleRequest(raw: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    errorReply(null, -32700, "Parse error");
    return;
  }
  if (!isObject(parsed)) {
    errorReply(null, -32700, "Malformed JSON-RPC frame");
    return;
  }
  const request = parsed as JsonRpcRequest;
  const hasId = Object.prototype.hasOwnProperty.call(request, "id");
  const id = hasId && isId(request.id) ? request.id : null;
  if (hasId && !isId(request.id)) {
    errorReply(null, -32602, "JSON-RPC id must be a string, number or null");
    return;
  }
  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    errorReply(id, -32602, "A JSON-RPC 2.0 method is required");
    return;
  }
  const params = requireParams(request);
  if (!params) {
    errorReply(id, -32602, "JSON-RPC params must be an object");
    return;
  }
  if (request.method === "notifications/initialized") return;
  if (request.method === "notifications/cancelled") {
    const cancelled = params.requestId;
    if (!isId(cancelled)) {
      errorReply(id, -32602, "notifications/cancelled requestId must be a JSON-RPC id");
      return;
    }
    const key = requestKey(cancelled);
    const jobId = renderRequestJobs.get(key);
    if (jobId) {
      await callTool("render.cancel", { jobId }, caller);
      renderRequestJobs.delete(key);
    } else if (inFlight.has(key)) pendingCancellations.add(key);
    return;
  }
  if (request.method === "ping") {
    reply(id, {});
    return;
  }
  if (request.method === "initialize") {
    reply(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "procedurals-prompt-studio-harness", version: SERVER_VERSION },
      instructions:
        "This server exposes the frozen studio-v3 envelope (schemaVersion 2, bindingVersion studio-v3). MCP is transport only; there is no second planner behind a tool.",
    });
    return;
  }
  if (request.method === "tools/list") {
    reply(id, { tools: TOOL_DEFINITIONS });
    return;
  }
  if (request.method === "tools/call") {
    void callHarness(id, params);
    return;
  }
  errorReply(id, -32601, `Unknown method: ${request.method}`);
}

async function main(): Promise<void> {
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    if (line.trim() === "") continue;
    void handleRequest(line).catch((error) => errorReply(null, -32602, String(error)));
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
