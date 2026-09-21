export declare const BASE_PALETTE: readonly number[];
export declare const ALTERNATE_PALETTE: readonly number[];
/**
 * Example composition motivated by ciserp, mantel, natalata, and limo002.
 * These constants describe this piece, not public defaults or recommended ranges.
 */
export declare function createPathMarks(seed?: number, steps?: number, distance?: number): Readonly<{
    seed: number;
    steps: number;
    distance: number;
    paths: readonly any[];
}>;
/** Invent another mark here; the heading is the movement arriving at the endpoint. */
export declare function pathMark(x: any, y: any, heading: any, length: any, rgb: any): {
    kind: string;
    from: any[];
    to: any[];
    rgb: any;
    opacity8: number;
    width: number;
    cap: string;
};
/**
 * Lazily produce drawing commands. The frame sink consumes bounded batches, so this
 * generator never retains the composition's full command stream.
 */
export declare function pathMarkCommands(movement: any, trace: any, markLength: any, colors: any): Generator<{
    kind: string;
    from: any[];
    to: any[];
    rgb: any;
    opacity8: number;
    width: number;
    cap: string;
}, void, unknown>;
/**
 * Canvas-specific view of the raw stream. It preserves command values and order,
 * omitting only a segment whose full bounding box misses the 640px canvas padded
 * by one pixel. It is intentionally not clipping and does not alter the retained
 * paths or `pathMarkCommands()`.
 */
export declare function visiblePathMarkCommands(movement: any, trace: any, markLength: any, colors: any): Generator<{
    kind: string;
    from: any[];
    to: any[];
    rgb: any;
    opacity8: number;
    width: number;
    cap: string;
}, void, unknown>;
export declare function commandCount(movement: any, trace: any): any;
