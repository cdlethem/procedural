import Link from "next/link";
import api from "@/lib/generated-api.json";

export default function ApiReference() {
  return <main className="api-reference">
    <header className="api-head"><p className="eyebrow">Catalog reference</p><h1>API Reference</h1><p>Constructor, access, output, and failure contracts for the catalog operations.</p></header>
    <div className="api-list">
      {api.operations.map((operation) => <Link href={`/api-reference/${operation.id}`} key={operation.id}>
        <strong>{operation.id}</strong><small>v{operation.version} · {operation.role}</small><span>{operation.description}</span>
      </Link>)}
    </div>
  </main>;
}
