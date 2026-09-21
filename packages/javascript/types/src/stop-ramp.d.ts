/** Error with one of the stable color.stop-ramp contract codes. */
export declare class StopRampError extends Error {
    code: any;
    constructor(code: any);
}
declare class Ramp {
    #private;
    constructor(positions: any, colors: any);
    serialize(): {
        stops: {
            position: any;
            color: any;
        }[];
    };
    sample(query: any): any;
}
/**
 * Immutable noncyclic positioned RGB24 color stops with piecewise linear sampling and
 * endpoint holds. Implements color.stop-ramp 0.1.0 independently of source code.
 * Motivating sketches: survey/out/2016/Generativos/boxDepth, celular, colorRamp and
 * triangleRamp; no artistic stop-count/position/palette range is established, see the
 * catalog contract for evidence.
 */
export declare function stopRamp(input: any): Ramp;
export {};
