/**
 * The place a random-walk front may occupy: a lattice of `columns × rows` cells, each allowed or not.
 * See `docs/composition-random-walk-fronts.md`.
 *
 * A `WalkGrid` is resolved once from a mask source and is then a frozen value; the walk (`walk-fronts.ts`)
 * reads only which cells are allowed, so a grid's identity is the content of its cells (`id`), not how it
 * was made and not where it is drawn. All shapes are built in **cell space** (x in [0, columns], y in
 * [0, rows], y down), so the mask is the same for every cell size and canvas position.
 *
 * Sources: bundled shapes, bundled text, a tone interval of a bundled raster, or (direct API only) a
 * caller-resolved planar domain in cell space or a raster mask stretched over the grid. The library never
 * fetches or decodes anything; binding a user's own asset is future host work.
 *
 * Domains are rasterised through the planar-domain foundation: `hatchDomain` at one-cell spacing lays a
 * scan line through every row of cell centres, so a cell is allowed exactly when its centre lies in the
 * closed region (holes excluded).
 */
import type { PlanarDomain, PlanarShape, Ring } from "./domains.js";
import { planarDomain, textDomain, unionDomains, domainDifference } from "./domains.js";
import { hatchDomain } from "./domains-paths.js";
import type { MaskRaster } from "./domains-raster.js";
import { bundledRaster, bundledRasterIds, type BundledRasterId } from "./raster-samples.js";
import { sampleGrid, valueField } from "./raster.js";

export type WalkShapeName = "open" | "disc" | "ring" | "islands" | "chambers";
export const walkShapeNames: readonly WalkShapeName[] = Object.freeze(["open", "disc", "ring", "islands", "chambers"] as const);

/** Where the front may go. `shape` and `text` sizes are fractions of the grid's shorter side (text: of the box). */
export type WalkMaskSource =
  | { readonly kind: "shape"; readonly shape: WalkShapeName; readonly size: number; readonly islands: number; readonly ringWidth: number }
  | { readonly kind: "text"; readonly text: string; readonly size: number }
  | { readonly kind: "tones"; readonly image: BundledRasterId; readonly seed: number; readonly from: number; readonly to: number }
  | { readonly kind: "domain"; readonly domain: PlanarShape }
  | { readonly kind: "mask"; readonly mask: MaskRaster; readonly threshold?: number };

/** Cells the front may never enter, subtracted from the mask. Lengths are in cells. */
export type WalkBarrier =
  | { readonly kind: "none" }
  | { readonly kind: "wall"; readonly position: number; readonly width: number; readonly gap: number }
  | { readonly kind: "enclosure"; readonly size: number; readonly width: number; readonly gap: number }
  | { readonly kind: "pillars"; readonly spacing: number; readonly radius: number }
  | { readonly kind: "domain"; readonly domain: PlanarShape };

export const WALK_GRID_LIMITS = Object.freeze({
  /** Cells per side, and in all: 100,000 cells keeps a state of two typed arrays near 300 KB. */
  minSide: 4, maxSide: 400, maxCells: 100_000,
});

export interface WalkGrid {
  readonly id: string;
  readonly columns: number;
  readonly rows: number;
  /** Allowed cells. */
  readonly count: number;
  /** Cell `(x, y)` is allowed (false outside the lattice). */
  isAllowed(x: number, y: number): boolean;
  /** A copy of the allowed flags, row-major, 1 = allowed. */
  cells(): Uint8Array;
}

const stores = new WeakMap<object, Uint8Array>();
/** Backing array of a grid. Internal to the walk modules: NEVER mutate it. */
export function gridStorage(grid: WalkGrid): Uint8Array {
  const store = stores.get(grid);
  if (!store) throw new Error("Expected a WalkGrid created by walkGrid()");
  return store;
}

function checkSide(name: string, value: number): void {
  if (!Number.isInteger(value) || value < WALK_GRID_LIMITS.minSide || value > WALK_GRID_LIMITS.maxSide)
    throw new Error(`${name} must be an integer from ${WALK_GRID_LIMITS.minSide} to ${WALK_GRID_LIMITS.maxSide} (got ${String(value)})`);
}

