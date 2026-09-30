import { aggregationColoniesDefinition } from "../adapters/aggregation-colonies-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { domainPaths, growColony, prepareColony, type Colony, type ColonyOptions, type ColonySite } from "./aggregation.js";
import { instrumentOptions } from "./aggregation-controls.js";
import { atEach, cachedBy, componentSeed, createCompositionRun, strokeWith } from "./core.js";
import { motif, pathMaterial, tonedMaterial } from "./materials.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, Path, PathMaterial, PathMaterialSpec, Site } from "./types.js";

/**
 * Aggregation colonies as a typed, JSON-compatible composition: ONE producer (`growColony`, the DLA
 * model in `aggregation.ts`) and several consumers that read the same frozen `Colony`.
 *
 * TREATMENTS (drawn in this order, each an ordinary consumer of the colony):
 *  1. `outline`: the domain's rings (walls and holes) through `pathMaterial`, palette tone 1.
 *  2. `halo`: a large translucent dot at every grain (`motif` with `Site.opacity`); overlaps build a soft
 *     density field, so the colony's mass reads as a glow.
 *  3. `link`: the parent graph as branch paths through `pathMaterial` (ink, stitches or beads). Consecutive
 *     links with one child and the same colour and weight band are chained into one polyline, so a limb is
 *     a continuous stroke rather than a row of overlapping caps.
 *  4. `marks`: any `motif` at every grain site (`atEach`).
 *  5. `tips`: any `motif` at the active tips (attached grains with no children).
 * Colour is a role, not a hue: `color.by` picks each grain's palette index from its attachment age
 * (`born / steps` in `bands` bands), its limb (the seed or seed-child it descends from, cycled), its depth
 * in the tree (`depth / maxDepth` in bands) or nothing (flat); every treatment reads the same index, so
 * a limb or an age band has one colour across halo, ink and marks. `taper` scales a grain's mark, and
 * its link's weight or bead size, by the share of the colony that hangs from it
 * (`log(1 + mass) / log(1 + maxMass)`, in six bands for links): trunks stay bold, tips thin out.
 * `reveal` draws only the grains attached by that fraction of `steps` (a time scrub of the SAME
 * snapshot: nothing recomputes, and colours keep their full-run meaning).
 *
 * Nothing here is part of the construction key: palette, mark, ink, colour, taper, reveal and outline are
 * read from the frozen colony at draw time, so a repaint reuses the same `Snapshots` and `Colony` objects
 * and the derived site and path lists, which are cached by colony identity and view.
 *
 * `drawAggregationColonies(surface, recipe, { mark, tip, link, halo })` replaces any consumer with an
 * ordinary callback while the colony and derived lists stay the same objects. The library never fetches or
 * decodes anything and never clears a canvas; lengths are canvas units.
 */
export type ColonyColorBy = "age" | "limb" | "depth" | "flat";
export const colonyColorings: readonly ColonyColorBy[] = ["age", "limb", "depth", "flat"];

/** How the colony is read for drawing. Never part of the construction. */
export interface ColonyView {
  /** Fraction of `steps` revealed, 0 to 1. */
  reveal: number;
  colorBy: ColonyColorBy;
  /** Palette bands for age, depth and limb colouring (at least 1). */
  bands: number;
  /** 0 keeps every mark and link full size; 1 shrinks the thinnest to a sixth. */
  taper: number;
}

export interface AggregationColoniesRecipe {
  kind: "aggregation-colonies";
  seed: number;
  palette: readonly number[];
  /** Released walkers. */
  steps: number;
  options: ColonyOptions;
  view: ColonyView;
  /** Mark size is a multiple of the grain diameter (`contact`). Null draws none. */
  marks: MotifSpec | null;
  tips: MotifSpec | null;
  /** Halo diameter as a multiple of the grain diameter, and its opacity per grain (0 to 1). */
  halo: { size: number; strength: number } | null;
  link: PathMaterialSpec | null;
  /** Outline weight; needs a domain. */
  outline: number | null;
}

