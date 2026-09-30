import { hyperbolicGardensDefinition } from "../adapters/hyperbolic-gardens-instrument.js";
import type { InstrumentInput } from "../types.js";
import { validateParameterValues } from "../parameter-validation.js";
import { atEach, componentSeed, createCompositionRun, strokeWith } from "./core.js";
import { hyperbolicCellPaths, hyperbolicEdgePaths, hyperbolicTiling, retainCells } from "./hyperbolic.js";
import type { HyperbolicOptions, HyperbolicTile, HyperbolicTiling } from "./hyperbolic.js";
import { hyperbolicFrames, hyperbolicRings } from "./hyperbolic-frames.js";
import type { HyperbolicFrame, HyperbolicRing, HyperbolicRingAround } from "./hyperbolic-frames.js";
import { color, motif, pathMaterial } from "./materials.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, Path, PathMaterial, PathMaterialSpec, Point, Site } from "./types.js";

/**
 * Hyperbolic Gardens as a typed, JSON-compatible composition over the tiling producers in `hyperbolic.ts` and
 * `hyperbolic-frames.ts`, each a public function:
 *
 *   hyperbolicTiling -> retainCells -> cell paths / edge paths / rings / frames -> fills, materials, marks
 *
 * `hyperbolicProducts` returns the cached producer values. None depends on palette, materials, marks, weights,
 * taper, colour or fill choice, so an appearance edit reuses every one of them; `retention`, the anchor and the
 * ring numbers are construction. Only bundled construction is named here: the tiling is generated from {p,q}, so
 * nothing is a URL or an asset. Host binding of caller-owned motifs is future host work; any `Site[]` (frames)
 * or `Path[]` goes to `atEach` / `strokeWith` through the same consumers, and `drawHyperbolicProducts` draws the
 * result of your own pipeline.
 *
 * Tones (palette entries) follow `colorBy`; palette entry 0 is ink (edges, boundary) whenever there is more than
 * one entry, fills, rings and motifs use 1..n-1. Consumers can replace the cell fill, edge material, ring
 * material or motif with ordinary callbacks receiving the cached toned values. Work is charged to the run
 * (default 400,000 units) per path, hatch line and mark; construction has its own limits (see the producers).
 *
 * Sizes and weights of motifs are "as drawn at the disk centre" and shrink with each frame's conformal factor;
 * paths follow `taper`.
 */
export type HyperbolicColorBy = "generation" | "distance" | "parity" | "sector" | "single" | "ink";
export type HyperbolicCellFill = "none" | "flat" | "hatch" | "flat-bare" | "hatch-bare" | "flat-hatch";
export type HyperbolicMotifColor = "ink" | "color" | "contrast";
export type HyperbolicMark = "none" | "arrow" | "sprig" | "dot" | "rings" | "rosette";

export interface HyperbolicGardensComposition {
  kind: "hyperbolic-gardens";
  seed: number;
  palette: readonly number[];
  tiling: Omit<HyperbolicOptions, "seed">;
  retention: number;
  colorBy: HyperbolicColorBy;
  cells: { fill: HyperbolicCellFill; inset: number; opacity: number; hatch: { spacing: number; angle: number; weight: number } };
  edges: { material: "none" | "ink" | "stitch" | "beads"; color: "ink" | "generation"; weight: number; spacing: number; phase: number; bead: MotifSpec };
  rings: { around: "none" | HyperbolicRingAround; count: number; radius: number; round: number; weight: number };
  motifs: { mark: HyperbolicMark; color: HyperbolicMotifColor; radial: number; along: number; fit: number; weight: number; turn: number; petals: number; twigs: number;
    opening: number; variation: number; minMark: number };
  boundary: { limit: boolean; weight: number; taper: number };
}

/** Replace any built-in consumer with an ordinary callback. */
export interface HyperbolicConsumers { cell?: PathMaterial; edge?: PathMaterial; ring?: PathMaterial; mark?: Mark }

type Scalar = number | string | boolean;
const definition = hyperbolicGardensDefinition;
const radians = Math.PI / 180;
const U32 = 0x1_0000_0000;
/** Hatch lines in one cell above which a fill is refused (naming Hatch spacing); the run budget bounds the drawing. */
export const MAX_HATCH_LINES_PER_CELL = 1500;

