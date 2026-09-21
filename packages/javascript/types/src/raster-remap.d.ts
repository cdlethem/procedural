/** Error with one of the stable raster.bilinear-remap-2d contract codes. */
export declare class RasterRemapError extends Error {
    code: any;
    constructor(code: any);
}
declare class Raster {
    #private;
    constructor(width: any, height: any, pixels: any);
    get width(): any;
    get height(): any;
    pixelAt(index: any): any;
    pixels(): any;
    toValues(): {
        width: any;
        height: any;
        pixels: any;
    };
}
/**
 * Remap an owned packed ARGB8 raster through explicit source coordinates using
 * edge-clamped bilinear interpolation. Implements raster.bilinear-remap-2d 0.1.0
 * independently of source code. Motivating sketch: survey/out/2016/Generativos/colorRamp;
 * dimensions, coordinates and pixels are caller data, no encouraged range is evidenced.
 * Stored channels are interpolated independently (straight, not premultiplied).
 */
export declare function bilinearRasterRemap2D(input: any): Raster;
export {};
