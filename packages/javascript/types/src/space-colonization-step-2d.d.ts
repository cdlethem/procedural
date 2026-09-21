/** Error with one of the stable growth.space-colonization-step-2d contract codes. */
export declare class SpaceColonizationStep2DError extends Error {
    code: any;
    constructor(code: any);
}
/**
 * One bounded space-colonization growth step.
 * Implements growth.space-colonization-step-2d 0.1.0.
 */
export declare function spaceColonizationStep2D(input: any): {
    tips: any[];
    segments: any[][];
    consumed: boolean[];
    dropped: number;
};
