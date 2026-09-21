/** Error with a stable raster.seeded-pixel-grain contract code. */
export declare class SeededPixelGrainError extends Error {
    code: any;
    constructor(code: any);
}
/**
 * Apply one deterministic shared RGB offset or alpha multiplier to each straight ARGB8
 * source pixel. Implements raster.seeded-pixel-grain 0.1.0.
 */
export declare function seededPixelGrain(input: any): {
    raster: {
        width: number;
        height: number;
        pixels: any[];
    };
    rngState: number;
};
