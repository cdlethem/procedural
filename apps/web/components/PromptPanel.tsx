"use client";

import { useState } from "react";

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
  const [submitting, setSubmitting] = useState(false);
  const running = submitting || run?.state === "running";
  const finished = run?.state === "succeeded";
  const activeStep = run?.currentStep ?? run?.steps?.at(-1)?.detail ?? run?.steps?.at(-1)?.name;
  const applyScope = candidate?.scope ?? scope;
  const submit = async () => {
    const text = prompt.trim();
    if (text.length < 3 || running) return;
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
    <section className="studio-panel prompt-panel" aria-labelledby="prompt-panel-title">
      <h2 id="prompt-panel-title">Create with a prompt</h2>
      <p className="control-description">
        Describe the image you want. Preview the result, then apply it to your composition.
      </p>
      <p className="control-description"><a href="/docs/prompt-studio">Read the prompt guide</a></p>
      <div className="control">
        <label htmlFor="studio-prompt">Prompt</label>
        <textarea
          id="studio-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Sparse navy curves with small coral dots on cream"
          rows={5}
          maxLength={4000}
          disabled={running}
        />
      </div>
      <div className="control">
        <label htmlFor="prompt-scope">Scope</label>
        <select
          id="prompt-scope"
          value={scope}
          onChange={(event) => setScope(event.target.value as PromptScope)}
          disabled={running}
        >
          {(Object.keys(scopeLabels) as PromptScope[]).map((value) => (
            <option value={value} key={value}>
              {scopeLabels[value]}
            </option>
          ))}
        </select>
      </div>
      <p className="control-description">
        Target: <strong>p5.js</strong>
      </p>
      <div className="panel-actions">
        <button className="action" type="button" onClick={() => void submit()} disabled={running || prompt.trim().length < 3}>
          {running ? "Generating…" : "Generate"}
        </button>
        <button className="action secondary" type="button" onClick={() => void cancel()} disabled={!running || !onCancel}>
          Cancel
        </button>
      </div>
      {(documentHandle || revisionHash) && (
        <p className="control-description prompt-revision">
          Published revision: <code>{revisionHash ?? documentHandle}</code>
        </p>
      )}
      {run && (
        <div className="prompt-run" aria-live="polite">
          <p className="prompt-run-state">
            <strong>Run {run.state ?? "unknown"}</strong>
            {activeStep ? ` · ${activeStep}` : ""}
          </p>
          <dl className="prompt-metrics">
            <div><dt>Tool calls</dt><dd>{count(run, "toolCalls")}</dd></div>
            <div><dt>Renders</dt><dd>{count(run, "renders")}</dd></div>
            <div><dt>Tokens</dt><dd>{count(run, "tokens")}</dd></div>
          </dl>
          {run.steps && run.steps.length > 0 && (
            <details>
              <summary>Tool activity ({run.steps.length})</summary>
              <ul className="prompt-steps">
                {run.steps.map((step, index) => (
                  <li key={`${step.name ?? step.kind ?? "step"}-${index}`}>
                    <span>{step.name ?? step.kind ?? "step"}</span>{step.detail ? `: ${step.detail}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {finished && run.controlSummary && run.controlSummary.length > 0 && (
            <div className="prompt-result">
              <h3>Controls</h3>
              <ul>{run.controlSummary.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
            </div>
          )}
          {finished && run.unmet && run.unmet.length > 0 && (
            <div className="prompt-result">
              <h3>Unmet requirements</h3>
              <ul>{run.unmet.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
            </div>
          )}
          {run.message && <p className="control-description">{run.message}</p>}
        </div>
      )}
      {candidate && (
        <div className="prompt-candidate" aria-live="polite">
          <h3>Candidate preview</h3>
          {candidate.id && <p className="control-description">Candidate: <code>{candidate.id}</code></p>}
          {candidate.stale && (
            <>
              <p className="service-error">This candidate is stale because the document changed.</p>
              <button className="action secondary" type="button" onClick={() => void onRebase?.()} disabled={!onRebase}>
                Rebase candidate
              </button>
            </>
          )}
          {candidate.diagnostics && candidate.diagnostics.length > 0 && (
            <ul className="prompt-diagnostics">
              {candidate.diagnostics.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
            </ul>
          )}
          {!candidate.stale && onApply && (applyScope === "add-layer" || applyScope === "edit-layer") && (
            <button className="action" type="button" onClick={() => void apply("add-layer")}>{applyScope === "edit-layer" ? "Apply edit" : "Add layer"}</button>
          )}
          {!candidate.stale && onApply && applyScope === "composition" && (
            <button className="action" type="button" onClick={() => void apply("use-composition")}>Use composition</button>
          )}
        </div>
      )}
      {status && <p className="service-error" role="alert">{status}</p>}
    </section>
  );
}
