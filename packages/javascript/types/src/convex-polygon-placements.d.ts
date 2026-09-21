/** Validation/access error with a stable catalog code and candidate index. */
export declare class PlacementError extends Error {
    code: any;
    candidateIndex: number;
    constructor(code: any, candidateIndex?: number);
}
declare class Placements {
    #private;
    constructor(polygons: any, sourceIndices: any, attempts: any);
    get attempts(): any;
    get size(): any;
    sourceIndexAt(index: any): any;
    vertexCountAt(index: any): any;
    xAt(polygonIndex: any, vertexIndex: any): any;
    yAt(polygonIndex: any, vertexIndex: any): any;
    toValues(): {
        attempts: any;
        polygons: any;
        sourceIndices: any;
    };
}
/**
 * Filter caller-supplied strictly convex polygon proposals by greedy non-intersecting
 * placement, in proposal order. Implements sampling.ordered-convex-polygon-filter-2d 0.1.0.
 *
 * Motivated by survey/out/2017/Generativos/celular/notes.md and
 * survey/out/2017/Generativos/celular2/notes.md. Independently specified symmetric
 * containment/contact semantics intentionally differ from source collision defects.
 */
export declare function orderedConvexPolygonFilter2D(input: any): Placements;
export {};
