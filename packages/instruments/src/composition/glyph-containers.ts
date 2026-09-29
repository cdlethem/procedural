import { PlanarError, domainDifference, planarDomain, textDomain, emptyDomain } from "./domains.js";
import type { PlanarDomain, PlanarRegionData } from "./domains.js";
import { offsetDomain } from "./domains-offset.js";
import { memoized } from "./sources.js";

/**
 * Containers for packing: bundled silhouettes as planar domains, placed, cut by negative space and inset by a margin.
 *
 * INPUT CONTRACT. A silhouette is a frozen `PlanarDomain` (polygons with holes, exact predicates, see
 * `docs/composition-domains.md`) in UNIT coordinates: y down, the shape filling the box [−½, ½]². The bundled
 * silhouettes are built from constants (and, for the ampersand, from the owned outline font) and never depend on
 * a seed. `placeContainer` stretches a silhouette to `width × height` canvas units, turns it by `rotation`
 * degrees about its centre and moves the centre to (`centerX`, `centerY`); any caller's domain is accepted by
 * `packingField` directly. A saved layer chooses only among `bundledContainerIds`; binding a user's own
 * silhouette (a mask from an uploaded image, `maskDomain`) is future host work.
 *
 * NEGATIVE SPACE. `negativeSpace` makes a protected region in the container's own frame (it is stretched and
 * turned with the container): a `disc` of diameter `size` (a fraction of the container's smaller side), a `band`
 * of thickness `size` (a fraction of its height) across the whole container, or a `ring` (a thin annulus
 * outline of diameter `size`), centred at (`x`, `y`) in box fractions. Nothing is placed in it.
 *
 * FIELD. `packingField` is what the packer is allowed to use: (container − negative space) grown by −`margin`
 * canvas units with round joins, exactly (the planar domain offset), so a glyph is kept `margin` from the container's
 * boundary, from its holes and from the negative space alike. It may be empty (a valid state: the margin can
 * consume a small shape). All results are cached by construction inputs, frozen and appearance-independent.
 *
 * Failure: unknown silhouette, non-finite or non-positive size, negative margin — an `Error` naming the input.
 */
export const bundledContainerIds = ["disc", "pebble", "annulus", "crescent", "star", "archipelago", "ampersand", "slab"] as const;
export type BundledContainerId = (typeof bundledContainerIds)[number];
export const bundledContainerTitles: Readonly<Record<BundledContainerId, string>> = Object.freeze({
  disc: "Disc", pebble: "Pebble", annulus: "Ring with an island hole", crescent: "Crescent", star: "Star", archipelago: "Archipelago with a lake",
  ampersand: "Ampersand", slab: "Slab with three holes",
});

type P = readonly [number, number];
const polar = (n: number, radius: (theta: number) => number, cx = 0, cy = 0, phase = 0): P[] =>
  Array.from({ length: n }, (_, i) => { const t = phase + 2 * Math.PI * i / n; const r = radius(t); return [cx + r * Math.cos(t), cy + r * Math.sin(t)] as P; });
const blob = (n: number, base: number, harmonics: readonly (readonly [number, number, number])[], cx: number, cy: number): P[] =>
  polar(n, (t) => base * (1 + harmonics.reduce((sum, [k, a, phi]) => sum + a * Math.cos(k * t + phi), 0)), cx, cy);

