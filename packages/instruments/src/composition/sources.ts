import { assembleSegmentChains2D, gradientNoise2D01 } from "@procedurals/javascript";
import { contourReliefContours, contourReliefDefinitions, validateContourRelief } from "../adapters/contour-relief.js";
import { poissonPoints, placementPackingInstrumentDefinitions } from "../adapters/placement-packing-instruments.js";
import { panelLeaves, regionFacetInstrumentDefinitions } from "../adapters/region-facet-instruments.js";
import { componentSeed } from "./core.js";
import type { CellTreeOptions, ContourOptions, GridOptions, LatticeOptions, LatticeSite, PartitionOptions, Path,
  PoissonOptions, Region, RegionTreeNode, Site, WallpaperGroup, WallpaperOptions } from "./types.js";

const siteCache = new Map<string, readonly Site[]>();
const pathCache = new Map<string, readonly Path[]>();
const regionCache = new Map<string, readonly Region[]>();

export function memoized<T>(cache: Map<string, T>, key: string, make: () => T): T {
  const hit = cache.get(key);
  if (hit !== undefined) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const value = make();
  cache.set(key, value);
  if (cache.size > 6) cache.delete(cache.keys().next().value!);
  return value;
}

function sourceSeed(seed: number): number {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Source seed must be a uint32 integer");
  return seed;
}

/** The old placement adapter owns sampling and support filtering; only construction enters the key. */
export function poissonSites(options: PoissonOptions): readonly Site[] {
  const { seed, width, height, centerX, centerY, separation, maxPoints, support, opening, rotation } = options;
  sourceSeed(seed);
  const q = { ...placementPackingInstrumentDefinitions[0].defaults, radius: separation,
    footprintWidth: width, footprintHeight: height, centerX, centerY, maxPoints,
    support, innerRadius: opening, orientation: rotation };
  return memoized(siteCache, JSON.stringify([seed, width, height, centerX, centerY, separation, maxPoints, support, opening, rotation]), () =>
    Object.freeze(poissonPoints(q, seed).map(([x, y], index): Site => Object.freeze({
      id: `site:${index}`, seed: componentSeed(seed, `site:${index}`, "site"),
      position: Object.freeze([x, y] as const), angle: 0, scale: 1,
    }))));
}

/** Split only at real junctions; each component then satisfies the simple-chain contract. */
function contourEdgeGroups(segments: number[][]): { segments: number[][][]; sourceIndices: number[] }[] {
  const pairs = segments.map(([x1, y1, x2, y2]) => [[x1, y1], [x2, y2]]);
  const incident = new Map<string, number[]>();
  let branching = false;
  for (let edge = 0; edge < pairs.length; edge++) for (const [x, y] of pairs[edge]) {
    const key = `${x},${y}`, edges = incident.get(key);
    if (edges) { edges.push(edge); if (edges.length > 2) branching = true; }
    else incident.set(key, [edge]);
  }
  if (!branching) return [{ segments: pairs, sourceIndices: pairs.map((_, index) => index) }];
  const parent = Int32Array.from(pairs, (_, index) => index), rank = new Uint8Array(pairs.length);
  const find = (edge: number): number => {
    while (parent[edge] !== edge) { parent[edge] = parent[parent[edge]]; edge = parent[edge]; }
    return edge;
  };
  for (const edges of incident.values()) if (edges.length === 2) {
    let a = find(edges[0]), b = find(edges[1]);
    if (a === b) continue;
    if (rank[a] < rank[b]) [a, b] = [b, a];
    parent[b] = a;
    if (rank[a] === rank[b]) rank[a]++;
  }
  const groups = new Map<number, { segments: number[][][]; sourceIndices: number[] }>();
  for (let edge = 0; edge < pairs.length; edge++) {
    const root = find(edge);
    let group = groups.get(root);
    if (!group) { group = { segments: [], sourceIndices: [] }; groups.set(root, group); }
    group.segments.push(pairs[edge]); group.sourceIndices.push(edge);
  }
  return [...groups.values()];
}

