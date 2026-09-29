import { atEach, componentSeed, createCompositionRun, inside, strokeWith } from "./core.js";
import { compartmentPlan, compartmentRegions, coverCrop, keptCompartments } from "./compartments.js";
import type { Compartment, CompartmentOptions, CompartmentRegion, KeepRule } from "./compartments.js";
import { motif, pathMaterial } from "./materials.js";
import { bundledRaster } from "./raster-samples.js";
import type { BundledRasterId } from "./raster-samples.js";
import type { Raster } from "./raster.js";
import { srgbToLinear } from "./raster.js";
import type { CompositionRun, CompositionSurface, Path, Site } from "./types.js";

/**
 * Consumers for Adaptive Compartments: replaceable cell fillers over the frozen compartment plan.
 *
 * A filler is `(surface, region, run) => void` (`CompartmentFiller`): `inside` gives it the cell's inset
 * rectangle at local [0, w] x [0, h] and `region.cell` carries the measured attributes. Built-ins, chosen by
 * `CompartmentFillSpec.kind`:
 *   flat    one rectangle of the cell's color;
 *   hatch   parallel lines along the cell's dominant orientation, tighter where the cell is darker;
 *   dots    a halftone lattice turned to the same direction; dot area follows darkness;
 *   motif   one nested `motif` mark (dot, rings, rosette, arrow) fitted to the cell and turned to its direction;
 *   detail  chooses per cell by its SIZE: large quiet cells flat, middle cells hatched, small detailed cells
 *           glyphs. `mixing` makes each threshold wander by a stable per-cell draw, so the classes interleave.
 * Any kind can also get a border drawn by the existing `pathMaterial` (ink, stitches or beads) on cells at
 * least `border.minCell` across. A `body` (0..1 opacity of the flat color under the marks) is shared by all kinds.
 *
 * Color (`color`): `image` uses the cell's mean color; `palette` the nearest palette entry in Oklab; `ink` only
 * the first palette entry, its body opacity following darkness (a monochrome print). Marks over a body use a
 * shade of the body color moved away from it (darker over light, lighter over dark), or the ink itself.
 * Cell coverage (source alpha) scales every opacity, so transparent source areas stay open.
 *
 * Hatching and dots are computed analytically on the axis-aligned inset rectangle (a line/rectangle slab clip): the
 * foundation's exact-rational region hatcher measured 1.6 ms for a 20 x 14 cell, about 5 s for a dense mosaic.
 * Line ends and dot edges stay inside the region (half a stroke weight or the dot radius inset).
 * Orientation is used only where its coherence is at least `MIN_COHERENCE`; less coherent cells use the fixed angle.
 * Everything a filler draws is determined by the plan, the spec and the palette: seeds only enter through `mixing`.
 *
 * Bounds: the estimated drawing units (cells, hatch lines, dots, glyphs, border stations) may not exceed
 * `MAX_COMPARTMENT_UNITS`; the message names the control that most reduces the count.
 */
export type CompartmentFillKind = "detail" | "flat" | "hatch" | "dots" | "motif";
export type CompartmentColor = "image" | "palette" | "ink";
export type CompartmentFiller = (surface: CompositionSurface, region: CompartmentRegion, run: CompositionRun) => void;

export interface CompartmentGlyphSpec {
  kind: "dot" | "rings" | "rosette" | "arrow";
  /** Glyph diameter as a fraction of the cell's shorter side (0..1). */
  fit: number;
  petals: number;
  opening: number;
}
export interface CompartmentBorderSpec {
  kind: "none" | "ink" | "stitch" | "beads";
  weight: number;
  /** Stitch or bead spacing along the border, canvas units. */
  spacing: number;
  /** Cells whose shorter side is below this get no border. */
  minCell: number;
}
export interface CompartmentFillSpec {
  kind: CompartmentFillKind;
  color: CompartmentColor;
  /** Opacity of the flat color body, 0..1. */
  body: number;
  /** Detail policy: cells with a shorter side below this get hatching (canvas units). */
  hatchBelow: number;
  /** Detail policy: cells with a shorter side below this get a glyph (canvas units). */
  glyphBelow: number;
  /** 0..1: each detail threshold wanders by up to +-50% x mixing, by a stable draw per cell id. */
  mixing: number;
  /** Hatch line spacing at mid tone, and halftone dot pitch, canvas units. */
  spacing: number;
  /** Stroke weight of hatch lines and glyphs. */
  weight: number;
  /** Degrees added to the cell's image direction (hatch, dots, glyph); the whole direction where the image gives none. */
  angle: number;
  /** Hatch spacing changes by 2^(+-toneResponse) between the lightest and darkest cell (octaves). */
  toneResponse: number;
  /** Largest dot diameter as a fraction of the dot pitch. */
  dotMax: number;
  glyph: CompartmentGlyphSpec;
  border: CompartmentBorderSpec;
}

