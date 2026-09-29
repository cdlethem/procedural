import { fontGlyph } from "../adapters/image-signal-instruments.js";
import type { AdvanceItem } from "./path-type.js";
import type { Ring } from "./support.js";
import { keyholeRings } from "./domains.js";
import { CAP_HEIGHT } from "./type-text.js";
import type { Point } from "./types.js";

/**
 * Shaped glyph runs: the text side of Path Typography, before any layout on a path.
 *
 * INPUT CONTRACT. A `PathText` is a resolved, frozen value: an id and one line of 1–120 printable
 * ASCII characters (U+0020–U+007E) containing at least one that is not a space. The library never
 * fetches, decodes or measures a font in a browser; outlines and advance widths come from the same
 * pinned, licensed outline font as Word Echo (`fontGlyph`), so every host gets identical geometry.
 * The instrument persists only a technique id, scalar settings and a palette, so it selects among
 * `bundledPathTexts` through a validated `select`; any caller can build its own value with
 * `pathText`. Binding a user's own text to a saved layer is future host work.
 *
 * WHAT SHAPING MEANS HERE. This is UNSHAPED LATIN: one code point, one glyph, left to right. There
 * are no ligatures, no scripts other than Basic Latin, no bidirectional text, no combining marks,
 * and the font carries no kerning table. `shapeRun` therefore states its own pair-adjustment rule:
 *   metric   each glyph advances by its own width (what the font says, nothing more);
 *   optical  each adjacent pair of inked glyphs is moved together or apart so that the mean white
 *            gap between their facing outlines equals that of "H" beside "H" (see below);
 *   mono     every glyph advances by the widest advance in the text and is centred in its cell.
 * Then `tracking` (in cap heights, signed) is added after every glyph. All of this happens BEFORE
 * layout: `shapeRun` knows nothing about a path.
 *
 * OPTICAL RULE. For 320 rows (half a font unit apart) spanning from above the ascenders to below the descenders, a glyph's right profile is the distance from its
 * advance edge back to its rightmost ink in the row (its left profile is the distance from its origin
 * to its leftmost ink); a row without ink counts as `OPTICAL_DEPTH` (0.25 cap heights), and so does
 * any distance beyond it, so an open shape such as "T" or "V" pulls its neighbour in only to a
 * bounded depth. Rows where neither glyph has ink are ignored. The mean of (right profile of the
 * first + left profile of the second) over the remaining rows is the pair's mean gap; the
 * adjustment is `gap("H","H") − gap(a, b)`, clamped to [−0.35, +0.15] cap heights and never closing
 * the pair past `OPTICAL_CLEARANCE` (0.06 cap heights) between facing ink in any row both occupy, so a
 * crossbar stops short of a stem. Straight-sided pairs are untouched, rounds and diagonals are pulled in. The adjustment is split equally
 * between the two glyphs' intervals, so the run length is the sum of advances plus adjustments and
 * tracking exactly.
 *
 * OUTPUT. Each glyph becomes a `GlyphItem`: an `AdvanceItem` in FONT UNITS (one font unit is
 * `size / CAP_HEIGHT` canvas units for a cap height `size`) whose `ink` rings are centred on the
 * middle of its interval (x) with y = 0 on the baseline and negative above it, in the font's own
 * winding (nonzero fill). `fill` holds the same shape as keyholed polygons (each hole merged into its
 * outer ring by `keyholeRings`) so a surface without a contour call can fill counters correctly.
 * Spaces are `spacer` items. Item ids are `g<index>` in text order; `word` counts runs of non-space.
 * Runs are cached by text and options and are deeply frozen.
 *
 * Failure: an invalid text or option throws naming the field. No randomness.
 */
export const MAX_PATH_TEXT = 120;
/** Depth beyond which white space no longer counts for optical spacing, in cap heights. */
export const OPTICAL_DEPTH = 0.25;
/** Least ink-to-ink distance optical spacing leaves in any row both glyphs occupy, in cap heights. */
export const OPTICAL_CLEARANCE = 0.06;
/** Rows sample from just above the tallest ascender to below the deepest descender, in cap heights. */
const OPTICAL_TOP = -1.1, OPTICAL_BOTTOM = 0.3, OPTICAL_ROWS = 320;
const KERN_MIN = -0.35, KERN_MAX = 0.15;

export interface PathText {
  readonly id: string;
  readonly text: string;
}

