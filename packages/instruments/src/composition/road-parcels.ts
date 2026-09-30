import { componentSeed } from "./core.js";
import { domainDifference, domainIntersection, emptyDomain, locateInDomain, planarRegion, unionDomains } from "./domains.js";
import { offsetDomain } from "./domains-offset.js";
import type { PlanarDomain, PlanarRegion, PlanarRegionData } from "./domains.js";
import type { GraphFace } from "./graph.js";
import { roadFaces } from "./road-network.js";
import type { RoadNetwork, RoadStreet } from "./road-network.js";
import { pointInRing } from "./road-growth.js";
import type { Point } from "./types.js";

/**
 * Blocks, lots and reserved space from a road network: brief 43's "face extraction → parcel subdivision".
 *
 * INPUT. A `RoadNetwork` (planar graph, streets), the hierarchy (how many of the first streets are
 * avenues and collectors; everything else is a local street; the boundary, hub and links are avenues,
 * a reserved zone's ring is a local street), road widths per class and a setback, then the lot options.
 * Only these reach the results: palette, materials, marks and line weights never do.
 *
 * BLOCKS (`roadBlocks`). `planarFaces` gives every enclosed cycle of the graph as a simple polygon; a
 * block is that polygon as a `PlanarRegion` (`region`, bounded by road centrelines) with its `land`:
 * the region minus, for every face edge, a strip of half-width `width(class)/2 + setback` (round
 * joins at reflex corners) and minus every dead-end stub inside it. Land is the exact Boolean
 * difference (`domainDifference`), so lots never reach a road's stroke. The land of a block can be
 * empty (a face thinner than its roads) or several regions (a neck), and it is a region with holes
 * whenever roads leave an island of land inside it. A face is `zone` or `hub` when every edge of its
 * boundary belongs to the reserved-zone or hub ring (it is the ring's inside, never subdivided) and
 * `built` otherwise. Faces that are not simple polygons (pinched, crossed, island) are reported by
 * `planarFaces` and are not blocks; the growth never creates them (rings are joined by links, streets
 * attach at one end at least). Ids: `block:` and 16 hex digits of a hash of the face's node cycle, so
 * the id of a block changes exactly when its boundary does.
 *
 * LOTS (`roadParcels`). Each land region is split recursively with exact half-plane Booleans. The
 * frame of a piece is its NEAREST ROAD: the face edge closest to an interior point of the piece, `u`
 * along that road, `v` away from it. A piece wider than 1.5 lot widths is cut across the road
 * (perpendicular to `u`, at 1/2 ± variety/2 of its width but leaving both halves at least 0.55 lot
 * widths); a piece deeper than 1.6 lot depths is cut parallel to the road at about one lot depth from
 * it; anything else is a leaf. A leaf is a `lot` when at least 0.3 lot widths of its boundary lie on the
 * land's outer boundary (frontage), a `court` (unbuilt interior) otherwise, and `reserved` (a sliver)
 * when its area is under a tenth of `lotWidth × lotDepth`. Blocks chosen by the unbuilt rule keep their
 * land as `reserved` parcels; zone and hub blocks are reserved parcels of their whole region. Parcels
 * tile the land exactly (one half of each cut is the intersection with a half-plane, the other the
 * difference with the same half-plane).
 *
 * PARCEL VALUES. `id` `<block id>/<land region>[:<cut path>]` (cut path letters: `0`/`1` across, `f`/`b`
 * along; `.k` when a half is several regions); `region` (a `PlanarRegion` with that id); `area`;
 * `frontage` (length on the land boundary); `frontEdge` and `frontStreet` (nearest road edge / street
 * ids) and `frontClass`; `angle` (degrees, direction of that road: the lot's frame); `age` (0 oldest to 1
 * newest street of the frontage); `type` (0…2 by `typeBy`, −1 unless a lot) and `frame` (the largest
 * rectangle turned to the road and centred in the lot that fits inside it, for rectangular fillers).
 * Types: `class` = frontage class; `size` = area rank, largest first; `center` = distance rank from the
 * focus; `age` = frontage street age; `random` = a stable draw per parcel; each in three equal bands
 * (class: one per class).
 *
 * BOUNDS AND FAILURE. At most MAX_BLOCKS faces and MAX_PARCELS parcels in total; more throws naming
 * the controls to change (Block size, Steps, Lot width, Lot depth). Nothing is thinned. No randomness
 * beyond `componentSeed(seed, id, purpose)` draws keyed by block and parcel ids.
 */
