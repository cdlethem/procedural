import { cachedBy, componentSeed } from "./core.js";
import type { Path } from "./types.js";
import { domainDifference, domainUnion, planarDomain, planarRegion, rectangleRegion, textDomain } from "./domains.js";
import type { PlanarDomain } from "./domains.js";
import { labelDomains } from "./domains-raster.js";
import { segmentValueBands } from "./image-structure.js";
import { offsetDomain } from "./domains-offset.js";
import { gridStorage } from "./raster.js";
import { bundledRaster, bundledRasterIds } from "./raster-samples.js";
import type { BundledRasterId } from "./raster-samples.js";
import { partitionRegions } from "./sources.js";

/**
 * Labelled regions for stitching. A `StitchRegion` is one thing the thread will fill: a `PlanarDomain` (outer rings and holes,
 * possibly several pieces that touch only at points) with a stable id, an index in the region order, a text label and a tone in
 * [0, 1] that later colour rules may read. Regions are deeply frozen and their domains are disjoint from each other's interiors.
 *
 * Direct API: `stitchRegionsOf(domain, ...)` turns any `PlanarDomain` (one region per connected piece) or an explicit list of
 * labelled domains into `StitchRegion`s. A saved instrument names only the bundled deterministic sources below; binding a user's
 * silhouette, glyph outlines or picture is future host work (the typed API already accepts resolved values).
 *
 * Bundled sources (`RegionSourceSpec`, all placed in the footprint `centerX, centerY, width, height`, canvas units):
 * - `letters`: the licensed outline font's `word` (1..20 printable ASCII), ink fitted uniformly into the footprint shrunk by `weight` on
 *   every side, then grown by `weight` (`offsetDomain`, round joins) so the strokes are that much bolder and still inside the footprint;
 *   touching letters merge. One region per connected glyph piece in the domain's canonical order (left to right for a word); counters
 *   are holes. Ids `letter:<k>`. Tone: the horizontal position of the piece, 0 at the left ink edge to 1 at the right.
 * - `blob`: a large lobed body with an off-centre hole and two separate islands (disconnected regions on purpose). Lobe
 *   phases and island directions come from `variant`; the outline is analytic (a 160-vertex polygon), never noise. Ids `blob:0`
 *   (body with hole), `blob:1`, `blob:2`. Tone: 0, 0.5, 1.
 * - `quilt`: the Region Quilt partition (`partitionRegions`, `patches` cuts on a 12 x 12 grid, longest-side cuts, bias -0.2, seeded
 *   by `variant`). `merge` is the fraction of patches that join a neighbouring patch across a shared edge (their exact union: an L
 *   or T shape or a larger rectangle, decided per patch by `componentSeed(variant, id, "merge")`), and `windows` the fraction of the
 *   remaining rectangles given a centred rectangular hole. Ids `region:<i>` (a joined pair `region:<i>+<j>`); tone is a per-id hash.
 * - `tones`: a bundled picture's connected value bands. `segmentValueBands` (lightness, `bands` equal bands, 4-connectivity,
 *   regions below `minRegion` pixels merged into their longest-border neighbour) of the 128-pixel picture, each region traced with
 *   `labelDomains` (exact pixel-edge boundaries, holes nested, then Douglas-Peucker simplified to 1.6 pixels so steps become
 *   diagonals without any region starting to touch another). The picture is fitted CONTAIN into the footprint. `leaveLightest`
 *   drops the regions of the lightest band (open paper). Ids `tone:<segmentation id>`; tone = 1 - mean lightness (dark = 1).
 *
 * Failure: a bad number, an unknown word or picture, or more than {@link STITCH_REGION_LIMITS.regions} regions throws naming the
 * control to change. Empty sources are errors here; a source whose regions all vanish later (an inset larger than the shapes) is
 * a valid empty drawing.
 */
export const STITCH_REGION_LIMITS = Object.freeze({ regions: 512, patches: 60, bands: 8, imagePixels: 128 });

export interface StitchRegion {
  readonly id: string;
  /** Position in the region order (the default stitching order). */
  readonly index: number;
  readonly label: string;
  readonly domain: PlanarDomain;
  /** Source-defined attribute in [0, 1] (see each source). */
  readonly tone: number;
}

