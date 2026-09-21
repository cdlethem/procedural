/** Error with a stable geometry.resample-polyline-2d code. */
export declare class ResamplePolylineError extends Error {
    code: any;
    constructor(code: any);
}
/** Sample an open or closed explicit polyline at uniform traveled distances. */
export declare function resamplePolyline2D(input: any): {
    points: any[];
    distances: any[];
    sourceSegments: any[];
    totalLength: number;
};
