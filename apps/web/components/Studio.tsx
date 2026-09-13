"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import { StudioIcon } from "./StudioIcon";
import { StudioDialog } from "./StudioDialog";
import styles from "./Studio.module.css";
import { HarnessCanvas } from "./HarnessCanvas";
import { InteractiveCanvas } from "./InteractiveCanvas";
import { LayerControls } from "./LayerControls";
import { SaveLayerPanel } from "./SaveLayerPanel";
import { fetchSavedLayer, insertSavedLayer, type SavedLayer } from "@/lib/saved-layers";
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

const displayLayerTitle = (layer: DocumentLayer) => layer.kind === "workflow"
  ? techniques.find((item) => item.id === layer.content.technique)?.title ?? layerTitle(layer)
  : layer.kind === "source" ? "Generated p5.js" : layerTitle(layer);

function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const index = tabs.indexOf(event.target as HTMLButtonElement);
  if (index < 0) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowLeft" ? -1 : 1) + tabs.length) % tabs.length;
  tabs[next]?.focus(); tabs[next]?.click();
}

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
    requestedSavedLayer = query.get("savedLayer"),
    requested = query.get("technique"),
    requestedId = techniques.some((technique) => technique.id === requested)
      ? (requested as TechniqueId)
      : undefined;
  const [history, dispatch] = useReducer(reduce, requestedId, (id): Hist => ({
    doc: (() => {
      const initial = createDocumentV3(id);
      return { ...initial, layers: initial.layers.map((item, index) => ({ ...item, id: `initial-${index}` })) };
    })(),
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
    [tab, setTab] = useState<InspectorTab>("technique"),
    [editRequest, setEditRequest] = useState(0),
    [rightTab, setRightTab] = useState<"inspector" | "prompt">("inspector"),
    [compact, setCompact] = useState(false),
    [mobilePanel, setMobilePanel] = useState<"layers" | "inspector" | "prompt" | null>(null),
    [dialog, setDialog] = useState<"projects" | "export" | "help" | null>(null),
    [projectSearch, setProjectSearch] = useState(""),
    [canvasActions, setCanvasActions] = useState<HTMLDivElement | null>(null),
    [saving, setSaving] = useState(false),
    [savedRevision, setSavedRevision] = useState<string | null>(null);
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
    importedSavedLayer = useRef<string | null>(null),
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
  const addSaved = (saved: SavedLayer) => {
    try {
      const next = insertSavedLayer(documentRef.current, saved, `layer-${crypto.randomUUID()}`);
      commit(next);
      setSelected(next.layers.length - 1);
      setPickerOpen(false);
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  };
  useEffect(() => {
    if (!history.hydrated || !requestedSavedLayer || importedSavedLayer.current === requestedSavedLayer) return;
    let active = true;
    void fetchSavedLayer(requestedSavedLayer).then((saved) => {
      if (!active) return;
      importedSavedLayer.current = requestedSavedLayer;
      const next = insertSavedLayer(documentRef.current, saved, `layer-${crypto.randomUUID()}`);
      commit(next);
      setSelected(next.layers.length - 1);
      window.history.replaceState(null, "", "/studio");
    }).catch((error) => { if (active) setStatus(error instanceof Error ? error.message : String(error)); });
    return () => { active = false; };
  }, [history.hydrated, requestedSavedLayer, commit]);
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
    if (saving) return;
    setSaving(true);
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
      setSavedRevision(canonicalJson({ title, document }));
      await refresh();
    } catch (error) {
      setStatus(
        `Could not save project: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally { setSaving(false); }
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
      setDialog(null);
      setSavedRevision(canonicalJson({ title: body.title, document: validateStudioDocument(body.document) }));
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
    setRightTab("prompt");
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
          if (next.run.state !== "succeeded" || typeof next.run.candidateId !== "string") {
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
  const openPanel = (panel: "layers" | "inspector" | "prompt") => {
    if (panel !== "layers") setRightTab(panel);
    setMobilePanel((current) => current === panel ? null : panel);
  };
  const showPrompt = () => { setRightTab("prompt"); setMobilePanel("prompt"); };
  const closePanel = () => setMobilePanel(null);
  useEffect(() => {
    if (!mobilePanel || !window.matchMedia("(max-width: 1050px)").matches) return;
    const panel = window.document.getElementById(mobilePanel === "layers" ? "studio-layers" : "studio-inspector");
    panel?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [mobilePanel]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1050px)");
    const update = () => setCompact(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const isSaved = savedRevision === canonicalJson({ title, document });
  const candidateActive = Boolean(candidateDocument && !candidate?.stale);
  return (
    <main data-hydrated={history.hydrated} className={`${styles.workspace} studio-workspace`} onKeyDown={(event) => {
      if (event.key === "Escape" && mobilePanel) { closePanel(); window.document.getElementById(`toggle-${mobilePanel}`)?.focus(); }
    }}>
      <header className={styles.topbar}>
        <div className={styles.projectIdentity}>
          <h1>Studio<span>/</span></h1>
          <input aria-label="Project title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
          <span className={styles.saveState}>{saving ? "Saving…" : isSaved ? "Saved" : "Local draft"}</span>
        </div>
        <div className={styles.topActions}>
          <div className={styles.historyButtons}>
            <button type="button" aria-label="Undo" title="Undo" onClick={undo} disabled={!history.past.length}><StudioIcon name="undo" /></button>
            <button type="button" aria-label="Redo" title="Redo" onClick={redo} disabled={!history.future.length}><StudioIcon name="redo" /></button>
          </div>
          <button type="button" onClick={() => setDialog("projects")} aria-label="Open projects" title="Open projects"><StudioIcon name="folder" /><span>Open</span></button>
          <button type="button" onClick={() => setDialog("export")}><StudioIcon name="download" /><span>Export</span></button>
          <button className={styles.primary} type="button" onClick={() => void save()} disabled={saving}><StudioIcon name={isSaved ? "check" : "folder"} /><span>{saving ? "Saving…" : "Save project"}</span></button>
        </div>
      </header>
      {(status || renderError) && <div className={styles.notice} role="alert"><p>{status || renderError}</p><button aria-label="Dismiss message" onClick={() => { setStatus(null); setRenderError(null); }}><StudioIcon name="close" /></button></div>}
      <div className={styles.body} data-mobile-panel={mobilePanel ?? "none"}>
        {mobilePanel && <button className={styles.panelBackdrop} aria-label="Close panel" onClick={closePanel} tabIndex={-1} />}
        <aside className={styles.layers} id="studio-layers" aria-label="Layers" data-open={mobilePanel === "layers"}>
          <header className={styles.panelHeading}><h2>Layers <span>{document.layers.length}/{MAX_LAYERS}</span></h2><button type="button" aria-label="Close layers" className={styles.mobileClose} onClick={closePanel}><StudioIcon name="close" /></button></header>
          <div className={styles.addLayer}><button className={styles.primary} type="button" onClick={() => setPickerOpen(true)} disabled={document.layers.length >= MAX_LAYERS}><StudioIcon name="plus" />Add layer</button></div>
          <p className={styles.stackHint}>Back → front</p>
          <div className={styles.layerScroll} tabIndex={0} aria-label="Layer stack">
            <ul className="layer-list">
              {document.layers.map((item, index) => (
                <li key={item.id} data-selected={index === selected} data-visible={item.visible}>
                  <button className="layer-name" aria-pressed={index === selected} onClick={() => { setSelected(index); setRightTab("inspector"); }}>
                    <span className={styles.layerThumbnail}>{item.kind === "workflow" ? <img src={`/previews/${item.content.technique}.png`} alt="" /> : item.kind === "source" && item.content.previewArtifactHash ? <img src={`/harness/artifact/${item.content.previewArtifactHash}`} alt="" /> : <StudioIcon name="layers" />}</span>
                    <span className={styles.layerLabel}><strong>{displayLayerTitle(item)}</strong><small>{String(index + 1).padStart(2, "0")} · {item.kind === "source" ? "Generated layer" : "Package study"}</small></span>
                  </button>
                  <button className={styles.visibility} aria-label={`${item.visible ? "Hide" : "Show"} ${displayLayerTitle(item)}`} title={item.visible ? "Hide layer" : "Show layer"} onClick={() => commit({ ...document, layers: document.layers.map((value, itemIndex) => itemIndex === index ? { ...value, visible: !value.visible } : value) })}><StudioIcon name={item.visible ? "eye" : "hidden"} /></button>
                </li>
              ))}
            </ul>
            {document.layers.length === 0 && <div className={styles.empty}><StudioIcon name="layers" /><h3>A blank canvas</h3><p>Add a study or describe a new layer in Prompt.</p><button onClick={showPrompt}>Create with a prompt</button></div>}
          </div>
          <footer className={styles.layerFooter}>
            <div className={styles.layerActions} role="group" aria-label="Selected layer actions">
              <button aria-label="Move up" title="Move up" onClick={() => move(-1)} disabled={!layer || selected === 0}><StudioIcon name="up" /></button>
              <button aria-label="Move down" title="Move down" onClick={() => move(1)} disabled={!layer || selected === document.layers.length - 1}><StudioIcon name="down" /></button>
              <button aria-label="Duplicate" title="Duplicate layer" onClick={duplicate} disabled={layer?.kind !== "workflow" || document.layers.length >= MAX_LAYERS}><StudioIcon name="copy" /></button>
              <button aria-label="Delete" title="Delete layer" onClick={remove} disabled={!layer}><StudioIcon name="trash" /></button>
            </div>
            <label className={styles.background}>Canvas background<input aria-label="Background" type="color" value={document.background} onChange={(event) => commit({ ...document, background: event.target.value })} /></label>
          </footer>
        </aside>
        <section className={styles.canvasPane} aria-label="Canvas workspace" inert={Boolean(compact && mobilePanel)}>
          <header className={styles.canvasHeading}><span><i />{candidateActive ? "Candidate preview" : "Canvas"}</span><span>640 × 640 <b>·</b> Fit</span><button className={styles.shortHelp} aria-label="Canvas help" onClick={() => setDialog("help")}>?</button></header>
          {candidateDocument && <div className={styles.candidateBanner}><div><strong>{candidate?.stale ? "Your document has changed" : "A new direction to review"}</strong><p>{candidate?.stale ? "Rebase the candidate to keep your latest edits." : "Preview only. Apply it to keep this change."}</p></div><button className={styles.primary} onClick={showPrompt}>{candidate?.stale ? "Review & rebase" : "Review & apply"}</button><button aria-label="Discard candidate" title="Discard candidate" onClick={() => { ++pollToken.current; setCandidate(null); setCandidateDocument(null); }}><StudioIcon name="close" /></button></div>}
          <div className={styles.stage}>
            <div className={`${styles.canvasWell} canvas-wrap`}>
              <InteractiveCanvas
                document={workflowDocument(document)} layer={selectedWorkflow} onChangeLayer={(change) => at(selected, change)}
                onUndo={undo} onRedo={redo} canUndo={Boolean(history.past.length)} canRedo={Boolean(history.future.length)} onError={setRenderError}
                showHistory={false} transformsEnabled={!candidateDocument || candidate?.stale} actionsContainer={canvasActions}
                renderOverride={(projection) => <HarnessCanvas document={candidateActive ? displayedDocument : withWorkflowProjection(displayedDocument, projection)} onError={setRenderError} />}
              />
            </div>
          </div>
          <div className={styles.canvasTools} ref={setCanvasActions} />
          <footer className={styles.canvasFooter}><span>{layer ? displayLayerTitle(layer) : "No layer selected"}</span><button type="button" onClick={() => setDialog("help")}>Canvas help <span>?</span></button></footer>
        </section>
        <aside className={styles.inspector} id="studio-inspector" aria-label="Layer editor and prompts" data-open={mobilePanel === "inspector" || mobilePanel === "prompt"}>
          <header className={styles.editorHeading}>
            <div className={styles.editorTabs} role="tablist" aria-label="Studio tools" onKeyDown={navigateTabs}>
              <button role="tab" id="inspector-tab" aria-controls="inspector-content" aria-selected={rightTab === "inspector"} onClick={() => { setRightTab("inspector"); setMobilePanel((current) => current ? "inspector" : null); }}><StudioIcon name="controls" />Inspector</button>
              <button role="tab" id="prompt-tab" aria-controls="prompt-content" aria-selected={rightTab === "prompt"} onClick={() => { setRightTab("prompt"); setMobilePanel((current) => current ? "prompt" : null); }}><StudioIcon name="prompt" />Prompt{run?.state === "running" && <i className={styles.runningDot} />}</button>
            </div>
            <button type="button" aria-label="Close editor" className={styles.mobileClose} onClick={closePanel}><StudioIcon name="close" /></button>
          </header>
          <div className={styles.inspectorContent} role="tabpanel" id="inspector-content" aria-labelledby="inspector-tab" hidden={rightTab !== "inspector"}>
            <header className={styles.selectedHeading}><p>Selected layer</p><h2>{layer ? displayLayerTitle(layer) : "Nothing selected"}</h2>{layer?.kind === "source" && <button onClick={() => { setEditRequest((value) => value + 1); showPrompt(); }}><StudioIcon name="prompt" />Revise with a prompt</button>}</header>
            {selectedWorkflow && technique && <div className={styles.controlTabs} role="tablist" aria-label="Inspector sections" onKeyDown={navigateTabs}>
              {([["technique", "Technique"], ["placement", "Placement"], ["style", "Style"]] as const).map(([id, label]) => <button aria-selected={tab === id} key={id} onClick={() => setTab(id)} role="tab" type="button">{label}</button>)}
            </div>}
            <div className={styles.controlsScroll} tabIndex={0} aria-label="Layer controls">
              {layer?.kind === "source" ? <>
                <SourceControls layer={layer} controls={controls} pending={sourceUpdating} onChange={(next) => void updateSourceControls(layer, next)} onChangeLayer={(change) => commit({ ...document, layers: document.layers.map((item) => item.id === layer.id ? { ...item, ...change } : item) })} />
                <details className={styles.saveDisclosure}><summary>Save to your layer collection</summary><SaveLayerPanel key={`${layer.id}-${layer.content.previewArtifactHash}`} layer={layer} document={document} disabled={sourceUpdating || candidateActive} /></details>
              </> : selectedWorkflow && technique ? tab === "placement" ? <TransformControls layer={selectedWorkflow} onChange={(change) => at(selected, change)} /> : <LayerControls layer={selectedWorkflow} technique={technique} onChange={(change) => at(selected, change)} section={tab} /> : <div className={styles.empty}><p>Choose a layer to edit its controls, placement, and colors.</p></div>}
            </div>
          </div>
          <div className={styles.promptContent} role="tabpanel" id="prompt-content" aria-labelledby="prompt-tab" hidden={rightTab !== "prompt"}>
            <PromptPanel editRequest={editRequest} selectedLayerId={layer?.id} documentHandle={handle} revisionHash={revision} run={run} candidate={candidate} status={null} onGenerate={start} onCancel={cancel} onApply={apply} onRebase={rebase} />
          </div>
        </aside>
      </div>
      <nav className={styles.mobileDock} aria-label="Workspace panels">
        <button id="toggle-layers" aria-controls="studio-layers" aria-expanded={mobilePanel === "layers"} onClick={() => openPanel("layers")}><StudioIcon name="layers" />Layers<span>{document.layers.length}</span></button>
        <button id="toggle-inspector" aria-controls="studio-inspector" aria-expanded={mobilePanel === "inspector"} onClick={() => openPanel("inspector")}><StudioIcon name="controls" />Inspector</button>
        <button id="toggle-prompt" aria-controls="studio-inspector" aria-expanded={mobilePanel === "prompt"} onClick={() => openPanel("prompt")}><StudioIcon name="prompt" />Prompt{run?.state === "running" && <i className={styles.runningDot} />}</button>
      </nav>
      <footer className={styles.statusbar}><span><i />{isSaved ? "Project saved" : "Local recovery enabled"}</span><span>{document.layers.length} of {MAX_LAYERS} layers <b>·</b> p5.js</span></footer>
      <input className="file-input" ref={file} type="file" accept="application/json" onChange={(event) => importFile(event.currentTarget)} />
      <LayerPicker onSelectSaved={addSaved} open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(id) => { add(id as TechniqueId); setPickerOpen(false); }} />
      <StudioDialog open={dialog === "projects"} title="Saved projects" onClose={() => setDialog(null)}>
        <p>Return to a saved composition, or import a document.</p>
        <div className={styles.fileActions}><button onClick={() => void refresh()}>Refresh</button><button onClick={() => { setDialog(null); file.current?.click(); }}>Import JSON</button></div>
        <input type="search" aria-label="Search projects" placeholder="Find a project…" value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} />
        <ul className={styles.projectList}>{projects.filter((project) => project.title.toLowerCase().includes(projectSearch.toLowerCase())).map((project) => <li key={project.id}><button onClick={() => void load(project.id)}><StudioIcon name="folder" /><span><strong>{project.title}</strong><small>{new Date(project.updatedAt).toLocaleString()}</small></span></button></li>)}</ul>
        {projects.length === 0 && <p>No saved projects yet. Save your current composition to keep it here.</p>}
      </StudioDialog>
      <StudioDialog open={dialog === "export"} title="Export composition" onClose={() => setDialog(null)}>
        <p>Take a snapshot of the canvas or keep an editable document.</p>
        <div className={styles.exportOptions}><button aria-label="Export PNG" onClick={exportPng}><StudioIcon name="download" /><span><strong>Export PNG</strong><small>Full resolution image · 640 × 640</small></span></button><button aria-label="Export JSON" onClick={exportJson}><StudioIcon name="layers" /><span><strong>Export JSON</strong><small>Editable layers and settings</small></span></button></div>
        <p className={styles.exportNote}>Generated layers in JSON refer to this installation’s source and preview files. Keep the artifact store with your document.</p>
      </StudioDialog>
      <StudioDialog open={dialog === "help"} title="Canvas controls" onClose={() => setDialog(null)}>
        <p>Drag a workflow layer on the canvas to move it. Use <strong>Placement</strong> to set its position, scale, and rotation.</p>
        <dl className={styles.shortcuts}><div><dt>R</dt><dd>New seed for eligible workflows</dd></div><div><dt>Ctrl / ⌘ Z</dt><dd>Undo canvas edits; add Shift to redo</dd></div><div><dt>X / Y</dt><dd>Cut a selected CutMarks region vertically / horizontally</dd></div><div><dt>Delete</dt><dd>Remove the selected cut region</dd></div><div><dt>Escape</dt><dd>Clear the region selection or cancel a drag</dd></div></dl>
        <p>Click the canvas before using these shortcuts. In CutMarks, switch between <strong>Move layer</strong> and <strong>Cut regions</strong> in the canvas toolbar. Changing the seed or base layout clears manual cuts.</p>
      </StudioDialog>
    </main>
  );
}
