import { PlanarError, charge, checkCoordinate, groupRings, overlay, type Pt } from "./planar-kernel.js";
import { finishRaw, resolveShape, workFor, buildDomain, ringsOfRegions, type PlanarDomain, type PlanarOptions, type PlanarShape } from "./domains.js";
import { simplifyRingSet } from "./domains-simplify.js";

/**
 * Regions from rasters: boolean masks, scalar masks and label rasters.
 *
 * PIXEL CONVENTION. A raster is `{ width, height, data }`, row-major, row 0 at the top (y down).
 * Pixel `(i, j)` is the square `[i, i+1] × [j, j+1]` in raster units, scaled by `cell` (canvas
 * units per pixel) and shifted by `origin` (the canvas position of the raster's top-left CORNER);
 * its centre is `(i + ½, j + ½)`. Mask data may be any `ArrayLike<number>`; a pixel is inside iff
 * `value >= threshold` (default 0.5, so 0/1 and booleans work). Labels are finite integers.
 *
 * MODE "cells" (default). The region is exactly the union of the inside pixels: boundaries follow
 * pixel edges, area is `count × cell²`, and vertices lie on the pixel-corner lattice. Two inside
 * pixels are connected only across an edge: diagonal neighbours are two regions that touch at a
 * point (4-connectivity of the inside; the same for the outside, so a diagonal gap does not
 * separate anything). Holes are nested exactly. Straight runs are merged into single edges.
 *
 * MODE "contour" (masks only). Marching squares on the pixel-centre samples, closed by a ring of
 * outside samples around the raster, with linear interpolation of the crossing between two
 * samples (the midpoint when a sample is the outside border). Binary masks therefore give
 * midpoint-cut corners (a lone pixel becomes a diamond of area cell²/2) and scalar masks give
 * smooth boundaries. Saddles keep the inside diagonals separate, consistently with "cells".
 *
 * SIMPLIFY (canvas units, default 0). Boundaries are thinned with topology-preserving
 * Douglas–Peucker (see `domains-simplify.ts`): rings never cross or touch each other or themselves
 * because of the thinning, and boundaries shared by two labels stay shared and identical. `protectFrame` also fixes the four
 * corners of the raster frame, so the frame of a segmented picture is never cut across a corner.
 *
 * LABELS. `labelDomains` returns one domain per non-background label, in ascending label order.
 * Neighbouring labels' shared boundaries coincide exactly, before and after simplification.
 *
 * Failure: non-finite values, non-integer labels, mismatched sizes and more than
 * `MASK_DOMAIN_LIMITS.maxPixels` pixels throw `PlanarError` naming the argument.
 */
export interface MaskRaster {
  readonly width: number;
  readonly height: number;
  readonly data: ArrayLike<number>;
}
export interface RasterOptions extends PlanarOptions {
  /** Canvas units per pixel, > 0. Default 1. */
  readonly cell?: number;
  /** Canvas position of the raster's top-left corner. Default [0, 0]. */
  readonly origin?: readonly [number, number];
  readonly simplify?: number;
  /**
   * With `simplify`, keep the four corners of the raster frame as fixed vertices, so thinning never cuts a corner of the
   * picture (the frame stays a rectangle wherever a region reaches it). Default false: frame corners may be thinned like any vertex.
   */
  readonly protectFrame?: boolean;
}
export interface MaskOptions extends RasterOptions {
  readonly threshold?: number;
  readonly mode?: "cells" | "contour";
}
export interface LabelOptions extends RasterOptions {
  /** Label that is not extracted (default 0). Pass `null` to extract every label. */
  readonly background?: number | null;
}
export interface LabelDomain { readonly label: number; readonly domain: PlanarDomain }
export const MASK_DOMAIN_LIMITS = Object.freeze({ maxPixels: 4_194_304 });

