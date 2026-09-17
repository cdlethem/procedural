import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import gallery from "@/lib/generated-gallery.json";
import { TechniquePlayground } from "@/components/TechniquePlayground";
import { SourcePanel } from "@/components/SourcePanel";
export default async function TechniquePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const technique = gallery.techniques.find((t) => t.slug === slug);
  if (!technique) notFound();
  return (
    <main id="main-content" tabIndex={-1} className="detail study-detail">
      <Link href="/gallery" className="back">
        ← Gallery
      </Link>
      <header className="study-head">
        <div>
          <p className="eyebrow">{technique.category}</p>
          <h1>{technique.title}</h1>
        </div>
        <div className="study-intro">
          <p>{technique.description}</p>
          {technique.studio && (
            <Link className="button" href={`/studio?technique=${technique.slug}`}>
              Open in studio <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>
      </header>
      <nav className="study-sections" aria-label="Study sections">
        <a href="#study-playground"><span>01</span> Make it yours</a>
        <a href="#study-method"><span>02</span> The method</a>
        <a href="#study-source"><span>03</span> Source code</a>
      </nav>
      <TechniquePlayground techniqueId={technique.slug} />
      <div id="study-method" className="detail-grid study-method">
        <article className="markdown">
          <p className="eyebrow">Inside the procedure</p>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            h1: ({ children }) => <h2>{children}</h2>,
            h2: ({ children }) => <h3>{children}</h3>,
            h3: ({ children }) => <h4>{children}</h4>,
          }}>
            {technique.markdown}
          </ReactMarkdown>
        </article>
        <aside className="operations">
          <h2>Building blocks</h2>
          <p className="operations-note">Use these computations in your own work.</p>
          {technique.operations.map((op) => (
            <Link key={op.id} href={`/api-reference/${op.id}`}>
              <strong>{op.id}</strong>
              <small>v{op.version}</small>
              <span>{op.description}</span>
            </Link>
          ))}
        </aside>
      </div>
      <div id="study-source" className="study-source">
          <SourcePanel
            source={(technique as { sketchSource?: string }).sketchSource}
            path={(technique as { sketchSourcePath?: string }).sketchSourcePath}
          />
      </div>
    </main>
  );
}