/** Resolve stored scalar controls to the public composition value. */
export function hyperbolicGardensComposition(input: InstrumentInput): HyperbolicGardensComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((c) => !Number.isSafeInteger(c) || c < 0 || c > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const num = (key: string) => q[key] as number;
  return {
    kind: "hyperbolic-gardens", seed: input.seed, palette: [...input.palette],
    tiling: { p: num("p"), q: num("q"), center: q.center as HyperbolicOptions["center"], generations: num("generations"), diskRadius: num("diskRadius"),
      minSize: num("minSize"), centerX: num("centerX"), centerY: num("centerY"), radius: num("radius"), rotation: num("rotation") },
    retention: num("retention"), colorBy: q.colorBy as HyperbolicColorBy,
    cells: { fill: q.cellFill as HyperbolicCellFill, inset: num("inset"), opacity: num("opacity"),
      hatch: { spacing: num("hatchSpacing"), angle: num("hatchAngle"), weight: num("hatchWeight") } },
    edges: { material: q.edgeMaterial as "ink", color: q.edgeColor as "ink", weight: num("edgeWeight"), spacing: num("edgeSpacing"), phase: num("edgePhase"),
      bead: { kind: q.beadMark as MotifSpec["kind"], size: num("beadSize"), petals: 6, opening: 0.4, weight: num("beadWeight"), rotation: 0, variation: 0, retention: 1 } },
    rings: { around: q.ringsAround as "none", count: num("ringCount"), radius: num("ringRadius"), round: num("ringRound"), weight: num("ringWeight") },
    motifs: { mark: q.motif as HyperbolicMark, color: q.motifColor as HyperbolicMotifColor, radial: num("anchorRadial"), along: num("anchorAlong"), fit: num("motifFit"), weight: num("motifWeight"),
      turn: num("motifTurn"), petals: num("petals"), twigs: num("twigs"), opening: num("opening"), variation: num("motifVariation"), minMark: num("minMark") },
    boundary: { limit: q.limit as boolean, weight: num("limitWeight"), taper: num("taper") },
  };
}

/** Whether the seed can change this construction. */
export function hyperbolicGardensUsesSeed(q: Record<string, Scalar>): boolean {
  return (q.retention as number) > 0 && (q.retention as number) < 1 || q.motif !== "none" && (q.motifVariation as number) > 0;
}

export interface HyperbolicProducts {
  readonly tiling: HyperbolicTiling;
  /** The tiling after `retention`: every consumer reads this one. */
  readonly shown: HyperbolicTiling;
  readonly cells: readonly Path[];
  readonly edges: readonly Path[];
  readonly rings: readonly HyperbolicRing[];
  readonly frames: readonly HyperbolicFrame[];
}

const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
const EMPTY: readonly never[] = Object.freeze([]);

/** Conformal factor below which a motif would draw smaller than `minMark` canvas units. */
function markScale(recipe: HyperbolicGardensComposition, tiling: HyperbolicTiling): number {
  const size = recipe.motifs.fit * tiling.edgeSize;
  return size > 0 ? Math.min(1, recipe.motifs.minMark / size) : 1;
}

/** The producer values the consumers read; each is cached by its own construction. */
export function hyperbolicProducts(recipe: HyperbolicGardensComposition): HyperbolicProducts {
  const tiling = hyperbolicTiling({ seed: recipe.seed, ...recipe.tiling });
  const { retention } = recipe;
  const shown = retention >= 1 ? tiling : retainCells(tiling, `keep:${retention}`, (tile) => unit(tile.seed, tile.id, "keep") < retention);
  const wantsFill = recipe.cells.fill !== "none" && recipe.cells.opacity > 0;
  const { mark, radial, along } = recipe.motifs, { around, count, radius, round } = recipe.rings;
  return {
    tiling, shown,
    cells: wantsFill ? hyperbolicCellPaths(shown, recipe.cells.inset) : EMPTY,
    edges: recipe.edges.material !== "none" ? hyperbolicEdgePaths(shown) : EMPTY,
    rings: around !== "none" ? hyperbolicRings(shown, { seed: recipe.seed, around, count, radius, round }) : EMPTY,
    frames: mark !== "none" ? hyperbolicFrames(shown, { seed: recipe.seed, radial, along, minScale: markScale(recipe, shown) }) : EMPTY,
  };
}

