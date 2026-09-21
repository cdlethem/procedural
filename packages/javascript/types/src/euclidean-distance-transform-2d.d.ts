export declare class EuclideanDistanceTransform2DError extends Error {
    code: any;
    constructor(code: any);
}
export declare function euclideanDistanceTransform2D(input: any): {
    distances: any[];
    nearestIndices: any[];
};
