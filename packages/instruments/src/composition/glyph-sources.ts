import { domainDifference, keyholeRing, planarDomain, planarRegion, ringsDomain } from "./domains.js";
import type { PlanarDomain, Ring } from "./domains.js";
import { offsetDomain } from "./domains-offset.js";
import { flatRing } from "./domains-contact.js";
import type { FlatRing } from "./domains-contact.js";
import { typeLine, CAP_HEIGHT } from "./type-text.js";

/**
 * Glyph sources: the things a packing places, as outlines.
 *
 * INPUT CONTRACT. A source is a resolved, deeply frozen value made from geometry alone; nothing is
 * fetched, decoded or measured by a browser. `wordSource(text)` is 1–20 printable ASCII characters set in
 * the owned outline font (`typeLine`): UNSHAPED LATIN only, so no kerning table, ligatures, combining
 * marks or other scripts (an unsupported character throws, naming it). `symbolSource(input)` is any
 * disjoint polygons-with-holes the caller supplies. A saved Studio layer picks only from the BUNDLED
 * words, dingbats and vocabularies below through validated selects; binding a user's own text or shapes
 * is future host work, and the direct functions here accept them.
 *
 * UNITS AND FRAME. Coordinates are in "glyph units", y down like the canvas, the origin at the centre of
 * the ink bounding box. A word's unit is its CAP HEIGHT (so `scale` canvas units per unit sets the type
 * size, as in Path Typography); a symbol's unit is the LONGER side of its ink box. An instance draws a
 * source with translate(position), rotate(angle), scale(scale).
 *
 * OUTPUT. `parts` are the connected pieces of ink: an outer ring and its counters (holes), oriented as the
 * planar domain module orients them (region on the left of travel). `ink` lists every ring (for
 * outlines), `fill` the pieces with counters joined by zero-width cuts (for one filled shape each; fill
 * them, never stroke them). `area` is the ink area (counters excluded), `solidArea` the area of the
 * outer rings (counters filled), `radius` the farthest vertex from the origin.
 *
 * FOOTPRINTS. What collides is a footprint (`footprintOf`): the source's parts with counters either
 * filled ("solid": a counter is NOT packing space) or kept ("open": a smaller glyph may sit in a counter),
 * each grown by half the gap on all sides with the exact round-join offset of the planar domain module.
 * Two placed glyphs whose grown footprints do not touch are at least half of each one's gap apart (the
 * gap is a fraction of a glyph's own size, so the space between neighbours scales with them). Footprints
 * are cached per (source, gap, counters) and never depend on appearance.
 */
export const MAX_SOURCE_TEXT = 20;

export interface GlyphPart {
  readonly outer: Ring;
  readonly holes: readonly Ring[];
}
export interface GlyphSource {
  readonly id: string;
  readonly kind: "word" | "symbol";
  /** The text of a word, the name of a symbol. */
  readonly label: string;
  readonly parts: readonly GlyphPart[];
  readonly ink: readonly Ring[];
  readonly fill: readonly Ring[];
  /** [left, top, right, bottom] in glyph units. */
  readonly bounds: readonly [number, number, number, number];
  readonly area: number;
  readonly solidArea: number;
  readonly radius: number;
}

export interface SymbolInput {
  readonly id: string;
  readonly label?: string;
  /** Disjoint polygons with holes, any position and size; scaled so the longer side of the ink box is 1. */
  readonly regions: readonly { readonly outer: readonly (readonly [number, number])[]; readonly holes?: readonly (readonly (readonly [number, number])[])[] }[];
}

type P = [number, number];
function areaOf(ring: Ring): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return Math.abs(sum) / 2;
}

function finishSource(id: string, kind: "word" | "symbol", label: string, domain: PlanarDomain): GlyphSource {
  if (domain.regions.length === 0) throw new Error(`Glyph source "${id}" has no ink`);
  const parts = domain.regions.map((region): GlyphPart => Object.freeze({ outer: region.outer, holes: region.holes }));
  let radius = 0, area = 0, solidArea = 0;
  for (const part of parts) {
    for (const [x, y] of part.outer) radius = Math.max(radius, Math.hypot(x, y));
    solidArea += areaOf(part.outer);
    area += areaOf(part.outer) - part.holes.reduce((sum, hole) => sum + areaOf(hole), 0);
  }
  const [left, top, right, bottom] = domain.bounds!;
  return Object.freeze({
    id, kind, label, parts: Object.freeze(parts), ink: Object.freeze(parts.flatMap((part) => [part.outer, ...part.holes])),
    fill: Object.freeze(domain.regions.map((region) => keyholeRing(region))),
    bounds: Object.freeze([left, top, right, bottom] as const), area, solidArea, radius,
  });
}

