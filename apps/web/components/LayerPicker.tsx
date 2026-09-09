"use client";

import gallery from "@/lib/generated-gallery.json";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./LayerPicker.module.css";

type Technique = {
  slug: string;
  title: string;
  description: string;
  category: string;
};

const techniques = gallery.techniques as Technique[];

export function LayerPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose(): void;
  onSelect(techniqueId: string): void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const categories = useMemo(
    () => [
      "All",
      ...Array.from(new Set(techniques.map((item) => item.category))),
    ],
    [],
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
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setQuery("");
      setCategory("All");
      dialog.showModal();
      searchRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const select = (techniqueId: string) => {
    onSelect(techniqueId);
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="layer-picker-title"
      onClose={onClose}
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
            <h2 id="layer-picker-title">Choose a technique</h2>
            <p>Start with a study, then edit its controls in the studio.</p>
          </div>
          <button
            className={styles.close}
            type="button"
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

        <div className={styles.chips} aria-label="Technique category">
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

        <p className={styles.count} aria-live="polite">
          {shown.length} {shown.length === 1 ? "technique" : "techniques"}
        </p>
        <div className={styles.grid}>
          {shown.map((item) => (
            <button
              className={styles.card}
              key={item.slug}
              type="button"
              onClick={() => select(item.slug)}
              aria-label={`Add ${item.title} layer`}
            >
              <img src={`/previews/${item.slug}.png`} alt="" />
              <span className={styles.cardBody}>
                <span className={styles.category}>{item.category}</span>
                <strong>{item.title}</strong>
                <span className={styles.description}>{item.description}</span>
                <span className={styles.add}>Add this layer</span>
              </span>
            </button>
          ))}
        </div>
        {shown.length === 0 && (
          <p className={styles.empty}>No techniques match that search.</p>
        )}
      </div>
    </dialog>
  );
}
