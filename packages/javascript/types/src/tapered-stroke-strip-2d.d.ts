export declare class TaperedStrokeStrip2DError extends Error {
    code: any;
    constructor(code: any);
}
export declare function captureStripInput(configuration: any, ErrorType?: typeof TaperedStrokeStrip2DError, checkWork?: boolean): {
    input: any;
    points: any;
    widths: any;
    limit: any;
    n: any;
};
/** Construct a strict visible Region2D from a variable-width centerline. */
export declare function taperedStrokeStrip2D(configuration: any): {
    status: string;
    reason: string;
    witness: {
        kind: string;
        aRing: number;
        aEdge: number;
        bRing: number;
        bEdge: number;
        vertex: number;
    };
} | {
    status: string;
    visible: {
        outer: any;
        holes: any[];
    };
    centerline: any;
    leftBoundary: any[];
    rightBoundary: any[];
    resolvedJoins: any[];
    witness: {
        kind: string;
        aRing: number;
        aEdge: number;
        bRing: number;
        bEdge: number;
        vertex: number;
    };
};
