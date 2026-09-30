import { componentSeed } from "./core.js";
import { IDENTITY, MAX_HYPERBOLIC_X0, along, apply, conformal, frameOf, mirrorAddress, mul, rotation, toDisk, toOrigin, triangleGroup } from "./hyperbolic-geometry.js";
import type { DiskFrame, Mat3, TriangleGroup, Vec3 } from "./hyperbolic-geometry.js";
import { memoized } from "./sources.js";
import type { Path, Point, Site } from "./types.js";

/**
 * Regular hyperbolic tilings {p,q} in the Poincare disk: cells, shared edges, vertices and adjacency.
 *
 * Producer. `hyperbolicTiling(options)` grows the tiling outward from a chosen centre by exact reflection
 * (module `hyperbolic-geometry.ts` states the model and numeric policy) and returns a deeply frozen,
 * construction-cached `HyperbolicTiling`. Cells are `Site`s at their centres, `edges` are deduplicated
 * geodesic arcs, `vertices` are `Site`s. `hyperbolicEdgePaths` and `hyperbolicCellPaths` publish the arcs
 * and cell outlines as `Path`s for `strokeWith`; the frame and ring producers in `hyperbolic-frames.ts`
 * read the same tiling.
 *
 * Input. `{p,q}` must satisfy (p-2)(q-2) > 4 (otherwise the tiling is Euclidean or spherical and this
 * throws naming both controls). `center` places the disk centre on a cell centre, a vertex or an edge
 * midpoint, which fixes the symmetry about it (p-fold, q-fold or 2-fold). `radius`, `centerX` and `centerY`
 * are canvas units: the unit disk has canvas radius `radius`. `rotation` is degrees, clockwise on the
 * canvas; at 0 the cell vertex on the base axis points up.
 *
 * Cutoffs, all declared and all applied per cell, never per pixel of work:
 *  - `generations`: a cell's generation is its edge-adjacency distance from the central cell set (the one
 *    cell, the q cells around the central vertex, or the two cells sharing the central edge) measured
 *    inside the kept region. Growth stops after this many rings.
 *  - `diskRadius`: a cell is kept only when every vertex lies within this Euclidean radius of the disk
 *    (0..1, the disk radius being 1). Near the boundary cells shrink like 1 - |z|, so this alone bounds
 *    the tiling only through the two limits below.
 *  - `minSize`: a cell is kept only when its canvas diameter (twice the largest distance of a vertex from
 *    the vertices' centroid) is at least this. This is the pixel-small stop: growth beyond it costs nothing.
 *  - `MAX_HYPERBOLIC_TILES`: more kept cells than this is an error naming the three controls above;
 *    the tiling is never silently truncated.
 * The published region is the dual-connected component of the central cells inside these tests. A cell that
 * passes them but is only reachable through cells that fail is not published.
 *
 * Identity. Cell ids are `cell:<word>`, vertices `vertex:<word>`, edges `edge:<word>`, where `<word>` is the
 * mirror address (`hyperbolic-geometry.ts`) of the cell centre, vertex or edge midpoint in the canonical
 * frame (cell centre at the origin). They depend on {p,q} alone, never on `center`, `rotation`, generations,
 * disk radius, minimum size, placement or appearance, so raising any cutoff keeps every existing id.
 * Seeds are `componentSeed(seed, id, purpose)`; the tiling geometry never depends on the seed.
 *
 * Frames. A cell is a `Site` at its centre: `angle` points toward the cell's base vertex, `scale` is the
 * disk's conformal factor 1 - |z|^2 at the centre (1 at the disk centre), so a mark of size s drawn there
 * has size s times that factor, the hyperbolic scaling. `transform` maps the canonical cell (centre at the
 * origin, base vertex on +x) to this cell, view included, as a 3x3 Lorentz matrix.
 *
 * Ownership. Results are frozen and cached by construction (never by appearance) in a small least-recently
 * used cache, and the seed-free geometry is shared between seeds. Consumers must not mutate them.
 *
 * Failure. Invalid {p,q}, out-of-domain numbers, `x0` beyond the exactness limit, and budgets throw with the
 * offending control named. An empty tiling (no central cell passes the tests) is a valid result.
 */
