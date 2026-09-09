"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HarnessCanvas } from "./HarnessCanvas";
import { InteractiveCanvas } from "./InteractiveCanvas";
import { LayerControls } from "./LayerControls";
import { LayerPicker } from "./LayerPicker";
import {
  PromptPanel,
  type PromptCandidateView,
  type PromptRunView,
  type PromptScope,
  type PromptTarget,
} from "./PromptPanel";
import { SourceArtifactPanel } from "./SourceArtifactPanel";
import { TransformControls } from "./TransformControls";
import {
  createDocument,
  createLayer,
  MAX_LAYERS,
  techniques,
  validateDocument,
} from "@/lib/studio";
import {
  createDocumentV3,
  canonicalJson,
  layerTitle,
  validateStudioDocument,
  workflowLayer,
  type ControlValue,
  type DocumentLayer,
  type StudioDocumentV3,
} from "@/lib/studio-document";
import {
  callHarnessTool,
  cancelRun,
  pollRun,
  preloadPreviews,
  startPromptRun,
} from "@/lib/harness-client";
import { computeRebaseDelta } from "@/lib/harness-render";
import type { Layer, StudioDocument, TechniqueId } from "@/lib/studio-types";

const STORE = "procedurals-studio-v1";
type Project = { id: string; title: string; updatedAt: string };
type InspectorTab = "placement" | "technique" | "style";
type Diagnostic = { stage?: string; code?: string; message?: string };
type SourceControl = {
  key: string;
  label: string;
  description: string;
  type: "number" | "boolean" | "select";
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  value: ControlValue;
};
type Hist = {
  doc: StudioDocumentV3;
  past: StudioDocumentV3[];
  future: StudioDocumentV3[];
  hydrated: boolean;
};
const errorText = (error: Diagnostic) =>
  `${error.stage ?? "request"} ${error.code ?? "UNKNOWN"}: ${error.message ?? "Unknown harness error"}`;
const clone = (document: StudioDocumentV3) =>
  validateStudioDocument(JSON.parse(JSON.stringify(document)));

