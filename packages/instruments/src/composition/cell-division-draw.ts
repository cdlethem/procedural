import { cellDivisionDefinitions } from "../adapters/cell-division-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { atEach, cachedBy, componentSeed, createCompositionRun, strokeWith } from "./core.js";
import { cellColony, colonyOptionsOf, fieldLayout, prepareCellColony, type Colony, type ColonyCell, type ColonyOptions } from "./cell-division.js";
import { clipPaths, hatchDomain } from "./domains-paths.js";
import { planarRegion } from "./domains.js";
import { edgePaths, type GraphView } from "./graph.js";
import { densityContours, type DensityField } from "./grains.js";
import { motif, pathMaterial } from "./materials.js";
import type { CompositionRun, CompositionSurface, Mark, MotifSpec, Path, PathMaterial, PathMaterialSpec, Point, Site } from "./types.js";
import { voronoiCells2D } from "@procedurals/javascript";

/**
 * Cell Division drawing (brief 20). One colony (`cell-division.ts`) feeds four treatments that read the same
 * frozen value and never write to it:
 *
 *  - cells: a `Site` per live cell (radius, generation, age) drawn by the stock `motif`, at the cell's own size;
 *  - lineage: the division graph as `Path`s (a mother's division point to each daughter) drawn by `pathMaterial`;
 *  - nutrient: isolines of the concentration field through `densityContours`;
 *  - walls: each cell's Voronoi polygon (`voronoiCells2D`) cut at `reach` radii, as outlines and/or hatched by
 *    `hatchDomain` with the hatch angle turning per generation.
 *
 * Colour is a palette index chosen by `colorBy` (generation, age, size, or seed ancestor); age selection keeps
 * the cells (and their lineage edges, walls) whose age lies in a window. None of these enter the colony's
 * construction, so recolouring, selecting and every mark or material choice reuse the identical snapshot, and
 * so does moving the colony on the canvas (a translation of the drawing). Coordinates of every treatment are
 * in the domain's local frame; `drawCellDivision` translates it to `frame`.
 *
 * Age of a cell is `(steps - birth) / steps`: 1 for the seed cells, 0 for a cell born at the last step.
 * Ramps (`age`, `size`) index the palette in order: the first colour is the oldest / smallest.
 */

export type CellShape = "discs" | "outlines" | "nucleated";
export type ColorBy = "generation" | "age" | "size" | "root";

export interface CellDivisionComposition {
  readonly kind: "cell-division";
  readonly seed: number;
  readonly palette: readonly number[];
  readonly colony: ColonyOptions;
  readonly steps: number;
  /** Where the domain's centre lies on the canvas. */
  readonly frame: { readonly centerX: number; readonly centerY: number };
  readonly colorBy: ColorBy;
  /** Age window, fractions of the run: 0 born at the last step, 1 as old as the run. */
  readonly ages: { readonly min: number; readonly max: number };
  /** Null: no cell marks. `fit` is the mark's diameter as a fraction of the cell's. */
  readonly cells: { readonly shape: CellShape; readonly fit: number; readonly weight: number } | null;
  /** `color`: the first palette colour for every link, or each link in its daughter's colour. */
  readonly lineage: { readonly material: PathMaterialSpec; readonly color: "first" | "cell" } | null;
  readonly nutrient: { readonly levels: number; readonly weight: number } | null;
  /** Null: no walls. `outline` is the wall stroke weight (0: none); `hatch` fills each cell. */
  readonly walls: { readonly reach: number; readonly outline: number;
    readonly hatch: { readonly spacing: number; readonly angle: number; readonly twist: number; readonly weight: number } | null } | null;
}

/** Replace any treatment with an ordinary callback; the colony and the geometry stay the producers'. */
export interface CellDivisionConsumers { cell?: Mark; lineage?: PathMaterial; nutrient?: PathMaterial; wall?: PathMaterial; hatch?: PathMaterial }

export interface CellSite extends Site {
  readonly radius: number;
  readonly generation: number;
  readonly birth: number;
  readonly root: string;
}
export interface CellWall {
  readonly id: string;
  readonly cell: string;
  readonly polygon: readonly Point[];
  readonly area: number;
}

export const MAX_WALL_CELLS = 2000;
const WALL_SIDES = 24;

const definition = cellDivisionDefinitions[0];
type Scalar = number | string | boolean;

/** The seed changes the colony only where a stream is drawn (see `colonyUsesSeed`). */
export function cellDivisionUsesSeed(q: Record<string, Scalar>): boolean {
  return q.seedLayout === "scatter" || q.orientation !== "fixed" || Number(q.orientJitter) > 0;
}