interface Frame { width: number; height: number; cell: number; ox: number; oy: number; simplify: number; protectFrame: boolean }
function frame(raster: MaskRaster, options: RasterOptions): Frame {
  if (typeof raster !== "object" || raster === null) throw new PlanarError("INVALID_INPUT", "raster must be an object { width, height, data }");
  const { width, height, data } = raster;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) throw new PlanarError("INVALID_INPUT", "raster.width and raster.height must be positive integers");
  if (width * height > MASK_DOMAIN_LIMITS.maxPixels) throw new PlanarError("WORK_LIMIT", `raster has ${width * height} pixels; the limit is ${MASK_DOMAIN_LIMITS.maxPixels}. Downsample the raster`);
  if (!data || typeof data.length !== "number" || data.length !== width * height) throw new PlanarError("INVALID_INPUT", `raster.data must have width × height = ${width * height} entries`);
  const cell = checkCoordinate("options.cell", options.cell ?? 1);
  if (!(cell > 0)) throw new PlanarError("INVALID_INPUT", "options.cell must be > 0");
  const origin = options.origin ?? [0, 0];
  const simplify = checkCoordinate("options.simplify", options.simplify ?? 0);
  if (simplify < 0) throw new PlanarError("INVALID_INPUT", "options.simplify must be ≥ 0");
  return { width, height, cell, ox: checkCoordinate("options.origin[0]", origin[0]), oy: checkCoordinate("options.origin[1]", origin[1]), simplify, protectFrame: options.protectFrame === true };
}

const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1]; // E, S, W, N: increasing algebraic angle (counter-clockwise with y as given)
const OUTSIDE = -2147483649;

/** Directed unit boundary edges of every wanted label, region on the left: code = vertex * 4 + direction. */
function cellEdges(labels: Int32Array, w: number, h: number, wanted: (label: number) => boolean): Map<number, number[]> {
  const groups = new Map<number, number[]>();
  const stride = w + 1;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const l = labels[j * w + i];
    if (!wanted(l)) continue;
    let list = groups.get(l);
    if (!list) { list = []; groups.set(l, list); }
    if (j === 0 || labels[(j - 1) * w + i] !== l) list.push((j * stride + i) * 4);
    if (i === w - 1 || labels[j * w + i + 1] !== l) list.push((j * stride + i + 1) * 4 + 1);
    if (j === h - 1 || labels[(j + 1) * w + i] !== l) list.push(((j + 1) * stride + i + 1) * 4 + 2);
    if (i === 0 || labels[j * w + i - 1] !== l) list.push(((j + 1) * stride + i) * 4 + 3);
  }
  return groups;
}

/** Trace one label's edges into vertex-id rings (simple: a ring that revisits a vertex is split there). */
function traceCells(edges: readonly number[], w: number, h: number, scratch: { first: Int32Array; second: Int32Array; used: Uint8Array; position: Int32Array }): number[][] {
  const stride = w + 1;
  const { first, second, used, position } = scratch;
  for (const code of edges) {
    const v = code >> 2;
    if (first[v] < 0) first[v] = code; else second[v] = code;
  }
  const head = (code: number): number => (code >> 2) + DX[code & 3] + DY[code & 3] * stride;
  const rings: number[][] = [];
  for (const start of edges) {
    if (used[start]) continue;
    const path: number[] = [];
    let current = start;
    for (;;) {
      const v = current >> 2;
      const seen = position[v];
      if (seen >= 0) {
        const loop = path.splice(seen);
        for (const u of loop) position[u] = -1;
        if (loop.length >= 4) rings.push(loop);
      }
      position[v] = path.length;
      path.push(v);
      used[current] = 1;
      const to = head(current), twin = ((current & 3) + 2) & 3;
      const a = first[to], b = second[to];
      let next = a;
      if (b >= 0) {
        // Two ways on: take the one with the larger counter-clockwise angle from the reversed incoming edge.
        const angleA = ((a & 3) - twin + 4) & 3, angleB = ((b & 3) - twin + 4) & 3;
        next = angleB > angleA ? b : a;
      }
      if (next === start) break;
      current = next;
    }
    for (const u of path) position[u] = -1;
    if (path.length >= 4) rings.push(path);
  }
  for (const code of edges) { const v = code >> 2; first[v] = -1; second[v] = -1; used[code] = 0; }
  return rings;
}

