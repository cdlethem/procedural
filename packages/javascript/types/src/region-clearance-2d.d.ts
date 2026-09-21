/** Stable error for geometry.region-clearance-2d. */
export declare class RegionClearance2DError extends Error {
    code: any;
    constructor(code: any);
}
/**
 * Classify two strict Region2D values.  Boundary IDs deliberately refer to supplied
 * ring order; this query never normalizes an input ring just to make an answer pretty.
 */
export declare function regionClearance2D(configuration: any): {
    relation: string;
    minimumDistance: any;
    witness: {
        kind: string;
        aRing: number;
        aEdge: number;
        bRing: number;
        bEdge: number;
        vertex: number;
    };
};
