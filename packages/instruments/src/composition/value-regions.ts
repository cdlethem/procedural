import { lightness } from "./compartments.js";
import type { PixelRect } from "./compartments.js";
import { componentSeed } from "./core.js";
import { planarDomain } from "./domains.js";
import type { PlanarDomain } from "./domains.js";
import { labelDomains } from "./domains-raster.js";
import { IMAGE_STRUCTURE_LIMITS, segmentValueBands, smoothValues } from "./image-structure.js";
import type { Segmentation } from "./image-structure.js";
import { locateInRing } from "./planar-kernel.js";
import type { Pt } from "./planar-kernel.js";
import { adoptScalarGrid, convertRaster, cropRaster, gridStorage, linearToSrgb, rasterMapping, rasterStorage, valueField } from "./raster.js";
import type { Raster, RasterMapping } from "./raster.js";

/**
 * Connected value regions: the PRODUCER of Value Regions (brief 31).
 *
 * `valueRegionMap` turns a resolved `Raster` (the library never fetches or decodes: bundled samples come from
 * `bundledRaster`, a host binds user images later) into a SMALL NUMBER OF COHERENT SHAPES:
 *
 *   1. crop and place the raster on a canvas rectangle (`rasterMapping`; the crop fills the rectangle, x and y scales
 *      may differ by up to one pixel per side, see `coverCrop`);
 *   2. one scalar value per pixel (`measure`: CIE lightness, luminance, luma or HSV saturation; transparent pixels are
 *      excluded from every region) optionally Gaussian-smoothed (`smoothing`, `smoothValues`);
 *   3. quantised into bands by `bands` (equal widths, equal pixel counts, or explicit cuts) and split into CONNECTED
 *      COMPONENTS under an explicit 4 or 8 connectivity (`segmentValueBands`): two same-band areas that only touch
 *      diagonally are one region under 8 and two under 4, and different bands never join;
 *   4. regions smaller than `minArea` merge into a neighbour by `longest-border` or `nearest-value` (foundation rule);
 *   5. `labelDomains` traces every region as a `PlanarDomain` (outer rings and holes, exact, nothing rasterised),
 *      simplified by `simplify` with the topology-preserving thinning of the domains foundation: a boundary shared
 *      by two regions is one chain, thinned once, so neighbours cannot disagree on a shared edge; the picture frame
 *      keeps its four corners.
 *
 * Output (all frozen; `docs/composition-value-regions.md`):
 *   - `regions`: one `ValueRegionShape` per region in raster order of its first pixel, with band, exact pixel count,
 *     polygon area/bounds/centroid (canvas units), mean value, mean COLOR (linear light, alpha weighted, published as
 *     straight sRGB), CIE tone, coverage, principal `axis` (radians in [0, pi), unsigned) and `elongation`, the
 *     polygon `domain`, the `parent` region whose hole encloses it (`null` for a region outside every hole),
 *     `depth`, `children`, `neighbors` (region id and shared boundary length) and `open` (touches the picture frame
 *     or an excluded pixel);
 *   - `arcs`: the boundary graph. Every boundary edge appears in exactly ONE arc, oriented so that `left` is on the
 *     left of travel (the domain convention); `right` is the region on the other side or `null` for the picture frame
 *     and excluded pixels. Arcs break where three or more boundaries meet, so a shared edge is one polyline used by
 *     both neighbours;
 *   - `adjacency`: region pairs with their shared boundary length (sum of arc lengths) and arc count.
 *
 * Identity. A region is named `v<index>` where index is the raster-order index of its first pixel in the cropped
 * image; an arc is `<left>|<right or ~>#<k>` (k by first vertex). Ids are functions of the construction only:
 * palette, fill, outline, retention and gutter never rename anything. Changing the construction (bands, minArea,
 * crop, resolution) may rename regions. `seed` labels each region through `componentSeed(seed, id, "region")`; nothing
 * about the partition depends on it.
 *
 * Hierarchy. A region's `parent` is the region whose hole, the smallest one, encloses the region's largest polygon
 * piece (every vertex of the piece's outer ring on or inside that hole ring). A region with several pieces (8-connected
 * corner contact) is placed by its largest piece.
 *
 * Units. `smoothing`, `simplify` and `minArea` (canvas area) are canvas units and are converted with the mean pixel
 * scale; a region's `pixels` and the segmentation are in source pixels. Angles are radians.
 *
 * Failure and bounds (nothing is truncated; each message names the control to change): at most
 * `IMAGE_STRUCTURE_LIMITS.pixels` crop pixels, `smoothing` at most 64 source pixels, at most `maxRegions` regions
 * (default 800, at most 5,000: raise `minArea`, smooth more, use fewer bands, lower resolution), at most
 * `VALUE_REGION_LIMITS.vertices` boundary vertices (raise `simplify`).
 *
 * Ownership. The map holds no reference to the source raster. Analyses are cached by construction (source hash,
 * crop, footprint, measure, smoothing, band rule, connectivity, minArea, merge, simplify, maxRegions; 6 analyses);
 * seeded maps are cached per seed (12).
 */
