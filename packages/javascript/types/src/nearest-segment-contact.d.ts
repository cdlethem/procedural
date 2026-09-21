/** Signals an operation error with stable contract detail. */
export declare class ContactError extends Error {
    code: any;
    queryIndex: number;
    stage: any;
    constructor(code: any, queryIndex?: number, stage?: null);
}
declare class NearestSegmentContact2D {
    #private;
    constructor(hits: any);
    get size(): any;
    hitAt(index: any): any;
    toValues(): {
        hits: any[];
    };
}
/**
 * Find the nearest closed-segment contact for each directed query segment. Implements
 * geometry.nearest-segment-contact-2d 0.1.0.
 *
 * Queries and obstacles use caller coordinate units, origins, and axes. Contacts are
 * selected with exact rational arithmetic from supplied binary64 values before their
 * parameter and point are rounded once to binary64. Admitted as the independent contact
 * dependency from 2018/Generativos/plasma007#2, documented at
 * survey/out/2018/Generativos/plasma007/notes.md; it does not include that sketch's ray
 * generation or ordered two-pass drawing orchestration.
 */
export declare function nearestSegmentContact2D(configuration: any): NearestSegmentContact2D;
export {};
