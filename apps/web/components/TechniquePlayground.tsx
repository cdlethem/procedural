"use client";

import { useReducer, useState } from "react";
import { InteractiveCanvas } from "./InteractiveCanvas";
import { LayerControls } from "./LayerControls";
import { createDocument, techniques, validateDocument } from "@/lib/studio";
import type { Layer, TechniqueId } from "@/lib/studio-types";

/** The same renderer and controls used by an isolated gallery study and Studio. */
export function TechniquePlayground({ techniqueId }: { techniqueId: string }) {
  type History = {
    document: ReturnType<typeof createDocument>;
    past: ReturnType<typeof createDocument>[];
    future: ReturnType<typeof createDocument>[];
  };
  const [history, dispatch] = useReducer(
    (
      state: History,
      action:
        | { type: "commit"; document: ReturnType<typeof createDocument> }
        | { type: "undo" }
        | { type: "redo" },
    ) => {
      if (action.type === "commit")
        return {
          document: action.document,
          past: [...state.past.slice(-29), state.document],
          future: [],
        };
      if (action.type === "undo" && state.past.length)
        return {
          document: state.past.at(-1)!,
          past: state.past.slice(0, -1),
          future: [state.document, ...state.future].slice(0, 30),
        };
      if (action.type === "redo" && state.future.length)
        return {
          document: state.future[0],
          past: [...state.past.slice(-29), state.document],
          future: state.future.slice(1),
        };
      return state;
    },
    techniqueId as TechniqueId,
    (id): History => ({ document: createDocument(id), past: [], future: [] }),
  );
  const document = history.document;
  const [error, setError] = useState<string | null>(null);
  const layer = document.layers[0];
  const technique = techniques.find((item) => item.id === layer?.technique);
  if (!layer || !technique) return null;
  const change = (change: Partial<Layer>) => {
    try {
      const params = change.params ?? layer.params;
      const clearsEdits =
        layer.technique === "cut-marks" &&
        ((change.seed !== undefined && change.seed !== layer.seed) ||
          ["cuts", "spread", "staggered"].some(
            (key) => params[key] !== layer.params[key],
          ));
      const next = validateDocument({
        ...document,
        layers: [
          {
            ...layer,
            ...change,
            params,
            cutEdits: clearsEdits ? [] : (change.cutEdits ?? layer.cutEdits),
          },
        ],
      });
      dispatch({ type: "commit", document: next });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return (
    <section
      className="technique-playground"
      aria-label={`${technique.title} playground`}
    >
      <div className="playground-canvas canvas-wrap">
        <InteractiveCanvas
          document={document}
          layer={layer}
          onChangeLayer={change}
          onUndo={() => dispatch({ type: "undo" })}
          onRedo={() => dispatch({ type: "redo" })}
          canUndo={history.past.length > 0}
          canRedo={history.future.length > 0}
          onError={setError}
        />
        {error && (
          <p className="service-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <aside className="playground-controls">
        <h2>Controls</h2>
        <LayerControls layer={layer} technique={technique} onChange={change} />
      </aside>
    </section>
  );
}
