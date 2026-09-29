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
 * CLIPPING. `clipRingToRect` is Sutherland–Hodgman against an axis-aligned rectangle. It keeps
 * the winding number of every point strictly inside the rectangle, so a glyph clipped ring by
 * ring still fills correctly under the nonzero rule. Edges that run along the rectangle boundary
 * may double back on themselves and enclose no area; fill them, never stroke them (strokes are
 * clipped as polylines with `clipToSupport` instead).
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

/** Sutherland–Hodgman against [0, width] × [0, height]; `null` when fewer than three vertices remain. */
export function clipRingToRect(ring: Ring, width: number, height: number): Ring | null {
  let points: Point[] = ring as Point[];
  const planes: Array<[(p: Point) => number, (a: Point, b: Point) => Point]> = [
    [(p) => p[0], (a, b) => [0, a[1] + (b[1] - a[1]) * (0 - a[0]) / (b[0] - a[0])]],
    [(p) => width - p[0], (a, b) => [width, a[1] + (b[1] - a[1]) * (width - a[0]) / (b[0] - a[0])]],
    [(p) => p[1], (a, b) => [a[0] + (b[0] - a[0]) * (0 - a[1]) / (b[1] - a[1]), 0]],
    [(p) => height - p[1], (a, b) => [a[0] + (b[0] - a[0]) * (height - a[1]) / (b[1] - a[1]), height]],
  ];
  for (const [distance, cut] of planes) {
    if (points.length === 0) return null;
    const next: Point[] = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[j], b = points[i], da = distance(a), db = distance(b);
      if (db >= 0) {
        if (da < 0) next.push(Object.freeze(cut(a, b)) as Point);
        next.push(b);
      } else if (da >= 0) next.push(Object.freeze(cut(a, b)) as Point);
    }
    points = next;
  }
  return points.length >= 3 ? Object.freeze(points) : null;
}

const signedArea = (ring: Ring): number => {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return sum / 2;
};
function ringContains(ring: Ring, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Merge each hole into its outer ring with one short "keyhole" cut, giving filled polygons with no
 * separate contours. The surface has no contour call, and filling rings one by one would paint
 * over counters. Outer rings have positive `Σ(xⱼ·yᵢ − xᵢ·yⱼ)/2` and holes negative (the font's
 * winding, preserved by rotation, positive scaling and `clipRingToRect`); rings of no area are
 * dropped. A hole belongs to the outer ring containing most of its vertices (smaller area on a
 * tie); it is joined at the nearest vertex pair, which lies in the ink, and the cut is traversed
 * out and back so it encloses no area. Bridges that crossed paper would render as hairlines in
 * some rasterizers, which is why holes are never joined to distant rings. A hole with no outer
 * ring encloses nothing and is dropped.
 */
export function keyholeRings(rings: readonly Ring[]): Ring[] {
  const outers: Array<{ ring: Ring; area: number; holes: Ring[]; box: readonly [number, number, number, number] }> = [], holes: Ring[] = [];
  const boxOf = (ring: Ring): readonly [number, number, number, number] => {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const [x, y] of ring) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
    return [left, top, right, bottom];
  };
  for (const ring of rings) {
    const area = signedArea(ring);
    if (Math.abs(area) < 1e-9) continue;
    if (area > 0) outers.push({ ring, area, holes: [], box: boxOf(ring) }); else holes.push(ring);
  }
  for (const hole of holes) {
    const [hl, ht, hr, hb] = boxOf(hole);
    let parent: (typeof outers)[number] | undefined, best = 0;
    for (const outer of outers) {
      // A hole lies inside its outer ring, so their boxes overlap; this prunes almost every pair.
      if (outer.box[0] > hr || outer.box[2] < hl || outer.box[1] > hb || outer.box[3] < ht) continue;
      let count = 0;
      for (const [x, y] of hole) if (ringContains(outer.ring, x, y)) count++;
      if (count > best || (count === best && count > 0 && outer.area < parent!.area)) { best = count; parent = outer; }
    }
    if (parent) parent.holes.push(hole);
  }
  return outers.map(({ ring, holes: inner }): Ring => {
    if (inner.length === 0) return ring;
    const cuts = new Map<number, Array<{ hole: Ring; start: number }>>();
    for (const hole of inner) {
      let bestOuter = 0, bestHole = 0, bestDistance = Infinity;
      ring.forEach((p, i) => hole.forEach((q, j) => {
        const distance = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
        if (distance < bestDistance) { bestDistance = distance; bestOuter = i; bestHole = j; }
      }));
      const at = cuts.get(bestOuter);
      if (at) at.push({ hole, start: bestHole }); else cuts.set(bestOuter, [{ hole, start: bestHole }]);
    }
    const merged: Point[] = [];
    ring.forEach((p, i) => {
      merged.push(p);
      for (const { hole, start } of cuts.get(i) ?? []) {
        for (let step = 0; step <= hole.length; step++) merged.push(hole[(start + step) % hole.length]);
        merged.push(p);
      }
    });
    return Object.freeze(merged);
  });
}

/** Fill polygons from `keyholeRings` with the current fill; each polygon is one shape. */
export function fillRings(surface: CompositionSurface, polygons: readonly Ring[]): void {
  for (const polygon of polygons) {
    surface.beginShape();
    for (const [x, y] of polygon) surface.vertex(x, y);
    surface.endShape(surface.CLOSE);
  }
}