/** Cells with a weaker dominant direction than this use the fixed angle alone. */
export const MIN_COHERENCE = 0.25;
/** Estimated drawing units allowed (cells + hatch lines + dots + glyphs + 2 per border station); the default run budget is 100,000. */
export const MAX_COMPARTMENT_UNITS = 80_000;
const MIN_HATCH_SPACING = 1.5;
/** Marks over a light body are its color times this; over a dark body the color moves this far toward white. */
const MARK_SHADE = 0.7, MARK_TINT = 0.28;
const MIN_MARK_SIZE = 0.15;
const kinds: readonly CompartmentFillKind[] = ["detail", "flat", "hatch", "dots", "motif"];
const U32 = 0x1_0000_0000;

function need(name: string, v: number, low: number, high: number): void {
  if (!Number.isFinite(v) || v < low || v > high) throw new Error(`Compartment fill: ${name} must be a number in [${low}, ${high}] (got ${String(v)})`);
}

export function compartmentFillValid(spec: CompartmentFillSpec): void {
  if (!kinds.includes(spec.kind)) throw new Error(`Compartment fill: unknown filler "${String(spec.kind)}"`);
  if (!["image", "palette", "ink"].includes(spec.color)) throw new Error(`Compartment fill: color must be image, palette or ink`);
  need("body", spec.body, 0, 1); need("hatchBelow", spec.hatchBelow, 0, 2000); need("glyphBelow", spec.glyphBelow, 0, 2000);
  need("mixing", spec.mixing, 0, 1); need("spacing", spec.spacing, MIN_HATCH_SPACING, 200); need("weight", spec.weight, 0, 50);
  need("angle", spec.angle, -3600, 3600); need("toneResponse", spec.toneResponse, 0, 4); need("dotMax", spec.dotMax, 0, 1.5);
  need("glyph fit", spec.glyph.fit, 0, 1); need("glyph petals", spec.glyph.petals, spec.glyph.kind === "arrow" ? 0 : 1, 48); need("glyph opening", spec.glyph.opening, 0, 1);
  if (!["dot", "rings", "rosette", "arrow"].includes(spec.glyph.kind)) throw new Error("Compartment fill: glyph must be dot, rings, rosette or arrow");
  if (!["none", "ink", "stitch", "beads"].includes(spec.border.kind)) throw new Error("Compartment fill: border must be none, ink, stitch or beads");
  need("border weight", spec.border.weight, 0, 50); need("border spacing", spec.border.spacing, 0.5, 1000); need("border minCell", spec.border.minCell, 0, 2000);
}

/** The concrete filler a cell receives: `detail` resolves by size; every other kind is itself. */
export function compartmentFillKind(spec: CompartmentFillSpec, cell: Compartment): Exclude<CompartmentFillKind, "detail"> {
  if (spec.kind !== "detail") return spec.kind;
  const wander = 1 + spec.mixing * (componentSeed(cell.seed, cell.id, "mix") / U32 - 0.5);
  const size = Math.min(cell.width, cell.height);
  return size >= spec.hatchBelow * wander ? "flat" : size >= spec.glyphBelow * wander ? "hatch" : "motif";
}

/** Direction of hatching, dots and glyphs for a cell, in radians (canvas frame, y down). */
export function compartmentAngle(spec: CompartmentFillSpec, cell: Compartment): number {
  const o = cell.orientation;
  return (o.defined && o.coherence >= MIN_COHERENCE ? o.direction : 0) + (spec.angle * Math.PI) / 180;
}

// --- color ---------------------------------------------------------------------------------------------------

type Rgb = readonly [number, number, number];

function oklab([r, g, b]: Rgb): [number, number, number] {
  const lr = srgbToLinear(r / 255), lg = srgbToLinear(g / 255), lb = srgbToLinear(b / 255);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const unpack = (packed: number): Rgb => [(packed >>> 16) & 255, (packed >>> 8) & 255, packed & 255];
const pack = ([r, g, b]: Rgb): number => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);

/** Index of the palette entry nearest `rgb` (0..255) in Oklab; ties keep the earlier entry. */
export function nearestPaletteIndex(palette: readonly number[], rgb: Rgb): number {
  const target = oklab(rgb);
  let best = 0, bestDistance = Infinity;
  palette.forEach((packed, index) => {
    const lab = oklab(unpack(packed >>> 0));
    const distance = (lab[0] - target[0]) ** 2 + (lab[1] - target[1]) ** 2 + (lab[2] - target[2]) ** 2;
    if (distance < bestDistance) { best = index; bestDistance = distance; }
  });
  return best;
}

