/** Validation/access error with a stable catalog code. */
export declare class MaskedCompositeError extends Error {
    code: any;
    constructor(code: any);
}
declare class Composite {
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
 * Composite same-sized straight ARGB8 rasters using an explicit scalar visibility mask.
 * Implements raster.masked-source-over-2d 0.1.0.
 *
 * Provenance: 2017/Generativos/Eyes/eyes002 image stamps; spatial masking and this
 * portable pixel operation are independently specified project composition work.
 */
export declare function maskedSourceOver2D(input: any): Composite;
export {};
