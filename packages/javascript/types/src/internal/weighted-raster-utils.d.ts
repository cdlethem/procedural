export declare const RASTER_LIMIT = 2147483647;
export declare const UINT32_MAX = 4294967295;
/** Validate and summarize a passive integer mass raster, before any work preflight. */
export declare function weightedRaster(input: any, keys: any, ErrorType: any): {
    width: any;
    height: any;
    size: number;
    weights: any;
    total: number;
    active: number;
};