/** Chains retain the contour level and closure; marching-square edges remain exactly shared. */
export function contourPaths(options: ContourOptions): readonly Path[] {
  const { seed, source, width, height, centerX, centerY, resolution, frequency, aspect,
    hillCount, hillRadius, levelBase, levelStep, levels, rotation } = options;
  sourceSeed(seed);
  const q = { ...contourReliefDefinitions[0].defaults, source, width, height, centerX, centerY,
    columns: resolution, rows: resolution, frequency, aspect, hillCount, hillRadius,
    levelBase, levelStep, levelCount: levels };
  const key = JSON.stringify([seed, source, width, height, centerX, centerY, resolution, frequency,
    aspect, hillCount, hillRadius, levelBase, levelStep, levels, rotation]);
  // Rotation is part of this source's frame, not a material parameter.
  return memoized(pathCache, key, () => {
    if (!Number.isFinite(rotation) || rotation < -3600 || rotation > 3600)
      throw new Error("Contour rotation must be finite degrees within [-3600,3600]");
    if (levels === 0) {
      // The sampled producer requires at least one level; a zero-level composition is empty,
      // but every construction input still passes its usual linked-budget validation.
      validateContourRelief({ ...q, levelCount: 1 });
      return Object.freeze([]);
    }
    const contours = contourReliefContours({ technique: "contour-relief", seed, params: q, palette: [], cutEdits: [] });
    const angle = rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const paths: Path[] = [];
    let chainWork = 0;
    for (let levelIndex = 0; levelIndex < contours.length; levelIndex++) {
      const { level, segments } = contours[levelIndex];
      // The chain assembler has a quadratic preflight: bound each level and their total
      // before allocating segment pairs or chain geometry.
      if (segments.length > 2200) throw new Error("Contour chain assembly work limit exceeded");
      chainWork += 8 * segments.length ** 2 + 4 * segments.length;
      if (chainWork > 80_000_000) throw new Error("Contour chain assembly work limit exceeded");
      for (const group of contourEdgeGroups(segments)) {
        const chains = assembleSegmentChains2D({ segments: group.segments, maxWork: chainWork }).chains;
        for (const chain of chains) {
          const id = `level:${levelIndex}:segment:${group.sourceIndices[chain.segmentIndices[0]]}`;
          paths.push(Object.freeze({
            id, seed: componentSeed(seed, id, "path"), level, closed: chain.closed,
            levelFraction: levels > 1 ? levelIndex / (levels - 1) : 0,
            points: Object.freeze(chain.points.map(([x, y]) => Object.freeze([
              centerX + x * c - y * s, centerY + x * s + y * c,
            ] as const))),
          }));
        }
      }
    }
    return Object.freeze(paths);
  });
}

/** Existing binary partition and bias policy determine the entire immutable region population. */
export function partitionRegions(options: PartitionOptions): readonly Region[] {
  const { seed, width, height, centerX, centerY, columns, rows, attempts, axis, bias } = options;
  sourceSeed(seed);
  const q = { ...regionFacetInstrumentDefinitions[1].defaults, width, height, centerX, centerY,
    columns, rows, attempts, axis, cutBias: bias, retention: 1 };
  return memoized(regionCache, JSON.stringify([seed, width, height, centerX, centerY, columns, rows, attempts, axis, bias]), () =>
    Object.freeze(panelLeaves(q, seed).map((leaf, index): Region => {
      const id = `region:${index}`;
      return Object.freeze({ id, seed: componentSeed(seed, id, "region"),
        bounds: Object.freeze(leaf.bounds) });
    })));
}

const U32 = 0x1_0000_0000;
function unit(seed: number, id: string, purpose: string): number {
  return componentSeed(seed, id, purpose) / U32;
}
function finite(label: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}

type WallpaperOp = readonly [rotation: number, mirror: boolean, tx: number, ty: number];
type Lattice = "rect" | "centered" | "square" | "hex";
const TAU = 2 * Math.PI;
/**
 * Each group is its lattice family plus generators (rotation, mirror across the x-axis before
 * rotating, translation in lattice-basis fractions). The full operation set is the closure of the
 * generators modulo the lattice, so a table cannot silently omit elements.
 */
