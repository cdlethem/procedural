export declare class RaymarchImplicitRays3DError extends Error {
    code: any;
    constructor(code: any);
}
export declare function raymarchImplicitRays3D(input: any): {
    results: {
        kind: any;
        distance: any;
        traveled: any;
        position: any;
        fieldValue: any;
        normal: any[] | null;
        normalStatus: string;
        overshot: boolean;
        samples: any;
        normalSamples: number;
    }[];
};
