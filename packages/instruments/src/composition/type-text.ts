import { textOutlines } from "../adapters/image-signal-instruments.js";
import { memoized } from "./sources.js";
import type { Ring } from "./support.js";
import type { CompositionSurface, Point } from "./types.js";

/**
 * Text sources and outline geometry for typographic compositions.
 *
 * INPUT CONTRACT. A text source is a resolved, deeply frozen value: an id, one to eight
 * `lines` (each 1–20 printable ASCII characters, U+0020–U+007E, not blank) and one `anchor`
 * caption of the same kind. Nothing is fetched, decoded or measured by a browser: the outlines
 * are the existing licensed outline font's (`textOutlines`, extracted from Word Echo), so the
 * result is identical on every host. This is UNSHAPED LATIN only: glyphs advance by their own
 * widths, with no kerning pairs, ligatures, bidirectional text, combining marks or other scripts.
 * Binding a user's own phrase to an instrument is host work; the library ships bundled phrases
 * and accepts any value that `textSource` admits through the direct function API.
 *
 * OUTPUT. `typeLine(text)` returns the frozen glyph rings of one line in FONT UNITS: x centered
 * on the line's advance width, y = 0 on the baseline and negative above it (y grows down, like
 * the canvas), plus the ink bounds. Rings use the font's own winding, NONZERO fill: outer rings
 * and letter counters have opposite orientation. Positioning uses ink bounds, not advance
 * widths, so leading and trailing spaces do not move a line.
 *
 * CLIPPING AND KEYHOLES. The ring geometry these fills need (`clipRingToRect`, the winding-preserving
 * per-ring rectangle clip, and `keyholeRings`, which joins counters to their letters) lives in
 * `domains.ts` with the rest of the planar-domain code; strokes are clipped as polylines with
 * `clipToSupport`.
 *
 * Failure: an invalid text source throws an `Error` naming the field. No randomness.
 */
export const MAX_TEXT_LINES = 8;
export const MAX_LINE_CHARS = 20;

export interface TextSource {
  readonly id: string;
  /** Phrase lines that the type field repeats; each is one outlined line of type. */
  readonly lines: readonly string[];
  /** A single legible caption kept outside the fragmented modules. */
  readonly anchor: string;
}

function printable(label: string, value: unknown): string {
  if (typeof value !== "string" || !/^[\x20-\x7E]{1,20}$/.test(value) || !value.trim())
    throw new Error(`${label} must be 1–${MAX_LINE_CHARS} printable ASCII characters and not blank`);
  return value;
}

/** Validate a caller-supplied text and return the frozen source value the producers accept. */
export function textSource(input: { id: string; lines: readonly string[]; anchor: string }): TextSource {
  if (typeof input.id !== "string" || !/^[\x21-\x7E]{1,48}$/.test(input.id))
    throw new Error("Text id must be 1–48 printable ASCII characters without spaces");
  if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > MAX_TEXT_LINES)
    throw new Error(`Text needs 1–${MAX_TEXT_LINES} lines`);
  const lines = input.lines.map((line, index) => printable(`Text line ${index + 1}`, line));
  return Object.freeze({ id: input.id, lines: Object.freeze(lines), anchor: printable("Text anchor", input.anchor) });
}

/** The phrases bundled with the library; they are the only text a Studio layer can select. */
export const bundledTextSources: Readonly<Record<string, TextSource>> = Object.freeze(Object.fromEntries([
  { id: "rhythm", lines: ["RHYTHM", "IN", "TYPE"], anchor: "RHYTHM IN TYPE" },
  { id: "more", lines: ["MORE", "IS", "MORE"], anchor: "MORE IS MORE" },
  { id: "slice", lines: ["SLICE", "THE", "GRID"], anchor: "SLICE THE GRID" },
  { id: "again", lines: ["AGAIN", "AND", "AGAIN"], anchor: "AGAIN AND AGAIN" },
  { id: "quiet", lines: ["quiet", "noise", "quiet"], anchor: "quiet noise" },
  { id: "open", lines: ["OPEN", "CLOSE"], anchor: "OPEN / CLOSE" },
].map((source) => [source.id, textSource(source)])));

/** One outlined line of type, in font units (see the header). */
export interface TypeLine {
  readonly text: string;
  readonly rings: readonly Ring[];
  /** Ink bounds. `right - left` is the ink width; `top` is negative above the baseline. */
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

const lineCache = new Map<string, TypeLine>();
export function typeLine(text: string): TypeLine {
  printable("Type line", text);
  return memoized(lineCache, text, () => {
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    // The pinned font carries a few degenerate contours (a lone point in "u"); they enclose nothing.
    const rings = textOutlines(text).filter((ring) => ring.length >= 3).map((ring): Ring => Object.freeze(ring.map(([x, y]): Point => {
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      return Object.freeze([x, y] as const);
    })));
    if (!(right > left && bottom > top)) throw new Error(`Type line ${JSON.stringify(text)} has no outlines`);
    return Object.freeze({ text, rings: Object.freeze(rings), left, right, top, bottom });
  });
}

/** Cap height of the font in font units: the height of "H" above the baseline. */
export const CAP_HEIGHT: number = -typeLine("H").top;

/** Fill polygons from `keyholeRings` with the current fill; each polygon is one shape. */
export function fillRings(surface: CompositionSurface, polygons: readonly Ring[]): void {
  for (const polygon of polygons) {
    surface.beginShape();
    for (const [x, y] of polygon) surface.vertex(x, y);
    surface.endShape(surface.CLOSE);
  }
}
