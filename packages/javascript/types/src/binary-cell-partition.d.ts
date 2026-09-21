/** Validation/access error with a stable catalog code. */
export declare class PartitionError extends Error {
    code: any;
    constructor(code: any);
}
declare class Partition {
    #private;
    constructor(left: any, top: any, right: any, bottom: any, splits: any);
    get size(): any;
    get splits(): any;
    boundsAt(index: any): any[];
    boundsInto(index: any, destination: any): any[] | Int32Array<ArrayBufferLike>;
    toValues(): {
        bounds: any[];
        splits: any;
    };
}
/**
 * Generate immutable ordered integer-cell rectangles from attempt-bounded binary cuts.
 * Implements layout.binary-cell-partition-2d 0.1.0.
 *
 * Independently specified from survey/out/2018/Generativos/poop/notes.md and
 * survey/out/2018/Generativos/barab/notes.md. CP17's private native study observed
 * attempts 20/80/240 and RANDOM/LONGEST policies; these are not defaults or
 * encouraged ranges.
 */
export declare function binaryCellPartition2D(input: any): Partition;
export {};
