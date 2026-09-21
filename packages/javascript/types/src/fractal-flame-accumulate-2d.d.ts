/** Error with a stable fractal.flame-accumulate-2d contract code. */
export declare class FractalFlameAccumulate2DError extends Error {
    code: any;
    constructor(code: any);
}
/**
 * Accumulate one fractal-flame point process into a bilinear density buffer.
 * Implements fractal.flame-accumulate-2d 0.1.0.
 */
export declare function fractalFlameAccumulate2D(input: any): {
    density: {
        width: number;
        height: number;
        values: any[];
    };
    plotted: number;
    dropped: number;
    rngState: number;
};
