/** Error with one of the stable gradient-noise-3d-01 contract codes. */
export declare class GradientNoise3D01Error extends Error {
    code: any;
    constructor(code: any);
}
/**
 * Create an immutable three-coordinate portable gradient-noise field.
 * Implements field.gradient-noise-3d-01 0.1.0.
 *
 * Motivated by survey/out/2016/Generativos/pelosNoise2/notes.md depth slices and
 * survey/out/2018/Generativos/conitos/notes.md volumetric samples. Independently
 * specified, not Processing noise or a matching z=0 slice of gradient-noise-2d-01.
 * No artistic default or encouraged parameter range is established.
 */
export declare function gradientNoise3D01(params: any): Readonly<{
    sample: (x: any, y: any, z: any) => any;
    serialize: () => {
        seed: any;
    };
}>;
