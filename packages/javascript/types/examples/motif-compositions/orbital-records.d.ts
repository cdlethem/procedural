export declare const ORBITAL_WORK_BUDGET = 64000;
export declare function orbitalSourceVertices(q: any): number;
export declare function validateOrbitalRecordInput(q: any): void;
/**
 * Example-private source record; mark controls and palette are deliberately absent.
 * @returns {ReadonlyArray<{points: ReadonlyArray<ReadonlyArray<number>>, distances: ReadonlyArray<number>, colorIndex: number}>}
 */
export declare function orbitalBrushRecords({ params: q }: {
    params: any;
}): ReadonlyArray<{
    points: ReadonlyArray<ReadonlyArray<number>>;
    distances: ReadonlyArray<number>;
    colorIndex: number;
}>;
export declare function spacedSampleIndices(path: any, spacing: any): any;