/** Replace any consumer with an ordinary callback. */
export interface ColonyConsumers {
  mark?: Mark;
  tip?: Mark;
  halo?: Mark;
  /** Replaces the material of every link band (the taper then only chains and orders the paths). */
  link?: PathMaterial;
}

const LINK_BANDS = 6;
const DRAW_WORK = 600_000;

/* ------------------------------------------------------------------------------ views of the colony */

function checkView(view: ColonyView): void {
  if (!(view.reveal >= 0 && view.reveal <= 1)) throw new Error("Reveal must be from 0 to 1");
  if (!colonyColorings.includes(view.colorBy)) throw new Error(`Colour by must be one of ${colonyColorings.join(", ")}`);
  if (!Number.isInteger(view.bands) || view.bands < 1 || view.bands > 16) throw new Error("Colour bands must be an integer from 1 to 16");
  if (!(view.taper >= 0 && view.taper <= 1)) throw new Error("Taper must be from 0 to 1");
}

/** How many grains a reveal shows: those attached by step `round(reveal × steps)`. Grains are stored in birth order, so this is a prefix. */
export function shownGrains(colony: Colony, reveal: number): number {
  const limit = Math.round(reveal * colony.steps);
  let low = 0, high = colony.sites.length;
  while (low < high) { const mid = (low + high) >> 1; if (colony.sites[mid].born <= limit) low = mid + 1; else high = mid; }
  return low;
}

/** The palette index of a grain under a colouring. */
export function colonyTone(colony: Colony, site: ColonySite, colorBy: ColonyColorBy, bands: number): number {
  switch (colorBy) {
    case "age": return colony.steps === 0 ? 0 : Math.min(bands - 1, Math.floor(site.born / colony.steps * bands));
    case "depth": return colony.maxDepth === 0 ? 0 : Math.min(bands - 1, Math.floor(site.depth / colony.maxDepth * bands));
    case "limb": return site.limb % bands;
    case "flat": return 0;
  }
}

/** A grain's weight in the colony: 1 for the heaviest trunk, small for a tip. */
export function massFraction(colony: Colony, site: ColonySite): number {
  return colony.maxMass <= 1 ? 1 : Math.log1p(site.mass) / Math.log1p(colony.maxMass);
}

const linkBand = (fraction: number): number => Math.min(LINK_BANDS - 1, Math.floor(fraction * LINK_BANDS));
/** Relative size of link band `band` under a taper: the heaviest band is 1. */
const bandScale = (band: number, taper: number): number => 1 - taper * (1 - (band + 1) / LINK_BANDS);

const siteViews = new WeakMap<Colony, Map<string, readonly Site[]>>();
const pathViews = new WeakMap<Colony, Map<string, readonly LinkLayer[]>>();

const viewKey = (view: ColonyView): string => `${view.reveal}|${view.colorBy}|${view.bands}|${view.taper}`;

/** The grain sites a mark consumer places: colonies' grains coloured by role and scaled by taper. Frozen and cached by colony and view. */
export function colonyMarkSites(colony: Colony, view: ColonyView, opacity = 1): readonly Site[] {
  checkView(view);
  return cachedBy(siteViews, colony, `marks|${viewKey(view)}|${opacity}`, () => {
    const shown = shownGrains(colony, view.reveal);
    const out: Site[] = new Array(shown);
    for (let i = 0; i < shown; i++) {
      const site = colony.sites[i];
      out[i] = Object.freeze({ id: site.id, seed: site.seed, position: site.position, angle: site.angle,
        scale: 1 - view.taper * (1 - massFraction(colony, site)), tone: colonyTone(colony, site, view.colorBy, view.bands), ...(opacity === 1 ? {} : { opacity }) });
    }
    return Object.freeze(out);
  });
}

