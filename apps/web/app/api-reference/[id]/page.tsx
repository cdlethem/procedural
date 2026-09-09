import Link from "next/link";
import { notFound } from "next/navigation";
import api from "@/lib/generated-api.json";

type Schema = { type?: string; description?: string; properties?: Record<string, Schema>; required?: string[]; items?: Schema; prefixItems?: Schema[]; minimum?: number; maximum?: number; exclusiveMinimum?: number; exclusiveMaximum?: number; minItems?: number; maxItems?: number; enum?: unknown[]; default?: unknown; const?: unknown; pattern?: string; oneOf?: Schema[]; anyOf?: Schema[]; $ref?: string };
type Support = { target: string; core: string; native: string; technique: string };
const type = (schema: Schema): string => schema.type === "array" ? `array${schema.prefixItems ? ` [${schema.prefixItems.map(type).join(", ")}]` : schema.items ? ` of ${type(schema.items)}` : ""}` : schema.type ?? "value";
const constraints = (schema: Schema) => [schema.minimum !== undefined && `≥ ${schema.minimum}`, schema.maximum !== undefined && `≤ ${schema.maximum}`, schema.exclusiveMinimum !== undefined && `> ${schema.exclusiveMinimum}`, schema.exclusiveMaximum !== undefined && `< ${schema.exclusiveMaximum}`, schema.minItems !== undefined && `at least ${schema.minItems} items`, schema.maxItems !== undefined && `at most ${schema.maxItems} items`, schema.enum && `one of ${schema.enum.join(", ")}`, schema.const !== undefined && `must equal ${JSON.stringify(schema.const)}`, schema.pattern && `matches ${schema.pattern}`, schema.oneOf && `one of ${schema.oneOf.map(type).join(" | ")}`, schema.anyOf && `any of ${schema.anyOf.map(type).join(" | ")}`].filter(Boolean).join("; ");
type Field = { path: string; schema: Schema; required: boolean };
function fields(schema: Schema, prefix = "", required = false): Field[] {
  const direct = Object.entries(schema.properties ?? {}).flatMap(([name, value]) => {
    const path = prefix ? `${prefix}.${name}` : name;
    return [{ path, schema: value, required: schema.required?.includes(name) ?? false }, ...fields(value, path)];
  });
  if (schema.items) direct.push({ path: `${prefix}[]`, schema: schema.items, required }, ...fields(schema.items, `${prefix}[]`));
  schema.prefixItems?.forEach((value, index) => direct.push({ path: `${prefix}[${index}]`, schema: value, required }, ...fields(value, `${prefix}[${index}]`)));
  return direct;
}
function SchemaTable({ title, schema }: { title: string; schema?: Schema }) {
  if (!schema) return null;
  const rows = fields(schema);
  return <section className="api-section"><h2>{title}</h2>{rows.length ? <table><thead><tr><th>Field</th><th>Type</th><th>Presence</th><th>Default</th><th>Constraints</th><th>Description</th></tr></thead><tbody>{rows.map((field) => <tr key={field.path}><td><code>{field.path}</code></td><td>{type(field.schema)}</td><td>{field.path.endsWith("]") ? "Each item" : field.required ? "Required" : "Optional"}</td><td>{field.schema.default === undefined ? "—" : JSON.stringify(field.schema.default)}</td><td>{constraints(field.schema) || "—"}</td><td>{field.schema.description ?? "—"}</td></tr>)}</tbody></table> : <p><code>{type(schema)}</code>{constraints(schema) && `; ${constraints(schema)}`}</p>}</section>;
}
function prose(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(prose).join("; ");
  if (value && typeof value === "object") return Object.entries(value).map(([key, item]) => `${key}: ${prose(item)}`).join("; ");
  return String(value);
}
export default async function OperationReference({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, operation = api.operations.find((entry) => entry.id === id);
  if (!operation) notFound();
  return <main className="api-reference"><Link className="back" href="/api-reference">← API Reference</Link><header className="api-head"><p className="eyebrow">{operation.role} · v{operation.version}</p><h1>{operation.id}</h1><p>{operation.description}</p></header>
    <SchemaTable title="Constructor input" schema={operation.input as unknown as Schema} /><SchemaTable title="Query input" schema={operation.query as unknown as Schema} /><SchemaTable title="Query output" schema={operation.queryOutput as unknown as Schema} /><SchemaTable title="Output" schema={operation.output as unknown as Schema} />
    <section className="api-section"><h2>Errors</h2><table><tbody>{[...(operation.errorOrder as string[]), ...Object.keys(operation.errors).filter((name) => !(operation.errorOrder as string[]).includes(name))].map((name) => <tr key={name}><th><code>{name}</code></th><td>{(operation.errors as unknown as Record<string, string>)[name]}</td></tr>)}</tbody></table></section>
    <section className="api-section"><h2>State, ordering, and semantics</h2>{Object.entries(operation.behavior).map(([key, value]) => <div className="semantic" key={key}><h3>{key.replaceAll("_", " ")}</h3><p>{prose(value)}</p></div>)}</section>
    <section className="api-section"><h2>Current target support</h2><table><thead><tr><th>Target</th><th>Core</th><th>Native</th><th>Technique</th></tr></thead><tbody>{(operation.support as Support[]).map((target) => <tr key={target.target}><td>{target.target}</td><td>{target.core}</td><td>{target.native}</td><td>{target.technique}</td></tr>)}</tbody></table></section>
    {operation.javascript && <section className="api-section"><h2>JavaScript binding</h2><p>Callable export{operation.javascript.exports.length === 1 ? "" : "s"}: {operation.javascript.exports.map((name) => <code key={name}>{name}</code>)}</p><pre><code>{`import { ${operation.javascript.exports.join(", ")} } from "${operation.javascript.package}";`}</code></pre></section>}
    <section className="api-section"><h2>Provenance</h2>{operation.provenance.length ? <ul>{(operation.provenance as { candidate: string; sketch: string }[]).map((source) => <li key={source.candidate}><code>{source.sketch}</code> · candidate {source.candidate.split("#")[1] ?? "0"}</li>)}</ul> : <p>No motivating candidates recorded.</p>}</section>
  </main>;
}
