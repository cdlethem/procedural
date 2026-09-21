/** Stable contract failure with no partially published result. */
export declare class DiscProjectionError extends Error {
    code: any;
    constructor(code: any);
}
declare class DiscProjection {
    #private;
    constructor(coordinates: any);
    get size(): number;
    points(): any;
    toValues(): {
        points: any[];
    };
    pointInto(index: any, target: any, offset: any): void;
}
/**
 * Ordered outward point deformation. Implements geometry.sequential-disc-projection-2d
 * 0.1.0. Motivated by survey/out/2019/generativos/colidion/notes.md.
 *
 * Each disc receives the point changed by preceding discs. Exact centers use
 * positiveX; later discs may undo earlier exclusion. This is not collision
 * resolution or clipping. Strength is explicit caller data with no default or
 * recommended artistic range.
 */
export declare function sequentialDiscProjection2D(input: any): DiscProjection;
export {};
