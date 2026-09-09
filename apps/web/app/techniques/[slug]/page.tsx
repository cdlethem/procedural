import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import gallery from "@/lib/generated-gallery.json";
import { InteractiveExample } from "@/components/InteractiveExample";
export default async function TechniquePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const technique = gallery.techniques.find((t) => t.slug === slug);
  if (!technique) notFound();
  return (
    <main className="detail">
      <Link href="/" className="back">
        ← Gallery
      </Link>
      <header className="detail-head">
        <p className="eyebrow">{technique.category}</p>
        <h1>{technique.title}</h1>
        <p>{technique.description}</p>
        {technique.studio && (
          <Link className="button" href={`/studio?technique=${technique.slug}`}>
            Open in studio <span>→</span>
          </Link>
        )}
      </header>
      <section className="example-panel">
        <div className="example-bar">
          <span>Interactive native study</span>
          <span>
            <a
              href={`/source/${technique.sourcePath}`}
              target="_blank"
              rel="noreferrer"
            >
              Example notes ↗
            </a>
            <a
              href={`/native/examples/${technique.slug}/sketch.js`}
              target="_blank"
              rel="noreferrer"
            >
              Sketch source ↗
            </a>
          </span>
        </div>
        <InteractiveExample
          title={`${technique.title} interactive example`}
          src={technique.exampleUrl}
        />
      </section>
      <div className="detail-grid">
        <article className="markdown">
          <p className="guide-note">
            Adapted from the package’s Processing guides; use browser controls
            above. <a href={`/source/${technique.guidePath}`}>Original guide</a>
          </p>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {technique.markdown}
          </ReactMarkdown>
        </article>
        <aside className="operations">
          <p className="eyebrow">Operations</p>
          {technique.operations.map((op) => (
            <a key={op.id} href={`/source/${op.catalogPath}`}>
              <strong>{op.id}</strong>
              <small>v{op.version}</small>
              <span>{op.description}</span>
            </a>
          ))}
        </aside>
      </div>
    </main>
  );
}
