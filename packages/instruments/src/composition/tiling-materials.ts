import { hatchRegionLines2D } from "@procedurals/javascript";
import { atEach, componentSeed, strokeWith } from "./core.js";
import { motif, pathMaterial } from "./materials.js";
import { substitutionTiling, tileAncestorId, tilingEdgePaths } from "./tilings.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, Path, Point, TileColorMode, TileFiller, TileFillSpec,
  Tiling, TilingOptions, TilingTile, TilingVertex, TilingView } from "./types.js";

const radians = Math.PI / 180;
const U32 = 0x1_0000_0000;
const MAX_HATCH_LINES = 3_000;
const MAX_RINGS = 40;
const MAX_WASH_LAYERS = 8;

function unit(seed: number, id: string, purpose: string): number {
  return componentSeed(seed, id, purpose) / U32;
}
function requireFinite(label: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}

/**
 * Miter inset of a simple polygon with positive winding by `distance`, or undefined when the
 * polygon would collapse (an edge reverses, or its area vanishes). Each side is offset along its
 * inward normal and consecutive offset lines are intersected, so uniform clearance holds along
 * every side of both convex tiles and the concave chair.
 */
export function insetPolygon(points: readonly Point[], distance: number): Point[] | undefined {
  if (distance === 0) return points.map(([x, y]) => [x, y] as Point);
  const n = points.length, lines: { px: number; py: number; dx: number; dy: number }[] = [];
  for (let i = 0; i < n; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % n], length = Math.hypot(x2 - x1, y2 - y1);
    const dx = (x2 - x1) / length, dy = (y2 - y1) / length;
    // Positive winding keeps the interior on the side of (−dy, dx).
    lines.push({ px: x1 - dy * distance, py: y1 + dx * distance, dx, dy });
  }
  const result: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i + n - 1) % n], b = lines[i], det = a.dx * b.dy - a.dy * b.dx;
    if (Math.abs(det) < 1e-9) return undefined;
    const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / det;
    result.push([a.px + a.dx * t, a.py + a.dy * t]);
  }
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = result[i], [x2, y2] = result[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
    const [ox1, oy1] = points[i], [ox2, oy2] = points[(i + 1) % n];
    if ((x2 - x1) * (ox2 - ox1) + (y2 - y1) * (oy2 - oy1) <= 0) return undefined;
  }
  return area > 1e-9 ? result : undefined;
}

const hatchCache = new Map<string, readonly (readonly Point[])[]>();
/** Hatch lines of one inset local outline; congruent tiles of a class share one cached result. */
function hatchLines(outline: readonly Point[], inset: number, spacing: number, angle: number): readonly (readonly Point[])[] {
  const key = JSON.stringify([outline.map(([x, y]) => [Math.round(x * 1e6), Math.round(y * 1e6)]), inset, spacing, angle]);
  const hit = hatchCache.get(key);
  if (hit) return hit;
  const region = insetPolygon(outline, inset);
  let lines: readonly (readonly Point[])[] = [];
  if (region) {
    const theta = angle * radians;
    const result = hatchRegionLines2D({ region: { outer: region, holes: [] }, origin: [0, 0],
      direction: [Math.cos(theta), Math.sin(theta)], spacing, phase: spacing / 2, maxWork: 1_000_000, maxOutputPaths: MAX_HATCH_LINES });
    lines = Object.freeze(result.paths.map((line) => Object.freeze(line.map(([x, y]) => Object.freeze([x, y] as const)))));
  }
  hatchCache.set(key, lines);
  if (hatchCache.size > 48) hatchCache.delete(hatchCache.keys().next().value!);
  return lines;
}

function color(surface: CompositionSurface, palette: readonly number[], index: number, alpha: number, fill: boolean): void {
  if (!palette.length) throw new Error("Composition palette must have at least one color");
  const rgb = palette[Math.floor(index) % palette.length] >>> 0;
  if (fill) surface.fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, alpha);
  else surface.stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, alpha);
}
function outlinePath(surface: CompositionSurface, points: readonly Point[]): void {
  surface.beginShape();
  for (const [x, y] of points) surface.vertex(x, y);
  surface.endShape(surface.CLOSE);
}

