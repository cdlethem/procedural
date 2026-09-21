/** Error with one of the stable cyclic-palette contract codes. */
export declare class CyclicPaletteError extends Error {
    code: any;
    constructor(code: any);
}
/**
 * Create an immutable cyclic RGB24 sampler.
 *
 * Motivating notes: `survey/out/2018/Generativos/mountain4/notes.md`,
 * `survey/out/2018/Generativos/pelines/notes.md`, and
 * `survey/out/2017/Generativos/Cuadricula/notes.md`.
 * They establish cyclic adjacent-colour interpolation; this operation uses
 * portable cycles and encoded sRGB8 channels rather than host `lerpColor` behavior.
 * No default palette, phase, or encouraged artistic range is established.
 */
export declare function cyclicPalette(params: any): Readonly<{
    sample: (phase: any) => any;
    serialize: () => {
        colors: any[];
    };
}>;
