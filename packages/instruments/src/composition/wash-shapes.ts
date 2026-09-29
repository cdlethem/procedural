import { componentSeed } from "./core.js";
import { planarDomain, rectangleRegion, ringsDomain, textDomain, unionDomains } from "./domains.js";
import type { PlanarDomain, PlanarRegion, PlanarRegionData, PlanarShape } from "./domains.js";
import { offsetDomain } from "./domains-offset.js";
import { partitionRegions } from "./sources.js";

/**
 * Bundled parent shapes for Polygon Watercolor, each a frozen, cached `PlanarDomain` fitted to a placement box. They
 * are ordinary inputs: any `PlanarShape` (a traced silhouette, `textDomain`, `maskDomain`, `rectangleDomain(partition)`) is
 * washed the same way through `{ kind: "domain" }`; persisted instruments name only the bundled kinds below. Binding a
 * user's own silhouette or type to the instrument is future host work.
 *
 * - `blob`: a star-shaped outline `r(a) = 1 + .16 cos(L a + p1) + .09 cos((L + 3) a + p2) + .07 cos(2 a + p3)` (phases from the
 *   seed, so the seed changes the outline), normalised to the box, with `holes` round reserved holes of radius about
 *   `holeSize` (fraction of the box half extent) placed by seeded rejection (fully inside, `.06` apart); failing to place one
 *   in 400 tries throws naming Holes / Hole size.
 * - `ring`: an elliptical annulus, its concentric hole `holeSize` times the outer radius.
 * - `letters`: `textDomain(word)` fitted to the box, counters are holes; rotated about the centre when `rotation` is not 0.
 * - `quilt`: the Region Quilts partition (`partitionRegions`, a 12 x 12 cut grid, `compartments - 1` longest-axis cut attempts; the grid refuses a cut
 *   that would leave less than one grid cell, so a large request yields somewhat fewer, 8 for 10 and 20 for 30) as one region each. `merge` (0 to 1) joins that share of compartments in stable-ranked pairs with an
 *   edge neighbour into L- and T-shaped regions. `layout: "gapped"` insets every compartment by `gutter / 2` (mitred). A
 *   partition is axis-aligned: `rotation` does not apply to it.
 *
 * Ids: `blob`, `ring`, `letters:<word>/<n>` (regions in canonical order), `region:<i>` or `merge:<i>+<j>/0` for a quilt. Seeds are
 * `componentSeed(seed, <kind>, <purpose>)`. Units are canvas units, angles degrees.
 */
export const washWords = ["BLOOM", "WASH", "tide", "PIGMENT"] as const;
export type WashWord = typeof washWords[number];
export const washShapes = ["blob", "ring", "letters", "quilt"] as const;
export type WashShape = typeof washShapes[number];

export interface WashPlacement { readonly centerX: number; readonly centerY: number; readonly width: number; readonly height: number; readonly rotation: number }
export type WashParent =
  | { readonly kind: "blob"; readonly lobes: number; readonly holes: number; readonly holeSize: number }
  | { readonly kind: "ring"; readonly holeSize: number }
  | { readonly kind: "letters"; readonly word: string }
  | { readonly kind: "quilt"; readonly compartments: number; readonly merge: number; readonly layout: "abutting" | "gapped"; readonly gutter: number }
  | { readonly kind: "domain"; readonly domain: PlanarShape };

const TAU = 2 * Math.PI;
const U32 = 0x1_0000_0000;
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
const num = (label: string, value: number, min: number, max: number, integer = false) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    throw new Error(`${label} must be ${integer ? "an integer" : "a number"} in [${min}, ${max}] (got ${String(value)})`);
};

const cache = new Map<string, PlanarDomain>();
const remember = (key: string, make: () => PlanarDomain): PlanarDomain => {
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const value = make();
  cache.set(key, value);
  if (cache.size > 16) cache.delete(cache.keys().next().value!);
  return value;
};

/** The unit-frame point (u, v) in the box: scaled to the half extents, rotated, translated. */
function place(p: Placement, u: number, v: number): [number, number] {
  const x = u * p.width / 2, y = v * p.height / 2;
  return [p.centerX + x * p.cos - y * p.sin, p.centerY + x * p.sin + y * p.cos];
}
interface Placement extends WashPlacement { readonly cos: number; readonly sin: number }

