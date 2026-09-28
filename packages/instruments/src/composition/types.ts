/** p5-compatible 2D drawing boundary. The host owns canvas creation and clearing. */
export interface CompositionSurface {
  readonly CLOSE: unknown;
  readonly ROUND: unknown;
  push(): void;
  pop(): void;
  translate(x: number, y: number): void;
  rotate(radians: number): void;
  scale(value: number): void;
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
  readonly scale: number;
}
export interface Path {
  readonly id: string;
  readonly seed: number;
  readonly points: readonly Point[];
  readonly closed: boolean;
  readonly level: number;
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
export interface MotifSpec {
  kind: "dot" | "rings" | "rosette";
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
  | { kind: "regions"; source: PartitionOptions; fill: RegionFillSpec; palette: readonly number[] };
