"use client";
import { useState } from "react";
import type { DocumentLayer, StudioDocumentV3 } from "@/lib/studio-document";

export function SaveLayerPanel({ layer, document, description = "", disabled = false }: {
  layer: Extract<DocumentLayer, { kind: "source" }>;
  document: StudioDocumentV3;
  description?: string;
  disabled?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (busy || disabled || !title.trim()) return;
    setBusy(true); setError(null); setSaved(null);
    try {
      const response = await fetch("/harness/layers", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description, document: { ...document, layers: [layer] } }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save layer.");
      setSaved(body.layer.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };
  return <section className="save-layer-panel" aria-label="Save generated layer">
    <h3>Keep this layer</h3>
    <p className="control-description">Save a copy to reuse in other sketches from the gallery or Add layer.</p>
    <label className="control">Layer name<input aria-label="Layer name" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Coral sun" disabled={busy} /></label>
    <button className="action secondary" type="button" onClick={() => void save()} disabled={busy || disabled || !title.trim() || !layer.content.previewArtifactHash}>{busy ? "Saving…" : "Save layer to gallery"}</button>
    {disabled && <p className="control-description">Finish the pending edit before saving this layer.</p>}
    {saved && <p role="status">Layer saved. <a href={`/layers/${saved}`}>View saved layer</a></p>}
    {error && <p className="service-error" role="alert">{error}</p>}
  </section>;
}