function blobRadius(seed: number, lobes: number): (angle: number) => number {
  const p1 = TAU * unit(seed, "blob", "phase1"), p2 = TAU * unit(seed, "blob", "phase2"), p3 = TAU * unit(seed, "blob", "phase3");
  const raw = (a: number) => 1 + 0.16 * Math.cos(lobes * a + p1) + 0.09 * Math.cos((lobes + 3) * a + p2) + 0.07 * Math.cos(2 * a + p3);
  let max = 0;
  for (let i = 0; i < 720; i++) max = Math.max(max, raw(TAU * i / 720));
  return (a) => raw(a) / max;
}

function blob(seed: number, spec: Extract<WashParent, { kind: "blob" }>, p: Placement): PlanarDomain {
  num("Lobes", spec.lobes, 1, 24, true); num("Holes", spec.holes, 0, 12, true); num("Hole size", spec.holeSize, 0.02, 0.5);
  const radius = blobRadius(seed, spec.lobes), sides = 96;
  const outer: [number, number][] = [];
  for (let i = 0; i < sides; i++) { const a = TAU * i / sides, r = radius(a); outer.push(place(p, r * Math.cos(a), r * Math.sin(a))); }
  const holes: { cx: number; cy: number; r: number }[] = [];
  for (let k = 0; k < spec.holes; k++) {
    const r = spec.holeSize * (0.75 + 0.4 * unit(seed, `hole:${k}`, "radius"));
    let placed = false;
    for (let attempt = 0; attempt < 400 && !placed; attempt++) {
      const cx = (unit(seed, `hole:${k}`, `x:${attempt}`) * 2 - 1) * 0.85, cy = (unit(seed, `hole:${k}`, `y:${attempt}`) * 2 - 1) * 0.85;
      let clear = true;
      for (let s = 0; s < 16 && clear; s++) {
        const px = cx + r * Math.cos(TAU * s / 16), py = cy + r * Math.sin(TAU * s / 16);
        clear = Math.hypot(px, py) < 0.9 * radius(Math.atan2(py, px));
      }
      if (clear && holes.every((h) => Math.hypot(h.cx - cx, h.cy - cy) > h.r + r + 0.06)) { holes.push({ cx, cy, r }); placed = true; }
    }
    if (!placed) throw new Error(`Could not place hole ${k + 1} of ${spec.holes} inside the blob; lower Holes or Hole size`);
  }
  const data: PlanarRegionData = {
    id: "blob", outer,
    holes: holes.map((h) => Array.from({ length: 24 }, (_, s) => place(p, h.cx + h.r * Math.cos(TAU * s / 24), h.cy + h.r * Math.sin(TAU * s / 24)))),
  };
  return planarDomain([data], { id: "blob" });
}

function ring(spec: Extract<WashParent, { kind: "ring" }>, p: Placement): PlanarDomain {
  num("Hole size", spec.holeSize, 0.02, 0.95);
  const sides = 96, circle = (r: number): [number, number][] => Array.from({ length: sides }, (_, i) => place(p, r * Math.cos(TAU * i / sides), r * Math.sin(TAU * i / sides)));
  return planarDomain([{ id: "ring", outer: circle(1), holes: [circle(spec.holeSize)] }], { id: "ring" });
}

function letters(spec: Extract<WashParent, { kind: "letters" }>, p: Placement): PlanarDomain {
  const domain = textDomain(spec.word, { centerX: p.centerX, centerY: p.centerY, width: p.width, height: p.height, id: `letters:${spec.word}` });
  if (p.rotation === 0) return domain;
  const rings = domain.regions.flatMap((r) => [r.outer, ...r.holes]).map((r) => r.map(([x, y]): [number, number] => {
    const dx = x - p.centerX, dy = y - p.centerY;
    return [p.centerX + dx * p.cos - dy * p.sin, p.centerY + dx * p.sin + dy * p.cos];
  }));
  return ringsDomain(rings, { fill: "nonzero", id: `letters:${spec.word}` });
}