/* ------------------------------------------------------------------------------------ identity */

function contentId(columns: number, rows: number, data: Uint8Array): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ columns;
  for (let i = 0; i < data.length; i++) {
    a = Math.imul(a ^ data[i], 0x01000193);
    b = Math.imul((b + data[i] + 1) ^ (b >>> 15), 0x85ebca6b);
  }
  return `${columns}x${rows}:${(a >>> 0).toString(16)}${(b >>> 0).toString(16)}`;
}

const known = new Map<string, WalkGrid>();
function intern(columns: number, rows: number, data: Uint8Array): WalkGrid {
  const id = contentId(columns, rows, data);
  const hit = known.get(id);
  if (hit) {
    const other = stores.get(hit)!;
    let same = true;
    for (let i = 0; i < data.length && same; i++) same = other[i] === data[i];
    if (same) { known.delete(id); known.set(id, hit); return hit; }
    // A hash collision between different masks: a distinct, uncached grid (correct, never shared).
    return make(`${id}#${known.size}`, columns, rows, data);
  }
  const grid = make(id, columns, rows, data);
  known.set(id, grid);
  if (known.size > 24) known.delete(known.keys().next().value!);
  return grid;
}

function make(id: string, columns: number, rows: number, data: Uint8Array): WalkGrid {
  let count = 0;
  for (let i = 0; i < data.length; i++) count += data[i];
  const grid: WalkGrid = Object.freeze({
    id, columns, rows, count,
    isAllowed: (x: number, y: number) => x >= 0 && y >= 0 && x < columns && y < rows && data[y * columns + x] === 1,
    cells: () => data.slice(),
  });
  stores.set(grid, data);
  return grid;
}

/* ---------------------------------------------------------------------------------- shapes */

const circleRing = (cx: number, cy: number, radius: number): Ring => {
  const n = Math.min(180, Math.max(16, Math.ceil(Math.PI * radius / 1.5)));
  return Array.from({ length: n }, (_, k): [number, number] => [cx + Math.cos(2 * Math.PI * k / n) * radius, cy + Math.sin(2 * Math.PI * k / n) * radius]);
};
const blobRing = (cx: number, cy: number, radius: number, k: number): Ring => {
  const n = Math.min(200, Math.max(24, Math.ceil(Math.PI * radius / 1.2)));
  const p = k * 1.7 + 0.4, q = k * 2.3 + 1.1;
  return Array.from({ length: n }, (_, i): [number, number] => {
    const t = 2 * Math.PI * i / n;
    const r = radius * (1 + 0.16 * Math.sin(3 * t + p) + 0.08 * Math.sin(5 * t + q));
    return [cx + Math.cos(t) * r, cy + Math.sin(t) * r];
  });
};
const rect = (left: number, top: number, right: number, bottom: number): PlanarShape =>
  ({ outer: [[left, top], [right, top], [right, bottom], [left, bottom]] });

function shapeDomain(source: Extract<WalkMaskSource, { kind: "shape" }>, columns: number, rows: number): PlanarDomain | null {
  const cx = columns / 2, cy = rows / 2, m = Math.min(columns, rows), R = source.size * m / 2;
  switch (source.shape) {
    case "open": return null;
    case "disc": return planarDomain({ outer: circleRing(cx, cy, R) }, { id: "walk:disc" });
    case "ring":
      return planarDomain({ outer: circleRing(cx, cy, R), holes: [circleRing(cx, cy, Math.max(0.5, R * (1 - source.ringWidth)))] }, { id: "walk:ring" });
    case "islands": {
      const n = source.islands, blobs: PlanarShape[] = [];
      for (let k = 0; k < n; k++) {
        const angle = k * 2.399963229728653, distance = R * Math.sqrt((k + 0.5) / n);
        const spacing = 1.9 * R / Math.sqrt(n);
        const radius = spacing * (0.24 + 0.1 * (((k * 7) % 5) / 4));
        blobs.push({ outer: blobRing(cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance, Math.max(1.5, radius), k) });
      }
      return unionDomains(blobs, { id: "walk:islands" });
    }
    case "chambers": {
      const room = 0.13 * source.size * m, reach = 0.36 * source.size * m, corridor = Math.max(1.2, 0.025 * m);
      const parts: PlanarShape[] = [rect(cx - room, cy - room, cx + room, cy + room)];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = cx + dx * reach, y = cy + dy * reach;
        parts.push(rect(x - room * 0.85, y - room * 0.85, x + room * 0.85, y + room * 0.85));
        parts.push(dx !== 0 ? rect(Math.min(cx, x), cy - corridor, Math.max(cx, x), cy + corridor) : rect(cx - corridor, Math.min(cy, y), cx + corridor, Math.max(cy, y)));
      }
      return unionDomains(parts, { id: "walk:chambers" });
    }
  }
}

