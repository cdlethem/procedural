/** Error with a stable geometry.voronoi-cells-2d code. */
export declare class VoronoiCellsError extends Error {
    code: any;
    constructor(code: any);
}
/** Return clipped nearest-site polygons in the input site order. */
export declare function voronoiCells2D(input: any): {
    cells: any[];
};
