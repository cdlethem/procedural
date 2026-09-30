import { valueRegionsDefinition } from "../adapters/value-regions-instrument.js";
import { validateParameterValues } from "../parameter-validation.js";
import type { InstrumentInput } from "../types.js";
import { compartmentInk, nearestPaletteIndex } from "./compartments-draw.js";
import { coverCrop } from "./compartments.js";
import { atEach, componentSeed, createCompositionRun, strokeWith } from "./core.js";
import { PlanarError, emptyDomain, keyholeRing, locateInDomain, planarDomain } from "./domains.js";
import type { PlanarDomain } from "./domains.js";
import { offsetDomain } from "./domains-offset.js";
import { clipPaths, hatchDomain } from "./domains-paths.js";
import type { HatchStroke } from "./domains-paths.js";
import { motif, pathMaterial, regionGeometry } from "./materials.js";
import { bundledRaster, bundledRasterIds } from "./raster-samples.js";
import type { BundledRasterId } from "./raster-samples.js";
import type { Raster } from "./raster.js";
import { paletteRamp } from "./slit.js";
import { fillRings } from "./type-text.js";
import type { CompositionRun, CompositionSurface, Path, PathMaterial, PathMaterialSpec, Point, Region, RegionFillSpec, Site } from "./types.js";
import { keptValueRegions, valueRetainRules, valueRegionMap } from "./value-regions.js";
import type { ValueBandRule, ValueMergePolicy, ValueRetainRule, ValueMeasure, ValueRegionMap, ValueRegionOptions, ValueRegionShape } from "./value-regions.js";

/**
 * Consumers for Value Regions: replaceable region fillers and a boundary outline over the frozen region map.
 *
 * A filler is `(surface, region, run) => void` (`ValueRegionFiller`). It draws in WORLD coordinates (regions are polygons, not
 * rectangles, so there is no local frame): `region.shape` carries every measured attribute and `region.domain` is the polygon
 * to draw in, the region's own domain pulled in by half the gutter (`offsetDomain`, exact, mitre joins) when the gutter is
 * positive. Built-ins, chosen by `ValueRegionFillSpec.kind`:
 *   flat    the polygon (holes respected, one `fillRings` shape per piece) in the region's color; with no gutter and a solid body
 *           a same-color hairline hides the antialiasing seam between neighbours;
 *   hatch   parallel lines by `hatchDomain` (exact, holes respected, lines anchored to the origin so neighbours with the same
 *           spacing and angle continue each other), spacing tighter where the region is darker
 *           (`spacing x 2^(toneResponse x (2 tone - 1))`), direction fixed or along the region's long axis, turned by
 *           `bandTurn` per band and a stable per-region `jitter`; regions darker than `crossBelow` get a second layer;
 *   nested  the existing `regionFill` machinery: `regionGeometry` builds motif sites or contour lines for the region's bounding
 *           box exactly as `regionFill` would, and they are kept only where they lie inside the polygon (sites strictly
 *           inside the polygon pulled in by `inset` and the mark radius; contour lines cut exactly with `clipPaths`), then
 *           drawn with `motif` and `pathMaterial`. `regionFill` builds at most 80 motif sites per box (its own bound).
 *   none    no fill: the outline alone.
 * Color (`color`): `image` uses the region's mean color; `palette` the nearest palette color in Oklab; `ramp` the palette
 * read as a dark-to-light ramp at the region's tone; `ink` only the first palette color, its body opacity following
 * darkness (a monochrome print). Marks over a body use a shade of it moved away from it, or the ink itself
 * (`compartmentInk`, shared with Adaptive Compartments). Region coverage (source alpha) scales every opacity.
 *
 * Outline. Each boundary edge is drawn ONCE: the outline strokes the map's arcs (`RegionMap.arcs`) with `pathMaterial`
 * (ink, stitches or beads), every arc that borders at least one retained region, so a shared edge is never doubled or
 * stitched twice from opposite ends. The outline lies on the true boundary; the gutter pulls only the fills back from it.
 *
 * Bounds: the estimated drawing units (fills, hatch lines, nested marks, two per outline station) may not exceed
 * `MAX_VALUE_REGION_UNITS`; each message names the control that most reduces the count.
 */
export type ValueRegionFillKind = "none" | "flat" | "hatch" | "nested";
export type ValueRegionColor = "image" | "palette" | "ramp" | "ink";
export type ValueNestedKind = "motifs" | "contours" | "mixed";
export type ValueNestedMaterial = "ink" | "stitch" | "beads";

