import { gradientNoise2D01 } from "@procedurals/javascript";
import { unit as unitDraw } from "./bristle.js";
import { cachedBy, componentSeed } from "./core.js";
import { PlanarError, domainRings, ringsDomain, unionDomains } from "./domains.js";
import type { PlanarDomain } from "./domains.js";
import { memoized } from "./sources.js";
import { pathText, shapeRun } from "./type-glyphs.js";
import type { KerningRule } from "./type-glyphs.js";
import { CAP_HEIGHT } from "./type-text.js";

/**
 * Outline type as regions: a line of text becomes planar domains that other techniques fill,
 * displace and outline. This file is the PRODUCER side (text, layout, units, displacement);
 * `outline-type-fill.ts` holds the replaceable fillers and `outline-type-draw.ts` the consumers.
 *
 * INPUT CONTRACT. An `OutlineText` is a resolved, frozen value: an id and 1–4 lines of 1–14
 * printable ASCII characters (U+0020–U+007E), each with a character that is not a space. Outlines
 * and advance widths come from the licensed outline font already shipped for Word Echo; nothing is
 * fetched or measured in a browser, so font loading never happens during drawing. This is UNSHAPED
 * LATIN: one code point, one glyph, left to right, with the kerning rules of `shapeRun`
 * (metric / optical / mono) and tracking. There are no ligatures, no other scripts, no combining
 * marks and no bidirectional text; a character outside U+0020–U+007E is a visible error naming the
 * line and character, never a substitution or a blank. A saved layer selects among
 * `bundledOutlineTexts`; host binding of the user's own text is future host work.
 *
 * LAYOUT (`outlineLayout`). Lines are centred on `centerX` by their INK extent, stacked
 * `leading × size` apart about `centerY` (the cap band of the middle of the block is centred),
 * every glyph standing on its line's baseline, then the whole block is turned about the centre by
 * `rotation` degrees (clockwise on the canvas). `size` is the cap height in canvas units, so one
 * font unit is `size / CAP_HEIGHT` units. Each glyph with ink is a `PlanarDomain` made from its
 * contours by nonzero fill: counters (O, A, B, 8, e, …) are HOLES, overlapping contours are one
 * shape, a glyph of several parts (i, j, %, :) has several regions. Ids are `l<line>/g<index>`
 * (index counts characters of the line, spaces included) and depend on the text alone, never on
 * size, tracking, appearance or seed. The layout is cached by construction and deeply frozen.
 *
 * UNITS (`outlineUnits`). A unit is the thing a filler treats as one region: a glyph, a word (its
 * glyph domains united, so letters that touch or overlap through tracking become one shape), a
 * line or the whole block. Ids: the glyph id, `l<line>/w<word>`, `l<line>`, `all`.
 *
 * DISPLACEMENT (`displaceUnits`). A smooth vector field moves the boundary of each unit: rings are
 * subdivided so no edge is longer than a step (a fraction of the correlation length), every vertex
 * moves by the field, and the moved rings are resolved by nonzero fill. The field is sampled in
 * canvas coordinates, so neighbouring letters move alike. While `2π·amount / length` stays under 1
 * the map is one-to-one, letters keep their shape class and counters stay counters; beyond that
 * the boundary folds over itself and the nonzero resolution merges the overlaps (still valid
 * regions, counters may close). `noise` is two independent gradient-noise channels, `wave` a
 * vertical ripple travelling along x. Fills are computed AFTER displacement, on the moved domain,
 * so they are clipped to what is shown.
 *
 * WORK. Limits are stated below; each is an error that names the controls to change, and
 * geometry is never thinned to fit.
 */
export const MAX_OUTLINE_LINES = 4;
export const MAX_OUTLINE_LINE_CHARS = 14;
/** Subdivided boundary vertices per displacement pass. */
export const MAX_DISPLACED_VERTICES = 200_000;

export interface OutlineText {
  readonly id: string;
  readonly lines: readonly string[];
}