const wallpaperGenerators: Record<WallpaperGroup, { lattice: Lattice; generators: readonly WallpaperOp[] }> = {
  p1: { lattice: "rect", generators: [] },
  p2: { lattice: "rect", generators: [[Math.PI, false, 0, 0]] },
  pm: { lattice: "rect", generators: [[0, true, 0, 0]] },
  pg: { lattice: "rect", generators: [[0, true, .5, 0]] },
  cm: { lattice: "centered", generators: [[0, true, 0, 0]] },
  pmm: { lattice: "rect", generators: [[0, true, 0, 0], [Math.PI, true, 0, 0]] },
  pmg: { lattice: "rect", generators: [[Math.PI, false, 0, 0], [0, true, .5, 0]] },
  pgg: { lattice: "rect", generators: [[Math.PI, false, 0, 0], [Math.PI, true, .5, .5]] },
  cmm: { lattice: "centered", generators: [[0, true, 0, 0], [Math.PI, true, 0, 0]] },
  p4: { lattice: "square", generators: [[Math.PI / 2, false, 0, 0]] },
  p4m: { lattice: "square", generators: [[Math.PI / 2, false, 0, 0], [0, true, 0, 0]] },
  p4g: { lattice: "square", generators: [[Math.PI / 2, false, 0, 0], [Math.PI, true, .5, .5]] },
  p3: { lattice: "hex", generators: [[TAU / 3, false, 0, 0]] },
  p3m1: { lattice: "hex", generators: [[TAU / 3, false, 0, 0], [0, true, 0, 0]] },
  p31m: { lattice: "hex", generators: [[TAU / 3, false, 0, 0], [TAU / 6, true, 0, 0]] },
  p6: { lattice: "hex", generators: [[TAU / 6, false, 0, 0]] },
  p6m: { lattice: "hex", generators: [[TAU / 6, false, 0, 0], [0, true, 0, 0]] },
};
/** Lattice vectors for cell width w and height h; square and hexagonal cells use one edge length. */
function cellVectors(lattice: Lattice, w: number, h: number): readonly [number, number, number, number] {
  switch (lattice) {
    case "rect": return [w, 0, 0, h];
    case "centered": return [w, 0, w / 2, h / 2];
    case "square": return [w, 0, 0, w];
    case "hex": return [w, 0, w / 2, w * Math.sqrt(3) / 2];
  }
}
/** True when the group's lattice is fixed by one edge length (cell height has no effect). */
export function wallpaperUsesCellHeight(group: WallpaperGroup): boolean {
  const { lattice } = wallpaperGenerators[group];
  return lattice === "rect" || lattice === "centered";
}
type Affine = readonly [a: number, b: number, c: number, d: number, tx: number, ty: number];
const wallpaperOperationCache = new Map<WallpaperGroup, readonly WallpaperOp[]>();
/** Every distinct operation of the group modulo its lattice, identity first, in stable order. */
export function wallpaperOperations(group: WallpaperGroup): readonly WallpaperOp[] {
  const cached = wallpaperOperationCache.get(group);
  if (cached) return cached;
  const spec = wallpaperGenerators[group];
  if (!spec) throw new Error(`Unsupported wallpaper group: ${String(group)}`);
  const [ax, ay, bx, by] = cellVectors(spec.lattice, 1, 1);
  const det = ax * by - ay * bx;
  const toAffine = ([theta, mirror, u, v]: WallpaperOp): Affine => {
    const s = mirror ? -1 : 1, c = Math.cos(theta), n = Math.sin(theta);
    return [c, -s * n, n, s * c, u * ax + v * bx, u * ay + v * by];
  };
  const compose = (p: Affine, q: Affine): Affine => [
    p[0] * q[0] + p[1] * q[2], p[0] * q[1] + p[1] * q[3], p[2] * q[0] + p[3] * q[2], p[2] * q[1] + p[3] * q[3],
    p[0] * q[4] + p[1] * q[5] + p[4], p[2] * q[4] + p[3] * q[5] + p[5],
  ];
  const clean = (value: number) => Math.round(value * 1e6) / 1e6 + 0;
  const reduce = (p: Affine): Affine => {
    const u = (p[4] * by - p[5] * bx) / det, v = (ax * p[5] - ay * p[4]) / det;
    const fu = u - Math.floor(u + 1e-9), fv = v - Math.floor(v + 1e-9);
    return [clean(p[0]), clean(p[1]), clean(p[2]), clean(p[3]), fu * ax + fv * bx, fu * ay + fv * by];
  };
  const key = (p: Affine): string => {
    const u = (p[4] * by - p[5] * bx) / det, v = (ax * p[5] - ay * p[4]) / det;
    return [p[0], p[1], p[2], p[3], clean(u), clean(v)].map(clean).join(",");
  };
  const generators = spec.generators.map(toAffine);
  const found = new Map<string, Affine>();
  const identity = reduce([1, 0, 0, 1, 0, 0]);
  found.set(key(identity), identity);
  for (let changed = true; changed;) {
    changed = false;
    for (const element of [...found.values()]) for (const generator of generators) {
      const next = reduce(compose(generator, element));
      if (!found.has(key(next))) {
        found.set(key(next), next); changed = true;
        if (found.size > 48) throw new Error(`Wallpaper group ${group} did not close`);
      }
    }
  }
  const ops = [...found.values()].map((p): WallpaperOp => {
    const mirror = p[0] * p[3] - p[1] * p[2] < 0;
    const theta = ((Math.atan2(p[2], p[0]) % TAU) + TAU) % TAU;
    const u = (p[4] * by - p[5] * bx) / det, v = (ax * p[5] - ay * p[4]) / det;
    return [clean(theta), mirror, clean(u), clean(v)];
  }).sort((p, q) => Number(p[1]) - Number(q[1]) || p[0] - q[0] || p[2] - q[2] || p[3] - q[3]);
  const frozen = Object.freeze(ops.map((op) => Object.freeze(op) as WallpaperOp));
  wallpaperOperationCache.set(group, frozen);
  return frozen;
}

