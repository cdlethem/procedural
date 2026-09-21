/** Validation/access error with a stable catalog code and optional midpoint detail. */
export declare class PartitionError extends Error {
    code: any;
    replacementIndex: any;
    stage: any;
    constructor(code: any, replacementIndex?: null, stage?: null);
}
declare class Partition {
    #private;
    constructor(left: any, top: any, right: any, bottom: any, ids: any, replacements: any);
    get size(): any;
    get replacements(): any;
    boundsAt(index: any): any[];
    idAt(index: any): any;
    boundsInto(index: any, out: any, offset?: number): any[] | Float64Array<ArrayBufferLike>;
    toValues(): {
        bounds: any;
        ids: any;
        replacements: any;
    };
}
/**
 * Retain equal-quadrant bounds and birth IDs in live-list mutation order.
 * Implements layout.seeded-quadrant-partition-2d0.1.0 independently of source code.
 * Motivating sketches: survey/out/2018/Generativos/mosaic02 and
 * survey/out/2018/Generativos/mosaic. The private Java investigation observed discrete
 * replacement settings100/200 and selection fractions0.5/1; neither defaults nor
 * continuous useful ranges are established. See the catalog contract for evidence.
 */
export declare function seededQuadrantPartition2D(config: any): Partition;
export {};
