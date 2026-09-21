/** Stable errors for the two circle-placement contracts. */
export declare class CirclePlacementError extends Error {
    code: any;
    candidateIndex: any;
    stage: any;
    constructor(code: any, candidateIndex?: undefined, stage?: undefined);
}
declare class CirclePlacementResult {
    #private;
    constructor(coordinates: any, radii: any, indices: any, attempts: any);
    get size(): any;
    get attempts(): any;
    pointAt(index: any): any[];
    pointInto(index: any, out: any, offset?: number): any;
    radiusAt(index: any): any;
    sourceIndexAt(index: any): any;
    toValues(): {
        centres: any[];
        radii: any[];
        sourceIndices: any[];
        attempts: any;
    };
}
/** Retains explicit circle proposals in their supplied order. */
export declare function orderedCircleFilter2D(config: any): CirclePlacementResult;
/** Generates ordered candidates from the private portable stream, then uses the shared filter. */
export declare function seededCirclePlacement2D(config: any): CirclePlacementResult;
export {};