const WALLPAPER_INSTANCE_LIMIT = 6000;
/** Instance transforms for the stated group; exact duplicate images are removed by fingerprint. */
export function wallpaperSites(options: WallpaperOptions): readonly Site[] {
  const { seed, group, cellWidth, cellHeight, centerX, centerY, width, height, motifOffsetX, motifOffsetY, margin, breakAmount, breakDensity } = options;
  sourceSeed(seed);
  finite("Wallpaper cell width", cellWidth, 4, 4096);
  finite("Wallpaper cell height", cellHeight, 4, 4096);
  finite("Wallpaper width", width, 1, 4096);
  finite("Wallpaper height", height, 1, 4096);
  finite("Wallpaper motif offset X", motifOffsetX, 0, 1);
  finite("Wallpaper motif offset Y", motifOffsetY, 0, 1);
  finite("Wallpaper margin", margin, 0, 512);
  finite("Wallpaper break amount", breakAmount, 0, 1);
  finite("Wallpaper break density", breakDensity, 0, 1);
  const spec = wallpaperGenerators[group];
  if (!spec) throw new Error(`Unsupported wallpaper group: ${String(group)}`);
  const key = JSON.stringify([seed, group, cellWidth, wallpaperUsesCellHeight(group) ? cellHeight : 0, centerX, centerY, width, height, motifOffsetX, motifOffsetY, margin, breakAmount, breakDensity]);
  return memoized(wallpaperCache, key, () => {
    const ops = wallpaperOperations(group);
    const [ax, ay, bx, by] = cellVectors(spec.lattice, cellWidth, cellHeight);
    const det = Math.abs(ax * by - ay * bx);
    const halfW = width / 2 + margin, halfH = height / 2 + margin;
    if ((halfW * 2) * (halfH * 2) / det * ops.length > WALLPAPER_INSTANCE_LIMIT)
      throw new Error("Wallpaper would exceed the instance limit; enlarge the cell or shrink the viewport");
    const [ox, oy] = [motifOffsetX * ax + motifOffsetY * bx, motifOffsetX * ay + motifOffsetY * by];
    const rowGap = Math.min(det / Math.hypot(ax, ay), det / Math.hypot(bx, by));
    const span = Math.ceil((Math.hypot(halfW, halfH) + Math.hypot(ax, ay) + Math.hypot(bx, by)) / rowGap) + 1;
    const seen = new Set<string>();
    const sites: Site[] = [];
    for (let i = -span; i <= span; i++) {
      for (let j = -span; j <= span; j++) {
        for (let op = 0; op < ops.length; op++) {
          const [theta, mirror, u, v] = ops[op];
          const cos = Math.cos(theta), sin = Math.sin(theta);
          const px = ox, py = mirror ? -oy : oy;
          const originX = centerX + (i + u) * ax + (j + v) * bx + px * cos - py * sin;
          const originY = centerY + (i + u) * ay + (j + v) * by + px * sin + py * cos;
          if (Math.abs(originX - centerX) > halfW || Math.abs(originY - centerY) > halfH) continue;
          const fingerprint = `${Math.round(originX * 1e4)}|${Math.round(originY * 1e4)}|${Math.round(theta * 1e4)}|${mirror ? 1 : 0}`;
          if (seen.has(fingerprint)) continue;
          seen.add(fingerprint);
          const id = `wall:${i}:${j}:${op}`;
          const siteSeed = componentSeed(seed, id, "site");
          let angle = theta, scale = mirror ? -1 : 1, x = originX, y = originY;
          if (breakDensity > 0 && unit(siteSeed, id, "break") < breakDensity) {
            // Square and hexagonal lattices ignore cell height everywhere, including here.
            const r = breakAmount * Math.min(cellWidth, wallpaperUsesCellHeight(group) ? cellHeight : cellWidth);
            x += (unit(siteSeed, id, "breakX") - .5) * 2 * r;
            y += (unit(siteSeed, id, "breakY") - .5) * 2 * r;
            angle += (unit(siteSeed, id, "breakAngle") - .5) * TAU * breakAmount;
            const s = 1 + (unit(siteSeed, id, "breakScale") - .5) * breakAmount;
            scale = mirror ? -s : s;
          }
          sites.push(Object.freeze({ id, seed: siteSeed, angle, scale, tone: op,
            position: Object.freeze([x, y] as const) }));
        }
      }
    }
    return Object.freeze(sites.sort((p, q) => p.id.localeCompare(q.id, "en", { numeric: true })));
  });
}

