/** Stable operation failure. Dynamic failures identify their source and merged interval. */
export declare class SegmentClipError extends Error {
    code: any;
    sourceIndex: number;
    intervalIndex: number;
    stage: any;
    constructor(code: any, sourceIndex?: number, intervalIndex?: number, stage?: null);
}
declare class SegmentClip {
    #private;
    constructor(output: any);
    get size(): any;
    sourceIndexAt(index: any): any;
    segmentAt(index: any): any[];
    segmentInto(index: any, destination: any, offset: any): void;
    intervalAt(index: any): any[];
    intervalInto(index: any, destination: any, offset: any): void;
    toValues(): {
        segments: any[][];
        sourceIndices: any[];
        intervals: any[][];
    };
}
/**
 * Clip supplied line segments against one simple polygon with exact topology, rounding
 * each retained interval once to binary64. Implements geometry.clip-segments-simple-polygon-2d
 * 0.1.0.
 *
 * Motivated by the retained clipping dependency in survey/out/2014/Generativos/Forms/forms1/
 * notes.md; hatch generation, drawing, styling, and polygon boolean operations are
 * deliberately outside it.
 */
export declare function clipSegmentsSimplePolygon2D(input: any): SegmentClip;
export {};
