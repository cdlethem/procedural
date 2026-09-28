import { assembleSegmentChains2D, gradientNoise2D01 } from "@procedurals/javascript";
import { contourReliefContours, contourReliefDefinitions, validateContourRelief } from "../adapters/contour-relief.js";
import { poissonPoints, placementPackingInstrumentDefinitions } from "../adapters/placement-packing-instruments.js";
import { panelLeaves, regionFacetInstrumentDefinitions } from "../adapters/region-facet-instruments.js";
import { componentSeed } from "./core.js";
import type { CellTreeOptions, ContourOptions, LatticeOptions, LatticeSite, PartitionOptions, Path,
  PoissonOptions, Region, RegionTreeNode, Site, WallpaperOptions } from "./types.js";

const siteCache = new Map<string, readonly Site[]>();
const pathCache = new Map<string, readonly Path[]>();
const regionCache = new Map<string, readonly Region[]>();

function memoized<T>(cache: Map<string, T>, key: string, make: () => T): T {
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

/** Lattice basis and operations per explicit group; centered and hexagonal cells are documented. */
type WallpaperOp = readonly [rotation: number, mirror: boolean, tx: number, ty: number];
const TAU = 2 * Math.PI;
function wallpaperOps(group: WallpaperOptions["group"]): { a: readonly [number, number, number, number]; ops: readonly WallpaperOp[] } {
  const [w, h] = [1, 1];
  const c: readonly [number, number, number, number] = [w, 0, w / 2, h / 2];
  const hex: readonly [number, number, number, number] = [w, 0, w / 2, h * Math.sqrt(3) / 2];
  switch (group) {
    case "p1": return { a: [w, 0, 0, h], ops: [[0, false, 0, 0]] };
    case "p2": return { a: [w, 0, 0, h], ops: [[0, false, 0, 0], [Math.PI, false, 0, 0]] };
    case "pm": return { a: [w, 0, 0, h], ops: [[0, false, 0, 0], [0, true, 0, 0]] };
    case "pg": return { a: [w, 0, 0, h], ops: [[0, false, 0, 0], [0, true, .5, 0]] };
    case "cm": return { a: c, ops: [[0, false, 0, 0], [0, true, 0, 0]] };
    case "pmm": return { a: [w, 0, 0, h], ops: [[0, false, 0, 0], [Math.PI, false, 0, 0], [0, true, 0, 0], [Math.PI, true, 0, 0]] };
    case "pmg": return { a: [w, 0, 0, h], ops: [[0, false, 0, 0], [Math.PI, false, 0, 0], [0, true, 0, 0], [0, true, 0, .5]] };
    case "pgg": return { a: [w, 0, 0, h], ops: [[0, false, 0, 0], [Math.PI, false, 0, 0], [0, true, .5, 0], [0, true, 0, .5]] };
    case "cmm": return { a: c, ops: [[0, false, 0, 0], [Math.PI, false, 0, 0], [0, true, 0, 0], [Math.PI, true, 0, 0]] };
    case "p4": return { a: [w, 0, 0, w], ops: [[0, false, 0, 0], [Math.PI / 2, false, 0, 0], [Math.PI, false, 0, 0], [3 * Math.PI / 2, false, 0, 0]] };
    case "p4m": return { a: [w, 0, 0, w], ops: [[0, false, 0, 0], [Math.PI / 2, false, 0, 0], [Math.PI, false, 0, 0], [3 * Math.PI / 2, false, 0, 0], [0, true, 0, 0], [Math.PI / 4, true, 0, 0]] };
    case "p4g": return { a: [w, 0, 0, w], ops: [[0, false, 0, 0], [Math.PI / 2, false, 0, 0], [Math.PI, false, 0, 0], [3 * Math.PI / 2, false, 0, 0], [0, true, .5, 0], [Math.PI / 4, true, .5, .5]] };
    case "p3": return { a: hex, ops: [[0, false, 0, 0], [TAU / 3, false, 0, 0], [2 * TAU / 3, false, 0, 0]] };
    case "p3m1": return { a: hex, ops: [[0, false, 0, 0], [TAU / 3, false, 0, 0], [2 * TAU / 3, false, 0, 0], [0, true, 0, 0], [TAU / 6, true, 0, 0], [TAU / 3, true, 0, 0]] };
    case "p31m": return { a: hex, ops: [[0, false, 0, 0], [TAU / 3, false, 0, 0], [2 * TAU / 3, false, 0, 0], [TAU / 12, true, 0, 0], [TAU / 4, true, 0, 0], [5 * TAU / 12, true, 0, 0]] };
    case "p6": return { a: hex, ops: [[0, false, 0, 0], [TAU / 6, false, 0, 0], [TAU / 3, false, 0, 0], [TAU / 2, false, 0, 0], [2 * TAU / 3, false, 0, 0], [5 * TAU / 6, false, 0, 0]] };
    case "p6m": return { a: hex, ops: [[0, false, 0, 0], [TAU / 6, false, 0, 0], [TAU / 3, false, 0, 0], [TAU / 2, false, 0, 0], [2 * TAU / 3, false, 0, 0], [5 * TAU / 6, false, 0, 0], [0, true, 0, 0], [TAU / 6, true, 0, 0], [TAU / 3, true, 0, 0], [TAU / 2, true, 0, 0], [2 * TAU / 3, true, 0, 0], [5 * TAU / 6, true, 0, 0]] };
    default: throw new Error(`Unsupported wallpaper group: ${String(group)}`);
  }
}

/** Instance transforms for the stated group; exact duplicate images are removed by fingerprint. */
export function wallpaperSites(options: WallpaperOptions): readonly Site[] {
  const { seed, group, cellWidth, cellHeight, centerX, centerY, width, height, motifOffsetX, motifOffsetY, margin, breakAmount, breakDensity } = options;
  sourceSeed(seed);
  finite("Wallpaper cell width", cellWidth, 4, 4096);
  finite("Wallpaper cell height", cellHeight, 4, 4096);
  finite("Wallpaper motif offset X", motifOffsetX, 0, 1);
  finite("Wallpaper motif offset Y", motifOffsetY, 0, 1);
  finite("Wallpaper margin", margin, 0, 512);
  finite("Wallpaper break amount", breakAmount, 0, 1);
  finite("Wallpaper break density", breakDensity, 0, 1);
  const key = JSON.stringify([seed, group, cellWidth, cellHeight, centerX, centerY, width, height, motifOffsetX, motifOffsetY, margin, breakAmount, breakDensity]);
  return memoized(wallpaperCache, key, () => {
    const { a, ops } = wallpaperOps(group);
    const ax = a[0] * cellWidth, ay = a[1] * cellWidth, bx = a[2] * cellHeight, by = a[3] * cellHeight;
    const ox = motifOffsetX * cellWidth, oy = motifOffsetY * cellHeight;
    const left = centerX - width / 2 - margin, top = centerY - height / 2 - margin;
    const right = centerX + width / 2 + margin, bottom = centerY + height / 2 + margin;
    const seen = new Set<string>();
    const sites: Site[] = [];
    const span = Math.ceil(width / Math.min(cellWidth, cellHeight)) + 4;
    for (let i = -span; i <= span; i++) {
      for (let j = -span; j <= span; j++) {
        const baseX = i * ax + j * bx, baseY = i * ay + j * by;
        for (let op = 0; op < ops.length; op++) {
          const [theta, mirror, tx, ty] = ops[op];
          const cos = Math.cos(theta), sin = Math.sin(theta);
          const px = ox, py = mirror ? -oy : oy;
          const originX = centerX + baseX + tx * cellWidth + px * cos - py * sin;
          const originY = centerY + baseY + ty * cellHeight + px * sin + py * cos;
          const fingerprint = `${Math.round(originX * 1e4)}|${Math.round(originY * 1e4)}|${Math.round((((theta % TAU) + TAU) % TAU) * 1e4)}|${mirror ? 1 : 0}`;
          if (seen.has(fingerprint)) continue;
          seen.add(fingerprint);
          if (originX < left || originX > right || originY < top || originY > bottom) continue;
          const id = `wall:${i}:${j}:${op}`;
          const siteSeed = componentSeed(seed, id, "site");
          let angle = theta, scale = mirror ? -1 : 1, x = originX, y = originY;
          if (breakDensity > 0 && unit(siteSeed, id, "break") < breakDensity) {
            const r = breakAmount * Math.min(cellWidth, cellHeight);
            x += (unit(siteSeed, id, "breakX") - .5) * 2 * r;
            y += (unit(siteSeed, id, "breakY") - .5) * 2 * r;
            angle += (unit(siteSeed, id, "breakAngle") - .5) * TAU * breakAmount;
            const s = 1 + (unit(siteSeed, id, "breakScale") - .5) * breakAmount;
            scale = mirror ? -s : s;
          }
          sites.push(Object.freeze({ id, seed: siteSeed, angle, scale,
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
        const dx = originX - focalX, dy = originY - focalY;
        const distance = focalRadius > 0 ? Math.hypot(dx, dy) / focalRadius : 0;
        const falloff = focalRadius > 0 ? Math.max(0, 1 - distance) ** 2 : 1;
        if (anchor || falloff === 0) {
          const kept = retention >= 1 || unit(siteSeed, id, "keep") < retention;
          sites.push(Object.freeze({ id, seed: siteSeed, origin: Object.freeze([originX, originY] as const),
            position: Object.freeze([originX, originY] as const), angle: 0, scale: 1, anchor, kept,
            exception: !kept }));
          continue;
        }
        const nx = col / correlation, ny = row / correlation;
        const sample = (offset: number) => field.sample(nx + offset, ny - offset * 0.618);
        const wobble = falloff * (1 - unit(siteSeed, id, "calm"));
        const positionX = originX + (sample(0) - .5) * 2 * displacement * cellW * wobble;
        const positionY = originY + (sample(1000) - .5) * 2 * displacement * cellH * wobble;
        const angle = (sample(2000) - .5) * 2 * rotation * wobble;
        const siteScale = 1 + (sample(3000) - .5) * 2 * scale * wobble;
        const omitted = omission > 0 && sample(4000) < omission * wobble;
        const kept = !omitted && (retention >= 1 || unit(siteSeed, id, "keep") < retention);
        const exception = omitted || !kept || Math.hypot(positionX - originX, positionY - originY) > 1e-6
          || Math.abs(angle) > 1e-6 || Math.abs(siteScale - 1) > 1e-6;
        sites.push(Object.freeze({ id, seed: siteSeed, anchor, kept, exception,
          origin: Object.freeze([originX, originY] as const), position: Object.freeze([positionX, positionY] as const),
          angle, scale: siteScale }));
      }
    }
    return Object.freeze(sites);
  });
}

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
    const q = { ...regionFacetInstrumentDefinitions[1].defaults, width: 400, height: 400,
      centerX: 200, centerY: 200, columns: 2, rows: 2, attempts: 1, axis, cutBias: bias, retention: 1 };
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
      const panelW = r - l, panelH = b - t;
      const localQ = { ...q, width: 400, height: 400,
        centerX: 200, centerY: 200 };
      const leaves = panelLeaves(localQ, componentSeed(seed, node.id, "cut"));
      const children: Array<{ id: string; parentId: string; depth: number; bounds: readonly [number, number, number, number] }> = [];
      for (let index = 0; index < leaves.length; index++) {
        const childId = `${node.id}/${index}`;
        if (childRetention < 1 && unit(nodeSeed, childId, "keep") >= childRetention) continue;
        const leaf = leaves[index];
        children.push({ id: childId, parentId: node.id, depth: node.depth + 1,
          bounds: [l + leaf.bounds[0] / 400 * panelW, t + leaf.bounds[1] / 400 * panelH,
            l + leaf.bounds[2] / 400 * panelW, t + leaf.bounds[3] / 400 * panelH] });
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
