/**
 * Random Walk Fronts as a typed, JSON-compatible composition: one producer (the walk, published as a
 * `FrontsField`) and several consumers of the same field. See `docs/composition-random-walk-fronts.md`.
 *
 * - `mask`, `barrier`, `columns`, `rows`, `rules`, `steps` and the layer seed are the CONSTRUCTION: they make
 *   the grid and the walk, and they alone key the cached snapshots. `frame` (centre, cell size) and `view`
 *   (fill, bands, lines, hatching, marks, tips) and the palette are APPEARANCE: an appearance edit reuses the
 *   same snapshots object, and moving or scaling the lattice does too.
 * - Draw order: fill, hatching, lines (territory borders, front-age contours), marks, tips.
 * - `drawWalkFronts(surface, recipe, { mark, line, hatch })` replaces a consumer with an ordinary callback while
 *   the field, the sites and the paths stay the same cached objects.
 */
import type { InstrumentInput } from "../types.js";
import { randomWalkFrontsDefinition } from "../adapters/random-walk-fronts-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import { atEach, createCompositionRun, strokeWith } from "./core.js";
import { keyholeRing } from "./domains.js";
import { motif, pathMaterial } from "./materials.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, PathMaterial, PathMaterialSpec } from "./types.js";
import type { BundledRasterId } from "./raster-samples.js";
import { bandCount, bandDomains, cellRuns, frontContours, frontSites, territoryDomains, territoryHatching, territoryOutlines, type FrontsFrame } from "./walk-fronts-products.js";
import { prepareWalkFrontsSnapshots, walkFronts, frontsField, type FrontsField, type FrontsSnapshots, type WalkRules } from "./walk-fronts.js";
import { walkGrid, type WalkBarrier, type WalkGrid, type WalkMaskSource, type WalkShapeName } from "./walk-grid.js";

export type FillKind = "flat" | "bands" | "none";
export type LineKind = "none" | "territory" | "contours" | "both";

/** Appearance only: nothing here reaches the walk. */
export interface FrontsView {
  readonly fill: FillKind;
  readonly fillShape: "merged" | "runs";
  readonly fillAlpha: number;
  readonly bandEvery: number;
  readonly bandContrast: number;
  readonly lines: LineKind;
  readonly line: PathMaterialSpec;
  /** `ink`: the palette entry after the walk's colours; `colour`: territory (or, for contours, age) colour. */
  readonly lineTone: "ink" | "colour";
  readonly hatch: { readonly spacing: number; readonly angle: number; readonly turn: number; readonly weight: number } | null;
  readonly marks: { readonly stride: number; readonly size: number; readonly aging: number } | null;
  readonly tips: boolean;
}

export interface RandomWalkFrontsComposition {
  kind: "random-walk-fronts";
  seed: number;
  palette: readonly number[];
  mask: WalkMaskSource;
  barrier: WalkBarrier;
  columns: number;
  rows: number;
  rules: WalkRules;
  steps: number;
  frame: FrontsFrame;
  view: FrontsView;
}

/** Replace any consumer with an ordinary callback. */
export interface RandomWalkFrontsConsumers {
  /** Drawn at each claimed-cell site (`site.tone` is the owning colour, `site.scale` the age). */
  mark?: Mark;
  /** Drawn for every territory border and front-age contour path. */
  line?: PathMaterial;
  /** Drawn for every hatch stroke. */
  hatch?: PathMaterial;
}

type Scalar = number | string | boolean;
const definition = randomWalkFrontsDefinition;
const dot = (size: number): MotifSpec => ({ kind: "dot", size, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 });

