/** Error with one of the stable delaunay-2d contract codes. */
export declare class DelaunayError extends Error {
    code: any;
    constructor(code: any);
}
declare class Delaunay2D {
    #private;
    constructor(points: any, inputToVertex: any, sourceIndices: any, triangles: any, edges: any, edgeFaces: any, workUsed: any);
    get inputCount(): any;
    get vertexCount(): number;
    get faceCount(): number;
    get edgeCount(): number;
    get workUsed(): any;
    pointAt(index: any): any[];
    triangleAt(index: any): any[];
    edgeAt(index: any): any[];
    edgeFacesAt(index: any): any[];
    pointInto(index: any, out: any, offset?: number): any;
    triangleInto(index: any, out: any, offset?: number): any;
    edgeInto(index: any, out: any, offset?: number): any;
    edgeFacesInto(index: any, out: any, offset?: number): any;
    inputVertexAt(index: any): any;
    sourceIndexAt(index: any): any;
    toValues(): {
        points: any[][];
        inputToVertex: any;
        sourceIndices: any;
        triangles: any[][];
        edges: any[][];
        edgeFaces: any[][];
        workUsed: any;
    };
}
/**
 * Build retained exact planar Delaunay topology from an ordered finite binary64
 * site list and explicit deterministic work budget.
 * Implements topology.delaunay-2d 0.1.0 independently of source code.
 * Motivating sketches: survey/out/2018/Generativos/datata and
 * survey/out/2019/generativos/lightcity. No site sampling, palette, renderer or
 * artistic range is established; see the catalog contract for evidence.
 */
export declare function delaunay2D(config: any): Delaunay2D;
export {};