export interface ValueRegionHatchSpec {
  /** Line spacing at mid tone, canvas units. */
  spacing: number;
  weight: number;
  /** Degrees added to the base direction (canvas frame, y down, clockwise on screen). */
  angle: number;
  /** Spacing changes by 2^(+-toneResponse) between white and black (octaves). */
  toneResponse: number;
  /** Regions with a tone below this get a second layer (0 never). */
  crossBelow: number;
  /** Degrees between the two layers. */
  crossAngle: number;
  /** `along` adds the region's long axis (regions that are nearly round, elongation below `MIN_VALUE_REGION_ELONGATION`, keep 0). */
  direction: "fixed" | "along";
  /** Degrees added per band index. */
  bandTurn: number;
  /** Largest stable random turn per region, degrees (+-). */
  jitter: number;
}
export interface ValueRegionNestedSpec {
  kind: ValueNestedKind;
  mark: "dot" | "rings" | "rosette" | "arrow";
  markSize: number;
  /** Poisson separation of motif sites, canvas units. */
  spacing: number;
  /** Contour thresholds of the seeded field fitted to each region's box. */
  levels: number;
  material: ValueNestedMaterial;
  weight: number;
  /** Clearance kept between marks or lines and the polygon edge, canvas units. */
  inset: number;
}
export interface ValueRegionFillSpec {
  kind: ValueRegionFillKind;
  color: ValueRegionColor;
  /** Opacity of the flat color body: the whole fill for `flat`, the underpaint for `hatch` and `nested`. */
  body: number;
  hatch: ValueRegionHatchSpec;
  nested: ValueRegionNestedSpec;
}
export interface ValueRegionOutlineSpec {
  kind: "none" | "ink" | "stitch" | "beads";
  /** `ink` is the first palette color, `accent` the second. */
  color: "ink" | "accent";
  weight: number;
  /** Stitch or bead spacing along the boundary, canvas units. */
  spacing: number;
}
export interface ValueRegionSelect { retained: number; by: ValueRetainRule; gutter: number }

/** A retained region ready to draw: its measured shape and the polygon to paint in. */
export interface DrawnValueRegion { readonly shape: ValueRegionShape; readonly domain: PlanarDomain }
export type ValueRegionFiller = (surface: CompositionSurface, region: DrawnValueRegion, run: CompositionRun) => void;
export interface ValueRegionConsumers { fill?: ValueRegionFiller; outline?: PathMaterial }

/** Regions rounder than this (elongation) keep the fixed hatch direction in `along` mode: their long axis is not defined. */
export const MIN_VALUE_REGION_ELONGATION = 0.2;
export const MAX_VALUE_REGION_UNITS = 80_000;
const MIN_HATCH_SPACING = 1.2;
const SEAM = 0.6;
const CONTOUR_FIELD = { source: "noise", resolution: 36, frequency: 2.4, aspect: 1, hillCount: 3, hillRadius: 0.25, levelBase: -0.7 } as const;
const U32 = 0x1_0000_0000;
const radians = Math.PI / 180;

const pack = ([r, g, b]: readonly [number, number, number]): number => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);

function need(name: string, v: number, low: number, high: number): void {
  if (!Number.isFinite(v) || v < low || v > high) throw new Error(`Value regions fill: ${name} must be a number in [${low}, ${high}] (got ${String(v)})`);
}

export function valueRegionFillValid(spec: ValueRegionFillSpec): void {
  if (!["none", "flat", "hatch", "nested"].includes(spec.kind)) throw new Error(`Value regions fill: unknown filler "${String(spec.kind)}"`);
  if (!["image", "palette", "ramp", "ink"].includes(spec.color)) throw new Error("Value regions fill: color must be image, palette, ramp or ink");
  need("body", spec.body, 0, 1);
  const h = spec.hatch, n = spec.nested;
  need("hatch spacing", h.spacing, MIN_HATCH_SPACING, 200); need("hatch weight", h.weight, 0, 50); need("hatch angle", h.angle, -3600, 3600);
  need("tone response", h.toneResponse, 0, 4); need("cross-hatch tone", h.crossBelow, 0, 1); need("cross angle", h.crossAngle, -180, 180);
  need("band turn", h.bandTurn, -180, 180); need("jitter", h.jitter, 0, 90);
  if (h.direction !== "fixed" && h.direction !== "along") throw new Error("Value regions fill: hatch direction must be fixed or along");
  if (!["motifs", "contours", "mixed"].includes(n.kind)) throw new Error("Value regions fill: nested kind must be motifs, contours or mixed");
  if (!["dot", "rings", "rosette", "arrow"].includes(n.mark)) throw new Error("Value regions fill: mark must be dot, rings, rosette or arrow");
  if (!["ink", "stitch", "beads"].includes(n.material)) throw new Error("Value regions fill: contour material must be ink, stitch or beads");
  need("mark size", n.markSize, 0.5, 200); need("mark spacing", n.spacing, 1, 1000); need("contour levels", n.levels, 1, 24); need("nested weight", n.weight, 0, 50); need("nested inset", n.inset, 0, 200);
}