export interface StitchFootprint { centerX: number; centerY: number; width: number; height: number }

export const stitchWords = ["STITCH", "THREAD", "LOOP", "QUILT"] as const;
export type StitchWord = (typeof stitchWords)[number];
export const stitchSourceKinds = ["letters", "blob", "quilt", "tones"] as const;
export type StitchSourceKind = (typeof stitchSourceKinds)[number];

export type RegionSourceSpec = StitchFootprint & (
  | { kind: "letters"; word: StitchWord; weight: number }
  | { kind: "blob"; variant: number }
  | { kind: "quilt"; variant: number; patches: number; merge: number; windows: number }
  | { kind: "tones"; image: BundledRasterId; variant: number; bands: number; minRegion: number; leaveLightest: boolean }
);

const U32 = 0x1_0000_0000;
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;

function num(name: string, value: number, min: number, max: number, integer = false): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    throw new Error(`${name} must be ${integer ? "an integer" : "a finite number"} in [${min}, ${max}]`);
}

function freezeRegion(id: string, index: number, label: string, domain: PlanarDomain, tone: number): StitchRegion {
  return Object.freeze({ id, index, label, domain, tone });
}

/** One `StitchRegion` per connected piece of the domain (canonical order), ids `<prefix>:<k>`. */
export function stitchRegionsOf(domain: PlanarDomain, options: { prefix?: string } = {}): readonly StitchRegion[] {
  const prefix = options.prefix ?? "region";
  const n = domain.regions.length;
  return Object.freeze(domain.regions.map((region, k) => freezeRegion(`${prefix}:${k}`, k, `${prefix} ${k + 1}`,
    planarDomain(region, { id: `${prefix}:${k}` }), n > 1 ? k / (n - 1) : 0)));
}

function lettersOf(spec: Extract<RegionSourceSpec, { kind: "letters" }>): readonly StitchRegion[] {
  if (!(stitchWords as readonly string[]).includes(spec.word)) throw new Error(`Word must be one of ${stitchWords.join(", ")}`);
  num("Letter weight", spec.weight, 0, 60);
  const w = spec.weight, id = `word:${spec.word}`;
  const fitted = textDomain(spec.word, { centerX: spec.centerX, centerY: spec.centerY, width: Math.max(1, spec.width - 2 * w), height: Math.max(1, spec.height - 2 * w), id });
  const text = w > 0 ? offsetDomain(fitted, w, { id }) : fitted;
  const [left, , right] = text.bounds!;
  return Object.freeze(text.regions.map((region, k) => {
    const cx = region.centroid[0];
    return freezeRegion(`letter:${k}`, k, `letter ${k + 1}`, planarDomain(region, { id: `letter:${k}` }), right > left ? (cx - left) / (right - left) : 0);
  }));
}

const BLOB_VERTICES = 160;
/** A closed lobed polygon of `r(theta) = base (1 + sum a_k cos(k theta + p_k))` about (cx, cy), scaled by (sx, sy). */
function lobed(cx: number, cy: number, sx: number, sy: number, base: number, lobes: readonly (readonly [number, number, number])[], reverse = false): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i < BLOB_VERTICES; i++) {
    const theta = (2 * Math.PI * i) / BLOB_VERTICES;
    let r = 1;
    for (const [k, a, p] of lobes) r += a * Math.cos(k * theta + p);
    ring.push([cx + Math.cos(theta) * base * r * sx, cy + Math.sin(theta) * base * r * sy]);
  }
  return reverse ? ring.reverse() : ring;
}