/** The active tips among the revealed grains (attached, no revealed child), coloured like their grains at full size. */
export function colonyTipSites(colony: Colony, view: ColonyView): readonly Site[] {
  checkView(view);
  return cachedBy(siteViews, colony, `tips|${viewKey(view)}`, () => {
    const shown = shownGrains(colony, view.reveal);
    const kids = new Int32Array(shown);
    for (let i = 0; i < shown; i++) { const parent = colony.sites[i].parent; if (parent >= 0) kids[parent]++; }
    const out: Site[] = [];
    for (let i = 0; i < shown; i++) {
      const site = colony.sites[i];
      if (site.parent >= 0 && kids[i] === 0) out.push(Object.freeze({ id: site.id, seed: site.seed, position: site.position, angle: site.angle, scale: 1,
        tone: colonyTone(colony, site, view.colorBy, view.bands) }));
    }
    return Object.freeze(out);
  });
}

/** One weight band of link polylines, thinnest band first. */
export interface LinkLayer { readonly band: number; readonly paths: readonly Path[] }

/**
 * The parent links of the revealed grains as chained polylines, grouped by weight band. A link runs from a
 * parent to its child; it continues the chain of its parent's incoming link when that parent has exactly
 * one revealed child and the two links share tone and band. Path ids are `chain:<first child serial>`;
 * `tone` is the colouring's palette index and `levelFraction` is `1 − (band + 1) / bands` (what a bead
 * ramp reads). Cached by colony and view.
 */
export function colonyLinkPaths(colony: Colony, view: ColonyView): readonly LinkLayer[] {
  checkView(view);
  return cachedBy(pathViews, colony, `links|${viewKey(view)}`, () => {
    const shown = shownGrains(colony, view.reveal), sites = colony.sites;
    const kids = new Int32Array(shown), only = new Int32Array(shown).fill(-1), tone = new Int32Array(shown), band = new Int32Array(shown);
    for (let i = 0; i < shown; i++) {
      const parent = sites[i].parent;
      tone[i] = colonyTone(colony, sites[i], view.colorBy, view.bands);
      band[i] = linkBand(massFraction(colony, sites[i]));
      if (parent >= 0) { kids[parent]++; only[parent] = i; }
    }
    const layers: Path[][] = Array.from({ length: LINK_BANDS }, () => []);
    for (let i = 0; i < shown; i++) {
      const parent = sites[i].parent;
      if (parent < 0) continue;
      // A chain starts here unless this link continues its parent's own incoming link.
      const continues = sites[parent].parent >= 0 && kids[parent] === 1 && tone[parent] === tone[i] && band[parent] === band[i];
      if (continues) continue;
      const points = [sites[parent].position, sites[i].position];
      let at = i;
      while (kids[at] === 1) {
        const next = only[at];
        if (tone[next] !== tone[i] || band[next] !== band[i]) break;
        points.push(sites[next].position); at = next;
      }
      const id = `chain:${i}`;
      layers[band[i]].push(Object.freeze({ id, seed: componentSeed(colony.seed, id, "link"), points: Object.freeze(points), closed: false,
        level: band[i], levelFraction: 1 - (band[i] + 1) / LINK_BANDS, tone: tone[i] }));
    }
    return Object.freeze(layers.map((paths, b): LinkLayer => Object.freeze({ band: b, paths: Object.freeze(paths) })).filter((layer) => layer.paths.length > 0));
  });
}

/* ------------------------------------------------------------------------------ the recipe */

const OUTLINE_TONE = 1;
const outlines = new WeakMap<Colony, Map<string, readonly Path[]>>();

function scaled(spec: MotifSpec, contact: number): MotifSpec {
  return { ...spec, size: spec.size * contact };
}

/** The colony a recipe draws, exactly as drawn: cached by construction. */
export function colonyOfRecipe(recipe: AggregationColoniesRecipe, request: { cancelled?: () => boolean; run?: CompositionRun } = {}): Colony {
  return growColony(recipe.options, recipe.steps, request);
}