function reduce(
  state: Hist,
  action: {
    kind: "commit" | "undo" | "redo" | "restore";
    doc?: StudioDocumentV3;
  },
): Hist {
  if (action.kind === "restore")
    return { doc: action.doc!, past: [], future: [], hydrated: true };
  if (action.kind === "commit")
    return {
      ...state,
      doc: action.doc!,
      past: [...state.past.slice(-29), clone(state.doc)],
      future: [],
    };
  if (action.kind === "undo" && state.past.length)
    return {
      ...state,
      doc: state.past.at(-1)!,
      past: state.past.slice(0, -1),
      future: [clone(state.doc), ...state.future].slice(0, 30),
    };
  if (action.kind === "redo" && state.future.length)
    return {
      ...state,
      doc: state.future[0],
      past: [...state.past.slice(-29), clone(state.doc)],
      future: state.future.slice(1),
    };
  return state;
}
function asWorkflow(
  layer: Extract<DocumentLayer, { kind: "workflow" }>,
): Layer {
  return {
    id: layer.id,
    technique: layer.content.technique,
    visible: layer.visible,
    opacity: layer.opacity,
    seed: layer.content.seed,
    palette: [...layer.content.palette],
    cutEdits: layer.content.cutEdits.map((edit) => ({ ...edit })),
    transform: { ...layer.content.transform },
    params: { ...layer.content.params },
  };
}
function workflowDocument(document: StudioDocumentV3): StudioDocument {
  const base = createDocument();
  return validateDocument({
    ...base,
    background: document.background,
    layers: document.layers
      .filter(
        (layer): layer is Extract<DocumentLayer, { kind: "workflow" }> =>
          layer.kind === "workflow",
      )
      .map(asWorkflow),
  });
}
function withWorkflowProjection(
  document: StudioDocumentV3,
  projection: StudioDocument,
): StudioDocumentV3 {
  const workflows = new Map(
    projection.layers.map((layer) => [layer.id, layer]),
  );
  return {
    ...document,
    background: projection.background,
    layers: document.layers.map((layer) => {
      if (layer.kind !== "workflow") return layer;
      const projected = workflows.get(layer.id);
      return projected ? workflowLayer(projected) : layer;
    }),
  };
}
function SourceControls({
  layer,
  controls,
  pending,
  onChange,
  onChangeLayer,
}: {
  layer: Extract<DocumentLayer, { kind: "source" }>;
  controls: SourceControl[];
  pending: boolean;
  onChange: (controls: Record<string, ControlValue>) => void;
  onChangeLayer: (change: Pick<DocumentLayer, "opacity" | "visible">) => void;
}) {
  return (
    <div className="source-layer-controls" data-preview-stale={pending}>
      <p className="control-description">
        {pending
          ? "Rendering updated preview…"
          : "Control changes rerender from the declared seeds."}
      </p>
      <label className="control">
        Opacity{" "}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={layer.opacity}
          onChange={(event) =>
            onChangeLayer({
              opacity: Number(event.target.value),
              visible: layer.visible,
            })
          }
        />
      </label>
      {controls.map((control) => {
        const value = layer.content.controls[control.key] ?? control.value;
        const set = (next: ControlValue) =>
          onChange({ ...layer.content.controls, [control.key]: next });
        if (control.type === "boolean")
          return (
            <label className="control toggle-control" key={control.key}>
              {control.label}
              <input
                type="checkbox"
                checked={value === true}
                disabled={pending}
                onChange={(event) => set(event.target.checked)}
              />
              <small>{control.description}</small>
            </label>
          );
        if (control.type === "select")
          return (
            <label className="control" key={control.key}>
              {control.label}
              <select
                value={String(value)}
                disabled={pending}
                onChange={(event) => set(event.target.value)}
              >
                {(control.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <small>{control.description}</small>
            </label>
          );
        return (
          <label className="control" key={control.key}>
            {control.label}
            <input
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={Number(value)}
              disabled={pending}
              onChange={(event) => set(Number(event.target.value))}
            />
            <small>{control.description}</small>
          </label>
        );
      })}
      <details>
        <summary>Generated source</summary>
        <SourceArtifactPanel layer={layer} className="source-panel" />
      </details>
    </div>
  );
}

export function Studio() {
  const query = useSearchParams(),
    requested = query.get("technique"),
    requestedId = techniques.some((technique) => technique.id === requested)
      ? (requested as TechniqueId)
      : undefined;
  const [history, dispatch] = useReducer(reduce, requestedId, (id): Hist => ({
    doc: createDocumentV3(id),
    past: [],
    future: [],
    hydrated: false,
  }));
  const [selected, setSelected] = useState(0),
    [status, setStatus] = useState<string | null>(null),
    [renderError, setRenderError] = useState<string | null>(null),
    [title, setTitle] = useState("Untitled project"),
    [projectId, setProjectId] = useState<string | null>(null),
    [projects, setProjects] = useState<Project[]>([]),
    [pickerOpen, setPickerOpen] = useState(false),
    [tab, setTab] = useState<InspectorTab>("technique");
  const [handle, setHandle] = useState<string | null>(null),
    [revision, setRevision] = useState<string | null>(null),
    [run, setRun] = useState<PromptRunView | null>(null),
    [candidate, setCandidate] = useState<PromptCandidateView | null>(null),
    [candidateDocument, setCandidateDocument] =
      useState<StudioDocumentV3 | null>(null),
    [controls, setControls] = useState<SourceControl[]>([]),
    [sourceUpdating, setSourceUpdating] = useState(false),
    [applying, setApplying] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    restoredRoute = useRef<string | null>(null),
    documentRef = useRef(history.doc),
    startedDocument = useRef<StudioDocumentV3 | null>(null),
    startedLayerId = useRef<string | null>(null),
    runId = useRef<string | null>(null),
    pollToken = useRef(0);
  const document = history.doc,
    layer = document.layers[selected];
  documentRef.current = document;
  const selectedWorkflow =
    layer?.kind === "workflow" ? asWorkflow(layer) : undefined;
  const technique =
    selectedWorkflow &&
    techniques.find((item) => item.id === selectedWorkflow.technique);
  const commit = useCallback((next: StudioDocumentV3) => {
    try {
      dispatch({ kind: "commit", doc: validateStudioDocument(next) });
      setCandidate((current) =>
        current ? { ...current, stale: true } : current,
      );
      setStatus(null);
    } catch (error) {
      setStatus(
        `Change rejected: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, []);
  const publish = useCallback(
    async (next: StudioDocumentV3, selectedLayerId?: string) => {
      const response = await callHarnessTool<{
        documentHandle: string;
        revisionHash: string;
      }>("studio.context", { document: next, selectedLayerId });
      if (!response.ok) {
        setStatus(errorText(response.error ?? {}));
        return null;
      }
      const value = {
        documentHandle: response.documentHandle,
        revisionHash: response.revisionHash,
      };
      if (documentRef.current === next) {
        setHandle(value.documentHandle);
        setRevision(value.revisionHash);
      }
      return value;
    },
    [],
  );
  const at = (index: number, change: Partial<Layer>) => {
    const current = documentRef.current,
      target = current.layers[index];
    if (!target || target.kind !== "workflow") return;
    const old = asWorkflow(target),
      params = change.params ?? old.params,
      clears =
        old.technique === "cut-marks" &&
        ((change.seed !== undefined && change.seed !== old.seed) ||
          ["cuts", "spread", "staggered"].some(
            (key) => params[key] !== old.params[key],
          ));
    const next = {
      ...target,
      visible: change.visible ?? target.visible,
      opacity: change.opacity ?? target.opacity,
      content: {
        ...target.content,
        seed: change.seed ?? target.content.seed,
        palette: change.palette ?? target.content.palette,
        transform: change.transform ?? target.content.transform,
        params,
        cutEdits: clears ? [] : (change.cutEdits ?? target.content.cutEdits),
      },
    };
    commit({
      ...current,
      layers: current.layers.map((item, itemIndex) =>
        itemIndex === index ? next : item,
      ),
    });
  };
  useEffect(() => {
    const route = requestedId ?? "local";
    if (restoredRoute.current === route) return;
    restoredRoute.current = route;
    setSelected(0);
    setProjectId(null);
    setTitle("Untitled project");
    try {
      const raw = localStorage.getItem(STORE);
      dispatch({
        kind: "restore",
        doc: requestedId
          ? createDocumentV3(requestedId)
          : raw
            ? validateStudioDocument(JSON.parse(raw))
            : documentRef.current,
      });
    } catch (error) {
      dispatch({ kind: "restore", doc: documentRef.current });
      setStatus(
        `Could not restore local work: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, [requestedId]);
  useEffect(() => {
    setSelected((index) =>
      Math.min(index, Math.max(0, document.layers.length - 1)),
    );
    setTab("technique");
  }, [document.layers.length, layer?.id]);
  useEffect(() => {
    if (history.hydrated)
      try {
        localStorage.setItem(STORE, JSON.stringify(document));
      } catch (error) {
        setStatus(
          `Could not autosave locally: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
  }, [document, history.hydrated]);
  useEffect(() => {
    if (!layer || layer.kind !== "source") {
      setControls([]);
      return;
    }
    let active = true;
    void callHarnessTool<{ manifest?: { controls?: SourceControl[] } }>(
      "artifact.read",
      { hash: layer.content.sourceArtifactHash },
    )
      .then((response) => {
        if (active)
          setControls(response.ok ? (response.manifest?.controls ?? []) : []);
      })
      .catch(() => {
        if (active) setControls([]);
      });
    return () => {
      active = false;
    };
  }, [layer]);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/projects"),
        body = await response.json();
      if (!response.ok) throw Error(body.error?.message ?? response.statusText);
      setProjects(body.projects ?? []);
    } catch (error) {
      setStatus(
        `Project service unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const add = (id: TechniqueId) => {
    const current = documentRef.current;
    if (current.layers.length >= MAX_LAYERS)
      return setStatus(`A document can contain up to ${MAX_LAYERS} layers.`);
    const layers = [...current.layers, workflowLayer(createLayer(id))];
    commit({ ...current, layers });
    setSelected(layers.length - 1);
  };
  const remove = () => {
    if (layer) {
      commit({
        ...document,
        layers: document.layers.filter((_, index) => index !== selected),
      });
      setSelected(Math.max(0, selected - 1));
    }
  };
  const duplicate = () => {
    if (
      !layer ||
      layer.kind !== "workflow" ||
      document.layers.length >= MAX_LAYERS
    )
      return;
    const created = createLayer(layer.content.technique),
      layers = [...document.layers];
    layers.splice(
      selected + 1,
      0,
      workflowLayer({ ...asWorkflow(layer), id: created.id }),
    );
    commit({ ...document, layers });
    setSelected(selected + 1);
  };
  const move = (distance: number) => {
    const to = selected + distance;
    if (to < 0 || to >= document.layers.length) return;
    const layers = [...document.layers];
    [layers[selected], layers[to]] = [layers[to], layers[selected]];
    commit({ ...document, layers });
    setSelected(to);
  };
  const undo = () => {
    if (history.past.length) {
      const next = history.past.at(-1)!;
      dispatch({ kind: "undo" });
      setCandidate(null);
      setCandidateDocument(null);
      void publish(next);
    }
  };
  const redo = () => {
    if (history.future.length) {
      const next = history.future[0];
      dispatch({ kind: "redo" });
      setCandidate(null);
      setCandidateDocument(null);
      void publish(next);
    }
  };
  const exportJson = () => {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(document, null, 2)], {
          type: "application/json",
        }),
      ),
      anchor = Object.assign(window.document.createElement("a"), {
        href: url,
        download: "procedurals-studio.json",
      });
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const exportPng = () => {
    const canvas = window.document.querySelector(
      ".canvas-wrap canvas",
    ) as HTMLCanvasElement | null;
    if (!canvas) return setStatus("The canvas is not ready yet.");
    canvas.toBlob((blob) => {
      if (!blob) return setStatus("PNG export failed.");
      const url = URL.createObjectURL(blob),
        anchor = Object.assign(window.document.createElement("a"), {
          href: url,
          download: "procedurals-studio.png",
        });
      anchor.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  const importFile = (input: HTMLInputElement) => {
    const selectedFile = input.files?.[0];
    if (!selectedFile) return;
    if (selectedFile.size > 1e6) {
      setStatus("Import rejected: file exceeds 1 MB.");
      input.value = "";
      return;
    }
    void selectedFile
      .text()
      .then((value) => {
        commit(validateStudioDocument(JSON.parse(value)));
        setSelected(0);
        setProjectId(null);
      })
      .catch((error) =>
        setStatus(
          `Import rejected: ${error instanceof Error ? error.message : String(error)}`,
        ),
      )
      .finally(() => {
        input.value = "";
      });
  };
  const save = async () => {
    try {
      const response = await fetch(
          projectId ? `/api/projects/${projectId}` : "/api/projects",
          {
            method: projectId ? "PUT" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title, document }),
          },
        ),
        body = await response.json();
      if (!response.ok) throw Error(body.error?.message ?? response.statusText);
      setProjectId(body.id);
      await refresh();
    } catch (error) {
      setStatus(
        `Could not save project: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  const load = async (id: string) => {
    try {
      const response = await fetch(`/api/projects/${id}`),
        body = await response.json();
      if (!response.ok) throw Error(body.error?.message ?? response.statusText);
      commit(validateStudioDocument(body.document));
      setProjectId(id);
      setTitle(body.title);
      setSelected(0);
    } catch (error) {
      setStatus(
        `Could not load project: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  const renderCandidateSources = async (
    candidateId: string,
    proposed: StudioDocumentV3,
  ) => {
    const checked = await callHarnessTool<{
      requiredRenders?: { layerId: string; rendered: boolean }[];
    }>("candidate.validate", { candidateId });
    if (!checked.ok) throw Error(errorText(checked.error ?? {}));
    for (const required of checked.requiredRenders ?? []) {
      if (required.rendered) continue;
      const source = proposed.layers.find(
        (item) => item.id === required.layerId,
      );
      if (!source || source.kind !== "source") continue;
      const submitted = await callHarnessTool<{ jobId: string }>(
        "render.submit",
        {
          candidateId,
          layerId: source.id,
          frameContext: { tick: source.content.tick },
        },
      );
      if (!submitted.ok) throw Error(errorText(submitted.error ?? {}));
      for (;;) {
        const progress = await callHarnessTool<{
          state: string;
          diagnostics?: Diagnostic[];
        }>("render.status", { jobId: submitted.jobId });
        if (!progress.ok) throw Error(errorText(progress.error ?? {}));
        if (progress.state === "succeeded") break;
        if (progress.state === "failed" || progress.state === "cancelled")
          throw Error(
            errorText(
              progress.diagnostics?.[0] ?? {
                stage: "render",
                code: progress.state,
                message: "Render did not complete",
              },
            ),
          );
        await new Promise((resolve) => window.setTimeout(resolve, 300));
      }
    }
    return callHarnessTool<{
      resultingDocument?: StudioDocumentV3;
      diagnostics?: Diagnostic[];
    }>("candidate.validate", { candidateId });
  };
  const start = async (
    prompt: string,
    scope: PromptScope,
    target: PromptTarget,
  ) => {
    const token = ++pollToken.current;
    try {
      const current = documentRef.current,
        selectedLayerId = current.layers[selected]?.id,
        published = await publish(current, selectedLayerId);
      if (!published || token !== pollToken.current) return;
      startedDocument.current = clone(current);
      startedLayerId.current = selectedLayerId ?? null;
      const response = await startPromptRun({
        prompt,
        documentHandle: published.documentHandle,
        scope,
        selectedLayerId: scope === "edit-layer" ? selectedLayerId : null,
        target,
      });
      if (!response.ok) throw Error(errorText(response.error ?? {}));
      if (token !== pollToken.current) {
        if (typeof response.run.id === "string")
          void cancelRun(response.run.id);
        return;
      }
      runId.current = response.run.id;
      setRun(response.run);
      setCandidate(null);
      setCandidateDocument(null);
      const poll = async (): Promise<void> => {
        try {
          if (token !== pollToken.current || !runId.current) return;
          const next = await pollRun(runId.current);
          if (token !== pollToken.current) return;
          if (!next.ok) throw Error(errorText(next.error ?? {}));
          if (next.run.state === "running") setRun(next.run);
          if (next.run.state === "running")
            return void window.setTimeout(() => void poll(), 800);
          if (typeof next.run.candidateId !== "string") {
            setRun(next.run);
            return;
          }
          setRun({
            ...next.run,
            state: "running",
            currentStep: "Validating candidate",
          });
          const checked = await callHarnessTool<{
            resultingDocument?: StudioDocumentV3;
            diagnostics?: Diagnostic[];
          }>("candidate.validate", { candidateId: next.run.candidateId });
          if (!checked.ok) throw Error(errorText(checked.error ?? {}));
          if (checked.resultingDocument) {
            const proposed = validateStudioDocument(checked.resultingDocument);
            if (checked.diagnostics?.length) throw Error(checked.diagnostics.map(errorText).join("; "));
            const previews = await preloadPreviews(proposed);
            Object.values(previews).forEach((preview) => preview.close());
            if (token !== pollToken.current) return;
            setCandidateDocument(proposed);
          }
          setCandidate({
            id: next.run.candidateId,
            scope,
            diagnostics: (checked.diagnostics ?? []).map(errorText),
            stale:
              canonicalJson(documentRef.current) !==
              canonicalJson(startedDocument.current),
          });
          setRun(next.run);
        } catch (error) {
          if (token === pollToken.current) {
            const message = error instanceof Error ? error.message : String(error);
            setStatus(message);
            setRun((current) => ({ ...current, state: "failed", message }));
          }
        }
      };
      await poll();
    } catch (error) {
      if (token === pollToken.current) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(message);
        setRun((current) => ({ ...current, state: "failed", message }));
      }
    }
  };
  const cancel = async () => {
    ++pollToken.current;
    if (runId.current) {
      const response = await cancelRun(runId.current);
      if (response.ok) setRun(response.run);
    }
  };
  const apply = async () => {
    if (!candidate?.id || !candidate.scope || candidate.stale || applying)
      return;
    const current = documentRef.current;
    const token = pollToken.current;
    setApplying(true);
    try {
      const published = await publish(
        current,
        startedLayerId.current ?? undefined,
      );
      if (!published || documentRef.current !== current || token !== pollToken.current) return;
      const response = await callHarnessTool<{
        document?: StudioDocumentV3;
        documentHandle: string;
        revisionHash: string;
      }>(
        "candidate.apply",
        {
          candidateId: candidate.id,
          documentHandle: published.documentHandle,
          currentBaseHash: published.revisionHash,
          idempotencyKey: `prompt-${crypto.randomUUID()}`,
        },
        { authorizeApplyScope: candidate.scope },
      );
      if (!response.ok) {
        setCandidate({
          ...candidate,
          stale: response.error?.code === "REVISION_CONFLICT",
          diagnostics: [errorText(response.error ?? {})],
        });
        return;
      }
      if (!response.document || documentRef.current !== current || token !== pollToken.current) return;
      dispatch({
        kind: "commit",
        doc: validateStudioDocument(response.document),
      });
      setHandle(response.documentHandle);
      setRevision(response.revisionHash);
      setCandidate(null);
      setCandidateDocument(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setApplying(false);
    }
  };
  const rebase = async () => {
    const token = pollToken.current;
    if (!candidateDocument || !startedDocument.current || !candidate?.scope)
      return;
    try {
      const current = documentRef.current,
        selectedLayerId = startedLayerId.current,
        published = await publish(current, selectedLayerId ?? undefined);
      if (!published) return;
      const delta = computeRebaseDelta(
        startedDocument.current,
        candidateDocument,
        candidate.scope,
        selectedLayerId,
      );
      let proposed = current;
      if (candidate.scope === "add-layer")
        proposed = { ...current, layers: [...current.layers, ...delta] };
      else if (candidate.scope === "edit-layer" && delta[0])
        proposed = {
          ...current,
          layers: current.layers.map((item) =>
            item.id === delta[0].id ? delta[0] : item,
          ),
        };
      else if (candidate.scope === "composition")
        proposed = {
          ...current,
          background: candidateDocument.background,
          layers: delta,
        };
      const created = await callHarnessTool<{ candidateId?: string }>(
        "candidate.create",
        {
          documentHandle: published.documentHandle,
          scope: candidate.scope,
          selectedLayerId,
          document: proposed,
        },
      );
      if (!created.ok || !created.candidateId)
        throw Error(errorText(created.error ?? {}));
      const checked = await renderCandidateSources(
        created.candidateId,
        proposed,
      );
      if (!checked.ok) throw Error(errorText(checked.error ?? {}));
      if (checked.resultingDocument) {
        const next = validateStudioDocument(checked.resultingDocument);
        if (documentRef.current !== current || token !== pollToken.current) return;
        const previews = await preloadPreviews(next);
        Object.values(previews).forEach((preview) => preview.close());
        if (documentRef.current !== current || token !== pollToken.current) return;
        startedDocument.current = clone(current);
        setCandidateDocument(next);
      }
      setCandidate({
        id: created.candidateId,
        scope: candidate.scope,
        diagnostics: (checked.diagnostics ?? []).map(errorText),
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };
  const updateSourceControls = async (
    source: Extract<DocumentLayer, { kind: "source" }>,
    nextControls: Record<string, ControlValue>,
  ) => {
    if (sourceUpdating) return;
    const current = documentRef.current;
    if (current.layers.find((item) => item.id === source.id) !== source) return;
    setSourceUpdating(true);
    try {
      const published = await publish(current, source.id);
      if (!published) return;
      const proposed = {
        ...current,
        layers: current.layers.map((item) =>
          item.id === source.id && item.kind === "source"
            ? {
                ...item,
                content: {
                  ...item.content,
                  controls: nextControls,
                  previewArtifactHash: null,
                },
              }
            : item,
        ),
      };
      const created = await callHarnessTool<{ candidateId?: string }>(
        "candidate.create",
        {
          documentHandle: published.documentHandle,
          scope: "edit-layer",
          selectedLayerId: source.id,
          document: proposed,
        },
      );
      if (!created.ok || !created.candidateId)
        throw Error(errorText(created.error ?? {}));
      const checked = await renderCandidateSources(
        created.candidateId,
        proposed,
      );
      if (!checked.ok || !checked.resultingDocument)
        throw Error(errorText(checked.error ?? checked.diagnostics?.[0] ?? {}));
      if (documentRef.current !== current)
        return setStatus(
          "Source preview finished, but a newer edit is active. The preview was not applied.",
        );
      const applied = await callHarnessTool<{
        document?: StudioDocumentV3;
        documentHandle: string;
        revisionHash: string;
      }>(
        "candidate.apply",
        {
          candidateId: created.candidateId,
          documentHandle: published.documentHandle,
          currentBaseHash: published.revisionHash,
          idempotencyKey: `control-${crypto.randomUUID()}`,
        },
        { authorizeApplyScope: "edit-layer" },
      );
      if (!applied.ok || !applied.document)
        throw Error(errorText(applied.error ?? {}));
      if (documentRef.current !== current)
        return setStatus(
          "Source preview finished, but a newer edit is active. The preview was not applied.",
        );
      const previews = await preloadPreviews(
        validateStudioDocument(applied.document),
      );
      Object.values(previews).forEach((preview) => preview.close());
      if (documentRef.current !== current)
        return setStatus(
          "Source preview finished, but a newer edit is active. The preview was not applied.",
        );
      dispatch({
        kind: "commit",
        doc: validateStudioDocument(applied.document),
      });
      setHandle(applied.documentHandle);
      setRevision(applied.revisionHash);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSourceUpdating(false);
    }
  };
  const displayedDocument =
    candidateDocument && !candidate?.stale ? candidateDocument : document;
  useEffect(
    () => () => {
      ++pollToken.current;
      if (runId.current) void cancelRun(runId.current);
    },
    [],
  );
  return (
    <main className="studio prompt-studio">
      <header className="studio-head">
        <div>
          <p className="eyebrow">Composition workspace</p>
          <h1>Studio</h1>
        </div>
        <div className="panel-actions">
          <button
            className="action secondary"
            type="button"
            onClick={() => setPickerOpen(true)}
          >
            Add layer
          </button>
          <input
            aria-label="Project title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
          />
          <button
            className="action secondary"
            onClick={undo}
            disabled={!history.past.length}
          >
            Undo
          </button>
          <button
            className="action secondary"
            onClick={redo}
            disabled={!history.future.length}
          >
            Redo
          </button>
          <button className="action" onClick={() => void save()}>
            Save project
          </button>
        </div>
      </header>
      {(status || renderError) && (
        <p className="service-error" role="alert">
          {status || renderError}
        </p>
      )}
      <div className="studio-layout">
        <section className="studio-panel">
          <h2>Layers</h2>
          <p className="control-description">
            Back to front, from top to bottom.
          </p>
          <ul className="layer-list">
            {document.layers.map((item, index) => (
              <li key={item.id}>
                <button
                  className="icon-button"
                  aria-label={`${item.visible ? "Hide" : "Show"} ${layerTitle(item)}`}
                  onClick={() =>
                    commit({
                      ...document,
                      layers: document.layers.map((value, itemIndex) =>
                        itemIndex === index
                          ? { ...value, visible: !value.visible }
                          : value,
                      ),
                    })
                  }
                >
                  {item.visible ? "◉" : "○"}
                </button>
                <button
                  className={`layer-name ${index === selected ? "selected" : ""}`}
                  aria-pressed={index === selected}
                  onClick={() => setSelected(index)}
                >
                  {index + 1}. {layerTitle(item)}
                </button>
              </li>
            ))}
          </ul>
          <div className="panel-actions">
            <button className="action secondary" onClick={() => move(-1)}>
              Move up
            </button>
            <button className="action secondary" onClick={() => move(1)}>
              Move down
            </button>
            <button
              className="action secondary"
              onClick={duplicate}
              disabled={layer?.kind !== "workflow"}
            >
              Duplicate
            </button>
            <button className="action secondary" onClick={remove}>
              Delete
            </button>
          </div>
          <div className="control">
            <label htmlFor="background">Background</label>
            <input
              id="background"
              type="color"
              value={document.background}
              onChange={(event) =>
                commit({ ...document, background: event.target.value })
              }
            />
          </div>
          <details className="studio-projects">
            <summary>Saved projects</summary>
            <div className="panel-actions">
              <button
                className="action secondary"
                onClick={() => void refresh()}
              >
                Refresh
              </button>
            </div>
            <ul className="project-list">
              {projects.map((project) => (
                <li key={project.id}>
                  <button onClick={() => void load(project.id)}>
                    {project.title}
                    <small>
                      {new Date(project.updatedAt).toLocaleString()}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </section>
        <section className="canvas-wrap">
          {candidateDocument && (
            <div className="panel-actions">
              <p className="control-description" role="status">
                Candidate preview — it has not changed your document.
              </p>
              <button
                className="action secondary"
                onClick={() => {
                  ++pollToken.current;
                  setCandidate(null);
                  setCandidateDocument(null);
                }}
              >
                Discard candidate
              </button>
            </div>
          )}
          <InteractiveCanvas
            document={workflowDocument(document)}
            layer={selectedWorkflow}
            onChangeLayer={(change) => at(selected, change)}
            onUndo={undo}
            onRedo={redo}
            canUndo={Boolean(history.past.length)}
            canRedo={Boolean(history.future.length)}
            onError={setRenderError}
            showHistory={false}
            transformsEnabled={!candidateDocument || candidate?.stale}
            renderOverride={(projection) => (
              <HarnessCanvas
                document={
                  candidateDocument && !candidate?.stale
                    ? displayedDocument
                    : withWorkflowProjection(displayedDocument, projection)
                }
                onError={setRenderError}
              />
            )}
          />
          <div className="panel-actions">
            <button className="action secondary" onClick={exportPng}>
              Export PNG
            </button>
            <button className="action secondary" onClick={exportJson}>
              Export JSON
            </button>
            <button
              className="action secondary"
              onClick={() => file.current?.click()}
            >
              Import JSON
            </button>
            <input
              className="file-input"
              ref={file}
              type="file"
              accept="application/json"
              onChange={(event) => importFile(event.currentTarget)}
            />
          </div>
        </section>
        <section className="studio-panel">
          <h2>Inspector</h2>
          {layer?.kind === "source" ? (
            <SourceControls
              layer={layer}
              controls={controls}
              pending={sourceUpdating}
              onChange={(next) => void updateSourceControls(layer, next)}
              onChangeLayer={(change) =>
                commit({
                  ...document,
                  layers: document.layers.map((item) =>
                    item.id === layer.id ? { ...item, ...change } : item,
                  ),
                })
              }
            />
          ) : selectedWorkflow && technique ? (
            <div className="inspector-tabs">
              <div aria-label="Inspector sections" role="tablist">
                {(
                  [
                    ["placement", "Placement"],
                    ["technique", "Technique"],
                    ["style", "Style"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    aria-selected={tab === id}
                    key={id}
                    onClick={() => setTab(id)}
                    role="tab"
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              {tab === "placement" ? (
                <TransformControls
                  layer={selectedWorkflow}
                  onChange={(change) => at(selected, change)}
                />
              ) : (
                <LayerControls
                  layer={selectedWorkflow}
                  technique={technique}
                  onChange={(change) => at(selected, change)}
                  section={tab}
                />
              )}
            </div>
          ) : (
            <p className="control-description">Select a layer to inspect it.</p>
          )}
        </section>
        <PromptPanel
          documentHandle={handle}
          revisionHash={revision}
          run={run}
          candidate={candidate}
          status={null}
          onGenerate={start}
          onCancel={cancel}
          onApply={apply}
          onRebase={rebase}
        />
      </div>
      <LayerPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(id) => {
          add(id as TechniqueId);
          setPickerOpen(false);
        }}
      />
    </main>
  );
}