function blobOf(spec: Extract<RegionSourceSpec, { kind: "blob" }>): readonly StitchRegion[] {
  num("Sample variant", spec.variant, 0, 1_000_000, true);
  const phase = (purpose: string): number => unit(spec.variant, "blob", purpose) * 2 * Math.PI;
  const sx = spec.width / 2, sy = spec.height / 2, cx = spec.centerX, cy = spec.centerY;
  // The body's radius stays within 0.6 * (1 + 0.12 + 0.09 + 0.05) = 0.756 of the half-extent.
  const body = lobed(cx, cy, sx, sy, 0.6, [[2, 0.12, phase("p2")], [3, 0.09, phase("p3")], [5, 0.05, phase("p5")]]);
  const hole = lobed(cx + 0.06 * sx * Math.cos(phase("hx")), cy + 0.06 * sy * Math.sin(phase("hx")), sx, sy, 0.26, [[2, 0.14, phase("q2")], [3, 0.08, phase("q3")]], true);
  const islands = [0, 1].map((k) => {
    // Island centres sit at 0.94 of the half-extent; a radius of at most 0.14 (1 + 0.1) keeps each 0.786+ from the middle.
    const theta = phase(`island${k}`) * 0.5 + k * Math.PI + (k === 0 ? 0.35 : 0.9);
    return lobed(cx + Math.cos(theta) * 0.94 * sx, cy + Math.sin(theta) * 0.94 * sy, sx, sy, k === 0 ? 0.14 : 0.1, [[3, 0.1, phase(`i${k}`)]]);
  });
  // A body larger than the footprint's islands would overlap; the body's own extreme (0.756) plus island reach must not meet.
  const region = (id: string, outer: [number, number][], holes: [number, number][][] = []) => planarRegion({ id, outer, holes });
  const shapes = [region("blob:0", body, [hole]), region("blob:1", islands[0]), region("blob:2", islands[1])];
  return Object.freeze(shapes.map((shape, k) => freezeRegion(`blob:${k}`, k, k === 0 ? "body" : `island ${k}`, planarDomain(shape, { id: `blob:${k}` }), k / 2)));
}

function shares(a: readonly number[], b: readonly number[]): boolean {
  const overlapX = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), overlapY = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  return (a[2] === b[0] || b[2] === a[0]) && overlapY > 0 || (a[3] === b[1] || b[3] === a[1]) && overlapX > 0;
}

function quiltOf(spec: Extract<RegionSourceSpec, { kind: "quilt" }>): readonly StitchRegion[] {
  num("Sample variant", spec.variant, 0, 1_000_000, true);
  num("Patches", spec.patches, 1, STITCH_REGION_LIMITS.patches, true);
  num("Joined patches", spec.merge, 0, 1); num("Windows", spec.windows, 0, 1);
  const leaves = partitionRegions({ seed: spec.variant, width: spec.width, height: spec.height, centerX: spec.centerX, centerY: spec.centerY,
    columns: 12, rows: 12, attempts: spec.patches, axis: "LONGEST", bias: -0.2 });
  const used = new Set<number>(), pieces: { id: string; domain: PlanarDomain; tone: number }[] = [];
  leaves.forEach((leaf, i) => {
    if (used.has(i)) return;
    used.add(i);
    if (unit(spec.variant, leaf.id, "merge") < spec.merge) {
      let best = -1, bestKey = Infinity;
      leaves.forEach((other, j) => {
        if (used.has(j) || !shares(leaf.bounds, other.bounds)) return;
        const key = unit(spec.variant, `${leaf.id}|${other.id}`, "partner");
        if (key < bestKey) { bestKey = key; best = j; }
      });
      if (best >= 0) {
        used.add(best);
        const id = `${leaf.id}+${leaves[best].id.replace("region:", "")}`;
        pieces.push({ id, domain: domainUnion(rectangleRegion(leaf), rectangleRegion(leaves[best]), { id }), tone: unit(spec.variant, id, "tone") });
        return;
      }
    }
    let domain: PlanarDomain = planarDomain(rectangleRegion(leaf), { id: leaf.id });
    if (unit(spec.variant, leaf.id, "window") < spec.windows) {
      const [l, t, r, b] = leaf.bounds, fw = 0.3 + 0.2 * unit(spec.variant, leaf.id, "window-w"), fh = 0.3 + 0.2 * unit(spec.variant, leaf.id, "window-h");
      const cx = (l + r) / 2, cy = (t + b) / 2, hw = (r - l) * fw / 2, hh = (b - t) * fh / 2;
      domain = domainDifference(domain, rectangleRegion({ bounds: [cx - hw, cy - hh, cx + hw, cy + hh] }), { id: leaf.id });
    }
    pieces.push({ id: leaf.id, domain, tone: unit(spec.variant, leaf.id, "tone") });
  });
  return Object.freeze(pieces.map((piece, k) => freezeRegion(piece.id, k, `patch ${k + 1}`, piece.domain, piece.tone)));
}

