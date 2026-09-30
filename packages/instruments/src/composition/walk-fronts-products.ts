/**
 * Consumers of a `FrontsField` (walk-fronts.ts): each turns the same visited region into geometry for a
 * different treatment. None of them changes the walk, and none reads a palette or a material; the results
 * are frozen and cached per field and per geometry key.
 *
 *   territory domains   exact polygons (holes kept) per colour                (maskDomain)
 *   band domains        exact polygons per (colour, age band)                 (labelDomains)
 *   cell runs           row-run rectangles per colour or (colour, band)
 *   contours            nested age isochrones as closed paths                 (maskDomain, domainRings)
 *   outlines            each colour's territory boundary as closed paths
 *   hatching            scan lines inside each colour's territory             (hatchDomain)
 *   sites               marks at claimed cells, young and old carrying their age
 *
 * `FrontsFrame` places the lattice on the canvas: cell edge `cell` in canvas units, centred on
 * `(centerX, centerY)`. Age bands are `every` steps wide: band `b` holds cells claimed at steps
 * `[b·every, (b+1)·every)` and so never depends on how many steps the walk ran.
 */
import { cachedBy, componentSeed } from "./core.js";
import type { PlanarDomain } from "./domains.js";
import { domainRings } from "./domains.js";
import { hatchDomain } from "./domains-paths.js";
import { labelDomains, maskDomain } from "./domains-raster.js";
import type { FrontsField } from "./walk-fronts.js";
import type { Path, Site } from "./types.js";

export interface FrontsFrame { readonly centerX: number; readonly centerY: number; readonly cell: number }

export const FRONT_PRODUCT_LIMITS = Object.freeze({ maxBands: 64, maxHatchStrokes: 60_000, maxSites: 40_000, maxRuns: 400_000 });

const origin = (field: FrontsField, frame: FrontsFrame): [number, number] =>
  [frame.centerX - field.columns * frame.cell / 2, frame.centerY - field.rows * frame.cell / 2];

const caches = new WeakMap<object, Map<string, unknown>>();
const memo = <T>(field: FrontsField, key: string, make: () => T): T => cachedBy(caches, field, key, make as () => unknown) as T;

/** Number of bands of width `every` needed to cover every claimed cell (at least 1). */
export function bandCount(field: FrontsField, every: number): number {
  if (!Number.isInteger(every) || every < 1) throw new Error(`Age interval must be a whole number of steps, at least 1 (got ${String(every)})`);
  let last = 0;
  for (let i = 0; i < field.owner.length; i++) if (field.owner[i] !== 0 && field.age[i] > last) last = field.age[i];
  const bands = Math.floor(last / every) + 1;
  if (bands > FRONT_PRODUCT_LIMITS.maxBands)
    throw new Error(`Age interval ${every} makes ${bands} bands, above the limit ${FRONT_PRODUCT_LIMITS.maxBands}; raise Age interval`);
  return bands;
}

export interface Territory { readonly color: number; readonly domain: PlanarDomain }

/** One exact domain per colour that owns at least one cell, ascending colour. */
export function territoryDomains(field: FrontsField, frame: FrontsFrame): readonly Territory[] {
  return memo(field, `territory|${frame.centerX}|${frame.centerY}|${frame.cell}`, () => {
    const at = origin(field, frame), out: Territory[] = [];
    for (let color = 0; color < field.colors; color++) {
      const mask = new Uint8Array(field.owner.length);
      let any = false;
      for (let i = 0; i < mask.length; i++) if (field.owner[i] === color + 1) { mask[i] = 1; any = true; }
      if (!any) continue;
      out.push(Object.freeze({ color, domain: maskDomain({ width: field.columns, height: field.rows, data: mask }, { cell: frame.cell, origin: at, id: `front:c${color}` }) }));
    }
    return Object.freeze(out);
  });
}

export interface BandDomain { readonly color: number; readonly band: number; readonly domain: PlanarDomain }