const silhouetteData: Readonly<Record<Exclude<BundledContainerId, "ampersand">, () => PlanarRegionData[]>> = {
  disc: () => [{ outer: polar(120, () => 0.5) }],
  pebble: () => [{ outer: blob(160, 0.43, [[2, 0.08, 0.4], [3, 0.06, 1.9], [5, 0.025, 0.7]], 0, 0) }],
  annulus: () => [{ outer: polar(120, () => 0.5), holes: [polar(72, () => 0.17, 0.11, -0.06)] }],
  crescent: () => {
    const cut = domainDifference({ outer: polar(160, () => 0.5) }, { outer: polar(160, () => 0.41, 0.19, -0.05) }, { id: "crescent" });
    return cut.regions.map((region) => ({ outer: region.outer, holes: region.holes }));
  },
  star: () => [{ outer: polar(10, (t) => Math.round((t + Math.PI / 2) / (Math.PI / 5)) % 2 === 0 ? 0.5 : 0.24, 0, 0.03, -Math.PI / 2) }],
  archipelago: () => [
    { outer: blob(120, 0.22, [[2, 0.1, 0.3], [3, 0.08, 1.1]], -0.2, -0.1), holes: [blob(48, 0.075, [[2, 0.15, 0]], -0.16, -0.08)] },
    { outer: blob(96, 0.17, [[2, 0.09, 2.0], [4, 0.05, 0.3]], 0.27, 0.2) },
    { outer: blob(72, 0.11, [[3, 0.1, 0.5]], 0.28, -0.31) },
    { outer: blob(72, 0.1, [[2, 0.12, 1.0]], -0.32, 0.33) },
  ],
  slab: () => [{ outer: [[-0.5, -0.36], [0.5, -0.36], [0.5, 0.36], [-0.5, 0.36]], holes: [polar(48, () => 0.15, -0.26, 0.02), polar(40, () => 0.1, 0.05, -0.12), polar(56, () => 0.19, 0.28, 0.06)] }],
};

const silhouettes = new Map<string, PlanarDomain>();
/** A bundled silhouette in unit coordinates, filling [−½, ½]²: frozen and cached. */
export function containerSilhouette(id: BundledContainerId): PlanarDomain {
  if (!(bundledContainerIds as readonly string[]).includes(id)) throw new Error(`Unknown container "${String(id)}"; choose one of ${bundledContainerIds.join(", ")}`);
  let hit = silhouettes.get(id);
  if (!hit) {
    hit = id === "ampersand" ? textDomain("&", { centerX: 0, centerY: 0, width: 1, height: 1, id: "container:ampersand" })
      : planarDomain(silhouetteData[id](), { id: `container:${id}` });
    silhouettes.set(id, hit);
  }
  return hit;
}

export interface ContainerPlacement {
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
  /** Degrees; positive turns clockwise on the y-down canvas (the direction canvas rotation takes). */
  readonly rotation: number;
}
function checkPlacement(placement: ContainerPlacement): void {
  for (const key of ["centerX", "centerY", "rotation"] as const) if (!Number.isFinite(placement[key])) throw new Error(`Container ${key} must be finite`);
  for (const key of ["width", "height"] as const) if (!(placement[key] > 0) || !Number.isFinite(placement[key])) throw new Error(`Container ${key} must be finite and above 0`);
}
function place(shape: PlanarDomain, placement: ContainerPlacement, id: string): PlanarDomain {
  const c = Math.cos(placement.rotation * Math.PI / 180), s = Math.sin(placement.rotation * Math.PI / 180);
  const move = ([x, y]: P): [number, number] => {
    const px = x * placement.width, py = y * placement.height;
    return [placement.centerX + c * px - s * py, placement.centerY + s * px + c * py];
  };
  return planarDomain(shape.regions.map((region) => ({ outer: region.outer.map(move), holes: region.holes.map((hole) => hole.map(move)) })), { id });
}

const placed = new Map<string, PlanarDomain>();
/** A bundled silhouette stretched, turned and moved. Cached by (silhouette, placement). */
export function placeContainer(id: BundledContainerId, placement: ContainerPlacement): PlanarDomain {
  checkPlacement(placement);
  return memoized(placed, JSON.stringify([id, placement.centerX, placement.centerY, placement.width, placement.height, placement.rotation]),
    () => place(containerSilhouette(id), placement, `container:${id}`));
}