export type ValueMeasure = "lightness" | "luminance" | "luma" | "saturation";
const MEASURES: readonly ValueMeasure[] = ["lightness", "luminance", "luma", "saturation"];
export const valueMeasures: readonly ValueMeasure[] = Object.freeze(MEASURES.slice());

/** How values become bands: equal value widths, equal pixel counts (quantiles of the smoothed values), or explicit strictly increasing cuts in (0, 1). */
export type ValueBandRule =
  | { readonly kind: "equal"; readonly count: number }
  | { readonly kind: "balanced"; readonly count: number }
  | { readonly kind: "cuts"; readonly cuts: readonly number[] };

export type ValueMergePolicy = "longest-border" | "nearest-value";

export const VALUE_REGION_LIMITS = Object.freeze({
  sourcePixels: IMAGE_STRUCTURE_LIMITS.pixels, side: 4096, bands: 64, smoothingPixels: 64, defaultRegions: 800, regions: 5000, vertices: 300_000,
});

export interface ValueRegionOptions {
  /** Labels every region through `componentSeed`; never changes the partition. uint32. */
  seed: number;
  source: Raster;
  /** Integer source-pixel rectangle; default the whole raster (see `coverCrop`). */
  crop?: PixelRect;
  /** Canvas rectangle the crop is fitted to. */
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  measure: ValueMeasure;
  /** Gaussian standard deviation of the value smoothing, canvas units (0: none; at most 64 source pixels). */
  smoothing: number;
  bands: ValueBandRule;
  /** 4: same-band pixels join across edges only; 8: across corners too. */
  connectivity: 4 | 8;
  /** Regions smaller than this canvas AREA merge into a neighbour (0 merges nothing). */
  minArea: number;
  merge: ValueMergePolicy;
  /** Boundary thinning tolerance, canvas units (0 keeps every pixel edge). */
  simplify: number;
  /** Region bound, default 800, at most 5,000. */
  maxRegions?: number;
}

export interface ValueRegionNeighbor { readonly id: string; readonly length: number }

export interface ValueRegionShape {
  /** `v<index of the first pixel>`. */
  readonly id: string;
  /** Position in region order (raster order of first pixels). */
  readonly index: number;
  readonly seed: number;
  /** Band of the original component that absorbed the others (0 = lowest values). */
  readonly band: number;
  /** Exact number of source pixels. */
  readonly pixels: number;
  /** Polygon area, canvas units squared (holes excluded). */
  readonly area: number;
  /** [left, top, right, bottom] of the polygon in canvas units. */
  readonly bounds: readonly [number, number, number, number];
  readonly centroid: readonly [number, number];
  /** Mean of the (smoothed) measure over the region's pixels, [0, 1]. */
  readonly mean: number;
  /** Mean color, straight sRGB in [0, 1] (averaged in linear light, weighted by alpha). */
  readonly color: readonly [number, number, number];
  /** CIE L* / 100 of the mean color. */
  readonly tone: number;
  /** Mean alpha over the region, [0, 1] (1 for a raster without alpha). */
  readonly coverage: number;
  /** Direction of the region's long axis in canvas space, radians in [0, pi). */
  readonly axis: number;
  /** 0 for a round or square region, toward 1 for a long thin one: 1 - sqrt(minor / major variance). */
  readonly elongation: number;
  readonly parent: string | null;
  readonly depth: number;
  readonly children: readonly string[];
  readonly neighbors: readonly ValueRegionNeighbor[];
  /** True when the region touches the picture frame or an excluded pixel. */
  readonly open: boolean;
  readonly domain: PlanarDomain;
}

