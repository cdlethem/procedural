import { crossingLaceDefinition, laceShape, parseExceptions } from "../adapters/crossing-lace-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { atEach, createCompositionRun, strokeWith } from "./core.js";
import { orderCrossings } from "./crossing-order.js";
import type { CrossingOrder, OverRule } from "./crossing-order.js";
import { CROSSING_LIMITS, findCrossings } from "./crossings.js";
import type { CrossingSet } from "./crossings.js";
import { lacePaths } from "./lace-families.js";
import type { LaceFrame, LaceShape } from "./lace-families.js";
import { strandEnds, strandPieces } from "./lace-strands.js";
import type { StrandPiece, Strands } from "./lace-strands.js";
import { color, motif, pathMaterial } from "./materials.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, Path, PathMaterial, PathMaterialSpec, Site } from "./types.js";

/**
 * Crossing Lace as a typed, JSON-compatible composition: a path producer, a crossing detector, an
 * over/under assignment, a strand cutter and replaceable consumers, each a public function.
 *
 *   lacePaths → findCrossings → orderCrossings → strandPieces → material / end mark / overlay
 *
 * `crossingLaceProducts` returns the four cached producer values. The crossing table and the
 * order never depend on widths, clearance, style or colour, so an appearance edit reuses them and
 * only recuts the strand pieces (which do depend on widths: a wider stroke needs a wider gap).
 * Structure is: family, its controls, Corner cuts, Placement, seed. Rule, rank, invert and
 * exceptions change the order only.
 *
 * Only bundled families are named here, chosen by a validated select; the paths are generated
 * values, never a URL or an asset. Host binding of caller-owned paths is future host work: any
 * `Path[]` goes straight into `findCrossings`, and `drawCrossingLaceWith` draws the result of
 * your own pipeline through the same consumers (`drawCrossingLaceProducts`).
 *
 * Strand families are `tone % 2` of the source path (even strands A, odd strands B). Consumers
 * can replace the strand material and the end mark with ordinary callbacks; both receive the
 * cached pieces or sites unchanged. Work is charged to the run (default 400,000 units) per piece
 * and end mark; crossing search has its own limits (`CROSSING_LIMITS`).
 */
export type StrandStyle = "ink" | "cased" | "stitch" | "beads";
export interface CrossingLaceComposition {
  kind: "crossing-lace";
  seed: number;
  palette: readonly number[];
  lace: { frame: LaceFrame; smoothing: number; shape: LaceShape };
  order: { rule: OverRule; rankBy: "order" | "family" | "length"; invert: boolean; exceptions: readonly number[] };
  strands: {
    style: StrandStyle; widths: readonly [number, number]; casing: number; clearance: number; minAngle: number; spacing: number; phase: number;
    bead: "dot" | "rings"; coloring: "families" | "strands"; colors: readonly [number, number, number];
  };
  ends: { mark: "none" | "dot" | "rings" | "arrow"; size: number; trim: number };
  overlay: "none" | "numbers" | "breaks" | "near";
}
/** Replace the built-in strand material or end mark with an ordinary callback. */
export interface LaceConsumers { strand?: PathMaterial; end?: Mark }

type Scalar = number | string | boolean;
const definition = crossingLaceDefinition;

/** Resolve stored scalar controls to the public composition value. */
export function crossingLaceComposition(input: InstrumentInput): CrossingLaceComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  return {
    kind: "crossing-lace", seed: input.seed, palette: [...input.palette],
    lace: { frame: { centerX: q.centerX as number, centerY: q.centerY as number, width: q.width as number, height: q.height as number, rotation: q.rotation as number },
      smoothing: q.smoothing as number, shape: laceShape(q) },
    order: { rule: q.rule as OverRule, rankBy: q.rankBy as "order", invert: q.invert as boolean, exceptions: parseExceptions(q.exceptions as string) },
    strands: { style: q.style as StrandStyle, widths: [q.widthA as number, q.widthB as number], casing: q.casing as number, clearance: q.clearance as number, minAngle: q.minAngle as number,
      spacing: q.spacing as number, phase: q.stitchPhase as number, bead: q.beadMark as "dot", coloring: q.coloring as "families",
      colors: [q.colorA as number, q.colorB as number, q.casingColor as number] },
    ends: { mark: q.terminal as "none", size: q.terminalSize as number, trim: q.trim as number },
    overlay: q.overlay as "none",
  };
}

