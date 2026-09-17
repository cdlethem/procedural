"use client";

import Link from "next/link";
import { useState } from "react";

type Entry = { id: string; version: string; title: string; summary: string };

export function ApiIndex({ operations }: { operations: Entry[] }) {
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const shown = operations.filter((operation) => `${operation.title} ${operation.id} ${operation.summary}`.toLowerCase().includes(term));

  return <section aria-label="Operation index">
    <div className="gallery-toolbar api-tools">
      <p className="gallery-count" role="status">{shown.length} of {operations.length} operations</p>
      <label className="search">
        <span className="sr-only">Search operations</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.5" /></svg>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an operation" />
      </label>
    </div>
    <div className="api-list">
      {shown.map((operation) => <Link href={`/api-reference/${operation.id}`} key={operation.id}>
        <strong>{operation.title}</strong>
        <small><code>{operation.id}</code> · v{operation.version}</small>
        <span>{operation.summary}</span>
      </Link>)}
    </div>
    {shown.length === 0 && <div className="empty">
      <h2>No operations found.</h2>
      <p>Search by name, identifier, or what you want to make.</p>
      <button className="clear-filters" onClick={() => setQuery("")}>Show all operations <span aria-hidden="true">→</span></button>
    </div>}
  </section>;
}
