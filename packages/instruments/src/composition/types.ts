/** p5-compatible 2D drawing boundary. The host owns canvas creation and clearing. */
export interface CompositionSurface {
  readonly CLOSE: unknown;
  readonly ROUND: unknown;
  push(): void;
  pop(): void;
  translate(x: number, y: number): void;
  rotate(radians: number): void;
  scale(x: number, y?: number): void;
  noFill(): void;
  noStroke(): void;
  fill(...channels: number[]): void;
  stroke(...channels: number[]): void;
  strokeWeight(weight: number): void;
  strokeCap(cap: unknown): void;
  circle(x: number, y: number, diameter: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  rect(x: number, y: number, width: number, height: number): void;
  beginShape(): void;
  vertex(x: number, y: number): void;
  endShape(mode?: unknown): void;
}
export type Point = readonly [number, number];
export interface Site {
  readonly id: string;
  readonly seed: number;
  readonly position: Point;
  /** Radians. Mark callbacks draw at their own origin, in this frame. */
  readonly angle: number;
  /** Positive: uniform scale. Negative: mirror across the site's frame axis. */
  readonly scale: number;
}
/** A lattice site keeps its exact grid origin and structural exception state. */
export interface LatticeSite extends Site {
  readonly origin: Point;
  readonly anchor: boolean;
  readonly kept: boolean;
  /** True when the site is displaced, rotated, rescaled, anchored-as-exception or omitted. */
  readonly exception: boolean;
}
export interface Path {
  readonly id: string;
  readonly seed: number;
  readonly points: readonly Point[];
  readonly closed: boolean;
  readonly level: number;
  /** 0 at the first threshold, 1 at the last; stable per source construction. */
  readonly levelFraction: number;
}
/** Rectangular regions for this slice; not a general polygon or raster mask. */
export interface Region {
  readonly id: string;
  readonly seed: number;
  /** World-space [left, top, right, bottom]. Fill callbacks use local [0,width] × [0,height]. */
  readonly bounds: readonly [number, number, number, number];
}
export interface CompositionRun {
  readonly workUsed: number;
  readonly depth: number;
  enter(work: number): void;
  leave(): void;
  check(): void;
}
/** One node of a recursive cell tree; parents precede children in the published array. */
export interface RegionTreeNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly depth: number;
  /** World-space [left, top, right, bottom]. */
  readonly bounds: readonly [number, number, number, number];
  readonly seed: number;
  readonly terminal: boolean;
}
export type Mark = (surface: CompositionSurface, site: Site, run: CompositionRun) => void;
/** Path coordinates remain in their source frame; no automatic path transform. */
export type PathMaterial = (surface: CompositionSurface, path: Path, run: CompositionRun) => void;
export type RegionFiller = (surface: CompositionSurface, region: Region, run: CompositionRun) => void;

export interface PoissonOptions {
  seed: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  separation: number;
  maxPoints: number;
  support: "rectangle" | "ellipse" | "annulus";
  opening: number;
  rotation: number;
}
export interface ContourOptions {
  seed: number;
  source: "noise" | "hills" | "waves" | "saddle";
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  resolution: number;
  frequency: number;
  aspect: number;
  hillCount: number;
  hillRadius: number;
  levelBase: number;
  levelStep: number;
  levels: number;
  rotation: number;
}
export interface PartitionOptions {
  seed: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  columns: number;
  rows: number;
  attempts: number;
  axis: "LONGEST" | "RANDOM";
  bias: number;
}
/** Explicit plane symmetry groups; no unexplained “symmetry amount”. */
export type WallpaperGroup =
  "p1" | "p2" | "pm" | "pg" | "cm" | "pmm" | "pmg" | "pgg" | "cmm"
  | "p4" | "p4m" | "p4g" | "p3" | "p3m1" | "p31m" | "p6" | "p6m";
export interface WallpaperOptions {
  seed: number;
  group: WallpaperGroup;
  cellWidth: number;
  cellHeight: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  /** Motif anchor as a fraction of the unit cell, [0,1) × [0,1). */
  motifOffsetX: number;
  motifOffsetY: number;
  /** Instances within this canvas margin of the domain remain visible. */
  margin: number;
  /** Bounded per-instance deviation; zero preserves exact symmetry. */
  breakAmount: number;
  /** Stable fraction of instances subjected to symmetry breaking. */
  breakDensity: number;
}
export interface LatticeOptions {
  seed: number;
  columns: number;
  rows: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  /** Correlation length in cells for the shared disorder field. */
  correlation: number;
  /** Maximum displacement as a fraction of the cell size. */
  displacement: number;
  /** Maximum rotation in radians. */
  rotation: number;
  /** Maximum relative scale deviation. */
  scale: number;
  /** Omission threshold on the correlated field; zero keeps every site. */
  omission: number;
  /** Stable fraction of sites pinned to their exact grid origin. */
  anchors: number;
  /** Focal region where disorder is strongest; smooth falloff beyond it. */
  focalX: number;
  focalY: number;
  focalRadius: number;
  /** Stable per-site retention independent of the correlated omission. */
  retention: number;
}
export interface CellTreeOptions {
  seed: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  depth: number;
  /** Leaves smaller than this on the short side stop subdividing. */
  minSize: number;
  /** Stable early stopping of individual nodes. */
  stopChance: number;
  /** Stable per-child retention; omitted children leave their area bare. */
  childRetention: number;
  axis: "LONGEST" | "RANDOM";
  bias: number;
}
export interface MotifSpec {
  kind: "dot" | "rings" | "rosette" | "arrow";
  size: number;
  petals: number;
  opening: number;
  weight: number;
  rotation: number;
  /** Stable per-site scale variation, zero means identical sizes. */
  variation: number;
  retention: number;
}
export interface PathMaterialSpec {
  kind: "ink" | "stitch" | "beads";
  weight: number;
  spacing: number;
  phase: number;
  /** Stable per-path spread around the global station phase; zero keeps them aligned. */
  phaseSpread: number;
  /** Bead size ramp across contour bands, 0 at the first threshold toward the last. */
  levelRamp: number;
  retention: number;
  mark: MotifSpec;
}
export interface RegionFillSpec {
  kind: "hatch" | "motifs" | "contours" | "mixed";
  inset: number;
  retention: number;
  spacing: number;
  angle: number;
  weight: number;
  underpaint: number;
  mark: MotifSpec;
  material: PathMaterialSpec;
  /** Editable field construction fitted to each leaf; seed and frame come from the region. */
  contour: Omit<ContourOptions, "seed" | "width" | "height" | "centerX" | "centerY" | "rotation">;
}
/** Named, JSON-compatible compositions. No evaluated code or host layer identities. */
export type ReferenceComposition =
  | { kind: "sites"; source: PoissonOptions; mark: MotifSpec; palette: readonly number[] }
  | { kind: "paths"; source: ContourOptions; material: PathMaterialSpec; palette: readonly number[] }
  | { kind: "regions"; source: PartitionOptions; fill: RegionFillSpec; palette: readonly number[] }
  | { kind: "cells"; source: CellTreeOptions; fill: RegionFillSpec; palette: readonly number[] }
  | { kind: "lattice"; source: LatticeOptions; mark: MotifSpec; palette: readonly number[] }
  | { kind: "wallpaper"; source: WallpaperOptions; mark: MotifSpec; palette: readonly number[] };