function barrierDomain(barrier: WalkBarrier, columns: number, rows: number): PlanarShape | null {
  const cx = columns / 2, cy = rows / 2, m = Math.min(columns, rows);
  switch (barrier.kind) {
    case "none": return null;
    case "domain": return barrier.domain;
    case "wall": {
      const x = barrier.position * columns, half = barrier.width / 2, gap = barrier.gap / 2;
      if (gap <= 0) return rect(x - half, -1, x + half, rows + 1);
      return unionDomains([rect(x - half, -1, x + half, cy - gap), rect(x - half, cy + gap, x + half, rows + 1)], { id: "walk:wall" });
    }
    case "enclosure": {
      const outer = barrier.size * m / 2, inner = Math.max(0.5, outer - barrier.width);
      const ring = planarDomain({ outer: circleRing(cx, cy, outer), holes: [circleRing(cx, cy, inner)] }, { id: "walk:enclosure" });
      return barrier.gap > 0 ? domainDifference(ring, rect(cx + inner - 1, cy - barrier.gap / 2, cx + outer + 1, cy + barrier.gap / 2), { id: "walk:enclosure" }) : ring;
    }
    case "pillars": {
      const pillars: PlanarShape[] = [];
      for (let y = barrier.spacing / 2; y < rows; y += barrier.spacing)
        for (let x = barrier.spacing / 2; x < columns; x += barrier.spacing) pillars.push({ outer: circleRing(x, y, barrier.radius) });
      return pillars.length > 0 ? unionDomains(pillars, { id: "walk:pillars" }) : null;
    }
  }
}

/** Mark the cells whose centre lies in `shape` (closed, holes excluded). Cell-space coordinates. */
function paint(shape: PlanarShape, columns: number, rows: number, value: number, into: Uint8Array): void {
  const domain = "regions" in shape ? shape : planarDomain(shape);
  if (domain.regions.length === 0) return;
  for (const stroke of hatchDomain(domain, { spacing: 1, angle: 0, phase: 0.5, origin: [0, 0] })) {
    const [a, b] = stroke.points;
    const row = Math.floor(a[1]);
    if (row < 0 || row >= rows) continue;
    const from = Math.max(0, Math.ceil(Math.min(a[0], b[0]) - 0.5)), to = Math.min(columns - 1, Math.floor(Math.max(a[0], b[0]) - 0.5));
    for (let x = from; x <= to; x++) into[row * columns + x] = value;
  }
}

/* ---------------------------------------------------------------------------------- resolve */

