/** Error with a stable fresh-raster validation code. */
export declare class DrawingError extends Error {
    code: any;
    constructor(code: any);
}
/**
 * Return whether four cyclic binary64 points have one nonzero exact turn sign.
 * Internal-only: it is exported from this module for native numeric conformance,
 * never from the package entry point.
 */
export declare function strictlyConvex(points: any): boolean;
/** Validate and detach the fresh density-1 drawing environment. */
export declare function validateEnvironment(value: any): {
    width: any;
    height: any;
    density: number;
    background: any;
};
/**
 * Normalize one command against an explicitly supplied fresh-raster environment.
 * The result is detached canonical data for a later renderer adapter; no surface,
 * state machine, host colour state, or raster operation is involved here.
 * The environment is revalidated here so this standalone internal helper remains
 * safe when called without a prior `validateEnvironment` step.
 */
export declare function normalizeCommand(command: any, environment: any): {
    outcome: string;
    kind: any;
    points: any;
    rgb: any;
    channels: number[];
    opacity8: any;
    alpha64: any;
};
