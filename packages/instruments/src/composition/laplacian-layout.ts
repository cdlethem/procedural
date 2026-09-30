import { componentSeed } from "./core.js";
import { canonicalKey } from "./snapshot-values.js";

/**
 * Boundary conditions and seed region of a Laplacian growth front (brief 16).
 *
 * The plane is the 640-unit canvas sampled on `grid × grid` square cells of `cell = 640 / grid` canvas units;
 * cell `(i, j)` (id = `j * grid + i`) has its centre at `((i + ½) cell, (j + ½) cell)` and every shape below is
 * decided by that centre. Each cell has one static class:
 *
 * - FREE: a cell the potential is solved on (and the front may enter).
 * - SOURCE: fixed potential 1 (an electrode / reservoir); never entered.
 * - SINK: fixed potential 0 that is NOT the growing region (an absorber); never entered.
 * - WALL: insulating (zero normal flux); never entered. The canvas edge is insulating unless it is a source.
 *
 * The SEED region is the initially occupied part of the FREE cells; occupied cells are potential 0 (the growing
 * sink). A seed cell that falls on a source, sink or wall is dropped (the boundary wins), so an empty seed is an
 * error naming the seed controls. Nothing is smoothed: the layout is exact cell membership.
 *
 * Randomness: every seeded choice (cluster centres, pillar positions, wall gaps' phase, per-cell mobility)
 * derives from `componentSeed(seed, <element id>, <purpose>)`, never from draw order, so adding a pillar or
 * changing a count does not move the others.
 */

export const KIND_FREE = 0, KIND_SOURCE = 1, KIND_SINK = 2, KIND_WALL = 3;
export const CANVAS = 640;
/** Lattice spacing of the mobility noise, canvas units: the lobes the disorder can seed are about this wide. */
export const NOISE_LENGTH = 24;
export const GROWTH_LIMITS = Object.freeze({ minGrid: 24, maxGrid: 256, maxSeedDiscs: 64, maxPillars: 48, maxGaps: 12, maxSourcePoints: 16, maxSinks: 16 });

export type SeedShape = "disc" | "lobed" | "cluster" | "necklace" | "bar";
export type SourceKind = "ring" | "frame" | "edge" | "points";
export type SourceSide = "top" | "right" | "bottom" | "left";
export type SinkKind = "none" | "discs";
export type BarrierKind = "none" | "wall" | "pillars";

/** The structural part of a growth construction: everything that decides the boundary conditions and the seed. */
export interface LayoutSpec {
  /** Cells per side; the potential is solved on grid × grid cells. */
  grid: number;
  seedShape: SeedShape;
  /** Centre of the seed region, canvas units. */
  seedX: number; seedY: number;
  /** Disc/lobed mean radius; radius of each cluster/necklace disc; half-thickness of a bar. Canvas units. */
  seedRadius: number;
  /** Lobed: r(θ) = radius (1 + depth cos(lobes (θ − angle))). */
  seedLobes: number; seedDepth: number;
  /** Cluster and necklace: number of discs. */
  seedCount: number;
  /** Cluster: radius of the area the discs are scattered over; necklace: radius of the ring; bar: length. Canvas units. */
  seedSpread: number;
  /** Degrees: lobe phase, necklace phase, bar direction. */
  seedAngle: number;
  source: SourceKind;
  /** Ring source: radius outside which the potential is 1; points: radius of the circle the points sit on. */
  sourceRadius: number;
  /** Frame and edge: thickness of the source band; points: radius of each point. Canvas units. */
  sourceSize: number;
  sourceCount: number;
  sourceSide: SourceSide;
  /** Degrees: where the first source point sits. */
  sourceAngle: number;
  sinks: SinkKind;
  sinkCount: number; sinkSize: number; sinkRing: number; sinkAngle: number;
  barrier: BarrierKind;
  /** Wall: direction in degrees (0 horizontal), signed offset of the wall from the canvas centre, thickness, gaps. */
  barrierAngle: number; barrierOffset: number; barrierWidth: number; barrierGaps: number; barrierGapWidth: number;
  pillarCount: number; pillarSize: number;
  /** Quenched disorder in [0, 0.95]: mobility is 1 + noise v, v in [-1, 1] a seeded value noise with lattice spacing `NOISE_LENGTH` canvas units. */
  noise: number;
}

export const layoutKeys = ["grid", "seedShape", "seedX", "seedY", "seedRadius", "seedLobes", "seedDepth", "seedCount", "seedSpread", "seedAngle",
  "source", "sourceRadius", "sourceSize", "sourceCount", "sourceSide", "sourceAngle", "sinks", "sinkCount", "sinkSize", "sinkRing", "sinkAngle",
  "barrier", "barrierAngle", "barrierOffset", "barrierWidth", "barrierGaps", "barrierGapWidth", "pillarCount", "pillarSize", "noise"] as const;

