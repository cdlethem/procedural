import type { GraphComposition } from "./graph-draw.js";
import type { TypeRhythmComposition } from "./type-rhythm-draw.js";
import type { PlatesRecipe } from "./plates.js";
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
  /**
   * Optional structural palette index (e.g. wallpaper operation, lattice exception). Stock marks
   * use it instead of a per-site random hue so colour can carry structure.
   */
  readonly tone?: number;
  /** Optional multiplier in [0, 1] on the stock mark's alpha; absent is 1 (see `exposeGrains`). */
  readonly opacity?: number;
}
/** A lattice site keeps its exact grid origin and structural exception state. */
export interface LatticeSite extends Site {
  readonly origin: Point;
  readonly anchor: boolean;
  readonly kept: boolean;
  /** True when the site is omitted or strongly disturbed (over 70% of a stated disorder limit). */
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
  /** Optional structural palette index; materials use it instead of a per-path random hue. */
  readonly tone?: number;
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
/** Documented coordinate maps; each acts on normalized coordinates (x, y) / radius. */
export type MapName = "sinusoidal" | "swirl" | "fisheye" | "spherical" | "polar" | "handkerchief" | "waves" | "horseshoe";
/** One stage blends the identity toward its map by `amount`; `frequency` is the map's coefficient. */
export interface MapStage { map: MapName; amount: number; frequency: number }
/** A site carried through a coordinate map; `flipped` marks sites the map turned inside out. */
export interface WarpedSite extends Site {
  readonly flipped: boolean;
}
export interface WarpOptions {
  centerX: number;
  centerY: number;
  /** Canvas length treated as 1 in map coordinates. */
  radius: number;
  /** Applied in order; the whole chain repeats `iterations` times. */
  stages: readonly MapStage[];
  iterations: number;
  /** Points mapped farther than bound × radius from the center are excluded (singularity policy). */
  bound: number;
}
/** Rows and columns of straight lines, and their crossings as sites. */
export interface GridOptions {
  seed: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  /** 0..1: stable per-line shift of interior lines (up to 45% of a spacing); edges stay put. */
  jitter: number;
}
/** Explicit supported substitution constructions; not a generic name for arbitrary triangles. */
export type TilingRuleName = "penrose-p3" | "chair";
/** Exact substitution rule + seed patch + depth → oriented tiles. Lengths are canvas units, angles degrees. */
export interface TilingOptions {
  /** uint32. The tiling itself is deterministic; the seed only names each element's stable chance stream. */
  seed: number;
  rule: TilingRuleName;
  /** A seed patch of the chosen rule (see `tilingRules`). */
  patch: string;
  /** Substitution generations applied to the seed patch. Tile area scales by the exact ratio per generation. */
  depth: number;
  centerX: number;
  centerY: number;
  /** Canvas distance from the patch center to its farthest seed vertex; fixed while depth changes. */
  radius: number;
  /** Clockwise on the canvas. */
  rotation: number;
  /** Lone half-tiles appear where a seed boundary cuts a Penrose rhombus; `whole` omits them. */
  boundary: "half-tiles" | "whole";
  /** Keep tiles whose centroid lies inside the shape; `none` keeps the whole patch. */
  crop: "none" | "rectangle" | "ellipse";
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
}
/** A tile is a Site at its centroid: `angle` is its axis, `scale` 1. Draw in the local frame with `outline`. */
export interface TilingTile extends Site {
  /** `thin`/`thick` for penrose-p3; `nw`/`ne`/`se`/`sw` (elbow corner of the unrotated seed) for chair. */
  readonly class: string;
  /** Index of `class` in `Tiling.classes`; also the piece class of the tile's canonical half. */
  readonly classIndex: number;
  /** Substitution generation of the tile's pieces; equals the tiling depth. */
  readonly generation: number;
  /** Parent piece id of the canonical half; null at generation 0. */
  readonly parentId: string | null;
  /** Substitution pieces composing the tile: one for the chair, two Robinson half-tiles (or one lone half) for Penrose. */
  readonly pieces: readonly string[];
  /** Child index path from the seed piece down to the canonical piece: [seedPiece, slot, slot, …]. */
  readonly path: readonly number[];
  /** Piece class of each ancestor along `path`, generation 0 first. */
  readonly lineage: readonly number[];
  /** False for a lone Penrose half-tile at the patch boundary. */
  readonly complete: boolean;
  /** Canvas polygon, positive winding, starting at the tile's own reference vertex. */
  readonly points: readonly Point[];
  /** The same polygon relative to `position` and rotated by −`angle`; congruent tiles share it. */
  readonly outline: readonly Point[];
  /** Interior angle at each polygon vertex in turn/`Tiling.unitsPerTurn` units. */
  readonly corners: readonly number[];
  /** Vertex ids in polygon order. */
  readonly vertexIds: readonly string[];
  readonly area: number;
}
/** A tile corner point with its incident geometry; a Site with angle 0 and scale 1. */
export interface TilingVertex extends Site {
  /** Number of tile corners meeting here. */
  readonly valence: number;
  /** Sorted incident corner angles in turn/`unitsPerTurn` units, joined by ".". */
  readonly signature: string;
  /** True when corners plus straight-through tile edges close a full turn. */
  readonly interior: boolean;
  /** True when equal corners alone close the turn: the Penrose sun (five 72 degree corners), the chair's four right angles. */
  readonly regular: boolean;
  /** Kept tiles with a corner here. */
  readonly tiles: readonly string[];
}
/** A maximal shared segment; edges are split at T-junctions, so no two edges overlap. */
export interface TilingEdge {
  readonly id: string;
  readonly seed: number;
  readonly a: string;
  readonly b: string;
  readonly points: readonly [Point, Point];
  /** Kept tiles on either side; `null` when the other side is absent, cropped or the patch boundary. */
  readonly tiles: readonly [string, string | null];
  /** First generation at which the two sides' ancestries differ (0 = outer boundary or different seed pieces). */
  readonly level: number;
}
export interface Tiling {
  readonly rule: TilingRuleName;
  readonly patch: string;
  readonly depth: number;
  readonly classes: readonly string[];
  /** Angle unit: one turn is this many units (10 for Penrose, 4 for the chair). */
  readonly unitsPerTurn: number;
  /** Canvas length of the shortest tile edge. */
  readonly edgeLength: number;
  /** Leaf substitution pieces generated (the bounded work measure). */
  readonly pieces: number;
  readonly tiles: readonly TilingTile[];
  readonly vertices: readonly TilingVertex[];
  readonly edges: readonly TilingEdge[];
}
/** A tile fill draws inside the tile's local frame (origin at the centroid, x along the tile axis). */
export type TileFiller = (surface: CompositionSurface, tile: TilingTile, run: CompositionRun) => void;
export interface TileFillSpec {
  kind: "none" | "flat" | "wash" | "hatch" | "concentric" | "mark";
  /** Clearance inside each tile edge, in canvas units. */
  inset: number;
  /** 0..1 paint strength of flat, wash and hatch. */
  opacity: number;
  /** Hatch interval or concentric step, in canvas units. */
  spacing: number;
  /** Hatch direction in degrees relative to the tile axis. */
  angle: number;
  /** Extra hatch turn per class index, in degrees, so classes hatch differently. */
  classTurn: number;
  weight: number;
  /** Translucent passes of a wash. */
  layers: number;
  /** Wash edge wander as a fraction of the tile size. */
  bleed: number;
  /** Stable per-tile omission. */
  retention: number;
  /** `mark.size` is a fraction of the tile's own scale (square root of its area). */
  mark: MotifSpec;
}
/** How each hierarchical tone is derived from a tile's ancestry. */
export type TileColorMode = "class" | "ancestor" | "supertile" | "slot";
export interface TilingView {
  /** Tile classes that are drawn; the others are omitted and leave bare paper. */
  classes: readonly string[];
  /** Stable per-tile omission (by tile id) applied to every consumer, so edges and vertices follow the tiles left. */
  retention: number;
  colorBy: TileColorMode;
  /** Generations above the leaves used by `ancestor`, `supertile` and `slot`. */
  colorLevel: number;
  fill: TileFillSpec;
  /** `visible`: edges next to a drawn tile; `all`: every edge of the tiling. */
  edges: "none" | "visible" | "all";
  edgeColor: "uniform" | "hierarchy";
  edgeMaterial: PathMaterialSpec;
  vertices: "none" | "all" | "interior" | "regular";
  vertexMark: MotifSpec;
}
/** Named, JSON-compatible compositions. No evaluated code or host layer identities. */
export type ReferenceComposition =
  | { kind: "sites"; source: PoissonOptions; mark: MotifSpec; palette: readonly number[] }
  | { kind: "paths"; source: ContourOptions; material: PathMaterialSpec; palette: readonly number[] }
  | { kind: "regions"; source: PartitionOptions; fill: RegionFillSpec; palette: readonly number[] }
  | { kind: "cells"; source: CellTreeOptions; fill: RegionFillSpec; palette: readonly number[] }
  | { kind: "lattice"; source: LatticeOptions; mark: MotifSpec; palette: readonly number[] }
  | { kind: "wallpaper"; source: WallpaperOptions; mark: MotifSpec; palette: readonly number[] }
  | { kind: "warp"; grid: GridOptions; map: WarpOptions; material: PathMaterialSpec; mark: MotifSpec; palette: readonly number[] }
  | ({ kind: "graph" } & GraphComposition)
  | PlatesRecipe
  | ({ kind: "typography" } & TypeRhythmComposition)
  | { kind: "tiling"; source: TilingOptions; view: TilingView; palette: readonly number[] };
