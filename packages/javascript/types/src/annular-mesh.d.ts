/** Static input or retained-result access failure. */
export declare class MeshError extends Error {
    code: any;
    constructor(code: any);
}
/** Valid input exceeded its required face budget before geometry allocation. */
export declare class FaceLimitError extends Error {
    code: string;
    constructor();
}
/** A generated face cannot produce the specified scaled flat normal. */
export declare class MeshArithmeticError extends Error {
    code: string;
    faceIndex: any;
    stage: any;
    constructor(faceIndex: any, stage: any);
}
declare class AnnularMesh3D {
    #private;
    constructor(positions: any, normals: any, triangles: any, slices: any);
    get vertexCount(): number;
    get faceCount(): number;
    vertexAt(index: any): any[];
    normalAt(index: any): any[];
    triangleAt(index: any): any[];
    faceKindAt(index: any): string;
    cellAt(index: any): number;
    vertexInto(index: any, output: any, offset: any): void;
    normalInto(index: any, output: any, offset: any): void;
    triangleInto(index: any, output: any, offset: any): void;
    toValues(): {
        positions: any[][];
        triangles: any[][];
        normals: any[][];
        faceKinds: string[];
        cells: number[];
    };
}
/**
 * Generate an owned indexed closed annular mesh. Implements mesh.annular-solid-3d 0.1.0.
 *
 * Local units are caller-defined. The axis is +Z, and angular cells increase from +X
 * toward +Y. The result contains four welded rings in outer-bottom, outer-top,
 * inner-bottom, inner-top order, and four face kinds per cell: outer wall, inner wall,
 * top annulus, and bottom annulus. There is no seam vertex at 2*PI and no interior
 * radial face.
 *
 * Motivated by survey/out/2017/Generativos/aros/notes.md (the annulusMesh candidate)
 * and evidence/parameter-experiments/annular-mesh/decision.md. The operation has no
 * renderer, style, random state, defaults, or recommended parameter range.
 */
export declare function annularSolid3D(input: any): AnnularMesh3D;
export {};
