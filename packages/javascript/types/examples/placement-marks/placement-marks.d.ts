export declare const BASE_PALETTE: readonly number[];
export declare const ALTERNATE_PALETTE: readonly number[];

export type PlacementResult = Readonly<{
  size: number;
  attempts: number;
  pointAt(index: number): [number, number];
  pointInto(index: number, out: number[] | Float64Array, offset?: number): void;
  radiusAt(index: number): number;
  sourceIndexAt(index: number): number;
}>;

export type PlacementMarks = Readonly<{
  source: "seeded" | "radial";
  placements: PlacementResult;
}>;

export declare function createSeededPlacementMarks(
  seed?: number,
  attempts?: number,
  minimum?: number,
  maximum?: number,
  separation?: number,
): PlacementMarks;
export declare function createRadialPlacementMarks(separation?: number): PlacementMarks;
export declare function vertexInto(
  placements: PlacementResult,
  circle: number,
  vertex: number,
  diamond: boolean,
  out: number[] | Float64Array,
): void;
