import { MAX_LAYERS } from "./studio";
import { validateStudioDocument, type StudioDocumentV3 } from "./studio-document";

export type SavedLayer = {
  schemaVersion: 1;
  id: string;
  title: string;
  description: string;
  createdAt: string;
  document: StudioDocumentV3;
};

/** Each insertion owns its controls and a fresh id; immutable artifacts remain shared. */
export function insertSavedLayer(document: StudioDocumentV3, saved: SavedLayer, id: string): StudioDocumentV3 {
  if (document.layers.length >= MAX_LAYERS) throw new Error(`A document can contain up to ${MAX_LAYERS} layers.`);
  const source = validateStudioDocument(saved.document).layers;
  if (source.length !== 1 || source[0].kind !== "source") throw new Error("Saved layers must contain one generated layer.");
  return validateStudioDocument({ ...document, layers: [...document.layers, { ...structuredClone(source[0]), id }] });
}

export async function fetchSavedLayers(): Promise<SavedLayer[]> {
  const response = await fetch("/harness/layers", { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Could not load saved layers.");
  return body.layers;
}
export async function fetchSavedLayer(id: string): Promise<SavedLayer> {
  const response = await fetch(`/harness/layers?id=${encodeURIComponent(id)}`, { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Could not load saved layer.");
  return body.layer;
}
