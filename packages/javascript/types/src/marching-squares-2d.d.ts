/** Error with a stable geometry.marching-squares-2d code. */
export declare class MarchingSquaresError extends Error {
    code: any;
    constructor(code: any);
}
/** Extract independent, ordered isoline segments from a row-major scalar grid. */
export declare function marchingSquares2D(input: any): {
    segments: any[][];
    cellIndices: number[];
};