export type HyperbolicCenter = "polygon" | "vertex" | "edge";

export interface HyperbolicOptions {
  /** uint32; names each element's chance stream and nothing else. */
  seed: number;
  p: number;
  q: number;
  center: HyperbolicCenter;
  generations: number;
  /** Euclidean crop radius in disk units, in (0, 1). */
  diskRadius: number;
  /** Smallest kept cell, canvas units. */
  minSize: number;
  centerX: number;
  centerY: number;
  /** Canvas radius of the unit disk. */
  radius: number;
  /** Degrees, clockwise on the canvas. */
  rotation: number;
}

export interface HyperbolicTile extends Site {
  readonly generation: number;
  /** Mirror lines between the centre and the disk-centre cell: the length of the centre's address. */
  readonly distance: number;
  /** Disk radius (0..1) of the cell centre. */
  readonly diskRadius: number;
  /** Canvas diameter of the cell (see `minSize`). */
  readonly size: number;
  /** Symmetry sector of the centre about the disk centre, 0 .. sectors-1; 0 at the centre itself. */
  readonly sector: number;
  /** Vertex ids in positive winding order, edge k joining vertex k and k+1. */
  readonly vertices: readonly string[];
  readonly edges: readonly string[];
  /** Kept neighbour across each edge, or null at the region's boundary. */
  readonly neighbors: readonly (string | null)[];
  /** Outline in canvas units, geodesic arcs sampled to `EDGE_TOLERANCE`; no repeated end point. */
  readonly points: readonly Point[];
  /** Canonical cell to this cell, row-major 3x3 hyperboloid isometry (orientation preserving). */
  readonly transform: readonly number[];
}

export interface HyperbolicVertex extends Site {
  /** Kept cells meeting here. */
  readonly valence: number;
  /** True when all q cells are kept, so the vertex is surrounded. */
  readonly interior: boolean;
  readonly tiles: readonly string[];
  /** Lowest generation among the kept cells meeting here. */
  readonly generation: number;
  readonly diskRadius: number;
}

export interface HyperbolicEdge {
  readonly id: string;
  readonly seed: number;
  readonly a: string;
  readonly b: string;
  /** Geodesic arc from vertex a to vertex b, canvas units. */
  readonly points: readonly Point[];
  /** Kept cells on either side; null when the other side is not kept. */
  readonly tiles: readonly [string, string | null];
  /** Lowest generation of the cells it borders. */
  readonly generation: number;
  readonly diskRadius: number;
}

export interface HyperbolicTiling {
  readonly p: number;
  readonly q: number;
  readonly center: HyperbolicCenter;
  /** Order of the rotational symmetry about the disk centre: p, q or 2. */
  readonly sectors: number;
  /** Hyperbolic circumradius, inradius and edge length, and the area of one cell. */
  readonly circumradius: number;
  readonly inradius: number;
  readonly edgeLength: number;
  readonly cellArea: number;
  /** Canvas length of one hyperbolic edge at the disk centre (`radius * edgeLength / 2`): `scale` 1 is that many units. */
  readonly edgeSize: number;
  /** Where the unit disk sits on the canvas. */
  readonly placement: { readonly centerX: number; readonly centerY: number; readonly radius: number };
  /** Kept cells per generation. */
  readonly layers: readonly number[];
  /** Cell candidates tested, kept or not: the work measure behind the limit. */
  readonly candidates: number;
  readonly tiles: readonly HyperbolicTile[];
  readonly vertices: readonly HyperbolicVertex[];
  readonly edges: readonly HyperbolicEdge[];
  /** The view isometry (centre choice and rotation) applied to the canonical tiling. */
  readonly view: readonly number[];
}

