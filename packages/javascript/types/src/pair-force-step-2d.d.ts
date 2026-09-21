/** Error with one of the stable motion.pair-force-step-2d contract codes. */
export declare class PairForceStep2DError extends Error {
    code: any;
    constructor(code: any);
}
/**
 * Advance equal-unit-mass 2D bodies synchronously under supplied reciprocal pairs.
 * Implements motion.pair-force-step-2d 0.1.0.
 */
export declare function pairForceStep2D(input: any): {
    points: any[];
    velocities: any[];
    forces: any[];
};