export const MAX_BLOCKS = 4000;
export const MAX_PARCELS = 12_000;
/** Fragments of land smaller than this (canvas units squared, about a thousandth of a lot) are numerical residue of a Boolean, not land. */
const NEGLIGIBLE = 0.01;
/** Half-width of the thinnest land kept, canvas units. */
const OPENING = 0.02;

export interface RoadHierarchy { readonly avenues: number; readonly collectors: number }
export interface RoadWidths { readonly avenue: number; readonly collector: number; readonly street: number }
export interface BlockOptions { readonly hierarchy: RoadHierarchy; readonly widths: RoadWidths; readonly setback: number }
export type UnbuiltRule = "random" | "largest" | "irregular" | "remote";
export type TypeRule = "class" | "size" | "center" | "age" | "random";
export interface LotOptions {
  readonly lotWidth: number;
  readonly lotDepth: number;
  readonly variety: number;
  readonly unbuiltShare: number;
  readonly unbuiltRule: UnbuiltRule;
  readonly typeBy: TypeRule;
  /** Canvas position of the focus (for `center` and `remote`). */
  readonly focus: Point;
  readonly seed: number;
}

/** 0 avenue, 1 collector, 2 local street. */
export function roadClass(street: RoadStreet, hierarchy: RoadHierarchy): 0 | 1 | 2 {
  if (street.kind === "zone") return 2;
  if (street.kind !== "route") return 0;
  return street.rank < hierarchy.avenues ? 0 : street.rank < hierarchy.avenues + hierarchy.collectors ? 1 : 2;
}
export const classWidth = (widths: RoadWidths, cls: number): number => cls === 0 ? widths.avenue : cls === 1 ? widths.collector : widths.street;

export interface RoadBlock {
  readonly id: string;
  readonly face: GraphFace;
  readonly region: PlanarRegion;
  readonly kind: "built" | "zone" | "hub";
  readonly area: number;
  readonly land: PlanarDomain;
  /** Road class of each face edge, aligned with `face.edges`. */
  readonly edgeClass: readonly number[];
  /** Newest-to-oldest age fraction of each face edge's street (0 oldest, 1 newest), aligned with `face.edges`. */
  readonly edgeAge: readonly number[];
  readonly edgeStreet: readonly string[];
  readonly centroid: Point;
}
export interface RoadBlocks {
  readonly network: RoadNetwork;
  readonly options: BlockOptions;
  readonly blocks: readonly RoadBlock[];
  /** Faces `planarFaces` rejected (not blocks). */
  readonly rejected: number;
}

export interface LotFrame { readonly center: Point; readonly angle: number; readonly width: number; readonly height: number }
export type ParcelRole = "lot" | "court" | "reserved";
export interface Parcel {
  readonly id: string;
  readonly blockId: string;
  readonly seed: number;
  readonly region: PlanarRegion;
  readonly area: number;
  readonly role: ParcelRole;
  readonly reason: "landlocked" | "sliver" | "unbuilt" | "zone" | "hub" | null;
  readonly frontage: number;
  readonly frontEdge: string | null;
  readonly frontStreet: string | null;
  readonly frontClass: number;
  readonly angle: number;
  readonly age: number;
  readonly type: number;
  readonly frame: LotFrame | null;
}
export interface RoadParcels {
  readonly blocks: RoadBlocks;
  readonly options: LotOptions;
  readonly parcels: readonly Parcel[];
  readonly lots: readonly Parcel[];
}

const U32 = 0x1_0000_0000;
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
const hex = (n: number): string => n.toString(16).padStart(8, "0");

/* ------------------------------------------------------------------------------------- blocks */

/**
 * Road strips are snapped to a lattice of GRID (a power of two) so the exact Boolean over hundreds of them sees
 * benign coordinates: arbitrary doubles at nearly collinear corners can make its splitting fail to converge. Every
 * strip is first widened by MARGIN, more than the largest snapping error (GRID / 2 in x and y), so land still keeps
 * at least the full half-width from the road.
 */
const GRID = 1 / 1024, MARGIN = 0.001;
const snapped = (v: number): number => Math.round(v / GRID) * GRID;
const snappedRing = (ring: [number, number][]): PlanarRegionData => ({ outer: ring.map(([x, y]) => [snapped(x), snapped(y)] as [number, number]) });

