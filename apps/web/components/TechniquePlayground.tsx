"use client";

import { useState } from "react";
import SketchCanvas from "./SketchCanvas";
import { LayerControls } from "./LayerControls";
import { createDocument, techniques, validateDocument } from "@/lib/studio";
import type { Layer, TechniqueId } from "@/lib/studio-types";

/** The same renderer and controls used by an isolated gallery study and Studio. */
export function TechniquePlayground({ techniqueId }: { techniqueId: string }) {
  const [document, setDocument] = useState(() => createDocument(techniqueId as TechniqueId));
  const [error, setError] = useState<string | null>(null);
  const layer = document.layers[0];
  const technique = techniques.find((item) => item.id === layer?.technique);
  if (!layer || !technique) return null;
  const change = (change: Partial<Layer>) => {
    try {
      setDocument(validateDocument({
        ...document,
        layers: [{ ...layer, ...change, params: change.params ?? layer.params }],
      }));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return (
    <section className="technique-playground" aria-label={`${technique.title} playground`}>
      <div className="playground-canvas canvas-wrap">
        <SketchCanvas document={document} onError={setError} />
        {error && <p className="service-error" role="alert">{error}</p>}
      </div>
      <aside className="playground-controls">
        <h2>Controls</h2>
        <LayerControls layer={layer} technique={technique} onChange={change} />
      </aside>
    </section>
  );
}
