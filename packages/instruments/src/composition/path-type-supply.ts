import { chaikinPolyline2D } from "@procedurals/javascript";
import { branchTree, fitRoots } from "./branch-tree.js";
import type { BranchTree, BranchTreeOptions } from "./branch-tree.js";
import { componentSeed } from "./core.js";
import { gesturePath } from "./gesture.js";
import { gestureTrack } from "./recording.js";
import type { GestureFrame } from "./recording.js";
import { bundledRecording } from "./recording-samples.js";
import type { BundledRecordingId } from "./recording-samples.js";
import { contourPaths, memoized } from "./sources.js";
import type { ContourOptions, Path, Point } from "./types.js";

/**
 * The paths Path Typography can ride, as ordinary `Path` values from producers that already exist.
 * Nothing here is drawn; `layoutAlongPath` accepts any `Path`, these are the bundled supplies.
 *
 *   contour  `contourPaths` of a sampled landscape. A contour may be open, where it meets the field's
 *            edge, or closed.
 *   branch   a CHAIN of a `branchTree` (`branchChains`): edges joined into one open polyline (a single
 *            edge is usually shorter than a phrase); the longest is a whole trunk-to-terminal lineage,
 *            the rest run from the fork where they leave the longer ones, so chains never overlap. A
 *            fork between two edges of a chain is a corner of its polyline. Named `chain@<terminal
 *            node id>`, so a chain keeps its name when the tree grows further.
 *   gesture  `gesturePath` of a bundled recording (a fixed take per seed), sampled every `spacing`
 *            canvas units of arc length, over the whole recording; the frame is placed by centre and
 *            scaled so its larger side is `extent` canvas units. Pressure plays no part.
 *
 * `rankedPaths` orders a supply's paths longest first (ties by id); `supplyPaths` takes `count`
 * consecutive ranks from rank `pick`, so raising `count` only adds paths and raising `pick` slides
 * the window. `smooth` rounds each chosen path with that many rounds of Chaikin corner cutting (`chaikinPolyline2D`;
 * an open path keeps both ends): 0 keeps the source polyline. Marching-square contours and grown
 * branches are visibly faceted at type scale, so the instrument smooths by default. Ids and seeds
 * come from the source path, suffixed `~s<n>` when smoothed. A pick beyond the supply's path count
 * is an error naming the control to lower; an empty supply is an error naming the settings that
 * empty it, never a substitute picture.
 *
 * All results are frozen and cached by construction only: type, size and appearance never rebuild
 * a supply. Positions are canvas units; option angles are degrees.
 */
export interface ContourSupply { kind: "contour"; source: ContourOptions }
export interface BranchSupply { kind: "branch"; tree: BranchTreeOptions }
export interface GestureSupply {
  kind: "gesture";
  recording: BundledRecordingId;
  seed: number;
  /** Gaussian smoothing of the recorded hand, milliseconds. */
  smoothing: number;
  frame: GestureFrame;
  /** Arc length between stroke vertices, canvas units. */
  spacing: number;
}
export type PathSupply = ContourSupply | BranchSupply | GestureSupply;
/** Which of a supply's paths carry type: `count` consecutive ranks from rank `pick` (0 is the longest). */
export interface PathSelection { pick: number; count: number; smooth: number }

const length = (points: readonly Point[], closed: boolean): number => {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  if (closed && points.length > 1) sum += Math.hypot(points[0][0] - points[points.length - 1][0], points[0][1] - points[points.length - 1][1]);
  return sum;
};

const chainCache = new WeakMap<BranchTree, readonly Path[]>();
/**
 * The tree as non-overlapping chains: the longest trunk-to-terminal lineage whole, then for each
 * next-longest lineage only the edges no earlier chain already runs along, from the fork where it
 * leaves them. Two chains meet at a fork and share no edge, so lettering several of them cannot put
 * type on type. Chains are joined open polylines named `chain@<terminal node id>`.
 */
export function branchChains(tree: BranchTree): readonly Path[] {
  const hit = chainCache.get(tree);
  if (hit) return hit;
  const edges = new Map(tree.edges.map((edge) => [edge.id, edge]));
  const lineages = tree.nodes.filter((node) => node.role === "terminal").map((node) => {
    const chain = [];
    for (let id: string | null = node.edgeIn; id !== null; id = edges.get(id)!.parent) chain.push(edges.get(id)!);
    chain.reverse();
    return { node, chain, length: chain.reduce((sum, edge) => sum + edge.length, 0) };
  }).sort((a, b) => b.length - a.length || (a.node.id < b.node.id ? -1 : 1));
  const used = new Set<string>(), paths: Path[] = [];
  for (const { node, chain } of lineages) {
    const fresh = chain.filter((edge) => !used.has(edge.id));
    for (const edge of fresh) used.add(edge.id);
    if (fresh.length === 0) continue;
    const points: Point[] = [];
    for (const edge of fresh) for (const point of edge.points) {
      const last = points[points.length - 1];
      if (!last || last[0] !== point[0] || last[1] !== point[1]) points.push(point);
    }
    const id = `chain@${node.id}`, tip = fresh[fresh.length - 1];
    paths.push(Object.freeze({ id, seed: componentSeed(tree.seed, id, "path"), points: Object.freeze(points), closed: false,
      level: tip.depth, levelFraction: tip.levelFraction }));
  }
  const value = Object.freeze(paths);
  chainCache.set(tree, value);
  return value;
}

