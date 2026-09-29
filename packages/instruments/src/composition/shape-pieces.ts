import { componentSeed } from "./core.js";
import { domainDifference, planarDomain, planarRegion, resolveShape, ringsDomain, textDomain, workFor } from "./domains.js";
import type { PlanarDomain, PlanarRegion, PlanarShape } from "./domains.js";

/**
 * Shapes and pieces for non-convex packing (brief 47). Contract and limits: docs/composition-shape-packing.md.
 *
 * A `PackShape` is a reusable outline: a `PlanarDomain` (one or several regions, holes allowed) in
 * NORMAL FORM, its area centroid at the origin and its longest bounding-box side equal to 1, y down.
 * A `PackItem` is one thing to pack: a stable id (`p<index>`), a shape and a size (canvas units of the
 * longest side of the unrotated shape). Placement never changes the shape, only the item's transform.
 *
 * Bundled families (all deterministic; chance comes from `componentSeed(seed, itemId, purpose)`, so item
 * `p7` keeps its shape and size when the count changes or other items are added):
 * - letters: the licensed outline font, one character per item (counters are holes; `i`, `j` are two
 *   regions carried rigidly);
 * - leaves: a leaf profile with a bend, a lopsided width, a sharp or blunt tip and lobed margins;
 * - blobs: a radial function with two to five harmonics, star-shaped about the centroid but strongly
 *   concave, stretched by up to 1.7;
 * - polygons: a catalogue of non-convex polygons (L, T, U, cross, star, arrow, chevron, step, comb,
 *   bolt, frame, donut, crescent), stretched per item; the frame, donut have a hole;
 * - mixed: each item draws one of the four families.
 * Caller shapes are accepted by `customShape` (any valid planar shape, resolved, never fetched).
 */

export type PieceFamily = "letters" | "leaves" | "blobs" | "polygons" | "mixed";
export const PIECE_FAMILIES: readonly PieceFamily[] = ["letters", "leaves", "blobs", "polygons", "mixed"];
export type LetterSet = "upper" | "lower" | "digits" | "mixed";
export const LETTER_SETS: Readonly<Record<LetterSet, string>> = Object.freeze({
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", lower: "abcdefghijklmnopqrstuvwxyz", digits: "0123456789",
  mixed: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
});

export interface PackShape {
  /** `letter:A`, `leaf:p3`, `polygon:comb:p9`, `custom:<id>`: stable for the same construction. */
  readonly id: string;
  readonly family: "letter" | "leaf" | "blob" | "polygon" | "custom";
  /** Normal form: centroid at the origin, longest bounding-box side 1. */
  readonly domain: PlanarDomain;
  /** Area of the domain in normal-form units (multiply by size² for canvas units). */
  readonly area: number;
  /** Half the longest side of the box around the origin: max distance from the origin to a vertex. */
  readonly radius: number;
}

export interface PackItem {
  /** `p<index>` for generated items, the caller's id for custom ones. */
  readonly id: string;
  readonly index: number;
  readonly shape: PackShape;
  /** Longest side of the unrotated shape in canvas units, > 0. */
  readonly size: number;
}

const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / 0x1_0000_0000;
const between = (u: number, lo: number, hi: number): number => lo + u * (hi - lo);

// ------------------------------------------------------------------------------ normal form

type Pt2 = [number, number];
function ringMeasure(ring: readonly Pt2[]): { area: number; cx: number; cy: number } {
  let a = 0, sx = 0, sy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const c = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += c; sx += (ring[j][0] + ring[i][0]) * c; sy += (ring[j][1] + ring[i][1]) * c;
  }
  return { area: a / 2, cx: a === 0 ? 0 : sx / (3 * a), cy: a === 0 ? 0 : sy / (3 * a) };
}

function finish(id: string, family: PackShape["family"], domain: PlanarDomain): PackShape {
  const bounds = domain.bounds!, longest = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  let radius = 0;
  for (const region of domain.regions) for (const [x, y] of region.outer) radius = Math.max(radius, Math.hypot(x, y));
  return Object.freeze({ id, family, domain, area: domain.area, radius: Math.max(radius, longest / 2) });
}