function octagon(x: number, y: number, r: number): PlanarRegionData {
  const R = (r + MARGIN) / Math.cos(Math.PI / 8);
  return snappedRing(Array.from({ length: 8 }, (_, i) => [x + R * Math.cos(Math.PI * (2 * i + 1) / 8), y + R * Math.sin(Math.PI * (2 * i + 1) / 8)] as [number, number]));
}
function strip(ax: number, ay: number, bx: number, by: number, half: number): PlanarRegionData {
  const h = half + MARGIN, length = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / length * h, ny = (bx - ax) / length * h;
  return snappedRing([[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]]);
}

interface Stub { readonly ax: number; readonly ay: number; readonly bx: number; readonly by: number; readonly cls: number; readonly free: Point }

function* buildBlocks(network: RoadNetwork, options: BlockOptions): Generator<void, RoadBlocks, void> {
  const { hierarchy, widths, setback } = options;
  const extraction = roadFaces(network);
  if (extraction.faces.length > MAX_BLOCKS)
    throw new Error(`The network has ${extraction.faces.length} blocks, above ${MAX_BLOCKS}; raise Block size or lower Steps`);
  const byId = new Map(network.streets.map((s) => [s.id, s] as const));
  const classOfStreet = new Map(network.streets.map((s) => [s.id, roadClass(s, hierarchy)] as const));
  const routes = Math.max(1, network.progress.streets - 1);
  const ageOf = (s: RoadStreet): number => s.kind === "route" ? s.rank / routes : 0;
  const at = new Map(network.graph.nodes.map((n) => [n.id, n.position] as const));
  const edgeById = new Map(network.graph.edges.map((e) => [e.id, e] as const));
  // Dangling roads: edges that bound no face (dead-end stubs, and streets that leave an open site edge), found by
  // removing degree-1 nodes repeatedly. They lie inside a block, so their strips are removed from its land.
  const stubs: Stub[] = [];
  {
    const degree = new Map<string, number>(), incident = new Map<string, string[]>();
    for (const edge of network.graph.edges) for (const n of [edge.from, edge.to]) {
      degree.set(n, (degree.get(n) ?? 0) + 1);
      (incident.get(n) ?? incident.set(n, []).get(n)!).push(edge.id);
    }
    const dead = new Set<string>(), queue = [...degree].filter(([, d]) => d === 1).map(([n]) => n);
    for (let head = 0; head < queue.length; head++) {
      const node = queue[head];
      if (degree.get(node) !== 1) continue;
      const id = incident.get(node)!.find((e) => !dead.has(e))!;
      dead.add(id);
      const edge = edgeById.get(id)!, other = edge.from === node ? edge.to : edge.from;
      degree.set(node, 0); degree.set(other, degree.get(other)! - 1);
      if (degree.get(other) === 1) queue.push(other);
    }
    for (const id of dead) {
      const edge = edgeById.get(id)!, a = at.get(edge.from)!, b = at.get(edge.to)!;
      stubs.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], cls: classOfStreet.get(network.edgeStreet[id])!, free: a });
    }
  }
  const blocks: RoadBlock[] = [];
  for (const face of extraction.faces) {
    const n = face.points.length;
    const id = `block:${hex(componentSeed(0, face.id, "block-a"))}${hex(componentSeed(0, face.id, "block-b"))}`;
    const region = planarRegion({ id, outer: face.points as unknown as [number, number][] });
    const streets = face.edges.map((e) => byId.get(network.edgeStreet[e])!);
    const edgeClass = streets.map((s) => classOfStreet.get(s.id)!);
    const kind = streets.every((s) => s.kind === "zone") ? "zone" : streets.every((s) => s.kind === "hub") ? "hub" : "built";
    let land: PlanarDomain;
    if (kind !== "built") land = emptyDomain(`${id}/land`);
    else {
      const half = edgeClass.map((c) => classWidth(widths, c) / 2 + setback);
      const shapes: PlanarRegionData[] = [];
      for (let i = 0; i < n; i++) {
        const a = face.points[i], b = face.points[(i + 1) % n];
        shapes.push(strip(a[0], a[1], b[0], b[1], half[i]));
        const p = face.points[(i + n - 1) % n];
        // A reflex corner (interior angle over 180°) leaves a wedge between the two strips: round it.
        // A convex corner between roads of different widths needs the wider road's round cap too, or lots reach it.
        const before = half[(i + n - 1) % n], turn = (a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0]);
        if (turn < 0 || before !== half[i]) shapes.push(octagon(a[0], a[1], Math.max(half[i], before)));
      }
      for (const stub of stubs) {
        const mx = (stub.ax + stub.bx) / 2, my = (stub.ay + stub.by) / 2;
        if (!pointInRing(face.points as unknown as [number, number][], mx, my)) continue;
        const h = classWidth(widths, stub.cls) / 2 + setback;
        shapes.push(strip(stub.ax, stub.ay, stub.bx, stub.by, h), octagon(stub.ax, stub.ay, h), octagon(stub.bx, stub.by, h));
      }
      const raw = domainDifference(region, unionDomains(shapes), { id: `${id}/land`, minArea: NEGLIGIBLE });
      // Opening (shrink then grow by OPENING, round joins: an inscribed polygon) removes needles and hairlines a few ulps wide that the union of nearly
      // collinear strips leaves at a corner; the result is a subset of the raw land, so lots still keep clear of roads.
      land = raw.regions.length === 0 ? raw
        : offsetDomain(offsetDomain(raw, -OPENING, { join: "round", id: `${id}/open` }), OPENING, { join: "round", id: `${id}/land`, minArea: NEGLIGIBLE });
    }
    blocks.push(Object.freeze({ id, face, region, kind, area: face.area, land, edgeClass: Object.freeze(edgeClass),
      edgeAge: Object.freeze(streets.map(ageOf)), edgeStreet: Object.freeze(streets.map((s) => s.id)), centroid: region.centroid }));
    yield;
  }
  const rejected = Object.values(extraction.rejected).reduce((a, b) => a + b, 0);
  return Object.freeze({ network, options, blocks: Object.freeze(blocks), rejected });
}

