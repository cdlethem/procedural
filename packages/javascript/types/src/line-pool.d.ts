/** Error with one of the stable topology.seeded-line-pool-2d contract codes. */
export declare class LinePoolError extends Error {
    code: any;
    constructor(code: any, detail?: null);
}
declare class LinePool {
    #private;
    constructor(coordinates: any, divided: any, attempts: any, successfulCuts: any, skips: any);
    get size(): any;
    get attempts(): any;
    get successfulCuts(): any;
    get skips(): any;
    segmentAt(index: any): any[];
    segmentInto(index: any, destination: any, offset?: number): any;
    dividedAt(index: any): any;
    toValues(): {
        segments: any[];
        divided: any[];
        attempts: any;
        successfulCuts: any;
        skips: any;
    };
}
/**
 * Generates a detached retained pool of branching segments by repeatedly cutting
 * a selected existing segment, motivated by survey/out/2019/generativos/brotes/notes.md.
 * The parameter decision is recorded in design/capabilities/line-pool-admission.md: the
 * inspected control experiment tested 9000/90000/180000 attempts and first-cut angle
 * scales 0.7/1.4/2.1; those discrete observations do not establish a default or
 * continuous encouraged range. minCutLength is a caller coordinate-unit termination
 * threshold based on the source's 4-unit skip, not a measured artistic range.
 */
export declare function seededLinePool2D(config: any): LinePool;
export {};
