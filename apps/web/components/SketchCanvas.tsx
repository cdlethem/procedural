"use client";

import { useEffect, useRef, useState } from "react";
import { renderStudio } from "../lib/render-studio";
import type { StudioDocument } from "../lib/studio-types";

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
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [revision, setRevision] = useState(0);
  documentRef.current = document;
  errorRef.current = onError;
  useEffect(() => {
    let cancelled = false;
    let created: any = null;
    const report = (message: string | null) => {
      if (!cancelled) {
        setError(message);
        setStatus(message ? "error" : "ready");
        errorRef.current?.(message);
      }
    };
    void (async () => {
      try {
        const module = await import("p5");
        if (cancelled || !mount.current) return;
        const P5 = module.default;
        created = new P5((p: any) => {
          p.setup = () => {
            p.createCanvas(640, 640, p.P2D);
            p.pixelDensity(1);
            p.noLoop();
          };
          p.draw = () => {
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
      } catch (cause) {
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
  }, []);
  useEffect(() => {
    if (instance.current) {
      setStatus("loading");
      instance.current.redraw();
    }
  }, [document]);
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
