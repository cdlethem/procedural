/** Error with one of the stable gradient-noise-2d-01 contract codes. */
export declare class GradientNoise2D01Error extends Error {
    code: any;
    constructor(code: any);
}
/**
 * Create an immutable single-octave 2D portable gradient-noise field.
 *
 * Motivating sketch: 2018/Generativos/pelines. No artistic default or encouraged
 * parameter range is established; seed is explicit and coordinates use lattice units.
 * The field is pure and seed-only. It is independently specified for CP1 rather
 * than a compatibility wrapper around a host noise implementation.
 */
export declare function gradientNoise2D01(params: any): Readonly<{
    sample: (x: any, y: any) => any;
    serialize: () => {
        seed: any;
    };
}>;
