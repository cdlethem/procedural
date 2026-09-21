export declare class BranchTreeError extends Error {
    code: any;
    parentIndex: any;
    slotIndex: any;
    stage: any;
    constructor(code: any, parentIndex?: undefined, slotIndex?: undefined, stage?: undefined);
}
declare class Result {
    #private;
    constructor(storage: any);
    get size(): any;
    segmentAt(index: any): any[];
    headingAt(index: any): any;
    lengthAt(index: any): any;
    parentAt(index: any): any;
    generationAt(index: any): any;
    childCountAt(index: any): any;
    segmentInto(index: any, out: any, offset?: number): any;
    toValues(): {
        segments: any[];
        headings: any[];
        lengths: any[];
        parents: any[];
        generations: any[];
        childCounts: any[];
    };
}
/**
 * Retain a bounded breadth-first endpoint branch tree.
 * Motivated by survey/out/2018/Generativos/arbolito3/notes.md and
 * survey/out/2018/Generativos/arbolito4/notes.md. Their measured edits establish
 * impact, not defaults or recommended parameter ranges. See
 * topology.seeded-endpoint-branches-2d.
 */
export declare function seededEndpointBranches2D(config: any): Result;
export {};
