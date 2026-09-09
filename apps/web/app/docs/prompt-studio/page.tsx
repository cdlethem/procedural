import { readFile } from "node:fs/promises";
import path from "node:path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const guidePath = path.resolve(process.cwd(), "..", "..", "docs", "prompt-studio-guide.md");

export default async function PromptStudioGuidePage() {
  const guide = await readFile(guidePath, "utf8");
  return (
    <main className="detail">
      <article className="markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{guide}</ReactMarkdown>
      </article>
    </main>
  );
}