const wordCache = new Map<string, GlyphSource>();
/** A word set in the owned outline font, cap height 1, centred on its ink box. Cached. */
export function wordSource(text: string, id = `word:${text}`): GlyphSource {
  const hit = wordCache.get(`${id}\u0000${text}`);
  if (hit) return hit;
  if (typeof text !== "string" || !/^[\x20-\x7E]{1,20}$/.test(text) || !text.trim())
    throw new Error(`A word is 1–${MAX_SOURCE_TEXT} printable ASCII characters (U+0020–U+007E), not blank: ${JSON.stringify(text)}`);
  const line = typeLine(text);
  const cx = (line.left + line.right) / 2, cy = (line.top + line.bottom) / 2;
  const domain = ringsDomain(line.rings.map((ring) => ring.map(([x, y]): P => [(x - cx) / CAP_HEIGHT, (y - cy) / CAP_HEIGHT])), { fill: "nonzero", id });
  const source = finishSource(id, "word", text, domain);
  wordCache.set(`${id}\u0000${text}`, source);
  return source;
}

/** A caller's polygons as a source, longer ink side scaled to 1 and centred. Validated strictly (see `planarDomain`). */
export function symbolSource(input: SymbolInput): GlyphSource {
  if (typeof input.id !== "string" || input.id === "") throw new Error("A symbol needs an id");
  const raw = planarDomain(input.regions.map((region) => ({ outer: region.outer, holes: region.holes ?? [] })), { id: input.id });
  if (raw.regions.length === 0 || !raw.bounds) throw new Error(`Symbol "${input.id}" has no ink`);
  const [l, t, r, b] = raw.bounds;
  const side = Math.max(r - l, b - t), cx = (l + r) / 2, cy = (t + b) / 2;
  if (!(side > 0)) throw new Error(`Symbol "${input.id}" has no extent`);
  const scaled = planarDomain(raw.regions.map((region) => ({
    outer: region.outer.map(([x, y]): P => [(x - cx) / side, (y - cy) / side]),
    holes: region.holes.map((hole) => hole.map(([x, y]): P => [(x - cx) / side, (y - cy) / side])),
  })), { id: input.id });
  return finishSource(input.id, "symbol", input.label ?? input.id, scaled);
}

// ---------------------------------------------------------------------------------------------
// Bundled dingbats: the outline forms of the stock motifs (dot, rings, rosette, arrow) and a few more.
// ---------------------------------------------------------------------------------------------
const polar = (n: number, radius: (theta: number) => number, phase = 0): P[] =>
  Array.from({ length: n }, (_, i) => { const t = phase + 2 * Math.PI * i / n; const r = radius(t); return [r * Math.cos(t), r * Math.sin(t)] as P; });
const circle = (r: number, n = 32, cx = 0, cy = 0): P[] => polar(n, () => r).map(([x, y]) => [x + cx, y + cy] as P);

function crescentRing(): P[] {
  const difference = domainDifference({ outer: circle(0.5, 64) }, { outer: circle(0.42, 64, 0.17, -0.06) }, { id: "crescent" });
  if (difference.regions.length !== 1) throw new Error("crescent construction changed");
  return difference.regions[0].outer.map(([x, y]) => [x, y] as P);
}