/** Larger side of a recording's own extent at frame scale 1, canvas units. */
const naturalCache = new Map<string, number>();
export function gestureNaturalExtent(recording: BundledRecordingId, seed: number): number {
  return memoized(naturalCache, `${recording}:${seed}`, () => {
    const track = gestureTrack(bundledRecording(recording, seed), { smoothing: 0, frame: { centerX: 0, centerY: 0, scale: 1, rotation: 0 } });
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let j = 0; j < track.count; j++) {
      minX = Math.min(minX, track.x[j]); maxX = Math.max(maxX, track.x[j]);
      minY = Math.min(minY, track.y[j]); maxY = Math.max(maxY, track.y[j]);
    }
    return Math.max(maxX - minX, maxY - minY);
  });
}

const smoothCache = new WeakMap<Path, Map<number, Path>>();
/** `rounds` of corner cutting; 0 returns the path itself. */
export function smoothPath(path: Path, rounds: number): Path {
  if (!Number.isInteger(rounds) || rounds < 0 || rounds > 4) throw new Error("Smoothing rounds must be an integer in [0, 4]");
  if (rounds === 0) return path;
  const cache = smoothCache.get(path) ?? new Map<number, Path>();
  smoothCache.set(path, cache);
  const hit = cache.get(rounds);
  if (hit) return hit;
  const points = chaikinPolyline2D({ points: path.points, closed: path.closed, iterations: rounds,
    maxWork: path.points.length * 2 ** (rounds + 2) + 16 }).points as unknown as Point[];
  const id = `${path.id}~s${rounds}`;
  const value: Path = Object.freeze({ id, seed: componentSeed(path.seed, id, "path"), closed: path.closed, level: path.level, levelFraction: path.levelFraction,
    points: Object.freeze(points.map((point) => Object.freeze([point[0], point[1]] as const))) });
  cache.set(rounds, value);
  return value;
}

export interface SelectedPaths { readonly paths: readonly Path[]; readonly available: number }
const selectedCache = new Map<string, SelectedPaths>();
const rankedCache = new Map<string, readonly Path[]>();
/** Every path of a supply, longest first (ties by id). Cached by construction only. */
export function rankedPaths(supply: PathSupply): readonly Path[] {
  return memoized(rankedCache, JSON.stringify(supply), () => {
    if (supply.kind === "gesture") {
      const track = gestureTrack(bundledRecording(supply.recording, supply.seed), { smoothing: supply.smoothing, frame: supply.frame });
      const path = gesturePath(track, { seed: supply.seed, sampling: { kind: "arc", spacing: supply.spacing },
        window: { start: 0, end: track.duration }, pressure: { source: "constant", whenAbsent: "constant", level: 0.5 } });
      return Object.freeze([Object.freeze({ id: path.id, seed: path.seed, points: path.points, closed: false, level: 0, levelFraction: 0 }) as Path]);
    }
    let paths: readonly Path[];
    try {
      paths = supply.kind === "contour" ? contourPaths(supply.source) : branchChains(branchTree(supply.tree));
    } catch (error) {
      // The source's own limit names its computation; say which of this instrument's settings feed it.
      if (supply.kind === "contour" && error instanceof Error && /work limit/.test(error.message))
        throw new Error(`${error.message}: lower Frequency or Threshold count, or widen Threshold interval`);
      throw error;
    }
    const size = new Map(paths.map((path) => [path, length(path.points, path.closed)]));
    return Object.freeze([...paths].sort((a, b) => size.get(b)! - size.get(a)! || (a.id < b.id ? -1 : 1)));
  });
}

/**
 * The paths selected from a supply, smoothed, and how many the supply has. `count` is capped by what
 * exists after `pick`. A supply with no paths, or a `pick` past its last path, is a VALID EMPTY
 * selection (`paths` empty, `available` says how many exist): the settings describe a picture with
 * nothing to letter, which is an artistic state, not an error, so a slider can never refuse to draw.
 * Malformed values (a non-integer pick or count) still throw.
 */
export function supplyPaths(supply: PathSupply, selection: PathSelection): SelectedPaths {
  const { pick, count, smooth } = selection;
  if (!Number.isInteger(pick) || pick < 0) throw new Error("Path pick must be a nonnegative integer");
  if (!Number.isInteger(count) || count < 1 || count > 64) throw new Error("Paths lettered must be an integer in [1, 64]");
  const ranked = rankedPaths(supply);
  // One frozen array per selection, so layouts that depend on the array identity are shared.
  return memoized(selectedCache, JSON.stringify([supply, selection]), () =>
    Object.freeze({ paths: Object.freeze(ranked.slice(pick, pick + count).map((path) => smoothPath(path, smooth))), available: ranked.length }));
}

/** Growth settings for the bundled branch supply: an area of attractors above one auto-fitted root. */
export interface BundledBranch {
  seed: number;
  centerX: number;
  centerY: number;
  extent: number;
  attractors: number;
  ticks: number;
  branches: number;
  /** Degrees. */
  spread: number;
  routing: BranchTreeOptions["routing"];
}
export function bundledBranchTree(o: BundledBranch): BranchTreeOptions {
  const footprint = { sourceMode: "area" as const, extent: o.extent, aspect: 1, direction: 0, centerX: o.centerX, centerY: o.centerY, lobeGap: 0.15 };
  return { seed: o.seed, routing: o.routing, ...footprint, sourceCount: o.attractors, disorder: 0.6, exclusion: 0.1, band: 0.18, lobeBias: 0.5,
    ...fitRoots(footprint), ticks: o.ticks, step: 11, reach: 16, branches: o.branches, branchSpread: o.spread };
}
