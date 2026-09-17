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
const categoryLabel = (category: string) => category === "Raster & color" ? "Color & raster" : category;

export function Gallery({ techniques }: { techniques: Entry[] }) {
  const [saved, setSaved] = useState<SavedLayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(true);
  useEffect(() => {
    let active = true;
    fetchSavedLayers()
      .then((items) => { if (active) setSaved(items); })
      .catch((cause) => { if (active) setError(String(cause)); })
      .finally(() => { if (active) setLoadingSaved(false); });
    return () => { active = false; };
  }, []);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const categories = [
    "All",
    "Saved layers",
    ...Array.from(new Set(techniques.map((t) => categoryLabel(t.category)))),
  ];
  const shown = useMemo(
    () =>
      techniques.map((t, index) => ({ ...t, number: index + 1 })).filter(
        (t) =>
          (category === "All" || categoryLabel(t.category) === category) &&
          `${t.title} ${t.description}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [techniques, q, category],
  );
  const savedShown = saved.filter((item) => (category === "All" || category === "Saved layers") && `${item.title} ${item.description}`.toLowerCase().includes(q.toLowerCase()));
  const filtered = q !== "" || category !== "All";
  const resetFilters = () => { setQ(""); setCategory("All"); };
  return (
    <section className="gallery-section" aria-label="Technique gallery">
      <div className="gallery-tools">
        <div className="gallery-toolbar">
          <h2>Study index</h2>
          <label className="search">
            <span className="sr-only">Search techniques</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.5" /></svg>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a study or saved layer"
            />
          </label>
        </div>
        <div className="filters" role="group" aria-label="Technique category">
          {categories.map((c) => (
            <button key={c} aria-pressed={category === c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
        <label className="category-select">
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <div className="gallery-results">
        <p className="gallery-count" role="status">
          {shown.length + savedShown.length} {shown.length + savedShown.length === 1 ? "study" : "studies"}
          {category !== "All" && <> / {category}</>}
          {loadingSaved && (category === "All" || category === "Saved layers") && " · Loading saved layers…"}
        </p>
        {filtered ? <button className="clear-filters" onClick={resetFilters}>Clear filters <span aria-hidden="true">×</span></button> : <p className="gallery-hint">Select a study to make it your own</p>}
      </div>
      <div className="gallery-grid">
        {savedShown.map((item) => {
          const layer = item.document.layers[0];
          return <Link className="study-card" href={`/layers/${item.id}`} key={item.id} aria-label={item.title}>
            <div className="thumbnail" style={{ background: item.document.background }}>
              {layer?.kind === "source" && layer.content.previewArtifactHash && <img src={artifactUrl(layer.content.previewArtifactHash)} alt="" loading="lazy" style={{ opacity: layer.opacity }} />}
            </div>
            <div><p className="card-category">Saved layer <span>p5.js</span></p><h2>{item.title}<span aria-hidden="true">↗</span></h2><p>{item.description.split(/(?<=[.!?])\s/)[0] || "A generated layer, ready to reuse and revise."}</p></div>
          </Link>;
        })}
        {shown.map((t) => (
          <Link
            className="study-card"
            href={`/techniques/${t.slug}`}
            key={t.slug}
            aria-label={t.title}
          >
            <div className="thumbnail">
              <img
                src={`/previews/${t.slug}.png`}
                alt=""
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.parentElement?.setAttribute("data-preview-error", "true");
                }}
              />
              <span className="thumbnail-fallback" aria-hidden="true">Preview unavailable<br />Open study to explore</span>
            </div>
            <div>
              <p className="card-category">{categoryLabel(t.category)}<span>{String(t.number).padStart(2, "0")}</span></p>
              <h2>{t.title}<span aria-hidden="true">↗</span></h2>
              <p>{t.description.split(/(?<=[.!?])\s/)[0]}</p>
            </div>
          </Link>
        ))}
      </div>
      {error && (category === "All" || category === "Saved layers") && <p className="service-error" role="alert">Saved layers could not be loaded. The study collection is still available. <a href="/studio">Open Studio</a> to work with your local composition.</p>}
      {shown.length + savedShown.length === 0 && !(loadingSaved && category === "Saved layers") && (
        <div className="empty">
          <h3>{category === "Saved layers" && !q ? "Your next study starts here." : "No studies found."}</h3>
          <p>{category === "Saved layers" && !q ? "Save a generated layer from Studio or Explorations to add it to your collection." : "Try a different search or category to find a starting point."}</p>
          {filtered && <button className="clear-filters" onClick={resetFilters}>Show all studies <span aria-hidden="true">→</span></button>}
        </div>
      )}
    </section>
  );
}
