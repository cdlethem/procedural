import { textOutlines } from "../adapters/image-signal-instruments.js";
import { PLANAR_LIMITS, domainDifference, domainIntersection, ringsDomain, type PlanarDomain } from "./domains.js";
import { edgeIndex, locateIndexed } from "./domains-index.js";
import { clipPath } from "./domains-paths.js";
import type { Point } from "./types.js";

/**
 * Bounded support for optical plates: a footprint (rectangle or ellipse) optionally intersected
 * with a mask that is a supplied closed-path set, a set of rectangular regions, or type outlines.
 *
 * Inputs (all canvas units): `FootprintSpec`; `MaskSpec` with `source` `paths` (closed rings,
 * implicit closure), `regions` (anything with `bounds: [left, top, right, bottom]`, e.g. the
 * frozen `partitionRegions` output; `inset` shrinks each rectangle on every side) or `text`
 * (1–20 printable ASCII characters in the licensed font, scaled uniformly to fit the stated box
 * and centered in it). The mask fill rule is NONZERO winding, as for the font outlines: holes
 * (letter counters) are rings of opposite winding; overlapping regions of one orientation
 * union. `invert` keeps the footprint area outside the mask.
 *
 * Output: a deeply frozen `Support` (its rings, bounds, vertex count and `domain`) and two
 * operations, `supportContains` (points) and `clipToSupport` (polylines). The stencil is a planar
 * domain (footprint ∩ mask, or footprint minus mask when inverted, resolved by nonzero fill in
 * domains.ts), so both operations are the exact closed-set location and path clipping of
 * `docs/composition-domains.md`: a boundary is inside, and a line that runs along an edge is
 * kept whole. Ellipses are inscribed polygons flattened to `flatness` (see patterns.ts).
 *
 * Failure: invalid geometry, empty masks, non-finite numbers and work above `MAX_CLIP_WORK`
 * (segments × boundary edges) throw; nothing is thinned. No randomness.
 */
export const MAX_CLIP_WORK = 60_000_000;
const MAX_RINGS = 4_000;
const MAX_MASK_VERTICES = 60_000;

export type Ring = readonly Point[];
export interface FootprintSpec {
  shape: "rectangle" | "ellipse";
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}
export type MaskSource =
  | { kind: "paths"; rings: readonly Ring[] }
  | { kind: "regions"; regions: readonly { readonly bounds: readonly [number, number, number, number] }[]; inset: number }
  | { kind: "text"; text: string; centerX: number; centerY: number; width: number; height: number };
export interface MaskSpec { source: MaskSource; invert: boolean }
export interface SupportSpec { footprint: FootprintSpec; mask?: MaskSpec }

export interface Support {
  readonly footprint: Ring;
  readonly mask: { readonly rings: readonly Ring[]; readonly invert: boolean } | null;
  /** World-space [left, top, right, bottom] of the footprint. */
  readonly bounds: readonly [number, number, number, number];
  /** Total boundary edges of the footprint and mask: the per-segment cost bound of clipping. */
  readonly edges: number;
  /** The stencil as a planar domain: the footprint, intersected with the mask (or minus it when inverted). */
  readonly domain: PlanarDomain;
}

function finite(label: string, value: number, min: number, max: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}
const freezePoint = (x: number, y: number): Point => Object.freeze([x, y] as const);
const freezeRing = (points: Point[]): Ring => Object.freeze(points);

function footprintRing(spec: FootprintSpec, flatness: number): Ring {
  finite("Footprint center x", spec.centerX, -1e5, 1e5); finite("Footprint center y", spec.centerY, -1e5, 1e5);
  finite("Footprint width", spec.width, 1, 1e5); finite("Footprint height", spec.height, 1, 1e5);
  const hw = spec.width / 2, hh = spec.height / 2, { centerX: cx, centerY: cy } = spec;
  if (spec.shape === "rectangle")
    return freezeRing([freezePoint(cx - hw, cy - hh), freezePoint(cx + hw, cy - hh), freezePoint(cx + hw, cy + hh), freezePoint(cx - hw, cy + hh)]);
  if (spec.shape !== "ellipse") throw new Error("Footprint shape must be rectangle or ellipse");
  // Inscribed polygon, sagitta of the larger semi-axis ≤ flatness.
  const big = Math.max(hw, hh), n = Math.max(24, big <= flatness ? 24 : Math.ceil(Math.PI / Math.acos(1 - flatness / big)));
  const points: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = 2 * Math.PI * i / n;
    points.push(freezePoint(cx + hw * Math.cos(a), cy + hh * Math.sin(a)));
  }
  return freezeRing(points);
}

