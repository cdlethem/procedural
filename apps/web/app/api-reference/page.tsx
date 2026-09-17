import { ApiIndex } from "@/components/ApiIndex";
import api from "@/lib/generated-api.json";

export default function ApiReference() {
  return (
    <main id="main-content" tabIndex={-1} className="api-reference">
      <header className="api-head">
        <p className="eyebrow">Use the building blocks</p>
        <h1>API Reference</h1>
        <p>
          Small, explicit computations you can call from your own JavaScript and
          turn into marks, geometry, or pixels.
        </p>
      </header>
      <ApiIndex operations={api.operations.map((operation) => ({
        id: operation.id,
        version: operation.version,
        title: operation.guide.title,
        summary: operation.guide.summary,
      }))} />
    </main>
  );
}