/** One exact domain per (colour, age band) that owns a cell, ordered by band then colour. */
export function bandDomains(field: FrontsField, frame: FrontsFrame, every: number): readonly BandDomain[] {
  return memo(field, `bands|${frame.centerX}|${frame.centerY}|${frame.cell}|${every}`, () => {
    bandCount(field, every);
    const labels = new Int32Array(field.owner.length);
    for (let i = 0; i < labels.length; i++) if (field.owner[i] !== 0) labels[i] = Math.floor(field.age[i] / every) * field.colors + field.owner[i];
    const domains = labelDomains({ width: field.columns, height: field.rows, data: labels }, { cell: frame.cell, origin: origin(field, frame), background: 0 });
    const out = domains.map(({ label, domain }): BandDomain => {
      const color = (label - 1) % field.colors, band = Math.floor((label - 1) / field.colors);
      return Object.freeze({ color, band, domain });
    });
    out.sort((a, b) => a.band - b.band || a.color - b.color);
    return Object.freeze(out);
  });
}

/** Row runs in grid cells: `x, y, length, colour` (and `band`), frozen typed data laid out as quads or quintuples. */
export interface CellRuns { readonly stride: 4 | 5; readonly count: number; readonly data: Readonly<Int32Array> }

/** Maximal horizontal runs of one colour (and one band when `every` is given), in raster order. */
export function cellRuns(field: FrontsField, every: number | null): CellRuns {
  return memo(field, `runs|${every ?? 0}`, () => {
    if (every !== null) bandCount(field, every);
    const stride = every === null ? 4 : 5, out: number[] = [];
    const key = (i: number) => field.owner[i] === 0 ? 0 : field.owner[i] + (every === null ? 0 : (Math.floor(field.age[i] / every) + 1) * 16);
    for (let y = 0; y < field.rows; y++) {
      let x = 0;
      while (x < field.columns) {
        const k = key(y * field.columns + x);
        if (k === 0) { x++; continue; }
        let end = x + 1;
        while (end < field.columns && key(y * field.columns + end) === k) end++;
        const i = y * field.columns + x;
        out.push(x, y, end - x, field.owner[i] - 1);
        if (every !== null) out.push(Math.floor(field.age[i] / every));
        x = end;
        if (out.length / stride > FRONT_PRODUCT_LIMITS.maxRuns) throw new Error(`The claimed region needs more than ${FRONT_PRODUCT_LIMITS.maxRuns} runs; raise Cell size or lower Columns and Rows`);
      }
    }
    return Object.freeze({ stride: stride as 4 | 5, count: out.length / stride, data: Int32Array.from(out) });
  });
}

const ringPaths = (domain: PlanarDomain, id: string, seed: number, tone: number, level: number, levelFraction: number): Path[] =>
  domainRings(domain).map((ring, k) => {
    const pathId = `${id}/r${k}`;
    return Object.freeze({ id: pathId, seed: componentSeed(seed, pathId, "front"), points: ring, closed: true, level, levelFraction, tone });
  });

/**
 * Age isochrones: contour `k` (1…bands) is the boundary of every cell claimed before step `k·every`, so the
 * last one outlines the whole visited region. Rings are closed paths with `level = k` and `levelFraction = k / bands`.
 * `tone` is the palette index every path carries (materials use it instead of a random hue); null gives contour `k` the
 * colour `(k - 1) mod colors`, so colour steps with age.
 */
export function frontContours(field: FrontsField, frame: FrontsFrame, every: number, seed: number, tone: number | null): readonly Path[] {
  return memo(field, `contours|${frame.centerX}|${frame.centerY}|${frame.cell}|${every}|${seed}|${tone}`, () => {
    const bands = bandCount(field, every), at = origin(field, frame), out: Path[] = [];
    for (let k = 1; k <= bands; k++) {
      const mask = new Uint8Array(field.owner.length);
      for (let i = 0; i < mask.length; i++) if (field.owner[i] !== 0 && Math.floor(field.age[i] / every) < k) mask[i] = 1;
      const domain = maskDomain({ width: field.columns, height: field.rows, data: mask }, { cell: frame.cell, origin: at, id: `front:t${k}` });
      out.push(...ringPaths(domain, `front:t${k}`, seed, tone ?? (k - 1) % field.colors, k, k / bands));
    }
    return Object.freeze(out);
  });
}