const dingbatData: Readonly<Record<string, SymbolInput["regions"]>> = {
  dot: [{ outer: circle(0.5, 28) }],
  ring: [{ outer: circle(0.5, 32), holes: [circle(0.22, 24)] }],
  star: [{ outer: polar(10, (t) => Math.round((t + Math.PI / 2) / (Math.PI / 5)) % 2 === 0 ? 0.5 : 0.2, -Math.PI / 2) }],
  cross: [{ outer: [[-0.17, -0.5], [0.17, -0.5], [0.17, -0.17], [0.5, -0.17], [0.5, 0.17], [0.17, 0.17], [0.17, 0.5], [-0.17, 0.5], [-0.17, 0.17], [-0.5, 0.17], [-0.5, -0.17], [-0.17, -0.17]] }],
  arrow: [{ outer: [[-0.5, -0.1], [0.08, -0.1], [0.08, -0.3], [0.5, 0], [0.08, 0.3], [0.08, 0.1], [-0.5, 0.1]] }],
  leaf: [{ outer: [...Array.from({ length: 13 }, (_, i) => { const u = i / 12; return [-0.5 + u, -0.27 * Math.sin(Math.PI * u) * (1 - 0.35 * u)] as P; }),
    ...Array.from({ length: 11 }, (_, i) => { const u = 1 - (i + 1) / 12; return [-0.5 + u, 0.2 * Math.sin(Math.PI * u) * (1 - 0.35 * u)] as P; })] }],
  crescent: [{ outer: crescentRing() }],
  rosette: [{ outer: polar(72, (t) => 0.5 * (0.45 + 0.55 * Math.abs(Math.cos(3 * t))), 0), holes: [circle(0.07, 16)] }],
  bolt: [{ outer: [[0.12, -0.5], [-0.3, 0.06], [-0.04, 0.06], [-0.16, 0.5], [0.3, -0.12], [0.04, -0.12], [0.3, -0.5]] }],
  drop: [{ outer: [[0, -0.5], [0.09, -0.34], [0.19, -0.2], [0.28, -0.07],
    ...Array.from({ length: 11 }, (_, i) => { const t = -Math.PI * 0.1 + Math.PI * 1.2 * (i + 1) / 12; return [0.3 * Math.cos(t), 0.2 + 0.3 * Math.sin(t)] as P; }),
    [-0.28, -0.07], [-0.19, -0.2], [-0.09, -0.34]] }],
};
export const bundledSymbolIds = ["dot", "ring", "star", "cross", "arrow", "leaf", "crescent", "rosette", "bolt", "drop"] as const;
export type BundledSymbolId = (typeof bundledSymbolIds)[number];

const symbolCache = new Map<string, GlyphSource>();
/** One of the bundled dingbats (`bundledSymbolIds`). Cached. */
export function bundledSymbol(id: BundledSymbolId): GlyphSource {
  if (!(bundledSymbolIds as readonly string[]).includes(id)) throw new Error(`Unknown bundled symbol "${String(id)}"; choose one of ${bundledSymbolIds.join(", ")}`);
  let hit = symbolCache.get(id);
  if (!hit) { hit = symbolSource({ id: `symbol:${id}`, label: id, regions: dingbatData[id] }); symbolCache.set(id, hit); }
  return hit;
}

// ---------------------------------------------------------------------------------------------
// Vocabularies
// ---------------------------------------------------------------------------------------------
export interface VocabularyEntry {
  readonly source: GlyphSource;
  /** Relative frequency: how often the entry is drawn among the entries eligible at a size. > 0. */
  readonly weight: number;
}
/** Entries in rank order, most important first: `hierarchy` gives the head of the list the largest sizes. */
export interface GlyphVocabulary {
  readonly id: string;
  readonly title: string;
  readonly entries: readonly VocabularyEntry[];
}

export function glyphVocabulary(input: { id: string; title?: string; entries: readonly { source: GlyphSource; weight?: number }[] }): GlyphVocabulary {
  if (!Array.isArray(input.entries) || input.entries.length === 0) throw new Error(`Vocabulary "${input.id}" needs at least one entry`);
  if (input.entries.length > 64) throw new Error(`Vocabulary "${input.id}" has more than 64 entries`);
  const entries = input.entries.map((entry, i) => {
    const weight = entry.weight ?? 1;
    if (!(weight > 0) || !Number.isFinite(weight)) throw new Error(`Vocabulary "${input.id}" entry ${i} needs a finite weight above 0`);
    return Object.freeze({ source: entry.source, weight });
  });
  return Object.freeze({ id: input.id, title: input.title ?? input.id, entries: Object.freeze(entries) });
}

const words = (list: readonly (readonly [string, number])[]) => list.map(([text, weight]) => ({ source: wordSource(text), weight }));
const symbols = (list: readonly (readonly [BundledSymbolId, number])[]) => list.map(([id, weight]) => ({ source: bundledSymbol(id), weight }));
const GARDEN = [["garden", 1], ["bloom", 2], ["fern", 3], ["moss", 4], ["seed", 4], ["root", 3], ["rain", 3], ["leaf", 5], ["stem", 3], ["dew", 6]] as const;
const TIDE = [["tide", 1], ["shore", 2], ["drift", 2], ["salt", 3], ["wave", 3], ["kelp", 3], ["reef", 3], ["foam", 5], ["ebb", 6], ["gull", 3]] as const;
const LETTERS = [["R", 1], ["g", 2], ["a", 3], ["&", 2], ["B", 2], ["e", 3], ["8", 2], ["o", 3], ["Q", 1], ["s", 3]] as const;
const ORNAMENTS = [["rosette", 1], ["star", 2], ["ring", 2], ["leaf", 3], ["crescent", 2], ["drop", 3], ["bolt", 1], ["cross", 3], ["arrow", 2], ["dot", 5]] as const;