/* -------------------------------------------------------------------------------------- lots */

interface Segment { readonly ax: number; readonly ay: number; readonly bx: number; readonly by: number }
type Vec = readonly [number, number];

function distanceToSegment(px: number, py: number, s: Segment): [number, number, number] {
  const dx = s.bx - s.ax, dy = s.by - s.ay, l2 = dx * dx + dy * dy, t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / l2));
  const x = s.ax + t * dx, y = s.ay + t * dy;
  return [Math.hypot(px - x, py - y), x, y];
}

/** A point strictly inside the region: its centroid, or the middle of the longest scanline interval through it. */
function interiorPoint(region: PlanarRegion): Point {
  const [cx, cy] = region.centroid;
  if (locateInDomain(region, cx, cy) === "inside") return [cx, cy];
  const xs: number[] = [];
  for (const ring of [region.outer, ...region.holes]) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > cy) !== (yj > cy)) xs.push(xi + (cy - yi) / (yj - yi) * (xj - xi));
  }
  xs.sort((a, b) => a - b);
  let best = -1, at = cx;
  for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > best) { best = xs[i + 1] - xs[i]; at = (xs[i] + xs[i + 1]) / 2; }
  return [at, cy];
}

const ringSegments = (region: PlanarRegion): Segment[] => {
  const out: Segment[] = [];
  for (const ring of [region.outer, ...region.holes]) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    out.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1] });
  }
  return out;
};

/** Length of the piece's boundary that lies on the land boundary (within a small distance). */
function frontageOf(piece: PlanarRegion, land: readonly Segment[], eps: number): number {
  let total = 0;
  for (const ring of [piece.outer, ...piece.holes]) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    for (const s of land) if (distanceToSegment(a[0], a[1], s)[0] <= eps && distanceToSegment(b[0], b[1], s)[0] <= eps) { total += Math.hypot(b[0] - a[0], b[1] - a[1]); break; }
  }
  return total;
}

interface PieceFrame { readonly edge: number; readonly o: Point; readonly t: Vec; readonly n: Vec; readonly u0: number; readonly u1: number; readonly v0: number; readonly v1: number }

function pieceFrame(piece: PlanarRegion, roads: readonly Segment[]): PieceFrame {
  const [ix, iy] = interiorPoint(piece);
  let edge = 0, best = Infinity, ox = 0, oy = 0;
  roads.forEach((s, i) => { const [d, x, y] = distanceToSegment(ix, iy, s); if (d < best - 1e-12) { best = d; edge = i; ox = x; oy = y; } });
  const s = roads[edge], length = Math.hypot(s.bx - s.ax, s.by - s.ay);
  const t: Vec = [(s.bx - s.ax) / length, (s.by - s.ay) / length];
  let n: Vec = [-t[1], t[0]];
  if ((ix - ox) * n[0] + (iy - oy) * n[1] < 0) n = [t[1], -t[0]];
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, y] of piece.outer) {
    const u = (x - ox) * t[0] + (y - oy) * t[1], v = (x - ox) * n[0] + (y - oy) * n[1];
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  return { edge, o: [ox, oy], t, n, u0, u1, v0, v1 };
}