/**
 * Palette entry of an element from its structure. Entry 0 is ink whenever the palette has more than one
 * entry; accents cycle through 1..n-1. `ink` keeps entry 0 everywhere.
 */
export function hyperbolicTone(mode: HyperbolicColorBy, paletteLength: number, element: { generation: number; distance: number; sector: number; mirrored?: boolean }): number {
  if (mode === "ink" || paletteLength < 2) return 0;
  const index = mode === "generation" ? element.generation : mode === "distance" ? element.distance : mode === "sector" ? element.sector
    : mode === "parity" ? (element.mirrored === undefined ? element.generation % 2 : element.mirrored ? 1 : 0) : 0;
  return 1 + index % (paletteLength - 1);
}

/** The conformal weight factor for a path from its midpoint: `1 - taper + taper * (1 - |z|^2)`. */
function pathScale(path: Path, taper: number, placement: HyperbolicTiling["placement"]): number {
  if (taper === 0) return 1;
  const mid = path.points[path.points.length >> 1];
  const x = (mid[0] - placement.centerX) / placement.radius, y = (mid[1] - placement.centerY) / placement.radius;
  return 1 - taper + taper * Math.max(0, 1 - x * x - y * y);
}

/** Materials cached per log-spaced scale bin: six bins per octave changes weights by at most 12%. */
function binned(make: (scale: number) => PathMaterial | null): (scale: number) => PathMaterial | null {
  const materials = new Map<number, PathMaterial | null>();
  return (scale) => {
    const bin = Math.round(Math.log2(Math.max(scale, 1e-6)) * 6);
    if (!materials.has(bin)) materials.set(bin, make(2 ** (bin / 6)));
    return materials.get(bin)!;
  };
}

function inkMaterial(weight: number, palette: readonly number[]): PathMaterial {
  return pathMaterial({ kind: "ink", weight, spacing: 4, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
    mark: { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } }, palette);
}

function edgeMaterial(recipe: HyperbolicGardensComposition, scale: number): PathMaterial | null {
  const { material, weight, spacing, phase, bead } = recipe.edges;
  if (material === "none" || (material !== "beads" && weight * scale < 0.02) || (material === "beads" && bead.size * scale < 0.1)) return null;
  const spec: PathMaterialSpec = { kind: material, weight: weight * scale, spacing: Math.max(0.5, spacing * scale), phase, phaseSpread: 0, levelRamp: 0, retention: 1,
    mark: { ...bead, size: bead.size * scale, weight: bead.weight * scale } };
  return pathMaterial(spec, recipe.palette);
}

/**
 * Even-odd scanline hatching of one simple polygon: parallel lines `spacing` apart, anchored to the canvas origin
 * so neighbouring cells continue each other's lines, clipped to the polygon. Curved cells are simple but not
 * convex, so each line may give several segments. The general exact hatcher is far too slow for thousands of
 * cells with hundreds of vertices each; this one is float, linear in lines x edges, and keeps every crossing.
 */
export function hatchPolygon(points: readonly Point[], angleDegrees: number, spacing: number, label = "Hatch spacing"): [number, number, number, number][] {
  const c = Math.cos(angleDegrees * radians), s = Math.sin(angleDegrees * radians);
  const u = points.map(([x, y]) => x * c + y * s), v = points.map(([x, y]) => -x * s + y * c);
  let lo = Infinity, hi = -Infinity;
  for (const value of v) { lo = Math.min(lo, value); hi = Math.max(hi, value); }
  const first = Math.ceil((lo - spacing / 2) / spacing), last = Math.floor((hi - spacing / 2) / spacing);
  if (last - first + 1 > MAX_HATCH_LINES_PER_CELL)
    throw new Error(`A cell needs ${last - first + 1} hatch lines; the limit is ${MAX_HATCH_LINES_PER_CELL}. Raise ${label} or lower Disk radius (cells are largest near the centre)`);
  const segments: [number, number, number, number][] = [];
  const n = points.length;
  for (let k = first; k <= last; k++) {
    const line = spacing / 2 + k * spacing;
    const crossings: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if ((v[i] <= line) === (v[j] <= line)) continue;
      crossings.push(u[i] + (line - v[i]) / (v[j] - v[i]) * (u[j] - u[i]));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2)
      segments.push([crossings[i] * c - line * s, crossings[i] * s + line * c, crossings[i + 1] * c - line * s, crossings[i + 1] * s + line * c]);
  }
  return segments;
}