export type NegativeKind = "none" | "disc" | "band" | "ring";
export interface NegativeSpec {
  readonly kind: NegativeKind;
  /** Diameter or thickness as a fraction of the container's smaller side (disc, ring) or its height (band). In (0, 2]. */
  readonly size: number;
  /** Centre in box fractions of the container, in its own frame; 0 is the middle. */
  readonly x: number;
  readonly y: number;
}
/** The shared empty protected region. */
export const noNegativeSpace: PlanarDomain = emptyDomain("negative:none");
const negatives = new Map<string, PlanarDomain>();
/** The protected region in canvas coordinates; the empty domain for `none`. Cached. */
export function negativeSpace(spec: NegativeSpec, placement: ContainerPlacement): PlanarDomain {
  checkPlacement(placement);
  if (spec.kind === "none") return noNegativeSpace;
  if (spec.kind !== "disc" && spec.kind !== "band" && spec.kind !== "ring") throw new Error(`Unknown negative space "${String(spec.kind)}"`);
  if (!(spec.size > 0 && spec.size <= 2) || !Number.isFinite(spec.x) || !Number.isFinite(spec.y)) throw new Error("Negative space needs a size in (0, 2] and finite x, y");
  return memoized(negatives, JSON.stringify([spec.kind, spec.size, spec.kind === "band" ? 0 : spec.x, spec.y, placement]), () => {
    // Built in unit-box coordinates of the container, so it stretches and turns with the silhouette.
    const smaller = Math.min(placement.width, placement.height);
    const rx = spec.size * smaller / placement.width / 2, ry = spec.size * smaller / placement.height / 2;
    let unit: PlanarRegionData;
    if (spec.kind === "disc") unit = { outer: polar(96, () => 1, spec.x, spec.y).map(([x, y]) => [spec.x + (x - spec.x) * rx, spec.y + (y - spec.y) * ry] as P) };
    else if (spec.kind === "ring") {
      const width = 0.16 * spec.size;
      unit = { outer: polar(96, () => 1).map(([x, y]) => [spec.x + x * rx, spec.y + y * ry] as P),
        holes: [polar(96, () => 1).map(([x, y]) => [spec.x + x * Math.max(rx - width * smaller / placement.width, 1e-6), spec.y + y * Math.max(ry - width * smaller / placement.height, 1e-6)] as P)] };
    } else {
      const half = spec.size / 2;
      unit = { outer: [[-1.5, spec.y - half], [1.5, spec.y - half], [1.5, spec.y + half], [-1.5, spec.y + half]] };
    }
    return place(planarDomain(unit, { id: `negative:${spec.kind}` }), placement, `negative:${spec.kind}`);
  });
}

export interface PackingField {
  readonly container: PlanarDomain;
  readonly negative: PlanarDomain;
  readonly margin: number;
  /** (container − negative) inset by `margin`: where a glyph may lie. */
  readonly available: PlanarDomain;
}
/**
 * `shape` grown by −`margin`. A region whose box is no wider or taller than 2·margin has no point that far from its boundary
 * (a line through any of its points meets the boundary on both sides within half the box), so it is dropped before the offset;
 * that keeps a margin larger than a small island a valid empty result rather than an oversized offset.
 */
function inset(shape: PlanarDomain, margin: number): PlanarDomain {
  const kept = shape.regions.filter((region) => Math.min(region.bounds[2] - region.bounds[0], region.bounds[3] - region.bounds[1]) > 2 * margin);
  if (kept.length === 0) return emptyDomain("available");
  try {
    return offsetDomain(kept.length === shape.regions.length ? shape : planarDomain(kept), -margin, { join: "round", id: "available" });
  } catch (error) {
    if (error instanceof PlanarError && error.code === "WORK_LIMIT") throw new Error(`Margin ${margin} is too large for this container's outline to inset; lower Margin`);
    throw error;
  }
}
const fields = new WeakMap<PlanarDomain, WeakMap<PlanarDomain, Map<number, PackingField>>>();
/** The usable field for a container, protected region and margin. Cached on the identities of the two domains. */
export function packingField(container: PlanarDomain, negative: PlanarDomain, margin: number): PackingField {
  if (!(margin >= 0) || !Number.isFinite(margin)) throw new Error("Margin must be finite and at least 0");
  let byNegative = fields.get(container);
  if (!byNegative) { byNegative = new WeakMap(); fields.set(container, byNegative); }
  let byMargin = byNegative.get(negative);
  if (!byMargin) { byMargin = new Map(); byNegative.set(negative, byMargin); }
  const hit = byMargin.get(margin);
  if (hit) return hit;
  const cut = negative.regions.length ? domainDifference(container, negative, { id: "field" }) : container;
  const available = margin > 0 ? inset(cut, margin) : cut;
  const field: PackingField = Object.freeze({ container, negative, margin, available });
  if (byMargin.size >= 8) byMargin.delete(byMargin.keys().next().value!);
  byMargin.set(margin, field);
  return field;
}
