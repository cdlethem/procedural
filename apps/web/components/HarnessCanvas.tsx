"use client";

import { useEffect, useRef, useState } from "react";
import { preloadPreviews } from "@/lib/harness-client";
import { renderHarness } from "@/lib/harness-render";
import type { StudioDocumentV3 } from "@/lib/studio-document";

export function HarnessCanvas({ document, onError, className }: { document: StudioDocumentV3; onError?: (message: string | null) => void; className?: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const instance = useRef<any>(null);
  const documentRef = useRef<StudioDocumentV3 | null>(null);
  const imagesRef = useRef<Record<string, ImageBitmap>>({});
  const errorRef = useRef(onError);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  errorRef.current = onError;
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setStatus("loading");
    void preloadPreviews(document, { signal: controller.signal }).then((images) => {
      if (cancelled) { Object.values(images).forEach((bitmap) => bitmap.close()); return; }
      const previous = imagesRef.current;
      documentRef.current = document;
      imagesRef.current = images;
      Object.values(previous).forEach((bitmap) => bitmap.close());
      instance.current?.redraw();
    }).catch((cause: unknown) => {
      if (cancelled) return;
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message); setStatus("error"); errorRef.current?.(message);
    });
    return () => { cancelled = true; controller.abort(); };
  }, [document]);
  useEffect(() => {
    let cancelled = false;
    let created: any = null;
    const report = (message: string | null) => { if (!cancelled) { setError(message); setStatus(message ? "error" : "ready"); errorRef.current?.(message); } };
    void import("p5").then(({ default: P5 }) => {
      if (cancelled || !mount.current) return;
      created = new P5((p: any) => {
        p.setup = () => { p.createCanvas(640, 640, p.P2D); p.pixelDensity(1); p.noLoop(); };
        p.draw = () => { if (!documentRef.current) return; try { renderHarness(p, documentRef.current, imagesRef.current); setRevision((value) => value + 1); report(null); } catch (cause) { report(`Could not draw: ${cause instanceof Error ? cause.message : String(cause)}`); } };
      }, mount.current);
      instance.current = created;
    }).catch((cause: unknown) => report(`Could not load p5: ${cause instanceof Error ? cause.message : String(cause)}`));
    return () => { cancelled = true; created?.remove(); Object.values(imagesRef.current).forEach((bitmap) => bitmap.close()); imagesRef.current = {}; documentRef.current = null; if (instance.current === created) instance.current = null; };
  }, []);
  return <div ref={mount} className={className} data-render-status={status} data-render-revision={revision} role="status" aria-live="polite" aria-label={error ?? (status === "loading" ? "Drawing harness canvas" : "Harness canvas ready")}>{error && <span>{error}</span>}</div>;
}