/** Scale/translate raw rings so the area centroid is the origin and the longest box side is 1 (holes are negative area). */
function normalRings(outer: readonly Pt2[], holes: readonly (readonly Pt2[])[]): { outer: Pt2[]; holes: Pt2[][] } {
  const all = [outer, ...holes], signed = all.map((r) => ringMeasure(r));
  let area = 0, mx = 0, my = 0;
  signed.forEach((m, k) => { const w = (k === 0 ? 1 : -1) * Math.abs(m.area); area += w; mx += w * m.cx; my += w * m.cy; });
  const cx = mx / area, cy = my / area;
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const [x, y] of outer) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
  const s = 1 / Math.max(r - l, b - t);
  const map = (ring: readonly Pt2[]): Pt2[] => ring.map(([x, y]): Pt2 => [(x - cx) * s, (y - cy) * s]);
  return { outer: map(outer), holes: holes.map(map) };
}

function regionShape(id: string, family: PackShape["family"], outer: readonly Pt2[], holes: readonly (readonly Pt2[])[] = []): PackShape {
  const n = normalRings(outer, holes);
  return finish(id, family, planarDomain(planarRegion({ id: `${id}/0`, outer: n.outer, holes: n.holes }), { id }));
}

/**
 * A caller's shape as a piece: any valid planar shape (a region, a domain, plain data), moved to normal form.
 * Throws `PlanarError` for invalid rings and `Error` for empty or zero-area shapes.
 */
export function customShape(id: string, shape: PlanarShape): PackShape {
  if (typeof id !== "string" || id.length === 0 || id.length > 100) throw new Error("A custom shape needs an id of 1 to 100 characters");
  const domain = resolveShape(shape, 0, workFor("customShape", undefined));
  const regions = "regions" in domain ? domain.regions : [domain];
  if (regions.length === 0 || !(domain.area > 0)) throw new Error(`Custom shape ${id} has no area`);
  return normalized(`custom:${id}`, "custom", regions);
}

/** Move regions to normal form by ring transform, resolved by nonzero fill (robust to the rounding of the scale). */
function normalized(id: string, family: PackShape["family"], regions: readonly PlanarRegion[]): PackShape {
  let area = 0, mx = 0, my = 0, l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const region of regions) {
    area += region.area; mx += region.centroid[0] * region.area; my += region.centroid[1] * region.area;
    l = Math.min(l, region.bounds[0]); t = Math.min(t, region.bounds[1]); r = Math.max(r, region.bounds[2]); b = Math.max(b, region.bounds[3]);
  }
  const cx = mx / area, cy = my / area, s = 1 / Math.max(r - l, b - t);
  const rings: Pt2[][] = [];
  for (const region of regions) for (const ring of [region.outer, ...region.holes]) rings.push(ring.map(([x, y]): Pt2 => [(x - cx) * s, (y - cy) * s]));
  return finish(id, family, ringsDomain(rings, { fill: "nonzero", id }));
}

// ------------------------------------------------------------------------------ families

const glyphCache = new Map<string, PackShape>();
function letterShape(char: string): PackShape {
  const hit = glyphCache.get(char);
  if (hit) return hit;
  const raw = textDomain(char, { centerX: 0, centerY: 0, width: 1000, height: 1000 });
  const shape = normalized(`letter:${char}`, "letter", raw.regions);
  glyphCache.set(char, shape);
  return shape;
}

function leafRings(seed: number, id: string): Pt2[] {
  const u = (purpose: string): number => unit(seed, id, purpose);
  const width = between(u("width"), 0.16, 0.34), alpha = between(u("blunt"), 0.6, 0.95), beta = between(u("full"), 0.75, 1.15);
  const lobes = [0, 0, 0, 5, 7, 9][Math.floor(u("lobes") * 6)], amplitude = lobes === 0 ? 0 : between(u("depth"), 0.06, 0.2), phase = u("phase") * Math.PI * 2;
  const bend = between(u("bend"), -0.16, 0.16), lopsided = between(u("lopsided"), -0.25, 0.25);
  const N = 36, side = (sign: number, t: number): number => {
    const profile = Math.sin(Math.PI * Math.pow(t, alpha)) ** beta;
    return width * (1 + sign * lopsided) * profile * (1 + amplitude * Math.sin(2 * Math.PI * lobes * t + phase));
  };
  const centre = (t: number): number => bend * Math.sin(Math.PI * t);
  const ring: Pt2[] = [[0, centre(0)]];
  for (let i = 1; i < N; i++) { const t = i / N; ring.push([t, centre(t) + side(1, t)]); }
  ring.push([1, centre(1)]);
  for (let i = N - 1; i >= 1; i--) { const t = i / N; ring.push([t, centre(t) - side(-1, t)]); }
  return ring;
}

