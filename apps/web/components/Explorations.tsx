"use client";

import { useEffect, useRef, useState } from "react";
import { PromptPalette } from "./PaletteLibrary";
import { withPalettePrompt, type PaletteDraft } from "@/lib/palettes";
import { SaveLayerPanel } from "./SaveLayerPanel";
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
  const [palette, setPalette] = useState<PaletteDraft | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<StudioDocumentV3 | null>(null);
  const [resultPrompt, setResultPrompt] = useState("");
  const [selectedLayerId, setSelectedLayerId] = useState("");
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

  const generate = async (revise = false) => {
    const request = withPalettePrompt(prompt.trim(), palette);
    if (prompt.trim().length < 3 || busyRef.current) return;
    if (revise && (!result || !sourceLayers(result).some((layer) => layer.id === selectedLayerId))) return;
    const token = ++generation.current;
    busyRef.current = true;
    setBusy(true);
    setStatus(null);
    try {
      const context = await callHarnessTool<{ documentHandle?: string }>("studio.context", { document: revise ? result : createExplorationDocument() });
      if (!context.ok || !context.documentHandle) throw new Error(describe(context.error ?? {}));
      if (!active(token)) return;
      const started = await startPromptRun({
        prompt: revise ? request : `Create this as a generated p5.js source artifact, not a workflow-only result, because its exact files will be shown for reuse. Artist request: ${request}`,
        documentHandle: context.documentHandle,
        scope: revise ? "edit-layer" : "composition",
        selectedLayerId: revise ? selectedLayerId : null,
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
        const previews = await preloadPreviews(document);
        Object.values(previews).forEach((preview) => preview.close());
        if (active(token)) {
          setResult(document);
          setResultPrompt(revise ? `${resultPrompt}\nRevision: ${request}`.slice(-4000) : request);
          setSelectedLayerId(revise ? selectedLayerId : sourceLayers(document)[0]?.id ?? "");
          setPrompt("");
        }
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
  const hasPrompt = prompt.trim().length >= 3;
  const actionHint = busy
    ? "A request is running. Cancel it before starting another."
    : hasPrompt
      ? layers.length > 0 ? "Start a new composition, or revise the selected generated layer." : "Start a new composition from your direction."
      : "Write at least three characters to enable generation.";

  return <main id="main-content" tabIndex={-1} className={styles.explorations}>
    <header className={styles.header}>
      <p className="eyebrow">p5.js sketching</p>
      <h1>Explorations</h1>
      <p className={styles.lead}>Describe an image and receive a static 640px p5.js composition with its exact, reusable source files. Start a new sketch or refine a generated layer with a follow-up prompt. Save layers to keep them for other sketches. <a href="/docs/prompt-studio">Read the guide</a>.</p>
    </header>
    <div className={styles.layout}>
      <section className={`${styles.panel} ${styles.promptPanel}`} aria-labelledby="exploration-prompt-heading" aria-busy={busy}>
        <div className={styles.panelHeading}>
          <p className={styles.kicker}>01 / direction</p>
          <h2 id="exploration-prompt-heading">Set the brief</h2>
        </div>
        <label className={styles.fieldLabel} htmlFor="exploration-prompt">Exploration prompt</label>
        <textarea
          id="exploration-prompt"
          aria-describedby="exploration-prompt-help"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={busy}
          placeholder="A translucent coral sun behind ink-blue branching lines"
          maxLength={4000}
        />
        <p id="exploration-prompt-help" className={styles.hint}>Name the forms, colors, and mood you want to explore. Your request becomes a reusable p5.js source artifact.</p>
        <div className={styles.palette}>
          <span className={styles.fieldLabel}>Color direction</span>
          <PromptPalette palette={palette} onChange={setPalette} disabled={busy} />
        </div>
        {layers.length > 1 && <label className={styles.selectLabel} htmlFor="exploration-layer">Layer to revise
          <select id="exploration-layer" value={selectedLayerId} onChange={(event) => setSelectedLayerId(event.target.value)} disabled={busy}>
            {layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.id}</option>)}
          </select>
        </label>}
        <p id="exploration-action-hint" className={styles.actionHint}>{actionHint}</p>
        <div className={styles.actions}>
          {layers.length > 0 && <button type="button" className={styles.followUp} onClick={() => void generate(true)} disabled={busy || !hasPrompt} aria-describedby="exploration-action-hint">Follow up on layer</button>}
          <button type="button" className={styles.primaryAction} onClick={() => void generate()} disabled={busy || !hasPrompt} aria-describedby="exploration-action-hint">{busy ? "Generating…" : "Start new sketch"}</button>
          <button type="button" className={`secondary ${styles.cancel}`} onClick={() => void cancel()} disabled={!busy}>Cancel request</button>
        </div>
        {run && <p className={styles.status} role="status">{run.state}{run.currentStep ? ` · ${run.currentStep}` : ""}{run.message ? ` · ${run.message}` : ""}</p>}
        {status && <p id="exploration-request-error" className={styles.error} role="alert">{status}</p>}
      </section>
      <section className={`${styles.panel} ${styles.preview}`} aria-labelledby="exploration-preview-heading">
        <div className={styles.panelHeading}>
          <p className={styles.kicker}>02 / output</p>
          <h2 id="exploration-preview-heading">Preview and source</h2>
        </div>
        {result ? <>
          <p className={styles.previewNote}>The latest successful sketch stays available while you continue exploring.</p>
          <HarnessCanvas document={result} className={styles.canvas} onError={setStatus} />
          <div className={styles.actions}>
            <button type="button" className={`secondary ${styles.cancel}`} onClick={downloadPng}>Download PNG</button>
          </div>
          {layers.length > 0 ? layers.map((layer) => <div key={layer.id} className={styles.layer}>
            <SaveLayerPanel key={layer.content.previewArtifactHash} layer={layer} document={result} description={resultPrompt} />
            <SourceArtifactPanel layer={layer} className={styles.source} title={`Source · ${layer.id}`} />
          </div>) : <p className={styles.error}>This result has no generated source files.</p>}
        </> : <div className={styles.emptyPreview}>
          <h3>{busy ? "Preparing your sketch" : "No sketch yet"}</h3>
          <p>{busy ? "The preview will update when this request completes." : "Write a direction, choose a palette if useful, then start a new sketch. Its rendered preview and exact source files will appear here."}</p>
        </div>}
      </section>
    </div>
  </main>;
}