/** The half-plane `{ p : (p − through) · normal ≥ 0 }` as a large rectangle (`side` is the direction along the cut). */
function halfPlane(through: Point, normal: Vec, side: Vec, reach: number): PlanarRegionData {
  const [px, py] = through;
  return { outer: [[px - side[0] * reach, py - side[1] * reach], [px + side[0] * reach, py + side[1] * reach],
    [px + side[0] * reach + normal[0] * reach, py + side[1] * reach + normal[1] * reach], [px - side[0] * reach + normal[0] * reach, py - side[1] * reach + normal[1] * reach]] };
}

function inRect(x: number, y: number, hw: number, hh: number): boolean { return Math.abs(x) < hw - 1e-9 && Math.abs(y) < hh - 1e-9; }

/** The largest rectangle turned to `angle` that fits inside a hole-free polygon, centred on the centroid or the bounding-box centre. */
export function lotFrame(region: PlanarRegion, angle: number): LotFrame | null {
  const c = Math.cos(angle), s = Math.sin(angle);
  const local = (p: readonly number[], ox: number, oy: number): [number, number] => [(p[0] - ox) * c + (p[1] - oy) * s, -(p[0] - ox) * s + (p[1] - oy) * c];
  const [cx, cy] = region.centroid;
  const box = region.outer.map((p) => local(p, cx, cy));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of box) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  let best: LotFrame | null = null;
  for (const [mx, my] of [[0, 0], [(x0 + x1) / 2, (y0 + y1) / 2]] as const) {
    const wx = (x1 - x0), wy = (y1 - y0);
    const fits = (k: number): boolean => {
      const hw = k * wx / 2, hh = k * wy / 2;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        const x = mx + sx * hw, y = my + sy * hh;
        if (!pointInRing(box, x, y)) return false;
      }
      for (const [x, y] of box) if (inRect(x - mx, y - my, hw, hh)) return false;
      for (const hole of region.holes) for (const p of hole) { const [x, y] = local(p, cx, cy); if (inRect(x - mx, y - my, hw, hh)) return false; }
      return true;
    };
    if (!fits(0.02)) continue;
    let lo = 0.02, hi = 1;
    if (fits(1)) lo = 1; else for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
    const width = lo * wx, height = lo * wy;
    if (!best || width * height > best.width * best.height) {
      best = { center: [cx + c * mx - s * my, cy + s * mx + c * my], angle, width, height };
    }
  }
  return best;
}

interface Leaf { readonly id: string; readonly region: PlanarRegion; readonly role: ParcelRole; readonly reason: Parcel["reason"] }