export function valueRegionOutlineValid(spec: ValueRegionOutlineSpec): void {
  if (!["none", "ink", "stitch", "beads"].includes(spec.kind)) throw new Error("Value regions outline: kind must be none, ink, stitch or beads");
  if (spec.color !== "ink" && spec.color !== "accent") throw new Error("Value regions outline: color must be ink or accent");
  need("outline weight", spec.weight, 0, 50); need("outline spacing", spec.spacing, 0.5, 1000);
}

// --- drawn regions ---------------------------------------------------------------------------------------------

/** Exact offsets of very jagged pieces can land on an arrangement the exact kernel cannot resolve; a distance nudged by a relative 1e-7 (invisible) then does. */
function shrinkPiece(piece: PlanarDomain["regions"][number], inset: number, id: string): readonly PlanarDomain["regions"][number][] {
  for (const nudge of [0, 1e-7, -1e-7, 1e-5, -1e-5]) {
    try { return offsetDomain(piece, -inset * (1 + nudge), { join: "miter", id }).regions; }
    catch (error) { if (!(error instanceof PlanarError) || error.code !== "NOT_CONVERGED") throw error; }
  }
  throw new Error(`Value regions: a region could not be pulled in by ${inset} canvas units (its boundary is too degenerate for exact offsetting): change gutter or nestedInset slightly, or raise simplify`);
}

const INSET_DOMAINS = new WeakMap<PlanarDomain, Map<number, PlanarDomain>>();
/** A region's polygon pulled in by `inset` on every side (exact offset with mitre joins); the polygon itself for 0. Cached per polygon and distance. */
export function insetValueRegion(domain: PlanarDomain, inset: number): PlanarDomain {
  if (inset === 0) return domain;
  let byInset = INSET_DOMAINS.get(domain);
  if (!byInset) { byInset = new Map(); INSET_DOMAINS.set(domain, byInset); }
  let hit = byInset.get(inset);
  if (!hit) {
    // Pieces of one region only touch at points, and shrinking a piece never reaches its neighbours, so each piece is shrunk on its own:
    // the exact offset of many pieces pinched together is needlessly close to degenerate.
    const id = `${domain.id}~${inset}`, pieces = domain.regions.flatMap((piece) => shrinkPiece(piece, inset, id));
    hit = pieces.length === 0 ? emptyDomain(id) : planarDomain(pieces.map((piece, k) => ({ id: `${id}/${k}`, outer: piece.outer as never, holes: piece.holes as never })), { id });
    if (byInset.size >= 8) byInset.delete(byInset.keys().next().value!);
    byInset.set(inset, hit);
  }
  return hit;
}

/** The retained regions with their gutter-inset polygons; regions the gutter erases produce nothing. Ids and seeds are the shapes'. */
export function drawnValueRegions(shapes: readonly ValueRegionShape[], gutter: number): readonly DrawnValueRegion[] {
  need("gutter", gutter, 0, 1000);
  const out: DrawnValueRegion[] = [];
  for (const shape of shapes) {
    const domain = insetValueRegion(shape.domain, gutter / 2);
    if (domain.regions.length > 0) out.push(Object.freeze({ shape, domain }));
  }
  return Object.freeze(out);
}

// --- color -----------------------------------------------------------------------------------------------------

/** Region colors for a spec: `ramp` reads the palette as a ramp at the region's tone, every other kind is `compartmentInk`. */
export function valueRegionInk(spec: Pick<ValueRegionFillSpec, "color" | "body">, palette: readonly number[], shape: ValueRegionShape) {
  if (spec.color === "ramp") {
    const [r, g, b] = paletteRamp(palette, shape.tone);
    return compartmentInk({ color: "image", body: spec.body }, palette, { color: [r / 255, g / 255, b / 255], tone: shape.tone, coverage: shape.coverage });
  }
  return compartmentInk({ color: spec.color, body: spec.body }, palette, shape);
}