/** Whether the seed can change this construction. Rank ties are found by building, not guessed. */
export function crossingLaceUsesSeed(q: Record<string, Scalar>): boolean {
  if (q.family === "contours" || q.family === "loops" || q.family === "celtic" && (q.blocked as number) > 0) return true;
  if (q.rule !== "rank") return true;
  const recipe = crossingLaceComposition({ technique: definition.id, seed: 0, palette: [0], params: q, cutEdits: [] });
  const set = findCrossings(lacePaths({ seed: 0, ...recipe.lace }));
  const ranks = pathRanks(recipe, set);
  return set.crossings.some((crossing) => ranks[crossing.first.path] === ranks[crossing.second.path]);
}

const family = (path: Path) => (path.tone ?? 0) % 2;

function pathRanks(recipe: CrossingLaceComposition, set: CrossingSet): number[] {
  const { rankBy } = recipe.order;
  return set.paths.map((path, index) => rankBy === "order" ? index : rankBy === "family" ? family(path) : set.lengths[index]);
}

/** The strand's drawn thickness and its reach as an under strand, per path, from the style. */
function strandWidths(recipe: CrossingLaceComposition, set: CrossingSet): { widths: number[]; reach: number[] } {
  const { style, widths, spacing } = recipe.strands;
  const thickness = set.paths.map((path) => widths[family(path)] * (style === "stitch" ? 0.4 : 1));
  const reach = thickness.map((w) => (style === "stitch" && w > 0 ? w + 0.54 * spacing : w));
  return { widths: thickness, reach };
}

export interface CrossingLaceProducts {
  readonly paths: readonly Path[];
  readonly set: CrossingSet;
  readonly order: CrossingOrder;
  readonly strands: Strands;
  readonly ends: readonly Site[];
}

/** The producer values the consumers read; every one is cached by its own construction. */
export function crossingLaceProducts(recipe: CrossingLaceComposition): CrossingLaceProducts {
  const paths = lacePaths({ seed: recipe.seed, ...recipe.lace });
  const set = findCrossings(paths);
  const flips = recipe.order.exceptions.map((number) => {
    const crossing = set.crossings[number - 1];
    if (!crossing) throw new Error(`Exceptions: crossing ${number} does not exist; this lace has ${set.crossings.length} crossings`);
    return crossing.id;
  });
  const order = orderCrossings(set, { rule: recipe.order.rule, seed: recipe.seed, ranks: recipe.order.rule === "rank" ? pathRanks(recipe, set) : undefined,
    flips, invert: recipe.order.invert });
  const { widths, reach } = strandWidths(recipe, set);
  const trim = set.paths.some((path) => !path.closed) ? recipe.ends.trim : 0;
  const strands = strandPieces(set, order, { widths, reach, clearance: recipe.strands.clearance, minAngle: recipe.strands.minAngle, trim });
  const ends = recipe.ends.mark === "none" ? [] : strandEnds(set, strands, trim);
  return { paths, set, order, strands, ends };
}

const dot = (size: number, weight: number): MotifSpec => ({ kind: "dot", size, petals: 6, opening: 0, weight, rotation: 0, variation: 0, retention: 1 });
const spec = (kind: PathMaterialSpec["kind"], weight: number, spacing: number, phase: number, mark: MotifSpec): PathMaterialSpec =>
  ({ kind, weight, spacing, phase, phaseSpread: 0, levelRamp: 0, retention: 1, mark });

