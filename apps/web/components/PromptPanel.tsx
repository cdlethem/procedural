"use client";

import { useEffect, useState } from "react";

export type PromptScope = "add-layer" | "edit-layer" | "composition";
export type PromptTarget = "p5js";
export type PromptRunState = "running" | "succeeded" | "failed" | "cancelled";

export type PromptRunView = {
  id?: string;
  state?: PromptRunState | string;
  currentStep?: string;
  steps?: { kind?: string; name?: string; detail?: string; ok?: boolean }[];
  toolCalls?: number;
  chargedRenders?: number;
  spentRenders?: number;
  promptTokens?: number;
  completionTokens?: number;
  candidateId?: string | null;
  controlSummary?: string[];
  unmet?: string[];
  message?: string;
};

export type PromptCandidateView = {
  id?: string | null;
  scope?: PromptScope;
  diagnostics?: string[];
  stale?: boolean;
};

export type PromptPanelProps = {
  /** The handle is shown so an artist can tell which published revision a run uses. */
  editRequest?: number;
  selectedLayerId?: string;
  documentHandle?: string | null;
  revisionHash?: string | null;
  run?: PromptRunView | null;
  candidate?: PromptCandidateView | null;
  status?: string | null;
  onGenerate: (
    prompt: string,
    scope: PromptScope,
    target: PromptTarget,
  ) => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  onApply?: (action: "add-layer" | "use-composition") => void | Promise<void>;
  onRebase?: () => void | Promise<void>;
};

const scopeLabels: Record<PromptScope, string> = {
  "add-layer": "Add layer",
  "edit-layer": "Edit selected layer",
  composition: "Whole composition",
};

function count(run: PromptRunView | null | undefined, key: "toolCalls" | "renders" | "tokens") {
  if (!run) return 0;
  if (key === "toolCalls") return run.toolCalls ?? run.steps?.filter((step) => step.kind === "tool").length ?? 0;
  if (key === "renders") return run.spentRenders ?? run.chargedRenders ?? 0;
  return (run.promptTokens ?? 0) + (run.completionTokens ?? 0);
}

/** Prompt coordinator controls deliberately stay presentational: the studio owns documents and authority. */
export function PromptPanel({
  editRequest = 0,
  selectedLayerId,
  documentHandle,
  revisionHash,
  run,
  candidate,
  status,
  onGenerate,
  onCancel,
  onApply,
  onRebase,
}: PromptPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [scope, setScope] = useState<PromptScope>("add-layer");
  useEffect(() => { if (editRequest > 0) setScope("edit-layer"); }, [editRequest]);
  const [submitting, setSubmitting] = useState(false);
  const running = submitting || run?.state === "running";
  const finished = run?.state === "succeeded";
  const activeStep = run?.currentStep ?? run?.steps?.at(-1)?.detail ?? run?.steps?.at(-1)?.name;
  const applyScope = candidate?.scope ?? scope;
  const submit = async () => {
    const text = prompt.trim();
    if (text.length < 3 || running || (scope === "edit-layer" && !selectedLayerId)) return;
    setSubmitting(true);
    try {
      await onGenerate(text, scope, "p5js");
    } finally {
      setSubmitting(false);
    }
  };
  const cancel = async () => {
    if (!onCancel) return;
    await onCancel();
  };
  const apply = async (action: "add-layer" | "use-composition") => {
    if (!onApply || candidate?.stale) return;
    await onApply(action);
  };

  return (
    <section className="prompt-panel" aria-labelledby="prompt-panel-title">
      {candidate && <div className="prompt-candidate" aria-live="polite">
        <h3>{candidate.stale ? "Keep your latest changes" : "Your preview is ready"}</h3>
        <p>{candidate.stale ? "The document changed. Rebase before applying this candidate." : "Apply this direction, or keep working on your original."}</p>
        {candidate.stale ? <button className="action" type="button" onClick={() => void onRebase?.()} disabled={!onRebase}>Rebase candidate</button> : onApply && <button className="action" type="button" onClick={() => void apply(applyScope === "composition" ? "use-composition" : "add-layer")}>{applyScope === "edit-layer" ? "Apply edit" : applyScope === "composition" ? "Use composition" : "Add layer"}</button>}
        {Boolean(candidate.diagnostics?.length) && <details><summary>Preview notes</summary><ul>{candidate.diagnostics?.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
      </div>}
      <div className="prompt-scroll" tabIndex={0} aria-label="Prompt editor">
        <div className="prompt-intro"><span className="prompt-kicker">A new direction</span><h2 id="prompt-panel-title">What do you want<br />to make?</h2><p>Describe an image or a change. You’ll review a preview before it becomes part of your sketch.</p></div>
        <div className="control"><label htmlFor="prompt-scope">Scope</label><select id="prompt-scope" value={scope} onChange={(event) => setScope(event.target.value as PromptScope)} disabled={running}>{(Object.keys(scopeLabels) as PromptScope[]).map((value) => <option value={value} key={value} disabled={value === "edit-layer" && !selectedLayerId}>{scopeLabels[value]}</option>)}</select></div>
        <div className="control"><label htmlFor="studio-prompt">Prompt</label><textarea id="studio-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={scope === "edit-layer" ? "Keep the pattern, soften the colors, and give the marks more room to breathe…" : "Sparse navy curves with small coral dots on warm cream…"} rows={6} maxLength={4000} disabled={running} /></div>
        {scope === "edit-layer" && <p className="control-description">The selected layer’s current source and controls are included with your request.</p>}
        {run && <div className="prompt-run" aria-live="polite">
          <p className="prompt-run-state"><strong>{run.state === "running" ? "Creating your preview…" : run.state === "succeeded" ? "Preview complete" : run.state === "cancelled" ? "Generation cancelled" : "Generation failed"}</strong>{running && activeStep ? ` · ${activeStep}` : ""}</p>
          {run.message && <p>{run.message}</p>}
          {finished && Boolean(run.controlSummary?.length) && <details><summary>Editable controls</summary><ul>{run.controlSummary?.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
          {finished && Boolean(run.unmet?.length) && <div className="prompt-result"><h3>Unmet requests</h3><ul>{run.unmet?.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
        </div>}
        {(run || documentHandle || revisionHash) && <details className="prompt-technical"><summary>Run details</summary>
          {(documentHandle || revisionHash) && <p>Published revision: <code>{revisionHash ?? documentHandle}</code></p>}
          {candidate?.id && <p>Candidate: <code>{candidate.id}</code></p>}
          {run && <><dl className="prompt-metrics"><div><dt>Tool calls</dt><dd>{count(run, "toolCalls")}</dd></div><div><dt>Renders</dt><dd>{count(run, "renders")}</dd></div><div><dt>Tokens</dt><dd>{count(run, "tokens")}</dd></div></dl><ol className="prompt-steps">{run.steps?.map((step, index) => <li key={index}>{step.name ?? step.kind}{step.detail ? `: ${step.detail}` : ""}</li>)}</ol></>}
        </details>}
        {status && <p className="service-error" role="alert">{status}</p>}
      </div>
      <footer className="prompt-footer"><div><button className="action" type="button" onClick={() => void submit()} disabled={running || prompt.trim().length < 3 || (scope === "edit-layer" && !selectedLayerId)}>{running ? "Generating…" : "Generate"}</button><button className="action secondary" type="button" onClick={() => void cancel()} disabled={!running || !onCancel}>Cancel</button></div><p><span>Generated with p5.js</span><a href="/docs/prompt-studio">Prompt guide ↗</a></p></footer>
    </section>
  );
}