const wallpaperCache = new Map<string, readonly Site[]>();
const latticeCache = new Map<string, readonly LatticeSite[]>();

/** A regular lattice with a shared correlated disorder field; zero disorder is exactly ordered. */
export function latticeSites(options: LatticeOptions): readonly LatticeSite[] {
  const { seed, columns, rows, width, height, centerX, centerY, correlation, displacement,
    rotation, scale, omission, anchors, focalX, focalY, focalRadius, retention } = options;
  sourceSeed(seed);
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 2 || rows < 2)
    throw new Error("Lattice columns and rows must be integers of at least 2");
  finite("Lattice width", width, 1, 8192);
  finite("Lattice height", height, 1, 8192);
  finite("Lattice correlation", correlation, 1, 64);
  finite("Lattice displacement", displacement, 0, 1);
  finite("Lattice rotation", rotation, 0, Math.PI);
  finite("Lattice scale", scale, 0, 1);
  finite("Lattice omission", omission, 0, 1);
  finite("Lattice anchors", anchors, 0, 1);
  finite("Lattice focal radius", focalRadius, 0, 4096);
  finite("Lattice retention", retention, 0, 1);
  const key = JSON.stringify([seed, columns, rows, width, height, centerX, centerY, correlation,
    displacement, rotation, scale, omission, anchors, focalX, focalY, focalRadius, retention]);
  return memoized(latticeCache, key, () => {
    const field = gradientNoise2D01({ seed: componentSeed(seed, "lattice", "disorder") });
    const cellW = width / columns, cellH = height / rows;
    const sites: LatticeSite[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const originX = centerX - width / 2 + (col + .5) * cellW;
        const originY = centerY - height / 2 + (row + .5) * cellH;
        const id = `lat:${col}:${row}`;
        const siteSeed = componentSeed(seed, id, "site");
        const anchor = anchors > 0 && unit(siteSeed, id, "anchor") < anchors;
        const stableKeep = retention >= 1 || unit(siteSeed, id, "keep") < retention;
        const distance = focalRadius > 0 ? Math.hypot(originX - focalX, originY - focalY) / focalRadius : 0;
        const reach = focalRadius > 0 ? Math.max(0, 1 - distance) : 1;
        const falloff = reach * reach * (3 - 2 * reach);
        if (anchor || falloff === 0) {
          sites.push(Object.freeze({ id, seed: siteSeed, origin: Object.freeze([originX, originY] as const),
            position: Object.freeze([originX, originY] as const), angle: 0, scale: 1, anchor,
            kept: stableKeep, exception: false, tone: anchor ? 2 : 0 }));
          continue;
        }
        // Value noise clusters near 0.5; stretch it so each amplitude can reach its stated limit.
        const nx = col / correlation, ny = row / correlation;
        const sample = (offset: number) =>
          Math.max(-1, Math.min(1, (field.sample(nx + offset, ny - offset * 0.618) - .5) * 3.2));
        const shiftX = sample(0), shiftY = sample(1000), turn = sample(2000), grow = sample(3000);
        const positionX = originX + shiftX * displacement * cellW * falloff;
        const positionY = originY + shiftY * displacement * cellH * falloff;
        const angle = turn * rotation * falloff;
        const siteScale = 1 + grow * scale * falloff;
        const omitted = omission > 0 && (sample(4000) + 1) / 2 < omission * falloff;
        const disturbance = falloff * Math.max(displacement > 0 ? Math.max(Math.abs(shiftX), Math.abs(shiftY)) : 0,
          rotation > 0 ? Math.abs(turn) : 0, scale > 0 ? Math.abs(grow) : 0);
        const exception = omitted || disturbance > .7;
        sites.push(Object.freeze({ id, seed: siteSeed, anchor, kept: !omitted && stableKeep, exception,
          origin: Object.freeze([originX, originY] as const), position: Object.freeze([positionX, positionY] as const),
          angle, scale: siteScale, tone: exception ? 1 : 0 }));
      }
    }
    return Object.freeze(sites);
  });
}