/** Frozen boundary conditions, seed region and mobility. Typed arrays are read-only by contract. */
export interface GrowthLayout {
  readonly n: number;
  readonly cell: number;
  readonly kind: Readonly<Uint8Array>;
  /** 1 where the seed region starts occupied. */
  readonly seedCells: Readonly<Uint8Array>;
  /** Per cell growth mobility around 1, or null when `noise` is 0. */
  readonly mobility: Readonly<Float32Array> | null;
  /** Four neighbour cell ids per FREE cell (N, S, W, E); a wall or the grid edge is replaced by the cell itself (zero flux). */
  readonly neighbours: Readonly<Int32Array>;
  /** Open (non-wall, in-grid) neighbour count per cell. */
  readonly open: Readonly<Uint8Array>;
  readonly sourceCells: number;
  readonly freeCells: number;
  readonly seedCount: number;
}

const radians = Math.PI / 180;

function integer(label: string, value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer from ${min} to ${max}`);
  return value;
}
function finite(label: string, value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be a number from ${min} to ${max}`);
  return value;
}

/** Validate the structural controls; every message names the control to change. */
export function checkLayoutSpec(s: LayoutSpec): void {
  integer("Grid", s.grid, GROWTH_LIMITS.minGrid, GROWTH_LIMITS.maxGrid);
  finite("Seed X", s.seedX, -CANVAS, 2 * CANVAS); finite("Seed Y", s.seedY, -CANVAS, 2 * CANVAS);
  finite("Seed radius", s.seedRadius, 0.01, 4 * CANVAS);
  integer("Lobes", s.seedLobes, 1, 24); finite("Lobe depth", s.seedDepth, 0, 0.95);
  integer("Seed count", s.seedCount, 1, GROWTH_LIMITS.maxSeedDiscs);
  finite("Seed spread", s.seedSpread, 0, 4 * CANVAS); finite("Seed angle", s.seedAngle, -3600, 3600);
  finite("Source radius", s.sourceRadius, 0, 4 * CANVAS); finite("Source size", s.sourceSize, 0, 4 * CANVAS);
  integer("Source points", s.sourceCount, 1, GROWTH_LIMITS.maxSourcePoints); finite("Source angle", s.sourceAngle, -3600, 3600);
  integer("Sinks", s.sinkCount, 1, GROWTH_LIMITS.maxSinks);
  finite("Sink size", s.sinkSize, 0, 4 * CANVAS); finite("Sink ring", s.sinkRing, 0, 4 * CANVAS); finite("Sink angle", s.sinkAngle, -3600, 3600);
  finite("Wall angle", s.barrierAngle, -3600, 3600); finite("Wall offset", s.barrierOffset, -4 * CANVAS, 4 * CANVAS);
  finite("Wall width", s.barrierWidth, 0, 4 * CANVAS);
  integer("Wall gaps", s.barrierGaps, 1, GROWTH_LIMITS.maxGaps); finite("Gap width", s.barrierGapWidth, 0, 4 * CANVAS);
  integer("Pillars", s.pillarCount, 1, GROWTH_LIMITS.maxPillars); finite("Pillar size", s.pillarSize, 0, 4 * CANVAS);
  finite("Noise", s.noise, 0, 0.95);
}

const layouts = new Map<string, GrowthLayout>();

/** The layout of a spec and seed: a pure function, so identical inputs share one frozen value (least recently used, 6). */
export function growthLayout(spec: LayoutSpec, seed: number): GrowthLayout {
  checkLayoutSpec(spec);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Seed must be a uint32");
  const key = canonicalKey(Object.fromEntries(layoutKeys.map((k) => [k, spec[k]])), "layout") + `|${seed}`;
  const hit = layouts.get(key);
  if (hit) { layouts.delete(key); layouts.set(key, hit); return hit; }
  const made = build(spec, seed);
  layouts.set(key, made);
  if (layouts.size > 6) layouts.delete(layouts.keys().next().value!);
  return made;
}

const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / 0x1_0000_0000;

