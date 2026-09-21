export declare class WeightedRasterCentroids2DError extends Error {
    code: any;
    constructor(code: any);
}
/** Move each site once to the exact pixel-mass centroid of its original nearest pixels. */
export declare function weightedRasterCentroids2D(input: any): {
    sites: any[];
    masses: number[];
};