const ink = (weight: number, spacing = 4): PathMaterialSpec => ({ kind: "ink", weight, spacing, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
  mark: { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } });

/** Resolve stored scalar controls to the public composition value. */
export function cellDivisionComposition(input: InstrumentInput): CellDivisionComposition {
  if (input.technique !== definition.id) throw new Error(`Not a ${definition.id} input: ${input.technique}`);
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((color) =>
    !Number.isSafeInteger(color) || color < 0 || color > 0xffffff)) throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(definition, input.params) as Record<string, Scalar>;
  const num = (key: string) => q[key] as number;
  const beads = q.lineage === "beads";
  const walls = q.walls as string;
  return {
    kind: "cell-division", seed: input.seed, palette: [...input.palette],
    colony: colonyOptionsOf(q),
    steps: num("steps"),
    frame: { centerX: num("centerX"), centerY: num("centerY") },
    colorBy: q.colorBy as ColorBy,
    ages: { min: num("ageMin"), max: num("ageMax") },
    cells: q.cells === "none" ? null : { shape: q.cells as CellShape, fit: num("cellFit"), weight: num("cellWeight") },
    lineage: q.lineage === "none" ? null : { color: q.lineageColor as "first" | "cell", material: { kind: q.lineage as "ink" | "stitch" | "beads", weight: num("lineageWeight"), spacing: num("lineageSpacing"), phase: 0.5,
      phaseSpread: 0, levelRamp: 0, retention: 1,
      mark: { kind: "dot", size: beads ? num("lineageBead") : 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } } },
    nutrient: q.nutrient === "none" ? null : { levels: num("nutrientLevels"), weight: num("nutrientWeight") },
    walls: walls === "none" ? null : { reach: num("wallReach"), outline: walls === "hatch" ? 0 : num("wallWeight"),
      hatch: walls === "outlines" ? null : { spacing: num("hatchSpacing"), angle: num("hatchAngle"), twist: num("hatchTwist"), weight: num("hatchWeight") } },
  };
}

/* ------------------------------------------------------------------------------- treatments */

const radiusRanges = new WeakMap<Colony, { min: number; max: number }>();
/** Smallest and largest live radius of the colony (equal when every cell is the same size). */
function radiusRange(colony: Colony): { min: number; max: number } {
  let range = radiusRanges.get(colony);
  if (!range) {
    range = { min: Infinity, max: -Infinity };
    for (const cell of colony.cells) { range.min = Math.min(range.min, cell.radius); range.max = Math.max(range.max, cell.radius); }
    radiusRanges.set(colony, range);
  }
  return range;
}

const paletteIndex = (cell: ColonyCell, colony: Colony, by: ColorBy, count: number): number => {
  const ramp = (fraction: number) => Math.min(count - 1, Math.max(0, Math.floor(fraction * count)));
  if (by === "generation") return ramp(cell.generation / Math.max(1, colony.generations));
  if (by === "root") return Number(cell.root.slice(5)) % count;
  if (by === "age") return ramp(1 - ageOf(cell, colony.steps));
  const { min, max } = radiusRange(colony);
  return max > min ? ramp((cell.radius - min) / (max - min)) : 0;
};

const ageOf = (cell: ColonyCell, steps: number): number => steps > 0 ? (steps - cell.birth) / steps : 0;

const selected = new WeakMap<Colony, Map<string, ReadonlySet<string>>>();
/** Ids of the live cells whose age lies in `[min, max]`; the colony's own values are not changed. */
export function agedCells(colony: Colony, min: number, max: number): ReadonlySet<string> {
  return cachedBy(selected, colony, `${min}|${max}`, () => new Set(colony.cells.filter((cell) => {
    const age = ageOf(cell, colony.steps);
    return age >= min && age <= max;
  }).map((cell) => cell.id)));
}

const siteCache = new WeakMap<Colony, Map<string, readonly CellSite[]>>();
/** A site per selected live cell: `scale` 1 and `radius` carried separately so marks keep their line weights. */
export function cellSites(colony: Colony, options: { colorBy: ColorBy; palette: number; min: number; max: number }): readonly CellSite[] {
  return cachedBy(siteCache, colony, `${options.colorBy}|${options.palette}|${options.min}|${options.max}`, () => {
    const keep = agedCells(colony, options.min, options.max);
    return Object.freeze(colony.cells.filter((cell) => keep.has(cell.id)).map((cell): CellSite => Object.freeze({
      id: cell.id, seed: componentSeed(colony.seed, cell.id, "cell"), position: cell.position, angle: 0, scale: 1,
      tone: paletteIndex(cell, colony, options.colorBy, options.palette),
      radius: cell.radius, generation: cell.generation, birth: cell.birth, root: cell.root,
    })));
  });
}

