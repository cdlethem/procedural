"use client";

import { useState } from "react";

function highlight(source: string) {
  const tokens = source.split(
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|`[^`]*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:const|let|return|if|else|for|while|function|export|import|from|new|true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b)/g,
  );
  return tokens.map((token, index) => {
    let kind = "";
    if (/^\/\//.test(token) || /^\/\*/.test(token)) kind = "comment";
    else if (/^[`"']/.test(token)) kind = "string";
    else if (/^\d/.test(token)) kind = "number";
    else if (
      /^(const|let|return|if|else|for|while|function|export|import|from|new|true|false|null|undefined)$/.test(
        token,
      )
    )
      kind = "keyword";
    return kind ? (
      <span className={`token-${kind}`} key={index}>
        {token}
      </span>
    ) : (
      token
    );
  });
}

export function SourcePanel({
  source,
  path,
}: {
  source?: string;
  path?: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  if (!source) return null;
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard is unavailable");
      await navigator.clipboard.writeText(source);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 1800);
  };
  return (
    <section className="source-panel">
      <details open>
        <summary>Sketch source</summary>
        <div className="source-bar">
          <span>{path ?? "Technique adapter"} · TypeScript</span>
          <button
            type="button"
            className="action secondary"
            onClick={() => void copy()}
          >
            {copyState === "copied"
              ? "Copied"
              : copyState === "failed"
                ? "Copy failed"
                : "Copy"}
          </button>
        </div>
        <pre aria-label="Formatted TypeScript source">
          <code>{highlight(source)}</code>
        </pre>
      </details>
    </section>
  );
}