// --- hatch geometry --------------------------------------------------------------------------------------------

/** Hatch spacing for a region of tone `tone`: `spacing` at mid tone, 2^-toneResponse times that at black, 2^+toneResponse at white. */
export function valueRegionHatchSpacing(spec: ValueRegionHatchSpec, tone: number): number {
  return Math.max(MIN_HATCH_SPACING, spec.spacing * 2 ** (spec.toneResponse * (2 * tone - 1)));
}

/** Hatch direction of a region in degrees (canvas frame): base angle, plus the long axis in `along` mode, plus band turn and a stable jitter. */
export function valueRegionHatchAngle(spec: ValueRegionHatchSpec, shape: ValueRegionShape): number {
  const axis = spec.direction === "along" && shape.elongation >= MIN_VALUE_REGION_ELONGATION ? (shape.axis * 180) / Math.PI : 0;
  const jitter = spec.jitter * (2 * (componentSeed(shape.seed, shape.id, "hatch-turn") / U32) - 1);
  return spec.angle + axis + spec.bandTurn * shape.band + jitter;
}

const HATCH = new WeakMap<PlanarDomain, Map<string, readonly HatchStroke[]>>();
/** Hatch strokes of a polygon, cached per polygon, spacing and angle (color, weight and opacity never enter). */
export function valueRegionHatch(domain: PlanarDomain, spacing: number, angle: number): readonly HatchStroke[] {
  let byKey = HATCH.get(domain);
  if (!byKey) { byKey = new Map(); HATCH.set(domain, byKey); }
  const key = `${spacing}|${angle}`;
  let hit = byKey.get(key);
  if (!hit) {
    hit = hatchDomain(domain, { spacing, angle, id: domain.id });
    if (byKey.size >= 8) byKey.delete(byKey.keys().next().value!);
    byKey.set(key, hit);
  }
  return hit;
}

/** Number of hatch lines of a layer across a polygon's bounding box (an upper bound of the lines that cross it). */
function hatchLines(domain: PlanarDomain, spacing: number, angle: number): number {
  const b = domain.bounds;
  if (!b) return 0;
  const t = angle * radians;
  return Math.ceil((Math.abs(Math.sin(t)) * (b[2] - b[0]) + Math.abs(Math.cos(t)) * (b[3] - b[1])) / spacing) + 1;
}

// --- nested geometry -------------------------------------------------------------------------------------------

/** The `regionFill` spec for one region: `mixed` is resolved to motifs or contours by the caller. Stitch and bead pitch is five line weights. */
function nestedSpec(spec: ValueRegionNestedSpec, kind: "motifs" | "contours"): RegionFillSpec {
  const pitch = Math.max(0.5, spec.weight * 5), bead = { kind: "dot" as const, size: Math.min(pitch * 0.6, spec.weight * 3), petals: 1, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 };
  return {
    kind, inset: 0, retention: 1, spacing: spec.spacing, angle: 0, weight: spec.weight, underpaint: 0,
    mark: { kind: spec.mark, size: spec.markSize, petals: 6, opening: 0.3, weight: Math.max(0.3, Math.min(spec.weight, 2)), rotation: 0, variation: 0, retention: 1 },
    material: { kind: spec.material, weight: spec.weight, spacing: pitch, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark: bead },
    contour: { ...CONTOUR_FIELD, levelStep: 1.4 / spec.levels, levels: spec.levels },
  };
}