/** Largest kept cell count; beyond it construction throws. */
export const MAX_HYPERBOLIC_TILES = 20_000;
export const MAX_HYPERBOLIC_GENERATIONS = 40;
/** Largest allowed deviation, canvas units, of a sampled arc from the true geodesic. */
export const EDGE_TOLERANCE = 0.08;
export const MAX_EDGE_SEGMENTS = 96;
/** Largest Euclidean disk radius accepted: x0 = 2e4 there, a factor 100 below `MAX_HYPERBOLIC_X0`, which leaves room for the centre offset. */
export const MAX_DISK_RADIUS = 0.9999;

function check(label: string, value: number, min: number, max: number, integer = false): void {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    throw new Error(`${label} must be ${integer ? "an integer" : "a number"} in [${min}, ${max}], got ${value}`);
}

function validate(o: HyperbolicOptions): TriangleGroup {
  if (!Number.isSafeInteger(o.seed) || o.seed < 0 || o.seed > 0xffffffff) throw new Error("Tiling seed must be a uint32 integer");
  check("Polygon sides", o.p, 3, 24, true);
  check("Cells at a vertex", o.q, 3, 24, true);
  const group = triangleGroup(o.p, o.q);
  if (!["polygon", "vertex", "edge"].includes(o.center)) throw new Error(`Unknown centre: ${o.center}`);
  check("Generations", o.generations, 0, MAX_HYPERBOLIC_GENERATIONS, true);
  check("Disk radius", o.diskRadius, 0.001, MAX_DISK_RADIUS);
  check("Smallest cell", o.minSize, 0.05, 1e4);
  check("Center X", o.centerX, -1e5, 1e5);
  check("Center Y", o.centerY, -1e5, 1e5);
  check("Radius", o.radius, 1, 1e5);
  check("Rotation", o.rotation, -3600, 3600);
  return group;
}

const freezePoint = (x: number, y: number): Point => Object.freeze([x, y] as const);

/**
 * Canvas polyline of a curve of view-frame hyperboloid points `at(t)`, t in [0, 1], subdivided adaptively: a
 * parameter interval is split until the curve's middle is within 0.6 `EDGE_TOLERANCE` of its chord (measured from the
 * chord line, not its midpoint: the hyperbolic middle of a straight edge is off-centre), so a circular arc stays within
 * `EDGE_TOLERANCE`. At most `MAX_EDGE_SEGMENTS` segments; an arc that would need more is left at that resolution.
 */
export function curvePolyline(at: (t: number) => Vec3, o: { centerX: number; centerY: number; radius: number }): Point[] {
  const canvas = (t: number): Point => { const [u, v] = toDisk(at(t)); return freezePoint(o.centerX + o.radius * u, o.centerY + o.radius * v); };
  const deviation = (a: Point, m: Point, b: Point): number => {
    const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return chord === 0 ? Math.hypot(m[0] - a[0], m[1] - a[1]) : Math.abs((b[0] - a[0]) * (a[1] - m[1]) - (a[0] - m[0]) * (b[1] - a[1])) / chord;
  };
  const start = canvas(0), end = canvas(1);
  const points: Point[] = [start];
  // Depth-first from the left keeps the output in order.
  const stack: { t0: number; t1: number; a: Point; b: Point; depth: number }[] = [{ t0: 0, t1: 1, a: start, b: end, depth: 0 }];
  let segments = 1;
  while (stack.length) {
    const { t0, t1, a, b, depth } = stack.pop()!;
    const tm = (t0 + t1) / 2, m = canvas(tm);
    if (segments < MAX_EDGE_SEGMENTS && depth < 12 && deviation(a, m, b) > 0.6 * EDGE_TOLERANCE) {
      segments++;
      stack.push({ t0: tm, t1, a: m, b, depth: depth + 1 }, { t0, t1: tm, a, b: m, depth: depth + 1 });
    } else points.push(b);
  }
  return points;
}

