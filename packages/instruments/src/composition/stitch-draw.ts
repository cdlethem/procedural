import { regionStitchDefinition, regionStitchFromValues } from "../adapters/region-stitch-instrument.js";
import type { StitchComposition, StitchThreadSpec } from "../adapters/region-stitch-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { componentSeed, createCompositionRun, strokeWith } from "./core.js";
import { pathMaterial } from "./materials.js";
import { stitchThreads } from "./stitch.js";
import type { StitchProducts, StitchRegionInfo, StitchThread } from "./stitch.js";
import { bundledStitchRegions } from "./stitch-regions.js";
import type { CompositionRun, CompositionSurface, Path, PathMaterial, PathMaterialSpec } from "./types.js";

/**
 * Region Stitch as a typed, JSON-compatible composition: one producer (`stitchThreads`: regions, direction field, fill and routing
 * rules, in `stitch.ts`) and one consumer (`strokeWith` + `pathMaterial`, here). The producer's threads carry no colour, weight or
 * material; everything below is appearance and never enters a cache key or an id.
 *
 * Colour. Palette entry 0 is the BASE thread: underlay and travel threads use it, and so do outlines and the crossing layer when
 * `trim` is `ink`. Region colours cycle through entries 1..n-1 (all of them, if the palette has one entry). `colorBy`:
 * `region` gives region `i` colour `1 + i mod (n-1)`; `tone` maps the region's tone t in [0, 1] to `1 + floor(t (n-1))` (the last
 * entry at t = 1); `row` gives each fill row colour `1 + (i + row ordinal) mod (n-1)`, alternating from row to row along the route;
 * `stitch` picks each stitch's colour from `componentSeed(seed, thread id + stitch index, "color")`. `trim` `region` uses the
 * region's colour for outlines and the crossing layer, `contrast` the next colour after it.
 *
 * Runs. The consumer paints RUNS: maximal stretches of consecutive stitches of one thread with one colour, as `Path`s (a
 * thread with one colour is drawn unsplit under its own id, otherwise `<thread id>/c<k>`). `consumers.thread` replaces the
 * material with any `PathMaterial` (it receives whole runs, `tone` set to the palette index above). The default material is
 * `pathMaterial`: `ink` draws each run as a stroked polyline of width `weight`, `stitch` lays dashes every `dash` units along it
 * and `beads` beads of diameter 1.8 x `weight`.
 */
export type { StitchColorBy, StitchComposition, StitchThreadSpec, ThreadKind, StitchTrim } from "../adapters/region-stitch-instrument.js";
export interface StitchConsumers { thread?: PathMaterial }

type Scalar = number | string | boolean;
const definition = regionStitchDefinition;

/** Resolve stored scalar controls to the public composition value. */
export function regionStitchComposition(input: InstrumentInput): StitchComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((color) =>
    !Number.isSafeInteger(color) || color < 0 || color > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  return regionStitchFromValues(q, input.seed, input.palette);
}

/** The regions and threads the composition draws. Cached by construction (never by colour or material). */
export function regionStitchProducts(recipe: StitchComposition, cancelled?: () => boolean): StitchProducts {
  const { kind: _kind, palette: _palette, source, thread: _thread, ...options } = recipe;
  return stitchThreads({ ...options, regions: bundledStitchRegions(source) }, cancelled);
}

interface Run extends Path { readonly stitch: number }
const U32 = 0x1_0000_0000;
const runCache = new WeakMap<readonly StitchThread[], Map<string, readonly Run[]>>();

function colorOf(thread: StitchThread, info: StitchRegionInfo, stitch: number, spec: StitchThreadSpec, palette: number, seed: number): number {
  if (palette === 1) return 0;
  const colors = palette - 1;
  const region = 1 + (info.index % colors);
  if (thread.role === "underlay" || thread.role === "travel") return 0;
  if (thread.role === "outline" || thread.role === "crossing") {
    if (spec.trim === "ink") return 0;
    if (spec.trim === "contrast") return 1 + ((info.index + 1) % colors);
  }
  switch (spec.colorBy) {
    case "region": return region;
    case "tone": return 1 + Math.min(colors - 1, Math.floor(info.tone * colors));
    case "row": {
      let row = 0;
      for (let k = thread.rowStarts.length - 1; k >= 0; k--) if (thread.rowStarts[k] <= stitch) { row = k; break; }
      return 1 + ((info.index + thread.firstRow + row) % colors);
    }
    case "stitch": return 1 + Math.floor(componentSeed(seed, `${thread.id}#${stitch}`, "color") / U32 * colors);
  }
}

