import { outlineTypeDefinition } from "../adapters/outline-type-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { atEach, createCompositionRun, strokeWith } from "./core.js";
import { domainRings, keyholeRing } from "./domains.js";
import type { PlanarDomain } from "./domains.js";
import { offsetDomain, shadowDomain } from "./domains-offset.js";
import { color, motif, pathMaterial, tonedMaterial } from "./materials.js";
import { bundledOutlineTexts, displaceUnits, outlineLayout, outlineUnits, withControls } from "./outline-type.js";
import type { OutlineDisplacementSpec, OutlineLayout, OutlineText, OutlineUnit, OutlineUnitKind } from "./outline-type.js";
import { OUTLINE_MIXED_KINDS, outlineFillerFor, resolveOutlineFillKind } from "./outline-type-fill.js";
import type { OutlineFill, OutlineFillKind, OutlineFillSpec, OutlineFiller } from "./outline-type-fill.js";
import { unit as unitDraw } from "./bristle.js";
import { memoized } from "./sources.js";
import type { KerningRule } from "./type-glyphs.js";
import type { CompositionRun, CompositionSurface, Path, PathMaterial, PathMaterialSpec } from "./types.js";

/**
 * Outline Type as a typed, JSON-compatible composition and its consumers.
 *
 * PRODUCERS (cached by construction, frozen, appearance-independent):
 *   layout   `outlineLayout`: glyph domains with stable ids (`outline-type.ts`)
 *   units    `outlineUnits` (glyph / word / line / block), then `displaceUnits` (a correlated field)
 *   fill     a `OutlineFiller` per unit: paths, shapes and marks inside the unit's domain (`outline-type-fill.ts`)
 *   offsets  `offsetDomain` outward (halo) and inward (inline) with the chosen join; the shadow is the
 *            translated copy (cast) or the exact `sweepDomain` (extrude) minus the letter itself
 *   `outlineTypeProducts(recipe)` runs all of these and returns every value a consumer reads.
 *
 * WHAT BELONGS TO CONSTRUCTION AND WHAT TO APPEARANCE. Text, kerning, tracking, size, leading,
 * placement, unit, displacement, the fill's construction (kind, spacing, angle, spread, cross,
 * origin, chirp, wave, lattice, mark size, ramp, steps), the share of units filled, halo and inline
 * distances, the join and the shadow vector are construction: editing one may rebuild geometry.
 * Palette, colour rule, stroke material (line / stitch / beads), weights, pitch, wash strength and
 * shadow opacity are appearance: editing one reuses every cached value and moves nothing.
 *
 * SEEDS. `componentSeed(seed, unit id, purpose)`: the displacement field, each unit's angle variation
 * and technique (mixed), and which units are filled (`share`: a unit is filled when its own draw is
 * below the share, so raising the share only adds units). Ids never depend on seed or appearance.
 *
 * CONSUMERS. Drawing order: the united shadow, halos, fills, letter edges, insets. Every consumer is
 * replaceable (`OutlineTypeConsumers`): the filler (producer), how a unit's fill is painted, how an
 * outline ring set is stroked. Stock fill painting: `shapes` as filled polygons (holes by keyhole
 * cuts through ink), `paths` through `pathMaterial` (line = ink, stitch, beads; stitch and bead marks
 * are kept inside by trimming both ends of an open path by the mark's reach), `marks` through the
 * stock `motif`. The layer is transparent; nothing paints the canvas. Palette entry 0 is the ink of
 * shadows and outlines, entries 1… colour the fills by the colour rule.
 *
 * WORK. Producers bound their geometry (documented per producer) and the drawing charges one run
 * unit per stroke and per mark (default 300,000). Totals over the composition: 20,000 fill paths,
 * 600,000 fill vertices, 30,000 marks, 40,000 stitch or bead stations; each is an error that names
 * the controls that raise the count.
 */
export const MAX_FILL_PATHS = 20_000;
export const MAX_FILL_POINTS = 600_000;
export const MAX_FILL_MARKS = 30_000;
export const MAX_OUTLINE_STATIONS = 40_000;