/** Centres of `count` discs of the cluster seed: scattered over a disc of radius `spread`, kept apart when they can be. */
export function clusterCentres(spec: Pick<LayoutSpec, "seedX" | "seedY" | "seedRadius" | "seedSpread" | "seedCount">, seed: number): [number, number][] {
  const centres: [number, number][] = [];
  const apart = 2.4 * spec.seedRadius;
  for (let k = 0; k < spec.seedCount; k++) {
    let best: [number, number] = [spec.seedX, spec.seedY], bestGap = -1;
    for (let attempt = 0; attempt < 24; attempt++) {
      const id = `seed:${k}#${attempt}`;
      const radius = spec.seedSpread * Math.sqrt(unit(seed, id, "radius")), theta = 2 * Math.PI * unit(seed, id, "angle");
      const p: [number, number] = [spec.seedX + radius * Math.cos(theta), spec.seedY + radius * Math.sin(theta)];
      let gap = Infinity;
      for (const c of centres) gap = Math.min(gap, Math.hypot(c[0] - p[0], c[1] - p[1]));
      if (gap > bestGap) { best = p; bestGap = gap; }
      if (gap >= apart) break;
    }
    centres.push(best);
  }
  return centres;
}

/** `count` equally spaced points on a circle around the canvas centre, starting at `angle` degrees. */
export function ringPoints(count: number, radius: number, angle: number): [number, number][] {
  return Array.from({ length: count }, (_, k) => {
    const theta = (angle + 360 * k / count) * radians;
    return [CANVAS / 2 + radius * Math.cos(theta), CANVAS / 2 + radius * Math.sin(theta)] as [number, number];
  });
}

/** Seeded pillar centres in the canvas margin-free area, kept clear of the seed region when possible. */
export function pillarCentres(spec: Pick<LayoutSpec, "pillarCount" | "pillarSize" | "seedX" | "seedY" | "seedRadius" | "seedDepth" | "seedSpread" | "seedShape">, seed: number): [number, number][] {
  const reach = spec.seedShape === "disc" ? spec.seedRadius : spec.seedShape === "lobed" ? spec.seedRadius * (1 + spec.seedDepth)
    : spec.seedShape === "bar" ? spec.seedSpread / 2 + spec.seedRadius : spec.seedSpread + spec.seedRadius;
  const centres: [number, number][] = [];
  const margin = 30;
  for (let k = 0; k < spec.pillarCount; k++) {
    let best: [number, number] = [CANVAS / 2, CANVAS / 2], bestGap = -Infinity;
    for (let attempt = 0; attempt < 30; attempt++) {
      const id = `pillar:${k}#${attempt}`;
      const p: [number, number] = [margin + (CANVAS - 2 * margin) * unit(seed, id, "x"), margin + (CANVAS - 2 * margin) * unit(seed, id, "y")];
      let gap = Math.hypot(p[0] - spec.seedX, p[1] - spec.seedY) - reach - spec.pillarSize;
      for (const c of centres) gap = Math.min(gap, Math.hypot(c[0] - p[0], c[1] - p[1]) - 2 * spec.pillarSize);
      if (gap > bestGap) { best = p; bestGap = gap; }
      if (gap >= 8) break;
    }
    centres.push(best);
  }
  return centres;
}