/** Colour a piece or site by its family slot, or by its own strand from palette entry 1 on (entry 0 stays the ink). */
function toneOf(recipe: CrossingLaceComposition, tone: number | undefined): number {
  if (recipe.strands.coloring === "families") return recipe.strands.colors[(tone ?? 0) % 2];
  return 1 + (tone ?? 0) % Math.max(1, recipe.palette.length - 1);
}
function retoned(material: PathMaterial, pick: (path: Path) => number): PathMaterial {
  return (surface, path, run) => material(surface, { ...path, tone: pick(path) }, run);
}

/** Built-in strand drawing: one or two ink passes, or stations, per family; gaps are already in the pieces. */
function strandPasses(recipe: CrossingLaceComposition): { material: PathMaterial; family: number }[] {
  const { style, widths, casing, spacing, phase, bead, colors } = recipe.strands, { palette } = recipe;
  const passes: { material: PathMaterial; family: number }[] = [];
  if (style === "cased") {
    for (const f of [0, 1]) passes.push({ family: f, material: retoned(pathMaterial(spec("ink", widths[f], 4, 0, dot(1, 1)), palette), () => colors[2]) });
    for (const f of [0, 1]) passes.push({ family: f, material: retoned(pathMaterial(spec("ink", Math.max(0, widths[f] - 2 * casing), 4, 0, dot(1, 1)), palette), (path) => toneOf(recipe, path.tone)) });
  } else for (const f of [0, 1]) {
    const w = widths[f];
    const material = style === "ink" ? spec("ink", w, 4, 0, dot(1, 1))
      : style === "stitch" ? spec("stitch", w * 0.4, spacing, phase, dot(1, 1))
      : spec("beads", 1, spacing, phase, bead === "dot" ? dot(w, 1) : { ...dot(w, Math.max(0.6, w / 6)), kind: "rings" as const });
    passes.push({ family: f, material: retoned(pathMaterial(material, palette), (path) => toneOf(recipe, path.tone)) });
  }
  return passes;
}

const DIGITS: Record<string, readonly (readonly [number, number])[][]> = {
  "0": [[[0, 0], [2, 0], [2, 4], [0, 4], [0, 0]]], "1": [[[0, 1], [1, 0], [1, 4]]],
  "2": [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 4], [2, 4]]], "3": [[[0, 0], [2, 0], [2, 4], [0, 4]], [[0, 2], [2, 2]]],
  "4": [[[0, 0], [0, 2], [2, 2]], [[2, 0], [2, 4]]], "5": [[[2, 0], [0, 0], [0, 2], [2, 2], [2, 4], [0, 4]]],
  "6": [[[2, 0], [0, 0], [0, 4], [2, 4], [2, 2], [0, 2]]], "7": [[[0, 0], [2, 0], [2, 4]]],
  "8": [[[0, 0], [2, 0], [2, 4], [0, 4], [0, 0]], [[0, 2], [2, 2]]], "9": [[[2, 2], [0, 2], [0, 0], [2, 0], [2, 4], [0, 4]]],
};

export function drawNumber(surface: CompositionSurface, value: number, x: number, y: number, size: number): void {
  const scale = size / 4, text = String(value);
  text.split("").forEach((digit, index) => {
    for (const stroke of DIGITS[digit]) for (let i = 1; i < stroke.length; i++)
      surface.line(x + (index * 3 + stroke[i - 1][0]) * scale, y + stroke[i - 1][1] * scale, x + (index * 3 + stroke[i][0]) * scale, y + stroke[i][1] * scale);
  });
}

