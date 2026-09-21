/** Error with one of the stable motion.target-springs-2d contract codes. */
export declare class SpringError extends Error {
    code: any;
    bodyIndex: any;
    axis: any;
    stage: any;
    constructor(code: any, bodyIndex?: null, axis?: null, stage?: null);
}
declare class TargetSprings {
    #private;
    constructor(current: any, count: any);
    get size(): any;
    positionAt(index: any): any[];
    velocityAt(index: any): any[];
    positionInto(index: any, output: any, offset?: number): any;
    velocityInto(index: any, output: any, offset?: number): any;
    strengthAt(index: any): any;
    retentionAt(index: any): any;
    toValues(): {
        bodies: {
            position: any[];
            velocity: any[];
            strength: any;
            retention: any;
        }[];
    };
}
/**
 * Advance an ordered independent target-spring state by one explicit logical step:
 * target force, position using updated velocity, then velocity retention.
 * Implements motion.target-springs-2d 0.1.0 independently of source code. Motivating
 * sketch: survey/out/2018/Generativos/araniaaas; no artistic strength/retention range
 * is established, see the catalog contract for evidence. Each call is a pure one-step
 * transition; feed a returned state back in as the next call's state for animation.
 */
export declare function targetSprings2D(input: any): TargetSprings;
export {};