export interface CompartmentInk {
  /** Body color, 0..255. */
  body: Rgb;
  /** Body opacity in [0, 1] after coverage (and darkness for `ink`). */
  bodyOpacity: number;
  /** Mark and border color, 0..255. */
  mark: Rgb;
  /** Mark opacity in [0, 1] after coverage. */
  markOpacity: number;
}

/** The colors for one cell under a spec; a pure function of the cell, spec and palette. */
export function compartmentInk(spec: CompartmentFillSpec, palette: readonly number[], cell: Compartment): CompartmentInk {
  if (palette.length === 0) throw new Error("Compartment fill: the palette needs at least one color");
  if (spec.color === "ink") {
    const ink = unpack(palette[0] >>> 0);
    return { body: ink, bodyOpacity: spec.body * (1 - cell.tone) * cell.coverage, mark: ink, markOpacity: cell.coverage };
  }
  const body: Rgb = spec.color === "image" ? [cell.color[0] * 255, cell.color[1] * 255, cell.color[2] * 255] : unpack(palette[nearestPaletteIndex(palette, [cell.color[0] * 255, cell.color[1] * 255, cell.color[2] * 255])] >>> 0);
  const luma = (0.2126 * body[0] + 0.7152 * body[1] + 0.0722 * body[2]) / 255;
  const mark: Rgb = luma > 0.45 ? [body[0] * MARK_SHADE, body[1] * MARK_SHADE, body[2] * MARK_SHADE] : [body[0] + (255 - body[0]) * MARK_TINT, body[1] + (255 - body[1]) * MARK_TINT, body[2] + (255 - body[2]) * MARK_TINT];
  return { body, bodyOpacity: spec.body * cell.coverage, mark, markOpacity: cell.coverage };
}

// --- analytic geometry ---------------------------------------------------------------------------------------

/**
 * Segments of parallel lines clipped to the rectangle [x0, x1] x [y0, y1]. Lines have normal offsets
 * spacing/2 + k spacing from the rectangle's centre (a symmetric stripe population), direction `theta`
 * (radians). Each entry is [x1, y1, x2, y2] with the first end at the smaller travel parameter.
 */
export function hatchSegments(x0: number, y0: number, x1: number, y1: number, theta: number, spacing: number): number[][] {
  if (!(x1 > x0) || !(y1 > y0) || !(spacing > 0)) return [];
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, dx = Math.cos(theta), dy = Math.sin(theta), nx = -dy, ny = dx;
  const reach = ((x1 - x0) * Math.abs(nx) + (y1 - y0) * Math.abs(ny)) / 2;
  const out: number[][] = [];
  for (let k = Math.ceil((-reach - spacing / 2) / spacing); k <= Math.floor((reach - spacing / 2) / spacing); k++) {
    const n = spacing / 2 + k * spacing, px = cx + nx * n, py = cy + ny * n;
    let lo = -Infinity, hi = Infinity;
    for (const [p, d, a, b] of [[px, dx, x0, x1], [py, dy, y0, y1]] as const) {
      if (Math.abs(d) < 1e-12) { if (p < a || p > b) { lo = Infinity; break; } continue; }
      const t1 = (a - p) / d, t2 = (b - p) / d;
      lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
    }
    if (hi - lo > 1e-9) out.push([px + dx * lo, py + dy * lo, px + dx * hi, py + dy * hi]);
  }
  return out;
}

/**
 * Centres of a square lattice of the given pitch, turned by `theta` about the rectangle's centre and offset by half
 * a pitch (so the pattern is symmetric), whose disc of radius `radius` lies inside [x0, x1] x [y0, y1].
 */
export function halftoneCentres(x0: number, y0: number, x1: number, y1: number, theta: number, pitch: number, radius: number): [number, number][] {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, dx = Math.cos(theta), dy = Math.sin(theta);
  const m = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2 / pitch) + 1, out: [number, number][] = [];
  for (let j = -m; j <= m; j++) for (let i = -m; i <= m; i++) {
    const u = (i + 0.5) * pitch, v = (j + 0.5) * pitch, x = cx + u * dx - v * dy, y = cy + u * dy + v * dx;
    if (x - radius >= x0 - 1e-9 && x + radius <= x1 + 1e-9 && y - radius >= y0 - 1e-9 && y + radius <= y1 + 1e-9) out.push([x, y]);
  }
  return out;
}