export function pathText(input: { id: string; text: string }): PathText {
  if (typeof input.id !== "string" || !/^[\x21-\x7E]{1,48}$/.test(input.id))
    throw new Error("Text id must be 1–48 printable ASCII characters without spaces");
  if (typeof input.text !== "string" || !/^[\x20-\x7E]+$/.test(input.text) || input.text.length > MAX_PATH_TEXT)
    throw new Error(`Path text must be 1–${MAX_PATH_TEXT} printable ASCII characters`);
  if (!input.text.trim()) throw new Error("Path text must contain a character that is not a space");
  return Object.freeze({ id: input.id, text: input.text });
}

/** The lines the library ships; a Studio layer can select only these. */
export const bundledPathTexts: Readonly<Record<string, PathText>> = Object.freeze(Object.fromEntries([
  { id: "road", text: "THE ROAD BENDS TWICE BEFORE THE RIVER" },
  { id: "river", text: "water remembers every field it crossed" },
  { id: "line", text: "Draw the line, then follow it home." },
  { id: "tide", text: "Tide tables: slack, ebb, flood, slack" },
  { id: "alphabet", text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789" },
].map((source) => [source.id, pathText(source)])));

export interface Glyph {
  readonly char: string;
  /** Font units. */
  readonly advance: number;
  /** Closed rings at the pen origin, y down from the baseline. Empty for a space. */
  readonly rings: readonly Ring[];
  readonly left: number;
  readonly right: number;
}

const glyphs = new Map<string, Glyph>();
/** One glyph of the font with degenerate contours (a lone point in "u") removed. */
export function glyphOf(char: string): Glyph {
  const hit = glyphs.get(char);
  if (hit) return hit;
  const source = fontGlyph(char);
  let left = Infinity, right = -Infinity;
  const rings = source.contours.filter((ring) => ring.length >= 3).map((ring): Ring => Object.freeze(ring.map(([x, y]): Point => {
    left = Math.min(left, x); right = Math.max(right, x);
    return Object.freeze([x, y] as const);
  })));
  const glyph: Glyph = Object.freeze({ char, advance: source.advance, rings: Object.freeze(rings),
    left: rings.length ? left : 0, right: rings.length ? right : 0 });
  glyphs.set(char, glyph);
  return glyph;
}

interface Profile { readonly min: readonly number[]; readonly max: readonly number[] }
const profiles = new Map<string, Profile>();
/** Leftmost and rightmost ink at each of the rows; NaN where the row has none. */
function profileOf(char: string): Profile {
  const hit = profiles.get(char);
  if (hit) return hit;
  const min = new Array<number>(OPTICAL_ROWS).fill(NaN), max = new Array<number>(OPTICAL_ROWS).fill(NaN);
  for (let row = 0; row < OPTICAL_ROWS; row++) {
    const y = (OPTICAL_TOP + (row + 0.5) * (OPTICAL_BOTTOM - OPTICAL_TOP) / OPTICAL_ROWS) * CAP_HEIGHT;
    for (const ring of glyphOf(char).rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[j], [x2, y2] = ring[i];
        if ((y1 > y) === (y2 > y)) continue;
        const x = x1 + (x2 - x1) * (y - y1) / (y2 - y1);
        if (!(x >= min[row])) min[row] = x;
        if (!(x <= max[row])) max[row] = x;
      }
    }
  }
  const profile = Object.freeze({ min: Object.freeze(min), max: Object.freeze(max) });
  profiles.set(char, profile);
  return profile;
}

/**
 * Mean white gap between `a`'s right edge and `b`'s left edge over the rows either occupies (with the
 * bounded depth), and the smallest true distance in a row both occupy; font units.
 */
function gaps(a: string, b: string): { mean: number; closest: number } | undefined {
  const right = profileOf(a).max, left = profileOf(b).min, depth = OPTICAL_DEPTH * CAP_HEIGHT, advance = glyphOf(a).advance;
  let sum = 0, rows = 0, closest = Infinity;
  for (let row = 0; row < OPTICAL_ROWS; row++) {
    const inkA = !Number.isNaN(right[row]), inkB = !Number.isNaN(left[row]);
    if (!inkA && !inkB) continue;
    sum += Math.min(depth, inkA ? advance - right[row] : depth) + Math.min(depth, inkB ? left[row] : depth);
    if (inkA && inkB) closest = Math.min(closest, advance - right[row] + left[row]);
    rows++;
  }
  return rows > 0 ? { mean: sum / rows, closest } : undefined;
}

