export declare class HatchRegionLines2DError extends Error {
    code: any;
    constructor(code: any);
}
/** Return line fragments inside a strict region, ordered by scanline then travel direction. */
export declare function hatchRegionLines2D(configuration: any): {
    paths: any[][][];
    lineIndices: any[];
    intervals: any[][];
};