/** Hatch spacing for a cell of tone `tone`: `spacing` at mid tone, 2^-toneResponse times that at black, 2^+toneResponse at white. */
export function hatchSpacing(spec: CompartmentFillSpec, cell: Compartment): number {
  return Math.max(MIN_HATCH_SPACING, spec.spacing * 2 ** (spec.toneResponse * (2 * cell.tone - 1)));
}
/** Halftone dot radius: area coverage equals darkness, capped by `dotMax` of the pitch. */
export function halftoneRadius(spec: CompartmentFillSpec, cell: Compartment): number {
  return Math.min((spec.dotMax * spec.spacing) / 2, spec.spacing * Math.sqrt((1 - cell.tone) / Math.PI));
}
const glyphDiameter = (spec: CompartmentFillSpec, width: number, height: number): number => spec.glyph.fit * Math.min(width, height) - (spec.glyph.kind === "dot" ? 0 : spec.weight);

// --- filler --------------------------------------------------------------------------------------------------

/** The filler for a spec: a callback over one inset compartment region. Colors are resolved per cell. */
export function compartmentFiller(spec: CompartmentFillSpec, palette: readonly number[]): CompartmentFiller {
  compartmentFillValid(spec);
  if (palette.length === 0) throw new Error("Compartment fill: the palette needs at least one color");
  return (surface, region, run) => {
    const { cell } = region, w = region.bounds[2] - region.bounds[0], h = region.bounds[3] - region.bounds[1];
    const ink = compartmentInk(spec, palette, cell), kind = compartmentFillKind(spec, cell);
    if (ink.bodyOpacity > 0) {
      surface.noStroke(); surface.fill(ink.body[0], ink.body[1], ink.body[2], Math.round(255 * ink.bodyOpacity));
      surface.rect(0, 0, w, h);
    }
    const theta = compartmentAngle(spec, cell), alpha = Math.round(255 * ink.markOpacity);
    if (kind === "hatch" && spec.weight > 0 && alpha > 0) {
      const pad = spec.weight / 2, lines = hatchSegments(pad, pad, w - pad, h - pad, theta, hatchSpacing(spec, cell));
      if (lines.length > 0) {
        surface.noFill(); surface.stroke(ink.mark[0], ink.mark[1], ink.mark[2], alpha); surface.strokeWeight(spec.weight); surface.strokeCap(surface.ROUND);
        run.enter(lines.length);
        try { for (const [ax, ay, bx, by] of lines) { run.check(); surface.line(ax, ay, bx, by); } } finally { run.leave(); }
      }
    } else if (kind === "dots" && alpha > 0) {
      const radius = halftoneRadius(spec, cell);
      if (radius >= MIN_MARK_SIZE) {
        const centres = halftoneCentres(0, 0, w, h, theta, spec.spacing, radius);
        if (centres.length > 0) {
          surface.noStroke(); surface.fill(ink.mark[0], ink.mark[1], ink.mark[2], alpha);
          run.enter(centres.length);
          try { for (const [x, y] of centres) { run.check(); surface.circle(x, y, radius * 2); } } finally { run.leave(); }
        }
      }
    } else if (kind === "motif" && alpha > 0) {
      const size = glyphDiameter(spec, w, h);
      if (size >= MIN_MARK_SIZE) {
        const glyph = motif({ kind: spec.glyph.kind, size, petals: spec.glyph.petals, opening: spec.glyph.opening, weight: spec.weight, rotation: 0, variation: 0, retention: 1 }, [pack(ink.mark)]);
        const site: Site = { id: `${cell.id}/glyph`, seed: cell.seed, position: [w / 2, h / 2], angle: theta, scale: 1, tone: 0 };
        atEach(surface, [site], glyph, run);
      }
    }
    const b = spec.border;
    if (b.kind !== "none" && b.weight > 0 && alpha > 0 && Math.min(cell.width, cell.height) >= b.minCell) {
      const i = b.weight / 2;
      if (w - 2 * i > 0 && h - 2 * i > 0) {
        const path: Path = { id: `${cell.id}/border`, seed: cell.seed, points: [[i, i], [w - i, i], [w - i, h - i], [i, h - i]], closed: true, level: 0, levelFraction: 0, tone: 0 };
        const material = pathMaterial({ kind: b.kind, weight: b.weight, spacing: b.spacing, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
          mark: { kind: "dot", size: Math.min(b.spacing * 0.6, b.weight * 3), petals: 1, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } }, [pack(ink.mark)]);
        strokeWith(surface, [path], material, run);
      }
    }
  };
}

// --- bounds --------------------------------------------------------------------------------------------------

