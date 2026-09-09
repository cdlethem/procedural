import { catalogDigest, STUDIO_BINDING, type DocumentLayer, type StudioDocumentV3 } from "./studio-document";

/** A transient, empty harness context for one independent exploration. */
export function createExplorationDocument(): StudioDocumentV3 {
  return {
    schemaVersion: 2,
    bindingVersion: STUDIO_BINDING,
    catalogSha256: catalogDigest(),
    width: 640,
    height: 640,
    background: "#f5f1e9",
    layers: [],
  };
}

export const sourceLayers = (document: StudioDocumentV3): Extract<DocumentLayer, { kind: "source" }>[] =>
  document.layers.filter((layer): layer is Extract<DocumentLayer, { kind: "source" }> => layer.kind === "source");