interface Nested { readonly mode: "motifs" | "contours"; readonly sites: readonly Site[]; readonly paths: readonly Path[] }
const NESTED = new WeakMap<ValueRegionShape, Map<string, Nested>>();
/** The nested geometry of a region in world coordinates, kept inside `domain` (exactly), cached per region and construction. */
function nestedGeometry(spec: ValueRegionNestedSpec, region: DrawnValueRegion): Nested {
  let byKey = NESTED.get(region.shape);
  if (!byKey) { byKey = new Map(); NESTED.set(region.shape, byKey); }
  const key = JSON.stringify([spec.kind, spec.mark, spec.markSize, spec.spacing, spec.levels, spec.material, spec.weight, spec.inset, region.domain.id]);
  const hit = byKey.get(key);
  if (hit) return hit;
  const [l, t, r, b] = region.shape.bounds, box: Region = { id: region.shape.id, seed: region.shape.seed, bounds: [l, t, r, b] };
  const kind = spec.kind === "mixed" ? (componentSeed(region.shape.seed, region.shape.id, "nested-choice") % 2 === 0 ? "motifs" : "contours") : spec.kind;
  const geometry = regionGeometry(nestedSpec(spec, kind), box);
  let result: Nested = { mode: kind, sites: [], paths: [] };
  if (geometry && geometry.mode === "motifs") {
    const clearance = spec.inset + spec.markSize / 2 + (spec.mark === "dot" ? 0 : 0.5);
    const room = insetValueRegion(region.domain, clearance);
    const sites: Site[] = [];
    for (const site of geometry.geometry as readonly Site[]) {
      const x = site.position[0] + l, y = site.position[1] + t;
      if (locateInDomain(room, x, y) === "inside") sites.push(Object.freeze({ ...site, position: Object.freeze([x, y] as const) as Point }));
    }
    result = { mode: "motifs", sites: Object.freeze(sites), paths: [] };
  } else if (geometry && geometry.mode === "contours") {
    const world = (geometry.geometry as readonly Path[]).map((path): Path => Object.freeze({ ...path, points: Object.freeze(path.points.map(([x, y]) => Object.freeze([x + l, y + t] as const) as Point)) }));
    const room = insetValueRegion(region.domain, spec.inset);
    result = { mode: "contours", sites: [], paths: room.regions.length > 0 ? clipPaths(world, room) : [] };
  }
  if (byKey.size >= 4) byKey.delete(byKey.keys().next().value!);
  byKey.set(key, result);
  return result;
}

// --- fillers ---------------------------------------------------------------------------------------------------

/** The stock filler for a spec: a callback over one drawn region. Colors are resolved per region. */
export function valueRegionFiller(spec: ValueRegionFillSpec, palette: readonly number[]): ValueRegionFiller {
  valueRegionFillValid(spec);
  if (palette.length === 0) throw new Error("Value regions fill: the palette needs at least one color");
  const motifSpec = nestedSpec(spec.nested, "motifs"), lineSpec = nestedSpec(spec.nested, "contours");
  return (surface, region, run) => {
    if (spec.kind === "none") return;
    const { shape, domain } = region, ink = valueRegionInk(spec, palette, shape), alpha = Math.round(255 * ink.markOpacity);
    const bodyAlpha = Math.round(255 * ink.bodyOpacity);
    const flatBody = (): void => {
      if (bodyAlpha <= 0) return;
      surface.fill(ink.body[0], ink.body[1], ink.body[2], bodyAlpha);
      if (spec.kind === "flat" && bodyAlpha === 255 && domain === shape.domain) { surface.stroke(ink.body[0], ink.body[1], ink.body[2], 255); surface.strokeWeight(SEAM); }
      else surface.noStroke();
      run.enter(domain.regions.length);
      try { run.check(); fillRings(surface, domain.regions.map(keyholeRing)); } finally { run.leave(); }
    };
    if (spec.kind === "flat" || bodyAlpha > 0) flatBody();
    if (spec.kind === "hatch" && spec.hatch.weight > 0 && alpha > 0) {
      const h = spec.hatch, spacing = valueRegionHatchSpacing(h, shape.tone), angle = valueRegionHatchAngle(h, shape);
      const layers = [valueRegionHatch(domain, spacing, angle)];
      if (h.crossBelow > 0 && shape.tone < h.crossBelow) layers.push(valueRegionHatch(domain, spacing, angle + h.crossAngle));
      surface.noFill(); surface.stroke(ink.mark[0], ink.mark[1], ink.mark[2], alpha); surface.strokeWeight(h.weight); surface.strokeCap(surface.ROUND);
      for (const strokes of layers) {
        run.enter(strokes.length);
        try { for (const { points: [a, b] } of strokes) { run.check(); surface.line(a[0], a[1], b[0], b[1]); } } finally { run.leave(); }
      }
    } else if (spec.kind === "nested" && alpha > 0) {
      const geometry = nestedGeometry(spec.nested, region), markColor = [pack(ink.mark)];
      if (geometry.mode === "motifs") atEach(surface, geometry.sites, motif(motifSpec.mark, markColor), run);
      else if (spec.nested.weight > 0) strokeWith(surface, geometry.paths.map((path) => ({ ...path, tone: 0 })), pathMaterial(lineSpec.material, markColor), run);
    }
  };
}

