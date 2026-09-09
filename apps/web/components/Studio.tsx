"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import SketchCanvas from "./SketchCanvas";
import {
  createDocument,
  createLayer,
  MAX_LAYERS,
  techniques,
  validateDocument,
} from "@/lib/studio";
import type {
  Layer,
  StudioDocument,
  TechniqueId,
  Technique,
} from "@/lib/studio-types";
const STORE = "procedurals-studio-v1",
  copy = (x: StudioDocument) => validateDocument(JSON.parse(JSON.stringify(x)));
type Hist = {
  doc: StudioDocument;
  past: StudioDocument[];
  future: StudioDocument[];
  hydrated: boolean;
};
type Project = { id: string; title: string; updatedAt: string };
function reduce(
  s: Hist,
  a: { kind: "commit" | "undo" | "redo" | "restore"; doc?: StudioDocument },
): Hist {
  if (a.kind === "restore")
    return { doc: a.doc!, past: [], future: [], hydrated: true };
  if (a.kind === "commit")
    return {
      ...s,
      doc: a.doc!,
      past: [...s.past.slice(-29), copy(s.doc)],
      future: [],
    };
  if (a.kind === "undo" && s.past.length)
    return {
      ...s,
      doc: s.past.at(-1)!,
      past: s.past.slice(0, -1),
      future: [copy(s.doc), ...s.future].slice(0, 30),
    };
  if (a.kind === "redo" && s.future.length)
    return {
      ...s,
      doc: s.future[0],
      past: [...s.past.slice(-29), copy(s.doc)],
      future: s.future.slice(1),
    };
  return s;
}
const isInput = (t: EventTarget | null) =>
  t instanceof HTMLInputElement ||
  t instanceof HTMLSelectElement ||
  t instanceof HTMLTextAreaElement ||
  (t instanceof HTMLElement && t.isContentEditable);
