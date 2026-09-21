export declare class TrianglePointsError extends Error {
    code: any;
    constructor(code: any);
}
declare class Result {
    #private;
    constructor(points: any);
    get size(): number;
    pointAt(index: any): any[];
    pointInto(index: any, out: any, offset?: number): any;
    toValues(): {
        points: any[];
    };
}
/** Retain uniform triangle samples; motivated by puntis2.
 * Seed/count/vertices are explicit; no measured continuous useful range is claimed.
 * See sampling.seeded-triangle-points-2d and survey/out/2018/Generativos/puntis2/notes.md.
 */
export declare function seededTrianglePoints2D(config: any): Result;
/** Map explicit unit pairs; motivated by puntis/puntis3 coordinate substitutions.
 * Pairs must be in [0,1]; this is a domain, not an artistic range or distribution.
 * See survey/out/2018/Generativos/puntis/notes.md and puntis3/notes.md.
 */
export declare function mapTriangleCoordinates2D(config: any): Result;
export {};