export interface ValueRegionArc {
  /** `<left>|<right or ~>#<k>`. */
  readonly id: string;
  readonly left: string;
  readonly right: string | null;
  /** A loop: the last vertex joins the first (which is not repeated). */
  readonly closed: boolean;
  readonly points: readonly (readonly [number, number])[];
  readonly length: number;
}

export interface ValueRegionAdjacency { readonly a: string; readonly b: string; readonly length: number; readonly arcs: number }

export interface ValueRegionMap {
  readonly sourceHash: string;
  readonly crop: Readonly<PixelRect>;
  /** Cropped raster pixels to canvas. */
  readonly mapping: RasterMapping;
  /** Band cuts actually used (explicit, or derived from the rule), strictly increasing. */
  readonly thresholds: readonly number[];
  readonly connectivity: 4 | 8;
  readonly minAreaPixels: number;
  readonly simplifyPixels: number;
  readonly regions: readonly ValueRegionShape[];
  readonly arcs: readonly ValueRegionArc[];
  readonly adjacency: readonly ValueRegionAdjacency[];
  /** Components absorbed by merging. */
  readonly merged: number;
  /** Regions still smaller than `minArea` (no neighbour to merge into). */
  readonly undersized: number;
}

function finite(name: string, v: unknown, low: number, high: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < low || v > high) throw new Error(`Value regions: ${name} must be a number in [${low}, ${high}] (got ${String(v)})`);
  return v;
}

type Analysis = Omit<ValueRegionMap, "regions"> & { readonly regions: readonly Omit<ValueRegionShape, "seed">[] };
const ANALYSES = new Map<string, Analysis>(), MAPS = new Map<string, ValueRegionMap>();
const remember = <T>(map: Map<string, T>, key: string, value: T, size: number): T => {
  map.set(key, value);
  if (map.size > size) map.delete(map.keys().next().value!);
  return value;
};
const recall = <T>(map: Map<string, T>, key: string): T | undefined => {
  const hit = map.get(key);
  if (hit !== undefined) { map.delete(key); map.set(key, hit); }
  return hit;
};

/** Cuts that give each band about the same number of included pixels; ties in the values collapse, so fewer cuts can result. */
function balancedCuts(values: Float64Array, included: (p: number) => boolean, count: number): number[] {
  const picked: number[] = [];
  for (let p = 0; p < values.length; p++) if (included(p)) picked.push(values[p]);
  const sorted = Float64Array.from(picked).sort();
  const cuts: number[] = [];
  if (sorted.length > 0) for (let k = 1; k < count; k++) {
    const t = sorted[Math.floor((k * sorted.length) / count)];
    if (t > sorted[0] && (cuts.length === 0 || t > cuts[cuts.length - 1])) cuts.push(t);
  }
  return cuts;
}

const ringPoints = (ring: readonly (readonly [number, number])[], mapping: RasterMapping): [number, number][] => ring.map(([x, y]) => mapping.toCanvas(x, y));

const polylineLength = (points: readonly (readonly [number, number])[], closed: boolean): number => {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  if (closed && points.length > 1) length += Math.hypot(points[0][0] - points[points.length - 1][0], points[0][1] - points[points.length - 1][1]);
  return length;
};