const bundled = new Map<string, GlyphVocabulary>();
export const bundledVocabularyIds = ["garden", "tide", "letters", "ornaments", "words-and-ornaments"] as const;
export type BundledVocabularyId = (typeof bundledVocabularyIds)[number];
export const bundledVocabularyTitles: Readonly<Record<BundledVocabularyId, string>> = Object.freeze({
  garden: "Garden words", tide: "Tide words", letters: "Single letters", ornaments: "Ornaments", "words-and-ornaments": "Words and ornaments",
});
/** A bundled vocabulary: the only ones a saved layer can select. Cached and frozen. */
export function bundledVocabulary(id: BundledVocabularyId): GlyphVocabulary {
  if (!(bundledVocabularyIds as readonly string[]).includes(id)) throw new Error(`Unknown bundled vocabulary "${String(id)}"; choose one of ${bundledVocabularyIds.join(", ")}`);
  let hit = bundled.get(id);
  if (!hit) {
    const entries = id === "garden" ? words(GARDEN) : id === "tide" ? words(TIDE) : id === "letters" ? words(LETTERS)
      : id === "ornaments" ? symbols(ORNAMENTS)
        : [...words(GARDEN.slice(0, 5)), ...symbols([["rosette", 3], ["star", 3], ["leaf", 4], ["drop", 4], ["ring", 3], ["dot", 6]])];
    hit = glyphVocabulary({ id, title: bundledVocabularyTitles[id], entries });
    bundled.set(id, hit);
  }
  return hit;
}

// ---------------------------------------------------------------------------------------------
// Footprints
// ---------------------------------------------------------------------------------------------
export type CounterPolicy = "solid" | "open";
/** A footprint part in glyph units, ready for exact contact tests. */
export interface FlatPart {
  readonly outer: FlatRing;
  readonly holes: readonly FlatRing[];
  readonly area: number;
}
export interface Footprint {
  readonly source: GlyphSource;
  /** Half the gap in glyph units. */
  readonly halfGap: number;
  readonly counters: CounterPolicy;
  /** The ink footprint itself (containment in the container is tested with these). */
  readonly raw: readonly FlatPart[];
  /** The grown footprint (glyph-to-glyph contact is tested with these); the raw parts when the gap is 0. */
  readonly padded: readonly FlatPart[];
  /** Farthest padded vertex from the origin, glyph units. */
  readonly radius: number;
  /** Area of the raw parts (holes subtracted under "open"), glyph units². */
  readonly area: number;
}

const footprints = new WeakMap<GlyphSource, Map<string, Footprint>>();
const flatPart = (outer: Ring, holes: readonly Ring[]): FlatPart => {
  const area = areaOf(outer) - holes.reduce((sum, hole) => sum + areaOf(hole), 0);
  return Object.freeze({ outer: flatRing(outer), holes: Object.freeze(holes.map(flatRing)), area });
};
export function footprintOf(source: GlyphSource, gap: number, counters: CounterPolicy): Footprint {
  if (!(gap >= 0) || !Number.isFinite(gap)) throw new Error("Footprint gap must be a finite number ≥ 0");
  if (counters !== "solid" && counters !== "open") throw new Error(`Counters must be "solid" or "open"`);
  let byKey = footprints.get(source);
  if (!byKey) { byKey = new Map(); footprints.set(source, byKey); }
  const key = `${gap}|${counters}`;
  const hit = byKey.get(key);
  if (hit) return hit;
  const raw = source.parts.map((part) => counters === "open" ? flatPart(part.outer, part.holes) : flatPart(part.outer, []));
  const halfGap = gap / 2;
  let padded: readonly FlatPart[] = raw;
  if (halfGap > 0) {
    const shapes = source.parts.map((part) => planarRegion({ outer: part.outer, holes: counters === "open" ? part.holes : [] }));
    const grown = offsetDomain(shapes.length === 1 ? shapes[0] : planarDomain(shapes), halfGap, { join: "round", arcTolerance: halfGap / 8, id: `pad(${source.id})` });
    padded = Object.freeze(grown.regions.map((region) => flatPart(region.outer, region.holes)));
  }
  let radius = 0;
  for (const part of padded) for (let i = 0; i < part.outer.xy.length; i += 2) radius = Math.max(radius, Math.hypot(part.outer.xy[i], part.outer.xy[i + 1]));
  const footprint: Footprint = Object.freeze({ source, halfGap, counters, raw: Object.freeze(raw), padded: Object.freeze(padded), radius,
    area: raw.reduce((sum, part) => sum + part.area, 0) });
  byKey.set(key, footprint);
  return footprint;
}