/** Validate a caller's text and freeze it. A character outside the font's Basic Latin range is an error, never a substitution. */
export function outlineText(input: { id: string; lines: readonly string[] }): OutlineText {
  if (typeof input.id !== "string" || !/^[\x21-\x7E]{1,40}$/.test(input.id)) throw new Error("Outline text id must be 1–40 printable ASCII characters without spaces");
  if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > MAX_OUTLINE_LINES)
    throw new Error(`Outline text needs 1–${MAX_OUTLINE_LINES} lines`);
  input.lines.forEach((line, i) => {
    if (typeof line !== "string") throw new Error(`Line ${i + 1} must be a string`);
    let j = 0;
    for (const char of line) {
      j++;
      if (!/^[\x20-\x7E]$/.test(char))
        throw new Error(`Line ${i + 1} character ${j} (${JSON.stringify(char)}, U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}) has no glyph: the font covers printable ASCII (U+0020–U+007E) only, with no ligatures, combining marks or other scripts, and nothing is substituted`);
    }
    if (line.length < 1 || line.length > MAX_OUTLINE_LINE_CHARS) throw new Error(`Line ${i + 1} must be 1–${MAX_OUTLINE_LINE_CHARS} characters`);
    if (!line.trim()) throw new Error(`Line ${i + 1} must contain a character that is not a space`);
  });
  return Object.freeze({ id: input.id, lines: Object.freeze([...input.lines]) });
}

/** The phrases the library ships; a Studio layer can select only these. Each has counters to keep. */
export const bundledOutlineTexts: Readonly<Record<string, OutlineText>> = Object.freeze(Object.fromEntries([
  { id: "bold", lines: ["BOLD", "FORM"] },
  { id: "open", lines: ["OPEN", "AIR"] },
  { id: "ink", lines: ["INK"] },
  { id: "shade", lines: ["Shade", "Type"] },
  { id: "figures", lines: ["0869", "4@&%"] },
].map((source) => [source.id, outlineText(source)])));

export type OutlineUnitKind = "glyph" | "word" | "line" | "block";

export interface OutlineLayoutOptions {
  readonly text: OutlineText;
  readonly kerning: KerningRule;
  /** Cap heights added after every glyph; signed. */
  readonly tracking: number;
  /** Cap height, canvas units. */
  readonly size: number;
  /** Baseline to baseline, in cap heights. */
  readonly leading: number;
  readonly centerX: number;
  readonly centerY: number;
  /** Degrees, clockwise on the canvas, about the centre. */
  readonly rotation: number;
}

export interface OutlineGlyph {
  /** `l<line>/g<index>` */
  readonly id: string;
  readonly char: string;
  readonly line: number;
  readonly index: number;
  /** Word within the line, counted from 0. */
  readonly word: number;
  readonly domain: PlanarDomain;
}
export interface OutlineLine {
  /** `l<line>` */
  readonly id: string;
  readonly index: number;
  /** Baseline y before the block's rotation. */
  readonly baseline: number;
  /** Ink extent x before rotation. */
  readonly left: number;
  readonly right: number;
  readonly glyphs: readonly string[];
}
export interface OutlineLayout {
  readonly options: Readonly<OutlineLayoutOptions>;
  /** Canvas units per font unit. */
  readonly scale: number;
  readonly glyphs: readonly OutlineGlyph[];
  readonly lines: readonly OutlineLine[];
  /** [left, top, right, bottom] of all ink. */
  readonly bounds: readonly [number, number, number, number];
}