function blobRing(seed: number, id: string): Pt2[] {
  const u = (purpose: string): number => unit(seed, id, purpose);
  const harmonics = [2, 3, 4, 5].map((k) => ({ k, a: u(`a${k}`) * 0.5 / k ** 0.55, phi: u(`phi${k}`) * Math.PI * 2 }));
  const stretch = between(u("stretch"), 1, 1.7), N = 72, ring: Pt2[] = [];
  for (let i = 0; i < N; i++) {
    const theta = 2 * Math.PI * i / N;
    let r = 1;
    for (const h of harmonics) r += h.a * Math.cos(h.k * theta + h.phi);
    r = Math.max(r, 0.28);
    ring.push([r * Math.cos(theta) * stretch, r * Math.sin(theta)]);
  }
  return ring;
}

const ngon = (n: number, radius: number, cx = 0, cy = 0, start = 0): Pt2[] =>
  Array.from({ length: n }, (_, i): Pt2 => [cx + radius * Math.cos(start + 2 * Math.PI * i / n), cy + radius * Math.sin(start + 2 * Math.PI * i / n)]);
const starRing = (points: number, inner: number): Pt2[] => Array.from({ length: points * 2 }, (_, i): Pt2 => {
  const r = i % 2 === 0 ? 1 : inner, a = -Math.PI / 2 + Math.PI * i / points;
  return [r * Math.cos(a), r * Math.sin(a)];
});

interface Template { readonly name: string; readonly outer: readonly Pt2[]; readonly holes?: readonly (readonly Pt2[])[] }
const TEMPLATES: readonly Template[] = Object.freeze([
  { name: "L", outer: [[0, 0], [.35, 0], [.35, .65], [1, .65], [1, 1], [0, 1]] },
  { name: "T", outer: [[0, 0], [1, 0], [1, .3], [.65, .3], [.65, 1], [.35, 1], [.35, .3], [0, .3]] },
  { name: "U", outer: [[0, 0], [.3, 0], [.3, .7], [.7, .7], [.7, 0], [1, 0], [1, 1], [0, 1]] },
  { name: "cross", outer: [[.35, 0], [.65, 0], [.65, .35], [1, .35], [1, .65], [.65, .65], [.65, 1], [.35, 1], [.35, .65], [0, .65], [0, .35], [.35, .35]] },
  { name: "star", outer: starRing(5, 0.42) },
  { name: "arrow", outer: [[0, .35], [.55, .35], [.55, 0], [1, .5], [.55, 1], [.55, .65], [0, .65]] },
  { name: "chevron", outer: [[0, 0], [.35, 0], [1, .5], [.35, 1], [0, 1], [.65, .5]] },
  { name: "step", outer: [[0, .5], [.4, .5], [.4, 0], [1, 0], [1, .5], [.6, .5], [.6, 1], [0, 1]] },
  { name: "comb", outer: [[0, 0], [1, 0], [1, 1], [.8, 1], [.8, .4], [.6, .4], [.6, 1], [.4, 1], [.4, .4], [.2, .4], [.2, 1], [0, 1]] },
  { name: "bolt", outer: [[.5, 0], [.15, .55], [.45, .55], [.3, 1], [.85, .4], [.55, .4], [.75, 0]] },
  { name: "frame", outer: [[0, 0], [1, 0], [1, 1], [0, 1]], holes: [[[.28, .28], [.28, .72], [.72, .72], [.72, .28]]] },
  { name: "donut", outer: ngon(28, 1), holes: [ngon(28, .42).reverse()] },
]);
const CRESCENT = "crescent";
const TEMPLATE_NAMES: readonly string[] = [...TEMPLATES.map((t) => t.name), CRESCENT];

const crescentCache: { region?: PlanarDomain } = {};
function crescentDomain(): PlanarDomain {
  return crescentCache.region ??= domainDifference(
    planarRegion({ id: "moon", outer: ngon(48, 1) }), planarRegion({ id: "bite", outer: ngon(48, .82, .42, -.06) }), { id: "crescent" });
}