/** Canvas polyline of the geodesic from a to b (view-frame hyperboloid points). */
export function geodesicPolyline(a: Vec3, b: Vec3, o: { centerX: number; centerY: number; radius: number }): Point[] {
  return curvePolyline((t) => along(a, b, t), o);
}

/** Raw arrays shared by every seed. */
interface Core {
  readonly group: TriangleGroup;
  readonly view: Mat3;
  readonly sectors: number;
  readonly tiles: readonly CoreTile[];
  readonly vertices: readonly CoreVertex[];
  readonly edges: readonly CoreEdge[];
  readonly layers: readonly number[];
  readonly candidates: number;
}
interface CoreTile {
  id: string; generation: number; distance: number; canonical: Mat3; transform: Mat3; frame: DiskFrame;
  diskRadius: number; size: number; sector: number; vertices: string[]; edges: string[]; points: Point[]; neighbors: (string | null)[];
}
interface CoreVertex { id: string; position: Point; scale: number; tiles: string[]; generation: number; diskRadius: number }
interface CoreEdge { id: string; a: string; b: string; points: Point[]; tiles: [string, string | null]; generation: number; diskRadius: number }

const coreCache = new Map<string, Core>();
const tilingCache = new Map<string, HyperbolicTiling>();

function build(o: HyperbolicOptions, group: TriangleGroup): Core {
  const { p, q } = group;
  // Addresses are computed in the canonical frame, whose origin is the view centre moved by `offset`; the
  // exactness limit applies to the farthest kept vertex there.
  const offset = o.center === "polygon" ? 0 : o.center === "vertex" ? group.circumradius : group.inradius;
  const safe = Math.tanh((Math.acosh(MAX_HYPERBOLIC_X0) - offset) / 2);
  if (o.diskRadius > safe)
    throw new Error(`Disk radius ${o.diskRadius} is beyond the exact-addressing limit ${safe.toFixed(6)} for {${p},${q}} centred on a ${o.center === "polygon" ? "cell" : o.center === "vertex" ? "vertex" : "edge"}. Lower Disk radius`);
  const centreMap = o.center === "polygon" ? IDENTITY : o.center === "vertex" ? toOrigin(group.V) : toOrigin(group.cellMidpoints[0]);
  const turnView = -Math.PI / 2 + o.rotation * Math.PI / 180;
  const view = mul(rotation(turnView), centreMap);
  const sectors = o.center === "polygon" ? p : o.center === "vertex" ? q : 2;
  const [s0, , s2] = group.mirrors;
  // Reflection across cell edge 0, followed by the cell's own mirror through the base vertex: orientation preserving,
  // and the same neighbouring cell. Cell k's neighbour is canonical * turns[k] * this.
  const across = mul(s0, s2);
  const seeds: Mat3[] = [];
  if (o.center === "polygon") seeds.push(IDENTITY);
  else if (o.center === "vertex") {
    let g: Mat3 = IDENTITY;
    for (let k = 0; k < q; k++) { seeds.push(g); g = mul(g, across); }
  } else seeds.push(IDENTITY, across);

  const known = new Map<string, CoreTile>();
  const order: CoreTile[] = [];
  const layers: number[] = [];
  let candidates = 0;

  const admit = (g: Mat3, generation: number): void => {
    candidates++;
    const centre = apply(g, group.O);
    if (centre[0] > MAX_HYPERBOLIC_X0) return;
    // A cell passes when every vertex is inside the crop and it is large enough.
    const transform = mul(view, g);
    const zs = group.cellVertices.map((v) => toDisk(apply(transform, v)));
    let mx = 0, my = 0, maxR2 = 0;
    for (const [x, y] of zs) { mx += x; my += y; maxR2 = Math.max(maxR2, x * x + y * y); }
    if (!(Math.sqrt(maxR2) <= o.diskRadius)) return;
    mx /= p; my /= p;
    let far = 0;
    for (const [x, y] of zs) far = Math.max(far, Math.hypot(x - mx, y - my));
    const size = 2 * o.radius * far;
    if (!(size >= o.minSize)) return;
    const address = mirrorAddress(group, centre);
    const id = `cell:${address.word}`;
    if (known.has(id)) return;
    if (order.length >= MAX_HYPERBOLIC_TILES)
      throw new Error(`The tiling would hold more than ${MAX_HYPERBOLIC_TILES} cells. Raise Smallest cell, lower Disk radius or lower Generations`);
    const frame = frameOf(transform, group.O);
    const radius = Math.hypot(frame.z[0], frame.z[1]);
    const rel = (((Math.atan2(frame.z[1], frame.z[0]) - turnView - Math.PI / (2 * sectors)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const tile: CoreTile = { id, generation, distance: address.word.length, canonical: g, transform, frame, diskRadius: radius, size,
      sector: radius < 1e-9 ? 0 : Math.min(sectors - 1, Math.floor(rel / (2 * Math.PI / sectors))),
      vertices: [], edges: [], points: [], neighbors: [] };
    known.set(id, tile);
    order.push(tile);
    layers[generation] = (layers[generation] ?? 0) + 1;
  };

  for (const g of seeds) admit(g, 0);
  // Breadth-first: `order` grows while it is walked and generations never decrease along it.
  const neighbours = group.turns.map((turn) => mul(turn, across));
  for (let index = 0; index < order.length; index++) {
    const tile = order[index];
    if (tile.generation >= o.generations) continue;
    for (let k = 0; k < p; k++) admit(mul(tile.canonical, neighbours[k]), tile.generation + 1);
  }
  for (let g = 0; g < layers.length; g++) layers[g] ??= 0;

  // Vertices and edges, identified by the address of the vertex or edge midpoint in the canonical frame.
  const vertexMap = new Map<string, CoreVertex>();
  const edgeMap = new Map<string, CoreEdge>();
  const vertexView = new Map<string, Vec3>();
  const place = { centerX: o.centerX, centerY: o.centerY, radius: o.radius };
  for (const tile of order) {
    const corners: string[] = [];
    for (let k = 0; k < p; k++) {
      const id = `vertex:${mirrorAddress(group, apply(tile.canonical, group.cellVertices[k])).word}`;
      corners.push(id);
      const x = apply(tile.transform, group.cellVertices[k]);
      let vertex = vertexMap.get(id);
      if (!vertex) {
        const [u, v] = toDisk(x);
        vertex = { id, position: freezePoint(o.centerX + o.radius * u, o.centerY + o.radius * v), scale: conformal(x), tiles: [], generation: tile.generation, diskRadius: Math.hypot(u, v) };
        vertexMap.set(id, vertex);
        vertexView.set(id, x);
      }
      vertex.tiles.push(tile.id);
      vertex.generation = Math.min(vertex.generation, tile.generation);
    }
    tile.vertices = corners;
    for (let k = 0; k < p; k++) {
      const id = `edge:${mirrorAddress(group, apply(tile.canonical, group.cellMidpoints[k])).word}`;
      tile.edges.push(id);
      const a = corners[k], b = corners[(k + 1) % p];
      let edge = edgeMap.get(id);
      if (!edge) {
        const xa = vertexView.get(a)!, xb = vertexView.get(b)!;
        const points = geodesicPolyline(xa, xb, place);
        const mid = toDisk(along(xa, xb, 0.5));
        edge = { id, a, b, points, tiles: [tile.id, null], generation: tile.generation, diskRadius: Math.hypot(mid[0], mid[1]) };
        edgeMap.set(id, edge);
      } else {
        edge.tiles[1] = tile.id;
        edge.generation = Math.min(edge.generation, tile.generation);
      }
    }
  }
  for (const tile of order) {
    for (let k = 0; k < p; k++) {
      const edge = edgeMap.get(tile.edges[k])!;
      tile.neighbors.push(edge.tiles[0] === tile.id ? edge.tiles[1] : edge.tiles[0]);
      const forward = edge.a === tile.vertices[k];
      const arc = forward ? edge.points : [...edge.points].reverse();
      for (let i = 0; i < arc.length - 1; i++) tile.points.push(arc[i]);
    }
  }
  return { group, view, sectors, tiles: order, vertices: [...vertexMap.values()], edges: [...edgeMap.values()], layers, candidates };
}

function assemble(core: Core, o: HyperbolicOptions): HyperbolicTiling {
  const { group } = core;
  const frozenLayers = Object.freeze([...core.layers]);
  const tiles = core.tiles.map((t): HyperbolicTile => Object.freeze({
    id: t.id, seed: componentSeed(o.seed, t.id, "cell"),
    position: freezePoint(o.centerX + o.radius * t.frame.z[0], o.centerY + o.radius * t.frame.z[1]),
    angle: t.frame.angle, scale: t.frame.kappa, generation: t.generation, distance: t.distance, diskRadius: t.diskRadius, size: t.size, sector: t.sector,
    vertices: Object.freeze(t.vertices), edges: Object.freeze(t.edges), neighbors: Object.freeze(t.neighbors),
    points: Object.freeze(t.points), transform: Object.freeze(t.transform),
  }));
  const vertices = core.vertices.map((v): HyperbolicVertex => Object.freeze({
    id: v.id, seed: componentSeed(o.seed, v.id, "vertex"), position: v.position, angle: 0, scale: v.scale,
    valence: v.tiles.length, interior: v.tiles.length === group.q, tiles: Object.freeze(v.tiles), generation: v.generation, diskRadius: v.diskRadius,
  }));
  const edges = core.edges.map((e): HyperbolicEdge => Object.freeze({
    id: e.id, seed: componentSeed(o.seed, e.id, "edge"), a: e.a, b: e.b, points: Object.freeze(e.points),
    tiles: Object.freeze([e.tiles[0], e.tiles[1]] as const), generation: e.generation, diskRadius: e.diskRadius,
  }));
  return Object.freeze({
    p: group.p, q: group.q, center: o.center, sectors: core.sectors,
    circumradius: group.circumradius, inradius: group.inradius, edgeLength: group.edgeLength, cellArea: group.cellArea,
    edgeSize: o.radius * group.edgeLength / 2, placement: Object.freeze({ centerX: o.centerX, centerY: o.centerY, radius: o.radius }),
    layers: frozenLayers, candidates: core.candidates,
    tiles: Object.freeze(tiles), vertices: Object.freeze(vertices), edges: Object.freeze(edges), view: Object.freeze([...core.view]),
  });
}

/** See the module header. Cached by construction; seed-free geometry is shared between seeds. */
export function hyperbolicTiling(options: HyperbolicOptions): HyperbolicTiling {
  const group = validate(options);
  const { seed, ...construction } = options;
  const coreKey = JSON.stringify(construction);
  return memoized(tilingCache, `${seed}|${coreKey}`, () => assemble(memoized(coreCache, coreKey, () => build(options, group)), options));
}

const pathCache = new WeakMap<HyperbolicTiling, Map<string, readonly Path[]>>();
function cachedPaths(tiling: HyperbolicTiling, key: string, make: () => readonly Path[]): readonly Path[] {
  let byKey = pathCache.get(tiling);
  if (!byKey) pathCache.set(tiling, byKey = new Map());
  let hit = byKey.get(key);
  if (!hit) {
    hit = Object.freeze(make());
    byKey.set(key, hit);
    if (byKey.size > 6) byKey.delete(byKey.keys().next().value!);
  }
  return hit;
}
const deepest = (tiling: HyperbolicTiling): number => Math.max(1, tiling.layers.length - 1);

/** Every shared edge once as an open path from `a` to `b`; `level` is the lower generation of its two cells. */
export function hyperbolicEdgePaths(tiling: HyperbolicTiling): readonly Path[] {
  return cachedPaths(tiling, "edges", () => tiling.edges.map((e): Path => Object.freeze({
    id: e.id, seed: e.seed, points: e.points, closed: false, level: e.generation, levelFraction: e.generation / deepest(tiling) })));
}

/**
 * Each cell as a closed path. `inset` in [0, 1) shrinks the cell toward its centre by that fraction of the
 * centre-to-vertex hyperbolic distance (a smaller, similar geodesic polygon, so a gap that follows the
 * conformal factor); 0 is the cell outline itself.
 */
export function hyperbolicCellPaths(tiling: HyperbolicTiling, inset = 0): readonly Path[] {
  if (!(inset >= 0 && inset < 1)) throw new Error(`Inset must be in [0, 1), got ${inset}`);
  const group = triangleGroup(tiling.p, tiling.q);
  return cachedPaths(tiling, `cells:${inset}`, () => tiling.tiles.map((t): Path => {
    let points: readonly Point[] = t.points;
    if (inset > 0) {
      const corners = group.cellVertices.map((v) => apply(t.transform, along(group.O, v, 1 - inset)));
      const ring: Point[] = [];
      for (let k = 0; k < tiling.p; k++) ring.push(...geodesicPolyline(corners[k], corners[(k + 1) % tiling.p], tiling.placement).slice(0, -1));
      points = ring;
    }
    return Object.freeze({ id: t.id, seed: t.seed, points, closed: true, level: t.generation, levelFraction: t.generation / deepest(tiling) });
  }));
}

const retainCache = new WeakMap<HyperbolicTiling, Map<string, HyperbolicTiling>>();

/**
 * The tiling restricted to the cells for which `keep` holds, as a tiling in its own right: vertices, edges and
 * neighbours are recomputed from the remaining cells (an edge next to a dropped cell is a boundary edge of the
 * rest, a vertex with no cell left disappears), every id and generation is unchanged, and consumers of the
 * result need no special case. `key` names the predicate for caching and must determine it. Omitted cells
 * leave bare paper; this is how a chance retention becomes negative space.
 */
export function retainCells(tiling: HyperbolicTiling, key: string, keep: (tile: HyperbolicTile) => boolean): HyperbolicTiling {
  let byKey = retainCache.get(tiling);
  if (!byKey) retainCache.set(tiling, byKey = new Map());
  const hit = byKey.get(key);
  if (hit) return hit;
  const kept = new Set<string>();
  for (const tile of tiling.tiles) if (keep(tile)) kept.add(tile.id);
  const tiles = tiling.tiles.filter((tile) => kept.has(tile.id)).map((tile) =>
    Object.freeze({ ...tile, neighbors: Object.freeze(tile.neighbors.map((id) => (id !== null && kept.has(id) ? id : null))) }));
  const vertices = tiling.vertices.flatMap((v) => {
    const around = v.tiles.filter((id) => kept.has(id));
    return around.length === 0 ? [] : [Object.freeze({ ...v, tiles: Object.freeze(around), valence: around.length, interior: around.length === tiling.q })];
  });
  const generation = new Map(tiles.map((tile) => [tile.id, tile.generation]));
  const edges = tiling.edges.flatMap((e) => {
    const sides = e.tiles.filter((id): id is string => id !== null && kept.has(id));
    if (sides.length === 0) return [];
    return [Object.freeze({ ...e, tiles: Object.freeze([sides[0], sides[1] ?? null] as const), generation: Math.min(...sides.map((id) => generation.get(id)!)) })];
  });
  const layers: number[] = [];
  for (const tile of tiles) layers[tile.generation] = (layers[tile.generation] ?? 0) + 1;
  for (let g = 0; g < layers.length; g++) layers[g] ??= 0;
  const result: HyperbolicTiling = Object.freeze({ ...tiling, layers: Object.freeze(layers), tiles: Object.freeze(tiles), vertices: Object.freeze(vertices), edges: Object.freeze(edges) });
  byKey.set(key, result);
  if (byKey.size > 4) byKey.delete(byKey.keys().next().value!);
  return result;
}
