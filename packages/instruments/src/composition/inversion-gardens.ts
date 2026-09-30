import { inversionGardensDefinition, inversionGardensUsesSeed } from "../adapters/inversion-gardens-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { atEach, createCompositionRun, strokeWith } from "./core.js";
import { arcSteps, circleCline, circleIntervals, sampleArc } from "./inversion.js";
import type { Constraint } from "./inversion.js";
import { gardenProducts, orbitOptions } from "./inversion-garden.js";
import type { Construction, Garden, GardenOptions } from "./inversion-garden.js";
import type { GardenDisc, GardenPath, GardenSite } from "./inversion-orbit.js";
import { sourceGeometry } from "./inversion-sources.js";
import { color, motif, pathMaterial } from "./materials.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, PathMaterial, PathMaterialSpec, Point, Site } from "./types.js";

/**
 * Inversion Gardens as a typed, JSON-compatible composition: a garden producer (`gardenProducts`) and
 * replaceable consumers, each an ordinary function.
 *
 *   gasket | orbit → Garden { images, paths, discs, sites, guides } → stroke material / disc fill / mark
 *
 * The producer value depends on the construction only. Colour, line style, fills, marks, the
 * original's visibility and the guides are appearance: changing them reuses the cached garden and
 * moves nothing. Structure is: construction, its controls, Growth, Source, Placement, the curve
 * tolerance (which changes only how arcs are sampled) and the seed.
 *
 * Only bundled sources and a validated Word are named here; binding a caller's own outline or
 * pattern is future host work. Through the direct API, `orbitImages` accepts any hand-built
 * `Source` placement and `drawInversionGardensProducts` draws any garden through the same consumers.
 *
 * Colour comes from the palette: entry 0 is the ink of guides and the faint original; entries 1.. are
 * cycled by the chosen attribute. Consumers may replace the stroke material, the disc fill and the
 * mark with ordinary callbacks; they receive the cached values unchanged. Work is charged to the run
 * (default 400,000 units) per path, disc and site.
 */
export type ColorBy = "generation" | "size" | "branch" | "parity";
export type OriginalMode = "none" | "faint" | "full";
export type StrokeStyle = "ink" | "stitch" | "beads";
export type FillKind = "none" | "flat" | "rings";
export type MarkKind = "none" | "dot" | "rings" | "arrow" | "rosette";

export interface InversionGardensComposition {
  kind: "inversion-gardens";
  seed: number;
  palette: readonly number[];
  garden: GardenOptions;
  lines: { stroke: StrokeStyle; weight: number; spacing: number; beadSize: number };
  fill: { kind: FillKind; opacity: number; rings: number };
  marks: { kind: MarkKind; size: number; weight: number };
  original: OriginalMode;
  guides: boolean;
  colorBy: ColorBy;
}

/** Replace the built-in stroke material, disc fill or mark with an ordinary callback. */
export type DiscFiller = (surface: CompositionSurface, disc: GardenDisc, run: CompositionRun) => void;
export interface GardenConsumers { stroke?: PathMaterial; fill?: DiscFiller; mark?: Mark }

type Scalar = number | string | boolean;
const definition = inversionGardensDefinition;

/** Resolve stored scalar controls to the public composition value. */
export function inversionGardensComposition(input: InstrumentInput): InversionGardensComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  return {
    kind: "inversion-gardens", seed: input.seed, palette: [...input.palette],
    garden: {
      seed: input.seed, construction: q.construction as Construction, centerX: q.centerX as number, centerY: q.centerY as number, radius: q.radius as number,
      rotation: q.rotation as number, clipShare: q.clipShare as number, generations: q.generations as number, minRadius: q.minRadius as number,
      retention: q.retention as number, tolerance: q.tolerance as number,
      gasket: { first: q.first as number, second: q.second as number },
      group: { circles: q.circles as number, arrangement: q.arrangement as "ring", ringRadius: q.ringRadius as number, circleRadius: q.circleRadius as number,
        spread: q.spread as number, twist: q.twist as number, jitter: q.jitter as number, rule: q.rule as "tree", word: q.word as string, exclusion: q.exclusion as number,
        source: { kind: q.source as "rings", density: q.density as number, glyph: q.glyph as string, size: q.sourceSize as number, x: q.sourceX as number,
          y: q.sourceY as number, turn: q.sourceTurn as number } },
    },
    lines: { stroke: q.stroke as StrokeStyle, weight: q.weight as number, spacing: q.spacing as number, beadSize: q.beadSize as number },
    fill: { kind: q.fill as FillKind, opacity: q.fillOpacity as number, rings: q.fillRings as number },
    marks: { kind: q.marks as MarkKind, size: q.markSize as number, weight: q.markWeight as number },
    original: q.original as OriginalMode, guides: q.guides as boolean, colorBy: q.colorBy as ColorBy,
  };
}

