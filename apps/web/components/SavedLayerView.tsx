"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchSavedLayer, type SavedLayer } from "@/lib/saved-layers";
import { HarnessCanvas } from "./HarnessCanvas";
import { SourceArtifactPanel } from "./SourceArtifactPanel";
export function SavedLayerView({ id }: { id: string }) {
  const [saved, setSaved] = useState<SavedLayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetchSavedLayer(id).then((value) => { if (active) setSaved(value); }).catch((cause) => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [id]);
  const layer = saved?.document.layers[0];
  return <main><p className="eyebrow"><Link href="/">Gallery</Link> / Saved layers</p><h1>{saved?.title ?? "Saved layer"}</h1>
    {error && <p className="service-error" role="alert">{error}</p>}
    {saved && layer?.kind === "source" ? <>
      <p>{saved.description}</p><p><Link className="action" href={`/studio?savedLayer=${saved.id}`}>Add to studio</Link></p>
      <p className="control-description">Adds a copy to your current sketch. Its controls and source can be revised in Studio.</p>
      <HarnessCanvas document={saved.document} onError={setError} />
      <SourceArtifactPanel layer={layer} className="source-panel" />
    </> : !error && <p>Loading saved layer…</p>}
  </main>;
}