/** Optical pair adjustment in font units: positive opens the pair, negative closes it; 0 beside a space. */
export function opticalKern(a: string, b: string): number {
  if (glyphOf(a).rings.length === 0 || glyphOf(b).rings.length === 0) return 0;
  const gap = gaps(a, b), reference = gaps("H", "H");
  if (gap === undefined || reference === undefined) return 0;
  // Close the pair to the reference gap, but never past OPTICAL_CLEARANCE between facing ink (a crossbar stops short of a stem).
  const tightest = gap.closest === Infinity ? KERN_MIN * CAP_HEIGHT : OPTICAL_CLEARANCE * CAP_HEIGHT - gap.closest;
  return Math.min(KERN_MAX * CAP_HEIGHT, Math.max(KERN_MIN * CAP_HEIGHT, tightest, reference.mean - gap.mean));
}

export type KerningRule = "metric" | "optical" | "mono";
export interface ShapeOptions {
  kerning: KerningRule;
  /** Cap heights added after every glyph; signed. */
  tracking: number;
}

/** One glyph of a run, in font units (see the module comment). */
export interface GlyphItem extends AdvanceItem {
  readonly char: string;
  /** Position in the text. */
  readonly index: number;
  /** Runs of non-space characters, counted from 0; spaces take the word before them. */
  readonly word: number;
  readonly ink?: readonly Ring[];
  /** Keyholed polygons of `ink`, ready to fill one polygon at a time. */
  readonly fill?: readonly Ring[];
}
export interface GlyphRun {
  readonly text: PathText;
  readonly options: Readonly<ShapeOptions>;
  readonly items: readonly GlyphItem[];
  /** Sum of the item advances, font units. */
  readonly length: number;
}

const runs = new Map<string, GlyphRun>();
export function shapeRun(text: PathText, options: ShapeOptions): GlyphRun {
  if (!["metric", "optical", "mono"].includes(options.kerning)) throw new Error(`Unknown kerning rule: ${String(options.kerning)}`);
  if (typeof options.tracking !== "number" || !Number.isFinite(options.tracking) || options.tracking < -0.5 || options.tracking > 4)
    throw new Error("Tracking must be finite and in [-0.5, 4] cap heights");
  pathText(text);
  const key = JSON.stringify([text.text, options.kerning, options.tracking]);
  const hit = runs.get(key);
  if (hit) return hit;
  const chars = [...text.text], track = options.tracking * CAP_HEIGHT;
  const adjust = chars.map((char, i) => options.kerning !== "optical" || i === chars.length - 1 ? 0 : opticalKern(char, chars[i + 1]));
  const pitch = Math.max(...chars.map((char) => glyphOf(char).advance));
  let word = -1, length = 0;
  const items = chars.map((char, index): GlyphItem => {
    const glyph = glyphOf(char);
    if (char !== " " && (index === 0 || chars[index - 1] === " ")) word++;
    const id = `g${index}`, shared = ((adjust[index - 1] ?? 0) + adjust[index]) / 2;
    const advance = options.kerning === "mono" ? pitch + track : glyph.advance + shared + track;
    if (!(advance > 0)) throw new Error(`Tracking ${options.tracking} leaves ${JSON.stringify(char)} at index ${index} with no advance; raise the tracking`);
    length += advance;
    if (glyph.rings.length === 0) return Object.freeze({ id, advance, char, index, word: Math.max(word, 0), spacer: true });
    // Ink centred on the middle of the interval: metric/optical put the glyph after half the tracking
    // and its share of the pair adjustment; mono centres its ink box in the cell.
    const origin = options.kerning === "mono" ? advance / 2 - (glyph.left + glyph.right) / 2 : (adjust[index - 1] ?? 0) / 2 + track / 2;
    const shift = origin - advance / 2;
    const ink = Object.freeze(glyph.rings.map((ring): Ring => Object.freeze(ring.map(([x, y]): Point => Object.freeze([x + shift, y] as const)))));
    return Object.freeze({ id, advance, char, index, word, ink, fill: Object.freeze(keyholeRings(ink)) });
  });
  const run = Object.freeze({ text, options: Object.freeze({ ...options }), items: Object.freeze(items), length });
  runs.set(key, run);
  if (runs.size > 12) runs.delete(runs.keys().next().value!);
  return run;
}
