/** Error with one of the stable closed-spline-2d contract codes. */
export declare class SplineError extends Error {
    code: any;
    constructor(code: any);
}
declare class Spline {
    #private;
    constructor(controls: any, resolution: any, a: any, b: any, c: any, d: any, cumulative: any, length: any);
    get length(): any;
    get controlCount(): any;
    get subdivisions(): any;
    sampleParameterInto(value: any, target: any): any;
    sampleParameter(value: any): {
        x: number;
        y: number;
        tangentX: number;
        tangentY: number;
    };
    sampleDistanceInto(value: any, target: any): any;
    sampleDistance(value: any): {
        x: number;
        y: number;
        tangentX: number;
        tangentY: number;
    };
    sample(input: any): {
        point: number[];
        tangent: number[];
    };
    serialize(): {
        controls: any[][];
        subdivisions: any;
    };
}
/**
 * Retain a closed uniform Catmull-Rom spline from explicit planar controls with direct
 * parameter and approximate distance queries. Implements geometry.closed-spline-2d 0.1.0
 * independently of source code. Motivating sketches: survey/out/2018/Generativos/blobs and
 * survey/out/2018/Generativos/databol; no artistic control-count or subdivision range is
 * established, see the catalog contract for evidence. Distance arithmetic uses a ported,
 * bit-exact fdlibm5.3 hypot (verified against java.lang.StrictMath.hypot), not host Math.hypot.
 */
export declare function closedSpline2D(config: any): Spline;
export {};