const CUT_GRID = 8;
const treeCache = new Map<string, readonly RegionTreeNode[]>();

/** Bounded recursive subdivision reusing the existing binary cut policy per node. */
export function regionTree(options: CellTreeOptions): readonly RegionTreeNode[] {
  const { seed, width, height, centerX, centerY, depth, minSize, stopChance, childRetention, axis, bias } = options;
  sourceSeed(seed);
  if (!Number.isInteger(depth) || depth < 1 || depth > 12)
    throw new Error("Cell tree depth must be an integer in [1, 12]");
  finite("Cell tree width", width, minSize > 0 ? 2 : 1, 8192);
  finite("Cell tree height", height, minSize > 0 ? 2 : 1, 8192);
  finite("Cell tree min size", minSize, 0, 8192);
  finite("Cell tree stop chance", stopChance, 0, 1);
  finite("Cell tree child retention", childRetention, 0, 1);
  const key = JSON.stringify([seed, width, height, centerX, centerY, depth, minSize, stopChance, childRetention, axis, bias]);
  return memoized(treeCache, key, () => {
    const q = { ...regionFacetInstrumentDefinitions[1].defaults, attempts: 1, axis, cutBias: bias, retention: 1 };
    const rootLeft = centerX - width / 2, rootTop = centerY - height / 2;
    const nodes: RegionTreeNode[] = [];
    const stack: Array<{ id: string; parentId: string | null; depth: number; bounds: readonly [number, number, number, number] }> =
      [{ id: "root", parentId: null, depth: 0, bounds: [rootLeft, rootTop, rootLeft + width, rootTop + height] }];
    while (stack.length > 0) {
      const node = stack.pop()!;
      const nodeSeed = componentSeed(seed, node.id, "node");
      const [l, t, r, b] = node.bounds;
      const side = Math.min(r - l, b - t);
      const canSplit = node.depth < depth && side >= minSize
        && (stopChance === 0 || unit(nodeSeed, node.id, "stop") >= stopChance);
      if (!canSplit) {
        nodes.push(Object.freeze({ id: node.id, parentId: node.parentId, depth: node.depth,
          bounds: Object.freeze([l, t, r, b] as const), seed: nodeSeed, terminal: true }));
        continue;
      }
      // The partition chooses LONGEST from its grid shape, so encode the node's aspect in the grid.
      const panelW = r - l, panelH = b - t, k = 400 / Math.max(panelW, panelH);
      const columns = Math.max(2, Math.round(CUT_GRID * panelW / Math.max(panelW, panelH)));
      const rows = Math.max(2, Math.round(CUT_GRID * panelH / Math.max(panelW, panelH)));
      const leaves = panelLeaves({ ...q, columns, rows, width: panelW * k, height: panelH * k,
        centerX: panelW * k / 2, centerY: panelH * k / 2 }, componentSeed(seed, node.id, "cut"));
      const children: Array<{ id: string; parentId: string; depth: number; bounds: readonly [number, number, number, number] }> = [];
      for (let index = 0; index < leaves.length; index++) {
        const childId = `${node.id}/${index}`;
        // The root's children are always kept so the world can never lose half its footprint outright.
        if (childRetention < 1 && node.depth > 0 && unit(nodeSeed, childId, "keep") >= childRetention) continue;
        const leaf = leaves[index];
        children.push({ id: childId, parentId: node.id, depth: node.depth + 1,
          bounds: [l + leaf.bounds[0] / k, t + leaf.bounds[1] / k, l + leaf.bounds[2] / k, t + leaf.bounds[3] / k] });
      }
      if (children.length === 0) {
        nodes.push(Object.freeze({ id: node.id, parentId: node.parentId, depth: node.depth,
          bounds: Object.freeze([l, t, r, b] as const), seed: nodeSeed, terminal: true }));
        continue;
      }
      nodes.push(Object.freeze({ id: node.id, parentId: node.parentId, depth: node.depth,
        bounds: Object.freeze([l, t, r, b] as const), seed: nodeSeed, terminal: false }));
      for (let index = children.length - 1; index >= 0; index--) stack.push(children[index]);
    }
    return Object.freeze(nodes);
  });
}