/** Reading aids on top of the lace; nothing here changes a producer value. */
function drawOverlay(surface: CompositionSurface, recipe: CrossingLaceComposition, products: CrossingLaceProducts, run: CompositionRun): void {
  const { overlay, palette } = recipe;
  if (overlay === "none") return;
  const widest = Math.max(...recipe.strands.widths, 1), { set, order } = products;
  surface.push();
  try {
    surface.noFill(); surface.strokeCap(surface.ROUND);
    if (overlay === "numbers") {
      run.enter(2 * set.crossings.length);
      try {
        // Each number is drawn twice: a pale halo so it stays legible over strands, then the ink.
        for (const [weight, halo] of [[4.5, true], [1.5, false]] as const) {
          if (halo) surface.stroke(255, 255, 255, 235); else color(surface, palette, 0, 255, false);
          surface.strokeWeight(weight);
          for (const crossing of set.crossings) drawNumber(surface, crossing.index + 1, crossing.point[0] + widest * 0.55 + 3, crossing.point[1] - widest * 0.55 - 14, 12);
        }
      } finally { run.leave(); }
    } else if (overlay === "breaks") {
      const byId = new Map(set.crossings.map((crossing) => [crossing.id, crossing]));
      run.enter(order.breaks.length * 2);
      try {
        surface.strokeWeight(2.2);
        for (const item of order.breaks) {
          color(surface, palette, item.cause === "exception" ? 2 : 1, 255, false);
          for (const id of [item.before, item.after]) { const at = byId.get(id)!.point; surface.circle(at[0], at[1], widest * 2 + 6); }
        }
      } finally { run.leave(); }
    } else {
      const tolerance = Math.min(CROSSING_LIMITS.nearMiss, widest + recipe.strands.clearance);
      const misses = findCrossings(products.paths, { nearMiss: tolerance }).nearMisses;
      run.enter(misses.length);
      try {
        color(surface, palette, 2, 255, false); surface.strokeWeight(1.4);
        for (const miss of misses) surface.circle(miss.point[0], miss.point[1], Math.max(8, miss.distance + widest));
      } finally { run.leave(); }
    }
  } finally { surface.pop(); }
}

/** Draw already-built producer values; the composition's `strands`, `ends` and `overlay` choose the built-in consumers. */
export function drawCrossingLaceProducts(surface: CompositionSurface, recipe: CrossingLaceComposition, products: CrossingLaceProducts,
  consumers: LaceConsumers, run: CompositionRun): void {
  const { pieces } = products.strands;
  if (consumers.strand) strokeWith(surface, pieces, consumers.strand, run);
  else for (const { material, family: f } of strandPasses(recipe)) strokeWith(surface, pieces.filter((piece) => family(piece) === f), material, run);
  if (products.ends.length) {
    const { ends } = recipe, weight = Math.max(1, Math.min(...recipe.strands.widths.filter((w) => w > 0), 12) / 6);
    const base = motif({ kind: ends.mark === "none" ? "dot" : ends.mark, size: ends.size, petals: 6, opening: 0.3, weight, rotation: 0, variation: 0, retention: 1 }, recipe.palette);
    const mark: Mark = consumers.end ?? ((s, site, r) => base(s, { ...site, tone: toneOf(recipe, site.tone) }, r));
    atEach(surface, products.ends, mark, run);
  }
  drawOverlay(surface, recipe, products, run);
}

/** Draw the recipe into a caller-owned surface; transparent layer, no clearing. */
export function drawCrossingLace(surface: CompositionSurface, recipe: CrossingLaceComposition, consumers: LaceConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 400_000 })): void {
  run.check();
  drawCrossingLaceProducts(surface, recipe, crossingLaceProducts(recipe), consumers, run);
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the producers stage by stage, yielding between stages; false if cancelled. */
export async function prepareCrossingLace(recipe: CrossingLaceComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const paths = lacePaths({ seed: recipe.seed, ...recipe.lace });
  await yieldToHost();
  if (cancelled()) return false;
  findCrossings(paths);
  await yieldToHost();
  if (cancelled()) return false;
  crossingLaceProducts(recipe);
  return !cancelled();
}

export type { StrandPiece };
