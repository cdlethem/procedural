/** Error with one of the stable spatial.radius-pairs-2d contract codes. */
export declare class RadiusPairs2DError extends Error {
    code: any;
    constructor(code: any);
}
/**
 * Enumerate unordered original point indices within an inclusive Euclidean radius.
 * Implements spatial.radius-pairs-2d 0.1.0 with the contract's sorted-x sweep.
 */
export declare function radiusPairs2D(input: any): {
    pairs: any[][];
};