/** The outline as a path material spec. */
function outlineMaterial(spec: ValueRegionOutlineSpec): PathMaterialSpec {
  const bead = { kind: "dot" as const, size: Math.min(spec.spacing * 0.6, spec.weight * 3), petals: 1, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 };
  return { kind: spec.kind === "none" ? "ink" : spec.kind, weight: spec.weight, spacing: spec.spacing, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1, mark: bead };
}

/** Arcs that border a retained region, as paths with stable ids (`arc.id`) and seeds. Every boundary edge appears in exactly one of them. */
export function valueRegionOutline(map: ValueRegionMap, kept: readonly ValueRegionShape[], seed: number): readonly Path[] {
  const keep = new Set(kept.map((region) => region.id));
  return Object.freeze(map.arcs.filter((arc) => keep.has(arc.left) || (arc.right !== null && keep.has(arc.right))).map((arc): Path =>
    Object.freeze({ id: arc.id, seed: componentSeed(seed, arc.id, "arc"), points: arc.points as readonly Point[], closed: arc.closed, level: 0, levelFraction: 0, tone: 0 })));
}

// --- bounds ----------------------------------------------------------------------------------------------------

/**
 * Drawing units for these regions and outline (the units `CompositionRun` counts: every polygon piece, hatch stroke, nested mark,
 * contour path, outline path and station). Throws when over `MAX_VALUE_REGION_UNITS`, naming the control to change. Hatch lines are first
 * bounded by the polygons' boxes, then counted exactly from the cached strokes; nested content is counted from its cached geometry;
 * outline stitches and beads cost their vertices plus two per station.
 */
export function boundValueRegionWork(map: ValueRegionMap, drawn: readonly DrawnValueRegion[], kept: readonly ValueRegionShape[], fill: ValueRegionFillSpec, outline: ValueRegionOutlineSpec): number {
  valueRegionFillValid(fill); valueRegionOutlineValid(outline);
  const fail = (units: number, control: string): never => {
    throw new Error(`Value regions would draw about ${Math.round(units)} marks; the limit is ${MAX_VALUE_REGION_UNITS}: raise ${control}`);
  };
  let units = drawn.length, hatch = 0, nested = 0, border = 0;
  if (fill.kind !== "none") for (const { domain } of drawn) units += domain.regions.length;
  if (fill.kind === "hatch") {
    const h = fill.hatch;
    let lines = 0;
    for (const { shape, domain } of drawn) lines += hatchLines(domain, valueRegionHatchSpacing(h, shape.tone), valueRegionHatchAngle(h, shape)) * (h.crossBelow > 0 && shape.tone < h.crossBelow ? 2 : 1);
    if (lines > MAX_VALUE_REGION_UNITS) fail(lines, "hatchSpacing");
    for (const region of drawn) {
      const { shape, domain } = region, spacing = valueRegionHatchSpacing(h, shape.tone), angle = valueRegionHatchAngle(h, shape);
      hatch += valueRegionHatch(domain, spacing, angle).length + (h.crossBelow > 0 && shape.tone < h.crossBelow ? valueRegionHatch(domain, spacing, angle + h.crossAngle).length : 0);
      if (units + hatch > MAX_VALUE_REGION_UNITS) fail(units + hatch, "hatchSpacing");
    }
  } else if (fill.kind === "nested") {
    const pitch = Math.max(0.5, fill.nested.weight * 5);
    for (const region of drawn) {
      const geometry = nestedGeometry(fill.nested, region);
      if (geometry.mode === "motifs") nested += geometry.sites.length;
      else for (const path of geometry.paths) nested += fill.nested.material === "ink" ? 1 : stationUnits(path.points, path.closed, pitch);
      if (units + nested > MAX_VALUE_REGION_UNITS) fail(units + nested, fill.nested.kind === "contours" ? "contourLevels or minArea" : fill.nested.kind === "motifs" ? "markSpacing or minArea" : "markSpacing, contourLevels or minArea");
    }
  }
  if (outline.kind !== "none") {
    for (const path of valueRegionOutline(map, kept, 0)) border += outline.kind === "ink" ? 1 : stationUnits(path.points, path.closed, outline.spacing);
  }
  units += hatch + nested + border;
  if (units > MAX_VALUE_REGION_UNITS) fail(units, border >= Math.max(hatch, nested) && border > 0 ? "outlineSpacing (or use ink)" : hatch >= nested ? "hatchSpacing" : "markSpacing or contourLevels");
  return units;
}

