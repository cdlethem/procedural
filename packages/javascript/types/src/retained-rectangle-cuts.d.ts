/** Validation/access error with a stable catalog code. */
export declare class RectangleCutError extends Error {
    code: any;
    constructor(code: any);
}
/**
 * Caller-directed retained rectangular regions with stable never-reused identities.
 * Implements layout.retained-rectangle-cuts-2d 0.1.0.
 *
 * Independently specified from survey/out/2019/generativos/griton/notes.md. The
 * motivating work supplies retained unequal regions; its source-specific selection,
 * ratios, omission, drawing, and random behavior are outside this operation.
 */
export declare class RetainedRectangleCuts2D {
    #private;
    constructor(left: any, top: any, right: any, bottom: any);
    /** Replaces a live leaf with low-coordinate then high-coordinate children; returns their IDs. */
    cut(id: any, axis: any, coord: any): number[];
    /** Removes a live leaf without replacing it or changing later identity allocation. */
    remove(id: any): void;
    /** Returns the immutable value for a live leaf. */
    leaf(id: any): any;
    /** Returns a detached array in current live-leaf order. */
    leaves(): any[];
    /** Returns the current live-leaf count. */
    get size(): number;
    /**
     * Materializes a fully detached mutable {nextId,leaves:[{id,bounds}]} snapshot.
     * This snapshot is descriptive only and is not a restoration or replay input.
     */
    toValues(): {
        nextId: number;
        leaves: {
            id: any;
            bounds: any;
        }[];
    };
}
/** Creates a root from exactly {bounds:[left,top,right,bottom]}. */
export declare function retainedRectangleCuts2D(config: any): RetainedRectangleCuts2D;