const gridPathCache = new Map<string, readonly Path[]>();
const gridSiteCache = new Map<string, readonly Site[]>();
function gridKey(options: GridOptions): string {
  const { seed, centerX, centerY, width, height, columns, rows, jitter } = options;
  sourceSeed(seed);
  finite("Grid width", width, 1, 4096);
  finite("Grid height", height, 1, 4096);
  finite("Grid jitter", jitter, 0, 1);
  for (const [label, value] of [["columns", columns], ["rows", rows]] as const)
    if (!Number.isInteger(value) || value < 1 || value > 60) throw new Error(`Grid ${label} must be an integer in [1, 60]`);
  return JSON.stringify([seed, centerX, centerY, width, height, columns, rows, jitter]);
}
/**
 * Line coordinates along one axis. Interior lines blend their regular position with the sorted
 * random draws of a seeded stream (weight `jitter`), so spacing clumps and opens in a seed-specific
 * way while order is kept; the two edge lines stay put.
 */
function gridAxis(seed: number, prefix: string, start: number, extent: number, count: number, jitter: number): number[] {
  const random = Array.from({ length: Math.max(0, count - 1) }, (_, index) => unit(seed, `${prefix}:${index + 1}`, "jitter"))
    .sort((a, b) => a - b);
  return Array.from({ length: count + 1 }, (_, index) => {
    const regular = index / count;
    const blended = index === 0 || index === count ? regular : (1 - jitter) * regular + jitter * random[index - 1];
    return start + extent * blended;
  });
}

/** Straight column and row lines; `levelFraction` runs 0..1 across each family. */
export function gridPaths(options: GridOptions): readonly Path[] {
  const { seed, centerX, centerY, width, height, columns, rows, jitter } = options;
  return memoized(gridPathCache, gridKey(options), () => {
    const left = centerX - width / 2, top = centerY - height / 2, paths: Path[] = [];
    gridAxis(seed, "col", left, width, columns, jitter).forEach((x, column) => {
      const id = `col:${column}`;
      paths.push(Object.freeze({ id, seed: componentSeed(seed, id, "path"), closed: false, level: column,
        levelFraction: column / columns, tone: 0,
        points: Object.freeze([Object.freeze([x, top] as const), Object.freeze([x, top + height] as const)]) }));
    });
    gridAxis(seed, "row", top, height, rows, jitter).forEach((y, row) => {
      const id = `row:${row}`;
      paths.push(Object.freeze({ id, seed: componentSeed(seed, id, "path"), closed: false, level: row,
        levelFraction: row / rows, tone: 1,
        points: Object.freeze([Object.freeze([left, y] as const), Object.freeze([left + width, y] as const)]) }));
    });
    return Object.freeze(paths);
  });
}

/** The grid's line crossings, upright and unit scale. */
export function gridSites(options: GridOptions): readonly Site[] {
  const { seed, centerX, centerY, width, height, columns, rows, jitter } = options;
  return memoized(gridSiteCache, gridKey(options), () => {
    const left = centerX - width / 2, top = centerY - height / 2, sites: Site[] = [];
    const xs = gridAxis(seed, "col", left, width, columns, jitter), ys = gridAxis(seed, "row", top, height, rows, jitter);
    ys.forEach((y, row) => xs.forEach((x, column) => {
      const id = `node:${column}:${row}`;
      sites.push(Object.freeze({ id, seed: componentSeed(seed, id, "site"), angle: 0, scale: 1, tone: 0,
        position: Object.freeze([x, y] as const) }));
    }));
    return Object.freeze(sites);
  });
}
