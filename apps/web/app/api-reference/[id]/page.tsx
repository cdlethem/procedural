import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import api from "@/lib/generated-api.json";
import gallery from "@/lib/generated-gallery.json";

type Schema = {
  type?: string;
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  prefixItems?: Schema[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minItems?: number;
  maxItems?: number;
  enum?: unknown[];
  default?: unknown;
  const?: unknown;
  pattern?: string;
  oneOf?: Schema[];
  anyOf?: Schema[];
  $ref?: string;
};
type Support = {
  target: string;
  core: string;
  native: string;
  technique: string;
};
type Guide = {
  title: string;
  summary: string;
  useWhen: string;
  inputs: Record<string, string>;
  output: string;
  code: string;
  tryThis: string;
  pitfalls?: string[];
  importLine: string;
  exampleResult: unknown[];
};
function InlineMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown components={{ p: ({ children }) => <>{children}</> }}>
      {children}
    </ReactMarkdown>
  );
}
const type = (schema: Schema): string =>
  schema.type === "array"
    ? `array${schema.prefixItems ? ` [${schema.prefixItems.map(type).join(", ")}]` : schema.items ? ` of ${type(schema.items)}` : ""}`
    : (schema.type ?? "value");
const constraints = (schema: Schema) =>
  [
    schema.minimum !== undefined && `≥ ${schema.minimum}`,
    schema.maximum !== undefined && `≤ ${schema.maximum}`,
    schema.exclusiveMinimum !== undefined && `> ${schema.exclusiveMinimum}`,
    schema.exclusiveMaximum !== undefined && `< ${schema.exclusiveMaximum}`,
    schema.minItems !== undefined && `at least ${schema.minItems} items`,
    schema.maxItems !== undefined && `at most ${schema.maxItems} items`,
    schema.enum && `one of ${schema.enum.join(", ")}`,
    schema.const !== undefined && `must equal ${JSON.stringify(schema.const)}`,
    schema.pattern && `matches ${schema.pattern}`,
    schema.oneOf && `one of ${schema.oneOf.map(type).join(" | ")}`,
    schema.anyOf && `any of ${schema.anyOf.map(type).join(" | ")}`,
  ]
    .filter(Boolean)
    .join("; ");