const finiteIn = (label: string, value: number, min: number, max: number): void => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and in [${min}, ${max}]`);
};

/** Turn a planar work failure into an error that names the controls that scale the work. */
export function withControls<T>(step: string, controls: string, make: () => T): T {
  try { return make(); } catch (error) {
    if (error instanceof PlanarError && (error.code === "WORK_LIMIT" || error.code === "NOT_CONVERGED"))
      throw new Error(`${step} is more geometry than the work limit allows (${error.message}). Change: ${controls}`);
    throw error;
  }
}

/** Append the controls that scale the work to any error a lower layer throws (pattern bounds name no control of ours). */
export function appendControls<T>(controls: string, make: () => T): T {
  try { return make(); } catch (error) {
    if (error instanceof Error && !(error instanceof PlanarError)) throw new Error(`${error.message.replace(/\.$/, "")}. Change: ${controls}`);
    throw error;
  }
}

const layoutCache = new Map<string, OutlineLayout>();
export function outlineLayout(options: OutlineLayoutOptions): OutlineLayout {
  const text = outlineText(options.text);
  if (!["metric", "optical", "mono"].includes(options.kerning)) throw new Error(`Unknown kerning rule: ${String(options.kerning)}`);
  finiteIn("Tracking", options.tracking, -0.5, 4); finiteIn("Type size", options.size, 4, 2000); finiteIn("Leading", options.leading, 0.5, 4);
  finiteIn("Center X", options.centerX, -1e5, 1e5); finiteIn("Center Y", options.centerY, -1e5, 1e5); finiteIn("Rotation", options.rotation, -3600, 3600);
  const key = JSON.stringify([text.id, text.lines, options.kerning, options.tracking, options.size, options.leading, options.centerX, options.centerY, options.rotation]);
  return memoized(layoutCache, key, () => buildLayout({ ...options, text }));
}

function buildLayout(options: OutlineLayoutOptions): OutlineLayout {
  const { text, size, leading, centerX, centerY } = options;
  const s = size / CAP_HEIGHT, turn = options.rotation * Math.PI / 180, cos = Math.cos(turn), sin = Math.sin(turn);
  const glyphs: OutlineGlyph[] = [], lines: OutlineLine[] = [];
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  text.lines.forEach((line, lineIndex) => {
    const run = shapeRun(pathText({ id: `${text.id}.${lineIndex}`, text: line }), { kerning: options.kerning, tracking: options.tracking });
    const centres: number[] = [];
    let cursor = 0, minX = Infinity, maxX = -Infinity;
    for (const item of run.items) {
      centres.push(cursor + item.advance / 2);
      cursor += item.advance;
      for (const ring of item.ink ?? []) for (const [x] of ring) { minX = Math.min(minX, centres[centres.length - 1] + x); maxX = Math.max(maxX, centres[centres.length - 1] + x); }
    }
    const baseline = centerY + (lineIndex - (text.lines.length - 1) / 2) * leading * size + size / 2;
    const middle = (minX + maxX) / 2;
    const ids: string[] = [];
    run.items.forEach((item, k) => {
      if (!item.ink) return;
      const id = `l${lineIndex}/g${item.index}`;
      const rings = item.ink.map((ring) => ring.map(([x, y]): [number, number] => {
        const dx = centerX + s * (centres[k] + x - middle) - centerX, dy = baseline + s * y - centerY;
        return [centerX + dx * cos - dy * sin, centerY + dx * sin + dy * cos];
      }));
      const domain = withControls(`Glyph ${JSON.stringify(item.char)}`, "Type size", () => ringsDomain(rings, { fill: "nonzero", id }));
      ids.push(id);
      glyphs.push(Object.freeze({ id, char: item.char, line: lineIndex, index: item.index, word: item.word, domain }));
      const [l, t, r, b] = domain.bounds!;
      left = Math.min(left, l); top = Math.min(top, t); right = Math.max(right, r); bottom = Math.max(bottom, b);
    });
    lines.push(Object.freeze({ id: `l${lineIndex}`, index: lineIndex, baseline, left: centerX + s * (minX - middle), right: centerX + s * (maxX - middle), glyphs: Object.freeze(ids) }));
  });
  return Object.freeze({ options: Object.freeze({ ...options }), scale: s, glyphs: Object.freeze(glyphs), lines: Object.freeze(lines),
    bounds: Object.freeze([left, top, right, bottom] as const) });
}

/** What a filler treats as one region. */
export interface OutlineUnit {
  readonly id: string;
  readonly kind: OutlineUnitKind;
  /** Position in reading order among the units of its kind. */
  readonly index: number;
  /** Ids of the layout glyphs it contains, in reading order. */
  readonly glyphs: readonly string[];
  readonly line: number;
  readonly domain: PlanarDomain;
}

const unitCache = new WeakMap<OutlineLayout, Map<string, readonly OutlineUnit[]>>();
/** The layout's glyphs grouped into units. Glyph units reuse the glyph domains themselves. Cached per layout. */
export function outlineUnits(layout: OutlineLayout, kind: OutlineUnitKind): readonly OutlineUnit[] {
  if (!["glyph", "word", "line", "block"].includes(kind)) throw new Error(`Unknown unit kind: ${String(kind)}`);
  return cachedBy(unitCache, layout, kind, () => {
    const groups: { id: string; line: number; glyphs: OutlineGlyph[] }[] = [];
    if (kind === "glyph") for (const g of layout.glyphs) groups.push({ id: g.id, line: g.line, glyphs: [g] });
    else if (kind === "word") for (const g of layout.glyphs) {
      const id = `l${g.line}/w${g.word}`, last = groups[groups.length - 1];
      if (last && last.id === id) last.glyphs.push(g); else groups.push({ id, line: g.line, glyphs: [g] });
    } else if (kind === "line") for (const line of layout.lines) groups.push({ id: line.id, line: line.index, glyphs: layout.glyphs.filter((g) => g.line === line.index) });
    else groups.push({ id: "all", line: 0, glyphs: [...layout.glyphs] });
    return Object.freeze(groups.map((group, index): OutlineUnit => Object.freeze({
      id: group.id, kind, index, line: group.line, glyphs: Object.freeze(group.glyphs.map((g) => g.id)),
      domain: group.glyphs.length === 1 && kind === "glyph" ? group.glyphs[0].domain
        : withControls(`Unit ${group.id}`, "Fill unit, Type size, Tracking", () => unionDomains(group.glyphs.map((g) => g.domain), { id: group.id })),
    })));
  });
}

// --- Displacement -------------------------------------------------------------------------

export type OutlineDisplacement = (x: number, y: number) => readonly [number, number];
export type OutlineDisplacementSpec =
  | { readonly kind: "none" }
  /** `amount` and `length` in canvas units. */
  | { readonly kind: "noise" | "wave"; readonly amount: number; readonly length: number };

/** The named displacement fields. Deterministic in `seed`; each channel is bounded by `amount`. */
export function displacementField(spec: OutlineDisplacementSpec, seed: number): OutlineDisplacement {
  if (spec.kind === "none") return () => [0, 0];
  if (spec.kind !== "noise" && spec.kind !== "wave") throw new Error(`Unknown displacement kind: ${String((spec as { kind?: unknown }).kind)}`);
  finiteIn("Displacement amount", spec.amount, 0, 1e4); finiteIn("Displacement length", spec.length, 1, 1e5);
  const { amount, length } = spec;
  if (spec.kind === "noise") {
    const fx = gradientNoise2D01({ seed: componentSeed(seed, "outline-type", "displace-x") }), fy = gradientNoise2D01({ seed: componentSeed(seed, "outline-type", "displace-y") });
    return (x, y) => [(fx.sample(x / length, y / length) - 0.5) * 2 * amount, (fy.sample(x / length + 31.7, y / length - 12.3) - 0.5) * 2 * amount];
  }
  const phase = 2 * Math.PI * unitDraw(seed, "outline-type", "wave-phase");
  return (x) => [0, amount * Math.sin(2 * Math.PI * x / length + phase)];
}

/**
 * Move a domain's boundary by a field: every ring is subdivided into pieces no longer than
 * `step`, every vertex moves by `field`, and the result is resolved by nonzero fill. A field that
 * is one-to-one over the shape keeps every region and counter; `id` names the result.
 */
export function deformDomain(domain: PlanarDomain, field: OutlineDisplacement, options: { step: number; id?: string }): PlanarDomain {
  if (!(options.step > 0) || !Number.isFinite(options.step)) throw new Error("Displacement step must be positive");
  const rings: [number, number][][] = [];
  let count = 0;
  for (const ring of domainRings(domain)) {
    const moved: [number, number][] = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], pieces = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / options.step));
      count += pieces;
      if (count > MAX_DISPLACED_VERTICES) throw new Error(`Displacement needs more than ${MAX_DISPLACED_VERTICES} boundary vertices. Raise Correlation length, lower Type size or use a larger fill unit`);
      for (let k = 0; k < pieces; k++) {
        const x = a[0] + (b[0] - a[0]) * k / pieces, y = a[1] + (b[1] - a[1]) * k / pieces, [dx, dy] = field(x, y);
        moved.push([x + dx, y + dy]);
      }
    }
    rings.push(moved);
  }
  return withControls("Displacement", "Displacement amount, Correlation length, Type size", () => ringsDomain(rings, { fill: "nonzero", id: options.id ?? `displace(${domain.id})` }));
}

const displaceCache = new WeakMap<readonly OutlineUnit[], Map<string, readonly OutlineUnit[]>>();
/**
 * The units with their domains displaced by the named field (a step of a sixth of the correlation
 * length, at most 6 canvas units). `none` returns the same array. Cached per unit list.
 */
export function displaceUnits(units: readonly OutlineUnit[], spec: OutlineDisplacementSpec, seed: number): readonly OutlineUnit[] {
  if (spec.kind === "none" || spec.amount === 0) return units;
  return cachedBy(displaceCache, units, JSON.stringify([spec, seed]), () => {
    const field = displacementField(spec, seed), step = Math.max(0.5, Math.min(spec.length / 6, 6));
    return Object.freeze(units.map((u): OutlineUnit => Object.freeze({ ...u, domain: deformDomain(u.domain, field, { step, id: `displace(${u.id})` }) })));
  });
}