function polygonShape(seed: number, id: string): PackShape {
  const name = TEMPLATE_NAMES[Math.floor(unit(seed, id, "template") * TEMPLATE_NAMES.length)];
  const stretch = between(unit(seed, id, "stretch"), 0.72, 1.35), shapeId = `polygon:${name}:${id}`;
  const squash = (ring: readonly Pt2[]): Pt2[] => ring.map(([x, y]): Pt2 => [x * stretch, y]);
  if (name === CRESCENT) {
    const region = crescentDomain().regions[0];
    return regionShape(shapeId, "polygon", squash(region.outer as unknown as Pt2[]));
  }
  const template = TEMPLATES.find((t) => t.name === name)!;
  return regionShape(shapeId, "polygon", squash(template.outer), (template.holes ?? []).map(squash));
}

/** The shape for one generated item. The family of a `mixed` item is fixed by its id and seed. */
export function pieceShape(family: PieceFamily, seed: number, id: string, letters: LetterSet = "upper"): PackShape {
  if (family === "mixed") {
    const pick = (["letters", "leaves", "blobs", "polygons"] as const)[Math.floor(unit(seed, id, "family") * 4)];
    return pieceShape(pick, seed, id, letters);
  }
  if (family === "letters") {
    const set = LETTER_SETS[letters];
    return letterShape(set[Math.floor(unit(seed, id, "glyph") * set.length)]);
  }
  if (family === "leaves") return regionShape(`leaf:${id}`, "leaf", leafRings(seed, id));
  if (family === "blobs") return regionShape(`blob:${id}`, "blob", blobRing(seed, id));
  return polygonShape(seed, id);
}

// ------------------------------------------------------------------------------ items

export interface PackItemsOptions {
  readonly seed: number;
  readonly family: PieceFamily;
  readonly letters?: LetterSet;
  readonly count: number;
  /** Largest and smallest item size (longest side, canvas units), 0 < min <= max. */
  readonly sizeMax: number;
  readonly sizeMin: number;
  /** Size = min·(max/min)^(u^skew) for a uniform u per item: 1 is log-uniform, larger values favour small items. */
  readonly skew: number;
}

export const PACK_ITEM_LIMITS = Object.freeze({ count: 600 });
const itemCache = new Map<string, readonly PackItem[]>();

/**
 * A generated population: `count` items `p0 … p<count-1>`. Item `p<j>` depends only on (seed, j, family, letter
 * set, size range and skew), never on the count, so a larger count extends the list. Cached, frozen.
 */
export function packItems(options: PackItemsOptions): readonly PackItem[] {
  const { seed, family, count, sizeMax, sizeMin, skew } = options, letters = options.letters ?? "upper";
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Seed must be a uint32 integer");
  if (!PIECE_FAMILIES.includes(family)) throw new Error(`Piece family must be one of ${PIECE_FAMILIES.join(", ")}`);
  if (!(letters in LETTER_SETS)) throw new Error("Letter set must be upper, lower, digits or mixed");
  if (!Number.isSafeInteger(count) || count < 0 || count > PACK_ITEM_LIMITS.count) throw new Error(`Pieces must be an integer in [0, ${PACK_ITEM_LIMITS.count}]`);
  if (!(sizeMin > 0) || !(sizeMax >= sizeMin) || !Number.isFinite(sizeMax)) throw new Error("Smallest piece must be > 0 and at most the largest piece");
  if (!(skew > 0) || !Number.isFinite(skew)) throw new Error("Small-piece bias must be > 0");
  const key = JSON.stringify([seed, family, letters, count, sizeMax, sizeMin, skew]);
  const hit = itemCache.get(key);
  if (hit) return hit;
  const items = Object.freeze(Array.from({ length: count }, (_, index): PackItem => {
    const id = `p${index}`, u = unit(seed, id, "size");
    return Object.freeze({ id, index, shape: pieceShape(family, seed, id, letters), size: sizeMin * Math.pow(sizeMax / sizeMin, Math.pow(u, skew)) });
  }));
  if (itemCache.size >= 8) itemCache.delete(itemCache.keys().next().value as string);
  itemCache.set(key, items);
  return items;
}