function labelRasterData(raster: MaskRaster, integer: boolean, value: (v: number) => number): Int32Array {
  const { width, height, data } = raster;
  const out = new Int32Array(width * height);
  for (let k = 0; k < out.length; k++) {
    const v = data[k];
    if (typeof v !== "number" || !Number.isFinite(v)) throw new PlanarError("INVALID_INPUT", `raster.data[${k}] must be a finite number`);
    if (integer && (!Number.isInteger(v) || Math.abs(v) > 2147483647)) throw new PlanarError("INVALID_INPUT", `raster.data[${k}] = ${v} is not a label: labels must be integers within ±2147483647`);
    out[k] = value(v);
  }
  return out;
}

function cellDomains(labels: Int32Array, f: Frame, wanted: (label: number) => boolean, options: RasterOptions, idFor: (label: number) => string): LabelDomain[] {
  const work = workFor("raster extraction", options);
  const { width: w, height: h } = f, stride = w + 1, vertices = stride * (h + 1);
  const groups = cellEdges(labels, w, h, wanted);
  charge(work, w * h);
  const scratch = { first: new Int32Array(vertices).fill(-1), second: new Int32Array(vertices).fill(-1), used: new Uint8Array(vertices * 4), position: new Int32Array(vertices).fill(-1) };
  const traced = [...groups.keys()].sort((a, b) => a - b).map((label) => ({ label, rings: traceCells(groups.get(label)!, w, h, scratch) }));
  // A boundary vertex is an anchor when three or more of its four surrounding unit edges separate labels that matter.
  const at = (i: number, j: number): number => (i < 0 || j < 0 || i >= w || j >= h) ? OUTSIDE : labels[j * w + i];
  const present = (a: number, b: number): boolean => a !== b && (wanted(a) || wanted(b));
  const isAnchor = (v: number): boolean => {
    const i = v % stride, j = (v - i) / stride;
    if (f.protectFrame && (i === 0 || i === w) && (j === 0 || j === h)) return true;
    const nw = at(i - 1, j - 1), ne = at(i, j - 1), sw = at(i - 1, j), se = at(i, j);
    return +present(nw, ne) + +present(sw, se) + +present(nw, sw) + +present(ne, se) >= 3;
  };
  const point = (v: number): Pt => { const i = v % stride, j = (v - i) / stride; return [f.ox + i * f.cell, f.oy + j * f.cell]; };
  // Merge straight runs (never through an anchor), then optionally thin the boundaries.
  const all = traced.flatMap((t) => t.rings);
  const collapsed = f.simplify > 0 ? simplifyRingSet({ rings: all, coordinate: (v) => { const i = v % stride, j = (v - i) / stride; return [i, j]; }, anchor: isAnchor }, f.simplify / f.cell, work)
    : all.map((ring) => straighten(ring, stride, isAnchor));
  let cursor = 0;
  return traced.map(({ label, rings }) => {
    const mine = collapsed.slice(cursor, cursor + rings.length);
    cursor += rings.length;
    const id = idFor(label);
    const raw = groupRings(mine.filter((ring) => ring.length >= 3).map((ring) => ring.map(point)), work);
    return { label, domain: finishRaw(id, raw, options) };
  });
}

/** Drop vertices that continue a straight lattice run and are not anchors. */
function straighten(ring: readonly number[], stride: number, anchor: (v: number) => boolean): number[] {
  const n = ring.length, out: number[] = [];
  const step = (a: number, b: number): number => b - a;
  for (let k = 0; k < n; k++) {
    const v = ring[k];
    if (step(ring[(k + n - 1) % n], v) === step(v, ring[(k + 1) % n]) && !anchor(v)) continue;
    out.push(v);
  }
  return out;
}