function pathRings(rings: readonly Ring[]): Ring[] {
  if (rings.length === 0 || rings.length > MAX_RINGS) throw new Error(`A mask needs 1–${MAX_RINGS} closed paths`);
  let vertices = 0;
  const out: Ring[] = [];
  for (const ring of rings) {
    const points: Point[] = [];
    for (const point of ring) {
      finite("Mask x", point[0], -1e5, 1e5); finite("Mask y", point[1], -1e5, 1e5);
      const last = points[points.length - 1];
      if (!last || last[0] !== point[0] || last[1] !== point[1]) points.push(freezePoint(point[0], point[1]));
    }
    // A path that repeats its first point closes itself.
    if (points.length > 1 && points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1]) points.pop();
    if (points.length < 3) throw new Error("Every mask path needs at least three distinct points");
    vertices += points.length;
    if (vertices > MAX_MASK_VERTICES) throw new Error(`Mask has more than ${MAX_MASK_VERTICES} vertices`);
    out.push(freezeRing(points));
  }
  return out;
}

function maskRings(source: MaskSource): Ring[] {
  if (source.kind === "paths") return pathRings(source.rings);
  if (source.kind === "regions") {
    finite("Region inset", source.inset, 0, 1e4);
    const rings: Ring[] = [];
    for (const { bounds: [l, t, r, b] } of source.regions) {
      const inset = source.inset;
      if (r - l <= 2 * inset || b - t <= 2 * inset) continue;
      rings.push(freezeRing([freezePoint(l + inset, t + inset), freezePoint(r - inset, t + inset), freezePoint(r - inset, b - inset), freezePoint(l + inset, b - inset)]));
    }
    // Zero rectangles is a valid, empty mask: nothing (or, inverted, everything) is inside.
    return rings.length ? pathRings(rings) : [];
  }
  if (source.kind === "text") {
    finite("Text center x", source.centerX, -1e5, 1e5); finite("Text center y", source.centerY, -1e5, 1e5);
    finite("Text width", source.width, 1, 1e5); finite("Text height", source.height, 1, 1e5);
    const contours = textOutlines(source.text);
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const contour of contours) for (const [x, y] of contour) {
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (!(right > left && bottom > top)) throw new Error("Mask text has no outlines");
    const scale = Math.min(source.width / (right - left), source.height / (bottom - top));
    const mx = (left + right) / 2, my = (top + bottom) / 2;
    return pathRings(contours.map((contour) => contour.map(([x, y]): Point =>
      [source.centerX + (x - mx) * scale, source.centerY + (y - my) * scale])));
  }
  throw new Error(`Unknown mask source: ${String((source as { kind?: unknown }).kind)}`);
}

/** Resolve a descriptor to frozen rings; `flatness` bounds the ellipse's chord deviation. */
export function resolveSupport(spec: SupportSpec, flatness: number): Support {
  finite("Flatness", flatness, 0.001, 10);
  const footprint = footprintRing(spec.footprint, flatness);
  const rings = spec.mask ? maskRings(spec.mask.source) : null;
  let edges = footprint.length;
  if (rings) for (const ring of rings) edges += ring.length;
  const { centerX, centerY, width, height } = spec.footprint;
  const footprintDomain = ringsDomain([footprint as unknown as [number, number][]], { fill: "nonzero", id: "footprint" });
  const domain = rings
    ? (spec.mask!.invert ? domainDifference : domainIntersection)(footprintDomain, ringsDomain(rings as unknown as [number, number][][], { fill: "nonzero", id: "mask" }), { id: "support" })
    : footprintDomain;
  return Object.freeze({
    footprint, mask: rings ? Object.freeze({ rings: Object.freeze(rings), invert: spec.mask!.invert }) : null,
    bounds: Object.freeze([centerX - width / 2, centerY - height / 2, centerX + width / 2, centerY + height / 2] as const),
    edges, domain,
  });
}

/** Is the point in the stencil? The stencil is the closed set `support.domain`: boundary points are inside. */
export function supportContains(support: Support, x: number, y: number): boolean {
  return locateIndexed(edgeIndex(support.domain), x, y) >= 0;
}

export interface ClippedPolyline {
  /** True only when a closed input lies entirely inside and is returned as one closed path. */
  readonly closed: boolean;
  readonly pieces: readonly (readonly Point[])[];
}

/**
 * Keep the parts of a polyline inside the support: `clipPath` against `support.domain` (see
 * domains-paths.ts for the cut and joining rules). A closed ring cut by the boundary comes back as
 * open pieces, joined across its start vertex when both ends are inside. `budget` accumulates the
 * per-segment cost bound `segments × support.edges` and throws above `MAX_CLIP_WORK`.
 */
export function clipToSupport(points: readonly Point[], closed: boolean, support: Support, budget?: { work: number }): ClippedPolyline {
  const segments = (closed ? points.length : points.length - 1);
  if (budget) {
    budget.work += Math.max(0, segments) * support.edges;
    if (budget.work > MAX_CLIP_WORK) throw new Error(`Support clipping needs ${budget.work} segment-edge tests; limit ${MAX_CLIP_WORK}. Simplify the mask or coarsen the pattern.`);
  }
  const distinct = new Set(points.map((p) => `${p[0]},${p[1]}`)).size;
  if (distinct < (closed ? 3 : 2)) return { closed: false, pieces: [] };
  const pieces = clipPath(points as readonly (readonly [number, number])[], support.domain, { closed, maxWork: PLANAR_LIMITS.maxWorkCeiling });
  return { closed: pieces.length === 1 && pieces[0].closed, pieces: pieces.map((piece) => piece.points) };
}