export { inversionGardensUsesSeed };

/** Palette entry of an element from the chosen attribute; entry 0 stays the ink. */
export function gardenTone(colorBy: ColorBy, paletteSize: number, item: { generation: number; branch: number; parity: number; octave: number }): number {
  const cycle = Math.max(1, paletteSize - 1);
  const index = colorBy === "generation" ? item.generation : colorBy === "size" ? item.octave : colorBy === "branch" ? Math.max(0, item.branch) : item.parity;
  return paletteSize <= 1 ? 0 : 1 + index % cycle;
}

/** The garden of a composition (cached). */
export function inversionGardensProducts(recipe: InversionGardensComposition): Garden {
  return gardenProducts(recipe.garden);
}

/** The bundled source's own outline and anchors in canvas units, for a reference layer; empty for the gasket. */
export function gardenSource(recipe: InversionGardensComposition) {
  return recipe.garden.construction === "orbit" ? sourceGeometry(orbitOptions(recipe.garden).source) : null;
}

const NOMINAL = 16;
const dot = (size: number, weight: number): MotifSpec => ({ kind: "dot", size, petals: 6, opening: 0, weight, rotation: 0, variation: 0, retention: 1 });

function strokeSpec(recipe: InversionGardensComposition): PathMaterialSpec {
  const { stroke, weight, spacing, beadSize } = recipe.lines;
  return { kind: stroke, weight, spacing, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark: dot(beadSize, 1) };
}

function withTone(recipe: InversionGardensComposition, path: GardenPath): GardenPath {
  return { ...path, tone: gardenTone(recipe.colorBy, recipe.palette.length, path) };
}

function drawArcs(surface: CompositionSurface, cx: number, cy: number, r: number, clip: Constraint[], tolerance: number): void {
  for (const [s, e] of circleIntervals({ kind: "circle", cx, cy, r }, clip)) {
    const full = e - s >= 2 * Math.PI - 1e-9;
    const points: Point[] = sampleArc({ kind: "arc", cx, cy, r, start: s, sweep: e - s }, arcSteps(r, e - s, tolerance, full ? 8 : 1));
    surface.beginShape();
    for (const [x, y] of points) surface.vertex(x, y);
    surface.endShape(full ? surface.CLOSE : undefined);
  }
}

/** The stock disc fill: a flat tone or concentric rings, always cut to the clip disc. */
export function discFill(recipe: InversionGardensComposition, clip: { cx: number; cy: number; r: number }): DiscFiller {
  const { kind, opacity, rings } = recipe.fill, palette = recipe.palette, tolerance = recipe.garden.tolerance;
  const region: Constraint[] = [{ region: circleCline(clip.cx, clip.cy, clip.r), inside: true }];
  return (surface, disc) => {
    if (kind === "none") return;
    const ink = gardenTone(recipe.colorBy, palette.length, disc);
    if (kind === "flat") {
      surface.noStroke(); color(surface, palette, ink, 255 * opacity, true);
      const distance = Math.hypot(disc.cx - clip.cx, disc.cy - clip.cy);
      if (distance + disc.r <= clip.r) { surface.circle(disc.cx, disc.cy, 2 * disc.r); return; }
      if (distance + clip.r <= disc.r) { surface.circle(clip.cx, clip.cy, 2 * clip.r); return; }
      // The lens: the disc's arc inside the clip disc, then the clip's arc inside the disc, both counterclockwise.
      const inDisc: Constraint[] = [{ region: circleCline(disc.cx, disc.cy, disc.r), inside: true }];
      const a = circleIntervals({ kind: "circle", cx: disc.cx, cy: disc.cy, r: disc.r }, region)[0];
      const b = circleIntervals({ kind: "circle", cx: clip.cx, cy: clip.cy, r: clip.r }, inDisc)[0];
      if (!a || !b) return;
      const first = sampleArc({ kind: "arc", cx: disc.cx, cy: disc.cy, r: disc.r, start: a[0], sweep: a[1] - a[0] }, arcSteps(disc.r, a[1] - a[0], tolerance));
      const second = sampleArc({ kind: "arc", cx: clip.cx, cy: clip.cy, r: clip.r, start: b[0], sweep: b[1] - b[0] }, arcSteps(clip.r, b[1] - b[0], tolerance));
      const end = first[first.length - 1];
      if (Math.hypot(end[0] - second[0][0], end[1] - second[0][1]) > Math.hypot(end[0] - second[second.length - 1][0], end[1] - second[second.length - 1][1])) second.reverse();
      surface.beginShape();
      for (const [x, y] of [...first, ...second]) surface.vertex(x, y);
      surface.endShape(surface.CLOSE);
    } else {
      surface.noFill(); color(surface, palette, ink, 220 * opacity, false); surface.strokeWeight(Math.max(0.5, recipe.lines.weight * 0.6));
      for (let j = 1; j <= rings; j++) drawArcs(surface, disc.cx, disc.cy, disc.r * j / (rings + 1), region, tolerance);
    }
  };
}