/** Regions of the inside pixels (or contour) of a mask. See the header for the conventions. */
export function maskDomain(mask: MaskRaster, options: MaskOptions = {}): PlanarDomain {
  const f = frame(mask, options);
  const threshold = checkCoordinate("options.threshold", options.threshold ?? 0.5);
  const mode = options.mode ?? "cells";
  if (mode !== "cells" && mode !== "contour") throw new PlanarError("INVALID_INPUT", `options.mode must be "cells" or "contour"`);
  const id = options.id ?? "mask";
  if (mode === "contour") return contourDomain(mask, f, threshold, options, id);
  const labels = labelRasterData(mask, false, (v) => v >= threshold ? 1 : 0);
  const [only] = cellDomains(labels, f, (l) => l === 1, options, () => id);
  return only ? only.domain : buildDomain(id, []);
}

/** One domain per label of a label raster (see the header). */
export function labelDomains(raster: MaskRaster, options: LabelOptions = {}): readonly LabelDomain[] {
  const f = frame(raster, options);
  const background = options.background === undefined ? 0 : options.background;
  if (background !== null && (!Number.isInteger(background) || Math.abs(background) > 2147483647)) throw new PlanarError("INVALID_INPUT", "options.background must be an integer label or null");
  const id = options.id ?? "labels";
  const labels = labelRasterData(raster, true, (v) => v);
  return Object.freeze(cellDomains(labels, f, (l) => l !== background, options, (label) => `${id}:${label}`).map((entry) => Object.freeze(entry)));
}

/** Marching squares over the padded pixel-centre samples: rings of crossing points, region on the left. */
function contourDomain(mask: MaskRaster, f: Frame, threshold: number, options: MaskOptions, id: string): PlanarDomain {
  const work = workFor("mask contour", options);
  const { width: w, height: h } = f;
  const values = new Float64Array(w * h);
  for (let k = 0; k < values.length; k++) {
    const v = mask.data[k];
    if (typeof v !== "number" || !Number.isFinite(v)) throw new PlanarError("INVALID_INPUT", `raster.data[${k}] must be a finite number`);
    values[k] = v;
  }
  charge(work, w * h);
  const sample = (i: number, j: number): number => (i < 0 || j < 0 || i >= w || j >= h) ? -Infinity : values[j * w + i];
  const inside = (i: number, j: number): boolean => sample(i, j) >= threshold;
  const posX = (i: number): number => f.ox + (i + 0.5) * f.cell, posY = (j: number): number => f.oy + (j + 0.5) * f.cell;
  // Crossing ids: horizontal edge (i,j)-(i+1,j) for i in [-1, w-1], j in [-1, h]; vertical (i,j)-(i,j+1) for i in [-1, w], j in [-1, h-1].
  const hCount = (w + 1) * (h + 2), vCount = (w + 2) * (h + 1);
  const hId = (i: number, j: number): number => (j + 1) * (w + 1) + (i + 1);
  const vId = (i: number, j: number): number => hCount + (j + 1) * (w + 2) + (i + 1);
  const next = new Int32Array(hCount + vCount).fill(-1);
  let degenerate = false;
  for (let j = -1; j < h; j++) for (let i = -1; i < w; i++) {
    const tl = inside(i, j), tr = inside(i + 1, j), br = inside(i + 1, j + 1), bl = inside(i, j + 1);
    if (tl === tr && tr === br && br === bl) continue;
    const c = [tl, tr, br, bl], e = [hId(i, j), vId(i + 1, j), hId(i, j + 1), vId(i, j)];
    for (let k = 0; k < 4; k++) {
      if (!(c[k] && !c[(k + 1) & 3])) continue;
      let m = k;
      while (c[(m + 3) & 3]) m = (m + 3) & 3;
      next[e[k]] = e[(m + 3) & 3];
    }
  }
  const crossing = (code: number): Pt => {
    if (code < hCount) {
      const i = (code % (w + 1)) - 1, j = Math.floor(code / (w + 1)) - 1;
      const a = sample(i, j), b = sample(i + 1, j);
      if (a === -Infinity || b === -Infinity) return [(posX(i) + posX(i + 1)) / 2, posY(j)];
      const t = (threshold - a) / (b - a);
      if (t <= 0 || t >= 1) degenerate = true;
      return [posX(i) + t * (posX(i + 1) - posX(i)), posY(j)];
    }
    const local = code - hCount, i = (local % (w + 2)) - 1, j = Math.floor(local / (w + 2)) - 1;
    const a = sample(i, j), b = sample(i, j + 1);
    if (a === -Infinity || b === -Infinity) return [posX(i), (posY(j) + posY(j + 1)) / 2];
    const t = (threshold - a) / (b - a);
    if (t <= 0 || t >= 1) degenerate = true;
    return [posX(i), posY(j) + t * (posY(j + 1) - posY(j))];
  };
  const seen = new Uint8Array(next.length);
  const rings: number[][] = [];
  for (let start = 0; start < next.length; start++) {
    if (next[start] < 0 || seen[start]) continue;
    const ring: number[] = [];
    for (let code = start; !seen[code]; code = next[code]) { seen[code] = 1; ring.push(code); }
    rings.push(ring);
  }
  charge(work, next.length);
  let pointRings: Pt[][] = rings.map((ring) => ring.map(crossing));
  if (f.simplify > 0) {
    // Each ring is its own loop here (crossing points lie on distinct grid edges); vertex ids are (ring, index).
    const flat: Pt[] = pointRings.flat(), offsets: number[] = [];
    let at = 0;
    for (const ring of pointRings) { offsets.push(at); at += ring.length; }
    const simplified = simplifyRingSet({ rings: pointRings.map((ring, r) => ring.map((_, k) => offsets[r] + k)), coordinate: (v) => flat[v], anchor: () => false }, f.simplify, work);
    pointRings = simplified.map((ring) => ring.map((v) => flat[v]));
  }
  // Degenerate interpolation (a sample exactly at the threshold) can make points coincide: resolve exactly.
  const raw = degenerate ? overlay([{ rings: pointRings.map(dedupe).filter((r) => r.length >= 3), fill: "nonzero" }], ([inside]) => inside, work) : groupRings(pointRings, work);
  return finishRaw(id, raw, options);
}
function dedupe(ring: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of ring) { const last = out[out.length - 1]; if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p); }
  while (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
  return out;
}