type Field = { path: string; schema: Schema; required: boolean };
function fields(schema: Schema, prefix = "", required = false): Field[] {
  const direct = Object.entries(schema.properties ?? {}).flatMap(
    ([name, value]) => {
      const path = prefix ? `${prefix}.${name}` : name;
      return [
        {
          path,
          schema: value,
          required: schema.required?.includes(name) ?? false,
        },
        ...fields(value, path),
      ];
    },
  );
  if (schema.items)
    direct.push(
      { path: `${prefix}[]`, schema: schema.items, required },
      ...fields(schema.items, `${prefix}[]`),
    );
  schema.prefixItems?.forEach((value, index) =>
    direct.push(
      { path: `${prefix}[${index}]`, schema: value, required },
      ...fields(value, `${prefix}[${index}]`),
    ),
  );
  return direct;
}
function SchemaTable({ title, schema }: { title: string; schema?: Schema }) {
  if (!schema) return null;
  const rows = fields(schema);
  return (
    <section className="api-section">
      <h2>{title}</h2>
      {rows.length ? (
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Presence</th>
              <th>Default</th>
              <th>Constraints</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((field) => (
              <tr key={field.path}>
                <td>
                  <code>{field.path}</code>
                </td>
                <td>{type(field.schema)}</td>
                <td>
                  {field.path.endsWith("]")
                    ? "Each item"
                    : field.required
                      ? "Required"
                      : "Optional"}
                </td>
                <td>
                  {field.schema.default === undefined
                    ? "—"
                    : JSON.stringify(field.schema.default)}
                </td>
                <td>{constraints(field.schema) || "—"}</td>
                <td>{field.schema.description ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>
          <code>{type(schema)}</code>
          {constraints(schema) && `; ${constraints(schema)}`}
        </p>
      )}
    </section>
  );
}
function prose(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(prose).join("; ");
  if (value && typeof value === "object")
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${prose(item)}`)
      .join("; ");
  return String(value);
}
function highlightExample(source: string) {
  return source
    .split(
      /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|`[^`]*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:const|let|return|if|else|for|while|function|export|import|from|new|true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b)/g,
    )
    .map((token, index) => {
      const kind =
        /^\/\//.test(token) || /^\/\*/.test(token)
          ? "comment"
          : /^[`"']/.test(token)
            ? "string"
            : /^\d/.test(token)
              ? "number"
              : /^(const|let|return|if|else|for|while|function|export|import|from|new|true|false|null|undefined)$/.test(
                    token,
                  )
                ? "keyword"
                : "";
      return kind ? (
        <span className={`token-${kind}`} key={index}>
          {token}
        </span>
      ) : (
        token
      );
    });
}
export default async function OperationReference({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    operation = api.operations.find((entry) => entry.id === id);
  if (!operation) notFound();
  const guide = operation.guide as unknown as Guide;
  const example = `${guide.importLine}\n\n${guide.code}`;
  const topLevel = Object.entries(
    (operation.input as unknown as Schema).properties ?? {},
  );
  const examples = gallery.techniques.filter((technique) =>
    technique.operations.some((item) => item.id === operation.id),
  );
  return (
    <main className="api-reference">
      <Link className="back" href="/api-reference">
        ← API Reference
      </Link>
      <header className="api-head">
        <p className="eyebrow">
          <code>{operation.id}</code> · v{operation.version}
        </p>
        <h1>{guide.title}</h1>
        <p>
          <InlineMarkdown>{guide.summary}</InlineMarkdown>
        </p>
      </header>
      <section className="api-guide">
        <div className="api-guide-grid">
          <div>
            <h2>When to use it</h2>
            <p>
              <InlineMarkdown>{guide.useWhen}</InlineMarkdown>
            </p>
            <h2>What you get back</h2>
            <p>
              <InlineMarkdown>{guide.output}</InlineMarkdown>
            </p>
            <h2>Try this next</h2>
            <p>
              <InlineMarkdown>{guide.tryThis}</InlineMarkdown>
            </p>
            {guide.pitfalls?.length ? (
              <>
                <h2>Watch for</h2>
                <ul>
                  {guide.pitfalls.map((pitfall) => (
                    <li key={pitfall}>
                      <InlineMarkdown>{pitfall}</InlineMarkdown>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
          <div>
            <h2>JavaScript</h2>
            <pre className="api-guide-code">
              <code>{highlightExample(example)}</code>
            </pre>
            <h3>Console output</h3>
            <p>
              The example logs these values for the supplied inputs.
            </p>
            <pre className="api-result">
              <code>{JSON.stringify(guide.exampleResult.length === 1 ? guide.exampleResult[0] : guide.exampleResult, null, 2)}</code>
            </pre>
          </div>
        </div>
        <h2>Constructor inputs</h2>
        <table className="api-guide-inputs">
          <thead>
            <tr>
              <th>Name</th>
              <th>What it means</th>
            </tr>
          </thead>
          <tbody>
            {topLevel.map(([name]) => (
              <tr key={name}>
                <td>
                  <code>{name}</code>
                </td>
                <td>
                  <InlineMarkdown>{guide.inputs[name]}</InlineMarkdown>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {examples.length > 0 && (
        <section className="api-examples">
          <h2>Explore interactive examples</h2>
          <p>See this operation used in these editable browser studies.</p>
          <div>
            {examples.map((example) => (
              <Link key={example.slug} href={`/techniques/${example.slug}`}>
                {example.title}
              </Link>
            ))}
          </div>
        </section>
      )}
      <details className="api-contract-details">
        <summary>Detailed API contract</summary>
        <div>
          <SchemaTable
            title="Constructor input"
            schema={operation.input as unknown as Schema}
          />
          <SchemaTable
            title="Query input"
            schema={operation.query as unknown as Schema}
          />
          <SchemaTable
            title="Query output"
            schema={operation.queryOutput as unknown as Schema}
          />
          <SchemaTable
            title="Output"
            schema={operation.output as unknown as Schema}
          />
          <section className="api-section">
            <h2>Errors</h2>
            <table>
              <tbody>
                {[
                  ...(operation.errorOrder as string[]),
                  ...Object.keys(operation.errors).filter(
                    (name) =>
                      !(operation.errorOrder as string[]).includes(name),
                  ),
                ].map((name) => (
                  <tr key={name}>
                    <th>
                      <code>{name}</code>
                    </th>
                    <td>
                      {
                        (operation.errors as unknown as Record<string, string>)[
                          name
                        ]
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="api-section">
            <h2>State, ordering, and semantics</h2>
            {Object.entries(operation.behavior).map(([key, value]) => (
              <div className="semantic" key={key}>
                <h3>{key.replaceAll("_", " ")}</h3>
                <p>{prose(value)}</p>
              </div>
            ))}
          </section>
          <section className="api-section">
            <h2>Current target support</h2>
            <table>
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Core</th>
                  <th>Native</th>
                  <th>Technique</th>
                </tr>
              </thead>
              <tbody>
                {(operation.support as Support[]).map((target) => (
                  <tr key={target.target}>
                    <td>{target.target}</td>
                    <td>{target.core}</td>
                    <td>{target.native}</td>
                    <td>{target.technique}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {operation.javascript && (
            <section className="api-section">
              <h2>JavaScript binding</h2>
              <p>
                Callable export
                {operation.javascript.exports.length === 1 ? "" : "s"}:{" "}
                {operation.javascript.exports.map((name) => (
                  <code key={name}>{name}</code>
                ))}
              </p>
              <pre>
                <code>{`import { ${operation.javascript.exports.join(", ")} } from "${operation.javascript.package}";`}</code>
              </pre>
            </section>
          )}
          <section className="api-section">
            <h2>Provenance</h2>
            {operation.provenance.length ? (
              <ul>
                {(
                  operation.provenance as {
                    candidate: string;
                    sketch: string;
                  }[]
                ).map((source) => (
                  <li key={source.candidate}>
                    <code>{source.sketch}</code> · candidate{" "}
                    {source.candidate.split("#")[1] ?? "0"}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No motivating candidates recorded.</p>
            )}
          </section>
        </div>
      </details>
    </main>
  );
}
