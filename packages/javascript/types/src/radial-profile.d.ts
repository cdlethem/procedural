/** Stable error returned by mesh.radial-profile-surface-3d. */
export declare class RadialProfileError extends Error {
    code: any;
    faceIndex: any;
    stage: any;
    constructor(code: any, faceIndex?: undefined, stage?: undefined);
}
declare class Result {
    #private;
    constructor(positions: any, triangles: any, normals: any, kinds: any, bands: any, cells: any);
    vertexCount(): number;
    faceCount(): number;
    vertexAt(index: any): any[];
    triangleAt(index: any): any[];
    normalAt(index: any): any[];
    faceKindAt(index: any): any;
    bandAt(index: any): any;
    cellAt(index: any): any;
    vertexInto(index: any, out: any, offset?: number): any;
    triangleInto(index: any, out: any, offset?: number): any;
    normalInto(index: any, out: any, offset?: number): any;
    toValues(): {
        positions: any[];
        triangles: any[];
        normals: any[];
        faceKinds: any[];
        bands: any[];
        cells: any[];
    };
}
/**
 * Owned indexed radial surface generator for mesh.radial-profile-surface-3d 0.1.0.
 * Motivated by survey/out/2017/Generativos/cilindros/notes.md and
 * survey/out/2017/Generativos/fieeee/notes.md. The observed 8/32-slice comparison
 * and the cilindros 128-slice helper establish useful discrete substitutions only:
 * they do not establish defaults, a continuous encouraged range, or capacity advice.
 */
export declare class RadialProfile3D {
    static generate(config: any): Result;
}
export {};
