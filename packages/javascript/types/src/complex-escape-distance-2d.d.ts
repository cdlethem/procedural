/** Error with a stable complex.escape-distance-2d contract code. */
export declare class ComplexEscapeDistance2DError extends Error {
    code: any;
    constructor(code: any);
}
/**
 * Escape-time iteration and derivative distance estimate for z -> z^2 + c.
 * Implements complex.escape-distance-2d 0.1.0.
 */
export declare function complexEscapeDistance2D(input: any): {
    width: number;
    height: number;
    iteration: any[];
    distance: any[];
};
