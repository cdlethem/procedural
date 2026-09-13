import type { CandidateScope, StudioDocumentV3 } from "../studio-document";
import { readArtifactBytes, verifyArtifact } from "./store";

/** Exact immutable source and declarations accompany a follow-up, including current control overrides in the document. */
export function revisionSources(document: StudioDocumentV3, scope: CandidateScope, selectedLayerId: string | null) {
  if (scope === "add-layer") return [];
  return document.layers.flatMap((layer) => {
    if (layer.kind !== "source" || (scope === "edit-layer" && layer.id !== selectedLayerId)) return [];
    const manifest = verifyArtifact(layer.content.sourceArtifactHash);
    return [{
      layerId: layer.id,
      manifest,
      files: manifest.fileHashes.map((file) => ({ path: file.path, text: readArtifactBytes(manifest.contentHash, file.path).toString("utf8") })),
    }];
  });
}