/**
 * Thin the boundaries of any shape with the topology-preserving simplifier. Boundary pieces
 * shared by two regions stay shared; rings never start to cross, touch or collapse; only original
 * vertices are kept. Tolerance is the largest distance a dropped vertex may lie from the new edge.
 */
export function simplifyDomain(shape: PlanarShape, tolerance: number, options: PlanarOptions = {}): PlanarDomain {
  checkCoordinate("tolerance", tolerance);
  if (tolerance < 0) throw new PlanarError("INVALID_INPUT", "tolerance must be ≥ 0");
  const work = workFor("simplifyDomain", options);
  const domain = resolveShape(shape, 0, work);
  const regions = "regions" in domain ? domain.regions : [domain];
  const id = options.id ?? `simplify(${domain.id})`;
  if (tolerance === 0) return finishRaw(id, overlay([{ rings: ringsOfRegions(regions), fill: "nonzero" }], ([inside]) => inside, work), options);
  const rings = ringsOfRegions(regions);
  const ids = new Map<string, number>(), pts: Pt[] = [];
  const idOf = (p: Pt): number => { const key = `${p[0]},${p[1]}`; let v = ids.get(key); if (v === undefined) { v = pts.length; ids.set(key, v); pts.push(p); } return v; };
  const idRings = rings.map((ring) => ring.map(idOf));
  const neighbours: Set<number>[] = pts.map(() => new Set<number>());
  for (const ring of idRings) for (let k = 0; k < ring.length; k++) { const a = ring[k], b = ring[(k + 1) % ring.length]; neighbours[a].add(b); neighbours[b].add(a); }
  const simplified = simplifyRingSet({ rings: idRings, coordinate: (v) => pts[v], anchor: (v) => neighbours[v].size >= 3 }, tolerance, work);
  return finishRaw(id, groupRings(simplified.filter((ring) => ring.length >= 3).map((ring) => ring.map((v) => pts[v])), work), options);
}
