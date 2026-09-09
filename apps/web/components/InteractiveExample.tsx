"use client";
import { useCallback, useRef } from "react";

export function InteractiveExample({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const fit = useCallback(() => {
    const node = frame.current;
    try {
      const height = node?.contentDocument?.documentElement.scrollHeight;
      if (height && node) node.style.height = `${Math.max(760, height + 8)}px`;
    } catch {
      /* The frame remains safely scrollable if its origin changes. */
    }
  }, []);
  return (
    <iframe ref={frame} title={title} src={src} loading="lazy" onLoad={fit} />
  );
}