function lotsOf(block: RoadBlock, options: LotOptions): Leaf[] {
  const { lotWidth, lotDepth, variety, seed } = options;
  const n = block.face.points.length;
  const roads: Segment[] = block.face.points.map((a, i) => { const b = block.face.points[(i + 1) % n]; return { ax: a[0], ay: a[1], bx: b[0], by: b[1] }; });
  const land = block.land.regions.flatMap(ringSegments);
  const eps = 1e-6 * Math.max(1, block.region.perimeter / 100);
  const minArea = 0.1 * lotWidth * lotDepth, leaves: Leaf[] = [];
  const queue: { id: string; region: PlanarRegion; depth: number }[] = block.land.regions.map((region, k) => ({ id: `${block.id}/${k}`, region, depth: 0 }));
  const separator = (id: string): string => id.includes(":") ? "" : ":";
  const finish = (id: string, region: PlanarRegion, frontage: number): void => {
    if (region.area < minArea) leaves.push({ id, region, role: "reserved", reason: "sliver" });
    else if (frontage < 0.3 * lotWidth) leaves.push({ id, region, role: "court", reason: "landlocked" });
    else leaves.push({ id, region, role: "lot", reason: null });
  };
  while (queue.length > 0) {
    const piece = queue.pop()!;
    if (leaves.length + queue.length > MAX_PARCELS) throw new Error(`Block ${block.id} alone needs more than ${MAX_PARCELS} lots; raise Lot width or Lot depth`);
    const frontage = frontageOf(piece.region, land, eps);
    if (frontage < 0.3 * lotWidth || piece.depth >= 30) { finish(piece.id, piece.region, frontage); continue; }
    const f = pieceFrame(piece.region, roads), wu = f.u1 - f.u0, wv = f.v1 - f.v0;
    let cut: { through: Point; normal: Vec; side: Vec; tags: [string, string] } | null = null;
    if (wu > 1.5 * lotWidth) {
      const lo = Math.max(0.55 * lotWidth / wu, 0.05), r = Math.min(1 - lo, Math.max(lo, 0.5 + (unit(seed, piece.id, "cut") - 0.5) * variety));
      const u = f.u0 + r * wu;
      cut = { through: [f.o[0] + f.t[0] * u, f.o[1] + f.t[1] * u], normal: f.t, side: f.n, tags: ["0", "1"] };
    } else if (wv > 1.6 * lotDepth) {
      const v = f.v0 + lotDepth * (1 + variety * 0.5 * (unit(seed, piece.id, "depth") - 0.5));
      if (f.v1 - v >= 0.4 * lotDepth) cut = { through: [f.o[0] + f.n[0] * v, f.o[1] + f.n[1] * v], normal: f.n, side: f.t, tags: ["b", "f"] };
    }
    if (!cut) { finish(piece.id, piece.region, frontage); continue; }
    const reach = 2 * Math.hypot(piece.region.bounds[2] - piece.region.bounds[0], piece.region.bounds[3] - piece.region.bounds[1]) + 1;
    const half = halfPlane(cut.through, cut.normal, cut.side, reach);
    const positive = domainIntersection(piece.region, half, { minArea: NEGLIGIBLE }).regions, negative = domainDifference(piece.region, half, { minArea: NEGLIGIBLE }).regions;
    if (positive.length === 0 || negative.length === 0) { finish(piece.id, piece.region, frontage); continue; }
    const sep = separator(piece.id);
    for (const [regions, tag] of [[positive, cut.tags[0]], [negative, cut.tags[1]]] as const)
      regions.forEach((region, k) => queue.push({ id: `${piece.id}${sep}${tag}${regions.length > 1 ? `.${k}` : ""}`, region, depth: piece.depth + 1 }));
  }
  return leaves;
}