function build(spec: LayoutSpec, seed: number): GrowthLayout {
  const n = spec.grid, cell = CANVAS / n, cells = n * n;
  const kind = new Uint8Array(cells), seedCells = new Uint8Array(cells);
  const at = (i: number): number => (i + 0.5) * cell;
  const paint = (test: (x: number, y: number) => boolean, value: number, onlyFree: boolean): void => {
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const c = j * n + i;
      if (onlyFree && kind[c] !== KIND_FREE) continue;
      if (test(at(i), at(j))) kind[c] = value;
    }
  };
  const discs = (centres: readonly [number, number][], radius: number) => (x: number, y: number): boolean =>
    centres.some((c) => (x - c[0]) ** 2 + (y - c[1]) ** 2 <= radius * radius);

  // Sources.
  const mid = CANVAS / 2;
  if (spec.source === "ring") paint((x, y) => Math.hypot(x - mid, y - mid) >= spec.sourceRadius, KIND_SOURCE, false);
  else if (spec.source === "frame") {
    const band = Math.max(spec.sourceSize, cell);
    paint((x, y) => Math.min(x, CANVAS - x, y, CANVAS - y) < band, KIND_SOURCE, false);
  } else if (spec.source === "edge") {
    const band = Math.max(spec.sourceSize, cell);
    const side = spec.sourceSide;
    paint((x, y) => (side === "top" ? y : side === "bottom" ? CANVAS - y : side === "left" ? x : CANVAS - x) < band, KIND_SOURCE, false);
  } else if (spec.source === "points")
    paint(discs(ringPoints(spec.sourceCount, spec.sourceRadius, spec.sourceAngle), Math.max(spec.sourceSize, cell * 0.75)), KIND_SOURCE, false);
  else throw new Error(`Unknown source: ${String(spec.source)}`);

  // Sinks (absorbers): never over a source.
  if (spec.sinks === "discs") paint(discs(ringPoints(spec.sinkCount, spec.sinkRing, spec.sinkAngle), Math.max(spec.sinkSize, cell * 0.75)), KIND_SINK, true);
  else if (spec.sinks !== "none") throw new Error(`Unknown sinks: ${String(spec.sinks)}`);

  // Walls: never over a source or a sink.
  if (spec.barrier === "wall") {
    const theta = spec.barrierAngle * radians, ux = Math.cos(theta), uy = Math.sin(theta);
    const length = CANVAS * Math.SQRT2, half = spec.barrierWidth / 2;
    const period = length / spec.barrierGaps;
    const phase = unit(seed, "wall", "gaps") * period;
    paint((x, y) => {
      const along = (x - mid) * ux + (y - mid) * uy, across = -(x - mid) * uy + (y - mid) * ux - spec.barrierOffset;
      if (Math.abs(across) > Math.max(half, cell * 0.5)) return false;
      const t = (((along + length / 2 - phase) % period) + period) % period;
      return Math.abs(t - period / 2) > spec.barrierGapWidth / 2;
    }, KIND_WALL, true);
  } else if (spec.barrier === "pillars") paint(discs(pillarCentres(spec, seed), Math.max(spec.pillarSize, cell * 0.75)), KIND_WALL, true);
  else if (spec.barrier !== "none") throw new Error(`Unknown barrier: ${String(spec.barrier)}`);

  // Seed region: only over free cells.
  const seedTest = ((): ((x: number, y: number) => boolean) => {
    const cx = spec.seedX, cy = spec.seedY, r = spec.seedRadius;
    switch (spec.seedShape) {
      case "disc": return (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      case "lobed": return (x, y) => {
        const dx = x - cx, dy = y - cy, theta = Math.atan2(dy, dx);
        const radius = r * (1 + spec.seedDepth * Math.cos(spec.seedLobes * (theta - spec.seedAngle * radians)));
        return dx * dx + dy * dy <= radius * radius;
      };
      case "cluster": return discs(clusterCentres(spec, seed), r);
      case "necklace": return discs(Array.from({ length: spec.seedCount }, (_, k) => {
        const theta = (spec.seedAngle + 360 * k / spec.seedCount) * radians;
        return [cx + spec.seedSpread * Math.cos(theta), cy + spec.seedSpread * Math.sin(theta)] as [number, number];
      }), r);
      case "bar": {
        const theta = spec.seedAngle * radians, ux = Math.cos(theta), uy = Math.sin(theta);
        return (x, y) => Math.abs((x - cx) * ux + (y - cy) * uy) <= spec.seedSpread / 2 && Math.abs(-(x - cx) * uy + (y - cy) * ux) <= r;
      }
      default: throw new Error(`Unknown seed shape: ${String(spec.seedShape)}`);
    }
  })();
  let seedCount = 0, sourceCells = 0, freeCells = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const c = j * n + i;
    if (kind[c] === KIND_SOURCE) sourceCells++;
    if (kind[c] !== KIND_FREE) continue;
    freeCells++;
    if (seedTest(at(i), at(j))) { seedCells[c] = 1; seedCount++; }
  }
  if (sourceCells === 0) throw new Error("The boundary has no source cells: lower the source radius, raise the source size or move the source points onto the canvas");
  if (seedCount === 0) throw new Error("The seed region is empty: raise the seed radius or move the seed clear of the boundaries (a seed on a source, sink or wall is dropped)");

  const neighbours = new Int32Array(4 * cells), open = new Uint8Array(cells);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const c = j * n + i;
    const pick = (ok: boolean, other: number, slot: number): void => { if (ok && kind[other] !== KIND_WALL) { neighbours[4 * c + slot] = other; open[c]++; } else neighbours[4 * c + slot] = c; };
    pick(j > 0, c - n, 0); pick(j < n - 1, c + n, 1); pick(i > 0, c - 1, 2); pick(i < n - 1, c + 1, 3);
  }
  let mobility: Float32Array | null = null;
  if (spec.noise > 0) {
    mobility = new Float32Array(cells);
    const corner = (I: number, J: number): number => 2 * unit(seed, `lattice:${I},${J}`, "mobility") - 1;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const gx = at(i) / NOISE_LENGTH, gy = at(j) / NOISE_LENGTH, I = Math.floor(gx), J = Math.floor(gy);
      const fx = gx - I, fy = gy - J, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const top = corner(I, J) * (1 - sx) + corner(I + 1, J) * sx, bottom = corner(I, J + 1) * (1 - sx) + corner(I + 1, J + 1) * sx;
      mobility[j * n + i] = 1 + spec.noise * (top * (1 - sy) + bottom * sy);
    }
  }
  return Object.freeze({ n, cell, kind, seedCells, mobility, neighbours, open, sourceCells, freeCells, seedCount });
}