/** Units a stitch or bead path costs: the path, its vertices and stations for the resampler, and one per station drawn. */
function stationUnits(points: readonly Point[], closed: boolean, pitch: number): number {
  return 2 + points.length + 2 * Math.max(1, Math.ceil(pathLength(points, closed) / pitch));
}

function pathLength(points: readonly Point[], closed: boolean): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  if (closed && points.length > 1) length += Math.hypot(points[0][0] - points[points.length - 1][0], points[0][1] - points[points.length - 1][1]);
  return length;
}

// --- descriptor ------------------------------------------------------------------------------------------------

/** The source image: a bundled sample by id (persistable), or an already resolved raster (direct API; a host binds user images later). */
export type ValueRegionImage =
  | { kind: "bundled"; id: BundledRasterId; variant: number; resolution: number }
  | { kind: "raster"; raster: Raster };

/** Named descriptor: JSON-compatible except a `raster` image, which is a resolved value and never a URL. */
export interface ValueRegionsRecipe {
  kind: "value-regions";
  palette: readonly number[];
  image: ValueRegionImage;
  /** Crop `zoom` times closer than the largest crop matching the area's aspect, slid by `focusX`/`focusY` in [0, 1]. */
  view: { zoom: number; focusX: number; focusY: number };
  /** Construction: everything the regions depend on (no source, no crop). */
  plan: Omit<ValueRegionOptions, "source" | "crop">;
  select: ValueRegionSelect;
  fill: ValueRegionFillSpec;
  outline: ValueRegionOutlineSpec;
}

export function valueRegionSource(image: ValueRegionImage): Raster {
  return image.kind === "bundled" ? bundledRaster(image.id, image.variant, image.resolution) : image.raster;
}

/** Map options for a recipe: the source resolved and the crop fitted to the area. */
export function valueRegionOptions(recipe: ValueRegionsRecipe): ValueRegionOptions {
  const source = valueRegionSource(recipe.image);
  return { ...recipe.plan, source, crop: coverCrop(source, recipe.plan.width / recipe.plan.height, recipe.view.zoom, recipe.view.focusX, recipe.view.focusY) };
}

/** The frozen region map a recipe draws from. */
export function valueRegionsOf(recipe: ValueRegionsRecipe): ValueRegionMap {
  return valueRegionMap(valueRegionOptions(recipe));
}

function checkRecipe(recipe: ValueRegionsRecipe): void {
  valueRegionFillValid(recipe.fill); valueRegionOutlineValid(recipe.outline);
  need("retained", recipe.select.retained, 0, 1); need("gutter", recipe.select.gutter, 0, 1000);
  if (!valueRetainRules.includes(recipe.select.by)) throw new Error(`Value regions: retain rule must be one of ${valueRetainRules.join(", ")}`);
  if (recipe.palette.length === 0) throw new Error("Value regions: the palette needs at least one color");
}

/** Draw a recipe into a host surface; no clearing, transparent layer. Consumers replace the stock fill and outline. */
export function drawValueRegions(surface: CompositionSurface, recipe: ValueRegionsRecipe, consumers: ValueRegionConsumers = {},
  run: CompositionRun = createCompositionRun({ maxWork: MAX_VALUE_REGION_UNITS * 3 })): void {
  run.check();
  checkRecipe(recipe);
  const map = valueRegionsOf(recipe), kept = keptValueRegions(map, recipe.select.retained, recipe.select.by), drawn = drawnValueRegions(kept, recipe.fill.kind === "none" ? 0 : recipe.select.gutter);
  boundValueRegionWork(map, drawn, kept, recipe.fill, recipe.outline);
  const filler = consumers.fill ?? valueRegionFiller(recipe.fill, recipe.palette);
  for (const region of drawn) {
    run.enter(1);
    try { run.check(); surface.push(); filler(surface, region, run); surface.pop(); } finally { run.leave(); }
  }
  if (recipe.outline.kind !== "none" || consumers.outline) {
    const inkIndex = recipe.outline.color === "accent" ? 1 % recipe.palette.length : 0;
    strokeWith(surface, valueRegionOutline(map, kept, recipe.plan.seed), consumers.outline ?? pathMaterial(outlineMaterial(recipe.outline), [recipe.palette[inkIndex]]), run);
  }
}