function analyse(o: ValueRegionOptions, crop: PixelRect, maxRegions: number): Analysis {
  const cropped = cropRaster(o.source, crop);
  const mapping = rasterMapping(cropped, { x: o.centerX - o.width / 2, y: o.centerY - o.height / 2, width: o.width, height: o.height });
  const meanScale = (mapping.scaleX + mapping.scaleY) / 2, { width: W, height: H } = cropped, P = W * H;
  const sigma = o.smoothing / meanScale;
  if (sigma > VALUE_REGION_LIMITS.smoothingPixels) throw new Error(`Value regions: smoothing ${o.smoothing} is ${sigma.toFixed(1)} source pixels at this scale; the limit is ${VALUE_REGION_LIMITS.smoothingPixels}: lower smoothing`);
  const raw = valueField(cropped, o.measure);
  const smoothed = smoothValues(raw, sigma);
  const alphaGrid = cropped.alpha === "none" ? null : gridStorage(valueField(cropped, "alpha"));
  let mask;
  if (alphaGrid) {
    const included = new Float64Array(P);
    for (let p = 0; p < P; p++) included[p] = alphaGrid[p] > 0 ? 1 : 0;
    mask = adoptScalarGrid(W, H, included);
  }
  const values = gridStorage(smoothed);
  const rule = o.bands, minAreaPixels = o.minArea > 0 ? Math.max(1, Math.ceil(o.minArea / (mapping.scaleX * mapping.scaleY))) : 1;
  let cuts: number[];
  if (rule.kind === "equal") cuts = Array.from({ length: rule.count - 1 }, (_, k) => (k + 1) / rule.count);
  else if (rule.kind === "balanced") cuts = balancedCuts(values, (p) => !alphaGrid || alphaGrid[p] > 0, rule.count);
  else cuts = rule.cuts.slice();
  // A constant picture has no balanced cut; the single cut at 1 leaves every pixel in one band.
  const segmentation = ((): Segmentation => {
    try {
      return segmentValueBands(smoothed, { thresholds: cuts.length > 0 ? cuts : [1], connectivity: o.connectivity, minArea: minAreaPixels, merge: o.merge, ...(mask ? { mask } : {}) });
    } catch (error) {
      if (error instanceof Error && /regions/.test(error.message)) throw new Error(`Value regions: the picture splits into more regions than can be built; raise minArea, raise smoothing, use fewer bands or lower resolution (${error.message})`);
      throw error;
    }
  })();
  const count = segmentation.regions.length;
  if (count > maxRegions) throw new Error(`Value regions: ${count} regions remain; the limit is ${maxRegions}: raise minArea, raise smoothing, use fewer bands or lower resolution`);
  const labels = gridStorage(segmentation.labels);

  // Exact per-region statistics from the raw pixels: color in linear light, alpha weighted, principal axis in canvas space.
  const hasAlpha = cropped.alpha !== "none";
  const linear = rasterStorage(convertRaster(cropped, hasAlpha ? { colorSpace: "linear", alpha: "premultiplied", format: "f32" } : { colorSpace: "linear", format: "f32" }));
  const ch = cropped.channels, colorChannels = hasAlpha ? ch - 1 : ch;
  const first = new Int32Array(count).fill(-1);
  const sr = new Float64Array(count), sg = new Float64Array(count), sb = new Float64Array(count), sa = new Float64Array(count);
  const sx = new Float64Array(count), sy = new Float64Array(count), sxx = new Float64Array(count), syy = new Float64Array(count), sxy = new Float64Array(count), n = new Float64Array(count);
  for (let p = 0; p < P; p++) {
    const l = labels[p];
    if (l < 0) continue;
    if (first[l] < 0) first[l] = p;
    const base = p * ch, x = (p % W) + 0.5, y = Math.floor(p / W) + 0.5;
    if (colorChannels === 1) { const c = linear[base]; sr[l] += c; sg[l] += c; sb[l] += c; } else { sr[l] += linear[base]; sg[l] += linear[base + 1]; sb[l] += linear[base + 2]; }
    sa[l] += hasAlpha ? linear[base + ch - 1] : 1;
    n[l]++; sx[l] += x; sy[l] += y; sxx[l] += x * x; syy[l] += y * y; sxy[l] += x * y;
  }

  // Boundaries: every region as a domain in pixel space (exact integers), then one shared affine map to canvas.
  const simplifyPixels = o.simplify / meanScale;
  const traced = labelDomains({ width: W, height: H, data: labels }, { background: -1, cell: 1, simplify: simplifyPixels, protectFrame: true, id: "vr" });
  const byLabel = new Map(traced.map((entry) => [entry.label, entry.domain]));
  let vertices = 0;
  for (const { domain } of traced) for (const region of domain.regions) vertices += region.outer.length + region.holes.reduce((s, h) => s + h.length, 0);
  if (vertices > VALUE_REGION_LIMITS.vertices) throw new Error(`Value regions: the boundaries have ${vertices} vertices; the limit is ${VALUE_REGION_LIMITS.vertices}: raise simplify or minArea`);

  const ids = Array.from(first, (p) => `v${p}`);
  const domains: PlanarDomain[] = [];
  for (let l = 0; l < count; l++) {
    const pixelDomain = byLabel.get(l);
    if (!pixelDomain) throw new Error(`Value regions: internal error, region ${l} has no boundary`);
    domains.push(planarDomain(pixelDomain.regions.map((piece, k) => ({ id: `${ids[l]}/${k}`, outer: ringPoints(piece.outer as never, mapping), holes: piece.holes.map((h) => ringPoints(h as never, mapping)) })), { id: ids[l] }));
  }

  // Hierarchy: the smallest hole that holds the region's largest piece.
  const holes: { owner: number; ring: readonly (readonly [number, number])[]; box: [number, number, number, number]; area: number }[] = [];
  domains.forEach((domain, owner) => {
    for (const piece of domain.regions) for (const ring of piece.holes) {
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, twice = 0;
      for (let i = 0; i < ring.length; i++) {
        const [x, y] = ring[i], [nx, ny] = ring[(i + 1) % ring.length];
        l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); twice += x * ny - nx * y;
      }
      holes.push({ owner, ring: ring as never, box: [l, t, r, b], area: Math.abs(twice) / 2 });
    }
  });
  const parentOf = new Int32Array(count).fill(-1);
  domains.forEach((domain, index) => {
    let piece = domain.regions[0];
    for (const candidate of domain.regions) if (candidate.area > piece.area) piece = candidate;
    const [pl, pt, pr, pb] = piece.bounds;
    let best = -1;
    for (let h = 0; h < holes.length; h++) {
      const hole = holes[h];
      if (hole.owner === index || hole.box[0] > pl || hole.box[1] > pt || hole.box[2] < pr || hole.box[3] < pb) continue;
      if (best >= 0 && hole.area >= holes[best].area) continue;
      if (piece.outer.every(([x, y]) => locateInRing(hole.ring as readonly Pt[], x, y) >= 0)) best = h;
    }
    if (best >= 0) parentOf[index] = holes[best].owner;
  });
  const depth = new Int32Array(count).fill(-1);
  const depthOf = (i: number): number => depth[i] >= 0 ? depth[i] : (depth[i] = parentOf[i] < 0 ? 0 : depthOf(parentOf[i]) + 1);
  for (let i = 0; i < count; i++) depthOf(i);
  const children: string[][] = Array.from({ length: count }, () => []);
  for (let i = 0; i < count; i++) if (parentOf[i] >= 0) children[parentOf[i]].push(ids[i]);

  // Boundary graph: one arc per maximal run of boundary edges with the same two regions and no junction.
  const vertexId = new Map<string, number>(), coordinates: [number, number][] = [];
  const idOfVertex = (p: readonly [number, number]): number => {
    const key = `${p[0]},${p[1]}`;
    let v = vertexId.get(key);
    if (v === undefined) { v = coordinates.length; vertexId.set(key, v); coordinates.push([p[0], p[1]]); }
    return v;
  };
  const directed: { u: number; v: number; owner: number }[] = [];
  domains.forEach((domain, owner) => {
    for (const piece of domain.regions) for (const ring of [piece.outer, ...piece.holes]) {
      const vs = ring.map((p) => idOfVertex(p as [number, number]));
      for (let i = 0; i < vs.length; i++) directed.push({ u: vs[i], v: vs[(i + 1) % vs.length], owner });
    }
  });
  const VN = coordinates.length, ownerOf = new Map<number, number>();
  for (const e of directed) ownerOf.set(e.u * VN + e.v, e.owner);
  interface Oriented { u: number; v: number; left: number; right: number }
  const edges: Oriented[] = [];
  for (const e of directed) {
    const other = ownerOf.get(e.v * VN + e.u);
    if (other === e.owner) throw new Error("Value regions: internal error, a region lies on both sides of an edge");
    if (other === undefined) edges.push({ u: e.u, v: e.v, left: e.owner, right: -1 });
    else if (e.owner < other) edges.push({ u: e.u, v: e.v, left: e.owner, right: other });
    else continue;
  }
  const outgoing = new Map<number, Oriented[]>();
  for (const e of edges) { const list = outgoing.get(e.u); if (list) list.push(e); else outgoing.set(e.u, [e]); }
  const incoming = new Map<number, Oriented[]>();
  for (const e of edges) { const list = incoming.get(e.v); if (list) list.push(e); else incoming.set(e.v, [e]); }
  // A vertex continues a chain when exactly two boundary edges meet there: with one in and one out they are the same region pair.
  const continues = (v: number): boolean => {
    const out = outgoing.get(v), inn = incoming.get(v);
    return !!out && out.length === 1 && !!inn && inn.length === 1;
  };
  const used = new Set<Oriented>();
  const chains: { left: number; right: number; closed: boolean; vs: number[] }[] = [];
  const follow = (start: Oriented): number[] => {
    const vs = [start.u, start.v];
    used.add(start);
    let tail = start.v;
    while (continues(tail)) {
      const next = outgoing.get(tail)![0];
      if (used.has(next)) break;
      used.add(next); vs.push(next.v); tail = next.v;
    }
    return vs;
  };
  for (const e of edges) if (!used.has(e) && !continues(e.u)) chains.push({ left: e.left, right: e.right, closed: false, vs: follow(e) });
  for (const e of edges) {
    if (used.has(e)) continue;
    const vs = follow(e);
    vs.pop();
    let low = 0;
    for (let k = 1; k < vs.length; k++) if (coordinates[vs[k]][0] < coordinates[vs[low]][0] || (coordinates[vs[k]][0] === coordinates[vs[low]][0] && coordinates[vs[k]][1] < coordinates[vs[low]][1])) low = k;
    chains.push({ left: e.left, right: e.right, closed: true, vs: [...vs.slice(low), ...vs.slice(0, low)] });
  }
  chains.sort((a, b) => a.left - b.left || a.right - b.right || coordinates[a.vs[0]][0] - coordinates[b.vs[0]][0] || coordinates[a.vs[0]][1] - coordinates[b.vs[0]][1]
    || a.vs.length - b.vs.length);
  const arcs: ValueRegionArc[] = [], pairCount = new Map<number, number>();
  for (const chain of chains) {
    const key = chain.left * (count + 1) + chain.right + 1, k = pairCount.get(key) ?? 0;
    pairCount.set(key, k + 1);
    const points = Object.freeze(chain.vs.map((v) => Object.freeze([coordinates[v][0], coordinates[v][1]] as const)));
    arcs.push(Object.freeze({ id: `${ids[chain.left]}|${chain.right < 0 ? "~" : ids[chain.right]}#${k}`, left: ids[chain.left], right: chain.right < 0 ? null : ids[chain.right],
      closed: chain.closed, points, length: polylineLength(points, chain.closed) }));
  }
  const indexOfId = new Map(ids.map((id, i) => [id, i]));
  const pairs = new Map<string, { a: string; b: string; length: number; arcs: number }>();
  const neighborLengths: Map<string, number>[] = Array.from({ length: count }, () => new Map());
  const open = new Uint8Array(count);
  for (const arc of arcs) {
    if (arc.right === null) { open[indexOfId.get(arc.left)!] = 1; continue; }
    const key = `${arc.left}|${arc.right}`, entry = pairs.get(key) ?? { a: arc.left, b: arc.right, length: 0, arcs: 0 };
    entry.length += arc.length; entry.arcs++;
    pairs.set(key, entry);
  }
  for (const { a, b, length } of pairs.values()) { neighborLengths[indexOfId.get(a)!].set(b, length); neighborLengths[indexOfId.get(b)!].set(a, length); }
  const adjacency = [...pairs.values()].sort((p, q) => indexOfId.get(p.a)! - indexOfId.get(q.a)! || indexOfId.get(p.b)! - indexOfId.get(q.b)!).map((p) => Object.freeze(p));

  const regions = domains.map((domain, i): Omit<ValueRegionShape, "seed"> => {
    const a = sa[i], count_ = n[i];
    let color: [number, number, number] = [0, 0, 0], tone = 0;
    if (a > 0) {
      const lr = sr[i] / a, lg = sg[i] / a, lb = sb[i] / a;
      color = [linearToSrgb(Math.min(1, lr)), linearToSrgb(Math.min(1, lg)), linearToSrgb(Math.min(1, lb))];
      tone = Math.min(1, Math.max(0, lightness(0.2126 * lr + 0.7152 * lg + 0.0722 * lb)));
    }
    // Second moments about the centroid in canvas units (each pixel a uniform square: + 1/12 per axis).
    const mx = sx[i] / count_, my = sy[i] / count_;
    const cxx = (sxx[i] / count_ - mx * mx + 1 / 12) * mapping.scaleX ** 2, cyy = (syy[i] / count_ - my * my + 1 / 12) * mapping.scaleY ** 2;
    const cxy = (sxy[i] / count_ - mx * my) * mapping.scaleX * mapping.scaleY;
    const mid = (cxx + cyy) / 2, spread = Math.hypot((cxx - cyy) / 2, cxy), major = mid + spread, minor = Math.max(0, mid - spread);
    let axis = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    if (axis < 0) axis += Math.PI;
    if (axis >= Math.PI) axis -= Math.PI;
    const elongation = major > 0 ? 1 - Math.sqrt(minor / major) : 0;
    const bounds = domain.bounds!, centroid = domain.centroid!;
    return Object.freeze({
      id: ids[i], index: i, band: segmentation.regions[i].band, pixels: segmentation.regions[i].area, area: domain.area,
      bounds: Object.freeze([bounds[0], bounds[1], bounds[2], bounds[3]] as const), centroid: Object.freeze([centroid[0], centroid[1]] as const),
      mean: segmentation.regions[i].mean, color: Object.freeze(color), tone, coverage: Math.min(1, a / count_),
      axis: axis === 0 ? 0 : axis, elongation, parent: parentOf[i] < 0 ? null : ids[parentOf[i]], depth: depth[i], children: Object.freeze(children[i].sort()),
      neighbors: Object.freeze([...neighborLengths[i]].map(([id, length]) => Object.freeze({ id, length })).sort((p, q) => indexOfId.get(p.id)! - indexOfId.get(q.id)!)),
      open: open[i] === 1, domain,
    });
  });
  return { sourceHash: o.source.hash, crop: Object.freeze({ ...crop }), mapping, thresholds: Object.freeze(segmentation.thresholds.slice()), connectivity: o.connectivity,
    minAreaPixels, simplifyPixels, regions: Object.freeze(regions), arcs: Object.freeze(arcs), adjacency: Object.freeze(adjacency),
    merged: segmentation.merged, undersized: segmentation.undersized };
}

