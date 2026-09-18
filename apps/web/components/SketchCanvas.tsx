"use client";

import { useEffect, useRef, useState } from "react";
import { renderStudio } from "../lib/render-studio";
import {
  externalDynamicsPreparable,
  prepareExternalDynamics,
} from "../lib/adapters/external-dynamics";
import type { StudioDocument } from "../lib/studio-types";

/**
 * Renders a studio document with p5 in noLoop mode. Documents whose layers carry
 * slow replayed models (external dynamics) are prepared cooperatively before the
 * draw: the step work runs across macrotasks, the last successful image stays on
 * the canvas, and a newer document cancels the in-flight preparation between steps.
 * The synchronous draw then reads warm caches and publishes only on success.
 */
export default function SketchCanvas({
  document,
  className,
  onError,
}: {
  document: StudioDocument;
  className?: string;
  onError?: (message: string | null) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const instance = useRef<any>(null);
  const documentRef = useRef(document);
  const errorRef = useRef(onError);
  const disposed = useRef(false);
  const scheduled = useRef(0);
  const drawn = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [revision, setRevision] = useState(0);
  documentRef.current = document;
  errorRef.current = onError;

  const report = (message: string | null) => {
    if (disposed.current) return;
    setError(message);
    setStatus(message ? "error" : "ready");
    errorRef.current?.(message);
  };

  /** Prepares slow models, then draws. A newer scheduled render cancels this one. */
  const scheduleRender = (doc: StudioDocument) => {
    scheduled.current += 1;
    const version = scheduled.current;
    setStatus("loading");
    void (async () => {
      try {
        for (const layer of doc.layers) {
          if (
            !externalDynamicsPreparable.has(layer.technique) ||
            !layer.visible ||
            layer.opacity === 0
          )
            continue;
          if (version !== scheduled.current) return;
          await prepareExternalDynamics(layer, () => version !== scheduled.current);
        }
        if (version !== scheduled.current || !instance.current) return;
        instance.current.redraw();
      } catch (cause) {
        if (version !== scheduled.current) return;
        report(
          `Could not draw: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
    })();
  };

  useEffect(() => {
    let cancelled = false;
    let created: any = null;
    void (async () => {
      try {
        // p5 is browser-only (canvas, window); a static import would pull it into
        // the server module graph during SSR, so the load stays dynamic.
        const module = await import("p5");
        if (cancelled || disposed.current || !mount.current) return;
        const P5 = module.default;
        let setupDone = false;
        const setupWaiters: Array<() => void> = [];
        created = new P5((p: any) => {
          p.setup = () => {
            p.createCanvas(640, 640, p.P2D);
            p.pixelDensity(1);
            p.noLoop();
            setupDone = true;
            for (const wait of setupWaiters.splice(0)) wait();
          };
          p.draw = () => {
            // p5's automatic initial draw arrives before the first scheduled render;
            // the first scheduled redraw is the real initial draw.
            if (drawn.current === 0 && scheduled.current === 0) return;
            drawn.current += 1;
            try {
              renderStudio(p, documentRef.current);
              setRevision((value) => value + 1);
              report(null);
            } catch (cause) {
              report(
                `Could not draw: ${cause instanceof Error ? cause.message : String(cause)}`,
              );
            }
          };
        }, mount.current);
        instance.current = created;
        await new Promise<void>((resolve) => {
          if (setupDone) resolve();
          else setupWaiters.push(resolve);
        });
        if (!cancelled && !disposed.current) scheduleRender(documentRef.current);
      } catch (cause) {
        if (!cancelled && !disposed.current)
          report(
            `Could not load p5: ${cause instanceof Error ? cause.message : String(cause)}`,
          );
      }
    })();
    return () => {
      cancelled = true;
      if (created) created.remove();
      if (instance.current === created) instance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    disposed.current = false;
    if (instance.current) scheduleRender(document);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document]);
  useEffect(() => {
    return () => {
      disposed.current = true;
    };
  }, []);
  return (
    <div
      ref={mount}
      tabIndex={0}
      className={className}
      data-render-revision={revision}
      data-render-status={status}
      role="status"
      aria-live="polite"
      aria-label={
        error ??
        (status === "loading" ? "Drawing studio canvas" : "Studio canvas ready")
      }
    >
      {error && <span>{error}</span>}
    </div>
  );
}
