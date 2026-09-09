"use client";

import { useEffect, useRef, useState } from "react";
import { HarnessCanvas } from "./HarnessCanvas";
import { SourceArtifactPanel } from "./SourceArtifactPanel";
import { callHarnessTool, cancelRun, pollRun, preloadPreviews, startPromptRun } from "@/lib/harness-client";
import { createExplorationDocument, sourceLayers } from "@/lib/explorations";
import { validateStudioDocument, type StudioDocumentV3 } from "@/lib/studio-document";
import styles from "./Explorations.module.css";

type Run = { id: string; state: string; currentStep?: string; message?: string; candidateId?: string | null };
type Diagnostic = { stage?: string; code?: string; message?: string };
const describe = (item: Diagnostic) => `${item.stage ?? "request"} ${item.code ?? "UNKNOWN"}: ${item.message ?? "Unknown harness error"}`;

export function Explorations() {
  const [prompt, setPrompt] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<StudioDocumentV3 | null>(null);
  const [busy, setBusy] = useState(false);
  const runId = useRef<string | null>(null);
  const busyRef = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const active = (token: number) => mounted.current && generation.current === token;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      const id = runId.current;
      if (id) void cancelRun(id);
    };
  }, []);

  const generate = async () => {
    const request = prompt.trim();
    if (request.length < 3 || busyRef.current) return;
    const token = ++generation.current;
    busyRef.current = true;
    setBusy(true);
    setStatus(null);
    try {
      const context = await callHarnessTool<{ documentHandle?: string }>("studio.context", { document: createExplorationDocument() });
      if (!context.ok || !context.documentHandle) throw new Error(describe(context.error ?? {}));
      if (!active(token)) return;
      const started = await startPromptRun({
        prompt: `Create this as a generated p5.js source artifact, not a workflow-only result, because its exact files will be shown for reuse. Artist request: ${request}`,
        documentHandle: context.documentHandle,
        scope: "composition",
        selectedLayerId: null,
        target: "p5js",
      });
      if (!started.ok) throw new Error(describe(started.error ?? {}));
      const initial = started.run as Run;
      if (!active(token)) { void cancelRun(initial.id); return; }
      runId.current = initial.id;
      setRun(initial);
      for (;;) {
        const next = await pollRun(initial.id);
        if (!next.ok) throw new Error(describe(next.error ?? {}));
        const current = next.run as Run;
        if (!active(token)) { void cancelRun(initial.id); return; }
        setRun(current);
        if (current.state === "running") { await new Promise((resolve) => window.setTimeout(resolve, 800)); continue; }
        if (current.state !== "succeeded" || !current.candidateId) throw new Error(current.message ?? `Run ${current.state}.`);
        const checked = await callHarnessTool<{ resultingDocument?: StudioDocumentV3; diagnostics?: Diagnostic[]; requiredRenders?: { rendered: boolean }[] }>("candidate.validate", { candidateId: current.candidateId });
        if (!checked.ok || !checked.resultingDocument) throw new Error(describe(checked.error ?? checked.diagnostics?.[0] ?? {}));
        if (!active(token)) return;
        if ((checked.diagnostics?.length ?? 0) > 0) throw new Error(describe(checked.diagnostics?.[0] ?? {}));
        if ((checked.requiredRenders ?? []).some((render) => !render.rendered)) throw new Error("The completed run did not provide a rendered preview.");
        const document = validateStudioDocument(checked.resultingDocument);
        await preloadPreviews(document);
        if (active(token)) setResult(document);
        return;
      }
    } catch (cause) {
      if (mounted.current && generation.current === token) setStatus(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (generation.current === token) { runId.current = null; busyRef.current = false; if (mounted.current) setBusy(false); }
    }
  };
  const cancel = async () => { ++generation.current; busyRef.current = false; setBusy(false); const runValue = runId.current; runId.current = null; if (runValue) { const response = await cancelRun(runValue); if (response.ok && mounted.current) setRun(response.run as Run); } };
  const downloadPng = () => { const canvas = window.document.querySelector(`.${styles.canvas} canvas`) as HTMLCanvasElement | null; canvas?.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const anchor = Object.assign(window.document.createElement("a"), { href: url, download: "exploration.png" }); anchor.click(); URL.revokeObjectURL(url); }); };
  const layers = result ? sourceLayers(result) : [];
  return <main className={styles.explorations}><p className="eyebrow">p5.js sketching</p><h1>Explorations</h1><p className={styles.lead}>Describe an image and receive a static 640px p5.js composition with its exact, reusable source files. Every prompt starts a new sketch. <a href="/docs/prompt-studio">Read the guide</a>.</p><div className={styles.layout}><section className={styles.panel}><h2>Prompt</h2><textarea aria-label="Exploration prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={busy} placeholder="A translucent coral sun behind ink-blue branching lines" maxLength={4000} /><div className={styles.actions}><button type="button" onClick={() => void generate()} disabled={busy || prompt.trim().length < 3}>{busy ? "Generating…" : "Generate"}</button><button type="button" className="secondary" onClick={() => void cancel()} disabled={!busy}>Cancel</button></div>{run && <p className={styles.status} aria-live="polite">{run.state}{run.currentStep ? ` · ${run.currentStep}` : ""}{run.message ? ` · ${run.message}` : ""}</p>}{status && <p className={styles.error} role="alert">{status}</p>}</section><section className={`${styles.panel} ${styles.preview}`}><h2>Preview</h2>{result ? <><HarnessCanvas document={result} className={styles.canvas} onError={setStatus} /><div className={styles.actions}><button type="button" className="secondary" onClick={downloadPng}>Download PNG</button></div>{layers.length > 0 ? layers.map((layer) => <SourceArtifactPanel key={layer.id} layer={layer} className={styles.source} title={`Source · ${layer.id}`} />) : <p className={styles.error}>This result has no generated source files.</p>}</> : <p>Your last successful image and source remain here while another request runs.</p>}</section></div></main>;
}
