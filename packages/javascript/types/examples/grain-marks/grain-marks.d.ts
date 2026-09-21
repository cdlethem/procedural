export type GrainPointRegion = Readonly<{
  size: number;
  pointAt(index: number): [number, number];
}>;

export type GrainComposition = Readonly<{
  size: number;
  totalPoints: number;
  regionAt(index: number): GrainPointRegion;
}>;

export declare function createGrainComposition(
  seed: number,
  density: number,
  distribution: number,
  cells: boolean,
): GrainComposition;