function validateSource(source: WalkMaskSource): void {
  const fraction = (name: string, value: number, low: number, high: number) => {
    if (!(value >= low && value <= high)) throw new Error(`${name} must be from ${low} to ${high} (got ${String(value)})`);
  };
  if (source.kind === "shape") {
    if (!walkShapeNames.includes(source.shape)) throw new Error(`Unknown mask shape ${String(source.shape)}`);
    fraction("Mask size", source.size, 0.05, 1);
    if (source.shape === "islands" && !(Number.isInteger(source.islands) && source.islands >= 1 && source.islands <= 64)) throw new Error("Islands must be an integer from 1 to 64");
    if (source.shape === "ring") fraction("Ring width", source.ringWidth, 0.02, 0.98);
  } else if (source.kind === "text") {
    if (!/^[\x20-\x7e]{1,20}$/.test(source.text) || source.text.trim().length === 0) throw new Error("Word must be 1 to 20 printable ASCII characters with at least one visible letter");
    fraction("Mask size", source.size, 0.05, 1);
  } else if (source.kind === "tones") {
    if (!(bundledRasterIds as readonly string[]).includes(source.image)) throw new Error(`Unknown bundled image ${String(source.image)}`);
    fraction("Tone from", source.from, 0, 1); fraction("Tone to", source.to, 0, 1);
    if (source.from > source.to) throw new Error("Tone from must not exceed Tone to");
  } else if (source.kind === "mask") {
    const { width, height, data } = source.mask;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length !== width * height) throw new Error("A mask needs width × height values");
  }
}

/**
 * Resolve a mask source and optional barrier to a grid of `columns × rows` cells. Throws (naming the
 * control) when the result would have no allowed cell: an empty domain is an input error, not a picture.
 * The same content returns the same frozen grid object.
 */
export function walkGrid(source: WalkMaskSource, barrier: WalkBarrier, columns: number, rows: number): WalkGrid {
  checkSide("Columns", columns); checkSide("Rows", rows);
  if (columns * rows > WALK_GRID_LIMITS.maxCells) throw new Error(`Columns × rows is ${columns * rows}; the limit is ${WALK_GRID_LIMITS.maxCells} cells. Lower Columns or Rows`);
  validateSource(source);
  const data = new Uint8Array(columns * rows);
  if (source.kind === "shape" || source.kind === "text" || source.kind === "domain") {
    if (source.kind === "shape" && source.shape === "open") data.fill(1);
    else {
      const domain = source.kind === "shape" ? shapeDomain(source, columns, rows)!
        : source.kind === "text" ? textDomain(source.text, { centerX: columns / 2, centerY: rows / 2, width: columns * source.size, height: rows * source.size })
        : "regions" in source.domain ? source.domain : planarDomain(source.domain);
      paint(domain, columns, rows, 1, data);
    }
  } else if (source.kind === "tones") {
    const raster = bundledRaster(source.image, source.seed), field = valueField(raster, "lightness");
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const v = sampleGrid(field, (x + 0.5) / columns * field.width, (y + 0.5) / rows * field.height);
      data[y * columns + x] = v >= source.from && v <= source.to ? 1 : 0;
    }
  } else {
    const { width, height, data: values } = source.mask, threshold = source.threshold ?? 0.5;
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const sx = Math.min(width - 1, Math.floor((x + 0.5) / columns * width)), sy = Math.min(height - 1, Math.floor((y + 0.5) / rows * height));
      data[y * columns + x] = values[sy * width + sx] >= threshold ? 1 : 0;
    }
  }
  const wall = barrierDomain(barrier, columns, rows);
  if (wall) paint(wall, columns, rows, 0, data);
  let count = 0;
  for (let i = 0; i < data.length; i++) count += data[i];
  if (count === 0) throw new Error("The mask leaves no cell for the walk: enlarge Mask size, widen the tone interval or shrink the barrier");
  return intern(columns, rows, data);
}

/* --------------------------------------------------------------------- regions and placement */

export interface WalkRegions {
  /** Connected regions of allowed cells, ordered by size descending then by first cell in raster order. */
  readonly count: number;
  readonly sizes: readonly number[];
  /** For each region, the allowed cell nearest its centroid (ties: lowest raster index), as `[x, y]`. */
  readonly anchors: readonly (readonly [number, number])[];
  /** Region index of a cell, or -1 when the cell is not allowed. */
  regionOf(x: number, y: number): number;
}

const regionCache = new WeakMap<WalkGrid, Map<number, WalkRegions>>();

