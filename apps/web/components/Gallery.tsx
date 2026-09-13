"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchSavedLayers, type SavedLayer } from "@/lib/saved-layers";
import { artifactUrl } from "@/lib/harness-client";
type Entry = {
  slug: string;
  title: string;
  description: string;
  category: string;
  studio: boolean;
};
export function Gallery({ techniques }: { techniques: Entry[] }) {
  const [saved, setSaved] = useState<SavedLayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; fetchSavedLayers().then((items) => { if (active) setSaved(items); }).catch((cause) => { if (active) setError(String(cause)); }); return () => { active = false; }; }, []);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const categories = [
    "All",
    "Saved layers",
    ...Array.from(new Set(techniques.map((t) => t.category))),
  ];
  const shown = useMemo(
    () =>
      techniques.filter(
        (t) =>
          (category === "All" || t.category === category) &&
          `${t.title} ${t.description}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [techniques, q, category],
  );
  const savedShown = saved.filter((item) => (category === "All" || category === "Saved layers") && `${item.title} ${item.description}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="gallery-section" aria-label="Technique gallery">
      <div className="gallery-tools">
        <label className="search">
          <span className="sr-only">Search techniques</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search studies and saved layers"
          />
        </label>
        <div className="filters" aria-label="Technique category">
          {categories.map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <p className="gallery-count">
        {shown.length + savedShown.length} {shown.length + savedShown.length === 1 ? "item" : "items"}
      </p>
      <div className="gallery-grid">
        {savedShown.map((item) => {
          const layer = item.document.layers[0];
          return <Link className="study-card" href={`/layers/${item.id}`} key={item.id}>
            <div className="thumbnail" style={{ background: item.document.background }}>
              {layer?.kind === "source" && layer.content.previewArtifactHash && <img src={artifactUrl(layer.content.previewArtifactHash)} alt="" loading="lazy" style={{ opacity: layer.opacity }} />}
            </div>
            <div><p className="card-category">Saved layers</p><h2>{item.title}</h2><p>{item.description || "Generated p5.js layer · ready to reuse and revise"}</p></div>
          </Link>;
        })}
        {shown.map((t) => (
          <Link
            className="study-card"
            href={`/techniques/${t.slug}`}
            key={t.slug}
          >
            <div className="thumbnail">
              <img
                src={`/previews/${t.slug}.png`}
                alt=""
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="thumbnail-fallback">{t.category}</span>
              {t.studio && <span className="studio-dot">Studio</span>}
            </div>
            <div>
              <p className="card-category">{t.category}</p>
              <h2>{t.title}</h2>
              <p>{t.description}</p>
            </div>
          </Link>
        ))}
      </div>
      {error && <p className="service-error" role="alert">Saved layers unavailable: {error}</p>}
      {shown.length + savedShown.length === 0 && (
        <p className="empty">No items match. Save a generated layer from Studio or Explorations to find it here.</p>
      )}
    </section>
  );
}
