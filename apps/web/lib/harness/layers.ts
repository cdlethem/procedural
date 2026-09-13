import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { validateStudioDocument } from "../studio-document";
import type { SavedLayer } from "../saved-layers";
import { WORK_ROOT } from "./core";
import { checkControls, renderInputsHash } from "./candidates";
import { verifyArtifact } from "./store";

export const SAVED_LAYER_ROOT = join(WORK_ROOT, "saved-layers");
const validId = /^saved-[0-9a-f-]{36}$/;

/** Storage validates bytes and replay identity without executing generated source. */
export function validateSavedLayerDocument(input: unknown) {
  const document = validateStudioDocument(input);
  if (document.layers.length !== 1 || document.layers[0].kind !== "source") throw new Error("Save exactly one generated layer.");
  const layer = document.layers[0];
  const source = verifyArtifact(layer.content.sourceArtifactHash);
  if (source.kind !== "source" || source.language !== layer.content.language || source.entrypoint !== layer.content.entrypoint)
    throw new Error("The saved layer does not match its source artifact.");
  checkControls(source, layer.content.controls, layer.id);
  if (!layer.content.previewArtifactHash) throw new Error("Render the layer before saving it.");
  const preview = verifyArtifact(layer.content.previewArtifactHash);
  if (preview.kind !== "image" || preview.inputsHash !== renderInputsHash(layer.content))
    throw new Error("The layer preview is stale. Render the layer before saving it.");
  return document;
}
export function saveLayer(input: unknown): SavedLayer {
  if (!input || typeof input !== "object") throw new Error("A saved layer must be an object.");
  const value = input as Record<string, unknown>;
  if (typeof value.title !== "string" || !value.title.trim() || value.title.trim().length > 120) throw new Error("Name the layer using 1–120 characters.");
  if (typeof value.description !== "string" || value.description.length > 4000) throw new Error("Description must be text of at most 4000 characters.");
  const record: SavedLayer = {
    schemaVersion: 1, id: `saved-${randomUUID()}`, title: value.title.trim(), description: value.description.trim(),
    createdAt: new Date().toISOString(), document: validateSavedLayerDocument(value.document),
  };
  mkdirSync(SAVED_LAYER_ROOT, { recursive: true });
  const path = join(SAVED_LAYER_ROOT, `${record.id}.json`), temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`);
  renameSync(temporary, path);
  return record;
}
export function readSavedLayer(id: string): SavedLayer {
  if (!validId.test(id)) throw new Error("Unknown saved layer.");
  const path = join(SAVED_LAYER_ROOT, `${id}.json`);
  if (!existsSync(path)) throw new Error("Unknown saved layer.");
  const record = JSON.parse(readFileSync(path, "utf8")) as SavedLayer;
  return { ...record, document: validateSavedLayerDocument(record.document) };
}
export function listSavedLayers(): SavedLayer[] {
  if (!existsSync(SAVED_LAYER_ROOT)) return [];
  return readdirSync(SAVED_LAYER_ROOT).filter((name) => name.endsWith(".json") && validId.test(name.slice(0, -5)))
    .map((name) => readSavedLayer(name.slice(0, -5)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