function tonesOf(spec: Extract<RegionSourceSpec, { kind: "tones" }>): readonly StitchRegion[] {
  if (!(bundledRasterIds as readonly string[]).includes(spec.image)) throw new Error(`Source image must be one of ${bundledRasterIds.join(", ")}`);
  num("Sample variant", spec.variant, 0, 1_000_000, true);
  num("Bands", spec.bands, 2, STITCH_REGION_LIMITS.bands, true);
  num("Smallest region", spec.minRegion, 1, 4000, true);
  const size = STITCH_REGION_LIMITS.imagePixels;
  const raster = bundledRaster(spec.image, spec.variant, size);
  const seg = segmentValueBands(raster, { value: "lightness", bands: spec.bands, connectivity: 4, minArea: spec.minRegion });
  const kept = seg.regions.filter((region) => !(spec.leaveLightest && region.band === spec.bands - 1));
  if (kept.length > STITCH_REGION_LIMITS.regions)
    throw new Error(`These settings make ${kept.length} regions; the limit is ${STITCH_REGION_LIMITS.regions}. Raise Smallest region or use fewer bands`);
  const cell = Math.min(spec.width, spec.height) / size;
  const origin: [number, number] = [spec.centerX - (size * cell) / 2, spec.centerY - (size * cell) / 2];
  const byLabel = new Map(labelDomains({ width: size, height: size, data: gridStorage(seg.labels) }, { background: -1, cell, origin, simplify: 1.6 * cell })
    .map((item) => [item.label, item.domain] as const));
  const regions: StitchRegion[] = [];
  for (const region of kept) {
    const domain = byLabel.get(region.id);
    if (!domain || domain.regions.length === 0) continue;
    const id = `tone:${region.id}`;
    regions.push(freezeRegion(id, regions.length, `band ${region.band + 1} region ${region.id}`, planarDomain(domain.regions, { id }), 1 - region.mean));
  }
  return Object.freeze(regions);
}

const cache = new Map<string, readonly StitchRegion[]>();

/** The regions a bundled source names: cached by construction (frozen, the same object for the same spec). */
export function bundledStitchRegions(spec: RegionSourceSpec): readonly StitchRegion[] {
  if (!stitchSourceKinds.includes(spec?.kind)) throw new Error(`Region source must be one of ${stitchSourceKinds.join(", ")}`);
  num("Center X", spec.centerX, -1e5, 1e5); num("Center Y", spec.centerY, -1e5, 1e5); num("Width", spec.width, 1, 4096); num("Height", spec.height, 1, 4096);
  const key = JSON.stringify(spec);
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const regions = spec.kind === "letters" ? lettersOf(spec) : spec.kind === "blob" ? blobOf(spec) : spec.kind === "quilt" ? quiltOf(spec) : tonesOf(spec);
  cache.set(key, regions);
  if (cache.size > 8) cache.delete(cache.keys().next().value as string);
  return regions;
}

const boundaryCache = new WeakMap<object, Map<string, readonly Path[]>>();

/**
 * Every ring of every region as a closed `Path` (outer ring, then its holes, in region order), so any path material (Path Materials,
 * stitches, beads, ink) can draw the boundary of the same regions the thread fills. Ids `<region id>/ring:<k>` (k = 0 the outer ring
 * of the region's first piece, then its holes, then the next piece); the ring keeps its orientation (the region is on the left of
 * travel). Seeds are `componentSeed(seed, id, "path")`; `level` is the region index. Cached per regions array and seed; frozen.
 */
export function regionBoundaries(regions: readonly StitchRegion[], seed = 0): readonly Path[] {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Boundary seed must be a uint32 integer");
  return cachedBy(boundaryCache, regions, String(seed), () => Object.freeze(regions.flatMap((region) => {
    const rings = region.domain.regions.flatMap((piece) => [piece.outer, ...piece.holes]);
    return rings.map((ring, k): Path => {
      const id = `${region.id}/ring:${k}`;
      return Object.freeze({ id, seed: componentSeed(seed, id, "path"), points: ring, closed: true, level: region.index,
        levelFraction: regions.length > 1 ? region.index / (regions.length - 1) : 0 });
    });
  })));
}