/** Connected regions of the allowed cells under a 4- or 8-neighbourhood (the walk's own moves). */
export function walkRegions(grid: WalkGrid, neighbourhood: 4 | 8): WalkRegions {
  let byNeighbourhood = regionCache.get(grid);
  if (!byNeighbourhood) { byNeighbourhood = new Map(); regionCache.set(grid, byNeighbourhood); }
  const hit = byNeighbourhood.get(neighbourhood);
  if (hit) return hit;
  const { columns, rows } = grid, data = gridStorage(grid);
  const label = new Int32Array(columns * rows).fill(-1), found: { first: number; size: number; sx: number; sy: number; cells: number[] }[] = [];
  const dirs = neighbourhood === 8 ? 8 : 4;
  const DX = [1, 0, -1, 0, 1, -1, -1, 1], DY = [0, 1, 0, -1, 1, 1, -1, -1];
  for (let start = 0; start < data.length; start++) {
    if (data[start] !== 1 || label[start] !== -1) continue;
    const id = found.length, region = { first: start, size: 0, sx: 0, sy: 0, cells: [start] as number[] };
    label[start] = id;
    for (let head = 0; head < region.cells.length; head++) {
      const cell = region.cells[head], x = cell % columns, y = (cell - x) / columns;
      region.size++; region.sx += x + 0.5; region.sy += y + 0.5;
      for (let d = 0; d < dirs; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= columns || ny >= rows) continue;
        const n = ny * columns + nx;
        if (data[n] === 1 && label[n] === -1) { label[n] = id; region.cells.push(n); }
      }
    }
    found.push(region);
  }
  const order = found.map((_, i) => i).sort((a, b) => found[b].size - found[a].size || found[a].first - found[b].first);
  const rank = new Int32Array(found.length);
  order.forEach((original, index) => { rank[original] = index; });
  const anchors = order.map((original) => {
    const region = found[original], mx = region.sx / region.size, my = region.sy / region.size; // centroid of the cell centres
    let best = region.first, bestD = Infinity;
    for (const cell of region.cells.slice().sort((a, b) => a - b)) {
      const x = cell % columns, y = (cell - x) / columns, d = (x + 0.5 - mx) ** 2 + (y + 0.5 - my) ** 2;
      if (d < bestD) { bestD = d; best = cell; }
    }
    return Object.freeze([best % columns, Math.floor(best / columns)] as const);
  });
  const regions: WalkRegions = Object.freeze({
    count: found.length, sizes: Object.freeze(order.map((original) => found[original].size)), anchors: Object.freeze(anchors),
    regionOf: (x: number, y: number) => x >= 0 && y >= 0 && x < columns && y < rows && label[y * columns + x] >= 0 ? rank[label[y * columns + x]] : -1,
  });
  byNeighbourhood.set(neighbourhood, regions);
  return regions;
}

/**
 * The allowed cell nearest the point `(px, py)` in cell units (cell `(x, y)` has its centre at
 * `(x + ½, y + ½)`); ties go to the lowest raster index.
 */
export function nearestAllowedCell(grid: WalkGrid, px: number, py: number): readonly [number, number] {
  const { columns, rows } = grid, data = gridStorage(grid);
  const cx = Math.min(columns - 1, Math.max(0, Math.floor(px))), cy = Math.min(rows - 1, Math.max(0, Math.floor(py)));
  let best = -1, bestD = Infinity;
  for (let radius = 0; radius < Math.max(columns, rows); radius++) {
    if (best >= 0 && radius > Math.sqrt(bestD) + 1.5) break;
    for (let y = Math.max(0, cy - radius); y <= Math.min(rows - 1, cy + radius); y++) {
      const edge = y === cy - radius || y === cy + radius;
      for (let x = Math.max(0, cx - radius); x <= Math.min(columns - 1, cx + radius); x += edge ? 1 : Math.max(1, 2 * radius)) {
        const cell = y * columns + x;
        if (data[cell] !== 1) continue;
        const d = (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2;
        if (d < bestD || (d === bestD && cell < best)) { bestD = d; best = cell; }
      }
    }
  }
  return [best % columns, Math.floor(best / columns)];
}
