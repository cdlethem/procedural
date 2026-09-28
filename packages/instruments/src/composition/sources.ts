import { assembleSegmentChains2D } from "@procedurals/javascript";
import { contourReliefContours, contourReliefDefinitions, validateContourRelief } from "../adapters/contour-relief.js";
import { poissonPoints, placementPackingInstrumentDefinitions } from "../adapters/placement-packing-instruments.js";
import { panelLeaves, regionFacetInstrumentDefinitions } from "../adapters/region-facet-instruments.js";
import { componentSeed } from "./core.js";
import type { ContourOptions, PartitionOptions, Path, PoissonOptions, Region, Site } from "./types.js";

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
