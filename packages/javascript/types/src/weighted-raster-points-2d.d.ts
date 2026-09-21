export declare class WeightedRasterPoints2DError extends Error {
    code: any;
    constructor(code: any);
}
/** Select jittered pixel positions from explicit integer mass and LCG32 state. */
export declare function weightedRasterPoints2D(input: any): {
    points: number[][];
    pixelIndices: number[];
    rngState: any;
};
