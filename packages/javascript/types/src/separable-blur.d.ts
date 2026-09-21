/** Validation/access error with a stable catalog code. */
export declare class SeparableBlurError extends Error {
    code: any;
    constructor(code: any);
}
declare class Blur {
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
 * Owned normalized separable filtering of straight ARGB8 rasters. Implements
 * raster.separable-blur-2d 0.1.0.
 *
 * Independently specified project work motivated by active weighted neighborhood
 * filters in survey/out/2015/Generativos/cityPink3d/notes.md and
 * survey/out/2020/generative/01_04/rgblur/notes.md. It deliberately does not
 * reproduce their shader gain, vignette, scanlines, fractional taps, or mask
 * modulation. Working RGB is encoded and premultiplied for the specified
 * arithmetic; it is not linear-light filtering. Kernels are explicit caller data:
 * no default or recommended artistic kernel range is provided.
 */
export declare function separableBlur2D(input: any): Blur;
export {};
