export declare class PrepareSurfaceAttributes3DError extends Error {
    code: any;
    constructor(code: any);
}
/** Prepare detached triangle attributes without a renderer, weld, UV chart, or material. */
export declare function prepareSurfaceAttributes3D(input: any): {
    positions: never[];
    triangles: never[];
    normals: never[];
    uvs: never[] | null;
    sourceVertexIndices: never[];
};