function* buildParcels(blocks: RoadBlocks, options: LotOptions): Generator<void, RoadParcels, void> {
  const { seed } = options;
  const eligible = blocks.blocks.filter((b) => b.kind === "built" && b.land.area > 0);
  const estimate = eligible.reduce((sum, b) => sum + b.land.area, 0) / (0.5 * options.lotWidth * options.lotDepth);
  if (estimate > MAX_PARCELS) throw new Error(`These blocks would need about ${Math.ceil(estimate)} lots, above ${MAX_PARCELS}; raise Lot width or Lot depth`);
  // Blocks left unbuilt by rule: a stable ranking, ties by id.
  const unbuilt = new Set<string>();
  const count = Math.round(options.unbuiltShare * eligible.length);
  if (count > 0) {
    const score = (b: RoadBlock): number => {
      if (options.unbuiltRule === "random") return unit(seed, b.id, "unbuilt");
      if (options.unbuiltRule === "largest") return -b.area;
      if (options.unbuiltRule === "irregular") return -(b.region.perimeter * b.region.perimeter / (4 * Math.PI * b.region.area));
      return -Math.hypot(b.centroid[0] - options.focus[0], b.centroid[1] - options.focus[1]);
    };
    const ranked = eligible.map((b) => ({ b, s: score(b) })).sort((x, y) => x.s - y.s || (x.b.id < y.b.id ? -1 : 1));
    for (let i = 0; i < count; i++) unbuilt.add(ranked[i].b.id);
  }
  const drafts: { block: RoadBlock; leaf: Leaf }[] = [];
  for (const block of blocks.blocks) {
    if (block.kind !== "built") drafts.push({ block, leaf: { id: `${block.id}/0`, region: block.region, role: "reserved", reason: block.kind } });
    else if (unbuilt.has(block.id)) block.land.regions.forEach((region, k) => drafts.push({ block, leaf: { id: `${block.id}/${k}`, region, role: "reserved", reason: "unbuilt" } }));
    else for (const leaf of lotsOf(block, options)) drafts.push({ block, leaf });
    if (drafts.length > MAX_PARCELS) throw new Error(`The network has more than ${MAX_PARCELS} parcels; raise Lot width or Lot depth, or lower Steps`);
    yield;
  }
  drafts.sort((a, b) => a.leaf.id < b.leaf.id ? -1 : a.leaf.id > b.leaf.id ? 1 : 0);
  const ringSegs = new Map<string, Segment[]>();
  const parcels: Parcel[] = drafts.map(({ block, leaf }) => {
    const region = planarRegion({ id: leaf.id, outer: leaf.region.outer as unknown as [number, number][], holes: leaf.region.holes as unknown as [number, number][][] });
    const n = block.face.points.length;
    let roads = ringSegs.get(block.id);
    if (!roads) { roads = block.face.points.map((a, i) => { const b = block.face.points[(i + 1) % n]; return { ax: a[0], ay: a[1], bx: b[0], by: b[1] }; }); ringSegs.set(block.id, roads); }
    const [ix, iy] = interiorPoint(region);
    let edge = 0, best = Infinity;
    roads.forEach((s, i) => { const d = distanceToSegment(ix, iy, s)[0]; if (d < best - 1e-12) { best = d; edge = i; } });
    const s = roads[edge], angle = Math.atan2(s.by - s.ay, s.bx - s.ax);
    const land = block.land.regions.flatMap(ringSegments);
    const frontage = leaf.role === "reserved" && leaf.reason !== "sliver" ? 0 : frontageOf(region, land, 1e-6 * Math.max(1, block.region.perimeter / 100));
    return { id: leaf.id, blockId: block.id, seed: componentSeed(seed, leaf.id, "parcel"), region, area: region.area, role: leaf.role, reason: leaf.reason,
      frontage, frontEdge: block.face.edges[edge], frontStreet: block.edgeStreet[edge], frontClass: block.edgeClass[edge], angle: angle / Math.PI * 180,
      age: block.edgeAge[edge], type: -1, frame: null } satisfies Parcel;
  });
  // Types and frames for lots.
  const lots = parcels.filter((p) => p.role === "lot");
  const bands = (rank: number, total: number): number => Math.min(2, Math.floor(3 * rank / Math.max(1, total)));
  const order = (key: (p: Parcel) => number): Map<string, number> => {
    const sorted = [...lots].sort((a, b) => key(a) - key(b) || (a.id < b.id ? -1 : 1));
    return new Map(sorted.map((p, i) => [p.id, i] as const));
  };
  const rank = options.typeBy === "size" ? order((p) => -p.area)
    : options.typeBy === "center" ? order((p) => Math.hypot(p.region.centroid[0] - options.focus[0], p.region.centroid[1] - options.focus[1]))
      : options.typeBy === "age" ? order((p) => p.age) : null;
  const typed = parcels.map((p): Parcel => {
    if (p.role !== "lot") return Object.freeze(p);
    const type = options.typeBy === "class" ? p.frontClass
      : options.typeBy === "random" ? bands(Math.floor(unit(seed, p.id, "type") * lots.length), lots.length) : bands(rank!.get(p.id)!, lots.length);
    return Object.freeze({ ...p, type, frame: lotFrame(p.region, p.angle * Math.PI / 180) });
  });
  return Object.freeze({ blocks, options, parcels: Object.freeze(typed), lots: Object.freeze(typed.filter((p) => p.role === "lot")) });
}

/* ------------------------------------------------------------------------------ caches, entry */

function drain<T>(steps: Generator<void, T, void>): T {
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}
const now = (): number => performance.now();
const yieldToHost = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0));
async function drainAsync<T>(steps: Generator<void, T, void>, cancelled: () => boolean, sliceMs: number): Promise<T | null> {
  let slice = now();
  for (;;) {
    if (cancelled()) return null;
    const next = steps.next();
    if (next.done) return cancelled() ? null : next.value;
    if (now() - slice > sliceMs) { await yieldToHost(); slice = now(); }
  }
}

