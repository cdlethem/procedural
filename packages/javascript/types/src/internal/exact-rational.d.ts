/**
 * Normalized exact rational arithmetic shared by internal geometry kernels.
 * Line-for-line port of org.procedurals.geometry.ExactRational (package-private Java
 * class shared by SegmentClip2D and NearestSegmentContact2D). Not exported by the
 * package entry point. Represents supplied binary64 values exactly (via their exact
 * significand*2^exponent decomposition) and converts results back with one
 * nearest-even binary64 rounding step, matching Java's BigInteger-based algorithm.
 */
export declare class ExactRational {
    n: any;
    d: any;
    constructor(numerator: any, denominator: any);
    static of(value: any): ExactRational;
    add(other: any): any;
    subtract(other: any): ExactRational;
    multiply(other: any): any;
    divide(other: any): ExactRational;
    signum(): -1 | 0 | 1;
    compareTo(other: any): -1 | 0 | 1;
    equals(other: any): boolean;
    /** Round to the nearest binary64, ties-to-even, matching Java's BigInteger algorithm exactly. */
    value(): number;
}
export declare namespace ExactRational {
    var ZERO: ExactRational;
    var ONE: ExactRational;
    var TWO: ExactRational;
}
