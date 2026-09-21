export declare class FlockSteer2DError extends Error {
    code: any;
    constructor(code: any);
}
/** Calculate graph-supplied, synchronous flock steering without integration. */
export declare function flockSteer2D(inputValue: any): {
    steering: any[];
};