const lineageCache = new WeakMap<Colony, Map<string, readonly Path[]>>();
/** Division links whose daughter is selected: in palette colour 0, or the daughter's colour. */
export function lineagePaths(colony: Colony, options: { colorBy: ColorBy; palette: number; min: number; max: number; color: "first" | "cell" }): readonly Path[] {
  return cachedBy(lineageCache, colony, `${options.colorBy}|${options.palette}|${options.min}|${options.max}|${options.color}`, () => {
    const keep = agedCells(colony, options.min, options.max);
    const tone = new Map<string, number>();
    for (const cell of [...colony.cells, ...colony.ancestors]) tone.set(cell.id, paletteIndex(cell, colony, options.colorBy, options.palette));
    const ageKeep = new Set<string>();
    for (const cell of colony.ancestors) {
      const age = ageOf(cell, colony.steps);
      if (age >= options.min && age <= options.max) ageKeep.add(cell.id);
    }
    const view: GraphView = { graph: colony.lineage, nodes: colony.lineage.nodes,
      edges: colony.lineage.edges.filter((edge) => keep.has(edge.to) || ageKeep.has(edge.to)) };
    return edgePaths(view, (edge) => options.color === "first" ? 0 : tone.get(edge.to) ?? 0);
  });
}

const nutrientCache = new WeakMap<Colony, Map<string, readonly Path[]>>();

/** The concentration with the cells outside the boundary filled from their open neighbours, so contours run through the wall instead of tracing its stair steps. */
function extended(colony: Colony): DensityField {
  const { columns, rows, open } = fieldLayout(colony.options);
  let values = colony.field.values.slice(), known = Uint8Array.from(open);
  for (let pass = 0; pass < 3; pass++) {
    const next = values.slice(), nextKnown = known.slice();
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const k = j * columns + i;
      if (known[k]) continue;
      let sum = 0, count = 0;
      for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const a = i + di, b = j + dj;
        if (a >= 0 && a < columns && b >= 0 && b < rows && known[b * columns + a]) { sum += values[b * columns + a]; count++; }
      }
      if (count > 0) { next[k] = sum / count; nextKnown[k] = 1; }
    }
    values = next; known = nextKnown;
  }
  return { ...colony.field, values };
}

/** The boundary inset by `inset` on every side, as a planar region: the rectangle, or the ellipse as a 160-gon. */
function boundaryRegion(options: ColonyOptions, inset: number) {
  const w = options.width - 2 * inset, h = options.height - 2 * inset;
  if (options.boundary === "box") return planarRegion({ id: "dish", outer: [[inset, inset], [inset + w, inset], [inset + w, inset + h], [inset, inset + h]] });
  return planarRegion({ id: "dish", outer: Array.from({ length: 160 }, (_, k): [number, number] => {
    const t = 2 * Math.PI * k / 160;
    return [options.width / 2 + w / 2 * Math.cos(t), options.height / 2 + h / 2 * Math.sin(t)];
  }) });
}

/**
 * Isolines of the nutrient concentration at `levels` evenly spaced fractions of the supply (`k / (levels + 1)`),
 * through `densityContours`, cut at the dish wall inset by half a field cell (`clipPaths`). Tone 0.
 */
export function nutrientPaths(colony: Colony, levels: number): readonly Path[] {
  return cachedBy(nutrientCache, colony, String(levels), () => {
    const contours = densityContours(extended(colony), Array.from({ length: levels }, (_, k) => (k + 1) / (levels + 1)), colony.seed);
    // Field cells whose centres lie within half a cell of the wall are the wall's own staircase: contours are cut back to the wall inset by half a field cell.
    const region = boundaryRegion(colony.options, colony.options.fieldCell / 2);
    return clipPaths(contours.map((path) => Object.freeze({ ...path, tone: 0 })), region);
  });
}

const wallCache = new WeakMap<Colony, Map<string, readonly CellWall[]>>();
const polygonArea = (polygon: readonly Point[]): number => {
  let sum = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) sum += polygon[j][0] * polygon[i][1] - polygon[i][0] * polygon[j][1];
  return Math.abs(sum) / 2;
};