/** Draw the recipe into a caller-owned surface: outline, halo, links, grain marks, then tips. */
export function drawAggregationColonies(surface: CompositionSurface, recipe: AggregationColoniesRecipe, consumers: ColonyConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: DRAW_WORK })): void {
  run.check();
  checkView(recipe.view);
  const colony = colonyOfRecipe(recipe, { run });
  const { view, palette } = recipe;
  if (recipe.outline !== null && colony.domain) {
    const paths = cachedBy(outlines, colony, "outline", () => domainPaths(colony.domain!, colony.seed));
    const spec: PathMaterialSpec = { kind: "ink", weight: recipe.outline, spacing: 1, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark: dot };
    strokeWith(surface, paths, tonedMaterial(pathMaterial(spec, palette), OUTLINE_TONE), run);
  }
  if (recipe.halo && colony.sites.length > 0) {
    const size = recipe.halo.size * colony.contact;
    atEach(surface, colonyMarkSites(colony, { ...view, taper: 0 }, recipe.halo.strength), consumers.halo ?? motif({ ...dot, size }, palette), run);
  }
  if (recipe.link) {
    for (const layer of colonyLinkPaths(colony, view)) {
      const spec: PathMaterialSpec = { ...recipe.link, weight: recipe.link.weight * bandScale(layer.band, view.taper), levelRamp: recipe.link.kind === "beads" ? view.taper : 0 };
      strokeWith(surface, layer.paths, consumers.link ?? pathMaterial(spec, palette), run);
    }
  }
  if (recipe.marks) atEach(surface, colonyMarkSites(colony, view), consumers.mark ?? motif(scaled(recipe.marks, colony.contact), palette), run);
  if (recipe.tips) atEach(surface, colonyTipSites(colony, view), consumers.tip ?? motif(scaled(recipe.tips, colony.contact), palette), run);
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Grow the colony in cancellable time slices, then build every list the drawing reads; false if cancelled. */
export async function prepareAggregationColonies(recipe: AggregationColoniesRecipe, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  checkView(recipe.view);
  const colony = await prepareColony(recipe.options, recipe.steps, cancelled);
  if (!colony) return false;
  await yieldToHost();
  if (cancelled()) return false;
  if (recipe.link) colonyLinkPaths(colony, recipe.view);
  if (recipe.marks || recipe.halo) colonyMarkSites(colony, recipe.view);
  if (recipe.tips) colonyTipSites(colony, recipe.view);
  return !cancelled();
}

/* ------------------------------------------------------------------------------ the instrument's recipe */

type Scalar = number | string | boolean;
const dot: MotifSpec = { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 };
const definition = aggregationColoniesDefinition;

const markSpec = (kind: string, size: number): MotifSpec | null => kind === "none" ? null
  : { kind: kind as MotifSpec["kind"], size, petals: kind === "arrow" ? 0 : 6, opening: 0, weight: Math.max(0.7, Math.min(2.5, size * 1.4)), rotation: 0, variation: 0, retention: 1 };

/** Resolve stored scalar controls to the public composition value. */
export function aggregationColoniesComposition(input: InstrumentInput): AggregationColoniesRecipe {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const linked = q.ink !== "none";
  return {
    kind: "aggregation-colonies", seed: input.seed, palette: [...input.palette], steps: q.steps as number,
    options: instrumentOptions(q, input.seed),
    view: { reveal: q.reveal as number, colorBy: q.colorBy as ColonyColorBy, bands: q.bands as number, taper: q.taper as number },
    marks: markSpec(q.mark as string, q.markSize as number),
    tips: markSpec(q.tipMark as string, q.tipSize as number),
    halo: q.halo === true ? { size: q.haloSize as number, strength: q.haloStrength as number } : null,
    link: linked ? { kind: q.ink === "line" ? "ink" : q.ink === "stitch" ? "stitch" : "beads", weight: q.inkWeight as number, spacing: q.inkSpacing as number,
      phase: 0.5, phaseSpread: 0, levelRamp: 0, retention: 1, mark: { ...dot, size: q.beadSize as number } } : null,
    outline: q.domain !== "none" && q.outline === true ? q.outlineWeight as number : null,
  };
}