export function tileFillValid(spec: TileFillSpec): void {
  if (!["none", "flat", "wash", "hatch", "concentric", "mark"].includes(spec.kind)) throw new Error(`Unknown tile fill: ${spec.kind}`);
  requireFinite("tile inset", spec.inset, 0, 500);
  requireFinite("tile opacity", spec.opacity, 0, 1);
  requireFinite("tile spacing", spec.spacing, 1, 1000);
  requireFinite("tile hatch angle", spec.angle, -3600, 3600);
  requireFinite("tile class turn", spec.classTurn, -3600, 3600);
  requireFinite("tile weight", spec.weight, 0, 50);
  requireFinite("tile wash layers", spec.layers, 1, MAX_WASH_LAYERS);
  if (!Number.isInteger(spec.layers)) throw new Error("tile wash layers must be an integer");
  requireFinite("tile bleed", spec.bleed, 0, 1);
  requireFinite("tile retention", spec.retention, 0, 1);
}

/**
 * A tile interior technique. Under `atEach` a tile arrives in its own frame (origin at the centroid, x along
 * its axis), so everything here is drawn from the tile's `outline`; congruent tiles share their geometry.
 * Kinds: flat paint, layered translucent wash with stable per-tile edge wander (`bleed`), parallel hatching
 * clipped to the tile, concentric inset outlines, or a `motif` at the centroid whose size is a fraction of the
 * tile's own scale. A tile's tone picks its color; omission (`retention`) is stable per tile id.
 */
export function tileFill(spec: TileFillSpec, palette: readonly number[]): TileFiller {
  tileFillValid(spec);
  const sized = new Map<number, Mark>();
  return (surface, tile, run) => {
    if (spec.kind === "none" || spec.retention === 0 || unit(tile.seed, tile.id, "keep") >= spec.retention) return;
    const ink = tile.tone ?? tile.classIndex;
    if (spec.kind === "mark") {
      const scale = Math.sqrt(tile.area), key = Math.round(scale * 100);
      let mark = sized.get(key);
      if (!mark) {
        const mspec: MotifSpec = { ...spec.mark, size: Math.min(500, spec.mark.size * scale) };
        sized.set(key, mark = motif(mspec, palette));
        if (sized.size > 16) sized.delete(sized.keys().next().value!);
      }
      mark(surface, tile, run);
      return;
    }
    if (spec.kind === "hatch") {
      const lines = hatchLines(tile.outline, spec.inset, spec.spacing, spec.angle + spec.classTurn * tile.classIndex);
      if (lines.length === 0 || spec.weight === 0) return;
      surface.noFill(); color(surface, palette, ink, Math.round(255 * spec.opacity), false);
      surface.strokeWeight(spec.weight); surface.strokeCap(surface.ROUND);
      run.enter(lines.length);
      try { for (const line of lines) { run.check(); surface.line(line[0][0], line[0][1], line[1][0], line[1][1]); } }
      finally { run.leave(); }
      return;
    }
    if (spec.kind === "concentric") {
      if (spec.weight === 0) return;
      surface.noFill(); color(surface, palette, ink, Math.round(255 * spec.opacity), false);
      surface.strokeWeight(spec.weight); surface.strokeCap(surface.ROUND);
      run.enter(1);
      try {
        for (let ring = 0; ring < MAX_RINGS; ring++) {
          run.check();
          const inner = insetPolygon(tile.outline, spec.inset + ring * spec.spacing);
          if (!inner) break;
          outlinePath(surface, inner);
        }
      } finally { run.leave(); }
      return;
    }
    const region = insetPolygon(tile.outline, spec.inset);
    if (!region) return;
    surface.noStroke();
    if (spec.kind === "flat") {
      color(surface, palette, ink, Math.round(255 * spec.opacity), true);
      outlinePath(surface, region);
      return;
    }
    // Wash: each layer is the inset outline with its own stable wander and breathing; together they
    // composite to `opacity` in the core and thin toward the wandering fringe.
    const alpha = Math.round(255 * (1 - (1 - spec.opacity) ** (1 / spec.layers)));
    const size = Math.sqrt(tile.area), wander = spec.bleed * size * .5;
    color(surface, palette, ink, alpha, true);
    run.enter(spec.layers);
    try {
      for (let layer = 0; layer < spec.layers; layer++) {
        run.check();
        const breathe = 1 + (unit(tile.seed, `${tile.id}/${layer}`, "wash-size") - .5) * spec.bleed;
        surface.beginShape();
        region.forEach(([x, y], index) => {
          const id = `${tile.id}/${layer}/${index}`;
          surface.vertex(x * breathe + (unit(tile.seed, id, "wash-x") - .5) * 2 * wander,
            y * breathe + (unit(tile.seed, id, "wash-y") - .5) * 2 * wander);
        });
        surface.endShape(surface.CLOSE);
      }
    } finally { run.leave(); }
  };
}