/** One caller item: a shape at a size. `id` must be unique in the list you pack. */
export function customItem(id: string, shape: PackShape | PlanarShape, size: number, index = 0): PackItem {
  if (!(size > 0) || !Number.isFinite(size)) throw new Error("Item size must be a finite number > 0");
  const packShape = "family" in shape && "radius" in shape ? shape as PackShape : customShape(id, shape as PlanarShape);
  return Object.freeze({ id, index, shape: packShape, size });
}

// ------------------------------------------------------------------------------ containers

export type ContainerKind = "rectangle" | "ellipse" | "ring" | "letter" | "leaf";
export const CONTAINER_KINDS: readonly ContainerKind[] = ["rectangle", "ellipse", "ring", "letter", "leaf"];
export const CONTAINER_LETTERS: readonly string[] = ["S", "R", "G", "A", "B", "8", "@"];

export interface PackContainerSpec {
  readonly kind: ContainerKind;
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
  /** Degrees, clockwise on the canvas, about the centre. */
  readonly angle: number;
  /** Ring only: inner ellipse size as a fraction of the outer one, in (0, 1). */
  readonly hole?: number;
  /** Letter only: one printable ASCII character; its ink is fitted into width × height. */
  readonly letter?: string;
}

const containerCache = new Map<string, PlanarDomain>();
/** The container as a planar domain (cached by its spec; frozen). Letters and rings carry holes, so packing respects them. */
export function packContainer(spec: PackContainerSpec): PlanarDomain {
  const { kind, centerX, centerY, width, height, angle } = spec;
  if (!CONTAINER_KINDS.includes(kind)) throw new Error(`Container must be one of ${CONTAINER_KINDS.join(", ")}`);
  for (const [name, v] of [["centerX", centerX], ["centerY", centerY], ["angle", angle]] as const) if (!Number.isFinite(v)) throw new Error(`Container ${name} must be finite`);
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) throw new Error("Container width and height must be finite and > 0");
  const hole = kind === "ring" ? spec.hole ?? 0.5 : 0, letter = kind === "letter" ? spec.letter ?? "S" : "";
  if (kind === "ring" && !(hole > 0 && hole < 1)) throw new Error("Ring hole must be in (0, 1)");
  if (kind === "letter" && !/^[\x21-\x7E]$/.test(letter)) throw new Error("Container letter must be one printable ASCII character");
  const key = JSON.stringify([kind, centerX, centerY, width, height, angle, hole, letter]);
  const hit = containerCache.get(key);
  if (hit) return hit;
  const turn = angle * Math.PI / 180, cos = Math.cos(turn), sin = Math.sin(turn);
  const place = (x: number, y: number): Pt2 => [centerX + x * cos - y * sin, centerY + x * sin + y * cos];
  const id = `container:${kind}`;
  let domain: PlanarDomain;
  const scaled = (ring: readonly Pt2[], sx: number, sy: number): Pt2[] => ring.map(([x, y]) => place(x * sx, y * sy));
  if (kind === "rectangle") domain = planarDomain(planarRegion({ id: `${id}/0`, outer: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => place(x * width / 2, y * height / 2)) }), { id });
  else if (kind === "ellipse") domain = planarDomain(planarRegion({ id: `${id}/0`, outer: scaled(ngon(120, 1), width / 2, height / 2) }), { id });
  else if (kind === "ring") domain = planarDomain(planarRegion({ id: `${id}/0`, outer: scaled(ngon(120, 1), width / 2, height / 2), holes: [scaled(ngon(120, 1), width / 2 * hole, height / 2 * hole)] }), { id });
  else if (kind === "leaf") {
    const leaf = normalRings(leafRings(0, "container-leaf"), []).outer;
    domain = planarDomain(planarRegion({ id: `${id}/0`, outer: scaled(leaf, width, height) }), { id });
  } else {
    const raw = textDomain(letter, { centerX: 0, centerY: 0, width, height });
    domain = ringsDomain(raw.regions.flatMap((region) => [region.outer, ...region.holes]).map((ring) => ring.map(([x, y]) => place(x, y))), { fill: "nonzero", id });
  }
  if (containerCache.size >= 16) containerCache.delete(containerCache.keys().next().value as string);
  containerCache.set(key, domain);
  return domain;
}