/** Cell fill: flat paint or hatch lines inside one closed outline; the checker choices pick by generation parity. */
function cellFill(recipe: HyperbolicGardensComposition, placement: HyperbolicTiling["placement"]): PathMaterial {
  const { fill, opacity, hatch } = recipe.cells, { palette } = recipe;
  const layers = (level: number): "none" | "flat" | "hatch" => {
    const odd = level % 2 === 1;
    if (fill === "flat") return "flat";
    if (fill === "hatch") return "hatch";
    if (fill === "flat-bare") return odd ? "none" : "flat";
    if (fill === "hatch-bare") return odd ? "none" : "hatch";
    if (fill === "flat-hatch") return odd ? "hatch" : "flat";
    return "none";
  };
  const alpha = Math.round(255 * opacity);
  return (surface, path, run) => {
    const kind = layers(path.level);
    if (kind === "none" || path.points.length < 3) return;
    if (kind === "flat") {
      surface.noStroke(); color(surface, palette, path.tone ?? 0, alpha, true);
      surface.beginShape();
      for (const [x, y] of path.points) surface.vertex(x, y);
      surface.endShape(surface.CLOSE);
      return;
    }
    if (hatch.weight === 0) return;
    const lines = hatchPolygon(path.points, hatch.angle, hatch.spacing);
    if (lines.length === 0) return;
    run.enter(lines.length);
    try {
      surface.noFill(); color(surface, palette, path.tone ?? 0, alpha, false);
      surface.strokeWeight(hatch.weight * pathScale(path, recipe.boundary.taper, placement)); surface.strokeCap(surface.ROUND);
      for (const [x1, y1, x2, y2] of lines) { run.check(); surface.line(x1, y1, x2, y2); }
    } finally { run.leave(); }
  };
}

/**
 * A tiny branching sprig in the local frame: a stem along +x with twigs on one side (so a reflection is
 * visible), each twig forking once at its tip, and a fork at the stem's tip. `size` is the stem length.
 */
function sprig(spec: MotifSpec, palette: readonly number[], twigs: number): Mark {
  return (surface, site) => {
    if (spec.retention === 0 || spec.size === 0 || unit(site.seed, site.id, "keep") >= spec.retention) return;
    const half = spec.size * (1 - spec.variation * unit(site.seed, site.id, "size")) / 2;
    const ink = site.tone === undefined ? Math.floor(unit(site.seed, site.id, "ink") * palette.length) : Math.floor(site.tone);
    surface.rotate(spec.rotation * radians);
    surface.strokeWeight(spec.weight); surface.strokeCap(surface.ROUND); surface.noFill();
    color(surface, palette, ink, 225 * (site.opacity ?? 1), false);
    surface.line(-half, 0, half, 0);
    const fork = (x: number, y: number, angle: number, length: number) => {
      for (const turn of [-0.55, 0.55]) surface.line(x, y, x + Math.cos(angle + turn) * length, y + Math.sin(angle + turn) * length);
    };
    fork(half, 0, 0, half * 0.34);
    for (let i = 0; i < twigs; i++) {
      const t = (i + 0.6) / (twigs + 0.2);
      const x = -half + 2 * half * t * 0.86, length = half * 0.78 * (1 - 0.62 * t), angle = 0.95;
      const tipX = x + Math.cos(angle) * length, tipY = Math.sin(angle) * length;
      surface.line(x, 0, tipX, tipY);
      fork(tipX, tipY, angle - 0.25, length * 0.4);
    }
  };
}