export type OutlineTypeColorBy = "ink" | "unit" | "line" | "technique";
export interface OutlineTypeComposition {
  kind: "outline-type";
  seed: number;
  palette: readonly number[];
  text: OutlineText;
  type: { kerning: KerningRule; tracking: number; size: number; leading: number; centerX: number; centerY: number; rotation: number };
  unit: OutlineUnitKind;
  /** Amount and length in canvas units. */
  displacement: OutlineDisplacementSpec;
  fill: OutlineFillSpec;
  /** Units are filled when their own draw is below this share (1 fills every unit). */
  share: number;
  /** Canvas units; null omits the ring. */
  outline: { edge: boolean; halo: number | null; inline: number | null; join: "round" | "miter" | "bevel" };
  shadow: { kind: "none" | "cast" | "extrude"; dx: number; dy: number };
  ink: { stroke: "line" | "stitch" | "beads"; weight: number; pitch: number; wash: number; colorBy: OutlineTypeColorBy; outlineWeight: number; shadowOpacity: number };
}

/** One unit with everything derived from it. */
export interface OutlineUnitProduct {
  readonly unit: OutlineUnit;
  /** Null when the unit is not among the filled share. */
  readonly fill: OutlineFill | null;
  readonly halo: PlanarDomain | null;
  readonly inline: PlanarDomain | null;
  /** The letter's own shadow: its translated copy (cast) or its sweep (extrude) minus the letter. */
  readonly shadow: PlanarDomain | null;
}
export interface OutlineTypeProducts {
  readonly layout: OutlineLayout;
  readonly units: readonly OutlineUnitProduct[];
  /**
   * What the shadows show: every unit's shadow united and then cleared of every letter, so shadows
   * overlap without darkening and never lie over ink. Null without a shadow.
   */
  readonly shadow: PlanarDomain | null;
}

/** Optional replacements of the stock producer and consumers. */
export interface OutlineTypeConsumers {
  filler?: OutlineFiller;
  /** Paint one unit's fill; `tone` is the colour rule's palette index. */
  fill?: (surface: CompositionSurface, product: OutlineUnitProduct, tone: number, run: CompositionRun) => void;
  /** Stroke the rings of an outline domain. */
  outline?: (surface: CompositionSurface, domain: PlanarDomain, role: "halo" | "edge" | "inline", product: OutlineUnitProduct) => void;
}

type Scalar = number | string | boolean;
const HALOS = ["halo", "edge-halo", "halo-inline", "all"];
const INLINES = ["inline", "edge-inline", "halo-inline", "all"];
const EDGES = ["edge", "edge-inline", "edge-halo", "all"];