/** Resolve stored scalar controls to the public composition value. */
export function randomWalkFrontsComposition(input: InstrumentInput): RandomWalkFrontsComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const shape = (name: WalkShapeName): WalkMaskSource =>
    ({ kind: "shape", shape: name, size: q.maskSize as number, islands: q.islands as number, ringWidth: q.ringWidth as number });
  const mask: WalkMaskSource = q.mask === "letters" ? { kind: "text", text: q.word as string, size: q.maskSize as number }
    : q.mask === "tones" ? { kind: "tones", image: q.image as BundledRasterId, seed: input.seed, from: q.toneFrom as number, to: q.toneTo as number }
    : q.mask === "open" ? { kind: "shape", shape: "open", size: 1, islands: 1, ringWidth: 0.5 }
    : shape(q.mask as WalkShapeName);
  const barrier: WalkBarrier = q.barrier === "wall" ? { kind: "wall", position: q.wallPosition as number, width: q.barrierWidth as number, gap: q.barrierGap as number }
    : q.barrier === "enclosure" ? { kind: "enclosure", size: q.enclosureSize as number, width: q.barrierWidth as number, gap: q.barrierGap as number }
    : q.barrier === "pillars" ? { kind: "pillars", spacing: q.pillarSpacing as number, radius: q.pillarRadius as number }
    : { kind: "none" };
  const material = q.lineMaterial as PathMaterialSpec["kind"], weight = q.lineWeight as number;
  return {
    kind: "random-walk-fronts", seed: input.seed, palette: [...input.palette], mask, barrier,
    columns: q.columns as number, rows: q.rows as number, steps: q.steps as number,
    rules: {
      neighbourhood: Number(q.neighbourhood) as 4 | 8, persistence: q.persistence as number, explore: q.explore as number,
      revisit: q.revisit as WalkRules["revisit"], branching: q.branching as number, maxWalkers: q.maxWalkers as number, patience: q.patience as number,
      walkersPerSeed: q.walkersPerSeed as number, colors: q.colors as number, transition: q.transition as WalkRules["transition"], shift: q.shift as number,
      coverage: q.coverage as number, seeding: { layout: q.seedLayout as "scatter", count: q.seedCount as number },
    },
    frame: { centerX: q.centerX as number, centerY: q.centerY as number, cell: q.cell as number },
    view: {
      fill: q.fill as FillKind, fillShape: q.fillShape as "merged" | "runs", fillAlpha: q.fillAlpha as number,
      bandEvery: q.bandEvery as number, bandContrast: q.bandContrast as number,
      lines: q.lines as LineKind, lineTone: q.lineTone as "ink" | "colour",
      line: { kind: material, weight, spacing: q.lineSpacing as number, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark: dot(Math.max(0.5, weight * 2.2)) },
      hatch: q.hatch ? { spacing: q.hatchSpacing as number, angle: q.hatchAngle as number, turn: q.hatchTurn as number, weight: q.hatchWeight as number } : null,
      marks: q.marks ? { stride: q.markStride as number, size: q.markSize as number, aging: q.markAging as number } : null,
      tips: q.tips as boolean,
    },
  };
}

/** What every consumer reads: the resolved grid, the cached snapshots of the walk and their published field. */
export interface FrontsProducts { readonly grid: WalkGrid; readonly snapshots: FrontsSnapshots; readonly field: FrontsField }

export const walkFrontsGrid = (recipe: RandomWalkFrontsComposition): WalkGrid => walkGrid(recipe.mask, recipe.barrier, recipe.columns, recipe.rows);

/** Run (or fetch) the walk of a recipe. The same construction returns the same snapshots object whatever the appearance. */
export function randomWalkFrontsProducts(recipe: RandomWalkFrontsComposition, run?: CompositionRun): FrontsProducts {
  const grid = walkFrontsGrid(recipe);
  const snapshots = walkFronts(grid, recipe.rules, recipe.seed, { steps: recipe.steps, run });
  return { grid, snapshots, field: frontsField(snapshots, grid) };
}

/* ------------------------------------------------------------------------------------- drawing */

const rgb = (palette: readonly number[], index: number): [number, number, number] => {
  const c = palette[((index % palette.length) + palette.length) % palette.length] >>> 0;
  return [(c >>> 16) & 255, (c >>> 8) & 255, c & 255];
};
const mix = ([r, g, b]: [number, number, number], t: number): [number, number, number] => {
  const target = t >= 0 ? 255 : 0, k = Math.abs(t);
  return [Math.round(r + (target - r) * k), Math.round(g + (target - g) * k), Math.round(b + (target - b) * k)];
};

function drawFill(surface: CompositionSurface, recipe: RandomWalkFrontsComposition, field: FrontsField, run: CompositionRun): void {
  const { view, frame, palette } = recipe, alpha = Math.round(view.fillAlpha * 255);
  if (view.fill === "none" || alpha === 0) return;
  const bands = view.fill === "bands" ? bandCount(field, view.bandEvery) : 1;
  const tone = (color: number, band: number): [number, number, number] => {
    const base = rgb(palette, color);
    return view.fill === "bands" && bands > 1 ? mix(base, view.bandContrast * band / (bands - 1)) : base;
  };
  surface.push();
  // A stroke of the fill colour closes the hairline seams between neighbouring shapes; only when opaque, else it would double.
  const style = ([r, g, b]: [number, number, number]) => {
    surface.fill(r, g, b, alpha);
    if (alpha === 255) { surface.stroke(r, g, b, 255); surface.strokeWeight(0.6); } else surface.noStroke();
  };
  if (view.fillShape === "merged") {
    const pieces = view.fill === "bands" ? bandDomains(field, frame, view.bandEvery) : territoryDomains(field, frame).map(({ color, domain }) => ({ color, band: 0, domain }));
    for (const { color, band, domain } of pieces) {
      style(tone(color, band));
      for (const region of domain.regions) {
        run.check();
        surface.beginShape();
        for (const [x, y] of keyholeRing(region)) surface.vertex(x, y);
        surface.endShape(surface.CLOSE);
      }
    }
  } else {
    const runs = cellRuns(field, view.fill === "bands" ? view.bandEvery : null), { data, stride } = runs;
    const left = frame.centerX - field.columns * frame.cell / 2, top = frame.centerY - field.rows * frame.cell / 2;
    let last = -1, lastBand = -1;
    for (let i = 0; i < runs.count; i++) {
      const color = data[i * stride + 3], band = stride === 5 ? data[i * stride + 4] : 0;
      if (color !== last || band !== lastBand) { style(tone(color, band)); last = color; lastBand = band; }
      surface.rect(left + data[i * stride] * frame.cell, top + data[i * stride + 1] * frame.cell, data[i * stride + 2] * frame.cell, frame.cell);
    }
    run.check();
  }
  surface.pop();
}