/** Faint outlines: the original, or the construction guides. */
function faint(surface: CompositionSurface, paths: readonly GardenPath[], palette: readonly number[], alpha: number, weight: number, run: CompositionRun): void {
  strokeWith(surface, paths, (s, path) => {
    s.noFill(); color(s, palette, 0, alpha, false); s.strokeWeight(weight);
    s.beginShape(); for (const [x, y] of path.points) s.vertex(x, y);
    s.endShape(path.closed ? s.CLOSE : undefined);
  }, run);
}

/**
 * The oriented sites a mark would receive: natural size scaled by Mark size. A mark is never cut, so
 * one whose diameter circle would leave the clip disc, or that is under 0.4 units across, is dropped.
 */
export function markSites(recipe: InversionGardensComposition, garden: Garden): Site[] {
  const sites: Site[] = [];
  const { clip } = garden;
  for (const site of garden.sites as readonly GardenSite[]) {
    if (site.generation === 0 && recipe.original !== "full") continue;
    const diameter = recipe.marks.size * site.size;
    if (diameter < 0.4 || Math.hypot(site.position[0] - clip.cx, site.position[1] - clip.cy) + diameter / 2 > clip.r) continue;
    sites.push({ id: site.id, seed: site.seed, position: site.position, angle: site.angle, scale: (site.scale < 0 ? -1 : 1) * diameter / NOMINAL,
      tone: gardenTone(recipe.colorBy, recipe.palette.length, site) });
  }
  return sites;
}

/** Draw already-built garden values; the composition chooses the built-in consumers. */
export function drawInversionGardensProducts(surface: CompositionSurface, recipe: InversionGardensComposition, garden: Garden, consumers: GardenConsumers, run: CompositionRun): void {
  try {
    drawElements(surface, recipe, garden, consumers, run);
  } catch (error) {
    if (error instanceof Error && error.message === "Composition work budget exceeded")
      throw new Error(`Drawing the garden needs more work than the budget allows (${run.workUsed} units used); use Ink or a wider Station spacing, raise Minimum radius, or lower Generations, Circles or Source density`);
    throw error;
  }
}

function drawElements(surface: CompositionSurface, recipe: InversionGardensComposition, garden: Garden, consumers: GardenConsumers, run: CompositionRun): void {
  const { palette } = recipe;
  const drawn = <T extends { generation: number }>(items: readonly T[]) => items.filter((item) => item.generation > 0 || recipe.original === "full");
  if (recipe.original === "faint") faint(surface, garden.paths.filter((path) => path.generation === 0), palette, 90, Math.max(0.6, recipe.lines.weight * 0.6), run);
  if (recipe.guides) faint(surface, garden.guides, palette, 60, 0.8, run);
  if (recipe.fill.kind !== "none" || consumers.fill) {
    const filler = consumers.fill ?? discFill(recipe, garden.clip);
    for (const disc of drawn(garden.discs)) {
      surface.push(); run.enter(1);
      try { filler(surface, disc, run); } finally { run.leave(); surface.pop(); }
    }
  }
  const material = consumers.stroke ?? pathMaterial(strokeSpec(recipe), palette);
  strokeWith(surface, drawn(garden.paths).map((path) => withTone(recipe, path)), material, run);
  if (recipe.marks.kind !== "none" || consumers.mark) {
    const kind = recipe.marks.kind === "none" ? "dot" : recipe.marks.kind;
    // The frame scales strokes with the mark; the local weight is divided back so lines keep one canvas width.
    const stock: Mark = (s, site, r) => {
      const scale = Math.abs(site.scale), weight = Math.min(recipe.marks.weight, 0.12 * NOMINAL * scale) / scale;
      motif({ kind, size: NOMINAL, petals: 6, opening: 0.3, weight, rotation: 0, variation: 0, retention: 1 }, palette)(s, site, r);
    };
    atEach(surface, markSites(recipe, garden), consumers.mark ?? stock, run);
  }
}

/** Draw the recipe into a caller-owned surface; transparent layer, no clearing. */
export function drawInversionGardens(surface: CompositionSurface, recipe: InversionGardensComposition, consumers: GardenConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 400_000 })): void {
  run.check();
  drawInversionGardensProducts(surface, recipe, inversionGardensProducts(recipe), consumers, run);
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the garden, yielding before the work; false if cancelled. */
export async function prepareInversionGardens(recipe: InversionGardensComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  await yieldToHost();
  if (cancelled()) return false;
  inversionGardensProducts(recipe);
  return !cancelled();
}