/**
 * Hierarchical tone of a tile as a palette index. The first palette color is reserved for ink (edges, vertex
 * marks) whenever there is more than one, so fills use 1..n−1.
 *   class     the tile's own class
 *   ancestor  piece class of the ancestor `level` generations up (which half-tile kind the supertile is)
 *   slot      the ancestor's child slot in its parent (or its seed piece index at the top generation)
 *   supertile a stable color per ancestor `level` generations up, reshuffled by `seed`
 */
export function tileTone(tile: TilingTile, seed: number, mode: TileColorMode, level: number, paletteLength: number): number {
  const fills = paletteLength > 1 ? paletteLength - 1 : 1, base = paletteLength > 1 ? 1 : 0;
  const generation = Math.max(0, tile.generation - level);
  let index: number;
  if (mode === "class") index = tile.classIndex;
  else if (mode === "ancestor") index = tile.lineage[generation];
  else if (mode === "slot") index = tile.path[generation];
  else index = componentSeed(seed, tileAncestorId(tile, generation), "tone");
  return base + index % fills;
}

const toneCache = new WeakMap<Tiling, Map<string, readonly TilingTile[]>>();
/** Every tile with its hierarchical tone, cached per tiling and color choice (never per drawing). */
export function tonedTiles(tiling: Tiling, seed: number, mode: TileColorMode, level: number, paletteLength: number): readonly TilingTile[] {
  let entries = toneCache.get(tiling);
  if (!entries) toneCache.set(tiling, entries = new Map());
  const key = `${seed}:${mode}:${mode === "class" ? 0 : level}:${paletteLength}`;
  let tiles = entries.get(key);
  if (!tiles) {
    tiles = Object.freeze(tiling.tiles.map((tile) => Object.freeze({ ...tile, tone: tileTone(tile, seed, mode, level, paletteLength) })));
    entries.set(key, tiles);
    if (entries.size > 4) entries.delete(entries.keys().next().value!);
  }
  return tiles;
}

const edgeToneCache = new WeakMap<Tiling, Map<string, readonly Path[]>>();
/**
 * Shared edges toned by hierarchy, or 0 everywhere for `uniform`. The coarsest boundaries take the accent
 * colors in order (level 0, the outer and seed-piece boundaries, gets the first accent, level 1 the second, …);
 * finer edges stay ink (tone 0). Order matches `tiling.edges`.
 */
export function tonedEdges(tiling: Tiling, color: TilingView["edgeColor"], paletteLength: number): readonly Path[] {
  let entries = edgeToneCache.get(tiling);
  if (!entries) edgeToneCache.set(tiling, entries = new Map());
  const key = `${color}:${paletteLength}`;
  let paths = entries.get(key);
  if (!paths) {
    const accents = Math.max(0, paletteLength - 1);
    paths = Object.freeze(tilingEdgePaths(tiling).map((path) => Object.freeze({ ...path,
      tone: color === "uniform" || path.level >= accents ? 0 : path.level + 1 })));
    entries.set(key, paths);
    if (entries.size > 4) entries.delete(entries.keys().next().value!);
  }
  return paths;
}