/** The value regions of a picture; cached by construction, deeply frozen. See the module header for every rule. */
export function valueRegionMap(options: ValueRegionOptions): ValueRegionMap {
  if (options === null || typeof options !== "object") throw new Error("Value regions: options are required");
  const o = options;
  if (!Number.isSafeInteger(o.seed) || o.seed < 0 || o.seed > 0xffffffff) throw new Error("Value regions: seed must be a uint32 integer");
  if (o.source === null || typeof o.source !== "object" || !("hash" in o.source)) throw new Error("Value regions: source must be a Raster (createRaster or bundledRaster)");
  finite("centerX", o.centerX, -1e5, 1e5); finite("centerY", o.centerY, -1e5, 1e5);
  finite("width", o.width, 1, VALUE_REGION_LIMITS.side); finite("height", o.height, 1, VALUE_REGION_LIMITS.side);
  if (!MEASURES.includes(o.measure)) throw new Error(`Value regions: measure must be one of ${MEASURES.join(", ")}`);
  finite("smoothing", o.smoothing, 0, 1e4);
  finite("minArea", o.minArea, 0, 1e9);
  finite("simplify", o.simplify, 0, 1e4);
  if (o.connectivity !== 4 && o.connectivity !== 8) throw new Error("Value regions: connectivity must be 4 or 8");
  if (o.merge !== "longest-border" && o.merge !== "nearest-value") throw new Error(`Value regions: merge must be "longest-border" or "nearest-value"`);
  const rule = o.bands;
  if (rule === null || typeof rule !== "object") throw new Error("Value regions: bands must be a band rule");
  if (rule.kind === "equal" || rule.kind === "balanced") {
    if (!Number.isInteger(rule.count) || rule.count < 2 || rule.count > VALUE_REGION_LIMITS.bands) throw new Error(`Value regions: bands must be an integer in [2, ${VALUE_REGION_LIMITS.bands}]`);
  } else if (rule.kind === "cuts") {
    if (!Array.isArray(rule.cuts) || rule.cuts.length < 1 || rule.cuts.length > VALUE_REGION_LIMITS.bands - 1) throw new Error(`Value regions: cuts must list 1 to ${VALUE_REGION_LIMITS.bands - 1} values`);
    rule.cuts.forEach((cut, k) => {
      finite(`cuts[${k}]`, cut, 0, 1);
      if (k > 0 && !(cut > rule.cuts[k - 1])) throw new Error(`Value regions: cuts must be strictly increasing (cuts[${k}] = ${cut})`);
    });
  } else throw new Error(`Value regions: unknown band rule "${String((rule as { kind: unknown }).kind)}"`);
  const maxRegions = o.maxRegions === undefined ? VALUE_REGION_LIMITS.defaultRegions : finite("maxRegions", o.maxRegions, 1, VALUE_REGION_LIMITS.regions);
  if (!Number.isInteger(maxRegions)) throw new Error("Value regions: maxRegions must be an integer");
  const crop = o.crop ?? { x: 0, y: 0, width: o.source.width, height: o.source.height };
  for (const [name, v] of [["x", crop.x], ["y", crop.y], ["width", crop.width], ["height", crop.height]] as const)
    if (!Number.isInteger(v)) throw new Error(`Value regions: crop.${name} must be an integer`);
  if (crop.x < 0 || crop.y < 0 || crop.width < 1 || crop.height < 1 || crop.x + crop.width > o.source.width || crop.y + crop.height > o.source.height)
    throw new Error(`Value regions: crop ${crop.x},${crop.y} ${crop.width} x ${crop.height} must lie inside the ${o.source.width} x ${o.source.height} source`);
  if (crop.width * crop.height > VALUE_REGION_LIMITS.sourcePixels)
    throw new Error(`Value regions: the crop has ${crop.width * crop.height} pixels; the limit is ${VALUE_REGION_LIMITS.sourcePixels}: raise zoom or lower resolution`);
  const construction = JSON.stringify([o.source.hash, crop.x, crop.y, crop.width, crop.height, o.centerX, o.centerY, o.width, o.height, o.measure, o.smoothing, rule,
    o.connectivity, o.minArea, o.merge, o.simplify, maxRegions]);
  const mapKey = `${o.seed}|${construction}`, cached = recall(MAPS, mapKey);
  if (cached) return cached;
  const analysis = recall(ANALYSES, construction) ?? remember(ANALYSES, construction, analyse(o, crop, maxRegions), 6);
  const regions = Object.freeze(analysis.regions.map((region): ValueRegionShape => Object.freeze({ ...region, seed: componentSeed(o.seed, region.id, "region") })));
  const map: ValueRegionMap = Object.freeze({ ...analysis, regions });
  return remember(MAPS, mapKey, map, 12);
}

