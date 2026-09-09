"use client";

import { useEffect, useState } from "react";
import { callHarnessTool } from "@/lib/harness-client";
import type { DocumentLayer } from "@/lib/studio-document";

type SourceLayer = Extract<DocumentLayer, { kind: "source" }>;
type ArtifactFile = { path: string; text: string };
type SourceManifest = { fileHashes?: { path: string }[] };

export function SourceArtifactPanel({ layer, className, title = "Generated source" }: { layer: SourceLayer; className?: string; title?: string }) {
  const artifactKey = `${layer.content.sourceArtifactHash}:${layer.content.entrypoint}`;
  const [loaded, setLoaded] = useState<{ key: string; files: ArtifactFile[]; error: string | null }>({ key: "", files: [], error: null });
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoaded({ key: artifactKey, files: [], error: null });
    setActionError(null);
    void (async () => {
      try {
        const first = await callHarnessTool<{ content?: string; manifest?: SourceManifest }>(
          "artifact.read",
          { hash: layer.content.sourceArtifactHash, path: layer.content.entrypoint },
          { signal: controller.signal },
        );
        if (!first.ok || typeof first.content !== "string")
          throw new Error(first.error?.message ?? "The generated source artifact could not be read.");
        const paths = first.manifest?.fileHashes?.map((file) => file.path) ?? [layer.content.entrypoint];
        const rest = await Promise.all(paths.filter((path) => path !== layer.content.entrypoint).map(async (path) => {
          const response = await callHarnessTool<{ content?: string }>("artifact.read", { hash: layer.content.sourceArtifactHash, path }, { signal: controller.signal });
          if (!response.ok || typeof response.content !== "string") throw new Error(response.error?.message ?? `Could not read ${path}.`);
          return { path, text: response.content };
        }));
        if (!controller.signal.aborted) setLoaded({ key: artifactKey, files: [{ path: layer.content.entrypoint, text: first.content }, ...rest], error: null });
      } catch (cause) {
        if (!controller.signal.aborted) setLoaded({ key: artifactKey, files: [], error: cause instanceof Error ? cause.message : String(cause) });
      }
    })();
    return () => controller.abort();
  }, [artifactKey, layer.content.entrypoint, layer.content.sourceArtifactHash]);

  const download = (file: ArtifactFile) => {
    const url = URL.createObjectURL(new Blob([file.text], { type: "text/javascript;charset=utf-8" }));
    const anchor = Object.assign(window.document.createElement("a"), { href: url, download: file.path });
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const copy = async (file: ArtifactFile) => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard access is unavailable in this browser.");
      await navigator.clipboard.writeText(file.text);
      setActionError(null);
    } catch (cause) {
      setActionError(cause instanceof Error ? `Could not copy ${file.path}: ${cause.message}` : `Could not copy ${file.path}.`);
    }
  };
  const current = loaded.key === artifactKey ? loaded : { files: [], error: null };

  return <section className={className} aria-label={title}>
    <h2>{title}</h2>
    <p>Replay: {layer.content.runnerProfile} · tick {layer.content.tick} · random seed {layer.content.randomSeed} · noise seed {layer.content.noiseSeed}</p>
    <p>Surface: {layer.content.background} · entrypoint: <code>{layer.content.entrypoint}</code></p>
    <p>Controls: {Object.keys(layer.content.controls).length === 0 ? "none" : Object.entries(layer.content.controls).map(([key, value]) => `${key}=${String(value)}`).join(", ")}</p>
    {current.error && <p role="alert">{current.error}</p>}
    {actionError && <p role="alert">{actionError}</p>}
    {!current.error && current.files.length === 0 && <p aria-live="polite">Loading exact artifact files…</p>}
    {current.files.map((file) => <article key={file.path}>
      <div><h3>{file.path}</h3><button type="button" onClick={() => void copy(file)}>Copy</button><button type="button" onClick={() => download(file)}>Download</button></div>
      <pre><code>{file.text}</code></pre>
    </article>)}
  </section>;
}