/** Sutherland-Hodgman against one half-plane `dot(p - c, n) <= limit`; the subject is convex, so the result is too. */
function clipHalfPlane(polygon: readonly Point[], cx: number, cy: number, nx: number, ny: number, limit: number): Point[] {
  const out: Point[] = [];
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i];
    const da = (a[0] - cx) * nx + (a[1] - cy) * ny - limit, db = (b[0] - cx) * nx + (b[1] - cy) * ny - limit;
    if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
    if (db <= 0) out.push(b);
  }
  return out;
}

/**
 * Each live cell's Voronoi polygon over the domain (the nearest-site partition, `voronoiCells2D`), cut to the
 * regular 24-gon whose inradius is `reach` times the cell's radius. With a `reach` beyond the colony's spacing the
 * polygons tile the domain exactly (their areas sum to `width * height`); a smaller one leaves gaps around cells.
 * Cells with no area (a duplicate site) have no wall. Order is the live cells'.
 */
export function cellWalls(colony: Colony, reach: number): readonly CellWall[] {
  if (!(reach > 0 && reach <= 1000)) throw new Error(`Wall reach must be in (0, 1000], got ${reach}`);
  return cachedBy(wallCache, colony, String(reach), () => {
    const { width, height } = colony.options;
    if (colony.cells.length > MAX_WALL_CELLS) throw new Error(`Walls need at most ${MAX_WALL_CELLS} cells; the colony has ${colony.cells.length}. Lower the cell limit`);
    const n = colony.cells.length;
    const { cells } = voronoiCells2D({ sites: colony.cells.map((cell) => [cell.position[0], cell.position[1]]), bounds: [0, 0, width, height], maxWork: 40 * n * n + 1000 }) as { cells: Point[][] };
    const walls: CellWall[] = [];
    colony.cells.forEach((cell, i) => {
      let polygon: Point[] = cells[i];
      if (polygon.length < 3) return;
      for (let k = 0; k < WALL_SIDES && polygon.length >= 3; k++) {
        const t = 2 * Math.PI * k / WALL_SIDES;
        polygon = clipHalfPlane(polygon, cell.position[0], cell.position[1], Math.cos(t), Math.sin(t), reach * cell.radius);
      }
      const area = polygon.length >= 3 ? polygonArea(polygon) : 0;
      if (area > 1e-9) walls.push(Object.freeze({ id: `${cell.id}/wall`, cell: cell.id, polygon: Object.freeze(polygon.map((p) => Object.freeze([p[0], p[1]] as const))), area }));
    });
    return Object.freeze(walls);
  });
}

const wallPathCache = new WeakMap<Colony, Map<string, readonly Path[]>>();
/** Closed wall outlines of the selected cells, coloured like the cell. */
export function wallPaths(colony: Colony, options: { reach: number; colorBy: ColorBy; palette: number; min: number; max: number }): readonly Path[] {
  return cachedBy(wallPathCache, colony, `${options.reach}|${options.colorBy}|${options.palette}|${options.min}|${options.max}`, () => {
    const keep = agedCells(colony, options.min, options.max), byId = new Map(colony.cells.map((cell) => [cell.id, cell] as const));
    return Object.freeze(cellWalls(colony, options.reach).filter((wall) => keep.has(wall.cell)).map((wall): Path => Object.freeze({
      id: wall.id, seed: componentSeed(colony.seed, wall.id, "wall"), points: wall.polygon, closed: true, level: wall.area, levelFraction: 0,
      tone: paletteIndex(byId.get(wall.cell)!, colony, options.colorBy, options.palette) })));
  });
}

const hatchCache = new WeakMap<Colony, Map<string, readonly Path[]>>();
/** Hatch strokes inside the selected cells' walls; the line direction turns by `twist` degrees per generation. */
export function wallHatch(colony: Colony, options: { reach: number; spacing: number; angle: number; twist: number; colorBy: ColorBy; palette: number; min: number; max: number }): readonly Path[] {
  const { reach, spacing, angle, twist } = options;
  return cachedBy(hatchCache, colony, `${reach}|${spacing}|${angle}|${twist}|${options.colorBy}|${options.palette}|${options.min}|${options.max}`, () => {
    const keep = agedCells(colony, options.min, options.max), byId = new Map(colony.cells.map((cell) => [cell.id, cell] as const));
    const paths: Path[] = [];
    for (const wall of cellWalls(colony, reach)) {
      if (!keep.has(wall.cell)) continue;
      const cell = byId.get(wall.cell)!, tone = paletteIndex(cell, colony, options.colorBy, options.palette);
      const region = planarRegion({ id: wall.id, outer: wall.polygon.map((p) => [p[0], p[1]] as [number, number]) });
      for (const stroke of hatchDomain(region, { spacing, angle: angle + twist * cell.generation, id: `${cell.id}/hatch` }))
        paths.push(Object.freeze({ id: stroke.id, seed: componentSeed(colony.seed, stroke.id, "hatch"), points: stroke.points, closed: false, level: cell.generation, levelFraction: 0, tone }));
    }
    return Object.freeze(paths);
  });
}