const GRID = 12;
function quilt(seed: number, spec: Extract<WashParent, { kind: "quilt" }>, p: Placement): PlanarDomain {
  num("Compartments", spec.compartments, 1, 150, true); num("Merged", spec.merge, 0, 1); num("Gutter", spec.gutter, 0, 200);
  const cells = partitionRegions({ seed: componentSeed(seed, "quilt", "partition"), width: p.width, height: p.height, centerX: p.centerX, centerY: p.centerY,
    columns: GRID, rows: GRID, attempts: spec.compartments - 1, axis: "LONGEST", bias: 0 });
  const touching = (a: PlanarRegion, b: PlanarRegion) => {
    const [al, at, ar, ab] = a.bounds, [bl, bt, br, bb] = b.bounds;
    return ((ar === bl || br === al) && Math.min(ab, bb) > Math.max(at, bt)) || ((ab === bt || bb === at) && Math.min(ar, br) > Math.max(al, bl));
  };
  const rects = cells.map((c) => rectangleRegion(c));
  const order = cells.map((c, i) => ({ i, draw: unit(c.seed, c.id, "merge") })).sort((a, b) => a.draw - b.draw || a.i - b.i).map((e) => e.i);
  const pairs = Math.floor(spec.merge * cells.length / 2), used = new Set<number>(), items: { id: string; region: PlanarRegion }[] = [];
  let merged = 0;
  for (const i of order) {
    if (merged >= pairs || used.has(i)) continue;
    const j = rects.findIndex((r, index) => index !== i && !used.has(index) && touching(rects[i], r));
    if (j < 0) continue;
    used.add(i); used.add(j); merged++;
    const [lo, hi] = i < j ? [i, j] : [j, i];
    items.push({ id: `merge:${lo}+${hi}`, region: unionDomains([rects[lo], rects[hi]]).regions[0] });
  }
  rects.forEach((region, i) => { if (!used.has(i)) items.push({ id: region.id, region }); });
  const data: PlanarRegionData[] = [];
  for (const { id, region } of items) {
    if (spec.layout !== "gapped" || spec.gutter === 0) { data.push({ id, outer: region.outer, holes: region.holes }); continue; }
    const inset = offsetDomain(region, -spec.gutter / 2, { join: "miter" });
    if (inset.regions.length === 0) throw new Error(`Gutter ${spec.gutter} is wider than compartment ${id}; lower Gutter or Compartments`);
    inset.regions.forEach((q, k) => data.push({ id: inset.regions.length > 1 ? `${id}.${k}` : id, outer: q.outer, holes: q.holes }));
  }
  data.sort((x, y) => (x.id! < y.id! ? -1 : 1));
  return planarDomain(data, { id: "quilt" });
}

/** The parent domain of a bundled spec, seed and box: frozen, and the same object for the same construction. */
export function washParentDomain(spec: WashParent, placement: WashPlacement, seed: number): PlanarDomain {
  if (spec.kind === "domain") return planarDomain(spec.domain, { id: "wash" });
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Seed must be a uint32 integer");
  num("Center X", placement.centerX, -1e5, 1e5); num("Center Y", placement.centerY, -1e5, 1e5);
  num("Width", placement.width, 4, 1e5); num("Height", placement.height, 4, 1e5); num("Rotation", placement.rotation, -1e5, 1e5);
  const angle = placement.rotation * Math.PI / 180;
  const p: Placement = { ...placement, cos: Math.cos(angle), sin: Math.sin(angle) };
  const rotated = spec.kind === "quilt" ? { ...placement, rotation: 0 } : placement;
  const key = JSON.stringify([spec, rotated, spec.kind === "blob" || spec.kind === "quilt" ? seed : 0]);
  return remember(key, () => {
    switch (spec.kind) {
      case "blob": return blob(seed, spec, p);
      case "ring": return ring(spec, p);
      case "letters": return letters(spec, p);
      case "quilt": return quilt(seed, spec, { ...p, rotation: 0, cos: 1, sin: 0 });
    }
  });
}
