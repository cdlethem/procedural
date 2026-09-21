/** Error with one of the stable gradient-path contract codes. */
export declare class GradientPathError extends Error {
    code: any;
    stepIndex: any;
    stage: any;
    constructor(code: any, stepIndex?: undefined, stage?: undefined);
}
/**
 * Eagerly trace a fixed-step path through the named portable gradient field.
 *
 * Motivating sketches: `2019/generativos/ciserp`, `2018/Generativos/mantel`,
 * `2019/generativos/natalata`, and `2019/generativos/limo002`. The retained path deliberately leaves marks,
 * envelopes, clipping, and rendering to the caller. No artistic default or
 * encouraged parameter range is approved: all configuration is explicit.
 */
export declare function gradientPath2D(config: any): Readonly<{
    pointAt: (index: any) => number[];
    headingAt: (index: any) => number;
    pointInto: (index: any, out: any, offset?: number) => any;
    serialize: () => {
        field: {
            seed: any;
        };
        start: any[];
        steps: any;
        stepDistance: any;
        fieldScale: any;
        fieldOffset: any[];
        angleBase: any;
        angleScale: any;
    };
    toValues: () => {
        positions: any[];
        headings: number[];
    };
}>;