/** Each colour's territory boundary, outer rings and holes, as closed paths carrying `tone` (null: the territory's own colour). */
export function territoryOutlines(field: FrontsField, frame: FrontsFrame, seed: number, tone: number | null): readonly Path[] {
  return memo(field, `outlines|${frame.centerX}|${frame.centerY}|${frame.cell}|${seed}|${tone}`, () =>
    Object.freeze(territoryDomains(field, frame).flatMap(({ color, domain }) => ringPaths(domain, `front:c${color}`, seed, tone ?? color, color, field.colors > 1 ? color / (field.colors - 1) : 0))));
}

export interface HatchOptions { readonly spacing: number; readonly angle: number; readonly turn: number }

/** Scan lines inside every colour's territory; line angle is `angle + colour × turn` degrees. Open two-point paths carrying `tone` (null: the territory's colour). */
export function territoryHatching(field: FrontsField, frame: FrontsFrame, options: HatchOptions, seed: number, tone: number | null): readonly Path[] {
  return memo(field, `hatch|${frame.centerX}|${frame.centerY}|${frame.cell}|${options.spacing}|${options.angle}|${options.turn}|${seed}|${tone}`, () => {
    if (!(options.spacing > 0)) throw new Error("Hatch spacing must be greater than 0");
    const out: Path[] = [];
    for (const { color, domain } of territoryDomains(field, frame)) {
      const [left, top, right, bottom] = domain.bounds!;
      if (Math.hypot(right - left, bottom - top) / options.spacing > FRONT_PRODUCT_LIMITS.maxHatchStrokes)
        throw new Error(`Hatching needs more than ${FRONT_PRODUCT_LIMITS.maxHatchStrokes} strokes; raise Hatch spacing`);
      for (const stroke of hatchDomain(domain, { spacing: options.spacing, angle: options.angle + color * options.turn, origin: [0, 0] })) {
        if (out.length >= FRONT_PRODUCT_LIMITS.maxHatchStrokes)
          throw new Error(`Hatching needs more than ${FRONT_PRODUCT_LIMITS.maxHatchStrokes} strokes; raise Hatch spacing`);
        out.push(Object.freeze({ id: `hatch:c${color}/${stroke.id}`, seed: componentSeed(seed, stroke.id, "hatch"), points: stroke.points, closed: false, level: color, levelFraction: 0, tone: tone ?? color }));
      }
    }
    return Object.freeze(out);
  });
}

export interface SiteOptions { readonly stride: number; readonly aging: number }

/**
 * A mark site at the centre of every claimed cell whose column and row are multiples of `stride`, in raster
 * order, ids `cell:x,y` (stable while the walk is). `tone` is the owning colour; `scale` runs from 1 for the
 * oldest cell to `1 - aging` for the newest, so a young front carries smaller marks.
 */
export function frontSites(field: FrontsField, frame: FrontsFrame, options: SiteOptions, seed: number): readonly Site[] {
  return memo(field, `sites|${frame.centerX}|${frame.centerY}|${frame.cell}|${options.stride}|${options.aging}|${seed}`, () => {
    if (!Number.isInteger(options.stride) || options.stride < 1) throw new Error("Mark spacing must be a whole number of cells, at least 1");
    if (!(options.aging >= 0 && options.aging <= 1)) throw new Error("Mark aging must be from 0 to 1");
    const at = origin(field, frame), out: Site[] = [];
    let last = 1;
    for (let i = 0; i < field.owner.length; i++) if (field.owner[i] !== 0 && field.age[i] > last) last = field.age[i];
    for (let y = 0; y < field.rows; y += options.stride) for (let x = 0; x < field.columns; x += options.stride) {
      const i = y * field.columns + x;
      if (field.owner[i] === 0) continue;
      if (out.length >= FRONT_PRODUCT_LIMITS.maxSites) throw new Error(`Marks need more than ${FRONT_PRODUCT_LIMITS.maxSites} sites; raise Mark spacing`);
      const id = `cell:${x},${y}`;
      out.push(Object.freeze({ id, seed: componentSeed(seed, id, "mark"), position: Object.freeze([at[0] + (x + 0.5) * frame.cell, at[1] + (y + 0.5) * frame.cell] as const),
        angle: 0, scale: 1 - options.aging * (1 - field.age[i] / last), tone: field.owner[i] - 1 }));
    }
    return Object.freeze(out);
  });
}
