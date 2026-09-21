/** Stable failure code for malformed construction, queries, and arithmetic overflow. */
export declare class PullError extends Error {
    code: any;
    constructor(code: any);
}
declare class RadialPull {
    #private;
    constructor(owned: any, count: any);
    get influenceCount(): any;
    serialize(): {
        influences: any[];
    };
    transform(x: any, y: any): number[] | {
        x: number;
        y: number;
    };
    transformInto(x: any, y: any, target: any): void;
}
/**
 * Create an immutable ordered radial-displacement field. Implements
 * geometry.radial-pull-2d 0.1.0.
 *
 * Motivated by survey/out/2018/Generativos/curvespace/notes.md, its curvespace
 * computation, the private CP19 radial-warp study, and
 * design/operations/radial-pull-contract.md. Each influence pulls the original
 * query toward its center within its radius; contributions are summed in supplied
 * order. The exact-center contribution is zero and radius endpoints contribute
 * zero. This function performs no rendering, clipping, inversion, topology
 * preservation, or field sampling.
 */
export declare function radialPull2D(descriptor: any): RadialPull;
export {};