function builtInMark(recipe: HyperbolicGardensComposition, tiling: HyperbolicTiling): Mark {
  const { mark, fit, weight, turn, petals, twigs, opening, variation } = recipe.motifs;
  if (fit * tiling.edgeSize > 500)
    throw new Error(`Motif size ${fit} of an edge is ${(fit * tiling.edgeSize).toFixed(0)} canvas units at the disk centre; the limit is 500. Lower Motif size or Disk radius (canvas)`);
  const spec: MotifSpec = { kind: mark === "sprig" || mark === "none" ? "arrow" : mark, size: fit * tiling.edgeSize, petals, opening, weight, rotation: mark === "dot" || mark === "rings" ? 0 : turn, variation, retention: 1 };
  return mark === "sprig" ? sprig(spec, recipe.palette, twigs) : motif(spec, recipe.palette);
}

function circlePath(placement: HyperbolicTiling["placement"], segments = 360): Path {
  const points: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const a = 2 * Math.PI * i / segments;
    points.push([placement.centerX + placement.radius * Math.cos(a), placement.centerY + placement.radius * Math.sin(a)]);
  }
  return { id: "limit", seed: 0, points, closed: true, level: 0, levelFraction: 0, tone: 0 };
}

function toned<T extends Site | Path>(items: readonly T[], tone: (item: T) => number): T[] {
  return items.map((item) => ({ ...item, tone: tone(item) }));
}

/** Draw already-built producer values; the composition chooses the built-in consumers, `consumers` replace them. */
export function drawHyperbolicProducts(surface: CompositionSurface, recipe: HyperbolicGardensComposition, products: HyperbolicProducts,
  consumers: HyperbolicConsumers, run: CompositionRun): void {
  const { palette, boundary } = recipe;
  const { shown } = products;
  const placement = shown.placement;
  const cellOf = new Map<string, HyperbolicTile>(shown.tiles.map((tile) => [tile.id, tile]));
  if (products.cells.length) {
    const cells = toned(products.cells, (path) => hyperbolicTone(recipe.colorBy, palette.length, cellOf.get(path.id)!));
    strokeWith(surface, cells, consumers.cell ?? cellFill(recipe, placement), run);
  }
  if (products.rings.length) {
    const rings = toned(products.rings, (ring) => hyperbolicTone(recipe.colorBy, palette.length, ring));
    const material = binned((scale) => inkMaterial(recipe.rings.weight * scale, palette));
    const custom = consumers.ring;
    strokeWith(surface, rings, custom ?? ((s, path, r) => material(pathScale(path, boundary.taper, placement))?.(s, path, r)), run);
  }
  if (products.edges.length) {
    const edges = toned(products.edges, (path) => recipe.edges.color === "generation"
      ? hyperbolicTone("generation", palette.length, { generation: path.level, distance: 0, sector: 0 }) : 0);
    const material = binned((scale) => edgeMaterial(recipe, scale));
    strokeWith(surface, edges, consumers.edge ?? ((s, path, r) => material(pathScale(path, boundary.taper, placement))?.(s, path, r)), run);
  }
  if (boundary.limit && boundary.weight > 0) strokeWith(surface, [circlePath(placement)], inkMaterial(boundary.weight, palette), run);
  if (products.frames.length) {
    const { color: motifColor } = recipe.motifs;
    const frames = toned(products.frames, (frame) => {
      if (motifColor === "ink") return 0;
      const tone = hyperbolicTone(recipe.colorBy, palette.length, frame);
      return motifColor === "contrast" && palette.length > 1 ? 1 + tone % (palette.length - 1) : tone;
    });
    atEach(surface, frames, consumers.mark ?? builtInMark(recipe, shown), run);
  }
}

/** Draw the recipe into a caller-owned surface; transparent layer, no clearing. */
export function drawHyperbolicGardens(surface: CompositionSurface, recipe: HyperbolicGardensComposition, consumers: HyperbolicConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 400_000 })): void {
  run.check();
  drawHyperbolicProducts(surface, recipe, hyperbolicProducts(recipe), consumers, run);
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the producers stage by stage, yielding between stages; false if cancelled. */
export async function prepareHyperbolicGardens(recipe: HyperbolicGardensComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  hyperbolicTiling({ seed: recipe.seed, ...recipe.tiling });
  await yieldToHost();
  if (cancelled()) return false;
  hyperbolicProducts(recipe);
  return !cancelled();
}