/**
 * Estimated drawing units for these regions under `spec`; throws when over `MAX_COMPARTMENT_UNITS` naming the control to change.
 * Hatch: lines across the cell; dots: area / pitch^2 plus its perimeter share; glyph: 1; border: 2 per station.
 */
export function boundCompartmentWork(regions: readonly CompartmentRegion[], spec: CompartmentFillSpec): number {
  compartmentFillValid(spec);
  let units = regions.length, hatch = 0, dots = 0, border = 0;
  for (const { cell, bounds } of regions) {
    const w = bounds[2] - bounds[0], h = bounds[3] - bounds[1], kind = compartmentFillKind(spec, cell);
    if (kind === "hatch") hatch += (w + h) / hatchSpacing(spec, cell) + 1;
    else if (kind === "dots") dots += (w * h) / spec.spacing ** 2 + (w + h) / spec.spacing + 1;
    else if (kind === "motif") units += 1;
    if (spec.border.kind !== "none" && Math.min(cell.width, cell.height) >= spec.border.minCell) border += 2 * (2 * (w + h)) / spec.border.spacing + 8;
  }
  units += hatch + dots + border;
  if (units > MAX_COMPARTMENT_UNITS) {
    const biggest = Math.max(hatch, dots, border);
    const control = biggest === border && border > 0 ? "borderSpacing (or raise borderMin)" : biggest === dots ? "spacing" : biggest === hatch ? "spacing (or lower hatchBelow)" : "threshold or minCell";
    throw new Error(`Compartments would draw about ${Math.round(units)} marks; the limit is ${MAX_COMPARTMENT_UNITS}: raise ${control}`);
  }
  return units;
}

// --- descriptor ----------------------------------------------------------------------------------------------

/** The source image: a bundled sample by id (persistable), or an already resolved raster (direct API; a host binds user images later). */
export type CompartmentImage =
  | { kind: "bundled"; id: BundledRasterId; variant: number; resolution: number }
  | { kind: "raster"; raster: Raster };

/** Named descriptor: JSON-compatible except a `raster` image, which is a resolved value and never a URL. */
export interface CompartmentsComposition {
  palette: readonly number[];
  image: CompartmentImage;
  /** Crop `zoom` times closer than the largest crop matching the area's aspect, slid by `focusX`/`focusY` in [0, 1]. */
  view: { zoom: number; focusX: number; focusY: number };
  /** Construction: everything the partition and its attributes depend on (no source, no crop). */
  plan: Omit<CompartmentOptions, "source" | "crop">;
  /** Which cells are drawn and how far apart. */
  select: { retained: number; by: KeepRule; gutter: number };
  fill: CompartmentFillSpec;
}

export function compartmentSource(image: CompartmentImage): Raster {
  return image.kind === "bundled" ? bundledRaster(image.id, image.variant, image.resolution) : image.raster;
}

/** Plan options for a descriptor: the source resolved and the crop fitted to the area. */
export function compartmentOptions(recipe: CompartmentsComposition): CompartmentOptions {
  const source = compartmentSource(recipe.image);
  return { ...recipe.plan, source, crop: coverCrop(source, recipe.plan.width / recipe.plan.height, recipe.view.zoom, recipe.view.focusX, recipe.view.focusY) };
}

/** The regions a descriptor draws: kept cells, inset by half the gutter. */
export function compartmentDrawRegions(recipe: CompartmentsComposition): readonly CompartmentRegion[] {
  const plan = compartmentPlan(compartmentOptions(recipe));
  return compartmentRegions(keptCompartments(plan, recipe.select.retained, recipe.select.by), recipe.select.gutter);
}

/** Draw a descriptor into a host surface; no clearing, transparent layer. */
export function drawCompartments(surface: CompositionSurface, recipe: CompartmentsComposition, run: CompositionRun = createCompositionRun()): void {
  run.check();
  const filler = compartmentFiller(recipe.fill, recipe.palette);
  const regions = compartmentDrawRegions(recipe);
  boundCompartmentWork(regions, recipe.fill);
  inside(surface, regions, filler, run);
}

/** Build the plan and check the work bound, yielding once; false when cancelled. */
export async function prepareCompartments(recipe: CompartmentsComposition, cancelled: () => boolean): Promise<boolean> {
  if (cancelled()) return false;
  compartmentFiller(recipe.fill, recipe.palette);
  const plan = compartmentPlan(compartmentOptions(recipe));
  if (cancelled()) return false;
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  if (cancelled()) return false;
  boundCompartmentWork(compartmentRegions(keptCompartments(plan, recipe.select.retained, recipe.select.by), recipe.select.gutter), recipe.fill);
  return !cancelled();
}
