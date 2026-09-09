import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import test from "node:test";
import { createDocumentV3, P5_RUNNER_PROFILE } from "../lib/studio-document.ts";
import type { StudioDocumentV3 } from "../lib/studio-document.ts";

const ROOT = new URL("..", import.meta.url);
type Frame = Record<string, unknown>;

class McpClient {
  readonly child: ChildProcessWithoutNullStreams;
  private readonly frames: Frame[] = [];
  private readonly waiters: ((frame: Frame) => void)[] = [];
  private output = "";

  constructor(env: Record<string, string> = {}) {
    this.child = spawn("npx", ["tsx", "scripts/mcp-server.ts"], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdout.on("data", (chunk: Buffer) => {
      this.output += chunk.toString();
      for (;;) {
        const newline = this.output.indexOf("\n");
        if (newline < 0) break;
        const line = this.output.slice(0, newline).trim();
        this.output = this.output.slice(newline + 1);
        if (!line) continue;
        const frame = JSON.parse(line) as Frame;
        const waiter = this.waiters.shift();
        if (waiter) waiter(frame);
        else this.frames.push(frame);
      }
    });
  }

  send(frame: Frame): Promise<Frame> {
    this.child.stdin.write(`${JSON.stringify(frame)}\n`);
    const existing = this.frames.shift();
    if (existing) return Promise.resolve(existing);
    const { promise, resolve } = Promise.withResolvers<Frame>();
    this.waiters.push(resolve);
    return promise;
  }

  notify(frame: Frame): void {
    this.child.stdin.write(`${JSON.stringify(frame)}\n`);
  }

  raw(line: string): Promise<Frame> {
    this.child.stdin.write(`${line}\n`);
    const existing = this.frames.shift();
    if (existing) return Promise.resolve(existing);
    const { promise, resolve } = Promise.withResolvers<Frame>();
    this.waiters.push(resolve);
    return promise;
  }

  async close(): Promise<void> {
    this.child.stdin.end();
    const { promise, resolve } = Promise.withResolvers<void>();
    if (this.child.exitCode !== null) resolve();
    else this.child.once("exit", () => resolve());
    await promise;
  }
}
async function handshake(client: McpClient): Promise<Frame> {
  const initialized = await client.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.equal(initialized.result && (initialized.result as Frame).protocolVersion, "2025-06-18");
  assert.deepEqual((initialized.result as Frame).capabilities, { tools: {} });
  assert.match(String((initialized.result as Frame).instructions), /studio-v3/);
  assert.match(String((initialized.result as Frame).instructions), /transport only/);
  client.notify({ jsonrpc: "2.0", method: "notifications/initialized" });
  return client.send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
}

function toolResult(frame: Frame): Frame {
  const result = frame.result as Frame;
  const content = result.content as Array<Frame>;
  assert.equal(content.length, 1);
  assert.equal(content[0].type, "text");
  return JSON.parse(String(content[0].text)) as Frame;
}

async function call(client: McpClient, id: number, name: string, args: Record<string, unknown>): Promise<Frame> {
  return toolResult(await client.send({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  }));
}

type SourceFixture = { baseDocument: StudioDocumentV3; document: StudioDocumentV3; layerId: string; payload: Frame };
function sourceDocument(): SourceFixture {
  const baseDocument = createDocumentV3("field-marks"),
    base = baseDocument,
    layerId = `mcp-layer-${randomUUID()}`;
  const document: StudioDocumentV3 = {
    ...base,
    layers: [
      ...base.layers,
      {
        id: layerId,
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
          controls: {},
        },
      },
    ],
  };
  const payload: Frame = {
    layerId,
    language: "p5js",
    entrypoint: "Layer.js",
    files: [{ path: "Layer.js", text: "export function render(p, context) { while (true) {} }\n" }],
    controls: [],
    operationIds: [],
    customAlgorithms: [],
    licenseReferences: [],
  };
  return { baseDocument, document, layerId, payload };
}

