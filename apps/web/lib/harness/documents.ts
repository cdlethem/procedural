/**
 * Document context handles. A handle is an opaque, scoped id for one editable document
 * revision; clients never supply filesystem paths. The owning session publishes its live
 * revision, and applying a candidate advances the handle in one transaction with the
 * undo document retained.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { documentHash, ensureDirectories, fail, WORK_ROOT } from "./core";
import { validateStudioDocument } from "../studio-document";
import type { StudioDocumentV3 } from "../studio-document";

export type DocumentContext = {
  handle: string;
  revisionHash: string;
  document: StudioDocumentV3;
  updatedAt: string;
  owner: "web-session" | "mcp-client";
  history: { revisionHash: string; at: string; candidateId: string | null }[];
};
const CONTEXT_ROOT = join(WORK_ROOT, "documents");
const contextPath = (handle: string): string => join(CONTEXT_ROOT, `${handle}.json`);

export function publishContext(
  document: unknown,
  owner: DocumentContext["owner"],
  handle?: string,
): DocumentContext {
  const validated = validateStudioDocument(document),
    id = handle ?? `doc-${randomUUID()}`;
  if (!/^doc-[0-9a-f-]{36}$/.test(id))
    fail("request", "UNKNOWN_HANDLE", `Unusable document handle: ${id}`);
  const previous = existsSync(contextPath(id)) ? loadContext(id) : null,
    revisionHash = documentHash(validated);
  return saveContext({
    handle: id,
    revisionHash,
    document: validated,
    updatedAt: new Date().toISOString(),
    owner,
    history:
      previous && previous.revisionHash === revisionHash
        ? previous.history
        : [
            ...(previous?.history ?? []),
            { revisionHash, at: new Date().toISOString(), candidateId: null },
          ].slice(-64),
  });
}
export function saveContext(context: DocumentContext): DocumentContext {
  ensureDirectories();
  mkdirSync(CONTEXT_ROOT, { recursive: true });
  const path = contextPath(context.handle),
    temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(context, null, 2)}\n`);
  renameSync(temporary, path);
  return context;
}
export function loadContext(handle: string): DocumentContext {
  if (!/^doc-[0-9a-f-]{36}$/.test(handle))
    fail("request", "UNKNOWN_HANDLE", `Unusable document handle: ${handle}`);
  const path = contextPath(handle);
  if (!existsSync(path)) fail("request", "UNKNOWN_HANDLE", `Unknown document handle: ${handle}`);
  return JSON.parse(readFileSync(path, "utf8")) as DocumentContext;
}
export const knownContexts = (): string[] =>
  existsSync(CONTEXT_ROOT)
    ? readdirSync(CONTEXT_ROOT)
        .filter((name) => name.endsWith(".json"))
        .map((name) => name.slice(0, -5))
    : [];
/** Advances a handle to an applied revision, recording the candidate that produced it. */
export function commitRevision(
  handle: string,
  document: StudioDocumentV3,
  candidateId: string,
): DocumentContext {
  const context = loadContext(handle),
    revisionHash = documentHash(document);
  return saveContext({
    ...context,
    document,
    revisionHash,
    updatedAt: new Date().toISOString(),
    history: [...context.history, { revisionHash, at: new Date().toISOString(), candidateId }].slice(-64),
  });
}
