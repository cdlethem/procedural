import type { SVGProps } from "react";
const paths = {
  plus: "M12 5v14M5 12h14",
  undo: "M9 5 4 10l5 5M4 10h10a6 6 0 0 1 6 6v3",
  redo: "m15 5 5 5-5 5M20 10H10a6 6 0 0 0-6 6v3",
  up: "m6 14 6-6 6 6",
  down: "m6 10 6 6 6-6",
  copy: "M8 8h12v12H8zM16 8V4H4v12h4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
  hidden: "m3 3 18 18M9 5c6-2 11 7 11 7l-3 4M6 6c-3 2-4 6-4 6s4 7 10 7l3-1",
  layers: "m12 3 10 6-10 6L2 9zM2 13l10 6 10-6M2 17l10 6 10-6",
  controls: "M4 7h16M4 17h16M9 4v6M15 14v6",
  prompt: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
  folder: "M3 6h7l2 3h9v11H3z",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
} as const;
export function StudioIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
