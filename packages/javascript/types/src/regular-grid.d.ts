/** Error with one of the stable regular-grid contract codes. */
export declare class RegularGridError extends Error {
    code: any;
    constructor(code: any);
}
/**
 * Create an immutable row-major sequence of binary64 planar points.
 * The descriptor stores only origin, spacing, columns, and rows; point storage is caller-owned.
 *
 * Motivating sketches: `2017/Generativos/circlesAlpha` and
 * `2019/generativos/paraisooscuro`. This operation has no approved artistic
 * default or encouraged parameter range: origin, spacing, and point counts are
 * explicit caller choices.
 */
export declare function regularGrid(params: any): Readonly<{
    size: number;
    pointAt: (index: any) => any[];
    pointInto: (index: any, out: any, offset?: number) => any;
    serialize: () => {
        origin: any[];
        spacing: any[];
        columns: any;
        rows: any;
    };
}>;
