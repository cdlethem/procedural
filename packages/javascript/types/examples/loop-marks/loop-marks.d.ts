/**
 * Example composition motivated by databol and blobs; not source replay. These
 * constants (centers, radii base/spread, subdivisions, tile spacing/size,
 * fan count) describe this piece, not public defaults or recommended ranges.
 */
export declare const COLORS: readonly number[];
export declare const OTHER_COLORS: readonly number[];
export declare const BACKGROUND_RGB = 16117990;
/** Retained curves for style-only recolor/fan-mode edits; T rebuilds geometry. */
export declare function createLoopMarks(moved?: boolean): Readonly<{
    moved: boolean;
    curves: readonly any[];
}>;
/**
 * Yield the "tiles" view: a translucent 192-segment outline stroke, plus rotated
 * two-layer tile glyphs every 18 distance units. Rounded corners (radius 3/1 in
 * the Java source) are drawn as plain rectangles here: the shared fresh-raster-2d
 * command vocabulary is exactly segment2 (capped line) and quad2 (convex fill),
 * with no rounded-rect primitive.
 */
export declare function loopTileCommands(model: any, alternate: any): Generator<{
    kind: string;
    from: any;
    to: any;
    rgb: any;
    opacity8: any;
    width: any;
    cap: string;
} | {
    kind: string;
    vertices: any;
    rgb: any;
    opacity8: any;
}, void, unknown>;
/**
 * Yield the "fans" view: FAN_SAMPLES colored triangles per curve, fanning from
 * its center to consecutive perimeter samples. Fan drawing is an artistic use of
 * the selected outline, not polygon triangulation, and (like the Java source)
 * is not expressed through the shared quad2 vocabulary, which admits only
 * strictly-convex four-vertex fills, not triangles.
 */
export declare function loopFanTriangles(model: any, alternate: any): Generator<{
    cx: number;
    cy: number;
    x1: any;
    y1: any;
    x2: any;
    y2: any;
    rgb: number;
    opacity8: number;
}, void, unknown>;