/* ------------------------------------------------------------------------------- drawing */

/** The stock motif, sized to the cell: `size` is the cell's own diameter times `fit`. */
function cellMark(spec: NonNullable<CellDivisionComposition["cells"]>, palette: readonly number[]): Mark {
  return (surface, site, run) => {
    const cell = site as CellSite;
    const mark: MotifSpec = { kind: spec.shape === "discs" ? "dot" : "rings", size: 2 * cell.radius * spec.fit, petals: 6,
      opening: spec.shape === "nucleated" ? 0.55 : 0, weight: spec.weight, rotation: 0, variation: 0, retention: 1 };
    motif(mark, palette)(surface, site, run);
  };
}

const colonyOf = (recipe: CellDivisionComposition): Colony => cellColony(recipe.colony, recipe.seed, recipe.steps);

/** Every producer a recipe's treatments read, in one place (cached per colony). */
export function cellDivisionProducts(recipe: CellDivisionComposition): { colony: Colony } {
  return { colony: colonyOf(recipe) };
}

function drawTreatments(surface: CompositionSurface, recipe: CellDivisionComposition, colony: Colony, consumers: CellDivisionConsumers, run: CompositionRun): void {
  const { palette, colorBy, ages } = recipe, view = { colorBy, palette: palette.length, min: ages.min, max: ages.max };
  surface.push();
  surface.translate(recipe.frame.centerX - colony.options.width / 2, recipe.frame.centerY - colony.options.height / 2);
  if (recipe.nutrient) strokeWith(surface, nutrientPaths(colony, recipe.nutrient.levels), consumers.nutrient ?? pathMaterial(ink(recipe.nutrient.weight), palette), run);
  if (recipe.walls?.hatch) strokeWith(surface, wallHatch(colony, { ...view, reach: recipe.walls.reach, ...recipe.walls.hatch }), consumers.hatch ?? pathMaterial(ink(recipe.walls.hatch.weight), palette), run);
  if (recipe.walls && recipe.walls.outline > 0) strokeWith(surface, wallPaths(colony, { ...view, reach: recipe.walls.reach }), consumers.wall ?? pathMaterial(ink(recipe.walls.outline), palette), run);
  if (recipe.cells) atEach(surface, cellSites(colony, view), consumers.cell ?? cellMark(recipe.cells, palette), run);
  if (recipe.lineage) strokeWith(surface, lineagePaths(colony, { ...view, color: recipe.lineage.color }), consumers.lineage ?? pathMaterial(recipe.lineage.material, palette), run);
  surface.pop();
}

/** Draw the recipe into a caller-owned surface (transparent: nothing is cleared). */
export function drawCellDivision(surface: CompositionSurface, recipe: CellDivisionComposition, consumers: CellDivisionConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: 600_000 })): void {
  run.check();
  drawTreatments(surface, recipe, colonyOf(recipe), consumers, run);
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Build the colony (cooperatively, in step slices) and then every treatment geometry it needs; false if cancelled. */
export async function prepareCellDivision(recipe: CellDivisionComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  const colony = await prepareCellColony(recipe.colony, recipe.seed, recipe.steps, cancelled);
  if (!colony || cancelled()) return false;
  const { palette, colorBy, ages } = recipe, view = { colorBy, palette: palette.length, min: ages.min, max: ages.max };
  if (recipe.nutrient) { nutrientPaths(colony, recipe.nutrient.levels); await yieldToHost(); if (cancelled()) return false; }
  if (recipe.walls) {
    cellWalls(colony, recipe.walls.reach); await yieldToHost(); if (cancelled()) return false;
    if (recipe.walls.hatch) { wallHatch(colony, { ...view, reach: recipe.walls.reach, ...recipe.walls.hatch }); await yieldToHost(); if (cancelled()) return false; }
  }
  if (recipe.lineage) lineagePaths(colony, { ...view, color: recipe.lineage.color });
  cellSites(colony, view);
  return !cancelled();
}