test("MCP handshake, derived tools and discovery calls use real stdio", async () => {
  const client = new McpClient();
  try {
    const listed = await handshake(client),
      tools = (listed.result as Frame).tools as Array<Frame>,
      names = tools.map((tool) => tool.name);
    assert.deepEqual(names, [
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
    ]);
    for (const tool of tools) {
      assert.equal((tool.inputSchema as Frame).type, "object");
      assert.ok((tool.inputSchema as Frame).properties);
    }

    const search = await call(client, 3, "catalog.search", { visualTask: "grid marks", target: "p5js" });
    assert.equal(search.ok, true);
    assert.match(String(search.requestId), /./);
    assert.match(String(search.snapshotHash), /^[a-f0-9]{64}$/);
    const hits = search.hits as Array<Frame>;
    assert.ok(hits.length > 0);
    assert.ok(hits.every((hit, index) => index === 0 || Number(hit.score) <= Number(hits[index - 1].score)));

    const described = await call(client, 4, "catalog.describe", { handles: ["layout.regular-grid"] });
    assert.equal(described.ok, true);
    const operation = (described.operations as Array<Frame>)[0];
    assert.equal(operation.id, "layout.regular-grid");
    assert.ok(operation.input);
    assert.ok(operation.output);
    assert.ok((operation.javascript as Frame).signature);

    const reference = await call(client, 5, "reference.lookup", { runtime: "p5js", query: "random", limit: 3 });
    assert.equal(reference.ok, true);
    assert.equal(reference.version, JSON.parse(readFileSync(new URL("./node_modules/p5/package.json", ROOT), "utf8")).version);
    assert.ok((reference.entries as Array<Frame>).length > 0);
  } finally {
    await client.close();
  }
});

test("MCP authority is explicit and cancellation records a real render job", async () => {
  const denied = new McpClient();
  let context: Frame, candidate: Frame, fixture: SourceFixture;
  try {
    await handshake(denied);
    fixture = sourceDocument();
    assert.equal(fixture.document.layers.length, 2);
    context = await call(denied, 10, "studio.context", { document: fixture.baseDocument });
    assert.equal(context.ok, true, JSON.stringify(context));
    assert.equal((context.document as Frame).layers && ((context.document as Frame).layers as Array<unknown>).length, 1);
    candidate = await call(denied, 11, "candidate.create", {
      documentHandle: context.documentHandle,
      scope: "add-layer",
      document: fixture.document,
      sourcePayloads: [fixture.payload],
    });
    assert.equal(candidate.ok, true, JSON.stringify(candidate));
    const refused = await call(denied, 12, "candidate.apply", {
      candidateId: candidate.candidateId,
      documentHandle: context.documentHandle,
      currentBaseHash: context.revisionHash,
      idempotencyKey: randomUUID(),
    });
    assert.equal(refused.ok, false);
    assert.equal((refused.error as Frame).code, "NOT_AUTHORIZED");
  } finally {
    await denied.close();
  }

  const allowed = new McpClient({ PROCEDURALS_MCP_APPLY_SCOPES: "add-layer" });
  try {
    await handshake(allowed);
    const applied = await call(allowed, 13, "candidate.apply", {
      candidateId: candidate!.candidateId,
      documentHandle: context!.documentHandle,
      currentBaseHash: context!.revisionHash,
      idempotencyKey: randomUUID(),
    });
    assert.ok(applied.ok || (applied.error as Frame).code !== "NOT_AUTHORIZED");

    const submitted = await call(allowed, 14, "render.submit", {
      candidateId: candidate!.candidateId,
      layerId: fixture!.layerId,
      frameContext: { tick: 1 },
    });
    if (!submitted.ok) {
      assert.ok(["UNSUPPORTED_CAPABILITY", "RESOURCE_EXHAUSTED"].includes(String((submitted.error as Frame).code)));
      return;
    }
    const jobId = String(submitted.jobId);
    allowed.notify({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 14 } });
    let status: Frame = {};
    for (let attempt = 0; attempt < 30; attempt++) {
      // Polling observes the asynchronously supervised real render job; fake time cannot drive its child process.
      await new Promise((resolve) => setTimeout(resolve, 100));
      status = await call(allowed, 100 + attempt, "render.status", { jobId });
      if (status.state === "cancelled" || status.state === "succeeded" || status.state === "failed") break;
    }
    assert.equal(status.state, "cancelled");
    assert.equal(status.imageHandle, null);
  } finally {
    await allowed.close();
  }
});

test("MCP reports protocol errors and remains alive", async () => {
  const client = new McpClient();
  try {
    const parse = await client.raw("not-json");
    assert.equal((parse.error as Frame).code, -32700);
    const unknown = await client.send({ jsonrpc: "2.0", id: 21, method: "no.such.method", params: {} });
    assert.equal((unknown.error as Frame).code, -32601);
    const badParams = await client.send({ jsonrpc: "2.0", id: 22, method: "tools/list", params: [] });
    assert.equal((badParams.error as Frame).code, -32602);
    const unknownTool = await call(client, 23, "does.not.exist", {});
    assert.equal(unknownTool.ok, false);
    assert.equal((unknownTool.error as Frame).code, "UNKNOWN_TOOL");
    const ping = await client.send({ jsonrpc: "2.0", id: 24, method: "ping", params: {} });
    assert.deepEqual(ping.result, {});
  } finally {
    await client.close();
  }
});