/** How a retained fraction picks the regions that stay: a stable draw, or a rank by an attribute. */
export type ValueRetainRule = "chance" | "largest" | "smallest" | "dark" | "light" | "enclosed" | "outer";
export const valueRetainRules: readonly ValueRetainRule[] = Object.freeze(["chance", "largest", "smallest", "dark", "light", "enclosed", "outer"] as const);

const U32 = 0x1_0000_0000;
const unit = (region: ValueRegionShape, purpose: string): number => componentSeed(region.seed, region.id, purpose) / U32;

/**
 * The regions that stay, in map order. `chance` keeps a region when its own stable draw is below `fraction`; the other rules
 * rank the regions (`largest` by polygon area, `smallest`, `dark` lowest tone first, `light` highest first, `enclosed` deepest
 * in the hierarchy first, `outer` shallowest first; ties by a stable per-region draw, then id) and keep the first
 * round(fraction x count). Raising the fraction only ever adds regions. Regions with no coverage (fully transparent) never stay.
 */
export function keptValueRegions(map: ValueRegionMap, fraction: number, by: ValueRetainRule): readonly ValueRegionShape[] {
  finite("retained", fraction, 0, 1);
  if (!valueRetainRules.includes(by)) throw new Error(`Value regions: retain rule must be one of ${valueRetainRules.join(", ")}`);
  const candidates = map.regions.filter((region) => region.coverage > 0);
  if (fraction >= 1) return Object.freeze(candidates);
  if (by === "chance") return Object.freeze(candidates.filter((region) => unit(region, "keep") < fraction));
  const key = (r: ValueRegionShape): number => by === "largest" ? -r.area : by === "smallest" ? r.area : by === "dark" ? r.tone : by === "light" ? -r.tone : by === "enclosed" ? -r.depth : r.depth;
  const ranked = candidates.slice().sort((a, b) => key(a) - key(b) || unit(a, "keep-tie") - unit(b, "keep-tie") || (a.id < b.id ? -1 : 1));
  const keep = new Set(ranked.slice(0, Math.round(fraction * ranked.length)).map((region) => region.id));
  return Object.freeze(candidates.filter((region) => keep.has(region.id)));
}
