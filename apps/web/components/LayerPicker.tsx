"use client";

import gallery from "@/lib/generated-gallery.json";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./LayerPicker.module.css";

import { fetchSavedLayers, type SavedLayer } from "@/lib/saved-layers";
import { artifactUrl } from "@/lib/harness-client";

type Technique = {
  slug: string;
  title: string;
  description: string;
  category: string;
};

const techniques: Technique[] = gallery.techniques.map((item) => ({ ...item, category: item.category === "Raster & color" ? "Color & raster" : item.category }));

export function LayerPicker({
  open,
  onClose,
  onSelect,
  onSelectSaved,
}: {
  open: boolean;
  onClose(): void;
  onSelect(techniqueId: string): void;
  onSelectSaved?: (layer: SavedLayer) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [saved, setSaved] = useState<SavedLayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const categories = useMemo(
    () => [
      "All",
      ...(onSelectSaved ? ["Saved layers"] : []),
      ...Array.from(new Set(techniques.map((item) => item.category))),
    ],
    [onSelectSaved],
  );
  const shown = useMemo(() => {
    const search = query.trim().toLowerCase();
    return techniques.filter(
      (item) =>
        (category === "All" || item.category === category) &&
        `${item.title} ${item.description}`.toLowerCase().includes(search),
    );
  }, [category, query]);

  useEffect(() => {
    if (!open || !onSelectSaved) return;
    let active = true;
    setError(null);
    fetchSavedLayers().then((items) => { if (active) setSaved(items); }).catch((cause) => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [open, Boolean(onSelectSaved)]);
  const savedShown = onSelectSaved ? saved.filter((item) => (category === "All" || category === "Saved layers") && `${item.title} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase())) : [];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current =
        window.document.activeElement instanceof HTMLElement
          ? window.document.activeElement
          : null;
      setQuery("");
      setCategory("All");
      dialog.showModal();
      window.requestAnimationFrame(() => searchRef.current?.focus());
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  const close = () => {
    onClose();
    const trigger = returnFocus.current;
    returnFocus.current = null;
    if (trigger) window.requestAnimationFrame(() => trigger.focus());
  };

  const select = (techniqueId: string) => {
    onSelect(techniqueId);
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="layer-picker-title"
      onClose={close}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.close();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>New layer</p>
            <h2 id="layer-picker-title">Choose a layer</h2>
            <p>Start with a study or a saved generated layer, then edit it in the studio.</p>
          </div>
          <button
            className={styles.close}
            type="button"
            aria-label="Close layer picker"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
        </header>

        <label className={styles.search}>
          <span>Search techniques</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or description"
          />
        </label>

        <div className={styles.chips} role="group" aria-label="Filter by technique category">
          {categories.map((item) => (
            <button
              className={category === item ? styles.activeChip : styles.chip}
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className={styles.categorySelect}>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>

        <p className={styles.count} role="status">
          Showing {shown.length + savedShown.length} layers
        </p>
        <div className={styles.grid}>
          {savedShown.map((item) => {
            const layer = item.document.layers[0];
            return <button className={styles.card} key={item.id} type="button" onClick={() => onSelectSaved?.(item)} aria-label={`Add ${item.title} layer`}>
              {layer?.kind === "source" && layer.content.previewArtifactHash && <img src={artifactUrl(layer.content.previewArtifactHash)} alt="" style={{ background: item.document.background }} />}
              <span className={styles.cardBody}><span className={styles.category}>Saved layers</span><strong>{item.title}</strong><span className={styles.description}>{item.description}</span><span className={styles.add}>Add this layer</span></span>
            </button>;
          })}
          {shown.map((item) => (
            <button
              className={styles.card}
              key={item.slug}
              type="button"
              onClick={() => select(item.slug)}
              aria-label={`Add ${item.title} layer`}
            >
              <img src={`/previews/${item.slug}.png`} alt="" loading="lazy" />
              <span className={styles.cardBody}>
                <span className={styles.category}>{item.category}</span>
                <strong>{item.title}</strong>
                <span className={styles.description}>{item.description}</span>
                <span className={styles.add}>Add this layer</span>
              </span>
            </button>
          ))}
          {shown.length + savedShown.length === 0 && (
            <p className={styles.empty}>No layers match this search. Try another term or category.</p>
          )}
        </div>
        {error && <p className={styles.error} role="alert">Saved layers unavailable: {error}</p>}
      </div>
    </dialog>
  );
}
