/** Error with one of the stable path.noise-band-trace-2d contract codes. */
export declare class NoiseBandPathError extends Error {
    code: any;
    attemptIndex: any;
    stage: any;
    constructor(code: any, attemptIndex?: null, stage?: null);
}
declare class Path {
    #private;
    constructor(positions: any, headings: any, attempts: any, accepted: any, rejected: any, config: any);
    get size(): number;
    get attempts(): any;
    get accepted(): any;
    get rejected(): any;
    pointAt(index: any): any[];
    pointInto(index: any, output: any, offset?: number): any;
    headingAt(index: any): any;
    serialize(): any;
    toValues(): {
        positions: any[][];
        headings: any;
        attempts: any;
        accepted: any;
        rejected: any;
    };
}
/**
 * Retain an attempt-bounded connected path whose accepted proposals remain within
 * a strict scalar band around the starting noise value. Implements
 * path.noise-band-trace-2d 0.1.0 independently of source code. Motivating sketch:
 * survey/out/2018/Generativos/venas; no artistic attempts/tolerance/scale range is
 * established, see the catalog contract for evidence. Uses a bit-exact ported
 * fdlibm5.3 sin/cos (verified against java.lang.StrictMath.sin/cos), not host Math.
 */
export declare function noiseBandPath2D(input: any): Path;
export {};