/** Draw a recipe into a caller-owned surface. Throws (naming the control) when a bound is exceeded. */
export function drawWalkFronts(surface: CompositionSurface, recipe: RandomWalkFrontsComposition, consumers: RandomWalkFrontsConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 600_000 })): void {
  run.check();
  const { view, frame, palette, seed } = recipe, { field } = randomWalkFrontsProducts(recipe, run);
  const ink = recipe.rules.colors, tone = view.lineTone === "ink" ? ink : null;
  drawFill(surface, recipe, field, run);
  if (view.hatch) {
    const paths = territoryHatching(field, frame, view.hatch, seed, view.lineTone === "ink" ? ink : null);
    const spec: PathMaterialSpec = { ...view.line, kind: "ink", weight: view.hatch.weight, retention: 1 };
    strokeWith(surface, paths, consumers.hatch ?? pathMaterial(spec, palette), run);
  }
  if (view.lines !== "none") {
    const material = consumers.line ?? pathMaterial(view.line, palette);
    if (view.lines === "territory" || view.lines === "both") strokeWith(surface, territoryOutlines(field, frame, seed, tone), material, run);
    if (view.lines === "contours" || view.lines === "both") strokeWith(surface, frontContours(field, frame, view.bandEvery, seed, tone), material, run);
  }
  if (view.marks) atEach(surface, frontSites(field, frame, view.marks, seed), consumers.mark ?? motif(dot(view.marks.size), palette), run);
  if (view.tips && field.ended === null) {
    const left = frame.centerX - field.columns * frame.cell / 2, top = frame.centerY - field.rows * frame.cell / 2;
    surface.push(); surface.noStroke();
    for (const w of field.walkers) { const [r, g, b] = rgb(palette, w.color); surface.fill(r, g, b, 255); surface.stroke(0, 0, 0, 200); surface.strokeWeight(0.8); surface.circle(left + (w.x + 0.5) * frame.cell, top + (w.y + 0.5) * frame.cell, frame.cell * 1.3); }
    for (const s of field.seeds) { surface.noFill(); surface.stroke(0, 0, 0, 200); surface.strokeWeight(0.8); surface.circle(left + (s.x + 0.5) * frame.cell, top + (s.y + 0.5) * frame.cell, frame.cell * 2.2); }
    surface.pop();
  }
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Run the walk in time slices, then build the geometry the view needs, yielding between pieces; false if cancelled. */
export async function prepareRandomWalkFronts(recipe: RandomWalkFrontsComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const grid = walkFrontsGrid(recipe);
  const snapshots = await prepareWalkFrontsSnapshots(grid, recipe.rules, recipe.seed, { steps: recipe.steps, cancelled });
  if (snapshots === null || cancelled()) return false;
  const field = frontsField(snapshots, grid), { view, frame, seed } = recipe, ink = recipe.rules.colors, tone = view.lineTone === "ink" ? ink : null;
  const pieces: (() => unknown)[] = [() => territoryDomains(field, frame)];
  if (view.fill === "bands") pieces.push(() => bandDomains(field, frame, view.bandEvery));
  if (view.fill !== "none" && view.fillShape === "runs") pieces.push(() => cellRuns(field, view.fill === "bands" ? view.bandEvery : null));
  if (view.lines === "territory" || view.lines === "both") pieces.push(() => territoryOutlines(field, frame, seed, tone));
  if (view.lines === "contours" || view.lines === "both") pieces.push(() => frontContours(field, frame, view.bandEvery, seed, tone));
  if (view.hatch) pieces.push(() => territoryHatching(field, frame, view.hatch!, seed, view.lineTone === "ink" ? ink : null));
  if (view.marks) pieces.push(() => frontSites(field, frame, view.marks!, seed));
  for (const piece of pieces) {
    piece();
    await yieldToHost();
    if (cancelled()) return false;
  }
  return true;
}
