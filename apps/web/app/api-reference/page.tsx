import Link from "next/link";
import api from "@/lib/generated-api.json";

export default function ApiReference() {
  return (
    <main className="api-reference">
      <header className="api-head">
        <p className="eyebrow">Use the building blocks</p>
        <h1>API Reference</h1>
        <p>
          Small, explicit computations you can call from your own JavaScript and
          turn into marks, geometry, or pixels.
        </p>
      </header>
      <div className="api-list">
        {api.operations.map((operation) => (
          <Link href={`/api-reference/${operation.id}`} key={operation.id}>
            <strong>{operation.guide.title}</strong>
            <small>
              <code>{operation.id}</code> · v{operation.version}
            </small>
            <span>{operation.guide.summary}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