export function Studio() {
  const q = useSearchParams(),
    requested = q.get("technique"),
    requestedId = techniques.some((t) => t.id === requested)
      ? (requested as TechniqueId)
      : undefined;
  const [h, dispatch] = useReducer(reduce, requestedId, (id): Hist => ({
      doc: createDocument(id),
      past: [],
      future: [],
      hydrated: false,
    })),
    [selected, setSelected] = useState(0),
    [active, setActive] = useState(0),
    [status, setStatus] = useState<string | null>(null),
    [renderError, setRenderError] = useState<string | null>(null),
    [title, setTitle] = useState("Untitled project"),
    [projectId, setProjectId] = useState<string | null>(null),
    [projects, setProjects] = useState<Project[]>([]);
  const file = useRef<HTMLInputElement>(null),
    doc = h.doc,
    layer = doc.layers[selected],
    technique = layer && techniques.find((t) => t.id === layer.technique);
  const commit = useCallback((next: StudioDocument) => {
    try {
      dispatch({ kind: "commit", doc: validateDocument(next) });
      setStatus(null);
    } catch (e) {
      setStatus(
        `Change rejected: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, []);
  const at = (
    i: number,
    change: Partial<Layer> & { params?: Layer["params"] },
  ) =>
    commit({
      ...doc,
      layers: doc.layers.map((l, n) =>
        n === i ? { ...l, ...change, params: change.params ?? l.params } : l,
      ),
    });
  const restoredRoute = useRef<string | null>(null);
  useEffect(() => {
    const route = requestedId ?? "local";
    if (restoredRoute.current === route) return;
    restoredRoute.current = route;
    setSelected(0);
    setActive(0);
    setProjectId(null);
    setTitle("Untitled project");
    try {
      const raw = localStorage.getItem(STORE);
      dispatch({
        kind: "restore",
        doc: requestedId
          ? createDocument(requestedId)
          : raw
            ? validateDocument(JSON.parse(raw))
            : doc,
      });
    } catch (e) {
      dispatch({ kind: "restore", doc });
      setStatus(
        `Could not restore local work: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [requestedId]);
  useEffect(() => {
    setSelected((index) => Math.min(index, Math.max(0, doc.layers.length - 1)));
  }, [doc.layers.length]);
  useEffect(() => {
    if (!h.hydrated) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(doc));
    } catch (e) {
      setStatus(
        `Could not autosave locally: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [doc, h.hydrated]);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/projects"),
        b = await r.json();
      if (!r.ok) throw Error(b.error?.message ?? r.statusText);
      setProjects(b.projects ?? []);
    } catch (e) {
      setStatus(
        `Project service unavailable: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const add = (id: TechniqueId) => {
    if (doc.layers.length >= MAX_LAYERS)
      return setStatus(`A document can contain up to ${MAX_LAYERS} layers.`);
    const layers = [...doc.layers, createLayer(id)];
    commit({ ...doc, layers });
    setSelected(layers.length - 1);
    setActive(0);
  };
  const remove = () => {
    if (!layer) return;
    commit({ ...doc, layers: doc.layers.filter((_, i) => i !== selected) });
    setSelected(Math.max(0, selected - 1));
  };
  const duplicate = () => {
    if (!layer) return;
    if (doc.layers.length >= MAX_LAYERS)
      return setStatus(`A document can contain up to ${MAX_LAYERS} layers.`);
    const layers = [...doc.layers];
    layers.splice(selected + 1, 0, {
      ...layer,
      id: createLayer(layer.technique).id,
      params: { ...layer.params },
    });
    commit({ ...doc, layers });
    setSelected(selected + 1);
  };
  const move = (d: number) => {
    const to = selected + d;
    if (to < 0 || to >= doc.layers.length) return;
    const layers = [...doc.layers];
    [layers[selected], layers[to]] = [layers[to], layers[selected]];
    commit({ ...doc, layers });
    setSelected(to);
  };
  const reseed = () =>
    layer && at(selected, { seed: Math.floor(Math.random() * 4294967296) });
  const nudge = (d: number) => {
    const p = technique?.parameters[active];
    if (!p || !layer) return;
    const current = layer.params[p.key];
    let next: string | boolean | number;
    if (p.type === "boolean") next = !current;
    else if (p.type === "select") {
      const options = p.options!;
      const index = options.findIndex((option) => option.value === current);
      next = options[(index + d + options.length) % options.length].value;
    } else
      next = Number(
        Math.max(
          p.min!,
          Math.min(p.max!, (current as number) + d * p.step!),
        ).toFixed(8),
      );
    at(selected, {
      params: {
        ...layer.params,
        [p.key]: next,
      },
    });
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (isInput(e.target) || e.altKey) return;
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && key !== "z") return;
      if (key === "z") dispatch({ kind: e.shiftKey ? "redo" : "undo" });
      else if (key === "d") duplicate();
      else if (key === "r") reseed();
      else if (e.key === "[") nudge(-1);
      else if (e.key === "]") nudge(1);
      else if (/^[1-8]$/.test(e.key) && doc.layers[+e.key - 1]) {
        setSelected(+e.key - 1);
        setActive(0);
      } else if (e.key === "Delete" || e.key === "Backspace") remove();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [doc, selected, active, layer, technique]);
  const importFile = (input: HTMLInputElement) => {
    const f = input.files?.[0];
    if (!f) return;
    if (f.size > 1e6) {
      setStatus("Import rejected: file exceeds 1 MB.");
      input.value = "";
      return;
    }
    void f
      .text()
      .then((x) => {
        commit(validateDocument(JSON.parse(x)));
        setSelected(0);
        setProjectId(null);
      })
      .catch((e) =>
        setStatus(
          `Import rejected: ${e instanceof Error ? e.message : String(e)}`,
        ),
      )
      .finally(() => (input.value = ""));
  };
  const json = () => {
    const u = URL.createObjectURL(
        new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }),
      ),
      a = Object.assign(window.document.createElement("a"), {
        href: u,
        download: "procedurals-studio.json",
      });
    a.click();
    URL.revokeObjectURL(u);
  };
  const png = () => {
    const c = window.document.querySelector(
      ".canvas-wrap canvas",
    ) as HTMLCanvasElement | null;
    if (!c) return setStatus("The canvas is not ready yet.");
    c.toBlob((b) => {
      if (!b) return setStatus("PNG export failed.");
      const u = URL.createObjectURL(b),
        a = Object.assign(window.document.createElement("a"), {
          href: u,
          download: "procedurals-studio.png",
        });
      a.click();
      URL.revokeObjectURL(u);
    }, "image/png");
  };
  const save = async () => {
    try {
      const r = await fetch(
          projectId ? `/api/projects/${projectId}` : "/api/projects",
          {
            method: projectId ? "PUT" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title, document: doc }),
          },
        ),
        b = await r.json();
      if (!r.ok) throw Error(b.error?.message ?? r.statusText);
      setProjectId(b.id);
      await refresh();
    } catch (e) {
      setStatus(
        `Could not save project: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };
  const load = async (id: string) => {
    try {
      const r = await fetch(`/api/projects/${id}`),
        b = await r.json();
      if (!r.ok) throw Error(b.error?.message ?? r.statusText);
      commit(validateDocument(b.document));
      setProjectId(id);
      setTitle(b.title);
      setSelected(0);
    } catch (e) {
      setStatus(
        `Could not load project: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };
  return (
    <main className="studio">
      <header className="studio-head">
        <div>
          <p className="eyebrow">Composition workspace</p>
          <h1>Studio</h1>
        </div>
        <div className="panel-actions">
          <input
            aria-label="Project title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
          <button
            className="action secondary"
            onClick={() => dispatch({ kind: "undo" })}
            disabled={!h.past.length}
          >
            Undo
          </button>
          <button
            className="action secondary"
            onClick={() => dispatch({ kind: "redo" })}
            disabled={!h.future.length}
          >
            Redo
          </button>
          <button className="action" onClick={save}>
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
            {doc.layers.map((l, i) => (
              <li key={l.id}>
                <button
                  className="icon-button"
                  onClick={() => at(i, { visible: !l.visible })}
                  aria-label={`${l.visible ? "Hide" : "Show"} ${l.technique}`}
                >
                  {l.visible ? "◉" : "○"}
                </button>
                <button
                  className={`layer-name ${i === selected ? "selected" : ""}`}
                  aria-pressed={i === selected}
                  onClick={() => {
                    setSelected(i);
                    setActive(0);
                  }}
                >
                  {i + 1}. {techniques.find((t) => t.id === l.technique)?.title}
                </button>
              </li>
            ))}
          </ul>
          <div className="control">
            <label htmlFor="add">Add layer</label>
            <select
              id="add"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) add(e.target.value as TechniqueId);
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                Choose a technique
              </option>
              {techniques.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <div className="panel-actions">
            <button className="action secondary" onClick={() => move(-1)}>
              Move up
            </button>
            <button className="action secondary" onClick={() => move(1)}>
              Move down
            </button>
            <button className="action secondary" onClick={duplicate}>
              Duplicate
            </button>
            <button className="action secondary" onClick={remove}>
              Delete
            </button>
          </div>
        </section>
        <section className="canvas-wrap">
          <SketchCanvas document={doc} onError={setRenderError} />
          <p className="shortcuts">
            Keys: Z undo · Shift Z redo · D duplicate · R reseed · [ ] adjust
            control · 1–8 select layer · Delete remove. Shortcuts pause in
            inputs.
          </p>
          <div className="panel-actions">
            <button className="action secondary" onClick={png}>
              Export PNG
            </button>
            <button className="action secondary" onClick={json}>
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
              onChange={(e) => importFile(e.currentTarget)}
            />
          </div>
        </section>
        <section className="studio-panel">
          <h2>Inspector</h2>
          {layer && technique ? (
            <Inspector
              layer={layer}
              technique={technique}
              active={active}
              setActive={setActive}
              change={(x) => at(selected, x)}
            />
          ) : (
            <p className="shortcuts">Add a layer to begin.</p>
          )}
          <div className="control">
            <label htmlFor="background">Background</label>
            <input
              id="background"
              type="color"
              value={doc.background}
              onChange={(e) => commit({ ...doc, background: e.target.value })}
            />
          </div>
          <h2>Saved projects</h2>
          <button className="action secondary" onClick={refresh}>
            Refresh
          </button>
          <ul className="project-list">
            {projects.map((p) => (
              <li key={p.id}>
                <button onClick={() => load(p.id)}>
                  {p.title}
                  <small>{new Date(p.updatedAt).toLocaleString()}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
function Inspector({
  layer,
  technique,
  active,
  setActive,
  change,
}: {
  layer: Layer;
  technique: Technique;
  active: number;
  setActive: (n: number) => void;
  change: (value: Partial<Layer>) => void;
}) {
  return (
    <>
      <p className="control-description">{technique.description}</p>
      <div className="control">
        <label htmlFor="keyboard-control">Keyboard control</label>
        <select
          id="keyboard-control"
          value={active}
          onChange={(event) => setActive(Number(event.target.value))}
        >
          {technique.parameters.map((parameter, index) => (
            <option key={parameter.key} value={index}>
              {parameter.label}
            </option>
          ))}
        </select>
        <small>
          Click the canvas, then use [ and ] to change{" "}
          {technique.parameters[active]?.label.toLowerCase()}.
        </small>
      </div>
      <div className="control">
        <label htmlFor="opacity">
          Opacity <output>{Math.round(layer.opacity * 100)}%</output>
        </label>
        <input
          id="opacity"
          type="range"
          min="0"
          max="1"
          step=".01"
          value={layer.opacity}
          onChange={(e) => change({ opacity: +e.target.value })}
        />
      </div>
      <div className="control">
        <label htmlFor="seed">Seed</label>
        <input
          id="seed"
          type="number"
          min="0"
          max="4294967295"
          step="1"
          value={layer.seed}
          onChange={(e) => {
            const value = Math.floor(
              Math.max(0, Math.min(4294967295, Number(e.target.value) || 0)),
            );
            change({ seed: value });
          }}
        />
      </div>
      {technique.parameters.map((p, i) => {
        const v = layer.params[p.key],
          set = (x: number | string | boolean) =>
            change({ params: { ...layer.params, [p.key]: x } });
        if (p.type === "boolean")
          return (
            <div className="control" key={p.key}>
              <label>
                <input
                  type="checkbox"
                  checked={v as boolean}
                  onFocus={() => setActive(i)}
                  onChange={(e) => set(e.target.checked)}
                />{" "}
                {p.label}
              </label>
              <small>{p.description}</small>
            </div>
          );
        if (p.type === "select")
          return (
            <div className="control" key={p.key}>
              <label htmlFor={p.key}>{p.label}</label>
              <select
                id={p.key}
                value={v as string}
                onFocus={() => setActive(i)}
                onChange={(e) => set(e.target.value)}
              >
                {p.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <small>{p.description}</small>
            </div>
          );
        return (
          <div className="control" key={p.key}>
            <label htmlFor={p.key}>
              {p.label}
              <output>{v}</output>
            </label>
            <input
              id={p.key}
              type="range"
              min={p.min}
              max={p.max}
              step={p.step}
              value={v as number}
              onFocus={() => setActive(i)}
              onChange={(e) => set(+e.target.value)}
            />
            <small>
              {p.description}
              {active === i ? " Use [ and ] to adjust." : ""}
            </small>
          </div>
        );
      })}
    </>
  );
}
