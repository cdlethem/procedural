/** Error with a stable field.displace-points-2d contract code. */
export declare class FieldDisplace2DError extends Error {
    code: any;
    constructor(code: any);
}
/**
 * Convert paired pre-sampled field channels into Cartesian or polar point offsets.
 * Implements field.displace-points-2d 0.1.0.
 */
export declare function fieldDisplace2D(input: any): {
    points: any[];
    offsets: any[];
};
