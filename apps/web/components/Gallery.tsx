"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
type Entry = {
  slug: string;
  title: string;
  description: string;
  category: string;
  studio: boolean;
};
export function Gallery({ techniques }: { techniques: Entry[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const categories = [
    "All",
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
  return (
    <section className="gallery-section" aria-label="Technique gallery">
      <div className="gallery-tools">
        <label className="search">
          <span className="sr-only">Search techniques</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search studies"
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
        {shown.length} {shown.length === 1 ? "study" : "studies"}
      </p>
      <div className="gallery-grid">
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
      {shown.length === 0 && (
        <p className="empty">No studies match that search.</p>
      )}
    </section>
  );
}
