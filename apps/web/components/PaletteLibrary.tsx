"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { paletteRequest, validatePalette, type PaletteDraft, type SavedPalette } from "@/lib/palettes";
import { defaultPalettes, type DefaultPalette } from "@/lib/default-palettes";
import styles from "./PaletteLibrary.module.css";

const initialColors = ["#172522", "#146b5e", "#e9b874", "#f5f1e9"];
export function PaletteSwatches({ colors }: { colors: string[] }) {
  return <div className={styles.swatches} aria-label={colors.join(", ")}>{colors.map((color, index) => <span key={index} style={{ background: color }} title={color} />)}</div>;
}

export function PaletteLibrary({ onUse, useLabel = "Apply to layer", currentColors }: { onUse?: (palette: PaletteDraft) => void; useLabel?: string; currentColors?: string[] }) {
  const [palettes, setPalettes] = useState<SavedPalette[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<PaletteDraft | null>(null);
  const [editing, setEditing] = useState<SavedPalette | null>(null);
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const refresh = async () => {
    setLoading(true);
    try { const result = await paletteRequest<{ palettes: SavedPalette[] }>("GET"); if (mounted.current) setPalettes(result.palettes); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not load palettes."); }
    finally { if (mounted.current) setLoading(false); }
  };
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; abort.current?.abort(); }; }, []);
  const begin = (value?: PaletteDraft, saved?: SavedPalette) => {
    setDraft(value ? structuredClone(value) : { name: "", colors: [...initialColors] });
    setEditing(saved ?? null); setPrompt(""); setError(""); setNotice(""); setDeleting(null);
  };
  useEffect(() => { if (draft) heading.current?.focus(); }, [Boolean(draft)]);
  const generate = async () => {
    if (generating || prompt.trim().length < 3) return;
    const controller = new AbortController(); abort.current = controller;
    setGenerating(true); setError(""); setNotice("");
    try {
      const response = await fetch("/harness/palettes/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, count }), signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not generate colors.");
      const palette = validatePalette(result.palette);
      if (mounted.current && !controller.signal.aborted) { setDraft(palette); setNotice("Colors ready. Adjust them below, then save your palette."); }
    } catch (cause) { if (mounted.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not generate colors."); }
    finally { if (mounted.current && abort.current === controller) { setGenerating(false); abort.current = null; } }
  };
  const save = async () => {
    if (!draft || busy) return;
    setError(""); setBusy(true);
    try {
      const checked = validatePalette(draft);
      const { palette } = await paletteRequest<{ palette: SavedPalette }>(editing ? "PUT" : "POST", { ...checked, ...(editing ? { id: editing.id, revision: editing.revision } : {}) });
      if (!mounted.current) return;
      setPalettes((items) => [palette, ...items.filter((item) => item.id !== palette.id)]);
      setDraft(null); setEditing(null); setNotice(`Saved “${palette.name}”.`); setSearch("");
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not save palette."); }
    finally { if (mounted.current) setBusy(false); }
  };
  const remove = async (palette: SavedPalette) => {
    setBusy(true); setError("");
    try {
      await paletteRequest("DELETE", { id: palette.id, revision: palette.revision });
      if (mounted.current) { setPalettes((items) => items.filter((item) => item.id !== palette.id)); setDeleting(null); setNotice(`Deleted “${palette.name}”. Colors already used in sketches are kept.`); }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not delete palette."); }
    finally { if (mounted.current) setBusy(false); }
  };
  const changeColor = (index: number, color: string) => setDraft((value) => value && ({ ...value, colors: value.colors.map((item, n) => n === index ? color : item) }));
  const move = (index: number, direction: number) => setDraft((value) => {
    if (!value) return value;
    const colors = [...value.colors]; [colors[index], colors[index + direction]] = [colors[index + direction], colors[index]];
    return { ...value, colors };
  });
  const searchTerms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (palette: { name: string; tags?: readonly string[] }) => searchTerms.every((term) => [palette.name, ...(palette.tags ?? [])].some((value) => value.toLowerCase().includes(term)));
  const filtered = palettes.filter(matches);
  const filteredDefaults = defaultPalettes.filter(matches);
  const useDefault = (palette: DefaultPalette) => onUse?.({ name: palette.name, colors: [...palette.colors] });
  const customizeDefault = (palette: DefaultPalette) => begin({ name: palette.name, colors: [...palette.colors] });
  return <section className={styles.library} aria-label="Palette library">
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {draft ? <>
      <div className={styles.toolbar}><h2 ref={heading} tabIndex={-1}>{editing ? "Edit palette" : "Create a palette"}</h2><button type="button" disabled={busy || generating} onClick={() => { setDraft(null); setError(""); setNotice(""); }}>Back to library</button></div>
      <p>Pick your colors, or describe a mood to create a starting point.</p>
      <fieldset className={styles.generator} disabled={busy || generating}>
        <legend>Create with a prompt</legend>
        <label>Describe your palette<textarea aria-label="Palette prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={2000} placeholder="Muted ocean blues, sea-glass green, and a warm sand accent" rows={3} /></label>
        <div className={styles.actions}><label>Colors<select value={count} onChange={(event) => setCount(Number(event.target.value))}>{Array.from({ length: 11 }, (_, i) => i + 2).map((n) => <option key={n}>{n}</option>)}</select></label><button type="button" onClick={() => void generate()} disabled={prompt.trim().length < 3}>{generating ? "Creating colors…" : "Generate colors"}</button></div>
      </fieldset>
      {generating && <button type="button" onClick={() => { abort.current?.abort(); setGenerating(false); }}>Cancel generation</button>}
      <fieldset className={styles.editor} disabled={busy || generating}>
        <legend>Palette colors</legend>
        <label>Palette name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={80} placeholder="Give these colors a name" /></label>
        <PaletteSwatches colors={draft.colors} />
        <p className={styles.hint}>Order matters: each layer uses colors in its own way. Keep 2–12 colors.</p>
        <div className={styles.colors}>{draft.colors.map((color, index) => <div className={styles.color} key={index}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <input type="color" aria-label={`Library color ${index + 1}`} value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#000000"} onChange={(event) => changeColor(index, event.target.value)} />
          <input type="text" aria-label={`Library color ${index + 1} hex`} value={color} onChange={(event) => changeColor(index, event.target.value)} maxLength={7} spellCheck={false} aria-invalid={!/^#[0-9a-f]{6}$/i.test(color)} />
          <button type="button" aria-label={`Move color ${index + 1} earlier`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
          <button type="button" aria-label={`Move color ${index + 1} later`} disabled={index === draft.colors.length - 1} onClick={() => move(index, 1)}>↓</button>
          <button type="button" aria-label={`Remove library color ${index + 1}`} disabled={draft.colors.length <= 2} onClick={() => setDraft({ ...draft, colors: draft.colors.filter((_, n) => n !== index) })}>−</button>
        </div>)}</div>
        <button type="button" disabled={draft.colors.length >= 12} onClick={() => setDraft({ ...draft, colors: [...draft.colors, draft.colors.at(-1) ?? "#000000"] })}>Add palette color</button>
      </fieldset>
      <div className={styles.saveBar}><span>{editing ? "Updates the library. Existing sketches keep their colors." : "Saved palettes are available throughout this installation."}</span><button className={styles.primary} type="button" disabled={busy || generating || !draft.name.trim() || draft.colors.some((color) => !/^#[0-9a-f]{6}$/i.test(color))} onClick={() => void save()}>{busy ? "Saving…" : "Save palette"}</button></div>
    </> : <>
      <div className={styles.toolbar}><div><h2>Your palettes</h2><p>Color collections for every sketch.</p></div><button className={styles.primary} type="button" onClick={() => begin()}>Create palette</button></div>
      {currentColors && <button type="button" onClick={() => begin({ name: "", colors: [...currentColors] })}>Save current layer colors</button>}
      <div className={styles.search}><input type="search" aria-label="Search palettes" placeholder="Find a palette…" value={search} onChange={(event) => setSearch(event.target.value)} /><button type="button" disabled={loading || busy} onClick={() => { setError(""); void refresh(); }}>Refresh</button></div>
      {loading && <p role="status">Loading your palettes…</p>}
      {!loading && !filtered.length && <div className={styles.empty}><p>{palettes.length ? "No palettes match your search." : "A color collection starts with a few colors you love."}</p>{!palettes.length && <p>Create one with the color picker or a prompt, then use it in any sketch.</p>}</div>}
      <div className={styles.grid}>{filtered.map((palette) => <article key={palette.id} className={styles.card} aria-label={palette.name}>
        <PaletteSwatches colors={palette.colors} /><div className={styles.cardBody}><h3>{palette.name}</h3><p>{palette.colors.length} colors</p>
        {onUse && <button className={styles.primary} type="button" onClick={() => onUse({ name: palette.name, colors: [...palette.colors] })}>{useLabel}</button>}
        <div className={styles.actions}><button type="button" disabled={busy} onClick={() => begin(palette, palette)}>Edit</button><button type="button" disabled={busy} onClick={() => begin({ name: `${palette.name.slice(0, 73)} copy`, colors: [...palette.colors] })}>Duplicate</button><button type="button" disabled={busy} onClick={() => setDeleting(palette.id)}>Delete</button></div>
        {deleting === palette.id && <div className={styles.confirm}><p>Delete this palette from the library? Existing sketches keep their colors.</p><div className={styles.actions}><button type="button" disabled={busy} onClick={() => void remove(palette)}>Delete palette</button><button type="button" disabled={busy} onClick={() => setDeleting(null)}>Keep palette</button></div></div>}
        </div></article>)}</div>
      <div className={styles.defaultHeader}><h2>Default palettes</h2><p>Ready-to-use color directions. Customize one to make it yours.</p></div>
      {!filteredDefaults.length && <div className={styles.empty}><p>No default palettes match your search.</p></div>}
      <div className={styles.grid}>{filteredDefaults.map((palette) => <article key={palette.id} className={styles.card} aria-label={palette.name}>
        <PaletteSwatches colors={[...palette.colors]} /><div className={styles.cardBody}><h3>{palette.name}</h3><p>{palette.description}</p><div className={styles.tags} aria-label={`${palette.name} color tags`}>{palette.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        {onUse && <button className={styles.primary} type="button" onClick={() => useDefault(palette)}>{useLabel}</button>}
        <div className={styles.actions}><button type="button" onClick={() => customizeDefault(palette)}>Customize</button></div>
        </div></article>)}</div>
    </>}
  </section>;
}

export function PalettePicker({ onUse, currentColors, useLabel, label = "Saved palettes", disabled = false }: { onUse: (palette: PaletteDraft) => void; currentColors?: string[]; useLabel?: string; label?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.body); }, []);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open, host]);
  return <><button type="button" className={styles.launcher} disabled={disabled} onClick={() => setOpen(true)}>{label}</button>{host && createPortal(<dialog ref={dialog} className={styles.dialog} aria-label="Saved palettes" onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
    <header><span>Palette library</span><button type="button" aria-label="Close saved palettes" onClick={() => setOpen(false)}>Close</button></header>
    <div className={styles.dialogScroll}>{open && <PaletteLibrary currentColors={currentColors} useLabel={useLabel} onUse={(palette) => { onUse(palette); setOpen(false); }} />}</div>
  </dialog>, host)}</>;
}

export function PromptPalette({ palette, onChange, disabled }: { palette: PaletteDraft | null; onChange: (palette: PaletteDraft | null) => void; disabled: boolean }) {
  return <div className={styles.promptPalette}><PalettePicker label={palette ? "Change palette" : "Choose a palette"} useLabel="Use in prompt" onUse={onChange} disabled={disabled} />{palette && <><PaletteSwatches colors={palette.colors} /><div className={styles.actions}><span>{palette.name}</span><button type="button" disabled={disabled} onClick={() => onChange(null)}>Clear palette</button></div></>}</div>;
}
