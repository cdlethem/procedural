"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SketchCanvas from "./SketchCanvas";
import { canReseed } from "./LayerControls";
import { cutRegions, MAX_CUT_EDITS } from "@/lib/cut-model";
import { inverseTransformPoint } from "@/lib/layer-transform";
import type { Layer, StudioDocument } from "@/lib/studio-types";

export function InteractiveCanvas({
  document,
  layer,
  onChangeLayer,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onError,
  showHistory = true,
  transformsEnabled = false,
  renderOverride,
}: {
  document: StudioDocument;
  layer?: Layer;
  onChangeLayer: (change: Partial<Layer>) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onError?: (message: string | null) => void;
  showHistory?: boolean;
  transformsEnabled?: boolean;
  /**
   * A host-specific canvas for documents that include non-workflow layers. The
   * interaction model still receives the workflow projection above, while the
   * override draws the complete document in its owning adapter.
   */
  renderOverride?: (document: StudioDocument) => ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    transform: Layer["transform"];
    target: HTMLDivElement;
  } | null>(null);
  const [previewTransform, setPreviewTransform] = useState<
    Layer["transform"] | null
  >(null);
  const [selectedRegion, setSelectedRegion] = useState<number | null>(null);
  const [mode, setMode] = useState<"move" | "cut">("cut");
  const renderedLayer =
    layer && previewTransform
      ? { ...layer, transform: previewTransform }
      : layer;
  const renderedDocument =
    renderedLayer && previewTransform
      ? {
          ...document,
          layers: document.layers.map((item) =>
            item.id === renderedLayer.id ? renderedLayer : item,
          ),
        }
      : document;
  const cutActive =
    layer?.technique === "cut-marks" &&
    layer.visible &&
    layer.opacity > 0 &&
    mode === "cut";
  const regions = useMemo(
    () => (cutActive && layer ? cutRegions(layer) : []),
    [cutActive, layer],
  );
  const cancelDrag = () => {
    const activeDrag = drag.current;
    if (activeDrag?.target.hasPointerCapture(activeDrag.pointerId)) {
      activeDrag.target.releasePointerCapture(activeDrag.pointerId);
    }
    drag.current = null;
    setPreviewTransform(null);
  };
  useEffect(() => {
    cancelDrag();
    setSelectedRegion(null);
    setMode(layer?.technique === "cut-marks" ? "cut" : "move");
  }, [
    layer?.id,
    layer?.seed,
    layer?.params.cuts,
    layer?.params.spread,
    layer?.params.staggered,
  ]);
  useEffect(() => {
    if (!regions.some((region) => region.id === selectedRegion))
      setSelectedRegion(null);
  }, [regions, selectedRegion]);
  const region = regions.find((item) => item.id === selectedRegion);
  const edit = (axis: "X" | "Y") => {
    if (!layer || !region || layer.cutEdits.length >= MAX_CUT_EDITS) return;
    const [left, top, right, bottom] = region.bounds;
    onChangeLayer({
      cutEdits: [
        ...layer.cutEdits,
        {
          kind: "cut",
          id: region.id,
          axis,
          coordinate: axis === "X" ? (left + right) / 2 : (top + bottom) / 2,
        },
      ],
    });
    setSelectedRegion(null);
  };
  const remove = () => {
    if (!layer || !region || layer.cutEdits.length >= MAX_CUT_EDITS) return;
    onChangeLayer({
      cutEdits: [...layer.cutEdits, { kind: "remove", id: region.id }],
    });
    setSelectedRegion(null);
  };
  const reseed = () =>
    layer &&
    onChangeLayer({
      seed: Math.floor(Math.random() * 4294967296),
      ...(layer.technique === "cut-marks" ? { cutEdits: [] } : {}),
    });
  const pointAt = (event: { clientX: number; clientY: number }) => {
    const rect = host.current?.querySelector("canvas")?.getBoundingClientRect();
    if (!rect) return null;
    return [
      ((event.clientX - rect.left) * 640) / rect.width,
      ((event.clientY - rect.top) * 640) / rect.height,
    ] as [number, number];
  };
  return (
    <div
      ref={host}
      className="interactive-canvas"
      data-move-enabled={
        transformsEnabled &&
        Boolean(layer?.visible && layer.opacity > 0) &&
        mode === "move"
      }
      data-dragging={Boolean(previewTransform)}
      tabIndex={0}
      aria-label="Interactive canvas"
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        if (
          !(event.target instanceof Element) ||
          event.target.closest(".canvas-actions")
        )
          return;
        host.current?.focus();
        if (
          !transformsEnabled ||
          !layer ||
          !layer.visible ||
          layer.opacity <= 0 ||
          mode !== "move"
        )
          return;
        const point = pointAt(event);
        if (!point) return;
        drag.current = {
          pointerId: event.pointerId,
          x: point[0],
          y: point[1],
          transform: layer.transform,
          target: event.currentTarget,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        const point = pointAt(event);
        if (!point) return;
        setPreviewTransform({
          ...drag.current.transform,
          x: Math.max(
            -640,
            Math.min(
              1280,
              drag.current.transform.x + point[0] - drag.current.x,
            ),
          ),
          y: Math.max(
            -640,
            Math.min(
              1280,
              drag.current.transform.y + point[1] - drag.current.y,
            ),
          ),
        });
      }}
      onPointerUp={(event) => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        const point = pointAt(event);
        const start = drag.current;
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        if (!point) return setPreviewTransform(null);
        const transform = {
          ...start.transform,
          x: Math.max(
            -640,
            Math.min(1280, start.transform.x + point[0] - start.x),
          ),
          y: Math.max(
            -640,
            Math.min(1280, start.transform.y + point[1] - start.y),
          ),
        };
        if (
          transform.x !== start.transform.x ||
          transform.y !== start.transform.y
        ) {
          onChangeLayer({ transform });
        }
        setPreviewTransform(null);
      }}
      onPointerCancel={() => {
        cancelDrag();
      }}
      onKeyDown={(event) => {
        if (event.repeat || event.altKey) return;
        const target = event.target;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          (target instanceof HTMLElement && target.isContentEditable)
        )
          return;
        const key = event.key.toLowerCase();
        if (key === "z" && (event.metaKey || event.ctrlKey)) {
          cancelDrag();
          event.preventDefault();
          event.shiftKey ? onRedo() : onUndo();
          return;
        }
        if (key === "r") cancelDrag();
        if (
          !layer ||
          event.metaKey ||
          event.ctrlKey ||
          (event.shiftKey && key === "r")
        )
          return;
        if (key === "r" && canReseed(layer)) {
          event.preventDefault();
          reseed();
        } else if (key === "x") {
          event.preventDefault();
          edit("X");
        } else if (key === "y") {
          event.preventDefault();
          edit("Y");
        } else if (key === "delete" || key === "backspace") {
          event.preventDefault();
          remove();
        } else if (key === "escape") {
          event.preventDefault();
          cancelDrag();
          setSelectedRegion(null);
        }
      }}
    >
      {renderOverride?.(renderedDocument) ?? (
        <SketchCanvas document={renderedDocument} onError={onError} />
      )}
      {cutActive && (
        <svg
          className="cut-region-overlay"
          viewBox="0 0 640 640"
          aria-label="Cut regions"
          onClick={(event) => {
            const point = pointAt(event);
            if (!point || !layer) return;
            const [x, y] = inverseTransformPoint(
              point,
              renderedLayer!.transform,
            );
            const hit = regions.find(
              ({ bounds: [left, top, right, bottom] }) =>
                x >= left && x <= right && y >= top && y <= bottom,
            );
            setSelectedRegion(hit?.id ?? null);
          }}
        >
          <g
            transform={`translate(${renderedLayer!.transform.x} ${renderedLayer!.transform.y}) rotate(${renderedLayer!.transform.rotation}) scale(${renderedLayer!.transform.scale}) translate(-320 -320)`}
          >
            {regions.map(({ id, bounds: [left, top, right, bottom] }) => (
              <rect
                key={id}
                x={left}
                y={top}
                width={right - left}
                height={bottom - top}
                className={id === selectedRegion ? "selected" : ""}
                aria-label={`Select region ${id}`}
              />
            ))}
          </g>
        </svg>
      )}
      <div className="canvas-actions">
        {transformsEnabled &&
          layer?.visible &&
          layer.opacity > 0 &&
          mode === "move" && (
            <small>
              Drag the canvas to move the selected layer. Use Placement to
              resize or rotate it.
            </small>
          )}
        {layer && canReseed(layer) && (
          <button className="action secondary" type="button" onClick={reseed}>
            New seed
          </button>
        )}
        {transformsEnabled && layer?.technique === "cut-marks" && (
          <div
            className="canvas-mode"
            role="group"
            aria-label="CutMarks canvas mode"
          >
            <button
              className={`action secondary ${mode === "move" ? "active" : ""}`}
              type="button"
              onClick={() => {
                setMode("move");
                setSelectedRegion(null);
              }}
            >
              Move layer
            </button>
            <button
              className={`action secondary ${mode === "cut" ? "active" : ""}`}
              type="button"
              onClick={() => setMode("cut")}
            >
              Cut regions
            </button>
          </div>
        )}
        {cutActive && (
          <>
            <button
              className="action secondary"
              type="button"
              disabled={!region || layer!.cutEdits.length >= MAX_CUT_EDITS}
              onClick={() => edit("X")}
            >
              Cut X
            </button>
            <button
              className="action secondary"
              type="button"
              disabled={!region || layer!.cutEdits.length >= MAX_CUT_EDITS}
              onClick={() => edit("Y")}
            >
              Cut Y
            </button>
            <button
              className="action secondary"
              type="button"
              disabled={!region || layer!.cutEdits.length >= MAX_CUT_EDITS}
              onClick={remove}
            >
              Remove region
            </button>
            <small>
              Canvas keys: X cuts vertically, Y cuts horizontally, Delete
              removes, Escape deselects. Changing cut rounds, spread, or
              staggered rebuilds the base and clears manual cuts.
            </small>
          </>
        )}
        {layer && canReseed(layer) && (
          <small>
            Focus the canvas, then press R for a new seed. Ctrl/⌘ Z undoes
            canvas edits.
          </small>
        )}
        {showHistory && (
          <>
            <button
              className="action secondary"
              type="button"
              disabled={!canUndo}
              onClick={onUndo}
            >
              Undo
            </button>
            <button
              className="action secondary"
              type="button"
              disabled={!canRedo}
              onClick={onRedo}
            >
              Redo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
