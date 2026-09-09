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
      <TechniquePlayground techniqueId={technique.slug} />
      <div className="detail-grid">
        <article className="markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {technique.markdown}
          </ReactMarkdown>
          <SourcePanel
            source={(technique as { sketchSource?: string }).sketchSource}
            path={(technique as { sketchSourcePath?: string }).sketchSourcePath}
          />
        </article>
        <aside className="operations">
          <p className="eyebrow">Operations</p>
          {technique.operations.map((op) => (
            <Link key={op.id} href={`/api-reference/${op.id}`}>
              <strong>{op.id}</strong>
              <small>v{op.version}</small>
              <span>{op.description}</span>
            </Link>
          ))}
        </aside>
      </div>
    </main>
  );
}
