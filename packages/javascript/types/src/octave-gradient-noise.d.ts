/** Error with a stable field.octave-gradient-noise contract code. */
export declare class OctaveGradientNoiseError extends Error {
    code: any;
    constructor(code: any);
}
/**
 * Evaluate a bounded, ordered geometric sum of an existing 2D or 3D gradient field.
 * Implements field.octave-gradient-noise 0.1.0.
 */
export declare function octaveGradientNoise(input: any): {
    values: any[];
    amplitudeSum: number;
};