/** Maximal same-colour stretches of each thread (see the module header). Cached per producer result, colour rule and palette size. */
export function stitchRuns(products: StitchProducts, spec: StitchThreadSpec, palette: number, seed: number): readonly Run[] {
  let byKey = runCache.get(products.threads);
  if (!byKey) { byKey = new Map(); runCache.set(products.threads, byKey); }
  const key = JSON.stringify([spec.colorBy, spec.trim, palette, spec.colorBy === "stitch" ? seed : null]);
  const hit = byKey.get(key);
  if (hit) return hit;
  const infos = new Map<string, StitchRegionInfo>(products.regions.map((info) => [info.id, info]));
  const runs: Run[] = [];
  for (const thread of products.threads) {
    const info = infos.get(thread.region)!;
    let from = 0, tone = colorOf(thread, info, 0, spec, palette, seed), split = false;
    const parts: Run[] = [];
    for (let i = 1; i <= thread.stitches; i++) {
      const next = i < thread.stitches ? colorOf(thread, info, i, spec, palette, seed) : -1;
      if (next === tone) continue;
      if (i < thread.stitches) split = true;
      parts.push(Object.freeze({ id: `${thread.id}/c${parts.length}`, seed: thread.seed, points: thread.points.slice(from, i + 1), closed: false as const, level: thread.level,
        levelFraction: thread.levelFraction, tone, stitch: from }));
      from = i; tone = next;
    }
    if (!split) runs.push(Object.freeze({ ...thread, tone: parts[0]?.tone ?? tone, stitch: 0 }));
    else runs.push(...parts);
  }
  byKey.set(key, Object.freeze(runs));
  if (byKey.size > 4) byKey.delete(byKey.keys().next().value as string);
  return runs;
}

function materialSpec(thread: StitchThreadSpec): PathMaterialSpec {
  const mark = { kind: "dot" as const, size: 1.8 * thread.weight, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 };
  return thread.kind === "ink"
    ? { kind: "ink", weight: thread.weight, spacing: 4, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark }
    : { kind: thread.kind, weight: thread.weight, spacing: thread.dash, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark };
}

/** Draw ready-made products with a thread spec (the direct-API entry): see `drawStitches` for a descriptor. */
export function drawStitchProducts(surface: CompositionSurface, products: StitchProducts, thread: StitchThreadSpec, palette: readonly number[], seed: number,
  consumers: StitchConsumers = {}, run: CompositionRun = createCompositionRun({ maxWork: 4_000_000 })): void {
  run.check();
  if (!consumers.thread && thread.weight === 0) return;
  const runs = stitchRuns(products, thread, palette.length, seed);
  strokeWith(surface, runs, consumers.thread ?? pathMaterial(materialSpec(thread), palette), run);
}

/** Draw the recipe into a caller-owned surface. */
export function drawStitches(surface: CompositionSurface, recipe: StitchComposition, consumers: StitchConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 4_000_000 })): void {
  drawStitchProducts(surface, regionStitchProducts(recipe), recipe.thread, recipe.palette, recipe.seed, consumers, run);
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the producers stage by stage, yielding between them; false if cancelled. */
export async function prepareStitches(recipe: StitchComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const { source } = recipe;
  bundledStitchRegions(source);
  await yieldToHost();
  if (cancelled()) return false;
  try {
    const products = regionStitchProducts(recipe, cancelled);
    stitchRuns(products, recipe.thread, recipe.palette.length, recipe.seed);
  } catch (error) {
    if (error instanceof Error && error.message === "Composition cancelled") return false;
    throw error;
  }
  return !cancelled();
}