/** Build the map, the drawn regions and their stock geometry, checking the work bound and yielding once; false when cancelled. */
export async function prepareValueRegions(recipe: ValueRegionsRecipe, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  checkRecipe(recipe);
  const map = valueRegionsOf(recipe);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  if (cancelled()) return false;
  const kept = keptValueRegions(map, recipe.select.retained, recipe.select.by), drawn = drawnValueRegions(kept, recipe.fill.kind === "none" ? 0 : recipe.select.gutter);
  boundValueRegionWork(map, drawn, kept, recipe.fill, recipe.outline);
  for (const region of drawn) {
    if (cancelled()) return false;
    if (recipe.fill.kind === "hatch") {
      const h = recipe.fill.hatch, spacing = valueRegionHatchSpacing(h, region.shape.tone), angle = valueRegionHatchAngle(h, region.shape);
      valueRegionHatch(region.domain, spacing, angle);
      if (h.crossBelow > 0 && region.shape.tone < h.crossBelow) valueRegionHatch(region.domain, spacing, angle + h.crossAngle);
    } else if (recipe.fill.kind === "nested") nestedGeometry(recipe.fill.nested, region);
  }
  return !cancelled();
}

// --- named-instrument binding ----------------------------------------------------------------------------------

type Scalar = number | string | boolean;

/**
 * Resolve the stored scalar controls to the public recipe. The bundled image is named by id, size and variant.
 * Controls that do not apply to the current choices never reach the recipe.
 */
export function valueRegionsComposition(input: InstrumentInput): ValueRegionsRecipe {
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new Error("Composition seed must be a uint32 integer");
  if (!Array.isArray(input.palette) || input.palette.length === 0 || input.palette.some((rgb) => !Number.isSafeInteger(rgb) || rgb < 0 || rgb > 0xffffff))
    throw new Error("Composition needs packed RGB colors");
  const q = validateParameterValues(valueRegionsDefinition, input.params) as Record<string, Scalar>;
  const id = q.image as BundledRasterId;
  if (!(bundledRasterIds as readonly string[]).includes(id)) throw new Error(`Unknown bundled image: ${String(id)}`);
  const mode = q.bandMode as "equal" | "balanced" | "manual";
  const bands: ValueBandRule = mode === "manual" ? { kind: "cuts", cuts: [q.cut1 as number, q.cut2 as number, q.cut3 as number] } : { kind: mode, count: q.bands as number };
  const width = q.width as number, height = q.height as number;
  const fillKind = q.fill as ValueRegionFillKind, outlineKind = q.outline as ValueRegionOutlineSpec["kind"];
  return {
    kind: "value-regions", palette: [...input.palette],
    image: { kind: "bundled", id, variant: q.variant as number, resolution: q.resolution as number },
    view: { zoom: q.zoom as number, focusX: q.focusX as number, focusY: q.focusY as number },
    plan: { seed: input.seed, centerX: q.centerX as number, centerY: q.centerY as number, width, height, measure: q.measure as ValueMeasure,
      smoothing: q.smoothing as number, bands, connectivity: q.corners === true ? 8 : 4, minArea: ((q.minArea as number) / 100) * width * height,
      merge: q.merge as ValueMergePolicy, simplify: q.simplify as number },
    select: { retained: q.retained as number, by: q.keepBy as ValueRetainRule, gutter: q.gutter as number },
    fill: {
      kind: fillKind, color: q.color as ValueRegionColor, body: q.body as number,
      hatch: { spacing: q.hatchSpacing as number, weight: q.hatchWeight as number, angle: q.hatchAngle as number, toneResponse: q.toneResponse as number,
        crossBelow: q.crossBelow as number, crossAngle: q.crossAngle as number, direction: q.hatchDirection as "fixed" | "along", bandTurn: q.bandTurn as number, jitter: q.jitter as number },
      nested: { kind: q.nestedKind as ValueNestedKind, mark: q.mark as "dot" | "rings" | "rosette" | "arrow", markSize: q.markSize as number, spacing: q.markSpacing as number,
        levels: q.contourLevels as number, material: q.contourMaterial as ValueNestedMaterial, weight: q.nestedWeight as number, inset: q.nestedInset as number },
    },
    outline: { kind: outlineKind, color: q.outlineColor as "ink" | "accent", weight: q.outlineWeight as number, spacing: q.outlineSpacing as number },
  };
}

/** Whether the seed can change this construction: only chance retention, per-region hatch turns and nested marks are chance. */
export function valueRegionsUsesSeed(q: InstrumentInput["params"]): boolean {
  if (Number(q.retained) < 1 && q.keepBy === "chance") return true;
  if (q.fill === "hatch") return Number(q.jitter) > 0;
  return q.fill === "nested";
}