const blockCaches = new WeakMap<RoadNetwork, Map<string, RoadBlocks>>();
const parcelCaches = new WeakMap<RoadBlocks, Map<string, RoadParcels>>();
function remember<K extends object, V>(caches: WeakMap<K, Map<string, V>>, owner: K, key: string): { hit: V | undefined; store: (value: V) => V } {
  let map = caches.get(owner);
  if (!map) { map = new Map(); caches.set(owner, map); }
  const hit = map.get(key);
  if (hit) { map.delete(key); map.set(key, hit); }
  return { hit, store: (value) => { map!.set(key, value); if (map!.size > 4) map!.delete(map!.keys().next().value!); return value; } };
}
const blockKey = (o: BlockOptions): string => JSON.stringify([o.hierarchy.avenues, o.hierarchy.collectors, o.widths.avenue, o.widths.collector, o.widths.street, o.setback]);
const lotKey = (o: LotOptions): string => JSON.stringify([o.lotWidth, o.lotDepth, o.variety, o.unbuiltShare, o.unbuiltRule, o.typeBy, o.focus, o.seed]);

function checkBlockOptions(o: BlockOptions): void {
  for (const [name, value, max] of [["Avenues", o.hierarchy.avenues, 100_000], ["Collectors", o.hierarchy.collectors, 100_000]] as const)
    if (!Number.isInteger(value) || value < 0 || value > max) throw new Error(`${name} must be an integer from 0 to ${max}`);
  for (const [name, value] of [["Avenue width", o.widths.avenue], ["Collector width", o.widths.collector], ["Street width", o.widths.street]] as const)
    if (!Number.isFinite(value) || value < 0 || value > 200) throw new Error(`${name} must be from 0 to 200`);
  if (!Number.isFinite(o.setback) || o.setback < 0 || o.setback > 200) throw new Error("Setback must be from 0 to 200");
}
function checkLotOptions(o: LotOptions): void {
  if (!Number.isFinite(o.lotWidth) || o.lotWidth < 2 || o.lotWidth > 2000) throw new Error("Lot width must be from 2 to 2000");
  if (!Number.isFinite(o.lotDepth) || o.lotDepth < 2 || o.lotDepth > 2000) throw new Error("Lot depth must be from 2 to 2000");
  if (!Number.isFinite(o.variety) || o.variety < 0 || o.variety > 1) throw new Error("Lot variety must be from 0 to 1");
  if (!Number.isFinite(o.unbuiltShare) || o.unbuiltShare < 0 || o.unbuiltShare > 1) throw new Error("Unbuilt blocks must be from 0 to 1");
  if (!["random", "largest", "irregular", "remote"].includes(o.unbuiltRule)) throw new Error(`Unknown unbuilt rule ${String(o.unbuiltRule)}`);
  if (!["class", "size", "center", "age", "random"].includes(o.typeBy)) throw new Error(`Unknown type rule ${String(o.typeBy)}`);
  if (!Number.isSafeInteger(o.seed) || o.seed < 0 || o.seed > 0xffffffff) throw new Error("Seed must be a uint32");
}

/** Blocks of a network: frozen, cached by network identity and options. */
export function roadBlocks(network: RoadNetwork, options: BlockOptions): RoadBlocks {
  checkBlockOptions(options);
  const memo = remember(blockCaches, network, blockKey(options));
  return memo.hit ?? memo.store(drain(buildBlocks(network, options)));
}
/** Lots of blocks: frozen, cached by blocks identity and options. */
export function roadParcels(blocks: RoadBlocks, options: LotOptions): RoadParcels {
  checkLotOptions(options);
  const memo = remember(parcelCaches, blocks, lotKey(options));
  return memo.hit ?? memo.store(drain(buildParcels(blocks, options)));
}
/** Cooperative `roadBlocks`; `null` when cancelled (nothing cached). */
export async function prepareBlocks(network: RoadNetwork, options: BlockOptions, cancelled: () => boolean, sliceMs = 8): Promise<RoadBlocks | null> {
  checkBlockOptions(options);
  const memo = remember(blockCaches, network, blockKey(options));
  if (memo.hit) return memo.hit;
  const made = await drainAsync(buildBlocks(network, options), cancelled, sliceMs);
  return made ? memo.store(made) : null;
}
/** Cooperative `roadParcels`; `null` when cancelled (nothing cached). */
export async function prepareParcels(blocks: RoadBlocks, options: LotOptions, cancelled: () => boolean, sliceMs = 8): Promise<RoadParcels | null> {
  checkLotOptions(options);
  const memo = remember(parcelCaches, blocks, lotKey(options));
  if (memo.hit) return memo.hit;
  const made = await drainAsync(buildParcels(blocks, options), cancelled, sliceMs);
  return made ? memo.store(made) : null;
}