const vertexCache = new WeakMap<Tiling, Map<string, readonly TilingVertex[]>>();
/** Vertices chosen by `mode`, toned by how many tile corners meet there (valence). `regular` = equal corners closing the turn (Penrose suns, chair four-corner points). */
export function selectedVertices(tiling: Tiling, mode: TilingView["vertices"], paletteLength: number): readonly TilingVertex[] {
  if (mode === "none") return [];
  let entries = vertexCache.get(tiling);
  if (!entries) vertexCache.set(tiling, entries = new Map());
  const key = `${mode}:${paletteLength}`;
  let vertices = entries.get(key);
  if (!vertices) {
    const fills = paletteLength > 1 ? paletteLength - 1 : 1, base = paletteLength > 1 ? 1 : 0;
    vertices = Object.freeze(tiling.vertices
      .filter((v) => mode === "all" || (mode === "interior" ? v.interior : v.regular))
      .map((v) => Object.freeze({ ...v, tone: base + Math.max(0, v.valence - 3) % fills })));
    entries.set(key, vertices);
    if (entries.size > 4) entries.delete(entries.keys().next().value!);
  }
  return vertices;
}

/** The tiles a view draws, in tiling order: chosen classes, minus a stable per-tile omission. */
export function shownTiles(tiles: readonly TilingTile[], view: TilingView): TilingTile[] {
  requireFinite("tile retention", view.retention, 0, 1);
  return tiles.filter((tile) => view.classes.includes(tile.class) && (view.retention >= 1 || unit(tile.seed, tile.id, "shown") < view.retention));
}

/**
 * Consume a tiling: tile interiors, then shared edges, then vertex marks. Omitted classes leave bare paper;
 * `edges: "visible"` outlines only tiles that are drawn. Every consumer is an ordinary callback over the
 * frozen tiling (`atEach` for tiles and vertices, `strokeWith` for edges), so any of them can be substituted.
 */
export function drawTiling(surface: CompositionSurface, recipe: { source: TilingOptions; view: TilingView; palette: readonly number[] },
  run: CompositionRun): void {
  const { source, view, palette } = recipe;
  const tiling = substitutionTiling(source);
  const shown = shownTiles(tiling.tiles, view);
  if (view.fill.kind !== "none" && view.fill.retention > 0) {
    const all = tonedTiles(tiling, source.seed, view.colorBy, view.colorLevel, palette.length);
    const visible = new Set(shown.map((tile) => tile.id));
    atEach(surface, all.filter((tile) => visible.has(tile.id)), tileFill(view.fill, palette), run);
  }
  if (view.edges !== "none" && view.edgeMaterial.retention > 0) {
    const paths = tonedEdges(tiling, view.edgeColor, palette.length);
    let selected: readonly Path[] = paths;
    if (view.edges === "visible") {
      const visible = new Set(shown.map((tile) => tile.id));
      selected = paths.filter((_, index) => {
        const [a, b] = tiling.edges[index].tiles;
        return visible.has(a) || (b !== null && visible.has(b));
      });
    }
    strokeWith(surface, selected, pathMaterial(view.edgeMaterial, palette), run);
  }
  if (view.vertices !== "none" && view.vertexMark.retention > 0 && view.vertexMark.size > 0) {
    const visible = new Set(shown.map((tile) => tile.id));
    const vertices = selectedVertices(tiling, view.vertices, palette.length)
      .filter((vertex) => vertex.tiles.some((id) => visible.has(id)));
    atEach(surface, vertices, motif(view.vertexMark, palette), run);
  }
}

/** Warm every cache a draw will read; false when cancelled. */
export async function prepareTiling(recipe: { source: TilingOptions; view: TilingView; palette: readonly number[] },
  cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const { source, view, palette } = recipe;
  const tiling = substitutionTiling(source);
  if (view.fill.kind !== "none") {
    tileFillValid(view.fill);
    tonedTiles(tiling, source.seed, view.colorBy, view.colorLevel, palette.length);
    if (view.fill.kind === "hatch") {
      const seen = new Set<number>();
      for (const tile of tiling.tiles) if (!seen.has(tile.classIndex)) {
        seen.add(tile.classIndex);
        hatchLines(tile.outline, view.fill.inset, view.fill.spacing, view.fill.angle + view.fill.classTurn * tile.classIndex);
      }
    }
  }
  if (view.edges !== "none") tonedEdges(tiling, view.edgeColor, palette.length);
  if (view.vertices !== "none") selectedVertices(tiling, view.vertices, palette.length);
  await Promise.resolve();
  return !cancelled();
}