/** Resolve stored scalar controls to the public composition value. */
export function outlineTypeComposition(input: InstrumentInput): OutlineTypeComposition {
  if (input.technique !== outlineTypeDefinition.id) throw new Error(`Not a ${outlineTypeDefinition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((rgb) =>
    !Number.isSafeInteger(rgb) || rgb < 0 || rgb > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(outlineTypeDefinition, input.params) as Record<string, Scalar>;
  const text = bundledOutlineTexts[q.phrase as string];
  if (!text) throw new Error(`Unknown bundled phrase: ${String(q.phrase)}`);
  const size = q.size as number, outline = q.outline as string, angle = (q.shadowAngle as number) * Math.PI / 180, reach = (q.shadowDistance as number) * size;
  const displaced = q.displace !== "none" && (q.displaceAmount as number) > 0;
  return {
    kind: "outline-type", seed: input.seed, palette: [...input.palette], text,
    type: { kerning: q.kerning as KerningRule, tracking: q.tracking as number, size, leading: q.leading as number,
      centerX: q.centerX as number, centerY: q.centerY as number, rotation: q.rotation as number },
    unit: q.unit as OutlineUnitKind,
    displacement: displaced ? { kind: q.displace as "noise" | "wave", amount: (q.displaceAmount as number) * size, length: (q.displaceLength as number) * size } : { kind: "none" },
    fill: { kind: q.fill as OutlineFillSpec["kind"], spacing: q.spacing as number, angle: q.angle as number, angleSpread: q.angleSpread as number,
      cross: q.cross as boolean, origin: q.origin as "shared" | "unit", chirp: q.chirp as number, waveAmplitude: q.waveAmplitude as number,
      waveLength: q.waveLength as number, lattice: q.lattice as "square" | "hex", markKind: q.markKind as "dot" | "rings" | "rosette",
      markSize: q.markSize as number, ramp: q.ramp as number, count: q.steps as number },
    share: q.share as number,
    outline: { edge: EDGES.includes(outline), halo: HALOS.includes(outline) ? (q.haloDistance as number) * size : null,
      inline: INLINES.includes(outline) ? (q.inlineDistance as number) * size : null, join: q.join as "round" | "miter" | "bevel" },
    shadow: q.shadow === "none" ? { kind: "none", dx: 0, dy: 0 } : { kind: q.shadow as "cast" | "extrude", dx: Math.cos(angle) * reach, dy: Math.sin(angle) * reach },
    ink: { stroke: q.stroke as "line" | "stitch" | "beads", weight: q.weight as number, pitch: q.pitch as number, wash: q.wash as number,
      colorBy: q.colorBy as OutlineTypeColorBy, outlineWeight: q.outlineWeight as number, shadowOpacity: q.shadowOpacity as number },
  };
}

/** The composition's construction: everything geometry depends on, nothing appearance. */
function constructionKey(recipe: OutlineTypeComposition): string {
  const { seed, text, type, unit, displacement, fill, share, outline, shadow } = recipe;
  return JSON.stringify([seed, text, type, unit, displacement, fill, share, outline.halo, outline.inline, outline.join, shadow]);
}

function planUnits(recipe: OutlineTypeComposition): { layout: OutlineLayout; units: readonly OutlineUnit[] } {
  const layout = outlineLayout({ text: recipe.text, ...recipe.type });
  return { layout, units: displaceUnits(outlineUnits(layout, recipe.unit), recipe.displacement, recipe.seed) };
}

function buildUnit(recipe: OutlineTypeComposition, unit: OutlineUnit, filler: OutlineFiller): OutlineUnitProduct {
  const { outline, shadow } = recipe;
  const filled = unitDraw(recipe.seed, unit.id, "share") < recipe.share;
  const fill = filled ? filler(unit, { seed: recipe.seed, origin: [recipe.type.centerX, recipe.type.centerY] }) : null;
  const halo = outline.halo === null ? null : withControls("Halo", "Halo distance, Type size", () =>
    offsetDomain(unit.domain, outline.halo!, { join: outline.join, id: `${unit.id}/halo` }));
  const inline = outline.inline === null ? null : withControls("Inline", "Inline distance, Type size", () =>
    offsetDomain(unit.domain, -outline.inline!, { join: outline.join, id: `${unit.id}/inline` }));
  const cast = shadow.kind === "none" ? null : withControls("Shadow", "Shadow distance, Type size, Fill unit", () =>
    shadowDomain([unit.domain], shadow.dx, shadow.dy, { sweep: shadow.kind === "extrude", id: `${unit.id}/shadow` }));
  return Object.freeze({ unit, fill, halo, inline, shadow: cast });
}

function assemble(recipe: OutlineTypeComposition, layout: OutlineLayout, units: readonly OutlineUnitProduct[]): OutlineTypeProducts {
  checkTotals(units);
  const shadow = !recipe.shadow || recipe.shadow.kind === "none" ? null : withControls("Shadow", "Shadow distance, Type size, Fill unit", () =>
    shadowDomain(units.map((p) => p.unit.domain), recipe.shadow.dx, recipe.shadow.dy, { sweep: recipe.shadow.kind === "extrude", id: "shadow" }));
  return Object.freeze({ layout, units: Object.freeze(units), shadow });
}

function checkTotals(products: readonly OutlineUnitProduct[]): void {
  let paths = 0, points = 0, marks = 0;
  for (const { fill } of products) if (fill) {
    paths += fill.paths.length; marks += fill.marks.length;
    for (const path of fill.paths) points += path.points.length;
  }
  if (paths > MAX_FILL_PATHS) throw new Error(`The fill would draw ${paths} lines; the limit is ${MAX_FILL_PATHS}. Raise Line spacing, lower Steps or Type size, or use a larger Fill unit`);
  if (points > MAX_FILL_POINTS) throw new Error(`The fill has ${points} vertices; the limit is ${MAX_FILL_POINTS}. Raise Line spacing or lower Steps`);
  if (marks > MAX_FILL_MARKS) throw new Error(`The fill would draw ${marks} marks; the limit is ${MAX_FILL_MARKS}. Raise Line spacing or Mark size, or lower Type size`);
}

const productCache = new Map<string, OutlineTypeProducts>();
/**
 * Producer results: the cached values `drawOutlineType` consumes. A custom `filler` bypasses the
 * cache (its identity is not a construction key) and is otherwise the stock filler of `recipe.fill`.
 */
export function outlineTypeProducts(recipe: OutlineTypeComposition, filler?: OutlineFiller): OutlineTypeProducts {
  const make = (): OutlineTypeProducts => {
    const { layout, units } = planUnits(recipe);
    const fillUnit = filler ?? outlineFillerFor(recipe.fill);
    return assemble(recipe, layout, units.map((unit) => buildUnit(recipe, unit, fillUnit)));
  };
  return filler ? make() : memoized(productCache, constructionKey(recipe), make);
}

/** Palette index of a unit's fill under a colour rule; only structure decides it. */
export function outlineTone(product: OutlineUnitProduct, colorBy: OutlineTypeColorBy, paletteSize: number): number {
  const kind: OutlineFillKind = product.fill?.kind ?? "none";
  const raw = colorBy === "unit" ? product.unit.index : colorBy === "line" ? product.unit.line : colorBy === "technique" ? ["none", "solid", ...OUTLINE_MIXED_KINDS].indexOf(kind) : 0;
  return paletteSize <= 1 ? 0 : 1 + raw % (paletteSize - 1);
}

/** Shorten an open path by `amount` at both ends; null when nothing is left. Closed paths are returned as they are. */
export function trimPath(path: Path, amount: number): Path | null {
  if (path.closed || amount <= 0) return path;
  const points = path.points, lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const total = lengths[lengths.length - 1];
  if (!(total > 2 * amount)) return null;
  const at = (s: number): [number, number] => {
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < s) i++;
    const span = lengths[i] - lengths[i - 1], t = span === 0 ? 0 : (s - lengths[i - 1]) / span;
    return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t];
  };
  const kept: (readonly [number, number])[] = [at(amount)];
  for (let i = 1; i < points.length - 1; i++) if (lengths[i] > amount && lengths[i] < total - amount) kept.push(points[i]);
  kept.push(at(total - amount));
  return Object.freeze({ ...path, points: Object.freeze(kept.map((p) => Object.freeze([p[0], p[1]] as const))) });
}

const noMark = { kind: "dot" as const, size: 0, petals: 1, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 };
/** The stock path material of an ink choice, with the trimming that keeps stitch and bead marks inside their domain. */
export function fillMaterial(recipe: OutlineTypeComposition): PathMaterial {
  const { stroke, weight, pitch } = recipe.ink;
  if (stroke === "line") return pathMaterial({ kind: "ink", weight, spacing: pitch, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark: noMark }, recipe.palette);
  const beads = stroke === "beads";
  const spec: PathMaterialSpec = { kind: stroke, weight, spacing: pitch, phase: 0.5, phaseSpread: 0, levelRamp: 0, retention: 1,
    mark: { kind: "dot", size: weight * 2.5, petals: 1, opening: 0, weight, rotation: 0, variation: 0, retention: 1 } };
  const material = pathMaterial(spec, recipe.palette), reach = beads ? weight * 1.25 : pitch * 0.27 + weight / 2;
  return (surface, path, run) => { const trimmed = trimPath(path, reach); if (trimmed) material(surface, trimmed, run); };
}

function fillDomain(surface: CompositionSurface, domain: PlanarDomain, palette: readonly number[], tone: number, alpha: number): void {
  surface.noStroke();
  color(surface, palette, tone, alpha, true);
  for (const region of domain.regions) {
    surface.beginShape();
    for (const [x, y] of keyholeRing(region)) surface.vertex(x, y);
    surface.endShape(surface.CLOSE);
  }
}
function strokeRings(surface: CompositionSurface, domain: PlanarDomain, palette: readonly number[], weight: number): void {
  surface.noFill();
  color(surface, palette, 0, 235, false);
  surface.strokeWeight(weight);
  for (const ring of domainRings(domain)) {
    surface.beginShape();
    for (const [x, y] of ring) surface.vertex(x, y);
    surface.endShape(surface.CLOSE);
  }
}

function stationsOf(paths: readonly Path[], pitch: number): number {
  let total = 0;
  for (const path of paths) {
    let length = 0;
    for (let i = 1; i < path.points.length; i++) length += Math.hypot(path.points[i][0] - path.points[i - 1][0], path.points[i][1] - path.points[i - 1][1]);
    total += Math.ceil(length / pitch) + 1;
  }
  return total;
}

/** Draw the recipe into a caller-owned surface: shadows, halos, fills, edges, insets. */
export function drawOutlineType(surface: CompositionSurface, recipe: OutlineTypeComposition, consumers: OutlineTypeConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 300_000 })): void {
  run.check();
  const products = outlineTypeProducts(recipe, consumers.filler), { palette, ink } = recipe;
  const shadowAlpha = 255 * ink.shadowOpacity;
  if (products.shadow) fillDomain(surface, products.shadow, palette, 0, shadowAlpha);
  const stroke = (role: "halo" | "edge" | "inline", p: OutlineUnitProduct, domain: PlanarDomain): void =>
    consumers.outline ? consumers.outline(surface, domain, role, p) : strokeRings(surface, domain, palette, ink.outlineWeight);
  for (const p of products.units) if (p.halo) stroke("halo", p, p.halo);
  const material = fillMaterial(recipe);
  let stations = 0;
  for (const p of products.units) {
    run.check();
    if (!p.fill) continue;
    const tone = outlineTone(p, ink.colorBy, palette.length);
    if (consumers.fill) { consumers.fill(surface, p, tone, run); continue; }
    for (const shape of p.fill.shapes) fillDomain(surface, shape.domain, palette, tone, p.fill.kind === "bands" ? 255 * ink.wash : 255);
    if (ink.stroke !== "line") {
      stations += stationsOf(p.fill.paths, ink.pitch);
      if (stations > MAX_OUTLINE_STATIONS) throw new Error(`The stitches would need ${stations} stations; the limit is ${MAX_OUTLINE_STATIONS}. Raise Stitch pitch or Line spacing, or use Line strokes`);
    }
    strokeWith(surface, p.fill.paths, tonedMaterial(material, tone), run);
    if (p.fill.marks.length) {
      const spec = recipe.fill, mark = motif({ kind: spec.markKind, size: spec.markSize * spec.spacing, petals: 6, opening: 0.25, weight: ink.weight, rotation: 0, variation: 0, retention: 1 }, palette);
      atEach(surface, p.fill.marks, (s, site, r) => mark(s, { ...site, tone }, r), run);
    }
  }
  if (recipe.outline.edge) for (const p of products.units) stroke("edge", p, p.unit.domain);
  for (const p of products.units) if (p.inline) stroke("inline", p, p.inline);
}

/** Build the producers cooperatively (yielding between units) and cache them; false when cancelled. */
export async function prepareOutlineType(recipe: OutlineTypeComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const key = constructionKey(recipe);
  if (productCache.has(key)) return true;
  const yieldNow = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
  await yieldNow();
  if (cancelled()) return false;
  const { layout, units } = planUnits(recipe), filler = outlineFillerFor(recipe.fill), built: OutlineUnitProduct[] = [];
  let since = performance.now();
  for (const unit of units) {
    built.push(buildUnit(recipe, unit, filler));
    if (performance.now() - since > 8) { await yieldNow(); if (cancelled()) return false; since = performance.now(); }
  }
  memoized(productCache, key, () => assemble(recipe, layout, built));
  return !cancelled();
}
