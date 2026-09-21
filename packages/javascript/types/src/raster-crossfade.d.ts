/** Validation/access error with a stable catalog code. */
export declare class RasterCrossfadeError extends Error {
    code: any;
    constructor(code: any);
}
declare class Crossfade {
    #private;
    constructor(width: any, height: any, pixels: any);
    get width(): any;
    get height(): any;
    pixelAt(value: any): any;
    pixels(): any;
    toValues(): {
        width: any;
        height: any;
        pixels: any;
    };
}
/**
 * Crossfade two same-sized straight ARGB8 rasters using explicit per-pixel weights and
 * premultiplied working channels. Implements raster.crossfade-2d 0.1.0.
 *
 * Provenance: 2017/Generativos/Eyes/eyes002 image stamps; spatial weighting and this
 * portable pixel operation are independently specified project composition work.
 */
export declare function rasterCrossfade2D(input: any): Crossfade;
export {};
